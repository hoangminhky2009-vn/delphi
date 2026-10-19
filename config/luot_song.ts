/**
 * ═══ LƯỚT SÓNG MỚI — lệnh CHỐT LỜI TRONG Ô (D409, cổng `luotSongMoi`, khoá `balance-v55-build`) ═══════════════
 *
 * Founder 24/09: *"thực ra chẳng mấy ai sử dụng bảng điện tử"* ⇒ lá Lướt Sóng (bảng rẻ & sạch) gần như vô dụng;
 * 25/09: *"cơ chế lướt sóng cho khớp ngoài đời mà không bị trùng lõi khác"*.
 *
 * Ngoài đời "lướt sóng" = vào rồi RA trong con sóng, bán vào lúc giá bật chứ không ôm hết kỳ. Một ô = 6 tháng, giá
 * không đi thẳng: trong ô có ĐỈNH SÓNG cao hơn giá đóng ô. Lá cho phép đặt trước MỤC TIÊU chốt lời cho một phần vị
 * thế: nếu đỉnh sóng trong ô chạm mục tiêu, phần ấy được khớp ở mục tiêu thay vì giá đóng ô — ăn được cú rút lại
 * (Δ đóng < mục tiêu), nhưng ĐỂ LẠI TIỀN TRÊN BÀN khi ô chạy quá mục tiêu (Δ đóng > mục tiêu). Không chạm ⇒ không gì.
 *   · KHÔNG trùng: Mua Đuổi/Bắt Đáy là VÀO; Đòn Bẩy/Bán Khống là hình dạng phơi nhiễm; Chặn Lỗ (trait KỶ LUẬT) là RA ở
 *     mức LỖ; Lướt Sóng là RA ở mức LÃI trong ô — thứ buy-and-hold không có.
 *   · Dữ liệu: MỨC MỤC TIÊU người chơi đặt (bp) là số đo trực tiếp của ngưỡng chốt lời (chỉ số #4 "chốt non") — trước
 *     đây chỉ suy được từ cú bán vòng sau.
 *   · D67: chỉ đổi GIÁ của nước RA cho riêng ghế cầm lá; không đụng giá chợ, không đổi xác suất lá.
 *
 * ⚠ A8.2 — PLAYTEST-TUNE. Bảng CHỈ được đọc qua `dungChuoi` (engine) + API kiểm lệnh — không bản sao.
 */
export const LUOT_SONG_MOI = {
  /** Đỉnh sóng trong ô = max(Δ, 0) + |Δ| × u, u ~ U[0, DINH_THEM_TOI_DA_BP/10000) rút tất định theo (seed · vòng · mã). */
  DINH_THEM_TOI_DA_BP: 6000,
  /** Mức mục tiêu đặt được (bp giá của mã trong ô): bội của bước, trong [MIN, MAX]. */
  NGUONG_BUOC_BP: 100,
  NGUONG_MIN_BP: 200,
  NGUONG_MAX_BP: 3000,
  /** Phần vị thế bán ở mục tiêu — cùng thang chip của Shop. */
  PHAN_BAN_CHO_PHEP: [2500, 5000, 7500, 10000] as const,
  /** Tối đa bấy nhiêu lệnh chốt lời một vòng (mỗi mã một lệnh). */
  LENH_TOI_DA: 3,
} as const;
