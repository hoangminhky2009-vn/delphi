/**
 * LẬT & SÁNG THẺ (§XII) — test HÀNH VI, không phải test grep.
 *
 * Cả file `pixelui.test.tsx` cạnh đây quét mã nguồn bằng chuỗi, và với các LUẬT
 * (cấm border-radius, cấm cubic-bezier) thì quét chuỗi là đúng: luật nói về hình
 * dạng của mã. Nhưng "hiệu ứng có thật sự chạy không" thì quét chuỗi trả lời sai
 * được — đã có tiền lệ trong chính phiên này: BetBar `composes` lớp pixel rồi khai
 * lại `transition` ngay dưới, nên grep thấy đủ mọi thứ mà nhịp vẫn là cubic-bezier.
 *
 * Nên bốn test dưới đây RENDER thật rồi đọc `className`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BA THỨ CHÚNG CANH, cả ba đều là lỗi im lặng (build xanh, không có gì động đậy):
 *
 *  1. LỚP PHẢI TỰ GỠ. CSS animation không chạy lại nếu lớp đã sẵn ở đó. Giữ
 *     nguyên `.lat` sau lần lật đầu = lần lật thứ hai IM RU.
 *  2. LẬT CHỈ KHI ĐỔI LÁ, SÁNG CHỈ KHI VỪA CHỌN. Lật một lá đang đứng yên chỉ vì
 *     bị chạm là hoạt hoạ vô cớ; sáng lúc BỎ chọn là phản hồi ngược nghĩa.
 *  3. reduced-motion TẮT HẲN. Đây là hiệu ứng thuần trang trí, không mang thông
 *     tin nào — khác lễ công bố kết quả (cái đó chỉ được rút ngắn, không được nuốt).
 */
import { act, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GameCard } from '@/components/holdem/GameCard';

