/**
 * HUY HIỆU HẠNG 7 BẬC + STICKER VINH DANH — MỘT NGUỒN ART (SPEC docs/spec/huy-hieu-hang-sticker.md).
 *
 * Art CHÉP NGUYÊN từ demo đã được founder duyệt `docs/ui-ux/demo/hub-tang-khong-gian.html` (hàm `huyHieu` v4,
 * bảng `KL`, dữ liệu `STK`; A11.25: demo là nguồn chân lý). Hub, Hồ sơ và mọi màn sau này cùng import file
 * này — KHÔNG vẽ lại huy hiệu ở chỗ khác (A11.5: bản thứ hai SẼ trôi).
 *
 * ⚠ HAI THỨ KHÔNG NẰM Ở ĐÂY: tên kim loại ("ĐỒNG") và id sticker của bậc khai ở `config/rank.ts` cạnh
 * `BAC_THANG` (một bảng). File này chỉ giữ THAM SỐ VẼ, tra theo `BAC_THANG[].bac` (1..7 ⇒ chỉ số 0..6).
 *
 * LUẬT VẼ (founder 11/10): "càng cao càng TO, càng nhiều GÓC CẠNH, càng PHỨC TẠP" trong MỘT khung giới hạn
 * cố định (lưới 40×40). Mỗi bậc đổi KHỐI HÌNH chứ không chỉ đổi màu:
 *   SẮT đĩa nhỏ · ĐỒNG tròn + đinh tán · BẠC khiên · VÀNG khiên + cánh ngắn · BẠCH KIM bát giác + cánh dài ·
 *   KIM CƯƠNG thoi + vương miện + cánh rộng · ELITE sao 8 cánh + vương miện lớn + cánh xoè hết khung + hào quang.
 * BÓNG tăng theo bậc (CSS ở `HuyHieuHang.module.css`): SẮT/ĐỒNG gần phẳng · BẠC→BẠCH KIM bóng pixel rơi đậm
 * dần · KIM CƯƠNG/ELITE bóng ĐỘNG (tắt khi `prefers-reduced-motion`).
 */
import { BAC_THANG, type BacId } from '@config/rank';

/** Một cụm ô liền màu nằm ngang — gộp để SVG gọn (một `<rect>` mỗi cụm thay vì mỗi ô). */
export interface CumO { x: number; y: number; w: number; fill: string }

type Bon = readonly [string, string, string, string];
type Ba = readonly [string, string, string];

interface ThongSoKimLoai {
  /** sáng · giữa · tối · viền đậm — thứ tự của demo `[L, M, D, V]`. */
  c: Bon;
  hinh: 'tron' | 'khien' | 'bat_giac' | 'thoi' | 'sao';
  r: number;
  canh: number;
  mien: number;
  ngoc: { r: number; c: Ba } | null;
  canhMau?: Bon;
}

/** THAM SỐ VẼ 7 bậc, SẮT → ELITE (chỉ số = `BAC_THANG[].bac - 1`). Tên kim loại: `BAC_THANG[].kim_loai`. */
export const KIM_LOAI_VE: readonly ThongSoKimLoai[] = [
  { c: ['#cfd4dc', '#8d949f', '#4a505a', '#2a2e35'], hinh: 'tron', r: 9.8, canh: 0, mien: 0, ngoc: null },
  { c: ['#f3b985', '#d08a4e', '#8a5229', '#4a2a12'], hinh: 'tron', r: 11, canh: 0, mien: 0, ngoc: null },
  { c: ['#ffffff', '#c3cfdd', '#6b7a8f', '#2f3846'], hinh: 'khien', r: 12.2, canh: 0, mien: 0, ngoc: null },
  { c: ['#fff6b8', '#fbbf24', '#a16a07', '#4d3203'], hinh: 'khien', r: 13, canh: 2, mien: 0,
    ngoc: { r: 2, c: ['#fffbe0', '#fde68a', '#d97706'] } },
  { c: ['#e2fff8', '#5eead4', '#0f766e', '#053b37'], hinh: 'bat_giac', r: 13.3, canh: 3, mien: 0,
    ngoc: { r: 3, c: ['#ffffff', '#a7f3d0', '#10b981'] } },
  { c: ['#eaf6ff', '#60a5fa', '#1d4ed8', '#0b1f5c'], hinh: 'thoi', r: 13.8, canh: 4, mien: 3,
    ngoc: { r: 4, c: ['#ffffff', '#cffafe', '#22d3ee'] } },
  { c: ['#efe6ff', '#a78bfa', '#6d28d9', '#2e1065'], hinh: 'sao', r: 13, canh: 5, mien: 5,
    canhMau: ['#f5f3ff', '#cbc5e8', '#7c75a3', '#3b3658'],
    ngoc: { r: 5, c: ['#ffffff', '#fef08a', '#f59e0b'] } },
];

