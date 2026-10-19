/**
 * PFM — TỰ ĐIỂN CHỮ (D26 / A11.9): **mọi chuỗi tiếng Việt hiện cho người dùng ở một chỗ.**
 *
 * ⚠⚠ VÌ SAO MỘT CHỖ: luật D26 nói *"server trả ID + SỐ, chữ ở client"*. Nhưng nửa sau của
 * luật ấy chỉ có giá trị nếu client cũng có **một** chỗ — chữ rải khắp các màn thì bộ quét
 * A10 (`TU_KE_DON`) không quét hết, và một câu kê đơn lọt vào sẽ sống rất lâu.
 * ⇒ Ở đây là chỗ đó, và bài test quét TOÀN BỘ tệp này chứ không quét từng bảng.
 *
 * ⚠⚠ MỌI BẢNG DƯỚI ĐÂY KHAI KIỂU `Record<Ma…, string>` CHỨ KHÔNG PHẢI `Record<string,
 * string>`, và đó là phần quan trọng nhất của tệp: thiếu một thành viên enum là **lỗi
 * biên dịch**, không phải một ô trống hiện ra lúc chạy. Một nhãn thiếu ở UI trông giống
 * hệt một nhãn rỗng cố ý, nên nó sống sót qua mọi lần soi mắt.
 *
 * ⚠ NGOẠI LỆ CÓ CHỦ Ý: nội dung MẪU (hũ, luật) KHÔNG nằm ở đây. `hu_mau.ts`/`mau_luat.ts`
 * giữ chữ của chính chúng vì mỗi mẫu là một CỤM gắn liền (tên + vì-sao + gợi ý), tách ra
 * thì phải nhớ ba chỗ khi thêm một mẫu. Bộ quét A10 chạy trên cả ba tệp.
 */
import { SO_DANG_KY } from '@config/pfm_dac_trung';
import type {
  MaChuyenTiepHu, MaHanhDongLuat, MaTrangThaiNgay,
} from '@config/pfm_events';
import type { VanBanPfmId } from '@config/pfm_consent';
import type { MaHan, MaKetQuaHu, MaLoaiHu, MaUuTien, TrangThaiHu } from '../pfm/hu.js';
import type { MaDieuKien, MaHieuQuaLuat } from '../pfm/luat.js';
import type { MaKhung, MaNguonThu, MaTuLap } from '../pfm/ho_so.js';
import type { KetQuaKhoiPhuc, VuongSaoLuu } from '../pfm/ket_chay.js';
import type { KetQuaLuot } from '../pfm/dong_bo_chay.js';
import type { MaChanDung, MaNhomNguonThu } from '../pfm/chan_dung.js';
import type { MaLyDoViThe } from '../pfm/vi_the.js';

type VuongKhoiPhuc = KetQuaKhoiPhuc['vuong'];
type VuongDongBo = KetQuaLuot['vuong'];

type MaLoaiChi = (typeof SO_DANG_KY)['y_loai']['mien'][number];

/* ═══ 1. MƯỜI HAI Ô NHÃN ════════════════════════════════════════════════════ */

/**
 * Nhãn đầy đủ của 12 loại chi. `MaLoaiChi` suy từ `SO_DANG_KY.y_loai.mien`, nên thêm một
 * loại vào sổ đăng ký mà quên nhãn ⇒ **không biên dịch được**.
 */
export const CHU_LOAI_CHI: Record<MaLoaiChi, string> = {
  an_uong: 'Ăn uống',
  di_lai: 'Đi lại',
  giao_duc: 'Học hành',
  thiet_bi: 'Thiết bị',
  du_lich: 'Chuyến đi',
  du_phong: 'Dự phòng',
  tra_no: 'Trả nợ',
  qua_tang: 'Quà tặng',
  su_kien: 'Sự kiện',
  suc_khoe: 'Sức khoẻ',
  choi: 'Giải trí',
  khac: 'Khác',
};

/**
 * CHỮ TRÊN Ô PIXEL — 2–4 ký tự HOA, đúng chốt founder 04/09: giữ ô chữ, vẽ lưới sau.
 *
 * ⚠ Đây là **chỗ giữ** cho 12 lưới 16×16 chưa vẽ (§B8), không phải một lựa chọn thẩm mỹ
 * vĩnh viễn. Khi có art, mỗi ô đổi thành `PixelIcon` và bảng này ở lại đúng một vai: nhãn
 * cho trình đọc màn hình. Đừng xoá nó lúc thay art.
 * ⚠ NGẮN LÀ RÀNG BUỘC THẬT: ô 36px với font Handjet chứa tối đa 4 ký tự HOA. Có bài canh
 * độ dài — một nhãn 5 chữ không vỡ layout ở máy tôi, nó vỡ ở máy người dùng.
 */
export const O_CHU_LOAI_CHI: Record<MaLoaiChi, string> = {
  an_uong: 'ĂN',
  di_lai: 'XE',
  giao_duc: 'HỌC',
  thiet_bi: 'MÁY',
  du_lich: 'ĐI',
  du_phong: 'DỰ',
  tra_no: 'NỢ',
  qua_tang: 'QUÀ',
  su_kien: 'LỄ',
  suc_khoe: 'SỨC',
  choi: 'CHƠI',
  khac: 'KHÁC',
};

/** Trần ký tự của một ô chữ — xem chú thích của `O_CHU_LOAI_CHI`. */
export const O_CHU_TOI_DA = 4;

/* ═══ 2. HŨ ════════════════════════════════════════════════════════════════ */

export const CHU_LOAI_HU: Record<MaLoaiHu, string> = CHU_LOAI_CHI;

export const CHU_HAN: Record<MaHan, string> = {
  ngan: 'Dưới 3 tháng',
  vua: '3–6 tháng',
  dai: 'Trên 6 tháng',
};

export const CHU_UU_TIEN: Record<MaUuTien, string> = {
  cao: 'Cao',
  vua: 'Vừa',
  thap: 'Thấp',
};

export const CHU_TRANG_THAI_HU: Record<TrangThaiHu, string> = {
  dang_chay: 'Đang chạy',
  tam_dung: 'Tạm dừng',
  xong: 'Xong',
  bo_do: 'Bỏ dở',
};

/**
 * Dòng lịch sử hũ — thì QUÁ KHỨ, vì nó kể lại một việc ĐÃ xảy ra.
 * ⚠ MÔ TẢ, KHÔNG PHÁN XÉT (A10 🔒): `bo_do` là "Bỏ dở", không phải "Thất bại". Hai chữ
 * ấy tả cùng một sự kiện và nói hai điều hoàn toàn khác nhau về người đọc.
 */
export const CHU_CHUYEN_TIEP_HU: Record<MaChuyenTiepHu, string> = {
  tao: 'Tạo hũ',
  sua_ten: 'Đổi tên',
  sua_muc_tang: 'Nâng mức',
  sua_muc_giam: 'Hạ mức',
  doi_han: 'Đổi hạn',
  doi_uu_tien: 'Đổi ưu tiên',
  tam_dung: 'Tạm dừng',
  tiep_tuc: 'Tiếp tục',
  xong: 'Đánh dấu xong',
  bo_do: 'Bỏ dở',
  mo_lai: 'Mở lại',
};

/**
 * PILL trạng thái ở màn HŨ — chữ HOA, mệnh lệnh-thì-hiện-tại. KHÁC GIỌNG với
 * `CHU_TRANG_THAI_HU` ở trên (đó là quá khứ kể lại một dòng lịch sử; đây là nhãn NGAY BÂY
 * GIỜ dán lên thẻ, đúng chữ demo đã chốt).
 */
export const CHU_PILL_HU: Record<TrangThaiHu, string> = {
  dang_chay: 'ĐANG CHẠY',
  tam_dung: 'TẠM DỪNG',
  xong: 'XONG',
  bo_do: 'ĐÃ BỎ',
};

/**
 * NÚT HÀNH ĐỘNG ở thẻ hũ đang mở (màn HŨ) — mệnh lệnh, chữ demo NGUYÊN VĂN. Khoá bằng
 * `chuyenDuoc()` của `hu.ts`, không phải bằng bảng này: đây chỉ là CHỮ, ai muốn biết nút
 * nào hợp lệ ở trạng thái nào thì hỏi máy trạng thái, không suy từ tên khoá dưới đây.
 */
export type ChuNutHuKey = 'tamDung' | 'danhDauXong' | 'tiepTuc' | 'boHuNay' | 'moLai';
/*
 * ⚠ Khoá bằng UNION CỤ THỂ, không phải `Record<string, string>`: dưới `tsconfig`
 * `noUncheckedIndexedAccess`, một chữ ký chỉ mục `string` khiến `CHU_NUT_HU.tamDung` đọc
 * ra `string | undefined` ở mọi nơi gọi — union hữu hạn thì không, TS biết đủ khoá.
 */
export const CHU_NUT_HU: Record<ChuNutHuKey, string> = {
  tamDung: 'TẠM DỪNG',
  danhDauXong: 'ĐÁNH DẤU XONG',
  tiepTuc: 'TIẾP TỤC',
  boHuNay: 'BỎ HŨ NÀY',
  moLai: 'MỞ LẠI',
};

/**
 * NẤC QUYẾT TOÁN (C7) — bốn nhãn NGUYÊN VĂN demo. Mã tra ở `KET_QUA_HU` (`hu.ts`,
 * suy từ sổ đăng ký); bảng này chỉ là CHỮ, không phải một bảng miền thứ hai.
 */
/**
 * D325 — ba câu trả lời cho "luật này tháng ấy có tác dụng không" (miền `kq_rule_hieu_qua`).
 * ⚠ `chua_ro` là một CÂU TRẢ LỜI; không bấm gì (BỎ QUA) mới là trống — hai thứ ấy khác nhau.
 */
export const CHU_HIEU_QUA_LUAT: Record<MaHieuQuaLuat, string> = {
  co: 'CÓ',
  khong: 'KHÔNG',
  chua_ro: 'CHƯA RÕ',
};

export const CHU_KET_QUA_HU: Record<MaKetQuaHu, string> = {
  du: 'GOM ĐỦ RỒI',
  gan_du: 'GẦN ĐỦ',
  dang_tien: 'ĐƯỢC KHOẢNG NỬA',
  xa: 'MỚI ĐƯỢC ÍT',
};

/**
 * CHỮ RỜI RẠC CỦA MÀN HŨ (`screens/tai-chinh/Hu.tsx`) — mọi câu không thuộc ba bảng
 * trên đứng ở đây, NGUYÊN VĂN demo (`docs/ui-ux/demo/pfm-ban-tien.html`, `#manHu`).
 * ⚠ Câu hỏi quyết toán ghép TÊN HŨ (chữ tự do của user) vào giữa `hoiXongPre`/`hoiBoDoPre`
 * và `hoiHau` — tên hũ không phải chữ của app nên không nằm trong tự điển này.
 */
export type ChuManHuKey =
  | 'tieuMan' | 'dangGom' | 'chuThichDangGom' | 'chuThichManHu' | 'daHoanThanh' | 'daGop'
  | 'chuaDatMuc' | 'huDaDay' | 'giaiDuMuc' | 'giaiHuXong' | 'hoiXongPre' | 'hoiBoDoPre'
  | 'hoiHau' | 'phuXong' | 'phuBoDo' | 'hoiSaoKhongTuTinh' | 'giaiSaoKhongTuTinh'
  | 'taoHuMoi' | 'taoHu' | 'huy' | 'tenHuHoi' | 'tenHuGiuCho' | 'loiThieuTen' | 'chonNhan'
  | 'boQuaDuoc' | 'mucMuonGom' | 'deTrongNeuChuaBiet' | 'mucOGoi' | 'mucOTen' | 'mucNutNhanh'
  | 'uuTienHoi' | 'uuTienBat'
  | 'uuTienTat' | 'giaiUuTien' | 'hoiChiTenBatBuoc' | 'giaiChiTenBatBuoc' | 'tuMauTieu';
/* ⚠ Cùng lý do ở `CHU_NUT_HU`: union cụ thể, không `Record<string, string>` — tránh
   `string | undefined` do `noUncheckedIndexedAccess` ở mọi nơi đọc `CHU_MAN_HU.<khoá>`. */
export const CHU_MAN_HU: Record<ChuManHuKey, string> = {
  // ⚠ Hậu tố "ĐANG CHẠY" của tiêu đề dùng CHUNG `CHU_PILL_HU.dang_chay` — không chép lại
  // (D61): hai chỗ cùng nói "đang chạy" mà tách hai bảng thì chúng trôi vào một ngày.
  tieuMan: 'HŨ MỤC TIÊU',
  dangGom: 'Đang gom',
  /*
   * ⚠ NGUYÊN VĂN DEMO. Bản thi công đầu đổi "không phải" → "khác" để né bộ quét
   * `TU_KE_DON` (chữ `'phải '`) — nhưng đó là hệ từ PHỦ ĐỊNH, và câu phủ định dứt khoát
   * chính là câu A10 muốn có. Vá ở bộ quét (`tuKeDonTrong`), trả câu về đúng demo.
   */
  chuThichDangGom: 'Cộng từ những lần bạn góp. Đây không phải số dư tài khoản — app '
    + 'không nhìn thấy tài khoản của bạn.',
  // D410 — góp không còn ở SỔ: ban ngày SỔ chỉ ghi THU/CHI, tối về nạp vào hũ ngay trên màn này.
  chuThichManHu: 'Tiền vào hũ bằng khay PHÂN BỔ ở đầu màn này: chọn một hũ rồi chạm tờ tiền đã ghi '
    + 'ở SỔ. Màn này cũng là chỗ tạo hũ và đổi trạng thái.',
  daHoanThanh: 'HŨ ĐÃ HOÀN THÀNH',
  daGop: 'đã góp',
  chuaDatMuc: 'chưa đặt mức',
  huDaDay: 'HŨ ĐÃ ĐẦY',
  giaiDuMuc: 'Đã đủ mức bạn đặt. Đánh dấu xong hay không là bạn quyết, app không tự '
    + 'đóng hộ.',
  giaiHuXong: 'Hũ đã xong là điểm cuối. Muốn đặt tiếp thì tạo hũ mới, nối đuôi vào hũ cũ '
    + 'sẽ làm tỷ lệ hoàn thành đếm một hũ hai lần.',
  hoiXongPre: 'Bạn gom đủ tiền cho ',
  hoiBoDoPre: 'Trước khi bỏ ',
  hoiHau: ' chứ?',
  phuXong: 'Chọn một nấc cho đúng. Không có nấc nào là sai.',
  phuBoDo: 'Bỏ giữa chừng là chuyện thường. Chọn một nấc rồi đóng lại.',
  hoiSaoKhongTuTinh: 'Sao app không tự tính giúp?',
  giaiSaoKhongTuTinh: 'App biết bạn đã góp bao nhiêu, nhưng nó không biết bạn có gom '
    + 'thêm ở chỗ khác không — tiền mặt, tài khoản khác, người nhà cho. Chỉ bạn biết, '
    + 'và câu này bạn trả lời, app không đoán.',
  // D410 — founder 26/09: *"Sửa lại chữ 'Vào Lệnh' thành 'Tạo hũ' đi."*
  taoHuMoi: '+ TẠO HŨ MỚI',
  taoHu: 'TẠO HŨ',
  huy: 'HUỶ',
  tenHuHoi: 'Hũ này để dành cho việc gì?',
  tenHuGiuCho: 'ví dụ: laptop học tập',
  loiThieuTen: 'Đặt cho nó một cái tên đã',
  chonNhan: 'CHỌN NHÃN',
  boQuaDuoc: '(bỏ qua cũng được)',
  mucMuonGom: 'MỨC MUỐN GOM',
  /* ⚠ P3 — app KHÔNG điền số tiền. Ô này mở đầu TRỐNG; mấy nút tròn chỉ là lối tắt,
     và người dùng gõ số nào cũng được. Trước 21/09 chỉ có nút chọn sẵn, không có ô gõ. */
  mucOGoi: 'gõ số của bạn',
  mucOTen: 'Mức muốn gom, do bạn gõ',
  mucNutNhanh: 'hoặc chọn nhanh:',
  deTrongNeuChuaBiet: '(để trống nếu chưa biết)',
  uuTienHoi: 'ĐÂY CÓ PHẢI ƯU TIÊN CỦA BẠN?',
  uuTienBat: '★ ĐÃ ĐÁNH DẤU ƯU TIÊN',
  uuTienTat: '☆ ĐÁNH DẤU LÀ ƯU TIÊN',
  /*
   * ⚠⚠ CÂU NÀY LÀ MỘT LỜI PHỦ NHẬN, VÀ PHỦ NHẬN LÀ CẢ ĐIỂM. Sao trên hũ là dấu của NGƯỜI
   * DÙNG; bản v11 từng để thẻ tính cách rải sao xuống mẫu và founder bác thẳng (D237
   * §4-ter: *"một cái dấu vẫn là lời khuyên dù nó không có chữ"*). Làm nhoè "không phải
   * xếp hạng của app" thành "khác xếp hạng của app" là làm yếu đúng chỗ cần cứng.
   */
  giaiUuTien: 'Sao là dấu của bạn, không phải xếp hạng của app. Hũ có sao đứng đầu danh '
    + 'sách để bạn thấy nó trước. Đổi lúc nào cũng được.',
  hoiChiTenBatBuoc: 'Chỉ tên là bắt buộc?',
  giaiChiTenBatBuoc: 'Đúng. Nhãn và mức thêm sau lúc nào cũng được. Bắt điền đủ mới cho '
    + 'tạo chỉ khiến bạn ngại mở cái hũ đầu tiên — mà cái hũ chưa tạo thì chẳng ghi được '
    + 'gì vào.',
  tuMauTieu: 'HOẶC BẮT ĐẦU TỪ MỘT MẪU',
};

/* ═══ 2-bis. GƯƠNG ═════════════════════════════════════════════════════════ */

/**
 * CHỮ CỦA MÀN GƯƠNG (`screens/tai-chinh/Guong.tsx`) — NGUYÊN VĂN demo đã chốt
 * (`docs/ui-ux/demo/pfm-ban-tien.html`, `#manGuong`, bản đã sửa 06/09 ở D290).
 *
 * ⚠⚠ CON SỐ KHÔNG NẰM TRONG CHỮ. Demo viết thẳng "THÁNG 9 CỦA BẠN", "SO VỚI THÁNG 8",
 * "Đủ 20 ngày…" — ba con số ấy là DỮ LIỆU (tháng của máy, `PFM.GOI_THANG_NGAY`), không
 * phải chữ. Nên mỗi câu có số bị cắt thành `…Pre`/`…Hau` và màn ghép ở giữa. Nhét số
 * vào tự điển là dựng một bản sao thứ hai của một hằng đã có (D61), và bản sao ấy trôi
 * vào đúng ngày sang tháng.
 *
 * ⚠ Nhãn nắp "HŨ ĐÃ HOÀN THÀNH" KHÔNG khai lại ở đây — dùng chung `CHU_MAN_HU.daHoanThanh`
 * (cùng một đầu mục, hai màn). Hai bảng cùng nói một câu là hai bản sao sẽ trôi.
 */
