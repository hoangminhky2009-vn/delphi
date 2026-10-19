/**
 * HỘP VỠ PIXEL — khoá TRẦN HIỆU NĂNG và luật reduced-motion.
 *
 * D68 §2 đặt trần bằng con số vì lý do rất cụ thể: mỗi mảnh là một thẻ DOM, và
 * lưới dày (300+ mảnh) làm máy tầm trung khựng ĐÚNG LÚC nghi lễ muốn gây ấn
 * tượng nhất. Trần đó là thứ dễ bị nới nhất khi ai đó muốn "mượt hơn", nên nó
 * phải có bài canh — không thì nó là một lời dặn trong comment.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { HopVo, SO_MANH_TRAN } from '../src/components/shop/HopVo';

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? matches : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
}

const demManh = (el: HTMLElement) =>
  el.querySelectorAll('[class*="manh"]').length;

describe('Hộp vỡ pixel', () => {
  it('⭐ TRẦN 48 MẢNH: pha vỡ không bao giờ dựng quá số đã chốt', () => {
    /*
     * ⚠ SỐ 48 GÕ CỨNG Ở ĐÂY LÀ CHỦ Ý, ngược quy ước "đừng chép số vào test".
     *
     * Quy ước đó áp cho THAM SỐ chỉnh được (giá, tỷ lệ) — chép chúng vào test thì
     * test kiểm chính nó. Đây là chuyện khác: 48 là TRẦN HIỆU NĂNG founder đặt
     * (D68 §2), tức một ràng buộc từ NGOÀI code. So với `SO_MANH_TRAN` thì ai nới
     * hằng số lên 300 sẽ thấy test tự nới theo và xanh y như cũ — đúng cái bẫy
     * "bài test xanh mãi mà chưa từng chạm thứ nó mang tên".
     */
    vi.useFakeTimers();
    stubReducedMotion(false);
    try {
      const { container } = render(
        <HopVo hat={12345} bac="epic"><i data-mon /></HopVo>,
      );
      // Chạy tới pha `vo` (sau xoay + rung).
      act(() => { vi.advanceTimersByTime(900); });
      const n = demManh(container as unknown as HTMLElement);
      expect(n).toBeGreaterThan(0);
      expect(n, `dựng ${n} mảnh — trần cứng của D68 §2 là 48`).toBeLessThanOrEqual(48);
      expect(SO_MANH_TRAN, 'hằng số đã bị nới quá trần founder đặt').toBeLessThanOrEqual(48);
    } finally {
      vi.useRealTimers();
    }
  });

  it('mảnh vỡ được DỌN sau khi diễn xong — không để 48 thẻ nằm lại', () => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    try {
      const { container } = render(
        <HopVo hat={7} bac="hiem"><i data-mon /></HopVo>,
      );
      act(() => { vi.advanceTimersByTime(900); });
      expect(demManh(container as unknown as HTMLElement)).toBeGreaterThan(0);
      act(() => { vi.advanceTimersByTime(2000); });
      expect(demManh(container as unknown as HTMLElement)).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('⭐ reduced-motion: KHÔNG mảnh nào, nhưng MÓN VẪN HIỆN', () => {
    /*
     * Luật: bỏ CHUYỂN ĐỘNG, không bỏ KẾT QUẢ. Người bật tiết kiệm chuyển động
     * vẫn phải thấy mình vừa nhận gì — thứ bị tắt là cú rung và 48 mảnh bay.
     */
    stubReducedMotion(true);
    const { container } = render(
      <HopVo hat={1} bac="thuong"><i data-mon /></HopVo>,
    );
    expect(demManh(container as unknown as HTMLElement)).toBe(0);
    expect(container.querySelector('[data-mon]')).not.toBeNull();
    expect(container.querySelector('[data-pha]')?.getAttribute('data-pha')).toBe('xong');
  });

  it('gọi onXong đúng MỘT lần khi nghi lễ kết thúc', () => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    try {
      const xong = vi.fn();
      render(<HopVo hat={3} bac="hiem" onXong={xong}><i /></HopVo>);
      act(() => { vi.advanceTimersByTime(3000); });
      expect(xong).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cùng hạt ⇒ cùng hình (tất định, kiểm lại được từ ảnh chụp màn hình)', () => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    try {
      const doc = (hat: number) => {
        const { container, unmount } = render(
          <HopVo hat={hat} bac="epic"><i /></HopVo>,
        );
        act(() => { vi.advanceTimersByTime(900); });
        const v = [...container.querySelectorAll('[class*="manh"]')]
          .map((e) => (e as HTMLElement).style.getPropertyValue('--dx')).join('|');
        unmount();
        return v;
      };
      expect(doc(999)).toBe(doc(999));
      expect(doc(999)).not.toBe(doc(1000));
    } finally {
      vi.useRealTimers();
    }
  });
});
