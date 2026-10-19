/**
 * THẺ KHỐNG ĐỎ + CỌC TÍM ĐÒN BẨY — founder 24/08:
 *   *"Thẻ bài bán khống khi đặt lệnh chip sẽ hiện là màu đỏ"* (chốt: CẢ HAI —
 *   nhuộm khung lá VÀ làm cọc chip rõ hơn);
 *   *"thẻ đòn bẩy khi áp dụng sẽ nhân đôi số chip và lượng được thêm vào nhân
 *   đôi sẽ có màu tím"* (chốt: THÊM CỌC TÍM RIÊNG bên cạnh).
 *
 * ─── HAI ĐIỀU PHẢI HIỂU TRƯỚC KHI SỬA CỤM NÀY ───────────────────────────────
 *
 * (1) CHIP KHỐNG ĐỎ ĐÃ CÓ TỪ TRƯỚC và vẫn chạy — `.khg` đọc `--lose`. Thứ THIẾU
 *     là cả TẤM LÁ: `mau` tra cứng theo id rồi đổ thẳng vào `--bd`/`--gl`, không
 *     một đầu vào trạng thái nào. Nên trước bản này, thứ duy nhất nói "mã này
 *     đang bị khống" là một cọc chip chiếm dưới 2% mặt lá.
 *
 * (2) ⚠⚠ ENGINE KHÔNG NHÂN VỊ THẾ. `engine.ts` nhân phần LÃI/LỖ bp, rồi `nav.ts`
 *     rải khoản đó ĐỀU cho mọi mã đang giữ — mã bị Đòn Bẩy nhắm không lớn gấp
 *     đôi và cũng không nở nhanh hơn mã khác. Vẽ cọc thật gấp đôi là dạy sai về
 *     tài sản (D28 cấm). Cọc RIÊNG đọc ra "thêm SỨC NẶNG", không phải "thêm TÀI
 *     SẢN" — đó là lý do founder chọn phương án này, và là thứ bài §III canh.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CocChip } from '../src/components/holdem/CocChip';
import { GameCard } from '../src/components/holdem/GameCard';

const doc = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const khongChuThich = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const DON_VI = 2500;
const cot = (c: HTMLElement) => [...c.querySelectorAll('[data-coc] > span')];

describe('I. Cọc tím Đòn Bẩy — RIÊNG, không nhân cọc thật', () => {
  it('⭐ không nhắm ⇒ đúng số cột như cũ', () => {
    const { container } = render(
      <CocChip giu={5000} khong={0} cho={[]} donVi={DON_VI} />,
    );
    expect(cot(container).length, 'mọc thêm cột khi chưa ai nhắm').toBe(1);
  });

  it('⭐⭐ có nhắm ⇒ MỌC THÊM một cột, cọc thật KHÔNG đổi số chip', () => {
    /*
     * Đây là bài chịu lực của cả cụm. Nhân đôi cọc thật thì (a) nói sai về tài
     * sản, (b) đụng `TRAN_CHIP = 8` nên phần "gấp đôi" bị cắt cụt im lặng ở đúng
     * người ôm nặng nhất. Cột riêng tránh cả hai.
     */
    const thuong = render(<CocChip giu={5000} khong={0} cho={[]} donVi={DON_VI} />);
    const soChipThat = thuong.container.querySelectorAll('[data-coc] > span > i').length;
    thuong.unmount();

    const { container } = render(
      <CocChip giu={5000} khong={0} cho={[]} donVi={DON_VI} donBay />,
    );
    const cols = cot(container);
    expect(cols.length, 'không mọc cột tím').toBe(2);
    expect(cols[0]!.querySelectorAll('i').length,
      'cọc THẬT bị đổi số chip — nó phải giữ nguyên, cột tím mới là phần khuếch đại')
      .toBe(soChipThat);
  });

  it('cột tím cao BẰNG phần đang phơi ra, và bị kẹp bởi trần chip', () => {
    const { container } = render(
      <CocChip giu={DON_VI * 40} khong={0} cho={[]} donVi={DON_VI} donBay />,
    );
    const cols = cot(container);
    const nThat = cols[0]!.querySelectorAll('i').length;
    const nTim = cols[cols.length - 1]!.querySelectorAll('i').length;
    expect(nThat, 'cọc thật phải chạm trần 8 ở vị thế khổng lồ').toBe(8);
    expect(nTim, 'cột tím vượt trần ⇒ cọc tràn khỏi lá').toBeLessThanOrEqual(8);
  });

  it('⚠ nhãn nói LÃI/LỖ ×2, KHÔNG nói tài sản ×2', () => {
    /*
     * D28: chú thích phải đúng với thứ engine thật sự làm. Engine nhân lãi/lỗ,
     * không nhân vị thế — một nhãn "tài sản ×2" là dạy sai, và sai IM LẶNG vì
     * hình vẽ trông rất thuyết phục.
     */
    const { container } = render(
      <CocChip giu={5000} khong={0} cho={[]} donVi={DON_VI} donBay />,
    );
    const nhan = container.querySelector('[title*="×2"]')?.getAttribute('title') ?? '';
    expect(nhan, 'cột tím không có nhãn giải thích').not.toBe('');
    expect(nhan.toLowerCase(), 'nhãn hàm ý TÀI SẢN nhân đôi — engine không làm thế')
      .toMatch(/lãi|lỗ/);
    expect(nhan.toLowerCase()).not.toMatch(/tài sản|vị thế/);
  });
});

