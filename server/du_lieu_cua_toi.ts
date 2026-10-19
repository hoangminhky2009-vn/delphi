/**
 * DỮ LIỆU CỦA TÔI + BÁO LỖI (SPEC chan-truoc-beta mục 4–5, migration 0079).
 *
 * ⚠⚠ VÌ SAO TỒN TẠI: điều khoản hứa *"**Xem** tụi mình đang giữ gì về bạn"* (`web/src/content/dieuKhoan.ts`, mục `quyen`) mà trước
 * bản này không endpoint nào trả dữ liệu ấy — một câu hứa không có mã đứng sau. Founder 11/10: "xem dữ liệu" = MÀN XEM + TẢI TỆP JSON.
 *
 *   GET  /api/v1/account/du-lieu          — bản tóm (lớp trượt Hồ sơ): hồ sơ khoảng · từng ô đồng ý + số bản + vết bật/tắt · số trận ·
 *                                            số dòng ghi theo loại · số dòng telemetry · số báo lỗi · số dòng PFM máy chủ giữ.
 *   GET  /api/v1/account/du-lieu/xuat     — TỪNG TRANG dòng thô cho tệp tải về (`bang` = events|telemetry|bao_loi|tran, `sau` = khoá
 *                                            dòng cuối trang trước). Phân trang vì một người chơi đều có thể có vài MB `events` (snapshot
 *                                            ~1,7 KB/vòng) — một response trọn vẹn vượt trần thân response của serverless.
 *   POST /api/v1/bao-loi                  — người chơi báo lỗi: bảng riêng, ≤ 1.000 ký tự, trần 5 báo/ngày/người, chuông Sentry KHÔNG chở
 *                                            chữ người chơi gõ (C7) — chỉ mã báo + màn + bản + mã lỗi.
 *   GET  /api/v1/admin/bao-loi            — admin đọc (trang /quan-tri → VẬN HÀNH → BÁO LỖI).
 *
 * ⚠ CHỈ DỮ LIỆU CỦA CHÍNH NGƯỜI GỌI: mọi câu khoá theo `actor.userId` lấy từ phiên, không bao giờ từ query string. Bài hai tài khoản ở
 * `tests/du_lieu_cua_toi.test.ts` canh: A đọc mọi trang mà không thấy một byte nào của B.
 * ⚠ Server trả ID + SỐ, chữ ở client (A11.9 / D26): tên loại `action_type` là mã; nhãn tiếng Việt nằm ở web.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { BAO_LOI } from '../config/bao_loi.js';
import { consumeLimit } from './auth/rate_limit.js';
import type { KenhBaoLoi } from './bao_loi.js';
import { canHoiLaiNghienCuu, nghienCuuHieuLuc, type HangDongY } from './nghien_cuu.js';
import { COT_CUA_SELECT, cuaTuHang } from './pfm/api.js';
import { BANG as BANG_PFM } from './pfm/xoa.js';

import type { Env, Mw as Middleware } from './http/types.js';

/** Vết đồng ý của MỌI văn bản có số bản (nghiên cứu · bốn cửa PFM · buổi đo) — đọc thẳng từ `events`. */
const LOAI_VET_DONG_Y = [
  'nghien_cuu_dong_y', 'nghien_cuu_rut', 'pfm_consent', 'pfm_tat', 'hd_dong_y_buoi_do', 'hd_rut_buoi_do',
] as const;

/** Một trang của tệp xuất. */
export const XUAT_MOI_TRANG = 500;
/** Trần số trang xuất mỗi giờ mỗi người — đủ cho vài chục nghìn dòng, chặn vòng lặp tải vô hạn. */
const XUAT_TRAN_MOI_GIO = 200;

const BANG_XUAT = {
  events: {
    sql: `SELECT event_id AS khoa, ts, context_type, context_id, action_type, value_num, value_json, state_snapshot_json
            FROM events WHERE user_id = $1 AND event_id > $2 ORDER BY event_id LIMIT $3`,
  },
  telemetry: {
    sql: `SELECT id AS khoa, ts, loai, man, ms, chi_tiet
            FROM telemetry WHERE user_id = $1 AND id > $2 ORDER BY id LIMIT $3`,
  },
  bao_loi: {
    sql: `SELECT bao_loi_id AS khoa, ts, noi_dung, man, ban, ma_loi, email
            FROM bao_loi WHERE user_id = $1 AND bao_loi_id > $2 ORDER BY bao_loi_id LIMIT $3`,
  },
  /*
   * Trận: cột mô tả, KHÔNG `action_log`/`seed`/`ghe_json` — nước đi của bạn đã nằm trọn trong `events` (hd_cam_ket…); `seed` là thông
   * tin ẩn (đọc được là dựng lại map, 0042). Khoá phân trang = thứ tự (started_at, match_id) gói thành một số tăng dần.
   */
  tran: {
    sql: `SELECT khoa, match_id, status, che_do, balance_version, season_id, started_at, ended_at, vong_hien_tai FROM (
            SELECT row_number() OVER (ORDER BY started_at, match_id) AS khoa, *
              FROM holdem_matches WHERE owner_user_id = $1) x
           WHERE khoa > $2 ORDER BY khoa LIMIT $3`,
  },
} as const;
type BangXuat = keyof typeof BANG_XUAT;

export function registerDuLieuCuaToiRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware; requireAdmin: Middleware; baoLoi: KenhBaoLoi },
): void {
  const cua = [mw.requireAuth, mw.requireOnboarded] as const;

  app.get('/api/v1/account/du-lieu', ...cua, async (c) => {
    const actor = c.get('actor');
    const uid = actor.userId!;
    const [u, vet, tran, ev, tele, bl, pfm] = await Promise.all([
      pool.query(
        `SELECT handle, age_band, region, occupation_band, created_at, season_id, la_khach,
                research_consent, research_consent_phien_ban, ${COT_CUA_SELECT}
           FROM users WHERE user_id = $1`, [uid]),
      pool.query(
        `SELECT action_type AS loai, ts AS luc,
                COALESCE(value_json->>'van_ban_id',
                         CASE WHEN action_type IN ('hd_dong_y_buoi_do', 'hd_rut_buoi_do') THEN 'buoi_do'
                              WHEN action_type = 'pfm_tat' THEN 'pfm_' || (value_json->>'cua') END) AS van_ban_id,
                value_json->>'phien_ban' AS phien_ban
           FROM events WHERE user_id = $1 AND action_type = ANY($2::text[])
          ORDER BY event_id DESC LIMIT 200`, [uid, LOAI_VET_DONG_Y]),
      pool.query(`SELECT count(*)::int AS n FROM holdem_matches WHERE owner_user_id = $1`, [uid]),
      pool.query(
        `SELECT action_type AS loai, count(*)::int AS n FROM events WHERE user_id = $1
          GROUP BY action_type ORDER BY n DESC, action_type`, [uid]),
      pool.query(`SELECT count(*)::int AS n FROM telemetry WHERE user_id = $1`, [uid]),
      pool.query(`SELECT count(*)::int AS n FROM bao_loi WHERE user_id = $1`, [uid]),
      pool.query(
        BANG_PFM.map((b) => `SELECT '${b}' AS bang, count(*)::int AS n FROM ${b} WHERE user_id = $1`).join(' UNION ALL '), [uid]),
    ]);
    const h = u.rows[0] as (HangDongY & Record<string, unknown>) | undefined;
    if (!h) return c.json({ error: 'not_found', message: 'Không thấy hồ sơ.' }, 404);
    return c.json({
      ho_so: {
        handle: h.handle, age_band: h.age_band, region: h.region, occupation_band: h.occupation_band,
        created_at: h.created_at, season_id: h.season_id, la_khach: h.la_khach === true,
      },
      email: actor.email ?? null,
      dong_y: {
        nghien_cuu: {
          bat: nghienCuuHieuLuc(h), phien_ban: h.research_consent_phien_ban ?? null, hoi_lai: canHoiLaiNghienCuu(h),
        },
        pfm: cuaTuHang(h),
      },
      vet_dong_y: vet.rows,
      so_tran: tran.rows[0].n,
      events: ev.rows,
      telemetry: tele.rows[0].n,
      bao_loi: bl.rows[0].n,
      pfm_may_chu: pfm.rows,
    });
  });

  app.get('/api/v1/account/du-lieu/xuat', ...cua, async (c) => {
    const actor = c.get('actor');
    const bang = c.req.query('bang') as BangXuat | undefined;
    if (!bang || !Object.prototype.hasOwnProperty.call(BANG_XUAT, bang)) {
      return c.json({ error: 'invalid_input', field: 'bang', message: `bang phải một trong: ${Object.keys(BANG_XUAT).join(', ')}.` }, 400);
    }
    const sau = Number(c.req.query('sau') ?? 0);
    if (!Number.isSafeInteger(sau) || sau < 0) {
      return c.json({ error: 'invalid_input', field: 'sau', message: 'sau phải là số nguyên ≥ 0.' }, 400);
    }
    const gioi = await consumeLimit(pool, `xuat_du_lieu:${actor.userId}`, XUAT_TRAN_MOI_GIO, 60);
    if (!gioi.allowed) return c.json({ error: 'rate_limited', message: 'Tải hơi nhiều lần rồi — thử lại sau một giờ nhé.' }, 429);
    const { rows } = await pool.query(BANG_XUAT[bang].sql, [actor.userId, sau, XUAT_MOI_TRANG]);
    const tiep = rows.length === XUAT_MOI_TRANG ? Number(rows[rows.length - 1].khoa) : null;
    return c.json({ bang, dong: rows.map(({ khoa: _k, ...r }) => r), tiep });
  });

  app.post('/api/v1/bao-loi', ...cua, async (c) => {
    const actor = c.get('actor');
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const noiDung = typeof body?.noi_dung === 'string' ? body.noi_dung.trim() : '';
    if (noiDung.length === 0 || noiDung.length > BAO_LOI.DO_DAI_TOI_DA) {
      return c.json({
        error: 'invalid_input', field: 'noi_dung', message: `Gõ từ 1 tới ${BAO_LOI.DO_DAI_TOI_DA} ký tự nhé.`,
      }, 400);
    }
    /** Trường ngữ cảnh: chuỗi ngắn, ký tự an toàn — sai khuôn thì bỏ (null), không từ chối cả báo cáo. */
    const ngan = (v: unknown, tran: number, khuon: RegExp): string | null =>
      typeof v === 'string' && v.length > 0 && v.length <= tran && khuon.test(v) ? v : null;
    const man = ngan(body?.man, 80, /^[a-zA-Z0-9_\-/:.]+$/);
    const ban = ngan(body?.ban, 32, /^[a-zA-Z0-9_.\-+]+$/);
    const maLoi = ngan(body?.ma_loi, 64, /^[a-zA-Z0-9_.:\-]+$/);
    // Email tuỳ chọn (SPEC bao-loi-nguoi-choi): sai hình ⇒ bỏ trường, KHÔNG từ chối cả báo cáo (người ta vẫn muốn báo lỗi).
    const emailTho = typeof body?.email === 'string' ? body.email.trim() : '';
    const email = emailTho.length <= BAO_LOI.EMAIL_TOI_DA && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTho) ? emailTho : null;

    const client = await pool.connect();
    let id: number;
    try {
      await client.query('BEGIN');
      // Khoá theo người: hai cú gửi song song không cùng lọt qua phép đếm (trần là trần thật).
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`bao_loi:${actor.userId}`]);
      const dem = await client.query(
        `SELECT count(*)::int AS n FROM bao_loi WHERE user_id = $1 AND ts > now() - interval '24 hours'`, [actor.userId]);
      if (dem.rows[0].n >= BAO_LOI.TRAN_MOI_NGAY) {
        await client.query('ROLLBACK');
        return c.json({
          // Chữ người chơi thấy là T10 "hết lượt" ở client (`CHU_BAO_LOI.hetLuot`); câu này chỉ cho người đọc log.
          error: 'rate_limited', message: `Hôm nay bạn gửi đủ ${BAO_LOI.TRAN_MOI_NGAY} lượt rồi.`,
        }, 429);
      }
      const ins = await client.query(
        `INSERT INTO bao_loi (user_id, noi_dung, man, ban, ma_loi, email) VALUES ($1, $2, $3, $4, $5, $6) RETURNING bao_loi_id`,
        [actor.userId, noiDung, man, ban, maLoi, email]);
      id = Number(ins.rows[0].bao_loi_id);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    /*
     * CHUÔNG SENTRY (SPEC bao-loi-nguoi-choi, founder 11/10) — ⚠ CHỈ `ban` · `man` · `ma_loi`: không chữ người chơi gõ, không mã tài
     * khoản, không email (C7; điều khoản T5). Chữ + mã tài khoản + email đọc ở trang admin. Vân tay riêng mỗi báo ⇒ mỗi báo một issue
     * mới ⇒ Sentry gửi thư "có báo lỗi mới" mỗi lần (trần 3/ngày/người nên cũng là trần tiếng chuông).
     */
    const nhan: Record<string, string> = {};
    for (const [k, v] of [['ban', ban], ['man', man], ['ma_loi', maLoi]] as const) if (v) nhan[k] = v;
    mw.baoLoi.baoMa('bao_loi_moi', nhan, `bao_loi:${id}`);
    await mw.baoLoi.xa();
    return c.json({ ok: true, bao_loi_id: id }, 201);
  });

  app.get('/api/v1/admin/bao-loi', mw.requireAuth, mw.requireOnboarded, mw.requireAdmin, async (c) => {
    const { rows } = await pool.query(
      // `bao_loi_id` là BIGSERIAL ⇒ pg trả BigInt ⇒ c.json ném "Do not know how to serialize a BigInt" (trang admin 500) — ép ::int.
      `SELECT b.bao_loi_id::int AS bao_loi_id, b.ts, b.noi_dung, b.man, b.ban, b.ma_loi, b.email, b.user_id AS tai_khoan, u.handle
         FROM bao_loi b JOIN users u ON u.user_id = b.user_id
        ORDER BY b.bao_loi_id DESC LIMIT 200`);
    return c.json({ bao_loi: rows });
  });
}
