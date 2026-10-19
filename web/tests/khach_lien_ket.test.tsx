/**
 * KHÁCH PHẢI CÓ ĐƯỜNG RA (founder 04/08: *"mở bằng discord thì không có yêu cầu
 * đăng ký hay đăng nhập tài khoản nào mà chỉ được tặng ngay 1 tài khoản khách"*).
 *
 * ⚠⚠ LỖI GỐC LÀ MỘT ĐIỀU KIỆN, không phải một tính năng thiếu: Hub chỉ hiện nút
 * đăng nhập khi `user === null`, mà khách thì CÓ `user`. Nên cửa duy nhất để thoát
 * chế độ khách biến mất đúng với người đang ở trong chế độ khách — và trong
 * Discord thì AI CŨNG là khách.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { fireEvent, screen, waitFor, cleanup } from '@testing-library/react';
import { renderAt, stubFetch, ME_ONBOARDED } from './helpers';
import type { MeResponse } from '@/api/types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ME_KHACH: MeResponse = {
  ...ME_ONBOARDED,
  user: { ...ME_ONBOARDED.user!, handle: 'khach_p83m0c21', la_khach: true },
};
const ME_THAT: MeResponse = {
  ...ME_ONBOARDED,
  user: { ...ME_ONBOARDED.user!, la_khach: false },
};

const BANG = (me: MeResponse, extra: [string, { status: number; body: unknown }][] = []) =>
  [...extra, ['/auth/me', { status: 200, body: me }]] as
    [string, { status: number; body: unknown }][];

describe('Khách thấy đường ra', () => {
  it('⭐ khách → CÓ nút đăng ký, và nói rõ đang mất gì', async () => {
    stubFetch(BANG(ME_KHACH));
    renderAt('/');
    expect(await screen.findByText(/ĐĂNG KÝ ĐỂ GIỮ TÀI KHOẢN/)).toBeTruthy();
    // 11/10: lời nhắn "chỉ ở lại trên máy này" dời lên ĐẦU SẢNH (Khách · chỉ lưu trên máy này) — vẫn nói thẳng cái mất.
    expect(screen.getByText(/chỉ lưu trên máy này/)).toBeTruthy();
  });

  it('tài khoản thật → KHÔNG mọc lời mời thừa', async () => {
    stubFetch(BANG(ME_THAT));
    renderAt('/');
    await screen.findByText(/không có giá trị thật/);
    expect(screen.queryByText(/ĐĂNG KÝ ĐỂ GIỮ TÀI KHOẢN/)).toBeNull();
    expect(screen.queryByText(/tài khoản khách/i)).toBeNull();
  });

  /*
   * ⚠ API deploy tách khỏi bundle nên "máy chủ cũ hơn web" là trạng thái BÌNH
   * THƯỜNG ở repo này. Vắng `la_khach` phải rơi về "không phải khách" — đoán
   * ngược lại thì mọi người dùng thật bị mời đăng ký một tài khoản họ đã có.
   */
  it('máy chủ cũ không trả `la_khach` → coi như không phải khách', async () => {
    const { la_khach: _, ...u } = ME_KHACH.user!;
    stubFetch(BANG({ ...ME_KHACH, user: u as any }));
    renderAt('/');
    await screen.findByText(/không có giá trị thật/);
    expect(screen.queryByText(/ĐĂNG KÝ ĐỂ GIỮ TÀI KHOẢN/)).toBeNull();
  });

  it('chưa đăng nhập → vẫn là nút cũ, chữ cũ', async () => {
    stubFetch(BANG({ ...ME_ONBOARDED, user: null }));
    renderAt('/');
    expect(await screen.findByText(/ĐĂNG NHẬP \/ ĐĂNG KÝ/)).toBeTruthy();
  });
});

