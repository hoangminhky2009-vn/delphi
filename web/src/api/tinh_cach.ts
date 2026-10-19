/**
 * TÍNH CÁCH TÀI CHÍNH — kênh ĐỌC THUẦN, đứng NGOÀI ví trận lẫn ví T.
 *
 * ⚠⚠ VÌ SAO PHẢI LÀ MODULE RIÊNG, KHÔNG NẰM TRONG `api/holdem`:
 * tường lửa D24 (holdem_firewall.test.ts) cấm mọi MÀN import cả `api/queries`
 * (ví T) lẫn `api/holdem` (ví trận) — màn trung gian cầm cả hai là chỗ có thể
 * dựng cầu quy đổi chip↔T. Trang Tài chính cá nhân CẦN cả hồ sơ hành vi (từ
 * trận) lẫn dòng token (từ ví), nhưng nó không cần một mutation trận nào —
 * nên thứ đứng chung nhà với nó phải là một kênh KHÔNG CÓ KHẢ NĂNG giao dịch.
 *
 * Luật của file này (tường lửa có bài canh riêng):
 *  · KHÔNG import `api/holdem` / `api/arena` — chỉ kiểu từ server insight.
 *  · KHÔNG mutation — chỉ useQuery đọc.
 * Ai cần thêm hook ở đây phải giữ đúng hai luật đó, không thì bài firewall đỏ.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { HoSoGoi } from '@server/hanh_vi/goi';
import type { SoTayDTO } from '@server/holdem/khoanh_khac_ids';
import type { NangLucCuaToiDTO } from '@server/holdem/nang_luc_ids';
import type { TinHieuGameDTO } from '@server/hanh_vi/tin_hieu_ids';

export type { HoSoTinhCach } from '@server/holdem/insight';
/** D106 — hồ sơ theo GÓI: thẻ của gói đầy gần nhất + tiến độ gói đang mở + lịch sử. */
export type { HoSoGoi } from '@server/hanh_vi/goi';
export type { SoTayDTO, SoTayKhaiNiem } from '@server/holdem/khoanh_khac_ids';

/**
 * 12/09 (Q3) — TÊN MẶT SỰ KIỆN + MÃ cho SỔ LIÊN HỆ ở trang Tài chính: đọc catalog
 * công khai (`/holdem/catalog`, cùng nguồn tên với màn trận — D26 một tự điển),
 * KHÔNG qua `api/holdem` (luật tệp này). Chỉ lấy id + label, không gì khác.
 */
export interface TuDienMatDTO {
  su_kien: { id: string; label: string }[];
  tai_san: { id: string; label: string }[];
}
export function useTuDienMat(enabled: boolean) {
  return useQuery({
    queryKey: ['tinh-cach', 'tu-dien-mat'],
    queryFn: async () => {
      const c = await api<{ su_kien: { id: string; label: string }[]; tai_san: { id: string; label: string }[] }>('/holdem/catalog');
      return {
        su_kien: c.su_kien.map((x) => ({ id: x.id, label: x.label })),
        tai_san: c.tai_san.map((x) => ({ id: x.id, label: x.label })),
      } satisfies TuDienMatDTO;
    },
    enabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useTinhCach(enabled: boolean) {
  return useQuery({
    queryKey: ['tinh-cach', 'me'],
    queryFn: () => api<HoSoGoi>('/holdem/me/tinh-cach'),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * SỔ TAY KHÁI NIỆM (16/08, "vá lối chơi" tầng 3) — khái niệm bạn đã chạm qua
 * các trận đã xong: mấy trận, lần đầu, cú nặng nhất. Chỉ ĐỌC; kiểu import từ
 * `khoanh_khac_ids` (không chạm engine lẫn ví trận) — đúng hai luật của file.
 */
export function useSoTay(enabled: boolean) {
  return useQuery({
    queryKey: ['tinh-cach', 'so-tay'],
    queryFn: () => api<SoTayDTO>('/holdem/me/so-tay'),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * THẺ NĂNG LỰC theo NGƯỜI (D323) — ba năng lực gộp qua mọi đề đã xong, bậc
 * `chung_minh` chỉ khi làm được ở ≥ 2 đề khác seed. Chỉ ĐỌC; kiểu import từ
 * `nang_luc_ids` (không chạm engine lẫn ví trận) — đúng hai luật của file.
 */
/**
 * TÍN HIỆU GAME CHO PFM (D324) — mặt "TRONG TRẬN" của gương + ⚑ ở phỏng vấn. Người gọi
 * chỉ bật khi cửa `noi_game` mở. Chỉ ĐỌC; kiểu từ `tin_hieu_ids` (không kéo pg/engine).
 */
export function useTinHieuGame(enabled: boolean) {
  return useQuery({
    queryKey: ['tinh-cach', 'tin-hieu'],
    queryFn: () => api<TinHieuGameDTO>('/holdem/me/tin-hieu'),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useNangLuc(enabled: boolean) {
  return useQuery({
    queryKey: ['tinh-cach', 'nang-luc'],
    queryFn: () => api<NangLucCuaToiDTO>('/holdem/me/nang-luc'),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
