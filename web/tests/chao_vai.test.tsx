/**
 * MÀN CHÀO VAI — 5 giây đầu trận (founder 23/08: *"Phần nói cho player biết
 * mình là ai nên có riêng 1 khoảng 5s/trận khi bắt đầu trận đấu"*).
 *
 * Bốn thứ được khoá, mỗi cái một lớp lỗi repo này đã dính:
 *   1. TỰ TẮT — một lớp phủ toàn màn không tự đi là một cái bẫy, không phải màn chào;
 *   2. TẮT SỚM ĐƯỢC — người đọc xong không phải chờ hết giờ (và không mất lượt);
 *   3. `prefers-reduced-motion` bỏ CHUYỂN ĐỘNG chứ không rút ngắn thời gian ĐỌC
 *      — cùng lỗi vừa vá ở `MomentOverlay` (kẹp 60ms làm chết khối tiếp cận);
 *   4. DÂY NỐI — màn trận thật sự dựng nó, và CHỈ ở vòng 1, CHỈ khi có vai
 *      ("cơ chế trang trí" là bẫy số 1 của repo).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ChaoVai, CHAO_VAI_MS, ICON_VAI } from '@/components/holdem/ChaoVai';

const VAI = {
  id: 'to_chuc',
  ten: 'TỔ CHỨC',
  dacQuyen: 'Đa Dạng Hoá ghim sẵn; thấy DÒNG TIỀN cả bàn',
  caiGia: 'Mandate: không mua mã nào quá 40% NAV',
  heSoVon: 2,
};

describe('I. Vòng đời — tự tắt, và tắt sớm được', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('⭐ tự gọi onXong sau đúng 5 giây', () => {
    const xong = vi.fn();
    render(<ChaoVai vai={VAI} onXong={xong} />);
    act(() => { vi.advanceTimersByTime(CHAO_VAI_MS - 100); });
    expect(xong, 'tắt sớm hơn hẹn thì người chơi chưa kịp đọc').not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(xong).toHaveBeenCalledTimes(1);
  });

  it('⭐ chạm là tắt NGAY — không bắt chờ hết 5 giây', () => {
    const xong = vi.fn();
    render(<ChaoVai vai={VAI} onXong={xong} />);
    fireEvent.click(screen.getByTestId('chao-vai'));
    expect(xong).toHaveBeenCalledTimes(1);
  });

  it('bàn phím cũng qua được (Enter / Space)', () => {
    const xong = vi.fn();
    render(<ChaoVai vai={VAI} onXong={xong} />);
    fireEvent.keyDown(screen.getByTestId('chao-vai'), { key: 'Enter' });
    expect(xong).toHaveBeenCalledTimes(1);
  });

  it('⭐⭐ CHA RENDER LẠI LIÊN TỤC vẫn tắt đúng hẹn — không bị dời vô hạn', () => {
    /*
     * Bug thật, chỉ lộ trên trình duyệt: màn trận truyền `onXong={() => …}` —
     * một hàm MỚI mỗi render — và nó re-render MỖI GIÂY vì đồng hồ đếm ngược.
     * Nếu `onXong` nằm trong mảng phụ thuộc của effect thì cleanup huỷ cái hẹn
     * 5 giây rồi đặt lại từ đầu, mỗi giây một lần ⇒ màn chào đứng lại VĨNH VIỄN.
     * Bài một-lượt-render ở trên xanh trong cả hai bản, nên nó không canh được.
     */
    const xong = vi.fn();
    const { rerender } = render(<ChaoVai vai={VAI} onXong={() => xong()} />);
    // Tua từng giây, mỗi giây cha dựng lại một callback MỚI như đời thật.
    for (let i = 0; i < 6; i += 1) {
      act(() => { vi.advanceTimersByTime(1000); });
      rerender(<ChaoVai vai={VAI} onXong={() => xong()} />);
    }
    expect(xong, 'hẹn giờ bị dời lại mỗi lần cha render ⇒ không bao giờ tắt')
      .toHaveBeenCalled();
  });

  it('gỡ khỏi cây giữa chừng ⇒ KHÔNG gọi onXong nữa (hẹn giờ phải được dọn)', () => {
    const xong = vi.fn();
    const { unmount } = render(<ChaoVai vai={VAI} onXong={xong} />);
    unmount();
    act(() => { vi.advanceTimersByTime(CHAO_VAI_MS * 2); });
    expect(xong).not.toHaveBeenCalled();
  });
});

