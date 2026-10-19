/**
 * PHÁO GIẤY PIXEL — §XII "Result → confetti nếu thắng".
 *
 * ⚠ HẠT LÀ Ô VUÔNG, không phải hình tròn hay dải giấy cong. Trên một màn hình mà
 * mọi thứ khác đều là pixel (icon, thẻ, khung, nút), một hạt bo tròn là thứ DUY
 * NHẤT có đường cong — và mắt bắt ra ngay. Cùng lý do art thẻ bỏ hết gradient.
 *
 * Rơi bằng `steps(12)` chứ không mượt: pháo giấy pixel giật từng nấc như sprite.
 * Luật đó nằm ở `styles/pixel.module.css`, không lặp lại ở đây.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BA RÀNG BUỘC TỰ ĐẶT, vì "ăn mừng" rất dễ thành "phiền":
 *
 *  1. CHỈ KHI THẮNG. Bắn pháo cho hạng 4 là chế nhạo người chơi.
 *  2. TÔN TRỌNG reduced-motion — không render một hạt nào. Đây là hiệu ứng thuần
 *     trang trí, không mang thông tin, nên tắt hẳn là đúng (khác lễ công bố kết
 *     quả: cái đó reduced-motion chỉ được rút ngắn, không được nuốt).
 *  3. TỰ DỌN. Hạt gỡ khỏi DOM sau khi rơi xong; để lại 40 node đứng im trên một
 *     màn kết trận là rác, và trên máy yếu thì rác đó cộng dồn qua nhiều trận.
 */
import { useEffect, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import px from '@/styles/pixel.module.css';

/** Bảng màu lấy từ chính bảng màu art thẻ — pháo giấy phải cùng hệ với bàn chơi. */
const MAU = ['#67e8f9', '#a78bfa', '#fbbf24', '#4ade80', '#f8fafc'] as const;

const SO_HAT = 40;
/** Rơi xong (1400ms) + trễ tối đa (600ms) rồi mới dọn, chừa một nhịp thở. */
const SONG_MS = 2200;

interface Hat {
  id: number;
  trai: number;
  tre: number;
  mau: string;
  to: number;
}

/**
 * `bat` chuyển false→true là bắn một loạt. Đổi `lan` để bắn loạt mới.
 */
export function PhaoGiay({ bat }: { bat: boolean }) {
  const itMotion = useReducedMotion();
  const [hat, setHat] = useState<Hat[]>([]);

  useEffect(() => {
    if (!bat || itMotion) return undefined;

    /*
     * Vị trí/màu ngẫu nhiên là ĐÚNG ở đây, khác hẳn engine trận.
     * Engine cấm `Math.random` vì phải replay được; pháo giấy không nằm trong
     * trạng thái trận, không ai replay nó, và mỗi lần bắn khác nhau mới đẹp.
     */
    setHat(Array.from({ length: SO_HAT }, (_, i) => ({
      id: i,
      trai: Math.round(Math.random() * 100),
      tre: Math.round(Math.random() * 600),
      mau: MAU[Math.floor(Math.random() * MAU.length)]!,
      to: 4 + Math.floor(Math.random() * 4),
    })));

    const t = setTimeout(() => setHat([]), SONG_MS);
    return () => clearTimeout(t);
  }, [bat, itMotion]);

  if (hat.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {hat.map((h) => (
        <span
          key={h.id}
          className={px.hat}
          style={{
            left: `${h.trai}%`,
            width: h.to,
            height: h.to,
            background: h.mau,
            animationDelay: `${h.tre}ms`,
          }}
        />
      ))}
    </div>
  );
}