export type ChuManGuongKey =
  | 'nutViSao' | 'nutAnLyDo' | 'nutBoQua'
  | 'napThangPre' | 'napThangHau' | 'napChiSoPre' | 'napNhan' | 'napLap' | 'napLuat'
  | 'napTuan'
  | 'donViNgay' | 'donViChiSo' | 'donViNhan' | 'donViKhoan' | 'donViHu' | 'donViLuat'
  | 'moiThang' | 'chuaThay' | 'chuaCo' | 'chuaCoLuat' | 'giuPre' | 'daChot' | 'ngayCoGhi'
  | 'thieuMau' | 'vuotTran' | 'duoiSan'
  | 'lichNhan' | 'chuThichLichPre' | 'chuThichLichHau' | 'vachPre' | 'vachGiua' | 'vachHau'
  | 'csTietKiem' | 'csChiBu' | 'csTienVe' | 'csViSale' | 'csTongChiPre'
  | 'chuTietKiem' | 'chuChiBu' | 'chuTienVe' | 'chuViSale' | 'chuTongChi'
  | 'giaiTietKiem' | 'giaiChiBu' | 'giaiTienVe' | 'giaiViSale' | 'giaiTongChi'
  | 'cotNhan' | 'cotSoTien' | 'cotLan' | 'cotSoTPre' | 'cotKhoan' | 'cotMoiLan'
  | 'cotRoiVao' | 'bangChuaDu' | 'oChuaXep' | 'chuaXep' | 'roiVaoPre' | 'thatThuong'
  | 'chuThichNhanPre' | 'chuThichNhanHau' | 'chuThichLap'
  | 'chuThichHuXong' | 'chuThichChuaHuXong'
  | 'themLuat' | 'khoiChuaCoLuat' | 'chuaBan' | 'hoiGiuVo'
  | 'nutGiuDuoc' | 'nutKhongGiu' | 'nutThuBan' | 'nutTat' | 'nutBat'
  | 'formHoi' | 'tieuKhiNao' | 'tieuMucCuaBan' | 'giaiOTrong' | 'tieuLoiNhac'
  | 'giaiLoiNhac' | 'nutDatLuat'
  | 'giaiChotTuan' | 'dauDaChot' | 'anMung' | 'csNgayCoGhi' | 'csToken' | 'tuanSauMoLai'
  | 'nutChotTuan' | 'tuanDaChot' | 'loiChuaDiemDanh' | 'loiChotTuanKhac'
  | 'guongTat'
  | 'napTran' | 'tranTat' | 'tranDonViDe' | 'tranCuaDong' | 'tranDiCaiDat' | 'tranChuaDe'
  | 'tranDiChoi' | 'tranChuaHieuChuan'
  | 'ckTieuPre' | 'ckHoiHuPre' | 'ckHoiGiua' | 'ckHoiHuHau' | 'ckHoiLuatPre' | 'ckHoiLuatHau'
  | 'ckTuDem' | 'ckHuBoPre' | 'ckNgayGhiPre' | 'ckBoQua' | 'ckDeSau' | 'ckXong';
/* ⚠ Cùng lý do ở `CHU_NUT_HU`: union cụ thể, không `Record<string, string>` — tránh
   `string | undefined` do `noUncheckedIndexedAccess` ở mọi nơi đọc. */
export const CHU_MAN_GUONG: Record<ChuManGuongKey, string> = {
  /* ── công tắc "Tắt Gương" (Cài đặt › SỔ CHI TIÊU › KHÁC, D295) — thay CHỖ của các chỉ số ── */
  guongTat: 'Gương đang tắt trên máy này (Cài đặt › SỔ CHI TIÊU › KHÁC). Sổ vẫn ghi bình thường.',
  /*
   * ── MẶT "TRONG TRẬN" (D324) — nối dây game → sổ, dưới cửa NỐI THẺ TÍNH CÁCH VỚI SỔ ──
   * ⚠ A10 🔒: chỉ ĐẾM và TẢ cách bạn đã chơi; không một câu so với sổ kiểu "vậy nên…".
   * ⚠ Số KHÔNG nằm trong chữ (cùng luật cả bảng này) — tỷ lệ, số đề đi riêng.
   */
  napTran: 'TRONG TRẬN',
  tranTat: 'đang tắt',
  tranDonViDe: 'đề',
  tranCuaDong: 'Mặt này ghép cách bạn chơi Alpha Draft với sổ. Nó chỉ hiện khi bạn bật NỐI THẺ TÍNH CÁCH VỚI SỔ trong Cài đặt.',
  tranDiCaiDat: 'MỞ CÀI ĐẶT ›',
  // D396 — không đếm số dấu trong chữ: một năng lực đang ẩn (`NANG_LUC_AN`), số dấu hiện không cố định.
  tranChuaDe: 'Chưa có đề nào đã xong ngoài bàn tập — dấu kỹ năng hiện sau trận đầu tiên.',
  tranDiChoi: 'CHƠI MỘT ĐỀ ›',
  tranChuaHieuChuan: 'Các dấu chấm từ trận, ngưỡng chưa được kiểm trên người thật — đọc như một nét, không như một phép đo.',
  /* D325 — thẻ NHÌN LẠI THÁNG TRƯỚC. Hỏi và đếm, không chấm, không thưởng (D99/D101). */
  ckTieuPre: 'NHÌN LẠI THÁNG ',
  ckHoiHuPre: 'HŨ ',
  ckHoiGiua: ' · THÁNG ',
  ckHoiHuHau: ' TỚI ĐÂU?',
  ckHoiLuatPre: 'LUẬT ',
  ckHoiLuatHau: ' CÓ TÁC DỤNG KHÔNG?',
  ckTuDem: 'Hai dòng dưới app tự đếm từ sổ, không hỏi bạn.',
  ckHuBoPre: 'Hũ bỏ giữa chừng trong tháng ',
  ckNgayGhiPre: 'Ngày có ghi sổ trong tháng ',
  ckBoQua: 'BỎ QUA',
  ckDeSau: 'ĐỂ SAU',
  ckXong: 'XONG',
  /* ── thẻ Oracle ── */
  nutViSao: 'VÌ SAO?',
  nutAnLyDo: 'ẨN LÝ DO',
  nutBoQua: 'BỎ QUA',

  /* ── bảy nắp gấp ── */
  napThangPre: 'THÁNG ',
  napThangHau: ' CỦA BẠN',
  napChiSoPre: 'SO VỚI THÁNG ',
  napNhan: 'CHI THEO NHÃN',
  /* ⚠ "TRÔNG NHƯ" là bắt buộc, không phải khiêm tốn: đây là một PHÉP ĐOÁN theo mẫu, và
     app khẳng định chắc nịch một điều nó chỉ đoán là chỗ người dùng bắt đầu thôi tin cả
     những chỗ nó đúng (D242 §13). */
  napLap: 'TRÔNG NHƯ LẶP LẠI',
  napLuat: 'LUẬT NẾU-THÌ',
  napTuan: 'CHỐT SỔ TUẦN',

  /* ── con số tóm tắt trên lá nắp (nắp không mang số là GIẤU thông tin) ── */
  donViNgay: 'ngày',
  donViChiSo: 'chỉ số',
  donViNhan: 'nhãn',
  donViKhoan: 'khoản',
  donViHu: 'hũ',
  donViLuat: 'luật',
  moiThang: '/tháng',
  chuaThay: 'chưa thấy',
  chuaCo: 'chưa có',
  chuaCoLuat: 'chưa có luật',
  giuPre: 'giữ ',
  daChot: 'ĐÃ CHỐT',
  ngayCoGhi: 'ngày có ghi',

  /* ⚠ P7/D62: thiếu mẫu là VẮNG MẶT hoặc câu này, KHÔNG BAO GIỜ là số 0. Một tỷ lệ 0%
     đọc ra là "đã đo, kết quả bằng không" — đúng điều ta chưa biết. */
  thieuMau: 'chưa đủ để nói',

  /*
   * ⚠⚠ HAI TIỀN TỐ NÀY LÀ CHỖ MÀN THÔI NÓI DỐI. `guong.ts` KẸP mọi tỷ lệ so-với-mốc về
   * [−1, 1] rồi bật cờ `chamSan` — nên tháng trước chi 1 triệu, tháng này 3 triệu vẫn ra
   * `gt = 1`. In "+100%" trần là app khẳng định "bạn tiêu gấp đôi" trong khi sự thật là
   * GẤP BA: một con số sai về tiền của chính người dùng, và sai theo hướng nhẹ đi.
   * ⚠ Có khoảng trắng cuối: nó là TIỀN TỐ ghép trước con số, không phải một câu.
   */
  vuotTran: '≥ ',
  duoiSan: '≤ ',

  /* ── nắp THÁNG: lịch ── */
  /* 13/09 — nhãn ngắn ở ngoài đủ để đọc lưới; phần còn lại của chú giải nằm sau nút (?). */
  lichNhan: 'Ô sáng = ngày có ghi',
  chuThichLichPre: 'Mỗi ô là một ngày. Đủ ',
  chuThichLichHau: ' ngày thì tháng này mở ra một thẻ chân dung — bản tóm tắt cách bạn '
    + 'tiêu tiền. Đếm ngày chứ không đếm số khoản: ghi 30 khoản trong 2 ngày vẫn là 2 ngày.',

  /* ── nắp CHỈ SỐ ── */
  vachPre: 'Vạch ▌ là mức tháng ',
  vachGiua: ' của chính bạn. Phần ',
  vachHau: ' là chỗ tháng này đã vượt qua nó. Không so với ai khác.',
  csTietKiem: 'Tiết kiệm ròng',
  csChiBu: 'Chi bù sau ngày tiêu lớn',
  csTienVe: 'Tiền vừa về là tiêu',
  csViSale: 'Vì sale hoặc bạn rủ',
  csTongChiPre: 'Tổng chi so tháng ',
  chuTietKiem: 'thu trừ chi, trên tổng thu',
  chuChiBu: 'đếm trên những ngày ngay sau một ngày tiêu lớn',
  chuTienVe: 'phần chi rơi vào 48 giờ sau ngày tiền về',
  chuViSale: 'đếm trên số khoản bạn đã tự gắn nhãn',
  chuTongChi: 'so tổng chi tháng này với tháng trước',
  giaiTietKiem: 'Phần tiền vào mà tháng này bạn giữ lại được. Vạch vàng là mức tháng '
    + 'trước của chính bạn.',
  giaiChiBu: 'Hôm sau một ngày tiêu lớn, đây là số lần bạn tiêu trên mức thường, trên '
    + 'tổng số lần có hôm sau để mà đếm. Ngày không tiêu gì cũng được tính, vì thế con '
    + 'số này không bị thổi lên.',
  giaiTienVe: 'Trong 48 giờ sau ngày tiền về, đây là phần trăm của tổng chi cả tháng.',
  giaiViSale: 'Ít nhất 3 khoản bạn đã tự gắn nhãn thì con số mới có nghĩa. Chưa đủ thì '
    + 'gương im, không đoán.',
  giaiTongChi: 'So mình với chính mình là trục so sánh duy nhất app dùng. Không bao giờ '
    + 'so tiền của bạn với người khác.',

  /* ── hai bảng chi tiết (D242) ── */
  cotNhan: 'NHÃN',
  cotSoTien: 'SỐ TIỀN',
  cotLan: 'LẦN',
  cotSoTPre: 'SO T',
  cotKhoan: 'KHOẢN',
  cotMoiLan: 'MỖI LẦN',
  cotRoiVao: 'RƠI VÀO',
  bangChuaDu: 'chưa đủ',
  /*
   * ⚠⚠ "CHƯA XẾP" KHÔNG PHẢI "KHÁC". Khoản chưa gắn nhãn (`nhan === null`) đứng riêng
   * một dòng; gộp nó vào nhãn "Khác" là đúng cú trộn mà `hu.ts` §`nhanNguNghia` cấm —
   * "chưa phân loại" và "phân loại là khác" là hai chuyện (D62/P7).
   */
  oChuaXep: 'CHƯA',
  chuaXep: 'Chưa xếp nhãn',
  roiVaoPre: '≈ ngày ',
  thatThuong: 'thất thường',
  chuThichNhanPre: 'Cột "so T',
  chuThichNhanHau: '" không tô đỏ hay xanh — đỏ-xanh là màu phán xét, nó nói tăng là '
    + 'xấu. Nhãn dưới 3 lần để trống: hai lần chưa nói được gì.',
  chuThichLap: 'Luật đoán nói ra được: cùng tên · ít nhất hai tháng khác nhau · tiền '
    + 'chênh dưới 15% · và không quá ~1 lần mỗi tháng — điều kiện cuối là thứ tách khoản '
    + 'định kỳ khỏi thói quen. Chạy trên máy bạn. App không nói bỏ cái nào; câu để tự '
    + 'hỏi: cái nào ở đây bạn vẫn thấy đáng?',

  /* ── nắp HŨ ĐÃ HOÀN THÀNH (nhãn nắp dùng chung `CHU_MAN_HU.daHoanThanh`) ── */
  chuThichHuXong: 'Hũ đã chốt được ghi nhận ở đây để áp vào chỉ số đạt mục tiêu. Con số '
    + 'là TỔNG BẠN ĐÃ GÓP — app không bịa thêm gì, và không chấm điểm bạn vì nó.',
  chuThichChuaHuXong: 'Chưa có hũ nào chốt. Khi một hũ đầy và bạn đánh dấu xong, nó về '
    + 'đây và được tính vào chỉ số đạt mục tiêu.',

  /* ── nắp LUẬT NẾU-THÌ ── */
  themLuat: '+ ĐẶT MỘT LUẬT',
  khoiChuaCoLuat: 'Chưa có luật nào. Luật là lời bạn tự dặn mình; Oracle chỉ nhắc lại '
    + 'nguyên văn khi điều kiện xảy ra, không thêm một chữ khuyên nào.',
  chuaBan: 'chưa bắn lần nào',
  hoiGiuVo: 'Hôm qua luật này đã bắn. Bạn giữ được không?',
  nutGiuDuoc: 'GIỮ ĐƯỢC',
  /* ⚠ "THÔI, KHÔNG" — KHÔNG phải "VI PHẠM"/"THẤT BẠI". Vỡ luật là DATA, không phải tội
     (`luat.ts` §`ghiNhanGiuVo`); một chữ có mùi phạt biến công cụ quan sát thành cái roi. */
  nutKhongGiu: 'THÔI, KHÔNG',
  nutThuBan: 'THỬ BẮN LUẬT',
  nutTat: 'TẮT',
  nutBat: 'BẬT',

  /* ── FORM ĐẶT LUẬT (dựng lại ở demo 06/09, D290) ── */
  formHoi: 'Bạn muốn tự dặn mình điều gì?',
  tieuKhiNao: 'KHI NÀO NHẮC',
  tieuMucCuaBan: 'MỨC CỦA BẠN',
  /*
   * ⚠⚠ Ô NGƯỠNG ĐỂ TRỐNG, VÀ NÓI RA LÀ TRỐNG CÓ CHỦ ĐÍCH. `mau_luat.ts` khai
   * `NGUONG_GOI_Y = null` với đúng lý do: một con số điền sẵn là THẢ NEO (anchoring) và
   * là một phát biểu ngầm về "bao nhiêu thì lớn" — app định nghĩa hộ, A10 🔒 cấm.
   */
  giaiOTrong: 'Ô vàng này app cố ý để trống: mức nào là lớn với bạn thì chỉ bạn biết.',
  tieuLoiNhac: 'LỜI NHẮC',
  giaiLoiNhac: 'Oracle nhắc lại NGUYÊN VĂN câu này, không thêm chữ nào.',
  nutDatLuat: 'ĐẶT LUẬT NÀY',

  /* ── nắp CHỐT SỔ TUẦN ── */
  giaiChotTuan: 'Chốt sổ tuần là bạn nói "tuần này xong rồi". Sau đó tuần ấy không nhận '
    + 'thêm ngày nào nữa, và app trả bạn ít token theo số ngày bạn đã ghi. Làm vào Chủ '
    + 'nhật là gọn nhất, nhưng lỡ thì thứ Hai vẫn chốt được cho tuần vừa qua — không mất '
    + 'gì cả.',
  dauDaChot: 'ĐÃ CHỐT SỔ',
  /*
   * ⚠ EMOJI ĐƯỢC PHÉP Ở KHU PFM (founder chốt 06/09), kèm ranh: *"chi tiết nào kiểm soát
   * được thì nên kiểm soát, đừng lạm dụng, trông nhựa lắm"*. Ranh áp dụng ở đây: emoji cho
   * KHOẢNH KHẮC (ăn mừng, linh vật) · PIXEL do ta vẽ cho thứ mang THÔNG TIN (ngôi sao ưu
   * tiên, thanh đo, mốc) — thứ mang thông tin mà mỗi máy vẽ một dáng là thông tin lệch.
   * Ô này là một khoảnh khắc, không mang con số nào ⇒ emoji.
   */
  anMung: '👏',
  csNgayCoGhi: 'Ngày có ghi',
  csToken: 'Token nhận được',
  tuanSauMoLai: 'Tuần sau mở lại từ thứ Hai.',
  nutChotTuan: 'CHỐT SỔ TUẦN NÀY',
  tuanDaChot: 'TUẦN NÀY ĐÃ CHỐT',
  /*
   * ⚠⚠ 409 `chua_diem_danh_hom_nay` PHẢI DỊCH THÀNH CÂU NGƯỜI ĐỌC HIỂU. Đúng vào Chủ
   * nhật, tuần được niêm phong kết thúc HÔM NAY, nên chưa điểm danh mà chốt là khoá ngày
   * cuối ra ngoài vĩnh viễn (`api/pfm.ts` §`niemPhongTuan`). Để lộ mã lỗi ở đây là bắt
   * người dùng đọc tên biến của ta.
   * ⏳ CHỜ FOUNDER: bản NHÁP theo đúng câu đặt hàng trong phần việc.
   */
  loiChuaDiemDanh: 'Điểm danh hôm nay trước đã, rồi chốt tuần.',
  loiChotTuanKhac: 'Chưa chốt được lúc này. Thử lại sau một lát.',
};

/* ═══ 2-ter. SỔ ════════════════════════════════════════════════════════════ */

/**
 * CHỮ CỦA MÀN SỔ (`screens/tai-chinh/So.tsx`) + hai chỗ chữ của BÀN TIỀN mà màn SỔ cũng
 * nói tới (toast hoàn tác · ô `+N` báo tràn khay) — NGUYÊN VĂN demo đã chốt
 * (`docs/ui-ux/demo/pfm-ban-tien.html`).
 *
 * ⚠⚠ TOAST DÙNG CHUNG MỘT KHUNG CHO BA CÚ (ghi · sửa · xoá), nên ba tiền tố nằm cạnh
 * nhau ở đây chứ không rải ba chỗ: chúng là ba trạng thái của **một** đường ghi (D284:
 * *"một màn có hai đường ghi là hai đường phải giữ đồng bộ mãi mãi"*), và ba câu tách
 * ba nơi là mời đúng cú trôi ấy vào tầng chữ.
 *
 * ⚠ CON SỐ KHÔNG NẰM TRONG CHỮ (cùng lý lẽ với `CHU_MAN_GUONG`): số tiền, số tháng, số
 * tờ đang khuất đều là DỮ LIỆU — nên câu nào có số thì cắt thành `…Pre`/`…Hau` và màn
 * ghép ở giữa.
 */
export type ChuManSoKey =
  | 'daChiPre' | 'dangMoSo' | 'soTrong' | 'viDuSuaXoa' | 'chuaPhanLoai' | 'oChuaNhan'
  | 'khoTamTieu' | 'khoTamThan'
  | 'suaLai' | 'xoaDong'
  | 'daGhiPre' | 'daSuaPre' | 'daXoaPre' | 'hauDong' | 'nutHoanTac'
  | 'conKhuatPre' | 'conKhuatHau' | 'oVeDau' | 'veDauDai'
  | 'huChot' | 'huGiaHan' | 'huReset' | 'huChonGiai'
  | 'loiResetHu'
  | 'homNayNhan' | 'homQua' | 'khoanHau' | 'huongTuanPre' | 'moGuong' | 'mauAria';
/* ⚠ Cùng lý do ở `CHU_NUT_HU`: union cụ thể, không `Record<string, string>` — tránh
   `string | undefined` do `noUncheckedIndexedAccess` ở mọi nơi đọc `CHU_MAN_SO.<khoá>`. */