describe('II. Nội dung — chữ của server, icon từ bộ lưới có sẵn', () => {
  it('hiện tên vai + QUYỀN + GIÁ, không gõ lại chữ nào ở client', () => {
    render(<ChaoVai vai={VAI} onXong={() => {}} />);
    const kh = screen.getByTestId('chao-vai');
    expect(kh.textContent).toContain('TỔ CHỨC');
    expect(kh.textContent).toContain(VAI.dacQuyen);
    expect(kh.textContent).toContain(VAI.caiGia);
    expect(kh.getAttribute('data-vai')).toBe('to_chuc');
  });

  it('bốn vai đều có icon, và vai LẠ không làm vỡ màn', () => {
    for (const id of ['ca_nhan', 'doi_lai', 'ca_map', 'to_chuc']) {
      expect(ICON_VAI[id], `vai ${id} chưa có icon`).toBeTruthy();
    }
    // Vai server thêm sau này: rơi về `user` chứ không ném, không ô trống.
    render(<ChaoVai vai={{ ...VAI, id: 'vai_moi_toanh' }} onXong={() => {}} />);
    expect(screen.getByTestId('chao-vai')).toBeInTheDocument();
  });
});

describe('III. Tiết kiệm chuyển động ≠ rút ngắn thời gian đọc', () => {
  it('⭐ vẫn đứng đủ 5 giây khi bật prefers-reduced-motion', () => {
    /*
     * Lỗi vừa vá ở `MomentOverlay` (kẹp mọi khoảnh khắc còn 60ms) đến từ đúng
     * cách nghĩ này: coi thời lượng là một phần của hoạt ảnh. Nó không phải —
     * 5 giây ở đây là để ĐỌC, và người bật tiết kiệm chuyển động vẫn cần chừng
     * ấy. Thứ bị tắt là cái nháy.
     */
    const goc = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q, onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    vi.useFakeTimers();
    try {
      const xong = vi.fn();
      render(<ChaoVai vai={VAI} onXong={xong} />);
      act(() => { vi.advanceTimersByTime(CHAO_VAI_MS - 100); });
      expect(xong).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(200); });
      expect(xong).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      window.matchMedia = goc;
    }
  });

  it('CSS: khối reduced-motion tắt animation, KHÔNG đụng thời lượng', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'src/components/holdem/ChaoVai.module.css'), 'utf8',
    );
    const tat = /@media \(prefers-reduced-motion: reduce\)([\s\S]*)$/.exec(css)?.[1] ?? '';
    expect(tat).toContain('animation: none');
  });
});

