/**
 * XƯỞNG DÁN (work-order 04) — render qua ROUTE THẬT /ho-so. Ba khoá:
 * bộ sưu tập đọc đồ THẬT (hết placeholder nói dối), hộp xác nhận D36 đứng
 * chắn trước POST, và cú dán mang đủ đo-ngần-ngại (x/y/xac_nhan/so_lan_doi_cho).
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

const AVATAR_ME = {
  dien_mao: ME_ONBOARDED.user!.dien_mao,
  dang_mac: '1',
  bo_suu_tap: [
    { avatar_id: '1', nen: 'av_doi_mu', seri: 1, khung_id: null,
      chuoi: ME_ONBOARDED.user!.dien_mao, an: false, so_dan: 0 },
    { avatar_id: '2', nen: 'av_bui_toc', seri: 1, khung_id: null,
      chuoi: ME_ONBOARDED.user!.dien_mao, an: false, so_dan: 2 },
  ],
  kho: [{ sticker_id: 'pk_kinh_neon', so_luong: 3 }],
  khung_so_huu: [],
};
const CATALOG = {
  mon: [{ id: 'pk_kinh_neon', ten: 'Kính neon', hiem: 'hiem' }],
  dan_toi_da: 6,
};

function moHoSo() {
  return stubFetch([
    ['/auth/me', { status: 200, body: ME_ONBOARDED }],
    ['/avatar/me', { status: 200, body: AVATAR_ME }],
    ['/avatar/catalog', { status: 200, body: CATALOG }],
    ['/avatar/dan', {
      status: 200, body: { ok: true, chuoi: AVATAR_ME.dien_mao, con_lai: 2 },
    }],
  ]);
}

describe('bộ sưu tập + xưởng dán qua /ho-so', () => {
  it('bộ sưu tập hiện đồ THẬT: nền, số nhãn, nút MẶC cho tấm chưa mặc', async () => {
    moHoSo();
    renderAt('/ho-so');
    await screen.findByText('Nền #1 · 0/6 nhãn', { exact: false });
    expect(screen.getByText('ĐANG MẶC', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('MẶC')).toBeInTheDocument();
    expect(screen.getByText('Kho nhãn', { exact: false })).toBeInTheDocument();
  });

  it('dán trọn luồng: chọn ô + chọn nhãn + hộp xác nhận D36 → POST đúng body', async () => {
    const calls = moHoSo();
    renderAt('/ho-so');
    await screen.findByText('Nền #1 · 0/6 nhãn', { exact: false });

    fireEvent.click(screen.getAllByText('DÁN NHÃN')[0]!);
    await screen.findByText('XƯỞNG DÁN', { exact: false });

    // Chọn vị trí: bấm giữa khung 128px ⇒ ô (16,16); bấm lần hai = DỜI chỗ.
    const khung = screen.getByLabelText('Chọn vị trí dán trên khung');
    Object.defineProperty(khung, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 128, height: 128 }),
    });
    fireEvent.click(khung, { clientX: 64, clientY: 64 });
    fireEvent.click(khung, { clientX: 20, clientY: 100 });
    fireEvent.click(screen.getByText('Kính neon ×3'));

    // Nút DÁN mở HỘP XÁC NHẬN — chưa có request nào được phép đi.
    const xuong = screen.getByRole('dialog', { name: 'Xưởng dán nhãn' });
    fireEvent.click(within(xuong).getByRole('button', { name: 'DÁN NHÃN' }));
    await screen.findByText('DÁN LÀ VĨNH VIỄN.', { exact: false });
    expect(calls.some((c) => c.url.includes('/avatar/dan'))).toBe(false);

    fireEvent.click(screen.getByText('DÁN — TÔI HIỂU LÀ VĨNH VIỄN'));
    await screen.findByText('Nền #1 · 0/6 nhãn', { exact: false });
    const cu = calls.find((c) => c.url.includes('/avatar/dan'));
    expect(cu).toBeDefined();
    const body = cu!.body as Record<string, unknown>;
    expect(body.xac_nhan).toBe(true);
    expect(body.sticker_id).toBe('pk_kinh_neon');
    expect(body.x).toBe(5);            // 20×32/128
    expect(body.y).toBe(25);           // 100×32/128
    expect(body.so_lan_doi_cho).toBe(1); // cú đặt đầu không tính, cú dời tính 1
    expect(typeof body.ms_can_nhac).toBe('number');
  });

  it('"Nghĩ lại" đóng hộp mà KHÔNG gửi gì — vĩnh viễn phải thoát được', async () => {
    const calls = moHoSo();
    renderAt('/ho-so');
    await screen.findByText('Nền #1 · 0/6 nhãn', { exact: false });
    fireEvent.click(screen.getAllByText('DÁN NHÃN')[0]!);
    const khung = await screen.findByLabelText('Chọn vị trí dán trên khung');
    Object.defineProperty(khung, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 128, height: 128 }),
    });
    fireEvent.click(khung, { clientX: 10, clientY: 10 });
    fireEvent.click(screen.getByText('Kính neon ×3'));
    const xuong = screen.getByRole('dialog', { name: 'Xưởng dán nhãn' });
    fireEvent.click(within(xuong).getByRole('button', { name: 'DÁN NHÃN' }));
    fireEvent.click(await screen.findByText('Nghĩ lại'));
    expect(calls.some((c) => c.url.includes('/avatar/dan'))).toBe(false);
  });
});
