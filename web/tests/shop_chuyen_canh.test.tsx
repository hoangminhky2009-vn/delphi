/**
 * CHUYỂN CẢNH MỞ / ĐÓNG SHOP (D68 §3).
 *
 * Bài đắt nhất ở đây là bài CUỐI: thời lượng hoạt ảnh sống ở HAI chỗ — hằng số
 * TS (`SHOP_DONG_MS`) và thời lượng CSS (`.phuDong`). JS không đọc được thời
 * lượng CSS mà không chạm DOM thật, nên hai chỗ là điều không tránh được; thứ
 * tránh được là để chúng TRÔI KHỎI NHAU trong im lặng:
 *   · CSS dài hơn TS ⇒ shop bị gỡ khỏi cây giữa lúc đang diễn (giật một cái).
 *   · TS dài hơn CSS ⇒ shop đứng trơ sau khi diễn xong rồi mới biến mất.
 * Cả hai đều không ném lỗi và không bài test thường nào nhìn thấy.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ShopManHinh, SHOP_DONG_MS } from '../src/components/holdem/ShopManHinh';

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

/** Bộ prop tối thiểu — shop có rất nhiều prop, bài này chỉ cần nó dựng được. */
function dungShop(onDong: () => void) {
  return render(
    <ShopManHinh
      vong={1}
      loaiVongNay="tai_san"
      vongMoTiepTheo={{ tai_san: null, chien_thuat: 3 }}
      taiSan={[]}
      chienThuat={[]}
      chonTS={[]}
      chonCT={null}
      onChonTS={() => {}}
      onChonCT={() => {}}
      danhMuc={[]}
      sucChuaTaiSan={3}
      sucChuaChienThuat={3}
      art={{}}
      ganVao={null}
      onGan={() => {}}
      phamViThe={() => 'danh_muc'}
      chiPhiRoll={1}
      luotConLai={1}
      onRoll={() => {}}
      onDong={onDong}
      tuDien={{ muc: [] } as never}
      giaiDoanNhan={[]}
      suKienNhan={[]}
      moTaChienThuat={() => undefined}
    />,
  );
}

describe('Chuyển cảnh shop', () => {
  it('bấm ✕ KHÔNG đóng ngay — chờ hoạt ảnh chạy xong mới gọi onDong', () => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    try {
      const onDong = vi.fn();
      dungShop(onDong);
      fireEvent.click(screen.getByLabelText('Đóng'));

      // Ngay sau cú bấm: chưa đóng, và đã chuyển sang pha 'dong' để CSS chạy.
      expect(onDong).not.toHaveBeenCalled();
      expect(document.querySelector('[data-shop-pha]')?.getAttribute('data-shop-pha'))
        .toBe('dong');

      act(() => { vi.advanceTimersByTime(SHOP_DONG_MS + 20); });
      expect(onDong).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bấm ✕ nhiều lần chỉ đóng MỘT lần (không xếp chồng đồng hồ)', () => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    try {
      const onDong = vi.fn();
      dungShop(onDong);
      const nut = screen.getByLabelText('Đóng');
      fireEvent.click(nut);
      fireEvent.click(nut);
      fireEvent.click(nut);
      act(() => { vi.advanceTimersByTime(SHOP_DONG_MS + 50); });
      expect(onDong).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reduced-motion: đóng NGAY, không bắt chờ hiệu ứng đã tắt', () => {
    stubReducedMotion(true);
    const onDong = vi.fn();
    dungShop(onDong);
    fireEvent.click(screen.getByLabelText('Đóng'));
    expect(onDong).toHaveBeenCalledTimes(1);
  });

  it('⭐ THỜI LƯỢNG TS PHẢI KHỚP CSS — hai chỗ trôi khỏi nhau là hỏng IM LẶNG', () => {
    const css = readFileSync(
      path.resolve(__dirname, '../src/components/holdem/ShopManHinh.module.css'), 'utf8');
    const khoi = /\.phuDong\s*\{([^}]*)\}/.exec(css);
    expect(khoi, 'không tìm thấy .phuDong — chuyển cảnh đóng đã bị gỡ?').not.toBeNull();
    const ms = /animation:\s*\w+\s+(\d+)ms/.exec(khoi![1]!);
    expect(ms, 'không đọc được thời lượng của .phuDong').not.toBeNull();
    expect(Number(ms![1]),
      `CSS ${ms![1]}ms ≠ SHOP_DONG_MS ${SHOP_DONG_MS}ms`).toBe(SHOP_DONG_MS);
  });
});
