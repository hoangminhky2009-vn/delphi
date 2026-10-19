/**
 * PIXEL HI-BIT — hai công cụ để KHÔNG PHẢI VẼ LẠI BẰNG TAY (chỉ thị founder 30/08, D182).
 *
 * Bối cảnh: lớp icon (`web/src/components/ui/PixelIcon.tsx`) chạy trên một bảng màu
 * RIÊNG 17 màu, trong khi art thẻ chạy trên `BANG_MAU` 28 màu Hi-Bit
 * (`config/pixel_luoi.ts`). Cùng ký tự, khác màu — nặng nhất là `N`: icon hiểu là
 * NAVY #312e81, art hiểu là LỤC BẠC HÀ #bbf7d0. Founder chốt "tất cả đều hi-bit".
 *
 * ⚠ VÌ SAO KHÔNG VẼ LẠI 33 LƯỚI BẰNG TAY: lưới chỉ là mảng chuỗi, mỗi ô một ký tự
 * màu. Đổi bảng màu = ÁNH XẠ KÝ TỰ, thuần cơ học. Vẽ tay 33 lưới để làm một việc
 * `String.replace` làm được là đốt thời gian và đẻ lỗi chép tay (D61).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LỆNH 1 — `npm run pixel:hibit`            (mặc định: CHỈ BÁO CÁO, không sửa file)
 *   Tính ánh xạ 17 màu PixelIcon → màu gần nhất trong BANG_MAU, kèm:
 *     · khoảng cách màu ΔE (CIE76 trên Lab) — biết cái nào đổi nhiều
 *     · số Ô THẬT đang dùng ký tự đó — biết cái nào ảnh hưởng rộng
 *   Thêm `--ap-dung` thì mới ghi đè PixelIcon.tsx.
 *
 * LỆNH 3 — `npm run pixel:sau`                (mặc định: CHỈ BÁO CÁO)
 *   Đổ bóng 3D cho lưới icon bằng hướng đèn TRÊN-TRÁI — xem lý lẽ và bốn rào ở
 *   ngay trên `lenh3`. Thêm `--ap-dung` thì mới ghi đè.
 *
 * LỆNH 2 — `npm run pixel:anh -- <file.png> [--o 16] [--ten ten_luoi]`
 *   Chuyển MỘT ảnh (do AI khác tạo, hoặc vẽ tay) thành lưới ký tự BANG_MAU dán
 *   thẳng vào PixelIcon/art. Lấy mẫu theo lưới N×N, lượng tử hoá về 28 màu Hi-Bit,
 *   ô trong suốt thành `.`.
 *   ⚠ Không phụ thuộc thư viện ngoài — đọc PNG bằng bộ giải nén của Node (zlib).
 *     Chỉ nhận PNG 8-bit RGBA/RGB không interlace; ảnh khác thì báo lỗi rõ ràng,
 *     KHÔNG đoán bừa.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { BANG_MAU } from '../config/pixel_luoi.js';

const DUONG_ICON = 'web/src/components/ui/PixelIcon.tsx';

// ── Màu: hex → Lab, và khoảng cách CIE76 ────────────────────────────────────
// Dùng Lab chứ không dùng khoảng cách RGB thẳng: RGB coi #000→#111 xa bằng
// #0f0→#1f0, mà mắt người thì không. Ánh xạ sai ở vùng tối là chỗ đổ bóng sống.
type Rgb = readonly [number, number, number];

function hexRgb(h: string): Rgb {
  const s = h.replace('#', '');
  const n = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function rgbLab([r, g, b]: Rgb): Rgb {
  const f = (v: number) => {
    const c = v / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  };
  const [R, G, B] = [f(r), f(g), f(b)];
  // sRGB D65 → XYZ
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const k = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [k(X), k(Y), k(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = rgbLab(a);
  const [l2, a2, b2] = rgbLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Ký tự BANG_MAU gần nhất với một màu bất kỳ. */
