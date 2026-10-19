/**
 * PFM — TẤM HƯỚNG trên màn, MÔ HÌNH DEMO BẢN 6 (founder 11/10, câu B): GƯƠNG vẽ lớp "APP HỌC ĐƯỢC · HƯỚNG TUẦN TỚI — BẠN CHỌN", chạm MỘT
 * trong ba nút (ƯU TIÊN hũ 1 · ƯU TIÊN hũ 2 · GIỮ NHƯ CŨ) ghi đúng hồ sơ qua `suaHoSo`; dải TUẦN TRƯỚC nói thật "làm đúng k/n lần"; SỔ đọc
 * lại hướng đang theo; bàn tiền có nút MẪU một chạm.
 *
 * ⭐⭐⭐ Đọc KHO làm nguồn sự thật (nếp `pfm_man_guong.test.tsx`), không chỉ đọc DOM: một cú chạm "trông như" đã chọn mà hồ sơ không có dòng
 *   nào là lời hứa rỗng — đúng lớp lỗi "LƯU MẪU không ai dùng" mà D453 gỡ.
 * ⚠ Đồng hồ giữ cố định (thứ Tư 30/09/2026 — tuần 28/09 → 04/10) bằng `vi.mock` trên `thoi_gian.ts`.
 *
 * ⚠ 11/10 — bài VIẾT LẠI vì SPEC đổi (A11.30): D453 có hai lá hướng CHỌN · KHÔNG HỢP · THÔI mở màn dựng; nay ba phím một chạm KHÔNG chuyển màn, không
 *   "không hợp"/"thôi". Luật giữ nguyên và còn chặt hơn: chọn = đúng MỘT cú ghi `HoSo.huong` · không `ghiDo` nào (không mã sự kiện mới) ·
 *   bản ghi MÔ HÌNH CŨ trong hồ sơ vẫn đọc được (dải TUẦN TRƯỚC · đếm `huong_giu`) và coi như "chưa chọn" ở tuần này · thiếu mẫu ⇒ "chưa có lần
 *   chia nào", không 0/0.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const NGAY = '2026-09-30';
const THANG = '2026-09';
const TUAN = '2026-09-28';
const TUAN_TRUOC = '2026-09-21';
const LUC = '2026-09-01T03:00:00.000Z';

vi.mock('../src/lib/telemetry.js', () => ({ ghiDo: vi.fn(), baoLoiNen: vi.fn(), manCuaDuong: () => '/tai-chinh/guong' }));
const { ghiDo } = await import('../src/lib/telemetry.js');
vi.mock('../src/pfm/thoi_gian.js', async (goc) => {
  const m = await goc<typeof import('../src/pfm/thoi_gian.js')>();
  return { ...m, homNay: () => NGAY, thangNay: () => THANG };
});

const { RuotGuong } = await import('../src/screens/tai-chinh/Guong');
const { RuotSo } = await import('../src/screens/tai-chinh/So');
const { KhoProvider } = await import('../src/pfm/dung_kho');
const { KhoTrongBoNho } = await import('../src/pfm/kho.js');
const { khoanRaBanGhi, taoKhoan } = await import('../src/pfm/so.js');
const { tuTao } = await import('../src/pfm/hu.js');
const { taoKhoanPhanBo } = await import('../src/pfm/phan_bo.js');
const { banLuat, ghiNhanGiuVo, taoLuatMoi } = await import('../src/pfm/luat.js');
const { docHoSo, suaHoSo } = await import('../src/pfm/ho_so.js');
const { huongMoiTuan } = await import('../src/pfm/huong_hu.js');
const { CHU_BENTO: CB, CHU_HUONG: H, CHU_MAN_SO } = await import('../src/lib/pfm_chu');

type Kho = InstanceType<typeof KhoTrongBoNho>;
type LuaChonHuong = import('../src/pfm/huong.js').LuaChonHuong;

function stubMang(): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const dap = (status: number, body: unknown) => new Response(JSON.stringify(body), {
      status, headers: { 'content-type': 'application/json' },
    });
    if (url.includes('/auth/me')) {
      return dap(200, {
        email: 'a@b.c', email_verified: true, onboarded: true, user: null,
        pfm: { consent: true, tuan: TUAN, tuan_da_niem_phong: false, tuan_token_thuong: 0, tuan_so_ngay_co_mat: 3 },
      });
    }
    return dap(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
  }));
}

/** Nơi đang đứng — để bài đọc được có chuyển màn hay không sau một cú chọn. */
function ViTri(): React.ReactElement {
  const l = useLocation();
  return <p data-testid="vi-tri">{`${l.pathname}${l.search}`}</p>;
}

