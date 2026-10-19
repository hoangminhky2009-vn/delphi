/**
 * PFM — APP TỰ CHẤM LỜI ĐOÁN, MẶT NGƯỜI DÙNG (D385).
 *
 * ⚠⚠ TRƯỚC D385 màn chân dung dán nhãn "KIỂM ĐƯỢC" mà KHÔNG màn nào gọi `chamDoan()`. Bài này
 * canh mảnh nối lời hứa ấy với phép chấm, ở đúng hai nơi nó chạm màn hình:
 *   · GƯƠNG (`RuotGuong`) — ô CHỐT SỔ TUẦN tự chấm kỳ vừa niêm phong VÀ GHI vào `hoSo.soDoan`.
 *   · CHÂN DUNG (`RuotChanDung`) — đặt mốc `hoSo.doanTu` lúc lời đoán hiện lần đầu, và hiện
 *     thành tích đã chấm.
 * Nhại `pfm_man_guong.test.tsx`: `KhoTrongBoNho` + `QueryClientProvider` + `KhoProvider`, đọc
 * KHO làm nguồn sự thật (không chỉ đọc DOM).
 *
 * ⚠⚠ ĐỒNG HỒ BỊ GIỮ CỐ ĐỊNH — cùng lý do `pfm_man_guong.test.tsx`: `RuotGuong` đọc
 * `homNay()`/`thangNay()` đúng một lần lúc dựng state, và `RuotChanDung` đặt mốc lời đoán bằng
 * `homNay()`. Không giữ đồng hồ thì bài đỏ vào một ngày nào đó trong năm.
 * ⚠ 2026-09-21 là THỨ HAI (đã kiểm ở đầu `so_doan.test.ts`). NGAY dùng ở đây (2026-09-23) rơi
 *   TRONG tuần ấy (thứ Tư) — khớp `/me` trả `pfm.tuan: '2026-09-21'` (thứ Hai vừa niêm phong).
 *
 * Sáu ngày chi 21–26/09 mỗi ngày 30.000 (đúng sàn `PFM.GUONG_SAN_NGAY_CHI = 6`) là bộ khung của
 * mọi cảnh `ngay_te` dưới đây — TRÚNG/TRẬT chỉ khác nhau ở việc ngày-sau-đỉnh (24/09) có vượt
 * trung vị hay không (cùng vector đã chép tay và kiểm ở `so_doan.test.ts` §III).
 *
 * ⚠ 11/10 (TẦNG KHÔNG GIAN, SPEC `pfm-tang-khong-gian`): kết quả tuần (con dấu · app tự chấm · thành tích) nằm ở dải CHẤM của tấm HƯỚNG — trong LỚP
 *   mở từ ô HƯỚNG ở GƯƠNG; mốc `doanTu` + thành tích ở THẺ nằm trong lớp ĐOÁN ĐÚNG; khối NÓI · LÀM · TRONG TRẬN nằm trong lớp ĐỘ NHẤT QUÁN (không còn
 *   `the-ba-mat`). Phép chấm · ghi `soDoan` đúng một dòng · đặt mốc một lần · "Tắt Gương" vẫn tắt: GIỮ NGUYÊN; chỉ ĐƯỜNG TỚI đổi.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const NGAY = '2026-09-23';
const THANG = '2026-09';
const LUC = '2026-09-23T10:00:00.000Z';

vi.mock('../src/lib/telemetry.js', () => ({
  ghiDo: vi.fn(), baoLoiNen: vi.fn(), manCuaDuong: () => '/tai-chinh/guong',
}));

vi.mock('../src/pfm/thoi_gian.js', async (goc) => {
  const m = await goc<typeof import('../src/pfm/thoi_gian.js')>();
  return { ...m, homNay: () => NGAY, thangNay: () => THANG };
});

const { RuotGuong } = await import('../src/screens/tai-chinh/Guong');
const { RuotChanDung } = await import('../src/screens/tai-chinh/ChanDungPfm');
const { KhoProvider } = await import('../src/pfm/dung_kho');
const { KhoTrongBoNho } = await import('../src/pfm/kho.js');
const { khoanRaBanGhi, taoKhoan } = await import('../src/pfm/so.js');
const { ID_HO_SO } = await import('../src/pfm/ho_so.js');
const { ID_CAI_DAT_MAY } = await import('../src/pfm/cai_dat_may.js');
const { homNay } = await import('../src/pfm/thoi_gian.js');
const { CHU_BENTO: CB, CHU_TU_CHAM, CHU_MAN_GUONG: C, CHU_HUONG } = await import('../src/lib/pfm_chu');

type Kho = InstanceType<typeof KhoTrongBoNho>;
type HoSo = import('../src/pfm/ho_so.js').HoSo;

/* ═══ dựng cảnh ═══════════════════════════════════════════════════════════════════ */

