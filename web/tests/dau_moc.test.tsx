/**
 * DẤU MỐC KỸ NĂNG — phía client (doc 06 §5.1, 17/08).
 *   · IM khi rỗng (D62) và bỏ qua id lạ (API mới hơn bundle);
 *   · A10: KHÔNG câu kê đơn — cùng bộ từ với D89;
 *   · ⭐ §1.2: lời khen chỉ nói KỸ NĂNG. Quét cả tự điển cho chắc không ai
 *     thêm một mốc kiểu "bạn đã all-in 3 lần" về sau.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DauMocKhoi, THE_DAU_MOC } from '../src/components/holdem/DauMoc';
import { TU_KE_DON } from '../src/lib/khoanh_khac';

/** Từ chỉ TƯ THẾ RỦI RO — §1.2 cấm THƯỞNG cho ba trục này. */
const TU_TU_THE = ['all-in', 'all in', 'dồn hết', 'đa dạng', 'nhiều mã', 'tiền mặt', 'phơi nhiễm', 'ôm '];

describe('DauMoc', () => {
  it('rỗng / id lạ ⇒ không vẽ khung', () => {
    const { container, rerender } = render(<DauMocKhoi danhSach={[]} />);
    expect(container.querySelector('[data-tap="dau-moc"]')).toBeNull();
    rerender(<DauMocKhoi danhSach={undefined} />);
    expect(container.querySelector('[data-tap="dau-moc"]')).toBeNull();
    rerender(<DauMocKhoi danhSach={[{ id: 'mot_moc_tuong_lai', vong: 3, so: 1 }]} />);
    expect(container.querySelector('[data-tap="dau-moc"]')).toBeNull();
  });

  it('vẽ tên + câu hồi cố với đúng số của server', () => {
    render(<DauMocKhoi danhSach={[
      { id: 'chuoi_dung_huong', vong: 4, so: 3 },
      { id: 'cat_truoc_sap', vong: 6, so: 900 },
    ]} />);
    expect(screen.getByText('BA VÒNG LIỀN ĐÚNG HƯỚNG')).toBeInTheDocument();
    expect(screen.getByText(/3 vòng liên tiếp .* vòng 4/)).toBeInTheDocument();
    expect(screen.getByText(/vòng 6 — vòng đó chợ mất 9,0%/)).toBeInTheDocument();
  });

  it('⭐ toàn bộ tự điển: không kê đơn (A10), không khen tư thế rủi ro (§1.2)', () => {
    for (const [id, the] of Object.entries(THE_DAU_MOC)) {
      const chu = `${the.ten} ${the.cau({ vong: 5, so: 1234 })}`.toLowerCase();
      for (const tu of TU_KE_DON) {
        expect(chu.includes(tu), `mốc ${id} có từ kê đơn "${tu}"`).toBe(false);
      }
      for (const tu of TU_TU_THE) {
        expect(chu.includes(tu), `mốc ${id} khen TƯ THẾ RỦI RO ("${tu}") — §1.2 cấm`).toBe(false);
      }
    }
  });
});
