/**
 * Ô ĐỒNG Ý NGHIÊN CỨU + "DỮ LIỆU CỦA TÔI" + BÁO LỖI — TỰ ĐIỂN CHỮ (SPEC chan-truoc-beta; D26/A11.9: server trả ID + số, chữ ở client).
 *
 * ⚠⚠⚠ SỬA MỘT CHỮ TRONG `VAN_BAN_NGHIEN_CUU` ⇒ TĂNG `CONSENT_PHIEN_BAN.nghien_cuu` (`config/pfm_consent.ts`), thêm bản mới vào
 * `CONSENT_LICH_SU`, thêm một dòng hash ở `web/tests/buoi_do_chu.test.ts` — KHÔNG sửa dòng cũ. Vết đồng ý trong `events` trỏ về
 * (nghien_cuu, phiên bản): hai nội dung dưới một tên là vết giả. Lên bản mới ⇒ mọi người đang đồng ý bản cũ bị coi như TẮT và hỏi lại.
 *
 * ⚠ Văn bản chỉ tả ĐÚNG thứ đang chạy: cổng `/telemetry` (`server/telemetry.ts`) · danh sách trắng `chi_tiet` (`config/telemetry.ts`)
 * · cửa xếp hạng đòi ô này (`server/nghien_cuu.ts`). Đổi một trong ba ⇒ đọc lại văn bản này.
 */
import type { VanBanConsent } from './pfm_chu';

/** v1 (11/10) — bản đầu có số. */
export const VAN_BAN_NGHIEN_CUU: VanBanConsent = {
  tieuDe: 'GHI CÁCH DÙNG APP',
  tomTat: 'Cho tụi mình ghi lại cách bạn dùng app để biết chỗ nào khó hiểu, chỗ nào hay lỗi mà sửa. Bật ô này cũng là điều kiện vào xếp hạng, vì lúc đó tên bạn đứng cạnh tên người lạ.',
  roiMay: 'Rời máy: bạn ở màn nào bao lâu, bỏ hướng dẫn ở bước nào, màn nào báo lỗi — gắn với tài khoản của bạn.',
  mayChuKhongDoc: 'Không ghi: chữ bạn gõ, sổ chi tiêu trên máy, vị trí, danh bạ, ảnh.',
  chot: 'Tắt lúc nào cũng được ở Hồ sơ → Dữ liệu của tôi, tụi mình ngừng ghi ngay. Tắt thì xếp hạng khoá, chơi tự do vẫn đủ. Mùa này không bán, không chia cho ai.',
};

export const CHU_NGHIEN_CUU = {
  /** Tấm hỏi lại (người bật ô từ trước khi có số bản). */
  hoiLaiTieuDe: 'ĐIỀU KHOẢN DỮ LIỆU CÓ BẢN MỚI',
  hoiLaiMo: 'Ô "ghi cách dùng app" giờ có văn bản đánh số. Bạn từng bật ô này — đọc lại rồi chọn nhé. Chưa chọn thì tụi mình coi như TẮT.',
  dongY: '✓ ĐỒNG Ý',
  khong: 'KHÔNG, CẢM ƠN',
  dangLuu: 'ĐANG LƯU…',
  loiLuu: '✕ Chưa lưu được. Kiểm tra mạng rồi thử lại nhé.',
  ban: 'bản',
  docDieuKhoan: 'Đọc điều khoản đầy đủ →',
} as const;

/** Lớp trượt "Dữ liệu của tôi". */
export const CHU_DU_LIEU = {
  nhan: 'Dữ liệu của tôi',
  tieuDe: 'DỮ LIỆU CỦA TÔI',
  mo: 'Mọi thứ tụi mình đang giữ về bạn. Tải về là ra một tệp .json chứa đủ các dòng dưới đây.',
  hoSo: 'HỒ SƠ',
  email: 'Email',
  ten: 'Tên hiển thị',
  nhom: 'Nhóm (dạng khoảng)',
  chuaKhai: 'chưa khai',
  thamGia: 'Tham gia',
  dongY: 'Ô ĐỒNG Ý',
  nghienCuu: 'Ghi cách dùng app',
  dangBat: 'đang bật',
  dangTat: 'đang tắt',
  vet: 'LỊCH SỬ BẬT / TẮT',
  chuaCoVet: 'Chưa bật/tắt lần nào.',
  daGhi: 'ĐÃ GHI',
  soTran: 'Trận đã chơi',
  dongGhi: 'Dòng ghi hành vi (theo loại)',
  telemetry: 'Dòng ghi cách dùng app',
  baoLoi: 'Báo lỗi bạn đã gửi',
  pfmMayChu: 'Dòng sổ chi tiêu máy chủ giữ',
  taiVe: '⬇ TẢI VỀ (.json)',
  dangTai: 'ĐANG GOM…',
  loiTai: '✕ Chưa tải được. Thử lại nhé.',
  loiDoc: 'Không đọc được dữ liệu. Thử lại nhé.',
  thuLai: '↻ THỬ LẠI',
  xoaSo: 'XOÁ SẠCH SỔ CHI TIÊU',
  xoaSoGiai: 'Xoá cả bản trên máy này lẫn bản máy chủ giữ, đóng luôn bốn cửa. Không xoá tài khoản.',
  xoaSoChac: 'BẤM LẦN NỮA ĐỂ XOÁ HẲN',
  daXoaSo: '✓ Đã xoá sạch sổ.',
  loiXoaSo: '✕ Chưa xoá được — máy chủ chưa xoá thì máy này cũng chưa xoá. Thử lại nhé.',
} as const;

/** Nhãn một số loại ghi hay gặp — loại không có ở đây hiện nguyên mã (server trả mã, không trả chữ). */
export const NHAN_LOAI_GHI: Readonly<Record<string, string>> = {
  hd_cam_ket: 'quyết định mỗi vòng',
  hd_chot_phien: 'kết quả mỗi vòng',
  hd_brier_vong: 'độ chuẩn mỗi vòng',
  hd_match_end: 'kết thúc trận',
  onboard_demo: 'khai hồ sơ',
  avatar_chon: 'chọn ảnh đại diện',
  handle_doi: 'đổi tên',
  nghien_cuu_dong_y: 'bật ghi cách dùng app',
  nghien_cuu_rut: 'tắt ghi cách dùng app',
  pfm_consent: 'mở một cửa sổ chi tiêu',
  pfm_tat: 'đóng một cửa sổ chi tiêu',
  hd_dong_y_buoi_do: 'đồng ý buổi đo',
  hd_rut_buoi_do: 'rút đồng ý buổi đo',
};

/** Tên văn bản cho dòng vết. */
export const NHAN_VAN_BAN: Readonly<Record<string, string>> = {
  nghien_cuu: 'Ghi cách dùng app',
  buoi_do: 'Buổi đo',
  pfm_ket: 'Sổ · sao lưu két',
  pfm_dac_trung: 'Sổ · đặc trưng nghiên cứu',
  pfm_thuong: 'Sổ · điểm danh và token',
  pfm_noi_game: 'Sổ · nối thẻ với sổ',
};

/** Chữ Báo lỗi: `web/src/content/baoLoi.ts` (T9 · T10 founder duyệt nguyên văn — SPEC bao-loi-nguoi-choi). */
