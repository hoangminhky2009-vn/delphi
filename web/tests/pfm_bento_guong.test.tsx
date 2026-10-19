/**
 * PFM TẦNG KHÔNG GIAN — GƯƠNG & THẺ: bài canh của hai lời hứa founder (11/10, "A A A"):
 *
 *  §I   ⭐⭐⭐ PHÂN TÍCH KHÔNG NHÃN NGUỒN: mặt GƯƠNG và MỌI lớp của nó — KỂ CẢ lớp HƯỚNG (founder 11/10: luật "không nói nguồn dữ liệu" áp cả tấm HƯỚNG, khớp demo) — không
 *        mang nhãn NÓI · SỔ · TRẬN, tiêu đề "NÓI · LÀM · TRONG TRẬN" hay hai tiêu đề nhóm cũ; và THẺ › ĐỘ NHẤT QUÁN cũng vậy. Có ĐỐI CHỨNG DƯƠNG: bảng cũ
 *        (không `gonNguon`) CÓ những nhãn ấy — để bộ dò không bao giờ xanh vì dò sai chỗ.
 *  §II  ⭐⭐⭐ THIẾU MẪU LÀ "CHƯA ĐỦ ĐỂ NÓI", KHÔNG BAO GIỜ 0 (D62/P7) trên mặt GƯƠNG & THẺ rỗng.
 *  §III ⭐⭐ có dữ liệu thì mặt GƯƠNG nói ĐÚNG số của lõi: "N cặp đủ", vòng TIỀN VÀO ĐI ĐÂU chỉ vẽ từ khúc dương (tổng 360°).
 *
 * Đồng hồ giữ cố định (nếp `pfm_man_guong.test.tsx`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const THANG = '2026-09';
const NGAY = '2026-09-15';
const LUC = '2026-09-15T10:00:00.000Z';

vi.mock('../src/lib/telemetry.js', () => ({ ghiDo: vi.fn(), baoLoiNen: vi.fn(), manCuaDuong: () => '/tai-chinh/guong' }));
vi.mock('../src/pfm/thoi_gian.js', async (goc) => {
  const m = await goc<typeof import('../src/pfm/thoi_gian.js')>();
  return { ...m, homNay: () => NGAY, thangNay: () => THANG };
});

const { RuotGuong } = await import('../src/screens/tai-chinh/Guong');
const { RuotChanDung } = await import('../src/screens/tai-chinh/ChanDungPfm');
const { MatBaMat, dungBaMat } = await import('../src/screens/tai-chinh/BaMat');
const { KhoProvider } = await import('../src/pfm/dung_kho');
const { KhoTrongBoNho } = await import('../src/pfm/kho.js');
const { khoanRaBanGhi, taoKhoan } = await import('../src/pfm/so.js');
const { suaHoSo } = await import('../src/pfm/ho_so.js');
const { tongLoiDoan } = await import('../src/pfm/vi_the.js');
const { CHU_BENTO: CB, CHU_BIEU_DO: B, CHU_HUONG: H, CHU_VI_THE: CV } = await import('../src/lib/pfm_chu');

type Kho = InstanceType<typeof KhoTrongBoNho>;
type HoSo = import('../src/pfm/ho_so.js').HoSo;

/* ═══ dựng cảnh ═══════════════════════════════════════════════════════════════════════════════ */

const DA_PHONG_VAN: HoSo = { lucTienVe: 'cất một phần đi', sauKhiTieu: 'nhẩm lại giá', dauThang: 'đại khái', nhip: ['lúc vừa có tiền'] };

async function khoCo(coSo: boolean, hoSo: HoSo = {}): Promise<Kho> {
  const kho = new KhoTrongBoNho();
  if (coSo) {
    let i = 0;
    const ghi = async (ngay: string, soTien: number, chieu: 'chi' | 'thu' = 'chi') =>
      kho.ghi('khoan', khoanRaBanGhi(taoKhoan({ ngay, soTien, chieu }, `${ngay}T05:00:00.000Z`, `k${i++}`)));
    await ghi(`${THANG}-02`, 6_000_000, 'thu');
    for (let d = 1; d <= 14; d++) await ghi(`${THANG}-${String(d).padStart(2, '0')}`, d % 3 === 0 ? 400_000 : 60_000);
  }
  if (Object.keys(hoSo).length > 0) await suaHoSo(kho, (cu) => ({ ...cu, ...hoSo }), LUC);
  return kho;
}

