/** PHẢN BIỆN — đo độc lập P(ô N = sự kiện) qua MỘT CỬA tuyChonSinhMap. */
import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION, LICH_CHINH_SACH } from '../config/holdem.js';

const ver = process.env.VER ?? HOLDEM_BALANCE_VERSION;
const luat = luatCua(ver);
const tc = tuyChonSinhMap(luat);
const N = Number(process.env.N ?? 20000);
const BASE = Number(process.env.BASE ?? 0);

console.log('phiên bản ĐANG ĐO =', ver, '| mặc định repo =', HOLDEM_BALANCE_VERSION);
console.log('cờ map:', JSON.stringify(tc));
console.log('O_THEO_MAP =', JSON.stringify(LICH_CHINH_SACH.O_THEO_MAP));
console.log(`seed: ${BASE} .. ${BASE + N - 1}`);

for (const size of [8, 12, 16]) {
  const sk = new Array(size).fill(0);     // ô là su_kien
  const gd = new Array(size).fill(0);     // ô là giai_doan
  const lichSk = new Array(size).fill(0); // ô lịch mà ra su_kien
  const lichGiu = new Array(size).fill(0);// ô lịch mà ra giai_doan (giữ nguyên)
  let coTinTruocO4 = 0, tongTin = 0;
  for (let s = BASE; s < BASE + N; s += 1) {
    const m = sinhMap(s, size, tc);
    let tinSom = false;
    for (let i = 0; i < size; i += 1) {
      const o = m.o[i]!;
      const t = m.trang_thai?.[i] as { o_lich?: boolean } | undefined;
      if (o.kind === 'su_kien') {
        sk[i] += 1; tongTin += 1;
        if (t?.o_lich) lichSk[i] += 1;
        if (i < 3) tinSom = true;
      } else {
        gd[i] += 1;
        if (t?.o_lich) lichGiu[i] += 1;
      }
    }
    if (tinSom) coTinTruocO4 += 1;
  }
  console.log(`\n=== MAP ${size} (N=${N}) ===`);
  console.log('P(ô = SỰ KIỆN) theo ô 1-idx:');
  console.log('  ' + sk.map((c, i) => `${i + 1}:${(100 * c / N).toFixed(2)}%`).join('  '));
  console.log('  đếm thô     : ' + sk.map((c, i) => `${i + 1}:${c}`).join(' '));
  const lichIdx = (LICH_CHINH_SACH.O_THEO_MAP[size] ?? []);
  for (const L of lichIdx) {
    const i = L - 1;
    console.log(`  ô LỊCH ${L}: su_kien ${lichSk[i]} (${(100*lichSk[i]/N).toFixed(2)}%) · giai_doan(GIỮ) ${lichGiu[i]} (${(100*lichGiu[i]/N).toFixed(2)}%)`);
  }
  console.log(`  trận có ÍT NHẤT 1 tin trong ô1..ô3: ${coTinTruocO4} (${(100*coTinTruocO4/N).toFixed(2)}%)`);
  console.log(`  tổng tin/trận: ${(tongTin / N).toFixed(3)}`);
}
