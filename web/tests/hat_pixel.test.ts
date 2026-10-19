/**
 * PFM NGÀY ĐẦU — HẠT PIXEL (`lib/hat_pixel.ts`).
 *
 * ⚠⚠ Bài đắt nhất: dọn hạt PHẢI đi qua ĐỒNG HỒ, không qua `onfinish` — D356 tự vấp #1
 * (201 hạt kẹt lại DOM khi tab ẩn / pane không vẽ, vì `onfinish` của Web Animations API
 * không bao giờ bắn trong cảnh đó). Bài dưới giả `animate()` KHÔNG BAO GIỜ tự kết thúc
 * (mô phỏng đúng cảnh ấy) rồi dùng fake timers chứng minh hạt vẫn bị dọn đúng hẹn.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { donHatPixel, phutHat, tamPhanTu } from '../src/lib/hat_pixel.js';
import { NHIP } from '../src/lib/nhip.js';

/** `animate()` giả: trả một Animation-như-thật nhưng KHÔNG BAO GIỜ bắn `onfinish`/resolve. */
function ganAnimateGia(): { soLanHuy: number } {
  const so = { soLanHuy: 0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Element.prototype as any).animate = vi.fn(function animateGia() {
    return {
      cancel: () => { so.soLanHuy += 1; },
      // ⚠ CỐ Ý không có `onfinish` tự bắn — đúng cảnh tab ẩn/pane không vẽ.
      onfinish: null,
      finished: new Promise(() => { /* không bao giờ resolve — cùng lý do */ }),
    };
  });
  return so;
}

const animateGocDaCo = typeof Element.prototype.animate === 'function';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const animateGoc = (Element.prototype as any).animate as unknown;

describe('hat_pixel — phutHat/donHatPixel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    donHatPixel();
    document.body.innerHTML = '';
    if (animateGocDaCo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Element.prototype as any).animate = animateGoc;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (Element.prototype as any).animate;
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('⭐⭐⭐ hạt bị dọn đúng hẹn bằng ĐỒNG HỒ dù animate() không bao giờ bắn finish', () => {
    ganAnimateGia();

    phutHat({ x: 10, y: 10 }, 'var(--c-4)', 5);
    expect(document.querySelectorAll('i').length, 'chưa tới hẹn').toBe(5);

    // Còn 1ms nữa mới tới hẹn (duration + 40ms) — vẫn phải còn nguyên.
    vi.advanceTimersByTime(NHIP.PFM_ND_HAT + 39);
    expect(document.querySelectorAll('i').length, 'chưa đủ 1ms cuối').toBe(5);

    // Đúng hẹn — dọn sạch dù `onfinish` CHƯA TỪNG bắn.
    vi.advanceTimersByTime(1);
    expect(document.querySelectorAll('i').length, 'đã tới hẹn nhưng vẫn còn hạt kẹt').toBe(0);
  });

  it('không làm gì khi thiếu tâm — không hạt nào được tạo, không ném', () => {
    ganAnimateGia();
    expect(() => phutHat(null, 'var(--c-4)', 5)).not.toThrow();
    expect(document.querySelectorAll('i').length).toBe(0);
  });

  it('⭐ tôn trọng prefers-reduced-motion — không phụt hạt nào', () => {
    ganAnimateGia();
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: true,
      media: q,
      addEventListener() { /* không cần */ },
      removeEventListener() { /* không cần */ },
    }));
    phutHat({ x: 0, y: 0 }, 'var(--c-4)', 5);
    expect(document.querySelectorAll('i').length).toBe(0);
  });

  it('⭐ donHatPixel() dọn sạch NGAY khi gọi giữa chừng (màn rời đi trước khi tới hẹn)', () => {
    ganAnimateGia();
    phutHat({ x: 0, y: 0 }, 'var(--c-4)', 4);
    expect(document.querySelectorAll('i').length).toBe(4);

    donHatPixel();
    expect(document.querySelectorAll('i').length, 'donHatPixel không dọn hết').toBe(0);

    // Đồng hồ vẫn còn hẹn cũ treo — chạy hết thời gian không được ném hay dọn hai lần.
    expect(() => vi.advanceTimersByTime(NHIP.PFM_ND_HAT + 100)).not.toThrow();
  });

  it('vẫn dọn được hạt khi trình duyệt KHÔNG có Web Animations API (`animate` thiếu)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (Element.prototype as any).animate;
    phutHat({ x: 0, y: 0 }, 'var(--c-4)', 3);
    // Không animate được thì hạt bị gỡ NGAY, không kẹt lại chờ đồng hồ.
    expect(document.querySelectorAll('i').length).toBe(0);
  });

  it('tamPhanTu đọc đúng tâm từ getBoundingClientRect, và null khi thiếu phần tử', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({
      left: 10, top: 20, width: 40, height: 10, right: 50, bottom: 30, x: 10, y: 20,
      toJSON: () => ({}),
    });
    expect(tamPhanTu(el)).toEqual({ x: 30, y: 25 });
    expect(tamPhanTu(null)).toBeNull();
  });
});
