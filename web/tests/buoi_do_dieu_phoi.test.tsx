/**
 * MÀN ĐIỀU PHỐI BUỔI ĐO — `/buoi-do` (D333). Stub fetch theo đúng hợp đồng server (`tests/ban_buoi_do_ds`,
 * `tests/ban_buoi_do`). Màn CHỈ HIỆN (C4); các bài dưới canh thứ màn hứa với người điều phối và với tổ chức:
 *  §I   không có quyền ⇒ nói thẳng, không có biểu mẫu nào;
 *  §II  ⭐ tạo bàn gửi đúng hợp đồng · lỗi server hiện nguyên văn · đóng phải bấm HAI lần;
 *  §III ⭐ bức tranh nhóm: dưới sàn không số · đủ sàn in đúng số server trả · không một dòng theo người;
 *  §IV  chữ: không kê đơn (A10) · mọi đề có tên · seed không lọt vào gói web.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, type RouteObject } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { routes } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import { BuoiDo } from '@/screens/holdem/BuoiDo';
import { ROUTE_BUOI_DO } from '@/lib/vocab';
import { CHU_DIEU_PHOI as C } from '@/lib/buoi_do_chu';
import { TEN_NANG_LUC } from '@/lib/nang_luc';
import { tuKeDonTrong } from '@/lib/khoanh_khac';
import { NGAN_HANG_DE } from '@config/holdem_de';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const ME = {
  email: 'dp@b.vn', email_verified: true, onboarded: true,
  user: {
    user_id: 'u-dp', handle: 'dieu_phoi', age_band: '18-22', region: 'nam', occupation_band: 'hs_sv',
    bankroll: 1000, role: 'user', research_consent: true, created_at: '2026-07-18T00:00:00Z', season_id: '2026Q3',
  },
};

const DS = {
  de: [{ id: 'de-a', so_o: 12 }, { id: 'de-b', so_o: 12 }],
  san: 12,
  ban: [
    { ma: 'k7q2m', nhan: 'lop-10a-buoi-1', de_id: 'de-a', het_han: '2026-09-21T00:00:00Z',
      created_at: '2026-09-14T00:00:00Z', da_dong: false, so_nguoi: 17, so_xong: 9 },
    { ma: 'z9x8w', nhan: 'clb-thu', de_id: 'de-a', het_han: '2026-09-13T00:00:00Z',
      created_at: '2026-09-12T00:00:00Z', da_dong: true, so_nguoi: 14, so_xong: 14 },
  ],
};

const NHOM_DU = {
  ma: 'z9x8w', nhan: 'clb-thu', de_id: 'de-a', da_dong: true, san: 12, n: 14, du_mau: true,
  nang_luc: [
    { id: 'cam_ket_tiet_kiem', pct: { chua_gap: 35, gap_chua_vung: 25, lam_duoc: 40 } },
    { id: 'doc_tin', pct: { chua_gap: 10, gap_chua_vung: 55, lam_duoc: 35 } },
    { id: 'phan_tan', pct: { chua_gap: 20, gap_chua_vung: 45, lam_duoc: 35 } },
  ],
};

type Goi = { url: string; init?: RequestInit };

function stub(bang: (url: string, init?: RequestInit) => Response | undefined): Goi[] {
  const calls: Goi[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, ...(init !== undefined ? { init } : {}) });
    if (url.includes('/auth/me')) return json(200, ME);
    return bang(url, init) ?? json(404, { error: 'not_found', message: 'Không có.' });
  }));
  return calls;
}

/*
 * ⚠ BA LẦN ĐỎ TRONG BỘ WEB ĐẦY ĐỦ, XANH KHI CHẠY RIÊNG (đo 14/09). Bản đầu dựng CẢ app qua `routes` — vỏ app với
 * linh vật và thanh dưới là hàng trăm `<rect>` pixel, rất đắt trong jsdom — và dưới tải của 140 tệp khác chuỗi ấy
 * vượt 1 giây (lần 2: 1.614 ms), rồi vượt cả 8 giây (lần 3). Nạp trước mô-đun, rồi nới mức đợi, đều KHÔNG đủ.
 * Nên màn được dựng THẲNG trong một router nhỏ (cổng đăng nhập vẫn chạy thật), còn việc route có đăng ký hay không
 * tách thành một bài tĩnh ở §0. Bài canh HỢP ĐỒNG của màn, không canh tốc độ vẽ vỏ app.
 */
