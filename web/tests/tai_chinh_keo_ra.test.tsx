/**
 * TRANG TÀI CHÍNH — HOẠT ẢNH KÉO TỪ TÂM RA (founder phải báo HAI LẦN).
 *
 * ⚠ LỖI GỐC, và vì sao nó im lặng tới thế: `useKeoRa` bản đầu dùng `useRef` +
 * `useEffect([itMotion])`. Effect chạy đúng MỘT LẦN lúc mount, mà lúc đó
 * `/me/tinh-cach` còn đang bay nên khối radar CHƯA RENDER ⇒ `ref.current` là
 * null ⇒ hook rơi vào nhánh "không quan sát được" và đặt thẳng hệ số = 1. Data
 * về sau vài trăm ms, radar hiện ra ĐÃ ĐẦY. Không lỗi, không test nào đỏ.
 *
 * ⚠ VÀ VÌ SAO PHÉP ĐO CŨ KHÔNG BẮT ĐƯỢC: nghiệm thu 08/08 làm bằng điều hướng
 * SPA khi dữ liệu ĐÃ nằm trong cache — đường đó render khối ngay lập tức nên
 * hoạt ảnh chạy thật và phép đo XANH. Đường người thật đi là NẠP THẲNG trang.
 * Bài dưới đây dựng đúng đường chính: **dữ liệu về SAU khi màn đã mount**.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

/** Hồ sơ theo GÓI (D106): gói 1 đã đầy ⇒ thẻ + radar + số gốc đều hiện. */
const HO_SO = {
  tinh_cach: 'rai_lanh',
  khau_vi: 'rai',
  net: 'lanh',
  bac_doc: 'dang_hoc',
  n_vong: 171,
  n_tran: 33,
  brier_chuoi: [1.2, 1.1, 1.0, 0.9, 0.8, 0.7],
  chi_so: {
    hieu_chinh: { brier_tb: 0.9, xu_huong: 0.02, n: 171 },
    duoi_gia: { ty_le: 0.3, nen: 0.3, lech: 0, n: 40 },
    theo_tin: { ty_le: 0.5, nen: 0.5, lech: 0, phan_tin_gia: 0.28, nen_tin_gia: 0.3, lech_tin_gia: -0.02, n: 30 },
    chot_non: { lech: 0, ban_sau_xanh: 0.2, ban_sau_do: 0.2, n: 20 },
    don_von: { nen_bp: 3000, sau_thang_x: 1, sau_thua_x: 1, n: 25 },
    mua_tin: { ty_le: 0.03, brier_mo: null, brier_khong: 0.9, n: 171 },
    khau_vi: { phoi_nhiem_tb: 0.6, so_ma_tb: 3.2, dung_ngoai: 0.1, n: 171 },
  },
  goi: { so: 1, tong: 1 },
  tien_do: { tran: 3, vong_quyet: 20, vong_su_kien: 5, can: { tran: 10, vong_quyet: 40, vong_su_kien: 8 }, day: false },
  lich_su: [{ goi_so: 1, tinh_cach: 'rai_lanh', n_tran: 33, computed_at: '2026-08-22T00:00:00Z' }],
};

/** IntersectionObserver giả — ghi lại nó được bảo quan sát phần tử nào. */
function stubIO(): { daQuanSat: Element[] } {
  const daQuanSat: Element[] = [];
  class IOGia {
    constructor(private cb: IntersectionObserverCallback) {}
    observe(el: Element) {
      daQuanSat.push(el);
      // Bắn NGAY như trình duyệt làm với phần tử đang trong tầm nhìn.
      this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver);
    }
    disconnect() {}
    unobserve() {}
    takeRecords() { return []; }
    root = null; rootMargin = ''; thresholds = [];
  }
  vi.stubGlobal('IntersectionObserver', IOGia);
  return { daQuanSat };
}

describe('radar kéo từ tâm ra — chạy cả khi DỮ LIỆU VỀ MUỘN', () => {
  it('⭐ khối radar render sau khi mount ⇒ VẪN được quan sát (bug founder báo 2 lần)',
    async () => {
      /*
       * Đây là bài phân biệt được bản hỏng với bản đúng, và nó chỉ đỏ đúng ở
       * chỗ đã hỏng: bản dùng `useRef` không bao giờ gọi `observe()` vì lúc
       * effect chạy thì phần tử chưa tồn tại. Bản dùng callback ref
       * (`useState` giữ node) thì node gắn vào DOM là effect chạy lại.
       */
      const { daQuanSat } = stubIO();
      stubFetch([
        ['/auth/me', { status: 200, body: ME_ONBOARDED }],
        ['/holdem/me/tinh-cach', { status: 200, body: HO_SO }],
        ['/me/dong-token', { status: 200, body: { dong: [] } }],
      ]);
      renderAt('/ho-so/the');
      // Chờ tới khi khối radar THẬT SỰ có trên màn (tức data đã về).
      await screen.findByText('RADAR SÁU TRỤC');
      await vi.waitFor(() => {
        expect(daQuanSat.length,
          'không observe phần tử nào ⇒ hoạt ảnh chết im, radar hiện ra đã đầy')
          .toBeGreaterThan(0);
      }, { timeout: 3000 });
    });

  it('SỐ GỐC nằm SAU dòng token trong luồng đọc (founder: cho xuống dưới cùng)',
    async () => {
      stubIO();
      stubFetch([
        ['/auth/me', { status: 200, body: ME_ONBOARDED }],
        ['/holdem/me/tinh-cach', { status: 200, body: HO_SO }],
        ['/me/dong-token', {
          status: 200,
          body: { dong: [{ reason: 'signup_grant', vao: 1000, ra: 0, so_but_toan: 1 }] },
        }],
      ]);
      renderAt('/ho-so/the');
      const soGoc = await screen.findByText(/SỐ GỐC/);
      const token = await screen.findByText('DÒNG TOKEN CỦA BẠN');
      /*
       * `compareDocumentPosition` đọc THỨ TỰ THẬT trong cây DOM, không phải thứ
       * tự tôi tưởng — CSS có thể đảo chỗ mà nó vẫn bắt đúng luồng đọc/trình
       * đọc màn hình. FOLLOWING = soGoc đứng sau token.
       */
      expect(token.compareDocumentPosition(soGoc)
        & Node.DOCUMENT_POSITION_FOLLOWING,
      'khối số gốc phải đứng sau mọi thứ đáng khoe').toBeTruthy();
    });

  it('SỐ vẫn còn mặt — đẩy xuống dưới, KHÔNG bỏ đi (D62/D73)', async () => {
    stubIO();
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: HO_SO }],
      ['/me/dong-token', { status: 200, body: { dong: [] } }],
    ]);
    renderAt('/ho-so/the');
    await screen.findByText(/SỐ GỐC/);
    /*
     * Radar là BIẾN HÌNH của mấy con số này; bỏ số đi thì hình thành thứ không
     * ai kiểm được — đúng lớp lỗi D62 ("một bảng nói sai thì người ta tin").
     */
    // 13/09 — câu giải thích lên `!` ở nhãn; CỠ MẪU vẫn nhìn thấy, chỉ gọn lại thành số.
    expect(await screen.findByText(/171 vòng · [0-9]+ trận đã xong/)).toBeInTheDocument();
    expect(screen.getByText(/ĐỘ CHUẨN QUA 6 VÒNG/)).toBeInTheDocument();
  });
});