export const CHU_MAN_SO: Record<ChuManSoKey, string> = {
  /* RESET hũ ném (hũ `xong`) — nói ra thay vì unhandled rejection (rà D295) */
  loiResetHu: 'Chưa reset được hũ này — hũ đã chốt thì không reset.',
  /* ── đầu màn ── */
  /* D453 — số TO là HÔM NAY (thứ vừa ghi làm nó nhảy); tổng tháng lùi xuống dòng phụ. */
  homNayNhan: 'HÔM NAY',
  homQua: 'HÔM QUA',
  khoanHau: ' khoản',
  huongTuanPre: 'HƯỚNG TUẦN NÀY · ',
  moGuong: 'GƯƠNG ▸',
  mauAria: 'Ghi ngay khoản đã lưu mẫu: ',
  daChiPre: 'đ đã chi · tháng ',
  dangMoSo: 'Đang mở sổ…',
  soTrong: 'Tháng này chưa có dòng nào trong sổ.',
  /*
   * ⚠ Câu này là LỜI HỨA của lỗi số 8 (§8 của `03-pfm-ban-tien.md`): *"Mất đường sửa sau
   * 4 giây — sửa/xoá là MẶC ĐỊNH, hoàn tác chỉ là lối tắt."* Sổ là dữ liệu của user, nên
   * đường sửa phải hiện ra ngay trong danh sách, không nấp sau một cửa sổ ân huệ 4 giây.
   */
  viDuSuaXoa: 'Chạm một dòng để sửa hoặc xoá.',
  /* ⚠ "Chưa phân loại" ≠ "Khác": một cái là CHƯA AI HỎI, một cái là đã hỏi và user chọn
     "khác" (D62/P7). Ép ô trống thành "Khác" là biến một ô trống thành câu trả lời. */
  chuaPhanLoai: 'Chưa phân loại',
  oChuaNhan: '—',

  /* ── dải cảnh báo kho tạm ── */
  khoTamTieu: 'Sổ đang ghi tạm.',
  khoTamThan: 'Máy không cho lưu lâu dài; những gì ghi ở phiên này sẽ mất khi đóng app.',

  /* ── hai nút nở ra dưới một dòng ── */
  suaLai: '↺ SỬA LẠI',
  xoaDong: '✕ XOÁ',

  /* ── toast hoàn tác: một khung, ba tiền tố ── */
  daGhiPre: 'đã ghi ',
  daSuaPre: 'đã sửa ',
  daXoaPre: 'đã xoá ',
  hauDong: ' đ',
  nutHoanTac: 'HOÀN TÁC',

  /*
   * ── ô `+N` báo tràn khay ──
   * ⚠⚠ ĐẾM THEO HƯỚNG CÁI NÚT HỨA SẼ ĐI. Bản demo đầu đếm tờ khuất ở CẢ HAI phía nên tới
   * mép phải nó vẫn báo "+4" — mấy tờ đã lùi ra SAU lưng — mà bấm thì không đi đâu được:
   * đúng về số học, sai về lời hứa. Hết đường phải thì nút đổi vai thành `↺` về đầu dải.
   */
  conKhuatPre: 'còn ',
  conKhuatHau: ' tờ nữa — bấm, kéo ngang, hoặc lăn chuột',
  oVeDau: '↺',
  veDauDai: 'về đầu dải',

  /*
   * ── ba lựa chọn khi chạm một hũ ĐÃ ĐẦY (`.huChon` của demo) ──
   * ⚠⚠ NHÃN "HŨ ĐÃ ĐẦY" KHÔNG NẰM Ở ĐÂY — nó dùng chung `CHU_MAN_HU.huDaDay` với màn HŨ
   * (D61: hai chỗ cùng nói một câu mà tách hai bảng thì chúng trôi vào một ngày).
   * ⚠ GIA HẠN chỉ XOÁ mức cũ, KHÔNG kèm một con số nào — app đề xuất một mức tiền là lúc
   *   nó thôi mô tả và bắt đầu kê đơn (A10 🔒 · P3 🔒). Câu dưới nói thẳng "mức mới do bạn
   *   đặt" chính là để lời hứa ấy đọc được, chứ không nằm im trong code.
   * ⚠ RESET (founder chốt phương án A, D292 §Còn nợ): "đưa về 0" làm bằng MỐC — `Hu.mocGop`
   *   — chứ không cất một con số tổng (`hu.ts` vẫn cấm cất `daGop`) và không cắt `huId`.
   *   Khoản cũ nằm nguyên trong sổ; chỉ thôi được đếm vào hũ. Câu dưới về NGUYÊN VĂN demo.
   */
  huChot: 'CHỐT HŨ',
  huGiaHan: 'GIA HẠN',
  huReset: 'RESET',
  huChonGiai: 'CHỐT: cất hũ vào mục đã hoàn thành · GIA HẠN: mở lại, mức mới do bạn đặt '
    + '· RESET: đưa về 0, giữ nguyên mức.',
};

/* ═══ 3. NGÀY & LUẬT ═══════════════════════════════════════════════════════ */

/**
 * ⚠ `tron` là trạng thái server tự đặt cho ngày KHÔNG có dấu vết nào, nên nó không bao
 * giờ là một nút bấm. Nhãn ở đây chỉ dùng khi kể lại lịch sử.
 */
export const CHU_TRANG_THAI_NGAY: Record<MaTrangThaiNgay, string> = {
  tron: 'Không ghi gì',
  khong_tieu: 'Không tiêu',
  tieu_it: 'Tiêu ít',
  co_ghi: 'Có ghi',
};

export const CHU_DIEU_KIEN: Record<MaDieuKien, string> = {
  ngay_chi_lon: 'Ngày tiêu đậm hơn thường lệ',
  khoan_vuot_muc: 'Một khoản vượt mức mình đặt',
  tien_vua_ve: 'Vài ngày sau khi tiền về',
};

/**
 * ⚠ `vo` là "Không giữ được", KHÔNG phải "Thất bại"/"Vi phạm". Luật nếu-thì là lời người
 * dùng tự dặn mình; app ghi lại kết quả thì ghi, nhưng gọi tên nó bằng chữ có mùi phạt là
 * biến một công cụ quan sát thành một cái roi — và rulebook đã chốt: **không phạt**.
 */
export const CHU_HANH_DONG_LUAT: Record<MaHanhDongLuat, string> = {
  dat: 'Đặt luật',
  sua: 'Sửa luật',
  xoa: 'Xoá luật',
  ban: 'Luật nhắc',
  giu: 'Giữ được',
  vo: 'Không giữ được',
};

/* ═══ 4. HỒ SƠ HOÀN CẢNH (G1) ══════════════════════════════════════════════ */

export const CHU_TU_LAP: Record<MaTuLap, string> = {
  phu_thuoc: 'Gia đình lo phần lớn',
  ban_tu_lap: 'Một phần tự lo',
  tu_lap: 'Tự lo hết',
};

export const CHU_NGUON_THU: Record<MaNguonThu, string> = {
  tro_cap_gd: 'Gia đình chu cấp',
  luong: 'Lương đều hằng tháng',
  tu_do: 'Việc tự do, không đều',
  khac: 'Kiểu khác',
};

export const CHU_KHUNG: Record<MaKhung, string> = {
  hu: 'Chia theo hũ',
  '50_30_20': 'Chia 50/30/20',
  kakeibo: 'Kakeibo — ghi và ngẫm',
  tu_do: 'Không theo khung nào',
};

/* ═══ 5. VĂN BẢN CONSENT ═══════════════════════════════════════════════════ */

export interface VanBanConsent {
  /** Tên cửa — 2–4 chữ, HOA, đứng cạnh công tắc. */
  tieuDe: string;
  /** MỘT dòng: cửa này để làm gì cho người dùng. Luôn hiện, kể cả khi không mở chi tiết. */
  tomTat: string;
  /**
   * Thứ RỜI máy khi cửa mở. MỘT dòng, nói bằng chữ người đọc hiểu, không bằng tên cột.
   * ⚠ Dòng này LUÔN HIỆN cạnh công tắc (không giấu sau nút `?`): "cái gì rời máy" là sự
   * thật chất liệu của một cú đồng ý — giấu nó rồi ghi vết "đã hiện văn bản" là vết giả.
   */
  roiMay: string;
  /**
   * Thứ máy chủ KHÔNG ĐỌC ĐƯỢC. ⚠ Đổi tên từ `oLaiMay` (D294, founder chốt 06/09): "ở lại
   * máy" nói SAI — số tiền CÓ rời máy, trong két đã khoá (`ket.ts`: `khoan` nằm trong lát
   * tháng). Cái mã hoá đầu-cuối bảo đảm là "máy chủ không đọc được", và đó mới là câu
   * đúng — mạnh hơn, không yếu đi.
   */
  mayChuKhongDoc: string;
  /** Câu chốt — quyền rút lại, và cái giá của việc tắt. MỘT dòng. */
  chot: string;
}

/**
 * ⚠⚠⚠ SỬA MỘT CHỮ Ở ĐÂY ⇒ TĂNG `CONSENT_PHIEN_BAN.pfm_dong_bo`. Không phải quy ước cho
 * gọn: `events` ghi cặp (id, phiên bản) của bản người dùng ĐÃ ĐỌC, và giữ nguyên phiên
 * bản khi đổi câu chữ làm mọi vết cũ trỏ về một nội dung không còn tồn tại — tức phá đúng
 * cơ chế mà `config/pfm_consent.ts` dựng ra. Bản cũ không xoá; vết đã ghi phải tra ngược
 * được mãi.
 *
 * ⚠⚠ CHƯA CÓ AI ĐỒNG Ý BẢN NÀY. `v1` vẫn còn "trắng" cho tới cú consent thật đầu tiên
 * trên prod, nên sửa chữ lúc này không cần lên `v2`. Từ giây có người bấm đồng ý thì hết.
 * ⏳ CHỜ FOUNDER DUYỆT: đây là văn bản pháp lý (PDPD/A10), agent soạn nháp chứ không chốt.
 *
 * ⚠ CÂU KHÓ NHẤT LÀ CÂU VỀ KÉT, và nó phải nói đủ hai vế: bản sao lưu **có** rời máy,
 * nhưng nó rời máy đã **khoá bằng chìa chỉ máy bạn giữ**. Nói gọn thành "sổ không rời
 * máy" là sai sự thật; nói gọn thành "sổ được gửi lên server" là bỏ mất đúng điều làm nó
 * chấp nhận được. Hai vế phải đi cùng nhau trong một câu.
 */
/**
 * ⚠ BỐN VĂN BẢN NGẮN, không phải một văn bản dài (founder 06/09: *"đừng bắt user đọc
 * nhiều, mỏi mắt lắm"*). Mỗi cửa đúng bốn dòng, mỗi dòng một câu. Muốn nói thêm thì
 * đó là việc của trang chính sách, không phải của tấm consent.
 * ⚠ A11.16: mọi câu về dữ liệu ra ngoài dùng câu mùa 0.0 — chỉ nghiên cứu, không bán,
 *   không chia. Câu ấy nằm ở cửa `dac_trung`, cửa duy nhất gửi đặc trưng đi.
 * ⚠ Sửa MỘT chữ ⇒ tăng phiên bản ở `config/pfm_consent.ts` (vết cũ phải tra ngược được).
 */
export const VAN_BAN_CONSENT: Record<VanBanPfmId, VanBanConsent> = {
  pfm_ket: {
    tieuDe: 'SAO LƯU KÉT',
    tomTat: 'Giữ một bản sao sổ ngoài máy — đổi máy hay mất máy vẫn còn sổ.',
    roiMay: 'Bản sao sổ của bạn, đã khoá bằng mã khôi phục mà chỉ máy bạn giữ.',
    mayChuKhongDoc: 'Số tiền, tên hũ, ghi chú, lời nhắc — tất cả nằm trong két đã khoá; '
      + 'máy chủ cất được mà không mở được.',
    chot: 'Mất mã là mất bản sao lưu, không ai khôi phục hộ được. Tắt thì sổ vẫn chạy '
      + 'trên máy, chỉ không còn bản sao.',
  },
  pfm_dac_trung: {
    tieuDe: 'ĐẶC TRƯNG NGHIÊN CỨU',
    tomTat: 'Góp vài con số đã gộp để nghiên cứu cách người Việt trẻ tiêu tiền.',
    roiMay: 'Vài con số đã gộp của cả tháng (ví dụ tỷ lệ ngày có ghi) và dấu vết thao '
      + 'tác dạng mã: tạo hũ, đặt luật.',
    mayChuKhongDoc: 'Không một số tiền, tên hũ hay ghi chú nào — chỉ nhãn và tỷ lệ.',
    chot: 'Chỉ phục vụ nghiên cứu mùa này, không bán, không chia. Tắt lúc nào cũng '
      + 'được; đã gửi thì xoá được bằng nút xoá sạch.',
  },
  pfm_thuong: {
    tieuDe: 'ĐIỂM DANH & TOKEN',
    tomTat: 'Máy chủ đếm chuỗi ngày có mặt và phát token khi bạn chốt sổ tuần.',
    roiMay: 'Ngày bạn điểm danh và tuần bạn chốt sổ.',
    mayChuKhongDoc: 'Chỉ ngày và trạng thái (có mặt · không tiêu · tiêu ít), không kèm '
      + 'số tiền.',
    chot: 'Tắt thì vẫn ghi sổ bình thường, chỉ không có chuỗi và không có token.',
  },
  pfm_noi_game: {
    tieuDe: 'NỐI THẺ TÍNH CÁCH VỚI SỔ',
    tomTat: 'Cho phép ghép cách bạn chơi với cách bạn ghi sổ.',
    /*
     * v2 (13/09) — liệt kê ĐÚNG thứ được ghép. Năm mã `gm_*` gửi theo kỳ (`server/hanh_vi/tin_hieu.ts`):
     * số trận · tỷ lệ giữ sổ · số lần rút sớm · độ khớp dự tính · phần vốn đặt vào thị trường. Ba dấu
     * kỹ năng chỉ HIỆN ở Gương, không gửi đi. Sửa một chữ ⇒ lên v3 + ghim hash mới (`buoi_do_chu.test.ts`).
     */
    roiMay: 'Không gửi thêm gì. Cho phép ghép nhãn sổ đã gộp với cách bạn chơi trong nghiên cứu: '
      + 'thẻ tính cách, ba dấu kỹ năng, năm chỉ số theo tháng.',
    mayChuKhongDoc: 'Vẫn không đọc được sổ — chỉ ghép các nhãn đã gộp với những thứ trên.',
    // Dòng RỜI MÁY luôn hiện nên chỉ gọi tên ba nhóm; tên từng chỉ số nằm ở dòng mở bằng `?` (≤ 150 ký tự/dòng).
    chot: 'Năm chỉ số: số trận đã chơi, tỷ lệ giữ sổ tiết kiệm, số lần rút sớm, độ khớp dự tính, '
      + 'phần vốn đặt vào thị trường. Tắt thì hai bên đứng riêng.',
  },
};

/**
 * Chữ của khối CONSENT trong Cài đặt — công tắc chung + nhãn hai vế + nút chi tiết.
 * ⚠ Nhãn vế hai là "MÁY CHỦ KHÔNG ĐỌC ĐƯỢC", không phải "Ở LẠI MÁY" — xem `VanBanConsent`.
 */
export const CHU_CONSENT_KHOI = {
  tieuKhoi: 'DỮ LIỆU RỜI MÁY',
  congTacChung: 'BẬT CẢ BỐN',
  congTacChungTat: 'TẮT CẢ BỐN',
  chuThichChung: 'Bốn công tắc dưới đây bật tắt riêng được. Công tắc chung chỉ là lối tắt.',
  nhanRoiMay: 'RỜI MÁY',
  nhanKhongDoc: 'MÁY CHỦ KHÔNG ĐỌC ĐƯỢC',
  chiTiet: 'chi tiết',
  dongChiTiet: 'đóng',
  vetDaBat: 'đã bật',
  daTat: 'đang tắt',
} as const;

/* ═══ 5-bis. MÀN CÀI ĐẶT PFM — bốn cửa · mã khôi phục · két · xoá sạch (D295) ═══ */

/**
 * CHỮ CỦA KHỐI "SỔ CHI TIÊU" TRONG CÀI ĐẶT (`components/pfm/CaiDatPfm.tsx`) — NGUYÊN VĂN
 * demo đã chốt (`docs/ui-ux/demo/pfm-cai-dat.html`, bản D295). Chữ của bốn cửa KHÔNG ở
 * đây: chúng là `VAN_BAN_CONSENT` + `CHU_CONSENT_KHOI` phía trên (một nguồn, D61).
 *
 * ⚠ CON SỐ KHÔNG NẰM TRONG CHỮ (cùng lý lẽ `CHU_MAN_GUONG`): số ký tự của mã, số giây
 * giữ nút, số lát vừa lưu đều là DỮ LIỆU/hằng — câu có số bị cắt `…Pre`/`…Hau`.
 * ⚠ A10 🔒 vẫn áp cho màn này dù nó không nói về tiền: mọi câu chỉ TẢ trạng thái máy
 *   và nói ra cái giá (mất mã = mất bản sao lưu), không ra lệnh.
 */
export type ChuCaiDatKey =
  | 'tieuKhoi' | 'phuKhoi' | 'dangNhapDe' | 'khoChuaMo'
  | 'khoaTheoKet' | 'khoaTheoChia'
  | 'tieuMa' | 'giaiMa' | 'maTrong' | 'nutChep' | 'daChep' | 'chuaChep' | 'tickMa'
  | 'canhMa' | 'nutXong' | 'dangRen' | 'chiaXong'
  | 'tieuSaoLuu' | 'chuaLuu' | 'nutSaoLuu' | 'dangLuu' | 'vuaXongPre' | 'vuaXongHau'
  | 'tieuKhoiPhuc' | 'oMaGiuCho' | 'nutKhoiPhuc' | 'dangKhoiPhuc'
  | 'loiDoDaiPre' | 'loiDoDaiGiua' | 'loiDoDaiHau' | 'loiKyTuLa'
  | 'hdThem' | 'hdGiu' | 'hdCan' | 'hoiHoaDon' | 'giaiHoaDon' | 'hongPre' | 'hongHau'
  | 'tieuXoa' | 'giaiXoa' | 'giuDeXoaPre' | 'giuDeXoaHau' | 'daXoa' | 'dauXoa'
  | 'ketQuaXoa' | 'loiXoa'
  | 'tieuKhac' | 'tatGuong' | 'moTatGuong' | 'tatNhac' | 'moTatNhac'
  | 'suaPv' | 'moSuaPv' | 'nutSuaPv'
  | 'moLt' | 'moTaMoLt' | 'nutMoLt'
  | 'moCd' | 'moTaMoCd' | 'nutMoCd'
  | 'loiCuaPre' | 'loiCuaHau' | 'nutChiTietDong'
  | 'loiCaiDatMay';
