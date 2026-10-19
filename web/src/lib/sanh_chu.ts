/**
 * CHỮ CỦA SẢNH + MÀN KẾT ALPHA DRAFT (bento tầng không gian) — MỘT nguồn (D26: server trả ID + số, chữ ở client; A11.5: không
 * chép chữ ở hai nơi). SPEC `docs/spec/alpha-draft-tang-khong-gian.md`, demo CHỐT `docs/ui-ux/demo/alpha-draft-tang-khong-gian.html`.
 *
 * ⚠ KHÔNG CHÉP NHÃN CỦA DEMO KHI LUẬT ĐỔI (SPEC mục 6, founder 11/10): khẩu vị rủi ro đã bị xoá khỏi game; số ô / số ghế đọc từ
 *   CATALOG của máy chủ (luật mặc định đang chạy), không gõ "14 ô · 4–8 ghế" ở đây. Chỗ nào cần con số của luật thì nhận qua tham số.
 * ⚠ A10: mô tả được, gợi ý có điều kiện, không kê đơn — không câu nào ở đây bảo người chơi mua/bán thứ gì.
 */

/** Số người thật tối thiểu để một bàn XẾP HẠNG mở (founder 11/10). Chữ hiển thị; CỔNG thật ở máy chủ (cửa sổ ghép bàn). */
export const NGUOI_THAT_TOI_THIEU_XEP_HANG = 4;

export const CHU_SANH = {
  /** Đầu sảnh. */
  phu: 'MÙA BETA · ĐỌC CHỢ, DỰNG DANH MỤC',
  bachKhoa: 'Bách khoa',

  /** Ô chính — thử thách hôm nay. */
  thuThach: 'THỬ THÁCH HÔM NAY',
  caNuoc: 'cả nước cùng một bàn',
  vaoBanHomNay: '▶ VÀO BÀN HÔM NAY',
  choiTiepHomNay: '▶ CHƠI TIẾP BÀN HÔM NAY',
  dangHoi: 'đang hỏi…',
  chuaDoc: 'chưa đọc được thử thách hôm nay',
  /** Ô chính — hôm nay xong (phân vị đến từ `cauPhanVi`, một nguồn với màn kết). */
  daXong: 'ĐÃ XONG',
  banMoi: 'bàn mới mở lúc 00:00',
  /** Ô chính — bàn đang dở. */
  banDo: 'BÀN ĐANG DỞ',
  choiTiep: '▶ CHƠI TIẾP',

  /** Bốn ô chế độ (mặt ô: nhãn · tên · một dòng phụ). */
  may: 'ĐẤU VỚI MÁY',
  mayTen: 'TỰ DO',
  mayPhu: 'không tính điểm mùa',
  xepHang: 'XẾP HẠNG',
  xepHangTen: 'MÙA BETA',
  xepHangPhu: `cần ≥ ${NGUOI_THAT_TOI_THIEU_XEP_HANG} người thật`,
  ru: 'RỦ BẠN',
  ruTen: 'MÃ BÀN',
  ruPhu: 'tạo · hoặc nhập 5 ký tự',
  manTap: 'MÀN TẬP',
  manTapTen: 'HỌC',
  manTapPhu: 'bằng cách chơi',

  /** Lớp trượt. */
  vaoBan: '▶ VÀO BÀN',
  timTran: '▶ TÌM TRẬN',
  mayMoTa: 'Bàn tự do với đối thủ máy — thử chiến thuật thoải mái, không tính điểm mùa, thua không mất gì ngoài sĩ diện.',
  xepHangMoTa:
    `Tính điểm mùa. Bàn xếp hạng chỉ mở khi có ít nhất ${NGUOI_THAT_TOI_THIEU_XEP_HANG} người chơi thật; ghép thêm máy nhưng số máy luôn ít hơn số người.`,
  /** Mùa Beta hôm nay: chế độ xếp hạng vẫn là đấu máy tới khi hàng chờ người thật mở — nói thật, không hứa suông (D62). */
  xepHangHienTai: 'Hiện tại mùa Beta vẫn đấu máy (thắng có điểm, thua không tụt) — ghép người thật mở sau.',
  ruMoTa: 'Cùng một bàn, mỗi người một ghế — không cần online cùng lúc. Xong thì so xem ai đọc thị trường giỏi hơn.',
  coBan: 'CỠ BÀN',
  canDongYGhi: 'Cần đồng ý điều khoản để xếp hạng.',

  /** Lỗi + thử lại — nói rõ, không im, không số 0 giả (D62). */
  thuLai: '↻ THỬ LẠI',
  dangThuLai: 'đang thử lại…',

  /** Cuối khung. */
  canhBao: 'Bảng cân bằng chưa chốt — số liệu lúc này chỉ để thử cảm giác.',

  /** Đang dẫn vào bàn tập / đang hỏi máy chủ (không vẽ sảnh — D336). */
  dangMo: 'ĐANG MỞ ĐẤU TRƯỜNG…',
  dangDungTap: 'LẦN ĐẦU VÀO ĐẤU TRƯỜNG — ĐANG DỰNG BÀN TẬP…',
} as const;

export const CHU_KET = {
  /** Ô của mình + phong cách. */
  veSanh: '▶ VỀ SẢNH',
  hangPhongCach: 'PHONG CÁCH CẢ TRẬN',
  chay: 'CHÁY TÀI KHOẢN',
  dauTuDo: 'Đấu tự do · bàn có máy, không tính điểm',

  /** Bốn ô nhỏ → bốn lớp trượt. */
  lat: 'LẬT BÀI',
  ban: 'BẢN ĐỒ',
  khoe: 'KHOE',
  doi: 'ĐỘI',
  khoePhu: 'thẻ kết trận',
  doiPhu: 'dấu mốc',

  /** Lớp trượt. */
  layBai: 'LÁ ĐÃ CẦM',
  khongCamLa: 'không cầm lá nào — đứng ngoài cả trận',
  conLaiGhe: 'ghế còn lại',
  banDoTen: 'BẢN ĐỒ TRẬN',
  tinGia: 'TIN GIẢ',
  tinGiaNoi: 'tin trong map là bịa — giờ mới lộ.',
  theKetTran: 'THẺ KẾT TRẬN',
  theKetTranTag: 'một tấm để khoe',
  dauMocDoi: 'DẤU MỐC · ĐỘI',
  xemThe: 'XEM THẺ ›',

  /** Không tải được kết quả (mạng gián đoạn) — nói rõ + thử lại + đường về (cùng khuôn cũ, đưa vào một nguồn). */
  loiKetQua: 'Trận đã xong nhưng chưa tải được bảng kết quả — có vẻ mạng vừa gián đoạn.',
  dangTongKet: 'Đang tổng kết trận…',
} as const;
