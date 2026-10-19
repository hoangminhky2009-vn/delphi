/**
 * HTML TĨNH CHO `dangerouslySetInnerHTML` (D438) — MỘT đối tượng cho mỗi chuỗi.
 *
 * React 19 so prop `dangerouslySetInnerHTML` theo ĐỐI TƯỢNG, không theo chuỗi `__html` như React 18: `{{ __html: s }}`
 * gõ tại chỗ là một đối tượng MỚI ở mỗi lần vẽ ⇒ React gán lại `innerHTML` ⇒ mọi `<svg>` bên trong bị THAY NÚT MỚI ở
 * mọi lần vẽ lại. Màn trận vẽ lại mỗi giây (đồng hồ vòng) nên hình của lá bài, ô bản đồ, thẻ trait… bị dựng lại liên tục,
 * và hoạt ảnh gắn trên chính cái svg ấy chạy lại từ đầu: tấm xem thẻ trait "nhảy hình liên tục" (founder 27/09 tối — đo
 * trên màn thật: hoạt ảnh `bat` của hình trong tấm chạy lại 7 lần trong 6 giây, 242 nút DOM bị thay).
 *
 * Nhớ một đối tượng cho mỗi chuỗi ⇒ cùng chuỗi = cùng đối tượng ⇒ React bỏ qua, svg giữ nguyên. Chuỗi ở mọi chỗ gọi là SVG
 * sinh từ lưới hằng / cấu hình avatar (hữu hạn); trần `TRAN` chỉ để một chuỗi lạ không làm bảng phình mãi.
 * ⚠ Bài canh `tests/html_tinh.test.tsx` cấm quay lại kiểu đối tượng gõ tại chỗ (hai ngoặc nhọn liền sau dấu bằng) ở `web/src`.
 */
const NHO = new Map<string, { __html: string }>();
const TRAN = 2000;

export function htmlTinh(html: string): { __html: string } {
  let o = NHO.get(html);
  if (o === undefined) {
    if (NHO.size >= TRAN) NHO.clear();
    o = { __html: html };
    NHO.set(html, o);
  }
  return o;
}
