/**
 * CHỮ CỦA BÁO LỖI (SPEC `docs/spec/bao-loi-nguoi-choi.md` mục 7 — T9 thẻ báo trước · T10 bảng Báo lỗi).
 * ⚠ NGUYÊN VĂN founder duyệt 11/10 (cửa một chiều — A11.17): đổi một chữ ⇒ hỏi lại founder trước.
 */

/** T9 — thẻ báo trước, hiện một lần mỗi máy khi mở app bản mới. `<ngày>` ghép ở component. */
export const CHU_THE_DIEU_KHOAN = {
  tieuDe: 'ĐIỀU KHOẢN VỪA ĐỔI',
  than: 'Hai thứ mới. Khi app vỡ, máy bạn gửi về một mã lỗi không gắn với bạn (mã lỗi · tên màn · số bản). Và Hồ sơ có ô Báo lỗi — bạn gõ gì, cái đó tới tay người làm app.',
  xem: 'Xem chỗ đổi',
  daHieu: 'Đã hiểu',
  /** Đích của nút "Xem chỗ đổi" — mục Dữ liệu của trang điều khoản. */
  duongXem: '/dieu-khoan#du-lieu',
} as const;

/**
 * T10 — bảng ✉ BÁO LỖI trong Hồ sơ. Dòng "Gửi kèm" KHÔNG gõ sẵn ở đây: component ghép nó từ `TRUONG_GUI_KEM`
 * (`config/bao_loi.ts`) — cùng hằng dựng gói gửi, để chữ và hành vi không thể lệch (A11.5).
 */
export const CHU_BAO_LOI = {
  nut: '✉ BÁO LỖI',
  nhanO: 'Gặp lỗi gì, kể tụi mình nghe',
  goiY: 'Bấm gì · thấy gì · đáng lẽ phải thấy gì',
  nhanEmail: 'Email (không bắt buộc) — điền thì tụi mình trả lời',
  guiKem: 'Gửi kèm:',
  /** Nhãn từng thứ đi kèm, theo thứ tự `TRUONG_GUI_KEM`. `<…>` là giá trị điền lúc vẽ. */
  kem: { ban: 'bản', man: 'màn', ma_loi: 'mã lỗi', tai_khoan: 'mã tài khoản' },
  khongCo: 'không có',
  dongCuoi: 'Đừng dán mật khẩu hay số tài khoản vào đây.',
  gui: 'GỬI',
  dangGui: 'ĐANG GỬI…',
  daGuiDam: 'Đã gửi.',
  daGuiThan: 'Có điền email thì tụi mình trả lời trong vòng một tuần.',
  hetLuot: 'Hôm nay bạn gửi đủ 3 lượt rồi. Mai gửi tiếp, hoặc viết email ở cuối trang Điều khoản.',
  loiGui: 'Chưa gửi được — mạng chập chờn. Chữ vẫn còn trong ô, bấm GỬI lại nhé.',
} as const;
