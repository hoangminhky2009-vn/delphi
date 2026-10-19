/**
 * HUB BENTO — SPEC `docs/spec/ui-tang-khong-gian.md` mục 5 + 5b (THI CÔNG, demo CHỐT 11/10).
 *
 * Bài này thay hai luật cũ của `hub_bo_mat.test.tsx` mà SPEC (10/10) đã đổi: "Hub là CỬA không con số" và "Hub chỉ một query".
 * Luật MỚI: **Hub có số, 0 REQUEST MỚI** — chỉ `/auth/me` · `/me/nhiem-vu` · sổ trên máy. Bốn bài của SPEC §5:
 *   (a) mặt màn KHÔNG chứa `moTa`/`tagline` khi lớp trượt đóng, CÓ khi mở (và không kê đơn — A10);
 *   (b) Hub không gọi endpoint nào ngoài `/auth/me` · `/me/nhiem-vu` (đếm fetch);
 *   (c) khách ⇒ ô KHÔNG in "0" (D62);
 *   (d) chạm ô Đấu trường ⇒ `navigate(ROUTE_ARENA)` MỘT bước.
 * + SPEC 5b: chỗ giữ sẵn khi tải · lỗi có thử lại · bấm đúp không gửi trùng · lớp trượt đóng/trả focus/đổi route · không route chết.
 *
 * ⚠ Hub tắt header chung (`dauSanh`) nên ví chỉ có MỘT nơi — bài canh "không in số hai nơi".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hub } from '@/screens/Hub';
import { routes } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import type { MeResponse } from '@/api/types';
import { CHU_HUB, NHAN_MUA } from '@/lib/hub_chu';
import { tuKeDonTrong } from '@/lib/khoanh_khac';
import {
  DESC_ARENA, DESC_FINANCE, DESC_PREDICT, ROUTE_ARENA, ROUTE_HANH_TRINH, ROUTE_PREDICT, ROUTE_TAI_CHINH, ROUTE_TOKEN,
} from '@/lib/vocab';
import { KhoTrongBoNho } from '@/pfm/kho';
import { dungKhoCoSan, quenLuotMo } from '@/pfm/dung_kho';
import { khoanRaBanGhi, taoKhoan } from '@/pfm/so';
import { congNgay, homNay } from '@/pfm/thoi_gian';
import { tuTao } from '@/pfm/hu';
import { ME_ONBOARDED, stubFetch, type StubRoute } from './helpers';

/*
 * SPEC chan-truoc-beta — khu Tài chính đang KHOÁ trên web (`lib/pfm_mo.ts`). Tệp này đo khu ấy ở trạng thái MỞ — mã của trạng thái
 * mở vẫn còn nguyên cho ngày mở lại (điều kiện ở `pfm_mo.ts`), nên GHIM cờ bật thay vì bỏ bài. Trạng thái KHOÁ: `pfm_khoa_web.test.tsx`.
 */
vi.mock('@/lib/pfm_mo', () => ({ PFM_WEB_MO: true }));

const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const ma = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const cho = (ms: number) => new Promise((r) => { setTimeout(r, ms); });
/* Hub nạp trễ banner + sổ tài chính (vite biên dịch chunk lần đầu): bộ test gốc chạy song song nên cho dư — chỉ nới ĐỒNG HỒ, không nới khẳng định nào. */
vi.setConfig({ testTimeout: 60_000 });
const CHO_CHUNK = { timeout: 20_000 };

const ME_THAT: MeResponse = { ...ME_ONBOARDED, user: { ...ME_ONBOARDED.user!, la_khach: false } };
const ME_KHACH: MeResponse = { ...ME_ONBOARDED, user: { ...ME_ONBOARDED.user!, la_khach: true, handle: 'khach_1' } };

const VIEC = [
  { nv_id: 'v1', ten: 'Chơi 3 trận Alpha Draft', muc: 3, da: 3, xong: true },
  { nv_id: 'v2', ten: 'Ghi sổ 5 ngày', muc: 5, da: 5, xong: true },
  { nv_id: 'v3', ten: 'Chốt sổ tuần', muc: 1, da: 1, xong: true },
  { nv_id: 'v4', ten: 'Thử một lá mới', muc: 1, da: 0, xong: false },
];
const LT = {
  mua_mo: true, tuan: 3, so_tuan: 4, chang: 2, so_chang: 30, quest_points: 10, viec: VIEC, da_diem_danh_hom_nay: false, moc: [],
};