interface HatKhoan { ngay: string; soTien: number; chieu?: 'chi' | 'thu' }

/** Hạt → `Khoan` thật, MỘT nguồn với kho (nếp `pfm_man_guong.test.tsx`). */
function hatRaKhoan(hat: readonly HatKhoan[]): import('../src/pfm/so.js').Khoan[] {
  return hat.map((h, i) => taoKhoan({ ngay: h.ngay, soTien: h.soTien, chieu: h.chieu ?? 'chi' }, LUC, `k${i}`));
}

async function khoCo(hat: readonly HatKhoan[] = [], hoSo?: HoSo): Promise<Kho> {
  const kho = new KhoTrongBoNho();
  for (const k of hatRaKhoan(hat)) await kho.ghi('khoan', khoanRaBanGhi(k));
  if (hoSo) await kho.ghi('meta', { id: ID_HO_SO, thang: THANG, suaLuc: LUC, d: hoSo });
  return kho;
}

/** Sáu ngày chi phẳng 21–26/09 (đúng sàn mẫu) + đỉnh ngày 23 — khung chung của mọi cảnh dưới. */
const SAU_NGAY_PHANG: HatKhoan[] = [21, 22, 23, 24, 25, 26].map((d) => ({ ngay: `2026-09-${d}`, soTien: 30_000 }));

/** TRÚNG: đỉnh ngày 23 (+500k) · ngày 24 (+20k = 50k) VƯỢT trung vị (30k) — vector của `so_doan.test.ts` §III. */
const NGAY_TE_TRUNG: HatKhoan[] = [
  ...SAU_NGAY_PHANG,
  { ngay: '2026-09-23', soTien: 500_000 },
  { ngay: '2026-09-24', soTien: 20_000 },
];

/** TRẬT: đỉnh ngày 23 (+500k) · ngày 24 hạ còn 10k, DƯỚI trung vị (30k). */
const NGAY_TE_TRAT: HatKhoan[] = [
  ...SAU_NGAY_PHANG.filter((h) => h.ngay !== '2026-09-24'),
  { ngay: '2026-09-23', soTien: 500_000 },
  { ngay: '2026-09-24', soTien: 10_000 },
];

/** CHƯA ĐỦ: chỉ ba ngày có chi — dưới sàn `GUONG_SAN_NGAY_CHI` (6). */
const NGAY_TE_CHUA_DU: HatKhoan[] = [
  { ngay: '2026-09-21', soTien: 30_000 },
  { ngay: '2026-09-22', soTien: 40_000 },
  { ngay: '2026-09-23', soTien: 50_000 },
];

/** `/auth/me` mặc định của cả tệp: PFM bật, tuần thứ Hai 21/09 ĐÃ niêm phong. */
const ME_TUAN_DA_CHOT = {
  email: 'a@b.c', email_verified: true, onboarded: true, user: null,
  pfm: {
    consent: true, tuan: '2026-09-21', tuan_da_niem_phong: true,
    tuan_token_thuong: 12, tuan_so_ngay_co_mat: 7,
  },
};

function stubMang(): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const dap = (status: number, body: unknown) => new Response(JSON.stringify(body), {
      status, headers: { 'content-type': 'application/json' },
    });
    if (url.includes('/telemetry')) return dap(202, { ok: true });
    if (url.includes('/auth/me')) return dap(200, ME_TUAN_DA_CHOT);
    return dap(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
  }));
}

function veGuong(kho: Kho): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/tai-chinh/guong']}>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}><RuotGuong /></KhoProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function veChanDung(kho: Kho): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/tai-chinh/the']}>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}><RuotChanDung /></KhoProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/** Vài nhịp promise trống — cho các nhánh async (hiệu ứng ghi, refetch sau invalidate) chạy hết. */
async function nhaNhip(vong = 4): Promise<void> {
  await act(async () => { for (let i = 0; i < vong; i++) await Promise.resolve(); });
}

