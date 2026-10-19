/**
 * PHẢN BIỆN ĐỘC LẬP — claim "cú hạ lãi ở ô2 KHOÁ môi trường tiền tệ 90–94%".
 *
 * Tái lập con số VÀ đo cái claim KHÔNG có: ĐỐI CHỨNG (baseline). Một tỷ lệ
 * điều kiện mà không có tỷ lệ nền thì không nói được cú hạ có "khoá" gì không.
 * Đo trên BỘ LUẬT MẶC ĐỊNH qua luatCua + tuyChonSinhMap (bẫy D83/D127/D152/D169).
 */
import { sinhMap } from '../server/holdem/map.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { luatCua, HOLDEM_BALANCE_VERSION, moiTruongTienTe, LAI_SUAT_NEN } from '../config/holdem.js';

const VER = process.env.VER ?? HOLDEM_BALANCE_VERSION;
const tc = tuyChonSinhMap(luatCua(VER));
const N = Number(process.env.N ?? 60000);
console.log(`phiên bản ĐANG ĐO = ${VER} (mặc định repo = ${HOLDEM_BALANCE_VERSION}) · N=${N}`);
console.log('cờ map:', JSON.stringify(tc));
console.log(`ngưỡng: <=${LAI_SUAT_NEN.NGUONG_THAP} rẻ · >=${LAI_SUAT_NEN.NGUONG_CAO} đắt · khởi điểm ${LAI_SUAT_NEN.KHOI_DIEM}`);
console.log(`bước: kỳ họp ${LAI_SUAT_NEN.BUOC_KY_HOP} · ngoài lịch ${LAI_SUAT_NEN.BUOC_NGOAI_LICH}`);

type Acc = { n: number; tuO2: number; tuO3: number };
const moi = (): Acc => ({ n: 0, tuO2: 0, tuO3: 0 });
const pct = (x: number, d: number) => d ? (100 * x / d).toFixed(1) + '%' : '-';

for (const size of [8, 12, 16]) {
  const nhom: Record<string, Acc> = {
    'TẤT CẢ (nền)': moi(),
    'ô2 = HẠ lãi THẬT': moi(),
    'ô2 = TĂNG lãi THẬT': moi(),
    'ô2 = lãi suất GIẢ': moi(),
    'ô2 = sự kiện KHÁC': moi(),
    'ô2 = ô giai đoạn': moi(),
  };
  let o1LaSuKien = 0;
  let o1KhongTrungTinh = 0;
  // "khoá" nghĩa là gì: sau cú hạ ở ô2, bao nhiêu trận CÓ ÍT NHẤT MỘT ô quay
  // về trung_tinh, và quay về ở ô thứ mấy.
  let haQuayVe = 0; let haTong = 0; const oQuayVe: number[] = [];

  for (let s = 0; s < N; s += 1) {
    const m = sinhMap(s, size, tc);
    const o1 = m.o[0]!; const o2 = m.o[1]!;
    if (o1.kind === 'su_kien') o1LaSuKien += 1;
    if (moiTruongTienTe(m.trang_thai![0]!.lai_suat_diem) !== 'trung_tinh') o1KhongTrungTinh += 1;

    // cửa sổ "phần còn lại": ô2..ôN (đúng mẫu số claim: size-1 ô)
    let c2 = 0;
    for (let i = 1; i < size; i += 1) {
      if (moiTruongTienTe(m.trang_thai![i]!.lai_suat_diem) !== 'trung_tinh') c2 += 1;
    }
    // cửa sổ KHÔNG kể ô2 (ô sinh ra cú hạ): ô3..ôN (size-2 ô)
    let c3 = 0;
    for (let i = 2; i < size; i += 1) {
      if (moiTruongTienTe(m.trang_thai![i]!.lai_suat_diem) !== 'trung_tinh') c3 += 1;
    }

    let key = 'ô2 = ô giai đoạn';
    if (o2.kind === 'su_kien') {
      const laLai = o2.su_kien === 'ha_lai_suat' || o2.su_kien === 'tang_lai_suat';
      if (laLai && o2.la_tin_gia) key = 'ô2 = lãi suất GIẢ';
      else if (o2.su_kien === 'ha_lai_suat') key = 'ô2 = HẠ lãi THẬT';
      else if (o2.su_kien === 'tang_lai_suat') key = 'ô2 = TĂNG lãi THẬT';
      else key = 'ô2 = sự kiện KHÁC';
    }
    for (const k of [key, 'TẤT CẢ (nền)']) {
      const a = nhom[k]!;
      a.n += 1; a.tuO2 += c2; a.tuO3 += c3;
    }

    if (key === 'ô2 = HẠ lãi THẬT') {
      haTong += 1;
      let ve = -1;
      for (let i = 2; i < size; i += 1) {
        if (moiTruongTienTe(m.trang_thai![i]!.lai_suat_diem) === 'trung_tinh') { ve = i + 1; break; }
      }
      if (ve > 0) { haQuayVe += 1; oQuayVe.push(ve); }
    }
  }

  console.log(`\n════ MAP ${size} ════  (ô1 là sự kiện: ${o1LaSuKien} · ô1 môi trường≠trung tính: ${o1KhongTrungTinh})`);
  console.log('nhóm'.padEnd(22), 'n'.padStart(7), '  %trận', ' ô2..ôN(/'+(size-1)+')', '  ô3..ôN(/'+(size-2)+')');
  for (const [k, a] of Object.entries(nhom)) {
    if (!a.n) { console.log(k.padEnd(22), '0'); continue; }
    const m2 = a.tuO2 / a.n, m3 = a.tuO3 / a.n;
    console.log(k.padEnd(22), String(a.n).padStart(7),
      pct(a.n, N).padStart(7),
      `  ${m2.toFixed(2)}/${size - 1} = ${pct(m2, size - 1)}`.padEnd(22),
      `${m3.toFixed(2)}/${size - 2} = ${pct(m3, size - 2)}`);
  }
  const tb = oQuayVe.length ? (oQuayVe.reduce((x, y) => x + y, 0) / oQuayVe.length).toFixed(1) : '-';
  console.log(`sau HẠ ở ô2: ${haQuayVe}/${haTong} trận (${pct(haQuayVe, haTong)}) CÓ quay về trung tính; ô đầu tiên quay về TB = ${tb}`);
}
