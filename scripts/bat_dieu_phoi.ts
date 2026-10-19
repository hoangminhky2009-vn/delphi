/**
 * `npm run dieu-phoi -- <handle> [--ghi | --go]` — quyền điều phối buổi đo (D333).
 * `npm run dieu-phoi -- --admin [--ghi | --go]` — cả lượt cho mọi tài khoản `role='admin'` (D349).
 * Prod: `npm run dieu-phoi:prod -- <handle> --ghi` (môi trường gắn sẵn trong package.json).
 *
 * ⚠ MẶC ĐỊNH CHỈ ĐỌC. Không cờ ⇒ in tài khoản tìm được và cờ hiện tại, không ghi gì. `--ghi` bật, `--go` gỡ.
 *   Người được bật là một người KHÁC founder, trên DB thật, và cờ ấy mở màn tạo bàn cho cả lớp — nên lượt đầu
 *   luôn là một lượt nhìn: đúng người chưa, đúng DB chưa.
 * Vỏ CLI thuần; logic ở `server/holdem/ban_buoi_do.ts`.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPool } from '../server/db.js';
import { datQuyenDieuPhoi, datQuyenDieuPhoiMoiAdmin } from '../server/holdem/ban_buoi_do.js';
import { chanEnvFileBiNuot, inDb } from './moi_truong.js';

const DO = '\x1b[31m';
const XANH = '\x1b[32m';
const HET = '\x1b[0m';

export async function chay(argv: readonly string[]): Promise<number> {
  const nuot = chanEnvFileBiNuot(process.env, 'bat_dieu_phoi');
  if (nuot !== null) { console.error(`${DO}${nuot}${HET}`); return 2; }

  const ghi = argv.includes('--ghi');
  const go = argv.includes('--go');
  const moiAdmin = argv.includes('--admin');
  const handle = argv.find((a) => !a.startsWith('--'));
  if ((!handle && !moiAdmin) || (ghi && go) || (handle !== undefined && moiAdmin)) {
    console.error(`${DO}Cần đúng một handle HOẶC --admin, và nhiều nhất một trong --ghi / --go.${HET}`);
    console.error('  Xem trước:  npm run dieu-phoi -- ten_nguoi_dieu_phoi');
    console.error('  Bật:        npm run dieu-phoi -- ten_nguoi_dieu_phoi --ghi');
    console.error('  Mọi admin:  npm run dieu-phoi -- --admin        (xem)');
    console.error('              npm run dieu-phoi -- --admin --ghi  (bật cả lượt)');
    return 2;
  }

  const nhan = ghi ? 'BẬT QUYỀN ĐIỀU PHỐI' : go ? 'GỠ QUYỀN ĐIỀU PHỐI' : 'XEM QUYỀN ĐIỀU PHỐI (chỉ đọc)';

  /*
   * D349 — LƯỢT CẤP CHO MỌI ADMIN. Vẫn giữ nguyên luật của tệp này: không cờ ⇒ chỉ nhìn.
   * Lượt đầu trên prod phải là một lượt nhìn, vì đây là lệnh DUY NHẤT trong repo mở được
   * màn tạo bàn cho cả lớp, và nó đổi quyền của người khác chứ không phải của người gõ.
   */
  if (moiAdmin) {
    inDb(`${nhan} — MỌI ADMIN`);
    const poolAd = createPool();
    try {
      const hang = await datQuyenDieuPhoiMoiAdmin(poolAd, ghi ? true : go ? false : null);
      if (hang.length === 0) {
        console.error(`${DO}✖ không có tài khoản nào role='admin' (và không phải khách) trên DB này.${HET}`);
        return 1;
      }
      const daCo = hang.filter((h) => h.truoc).length;
      console.log(`${hang.length} admin · ${daCo} đã có quyền từ trước:`);
      for (const h of hang) console.log(`  @${h.handle}: ${h.truoc ? 'CÓ' : 'không'}`);
      if (!ghi && !go) {
        console.log('(Chỉ đọc — thêm --ghi để bật cho cả lượt, --go để gỡ.)');
      } else {
        const sau = ghi ? 'CÓ quyền điều phối' : 'không có quyền điều phối';
        console.log(`${XANH}✔ cả ${hang.length} tài khoản trên: ${sau}${HET}`);
      }
      return 0;
    } finally {
      await poolAd.end();
    }
  }

  inDb(nhan);
  const pool = createPool();
  try {
    const kq = await datQuyenDieuPhoi(pool, handle!, ghi ? true : go ? false : null);
    if (kq.loai === 'khong_co') {
      console.error(`${DO}✖ không có tài khoản nào tên @${kq.handle}.${HET} Người ấy lập hồ sơ xong chưa?`);
      return 1;
    }
    if (kq.loai === 'la_khach') {
      console.error(`${DO}✖ @${kq.handle} là tài khoản KHÁCH — khách không tạo được bàn buổi đo.${HET}`);
      return 1;
    }
    const chu = (b: boolean) => (b ? 'CÓ quyền điều phối' : 'không có quyền điều phối');
    if (!ghi && !go) {
      console.log(`@${kq.handle}: ${chu(kq.truoc)}. (Chỉ đọc — thêm --ghi để bật, --go để gỡ.)`);
    } else if (kq.truoc === kq.sau) {
      console.log(`@${kq.handle}: đã ${chu(kq.sau)} từ trước — không đổi gì.`);
    } else {
      console.log(`${XANH}✔ @${kq.handle}: ${chu(kq.truoc)} → ${chu(kq.sau)}${HET}`);
    }
    return 0;
  } finally {
    await pool.end();
  }
}

const laMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (laMain) process.exitCode = await chay(process.argv.slice(2));