/** `matchMedia` không tồn tại trong jsdom — `useReducedMotion` sẽ nổ nếu thiếu. */
function datMotion(itMotion: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: itMotion,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

const CHUNG = {
  ten: 'Cổ phiếu',
  mau: ['#67e8f9', '#22d3ee'] as readonly [string, string],
  onToggle: () => {},
};

function lop(el: HTMLElement) {
  return el.querySelector('button')!.className;
}

describe('§XII — lật thẻ khi ô đổi sang lá khác', () => {
  it('render lần đầu KHÔNG lật — vào màn mà mọi lá cùng lật là nhiễu', () => {
    datMotion(false);
    const { container } = render(<GameCard {...CHUNG} id="cp_cn" chon={false} />);
    expect(lop(container)).not.toMatch(/lat/);
  });

  it('đổi id → lật; giữ nguyên id mà bấm chọn → KHÔNG lật', () => {
    datMotion(false);
    const { container, rerender } = render(
      <GameCard {...CHUNG} id="cp_cn" chon={false} />,
    );

    rerender(<GameCard {...CHUNG} id="vang" chon={false} />);
    expect(lop(container), 'đổi lá thì phải lật').toMatch(/lat/);

    // Cùng lá, chỉ đổi trạng thái chọn → không được lật lần nữa.
    const { container: c2, rerender: r2 } = render(
      <GameCard {...CHUNG} id="cp_cn" chon={false} />,
    );
    r2(<GameCard {...CHUNG} id="cp_cn" chon />);
    expect(lop(c2), 'chọn không phải là đổi mặt lá').not.toMatch(/lat/);
  });

  it('lớp lật TỰ GỠ — nếu không, lần lật thứ hai sẽ im ru', () => {
    vi.useFakeTimers();
    datMotion(false);
    const { container, rerender } = render(
      <GameCard {...CHUNG} id="cp_cn" chon={false} />,
    );
    rerender(<GameCard {...CHUNG} id="vang" chon={false} />);
    expect(lop(container)).toMatch(/lat/);

    /* `act` để React flush setState của timer — không có nó thì DOM đứng ở
       khung hình cũ và test này báo lỗi giả. */
    act(() => { vi.advanceTimersByTime(400); });
    expect(lop(container), 'hết 320ms phải sạch lớp').not.toMatch(/lat/);
    vi.useRealTimers();
  });
});

describe('§XII — sáng khi chọn, và luật reduced-motion', () => {
  it('sáng ở nhịp CHỌN, không ở nhịp BỎ chọn', () => {
    /*
     * ⚠ 23/08 — BÀI NÀY ĐỔI THƯỚC, KHÔNG ĐỔI ĐIỀU ĐƯỢC CANH.
     *
     * Trước đây cú loé đi bằng một LỚP RIÊNG (`px.sang`) nên bài đo được bằng
     * tên lớp trên DOM. Chính lớp riêng ấy là bug: nó khai `animation` trên
     * cùng phần tử với `.sel`, và `pixel.module.css` nằm cuối bundle nên nó
     * NUỐT cú rơi-xuống-ô suốt 260ms, rồi lúc bị gỡ thì lá diễn lại từ đầu.
     * Cú loé nay là mắt xích thứ hai của `adChonLa` mà `.sel` composes.
     * ⇒ Vế "chỉ ở nhịp CHỌN" vẫn đo được trên DOM (qua `.sel`); vế "có loé"
     *   phải đo ở NGUỒN, vì vitest không mở `composes` ra thành tên lớp.
     */
    datMotion(false);
    const { container, rerender } = render(
      <GameCard {...CHUNG} id="cp_cn" chon={false} />,
    );
    expect(lop(container), 'chưa chọn thì không mang lớp chọn').not.toMatch(/sel/);
    rerender(<GameCard {...CHUNG} id="cp_cn" chon />);
    expect(lop(container)).toMatch(/sel/);

    const { container: c2, rerender: r2 } = render(
      <GameCard {...CHUNG} id="cp_cn" chon />,
    );
    r2(<GameCard {...CHUNG} id="cp_cn" chon={false} />);
    expect(lop(c2), 'bỏ chọn đã có dấu ✓ tắt đi rồi').not.toMatch(/sel/);
  });

  it('⭐ cú loé nằm CÙNG danh sách `animation` với cú rơi — không phải lớp thứ hai', () => {
    /*
     * Bài đắt nhất của cụm này. Hai khai báo `animation` trên MỘT phần tử không
     * bao giờ hợp nhất — cái đứng sau trong bundle thắng TRỌN. Nên "vừa rơi vừa
     * loé" chỉ đúng khi cả hai nằm trong MỘT danh sách của MỘT rule.
     * Tiêm lỗi để nghiệm thu: tách `adSangLen` ra một lớp riêng ⇒ bài này đỏ.
     */
    const motion = readFileSync(
      resolve(process.cwd(), 'src/styles/motion.module.css'), 'utf8');
    const khoi = /\.adChonLa \{([^}]*)\}/.exec(motion)?.[1] ?? '';
    expect(khoi, 'không tìm thấy `.adChonLa`').not.toBe('');
    expect(khoi, 'thiếu cú RƠI XUỐNG Ô').toMatch(/adChiaXuong/);
    expect(khoi, 'thiếu cú LOÉ SÁNG').toMatch(/adSangLen/);

    // …và `.sel` phải lấy đúng lớp gộp đó.
    const gc = readFileSync(
      resolve(process.cwd(), 'src/components/holdem/GameCard.module.css'), 'utf8');
    expect(/\.sel \{[^}]*composes:[^;]*adChonLa/.test(gc),
      '`.sel` không composes `adChonLa`').toBe(true);

    /*
     * ⚠ Và cấm lớp loé RIÊNG quay lại — đây là hình dạng CHÍNH XÁC của bug cũ,
     * nên khoá theo HÀNH VI (có dán `px.sang` lên lá không) chứ không theo tên
     * biến. Bóc chú thích trước, nếu không bài đỏ vì chính đoạn giải thích.
     */
    const tsx = readFileSync(
      resolve(process.cwd(), 'src/components/holdem/GameCard.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(tsx, '`px.sang` dán lại lên lá ⇒ nó sẽ nuốt `adChonLa`')
      .not.toMatch(/px\.sang/);
  });

  it('reduced-motion → KHÔNG lật, KHÔNG sáng', () => {
    datMotion(true);
    const { container, rerender } = render(
      <GameCard {...CHUNG} id="cp_cn" chon={false} />,
    );
    rerender(<GameCard {...CHUNG} id="vang" chon />);
    const c = lop(container);
    expect(c).not.toMatch(/lat/);
    expect(c).not.toMatch(/sang/);
  });
});

/*
 * TRẠNG THÁI ĐANG CHỌN KHÔNG ĐƯỢC CHẠY HOẠT ẢNH VÔ HẠN.
 *
 * ⚠ Founder 12/08: *"bỏ luôn cái hiệu ứng giật khi hủy chọn bài đi"*. Gốc: `.sel`
 * dùng `adLoLung` — lơ lửng vô hạn — nên lúc gỡ class, transform đang ở giữa chu
 * kỳ và BÚNG về gốc. Mắt đọc cú búng đó là "app lỗi".
 * Luật rút ra, và đây là thứ bài này canh: hoạt ảnh gắn vào một TRẠNG THÁI có
 * thể bị gỡ thì phải KẾT THÚC ở đúng transform gốc — tức chạy một lần, không lặp.
 */
describe('.sel — chọn bài không được lơ lửng vô hạn', () => {
  const css = readFileSync(
    resolve(process.cwd(), 'src/components/holdem/GameCard.module.css'), 'utf8',
  );

  it('⭐ .sel không composes một hoạt ảnh lặp vô hạn', () => {
    const khoi = /\.sel\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(khoi, 'không tìm thấy khối .sel').not.toBe('');
    expect(khoi, '.sel đang dùng adLoLung — nó lặp vô hạn nên gỡ class là giật')
      .not.toMatch(/adLoLung/);
  });

  it('reduced-motion ép .sel về trạng thái cuối (không thì lá chọn tàng hình)', () => {
    const rm = css.slice(css.indexOf('prefers-reduced-motion'));
    expect(rm).toMatch(/\.sel\s*\{[^}]*animation:\s*none/);
    expect(rm, 'thiếu opacity/transform ⇒ `both` giữ lá ở khung 0%').toMatch(/opacity:\s*1/);
  });
});
