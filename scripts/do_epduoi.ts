import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION, CHU_KY } from '../config/holdem.js';
const tc = tuyChonSinhMap(luatCua(HOLDEM_BALANCE_VERSION));
const N = 30000;
console.log('TELEGRAPH_TIN_CAY_BP =', CHU_KY.TELEGRAPH_TIN_CAY_BP);
for (const size of [8, 12, 16]) {
  const mat = new Map<string, number>(); let som = 99; const oIdx = new Map<number, number>();
  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, size, tc);
    for (let i = 0; i < size; i += 1) {
      const t = m.trang_thai?.[i] as { face_prior_bp?: number; o_lich?: boolean } | undefined;
      const o = m.o[i]!;
      if (t && !t.o_lich && t.face_prior_bp === CHU_KY.TELEGRAPH_TIN_CAY_BP && o.kind === 'su_kien') {
        mat.set(o.su_kien, (mat.get(o.su_kien) ?? 0) + 1);
        oIdx.set(i + 1, (oIdx.get(i + 1) ?? 0) + 1);
        if (i + 1 < som) som = i + 1;
      }
    }
  }
  console.log(`\nmap ${size}: ô ÉP sớm nhất (1-idx) = ${som}`);
  console.log('  mặt bị ép:', [...mat.entries()].sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${v}`).join(' · '));
  console.log('  theo ô   :', [...oIdx.entries()].sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' '));
  console.log('  có ha_lai_suat/tang_lai_suat trong số bị ép? ',
    (mat.has('ha_lai_suat') || mat.has('tang_lai_suat')) ? 'CÓ' : 'KHÔNG');
}
