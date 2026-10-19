/**
 * BÁCH KHOA CƠ CHẾ — trang tra cứu nguội cho ba thứ chợ làm với người chơi.
 *
 * Founder 13/09: *"vẫn chưa có chỗ nào thể hiện hay giải thích rõ ràng lắm về tính liên kết
 * của các thẻ sự kiện … user phải biết vì sao"*, và khi chốt mức thì dặn thêm: *"trang tra
 * cứu đừng có mà toàn chữ nhé, có minh họa thì tốt"*.
 *
 * ⇒ Bài này canh ĐÚNG hai điều đó: đủ ba cơ chế, và mỗi mục PHẢI có sơ đồ chứ không chỉ chữ.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BachKhoaCoChe } from '@/components/holdem/BachKhoaCoChe';

describe('bách khoa cơ chế', () => {
  it('⭐ đủ BA cơ chế: đám đông bẻ ô · trượt giá · tin trước mở cửa tin sau', () => {
    const { container } = render(<BachKhoaCoChe />);
    const chu = container.textContent ?? '';
    expect(chu).toMatch(/ĐÁM ĐÔNG BẺ Ô/);
    expect(chu).toMatch(/trượt giá/i);
    expect(chu).toMatch(/TIN NÀY MỞ CỬA CHO TIN KIA/);
  });

  it('⭐⭐ mỗi mục có SƠ ĐỒ, không mục nào chỉ có chữ', () => {
    const { container } = render(<BachKhoaCoChe />);
    const muc = container.querySelectorAll('section');
    expect(muc.length, 'không còn mục nào').toBeGreaterThanOrEqual(3);
    for (const m of muc) {
      expect(
        m.querySelector('[class*="soDo"]'),
        `mục "${m.querySelector('h4')?.textContent}" mất sơ đồ — founder đã dặn đừng toàn chữ`,
      ).not.toBeNull();
    }
  });

  it('⭐ dùng ĐÚNG từ vựng người chơi đã thấy trên bàn, không đặt tên mới', () => {
    // "ĐÃ ĐỔI ↺" là nhãn chân ô thật (`lib/o_doi`), "Chen chúc" là tên mắt xích chuỗi.
    const { container } = render(<BachKhoaCoChe />);
    const chu = container.textContent ?? '';
    expect(chu).toContain('ĐÃ ĐỔI ↺');
    expect(chu).toContain('Chen chúc');
  });

  it('KHÔNG kê đơn (A10): không câu nào bảo người chơi nên làm gì', () => {
    const { container } = render(<BachKhoaCoChe />);
    const chu = (container.textContent ?? '').toLowerCase();
    for (const cam of ['bạn nên', 'hãy ', 'đừng ', 'tránh ']) {
      expect(chu, `bách khoa đang kê đơn: "${cam}"`).not.toContain(cam);
    }
  });
});
