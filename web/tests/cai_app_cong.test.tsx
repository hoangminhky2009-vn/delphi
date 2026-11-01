/**
 * CÀI APP ĐỢT 2 — CỔNG PFM · CỔNG CÀI · NÚT ĐĂNG NHẬP · THẺ HUB · BĂNG NHÚNG (SPEC `docs/spec/cai-app-pfm-trong-ban-cai.md` mục 4–5 +
 * E1–E10; D603 đợt 2).
 *
 * Bài này canh những thứ đổi được hành vi thật của người chơi:
 *   I.   ⭐ CỔNG PFM: tab trình duyệt ⇒ mọi `/tai-chinh/*` về CỔNG CÀI, không mở kho; BẢN CÀI (`display-mode: standalone`) ⇒ khu mở,
 *        Tài chính → phỏng vấn. Tiêm ngược: đảo `pfmMo` ⇒ cả hai chiều đỏ.
 *   II.  Hub tab (E1): ô khoá → lớp "Cài app để mở" → nút ra cổng; bản cài thì ô KHÔNG khoá.
 *   III. Cổng theo nền: iPhone ba bước + E3 · Android một chạm qua `beforeinstallprompt` → cài xong → MỞ APP (E4) · Zalo/Firefox chép
 *        link (E2) · bản cài nói thẳng đã mở. Telemetry `cai_app` đúng `buoc`/`noi`/`nen`.
 *   IV.  Nút CÀI APP ở màn đăng nhập: Android một chạm (không rời màn), iPhone ra cổng, bản cài ẩn.
 *   V.   Thẻ nhắc Hub (E7): ✕ ẩn 7 ngày rồi hiện lại; bản cài / trình duyệt nhúng không hiện.
 *   VI.  Băng nhúng (E6): mọi màn trong Zalo, chừa `--cao-bang`; ✕ thành chấm tới hết phiên; Discord/Chrome thường không có.
 *   VII. E10 — giả lập bản cài `?ban_cai=1` (chỉ dev; bài canh build prod ở `web/scripts/canh_build.mjs`).
 *   VIII. Điều khoản: câu về sổ "chỉ có trong bản cài app" trỏ tới MÃ cổng + kho theo tài khoản.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes, CongPfm } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import type { MeResponse } from '@/api/types';
import { BangNhung, KHOA_BANG_THU, KHOA_THE_AN } from '@/components/MoiCai';
import { MUC, TOM_TAT } from '@/content/dieuKhoan';
import { daCai } from '@/lib/cai_app';
import { CHU_CAI_APP } from '@/lib/cai_app_chu';
import { CHU_HUB } from '@/lib/hub_chu';
import { _datLaiMoiCaiChoTest, khoiDongMoiCai } from '@/lib/moi_cai';
import { pfmMo } from '@/lib/pfm_mo';
import * as doLuong from '@/lib/telemetry';
import * as dungKho from '@/pfm/dung_kho';
import { ME_ONBOARDED, stubFetch } from './helpers';

const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  zaloAndroid: 'Mozilla/5.0 (Linux; Android 13; Redmi Note 12; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 Zalo android/12100626 ZaloTheme/light ZaloLanguage/vn',
  firefoxDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  chromeDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

const ME_THAT: MeResponse = { ...ME_ONBOARDED, user: { ...ME_ONBOARDED.user!, la_khach: false } };
const LT = { mua_mo: true, tuan: 1, so_tuan: 4, chang: 1, so_chang: 30, quest_points: 0, viec: [], da_diem_danh_hom_nay: true, moc: [] };
const BANG: [string, { status: number; body: unknown }][] = [
  ['/me/nhiem-vu', { status: 200, body: LT }],
  ['/auth/me', { status: 200, body: ME_THAT }],
];

function datUA(ua: string): void {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
}
/** Bản cài = `display-mode: standalone` (đúng thứ `daCai` đọc — không UA). */
function giaBanCai(co: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({
    matches: co && q === '(display-mode: standalone)',
    media: q, onchange: null, addListener: () => undefined, removeListener: () => undefined,
    addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false,
  }) as MediaQueryList);
}
function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<QueryClientProvider client={makeQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}
const o = (dau: string) => document.querySelector(`[data-o="${dau}"]`) as HTMLElement | null;
/** Chờ một phần tử của màn cổng — chunk NẠP TRỄ ⇒ giờ chờ rộng (nới GIỜ, không nới điều kiện). */
const choO = (dau: string) => waitFor(() => { const x = o(dau); expect(x, dau).toBeTruthy(); return x!; }, { timeout: 8000 });
/*
 * Telemetry `cai_app` đọc qua SPY trên `ghiDo` chứ không soi hàng đợi: AppShell đẩy hàng đợi lên máy chủ (fetch giả trả 202) ngay khi
 * dựng, nên `hien` ghi lúc mở màn đã rời hàng đợi trước khi bài kịp đọc.
 */
