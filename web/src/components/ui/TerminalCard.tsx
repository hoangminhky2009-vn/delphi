/**
 * Card lớn Mẫu E: gradient tối, viền + glow "sống" theo mức năng lượng L (0→1),
 * scanline CRT có toggle. Công thức nội suy viền/bóng port NGUYÊN từ mẫu
 * (renderVals: cardBorder/cardShadow) — đừng "làm đẹp" lại.
 *
 * ⚠ `cardShadow` đi vào `style` INLINE, mà inline THẮNG `composes`. Trước 26/07
 * nó chỉ trả bóng + quầng, tức mỗi lần render là xoá trắng cặp vát của
 * `.khungNoi` mà `.card` vừa composes — hiệu ứng chết trên cả 17 màn dùng card,
 * build xanh, không cảnh báo. Nay hàm tự gánh đủ ba vai theo luật 6.
 */
import type { CSSProperties, HTMLAttributes } from 'react';
import s from './TerminalCard.module.css';

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Mức năng lượng 0..1 — 0.08 nghỉ, ~0.3 dư âm, 1 cao trào (Mẫu E). */
  glow?: number;
  scanline?: boolean;
}

export function cardBorderColor(l: number): string {
  const r = Math.round(93 - 59 * l);
  const g = Math.round(114 + 97 * l);
  const b = Math.round(144 + 94 * l);
  return `rgba(${r},${g},${b},${(0.3 + 0.4 * l).toFixed(2)})`;
}

/**
 * Ba vai trong ĐÚNG thứ tự luật 6: vát (bề mặt) → bóng cứng (độ dày) → quầng
 * (ánh sáng). Chỉ vai thứ ba đổi theo L.
 *
 * `0 30px 90px` cũ là bóng CÓ OFFSET → nó nói card dày bao nhiêu → vai VẬT →
 * blur phải bằng 0, nên thay bằng `--px-bong-cao` (card là mặt phẳng lớn nhất
 * màn, dùng bậc dày 2×). Quầng `0 0 Npx` giữ nguyên blur: offset 0 = ánh sáng,
 * và trải 60–190px trên một card rộng cả màn — thoả luật 5.
 */
export function cardShadow(l: number): string {
  return `var(--px-vien-trong), var(--px-bong-cao), 0 0 ${Math.round(
    60 + 130 * l,
  )}px rgba(34,211,238,${(0.05 + 0.28 * l).toFixed(2)})`;
}

export function TerminalCard({ glow = 0.08, scanline = false, className, style, children, ...rest }: Props) {
  const dynamic: CSSProperties = {
    borderColor: cardBorderColor(glow),
    boxShadow: cardShadow(glow),
    ...style,
  };
  return (
    <div className={[s.card, className].filter(Boolean).join(' ')} style={dynamic} {...rest}>
      {scanline && <div className={s.scanline} aria-hidden="true" />}
      {children}
    </div>
  );
}
