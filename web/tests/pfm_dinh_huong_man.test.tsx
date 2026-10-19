/**
 * PFM — MÀN ĐỊNH HƯỚNG (D429): hai thẻ đầu GƯƠNG (`screens/tai-chinh/DinhHuong.tsx`) + lối tắt `?tao=` · `?lenh=&td=` của
 * màn HŨ.
 *
 * ⭐⭐⭐ Canh năm điều, đo trên ĐƯỜNG CHÍNH (`RuotGuong` đọc kho thật trong bộ nhớ — A11.6):
 *   (1) bản tin nói đúng số của hàm thuần — D453: bản tin đứng dưới tấm HƯỚNG, thẻ khung vào nắp KHUNG CHIA TIỀN;
 *   (2) GỢI Ý không ghi gì; CHỌN ghi đúng `hoSo.khung` và không gì khác;
 *   (3) P3 🔒 — số theo công thức 50/30/20 chỉ hiện SAU khi người dùng chọn khung ấy;
 *   (4) mỗi bước dựng đi đúng màn sẵn có, query chỉ mang MÃ; màn HŨ mở đúng bảng với ô số TRỐNG;
 *   (5) A10 — mọi chữ khối này vẽ ra qua bộ quét `TU_KE_DON`; P10 — một lượt `dinh_huong_hien` mỗi lần mở màn.
 *
 * ⚠ 11/10 (HƯỚNG THEO DEMO, câu B): thẻ KHUNG CHIA TIỀN không còn trong lớp HƯỚNG — nó nằm ở lớp CÀI ĐẶT (`KhungChiaTien`, nạp trễ cùng lớp ấy). Bài này
 *   vẫn canh ĐÚNG những luật cũ của thẻ khung (GỢI Ý không ghi gì · CHỌN ghi đúng `khung` · P3 · bước dựng · A10 · P10) nhưng dựng thẻ qua `KhungChiaTien`
 *   thay vì mở lớp HƯỚNG; thêm bài khoá "lớp HƯỚNG KHÔNG còn thẻ khung".
 * ⚠ 11/10 (TẦNG KHÔNG GIAN, SPEC `pfm-tang-khong-gian`): GƯƠNG không cuộn — tấm HƯỚNG + thẻ KHUNG nằm trong lớp mở từ ô HƯỚNG; BẢN TIN THÁNG nằm trong lớp
 *   PHÂN TÍCH (ô nhỏ); thẻ TIỀN VÀO ĐI ĐÂU trong lớp biểu đồ. Nắp KHUNG CHIA TIỀN không còn (thẻ khung hiện thẳng dưới tấm). Mọi LUẬT giữ nguyên
 *   (bản tin nói đúng số hàm thuần · GỢI Ý không ghi gì · P3 · bước dựng đi đúng màn · A10 · P10); chỉ ĐƯỜNG TỚI đổi. Bài thứ-tự-DOM của ba khối viết lại
 *   thành "tấm đứng trước thẻ khung trong cùng lớp; bản tin chỉ ở lớp PHÂN TÍCH (một chỗ)". Lối `?tao=` của HŨ nay mở bảng TẠO HŨ ba bước (loại chọn sẵn).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const THANG = '2026-09';
const NGAY = '2026-09-26';
const LUC = '2026-06-01T02:00:00.000Z';

vi.mock('../src/lib/telemetry.js', () => ({
  ghiDo: vi.fn(), manCuaDuong: () => '/tai-chinh/guong', baoLoiNen: vi.fn(),
}));
const { ghiDo } = await import('../src/lib/telemetry.js');

vi.mock('../src/pfm/thoi_gian.js', async (goc) => {
  const m = await goc<typeof import('../src/pfm/thoi_gian.js')>();
  return { ...m, homNay: () => NGAY, thangNay: () => THANG };
});

const { RuotGuong } = await import('../src/screens/tai-chinh/Guong');
const { KhungChiaTien } = await import('../src/screens/tai-chinh/KhungChiaTien');
const { RuotHu } = await import('../src/screens/tai-chinh/Hu');
const { KhoProvider } = await import('../src/pfm/dung_kho');
const { KhoTrongBoNho } = await import('../src/pfm/kho.js');
const { khoanRaBanGhi, taoKhoan } = await import('../src/pfm/so.js');
const { taoKhoanPhanBo } = await import('../src/pfm/phan_bo.js');
const { tuTao } = await import('../src/pfm/hu.js');
const { hanTuSoThang } = await import('../src/pfm/vi_the.js');
const { suaHoSo, docHoSo } = await import('../src/pfm/ho_so.js');
const { banTinThang, hocTuQuyetDinh } = await import('../src/pfm/huong.js');
const { nhap503020 } = await import('../src/pfm/phong_cach.js');
const { CHU_DINH_HUONG: D, CHU_KHUNG, CHU_PHAN_BO: CP, CHU_HUONG: H, moiChuoiPfm } = await import('../src/lib/pfm_chu');
const { tuKeDonTrong } = await import('../src/lib/khoanh_khac');
const { ID_CAI_DAT_MAY } = await import('../src/pfm/cai_dat_may.js');
const { tienNgan } = await import('../src/screens/tai-chinh/BieuDo');

type Kho = InstanceType<typeof KhoTrongBoNho>;
type Khoan = import('../src/pfm/so.js').Khoan;
type Hu = import('../src/pfm/hu.js').Hu;
type HoSo = import('../src/pfm/ho_so.js').HoSo;

/* ═══ dựng cảnh ═══════════════════════════════════════════════════════════════════════════════════ */

