/**
 * Hooks khu VẬN HÀNH của app quản trị riêng (D335) — các khối dời từ trang `/admin` (máy chủ vẽ) sang.
 *
 * ⚠ CHỈ import từ `src/quan-tri/` (`web/tests/quantri.test.tsx` canh tách gói).
 * ⚠ Ở đây CHỈ có đọc và tạo NHÁP. Mở kèo (rút seed Kho bạc) · chốt kết quả · huỷ kèo là thao tác chuyển token
 *   không hoàn tác — chúng ở lại `/admin`, trang không phụ thuộc bản build web (đường thoát §8.1).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './client';

const thuLai = (lan: number, loi: unknown): boolean => {
  if (loi instanceof ApiError && loi.status >= 400 && loi.status < 500) return false;
  return lan < 1;
};

export interface ViecDTO {
  markets: Array<{
    market_id: string;
    question_text: string;
    status: 'draft' | 'locked';
    pool: string;
    lock_ts: string;
    resolution_source_name: string;
    seed_per_option: number;
    total_volume: number;
    options: Array<{ option_id: string; label: string; volume: number; participants: number }>;
  }>;
}

export const useViecCanLam = () =>
  useQuery({ queryKey: ['admin', 'vh', 'viec'], queryFn: () => api<ViecDTO>('/admin/pending'), retry: thuLai });

/** SPEC chan-truoc-beta — báo lỗi người chơi tự gửi (bảng `bao_loi`, 0079). Chữ người chơi gõ CHỈ đọc ở đây (không đi Sentry). */
export interface BaoLoiDTO {
  bao_loi: { bao_loi_id: string | number; ts: string; noi_dung: string; man: string | null; ban: string | null; ma_loi: string | null; handle: string }[];
}

export const useBaoLoiAdmin = () =>
  useQuery({ queryKey: ['admin', 'vh', 'bao-loi'], queryFn: () => api<BaoLoiDTO>('/admin/bao-loi'), retry: thuLai });

export interface DashboardDTO {
  audit_ok: boolean;
  audit_problems: string[];
  supply: Record<string, number | string>;
  users: number;
  bankroll_median: number;
  bankroll_p90: number;
  bankroll_gini: number;
  markets_by_status: Record<string, number>;
}

export const useDashboardKinhTe = () =>
  useQuery({ queryKey: ['admin', 'vh', 'dashboard'], queryFn: () => api<DashboardDTO>('/admin/dashboard'), retry: thuLai });

/** Gương của `BaoCaoKinhTe` (`server/kinh_te/bao_cao.ts`). Số lớn đi dạng chuỗi (bigint). */
export interface BaoCaoDTO {
  mauSo: { tongTaiKhoan: number; tester: number; khach: number; that: number; canhBaoMauSo: boolean };
  baoDong: Array<{ muc: 'do' | 'vang'; ma: string; do: string; nguong: string }>;
  cung: { mintRong: string; daDot: string; tongCung: string; sigmaVi: string; khoBac: string; can: boolean; vanDe: string[] };
  khoBacDong: { chiMoiNgay7Ngay: string; runwayNgay: number | null };
  troCap: { phat7Ngay: string; dotBoiNguoiNhan7Ngay: string; vaoLoDotBp: number | null; soNguoiDuDieuKien: number; tuanDuKien: string; ghiChu: string };
  q: { phat: string; tieu: string; ton: string; tranPhatMua: string; sinkPhatBp: number | null };
  xuHuong: { cuaSoNgay: number; phat: string; dot: string; sinkFaucetBp: number | null };
  phanPhoi: { tren: string; medianVi: string | null; giniBp: number | null };
}

export const useBaoCaoKinhTe = () =>
  useQuery({ queryKey: ['admin', 'vh', 'kinh-te'], queryFn: () => api<BaoCaoDTO>('/admin/kinh-te'), retry: thuLai });

export interface ThanKeoNhap {
  pool: 'macro' | 'life' | 'event';
  question_text: string;
  resolution_source_name: string;
  resolution_source_url: string;
  open_ts: string;
  lock_ts: string;
  resolve_deadline_ts: string;
  seed_per_option: number;
  options: Array<{ label: string }>;
}

export function useTaoKeoNhap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (than: ThanKeoNhap) => api<{ market_id: string }>('/admin/markets', { method: 'POST', body: than }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'vh', 'viec'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'keo'] });
    },
  });
}