function stubMang(): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const dap = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.includes('/auth/me')) {
      return dap(200, {
        email: 'a@b.c', email_verified: true, onboarded: true, user: null,
        pfm: { consent: true, tuan: '2026-W37', tuan_da_niem_phong: false, tuan_token_thuong: 0, tuan_so_ngay_co_mat: 6 },
      });
    }
    if (url.includes('/me/nang-luc')) return dap(404, { error: 'not_found' });
    return dap(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
  }));
}
beforeEach(() => { stubMang(); });
afterEach(() => { vi.unstubAllGlobals(); });

function ve(kho: Kho, man: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/tai-chinh/guong']}>
      <QueryClientProvider client={qc}><KhoProvider kho={kho}>{man}</KhoProvider></QueryClientProvider>
    </MemoryRouter>,
  );
}

const oTheo = (dau: string): Promise<HTMLElement> => waitFor(() => {
  const e = document.querySelector<HTMLElement>(`[data-o="${dau}"]`);
  expect(e, `ô ${dau}`).not.toBeNull();
  return e!;
});

/** Mọi nhãn NGUỒN của bảng ba mặt cũ — suy từ CHÍNH bảng chữ, không gõ tay (một nguồn). */
const NHAN_NGUON = [B.tagNoi, B.tagSo, B.tagTran] as const;
const TIEU_DE_CU = [B.nhomNoiSo, B.nhomTranDoi, B.napBaMat] as const;

/** Nhãn nguồn trong MỘT cây: phần tử có chữ ĐÚNG BẰNG một nhãn (nhãn là chip riêng), hoặc chữ chứa một tiêu đề cũ. */
function nhanNguonTrong(goc: ParentNode): string[] {
  const ra: string[] = [];
  goc.querySelectorAll<HTMLElement>('*').forEach((e) => {
    const rieng = [...e.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? '').join('').trim();
    if ((NHAN_NGUON as readonly string[]).includes(rieng)) ra.push(`nhãn "${rieng}"`);
  });
  const chu = (goc as HTMLElement).textContent ?? '';
  for (const t of TIEU_DE_CU) if (chu.includes(t)) ra.push(`tiêu đề "${t}"`);
  return ra;
}

/* ═══ §I — không nhãn nguồn ═══════════════════════════════════════════════════════════════════════ */

