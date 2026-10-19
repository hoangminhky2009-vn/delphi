/**
 * THANH PHONG CÁCH CHẠY TUYẾN TÍNH — founder 23/08: *"thêm hiệu ứng tăng/giảm
 * tuyến tính chứ đ** phải sau 1 mỗi round nhảy tót lên xếp hạng mới, cho hiệu
 * ứng đổi từ E>D>C>...>SSS mượt vào"*.
 *
 * Bài này khoá thứ mà `phong_cach_ui.test.tsx` KHÔNG với tới: ở đó mọi phép đo
 * làm lúc MOUNT (điểm nhận thẳng giá trị đích), nên gỡ sạch bộ chạy đi thì cả
 * 14 bài kia vẫn xanh. Chỗ duy nhất bộ chạy lộ ra là quãng GIỮA hai mức.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { ThanhPhongCach } from '@/components/holdem/ThanhPhongCach';
import { mauTheoDiem, bacHieuUng, MOC_MANH } from '@/components/holdem/mau_hang';
import { hangCua, THANG } from '@server/holdem/phong_cach';
import { NHIP } from '@/lib/nhip';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/*
 * TỶ LỆ MỰC — đọc từ `clip-path: inset(0 X% 0 0)`.
 * ⚠ 24/08 ĐỔI THƯỚC, KHÔNG ĐỔI ĐIỀU ĐƯỢC CANH: mực thôi đi bằng `scaleX` vì nền
 * nay là cả DẢI MÀU của thang, mà `scaleX` KÉO GIÃN nền — mực 40% sẽ hiện đủ
 * bảy màu, tức thanh khoe vàng SSS cho một người 400 điểm. `inset()` cắt chứ
 * không kéo. Vế "tỷ lệ đúng" và vế "KHÔNG đi bằng `width`" vẫn nguyên.
 */
const lap = (c: HTMLElement) => {
  const d = c.querySelector('[class*="day"]') as HTMLElement;
  const m = /inset\(\s*0(?:px)?\s+([\d.]+)%/.exec(d.style.clipPath);
  return m ? Number((1 - Number(m[1]) / 100).toFixed(4)) : -1;
};
const hangHien = (c: HTMLElement) =>
  (c.querySelector('[class*="khoi"]') as HTMLElement).dataset.hang;

describe('I. Điểm bò tuyến tính, không nhảy tót', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('⭐ đi qua các mức TRUNG GIAN chứ không nhảy thẳng tới đích', () => {
    const { container, rerender } = render(
      <ThanhPhongCach pc={{ diem: 100, hang: 'E+', streak: 0 }} />,
    );
    expect(lap(container)).toBeCloseTo(0.1, 3);

    rerender(<ThanhPhongCach pc={{ diem: 900, hang: 'S+', streak: 0 }} />);

    // Ngay sau khi đổi đích: CHƯA tới nơi. Đây là vế bộ chạy tồn tại để làm.
    act(() => { vi.advanceTimersByTime(150); });
    const giua = lap(container);
    expect(giua).toBeGreaterThan(0.1);
    expect(giua).toBeLessThan(0.9);

    // Và nó vẫn về đúng đích khi chạy hết.
    act(() => { vi.advanceTimersByTime(2000); });
    expect(lap(container)).toBeCloseTo(0.9, 3);
  });

  it('⭐ HẠNG đổi lần lượt theo điểm đang chạy, không nhảy một phát', () => {
    const { container, rerender } = render(
      <ThanhPhongCach pc={{ diem: 60, hang: 'E', streak: 0 }} />,
    );
    rerender(<ThanhPhongCach pc={{ diem: 990, hang: 'SSS', streak: 0 }} />);

    const thay = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      act(() => { vi.advanceTimersByTime(30); });
      const h = hangHien(container);
      if (h) thay.add(h);
    }
    // Phải bắt được ít nhất một bậc GIỮA E và SSS — nếu chỉ có hai giá trị thì
    // thanh đang nhảy tót, đúng thứ founder bác.
    expect(thay.size).toBeGreaterThan(3);
    expect(hangHien(container)).toBe('SSS');
  });

  it('⭐ BẬC HIỆU ỨNG bám điểm đang chạy — bắt lửa giữa đường, không đợi tới đích', () => {
    const { container, rerender } = render(
      <ThanhPhongCach pc={{ diem: 300, hang: 'C-', streak: 0 }} />,
    );
    rerender(<ThanhPhongCach pc={{ diem: 990, hang: 'SSS', streak: 0 }} />);

    const thay = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      act(() => { vi.advanceTimersByTime(30); });
      const fx = (container.querySelector('[class*="khoi"]') as HTMLElement).dataset.fx;
      if (fx) thay.add(fx);
    }
    // Đi từ C- lên SSS thì phải đi QUA vùng kim loại và vùng cháy.
    expect(thay.has('kim_loai')).toBe(true);
    expect(thay.has('chay')).toBe(true);
    expect(thay.has('cau_vong')).toBe(true);
  });

  it('⭐ TỤT hạng có nhịp RIÊNG, không dùng lại nhịp lên', () => {
    /*
     * Đo trên trận thật 23/08: ngồi im cả trận thì điểm đi 974 → 734 → 593 →
     * 494 → 429 → 384, tức TỤT là đường đi thường gặp chứ không phải ca hiếm.
     * Tra cứu DMC: trong game "trôi vì hết giờ" và "giật vì ăn đòn" là HAI hình
     * thức khác hẳn nhau; gộp chúng lại thì người chơi không phân biệt được
     * "tôi chậm" với "tôi vừa bị phạt". Ở ta: lên = đóng dấu, tụt = giật + xỉu.
     */
    const { container, rerender } = render(
      <ThanhPhongCach pc={{ diem: 974, hang: 'SSS', streak: 0 }} />,
    );
    const khoi = () => container.querySelector('[class*="khoi"]') as HTMLElement;
    rerender(<ThanhPhongCach pc={{ diem: 400, hang: 'C-', streak: 0 }} />);

    const lop = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      act(() => { vi.advanceTimersByTime(30); });
      for (const c of khoi().className.split(/\s+/)) lop.add(c);
    }
    const co = (ten: string) => [...lop].some((c) => c.includes(ten));
    expect(co('tut')).toBe(true);
    expect(co('lenNhe')).toBe(false);
    expect(co('lenManh')).toBe(false);
  });

  it('tiết kiệm chuyển động: nhận thẳng đích, không bò', () => {
    const goc = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q, onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      const { container, rerender } = render(
        <ThanhPhongCach pc={{ diem: 100, hang: 'E+', streak: 0 }} />,
      );
      rerender(<ThanhPhongCach pc={{ diem: 900, hang: 'S+', streak: 0 }} />);
      act(() => { vi.advanceTimersByTime(0); });
      expect(lap(container)).toBeCloseTo(0.9, 3);
    } finally {
      window.matchMedia = goc;
    }
  });
});