/* ⚠ Cùng lý do ở `CHU_NUT_HU`: union cụ thể, không `Record<string, string>`. */
export const CHU_CAI_DAT: Record<ChuCaiDatKey, string> = {
  /* khối ⑥ ghi kho hỏng (IndexedDB) — nói ra thay vì để công tắc đứng im (rà D295) */
  loiCaiDatMay: 'Chưa ghi được cài đặt vào máy này — thử lại sau một lát.',
  /* ── đầu khối ── */
  tieuKhoi: 'SỔ CHI TIÊU',
  phuKhoi: 'Cài đặt · dữ liệu rời máy · két',
  dangNhapDe: 'Đăng nhập để bật các cửa.',
  khoChuaMo: 'Đang mở kho trên máy…',

  /* ── nhãn khoá của khối ②③④ ── */
  khoaTheoKet: 'Khối này hoạt động khi cửa SAO LƯU KÉT (khối ①) đang bật.',
  khoaTheoChia: 'Khối này hoạt động sau khi khối ② tạo xong mã khôi phục, hoặc khối ④ '
    + 'khôi phục xong một lần.',

  /* ── ② mã khôi phục ── */
  tieuMa: 'Mã khôi phục',
  giaiMa: 'Mã do máy sinh, không phải mật khẩu bạn tự đặt. Bảng chữ bỏ các ký tự dễ nhầm '
    + '(không có chữ I, L, O và U).',
  maTrong: '····-····-····',
  nutChep: 'CHÉP',
  daChep: 'đã chép vào bộ nhớ tạm',
  chuaChep: 'chưa chép được — chép tay từ ô số phía trên',
  tickMa: 'tôi đã ghi lại mã này',
  /*
   * ⚠ NGUYÊN VĂN DEMO, và là câu đắt nhất màn: nó nói ra cái GIÁ của mã hoá đầu-cuối (P2
   * 🔒 — server không có chìa nên không ai khôi phục hộ được). Làm nhẹ câu này là làm
   * nhẹ đúng lời hứa pháp lý của `ket.ts`.
   */
  canhMa: 'Mất mã đồng nghĩa mất bản sao lưu — không có đường khôi phục nào khác, kể cả '
    + 'từ phía người làm app.',
  nutXong: 'XONG',
  dangRen: 'đang rèn chìa…',
  chiaXong: 'Chìa đã rèn xong. Mã khôi phục này mở được mọi bản sao lưu của bạn.',

  /* ── ③ sao lưu ngay ── */
  tieuSaoLuu: 'Sao lưu ngay',
  chuaLuu: 'chưa sao lưu lần nào',
  nutSaoLuu: 'SAO LƯU NGAY',
  dangLuu: 'đang sao lưu…',
  vuaXongPre: 'vừa xong · ',
  vuaXongHau: ' lát',

  /* ── ④ khôi phục ── */
  tieuKhoiPhuc: 'Khôi phục',
  oMaGiuCho: 'XXXX-XXXX-XXXX',
  nutKhoiPhuc: 'KHÔI PHỤC',
  dangKhoiPhuc: 'đang khôi phục…',
  loiDoDaiPre: 'Mã khôi phục có ',
  loiDoDaiGiua: ' ký tự sau khi bỏ khoảng trắng và gạch nối — ô này đang có ',
  loiDoDaiHau: '.',
  /* `chuanMa` (ket.ts) từ chối ký tự ngoài bảng — câu ở đây, không lộ thông điệp của mã. */
  loiKyTuLa: 'Mã có ký tự không nằm trong bảng chữ của mã khôi phục.',
  hdThem: 'THÊM',
  hdGiu: 'GIỮ',
  hdCan: 'CẤN',
  hoiHoaDon: 'Ba con số ở trên nghĩa là gì?',
  giaiHoaDon: 'THÊM: khoản chỉ có trong két, chưa có trên máy này. GIỮ: khoản trên máy đang '
    + 'có bản mới hơn hoặc bằng, máy giữ nguyên. CẤN: máy và két cùng sửa một khoản ở đúng '
    + 'một mốc giờ nhưng nội dung khác nhau — máy giữ bản đang có, và số này đếm có bao '
    + 'nhiêu khoản rơi vào tình huống đó.',
  /* `hong` của `khoiPhucTuKet` — một cú khôi phục KHUYẾT không được phép trông như đầy đủ. */
  hongPre: 'Có ',
  hongHau: ' lát trên máy chủ không mở được bằng mã này.',

  /* ── ⑤ xoá sạch ── */
  tieuXoa: 'Xoá sạch',
  giaiXoa: 'Xoá dữ liệu PFM trên máy này, và mọi bản đã gửi lên máy chủ — bản sao lưu, '
    + 'điểm danh, hũ đã chốt, token PFM. Tài khoản đăng nhập không bị xoá.',
  giuDeXoaPre: 'GIỮ ',
  giuDeXoaHau: ' GIÂY ĐỂ XOÁ',
  daXoa: 'ĐÃ XOÁ',
  dauXoa: 'ĐÃ XOÁ SẠCH',
  ketQuaXoa: 'Dữ liệu trên máy này đã xoá, và bản trên máy chủ cũng vậy. Bốn công tắc ở '
    + 'khối ① đã tắt lại.',
  /* Máy chủ chưa xoá được ⇒ máy này KHÔNG xoá — xoá nửa vời là để người dùng tin rằng
     đã sạch trong khi bản trên máy chủ vẫn còn (P9 🔒). */
  loiXoa: 'Chưa xoá được bản trên máy chủ — máy này chưa xoá gì. Thử lại sau một lát.',

  /* ── ⑥ khác ── */
  tieuKhac: 'KHÁC',
  tatGuong: 'Tắt Gương',
  moTatGuong: 'Màn Gương ngừng tính các chỉ số mô tả; sổ vẫn ghi bình thường.',
  tatNhac: 'Tắt nhắc',
  moTatNhac: 'App ngừng gửi nhắc điểm danh và niêm phong tuần trên máy này.',
  /*
   * ⚠ Ba dòng này VÁ MỘT LỜI HỨA ĐÃ SHIP (D308). Màn phỏng vấn nói sẵn *"Đổi lúc
   * nào cũng được ở ⚙ góc phải"* từ D305 — mà board ⚙ chưa từng có đường ấy. Cùng
   * họ với câu "sẽ mở ở mùa sau" của màn THẺ trong khi khu PFM đã mở (ngõ cụt
   * 07/09): app hứa một cửa không tồn tại, và không bài test nào đọc lời hứa.
   */
  suaPv: 'Sửa sáu câu phỏng vấn',
  moSuaPv: 'Đổi câu trả lời lúc nào cũng được; lộ trình ghép lại theo lời mới. '
    + 'Câu trả lời nằm trên máy bạn.',
  nutSuaPv: 'SỬA',
  /* D325 — lối vào lại lộ trình (trước đây chỉ tới được một lần, ngay sau phỏng vấn đầu). */
  moLt: 'Xem lại lộ trình',
  moTaMoLt: 'Ba chặng ghép từ câu trả lời và sổ của bạn — mở lại lúc nào cũng được.',
  nutMoLt: 'MỞ',
  /* D355/D356 — lối vào lại NGÀY ĐẦU, đúng khuôn hàng "Xem lại lộ trình" ngay trên
     (A11.5: cùng hạng, không đặt luật điều phối riêng). */
  moCd: 'Chân dung của bạn',
  moTaMoCd: 'Chân dung, ba việc gợi ý và thanh mức độ hiểu bạn — mở lại lúc nào cũng được.',
  nutMoCd: 'MỞ',

  /* ── lỗi đổi cửa ── */
  loiCuaPre: 'Chưa đổi được cửa ',
  loiCuaHau: ' — thử lại sau một lát.',
  nutChiTietDong: '✕',
};

/**
 * VÌ SAO MỘT LƯỢT (sao lưu · khôi phục · đồng bộ) KHÔNG ĐƯỢC GÌ — dịch mã `vuong` của ba
 * driver thành câu người đọc hiểu. Khoá là UNION của đúng ba kiểu `vuong` ấy, nên thêm
 * một mã ở driver mà quên câu ở đây là **lỗi biên dịch**, không phải một mã lỗi trần lộ
 * ra màn hình.
 * ⚠ Mọi câu chỉ TẢ chuyện gì xảy ra với máy và nói dữ liệu đang ở đâu — không ra lệnh.
 * ⏳ CHỜ FOUNDER: bản NHÁP.
 */
/**
 * CÂU BÁO KHI MỘT CÚ GHI HỎNG — MỘT nguồn cho mọi màn PFM (D360).
 *
 * ⚠ Trước D360 chỉ PHỎNG VẤN và CAM KẾT có ô lỗi, mỗi màn một câu gõ tay; LỘ TRÌNH và NGÀY ĐẦU thì CÂM — bấm một
 * nút ghi, cú ghi hỏng, và không có gì xảy ra cả. Người dùng chỉ thấy "bấm không ăn" nên không ai báo lại được.
 * ⚠ A10: TẢ + cho một đường đi tiếp, KHÔNG kê đơn và KHÔNG đổ lỗi cho người dùng. Và phải nói rõ **dữ liệu còn
 *   nguyên** — cú ghi hỏng nghĩa là kho KHÔNG bị đụng tới (`suaHoSo` đọc-sửa-ghi), nên im lặng ở đây làm người ta
 *   tưởng vừa mất cái gì đó.
 */
/** Từ chối khi ô mức còn trống — A10: app KHÔNG đoán hộ một con số tiền (cùng luật màn GƯƠNG). */
export const CHU_THIEU_MUC = 'Ô mức đang trống — và app cố ý không điền hộ con số ấy.';

export const CHU_LOI_GHI = 'Chưa lưu được thao tác vừa rồi — dữ liệu cũ vẫn còn nguyên. Thử lại nhé.';

export type MaVuong = NonNullable<VuongSaoLuu | VuongKhoiPhuc | VuongDongBo>;
export const CHU_VUONG: Record<MaVuong, string> = {
  chua_co_chia: 'Chưa có chìa trên máy này — tạo mã khôi phục ở khối ② trước.',
  khong_co_gi_moi: 'Không có gì mới kể từ lần sao lưu trước.',
  het_suat_ngay: 'Hôm nay đã hết lượt gửi lên máy chủ — mai lại có.',
  chua_toi_may_chu: 'Chưa nối được tới máy chủ — mọi thứ vẫn còn trên máy, sẽ gửi lại khi '
    + 'có mạng.',
  may_chu_tu_choi: 'Máy chủ chưa nhận lượt này. Dữ liệu vẫn còn trên máy.',
  ver_lech: 'Bản trên máy chủ mới hơn bản máy này biết — khôi phục ở khối ④ rồi sao lưu lại.',
  lat_qua_lon: 'Một lát sổ vượt cỡ máy chủ nhận được, chưa gửi đi được.',
  loi_may: 'Máy này gặp trục trặc lúc đóng két. Dữ liệu vẫn còn trên máy.',
  khong_mo_duoc: 'Mã này không mở được lát nào trên máy chủ. Chìa đang có trên máy giữ nguyên.',
  hang_doi_rong: 'Không có gì chờ gửi.',
  phan_hoi_lech: 'Máy chủ trả lời không khớp thứ vừa gửi — giữ nguyên hàng đợi, thử lại sau.',
};

/* ═══ 5-ter. MÀN NGÀY ĐẦU (D355/D356, GIAI ĐOẠN A) ═══════════════════════════
 * CHỮ CỦA MÀN `screens/tai-chinh/NgayDau.tsx` — NGUYÊN VĂN demo đã chốt
 * (`docs/ui-ux/demo/pfm-ngay-dau.html`, màn `cd`/`viec`). Chỉ hai bước đầu của demo —
 * n3/n5/n6/tuần chưa thi công, chữ của chúng chưa cần bảng này.
 */

/**
 * NỘI DUNG CHÂN DUNG THEO MÃ — NGOẠI LỆ nội dung MẪU (cùng hạng `hu_mau.ts`/
 * `mau_luat.ts`, xem khối đầu tệp): mỗi chân dung là một CỤM tên + ô chữ + dự đoán gắn
 * liền, tách ra thì thêm một chân dung phải nhớ nhiều chỗ.
 * ⚠⚠ TÊN KHÔNG BẮT ĐẦU BẰNG `CHU_`/`O_CHU_` — CỐ Ý, để bài phản chiếu ở
 * `pfm_chu.test.ts` §I (quét mọi export `/^(CHU|O_CHU)_/` rồi đòi giá trị phẳng) không
 * tự nuốt một bảng LỒNG NHAU (giá trị của nó là object, không phải string — nuốt nhầm
 * sẽ báo `"[object Object]" chưa được nối`, sai chỗ). Flatten TAY vào `moiChuoiPfm()`
 * dưới đây, cùng khuôn `VAN_BAN_CONSENT`; phủ kín có bài canh riêng ở
 * `pfm_chan_dung.test.ts`.
 * ⚠ `chua_ro` CỐ Ý rỗng `doan` — bỏ câu 6 thì KHÔNG đoán (P7); màn ẩn hẳn khối dự đoán,
 *   dùng `chuaRoGhiChu` ở `CHU_NGAY_DAU` thay vào.
 */
export interface ChanDungNoiDung {
  /** Ô CHỮ pixel — 2-4 ký tự HOA, cùng luật `O_CHU_TOI_DA`. */
  glyph: string;
  ten: string;
  /** "TÔI ĐOÁN TUẦN ĐẦU" — một câu, không đoán số tiền (chỉ đoán NHỊP). */
  doan: string;
}
export const CHAN_DUNG_NOI_DUNG: Record<MaChanDung, ChanDungNoiDung> = {
  tien_ve: {
    glyph: 'TV', ten: 'TIỀN VỀ LÀ TIÊU',
    doan: 'Ngày tiêu đậm nhất tuần này sẽ rơi vào 48 giờ sau một lần tiền về.',
  },
  cuoi_thang: {
    glyph: 'CT', ten: 'CUỐI THÁNG BUÔNG TAY',
    doan: 'Nửa cuối tháng này bạn sẽ tiêu nhiều hơn nửa đầu.',
  },
  ngay_te: {
    glyph: 'XẢ', ten: 'TIÊU ĐỂ XẢ',
    doan: 'Ngay sau ngày tiêu đậm nhất tuần, bạn sẽ tiêu trên mức thường ngày.',
  },
  ban_ru: {
    glyph: 'VUI', ten: 'VUI LÀ CHI',
    doan: 'Khoản lớn nhất tuần này sẽ là khoản bạn gắn nhãn “vì sale / bạn rủ”.',
  },
  /*
   * ⚠⚠ BỐN CÂU `doan` TRÊN ĐÂY PHẢI KHỚP TỪNG CHỮ VỚI `pfm/cham_doan.ts` (D368). Bản cũ viết
   * kiểu văn xuôi ("hai ngày tiêu nhiều nhất của tuần") — nghe hay nhưng KHÔNG có phép kiểm nào
   * khớp chính xác với nó, nên chấm kiểu gì cũng là diễn giải, và một lời đoán không kiểm được
   * thì không khác lá số tử vi. Sửa chữ ở đây mà không sửa hàm chấm (hoặc ngược lại) ⇒ bài canh
   * `cham_doan.test.ts` §V đỏ.
   */
  chua_ro: { glyph: '?', ten: 'CHƯA RÕ NÉT', doan: '' },
};

/**
 * Nhãn NHÓM NGUỒN THU (D353 §2) cho dòng tóm tắt đầu thẻ chân dung — CÙNG bốn nhóm
 * `chan_dung.ts` §`nhomNguonThu` suy ra, KHÔNG một bản đếm/đúc thứ hai. Nhóm `null`
 * (bỏ câu 1, hoặc chỉ chọn "đầu tư") dùng `CHU_NGAY_DAU.nhomChuaRo`.
 */
export const CHU_NHOM_NGUON_THU: Record<MaNhomNguonThu, string> = {
  chu_cap: 'ĐƯỢC CHU CẤP',
  chu_cap_tu_kiem: 'CHU CẤP + TỰ KIẾM',
  luong: 'LƯƠNG',
  tu_kiem: 'TỰ KIẾM',
};

/**
 * CHỮ RỜI RẠC CỦA MÀN NGÀY ĐẦU. ⚠ Cùng lý do ở `CHU_NUT_HU`: union cụ thể, không
 * `Record<string, string>` — tránh `string | undefined` do `noUncheckedIndexedAccess`.
 */
export type ChuNgayDauKey =
  | 'hieuTen' | 'hieuHoiAria' | 'hieuGiai'
  | 'hieuMocHoi' | 'hieuMocDoan' | 'hieuMocKhangDinh'
  | 'hieuKeNhan' | 'hieuKeChanDungPre' | 'hieuKeChanDungBold'
  | 'hieuKeBaViecPre' | 'hieuKeBaViecBold'
  | 'oracleNhan' | 'oracleNhanBaViecPhu' | 'oracleLoiChanDung' | 'oracleLoiBaViec'
  | 'netNhipTen' | 'netNhipCau' | 'netDeuTen' | 'netDeuCau' | 'netNguonTen' | 'netNguonCau'
  | 'khongHan' | 'daTuChon' | 'doi' | 'thoiGiuNhuCu' | 'hoanTac' | 'daBoNet' | 'chonLaiHoi'
  | 'nhomChuaRo' | 'tienVaoPre'
  | 'doanTieu' | 'doanGhiChu' | 'chuaRoGhiChu'
  | 'sua' | 'boViec' | 'daXong' | 'daBoViec'
  | 'huNut' | 'huCoNoViPre' | 'huCoNoViHau'
  | 'luatNutBatPre' | 'luatNutBatHau' | 'luatNutHaiChamPre' | 'luatNutHaiChamHau'
  | 'luatHaiChamGhiChu'
  | 'ghiTen' | 'ghiVi' | 'ghiNut'
  | 'neoChanDung' | 'neoBaViec';
export const CHU_NGAY_DAU: Record<ChuNgayDauKey, string> = {
  /* ── thanh MỨC ĐỘ HIỂU BẠN ── */
  hieuTen: 'MỨC ĐỘ HIỂU BẠN',
  hieuHoiAria: 'Thanh này đo gì',
  hieuGiai: 'Thanh này đo tôi đang có BAO NHIÊU CĂN CỨ về bạn — không đo tôi đoán đúng bao '
    + 'nhiêu (thành tích đoán nằm ở màn cuối tuần). Câu nào bạn trả lời cũng cộng như nhau, '
    + 'dù bạn nói GIỐNG hay KHÔNG HẲN. Tôi đếm số NGÀY có ghi sổ, không đếm số dòng.',
  hieuMocHoi: 'HỎI',
  hieuMocDoan: 'ĐOÁN',
  hieuMocKhangDinh: 'KHẲNG ĐỊNH',
  hieuKeNhan: 'lên tiếp nhờ:',
  hieuKeChanDungPre: 'chỗ nào lệch thì chạm ',
  hieuKeChanDungBold: 'KHÔNG HẲN',
  hieuKeBaViecPre: 'làm hoặc bỏ một việc — ',
  hieuKeBaViecBold: 'cả hai đều là câu trả lời',

  /* ── bong bóng Oracle ── */
  oracleNhan: 'ORACLE',
  oracleNhanBaViecPhu: '· GIÚP 1/5',
  oracleLoiChanDung: 'Tôi phác bạn từ sáu câu vừa rồi. Lệch chỗ nào, chạm KHÔNG HẲN.',
  oracleLoiBaViec: 'Tôi xếp sẵn ba việc theo những gì bạn vừa nói. Mỗi việc một chạm; việc '
    + 'nào không hợp thì BỎ.',

  /* ── ba nét chân dung ── */
  netNhipTen: 'LÚC DỄ TIÊU QUÁ TAY', netNhipCau: 'câu 6',
  netDeuTen: 'TIỀN VÀO', netDeuCau: 'câu 2',
  netNguonTen: 'NGUỒN SỐNG', netNguonCau: 'câu 1',
  khongHan: 'KHÔNG HẲN',
  daTuChon: '✓ BẠN TỰ CHỌN',
  doi: 'ĐỔI',
  thoiGiuNhuCu: 'THÔI, GIỮ NHƯ CŨ',
  hoanTac: 'HOÀN TÁC',
  daBoNet: 'Đã bỏ nét này. Sổ của bạn sẽ tự nói lại sau vài tuần.',
  chonLaiHoi: 'Vậy lúc nào thì giống bạn hơn?',
  nhomChuaRo: 'CHƯA RÕ',
  tienVaoPre: 'TIỀN VÀO ',

  /* ── chân "TÔI ĐOÁN TUẦN ĐẦU" ── */
  doanTieu: 'TÔI ĐOÁN TUẦN ĐẦU',
  doanGhiChu: 'Cuối tuần mình đặt cạnh sổ. Tôi chỉ đoán nhịp, không đoán số tiền.',
  chuaRoGhiChu: 'Trả lời câu 6 ở phỏng vấn thì tôi mới đoán được nhịp tuần đầu.',

  /* ── ba việc, chung ── */
  sua: 'SỬA',
  boViec: 'BỎ',
  daXong: 'ĐÃ XONG',
  daBoViec: 'ĐÃ BỎ',

  /* ── việc 1: hũ ── */
  huNut: 'MỞ HŨ · MỨC DO BẠN ĐẶT',
  huCoNoViPre: 'bạn chọn “', huCoNoViHau: '” ở câu 3 — hũ này đứng trước',

  /* ── việc 2: luật ── */
  luatNutBatPre: 'BẬT LUẬT “', luatNutBatHau: '”',
  luatNutHaiChamPre: 'ĐẶT MỨC “', luatNutHaiChamHau: '” · 2 CHẠM',
  luatHaiChamGhiChu: 'Hai chạm: mức “khoản lớn” do bạn gõ, tôi không điền hộ.',

  /* ── việc 3: ghi ── */
  ghiTen: 'Ghi khoản đầu tiên',
  ghiVi: 'hai chạm: cầm tờ tiền, chạm đích',
  ghiNut: 'MỞ BÀN TIỀN',

  /* ── nút neo đáy, đổi theo bước ── */
  neoChanDung: 'LÀM THEO · BA VIỆC HÔM NAY',
  neoBaViec: 'XONG HÔM NAY',
};

/**
 * ── ORACLE GIÚP (GĐ B — D365) ─────────────────────────────────────────────────
 *
 * ⚠ A10 🔒 hai lần nặng ở bảng này: đây là lúc Oracle nói **trong lúc người dùng đang cầm
 * tiền**. Mọi câu chỉ được TẢ và HỎI — không "nên", không "đáng", không "bớt". Câu chốt của
 * demo đã duyệt là ranh giới: *"Tôi không nói khoản này đáng hay không. Tôi chỉ đổi nó ra thứ
 * bạn đã quen đếm."*
 * ⚠ P3 🔒 — không câu nào gợi một CON SỐ TIỀN. Số duy nhất xuất hiện là số người dùng tự gõ,
 * và hai phép chia trên chính sổ họ.
 */
