/**
 * PFM — KHAY PHÂN BỔ, MẶT NGƯỜI DÙNG (`screens/tai-chinh/PhanBo.tsx` trong màn HŨ, D410 → D420 → D421).
 *
 * Founder 26/09 (D420): *"sao t bấm 1 cái nó cho phân bổ hết sạch số tiền luôn vậy :V Phải là hiện số tờ tiền chứ? Kiểu
 * 2tr thì 4 tờ 500k được bấm 4 lần"* · *"nhập tay số tiền nếu muốn nhanh và chính xác tuyệt đối"* · *"Tự động phân bổ …
 * nếu thiếu hoặc thừa thì app sẽ hỏi chứ ko tự phân bổ"*; câu hỏi đóng chốt: khay bày TIỀN CÒN LẠI, khớp thì tự chia +
 * HOÀN TÁC.
 * Founder 26/09 (D424): *"Sao phiếu chi ko làm tính năng nhập tích lũy giống thu?"* ⇒ câu đóng "tờ + GÕ SỐ như thu".
 * Founder 26/09 (D421): *"sao đang chia xong nó biến mất vậy? Mới cả bấm dấu x cái tự chia nó cũng biến mất nữa? Mà phân
 * biệt thu/chi vào hũ như nào?"* + *"hũ chia thành 2 loại là hũ tích lũy và hũ tiêu dùng"*; câu đóng chốt: hũ tiêu dùng
 * chứa PHIẾU CHI.
 * Bài này canh từng vế, đọc KHO làm nguồn sự thật. Vector lõi ở `pfm_phan_bo.test.ts` · `pfm_tu_dong.test.ts`.
 *
 * ⚠ ĐỒNG HỒ GIỮ CỐ ĐỊNH ở `homNay`/`thangNay` (nếp `pfm_loi_doan_man.test.tsx`); `bayGio` đơn điệu (dưới).
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { useEffect } from 'react';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const NGAY = '2026-09-26';
const THANG = '2026-09';
const LUC = '2026-09-26T05:00:00.000Z';
const HOM_QUA_TOI = '2026-09-25T13:00:00.000Z';

vi.mock('../src/lib/telemetry.js', () => ({
  ghiDo: vi.fn(), baoLoiNen: vi.fn(), manCuaDuong: () => '/tai-chinh/hu',
}));
/*
 * ⚠ Đồng hồ `bayGio` ĐƠN ĐIỆU, bắt đầu SAU mọi giờ ghi của sổ mẫu: mốc chạy quy tắc là `bayGio()`, và "tiền vào mới" =
 *   khoản ghi SAU mốc — để giờ thật thì bài đúng hay sai tuỳ lúc chạy (sổ mẫu ghi lúc 05:00Z hôm nay).
 */
const dongHo = vi.hoisted(() => ({ t: Date.parse('2026-09-26T15:00:00.000Z') }));
vi.mock('../src/pfm/thoi_gian.js', async (goc) => {
  const m = await goc<typeof import('../src/pfm/thoi_gian.js')>();
  return {
    ...m, homNay: () => NGAY, thangNay: () => THANG,
    bayGio: () => new Date(dongHo.t += 1_000).toISOString(),
  };
});

const { RuotHu } = await import('../src/screens/tai-chinh/Hu');
const { soChayTai, nhanTo, giuCho, oTheoCho } = await import('../src/screens/tai-chinh/PhanBo');
const { KhoProvider } = await import('../src/pfm/dung_kho');
const { KhoTrongBoNho } = await import('../src/pfm/kho.js');
const { tuTao, doiTrangThai } = await import('../src/pfm/hu.js');
const { taoKhoan, khoanRaBanGhi, locKhoanSo } = await import('../src/pfm/so.js');
const { taoKhoanPhanBo } = await import('../src/pfm/phan_bo.js');
const { CHU_PHAN_BO: CP, CHU_MAN_SO, CHU_BENTO: CB } = await import('../src/lib/pfm_chu');
const { NHIP } = await import('../src/lib/nhip');
const { HOAN_TAC_MS } = await import('../src/components/pfm/BanTien');

type Kho = InstanceType<typeof KhoTrongBoNho>;
type Khoan = import('../src/pfm/so.js').Khoan;
type Hu = import('../src/pfm/hu.js').Hu;
type QuyTac = import('../src/pfm/hu.js').QuyTacTuDong;

/* Sổ mẫu = đúng ví dụ founder chốt: + THU 2.000.000 · − CHI 45.000 · − CHI 100.000 ⇒ ví 1.855.000. */
const khoan = (id: string, soTien: number, them: Record<string, unknown> = {}, luc = LUC): Khoan =>
  taoKhoan({ ngay: NGAY, soTien, ...them }, luc, id);
const VI_MAU = [khoan('luong', 2_000_000, { chieu: 'thu' }), khoan('an', 45_000), khoan('grab', 100_000)];
const luongCu = (soTien: number): Khoan =>
  taoKhoan({ ngay: '2026-09-05', soTien, chieu: 'thu' }, '2026-09-05T02:00:00.000Z', 'luong-cu');
const coQuyTac = (h: Hu, q: Omit<QuyTac, 'tu'> & { tu?: string }): Hu => ({ ...h, tuDong: { tu: '2026-09-01', ...q } });
const napSan = (id: string, huId: string, soTien: number): Khoan =>
  taoKhoanPhanBo({ ngay: '2026-09-20', soTien, huId, phanBo: 'tay' }, '2026-09-20T05:00:00.000Z', id);

async function khoMau(them: { hu?: Hu[]; khoan?: Khoan[] } = {}): Promise<Kho> {
  const kho = new KhoTrongBoNho();
  const hu = them.hu ?? [
    tuTao({ ten: 'Xe máy', muc: 12_000_000 }, LUC, 'h-xe'),
    tuTao({ ten: 'Tai nghe' }, LUC, 'h-tn'),
  ];
  for (const h of hu) await kho.ghi('hu', { id: h.id, thang: THANG, suaLuc: LUC, d: h });
  for (const k of them.khoan ?? VI_MAU) await kho.ghi('khoan', khoanRaBanGhi(k));
  return kho;
}

