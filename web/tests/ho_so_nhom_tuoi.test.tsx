/**
 * D396 — MÀN HỒ SƠ CHỌN SẴN NHÓM TUỔI ĐÃ SUY TỪ NĂM SINH.
 *
 * Tuổi tính theo NĂM (`server/auth/age.ts`): sinh cuối 2008 là 17 tuổi thật nhưng "18–22" theo năm. Màn hồ sơ
 * từng bắt chọn lại nhóm tuổi rồi để server từ chối nếu lệch (`age_band_mismatch`) — học sinh bấm đúng tuổi
 * thật của mình và bị báo "không khớp năm sinh" ngay màn đầu của buổi đo. Nay `/auth/me` chở `nhom_tuoi_khai`
 * và màn hồ sơ chỉ bày đúng nhóm ấy, đã chọn sẵn. Tài khoản không có nhóm khai (cũ) ⇒ chọn tay như trước.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { routes } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import { NEN_TANG } from '@config/avatar';

const CHO = { timeout: 8000 } as const;
vi.setConfig({ testTimeout: 20_000 });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function dungHoSo(me: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, ...(init !== undefined ? { init } : {}) });
    if (url.includes('/auth/me')) return json(200, me);
    if (url.includes('/onboarding')) return json(201, { ok: true, user_id: 'u1', bankroll: 1000 });
    return json(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
  }));
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/onboard/ho-so'] })} />
    </QueryClientProvider>,
  );
  return calls;
}

const ME = { email: 'a@b.vn', email_verified: false, onboarded: false, user: null };

afterEach(() => { vi.unstubAllGlobals(); });

describe('D396 — nhóm tuổi chọn sẵn theo năm sinh đã khai', () => {
  it('⭐⭐ có nhóm khai ⇒ chỉ bày đúng nhóm ấy, đã chọn; gửi hồ sơ mà không chạm hàng tuổi vẫn đúng nhóm', async () => {
    const calls = dungHoSo({ ...ME, nhom_tuoi_khai: '18-22' });
    fireEvent.change(await screen.findByLabelText('Tên hiển thị (handle)', {}, CHO), { target: { value: 'hs_lop_10' } });
    const hang = screen.getByRole('group', { name: 'Nhóm tuổi' });
    const chip = await waitFor(() => {
      const c = hang.querySelector('button[aria-pressed="true"]');
      expect(c).not.toBeNull();
      return c!;
    }, CHO);
    expect(chip.textContent).toBe('18–22');
    expect(hang.querySelectorAll('button')).toHaveLength(1);
    expect(screen.getByText('Theo năm sinh bạn đã khai lúc đăng ký.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Miền Nam'));
    fireEvent.click(screen.getByText('Học sinh · SV'));
    fireEvent.click(screen.getByText(NEN_TANG[0]!.ten));
    fireEvent.click(screen.getByText('▶ NHẬN 1.000 T VỐN KHỞI ĐIỂM'));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/onboarding'))).toBe(true), CHO);
    const body = JSON.parse(String(calls.find((c) => c.url.includes('/onboarding'))!.init?.body));
    expect(body.age_band).toBe('18-22');
  });

  it('không có nhóm khai (tài khoản cũ / máy chủ cũ) ⇒ đủ năm nhóm để chọn tay, không dòng giải thích', async () => {
    dungHoSo(ME);
    await screen.findByLabelText('Tên hiển thị (handle)', {}, CHO);
    const hang = screen.getByRole('group', { name: 'Nhóm tuổi' });
    expect(hang.querySelectorAll('button')).toHaveLength(5);
    expect(hang.querySelector('button[aria-pressed="true"]')).toBeNull();
    expect(screen.queryByText('Theo năm sinh bạn đã khai lúc đăng ký.')).toBeNull();
  });
});
