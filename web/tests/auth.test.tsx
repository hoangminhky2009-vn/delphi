/**
 * Test cụm auth — stub fetch theo ĐÚNG contract server/app.ts (GĐ2).
 * Mỗi case dựng bảng route → response; request không khớp bảng → 401 mặc định.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { routes } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import { NEN_TANG } from '@config/avatar';
import { CONSENT_PHIEN_BAN } from '@config/pfm_consent';

/*
 * NHÃN LÁ TẶNG LẤY TỪ CONFIG, KHÔNG GÕ CHUỖI. D36 đổi tên hai lá ("MŨ LƯỠI TRAI"
 * → "ĐỘI MŨ", "TÓC BÚI" → "BÚI TÓC") và hai ca dưới đây đỏ vì gõ cứng tên cũ.
 * Đọc từ `NEN_TANG` vẫn canh đúng thứ cần canh — `getByText` sẽ trượt nếu màn
 * render nhãn khác config — mà không đỏ thêm lần nào nữa vì một cú đổi chữ.
 */
const [NEN_A, NEN_B] = NEN_TANG;

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

type Route = { status: number; body: unknown };

function stubFetch(table: Record<string, Route>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, ...(init !== undefined ? { init } : {}) });
    const hit = Object.entries(table).find(([k]) => url.includes(k));
    const [status, body] = hit
      ? [hit[1].status, hit[1].body]
      : [401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' }];
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

const ME_NOT_ONBOARDED = {
  status: 200,
  body: { email: 'a@b.vn', email_verified: true, onboarded: false, user: null },
};

describe('đăng nhập', () => {
  it('thành công → gọi đúng path/body và điều hướng theo onboarded=true (về sảnh)', async () => {
    // Stub CÓ TRẠNG THÁI: /auth/me 401 trước login (đúng đời thật — cookie chưa có),
    // 200 onboarded sau khi POST /auth/login (cookie server đặt).
    let loggedIn = false;
    const calls: { url: string; init?: RequestInit }[] = [];
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, ...(init !== undefined ? { init } : {}) });
        if (url.includes('/auth/login')) {
          loggedIn = true;
          return json(200, { ok: true, onboarded: true });
        }
        if (url.includes('/auth/me')) {
          return loggedIn
            ? json(200, {
                email: 'a@b.vn',
                email_verified: true,
                onboarded: true,
                user: {
                  user_id: 'u1',
                  handle: 'tester',
                  age_band: '18-22',
                  region: 'nam',
                  occupation_band: 'hs_sv',
                  bankroll: 1000,
                  role: 'user',
                  research_consent: true,
                  created_at: '2026-07-18T00:00:00Z',
                  season_id: '2026Q3',
                },
              })
            : json(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
        }
        if (url.includes('/markets?')) return json(200, { markets: [] });
        return json(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
      }),
    );

    renderAt('/onboard');
    // Biểu mẫu nằm trong BOARD từ 07/09 — phải mở board rồi mới gõ được.
    fireEvent.click(await screen.findByText('▶ ĐĂNG KÝ / ĐĂNG NHẬP'));
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau10kytu' } });
    fireEvent.click(screen.getByText('▶ ĐĂNG NHẬP'));

    // Về '/' = HUB. Mốc là nút chính của ô Đấu trường (11/10: thay cho thẻ "PREDICT MARKET" của Hub cũ) — chuỗi này CHỈ có ở Hub,
    // không có trong hero đăng nhập, nên nó phân biệt được hai màn.
    expect(await screen.findByText('VÀO TRẬN ▸')).toBeInTheDocument();
    const login = calls.find((c) => c.url.includes('/auth/login'));
    expect(login).toBeDefined();
    expect(login!.url).toBe('/api/v1/auth/login');
    expect(login!.init?.method).toBe('POST');
    expect(JSON.parse(String(login!.init?.body))).toEqual({
      email: 'a@b.vn',
      password: 'matkhau10kytu',
    });
  });

  it('403 email_not_verified → hiện thông điệp + nhắc kiểm tra hộp thư', async () => {
    stubFetch({
      '/auth/login': {
        status: 403,
        body: { error: 'email_not_verified', message: 'Bạn cần xác minh email trước khi đăng nhập.' },
      },
    });
    renderAt('/onboard');
    // Biểu mẫu nằm trong BOARD từ 07/09 — phải mở board rồi mới gõ được.
    fireEvent.click(await screen.findByText('▶ ĐĂNG KÝ / ĐĂNG NHẬP'));
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau10kytu' } });
    fireEvent.click(screen.getByText('▶ ĐĂNG NHẬP'));
    expect(await screen.findByText(/xác minh email trước khi đăng nhập/)).toBeInTheDocument();
  });
});

