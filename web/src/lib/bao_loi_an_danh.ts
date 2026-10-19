/**
 * LỖI CLIENT ẨN DANH (SPEC `docs/spec/bao-loi-nguoi-choi.md`; điều khoản T4) — khi app VỠ (màn lỗi route hoặc ranh giới
 * gốc), máy gửi về đúng ba thứ `TRUONG_BAO_LOI_AN_DANH`: mã lỗi băm · mẫu route · số bản. Không gì khác.
 *
 * ⚠⚠ CỬA MỘT CHIỀU (A11.17) — HAI CỔNG Ở CHÍNH CHỖ GỬI, không nhờ chỗ gọi nhớ:
 *   1. Máy CHƯA bấm thẻ "Điều khoản vừa đổi" (T9) thì CHƯA gửi gì (founder 11/10 — báo trước cùng bản). Cờ là một khoá
 *      localStorage mang NGÀY của lần đổi điều khoản ấy; Safari riêng tư không lưu được ⇒ không có cờ ⇒ không gửi.
 *   2. Mỗi mã gửi tối đa MỘT lần mỗi phiên (bộ nhớ) — cú sập lặp trong vòng render không đốt hạn mức.
 * ⚠ `credentials: 'omit'`: không cookie đi kèm — máy chủ không có gì để lỡ gắn danh tính vào (T4: "không mã tài khoản").
 * ⚠ Khác `loi_client` của telemetry (chỉ ghi cho người đã bật nghiên cứu, vẫn gọi song song như cũ — A9 không đổi).
 * Không bao giờ ném: đây là chuông báo, hỏng thì app vẫn phải chạy.
 */
import { TRUONG_BAO_LOI_AN_DANH, type TruongBaoLoiAnDanh } from '@config/bao_loi';
import { BAN_PHAT_HANH } from '@config/phien_ban';
import { CAP_NHAT_LUC } from '@/content/dieuKhoan';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
export const URL_LOI_CLIENT = `${BASE}/api/v1/loi-client`;

/** Ngày của lần đổi điều khoản mà thẻ T9 báo — cũng là khoá của cờ "đã xem". */
export const NGAY_THE_DIEU_KHOAN = CAP_NHAT_LUC;
const KHOA_DA_XEM = `delphi.da_xem_the_dieu_khoan.${NGAY_THE_DIEU_KHOAN}`;

export function daXemTheDieuKhoan(): boolean {
  try {
    return localStorage.getItem(KHOA_DA_XEM) !== null;
  } catch {
    return false;
  }
}

/** Bấm nút nào trên thẻ cũng tính là đã xem (T9). */
export function danhDauDaXemTheDieuKhoan(): void {
  try {
    localStorage.setItem(KHOA_DA_XEM, new Date().toISOString());
  } catch {
    /* không lưu được ⇒ thẻ hiện lại lần sau, và lỗi ẩn danh không gửi — phía an toàn */
  }
}

const daGuiPhienNay = new Set<string>();

/** `ma` = `maLoi()` · `man` = `manCuaDuong()` (mẫu route, không id). */
export function baoLoiAnDanh(ma: string, man: string): void {
  try {
    if (!daXemTheDieuKhoan()) return;
    if (daGuiPhienNay.has(ma)) return;
    daGuiPhienNay.add(ma);
    const giaTri: Record<TruongBaoLoiAnDanh, string> = { ma, man, ban: BAN_PHAT_HANH };
    const goi: Record<string, string> = {};
    for (const k of TRUONG_BAO_LOI_AN_DANH) goi[k] = giaTri[k];
    void fetch(URL_LOI_CLIENT, {
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(goi),
    }).catch(() => { /* mất mạng — bỏ, không thử lại */ });
  } catch {
    /* im lặng — xem đầu file */
  }
}

/** CHỈ DÙNG TRONG TEST. */
export function _datLaiBaoLoiAnDanhChoTest(): void {
  daGuiPhienNay.clear();
  try { localStorage.removeItem(KHOA_DA_XEM); } catch { /* im lặng */ }
}
