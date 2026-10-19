/**
 * BÁO LỖI CỦA NGƯỜI CHƠI (SPEC `docs/spec/bao-loi-nguoi-choi.md` — nguồn của phần Báo lỗi; dựng đầu tiên ở SPEC chan-truoc-beta)
 * — một nguồn cho server (cổng) và web (ô nhập · gửi). Không phải tham số kinh tế (A8.2): chỉ là trần vận hành của một hộp thư;
 * đo lại sau 2 tuần (SPEC mục 6).
 */

/** Ô ✉ BÁO LỖI trong Hồ sơ — người chơi tự gửi. */
export const BAO_LOI = {
  /** Trần ký tự của một báo cáo — khớp CHECK ở migration 0079. */
  DO_DAI_TOI_DA: 1000,
  /** Mỗi người tối đa bấy nhiêu báo / 24 giờ (founder 11/10, SPEC bao-loi-nguoi-choi mục 6 — thay số 5 của D592). Chữ T10 "hết lượt" nói đúng số này. */
  TRAN_MOI_NGAY: 3,
  /** Trần ký tự ô email tuỳ chọn — khớp CHECK ở migration 0080. */
  EMAIL_TOI_DA: 254,
} as const;

/**
 * Thứ đi KÈM chữ người chơi gõ, đúng thứ tự dòng "Gửi kèm:" (điều khoản T5 · T10). Bảng Báo lỗi vẽ dòng ấy TỪ mảng này và gói
 * gửi lên dựng TỪ mảng này (A11.5 — không gõ tay hai lần). `tai_khoan` không đi trong thân request: máy chủ lấy từ phiên.
 */
export const TRUONG_GUI_KEM = ['ban', 'man', 'ma_loi', 'tai_khoan'] as const;
export type TruongGuiKem = (typeof TRUONG_GUI_KEM)[number];

/**
 * LỖI CLIENT ẨN DANH — đúng ba trường client gửi lên, theo đúng thứ tự đoạn điều khoản T4 kể ra
 * ("một mã lỗi · tên màn · số bản app"). ⚠ Thêm một trường ở đây mà không sửa điều khoản ⇒ bài canh
 * chữ ↔ hành vi đỏ (`web/tests/bao_loi_an_danh.test.tsx`) — cửa một chiều (A11.17).
 */
export const TRUONG_BAO_LOI_AN_DANH = ['ma', 'man', 'ban'] as const;
export type TruongBaoLoiAnDanh = (typeof TRUONG_BAO_LOI_AN_DANH)[number];

export const BAO_LOI_AN_DANH = {
  /** Trần toàn app mỗi ngày — giữ dưới hạn mức 5.000 sự kiện/tháng của Sentry free (`docs/deploy_gd0.md` Bước 7). */
  TRAN_TOAN_CUC_NGAY: 50,
  /** Trần mỗi IP mỗi ngày — một máy sập lặp không ăn hết trần toàn cục của người khác. */
  TRAN_MOI_IP_NGAY: 10,
  /** Cửa sổ đếm của hai trần trên (phút). */
  CUA_SO_PHUT: 24 * 60,
  /** Hình dạng số bản (`config/phien_ban.ts` BAN_PHAT_HANH, vd `0.0.65`). */
  MAU_BAN: /^\d{1,3}\.\d{1,3}\.\d{1,4}$/,
} as const;
