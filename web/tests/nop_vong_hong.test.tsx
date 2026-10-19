/**
 * D414 — CÚ NỘP VÒNG HỎNG, hai nửa còn lại sau D412 (D412 làm nút sống lại; đây là thứ cú bấm lại mang theo, và nhịp
 * cái máy tự hỏi lại). Bàn đấu THẬT qua route thật, như `su_co_khai` / `dongho`.
 *
 *  §I   Hàng lệnh SỐNG qua cú nộp hỏng khi vòng CHƯA tiến: rớt mạng ⇒ đồng bộ lại (cùng vòng) ⇒ bấm CHỐT VÒNG lại theo
 *       lời băng lỗi ⇒ POST thứ hai mang ĐÚNG lệnh đã xếp. Trước D414 đồng bộ lại xoá sạch lựa chọn ⇒ cú bấm lại nộp
 *       một vòng KHÔNG LỆNH, im lặng.
 *  §II  Vòng ĐÃ tiến (409 `sai_vong`, server đứng vòng sau) ⇒ lựa chọn của vòng đã đóng phải đi — vế ngược, không để
 *       §I thành "không bao giờ xoá".
 *  §III Tự-nộp hết giờ GIÃN NHỊP khi cứ hỏng: trước D414 mỗi ~1 s một POST + một GET vào đúng máy chủ đang hỏng (C2).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch, type RecordedCall } from './helpers';
import { resetCamBienMang, choThuLaiMs } from '../src/api/mang';

const CATALOG = {
  engine_version: 'e-nvh', balance_version: 'b-nvh',
  luat: {
    SEATS: 5, START_VON: 10000, CAM_KET_NEN: 500, MAX_TAI_SAN: 4,
    MAX_CHIEN_THUAT: 2, SHOP_TAI_SAN: 3, SHOP_CHIEN_THUAT: 2,
    CHI_PHI_KHAO_SAT_LAI: 2, TRAN_TANG_CAM_KET_BP: 4000, PHI_BANG_DIEN_TU: 25,
    BUOC_MOC_THO_BP: 2500, BUOC_MOC_BP: 500,
  },
  nhip_chon_bai: ['tai_san', 'tai_san', 'tai_san', 'tai_san', 'tai_san', 'tai_san', 'khong', 'khong'],
  cap_stack_bp: [10000, 16000, 20000],
  quyet_dinh: { MAP_SIZE: 8, SHOWDOWN_MODEL: 'A' },
  tai_san: [{ id: 'btc', label: 'BTC', icon: '₿', nhom: 'rui_ro', thanh_khoan: 'mong', bien_dong_bp: 400 }],
  chien_thuat: [], giai_doan: [{ id: 'di_ngang', label: 'Đi ngang', icon: '➖' }],
  su_kien: [], tu_dien: { tai_san: {}, chien_thuat: {} }, khau_vi: [],
};

const ban = {
  von: 9000, tien_mat: 9000, vi_the: {}, luot_khao_sat: 1,
  danh_muc: { tai_san: [], chien_thuat: [] }, da_chay: false, tu_the: 'choi',
  vong_roi: null, so_lan_cat_lo: 0, con_lai_cat_lo: 1, khau_vi: 'can_bang',
  fx: 'binh_thuong', nav: 9000,
};

/** Trận NAV có shop (btc) — `dh` đè đồng hồ. Không `doc_s` ⇒ không pha ĐỌC, shop mở được ngay. */
const tran = (vong: number, dh: Record<string, unknown> = { con_lai_s: 30, tong_s: 40 }) => ({
  match_id: 'm-nvh', vong, tong_vong: 8, status: 'dang_choi',
  dong_ho: { het_gio: false, an_han_s: 8, ...dh },
  ban, doi_thu: [], so_nguoi_song: 1,
  o_hien_tai: { kind: 'giai_doan', giai_doan: 'di_ngang' },
  lich_su_o: [], telegraph: null,
  bo_bai_con_lai: { con_lai: 5, so_giai_doan: 3, so_su_kien: 2, tin_gia_ky_vong: 1 },
  quy_vong_hien_tai: 500,
  shop: { tai_san: ['btc'], chien_thuat: [], chi_phi_lan_sau: 2 },
  loi_von: null,
});

const ketQuaVong4 = {
  vong: 4, o: { kind: 'giai_doan', giai_doan: 'di_ngang' },
  tin_gia_lo: null, quy_vong: 500, ghe_thang: 'ban', chay_vong_nay: [],
  cua_ban: null, cua_doi_thu: [], phi_cua_ban: null, ty_le_cat_lo_bp: 0,
};

