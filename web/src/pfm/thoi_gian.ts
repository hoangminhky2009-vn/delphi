/**
 * PFM — ĐỒNG HỒ. **MODULE DUY NHẤT trong `web/src/pfm/` được phép đọc giờ.**
 *
 * ⚠⚠ VÌ SAO GOM VÀO MỘT CHỖ: mọi module nghiệp vụ PFM (`kho` · `so` · `hu` · `guong` ·
 * `dong_bo` · `ket`) cố ý **nhận** thời điểm từ người gọi chứ không tự lấy — và chúng
 * ghi rõ lý do trong chính chú thích của mình: một hàm tự `new Date()` thì mọi bài test
 * của nó phải giả lập đồng hồ toàn cục, và một bài quên giả lập sẽ **đỏ vào đúng một
 * ngày nào đó trong năm** rồi không ai dựng lại được.
 * ⇒ Kỷ luật ấy chỉ có giá trị nếu có ĐÚNG MỘT chỗ phá luật, và chỗ đó grep ra được.
 * Đây là chỗ đó. Thêm một `Date.now()` ở module khác là mở lại cái cửa vừa đóng.
 *
 * ⚠⚠ VÀ ĐÂY LÀ GIỜ CỦA MÁY, KHÔNG PHẢI GIỜ CỦA SERVER. Hai đồng hồ khác nhau, cố ý:
 *   · **Máy** trả lời *"khoản này thuộc NGÀY nào của tôi"* — thứ hoàn toàn cục bộ, sổ
 *     nằm trên máy, và người dùng đổi múi giờ thì ngày của họ đổi theo. Đúng.
 *   · **Server** trả lời *"hôm nay đã điểm danh chưa"*, *"tuần nào được niêm phong"*,
 *     *"kỳ nào còn mở"* — mọi thứ có TIỀN THƯỞNG hoặc có HẬU QUẢ MỘT CHIỀU đứng sau.
 *     Nó tính từ `users.mui_gio` và **không bao giờ nhận từ client** (K7).
 * ⇒ Máy sai giờ thì sổ của chính họ lệch một ngày — phiền, tự sửa được. Server tin
 * đồng hồ máy thì một người đổi giờ máy là in được token. Đó là cả lý do có hai đồng hồ.
 * ⚠ Nên KHÔNG dùng `homNay()` ở đây để đoán trước câu trả lời của server rồi hiển thị.
 * Hỏi `/me`; hiển thị thứ server nói.
 */

/** Mốc thời gian tuyệt đối (ISO, UTC) — dùng cho `suaLuc` của kho và mọi dấu vết. */
export function bayGio(): string {
  return new Date().toISOString();
}

/** `'YYYY-MM-DD'` theo giờ MÁY. Xem cảnh báo hai-đồng-hồ ở đầu tệp. */
export function homNay(): string {
  return ngayCua(new Date());
}

/** `'YYYY-MM'` theo giờ MÁY — mã lát tháng của kho. */
export function thangNay(): string {
  return homNay().slice(0, 7);
}

/**
 * THUẦN — `Date` → `'YYYY-MM-DD'` theo giờ ĐỊA PHƯƠNG của nó.
 *
 * ⚠ KHÔNG dùng `toISOString().slice(0,10)`: hàm ấy trả ngày theo **UTC**, nên với người
 * dùng ở UTC+7 thì từ 0h đến 7h sáng nó lùi lại một ngày. Đó là một lỗi lệch ngày chỉ
 * xuất hiện vào buổi sáng sớm — loại lỗi không ai tái hiện được lúc 3 giờ chiều.
 */
export function ngayCua(d: Date): string {
  const hai = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
}

/**
 * Ngày theo giờ MÁY của một mốc ISO (UTC) đã lưu — `Khoan.ngay` là ngày giờ máy, nên MỌI phép so một mốc `luc`/`taoLuc` với `Khoan.ngay` phải đi qua đây.
 * ⚠ KHÔNG `luc.slice(0, 10)`: đó là ngày UTC; chọn lúc 00:00–06:59 giờ VN thì lệch MỘT NGÀY (lỗi RÀ 12/10, "làm đúng k/n lần" đếm cả ngày hôm trước).
 * Mốc hỏng (không parse được) ⇒ lùi về 10 ký tự đầu, như cách cũ — không ném.
 */
export function ngayCuaLuc(luc: string): string {
  const d = new Date(luc);
  return Number.isNaN(d.getTime()) ? luc.slice(0, 10) : ngayCua(d);
}

/**
 * THUẦN — `'2026-01'` → `'2025-12'`. Số học trên chuỗi, KHÔNG đọc đồng hồ.
 * ⚠ Tháng 1 phải lùi cả năm; viết `m-1` rồi pad là ra `'2026-00'`, một mã tháng không
 * bao giờ khớp bản ghi nào và cột "so tháng trước" im lặng rỗng suốt tháng Giêng.
 * ⚠ DỜI TỪ `Guong.tsx` VỀ ĐÂY (D325): `goi_ky.ts` cần đúng phép này, và bản đầu của nó đã
 * CHÉP một bản thứ hai (`kyTruocCua`) trước khi tìm ra bản gốc nằm trong một màn — đúng
 * thứ A11.5 cấm. Module dữ liệu không được nhập từ màn, nên bản gốc phải xuống tầng này.
 */
