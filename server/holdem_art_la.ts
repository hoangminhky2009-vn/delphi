/**
 * BỘ VẼ LÁ BÀI BẢN MỚI (D390) — lưới vuông `server/art/la_bai.ts` → SVG.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BA LỚP, đúng thứ tự của trang demo đã duyệt (`docs/ui-ux/demo/la-bai-phong-cach.html`):
 *   1. HÌNH  — mọi ô, gộp dải bằng `veDai` như mọi art pixel khác;
 *   2. NEON  — `<g class="neon">`: bản chép riêng các NÉT CHÍNH (chữ màu trong `neon`).
 *              Đứng yên thì nó trùng khít lớp hình nên mắt không thấy gì; khung ngoài
 *              cho nó quầng sáng + thở opacity thì nét chính sáng lên — neon chạy trên
 *              nét vẽ, không chạy quanh khung (founder 23/09);
 *   3. VỆT   — `<path class="vet">` × tối đa 12: cũng là các nét chính, chia theo thời
 *              điểm dải sáng quét qua. Mỗi dải `opacity="0"` sẵn (lá đứng yên = không vệt),
 *              mang `--p` = pha của nó trong chu kỳ; CSS của khung ngoài cho chúng bừng
 *              lên LẦN LƯỢT ⇒ một vệt sáng trượt dọc nét.
 *
 * ⚠ VÌ SAO VỆT KHÔNG LÀM Y CÁCH DEMO. Trang demo cắt một dải `linearGradient` theo
 * `clipPath` của nét chính — cần hai `id` trong SVG. Art này được nhúng NHIỀU BẢN trên
 * cùng một trang (ô bản đồ, dải tài sản, bảng điện, lá trên tay…), mà `url(#id)` luôn
 * trỏ tới phần tử ĐẦU TIÊN mang id ấy trong tài liệu: bản đầu nằm trong một khối
 * `display:none` (tab đang ẩn) là WebKit mất luôn vùng cắt và vẽ nguyên dải sáng TRÙM
 * cả lá. Nên ở đây không có id nào: vệt dựng bằng chính các ô, chỉ animate `opacity`
 * — cũng đúng luật §XI (hiệu ứng làm bằng ô pixel, `lint:pixel-art` cấm gradient).
 * Hình học giữ theo demo: dải rộng 0,6 lá, nghiêng `goc`, quét trong 42% chu kỳ (cặp
 * lãi suất 30% — nhịp loé kim), gia tốc `ease-in-out`.
 */
import { BANG_MAU, docLuoi, veDai, type Cell } from '../config/pixel_luoi.js';
import type { LaBai } from './art/la_bai.js';

/** Số dải vệt — đủ để mắt đọc ra MỘT vệt trượt chứ không phải các khối nhảy. */
const SO_DAI = 12;

/**
 * Phần chu kỳ mà cú quét chiếm (demo: `vetQuet` 0→42% rồi nghỉ; `vetKim` 0→30%).
 * `CUA_SO` = thời gian một ô sáng: dải rộng 0,6 lá trượt hết quãng 2 lá ⇒ 0,3 cú quét.
 * CSS của khung ngoài phải dùng ĐÚNG hai số này làm độ dài keyframe — xuất ra để bài
 * canh so với CSS, không gõ lại lần hai.
 */
export const NHIP_VET = {
  thuong: { quet: 0.42, cuaSo: 0.42 * 0.3 },
  kim: { quet: 0.30, cuaSo: 0.30 * 0.3 },
} as const;

/** Nghịch đảo `cubic-bezier(.42,0,.58,1)` (= `ease-in-out`): tiến độ → phần thời gian. */
function thoiDiemCua(tienDo: number): number {
  const bez = (u: number, a: number, b: number) =>
    3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
  let lo = 0; let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const u = (lo + hi) / 2;
    if (bez(u, 0, 1) < tienDo) lo = u; else hi = u;
  }
  return bez((lo + hi) / 2, 0.42, 0.58);
}

/** Dải ngang của một tập ô → chuỗi `d` (1 đơn vị = 1 ô). */
function duong(cells: readonly Cell[]): string {
  const theoHang = new Map<number, number[]>();
  for (const c of cells) {
    const a = theoHang.get(c.y); if (a) a.push(c.x); else theoHang.set(c.y, [c.x]);
  }
  const o: string[] = [];
  for (const [y, xs] of [...theoHang].sort((a, b) => a[0] - b[0])) {
    xs.sort((a, b) => a - b);
    let i = 0;
    while (i < xs.length) {
      let j = i;
      while (j + 1 < xs.length && xs[j + 1] === xs[j]! + 1) j += 1;
      const w = xs[j]! - xs[i]! + 1;
      o.push(`M${xs[i]},${y}h${w}v1h-${w}z`);
      i = j + 1;
    }
  }
  return o.join('');
}

/** Pha (0..1 trong chu kỳ) lúc tâm dải sáng đi qua ô — hình học của dải trong demo. */
function phaCua(c: Cell, n: number, goc: number, quet: number): number {
  // Dải dựng đứng rồi nghiêng `goc`; quá 60° thì dải gần như nằm ngang và cú quét ngang
  // không còn đọc ra "trượt", nên chặn ở 60° — đủ nghiêng, vẫn là một vệt đi qua.
  const nghieng = Math.tan((Math.max(-60, Math.min(60, goc)) * Math.PI) / 180);
  const quang = c.x + 0.5 + 0.7 * n + 0.3 * (c.y + 0.5 - n / 2) * nghieng;
  const tienDo = Math.max(0, Math.min(1, quang / (2 * n)));
  return quet * thoiDiemCua(tienDo);
}

export function veLaBai(la: LaBai): string {
  const n = la.luoi.length;
  const cells = docLuoi(la.luoi);
  const neon = cells.filter((c) => la.neon.includes(c.ch));
  const nhip = NHIP_VET[la.nhip ?? 'thuong'];

  const pha = neon.map((c) => phaCua(c, n, la.goc, nhip.quet));
  const lo = Math.min(...pha); const hi = Math.max(...pha);
  const dai: Cell[][] = Array.from({ length: SO_DAI }, () => []);
  neon.forEach((c, i) => {
    const k = hi > lo ? Math.min(SO_DAI - 1, Math.floor(((pha[i]! - lo) / (hi - lo)) * SO_DAI)) : 0;
    dai[k]!.push(c);
  });
  const vet = dai.map((ds, k) => {
    if (ds.length === 0) return '';
    const giua = lo + ((k + 0.5) / SO_DAI) * (hi - lo);
    // `--p` = độ lệch để đỉnh keyframe (giữa cửa sổ) rơi đúng pha của dải.
    const p = (((giua - nhip.cuaSo / 2) % 1) + 1) % 1;
    return `<path class="vet" opacity="0" fill="${la.vet}" style="--p:${p.toFixed(3)}" d="${duong(ds)}"/>`;
  }).join('');

  return `<svg viewBox="0 0 ${n} ${n}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" `
    + `class="laBai"${la.nhip ? ` data-nhip="${la.nhip}"` : ''}>`
    + veDai(cells, 1)
    + `<g class="neon">${veDai(neon, 1)}</g>`
    + vet
    + '</svg>';
}

/** Chữ màu có trong bảng không — bộ vẽ bỏ qua chữ lạ nên phải canh ở ngoài (lint + test). */
export const laChuMau = (ch: string): boolean => ch === '.' || !!BANG_MAU[ch];
