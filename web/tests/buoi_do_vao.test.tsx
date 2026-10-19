/**
 * VÀO BUỔI ĐO (D329) — hai chỗ của demo `docs/ui-ux/demo/buoi-do-vao.html`:
 *  §I  PHÒNG CHỜ: 403 `chua_dong_y_buoi_do` ⇒ thẻ đồng ý thay lưới ghế; ĐỒNG Ý ⇒ vết gửi ĐÚNG phiên bản
 *      đang hiệu lực rồi dựng bàn lần hai; KHÔNG ⇒ về sảnh, không vết, không dựng lần hai.
 *  §II MÀN KẾT: KHÔNG còn dòng MÃ THAM GIA (D392 — giấy đã thay bằng Google Form tự điền mã buổi đo).
 *  §III PHÒNG CHỜ (D392): lỗi `chua_nop_phieu_1` / `chua_xong_ban_tap` có nút làm luôn việc được bảo;
 *      đồng ý xong hỏi lại `/auth/me`.
 * ⚠ Bài đọc CUỘC GỌI MẠNG thật của component (fetch giả theo thứ tự), không mock hook: mock `useTaoTran`
 *   rồi khẳng định "đã gọi" là kiểm chính bản mock.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/api/queries';
import { CONSENT_PHIEN_BAN } from '@config/pfm_consent';
import { PHIEU_BUOI_DO } from '@config/buoi_do_form';
import { docDiemQuayVe } from '@/lib/diem_quay_ve';
import type { TheNangLucTranDTO } from '@server/holdem/nang_luc_ids';
import { NHIP_PHONG_CHO, PhongCho } from '../src/components/holdem/PhongCho';
import { GhiVaoThe } from '../src/components/holdem/GhiVaoThe';
import { CHU_BUOI_DO, VAN_BAN_BUOI_DO } from '../src/lib/buoi_do_chu';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const TRAN = {
  match_id: 'm-bd', vong: 1, tong_vong: 12, status: 'dang_choi', ban_ma: 'k7q2m',
  doi_thu: [{ ghe_id: 'b1', loai: 'bot', ten: 'Máy · Tất tay', bac_rank: '—' }],
};
const BAN = {
  ma: 'k7q2m', so_o: 12, het_han: '2026-09-20T00:00:00Z', created_at: '2026-09-13T00:00:00Z',
  chu: 'dieuphoi', la_chu: false, so_nguoi: 3, toi: null, toi_da_xong: false, doi: [], loai: 'buoi_do',
  buoi_do: { nhan: 'lop-thu-1', de_id: 'de-a', ma_tham_gia: null, da_dong_y: false, phien_ban_hien_hanh: 'v1' },
};

/** fetch giả có THỨ TỰ: lần tạo đầu 403 (chưa đồng ý), lần sau 201. */
function mangGia(): { goi: { url: string; method: string; body: unknown }[]; soLanTao: () => number } {
  const goi: { url: string; method: string; body: unknown }[] = [];
  let tao = 0;
  const tl = (status: number, b: unknown) => new Response(JSON.stringify(b), {
    status, headers: { 'content-type': 'application/json' },
  });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/telemetry')) return tl(202, { ok: true });
    goi.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes('/dong-y')) return tl(200, { ok: true, phien_ban: CONSENT_PHIEN_BAN.buoi_do });
    if (url.includes('/holdem/matches') && method === 'POST') {
      tao += 1;
      return tao === 1
        ? tl(403, { error: 'chua_dong_y_buoi_do', message: 'Bàn buổi đo cần bạn đọc và đồng ý trước khi vào.' })
        : tl(201, TRAN);
    }
    if (url.includes('/holdem/ban/k7q2m')) return tl(200, BAN);
    return tl(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
  }));
  return { goi, soLanTao: () => tao };
}

const nha = async (n = 10) => {
  for (let i = 0; i < n; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  }
};

