/**
 * MÁY ĐỌC BỘ LUẬT TỪNG LÁ (D399, cổng `luatLa`). Số + nguồn + lý lẽ ở `config/luat_la.ts`; ở đây chỉ có máy.
 *
 * Mọi hàm là hàm THUẦN trên chuỗi ô đã phát (`o`, chưa gồm ô đang rút) — không tiêu RNG, nên cắm vào `sinhMap`
 * không xê dịch một cú rút nào; tắt cổng là đúng bàn cũ từng bit.
 */
import { BANH_XE_MUA } from '../../config/banh_xe_mua.js';
import { TINH_CHAT_NEN, type GiaiDoanId, type SuKienId } from '../../config/holdem.js';
import { LUAT_LA, type BangChung, type HeQuaSaiLam, type LuatTin } from '../../config/luat_la.js';
import type { OThiTruong } from './map.js';

type Chuoi = readonly OThiTruong[];

/** Ô là TIN THẬT khớp một bằng chứng (id, hoặc nhóm `hoang_loan` theo `TINH_CHAT_NEN`). */
export function laTinThat(t: OThiTruong | undefined, ds: readonly BangChung[]): boolean {
  if (t === undefined || t.kind !== 'su_kien' || t.la_tin_gia) return false;
  return ds.includes(t.su_kien) || (ds.includes('hoang_loan') && TINH_CHAT_NEN[t.su_kien] === 'hoang_loan');
}

/** `n` ô cuối của chuỗi có một tin thật khớp `ds`. */
export function coTinThatGanDay(o: Chuoi, ds: readonly BangChung[], n: number): boolean {
  for (let k = o.length - 1; k >= Math.max(0, o.length - n); k -= 1) if (laTinThat(o[k], ds)) return true;
  return false;
}

const laPha = (t: OThiTruong | undefined, ds: readonly GiaiDoanId[]): boolean =>
  t !== undefined && t.kind === 'giai_doan' && ds.includes(t.giai_doan);

/** Chỉ số lá pha gần nhất có mặt thuộc `ds`, −1 nếu chưa có. */
function viTriPhaGanNhat(o: Chuoi, ds: readonly GiaiDoanId[]): number {
  for (let k = o.length - 1; k >= 0; k -= 1) if (laPha(o[k], ds)) return k;
  return -1;
}

/** PHỤC HỒI có ĐÁY: từ lá TĂNG/QUÁ NÓNG gần nhất có lá GIẢM hoặc tin khủng hoảng thật. */
export function coDay(o: Chuoi): boolean {
  const len = viTriPhaGanNhat(o, ['tang', 'bien_dong']);
  if (len < 0) return true;
  for (let k = len + 1; k < o.length; k += 1) {
    if (laPha(o[k], ['giam']) || laTinThat(o[k], LUAT_LA.DAY.TIN)) return true;
  }
  return false;
}

/**
 * QUÁ NÓNG có NHIỆT: đủ lá TĂNG/QUÁ NÓNG từ lá GIẢM/PHỤC HỒI gần nhất — `SO_LA`, hay `SO_LA_KHI_CO_TIN` nếu có
 * tiền rẻ/bong bóng/lạm phát thật gần đây.
 */
export function coNhiet(o: Chuoi): boolean {
  const N = LUAT_LA.NHIET;
  const xuong = viTriPhaGanNhat(o, ['giam', 'phuc_hoi']);
  if (xuong < 0) return true;
  let so = 0;
  for (let k = xuong + 1; k < o.length; k += 1) if (laPha(o[k], ['tang', 'bien_dong'])) so += 1;
  return so >= (coTinThatGanDay(o, N.TIN, N.TRONG_O) ? N.SO_LA_KHI_CO_TIN : N.SO_LA);
}

/** Ô liền trước là khủng hoảng TÀI CHÍNH thật (phá sản · sàn khoá rút tiền). */
export function sauKhungHoangTaiChinh(o: Chuoi): boolean {
  return laTinThat(o[o.length - 1], LUAT_LA.KHUNG_HOANG_TAI_CHINH);
}

/** Mặt lá pha `g` có được lật ngay sau chuỗi `o` không. GIẢM · ĐI NGANG không có tiền đề. */
export function matHopLe(g: GiaiDoanId, o: Chuoi): boolean {
  if ((g === 'tang' || g === 'bien_dong') && sauKhungHoangTaiChinh(o)) return false;
  if (g === 'phuc_hoi') return coDay(o);
  if (g === 'bien_dong') return coNhiet(o);
  return true;
}

/** Đi theo `THAY` tới mặt hợp lệ đầu tiên. GIẢM luôn hợp lệ nên chuỗi luôn dừng. */
function theoThay(g: GiaiDoanId, o: Chuoi): GiaiDoanId {
  let x = g;
  for (let k = 0; k < 5 && !matHopLe(x, o); k += 1) x = LUAT_LA.THAY[x] ?? 'giam';
  return matHopLe(x, o) ? x : 'giam';
}

/** Mặt cuối cho một cú rút của bánh xe (`laLech` = cú rút rơi vào mặt lệch của mùa). */
function chonMat(rut: GiaiDoanId, laLech: boolean, mua: GiaiDoanId, o: Chuoi): GiaiDoanId {
  if (matHopLe(rut, o)) return rut;
  if (laLech) {
    // Giữ đúng 20% nhiễu: mặt lệch khác của mùa trước, hết mới về mặt thật.
    for (const [id] of LUAT_LA.MAT_LECH[mua]) if (id !== rut && matHopLe(id, o)) return id;
    return theoThay(mua, o);
  }
  return theoThay(rut, o);
}

