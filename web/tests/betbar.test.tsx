/**
 * THANH CAM KẾT — nút preset phải thật sự đổi giá trị.
 *
 * Founder báo hai lượt liền: bấm dồn-hết mà thanh vẫn ở 63%. Tôi đã đoán sai
 * nguyên nhân vài lần nên lần này bấm thật vào nút và xem nó gọi ra cái gì.
 *
 * ⚠ Nhãn nút lấy từ `T_DON_HET_UPPER` chứ KHÔNG gõ tay: 25/07 nhãn đổi từ chuỗi
 * poker sang từ vựng quỹ (D26), và test gõ tay nhãn cũ thì đỏ mà không nói được
 * là đỏ vì đổi tên hay vì vỡ cơ chế.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ALL_IN, BetBar } from '../src/components/holdem/BetBar';
import { T_DON_HET_UPPER } from '../src/lib/vocab';

describe('BetBar — preset', () => {
  it('bấm ALL IN gọi onDoi(ALL_IN) — KHÔNG phải một mức phần trăm', () => {
    const onDoi = vi.fn();
    render(<BetBar phanTram={63} von={10000} camKetNen={500} onDoi={onDoi} />);
    fireEvent.click(screen.getByText(T_DON_HET_UPPER));
    expect(onDoi).toHaveBeenCalledWith(ALL_IN);
  });

  it('🔴 ALL IN KHÔNG hiện con số phần trăm nào — kể cả 100% hay -1%', () => {
    // Founder báo 3 lượt liền "bấm all in mà ra 60%/63%". Bỏ hẳn phần trăm khỏi
    // đường này thì không còn con số nào để mà lệch.
    const { container } = render(
      <BetBar phanTram={ALL_IN} von={10000} camKetNen={500} onDoi={() => {}} />,
    );
    // Chỉ còn "25%" và "50%" là NHÃN preset; không được có mức đang-chọn nào.
    expect(container.textContent).not.toContain('-1%');
    expect(container.textContent).not.toContain('100%');
    expect(screen.getAllByText(T_DON_HET_UPPER).length).toBeGreaterThan(1);
  });

  it('ALL IN đưa ĐÚNG trần, không nhân chia gì thêm', () => {
    const { container } = render(
      <BetBar phanTram={ALL_IN} von={10000} camKetNen={500} toiDa={9500} onDoi={() => {}} />,
    );
    expect(container.textContent).toContain('9.500');
  });

  it('ALL IN = TOÀN BỘ số còn đặt được, không phải % của tổng vốn', () => {
    // Đã góp tiền cửa rồi thì trần thật là `toiDa`, không phải `von`.
    const { container } = render(
      <BetBar phanTram={ALL_IN} von={10000} camKetNen={500} toiDa={9500} onDoi={() => {}} />,
    );
    expect(container.textContent).toContain('9.500');
    expect(container.textContent).not.toContain('10.000');
  });

  it('preset đang chọn được tô sáng — người chơi phải thấy mình bấm trúng', () => {
    const { rerender } = render(
      <BetBar phanTram={0} von={10000} camKetNen={500} onDoi={() => {}} />,
    );
    const lopTat = screen.getByRole('button', { name: T_DON_HET_UPPER }).className;
    rerender(<BetBar phanTram={ALL_IN} von={10000} camKetNen={500} onDoi={() => {}} />);
    const lopBat = screen.getByRole('button', { name: T_DON_HET_UPPER }).className;
    expect(lopBat, 'bấm trúng phải trông KHÁC lúc chưa bấm').not.toBe(lopTat);
  });

  it('🔴 KÉO HẾT THANH cũng là ALL IN — cháy y như bấm nút', () => {
    // Founder: "bấm nút chọn cược all-in thì thanh cháy... nhưng khi kéo full
    // thanh cược (bản chất là all in) thì lại không có hiệu ứng".
    const { container } = render(
      <BetBar phanTram={100} von={10000} camKetNen={500} toiDa={9500} onDoi={() => {}} />,
    );
    expect(container.textContent).toContain(T_DON_HET_UPPER);
    expect(container.textContent).not.toContain('100%');
    expect(container.textContent, 'phải đưa trọn số còn đặt được').toContain('9.500');
  });

  it('kéo thanh chạm đáy thì báo về ALL_IN, không báo 100', () => {
    const onDoi = vi.fn();
    render(<BetBar phanTram={40} von={10000} camKetNen={500} onDoi={onDoi} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '100' } });
    expect(onDoi).toHaveBeenCalledWith(ALL_IN);
  });

  it('MIN không bao giờ thấp hơn giá đang phải theo', () => {
    const { container } = render(
      <BetBar phanTram={0} von={10000} camKetNen={500} conThieu={3000} onDoi={() => {}} />,
    );
    expect(container.textContent).toContain('3.000');
  });
});