describe('đăng ký', () => {
  function fillRegister() {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'moi@b.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau10kytu' } });
    fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu'), {
      target: { value: 'matkhau10kytu' },
    });
    fireEvent.change(screen.getByLabelText('Năm sinh'), { target: { value: '2008' } });
  }

  it('202 → màn "kiểm tra hộp thư" + body đúng contract (birth_year là number)', async () => {
    const calls = stubFetch({
      '/auth/register': {
        status: 202,
        body: { ok: true, message: 'Kiểm tra hộp thư để xác minh email nhé.' },
      },
    });
    renderAt('/onboard/dang-ky');
    fillRegister();
    fireEvent.click(screen.getByText('▶ TẠO TÀI KHOẢN'));
    expect(await screen.findByText(/KIỂM TRA HỘP THƯ/)).toBeInTheDocument();
    const reg = calls.find((c) => c.url.includes('/auth/register'));
    expect(JSON.parse(String(reg!.init?.body))).toEqual({
      email: 'moi@b.vn',
      password: 'matkhau10kytu',
      birth_year: 2008,
    });
  });

  it('403 under_age → thông điệp chặn 16+ tử tế', async () => {
    stubFetch({
      '/auth/register': {
        status: 403,
        body: {
          error: 'under_age',
          message: 'Rất tiếc, Dự báo chỉ dành cho người từ 16 tuổi trở lên. Hẹn gặp bạn sau nhé!',
        },
      },
    });
    renderAt('/onboard/dang-ky');
    fillRegister();
    fireEvent.click(screen.getByText('▶ TẠO TÀI KHOẢN'));
    expect(await screen.findByText(/16 tuổi trở lên/)).toBeInTheDocument();
  });
});

