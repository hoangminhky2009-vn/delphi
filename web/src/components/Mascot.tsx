/**
 * Oracle — linh vật DELPHI, vẽ từ lưới pixel src/assets/mascot.json (cùng nguồn
 * với icon app, xem scripts/gen-icons.mjs). Render SVG nên nét ở mọi cỡ.
 * Không ảnh ngoài, không font icon — đúng tinh thần pixel-art tự vẽ của Mẫu E.
 */
import { useMemo } from 'react';
import spec from '@/assets/mascot.json';
import s from './Mascot.module.css';

interface Run {
  x: number;
  y: number;
  w: number;
  fill: string;
}

const PALETTE = spec.palette as Record<string, string>;

/** Gom pixel liền màu thành 1 rect + cắt viền trống → SVG gọn, căn giữa chuẩn. */
const { runs, box } = ((): { runs: Run[]; box: { x: number; y: number; w: number; h: number } } => {
  const N = spec.size;
  let x0 = N;
  let y0 = N;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      if (spec.grid[y]![x] !== '.') {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const out: Run[] = [];
  for (let y = y0; y <= y1; y += 1) {
    let x = x0;
    while (x <= x1) {
      const ch = spec.grid[y]![x]!;
      if (ch === '.') {
        x += 1;
        continue;
      }
      let w = 1;
      while (x + w <= x1 && spec.grid[y]![x + w] === ch) w += 1;
      out.push({ x: x - x0, y: y - y0, w, fill: PALETTE[ch]! });
      x += w;
    }
  }
  return { runs: out, box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } };
})();

interface Props {
  size?: number;
  /** Quầng sáng tím phía sau (dùng ở hero/avatar lớn). */
  glow?: boolean;
  /** Bồng bềnh nhẹ — tự tắt khi prefers-reduced-motion (CSS). */
  float?: boolean;
  /** D538 — BAY như Oracle của trợ lý hướng dẫn (trôi chéo + nghiêng); tắt khi giảm chuyển động. */
  bay?: boolean;
  className?: string;
  /** Có nghĩa với screen reader (mặc định trang trí). */
  title?: string;
}

export function Mascot({ size = 32, glow = false, float = false, bay = false, className, title }: Props) {
  const cls = [s.mascot, glow ? s.glow : '', float ? s.float : '', bay ? s.bay : '', className]
    .filter(Boolean)
    .join(' ');
  const rects = useMemo(
    () =>
      runs.map((r) => (
        <rect key={`${r.x}-${r.y}-${r.w}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      )),
    [],
  );
  return (
    <svg
      className={cls}
      width={size}
      height={size}
      viewBox={`-1 -1 ${box.w + 2} ${box.h + 2}`}
      shapeRendering="crispEdges"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {rects}
    </svg>
  );
}
