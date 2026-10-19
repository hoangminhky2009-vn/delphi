/**
 * Ô2 = HẠ LÃI SUẤT có NGUYÊN NHÂN không? (phản biện 31/08)
 *
 * `scripts/do_o2_hls.ts` đã đo TẦN SUẤT (ô2 hạ lãi 3,25% map 8). Bài này đo thứ
 * khác: cú hạ lãi ấy có PHA GIẢM đứng trước không — tức luật nhân quả
 * `SU_KIEN_THEO_GIAI_DOAN` (`ha_lai_suat` sau `giam` ×2,0) phủ được bao nhiêu.
 *
 * ⚠ Đo trên BỘ LUẬT MẶC ĐỊNH qua `luatCua` + `tuyChonSinhMap` — không dựng
 * object tuỳ chọn bằng tay (bẫy D83/D127/D152/D169).
 */
import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION } from '../config/holdem.js';

const VER = process.env.VER ?? HOLDEM_BALANCE_VERSION;
const tc = tuyChonSinhMap(luatCua(VER));
const N = Number(process.env.N ?? 200000);
console.log(`phiên bản ĐANG ĐO = ${VER}  (mặc định repo = ${HOLDEM_BALANCE_VERSION})`);
console.log(`N=${N}`);

for (const size of [8, 12]) {
  const dem = new Map<string, number>();
  const ha = new Map<string, number>();
  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, size, tc).o;
    const a = m[0]!;
    const b = m[1]!;
    if (a.kind !== 'giai_doan') continue;
    dem.set(a.giai_doan, (dem.get(a.giai_doan) ?? 0) + 1);
    if (b.kind === 'su_kien' && b.su_kien === 'ha_lai_suat') {
      ha.set(a.giai_doan, (ha.get(a.giai_doan) ?? 0) + 1);
    }
  }
  let tong = 0;
  let phiGiam = 0;
  console.log(`\n── map ${size} — P(ô2 = hạ lãi suất | pha ở ô1) ──`);
  for (const [g, n] of [...dem].sort((x, y) => y[1] - x[1])) {
    const h = ha.get(g) ?? 0;
    tong += h;
    if (g !== 'giam') phiGiam += h;
    console.log(`  ô1=${g.padEnd(10)} ${((h / n) * 100).toFixed(2)}%  (${h}/${n})`);
  }
  console.log(`  ⇒ ${phiGiam}/${tong} = ${((phiGiam / tong) * 100).toFixed(1)}%`
    + ' cú hạ lãi ở ô2 KHÔNG có pha giảm đứng trước');
}
