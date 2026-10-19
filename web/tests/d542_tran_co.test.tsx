/**
 * D542 — đầu trận chỉ báo SỐ VAI ("TRẬN CÓ 1 CÁ MẬP · 1 ĐỘI LÁI · 1 TỔ CHỨC", kèm icon), không lật vai từng ghế (founder 06/10).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChaoVai } from '@/components/holdem/ChaoVai';

const VAI = { id: 'ca_nhan', ten: 'NHÀ ĐẦU TƯ CÁ NHÂN', dacQuyen: '', caiGia: '', heSoVon: 1 };
const DOI_THU = [
  { ghe_id: 'b1', ten: 'Máy · A', loai: 'bot' as const, vai_an: true as const },
  { ghe_id: 'b2', ten: 'Máy · B', loai: 'bot' as const, vai_an: true as const },
  { ghe_id: 'b3', ten: 'Máy · C', loai: 'bot' as const, vai_an: true as const },
  { ghe_id: 'b4', ten: 'Máy · D', loai: 'bot' as const, vai_an: true as const },
];

describe('D542 — TRẬN CÓ', () => {
  it('⭐ có `demVai` ⇒ một dòng đếm tay to (thứ tự Cá Mập → Đội Lái → Tổ Chức), không danh sách từng ghế', () => {
    render(<ChaoVai vai={VAI} onXong={() => {}} doiThu={DOI_THU} demVai={{ to_chuc: 1, ca_nhan: 1, ca_map: 1, doi_lai: 1 }} dongBang />);
    const ds = screen.getByRole('list', { name: 'Trận có 1 CÁ MẬP · 1 ĐỘI LÁI · 1 TỔ CHỨC' });
    expect([...ds.querySelectorAll('[data-vai]')].map((e) => e.getAttribute('data-vai'))).toEqual(['ca_map', 'doi_lai', 'to_chuc']);
    expect(screen.getByText('TRẬN CÓ')).toBeTruthy();
    expect(document.querySelector('[data-ghe]'), 'không còn lá vai từng ghế').toBeNull();
    expect(document.body.textContent).toMatch(/Ai cầm vai nào thì giấu/);
  });
  it('vế ngược: trận cũ không `demVai` ⇒ vẫn CHIA VAI từng ghế như trước', () => {
    render(<ChaoVai vai={VAI} onXong={() => {}} doiThu={DOI_THU} dongBang />);
    expect(screen.getByText('CHIA VAI')).toBeTruthy();
    expect(document.querySelectorAll('[data-ghe]').length).toBe(5);
  });
});