/**
 * Tới khối TUẦN. Chờ theo nút chốt đã đổi vai (`CB.guDaChot`) — mốc "`/me` đã về, tuần đã niêm phong" — rồi mở lớp HƯỚNG (chạm ô HƯỚNG).
 * ⭐ D453 — kết quả tuần (con dấu · app tự chấm · thành tích) nằm ở dải CHẤM của tấm HƯỚNG; tầng không gian: tấm trong lớp, nên mở lớp rồi chờ dải dựng.
 */
async function moNapTuan(): Promise<void> {
  await screen.findByRole('button', { name: CB.guDaChot });
  fireEvent.click(await oTheo('guong-huong'));
  await screen.findByTestId('huong-cham');
  await nhaNhip();
}

/** Ô theo `data-o` (chờ có mặt). */
const oTheo = (dau: string): Promise<HTMLElement> => waitFor(() => {
  const e = document.querySelector<HTMLElement>(`[data-o="${dau}"]`);
  expect(e, `ô ${dau}`).not.toBeNull();
  return e!;
});
/** THẺ: chạm ô ⇒ lớp (ĐOÁN ĐÚNG · ĐỘ NHẤT QUÁN…). Chờ số của ô đã tải để lớp đọc dữ liệu thật. */
async function moLopThe(dau: string): Promise<void> {
  await waitFor(() => expect(screen.getByTestId('the-can-cu').textContent).not.toBe('—'));
  fireEvent.click(await oTheo(dau));
  await screen.findByRole('dialog');
}

beforeEach(() => { stubMang(); });
afterEach(() => { vi.unstubAllGlobals(); });

/* ═══ §I — GƯƠNG: ô CHỐT SỔ TUẦN tự chấm VÀ GHI vào sổ ════════════════════════════ */

