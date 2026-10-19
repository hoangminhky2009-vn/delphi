/**
 * PHẢN BIỆN ĐỘC LẬP — "luật cấm hai sự kiện liền nhau" có ngoại lệ không?
 * Đo trên BỘ LUẬT MẶC ĐỊNH (luatCua(HOLDEM_BALANCE_VERSION) + tuyChonSinhMap)
 * — né bẫy D83/D127/D152 (đo trên trò luật-tắt).
 */
import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { HOLDEM_BALANCE_VERSION, LICH_CHINH_SACH, luatCua } from '../config/holdem.js';

const VER = process.argv[3] ?? HOLDEM_BALANCE_VERSION;
const N = Number(process.argv[2] ?? 20000);
const luat = luatCua(VER);
const tc = tuyChonSinhMap(luat);
console.log(`phiên bản đo = ${VER}` +
  (VER === HOLDEM_BALANCE_VERSION ? ' (MẶC ĐỊNH repo)' : ' (≠ mặc định!)'));
console.log('cờ:', JSON.stringify(tc));

for (const size of [8, 12, 16]) {
  let mapCoCap = 0, tongCap = 0;
  let sau_lich = 0, sau_ep = 0, sau_tudo = 0;   // phân loại Ô THỨ HAI của cặp
  let truoc_lich = 0, truoc_ep = 0, truoc_tudo = 0;
  const viTri = new Map<string, number>();
  for (let s = 1; s <= N; s += 1) {
    const m = sinhMap(s, size, tc);
    let co = false;
    for (let i = 1; i < size; i += 1) {
      const a = m.o[i - 1]!, b = m.o[i]!;
      if (a.kind !== 'su_kien' || b.kind !== 'su_kien') continue;
      co = true; tongCap += 1;
      const ta = m.trang_thai![i - 1]!, tb = m.trang_thai![i]!;
      // Ô THỨ HAI: nếu không phải ô lịch thì KHÔNG THỂ là rút tự do
      // (guard truoc?.kind !== 'su_kien' cấm) ⇒ chỉ còn đường điềm-ép.
      if (tb.o_lich) sau_lich += 1;
      else if (tb.face_prior_bp === 7500) sau_ep += 1;
      else sau_tudo += 1;
      if (ta.o_lich) truoc_lich += 1;
      else if (ta.face_prior_bp === 7500) truoc_ep += 1;
      else truoc_tudo += 1;
      const k = `${i}-${i + 1}`;           // số VÒNG (1-based)
      viTri.set(k, (viTri.get(k) ?? 0) + 1);
    }
    if (co) mapCoCap += 1;
  }
  const top = [...viTri.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
  console.log(`\n── map ${size} (ô lịch = vòng ${JSON.stringify(LICH_CHINH_SACH.O_THEO_MAP[size])})`);
  console.log(`  map có ≥1 cặp liền kề : ${mapCoCap}/${N} = ${(100 * mapCoCap / N).toFixed(2)}%`);
  console.log(`  tổng số cặp           : ${tongCap}`);
  console.log(`  ô THỨ HAI  : lịch ${sau_lich} · ép ${sau_ep} · rút-tự-do ${sau_tudo}`);
  console.log(`  ô THỨ NHẤT : lịch ${truoc_lich} · ép ${truoc_ep} · rút-tự-do ${truoc_tudo}`);
  console.log(`  cặp dính ô lịch (một trong hai): ` +
    `${(100 * (sau_lich + truoc_lich) / Math.max(1, tongCap)).toFixed(1)}%`);
  console.log(`  vị trí (vòng) : ${top.map(([k, v]) => `${k}:${v}`).join(' · ')}`);
}