describe('II. Cường độ cháy phải TĂNG THẬT qua ba bậc', () => {
  const css = readFileSync(
    join(process.cwd(), 'src/components/holdem/ThanhPhongCach.module.css'),
    'utf8',
  );
  /** Cắt lấy thân khối `.<lop> .quang { … }` trong chính mã nguồn CSS. */
  const than = (lop: string) => {
    const re = new RegExp(String.raw`\.${lop} \.quang \{([^}]*)\}`);
    return re.exec(css)?.[1] ?? '';
  };
  const bien = (lop: string, ten: string) => {
    const re = new RegExp(String.raw`--pc-quang-${ten}:\s*([\d.]+)`);
    return Number(re.exec(than(lop))?.[1] ?? 'NaN');
  };
  const nhip = (lop: string) => Number(/pcTho (\d+)ms/.exec(than(lop))?.[1] ?? 'NaN');

  it('⭐ quầng đậm dần và thở nhanh dần: chay < chay_manh < cau_vong', () => {
    // Founder: *"từ S trở đi thanh sẽ cháy và SS thì TĂNG CƯỜNG ĐỘ CHÁY"*.
    for (const t of ['min', 'max'] as const) {
      expect(bien('fx_chay', t)).toBeLessThan(bien('fx_chay_manh', t));
      expect(bien('fx_chay_manh', t)).toBeLessThan(bien('fx_cau_vong', t));
    }
    expect(nhip('fx_chay')).toBeGreaterThan(nhip('fx_chay_manh'));
    expect(nhip('fx_chay_manh')).toBeGreaterThan(nhip('fx_cau_vong'));
  });

  it('⚠ không lớp cháy nào đặt `opacity` TĨNH cạnh `pcTho` — keyframe sẽ đè nó', () => {
    /*
     * Bẫy đã dính một lần, và trình duyệt mới lộ: đặt `opacity: .22` rồi cho
     * chạy `pcTho` (keyframe có đụng `opacity`) thì giá trị tĩnh bị ĐÈ, ba bậc
     * thở y hệt nhau, và "tăng cường độ" chạy mà không tồn tại. Bài trên đo
     * BIẾN nên vẫn xanh trong ca đó — bài này mới bắt được cách hỏng thật.
     */
    for (const lop of ['fx_chay', 'fx_chay_manh', 'fx_cau_vong']) {
      expect(than(lop)).toContain('pcTho');
      expect(than(lop)).not.toMatch(/(^|[^-])opacity:/);
    }
  });

  it('tiết kiệm chuyển động vẫn giữ được QUẦNG (tắt thở, không tắt lửa)', () => {
    const tat = /@media \(prefers-reduced-motion: reduce\)([\s\S]*)$/.exec(css)?.[1] ?? '';
    expect(tat).toMatch(/\.fx_chay \.quang \{ opacity: [\d.]+; \}/);
    expect(tat).toMatch(/\.fx_cau_vong \.quang \{ opacity: [\d.]+; \}/);
  });
});

