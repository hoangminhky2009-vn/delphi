/**
 * Smoke: mọi route render được; màn dữ liệu (API requireAuth) khi là KHÁCH phải
 * hiện cổng đăng nhập chứ không vỡ.
 *
 * 25/07/2026 — cập nhật cho IA refactor: nav 4 tab, tên mode, `/ket-qua`
 * redirect vào module Dự báo, route mới `/shop` + `/arena`.
 *
 * ⚠⚠ 07/09/2026 — **`/` KHÔNG CÒN LÀ HUB CÔNG KHAI** (chỉ thị founder: cửa sổ
 * đăng nhập *"sẽ là cái đầu tiên đập vào mắt khi vào app"*). Chưa có phiên mà
 * vào `/` thì bị đưa thẳng tới `/onboard`. Hệ quả cho tệp này: mọi bài đọc nội
 * dung Hub phải CÓ PHIÊN trước (`coPhien()`), nếu không nó đo màn đăng nhập mà
 * tưởng đang đo Hub. Đường SÂU (`/arena`, `/keo/:id`, link mời…) KHÔNG bị đá —
 * `AuthGate` vẫn lo, và đó là chỗ `GATE` bên dưới còn đúng.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderAt, stubFetch, ME_ONBOARDED } from './helpers';

/*
 * SPEC chan-truoc-beta — khu Tài chính đang KHOÁ trên web (`lib/pfm_mo.ts`). Tệp này đo khu ấy ở trạng thái MỞ — mã của trạng thái
 * mở vẫn còn nguyên cho ngày mở lại (điều kiện ở `pfm_mo.ts`), nên GHIM cờ bật thay vì bỏ bài. Trạng thái KHOÁ: `pfm_khoa_web.test.tsx`.
 */
vi.mock('@/lib/pfm_mo', () => ({ PFM_WEB_MO: true }));

/** Cổng của `AuthGate` (màn dữ liệu, khách vào bị chặn tại chỗ). */
const GATE = '▶ ĐĂNG NHẬP / ĐĂNG KÝ';
/** Nút chính của màn cửa vào `/onboard` — ⚠ THỨ TỰ CHỮ NGƯỢC với `GATE`. */
const CUA_VAO = '▶ ĐĂNG KÝ / ĐĂNG NHẬP';

/** Có phiên thật ⇒ không bị cổng `/` đá đi, Hub render như cũ. */
const coPhien = () => stubFetch([['/auth/me', { status: 200, body: ME_ONBOARDED }]]);

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const CASES: Array<[path: string, marker: string | RegExp]> = [
  // 07/09: chưa có phiên vào `/` ⇒ bị đưa tới màn cửa vào, KHÔNG thấy Hub nữa.
  ['/', CUA_VAO],
  ['/du-bao', GATE],
  // Tab Kết quả cũ: route còn sống nhưng chỉ để REDIRECT vào module Dự báo.
  // Đích cũng gác AuthGate nên khách vẫn thấy cổng — link cũ không chết.
  ['/ket-qua', GATE],
  ['/arena', GATE],
  ['/arena/tran', GATE],
  // Path cũ của mode, redirect sang /arena. Founder đã mở link này trên máy thật.
  ['/alpha-draft', GATE],
  ['/alpha-draft/tran', GATE],
  /*
   * ⚠ ĐÃ XOÁ 27/07 — bốn route `/dau-truong/*` (loop CŨ 12 vòng) và cả bốn màn của
   * chúng. Founder: *"xóa hết mấy cái link phụ hay bản test đi"*.
   *
   * Cùng đợt, `tests/arena.test.tsx` (12 test cho bốn màn đó) bị xoá theo. Ghi rõ
   * độ phủ đi đâu, để không ai tưởng vừa mất trắng:
   *   · "không ngôn ngữ casino ở sảnh" → từng là `lint:lexicon`; luật đó và lint
   *     đã gỡ 16/08 (D91, chỉ thị founder) — không còn gì canh, và không cần canh.
   *   · route bàn đấu (F5 không mất trận · lỗi có nút ra · path trần về sảnh)
   *     → `tests/banroute.test.tsx`, viết cho màn HIỆN HÀNH.
   *   · các khối trong bàn đấu → betbar · quantrivon · bangdientu · chain ·
   *     dongho · thegiaithich · cardfx · vongcuoc.
   *
   * ⚠ MẤT THẬT, ghi thành nợ chứ không lờ: luật **"không có token T trong Đấu
   * trường"** (tách bạch T của chợ dự báo khỏi Vốn trong trận) mất người canh ở
   * tầng màn hình. Cần một test cho sảnh + bàn đấu HIỆN HÀNH.
   */
  ['/keo/m1', GATE],
  ['/keo/m1/ket-qua', GATE],
  ['/vi', GATE],
  ['/shop', GATE],
  ['/ho-so', GATE],
  // Màn cửa vào không còn `ScreenFrame` "Đăng nhập" — mốc là NÚT CHÍNH.
  ['/onboard', CUA_VAO],
  ['/onboard/dang-ky', 'Đăng ký'],
  ['/onboard/quen-mat-khau', 'Quên mật khẩu'],
  ['/verify-email', 'Xác minh email'],
  ['/reset-password', 'Đặt lại mật khẩu'],
  ['/duong-dan-khong-ton-tai', 'Không có trang này'],
];

