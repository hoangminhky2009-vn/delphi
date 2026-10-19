/**
 * SINH DANH SÁCH ROUTE — ảnh chụp bề mặt API, SINH RA chứ không gõ tay.
 *
 * ─── VÌ SAO TỆP NÀY TỒN TẠI ──────────────────────────────────────────────────
 * Rà kiến trúc 03/09/2026: repo có hơn 100 route dưới `/api/v1` mà KHÔNG có một
 * chỗ nào liệt kê chúng — không OpenAPI, không client sinh tự động, không doc.
 * Người mới (và người cũ sau ba tuần) phải đọc gần 2.000 dòng `server/app.ts`
 * cộng 17 tệp đăng ký route mới biết app có mặt nào quay ra ngoài.
 *
 * ─── VÌ SAO SINH, KHÔNG CHÉP (D61 · A11.5) ───────────────────────────────────
 * Một bảng route gõ tay là bản sao thứ hai của `server/app.ts`, và bản sao thứ
 * hai SẼ trôi im lặng — đúng vết mục A6 trong `docs/luat/04-du-lieu.md`, nơi
 * schema chép tay còn 11 bảng trong khi DB thật đã 56, trôi suốt 45 migration
 * mà không có gì báo. Nên tệp này KHÔNG đọc mã nguồn bằng regex: nó DỰNG APP
 * THẬT rồi hỏi Hono `app.routes`. Sai lệch duy nhất còn có thể xảy ra là app
 * không dựng nổi — mà lúc đó test đỏ chứ không âm thầm.
 *
 * ─── KHUÔN GIỐNG `nk:index` (D203) ───────────────────────────────────────────
 * `--ghi` sinh tệp · `--kiem` so tệp trên đĩa với bản sinh ra rồi trả mã lỗi.
 * `tests/route_danh_sach.test.ts` canh cùng phép so đó, nên thêm route mà quên
 * chạy `route:ghi` là CI đỏ — không phải doc trôi lặng lẽ.
 *
 * ⚠ KHÔNG NỐI DB. `createApp` chỉ ĐĂNG KÝ route lúc dựng; pool/mailer ở đây là
 * vật giả. Ngày nào `createApp` truy vấn ngay lúc dựng thì tệp này gãy to và
 * gãy ngay — đó là hành vi mong muốn, đừng vá bằng cách nối DB thật vào.
 */
import { writeFile, readFile } from 'node:fs/promises';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import type { Mailer } from '../server/email.js';
import { khopBoQuaDong } from './_chuan_dong.js';
import { NHAN_ROUTE, ROUTE_NHAN } from '../config/route_nhan.js';

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEP = 'docs/api/danh-sach-route.md';

/** Vật giả: `createApp` không chạm tới chúng lúc đăng ký route. */
const POOL_GIA = {} as unknown as pg.Pool;
const MAILER_GIA = { send: async () => undefined } as unknown as Mailer;

interface Duong {
  method: string;
  path: string;
  /**
   * Tên MỌI handler theo đúng thứ tự Hono chạy, GIỮ CẢ chuỗi rỗng của hàm ẩn
   * danh — vì VỊ TRÍ mới phân biệt guard với handler, không phải cái tên.
   */
  handlers: string[];
}

/**
 * Hono thêm MỘT dòng vào `app.routes` cho MỖI handler, nên
 * `app.get('/x', requireAuth, requireAdmin, fn)` ra ba dòng cùng (method, path).
 * Gộp theo khoá đó thì chuỗi handler chính là chuỗi Hono sẽ chạy thật — không
 * phải suy diễn từ mã nguồn.
 */
export function gopRoute(
  routes: readonly { method: string; path: string; handler: unknown }[],
): Duong[] {
  const bang = new Map<string, Duong>();
  for (const r of routes) {
    const khoa = `${r.method} ${r.path}`;
    let d = bang.get(khoa);
    if (d === undefined) {
      d = { method: r.method, path: r.path, handlers: [] };
      bang.set(khoa, d);
    }
    d.handlers.push(typeof r.handler === 'function' ? r.handler.name : '');
  }
  return [...bang.values()];
}

