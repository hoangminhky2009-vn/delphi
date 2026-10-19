/**
 * PFM — GỢI ĐIỀU KIỆN LUẬT TỪ CÂU 6 CỦA PHỎNG VẤN.
 *
 * Founder 08/09: *"do người dùng lười nên mấy phần đó chi tiết và thuận tiện vào
 * nhé, user chỉ cần sửa 1 tý là được"*. Đây là chỗ làm việc đó cho màn CAM KẾT:
 * câu 6 (`nhip` — "lúc nào bạn dễ tiêu quá tay") đã hỏi gần đúng thứ mà điều
 * kiện luật cần biết, nên đừng bắt họ trả lời lại lần nữa.
 *
 * ⚠⚠ GỢI Ý, KHÔNG PHẢI QUYẾT HỘ — và màn phải NÓI RA rằng nó được gợi (chip mang
 * cờ ⚑, cùng nếp "game điền sẵn" ở màn phỏng vấn). Lặng lẽ chọn hộ rồi để nó
 * trông như lựa chọn của người dùng là đúng thứ ranh đỏ mà demo dựng lên để tránh.
 *
 * ⚠ CHỈ MỘT ánh xạ là CHẮC — 'ngay sau khi tiền về' ↦ `tien_vua_ve`, hai vế nói
 * đúng một chuyện. Ba nhãn còn lại là SUY, nên:
 *   · chúng chỉ được dùng làm gợi ý ban đầu, không bao giờ ghi thẳng vào luật;
 *   · nhiều nhãn cho ra nhiều điều kiện khác nhau ⇒ **trả `null`**, để màn dùng
 *     mặc định trung tính thay vì bốc một cái. Cùng luật với `nguonThuTuNhan`
 *     (`pfm/phong_van.ts`): thà trống còn hơn đoán.
 */
import type { MaDieuKien } from './luat.js';

/**
 * Nhãn câu nhịp → điều kiện luật. Khoá là NHÃN người đọc, đúng như hồ sơ lưu.
 *
 * ⚠⚠ HAI KHOÁ CHO CÙNG MỘT Ý, CỐ Ý. Nhãn rút gọn còn `'lúc vừa có tiền'` ngày 21/09 (chip dài
 * quá 18 ký tự thì tràn ngang thành mảng xám — founder kêu khó đọc). Nhưng nhãn này KHÔNG phải
 * chữ hiển thị thuần: nó là KHOÁ TRA BẢNG, và **máy người dùng cũ đã lưu chuỗi cũ** trong
 * `hoSo.nhip`. Xoá khoá cũ đi thì người đã trả lời trước 21/09 mất gợi ý cam kết — im lặng,
 * không lỗi nào bắn ra, và chỉ hỏng với ĐÚNG lứa ấy nên càng khó thấy.
 * Giữ cả hai là rẻ hơn viết migration cho dữ liệu nằm rải trên máy người dùng.
 * ⚠ Cùng ca với `MA_THEO_NHIP` ở `chan_dung.ts` — sửa một bên phải sửa bên kia.
 */
const THEO_NHIP: Record<string, MaDieuKien> = {
  // Chắc chắn: cùng một hiện tượng, hai cách gọi.
  'lúc vừa có tiền': 'tien_vua_ve',
  'ngay sau khi tiền về': 'tien_vua_ve',   // ← DI SẢN: hồ sơ ghi trước 21/09
  'ngày tệ': 'ngay_chi_lon',
  'cuối tháng': 'ngay_chi_lon',
  'đi chơi cùng bạn': 'khoan_vuot_muc',
};

/**
 * D429 — câu 6 có NHẮC TỚI điều kiện `dk` không (một trong các nhãn đã chọn ánh xạ về nó). Khác `dieuKienGoiY`: hàm ấy
 * đòi MỘT điều kiện duy nhất để điền sẵn chip; khối định hướng chỉ cần biết người dùng có tự nói ra khoảnh khắc ấy không.
 * ⚠ Đọc cùng bảng `THEO_NHIP` — bảng thứ hai sẽ trôi (A11.5), và đúng hai khoá DI SẢN ở trên là thứ nó sẽ quên.
 */
export function nhipNhacToi(nhip: readonly string[], dk: MaDieuKien): boolean {
  return nhip.some((n) => THEO_NHIP[n] === dk);
}

/**
 * `null` = không gợi gì (chưa trả lời câu 6, nhãn lạ, hoặc nhiều nhãn cho ra
 * nhiều điều kiện khác nhau). Màn tự dùng mặc định trung tính.
 */
export function dieuKienGoiY(nhip: readonly string[]): MaDieuKien | null {
  const ma = new Set(
    nhip.map((n) => THEO_NHIP[n]).filter((x): x is MaDieuKien => x !== undefined),
  );
  return ma.size === 1 ? [...ma][0]! : null;
}