/** Chạm ô HƯỚNG ở GƯƠNG ⇒ lớp có tấm HƯỚNG. */
async function moHuong(): Promise<void> {
  const o = await waitFor(() => {
    const e = document.querySelector<HTMLElement>('[data-o="guong-huong"]');
    expect(e).not.toBeNull();
    return e!;
  });
  fireEvent.click(o);
  await screen.findByRole('dialog');
}

function ve(kho: Kho, duong = '/tai-chinh/guong') {
  stubMang();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[duong]}>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}>
          <Routes>
            <Route path="/tai-chinh/guong" element={<RuotGuong />} />
            <Route path="/tai-chinh/so" element={<RuotSo />} />
            <Route path="*" element={<ViTri />} />
          </Routes>
        </KhoProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** Sổ tối thiểu: chi đều mỗi ngày của tháng + một đợt tiền về ngày 5. */
async function khoCoSo(): Promise<Kho> {
  const kho = new KhoTrongBoNho();
  let i = 0;
  const ghi = async (ngay: string, soTien: number, chieu: 'chi' | 'thu' = 'chi') => {
    const k = taoKhoan({ ngay, soTien, chieu }, `${ngay}T05:00:00.000Z`, `k${i++}`);
    await kho.ghi('khoan', khoanRaBanGhi(k));
  };
  await ghi('2026-09-05', 3_000_000, 'thu');
  for (let d = 1; d <= 30; d++) await ghi(`${THANG}-${String(d).padStart(2, '0')}`, 60_000);
  return kho;
}

/** Thêm HAI hũ tiết kiệm đang chạy: QUỸ (tạo trước ⇒ đứng đầu theo thứ tự màn HŨ) và LAPTOP. */
async function themHaiHu(kho: Kho): Promise<void> {
  const quy = tuTao({ ten: 'Quỹ', muc: 2_000_000 }, LUC, 'h1');
  const lap = tuTao({ ten: 'Laptop', muc: 5_000_000 }, '2026-09-02T03:00:00.000Z', 'h2');
  await kho.ghi('hu', { id: 'h1', thang: THANG, suaLuc: LUC, d: quy });
  await kho.ghi('hu', { id: 'h2', thang: THANG, suaLuc: LUC, d: lap });
}
/** Một cú CHIA tiền vào hũ `huId` ngày `ngay` (tay). */
async function chiaVao(kho: Kho, id: string, ngay: string, huId: string, soTien = 100_000): Promise<void> {
  const k = taoKhoanPhanBo({ ngay, soTien, huId, phanBo: 'tay' }, `${ngay}T12:00:00.000Z`, id);
  await kho.ghi('khoan', khoanRaBanGhi(k));
}

async function datHuong(kho: Kho, ds: LuaChonHuong[], them: Record<string, unknown> = {}): Promise<void> {
  await suaHoSo(kho, (cu) => ({ ...cu, ...them, huong: ds }), `${NGAY}T01:00:00.000Z`);
}

const lcUuTien = (tuan: string, huId: string, luc: string): LuaChonHuong => (
  { tuan, khoa: `uu_tien_hu:${huId}`, ma: 'uu_tien_hu', kieu: 'theo', luc, huId });

