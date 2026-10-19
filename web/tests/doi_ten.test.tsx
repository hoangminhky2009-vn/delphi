/**
 * ĐỔI TÊN Ở HỒ SƠ (founder 04/08).
 *
 * ⚠ Bài canh chính: cái TÊN phải là NÚT. Người vào từ cửa KHÁCH mang tên máy
 * (`khach_p83m0c21`), và nếu đường đổi tên nằm sau ba lần bấm thì gần như không
 * ai tìm ra — tức tính năng có mà như không.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
import { renderAt, stubFetch, ME_ONBOARDED } from './helpers';
import type { MeResponse } from '@/api/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ME_KHACH: MeResponse = {
  ...ME_ONBOARDED,
  user: { ...ME_ONBOARDED.user!, handle: 'khach_p83m0c21' },
};

/*
 * ⚠ CHỈ stub `/auth/me`. Mọi truy vấn phụ của Hồ sơ (thống kê · kết quả · bậc ·
 * bộ sưu tập) tự ẩn khi hỏng — chính docstring của màn khai vậy. Stub chúng bằng
 * thân giả thì màn nhận đúng thứ nó không mong đợi và chết trong lúc render, tức
 * bài test đo một màn KHÁC với màn người chơi thấy.
 */
const BANG = (extra: [string, { status: number; body: unknown }][] = []) =>
  [...extra, ['/auth/me', { status: 200, body: ME_KHACH }]] as
    [string, { status: number; body: unknown }][];

async function moODoiTen() {
  renderAt('/ho-so');
  // Regex: JSX `@{handle}` đẻ HAI text node nên so khớp nguyên chuỗi trượt.
  const nut = await screen.findByText(/khach_p83m0c21/, {}, { timeout: 4000 });
  fireEvent.click(nut);
  return screen.findByLabelText('Tên hiển thị mới');
}

describe('Đổi tên ở Hồ sơ', () => {
  it('⭐ chính cái tên là NÚT — bấm vào là mở ô sửa', async () => {
    stubFetch(BANG());
    expect(await moODoiTen()).toBeTruthy();
  });

  it('gửi tên đã chuẩn hoá về thường, không ký tự lạ', async () => {
    const calls = stubFetch(BANG([['/me/handle', { status: 200, body: { ok: true, handle: 'minh99' } }]]));
    const o = await moODoiTen();
    // Gõ cả hoa lẫn ký tự cấm — ô phải tự lọc, không để người ta gõ hai lần.
    fireEvent.change(o, { target: { value: 'Minh-99!' } });
    expect((o as HTMLInputElement).value).toBe('minh99');

    fireEvent.click(screen.getByText('LƯU'));
    await waitFor(() => {
      const g = calls.find((c) => c.url.includes('/me/handle'));
      expect(g?.body).toEqual({ handle: 'minh99' });
    });
  });

  it('tên chưa đủ 3 ký tự → nút LƯU khoá', async () => {
    stubFetch(BANG());
    const o = await moODoiTen();
    fireEvent.change(o, { target: { value: 'ab' } });
    expect((screen.getByText('LƯU') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(o, { target: { value: 'abc' } });
    expect((screen.getByText('LƯU') as HTMLButtonElement).disabled).toBe(false);
  });

  /*
   * ⚠ Tên trùng là lỗi THƯỜNG GẶP nhất của cửa này, và nó phải hiện NGAY TẠI Ô.
   * Nuốt lỗi thì người dùng bấm LƯU, không thấy gì đổi, và kết luận app hỏng.
   */
  it('tên đã có người dùng → hiện lỗi tại chỗ, ô vẫn mở', async () => {
    stubFetch(BANG([['/me/handle', {
      status: 409, body: { error: 'handle_taken', message: 'Tên này có người dùng rồi.' },
    }]]));
    const o = await moODoiTen();
    fireEvent.change(o, { target: { value: 'judy' } });
    fireEvent.click(screen.getByText('LƯU'));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/có người dùng rồi/)).toBeTruthy();
    expect(screen.getByLabelText('Tên hiển thị mới')).toBeTruthy();
  });

  it('HUỶ đóng ô, không gửi gì', async () => {
    const calls = stubFetch(BANG());
    await moODoiTen();
    fireEvent.click(screen.getByText('HUỶ'));
    await waitFor(() => expect(screen.queryByLabelText('Tên hiển thị mới')).toBeNull());
    expect(calls.some((c) => c.url.includes('/me/handle'))).toBe(false);
  });
});