type Bang = [string, StubRoute][];
const bang = (me: MeResponse, lt: unknown = LT, them: Bang = []): Bang => [
  ...them,
  ['/me/nhiem-vu/diem-danh', { status: 200, body: { ...(lt as object), da_diem_danh_hom_nay: true } }],
  ['/me/nhiem-vu', { status: 200, body: lt }],
  ['/auth/me', { status: 200, body: me }],
];

/** Hub CÔ LẬP (không AppShell/BottomNav/Oracle) — để đếm ĐÚNG request của chính Hub. */
function renderHubCoLap() {
  const router = createMemoryRouter([
    { path: '/', element: <Hub /> },
    { path: ROUTE_ARENA, element: <div>MAN_ARENA</div> },
    { path: ROUTE_PREDICT, element: <div>MAN_PREDICT</div> },
    { path: ROUTE_TAI_CHINH, element: <div>MAN_TAI_CHINH</div> },
    { path: ROUTE_HANH_TRINH, element: <div>MAN_HANH_TRINH</div> },
    { path: ROUTE_TOKEN, element: <div>MAN_TOKEN</div> },
    { path: '/onboard', element: <div>MAN_ONBOARD</div> },
    { path: '/bach-khoa/:id', element: <div>MAN_BACH_KHOA</div> },
  ], { initialEntries: ['/'] });
  render(<QueryClientProvider client={makeQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}

/** Cả app (có AppShell) tại `path`, trả router để kiểm lịch sử. */
function renderApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<QueryClientProvider client={makeQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}

const o = (dau: string) => document.querySelector(`[data-o="${dau}"]`) as HTMLElement;
const tamMo = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
async function chamO(dau: string) { fireEvent.click(await waitFor(() => { const e = o(dau); expect(e).toBeTruthy(); return e; })); }
/** Giữ 0,45 s bằng sự kiện con trỏ rồi thả (ô đi-thẳng). */
async function giuO(dau: string, ten = 'pointerDown') {
  const e = await waitFor(() => { const x = o(dau); expect(x).toBeTruthy(); return x; });
  fireEvent.pointerDown(e, { pointerType: 'touch' });
  await cho(560);
  fireEvent.pointerUp(e, { pointerType: 'touch' });
  void ten;
}
/** Sau Back: chờ Hub THẬT dựng lại (không phải ô cũ còn sót trong lúc chuyển route). */
async function veHub(router: ReturnType<typeof createMemoryRouter>) {
  await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  await waitFor(() => expect(screen.queryByText(/^MAN_/)).toBeNull());
  await waitFor(() => expect(o('mua')).toBeTruthy());
}
async function dongTam() {
  fireEvent.click(within(tamMo()!).getByText(CHU_HUB.dong));
  await waitFor(() => expect(tamMo()).toBeNull());
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); quenLuotMo(); });

