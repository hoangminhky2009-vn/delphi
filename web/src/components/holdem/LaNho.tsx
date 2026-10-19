/**
 * LÁ NHỎ — một lá bài trong hàng lá của MÀN KẾT (ô của mình · lớp LẬT BÀI). Chuyển từ `AlphaDraftMatch.tsx` khi màn kết tách thành
 * `screens/holdem/ManKet.tsx` (SPEC `alpha-draft-tang-khong-gian`, founder 11/10: *"lá bài ở màn kết giữ kiểu lá hiện có"* — mặt giấy kem
 * chưa đổi, `docs/thiet-ke-de-xuat/noi-dung/la-bai-mat-giay.md`).
 *
 * Dùng CHÍNH art pixel server cấp (`/holdem/art`, đã có sẵn trong `artQ`), nên lá lật ngửa cuối trận là ĐÚNG vật người chơi cầm lúc chơi —
 * không phải một cái nhãn chữ mô tả lại nó. `svg` vắng (art chưa tải xong / thẻ mới hơn bộ art) ⇒ vẫn hiện TÊN: thà một lá không có hình
 * còn hơn một ô trống không ai đọc được. `gon` = bản nhỏ cho ô của mình (chỉ hình, tên ở `title`).
 */
import { htmlTinh } from '@/lib/html_tinh';
import s from './LaNho.module.css';

export function LaNho({ id, ten, art, ct = false, gon = false }: {
  id: string; ten: string; art?: Record<string, string> | undefined; ct?: boolean; gon?: boolean;
}) {
  const svg = art?.[id];
  return (
    <span className={`${s.laNho} ${ct ? s.laNhoCt : ''} ${gon ? s.gon : ''}`} title={ten}>
      {svg
        ? <span className={s.laNhoArt} aria-hidden dangerouslySetInnerHTML={htmlTinh(svg)} />
        : null}
      <span className={gon && svg ? s.anTen : s.laNhoTen}>{ten}</span>
    </span>
  );
}
