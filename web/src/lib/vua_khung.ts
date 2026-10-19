/**
 * D541 — BÀN ĐẤU VỪA MỘT KHUNG HÌNH (founder 06/10: *"màn chơi phải cố định trong 1 khung hình để user nhìn được bao quát bàn"* — ảnh bàn bị lướt
 * xuống, che nửa dải người chơi). Đo 06/10: ở 375 × 690 (điện thoại thật trừ thanh trình duyệt) bàn dài 757 px ⇒ phải cuộn.
 *
 * Cách: thu CẢ BÀN bằng CSS `zoom` (dàn lại bố cục, chữ vẫn nét — không phải `transform: scale` làm mờ pixel) theo đúng tỉ lệ chiều cao. Chỉ
 * thu, không phóng; sàn `ZOOM_TOI_THIEU` — dưới mức ấy chữ 9 px thành 7 px, đọc không nổi ⇒ thà cuộn (rất hiếm: màn < 570 px). Hàm THUẦN.
 */
export const ZOOM_TOI_THIEU = 0.75;

/** Hệ số thu cho nội dung cao `tuNhien` (px ở zoom 1) trong khung cao `khung`. Lệch < 1 % so với hệ số cũ ⇒ giữ cũ (không rung khi đo lại). */
export function heSoVuaKhung(tuNhien: number, khung: number, cu = 1): number {
  if (!(tuNhien > 0) || !(khung > 0)) return 1;
  const moi = Math.max(ZOOM_TOI_THIEU, Math.min(1, Math.floor((khung / tuNhien) * 1000) / 1000));
  return Math.abs(moi - cu) < 0.01 ? cu : moi;
}