export type ChuGiupKey =
  | 'quyTen' | 'quyDau' | 'quyNgayHau' | 'quyMucPre' | 'quyMucHau' | 'quyNenPre' | 'quyChot'
  | 'lapTen' | 'lapTenTrong' | 'lapDauPre' | 'lapDauGiua' | 'lapDauHau' | 'lapVi' | 'lapLuu' | 'lapThoi'
  | 'lapThangPre' | 'lapThangGiua'
  | 'nhipTen' | 'nhipTuPre' | 'nhipDaTieuPre' | 'nhipGiuPre' | 'nhipGiuHau' | 'nhipHetRoi'
  | 'nhipChuThich' | 'nhipVi' | 'nhipConLaiPre' | 'nhipCoIch' | 'nhipKhong' | 'nhipDaCoIch' | 'nhipDaKhong'
  | 'danTen' | 'danDau' | 'danMoHu' | 'danVi'
  | 'lapDaLuu' | 'lapDaThoi' | 'lapDoi'
  | 'lapGonHoi' | 'lapGonLan' | 'lapLuuNgan' | 'danGon';

export const CHU_GIUP: Record<ChuGiupKey, string> = {
  /* ── GIÚP 4: quy món lớn ra đơn vị của chính bạn (bàn tiền) ── */
  quyTen: 'ORACLE',
  quyDau: 'Trước khi ghi, khoản này tính bằng đơn vị của chính bạn:',
  quyNgayHau: 'chi thường của bạn',
  // ⚠ Thứ tự chữ theo DEMO ĐÃ CHỐT: `mức hũ “Tên” bạn đặt` (A11.25 — bản thi công đầu viết
  //   ngược thành `mức hũ bạn đặt “Tên”`, soi mắt 21/09 bắt được).
  quyMucPre: 'mức hũ',
  quyMucHau: 'bạn đặt',
  quyNenPre: 'nền',
  quyChot: 'Tôi không nói khoản này đáng hay không. Tôi chỉ đổi nó ra thứ bạn đã quen đếm.',

  /* ── GIÚP 2: đề nghị lưu khoản lặp thành mẫu một chạm (màn SỔ) ── */
  lapTen: 'ORACLE',
  /** Tên mẫu khi khoản KHÔNG có ghi chú — người dùng sửa được ở màn SỔ. */
  lapTenTrong: 'Khoản hay lặp',
  /*
   * ⚠ LỆCH DEMO CÓ LÝ DO, ghi lại để không ai tưởng là sơ suất: demo viết *"Ba sáng liền bạn ghi
   * 25.000 quanh 7 giờ"*, nhưng `Khoan` KHÔNG có giờ tiêu — chỉ có `ngay` và `taoLuc` (giờ GHI, thứ
   * khác hẳn: người ta ghi bù buổi tối cho cả ngày). Nói "quanh 7 giờ" từ `taoLuc` là app tự bịa một
   * quan sát. Nên câu ở đây bỏ vế giờ và chỉ nói thứ sổ thật sự biết: mấy lần, cùng số tiền, cùng ghi chú.
   */
  lapDauPre: 'Trong sổ của bạn có',
  lapDauGiua: 'khoản giống nhau:',
  /* ── nhịp THÁNG: khoản cố định (trọ · học phí · gói cước) ── */
  lapThangPre: 'Khoản này về đều đặn',
  lapThangGiua: 'tháng liền, quanh cùng một ngày:',
  lapDauHau: 'Lưu thành mẫu một chạm không?',
  lapVi: 'Tôi chỉ điền sẵn — bạn bấm thì mới thành khoản. Sổ không tự sinh khoản nào.',
  lapLuu: 'LƯU MẪU',
  lapThoi: 'KHÔNG',
  lapDaLuu: 'ĐÃ LƯU MẪU',
  lapDaThoi: 'KHÔNG LƯU',
  lapDoi: 'ĐỔI',
  /* D453 — bản MỘT HÀNG ở SỔ (không bong bóng): số lần · khoản · câu hỏi · hai nút. Mẫu lưu xong thành chip trong khay. */
  lapGonLan: ' lần · ',
  lapGonHoi: 'thành nút một chạm?',
  lapLuuNgan: 'LƯU NÚT',

  /* ── GIÚP 5: tiền đi tới ngày nào (màn GƯƠNG) ── */
  nhipTen: 'ORACLE',
  nhipTuPre: 'Từ lần tiền về ngày',
  nhipDaTieuPre: 'bạn đã tiêu',
  /*
   * ⚠⚠ VẾ "GIỮ NHỊP N NGÀY QUA" LÀ BẮT BUỘC, không phải văn vẻ (A10 🔒). Bỏ nó đi thì một
   * phép chia trên sổ biến thành lời tiên tri — và người đọc không có cách nào biết con số ấy
   * đứng trên giả định gì. `tienToiNgay` trả `nhipNgay` ra ngoài đúng để câu này buộc phải nói.
   */
  nhipGiuPre: 'Giữ nhịp',
  nhipGiuHau: 'ngày qua thì phần còn lại đi hết vào khoảng ngày',
  nhipHetRoi: 'Phần tiền lần ấy đã đi hết.',
  nhipChuThich: 'vàng = tiền về · lam = đã qua · đỏ = ngày phần còn lại chạm 0 nếu giữ nhịp',
  nhipVi: 'Phép chia trên chính sổ của bạn. Tôi chỉ đoán nhịp; số tiền là của bạn gõ.',
  nhipConLaiPre: 'Còn lại:',
  nhipCoIch: 'CÓ ÍCH',
  nhipKhong: 'KHÔNG',
  nhipDaCoIch: 'ĐÃ GHI · CÓ ÍCH',
  nhipDaKhong: 'ĐÃ GHI · KHÔNG',

  /* ── GIÚP 3: lời tự dặn lúc tiền vừa về (màn SỔ) ── */
  danTen: 'ORACLE',
  /*
   * ⚠⚠ ORACLE KHÔNG NÓI GÌ CỦA RIÊNG NÓ Ở THẺ NÀY. Câu duy nhất có nội dung là `luat.loiNhac` —
   * chữ của chính người dùng. Câu dưới đây chỉ là lời DẪN, và nó phải nói rõ mình đang dẫn:
   * demo nguyên văn *"Tôi chỉ đọc lại lời bạn"*. Thêm một lời khuyên vào đây là phá bậc 3 của
   * thang can thiệp (*"Bạn viết, Oracle chỉ nhắc lại đúng lời bạn"*) và vi phạm A10.
   */
  danDau: 'Tiền vừa về. Tôi chỉ đọc lại lời bạn:',
  danMoHu: 'MỞ HŨ',
  danVi: 'Hũ đã chọn sẵn; số tiền do bạn gõ. Tôi không điền hộ.',
  /* D453 — bản MỘT HÀNG ở SỔ: nhãn ngắn trước lời tự dặn nguyên văn. */
  danGon: 'TIỀN VỪA VỀ · BẠN DẶN',
};

/* ═══ 5b. CHÂN DUNG HÀNH TINH (21/09) ══════════════════════════════════════
 * Chữ cho `pfm/chan_dung_hanh.ts`. Số và mã ở đó, chữ ở đây (D26).
 * Theo DEMO ĐÃ CHỐT `docs/ui-ux/demo/pfm-chan-dung.html` — chép nguyên, đừng diễn giải lại.
 *
 * ⚠ ẨN DỤ PHẢI KHỚP, KHÔNG GÁN BỪA: hàng = khoảng cách tới mặt trời (gần = muốn ngay),
 *   cột = khí quyển dày mỏng (dày = ma sát khi tiền rời tay). Nhờ khớp nên người đọc suy
 *   được vị trí của mình mà không cần học bảng; đổi tên hành tinh tuỳ tiện là mất phần ấy.
 * ⚠ A10 🔒 — KHÔNG hành tinh nào "tốt" hơn hành tinh nào. Đây là CHỖ ĐỨNG, không phải điểm.
 */
type KhoaHanh = `${0 | 1 | 2}${0 | 1 | 2}`;

/** Khoá = `${hàng}${cột}` của `oHanhTinh`. Hàng 0 = gần mặt trời = muốn ngay. */
export const CHU_HANH_TINH: Record<KhoaHanh, string> = {
  '00': 'SAO THUỶ', '01': 'TRÁI ĐẤT', '02': 'SAO KIM',
  '10': 'SAO HOẢ', '11': 'SAO THỔ', '12': 'SAO MỘC',
  '20': 'DIÊM VƯƠNG', '21': 'THIÊN VƯƠNG', '22': 'HẢI VƯƠNG',
};

/** Đọc vị hàng (trục β) và cột (trục đau) — hai dòng dưới tên hành tinh. */
export const CHU_HANG_HANH: Record<'0' | '1' | '2', string> = {
  0: 'muốn NGAY', 1: 'ở giữa', 2: 'CHỜ được',
};
export const CHU_COT_HANH: Record<'0' | '1' | '2', string> = {
  0: 'tiêu nhẹ tay', 1: 'ở giữa', 2: 'tiếc khi tiêu',
};

/** Vành đai = trục kế hoạch. */
export const CHU_VANH_HANH: Record<'0' | '1' | '2', string> = {
  0: 'không vành — tuỳ hứng',
  1: 'vành mảnh — đại khái có nghĩ',
  2: 'vành dày — nghĩ trước khá rõ',
};

/** Nhãn hai đầu của hai thanh trục. */
export const CHU_TRUC_HANH = {
  bTrai: 'MUỐN NGAY', bPhai: 'CHỜ ĐƯỢC',
  dauTrai: 'TIÊU NHẸ TAY', dauPhai: 'TIẾC KHI TIÊU',
  riaB: 'muốn ngay', riaDau: 'tiếc khi tiêu',
  /* ⚠ Trục bỏ qua phải NÓI RA là chưa đo. Để thanh sọc im lặng thì người ta đọc ra là
     "điểm của tôi bằng 0" — app bịa một phép đo nó chưa làm (P7). */
  chuaDo: 'CHƯA ĐO — bạn đã bỏ qua câu này. Tôi không đoán bù.',
};

export const CHU_MAN_CHAN_DUNG = {
  tieu: 'CHÂN DUNG TÀI CHÍNH CỦA BẠN',
  chuaDuTieu: 'CHƯA ĐỦ ĐỂ VẼ',
  /* ⚠⚠ Nói THIẾU CÂU NÀO, không nói "hãy trả lời thêm" (A10 — mô tả, không kê đơn).
     Demo viết *"Tôi cần ít nhất một câu về…"* và bộ quét A10 bắt chữ **cần**. Không nới bộ
     quét: A10 nằm trong danh sách luật KHÔNG DẺO (A11.17). Viết lại thành câu tả trạng thái,
     và sửa luôn ở demo để hai bên không trôi khỏi nhau (A11.5). */
  chuaDuPre: 'Còn thiếu câu về ',
  chuaDuB: 'lúc tiền vừa về',
  chuaDuDau: 'lúc trả tiền một món hơi đắt',
  /* ⚠ Không dùng "nên" làm liên từ ở đây: bộ quét bắt `'nên '` và ca này KHÁC ca "chưa phải"
     — bỏ chữ "nên" đi không làm câu yếu đi một ly, nên viết lại rẻ hơn vá chốt. */
  chuaDuHau: ' — thiếu nó thì chưa đặt được chấm của bạn. Bỏ qua cũng không sao, tôi vẫn xếp được việc đầu tiên.',
  /* ⚠ NÓI THẲNG RANH GIỚI. Chia vùng bằng ngưỡng cứng thì hai người lệch nhau một ly rơi
     vào hai hành tinh khác hẳn; giấu chuyện đó là để người ta tin chân dung chắc hơn thực
     tế — gần lá số tử vi hơn là mô tả. */
  riaPre: 'Bạn nằm ',
  riaDam: 'sát rìa',
  riaGiua: ' ở trục “',
  riaHau: '” — chỉ một câu trả lời khác là bạn đã sang vùng bên cạnh.',
  doanTieu: 'TÔI ĐOÁN TUẦN NÀY',
  doanNhan: 'KIỂM ĐƯỢC',
  /* ⚠ Chân dung này dựng từ LỜI KHAI, không phải từ sổ. Không nói ra là để người đọc tưởng
     app đã đo mình — P6 xếp tự khai là bằng chứng yếu, và giấu hạng bằng chứng là nói dối
     bằng cách im lặng. */
  nguonPre: 'Dựng từ ',
  nguonDam: 'câu bạn vừa trả lời',
  nguonHau: ', chưa phải từ sổ.',
  /* ⚠⚠ D385 — câu cũ ở đây hứa *"khi sổ đủ dày, tôi chấm lại và nói thẳng tôi trúng hay trật"* trong khi
     KHÔNG màn nào chấm. Nay câu chỉ đường tới đúng chỗ việc chấm xảy ra, và nói rõ luật chống nhìn đáp án. */
  chamOPre: 'Tôi tự chấm lời đoán này ở ',
  chamODam: 'CHỐT SỔ TUẦN (màn GƯƠNG)',
  chamOTuMoc: ', chỉ trên những kỳ mở ra từ ',
  chamOChuaMoc: ', chỉ trên những kỳ mở ra sau khi lời đoán này xuất hiện.',
  nutSuaLai: '◀ SỬA LẠI CÂU TRẢ LỜI',
  nutTiep: '▶ VIỆC ĐẦU TIÊN CỦA TÔI',
  chuaLamTieu: 'CHƯA CÓ CHÂN DUNG',
  chuaLamThan: 'Chân dung dựng từ mấy câu phỏng vấn. Chưa trả lời câu nào thì chưa có gì để vẽ.',
  chuaLamNut: '▶ TRẢ LỜI MẤY CÂU',
};

/* ═══ 5c. APP TỰ CHẤM LỜI ĐOÁN (D385) ═════════════════════════════════════
 * Chữ cho ô CHỐT SỔ TUẦN ở GƯƠNG + dòng thành tích trên màn chân dung. Số và mã ở `pfm/so_doan.ts`.
 * ⚠ A10 🔒 — KẾT QUẢ NÓI VỀ APP ("tôi trúng/tôi trật"), không một chữ khen chê cách người dùng tiêu.
 * ⚠ Không chôn con số sàn mẫu vào chữ ("ít hơn 6 ngày"): số ấy ở `config/pfm.ts`, chép vào đây là bản
 *   thứ hai sẽ trôi khi founder chỉnh sàn (A11.5).
 */
export const CHU_TU_CHAM = {
  nhan: 'LỜI ĐOÁN CỦA TÔI',
  trung: 'TÔI TRÚNG',
  trat: 'TÔI TRẬT',
  chua_du: 'CHƯA ĐỦ SỐ',
  daDoanPre: 'Tôi đã đoán: ',
  chuaDuGiai: 'Sổ kỳ này chưa đủ ngày ghi chi để chấm — tôi không chấm bằng nhiễu.',
  /* Một câu phủ cả hai lý do `kyCanCham` trả null khi lời đoán CÓ mốc: kỳ khép trước lời đoán, hoặc lời
     đoán theo tháng mà tháng chưa được ghi từ ngày 1. Tách hai câu thì phải chép lại luật ấy ra màn. */
  khongChamGiai: 'Kỳ này tôi không chấm: hoặc nó khép lại trước khi tôi đưa ra lời đoán (chấm ở đó là nhìn đáp án), hoặc lời đoán theo tháng mà tháng ấy chưa được ghi từ ngày 1.',
  thanhTichPre: 'Sổ lời đoán của tôi: ',
  thanhTichTrung: ' trúng · ',
  thanhTichTrat: ' trật',
};

/* ═══ 5d. VỊ THẾ · VÀO LỆNH · KẾT TOÁN (tệp 15 lát 1, bản 2 — chữ Alpha Draft) ═══════════════
 * Chữ cho DANH MỤC + lá vị thế ở màn HŨ, bảng VÀO LỆNH, lá KẾT TOÁN ở thẻ NHÌN LẠI / hộp quyết toán, chip độ chắc ở
 * form luật, và nắp ĐỘ KHỚP ở GƯƠNG. Mã và phép tính ở `pfm/vi_the.ts`; con số % ở `config/pfm.ts`.
 * ⚠ TỪ VỰNG MỘT CHỖ (founder chốt 25/09: chữ Alpha Draft — vị thế · vào lệnh · kết toán · độ chắc). Game rebuild đổi
 *   tên thì sửa ĐÚNG khối này.
 * ⚠ HAI CHỮ "TÔI" KHÔNG ĐỨNG CẠNH NHAU (phản biện §10.2): ở GƯƠNG "tôi" là app (D385 — "TÔI TRÚNG"). Nhãn của người
 *   dùng KHÔNG mang đại từ.
 * ⚠ A10 🔒 — tả + hỏi. Không khen chê một kết quả, không màu đỏ-xanh cho "chưa tới"; câu Oracle chỉ nói sự thật đếm được.
 */
export const CHU_LY_DO_VI_THE = {
  // ⚠ Soi mắt 25/09: "ĐÚNG NHƯ DỰ TÍNH" gãy hai dòng trong hàng ba nút ở 375px — rút còn ba chữ.
  dung_nhu_nghi: 'NHƯ DỰ TÍNH',
  // Chữ Alpha Draft cho "đánh giá sai" (D369 §10: *đọc sai*).
  danh_gia_sai: 'ĐỌC SAI',
  hoan_canh_doi: 'HOÀN CẢNH ĐỔI',
} satisfies Record<MaLyDoViThe, string>;

/** Kiểu vị thế suy từ loại hũ (D369 §5.2) — chỉ để gọi tên, không chấm điểm. */
export const CHU_KIEU_VI_THE = {
  tich: 'TÍCH LẠI',
  giu: 'GIỮ NGUYÊN',
  tra_no: 'TRẢ NỢ',
  chi_ke_hoach: 'CHI CÓ KẾ HOẠCH',
};