/** Lớp chủ (CÀI ĐẶT) phải ĐÓNG trước khi một bước dựng đổi màn/query (RÀ 12/10 C1). */
const onDi = vi.fn();
let dem = 0;
const id = (): string => `k${dem++}`;
const ngay = (thang: string, d: number): string => `${thang}-${String(d).padStart(2, '0')}`;
const chi = (n: string, soTien: number): Khoan => taoKhoan({ ngay: n, soTien }, `${n}T05:00:00.000Z`, id());
const thu = (n: string, soTien: number): Khoan => taoKhoan({ ngay: n, soTien, chieu: 'thu' }, `${n}T02:00:00.000Z`, id());
const nap = (n: string, soTien: number, huId: string): Khoan =>
  taoKhoanPhanBo({ ngay: n, soTien, huId, phanBo: 'tay' }, `${n}T13:00:00.000Z`, id());
const gan = (n: string, soTien: number, huId: string): Khoan =>
  taoKhoanPhanBo({ ngay: n, soTien, huId, phanBo: 'gan' }, `${n}T14:00:00.000Z`, id());

/**
 * Sổ mẫu: tháng 8 tiêu 100k/ngày (80k chia vào ĂN UỐNG), tháng 9 tới hôm qua 70k/ngày (50k chia) · tiền vào đều ba tháng ·
 * TAI NGHE (vị thế mở 01/09, hạn 3 tháng, mới góp 300k ⇒ trễ) · ĐI LẠI (tiêu dùng, chưa phân loại).
 */
function soMau(): Khoan[] {
  const ra: Khoan[] = [thu('2026-06-05', 6_000_000), thu('2026-07-05', 6_200_000), thu('2026-08-05', 6_100_000)];
  for (const t of ['2026-06', '2026-07'] as const) for (let d = 1; d <= 30; d++) ra.push(chi(ngay(t, d), 90_000));
  for (let d = 1; d <= 31; d++) { ra.push(chi(ngay('2026-08', d), 100_000)); ra.push(gan(ngay('2026-08', d), 80_000, 'h-an')); }
  for (let d = 1; d <= 25; d++) { ra.push(chi(ngay('2026-09', d), 70_000)); ra.push(gan(ngay('2026-09', d), 50_000, 'h-an')); }
  ra.push(nap('2026-09-02', 300_000, 'h-tn'));
  return ra;
}
function huMau(): Hu[] {
  return [
    tuTao({ ten: 'Ăn uống', muc: 3_000_000, nhom: 'tieu_dung' }, LUC, 'h-an'),
    tuTao({ ten: 'Đi lại', muc: null, nhom: 'tieu_dung' }, LUC, 'h-di'),
    tuTao({ ten: 'Tai nghe', muc: 1_500_000, lenh: { tu: '2026-09-01', kyHan: hanTuSoThang('2026-09-01', 3) } },
      '2026-09-01T05:00:00.000Z', 'h-tn'),
  ];
}

async function khoCo(so: Khoan[], hu: Hu[], hoSo: HoSo = {}): Promise<Kho> {
  const kho = new KhoTrongBoNho();
  for (const k of so) await kho.ghi('khoan', khoanRaBanGhi(k));
  for (const h of hu) await kho.ghi('hu', { id: h.id, thang: h.taoLuc.slice(0, 7), suaLuc: h.taoLuc, d: h });
  if (Object.keys(hoSo).length > 0) await suaHoSo(kho, (cu) => ({ ...cu, ...hoSo }), LUC);
  return kho;
}

/** Màn đích của một bước dựng — chỉ in ra đường + query nó nhận được. */
function Dich({ ten }: { ten: string }): React.ReactElement {
  const l = useLocation();
  return <p data-testid="dich">{`${ten}${l.search}`}</p>;
}

function ve(kho: Kho, nghiemNgat = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const cay = (
    <MemoryRouter initialEntries={['/tai-chinh/guong']}>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}>
          <Routes>
            <Route path="/tai-chinh/guong" element={<><RuotGuong /><KhungChiaTien onChotTuan={() => undefined} onDi={onDi} /></>} />
            <Route path="/tai-chinh/hu" element={<Dich ten="hu" />} />
            <Route path="/tai-chinh/cam-ket" element={<Dich ten="cam-ket" />} />
          </Routes>
        </KhoProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return render(nghiemNgat ? <StrictMode>{cay}</StrictMode> : cay);
}

