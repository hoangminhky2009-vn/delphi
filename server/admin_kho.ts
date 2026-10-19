/**
 * KHO DỮ LIỆU — mọi bảng, mọi cột, đọc thẳng (D209).
 *
 * Founder 31/08: "t muốn pannel admin phải hiện tất cả những thứ có trong
 * database nhằm phục vụ mục đích phân tích và định hướng sản phẩm."
 *
 * `admin_thongke.ts` trả lời những câu ĐÃ ĐƯỢC HỎI TRƯỚC — mỗi route là một câu
 * hỏi ai đó nghĩ ra rồi mới đi viết SQL. Tệp này trả lời những câu CHƯA AI NGHĨ
 * RA: bày trọn kho ra, để người xem tự tìm thấy thứ mình chưa biết là mình cần.
 * Đó là hai việc khác nhau, nên hai tệp — không nhồi vào tệp kia.
 *
 * ─── BA ĐIỀU KHÔNG THƯƠNG LƯỢNG ─────────────────────────────────────────────
 *
 * 1. **CHỈ ĐỌC.** Không một route nào ở đây sinh ra INSERT/UPDATE/DELETE. Cửa
 *    ghi đã có chỗ của nó (`/admin`, có xác thực lại). Một trình duyệt bảng mà
 *    ghi được là một trình duyệt bảng sẽ có người ghi nhầm.
 *
 * 2. **TÊN BẢNG / TÊN CỘT KHÔNG BAO GIỜ ĐI THẲNG TỪ URL VÀO SQL.** Mọi tên đều
 *    phải KHỚP với danh sách đọc từ `information_schema` của chính lượt gọi đó,
 *    rồi mới được ghép. Tham số giá trị đi bằng $n như mọi nơi khác. Đây là chỗ
 *    duy nhất trong repo ghép định danh vào SQL, nên nó có hàng rào riêng và có
 *    bài test riêng.
 *
 * 3. ⚠⚠ **BA CỘT AUTH KHÔNG BAO GIỜ RỜI MÁY CHỦ.** `totp_secret` ·
 *    `password_hash` · `token_hash`. Đây KHÔNG phải "dữ liệu sản phẩm bị giấu
 *    cho an toàn" — đọc được `totp_secret` của người khác là **đăng nhập được
 *    dưới danh nghĩa họ và qua luôn lớp hai**, tức cả bộ khoá D208 vừa dựng trở
 *    thành trang trí. Không có cách phân tích sản phẩm nào cần tới chúng.
 *    `email` thì CHE chứ không giấu (C7 + đầu `admin_thongke.ts`: handle đã lộ
 *    trong trận từ D25, email thì chưa từng) — che kiểu còn nhận ra được người,
 *    không đọc ra được danh sách.
 *
 * ⚠ DANH SÁCH KHOÁ THEO **TÊN CỘT**, KHÔNG THEO bảng.cột — có chủ đích. Bảng
 * mới mai này mọc thêm một cột `email` là nó được che NGAY, không cần ai nhớ
 * quay lại sửa tệp này. Sai kiểu an toàn.
 */
import type { Hono } from 'hono';
import type pg from 'pg';

import type { Env, Mw as Middleware } from './http/types.js';

/* ══════════════════════════════════════════════════════════════════════════
 * DANH SÁCH KHOÁ
 * ══════════════════════════════════════════════════════════════════════════ */

/** Không rời máy chủ, trong mọi hoàn cảnh. Xem điều 3 ở đầu tệp. */
export const COT_AN_HAN: readonly string[] = Object.freeze([
  'totp_secret', 'password_hash', 'token_hash',
]);

/** Rời máy chủ ở dạng đã che: ho***@example.com */
export const COT_CHE: readonly string[] = Object.freeze(['email']);

/**
 * Cột chở khối nhị phân lớn. Không giấu vì bí mật — giấu vì **vô dụng và tốn
 * băng thông**: `pfm_luu.blob` là bản mã hoá đầu-cuối (K2/D141), máy chủ không
 * có chìa nên kể cả đổ ra cũng chỉ là nhiễu, mà mỗi lát tới 32 KB. Thay bằng cỡ
 * tính theo byte — đó mới là thứ đọc được, và là câu duy nhất máy chủ có quyền
 * trả lời về cuốn sổ đó ("dày bao nhiêu", không phải "viết gì").
 */
export const COT_RUT_GON: readonly string[] = Object.freeze(['blob']);

export type MucAn = 'an_han' | 'che' | 'rut_gon';

export function anCua(ten: string): MucAn | null {
  const t = ten.toLowerCase();
  if (COT_AN_HAN.includes(t)) return 'an_han';
  if (COT_CHE.includes(t)) return 'che';
  if (COT_RUT_GON.includes(t)) return 'rut_gon';
  return null;
}