describe('(a) mặt ô KHÔNG chứa mô tả / tagline khi lớp trượt đóng — CÓ khi mở', () => {
  const MO_TA = [DESC_ARENA, DESC_FINANCE, DESC_PREDICT, CHU_HUB.labCho, 'Admin đang chạy thận'];

  it('⭐⭐ lớp đóng: không một chữ mô tả · tagline · lý do khoá nào có trên màn', async () => {
    stubFetch(bang(ME_THAT));
    renderHubCoLap();
    await waitFor(() => expect(o('mua')!.textContent).toMatch(/3/));
    const chu = document.body.textContent ?? '';
    for (const m of MO_TA) expect(chu, `mô tả "${m.slice(0, 30)}…" đang nằm trên MẶT màn`).not.toContain(m);
    expect(chu).not.toMatch(/earn token|climb rank|track • plan|analyze • insight/i);
    expect(tamMo(), 'lớp trượt phải KHÔNG có trong DOM khi đóng').toBeNull();
  });

  it('⭐ chạm Tài chính / Mùa / Lab và giữ Predict · Đấu trường ⇒ lớp mở có ĐÚNG mô tả; đóng thì biến mất khỏi DOM', async () => {
    stubFetch(bang(ME_THAT));
    renderHubCoLap();
    await chamO('tai-chinh');
    // Ruột Tài chính là chunk NẠP TRỄ: khung trượt có ngay, chữ về sau một nhịp.
    // (lần đầu trong tiến trình phải biên dịch cả tầng PFM — hạn riêng, không phải nới hạn chung.)
    await waitFor(() => expect(tamMo()!.textContent).toContain(DESC_FINANCE), { timeout: 20_000 });
    await dongTam();
    await chamO('mua');
    expect((await screen.findByRole('dialog')).textContent).toContain(CHU_HUB.muaMoTa);
    await dongTam();
    await chamO('lab');
    expect((await screen.findByRole('dialog')).textContent).toContain(CHU_HUB.labCho);
    await dongTam();
    await giuO('predict');
    expect((await screen.findByRole('dialog')).textContent).toContain(DESC_PREDICT);
    expect(tamMo()!.textContent).toMatch(/EARN TOKEN/);
    await dongTam();
    await giuO('arena');
    const arena = (await screen.findByRole('dialog')).textContent ?? '';
    expect(arena).toContain(DESC_ARENA);
    // §1.2: trận KHÔNG bao giờ đẻ T/Q — lớp của Đấu trường cấm chữ "Earn Token".
    expect(arena).not.toMatch(/earn token/i);
    await dongTam();
    for (const m of MO_TA) expect(document.body.textContent).not.toContain(m);
  });

  it('A10: chữ trong MỌI lớp trượt không có từ kê đơn', async () => {
    stubFetch(bang(ME_THAT));
    renderHubCoLap();
    const chu: string[] = [];
    for (const dau of ['tai-chinh', 'mua', 'lab']) {
      await chamO(dau);
      chu.push((await screen.findByRole('dialog')).textContent ?? '');
      await dongTam();
    }
    await giuO('predict'); chu.push((await screen.findByRole('dialog')).textContent ?? ''); await dongTam();
    await giuO('arena'); chu.push((await screen.findByRole('dialog')).textContent ?? ''); await dongTam();
    await waitFor(() => expect(document.querySelector('[data-banner]')).toBeTruthy(), CHO_CHUNK);
    fireEvent.click(document.querySelector('[data-banner]')!);
    chu.push((await screen.findByRole('dialog')).textContent ?? '');
    // Copy khoá Lab là NGUYÊN VĂN founder (15/08, "hãy quay lại sau") — bộ quét A10 là của chữ bách khoa/gợi ý, nên loại đúng câu ấy.
    for (const t of chu) expect(tuKeDonTrong(t.replace(CHU_HUB.labCho, '')), t.slice(0, 60)).toEqual([]);
  });
});

