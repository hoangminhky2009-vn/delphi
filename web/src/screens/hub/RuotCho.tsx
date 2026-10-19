/**
 * CHỖ GIỮ SẴN của ô Tài chính khi sổ trên máy còn đang đọc (hoặc chunk còn đang về): gạch + bảy cột mờ — CÙNG khung với số thật,
 * nên khi dữ liệu về không khối nào nhảy (SPEC 5b.2); gạch nói "chưa có", KHÔNG phải số 0 (D62). Dùng ở gói chính (Hub, trong lúc
 * chunk về) và trong chunk (trong lúc đọc kho) — một bản.
 */
import { CHU_HUB } from '@/lib/hub_chu';
import o from './HubO.module.css';

export function RuotCho(): React.ReactElement {
  return (
    <>
      <span className={`${o.soTo} ${o.cho}`}>—</span>
      <span className={o.duoi}>{CHU_HUB.dangTai}</span>
      <span className={o.cot} aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => <span key={i}><i style={{ height: '4%' }} /></span>)}
      </span>
    </>
  );
}