describe('§I — ⭐⭐⭐ PHÂN TÍCH KHÔNG NHÃN NGUỒN (mặt GƯƠNG · MỌI lớp kể cả HƯỚNG · THẺ › ĐỘ NHẤT QUÁN)', () => {
  it('⭐⭐⭐ ĐỐI CHỨNG DƯƠNG: bảng ba mặt CŨ (không `gonNguon`) CÓ nhãn NÓI · SỔ · tiêu đề nhóm — bộ dò thật sự bắt được', async () => {
    const kho = await khoCo(true, DA_PHONG_VAN);
    const tatCa = (await kho.liet<import('../src/pfm/so.js').Khoan>('khoan')).map((b) => b.d);
    const { container } = render(
      <MemoryRouter>
        <MatBaMat so={dungBaMat(tatCa, [], NGAY, THANG)} hoSo={DA_PHONG_VAN} noiGame={false} nl={undefined} tongDoan={tongLoiDoan([], [], THANG)} thang={THANG} />
      </MemoryRouter>,
    );
    const bat = nhanNguonTrong(container);
    expect(bat.some((x) => x.startsWith('nhãn')), `bộ dò không thấy nhãn nào trên bảng cũ: ${bat.join(' · ')}`).toBe(true);
    expect(bat.some((x) => x.includes(B.nhomNoiSo)), 'bảng cũ có tiêu đề nhóm "BẠN NÓI ↔ SỔ GHI"').toBe(true);
  });

  it('⭐⭐⭐ mặt GƯƠNG (sổ đủ + đã phỏng vấn): không nhãn nguồn nào', async () => {
    ve(await khoCo(true, DA_PHONG_VAN), <RuotGuong />);
    const o = await oTheo('guong-doan-that');
    await waitFor(() => expect(o.textContent ?? '').not.toContain(CB.dangTai));
    expect(nhanNguonTrong(document.body), 'mặt GƯƠNG').toEqual([]);
  });

  it('⭐⭐⭐ MỌI lớp của GƯƠNG kể cả HƯỚNG: không nhãn nguồn nào (mở lần lượt như người dùng)', async () => {
    ve(await khoCo(true, DA_PHONG_VAN), <RuotGuong />);
    await waitFor(async () => expect((await oTheo('guong-doan-that')).textContent ?? '').not.toContain(CB.dangTai));
    const LOP = ['huong', 'doan-that', 'ket-toan', 'tien-vao', 'chi-ngay', 'phan-tich', 'thoi-quen', 'luat', 'sau-thang', 'nhin-lai', 'tien-toi'];
    for (const dau of LOP) {
      fireEvent.click(await oTheo(`guong-${dau}`));
      const hop = await screen.findByRole('dialog');
      await waitFor(() => expect(hop.textContent ?? '').not.toBe(''));
      expect(nhanNguonTrong(hop), `lớp ${dau}`).toEqual([]);
    }
  });

  it('⭐⭐⭐ tấm HƯỚNG: có dòng HỌC (từ sổ lẫn từ lời kể) mà KHÔNG dòng nào mang chip nguồn; lời giải thích không nhắc "nhãn NÓI"', async () => {
    ve(await khoCo(true, DA_PHONG_VAN), <RuotGuong />);
    fireEvent.click(await oTheo('guong-huong'));
    const the = await screen.findByTestId('the-huong');
    await waitFor(() => expect(the.querySelectorAll('[data-testid^="hoc-"]:not([data-testid="hoc-rong"]):not([data-testid="hoc-noi-kem"])').length).toBeGreaterThan(0));
    expect(nhanNguonTrong(the), 'chip nguồn trên dòng học').toEqual([]);
    for (const nut of the.querySelectorAll<HTMLElement>('button[aria-expanded]')) fireEvent.click(nut);
    expect(the.textContent ?? '', 'lời giải thích không được nói tới nhãn nguồn').not.toMatch(/nhãn NÓI|nhãn SỔ/);
  });

  it('⭐⭐⭐ lớp ĐOÁN ↔ THẬT dùng đúng hai nhãn trung tính "BẠN NGHĨ / THỰC TẾ", và cuối lớp có chú thích trung tính', async () => {
    ve(await khoCo(true, DA_PHONG_VAN), <RuotGuong />);
    fireEvent.click(await oTheo('guong-doan-that'));
    const hop = within(await screen.findByRole('dialog'));
    expect((await hop.findAllByText(CB.guBanNghi)).length, 'mỗi cặp có nhãn BẠN NGHĨ').toBeGreaterThanOrEqual(1);
    expect(hop.getAllByText(CB.guThucTe).length).toBeGreaterThanOrEqual(1);
    for (const nhan of NHAN_NGUON) expect(hop.queryByText(nhan)).toBeNull();
  });

  it('⭐⭐⭐ CỤM TỪ NGUỒN (SPEC: `NÓI|LÀM|TRẬN|bạn khai|sổ ghi|đọc từ`) không còn ở chữ nào của GƯƠNG · HƯỚNG · THẺ — trừ các chỗ KHAI MIỄN đích danh bên dưới', async () => {
    /* ⚠ KHAI MIỄN theo (tệp, tên), không theo tên trần: mỗi mục là một chuỗi người chơi THẤY mà SPEC cho giữ.
         · `TheHuong.tsx` · `H.lamToi` = chip kết quả "LÀM TỚI" của dải TUẦN TRƯỚC (kết quả của việc bạn làm, không phải nhãn nguồn);
         · THẺ · chip "dựng từ câu trả lời · chưa phải từ sổ" (demo bản 6 có, CHỐT) — không khớp regex nên không cần miễn, ghi để rõ ý;
         · CĂN CỨ (THẺ) — không khớp regex. */
    const NGUON = /NÓI|LÀM|TRẬN|bạn khai|sổ ghi|đọc từ/;
    const MIEN: string[] = [H.lamToi];
    const sach = (chu: string): string => MIEN.reduce((a, m) => a.split(m).join(' '), chu);
    // (a) hai chuỗi người dùng vừa chỉ đích danh
    expect(CB.guPhanTichTag, 'tag lớp PHÂN TÍCH').not.toMatch(NGUON);
    expect(CB.guPhanTichTag).toBe('những gì bạn làm, đặt cạnh nhau');
    expect(CV.lungNacPre, 'NHÌN LẠI "Bạn khai: …"').not.toMatch(NGUON);
    expect(CV.lungNacPre).toBe('Bạn nghĩ: ');
    // (b) chữ THẬT trên màn: mặt GƯƠNG + từng lớp
    ve(await khoCo(true, DA_PHONG_VAN), <RuotGuong />);
    await waitFor(async () => expect((await oTheo('guong-doan-that')).textContent ?? '').not.toContain(CB.dangTai));
    expect(sach(document.body.textContent ?? ''), 'mặt GƯƠNG').not.toMatch(NGUON);
    const LOP = ['huong', 'doan-that', 'ket-toan', 'tien-vao', 'chi-ngay', 'phan-tich', 'thoi-quen', 'luat', 'sau-thang', 'nhin-lai', 'tien-toi'];
    for (const dau of LOP) {
      fireEvent.click(await oTheo(`guong-${dau}`));
      const hop = await screen.findByRole('dialog');
      await waitFor(() => expect(hop.textContent ?? '').not.toBe(''));
      expect(sach(hop.textContent ?? ''), `lớp ${dau}`).not.toMatch(NGUON);
    }
  });

  it('⭐⭐⭐ THẺ: mặt + lớp ĐỘ NHẤT QUÁN không còn cụm từ nguồn (chip "dựng từ câu trả lời · chưa phải từ sổ" của THẺ là chữ CHỐT của demo bản 6, không khớp bộ quét)', async () => {
    const NGUON = /NÓI|LÀM|TRẬN|bạn khai|sổ ghi|đọc từ/;
    ve(await khoCo(true, DA_PHONG_VAN), <RuotChanDung />);
    await waitFor(() => expect(screen.getByTestId('the-can-cu').textContent).not.toBe('—'));
    expect(document.body.textContent ?? '', 'mặt THẺ').not.toMatch(NGUON);
    fireEvent.click(await oTheo('the-nhat-quan'));
    const hop = await screen.findByRole('dialog');
    await within(hop).findByTestId('mat-ba-mat');
    expect(hop.textContent ?? '', 'lớp ĐỘ NHẤT QUÁN').not.toMatch(NGUON);
  });

  it('⭐⭐ ĐỐI CHỨNG DƯƠNG của bộ quét cụm từ: chữ cũ "đọc từ chính sổ của bạn" / "Bạn khai: " BỊ bắt', () => {
    const NGUON = /NÓI|LÀM|TRẬN|bạn khai|sổ ghi|đọc từ/;
    expect('đọc từ chính sổ của bạn').toMatch(NGUON);
    expect('Bạn khai: ').not.toMatch(NGUON);            // "Bạn" viết hoa: vì vậy bài trên so cả `toBe('Bạn nghĩ: ')`
    expect('bạn khai: ').toMatch(NGUON);
  });

  it('⭐⭐⭐ THẺ › ĐỘ NHẤT QUÁN: cũng không nhãn nguồn (dùng chung bảng, bật `gonNguon`)', async () => {
    ve(await khoCo(true, DA_PHONG_VAN), <RuotChanDung />);
    await waitFor(() => expect(screen.getByTestId('the-can-cu').textContent).not.toBe('—'));
    fireEvent.click(await oTheo('the-nhat-quan'));
    const hop = await screen.findByRole('dialog');
    await within(hop).findByTestId('mat-ba-mat');
    expect(nhanNguonTrong(hop), 'lớp ĐỘ NHẤT QUÁN').toEqual([]);
    expect(nhanNguonTrong(document.body), 'mặt THẺ').toEqual([]);
  });
});

