/**
 * BẢN DEMO "KHÁCH NÂNG CAO" — ĐIỂM VÀO (founder 28/09, link cho pitch deck).
 *
 * Thứ tự: màn chờ → dựng máy chủ trong trang (worker: PGlite + migration + `createApp` + khách gieo sẵn) → chặn `/api/*`
 * sang worker → kho PFM trong bộ nhớ có sổ mẫu → dựng CHÍNH app (`veApp`, chung với `main.tsx`). Không service worker
 * (bản demo không cài, không cache), không Discord, không đăng nhập.
 */
import { chanFetch } from './chan_fetch';
import { dungKhoCoSan } from '@/pfm/dung_kho';
import { khoSoMau } from './so_mau';
import { danhDauDaPhongVanChoDemo } from '@/pfm/da_phong_van';
import { duongKhiMoLai } from './duong_dan';

// Mở lại trang = máy chủ mới, DB trống ⇒ đường dẫn vào trận / bàn cũ đưa về sảnh, TRƯỚC khi app dựng router.
const duongMoi = duongKhiMoLai(location.pathname);
if (duongMoi) history.replaceState(null, '', duongMoi);

const goc = document.getElementById('root')!;
goc.innerHTML = `
  <div style="min-height:100dvh;display:grid;place-items:center;background:#04070d;color:#c9d6ff;font:600 15px/1.5 system-ui;text-align:center;padding:24px">
    <div>
      <div style="font:800 28px/1.1 system-ui;letter-spacing:.12em;color:#fbbf24">DELPHI</div>
      <div style="margin-top:10px">Đang dựng bàn chơi thử…</div>
      <div style="margin-top:6px;font-size:12px;opacity:.7">Bản trải nghiệm chạy ngay trong trình duyệt · không đăng nhập · không lưu dữ liệu</div>
    </div>
  </div>`;

const worker = new Worker(new URL('./may_chu.worker.ts', import.meta.url), { type: 'module' });
chanFetch(worker);

await new Promise<void>((ok, hong) => {
  worker.addEventListener('message', (e: MessageEvent<{ loai: string; message?: string }>) => {
    if (e.data.loai === 'san_sang') ok();
    if (e.data.loai === 'hong') hong(new Error(e.data.message));
  });
  // Worker chết trước khi kịp báo 'hong' (nạp module hỏng…) ⇒ hiện lỗi, không đứng im ở màn chờ.
  worker.addEventListener('error', (e) => hong(new Error(e.message || 'máy chủ trong trang không khởi động được')));
  worker.postMessage({ loai: 'khoi_dong' });
}).catch((e: Error) => {
  goc.innerHTML = `<div style="padding:24px;color:#fca5a5;font:14px system-ui">Không dựng được bàn chơi thử: ${e.message}</div>`;
  throw e;
});

dungKhoCoSan(await khoSoMau());
// Sổ mẫu đã trả lời phỏng vấn ⇒ khu Tài chính mở thẳng vào SỔ / HŨ / GƯƠNG, không hỏi lại tám câu.
danhDauDaPhongVanChoDemo();
const { veApp } = await import('@/app/ve_app');
veApp(goc, { bangDemo: true });