describe('§I — ⭐⭐⭐ Gương tự chấm lời đoán của kỳ vừa niêm phong, ghi ĐÚNG MỘT dòng vào sổ', () => {
  it('⭐⭐⭐ TRÚNG: sổ đủ mẫu, ngày-sau-đỉnh vượt trung vị ⇒ "TÔI TRÚNG", và kho có đúng dòng ấy', async () => {
    const kho = await khoCo(NGAY_TE_TRUNG, { nhip: ['ngày tệ'], doanTu: '2026-09-16' });
    veGuong(kho);
    await moNapTuan();

    expect(await screen.findByTestId('tu-cham')).toHaveTextContent(CHU_TU_CHAM.trung);

    await waitFor(async () => {
      const b = await kho.doc<HoSo>('meta', ID_HO_SO);
      expect(b?.d.soDoan?.['tuan:2026-09-21']).toEqual({
        ma: 'ngay_te', kq: 'trung', doDuoc: 50_000, moc: 30_000,
      });
    });
  });

  it('⭐⭐ idempotent: dựng lại lần hai với CÙNG kho ⇒ vẫn đúng MỘT dòng, thành tích 1 trúng · 0 trật', async () => {
    const kho = await khoCo(NGAY_TE_TRUNG, { nhip: ['ngày tệ'], doanTu: '2026-09-16' });
    const luot1 = veGuong(kho);
    await moNapTuan();
    await waitFor(async () => {
      expect((await kho.doc<HoSo>('meta', ID_HO_SO))?.d.soDoan?.['tuan:2026-09-21']?.kq).toBe('trung');
    });
    luot1.unmount();

    veGuong(kho);            // mount MỚI, cùng kho — không phải cache ấm, đọc lại từ đầu
    await moNapTuan();
    expect(await screen.findByTestId('tu-cham')).toHaveTextContent(CHU_TU_CHAM.trung);
    /* D453 — dải CHẤM viết thành tích gọn "đúng 1/1 lần" (THẺ vẫn viết "1 trúng · 0 trật" — bài §II dưới). */
    expect(await screen.findByTestId('thanh-tich-doan')).toHaveTextContent(
      `${CHU_HUONG.appDungPre}1/1${CHU_HUONG.appDungHau}`,
    );

    const b = await kho.doc<HoSo>('meta', ID_HO_SO);
    expect(Object.keys(b?.d.soDoan ?? {}), 'lượt hai không được đẻ thêm dòng').toEqual(['tuan:2026-09-21']);
  });

  it('⭐⭐⭐ TRẬT: ngày-sau-đỉnh DƯỚI trung vị ⇒ "TÔI TRẬT", ghi đúng `trat`', async () => {
    const kho = await khoCo(NGAY_TE_TRAT, { nhip: ['ngày tệ'], doanTu: '2026-09-16' });
    veGuong(kho);
    await moNapTuan();

    expect(await screen.findByTestId('tu-cham')).toHaveTextContent(CHU_TU_CHAM.trat);
    await waitFor(async () => {
      const b = await kho.doc<HoSo>('meta', ID_HO_SO);
      expect(b?.d.soDoan?.['tuan:2026-09-21']).toEqual({
        ma: 'ngay_te', kq: 'trat', doDuoc: 10_000, moc: 30_000,
      });
    });
  });

  it('⭐⭐⭐ CHƯA ĐỦ: dưới sáu ngày có chi ⇒ hiện "CHƯA ĐỦ SỐ" và KHÔNG ghi gì vào sổ', async () => {
    const kho = await khoCo(NGAY_TE_CHUA_DU, { nhip: ['ngày tệ'], doanTu: '2026-09-16' });
    veGuong(kho);
    await moNapTuan();

    // Khẳng định DƯƠNG trước: `tu-cham` phải THẬT SỰ đã hiện, không phải "chưa kịp render".
    expect(await screen.findByTestId('tu-cham')).toHaveTextContent(CHU_TU_CHAM.chua_du);
    // Chờ thêm vài nhịp rồi mới khẳng định vắng — để một cú ghi sai (nếu có) có đủ thời gian xảy ra.
    await nhaNhip();
    const b = await kho.doc<HoSo>('meta', ID_HO_SO);
    expect(b?.d.soDoan, '`chua_du` không phải một lượt đoán — không được vào sổ').toBeUndefined();
  });

  it('⭐⭐⭐ ĐOÁN SAU KHI BIẾT: mốc đưa ra SAU thứ Hai của tuần ⇒ "không chấm", không `tu-cham`', async () => {
    // Mốc 23/09 (thứ Tư) đứng SAU thứ Hai 21/09 của tuần vừa niêm phong — đúng bẫy `so_doan.ts`
    // §I: chấm ở đây là app tự chấm mà nhìn đáp án.
    const kho = await khoCo(NGAY_TE_TRUNG, { nhip: ['ngày tệ'], doanTu: '2026-09-23' });
    veGuong(kho);
    await moNapTuan();

    expect(await screen.findByText(CHU_TU_CHAM.khongChamGiai)).toBeInTheDocument();
    expect(screen.queryByTestId('tu-cham')).not.toBeInTheDocument();
    await nhaNhip();
    expect((await kho.doc<HoSo>('meta', ID_HO_SO))?.d.soDoan).toBeUndefined();
  });

  it('⭐⭐ KHÔNG MỐC: chưa có `doanTu` ⇒ không `tu-cham`, không câu "không chấm"', async () => {
    const kho = await khoCo(NGAY_TE_TRUNG, { nhip: ['ngày tệ'] });
    veGuong(kho);
    await moNapTuan();

    // Neo bằng con dấu "ĐÃ CHỐT SỔ" — nội dung nắp chắc chắn đã render trước khi khẳng định vắng.
    await screen.findByText(C.dauDaChot);
    expect(screen.queryByTestId('tu-cham')).not.toBeInTheDocument();
    expect(screen.queryByText(CHU_TU_CHAM.khongChamGiai)).not.toBeInTheDocument();
  });

  it('⭐⭐⭐ KHÔNG SẬP với dòng đã lưu HỎNG (`ma` lạ, di sản/gõ tay): vẫn hiện đúng `kq` đã lưu', async () => {
    /*
     * ⚠⚠ `locSoDoan` chỉ kiểm HÌNH, không kiểm `ma` theo danh mục (xem `ho_so.ts`) — một `ma`
     * không còn trong `CHAN_DUNG_NOI_DUNG` vẫn qua được tới màn. `.doan` sau `CHAN_DUNG_NOI_DUNG
     * [dongCham.ma]` phải có `?.`, không thì ca này SẬP CẢ MÀN GƯƠNG (xem chú thích tại chỗ gọi).
     */
    const hoso = {
      nhip: ['ngày tệ'], doanTu: '2026-09-16',
      // `ma` cố ý KHÔNG thuộc `MaChanDung` — mô phỏng một dòng cũ/gõ tay đã lạc khỏi danh mục.
      soDoan: { 'tuan:2026-09-21': { ma: 'la_hoan', kq: 'trung', doDuoc: 1, moc: 1 } },
    } as unknown as HoSo;
    const kho = await khoCo(NGAY_TE_TRUNG, hoso);
    veGuong(kho);
    await moNapTuan();

    expect(await screen.findByTestId('tu-cham')).toHaveTextContent(CHU_TU_CHAM.trung);
    // Dòng ĐÃ LƯU thắng — không bị `chamKy` tính lại đè lên (nó sẽ tính ra cùng `trung` ở vector
    // này, nhưng với `doDuoc`/`moc` khác; kiểm đúng dòng cũ còn nguyên là kiểm `daLuu` thắng).
    const b = await kho.doc<HoSo>('meta', ID_HO_SO);
    expect(b?.d.soDoan?.['tuan:2026-09-21']).toEqual({ ma: 'la_hoan', kq: 'trung', doDuoc: 1, moc: 1 });
  });
});