beforeEach(() => {
  onDi.mockClear();
  vi.mocked(ghiDo).mockClear();
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const dap = (status: number, body: unknown) => new Response(JSON.stringify(body), {
      status, headers: { 'content-type': 'application/json' },
    });
    if (url.includes('/auth/me')) {
      return dap(200, {
        email: 'a@b.c', email_verified: true, onboarded: true, user: null,
        pfm: { consent: true, tuan: '2026-W39', tuan_da_niem_phong: false, tuan_token_thuong: 0, tuan_so_ngay_co_mat: 6 },
      });
    }
    return dap(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); });

/** Ô theo `data-o` (chờ có mặt) và chạm ⇒ lớp trượt mở. */
const moLop = async (dau: string): Promise<void> => {
  const o = await waitFor(() => {
    const e = document.querySelector<HTMLElement>(`[data-o="${dau}"]`);
    expect(e, `ô ${dau}`).not.toBeNull();
    return e!;
  });
  fireEvent.click(o);
  await screen.findByRole('dialog');
};
/**
 * Thẻ KHUNG nằm trong `KhungChiaTien` (lớp CÀI ĐẶT) — dựng cạnh `RuotGuong` rồi chờ thẻ. (Trước 11/10: trong lớp HƯỚNG; trước đó nắp KHUNG CHIA TIỀN
 * ở cuối màn; trước D453 khối định hướng đứng đầu màn và luôn mở.)
 */
const doiTheDinhHuong = async () => screen.findByTestId('phong-cach');

/* ═══ §I — vị trí + bản tin ═════════════════════════════════════════════════════════════════════ */

