/**
 * ORACLE KHÔNG CHE NÚT — màn bento (Hub · sảnh Alpha Draft). Mẹ quyết 11/10 (ảnh cặp của cửa sổ Hub: bong bóng Oracle CHỒNG lên nút VÀO TRẬN):
 * *"bong bóng Oracle … KHÔNG BAO GIỜ che nút chính hay ô bấm ở Hub, sảnh Alpha Draft và màn kết"*.
 *
 * Cách giải (xem đầu `OracleChat.tsx`, chế độ `neoCho`): màn bento DÀNH SẴN một ô `[data-oracle-cho]` ở hàng đầu (không nút/ô bấm nào trong
 * đó) và Oracle chỉ là avatar nhỏ NẰM ĐÚNG Ô ĐÓ; bấm mới bung lời; bung xuống từ ô; gập khi bấm lại · chạm ra ngoài · Esc · đổi route.
 * Màn kết thuộc route TOÀN TÂM (`toanMan`) — AppShell không dựng Oracle ở đó (bài `oracle_chat` §"KHÔNG hiện ở màn toàn tâm").
 *
 * jsdom KHÔNG có layout ⇒ bài này khoá HỢP ĐỒNG (head nằm đúng hộp của ô giữ sẵn · ô không chứa nút · không tự bung · gập đúng lúc) bằng hộp
 * GIẢ do bài tự gán. ĐO THẬT (`getBoundingClientRect`: head ∩ mọi nút/ô bấm = rỗng ở 390×812 và 360×640, cả khi mạng chậm) nằm ở kịch bản
 * trình duyệt `tests/luong/trinh-duyet/alpha_draft_bento.mjs`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import { CANH_ORACLE_NEO } from '@/components/OracleChat';
import { ME_ONBOARDED, stubFetch } from './helpers';

vi.setConfig({ testTimeout: 30_000 });
const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const HS = {
  tinh_cach: 'dang_dinh_hinh', khau_vi: null, net: null, bac_doc: 'chua', n_vong: 16, n_tran: 2, brier_chuoi: [],
  chi_so: { hieu_chinh: null, duoi_gia: null, theo_tin: null, chot_non: null, don_von: null, mua_tin: null, khau_vi: null },
  goi: null, tien_do: { tran: 6, vong_quyet: 42, vong_su_kien: 15, can: { tran: 10, vong_quyet: 40, vong_su_kien: 8 }, day: false }, lich_su: [],
};
const CATALOG = {
  engine_version: 'x', balance_version: 'v66', luat: { START_VON: 10000 }, nhip_chon_bai: [], cap_stack_bp: [10000],
  quyet_dinh: { MAP_SIZE: 14, CO_MAP_CHON: [14], MAP_MAC_DINH_SANH: 14 }, tai_san: [], chien_thuat: [], giai_doan: [], su_kien: [],
  tu_dien: { tai_san: {}, chien_thuat: {} }, khau_vi: [], khau_vi_tat: true,
};
const stubApp = () => stubFetch([
  ['/auth/me', { status: 200, body: ME_ONBOARDED }],
  ['/holdem/me/tinh-cach', { status: 200, body: HS }],
  ['/holdem/catalog', { status: 200, body: CATALOG }],
  ['/holdem/me/tien-do', { status: 200, body: { so_tran_xong: 7, co_map: [14], khau_vi: false, con_thieu: {} } }],
  ['/holdem/me/matches', { status: 200, body: { tran: [] } }],
  ['/holdem/ngay', { status: 200, body: { ma: 'q7p2z', so_o: 14, het_han: new Date(Date.now() + 3_600_000).toISOString(), created_at: 'x', loai: 'ngay', chu: 'D', la_chu: false, so_nguoi: 1, toi: null, toi_da_xong: false, doi: [], thu_thach: { ngay: '2026-10-11', so_nguoi_vao: 1, so_nguoi_xong: 0 } } }],
  ['/me/nhiem-vu', { status: 200, body: { mua_mo: true, tuan: 1, so_tuan: 4, chang: 1, so_chang: 30, quest_points: 0, viec: [], da_diem_danh_hom_nay: true, moc: [] } }],
]);

/** Ô giữ sẵn nằm ở ĐÂY (hộp giả — jsdom không có layout): góc trên phải của khung 390×812, đúng chỗ ô thật ở cuối hàng đầu. */
const HOP = { x: 338, y: 20, w: CANH_ORACLE_NEO, h: CANH_ORACLE_NEO };
function giaHop() {
  const goc = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function viTri(this: Element) {
    if (this.hasAttribute('data-oracle-cho')) {
      return { x: HOP.x, y: HOP.y, left: HOP.x, top: HOP.y, right: HOP.x + HOP.w, bottom: HOP.y + HOP.h, width: HOP.w, height: HOP.h, toJSON: () => ({}) } as DOMRect;
    }
    return goc.call(this);
  };
  return () => { Element.prototype.getBoundingClientRect = goc; };
}