function dung() {
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <MemoryRouter initialEntries={[ROUTE_BUOI_DO]}>
        <BuoiDo />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const CHO = { timeout: 5000 } as const;
vi.setConfig({ testTimeout: 20_000 });
afterEach(() => { vi.unstubAllGlobals(); });

describe('§0 — màn có đường vào', () => {
  it('route `/buoi-do` được đăng ký ở bản đồ route thật (và nạp trễ, không vào gói người chơi)', () => {
    const phang = (ds: RouteObject[]): RouteObject[] => ds.flatMap((r) => [r, ...phang(r.children ?? [])]);
    const r = phang(routes).find((x) => x.path === ROUTE_BUOI_DO);
    expect(r, 'thiếu route /buoi-do').toBeDefined();
    const nguon = readFileSync(join(__dirname, '..', 'src', 'app', 'routes.tsx'), 'utf8');
    expect(nguon).toMatch(/lazy\(\(\) => import\('@\/screens\/holdem\/BuoiDo'\)/);
    expect(nguon).not.toMatch(/^import .*screens\/holdem\/BuoiDo/m);
  });
});

describe('§I — không có quyền', () => {
  it('⭐ 403 khong_phai_dieu_phoi ⇒ một câu nói thẳng, không biểu mẫu, không danh sách', async () => {
    stub((url) => (url.includes('/holdem/ban-buoi-do')
      ? json(403, { error: 'khong_phai_dieu_phoi', message: 'Chỉ người điều phối xem được các buổi đo.' }) : undefined));
    dung();
    expect(await screen.findByTestId('khong-quyen-dieu-phoi', {}, CHO)).toHaveTextContent(C.khongQuyen);
    expect(screen.queryByText(C.nutTao)).toBeNull();
    expect(screen.queryByText(C.dsTieuDe)).toBeNull();
  });
});

describe('§II — tạo · chia sẻ · đóng', () => {
  it('⭐ danh sách in mã TO, hai số đếm; tạo bàn gửi đúng hợp đồng (nhãn đã chuẩn hoá, đề đã chọn)', async () => {
    const calls = stub((url, init) => {
      if (url.includes('/holdem/ban-buoi-do')) return json(200, DS);
      if (url.endsWith('/holdem/ban') && init?.method === 'POST') {
        return json(201, { ma: 'n3w4b', loai: 'buoi_do', so_o: 12, het_han: '2026-09-21T00:00:00Z', de_id: 'de-b', nhan: 'lop-10a' });
      }
      return undefined;
    });
    dung();
    const hang = await screen.findByText('K7Q2M', {}, CHO);
    const the = hang.closest('article')!;
    const dem = within(the as HTMLElement).getByTestId('dem-buoi-do');
    expect(dem).toHaveTextContent(`17${C.daVaoHau}`);
    expect(dem).toHaveTextContent(`9${C.daXongHau}`);

    fireEvent.click(screen.getByRole('radio', { name: /ĐỀ B/ }));
    fireEvent.change(screen.getByLabelText(C.nhanNhom), { target: { value: '  LOP-10A ' } });
    fireEvent.click(screen.getByText(C.nutTao));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/holdem/ban') && c.init?.method === 'POST')).toBe(true), CHO);
    const tao = calls.find((c) => c.url.endsWith('/holdem/ban') && c.init?.method === 'POST')!;
    expect(JSON.parse(String(tao.init?.body))).toEqual({ loai: 'buoi_do', de_id: 'de-b', nhan: 'lop-10a' });
  });

  it('nhãn trống ⇒ nút tạo khoá; server từ chối nhãn ⇒ hiện nguyên văn câu server', async () => {
    stub((url, init) => {
      if (url.includes('/holdem/ban-buoi-do')) return json(200, DS);
      if (url.endsWith('/holdem/ban') && init?.method === 'POST') {
        return json(400, { error: 'nhan_khong_hop_le', message: 'Nhãn chỉ gồm a-z, 0-9 và dấu gạch, tối đa 32 ký tự — không ghi tên người hay tên trường.' });
      }
      return undefined;
    });
    dung();
    expect(await screen.findByText(C.nutTao, {}, CHO)).toBeDisabled();
    fireEvent.change(screen.getByLabelText(C.nhanNhom), { target: { value: 'Lớp 10A' } });
    fireEvent.click(screen.getByText(C.nutTao));
    expect(await screen.findByText(/Nhãn chỉ gồm a-z/, {}, CHO)).toBeInTheDocument();
  });

  it('⭐ ĐÓNG phải bấm hai lần — lần đầu không gọi server', async () => {
    const calls = stub((url, init) => {
      if (url.includes('/holdem/ban-buoi-do')) return json(200, DS);
      if (url.includes('/holdem/ban/k7q2m/dong') && init?.method === 'POST') return json(200, { ok: true });
      return undefined;
    });
    dung();
    const the = (await screen.findByText('K7Q2M', {}, CHO)).closest('article') as HTMLElement;
    fireEvent.click(within(the).getByText(C.nutDong));
    expect(within(the).getByText(C.nutDongChac)).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('/dong'))).toBe(false);
    fireEvent.click(within(the).getByText(C.nutDongChac));
    await waitFor(() => expect(calls.some((c) => c.url.includes('/holdem/ban/k7q2m/dong'))).toBe(true), CHO);
  });

  it('bàn đã đóng không còn nút chia sẻ/đóng; bàn đang mở không có nút bức tranh', async () => {
    stub((url) => (url.includes('/holdem/ban-buoi-do') ? json(200, DS) : undefined));
    dung();
    const mo = (await screen.findByText('K7Q2M', {}, CHO)).closest('article') as HTMLElement;
    const dong = screen.getByText('Z9X8W').closest('article') as HTMLElement;
    expect(within(mo).queryByText(new RegExp(C.nutNhom))).toBeNull();
    expect(within(dong).queryByText(C.nutChiaSe)).toBeNull();
    expect(within(dong).queryByText(C.nutDong)).toBeNull();
  });
});

