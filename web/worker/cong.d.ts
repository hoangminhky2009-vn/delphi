/**
 * Khai kiểu cho `cong.js`.
 *
 * Vì sao viết tay chứ không đổi `cong.js` thành `.ts`: worker chạy trên runtime
 * Cloudflare và được `wrangler` nạp thẳng, không qua bước biên dịch của Vite —
 * giữ nó là JS thuần là giữ đúng một nguồn cho thứ thật sự được deploy. File
 * này chỉ để `tsc` đọc được từ phía test (`web/tests/cong.test.ts`).
 */

export interface CauHinhCong {
  TRAN_TRONG: number;
  HAN_PASS_S: number;
  HAN_GHE_MS: number;
  HAN_CHO_MS: number;
  NHIP_HOI_S: number;
}

/** Sổ cổng: ai đang trong (kèm mốc hết hạn ghế) và hàng chờ FIFO. */
export interface SoCong {
  trong: Map<string, number>;
  cho: Array<{ ve: string; hoiLuc: number }>;
}

export type QuyetDinhCong =
  | { vao: true; han_s: number }
  | { vao: false; vi_tri: number; tong: number; hoi_lai_s: number };

export const CONG: CauHinhCong;
export function donDep(st: SoCong, now: number, ch?: CauHinhCong): void;
export function quyetDinh(
  st: SoCong, ve: string, now: number, ch?: CauHinhCong,
): QuyetDinhCong;
export function soTrong(): SoCong;