describe('khung route (khách — fetch mặc định 401)', () => {
  for (const [path, marker] of CASES) {
    it(`render được ${path}`, async () => {
      renderAt(path);
      expect((await screen.findAllByText(marker)).length).toBeGreaterThan(0);
    });
  }

  /*
   * 11/10 — HUB BENTO (SPEC `ui-tang-khong-gian`): các thẻ module hàng dọc thành LƯỚI Ô; mô tả / lý do khoá dồn vào LỚP TRƯỢT.
   * Sáu bài dưới đây giữ NGUYÊN điều chúng canh (Lab khoá có lý do · Tài chính / Đấu trường / Predict bấm được và RỜI Hub ·
   * D86 thứ tự · "Earn Token" chỉ ở Dự báo), chỉ đổi thước cho đúng thiết kế mới:
   *   · nhãn trên ô: ALPHA DRAFT · TÀI CHÍNH · PREDICT · LAB (tên đầy đủ nằm ở ĐẦU lớp trượt);
   *   · ô Tài chính / Mùa: chạm = lớp trượt, rồi nút chính trong lớp mới đi (2 chạm — SPEC mục 6, góp ý demo bản 2);
   *   · Predict: chạm đi thẳng, GIỮ 0,45 s mới ra lớp mô tả.
   */
  const oHub = (dau: string) => document.querySelector(`[data-o="${dau}"]`) as HTMLElement;

  it('hub: ô chưa mở (LAB) → lắc rồi lớp trượt nói "Admin đang chạy thận" (copy founder)', async () => {
    coPhien();
    renderAt('/');
    await screen.findByText('ALPHA DRAFT');
    fireEvent.click(oHub('lab'));
    expect(await screen.findByText(/Admin đang chạy thận, hãy quay lại sau/)).toBeInTheDocument();
    expect(screen.getByText('ORACLE LAB')).toBeInTheDocument();
  });

  /*
   * ⚠ 07/09 — ô vẫn trỏ `/tai-chinh`, nhưng đó nay là CỬA điều phối: nó đưa tiếp sang THẺ (chưa mở khoá / chưa xem lần nào) hoặc
   * SỔ. Nên thước không còn là "thấy chữ của màn THẺ" mà là "RA KHỎI Hub và vào ĐÚNG khu tài chính". 11/10: ra khỏi Hub bằng nút
   * MỞ TÀI CHÍNH trong lớp trượt.
   */
  it('hub: TÀI CHÍNH đã MỞ → chạm ô, MỞ TÀI CHÍNH → sang khu Tài chính (không phải ô khoá)', async () => {
    coPhien();
    renderAt('/');
    await screen.findByText('ALPHA DRAFT');
    fireEvent.click(oHub('tai-chinh'));
    fireEvent.click(await screen.findByText(/MỞ TÀI CHÍNH/));
    /*
     * Thước là RỜI KHỎI HUB, không phải "thấy chữ X của màn đích": đích đi qua một cửa điều phối rồi mới tới một màn NẠP TRỄ, nên
     * bám vào chữ của màn đích là bám vào thời điểm chunk về — bài sẽ chớp tắt theo máy chạy. Ô khoá thì KHÔNG rời Hub (xem bài
     * LAB ngay trên), nên phép đo này vẫn phân biệt đúng hai ca.
     */
    await waitFor(() => expect(screen.queryByText('ALPHA DRAFT')).toBeNull());
    expect(screen.queryByText(/Admin đang chạy thận/)).toBeNull();
  });

  /*
   * ⚠ 07/09 — bài này ĐỔI THƯỚC, không đổi thứ nó canh: muốn thấy Hub thì PHẢI có phiên (cổng `/` mới). Thứ bài canh vẫn đo được:
   * ô KHÔNG bị khoá, và bấm nó thì ĐI ĐÂU ĐÓ (rời khỏi Hub). 11/10: nút VÀO TRẬN — MỘT chạm.
   */
  it('hub: ALPHA DRAFT đã MỞ → VÀO TRẬN bấm được, rời Hub (không phải ô khoá)', async () => {
    coPhien();
    renderAt('/');
    fireEvent.click(await screen.findByText('VÀO TRẬN ▸'));
    await waitFor(() => expect(screen.queryByText('TÀI CHÍNH')).toBeNull());
    expect(screen.queryByText(/Admin đang chạy thận/)).toBeNull();
  });

  /*
   * ⚠ D86 + founder chỉnh 15/08: chợ dự báo KHÔNG khoá ("đừng khóa chức năng gì đang chạy") — chỉ HẠ BẬC. Hai bất biến:
   *   1. ĐẤU TRƯỜNG đứng TRÊN PREDICT trong DOM (vị trí nổi bật nhất).
   *   2. Ô predict VẪN BẤM ĐƯỢC — admin còn set kèo, người có lịch sử còn vào.
   */
  it('hub (D86): ĐẤU TRƯỜNG đứng TRÊN chợ dự báo — thứ tự là quyết định, không phải ngẫu nhiên', async () => {
    coPhien();
    renderAt('/');
    const arena = await screen.findByText('ALPHA DRAFT');
    const predict = screen.getByText('PREDICT');
    expect(
      // eslint-disable-next-line no-bitwise
      arena.compareDocumentPosition(predict) & Node.DOCUMENT_POSITION_FOLLOWING,
      'ô Đấu trường phải đứng trước ô chợ dự báo',
    ).toBeTruthy();
  });

  // ⚠ Cùng lý do đổi thước như bài ALPHA DRAFT ngay trên. Bất biến D86 cần canh là "ô VẪN BẤM ĐƯỢC": đo bằng việc rời khỏi Hub.
  it('hub (D86): ô PREDICT vẫn bấm được → rời Hub sang bảng giá', async () => {
    coPhien();
    renderAt('/');
    await screen.findByText('ALPHA DRAFT');
    fireEvent.click(oHub('predict'));
    await waitFor(() => expect(screen.queryByText('ALPHA DRAFT')).toBeNull());
  });

  /*
   * §1.2: Đấu trường CẤM chữ "Earn Token" — trận không bao giờ đẻ T/Q, thứ duy nhất rời trận là thứ hạng. Hứa token ở đó là quảng
   * cáo sai VÀ là mầm của đúng đường mà tường lửa A3.5 cấm. Chỉ mặt Dự báo được nói câu đó. 11/10: tagline nay nằm ở ĐẦU LỚP TRƯỢT
   * (giữ ô 0,45 s) — mặt ô không còn chữ nào để canh, nên bài canh LỚP của từng ô.
   */
  it('hub: "Earn Token" CHỈ xuất hiện ở lớp Dự báo, không ở mặt ô nào và không ở lớp Đấu trường', async () => {
    coPhien();
    renderAt('/');
    await screen.findByText('ALPHA DRAFT');
    expect(document.body.textContent).not.toMatch(/earn token/i);
    const giu = async (dau: string) => {
      const e = oHub(dau);
      fireEvent.pointerDown(e, { pointerType: 'touch' });
      await new Promise((r) => { setTimeout(r, 560); });
      fireEvent.pointerUp(e, { pointerType: 'touch' });
      return screen.findByRole('dialog');
    };
    expect((await giu('arena')).textContent).not.toMatch(/earn token/i);
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await giu('predict')).textContent).toMatch(/Earn Token/i);
  });

  it('nav đúng 5 tab: Hub · Token · Mùa · Shop · Hồ sơ', async () => {
    coPhien();
    renderAt('/');
    const nav = await screen.findByLabelText('Menu chính');
    const links = nav.querySelectorAll('a');
    // 01/08 — founder thêm tab MÙA (trang Hành trình riêng kiểu TFT).
    expect(links.length).toBe(5);
    expect([...links].map((a) => a.getAttribute('href')))
      .toEqual(['/', '/vi', '/hanh-trinh', '/shop', '/ho-so']);
  });

  it('nav KHÔNG còn tab Dự báo / Kết quả (xóa tab ≠ xóa tính năng)', async () => {
    coPhien();
    renderAt('/');
    const nav = await screen.findByLabelText('Menu chính');
    const hrefs = [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).not.toContain('/du-bao');
    expect(hrefs).not.toContain('/ket-qua');
  });

  it('/onboard/ho-so khi là khách → chuyển về đăng nhập', async () => {
    renderAt('/onboard/ho-so');
    expect((await screen.findAllByText(CUA_VAO)).length).toBeGreaterThan(0);
  });

  it('chưa đăng nhập → ví hiển thị KHÁCH (401 không phải lỗi)', async () => {
    renderAt('/vi');
    expect(await screen.findByText('KHÁCH')).toBeInTheDocument();
  });

  it('đã onboard → ví header hiển thị bankroll server trả (C4)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/auth/me')) {
          return new Response(
            JSON.stringify({
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
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ error: 'not_found', message: 'x' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    renderAt('/ho-so');
    expect(await screen.findByText('1.000 T')).toBeInTheDocument();
  });
});
