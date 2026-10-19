/**
 * Thanh % kiểu LED phân đoạn (Mẫu E): fill 5 bậc màu phẳng + vạch tick 2px/8px
 * đè lên, glow theo trạng thái, dot sáng đầu bar khi đang chạy, sweep khi thắng.
 */
import s from './SegBar.module.css';

type Tone = 'neutral' | 'win' | 'lose';

/**
 * Màu thanh nay là LỚP CSS chứ không phải chuỗi nền dựng ở đây: nó là bề mặt
 * của vật nên phải hard-stop, và một dải 5 bậc viết bằng tay trong `.tsx` thì
 * không lint nào quét được (luật 6 — style inline thắng `composes` im lặng).
 */
const TONE_CLS: Record<Tone, string> = {
  neutral: s.toneNeutral!,
  win: s.toneWin!,
  lose: s.toneLose!,
};

interface Props {
  /** 0..100 */
  pct: number;
  tone?: Tone;
  /** Glow (px bóng) — Mẫu E: 4 nghỉ, 14 đang chạy, 18 thắng, 0 thua. */
  glowPx?: number;
  /** Dot sáng ở đầu bar (đang chạy). */
  dot?: boolean;
  /** Vệt sáng quét qua (cửa thắng). */
  sweep?: boolean;
  /**
   * Cho width chuyển tiếp mượt — CHỈ khi width đổi rời rạc (màn chi tiết).
   * Mặc định TẮT, đúng Mẫu E: lúc lễ công bố chạy, width do rAF đặt từng khung.
   */
  smoothWidth?: boolean;
}

export function SegBar({
  pct,
  tone = 'neutral',
  glowPx = 4,
  dot = false,
  sweep = false,
  smoothWidth = false,
}: Props) {
  const w = Math.max(0, Math.min(100, pct));
  const glowColor = tone === 'win' ? 'rgba(74,222,128,.8)' : 'rgba(34,211,238,.5)';
  const fillCls = [s.fill, TONE_CLS[tone], smoothWidth ? s.fillSmooth : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={s.track}>
      <div
        className={fillCls}
        style={{
          width: `${w}%`,
          // Quầng offset 0 = ánh sáng (luật 4) → giữ blur; chỉ bề rộng là inline.
          boxShadow: `0 0 ${glowPx}px ${glowColor}`,
        }}
      >
        {sweep && <div className={s.sweep} aria-hidden="true" />}
      </div>
      <div className={s.dot} style={{ left: `calc(${w}% - 6px)`, opacity: dot ? 0.95 : 0 }} aria-hidden="true" />
    </div>
  );
}
