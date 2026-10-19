/**
 * THANH PHONG CÁCH — phần NHÌN THẤY ĐƯỢC.
 *
 * ⚠ Ba tính chất bị khoá ở đây, và cả ba đều là chỗ dễ trôi khi ai đó "làm cho
 * đẹp hơn":
 *   §I  trong trận CHỈ MỘT thanh — ba trục không được rò ra màn trận (founder:
 *       *"kết trận thì ở menu kết thúc mới khoe mấy chỉ số kia cụ thể để flex"*);
 *   §II hiệu ứng chỉ dùng `transform`/`opacity` — tập giao của web · Discord
 *       Activity · bản native sau này;
 *   §III `prefers-reduced-motion` tắt CHUYỂN ĐỘNG chứ không tắt THÔNG TIN.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import {
  HANG_CHUA_XEP, ThanhPhongCach, bacCua, thanhPhongCachCua,
} from '../src/components/holdem/ThanhPhongCach';
import { PhongCachKet } from '../src/components/holdem/PhongCachKet';

describe('I. Thanh trong trận — MỘT thanh, không rò ba trục', () => {
  it('vẽ hạng bằng GLYPH PIXEL (không phải text), và KHÔNG rò chữ nào của ba trục', () => {
    const { container } = render(
      <ThanhPhongCach pc={{ diem: 620, hang: 'B+', streak: 0 }} />,
    );
    /*
     * ⭐ 23/08 — hạng thôi là text font hệ thống (founder: *"thanh đó bây giờ
     * vẫn đang dùng text đểu đó"*). Hạng nay đọc được ở HAI đường, và bài này
     * khoá cả hai vì mỗi đường phục vụ một loại người dùng:
     * · `aria-label` — người bật trình đọc màn hình;
     * · glyph pixel — người nhìn.
     * Một chữ 'B+' bằng text KHÔNG được phép quay lại: đó là §XI ("chữ là VẬT",
     * vật do font hệ điều hành vẽ thì không phải vật của mình).
     */
    expect(screen.getByLabelText(/hạng B\+/i)).toBeInTheDocument();
    // D443 — chữ hạng đi bằng FONT APP (Handjet), một font cho cả màn (founder 28/09 "phải đồng bộ font chữ"); từng
    // ký tự vẫn một ô `--i` để cú đóng dấu lệch nhịp. `aria-hidden` trên từng ô: trình đọc màn hình đọc nhãn khối.
    expect(container.textContent).toContain('B+');
    // Hai glyph ('B' và '+'), mỗi cái một pha riêng để cú đóng dấu lệch nhịp.
    const glyph = [...container.querySelectorAll('span')]
      .filter((e) => e.style.getPropertyValue('--i') !== '');
    expect(glyph).toHaveLength(2);
    expect(glyph.map((e) => e.style.getPropertyValue('--i'))).toEqual(['0', '1']);
    expect(glyph.map((e) => e.textContent)).toEqual(['B', '+']);
    expect(glyph.every((e) => e.getAttribute('aria-hidden') === 'true')).toBe(true);

    const chu = container.textContent ?? '';
    for (const cam of ['ĐỌC', 'THẮNG CHỢ', 'TRỤ']) expect(chu).not.toContain(cam);
  });

  it('D400 — dấu chuỗi "×N" đã gỡ (founder 23/09: "bỏ chỗ x2 kia đi, sau này t sẽ thay bằng lửa monument")', () => {
    const { container, rerender } = render(
      <ThanhPhongCach pc={{ diem: 500, hang: 'B-', streak: 1 }} />,
    );
    expect(container.querySelector('[aria-label^="chuỗi"]')).toBeNull();
    // Ca từng hiện dấu (chuỗi ≥ 2) — nay cũng không: chỗ ấy để dành cho lửa momentum.
    rerender(<ThanhPhongCach pc={{ diem: 500, hang: 'B-', streak: 3 }} />);
    expect(container.querySelector('[aria-label^="chuỗi"]')).toBeNull();
    expect(screen.queryByLabelText('chuỗi 3')).toBeNull();
  });

  it('⭐ mực thanh KHÔNG đi bằng `width`, và mang trọn DẢI MÀU của thang', () => {
    /*
     * ⚠ 24/08 ĐỔI THƯỚC, KHÔNG ĐỔI ĐIỀU ĐƯỢC CANH. Điều được canh vẫn là "đừng
     * dùng `width`" (nó bắt tính lại bố cục mỗi khấc). Thứ đổi là cách đạt:
     * `scaleX` KÉO GIÃN nền, mà nền nay là cả dải bảy chặng — mực 25% sẽ nén đủ
     * bảy màu vào một phần tư thanh, tức khoe vàng SSS cho một người 250 điểm.
     * `clip-path: inset()` CẮT chứ không kéo, nên dải luôn neo đúng thang 0→1000
     * và mép dẫn đầu đúng là màu của bậc đang đứng.
     */
    const { container } = render(
      <ThanhPhongCach pc={{ diem: 250, hang: 'D', streak: 0 }} />,
    );
    const day = container.querySelector('[class*="day"]') as HTMLElement;
    expect(day.style.clipPath, 'mực 25% phải cắt đi 75% bên phải')
      .toMatch(/inset\(\s*0(?:px)?\s+75(\.0+)?%/);
    expect(day.style.width, '`width` bắt tính lại bố cục mỗi khấc').toBe('');
    expect(day.style.transform, '`scaleX` sẽ kéo giãn dải màu').toBe('');

    // …và dải phải là GRADIENT nhiều chặng, không phải một màu phẳng.
    const khoi = container.querySelector('[class*="khoi"]') as HTMLElement;
    const dai = khoi.style.getPropertyValue('--pc-dai');
    expect(dai, 'thiếu dải màu').toMatch(/linear-gradient/);
    expect((dai.match(/rgb\(/g) ?? []).length, 'dải phải có nhiều hơn hai chặng')
      .toBeGreaterThan(4);
  });

  it('điểm ngoài dải vẫn kẹp về 0..1 (không vẽ thanh tràn hoặc âm)', () => {
    /*
     * ⚠ Hai lần RENDER RIÊNG, không `rerender`: từ 23/08 điểm bò tuyến tính qua
     * `useDiemChay`, nên rerender sang một mức khác thì thanh đang Ở GIỮA đường
     * chứ chưa tới đích — đo lúc đó là đo một khung hình của hoạt ảnh, không
     * phải đo phép kẹp. Lúc MOUNT thì hook nhận thẳng giá trị đích.
     */
    const a = render(<ThanhPhongCach pc={{ diem: 99_999, hang: 'SSS', streak: 0 }} />);
    expect((a.container.querySelector('[class*="day"]') as HTMLElement).style.clipPath,
      'điểm vượt trần phải lấp ĐẦY, không tràn')
      .toMatch(/inset\(\s*0(?:px)?\s+0(\.0+)?%/);
    a.unmount();
    const b = render(<ThanhPhongCach pc={{ diem: -50, hang: 'E-', streak: 0 }} />);
    expect((b.container.querySelector('[class*="day"]') as HTMLElement).style.clipPath,
      'điểm âm phải lấp RỖNG, không vẽ ngược')
      .toMatch(/inset\(\s*0(?:px)?\s+100(\.0+)?%/);
  });

  it('hạng luôn đọc được bằng trình đọc màn hình', () => {
    render(<ThanhPhongCach pc={{ diem: 940, hang: 'SS', streak: 0 }} />);
    expect(screen.getByLabelText(/hạng SS/i)).toBeInTheDocument();
  });

  it('bacCua gom 20 hạng thành 5 bậc màu, SS và SSS cùng bậc tối thượng', () => {
    expect(bacCua('E-')).toBe('thap');
    expect(bacCua('D+')).toBe('giua');
    expect(bacCua('B')).toBe('kha');
    expect(bacCua('A+')).toBe('kha');
    expect(bacCua('S-')).toBe('sieu');
    expect(bacCua('SS')).toBe('toi_thuong');
    expect(bacCua('SSS')).toBe('toi_thuong');
  });
});

describe('I-b. ⭐ D343 — CHƯA ĐỦ VÒNG: hiện từ đầu, xám, dấu ?', () => {
  /*
   * Founder 16/09: *"ít nhất bạn phải cho nó hiện ngay từ đầu nhưng màu xám vì chưa quyết
   * định điểm, thanh vẫn chạy/ được chấm bình thường nhưng màu nhạt và điểm là dấu '?'"*.
   * Trước bản này thanh VẮNG tới vòng 4 (D337) rồi bật ra đẩy cả khung NAV xuống.
   */
  const xam = () => render(<ThanhPhongCach pc={{ diem: 950, streak: 3 }} chuaXep />);

  it('hạng là MỘT glyph pixel `?` — không suy từ điểm, kể cả điểm tạm cao cỡ SSS', () => {
    const { container } = xam();
    const khoi = container.querySelector('[class*="khoi"]') as HTMLElement;
    expect(khoi.dataset.hang).toBe(HANG_CHUA_XEP);
    // D443 — ô hạng là chữ font app: `?` đọc được thẳng trong ô, không còn phụ thuộc lưới `ChuPixel`.
    // Chỉ đếm trong Ô HẠNG — chuỗi `×3` bên phải cũng là glyph pixel.
    const oHang = container.querySelector('[class*="hang"]') as HTMLElement;
    const glyph = [...oHang.querySelectorAll('span')]
      .filter((e) => e.style.getPropertyValue('--i') !== '');
    expect(glyph, 'ô hạng phải vẽ đúng một ký tự `?`').toHaveLength(1);
    expect(glyph[0]!.textContent).toBe('?');
    expect(screen.getByLabelText(/chưa đủ vòng/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/hạng SSS/i), 'điểm tạm không được lộ ra thành hạng').toBeNull();
  });

  it('không kim loại / lửa / cầu vồng / quầng khi chưa xếp — dù điểm tạm cao', () => {
    const { container } = xam();
    const khoi = container.querySelector('[class*="khoi"]') as HTMLElement;
    expect(khoi.dataset.fx).toBe('thuong');
    expect(container.querySelector('[class*="fx"]:not([class*="khoi"])')).toBeNull();
    expect(container.querySelector('[class*="quang"]')).toBeNull();
    expect(khoi.className).toMatch(/chuaXep/);
  });

  it('thanh VẪN chạy theo điểm tạm tính, màu do lớp xám quyết (không biến màu inline)', () => {
    const { container } = xam();
    const day = container.querySelector('[class*="day"]') as HTMLElement;
    expect(day.style.clipPath, 'mực 95% phải cắt 5%').toMatch(/inset\(\s*0(?:px)?\s+5(\.0+)?%/);
    const khoi = container.querySelector('[class*="khoi"]') as HTMLElement;
    // Biến inline thắng mọi lớp — đặt `--pc-mau` inline là lớp `.chuaXep` không đổi được màu.
    expect(khoi.style.getPropertyValue('--pc-mau')).toBe('');
    // D400 — dấu chuỗi "×N" đã gỡ ở MỌI trạng thái (chờ lửa momentum), kể cả lúc xám.
    expect(screen.queryByLabelText('chuỗi 3')).toBeNull();
  });

  it('`thanhPhongCachCua`: đủ vòng thắng · tạm tính ⇒ xám · không khối nào ⇒ không thanh', () => {
    const that = { diem: 700, hang: 'B+', streak: 1 };
    const tam = { diem: 420, streak: 0 };
    expect(thanhPhongCachCua({ phong_cach: that })).toEqual({ pc: that, chuaXep: false });
    expect(thanhPhongCachCua({ phong_cach_tam_tinh: tam })).toEqual({ pc: tam, chuaXep: true });
    expect(thanhPhongCachCua({ phong_cach: that, phong_cach_tam_tinh: tam })?.chuaXep).toBe(false);
    expect(thanhPhongCachCua({})).toBeNull();
  });

  it('⭐ màn trận vẽ thanh qua `thanhPhongCachCua` — không quay lại điều kiện `st.phong_cach &&`', () => {
    /*
     * Hồi quy đã có thật: điều kiện cũ chỉ đọc `st.phong_cach`, nên suốt 3 vòng đầu khung
     * NAV không có thanh. Đọc mã nguồn (bỏ chú thích) vì dựng cả `AlphaDraftMatch` trong
     * jsdom là dựng cả trận.
     */
    const ma = readFileSync('src/screens/holdem/AlphaDraftMatch.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    // D398 — đọc ẢNH GIỮ tới bước PHONG CÁCH của nhịp kết quả (`stPc`), rơi về `st` ngoài nhịp.
    expect(ma).toMatch(/thanhPhongCachCua\((stPc \?\? )?st\)/);
    expect(ma).toMatch(/<ThanhPhongCach[^>]*chuaXep=\{/);
    expect(ma, 'thanh lại chỉ hiện khi đủ vòng').not.toMatch(/st\.phong_cach\s*&&\s*\(/);
  });

  it('CSS: xám CÔNG NĂNG (không phải xám thép của hạng E), mực phẳng nhạt', () => {
    const code = readFileSync('src/components/holdem/ThanhPhongCach.module.css', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).toMatch(/\.chuaXep\s*\{\s*--pc-mau:\s*var\(--text-muted\)/);
    const than = /\.chuaXep \.day \{([^}]*)\}/.exec(code)?.[1] ?? '';
    expect(than, 'mực xám phải PHẲNG — dải màu là con đường lên SSS').toMatch(/background:\s*var\(--pc-mau\)/);
    expect(Number(/opacity:\s*([\d.]+)/.exec(than)?.[1]), 'mực xám phải NHẠT').toBeLessThan(0.6);
  });
});

describe('II. Màn kết — chỗ DUY NHẤT banh ba trục', () => {
  const PC = {
    diem: 880, hang: 'S+', streak: 0, streak_dai_nhat: 4,
    ba_truc: { doc: 0.82, thang_cho: 0.61, tru: 1 },
  };

  it('hiện hạng to + ba trục + chuỗi dài nhất', () => {
    render(<PhongCachKet pc={PC} />);
    expect(screen.getByLabelText(/Hạng S\+/)).toBeInTheDocument();
    expect(screen.getByText('ĐỌC')).toBeInTheDocument();
    expect(screen.getByText('THẮNG CHỢ')).toBeInTheDocument();
    expect(screen.getByText('TRỤ')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText(/×4/)).toBeInTheDocument();
  });

  it('⚠ trục KHÔNG ĐO ĐƯỢC hiện dấu gạch, KHÔNG hiện 0% (D62: null ≠ 0)', () => {
    render(<PhongCachKet pc={{ ...PC, ba_truc: { ...PC.ba_truc, doc: null } }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('chuỗi dài 1 thì không khoe', () => {
    const { container } = render(<PhongCachKet pc={{ ...PC, streak_dai_nhat: 1 }} />);
    expect(container.textContent).not.toContain('chuỗi dài nhất');
  });
});

describe('III. ⭐ Ràng buộc BA MẶT — web · Discord Activity · native', () => {
  const css = [
    readFileSync('src/components/holdem/ThanhPhongCach.module.css', 'utf8'),
    readFileSync('src/components/holdem/PhongCachKet.module.css', 'utf8'),
  ].join('\n');
  /** Bỏ chú thích trước khi quét — chính chú thích NÓI VỀ các thuộc tính bị
   *  cấm để giải thích vì sao không dùng; quét thô là báo động giả (D79). */
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('keyframes CHỈ đụng transform và opacity', () => {
    /*
     * ⚠⚠ BÀI NÀY TỪNG RỖNG HOÀN TOÀN, VÀ RỖNG TỪ ĐẦU (phát hiện 01/09).
     *
     * Bản cũ trích thuộc tính bằng `/^\s*([a-z-]+)\s*:/gm` — neo vào ĐẦU DÒNG.
     * Nhưng CSS keyframes của repo viết gọn một dòng:
     *     0%   { transform: translateX(-66%); }
     *     from { transform: translateX(0); }
     * nên đầu dòng là `0%` / `from {`, không phải tên thuộc tính ⇒ regex khớp
     * **0 lần** ⇒ vòng lặp chạy 0 vòng ⇒ dòng `expect` bên trong **chưa từng
     * chạy một lần nào**. Bài xanh, nằm đây, và canh đúng con số không.
     *
     * Nó canh A11.18 — luật VFX founder đặt 30/08. Suốt thời gian đó, thêm một
     * `filter:` vào bất kỳ keyframe nào cũng không ai bắt được.
     *
     * ⚠ ĐO LÚC SỬA: CSS vốn VẪN tuân luật (32 `transform` + 12 `opacity`, không
     * có gì khác) — nên không có lỗi sản phẩm nào đi kèm. Cái hỏng là hàng rào,
     * không phải thứ nó canh. Ghi ra để người sau đừng đi tìm một lỗi không có.
     *
     * ⭐ HAI DÒNG ĐẾM DƯỚI ĐÂY LÀ PHẦN QUAN TRỌNG NHẤT của bài, hơn cả phép so
     * sánh: một bài "cấm X" mà quét trúng 0 thứ thì luôn xanh, và không có cách
     * nào nhìn ra từ kết quả chạy. Có đếm thì lần sau CSS đổi cách viết, bài đỏ
     * ngay thay vì lặng lẽ ngừng canh.
     */
    const khoi = [...code.matchAll(/@keyframes[^{]*\{([\s\S]*?)\n\}/g)];
    expect(khoi.length, 'không quét được @keyframes nào — regex khối đã trôi')
      .toBeGreaterThan(0);

    // Bắt cả khai báo nằm SAU `{` hoặc `;`, không chỉ khai báo ở đầu dòng.
    const thuocTinh = khoi.flatMap((kf) => [
      ...(kf[1] ?? '').matchAll(/(?:^|[{;])\s*([a-z-]+)\s*:/g),
    ].map((m) => m[1]!));
    expect(thuocTinh.length, 'không trích được thuộc tính nào — regex khai báo đã trôi')
      .toBeGreaterThan(0);

    for (const t of thuocTinh) expect(['transform', 'opacity']).toContain(t);
  });

  it('KHÔNG dùng filter / box-shadow / backdrop-filter (native không map được)', () => {
    for (const cam of ['filter:', 'box-shadow:', 'backdrop-filter:']) {
      expect(code).not.toContain(cam);
    }
  });

  it('§XI pixel: không bo góc', () => {
    expect(code).not.toMatch(/border-radius:\s*(?!0)/);
  });

  it('⭐ prefers-reduced-motion tắt CHUYỂN ĐỘNG, không tắt THÔNG TIN', () => {
    const khoi = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g;
    const tat = [...code.matchAll(khoi)].map((m) => m[1] ?? '').join('\n');
    expect(tat).toContain('animation: none');
    // Không được giấu hạng đi: `display:none`/`visibility:hidden` ở đây nghĩa là
    // người bật tiết kiệm chuyển động mất luôn thứ thanh sinh ra để nói.
    expect(tat).not.toContain('display: none');
    expect(tat).not.toContain('visibility: hidden');
  });

  it('có nhánh MÀN NGANG cho Discord Activity trên desktop', () => {
    expect(code).toMatch(/@media \(min-width: \d+px\)/);
  });
});