const post = (calls: RecordedCall[]) => calls.filter((c) => c.method === 'POST' && c.url.includes('/rounds'));
const getTran = (calls: RecordedCall[]) => calls.filter((c) => c.method === 'GET' && /\/holdem\/matches\/m-nvh$/.test(c.url));

/** Mở shop, cầm chip 50%, chạm lá BTC ⇒ một lệnh `{btc, mua, 5000}` nằm trong hàng đợi của màn. */
function xepLenhMuaBtc() {
  fireEvent.click(document.querySelector('[data-tap="nut-shop"]') as HTMLButtonElement);
  // D540 — chạm thẻ trước, chip mọc trên phiếu lệnh của thẻ.
  fireEvent.click(document.querySelector('[data-card="btc"]') as HTMLButtonElement);
  fireEvent.click(screen.getByRole('button', { name: '50%' }));
}
/** Bấm CHỐT VÒNG còn bấm được (shop hoặc bàn — bất kỳ cái nào đang sống). */
function bamChot() {
  const nut = screen.getAllByRole('button', { name: /CHỐT VÒNG/ }).find((b) => !(b as HTMLButtonElement).disabled);
  expect(nut, 'không còn nút CHỐT VÒNG nào bấm được').toBeTruthy();
  fireEvent.click(nut!);
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('§I — hàng lệnh sống qua cú nộp hỏng khi vòng CHƯA tiến', () => {
  it('⭐ rớt mạng ⇒ đồng bộ lại cùng vòng ⇒ bấm lại ⇒ POST thứ hai mang đúng lệnh đã xếp', { timeout: 20_000 }, async () => {
    resetCamBienMang();
    const calls = stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: CATALOG }],
      ['/holdem/art', { status: 200, body: { version: 'a', art: {} } }],
      ['/holdem/matches/m-nvh/rounds', {
        failFirst: 1, status: 200, body: { ...tran(5), ket_qua_vong: ketQuaVong4 },
      }],
      // Server VẪN đứng vòng 4 — cú nộp đầu chưa từng tới nơi.
      ['/holdem/matches/m-nvh', { status: 200, body: tran(4) }],
    ]);
    renderAt('/arena/tran/m-nvh');
    await screen.findByText(/còn \d+ ô/, {}, { timeout: 5000 });

    xepLenhMuaBtc();
    bamChot();
    // Cú 1 rớt mạng ⇒ màn hỏi lại server (GET sau POST) ⇒ nút sống lại (D412).
    await vi.waitFor(() => {
      expect(post(calls)).toHaveLength(1);
      const i = calls.indexOf(post(calls)[0]!);
      expect(getTran(calls.slice(i + 1)).length, 'nộp hỏng mà không đồng bộ lại').toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: /CHỐT VÒNG/ }).some((b) => !(b as HTMLButtonElement).disabled))
        .toBe(true);
    }, { timeout: 8000 });
    // Cho đồng bộ lại áp xong vào state trước khi bấm lại.
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    bamChot();
    await vi.waitFor(() => expect(post(calls)).toHaveLength(2), { timeout: 8000 });
    const hai = post(calls).map((c) => c.body as { vong: number; lenh?: unknown });
    expect(hai[0]!.lenh, 'tiền đề: cú đầu phải mang lệnh — không thì bài không đo gì')
      .toEqual([{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }]);
    expect(hai[1]!.vong, 'vẫn là vòng 4').toBe(4);
    expect(hai[1]!.lenh, 'đồng bộ lại cùng vòng đã XOÁ hàng lệnh ⇒ bấm lại nộp một vòng không lệnh')
      .toEqual([{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }]);
  });
});

