/**
 * "Cọ vẽ" sinh lưới pixel linh vật Oracle → src/assets/mascot.json.
 * Chạy: npm run mascot   (rồi npm run icons để xuất icon)
 *
 * Vì sao vẽ bằng script thay vì gõ tay từng ô: ở 48x48 (2.304 ô) thứ tạo ra
 * "đẹp" là KHỐI SÁNG–TỐI liền mạch (quả cầu tròn có specular + rim, mũ có dải
 * chuyển tông) — gõ tay không giữ nổi độ mượt đó. Script dựng hình khối bằng
 * toán rồi LƯỢNG TỬ HOÁ về thang màu hữu hạn, giữ đúng chất pixel-art.
 *
 * mascot.json vẫn là NGUỒN CHÂN LÝ (Mascot.tsx + gen-icons.mjs đọc nó);
 * file này là cọ vẽ để sửa dáng/ánh sáng rồi sinh lại.
 *
 * THỨ TỰ VẼ (quan trọng — lớp sau đè lớp trước):
 *   quả cầu → gương mặt → chóp mũ + dải vàng → vành mũ (che đỉnh cầu)
 *   → sách (che đáy cầu) → lấp lánh
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const N = 48;

const PALETTE = {
  // mũ phù thủy — tối → sáng
  '1': '#2e1065',
  '2': '#4c1d95',
  '3': '#6d28d9',
  '4': '#7c3aed',
  '5': '#a78bfa',
  '6': '#c4b5fd',
  // viền vàng
  q: '#78350f',
  w: '#b45309',
  e: '#f59e0b',
  r: '#fbbf24',
  t: '#fde68a',
  // quả cầu tiên tri — tối → sáng
  a: '#0a1330',
  b: '#122356',
  c: '#17307a',
  d: '#1d4ed8',
  f: '#2563eb',
  g: '#3b82f6',
  h: '#60a5fa',
  i: '#93c5fd',
  j: '#c7dcff',
  k: '#eef6ff',
  // rim + nét phát sáng cyan
  m: '#0e7490',
  n: '#22d3ee',
  o: '#67e8f9',
  // sách
  u: '#171441',
  v: '#312e81',
  x: '#4338ca',
  z: '#a5b4fc',
  A: '#c7d2fe',
  B: '#e6ebff',
  // lấp lánh
  S: '#fde047',
  T: '#ffffff',
  U: '#c4b5fd',
};

const G = Array.from({ length: N }, () => Array(N).fill('.'));
const put = (x, y, ch) => {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi >= 0 && xi < N && yi >= 0 && yi < N) G[yi][xi] = ch;
};
const ramp = (tones, v) =>
  tones[Math.max(0, Math.min(tones.length - 1, Math.floor(v * tones.length)))];

const CX = 23.5;

// ═══════════════════════════════════════════════ 1. QUẢ CẦU TIÊN TRI
const ORB_CX = 23.5;
const ORB_CY = 28.5;
const ORB_R = 9.4;
const LX = -0.5;
const LY = -0.55; // nguồn sáng trên–trái
// 8 tông: giữ phần lớn mặt cầu ở tông TRUNG để gương mặt cyan nổi lên được
const ORB_TONES = ['a', 'b', 'c', 'd', 'f', 'g', 'h', 'i'];
const NDOTL_MAX = 0.97;

for (let y = Math.floor(ORB_CY - ORB_R); y <= Math.ceil(ORB_CY + ORB_R); y += 1) {
  for (let x = Math.floor(ORB_CX - ORB_R); x <= Math.ceil(ORB_CX + ORB_R); x += 1) {
    const dx = (x + 0.5 - ORB_CX) / ORB_R;
    const dy = (y + 0.5 - ORB_CY) / ORB_R;
    const d2 = dx * dx + dy * dy;
    if (d2 > 1) continue;
    const z = Math.sqrt(Math.max(0, 1 - d2));
    const ndotl = Math.max(0, dx * LX + dy * LY + z * 0.62);
    // rim cyan ở rìa dưới–phải: tách quả cầu khỏi nền, cho cảm giác thuỷ tinh
    const rimSide = dx * 0.62 + dy * 0.48;
    if (d2 > 0.79 && rimSide > 0.3) {
      put(x, y, d2 > 0.9 ? 'n' : 'm');
      continue;
    }
    if (d2 > 0.94) {
      put(x, y, 'a'); // viền tối
      continue;
    }
    // gamma 1.6 → dồn về tông trung, không cháy sáng nửa mặt cầu
    const v = Math.pow(ndotl / NDOTL_MAX, 1.6);
    put(x, y, ramp(ORB_TONES, Math.min(0.999, v)));
  }
}
// đốm sáng chuyên nhỏ (specular) trên–trái + đốm phụ mờ
for (const [ox, oy, ch] of [
  [-4, -5, 'j'], [-3, -5, 'k'], [-2, -5, 'j'],
  [-5, -4, 'i'], [-4, -4, 'k'], [-3, -4, 'k'], [-2, -4, 'j'],
  [-5, -3, 'i'], [-4, -3, 'j'], [-3, -3, 'i'],
  [4, 3, 'h'], [5, 2, 'h'], [3, 4, 'g'],
]) {
  put(ORB_CX + ox, ORB_CY + oy, ch);
}

// ═══════════════════════════════════════════════ 2. GƯƠNG MẶT
// Mắt: bầu dục trắng–cyan có viền tối → tương phản mạnh trên nền xanh trung
function eye(ex) {
  const ey = ORB_CY - 0.5;
  for (let y = -3; y <= 3; y += 1) {
    for (let x = -3; x <= 3; x += 1) {
      const d = (x * x) / 4.4 + (y * y) / 7.2;
      if (d > 1.35) continue;
      if (d > 1) put(ORB_CX + ex + x, ey + y, 'b'); // viền tối
      else if (d > 0.66) put(ORB_CX + ex + x, ey + y, 'n');
      else put(ORB_CX + ex + x, ey + y, 'o');
    }
  }
  // con ngươi sáng + chấm bắt sáng
  for (const [dx2, dy2] of [[0, 0], [0, 1], [0, -1], [-1, 0]]) {
    put(ORB_CX + ex + dx2, ey + dy2, 'k');
  }
  put(ORB_CX + ex - 0.5, ey - 1.5, 'T');
}
eye(-4.2);
eye(4.2);

// Miệng cười — nét cyan dày 2px, có viền tối bên dưới cho rõ
const MOUTH = [
  [-3, 4.2], [-2, 5], [-1, 5.4], [0, 5.5], [1, 5.4], [2, 5], [3, 4.2],
];
for (const [ox, oy] of MOUTH) {
  put(ORB_CX + ox, ORB_CY + oy, 'o');
  put(ORB_CX + ox, ORB_CY + oy + 1, 'n');
  put(ORB_CX + ox, ORB_CY + oy + 2, 'b');
}
// má hồng-tím nhạt cho dễ thương
put(ORB_CX - 6.5, ORB_CY + 3, 'h');
put(ORB_CX - 7.5, ORB_CY + 3, 'h');
put(ORB_CX + 6.5, ORB_CY + 3, 'g');
put(ORB_CX + 7.5, ORB_CY + 3, 'g');

// ═══════════════════════════════════════════════ 3. CHÓP MŨ
const TIP_Y = 3;
const CONE_BOTTOM = 17;
const CONE_HW = 7.6;
const bend = (y) => Math.pow((y - TIP_Y) / (CONE_BOTTOM - TIP_Y), 1.8) * 2.4; // hơi ngả phải

function coneRow(y) {
  const p = (y - TIP_Y) / (CONE_BOTTOM - TIP_Y);
  return { hw: Math.max(0.6, Math.pow(p, 0.8) * CONE_HW), cx: CX + bend(y) };
}

for (let y = TIP_Y; y <= CONE_BOTTOM; y += 1) {
  const { hw, cx } = coneRow(y);
  const x0 = Math.round(cx - hw);
  const x1 = Math.round(cx + hw);
  for (let x = x0; x <= x1; x += 1) {
    const t = (x - (cx - hw)) / (2 * hw || 1);
    let ch;
    if (x === x0 || x === x1) ch = '1';
    else if (t < 0.18) ch = '2';
    else if (t < 0.3) ch = '4';
    else if (t < 0.46) ch = '5';
    else if (t < 0.68) ch = '4';
    else if (t < 0.86) ch = '3';
    else ch = '2';
    put(x, y, ch);
  }
}
// nếp vải
for (let y = TIP_Y + 4; y <= CONE_BOTTOM - 1; y += 1) {
  const { hw, cx } = coneRow(y);
  put(cx + hw * 0.55, y, '3');
  if (y % 2 === 0) put(cx + hw * 0.72, y, '2');
}

// dải vàng quanh chóp
function goldBand(yTop, yBot) {
  for (let y = yTop; y <= yBot; y += 1) {
    const { hw, cx } = coneRow(y);
    const x0 = Math.round(cx - hw);
    const x1 = Math.round(cx + hw);
    for (let x = x0; x <= x1; x += 1) {
      const t = (x - (cx - hw)) / (2 * hw || 1);
      let ch;
      if (x === x0 || x === x1) ch = 'q';
      else if (y === yBot) ch = 'w';
      else if (t < 0.26) ch = 'e';
      else if (t < 0.44) ch = 't';
      else if (t < 0.7) ch = 'r';
      else ch = 'w';
      put(x, y, ch);
    }
  }
}
goldBand(8, 9);
goldBand(14, 16);
// đá quý tím giữa dải dưới
const gem = coneRow(15);
put(gem.cx, 15, '6');
put(gem.cx - 1, 15, '5');
put(gem.cx + 1, 15, '5');
put(gem.cx, 14, '5');

// ═══════════════════════════════════════════════ 4. VÀNH MŨ (đè đỉnh cầu)
const BRIM_CY = 19.5;
const BRIM_RX = 14.5;
const BRIM_RY = 3.5;
for (let y = Math.floor(BRIM_CY - BRIM_RY); y <= Math.ceil(BRIM_CY + BRIM_RY); y += 1) {
  for (let x = Math.floor(CX - BRIM_RX - 1); x <= Math.ceil(CX + BRIM_RX + 1); x += 1) {
    const dx = (x + 0.5 - (CX + 0.7)) / BRIM_RX;
    const dy = (y + 0.5 - BRIM_CY) / BRIM_RY;
    const d = dx * dx + dy * dy;
    if (d > 1) continue;
    let ch;
    if (d > 0.86) ch = '1';
    else if (y + 0.5 < BRIM_CY - 0.6) ch = dx < -0.3 ? '5' : dx < 0.3 ? '4' : '3';
    else ch = dx < -0.25 ? '3' : dx < 0.45 ? '2' : '1';
    put(x, y, ch);
  }
}

// ═══════════════════════════════════════════════ 5. SÁCH (đè đáy cầu)
const BOOK_TOP = 36;
const BOOK_BOT = 44;
const SPINE = 23.5;
for (let y = BOOK_TOP; y <= BOOK_BOT; y += 1) {
  const p = (y - BOOK_TOP) / (BOOK_BOT - BOOK_TOP);
  const half = 6.5 + p * 8.5; // mở rộng dần xuống dưới → phối cảnh
  const cover = y >= BOOK_BOT - 1;
  for (let side = -1; side <= 1; side += 2) {
    const x0 = Math.round(side < 0 ? SPINE - half : SPINE + 1.5);
    const x1 = Math.round(side < 0 ? SPINE - 1.5 : SPINE + half);
    for (let x = x0; x <= x1; x += 1) {
      const t = Math.abs(x + 0.5 - SPINE) / half;
      let ch;
      if (cover) ch = t > 0.9 ? 'u' : 'v';
      else if (x === x0 || x === x1) ch = 'x';
      else if (t < 0.3) ch = 'z';
      else if (t < 0.46) ch = 'A';
      else if (t < 0.8) ch = 'B';
      else if (t < 0.92) ch = 'A';
      else ch = 'z';
      put(x, y, ch);
    }
  }
  // gáy sách
  for (let x = Math.round(SPINE - 1); x <= Math.round(SPINE + 1); x += 1) {
    put(x, y, cover ? 'u' : x === Math.round(SPINE) ? 'u' : 'v');
  }
}
// nét chữ mờ trang trái
for (let i = 0; i < 3; i += 1) {
  const y = BOOK_TOP + 1 + i * 2;
  for (let x = 0; x < 4 + i; x += 1) put(SPINE - 4 - x, y, 'z');
}
// tam giác Delphi phát sáng trang phải
for (let i = 0; i < 5; i += 1) {
  const y = BOOK_TOP + 1 + i;
  for (let x = -i; x <= i; x += 1) {
    put(SPINE + 7 + x, y, i === 4 || Math.abs(x) === i ? 'n' : 'o');
  }
}

// ═══════════════════════════════════════════════ 6. LẤP LÁNH
function sparkle(cx, cy, ch, size) {
  put(cx, cy, 'T');
  for (let i = 1; i <= size; i += 1) {
    put(cx + i, cy, ch);
    put(cx - i, cy, ch);
    put(cx, cy + i, ch);
    put(cx, cy - i, ch);
  }
}
sparkle(39, 9, 'S', 2);
sparkle(8, 14, 'U', 1);
sparkle(41, 27, 'U', 1);
sparkle(6, 26, 'S', 1);
sparkle(37, 33, 'U', 1);

// ═══════════════════════════════════════════════ XUẤT
const grid = G.map((row) => row.join(''));
const used = new Set(grid.join('').split('').filter((c) => c !== '.'));
for (const ch of used) {
  if (!PALETTE[ch]) throw new Error(`Ký tự '${ch}' chưa có trong palette`);
}
const palette = Object.fromEntries(Object.entries(PALETTE).filter(([k]) => used.has(k)));

writeFileSync(
  resolve(ROOT, 'src/assets/mascot.json'),
  `${JSON.stringify(
    {
      name: 'Oracle — linh vật DELPHI',
      note:
        'SINH BỞI scripts/paint-mascot.mjs (npm run mascot) — sửa dáng/ánh sáng ở file đó rồi ' +
        'sinh lại, đừng sửa tay lưới này. Đây vẫn là NGUỒN CHÂN LÝ mà Mascot.tsx + gen-icons.mjs đọc.',
      size: N,
      compactRows: [0, 34],
      palette,
      grid,
    },
    null,
    2,
  )}\n`,
);

console.log(grid.map((r) => r.replace(/\./g, ' ')).join('\n'));
console.log(`\n✔ mascot.json ${N}x${N}, ${Object.keys(palette).length} màu`);