function dung(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<QueryClientProvider client={makeQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}
const head = () => document.querySelector('[data-testid="oracle-head"]') as HTMLElement | null;
const bongBong = () => document.querySelector('[data-testid="oracle-chat"]') as HTMLElement | null;

let tra: () => void;
beforeEach(() => { localStorage.clear(); tra = giaHop(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); tra(); });

describe('I. Oracle NẰM TRONG ô giữ sẵn — cả hai màn bento', () => {
  for (const [ten, path, cho] of [['Hub', '/', '[data-o="arena"]'], ['sảnh Alpha Draft', '/arena', '[data-o="may"]']] as const) {
    it(`⭐⭐ ${ten}: avatar Oracle đúng hộp ô giữ sẵn (x·y·rộng·cao), cỡ ${CANH_ORACLE_NEO}, KHÔNG tự bung dù trạng thái nhớ là "đang mở"`, async () => {
      // Trạng thái nhớ `mo: true` + cạnh trái + thấp: bản cũ bung ngay ở vị trí NHỚ và đè nút chính. Luật mới: bỏ qua cả hai.
      localStorage.setItem('delphi.oracle', JSON.stringify({ mo: true, cau_da_doc: '', canh: 'trai', y: 0.95 }));
      stubApp();
      dung(path);
      await waitFor(() => expect(document.querySelector(cho)).toBeTruthy());
      const h = await waitFor(() => { const e = head(); expect(e).toBeTruthy(); return e!; });
      expect(h.hasAttribute('data-neo-cho')).toBe(true);
      await waitFor(() => {
        expect(h.style.left).toBe(`${HOP.x}px`);
        expect(h.style.top).toBe(`${HOP.y}px`);
        expect(h.style.width).toBe(`${HOP.w}px`);
        expect(h.style.height).toBe(`${HOP.h}px`);
      });
      expect(bongBong(), 'bong bóng tự bung đè lên màn').toBeNull();
    });

    it(`⭐ ${ten}: ô giữ sẵn KHÔNG nằm trong nút/liên kết và KHÔNG chứa nút/ô bấm — nơi duy nhất Oracle được đứng`, async () => {
      stubApp();
      dung(path);
      const cho_ = await waitFor(() => { const e = document.querySelector('[data-oracle-cho]'); expect(e).toBeTruthy(); return e!; });
      expect(cho_.closest('button, a, [role="button"], [data-o]')).toBeNull();
      expect(cho_.querySelector('button, a, input, [data-o], [role="button"]')).toBeNull();
      expect(document.querySelectorAll('[data-oracle-cho]'), 'hai ô giữ sẵn ⇒ không biết Oracle đứng đâu').toHaveLength(1);
    });
  }
});

describe('II. Bấm mới bung — và gập đúng lúc', () => {
  it('⭐ chạm ⇒ bung XUỐNG dưới ô giữ sẵn, mép phải khớp mép phải ô; chạm lại ⇒ gập', async () => {
    stubApp();
    dung('/');
    fireEvent.click(await waitFor(() => { const e = head(); expect(e).toBeTruthy(); return e!; }));
    const b = await waitFor(() => { const e = bongBong(); expect(e).toBeTruthy(); return e!; });
    expect(b.style.top).toBe(`${HOP.y + HOP.h + 6}px`);
    expect(b.style.right).toBe(`${Math.max(10, document.documentElement.clientWidth - (HOP.x + HOP.w))}px`);
    expect(head()!.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(head()!);
    await waitFor(() => expect(bongBong()).toBeNull());
    expect(head()!.getAttribute('aria-expanded')).toBe('false');
  });

  it('⭐ chạm RA NGOÀI hoặc Esc ⇒ gập (lời không chặn thao tác bên dưới quá một cú chạm)', async () => {
    stubApp();
    dung('/');
    fireEvent.click(await waitFor(() => { const e = head(); expect(e).toBeTruthy(); return e!; }));
    await waitFor(() => expect(bongBong()).toBeTruthy());
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(bongBong()).toBeNull());
    fireEvent.click(head()!);
    await waitFor(() => expect(bongBong()).toBeTruthy());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(bongBong()).toBeNull());
  });

  it('⭐ chạm TRONG bong bóng thì KHÔNG gập (bấm tua chữ không được tự đóng)', async () => {
    stubApp();
    dung('/');
    fireEvent.click(await waitFor(() => { const e = head(); expect(e).toBeTruthy(); return e!; }));
    const b = await waitFor(() => { const e = bongBong(); expect(e).toBeTruthy(); return e!; });
    fireEvent.pointerDown(b.querySelector('button')!);
    expect(bongBong()).toBeTruthy();
  });

  it('⭐ ĐỔI ROUTE (Hub → sảnh) khi đang bung ⇒ gập; không nhớ "đã mở" (không tự bung ở màn sau)', async () => {
    stubApp();
    const router = dung('/');
    fireEvent.click(await waitFor(() => { const e = head(); expect(e).toBeTruthy(); return e!; }));
    await waitFor(() => expect(bongBong()).toBeTruthy());
    await router.navigate('/arena');
    await waitFor(() => expect(document.querySelector('[data-o="may"]')).toBeTruthy());
    await waitFor(() => expect(head()).toBeTruthy());
    expect(bongBong(), 'lời tự bung lại ở màn sau').toBeNull();
    // (Lần mở app sau cũng KHÔNG tự bung dù máy nhớ `mo: true` — bài I; neo ô giữ sẵn bỏ qua cờ `mo`.)
  });
});