describe('§II — vòng ĐÃ tiến thì lựa chọn của vòng cũ phải đi', () => {
  it('409 sai_vong, server đứng vòng 5 ⇒ cú nộp vòng 5 KHÔNG mang lệnh xếp ở vòng 4', { timeout: 20_000 }, async () => {
    resetCamBienMang();
    let lanGet = 0;
    const calls: RecordedCall[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? 'GET').toUpperCase();
      if (!url.includes('/telemetry')) {
        calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      }
      const tl = (status: number, body: unknown) => new Response(JSON.stringify(body), {
        status, headers: { 'content-type': 'application/json' },
      });
      if (url.includes('/auth/me')) return tl(200, ME_ONBOARDED);
      if (url.includes('/holdem/catalog')) return tl(200, CATALOG);
      if (url.includes('/holdem/art')) return tl(200, { version: 'a', art: {} });
      if (url.includes('/holdem/matches/m-nvh/rounds')) {
        // Cú đầu: vòng 4 đã chốt ở nơi khác. Cú sau (vòng 5): tới nơi.
        return (post(calls).length === 1)
          ? tl(409, { error: 'sai_vong', message: 'Vòng này đã chốt rồi.' })
          : tl(200, { ...tran(6), ket_qua_vong: { ...ketQuaVong4, vong: 5 } });
      }
      if (/\/holdem\/matches\/m-nvh$/.test(url)) {
        lanGet += 1;
        // GET đầu (vào màn) = vòng 4; mọi GET sau = server đã sang vòng 5.
        return tl(200, lanGet === 1 ? tran(4) : tran(5));
      }
      return tl(401, { error: 'unauthorized' });
    }));
    renderAt('/arena/tran/m-nvh');
    await screen.findByText(/còn \d+ ô/, {}, { timeout: 5000 });

    xepLenhMuaBtc();
    bamChot();
    await vi.waitFor(() => {
      expect(post(calls)).toHaveLength(1);
      // Màn đã sang vòng 5 của server (con số to nhất màn — `vongHienThi`, D376).
      expect(document.querySelector('[data-vong-man]')?.textContent).toBe('5');
    }, { timeout: 8000 });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    bamChot();
    await vi.waitFor(() => expect(post(calls)).toHaveLength(2), { timeout: 8000 });
    const b = post(calls)[1]!.body as { vong: number; lenh?: unknown };
    expect(b.vong).toBe(5);
    expect(b.lenh, 'lệnh của vòng ĐÃ ĐÓNG đi nhờ sang vòng mới').toBeUndefined();
  });
});

describe('§III — tự-nộp hết giờ giãn nhịp khi cứ hỏng (C2)', () => {
  it('thang giãn là thang tự dò của cảm biến mạng: 0 · 3 · 6 · 12 · 30 · 30 s', () => {
    expect([0, 1, 2, 3, 4, 9].map(choThuLaiMs)).toEqual([0, 3000, 6000, 12000, 30000, 30000]);
  });

  it('⭐ máy chủ hỏng suốt 60 s ⇒ tự-nộp VẪN hỏi lại nhưng giãn ra: 4–6 cú, không phải vài chục', { timeout: 30_000 }, async () => {
    resetCamBienMang();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const calls = stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: CATALOG }],
      ['/holdem/art', { status: 200, body: { version: 'a', art: {} } }],
      ['/holdem/matches/m-nvh/rounds', { failFirst: 999, status: 200, body: tran(5) }],
      // Đồng hồ đã chạm 0, server CHƯA tuyên hết giờ ⇒ client tự nộp sau ~1 s.
      ['/holdem/matches/m-nvh', { status: 200, body: tran(4, { con_lai_s: 0, tong_s: 25 }) }],
    ]);
    renderAt('/arena/tran/m-nvh');
    await screen.findByText(/còn \d+ ô/, {}, { timeout: 5000 });
    const t0 = post(calls).length;
    for (let i = 0; i < 60; i += 1) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    }
    const n = post(calls).length - t0;
    // Thang 3 · 6 · 12 · 30 s ⇒ các cú ở ~1 · 4 · 10 · 22 · 52 s = 5 cú trong 60 s.
    expect(n, 'tự-nộp bỏ cuộc — trận sẽ đứng im').toBeGreaterThanOrEqual(4);
    expect(n, 'tự-nộp không giãn: mỗi giây một POST vào máy chủ đang hỏng').toBeLessThanOrEqual(6);
  });

  it('đường tự-nộp THỨ HAI (đã all-in, nhịp 2 s) cũng giãn — hai đường, một thang', { timeout: 30_000 }, async () => {
    resetCamBienMang();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const allIn = { ...tran(4), ban: { ...ban, tu_the: 'all_in' } };
    const calls = stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/catalog', { status: 200, body: CATALOG }],
      ['/holdem/art', { status: 200, body: { version: 'a', art: {} } }],
      ['/holdem/matches/m-nvh/rounds', { failFirst: 999, status: 200, body: tran(5) }],
      // Đồng hồ còn DÀI (300 s) ⇒ chỉ đường all-in bắn, đường hết giờ D38 đứng yên.
      ['/holdem/matches/m-nvh', { status: 200, body: { ...allIn, dong_ho: { het_gio: false, an_han_s: 8, con_lai_s: 300, tong_s: 300 } } }],
    ]);
    renderAt('/arena/tran/m-nvh');
    await screen.findByText(/còn \d+ ô/, {}, { timeout: 5000 });
    for (let i = 0; i < 60; i += 1) {
      await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    }
    const n = post(calls).length;
    // Không giãn: ~2 s/cú ⇒ ~30 cú. Giãn: ~2 · 5 · 11 · 23 · 53 s ⇒ 5 cú.
    expect(n, 'đường all-in bỏ cuộc — board không chạy tiếp').toBeGreaterThanOrEqual(4);
    expect(n, 'đường all-in không giãn: 2 s một POST vào máy chủ đang hỏng').toBeLessThanOrEqual(6);
  });
});
