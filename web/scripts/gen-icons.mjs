/**
 * Sinh toàn bộ icon app từ MỘT nguồn: src/assets/mascot.json (lưới pixel Oracle).
 * Chạy: npm run icons  (trong web/)
 *
 * Xuất ra public/icons/: icon.svg (favicon), icon-180/192/512.png (app + apple-touch),
 * icon-maskable-512.png (Android adaptive — mascot nhỏ hơn, nền tràn viền).
 * PNG encode bằng zlib built-in của Node — KHÔNG thêm dependency (A8.9).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/icons');

const BG = [4, 7, 13]; // --bg-page #04070d
const GLOW = [124, 58, 237]; // --violet-ish, quầng sau linh vật

// ---------------------------------------------------------------- lưới nguồn
const spec = JSON.parse(readFileSync(resolve(ROOT, 'src/assets/mascot.json'), 'utf8'));
const N = spec.size;
if (spec.grid.length !== N) {
  throw new Error(`mascot.json: có ${spec.grid.length} hàng, cần ${N}`);
}
spec.grid.forEach((row, y) => {
  if (row.length !== N) throw new Error(`mascot.json: hàng ${y} dài ${row.length}, cần ${N}`);
  for (const ch of row) {
    if (ch !== '.' && !spec.palette[ch]) throw new Error(`mascot.json: hàng ${y} có ký tự '${ch}' không có trong palette`);
  }
});

/**
 * Hộp bao nội dung — căn giữa linh vật thay vì căn giữa lưới.
 * `rows` giới hạn dải hàng: bản compact chỉ lấy mũ + quả cầu (bỏ sách) để icon
 * cỡ nhỏ (favicon 32px) còn đọc ra hình, không bị nát chi tiết.
 */
function contentBox(rows = [0, N - 1]) {
  let x0 = N, y0 = N, x1 = -1, y1 = -1;
  for (let y = Math.max(0, rows[0]); y <= Math.min(N - 1, rows[1]); y += 1) {
    for (let x = 0; x < N; x += 1) {
      if (spec.grid[y][x] !== '.') {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
const BOX = contentBox();
const COMPACT = spec.compactRows ? contentBox(spec.compactRows) : BOX;

const hex2rgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const RGB = Object.fromEntries(Object.entries(spec.palette).map(([k, v]) => [k, hex2rgb(v)]));

// ------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ vẽ icon
/**
 * @param size cạnh ảnh (px)
 * @param opts.fill tỉ lệ chiều cao linh vật so với ảnh
 * @param opts.radius bo góc theo tỉ lệ cạnh (0 = vuông tràn viền cho maskable)
 */
function drawIcon(size, { fill = 0.78, radius = 0.22, box = BOX } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const r = radius * size;
  const cell = (size * fill) / box.h;
  const drawW = box.w * cell;
  const drawH = box.h * cell;
  const offX = (size - drawW) / 2;
  const offY = (size - drawH) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const glowR = size * 0.46;

  const insideRounded = (x, y) => {
    if (r <= 0) return true;
    const qx = Math.min(x, size - 1 - x);
    const qy = Math.min(y, size - 1 - y);
    if (qx >= r || qy >= r) return true;
    const dx = r - qx;
    const dy = r - qy;
    return dx * dx + dy * dy <= r * r;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      if (!insideRounded(x + 0.5, y + 0.5)) {
        px[i + 3] = 0;
        continue;
      }
      // nền + quầng sáng tím nhạt phía sau
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / glowR;
      const g = Math.max(0, 1 - dist) ** 2 * 0.42;
      px[i] = Math.round(BG[0] + (GLOW[0] - BG[0]) * g);
      px[i + 1] = Math.round(BG[1] + (GLOW[1] - BG[1]) * g);
      px[i + 2] = Math.round(BG[2] + (GLOW[2] - BG[2]) * g);
      px[i + 3] = 255;

      // linh vật (nearest-neighbour — giữ nét pixel sắc)
      const gx = Math.floor((x + 0.5 - offX) / cell) + box.x0;
      const gy = Math.floor((y + 0.5 - offY) / cell) + box.y0;
      if (gy >= 0 && gy < N && gx >= 0 && gx < N) {
        const ch = spec.grid[gy][gx];
        const col = RGB[ch];
        if (col) {
          px[i] = col[0];
          px[i + 1] = col[1];
          px[i + 2] = col[2];
        }
      }
    }
  }
  return encodePng(size, px);
}

// ------------------------------------------------------------------- SVG
function buildSvg() {
  const rects = [];
  for (let y = 0; y < N; y += 1) {
    let x = 0;
    while (x < N) {
      const ch = spec.grid[y][x];
      if (ch === '.') {
        x += 1;
        continue;
      }
      let run = 1;
      while (x + run < N && spec.grid[y][x + run] === ch) run += 1;
      rects.push(
        `<rect x="${x - BOX.x0}" y="${y - BOX.y0}" width="${run}" height="1" fill="${spec.palette[ch]}"/>`,
      );
      x += run;
    }
  }
  const pad = 2;
  const vb = `${-pad} ${-pad} ${BOX.w + pad * 2} ${BOX.h + pad * 2}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" shape-rendering="crispEdges">
  <defs><radialGradient id="g"><stop offset="0" stop-color="#7c3aed" stop-opacity=".45"/><stop offset="1" stop-color="#04070d" stop-opacity="0"/></radialGradient></defs>
  <rect x="${-pad}" y="${-pad}" width="${BOX.w + pad * 2}" height="${BOX.h + pad * 2}" rx="6" fill="#04070d"/>
  <circle cx="${BOX.w / 2}" cy="${BOX.h / 2}" r="${BOX.h * 0.62}" fill="url(#g)"/>
  ${rects.join('\n  ')}
</svg>
`;
}

// ------------------------------------------------------------------- chạy
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'icon.svg'), buildSvg());
for (const size of [180, 192, 512]) {
  writeFileSync(resolve(OUT_DIR, `icon-${size}.png`), drawIcon(size));
}
writeFileSync(resolve(OUT_DIR, 'icon-maskable-512.png'), drawIcon(512, { fill: 0.6, radius: 0 }));
// favicon: dùng bản compact (mũ + quả cầu) — ở 32px cả người sẽ nát
writeFileSync(resolve(OUT_DIR, 'favicon-64.png'), drawIcon(64, { fill: 0.86, box: COMPACT }));
console.log(
  `✔ Sinh icon Oracle từ mascot.json — đầy đủ ${BOX.w}x${BOX.h}, compact ${COMPACT.w}x${COMPACT.h} → public/icons/`,
);