describe('(b) Hub KHÔNG thêm request — chỉ /auth/me · /me/nhiem-vu', () => {
  it('⭐⭐ mở Hub, mở mọi lớp trượt ⇒ fetch chỉ chạm hai endpoint ấy', async () => {
    const calls = stubFetch(bang(ME_THAT));
    renderHubCoLap();
    await waitFor(() => expect(o('mua')!.textContent).toMatch(/3/));
    for (const dau of ['tai-chinh', 'mua', 'lab']) { await chamO(dau); await screen.findByRole('dialog'); await dongTam(); }
    await waitFor(() => expect(document.querySelector('[data-banner]')).toBeTruthy(), CHO_CHUNK);
    fireEvent.click(document.querySelector('[data-banner]')!);
    await screen.findByRole('dialog');
    await dongTam();
    await cho(150);
    const duong = new Set(calls.map((c) => new URL(c.url, 'http://x').pathname.replace('/api/v1', '')));
    expect([...duong].sort(), `Hub gọi: ${[...duong].join(', ')}`).toEqual(['/auth/me', '/me/nhiem-vu']);
    // và MỖI endpoint đúng một lần — Hub không tự đẻ lượt gọi thứ hai.
    expect(calls.filter((c) => c.url.endsWith('/me/nhiem-vu')).length).toBe(1);
    expect(calls.filter((c) => c.url.endsWith('/auth/me')).length).toBe(1);
  });

  it('⭐ mã nguồn: Hub chỉ gọi hook dữ liệu `useMe` · `useLoTrinh` · `useDiemDanh` — thêm `useQuery` là đỏ', () => {
    const goi = [...ma(doc('src/screens/Hub.tsx')).matchAll(/\buse[A-Z]\w*\(/g)].map((x) => x[0].slice(0, -1));
    const du = goi.filter((g) => !['useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'useNavigate', 'useLocation'].includes(g));
    expect([...new Set(du)].sort()).toEqual(['useDiemDanh', 'useLoTrinh', 'useLunVung', 'useMe']);
  });
});

describe('(c) khách / chưa có sổ ⇒ ô KHÔNG in số 0', () => {
  it('⭐⭐ khách: ô Tài chính chỉ có icon + "CẦN TÀI KHOẢN" — không một chữ số', async () => {
    stubFetch(bang(ME_KHACH));
    renderHubCoLap();
    await waitFor(() => expect(o('tai-chinh')!.textContent).toContain(CHU_HUB.canTaiKhoan));
    expect(o('tai-chinh')!.textContent).not.toMatch(/\d/);
    // nút ĐĂNG KÝ vẫn trong khung; dòng miễn trừ token luôn có
    expect(screen.getByText(CHU_HUB.dangKyGiu)).toBeTruthy();
    expect(screen.getByText(CHU_HUB.mienTru)).toBeTruthy();
  });

  it('tài khoản thường CHƯA có sổ: icon + "GHI CHI TIÊU", không số 0 giả', async () => {
    stubFetch(bang(ME_THAT));
    dungKhoCoSan(new KhoTrongBoNho());
    renderHubCoLap();
    await waitFor(() => expect(o('tai-chinh')!.textContent).toContain(CHU_HUB.ghiChiTieu));
    expect(o('tai-chinh')!.textContent).not.toMatch(/\d/);
  });

  it('⭐ ĐANG TẢI = chỗ giữ sẵn: số hiện "—", KHÔNG "0" (Mùa chưa về · tài khoản chưa về)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));   // mạng treo
    renderHubCoLap();
    expect(o('mua')!.textContent).toContain('—');
    // nhãn "MÙA 0.0" là TÊN mùa, không phải số liệu — bỏ nó ra rồi mới đòi không chữ số.
    expect((o('mua')!.textContent ?? '').replace(NHAN_MUA, '')).not.toMatch(/\d/);
    expect(o('vi')!.textContent).toContain('— T');
    expect(document.body.textContent).not.toMatch(/(^|\D)0 T/);
  });
});

describe('ô Tài chính đọc SỔ TRÊN MÁY — mặc định hũ sao; chưa có sao ⇒ chi hôm nay', () => {
  async function dungKho(moHu: boolean) {
    const kho = new KhoTrongBoNho();
    const nay = homNay();
    const luc = new Date().toISOString();
    await kho.ghi('khoan', khoanRaBanGhi(taoKhoan({ ngay: nay, soTien: 85_000, chieu: 'chi' }, luc, 'k1')));
    await kho.ghi('khoan', khoanRaBanGhi(taoKhoan({ ngay: congNgay(nay, -1), soTien: 40_000, chieu: 'chi' }, luc, 'k2')));
    if (moHu) {
      const h = tuTao({ ten: 'Laptop mới', muc: 20_000_000, uuTien: 'cao' }, luc, 'h1');
      await kho.ghi('hu', { id: 'h1', thang: nay.slice(0, 7), suaLuc: luc, d: h });
      await kho.ghi('khoan', khoanRaBanGhi(taoKhoan({ ngay: nay, soTien: 5_000_000, chieu: 'chi', huId: 'h1' }, luc, 'kg')));
    }
    dungKhoCoSan(kho);
  }

  it('⭐ chưa hũ nào có sao ⇒ "chi hôm nay" + dải 7 ngày', async () => {
    stubFetch(bang(ME_THAT));
    await dungKho(false);
    renderHubCoLap();
    await waitFor(() => expect(o('tai-chinh')!.textContent).toContain(CHU_HUB.chiHomNay));
    expect(o('tai-chinh')!.textContent).toContain('85k');
    expect(o('tai-chinh')!.textContent).toContain(CHU_HUB.nay);
  });

  it('⭐⭐ có hũ ĐEO SAO (ưu tiên cao) ⇒ ô mặc định hiện HŨ ấy: tên · % · thanh', async () => {
    stubFetch(bang(ME_THAT));
    await dungKho(true);
    renderHubCoLap();
    await waitFor(() => expect(o('tai-chinh')!.textContent).toContain('Laptop mới'));
    expect(o('tai-chinh')!.textContent).toContain('25%');          // 5tr / 20tr
    expect(o('tai-chinh')!.textContent).not.toContain(CHU_HUB.chiHomNay);
  });

  it('người chơi TỰ CHỌN trong lớp trượt; lựa chọn nhớ trên máy', async () => {
    stubFetch(bang(ME_THAT));
    await dungKho(true);
    renderHubCoLap();
    await waitFor(() => expect(o('tai-chinh')!.textContent).toContain('Laptop mới'));
    await chamO('tai-chinh');
    const chonChi = await screen.findByRole('button', { name: 'CHI HÔM NAY' });
    fireEvent.click(chonChi);
    await waitFor(() => expect(o('tai-chinh')!.textContent).toContain(CHU_HUB.chiHomNay));
    expect(localStorage.getItem('hub_o_tai_chinh')).toBe('chi_hom_nay');
    localStorage.removeItem('hub_o_tai_chinh');
  });
});

describe('(d) chạm ô Đấu trường ⇒ navigate(ROUTE_ARENA) MỘT bước', () => {
  it('⭐⭐ VÀO TRẬN: một chạm sang /arena; bấm ĐÚP vẫn chỉ MỘT mục lịch sử (Back về Hub)', async () => {
    stubFetch(bang(ME_THAT));
    const router = renderHubCoLap();
    const nut = await screen.findByText(CHU_HUB.vaoTran);
    fireEvent.click(nut);
    fireEvent.click(nut);
    fireEvent.click(nut);
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTE_ARENA));
    await cho(250);
    expect(router.state.historyAction).toBe('PUSH');
    await router.navigate(-1);
    expect(router.state.location.pathname, 'Back phải về Hub, không về chính /arena').toBe('/');
  });

  it('Predict: chạm thẳng sang chợ; chạm ô ĐĂNG KÝ (khách) sang /onboard', async () => {
    stubFetch(bang(ME_KHACH));
    const router = renderHubCoLap();
    await chamO('predict');
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTE_PREDICT));
    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    fireEvent.click(await screen.findByText(CHU_HUB.dangKyGiu));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboard'));
  });
});

