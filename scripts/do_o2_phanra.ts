import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION, LICH_CHINH_SACH } from '../config/holdem.js';

const luat = luatCua(HOLDEM_BALANCE_VERSION);
const tc = tuyChonSinhMap(luat);
const N = Number(process.env.N ?? 20000);

function do1(size: number) {
  let hls2 = 0, hls2SauGiam = 0, o1Giam = 0, sk2 = 0, epDuoiHls = 0;
  let telegraphTuyen = 0, tailEp = 0;
  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, size, tc);
    const o1 = m.o[0]!, o2 = m.o[1]!;
    if (o1.kind === 'giai_doan' && o1.giai_doan === 'giam') o1Giam += 1;
    if (o2.kind === 'su_kien') {
      sk2 += 1;
      if (o2.su_kien === 'ha_lai_suat') {
        hls2 += 1;
        if (o1.kind === 'giai_doan' && o1.giai_doan === 'giam') hls2SauGiam += 1;
        // ô do epDuoi ép mang face_prior_bp = TELEGRAPH_TIN_CAY_BP và boi_canh noi_chuoi
        const t = m.trang_thai?.[1] as { face_prior_bp?: number } | undefined;
        if (t && t.face_prior_bp === 7500) epDuoiHls += 1;
      }
    }
    for (let i = 0; i < size; i += 1) {
      const t = m.trang_thai?.[i] as { ngoai_lich?: boolean; tail_face?: string | null } | undefined;
      if (t?.ngoai_lich) telegraphTuyen += 1;
      if (t?.tail_face) tailEp += 1;
    }
  }
  return { hls2, hls2SauGiam, o1Giam, sk2, epDuoiHls, telegraphTuyen, tailEp };
}

for (const size of [8, 12, 16]) {
  const a = do1(size);
  console.log(`\n=== MAP ${size} (N=${N}) — HA_NGOAI_LICH_BP = ${LICH_CHINH_SACH.HA_NGOAI_LICH_BP} ===`);
  console.log(`ô1 = 'giam'            : ${(100 * a.o1Giam / N).toFixed(2)}%`);
  console.log(`ô2 = ha_lai_suat       : ${a.hls2} (${(100 * a.hls2 / N).toFixed(2)}%)`);
  console.log(`  · trong đó ô1='giam' : ${a.hls2SauGiam} (${a.hls2 ? (100 * a.hls2SauGiam / a.hls2).toFixed(1) : '-'}% — nhánh ×2 SU_KIEN_THEO_GIAI_DOAN)`);
  console.log(`  · mang prior 7500 (dấu epDuoi): ${a.epDuoiHls}`);
  console.log(`ô mang cờ ngoai_lich (điềm TUYÊN)/trận : ${(a.telegraphTuyen / N).toFixed(3)}`);
  console.log(`ô mang tail_face (mặt đuôi)/trận       : ${(a.tailEp / N).toFixed(3)}`);
}
