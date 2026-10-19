/**
 * ĐẾM NGƯỜI THẬT — mẫu số của mùa này (A11.1), tách khỏi tài khoản nội bộ · tester · khách. CHỈ ĐỌC.
 *
 *   npm run dem:nguoi:prod      # prod (đọc .env.prod) — founder chạy; auto mode chặn agent đọc DB prod
 *   npm run dem:nguoi           # DB theo DATABASE_URL hiện tại
 *
 * ⚠ VÌ SAO CÓ TỆP NÀY (phiếu NGHIÊN CỨU → VẬN HÀNH 11/10): `docs/trang-thai/du_lieu.md` ghi "n người thật = 0"
 * (D223) trong khi ghi chú buổi đo 25/09 nói 15 tài khoản KHÔNG mang cờ tester đã tạo 27/52 trận. Hai câu cùng
 * đúng được chỉ khi "người thật" chưa có định nghĩa máy đọc. Đây là định nghĩa đó, in từng bậc lọc để ai cũng
 * thấy con số cuối rơi từ đâu — không phải một con số trần.
 *
 * Bậc lọc (theo thứ tự, mỗi bậc chỉ trừ thêm):
 *   tài khoản còn sống (deleted_at NULL) → trừ khách chưa đăng ký (la_khach) → trừ admin → trừ la_tester →
 *   trừ email nội bộ (biến DEM_NOI_BO_EMAIL, phẩy ngăn — để ở .env.prod, KHÔNG vào repo) ⇒ NGƯỜI THẬT.
 * Khách có chạm được đếm RIÊNG: có thể là người thật, nhưng một người nhiều máy = nhiều khách, không dồn được.
 *
 * "Chạm" = có dòng `events` hoặc mở trận `holdem_matches` trong khoảng đó. In SỐ, không in email/handle (C7).
 */
import 'dotenv/config';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type pg from 'pg';

export interface KetQuaDem {
  bac: { nhan: string; con_lai: number }[];
  nguoi_that: number;
  nguoi_that_co_tran_xong: number;
  nguoi_that_cham_7_ngay: number;
  nguoi_that_den_buoi_do: number;
  khach_co_cham: number;
  /** Tuần ISO (thứ Hai, giờ VN) → số người thật có chạm. 8 tuần gần nhất, tuần trống vẫn có dòng. */
  theo_tuan: { tuan: string; cham: number; moi_dang_ky: number }[];
}

const MUI_VN = 'Asia/Ho_Chi_Minh';

