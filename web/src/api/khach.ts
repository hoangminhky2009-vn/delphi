/**
 * CHƠI NGAY, KHÔNG ĐĂNG NHẬP (founder chốt 04/08).
 *
 * ⭐ Cửa này còn là ĐƯỜNG VÒNG QUA MỘT LỖI ĐANG CHẶN: trong iframe Discord,
 * cookie `SameSite=Lax` không được gửi nên đăng nhập bằng email không dính. Máy
 * chủ trả token ra THÂN phản hồi để mang bằng `Authorization: Bearer` — cùng
 * đường đã làm cho Discord, chạy được ở cả hai chỗ.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './queries';
import { datTokenDiscord } from '@/lib/discord_phien';

export interface KhachResponse {
  token: string;
  handle: string;
  la_khach: true;
}

export function useVaoKhach() {
  const qc = useQueryClient();
  return useMutation<KhachResponse, Error, void>({
    mutationFn: () => api<KhachResponse>('/auth/khach', { method: 'POST' }),
    onSuccess: (d) => {
      /*
       * Giữ token trong BỘ NHỚ, dùng lại đúng chỗ đã dựng cho Discord — không
       * localStorage. Cookie phiên là HttpOnly nên XSS không đọc được; để token
       * xuống đĩa là tự tay dựng lại đúng cái lỗ hổng HttpOnly sinh ra để bịt.
       *
       * Trên web thường thì cookie đã được đặt sẵn nên token này chỉ là đường
       * thứ hai; trong iframe thì nó là đường DUY NHẤT.
       */
      datTokenDiscord(d.token);
      return qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}