describe('III. Ngoài bento & màn toàn tâm — hành vi cũ giữ nguyên', () => {
  it('⭐ màn THƯỜNG (/vi): vẫn nổi, KHÔNG neo ô giữ sẵn (không `data-neo-cho`), mờ cho tới khi chạm', async () => {
    stubApp();
    dung('/vi');
    const h = await waitFor(() => { const e = head(); expect(e).toBeTruthy(); return e!; });
    expect(h.hasAttribute('data-neo-cho')).toBe(false);
    expect(h.getAttribute('data-mo')).toBe('co');
  });

  it('⭐ màn kết / bàn đấu (toàn tâm): KHÔNG Oracle nào — không thể che nút của màn kết', async () => {
    stubFetch([
      ['/auth/me', { status: 200, body: ME_ONBOARDED }],
      ['/holdem/me/tinh-cach', { status: 200, body: HS }],
      ['/holdem/matches/', { status: 404, body: { error: 'not_found', message: 'x' } }],
    ]);
    dung('/arena/tran/m-xx');
    await waitFor(() => expect(screen.queryByLabelText('Menu chính')).toBeNull());
    expect(head()).toBeNull();
    expect(bongBong()).toBeNull();
  });
});

describe('IV. Cấu trúc (dây nối — "cơ chế trang trí" là bẫy số 1 của repo)', () => {
  it('⭐ AppShell đưa `dauSanh` vào OracleChat; route Hub + sảnh + link mời khai `dauSanh`', () => {
    // 11/10: bốn tab tài chính (`khungPfm`) cũng neo Oracle vào ô giữ sẵn của dải tab ⇒ cờ gộp `bentoKhongCuon = dauSanh || khungPfm`.
    expect(doc('src/app/AppShell.tsx')).toMatch(/const bentoKhongCuon = dauSanh \|\| khungPfm;/);
    expect(doc('src/app/AppShell.tsx')).toMatch(/<OracleChat neoCho=\{bentoKhongCuon\} \/>/);
    const r = doc('src/app/routes.tsx');
    expect(r).toMatch(/const hSanh = hHub;/);
    expect(r).toMatch(/path: ROUTE_ARENA, element: <AlphaDraftLobby \/>, handle: hSanh\('ALPHA-DRAFT'\)/);
    expect(r).toMatch(/path: '\/arena\/ban\/:banMa', element: <AlphaDraftLobby \/>, handle: hSanh\('ALPHA-DRAFT'\)/);
  });

  it('⭐ ô giữ sẵn có ở cả hai màn và ĐỨNG CUỐI hàng đầu (x không phụ thuộc chữ tên / số ví)', () => {
    const hub = doc('src/screens/Hub.tsx');
    const sanh = doc('src/screens/holdem/AlphaDraftLobby.tsx');
    expect(hub).toMatch(/data-oracle-cho/);
    expect(sanh).toMatch(/data-oracle-cho/);
    // Hub: ô nằm SAU `.taiSan` (ví) — cuối `.dau`. Sảnh: SAU nút sách — cuối `.dau`.
    expect(hub.indexOf('data-oracle-cho')).toBeGreaterThan(hub.indexOf('<ViToken'));
    expect(sanh.indexOf('data-oracle-cho')).toBeGreaterThan(sanh.indexOf('data-testid="nut-bach-khoa"'));
    for (const f of ['src/screens/Hub.module.css', 'src/screens/holdem/AlphaDraftLobby.module.css']) {
      expect(doc(f).replace(/\/\*[\s\S]*?\*\//g, ''), f).toMatch(new RegExp(`\\.choOracle\\s*\\{[^}]*flex:\\s*0 0 ${CANH_ORACLE_NEO}px`));
    }
  });
});

/*
 * ─── TIÊM NGƯỢC (đã chạy; số ở báo cáo/commit) ───────────────────────────────────────────────────────────────────────────────
 *  a. AppShell gọi `<OracleChat />` (bỏ `neoCho`) ⇒ I (cả hai màn) + II + IV đỏ.      b. đặt `data-oracle-cho` BÊN TRONG một OBento ⇒ I (ô giữ sẵn không nằm trong nút) đỏ.
 *  c. bong bóng neo hiện theo cờ `mo` nhớ (`moNeo || mo`) ⇒ I (không tự bung) đỏ.   d. bỏ `setMoNeo(false)` khi đổi route ⇒ II (đổi route) đỏ.
 *  e. bỏ listener `pointerdown` ngoài ⇒ II (chạm ra ngoài) đỏ.                         f. chuyển ô giữ sẵn lên ĐẦU hàng Hub ⇒ IV (đứng cuối) đỏ.
 */
