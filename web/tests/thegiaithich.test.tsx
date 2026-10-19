/**
 * MẶT THẺ SẠCH + NÚT (!) — yêu cầu founder 25/07.
 *
 * "đừng cho chú thích ngay trên thẻ bài, hãy cho 1 dấu ! hình tròn ở góc của thẻ
 *  và khi bấm vào thì mới mở phần giải thích. Thẻ bài thuần chỉ có tên và hình ảnh."
 *
 * Test ở đây canh hai chuyện dễ hồi quy nhất:
 *   1. chú thích BÒ TRỞ LẠI lên mặt thẻ (dễ, vì dữ liệu vẫn sẵn trong props);
 *   2. bấm (!) mà MUA luôn lá bài — mất Vốn vì đọc hướng dẫn. Đây là hệ quả của
 *      lồng button trong button, và nó không lộ ra khi click bằng mắt.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GameCard } from '../src/components/holdem/GameCard';
import { TheGiaiThich } from '../src/components/holdem/TheGiaiThich';
import type { TuDienChienThuatDTO, TuDienTaiSanDTO } from '../src/api/holdem';

const MAU = ['#f7931a', 'rgba(247,147,26,.22)'] as const;

describe('GameCard — mặt thẻ chỉ còn tên + tranh', () => {
  it('hiện TÊN, và có dấu (!) khi được truyền onGiaiThich', () => {
    render(
      <GameCard
        id="btc" ten="BTC" en="BITCOIN" svg="<svg/>" mau={MAU}
        chon={false} onToggle={() => {}} onGiaiThich={() => {}}
      />,
    );
    expect(screen.getByText('BTC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giải thích BTC' })).toBeInTheDocument();
  });

  it('KHÔNG có dòng nhãn/sao trên mặt thẻ nữa', () => {
    const { container } = render(
      <GameCard
        id="btc" ten="BTC" svg="<svg/>" mau={MAU}
        chon={false} onToggle={() => {}} onGiaiThich={() => {}}
      />,
    );
    // Dãy sao ★ và nhãn "BIẾN ĐỘNG" là đúng hai thứ đã rời sang tờ giải thích.
    expect(container.textContent).not.toMatch(/★|☆/);
    expect(container.textContent).not.toMatch(/BIẾN ĐỘNG/);
  });

  it('không truyền onGiaiThich thì KHÔNG hiện dấu (!) — không có nút chết', () => {
    render(
      <GameCard id="btc" ten="BTC" svg="<svg/>" mau={MAU} chon={false} onToggle={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: 'Giải thích BTC' })).toBeNull();
  });

  /*
   * 🔴 Bấm (!) KHÔNG được chọn/mua thẻ. Nếu nút (!) nằm LỒNG trong nút chọn thẻ
   * thì click nổi bọt lên và người chơi mất Vốn chỉ vì muốn đọc lá bài làm gì.
   */
  /*
   * 🔴 LỖI HIỂN THỊ FOUNDER BÁO 25/07 — ở màn shop, và đây là nguyên nhân.
   *
   * Bản đầu bọc thẻ + nút (!) vào một `div.khung`. Nhưng `.wrap` là flex item
   * của `.hangThe` (`flex: 1 1 0`) trong `.muc` cao CỨNG 172px, nên `.card` phải
   * là con TRỰC TIẾP để co được trong hàng. Một wrapper không có `flex`/
   * `min-height` chèn vào giữa làm thẻ tính chiều cao theo `aspect-ratio: 3/4`
   * từ chiều rộng → tràn khỏi khung "trọn một khung hình, không cuộn".
   *
   * Test cấu trúc DOM chứ không test pixel: jsdom không layout, nhưng nguyên
   * nhân là CẤU TRÚC — và cấu trúc thì kiểm được.
   */
  it('🔴 nút (!) là SIBLING của thẻ, không có wrapper chèn giữa (lỗi shop 25/07)', () => {
    const { container } = render(
      <GameCard
        id="btc" ten="BTC" svg="<svg/>" mau={MAU}
        chon={false} onToggle={() => {}} onGiaiThich={() => {}}
      />,
    );
    const wrap = container.firstElementChild!;
    const the = container.querySelector('[data-card="btc"]')!;
    const hoi = screen.getByRole('button', { name: 'Giải thích BTC' });

    expect(the.parentElement, 'thẻ KHÔNG còn là con trực tiếp của .wrap').toBe(wrap);
    expect(hoi.parentElement, 'nút (!) phải cùng cấp với thẻ').toBe(wrap);
    // Và không có div bọc nào lọt vào giữa.
    expect([...wrap.children].filter((c) => c.tagName === 'DIV')).toHaveLength(0);
  });

  it('🔴 bấm (!) mở giải thích mà KHÔNG kích hoạt chọn thẻ', () => {
    const onToggle = vi.fn();
    const onGiaiThich = vi.fn();
    render(
      <GameCard
        id="btc" ten="BTC" svg="<svg/>" mau={MAU}
        chon={false} onToggle={onToggle} onGiaiThich={onGiaiThich}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Giải thích BTC' }));
    expect(onGiaiThich).toHaveBeenCalledTimes(1);
    expect(onToggle, 'bấm (!) mà mua luôn lá bài').not.toHaveBeenCalled();
  });
});

