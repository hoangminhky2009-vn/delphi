/**
 * CHỮ CỦA APP QUẢN TRỊ (D335) — server trả ID + SỐ, chữ ở đây (D26).
 *
 * Mọi bảng dưới có ĐƯỜNG LÙI: mã chưa có tên thì hiện nguyên mã, không hiện rỗng — một nút mới thêm ở app mà
 * quên đặt tên ở đây vẫn đọc được trên dòng thời gian (chỉ xấu hơn), thay vì biến mất.
 */
import { WALLET_REASON_LABELS } from '@/lib/labels';

export type Khu = 'tong' | 'nguoi' | 'phan' | 'sp' | 'vh' | 'dl' | 'tester';
export const KHU_DS: readonly Khu[] = ['tong', 'nguoi', 'phan', 'sp', 'tester', 'vh', 'dl'];

/** Chữ trên NÚT của rail. Ba khu gom về nằm dưới một nhãn nhóm cùng tên, nên nút kể nội dung (theo demo). */
export const TEN_KHU: Record<Khu, string> = {
  tong: 'TỔNG QUAN', nguoi: 'NGƯỜI DÙNG', phan: 'PHÂN KHÚC',
  sp: 'TRẬN · KÈO · TÍNH CÁCH',
  // D362 — khu riêng cho đợt thử nghiệm; tên nói rõ nó đọc TỪNG NGƯỜI, khác hẳn mọi khu còn lại.
  tester: 'TESTER · TỪNG NGƯỜI',
  vh: 'VIỆC · KINH TẾ · KÈO', dl: 'KHO DỮ LIỆU',
};

/** Tên màn theo MẪU route (`config/telemetry.ts` MAN_HOP_LE). */
const TEN_MAN: Readonly<Record<string, string>> = {
  '/': 'Sảnh chính',
  '/du-bao': 'Dự báo',
  '/ket-qua': 'Kết quả dự báo',
  '/keo/:marketId': 'Một câu hỏi dự báo',
  '/keo/:marketId/ket-qua': 'Kết quả một câu hỏi',
  '/arena': 'Sảnh Đấu trường',
  '/arena/huong-dan': 'Hướng dẫn',
  '/arena/ban/:banMa': 'Phòng chờ bàn',
  '/arena/tran/:matchId': 'Trong trận',
  '/arena/tran': 'Trận',
  '/alpha-draft': 'Sảnh Alpha Draft',
  '/alpha-draft/tran': 'Trận Alpha Draft',
  '/buoi-do': 'Buổi đo (điều phối)',
  '/bach-khoa': 'Bách khoa',
  '/bach-khoa/:mucId': 'Mục Bách khoa',
  '/dieu-khoan': 'Điều khoản',
  '/vi': 'Ví',
  '/shop': 'Shop',
  '/hanh-trinh': 'Hành trình mùa',
  '/ho-so': 'Hồ sơ',
  '/tai-chinh': 'Tài chính',
  '/tai-chinh/the': 'Thẻ tính cách',
  '/tai-chinh/phong-van': 'Phỏng vấn tài chính',
  '/tai-chinh/lo-trinh': 'Lộ trình',
  '/tai-chinh/cam-ket': 'Cam kết',
  '/tai-chinh/so': 'Sổ chi tiêu',
  '/tai-chinh/hu': 'Hũ',
  '/tai-chinh/guong': 'Gương',
  '/cai-dat': 'Cài đặt',
  '/onboard': 'Cửa vào',
  '/onboard/dang-ky': 'Đăng ký',
  '/onboard/quen-mat-khau': 'Quên mật khẩu',
  '/onboard/ho-so': 'Lập hồ sơ',
  '/verify-email': 'Xác minh email',
  '/reset-password': 'Đặt lại mật khẩu',
  '*': 'Trang không có',
  khac: 'Màn không nhận ra',
};
export const tenMan = (man: string | null): string => (man === null ? '—' : TEN_MAN[man] ?? man);

/** Mã `cham_nut.nut` → tên nút. */
const TEN_NUT: Readonly<Record<string, string>> = {
  'shop-chip-truoc': 'chạm chip lệnh trước (shop)',
  'shop-la-truoc': 'chạm lá lệnh trước (shop)',
  'so-lien-he': 'mở SỔ LIÊN HỆ',
  'vi-sao': 'mở VÌ SAO',
};
export const tenNut = (nut: string | null): string => (nut === null ? 'chạm một nút' : TEN_NUT[nut] ?? `chạm ${nut}`);

const TEN_LY_DO: Readonly<Record<string, string>> = {
  ...WALLET_REASON_LABELS,
  gacha_burn: 'Quay hộp',
};
export const tenLyDoToken = (ma: string): string => TEN_LY_DO[ma] ?? ma;

const TEN_TAI_CHINH: Readonly<Record<string, string>> = {
  pfm_ghi: 'Ghi sổ chi tiêu',
  pfm_ket_thang_dong: 'Két: đọc một tháng đã đóng',
  pfm_ket_qua_lon: 'Két: gói quá lớn',
  pfm_lo_loi: 'Sổ: một lô đồng bộ lỗi',
};
export const tenTaiChinh = (ma: string): string => TEN_TAI_CHINH[ma] ?? ma;

const TEN_CHE_DO: Readonly<Record<string, string>> = {
  tu_do: 'tự do', rank_pve: 'xếp hạng', rank_slot: 'xếp hạng', rank_bu: 'xếp hạng', phong_rieng: 'phòng riêng',
};
export const tenCheDo = (ma: string | null): string => (ma === null ? '' : TEN_CHE_DO[ma] ?? ma);

export const tenBuocHuongDan = (buoc: string | null): string => {
  if (buoc === 'het') return 'Xong màn tập';
  if (buoc === 'tat-tro-ly') return 'Tắt trợ lý màn tập';
  return `Màn tập · bước ${buoc ?? '?'}`;
};

export const TEN_TUAN_GIU = ['tuần 1', 'tuần 2', 'tuần 3', 'tuần 4'] as const;