let ghiDo: ReturnType<typeof vi.spyOn>;
const caiApp = () => ghiDo.mock.calls.filter((c) => c[0] === 'cai_app').map((c) => (c[1] as { chi_tiet: unknown }).chi_tiet);

/** Sự kiện `beforeinstallprompt` giả — đủ hai thứ `moiCai` dùng. */
function banLoiMoi(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  const prompt = vi.fn(async () => undefined);
  Object.assign(e, { prompt, userChoice: Promise.resolve({ outcome }) });
  act(() => { window.dispatchEvent(e); });
  return { e, prompt };
}

let goNghe: () => void = () => undefined;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  doLuong._datLaiChoTest();
  ghiDo = vi.spyOn(doLuong, 'ghiDo');
  _datLaiMoiCaiChoTest();
  goNghe = khoiDongMoiCai();
  document.documentElement.style.removeProperty('--cao-bang');
});
afterEach(() => {
  cleanup();
  goNghe();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('I. ⭐ Cổng PFM: tab khoá, bản cài mở', () => {
  it('pfmMo = "đang chạy bản cài" (display-mode), không phải hằng', () => {
    giaBanCai(false);
    expect(pfmMo()).toBe(false);
    giaBanCai(true);
    expect(pfmMo()).toBe(true);
  });

  it('⭐ tab trình duyệt: /tai-chinh/so ⇒ cổng cài, KHÔNG mở kho sổ (driver nền không chạy)', async () => {
    giaBanCai(false);
    const mo = vi.spyOn(dungKho, 'moKhoChung');
    stubFetch(BANG);
    const r = renderApp('/tai-chinh/so');
    await waitFor(() => expect(r.state.location.pathname).toBe('/cai-app'));
    expect(r.state.location.search).toBe('?noi=cong_pfm');
    /*
     * Chờ bằng `querySelector` (`choO`), KHÔNG `findByText`: màn cổng là chunk NẠP TRỄ, và `findByText` quét chữ của CẢ cây DOM (hàng
     * trăm ô SVG của linh vật) mỗi 50 ms — đo 12/10: nó làm đói vòng sự kiện tới mức chunk không về trong 8 s, còn chờ 3 s rồi hỏi một
     * lần thì thấy ngay. Hỏi chữ MỘT lần sau khi màn đã có.
     */
    await choO('chep-link');
    expect(screen.getByText(CHU_CAI_APP.tieuDe)).toBeInTheDocument();
    expect(mo).not.toHaveBeenCalled();
  });

  it('⭐ BẢN CÀI: /tai-chinh ⇒ ở lại khu Tài chính và vào PHỎNG VẤN (cổng đứng trước phỏng vấn, không chặn nó)', async () => {
    giaBanCai(true);
    stubFetch(BANG);
    const r = renderApp('/tai-chinh');
    expect(await screen.findByText(/CÂU · CHẠM LÀ XONG/, undefined, { timeout: 8000 })).toBeInTheDocument();
    expect(r.state.location.pathname.startsWith('/tai-chinh')).toBe(true);
    expect(r.state.location.pathname).not.toBe('/cai-app');
  });

  it('mọi route /tai-chinh/* đều đi qua CongPfm (không route nào lọt cổng)', () => {
    const con = (routes[0]!.children ?? []).filter((x) => typeof x.path === 'string' && x.path.startsWith('/tai-chinh'));
    expect(con.length).toBeGreaterThanOrEqual(9);
    for (const x of con) expect((x.element as { type?: unknown }).type, x.path).toBe(CongPfm);
  });
});

describe('II. Hub trên tab (E1) · bản cài', () => {
  it('⭐ chạm ô Tài chính ⇒ lớp "Cài app để mở" (hết câu donate) + nút CÀI APP ra cổng', async () => {
    giaBanCai(false);
    stubFetch(BANG);
    const r = renderApp('/');
    await waitFor(() => expect(o('tai-chinh')).toBeTruthy());
    fireEvent.click(o('tai-chinh')!);
    const tam = await screen.findByRole('dialog');
    expect(tam.textContent).toContain(CHU_HUB.taiChinhKhoa);
    expect(tam.textContent).not.toMatch(/donate/i);
    fireEvent.click(within(tam).getByText(CHU_CAI_APP.caiNgay));
    await waitFor(() => expect(r.state.location.pathname).toBe('/cai-app'), { timeout: 3000 });
    expect(r.state.location.search).toBe('?noi=cong_pfm');
  });

  it('bản cài: ô Tài chính KHÔNG còn ổ khoá; chạm ⇒ lớp có nút vào khu, không có nút cài', async () => {
    giaBanCai(true);
    stubFetch(BANG);
    renderApp('/');
    await waitFor(() => expect(o('tai-chinh')).toBeTruthy());
    fireEvent.click(o('tai-chinh')!);
    const tam = await screen.findByRole('dialog');
    expect(tam.textContent).toContain(CHU_HUB.moTaiChinh);
    expect(tam.textContent).not.toContain(CHU_CAI_APP.caiNgay);
  });
});

describe('III. Cổng cài theo nền', () => {
  const veCong = (noi = 'cong_pfm') => renderApp(`/cai-app?noi=${noi}`);

  it('⭐ iPhone Safari: ba bước có hình + dòng E3; telemetry hien · cong_pfm · ios', async () => {
    giaBanCai(false);
    datUA(UA.iosSafari);
    stubFetch(BANG);
    veCong();
    const ds = await choO('ba-buoc-ios');
    expect(ds.querySelectorAll('li')).toHaveLength(3);
    expect(ds.querySelectorAll('li [aria-hidden="true"] *').length, 'mỗi bước có hình').toBeGreaterThanOrEqual(3);
    expect(ds.textContent).toContain(CHU_CAI_APP.ios1);
    expect(o('da-cai-ios')!.textContent).toBe(CHU_CAI_APP.daCaiIos);
    expect(caiApp()).toContainEqual({ buoc: 'hien', noi: 'cong_pfm', nen: 'ios' });
  });

  it('⭐ Android Chrome: chưa có lời mời ⇒ hướng dẫn menu; có lời mời ⇒ CÀI APP một chạm → prompt() → cài xong ⇒ MỞ APP (E4)', async () => {
    giaBanCai(false);
    datUA(UA.androidChrome);
    stubFetch(BANG);
    veCong('hub');
    await choO('qua-menu');
    const { e, prompt } = banLoiMoi('accepted');
    expect(e.defaultPrevented, 'tắt thanh mời mặc định — lời mời của app thay nó').toBe(true);
    const nut = await waitFor(() => { const x = o('cai-ngay'); expect(x).toBeTruthy(); return x!; });
    fireEvent.click(nut);
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1), { timeout: 3000 });
    act(() => { window.dispatchEvent(new Event('appinstalled')); });
    expect(await screen.findByText(CHU_CAI_APP.vuaCai)).toBeInTheDocument();
    expect(o('mo-app')).toBeTruthy();
    expect(screen.getByText(CHU_CAI_APP.moAppLui)).toBeInTheDocument();
    expect(caiApp()).toEqual(expect.arrayContaining([
      { buoc: 'hien', noi: 'hub', nen: 'android' },
      { buoc: 'bam_cai', noi: 'hub', nen: 'android' },
      { buoc: 'da_cai', noi: 'hub', nen: 'android' },
    ]));
  });

  it('Android: từ chối hộp cài ⇒ telemetry bo, quay về hướng dẫn menu (lời mời chỉ dùng được một lần)', async () => {
    giaBanCai(false);
    datUA(UA.androidChrome);
    stubFetch(BANG);
    veCong();
    await choO('qua-menu');
    banLoiMoi('dismissed');
    fireEvent.click(await waitFor(() => { const x = o('cai-ngay'); expect(x).toBeTruthy(); return x!; }));
    await waitFor(() => expect(o('qua-menu')).toBeTruthy(), { timeout: 3000 });
    expect(caiApp()).toContainEqual({ buoc: 'bo', noi: 'cong_pfm', nen: 'android' });
  });

  it('⭐ Zalo (E2): nói thẳng đang trong Zalo, link HIỆN bằng chữ + CHÉP LINK (clipboard) ⇒ telemetry mo_trinh_duyet · nhung', async () => {
    giaBanCai(false);
    datUA(UA.zaloAndroid);
    const ghi = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: ghi } });
    onTestFinished(() => { delete (navigator as { clipboard?: unknown }).clipboard; });
    stubFetch(BANG);
    veCong('bang_nhung');
    await choO('mo-trinh-duyet');
    expect(o('mo-trinh-duyet')!.textContent).toContain('Zalo');
    expect(o('link-app')!.textContent).toBe(`${window.location.origin}/`);
    fireEvent.click(o('chep-link')!);
    await waitFor(() => expect(ghi).toHaveBeenCalledWith(`${window.location.origin}/`), { timeout: 3000 });
    expect(await screen.findByText(CHU_CAI_APP.daChep)).toBeInTheDocument();
    expect(caiApp()).toContainEqual({ buoc: 'mo_trinh_duyet', noi: 'bang_nhung', nen: 'nhung' });
  });

  it('Firefox máy tính: không cài được ⇒ mở bằng Chrome/Safari + chép link', async () => {
    giaBanCai(false);
    datUA(UA.firefoxDesktop);
    stubFetch(BANG);
    veCong();
    await choO('mo-trinh-duyet');
    expect(o('mo-trinh-duyet')!.textContent).toBe(CHU_CAI_APP.khongCaiDuoc);
    expect(o('chep-link')).toBeTruthy();
  });

  it('đang trong bản cài: nói đã mở + nút vào Tài chính; KHÔNG ghi `hien`', async () => {
    giaBanCai(true);
    stubFetch(BANG);
    veCong();
    await choO('vao-tai-chinh');
    expect(screen.getByText(CHU_CAI_APP.dangOBanCai)).toBeInTheDocument();
    expect(o('vao-tai-chinh')).toBeTruthy();
    expect(caiApp()).toHaveLength(0);
  });
});