/** Số bậc có huy hiệu — khớp 1-1 với `BAC_THANG` (test canh). */
export const SO_HUY_HIEU = KIM_LOAI_VE.length;

/** Cạnh lưới huy hiệu. */
export const LUOI_HUY_HIEU = 40;

/** Bậc từ KIM CƯƠNG (chỉ số 5) trở lên có bóng ĐỘNG. */
export const CHI_SO_BONG_DONG_DAU = 5;

/** `BacId` → chỉ số 0..6 (SẮT → ELITE); `null` với bậc không có huy hiệu (chưa xếp). */
export function chiSoHuyHieu(bac: BacId | null | undefined): number | null {
  const b = BAC_THANG.find((x) => x.id === bac);
  return b ? b.bac - 1 : null;
}

/**
 * Lưới ô của huy hiệu bậc `t` (0..6). Ô sau GHI ĐÈ ô trước — thứ tự các bước dưới đây là một phần của art.
 * Chép từ `huyHieu(t, size)` của demo, chỉ khác: trả dữ liệu thay vì chuỗi SVG.
 */
export function luoiHuyHieu(t: number): (string | null)[][] {
  const K = KIM_LOAI_VE[t];
  if (!K) throw new Error(`huy hiệu bậc ${t} không tồn tại (0..${SO_HUY_HIEU - 1})`);
  const N = LUOI_HUY_HIEU;
  const C = 19.5;
  const [L, M, D, V] = K.c;
  const g: (string | null)[][] = Array.from({ length: N }, () => Array<string | null>(N).fill(null));
  const dat = (x: number, y: number, col: string | null | undefined) => {
    if (x >= 0 && y >= 0 && x < N && y < N && col) g[y]![x] = col;
  };
  const trong = (x: number, y: number, r: number): boolean => {
    const dx = x - C;
    const dy = y - C + (K.mien ? 1 : 0);
    switch (K.hinh) {
      case 'tron': return Math.hypot(dx, dy) <= r;
      case 'khien':
        if (dy <= 0) return Math.abs(dx) <= r * 0.92 && dy >= -r * 0.95;
        return Math.abs(dx) <= r * 0.92 * (1 - dy / (r * 1.15));
      case 'bat_giac': return Math.abs(dx) <= r && Math.abs(dy) <= r && Math.abs(dx) + Math.abs(dy) <= r * 1.42;
      case 'thoi': return Math.abs(dx) / (r * 0.86) + Math.abs(dy) / (r * 1.06) <= 1;
      case 'sao': {
        const a = Math.atan2(dy, dx);
        const rr = r * (0.74 + 0.26 * Math.abs(Math.cos(4 * a)));
        return Math.hypot(dx, dy) <= rr;
      }
    }
  };

  // 1. hào quang (ELITE)
  if (t === 6) {
    for (let y = 0; y < N; y += 1) {
      for (let x = 0; x < N; x += 1) {
        const d = Math.hypot(x - C, y - C);
        if (d > K.r + 0.9 && d < K.r + 2.6 && (x + y) % 2 === 0) {
          dat(x, y, y < C - 2 ? '#fde68a' : (y < C + 4 ? '#fbbf24' : '#a16a07'));
        }
      }
    }
  }
  // 2. cánh: số lông + độ dài tăng theo bậc
  const [wL, wM, wD, wV] = K.canhMau ?? K.c;
  if (K.canh) {
    for (const s of [-1, 1]) {
      for (let k = 0; k < K.canh; k += 1) {
        const len = Math.min(2 + K.canh * 1.6 - k * 1.2, 7.4 - k * 0.9) | 0;
        const y0 = Math.round(C - K.canh + k * 2.2);
        for (let j = 0; j < len; j += 1) {
          const x = s < 0 ? Math.floor(C - K.r * 0.86 - 1 - j) : Math.ceil(C + K.r * 0.86 + 1 + j);
          const ny = y0 - (j > len - 3 ? 1 : 0) + (k === K.canh - 1 ? 1 : 0);
          dat(x, ny, j === len - 1 ? wD : (k === 0 ? wL : wM));
          dat(x, ny + 1, j === len - 1 ? wV : wD);
        }
      }
    }
  }
  // 3. thân khung: viền đậm · vát sáng trên-trái · tối dưới-phải
  for (let y = 0; y < N; y += 1) {
    for (let x = 0; x < N; x += 1) {
      if (!trong(x, y, K.r)) continue;
      const vien = !trong(x - 1, y, K.r) || !trong(x + 1, y, K.r) || !trong(x, y - 1, K.r) || !trong(x, y + 1, K.r);
      const day = t <= 1 ? 1.3 : 0;
      const r2 = K.r * (t <= 1 ? 0.5 : 0.62);
      if (vien || (day && !trong(x, y, K.r - day))) { dat(x, y, t <= 1 ? D : V); continue; }
      if (trong(x, y, r2)) {
        const vien2 = !trong(x - 1, y, r2) || !trong(x, y - 1, r2) || !trong(x + 1, y, r2) || !trong(x, y + 1, r2);
        dat(x, y, vien2 ? D : '#070b14');
        continue;
      }
      const s = (x - C) + (y - C);
      dat(x, y, s < -K.r * 0.5 ? L : (s > K.r * 0.6 && t >= 2 ? D : M));
    }
  }
  // 4. đinh tán (ĐỒNG, BẠC)
  if (t === 1 || t === 2) {
    const n = t === 1 ? 4 : 6;
    for (let i = 0; i < n; i += 1) {
      const a = i / n * Math.PI * 2 + Math.PI / 4;
      const rr = K.r * 0.81;
      const x = Math.round(C + Math.cos(a) * rr - 0.5);
      const y = Math.round(C + Math.sin(a) * rr - 0.5);
      dat(x, y, L); dat(x + 1, y, M); dat(x, y + 1, M); dat(x + 1, y + 1, V);
    }
  }
  // 5. lõi: vạch bậc (SẮT/ĐỒNG/BẠC) · ngọc tăng cỡ (VÀNG→ELITE)
  const cy = C + (K.mien ? 1 : 0);
  if (!K.ngoc) {
    const n = t + 1;
    for (let i = 0; i < n; i += 1) {
      const x = Math.round(C - n + i * 2 + 0.5);
      dat(x, Math.round(cy - 1), L);
      dat(x, Math.round(cy), M);
    }
  } else {
    const { r, c: [gL, gM, gD] } = K.ngoc;
    for (let y = -r; y <= r; y += 1) {
      for (let x = -r; x <= r; x += 1) {
        const m = Math.abs(x) + Math.abs(y);
        if (m > r) continue;
        dat(Math.round(C - 0.5 + x), Math.round(cy - 0.5 + y), m === r ? gD : ((x + y < 0) ? gL : gM));
      }
    }
    dat(Math.round(C - 0.5) - 1, Math.round(cy - 0.5) - 1, '#ffffff');
    if (t >= 5) {
      for (const [sx, sy] of [[-r - 2, -r], [r + 2, -r + 1], [0, -r - 2]] as const) {
        dat(Math.round(C - 0.5 + sx), Math.round(cy - 0.5 + sy), '#ffffff');
      }
    }
  }
  // 6. vương miện (KIM CƯƠNG 3 chóp · ELITE 5 chóp cao)
  if (K.mien) {
    const [cL, cM, cD] = t === 6 ? (['#fff6b8', '#fbbf24', '#a16a07'] as const) : ([L, M, D] as const);
    const top = Math.round(C - K.r * 1.06) - 1;
    const rong = K.mien === 5 ? 12 : 8;
    for (let x = Math.round(C - rong / 2); x <= Math.round(C + rong / 2); x += 1) {
      dat(x, top, cM); dat(x, top + 1, cD);
    }
    const chop = K.mien === 5 ? [-6, -3, 0, 3, 6] : [-4, 0, 4];
    const cao = K.mien === 5 ? 5 : 3;
    chop.forEach((dx, i) => {
      const h = cao - (K.mien === 5 && (i === 0 || i === 4) ? 2 : 0) - (K.mien === 5 && (i === 1 || i === 3) ? 1 : 0);
      for (let k = 1; k <= h; k += 1) {
        dat(Math.round(C + dx - 0.5), top - k, k === h ? cL : cM);
        dat(Math.round(C + dx + 0.5), top - k, k === h ? cL : cD);
      }
      if (K.mien === 5 && i === 2) {
        dat(Math.round(C - 0.5), top - h - 1, '#ffffff');
        dat(Math.round(C + 0.5), top - h - 1, '#ffffff');
      }
    });
  }
  return g;
}

