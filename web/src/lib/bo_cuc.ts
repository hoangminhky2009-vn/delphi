/**
 * BỐ CỤC MÀN HÌNH HIỆN TẠI — 'doc' (điện thoại) hay 'ngang' (PC / Discord desktop).
 *
 * ⚠ ĐÂY KHÔNG PHẢI TIỆN ÍCH GIAO DIỆN. Nó tồn tại để ghi vào `events`, vì hai bố
 * cục cho người chơi hai lượng thông tin khác nhau: màn ngang có shop đứng cạnh
 * bản đồ (thấy thẻ + map + đối thủ cùng lúc), điện thoại mở shop là che hết.
 * Không phân biệt được hai nhóm thì "người này đọc thị trường giỏi hơn" lẫn hẳn
 * với "người này nhìn thấy nhiều hơn" — và `events` append-only nên lẫn rồi là
 * lẫn vĩnh viễn (A3.3).
 *
 * ⚠ Đọc ĐÚNG NGƯỠNG mà CSS dùng (900px). Hai ngưỡng lệch nhau thì cờ nói một
 * đằng màn hình hiện một nẻo — hỏng im lặng, và chỉ lộ ra ở tầng phân tích nhiều
 * tháng sau. Đổi một chỗ thì phải đổi chỗ kia.
 */
export const NGUONG_NGANG_PX = 900;

export function boCucHienTai(): 'doc' | 'ngang' {
  try {
    return window.matchMedia(`(min-width: ${NGUONG_NGANG_PX}px)`).matches ? 'ngang' : 'doc';
  } catch {
    // Không hỏi được thì khai 'doc' — mặc định là thứ đa số người chơi đang dùng,
    // và đoán sai về phía phổ biến thì ít méo hơn đoán sai về phía hiếm.
    return 'doc';
  }
}
