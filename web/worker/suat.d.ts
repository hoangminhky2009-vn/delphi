/**
 * Khai kiểu cho `suat.js` — cùng lý do `cong.d.ts`: worker là JS thuần do `wrangler` nạp thẳng; tệp này chỉ để `tsc` đọc từ test.
 */
import type { CauHinhSuat } from '../../config/suat_tran';

export interface SoSuat {
  ngay: number;
  daDung: number;
  gioDung: number;
  dungGio: number;
  giu: Map<string, number>;
  cho: Array<{ ve: string; han: number }>;
}

export type KetQuaXinSuat =
  | { vao: true }
  | {
    vao: false; vi_tri: number; tong: number; du_kien: number | null;
    het_ngay: boolean; mo_lai_luc: number; hoi_lai_s: number;
  };

export interface ThongKeSuat {
  gio_vn: number; dung_gio_nay: number; quy_gio: number; con_lai: number;
  da_dung: number; quy_ngay: number; dang_giu: number; dang_cho: number;
}

export function soSuatTrong(): SoSuat;
export function conLai(st: SoSuat, now: number, ch?: CauHinhSuat): number;
export function xinSuat(st: SoSuat, ve: string, now: number, ch?: CauHinhSuat): KetQuaXinSuat;
export function baoKetQua(st: SoSuat, ve: string, ok: boolean, now: number): void;
export function thongKe(st: SoSuat, now: number, ch?: CauHinhSuat): ThongKeSuat;