export function kyTuGanNhat(mau: Rgb): { ky_tu: string; d: number } {
  let ky_tu = '.';
  let d = Infinity;
  for (const [k, hex] of Object.entries(BANG_MAU)) {
    const x = deltaE(mau, hexRgb(hex));
    if (x < d) {
      d = x;
      ky_tu = k;
    }
  }
  return { ky_tu, d };
}

// ── Đọc PixelIcon.tsx: bảng PALETTE + mọi lưới ──────────────────────────────
function docIcon(src: string) {
  const mP = src.match(/const PALETTE:[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!mP) throw new Error('không thấy khối PALETTE trong ' + DUONG_ICON);
  const palette: Record<string, string> = {};
  for (const m of (mP[1] ?? '').matchAll(/(\w)\s*:\s*'(#[0-9a-fA-F]{3,6})'/g)) {
    if (m[1] && m[2]) palette[m[1]] = m[2];
  }

  const mG = src.match(/const GRIDS:[^=]*=\s*\{([\s\S]*)\n\};/);
  if (!mG) throw new Error('không thấy khối GRIDS');
  const dem: Record<string, number> = {};
  let tongO = 0;
  for (const m of (mG[1] ?? '').matchAll(/'([.\w]*)'/g)) {
    for (const ch of m[1] ?? '') {
      if (ch === '.') continue;
      dem[ch] = (dem[ch] ?? 0) + 1;
      tongO++;
    }
  }
  return { palette, dem, tongO, khoiGrids: mG[1] };
}

function lenh1(apDung: boolean) {
  const src = readFileSync(DUONG_ICON, 'utf8');
  const { palette, dem, tongO } = docIcon(src);

  console.log(`\nPixelIcon: ${Object.keys(palette).length} màu · ${tongO} ô có mực\n`);
  console.log('ký tự  màu icon   →  Hi-Bit          ΔE     ô dùng   ghi chú');
  console.log('─'.repeat(74));

  const anhXa: Record<string, string> = {};
  const canhBao: string[] = [];
  const hang = Object.entries(palette).sort((a, b) => (dem[b[0]] ?? 0) - (dem[a[0]] ?? 0));

  for (const [k, hex] of hang) {
    const { ky_tu, d } = kyTuGanNhat(hexRgb(hex));
    anhXa[k] = ky_tu;
    const n = dem[k] ?? 0;
    const canh = d > 25 ? '⚠ ĐỔI NHIỀU' : d > 12 ? '· đổi thấy được' : '';
    if (d > 25 && n > 0) canhBao.push(`${k} (${hex} → ${BANG_MAU[ky_tu]}, ΔE ${d.toFixed(1)}, ${n} ô)`);
    console.log(
      `  ${k}    ${hex.padEnd(9)} →  ${ky_tu} ${(BANG_MAU[ky_tu] ?? '').padEnd(9)} ${d.toFixed(1).padStart(5)}  ${String(n).padStart(6)}   ${canh}`,
    );
  }

  // Ký tự khác nghĩa giữa hai bảng — nguy hiểm nhất, vì nó IM LẶNG.
  const trungTenKhacMau = Object.entries(palette).filter(
    ([k, hex]) => BANG_MAU[k] && BANG_MAU[k].toLowerCase() !== hex.toLowerCase(),
  );
  console.log(`\n⚠ ${trungTenKhacMau.length} ký tự TRÙNG TÊN nhưng KHÁC MÀU giữa hai bảng:`);
  for (const [k, hex] of trungTenKhacMau) {
    console.log(`    ${k}: icon ${hex}  ≠  art ${BANG_MAU[k]}`);
  }

  if (canhBao.length) {
    console.log(`\n⚠⚠ ${canhBao.length} màu đổi NHIỀU (ΔE > 25) — soi bằng mắt trước khi nhận:`);
    for (const c of canhBao) console.log('    ' + c);
  }

  if (!apDung) {
    console.log('\n(báo cáo thôi — thêm `--ap-dung` để ghi đè PixelIcon.tsx)\n');
    return;
  }

  // Áp dụng: đổi bảng PALETTE thành bảng tra vào BANG_MAU, đổi ký tự trong mọi lưới.
  const nghich = Object.fromEntries(Object.entries(anhXa).map(([a, b]) => [a, b]));
  let out = src;
  const mG = out.match(/(const GRIDS:[^=]*=\s*\{)([\s\S]*)(\n\};)/);
  if (!mG) throw new Error('không thấy GRIDS lúc áp dụng');
  const gridMoi = (mG[2] ?? '').replace(/'([.\w]*)'/g, (_all: string, s: string) =>
    "'" + [...s].map((c) => (c === '.' ? '.' : (nghich[c] ?? c))).join('') + "'",
  );
  out = out.replace(mG[0], (mG[1] ?? '') + gridMoi + (mG[3] ?? ''));

  const bangMoi =
    'const PALETTE: Record<string, string> = {\n' +
    '  // ⚠ SINH TỰ ĐỘNG bởi `npm run pixel:hibit -- --ap-dung` (D182).\n' +
    '  // Nguồn chân lý là BANG_MAU ở config/pixel_luoi.ts — ĐỪNG sửa tay ở đây,\n' +
    '  // sửa bên đó rồi chạy lại lệnh, nếu không hai bảng lại trôi khỏi nhau.\n' +
    Object.entries(BANG_MAU)
      .map(([k, v]) => `  ${k}: '${v}',`)
      .join('\n') +
    '\n};';
  out = out.replace(/const PALETTE:[^=]*=\s*\{[\s\S]*?\n\};/, bangMoi);

  writeFileSync(DUONG_ICON, out);
  console.log(`\n✓ đã ghi ${DUONG_ICON} — PixelIcon nay dùng chung BANG_MAU ${Object.keys(BANG_MAU).length} màu Hi-Bit.`);
  console.log('  Bước bắt buộc tiếp theo: soi bằng MẮT trên trình duyệt thật.\n');
}

// ── Lệnh 2: PNG → lưới ký tự ────────────────────────────────────────────────
function giaiPng(buf: Buffer) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('không phải file PNG');
  let p = 8;
  let w = 0;
  let h = 0;
  let sauBit = 0;
  let loaiMau = 0;
  let interlace = 0;
  const idat: Buffer[] = [];
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;

  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const kieu = buf.toString('ascii', p + 4, p + 8);
    const than = buf.subarray(p + 8, p + 8 + len);
    if (kieu === 'IHDR') {
      w = than.readUInt32BE(0);
      h = than.readUInt32BE(4);
      sauBit = than[8] ?? 0;
      loaiMau = than[9] ?? 0;
      interlace = than[12] ?? 0;
    } else if (kieu === 'PLTE') palette = than;
    else if (kieu === 'tRNS') trns = than;
    else if (kieu === 'IDAT') idat.push(than);
    else if (kieu === 'IEND') break;
    p += 12 + len;
  }
  if (sauBit !== 8) throw new Error(`PNG phải 8-bit mỗi kênh (file này ${sauBit}-bit)`);
  if (interlace !== 0) throw new Error('PNG interlace (Adam7) chưa hỗ trợ — xuất lại không interlace');

  const kenh = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[loaiMau];
  if (!kenh) throw new Error(`loại màu PNG ${loaiMau} chưa hỗ trợ`);
  if (loaiMau === 3 && !palette) throw new Error('PNG bảng màu nhưng thiếu PLTE');

  const raw = inflateSync(Buffer.concat(idat));
  const buoc = w * kenh;
  const px = Buffer.alloc(h * buoc);
  let truoc = Buffer.alloc(buoc);

  for (let y = 0; y < h; y++) {
    const loc = raw[y * (buoc + 1)];
    const dong = raw.subarray(y * (buoc + 1) + 1, y * (buoc + 1) + 1 + buoc);
    const ra = Buffer.alloc(buoc);
    for (let i = 0; i < buoc; i++) {
      const a = (i >= kenh ? ra[i - kenh] : 0) ?? 0;
      const b = truoc[i] ?? 0;
      const c = (i >= kenh ? truoc[i - kenh] : 0) ?? 0;
      let v = dong[i] ?? 0;
      if (loc === 1) v += a;
      else if (loc === 2) v += b;
      else if (loc === 3) v += (a + b) >> 1;
      else if (loc === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      ra[i] = v & 0xff;
    }
    ra.copy(px, y * buoc);
    truoc = ra;
  }

  // `noUncheckedIndexedAccess` bật ⇒ mọi truy cập mảng là `number | undefined`.
  // Ô ngoài biên đọc thành 0 (đen trong suốt) chứ không nổ — ảnh lỗi thì ra ô rỗng,
  // không làm sập cả lượt chuyển.
  const o = (k: number) => px[k] ?? 0;
  const bang = (k: number) => palette?.[k] ?? 0;
  const lay = (x: number, y: number): [number, number, number, number] => {
    const i = y * buoc + x * kenh;
    if (loaiMau === 3) {
      const idx = o(i);
      const a = trns && idx < trns.length ? (trns[idx] ?? 255) : 255;
      return [bang(idx * 3), bang(idx * 3 + 1), bang(idx * 3 + 2), a];
    }
    if (loaiMau === 0) return [o(i), o(i), o(i), 255];
    if (loaiMau === 4) return [o(i), o(i), o(i), o(i + 1)];
    if (loaiMau === 2) return [o(i), o(i + 1), o(i + 2), 255];
    return [o(i), o(i + 1), o(i + 2), o(i + 3)];
  };
  return { w, h, lay };
}

