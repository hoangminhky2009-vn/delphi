/**
 * 429 rate_limited (§5.2 chỉ đạo deploy 19/07): server đã viết sẵn câu tiếng Việt
 * — UI phải hiện NGUYÊN VĂN, không tự chế; Retry-After chỉ là thông tin thêm.
 * Hành vi đếm đổi ngày 19/07 (mỗi lần thử tiêu một suất) nên màn này dễ gặp hơn.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderAt } from './helpers';

function stub429(path: string, message: string, retryAfter: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(path)) {
        return new Response(JSON.stringify({ error: 'rate_limited', message }), {
          status: 429,
          headers: { 'content-type': 'application/json', 'Retry-After': retryAfter },
        });
      }
      return new Response(JSON.stringify({ error: 'unauthorized', message: 'Bạn cần đăng nhập.' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

describe('429 rate_limited', () => {
  it('đăng nhập: hiện đúng câu server + gợi ý thời gian từ Retry-After', async () => {
    stub429('/auth/login', 'Sai mật khẩu quá nhiều lần. Thử lại sau 15 phút.', '900');
    renderAt('/onboard');
    // Biểu mẫu nằm trong BOARD từ 07/09 — phải mở board rồi mới gõ được.
    fireEvent.click(await screen.findByText('▶ ĐĂNG KÝ / ĐĂNG NHẬP'));
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau10kytu' } });
    fireEvent.click(screen.getByText('▶ ĐĂNG NHẬP'));

    expect(await screen.findByText(/Sai mật khẩu quá nhiều lần/)).toBeInTheDocument();
    expect(screen.getByText(/Thử lại sau khoảng 15 phút/)).toBeInTheDocument();
  });

  it('đăng ký: hiện đúng câu server, không nuốt lỗi', async () => {
    stub429('/auth/register', 'Bạn đã tạo quá nhiều tài khoản. Thử lại sau 1 giờ.', '3600');
    renderAt('/onboard/dang-ky');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'moi@b.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau10kytu' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), {
      target: { value: 'matkhau10kytu' },
    });
    fireEvent.change(screen.getByLabelText('Năm sinh'), { target: { value: '2008' } });
    fireEvent.click(screen.getByText('▶ TẠO TÀI KHOẢN'));

    expect(await screen.findByText(/quá nhiều tài khoản/)).toBeInTheDocument();
    expect(screen.getByText(/Thử lại sau khoảng 60 phút/)).toBeInTheDocument();
  });
});
