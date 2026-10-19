/**
 * DỰNG APP — phần dùng CHUNG cho app thật (`main.tsx`) và bản demo "khách nâng cao" (`demo/main.tsx`).
 *
 * Tách ra (28/09, link demo cho pitch deck) để bản demo KHÔNG chép lại danh sách font/CSS và cây provider: chép là có bản
 * thứ hai, và bản thứ hai sẽ trôi (A11.5) — thêm một tệp CSS ở app thật mà quên bên demo thì demo vỡ giao diện im lặng.
 * Service worker và bắt tay Discord KHÔNG ở đây: chúng là việc riêng của điểm vào thật (demo không cài, không Discord).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { RanhGioiLoi } from '@/components/ui/ManLoi';

// Font self-host qua npm (không gọi Google Fonts — PWA offline + không rò traffic bên thứ ba)
//
// D182 — MỘT FONT DUY NHẤT CHO CẢ APP: Handjet (font PIXEL, biến, OFL).
// Trước đợt này app chạy JetBrains Mono + Space Grotesk, cả hai là font VECTOR, nên
// 99% chữ trên màn là vector đặt cạnh art pixel — đúng cái founder gọi là "thập cẩm"
// (đo được: 458 chuỗi trong màn trận, ChuPixel chỉ vẽ trọn 5).
//
// ⚠ VÌ SAO HANDJET chứ không phải font pixel khác: nó là MỘT TRONG HAI font pixel
// duy nhất trên Google Fonts có ĐỦ DẤU TIẾNG VIỆT (đo: 98/98 ký tự thử, 0 ký tự tụt
// về font dự phòng). Font pixel thiếu dấu sẽ rơi về font vector GIỮA CÂU — tức làm
// "thập cẩm" nặng hơn chứ không nhẹ đi.
//
// ⚠ Bản BIẾN (`-variable`) chứ không phải 9 file nét tĩnh: một file cho cả dải
// 100–900 CỘNG hai trục hình dạng ELGR/ELSH (xem tokens.css). Đo: 33 KB cho trọn bộ,
// so với 63,5 KB của ba nét JetBrains chỉ riêng latin.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/jetbrains-mono/800.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
/*
 * ⚠ Handjet VẪN NẠP — nhưng chỉ cho `--font-hienthi` (chữ TO). Xem tokens.css.
 */
import '@fontsource-variable/handjet/full.css';

import '../styles/tokens.css';
/*
 * ⚠ Bảng màu riêng của khu PFM — CHÉP NGUYÊN từ demo đã chốt (A11.25). Nạp SAU
 * `tokens.css` vì nó chỉ THÊM biến (`--n-*`, `--c-*`, `--mat-phim`…), không đè biến nào
 * của app; hai bảng cố ý không trộn.
 */
import '../styles/pfm_token.css';
import '../styles/motion.css';
import '../styles/base.css';

import { routes } from './routes';
import { makeQueryClient } from '@/api/queries';
import { capNhipVaoCss } from '@/lib/nhip';

/*
 * Dải nhỏ của bản demo — người xem biết mình đang ở bàn chơi thử, và nó không lưu gì. CHỈ hiện ở màn có thanh điều hướng
 * đáy (`BottomNav`: 66 px + vùng an toàn), đứng ngay TRÊN thanh. Đo 28/09 trên link thật: nằm sát đáy thì nó che chữ
 * HUB · TOKEN · MAP; ở màn toàn cảnh (trận · SHOP · chợ trait/lõi) thì đáy màn là hàng nút — dải đè lên "ĐỔI TRAIT",
 * "ĐỔI LÕI", nút ngân hàng và CHỐT VÒNG. Sảnh + màn chờ đã nói "không lưu dữ liệu" trước khi vào những màn ấy.
 */
const CSS_BANG_DEMO = `
.bang-demo { display: none; position: fixed; left: 8px; bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  z-index: 9999; padding: 3px 8px; background: rgba(4, 7, 13, 0.82); border: 1px solid rgba(251, 191, 36, 0.55);
  color: #fbbf24; font: 700 10px/1.4 system-ui, sans-serif; letter-spacing: 0.08em; pointer-events: none; }
body:has(nav[aria-label="Menu chính"]) .bang-demo { display: block; }
`;
function BangDemo(): React.ReactElement {
  return (
    <>
      <style>{CSS_BANG_DEMO}</style>
      <div role="note" className="bang-demo">BẢN TRẢI NGHIỆM · KHÔNG LƯU DỮ LIỆU</div>
    </>
  );
}

export function veApp(goc: HTMLElement, tuy: { bangDemo?: boolean } = {}): void {
  // Bơm nhịp trình diễn vào CSS (biến --nhip-*) TRƯỚC khi render, để keyframes dùng chung đọc được thời lượng từ một
  // nguồn TS duy nhất. Xem lib/nhip.ts.
  capNhipVaoCss();
  const router = createBrowserRouter(routes);
  const queryClient = makeQueryClient();
  createRoot(goc).render(
    <React.StrictMode>
      {/*
        Ranh giới NGOÀI router: `errorElement` chỉ bắt lỗi trong cây route, không bắt được lỗi từ chính lúc router/provider
        dựng — mà hỏng ở đó là hỏng cả app. Hai lớp, không thừa lớp nào.
      */}
      <RanhGioiLoi>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </RanhGioiLoi>
      {tuy.bangDemo && <BangDemo />}
    </React.StrictMode>,
  );
}
