/**
 * CHỮ CỦA HUB BENTO — một nguồn (D26: server trả ID + số, chữ ở client; A11.5: không chép chữ ở hai nơi).
 *
 * Mô tả / tagline / tên module KHÔNG gõ lại ở đây: chúng đã có ở `vocab.ts` (`DESC_*` · `TAGLINE_*` · `NAME_*`) và Hub
 * chỉ IMPORT. Tệp này giữ phần Hub tự có: nhãn ô, câu trạng thái, chữ nút. Chữ của banner đến từ BÁCH KHOA
 * (`lib/bach_khoa/`), không gõ ở đây.
 *
 * ⚠ A10: mô tả được, gợi ý có điều kiện, không kê đơn — không câu nào ở đây bảo người dùng mua/bán thứ gì.
 */

/** Tên mùa — một chỗ cho Hub (đầu sảnh · ô Mùa · lớp trượt) và trang Hành trình. */
export const NHAN_MUA = 'MÙA 0.0';

export const CHU_HUB = {
  /** Đầu sảnh. */
  khach: 'Khách',
  khachPhu: 'chỉ lưu trên máy này',
  viLabel: 'Ví token',
  dangTai: 'đang tải…',
  loiMe: 'Không tải được tài khoản',

  /** Ô Đấu trường. */
  vaoTran: 'VÀO TRẬN ▸',
  bannerHoi: 'BẠN CÓ BIẾT?',
  bannerDoc: 'ĐỌC ▸',
  bannerTayBai: 'Tay bài: Tăng, Thiên nga đen, Giảm',

  /** Ô Tài chính. */
  taiChinh: 'TÀI CHÍNH',
  chiHomNay: 'chi hôm nay',
  huUuTien: 'hũ ưu tiên',
  tienToiNgay: 'tiền đi tới ngày',
  chuaDuSo: 'chưa đủ sổ',
  canTaiKhoan: 'CẦN TÀI KHOẢN',
  ghiChiTieu: 'GHI CHI TIÊU',
  /** Cột dải 7 ngày: nhãn cột cuối. */
  nay: 'NAY',

  /** Ô Mùa. */
  viecTuan: 'việc tuần',
  diemDanh: '● ĐIỂM DANH',
  daDiemDanh: 'ĐÃ ĐIỂM DANH',
  muaChuaMo: 'CHƯA MỞ',

  /** Hai ô nhỏ. */
  predict: 'PREDICT',
  lab: 'LAB',
  labKhoa: 'Oracle Lab đang khoá',
  predictGiu: 'Mở Predict Market (giữ để xem là gì)',

  /** Khách. */
  dangKyGiu: '▶ ĐĂNG KÝ ĐỂ GIỮ TÀI KHOẢN',
  dangNhap: '▶ ĐĂNG NHẬP / ĐĂNG KÝ',
  mienTru: 'Token T không có giá trị thật · không mua bán · không quy đổi.',

  /** Lỗi + thử lại — nói rõ, không im, không số 0 giả (D62). */
  loiTai: 'KHÔNG TẢI ĐƯỢC',
  thuLai: '↻ THỬ LẠI',
  chamThuLai: 'chạm để thử lại',
  /** Chunk nạp trễ hỏng (mạng đứt giữa chừng) — vùng hỏng nói rõ + TẢI LẠI; phần còn lại của Hub vẫn sống. */
  taiLai: '↻ TẢI LẠI',
  chamDeXem: 'chạm để xem',
  dangThuLai: 'đang thử lại…',

  /** Lớp trượt. */
  dong: 'ĐÓNG',
  moTaiChinh: 'MỞ TÀI CHÍNH ▸',
  xemHanhTrinh: 'XEM HÀNH TRÌNH ▸',
  moCho: 'MỞ CHỢ ▸',
  moBachKhoa: 'MỞ BÁCH KHOA ▸',
  nhanDiemDanh: 'ĐIỂM DANH ●',
  dangDiemDanh: 'ĐANG ĐIỂM DANH…',
  chonONoiDung: 'HIỆN TRÊN Ô',
  ghiNhanh: 'GHI NHANH',
  chuaPhongVan: 'Làm phỏng vấn ngắn ở khu Tài chính trước, rồi ghi thu chi ngay tại đây.',
  khachTaiChinh: 'Cần tài khoản để ghi sổ. Đăng ký xong, sổ chi tiêu nằm trên chính máy của bạn.',
  muaMoTa: 'Việc tuần trả theo tuần: làm đủ là hết việc tuần này, cày thêm không có thêm.',
  muaTag: 'VIỆC TUẦN · MỐC · ĐIỂM DANH',
  labCho: 'Admin đang chạy thận, hãy quay lại sau.',
  /** Ô Tài chính KHOÁ trên web (SPEC chan-truoc-beta, `lib/pfm_mo.ts`) — câu đùa của founder, KHÔNG kèm nút nhận tiền nào. */
  taiChinhKhoa: 'Admin cần donate để mua database 😓',
  taiChinhKhoaNhan: 'Tài chính đang khoá',
  taiChinhKhoaMo: 'Sổ chi tiêu sẽ mở lại khi app có bản cài trên điện thoại. Dữ liệu cũ của bạn vẫn nằm yên — muốn xoá thì vào Hồ sơ → Dữ liệu của tôi.',
  /** Link nhỏ dưới ô Tài chính khoá ⇒ lớp trượt `RuotNhuCauPfm` (chỗ của SPEC khao-sat-nhu-cau-pfm). */
  nhuCauPfm: 'Bạn có nhu cầu quản lý tài chính cá nhân?',
  /** Bản xem trước PFM xoay vòng trên ô Tài chính khoá (founder 11/10) — tả tính năng ĐANG CÓ trong mã, không hứa ngày mở. */
  xemTruoc: 'XEM TRƯỚC',
  xemTruocSo: 'SỔ CHI TIÊU',
  xemTruocSoMo: 'Ghi thu chi tiền thật bằng vài chạm',
  xemTruocHu: 'CHIA HŨ',
  xemTruocHuMo: 'Chia tiền vào các hũ bạn tự đặt',
  xemTruocGuong: 'GƯƠNG',
  xemTruocGuongMo: 'Soi lại thói quen tiền của chính bạn',
  nhuCauPfmCho: 'Phần hỏi nhanh này chưa mở. Nó mở khi bạn đã chơi đủ 10 trận Alpha Draft — Oracle cần chừng đó để đoán bạn.',
} as const;

/** Ba cách ô Tài chính hiện — người chơi tự chọn trong lớp trượt (SPEC 11/10). */
export const CHU_CHE_DO_O_TAI_CHINH = {
  chi_hom_nay: 'CHI HÔM NAY',
  hu_sao: 'HŨ ƯU TIÊN',
  tien_toi_ngay: 'TIỀN TỚI NGÀY',
} as const;
