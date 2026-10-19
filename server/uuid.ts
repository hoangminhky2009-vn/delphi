/**
 * HÌNH DẠNG UUID — MỘT NGUỒN CHO CẢ REPO.
 *
 * Mọi cột id của ta là kiểu `uuid`. Đưa thẳng một chuỗi SAI HÌNH DẠNG vào
 * `WHERE id = $1` thì Postgres KHÔNG trả 0 dòng — nó NÉM `22P02` ("invalid
 * input syntax for type uuid"). Cú ném đó không ai bắt ⇒ 500, trong khi câu
 * trả lời đúng với người dùng là 404: "id sai định dạng" và "id không tồn
 * tại" là CÙNG MỘT câu trả lời — cả hai đều là "không có thứ đó".
 *
 * ⚠ Từ D93 (16/08) nó còn là chuyện HẠN MỨC, không chỉ chuyện đúng mã lỗi:
 * Sentry đã cắm điện trên prod nên mỗi cú 500 là một event, mà free tier chỉ
 * 5.000 error/tháng — ngập chuông là hỏng đúng cái vừa lắp để phát hiện mọi
 * thứ khác.
 *
 * ⚠⚠ NHƯNG ĐỪNG CHÉP LẠI CÂU "MỘT CON QUÉT URL BỪA ĐỦ ĐỐT HẠN MỨC" — ĐO
 * 16/08 TRÊN PROD THÌ NÓ SAI: **mọi** route `:id` đều nằm sau `requireAuth`,
 * và cả bốn cụm (holdem · markets · markets/pool · admin) trả **401** cho
 * request không có phiên. Kẻ quét vô danh KHÔNG BAO GIỜ chạm tới bộ parse
 * uuid. Muốn ra 500 thì phải CÓ PHIÊN HỢP LỆ.
 *
 * Nên lý do thật của phép kiểm này, xếp theo sức nặng:
 *   1. Người ĐANG ĐĂNG NHẬP mở một link cũ/gõ nhầm phải thấy "không thấy trận",
 *      không phải "lỗi phía máy chủ" — 500 ở đây đổ lỗi cho ta việc họ gõ sai.
 *   2. Một chuông báo cháy kêu vì chuyện KHÔNG PHẢI SỰ CỐ thì người ta học cách
 *      phớt lờ nó; đó mới là cách hỏng đắt nhất của D93.
 *   3. Hạn mức: vẫn thật, nhưng đòi một phiên hợp lệ (một client hỏng lặp vô
 *      hạn, hoặc người dùng thật) — nhỏ hơn hẳn "ai đó quét cổng".
 *
 * ⚠ Vì sao là file riêng chứ không phải hằng số thứ năm: trước hôm nay hằng
 * này được CHÉP RIÊNG ở bốn file (`admin`, `admin_keo`, `admin_thongke`,
 * `markets`) và THIẾU HẲN ở `holdem_api`. Đúng lớp lỗi D61 — bản sao thứ hai
 * là bản sẽ trôi, và ở đây chỗ thủng chính là chỗ QUÊN CHÉP. Thêm bản sao thứ
 * năm là dựng lại đúng cái bẫy vừa bước vào.
 */

/** Hình dạng UUID (không phân biệt hoa/thường). Dùng qua `laUuid` là chính. */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `true` khi `s` là chuỗi đúng hình dạng UUID — an toàn để đưa vào cột `uuid`.
 *
 * Nhận `unknown` có chủ ý: id đến từ URL param, body JSON, query string — thứ
 * nằm ngoài tầm kiểm soát. Một cửa duy nhất lo cả "có phải chuỗi không" lẫn
 * "có đúng hình dạng không" thì không còn chỗ nào quên một nửa.
 */
export function laUuid(s: unknown): s is string {
  return typeof s === 'string' && UUID_RE.test(s);
}