export const CHU_VI_THE = {
  /* ── DANH MỤC (đầu màn HŨ) ── */
  dmTieuPre: 'KẾ HOẠCH · THÁNG ',
  dmDongTienPre: 'tiền vào tháng ',
  dmChuaDongTien: 'Sổ chưa có khoản tiền vào nào — phần trăm mỗi tháng chờ có tiền vào.',
  dmChuaCamKet: 'chưa vào kế hoạch',
  dmVuot: 'vượt tiền vào',
  dmDangGomPre: 'đang gom ',
  dmChiQuaHan: 'Các hũ có hạn đều đã tới hạn — chờ thẻ NHÌN LẠI ở GƯƠNG.',
  dmChuaViThe: 'Chưa hũ nào có hạn. Hũ có mức và hạn thì app tự tính mỗi tháng góp bao nhiêu thì kịp hạn.',
  oracleTen: 'ORACLE',
  dmGiai: 'Hũ có mức và hạn: góp mỗi tháng = mức chia đều cho số ngày tới hạn, quy ra tháng và so '
    + 'với tiền vào tháng trước. App tự tính từ sổ, không hỏi thêm câu nào.',
  cauChiemHau: ' chiếm ',
  cauPhanCamKet: ' phần kế hoạch góp.',
  cauVuotPre: 'Kế hoạch góp vượt tiền vào tháng ',
  cauVuotHau: '.',
  cauChuaGiuPre: 'Chưa có hũ giữ-nguyên nào; ',
  cauChuaGiuHau: ' hũ tích lại đang chạy.',
  /* ── LÁ VỊ THẾ (thẻ hũ) ── */
  viThePre: 'HŨ · ',
  coPre: 'góp ',
  moiThangHau: '/tháng',
  moiNgayHau: '/ngày',
  conPre: 'còn ',
  ngayHau: ' ngày',
  quaHanPre: 'quá kỳ hạn ',
  nhipDung: 'đúng nhịp',
  nhipChamPre: 'chậm ',
  nhipNhanhPre: 'nhanh ',
  kyHau: ' kỳ',
  chacPre: 'chắc ',
  choKetToanPre: 'chờ nhìn lại tháng ',
  chuaVaoLenh: 'chưa có kỳ hạn',
  /* D453 — nút ngay trên lá hũ (trạng thái in lên chính vật): mở bảng đặt, ô số trống. */
  datHanNut: 'ĐẶT HẠN ▸',
  datMucNut: 'ĐẶT MỨC ▸',
  chuaMuc: 'chưa có mức',
  /* ── BẢNG TẠO HŨ (bản 2 gọi là "VÀO LỆNH"; founder 26/09 đổi thành "Tạo hũ" — D410) ── */
  lenhTieuPre: 'MỨC · KỲ HẠN · ',
  lenhViTheMoi: 'TẠO HŨ MỚI',
  vaoLenh: 'ĐẶT MỨC · KỲ HẠN',
  luuLenh: 'LƯU',
  xemTruoc: 'LÁ ĐANG DỰNG',
  tenXemTruoc: 'HŨ MỚI',
  bieuTuongHoi: 'BIỂU TƯỢNG',
  kyHanHoi: 'KỲ HẠN',
  thangSau: ' THÁNG',
  ngayKhac: 'NGÀY KHÁC',
  toiPre: 'tới ',
  coTieu: 'GÓP MỖI THÁNG',
  moiThangChu: ' mỗi tháng',
  phanDongTienGiua: ' tiền vào tháng ',
  moiNgayChu: ' mỗi ngày',
  coChuaDongTien: 'chưa có khoản tiền vào để tính %',
  chacHoi: 'ĐỘ CHẮC — tới kỳ hạn đủ mức',
  boQua: 'BỎ QUA',
  chacGiai: 'Chọn một mức, hoặc BỎ QUA nếu không muốn đoán — hũ vẫn chạy như thường.',
  thieuChac: 'Chọn độ chắc — hoặc BỎ QUA.',
  viSaoHoi: 'VÌ SAO · tuỳ chọn',
  viSaoGiuCho: 'Một dòng, chỉ bạn đọc lại',
  hanGanQua: 'Kỳ hạn này gần quá — cách hôm nay ít nhất ',
  hanGanQuaHau: ' ngày.',
  giaiKhoa: 'Độ chắc khoá lúc đặt: đổi mức, kỳ hạn hay reset thì độ chắc đã nêu khép lại và không xét. Tới tháng của '
    + 'kỳ hạn, thẻ NHÌN LẠI hỏi hũ tới đâu — gom đủ là TỚI, còn lại là CHƯA TỚI.',
  /* ── NHÌN LẠI LẬT LÁ (trước D453: KẾT TOÁN) ── */
  ktPre: 'NHÌN LẠI · ',
  matDuPre: 'Đủ ',
  matToiGiua: ' đ tới ',
  quaAppPre: 'Qua app đã góp ',
  quaAppHau: ' đ — nấc tính cả tiền gom ngoài app.',
  lungNacPre: 'Bạn nghĩ: ',
  ketToi: 'TỚI',
  ketKhongToi: 'CHƯA TỚI',
  ketChuaXet: 'CHƯA ĐỦ ĐỂ XÉT',
  hoiLyDo: 'VÌ SAO?',
  luatMatPre: 'Tháng ',
  luatMatGiua: ' giữ trọn luật này',
  luatDemBan: 'Bắn ',
  luatDemGiu: ' · giữ ',
  luatDemVo: ' · vỡ ',
  doKhopPre: 'Chắc ',
  doKhopGiua: ': ',
  doKhopLan: ' lần, tới ',
  /* ── Form luật ── */
  hoiLuatPre: 'THÁNG ',
  hoiLuatHau: ' GIỮ TRỌN LUẬT NÀY — ĐỘ CHẮC?',
  luatBoQuaDuoc: 'Bỏ qua được. Chạm lại chip đang chọn để bỏ.',
  /* ── Nắp LỜI ĐOÁN CỦA BẠN ở GƯƠNG (trước D453: ĐỘ KHỚP) ── */
  napTieu: 'LỜI ĐOÁN CỦA BẠN',
  napTom: ' đang mở',
  napTomXet: ' đã xét',
  napChuaCo: 'chưa có',
  dangMo: 'ĐANG MỞ',
  daXet: 'ĐÃ XÉT, THEO ĐỘ CHẮC BẠN NÊU',
  hoanCanhDoiHau: ' lần bạn ghi "hoàn cảnh đổi" — đã đếm ở trên.',
  doiGiuaChungHau: ' lời đoán khép giữa chừng — không xét.',
  boTrongHau: ' lời đoán quá hạn không có câu trả lời — không xét.',
  chuaCoGi: 'Chưa hũ nào có độ chắc. Độ chắc đặt được ở hai chỗ: lúc tạo hũ (hoặc đặt mức + hạn) ở màn HŨ, '
    + 'và lúc đặt luật.',
  giaiNap: 'Đếm theo độ chắc bạn nêu: nói 70% mà mười lần tới bảy là đọc mình sát. Ở lại máy.',
  /* ── SỔ ── */
  canhGiaHan: 'Hũ này đang có lời đoán kèm độ chắc — GIA HẠN hay RESET là khép nó, không xét.',
};

/* ═══ 5e. GHI NHANH · PHÂN BỔ · TỰ CHIA (D410 → D420, founder 26/09) ═══════════════════════
 * D410: *"Quy tắc là tiện lợi và nhanh gọn tối đa cho phần ghi chép"* — bàn tiền chỉ còn hai đích. D420: khay màn HŨ
 * bày TIỀN CÒN LẠI bẻ ra tờ (*"2tr thì 4 tờ 500k được bấm 4 lần"*), gõ số để nạp đúng từng đồng, và QUY TẮC TỰ CHIA
 * (*"thiếu hoặc thừa thì app sẽ hỏi chứ ko tự phân bổ"*). Phép tính ở `pfm/phan_bo.ts` · `pfm/tu_dong.ts`.
 * ⚠ A10 🔒 — tả + chỉ chỗ + hỏi; không câu nào bảo người dùng nạp hũ nào, bao nhiêu. Bộ quét `TU_KE_DON` có chữ "cần"
 *   — nên câu thiếu viết "đến hạn", không viết "quy tắc cần".
 */
export const CHU_PHAN_BO = {
  /* ── SỔ ── */
  nutChi: '− CHI',
  nutThu: '+ THU',
  quyGonPre: '≈ ',
  quyGonNgay: ' ngày chi thường',
  quyGonMucGiua: '% mức “',
  quyGonMucHau: '”',
  loiPre: 'CHỜ PHÂN BỔ · ',
  loiHau: ' đ',
  tenChi: 'Khoản chi',
  tenThu: 'Khoản thu',
  /** Khoản chuyển từ ví vào hũ (D420) — tiền không đi đâu mất, nên không có dấu trừ. */
  chuyenPre: '→ ',
  /** D421 — rút từ hũ về ví: cũng là chuyển, mũi tên ngược lại — không phải tiền vào (+ THU). */
  rutPre: '← ',
  vaoHuPre: 'Vào ',
  rutHuPre: 'Rút ',
  tuChia: ' · tự chia',
  /** D421 → D424 — lối nói thêm tiền chi chưa chia (chỉ khi có hũ tiêu dùng đang chạy). */
  loiGiua: ' · ',
  loiChiPre: 'CHI ',
  /* Bàn tiền thu xuống (founder 26/09: *"bấm ra ngoài bàn phím thì … ẩn bàn phím xuống dưới để user có không gian nhìn"*). */
  moBan: '▲ GHI TIỀN',
  moBanCamPre: '▲ ĐANG CẦM ',
  /* ── HŨ · khay ── */
  tieu: 'PHÂN BỔ',
  giai: 'Hai loại hũ, cùng một cách chia. Hũ TIẾT KIỆM nhận TIỀN CÒN LẠI (tiền vào − tiền ra đã ghi ở SỔ): chạm hũ '
    + 'rồi chạm tờ — mỗi cú một tờ bay vào; RÚT RA trả tiền từ hũ về ví. Hũ CHI nhận TIỀN CHI tháng này chưa chia: '
    + 'chạm hũ rồi chạm tờ — mỗi cú một tờ tiền đã tiêu thuộc về hũ ấy; GỠ RA trả tờ về chỗ chưa chia. Muốn đúng từng đồng '
    + 'thì GÕ SỐ. Hũ có quy tắc TỰ CHIA thì mỗi lần mở màn này app chia theo quy tắc khi ví đủ; ví thiếu, hay có tiền vào '
    + 'mới còn thừa, thì app hỏi.',
  chonHu: 'Chạm một hũ để nạp',
  /* D421 — hai loại hũ: câu gợi chỉ nói việc làm được với những hũ ĐANG CÓ. */
  chonHuTieu: 'Chạm một hũ để chia tiền chi',
  chonHuCaHai: 'Chạm hũ TIẾT KIỆM để chia tiền còn lại · hũ CHI để chia tiền chi',
  khongCoGi: 'Chưa có gì để chia — tiền vào (+ THU) và khoản chi (− CHI) ghi ở SỔ.',
  keTieuDungPre: 'CHI · THÁNG ',
  keTichLuy: 'TIẾT KIỆM',
  napVaoPre: 'NẠP VÀO ',
  rutTuPre: 'RÚT TỪ ',
  /* D424 — phía CHI của khay, cùng khuôn phía THU. */
  chiaVaoPre: 'CHIA VÀO ',
  goKhoiPre: 'GỠ KHỎI ',
  khayChiPre: 'CHI · ',
  chiConPre: 'chi chưa chia ',
  huDaTieuPre: 'hũ đã tiêu ',
  huongChia: 'CHIA VÀO',
  huongGo: 'GỠ RA',
  daChiaPre: 'Đã chia ',
  daChiaGiua: ' vào ',
  daGoPre: 'Đã gỡ ',
  daGoGiua: ' khỏi ',
  xongHetChi: 'ĐÃ CHIA HẾT TIỀN CHI',
  xongHetChiPhu: 'Tiền chi tháng này đã vào hũ hết.',
  chiTrong: 'Chưa có tiền chi nào để chia tháng này — chi ghi ở SỔ (− CHI).',
  huChuaTieu: 'Hũ chưa có gì để gỡ.',
  toChia: ' — chạm để chia',
  toChiaHet: ' — đã chia hết',
  toGo: ' — chạm để gỡ',
  toGoHet: ' — đã gỡ hết',
  chiaGoPre: 'CHIA ',
  goGoPre: 'GỠ ',
  vuotChiPre: 'Chi chưa chia còn ',
  vuotChiHau: ' — chia tối đa số này.',
  vuotGoPre: 'Hũ đã tiêu ',
  vuotGoHau: ' — gỡ tối đa số này.',
  khayPre: 'CHƯA CHIA · ',
  viConPre: 'ví còn ',
  huConPre: 'hũ còn ',
  huongNap: 'NẠP VÀO',
  huongRut: 'RÚT RA',
  daNapPre: 'Đã nạp ',
  daNapGiua: ' vào ',
  daRutPre: 'Đã rút ',
  daRutGiua: ' từ ',
  xongHet: 'ĐÃ CHIA HẾT',
  xongHetPhu: 'Tiền còn lại đã vào quỹ hết.',
  viTrong: 'Ví chưa còn gì để chia — tiền vào ghi ở SỔ (+ THU).',
  huTrong: 'Hũ chưa có tiền để rút.',
  chuaMuc: 'chưa mức',
  chuaCoHu: 'Chưa có hũ nào đang chạy — tạo một hũ ở nút đáy màn.',
  toTen: 'Tờ ',
  toNap: ' — chạm để nạp',
  toHet: ' — đã nạp hết',
  toRut: ' — chạm để rút',
  toRutHet: ' — đã rút hết',
  donViLe: 'đ',
  goSo: 'GÕ SỐ',
  goSoDong: 'Đóng bàn phím',
  napGoPre: 'NẠP ',
  rutGoPre: 'RÚT ',
  vuotViPre: 'Ví còn ',
  vuotViHau: ' — nạp tối đa số này.',
  vuotHuPre: 'Hũ còn ',
  vuotHuHau: ' — rút tối đa số này.',
  /* ── TỰ CHIA · bảng tạo hũ ── */
  tuDongHoi: 'TỰ CHIA VÀO HŨ NÀY',
  tuDongNgay: 'MỖI NGÀY',
  tuDongPhanTram: '% TIỀN VÀO',
  tuDongNgayO: 'Số tiền mỗi ngày',
  tuDongPhanTramO: 'Phần trăm mỗi khoản tiền vào',
  theoCoPre: 'THEO CỠ LÁ · ',
  tuDongGiai: 'Mỗi lần mở màn HŨ, app chia theo quy tắc này khi ví đủ, kèm nút hoàn tác. Ví thiếu, hay có tiền vào mới '
    + 'còn thừa, thì app hỏi, không tự chia.',
  tuDongLoiNgay: 'Gõ số tiền mỗi ngày (lớn hơn 0).',
  tuDongLoiPhanTram: 'Gõ phần trăm từ 1 tới 100.',
  /* ── TỰ CHIA · nhãn trên hũ ── */
  tuDongDau: '⟳ ',
  moiNgayHau: '/ngày',
  phanTramHau: '% tiền vào',
  laTuDongPre: 'TỰ CHIA · ',
  /* ── TỰ CHIA · thẻ quy tắc khi mở màn (D421: không ✕ — hỏi xong thành thẻ kết quả tại chỗ) ── */
  hoiTieu: 'QUY TẮC TỰ CHIA',
  thieuDenHanPre: 'Quy tắc đến hạn ',
  thieuConPre: ' · ví còn ',
  thieuThieuPre: ' · thiếu ',
  thuaVaoPre: 'Có ',
  thuaVaoHau: ' tiền vào mới.',
  thuaChiaPre: ' Quy tắc chia ',
  thuaConPre: ' · ví còn ',
  thuaConHau: ' ngoài quỹ.',
  thuaChuaQuy: ' Chưa quỹ nào nhận.',
  nutChiaPre: 'CHIA ',
  nutChiaHau: ' THEO QUY TẮC',
  nutTiLeHau: ' THEO TỈ LỆ',
  nutBoQua: 'BỎ QUA LẦN NÀY',
  nutDeDo: 'ĐỂ ĐÓ',
  daTuChiaTieu: 'QUY TẮC VỪA TỰ CHIA',
  daChiaTieu: 'ĐÃ CHIA THEO QUY TẮC',
  tongChiaPre: 'Tổng ',
  daBoQuaTieu: 'ĐÃ BỎ QUA LẦN NÀY',
  daBoQuaChu: 'Ví giữ nguyên. Lượt đến hạn sau quy tắc hỏi lại.',
  daHoanTacTieu: 'ĐÃ HOÀN TÁC',
  daHoanTacHau: ' về lại ví.',
  /* ── HAI LOẠI HŨ · bảng tạo (D421) ── */
  nhomHoi: 'LOẠI HŨ',
  nhomTichLuy: 'TIẾT KIỆM',
  nhomTichLuyPhu: 'gom tới một mức',
  nhomTieuDung: 'CHI',
  nhomTieuDungPhu: 'chia tiền chi mỗi tối',
  nhomGiai: 'Loại chọn một lần, lúc tạo. Tiết kiệm nhận tiền còn lại và gom tới mức; chi nhận tiền chi (chia bằng '
    + 'tờ) và đếm tiền đã tiêu trong tháng. Không chọn thì là tiết kiệm.',
  mucThangHoi: 'MỨC TIÊU MỖI THÁNG',
  /* Hũ tiêu dùng không "để dành" gì — câu hỏi tên của nó hỏi khoản chi. */
  tenHuTieuHoi: 'Hũ này cho khoản chi nào?',
  tenHuTieuGiuCho: 'ví dụ: ăn uống',
  /* ── HŨ TIÊU DÙNG · lá ── */
  daTieu: 'ĐÃ TIÊU',
  datMucThang: 'ĐẶT MỨC THÁNG',
  lenhTieuPre: 'MỨC THÁNG · ',
};

/* ═══ 5f. BIỂU ĐỒ (D426, founder 26/09) ═════════════════════════════════════════════════════════════
 * *"Làm biểu đồ trực quan và đa dạng vào, kết hợp dữ liệu app thu được nữa xong so sánh hành vi"* · *"những cái ở vị
 * trí đầu tiên / dễ nhìn nhất thì ưu tiên hữu ích"*. Phép tính ở `pfm/bieu_do.ts`; màn ở `screens/tai-chinh/BieuDo.tsx`
 * + `BaMat.tsx`.
 * ⚠ A10 🔒 — tả số của chính người dùng, so với CHÍNH HỌ (P12); không câu nào bảo tiêu ít đi hay để dành thêm.
 * ⚠ Số KHÔNG nằm trong chữ (cùng luật `CHU_MAN_GUONG`): mọi con số — kể cả cửa sổ 90 ngày, 2 ngày sau tiền về — đi
 *   riêng từ `config/pfm.ts` / `bieu_do.ts`, chữ chỉ là `…Pre`/`…Hau` quanh nó.
 */