/** hotenmau@example.com → ho***@example.com. Không tái dựng lại được. */
export function cheEmail(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  const i = s.lastIndexOf('@');
  if (i < 1) return '***';
  return `${s.slice(0, Math.min(2, i))}***${s.slice(i)}`;
}

/* ══════════════════════════════════════════════════════════════════════════
 * HÀNG RÀO ĐỊNH DANH
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠ HÌNH DẠNG HỢP LỆ CHỈ LÀ **LỚP THỨ HAI**. Lớp thứ nhất — và là lớp thật sự
 * chặn — là phép đối chiếu với danh sách đọc từ `information_schema`. Giữ cả hai
 * vì lớp này rẻ, chặn sớm, và làm cho lỗi đọc ra được ("tên bảng lạ") thay vì
 * một lỗi cú pháp SQL khó hiểu.
 */
const TEN_HOP_LE = /^[a-z_][a-z0-9_]*$/;

/** Bọc định danh cho SQL. Chỉ gọi SAU khi tên đã qua cả hai lớp trên. */
const boc = (ten: string): string => `"${ten.replace(/"/g, '""')}"`;

/* ══════════════════════════════════════════════════════════════════════════
 * TRẢI GIÁ TRỊ
 * ══════════════════════════════════════════════════════════════════════════ */

const CAT_MAC_DINH = 500;

/**
 * Đưa một ô về thứ JSON chở được, KHÔNG mất nghĩa.
 *
 * ⚠ Buffer phải xử lý TRƯỚC object: JSON.stringify(buffer) cho ra
 * {"type":"Buffer","data":[137,80,...]} — một mảng số thập phân nở gấp ~3,5 lần
 * (đúng bẫy đã đo ở D146) và không ai đọc được.
 */
export function traiO(v: unknown, cat: number): unknown {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) return `‹${v.length} byte›`;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (cat > 0 && s.length > cat) return `${s.slice(0, cat)}… (+${s.length - cat})`;
  return s;
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROUTES
 * ══════════════════════════════════════════════════════════════════════════ */

