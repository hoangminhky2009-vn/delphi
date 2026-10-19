/**
 * PFM — TẦNG API `/api/v1/pfm/*` (05b Phụ lục T2, GĐ1 D186+ nối ra HTTP thật).
 *
 * ⚠⚠ HANDLER Ở ĐÂY CỐ Ý MỎNG: parse + kiểm input + gọi hàm nghiệp vụ đã có
 * (`ngay.ts`/`token.ts`/`xoa.ts`/`ket.ts`) + trả lời. KHÔNG viết lại logic đã có —
 * hai bản cài đặt của cùng một việc là bản thứ hai sẽ trôi (D61).
 *
 * ⚠ THỨ TỰ BẮT BUỘC: rate-limit XONG HẲN rồi mới `pool.connect()` mở transaction
 * (T5.6). `consumeLimit` tự xin một đường nối riêng — gọi nó trong lúc đang giữ một
 * đường nối khác là treo đúng kiểu sự cố 12/08 (`docs/gioi-han-ha-tang.md`).
 *
 * ⚠ TOÀN BỘ `/pfm/*` CHẶN KHÁCH (K9) — không route nào ở đây được thiếu `chanKhach`.
 * Có bài test ĐỘ PHỦ canh riêng chuyện này (T5.6), vì "quên một route mới" là đúng
 * kiểu lỗ đã từng mở cho Kho bạc (xem `server/subsidy.ts`).
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { consumeLimit } from '../auth/rate_limit.js';
import { PFM, PFM_LO } from '../../config/pfm.js';
import { TRANG_THAI_NGAY } from '../../config/pfm_events.js';
import {
  CONSENT_PHIEN_BAN, CUA_PFM, CUA_PFM_COT, CUA_CANH_DUONG, laConsentHienHanh, laCuaPfm,
  vanBanCua, type CuaPfm,
} from '../../config/pfm_consent.js';
import { ghiDiemDanh, type TrangThaiNgay } from './ngay.js';
import { xoaSachPfm } from './xoa.js';
import { ghiLatThang, docLatThang, soiTruocKhiGhi } from './ket.js';
import { ghiEventPfm } from './su_kien.js';
import { napLo } from './dong_bo.js';
import { napTinHieuGameKy } from './tin_hieu_ky.js';
import { niemPhongTuan } from './tuan.js';

import type { Env, Mw as Middleware } from '../http/types.js';

/*
 * ⚠ Enum này TRƯỚC ĐÂY khai ngay tại đây, tách rời khỏi whitelist K5 vốn chỉ trỏ tới
 * nó bằng chú thích. Nay lấy thẳng từ `config/pfm_events.ts` — cùng một nguồn với cửa
 * kiểm giá trị, nên không thể lệch nhau (R9).
 */

/** 'YYYY-MM-01' hợp lệ — cùng khuôn kiểm ngày của `tinhChuoi` (ngay.ts). */
export function laThangHopLe(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-01$/.test(s)) return false;
  return !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/**
 * TRẦN KÍCH CỠ THÂN REQUEST — đọc `content-length`, KHÔNG tiêu thụ luồng body.
 *
 * ⚠⚠ VÌ SAO KHÔNG DÙNG MIDDLEWARE THƯ VIỆN: `hono/body-limit` đã bị gỡ khỏi repo
 * 12/08 vì nó làm MỌI route đi qua `consumeLimit` treo tới hạn 10,4s của Vercel rồi
 * 504 — kể cả route không liên quan gì tới body lớn (xem `server/app.ts` dòng ~322).
 * Bài học: lớp phòng thủ phải KHÔNG đụng luồng body, chỉ đọc header rồi từ chối.
 *
 * ⚠ THIẾU HEADER ⇒ TỪ CHỐI (T5.7 — không mặc định "chắc là nhỏ"): chặt hơn phần lớn
 * cơ chế chặn kích cỡ thân thường thấy (chúng chỉ chặn khi VƯỢT trần, cho qua khi vắng).
 *
 * Export để test đơn vị gọi thẳng (giả một `c` tối giản) — cách duy nhất tạo được
 * tình huống "content-length vắng mặt" đáng tin, vì `fetch`/`app.request()` thật tự
 * điền header này bất cứ khi nào có thân, nên không dựng được ca thiếu header qua HTTP.
 */