export function thangTruocCua(thang: string): string {
  const y = Number(thang.slice(0, 4));
  const m = Number(thang.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * THUẦN — `'YYYY-MM-DD'` → `'dd/mm'`. Chuỗi vào đã là NGÀY LỊCH (không qua múi giờ nào), nên cắt
 * chuỗi chứ không `new Date()`: `new Date('2027-03-25')` là nửa đêm UTC, ở múi giờ âm lùi một ngày.
 * ⚠ DỜI TỪ `ChanDungPfm.tsx` VỀ ĐÂY (tệp 15 lát 1): màn HŨ và GƯƠNG cần đúng phép này — bản thứ
 *   hai trong một màn khác là thứ A11.5 cấm.
 */
export function ngayViet(ngay: string, coNam = false): string {
  return `${ngay.slice(8, 10)}/${ngay.slice(5, 7)}${coNam ? `/${ngay.slice(0, 4)}` : ''}`;
}

/** THUẦN — `'YYYY-MM-DD'` + `n` ngày (âm được). Số học UTC trên ngày lịch, không đọc đồng hồ. */
export function congNgay(ngay: string, n: number): string {
  return new Date(Date.parse(`${ngay}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** THUẦN — số ngày từ `a` tới `b` (`'YYYY-MM-DD'`, âm nếu `b` trước `a`). Số học UTC trên ngày lịch, như `congNgay`. */
export function soNgayGiua(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** THUẦN — `'2025-12'` → `'2026-01'`. Tháng 12 phải tiến cả năm (gương của `thangTruocCua`). */
export function thangSauCua(thang: string): string {
  const y = Number(thang.slice(0, 4));
  const m = Number(thang.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * THUẦN — số ngày của tháng `'YYYY-MM'` (28–31). `Date.UTC(y, m, 0)` là ngày cuối tháng `m`: vào lẫn ra đều là số
 * trần, không múi giờ nào tham gia.
 * ⚠ DỜI TỪ `Guong.tsx` VỀ ĐÂY (D426): biểu đồ (`bieu_do.ts`) cần đúng phép này, và module dữ liệu không nhập từ màn
 *   (cùng lý lẽ `thangTruocCua` ở D325). `Guong.tsx` xuất lại giữ tên cũ.
 */
export function soNgayTrongThang(thang: string): number {
  const y = Number(thang.slice(0, 4));
  const m = Number(thang.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * THUẦN — thứ trong tuần của một ngày lịch: **0 = thứ Hai … 6 = Chủ nhật** (tuần của người Việt bắt đầu từ thứ Hai;
 * `getUTCDay()` gốc lấy Chủ nhật làm 0). Số học UTC trên ngày lịch như `congNgay` — không đọc đồng hồ.
 */
export function thuTrongTuan(ngay: string): number {
  return (new Date(Date.parse(`${ngay}T00:00:00Z`)).getUTCDay() + 6) % 7;
}

/**
 * ID cục bộ cho một bản ghi/nhịp. Không bao giờ rời máy một mình — nó đi vào khoá hàng
 * đợi (`khoaMon` → `nhip:<id>`), và khoá ấy thành khoá chống trùng cấp món trên server.
 *
 * ⚠ HÌNH CHỮ LÀ MỘT GIAO ƯỚC, KHÔNG PHẢI THẨM MỸ. Server chặn `mon_id` bằng
 * `^[A-Za-z0-9_:-]{1,64}$` (và DB thêm `CHECK length BETWEEN 1 AND 64`), mà khoá là
 * `nhip:` + id ⇒ id phải nằm trong `[A-Za-z0-9_-]` và ngắn. Base36 dưới đây cho
 * `[0-9a-z]`, dài 20 ký tự — an toàn cả hai đầu.
 *
 * ⚠ TIỀN TỐ THỜI GIAN LÀ CÓ CHỦ ĐÍCH: id tự sắp theo thứ tự tạo, nên khi đọc một hàng
 * đợi hỏng ta biết ngay món nào có trước. Phần ngẫu nhiên phía sau mới là thứ chống
 * đụng — hai món tạo trong cùng một mili-giây vẫn khác nhau.
 */
export function sinhId(): string {
  const t = Date.now().toString(36).padStart(9, '0');
  return `${t}${nhieuNgauNhien(11)}`;
}

/** `n` ký tự base36 ngẫu nhiên, lấy từ nguồn ngẫu nhiên của trình duyệt. */
function nhieuNgauNhien(n: number): string {
  const byte = new Uint8Array(n);
  /*
   * ⚠ `crypto.getRandomValues` có ở mọi trình duyệt mục tiêu VÀ ở jsdom, nên không cần
   * nhánh dự phòng `Math.random`. Cố ý không viết nhánh ấy: một nhánh dự phòng không
   * bao giờ chạy là một nhánh không bao giờ được test, và nếu nó chạy thật thì ta có id
   * yếu mà không ai biết. Thiếu API thì phải NỔ, không phải âm thầm xuống cấp.
   */
  crypto.getRandomValues(byte);
  let ra = '';
  for (const b of byte) ra += (b % 36).toString(36);
  return ra;
}
