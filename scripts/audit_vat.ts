/**
 * `npm run audit:cung` — đối chiếu SỔ VẬT với hai bảng đọc nhanh (bất biến E2).
 *
 * Vế thứ hai của `audit:supply`. Logic thật ở `server/kinh_te/audit_vat.ts`;
 * đây chỉ là vỏ CLI (deploy chỉ đóng gói api/server/config, nên import từ
 * `scripts/` lúc chạy là crash function — đã dính 18/07).
 *
 * ⚠ MÃ THOÁT 1 KHI LỆCH. Một bài audit luôn thoát 0 là một bài audit không ai
 * cắm vào cron được, và cắm vào rồi thì nó im lặng mãi mãi.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createPool } from '../server/db.js';
import { auditVat } from '../server/kinh_te/audit_vat.js';

const DO = '\x1b[31m';
const XANH = '\x1b[32m';
const VANG = '\x1b[33m';
const MO = '\x1b[2m';
const HET = '\x1b[0m';

async function chay(): Promise<number> {
  const pool = createPool();
  try {
    const kq = await auditVat(pool);
    console.log('');
    console.log('=== AUDIT SỔ VẬT (E2) ===');
    console.log('');
    console.log(`  đợt phát hành : ${kq.soDot}`);
    console.log(`  bản thể       : ${kq.soBanThe}`);
    console.log(`  ghi song song : ${kq.coGhiSongSong
      ? `${XANH}ĐANG BẬT${HET}`
      : `${VANG}ĐANG TẮT${HET} ${MO}— lệch dưới đây là ĐÚNG, không phải lỗi${HET}`}`);
    console.log('');

    if (kq.can) {
      console.log(`  ${XANH}✔ CÂN — không một dòng nào lệch${HET}`);
      return 0;
    }

    console.log(`  ${DO}✖ LỆCH ${kq.lech.length} dòng${HET}`);
    for (const l of kq.lech.slice(0, 40)) {
      console.log(`    ${DO}${l.ma}${HET}  ${l.khoa}`
        + `  ·  cache ${l.theoCache}  ·  sổ ${l.theoSo}`);
    }
    if (kq.lech.length > 40) console.log(`    ${MO}… và ${kq.lech.length - 40} dòng nữa${HET}`);
    console.log('');
    console.log(`  ${MO}Audit KHÔNG tự chữa. Lệch nghĩa là đường GHI sai, không phải con số sai.${HET}`);
    // Cờ tắt thì lệch là trạng thái mong đợi ⇒ không phải một lần thất bại.
    return kq.coGhiSongSong ? 1 : 0;
  } finally {
    await pool.end();
  }
}

const laMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (laMain) {
  const { chanEnvFileBiNuot, inDb } = await import('./moi_truong.js');
  const nuot = chanEnvFileBiNuot(process.env, 'audit_vat');
  if (nuot !== null) {
    console.error(`[31m${nuot}[0m`);
    process.exitCode = 2;
  } else {
    inDb('AUDIT SỔ VẬT');
    process.exitCode = await chay();
  }
}

export { chay };
export const __ten = fileURLToPath(import.meta.url);