describe('IV. Nút CÀI APP ở màn đăng nhập', () => {
  const NO_SESSION: [string, { status: number; body: unknown }][] = [['/auth/me', { status: 401, body: { error: 'unauthorized' } }]];

  it('⭐ Android có lời mời: MỘT chạm ra hộp cài, không rời màn đăng nhập', async () => {
    giaBanCai(false);
    datUA(UA.androidChrome);
    stubFetch(NO_SESSION);
    const r = renderApp('/onboard');
    const { prompt } = banLoiMoi();
    const nut = await waitFor(() => { const x = document.querySelector('[data-nut="cai-app"]'); expect(x).toBeTruthy(); return x as HTMLElement; });
    fireEvent.click(nut);
    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    expect(r.state.location.pathname).toBe('/onboard');
    expect(caiApp()).toContainEqual({ buoc: 'bam_cai', noi: 'dang_nhap', nen: 'android' });
  });

  it('iPhone: chạm ⇒ ra cổng ba bước (noi=dang_nhap)', async () => {
    giaBanCai(false);
    datUA(UA.iosSafari);
    stubFetch(NO_SESSION);
    const r = renderApp('/onboard');
    fireEvent.click(await waitFor(() => { const x = document.querySelector('[data-nut="cai-app"]'); expect(x).toBeTruthy(); return x as HTMLElement; }));
    await waitFor(() => expect(r.state.location.pathname).toBe('/cai-app'));
    expect(r.state.location.search).toBe('?noi=dang_nhap');
  });

  it('bản cài: nút KHÔNG hiện', async () => {
    giaBanCai(true);
    stubFetch(NO_SESSION);
    renderApp('/onboard');
    await screen.findByText(/ĐĂNG KÝ \/ ĐĂNG NHẬP/);
    expect(document.querySelector('[data-nut="cai-app"]')).toBeNull();
  });
});

