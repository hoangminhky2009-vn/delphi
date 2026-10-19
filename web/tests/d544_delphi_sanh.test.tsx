/**
 * D544 — Delphi ở SẢNH sau bàn tập chỉ cách vào + dùng Bách khoa (founder 06/10; trước đó *"delphi kết thúc màn hướng dẫn bảo đợi ở sảnh nhưng
 * bấm về sảnh thì ko thấy đâu"*). Một lần, chỉ khi vừa XONG bàn tập (không phải bỏ qua), nhớ ở máy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/components/AuthGate', () => ({ AuthGate: ({ children }: { children: React.ReactNode }) => children }));
vi.setConfig({ testTimeout: 20_000 });

async function veSanh() {
  const { AlphaDraftLobby } = await import('@/screens/holdem/AlphaDraftLobby');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/arena']}>
        <Routes>
          <Route path="/arena" element={<AlphaDraftLobby />} />
          <Route path="/bach-khoa" element={<p>TRANG BÁCH KHOA</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { window.localStorage.clear(); });

describe('D544 — Delphi chỉ Bách khoa ở sảnh', () => {
  it('⭐ vừa XONG bàn tập ⇒ Delphi đứng ra chỉ Bách khoa (ô tìm · CÁCH MẤT TIỀN), nút sách sáng; MỞ BÁCH KHOA ⇒ tới /bach-khoa và không chỉ lại', async () => {
    window.localStorage.setItem('delphi:man-tap:da-qua', 'xong');
    const r = await veSanh();
    const the = await screen.findByTestId('delphi-chi-bach-khoa');
    expect(the.textContent).toMatch(/BÁCH KHOA/);
    expect(the.textContent).toMatch(/CÁCH MẤT TIỀN/);
    expect(screen.getByTestId('nut-bach-khoa').className).toMatch(/nutSachChi/);
    fireEvent.click(screen.getByTestId('delphi-mo-bach-khoa'));
    expect(await screen.findByText('TRANG BÁCH KHOA')).toBeTruthy();
    r.unmount();
    await veSanh();
    await screen.findByTestId('nut-bach-khoa');
    expect(screen.queryByTestId('delphi-chi-bach-khoa')).toBeNull();
  });
  it('ĐỂ SAU ⇒ ẩn và không hiện lại', async () => {
    window.localStorage.setItem('delphi:man-tap:da-qua', 'xong');
    const r = await veSanh();
    fireEvent.click(await screen.findByRole('button', { name: 'ĐỂ SAU' }));
    expect(screen.queryByTestId('delphi-chi-bach-khoa')).toBeNull();
    r.unmount();
    await veSanh();
    await screen.findByTestId('nut-bach-khoa');
    expect(screen.queryByTestId('delphi-chi-bach-khoa')).toBeNull();
  });
  it('vế ngược: BỎ QUA bàn tập / người chơi cũ ⇒ không chỉ', async () => {
    window.localStorage.setItem('delphi:man-tap:da-qua', 'bo_qua');
    await veSanh();
    await screen.findByTestId('nut-bach-khoa');
    expect(screen.queryByTestId('delphi-chi-bach-khoa')).toBeNull();
  });
});