/** Gộp lưới thành cụm ngang liền màu. */
function gopCum(g: readonly (readonly (string | null)[])[]): CumO[] {
  const out: CumO[] = [];
  g.forEach((hang, y) => {
    let x = 0;
    while (x < hang.length) {
      const c = hang[x];
      if (!c) { x += 1; continue; }
      let w = 1;
      while (x + w < hang.length && hang[x + w] === c) w += 1;
      out.push({ x, y, w, fill: c });
      x += w;
    }
  });
  return out;
}

const boNho = new Map<number, readonly CumO[]>();
/** Cụm ô của huy hiệu bậc `t` (0..6) — tính một lần, dùng lại (tất định). */
export function cumHuyHieu(t: number): readonly CumO[] {
  let r = boNho.get(t);
  if (!r) { r = gopCum(luoiHuyHieu(t)); boNho.set(t, r); }
  return r;
}

// ───────────────────────── STICKER VINH DANH (merit) ─────────────────────────

export interface LuoiSticker {
  /** chữ → màu hex (palette RIÊNG của từng hình mẫu, chép nguyên từ demo). */
  pal: Readonly<Record<string, string>>;
  rows: readonly string[];
}

/**
 * SÁU LƯỚI STICKER, khoá = id trong `NHAN_DAN` (config/avatar.ts) = `BAC_THANG[].sticker`. SẮT không có.
 * Tôm · Cua · Cá Voi GIỮ NGUYÊN cỡ + dáng hình mẫu founder (lưới tách tự động từ ảnh); Cá Ngựa · Cá Đuối · Cá Mập
 * vẽ lại cho vừa khung. Cá Voi vàng hoàng gia đội vương miện.
 *
 * ⚠ Bản DÁN LÊN AVATAR (`config/avatar_art.ts` · LUOI_DAN) là CÙNG hình, ép màu về `BANG_MAU` chung của avatar
 * — màn Hạng vẽ NGUYÊN hex demo, nên hai nơi lệch vài sắc (đã ghi ở báo cáo).
 */