describe('Đăng nhập trong Discord', () => {
  /*
   * ⚠⚠ BÀI QUAN TRỌNG NHẤT. Không giữ token thì đăng nhập bằng email KHÔNG DÍNH
   * trong iframe: cookie `SameSite=Lax` không được gửi xuyên site, nên màn hình
   * nói đã vào mà mọi request vẫn 401. Đó chính là lý do người mở Activity trước
   * nay chỉ có mỗi đường tài khoản khách.
   */
  it('⭐ đăng nhập xong thì token đi kèm mọi request sau đó', async () => {
    const calls = stubFetch([
      ['/auth/login', { status: 200, body: { ok: true, onboarded: true, token: 'tok-abc' } }],
      // ⚠ `/auth/me` để 401 (mặc định của stub): trả 200 thì `useEffect` của màn
      // đăng nhập thấy đã có phiên và điều hướng đi NGAY, biểu mẫu biến mất trước
      // khi test kịp gõ.
    ]);
    renderAt('/onboard');
    // Biểu mẫu nằm trong BOARD từ 07/09 — phải mở board rồi mới gõ được.
    fireEvent.click(await screen.findByText('▶ ĐĂNG KÝ / ĐĂNG NHẬP'));
    await screen.findByText('▶ ĐĂNG NHẬP');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau10kytu' } });
    fireEvent.click(screen.getByText('▶ ĐĂNG NHẬP'));

    await waitFor(() => expect(calls.some((c) => c.url.includes('/auth/login'))).toBe(true));
    // Mọi request SAU khi đăng nhập phải mang Bearer — nếu không thì trong iframe
    // chúng ăn 401 hết.
    await waitFor(() => {
      const sau = calls.filter((c) => c.url.includes('/auth/me')).length;
      expect(sau).toBeGreaterThan(0);
    });
    const g = (globalThis.fetch as any).mock.calls
      .map((c: any[]) => c[1]?.headers?.authorization)
      .filter(Boolean);
    expect(g, 'không có Bearer nào sau khi đăng nhập = hỏng trong Discord')
      .toContain('Bearer tok-abc');
  });

  it('máy chủ cũ không trả token → vẫn đăng nhập được bằng cookie, không nổ', async () => {
    stubFetch([
      ['/auth/login', { status: 200, body: { ok: true, onboarded: true } }],
    ]);
    renderAt('/onboard');
    // Biểu mẫu nằm trong BOARD từ 07/09 — phải mở board rồi mới gõ được.
    fireEvent.click(await screen.findByText('▶ ĐĂNG KÝ / ĐĂNG NHẬP'));
    await screen.findByText('▶ ĐĂNG NHẬP');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.vn' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'matkhau10kytu' } });
    fireEvent.click(screen.getByText('▶ ĐĂNG NHẬP'));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * CỬA VÀO — founder 04/08, hai lệnh trong một tin nhắn
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * (1) *"bấm đăng ký để giữ tài khoản mà nó đ** điều hướng đi đâu"* — màn đăng
 *     nhập đá MỌI phiên về `/`, kể cả khách. Mà khách CÓ phiên và
 *     `onboarded === true`, nên nó đá đúng người cần màn này nhất, bằng
 *     `replace: true` nên không để lại dấu vết nào. Nhìn từ ngoài: bấm, không có
 *     gì xảy ra.
 * (2) *"đăng ký hay điều khoản phải đặt ở ngay đầu sau khi người chơi mở app"*.
 */
describe('Cửa vào', () => {
  /*
   * ⚠⚠ PHẢI CHỜ `/auth/me` VỀ RỒI MỚI KHẲNG ĐỊNH — và bản đầu của chính bài này
   * quên, nên nó XANH GIẢ: `findByLabelText('Email')` khớp ngay ở lần render đầu,
   * TRƯỚC khi `me` kịp về, nên cú đá xảy ra sau đó không bài nào nhìn thấy. Tiêm
   * lại lỗi cũ mà test vẫn xanh — đúng bẫy D62, và chỉ lộ ra vì có tiêm.
   */
  const doiMeVeRoiLang = async (calls: { url: string }[]) => {
    await waitFor(() => expect(calls.some((c) => c.url.includes('/auth/me'))).toBe(true));
    await new Promise((r) => { setTimeout(r, 300); });
  };

  it('⭐ khách vào /onboard thì Ở LẠI, không bị đá về Hub', async () => {
    const calls = stubFetch(BANG(ME_KHACH));
    renderAt('/onboard');
    await doiMeVeRoiLang(calls);
    // Mốc "đã bị đá": dòng chân trang của Hub. Chuỗi này KHÔNG có ở màn đăng nhập.
    expect(screen.queryByText(/không có giá trị thật/), 'khách bị đá về Hub').toBeNull();
    // Từ 07/09 ô Email nằm trong board (đóng sẵn) ⇒ mốc "còn ở /onboard" là NÚT CHÍNH.
    expect(screen.getByText('▶ ĐĂNG KÝ / ĐĂNG NHẬP')).toBeTruthy();
  });

  it('tài khoản THẬT vào /onboard thì vẫn bị đá về Hub như cũ', async () => {
    const calls = stubFetch(BANG(ME_THAT));
    renderAt('/onboard');
    await doiMeVeRoiLang(calls);
    /*
     * ⚠ THƯỚC PHẢI LÀ NÚT CHÍNH, KHÔNG PHẢI Ô EMAIL. Sau 07/09 ô Email không
     * bao giờ render sẵn ở /onboard, nên `queryByLabelText('Email') === null`
     * đúng cả khi cú đá HỎNG — bài sẽ xanh mà không canh gì (đúng bẫy D62/A11.23).
     */
    expect(screen.queryByText('▶ ĐĂNG KÝ / ĐĂNG NHẬP'), 'không bị đá về Hub').toBeNull();
  });

  /*
   * ⚠ THỨ TỰ LÀ NỘI DUNG, không phải trang trí: trong Discord đây là màn ĐẦU
   * TIÊN người lạ nhìn thấy, và một ô Email đứng trước là chỗ người ta đóng lại.
   *
   * 07/09 — founder siết thêm một nấc: ô Email không chỉ phải đứng sau, mà
   * KHÔNG ĐƯỢC CÓ MẶT cho tới khi người ta tự mở board. Bài này đổi thước theo,
   * và giữ nguyên phần nó vốn canh: đường khách + điều khoản đứng trước biểu mẫu.
   */
  it('⭐ màn cửa vào KHÔNG bày sẵn ô Email; điều khoản + đường khách đứng ngay dưới nút', async () => {
    /*
     * ⚠ PHẢI 401, KHÔNG được `{...ME_ONBOARDED, user: null}`. Fixture đó có
     * `onboarded: true` nên effect của `Login` đá thẳng về `/` — board vừa mở đã
     * bị tháo, và bài đỏ vì lý do sai. 401 = đúng đời thật của người chưa có phiên.
     */
    stubFetch([['/auth/me', { status: 401, body: { error: 'unauthenticated', message: 'x' } }]]);
    renderAt('/onboard');
    const nut = await screen.findByText('▶ ĐĂNG KÝ / ĐĂNG NHẬP');
    const dieuKhoan = screen.getByText(/Điều khoản/);
    const choi = screen.getByText(/^Chơi ngay$/);

    expect(screen.queryByLabelText('Email'), 'biểu mẫu bày sẵn = bố cục cũ').toBeNull();

    const truoc = (a: Element, b: Element) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(truoc(nut, dieuKhoan), 'điều khoản không đứng cùng tầm mắt với nút').toBe(true);
    expect(truoc(dieuKhoan, choi), 'đường khách phải nằm DƯỚI điều khoản').toBe(true);

    // Mở board thì ô Email mới xuất hiện — nếu không thì nút chính là nút chết.
    fireEvent.click(nut);
    expect(await screen.findByLabelText('Email')).toBeTruthy();
  });

  /*
   * ⭐⭐ BUG 15/08 — bắt được khi đi thử bằng mắt NGƯỜI LẠ, không phải bằng test.
   *
   * Bấm CHƠI NGAY: phiên tạo 200, `/auth/me` 200, ví đổi KHÁCH → 0 T — và màn
   * ĐỨNG NGUYÊN ở /onboard mãi mãi. Hai bản vá đúng va nhau: effect điều hướng
   * cố ý `return` khi `la_khach` (để khách quay lại đăng ký không bị đá đi —
   * bug 04/08), còn `useVaoKhach` lại TRÔNG CẬY đúng effect đó để đi tiếp.
   *
   * Vì sao không test nào bắt: mọi bài trước chỉ hỏi "nút có đứng đúng chỗ
   * không", chưa bài nào hỏi "bấm nó rồi CÓ ĐI ĐÂU KHÔNG". Một cái nút chết
   * ở cửa vào duy nhất không cần email (D64) làm mọi phép thử "5 phút đầu"
   * vô nghĩa — mà D62 đo 66/90 lượt bỏ trận nằm trong đúng phút đó.
   */
  /*
   * ⚠ D374 (founder 21/09) — ĐÍCH ĐỔI, THỨ BÀI NÀY CANH THÌ KHÔNG.
   * Trước: vào thẳng sảnh Đấu trường (D86). Nay: về HUB — *"đăng nhập xong phải dẫn vào
   * hub"*. Bug mà bài này sinh ra để bắt vẫn y nguyên: **bấm nút rồi CÓ ĐI ĐÂU KHÔNG**.
   */
  it('⭐⭐ bấm CHƠI NGAY → PHẢI RỜI màn đăng nhập, về HUB (D374)', async () => {
    let daTaoKhach = false;
    stubFetch([
      ['/auth/khach', { status: 200, body: { ok: true, token: 'tk', user_id: 'u-khach' } }],
      /*
       * Trước cú bấm: CHƯA CÓ PHIÊN ⇒ `/auth/me` là 401 — đúng đời thật.
       * Bản đầu của bài này stub 200 + `user: null`, và effect ở Login.tsx đá về
       * `/` ngay (vì `onboarded: true`) — tức bài đo một thứ không tồn tại và
       * đỏ vì lý do sai. Fixture lệch đời thật là fixture nói dối.
       */
      ['/auth/me', { status: 401, body: { error: 'unauthenticated', message: 'x' } }],
    ]);
    // Ghi đè /auth/me để đổi câu trả lời SAU khi /auth/khach chạy
    const goc = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/auth/khach')) daTaoKhach = true;
      if (url.includes('/auth/me') && daTaoKhach) {
        return new Response(JSON.stringify(ME_KHACH), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      }
      return goc(input, init);
    }) as typeof fetch;

    renderAt('/onboard');
    // đang ở màn cửa vào (mốc = nút chính; ô Email nằm trong board, đóng sẵn)
    expect(screen.getByText('▶ ĐĂNG KÝ / ĐĂNG NHẬP')).toBeInTheDocument();
    // 07/09: đường khách là DÒNG CHỮ trong dòng điều khoản, không còn là nút to.
    fireEvent.click(await screen.findByText(/^Chơi ngay$/));

    /*
     * ⚠ Đo bằng NỘI DUNG MÀN, không đo `window.location`: `renderAt` dùng
     * `createMemoryRouter`, mà memory router KHÔNG BAO GIỜ đụng `window.location`
     * — nó luôn là "/" của jsdom bất kể đang ở route nào. Bản đầu của bài này
     * đo `pathname` và đỏ với cả code ĐÚNG lẫn code SAI, tức nó đo một thứ
     * không tồn tại. Thước phải là: màn cửa vào biến mất, sảnh hiện ra.
     */
    await waitFor(() => {
      expect(
        screen.queryByText('▶ ĐĂNG KÝ / ĐĂNG NHẬP'),
        'vẫn kẹt ở màn đăng nhập sau khi vào khách',
      ).toBeNull();
    }, { timeout: 3000 });
    // Hub nhận diện bằng ô khu — cả hai ô phải có mặt thì mới chắc là Hub, không phải
    // một màn nào đó tình cờ có chữ ALPHA DRAFT.
    expect((await screen.findAllByText(/ALPHA DRAFT/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^TÀI CHÍNH$/).length).toBeGreaterThan(0);
  });

  it('điều khoản là LINK bấm được, không phải một dòng chữ suông', async () => {
    stubFetch(BANG({ ...ME_ONBOARDED, user: null }));
    renderAt('/onboard');
    const a = await screen.findByRole('link', { name: /Điều khoản/ });
    expect(a.getAttribute('href')).toBe('/dieu-khoan');
  });
});