function dung() {
  const onHuy = vi.fn();
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter>
        <PhongCho cheDo="tu_do" soO={8} khauVi="can_bang" banMa="k7q2m" onHuy={onHuy} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { onHuy };
}

describe('§I — thẻ đồng ý trong phòng chờ', () => {
  it('⭐ 403 ⇒ thẻ thay lưới ghế; ĐỒNG Ý ⇒ vết đúng phiên bản, rồi dựng bàn lần hai', async () => {
    vi.useFakeTimers();
    const m = mangGia();
    const { onHuy } = dung();
    await act(async () => { await vi.advanceTimersByTimeAsync(NHIP_PHONG_CHO.TIM + 10); });
    await nha();
    expect(screen.getByTestId('the-dong-y-buoi-do')).toBeInTheDocument();
    expect(screen.getByText(VAN_BAN_BUOI_DO.tieuDe)).toBeInTheDocument();
    expect(screen.getByText(VAN_BAN_BUOI_DO.chot)).toBeInTheDocument();
    expect(screen.getByText('ĐỌC TRƯỚC KHI VÀO')).toBeInTheDocument();
    expect(screen.queryByText('BẠN')).toBeNull();   // lưới ghế đã nhường chỗ

    fireEvent.click(screen.getByRole('button', { name: CHU_BUOI_DO.nutDongY }));
    await nha(16);
    const vet = m.goi.filter((g) => g.url.includes('/dong-y'));
    expect(vet).toHaveLength(1);
    expect(vet[0]!.body).toEqual({ phien_ban: CONSENT_PHIEN_BAN.buoi_do });
    expect(m.soLanTao()).toBe(2);
    expect(screen.queryByTestId('the-dong-y-buoi-do')).toBeNull();
    expect(onHuy).not.toHaveBeenCalled();
  });

  it('KHÔNG ⇒ về sảnh: không vết đồng ý, không dựng lần hai', async () => {
    vi.useFakeTimers();
    const m = mangGia();
    const { onHuy } = dung();
    await act(async () => { await vi.advanceTimersByTimeAsync(NHIP_PHONG_CHO.TIM + 10); });
    await nha();
    fireEvent.click(screen.getByRole('button', { name: CHU_BUOI_DO.nutKhong }));
    await nha();
    expect(onHuy).toHaveBeenCalledTimes(1);
    expect(m.goi.some((g) => g.url.includes('/dong-y'))).toBe(false);
    expect(m.soLanTao()).toBe(1);
  });
});

