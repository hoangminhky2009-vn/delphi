/**
 * `npm run quy-cho:nap -- <T>` — rót vốn từ Kho bạc sang quỹ chợ (B5, M1).
 *
 * ⚠ CON SỐ LÀ CỦA FOUNDER, KHÔNG NẰM TRONG CODE (A8.2). Script này không có mặc
 * định: thiếu tham số là dừng, không rót "một số hợp lý". Chuyển, KHÔNG mint —
 * hai bút toán đối ứng trong một transaction; `audit:supply` phải CÂN ngay sau.
 *
 * Vỏ CLI thuần; logic ở `server/kinh_te/quy_cho.ts` (deploy chỉ đóng gói
 * api/server/config — import từ scripts/ lúc chạy là crash function, đã dính 18/07).
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPool } from '../server/db.js';
import { auditSupply } from '../server/audit.js';
import { napQuyChoTuKhoBac, soDuQuyCho } from '../server/kinh_te/quy_cho.js';
import { chanEnvFileBiNuot, inDb } from './moi_truong.js';

const DO = '\x1b[31m';
const XANH = '\x1b[32m';
const HET = '\x1b[0m';

async function chay(argv: readonly string[]): Promise<number> {
  const nuot = chanEnvFileBiNuot(process.env, 'nap_quy_cho');
  if (nuot !== null) { console.error(`${DO}${nuot}${HET}`); return 2; }

  const them = argv.includes('--them');
  const thamSo = argv.find((a) => !a.startsWith('--'));
  if (thamSo === undefined || !/^\d+$/.test(thamSo) || BigInt(thamSo) <= 0n) {
    console.error(`${DO}Cần đúng một tham số: số T nguyên dương. Ví dụ: npm run quy-cho:nap -- 3000${HET}`);
    console.error('Không có mặc định — con số là quyết định của founder (A8.2).');
    return 2;
  }
  const soT = BigInt(thamSo);
  inDb('RÓT VỐN QUỸ CHỢ');
  const pool = createPool();
  const client = await pool.connect();
  try {
    /*
     * ⚠⚠ RÓT LẦN THỨ HAI PHẢI NÓI RA MIỆNG (`--them`). Ca thật 06/09 (D289):
     * lệnh chạy hai lần vì cả hai lần đều in ✔ và không có gì trong đầu ra phân
     * biệt được lần này với lần trước. Sổ quỹ là APPEND-ONLY — không có đường
     * lùi, chỉ có cách rót thêm. Nên chỗ rẻ nhất để chặn là TRƯỚC bút toán.
     *
     * Không phải một tham số kinh tế (A8.2) — nó không đổi con số nào, chỉ đòi
     * người gõ xác nhận rằng họ BIẾT quỹ đã có tiền.
     */
    const dangCo = await soDuQuyCho(pool);
    if (dangCo > 0n && !them) {
      console.error(`${DO}✖ quỹ chợ ĐÃ CÓ ${dangCo} T — đây sẽ là lần rót thứ hai.${HET}`);
      console.error(`  Nếu thật sự muốn rót THÊM ${soT} T (thành ${dangCo + soT} T), thêm cờ:`);
      console.error(`      npm run quy-cho:nap -- ${soT} --them`);
      console.error('  Sổ quỹ là append-only: rót rồi không rút về được.');
      return 2;
    }
    await client.query('BEGIN');
    const kq = await napQuyChoTuKhoBac(client, soT);
    await client.query('COMMIT');
    console.log(`${XANH}✔ đã rót ${soT} T${HET}  ·  Kho bạc còn ${kq.khoBacSau} T  ·  quỹ chợ ${kq.quyChoSau} T`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`${DO}✖ không rót được: ${(e as Error).message}${HET}`);
    return 1;
  } finally {
    client.release();
  }
  const a = await auditSupply(pool);
  await pool.end();
  if (!a.ok) {
    console.error(`${DO}✖ audit:supply LỆCH ngay sau khi rót:${HET}`);
    for (const p of a.problems) console.error('   ' + p);
    return 1;
  }
  console.log(`${XANH}✔ audit:supply cân${HET}`);
  return 0;
}

const laMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (laMain) process.exitCode = await chay(process.argv.slice(2));