describe('§I — ⭐⭐⭐ bản tin THÁNG đứng dưới tấm HƯỚNG và nói đúng số của hàm thuần', () => {
  it('⭐⭐⭐ vị trí: lớp HƯỚNG chỉ có tấm (KHÔNG thẻ khung — khung ở CÀI ĐẶT); bản tin chỉ ở lớp PHÂN TÍCH, thẻ TIỀN VÀO ĐI ĐÂU ở lớp biểu đồ', async () => {
    ve(await khoCo(soMau(), huMau()));
    // Lớp HƯỚNG: tấm — và KHÔNG thẻ khung / bản tin bên trong (mỗi con số một chỗ).
    await moLop('guong-huong');
    const th = await screen.findByTestId('the-huong');
    const lop = screen.getByRole('dialog');
    expect(within(lop).queryByTestId('phong-cach'), 'thẻ khung đã dời khỏi lớp HƯỚNG').toBeNull();
    expect(within(lop).queryByTestId('khung-chia-tien')).toBeNull();
    expect(th.closest('[role="dialog"]')).toBe(lop);
    expect(screen.queryByTestId('phan-tich'), 'bản tin không ở lớp HƯỚNG').toBeNull();
    // Thẻ khung có mặt NGOÀI lớp (nơi dựng `KhungChiaTien`) — một thẻ duy nhất.
    expect(screen.getAllByTestId('phong-cach')).toHaveLength(1);
    // Lớp PHÂN TÍCH: đúng MỘT bản tin.
    await moLop('guong-phan-tich');
    expect(await screen.findAllByTestId('phan-tich')).toHaveLength(1);
    // Lớp biểu đồ: thẻ TIỀN VÀO ĐI ĐÂU.
    await moLop('guong-tien-vao');
    expect(await screen.findByTestId('the-di-dau')).toBeInTheDocument();
  });

  it('⭐⭐⭐ bản tin = đúng các dòng của `banTinThang`, cùng thứ tự; hũ lệch hạn đứng trên tấm HƯỚNG', async () => {
    const so = soMau();
    const hu = huMau();
    ve(await khoCo(so, hu));
    await moLop('guong-phan-tich');
    const pt = await screen.findByTestId('phan-tich');
    const ma = [...pt.querySelectorAll('[data-testid^="tin-"]')].map((e) => e.getAttribute('data-testid'));
    const bt = banTinThang({ so, hu, homNay: NGAY });
    const mong = [
      ...bt.chuY.map((c) => `tin-${c.ma}`),
      ...bt.duPhong.map((x) => (x.ma === 'chi_het_thang' ? `tin-${x.ma}`
        : x.ma === 'hu_muc' ? `tin-hu-${x.huId}` : `tin-vt-${x.huId}`)),
    ];
    expect(mong.length, 'cảnh phải có dòng bản tin — không thì bài so hai danh sách rỗng').toBeGreaterThan(0);
    expect(ma).toEqual(mong);
    /* Số lấy từ CHÍNH hàm thuần (một nguồn) — bản đầu gõ tay "−30" và sai: ngày 26 chưa có khoản nào (−33). */
    const c = bt.chuY.find((x) => x.ma === 'chi_doi');
    if (c?.ma !== 'chi_doi' || c.nguon === null) throw new Error('cảnh phải có dòng chi_doi có nguồn');
    const doi = within(screen.getByTestId('tin-chi_doi'));
    expect(doi.getByText(`−${Math.abs(Math.round(((c.nay - c.truoc) / c.truoc) * 100))}`)).toBeInTheDocument();
    expect(doi.getByText(new RegExp(`${D.cdNguonPre}ĂN UỐNG ${tienNgan(c.nguon.lech)}`))).toBeInTheDocument();
    expect(c.nguon.huId).toBe('h-an');
    // D453 — TAI NGHE trễ hạn không in ở bản tin nữa: nó là một dòng HỌC (in hai chỗ là hai con số một sự thật).
    expect(screen.queryByTestId('tin-vt-h-tn')).toBeNull();
    // 11/10 (câu B) — tấm chỉ bày HAI dòng học nên dòng này có thể không lọt hai chỗ đầu: canh ở lõi thuần (một nguồn) rằng nó LÀ một dòng học,
    // và dòng mô tả của nó là một CÂU đủ ý (có tên hũ · tháng đủ mức · lệch).
    const dongTn = hocTuQuyetDinh({ so, hu, luat: [], hoSo: {}, homNay: NGAY }).find((d) => d.ma === 'vi_the' && d.huId === 'h-tn');
    expect(dongTn, 'TAI NGHE trễ hạn phải là một dòng HỌC').toBeDefined();
    expect(dongTn!.thangDu).toBe('2027-01');
    expect(dongTn!.lech).toBe(1);
  });

  it('⭐⭐ P13 — chạm một dòng ⇒ hiện cách tính; chạm lại ⇒ cất', async () => {
    ve(await khoCo(soMau(), huMau()));
    await moLop('guong-phan-tich');
    const dong = await screen.findByTestId('tin-chi_doi');
    expect(screen.queryByTestId('giai-chi_doi')).toBeNull();
    fireEvent.click(dong);
    expect(screen.getByTestId('giai-chi_doi')).toHaveTextContent(D.cdGiai);
    expect(dong).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(dong);
    expect(screen.queryByTestId('giai-chi_doi')).toBeNull();
  });

  it('⭐⭐⭐ P7 — sổ trống ⇒ tấm nói MỘT câu "chưa đủ để học", không bản tin, không số 0', async () => {
    ve(await khoCo([], []));
    await moLop('guong-huong');
    const th = await screen.findByTestId('the-huong');
    expect(within(th).getByTestId('hoc-rong')).toHaveTextContent(H.hocRong);
    expect(th.querySelectorAll('[data-testid^="hoc-"]:not([data-testid="hoc-rong"])')).toHaveLength(0);
    // D453 — bản tin chỉ dựng khi có dòng: một thẻ "chưa đủ" thứ hai dưới tấm là nói một câu hai lần. Lớp PHÂN TÍCH nói "chưa đủ", không bản tin.
    expect(screen.queryByTestId('phan-tich')).toBeNull();
    await moLop('guong-phan-tich');
    expect(screen.queryByTestId('phan-tich')).toBeNull();
    expect(th.textContent ?? '').not.toMatch(/\b0%|\b0\/\d/);
  });

  it('⭐⭐ "Tắt Gương" ⇒ tấm bỏ dòng NHỊP SỔ (sau tiền về · cuối tuần · cuối tháng), giữ dòng quyết định + bản tin tổng', async () => {
    /* D453 — dòng nhịp hành vi rời bản tin, lên tấm HƯỚNG thành dòng HỌC; lời hứa của công tắc đi theo chúng lên tấm.
       Cảnh chỉ chi/thu, không hũ: không dòng quyết định nào chen chỗ nên dòng nhịp lên được tấm. Cuối tuần tiêu đậm. */
    const so = soMau().filter((k) => k.phanBo === undefined || k.phanBo === null);
    for (let d = 1; d <= 25; d++) if ([5, 6, 12, 13, 19, 20].includes(d)) so.push(chi(ngay('2026-09', d), 400_000));
    const kho = await khoCo(so, []);
    const NHIP = ['hoc-tien_ve_don', 'hoc-cuoi_tuan', 'hoc-cuoi_thang'];
    const nhipTrenTam = () => NHIP.filter((t) => screen.queryByTestId(t) !== null);
    const mo = ve(kho);
    await moLop('guong-huong');
    await screen.findByTestId('the-huong');
    await waitFor(() => expect(nhipTrenTam(), 'cảnh phải có dòng nhịp khi Gương bật — không thì bài này rỗng')
      .toContain('hoc-cuoi_tuan'));
    mo.unmount();
    await kho.ghi('meta', { id: ID_CAI_DAT_MAY, thang: THANG, suaLuc: LUC, d: { guongTat: true } });
    ve(kho);
    await moLop('guong-huong');
    await screen.findByTestId('the-huong');
    await waitFor(() => expect(screen.getByTestId('hoc-tien_ve_cat')).toBeInTheDocument());
    expect(nhipTrenTam()).toEqual([]);
    // Bản tin (lớp PHÂN TÍCH) không nhận lại chúng, và dòng tổng tháng vẫn đứng.
    await moLop('guong-phan-tich');
    await screen.findByTestId('phan-tich');
    expect(screen.queryByTestId('tin-cuoi_tuan')).toBeNull();
    expect(screen.queryByTestId('tin-sau_tien_ve')).toBeNull();
    expect(screen.getByTestId('tin-chi_doi')).toBeInTheDocument();
  });
});

