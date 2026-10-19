/**
 * CÀI ĐẶT (D106, founder 22/08: *"game chưa có phần setting, bạn làm luôn đi"*).
 *
 * Hôm nay đúng MỘT tuỳ chọn: GIỌNG HỒ SƠ (tự động theo tuổi · Gen Z · vừa ·
 * chững). Kênh này KHÔNG chạm ví, không chạm trận — nó chỉ đổi một cột trên
 * `users` và làm tươi `/auth/me` để mọi màn đọc giọng từ cùng một chỗ.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { queryKeys } from '@/api/queries';
import type { GiongChon } from '@/lib/tinh_cach';

export interface CaiDatResponse {
  ok: true;
  giong_ho_so: GiongChon;
  age_band: string | null;
}

export function useDoiGiong() {
  const qc = useQueryClient();
  return useMutation<CaiDatResponse, Error, GiongChon>({
    mutationFn: (giong) => api('/me/cai-dat', { method: 'POST', body: { giong_ho_so: giong } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.me }); },
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * CÂU TỰ KHAI (D101 Q4 · D106 bước 6) — cột "ngoài đời" đầu tiên. Đọc + ghi,
 * không chạm ví/trận. Không thưởng gì cho việc trả lời.
 * ══════════════════════════════════════════════════════════════════════════ */

export interface TuKhaiResponse { rui_ro: number | null; ts: string | null }

export function useTuKhai(enabled: boolean) {
  return useQuery({
    queryKey: ['tu-khai', 'me'],
    queryFn: () => api<TuKhaiResponse>('/me/tu-khai'),
    enabled, staleTime: 60_000, refetchOnWindowFocus: false,
  });
}

export function useTraLoiTuKhai() {
  const qc = useQueryClient();
  return useMutation<{ ok: true; rui_ro: number }, Error, number>({
    mutationFn: (traLoi) => api('/me/tu-khai', { method: 'POST', body: { cau: 'rui_ro', tra_loi: traLoi } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['tu-khai', 'me'] }); },
  });
}
