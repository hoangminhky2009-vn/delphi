/**
 * PFM TẦNG KHÔNG GIAN — MÀN HŨ: hai bài canh mới của SPEC `pfm-tang-khong-gian` mục 4.2.
 *
 *  §I   ⭐⭐⭐ HŨ TIẾT KIỆM ≠ HŨ CHI NGAY TỪ HÌNH: tiết kiệm là BÌNH có vạch lời đoán (mực dâng), chi là PHONG BÌ cạn dần (`data-hinh="binh"` / `"phong-bi"`).
 *        Hai hình KHÔNG BAO GIỜ lẫn: mỗi hũ trên mặt đúng MỘT hình, đúng theo nhóm của nó; nhóm TIẾT KIỆM không chứa hũ chi và ngược lại. Một hũ chi vẽ thành
 *        bình sẽ nói "đang gom tới mức" cho thứ là trần tiêu một tháng — sai nghĩa mà số vẫn đúng, không gì đỏ.
 *  §II  ⭐⭐⭐ HŨ CON (một tầng, CHỈ Ở MÁY): tạo bằng lớp riêng (tên + mức do người dùng gõ — P3); tổng hũ cha = tổng hũ con + phần chưa chia (đọc thẳng từ kho);
 *        mức hũ con không vượt phần cha còn nhận; NẠP vào con đi ĐÚNG đường của hũ cha (một khoản, nối vào cha) và chỉ hũ con ghi nhớ khoản ấy; vượt ví thì nói ra,
 *        không ghi; HOÀN TÁC trả "đã góp" về nguyên. Bài lõi (kho v3, nâng cấp từ v2, không vào két): `pfm_hu_con.test.ts`.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const THANG = '2026-09';
const NGAY = '2026-09-26';
const LUC = '2026-09-26T05:00:00.000Z';

vi.mock('../src/lib/telemetry.js', () => ({ ghiDo: vi.fn(), baoLoiNen: vi.fn(), manCuaDuong: () => '/tai-chinh/hu' }));
vi.mock('../src/pfm/thoi_gian.js', async (goc) => {
  const m = await goc<typeof import('../src/pfm/thoi_gian.js')>();
  return { ...m, homNay: () => NGAY, thangNay: () => THANG };
});

const { RuotHu } = await import('../src/screens/tai-chinh/Hu');
const { KhoProvider } = await import('../src/pfm/dung_kho');
const { KhoTrongBoNho } = await import('../src/pfm/kho.js');
const { khoanRaBanGhi, taoKhoan, locKhoanSo } = await import('../src/pfm/so.js');
const { taoKhoanPhanBo } = await import('../src/pfm/phan_bo.js');
const { tuTao } = await import('../src/pfm/hu.js');
const { tongHopCha } = await import('../src/pfm/hu_con.js');
const { CHU_BENTO: CB, CHU_MAN_HU, CHU_MAN_SO } = await import('../src/lib/pfm_chu');

type Kho = InstanceType<typeof KhoTrongBoNho>;
type Khoan = import('../src/pfm/so.js').Khoan;
type HuCon = import('../src/pfm/hu_con.js').HuCon;

async function khoMau(): Promise<Kho> {
  const kho = new KhoTrongBoNho();
  const hu = [
    tuTao({ ten: 'Laptop', muc: 2_000_000 }, LUC, 'h-lap'),
    tuTao({ ten: 'Đà Lạt', muc: 5_000_000 }, LUC, 'h-dl'),
    tuTao({ ten: 'Ăn uống', muc: 3_000_000, nhom: 'tieu_dung' }, LUC, 'h-an'),
    tuTao({ ten: 'Đi lại', muc: 800_000, nhom: 'tieu_dung' }, LUC, 'h-di'),
  ];
  for (const h of hu) await kho.ghi('hu', { id: h.id, thang: THANG, suaLuc: LUC, d: h });
  const ghi = async (k: Khoan) => kho.ghi('khoan', khoanRaBanGhi(k));
  await ghi(taoKhoan({ ngay: `${THANG}-02`, soTien: 3_000_000, chieu: 'thu' }, LUC, 'thu1'));
  await ghi(taoKhoanPhanBo({ ngay: `${THANG}-03`, soTien: 500_000, huId: 'h-lap', phanBo: 'tay' }, LUC, 'nap1'));
  await ghi(taoKhoanPhanBo({ ngay: `${THANG}-04`, soTien: 45_000, huId: 'h-an', phanBo: 'gan' }, LUC, 'gan1'));
  return kho;
}

function ve(kho: Kho) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/tai-chinh/hu']}>
      <QueryClientProvider client={qc}><KhoProvider kho={kho}><RuotHu /></KhoProvider></QueryClientProvider>
    </MemoryRouter>,
  );
}
afterEach(() => { vi.unstubAllGlobals(); });

const choHuTai = (): Promise<void> => waitFor(() => {
  expect(screen.getByTestId('hu-chia-tong').textContent, 'hũ vẫn đang tải').not.toBe(CB.dangTai);
});
const oTheo = (dau: string): Promise<HTMLElement> => waitFor(() => {
  const e = document.querySelector<HTMLElement>(`[data-o="${dau}"]`);
  expect(e, `ô ${dau}`).not.toBeNull();
  return e!;
});
async function moHu(ten: string) {
  await choHuTai();
  const e = await waitFor(() => {
    const t = [...document.querySelectorAll<HTMLElement>('[data-o="hu-con-hu"], [data-o="hu-uu-tien"]')]
      .find((x) => (x.textContent ?? '').includes(ten));
    expect(t, `không thấy hũ "${ten}"`).toBeTruthy();
    return t!;
  });
  fireEvent.click(e);
  return within(await screen.findByRole('dialog'));
}
const docCon = async (kho: Kho): Promise<HuCon[]> => (await kho.liet<HuCon>('hu_con')).map((b) => b.d);
const docSo = async (kho: Kho): Promise<Khoan[]> => locKhoanSo((await kho.liet<Khoan>('khoan')).map((b) => b.d));

/* ═══ §I — hình ═══════════════════════════════════════════════════════════════════════════════════ */