export const STICKER_HANG: Readonly<Record<string, LuoiSticker>> = {
  st_hh_tom: {
    pal: { o: '#ff6a2a' },
    rows: [
      '....oooooooooooooooooooo.',
      '..oooooooooooooooo.ooo...',
      '.oooooooooooooooooooo.oo.',
      '.ooooooooooooooooooo....o',
      'oooooooooooooooo........o',
      'ooooo.....o.o.o...oooooo.',
      'oooo.....o.o.o...o.......',
      'ooo.....o.o.o.....oo.....',
      'ooo......o.o.............',
      '.oo.......o..............',
      '.ooo.....................',
      '..ooo...ooo..............',
      '....ooooooo..............',
    ],
  },
  st_hh_cua: {
    pal: { A: '#ee0a0a', C: '#ff6b5a', B: '#000000' },
    rows: [
      '..AAAA....AAAA..',
      '.AAA........AAA.',
      '.AAAAA....AAAAA.',
      'AAAAA......AAAAA',
      'AA...B....B...AA',
      'AA..AAAAAAAA..AA',
      'AAAAAAAAAAAAAAAA',
      '.AAAACACAAAAAAA.',
      '...AAACAAACAA...',
      '.AAAAAAAACAAAAA.',
      'AA..AACAAAAA..AA',
      '...AAAACAAAAA...',
      '.AAA..AAAA..AAA.',
    ],
  },
  st_hh_ca_ngua: {
    pal: { o: '#f5823c', O: '#c75a1b', y: '#f6c22e', k: '#111111' },
    rows: [
      '.....yy.....',
      '....yooyy...',
      '....oooooy..',
      'oo.ooookoy..',
      'oooooooooy..',
      'o...ooooOy..',
      '.....oooO...',
      '....yoooO...',
      '...yyoooOy..',
      '...yyooooOy.',
      '....yoooooO.',
      '....yyooooO.',
      '.....yooooO.',
      '......yoooO.',
      '.....o.yooO.',
      '....oo..oOO.',
      '....o..oOO..',
      '....oo.oO...',
      '.....oOO....',
    ],
  },
  st_hh_ca_duoi: {
    pal: { a: '#0e3d6e', b: '#1d63a8', c: '#3f8fe0', d: '#7cc2f7' },
    rows: [
      '.......a.....a.......',
      '.......a.....a.......',
      '.......aaaaaaa.......',
      '......abbbbbbba......',
      '.....abbcbbbcbba.....',
      '....abbbcccccbbba....',
      '...abbbccdcdccbbba...',
      '.aabbbbccdddccbbbbaa.',
      'abbbbbbcccdcccbbbbbba',
      'abbbaabbccdccbbaabbba',
      'abba...abcccba...abba',
      'aba.....abcba.....aba',
      'aa......abcba......aa',
      '.........aba.........',
      '.........aba.........',
      '..........a..........',
      '..........a..........',
      '...........a.........',
    ],
  },
  st_hh_ca_map: {
    pal: { s: '#4f5f68', S: '#37444b', w: '#f4f7fa', r: '#d4170f', k: '#0a0a0a' },
    rows: [
      '.......s.......',
      '......sss......',
      '.....sssss.....',
      '....Sssssss....',
      '...SsssssssS...',
      '..SssswwwsssS..',
      '..kswwwwwwwsk..',
      '.Sswwwrwrwwwss.',
      '.Sswwrrrrrwwss.',
      'Sswwrrrrrrrwwss',
      'Swwrwrrrrrwrwws',
      'Swwrwrwrwrwrwws',
      'Swwwwwwwwwwwwws',
      'SSswwwwwwwwwsss',
    ],
  },
  st_hh_ca_voi: {
    pal: { b: '#fbbf24', l: '#fde68a', B: '#f59e0b', w: '#fffbea', g: '#e9c46a', k: '#4a3305', Y: '#f2cb4a', R: '#b83232', W: '#ffffff' },
    rows: [
      '.....Y...........',
      '....YWY..........',
      '.....Y...........',
      '.YY.YRY.YY.......',
      'YRRYRRRYRRY......',
      'YRRYRRRYRRY......',
      '.YRYRRRYRY.......',
      '..YYYYYYY........',
      '..YYYYYYY........',
      '...bbbbb.........',
      '..bbllbbb........',
      '.bblbbbbbb.......',
      '.bbbbbbbbbb......',
      '.bbbbbbbkbb.B...B',
      '.wwwwwwbbbb.BB.BB',
      '.wgwgwwBBBB.BBBBB',
      '.wgwgwwBBBB...B..',
      '..gwgwgBBBBB.BB..',
      '..wwgwwgBBBBBBw..',
      '...gwgwwbBBBBw...',
      '...Bwwwwbbwww....',
      '...BB...bb.......',
      '...B....b........',
    ],
  },
};

/** Lưới sticker của một bậc; `null` với SẮT / chưa xếp. */
export function stickerCuaBac(bac: BacId | null | undefined): { id: string; luoi: LuoiSticker } | null {
  const id = BAC_THANG.find((x) => x.id === bac)?.sticker;
  const luoi = id ? STICKER_HANG[id] : undefined;
  return id && luoi ? { id, luoi } : null;
}

/** Cụm ô của sticker + cạnh vuông bao (căn giữa như demo `veSticker`: n = max(rộng, cao)). */
export function cumSticker(luoi: LuoiSticker): { cum: CumO[]; n: number } {
  const h = luoi.rows.length;
  const w = Math.max(...luoi.rows.map((r) => r.length));
  const n = Math.max(w, h);
  const ox = (n - w) / 2;
  const oy = (n - h) / 2;
  const cum: CumO[] = [];
  luoi.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      const fill = luoi.pal[ch];
      if (!fill) { x += 1; continue; }
      let rw = 1;
      while (x + rw < row.length && row[x + rw] === ch) rw += 1;
      cum.push({ x: x + ox, y: y + oy, w: rw, fill });
      x += rw;
    }
  });
  return { cum, n };
}
