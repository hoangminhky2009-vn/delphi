/** Nhãn hiển thị tiếng Việt cho mã danh mục (mã là của server — config/auth.ts). */
import type { AgeBand, OccupationBand, Region } from '@config/auth';
import type { Pool, WalletReason } from '@/api/types';

export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  '16-17': '16–17',
  '18-22': '18–22',
  '23-30': '23–30',
  '31-45': '31–45',
  '46+': '46+',
};

export const REGION_LABELS: Record<Region, string> = {
  bac: 'Miền Bắc',
  trung: 'Miền Trung',
  nam: 'Miền Nam',
  khac: 'Khác',
};

export const OCCUPATION_LABELS: Record<OccupationBand, string> = {
  hs_sv: 'Học sinh · SV',
  van_phong: 'Văn phòng',
  tu_do: 'Tự do',
  khac: 'Khác',
};

export const POOL_LABELS: Record<Pool, string> = {
  macro: 'VĨ MÔ',
  life: 'ĐỜI SỐNG',
  event: 'SỰ KIỆN',
};

/** Nhãn lý do bút toán ví (wallet_ledger.reason). */
export const WALLET_REASON_LABELS: Record<WalletReason, string> = {
  signup_grant: 'Vốn khởi điểm',
  bet_place: 'Phân bổ vào câu hỏi',
  bet_adjust: 'Điều chỉnh phân bổ',
  payout: 'Nhận từ pool',
  refund: 'Hoàn token',
  subsidy: 'Trợ cấp ngày',
  admin_adjust: 'Điều chỉnh hệ thống',
};
