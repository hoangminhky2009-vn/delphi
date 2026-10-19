/**
 * DẢI CHẾ ĐỘ TESTER (D370) — thứ THAY NGƯỜI ĐIỀU PHỐI, nên bài canh phải ghim đúng hai chuyện:
 *
 * §I   Dải chỉ hiện cho người TRONG đợt đo, và mỗi bước nói ĐÚNG MỘT việc kế tiếp. Một dải nói
 *      "bước 3/5" mà không nói làm gì là vô dụng — không còn ai để hỏi.
 * §II  Link phiếu ĐÃ ĐIỀN SẴN mã + nhãn nhóm. Đây là chỗ D367 từng mất 10 % mẫu vì chép tay.
 * §III Quay về từ trang xác nhận của Form (`?buoi_do_buoc=N`) ⇒ tiến bước ĐÚNG MỘT LẦN, rồi XOÁ
 *      tham số khỏi URL. Không xoá thì nạp lại trang là gửi lần nữa.
 *
 * ⚠ Bước KHÔNG bao giờ do client suy ra — nó đọc từ `/auth/me`. Bài canh vì thế giả lập `/auth/me`
 *   chứ không nhét trạng thái vào component.
 */
import { StrictMode } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CheDoTester } from '../src/components/CheDoTester';
import { PHIEU_BUOI_DO } from '../../config/buoi_do_form';
import { CHU_CHE_DO_TESTER as C } from '../src/lib/buoi_do_chu';

const MA = 'k7m2';
const NHAN = 'lop-10a-buoi-1';