describe('(d2) ô đi-thẳng cũng không đẩy hai mục lịch sử khi bấm dồn', () => {
  it('⭐ Predict chạm 3 lần liền ⇒ MỘT mục; Back về Hub (không về chính chợ)', async () => {
    stubFetch(bang(ME_THAT));
    const router = renderHubCoLap();
    const e = await waitFor(() => { const x = o('predict'); expect(x).toBeTruthy(); return x; });
    fireEvent.click(e); fireEvent.click(e); fireEvent.click(e);
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTE_PREDICT));
    await cho(250);
    await router.navigate(-1);
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('lớp trượt: đóng bằng nền · Esc · nút; trả focus; đổi route thì đóng', () => {
  it('⭐ Esc đóng · chạm nền đóng · FOCUS trả về đúng ô đã mở', async () => {
    stubFetch(bang(ME_THAT));
    renderHubCoLap();
    const mua = await waitFor(() => { const e = o('mua'); expect(e).toBeTruthy(); return e; });
    mua.focus();
    fireEvent.click(mua);
    const lop = await screen.findByRole('dialog');
    // Focus phải được ĐƯA VÀO tấm trước (nếu không, "trả về" trùng với "chưa từng rời" ⇒ bài không bắt được lỗi quên trả).
    await waitFor(() => expect(lop.contains(document.activeElement), 'mở xong focus vào tấm').toBe(true));
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(tamMo()).toBeNull());
    expect(document.activeElement, 'focus phải trả về ô Mùa').toBe(mua);
    fireEvent.click(mua);
    await screen.findByRole('dialog');
    fireEvent.click(document.querySelector('[data-tam-nen]')!);
    await waitFor(() => expect(tamMo()).toBeNull());
  });

  it('⭐ VUỐT XUỐNG > 70 px đóng; vuốt ngắn thì nảy về; ngón bắt đầu TRÊN NÚT không kéo tấm', async () => {
    // jsdom không có PointerEvent ⇒ clientY không được gán; mượn MouseEvent (cùng nếp oracle_chat.test).
    if (!('PointerEvent' in window)) vi.stubGlobal('PointerEvent', globalThis.MouseEvent);
    stubFetch(bang(ME_THAT));
    renderHubCoLap();
    await chamO('lab');
    const lop = await screen.findByRole('dialog');
    const keo = (dich: Element, dy: number) => {
      fireEvent.pointerDown(dich, { clientX: 100, clientY: 400, pointerId: 1 });
      fireEvent.pointerMove(dich, { clientX: 100, clientY: 400 + dy, pointerId: 1 });
      fireEvent.pointerUp(dich, { clientX: 100, clientY: 400 + dy, pointerId: 1 });
    };
    keo(lop.querySelector('p')!, 40);                       // vuốt ngắn
    await cho(120);
    expect(tamMo(), 'vuốt 40 px không được đóng').toBeTruthy();
    keo(within(lop).getByText(CHU_HUB.dong), 200);          // bắt đầu trên nút ĐÓNG ⇒ không phải vuốt
    await cho(600);                                          // > HUB_TAM + 40: nếu bị coi là vuốt thì tấm đã gỡ khỏi DOM
    expect(tamMo(), 'ngón bắt đầu trên nút không được kéo tấm').toBeTruthy();
    keo(lop.querySelector('p')!, 160);                      // vuốt dài
    await waitFor(() => expect(tamMo()).toBeNull());
  });

  it('⭐ Hub mở lớp trượt rồi đổi route (Back/link) ⇒ lớp KHÔNG sống sót sang màn khác', async () => {
    stubFetch(bang(ME_THAT));
    const router = renderHubCoLap();
    await chamO('mua');
    await screen.findByRole('dialog');
    router.navigate(ROUTE_TOKEN);
    await waitFor(() => expect(screen.getByText('MAN_TOKEN')).toBeTruthy());
    expect(tamMo()).toBeNull();
    await router.navigate(-1);
    await waitFor(() => expect(o('mua')).toBeTruthy());
    expect(tamMo(), 'quay về Hub: lớp trượt đóng').toBeNull();
  });

  it('nút chính trong lớp đi đúng đích: MỞ TÀI CHÍNH · XEM HÀNH TRÌNH · MỞ CHỢ · bách khoa', async () => {
    stubFetch(bang(ME_THAT));
    const router = renderHubCoLap();
    await chamO('tai-chinh');
    fireEvent.click(await screen.findByText(CHU_HUB.moTaiChinh));
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTE_TAI_CHINH));
    await router.navigate(-1);
    await veHub(router);
    await chamO('mua');
    fireEvent.click(await screen.findByText(CHU_HUB.xemHanhTrinh));
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTE_HANH_TRINH));
    await router.navigate(-1);
    await veHub(router);
    await giuO('predict');
    fireEvent.click(await screen.findByText(CHU_HUB.moCho));
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTE_PREDICT));
    await router.navigate(-1);
    await veHub(router);
    await waitFor(() => expect(document.querySelector('[data-banner]')).toBeTruthy(), CHO_CHUNK);
    fireEvent.click(document.querySelector('[data-banner]')!);
    fireEvent.click(await screen.findByText(CHU_HUB.moBachKhoa));
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/bach-khoa\/thien_nga$/));
  });
});

