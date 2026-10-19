/**
 * Hàng cửa cược — port từ Mẫu E (khối sc-for doors). 5 trạng thái:
 *  - masked: CHƯA reveal (A3.1) — không bar, không %, chỉ "· · ·".
 *  - idle: đã reveal, nghỉ — bar cyan→tím glow nhẹ.
 *  - live: bar đang chạy — dot sáng + nhãn % cyan phát sáng.
 *  - win / lose: kết quả — đúng anim/màu Mẫu E (winbounce/winpulse/losehit...).
 */
import type { ReactNode } from 'react';
import { SegBar } from './SegBar';
import s from './DoorRow.module.css';

export type DoorState = 'masked' | 'idle' | 'live' | 'win' | 'lose';

interface Props {
  label: string;
  state: DoorState;
  /** 0..100 — bỏ qua khi masked. */
  pct?: number;
  /** Nhãn % tùy biến (lễ công bố truyền số đang chạy); mặc định "{pct}%". */
  pctText?: string;
  /** Bar đang chạy đã "đậu" chưa (đổi màu nhãn khi live). */
  settled?: boolean;
  /** Tag phải: vị thế của user, vd "BẠN · 120 T". */
  mineTag?: string;
  /** Chọn cửa để đặt (chi tiết kèo). */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  /** Dòng phụ dưới bar (vd implied payout server trả). */
  footer?: ReactNode;
}

export function DoorRow({
  label,
  state,
  pct = 0,
  pctText,
  settled = true,
  mineTag,
  selectable = false,
  selected = false,
  onSelect,
  footer,
}: Props) {
  const win = state === 'win';
  const lose = state === 'lose';
  const live = state === 'live';
  const masked = state === 'masked';

  const rootCls = [
    s.row,
    masked ? s.masked : '',
    win ? s.win : '',
    lose ? s.lose : '',
    selected ? s.selected : '',
    selectable ? s.selectable : '',
  ]
    .filter(Boolean)
    .join(' ');

  const labelCls = [
    s.pct,
    live && !settled ? s.pctLive : '',
    win ? s.pctWin : '',
    lose ? s.pctLose : '',
  ]
    .filter(Boolean)
    .join(' ');

  /*
   * Chưa mở khoá thì ba dấu chấm là PHẦN TỬ RIÊNG chứ không phải một chuỗi:
   * chúng phải sáng lần lượt như con trỏ terminal đang đợi số về (04/08). Một
   * chuỗi `'· · ·'` không animate từng chấm được.
   */
  const shownPct: ReactNode = masked
    ? (
      <>
        <span className={s.maskedDot}>·</span>
        <span className={s.maskedDot}>·</span>
        <span className={s.maskedDot}>·</span>
      </>
    )
    : (pctText ?? `${Math.round(pct)}%`);
  const clampLeft = `clamp(0px, calc(${masked ? 0 : pct}% - 18px), calc(100% - 40px))`;

  const inner = (
    <>
      <div className={s.top}>
        <div className={s.nameWrap}>
          <span className={[s.name, lose ? s.nameLose : '', win ? s.nameWin : ''].join(' ')}>
            {label}
          </span>
          {lose && <span className={s.loseTag}>✕ TẠCH</span>}
          {win && <span className={s.winTag}>CỬA THẮNG</span>}
        </div>
        {mineTag && (
          <span className={win ? `${s.mineTag} ${s.mineTagWin}` : s.mineTag}>{mineTag}</span>
        )}
      </div>
      <div className={s.barArea}>
        <span className={labelCls} style={{ left: clampLeft }}>
          {shownPct}
        </span>
        {!masked && (
          <div className={s.barPos}>
            <SegBar
              pct={pct}
              tone={win ? 'win' : lose ? 'lose' : 'neutral'}
              glowPx={live ? 14 : win ? 18 : lose ? 0 : 4}
              dot={live && !settled}
              sweep={win}
              // 'live' = lễ công bố đang kéo width bằng rAF → cấm transition width
              smoothWidth={!live}
            />
          </div>
        )}
      </div>
      {footer !== undefined && <div className={s.footer}>{footer}</div>}
    </>
  );

  if (selectable) {
    return (
      <button type="button" className={rootCls} aria-pressed={selected} onClick={onSelect}>
        {inner}
      </button>
    );
  }
  return <div className={rootCls}>{inner}</div>;
}
