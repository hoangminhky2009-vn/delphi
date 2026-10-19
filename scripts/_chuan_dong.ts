/**
 * CHUẨN HOÁ XUỐNG DÒNG TRƯỚC KHI SO TỆP SINH RA (D255).
 *
 * ⚠⚠ VÌ SAO CẦN MỘT TỆP RIÊNG CHO MỘT DÒNG CODE: repo có hai bộ canh "tệp này SINH RA,
 * đừng gõ tay" (`docs/api/danh-sach-route.md` và `docs/nhat-ky/00-muc-luc.md`), và **cả
 * hai đều so chuỗi THÔ**. Máy dev có `core.autocrlf=true` (mặc định Windows), nên:
 *   · tệp do bộ sinh ghi ra  → LF
 *   · tệp do `git checkout` → CRLF
 * ⇒ Trên MỌI bản clone Windows, hai bài test ấy đỏ ngay từ lệnh `npm test` đầu tiên, và
 * thông báo lỗi in ra **hai dòng trông y hệt nhau**. Người đọc không có cách nào đoán ra
 * lý do; cách duy nhất để "sửa" là chạy lại bộ sinh — tức mọi bản clone đều phải commit
 * một thay đổi rỗng.
 *
 * ⚠⚠ VÀ ĐÂY MỚI LÀ PHẦN ĐẮT: một bộ canh đỏ vì lý do KHÔNG LIÊN QUAN sẽ dạy người ta bỏ
 * qua nó. Sau vài lần, "hai bài đó lúc nào chả đỏ" thành phản xạ — và ngày tệp sinh ra
 * trôi thật thì nó trôi sau một cánh cửa đã bị bịt mắt từ lâu. Nhiễu ở một bộ canh không
 * phải phiền toái nhỏ, nó là cách bộ canh CHẾT.
 *
 * ⚠ Vì sao KHÔNG chữa bằng `.gitattributes eol=lf`: cách ấy đúng ở gốc nhưng viết lại
 * xuống dòng của MỌI tệp ở lần checkout kế tiếp — một cú churn toàn repo giữa lúc có hai
 * cửa sổ đang làm dở. Chuẩn hoá ở chỗ SO SÁNH thì chỉ chạm đúng phép so đang hỏng.
 *
 * ⚠ Đây là MỘT nguồn cho cả bốn chỗ so (2 script + 2 test) — chép bốn bản của cùng một
 * `.replace` là đúng ca A11.5/D61, và tiền lệ có sẵn: `scripts/demo_token.ts` (D238) đã
 * tự chuẩn hoá riêng vì gặp đúng chuyện này mà lúc đó tôi chỉ vá tại chỗ.
 */

/** Đưa CRLF (và CR lẻ) về LF. Dùng cho MỌI phép so "tệp trên đĩa == bản sinh ra". */
export function chuanDong(s: string): string {
  return s.replace(/\r\n?/g, '\n');
}

/** `true` khi hai bản khớp nhau BỎ QUA kiểu xuống dòng. */
export function khopBoQuaDong(a: string, b: string): boolean {
  return chuanDong(a) === chuanDong(b);
}