/* ═══ §II — D62 ═══════════════════════════════════════════════════════════════════════════════════ */

describe('§II — ⭐⭐⭐ THIẾU MẪU ⇒ "chưa đủ để nói", KHÔNG BAO GIỜ 0 (D62/P7)', () => {
  const KHONG_SO_0 = /(^|[^\d.,])0\s?%|(^|[^\d.,])0\/\d|\b0 cặp/;

  it('⭐⭐⭐ GƯƠNG sổ rỗng: mặt nói "chưa đủ để nói", không "0%", không "0/4 cặp"; vòng TIỀN VÀO ĐI ĐÂU không vẽ vòng giả', async () => {
    ve(await khoCo(false), <RuotGuong />);
    const o = await oTheo('guong-doan-that');
    await waitFor(() => expect(o.textContent ?? '').not.toContain(CB.dangTai));
    expect(document.body.textContent ?? '').not.toMatch(KHONG_SO_0);
    expect(o.textContent).toContain(CB.chuaDuDeNoi);
    const tienVao = await oTheo('guong-tien-vao');
    expect(tienVao.textContent).toContain(CB.chuaDuDeNoi);
    expect(tienVao.querySelector('[data-testid="guong-vong"]'), 'không dữ liệu ⇒ không vòng').toBeNull();
  });

  it('⭐⭐ ô NHÌN LẠI không có câu nào ⇒ nói "chưa đủ để nói" (KHÔNG treo "đang tải" mãi) và lớp của nó nói cùng câu', async () => {
    ve(await khoCo(false), <RuotGuong />);
    const o = await oTheo('guong-nhin-lai');
    await waitFor(() => expect(o.textContent ?? '').toContain(CB.chuaDuDeNoi));
    expect(o.textContent).not.toContain(CB.dangTai);
    fireEvent.click(o);
    expect(await screen.findByTestId('nhin-lai-trong')).toHaveTextContent(CB.chuaDuDeNoi);
  });

  it('⭐⭐ mọi lớp của GƯƠNG sổ rỗng: không số 0 đứng làm kết quả đo', async () => {
    ve(await khoCo(false), <RuotGuong />);
    await waitFor(async () => expect((await oTheo('guong-doan-that')).textContent ?? '').not.toContain(CB.dangTai));
    for (const dau of ['doan-that', 'ket-toan', 'tien-vao', 'phan-tich', 'thoi-quen', 'sau-thang', 'tien-toi']) {
      fireEvent.click(await oTheo(`guong-${dau}`));
      const hop = await screen.findByRole('dialog');
      await waitFor(() => expect(hop.textContent ?? '').not.toBe(''));
      expect(hop.textContent ?? '', `lớp ${dau}`).not.toMatch(KHONG_SO_0);
    }
  });

  it('⭐⭐⭐ THẺ chưa phỏng vấn: các ô số nói "—"/"chưa đủ", không 0', async () => {
    ve(await khoCo(false, DA_PHONG_VAN), <RuotChanDung />);
    await oTheo('the-nhat-quan');
    await waitFor(() => expect(document.body.textContent ?? '').not.toContain('đang tải'));
    expect(document.body.textContent ?? '').not.toMatch(KHONG_SO_0);
  });
});