describe('V. Thẻ nhắc ở Hub (E7)', () => {
  it('⭐ tab: thẻ hiện; ✕ ⇒ ẩn và ghi hạn 7 ngày; quá hạn ⇒ hiện lại', async () => {
    giaBanCai(false);
    datUA(UA.chromeDesktop);
    stubFetch(BANG);
    renderApp('/');
    const the = await waitFor(() => { const x = o('the-cai-app'); expect(x).toBeTruthy(); return x!; });
    expect(the.textContent).toContain(CHU_CAI_APP.theHub);
    const truoc = Date.now();
    fireEvent.click(within(the).getByRole('button', { name: CHU_CAI_APP.theHubDong }));
    expect(o('the-cai-app')).toBeNull();
    const toi = Number(localStorage.getItem(KHOA_THE_AN));
    expect(toi - truoc).toBeGreaterThanOrEqual(7 * 24 * 3600 * 1000 - 1000);
    expect(toi - truoc).toBeLessThanOrEqual(7 * 24 * 3600 * 1000 + 5000);
    expect(caiApp()).toContainEqual({ buoc: 'bo', noi: 'hub', nen: 'desktop' });

    cleanup();
    stubFetch(BANG);
    renderApp('/');
    await waitFor(() => expect(o('tai-chinh')).toBeTruthy());
    expect(o('the-cai-app'), 'trong 7 ngày: vẫn ẩn').toBeNull();

    cleanup();
    localStorage.setItem(KHOA_THE_AN, String(Date.now() - 1));
    stubFetch(BANG);
    renderApp('/');
    await waitFor(() => expect(o('the-cai-app')).toBeTruthy());
  });

  it('chạm thẻ (không có lời mời một chạm) ⇒ ra cổng noi=hub', async () => {
    giaBanCai(false);
    datUA(UA.chromeDesktop);
    stubFetch(BANG);
    const r = renderApp('/');
    const the = await waitFor(() => { const x = o('the-cai-app'); expect(x).toBeTruthy(); return x!; });
    fireEvent.click(within(the).getByText(CHU_CAI_APP.theHub));
    await waitFor(() => expect(r.state.location.search).toBe('?noi=hub'));
  });

  it.each([['bản cài', true, UA.chromeDesktop], ['Zalo (đã có băng)', false, UA.zaloAndroid]] as const)('%s: không có thẻ', async (_t, banCai, ua) => {
    giaBanCai(banCai);
    datUA(ua);
    stubFetch(BANG);
    renderApp('/');
    await waitFor(() => expect(o('tai-chinh')).toBeTruthy());
    expect(o('the-cai-app')).toBeNull();
  });
});

