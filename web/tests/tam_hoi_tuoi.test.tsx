/**
 * B5 (SPEC va-bao-mat-chuan-hoa-api-dot-1, C8) — TẤM HỎI NĂM SINH: cổng, không phải câu hỏi.
 *
 * Khác bậc 1 (`bac1.test.tsx` canh "KHÔNG chặn ai"): máy chủ đóng mọi cửa nghiệp vụ tới khi `POST /me/tuoi` nhận năm đủ tuổi, nên
 * tấm này KHÔNG có nút bỏ qua — có nút mà bấm xong vẫn 403 khắp nơi là nói dối người dùng. Canh: hiện theo cờ MÁY CHỦ
 * (`can_xac_nhan_tuoi`), vắng cờ (máy chủ cũ) thì không hiện · gửi năm rồi đóng · dưới tuổi thì hiện câu của máy chủ, tấm còn đó ·
 * che tấm bậc 1 (một hộp một lúc).
 *
 * Tiêm ngược: bỏ dòng `{canTuoi && <TamHoiTuoi />}` ⇒ ca hiện đỏ · bỏ `!canTuoi` ở bậc 1 ⇒ ca "một hộp" đỏ.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
import { renderAt, stubFetch, ME_ONBOARDED } from './helpers';
import type { MeResponse } from '@/api/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ME_KHACH: MeResponse = {
  ...ME_ONBOARDED,
  can_xac_nhan_tuoi: true,
  user: { ...ME_ONBOARDED.user!, age_band: null as any, la_khach: true },
};

const BANG = (me: MeResponse, tuoi: { status: number; body: unknown } = { status: 200, body: { ok: true } }):
  [string, { status: number; body: unknown }][] => [
  ['/me/tuoi', tuoi],
  ['/auth/me', { status: 200, body: me }],
  ['/holdem/', { status: 200, body: {} }],
  ['/markets', { status: 200, body: { markets: [] } }],
];

describe('B5 — tấm hỏi năm sinh', () => {
  it('⭐ máy chủ báo chưa xác nhận tuổi ⇒ hiện tấm, KHÔNG có nút bỏ qua', async () => {
    stubFetch(BANG(ME_KHACH));
    renderAt('/');
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('BẠN SINH NĂM NÀO?')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /BỎ QUA/ })).toBeNull();
  });

  it('vắng cờ (máy chủ cũ) ⇒ không hiện', async () => {
    const { can_xac_nhan_tuoi: _, ...cu } = ME_KHACH;
    stubFetch(BANG(cu as MeResponse));
    renderAt('/');
    await screen.findByText(/không có giá trị thật/);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('⭐ gõ năm ⇒ POST /me/tuoi đúng năm; máy chủ thôi báo ⇒ tấm đóng', async () => {
    stubFetch(BANG(ME_KHACH));
    renderAt('/');
    await screen.findByRole('dialog');
    const nut = screen.getByRole('button', { name: /XÁC NHẬN/ }) as HTMLButtonElement;
    expect(nut.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('2009'), { target: { value: '2006' } });
    // Sau cú gửi, `/auth/me` trả bản đã xác nhận (làm mới mọi truy vấn).
    const calls = stubFetch(BANG({ ...ME_KHACH, can_xac_nhan_tuoi: false }));
    fireEvent.click(nut);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const g = calls.find((c) => c.url.includes('/me/tuoi'));
    expect(g?.method).toBe('POST');
    expect(g?.body).toEqual({ birth_year: 2006 });
  });

  it('dưới tuổi ⇒ câu của máy chủ hiện dưới ô, tấm vẫn còn', async () => {
    stubFetch(BANG(ME_KHACH, { status: 403, body: { error: 'duoi_tuoi', message: 'Ứng dụng dành cho người từ 16 tuổi.' } }));
    renderAt('/');
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByPlaceholderText('2009'), { target: { value: '2015' } });
    fireEvent.click(screen.getByRole('button', { name: /XÁC NHẬN/ }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('16 tuổi'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('một hộp một lúc: đang hỏi tuổi thì tấm nhân khẩu bậc 1 không chồng lên', async () => {
    stubFetch(BANG({ ...ME_KHACH, hoi_nhan_khau: true }));
    renderAt('/');
    await screen.findByText('BẠN SINH NĂM NÀO?');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.queryByText('BA CÂU, RỒI THÔI')).toBeNull();
  });
});
