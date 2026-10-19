/**
 * ĐO GIÁ CỦA `POST /pfm/dong-bo` — `npm run do:pfm-dong-bo` (D251).
 *
 * ⚠⚠ VÌ SAO CẦN ĐÚNG BÀI NÀY: `docs/gioi-han-ha-tang.md` §3① nói thứ gãy TRƯỚC TIÊN
 * không phải CPU mà là **kết nối DB** — pool 5, và mọi thứ giữ một kết nối qua `await`
 * đều ăn vào cùng cái trần ấy. `/pfm/dong-bo` là đường PFM **giữ kết nối lâu nhất** repo có:
 * cả lô nằm trong MỘT transaction.
 *
 * Không đoán con số đó. Đếm nó.
 *
 * ⚠ ĐO LẦN ĐẦU (D251) RA 301 VÒNG cho một lô đầy — mỗi món là `SAVEPOINT` + `INSERT`
 * chống trùng + cú ghi + `RELEASE`. D256 cắt còn **52** (nhịp) và **6** (một gói 300
 * dòng): giành chỗ gộp một câu, bỏ savepoint cho nhịp, và gộp cả gói vào một `unnest`.
 * ⇒ Giữ bài đo này chạy được là cách duy nhất biết con số ấy có bò lên lại không.
 *
 * ⚠ Đây là đo trên **Postgres nhúng cùng máy** (RTT ~0). Prod là Supabase Singapore
 * qua mạng, nên con số THẬT = số vòng SQL × RTT thật + phần dưới đây. Bài này vì thế
 * báo cả **SỐ VÒNG SQL**, là đại lượng KHÔNG phụ thuộc máy đo — nó mới là thứ nhân với
 * RTT để suy ra prod. Thời gian ở đây chỉ là sàn.
 */
import { startTestDb } from '../tests/helpers/testdb.js';
import { createTestUser } from '../tests/helpers/fixtures.js';
import { napLo } from '../server/pfm/dong_bo.js';
import { PFM_LO } from '../config/pfm.js';
import { CUA_PFM_COT } from '../config/pfm_consent.js';
import type pg from 'pg';

/** Bọc một client để đếm số vòng SQL — đại lượng duy nhất không phụ thuộc máy đo. */
function demVong(client: pg.PoolClient): { client: pg.PoolClient; so: () => number } {
  let n = 0;
  const goc = client.query.bind(client);
  (client as unknown as { query: unknown }).query = (...a: unknown[]) => {
    n++;
    return (goc as (...x: unknown[]) => unknown)(...a);
  };
  return { client, so: () => n };
}

const nhip = (i: number) =>
  ({ id: `n${i}`, loai: 'nhip', ma: 'pfm_hu', v: { hu_id: `hu_${i}`, ma: 'tao' } });

const goi = (i: number, ky: string, soDong: number) => ({
  id: `g${i}`, loai: 'goi', ky, schema_v: 1,
  dong: Array.from({ length: soDong }, (_, k) =>
    ({ ma: 'y_loai', doi_tuong: `hu_${i}_${k}`, gia_tri: 'giao_duc' })),
});

/**
 * ⚠ HÌNH DẠNG LÔ THẬT, không phải hình cực đoan tuỳ tiện. `khoaMon` gộp gói theo KỲ
 * (`goi:<ky>`), nên hàng đợi giữ **đúng một gói mỗi kỳ** và bị chặn ở khoảng một tá kỳ.
 * ⇒ Chi phí thật do **SỐ DÒNG** quyết định, không phải số món. Bản đo đầu (50 gói × 1
 * dòng) đo một thứ không bao giờ xảy ra, và vì thế suýt dẫn tôi tối ưu nhầm chỗ.
 */
interface CaDo { ten: string; mon: unknown[]; don: number }