describe('§III — bức tranh nhóm', () => {
  async function moNhom(nhom: unknown) {
    const calls = stub((url) => {
      if (url.includes('/holdem/ban-buoi-do')) return json(200, DS);
      if (url.includes('/holdem/ban/z9x8w/nhom')) return json(200, nhom);
      return undefined;
    });
    dung();
    const the = (await screen.findByText('Z9X8W', {}, CHO)).closest('article') as HTMLElement;
    fireEvent.click(within(the).getByText(new RegExp(C.nutNhom)));
    return { calls, khoi: await screen.findByTestId('buc-tranh-nhom', {}, CHO) };
  }

  it('⭐ dưới sàn ⇒ chỉ số trận đếm được, KHÔNG một tỷ lệ nào — kể cả khi payload lỡ chở tỷ lệ', async () => {
    /*
     * Tiêm lỗi 14/09 bắt được bản đầu của bài này RỖNG: payload dưới sàn không có `nang_luc`, nên bỏ cổng
     * `du_mau` ở màn vẫn xanh. Màn là rào thứ hai của sàn mẫu — nó phải tự đọc `du_mau`, không trông vào việc
     * server nhớ bỏ trường. Nên payload ở đây CỐ Ý chở tỷ lệ.
     */
    const { khoi } = await moNhom({ ...NHOM_DU, n: 7, du_mau: false });
    expect(within(khoi).getByTestId('nhom-chua-du')).toBeInTheDocument();
    // Tờ phương pháp có "5%" (bước làm tròn) — nên canh bằng CẤU TRÚC: không một dòng năng lực, không vạch.
    expect(khoi.querySelectorAll('[data-nang-luc]')).toHaveLength(0);
    expect(within(khoi).queryAllByRole('img')).toHaveLength(0);
    expect(khoi.textContent).toContain(`${C.nhomNPre}7${C.nhomSanPre}12`);
  });

  it('⭐ đủ sàn ⇒ ba năng lực mang tên khung, in ĐÚNG số server trả (không tự làm tròn cho đủ 100)', async () => {
    const { khoi } = await moNhom(NHOM_DU);
    for (const nl of NHOM_DU.nang_luc) {
      const dong = khoi.querySelector(`[data-nang-luc="${nl.id}"]`) as HTMLElement;
      expect(dong).not.toBeNull();
      expect(dong).toHaveTextContent(TEN_NANG_LUC[nl.id as keyof typeof TEN_NANG_LUC].ten);
      expect(dong).toHaveTextContent(`${nl.pct.lam_duoc}% ${C.bacLamDuoc}`);
      expect(dong).toHaveTextContent(`${nl.pct.gap_chua_vung}% ${C.bacChuaVung}`);
      expect(dong).toHaveTextContent(`${nl.pct.chua_gap}% ${C.bacChuaGap}`);
    }
    // doc_tin cộng ra 100, cam_ket 100, phan_tan 100 — nhưng bài vẫn canh vạch dùng flex-grow, không width.
    const vach = khoi.querySelector('[data-nang-luc="cam_ket_tiet_kiem"] [role="img"] i') as HTMLElement;
    expect(vach.style.flexGrow).toBe('40');
    expect(vach.style.width).toBe('');
  });

  it('không một handle hay số tiền nào trên khối nhóm; có tờ phương pháp', async () => {
    const { khoi } = await moNhom(NHOM_DU);
    expect(khoi.textContent).not.toContain('dieu_phoi');
    // Số tiền dạng "1.000 T", "₫", "VNĐ", NAV — không cái nào thuộc bức tranh năng lực.
    expect(khoi.textContent).not.toMatch(/\d\s*T\b|₫|VNĐ|\bNAV\b/);
    for (const cau of C.phuongPhap) expect(khoi).toHaveTextContent(cau);
  });
});