describe('§II — màn kết KHÔNG còn in mã tham gia (D392)', () => {
  const THE: TheNangLucTranDTO = {
    formula_version: 1, tinh_vao_the: true, ly_do_khong_tinh: null,
    nang_luc: [{ id: 'doc_tin', bac: 'gap_chua_vung', bang_chung: { brier_tb: 0.9, n: 6, so_su_kien: 4, so_tin_gia: 1 } }],
  };

  /*
   * D329 cũ in "MÃ THAM GIA · ghi mã này lên bài giấy" ở màn kết. D370 thay giấy bằng ba Google Form mà app TỰ
   * ĐIỀN mã buổi đo — dòng kia thành mã thứ HAI cùng dạng 4 ký tự: chép nhầm nó vào ô MÃ BUỔI ĐO thì phiếu vẫn
   * nhận và số của người ấy ghép sai im lặng. Mã duy nhất tester thấy nay là "MÃ CỦA BẠN" trên dải tester.
   */
  it('⭐ không dòng MÃ THAM GIA, không chữ "bài giấy"', () => {
    render(<MemoryRouter><GhiVaoThe the={THE} khoanhKhac={[]} /></MemoryRouter>);
    expect(screen.getByTestId('ghi-vao-the')).toBeInTheDocument();
    expect(screen.queryByTestId('ma-tham-gia')).toBeNull();
    expect(screen.queryByText(/MÃ THAM GIA/)).toBeNull();
    expect(screen.queryByText(/bài giấy/)).toBeNull();
  });

  it('không nang_luc, không khoảnh khắc ⇒ khối im hẳn', () => {
    const { container } = render(<MemoryRouter><GhiVaoThe the={undefined} khoanhKhac={[]} /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });
});

/*
 * §III — D392: HAI LỖI CỦA BÀN BUỔI ĐO LÀ LỜI BẢO LÀM MỘT VIỆC, nên phòng chờ có nút làm luôn việc ấy.
 * Trước bản này: "Làm PHIẾU 1 trước đã" mà không link nào (nút của dải nằm DƯỚI lớp phủ, và dải còn chưa
 * hiện vì `/auth/me` chưa được hỏi lại); "Chơi BÀN TẬP trước đã" mà chỉ có nút VỀ SẢNH.
 */
function mangLoi(ma: 'chua_nop_phieu_1' | 'chua_xong_ban_tap' | 'khach_khong_vao_buoi_do') {
  const goi: { url: string; method: string; body: unknown }[] = [];
  const tl = (status: number, b: unknown) => new Response(JSON.stringify(b), {
    status, headers: { 'content-type': 'application/json' },
  });
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url.includes('/telemetry')) return tl(202, { ok: true });
    goi.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.includes('/auth/me')) {
      return tl(200, {
        email: 'a@b.c', email_verified: true, onboarded: true,
        user: { user_id: 'u1', handle: 'tester', bankroll: 1000 },
        buoi_do: { ma: 'k7m2', nhan: 'lop-thu-1', buoc: ma === 'chua_nop_phieu_1' ? 0 : 1, ban: 'k7q2m' },
      });
    }
    if (url.includes('/holdem/matches') && method === 'POST') {
      const body = init?.body ? JSON.parse(String(init.body)) as { tap?: boolean } : {};
      if (body.tap) return tl(201, { ...TRAN, match_id: 'm-tap', ban_ma: null });
      if (ma === 'khach_khong_vao_buoi_do') {
        return tl(403, { error: ma, message: 'Buổi đo cần một tài khoản — tạo tài khoản rồi mở lại link này nhé.' });
      }
      return tl(409, { error: ma, message: ma === 'chua_nop_phieu_1' ? 'Làm PHIẾU 1 trước đã.' : 'Chơi BÀN TẬP trước đã.' });
    }
    if (url.includes('/holdem/ban/k7q2m')) return tl(200, BAN);
    return tl(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
  }));
  return goi;
}

function SoiDuong() {
  const l = useLocation();
  return <span data-testid="duong">{l.pathname}{l.search}</span>;
}

