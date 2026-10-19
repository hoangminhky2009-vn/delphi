import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION, LAI_SUAT_NEN, LICH_CHINH_SACH } from '../config/holdem.js';
const tc = tuyChonSinhMap(luatCua(HOLDEM_BALANCE_VERSION));
const N = Number(process.env.N ?? 40000);
console.log('LICH O_THEO_MAP =', JSON.stringify((LICH_CHINH_SACH as any).O_THEO_MAP));
console.log('HA_NGOAI_LICH_BP =', LICH_CHINH_SACH.HA_NGOAI_LICH_BP, '\n');
for (const size of [8, 12]) {
  let o2sk = 0, khac400 = 0, khac400_khongPhaiLaiSuat = 0, o2OLich = 0;
  let hlsGiam = 0, hlsTong = 0;
  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, size, tc);
    const o2 = m.o[1]!;
    const t2 = m.trang_thai?.[1] as { lai_suat_diem?: number; o_lich?: boolean } | undefined;
    if (t2?.o_lich) o2OLich += 1;
    if (o2.kind !== 'su_kien') continue;
    o2sk += 1;
    const laLaiSuat = o2.su_kien === 'ha_lai_suat' || o2.su_kien === 'tang_lai_suat';
    if (t2?.lai_suat_diem !== LAI_SUAT_NEN.KHOI_DIEM) {
      khac400 += 1;
      if (!laLaiSuat) khac400_khongPhaiLaiSuat += 1;
    }
    if (o2.su_kien === 'ha_lai_suat') {
      hlsTong += 1;
      const o1 = m.o[0]!;
      if (o1.kind === 'giai_doan' && o1.giai_doan === 'giam') hlsGiam += 1;
    }
  }
  console.log(`MAP ${size}: ô2 sự kiện ${o2sk} · ô2 mang cờ o_lich ${o2OLich}`);
  console.log(`  lai_suat_diem[ô2] ≠ 400 : ${khac400} (${(100*khac400/o2sk).toFixed(2)}% ô2-sự-kiện)`);
  console.log(`    · trong đó ô2 KHÔNG phải lá lãi suất: ${khac400_khongPhaiLaiSuat}`);
  console.log(`  "60,7%" = ô2-hls có ô1='giam' / tổng ô2-hls = ${hlsGiam}/${hlsTong} = ${(100*hlsGiam/hlsTong).toFixed(1)}%\n`);
}
