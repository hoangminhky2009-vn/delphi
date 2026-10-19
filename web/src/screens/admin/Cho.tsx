/**
 * Khối "đang tải / lỗi / nội dung" dùng chung cho mọi mặt quản trị.
 *
 * ⚠ TÁCH RA VÌ NÓ ĐÃ CÓ HAI BẢN. `QuanTri.tsx` và `Kho.tsx` từng mỗi bên giữ
 * một bản y hệt — bốn dòng, nên rất dễ bảo "kệ". Nhưng hai bản của cùng một thứ
 * SẼ trôi (D61), và cú trôi ở đây biểu hiện đúng kiểu khó chịu nhất: hai tab
 * cạnh nhau báo lỗi bằng hai câu khác nhau cho cùng một sự cố, và người xem
 * không biết mình đang gặp hai vấn đề hay một.
 *
 * ⚠ D335 — lỗi MÃ HAI LỚP có lối ra riêng. App quản trị nay là một trang riêng, còn cửa nhập mã nằm ở `/admin`;
 * một câu "Không tải được: Nhập mã hai lớp…" mà không có đường bấm sang là bắt người ta tự nhớ URL.
 */
import { ApiError } from '@/api/client';
import s from './QuanTri.module.css';

const MA_HAI_LOP = new Set(['can_mo_khoa_2fa', 'can_ghi_danh_2fa']);

export function Cho(
  { q, con }: { q: { isPending: boolean; error: unknown }; con: React.ReactNode },
) {
  if (q.isPending) return <p className={s.mo}>đang tải…</p>;
  if (q.error) {
    if (q.error instanceof ApiError && MA_HAI_LOP.has(q.error.code)) {
      return (
        <p className={s.loi} data-testid="can-ma-hai-lop">
          {q.error.message}{' '}
          <a className={s.lienKet} href="/admin">Mở khoá ở /admin ›</a>
          {' '}rồi quay lại trang này.
        </p>
      );
    }
    return <p className={s.loi}>Không tải được: {String((q.error as Error)?.message)}</p>;
  }
  return <>{con}</>;
}
