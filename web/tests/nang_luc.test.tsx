/**
 * BA KỸ NĂNG (D323, gộp 13/09) — phía client. Bốn câu:
 *  (a) tự điển phủ ĐỦ mọi id/bậc máy chủ có thể trả (thiếu một là ô trống im lặng);
 *  (b) bộ quét A10: không chuỗi nào — kể cả câu "Trên đề này" dựng từ số — kê đơn;
 *  (c) thiếu mẫu hiện `—`, KHÔNG BAO GIỜ `0` (P7/D62);
 *  (d) ba dấu CÓ ĐƯỜNG CHẠY TỚI ở hai chỗ người chơi thấy: dải GHI VÀO THẺ trong khối PHONG CÁCH
 *      màn kết, và mặt THẺ qua route thật. Tab NĂNG LỰC riêng đã gộp (founder 13/09: *"chia ra
 *      nhiều quá thì thừa thãi và rối"*) — bài canh giữ nó không mọc lại.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BAC_NANG_LUC, NANG_LUC_IDS } from '@config/nang_luc';
import type { NangLucTran, TheNangLucTranDTO, NangLucCuaToiDTO } from '@server/holdem/nang_luc_ids';
import {
  BAC_NGAN, CHU_NANG_LUC, NHAN_BAC, TEN_NANG_LUC, bangChungHien, cauTrenDe, moiChuNangLuc,
} from '../src/lib/nang_luc';
import { TU_KE_DON } from '../src/lib/khoanh_khac';
import { CHU_CHE_DO_TESTER } from '../src/lib/buoi_do_chu';
import { GhiVaoThe } from '../src/components/holdem/GhiVaoThe';
import { PhongCachKet } from '../src/components/holdem/PhongCachKet';
import { TAB_TAI_CHINH } from '../src/components/pfm/TabTaiChinh';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** Mọi bậc × mọi id × hai hình bằng chứng (đủ số · toàn null) — để quét câu dựng từ số. */
const MOI_TRAN: NangLucTran[] = NANG_LUC_IDS.flatMap((id) =>
  (['chua_gap', 'gap_chua_vung', 'lam_duoc'] as const).flatMap((bac) => [
    { id, bac, bang_chung: {
      so_vong_gui: 2, so_huy: 1, ty_trong_max_bp: 4000, vong_huy_dau: 5,
      brier_tb: 0.91, n: 6, so_su_kien: 4, so_tin_gia: 1,
      so_vong_vi_the: 5, ty_le_hai_nhom: 0.6, dung_du_phong: 0,
    } },
    { id, bac, bang_chung: {
      so_vong_gui: null, so_huy: null, ty_trong_max_bp: null, vong_huy_dau: null,
      brier_tb: null, n: null, so_su_kien: null, so_tin_gia: null,
      so_vong_vi_the: null, ty_le_hai_nhom: null, dung_du_phong: null,
    } },
  ]));

describe('(a) tự điển phủ đủ', () => {
  it('mọi id năng lực có tên đầy đủ, tên ngắn, câu ngoài đời, khung OECD', () => {
    expect(Object.keys(TEN_NANG_LUC).sort()).toEqual([...NANG_LUC_IDS].sort());
    for (const id of NANG_LUC_IDS) {
      const t = TEN_NANG_LUC[id];
      for (const v of [t.ten, t.ngan, t.ngoai_doi, t.khung.oecd]) {
        expect(v.trim().length, `${id} thiếu một trường`).toBeGreaterThan(0);
      }
    }
  });
  it('mọi bậc máy chủ trả đều có nhãn đầy đủ VÀ chữ bậc ngắn in trên dấu', () => {
    expect(Object.keys(NHAN_BAC).sort()).toEqual([...BAC_NANG_LUC].sort());
    expect(Object.keys(BAC_NGAN).sort()).toEqual([...BAC_NANG_LUC].sort());
  });
  it('⚠ tên ngắn không mang chữ ĐỌC — ba trục phong cách ngay trên đã có ĐỌC mang một con số khác', () => {
    for (const id of NANG_LUC_IDS) expect(TEN_NANG_LUC[id].ngan).not.toMatch(/ĐỌC/);
  });
});