export async function demNguoi(pool: pg.Pool, noiBoEmail: readonly string[]): Promise<KetQuaDem> {
  const email = noiBoEmail.map((e) => e.trim().toLowerCase()).filter(Boolean);
  // Bốn bậc đầu không có `$1` — Postgres từ chối tham số thừa, nên chỉ gửi khi câu thật sự dùng.
  const n = async (sql: string, p: unknown[] = []): Promise<number> =>
    Number((await pool.query(sql, sql.includes('$1') ? p : [])).rows[0].n);

  // Mỗi bậc là một điều kiện cộng dồn trên `users u` (+ email qua auth_accounts a).
  const bacDk: [string, string][] = [
    ['tài khoản còn sống', 'u.deleted_at IS NULL'],
    ['trừ khách chưa đăng ký', 'NOT u.la_khach'],
    ['trừ admin', `u.role <> 'admin'`],
    ['trừ tester (la_tester)', 'NOT u.la_tester'],
    [`trừ email nội bộ (${email.length} địa chỉ)`, `(a.email IS NULL OR NOT (a.email = ANY($1::text[])))`],
  ];
  const tu = 'FROM users u LEFT JOIN auth_accounts a ON a.user_id = u.user_id';
  const bac: KetQuaDem['bac'] = [];
  const dk: string[] = [];
  for (const [nhan, d] of bacDk) {
    dk.push(d);
    bac.push({ nhan, con_lai: await n(`SELECT count(DISTINCT u.user_id) AS n ${tu} WHERE ${dk.join(' AND ')}`, [email]) });
  }
  const DK_THAT = dk.join(' AND ');
  const THAT = `SELECT u.user_id, u.created_at, u.ma_buoi_do ${tu} WHERE ${DK_THAT}`;
  const CHAM = `(SELECT user_id, ts AS luc FROM events WHERE user_id IS NOT NULL
                 UNION ALL SELECT owner_user_id, started_at FROM holdem_matches)`;

  const nguoiThat = bac[bac.length - 1]!.con_lai;
  const coTranXong = await n(
    `SELECT count(*) AS n FROM (${THAT}) t
      WHERE EXISTS (SELECT 1 FROM holdem_matches m WHERE m.owner_user_id = t.user_id AND m.status = 'xong')`, [email]);
  const cham7 = await n(
    `SELECT count(*) AS n FROM (${THAT}) t
      WHERE EXISTS (SELECT 1 FROM ${CHAM} c WHERE c.user_id = t.user_id AND c.luc > now() - interval '7 days')`, [email]);
  const buoiDo = await n(`SELECT count(*) AS n FROM (${THAT}) t WHERE t.ma_buoi_do IS NOT NULL`, [email]);
  const khach = await n(
    `SELECT count(*) AS n FROM users u
      WHERE u.deleted_at IS NULL AND u.la_khach
        AND EXISTS (SELECT 1 FROM ${CHAM} c WHERE c.user_id = u.user_id)`);

  const { rows } = await pool.query(
    `WITH tuan AS (
       SELECT generate_series(
                date_trunc('week', (now() AT TIME ZONE '${MUI_VN}')) - interval '7 weeks',
                date_trunc('week', (now() AT TIME ZONE '${MUI_VN}')),
                interval '1 week') AS dau
     ), that AS (${THAT})
     SELECT to_char(t.dau, 'YYYY-MM-DD') AS tuan,
            (SELECT count(DISTINCT c.user_id) FROM ${CHAM} c JOIN that ON that.user_id = c.user_id
              WHERE (c.luc AT TIME ZONE '${MUI_VN}') >= t.dau
                AND (c.luc AT TIME ZONE '${MUI_VN}') <  t.dau + interval '1 week')::int AS cham,
            (SELECT count(*) FROM that
              WHERE (that.created_at AT TIME ZONE '${MUI_VN}') >= t.dau
                AND (that.created_at AT TIME ZONE '${MUI_VN}') <  t.dau + interval '1 week')::int AS moi_dang_ky
       FROM tuan t ORDER BY t.dau`, [email]);

  return {
    bac,
    nguoi_that: nguoiThat,
    nguoi_that_co_tran_xong: coTranXong,
    nguoi_that_cham_7_ngay: cham7,
    nguoi_that_den_buoi_do: buoiDo,
    khach_co_cham: khach,
    theo_tuan: rows.map((r) => ({ tuan: r.tuan as string, cham: Number(r.cham), moi_dang_ky: Number(r.moi_dang_ky) })),
  };
}

const laMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (laMain) {
  const { chanEnvFileBiNuot, inDb } = await import('./moi_truong.js');
  const nuot = chanEnvFileBiNuot(process.env, 'dem_nguoi');
  if (nuot !== null) {
    console.error(`\x1b[31m${nuot}\x1b[0m`);
    process.exit(2);
  }
  inDb('ĐẾM NGƯỜI THẬT (chỉ đọc)');
  const { createPool } = await import('../server/db.js');
  const pool = createPool();
  try {
    const noiBo = (process.env.DEM_NOI_BO_EMAIL ?? '').split(',').filter((x) => x.trim());
    if (noiBo.length === 0) console.error('\x1b[33m⚠ DEM_NOI_BO_EMAIL trống — bậc "email nội bộ" không trừ ai.\x1b[0m');
    const kq = await demNguoi(pool, noiBo);
    console.log('=== ĐẾM NGƯỜI THẬT ===');
    for (const b of kq.bac) console.log(`  ${b.nhan.padEnd(34)} ${String(b.con_lai).padStart(6)}`);
    console.log(`  ${'⇒ NGƯỜI THẬT'.padEnd(34)} ${String(kq.nguoi_that).padStart(6)}`);
    console.log(`     có ≥ 1 trận xong                ${String(kq.nguoi_that_co_tran_xong).padStart(6)}`);
    console.log(`     chạm trong 7 ngày qua           ${String(kq.nguoi_that_cham_7_ngay).padStart(6)}`);
    console.log(`     vào từ buổi đo (ma_buoi_do)     ${String(kq.nguoi_that_den_buoi_do).padStart(6)}`);
    console.log(`  khách chưa đăng ký có chạm (riêng) ${String(kq.khach_co_cham).padStart(6)}`);
    console.log('');
    console.log('  tuần (thứ Hai, giờ VN)   chạm   đăng ký mới');
    for (const t of kq.theo_tuan) console.log(`  ${t.tuan}             ${String(t.cham).padStart(4)}   ${String(t.moi_dang_ky).padStart(4)}`);
    console.log('');
    // Dòng `so-do` đọc (scripts/so_do.ts → docs/trang-thai/nguoi-dung.md) — dán nguyên dòng.
    console.log(`người lạ chạm tuần này: ${kq.theo_tuan[kq.theo_tuan.length - 1]?.cham ?? 0}`);
  } finally {
    await pool.end();
  }
}