/** Bắt `fetch` — `/auth/me` trả trạng thái muốn thử; POST bước ghi lại để bài kiểm. */
function batMang(buoc: number | null, ban: string | null = 'k7q2m') {
  const daGoi: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/auth/me')) {
      return new Response(JSON.stringify({
        email: 'a@b.c', email_verified: false, onboarded: true,
        user: { user_id: 'u1', handle: 'tester', bankroll: 1000 },
        buoi_do: buoc === null ? null : { ma: MA, nhan: NHAN, buoc, ...(ban === null ? {} : { ban }) },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/buoi-do/buoc')) {
      daGoi.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
      return new Response(JSON.stringify({ ok: true, buoc: 9 }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }));
  return daGoi;
}

/** Hiện URL hiện tại ra DOM — cách duy nhất khẳng định tham số ĐÃ bị xoá khỏi thanh địa chỉ. */
function SoiUrl() {
  const l = useLocation();
  return <span data-testid="url">{l.pathname}{l.search}</span>;
}

function ve(duong = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /*
   * ⚠⚠ BỌC StrictMode — app THẬT chạy trong StrictMode (`web/src/main.tsx:200`), nên ở dev mỗi
   * `useEffect` chạy HAI LẦN lúc mount. Bài canh không bọc thì nó đang thử một app khác với app
   * đang ship, và mọi lớp chống-gửi-hai-lần trở thành không kiểm được.
   * (Đã đo: không có StrictMode thì gỡ `daGui` KHÔNG bài nào đỏ.)
   */
  return render(
    <StrictMode>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[duong]}><CheDoTester /><SoiUrl /></MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('§I · ai thấy dải, và nó nói gì', () => {
  it('người KHÔNG trong đợt đo ⇒ không có dải nào', async () => {
    batMang(null);
    ve();
    // Chờ `/auth/me` về rồi mới khẳng định — khẳng định lúc chưa nạp là khẳng định rỗng.
    await waitFor(() => expect(screen.queryByText(C.nhan)).toBeNull());
    expect(screen.queryByTestId('che-do-tester')).toBeNull();
  });

  it('⭐ MỖI bước nói đúng MỘT việc kế tiếp, không phải "bước n/5"', async () => {
    for (let b = 0; b <= 4; b += 1) {
      batMang(b);
      const r = ve();
      await screen.findByTestId('che-do-tester');
      expect(screen.getByTestId('che-do-tester').dataset.buoc).toBe(String(b));
      expect(screen.getByText(C.viec[b]!), `bước ${b} không nói việc kế`).toBeTruthy();
      r.unmount();
    }
  });

  it('xong cả năm bước ⇒ lời cảm ơn, KHÔNG còn nút phiếu nào', async () => {
    batMang(5);
    ve();
    await screen.findByText(C.xong);
    expect(screen.queryByTestId('nut-mo-phieu')).toBeNull();
    expect(screen.queryByTestId('nut-da-nop')).toBeNull();
  });

  it('bước APP TỰ BIẾT (1 — chơi xong trận) không có nút khai nào — khai gian với chính mình', async () => {
    batMang(1);
    ve();
    await screen.findByTestId('che-do-tester');
    expect(screen.queryByTestId('nut-da-nop'), 'bước 1 không được có nút "đã nộp"').toBeNull();
    expect(screen.queryByTestId('nut-xong-pfm'), 'bước 1 không được có nút "xong PFM"').toBeNull();
    expect(screen.getByText(C.dangChoApp)).toBeTruthy();
  });

  /*
   * ⭐⭐ D392 — BƯỚC PFM (LƯU = 3) LÀ BƯỚC NGƯỜI DÙNG TỰ KHAI. Câu trả lời PFM nằm trên máy người dùng nên
   * server KHÔNG tự biết họ đã xem chân dung; không có nút ở bước này thì dải đứng mãi ở "Bước 4/5" và
   * không ai tới được Phiếu 3. Bản trước đặt nút ở bước LƯU = 4 (lệch một nấc: nhầm số hiển thị "Bước
   * 4/5" với số lưu) — bài cũ còn khẳng định bước 3 là "app tự biết", tức canh ngược đúng chỗ hỏng.
   */
  it('⭐⭐ bước 3 (PFM) có nút "Tôi đã xem xong chân dung", bấm ⇒ tiến lên ĐÚNG bước 4', async () => {
    const daGoi = batMang(3);
    ve();
    const nut = await screen.findByTestId('nut-xong-pfm');
    expect(nut.textContent).toBe(C.xongPfm);
    expect(screen.queryByTestId('nut-da-nop'), 'bước PFM không có phiếu nên không có nút "đã nộp"').toBeNull();
    fireEvent.click(nut);
    await waitFor(() => expect(daGoi).toHaveLength(1));
    expect(daGoi[0]!.body).toEqual({ buoc: 4 });
  });

  /*
   * ⭐⭐ D392 — ĐƯỜNG VỀ BÀN BUỔI ĐO. Link bàn chỉ nằm trong tin nhắn mời; điểm quay về đã xoá lúc vào bàn lần
   * đầu; sảnh không có thẻ nào dẫn về bàn (thẻ nổi nhất là THỬ THÁCH HÔM NAY — đề khác, bước không tiến). Đi
   * thử 23/09: chơi xong bàn tập là lạc. Nay dải bước 1 có nút về đúng bàn server báo.
   */
  it('⭐⭐ bước 1 (chơi trận) có nút VÀO BÀN BUỔI ĐO trỏ đúng bàn đã đồng ý', async () => {
    batMang(1, 'k7q2m');
    ve();
    const nut = await screen.findByTestId('nut-vao-ban');
    expect(nut.textContent).toBe(C.vaoBan);
    expect(nut.getAttribute('href')).toBe('/arena/ban/k7q2m');
  });

  it('nút về bàn CHỈ ở bước 1, và im khi API cũ chưa trả mã bàn', async () => {
    for (const b of [0, 2, 3, 4, 5]) {
      batMang(b);
      const r = ve();
      await screen.findByTestId('che-do-tester');
      expect(screen.queryByTestId('nut-vao-ban'), `bước ${b}`).toBeNull();
      r.unmount();
    }
    batMang(1, null);
    ve();
    await screen.findByTestId('che-do-tester');
    expect(screen.queryByTestId('nut-vao-ban')).toBeNull();
  });

  it('⭐ bước 4 (Phiếu 3) KHÔNG có nút "xong PFM" — bấm nó từng ghi luôn "đã nộp Phiếu 3"', async () => {
    batMang(4);
    ve();
    await screen.findByTestId('nut-mo-phieu');
    expect(screen.queryByTestId('nut-xong-pfm')).toBeNull();
    expect(screen.getByTestId('nut-da-nop')).toBeTruthy();
  });

  /*
   * D396 — hai việc nằm ở MÀN KHÁC thì dải đưa luôn cửa vào: bước PFM có nút mở PERSONAL FINANCE (cùng đích
   * thẻ ở Hub); bước Phiếu 3 có link tới THẺ NĂNG LỰC ở Hồ sơ — Phiếu 3 hỏi về thẻ ấy, và đường "PERSONAL
   * FINANCE → THẺ" mà phiếu từng chỉ nay dẫn tới chân dung PFM (D372 dời thẻ năng lực sang Hồ sơ).
   */
  it('⭐ D396 — bước PFM có nút MỞ PERSONAL FINANCE; bước Phiếu 3 có link THẺ NĂNG LỰC ở Hồ sơ', async () => {
    batMang(3);
    const r = ve();
    const pfm = await screen.findByTestId('nut-mo-pfm');
    expect(pfm.textContent).toBe(C.moPfm);
    expect(pfm.getAttribute('href')).toBe('/tai-chinh');
    expect(screen.queryByTestId('nut-xem-the')).toBeNull();
    r.unmount();

    batMang(4);
    ve();
    const the = await screen.findByTestId('nut-xem-the');
    expect(the.textContent).toBe(C.xemThe);
    expect(the.getAttribute('href')).toBe('/ho-so/the');
    expect(screen.queryByTestId('nut-mo-pfm')).toBeNull();
  });

  it('hai link D396 CHỈ ở đúng bước của nó', async () => {
    for (const b of [0, 1, 2, 5]) {
      batMang(b);
      const r = ve();
      await screen.findByTestId('che-do-tester');
      expect(screen.queryByTestId('nut-mo-pfm'), `bước ${b}`).toBeNull();
      expect(screen.queryByTestId('nut-xem-the'), `bước ${b}`).toBeNull();
      r.unmount();
    }
  });

  it('mã hiện IN HOA để dễ đối chiếu với bảng tính Form', async () => {
    batMang(0);
    ve();
    await screen.findByText(MA.toUpperCase());
  });
});

describe('§II · link phiếu đã điền sẵn', () => {
  it('⭐ ba bước có phiếu ⇒ link chở ĐÚNG mã và nhãn nhóm', async () => {
    for (const [buoc, iPhieu] of [[0, 0], [2, 1], [4, 2]] as const) {
      batMang(buoc);
      const r = ve();
      const a = await screen.findByTestId('nut-mo-phieu');
      const u = new URL(a.getAttribute('href')!);
      const p = PHIEU_BUOI_DO[iPhieu]!;
      expect(u.searchParams.get(`entry.${p.entryMa}`), `bước ${buoc}: mã không vào link`).toBe(MA);
      expect(u.searchParams.get(`entry.${p.entryNhan}`), `bước ${buoc}: nhãn không vào link`).toBe(NHAN);
      expect(u.origin + u.pathname, `bước ${buoc}: mở nhầm phiếu`).toBe(p.dien);
      // Form mở tab mới: mất tab app giữa chừng là mất luôn lộ trình.
      expect(a.getAttribute('target')).toBe('_blank');
      r.unmount();
    }
  });
});

describe('§III · quay về từ trang xác nhận của Form', () => {
  it('⭐ `?buoi_do_buoc=3` ⇒ gửi tiến bước 3 ĐÚNG MỘT LẦN', async () => {
    const daGoi = batMang(2);
    ve('/?buoi_do_buoc=3');
    await waitFor(() => expect(daGoi.length).toBe(1));
    expect(daGoi[0]!.body).toEqual({ buoc: 3 });
    // Chờ thêm một nhịp: `useEffect` chạy lại khi `/auth/me` về, và lúc ấy tham số vẫn còn một nhịp.
    await new Promise((r) => setTimeout(r, 50));
    expect(daGoi.length, 'gửi hai lần — nạp lại trang sẽ tiến bước lần nữa').toBe(1);
  });

  it('⭐ XOÁ tham số khỏi URL sau khi nhận — để lại thì nạp lại trang là tiến bước lần nữa', async () => {
    batMang(2);
    ve('/?buoi_do_buoc=3');
    /*
     * Đây mới là tính chất THẬT của lớp `datTham`. Đếm số lần gửi KHÔNG canh được nó: lớp `daGui`
     * đỡ hộ trong cùng một lần mở, nên gỡ riêng `datTham` vẫn xanh (đã tiêm thử: 0 đỏ). Thứ chỉ
     * mình `datTham` làm được là để lại một URL SẠCH cho lần nạp sau.
     */
    await waitFor(() => expect(screen.getByTestId('url').textContent).not.toContain('buoi_do_buoc'));
  });

  it('không có tham số ⇒ KHÔNG gửi gì (dải chỉ hiện, không tự tiến)', async () => {
    const daGoi = batMang(2);
    ve('/');
    await screen.findByTestId('che-do-tester');
    await new Promise((r) => setTimeout(r, 50));
    expect(daGoi.length).toBe(0);
  });

  it('tham số bậy (0 · 9 · chữ) ⇒ không gửi gì', async () => {
    for (const x of ['0', '9', 'abc']) {
      const daGoi = batMang(2);
      const r = ve(`/?buoi_do_buoc=${x}`);
      await screen.findByTestId('che-do-tester');
      await new Promise((rs) => setTimeout(rs, 30));
      expect(daGoi.length, `"${x}" lọt qua`).toBe(0);
      r.unmount();
    }
  });

  it('nút dự phòng "tôi đã nộp" gửi ĐÚNG bước của phiếu đang mở', async () => {
    const daGoi = batMang(2);          // vừa chơi xong ⇒ phiếu 2 ⇒ bước 3
    ve();
    fireEvent.click(await screen.findByTestId('nut-da-nop'));
    await waitFor(() => expect(daGoi.length).toBe(1));
    expect(daGoi[0]!.body).toEqual({ buoc: PHIEU_BUOI_DO[1]!.buoc });
  });
});
