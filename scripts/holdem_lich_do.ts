/**
 * ĐO Ô LỊCH CHÍNH SÁCH (D43 bước 2, gate 7.6) — số cho báo cáo, chạy lại được.
 *
 * In: độ chính xác bot-theo-dõi (trần lý thuyết = 1 − TY_LE_SAI_LAM_BP), phân
 * bố ba hướng theo cỡ map, và tỷ trọng lãi suất trong tổng sự kiện v11 so v10b
 * (kiểm "lãi suất dồn về kỳ họp, ngoài lịch hạ ×0,2").
 *
 * Chạy: npx tsx scripts/holdem_lich_do.ts
 */
import { LICH_CHINH_SACH } from '../config/holdem.js';
import { sinhMap } from '../server/holdem/map.js';

const N = 3000;
for (const size of [8, 12, 16]) {
  const oLich = LICH_CHINH_SACH.O_THEO_MAP[size]!;
  let tong = 0;
  let dung = 0;
  const dem: Record<string, number> = { tang: 0, ha: 0, giu: 0 };
  let skTong = 0;
  let skLai = 0;
  for (let seed = 1; seed <= N; seed += 1) {
    const m = sinhMap(seed, size, true);
    for (const o of m.o) {
      if (o.kind === 'su_kien') {
        skTong += 1;
        if (o.su_kien.includes('lai_suat')) skLai += 1;
      }
    }
    for (const v of oLich) {
      const tt = m.trang_thai![v - 1]!;
      tong += 1;
      if (tt.huong_cs_ky_vong === tt.huong_cs_thuc) dung += 1;
      dem[tt.huong_cs_thuc!]! += 1;
    }
  }
  console.log(`map ${size} — theo dõi đúng ${(100 * dung / tong).toFixed(1)}%`
    + ` | tăng/hạ/giữ ${(100 * dem.tang! / tong).toFixed(1)}/`
    + `${(100 * dem.ha! / tong).toFixed(1)}/${(100 * dem.giu! / tong).toFixed(1)}%`
    + ` | lãi suất ${(100 * skLai / skTong).toFixed(1)}% số sự kiện (gồm ô lịch)`);
}
let sk = 0;
let lai = 0;
for (let seed = 1; seed <= N; seed += 1) {
  for (const o of sinhMap(seed, 12).o) {
    if (o.kind === 'su_kien') {
      sk += 1;
      if (o.su_kien.includes('lai_suat')) lai += 1;
    }
  }
}
console.log(`đối chứng v10b (không lịch, map 12): lãi suất ${(100 * lai / sk).toFixed(1)}% số sự kiện`);