const GIAI_DOAN = [
  { id: 'tang', label: 'Tăng', icon: '📈' },
  { id: 'giam', label: 'Giảm', icon: '📉' },
  { id: 'phuc_hoi', label: 'Phục hồi', icon: '🌱' },
];
const SU_KIEN = [
  { id: 'chien_tranh', label: 'Chiến tranh', icon: '⚔' },
  { id: 'bong_bong', label: 'Bong bóng', icon: '🫧' },
];

/*
 * ⚠ TỜ NÀY KHÔNG ĐƯỢC HIỆN CON SỐ.
 *
 * Founder bác bản đầu 25/07: hiện +/- % chính xác cho từng ô ma trận làm game
 * "dễ đoán và nhanh chán" — nó biến trò chơi thành bài toán tra bảng, mà
 * đọc-thị-trường là thứ duy nhất mode này muốn đo (A1).
 */
describe('TheGiaiThich — mô tả khái quát, KHÔNG con số', () => {
  const TS: TuDienTaiSanDTO = {
    mo_ta: 'Tài sản rủi ro nhất bàn, sổ lệnh mỏng nên đám đông làm trượt giá thảm.',
    giai_doan: [['tang', 'rat_tot'], ['giam', 'rat_xau']],
    su_kien: [['chien_tranh', 'xau']],
  };

  function veTaiSan() {
    return render(
      <TheGiaiThich
        ten="BTC" taiSan={TS}
        tenChienThuat={(id) => id}
        giaiDoan={GIAI_DOAN} suKien={SU_KIEN}
        onDong={() => {}}
      />,
    );
  }

  it('hiện mô tả khái quát của lá bài', () => {
    veTaiSan();
    expect(screen.getByText(/sổ lệnh mỏng/)).toBeInTheDocument();
  });

  it('phản ứng theo giai đoạn hiện bằng MỨC, không phải %', () => {
    veTaiSan();
    expect(screen.getByText(/PHẢN ỨNG THEO GIAI ĐOẠN/)).toBeInTheDocument();
    expect(screen.getByText(/rất khoẻ/)).toBeInTheDocument();
    expect(screen.getByText(/rất yếu/)).toBeInTheDocument();
  });

  it('🔴 KHÔNG có phần trăm hay con số bp nào trên tờ', () => {
    const { container } = veTaiSan();
    const txt = container.textContent ?? '';
    expect(txt, 'có dấu % — tờ này phải định tính').not.toMatch(/%/);
    // Không con số ≥2 chữ số (mọi bp đều ≥100 nên đây là lưới bắt rộng).
    expect(txt, 'có con số nhiều chữ số — nghi là bp lọt ra').not.toMatch(/\d{2,}/);
  });

  it('chiến thuật canh nhịp nói HÌNH DẠNG rủi ro, không nói số', () => {
    const CT: TuDienChienThuatDTO = {
      xung_dot: ['luot_song'], cong_huong: [],
      canh_nhip: {
        sau_giai_doan: 'giam',
        trung_khi: ['tang', 'phuc_hoi'],
        truot_nang_hon: true,
      },
    };
    const { container } = render(
      <TheGiaiThich
        ten="Bắt Đáy" chienThuat={CT}
        tenChienThuat={(id) => (id === 'luot_song' ? 'Lướt Sóng' : id)}
        giaiDoan={GIAI_DOAN} suKien={SU_KIEN}
        onDong={() => {}}
      />,
    );
    expect(screen.getByText(/CANH NHỊP/)).toBeInTheDocument();
    expect(screen.getByText(/trả giá nặng hơn/)).toBeInTheDocument();
    // Xung đột hiện TÊN, không phải id thô — id thô thì bằng không giải thích.
    expect(screen.getByText('Lướt Sóng')).toBeInTheDocument();
    expect(container.textContent ?? '').not.toMatch(/%/);
  });

  it('thẻ không có cơ chế nào thì nói thẳng, không để trống lửng lơ', () => {
    render(
      <TheGiaiThich
        ten="Thẻ trơn" chienThuat={{ xung_dot: [], cong_huong: [] }}
        tenChienThuat={(id) => id}
        giaiDoan={GIAI_DOAN} suKien={SU_KIEN}
        onDong={() => {}}
      />,
    );
    expect(screen.getByText(/chưa có cơ chế riêng nào/)).toBeInTheDocument();
  });

  it('Esc đóng tờ — lớp phủ không được bẫy người chơi', () => {
    const onDong = vi.fn();
    render(
      <TheGiaiThich
        ten="BTC" taiSan={TS}
        tenChienThuat={(id) => id}
        giaiDoan={GIAI_DOAN} suKien={SU_KIEN}
        onDong={onDong}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDong).toHaveBeenCalled();
  });
});