describe('III. Thang màu liên tục', () => {
  it('⭐ đổi màu TRONG LÒNG một bậc — hai mức cùng hạng chữ cái vẫn khác màu', () => {
    // `C-` và `C+` cùng chữ C. Bản 5-bậc-màu cũ cho chúng CÙNG một màu; đó là
    // thứ founder bảo phải hết.
    const a = mauTheoDiem(360);
    const b = mauTheoDiem(500);
    expect(hangCua(360)[0]).toBe('C');
    expect(hangCua(500)[0]).toBe('C');
    expect(a).not.toBe(b);
  });

  it('mốc đặt đúng ngưỡng chữ cái, và dải đi từ LẠNH lên NÓNG', () => {
    const do_ = (m: string) => Number(/rgb\((\d+)/.exec(m)?.[1] ?? '0');
    const lam = (m: string) => Number(/,\s*(\d+)\)/.exec(m)?.[1] ?? '0');
    // Đỏ tăng dần, lam giảm dần khi leo thang — trục DMC.
    expect(do_(mauTheoDiem(950))).toBeGreaterThan(do_(mauTheoDiem(400)));
    expect(lam(mauTheoDiem(950))).toBeLessThan(lam(mauTheoDiem(400)));
  });

  it('kẹp hai đầu, không ném với điểm rác', () => {
    expect(mauTheoDiem(-999)).toBe(mauTheoDiem(0));
    expect(mauTheoDiem(99_999)).toBe(mauTheoDiem(1000));
  });

  it('bậc hiệu ứng khớp đúng ngưỡng hạng', () => {
    expect(bacHieuUng(519)).toBe('thuong');
    expect(bacHieuUng(520)).toBe('kim_loai');   // B
    expect(bacHieuUng(805)).toBe('chay');       // S
    expect(bacHieuUng(925)).toBe('chay_manh');  // SS
    expect(bacHieuUng(970)).toBe('cau_vong');   // SSS
  });

  it('⭐ ngưỡng SUY TỪ `THANG` của server — không chép số', () => {
    /*
     * `mau_hang.ts` từng gõ tay 355/520/670/805/925/970: bản sao thứ N của cùng
     * một bảng. Đổi `THANG` ở server thì mốc màu trôi IM LẶNG — các bậc màu thôi
     * trùng với các bậc chữ, không lỗi, không test đỏ. Bài này khoá theo TÍNH
     * CHẤT nên nó vẫn đúng khi founder chỉnh thang (D105 ghi 20 ngưỡng là
     * PLAYTEST-TUNE, chờ founder).
     */
    for (const h of ['B-', 'S-', 'SS', 'SSS'] as const) {
      const tu = THANG.find((t) => t.hang === h)!.tu;
      // Ngay tại ngưỡng phải đổi bậc; ngay dưới thì chưa.
      expect(bacHieuUng(tu)).not.toBe(bacHieuUng(tu - 1));
    }
    expect(MOC_MANH).toBe(THANG.find((t) => t.hang === 'A-')!.tu);
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/holdem/mau_hang.ts'), 'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src, 'ngưỡng gõ tay quay lại là dựng lại bản sao sẽ trôi')
      .not.toMatch(/\b(355|520|670|805|925|970)\b/);
  });
});

