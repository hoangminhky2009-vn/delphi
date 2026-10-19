/**
 * HUB KHI CHUNK NẠP TRỄ HỎNG (SPEC `ui-tang-khong-gian` 5b.2 — mất mạng giữa chừng).
 *
 * Banner bách khoa và sổ Tài chính là hai chunk NẠP TRỄ. Mạng đứt (hoặc chunk đã đổi tên sau một lần deploy) thì `import()` bị từ
 * chối. Không có biên thì lỗi đi lên `errorElement` của AppShell và CẢ HUB thành màn lỗi — chỉ vì một banner trang trí không về.
 * Bài này ép hai chunk hỏng rồi đòi: Hub VẪN SỐNG, vùng hỏng NÓI RÕ + có nút TẢI LẠI, việc chính (VÀO TRẬN) vẫn đi được.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Hub } from '@/screens/Hub';
import { makeQueryClient } from '@/api/queries';
import { CHU_HUB } from '@/lib/hub_chu';
import { ME_ONBOARDED, stubFetch } from './helpers';

/*
 * SPEC chan-truoc-beta — khu Tài chính đang KHOÁ trên web (`lib/pfm_mo.ts`). Tệp này đo khu ấy ở trạng thái MỞ — mã của trạng thái
 * mở vẫn còn nguyên cho ngày mở lại (điều kiện ở `pfm_mo.ts`), nên GHIM cờ bật thay vì bỏ bài. Trạng thái KHOÁ: `pfm_khoa_web.test.tsx`.
 */
vi.mock('@/lib/pfm_mo', () => ({ PFM_WEB_MO: true }));

// Hai chunk "không về được".
vi.mock('@/screens/hub/HubBanner', () => { throw new Error('Failed to fetch dynamically imported module'); });
vi.mock('@/screens/hub/HubTaiChinh', () => { throw new Error('Failed to fetch dynamically imported module'); });

const LT = { mua_mo: true, tuan: 3, so_tuan: 4, chang: 2, so_chang: 30, quest_points: 0, viec: [{ nv_id: 'v', ten: 'Việc', muc: 2, da: 1, xong: false }], da_diem_danh_hom_nay: false, moc: [] };
const ME = { ...ME_ONBOARDED, user: { ...ME_ONBOARDED.user!, la_khach: false } };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('chunk Hub hỏng ⇒ Hub không sập', () => {
  it('⭐⭐ banner + ô Tài chính hỏng: nói rõ KHÔNG TẢI ĐƯỢC, có TẢI LẠI; ô Mùa · VÀO TRẬN vẫn sống', async () => {
    stubFetch([['/me/nhiem-vu', { status: 200, body: LT }], ['/auth/me', { status: 200, body: ME }]]);
    const router = createMemoryRouter([
      { path: '/', element: <Hub /> },
      { path: '/arena', element: <div>MAN_ARENA</div> },
    ], { initialEntries: ['/'] });
    render(<QueryClientProvider client={makeQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);

    // vùng hỏng nói rõ (banner: có nút TẢI LẠI; ô Tài chính: "chạm để xem")
    await waitFor(() => expect(screen.getAllByText(CHU_HUB.loiTai).length).toBeGreaterThanOrEqual(2));
    expect(screen.getByText(CHU_HUB.taiLai)).toBeTruthy();
    // phần còn lại của Hub KHÔNG sập: ô Mùa đọc được số, đầu sảnh còn tên
    await waitFor(() => expect(document.querySelector('[data-o="mua"]')!.textContent).toContain('0'));
    expect(screen.getByText('tester')).toBeTruthy();
    // và việc chính đi được
    fireEvent.click(screen.getByText(CHU_HUB.vaoTran));
    await waitFor(() => expect(router.state.location.pathname).toBe('/arena'));
  });

  it('lớp trượt Tài chính khi chunk hỏng: nói rõ + TẢI LẠI, nút ĐÓNG vẫn đóng được', async () => {
    stubFetch([['/me/nhiem-vu', { status: 200, body: LT }], ['/auth/me', { status: 200, body: ME }]]);
    const router = createMemoryRouter([{ path: '/', element: <Hub /> }], { initialEntries: ['/'] });
    render(<QueryClientProvider client={makeQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
    await waitFor(() => expect(document.querySelector('[data-o="tai-chinh"]')).toBeTruthy());
    fireEvent.click(document.querySelector('[data-o="tai-chinh"]')!);
    const lop = await screen.findByRole('dialog');
    await waitFor(() => expect(lop.textContent).toContain(CHU_HUB.loiTai));
    expect(lop.textContent).toContain(CHU_HUB.taiLai);
    fireEvent.click(screen.getByText(CHU_HUB.dong));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