/**
 * ── LỆCH PHIÊN BẢN FRONTEND ↔ API ────────────────────────────────────────────
 *
 * Trong dự án này frontend và API deploy bằng HAI LỆNH RIÊNG (`wrangler deploy`
 * lên Cloudflare, `npm run deploy` lên Vercel). Giữa hai lệnh luôn có một quãng
 * frontend mới gặp API cũ; nếu một lệnh trượt thì quãng đó là VĨNH VIỄN. Nên
 * "payload thiếu/khác hình dạng" là trạng thái BÌNH THƯỜNG, không phải sự cố.
 *
 * Gặp thật 25/07/2026 khi mở bàn đấu trên stack local: frontend đã có tờ từ điển
 * mà API chưa gửi `tu_dien` → `MUC[muc]` ra undefined → ném lỗi → ErrorBoundary
 * của router ăn trọn màn hình, NGƯỜI CHƠI MẤT CẢ TRẬN ĐANG CHƠI. Một tooltip từ
 * điển không được phép hạ thứ đang chơi.
 *
 * ⚠ 11 test phía trên KHÔNG bắt được lỗi này, vì chúng nạp prop do tôi tự dựng
 * đúng hình dạng. Đó là giới hạn của fixture viết tay: nó kiểm logic, không kiểm
 * hợp đồng với server thật.
 */
describe('TheGiaiThich — chịu được payload lệch phiên bản, không sập', () => {
  const rong = { giai_doan: [], su_kien: [] } as unknown as TuDienTaiSanDTO;

  it('mức NGOÀI thang 5 bậc → bỏ dòng đó, KHÔNG ném lỗi', () => {
    const la = {
      mo_ta: 'Mô tả nào đó.',
      // 'sieu_tot' là bậc API bản sau thêm mà frontend này chưa biết.
      giai_doan: [['tang', 'sieu_tot'], ['giam', 'tot']],
      su_kien: [],
    } as unknown as TuDienTaiSanDTO;
    render(
      <TheGiaiThich
        ten="Vàng" taiSan={la} tenChienThuat={(x) => x}
        giaiDoan={[{ id: 'tang', label: 'Tăng', icon: '📈' },
          { id: 'giam', label: 'Giảm', icon: '📉' }]}
        suKien={[]} onDong={() => {}}
      />,
    );
    // Bậc lạ bị bỏ, bậc hợp lệ vẫn hiện → tờ giải thích còn dùng được một nửa,
    // thay vì mất cả bàn đấu.
    expect(screen.getByText(/khoẻ/)).toBeInTheDocument();
    expect(screen.queryByText(/sieu_tot/)).not.toBeInTheDocument();
  });

  it('cặp KHÔNG phải cặp (API cũ trả mảng phẳng) → không ném lỗi', () => {
    const la = {
      mo_ta: 'x',
      giai_doan: ['tang', 'giam'],  // hình dạng cũ: mảng id phẳng, không có mức
      su_kien: null,
    } as unknown as TuDienTaiSanDTO;
    expect(() => render(
      <TheGiaiThich
        ten="Vàng" taiSan={la} tenChienThuat={(x) => x}
        giaiDoan={[]} suKien={[]} onDong={() => {}}
      />,
    )).not.toThrow();
    // Không có dòng mức nào vẽ được → phải nói ra, không để trống lặng lẽ.
    expect(screen.getByText(/Không đổi theo giai đoạn/)).toBeInTheDocument();
  });

  it('thẻ chiến thuật THIẾU xung_dot/cong_huong → không ném lỗi', () => {
    const ct = { su_kien: undefined } as unknown as TuDienChienThuatDTO;
    expect(() => render(
      <TheGiaiThich
        ten="Đòn bẩy" moTa="Nhân đôi." chienThuat={ct} tenChienThuat={(x) => x}
        giaiDoan={[]} suKien={[]} onDong={() => {}}
      />,
    )).not.toThrow();
    expect(screen.getByText(/chưa có cơ chế riêng nào/)).toBeInTheDocument();
  });

  it('tài sản rỗng hoàn toàn → vẫn mở được tờ, vẫn đóng được', () => {
    const dong = vi.fn();
    render(
      <TheGiaiThich
        ten="Vàng" taiSan={rong} tenChienThuat={(x) => x}
        giaiDoan={[]} suKien={[]} onDong={dong}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(dong).toHaveBeenCalled();
  });
});
