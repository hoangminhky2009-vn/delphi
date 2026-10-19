/**
 * Cấu hình build frontend. Ràng buộc nhúng sẵn ở đây (đọc trước khi sửa):
 *  - C6/PWA: app cài được lên màn hình chính; service worker CHỈ cache asset tĩnh,
 *    KHÔNG BAO GIỜ cache response /api (số dư/odds cũ hiển thị lại = tai nạn tiền tệ).
 *  - A8.9: alias @config trỏ thẳng ../config — một nguồn chân lý, không copy hằng số.
 *  - Dev: /api proxy sang API dev local (npm run dev:api ở repo gốc, cổng 8787).
 */
import path from 'node:path';
import fs from 'node:fs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';
import { BAN_PHAT_HANH } from '../config/phien_ban';

/*
 * D335 — APP QUẢN TRỊ RIÊNG là trang HTML thứ hai (`quan-tri.html`). Ba chỗ phải khớp nhau, thiếu một là gói
 * quản trị lại rơi về máy người chơi hoặc trang quản trị bị SPA người chơi nuốt:
 *   1. `rollupOptions.input` — hai cửa vào.
 *   2. Tên tệp: chunk CHỈ phục vụ quản trị mang tiền tố `qt-`, để…
 *   3. …service worker của app người chơi bỏ qua chúng (`globIgnores`) và không nuốt đường `/quan-tri`
 *      (`navigateFallbackDenylist`). Đo 15/09 trước đợt này: sw.js precache `QuanTri-*.js` về máy MỌI người chơi.
 */
const THU_MUC_QUAN_TRI = ['/src/quan-tri/', '/src/screens/admin/', '/src/api/phantich', '/src/api/vanhanh',
  '/src/api/thongke', '/src/api/quankeo'];
const laChunkQuanTri = (ids: readonly string[]) =>
  ids.length > 0 && ids.every((id) => THU_MUC_QUAN_TRI.some((d) => id.split('\\').join('/').includes(d)));

/** Dev: `/quan-tri` (không đuôi) trỏ về `quan-tri.html`, giống html_handling của Cloudflare ở prod. */
const duongQuanTriDev = (): Plugin => ({
  name: 'duong-quan-tri-dev',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && /^\/quan-tri(\?|$)/.test(req.url)) req.url = req.url.replace('/quan-tri', '/quan-tri.html');
      next();
    });
  },
});

/*
 * `/phien-ban.json` — bản phát hành mà gói web NÀY được build từ. Máy chủ (`GET /api/v1/canh`) đọc nó để so với
 * bản của chính mình: sự cố 06/10 là web 0.0.54 chạy cùng API 0.0.52 suốt ~5 giờ mà không gì báo. Một nguồn
 * (`config/phien_ban.ts`), không chép số. Service worker KHÔNG giữ tệp này (globIgnores) — nó phải luôn là bản ở biên.
 */
const tepPhienBan = (): Plugin => ({
  name: 'tep-phien-ban',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'phien-ban.json', source: JSON.stringify({ ban: BAN_PHAT_HANH }) });
  },
});

