import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION } from '../config/holdem.js';

const ver = process.env.VER ?? HOLDEM_BALANCE_VERSION;
const luat = luatCua(ver);
const tc = tuyChonSinhMap(luat);
const N = Number(process.env.N ?? 20000);

console.log('phiên bản ĐANG ĐO =', ver, '(mặc định repo =', HOLDEM_BALANCE_VERSION + ')');
console.log('cờ map:', JSON.stringify(tc));

for (const size of [8, 12, 16]) {
  const mat = new Map<string, number>();
  let suKien2 = 0, hls2 = 0, hlsThat2 = 0;
  // phân bố theo từng ô cho ha_lai_suat
  const theoO = new Array(size).fill(0);
  const skTheoO = new Array(size).fill(0);
  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, size, tc);
    for (let i = 0; i < size; i += 1) {
      const o = m.o[i]!;
      if (o.kind === 'su_kien') {
        skTheoO[i] += 1;
        if (o.su_kien === 'ha_lai_suat') theoO[i] += 1;
      }
    }
    const o2 = m.o[1]!;
    if (o2.kind === 'su_kien') {
      suKien2 += 1;
      mat.set(o2.su_kien, (mat.get(o2.su_kien) ?? 0) + 1);
      if (o2.su_kien === 'ha_lai_suat') {
        hls2 += 1;
        if (!o2.la_tin_gia) hlsThat2 += 1;
      }
    }
  }
  console.log(`\n=== MAP ${size} · N=${N} ===`);
  console.log(`ô2 là SỰ KIỆN      : ${suKien2} (${(100 * suKien2 / N).toFixed(2)}%)`);
  console.log(`ô2 = ha_lai_suat   : ${hls2} (${(100 * hls2 / N).toFixed(2)}% mọi trận · ${suKien2 ? (100 * hls2 / suKien2).toFixed(1) : '-'}% trong số ô2-sự-kiện)`);
  console.log(`   trong đó THẬT   : ${hlsThat2} (${hls2 ? (100 * hlsThat2 / hls2).toFixed(1) : '-'}%)`);
  console.log('mặt ở ô2 (top):', [...mat.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${(100 * v / N).toFixed(2)}%`).join(' · '));
  console.log('ha_lai_suat theo ô (1-idx):',
    theoO.map((c, i) => `${i + 1}:${(100 * c / N).toFixed(2)}%`).join(' '));
  console.log('ô sự kiện theo ô   (1-idx):',
    skTheoO.map((c, i) => `${i + 1}:${(100 * c / N).toFixed(1)}%`).join(' '));
}
