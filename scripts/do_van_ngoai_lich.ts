import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION, LICH_CHINH_SACH } from '../config/holdem.js';

const luat = luatCua(HOLDEM_BALANCE_VERSION);
const tc = tuyChonSinhMap(luat);
const N = Number(process.env.N ?? 20000);
const van = LICH_CHINH_SACH as unknown as { HA_NGOAI_LICH_BP: number };

function do1(size: number) {
  let hls2 = 0, laiSuatNgoaiLich = 0, diemTuyen = 0, epDuoiO = 0, hlsMoiNoi = 0;
  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, size, tc);
    const o2 = m.o[1]!;
    if (o2.kind === 'su_kien' && o2.su_kien === 'ha_lai_suat') hls2 += 1;
    for (let i = 0; i < size; i += 1) {
      const o = m.o[i]!;
      const t = m.trang_thai?.[i] as { ngoai_lich?: boolean; o_lich?: boolean } | undefined;
      if (o.kind !== 'su_kien') continue;
      if (o.su_kien === 'ha_lai_suat') hlsMoiNoi += 1;
      if (!t?.o_lich && (o.su_kien === 'ha_lai_suat' || o.su_kien === 'tang_lai_suat')) {
        laiSuatNgoaiLich += 1;
      }
      if (t?.ngoai_lich) diemTuyen += 1;
    }
    // đếm ô bị điềm ép: prior = TELEGRAPH_TIN_CAY_BP (7500) và không phải ô lịch
    for (let i = 0; i < size; i += 1) {
      const t = m.trang_thai?.[i] as { face_prior_bp?: number; o_lich?: boolean } | undefined;
      if (t && !t.o_lich && t.face_prior_bp === 7500) epDuoiO += 1;
    }
  }
  return { hls2, laiSuatNgoaiLich, diemTuyen, epDuoiO, hlsMoiNoi };
}

for (const bp of [2000, 0, 10000]) {
  van.HA_NGOAI_LICH_BP = bp;
  console.log(`\n########## HA_NGOAI_LICH_BP = ${bp} ${bp === 2000 ? '(HIỆN HÀNH)' : bp === 0 ? '(khoá hẳn)' : '(bỏ chiết khấu)'} ##########`);
  for (const size of [8, 12, 16]) {
    const a = do1(size);
    console.log(`map ${size}: ô2=ha_lai_suat ${(100 * a.hls2 / N).toFixed(2)}% · ha_lai_suat mọi ô ${(a.hlsMoiNoi / N).toFixed(3)}/trận · lãi-suất NGOÀI lịch ${(a.laiSuatNgoaiLich / N).toFixed(3)}/trận · điềm TUYÊN ${(a.diemTuyen / N).toFixed(3)}/trận · ô bị điềm ÉP ${(a.epDuoiO / N).toFixed(3)}/trận`);
  }
}
van.HA_NGOAI_LICH_BP = 2000;