export const CHU_BIEU_DO = {
  /* ── bước tháng (chung ba thẻ đầu) ── */
  thangPre: 'THÁNG ',
  toiNgayPre: 'TỚI NGÀY ',
  daKhep: 'ĐÃ KHÉP',
  thangTruocAria: 'Xem tháng trước',
  thangSauAria: 'Xem tháng sau',
  /* ── TIỀN VÀO ĐI ĐÂU ── */
  diDauTieu: 'TIỀN VÀO ĐI ĐÂU',
  vao: 'TIỀN VÀO',
  chi: 'CHI',
  deDanh: 'ĐỂ DÀNH',
  du: 'CÒN DƯ',
  vuot: 'VƯỢT',
  chuaChia: 'CHƯA CHIA',
  huKhac: 'HŨ KHÁC',
  rutPre: 'RÚT · ',
  thangTrong: 'Tháng này chưa có khoản nào trong sổ.',
  chuaVao: 'Tháng này chưa ghi khoản tiền vào nào — thanh chia theo phần đã chi và đã để dành.',
  vuotPre: 'Chi và để dành nhiều hơn tiền vào của tháng: ',
  giaiDiDau: 'CHI là mọi khoản − CHI ở SỔ, khớp số "đã chi". Khúc màu của nó là phần bạn đã chia vào từng hũ chi, '
    + 'khúc sọc là phần chưa chia. ĐỂ DÀNH là tiền nạp vào hũ tiết kiệm trừ phần rút ra. CÒN DƯ là tiền vào trừ '
    + 'hai phần kia.',
  /* ── CHI TỪNG NGÀY ── */
  ngayTieu: 'CHI TỪNG NGÀY',
  cheDoNgay: 'TỪNG NGÀY',
  cheDoDon: 'CỘNG DỒN',
  caThangPre: 'CẢ THÁNG ',
  thangNganPre: 'T',
  cungNgayHau: ' cùng ngày ',
  caThangHau: ' cả tháng ',
  chuaCoTruoc: 'tháng trước chưa có số để so',
  ghiTienVe: '▲ tiền về',
  ghiMucThuongPre: 'mức thường ',
  ghiNgayLon: 'ngày lớn',
  chamCot: 'Chạm hoặc vuốt qua các cột để xem từng ngày.',
  ngayKhongGhi: 'Ngày này sổ không ghi gì.',
  ngayKhongChi: 'Ngày này không có khoản chi.',
  khoanChi: 'chi',
  khoanVe: 'tiền vào',
  khoanDonVi: ' khoản',
  themKhoanPre: '+ ',
  themKhoanHau: ' khoản nữa',
  duongNayPre: '━ tháng ',
  duongTruocPre: '┄ tháng ',
  bieuDoNgayAria: 'Biểu đồ chi từng ngày của tháng',
  thu0: 'T2', thu1: 'T3', thu2: 'T4', thu3: 'T5', thu4: 'T6', thu5: 'T7', thu6: 'CN',
  /* ── HŨ TIÊU DÙNG ── */
  huTieuTieu: 'HŨ CHI',
  nhipNgayPre: '┆ ngày ',
  vuotMucPre: 'vượt mức ',
  phanTienChiHau: '% tiền chi',
  chuaCoHuTieu: 'Chưa có hũ chi nào — loại CHI tạo ở màn HŨ.',
  moHu: 'MỞ HŨ ›',
  giaiHuTieu: 'Thanh là phần đã chia vào hũ so với mức tháng bạn tự đặt. Vạch ┆ là hôm nay trên cả tháng: tiêu đều cả '
    + 'tháng thì thanh chạm đúng vạch ấy. ▲▼ so với cùng ngày tháng trước.',
  /* ── 6 THÁNG ── */
  napSauThang: '6 THÁNG GẦN ĐÂY',
  deDanhTbPre: 'để dành TB ',
  donViThang: ' tháng',
  tyLeDeDanh: 'ĐỂ DÀNH / TIỀN VÀO',
  thangDangChayHau: '·nay',
  giaiSauThang: 'Mỗi tháng ba cột: tiền vào · chi · để dành (nạp trừ rút). Tháng đang chạy mới tới hôm nay.',
  /* ── THÓI QUEN ── */
  napThoiQuenPre: 'THÓI QUEN · SO THÁNG ',
  cuoiTuanPre: 'cuối tuần ×',
  theoThuTieu: 'CHI THEO THỨ',
  theoThuChuPre: 'Trung bình một ngày, trên ',
  theoThuChuHau: ' ngày sổ đã ghi (ngày không tiêu tính là 0).',
  sauVeTieu: 'SAU KHI TIỀN VỀ',
  sauVeChu: 'Chi cộng dồn từ hôm tiền về, mỗi đường một lần về — dừng ở lần về kế tiếp.',
  sauVeHomVe: 'hôm về',
  sauVeNgayPre: '+',
  csTongChiCungNgay: ' · cùng ngày',
  /* ── NÓI · LÀM · TRONG TRẬN ── */
  napBaMat: 'NÓI · LÀM · TRONG TRẬN',
  baMatTomHau: ' cặp đủ hai mặt',
  nhomNoiSo: 'BẠN NÓI ↔ SỔ GHI',
  nhomTranDoi: 'TRONG TRẬN ↔ NGOÀI ĐỜI',
  tagNoi: 'NÓI',
  tagSo: 'SỔ',
  tagTran: 'TRẬN',
  chuaTraLoi: 'chưa trả lời ở phỏng vấn',
  capTienVe: 'LÚC TIỀN VỀ',
  capSauTieu: 'SAU MỘT MÓN HƠI ĐẮT',
  capDauThang: 'ĐẦU THÁNG',
  capQuaTay: 'LÚC DỄ TIÊU QUÁ TAY',
  capGiuSo: 'GIỮ MỘT KHOẢN CÓ KỲ HẠN',
  capLocTin: 'ĐỘ CHẮC KHI ĐOÁN',
  capChiaGio: 'CHIA NHIỀU GIỎ',
  tienVeLanHau: ' lần tiền về có nạp hũ trong ',
  tienVeNgayHau: ' ngày đầu',
  chuaTienVe: 'chưa có lần tiền về nào trong cửa sổ',
  sauTieuPre: 'hôm sau vẫn tiêu trên mức thường: ',
  lanHau: ' lần',
  sauTieuChuaDu: 'chưa đủ ngày tiêu lớn để nói',
  daChiaPre: 'tiền chi tháng ',
  daChiaGiua: ' đã chia vào hũ: ',
  chuaTieuThang: 'tháng này chưa có khoản chi',
  camKetPre: 'kế hoạch để dành: ',
  camKetHau: '% tiền vào',
  khungSauVeHau: ' ngày sau tiền về',
  khungCuoiThangHau: ' ngày cuối tháng',
  khungCuoiTuan: 'cuối tuần',
  khongDo: 'sổ không đo được',
  lanPre: '×',
  giuKhepPre: 'đã khép: giữ tới cùng ',
  giuBoPre: ' · bỏ giữa chừng ',
  giuChayPre: 'đang chạy ',
  giuKhongChamPre: ' · không chậm nhịp ',
  giuRutPre: 'rút ra ',
  giuRutGiua: ' lần trong ',
  giuRutHau: ' ngày',
  giuChuaCo: 'chưa hũ nào có kỳ hạn',
  noiChacPre: 'nói ',
  chuaXet: 'chưa lời đoán nào tới hạn xét',
  gioViTheHau: ' hũ có hạn đang góp',
  gioLonNhatPre: ' · lớn nhất ',
  gioChuaCo: 'chưa hũ nào có hạn',
  baMatGiaiPre: 'Các mặt đặt cạnh nhau; app không chấm khớp hay lệch. Mặt SỔ tính trên ',
  /* "Chưa hiệu chuẩn" đã do câu của mặt TRẬN nói (`tranChuaHieuChuan`) — nói lại ở đây là hai câu cho một ý. */
  baMatGiaiHau: ' ngày gần nhất.',
  /* ── ĐƯỜNG GÓP · lá vị thế ở màn HŨ ── */
  keHoach: '┄ kế hoạch',
  thucGop: '━ thực góp',
  homNay: 'hôm nay',
  mucPre: 'mức ',
  bieuDoViTheAria: 'Biểu đồ kế hoạch và số thực góp của hũ',
  /* ── tiền ngắn cho chú giải chật ── */
  donTr: 'tr',
  donK: 'k',
};

/* ═══ 5g. PHÂN TÍCH & ĐỊNH HƯỚNG (D429, founder 26/09) ═══════════════════════════════════════════════════
 * *"Vẫn chỉ là 1 app ghi chép nhỉ. Chưa thấy phần nào là phân tích hay hỗ trợ định hướng"* ⇒ hai thẻ đầu GƯƠNG: BẢN TIN
 * (`pfm/phan_tich.ts`) + PHONG CÁCH HỢP VỚI BẠN (`pfm/phong_cach.ts`). Màn: `screens/tai-chinh/DinhHuong.tsx`.
 * ⚠ A10 🔒 / P3 — tả, dự phóng CÓ NÓI GIẢ ĐỊNH, và mốc so chỉ là chính người dùng hoặc mức/hạn HỌ đặt. Khung là GỢI Ý có
 *   vì-sao; bước dựng mở màn sẵn có với ô số TRỐNG. Không câu nào bảo tiêu ít đi hay để dành thêm.
 * ⚠ Số KHÔNG nằm trong chữ (nếp `CHU_BIEU_DO`): mọi con số đi riêng, chữ chỉ là `…Pre`/`…Hau` quanh nó.
 */
export const CHU_DINH_HUONG = {
  /* ── thẻ BẢN TIN ── */
  phanTich: 'PHÂN TÍCH',
  thangPre: 'THÁNG ',
  ngayGiua: ' · NGÀY ',
  chuY: 'ĐÁNG CHÚ Ý',
  diVeDau: 'ĐANG ĐI VỀ ĐÂU',
  chanBanTin: 'Đọc từ chính sổ của bạn. Dự phóng = giữ nguyên nhịp; nhịp đổi thì số đổi — không phải lời tiên tri.',
  chuaDu: 'Bản tin chỉ nói khi sổ đủ căn cứ — hiện chưa dòng nào đủ.',
  chuaDuSoPre: 'Sổ có mặt ',
  chuaDuSoHau: ' ngày.',
  moGiaiAria: 'Xem cách tính dòng này',
  thangNho: 'tháng ',
  ngayQuaHau: ' ngày qua',
  moiNgay: '/ngày',
  moiThang: '/tháng',
  mucPre: 'mức ',
  // chi so cùng ngày
  cdTieuPre: 'Chi tới ngày ',
  cdCungNgayHau: ' cùng ngày: ',
  cdNguonPre: 'chủ yếu ở ',
  cdChuaChia: 'CHƯA CHIA',
  cdGiai: 'Cộng mọi khoản tiêu từ ngày 1 tới hết cùng một ngày của hai tháng. "Chủ yếu ở" = phần (một hũ chi, '
    + 'hoặc phần chưa chia) chở nhiều nhất của chênh, cùng chiều với nó.',
  // cuối tuần
  ctTieu: 'Cuối tuần',
  ctPhu: 'chi một ngày so với thứ Hai–Sáu',
  ctGiai: 'Trung bình một ngày, tính cả ngày không tiêu (bằng 0) — trên những ngày sổ đã có mặt.',
  // sau tiền về
  svTieuHau: ' ngày đầu sau tiền về',
  svPhu: 'chi một ngày so với ngày khác',
  svGiai: 'Ngày có khoản tiền vào và những ngày ngay sau nó, so với mọi ngày còn lại — trung bình một ngày, tính cả '
    + 'ngày không tiêu.',
  // khoản lớn
  klTieuHau: ' khoản lớn nhất tháng này',
  klNgayPre: 'khoản ngày ',
  klGiai: 'Ba khoản tiêu lớn nhất cộng lại, chia cho tổng chi của tháng tới hôm nay.',
  // để dành
  ddTieuLen: 'Để dành đi lên ba tháng liền',
  ddTieuXuong: 'Để dành đi xuống ba tháng liền',
  ddPhuHau: ' của tiền vào',
  ddGiai: 'Để dành ròng (nạp trừ rút ở màn HŨ) chia cho tiền vào của tháng. App chỉ thấy tiền đi qua hũ của nó.',
  // hũ tiêu dùng so mức
  hmVuotHau: ' qua mức tháng',
  hmChamHau: ' chạm mức tháng',
  hmDuoiHau: ' hết tháng',
  hmMucBanDatPre: 'mức bạn đặt ',
  hmConPre: 'còn ',
  hmConHau: ' ngày',
  hmGiai: 'Đã tiêu (tổng đã chia vào hũ trong tháng) cộng nhịp nhân số ngày còn lại, so với mức tháng chính bạn đặt.',
  giuNhipPre: 'giữ nhịp ',
  giuNhipHau: ' ngày qua',
  // vị thế
  vtDuPre: ' đủ ',
  vtHanPre: 'hạn bạn đặt ',
  vtTrePre: 'trễ ',
  vtSomPre: 'sớm ',
  vtThangHau: ' tháng',
  vtSoHanPre: ' so hạn bạn đặt ',
  vtKipPre: 'kịp hạn bạn đặt ',
  vtQuyTacPre: 'theo quy tắc ',
  vtPhanTramHau: '% mỗi lần tiền về',
  vtGopPre: 'theo nhịp góp ',
  vtChuaGopPre: 'chưa góp đồng nào trong ',
  vtChuaGopHau: ' ngày qua — với nhịp này chưa có tháng đủ',
  vtGiai: 'Còn thiếu (mức trừ đã góp) chia cho nhịp góp một tháng — theo quy tắc tự chia bạn đặt, hoặc theo chính số bạn '
    + 'đã góp. So với kỳ hạn bạn đặt lúc vào lệnh.',
  // chi cả tháng
  htTieuPre: 'Cả tháng ',
  htGiai: 'Chi tới hôm nay cộng nhịp nhân số ngày còn lại của tháng. Nhịp = chi từ đầu tháng tới hết hôm qua, chia số '
    + 'ngày.',

  /* ── thẻ PHONG CÁCH ── */
  pcTieu: 'PHONG CÁCH HỢP VỚI BẠN',
  pcTieuDaChon: 'KHUNG BẠN CHỌN',
  pcSoBoPre: 'SƠ BỘ · ',
  pcSoBoHau: ' ngày sổ',
  pcDauHieuHau: ' dấu hiệu',
  pcGoiY: 'APP GỢI Ý',
  pcDangDung: 'ĐANG DÙNG',
  pcDungPre: 'DÙNG KHUNG ',
  pcViSao: 'VÌ SAO HỢP',
  pcTrenSo: 'TRÊN SỔ CỦA BẠN',
  pcBuoc: 'BƯỚC DỰNG',
  pcBuocChan: 'Mỗi bước mở đúng màn sẵn có — ô số ở đó để trống, bạn gõ.',
  pcKhongDauHieu: 'Sổ chưa có dấu hiệu nào cho khung này.',
  pcChuaXep: 'Chưa đủ dấu hiệu để xếp — ba khung ở đây, bạn chọn.',
  pcGiai: 'App đếm dấu hiệu trên sổ và trong câu bạn đã trả lời, cho từng khung; khung nhiều dấu hiệu nhất đứng đầu. '
    + 'Không dùng dữ liệu trận. Chọn là của bạn — không bấm thì không gì đổi.',
  pcGiaiAria: 'Xem cách app xếp khung',
  pcKhungAria: 'Xem khung ',
  // cách mỗi khung chạy
  cachHu: 'mỗi đồng tiền vào có một TÚI việc riêng — túi gom tới mục tiêu, túi tiêu trong mức tháng',
  cach503020: 'tiền vào chia ba phần theo TỈ LỆ: THIẾT YẾU · MUỐN · ĐỂ DÀNH',
  cachKakeibo: 'ghi tay, mỗi cuối tuần tự hỏi bốn câu — ít tính toán, nhiều nhìn lại',
  // dấu hiệu
  dhThuThatPre: 'tiền vào lệch ',
  dhThuThatGiua: ' giữa ',
  dhThuThatHau: ' tháng — hũ chia theo từng lần tiền về, không đợi một khoản cố định',
  dhNoiPre: 'bạn kể tiền vào ',
  dhChiaPre: 'đã chia ',
  dhChiaGiua: ' chi tháng này vào ',
  dhChiaHau: ' hũ chi',
  dhMucTieuHau: ' mục tiêu đang gom cùng lúc — mỗi mục tiêu một túi',
  dhQuyTacHau: ' hũ đã có quy tắc tự chia',
  dhThuDeuPre: 'tiền vào ',
  dhThuDeuGiua: ' tháng qua chỉ lệch ',
  dhThuDeuHau: ' — tỉ lệ đứng trên một khoản vào ổn định',
  dhKhongTui: 'chưa có túi nào — khung này chỉ có ba phần',
  dhItTuiPre: 'mới ',
  dhItTuiHau: ' túi — khung này chỉ có ba phần',
  dhGhiPre: 'ghi ',
  dhGhiGiua: ' ngày gần đây mà ',
  dhGhiHau: ' chi chưa vào túi nào — kakeibo đứng trên chính thói quen ghi',
  dhTuanPre: 'chi giữa ',
  dhTuanGiua: ' tuần lệch ',
  dhTuanHau: ' — kakeibo nhìn lại từng tuần',
  dhChuaMucTieu: 'chưa có mục tiêu gom nào — kakeibo mở đầu bằng câu "tháng này muốn để dành bao nhiêu"',
  // trên sổ của bạn
  tsTuiGom: 'TÚI GOM',
  tsTuiTieu: 'TÚI TIÊU',
  tsChuaVaoTui: 'CHƯA VÀO TÚI',
  tsThietYeu: 'THIẾT YẾU',
  tsMuon: 'MUỐN',
  tsChuaRo: 'CHƯA RÕ',
  tsDeDanh: 'ĐỂ DÀNH',
  tsTienVaoPre: 'phần của tiền vào ',
  tsChuaCoThu: 'tháng này chưa có tiền vào để chia tỉ lệ',
  tsNhapPre: 'nháp theo khung bạn chọn, trên tiền vào ',
  kq1: 'CÓ BAO NHIÊU',
  kq2: 'MUỐN ĐỂ DÀNH BAO NHIÊU',
  kq3: 'ĐANG TIÊU BAO NHIÊU',
  kq4: 'TUẦN TỚI MUỐN ĐỔI GÌ',
  kqCuaBan: 'câu của bạn — app không ghi lại',
  kqTuanNay: 'tuần này ',
  // bước dựng
  htTuChiaNgayHau: ' · tự chia mỗi ngày',
  htTrePre: 'giữ nhịp góp thì đủ vào ',
  htTreGiua: ' — trễ ',
  htTreHau: ' tháng so hạn bạn đặt ',
  htChuaNhipPre: 'chưa có nhịp góp — hạn bạn đặt ',
  htPhanTramHau: ' · nhận phần trăm mỗi lần tiền về',
  htSauVePre: ' ngày sau tiền về chi gấp ',
  htSauVeHau: ' ngày khác — quy tắc % tách phần để dành ra trước phần tiêu',
  htSauVeNgan: ' ngày khác',
  htNoiTienVe: 'bạn kể "lúc vừa có tiền" là lúc dễ quá tay — quy tắc % tách phần để dành ra trước phần tiêu',
  htNoiTienVeNgan: 'bạn kể "lúc vừa có tiền" là lúc dễ quá tay',
  htHuTieu: 'Một hũ chi cho phần chưa chia',
  htChuaChiaGiua: ' chi tháng này (',
  htChuaChiaHau: ') chưa vào túi nào',
  htHuTich: 'Hũ gom đầu tiên',
  htHuTichLy: 'chưa có hũ gom nào đang chạy — tên, mức, hạn do bạn đặt',
  htLuatVe: 'Luật "tiền vừa về" — lời do bạn viết',
  htLuatDam: 'Luật "ngày tiêu đậm" — lời do bạn viết',
  htCuoiTuanPre: 'cuối tuần chi gấp ',
  htCuoiTuanHau: ' ngày thường',
  htNoiNgayDam: 'câu 6 bạn kể một khoảnh khắc dễ quá tay',
  htPhanLoai: 'Hũ nào THIẾT YẾU, hũ nào MUỐN',
  htPhanLoaiPre: 'khung này đếm theo hai phần ấy — ',
  htPhanLoaiHau: ' hũ chi chưa nói',
  htChotTuan: 'Bốn câu cuối tuần',
  htChotTuanLy: 'ô chốt sổ tuần ở cuối màn này — kakeibo mở đầu từ đó',
  nutQuyTac: 'ĐẶT QUY TẮC',
  nutTaoHu: 'TẠO HŨ',
  nutVietLuat: 'VIẾT LUẬT',
  nutMo: 'MỞ',
};

/* ═══ 5f. TẤM HƯỚNG — mô hình DEMO bản 6 (founder 11/10, câu B): APP HỌC ĐƯỢC · HƯỚNG TUẦN TỚI — BẠN CHỌN · TUẦN TRƯỚC ═══
 * Mã và phép đếm ở `pfm/huong.ts` + `pfm/huong_hu.ts`; màn ở `screens/tai-chinh/TheHuong.tsx`.
 * ⚠ A10 🔒 — mô tả + đếm: không "nên/hãy/cần", không "tối ưu". "Ưu tiên <hũ>" là TÊN hũ của người dùng, không phải lời khuyên.
 * ⚠ KHÔNG nhãn nguồn dữ liệu (SỔ · NÓI) trên tấm — luật "không nói thu dữ liệu từ đâu" áp cả HƯỚNG (bài quét `pfm_bento_guong.test.tsx`).
 * ⚠ Thiếu mẫu ⇒ "chưa có lần chia nào" / vắng dòng, KHÔNG 0 (D62).
 */
