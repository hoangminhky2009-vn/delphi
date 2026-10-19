/**
 * PFM — KHUNG BỐN TAB (SPEC `pfm-tang-khong-gian`, demo CHỐT bản 6): `components/pfm/KhungPfm.tsx` + `.module.css`.
 *
 * Bài canh bốn điều của vỏ:
 *  §I   hướng lướt là HÀM THUẦN theo thứ tự SỔ → HŨ → GƯƠNG → THẺ (vector chép tay, không suy từ chính hàm) và thứ tự ấy là thứ tự của `TAB_TAI_CHINH`
 *       (một nguồn — A11.5);
 *  §II  vỏ đứng NGUYÊN qua bốn route (dải tab không dựng lại), đánh dấu hướng lướt đúng, mỗi lần chỉ một tab sáng, có đường ra Hub + bánh răng + ô giữ sẵn Oracle;
 *  §III bánh răng mở lớp CÀI ĐẶT và giữ BỐN cửa đồng ý (`CUA_PFM`) — không năm lớp, không thêm cửa (quyết định founder "A A A", câu 1);
 *  §IV  KHÔNG THANH CUỘN là bất biến cấu trúc: vỏ trừ ĐÚNG ba số của `AppShell` (đầu 12 · đáy 8 · vùng an toàn), thân vỏ cắt tràn, và không CSS của bốn mặt nào cho
 *       cuộn. (Số đo thật `scrollHeight − clientHeight = 0` ở hai khung 390×812 và 360×640: `tests/luong/trinh-duyet/pfm_bento.mjs` phần `cuon` —
 *       jsdom không có bố cục nên không đo được ở đây; bài này canh các điều kiện CẤU TRÚC làm cho số đo ấy đúng.)
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CUA_PFM } from '@config/pfm_consent';
import { KhungPfm, THU_TU_TAB, huongLuot, type MaTab } from '../src/components/pfm/KhungPfm';
import { TAB_TAI_CHINH } from '../src/components/pfm/TabTaiChinh';
import { ROUTE_HUB } from '../src/lib/vocab';
import { ME_ONBOARDED, stubFetch } from './helpers';

const doc = (p: string): string => readFileSync(resolve(__dirname, p), 'utf8');
const boChuThich = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* ═══ §I — hướng lướt ═══════════════════════════════════════════════════════════════════════════ */

describe('§I — ⭐⭐⭐ hướng lướt là hàm thuần theo thứ tự SỔ → HŨ → GƯƠNG → THẺ', () => {
  it('vector chép tay: đi tới = +1 (màn mới vào từ phải), lùi = −1, cùng tab / lần đầu = 0', () => {
    const bang: [MaTab | null, MaTab, -1 | 0 | 1][] = [
      [null, 'so', 0], [null, 'the', 0],
      ['so', 'hu', 1], ['so', 'guong', 1], ['so', 'the', 1],
      ['hu', 'guong', 1], ['hu', 'the', 1], ['guong', 'the', 1],
      ['hu', 'so', -1], ['guong', 'so', -1], ['guong', 'hu', -1],
      ['the', 'so', -1], ['the', 'hu', -1], ['the', 'guong', -1],
      ['so', 'so', 0], ['hu', 'hu', 0], ['guong', 'guong', 0], ['the', 'the', 0],
    ];
    for (const [tu, den, mong] of bang) expect(huongLuot(tu, den), `${tu} → ${den}`).toBe(mong);
  });

  it('thứ tự lướt TRÙNG thứ tự dải tab của khu (`TAB_TAI_CHINH`) — một nguồn, không danh sách thứ hai', () => {
    expect(THU_TU_TAB.map((m) => `/tai-chinh/${m}`)).toEqual(TAB_TAI_CHINH.map((t) => t.duong));
    expect(new Set(THU_TU_TAB).size, 'bốn tab, không trùng').toBe(4);
  });
});

