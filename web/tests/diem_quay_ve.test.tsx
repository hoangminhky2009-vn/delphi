/**
 * ĐIỂM QUAY VỀ SAU ĐĂNG KÝ (D333) — người mở link BÀN BUỔI ĐO khi chưa có tài khoản đi qua bốn màn rồi
 * phải về ĐÚNG bàn ấy, và lượt đăng ký phải mang mã bàn để server đổi xô hạn mức (cả lớp chung một IP).
 *
 *  §I   thư viện: chỉ nhớ đường bàn (không chuyển hướng mở) · đọc không xoá · hạn 24h · kho hỏng không ném;
 *  §II  ⭐ chuỗi thật trên router: link bàn → cổng nhớ bàn → đăng ký gửi `ban_ma`;
 *  §III link xác minh `&ban=` ghi lại điểm ở trình duyệt mở thư; giá trị lạ bị bỏ;
 *  §IV  đăng nhập xong về bàn; TỚI bàn thì xoá — mở bàn KHÁC không xoá.
 *  §V   D392 — đăng ký từ bàn buổi đo đang mở: server trả phiên ⇒ đi thẳng lập hồ sơ (không hộp "KIỂM TRA
 *       HỘP THƯ"); lập hồ sơ gửi kèm `ban_ma` để cửa D370 ở `/onboarding` có đường tới.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { routes } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import { NEN_TANG } from '@config/avatar';
import {
  docDiemQuayVe, duongBanTuMa, ghiDiemQuayVe, maBanQuayVe, xoaDiemQuayVe,
} from '@/lib/diem_quay_ve';

const KHOA = 'dp_quay_ve';
const GIO = 60 * 60 * 1000;
/**
 * Mức đợi cho các bài dựng CẢ app qua router thật. Dưới tải của cả bộ web, chuỗi vỏ app → cổng → màn vượt
 * 1 giây mặc định của `findBy` (đo 14/09 ở `buoi_do_dieu_phoi`: 1.614 ms) — bài canh hành vi, không canh tốc độ.
 */
const CHO = { timeout: 8000 } as const;
// Trần của MỖI BÀI phải rộng hơn mức đợi, không thì bài hết giờ ở 5 giây trước khi `findBy` kịp đợi xong.
vi.setConfig({ testTimeout: 20_000 });

function dung(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const USER = {
  user_id: 'u1', handle: 'tester', age_band: '18-22', region: 'nam', occupation_band: 'hs_sv',
  bankroll: 1000, role: 'user', research_consent: true, created_at: '2026-07-18T00:00:00Z', season_id: '2026Q3',
};

/** Bảng route → trả lời; không khớp ⇒ 401. Trả mảng lời gọi để soi body. */
function stub(bang: (url: string) => Response | undefined) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, ...(init !== undefined ? { init } : {}) });
    return bang(url) ?? json(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
  }));
  return calls;
}

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); window.localStorage.clear(); });