/* ═══ §II — CHÂN DUNG: đặt mốc lời đoán + hiện thành tích ═════════════════════════ */

describe('§II — ⭐⭐⭐ Chân dung đặt mốc `doanTu` lúc lời đoán hiện lần đầu', () => {
  /** Ba câu ĐO — cho `toaDoTuNhan` một toạ độ thật, để màn không dừng ở "CHƯA ĐỦ ĐỂ VẼ". */
  const BA_CAU_DO = {
    lucTienVe: 'tiêu cái đang cần', sauKhiTieu: 'nhẩm lại giá', dauThang: 'đại khái',
  } as const;

  it('⭐⭐⭐ ĐẶT MỐC: có lời đoán (câu 6 = "ngày tệ"), chưa có `doanTu` ⇒ kho được ghi `doanTu = homNay()`', async () => {
    const kho = await khoCo([], { nhip: ['ngày tệ'], ...BA_CAU_DO });
    veChanDung(kho);

    // Đợi KHO trước — DOM chỉ bắt kịp sau khi invalidate → refetch xong (một nhịp sau ghi).
    await waitFor(async () => {
      const b = await kho.doc<HoSo>('meta', ID_HO_SO);
      expect(b?.d.doanTu).toBe(homNay());
    });
    await moLopThe('the-doan-dung');
    await waitFor(async () => {
      expect(await screen.findByTestId('cham-o'), 'mốc vừa đặt phải là HÔM NAY, viết dd/mm')
        .toHaveTextContent('23/09');
    });
  });

  it('⭐⭐⭐ KHÔNG GHI ĐÈ MỐC: `doanTu` đã có ⇒ giữ nguyên, và màn KHÔNG chạm lại kho', async () => {
    const kho = await khoCo([], { nhip: ['ngày tệ'], doanTu: '2026-09-16', ...BA_CAU_DO });
    // ⚠ Gắn spy TRƯỚC khi dựng — đếm luôn cả lượt đọc đầu tiên của `useHoSo`.
    const docSpy = vi.spyOn(kho, 'doc');
    veChanDung(kho);

    await moLopThe('the-doan-dung');
    const o = await screen.findByTestId('cham-o');
    expect(o).toHaveTextContent('16/09');
    await nhaNhip();
    expect(o).toHaveTextContent('16/09');   // vẫn đúng mốc cũ sau khi nhả nhịp — không bị viết đè

    const soLanDocHoSo = docSpy.mock.calls.filter((c) => c[0] === 'meta' && c[1] === ID_HO_SO).length;
    expect(
      soLanDocHoSo,
      'mốc đã có sẵn ⇒ hiệu ứng đặt mốc không có gì để làm — không được đọc lại kho '
      + '(một lượt đọc thừa ở đây nghĩa là nó đã thật sự thử ghi rồi tự huỷ, tốn một vòng vô ích '
      + 'và mở cửa cho một cuộc đua giữa hai lượt ghi)',
    ).toBe(1);
  });

  it('⭐⭐ KHÔNG ĐẶT MỐC khi không có lời đoán (chưa trả lời câu 6): không `doanTu`, không `cham-o`', async () => {
    const kho = await khoCo([], { ...BA_CAU_DO });   // có ba câu đo, KHÔNG có `nhip`
    veChanDung(kho);

    // Neo dương: lớp ĐOÁN ĐÚNG đã dựng xong và nói "chưa có lời đoán" (không phải đang tải).
    await moLopThe('the-doan-dung');
    expect(await screen.findByText(CB.theChuaCoDoan)).toBeInTheDocument();
    await nhaNhip();
    expect(screen.queryByTestId('cham-o')).not.toBeInTheDocument();
    expect((await kho.doc<HoSo>('meta', ID_HO_SO))?.d.doanTu).toBeUndefined();
  });

  it('⭐ thành tích: sổ có 2 trúng · 1 trật ⇒ dòng thành tích hiện đúng hai số ấy', async () => {
    const soDoan: HoSo['soDoan'] = {
      'tuan:2026-09-07': { ma: 'ngay_te', kq: 'trung', doDuoc: 1, moc: 2 },
      'tuan:2026-09-14': { ma: 'ngay_te', kq: 'trat', doDuoc: 1, moc: 2 },
      'thang:2026-08': { ma: 'cuoi_thang', kq: 'trung', doDuoc: 9, moc: 3 },
    };
    // `doanTu` đã đặt sẵn — không cần chờ hiệu ứng đặt mốc để bài này gọn và tất định.
    const kho = await khoCo([], { nhip: ['ngày tệ'], doanTu: '2026-09-01', ...BA_CAU_DO, soDoan });
    veChanDung(kho);

    await moLopThe('the-doan-dung');
    expect(await screen.findByTestId('thanh-tich-doan')).toHaveTextContent(
      `${CHU_TU_CHAM.thanhTichPre}2${CHU_TU_CHAM.thanhTichTrung}1${CHU_TU_CHAM.thanhTichTrat}`,
    );
  });
});

