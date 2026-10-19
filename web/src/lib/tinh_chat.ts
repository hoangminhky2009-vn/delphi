/**
 * TÍNH CHẤT Ô SỰ KIỆN — icon + tên cho bốn ID server gửi (`o.tinh_chat`, D152/K1).
 *
 * Dời ra `lib/` ngày 12/09 (Q3): trước nằm trong `components/holdem/MarketMap.tsx`;
 * nay SỔ LIÊN HỆ đọc ở CẢ trang Tài chính (tường lửa D24 cấm trang đó import module
 * trong trận) nên bảng phải đứng ở chỗ hai bên cùng với tới được. MarketMap
 * re-export để mọi chỗ import cũ giữ nguyên. MỘT bảng, không bản sao (D61).
 *
 * Icon là ẨN DỤ chứ không phải mũi tên số (founder: *"Ko nên hiện rõ như thế"*):
 * khiên = lúc trú ẩn thắng · lửa = tiền đổ vào rủi ro · đồng xu = van thanh khoản
 * · tia = đánh chọn lọc từng mã. Cả bốn lưới ĐÃ CÓ trong PixelIcon — 0 nợ art
 * (A11.14). Icon nhận-từ-xa, TÊN gọi-đúng-tên (D123): title/aria luôn mang tên.
 */
import type { PixelIconName } from '@/components/ui/PixelIcon';

export const TC_ICON: Record<string, PixelIconName> = {
  van_tien: 'coin', hung_phan: 'flame', hoang_loan: 'shield', lech_ma: 'bolt',
};
export const TC_TEN: Record<string, string> = {
  van_tien: 'VAN TIỀN', hung_phan: 'HƯNG PHẤN',
  hoang_loan: 'HOẢNG LOẠN', lech_ma: 'LỆCH MÃ',
};
