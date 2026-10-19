/** Badge thành tích (Mẫu E): trượt lên lố đà + icon pixel nhịp đập + vệt sáng quét một lần. */
import { PixelIcon, type PixelIconName } from './PixelIcon';
import s from './Badge.module.css';

interface Props {
  icon: PixelIconName;
  title: string;
  detail: string;
  /** Trễ xuất hiện (s) — badge sau cách badge trước ~0.18s (Mẫu E). */
  delayS?: number;
  tone?: 'violet' | 'gold';
  /** 'pulse' = phồng nhẹ (bia bắn) · 'flame' = lắc như lửa (huy hiệu chuỗi). */
  iconAnim?: 'pulse' | 'flame';
}

export function Badge({ icon, title, detail, delayS = 0, tone = 'violet', iconAnim = 'pulse' }: Props) {
  return (
    <div className={`${s.badge} ${s[tone]}`} style={{ animationDelay: `${delayS}s` }}>
      <span className={iconAnim === 'flame' ? `${s.icon} ${s.iconFlame}` : s.icon}>
        <PixelIcon name={icon} size={16} />
      </span>
      <span>
        <b>{title}</b> — {detail}
      </span>
      <div className={s.sweep} style={{ animationDelay: `${delayS + 0.6}s` }} aria-hidden="true" />
    </div>
  );
}
