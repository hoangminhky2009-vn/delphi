/**
 * SẢNH ĐẤU TRƯỜNG BENTO — SPEC `docs/spec/alpha-draft-tang-khong-gian.md` phần A, mục 4.1 + 5 + 5b (THI CÔNG, demo CHỐT 11/10).
 *
 * Qua ROUTE THẬT `/arena` (có AppShell). Bài khoá:
 *   I.   Ô CHÍNH đổi theo tình huống: bàn đang dở > thử thách (chưa vào · đang chơi) · hôm nay xong · đang tải (chỗ giữ sẵn) · lỗi + thử lại.
 *   II.  Bốn ô chế độ → LỚP TRƯỢT: mặt màn KHÔNG chứa mô tả khi lớp đóng, CÓ khi mở; xếp hạng ghi "cần ≥ 4 người thật"; KHÔNG khẩu vị.
 *   III. VÀO BÀN / TÌM TRẬN → phòng chờ (lớp đè), một lần dù bấm đúp; link mời `/arena/ban/<mã>`; cần đồng ý điều khoản trả về lớp XẾP HẠNG.
 *   IV.  Chuyển tiếp: MÀN TẬP đi thẳng · Back/Forward · lớp trượt không sống sót qua đổi route · focus trả về đúng ô.
 *   V.   Không cuộn: cấu trúc (route `dauSanh`, phép trừ chiều cao KHỚP Hub + vỏ, ô giữ sẵn Oracle). Số đo thật ở `tests/luong/trinh-duyet/alpha_draft_bento.mjs`.
 *   VI.  Ngân sách request: sảnh không hỏi thêm endpoint nào ngoài bộ cũ.
 * Tiêm ngược: xem cuối tệp (các dòng "TIÊM").
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routes } from '@/app/routes';
import { makeQueryClient } from '@/api/queries';
import { CHU_SANH } from '@/lib/sanh_chu';
import { ROUTE_ARENA, ROUTE_ARENA_GUIDE } from '@/lib/vocab';
import { ME_ONBOARDED, stubFetch, type RecordedCall, type StubRoute } from './helpers';

vi.setConfig({ testTimeout: 30_000 });
const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const cho = (ms: number) => new Promise((r) => { setTimeout(r, ms); });

const CATALOG = {
  engine_version: 'holdem-test-sb', balance_version: 'balance-v66-test',
  luat: { SEATS: 6, START_VON: 10000, MAX_TAI_SAN: 4, MAX_CHIEN_THUAT: 2 },
  nhip_chon_bai: [], cap_stack_bp: [10000],
  quyet_dinh: { MAP_SIZE: 14, CO_MAP_CHON: [14], MAP_MAC_DINH_SANH: 14 },
  vai: { ca_map: { id: 'ca_map' } },
  tai_san: [], chien_thuat: [], giai_doan: [], su_kien: [], tu_dien: { tai_san: {}, chien_thuat: {} },
  khau_vi: [{ id: 'can_bang', label: 'Cân bằng', he_so_bp: 10000, mo_ta: 'mô tả cân bằng' }, { id: 'quyet_liet', label: 'Quyết liệt', he_so_bp: 13000, mo_ta: 'mô tả quyết liệt' }],
  khau_vi_tat: true,
};
const BAN_NGAY = (them: Record<string, unknown> = {}) => ({
  ma: 'q7p2z', so_o: 14, het_han: new Date(Date.now() + 5 * 3_600_000).toISOString(), created_at: 'x', loai: 'ngay',
  chu: 'DELPHI', la_chu: false, so_nguoi: 228, toi: null, toi_da_xong: false, doi: [],
  thu_thach: { ngay: '2026-10-11', so_nguoi_vao: 230, so_nguoi_xong: 228 }, ...them,
});
const XONG = BAN_NGAY({
  toi: { match_id: 'm-x', status: 'xong' }, toi_da_xong: true,
  thu_thach: { ngay: '2026-10-11', so_nguoi_vao: 230, so_nguoi_xong: 228, nav: 12340, hang: 41, tong: 228, top_pct: 18 },
});
const TRAN_DO = [{ match_id: 'm-dang', status: 'dang_choi', vong_hien_tai: 5, started_at: '', ended_at: null, tiep_duoc: true }];

interface Nen { ngay?: StubRoute; tran?: unknown[]; catalog?: unknown; them?: [string, StubRoute][] }
const nen = ({ ngay = { status: 200, body: BAN_NGAY() }, tran = [], catalog = CATALOG, them = [] }: Nen = {}): [string, StubRoute][] => [
  ...them,
  ['/auth/me', { status: 200, body: ME_ONBOARDED }],
  ['/holdem/catalog', { status: 200, body: catalog }],
  ['/holdem/me/matches', { status: 200, body: { tran } }],
  ['/holdem/me/tien-do', { status: 200, body: { so_tran_xong: 7, co_map: [14], khau_vi: false, con_thieu: {} } }],
  ['/holdem/ngay', ngay],
];

function dung(path = ROUTE_ARENA) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<QueryClientProvider client={makeQueryClient()}><RouterProvider router={router} /></QueryClientProvider>);
  return router;
}
const o = (dau: string) => document.querySelector(`[data-o="${dau}"]`) as HTMLElement;
const chinh = () => document.querySelector('[data-chinh]') as HTMLElement | null;
const lop = () => document.querySelector('[role="dialog"][data-tam]') as HTMLElement | null;
const chuTrang = () => document.body.textContent ?? '';
async function choSanh() { await waitFor(() => expect(o('may')).toBeTruthy()); }
async function choChinh(loai: string) { await waitFor(() => expect(chinh()?.getAttribute('data-chinh')).toBe(loai)); }

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.localStorage.clear(); });

describe('I. Ô CHÍNH đổi theo tình huống (SPEC 4.1)', () => {
  it('⭐ chưa vào: THỬ THÁCH HÔM NAY · ngày · "14 ô · cả nước cùng một bàn" · giờ còn lại · nút VÀO BÀN HÔM NAY', async () => {
    stubFetch(nen());
    dung();
    await choChinh('thu_thach');
    const c = chinh()!;
    expect(c.textContent).toContain('THỬ THÁCH HÔM NAY · 11/10');
    await waitFor(() => expect(c.textContent).toContain('14 ô · cả nước cùng một bàn'));
    expect(c.textContent).toMatch(/còn 4h|còn 5h/);
    const nut = within(c).getByRole('button', { name: /VÀO BÀN HÔM NAY/ });
    expect(nut).not.toBeDisabled();
  });

  it('⭐ bàn ĐANG DỞ đứng TRƯỚC thử thách: "BÀN ĐANG DỞ", "VÒNG 5", nút CHƠI TIẾP; không còn mời bàn hôm nay', async () => {
    stubFetch(nen({ tran: TRAN_DO }));
    const router = dung();
    await choChinh('dang_do');
    expect(chinh()!.textContent).toContain('BÀN ĐANG DỞ');
    expect(chinh()!.textContent).toContain('VÒNG 5');
    expect(chinh()!.textContent).not.toContain('VÀO BÀN HÔM NAY');
    fireEvent.click(within(chinh()!).getByRole('button', { name: /CHƠI TIẾP/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/arena/tran/m-dang'));
  });

  it('⭐ hôm nay XONG: số TO phân vị + "hạng 41/228" + "bàn mới mở lúc 00:00"; nút ĐẤU VỚI MÁY mở lớp cài đặt (không mời bàn hôm nay nữa)', async () => {
    stubFetch(nen({ ngay: { status: 200, body: XONG } }));
    dung();
    await choChinh('xong');
    expect(chinh()!.textContent).toContain('TOP 18%');
    expect(chinh()!.textContent).toContain('hạng 41/228');
    expect(chinh()!.textContent).toContain('bàn mới mở lúc 00:00');
    expect(chinh()!.textContent).not.toContain('VÀO BÀN HÔM NAY');
    fireEvent.click(within(chinh()!).getByRole('button', { name: /ĐẤU VỚI MÁY/ }));
    await waitFor(() => expect(lop()).toBeTruthy());
    expect(lop()!.getAttribute('aria-label')).toBe(CHU_SANH.may);
  });

  it('⭐ ít người (< 3 xong): không nói "TOP 100%" — "#h" + "người thứ h trong N"', async () => {
    const it2 = BAN_NGAY({
      toi: { match_id: 'm-x', status: 'xong' }, toi_da_xong: true,
      thu_thach: { ngay: '2026-10-11', so_nguoi_vao: 2, so_nguoi_xong: 2, nav: 9900, hang: 2, tong: 2, top_pct: 100 },
    });
    stubFetch(nen({ ngay: { status: 200, body: it2 } }));
    dung();
    await choChinh('xong');
    expect(chinh()!.textContent).toContain('#2');
    expect(chinh()!.textContent).toContain('người thứ 2 trong 2 người đã xong');
    expect(chinh()!.textContent).not.toContain('TOP 100%');
  });

  it('⭐ ĐANG TẢI = chỗ giữ sẵn: nút khoá, chữ "đang hỏi…", KHÔNG số 0 / % giả (D62)', async () => {
    const goc = stubFetch(nen());
    void goc;
    const base = globalThis.fetch;
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => (String(input).includes('/holdem/ngay') ? new Promise(() => {}) : base(input, init)));
    dung();
    await choSanh();
    await choChinh('thu_thach');
    const c = chinh()!;
    expect(c.getAttribute('data-trang-thai')).toBe('doc');
    expect(c.textContent).toContain(CHU_SANH.dangHoi);
    expect(within(c).getByRole('button', { name: /VÀO BÀN HÔM NAY/ })).toBeDisabled();
    expect(c.textContent).not.toMatch(/\d+%|\b0\b/);
  });

  it('⭐ LỖI /holdem/ngay: chữ nói rõ + THỬ LẠI; bấm đúp THỬ LẠI không gửi trùng (đúng MỘT request thêm)', async () => {
    const calls = stubFetch(nen({ ngay: { status: 500, body: { error: 'x', message: 'x' } } }));
    dung();
    await waitFor(() => expect(chinh()?.getAttribute('data-trang-thai')).toBe('loi'), { timeout: 8000 });
    const c = chinh()!;
    expect(within(c).getByRole('alert').textContent).toContain(CHU_SANH.chuaDoc);
    const nut = within(c).getByRole('button', { name: /THỬ LẠI/ });
    const dem = () => calls.filter((x: RecordedCall) => x.url.includes('/holdem/ngay')).length;
    await cho(300);
    const truoc = dem();
    fireEvent.click(nut); fireEvent.click(nut);
    await cho(600);
    expect(dem() - truoc, 'bấm đúp THỬ LẠI gửi trùng').toBe(1);
  });
});

describe('II. Bốn ô chế độ → lớp trượt', () => {
  const MO_TA = [CHU_SANH.mayMoTa, CHU_SANH.xepHangMoTa, CHU_SANH.xepHangHienTai, CHU_SANH.ruMoTa];

  it('⭐⭐ lớp ĐÓNG: không một chữ mô tả nào trên MẶT màn (chỉ nhãn · tên · một dòng phụ); lớp trượt không có trong DOM', async () => {
    stubFetch(nen());
    dung();
    await choSanh();
    for (const m of MO_TA) expect(chuTrang(), `mô tả "${m.slice(0, 30)}…" nằm trên mặt màn`).not.toContain(m);
    expect(lop(), 'lớp trượt phải KHÔNG có trong DOM khi đóng').toBeNull();
  });

  it('⭐ chạm từng ô ⇒ lớp mở có ĐÚNG mô tả của nó; đóng (ĐÓNG) thì biến khỏi DOM', async () => {
    stubFetch(nen());
    dung();
    await choSanh();
    for (const [dau, mota] of [['may', CHU_SANH.mayMoTa], ['xep', CHU_SANH.xepHangMoTa], ['ru', CHU_SANH.ruMoTa]] as const) {
      fireEvent.click(o(dau));
      await waitFor(() => expect(lop()).toBeTruthy());
      expect(lop()!.textContent).toContain(mota);
      fireEvent.click(within(lop()!).getByText('ĐÓNG'));
      await waitFor(() => expect(lop()).toBeNull());
    }
  });

  it('⭐ XẾP HẠNG: mặt ô ghi "cần ≥ 4 người thật"; lớp nói bàn chỉ mở khi ≥ 4 người thật và số máy < số người', async () => {
    stubFetch(nen());
    dung();
    await choSanh();
    expect(o('xep').textContent).toContain('cần ≥ 4 người thật');
    fireEvent.click(o('xep'));
    await waitFor(() => expect(lop()).toBeTruthy());
    expect(lop()!.textContent).toContain('ít nhất 4 người chơi thật');
    expect(lop()!.textContent).toContain('số máy luôn ít hơn số người');
  });

  it('⭐ KHẨU VỊ đã xoá: dù catalog còn danh sách `khau_vi` (và KHÔNG cờ tắt), không ô nào, không lớp nào nhắc khẩu vị', async () => {
    const { khau_vi_tat: _bo, ...conKhauVi } = CATALOG;
    stubFetch(nen({ catalog: conKhauVi }));
    dung();
    await choSanh();
    for (const dau of ['may', 'xep', 'ru']) {
      fireEvent.click(o(dau));
      await waitFor(() => expect(lop()).toBeTruthy());
      expect(chuTrang()).not.toMatch(/KHẨU VỊ|Quyết liệt|mô tả quyết liệt/i);
      fireEvent.click(within(lop()!).getByText('ĐÓNG'));
      await waitFor(() => expect(lop()).toBeNull());
    }
  });

  it('⭐ nhãn đọc theo CATALOG của luật đang chạy, không chép nhãn demo: tag lớp ĐẤU VỚI MÁY = "<số ô catalog> Ô · CÓ VAI"; đổi catalog ⇒ đổi nhãn', async () => {
    stubFetch(nen({ catalog: { ...CATALOG, quyet_dinh: { ...CATALOG.quyet_dinh, MAP_MAC_DINH_SANH: 12, CO_MAP_CHON: [12] }, vai: undefined } }));
    dung();
    await choSanh();
    fireEvent.click(o('may'));
    await waitFor(() => expect(lop()).toBeTruthy());
    await waitFor(() => expect(lop()!.textContent).toContain('12 Ô'));
    expect(lop()!.textContent).not.toContain('14 Ô');
    expect(lop()!.textContent).not.toContain('CÓ VAI');
  });

  it('RỦ BẠN: ruột mở sẵn (không còn nút xổ "RỦ BẠN CÙNG BÀN ▾"), PHÁT MÃ BÀN gọi đúng MỘT POST /holdem/ban', async () => {
    const calls = stubFetch(nen({ them: [['/holdem/ban', { status: 201, body: { ma: 'k7qx2', so_o: 14, het_han: new Date(Date.now() + 86_400_000).toISOString() } }]] }));
    dung();
    await choSanh();
    fireEvent.click(o('ru'));
    await waitFor(() => expect(lop()).toBeTruthy());
    expect(within(lop()!).queryByText(/RỦ BẠN CÙNG BÀN ▾/)).toBeNull();
    const phat = await within(lop()!).findByRole('button', { name: /PHÁT MÃ BÀN/ });
    fireEvent.click(phat); fireEvent.click(phat);
    expect(await within(lop()!).findByText('K7QX2')).toBeTruthy();
    expect(calls.filter((x) => x.method === 'POST' && x.url.endsWith('/holdem/ban'))).toHaveLength(1);
  });
});

describe('III. Vào bàn / tìm trận → phòng chờ (lớp đè)', () => {
  const phongCho = () => document.querySelectorAll('[data-tap="phong-cho"]');

  it('⭐ ĐẤU VỚI MÁY ▶ VÀO BÀN: lớp trượt đóng, MỘT phòng chờ "ĐẤU VỚI MÁY · 14 ô" — bấm đúp không mở hai', async () => {
    stubFetch(nen());
    dung();
    await choSanh();
    fireEvent.click(o('may'));
    await waitFor(() => expect(lop()).toBeTruthy());
    const vao = within(lop()!).getByRole('button', { name: /^▶ VÀO BÀN$/ });
    fireEvent.click(vao); fireEvent.click(vao);
    await waitFor(() => expect(phongCho()).toHaveLength(1));
    await waitFor(() => expect(lop()).toBeNull());
    expect(phongCho()[0]!.textContent).toContain('ĐẤU VỚI MÁY · 14 ô');
  });

  it('⭐ XẾP HẠNG ▶ TÌM TRẬN: phòng chờ ở chế độ xếp hạng ("XẾP HẠNG · MÙA BETA")', async () => {
    stubFetch(nen());
    dung();
    await choSanh();
    fireEvent.click(o('xep'));
    await waitFor(() => expect(lop()).toBeTruthy());
    fireEvent.click(within(lop()!).getByRole('button', { name: /TÌM TRẬN/ }));
    await waitFor(() => expect(phongCho()).toHaveLength(1));
    expect(phongCho()[0]!.textContent).toContain('XẾP HẠNG · MÙA BETA');
  });

  it('⭐ THỬ THÁCH ▶ VÀO BÀN HÔM NAY: phòng chờ bàn ngày (mã server phát), bấm đúp không mở hai', async () => {
    stubFetch(nen({ them: [['/holdem/ban/q7p2z', { status: 200, body: BAN_NGAY() }]] }));
    dung();
    await choChinh('thu_thach');
    const nut = await waitFor(() => { const n = within(chinh()!).getByRole('button', { name: /VÀO BÀN HÔM NAY/ }); expect(n).not.toBeDisabled(); return n; });
    fireEvent.click(nut); fireEvent.click(nut);
    await waitFor(() => expect(phongCho()).toHaveLength(1));
    await waitFor(() => expect(phongCho()[0]!.textContent).toMatch(/THỬ THÁCH HÔM NAY · 11\/10/));
  });

  it('⭐ LINK MỜI /arena/ban/k7qx2: vào thẳng phòng chờ của bàn đó (không cần mở lớp RỦ BẠN)', async () => {
    stubFetch(nen({ them: [['/holdem/ban/k7qx2', { status: 200, body: { ma: 'k7qx2', so_o: 14, het_han: new Date(Date.now() + 3_600_000).toISOString(), created_at: 'x', chu: 'x', la_chu: false, so_nguoi: 1, toi: null, toi_da_xong: false, doi: [] } }]] }));
    dung('/arena/ban/k7qx2');
    await waitFor(() => expect(phongCho()).toHaveLength(1));
    await waitFor(() => expect(phongCho()[0]!.textContent).toContain('BÀN CHUNG · K7QX2'));
  });

  it('⭐ LINK MỜI SAI hình (/arena/ban/ab): mở lớp RỦ BẠN và NÓI lỗi — không phòng chờ, không im', async () => {
    stubFetch(nen());
    dung('/arena/ban/ab');
    await waitFor(() => expect(lop()).toBeTruthy());
    expect(lop()!.getAttribute('aria-label')).toBe(CHU_SANH.ru);
    expect(await within(lop()!).findByText('Mã bàn là 5 ký tự chữ/số.')).toBeTruthy();
    expect(phongCho()).toHaveLength(0);
  });

  it('⭐ 403 chua_dong_y khi TÌM TRẬN ⇒ về sảnh và mở lớp XẾP HẠNG với màn đồng ý điều khoản', async () => {
    stubFetch(nen({ them: [['/holdem/matches', { status: 403, body: { error: 'chua_dong_y', message: 'Cần đồng ý điều khoản.' } }]] }));
    dung();
    await choSanh();
    fireEvent.click(o('xep'));
    await waitFor(() => expect(lop()).toBeTruthy());
    fireEvent.click(within(lop()!).getByRole('button', { name: /TÌM TRẬN/ }));
    await waitFor(() => expect(phongCho()).toHaveLength(1));
    await waitFor(() => expect(lop()?.textContent).toContain('XẾP HẠNG CẦN ĐỒNG Ý ĐIỀU KHOẢN'), { timeout: 8000 });
    expect(phongCho()).toHaveLength(0);
  });
});

describe('IV. Chuyển tiếp & đường dẫn', () => {
  it('⭐ MÀN TẬP đi THẲNG (không qua lớp trượt) → /arena/huong-dan; Back về sảnh với lớp ĐÓNG; Forward tới màn tập lại', async () => {
    stubFetch(nen());
    const router = dung();
    await choSanh();
    fireEvent.click(o('man-tap'));
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTE_ARENA_GUIDE));
    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTE_ARENA));
    await choSanh();
    expect(lop()).toBeNull();
    await router.navigate(1);
    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTE_ARENA_GUIDE));
  });

  it('⭐ lớp trượt đang mở mà đổi route (Back) ⇒ về sảnh với lớp ĐÓNG — lớp không sống sót qua đổi route', async () => {
    stubFetch(nen());
    const router = dung('/');
    await waitFor(() => expect(document.querySelector('[data-o="arena"]')).toBeTruthy());
    await router.navigate(ROUTE_ARENA);
    await choSanh();
    fireEvent.click(o('may'));
    await waitFor(() => expect(lop()).toBeTruthy());
    await router.navigate(-1);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(lop()).toBeNull();
    await router.navigate(1);
    await choSanh();
    expect(lop(), 'Forward về sảnh mà lớp vẫn mở').toBeNull();
  });

  it('⭐ Esc đóng lớp và TRẢ FOCUS về đúng ô đã mở nó', async () => {
    stubFetch(nen());
    dung();
    await choSanh();
    o('xep').focus();
    fireEvent.click(o('xep'));
    await waitFor(() => expect(lop()).toBeTruthy());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(lop()).toBeNull());
    expect(document.activeElement).toBe(o('xep'));
  });

  it('cuốn sách BÁCH KHOA → /bach-khoa (route còn sống)', async () => {
    stubFetch(nen());
    const router = dung();
    await choSanh();
    fireEvent.click(screen.getByTestId('nut-bach-khoa'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/bach-khoa'));
  });
});

describe('V. KHÔNG CUỘN — cấu trúc (số đo thật: kịch bản trình duyệt)', () => {
  it('⭐ route sảnh (cả link mời) khai `dauSanh` ⇒ AppShell tắt header chung, đáy chừa đúng BottomNav', () => {
    const tat = JSON.stringify(routes, (_k, v) => (typeof v === 'function' ? undefined : v));
    void tat;
    const phang = (rs: typeof routes): typeof routes => rs.flatMap((r) => [r, ...(r.children ? phang(r.children) : [])]);
    for (const p of [ROUTE_ARENA, '/arena/ban/:banMa']) {
      const r = phang(routes).find((x) => x.path === p);
      expect(r, `thiếu route ${p}`).toBeTruthy();
      expect((r!.handle as { dauSanh?: boolean }).dauSanh, `${p} chưa khai dauSanh`).toBe(true);
    }
  });

  it('⭐ phép trừ chiều cao khung sảnh = của Hub = của vỏ (12 px đầu + vùng an toàn TRÊN + 74 px thanh đáy + vùng an toàn DƯỚI) — đổi một nơi là đỏ', () => {
    // 11/10 (chặn trước beta, Hub v2): vỏ đệm thêm `safe-area-inset-top` (tai thỏ khi cài PWA) ⇒ khung trừ đúng phần ấy.
    const CT = 'height: calc(100dvh - 12px - env(safe-area-inset-top, 0px) - 74px - env(safe-area-inset-bottom, 0px));';
    expect(doc('src/screens/Hub.module.css')).toContain(CT);
    expect(doc('src/screens/holdem/AlphaDraftLobby.module.css')).toContain(CT);
    const vo = doc('src/app/AppShell.module.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const kh = /\.shell\[data-dau-sanh\]\s*\{([^}]*)\}/.exec(vo)?.[1] ?? '';
    expect(kh).toContain('min-height: 100dvh');
    expect(kh).toContain('padding-top: calc(12px + env(safe-area-inset-top, 0px))');
    expect(kh).toContain('padding-bottom: calc(74px + env(safe-area-inset-bottom, 0px))');
  });

  it('⭐ đầu sảnh có ô giữ sẵn cho Oracle `[data-oracle-cho]` — không nút/ô bấm nào bên trong', async () => {
    stubFetch(nen());
    dung();
    await choSanh();
    const cho_ = document.querySelector('[data-oracle-cho]')!;
    expect(cho_).toBeTruthy();
    expect(cho_.closest('button, a, [role="button"]')).toBeNull();
    expect(cho_.querySelector('button, a, input')).toBeNull();
  });
});

describe('VI. Ngân sách request — sảnh không hỏi thêm endpoint nào', () => {
  it('⭐ chỉ catalog · tiến độ · bàn dở · thử thách hôm nay (+ vỏ app: /auth/me · nhiệm vụ · tính cách Oracle)', async () => {
    const calls = stubFetch(nen());
    dung();
    await choSanh();
    await choChinh('thu_thach');
    await cho(400);
    const duong = new Set(calls.map((x) => `${x.method} ${new URL(x.url, 'http://x').pathname.replace('/api/v1', '')}`));
    const CHO_PHEP = new Set([
      'GET /auth/me', 'GET /holdem/catalog', 'GET /holdem/me/tien-do', 'GET /holdem/me/matches', 'GET /holdem/ngay',
      'GET /me/nhiem-vu', 'GET /holdem/me/tinh-cach',
    ]);
    const la = [...duong].filter((d) => !CHO_PHEP.has(d));
    expect(la, 'sảnh thêm request mới').toEqual([]);
  });
});

/*
 * ─── TIÊM NGƯỢC (đã chạy; số ở báo cáo/commit) ───────────────────────────────────────────────────────────────────────────────
 *  a. `trangThaiNgay`: đổi nhánh `toi_da_xong` ⇒ I (xong) đỏ.            b. bỏ `dangDo` khỏi thứ tự ô chính ⇒ I (dở) đỏ.
 *  c. thả `xepHangMoTa` lên mặt ô XẾP HẠNG ⇒ II (mặt màn) đỏ.            d. dựng lại khối khẩu vị ⇒ II (KHẨU VỊ) + mo_khoa đỏ.
 *  e. bỏ effect link mời ⇒ III (LINK MỜI) đỏ.                              f. bỏ `dauSanh` khỏi route sảnh ⇒ V đỏ.
 *  g. bỏ `moTam('xep')` ở `onChuaDongY` ⇒ III (403) đỏ.                    h. thêm một `useQuery` vào sảnh ⇒ VI đỏ.
 */