describe('§I — ⭐⭐⭐ tấm HƯỚNG (lớp mở từ ô HƯỚNG ở GƯƠNG) theo demo: APP HỌC ĐƯỢC · HƯỚNG TUẦN TỚI — BẠN CHỌN, ba phím sinh từ HŨ THẬT', () => {
  it('ô HƯỚNG đứng ĐẦU mặt GƯƠNG; tấm có hai nhãn dải của demo, tối đa HAI dòng học, KHÔNG dòng "học từ N quyết định" nữa', async () => {
    const kho = await khoCoSo();
    await themHaiHu(kho);
    await chiaVao(kho, 'p1', '2026-09-05', 'h1', 300_000);
    ve(kho);
    const o = await waitFor(() => {
      const e = document.querySelector<HTMLElement>('[data-o="guong-huong"]');
      expect(e).not.toBeNull();
      return e!;
    });
    // Ô HƯỚNG là ô ĐẦU TIÊN trong thứ tự DOM của mặt (hữu ích nhất ở vị trí dễ thấy nhất — D426).
    expect(document.querySelector<HTMLElement>('[data-testid="guong-bento"] [data-o]')).toBe(o);
    await moHuong();
    const the = await screen.findByTestId('the-huong');
    expect(the.textContent).toContain(H.hoc);
    expect(the.textContent).toContain(H.tagChon);
    expect(within(the).queryByTestId('huong-can-cu')).toBeNull();
    expect(the.querySelectorAll('[data-testid^="hoc-"]:not([data-testid="hoc-rong"])').length).toBeLessThanOrEqual(2);
  });

  it('⭐⭐⭐ BA PHÍM: ƯU TIÊN hũ thứ nhất · ƯU TIÊN hũ thứ hai (theo thứ tự màn HŨ) · GIỮ NHƯ CŨ; chưa phím nào được chọn sẵn', async () => {
    const kho = await khoCoSo();
    await themHaiHu(kho);
    ve(kho);
    await moHuong();
    const nhom = await screen.findByTestId('huong-lua-chon');
    const phim = within(nhom).getAllByRole('button');
    expect(phim.map((p) => p.textContent?.replace('●', '').trim())).toEqual([`${H.uuTienPre}QUỸ`, `${H.uuTienPre}LAPTOP`, H.giuNhuCu]);
    for (const p of phim) expect(p).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('huong-chua-co-hu')).toBeNull();
  });

  it('⭐⭐ KHÔNG có hũ tiết kiệm đang chạy ⇒ chỉ còn GIỮ NHƯ CŨ, kèm câu nói rõ vì sao — không bịa phương án', async () => {
    const kho = await khoCoSo();
    ve(kho);
    await moHuong();
    const nhom = await screen.findByTestId('huong-lua-chon');
    expect(within(nhom).getAllByRole('button')).toHaveLength(1);
    expect(within(nhom).getByTestId('huong-giu_nhu_cu')).toBeInTheDocument();
    expect(screen.getByTestId('huong-chua-co-hu')).toHaveTextContent(H.chuaCoHuTietKiem);
  });
});

