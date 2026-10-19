import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION, tyLeTinGiaHieuDung } from '../config/holdem.js';

const luat = luatCua(HOLDEM_BALANCE_VERSION);
const tc = tuyChonSinhMap(luat);
const N = Number(process.env.N ?? 200000);
console.log(`balance = ${HOLDEM_BALANCE_VERSION}   N = ${N}`);
console.log(`lý thuyết: don_doc×ha_lai_suat = ${tyLeTinGiaHieuDung('don_doc','ha_lai_suat',0)}bp`
  + `  | noi_chuoi×ha_lai_suat = ${tyLeTinGiaHieuDung('noi_chuoi','ha_lai_suat',0)}bp`);

for (const size of [8, 12, 16]) {
  // Câu 1: ô 1 (index 0) có bao giờ là sự kiện không?
  // Câu 2: ô 2 (index 1) khi là sự kiện thì boi_canh là gì?
  // Câu 3: tỷ lệ tin giả THỰC ĐO của ha_lai_suat ở ô 2.
  let o1SuKien = 0, o2SuKien = 0, o2DonDoc = 0, o2NoiChuoi = 0;
  let hls2 = 0, hls2Gia = 0;
  const boiCanhKhac = new Map<string, number>();
  // đối chứng: ha_lai_suat ở MỌI ô, tách theo boi_canh
  let hlsAllDon = 0, hlsAllDonGia = 0, hlsAllNoi = 0, hlsAllNoiGia = 0;

  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, size, tc);
    if (m.o[0]!.kind === 'su_kien') o1SuKien += 1;
    const o2 = m.o[1]!;
    if (o2.kind === 'su_kien') {
      o2SuKien += 1;
      if (o2.boi_canh === 'don_doc') o2DonDoc += 1;
      else { o2NoiChuoi += 1; boiCanhKhac.set(o2.su_kien, (boiCanhKhac.get(o2.su_kien) ?? 0) + 1); }
      if (o2.su_kien === 'ha_lai_suat') { hls2 += 1; if (o2.la_tin_gia) hls2Gia += 1; }
    }
    for (const c of m.o) {
      if (c.kind === 'su_kien' && c.su_kien === 'ha_lai_suat') {
        if (c.boi_canh === 'don_doc') { hlsAllDon += 1; if (c.la_tin_gia) hlsAllDonGia += 1; }
        else { hlsAllNoi += 1; if (c.la_tin_gia) hlsAllNoiGia += 1; }
      }
    }
  }
  const pct = (a: number, b: number) => (b ? (100 * a / b).toFixed(2) + '%' : '-');
  // sai số chuẩn nhị thức quanh 20%
  const se = hls2 ? 100 * Math.sqrt(0.2 * 0.8 / hls2) : 0;
  console.log(`\n=== MAP ${size} ===`);
  console.log(`ô1 là sự kiện          : ${o1SuKien}  (${pct(o1SuKien, N)})`);
  console.log(`ô2 là sự kiện          : ${o2SuKien}  (${pct(o2SuKien, N)})`);
  console.log(`  · don_doc            : ${o2DonDoc}  (${pct(o2DonDoc, o2SuKien)})`);
  console.log(`  · noi_chuoi          : ${o2NoiChuoi}  ${o2NoiChuoi ? '<<< PHẢN VÍ DỤ: ' + [...boiCanhKhac] : ''}`);
  console.log(`ô2 = ha_lai_suat       : ${hls2}`);
  console.log(`  · tin GIẢ            : ${hls2Gia}  (${pct(hls2Gia, hls2)})   [lý thuyết 20.00%, 1 SE = ${se.toFixed(2)}pp]`);
  console.log(`ha_lai_suat MỌI ô, don_doc  : ${hlsAllDon} → giả ${pct(hlsAllDonGia, hlsAllDon)}`);
  console.log(`ha_lai_suat MỌI ô, noi_chuoi: ${hlsAllNoi} → giả ${pct(hlsAllNoiGia, hlsAllNoi)}`);
}