describe('VI. Băng trình duyệt nhúng (E6)', () => {
  it('⭐ Zalo: băng ở MỌI màn, chừa --cao-bang; ✕ ⇒ chấm + trả chỗ, tới hết phiên tab; chạm chấm ⇒ băng lại', async () => {
    giaBanCai(false);
    datUA(UA.zaloAndroid);
    stubFetch(BANG);
    renderApp('/');
    await waitFor(() => expect(o('bang-nhung')).toBeTruthy());
    expect(document.documentElement.style.getPropertyValue('--cao-bang')).toBe('32px');
    expect(o('bang-nhung')!.textContent).toContain(CHU_CAI_APP.bang);
    cleanup();
    stubFetch(BANG);
    renderApp('/ho-so');
    await waitFor(() => expect(o('bang-nhung'), 'màn Hồ sơ cũng có băng').toBeTruthy());
    fireEvent.click(document.querySelector('[data-nut="thu-bang-nhung"]')!);
    expect(o('bang-nhung')).toBeNull();
    expect(o('cham-bang-nhung')).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue('--cao-bang')).toBe('');
    expect(sessionStorage.getItem(KHOA_BANG_THU)).toBe('1');
    expect(caiApp()).toContainEqual({ buoc: 'bo', noi: 'bang_nhung', nen: 'nhung' });
    cleanup();
    stubFetch(BANG);
    renderApp('/');
    await waitFor(() => expect(o('cham-bang-nhung'), 'đổi màn trong cùng phiên: vẫn là chấm').toBeTruthy());
    fireEvent.click(o('cham-bang-nhung')!);
    expect(o('bang-nhung')).toBeTruthy();
  });

  it('bàn đấu (thuGon): chỉ chấm, không chiếm chỗ của HUD', () => {
    giaBanCai(false);
    datUA(UA.zaloAndroid);
    render(<MemoryRouter><BangNhung thuGon /></MemoryRouter>);
    expect(o('bang-nhung')).toBeNull();
    expect(o('cham-bang-nhung')).toBeTruthy();
    expect(document.documentElement.style.getPropertyValue('--cao-bang')).toBe('');
  });

  it.each([['Chrome Android', UA.androidChrome], ['Chrome máy tính', UA.chromeDesktop]])('%s: không có băng', (_t, ua) => {
    giaBanCai(false);
    datUA(ua);
    render(<MemoryRouter><BangNhung /></MemoryRouter>);
    expect(o('bang-nhung')).toBeNull();
    expect(o('cham-bang-nhung')).toBeNull();
  });

  it('Discord Activity (iframe) — E5: không có băng', () => {
    giaBanCai(false);
    datUA(UA.chromeDesktop);
    vi.spyOn(window, 'top', 'get').mockReturnValue({} as Window);
    render(<MemoryRouter><BangNhung /></MemoryRouter>);
    expect(o('bang-nhung')).toBeNull();
    expect(o('cham-bang-nhung')).toBeNull();
  });
});