export const CHU_HUONG = {
  tieu: 'HƯỚNG',
  hoc: 'APP HỌC ĐƯỢC',
  hocRong: 'Chưa đủ để học điều gì. Vài ngày sổ, hoặc lời kể ở phỏng vấn, là đủ cho dòng đầu tiên.',
  // dòng học — MỘT CÂU mô tả ngắn, con số nằm trong câu
  huongGiu: 'tuần bạn làm tới hướng đã chọn',
  luatGiuPre: 'lần bạn giữ luật ',
  giuHan: 'hũ có hạn đang đúng nhịp hoặc đã giữ tới hạn',
  viTheGiua: ': đủ mức vào ',
  viTheNeu: ' nếu giữ nhịp · ',
  viTheTrePre: 'trễ ',
  viTheSomPre: 'sớm ',
  viTheHau: ' tháng so hạn bạn đặt',
  tienVeCatPre: 'lần tiền về, bạn chia vào hũ trong ',
  tienVeCatHau: ' ngày',
  tienVeDonGiua: ' ngày đầu sau tiền về: chi một ngày ',
  tienVeDonHau: ' so ngày khác',
  cuoiTuanPre: 'Cuối tuần: chi một ngày ',
  cuoiTuanHau: ' so thứ Hai–Sáu',
  cuoiThangGiua: ' ngày cuối tháng: chi một ngày ',
  cuoiThangHau: ' so ngày khác',
  chuaChia: 'chi tháng này chưa vào hũ chi nào',
  noiTienVe: 'Tiền vừa về thì ',
  noiNhip: 'Dễ quá tay lúc ',
  noiDauThang: 'Đầu tháng biết tiền đi đâu: ',
  noiKemPre: 'bạn nghĩ: ',
  // HƯỚNG TUẦN TỚI — BẠN CHỌN
  tagChon: 'HƯỚNG TUẦN TỚI — BẠN CHỌN',
  uuTienPre: 'ƯU TIÊN ',
  giuNhuCu: 'GIỮ NHƯ CŨ',
  huKhongCon: 'HŨ ĐÃ ĐÓNG',
  soUuTienPre: 'Ưu tiên ',
  soGiuNhuCu: 'Giữ như cũ',
  lamDungPre: 'làm đúng ',
  lamDungHau: ' lần',
  chuaCoLanChia: 'chưa có lần chia nào',
  chuaCoHuTietKiem: 'Chưa có hũ tiết kiệm nào đang chạy — tuần này chỉ có "giữ như cũ".',
  // chấm
  cham: 'TUẦN TRƯỚC',
  chamRong: 'Chủ nhật app đếm lại hướng bạn chọn — và chấm cả lời đoán của chính nó.',
  lamToi: 'LÀM TỚI',
  chuaToi: 'CHƯA TỚI',
  chuaDungChip: 'CHƯA DỰNG',
  chonKhungPre: 'Chia tiền theo khung ',
  appDoan: 'APP ĐOÁN VỀ BẠN',
  appDungPre: 'đúng ',
  appDungHau: ' lần',
  ngayCoGhiHau: ' ngày có ghi',
  tokenHau: ' token',
  // đầu THẺ (D453) — hai con số TÁCH NHAU: căn cứ nhiều không có nghĩa đoán đúng
  theCanCu: 'CĂN CỨ',
  theCanCuHau: ' quyết định',
  theNgaySoPre: '',
  theNgaySoHau: ' ngày có sổ',
  theDoanDung: 'APP ĐOÁN ĐÚNG',
  theDoanHau: ' tuần đã chấm',
  theChuaCham: 'chưa chấm tuần nào',
  theHaiSoGiai: 'CĂN CỨ đếm những gì app có để hiểu bạn: quyết định bạn bấm (chia vào hũ, đặt hạn, giữ hay vỡ luật, chọn '
    + 'hướng) và số ngày sổ có ghi. APP ĐOÁN ĐÚNG đếm lời đoán tuần của app được chấm trúng bao nhiêu lần trên chính sổ của '
    + 'bạn. Hai số tách nhau: nhiều căn cứ không có nghĩa là đoán đúng.',
  // nắp GƯƠNG (D453 — chín nắp còn bốn)
  napThangPre: 'THÁNG ',
  napHu: 'HŨ ĐÃ XONG · LỜI ĐOÁN',
  napKhung: 'KHUNG CHIA TIỀN',
  napKhungChuaChon: 'chưa chọn',
};

/* ═══ 7. PFM TẦNG KHÔNG GIAN (SPEC `pfm-tang-khong-gian`) ════════════════════════════════════════════════════
 * Chữ của bốn tab bento SỔ · HŨ · GƯƠNG · THẺ + khung. MÔ TẢ, KHÔNG KÊ ĐƠN (A10): được nối vào `moiChuoiPfm` nên bộ quét
 * `TU_KE_DON` chạy trên từng chuỗi. Mặt GƯƠNG không nhãn nguồn (founder 11/10): bài `pfm_bento_guong.test.tsx` quét `NÓI|LÀM|TRẬN…`.
 * Thiếu mẫu ⇒ "chưa đủ để nói", không 0 (D62). Thêm tab nào thì thêm khoá ở ĐÂY, không gõ chữ trong JSX (D26).
 */
export const CHU_BENTO = {
  // khung
  veHub: 'Về Hub',
  // bàn tiền (khay) — đúng chữ demo bản 6
  banChamTo: 'CHẠM TỜ ĐỂ CẦM',
  banDangCam: 'ĐANG CẦM',
  caiDatTen: 'CÀI ĐẶT SỔ',
  caiDatTag: 'số tiền · ghi chú không rời máy',
  dangTai: 'đang tải…',
  chuaDuDeNoi: 'chưa đủ để nói',
  // SỔ
  soChiHomNay: 'CHI HÔM NAY',
  soBayNgay: '7 ngày · cột sáng là hôm nay',
  soChuaGhi: 'chưa ghi khoản nào',
  soThangPre: 'THÁNG ',
  soChi: 'chi',
  soThu: 'thu',
  soGhiPre: 'ghi ',
  soNgayHau: ' ngày',
  soToiNay: 'TỐI NAY',
  soHuDay: '✓ ĐẦY',
  soChuaChia: 'chưa chia vào hũ',
  soChiChuaChia: 'chi chưa chia vào hũ',
  soDaChiaHet: 'đã chia hết',
  soChuaCoHu: 'chưa có hũ nào',
  soHuongTuan: 'HƯỚNG TUẦN NÀY',
  soHuongChua: 'chọn hướng cho tuần này',
  soDsTen: 'SỔ THÁNG',
  soDsTag: 'chạm một dòng để sửa · xoá',
  soToiTag: 'tiền chưa vào hũ nào',
  soToiViPre: 'Tiền còn lại chưa chia',
  soToiChiPre: 'Chi tháng này chưa chia',
  soMoHu: 'MỞ HŨ ĐỂ CHIA ▸',
  soTongChi: 'Tổng chi',
  soTongThu: 'Tổng thu',
  soCungNgayPre: 'So cùng ngày tháng ',
  soBangNhau: 'bằng nhau',
  soItHon: 'ít hơn',
  soNhieuHon: 'nhiều hơn',
  // HŨ — mặt
  huChiaTen: 'CHIA TIỀN TỐI NAY',
  huChiaTag: 'tiền còn lại chia vào hũ',
  huChiaHoi: 'ĐANG HỎI',
  huChiaChuaCo: 'chưa có hũ nào — tạo hũ trước',
  huChiaChua: ' chưa vào hũ nào — chạm để chia',
  huChiaChiChua: ' chi chưa chia vào hũ — chạm để chia',
  huChiaHet: 'đã chia hết · chạm để mở kệ hũ',
  huChuaMuc: 'chưa đặt mức',
  huChiChuaMucPhu: 'đặt mức tháng để thấy phần còn lại',
  huConLaiPre: 'còn ',
  huThangNay: 'tháng này',
  huDaTieuPre: 'đã chi ',
  huMucTieuPre: 'mục tiêu: ',
  huChuaHan: 'chưa có kỳ hạn',
  huBanDoan: 'BẠN ĐOÁN',
  huDoanDu: 'ĐỦ MỨC',
  huChuaDoan: 'chưa có lời đoán',
  huQuyRaPre: 'quy ra ',
  huQuyRaHau: ' mỗi tháng tới hạn',
  huKyTruocPre: 'kỳ trước: ',
  huTaoTk: 'Tạo hũ tiết kiệm',
  huTaoChi: 'Tạo hũ chi',
  huNhomPre: 'Nhóm ',
  huNhomTk: 'TIẾT KIỆM',
  huNhomTkPhu: 'đầy dần · có kỳ hạn',
  huNhomChi: 'CHI',
  huNhomChiPhu: 'cạn dần · làm mới mỗi tháng',
  huConHau: ' hũ con',
  huChuaCoHuTen: 'CHƯA CÓ HŨ',
  huChuaCoHuMoTa: 'Hũ tiết kiệm đầy dần tới mục tiêu · hũ chi cạn dần trong tháng. Chạm để tạo hũ đầu tiên.',
  huUuTien: '★ ƯU TIÊN · HIỆN Ở HUB',
  huHuChinh: 'HŨ CHÍNH',
  huDanhMucPre: 'DANH MỤC THÁNG ',
  huDangGom: 'đang gom',
  huGiaiVach: 'vạch = lời đoán của bạn',
  huGiaiHai: 'hũ tiết kiệm đầy dần · hũ chi cạn dần',
  // HŨ — lớp trượt
  huTaoHu: 'TẠO HŨ',
  huTaoTag: 'ba bước · hũ tiết kiệm hoặc hũ chi',
  huTagTk: 'HŨ TIẾT KIỆM',
  huTagChi: 'HŨ CHI · làm mới mỗi tháng',
  huTaoLai: '‹ LẠI',
  huTaoTiep: 'TIẾP ›',
  huTaoXong: 'TẠO HŨ',
  huBuoc: 'BƯỚC',
  huLoaiHoi: 'HŨ NÀY ĐỂ LÀM GÌ?',
  huLoaiGiai: 'Chọn một lần, lúc tạo, không đổi được sau. Tiết kiệm nhận tiền còn lại và gom tới mức; chi nhận tiền chi (chia bằng tờ) và đếm phần đã tiêu trong tháng. Không chọn thì là tiết kiệm.',
  huMucTieuHoi: 'MỤC TIÊU — VÌ SAO CÓ HŨ NÀY',
  huTuChamKhiToiHan: 'APP TỰ CHẤM KHI TỚI HẠN',
  huChuaDuDeDoan: 'Đặt mức và kỳ hạn ở bước trước thì hũ có lời đoán để app chấm. Bỏ trống cũng được — hũ vẫn chạy như thường.',
  huDoanHoi: 'TỚI HẠN, BẠN NGHĨ HŨ SẼ ĐỦ MỨC',
  huChacHoi: 'BẠN CHẮC TỚI ĐÂU',
  huOLaiMay: 'ở lại máy này',
  huSuaTen: 'SỬA HŨ',
  huQuyetToan: 'CHỐT HŨ',
  huDanhMucTag: 'dòng tiền của tháng · hũ đã đóng',
  huNhomRong: 'Chưa có hũ nào ở nhóm này.',
  huTaoTkNut: '+ TẠO HŨ TIẾT KIỆM',
  huTaoChiNut: '+ TẠO HŨ CHI',
  huMucTieu: 'Mục tiêu',
  huLoiDoanCuaBan: 'LỜI ĐOÁN CỦA BẠN',
  huDoChac: 'độ chắc: ',
  huTuCham: 'app tự chấm khi tới hạn',
  huChuaMucPhu: 'Chưa đặt mức — đặt mức và kỳ hạn thì hũ có lời đoán để app chấm.',
  huChuaDoanPhu: 'Chưa có lời đoán cho kỳ này.',
  huKyTruocTen: 'Kỳ trước',
  huConTieuDe: 'HŨ CON',
  huChuaChiaCon: 'Chưa chia cho hũ con',
  huThemCon: '+ thêm hũ con',
  huSaoNut: '★ Ưu tiên — hiện ở ô Tài chính của Hub',
  huChiaVao: 'CHIA VÀO',
  huNap: 'NẠP',
  huSuaLoiDoan: 'SỬA LỜI ĐOÁN',
  huChacCao: 'CHẮC',
  huChacVua: 'KHÁ CHẮC',
  huChacThap: 'ĐOÁN THÔI',
  huConLoi: 'Chưa lưu được hũ con — dữ liệu cũ còn nguyên.',
  huConCuaPre: 'HŨ CON CỦA ',
  huConDaGop: 'Đã góp',
  huConDaTieu: 'Đã chi tháng này',
  huConMuc: 'Mức',
  huConNapHoi: 'NẠP VÀO HŨ CON NÀY',
  huConChiaHoi: 'CHIA CHI VÀO HŨ CON NÀY',
  huConViConPre: 'ví còn ',
  huConChiConPre: 'chi chưa chia ',
  huConVuotPre: 'Số này vượt phần còn lại: ',
  huConDaNapPre: 'Đã ghi ',
  huConNapNut: 'NẠP',
  huConChiaNut: 'CHIA',
  huConKhongDu: 'Không đủ tiền còn lại — chưa ghi gì.',
  huConThieuMuc: 'Ô mức đang trống.',
  huConTenHoi: 'TÊN HŨ CON',
  huConTenGiuCho: 'Vé xe, chỗ ở…',
  huConMucHoi: 'MỨC CỦA HŨ CON',
  huConNhanPre: 'Còn nhận thêm tới ',
  huConTaoNut: 'TẠO HŨ CON',
  // GƯƠNG — mặt (KHÔNG nhãn nguồn: bài `pfm_bento_guong.test.tsx` quét)
  guHuongTen: 'HƯỚNG · HỌC TRÊN QUYẾT ĐỊNH CỦA BẠN',
  guHuongCanCuHau: ' quyết định để học · chọn hướng tuần tới',
  guHuongChuaDu: 'chưa đủ quyết định để học',
  guHuongTag: 'học trên quyết định của bạn',
  guTieuTang: 'PHÂN TÍCH NÂNG CAO · điều về chính bạn mà bạn chưa biết',
  guDoanThat: 'ĐOÁN ↔ THẬT',
  guDoanThatTag: 'điều bạn nghĩ về mình · điều đang diễn ra',
  guDaTat: 'đã tắt — chỉ số mô tả ngừng tính',
  guDaTatNgan: 'đã tắt',
  guBanNghi: 'bạn nghĩ',
  guThucTe: 'thực tế',
  guCapDu: ' cặp đủ',
  chuaTraLoi: 'chưa trả lời',
  guLanHau: ' lần',
  guDu: 'đủ',
  guGiaiPre: 'Hai bên đặt cạnh nhau; app không chấm khớp hay lệch. Số đo tính trên ',
  guGiaiHau: ' ngày gần nhất.',
  guKetToan: 'KẾT TOÁN',
  guKetToanTag: 'app tự chấm lời đoán của bạn',
  guKetToanNhinLai: 'Tháng ',
  guKetToanNhinLaiHau: ' có câu chờ bạn trả lời ở NHÌN LẠI.',
  guDangMo: 'đang mở',
  guNoiPre: 'nói ',
  guDungPre: 'đúng ',
  guChiDaChia: 'CHI ĐÃ CHIA HŨ',
  guVaoThangHau: ' vào tháng này',
  guChuaCoThu: 'chưa ghi tiền vào',
  guBieuDoTag: 'tiền vào · chi từng ngày · hũ chi',
  guThangTruoc: 'tháng trước',
  guThangTruocChua: 'tháng trước chưa đủ để so',
  guPhanTich: 'PHÂN TÍCH',
  guPhanTichTag: 'những gì bạn làm, đặt cạnh nhau',
  guPhanTichChua: 'Bản tin chỉ nói khi sổ đủ căn cứ — hiện chưa dòng nào đủ.',
  guDieuHau: ' điều đáng chú ý',
  guThoiQuen: 'THÓI QUEN',
  guThoiQuenTag: 'trông như lặp lại',
  guLuat: 'LUẬT NẾU-THÌ',
  guLuatTag: 'lời bạn tự dặn mình',
  guChuaCoLuat: 'chưa có luật',
  guSauThang: '6 THÁNG',
  guSauThangTag: 'chi · thu · để dành theo tháng',
  guNhinLai: 'NHÌN LẠI',
  guNhinLaiTagPre: 'lời đoán · thực tế · tháng ',
  guNhinLaiXong: 'Không còn câu nào chờ bạn ở kỳ trước.',
  guCauHau: ' câu',
  guDaXong: 'đã xong',
  guTienToi: 'TIỀN TỚI',
  guTienToiTag: 'nếu giữ nhịp chi hiện tại',
  guTienToiDu: 'còn dư',
  guChot: 'CHỐT SỔ TUẦN NÀY',
  guDaChot: 'ĐÃ CHỐT TUẦN NÀY',
  guChotTen: 'CHỐT SỔ TUẦN',
  guChotTag: 'niêm phong tuần',
  guChotNgayGhi: 'Ngày đã ghi trong tuần',
  guChotLuat: 'Luật giữ được',
  guChotGiai: 'Chốt là niêm phong tuần này; sau đó sổ của tuần chỉ để xem.',
  guChotNut: 'CHỐT TUẦN',
  // THẺ
  theChanDung: 'CHÂN DUNG CỦA BẠN',
  theChuaVe: 'CHƯA ĐỦ ĐỂ VẼ',
  theThieuPre: 'Còn thiếu câu về ',
  theChipNguon: 'dựng từ câu trả lời · chưa phải từ sổ',
  theBanDoAria: 'Bản đồ chín hành tinh, bạn ở ô sáng',
  theCanCu: 'CĂN CỨ',
  theCanCuTag: 'thẻ này dựa vào đâu',
  theQuyetDinh: ' quyết định',
  theNgaySo: ' ngày sổ',
  theDoanDung: 'APP ĐOÁN ĐÚNG',
  theDoanDungTag: 'app tự chấm lời đoán của chính nó',
  theDoanTuan: 'lời đoán của app theo tuần',
  theChuaCham: 'chưa tuần nào chấm',
  theChuaCoDoan: 'Chân dung này chưa kèm lời đoán nào.',
  theNhatQuan: 'ĐỘ NHẤT QUÁN',
  theNhatQuanTag: 'điều bạn định · điều bạn làm',
  theGiuCamKet: 'GIỮ CAM KẾT',
  theLoiDoanDung: 'ĐOÁN ĐÚNG',
  theChiaHu: 'CHIA VÀO HŨ',
  theHangPhongVan: 'Phỏng vấn',
  theHangSo: 'Sổ',
  theHangTran: 'Trận',
  theCauHau: ' câu',
  theNgayGhiHau: ' ngày ghi',
  theDeHau: ' đề',
  theViecDau: '▶ VIỆC ĐẦU TIÊN CỦA TÔI',
} as const;

/* ═══ 6. TIỆN ÍCH ══════════════════════════════════════════════════════════ */

/** Mọi chuỗi của tự điển, phẳng — cho bộ quét A10 và bài canh độ dài. */
export function moiChuoiPfm(): string[] {
  const ra: string[] = [];
  const bang: Record<string, string>[] = [
    CHU_LOAI_CHI, O_CHU_LOAI_CHI, CHU_HAN, CHU_UU_TIEN, CHU_TRANG_THAI_HU,
    CHU_CHUYEN_TIEP_HU, CHU_TRANG_THAI_NGAY, CHU_DIEU_KIEN, CHU_HANH_DONG_LUAT,
    CHU_TU_LAP, CHU_NGUON_THU, CHU_KHUNG,
    CHU_PILL_HU, CHU_NUT_HU, CHU_KET_QUA_HU, CHU_HIEU_QUA_LUAT, CHU_MAN_HU, CHU_MAN_GUONG, CHU_MAN_SO,
    CHU_CAI_DAT, CHU_VUONG, CHU_NGAY_DAU, CHU_NHOM_NGUON_THU, CHU_GIUP,
    // Chân dung hành tinh (21/09) — quên nối vào đây là bộ quét A10 mù cả màn.
    CHU_HANH_TINH, CHU_HANG_HANH, CHU_COT_HANH, CHU_VANH_HANH,
    CHU_TRUC_HANH, CHU_MAN_CHAN_DUNG,
    // App tự chấm (D385) — quên nối là bộ quét A10 mù cả ô chấm.
    CHU_TU_CHAM,
    // Lời đoán của người dùng (tệp 15 lát 1) — quên nối là bộ quét A10 mù cả khối lời đoán.
    CHU_VI_THE, CHU_LY_DO_VI_THE, CHU_KIEU_VI_THE,
    // Ghi nhanh + phân bổ + tự chia (D410/D420) — quên nối là bộ quét A10 mù cả khay phân bổ.
    CHU_PHAN_BO,
    // Biểu đồ (D426) — quên nối là bộ quét A10 mù cả ba thẻ đầu GƯƠNG lẫn nắp NÓI · LÀM · TRONG TRẬN.
    CHU_BIEU_DO,
    // Phân tích & định hướng (D429) — quên nối là bộ quét A10 mù đúng hai thẻ gần lời khuyên nhất của cả app.
    CHU_DINH_HUONG,
    // Tấm HƯỚNG (D453) — gần lời khuyên hơn cả D429; quên nối là bộ quét A10 mù đúng tấm đứng đầu GƯƠNG.
    CHU_HUONG,
    // PFM tầng không gian (SPEC `pfm-tang-khong-gian`) — quên nối là bộ quét A10 mù cả bốn tab bento.
    CHU_BENTO,
  ];
  for (const b of bang) ra.push(...Object.values(b));
  for (const v of Object.values(VAN_BAN_CONSENT)) {
    ra.push(v.tieuDe, v.tomTat, v.roiMay, v.mayChuKhongDoc, v.chot);
  }
  ra.push(...Object.values(CHU_CONSENT_KHOI));
  ra.push(CHU_LOI_GHI, CHU_THIEU_MUC);
  // CHAN_DUNG_NOI_DUNG không khớp `/^(CHU|O_CHU)_/` (cố ý — xem chú thích đầu bảng),
  // nên flatten TAY ở đây, cùng khuôn VAN_BAN_CONSENT ngay trên.
  for (const v of Object.values(CHAN_DUNG_NOI_DUNG)) {
    ra.push(v.glyph, v.ten);
    if (v.doan) ra.push(v.doan);
  }
  return ra;
}