/* ═══ §II — phong cách ══════════════════════════════════════════════════════════════════════════ */

describe('§II — ⭐⭐⭐ GỢI Ý không ghi gì; CHỌN ghi đúng `hoSo.khung`', () => {
  it('⭐⭐⭐ khung đứng đầu mang nhãn APP GỢI Ý + dấu hiệu; mở màn KHÔNG ghi khung nào vào hồ sơ', async () => {
    const kho = await khoCo(soMau(), huMau(), { deu: 'đều mỗi tháng', nhip: ['ngày tệ'] });
    ve(kho);
    const pc = await doiTheDinhHuong();
    expect(within(pc).getByTestId('pc-goi-y')).toHaveTextContent(D.pcGoiY);
    expect(within(pc).getByTestId('pc-ten')).toHaveTextContent(CHU_KHUNG['50_30_20'].toUpperCase());
    expect(within(pc).getByTestId('dh-thu_deu')).toBeInTheDocument();
    expect(within(pc).getByTestId('dh-noi_deu')).toHaveTextContent('đều mỗi tháng');
    expect((await docHoSo(kho)).khung, 'gợi ý là một câu, không phải một cú ghi').toBeUndefined();
  });

  it('⭐⭐⭐ DÙNG KHUNG ⇒ ghi đúng `khung`, mọi câu phỏng vấn khác nguyên vẹn; thẻ thành "KHUNG BẠN CHỌN · ĐANG DÙNG"', async () => {
    const kho = await khoCo(soMau(), huMau(), { deu: 'đều mỗi tháng', nhip: ['ngày tệ'], mucTieu: ['quỹ dự phòng'] });
    ve(kho);
    const pc = await doiTheDinhHuong();
    fireEvent.click(within(pc).getByTestId('pc-dung'));
    await waitFor(async () => expect((await docHoSo(kho)).khung).toBe('50_30_20'));
    const hs = await docHoSo(kho);
    expect(hs).toMatchObject({ deu: 'đều mỗi tháng', nhip: ['ngày tệ'], mucTieu: ['quỹ dự phòng'] });
    expect(await screen.findByTestId('pc-dang-dung')).toHaveTextContent(D.pcDangDung);
    expect(screen.getByTestId('phong-cach')).toHaveTextContent(D.pcTieuDaChon);
    expect(screen.queryByTestId('pc-dung'), 'đã dùng thì không còn nút DÙNG cho chính nó').toBeNull();
    expect(vi.mocked(ghiDo)).toHaveBeenCalledWith('dinh_huong_tuong_tac', { chi_tiet: { khung: '50_30_20', hanh_dong: 'dung' } });
  });

  it('⭐⭐⭐ P3 🔒 — số theo công thức 50/30/20 CHỈ hiện SAU khi chọn khung ấy', async () => {
    const kho = await khoCo(soMau(), huMau(), { deu: 'đều mỗi tháng' });
    ve(kho);
    const pc = await doiTheDinhHuong();
    expect(within(pc).getByTestId('ts-503020')).toBeInTheDocument();
    expect(within(pc).queryByTestId('ts-nhap'), 'chưa chọn ⇒ không nháp số nào').toBeNull();
    expect(within(pc).queryAllByTestId('ts-vach')).toHaveLength(0);
    fireEvent.click(within(pc).getByTestId('pc-dung'));
    const nhapEl = await screen.findByTestId('ts-nhap');
    const n = nhap503020(6_100_000);
    expect(nhapEl).toHaveTextContent(`${tienNgan(n.thietYeu)}`);
    expect(nhapEl).toHaveTextContent(`${tienNgan(n.muon)}`);
    expect(nhapEl).toHaveTextContent(`${tienNgan(n.deDanh)}`);
    expect(screen.getAllByTestId('ts-vach')).toHaveLength(2);
  });

  it('⭐⭐ XEM khung khác không ghi gì; tiêu đề chỉ là "KHUNG BẠN CHỌN" khi đang xem ĐÚNG khung đã chọn (soi 26/09)', async () => {
    const kho = await khoCo(soMau(), huMau(), { khung: '50_30_20', deu: 'đều mỗi tháng' });
    ve(kho);
    const pc = await doiTheDinhHuong();
    expect(pc).toHaveTextContent(D.pcTieuDaChon);
    fireEvent.click(within(pc).getByTestId('khung-kakeibo'));
    expect(within(screen.getByTestId('phong-cach')).getByTestId('pc-ten')).toHaveTextContent(CHU_KHUNG.kakeibo.toUpperCase());
    expect(screen.getByTestId('phong-cach')).toHaveTextContent(D.pcTieu);
    expect(screen.getByTestId('phong-cach')).not.toHaveTextContent(D.pcTieuDaChon);
    expect((await docHoSo(kho)).khung).toBe('50_30_20');
    expect(vi.mocked(ghiDo)).toHaveBeenCalledWith('dinh_huong_tuong_tac', { chi_tiet: { khung: 'kakeibo', hanh_dong: 'xem' } });
  });

  it('⭐⭐ phân loại tại chỗ ghi `thietYeu` vào ĐÚNG hũ trong kho — một cú menu, không một con số', async () => {
    const kho = await khoCo(soMau(), huMau(), { deu: 'đều mỗi tháng' });
    ve(kho);
    const pc = await doiTheDinhHuong();
    const hang = within(within(pc).getByTestId('loai-h-di'));
    fireEvent.click(hang.getByRole('button', { name: D.tsMuon }));
    await waitFor(async () => expect((await kho.doc<Hu>('hu', 'h-di'))?.d.thietYeu).toBe(false));
    expect((await kho.doc<Hu>('hu', 'h-di'))?.d.muc, 'mức không bị đụng').toBeNull();
    expect((await kho.doc<Hu>('hu', 'h-an'))?.d.thietYeu, 'hũ kia không bị đụng').toBeNull();
  });

  it('⭐⭐ P7 — chú giải 50/30/20: nhóm chưa có hũ nào mang nhãn ⇒ "—", không "0%"', async () => {
    ve(await khoCo(soMau(), huMau(), { deu: 'đều mỗi tháng' }));
    const pc = await doiTheDinhHuong();
    const ts = within(pc).getByTestId('ts-503020');
    expect(ts).toHaveTextContent(`${D.tsMuon} —`);
    expect(ts).toHaveTextContent(`${D.tsThietYeu} —`);
    expect(ts).not.toHaveTextContent(`${D.tsMuon} 0%`);
  });
});