/**
 * ⚠ TẦNG KHÔNG GIAN (SPEC `pfm-tang-khong-gian`, 11/10): kệ hũ + khay tờ tiền KHÔNG còn đứng trên mặt màn HŨ — chúng nằm trong LỚP
 *   "CHIA TIỀN TỐI NAY", mở bằng cú chạm ô CHIA TIỀN. Mọi luật của kệ/khay dưới đây GIỮ NGUYÊN; `ve` làm đúng việc của người chơi muốn
 *   chia tiền: mở màn rồi chạm ô ấy. (Hũ có quy tắc tự chia đang HỎI thì màn tự bung lớp này — bài IV canh riêng.)
 *   Chạm bằng `click()` thật ở lần commit đầu (không hẹn giờ) nên chạy được cả khi bài dùng đồng hồ giả.
 */
function MoLopChia(): null {
  useEffect(() => {
    let xong = false;
    // Chờ tới khi ô CHIA TIỀN đã có số (kho đọc xong) rồi mới chạm — đúng thứ tự người chơi thấy; MutationObserver (không hẹn giờ) để
    // chạy được cả khi bài dùng đồng hồ giả.
    const thu = (): void => {
      if (xong) return;
      const tong = document.querySelector('[data-testid="hu-chia-tong"]');
      const o = document.querySelector<HTMLElement>('[data-o="hu-chia"]');
      if (tong === null || o === null || tong.textContent === CB.dangTai) return;
      xong = true;
      quan.disconnect();
      o.click();
    };
    const quan = new MutationObserver(thu);
    quan.observe(document.body, { childList: true, subtree: true, characterData: true });
    thu();
    return () => quan.disconnect();
  }, []);
  return null;
}

function ve(kho: Kho): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/tai-chinh/hu']}>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}><RuotHu /><MoLopChia /></KhoProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function docSo(kho: Kho): Promise<Khoan[]> {
  return locKhoanSo((await kho.liet<Khoan>('khoan')).map((b) => b.d));
}
const phanBoCua = async (kho: Kho): Promise<Khoan[]> => (await docSo(kho)).filter((k) => k.phanBo !== undefined);
const nghi = async (ms = 30): Promise<void> => { await act(async () => { await new Promise((r) => { setTimeout(r, ms); }); }); };

const khay = (): HTMLElement => screen.getByTestId('khay-phan-bo');
/**
 * Các tờ CÒN TỜ trên khay, theo thứ tự hiển thị: [nhãn tờ, số lượng]. `rut` = khay đang ở chiều RA; `hanhDong` = đuôi
 * nhãn của tờ còn chạm được (nạp · rút · chia · gỡ).
 */
function toTrenKhay(rut = false, hanhDong: string = rut ? CP.toRut : CP.toNap): [string, string][] {
  return within(khay()).queryAllByRole('button', { name: new RegExp(hanhDong) })
    .map((b) => [b.firstElementChild!.textContent ?? '', b.lastElementChild!.textContent ?? '']);
}
/** MỌI ô trên khay kể cả ô trống: [nhãn tờ, số lượng, bấm được?]. */
function oTrenKhay(): [string, string, boolean][] {
  return within(screen.getByTestId('to-khay')).getAllByRole('button').map((b) => [
    b.firstElementChild!.textContent ?? '', b.lastElementChild!.textContent ?? '', !(b as HTMLButtonElement).disabled,
  ]);
}
const to = (tien: string): HTMLElement => within(khay()).getByRole('button', { name: new RegExp(`^${CP.toTen}${tien} `) });
const nutKhay = (ten: string): HTMLElement => within(khay()).getByRole('button', { name: ten });

async function chonHu(ten: RegExp): Promise<void> {
  const ke = await screen.findByTestId('ke-phan-bo');
  // Lớp mở NGAY (trước khi hũ đọc xong từ kho) ⇒ chờ nút hũ, không đọc ngay.
  fireEvent.click(await within(ke).findByRole('button', { name: ten }));
}
const theQuyTac = (): HTMLElement | null => screen.queryByTestId('the-quy-tac');

afterEach(() => { vi.useRealTimers(); });

