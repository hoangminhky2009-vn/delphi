/**
 * CHỌN NỘI DUNG Ô TÀI CHÍNH CỦA HUB — tệp LÁ, không nhập PFM: Hub (gói chính) chỉ cần biết ba chế độ và đọc/ghi lựa chọn,
 * còn phép tính nằm ở `hub_tai_chinh.ts` (đi cùng chunk nạp trễ của ô). Lựa chọn là tiện nghi mỗi máy, không phải dữ liệu.
 */
export const CHE_DO_O_TAI_CHINH = ['chi_hom_nay', 'hu_sao', 'tien_toi_ngay'] as const;
export type CheDoOTaiChinh = (typeof CHE_DO_O_TAI_CHINH)[number];

export const KHOA_O_TAI_CHINH = 'hub_o_tai_chinh';

export function docCheDo(): CheDoOTaiChinh | null {
  try {
    const v = localStorage.getItem(KHOA_O_TAI_CHINH);
    return (CHE_DO_O_TAI_CHINH as readonly string[]).includes(v ?? '') ? (v as CheDoOTaiChinh) : null;
  } catch {
    return null;
  }
}

export function ghiCheDo(c: CheDoOTaiChinh): void {
  try {
    localStorage.setItem(KHOA_O_TAI_CHINH, c);
  } catch { /* chế độ riêng tư chặn lưu trữ — chấp nhận quay về mặc định ở lần mở sau */ }
}
