/**
 * BẢN DEMO "KHÁCH NÂNG CAO" — cấu hình build riêng (founder 28/09: link cho pitch deck, không đăng nhập, không lưu dữ liệu).
 *
 * Khác `vite.config.ts` đúng ba chỗ, và mỗi chỗ có lý do:
 *   · KHÔNG PWA — bản demo không cài được, không service worker, không cache sống qua lần mở sau;
 *   · điểm vào `demo/index.html` → `src/demo/main.tsx` (máy chủ trong trang), không `quan-tri.html`;
 *   · module Node của server trỏ sang lớp đệm `src/demo/shim/*` (server chạy trong Web Worker).
 * Alias `@` · `@config` · `@server` giữ NGUYÊN như bản thật — cùng một mã, không nhánh demo trong nghiệp vụ.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const shim = (t: string) => path.resolve(__dirname, 'src/demo/shim', t);
const RA = path.resolve(__dirname, 'dist-demo');

/*
 * CSP của app thật (`public/_headers`: `script-src 'self'`) CHẶN biên dịch WebAssembly — PGlite là một module WASM, nên
 * bản demo trên Cloudflare đứng im ở màn chờ (đo 28/09 trên link thật: `CompileError … 'unsafe-eval' is not an allowed
 * source`). Nới ĐÚNG MỘT nguồn `'wasm-unsafe-eval'` (chỉ cho biên dịch WASM, KHÔNG mở `eval` của JS) và CHỈ ở bản demo:
 * app thật giữ nguyên CSP của nó. Không khớp chuỗi thì build ĐỎ — thà hỏng to lúc build còn hơn một link đứng im.
 */
const CSP_CU = "script-src 'self';";
const CSP_DEMO = "script-src 'self' 'wasm-unsafe-eval';";
export function headerChoDemo(goc: string): string {
  if (!goc.includes(CSP_CU)) throw new Error(`demo: _headers không còn "${CSP_CU}" — sửa headerChoDemo cho khớp CSP mới`);
  return goc.split(CSP_CU).join(CSP_DEMO);
}
/** `_headers` của bản demo — MỘT chuỗi dùng cho cả tệp ghi ra lẫn dấu băm trên tên worker (dưới). */
export const HEADER_DEMO = headerChoDemo(fs.readFileSync(path.resolve(__dirname, 'public/_headers'), 'utf8'));
/*
 * Worker nhận CSP từ CHÍNH phản hồi của tệp worker, và tệp ấy nằm dưới `/assets/` — cache `immutable` một năm. Đổi
 * header mà mã worker không đổi thì tên băm y cũ ⇒ trình duyệt từng mở link giữ nguyên header CŨ mãi (đo 28/09: sửa CSP
 * xong, link vẫn đứng im trên máy đã mở bản hỏng; tải lại cứng không cứu vì Chrome không bỏ cache cho script worker).
 * Nên tên tệp worker mang thêm băm của header: header đổi ⇒ tên đổi ⇒ không ai kẹt với bản cũ.
 */
export const BAM_HEADER = createHash('sha256').update(HEADER_DEMO).digest('hex').slice(0, 8);

function headerDemo(): Plugin {
  return {
    name: 'demo-header',
    closeBundle() {
      fs.writeFileSync(path.join(RA, '_headers'), HEADER_DEMO);
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname, 'demo'),
  publicDir: path.resolve(__dirname, 'public'),
  plugins: [react(), headerDemo()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@config': path.resolve(__dirname, '../config'),
      '@server': path.resolve(__dirname, '../server'),
      'node:crypto': shim('crypto.ts'),
      '@node-rs/argon2': shim('argon2.ts'),
      nodemailer: shim('rong.ts'),
      'node:zlib': shim('rong.ts'),
    },
  },
  worker: { format: 'es', rollupOptions: { output: { entryFileNames: `assets/[name]-[hash]-h${BAM_HEADER}.js` } } },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: {
    outDir: RA,
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
});
