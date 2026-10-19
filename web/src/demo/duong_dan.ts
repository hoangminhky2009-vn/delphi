/**
 * BẢN DEMO — đường dẫn lúc MỞ LẠI trang. Mỗi lần mở là một máy chủ mới với DB trống (đóng tab là mất — đúng lời hứa
 * "không lưu dữ liệu"), nên đường dẫn trỏ vào một trận / một bàn của lần mở trước không còn gì để hiện (soi 28/09: tải
 * lại khi đang trong trận ra màn trắng). Trả đường nên thay, hoặc `null` nếu giữ nguyên.
 */
export function duongKhiMoLai(duong: string): string | null {
  return /^\/arena\/(tran|ban)\//.test(duong) ? '/arena' : null;
}
