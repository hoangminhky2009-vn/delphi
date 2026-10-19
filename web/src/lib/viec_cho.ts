/**
 * VIỆC ĐANG CHỜ Ở TAB MÙA — hàm THUẦN cho chấm báo trên BottomNav (founder
 * 22/08: *"cái phần lộ trình mùa / nhiệm vụ để ở đầu trang bất hợp lý về UI-UX
 * quá, bạn ko thể làm 1 phần riêng như phần nhiệm vụ ngày trong TFT sao?"*).
 *
 * Trang `/hanh-trinh` VỐN ĐÃ là "phần riêng" ấy — thứ sai là bản TÓM TẮT chình
 * ình ở đầu Hub, lặp đúng dữ liệu trang kia đã có (doc §XIX cấm duplicate data,
 * và chính comment đầu Hub.tsx trích luật đó khi gỡ Oracle Core hồi 25/07).
 * Gỡ khối ấy thì phải trả lại thứ nó làm được: BÁO có việc. TFT làm bằng một
 * chấm trên icon nhiệm vụ — ở đây tab MÙA đã có sẵn cơ chế chấm.
 *
 * Chấm khi có thứ NGƯỜI CHƠI BẤM MỘT CÁI LÀ XONG:
 *   · chưa điểm danh hôm nay (một cú bấm, có Q);
 *   · có mốc đã tới chặng mà chưa nhận.
 * KHÔNG chấm vì "còn việc tuần chưa xong" — việc tuần cần chơi, không cần bấm;
 * chấm ở đó thì nó sáng suốt tuần và người chơi học cách phớt lờ (đúng bài học
 * D93: chuông kêu vì chuyện không phải sự cố thì người ta thôi nghe chuông).
 */
import type { LoTrinhDTO } from '@/api/nhiem_vu';

export function coViecCho(d: LoTrinhDTO | undefined): boolean {
  if (d === undefined || !d.mua_mo) return false;
  if (!d.da_diem_danh_hom_nay) return true;
  return d.moc.some((m) => !m.da_nhan && m.chang_no <= d.chang);
}