describe('§I — ⭐⭐⭐ "ở trên là các hũ, bấm vào 1 hũ thì hiện ra số tiền"', () => {
  it('⭐⭐⭐ kệ hũ ở đầu màn (chỉ hũ đang chạy); CHƯA chọn hũ thì khay nói ví còn bao nhiêu, chưa bày tờ nào', async () => {
    const kho = await khoMau({
      hu: [
        tuTao({ ten: 'Xe máy', muc: 12_000_000 }, LUC, 'h-xe'),
        doiTrangThai(tuTao({ ten: 'Dừng tạm' }, LUC, 'h-dung'), 'tam_dung', LUC),
      ],
    });
    ve(kho);
    const ke = await screen.findByTestId('ke-phan-bo');
    expect(within(ke).getAllByRole('button', { pressed: false }).map((b) => b.getAttribute('data-ke-hu'))).toEqual(['h-xe']);
    await waitFor(() => expect(khay()).toHaveTextContent(`${CP.khayPre}1.855.000${CP.loiHau}`));
    expect(toTrenKhay(), 'chưa chọn hũ ⇒ chưa bày tờ').toEqual([]);
  });

  it('⭐⭐⭐ chọn hũ ⇒ TIỀN CÒN LẠI bẻ ra tờ, số lượng trên MỖI tờ: 1.855.000 = 500k ×3 · 200k · 100k · 50k · 5k', async () => {
    ve(await khoMau());
    await chonHu(/XE MÁY/);
    await waitFor(() => expect(toTrenKhay()).toEqual([
      ['500k', '×3'], ['200k', '×1'], ['100k', '×1'], ['50k', '×1'], ['5k', '×1'],
    ]));
    expect(khay()).toHaveTextContent('XE MÁY');
    expect(nutKhay(CP.huongNap), 'chọn hũ tích lũy ⇒ chiều NẠP VÀO').toHaveAttribute('aria-pressed', 'true');
    expect(nutKhay(CP.huongRut)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('vi-con')).toHaveTextContent(`${CP.viConPre}1.855.000${CP.loiHau}`);
  });

  it('⭐⭐⭐ "2tr thì 4 tờ 500k" — ví 2.000.000 ⇒ MỘT chồng 500k ×4', async () => {
    ve(await khoMau({ khoan: [khoan('luong', 2_000_000, { chieu: 'thu' })] }));
    await chonHu(/XE MÁY/);
    await waitFor(() => expect(toTrenKhay()).toEqual([['500k', '×4']]));
  });

  it('⭐⭐⭐ D421 — ví về 0 ⇒ kệ và khay VẪN ĐỨNG (còn hũ đang chạy): khay nói ví trống, không biến mất', async () => {
    /* Founder: *"sao đang chia xong nó biến mất vậy?"* — bản D420 gỡ cả kệ lẫn khay khi ví về 0. Tiêm: `hien` quay về
       "ví còn tiền" ⇒ đỏ. */
    const kho = await khoMau({ khoan: [khoan('t', 100_000, { chieu: 'thu' }), khoan('c', 100_000)] });
    ve(kho);
    await waitFor(() => expect(screen.getByTestId('hu-chia-tong').textContent).not.toBe(CB.dangTai));
    await nghi();
    expect(screen.getByTestId('ke-phan-bo')).toBeInTheDocument();
    expect(khay()).toHaveTextContent(CP.viTrong);
  });

  it('⭐ chưa hũ nào ĐANG CHẠY ⇒ không ô hũ, không khay (không có chỗ để chia) — kệ chỉ nói chưa có hũ', async () => {
    const kho = await khoMau({ hu: [doiTrangThai(tuTao({ ten: 'Dừng tạm' }, LUC, 'h-dung'), 'tam_dung', LUC)] });
    ve(kho);
    await waitFor(() => expect(screen.getByTestId('hu-chia-tong').textContent).not.toBe(CB.dangTai));
    await nghi();
    // Lớp CHIA TIỀN vẫn mở được (chạm ô) nhưng KHÔNG có hũ nào để chia: kệ chỉ nói "chưa có hũ", không có một ô hũ, không có khay tờ.
    const ke = await screen.findByTestId('ke-phan-bo');
    expect(ke).toHaveTextContent(CP.chuaCoHu);
    expect(within(ke).queryAllByRole('button', { pressed: false })).toHaveLength(0);
    expect(screen.queryByTestId('khay-phan-bo')).toBeNull();
  });
});

