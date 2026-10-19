/**
 * D543 — Bách khoa: Ô TÌM lên đầu, ngay dưới là hàng lọc; CÁCH MẤT TIỀN thành một ô lọc (sau TẤT CẢ) có CHẤM VÀNG khi có cách mới chưa xem
 * (founder 06/10). Chấm nhớ ở máy (localStorage): mở ô lọc ⇒ hết chấm; thêm cách mới ⇒ chấm lại.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DUONG_MAT_TIEN } from '@/lib/bach_khoa';
import { DanhSach } from '@/screens/bach-khoa/BachKhoa';

const ve = () => render(<MemoryRouter><DanhSach soTay={undefined} onMo={() => {}} /></MemoryRouter>);
beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { window.localStorage.clear(); });

describe('D543 — tra cứu lên đầu, CÁCH MẤT TIỀN là ô lọc', () => {
  it('⭐ thứ tự: ô tìm → hàng lọc (TẤT CẢ · CÁCH MẤT TIỀN · …); cửa mất tiền KHÔNG còn đứng thường trực trên đầu', () => {
    const { container } = ve();
    const tim = screen.getByRole('textbox', { name: 'Tìm trong bách khoa' });
    const hang = screen.getByRole('tablist', { name: 'Nhóm' });
    expect(tim.compareDocumentPosition(hang) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect([...hang.querySelectorAll('[role="tab"]')].slice(0, 2).map((b) => b.textContent)).toEqual(['TẤT CẢ', 'CÁCH MẤT TIỀN']);
    expect(container.querySelector('[data-testid="cua-mat-tien"]')).toBeNull();
  });
  it('⭐ chưa xem ⇒ chấm vàng; mở ô ⇒ hiện mười đường + hết chấm, và vẽ lại vẫn hết chấm (nhớ ở máy)', () => {
    const r = ve();
    expect(screen.getByTestId('chip-mat-tien').querySelector('[data-cham-moi]')).not.toBeNull();
    fireEvent.click(screen.getByTestId('chip-mat-tien'));
    expect(screen.getByTestId('cua-mat-tien')).toBeTruthy();
    expect(screen.getByTestId('chip-mat-tien').querySelector('[data-cham-moi]')).toBeNull();
    r.unmount();
    ve();
    expect(screen.getByTestId('chip-mat-tien').querySelector('[data-cham-moi]')).toBeNull();
  });
  it('có một cách MỚI (máy đã xem các cách cũ) ⇒ chấm sáng lại', () => {
    window.localStorage.setItem('delphi:bk:mat-tien-da-xem', JSON.stringify(DUONG_MAT_TIEN.slice(1).map((d) => d.id)));
    ve();
    expect(screen.getByTestId('chip-mat-tien').querySelector('[data-cham-moi]')).not.toBeNull();
  });
});
