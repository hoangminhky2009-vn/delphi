/**
 * DIỆN MẠO — DTO + hooks cho bộ sưu tập, mặc, và XƯỞNG DÁN (work-order 04).
 *
 * Server là chân lý (C4): mọi chuỗi diện mạo hiển thị là chuỗi server trả —
 * client không tự ghép nhãn vào chuỗi để xem trước "cho đẹp", vì dán là VĨNH
 * VIỄN (D36) và bản xem trước sai là một lời hứa sai không thu hồi được.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export interface TacPhamDTO {
  avatar_id: string;
  nen: string;
  seri: number;
  khung_id: string | null;
  chuoi: string;
  an: boolean;
  so_dan: number;
}

export interface AvatarMeDTO {
  dien_mao: string;
  dang_mac: string | null;
  bo_suu_tap: TacPhamDTO[];
  kho: { sticker_id: string; so_luong: number }[];
  khung_so_huu: string[];
}

export interface AvatarCatalogDTO {
  mon: { id: string; ten: string; hiem: string }[];
  dan_toi_da: number;
}

export const KEY_AVATAR_ME = ['avatar-me'] as const;

export function useAvatarMe() {
  return useQuery<AvatarMeDTO>({
    queryKey: KEY_AVATAR_ME,
    queryFn: () => api<AvatarMeDTO>('/avatar/me'),
    staleTime: 60_000,
  });
}

export function useAvatarCatalog() {
  return useQuery<AvatarCatalogDTO>({
    queryKey: ['avatar-catalog'],
    queryFn: () => api<AvatarCatalogDTO>('/avatar/catalog'),
    staleTime: 5 * 60_000,
  });
}

export interface DanInput {
  avatar_id: string;
  sticker_id: string;
  x: number;
  y: number;
  /** Lật ngang nhãn. Server đã nhận trường này từ đầu; client mở ra 12/08 —
   *  chuỗi diện mạo vốn đã mã hoá nó, tức đặc quyền có sẵn mà chưa ai bấm được. */
  lat?: boolean;
  /** Đo NGẦN NGẠI (A7): ms cân nhắc + số lần dời chỗ — client đếm, server log. */
  ms_can_nhac: number;
  so_lan_doi_cho: number;
}

export function useDanSticker() {
  const qc = useQueryClient();
  return useMutation<{ ok: true; chuoi: string; con_lai: number }, Error, DanInput>({
    mutationFn: (b) => api('/avatar/dan', {
      method: 'POST',
      // `xac_nhan` gắn Ở ĐÂY sau khi hộp xác nhận đã bấm — không có đường gọi
      // nào bỏ qua được hộp (D36: dán là tiêu vĩnh viễn).
      body: { ...b, xac_nhan: true },
    }),
    onSuccess: () => { void qc.invalidateQueries(); },
  });
}

export function useMacAvatar() {
  const qc = useQueryClient();
  return useMutation<{ ok: true }, Error, { avatar_id: string }>({
    mutationFn: (b) => api('/avatar/mac', { method: 'POST', body: b }),
    onSuccess: () => { void qc.invalidateQueries(); },
  });
}