/* ═══ §III — có dữ liệu ═══════════════════════════════════════════════════════════════════════════ */

describe('§III — ⭐⭐ có dữ liệu ⇒ mặt GƯƠNG nói đúng số của lõi', () => {
  it('⭐⭐ ô ĐOÁN ↔ THẬT đếm "N/4 cặp đủ" bằng ĐÚNG phép đếm của `capDoiChieu` (cặp đủ hai phía)', async () => {
    const kho = await khoCo(true, DA_PHONG_VAN);
    const tatCa = (await kho.liet<import('../src/pfm/so.js').Khoan>('khoan')).map((b) => b.d);
    const { capDoiChieu, capDu } = await import('../src/screens/tai-chinh/BaMat');
    const mong = capDoiChieu(dungBaMat(tatCa, [], NGAY, THANG), DA_PHONG_VAN).filter(capDu).length;
    expect(mong, 'cảnh phải có cặp đủ — không thì bài đếm số không').toBeGreaterThan(0);
    ve(kho, <RuotGuong />);
    const o = await oTheo('guong-doan-that');
    await waitFor(() => expect(o.textContent ?? '').toContain(`${mong}/4${CB.guCapDu}`));
  });

  it('⭐⭐ vòng TIỀN VÀO ĐI ĐÂU: có dữ liệu ⇒ có vòng, nền `conic-gradient` các đoạn LIỀN NHAU từ 0% tới đúng 100% (khép kín)', async () => {
    ve(await khoCo(true, DA_PHONG_VAN), <RuotGuong />);
    const vong = await screen.findByTestId('guong-vong');
    const nen = vong.getAttribute('style') ?? '';
    expect(nen).toMatch(/conic-gradient/);
    const doan = [...nen.matchAll(/(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
    expect(doan.length, 'ít nhất hai khúc dương trong cảnh').toBeGreaterThanOrEqual(2);
    expect(doan[0]![0]).toBe(0);
    for (let i = 1; i < doan.length; i++) expect(doan[i]![0], `đoạn ${i} bắt đầu đúng chỗ đoạn trước kết thúc`).toBeCloseTo(doan[i - 1]![1], 1);
    expect(doan.at(-1)![1]).toBe(100);
  });

  it('`nenVong` (hàm thuần): đoạn cuối LUÔN kết thúc ở 100% dù cộng dồn lệch số lẻ', async () => {
    const { nenVong } = await import('../src/screens/tai-chinh/GuongBento');
    const nen = nenVong([{ ma: 'de_danh', phan: 1 / 3 }, { ma: 'chi_hu', phan: 1 / 3 }, { ma: 'du', phan: 1 / 3 }]);
    expect(nen).toMatch(/100\.00%\)$/);
    expect(nenVong([{ ma: 'du', phan: 1 }])).toMatch(/0\.00% 100\.00%\)$/);
  });
});