function lenh2(duong: string, o: number, ten: string) {
  const { w, h, lay } = giaiPng(readFileSync(duong));
  const luoi: string[] = [];
  let ngoaiBang = 0;

  for (let gy = 0; gy < o; gy++) {
    let dong = '';
    for (let gx = 0; gx < o; gx++) {
      // Trung bình ô nguồn tương ứng — chống răng cưa khi ảnh lớn hơn lưới.
      const x0 = Math.floor((gx * w) / o);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / o));
      const y0 = Math.floor((gy * h) / o);
      const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / o));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const [pr, pg, pb, pa] = lay(x, y);
          r += pr * pa;
          g += pg * pa;
          b += pb * pa;
          a += pa;
          n++;
        }
      }
      const aTb = a / n;
      if (aTb < 128) {
        dong += '.';
        continue;
      }
      const { ky_tu, d } = kyTuGanNhat([r / a, g / a, b / a] as Rgb);
      if (d > 25) ngoaiBang++;
      dong += ky_tu;
    }
    luoi.push(dong);
  }

  console.log(`\n  /** ${ten} — sinh từ ${duong} (${w}×${h} → ${o}×${o}) */`);
  console.log(`  ${ten}: [`);
  for (const d of luoi) console.log(`    '${d}',`);
  console.log('  ],\n');

  const dac = luoi.join('').split('').filter((c) => c !== '.').length;
  const soMau = new Set(luoi.join('').split('').filter((c) => c !== '.')).size;
  console.log(`  phủ ${((dac / (o * o)) * 100).toFixed(0)}% ô · ${soMau} màu`);
  if (soMau < 12) console.log(`  ⚠ ${soMau} màu < 12 — lint_pixel_art sẽ ĐỎ nếu đây là art thẻ (khối đặc, không đủ lớp sâu)`);
  if (ngoaiBang) console.log(`  ⚠ ${ngoaiBang} ô lệch bảng Hi-Bit > ΔE 25 — ảnh nguồn dùng màu ngoài hệ, soi lại bằng mắt`);
  console.log('');
}