describe('onboarding hồ sơ', () => {
  it('gửi ĐÚNG payload demographic + 201 → chúc mừng vốn khởi điểm', async () => {
    const calls = stubFetch({
      '/auth/me': ME_NOT_ONBOARDED,
      '/onboarding': { status: 201, body: { ok: true, user_id: 'u1', bankroll: 1000 } },
    });
    renderAt('/onboard/ho-so');
    fireEvent.change(await screen.findByLabelText('Tên hiển thị (handle)'), {
      target: { value: 'Du_Bao_1' },
    });
    fireEvent.click(screen.getByText('18–22'));
    fireEvent.click(screen.getByText('Miền Nam'));
    fireEvent.click(screen.getByText('Học sinh · SV'));
    // Ảnh đại diện là BẮT BUỘC ở màn này — không chạm lá nào thì nút vẫn khoá.
    fireEvent.click(screen.getByText(NEN_B!.ten));
    // Điều khoản cũng BẮT BUỘC từ 03/08 — xem bài "chưa đồng ý → nút còn khoá".
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('▶ NHẬN 1.000 T VỐN KHỞI ĐIỂM'));

    expect(await screen.findByText('+1.000 T')).toBeInTheDocument();
    const ob = calls.find((c) => c.url.includes('/onboarding'));
    const payload = JSON.parse(String(ob!.init?.body));
    // `avatar_ms` là thời gian thật nên không so bằng — chỉ khẳng định nó CÓ và
    // là một số. Ghim một giá trị cụ thể là ghim đồng hồ, không phải ghim hợp đồng.
    expect(typeof payload.avatar_ms).toBe('number');
    delete payload.avatar_ms;
    expect(payload).toEqual({
      handle: 'du_bao_1', // client tự lowercase theo luật handle
      age_band: '18-22',
      region: 'nam',
      occupation_band: 'hs_sv',
      research_consent: true,
      // 0079 — số bản văn đồng ý đang hiện trên màn (server ghi vết đúng bản ấy).
      research_consent_phien_ban: CONSENT_PHIEN_BAN.nghien_cuu,
      avatar_goc: NEN_B!.ma,
    });
  });

  it('CHƯA chọn ảnh đại diện → nút nhận vốn còn khoá', async () => {
    stubFetch({ '/auth/me': ME_NOT_ONBOARDED });
    renderAt('/onboard/ho-so');
    fireEvent.change(await screen.findByLabelText('Tên hiển thị (handle)'), {
      target: { value: 'du_bao_2' },
    });
    fireEvent.click(screen.getByText('18–22'));
    fireEvent.click(screen.getByText('Miền Nam'));
    fireEvent.click(screen.getByText('Học sinh · SV'));

    // Đủ mọi ô demographic mà vẫn khoá: đó chính là điều kiện làm `avatar_chon`
    // đo được GU chứ không đo được CÁI MẶC ĐỊNH.
    expect(screen.getByText('▶ NHẬN 1.000 T VỐN KHỞI ĐIỂM')).toBeDisabled();
    fireEvent.click(screen.getByText(NEN_A!.ten));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByText('▶ NHẬN 1.000 T VỐN KHỞI ĐIỂM')).not.toBeDisabled();
  });

  it('CHƯA đồng ý điều khoản vẫn TẠO ĐƯỢC tài khoản — cổng không ở cửa vào', async () => {
    /*
     * ⚠ Founder chốt 03/08 SAU KHI đã thử hướng ngược lại: ép tích ô để được
     * tạo tài khoản thì "đồng ý" không còn là đồng ý, nó là phí vào cửa trả
     * bằng dữ liệu. Cổng đứng ở XẾP HẠNG — chỗ tên bạn đứng cạnh tên người lạ
     * — chứ không ở cửa vào. Bài này khoá đúng chuyện đó ở màn onboarding;
     * cổng thật nằm ở server (bộ X phía gốc), vì client không bao giờ là gác
     * cổng (C4).
     */
    stubFetch({ '/auth/me': ME_NOT_ONBOARDED });
    renderAt('/onboard/ho-so');
    fireEvent.change(await screen.findByLabelText('Tên hiển thị (handle)'), {
      target: { value: 'du_bao_3' },
    });
    fireEvent.click(screen.getByText('18–22'));
    fireEvent.click(screen.getByText('Miền Nam'));
    fireEvent.click(screen.getByText('Học sinh · SV'));
    fireEvent.click(screen.getByText(NEN_A!.ten));

    // Đủ mọi thứ khác, KHÔNG tích ô điều khoản ⇒ vẫn gửi được.
    expect(screen.getByText('▶ NHẬN 1.000 T VỐN KHỞI ĐIỂM')).not.toBeDisabled();
  });
});

describe('quên mật khẩu', () => {
  it('202 luôn → hiện đã gửi (không lộ email tồn tại)', async () => {
    stubFetch({
      '/auth/forgot-password': {
        status: 202,
        body: { ok: true, message: 'Nếu email tồn tại, thư đặt lại mật khẩu đã được gửi.' },
      },
    });
    renderAt('/onboard/quen-mat-khau');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ai-do@b.vn' } });
    fireEvent.click(screen.getByText('▶ GỬI EMAIL ĐẶT LẠI'));
    expect(await screen.findByText(/ĐÃ GỬI/)).toBeInTheDocument();
  });
});