describe('§I — thư viện', () => {
  it('⭐ chỉ nhớ ĐƯỜNG BÀN — mọi đường khác bị bỏ, kể cả đường trông giống', () => {
    for (const x of ['/', '/arena', '//evil.example', 'https://evil.example/arena/ban/abcde',
      '/arena/ban/abcd', '/arena/ban/ABCDE', '/arena/ban/abcde/x', '/arena/ban/abcde?x=1']) {
      expect(ghiDiemQuayVe(x), x).toBe(false);
      expect(docDiemQuayVe(), x).toBeNull();
    }
    expect(ghiDiemQuayVe('/arena/ban/lop01')).toBe(true);
    expect(docDiemQuayVe()).toBe('/arena/ban/lop01');
  });

  it('đọc KHÔNG xoá; mã bàn rút đúng; xoá thì hết', () => {
    ghiDiemQuayVe('/arena/ban/lop01');
    expect(docDiemQuayVe()).toBe('/arena/ban/lop01');
    expect(docDiemQuayVe()).toBe('/arena/ban/lop01');
    expect(maBanQuayVe()).toBe('lop01');
    xoaDiemQuayVe();
    expect(docDiemQuayVe()).toBeNull();
    expect(maBanQuayVe()).toBeNull();
  });

  it('hạn 24 giờ; mốc thời gian ở tương lai xa bị bỏ', () => {
    const t0 = Date.UTC(2026, 8, 14, 7, 0, 0);
    ghiDiemQuayVe('/arena/ban/lop01', t0);
    expect(docDiemQuayVe(t0 + 23 * GIO)).toBe('/arena/ban/lop01');
    expect(docDiemQuayVe(t0 + 24 * GIO + 1)).toBeNull();
    ghiDiemQuayVe('/arena/ban/lop01', t0 + 5 * GIO);
    expect(docDiemQuayVe(t0)).toBeNull();
  });

  it('giá trị trong kho bị sửa tay / hỏng ⇒ null, không chuyển hướng tới đó', () => {
    window.localStorage.setItem(KHOA, JSON.stringify({ d: 'https://evil.example', t: Date.now() }));
    expect(docDiemQuayVe()).toBeNull();
    window.localStorage.setItem(KHOA, '{không phải json');
    expect(docDiemQuayVe()).toBeNull();
  });

  it('mã từ link: chuẩn hoá hoa/khoảng trắng, sai hình dạng ⇒ null', () => {
    expect(duongBanTuMa(' LOP01 ')).toBe('/arena/ban/lop01');
    expect(duongBanTuMa('lop0')).toBeNull();
    expect(duongBanTuMa(12345)).toBeNull();
    expect(duongBanTuMa(null)).toBeNull();
  });

  it('kho trình duyệt ném (chế độ riêng tư) ⇒ không hàm nào ném', () => {
    const goc = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new Error('SecurityError'); },
    });
    try {
      expect(ghiDiemQuayVe('/arena/ban/lop01')).toBe(false);
      expect(docDiemQuayVe()).toBeNull();
      expect(() => xoaDiemQuayVe()).not.toThrow();
    } finally {
      Object.defineProperty(window, 'localStorage', goc);
    }
  });
});

describe('§II — chuỗi thật: link bàn → cổng → đăng ký', () => {
  it('⭐ mở link bàn khi chưa đăng nhập ⇒ cổng nhớ bàn; đăng ký gửi kèm ban_ma', async () => {
    stub(() => undefined);
    dung('/arena/ban/lop01');
    expect(await screen.findByText('▶ ĐĂNG NHẬP / ĐĂNG KÝ', {}, CHO)).toBeInTheDocument();
    await waitFor(() => expect(docDiemQuayVe()).toBe('/arena/ban/lop01'), CHO);

    const calls = stub((url) => (url.includes('/auth/register')
      ? json(202, { ok: true, message: 'Kiểm tra hộp thư để xác minh email nhé.' }) : undefined));
    dung('/onboard/dang-ky');
    fireEvent.change(screen.getAllByLabelText('Email').at(-1)!, { target: { value: 'moi@b.vn' } });
    fireEvent.change(screen.getAllByLabelText('Mật khẩu').at(-1)!, { target: { value: 'matkhau10kytu' } });
    fireEvent.change(screen.getAllByLabelText('Nhập lại mật khẩu').at(-1)!, { target: { value: 'matkhau10kytu' } });
    fireEvent.change(screen.getAllByLabelText('Năm sinh').at(-1)!, { target: { value: '2008' } });
    fireEvent.click(screen.getAllByText('▶ TẠO TÀI KHOẢN').at(-1)!);
    expect(await screen.findByText(/KIỂM TRA HỘP THƯ/, {}, CHO)).toBeInTheDocument();
    const reg = calls.find((c) => c.url.includes('/auth/register'));
    expect(JSON.parse(String(reg!.init?.body))).toEqual({
      email: 'moi@b.vn', password: 'matkhau10kytu', birth_year: 2008, ban_ma: 'lop01',
    });
  });

  it('không đến từ bàn ⇒ đăng ký KHÔNG mang ban_ma (hợp đồng cũ giữ nguyên)', async () => {
    const calls = stub((url) => (url.includes('/auth/register')
      ? json(202, { ok: true, message: 'ok' }) : undefined));
    dung('/onboard/dang-ky');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'moi@b.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau10kytu' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), { target: { value: 'matkhau10kytu' } });
    fireEvent.change(screen.getByLabelText('Năm sinh'), { target: { value: '2008' } });
    fireEvent.click(screen.getByText('▶ TẠO TÀI KHOẢN'));
    expect(await screen.findByText(/KIỂM TRA HỘP THƯ/, {}, CHO)).toBeInTheDocument();
    const reg = calls.find((c) => c.url.includes('/auth/register'));
    expect(JSON.parse(String(reg!.init?.body))).not.toHaveProperty('ban_ma');
  });

  it('mở một đường KHÔNG phải bàn khi chưa đăng nhập ⇒ không nhớ gì', async () => {
    stub(() => undefined);
    dung('/arena');
    expect(await screen.findByText('▶ ĐĂNG NHẬP / ĐĂNG KÝ', {}, CHO)).toBeInTheDocument();
    expect(docDiemQuayVe()).toBeNull();
  });
});

