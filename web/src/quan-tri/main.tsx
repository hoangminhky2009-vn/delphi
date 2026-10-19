/**
 * CỬA VÀO APP QUẢN TRỊ RIÊNG (D335) — `web/quan-tri.html` ⇒ tệp này.
 *
 * ⚠ KHÔNG đăng ký service worker, KHÔNG bật telemetry, KHÔNG bắt tay Discord: đây không phải app người chơi, và
 *   hành vi của người quản trị đi vào số đo người chơi là đúng thứ D212 dựng ra để chặn.
 * ⚠ Router chỉ để đọc/ghi query (`useSearchParams`) — mọi đường đều vẽ cùng một app; khu/người/tab là tham số.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import '@fontsource-variable/handjet/full.css';
import '../styles/tokens.css';
import './goc.css';
import { makeQueryClient } from '@/api/queries';
import { QuanTriApp } from './App';

class RanhGioi extends React.Component<{ children: React.ReactNode }, { loi: Error | null }> {
  state = { loi: null as Error | null };
  static getDerivedStateFromError(loi: Error) { return { loi }; }
  render() {
    if (this.state.loi) {
      return (
        <p style={{ color: '#f87171', padding: 24, fontFamily: 'ui-monospace, monospace' }}>
          Trang quản trị gặp lỗi: {this.state.loi.message}. Tải lại trang; nếu vẫn lỗi, các thao tác chuyển token vẫn làm
          được ở <a style={{ color: '#22d3ee' }} href="/admin">/admin</a>.
        </p>
      );
    }
    return this.props.children;
  }
}

const router = createBrowserRouter([{ path: '*', element: <QuanTriApp /> }]);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RanhGioi>
      <QueryClientProvider client={makeQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </RanhGioi>
  </React.StrictMode>,
);
