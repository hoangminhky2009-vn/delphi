import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION, LAI_SUAT_NEN, dichLaiSuat, moiTruongTienTe } from '../config/holdem.js';

const ver = process.env.VER ?? HOLDEM_BALANCE_VERSION;
const luat = luatCua(ver);
const tc = tuyChonSinhMap(luat);
const N = Number(process.env.N ?? 20000);
console.log('ĐANG ĐO =', ver, '| mặc định repo =', HOLDEM_BALANCE_VERSION);
console.log('cờ laiSuatNen =', (tc as any).laiSuatNen, '| cờ đầy đủ:', JSON.stringify(tc));
console.log('KHOI_DIEM', LAI_SUAT_NEN.KHOI_DIEM, 'KY_HOP', LAI_SUAT_NEN.BUOC_KY_HOP,
  'NGOAI_LICH', LAI_SUAT_NEN.BUOC_NGOAI_LICH, 'ngưỡng', LAI_SUAT_NEN.NGUONG_THAP, '/', LAI_SUAT_NEN.NGUONG_CAO);

// ── A. LATTICE: hai bước có LUÔN cho cùng môi trường không? ────────────
let same = 0, diff = 0; const viDu: string[] = [];
for (let d = 0; d <= 1200; d += 25) {
  for (const h of ['ha', 'tang'] as const) {
    const a = moiTruongTienTe(dichLaiSuat(d, h, LAI_SUAT_NEN.BUOC_KY_HOP));
    const b = moiTruongTienTe(dichLaiSuat(d, h, LAI_SUAT_NEN.BUOC_NGOAI_LICH));
    if (a === b) same += 1; else { diff += 1; if (viDu.length < 6) viDu.push(`${d} ${h}: kỳhọp=${a} ngoàilịch=${b}`); }
  }
}
console.log(`\n=== A. LATTICE (mọi mức bội 25 trong [0,1200] × 2 hướng) ===`);
console.log(`giống nhau ${same} · KHÁC NHAU ${diff}  (tổng ${same + diff})`);
console.log('ví dụ khác:', viDu.join(' | '));
console.log('tại KHỞI ĐIỂM 400: ha → kỳhọp', moiTruongTienTe(325), '/ ngoàilịch', moiTruongTienTe(350),
  '| tang → kỳhọp', moiTruongTienTe(475), '/ ngoàilịch', moiTruongTienTe(450));

// ── B. ĐO TRÊN MAP THẬT ────────────────────────────────────────────────
const NG_INTENDED_THAP = LAI_SUAT_NEN.KHOI_DIEM - LAI_SUAT_NEN.BUOC_KY_HOP;   // 325
const NG_INTENDED_CAO = LAI_SUAT_NEN.KHOI_DIEM + LAI_SUAT_NEN.BUOC_KY_HOP;    // 475
const mtIntended = (d: number) => d <= NG_INTENDED_THAP ? 're' : d >= NG_INTENDED_CAO ? 'dat' : 'trung_tinh';

for (const size of [8, 12, 16]) {
  let o2hlsThat = 0, o2hlsThatRe = 0, o2MucLa400 = 0, o2ReNeuDungYDinh = 0;
  // toàn map: đếm cú LẬT môi trường do lá ngoài lịch vs do kỳ họp
  let latNgoaiLich = 0, latKyHop = 0, buocNgoaiLich = 0, buocKyHop = 0;
  let latNgoaiLichNeuYDinh = 0;
  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, size, tc);
    const tt: any[] = (m as any).trang_thai ?? (m as any).trangThai;
    let truoc = LAI_SUAT_NEN.KHOI_DIEM;
    for (let i = 0; i < size; i += 1) {
      const o: any = m.o[i]!; const t: any = tt[i];
      const muc = t?.lai_suat_diem;
      if (muc === undefined || muc === null) continue;
      if (muc !== truoc) {
        const laLich = t.o_lich === true || (m.o[i] as any)?.kind === 'giai_doan';
        const ngoai = o.kind === 'su_kien' && (o.su_kien === 'ha_lai_suat' || o.su_kien === 'tang_lai_suat');
        const doiMT = moiTruongTienTe(truoc) !== moiTruongTienTe(muc);
        const doiMTy = mtIntended(truoc) !== mtIntended(muc);
        if (ngoai) { buocNgoaiLich += 1; if (doiMT) latNgoaiLich += 1; if (doiMTy) latNgoaiLichNeuYDinh += 1; }
        else { buocKyHop += 1; if (doiMT) latKyHop += 1; }
      }
      if (i === 1 && o.kind === 'su_kien' && o.su_kien === 'ha_lai_suat' && !o.la_tin_gia) {
        o2hlsThat += 1;
        if (truoc === LAI_SUAT_NEN.KHOI_DIEM) o2MucLa400 += 1;
        if (moiTruongTienTe(muc) === 're') o2hlsThatRe += 1;
        if (mtIntended(muc) === 're') o2ReNeuDungYDinh += 1;
      }
      truoc = muc;
    }
  }
  const pc = (a: number, b: number) => b ? `${(100 * a / b).toFixed(1)}%` : '-';
  console.log(`\n=== B. MAP ${size} · N=${N} ===`);
  console.log(`ô2 = hạ lãi THẬT: ${o2hlsThat} (mức trước là 400 ở ${pc(o2MucLa400, o2hlsThat)})`);
  console.log(`   → môi trường 're' NGAY tại ô2: ${o2hlsThatRe}/${o2hlsThat} = ${pc(o2hlsThatRe, o2hlsThat)}`);
  console.log(`   → nếu ngưỡng = Ý ĐỊNH doc (${NG_INTENDED_THAP}/${NG_INTENDED_CAO}): ${o2ReNeuDungYDinh}/${o2hlsThat} = ${pc(o2ReNeuDungYDinh, o2hlsThat)}`);
  console.log(`TOÀN MAP · bước NGOÀI LỊCH ${buocNgoaiLich} → lật môi trường ${latNgoaiLich} (${pc(latNgoaiLich, buocNgoaiLich)})`);
  console.log(`            nếu dùng ngưỡng Ý ĐỊNH → lật ${latNgoaiLichNeuYDinh} (${pc(latNgoaiLichNeuYDinh, buocNgoaiLich)})`);
  console.log(`TOÀN MAP · bước KỲ HỌP    ${buocKyHop} → lật môi trường ${latKyHop} (${pc(latKyHop, buocKyHop)})`);
}
