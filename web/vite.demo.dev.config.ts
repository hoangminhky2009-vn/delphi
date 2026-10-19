/**
 * BẢN DEMO — chạy DEV (không build) để soi màn trên chính mã đang sửa, cùng máy chủ trong trình duyệt + sổ mẫu.
 *
 * `vite.demo.config.ts` đặt `root` = `demo/`, nên ở chế độ dev đường `../src/demo/main.tsx` của `demo/index.html` ra URL
 * `/src/demo/main.tsx` và vite tìm nó trong `demo/src/` ⇒ 404 (build thì không sao: rollup đọc đường tệp trên đĩa). Tệp này
 * giữ NGUYÊN mọi thứ của cấu hình demo, chỉ đổi `root` về `web/` và trả `demo/index.html` (đã sửa đường script) cho mọi
 * lượt điều hướng — kiểu SPA — để `/tai-chinh/guong` mở thẳng được.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig, mergeConfig } from 'vite';
import goc from './vite.demo.config';

function vaoDemo(): Plugin {
  return {
    name: 'demo-dev-vao',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '/';
        const laTrang = (req.headers.accept ?? '').includes('text/html') && !url.includes('.') && !url.startsWith('/@');
        if (!laTrang) { next(); return; }
        const tho = fs.readFileSync(path.resolve(__dirname, 'demo/index.html'), 'utf8')
          .replace('../src/demo/main.tsx', '/src/demo/main.tsx');
        const html = await server.transformIndexHtml(url, tho);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(html);
      });
    },
  };
}

export default mergeConfig(goc, defineConfig({
  root: path.resolve(__dirname),
  plugins: [vaoDemo()],
  /*
   * Root là `web/` nên vite quét phụ thuộc từ `web/index.html` (app thật) → `virtual:pwa-register` (cấu hình demo không có
   * PWA) ⇒ "Failed to run dependency scan", `buffer` của worker bị phát hiện muộn ⇒ tối ưu lại + tải lại trang giữa lúc
   * worker đang dựng (đo 11/10: màn chờ đứng im). Quét đúng hai điểm vào của demo.
   */
  optimizeDeps: { entries: ['src/demo/main.tsx', 'src/demo/may_chu.worker.ts'] },
  // Cache deps riêng: `node_modules/.vite` là của `npm run dev` (app thật) — dùng chung thì hai cấu hình đá nhau mỗi lần mở.
  cacheDir: path.resolve(__dirname, 'node_modules/.vite-demo-dev'),
  /*
   * Worktree mượn `node_modules` của repo chính qua junction; vite đổi về đường THẬT (`delphi_app/web/node_modules`), nằm
   * ngoài `fs.allow` ⇒ PGlite tải `pglite.data` nhận trang 403 dài 608 byte ("Invalid FS bundle size: 608 !== 6295316").
   * Mở thêm đúng đường thật của `node_modules` (ở repo chính thì trùng đường cũ, vô hại).
   */
  server: { fs: { allow: [fs.realpathSync(path.resolve(__dirname, 'node_modules'))] } },
}));