/**
 * Áp tiền đề lá pha lên cú rút `r` của `BanhXe.mat` (mùa `mua`). `prior` trả về là P(mặt cuối | ô pha) sau luật:
 * cộng xác suất của MỌI cú rút dẫn tới đúng mặt ấy (thống kê ghi log — game math không đọc).
 */
export function giaiMat(
  r: { mat: GiaiDoanId; prior: number }, mua: GiaiDoanId, o: Chuoi,
): { mat: GiaiDoanId; prior: number } {
  const mat = chonMat(r.mat, r.mat !== mua, mua, o);
  const troi = BANH_XE_MUA.TROI_BP;
  const ds = LUAT_LA.MAT_LECH[mua];
  const tong = ds.reduce((a, [, w]) => a + w, 0);
  let prior = chonMat(mua, false, mua, o) === mat ? troi : 0;
  for (const [id, w] of ds) {
    if (chonMat(id, true, mua, o) === mat) prior += Math.round(((10000 - troi) * w) / tong);
  }
  return { mat, prior };
}

/** Lãi suất đổi chiều so với lần đổi THẬT gần nhất mà ở giữa không có lý do. */
function daoChieuVoCo(id: 'tang_lai_suat' | 'ha_lai_suat', o: Chuoi): boolean {
  let k = o.length - 1;
  for (; k >= 0; k -= 1) if (laTinThat(o[k], ['tang_lai_suat', 'ha_lai_suat'])) break;
  if (k < 0) return false;
  const truoc = o[k]!;
  if (truoc.kind !== 'su_kien' || truoc.su_kien === id) return false;
  const r = LUAT_LA.DAO_CHIEU[id];
  let soTang = 0;
  for (let j = k + 1; j < o.length; j += 1) {
    const t = o[j]!;
    if (laTinThat(t, r.tin) || laPha(t, r.mat)) return false;
    if (laPha(t, ['tang'])) soTang += 1;
  }
  return !(r.so_la_tang > 0 && soTang >= r.so_la_tang);
}

/**
 * Lá TIN `id` có được rút (NGOÀI kỳ họp) khi mùa ẩn là `mua`, sau chuỗi `o` không. Sai ⇒ trọng số 0.
 * Áp cho lá được rút, trước cú tung thật/giả.
 */
export function tinHopLe(id: SuKienId, mua: GiaiDoanId, o: Chuoi, canSauKhung = false): boolean {
  if (canSauKhung && id === 'hack_san') return sauCuSoc(o);   // v57 (D470): thay luật mùa lành bằng luật mọi mùa
  const luat = (LUAT_LA.TIN as Partial<Record<SuKienId, LuatTin>>)[id];
  if (luat && luat.mua.includes(mua) && !coTinThatGanDay(o, luat.can, luat.trong_o)) return false;
  if ((id === 'tang_lai_suat' || id === 'ha_lai_suat') && daoChieuVoCo(id, o)) return false;
  return true;
}

/** Số lá GIẢM liên tiếp ở cuối chuỗi; lá TIN xen giữa không cắt (đóng băng chuỗi như `run_dai`), lá pha khác thì cắt. */
export function chuoiGiam(o: Chuoi): number {
  let n = 0;
  for (let k = o.length - 1; k >= 0; k -= 1) {
    const t = o[k]!;
    if (t.kind === 'su_kien') continue;
    if (t.giai_doan !== 'giam') break;
    n += 1;
  }
  return n;
}

/** v57 (D470) — CẠN THANH KHOẢN có ngòi: hoảng loạn thật trong `trong_o` ô gần nhất, hoặc chuỗi Giảm ≥ `CHUOI_GIAM`. */
export function sauCuSoc(o: Chuoi): boolean {
  const c = LUAT_LA.CAN_SAU_KHUNG;
  return coTinThatGanDay(o, c.can, c.trong_o) || chuoiGiam(o) >= c.CHUOI_GIAM;
}

/** Tiền rẻ thật gần đây mở lại lá BONG BÓNG ngay sau lá GIẢM (bảng cũ cấm). */
export function moCuaBongBongSauGiam(o: Chuoi): boolean {
  const c = LUAT_LA.BONG_BONG_SAU_GIAM_KHI_TIEN_RE;
  return coTinThatGanDay(o, c.TIN, c.TRONG_O);
}

/** Hướng lần đổi lãi suất THẬT gần nhất (kỳ họp hay ngoài lịch), `null` nếu chưa có — cho kỳ họp "quá tay". */
export function huongLaiSuatGanNhat(o: Chuoi): 'tang' | 'ha' | null {
  for (let k = o.length - 1; k >= 0; k -= 1) {
    if (laTinThat(o[k], ['tang_lai_suat'])) return 'tang';
    if (laTinThat(o[k], ['ha_lai_suat'])) return 'ha';
  }
  return null;
}

/** Kỳ họp đi NGƯỢC hàm phản ứng ⇒ hệ quả theo hướng thực; khớp hoặc chậm nhịp (GIỮ) ⇒ không. */
export function heQuaSaiLam(
  kyVong: 'tang' | 'ha' | 'giu', thuc: 'tang' | 'ha' | 'giu',
): HeQuaSaiLam | null {
  if (kyVong === 'ha' && thuc === 'tang') return LUAT_LA.SAI_LAM.HE_QUA.tang;
  if (kyVong === 'tang' && thuc === 'ha') return LUAT_LA.SAI_LAM.HE_QUA.ha;
  return null;
}
