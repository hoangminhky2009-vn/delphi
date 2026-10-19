/**
 * "HÔM NAY BẠN VỪA CHẠM" (16/08, tầng 1) — phía client.
 *
 * Ba thứ khoá: (1) tự điển PHỦ ĐỦ mọi ID server khai — thiếu một mục là một
 * khái niệm hiện thành ID thô; (2) KHÔNG KÊ ĐƠN (A10) — quét mọi chuỗi trong
 * tự điển tìm động từ khuyên bảo; (3) khối IM khi rỗng, và ID lạ không nổ.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KHOANH_KHAC_IDS } from '@server/holdem/khoanh_khac_ids';
import { ICON_KHOANH_KHAC, pctCuaBp, THE_KHOANH_KHAC, TU_KE_DON } from '../src/lib/khoanh_khac';
import { PixelIcon } from '@/components/ui';
import { DaCham } from '../src/components/holdem/DaCham';

describe('tự điển khoảnh khắc', () => {
  it('⭐ phủ ĐỦ và ĐÚNG tập ID server khai — không thừa, không thiếu', () => {
    expect(Object.keys(THE_KHOANH_KHAC).sort()).toEqual([...KHOANH_KHAC_IDS].sort());
  });

  it('⭐ KHÔNG KÊ ĐƠN (A10): không câu nào chứa động từ khuyên bảo', () => {
    const cauChu: string[] = [];
    for (const the of Object.values(THE_KHOANH_KHAC)) {
      cauChu.push(the.ten, the.ngoai_doi);
      for (const am of [true, false]) {
        cauChu.push(the.hoi_co({ vong: 3, pct: '−4,2%', am }));
      }
    }
    for (const c of cauChu) {
      const thap = ` ${c.toLowerCase()} `;
      for (const tu of TU_KE_DON) {
        expect(thap.includes(tu), `"${c}" chứa từ kê đơn "${tu.trim()}"`).toBe(false);
      }
    }
  });

  it('mỗi mục có TÊN viết hoa ≤ 3 từ và câu ngoài đời không rỗng', () => {
    for (const [id, the] of Object.entries(THE_KHOANH_KHAC)) {
      expect(the.ten, id).toBe(the.ten.toUpperCase());
      expect(the.ten.trim().split(/\s+/).length, id).toBeLessThanOrEqual(3);
      expect(the.ngoai_doi.length, id).toBeGreaterThan(20);
    }
  });

  it('pctCuaBp: dấu trừ Unicode, phẩy thập phân, một chữ số lẻ, không dấu cộng', () => {
    expect(pctCuaBp(-420)).toBe('−4,2%');
    expect(pctCuaBp(250)).toBe('2,5%');
    expect(pctCuaBp(0)).toBe('0,0%');
    expect(pctCuaBp(-5)).toBe('−0,1%');
  });
});

describe('<DaCham>', () => {
  it('⭐ RỖNG hoặc VẮNG ⇒ không vẽ gì (không khung trống, không "chưa có gì")', () => {
    const { container: a } = render(<DaCham danhSach={[]} />);
    expect(a.innerHTML).toBe('');
    const { container: b } = render(<DaCham danhSach={undefined} />);
    expect(b.innerHTML).toBe('');
  });

  it('vẽ tên + số nhuộm dấu + câu hồi cố đúng vòng', () => {
    render(<DaCham danhSach={[
      { id: 'tin_gia', vong: 3, delta_bp: -420 },
      { id: 'don_bay', vong: 5, delta_bp: 250 },
    ]} />);
    expect(screen.getByText('HÔM NAY BẠN VỪA CHẠM')).toBeInTheDocument();
    expect(screen.getByText('TIN GIẢ')).toBeInTheDocument();
    expect(screen.getByText('−4,2%')).toBeInTheDocument();
    expect(screen.getByText(/Vòng 3: bạn đứng ở phía tin bịa/)).toBeInTheDocument();
    expect(screen.getByText('ĐÒN BẨY')).toBeInTheDocument();
    expect(screen.getByText('2,5%')).toBeInTheDocument();
    expect(screen.getByText(/Vòng 5: đòn bẩy trả 2,5%/)).toBeInTheDocument();
  });

  it('ID lạ (API mới hơn bundle) ⇒ bỏ qua mục đó, không nổ, không hiện ID thô', () => {
    render(<DaCham danhSach={[
      { id: 'khai_niem_tuong_lai', vong: 1, delta_bp: -999 },
      { id: 'chen_chuc', vong: 2, delta_bp: -60 },
    ]} />);
    expect(screen.queryByText(/khai_niem_tuong_lai/)).toBeNull();
    expect(screen.getByText('CHEN CHÚC')).toBeInTheDocument();
  });

  it('TOÀN ID lạ ⇒ khối IM luôn (không vẽ tiêu đề trống)', () => {
    const { container } = render(<DaCham danhSach={[{ id: 'x', vong: 1, delta_bp: 1 }]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('⭐ Trực quan hoá bằng icon pixel (founder 23/08)', () => {
  /*
   * *"phần 'Hôm nay bạn vừa chạm' cũng trực quan hóa bằng hình ảnh và các icon
   * pixel, giảm chữ xuống"*.
   */
  it('MỌI khái niệm đều có icon, và icon đó CÓ THẬT trong PixelIcon', () => {
    /*
     * ⚠ Bài đắt nhất của cụm: gõ sai tên lưới thì `PixelIcon` không nổ, nó chỉ
     * vẽ ra một ô trống 14px — "cơ chế trang trí" ở dạng khó thấy nhất, vì hàng
     * vẫn có đủ tên và số nên nhìn qua thấy bình thường.
     * Kiểu `PixelIconName` đã chặn ở tsc; bài này chặn thêm ở runtime cho ca
     * lưới bị GỠ khỏi `PixelIcon` mà map ở đây quên sửa.
     */
    const ten = Object.keys(THE_KHOANH_KHAC);
    expect(ten.length, 'tự điển rỗng ⇒ bài này không canh gì').toBeGreaterThan(4);
    for (const id of ten) {
      const icon = (ICON_KHOANH_KHAC as Record<string, string>)[id];
      expect(icon, `${id} chưa có icon`).toBeTruthy();
      const { container, unmount } = render(<PixelIcon name={icon as never} size={14} />);
      // Lưới có thật ⇒ PixelIcon dựng một span con mang danh sách box-shadow.
      const trong = container.querySelector('span > span');
      expect(trong, `lưới \`${icon}\` (${id}) không dựng ra ô nào`).not.toBeNull();
      expect(trong!.getAttribute('style') ?? '', `lưới \`${icon}\` rỗng mực`)
        .toMatch(/box-shadow/);
      unmount();
    }
  });

  it('hàng đầu chở icon + tên + vòng + %, câu KỂ LẠI thu sau dấu (!)', () => {
    /*
     * ⚠ Thu đúng câu HỒI CỐ, KHÔNG thu câu NGOÀI ĐỜI. `ngoai_doi` là phần DẠY —
     * toàn bộ lý do khối này tồn tại (D89 tầng 1: gọi tên mà không kèm nghĩa thì
     * không bắc được cầu nào sang ngoài đời). `hoi_co` thì nói lại vòng và %,
     * hai thứ nay đã nằm trên hàng đầu. Đổi ngược lại là bỏ phần dạy giữ phần lặp.
     */
    const { container } = render(
      <DaCham danhSach={[{ id: 'tin_gia', vong: 6, delta_bp: -3140 }]} />,
    );
    const dau = container.querySelector('li > div');
    expect(dau?.textContent).toMatch(/TIN GIẢ/);
    expect(dau?.textContent, 'thiếu số vòng ở hàng đầu').toMatch(/V6/);
    expect(dau?.textContent, 'thiếu % ở hàng đầu').toMatch(/31,4%/);
    expect(dau?.querySelector('span[style*="width"]'), 'thiếu icon ở hàng đầu')
      .not.toBeNull();

    // Câu NGOÀI ĐỜI ở lại ngoài; câu KỂ LẠI nằm trong <details>.
    const ngoai = container.querySelector('li > p');
    expect(ngoai?.textContent).toMatch(/nghe rất thật/);
    const giai = container.querySelector('li > details');
    expect(giai, 'không có chỗ thu câu kể lại').not.toBeNull();
    expect(giai!.querySelector('p')?.textContent).toMatch(/Vòng 6/);
  });
});
