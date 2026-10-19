/**
 * B4 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — Ô XOÁ TÀI KHOẢN Ở HỒ SƠ: khách/Discord gõ XOA, tài khoản có mật khẩu gõ mật khẩu.
 *
 * Phía server khoá ở `tests/xoa_tai_khoan_khach.test.ts`; bài này khoá chỗ màn GỬI đúng thứ server đòi — màn cũ chỉ
 * có ô mật khẩu nên khách đứng trước một ô không có câu trả lời, và nút bấm không bao giờ sáng đúng.
 * Tiêm ngược: bỏ nhánh `khongMatKhau` trong `DeleteAccount` ⇒ ca khách đỏ (không thấy ô XOA).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/api/queries';
import { DeleteAccount } from '@/screens/Profile';

function dung(khongMatKhau: boolean) {
  const gui: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
    gui.push(JSON.parse(String(init?.body ?? 'null')));
    return new Response('{"ok":true,"message":"đã xoá"}', { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  const onDone = vi.fn();
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <DeleteAccount onDone={onDone} khongMatKhau={khongMatKhau} />
    </QueryClientProvider>,
  );
  return { gui, onDone };
}

const nut = () => screen.getByRole('button', { name: /XÓA VĨNH VIỄN/ });

afterEach(() => { vi.unstubAllGlobals(); });

describe('B4 — DeleteAccount', () => {
  it('⭐ không mật khẩu ⇒ ô "Gõ XOA", nút chỉ sáng khi gõ đúng XOA, gửi { xac_nhan: "XOA" }', async () => {
    const { gui, onDone } = dung(true);
    expect(screen.queryByLabelText('Nhập mật khẩu để xác nhận')).toBeNull();
    const o = screen.getByLabelText('Gõ XOA để xác nhận');
    expect(nut()).toBeDisabled();
    fireEvent.change(o, { target: { value: 'xoa' } });
    expect(nut()).toBeDisabled();
    fireEvent.change(o, { target: { value: 'XOA' } });
    expect(nut()).toBeEnabled();
    fireEvent.click(nut());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(gui).toEqual([{ xac_nhan: 'XOA' }]);
  });

  it('có mật khẩu ⇒ ô mật khẩu như cũ, gửi { password }', async () => {
    const { gui, onDone } = dung(false);
    expect(screen.queryByLabelText('Gõ XOA để xác nhận')).toBeNull();
    fireEvent.change(screen.getByLabelText('Nhập mật khẩu để xác nhận'), { target: { value: 'mk-cua-toi-1' } });
    fireEvent.click(nut());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(gui).toEqual([{ password: 'mk-cua-toi-1' }]);
  });
});
