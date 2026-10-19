/**
 * ĐO CHU KỲ VĨ MÔ CỦA `sinhMap` (founder 22/09: *"chơi loạn v**, chẳng thấy rõ chu kỳ nào"*).
 *
 * Không sửa gì — chỉ hỏi ba câu, thuần từ `sinhMap`:
 *   1. Ô PHA phân bố ra sao (có pha nào áp đảo / vắng mặt không)?
 *   2. CHUỖI cùng hướng dài trung bình bao nhiêu ô? Chuỗi 1 ô = nhiễu trắng.
 *   3. Ma trận chuyển: P(pha kế | pha này). Gần đều ⇒ không có quán tính ⇒ mắt đọc ra "loạn".
 * CHẠY: npx tsx scripts/do_chu_ky.ts [số_map] [cỡ_bàn]
 */
import { HUONG_GIAI_DOAN, sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { HOLDEM_BALANCE_VERSION, luatCua } from '../config/holdem.js';

const A = process.argv.slice(2).filter((x) => !x.startsWith('--'));
const N = Math.max(1, Number(A[0] ?? 4000) | 0);
const SIZE = Math.max(4, Number(A[1] ?? 12) | 0);
const TC = tuyChonSinhMap(luatCua(HOLDEM_BALANCE_VERSION));
console.log(`ĐO CHU KỲ — ${N} map · bàn ${SIZE} · luật ${HOLDEM_BALANCE_VERSION}\n`);

const dem = new Map<string, number>();
const chuyen = new Map<string, Map<string, number>>();
let chuoiTong = 0; let chuoiSo = 0; let doiHuong = 0; let capPha = 0;

for (let s = 0; s < N; s += 1) {
  const m = sinhMap(s * 7919 + 13, SIZE, TC);
  const pha = m.o.filter((o) => o.kind === 'giai_doan').map((o) => (o as { giai_doan: string }).giai_doan);
  let runDai = 1;
  for (let i = 0; i < pha.length; i += 1) {
    const p = pha[i]!;
    dem.set(p, (dem.get(p) ?? 0) + 1);
    if (i + 1 < pha.length) {
      const q = pha[i + 1]!;
      if (!chuyen.has(p)) chuyen.set(p, new Map());
      const r = chuyen.get(p)!; r.set(q, (r.get(q) ?? 0) + 1);
      capPha += 1;
      const hp = HUONG_GIAI_DOAN[p as 'tang'] ?? 0;
      const hq = HUONG_GIAI_DOAN[q as 'tang'] ?? 0;
      if (hp !== 0 && hq !== 0 && hp !== hq) doiHuong += 1;
      if (p === q) runDai += 1;
      else { chuoiTong += runDai; chuoiSo += 1; runDai = 1; }
    }
  }
  chuoiTong += runDai; chuoiSo += 1;
}

const tongPha = [...dem.values()].reduce((a, b) => a + b, 0);
console.log('1. PHÂN BỐ PHA');
for (const [p, c] of [...dem.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`   ${p.padEnd(12)} ${((c * 100) / tongPha).toFixed(1)}%`);
}
console.log(`\n2. CHUỖI CÙNG PHA: trung bình ${(chuoiTong / chuoiSo).toFixed(2)} ô liên tiếp`);
console.log(`   (1,00 = đổi pha MỖI Ô = nhiễu trắng · ≥2 = có quán tính nhìn thấy được)`);
console.log(`   ĐẢO CHIỀU tăng↔giảm ngay ô kế: ${((doiHuong * 100) / capPha).toFixed(1)}% số cặp`);
console.log('\n3. MA TRẬN CHUYỂN  P(kế | này)');
const ten = [...dem.keys()].sort();
console.log(`   ${''.padEnd(12)}${ten.map((t) => t.slice(0, 7).padStart(9)).join('')}`);
for (const p of ten) {
  const r = chuyen.get(p) ?? new Map();
  const tot = [...r.values()].reduce((a, b) => a + b, 0) || 1;
  const hang = ten.map((q) => `${(((r.get(q) ?? 0) * 100) / tot).toFixed(0)}%`.padStart(9)).join('');
  console.log(`   ${p.padEnd(12)}${hang}`);
}
console.log(`\n   Đều ≈ ${(100 / ten.length).toFixed(0)}% khắp bảng ⇒ KHÔNG có chu kỳ, mắt đọc ra "loạn".`);