describe('5b.2 — trễ mạng: lỗi có chữ + thử lại; bấm liên tiếp không gửi trùng', () => {
  it('⭐ /me/nhiem-vu lỗi ⇒ ô Mùa nói KHÔNG TẢI ĐƯỢC (không số 0); chạm hai lần liên tiếp = MỘT lượt thử lại', async () => {
    const calls = stubFetch([
      ['/me/nhiem-vu', { status: 500, body: { error: 'server', message: 'x' } }],
      ['/auth/me', { status: 200, body: ME_THAT }],
    ]);
    renderHubCoLap();
    await waitFor(() => expect(o('mua')!.textContent).toContain(CHU_HUB.loiTai));
    expect((o('mua')!.textContent ?? '').replace(NHAN_MUA, '')).not.toMatch(/\d/);
    const truoc = calls.filter((c) => c.url.endsWith('/me/nhiem-vu')).length;
    fireEvent.click(o('mua'));
    fireEvent.click(o('mua'));
    await cho(400);
    const sau = calls.filter((c) => c.url.endsWith('/me/nhiem-vu')).length;
    expect(sau - truoc, 'chạm hai lần liên tiếp phải là MỘT lượt thử lại').toBeLessThanOrEqual(2);   // retry của react-query ≤ 1 lượt phụ
    expect(sau).toBeGreaterThan(truoc);
  });

  it('⭐ payload /me/nhiem-vu LẠ HÌNH (API khác bundle) ⇒ ô Mùa nói "CHƯA MỞ", Hub KHÔNG ném lỗi', async () => {
    // Máy chủ khác hình với web là trạng thái BÌNH THƯỜNG ở repo này; Hub ở mọi lần mở app nên không được chết vì nó.
    stubFetch(bang(ME_THAT, { lo_trinh: null, nhiem_vu: [] }));
    renderHubCoLap();
    await waitFor(() => expect(o('mua')!.textContent).toContain(CHU_HUB.muaChuaMo));
    expect(screen.getByText('tester')).toBeTruthy();
    await chamO('mua');
    expect(await screen.findByRole('dialog')).toBeTruthy();   // và lớp trượt Mùa vẫn mở được
  });

  it('⭐ /auth/me lỗi ⇒ đầu sảnh nói rõ + nút THỬ LẠI, ví không in số giả', async () => {
    stubFetch([['/auth/me', { status: 500, body: { error: 'server', message: 'x' } }], ['/me/nhiem-vu', { status: 200, body: LT }]]);
    renderHubCoLap();
    expect(await screen.findByText(CHU_HUB.loiMe)).toBeTruthy();
    expect(screen.getByText(CHU_HUB.thuLai)).toBeTruthy();
    expect(o('vi')!.textContent).toContain('— T');
  });

  it('⭐ ĐIỂM DANH: bấm đúp ⇒ đúng MỘT POST; xong thì ô đổi sang ĐÃ ĐIỂM DANH', async () => {
    const calls = stubFetch(bang(ME_THAT));
    renderHubCoLap();
    await chamO('mua');
    const nut = await screen.findByText(CHU_HUB.nhanDiemDanh);
    fireEvent.click(nut);
    fireEvent.click(nut);
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').length).toBe(1));
    await cho(300);
    expect(calls.filter((c) => c.method === 'POST').length).toBe(1);
    await waitFor(() => expect(o('mua')!.textContent).toContain(CHU_HUB.daDiemDanh));
  });
});