/* ═══ §III — THẺ: khối NÓI · LÀM · TRONG TRẬN (dời từ GƯƠNG, D453) mang theo công tắc "Tắt Gương" ═══════════════ */

describe('§III — ⭐⭐ THẺ: "Tắt Gương" vẫn tắt khối NÓI · LÀM · TRONG TRẬN sau khi khối dời màn', () => {
  /*
   * ⚠ Cài đặt hứa *"Màn Gương ngừng tính các chỉ số mô tả"*. Khối này mang mặt SỔ (chỉ số mô tả) và bị chặn khi còn ở
   *   GƯƠNG (D426). Dời màn mà quên cổng là lời hứa rỗng quay lại: màn vẫn vẽ, không gì đỏ.
   */
  /** Đã phỏng vấn — hồ sơ rỗng thì THẺ chỉ là cửa mời phỏng vấn, khối này không có chỗ đứng. */
  const DA_PHONG_VAN: HoSo = { lucTienVe: 'tiêu cái đang cần', sauKhiTieu: 'nhẩm lại giá', dauThang: 'đại khái' };

  it('⭐⭐ guongTat = true ⇒ lớp ĐỘ NHẤT QUÁN nói câu đã duyệt, KHÔNG dựng mặt ba cặp', async () => {
    const kho = await khoCo(SAU_NGAY_PHANG, DA_PHONG_VAN);
    await kho.ghi('meta', { id: ID_CAI_DAT_MAY, thang: THANG, suaLuc: LUC, d: { guongTat: true, nhacTat: false } });
    veChanDung(kho);
    await moLopThe('the-nhat-quan');
    const lop = within(screen.getByRole('dialog'));
    expect(await lop.findByTestId('guong-tat-ba-mat')).toHaveTextContent(C.guongTat);
    await nhaNhip();
    expect(screen.queryByTestId('mat-ba-mat'), 'mặt SỔ vẫn được dựng khi Gương tắt').toBeNull();
  });

  it('guongTat = false (chưa ai chạm công tắc) ⇒ mặt ba cặp dựng như thường', async () => {
    veChanDung(await khoCo(SAU_NGAY_PHANG, DA_PHONG_VAN));
    await moLopThe('the-nhat-quan');
    const lop = within(screen.getByRole('dialog'));
    expect(await lop.findByTestId('mat-ba-mat')).toBeInTheDocument();
    expect(screen.queryByTestId('guong-tat-ba-mat')).toBeNull();
  });
});