describe('VII. E10 — giả lập bản cài chỉ ở dev', () => {
  it('?ban_cai=1 ⇒ tab cư xử như bản cài tới hết phiên tab; ?ban_cai=0 gỡ', () => {
    giaBanCai(false);
    const goc = window.location.pathname + window.location.search;
    try {
      window.history.replaceState({}, '', '/?ban_cai=1');
      expect(daCai()).toBe(true);
      window.history.replaceState({}, '', '/ho-so');
      expect(daCai(), 'đổi trang trong cùng tab: vẫn giả lập').toBe(true);
      window.history.replaceState({}, '', '/?ban_cai=0');
      expect(daCai()).toBe(false);
    } finally {
      window.history.replaceState({}, '', goc);
    }
  });

  it('mã giả lập nằm TRỌN trong khối `if (import.meta.env.DEV)` — build prod cắt cả khối (canh thật: web/scripts/canh_build.mjs)', () => {
    // Bỏ chú thích (build cũng bỏ) — chỉ MÃ ngoài khối DEV là thứ có thể lọt vào gói prod.
    const src = readFileSync(join(process.cwd(), 'src/lib/cai_app.ts'), 'utf8')
      .replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const than = /function giaLapBanCai\(\): boolean \{\n {2}if \(import\.meta\.env\.DEV\) \{([\s\S]*?)\n {2}\}\n {2}return false;\n\}/.exec(src);
    expect(than, 'giaLapBanCai phải là MỘT khối if DEV rồi return false').not.toBeNull();
    expect(than![1]).toContain('ban_cai');
    expect(src.replace(than![0], '')).not.toMatch(/ban_cai/);
  });
});

describe('VIII. Điều khoản: câu về sổ trỏ tới mã cổng', () => {
  const cauSo = [TOM_TAT.join(' '), ...(MUC.find((m) => m.doan.some((d) => d.includes('Sổ chỉ có trong bản cài app')))?.doan ?? [])].join(' ');

  it('⭐ nói "chỉ có trong bản cài app", không còn "tạm khoá trên web"', () => {
    expect(TOM_TAT.join(' ')).toContain('chỉ có trong bản cài app');
    expect(cauSo).toContain('Sổ chỉ có trong bản cài app');
    expect(JSON.stringify(MUC) + TOM_TAT.join(' ')).not.toMatch(/tạm khoá trên web/);
  });

  it('⭐ lời hứa có mã đứng sau: cổng = pfmMo ← daCai (display-mode) · màn /cai-app tồn tại · kho theo tài khoản', () => {
    const mo = readFileSync(join(process.cwd(), 'src/lib/pfm_mo.ts'), 'utf8');
    expect(mo).toMatch(/return PFM_WEB_MO \|\| daCai\(\);/);
    expect((routes[0]!.children ?? []).some((x) => x.path === '/cai-app')).toBe(true);
    // "Mỗi tài khoản một sổ riêng trên máy" — tên kho mang user_id (đợt 1, `kho_idb.ts`).
    expect(cauSo).toContain('Mỗi tài khoản một sổ riêng trên máy');
    const kho = readFileSync(join(process.cwd(), 'src/pfm/kho_idb.ts'), 'utf8');
    expect(kho).toMatch(/return `\$\{TEN_DB_CHUNG_CU\}_\$\{chu\}`;/);
  });
});
