/**
 * RUNG — bài test khoá đúng thứ sẽ hỏng trên máy thật chứ không trên máy tôi.
 *
 * `navigator.vibrate` vắng mặt trên TOÀN BỘ iOS. Nên bài quan trọng nhất ở đây
 * không phải "có rung không" mà là **"vắng nó thì có nổ không"** — một cú ném
 * chưa bắt trong onClick sẽ giết luôn cả cú bấm, tức nút mốc thành nút chết
 * trên một nửa số điện thoại, im lặng.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NHIP_RUNG, rung } from '@/lib/rung';

/*
 * `Navigator` của lib.dom khai `vibrate` là BẮT BUỘC, nên giao với
 * `{ vibrate?: … }` không làm nó optional và `delete` không hợp lệ. Ép qua
 * `unknown` là cách gọn nhất để test dựng đúng cảnh "máy KHÔNG có vibrate" —
 * mà đó chính là cảnh của toàn bộ iOS, tức cảnh quan trọng nhất ở đây.
 */
const nav = navigator as unknown as { vibrate?: unknown };

function datMatchMedia(reduce: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: reduce && q.includes('reduce'), media: q }),
  });
}

afterEach(() => {
  delete nav.vibrate;
  datMatchMedia(false);
});

describe('rung', () => {
  it('KHÔNG nổ khi trình duyệt không có vibrate (mọi iPhone)', () => {
    datMatchMedia(false);
    delete nav.vibrate;
    expect(() => rung(NHIP_RUNG.cham)).not.toThrow();
  });

  it('KHÔNG nổ khi vibrate tự ném (tab chưa được người dùng chạm)', () => {
    datMatchMedia(false);
    nav.vibrate = () => { throw new Error('không được phép'); };
    expect(() => rung(NHIP_RUNG.cham)).not.toThrow();
  });

  it('gọi vibrate đúng số ms khi máy có hỗ trợ', () => {
    datMatchMedia(false);
    const v = vi.fn(() => true);
    nav.vibrate = v;
    rung(NHIP_RUNG.cham);
    expect(v).toHaveBeenCalledWith(NHIP_RUNG.cham);
  });

  it('IM khi người dùng xin ít chuyển động', () => {
    datMatchMedia(true);
    const v = vi.fn(() => true);
    nav.vibrate = v;
    rung(NHIP_RUNG.nang);
    expect(v).not.toHaveBeenCalled();
  });

  it('nước đi NẶNG rung lâu hơn cú chạm nhẹ', () => {
    /*
     * Khoá quan hệ chứ không khoá hai con số: chỉnh nhịp cho hợp tay thì được,
     * nhưng ALL-IN mà rung BẰNG cú chọn 25% là mất đúng thứ hai nhịp sinh ra để
     * phân biệt.
     */
    expect(NHIP_RUNG.nang).toBeGreaterThan(NHIP_RUNG.cham);
  });
});