/* ═══ §II — vỏ đứng nguyên qua bốn route ═════════════════════════════════════════════════════════ */

function ve(dau: MaTab = 'so', trongSo: React.ReactNode = null) {
  stubFetch([['/auth/me', { status: 200, body: ME_ONBOARDED }]]);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[`/tai-chinh/${dau}`]}>
      <QueryClientProvider client={qc}>
        <Routes>
          {THU_TU_TAB.map((m) => (
            <Route key={m} path={`/tai-chinh/${m}`} element={<KhungPfm tab={m}><p data-testid={`man-${m}`}>{m}</p>{m === dau ? trongSo : null}</KhungPfm>} />
          ))}
          <Route path={ROUTE_HUB} element={<p data-testid="hub">hub</p>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
afterEach(() => { vi.unstubAllGlobals(); });

const dai = (): HTMLElement => screen.getByRole('navigation', { name: 'Khu tài chính' });
const luot = (): string | null => document.querySelector('[data-khung-pfm] [data-luot]')?.getAttribute('data-luot') ?? null;
const lienKet = (tab: MaTab): HTMLElement => within(dai()).getByRole('link', { name: new RegExp(`^${TAB_TAI_CHINH[THU_TU_TAB.indexOf(tab)]!.nhan}`) });

describe('§II — ⭐⭐⭐ vỏ KhungPfm', () => {
  it('dải tab: đường ra HUB · bốn tab đúng thứ tự và đúng đích · bánh răng · ô giữ sẵn Oracle (cuối dải, không nút nào trong đó)', () => {
    ve();
    const nav = dai();
    const lk = within(nav).getAllByRole('link');
    expect(lk.map((a) => a.getAttribute('href'))).toEqual([ROUTE_HUB, ...TAB_TAI_CHINH.map((t) => t.duong)]);
    expect(within(nav).getByRole('button', { name: 'Cài đặt khu Tài chính' })).toBeInTheDocument();
    const cho = nav.querySelector('[data-oracle-cho]')!;
    expect(cho, 'ô giữ sẵn Oracle').not.toBeNull();
    expect(nav.lastElementChild, 'ô giữ sẵn đứng CUỐI dải').toBe(cho);
    expect(cho.querySelectorAll('button, a, input'), 'Oracle là avatar tự neo vào đây — ô giữ sẵn không tự có phần tử bấm').toHaveLength(0);
    expect(cho.getAttribute('aria-hidden')).toBe('true');
  });

  it('⭐ mỗi lần MỘT tab sáng (`aria-current`), và đúng tab của route', () => {
    ve('guong');
    const sang = within(dai()).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(sang).toHaveLength(1);
    expect(sang[0]!.getAttribute('href')).toBe('/tai-chinh/guong');
    expect(document.querySelectorAll('[data-khung-pfm]'), 'MỘT vỏ trên màn').toHaveLength(1);
    expect(document.querySelector('[data-khung-pfm]')!.getAttribute('data-khung-pfm')).toBe('guong');
  });

  it('⭐⭐⭐ đổi tab bốn chiều: màn mới LƯỚT ĐÚNG HƯỚNG, và dải tab KHÔNG dựng lại (cùng một nút DOM)', () => {
    ve('so');
    const nav0 = dai();
    expect(luot(), 'lần dựng đầu không lướt').toBeNull();

    fireEvent.click(lienKet('hu'));
    expect(luot(), 'SỔ → HŨ: tới').toBe('toi');
    fireEvent.click(lienKet('the'));
    expect(luot(), 'HŨ → THẺ: tới').toBe('toi');
    fireEvent.click(lienKet('guong'));
    expect(luot(), 'THẺ → GƯƠNG: lùi').toBe('lui');
    fireEvent.click(lienKet('so'));
    expect(luot(), 'GƯƠNG → SỔ: lùi').toBe('lui');

    expect(dai(), 'vỏ đứng nguyên qua bốn route — dải tab không nháy').toBe(nav0);
    expect(screen.getByTestId('man-so')).toBeInTheDocument();
    expect(document.querySelector('[data-khung-pfm]')!.getAttribute('data-khung-pfm')).toBe('so');
  });

  it('mỗi lần đổi tab, vùng thân dựng lại (key mới) để animation chạy lại kể cả khi hướng lặp', () => {
    ve('so');
    fireEvent.click(lienKet('hu'));
    const m1 = document.querySelector('[data-khung-pfm] [data-luot]')!;
    fireEvent.click(lienKet('guong'));
    const m2 = document.querySelector('[data-khung-pfm] [data-luot]')!;
    expect(luot()).toBe('toi');
    expect(m2, 'cùng hướng "tới" hai lần liền vẫn phải là một vùng MỚI').not.toBe(m1);
  });

  it('⭐⭐⭐ MÀN CŨ LƯỚT RA (demo bản 6): đổi tab ⇒ một BẢN CHỤP tĩnh của màn cũ trượt ngược hướng rồi rời DOM bằng đồng hồ; không trùng testid, không bấm được', async () => {
    ve('so');
    fireEvent.click(lienKet('hu'));
    const ra = document.querySelector<HTMLElement>('[data-khung-pfm] [data-ra]');
    expect(ra, 'chưa có bản chụp màn cũ').not.toBeNull();
    expect(ra!.getAttribute('data-ra'), 'đi tới ⇒ màn cũ trượt sang TRÁI (toi)').toBe('toi');
    expect(ra!.getAttribute('aria-hidden')).toBe('true');
    expect(ra!.hasAttribute('inert')).toBe(true);
    expect(ra!.textContent, 'bản chụp là màn CŨ (SỔ), không phải màn mới').toContain('so');
    expect(ra!.querySelectorAll('[data-testid]'), 'testid của bản chụp phải gỡ — không trùng với màn thật').toHaveLength(0);
    expect(screen.getAllByTestId('man-hu')).toHaveLength(1);
    await waitFor(() => expect(document.querySelector('[data-ra]')).toBeNull(), { timeout: 2000 });
  });

  it('⭐⭐ bản chụp màn cũ KHÔNG mang hộp thoại / tấm nền của lớp trượt đang mở (không có hộp thoại ma trong DOM khi lớp tự đóng lúc đổi route)', () => {
    ve('so', (
      <div>
        <div data-tam-nen aria-hidden="true" />
        <section role="dialog" aria-modal="true" aria-label="lớp đang mở">nội dung lớp</section>
      </div>
    ));
    expect(screen.getAllByRole('dialog', { name: 'lớp đang mở' })).toHaveLength(1);
    fireEvent.click(lienKet('hu'));
    const ra = document.querySelector<HTMLElement>('[data-khung-pfm] [data-ra]')!;
    expect(ra, 'có bản chụp màn cũ').not.toBeNull();
    expect(ra.querySelector('[role="dialog"]'), 'bản chụp không mang hộp thoại').toBeNull();
    expect(ra.querySelector('[data-tam-nen]'), 'bản chụp không mang tấm nền').toBeNull();
    expect(screen.queryByRole('dialog', { name: 'lớp đang mở' }), 'màn mới không còn lớp ấy').toBeNull();
  });

  it('⭐⭐⭐ `popstate` (Back/Forward) tự chụp màn hiện tại — KHÔNG qua cú chạm dải tab: đổi tab bằng điều hướng lập trình sau `popstate` vẫn có ĐÚNG MỘT bản chụp, và nó rời DOM (số đo Back thật ở pfm_bento.mjs)', async () => {
    function NutDi(): React.ReactElement {
      const di = useNavigate();
      return <button type="button" onClick={() => di('/tai-chinh/guong')}>đi-bằng-mã</button>;
    }
    ve('so', <NutDi />);
    window.dispatchEvent(new PopStateEvent('popstate'));
    fireEvent.click(screen.getByRole('button', { name: 'đi-bằng-mã' }));
    expect(document.querySelectorAll('[data-khung-pfm] [data-ra]')).toHaveLength(1);
    await waitFor(() => expect(document.querySelector('[data-ra]')).toBeNull(), { timeout: 2000 });
  });

  it('đường ra HUB là một liên kết thật (không phải nút giả): chạm ⇒ sang Hub', () => {
    ve('the');
    fireEvent.click(within(dai()).getAllByRole('link')[0]!);
    expect(screen.getByTestId('hub')).toBeInTheDocument();
  });
});

/* ═══ §III — bánh răng: lớp CÀI ĐẶT giữ BỐN cửa đồng ý ═════════════════════════════════════════════ */

describe('§III — ⭐⭐⭐ bánh răng mở lớp CÀI ĐẶT với đúng BỐN cửa đồng ý', () => {
  it('chạm bánh răng ⇒ lớp trượt (hộp thoại modal) có BỐN công tắc `CUA_PFM`, không cửa thứ năm; ĐÓNG ⇒ rời DOM', async () => {
    ve();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cài đặt khu Tài chính' }));
    const hop = await screen.findByRole('dialog');
    expect(hop).toHaveAttribute('aria-modal', 'true');
    // Nội dung nạp trễ (mật mã két + mạng): chờ công tắc đầu tiên.
    await within(hop).findByTestId(`ct-${CUA_PFM[0]}`);
    // Mỗi cửa đồng ý có đúng MỘT công tắc `ct-<cửa>` và MỘT dòng "rời máy" `roimay-<cửa>`; ngoài bốn cửa chỉ còn công tắc CHUNG + "Tắt Gương" (không phải cửa).
    for (const c of CUA_PFM) expect(within(hop).getByTestId(`ct-${c}`)).toBeInTheDocument();
    expect(within(hop).getAllByTestId(/^roimay-/).map((e) => e.getAttribute('data-testid'))).toEqual(CUA_PFM.map((c) => `roimay-${c}`));
    expect(CUA_PFM, 'quyết định founder: bốn cửa, không năm').toHaveLength(4);

    fireEvent.click(within(hop).getByRole('button', { name: 'ĐÓNG' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('⭐⭐⭐ lớp CÀI ĐẶT của VỎ tự đóng khi route HOẶC query đổi (SPEC 5b.3) — vỏ giữ một thể hiện qua bốn route nên không tự chết như lớp của màn (RÀ 12/10 C1)', async () => {
    function NutDi({ den }: { den: string }): React.ReactElement {
      const di = useNavigate();
      return <button type="button" onClick={() => di(den)}>{`di-${den}`}</button>;
    }
    // (1) chỉ đổi QUERY trên cùng đường (bước dựng khi đang đứng ở HŨ)
    const v1 = ve('hu', <NutDi den="/tai-chinh/hu?tao=tieu_dung" />);
    fireEvent.click(screen.getByRole('button', { name: 'Cài đặt khu Tài chính' }));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'di-/tai-chinh/hu?tao=tieu_dung' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    v1.unmount();
    // (2) đổi ĐƯỜNG bằng dải tab
    ve('so');
    fireEvent.click(screen.getByRole('button', { name: 'Cài đặt khu Tài chính' }));
    await screen.findByRole('dialog');
    fireEvent.click(lienKet('guong'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('⭐⭐⭐ KHUNG CHIA TIỀN (HŨ · 50/30/20 · KAKEIBO) đã DỜI từ lớp HƯỚNG sang lớp CÀI ĐẶT (founder 11/10, câu B): bánh răng ⇒ lớp có thẻ khung, ≤ 1 chạm từ mọi tab', async () => {
    for (const tab of THU_TU_TAB) {
      const v = ve(tab);
      fireEvent.click(screen.getByRole('button', { name: 'Cài đặt khu Tài chính' }));
      const hop = await screen.findByRole('dialog');
      expect(await within(hop).findByTestId('khung-chia-tien'), `thẻ khung ở lớp CÀI ĐẶT (tab ${tab})`).toBeInTheDocument();
      v.unmount();
    }
  });
});

/* ═══ §IV — không thanh cuộn: điều kiện cấu trúc ═════════════════════════════════════════════════ */

describe('§IV — ⭐⭐⭐ KHÔNG THANH CUỘN: các điều kiện CẤU TRÚC (số đo thật ở pfm_bento.mjs phần `cuon`)', () => {
  it('vỏ trừ ĐÚNG ba số của AppShell: đầu 12px + đáy 8px + vùng an toàn', () => {
    const vo = boChuThich(doc('../src/components/pfm/KhungPfm.module.css'));
    const shell = boChuThich(doc('../src/app/AppShell.module.css'));
    const cao = /\.khung\s*\{[^}]*height:\s*calc\(100dvh\s*-\s*(\d+)px\s*-\s*(\d+)px\s*-\s*env\(safe-area-inset-bottom,\s*0px\)\)/.exec(vo);
    expect(cao, 'không thấy công thức chiều cao của `.khung`').not.toBeNull();
    const rule = /\.shell\[data-khung-pfm\]\s*\{([^}]*)\}/.exec(shell)?.[1];
    expect(rule, 'không thấy `.shell[data-khung-pfm]`').toBeTruthy();
    const dau = /padding-top:\s*(\d+)px/.exec(rule!)?.[1];
    const day = /padding-bottom:\s*calc\((\d+)px\s*\+\s*env\(safe-area-inset-bottom/.exec(rule!)?.[1];
    expect([cao![1], cao![2]], 'vỏ và AppShell lệch số ⇒ trang cuộn vài pixel, không gì đỏ').toEqual([dau, day]);
  });

  it('thân vỏ cắt tràn (`overflow: hidden`) và có tràn thì CÒN khung — vỏ là flex cột, thân co được (`min-height: 0`)', () => {
    const vo = boChuThich(doc('../src/components/pfm/KhungPfm.module.css'));
    const than = /\.than\s*\{([^}]*)\}/.exec(vo)?.[1] ?? '';
    expect(than).toMatch(/overflow:\s*hidden/);
    expect(than).toMatch(/min-height:\s*0/);
    expect(/\.khung\s*\{([^}]*)\}/.exec(vo)?.[1] ?? '').toMatch(/flex-direction:\s*column/);
  });

  it('không CSS nào của bốn MẶT cho cuộn (`overflow(-y): auto|scroll`) — cuộn chỉ sống ở lớp trượt dùng chung', () => {
    for (const tep of [
      'components/pfm/KhungPfm.module.css', 'components/pfm/PfmBento.module.css',
      'screens/tai-chinh/HuBento.module.css', 'screens/tai-chinh/GuongBento.module.css', 'screens/tai-chinh/TheBento.module.css',
    ]) {
      expect(boChuThich(doc(`../src/${tep}`)), `${tep}: một mặt bento không được tự cuộn`).not.toMatch(/overflow(-y)?\s*:\s*(auto|scroll)/);
    }
  });

  it('AppShell tắt header chung và vẫn chừa Oracle neo vào ô giữ sẵn khi route khai `khungPfm`', () => {
    const shell = doc('../src/app/AppShell.tsx');
    expect(shell).toMatch(/const khungPfm = handle\?\.khungPfm === true;/);
    expect(shell).toMatch(/const bentoKhongCuon = dauSanh \|\| khungPfm;/);
    const routes = doc('../src/app/routes.tsx');
    for (const m of THU_TU_TAB) {
      expect(routes, `route ${m} phải bọc KhungPfm và khai cờ khungPfm`).toMatch(new RegExp(`<KhungPfm tab="${m}">[^\\n]*handle: hPfmKhung\\(`));
    }
  });
});
