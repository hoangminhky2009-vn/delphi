/**
 * ĐO: BÀN TẬP ĐANG TRỘN VÀO SỐ CỦA TRẬN THẬT BAO NHIÊU (D359).
 *
 * ─── VÌ SAO CÓ TỆP NÀY ──────────────────────────────────────────────────────
 * D359 vá ba mặt dashboard đang đếm bàn tập như trận thật. Nhưng cả entry D359
 * có một ô trống: **không ai biết chỗ vá ấy đổi con số bao nhiêu** — phiên agent
 * viết bản vá bị chặn đọc prod, nên câu *"bàn tập chiếm mấy phần trăm"* chưa có
 * đáp án. Vá mà không đo là vá theo niềm tin (A11.13: đo trước khi động dao).
 *
 * Tệp này CHỈ ĐỌC — chỉ `SELECT`, không `INSERT/UPDATE/DELETE`, không ghi tệp.
 * Chạy bao nhiêu lần cũng không đổi một dòng dữ liệu nào.
 *
 * ─── CHẠY ───────────────────────────────────────────────────────────────────
 *   npm run do:ban-tap         # DB dev (DATABASE_URL trong .env)
 *   npm run do:ban-tap:prod    # Supabase prod (.env.prod)
 *
 * ⚠ KHÔNG gõ `npm run do:ban-tap --env-file=.env.prod`: npm NUỐT cờ ấy và lệnh
 *   chạy trên dev trong khi tưởng là prod (bài học đã trả giá ba lần). Hai lệnh
 *   trên là hai lệnh KHÁC NHAU, chọn đúng cái mình cần.
 * ⚠ Dòng đầu tiên in ra là HOST đang nối — đọc nó trước khi tin bất kỳ con số nào
 *   phía dưới (cùng quy ước `dieu-phoi:prod`).
 *
 * ─── C7 ─────────────────────────────────────────────────────────────────────
 * Không SELECT handle, email, tên hay `user_id`. Mọi thứ in ra là số đếm.
 */
import 'dotenv/config';
import { createPool } from '../server/db.js';
import { SEED_MAN_TAP_MOI_THOI } from '../config/holdem.js';

const SEEDS = [...SEED_MAN_TAP_MOI_THOI];

function hostCuaUrl(u: string | undefined): string {
  if (!u) return '(không có DATABASE_URL)';
  try { return new URL(u).host; } catch { return '(DATABASE_URL không đọc được)'; }
}

async function main(): Promise<void> {
  console.log(`DB đang nối: ${hostCuaUrl(process.env.DATABASE_URL)}`);
  console.log(`Seed bàn tập (${SEEDS.length}): ${SEEDS.join(', ')}\n`);

  const pool = createPool();
  const q = async <R = Record<string, unknown>>(sql: string, p: unknown[] = []): Promise<R[]> =>
    (await pool.query(sql, p)).rows as R[];

  try {
    console.log('── 1. TRẬN: bàn tập vs trận thật, theo trạng thái ──────────────');
    console.table(await q(
      `SELECT (m.seed = ANY($1::bigint[])) AS la_ban_tap, m.status,
              count(*)::int AS so_tran, count(DISTINCT m.owner_user_id)::int AS so_nguoi
         FROM holdem_matches m
        GROUP BY 1, 2 ORDER BY 1, 2`, [SEEDS]));

    console.log('\n── 2. TỶ LỆ TRỘN — con số D359 cần ────────────────────────────');
    console.table(await q(
      `SELECT count(*)::int AS tong_tran,
              count(*) FILTER (WHERE m.seed = ANY($1::bigint[]))::int AS ban_tap,
              round(100.0 * count(*) FILTER (WHERE m.seed = ANY($1::bigint[]))
                    / nullif(count(*), 0), 1) AS phan_tram_ban_tap
         FROM holdem_matches m
         JOIN users u ON u.user_id = m.owner_user_id
        WHERE u.deleted_at IS NULL AND u.role <> 'admin' AND NOT u.la_tester`, [SEEDS]));

    console.log('\n── 3. NGƯỜI bị phễu đếm nhầm là "đã chơi" ─────────────────────');
    console.table(await q(
      `WITH n AS (
         SELECT m.owner_user_id AS uid,
                count(*) FILTER (WHERE NOT (m.seed = ANY($1::bigint[])))::int AS that
           FROM holdem_matches m
           JOIN users u ON u.user_id = m.owner_user_id
          WHERE u.deleted_at IS NULL AND u.role <> 'admin' AND NOT u.la_tester
          GROUP BY 1)
       SELECT count(*)::int AS nguoi_co_tran,
              count(*) FILTER (WHERE that = 0)::int AS chi_co_ban_tap,
              count(*) FILTER (WHERE that > 0)::int AS co_tran_that
         FROM n`, [SEEDS]));

    console.log('\n── 4. BẬC "XONG ≥ 3 TRẬN" — đếm cũ vs đếm sau D359 ────────────');
    console.table(await q(
      `WITH r AS (
         SELECT rr.user_id AS uid, count(*)::int AS tong,
                count(*) FILTER (WHERE NOT (m.seed = ANY($1::bigint[])))::int AS that
           FROM holdem_results rr
           JOIN holdem_matches m ON m.match_id = rr.match_id
           JOIN users u ON u.user_id = rr.user_id
          WHERE rr.user_id IS NOT NULL AND u.deleted_at IS NULL
            AND u.role <> 'admin' AND NOT u.la_tester
          GROUP BY 1)
       SELECT count(*) FILTER (WHERE tong >= 3)::int AS dem_cu,
              count(*) FILTER (WHERE that >= 3)::int AS dem_sau_d359
         FROM r`, [SEEDS]));

    console.log('\n── 5. MÀN HƯỚNG DẪN: bỏ dở ở vòng nào ─────────────────────────');
    console.table(await q(
      `SELECT m.vong_hien_tai AS vong, count(*)::int AS n
         FROM holdem_matches m
        WHERE m.seed = ANY($1::bigint[]) AND m.status = 'bo_dở'
        GROUP BY 1 ORDER BY 1`, [SEEDS]));
  } finally {
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
