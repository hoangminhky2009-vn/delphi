/**
 * KIỂM (CHỈ ĐỌC) — bốn cột `pfm_cua_*` của migration 0061 đã có trên DB đang nối chưa.
 *
 * ⚠ VÌ SAO CẦN MỘT LỆNH RIÊNG, không "deploy rồi xem có sập không": `/auth/me` bản D295
 * SELECT bốn cột ấy, và cột thiếu thì mọi request CÓ COOKIE trả 500 — còn request KHÔNG
 * cookie vẫn 401 sạch sẽ vì nó dừng trước khi chạm DB. Tức phép kiểm hiển nhiên nhất
 * ("mở trang xem có lên không", "curl /health") KHÔNG THỂ thấy lỗi này. Đúng cùng hình
 * với sự cố D293: hỏng chỉ lộ ở lượt thứ hai, khi đã có phiên.
 *
 * ⚠ Chỉ SELECT trên `information_schema` + một phép đếm — không ghi một byte nào.
 * Chạy: `npm run kiem:cot-pfm` (dev) · `npm run kiem:cot-pfm:prod` (prod).
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createPool } from '../server/db.js';
import { CUA_PFM, CUA_PFM_COT } from '../config/pfm_consent.js';

const laLenhChinh =
  import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;

export async function main(): Promise<void> {
  const { chanEnvFileBiNuot, inDb } = await import('./moi_truong.js');
  const nuot = chanEnvFileBiNuot(process.env, 'kiem_cot_pfm_cua');
  if (nuot !== null) { console.error(nuot); process.exitCode = 1; return; }
  inDb('KIỂM CỘT pfm_cua_* (chỉ đọc)');

  const pool = createPool();
  try {
    const cot = CUA_PFM.map((cua) => CUA_PFM_COT[cua]);
    const r = await pool.query(
      `SELECT column_name, data_type, column_default, is_nullable
         FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = ANY($1::text[])
        ORDER BY column_name`,
      [cot],
    );
    const co = new Set(r.rows.map((x) => x.column_name as string));
    const thieu = cot.filter((c) => !co.has(c));

    for (const x of r.rows) {
      console.log(`  ✓ ${x.column_name.padEnd(20)} ${x.data_type} `
        + `default=${x.column_default} nullable=${x.is_nullable}`);
    }
    for (const c of thieu) console.log(`  ✖ ${c} — CHƯA CÓ`);

    if (thieu.length > 0) {
      console.error(`\n✖ Thiếu ${thieu.length}/4 cột — migration 0061 CHƯA áp. `
        + 'ĐỪNG deploy API: /auth/me sẽ trả 500 cho mọi phiên đã đăng nhập.');
      process.exitCode = 1;
      return;
    }

    /*
     * Bất biến của 0061: cờ gộp `pfm_consent` = "có ít nhất một cửa bật". Hàng nào còn
     * cờ TRUE mà bốn cửa đóng là hàng migration đáng lẽ đã dọn — đếm để biết câu UPDATE
     * đã chạy, chứ không chỉ biết ALTER TABLE đã chạy.
     */
    const lech = await pool.query(
      `SELECT count(*)::int AS n FROM users
        WHERE pfm_consent = TRUE
          AND NOT (${CUA_PFM.map((cua) => CUA_PFM_COT[cua]).join(' OR ')})`);
    const batKyCua = await pool.query(
      `SELECT count(*)::int AS n FROM users
        WHERE ${CUA_PFM.map((cua) => CUA_PFM_COT[cua]).join(' OR ')}`);

    console.log(`\n  cờ gộp bật mà bốn cửa đóng: ${lech.rows[0].n} (phải = 0)`);
    console.log(`  người đang bật ít nhất một cửa: ${batKyCua.rows[0].n}`);
    if (lech.rows[0].n !== 0) {
      console.error('✖ Còn hàng lệch — câu UPDATE của 0061 chưa chạy.');
      process.exitCode = 1;
      return;
    }
    console.log('\n✓ Migration 0061 ĐÃ ÁP trên DB này. Deploy API được.');
  } finally {
    await pool.end();
  }
}

if (laLenhChinh) await main();