export function chanContentLength(maxBytes: number): Middleware {
  return async (c: any, next: any) => {
    const cl = c.req.header('content-length');
    if (cl === undefined) {
      return c.json(
        { error: 'thieu_content_length', message: 'Thiếu header content-length.' }, 411);
    }
    const n = Number(cl);
    if (!Number.isInteger(n) || n < 0) {
      return c.json({ error: 'content_length_khong_hop_le' }, 400);
    }
    if (n > maxBytes) {
      return c.json(
        { error: 'qua_lon', message: `Thân request vượt trần ${maxBytes} byte.` }, 413);
    }
    await next();
  };
}

/* ══ BỐN CỬA CONSENT (D295) — ghép tên cột MỘT chỗ, mọi cổng đi qua đây ═══════════════ */

/**
 * Mảnh SELECT `<cột> AS <cửa>` cho cả bốn cửa — ghép từ `CUA_PFM_COT`, không gõ tay tên
 * cột ở chỗ thứ hai (D61). `/me` (app.ts) nối mảnh này vào câu đọc sẵn có của nó, để
 * không tốn thêm một request trên đường nóng (K11).
 */
export const COT_CUA_SELECT = CUA_PFM.map((cua) => `${CUA_PFM_COT[cua]} AS ${cua}`).join(', ');

/** Rút bốn cửa từ một hàng đã SELECT bằng `COT_CUA_SELECT`. Vắng hàng ⇒ bốn cửa đóng. */
export function cuaTuHang(hang: Record<string, unknown> | undefined): Record<CuaPfm, boolean> {
  const cua = {} as Record<CuaPfm, boolean>;
  for (const k of CUA_PFM) cua[k] = hang?.[k] === true;
  return cua;
}

/** Trạng thái bốn cửa của một user — pool hay client đều được; cổng chỉ đọc, không khoá. */
export async function docCua(
  db: pg.Pool | pg.PoolClient, userId: string,
): Promise<Record<CuaPfm, boolean>> {
  const r = await db.query(`SELECT ${COT_CUA_SELECT} FROM users WHERE user_id = $1`, [userId]);
  return cuaTuHang(r.rows[0]);
}

/**
 * Cửa nào canh đường này — tra NGƯỢC `CUA_CANH_DUONG` để route không gõ tên cửa lần
 * thứ hai. Đường không có trong bảng ⇒ ném lúc nạp module (lộ khi boot, không đợi tới
 * lúc có người gọi).
 */
function cuaCanh(duong: string): CuaPfm {
  const cua = CUA_PFM.find((k) => (CUA_CANH_DUONG[k] as readonly string[]).includes(duong));
  if (!cua) throw new Error(`${duong} không có trong CUA_CANH_DUONG (config/pfm_consent.ts)`);
  return cua;
}

const DUONG_DIEM_DANH = '/api/v1/pfm/diem-danh';
const DUONG_TUAN = '/api/v1/pfm/tuan';
const DUONG_DONG_BO = '/api/v1/pfm/dong-bo';
const DUONG_LUU = '/api/v1/pfm/luu';
const CUA_DIEM_DANH = cuaCanh(`POST ${DUONG_DIEM_DANH}`);
const CUA_TUAN = cuaCanh(`POST ${DUONG_TUAN}`);
const CUA_DONG_BO = cuaCanh(`POST ${DUONG_DONG_BO}`);
const CUA_LUU = cuaCanh(`POST ${DUONG_LUU}`);