describe('(b) bộ quét A10 — mô tả được, kê đơn không', () => {
  it('⭐ không chuỗi tự điển nào và không câu "Trên đề này" nào chứa từ kê đơn', () => {
    const chu = [...moiChuNangLuc(), ...MOI_TRAN.map((t) => cauTrenDe(t.id, t))];
    const vi_pham: string[] = [];
    for (const c of chu) {
      const thuong = ` ${c.toLowerCase()} `;
      for (const tu of TU_KE_DON) if (thuong.includes(tu)) vi_pham.push(`"${tu.trim()}" trong: ${c}`);
    }
    expect(vi_pham).toEqual([]);
  });
});

describe('(c) thiếu mẫu hiện —, không bao giờ 0', () => {
  it('⭐ bằng chứng toàn null ⇒ mọi ô là —, không ô nào là 0 hay 0%', () => {
    for (const t of MOI_TRAN.filter((x) => x.bang_chung.so_huy === null)) {
      for (const o of bangChungHien(t.id, t)) {
        expect(o.so, `${t.id}/${t.bac}/${o.nhan}`).toBe('—');
      }
    }
  });
  it('0 THẬT (có cửa mà không gửi) vẫn hiện 0 — chỉ null mới thành —', () => {
    const o = bangChungHien('cam_ket_tiet_kiem', {
      id: 'cam_ket_tiet_kiem', bac: 'chua_gap',
      bang_chung: { so_vong_gui: 0, so_huy: 0, ty_trong_max_bp: 0 },
    });
    expect(o.map((x) => x.so)).toEqual(['0', '0', '0%']);
  });
  it('hai đường chua_gap của tiết kiệm nói hai câu khác nhau', () => {
    const khongCoChe = cauTrenDe('cam_ket_tiet_kiem', { id: 'cam_ket_tiet_kiem', bac: 'chua_gap',
      bang_chung: { so_vong_gui: null, so_huy: null, ty_trong_max_bp: null } });
    const khongGui = cauTrenDe('cam_ket_tiet_kiem', { id: 'cam_ket_tiet_kiem', bac: 'chua_gap',
      bang_chung: { so_vong_gui: 0, so_huy: 0, ty_trong_max_bp: 0 } });
    expect(khongCoChe).not.toBe(khongGui);
    expect(khongCoChe).toMatch(/chưa có ngân hàng/);
  });
});

const THE_TAP: TheNangLucTranDTO = {
  formula_version: 1, tinh_vao_the: false, ly_do_khong_tinh: 'man_tap',
  nang_luc: [
    { id: 'cam_ket_tiet_kiem', bac: 'lam_duoc', bang_chung: { so_vong_gui: 1, so_huy: 0, ty_trong_max_bp: 4000 } },
    { id: 'doc_tin', bac: 'gap_chua_vung', bang_chung: { brier_tb: 0.91, n: 6, so_su_kien: 4, so_tin_gia: 1 } },
    { id: 'phan_tan', bac: 'chua_gap', bang_chung: { so_vong_vi_the: 2, ty_le_hai_nhom: 0, dung_du_phong: 0 } },
  ],
};
const PC = {
  diem: 880, hang: 'S+', streak: 0, streak_dai_nhat: 4,
  ba_truc: { doc: 0.82, thang_cho: 0.61, tru: 1 },
};
const KHOANH = [{ id: 'truot_gia', vong: 2, delta_bp: -620 }];
const tenNgan = (id: string): string => TEN_NANG_LUC[id as keyof typeof TEN_NANG_LUC].ngan;