/* ═══ §III — bước dựng ══════════════════════════════════════════════════════════════════════════ */

describe('§III — ⭐⭐⭐ bước dựng đi đúng màn sẵn có, query chỉ mang MÃ', () => {
  const vaoBuoc = async (hoSo: HoSo, khung: 'hu' | '50_30_20' | 'kakeibo', buoc: string, nut: string) => {
    ve(await khoCo(soMau(), huMau(), hoSo));
    const pc = await doiTheDinhHuong();
    fireEvent.click(within(pc).getByTestId(`khung-${khung}`));
    const b = within(await screen.findByTestId(`buoc-${buoc}`));
    fireEvent.click(b.getByRole('button', { name: nut }));
    const dich = (await screen.findByTestId('dich')).textContent;
    expect(onDi, 'bước dựng đổi màn ⇒ lớp chủ (CÀI ĐẶT) phải đóng TRƯỚC khi đi').toHaveBeenCalledTimes(1);
    return dich;
  };

  it('⭐⭐⭐ ĐẶT QUY TẮC (vị thế trễ) ⇒ HŨ ?lenh=<hũ>&td=ngay', async () => {
    expect(await vaoBuoc({}, 'hu', 'tu_chia_vi_the', D.nutQuyTac)).toBe('hu?lenh=h-tn&td=ngay');
    expect(vi.mocked(ghiDo)).toHaveBeenCalledWith('dinh_huong_tuong_tac', { chi_tiet: { khung: 'hu', hanh_dong: 'buoc:tu_chia_vi_the' } });
  });

  it('⭐⭐⭐ VIẾT LUẬT ⇒ CAM KẾT ?dk=tien_vua_ve (điều kiện chọn sẵn, lời do người dùng viết)', async () => {
    expect(await vaoBuoc({ nhip: ['lúc vừa có tiền'] }, 'kakeibo', 'luat_tien_ve', D.nutVietLuat)).toBe('cam-ket?dk=tien_vua_ve');
  });

  it('⭐⭐ TẠO HŨ (phần chưa chia) ⇒ HŨ ?tao=tieu_dung', async () => {
    const so = soMau().filter((k) => !(k.phanBo === 'gan' && k.ngay.startsWith('2026-09')));
    ve(await khoCo(so, huMau()));
    const pc = await doiTheDinhHuong();
    fireEvent.click(within(pc).getByTestId('khung-hu'));
    const b = within(await screen.findByTestId('buoc-hu_cho_chua_chia'));
    fireEvent.click(b.getByRole('button', { name: D.nutTaoHu }));
    expect((await screen.findByTestId('dich')).textContent).toBe('hu?tao=tieu_dung');
    expect(onDi, 'TẠO HŨ cũng đóng lớp chủ trước khi đi').toHaveBeenCalledTimes(1);
  });
});

