/**
 * THANH Ô NẤC của các ô Hub (hũ gom tới mức · việc tuần xong/tổng · phần tiền đã đi): `so` ô, `dayDu` ô đầu sáng.
 * Một bản cho Hub (gói chính) và chunk Tài chính (nạp trễ) — không lệch nhau (A11.5).
 */
import o from './HubO.module.css';

export function Nac({ day, so }: { day: number; so: number }): React.ReactElement {
  const sang = Math.max(0, Math.min(so, Math.round(day)));
  return (
    <span className={o.nac} style={{ ['--so-nac' as string]: so }} aria-hidden="true">
      {Array.from({ length: so }, (_, i) => <i key={i} className={i < sang ? o.xong : ''} />)}
    </span>
  );
}