describe('§II — ⭐⭐⭐ chạm MỘT tờ ⇒ MỘT tờ vào hũ đang chọn', () => {
  it('⭐⭐⭐ chạm 500k ⇒ MỘT khoản 500.000 chuyển vào hũ (chi · hũ · dấu `tay`); tờ còn ×2; ví còn 1.355.000; số hũ chạy lên', async () => {
    const kho = await khoMau();
    ve(kho);
    await chonHu(/XE MÁY/);
    await waitFor(() => expect(toTrenKhay()).toHaveLength(5));
    fireEvent.click(to('500.000'));
    await waitFor(async () => expect(await phanBoCua(kho)).toHaveLength(1));
    const [k] = await phanBoCua(kho);
    expect(k).toMatchObject({ soTien: 500_000, chieu: 'chi', huId: 'h-xe', phanBo: 'tay', ngay: NGAY, nhan: null });
    await waitFor(() => expect(toTrenKhay()[0]).toEqual(['500k', '×2']));
    expect(screen.getByTestId('vi-con')).toHaveTextContent(`${CP.viConPre}1.355.000${CP.loiHau}`);
    const o = within(screen.getByTestId('ke-phan-bo')).getByRole('button', { name: /XE MÁY/ });
    await waitFor(() => expect(o).toHaveTextContent('500.000'), { timeout: 3_000 });
  });

  it('⭐⭐⭐ "được bấm 4 lần": chạm NHANH 500k NĂM lần với ví 2 triệu ⇒ đúng BỐN khoản — không bao giờ nạp quá ví', async () => {
    const kho = await khoMau({ khoan: [khoan('luong', 2_000_000, { chieu: 'thu' })] });
    ve(kho);
    await chonHu(/XE MÁY/);
    await waitFor(() => expect(toTrenKhay()).toEqual([['500k', '×4']]));
    const nut = to('500.000');
    await act(async () => { for (let i = 0; i < 5; i++) fireEvent.click(nut); });
    await waitFor(async () => expect(await phanBoCua(kho)).toHaveLength(4));
    await nghi();
    expect(await phanBoCua(kho)).toHaveLength(4);
    expect((await phanBoCua(kho)).every((x) => x.soTien === 500_000 && x.huId === 'h-xe')).toBe(true);
    expect(await screen.findByTestId('phan-bo-xong')).toHaveTextContent(CP.xongHet);
  });

  it('⭐⭐⭐ tờ cuối của một mệnh giá thành Ô TRỐNG tại chỗ — không tờ nào xê dịch, kể cả khi đổi hũ; hoàn tác ⇒ về đúng ô', async () => {
    const kho = await khoMau();
    ve(kho);
    await chonHu(/XE MÁY/);
    const dau: [string, string, boolean][] = [
      ['500k', '×3', true], ['200k', '×1', true], ['100k', '×1', true], ['50k', '×1', true], ['5k', '×1', true],
    ];
    await waitFor(() => expect(oTrenKhay()).toEqual(dau));
    fireEvent.click(to('200.000'));
    await waitFor(async () => expect(await phanBoCua(kho)).toHaveLength(1));
    const trong: [string, string, boolean][] = dau.map((x) => (x[0] === '200k' ? ['200k', '×0', false] : x));
    await waitFor(() => expect(oTrenKhay()).toEqual(trong));
    await chonHu(/TAI NGHE/);
    expect(oTrenKhay(), 'đổi hũ giữa phiên: ô vẫn đứng yên').toEqual(trong);
    fireEvent.click(await screen.findByRole('button', { name: CHU_MAN_SO.nutHoanTac }));
    await waitFor(() => expect(oTrenKhay()).toEqual(dau));
    expect(await phanBoCua(kho), 'hoàn tác = bia mộ cho khoản phân bổ').toEqual([]);
  });

  it('⭐⭐⭐ D421 — nạp hết ví ⇒ "ĐÃ CHIA HẾT" và Ở LẠI: qua cả nhịp thở, kệ + khay + hũ đang chọn vẫn đứng nguyên', async () => {
    /* Tiêm: hẹn giờ gỡ cờ "vừa xong" (bản D420 — `PFM_ND_THO`) ⇒ chữ biến mất ⇒ đỏ. */
    ve(await khoMau({ khoan: [khoan('t', 150_000, { chieu: 'thu' })] }));
    await chonHu(/TAI NGHE/);
    await waitFor(() => expect(toTrenKhay()).toEqual([['100k', '×1'], ['50k', '×1']]));
    fireEvent.click(to('100.000'));
    await waitFor(() => expect(toTrenKhay()).toEqual([['50k', '×1']]));
    fireEvent.click(to('50.000'));
    expect(await screen.findByTestId('phan-bo-xong')).toHaveTextContent(CP.xongHet);
    await nghi(NHIP.PFM_ND_THO + 300);
    expect(screen.getByTestId('phan-bo-xong'), 'chữ ĐÃ CHIA HẾT không tự tắt').toHaveTextContent(CP.xongHet);
    expect(screen.getByTestId('ke-phan-bo')).toBeInTheDocument();
    expect(within(screen.getByTestId('ke-phan-bo')).getByRole('button', { name: /TAI NGHE/ }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(nutKhay(CP.goSo), 'GÕ SỐ vẫn đứng (tắt) — không để hai nút chiều nở ra').toBeDisabled();
  });
});

describe('§III — ⭐⭐⭐ GÕ SỐ: "nhanh và chính xác tuyệt đối"', () => {
  it('⭐⭐⭐ GÕ SỐ ⇒ bàn phím; 1 · 2 · 3 · 000 ⇒ NẠP 123.000 ⇒ một khoản đúng 123.000; xong thì về bày tờ', async () => {
    const kho = await khoMau();
    ve(kho);
    await chonHu(/XE MÁY/);
    fireEvent.click(await within(khay()).findByRole('button', { name: CP.goSo }));
    const go = screen.getByTestId('go-so-phan-bo');
    for (const p of ['1', '2', '3', '000']) fireEvent.click(within(go).getByRole('button', { name: p }));
    fireEvent.click(within(go).getByRole('button', { name: `${CP.napGoPre}123.000` }));
    await waitFor(async () => expect((await phanBoCua(kho)).map((x) => x.soTien)).toEqual([123_000]));
    await waitFor(() => expect(screen.queryByTestId('go-so-phan-bo')).toBeNull());
    expect(screen.getByTestId('vi-con')).toHaveTextContent(`${CP.viConPre}1.732.000${CP.loiHau}`);
  });

  it('⭐⭐ gõ QUÁ ví ⇒ nút NẠP tắt + nói ví còn bao nhiêu; không ghi gì', async () => {
    const kho = await khoMau();
    ve(kho);
    await chonHu(/XE MÁY/);
    fireEvent.click(await within(khay()).findByRole('button', { name: CP.goSo }));
    const go = screen.getByTestId('go-so-phan-bo');
    for (const p of ['9', '9', '000', '000']) fireEvent.click(within(go).getByRole('button', { name: p }));
    const nap = within(go).getByRole('button', { name: `${CP.napGoPre}99.000.000` }) as HTMLButtonElement;
    expect(nap.disabled).toBe(true);
    expect(within(go).getByRole('alert')).toHaveTextContent(`${CP.vuotViPre}1.855.000${CP.vuotViHau}`);
    fireEvent.click(nap);
    await nghi();
    expect(await phanBoCua(kho)).toEqual([]);
  });
});

describe('§IV — ⭐⭐⭐ QUY TẮC TỰ CHIA khi mở màn: khớp ⇒ tự chia · thiếu / thừa ⇒ hỏi — và thẻ KHÔNG biến mất', () => {
  const xe = (q: Omit<QuyTac, 'tu'>): Hu => coQuyTac(tuTao({ ten: 'Xe máy', muc: 12_000_000 }, LUC, 'h-xe'), q);
  const dp = (q: Omit<QuyTac, 'tu'>): Hu => coQuyTac(tuTao({ ten: 'Dự phòng' }, LUC, 'h-dp'), q);

  it('⭐⭐⭐ KHỚP ⇒ mở màn là TỰ CHIA + THẺ KẾT QUẢ tại chỗ (không toast tự tắt); HOÀN TÁC trong thẻ gỡ cả lượt; mở lại KHÔNG chia lần hai', async () => {
    const kho = await khoMau({
      hu: [xe({ kieu: 'ngay', gt: 50_000, chayToi: '2026-09-25', moc: HOM_QUA_TOI })],
      khoan: [luongCu(1_000_000)],
    });
    const r = ve(kho);
    await waitFor(async () => expect((await phanBoCua(kho)).map((x) => [x.huId, x.soTien, x.phanBo]))
      .toEqual([['h-xe', 50_000, 'tu_dong']]));
    await waitFor(() => expect(theQuyTac()?.getAttribute('data-trang-thai')).toBe('da_chia'));
    const the = theQuyTac()!;
    expect(the).toHaveTextContent(CP.daTuChiaTieu);
    expect(the).toHaveTextContent('XE MÁY50.000');
    await nghi(HOAN_TAC_MS + 300);
    expect(theQuyTac(), 'thẻ kết quả KHÔNG tự tắt như toast 4 giây').not.toBeNull();
    fireEvent.click(within(theQuyTac()!).getByRole('button', { name: CHU_MAN_SO.nutHoanTac }));
    await waitFor(async () => expect(await phanBoCua(kho)).toEqual([]));
    await waitFor(() => expect(theQuyTac()?.getAttribute('data-trang-thai')).toBe('hoan_tac'));
    expect(theQuyTac()).toHaveTextContent(`50.000${CP.daHoanTacHau}`);
    r.unmount();
    ve(kho);
    await waitFor(() => expect(screen.getByTestId('hu-chia-tong').textContent).not.toBe(CB.dangTai));
    await nghi(50);
    expect(await phanBoCua(kho), 'hoàn tác = "hôm nay không chia"; mốc đã tiến, không chia lại').toEqual([]);
    expect(theQuyTac(), 'không còn gì đến hạn ⇒ không thẻ').toBeNull();
  });

  it('⭐⭐⭐ THỪA (lương mới về) ⇒ KHÔNG tự chia; thẻ hỏi nói đủ số; CHIA THEO QUY TẮC ⇒ đúng 50.000 + 200.000, thẻ thành KẾT QUẢ', async () => {
    const kho = await khoMau({
      hu: [
        xe({ kieu: 'ngay', gt: 50_000, chayToi: '2026-09-25', moc: HOM_QUA_TOI }),
        dp({ kieu: 'phan_tram', gt: 10, chayToi: '2026-09-25', moc: HOM_QUA_TOI }),
      ],
    });
    ve(kho);
    const the = await screen.findByTestId('the-quy-tac');
    expect(the.getAttribute('data-trang-thai')).toBe('hoi');
    expect(the.getAttribute('data-ket-qua')).toBe('thua');
    expect(the).toHaveTextContent(`${CP.thuaVaoPre}2.000.000${CP.thuaVaoHau}`);
    expect(the).toHaveTextContent(`${CP.thuaChiaPre.trim()} 250.000${CP.thuaConPre}1.605.000${CP.thuaConHau}`);
    expect(await phanBoCua(kho), 'thừa ⇒ hỏi, không tự chia').toEqual([]);
    fireEvent.click(within(the).getByRole('button', { name: `${CP.nutChiaPre}250.000${CP.nutChiaHau}` }));
    await waitFor(async () => expect((await phanBoCua(kho)).map((x) => [x.huId, x.soTien]).sort())
      .toEqual([['h-dp', 200_000], ['h-xe', 50_000]]));
    await waitFor(() => expect(theQuyTac()?.getAttribute('data-trang-thai')).toBe('da_chia'));
    expect(theQuyTac()).toHaveTextContent(CP.daChiaTieu);
    expect(theQuyTac()).toHaveTextContent(`${CP.tongChiaPre}250.000`);
  });

  it('⭐⭐⭐ THIẾU ⇒ thẻ hỏi; CHIA THEO TỈ LỆ ⇒ đúng số ví đang có', async () => {
    const kho = await khoMau({
      hu: [xe({ kieu: 'ngay', gt: 250_000, chayToi: '2026-09-25', moc: HOM_QUA_TOI })],
      khoan: [luongCu(120_000)],
    });
    ve(kho);
    const the = await screen.findByTestId('the-quy-tac');
    expect(the.getAttribute('data-ket-qua')).toBe('thieu');
    expect(the).toHaveTextContent(`${CP.thieuDenHanPre}250.000${CP.thieuConPre}120.000${CP.thieuThieuPre}130.000.`);
    fireEvent.click(within(the).getByRole('button', { name: `${CP.nutChiaPre}120.000${CP.nutTiLeHau}` }));
    await waitFor(async () => expect((await phanBoCua(kho)).map((x) => x.soTien)).toEqual([120_000]));
  });

  it('⭐⭐⭐ D421 — KHÔNG còn ✕; BỎ QUA LẦN NÀY ⇒ thẻ nói "đã bỏ qua" TẠI CHỖ, không khoản nào; mở lại màn KHÔNG hỏi lại', async () => {
    /* Founder: *"bấm dấu x cái tự chia nó cũng biến mất nữa?"*. Tiêm: `datThe(null)` sau bỏ qua ⇒ đỏ. */
    const kho = await khoMau({
      hu: [xe({ kieu: 'ngay', gt: 250_000, chayToi: '2026-09-25', moc: HOM_QUA_TOI })],
      khoan: [luongCu(120_000)],
    });
    const r = ve(kho);
    const the = await screen.findByTestId('the-quy-tac');
    expect(within(the).queryByRole('button', { name: '✕' }), 'thẻ không có nút ✕').toBeNull();
    fireEvent.click(within(the).getByRole('button', { name: CP.nutBoQua }));
    await waitFor(() => expect(theQuyTac()?.getAttribute('data-trang-thai')).toBe('bo_qua'));
    expect(theQuyTac()).toHaveTextContent(CP.daBoQuaTieu);
    expect(await phanBoCua(kho)).toEqual([]);
    r.unmount();
    ve(kho);
    await waitFor(() => expect(screen.getByTestId('hu-chia-tong').textContent).not.toBe(CB.dangTai));
    await nghi(50);
    expect(theQuyTac()).toBeNull();
    expect(await phanBoCua(kho)).toEqual([]);
  });

  it('⭐ ô hũ mang nhãn quy tắc: "⟳ 50k/ngày" (bản gọn cho ô hẹp: % chỉ "⟳ 10%")', async () => {
    ve(await khoMau({ hu: [xe({ kieu: 'ngay', gt: 50_000, chayToi: NGAY, moc: LUC })] }));
    const o = within(await screen.findByTestId('ke-phan-bo')).getByRole('button', { name: /XE MÁY/ });
    expect(o).toHaveTextContent(`${CP.tuDongDau}50k${CP.moiNgayHau}`);
  });
});

describe('§V — ⭐⭐ đang nạp là một THAO TÁC: bong bóng Oracle nhường chỗ (chỉ thị founder 06/09)', () => {
  it('⭐⭐ chưa chọn hũ ⇒ không cờ; chọn hũ ⇒ cờ lên; chạm lại (bỏ chọn) ⇒ cờ xuống; rời màn giữa chừng ⇒ nhả cờ', async () => {
    const r = ve(await khoMau());
    await screen.findByTestId('ke-phan-bo');
    expect(document.body.dataset.dangThaoTac, 'chưa chọn hũ thì không giấu gì').toBeUndefined();
    await chonHu(/XE MÁY/);
    await waitFor(() => expect(document.body.dataset.dangThaoTac).toBe('co'));
    await chonHu(/XE MÁY/);
    await waitFor(() => expect(document.body.dataset.dangThaoTac).toBeUndefined());
    await chonHu(/XE MÁY/);
    await waitFor(() => expect(document.body.dataset.dangThaoTac).toBe('co'));
    r.unmount();
    expect(document.body.dataset.dangThaoTac, 'cờ kẹt = Oracle biến mất ở mọi màn còn lại').toBeUndefined();
  });
});

describe('§VI — ⭐⭐⭐ D421 RÚT RA: tiền từ hũ tích lũy về ví — chuyển, không phải tiền vào', () => {
  /* Sổ: + THU 2.000.000 · đã nạp XE MÁY 700.000 ⇒ ví 1.300.000, hũ 700.000 = 500k + 200k. */
  const soRut = (): Khoan[] => [khoan('luong', 2_000_000, { chieu: 'thu' }), napSan('nap-xe', 'h-xe', 700_000)];

  it('⭐⭐⭐ RÚT RA ⇒ khay bày tiền CỦA HŨ; chạm 200k ⇒ một khoản THU · hũ · `tay` 200.000; hũ còn 500.000; ví tăng', async () => {
    const kho = await khoMau({ khoan: soRut() });
    ve(kho);
    await chonHu(/XE MÁY/);
    await waitFor(() => expect(screen.getByTestId('vi-con')).toHaveTextContent(`${CP.viConPre}1.300.000`));
    fireEvent.click(nutKhay(CP.huongRut));
    await waitFor(() => expect(toTrenKhay(true)).toEqual([['500k', '×1'], ['200k', '×1']]));
    expect(screen.getByTestId('hu-con')).toHaveTextContent(`${CP.huConPre}700.000${CP.loiHau}`);
    fireEvent.click(to('200.000'));
    await waitFor(async () => expect((await phanBoCua(kho)).filter((k) => k.chieu === 'thu')).toHaveLength(1));
    const rut = (await phanBoCua(kho)).find((k) => k.chieu === 'thu')!;
    expect(rut).toMatchObject({ soTien: 200_000, huId: 'h-xe', phanBo: 'tay', ngay: NGAY });
    await waitFor(() => expect(screen.getByTestId('hu-con')).toHaveTextContent(`${CP.huConPre}500.000${CP.loiHau}`));
    expect(await screen.findByText(`${CP.daRutPre}200.000${CP.daRutGiua}XE MÁY`)).toBeInTheDocument();
    fireEvent.click(nutKhay(CP.huongNap));
    await waitFor(() => expect(screen.getByTestId('vi-con')).toHaveTextContent(`${CP.viConPre}1.500.000`));
  });

  it('⭐⭐ đổi hũ ⇒ chiều về NẠP (RÚT là cú chủ ý, không mang sang hũ khác); hũ trống ⇒ RÚT nói "hũ chưa có tiền"', async () => {
    ve(await khoMau({ khoan: soRut() }));
    await chonHu(/XE MÁY/);
    fireEvent.click(await within(khay()).findByRole('button', { name: CP.huongRut }));
    await waitFor(() => expect(nutKhay(CP.huongRut)).toHaveAttribute('aria-pressed', 'true'));
    await chonHu(/TAI NGHE/);
    await waitFor(() => expect(nutKhay(CP.huongNap)).toHaveAttribute('aria-pressed', 'true'));
    fireEvent.click(nutKhay(CP.huongRut));
    await waitFor(() => expect(khay()).toHaveTextContent(CP.huTrong));
    expect(toTrenKhay(true)).toEqual([]);
  });

  it('⭐⭐ GÕ SỐ ở chiều RÚT: quá số hũ ⇒ nút RÚT tắt + nói hũ còn bao nhiêu; đúng số ⇒ một khoản rút', async () => {
    const kho = await khoMau({ khoan: soRut() });
    ve(kho);
    await chonHu(/XE MÁY/);
    fireEvent.click(await within(khay()).findByRole('button', { name: CP.huongRut }));
    fireEvent.click(await within(khay()).findByRole('button', { name: CP.goSo }));
    const go = screen.getByTestId('go-so-phan-bo');
    for (const p of ['8', '000', '000']) fireEvent.click(within(go).getByRole('button', { name: p }));
    expect((within(go).getByRole('button', { name: `${CP.rutGoPre}8.000.000` }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(go).getByRole('alert')).toHaveTextContent(`${CP.vuotHuPre}700.000${CP.vuotHuHau}`);
    for (let i = 0; i < 7; i++) fireEvent.click(within(go).getByRole('button', { name: 'Xoá một chữ số' }));
    for (const p of ['3', '000', '0', '0']) fireEvent.click(within(go).getByRole('button', { name: p }));
    fireEvent.click(within(go).getByRole('button', { name: `${CP.rutGoPre}300.000` }));
    await waitFor(async () => expect((await phanBoCua(kho)).filter((k) => k.chieu === 'thu').map((k) => k.soTien))
      .toEqual([300_000]));
  });
});

describe('§VII — ⭐⭐⭐ D424 HŨ TIÊU DÙNG: tiền chi chưa chia thành tờ, "giống thu"', () => {
  const huHaiLoai = (): Hu[] => [
    tuTao({ ten: 'Ăn uống', muc: 3_000_000, nhom: 'tieu_dung' }, LUC, 'h-an'),
    tuTao({ ten: 'Xe máy', muc: 12_000_000 }, LUC, 'h-xe'),
  ];
  const ganCua = async (kho: Kho): Promise<Khoan[]> => (await docSo(kho)).filter((k) => k.phanBo === 'gan');

  it('⭐⭐⭐ kệ có HAI nhóm — TIÊU DÙNG · THÁNG 9 trên, TÍCH LŨY dưới; khay chưa chọn nói tiền chi chưa chia 145.000', async () => {
    ve(await khoMau({ hu: huHaiLoai() }));
    const ke = await screen.findByTestId('ke-phan-bo');
    expect(within(within(ke).getByTestId('ke-tieu-dung')).getByRole('button', { name: /ĂN UỐNG/ })).toBeInTheDocument();
    expect(within(within(ke).getByTestId('ke-tich-luy')).getByRole('button', { name: /XE MÁY/ })).toBeInTheDocument();
    const chu = ke.textContent ?? '';
    expect(chu.indexOf(`${CP.keTieuDungPre}9`)).toBeGreaterThanOrEqual(0);
    expect(chu.indexOf(`${CP.keTieuDungPre}9`)).toBeLessThan(chu.indexOf(CP.keTichLuy));
    await waitFor(() => expect(screen.getByTestId('chi-con')).toHaveTextContent(`${CP.khayChiPre}145.000${CP.loiHau}`));
  });

  it('⭐⭐⭐ chọn hũ tiêu dùng ⇒ TỜ của tiền chi chưa chia (100k · 20k ×2 · 5k), CHIA VÀO / GỠ RA; chạm 20k ⇒ MỘT khoản GÁN 20.000, ví không đổi, hũ nói 20.000; HOÀN TÁC ⇒ gỡ', async () => {
    /* Founder: *"Sao phiếu chi ko làm tính năng nhập tích lũy giống thu?"* — cùng khuôn tờ của phía THU. */
    const kho = await khoMau({ hu: huHaiLoai() });
    ve(kho);
    await chonHu(/ĂN UỐNG/);
    await waitFor(() => expect(toTrenKhay(false, CP.toChia)).toEqual([['100k', '×1'], ['20k', '×2'], ['5k', '×1']]));
    expect(nutKhay(CP.huongChia)).toHaveAttribute('aria-pressed', 'true');
    expect(nutKhay(CP.huongGo)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('chi-con')).toHaveTextContent(`${CP.chiConPre}145.000${CP.loiHau}`);
    expect(within(khay()).queryByRole('button', { name: CP.huongRut }), 'không có RÚT tiền — hũ không giữ tiền').toBeNull();

    fireEvent.click(to('20.000'));
    await waitFor(async () => expect((await ganCua(kho)).map((k) => [k.huId, k.soTien, k.chieu]))
      .toEqual([['h-an', 20_000, 'chi']]));
    await waitFor(() => expect(toTrenKhay(false, CP.toChia)).toEqual([['100k', '×1'], ['20k', '×1'], ['5k', '×1']]));
    expect(screen.getByTestId('chi-con')).toHaveTextContent(`${CP.chiConPre}125.000${CP.loiHau}`);
    const o = within(screen.getByTestId('ke-phan-bo')).getByRole('button', { name: /ĂN UỐNG/ });
    await waitFor(() => expect(o).toHaveTextContent('20.000'), { timeout: 3_000 });
    expect(await screen.findByText(`${CP.daChiaPre}20.000${CP.daChiaGiua}ĂN UỐNG`)).toBeInTheDocument();
    expect((await docSo(kho)).filter((k) => k.phanBo !== 'gan'), 'không khoản chi / tiền nào mới').toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: CHU_MAN_SO.nutHoanTac }));
    await waitFor(async () => expect(await ganCua(kho)).toEqual([]));
    await waitFor(() => expect(screen.getByTestId('chi-con')).toHaveTextContent(`${CP.chiConPre}145.000`));
  });

  it('⭐⭐ ví không nhúc nhích khi chia tiền chi: CHƯA CHIA trước và sau vẫn 1.855.000', async () => {
    const kho = await khoMau({ hu: huHaiLoai() });
    ve(kho);
    await waitFor(() => expect(khay()).toHaveTextContent(`${CP.khayPre}1.855.000`));
    await chonHu(/ĂN UỐNG/);
    fireEvent.click(await within(khay()).findByRole('button', { name: new RegExp(`^${CP.toTen}100.000 `) }));
    await waitFor(async () => expect(await ganCua(kho)).toHaveLength(1));
    await chonHu(/ĂN UỐNG/);
    await waitFor(() => expect(khay()).toHaveTextContent(`${CP.khayPre}1.855.000`));
    expect(screen.getByTestId('chi-con')).toHaveTextContent(`${CP.khayChiPre}45.000`);
  });

  it('⭐⭐⭐ GỠ RA ⇒ tờ là phần hũ ĐÃ TIÊU; chạm ⇒ khoản gán chiều ngược, tiền chi chưa chia tăng lại', async () => {
    const kho = await khoMau({
      hu: huHaiLoai(),
      khoan: [...VI_MAU, taoKhoanPhanBo({ ngay: NGAY, soTien: 120_000, huId: 'h-an', phanBo: 'gan' }, LUC, 'gan-san')],
    });
    ve(kho);
    await chonHu(/ĂN UỐNG/);
    await waitFor(() => expect(screen.getByTestId('chi-con')).toHaveTextContent(`${CP.chiConPre}25.000`));
    fireEvent.click(nutKhay(CP.huongGo));
    await waitFor(() => expect(toTrenKhay(true, CP.toGo)).toEqual([['100k', '×1'], ['20k', '×1']]));
    expect(screen.getByTestId('hu-con')).toHaveTextContent(`${CP.huDaTieuPre}120.000${CP.loiHau}`);
    fireEvent.click(to('20.000'));
    await waitFor(async () => expect((await ganCua(kho)).filter((k) => k.chieu === 'thu').map((k) => k.soTien))
      .toEqual([20_000]));
    await waitFor(() => expect(screen.getByTestId('hu-con')).toHaveTextContent(`${CP.huDaTieuPre}100.000`));
    fireEvent.click(nutKhay(CP.huongChia));
    await waitFor(() => expect(screen.getByTestId('chi-con')).toHaveTextContent(`${CP.chiConPre}45.000`));
  });

  it('⭐⭐ GÕ SỐ ở hũ tiêu dùng: quá tiền chi chưa chia ⇒ nút CHIA tắt + nói còn bao nhiêu; đúng số ⇒ một khoản gán', async () => {
    const kho = await khoMau({ hu: huHaiLoai() });
    ve(kho);
    await chonHu(/ĂN UỐNG/);
    fireEvent.click(await within(khay()).findByRole('button', { name: CP.goSo }));
    const go = screen.getByTestId('go-so-phan-bo');
    for (const p of ['2', '000', '000']) fireEvent.click(within(go).getByRole('button', { name: p }));
    expect((within(go).getByRole('button', { name: `${CP.chiaGoPre}2.000.000` }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(go).getByRole('alert')).toHaveTextContent(`${CP.vuotChiPre}145.000${CP.vuotChiHau}`);
    for (let i = 0; i < 7; i++) fireEvent.click(within(go).getByRole('button', { name: 'Xoá một chữ số' }));
    for (const p of ['4', '5', '000']) fireEvent.click(within(go).getByRole('button', { name: p }));
    fireEvent.click(within(go).getByRole('button', { name: `${CP.chiaGoPre}45.000` }));
    await waitFor(async () => expect((await ganCua(kho)).map((k) => k.soTien)).toEqual([45_000]));
  });

  it('⭐⭐ chia HẾT tiền chi ⇒ "ĐÃ CHIA HẾT TIỀN CHI" và ở lại', async () => {
    ve(await khoMau({ hu: huHaiLoai(), khoan: [khoan('luong', 2_000_000, { chieu: 'thu' }), khoan('an', 45_000)] }));
    await chonHu(/ĂN UỐNG/);
    await waitFor(() => expect(toTrenKhay(false, CP.toChia)).toEqual([['20k', '×2'], ['5k', '×1']]));
    for (const tien of ['20.000', '20.000', '5.000']) {
      fireEvent.click(to(tien));
      await nghi(60);
    }
    expect(await screen.findByTestId('phan-bo-xong')).toHaveTextContent(CP.xongHetChi);
    await nghi(NHIP.PFM_ND_THO + 300);
    expect(screen.getByTestId('phan-bo-xong')).toHaveTextContent(CP.xongHetChi);
  });

  it('⭐ chỉ có hũ tiêu dùng mà tháng này chưa chi gì ⇒ khay nói chưa có tiền chi để chia, không bày tờ', async () => {
    ve(await khoMau({
      hu: [tuTao({ ten: 'Ăn uống', nhom: 'tieu_dung' }, LUC, 'h-an')],
      khoan: [khoan('luong', 500_000, { chieu: 'thu' })],
    }));
    await chonHu(/ĂN UỐNG/);
    await waitFor(() => expect(khay()).toHaveTextContent(CP.chiTrong));
    expect(screen.queryByTestId('to-khay')).toBeNull();
  });
});

describe('§VIII — số chạy · nhãn tờ · giữ chỗ (hàm thuần)', () => {
  it('⭐⭐ số chạy KHÔNG BAO GIỜ đi lùi: tiến độ âm (mốc rAF sớm) ⇒ vẫn số cũ; quá 1 ⇒ đúng số mới; đơn điệu', () => {
    expect(soChayTai(1_000_000, 1_050_000, -0.02)).toBe(1_000_000);
    expect(soChayTai(1_000_000, 1_050_000, 1.3)).toBe(1_050_000);
    let truoc = 0;
    for (let i = 0; i <= 20; i++) {
      const v = soChayTai(0, 20_000, i / 20);
      expect(v).toBeGreaterThanOrEqual(truoc);
      truoc = v;
    }
    expect(truoc).toBe(20_000);
  });

  it('nhãn tờ: gọn — 45.000 ⇒ 45k · 1.250.000 ⇒ 1,25tr · 12.500 ⇒ 12,5k · số lẻ nghìn giữ nguyên', () => {
    expect(nhanTo(45_000)).toBe('45k');
    expect(nhanTo(1_250_000)).toBe('1,25tr');
    expect(nhanTo(12_500)).toBe('12,5k');
    expect(nhanTo(1_234)).toBe('1.234');
  });

  it('⭐⭐ giữ chỗ: ô cũ đứng yên (kể cả ô hết tờ), mệnh giá MỚI xếp cuối; ô hết tờ ⇒ `dem: 0`', () => {
    const c = (...gt: number[]) => gt.map((g) => ({ gt: g, dem: 1 }));
    expect(giuCho([], c(500_000, 200_000, 5_000)), 'lượt đầu = thứ tự khay').toEqual([500_000, 200_000, 5_000]);
    expect(giuCho([500_000, 200_000, 5_000], c(500_000, 5_000)), 'hết 200k: ô vẫn ở đó').toEqual([500_000, 200_000, 5_000]);
    expect(giuCho([200_000, 5_000], c(500_000, 200_000, 5_000)), 'mệnh giá mới xếp CUỐI, không chen giữa')
      .toEqual([200_000, 5_000, 500_000]);
    expect(oTheoCho([200_000, 5_000], c(5_000))).toEqual([{ gt: 200_000, dem: 0 }, { gt: 5_000, dem: 1 }]);
  });
});