describe('§I — ⭐⭐⭐ hũ TIẾT KIỆM là BÌNH, hũ CHI là PHONG BÌ — không bao giờ lẫn hình', () => {
  it('⭐⭐⭐ mỗi hũ trên mặt có ĐÚNG MỘT hình, đúng theo nhóm: tiết kiệm → `binh`, chi → `phong-bi`', async () => {
    ve(await khoMau());
    await choHuTai();
    const NHOM: Record<string, 'binh' | 'phong-bi'> = { 'h-lap': 'binh', 'h-dl': 'binh', 'h-an': 'phong-bi', 'h-di': 'phong-bi' };
    const trenMat = [...document.querySelectorAll<HTMLElement>('[data-hu]')];
    expect(trenMat.length, 'cảnh phải có hũ trên mặt — không thì bài so danh sách rỗng').toBeGreaterThanOrEqual(4);
    for (const o of trenMat) {
      const hinh = [...o.querySelectorAll<HTMLElement>('[data-hinh]')].map((e) => e.dataset.hinh);
      expect(hinh, `hũ ${o.dataset.hu}: đúng MỘT hình`).toHaveLength(1);
      expect(hinh[0], `hũ ${o.dataset.hu}`).toBe(NHOM[o.dataset.hu!]);
    }
  });

  it('⭐⭐ nhóm TIẾT KIỆM chỉ chứa hũ tiết kiệm; nhóm CHI chỉ chứa hũ chi (đếm theo tên)', async () => {
    ve(await khoMau());
    await choHuTai();
    const tk = await oTheo('hu-nhom-tk');
    const chi = await oTheo('hu-nhom-chi');
    for (const ten of ['Laptop', 'Đà Lạt']) { expect(tk.textContent).toContain(ten); expect(chi.textContent).not.toContain(ten); }
    for (const ten of ['Ăn uống', 'Đi lại']) { expect(chi.textContent).toContain(ten); expect(tk.textContent).not.toContain(ten); }
    expect(tk.querySelectorAll('[data-hinh="phong-bi"]')).toHaveLength(0);
    expect(chi.querySelectorAll('[data-hinh="binh"]')).toHaveLength(0);
  });

  it('⭐ chỉ có hũ CHI ⇒ ô ★ cũng là PHONG BÌ (không mượn bình); chưa hũ nào ⇒ ô mời tạo, không hình giả', async () => {
    const kho = new KhoTrongBoNho();
    const h = tuTao({ ten: 'Ăn uống', muc: 3_000_000, nhom: 'tieu_dung' }, LUC, 'h-an');
    await kho.ghi('hu', { id: h.id, thang: THANG, suaLuc: LUC, d: h });
    const v = ve(kho);
    await choHuTai();
    const sao = await oTheo('hu-uu-tien');
    expect(sao.querySelector('[data-hinh="phong-bi"]')).not.toBeNull();
    expect(sao.querySelector('[data-hinh="binh"]')).toBeNull();
    v.unmount();
    ve(new KhoTrongBoNho());
    await choHuTai();
    const rong = await oTheo('hu-rong');
    expect(rong.querySelector('[data-hinh]'), 'chưa có hũ ⇒ không vẽ bình/phong bì giả').toBeNull();
  });

  it('⭐⭐ hũ chưa đặt mức: bình KHÔNG có mực (không phải 0%) — "chưa đủ để vẽ", mực chỉ khi biết tiến độ (D62)', async () => {
    const kho = new KhoTrongBoNho();
    const h = tuTao({ ten: 'Quỹ' }, LUC, 'h-q');
    await kho.ghi('hu', { id: h.id, thang: THANG, suaLuc: LUC, d: h });
    ve(kho);
    await choHuTai();
    const sao = await oTheo('hu-uu-tien');
    await waitFor(() => expect(sao.textContent ?? '').toContain('Quỹ'));
    expect(sao.querySelector('[data-hinh="binh"]')).not.toBeNull();
    expect(sao.querySelector('[data-muc-hu]'), 'chưa mức ⇒ không lớp mực').toBeNull();
    expect(sao.textContent).not.toMatch(/(^|[^\d])0%/);
  });
});

