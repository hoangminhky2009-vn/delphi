/**
 * ART THẺ DẠNG PIXEL — thực thi §XI "Modern Pixel UI".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VÌ SAO FILE NÀY TỒN TẠI.
 *
 * `holdem_art.ts` có 29 art thẻ, và ĐO ĐƯỢC: 84 `feGaussianBlur`, 502 gradient,
 * 0 `crispEdges`. Tức toàn bộ art thẻ là SVG vector mượt — NGƯỢC HẲN §XI, vốn đòi
 * "pixel card / pixel frame / pixel icon" theo phong cách Modern Pixel UI. Chỉ
 * `web/src/components/ui/PixelIcon.tsx` (icon nav) là đúng nếp pixel.
 *
 * File này dựng hệ pixel cho THẺ, dùng lại đúng quy ước của PixelIcon: LƯỚI KÝ TỰ
 * + bảng màu chữ→màu. Nhờ vậy art sửa được bằng cách gõ text, không cần công cụ
 * vẽ, và diff trên git đọc được từng ô.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * §XI ĐÒI BA THỨ CHỒNG NHAU: Pixel Art + Modern Glassmorphism + Terminal Neon.
 * Ba thứ đó nghe như xung đột với pixel (glow và glass thường làm bằng blur), nên
 * quy ước ở đây là: **KHÔNG DÙNG BLUR/GRADIENT — mọi hiệu ứng đều làm bằng Ô PIXEL.**
 *
 *   · NEON  → quầng sáng là các VÒNG Ô đồng tâm quanh ô sáng, opacity giảm dần.
 *             Đây là cách pixel art hiện đại làm glow, và nó giữ mép sắc.
 *   · GLASS → một dải sáng chéo mờ, cũng vẽ bằng ô, chồng lên trên cùng.
 *   · TERMINAL → scanline: mỗi 4 hàng một vạch tối rất nhạt, khớp lưới pixel.
 *
 * Nếu ai thêm blur vào đây thì `scripts/lint_pixel_art.ts` vỡ build — cố ý.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LƯỚI: 40 × 30 ô, mỗi ô 5px → đúng viewBox 200×150 của thẻ. Không đổi số này mà
 * không đổi cả bộ: `lint_pixel_art.ts` kiểm từng lưới đúng 30 hàng × 40 cột.
 */

/**
 * BẢNG MÀU + THUẬT TOÁN VẼ nay sống ở `config/pixel_luoi.ts`.
 *
 * Chuyển đi (27/07, đợt avatar) vì tầng avatar phải render ở CẢ HAI phía — React
 * và server — mà `web/` chỉ đọc được `config/` (alias `@config`). Giữ bản thứ hai
 * ở đây là bảo đảm hai bên trôi lệch; avatar bot đã từng có hai bản và hai bản đó
 * đã khác nhau. Re-export để 29 art thẻ + `scripts/lint_pixel_art.ts` không phải
 * sửa một dòng nào.
 */
export { BANG_MAU, O_PHAT_SANG } from '../config/pixel_luoi.js';
import { BANG_MAU, docLuoi, O_PHAT_SANG, veDai as veDaiPX, type Cell }
  from '../config/pixel_luoi.js';

/**
 * LƯỚI 80×60 — gấp 4 số ô so với bản đầu (40×30).
 *
 * Đây là thứ quyết định "đẹp hay thô", không phải bảng màu: ở 40×30 một đồng xu chỉ
 * có ~15 ô đường kính, không đủ chỗ vẽ mặt vát hay chữ trên xu. Ở 80×60 thì có.
 * Ô 2,5px nên vẫn ra đúng viewBox 200×150 — không nơi dùng nào phải sửa.
 */
export const O_RONG = 80;
export const O_CAO = 60;
/** 80×60 ô × 2,5px = 200×150, giữ nguyên viewBox thẻ. */
const PX = 2.5;

