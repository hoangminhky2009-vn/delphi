/**
 * DẢI "MẤT KẾT NỐI" — toàn app.
 *
 * Founder 11/08: *"đảm bảo luôn trải nghiệm cho những người mạng kém/chập chờn
 * để họ ko quá khó chịu khi dùng app"*. Trước bản này người chơi không có cách
 * nào biết vấn đề nằm ở mạng của họ hay ở app: nút mờ đi 15 giây rồi thôi.
 *
 * ─── BA RÀNG BUỘC ──────────────────────────────────────────────────────────
 * 1. `position: fixed` + `pointer-events: none` — TUYỆT ĐỐI không đẩy bố cục.
 *    Màn trận là ba tầng cứng trong một khung hình (D47); một dải chen vào
 *    luồng sẽ ĐẨY bàn đấu xuống đúng lúc người chơi đang cân mốc lệnh.
 * 2. Chỉ animate `opacity` (D68) — không tốn một lần tính lại layout nào.
 * 3. Nói ĐÚNG thứ mình biết: "không nói được với máy chủ", KHÔNG phải "bạn mất
 *    mạng" (có thể là máy chủ đang chết) và KHÔNG phải "dữ liệu đã mất" (server
 *    có thể đã nhận rồi). Cảnh báo nói quá là cảnh báo dạy người ta phớt lờ.
 *
 * ⚠ KHÔNG có nút "thử lại" ở đây: dải này không biết người chơi đang làm dở
 * việc gì. Thử lại là việc của chính màn đang mở — và nó tự làm khi có cú gọi
 * kế tiếp thành công.
 */
import { useEffect, useState } from 'react';
import { dangMatKetNoi, ngheMatKetNoi } from '@/api/mang';
import s from './BangMatKetNoi.module.css';

export function useMatKetNoi(): boolean {
  const [mat, setMat] = useState(dangMatKetNoi);
  useEffect(() => ngheMatKetNoi(setMat), []);
  return mat;
}

export function BangMatKetNoi() {
  const mat = useMatKetNoi();
  if (!mat) return null;
  return (
    <div className={s.dai} role="status" aria-live="polite">
      <span className={s.cham} aria-hidden />
      MẤT KẾT NỐI — đang thử lại
    </div>
  );
}