/* ═══ §II — hũ con ════════════════════════════════════════════════════════════════════════════════ */

describe('§II — ⭐⭐⭐ HŨ CON: tạo · tổng cha = tổng con (+ chưa chia) · NẠP đi đường của cha · HOÀN TÁC', () => {
  async function taoCon(lop: ReturnType<typeof within>, ten: string, muc: string): Promise<void> {
    fireEvent.click(await lop.findByTestId('hu-them-con'));
    fireEvent.change(await screen.findByTestId('con-ten'), { target: { value: ten } });
    fireEvent.change(screen.getByLabelText(CHU_MAN_HU.mucOTen), { target: { value: muc } });
    fireEvent.click(await oTheo('con-tao'));   // nút chính trễ một nhịp phụt hạt
  }

  it('⭐⭐⭐ tạo hũ con: tên + mức do người dùng gõ ⇒ ĐÚNG một bản ghi `hu_con` nối hũ cha; lớp quay về hũ cha và liệt kê nó', async () => {
    const kho = await khoMau();
    ve(kho);
    const lop = await moHu('Laptop');
    await taoCon(lop, 'Vé xe', '300000');
    await waitFor(async () => expect(await docCon(kho)).toHaveLength(1));
    const [con] = await docCon(kho);
    expect(con).toMatchObject({ chaId: 'h-lap', ten: 'Vé xe', muc: 300_000, khoanIds: [] });
    // Lớp quay về hũ cha: có dòng hũ con; phần "chưa chia" = tổng cha (500k) vì con chưa nhận gì.
    const dong = await screen.findByTestId('hu-con-hang');
    expect(dong).toHaveTextContent('Vé xe');
    expect(screen.getByTestId('hu-chua-chia')).toHaveTextContent('500k');
  });

  it('⭐⭐⭐ P3 🔒 + luật tổng: thiếu mức / mức vượt phần cha còn nhận ⇒ NÓI RA, không ghi gì; hai con cộng mức ≤ mức cha', async () => {
    const kho = await khoMau();
    ve(kho);
    const lop = await moHu('Laptop');
    // Thiếu mức: ô trống (app không điền hộ).
    fireEvent.click(await lop.findByTestId('hu-them-con'));
    fireEvent.change(await screen.findByTestId('con-ten'), { target: { value: 'A' } });
    fireEvent.click(await oTheo('con-tao'));
    expect(await screen.findByText(CB.huConThieuMuc)).toBeInTheDocument();
    expect(await docCon(kho)).toHaveLength(0);
    // Vượt mức cha (2.000.000): 2.500.000 ⇒ lỗi do lõi (`LoiHuCon`) được nói ra.
    fireEvent.change(screen.getByLabelText(CHU_MAN_HU.mucOTen), { target: { value: '2500000' } });
    fireEvent.click(await oTheo('con-tao'));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getAllByRole('alert').length).toBeGreaterThan(0));
    expect(await docCon(kho)).toHaveLength(0);
    // Một con 1.500.000 được; con thứ hai 600.000 làm Σ mức con (2,1tr) > mức cha (2tr) ⇒ từ chối.
    fireEvent.change(screen.getByLabelText(CHU_MAN_HU.mucOTen), { target: { value: '1500000' } });
    fireEvent.click(await oTheo('con-tao'));
    await waitFor(async () => expect(await docCon(kho)).toHaveLength(1));
    const lop2 = within(await screen.findByRole('dialog'));
    await taoCon(lop2, 'B', '600000');
    await waitFor(() => expect(within(screen.getByRole('dialog')).getAllByRole('alert').length).toBeGreaterThan(0));
    expect(await docCon(kho), 'con thứ hai vượt tổng mức cha ⇒ không ghi').toHaveLength(1);
    const cha = (await kho.doc<import('../src/pfm/hu.js').Hu>('hu', 'h-lap'))!.d;
    const cons = await docCon(kho);
    expect(cons.reduce((a, c) => a + c.muc, 0), 'Σ mức con ≤ mức cha').toBeLessThanOrEqual(cha.muc!);
  });

  it('⭐⭐⭐ NẠP vào hũ con: ĐÚNG một khoản (nối hũ CHA, dấu `tay`), hũ con nhớ khoản ấy; TỔNG CHA = TỔNG CON + CHƯA CHIA đọc từ kho; HOÀN TÁC trả về', async () => {
    const kho = await khoMau();
    const con: HuCon = { id: 'c1', chaId: 'h-lap', ten: 'Vé xe', muc: 300_000, khoanIds: [], taoLuc: LUC };
    await kho.ghi('hu_con', { id: 'c1', thang: THANG, suaLuc: LUC, d: con });
    ve(kho);
    const lop = await moHu('Laptop');
    fireEvent.click(await lop.findByTestId('hu-con-hang'));
    await screen.findByTestId('con-so');
    // Gõ 100.000 trên bàn phím số của lớp.
    for (const d of ['1', '0', '0', '0', '0', '0']) fireEvent.click(screen.getByRole('button', { name: d === '0' ? '0' : d }));
    expect(screen.getByTestId('con-go')).toHaveTextContent(`100.000${CHU_MAN_SO.hauDong}`);
    const truoc = (await docSo(kho)).length;
    fireEvent.click(await oTheo('con-nap'));
    await waitFor(async () => expect(await docSo(kho)).toHaveLength(truoc + 1));

    const khoan = (await docSo(kho)).find((k) => k.id !== 'thu1' && k.id !== 'nap1' && k.id !== 'gan1')!;
    expect(khoan).toMatchObject({ soTien: 100_000, huId: 'h-lap', phanBo: 'tay', chieu: 'chi' });
    const conSau = (await docCon(kho))[0]!;
    expect(conSau.khoanIds, 'hũ con chỉ GHI NHỚ khoản — không cất số tiền').toEqual([khoan.id]);
    expect(conSau).not.toHaveProperty('daGop');
    await waitFor(() => expect(screen.getByTestId('con-so')).toHaveTextContent(`100.000${CHU_MAN_SO.hauDong}`));

    // Đẳng thức: tổng cha (500k + 100k) = Σ con (100k) + chưa chia (500k).
    const cha = (await kho.doc<import('../src/pfm/hu.js').Hu>('hu', 'h-lap'))!.d;
    const t = tongHopCha(cha, await docCon(kho), await docSo(kho), THANG);
    expect(t.tongCha).toBe(600_000);
    expect(t.tongCon).toBe(100_000);
    expect(t.chuaChia).toBe(500_000);
    expect(t.tongCon + t.chuaChia, 'tổng cha = tổng con + chưa chia').toBe(t.tongCha);

    // HOÀN TÁC (cửa sổ 4 giây): khoản bị gỡ, "đã góp" của con về 0, đẳng thức vẫn đúng.
    const lui = await screen.findByTestId('con-lui');
    fireEvent.click(within(lui).getByRole('button', { name: CHU_MAN_SO.nutHoanTac }));
    await waitFor(async () => expect((await docSo(kho)).some((k) => k.id === khoan.id)).toBe(false));
    await waitFor(() => expect(screen.getByTestId('con-so')).toHaveTextContent(`0${CHU_MAN_SO.hauDong}`));
    const t2 = tongHopCha(cha, await docCon(kho), await docSo(kho), THANG);
    expect(t2.tongCon + t2.chuaChia).toBe(t2.tongCha);
    expect(t2.tongCha).toBe(500_000);
  });

  it('⭐⭐ gõ QUÁ ví còn ⇒ NÓI RA + nút NẠP tắt, không ghi gì', async () => {
    const kho = await khoMau();
    await kho.ghi('hu_con', { id: 'c1', thang: THANG, suaLuc: LUC, d: { id: 'c1', chaId: 'h-lap', ten: 'Vé xe', muc: 300_000, khoanIds: [], taoLuc: LUC } satisfies HuCon });
    ve(kho);
    const lop = await moHu('Laptop');
    fireEvent.click(await lop.findByTestId('hu-con-hang'));
    await screen.findByTestId('con-so');
    // Ví = 3.000.000 − 500.000 (đã nạp) = 2.500.000 ⇒ gõ 3.000.000 là vượt.
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    for (let i = 0; i < 2; i += 1) fireEvent.click(screen.getByRole('button', { name: '000' }));
    expect(screen.getByTestId('con-go')).toHaveTextContent(`3.000.000${CHU_MAN_SO.hauDong}`);
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(CB.huConVuotPre.trim());
    expect(await oTheo('con-nap')).toBeDisabled();
    const n = (await docSo(kho)).length;
    fireEvent.click(await oTheo('con-nap'));
    await new Promise((r) => { setTimeout(r, 250); });
    expect((await docSo(kho)).length, 'vượt ví ⇒ không ghi').toBe(n);
  });
});
