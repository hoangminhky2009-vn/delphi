/**
 * MÀN HÀNG CHỜ (D207) — phía người chơi.
 *
 * Ba tính chất khoá ở đây, và cả ba đều là kiểu "xanh mà hỏng" nếu không có
 * test:
 *   1. không xếp hàng ⇒ KHÔNG vẽ gì. Một overlay `position: fixed` render nhầm
 *      là che trắng cả app mà không báo lỗi gì.
 *   2. đang xếp hàng ⇒ CÓ SỐ THỨ TỰ trên màn. Hàng chờ không cho biết mình
 *      đứng thứ mấy thì người ta bấm F5 — đúng thứ cổng sinh ra để chặn.
 *   3. 503 `hang_cho` từ `api()` phải CHẢY TỚI được màn. Đây là mối nối giữa
 *      `api/client.ts` và `api/cong.ts`; đứt mối này thì cổng vẫn chặn đúng ở
 *      biên, còn người dùng chỉ thấy một lỗi vô nghĩa.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { HangCho } from '@/components/HangCho';
import { baoHangCho, dungHoiCong } from '@/api/cong';
import { api } from '@/api/client';

afterEach(() => {
  dungHoiCong();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('màn hàng chờ', () => {
  it('không xếp hàng ⇒ không vẽ gì', () => {
    const { container } = render(<HangCho />);
    expect(container).toBeEmptyDOMElement();
  });

  it('đang xếp hàng ⇒ hiện SỐ THỨ TỰ và sức chứa', () => {
    render(<HangCho />);
    act(() => {
      baoHangCho({ hang_cho: { vi_tri: 42, tong: 137, dang_trong: 150, tran: 150 } });
    });
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText(/137 người đang chờ/)).toBeTruthy();
    expect(screen.getByText(/ĐANG CHƠI/)).toBeTruthy();
  });

  it('thiếu sức chứa thì vẫn hiện số thứ tự, không vẽ dòng rỗng', () => {
    render(<HangCho />);
    act(() => {
      baoHangCho({ hang_cho: { vi_tri: 7, tong: 9 } });
    });
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.queryByText(/ĐANG CHƠI/)).toBeNull();
  });
});

describe('mối nối api() → màn hàng chờ', () => {
  it('503 hang_cho từ máy chủ ⇒ màn xếp hàng dựng lên', async () => {
    // Hẹn giả để vòng tự-hỏi-lại không bắn request thật trong test.
    vi.useFakeTimers();
    vi.stubGlobal('fetch', async () => new Response(
      JSON.stringify({
        error: 'hang_cho',
        message: 'Đang đông người.',
        hang_cho: { vi_tri: 3, tong: 3, dang_trong: 150, tran: 150 },
      }),
      { status: 503, headers: { 'content-type': 'application/json', 'Retry-After': '5' } },
    ));

    render(<HangCho />);
    // `api()` vẫn NÉM như mọi lỗi khác — màn đang mở không phải học thêm một
    // hình dạng lỗi thứ hai; nó chỉ đồng thời báo cho `cong.ts`.
    await act(async () => {
      await api('/auth/me').catch(() => null);
    });

    expect(screen.getByText('3')).toBeTruthy();
  });
});