/**
 * Vẽ dải ở ĐÚNG tỷ lệ ô của thẻ (2,5px). Thuật toán gộp path nằm ở
 * `config/pixel_luoi.ts` — xem docstring ở đó để biết vì sao không dùng `<rect>`.
 */
function veDai(cells: readonly Cell[]): string {
  return veDaiPX(cells, PX);
}

/**
 * Quầng NEON bằng ô: MỘT vòng quanh mỗi ô sáng.
 *
 * Không dùng `feGaussianBlur` (blur phá cảm giác pixel), và chỉ MỘT vòng chứ không
 * hai: vòng thứ hai gần như không thấy được ở cỡ thẻ thật nhưng góp một phần đáng
 * kể vào 898KB đo được ở bản đầu. Đổi lấy opacity cao hơn một chút cho vòng còn lại.
 */
function quangNeon(cells: readonly Cell[]): string {
  const sang = cells.filter((c) => O_PHAT_SANG.has(c.ch));
  if (sang.length === 0) return '';
  const daCo = new Set(cells.map((c) => `${c.x},${c.y}`));
  const o = new Map<string, string>();
  for (const c of sang) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const x = c.x + dx; const y = c.y + dy;
        if (x < 0 || y < 0 || x >= O_RONG || y >= O_CAO) continue;
        const k = `${x},${y}`;
        if (daCo.has(k) || o.has(k)) continue;
        o.set(k, c.ch);
      }
    }
  }
  const g = [...o].map(([xy, ch]) => {
    const [x, y] = xy.split(',').map(Number);
    return { x: x!, y: y!, ch };
  });
  return g.length ? `<g opacity="0.3">${veDai(g)}</g>` : '';
}

/**
 * Dải sáng chéo mờ — glassmorphism làm bằng ô, không bằng blur.
 *
 * Mỗi hàng là MỘT rect (7 ô liền nhau), không phải 7 rect: cùng lý do kích thước
 * như `veDai`. 30 phần tử thay vì 210.
 */
function kinhMo(): string {
  const parts: string[] = [];
  for (let y = 0; y < O_CAO; y += 1) {
    const x0 = Math.round(O_RONG * 0.62 - y * 0.9);
    const a = Math.max(0, x0);
    const b = Math.min(O_RONG, x0 + 14);
    if (b <= a) continue;
    parts.push(`M${a * PX},${y * PX}h${(b - a) * PX}v${PX}h-${(b - a) * PX}z`);
  }
  return `<g opacity="0.05"><path fill="#f8fafc" d="${parts.join('')}"/></g>`;
}

/** Scanline kiểu terminal — mỗi 4 hàng một vạch, khớp lưới nên không rung. */
function scanline(): string {
  const parts: string[] = [];
  // Mỗi 8 hàng ở lưới 80×60 = cùng mật độ thị giác với mỗi 4 hàng ở lưới 40×30.
  for (let y = 0; y < O_CAO; y += 8) {
    parts.push(`M0,${y * PX}h${O_RONG * PX}v1h-${O_RONG * PX}z`);
  }
  return `<g opacity="0.34"><path fill="#0a0618" d="${parts.join('')}"/></g>`;
}

/**
 * Dựng SVG pixel từ lưới.
 *
 * Thứ tự lớp CỐ ĐỊNH: nền → scanline → quầng neon → ô → kính mờ. Đảo là mất hiệu
 * ứng: quầng vẽ SAU ô sẽ che mất ô, kính vẽ TRƯỚC ô thì không còn là kính.
 */
export function vePixel(luoi: readonly string[]): string {
  const cells = docLuoi(luoi);
  return '<svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg" '
    + 'shape-rendering="crispEdges">'
    + `<path fill="${BANG_MAU.K}" d="M0,0h200v150h-200z"/>`
    + scanline()
    + quangNeon(cells)
    + veDai(cells)
    + kinhMo()
    + '</svg>';
}