export function registerPfmRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware; chanKhach: Middleware },
): void {
  /**
   * Cổng MỘT cửa. Mã lỗi/status GIỮ NGUYÊN `chua_bat_pfm`/403 của bản một-công-tắc —
   * client cũ vẫn hiểu; chỉ THÊM `cua` để client mới biết phải mở cửa nào.
   */
  const chanCua = async (
    c: any, userId: string, cua: CuaPfm, viec: string,
  ): Promise<Response | null> => {
    if ((await docCua(pool, userId))[cua]) return null;
    return c.json({
      error: 'chua_bat_pfm', cua,
      message: `Cửa "${cua}" đang đóng — bật nó ở cài đặt PFM trước khi ${viec} nhé.`,
    }, 403);
  };

  // ── /pfm/consent — bật/tắt MỘT cửa (D295); pfm_consent = "có cửa nào bật", cùng câu UPDATE ──
  app.post('/api/v1/pfm/consent', mw.requireAuth, mw.requireOnboarded, mw.chanKhach, async (c) => {
    const actor = c.get('actor');
    const userId = actor.userId!;
    const body = ((await c.req.json().catch(() => null)) ?? {}) as
      { cua?: unknown; bat?: unknown; van_ban_id?: unknown; phien_ban?: unknown };
    const cua = body.cua;
    if (!laCuaPfm(cua)) {
      return c.json({
        error: 'invalid_input', field: 'cua', message: `cua phải một trong: ${CUA_PFM.join(', ')}.`,
      }, 400);
    }
    if (typeof body.bat !== 'boolean') {
      return c.json({ error: 'invalid_input', field: 'bat', message: 'Trường bat phải true/false.' }, 400);
    }
    const batMoi = body.bat;
    const vanBan = vanBanCua(cua);
    /*
     * ⚠ BẬT thì phải kèm VẾT VĂN BẢN CỦA ĐÚNG CỬA ẤY (R1 · 05c §2.1); TẮT thì không.
     * Bất đối xứng này có lý do: BẬT là một hành vi đồng ý — phải chứng minh được người
     * dùng đã đọc bản nào. TẮT là RÚT LẠI, và rút lại thì không bao giờ được dựng thêm
     * rào; đòi họ khai văn bản để được tắt là biến quyền rút thành một thủ tục.
     * ⚠ Cặp phải là bản ĐANG HIỆU LỰC, không phải "một bản nào đó từng có": client gửi
     * lên phiên bản cũ nghĩa là màn hình nó đang hiện văn bản cũ.
     * ⚠ Và phải là văn bản CỦA CỬA đang bật: gửi `pfm_ket` để mở `thuong` là màn hình
     * đang hiện sai văn bản — vết ghi ra sẽ "chứng minh" một điều không xảy ra.
     */
    if (batMoi && (body.van_ban_id !== vanBan
      || !laConsentHienHanh(body.van_ban_id, body.phien_ban))) {
      return c.json({
        error: 'invalid_input', field: 'van_ban_id',
        message: `Bật cửa ${cua} phải kèm đúng văn bản của nó: ${vanBan}@${CONSENT_PHIEN_BAN[vanBan]}.`,
      }, 400);
    }
    const phienBan = body.phien_ban as string;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const u = await client.query(
        `SELECT ${COT_CUA_SELECT}, pfm_consent, pfm_bat_dau
           FROM users WHERE user_id = $1 FOR UPDATE`, [userId]);
      const cuaTruoc = cuaTuHang(u.rows[0]);
      const consentTruoc = u.rows[0].pfm_consent === true;

      // Không đổi gì ⇒ thao tác rỗng, không ghi event trùng (cùng lý lẽ /me/handle).
      if (cuaTruoc[cua] === batMoi) {
        await client.query('COMMIT');
        return c.json({
          ok: true, doi: false, cua: cuaTruoc,
          pfm_consent: consentTruoc, pfm_bat_dau: u.rows[0].pfm_bat_dau,
        });
      }

      /*
       * ⚠ MỘT CÂU UPDATE cho cả cửa lẫn cờ gộp. `pfm_consent` = OR của bốn cửa SAU khi
       * đổi, tính TRONG SQL từ chính các cột — không từ một bản JS của bốn cửa, vì bản
       * ấy là bản thứ hai và sẽ trôi (D61). Hai câu riêng thì có một khoảnh khắc cờ gộp
       * nói khác các cửa, và `/me` đọc trúng khoảnh khắc ấy là hiện sai.
       * `pfm_bat_dau` chỉ đặt LẦN ĐẦU (COALESCE) và chỉ khi BẬT; tắt không xoá mốc.
       */
      const coCuaBat = CUA_PFM
        .map((k) => (k === cua ? '$2::boolean' : CUA_PFM_COT[k])).join(' OR ');
      const sau = await client.query(
        `UPDATE users
            SET ${CUA_PFM_COT[cua]} = $2::boolean,
                pfm_consent = (${coCuaBat}),
                pfm_bat_dau = CASE WHEN $2::boolean THEN COALESCE(pfm_bat_dau, now())
                                   ELSE pfm_bat_dau END
          WHERE user_id = $1
      RETURNING ${COT_CUA_SELECT}, pfm_consent, pfm_bat_dau`,
        [userId, batMoi]);
      const hang = sau.rows[0];
      const consentSau = hang.pfm_consent === true;

      if (batMoi) {
        // `pfm_bat` = PFM bật lên TỪ KHÔNG (cửa đầu tiên), không phải mỗi lần thêm một cửa.
        if (!consentTruoc && consentSau) await ghiEventPfm(client, userId, 'pfm_bat', {});
        /*
         * ⚠ CÙNG TRANSACTION với cú bật cửa — không phải "ghi thêm cho đủ". Nếu vết đi
         * riêng và hỏng, ta có đúng cái tình trạng đang muốn tránh: cột nói "đã đồng ý"
         * mà không ai dựng lại được đồng ý với văn bản nào.
         */
        await ghiEventPfm(client, userId, 'pfm_consent', { van_ban_id: vanBan, phien_ban: phienBan });
      } else {
        // TẮT không xoá dữ liệu — việc riêng của POST /pfm/xoa (P9 🔒). Vết nói RÕ cửa nào.
        await ghiEventPfm(client, userId, 'pfm_tat', { cua });
      }

      await client.query('COMMIT');
      return c.json({
        ok: true, doi: true, cua: cuaTuHang(hang),
        pfm_consent: consentSau, pfm_bat_dau: hang.pfm_bat_dau,
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  // ── /pfm/diem-danh — nâng cấp một chiều; CÙNG transaction: pfm_ngay + events ──
  app.post(DUONG_DIEM_DANH, mw.requireAuth, mw.requireOnboarded, mw.chanKhach, async (c) => {
    const actor = c.get('actor');
    const userId = actor.userId!;
    const body = await c.req.json().catch(() => null) as { trang_thai?: unknown } | null;
    const trangThai = body?.trang_thai;
    if (typeof trangThai !== 'string' || !(TRANG_THAI_NGAY as readonly string[]).includes(trangThai)) {
      return c.json({
        error: 'invalid_input', field: 'trang_thai',
        message: `trang_thai phải một trong: ${TRANG_THAI_NGAY.join(', ')}.`,
      }, 400);
    }

    const chan = await chanCua(c, userId, CUA_DIEM_DANH, 'điểm danh');
    if (chan) return chan;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const kq = await ghiDiemDanh(client, userId, trangThai as TrangThaiNgay);
      // boQua = cú này sẽ TỤT bậc (D140) — không ghi event cho một cú bị bỏ qua.
      if (!kq.boQua) {
        await ghiEventPfm(client, userId, 'pfm_diem_danh', { trang_thai: kq.trangThai });
      }
      await client.query('COMMIT');
      return c.json({ ok: true, ...kq });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  // ── /pfm/tuan — NIÊM PHONG TUẦN (nghi lễ Chủ nhật, K7) ──────────────────────
  app.post(DUONG_TUAN, mw.requireAuth, mw.requireOnboarded, mw.chanKhach, async (c) => {
    const actor = c.get('actor');
    const userId = actor.userId!;

    const chan = await chanCua(c, userId, CUA_TUAN, 'niêm phong tuần');
    if (chan) return chan;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const kq = await niemPhongTuan(client, userId);
      if (kq.lyDoTuChoi) {
        // Chưa xảy ra gì — ROLLBACK cho sạch, và 409 vì đây là "chưa tới lúc",
        // không phải "sai yêu cầu".
        await client.query('ROLLBACK');
        return c.json({
          error: kq.lyDoTuChoi, tuan: kq.tuan,
          message: 'Hôm nay là ngày cuối tuần này — điểm danh hôm nay trước rồi hãy niêm phong nhé.',
        }, 409);
      }
      if (kq.moi) {
        await ghiEventPfm(client, userId, 'pfm_tuan_niem_phong', { tuan: kq.tuan, moc_ids: [] });
      }
      await client.query('COMMIT');
      return c.json({ ok: true, ...kq });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  /*
   * ── POST /pfm/dong-bo — MỘT LÔ HỖN HỢP (R8/D251, thay `/pfm/dac-trung`) ──────────
   *
   * ⚠ ĐỔI ĐƯỜNG, KHÔNG PHẢI THÊM ĐƯỜNG. `/pfm/dac-trung` nhận `{dong:[…]}` — một
   * hình dây khác hẳn thứ hàng đợi client gom được, và chỉ chở được đặc trưng nên
   * `pfm_hu`/`pfm_luat`/`pfm_consent` không có cửa nào để đi. Giữ nó lại song song
   * là để hai đường cùng ghi một bảng theo hai luật (A11.5). Nó chưa từng có client
   * nào gọi (đã đo ở bản rà) nên gỡ bây giờ là rẻ nhất nó sẽ từng rẻ.
   *
   * ⚠ R2 — `chanContentLength` ĐỌC `content-length`, KHÔNG tiêu luồng body: nó phải
   * đứng TRƯỚC handler, chứ không phải một câu `if` bên trong. Trần đặt sau khi đã
   * đọc hết thân là trần không chặn gì.
   */
  app.post(DUONG_DONG_BO, mw.requireAuth, mw.requireOnboarded, mw.chanKhach,
    chanContentLength(PFM_LO.THAN_TOI_DA), async (c) => {
      const actor = c.get('actor');
      const userId = actor.userId!;

      const chan = await chanCua(c, userId, CUA_DONG_BO, 'đồng bộ');
      if (chan) return chan;

      const body = await c.req.json().catch(() => null) as { mon?: unknown } | null;
      if (!Array.isArray(body?.mon)) {
        return c.json({ error: 'invalid_input', field: 'mon', message: 'mon phải là mảng.' }, 400);
      }
      if (body.mon.length > PFM_LO.SU_KIEN_MOI_LO) {
        return c.json({
          error: 'lo_qua_lon', message: `Mỗi lô tối đa ${PFM_LO.SU_KIEN_MOI_LO} món.`,
        }, 400);
      }
      /*
       * ⚠ ĐẾM DÒNG, KHÔNG CHỈ ĐẾM MÓN. Trần cũ của `/pfm/dac-trung` là 50 DÒNG; đổi
       * sang 50 MÓN thì mỗi món lại chở tới `DONG_MOI_GOI` dòng ⇒ trần thật nhảy 300×
       * mà không ai quyết. `content-length` không cứu: 15.000 dòng `{ma,gia_tri}` ngắn
       * vẫn lọt dưới 64KB.
       */
      const tongDong = (body.mon as unknown[]).reduce<number>((n, m) => {
        const d = (m as { dong?: unknown })?.dong;
        return n + (Array.isArray(d) ? d.length : 1);
      }, 0);
      if (tongDong > PFM_LO.DONG_MOI_LO) {
        return c.json({
          error: 'lo_qua_lon',
          message: `Mỗi lô tối đa ${PFM_LO.DONG_MOI_LO} dòng (đang ${tongDong}).`,
        }, 400);
      }

      // Trần LÔ/ngày (K11) — cùng bucket-primitive dùng cho /pfm/luu, khác tên nhánh.
      const suat = await consumeLimit(pool, `pfm:lo:${userId}`, PFM_LO.LO_MOI_NGAY, 1440);
      if (!suat.allowed) {
        return c.json({
          error: 'rate_limited',
          message: `Đồng bộ hơi nhiều rồi — thử lại sau nhé (trần ${PFM_LO.LO_MOI_NGAY} lô/ngày).`,
        }, 429);
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const kq = await napLo(client, userId, body.mon);
        /*
         * D324 — NỐI DÂY GAME → SỔ. Mỗi kỳ vừa có gói đặc trưng GHI thành công, nếu cửa
         * `noi_game` mở, ghép năm mã `gm_*` của CÙNG kỳ ấy (xem `tin_hieu_ky.ts`). Cùng
         * transaction với lô: tắt cửa rồi đồng bộ thì không một dòng game nào vào kỳ mới.
         * ⚠ Chỉ kỳ của gói ĐÃ GHI — gói bị bỏ (kỳ ngoài cửa sổ, mã lạ) không kéo theo gì.
         */
        const kyDaGhi = new Set<string>();
        const idGhi = new Set(kq.ket.filter((k) => k.ket === 'ghi').map((k) => k.id));
        for (const m of body.mon as { id?: unknown; loai?: unknown; ky?: unknown }[]) {
          if (m?.loai === 'goi' && typeof m.ky === 'string' && typeof m.id === 'string' && idGhi.has(m.id)) {
            kyDaGhi.add(m.ky);
          }
        }
        if (kyDaGhi.size > 0 && (await docCua(client, userId)).noi_game) {
          for (const ky of kyDaGhi) await napTinHieuGameKy(client, userId, ky);
        }
        await client.query('COMMIT');
        return c.json({ ok: true, ...kq });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    });

  // ── /pfm/luu — GHI lát tháng đã khoá (K1/K2/K10) ────────────────────────────
  app.post(DUONG_LUU, mw.requireAuth, mw.requireOnboarded, mw.chanKhach,
    chanContentLength(PFM.BLOB_MAX), async (c) => {
      const actor = c.get('actor');
      const userId = actor.userId!;

      const thang = c.req.query('thang');
      if (!laThangHopLe(thang)) {
        return c.json({ error: 'thang_khong_hop_le', message: 'thang phải dạng YYYY-MM-01.' }, 400);
      }
      const schemaV = Number(c.req.query('schema_v'));
      if (!Number.isInteger(schemaV) || schemaV < 1) {
        return c.json({ error: 'schema_v_khong_hop_le' }, 400);
      }
      const verRaw = c.req.query('ver');
      const verClient = verRaw === undefined ? 0 : Number(verRaw);
      if (!Number.isInteger(verClient) || verClient < 0) {
        return c.json({ error: 'ver_khong_hop_le' }, 400);
      }

      const chan = await chanCua(c, userId, CUA_LUU, 'sao lưu');
      if (chan) return chan;

      /*
       * R3 — SOI TRƯỚC KHI TIÊU SUẤT. Trần chỉ có 2 lần/ngày; để một client lệch `ver`
       * đốt hết suất cho hai cú chắc chắn 409 là làm mất sao lưu của cả ngày. Cửa thật
       * vẫn là `FOR UPDATE` trong `ghiLatThang` — xem chú thích ở `soiTruocKhiGhi`.
       */
      const soi = await soiTruocKhiGhi(pool, userId, thang, verClient);
      if (!soi.ok) return c.json({ error: soi.lyDo, ver: soi.ver }, 409);

      // K11 — trần lượt SAO LƯU/ngày (khác trần chung `auth_attempts`, bucket riêng).
      const suat = await consumeLimit(pool, `pfm:luu:${userId}`, PFM.SO_LAN_LUU_NGAY, 1440);
      if (!suat.allowed) {
        return c.json({
          error: 'rate_limited',
          message: `Sao lưu hơi nhiều rồi — thử lại sau nhé (trần ${PFM.SO_LAN_LUU_NGAY} lần/ngày).`,
        }, 429);
      }

      // Đọc thân SAU rate-limit, TRƯỚC khi mở transaction — không giữ connection
      // trong lúc đọc luồng ngoài.
      const buf = Buffer.from(await c.req.arrayBuffer());

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const kq = await ghiLatThang(client, userId, thang, buf, schemaV, verClient);
        if (!kq.ghi) {
          await client.query('ROLLBACK');
          const status = kq.lyDoTuChoi === 'qua_lon' ? 413 : 409;
          return c.json({ error: kq.lyDoTuChoi, ver: kq.ver }, status);
        }
        await client.query('COMMIT');
        return c.json({ ok: true, ver: kq.ver });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    });

  // ── /pfm/luu — ĐỌC lát tháng (mặc định thế hệ mới nhất) ─────────────────────
  app.get('/api/v1/pfm/luu', mw.requireAuth, mw.requireOnboarded, mw.chanKhach, async (c) => {
    const actor = c.get('actor');
    const userId = actor.userId!;
    const thang = c.req.query('thang');
    if (!laThangHopLe(thang)) {
      return c.json({ error: 'thang_khong_hop_le', message: 'thang phải dạng YYYY-MM-01.' }, 400);
    }
    const theHeRaw = c.req.query('the_he');
    const theHe = theHeRaw === undefined ? 1 : Number(theHeRaw);
    if (!Number.isInteger(theHe) || theHe < 1 || theHe > PFM.BLOB_THE_HE) {
      return c.json({ error: 'the_he_khong_hop_le' }, 400);
    }

    const lat = await docLatThang(pool, userId, thang, theHe);
    if (!lat) return c.json({ error: 'khong_thay' }, 404);
    // Hono đòi Uint8Array<ArrayBuffer> đúng nghĩa; Buffer<ArrayBufferLike> của Node
    // rộng hơn (gồm cả SharedArrayBuffer) nên không khớp overload — copy sang.
    return c.body(new Uint8Array(lat.blob), 200, {
      'Content-Type': 'application/octet-stream',
      'X-Pfm-Ver': String(lat.ver),
      'X-Pfm-Schema-V': String(lat.schemaV),
    });
  });

  // ── /pfm/xoa — XOÁ SẠCH (P9 🔒); MỘT HÀM, HAI LỐI VÀO (đường kia: /account/delete) ──
  app.post('/api/v1/pfm/xoa', mw.requireAuth, mw.requireOnboarded, mw.chanKhach, async (c) => {
    const actor = c.get('actor');
    const userId = actor.userId!;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tk = await xoaSachPfm(client, userId);
      await client.query('COMMIT');
      return c.json({ ok: true, ...tk });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });
}

/** Danh sách đường PFM — dùng cho bài test ĐỘ PHỦ (T5.6): mỗi route phải qua đủ ba cửa. */
export const DUONG_PFM = [
  { method: 'POST', path: '/api/v1/pfm/consent' },
  { method: 'POST', path: DUONG_DIEM_DANH },
  { method: 'POST', path: DUONG_TUAN },
  { method: 'POST', path: DUONG_DONG_BO },
  { method: 'POST', path: DUONG_LUU },
  { method: 'GET', path: DUONG_LUU },
  { method: 'POST', path: '/api/v1/pfm/xoa' },
] as const;