describe('(d) dải GHI VÀO THẺ — đáy khối PHONG CÁCH ở màn kết', () => {
  it('API cũ: không nang_luc, không khoảnh khắc, không mã ⇒ không vẽ gì', () => {
    const { container } = render(<MemoryRouter><GhiVaoThe the={undefined} khoanhKhac={undefined} /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });

  it('⭐ bàn tập ⇒ ba dấu tên ngắn + chữ bậc NHÌN THẤY, nhãn nói không ghi vào thẻ, link sang THẺ; số thô chưa lộ', () => {
    render(<MemoryRouter><GhiVaoThe the={THE_TAP} khoanhKhac={[]} /></MemoryRouter>);
    expect(screen.getByText(CHU_NANG_LUC.banTap)).toBeInTheDocument();
    for (const n of THE_TAP.nang_luc) {
      const dau = screen.getByTestId(`dau-${n.id}`);
      expect(dau).toHaveAttribute('data-bac', n.bac);
      expect(dau.textContent).toContain(tenNgan(n.id));
      expect(dau.textContent).toContain(BAC_NGAN[n.bac]);
    }
    // 21/09 — thẻ ĐO TỪ TRẬN dọn sang `/ho-so/the` (thẻ PFM thật sự riêng ở `/tai-chinh/the`).
    expect(screen.getByRole('link', { name: CHU_NANG_LUC.xemThe })).toHaveAttribute('href', '/ho-so/the');
    expect(screen.queryByTestId('giai-ky-nang')).toBeNull();
    expect(screen.queryByText('0,91')).toBeNull();
  });

  it('⭐ bấm một dấu ⇒ MỘT tấm chi tiết có số bằng chứng; bấm dấu khác ⇒ tấm đổi, không chồng hai tấm', () => {
    render(<MemoryRouter><GhiVaoThe the={THE_TAP} khoanhKhac={[]} /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('dau-doc_tin'));
    expect(screen.getByTestId('dau-doc_tin')).toHaveAttribute('aria-expanded', 'true');
    expect(within(screen.getByTestId('giai-ky-nang')).getByText('0,91')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('dau-phan_tan'));
    expect(screen.getAllByTestId('giai-ky-nang')).toHaveLength(1);
    expect(screen.getByTestId('dau-doc_tin')).toHaveAttribute('aria-expanded', 'false');
    // Phân tán chưa gặp: hai ô sau là —, KHÔNG phải "0%".
    expect(within(screen.getByTestId('giai-ky-nang')).queryByText('0%')).toBeNull();
    fireEvent.click(screen.getByTestId('dau-phan_tan'));
    expect(screen.queryByTestId('giai-ky-nang')).toBeNull();
  });

  it('trận thường ⇒ nhãn GHI VÀO THẺ, không nhãn bàn tập', () => {
    render(<MemoryRouter><GhiVaoThe the={{ ...THE_TAP, tinh_vao_the: true, ly_do_khong_tinh: null }} khoanhKhac={[]} /></MemoryRouter>);
    expect(screen.getByText(CHU_NANG_LUC.ghiVaoThe)).toBeInTheDocument();
    expect(screen.queryByText(CHU_NANG_LUC.banTap)).toBeNull();
  });

  it('⭐ MỘT khối: dải nằm TRONG khung PHONG CÁCH, SAU hạng — vừa chạm cũng ở trong, không hộp thứ hai', () => {
    const { container } = render(
      <MemoryRouter>
        <PhongCachKet pc={PC}><GhiVaoThe the={THE_TAP} khoanhKhac={KHOANH} /></PhongCachKet>
      </MemoryRouter>,
    );
    const tangNgoai = container.querySelectorAll(':scope > section');
    expect(tangNgoai).toHaveLength(1);
    const dai = screen.getByTestId('ghi-vao-the');
    expect(tangNgoai[0]!.contains(dai)).toBe(true);
    expect(dai.textContent).toContain('HÔM NAY BẠN VỪA CHẠM');
    const hang = screen.getByLabelText(/Hạng S\+/);
    expect(hang.compareDocumentPosition(dai) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

const THE_NGUOI: NangLucCuaToiDTO = {
  formula_version: 1, so_de: 3,
  nang_luc: [
    { id: 'cam_ket_tiet_kiem', bac: 'chung_minh', so_de_gap: 3, so_de_lam_duoc: 2, lan_dau_lam_duoc: '2026-09-09T03:00:00.000Z' },
    { id: 'doc_tin', bac: 'lam_duoc', so_de_gap: 3, so_de_lam_duoc: 1, lan_dau_lam_duoc: '2026-09-11T03:00:00.000Z' },
    { id: 'phan_tan', bac: 'gap_chua_vung', so_de_gap: 2, so_de_lam_duoc: 0, lan_dau_lam_duoc: null },
  ],
};
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

/** Màn THẺ kéo khối ra theo IntersectionObserver — jsdom không có, cho mọi khối "đã thấy". */
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

describe('(d) mặt THẺ — ba dấu in trên lá bài, qua route thật', () => {
  it('⭐ /tai-chinh/the: ba dấu nằm TRONG thẻ tính cách, đúng bậc; chi tiết theo người sau dấu', async () => {
    stubIO();
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: CHUA_GOI }],
      ['/me/dong-token', { status: 200, body: { dong: [] } }],
      ['/holdem/me/nang-luc', { status: 200, body: THE_NGUOI }],
    ]);
    renderAt('/ho-so/the');
    const the = await screen.findByTestId('the-tinh-cach');
    const dong = await within(the).findByTestId('the-ky-nang');
    for (const n of THE_NGUOI.nang_luc) {
      expect(within(dong).getByTestId(`dau-${n.id}`)).toHaveAttribute('data-bac', n.bac);
    }
    fireEvent.click(within(dong).getByTestId('dau-cam_ket_tiet_kiem'));
    expect(screen.getByTestId('giai-ky-nang').textContent).toMatch(/2\/2 đề khác nhau · lần đầu/);
    expect(screen.queryByText(CHU_NANG_LUC.chungMinhGiai)).toBeNull();
    fireEvent.click(within(dong).getByTestId('dau-phan_tan'));
    expect(screen.getByText(CHU_NANG_LUC.chungMinhGiai)).toBeInTheDocument();
  });

  /*
   * ⭐⭐ D404 — CỬA 2 ở đường Hồ sơ → Thẻ. Server trả `the_dang_giu` khi tester chưa nộp Phiếu 2; mặt THẺ phải nói đúng
   * câu D370 và KHÔNG vẽ dấu nào. Im lặng (ô trống) thì người ta tưởng thẻ hỏng — đúng lỗi lượt soi 23/09 tả.
   */
  it('⭐⭐ D404 — thẻ đang GIỮ (chưa nộp Phiếu 2): nói câu D370, không một dấu kỹ năng nào', async () => {
    stubIO();
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: CHUA_GOI }],
      ['/me/dong-token', { status: 200, body: { dong: [] } }],
      ['/holdem/me/nang-luc', { status: 200, body: { formula_version: 1, so_de: 0, nang_luc: [], the_dang_giu: true } }],
    ]);
    renderAt('/ho-so/the');
    const the = await screen.findByTestId('the-tinh-cach');
    const giu = await within(the).findByTestId('the-dang-giu');
    expect(giu.textContent).toBe(CHU_CHE_DO_TESTER.theDangGiu);
    expect(within(the).queryByTestId('the-ky-nang')).toBeNull();
    for (const id of NANG_LUC_IDS) expect(screen.queryByTestId(`dau-${id}`)).toBeNull();
  });

  it('⚠ tab NĂNG LỰC không mọc lại — kỹ năng sống trên mặt THẺ, không trên tab thứ năm', () => {
    expect(TAB_TAI_CHINH.map((t) => t.nhan)).not.toContain('NĂNG LỰC');
    expect(TAB_TAI_CHINH.some((t) => t.duong.includes('nang-luc'))).toBe(false);
  });
});