export function registerAdminKhoRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware; requireAdmin: Middleware },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded, mw.requireAdmin] as const;

  /* ── 1. DANH SÁCH BẢNG ─────────────────────────────────────────────────── */
  app.get('/api/v1/admin/kho/bang', ...guard, async (c) => {
    /*
     * `reltuples` là ƯỚC LƯỢNG do ANALYZE cập nhật, và PG >= 14 trả **-1** cho
     * bảng chưa từng ANALYZE — tức một bảng đầy dữ liệu hiện "0 dòng". Với một
     * mặt tự nhận là "hiện tất cả những thứ có trong database" thì đó là lời nói
     * dối đắt nhất có thể có, nên mặc định đếm THẬT.
     *
     * ⚠ ĐIỀU KIỆN CHẾT của lựa chọn này: count(*) quét toàn bảng. Ở cỡ hôm nay
     * (~3 nghìn dòng cả kho) nó dưới 50ms; tới ngày `events` vượt ~1 triệu dòng
     * thì ?dem=0 (ước lượng) phải thành mặc định, nếu không route này ăn trọn
     * trần 10 giây của Vercel. Số dòng hiện tại in ở ngay đầu mặt để không ai
     * phải đoán mình đang ở đâu trên đường đó.
     */
    const demThat = c.req.query('dem') !== '0';

    const { rows: bang } = await pool.query<{
      ten: string; dong_uoc: string; byte: string; cot: number;
    }>(
      `SELECT c.relname AS ten,
              GREATEST(c.reltuples, 0)::bigint AS dong_uoc,
              pg_total_relation_size(c.oid)::bigint AS byte,
              (SELECT count(*) FROM information_schema.columns ic
                WHERE ic.table_schema = 'public' AND ic.table_name = c.relname)::int AS cot
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
        ORDER BY c.relname`);

    let dem: Record<string, number> | null = null;
    if (demThat && bang.length > 0 && bang.length <= 200) {
      /*
       * MỘT truy vấn cho cả kho, không phải một truy vấn mỗi bảng: pool `max: 1`
       * nên mỗi lượt đi-về là một lượt xếp hàng sau mọi request khác của app.
       * Tên ghép từ `pg_class` (đã lọc lại bằng TEN_HOP_LE), không từ URL.
       */
      const sql = bang
        .filter((b) => TEN_HOP_LE.test(b.ten))
        .map((b) => `SELECT '${b.ten}' AS t, count(*)::bigint AS n FROM ${boc(b.ten)}`)
        .join(' UNION ALL ');
      const { rows } = await pool.query<{ t: string; n: string }>(sql);
      dem = Object.fromEntries(rows.map((r) => [r.t, Number(r.n)]));
    }

    return c.json({
      bang: bang.map((b) => ({
        ten: b.ten,
        cot: b.cot,
        byte: Number(b.byte),
        dong: dem ? (dem[b.ten] ?? null) : null,
        dong_uoc: Number(b.dong_uoc),
      })),
      tong_dong: dem ? Object.values(dem).reduce((a, x) => a + x, 0) : null,
      tong_byte: bang.reduce((a, b) => a + Number(b.byte), 0),
      /*
       * Bản kê những gì KHÔNG hiện, kèm lý do, đi CÙNG dữ liệu chứ không nằm
       * trong một trang tài liệu nào đó. Giấu mà không nói là chỗ đẻ ra câu hỏi
       * "mặt này có hiện đủ không" — và một khi đã hỏi thì người xem thôi tin.
       */
      khoa: { an_han: COT_AN_HAN, che: COT_CHE, rut_gon: COT_RUT_GON },
    });
  });

  /* ── 2. ĐỌC MỘT BẢNG ───────────────────────────────────────────────────── */
  app.get('/api/v1/admin/kho/bang/:ten', ...guard, async (c) => {
    const ten = c.req.param('ten');
    if (!TEN_HOP_LE.test(ten)) {
      return c.json({ error: 'ten_bang_la', message: 'Tên bảng không hợp lệ.' }, 400);
    }

    // LỚP CHẶN THẬT: bảng phải có mặt trong schema của chính lượt gọi này.
    const { rows: cot } = await pool.query<{ ten: string; kieu: string }>(
      `SELECT column_name AS ten, data_type AS kieu
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position`, [ten]);
    if (cot.length === 0) {
      return c.json({ error: 'khong_co_bang', message: `Không có bảng "${ten}".` }, 404);
    }

    /*
     * cat=0 mở khối chữ ra nguyên vẹn (JSON dài, snapshot sự kiện) — nhưng kèm
     * trần dòng RẤT thấp, vì một `state_snapshot_json` nhân 50 dòng là vài MB đi
     * qua đúng cái function 10 giây.
     */
    const catHet = c.req.query('cat') === '0';
    const moi = Math.min(catHet ? 5 : 200, Math.max(1, Number(c.req.query('moi')) || 50));
    const trang = Math.min(2000, Math.max(0, Number(c.req.query('trang')) || 0));

    const hien = cot.filter((x) => anCua(x.ten) !== 'an_han');
    if (hien.length === 0) {
      /*
       * Không có bảng nào như thế HÔM NAY. Nhưng danh sách khoá bắt theo TÊN
       * CỘT, nên một bảng tương lai gồm toàn cột trùng tên khoá (ví dụ một bảng
       * `token_hash` + `password_hash` thuần) sẽ làm `hien[0]!` nổ 500 — dấu `!`
       * ở đó là một lời hứa không ai bảo đảm. Trả lời thẳng rẻ hơn một cú 500
       * mà người xem đọc thành "mặt kho hỏng".
       */
      return c.json({
        ten,
        cot: cot.map((x) => ({ ten: x.ten, kieu: x.kieu, an: anCua(x.ten) })),
        dong: [], trang: 0, moi: 0, con_nua: false,
        sap: null, chieu: 'desc', cat_o: 0,
      });
    }
    const chon = hien.map((x) => (anCua(x.ten) === 'rut_gon'
      ? `octet_length(${boc(x.ten)}) AS ${boc(x.ten)}`
      : boc(x.ten))).join(', ');

    /*
     * Sắp xếp: cột phải nằm trong danh sách CỘT ĐANG HIỆN của chính bảng này.
     * Không phải để gọn — sắp theo một cột đã ẩn rồi đọc thứ tự là moi ra được
     * bí mật từng chút một, và đó là một cửa thật.
     */
    const sapXin = c.req.query('sap') ?? '';
    const sap = hien.find((x) => x.ten === sapXin)?.ten
      ?? hien.find((x) => /^(created_at|ts|updated_at)$/.test(x.ten))?.ten
      ?? hien[0]!.ten;
    const chieu = c.req.query('chieu') === 'asc' ? 'ASC' : 'DESC';

    const { rows } = await pool.query(
      `SELECT ${chon} FROM ${boc(ten)}
        ORDER BY ${boc(sap)} ${chieu} NULLS LAST
        LIMIT $1 OFFSET $2`, [moi + 1, trang * moi]);

    const conNua = rows.length > moi;
    const cat = catHet ? 0 : CAT_MAC_DINH;
    const dong = rows.slice(0, moi).map((r: Record<string, unknown>) => {
      const o: Record<string, unknown> = {};
      for (const x of hien) {
        o[x.ten] = anCua(x.ten) === 'che' ? cheEmail(r[x.ten]) : traiO(r[x.ten], cat);
      }
      return o;
    });

    return c.json({
      ten,
      cot: cot.map((x) => ({ ten: x.ten, kieu: x.kieu, an: anCua(x.ten) })),
      dong,
      trang,
      moi,
      con_nua: conNua,
      sap,
      chieu: chieu.toLowerCase(),
      cat_o: cat,
    });
  });
}
