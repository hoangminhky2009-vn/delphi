/**
 * CÁCH BẠN MẤT TIỀN (D352) — CỬA GOM, KHÔNG PHẢI MỤC MỚI.
 *
 * ─── VÌ SAO CÓ ───────────────────────────────────────────────────────────────
 * Teammate hỏi 19/09: *"Cơ chế rủi ro là như thế nào"*. Đối soát ra hai thứ:
 *  · Engine có ÍT NHẤT chín đường lấy tiền của người chơi, và **cả chín đều đã có mục** trong
 *    bách khoa — viết kỹ, có chuyện thật, có chuỗi vì-sao.
 *  · Nhưng chúng nằm rải **bốn nhóm** (`gia` · `ct` · `lai` · `rui`), và nhóm tên là "RỦI RO"
 *    thì chỉ có **2 trong 55 mục**. Nên người muốn hỏi đúng câu *"tôi mất tiền kiểu gì"* không
 *    có chỗ nào để bấm vào.
 *
 * ⚠⚠ VÌ SAO KHÔNG VIẾT CHÍN MỤC MỚI VÀO NHÓM `rui`: đó là dựng bản sao thứ hai của chín mục đã
 * có, và bản thứ hai SẼ trôi (A11.5/D61). Tệp này vì thế **chỉ chở id + một câu**, và câu ấy nói
 * đúng một việc mà mục gốc không nói: *nó lấy tiền của bạn bằng cách nào*. Mọi thứ còn lại —
 * định nghĩa, chuyện ngoài đời, số của bộ luật — ở lại mục gốc.
 *
 * ⚠ `id` phải là id CỦA MỘT MỤC CÓ THẬT. Gõ sai thì cửa này dẫn vào chỗ trống;
 * `web/tests/bach_khoa_mat_tien.test.ts` canh đúng điều đó.
 * ⚠ A10 — TẢ, KHÔNG KÊ ĐƠN: mỗi câu tả cơ chế lấy tiền, không câu nào bảo người chơi nên làm gì.
 * ⚠ KHÔNG gõ số của bộ luật vào đây (kieu.ts §"hai tầng chữ"): số nằm ở mục gốc, đọc từ catalog.
 */

export interface DuongMatTien {
  /** id của một mục CÓ THẬT trong `MUC_BACH_KHOA`. */
  id: string;
  /** Một câu: nó lấy tiền của bạn bằng cách nào. Không số, không lời khuyên. */
  cau: string;
}

/**
 * Thứ tự: theo mức độ NGƯỜI MỚI hay vấp, không theo nhóm.
 * Ba cái đầu là ba cái ăn tiền ngay ở vòng đầu tiên mà người chơi không thấy nó ăn.
 */
export const DUONG_MAT_TIEN: readonly DuongMatTien[] = [
  { id: 'truot_gia', cau: 'Lệnh càng to càng không khớp hết ở giá bạn đang nhìn — phần đuôi khớp ở giá xấu hơn.' },
  { id: 'chen_chuc', cau: 'Cả bàn cùng tranh một mã trong một vòng thì giá khớp lệch thêm cho tất cả.' },
  { id: 'thanh_khoan', cau: 'Mã ít người mua bán thì cùng một lệnh ấy đẩy giá đi xa hơn, và phần chênh đó là tiền của bạn.' },
  { id: 'lam_phat', cau: 'Tiền mặt ngồi im vẫn mua được ít dần đi; không làm gì cũng là một lựa chọn có giá.' },
  { id: 'don_bay', cau: 'Vay để đặt lớn hơn vốn mình có: lãi lỗ nhân lên đúng mức vay, và tiền vay ăn lãi theo thời gian giữ.' },   // D530 — v60: hết ×2 tầng vòng
  { id: 'goi_ky_quy', cau: 'Lỗ tới ngưỡng thì bên cho vay đòi thêm tiền ngay — không nạp thì bị bán cưỡng bức, không chờ bạn quyết định.' },   // D530 — v60: ký quỹ chỉ trong màn
  { id: 'ban_khong', cau: 'Đặt cược giá xuống: phần lãi có trần, còn phần lỗ thì không có đáy.' },
  { id: 'tiet_kiem', cau: 'Gửi sổ rồi rút trước hạn thì phần lãi đã tích mất sạch.' },
  { id: 'ban_thao', cau: 'Khi cả bàn cùng muốn thoát một lúc, giá rơi nhanh hơn chính cái tin gây ra nó.' },
  { id: 'khau_vi', cau: 'Dồn tiền vào mã biến động mạnh lúc đang thắng là tự nâng khẩu vị rủi ro: phóng to CẢ lãi lẫn lỗ.' },
];

/** Chữ của cửa — D26: chữ ở client. */
export const CHU_MAT_TIEN = {
  tieuDe: 'CÁCH BẠN MẤT TIỀN',
  dan: 'Mười đường chợ lấy tiền của bạn. Chạm một dòng để đọc kỹ.',
} as const;
