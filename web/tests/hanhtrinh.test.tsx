/**
 * TRANG HÀNH TRÌNH MÙA (founder 01/08 — "1 trang riêng như TFT/LOL").
 * Render qua ROUTE THẬT (bẫy "component đẹp nhưng không ai render" — lần 14
 * vừa bắt được ở /avatar/dan): track đủ mốc, việc n/m, điểm danh gọi server.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

const LO_TRINH = {
  mua_mo: true, tuan: 2, so_tuan: 12, chang: 3, so_chang: 30, quest_points: 145,
  da_diem_danh_hom_nay: false,
  viec: [
    { nv_id: 'nv1', ten: 'Điểm danh 3 ngày', muc: 3, da: 2, xong: false },
    { nv_id: 'nv2', ten: 'Chơi 2 trận Đấu trường', muc: 2, da: 2, xong: true },
  ],
  moc: [
    { chang_no: 1, q: 40, nhan: null, doc_ban: false, da_nhan: true, cho_art: false },
    { chang_no: 2, q: 40, nhan: null, doc_ban: false, da_nhan: true, cho_art: false },
    { chang_no: 3, q: 0, nhan: 'Áo Trùm Đầu', doc_ban: true, da_nhan: true, cho_art: false },
    { chang_no: 4, q: 40, nhan: null, doc_ban: false, da_nhan: false, cho_art: false },
  ],
};

describe('trang /hanh-trinh qua route thật', () => {
  it('track đủ mốc + việc n/m + Q + cosmetic có tên; điểm danh GỌI SERVER', async () => {
    const calls = stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/me/nhiem-vu/diem-danh',
        { status: 200, body: { ...LO_TRINH, da_diem_danh_hom_nay: true } }],
      ['/me/nhiem-vu', { status: 200, body: LO_TRINH }],
    ]);
    renderAt('/hanh-trinh');
    await screen.findByText('HÀNH TRÌNH MÙA 0.0', { exact: false });
    expect(screen.getByText('CHẶNG 3/30')).toBeInTheDocument();
    expect(screen.getByText('Áo Trùm Đầu')).toBeInTheDocument();
    expect(screen.getByText('ĐỘC BẢN')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();
    expect(screen.getByText('2/2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('ĐIỂM DANH'));
    await screen.findByText('ĐÃ ĐIỂM DANH HÔM NAY');
    expect(calls.some((c) => c.url.includes('/me/nhiem-vu/diem-danh')
      && c.method === 'POST')).toBe(true);
  });

  it('mùa chưa mở → nói thẳng, không màn trắng', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/me/nhiem-vu', { status: 200, body: { ...LO_TRINH, mua_mo: false } }],
    ]);
    renderAt('/hanh-trinh');
    await screen.findByText('Mùa chưa mở', { exact: false });
  });
});
