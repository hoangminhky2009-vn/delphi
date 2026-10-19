/** Khai kiểu cho `dem.js` — cùng lý do với `cong.d.ts`: worker là JS thuần, file này chỉ để `tsc` phía test đọc. */

export interface BoDem {
  cho: number;
  lanXa: number;
}

export const LO_XA: number;
export const NHIP_XA_MS: number;
export function boDemMoi(now?: number): BoDem;
export function ghiLuot(bd: BoDem, now?: number): number;
export function khoaThang(now?: number): string;
