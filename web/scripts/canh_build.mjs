/**
 * BÀI CANH GÓI BUILD — chạy SAU `vite build` (CI job web, bước "Canh build"); đọc `web/dist`, không dựng gì
 * (SPEC `docs/spec/cai-app-pfm-trong-ban-cai.md` mục 5 + E10, D603 đợt 2).
 *
 * Bốn điều chỉ lộ ra ở gói build, bài vitest không thấy được:
 *   1. `manifest.webmanifest` có `display: standalone` + `start_url: '/'` — thiếu là "Thêm vào MH chính" ra một lối tắt trang web,
 *      không phải bản cài, và cổng PFM (`daCai`) không bao giờ mở.
 *   2. `index.html` có `apple-mobile-web-app-status-bar-style` = `black-translucent` (bản cài iOS toàn màn hình; mọi màn chừa
 *      `--an-tren`).
 *   3. ⭐ E10 — gói prod KHÔNG chứa đường giả lập bản cài (`?ban_cai=1`, `lib/cai_app.ts` `giaLapBanCai`): còn chuỗi `ban_cai` tức là
 *      ai đó kéo nó ra khỏi khối `if (import.meta.env.DEV)` ⇒ người chơi tự mở khoá PFM trên tab trình duyệt bằng một tham số URL.
 *   4. Precache của service worker ≤ 3 MB — câu "dưới 3 MB" trên màn cổng (`lib/cai_app_chu.ts`) là SỐ ĐO, không khẩu hiệu.
 *
 * Chạy: `node scripts/canh_build.mjs [thư mục dist]` (mặc định `web/dist`). Thoát 1 nếu có lỗi. Bài canh của chính bài canh:
 * `web/tests/canh_build.test.ts` (dựng dist giả, tiêm từng lỗi).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Trần precache (byte) — khớp câu "dưới 3 MB" của màn cổng. */
export const TRAN_PRECACHE = 3_000_000;

function moiTep(thuMuc) {
  const ra = [];
  for (const e of fs.readdirSync(thuMuc, { withFileTypes: true })) {
    const p = path.join(thuMuc, e.name);
    if (e.isDirectory()) ra.push(...moiTep(p));
    else ra.push(p);
  }
  return ra;
}

/** Tổng byte các tệp service worker precache (đọc danh sách `url` trong `sw.js` do Workbox sinh). */
export function doPrecache(dist) {
  const sw = path.join(dist, 'sw.js');
  if (!fs.existsSync(sw)) return { tong: null, so: 0 };
  const src = fs.readFileSync(sw, 'utf8');
  const urls = [...new Set([...src.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]))];
  let tong = 0;
  for (const u of urls) {
    const p = path.join(dist, u.split('?')[0]);
    if (fs.existsSync(p)) tong += fs.statSync(p).size;
  }
  return { tong, so: urls.length };
}

/** Trả danh sách lỗi (rỗng = xanh). */
export function kiemBuild(dist) {
  const loi = [];
  const mf = path.join(dist, 'manifest.webmanifest');
  if (!fs.existsSync(mf)) loi.push('thiếu manifest.webmanifest');
  else {
    const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
    if (m.display !== 'standalone') loi.push(`manifest.display = ${JSON.stringify(m.display)} (phải "standalone")`);
    if (m.start_url !== '/') loi.push(`manifest.start_url = ${JSON.stringify(m.start_url)} (phải "/")`);
  }
  const html = path.join(dist, 'index.html');
  if (!fs.existsSync(html)) loi.push('thiếu index.html');
  else if (!/<meta\s+name="apple-mobile-web-app-status-bar-style"\s+content="black-translucent"/.test(fs.readFileSync(html, 'utf8'))) {
    loi.push('index.html thiếu meta apple-mobile-web-app-status-bar-style = black-translucent');
  }
  const ro = moiTep(dist).filter((p) => /\.(js|html)$/.test(p) && fs.readFileSync(p, 'utf8').includes('ban_cai'));
  if (ro.length > 0) loi.push(`gói prod chứa đường giả lập bản cài "ban_cai" (E10): ${ro.map((p) => path.relative(dist, p)).join(', ')}`);
  const { tong, so } = doPrecache(dist);
  if (tong === null) loi.push('thiếu sw.js (service worker) — không đo được precache');
  else if (so === 0) loi.push('sw.js không có danh sách precache nào');
  else if (tong > TRAN_PRECACHE) loi.push(`precache ${(tong / 1e6).toFixed(2)} MB > 3 MB — câu "dưới 3 MB" ở màn cổng sai, sửa câu theo số mới`);
  return loi;
}

const laChinh = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (laChinh) {
  const dist = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist'));
  const loi = kiemBuild(dist);
  const { tong, so } = doPrecache(dist);
  console.log(`canh build: ${dist}\n  precache ${so} tệp · ${tong === null ? '?' : (tong / 1e6).toFixed(2)} MB (trần ${TRAN_PRECACHE / 1e6} MB)`);
  for (const l of loi) console.log(`  ✗ ${l}`);
  console.log(loi.length === 0 ? '  ✓ xanh' : `  ${loi.length} lỗi`);
  process.exit(loi.length === 0 ? 0 : 1);
}