describe('đầu sảnh: avatar + tên sát trái, ví bên phải, MỘT nơi in token, chỗ giữ sẵn huy hiệu ẨN', () => {
  it('⭐ trong cả app: ví hiện ĐÚNG MỘT lần (Hub tắt header chung) và không vẽ huy hiệu', async () => {
    stubFetch(bang(ME_THAT));
    renderApp('/');
    await waitFor(() => expect(o('vi')!.textContent).toContain('1.000 T'));
    expect(screen.queryAllByText(/1\.000 T/).length, 'token in ở hai nơi').toBe(1);
    expect(document.body.textContent).not.toMatch(/DELPHI:\/\//);
    const cho_ = document.querySelector('[data-cho="huy-hieu"]') as HTMLElement;
    expect(cho_, 'thiếu chỗ giữ sẵn huy hiệu').toBeTruthy();
    expect(cho_.hidden).toBe(true);
    expect(cho_.childElementCount, 'Hub KHÔNG được vẽ huy hiệu').toBe(0);
    expect(screen.getByText('tester')).toBeTruthy();
  });

  it('ví là link sang /vi; thanh nav vẫn đủ 5 tab', async () => {
    stubFetch(bang(ME_THAT));
    const router = renderApp('/');
    const nav = await screen.findByLabelText('Menu chính');
    expect(nav.querySelectorAll('a').length).toBe(5);
    await waitFor(() => expect(o('vi')).toBeTruthy());
    fireEvent.click(o('vi'));
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTE_TOKEN));
  });
});