describe('§III-bis — ⭐⭐⭐ màn HŨ nhận lối tắt: mở đúng bảng, ô số TRỐNG (P3 🔒), xoá query', () => {
  function veHu(kho: Kho, duong: string) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Query(): React.ReactElement { return <p data-testid="query">{useLocation().search}</p>; }
    return render(
      <MemoryRouter initialEntries={[duong]}>
        <QueryClientProvider client={qc}>
          <KhoProvider kho={kho}>
            <Routes><Route path="/tai-chinh/hu" element={<><RuotHu /><Query /></>} /></Routes>
          </KhoProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
  }

  it('⭐⭐⭐ query MỚI tới khi màn HŨ ĐÃ dựng và đã áp `?chia=1` trước đó ⇒ vẫn ÁP (bảng TẠO mở) — không bị bỏ lặng lẽ (RÀ 12/10 C1)', async () => {
    function NutDi(): React.ReactElement {
      const di = useNavigate();
      return <button type="button" onClick={() => di('/tai-chinh/hu?tao=tieu_dung')}>di-tao</button>;
    }
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/tai-chinh/hu?chia=1']}>
        <QueryClientProvider client={qc}>
          <KhoProvider kho={await khoCo(soMau(), huMau())}>
            <Routes><Route path="/tai-chinh/hu" element={<><RuotHu /><NutDi /></>} /></Routes>
          </KhoProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('dialog');                                   // lớp CHIA TIỀN do ?chia=1 mở
    expect(screen.queryByTestId('tao-buoc')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'di-tao' }));
    await screen.findByTestId('tao-buoc');                               // ?tao= tới SAU ⇒ bảng TẠO mở
    expect(document.querySelector('[data-nhom="tieu_dung"]')).toHaveAttribute('aria-pressed', 'true');
  });

  it('⭐⭐⭐ ?lenh=h-tn&td=ngay ⇒ bảng của TAI NGHE, "MỖI NGÀY" chọn sẵn, ô số rỗng; query bị xoá', async () => {
    veHu(await khoCo(soMau(), huMau()), '/tai-chinh/hu?lenh=h-tn&td=ngay');
    const bang = within(await screen.findByTestId('bang-lenh'));
    expect(bang.getByRole('button', { name: CP.tuDongNgay })).toHaveAttribute('aria-pressed', 'true');
    expect(bang.getByRole('button', { name: CP.tuDongPhanTram })).toHaveAttribute('aria-pressed', 'false');
    expect(bang.getByLabelText(CP.tuDongNgayO)).toHaveValue('');
    await waitFor(() => expect(screen.getByTestId('query')).toHaveTextContent(/^$/));
  });

  it('⭐⭐ ?lenh=&td= ⇒ cuộn tới ĐÚNG khối TỰ CHIA của bảng vừa mở; ?tao= ⇒ về đầu màn', async () => {
    /* ⚠ jsdom không có bố cục nên bài này canh ĐÍCH cuộn, không canh THỜI ĐIỂM. Thời điểm (cuộn sau khi bảng đã vẽ — bản rAF
       chạy trước bảng, soi CDP 27/09) chỉ đo được trên trình duyệt thật: ảnh `d429_7_dat_quy_tac.png` của lượt soi. */
    const cuon = vi.spyOn(Element.prototype, 'scrollIntoView');
    const dau = vi.spyOn(window, 'scrollTo');
    veHu(await khoCo(soMau(), huMau()), '/tai-chinh/hu?lenh=h-tn&td=ngay');
    await screen.findByTestId('bang-lenh');
    await waitFor(() => expect(cuon.mock.contexts.some((e) => (e as Element).getAttribute('data-neo') === 'tu-dong')).toBe(true));
    cuon.mockRestore(); dau.mockRestore();
  });

  it('⭐⭐ hũ ĐÃ có quy tắc ⇒ giữ quy tắc của nó (lối tắt không đè thứ người dùng đã đặt)', async () => {
    const hu = huMau().map((h) => (h.id === 'h-tn'
      ? { ...h, tuDong: { kieu: 'phan_tram' as const, gt: 7, tu: '2026-09-02', chayToi: null, moc: null } } : h));
    veHu(await khoCo(soMau(), hu), '/tai-chinh/hu?lenh=h-tn&td=ngay');
    const bang = within(await screen.findByTestId('bang-lenh'));
    expect(bang.getByRole('button', { name: CP.tuDongPhanTram })).toHaveAttribute('aria-pressed', 'true');
  });

  it('⭐⭐ ?tao=tieu_dung ⇒ bảng tạo hũ với TIÊU DÙNG chọn sẵn', async () => {
    veHu(await khoCo(soMau(), huMau()), '/tai-chinh/hu?tao=tieu_dung');
    // Bảng TẠO HŨ ba bước ở bước 1 (loại chọn sẵn); ô số chưa hiện — P3 🔒 vẫn đúng ở bước 2.
    await screen.findByTestId('tao-buoc');
    const oTieu = document.querySelector('[data-nhom="tieu_dung"]');
    expect(oTieu).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-nhom="tich_luy"]')).toHaveAttribute('aria-pressed', 'false');
  });

  it('mã lạ / hũ không có ⇒ không mở gì, không ném; query vẫn bị xoá', async () => {
    veHu(await khoCo(soMau(), huMau()), '/tai-chinh/hu?lenh=khong-co&td=ngay');
    expect((await screen.findAllByText(/TAI NGHE/i)).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('bang-lenh')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('query')).toHaveTextContent(/^$/));
  });
});