/** Đường thật (đã đi qua junction / symlink) của một thư mục; vắng thì bỏ qua. */
function duongThat(p: string): string[] {
  try { return [fs.realpathSync(p)]; } catch { return []; }
}

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // Khoá `index` giữ tên gói người chơi là `index-*.js` như trước — bước soi deploy đọc đúng tên này.
        index: path.resolve(__dirname, 'index.html'),
        quanTri: path.resolve(__dirname, 'quan-tri.html'),
      },
      output: {
        entryFileNames: (c) => (c.name === 'quanTri' ? 'assets/qt-[name]-[hash].js' : 'assets/[name]-[hash].js'),
        chunkFileNames: (c) => (laChunkQuanTri(c.moduleIds) ? 'assets/qt-[name]-[hash].js' : 'assets/[name]-[hash].js'),
        assetFileNames: (a) => ((a.names ?? []).some((n) => n.startsWith('quanTri') || n.startsWith('qt-'))
          ? 'assets/qt-[name]-[hash][extname]' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
  plugins: [
    duongQuanTriDev(),
    tepPhienBan(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-180.png', 'icons/favicon-64.png'],
      manifest: {
        name: 'Dự báo — DELPHI',
        short_name: 'Dự báo',
        description:
          'Game đọc thị trường cho người Việt — token ảo, không có giá trị thật.',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',

        // 13/09 — founder chốt DỌC cho cả app, kể cả trong trận (soi game thẻ bài dọc:

        // Snap, Pokémon Pocket, Super Auto Pets). Android cài app thì khoá xoay theo

        // trường này; iOS BỎ QUA nó (không khoá được) — bố cục dọc vẫn là nguồn duy nhất.

        orientation: 'portrait',
        theme_color: '#04070d',
        background_color: '#04070d',
        // Icon sinh từ src/assets/mascot.json — `npm run icons` (scripts/gen-icons.mjs)
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        // Đường KHÔNG được rơi vào SPA fallback (service worker phải để ra mạng):
        //   /api      — mọi lời gọi API
        //   /admin    — trang công cụ admin do SERVER render (Hono + requireAdmin).
        //               Thiếu dòng này: SW trả index.html từ cache → React Router
        //               không có route /admin → hiện "không tồn tại", request KHÔNG
        //               BAO GIỜ ra tới mạng. Bug thật 19/07 — curl không bắt được
        //               vì curl không chạy service worker, chỉ trình duyệt mới lòi.
        //   /quan-tri — app quản trị RIÊNG (D335): tệp `quan-tri.html` ở biên, không phải một route SPA.
        navigateFallbackDenylist: [/^\/api\//, /^\/admin/, /^\/quan-tri/],
        // Gói quản trị không bao giờ vào bộ nhớ đệm của app người chơi.
        globIgnores: ['**/quan-tri.html', '**/assets/qt-*', '**/phien-ban.json'],
        // KHÔNG khai runtimeCaching cho /api — mọi request API đi thẳng mạng.
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@config': path.resolve(__dirname, '../config'),
      /*
       * @server — CHỈ cho các module THUẦN của lõi trận (`server/holdem/nav.ts`
       * hiện là module duy nhất dùng tới). Nó không import pg, không import
       * engine, chỉ đọc `config/` ⇒ gói vào bundle trình duyệt được.
       *
       * ⚠ Vì sao không chép phép tính sang client: xem trước lệnh phải ra ĐÚNG
       * con số server sẽ tính. Hai bản cài đặt cho cùng một công thức thì bản
       * client sẽ trôi (D61), và biểu hiện của cú trôi là "màn hình báo phí 140,
       * bị trừ 190" — sai IM LẶNG, đúng loại tệ nhất. C4 vẫn nguyên: server vẫn
       * là nơi DUY NHẤT áp lệnh; client chỉ chạy hàm đó để HIỂN THỊ.
       */
      '@server': path.resolve(__dirname, '../server'),
    },
  },
  server: {
    /*
     * D443 — worktree của repo dùng node_modules JUNCTION (sang worktree khác / bản checkout chính). Vite theo ĐƯỜNG THẬT
     * của tệp, nên thư mục đích nằm ngoài gốc dự án ⇒ `fs.allow` chặn tệp font Handjet (403) ⇒ trình duyệt vẽ chữ bằng
     * font hệ điều hành (Consolas) trên máy dev và khung Browser của Claude. Đúng ảnh founder gửi 28/09 (*"phải đồng bộ
     * font chữ đi chứ bro"*): chữ Consolas rộng đứng cạnh art pixel và số vẽ bằng lưới. Bản build prod không dính (tệp
     * font được chép vào `dist/`). Thêm ĐƯỜNG THẬT của hai thư mục node_modules vào danh sách cho phép.
     */
    fs: {
      allow: [
        path.resolve(__dirname, '..'),
        ...duongThat(path.resolve(__dirname, 'node_modules')),
        ...duongThat(path.resolve(__dirname, '../node_modules')),
      ],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    // D416 — hạn mỗi bài 15 s (mặc định 5 s): `findBy` nay chờ tới 3 s (tests/setup.ts), một bài dựng cả cây route
    // có hai–ba lần chờ nối nhau thì 5 s là trần GIẢ — đỏ "Test timed out" giấu mất câu chẩn đoán của chính bài.
    testTimeout: 15_000,
    css: false,
    // Sổ cách ly dùng chung với gốc (`tests/_cach_ly.json`, khoá `web`) + CI retry 1 — xem vitest.config.ts gốc (D535 B4).
    exclude: ['**/node_modules/**', ...(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../tests/_cach_ly.json'), 'utf8')) as
      { web: { tep: string }[] }).web.map((c) => c.tep.replace(/^web\//, ''))],
    retry: process.env.CI ? 1 : 0,
  },
});