const db = await startTestDb();
try {
  const u = await createTestUser(db.pool);
  // D295: POST /dong-bo canh cột `dac_trung`, không còn canh cờ gộp — thiếu dòng này thì mọi lượt đo ăn 403.
  await db.pool.query(
    `UPDATE users SET pfm_consent = TRUE, ${CUA_PFM_COT.dac_trung} = TRUE WHERE user_id = $1`, [u.userId]);
  const kySong = (await db.pool.query(
    `SELECT to_char(now() AT TIME ZONE mui_gio, 'YYYY-MM') AS k FROM users WHERE user_id = $1`,
    [u.userId])).rows[0].k as string;

  const kyTruoc = (await db.pool.query(
    `SELECT to_char((now() AT TIME ZONE mui_gio) - interval '1 month', 'YYYY-MM') AS k
       FROM users WHERE user_id = $1`, [u.userId])).rows[0].k as string;

  let n = 0;
  const ca: CaDo[] = [
    { ten: '1 nhịp', mon: [nhip(n++)], don: 1 },
    { ten: `${PFM_LO.SU_KIEN_MOI_LO} nhịp (trần món)`,
      mon: Array.from({ length: PFM_LO.SU_KIEN_MOI_LO }, () => nhip(n++)),
      don: PFM_LO.SU_KIEN_MOI_LO },
    { ten: '1 gói × 25 dòng', mon: [goi(n++, kySong, 25)], don: 25 },
    { ten: '2 gói × 25 dòng (2 kỳ)',
      mon: [goi(n++, kySong, 25), goi(n++, kyTruoc, 25)], don: 50 },
    { ten: `1 gói × ${PFM_LO.DONG_MOI_GOI} dòng (trần gói)`,
      mon: [goi(n++, kySong, PFM_LO.DONG_MOI_GOI)], don: PFM_LO.DONG_MOI_GOI },
    { ten: 'lô hỗn hợp: 2 gói × 25 + 20 nhịp',
      mon: [goi(n++, kySong, 25), goi(n++, kyTruoc, 25),
        ...Array.from({ length: 20 }, () => nhip(n++))],
      don: 70 },
  ];

  console.log('ĐO /pfm/dong-bo — Postgres nhúng, RTT ~0. SỐ VÒNG SQL mới là thứ nhân với RTT thật.\n');
  console.log('  trường hợp                          | món | dòng | vòng SQL |   ms');
  console.log('  ------------------------------------+-----+------+----------+-----');

  const bang: { ten: string; vong: number; ms: number }[] = [];
  for (const c of ca) {
    const conn = await db.pool.connect();
    const d = demVong(conn);
    const t0 = Date.now();
    await conn.query('BEGIN');
    await napLo(d.client, u.userId, c.mon);
    await conn.query('COMMIT');
    const ms = Date.now() - t0;
    conn.release();
    // Trừ 2 vòng BEGIN/COMMIT để con số nói đúng về phần napLo.
    const vong = d.so() - 2;
    bang.push({ ten: c.ten, vong, ms });
    console.log(`  ${c.ten.padEnd(35)} | ${String(c.mon.length).padStart(3)} |`
      + ` ${String(c.don).padStart(4)} | ${String(vong).padStart(8)} | ${String(ms).padStart(4)}`);
  }

  const nang = bang.reduce((a, b) => (b.vong > a.vong ? b : a));
  console.log(`\n⇒ NẶNG NHẤT: "${nang.ten}" — ${nang.vong} vòng SQL,`
    + ` giữ kết nối ${nang.ms}ms trên máy này.`);
  for (const rtt of [1, 5, 15, 30]) {
    const suy = nang.vong * rtt;
    const co = suy > 10_400 ? '✗ VỠ trần Vercel 10,4s' : suy > 3000 ? '⚠ giữ kết nối > 3s' : '✓';
    console.log(`   RTT ${String(rtt).padStart(2)}ms  ⇒ ~${String(suy).padStart(6)}ms chỉ riêng đi-về   ${co}`);
  }
  console.log('\n⚠ Pool prod = 5 kết nối. Số lô ĐỒNG THỜI tối đa trước khi mọi route khác'
    + ' phải xếp hàng chính là 5 — không liên quan CPU (gioi-han-ha-tang §3①).');
} finally {
  await db.stop();
}