// ── Lệnh 3: ĐỔ BÓNG 3D cho lưới icon ────────────────────────────────────────
/**
 * VÌ SAO CẦN, đo được: art thẻ 80×60 dùng 2,69–3,28 / 4 sắc độ mỗi họ và 0% lá
 * tô phẳng — tức nó ĐÃ 3D. Lớp ICON thì 1,74 / 4 và **64% lưới tô phẳng hoàn
 * toàn**. Bảng vừa được bù đủ 4 sắc độ mỗi họ (D185) nên chỗ đặt bóng đã có;
 * thiếu là thiếu người đặt.
 *
 * HƯỚNG ĐÈN: TRÊN-TRÁI. Không phải chọn theo gu — §XI khai bóng cứng
 * `--px-bong: 3px 3px 0`, tức bóng đổ XUỐNG-PHẢI, tức nguồn sáng ở TRÊN-TRÁI.
 * Đổ bóng icon ngược hướng đó là hai nguồn sáng trên cùng một màn.
 *
 * LUẬT: trong TỪNG VÙNG cùng họ màu —
 *   · thiếu hàng xóm TRÊN hoặc TRÁI  → sáng lên một nấc (mép bắt sáng)
 *   · đủ trên+trái, thiếu DƯỚI/PHẢI  → tối đi một nấc (mép khuất)
 *   · đủ bốn phía (ruột)             → giữ nguyên
 *
 * BỐN RÀO, mỗi rào chặn một cách hỏng đã lường trước:
 *  1. Lưới có RUỘT < 25% thì BỎ QUA cả lưới. Nét mảnh 1–2 ô thì mọi ô đều là
 *     mép ⇒ đổ bóng biến nó thành một khối sáng trắng. Đo: 5/33 lưới rơi vào
 *     đây (`arena` ruột 0%, `bolt` 5%, `book` 16%, `hall` 22%, `candle` 24%).
 *  2. Vùng < 8 ô thì bỏ qua — chấm nhỏ không có chỗ cho ba sắc.
 *  3. Họ nào hoạ sĩ ĐÃ dùng ≥ 3 sắc thì KHÔNG đụng: chỗ đó đã đổ bóng bằng tay,
 *     và tay người luôn thắng thuật toán.
 *  4. Mép sáng KHÔNG BAO GIỜ lên tới nấc sáng nhất của họ. Nấc đó nằm trong
 *     `O_PHAT_SANG` (toả quầng neon), và chú thích của chính tập đó cảnh báo
 *     "glow tất cả là mất tương phản" — tự động hoá mà đẩy hàng nghìn ô vào
 *     nhóm phát sáng là làm hỏng đúng thứ luật đó bảo vệ.
 */
