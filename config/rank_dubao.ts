/**
 * HAI BẢNG TOP CỦA MẶT DỰ BÁO (Hệ B) — tham số.
 *
 * KHÔNG phải tham số kinh tế A4: không T/Q nào đổi chủ vì mấy số này, chúng chỉ
 * quyết định một dòng có được ĐẾM vào bảng hay không. Nhưng đổi số = đổi thứ hạng
 * của mọi người ⇒ phải bump `SCORING_VERSION` và ghi nhật ký quyết định.
 *
 * ⚠ L1: file này KHÔNG import gì từ `config/rank.ts`. Hệ B (dự báo, tiền T thật của
 *   app) và Hệ A (điểm Đấu trường) là HAI đại lượng; nối chúng vào nhau là mở lại
 *   đúng đường mà founder đã cắt ngày 17/07.
 */
export const SCORING_VERSION = 'dubao-top-v1';

export const DUBAO_TOP = {
  /** Cửa sổ bảng % — con số founder ở D32, KHÔNG đụng. */
  CUA_SO_KEO: 30,
  /**
   * Số kèo tối thiểu để LÊN bảng %.
   *
   * ⚠ NỢ CÓ NGÀY CHẾT (A8.9). Kèo vĩ mô là kèo THÁNG nên cửa sổ 30 kèo là hơn hai
   *   năm ⇒ mùa Beta bảng % trống trơn với TẤT CẢ mọi người. Beta đã được chấp nhận
   *   là méo (D31), nên hạ ngưỡng ở beta là đúng — nhưng phải gỡ.
   *   ĐIỀU KIỆN GỠ: khi ≥50% người trên bảng đạt n ≥ 12 thì bỏ `NGUONG_BETA` và
   *   dùng `NGUONG_CHUAN`.
   */
  NGUONG_BETA: 3,
  NGUONG_CHUAN: 12,
  /** Beta = true → dùng NGUONG_BETA. Tắt cùng lúc với việc gỡ nợ ở trên. */
  MUA_BETA: true,

  /** Số dòng LƯU trong snapshot (để tra phân vị của người ngoài top). */
  SO_DONG: 500,
  /** Số dòng HIỆN cho người xem — top-N chỉ cho người dẫn đầu (D32 mục 2). */
  TOP_N: 20,
} as const;

/** Ngưỡng đang có hiệu lực. Một chỗ đọc duy nhất, không rải if khắp code. */
export function nguongVaoBangPct(): number {
  return DUBAO_TOP.MUA_BETA ? DUBAO_TOP.NGUONG_BETA : DUBAO_TOP.NGUONG_CHUAN;
}