describe('IV. ⚠ Nhịp lên hạng: sống đúng thời lượng, và diễn lại từng bậc', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const khoi = (c: HTMLElement) => c.querySelector('[class*="khoi"]') as HTMLElement;
  const dangNhip = (el: HTMLElement) => /_lenNhe_|_lenManh_|_tut_/.test(el.className);

  it('⭐ nhịp TỰ TẮT khi hạng đổi SỚM rồi đứng yên suốt phần còn lại', () => {
    /*
     * ⚠⚠ CA NÀY ĐƯỢC CHỌN RẤT CỤ THỂ, và hai bản trước của bài này là PHÉP RỖNG
     * (D58) — ghi lại để không ai viết lại chúng:
     *
     * Bug: effect nghe cả `diemChay`, mà `diemChay` đổi 30 lần trong 900ms. Mỗi
     * lần deps đổi, React chạy CLEANUP của lần trước ⇒ `clearTimeout` huỷ đúng
     * cái hẹn sẽ tắt nhịp, còn nhánh mới không đặt hẹn nào (hạng chưa đổi tiếp).
     *
     * Nhưng bò 60 → 990 thì hạng đổi LIÊN TỤC tới tận nấc cuối, nên cú cuối cùng
     * đặt được một cái hẹn mà không ai huỷ nữa ⇒ nhịp vẫn tắt ⇒ bài xanh dù bug
     * còn nguyên. Ca lộ bug là: hạng đổi SỚM rồi ĐỨNG YÊN — lúc đó cái hẹn duy
     * nhất bị nấc kế huỷ, và không bao giờ có cái thứ hai.
     *
     * 500 → 545 nằm gọn quanh ngưỡng B (520) nên đúng một cú đổi hạng ở giữa.
     */
    const { container, rerender } = render(
      <ThanhPhongCach pc={{ diem: 500, hang: 'C+', streak: 0 }} />,
    );
    rerender(<ThanhPhongCach pc={{ diem: 545, hang: 'B-', streak: 0 }} />);
    /*
     * ⚠⚠ PHẢI TUA TỪNG NẤC — và đây là phép rỗng thứ ba của chính bài này.
     * `advanceTimersByTime(3000)` một phát thì React GỘP cả 30 lần `setHien`
     * thành MỘT lượt render, nên effect chỉ chạy đúng một lần với điểm đã ở
     * đích: nó đặt được cái hẹn tắt nhịp và không nấc nào huỷ nữa ⇒ bài xanh
     * dù bug còn nguyên. Tua từng nấc mới dựng lại đúng chuỗi cleanup thật.
     */
    for (let i = 0; i < 35; i += 1) act(() => { vi.advanceTimersByTime(30); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(dangNhip(khoi(container))).toBe(false);
  });

  it('⭐ hai cú lên hạng CÙNG CƯỜNG ĐỘ liên tiếp vẫn phải diễn lại', () => {
    /*
     * Lớp CSS không đổi thì trình duyệt KHÔNG chạy lại animation — bẫy
     * `.lat`/`.sang` của `GameCard`, và nó im lặng: hiệu ứng "vẫn có", chỉ
     * không diễn. Bò từ E lên B- là 9 bậc và TOÀN cú nhẹ, nên nếu không có mốc
     * phân biệt thì cả chuỗi chỉ nhấp nháy đúng một lần.
     */
    const { container, rerender } = render(
      <ThanhPhongCach pc={{ diem: 60, hang: 'E', streak: 0 }} />,
    );
    rerender(<ThanhPhongCach pc={{ diem: 500, hang: 'B-', streak: 0 }} />);

    const lan = new Set<string>();
    const oChu = new Set<Element>();
    for (let i = 0; i < 40; i += 1) {
      act(() => { vi.advanceTimersByTime(30); });
      const el = khoi(container);
      if (dangNhip(el)) {
        lan.add(el.dataset.lan ?? 'THIEU-MOC');
        /*
         * ⚠ Đếm số lần ĐỔI HẠNG thôi thì chưa canh được gì: `data-lan` vẫn tăng
         * dù animation không hề chạy lại. Thứ thật sự phải khoá là ô chữ được
         * DỰNG LẠI (đổi `key`) — chỉ khi node là node MỚI thì trình duyệt mới
         * chạy lại keyframe. Đếm số node RIÊNG BIỆT đã đi qua vị trí đó.
         */
        const o = el.querySelector('[class*="hang"]');
        if (o) oChu.add(o);
      }
    }
    expect(lan.has('THIEU-MOC')).toBe(false);
    expect(lan.size).toBeGreaterThan(2);
    expect(oChu.size).toBeGreaterThan(2);
  });

  it('⭐ D343 — ĐỦ VÒNG thì BẬT ĐÈN HAI NHỊP: xám bò tới đích rồi mới sáng, và ra ĐÚNG MỘT hạng', () => {
    /*
     * Sáng ngay lúc prop đổi thì chữ hạng suy từ điểm CŨ đang bò: `?` đóng dấu thành B-
     * rồi nhảy tiếp B, B+ giữa đường — khoảnh khắc "ra hạng" nói ba hạng. Bài này đếm
     * hạng khác `?` từng hiện trong cả nhịp: phải đúng MỘT, và là hạng của ĐÍCH.
     */
    const { container, rerender } = render(
      <ThanhPhongCach pc={{ diem: 300, streak: 0 }} chuaXep />,
    );
    rerender(<ThanhPhongCach pc={{ diem: 700, hang: 'A-', streak: 0 }} />);
    // Ngay sau khi đủ vòng: VẪN xám — thanh chưa tới nơi.
    expect(khoi(container).dataset.hang).toBe('?');
    expect(khoi(container).className).toMatch(/chuaXep/);

    const hangThay = new Set<string>();
    let batDenLucRa = false;
    let dongDauLucRa = false;
    for (let i = 0; i < 40; i += 1) {
      act(() => { vi.advanceTimersByTime(30); });
      const el = khoi(container);
      const h = el.dataset.hang ?? '';
      if (h !== '?' && !hangThay.has(h)) {
        batDenLucRa = /_batDen_/.test(el.className);
        dongDauLucRa = /_lenNhe_|_lenManh_/.test(el.className);
        expect(lap(container), 'sáng khi thanh CHƯA tới đích').toBeCloseTo(0.7, 3);
      }
      if (h !== '?') hangThay.add(h);
    }
    expect([...hangThay], 'khoảnh khắc ra hạng phải nói đúng MỘT hạng — hạng của đích')
      .toEqual([hangCua(700)]);
    expect(batDenLucRa, 'lúc ra hạng phải bật đèn').toBe(true);
    expect(dongDauLucRa, 'lúc ra hạng phải đóng dấu (`?` → hạng là cú LÊN)').toBe(true);
    expect(khoi(container).className).not.toMatch(/chuaXep/);

    // Đèn tự tắt đúng nhịp, không dính lớp.
    act(() => { vi.advanceTimersByTime(NHIP.BAT_DEN_PHONG_CACH + 50); });
    act(() => { vi.advanceTimersByTime(50); });
    expect(khoi(container).className).not.toMatch(/_batDen_/);
    expect(dangNhip(khoi(container))).toBe(false);
  });

  it('D343 — chưa xếp thì điểm tạm bò lên xuống mà KHÔNG đóng dấu / tụt hạng nào', () => {
    const { container, rerender } = render(
      <ThanhPhongCach pc={{ diem: 100, streak: 0 }} chuaXep />,
    );
    rerender(<ThanhPhongCach pc={{ diem: 990, streak: 0 }} chuaXep />);
    for (let i = 0; i < 40; i += 1) {
      act(() => { vi.advanceTimersByTime(30); });
      expect(khoi(container).dataset.hang).toBe('?');
      expect(khoi(container).dataset.fx).toBe('thuong');
      expect(dangNhip(khoi(container)), 'nhịp hạng nổ khi chưa có hạng').toBe(false);
    }
    expect(lap(container)).toBeCloseTo(0.99, 3);
  });

  it('D343 — thanh bị dùng lại cho trận khác (hạng → `?`) thì IM, không diễn cú tụt', () => {
    const { container, rerender } = render(
      <ThanhPhongCach pc={{ diem: 700, hang: 'A-', streak: 0 }} />,
    );
    rerender(<ThanhPhongCach pc={{ diem: 0, streak: 0 }} chuaXep />);
    for (let i = 0; i < 40; i += 1) {
      act(() => { vi.advanceTimersByTime(30); });
      expect(dangNhip(khoi(container)), 'sang trận mới mà diễn cú tụt hạng').toBe(false);
    }
  });

  it('cú TỤT cũng phải tự tắt, không dính sang vòng sau', () => {
    const { container, rerender } = render(
      <ThanhPhongCach pc={{ diem: 974, hang: 'SSS', streak: 0 }} />,
    );
    rerender(<ThanhPhongCach pc={{ diem: 384, hang: 'C-', streak: 0 }} />);
    /*
     * ⚠ HAI lượt tua, không phải một: cú `setNhip` cuối cùng đến từ một effect
     * chỉ chạy SAU khi `act` thứ nhất kết thúc, nên cái hẹn tắt nhịp của nó
     * được đăng ký sau khi đồng hồ giả đã tua xong. Một lượt tua thì bài này
     * đỏ vì lý do của bàn đo, không phải vì lỗi của thanh.
     */
    act(() => { vi.advanceTimersByTime(3000); });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(dangNhip(khoi(container))).toBe(false);
  });
});