function hoCuaKyTu(): Record<string, string[]> {
  // Đọc HỌ từ chính chú thích `// ── tên họ` trong BANG_MAU: một nguồn, không
  // chép tay danh sách họ ra đây (bản sao sẽ trôi — D61).
  const src = readFileSync('config/pixel_luoi.ts', 'utf8');
  const khoi = src.match(/export const BANG_MAU[\s\S]*?\n\};/)?.[0] ?? '';
  const ho: Record<string, string[]> = {};
  let ten = '?';
  for (const dong of khoi.split('\n')) {
    const c = dong.match(/──\s*([^(\n*]+)/);
    if (c && !dong.includes('*/')) { ten = c[1]!.trim(); ho[ten] ??= []; continue; }
    if (dong.trimStart().startsWith('*')) continue;
    for (const m of dong.matchAll(/(\w):\s*'#/g)) (ho[ten] ??= []).push(m[1]!);
  }
  return ho;
}

function lenh3(apDung: boolean) {
  const src = readFileSync(DUONG_ICON, 'utf8');
  const ho = hoCuaKyTu();
  const cua: Record<string, { ten: string; i: number; day: string[] }> = {};
  for (const [ten, ks] of Object.entries(ho)) {
    ks.forEach((k, i) => { cua[k] = { ten, i, day: ks }; });
  }

  const mG = src.match(/(const GRIDS:[^=]*=\s*\{)([\s\S]*)(\n\};)/);
  if (!mG) throw new Error('không thấy GRIDS');

  let doiTong = 0;
  const boQua: string[] = [];
  const daSua: string[] = [];

  const than = (mG[2] ?? '').replace(
    /(\w+):\s*\[([\s\S]*?)\n(\s*)\]/g,
    (all: string, ten: string, thanLuoi: string, thut: string) => {
      const luoi = [...thanLuoi.matchAll(/'([^']*)'/g)].map((x) => x[1]!);
      if (luoi.length < 8) return all;
      const H = luoi.length;
      const W = luoi[0]!.length;
      const at = (x: number, y: number) =>
        y >= 0 && y < H && x >= 0 && x < W ? (luoi[y]![x] ?? '.') : '.';

      // Rào 1 — ruột cả lưới
      let muc = 0, ruot = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (at(x, y) === '.') continue;
        muc++;
        if (at(x, y - 1) !== '.' && at(x - 1, y) !== '.' && at(x, y + 1) !== '.' && at(x + 1, y) !== '.') ruot++;
      }
      if (!muc || ruot / muc < 0.25) { boQua.push(`${ten}(ruột ${Math.round((ruot / (muc || 1)) * 100)}%)`); return all; }

      // Đếm sắc độ đã dùng theo họ + cỡ vùng
      const dungHo: Record<string, Set<string>> = {};
      for (const d of luoi) for (const c of d) {
        const h = cua[c]; if (!h) continue;
        (dungHo[h.ten] ??= new Set<string>()).add(c);
      }
      const coHo: Record<string, number> = {};
      for (const d of luoi) for (const c of d) {
        const h = cua[c]; if (!h) continue;
        coHo[h.ten] = (coHo[h.ten] ?? 0) + 1;
      }

      let doi = 0;
      const moi = luoi.map((hang, y) =>
        [...hang].map((c, x) => {
          const h = cua[c];
          if (!h) return c;
          if ((dungHo[h.ten]?.size ?? 0) >= 3) return c;   // rào 3
          if ((coHo[h.ten] ?? 0) < 8) return c;            // rào 2
          const cungHo = (xx: number, yy: number) => {
            const k = at(xx, yy);
            return k !== '.' && cua[k]?.ten === h.ten;
          };
          const tren = cungHo(x, y - 1), trai = cungHo(x - 1, y);
          const duoi = cungHo(x, y + 1), phai = cungHo(x + 1, y);
          if (tren && trai && duoi && phai) return c;
          let iMoi = h.i;
          if (!tren || !trai) iMoi = Math.max(1, h.i - 1);  // rào 4: không chạm nấc 0
          else if (!duoi || !phai) iMoi = Math.min(h.day.length - 1, h.i + 1);
          const k = h.day[iMoi]!;
          if (k !== c) doi++;
          return k;
        }).join(''),
      );
      if (!doi) return all;
      doiTong += doi;
      daSua.push(`${ten}(+${doi})`);
      return `${ten}: [\n${moi.map((d) => `${thut}  '${d}',`).join('\n')}\n${thut}]`;
    },
  );

  console.log(`\nĐỔ BÓNG 3D — đèn TRÊN-TRÁI`);
  console.log(`  lưới được đổ bóng : ${daSua.length}`);
  console.log(`  ô đổi sắc độ      : ${doiTong}`);
  console.log(`  lưới BỎ QUA (mảnh): ${boQua.length}  ${boQua.join(' · ')}`);
  if (daSua.length) console.log(`  chi tiết: ${daSua.slice(0, 14).join(' · ')}${daSua.length > 14 ? ' …' : ''}`);

  if (!apDung) { console.log('\n(báo cáo thôi — thêm `--ap-dung` để ghi đè)\n'); return; }
  writeFileSync(DUONG_ICON, src.replace(mG[0], (mG[1] ?? '') + than + (mG[3] ?? '')));
  console.log(`\n✓ đã ghi ${DUONG_ICON}. Bước bắt buộc: SOI BẰNG MẮT.\n`);
}

// ── Vào ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const anh = argv.find((a) => /\.png$/i.test(a));
if (anh) {
  const o = Number(argv[argv.indexOf('--o') + 1]) || 16;
  const i = argv.indexOf('--ten');
  lenh2(anh, o, (i >= 0 ? argv[i + 1] : undefined) ?? 'luoi_moi');
} else if (argv.includes('--do-bong')) {
  lenh3(argv.includes('--ap-dung'));
} else {
  lenh1(argv.includes('--ap-dung'));
}