function dungCoDuong() {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={['/arena/ban/k7q2m']}>
        <PhongCho cheDo="tu_do" soO={12} khauVi="can_bang" banMa="k7q2m" onHuy={() => {}} />
        <SoiDuong />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('§III — lỗi của bàn buổi đo có nút làm luôn việc được bảo (D392)', () => {
  it('⭐⭐ chưa nộp Phiếu 1 ⇒ nút MỞ PHIẾU 1 ngay trong phòng chờ, link ĐÃ ĐIỀN mã buổi đo + nhãn nhóm', async () => {
    vi.useFakeTimers();
    mangLoi('chua_nop_phieu_1');
    dungCoDuong();
    await act(async () => { await vi.advanceTimersByTimeAsync(NHIP_PHONG_CHO.TIM + 10); });
    await nha(16);
    const nut = screen.getByTestId('phong-cho-mo-phieu-1') as HTMLAnchorElement;
    const u = new URL(nut.href);
    expect(u.origin + u.pathname).toBe(PHIEU_BUOI_DO[0]!.dien);
    expect(u.searchParams.get(`entry.${PHIEU_BUOI_DO[0]!.entryMa}`)).toBe('k7m2');
    expect(u.searchParams.get(`entry.${PHIEU_BUOI_DO[0]!.entryNhan}`)).toBe('lop-thu-1');
    expect(nut.target).toBe('_blank');
    expect(screen.queryByTestId('phong-cho-vao-ban-tap')).toBeNull();
  });

  it('⭐⭐ chưa chơi bàn tập ⇒ nút VÀO BÀN TẬP dựng bàn tập và dắt vào kèm trợ lý (`?tap=1`)', async () => {
    vi.useFakeTimers();
    const goi = mangLoi('chua_xong_ban_tap');
    dungCoDuong();
    await act(async () => { await vi.advanceTimersByTimeAsync(NHIP_PHONG_CHO.TIM + 10); });
    await nha(16);
    expect(screen.queryByTestId('phong-cho-mo-phieu-1')).toBeNull();
    fireEvent.click(screen.getByTestId('phong-cho-vao-ban-tap'));
    await nha(16);
    const tap = goi.filter((g) => g.url.includes('/holdem/matches') && g.method === 'POST'
      && (g.body as { tap?: boolean } | undefined)?.tap === true);
    expect(tap).toHaveLength(1);
    expect(screen.getByTestId('duong').textContent).toBe('/arena/tran/m-tap?tap=1');
  });

  it('⭐ D396 — KHÁCH mở link buổi đo ⇒ nút TẠO TÀI KHOẢN: nhớ bàn rồi sang /onboard (cửa thoát chế độ khách)', async () => {
    vi.useFakeTimers();
    window.localStorage.clear();
    mangLoi('khach_khong_vao_buoi_do');
    dungCoDuong();
    await act(async () => { await vi.advanceTimersByTimeAsync(NHIP_PHONG_CHO.TIM + 10); });
    await nha(16);
    expect(screen.queryByTestId('phong-cho-mo-phieu-1')).toBeNull();
    fireEvent.click(screen.getByTestId('phong-cho-tao-tai-khoan'));
    await nha(8);
    expect(screen.getByTestId('duong').textContent).toBe('/onboard');
    expect(docDiemQuayVe(), 'bàn phải được nhớ để đăng ký xong quay lại đúng bàn').toBe('/arena/ban/k7q2m');
  });

  it('⭐ ĐỒNG Ý xong ⇒ hỏi lại /auth/me (mã buổi đo vừa được cấp — dải tester đọc từ đó)', async () => {
    vi.useFakeTimers();
    const goi: string[] = [];
    let tao = 0;
    const tl = (status: number, b: unknown) => new Response(JSON.stringify(b), {
      status, headers: { 'content-type': 'application/json' },
    });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/telemetry')) return tl(202, { ok: true });
      goi.push(`${method} ${url}`);
      if (url.includes('/auth/me')) {
        return tl(200, { email: 'a@b.c', email_verified: true, onboarded: true,
          user: { user_id: 'u1', handle: 'tester', bankroll: 1000 }, buoi_do: null });
      }
      if (url.includes('/dong-y')) return tl(200, { ok: true, phien_ban: CONSENT_PHIEN_BAN.buoi_do });
      if (url.includes('/holdem/matches') && method === 'POST') {
        tao += 1;
        return tao === 1
          ? tl(403, { error: 'chua_dong_y_buoi_do', message: 'Bàn buổi đo cần bạn đọc và đồng ý trước khi vào.' })
          : tl(409, { error: 'chua_nop_phieu_1', message: 'Làm PHIẾU 1 trước đã.' });
      }
      if (url.includes('/holdem/ban/k7q2m')) return tl(200, BAN);
      return tl(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
    }));
    dungCoDuong();
    await act(async () => { await vi.advanceTimersByTimeAsync(NHIP_PHONG_CHO.TIM + 10); });
    await nha(16);
    const meTruoc = goi.filter((g) => g.includes('/auth/me')).length;
    fireEvent.click(screen.getByRole('button', { name: CHU_BUOI_DO.nutDongY }));
    await nha(24);
    expect(goi.filter((g) => g.includes('/dong-y'))).toHaveLength(1);
    expect(goi.filter((g) => g.includes('/auth/me')).length, 'đồng ý xong phải hỏi lại /auth/me')
      .toBeGreaterThan(meTruoc);
  });
});
