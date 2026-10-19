/**
 * LỘ TRÌNH MÙA + NHIỆM VỤ — DTO + hooks DÙNG CHUNG (Hub tóm tắt · /hanh-trinh
 * trang đầy đủ). Tách khỏi Hub.tsx 01/08 khi founder lệnh "làm thành 1 trang
 * riêng như TFT/LOL": hai màn cùng đọc MỘT nguồn, không ai giữ bản sao DTO.
 *
 * LUẬT DỮ LIỆU (C4): mọi con số là số SERVER trả. Client không đếm việc, không
 * suy chặng, không cộng Q, không tự biết hôm nay tuần mấy. Điểm danh ghi đè
 * cache bằng ĐÚNG payload server — bấm một nút có thể đóng việc ⟹ mở chặng ⟹
 * trao Q, và chỉ server biết chuỗi đó dừng ở đâu.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './queries';

export interface ViecDTO {
  nv_id: string;
  ten: string;
  muc: number;
  da: number;
  xong: boolean;
}

export interface MocDTO {
  chang_no: number;
  q: number;
  /** Nhãn cosmetic của mốc (vd Áo Trùm Đầu) — null nếu mốc chỉ trả Q. */
  nhan: string | null;
  doc_ban: boolean;
  da_nhan: boolean;
  /** Phần thưởng đã chốt thiết kế nhưng CHƯA có art — UI phải nói thật. */
  cho_art: boolean;
}

export interface LoTrinhDTO {
  mua_mo: boolean;
  tuan: number | null;
  so_tuan: number;
  chang: number;
  so_chang: number;
  quest_points: number;
  viec: ViecDTO[];
  da_diem_danh_hom_nay: boolean;
  moc: MocDTO[];
}

/** Khoá cache dùng chung — Hub và /hanh-trinh phải cùng nhìn một bản. */
export const KEY_LO_TRINH = ['nhiem-vu'] as const;

export function useLoTrinh() {
  return useQuery<LoTrinhDTO>({
    queryKey: KEY_LO_TRINH,
    queryFn: () => api<LoTrinhDTO>('/me/nhiem-vu'),
    // KHÔNG polling (D11): lộ trình chỉ đổi do chính người chơi gây ra ở màn khác.
    staleTime: 60_000,
  });
}

export function useDiemDanh() {
  const qc = useQueryClient();
  return useMutation<LoTrinhDTO, Error, void>({
    mutationFn: () => api<LoTrinhDTO>('/me/nhiem-vu/diem-danh', { method: 'POST' }),
    onSuccess: (d) => qc.setQueryData(KEY_LO_TRINH, d),
  });
}

// ─────────────────────── QUÀ TRI ÂN MÙA BETA (D68b) ───────────────────────

export interface QuaBetaDTO {
  da_nhan: boolean;
  viec_loi_xong: number;
  viec_loi_can: number;
  so_tran: number;
  so_tran_can: number;
  du_dieu_kien: boolean;
  con_suat: number;
  tran_nguoi: number;
  qua: { t: number; q: number; the_phong: number; sticker_id: string };
}

export interface NhanQuaBetaDTO {
  ok: true;
  so_thu_tu: number;
  bankroll: number;
  quest_points: number;
  the_tao_phong: number;
  sticker_id: string;
  tien_do: QuaBetaDTO;
}

export const KEY_QUA_BETA = ['qua-beta'] as const;

export function useQuaBeta() {
  return useQuery<QuaBetaDTO>({
    queryKey: KEY_QUA_BETA,
    queryFn: () => api<QuaBetaDTO>('/me/qua-beta'),
    // Không polling: tiến độ chỉ đổi do chính người chơi làm việc ở màn khác.
    staleTime: 60_000,
  });
}

export function useNhanQuaBeta() {
  const qc = useQueryClient();
  return useMutation<NhanQuaBetaDTO, Error, void>({
    mutationFn: () => api<NhanQuaBetaDTO>('/me/qua-beta/nhan', { method: 'POST' }),
    onSuccess: (d) => {
      qc.setQueryData(KEY_QUA_BETA, d.tien_do);
      /*
       * Nhận quà đổi CẢ BỐN số (ví · Q · thẻ · kho sticker) nên phải làm mới cả
       * ba nguồn đọc chúng. Bỏ sót một chỗ thì màn đó hiện số cũ tới lần refetch
       * kế tiếp — và người chơi đọc ra "quà chưa vào".
       */
      qc.invalidateQueries({ queryKey: KEY_LO_TRINH });
      qc.invalidateQueries({ queryKey: ['shop-catalog'] });
      qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}