describe('IV. Dây nối — màn trận thật sự dựng nó, đúng lúc', () => {
  const MAN = readFileSync(
    resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  it('⭐ có mount — không phải "cơ chế trang trí" thứ N', () => {
    expect(MAN).toContain('<ChaoVai');
  });

  it('CHỈ ở vòng 1, CHỈ khi trận có vai, và CHỈ một lần', () => {
    /*
     * Vào lại một bàn đang dở ở vòng 6 mà bị chặn 5 giây để nghe lại thứ mình
     * đã biết là phạt đúng người quay lại. Và map 8 không có vai (mẫu đối
     * chứng thuần — D107) nên ở đó không được hiện gì.
     */
    expect(MAN).toMatch(/!daChaoVai && st\.vong === 1 && b\.vai/);
    expect(MAN).toContain('setDaChaoVai(true)');
  });

  it('cờ ĐẶT LẠI khi đổi trận — route không mang key nên không tự dựng lại', () => {
    expect(MAN).toMatch(/tranCuaChao/);
    expect(MAN).toMatch(/setDaChaoVai\(false\)/);
  });
});

/*
 * ─── 12/09 — PHA CHIA VAI ───────────────────────────────────────────────────
 * Founder: *"phần hướng dẫn chưa có màn hình chia vai"* — bàn tập đi thẳng vào
 * trận, không qua phòng chờ, nên chưa có khoảnh khắc nào cho thấy CẢ BÀN được
 * chia vai. Nay `ChaoVai` có hai pha khi nhận `doiThu`: CHIA VAI (mỗi ghế một lá,
 * mình cuối) rồi VAI CỦA BẠN (5 giây như cũ). Không `doiThu` ⇒ y nguyên đường cũ.
 * Tiêm lỗi 12/09: đổi `if (pha === 'chia') setPha('toi'); else onXong();` thành
 * gọi `onXong()` ở cả hai pha ⇒ bài "chạm khi đang chia" đỏ.
 */
import { chiaVaiMs, type GheChia } from '@/components/holdem/ChaoVai';

const BAN: GheChia[] = [
  { ghe_id: 'b1', ten: 'Máy · Phòng thủ', loai: 'bot', vai: 'ca_nhan' },
  { ghe_id: 'b2', ten: 'Máy · Đa dạng hoá', loai: 'bot', vai: 'ca_map' },
  { ghe_id: 'b3', ten: 'Máy · Khắc chế', loai: 'bot', vai: 'doi_lai' },
];
const BANG_VAI = {
  ca_nhan: { ten: 'CÁ NHÂN', he_so_von: 1 }, ca_map: { ten: 'CÁ MẬP', he_so_von: 3 },
  doi_lai: { ten: 'ĐỘI LÁI', he_so_von: 3 }, to_chuc: { ten: 'TỔ CHỨC', he_so_von: 2 },
};

describe('III. Pha CHIA VAI (12/09) — cả bàn nhận lá, mình cuối, rồi mới tới vai của mình', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('⭐ có doiThu ⇒ vào pha chia: n+1 lá, lá cuối là BẠN (viền vàng), mỗi lá đúng vai + ×vốn', () => {
    render(<ChaoVai vai={VAI} onXong={() => {}} doiThu={BAN} vaiBang={BANG_VAI} />);
    const kh = screen.getByTestId('chao-vai');
    expect(kh.getAttribute('data-pha')).toBe('chia');
    const la = kh.querySelectorAll('[role="listitem"]');
    expect(la.length).toBe(BAN.length + 1);
    const cuoi = la[la.length - 1]!;
    expect(cuoi.getAttribute('data-ghe')).toBe('ban');
    expect(cuoi.getAttribute('data-vai')).toBe('to_chuc');
    expect(cuoi.className).toMatch(/laToi/);
    expect(cuoi.textContent).toContain('TỔ CHỨC');
    expect(cuoi.textContent).toContain('×2');
    expect(la[1]!.textContent).toContain('CÁ MẬP');
    expect(la[1]!.textContent).toContain('×3');
    // Pha chia chưa có nội dung "VAI CỦA BẠN".
    expect(kh.textContent).not.toContain('QUYỀN');
  });

  /*
   * D406 — VỐN ĐỀU (v54 mặc định): bảng vai của trận toàn hệ số 1 ⇒ không lá nào mang "×1", câu luật thôi nói "vai quyết
   * vốn khởi điểm", dòng VỐN nói "như mọi ghế". Bảng có ×3 (bàn tập v53) thì giữ nguyên như bài trên.
   */
  it('⭐ D406 — bảng vai vốn đều: không nhãn ×1, câu luật nói quyền + cái giá, VỐN "như mọi ghế"', () => {
    const DEU = Object.fromEntries(Object.entries(BANG_VAI).map(([k, v]) => [k, { ...v, he_so_von: 1 }]));
    render(<ChaoVai vai={{ ...VAI, heSoVon: 1 }} onXong={() => {}} doiThu={BAN} vaiBang={DEU} />);
    const kh = screen.getByTestId('chao-vai');
    const la = kh.querySelectorAll('[role="listitem"]');
    expect(la.length).toBe(BAN.length + 1);
    for (const x of la) expect(x.textContent).not.toMatch(/×\d/);
    expect(kh.textContent).not.toContain('vốn khởi điểm');
    expect(kh.textContent).toContain('vốn mọi ghế như nhau');
    fireEvent.click(kh);
    expect(kh.getAttribute('data-pha')).toBe('toi');
    expect(kh.textContent).toContain('như mọi ghế');
    expect(kh.textContent).not.toContain('vốn cơ bản');
    expect(kh.textContent).not.toContain('vốn khởi điểm và lõi');
  });

  it('⭐ chạm khi đang chia ⇒ sang VAI CỦA BẠN, KHÔNG gọi onXong; chạm lần nữa mới vào bàn', () => {
    const xong = vi.fn();
    render(<ChaoVai vai={VAI} onXong={xong} doiThu={BAN} vaiBang={BANG_VAI} />);
    const kh = screen.getByTestId('chao-vai');
    fireEvent.click(kh);
    expect(kh.getAttribute('data-pha')).toBe('toi');
    expect(xong).not.toHaveBeenCalled();
    expect(kh.textContent).toContain('QUYỀN');
    fireEvent.click(kh);
    expect(xong).toHaveBeenCalledTimes(1);
  });

  it('⭐ không chạm: hết nhịp chia tự sang pha vai, rồi đúng 5 giây nữa mới onXong', () => {
    const xong = vi.fn();
    render(<ChaoVai vai={VAI} onXong={xong} doiThu={BAN} vaiBang={BANG_VAI} />);
    const kh = screen.getByTestId('chao-vai');
    const chia = chiaVaiMs(BAN.length + 1);
    act(() => { vi.advanceTimersByTime(chia - 20); });
    expect(kh.getAttribute('data-pha')).toBe('chia');
    act(() => { vi.advanceTimersByTime(40); });
    expect(kh.getAttribute('data-pha')).toBe('toi');
    act(() => { vi.advanceTimersByTime(CHAO_VAI_MS - 100); });
    expect(xong).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(200); });
    expect(xong).toHaveBeenCalledTimes(1);
  });

  it('không doiThu (người gọi cũ) ⇒ vào thẳng VAI CỦA BẠN — đường cũ y nguyên', () => {
    render(<ChaoVai vai={VAI} onXong={() => {}} />);
    expect(screen.getByTestId('chao-vai').getAttribute('data-pha')).toBe('toi');
  });

  it('ghế không vai ⇒ lá vẫn vẽ, nói "không vai", không nổ', () => {
    render(<ChaoVai vai={VAI} onXong={() => {}} doiThu={[{ ghe_id: 'x', ten: 'Máy', loai: 'bot' }]} />);
    const la = screen.getByTestId('chao-vai').querySelectorAll('[role="listitem"]');
    expect(la.length).toBe(2);
    expect(la[0]!.getAttribute('aria-label')).toContain('không vai');
  });
});

