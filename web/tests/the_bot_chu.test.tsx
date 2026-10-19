/**
 * TRANG THẺ — TẦNG NHÌN TRƯỚC, CHỮ SAU `!` (13/09).
 *
 * Founder: *"toàn chữ là chữ, đọc muốn lòi mắt mà chữ thì cứ như giải thích/nói chuyện… cái họ muốn
 * chỉ là cái gì trực quan thể hiện kiến thức của mình, chữ thì chỉ dành cho bách khoa toàn thư"*.
 * Bài canh: vào trang THẺ, KHÔNG một câu giải thích khối nào nằm sẵn (kể cả trong ngăn `<details>`
 * đang đóng — jsdom vẫn giữ nội dung ấy trong DOM); chạm `!` của một khối thì đúng câu của khối ấy
 * hiện. Album sổ tay có bài riêng ở `so_tay.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { CHU_GIAI } from '../src/screens/TaiChinh';
import { DESC_FINANCE } from '../src/lib/vocab';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const CHUA_GOI = {
  tinh_cach: 'dang_dinh_hinh', khau_vi: null, net: null, bac_doc: 'chua',
  n_vong: 16, n_tran: 2, brier_chuoi: [1.0, 0.8],
  chi_so: {
    hieu_chinh: null, duoi_gia: null, theo_tin: null, chot_non: null,
    don_von: null, mua_tin: null, khau_vi: null,
  },
  goi: null,
  tien_do: { tran: 2, vong_quyet: 16, vong_su_kien: 3, can: { tran: 10, vong_quyet: 40, vong_su_kien: 8 }, day: false },
  lich_su: [],
};

/** Trang THẺ kéo khối ra theo IntersectionObserver — jsdom không có. */
function stubIO() {
  class IOGia {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) {
      this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver);
    }
    disconnect() {} unobserve() {} takeRecords() { return []; }
    root = null; rootMargin = ''; thresholds = [];
  }
  vi.stubGlobal('IntersectionObserver', IOGia);
}

describe('THẺ — chữ giải thích nằm sau `!`', () => {
  it('⭐ vào trang: không câu giải thích khối nào, không dòng giới thiệu; chạm `!` của DÒNG TOKEN ⇒ đúng câu ấy hiện', async () => {
    stubIO();
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: CHUA_GOI }],
      ['/me/dong-token', { status: 200, body: { dong: [{ reason: 'von_chao_san', vao: 1000, ra: 0, so_but_toan: 1 }] } }],
    ]);
    renderAt('/ho-so/the');
    const nhan = await screen.findByText('DÒNG TOKEN CỦA BẠN');
    await screen.findByTestId('tien-do-goi');
    const trang = document.body.textContent ?? '';
    for (const [khoi, cau] of Object.entries(CHU_GIAI)) expect(trang, khoi).not.toContain(cau);
    expect(trang).not.toContain(DESC_FINANCE);

    fireEvent.click(within(nhan.parentElement!).getByRole('button', { name: 'Giải thích khối này' }));
    expect(screen.getByText(CHU_GIAI.dongToken)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(CHU_GIAI.tienDo);
  });
});
