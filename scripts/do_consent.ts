/**
 * ĐO TRẠNG THÁI ĐỒNG Ý — ai đã bấm văn bản nào, bản nào, còn hiệu lực không.
 *
 * ─── VÌ SAO CÓ TỆP NÀY ──────────────────────────────────────────────────────
 * Mỗi lần nâng phiên bản một văn bản đồng ý, câu hỏi đầu tiên luôn là **"đã có
 * ai bấm bản cũ chưa"** — vì n = 0 thì thay thẳng, n > 0 thì phải hỏi lại và
 * người chưa bấm lại sẽ rơi khỏi mọi số. Trước tệp này câu trả lời nằm trong
 * CHÚ THÍCH của `config/pfm_consent.ts` (`⏳ CHƯA AI ĐỒNG Ý`, viết 13/09) — mà
 * chú thích thì trôi (D61), và đúng chú thích ấy đã đi qua 11 bản lên prod mà
 * không ai đọc lại. Một câu SQL đọc `events` thì không trôi được.
 *
 * CHỈ ĐỌC — chỉ `SELECT`. C7: không SELECT handle, email hay tên.
 *
 * ─── CHẠY ───────────────────────────────────────────────────────────────────
 *   npm run do:consent          # DB dev
 *   npm run do:consent:prod     # Supabase prod
 * ⚠ KHÔNG gõ `npm run do:consent --env-file=…`: npm nuốt cờ, lệnh chạy trên dev.
 */
import 'dotenv/config';
import { createPool } from '../server/db.js';
import { CONSENT_PHIEN_BAN } from '../config/pfm_consent.js';
import { TELEMETRY } from '../config/telemetry.js';

/** Ngày đọc cho người ở VN, không theo múi giờ phiên DB (prod = UTC ⇒ lệch 7 tiếng). */
const NGAY_VN = (cot: string) => `(${cot} AT TIME ZONE '${TELEMETRY.MUI_GIO}')::date::text`;

function hostCuaUrl(u: string | undefined): string {
  if (!u) return '(không có DATABASE_URL)';
  try { return new URL(u).host; } catch { return '(DATABASE_URL không đọc được)'; }
}

async function main(): Promise<void> {
  console.log(`DB đang nối: ${hostCuaUrl(process.env.DATABASE_URL)}`);
  console.log('Bản HIỆN HÀNH theo code:', JSON.stringify(CONSENT_PHIEN_BAN), '\n');

  const pool = createPool();
  const q = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<R[]> =>
    (await pool.query(sql, p)).rows as R[];

  try {
    /*
     * ⚠ ĐỌC `events`, KHÔNG đọc cột boolean. Vết đồng ý là append-only (A3.3) và mang PHIÊN BẢN;
     * cột boolean của một số cửa chỉ nói "đang bật", không nói bật ở bản nào — đúng cái bẫy ghi ở
     * `pfm_noi_game` v2. Ai cũng có thể bấm rồi rút rồi bấm lại, nên "trạng thái" là vết MỚI NHẤT.
     */
    console.log('── 1. VẾT ĐỒNG Ý / RÚT theo văn bản + phiên bản (mọi vết, kể cả đã bị thay) ──');
    console.table(await q(
      `SELECT e.action_type,
              coalesce(e.value_json->>'van_ban_id', '(không ghi)') AS van_ban,
              coalesce(e.value_json->>'phien_ban', '(không ghi)')  AS phien_ban,
              count(*)::int                                        AS so_vet,
              count(DISTINCT e.user_id)::int                       AS so_nguoi,
              ${NGAY_VN('min(e.ts)')}                             AS lan_dau,
              ${NGAY_VN('max(e.ts)')}                             AS lan_cuoi
         FROM events e
        WHERE e.action_type LIKE 'hd_dong_y%' OR e.action_type LIKE 'hd_rut%'
        GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`));

    /*
     * Trạng thái HÔM NAY của cửa buổi đo: với mỗi (người, bàn), vết mới nhất là đồng ý hay rút.
     * Đây đúng phép mà `/nhom` dùng — một nguồn cho câu "ai đang đồng ý".
     */
    console.log('\n── 2. BUỔI ĐO — trạng thái hiện tại theo (người, bàn) ──────────');
    console.table(await q(
      `WITH v AS (
         SELECT DISTINCT ON (e.user_id, e.value_json->>'ban_ma')
                e.user_id, e.value_json->>'ban_ma' AS ban_ma, e.action_type,
                e.value_json->>'phien_ban' AS phien_ban
           FROM events e
          WHERE e.action_type IN ('hd_dong_y_buoi_do', 'hd_rut_buoi_do')
          ORDER BY e.user_id, e.value_json->>'ban_ma', e.event_id DESC)
       SELECT action_type AS trang_thai, coalesce(phien_ban, '(không ghi)') AS phien_ban,
              count(*)::int AS so_cap_nguoi_ban, count(DISTINCT user_id)::int AS so_nguoi
         FROM v GROUP BY 1, 2 ORDER BY 1, 2`));

    console.log('\n── 3. BÀN BUỔI ĐO đã tạo ───────────────────────────────────────');
    console.table(await q(
      `SELECT b.loai, count(*)::int AS so_ban,
              count(*) FILTER (WHERE b.het_han > now())::int AS dang_mo,
              ${NGAY_VN('min(b.created_at)')} AS tao_dau, ${NGAY_VN('max(b.created_at)')} AS tao_cuoi
         FROM holdem_ban b GROUP BY 1 ORDER BY 1`));
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