describe('§III — link xác minh', () => {
  it('?token&ban=<mã> ⇒ điểm quay về ghi ở trình duyệt mở thư; ban lạ ⇒ bỏ', async () => {
    stub((url) => (url.includes('/auth/verify-email') ? json(200, { ok: true, message: 'ok' }) : undefined));
    dung('/verify-email?token=abc&ban=LOP02');
    await waitFor(() => expect(docDiemQuayVe()).toBe('/arena/ban/lop02'), CHO);

    window.localStorage.clear();
    dung('/verify-email?token=abd&ban=https%3A%2F%2Fevil.example');
    expect(await screen.findByText(/ĐÃ XÁC MINH/, {}, CHO)).toBeInTheDocument();
    expect(docDiemQuayVe()).toBeNull();
  });
});

describe('§IV — đăng nhập xong về bàn; tới bàn thì xoá', () => {
  function stubDangNhap() {
    let daVao = false;
    return stub((url) => {
      if (url.includes('/auth/login')) { daVao = true; return json(200, { ok: true, onboarded: true }); }
      if (url.includes('/auth/me')) {
        return daVao
          ? json(200, { email: 'a@b.vn', email_verified: true, onboarded: true, user: USER })
          : json(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
      }
      return undefined;
    });
  }

  it('⭐ có điểm quay về ⇒ đăng nhập xong đi thẳng về bàn', async () => {
    ghiDiemQuayVe('/arena/ban/lop01');
    stubDangNhap();
    const router = dung('/onboard');
    fireEvent.click(await screen.findByText('▶ ĐĂNG KÝ / ĐĂNG NHẬP', {}, CHO));
    fireEvent.change(await screen.findByLabelText('Email', {}, CHO), { target: { value: 'a@b.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau10kytu' } });
    fireEvent.click(screen.getByText('▶ ĐĂNG NHẬP'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/arena/ban/lop01'), CHO);
  });

  it('tới đúng bàn đang nhớ (đã đăng nhập) ⇒ xoá; tới bàn KHÁC ⇒ giữ', async () => {
    const me = () => stub((url) => (url.includes('/auth/me')
      ? json(200, { email: 'a@b.vn', email_verified: true, onboarded: true, user: USER }) : undefined));

    ghiDiemQuayVe('/arena/ban/lop01');
    me();
    dung('/arena/ban/zzz99');
    // Mốc: ô MÀN TẬP chỉ có trong ruột sảnh — tức cổng đăng nhập ĐÃ cho qua, effect xoá đã chạy. (11/10: sảnh bento — ô, không còn dòng chữ dài.)
    await screen.findByTestId('sanh-man-tap', {}, CHO);
    expect(docDiemQuayVe()).toBe('/arena/ban/lop01');

    me();
    dung('/arena/ban/lop01');
    await waitFor(() => expect(docDiemQuayVe()).toBeNull(), CHO);
  });
});

describe('§V — D392: đăng ký từ bàn buổi đo đang mở ⇒ vào thẳng lập hồ sơ', () => {
  const ME_CHUA_HO_SO = { email: 'moi@b.vn', email_verified: false, onboarded: false, user: null };

  function dienDangKy() {
    fireEvent.change(screen.getAllByLabelText('Email').at(-1)!, { target: { value: 'moi@b.vn' } });
    fireEvent.change(screen.getAllByLabelText('Mật khẩu').at(-1)!, { target: { value: 'matkhau10kytu' } });
    fireEvent.change(screen.getAllByLabelText('Nhập lại mật khẩu').at(-1)!, { target: { value: 'matkhau10kytu' } });
    fireEvent.change(screen.getAllByLabelText('Năm sinh').at(-1)!, { target: { value: '2008' } });
    fireEvent.click(screen.getAllByText('▶ TẠO TÀI KHOẢN').at(-1)!);
  }

  it('⭐⭐ server trả phiên (`dang_nhap`) ⇒ đi thẳng /onboard/ho-so, KHÔNG hộp "KIỂM TRA HỘP THƯ"', async () => {
    ghiDiemQuayVe('/arena/ban/lop01');
    let daDangKy = false;
    stub((url) => {
      if (url.includes('/auth/register')) {
        daDangKy = true;
        return json(201, {
          ok: true, dang_nhap: true, onboarded: false, token: 'tok-dk',
          message: 'Đã tạo tài khoản — lập hồ sơ để vào buổi đo.',
        });
      }
      if (url.includes('/auth/me')) return daDangKy ? json(200, ME_CHUA_HO_SO) : undefined;
      return undefined;
    });
    const router = dung('/onboard/dang-ky');
    dienDangKy();
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboard/ho-so'), CHO);
    expect(await screen.findByLabelText('Tên hiển thị (handle)', {}, CHO)).toBeInTheDocument();
    expect(screen.queryByText(/KIỂM TRA HỘP THƯ/)).toBeNull();
  });

  it('server KHÔNG trả phiên (đăng ký thường) ⇒ vẫn hộp "KIỂM TRA HỘP THƯ", đứng yên tại chỗ', async () => {
    stub((url) => (url.includes('/auth/register')
      ? json(202, { ok: true, message: 'Kiểm tra hộp thư để xác minh email nhé.' }) : undefined));
    const router = dung('/onboard/dang-ky');
    dienDangKy();
    expect(await screen.findByText(/KIỂM TRA HỘP THƯ/, {}, CHO)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboard/dang-ky');
  });

  async function lapHoSo(): Promise<Record<string, unknown>> {
    const calls = stub((url) => {
      if (url.includes('/auth/me')) return json(200, ME_CHUA_HO_SO);
      if (url.includes('/onboarding')) return json(201, { ok: true, user_id: 'u1', bankroll: 1000 });
      return undefined;
    });
    dung('/onboard/ho-so');
    fireEvent.change(await screen.findByLabelText('Tên hiển thị (handle)', {}, CHO), { target: { value: 'tester_1' } });
    fireEvent.click(screen.getByText('18–22'));
    fireEvent.click(screen.getByText('Miền Nam'));
    fireEvent.click(screen.getByText('Học sinh · SV'));
    fireEvent.click(screen.getByText(NEN_TANG[0]!.ten));
    fireEvent.click(screen.getByText('▶ NHẬN 1.000 T VỐN KHỞI ĐIỂM'));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/onboarding'))).toBe(true), CHO);
    return JSON.parse(String(calls.find((c) => c.url.includes('/onboarding'))!.init?.body)) as Record<string, unknown>;
  }

  it('⭐⭐ lập hồ sơ khi đang nhớ bàn ⇒ gửi kèm ban_ma (cửa D370 ở /onboarding kiểm đúng mã này)', async () => {
    ghiDiemQuayVe('/arena/ban/lop01');
    expect((await lapHoSo()).ban_ma).toBe('lop01');
  });

  it('không nhớ bàn ⇒ lập hồ sơ KHÔNG mang ban_ma (hợp đồng cũ giữ nguyên)', async () => {
    expect(await lapHoSo()).not.toHaveProperty('ban_ma');
  });
});
