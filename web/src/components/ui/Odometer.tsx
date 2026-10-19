/**
 * Odometer 3 cột kiểu Mẫu E: dải số 0–9 translateY, MỜ theo tốc độ, quay mờ khi
 * spinning, từng cột "khóa" thì nảy digitquake. PARENT điều khiển giá trị từng
 * frame (lễ công bố) — component thuần trình diễn, port từ renderVals của mẫu.
 * C4: value là số server trả (hoặc giá trị trung gian animate TỚI số đó).
 *
 * 26/07 — "mờ vì quay nhanh" chuyển từ `filter: blur()` sang GIẢM ĐỤC. Blur ở
 * đây nhoè chính CHỮ SỐ, tức nhoè cạnh của vật, đúng thứ luật 4 cấm (và 2,5px
 * thì cũng không đủ rộng để đọc ra là ánh sáng — luật 5). Chữ số mờ đục vẫn nói
 * "đang quay quá nhanh để đọc" mà nét vẫn sắc; đây cũng đúng cách sprite làm
 * ghost frame, không phải cách ống kính làm motion blur.
 */
import { useRef } from 'react';
import s from './Odometer.module.css';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const H = 52;
/** Tốc độ quay mờ mỗi cột (vòng/giây) — Mẫu E. */
const SPIN_SPD = [1.7, 2.4, 3.3, 2.0, 2.8];

interface Props {
  /** Giá trị đang hiển thị (có thể lẻ giữa chừng animation). */
  value: number;
  /** Số cột (bậc lớn nhất) — vd 3 cho 0..999. */
  cols: number;
  /** Đang đếm dở (số lăn liên tục). */
  rolling?: boolean;
  /** Quay mờ chưa lộ số (đầu lễ). */
  spinning?: boolean;
  /** Giây đã trôi khi spinning (parent cấp từ rAF). */
  spinP?: number;
  /** Cột đã khóa → nảy digitquake (trái→phải). */
  lockedCols?: boolean[];
  /** 0..1 — cường độ glow chữ số (Mẫu E digitGlow). */
  glow?: number;
}

export function Odometer({
  value,
  cols,
  rolling = false,
  spinning = false,
  spinP = 0,
  lockedCols = [],
  glow = 0,
}: Props) {
  const prev = useRef(0);
  const dv = Math.abs(value - prev.current);
  prev.current = value;

  const places = Array.from({ length: cols }, (_, i) => 10 ** (cols - 1 - i));
  const textShadow = `0 0 ${Math.round(4 + 16 * glow)}px rgba(74,222,128,${(0.22 + 0.5 * glow).toFixed(2)})`;

  return (
    <div className={s.wrap} role="img" aria-label={String(Math.round(value))}>
      {places.map((pl, i) => {
        let y: number;
        let mo = 1;
        if (spinning) {
          const spd = SPIN_SPD[i % SPIN_SPD.length]!;
          y = -(((spinP * spd * 10) % 10) * H);
          mo = 0.5;
        } else {
          const pos = rolling ? (value / pl) % 10 : Math.floor(value / pl) % 10;
          const spd = dv / pl;
          y = -pos * H;
          if (rolling && spd > 0.45) mo = Math.max(0.6, 1 - Math.min(0.4, spd * 0.09));
        }
        return (
          <div key={pl} className={lockedCols[i] ? `${s.col} ${s.colLocked}` : s.col}>
            {/*
              Làm tròn về SỐ NGUYÊN px: dải số đứng ở 0,4px thì trình duyệt nội
              suy cạnh chữ, và chữ là vật nhỏ nhất trên màn — mất nét ở đây thấy
              rõ hơn bất cứ đâu.
            */}
            <div className={s.strip} style={{ transform: `translateY(${Math.round(y)}px)`, opacity: mo }}>
              {DIGITS.map((d, j) => (
                <div key={j} className={s.digit} style={{ textShadow }}>
                  {d}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