describe('mã nguồn — luật phản hồi chạm ghi thành bài canh', () => {
  const TSX_O = doc('src/components/ui/OBento.tsx');
  const CSS_O = doc('src/components/ui/OBento.module.css');
  const CSS_T = doc('src/components/ui/TamTruot.module.css');
  const CSS_HUB = ['src/screens/Hub.module.css', 'src/screens/hub/HubBanner.module.css', 'src/screens/hub/HubO.module.css',
    'src/screens/hub/HubTam.module.css', 'src/components/ui/OBento.module.css', 'src/components/ui/TamTruot.module.css'];

  it('⭐⭐ nhấn = LÚN TỨC THÌ: lớp `lun` TẮT transition, và lún đúng độ dày bóng', () => {
    const i = CSS_O.indexOf('.o.lun {');
    expect(i, 'thiếu `.o.lun`').toBeGreaterThan(-1);
    const luat = ma(CSS_O.slice(i, CSS_O.indexOf('}', i)));
    expect(luat).toMatch(/transition:\s*none/);
    expect(luat).toContain('--px-do-day');
    // và nhịp khai ở nhip.ts đúng ngưỡng founder (≤ 0,05 s)
    expect(ma(doc('src/lib/nhip.ts'))).toMatch(/HUB_LUN:\s*50\b/);
  });

  it('⭐ lún bằng con trỏ JS (`pointerdown`), KHÔNG `:active` (rơi mất trên màn chạm)', () => {
    expect(ma(TSX_O)).toContain('onPointerDown');
    expect(ma(CSS_O)).not.toMatch(/:active/);
  });

  it('⭐ `cubic-bezier` nảy CHỈ gõ ở motion.module.css — file Hub/ui chỉ composes (pixelui §LUẬT 3)', () => {
    for (const f of CSS_HUB) expect(ma(doc(f)), f).not.toMatch(/cubic-bezier/);
    expect(ma(doc('src/styles/motion.module.css'))).toMatch(/\.hubNay\s*\{[^}]*cubic-bezier/);
    expect(CSS_O).toMatch(/composes:\s*hubNay from/);
    expect(CSS_T).toMatch(/composes:\s*hubTamTruot from/);
  });

  it('⭐ không hex mới trong CSS của Hub (chỉ token / color-mix / rgba)', () => {
    const hex = CSS_HUB.flatMap((f) => (ma(doc(f)).match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => `${f}: ${h}`));
    expect(hex).toEqual([]);
  });
  it('⭐⭐ nút ĐÓNG của lớp trượt là nút NỔI như demo PFM bản 6 (`.nut2`): mặt phím token, vạch đáy dày, bóng cứng, lún khi bấm — không phẳng/viền trần', () => {
    const i = CSS_T.indexOf('.dong {');
    expect(i, 'thiếu `.dong`').toBeGreaterThan(-1);
    const luat = CSS_T.slice(i, CSS_T.indexOf('}', i));
    expect(luat).toMatch(/background:\s*var\(--n-4b\)/);
    expect(luat).toMatch(/border-bottom:\s*3px solid var\(--n-6\)/);
    expect(luat).toContain('var(--px-bong)');
    expect(luat).toMatch(/height:\s*42px/);
    expect(CSS_T).toMatch(/\.dong:active\s*\{[^}]*translate\(var\(--px-day\)/);
  });


  it('lớp trượt: giảm chuyển động tắt transition; nút ĐÓNG luôn có; aria-modal', () => {
    expect(ma(doc('src/styles/motion.module.css'))).toMatch(/prefers-reduced-motion[^{]*\{\s*\.hubNay,\s*\.hubTamTruot,\s*\.hubManToi\s*\{\s*transition:\s*none/);
    const t = ma(doc('src/components/ui/TamTruot.tsx'));
    expect(t).toContain('aria-modal="true"');
    expect(t).toContain('Escape');
    expect(t).toContain('NGUONG_VUOT_DONG');
  });

  it('Hub tắt header chung bằng cờ `dauSanh` của route — không lặp ví', () => {
    expect(ma(doc('src/app/routes.tsx'))).toMatch(/path:\s*'\/',\s*element:\s*<Hub \/>,\s*handle:\s*hHub\('HUB'\)/);
    // 11/10: header tắt chung cho mọi màn bento không cuộn (`dauSanh` — Hub·sảnh — và `khungPfm` — bốn tab tài chính): cùng một biến gộp.
    expect(ma(doc('src/app/AppShell.tsx'))).toMatch(/bentoKhongCuon\s*=\s*dauSanh\s*\|\|\s*khungPfm/);
    expect(ma(doc('src/app/AppShell.tsx'))).toMatch(/!toanMan\s*&&\s*!bentoKhongCuon/);
  });

  it('banner đọc chữ từ BÁCH KHOA (không chép tay) và chuyển 10 s', () => {
    const b = ma(doc('src/screens/hub/HubBanner.tsx'));
    expect(b).toContain("from '@/lib/bach_khoa'");
    expect(b).toContain('NHIP.HUB_BANNER');
    expect(ma(doc('src/lib/nhip.ts'))).toMatch(/HUB_BANNER:\s*10_000/);
  });
});