describe('II. Khung lá đỏ khi đang khống', () => {
  const chung = {
    id: 'btc', ten: 'BTC', chon: false, onToggle: () => {},
    mau: ['#fbbf24', 'rgba(251,191,36,.2)'] as const,
  };

  it('⭐ `mauDe` đè `--bd`/`--gl`; không truyền thì giữ màu danh tính', () => {
    const thuong = render(<GameCard {...chung} />);
    const nutT = thuong.container.querySelector('button')!;
    expect(nutT.getAttribute('style')).toContain('#fbbf24');
    thuong.unmount();

    const { container } = render(
      <GameCard {...chung} mauDe={['#f87171', 'rgba(248, 113, 113, .22)'] as const} />,
    );
    const st = container.querySelector('button')!.getAttribute('style') ?? '';
    expect(st, 'màu đè không tới được `--bd`').toContain('#f87171');
    expect(st, 'màu danh tính vẫn còn ⇒ hai màu tranh nhau').not.toContain('#fbbf24');
  });

  it('⚠⚠ màu đè phải đi bằng INLINE, không bằng một lớp CSS', () => {
    /*
     * `--bd`/`--gl` được đặt inline trong GameCard, mà inline THẮNG mọi lớp. Ai
     * đó "dọn cho gọn" bằng cách chuyển sang một lớp `.khong { --bd: … }` sẽ
     * thấy nó THUA im lặng — đúng họ lỗi cascade đã đốt D122 (animation bị lớp
     * khác chiếm), D123 (`.tayHoi` trùng tên) và D126 (`.phu` trùng tên).
     */
    const tsx = khongChuThich(doc('src/components/holdem/GameCard.tsx'));
    expect(tsx, 'GameCard thôi đọc `mauDe`').toMatch(/mauDe\s*\?\?\s*mau/);
    expect(tsx, '`--bd` không còn được đặt inline ⇒ mọi cú đè sẽ thua cascade')
      .toMatch(/\['--bd' as string\]/);
  });

  it('⭐ đỏ của khung LẤY TỪ cùng nguồn với chip khống, không gõ hex thứ hai', () => {
    // Hai đỏ khác nhau trên cùng một lá là thứ không ai báo lỗi mà ai cũng thấy sai.
    const shop = doc('src/components/holdem/ShopManHinh.tsx');
    const css = doc('src/components/holdem/CocChip.module.css');
    const doKhung = /MAU_KHONG = \['(#[0-9a-fA-F]{3,8})'/.exec(shop)?.[1];
    expect(doKhung, 'không tìm thấy MAU_KHONG').toBeTruthy();
    expect(css, `chip khống dùng đỏ khác ${doKhung}`)
      .toMatch(new RegExp(`\\.khg\\s*\\{[^}]*${doKhung}`, 'i'));
  });
});

describe('III. Nối dây ở ShopManHinh', () => {
  const TSX = khongChuThich(doc('src/components/holdem/ShopManHinh.tsx'));

  it('⭐⭐ Đòn Bẩy hỏi ĐÍCH DANH `don_bay`, không đếm cả bảng `gan`', () => {
    /*
     * Bảng `gan` gom MỌI lá `pham_vi: 'tai_san'` (9 lá), nhưng chỉ `don_bay`
     * được engine nhân đôi. Dùng `dichGan.length > 0` là vẽ cọc tím cho một lá
     * không nhân gì — sai IM LẶNG, vì hình vẫn hiện ra rất hợp lý.
     */
    expect(TSX, 'cọc tím đếm cả bảng gan thay vì hỏi đích danh don_bay')
      .toMatch(/donBayNham[\s\S]{0,160}?dichGan\.includes\('don_bay'\)/);
  });

  it('⭐ khung đỏ tính cả cọc đã mở LẪN lệnh đang xếp', () => {
    // Đặt lệnh khống rồi chưa chốt vẫn là "tôi đang cược mã này xuống".
    expect(TSX).toMatch(/dangKhong[\s\S]{0,200}?khong > 0[\s\S]{0,120}?chieu === 'khong'/);
  });

  it("⚠ `dong_khong` KHÔNG nhuộm lá — đó là cú ĐI RA, không phải đang ở trong", () => {
    const khoi = /const dangKhong[\s\S]{0,240}?;/.exec(TSX)?.[0] ?? '';
    expect(khoi, 'không tìm thấy `dangKhong`').not.toBe('');
    expect(khoi, 'cú đóng khống cũng nhuộm lá đỏ ⇒ nói sai trạng thái')
      .not.toMatch(/dong_khong/);
  });
});