describe('§II — ⭐⭐⭐ CHỌN một phím ghi ĐÚNG MỘT bản ghi (qua `suaHoSo`), KHÔNG chuyển màn, KHÔNG sự kiện đo lường nào', () => {
  it('⭐⭐⭐ chạm ƯU TIÊN QUỸ ⇒ hồ sơ có đúng một lựa chọn `theo` của tuần này trỏ hũ h1; phím sáng ●; không đổi route; không `ghiDo` hướng', async () => {
    const kho = await khoCoSo();
    await themHaiHu(kho);
    ve(kho);
    await moHuong();
    const p = await screen.findByTestId('huong-hu-h1');
    vi.mocked(ghiDo).mockClear();
    fireEvent.click(p);
    await waitFor(() => expect(screen.getByTestId('huong-hu-h1')).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByTestId('huong-hu-h1').textContent).toContain('●');
    expect(screen.getByTestId('huong-hu-h2')).toHaveAttribute('aria-pressed', 'false');
    const hs = await docHoSo(kho);
    expect(hs.huong).toHaveLength(1);
    expect(hs.huong![0]).toMatchObject({ tuan: TUAN, ma: 'uu_tien_hu', kieu: 'theo', huId: 'h1', khoa: 'uu_tien_hu:h1' });
    // Ô HƯỚNG ở mặt GƯƠNG (sau lớp) đọc lại ĐÚNG câu của lựa chọn: "Ưu tiên Quỹ — chưa có lần chia nào" (cảnh chưa chia ngày nào).
    await waitFor(() => expect(document.querySelector('[data-o="guong-huong"]')!.textContent).toContain(`${H.soUuTienPre}Quỹ — ${H.chuaCoLanChia}`));
    expect(screen.queryByTestId('vi-tri'), 'chọn không đưa sang màn nào').toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(vi.mocked(ghiDo).mock.calls.filter((c) => String(c[0]).startsWith('dinh_huong')), 'không mã sự kiện / lượt đo nào cho cú chọn').toHaveLength(0);
  });

  it('⭐⭐ đổi sang phím khác = THAY (mỗi tuần một hướng); chạm lại đúng phím đang chọn ⇒ KHÔNG ghi thêm', async () => {
    const kho = await khoCoSo();
    await themHaiHu(kho);
    ve(kho);
    await moHuong();
    fireEvent.click(await screen.findByTestId('huong-hu-h1'));
    await waitFor(() => expect(screen.getByTestId('huong-hu-h1')).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(screen.getByTestId('huong-hu-h1'));          // chạm lại đúng phím — không ghi
    fireEvent.click(screen.getByTestId('huong-hu-h2'));
    await waitFor(() => expect(screen.getByTestId('huong-hu-h2')).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByTestId('huong-hu-h1')).toHaveAttribute('aria-pressed', 'false');
    const hs = await docHoSo(kho);
    expect(hs.huong!.map((x) => x.khoa), 'hai lần ghi, không ba').toEqual(['uu_tien_hu:h1', 'uu_tien_hu:h2']);
    expect(huongMoiTuan(hs.huong!, TUAN)?.huId).toBe('h2');
  });

  it('⭐⭐ GIỮ NHƯ CŨ ghi `giu_nhu_cu`; không dòng "làm đúng k/n lần" (không có việc để đếm)', async () => {
    const kho = await khoCoSo();
    await themHaiHu(kho);
    ve(kho);
    await moHuong();
    fireEvent.click(await screen.findByTestId('huong-giu_nhu_cu'));
    await waitFor(() => expect(screen.getByTestId('huong-giu_nhu_cu')).toHaveAttribute('aria-pressed', 'true'));
    const hs = await docHoSo(kho);
    expect(hs.huong).toHaveLength(1);
    expect(hs.huong![0]).toMatchObject({ tuan: TUAN, ma: 'giu_nhu_cu', kieu: 'theo', khoa: 'giu_nhu_cu' });
    expect(screen.queryByTestId('huong-trang-thai')).toBeNull();
  });

  it('⭐⭐⭐ "làm đúng k/n lần": n = số NGÀY có chia tiền vào hũ nào đó từ lúc chọn; k = số ngày trong đó hũ ĐÃ CHỌN nhận tiền; chưa có ngày chia ⇒ "chưa có lần chia nào" (không 0/0)', async () => {
    const kho = await khoCoSo();
    await themHaiHu(kho);
    await datHuong(kho, [lcUuTien(TUAN, 'h1', `${TUAN}T01:00:00.000Z`)]);
    ve(kho);
    await moHuong();
    expect((await screen.findByTestId('huong-trang-thai')).textContent).toBe(H.chuaCoLanChia);
    expect(screen.getByTestId('huong-trang-thai').textContent).not.toMatch(/0\/0|\b0\b/);
  });

  it('⭐⭐⭐ có ngày chia ⇒ đúng "làm đúng 2/3 lần" trên cảnh có tay: 28/09 vào h1 · 29/09 vào h2 · 30/09 vào h1 (hai lần vào cùng ngày chỉ tính một ngày)', async () => {
    const kho = await khoCoSo();
    await themHaiHu(kho);
    await chiaVao(kho, 'n1', '2026-09-28', 'h1');
    await chiaVao(kho, 'n1b', '2026-09-28', 'h1', 50_000);
    await chiaVao(kho, 'n2', '2026-09-29', 'h2');
    await chiaVao(kho, 'n3', '2026-09-30', 'h1');
    await datHuong(kho, [lcUuTien(TUAN, 'h1', `${TUAN}T01:00:00.000Z`)]);
    ve(kho);
    await moHuong();
    expect((await screen.findByTestId('huong-trang-thai')).textContent).toBe(`${H.lamDungPre}2/3${H.lamDungHau}`);
  });
});

describe('§II-bis — ⭐⭐ luật bớt chữ trên lớp trượt (founder 11/10): KHÔNG đoạn giải thích dưới ba phím; dòng trạng thái là chữ PHỤ, không màu cảnh báo', () => {
  it('dưới ba phím chỉ còn dòng trạng thái ngắn — không đoạn "Ba nút là…/App chỉ ĐẾM…" (demo không có)', async () => {
    const kho = await khoCoSo();
    await themHaiHu(kho);
    await datHuong(kho, [lcUuTien(TUAN, 'h1', `${TUAN}T01:00:00.000Z`)]);
    ve(kho);
    await moHuong();
    const the = await screen.findByTestId('the-huong');
    expect(the.textContent).not.toMatch(/Ba nút là|App chỉ ĐẾM|Không điểm/);
    const nhom = within(the).getByTestId('huong-lua-chon');
    const tt = within(the).getByTestId('huong-trang-thai');
    expect(tt.textContent).toBe(H.chuaCoLanChia);
    // sau ba phím có dòng trạng thái, rồi tới dải TUẦN TRƯỚC — không đoạn văn nào chen giữa
    expect(nhom.nextElementSibling).toBe(tt);
    expect(tt.nextElementSibling).toBe(within(the).getByTestId('huong-cham'));
  });

  it('CSS: `.trangThai` dùng chữ phụ theo token (`--text-muted`), không `--lose`/`--win`/đỏ/vàng-cảnh-báo (đây là MÔ TẢ, không phải lỗi)', () => {
    const css = readFileSync(resolve(__dirname, '../src/screens/tai-chinh/TheHuong.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const luat = css.match(/\.trangThai\s*\{[^}]*\}/)?.[0] ?? '';
    expect(luat, 'thiếu .trangThai').not.toBe('');
    expect(luat).toMatch(/color:\s*var\(--text-muted\)/);
    expect(luat).not.toMatch(/--lose|--win|--h-quyet|#[0-9a-f]{3,8}/i);
  });
});

describe('§III — ⭐⭐⭐ dải TUẦN TRƯỚC nói thật: mô hình MỚI đếm k/n; bản ghi MÔ HÌNH CŨ vẫn ĐỌC được (LÀM TỚI · CHƯA DỰNG)', () => {
  it('⭐⭐⭐ ưu tiên một hũ tuần trước, hũ ấy nhận tiền 2 trong 3 ngày chia ⇒ nói "làm đúng 2/3 lần" + chip LÀM TỚI', async () => {
    const kho = await khoCoSo();
    await themHaiHu(kho);
    await chiaVao(kho, 'a1', '2026-09-22', 'h1');
    await chiaVao(kho, 'a2', '2026-09-23', 'h2');
    await chiaVao(kho, 'a3', '2026-09-24', 'h1');
    await datHuong(kho, [lcUuTien(TUAN_TRUOC, 'h1', `${TUAN_TRUOC}T01:00:00.000Z`)]);
    ve(kho);
    await moHuong();
    const cham = await screen.findByTestId('cham-huong');
    expect(cham.textContent).toContain(`${H.lamDungPre}2/3${H.lamDungHau}`);
    expect(cham.textContent).toContain(`${H.uuTienPre}QUỸ`);
    expect(cham.textContent).toContain(H.lamToi);
  });

  it('⭐⭐ ưu tiên một hũ mà không ngày nào hũ ấy nhận tiền ⇒ chip CHƯA TỚI (đếm, không phán); không ngày chia nào ⇒ "chưa có lần chia nào"', async () => {
    const kho = await khoCoSo();
    await themHaiHu(kho);
    await chiaVao(kho, 'a1', '2026-09-22', 'h2');
    await datHuong(kho, [lcUuTien(TUAN_TRUOC, 'h1', `${TUAN_TRUOC}T01:00:00.000Z`)]);
    ve(kho);
    await moHuong();
    const cham = await screen.findByTestId('cham-huong');
    expect(cham.textContent).toContain(`${H.lamDungPre}0/1${H.lamDungHau}`);
    expect(cham.textContent).toContain(H.chuaToi);
    expect(cham.textContent).not.toContain(H.lamToi);
  });

  it('⭐⭐ GIỮ NHƯ CŨ tuần trước ⇒ chỉ nêu tên, KHÔNG chip LÀM TỚI / CHƯA TỚI (không có việc để chấm)', async () => {
    const kho = await khoCoSo();
    await datHuong(kho, [{
      tuan: TUAN_TRUOC, khoa: 'giu_nhu_cu', ma: 'giu_nhu_cu', kieu: 'theo', luc: `${TUAN_TRUOC}T01:00:00.000Z`,
    }]);
    ve(kho);
    await moHuong();
    const cham = await screen.findByTestId('cham-huong');
    expect(cham.textContent).toContain(H.giuNhuCu);
    expect(cham.textContent).not.toContain(H.lamToi);
    expect(cham.textContent).not.toContain(H.chuaToi);
  });

  const lcLuat: LuaChonHuong = {
    tuan: TUAN_TRUOC, khoa: 'luat_ngay_dam:ngay_chi_lon', ma: 'luat_ngay_dam', kieu: 'theo',
    luc: `${TUAN_TRUOC}T02:00:00.000Z`, dk: 'ngay_chi_lon',
  };

  it('⭐⭐⭐ BẢN GHI CŨ (D453): luật viết SAU lúc chọn, giữ hai lần trong tuần ⇒ vẫn ĐỌC được, chip LÀM TỚI', async () => {
    const kho = await khoCoSo();
    let l = taoLuatMoi({ loiNhac: 'nấu ở nhà', dieuKien: 'ngay_chi_lon', mauId: null }, `${TUAN_TRUOC}T03:00:00.000Z`, 'l1');
    for (const d of ['2026-09-26', '2026-09-27']) {
      l = banLuat(l, `${d}T09:00:00.000Z`);
      l = ghiNhanGiuVo(l, 'giu', `${d}T12:00:00.000Z`);
    }
    await kho.ghi('luat', { id: 'l1', thang: THANG, suaLuc: `${NGAY}T00:00:00.000Z`, d: l });
    await datHuong(kho, [lcLuat]);
    ve(kho);
    await moHuong();
    const cham = await screen.findByTestId('cham-huong');
    expect(cham.textContent).toContain(H.lamToi);
  });

  it('⭐⭐ BẢN GHI CŨ không viết luật nào ⇒ chip CHƯA DỰNG (không bịa một kết quả); hồ sơ cũ KHÔNG bị xoá hay ghi đè khi mở tấm', async () => {
    const kho = await khoCoSo();
    await datHuong(kho, [lcLuat]);
    ve(kho);
    await moHuong();
    const cham = await screen.findByTestId('cham-huong');
    expect(cham.textContent).toContain(H.chuaDungChip);
    expect(cham.textContent).not.toContain(H.lamToi);
    expect((await docHoSo(kho)).huong).toEqual([lcLuat]);
  });
});

describe('§III-bis — ⭐⭐ lối vào từ nơi khác: khung kakeibo (lớp CÀI ĐẶT) mở lớp CHỐT SỔ TUẦN qua `?mo=chot`', () => {
  it('mở GƯƠNG với `?mo=chot` ⇒ lớp CHỐT SỔ TUẦN tự mở (nút CHỐT TUẦN); không `?mo` ⇒ không lớp nào', async () => {
    const kho = await khoCoSo();
    const v = ve(kho, '/tai-chinh/guong?mo=chot');
    const hop = await screen.findByRole('dialog');
    expect(await within(hop).findByRole('button', { name: CB.guChotNut })).toBeInTheDocument();
    v.unmount();
    ve(kho, '/tai-chinh/guong');
    await waitFor(() => expect(document.querySelector('[data-o="guong-huong"]')).not.toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('§IV — ⭐⭐ lời kể đi kèm dòng sổ (không nhãn nguồn): lời kể về đúng việc con số đếm nằm trong dòng ấy', () => {
  it('"tiền vừa về thì cất một phần đi" nằm dưới dòng "k/n lần tiền về, bạn chia vào hũ"', async () => {
    const kho = await khoCoSo();
    const h = tuTao({ ten: 'Quỹ', muc: 2_000_000 }, LUC, 'h1');
    await kho.ghi('hu', { id: 'h1', thang: THANG, suaLuc: LUC, d: h });
    for (const [i, [ngay, co]] of ([['2026-08-05', true], ['2026-09-05', false], ['2026-09-20', true]] as const).entries()) {
      const t = taoKhoan({ ngay, soTien: 1_000_000, chieu: 'thu' }, `${ngay}T02:00:00.000Z`, `t${i}`);
      await kho.ghi('khoan', khoanRaBanGhi(t));
      if (co) await chiaVao(kho, `n${i}`, ngay, 'h1');
    }
    await datHuong(kho, [], { lucTienVe: 'cất một phần đi' });
    ve(kho);
    await moHuong();
    const the = await screen.findByTestId('the-huong');
    await waitFor(() => expect(within(the).queryAllByTestId('hoc-noi-kem').length).toBeGreaterThan(0));
    const kem = within(the).getAllByTestId('hoc-noi-kem')[0]!;
    expect(kem.textContent).toBe(`${H.noiKemPre}"cất một phần đi"`);
    expect(kem.closest('[data-testid="hoc-tien_ve_cat"]'), 'lời kể phải nằm TRONG dòng sổ nó nói về').not.toBeNull();
    expect(within(the).queryByTestId('hoc-noi_tien_ve'), 'lời kể đã đi kèm thì không đứng riêng').toBeNull();
    // dòng học là MỘT CÂU: con số nằm trong câu, in đậm
    const dong = within(the).getByTestId('hoc-tien_ve_cat');
    expect(dong.textContent).toContain(H.tienVeCatPre);
    expect(dong.querySelector('b')?.textContent).toMatch(/^\d+\/\d+$/);
  });
});

/** Số TO của ô CHI HÔM NAY ở SỔ — dạng đầy đủ có dấu phân nghìn (`data-day-du`; mặt ô hiện bản gọn 60k). */
const soHomNay = (): string | null => screen.getByTestId('so-hom-nay').getAttribute('data-day-du');
const oSoHuong = (): Promise<HTMLElement> => waitFor(() => {
  const e = document.querySelector<HTMLElement>('[data-o="so-huong"]');
  expect(e).not.toBeNull();
  return e!;
});

describe('§V — SỔ đọc lại hướng đang theo bằng ĐÚNG câu của tấm; bàn tiền có nút MẪU một chạm', () => {
  it('⭐⭐⭐ khe HƯỚNG TUẦN NÀY: chưa chọn ⇒ "chọn hướng cho tuần này"; chọn ƯU TIÊN QUỸ ⇒ "Ưu tiên Quỹ — làm đúng k/n lần"; GIỮ NHƯ CŨ ⇒ "Giữ như cũ"; chạm ⇒ sang GƯƠNG', async () => {
    const kho = await khoCoSo();
    await themHaiHu(kho);
    await chiaVao(kho, 'n1', '2026-09-29', 'h1');
    await chiaVao(kho, 'n2', '2026-09-30', 'h2');
    const v1 = ve(kho, '/tai-chinh/so');
    await waitFor(() => expect(soHomNay()).not.toBeNull());
    await oSoHuong();
    expect(screen.getByTestId('so-huong-cau').textContent).toBe(CB.soHuongChua);
    v1.unmount();

    await datHuong(kho, [lcUuTien(TUAN, 'h1', `${TUAN}T01:00:00.000Z`)]);
    const v2 = ve(kho, '/tai-chinh/so');
    await waitFor(() => expect(screen.getByTestId('so-huong-cau').textContent).toBe(`${H.soUuTienPre}Quỹ — ${H.lamDungPre}1/2${H.lamDungHau}`));
    v2.unmount();

    await datHuong(kho, [lcUuTien(TUAN, 'h1', `${TUAN}T01:00:00.000Z`), {
      tuan: TUAN, khoa: 'giu_nhu_cu', ma: 'giu_nhu_cu', kieu: 'theo', luc: `${NGAY}T02:00:00.000Z`,
    }]);
    ve(kho, '/tai-chinh/so');
    await waitFor(() => expect(screen.getByTestId('so-huong-cau').textContent).toBe(H.soGiuNhuCu));
    // Chạm ô ⇒ sang GƯƠNG (route `/tai-chinh/guong` của bài vẽ RuotGuong).
    fireEvent.click(await oSoHuong());
    expect(await screen.findByTestId('guong-bento')).toBeInTheDocument();
  });

  it('⭐⭐ bản ghi MÔ HÌNH CŨ trong tuần này KHÔNG bịa một dòng "đang theo": khe vẫn nói "chưa chọn"; ô HƯỚNG ở GƯƠNG nói số quyết định để học', async () => {
    const kho = await khoCoSo();
    await datHuong(kho, [{
      tuan: TUAN, khoa: 'hu_tich_dau:tich_luy', ma: 'hu_tich_dau', kieu: 'theo', luc: `${NGAY}T01:00:00.000Z`, nhom: 'tich_luy',
    }]);
    ve(kho, '/tai-chinh/so');
    await waitFor(() => expect(soHomNay()).not.toBeNull());
    await oSoHuong();
    expect(screen.getByTestId('so-huong-cau').textContent).toBe(CB.soHuongChua);
  });

  it('⭐⭐⭐ số TO là HÔM NAY (không phải tổng tháng); mốc HÔM NAY không in lại con số ấy', async () => {
    const kho = await khoCoSo();
    ve(kho, '/tai-chinh/so');
    await waitFor(() => expect(soHomNay()).toBe('60.000'));
    // Danh sách khoản là lớp mở từ chính ô ấy.
    fireEvent.click(document.querySelector<HTMLElement>('[data-o="so-hom-nay"]')!);
    await screen.findByRole('dialog');
    const moc = (await screen.findAllByTestId('moc-ngay'))[0]!;
    expect(moc.textContent).toContain(CHU_MAN_SO.homNayNhan);
    expect(moc.textContent).not.toContain('60.000');
  });

  it('⭐⭐⭐ CHIP MẪU bấm đúp (hai cú chạm liền, trước khi ghi xong) ⇒ đúng MỘT khoản — cùng khoá đồng bộ với CHI/THU (RÀ 12/10)', async () => {
    const kho = await khoCoSo();
    await kho.ghi('mau_lap', {
      id: 'ml1', thang: THANG, suaLuc: LUC,
      d: { id: 'ml1', ten: 'xem phim', soTien: 110_000, chieu: 'chi', nhan: null, huId: null, taoLuc: LUC },
    });
    ve(kho, '/tai-chinh/so');
    const chip = await screen.findByTestId('chip-mau');
    fireEvent.click(chip);
    fireEvent.click(chip);
    await waitFor(() => expect(soHomNay()).toBe('170.000'));
    await new Promise((r) => setTimeout(r, 400));
    const ds = (await kho.liet<import('../src/pfm/so.js').Khoan>('khoan')).map((b) => b.d).filter((k) => k.ghiChu === 'xem phim');
    expect(ds, 'hai cú chạm liền = MỘT khoản').toHaveLength(1);
    expect(soHomNay()).toBe('170.000');
  });

  it('⭐⭐⭐ mẫu đã lưu nằm trong khay rỗng; một chạm GHI đúng số + tên mẫu vào ghi chú (cách ghi `mau_lap`)', async () => {
    const kho = await khoCoSo();
    await kho.ghi('mau_lap', {
      id: 'ml1', thang: THANG, suaLuc: LUC,
      d: { id: 'ml1', ten: 'xem phim', soTien: 110_000, chieu: 'chi', nhan: null, huId: null, taoLuc: LUC },
    });
    ve(kho, '/tai-chinh/so');
    const chip = await screen.findByTestId('chip-mau');
    expect(chip.textContent).toContain('xem phim');
    fireEvent.click(chip);
    await waitFor(async () => {
      const ds = (await kho.liet<import('../src/pfm/so.js').Khoan>('khoan')).map((b) => b.d);
      const moi = ds.find((k) => k.ghiChu === 'xem phim');
      expect(moi).toMatchObject({ soTien: 110_000, chieu: 'chi', cachGhi: 'mau_lap', ngay: NGAY });
    });
    await waitFor(() => expect(soHomNay()).toBe('170.000'));
  });
});