/**
 * Guard của một route = MỌI handler TRỪ cái cuối, vì cái cuối là handler nghiệp
 * vụ chứ không phải cửa.
 *
 * ⚠ ĐỪNG lọc theo "có tên hay không". JS SUY tên từ chỗ gán: một hàm ẩn danh
 * viết thẳng vào `app.get(...)` có `.name` rỗng, nhưng cũng hàm đó gán vào biến
 * hay thuộc tính thì lại có tên. Lọc theo tên là để cột guard đổi nội dung theo
 * CÁCH NGƯỜI TA VIẾT, không theo thứ nó thật sự làm.
 */
export function guardCua(d: { handlers: readonly string[] }): string[] {
  return d.handlers.slice(0, -1).filter((h) => h !== '');
}

/** Miền của một đường — chỉ để gom nhóm cho người đọc. */
export function mien(duong: string): string {
  const p = duong.replace(/^\/api\/v1\//, '').replace(/^\//, '');
  const seg = p.split('/')[0] ?? '';
  if (duong === '/admin' || seg === 'admin') return 'admin';
  if (seg === '' || seg === '*') return '(toàn cục)';
  return seg;
}

/**
 * K5 — NƠI CÓ NGƯỜI GỌI API: mã client (`web/src`), trang admin (`web/quan-tri.html` · `server/admin_ui.ts`) và Worker
 * (`web/worker`). Bỏ bài test (`*.test.*`) — bài test gọi một route không biến nó thành route có người dùng.
 */
export const NGUON_GOI = ['web/src', 'web/quan-tri.html', 'web/worker', 'server/admin_ui.ts'] as const;

/** Toàn bộ chữ của các nguồn gọi, nối lại — đọc một lần cho cả bảng route. */
export function chuNguonGoi(goc: string = GOC): string {
  const phan: string[] = [];
  const di = (p: string) => {
    if (statSync(p).isDirectory()) {
      for (const ten of readdirSync(p)) if (ten !== 'node_modules') di(path.join(p, ten));
      return;
    }
    if (/\.(test|spec)\.[a-z]+$/.test(p) || !/\.(ts|tsx|js|mjs|html)$/.test(p)) return;
    phan.push(readFileSync(p, 'utf8'));
  };
  for (const n of NGUON_GOI) di(path.join(goc, n));
  return phan.join('\n');
}

/** Một đoạn đường DỰNG ĐỘNG trong mã gọi: `${x}` của template, hoặc `' + x + '` của phép nối (có thể vắt dòng). */
const DOAN_DONG = String.raw`(?:\$\{[^}]+\}|['"]\s*\+[\s\S]{0,120}?\+\s*['"])`;
const DAU = String.raw`(?:['"\x60]|/api/v1)`;
const CUOI = String.raw`(?=['"\x60?#])`;
const thoat = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Route có chỗ gọi không? Tìm ĐƯỜNG (bỏ `/api/v1`) như một chuỗi trong mã gọi, đứng sau dấu nháy (hoặc sau `/api/v1`) và trước
 * dấu nháy · `?` · `#` — nên `/me/tu-khai` không ăn nhầm `/me/tu-khai-moi`. Mỗi đoạn khớp chữ của nó HOẶC một đoạn dựng động
 * (`/admin/tk/${duong}` là chỗ gọi của cả năm mặt `/admin/tk/*` — đúng thế thật); `:tham_so` khớp thêm một đoạn chữ bất kỳ.
 * Đuôi dựng động (`'/api/v1/admin/2fa/' + duong`) phủ phần còn lại — nhưng phải có ít nhất HAI đoạn chữ khớp trước nó, để
 * `'/api/v1/' + x` không thành "chỗ gọi" của mọi route.
 */
export function coNguoiGoi(duong: string, chu: string): boolean {
  const segs = duong.replace(/^\/api\/v1(?=\/)/, '').split('/').slice(1);
  const doan = segs.map((seg) => (seg.startsWith(':')
    ? `(?:${DOAN_DONG}|[A-Za-z0-9_-]+)`
    : `(?:${thoat(seg)}|${DOAN_DONG})`));
  const mau = [`${DAU}/${doan.join('/')}${CUOI}`];
  for (let i = 2; i < segs.length; i += 1) {
    const truoc = segs.slice(0, i);
    if (truoc.some((s) => s.startsWith(':'))) break;
    mau.push(`${DAU}/${truoc.map(thoat).join('/')}/['"\\x60]\\s*\\+`);
  }
  return mau.some((m) => new RegExp(m).test(chu));
}

/** Che ký tự gạch đứng để không vỡ bảng markdown. */
function o(s: string): string {
  return s.split('|').join('\\|');
}

export async function sinhDanhSachRoute(): Promise<string> {
  const app = createApp({
    pool: POOL_GIA,
    mailer: MAILER_GIA,
    appBaseUrl: 'https://vi-du.invalid',
  });

  const tatCa = gopRoute(app.routes);
  // `app.use('/tien-to/*', mw)` vào Hono với method ALL. Nó phủ NHIỀU route nên
  // tách riêng — và nó cũng KHÔNG bị bỏ phần tử cuối: cả chuỗi của nó là cửa.
  const middleware = tatCa
    .filter((d) => d.method === 'ALL')
    .sort((a, b) => a.path.localeCompare(b.path));
  const routes = tatCa
    .filter((d) => d.method !== 'ALL')
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

  const nhom = new Map<string, Duong[]>();
  for (const d of routes) {
    const k = mien(d.path);
    const ds = nhom.get(k);
    if (ds === undefined) nhom.set(k, [d]);
    else ds.push(d);
  }

  const dong: string[] = [
    '# DANH SÁCH ROUTE — SINH RA, ĐỪNG GÕ TAY',
    '',
    '<!-- Sinh bằng `npm run route:ghi`. Sửa tay là mất ở lần sinh sau. -->',
    '',
    '> Nguồn chân lý là **chính app đang chạy**: tệp này dựng `createApp()` rồi hỏi',
    '> `app.routes`, không đọc mã bằng regex. Thêm route mà quên chạy `route:ghi`',
    '> ⇒ `tests/route_danh_sach.test.ts` đỏ (khuôn `nk:index`, D203).',
    '',
    `**${routes.length}** route · **${middleware.length}** lớp middleware theo tiền tố.`,
    '',
    '## Middleware theo tiền tố',
    '',
    'Chạy TRƯỚC mọi route khớp tiền tố, kể cả route thêm sau này.',
    '',
    '| tiền tố | middleware |',
    '|---|---|',
    ...middleware.map((d) => {
      const ten = d.handlers.filter((h) => h !== '');
      const co = ten.length > 0 ? ten.map((h) => `\`${o(h)}\``).join(' → ') : '_(ẩn danh)_';
      return `| \`${o(d.path)}\` | ${co} |`;
    }),
    '',
    '## Route theo miền',
    '',
  ];

  for (const k of [...nhom.keys()].sort()) {
    const ds = nhom.get(k) ?? [];
    dong.push(`### ${k} — ${ds.length} route`, '', '| method | đường | guard | trạng thái |', '|---|---|---|---|');
    for (const d of ds) {
      const gs = guardCua(d);
      const g = gs.length > 0 ? gs.map((h) => `\`${o(h)}\``).join(' + ') : '_không_';
      // K5 — trống = có client gọi; nhãn = lý do một route không ai gọi vẫn sống (`config/route_nhan.ts`).
      const nhan = ROUTE_NHAN[`${d.method} ${d.path}`];
      dong.push(`| ${d.method} | \`${o(d.path)}\` | ${g} | ${nhan ? NHAN_ROUTE[nhan] : ''} |`);
    }
    dong.push('');
  }

  return `${dong.join('\n').trimEnd()}\n`;
}

async function main(): Promise<void> {
  const lenh = process.argv[2];
  const noiDung = await sinhDanhSachRoute();
  const duong = path.join(GOC, TEP);

  if (lenh === '--ghi') {
    await writeFile(duong, noiDung, 'utf8');
    console.log(`Đã ghi ${TEP}`);
    return;
  }
  if (lenh === '--kiem') {
    const tren = await readFile(duong, 'utf8').catch(() => null);
    // ⚠ So BỎ QUA kiểu xuống dòng: bộ sinh ghi LF, `git checkout` trên Windows trả
    // CRLF (`core.autocrlf`). So thô ⇒ đỏ trên mọi bản clone. Xem `_chuan_dong.ts`.
    if (tren !== null && khopBoQuaDong(tren, noiDung)) {
      console.log(`✔ ${TEP} khớp với app đang chạy.`);
      return;
    }
    console.error(`✖ ${TEP} đã trôi khỏi app. Chạy: npm run route:ghi`);
    process.exit(1);
  }
  console.error('Dùng: --ghi | --kiem');
  process.exit(1);
}

const LA_CLI =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (LA_CLI) {
  await main();
}