describe('IV. Bàn tập ĐÓNG BĂNG (12/09) — không hẹn giờ, chỉ tay người chơi mới đi tiếp', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('⭐ dongBang: qua cả nhịp chia lẫn 5 giây vẫn đứng ở pha chia, onXong không gọi', () => {
    const xong = vi.fn();
    render(<ChaoVai vai={VAI} onXong={xong} doiThu={BAN} vaiBang={BANG_VAI} dongBang />);
    const kh = screen.getByTestId('chao-vai');
    act(() => { vi.advanceTimersByTime(chiaVaiMs(BAN.length + 1) + CHAO_VAI_MS * 3); });
    expect(kh.getAttribute('data-pha')).toBe('chia');
    expect(xong).not.toHaveBeenCalled();
  });

  it('⭐ dongBang: chạm → vai của mình, vẫn đứng; chạm nữa mới vào bàn', () => {
    const xong = vi.fn();
    render(<ChaoVai vai={VAI} onXong={xong} doiThu={BAN} vaiBang={BANG_VAI} dongBang />);
    const kh = screen.getByTestId('chao-vai');
    fireEvent.click(kh);
    expect(kh.getAttribute('data-pha')).toBe('toi');
    act(() => { vi.advanceTimersByTime(CHAO_VAI_MS * 3); });
    expect(xong).not.toHaveBeenCalled();
    fireEvent.click(kh);
    expect(xong).toHaveBeenCalledTimes(1);
  });

  it('onPha báo pha lúc mount và mỗi lần đổi — coach bàn tập rọi đúng khối', () => {
    const pha = vi.fn();
    render(<ChaoVai vai={VAI} onXong={() => {}} doiThu={BAN} vaiBang={BANG_VAI} dongBang onPha={pha} />);
    expect(pha).toHaveBeenLastCalledWith('chia');
    fireEvent.click(screen.getByTestId('chao-vai'));
    expect(pha).toHaveBeenLastCalledWith('toi');
    // Hai khối có neo cho coach.
    expect(document.querySelector('[data-tap="chao-vai"]')).not.toBeNull();
  });
});
