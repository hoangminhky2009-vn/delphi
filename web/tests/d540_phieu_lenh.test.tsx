/**
 * D540 — PHIẾU LỆNH mọc trên thẻ mã + Delphi neo PHÍA TRÊN khi shop mở (founder 06/10: *"chạm thẻ mã thì hàng chip và MUA/BÁN mọc ngay trên
 * thẻ, Delphi luôn neo phía trên khung"*). Ngữ pháp phiếu canh ở `ban_cuoc.test.tsx` (⭐ D540). Ở đây: thẻ thoại của trợ lý trong shop
 * KHÔNG BAO GIỜ đậu dưới ô rọi / mép dưới — ca bàn tập vòng 1 trên máy founder: thẻ đậu đáy che đúng hàng chip.
 * jsdom không bố cục ⇒ giả khung neo + `innerHeight` như `coach_bam_o.test.tsx`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { CoachTap, type BoiCanhTap } from '../src/components/holdem/CoachTap';

const NEN: BoiCanhTap = {
  vong: 1, shopMo: true, bangMo: false, shopChonMa: false, coKetQua: false, loaiVongNay: 'tai_san', xong: false, onMoShop: () => {},
  chaoVaiXong: true, chaoVaiPha: null, khoaLuu: 'phieu',
};
function neo(top: number, height: number) {
  for (const tap of ['shop-vi', 'shop-taisan', 'shop-lenh', 'shop-chot', 'shop-loi', 'man-chon', 'nut-shop']) {
    const el = document.createElement('div');
    el.setAttribute('data-tap', tap);
    el.getBoundingClientRect = () => ({ top, height, left: 20, width: 330, right: 350, bottom: top + height, x: 20, y: top, toJSON: () => ({}) }) as DOMRect;
    el.scrollIntoView = () => {};
    document.body.append(el);
  }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('innerHeight', 812);
  window.sessionStorage.setItem('delphi:coach:phieu', JSON.stringify({ daQua: ['chia-vai', 'vai-cua-ban', 'vai', 'muc-tieu', 'la-mo-man', 'doan-la-ke', 'mo-shop'], tat: false }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; window.sessionStorage.clear(); });

describe('D540 — trợ lý trong shop neo phía trên', () => {
  it('⭐ ô rọi ở đầu màn, dưới còn rộng ⇒ shop mở thì thẻ KHÔNG xuống dưới ô (về mép TRÊN)', () => {
    neo(100, 140);
    render(<CoachTap {...NEN} />);
    act(() => { vi.advanceTimersByTime(3000); });
    const t = screen.getByRole('dialog');
    expect(t.dataset['bam']).not.toBe('duoi');
    expect(t.className).toMatch(/theShop/);
    expect(t.className).not.toMatch(/theDuoi/);
  });
  it('ô rọi ở thấp (trên đủ chỗ) ⇒ shop mở vẫn là DẢI GỌN mép trên, không bám ô', () => {
    neo(560, 200);
    render(<CoachTap {...NEN} />);
    act(() => { vi.advanceTimersByTime(3000); });
    const t = screen.getByRole('dialog');
    expect(t.className).toMatch(/theShop/);
    expect(t.style.bottom).toBe('');
  });
  it('vế ngược: ngoài shop vẫn bám dưới ô như cũ (D374 không đổi)', () => {
    neo(100, 140);
    render(<CoachTap {...NEN} shopMo={false} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(screen.getByRole('dialog').dataset['bam']).toBe('duoi');
  });
});
