/**
 * D106 — HỒ SƠ THEO GÓI trên màn + CÀI ĐẶT giọng.
 *  · chưa gói nào đầy ⇒ 🐣 theo ĐÚNG giọng của tuổi, thanh tiến độ nói còn thiếu
 *    gì, KHÔNG radar, KHÔNG số gốc (phân tích chưa bật);
 *  · Cài đặt: bốn lựa chọn, bấm là POST đúng giá trị, xem trước bằng câu thật;
 *  · giọng Cài đặt đè tuổi: tuổi 18–22 mà chọn "chững" ⇒ thẻ nói giọng chững.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';
import { THE_TINH_CACH } from '../src/lib/tinh_cach';

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

describe('Tài chính — chưa đủ gói', () => {
  it('🐣 giọng TRẺ (tuổi 18–22), tiến độ 2/10 · 16/40 · 3/8, không radar, không số gốc', async () => {
    stubIO();
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: CHUA_GOI }],
      ['/me/dong-token', { status: 200, body: { dong: [] } }],
    ]);
    renderAt('/ho-so/the');
    const the = await screen.findByTestId('the-tinh-cach');
    expect(the.getAttribute('data-the')).toBe('dang_dinh_hinh');
    // ME_ONBOARDED có age_band 18-22 ⇒ giọng trẻ ⇒ câu của THE_TINH_CACH.dang_dinh_hinh.tre
    expect(the.textContent).toContain(THE_TINH_CACH.dang_dinh_hinh.tre.doc_vi);
    const td = screen.getByTestId('tien-do-goi');
    expect(td.textContent).toContain('2/10');
    expect(td.textContent).toContain('16/40');
    expect(td.textContent).toContain('3/8');
    expect(screen.queryByText('RADAR SÁU TRỤC')).toBeNull();
    expect(screen.queryByText(/SỐ GỐC/)).toBeNull();
    expect(screen.queryByTestId('vi-sao-the')).toBeNull();
  });

  it('giọng Cài đặt đè tuổi: giong_ho_so = chung ⇒ câu chững dù tuổi 18–22', async () => {
    stubIO();
    stubFetch([
      ['/auth/me', { status: 200, body: { ...ME_ONBOARDED, user: { ...ME_ONBOARDED.user!, giong_ho_so: 'chung' } } }],
      ['/holdem/me/tinh-cach', { status: 200, body: CHUA_GOI }],
      ['/me/dong-token', { status: 200, body: { dong: [] } }],
    ]);
    renderAt('/ho-so/the');
    const the = await screen.findByTestId('the-tinh-cach');
    expect(the.textContent).toContain(THE_TINH_CACH.dang_dinh_hinh.chung.doc_vi);
    expect(the.textContent).not.toContain('Bro');
  });
});

describe('Cài đặt — giọng hồ sơ', () => {
  it('bốn lựa chọn, đang chọn TỰ ĐỘNG, bấm GEN Z ⇒ POST /me/cai-dat {giong_ho_so:"tre"}', async () => {
    const calls = stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/me/cai-dat', { status: 200, body: { ok: true, giong_ho_so: 'tre', age_band: '18-22' } }],
    ]);
    renderAt('/cai-dat');
    // Chờ /auth/me về (nút chỉ bấm được khi đã biết là ai): dòng tuổi xuất hiện.
    await screen.findByText(/(18-22)/);
    const tuDong = screen.getByTestId('giong-tu_dong');
    expect(tuDong.getAttribute('aria-checked')).toBe('true');
    for (const g of ['tre', 'vua', 'chung']) {
      expect(screen.getByTestId(`giong-${g}`).getAttribute('aria-checked')).toBe('false');
    }
    // Xem trước bằng câu THẬT của thẻ (cùng catalog, không chép chữ riêng).
    expect(screen.getByTestId('giong-chung').textContent).toContain(THE_TINH_CACH.don_lanh.chung.doc_vi);
    fireEvent.click(screen.getByTestId('giong-tre'));
    await vi.waitFor(() => {
      const c = calls.find((x) => x.url.includes('/me/cai-dat'));
      expect(c, 'không POST').toBeDefined();
      expect(c!.method).toBe('POST');
      expect(c!.body).toEqual({ giong_ho_so: 'tre' });
    });
  });
});

describe('câu TỰ KHAI trên trang Tài chính', () => {
  it('đã chơi + chưa trả lời ⇒ hỏi một thang 0–10; bấm 7 ⇒ POST {cau:"rui_ro", tra_loi:7}', async () => {
    stubIO();
    const calls = stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: CHUA_GOI }],
      ['/me/dong-token', { status: 200, body: { dong: [] } }],
      ['/me/tu-khai', { status: 200, body: { rui_ro: null, ts: null } }],
    ]);
    renderAt('/ho-so/the');
    const nut = await screen.findByTestId('tu-khai-7');
    fireEvent.click(nut);
    await vi.waitFor(() => {
      const c = calls.find((x) => x.url.includes('/me/tu-khai') && x.method === 'POST');
      expect(c, 'không POST').toBeDefined();
      expect(c!.body).toEqual({ cau: 'rui_ro', tra_loi: 7 });
    });
  });

  it('đã trả lời ⇒ hiện ĐỐI CHIẾU ngoài đời / trong trận, không nút, không phán xét', async () => {
    stubIO();
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: CHUA_GOI }],
      ['/me/dong-token', { status: 200, body: { dong: [] } }],
      ['/me/tu-khai', { status: 200, body: { rui_ro: 8, ts: '2026-08-22T00:00:00Z' } }],
    ]);
    renderAt('/ho-so/the');
    const khoi = await screen.findByTestId('tu-khai');
    await vi.waitFor(() => expect(khoi.textContent).toContain('8/10'));
    expect(khoi.textContent).toContain('chưa đủ gói để đo');
    expect(screen.queryByTestId('tu-khai-7')).toBeNull();
  });
});