describe('§IV — chữ và gói', () => {
  function moiChuoi(x: unknown): string[] {
    if (typeof x === 'string') return [x];
    if (Array.isArray(x)) return x.flatMap(moiChuoi);
    if (x && typeof x === 'object') return Object.values(x).flatMap(moiChuoi);
    return [];
  }

  it('⭐ không chữ kê đơn (A10) trong mọi chuỗi của màn', () => {
    const ds = moiChuoi(C);
    expect(ds.length).toBeGreaterThan(20);
    for (const c of ds) expect(tuKeDonTrong(c), `"${c}"`).toEqual([]);
  });

  it('mọi đề trong ngân hàng đề có tên hiển thị (thêm đề mà quên chữ ⇒ đỏ)', () => {
    for (const d of NGAN_HANG_DE) expect(C.tenDe[d.id], d.id).toBeTruthy();
  });

  it('⭐ không tệp nào trong web/src import ngân hàng đề — seed không được vào gói người chơi', () => {
    const goc = join(__dirname, '..', 'src');
    const tep: string[] = [];
    const di = (thuMuc: string): void => {
      for (const ten of readdirSync(thuMuc)) {
        const p = join(thuMuc, ten);
        if (statSync(p).isDirectory()) di(p);
        else if (/\.(ts|tsx)$/.test(ten)) tep.push(p);
      }
    };
    di(goc);
    const vi_pham = tep.filter((p) => /holdem_de/.test(readFileSync(p, 'utf8')));
    expect(vi_pham).toEqual([]);
  });
});