/* ═══ §IV — A10 · D26 · P10 ═════════════════════════════════════════════════════════════════════ */

describe('§IV — ⭐⭐⭐ A10: mọi chữ khối này vẽ ra qua bộ quét; mọi chuỗi nằm trong tự điển; P10 đo đúng một lần', () => {
  it('⭐⭐⭐ quét TU_KE_DON trên chữ THẬT của hai lớp (bản tin + tấm/khung), ở cả ba khung và mọi dòng mở cách tính', async () => {
    ve(await khoCo(soMau(), huMau(), { deu: 'đều mỗi tháng', nhip: ['lúc vừa có tiền', 'ngày tệ'] }));
    // Lớp PHÂN TÍCH: bản tin, mọi dòng mở cách tính.
    await moLop('guong-phan-tich');
    const pt = await screen.findByTestId('phan-tich');
    for (const d of pt.querySelectorAll('button[aria-expanded]')) fireEvent.click(d);
    const chuDaThay: string[] = [pt.textContent ?? ''];
    // D453 — tấm HƯỚNG (mọi lời giải mở) cũng là chữ app nói về tiền của người dùng.
    await moLop('guong-huong');
    const pc = await doiTheDinhHuong();
    for (const d of screen.getByTestId('the-huong').querySelectorAll('button[aria-expanded]')) fireEvent.click(d);
    chuDaThay.push(screen.getByTestId('the-huong').textContent ?? '');
    for (const k of ['hu', '50_30_20', 'kakeibo']) {
      fireEvent.click(within(pc).getByTestId(`khung-${k}`));
      chuDaThay.push(screen.getByTestId('phong-cach').textContent ?? '');
    }
    fireEvent.click(within(screen.getByTestId('phong-cach')).getByRole('button', { name: D.pcGiaiAria }));
    chuDaThay.push(screen.getByTestId('phong-cach').textContent ?? '');
    for (const t of chuDaThay) expect(tuKeDonTrong(t), t.slice(0, 120)).toEqual([]);
  });

  it('⭐⭐⭐ mọi chuỗi CHU_DINH_HUONG nằm trong `moiChuoiPfm()` (bộ quét A10 thấy được chúng)', () => {
    const quet = new Set(moiChuoiPfm());
    for (const [k, v] of Object.entries(D)) expect(quet.has(v), k).toBe(true);
  });

  it('⭐⭐ P10 — `dinh_huong_hien` ĐÚNG MỘT lần mỗi lần DỰNG thẻ khung (kể cả StrictMode); MỞ lớp HƯỚNG không bắn nó; mang mã khung + đếm dòng', async () => {
    ve(await khoCo(soMau(), huMau(), { deu: 'đều mỗi tháng' }), true);
    await doiTheDinhHuong();
    await waitFor(() => expect(vi.mocked(ghiDo).mock.calls.filter((c) => c[0] === 'dinh_huong_hien')).toHaveLength(1));
    // 11/10 — thẻ khung ở lớp CÀI ĐẶT: lượt đo đi theo thẻ, không theo lớp HƯỚNG (mở lớp HƯỚNG không thêm lượt nào).
    await moLop('guong-huong');
    await screen.findByTestId('the-huong');
    expect(vi.mocked(ghiDo).mock.calls.filter((c) => c[0] === 'dinh_huong_hien')).toHaveLength(1);
    const [, tuy] = vi.mocked(ghiDo).mock.calls.find((c) => c[0] === 'dinh_huong_hien')!;
    expect(tuy).toMatchObject({ chi_tiet: { khung: '50_30_20', so_bo: 0 } });
    expect(JSON.stringify(tuy), 'không một số tiền nào rời máy qua đo lường').not.toMatch(/000/);
  });
});
