/**
 * PFM — VỊ THẾ, MẶT NGƯỜI DÙNG (tệp 15 lát 1, bản 2 — founder 25/09: "PFM theo vị thế", chữ Alpha Draft):
 * màn HŨ (DANH MỤC · lá vị thế · bảng VÀO LỆNH · lá kết toán ở hộp quyết toán) · GƯƠNG (lá kết toán ở thẻ NHÌN LẠI ·
 * nắp ĐỘ KHỚP) · chip độ chắc ở form đặt luật.
 *
 * Bài lõi (khoá lúc vào lệnh, xét bằng câu khai sự việc, "hoàn cảnh đổi" là nhãn, cỡ/danh mục) ở `pfm_vi_the.test.ts`.
 * Tệp này canh chỗ lõi ấy CHẠM MÀN HÌNH — và đọc KHO làm nguồn sự thật, không chỉ đọc DOM
 * (nếp `pfm_man_hu.test.tsx` · `pfm_tu_cham.test.tsx`).
 *
 * ⚠ ĐỒNG HỒ GIỮ CỐ ĐỊNH ở `homNay`/`thangNay` (nếp `pfm_man_guong.test.tsx`): chip kỳ hạn tính ngày thật
 *   từ hôm nay, thẻ NHÌN LẠI hỏi tháng liền trước. `bayGio` thì KHÔNG giữ — mốc ghi là giờ thật, nên
 *   bài nào đọc kỳ suy từ mốc ghi (lời đoán luật đặt từ form) phải tính kỳ từ giờ thật.
 *
 * ⚠ VIẾT LẠI 11/10 (TẦNG KHÔNG GIAN — SPEC `pfm-tang-khong-gian`, demo CHỐT bản 6, founder "A A A"): màn HŨ/GƯƠNG không cuộn. Đường tới:
 *   · TẠO HŨ = bảng BA BƯỚC trong lớp trượt (LOẠI → TÊN · MỤC TIÊU · MỨC · HẠN → LỜI ĐOÁN + độ chắc); lá vị thế · danh mục · quyết toán nằm ở lớp của hũ /
 *     lớp DANH MỤC / lớp QUYẾT TOÁN; VÀO LỆNH cho hũ ĐANG CÓ + TỰ CHIA ở lớp SỬA LỜI ĐOÁN (cùng `BangLenh`);
 *   · thẻ NHÌN LẠI mở từ ô NHÌN LẠI, lời đoán đếm theo mức chắc ở lớp KẾT TOÁN, form luật trong lớp LUẬT.
 *   Luật GIỮ NGUYÊN (mức/hạn/độ chắc ghi vào CHÍNH hũ · thiếu độ chắc thì nói ra · BỎ QUA cùng cỡ · cỡ hiện TRƯỚC khi bấm · quyết toán lật lá · P3 🔒).
 *   Đổi có chủ ý: bảng TẠO HŨ ba bước KHÔNG có ô TỰ CHIA và lá xem trước (tự chia đặt ở lớp SỬA LỜI ĐOÁN của hũ — bài §I-6 đi đường ấy), và cỡ ở bước 2 chỉ
 *   nói "mỗi tháng / mỗi ngày" (phần % dòng tiền vẫn ở lá + danh mục). "Bảng TẠO HŨ là THAO TÁC ⇒ Oracle nhường chỗ" thành "lớp là hộp thoại modal" (Oracle nay
 *   nằm trong ô giữ sẵn của dải tab, không còn trôi nổi che thao tác — canh ở `oracle_chat.test.tsx`).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const NGAY = '2026-09-25';
const THANG = '2026-09';
const LUC = '2026-09-25T05:00:00.000Z';

vi.mock('../src/lib/telemetry.js', () => ({
  ghiDo: vi.fn(), baoLoiNen: vi.fn(), manCuaDuong: () => '/tai-chinh',
}));

vi.mock('../src/pfm/thoi_gian.js', async (goc) => {
  const m = await goc<typeof import('../src/pfm/thoi_gian.js')>();
  return { ...m, homNay: () => NGAY, thangNay: () => THANG };
});

const { RuotHu } = await import('../src/screens/tai-chinh/Hu');
const { RuotGuong } = await import('../src/screens/tai-chinh/Guong');
const { KhoProvider } = await import('../src/pfm/dung_kho');
const { KhoTrongBoNho } = await import('../src/pfm/kho.js');
const { tuTao, tuMau, moLoiDoan, ghiKetQuaKy, quyetToan } = await import('../src/pfm/hu.js');
const { MAU_HU } = await import('../src/pfm/hu_mau.js');
const { taoKhoan, khoanRaBanGhi } = await import('../src/pfm/so.js');
const { taoLuatMoi, moLoiDoanLuat, banLuat, ghiNhanGiuVo } = await import('../src/pfm/luat.js');
const { thangSauCua } = await import('../src/pfm/thoi_gian.js');
const {
  CHU_BENTO: CB, CHU_KET_QUA_HU, CHU_HIEU_QUA_LUAT, CHU_LY_DO_VI_THE, CHU_MAN_GUONG: C, CHU_MAN_HU, CHU_NUT_HU,
  CHU_PHAN_BO: CP, CHU_VI_THE: CV,
} = await import('../src/lib/pfm_chu');

type Kho = InstanceType<typeof KhoTrongBoNho>;
type Hu = import('../src/pfm/hu.js').Hu;
type Khoan = import('../src/pfm/so.js').Khoan;
type Luat = import('../src/pfm/luat.js').Luat;

/* ═══ dựng cảnh ═══════════════════════════════════════════════════════════════════ */

/** Dòng tiền tháng 8 = 3.000.000 (một khoản THU) — mẫu số của "% dòng tiền". */
const THU_THANG_8 = 3_000_000;

async function khoCo(hu: readonly Hu[] = [], luat: readonly Luat[] = [], coThu = false): Promise<Kho> {
  const kho = new KhoTrongBoNho();
  for (const h of hu) await kho.ghi('hu', { id: h.id, thang: THANG, suaLuc: LUC, d: h });
  for (const l of luat) await kho.ghi('luat', { id: l.id, thang: THANG, suaLuc: LUC, d: l });
  if (coThu) {
    await kho.ghi('khoan', khoanRaBanGhi(taoKhoan({ soTien: THU_THANG_8, chieu: 'thu', ngay: '2026-08-05' }, LUC, 'k-thu')));
  }
  return kho;
}

function veVoi(kho: Kho, man: React.ReactElement, duong: string): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[duong]}>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}>{man}</KhoProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
const veHu = (kho: Kho) => veVoi(kho, <RuotHu />, '/tai-chinh/hu');
const veGuong = (kho: Kho) => veVoi(kho, <RuotGuong />, '/tai-chinh/guong');

async function hu1(kho: Kho): Promise<Hu> {
  const ds = await kho.liet<Hu>('hu');
  return ds[0]!.d;
}

/* ── ĐƯỜNG TỚI các lớp (SPEC mục 4.2 / 4.3) ── */
/** Mặt HŨ đã có số (hết "đang tải"). */
const choHuTai = (): Promise<void> => waitFor(() => {
  expect(screen.getByTestId('hu-chia-tong').textContent, 'hũ vẫn đang tải').not.toBe(CB.dangTai);
});
const oTheo = (dau: string): Promise<HTMLElement> => waitFor(() => {
  const e = document.querySelector<HTMLElement>(`[data-o="${dau}"]`);
  expect(e, `ô ${dau}`).not.toBeNull();
  return e!;
});
/** Chạm hũ mini (hoặc ô ★) mang đúng TÊN ⇒ lớp chi tiết hũ (thẻ đã bung: nút VÀO LỆNH · ĐÁNH DẤU XONG… có sẵn). */
async function moHu(ten: string): Promise<void> {
  await choHuTai();
  const e = await waitFor(() => {
    const t = [...document.querySelectorAll<HTMLElement>('[data-o="hu-con-hu"], [data-o="hu-uu-tien"]')]
      .find((x) => (x.textContent ?? '').toLowerCase().includes(ten.toLowerCase()));
    expect(t, `không thấy hũ "${ten}" trên mặt HŨ`).toBeTruthy();
    return t!;
  });
  fireEvent.click(e);
  await screen.findByRole('dialog');
}
/** Lá vị thế (theo tên VIẾT HOA) trong lớp đang mở. */
async function timLa(tenHoa: string): Promise<HTMLElement> {
  return waitFor(() => {
    const o = within(screen.getByRole('dialog')).getAllByText(tenHoa).find((e) => e.closest('[data-testid="la-vi-the"]') !== null);
    if (o === undefined) throw new Error(`không thấy lá ${tenHoa}`);
    return o;
  });
}
const moDanhMuc = async (): Promise<void> => {
  await choHuTai();
  fireEvent.click(await oTheo('hu-danh-muc'));
  await screen.findByRole('dialog');
};
/** Mở bảng TẠO HŨ (dấu + nhóm TIẾT KIỆM) — bước 1/3 — và đi tiếp tới bước `n`. */
async function tiep(buocSau: number): Promise<void> {
  fireEvent.click(await oTheo('tao-tiep'));
  await screen.findByText(new RegExp(`${CB.huBuoc} ${buocSau} /`));
}
const taoXong = async (): Promise<void> => { fireEvent.click(await oTheo('tao-xong')); };

function nut(ten: string): HTMLButtonElement {
  return screen.getByRole('button', { name: ten }) as HTMLButtonElement;
}
/** Chip độ chắc của bảng TẠO HŨ — tên trợ năng là "<NHÃN CHẮC><phần trăm>" nên khớp theo phần trăm. */
const chip = (pct: string): HTMLButtonElement => screen.getByRole('button', { name: new RegExp(`${pct}$`) }) as HTMLButtonElement;

async function nhaNhip(vong = 4): Promise<void> {
  await act(async () => { for (let i = 0; i < vong; i++) await Promise.resolve(); });
}

/** Mở bảng TẠO HŨ tới BƯỚC 2, gõ tên "Laptop" (và mức nếu có). */
async function moBuoc2(kho: Kho, muc: string | null = '6000000'): Promise<void> {
  veHu(kho);
  await choHuTai();
  fireEvent.click(await oTheo('hu-tao-tk'));
  await screen.findByTestId('tao-buoc');
  await tiep(2);
  fireEvent.change(screen.getByPlaceholderText(CHU_MAN_HU.tenHuGiuCho), { target: { value: 'Laptop' } });
  if (muc !== null) fireEvent.change(screen.getByLabelText(CHU_MAN_HU.mucOTen), { target: { value: muc } });
}

/** Hũ "Laptop" 6 triệu, lời đoán đặt 01/07 hạn 20/08 chắc vừa — tới hạn đúng tháng thẻ NHÌN LẠI hỏi. */
function huToiHanThang8(): Hu {
  const h = tuTao({ ten: 'Laptop', muc: 6_000_000 }, '2026-07-01T05:00:00.000Z', 'h1');
  return moLoiDoan(h, { han: '2026-08-20', chac: 'vua' }, '2026-07-01T05:00:00.000Z', '2026-07-01');
}

/** Luật đặt 15/07, lời đoán cho tháng 8 chắc cao; tháng 8 bắn hai lần: giữ một, vỡ một. */
function luatThang8(banHaiLan = true): Luat {
  let l = taoLuatMoi({ loiNhac: 'Ngày chi lớn thì mai đợi.', dieuKien: 'ngay_chi_lon' }, '2026-07-15T05:00:00.000Z', 'l1');
  l = moLoiDoanLuat(l, 'cao', '2026-07-20T05:00:00.000Z');
  if (!banHaiLan) return l;
  l = ghiNhanGiuVo(banLuat(l, '2026-08-05T05:00:00.000Z'), 'giu', '2026-08-05T06:00:00.000Z');
  return ghiNhanGiuVo(banLuat(l, '2026-08-12T05:00:00.000Z'), 'vo', '2026-08-12T06:00:00.000Z');
}

function stubMang(): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const dap = (status: number, body: unknown) => new Response(JSON.stringify(body), {
      status, headers: { 'content-type': 'application/json' },
    });
    if (url.includes('/telemetry')) return dap(202, { ok: true });
    if (url.includes('/auth/me')) {
      return dap(200, {
        email: 'a@b.c', email_verified: true, onboarded: true, user: null,
        pfm: { consent: true, tuan: '2026-09-21', tuan_da_niem_phong: false, tuan_token_thuong: 0, tuan_so_ngay_co_mat: 3 },
      });
    }
    return dap(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
  }));
}

beforeEach(() => { stubMang(); });
afterEach(() => { vi.unstubAllGlobals(); });

/* ═══ §I — MÀN HŨ: BẢNG VÀO LỆNH ══════════════════════════════════════════════════════ */

describe('§I — ⭐⭐⭐ MÀN HŨ: VÀO LỆNH = mức + kỳ hạn ⇒ CỠ hiện ngay ⇒ độ chắc (hoặc BỎ QUA)', () => {
  it('⭐⭐⭐ cỡ hiện TRƯỚC khi bấm, đúng đơn vị người dùng; vào lệnh ⇒ điều khoản + độ chắc ghi vào CHÍNH hũ', async () => {
    const kho = await khoCo([], [], true);
    await moBuoc2(kho);
    // ⚠ P3 🔒 — không chip nào sáng sẵn: app không chọn hộ kỳ hạn hay độ chắc.
    for (const b of within(screen.getByRole('dialog')).getAllByRole('button')) {
      expect(b.getAttribute('aria-pressed'), b.textContent ?? '').not.toBe('true');
    }
    // Chưa kỳ hạn ⇒ chưa có cỡ.
    expect(screen.queryByTestId('tao-co')).not.toBeInTheDocument();

    fireEvent.click(nut(`6${CV.thangSau}`));
    /* 6.000.000 trong 181 ngày (25/09 → 25/03): 33.149/ngày ⇒ 994.475/tháng — nói bằng chữ tròn nghìn. */
    const co = await screen.findByTestId('tao-co');
    expect(co).toHaveTextContent('994.000');
    expect(co).toHaveTextContent('33.000');
    // Chưa chọn độ chắc ở bước 2 (độ chắc là bước 3).
    expect(screen.queryByRole('button', { name: /70%$/ })).not.toBeInTheDocument();

    await tiep(3);
    fireEvent.click(chip('70%'));
    fireEvent.change(screen.getByPlaceholderText(CV.viSaoGiuCho), { target: { value: 'góp đều từ tiền làm thêm' } });
    await taoXong();

    await waitFor(async () => expect(await kho.liet('hu')).toHaveLength(1));
    const h = await hu1(kho);
    expect(h.lenh).toEqual({ tu: NGAY, kyHan: '2027-03-25' });
    expect(h.han, 'nhãn hạn là HỆ QUẢ của kỳ hạn, không phải câu hỏi thứ hai').toBe('vua');
    expect(h.loiDoan![0]).toMatchObject({
      muc: 6_000_000, han: '2027-03-25', chac: 'vua', viSao: 'góp đều từ tiền làm thêm',
    });
    // Lá vị thế mang cỡ + kỳ hạn + độ chắc — trạng thái của vật nằm TRÊN vật.
    await waitFor(() => expect(screen.queryByTestId('tao-buoc')).toBeNull());
    await moHu('Laptop');
    expect(await screen.findByTestId('dong-co')).toHaveTextContent(`${CV.coPre}33% · 994.000${CV.moiThangHau}`);
    const dong = screen.getByTestId('dong-loi-doan');
    expect(dong).toHaveTextContent(`${CV.conPre}181${CV.ngayHau}`);
    expect(dong).toHaveTextContent(`${CV.chacPre}70%`);
  });

  it('⭐⭐ có mức + kỳ hạn mà CHƯA chọn độ chắc ⇒ không vào lệnh, nói ra; BỎ QUA cùng cỡ ⇒ vào lệnh không độ chắc', async () => {
    const kho = await khoCo();
    await moBuoc2(kho);
    fireEvent.click(nut(`6${CV.thangSau}`));
    await tiep(3);
    await taoXong();
    expect(await screen.findByRole('alert')).toHaveTextContent(CV.thieuChac);
    await nhaNhip();
    expect(await kho.liet('hu')).toHaveLength(0);

    // BỎ QUA là một ô CÙNG CỠ với ba mức chắc (D369 §8) — cùng hàng, cùng lớp (không lớp riêng), chỉ khác nội dung.
    expect(nut(CV.boQua).parentElement).toBe(chip('70%').parentElement);
    expect(nut(CV.boQua).className).toBe(chip('70%').className);
    fireEvent.click(nut(CV.boQua));
    await taoXong();
    await waitFor(async () => expect(await kho.liet('hu')).toHaveLength(1));
    const h = await hu1(kho);
    expect(h.lenh).toEqual({ tu: NGAY, kyHan: '2027-03-25' });
    expect(h.loiDoan).toBeUndefined();
    // Lá vẫn mang CỠ (vị thế có điều khoản), chỉ không có chip độ chắc.
    await waitFor(() => expect(screen.queryByTestId('tao-buoc')).toBeNull());
    await moHu('Laptop');
    expect(await screen.findByTestId('dong-co')).toHaveTextContent('994.000');
    expect(screen.getByTestId('dong-loi-doan')).not.toHaveTextContent(CV.chacPre.trim());
  });

  it('⭐ kỳ hạn chọn mà CHƯA có mức ⇒ kỳ hạn vẫn được giữ (không nuốt im), không hỏi độ chắc, không cỡ', async () => {
    const kho = await khoCo();
    await moBuoc2(kho, null);
    fireEvent.click(nut(`3${CV.thangSau}`));
    expect(screen.queryByTestId('tao-co')).not.toBeInTheDocument();
    await tiep(3);
    // Chưa đủ mức + hạn ⇒ bước 3 nói "chưa đủ để đoán", không chip độ chắc, không BỎ QUA.
    expect(screen.getByTestId('tao-chua-du')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: CV.boQua })).not.toBeInTheDocument();
    await taoXong();
    await waitFor(async () => expect(await kho.liet('hu')).toHaveLength(1));
    const h = await hu1(kho);
    expect(h.muc).toBeNull();
    expect(h.lenh).toEqual({ tu: NGAY, kyHan: '2026-12-25' });
    expect(h.loiDoan).toBeUndefined();
    await waitFor(() => expect(screen.queryByTestId('tao-buoc')).toBeNull());
    await moHu('Laptop');
    expect(await screen.findByTestId('la-vi-the')).toHaveTextContent(CV.chuaMuc);
  });

  it('⭐⭐ D410 — biểu tượng chọn được, không ô nào sáng sẵn (P3); tạo xong hũ mang đúng biểu tượng', async () => {
    const kho = await khoCo([], [], true);
    await moBuoc2(kho);
    const oIcon = screen.getAllByRole('button', { name: new RegExp(`^${CV.bieuTuongHoi} `) });
    expect(oIcon.length).toBeGreaterThanOrEqual(10);
    expect(oIcon.filter((b) => b.getAttribute('aria-pressed') === 'true'), 'P3 — không biểu tượng nào chọn sẵn').toHaveLength(0);
    fireEvent.click(nut(`${CV.bieuTuongHoi} vault`));
    expect(nut(`${CV.bieuTuongHoi} vault`)).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(nut(`6${CV.thangSau}`));
    await tiep(3);
    fireEvent.click(nut(CV.boQua));
    await taoXong();
    await waitFor(async () => expect(await kho.liet('hu')).toHaveLength(1));
    expect((await hu1(kho)).icon).toBe('vault');
  });

  it('⭐⭐ D410 — bảng TẠO HŨ là một THAO TÁC: hộp thoại modal chặn phía sau; ĐÓNG ⇒ lớp rời DOM, không tạo gì', async () => {
    /* Trước tầng không gian: "bong bóng Oracle nhường chỗ" (`dangThaoTac`). Nay Oracle nằm trong ô giữ sẵn của dải tab (không trôi nổi che thao tác);
       bất biến còn lại là: bảng đang mở là hộp thoại modal, ĐÓNG là lối ra, và không cú đóng nào ghi hũ. */
    const kho = await khoCo([], [], true);
    veHu(kho);
    await choHuTai();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(await oTheo('hu-tao-tk'));
    const hop = await screen.findByRole('dialog');
    expect(hop).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(within(hop).getByRole('button', { name: 'ĐÓNG' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await kho.liet('hu')).toHaveLength(0);
  });

  it('⭐⭐ D420 — TỰ CHIA (lớp SỬA LỜI ĐOÁN của hũ): bật MỖI NGÀY mà để trống ⇒ nói ra, không lưu; chọn 50k ⇒ hũ mang quy tắc, lá nói ra, và TỰ CHIA ngay', async () => {
    const kho = await khoCo([tuTao({ ten: 'Laptop', muc: 6_000_000 }, LUC, 'h1')], [], true);
    veHu(kho);
    await moHu('Laptop');
    fireEvent.click(await screen.findByTestId('hu-sua'));
    await screen.findByTestId('bang-lenh');
    fireEvent.click(nut(CP.tuDongNgay));
    fireEvent.click(nut(CV.luuLenh));
    expect(await screen.findByRole('alert')).toHaveTextContent(CP.tuDongLoiNgay);
    expect((await hu1(kho)).tuDong, 'quy tắc bật mà trống ⇒ không lặng lẽ lưu hũ không quy tắc').toBeUndefined();
    fireEvent.click(nut('50k'));
    fireEvent.click(nut(CV.luuLenh));
    await waitFor(async () => expect((await hu1(kho)).tuDong).toMatchObject({ kieu: 'ngay', gt: 50_000, tu: NGAY }));
    // Lớp đóng sau khi lưu; mở lại lớp hũ ⇒ lá nói quy tắc.
    await waitFor(() => expect(screen.queryByTestId('bang-lenh')).toBeNull());
    await moHu('Laptop');
    expect(await screen.findByTestId('dong-tu-dong')).toHaveTextContent(`${CP.laTuDongPre}${CP.tuDongDau}50k${CP.moiNgayHau}`);
    // Ví 3 triệu (tháng 8), không tiền vào mới ⇒ KHỚP ⇒ màn tự chia 50.000 ngay sau khi đặt.
    await waitFor(async () => {
      const pb = (await kho.liet<Khoan>('khoan')).map((b) => b.d).filter((x) => x.phanBo !== undefined);
      expect(pb.map((x) => [x.soTien, x.phanBo])).toEqual([[50_000, 'tu_dong']]);
    });
  });

  it('⭐ kỳ hạn "NGÀY KHÁC" quá gần ⇒ nói ra số ngày tối thiểu, không cỡ, không đi tiếp / không vào lệnh', async () => {
    const kho = await khoCo();
    await moBuoc2(kho);
    fireEvent.click(nut(CV.ngayKhac));
    fireEvent.change(screen.getByLabelText(CV.ngayKhac), { target: { value: '2026-09-30' } });
    expect(screen.getByRole('alert')).toHaveTextContent(CV.hanGanQua);
    expect(screen.queryByTestId('tao-co')).not.toBeInTheDocument();
    fireEvent.click(await oTheo('tao-tiep'));
    await nhaNhip();
    await new Promise((r) => { setTimeout(r, 250); });   // nút chính trễ một nhịp phụt hạt — chờ qua nhịp ấy rồi mới khẳng định "không đi tiếp"
    expect(screen.getByText(new RegExp(`${CB.huBuoc} 2 /`)), 'hạn sai ⇒ vẫn ở bước 2').toBeInTheDocument();
    expect(await kho.liet('hu')).toHaveLength(0);
  });

  it('⭐⭐ hũ MẪU chưa mức ⇒ thẻ có VÀO LỆNH ⇒ bảng KHÔNG hỏi lại tên ⇒ mức + kỳ hạn + 90% ghi vào CHÍNH hũ', async () => {
    const kho = await khoCo([tuMau(MAU_HU[0]!, LUC, 'h1')]);
    veHu(kho);
    await moHu(MAU_HU[0]!.tenGoiY);
    await timLa(MAU_HU[0]!.tenGoiY.toUpperCase());
    fireEvent.click(nut(CV.vaoLenh));
    const bang = await screen.findByTestId('bang-lenh');
    expect(bang).toHaveTextContent(`${CV.lenhTieuPre}${MAU_HU[0]!.tenGoiY.toUpperCase()}`);
    expect(screen.queryByPlaceholderText(CHU_MAN_HU.tenHuGiuCho)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(CHU_MAN_HU.mucOTen), { target: { value: '3000000' } });
    fireEvent.click(nut(`3${CV.thangSau}`));
    fireEvent.click(nut('90%'));
    // D410 — hũ ĐANG CÓ thì nút neo đáy là LƯU (không phải "TẠO HŨ").
    expect(screen.queryByRole('button', { name: CHU_MAN_HU.taoHu })).toBeNull();
    fireEvent.click(nut(CV.luuLenh));

    await waitFor(async () => expect((await hu1(kho)).loiDoan).toHaveLength(1));
    const h = await hu1(kho);
    expect(await kho.liet('hu'), 'sửa hũ đang có, không đẻ hũ thứ hai').toHaveLength(1);
    expect(h.muc).toBe(3_000_000);
    expect(h.lenh).toEqual({ tu: NGAY, kyHan: '2026-12-25' });
    expect(h.loiDoan![0]).toMatchObject({ muc: 3_000_000, han: '2026-12-25', chac: 'cao' });
  });
});

/* ═══ §II — MÀN HŨ: DANH MỤC + LÁ VỊ THẾ ════════════════════════════════════════════════ */

describe('§II — ⭐⭐ DANH MỤC của tháng: thanh chia dòng tiền + một câu Oracle đếm được', () => {
  it('⭐⭐ hai vị thế ⇒ khúc theo cỡ, phần chưa cam kết; một vị thế chiếm ≥ 60% ⇒ Oracle nói đúng tên + %', async () => {
    const lenh = { tu: NGAY, kyHan: '2027-03-25' };
    const kho = await khoCo([
      tuTao({ ten: 'Tai nghe', muc: 1_500_000, lenh }, LUC, 'h2'),
      /* ⚠ Lệnh QUÁ KỲ HẠN (01/07 → 20/08, 1,8 triệu/tháng = 60%): hết kế hoạch góp, chờ kết toán — không vào thanh,
         không vào câu. Tính nó vào thì 101% ⇒ câu "vượt dòng tiền" GIẢ thay cho câu "tập trung". */
      tuTao({ ten: 'Máy ảnh', muc: 3_000_000, lenh: { tu: '2026-07-01', kyHan: '2026-08-20' } }, LUC, 'h0'),
      tuTao({ ten: 'Laptop', muc: 6_000_000, lenh }, LUC, 'h1'),
    ], [], true);
    veHu(kho);
    await moDanhMuc();
    // ⚠ Khối danh mục có mặt ngay cả lúc 0 hũ (lượt đọc kho đầu) — chờ LÁ hiện rồi mới đọc số.
    await screen.findAllByTestId('la-vi-the');
    const dm = screen.getByTestId('danh-muc');
    expect(dm).toHaveTextContent(`${CV.dmTieuPre}9`);
    expect(dm).toHaveTextContent('3.000.000');
    /* 994.475 + 248.619 = 1.243.094/tháng ⇒ 33% + 8% = 41% đã cam kết, 59% chưa. */
    expect(dm).toHaveTextContent('LAPTOP 33%');
    expect(dm).toHaveTextContent('TAI NGHE 8%');
    expect(dm).toHaveTextContent(`${CV.dmChuaCamKet} 59%`);
    expect(dm.querySelectorAll('[role="img"] i'), 'hai khúc vị thế + một khúc trống').toHaveLength(3);
    expect(dm, 'lệnh quá kỳ hạn không có mặt trên thanh chia').not.toHaveTextContent('MÁY ẢNH');
    // ⚠ Vị thế LỚN đứng trước (danh mục xếp theo cỡ), dù được ghi sau; lệnh quá hạn đứng sau các lệnh đang cam kết.
    const la = screen.getAllByTestId('la-vi-the').map((e) => e.getAttribute('data-hu'));
    expect(la).toEqual(['h1', 'h2', 'h0']);
    // ⚠ Nhắm TRONG lớp: hũ mini trên mặt HŨ cũng mang `data-hu` (bình/ phong bì).
    const quaHan = screen.getByRole('dialog').querySelector('[data-hu="h0"]')!;
    expect(quaHan, 'cỡ vẫn tả, nhưng không kèm % dòng tiền').toHaveTextContent(`${CV.coPre}1.800.000${CV.moiThangHau}`);
    expect(quaHan).toHaveTextContent(`${CV.quaHanPre}36${CV.ngayHau}`);
    expect(screen.getByTestId('cau-danh-muc')).toHaveTextContent(`LAPTOP${CV.cauChiemHau}80%${CV.cauPhanCamKet}`);
  });

  it('⭐ sổ chưa có khoản THU nào ⇒ không % nào (thiếu mẫu là trống, không phải 0 — P7), nói lý do', async () => {
    const kho = await khoCo([tuTao({ ten: 'Laptop', muc: 6_000_000, lenh: { tu: NGAY, kyHan: '2027-03-25' } }, LUC, 'h1')]);
    veHu(kho);
    await moDanhMuc();
    await screen.findByTestId('dong-co');
    const dm = screen.getByTestId('danh-muc');
    expect(dm).toHaveTextContent(CV.dmChuaDongTien);
    expect(dm.querySelector('[role="img"]')).toBeNull();
    // Lá vẫn mang cỡ tuyệt đối — chỉ phần % vắng.
    expect(screen.getByTestId('dong-co')).toHaveTextContent(`${CV.coPre}994.000${CV.moiThangHau}`);
  });

  it('⭐⭐ lá vị thế đếm NHỊP: vào lệnh 30 ngày trước, chưa góp đồng nào ⇒ "chậm 1 kỳ"', async () => {
    const kho = await khoCo([
      tuTao({ ten: 'Laptop', muc: 6_000_000, lenh: { tu: '2026-08-26', kyHan: '2027-02-26' } }, LUC, 'h1'),
    ]);
    veHu(kho);
    await moDanhMuc();
    const dong = await screen.findByTestId('dong-loi-doan');
    expect(dong).toHaveTextContent(`${CV.conPre}154${CV.ngayHau} · ${CV.nhipChamPre}1${CV.kyHau}`);
  });
});

/* ═══ §III — MÀN HŨ: KẾT TOÁN SỚM LẬT LÁ ══════════════════════════════════════════════ */

describe('§III — ⭐⭐ quyết toán hũ có lệnh mở ⇒ lá LẬT sang kết quả, rồi hỏi VÌ SAO', () => {
  it('⭐⭐ bấm nấc ⇒ lá lật (CHƯA TỚI), CHƯA chốt; VÌ SAO ⇒ ghi kết quả + nhãn vào CHÍNH hũ', async () => {
    const h = moLoiDoan(tuTao({ ten: 'Laptop', muc: 6_000_000 }, LUC, 'h1'),
      { han: '2027-03-25', chac: 'vua' }, LUC, NGAY);
    const kho = await khoCo([h]);
    veHu(kho);
    await moHu('Laptop');
    await timLa('LAPTOP');
    fireEvent.click(nut(CHU_NUT_HU.danhDauXong));
    const la = await screen.findByTestId('la-ket-toan');
    expect(la).toHaveAttribute('data-lat', 'khong');
    expect(la).toHaveTextContent(`${CV.matDuPre}6.000.000${CV.matToiGiua}25/03`);
    expect(screen.queryByTestId('hang-ly-do')).not.toBeInTheDocument();

    fireEvent.click(nut(CHU_KET_QUA_HU.gan_du));
    expect(la).toHaveAttribute('data-lat', 'co');
    expect(within(la).getByTestId('ket-la')).toHaveTextContent(CV.ketKhongToi);
    expect(la).toHaveTextContent(`${CV.lungNacPre}${CHU_KET_QUA_HU.gan_du}`);
    expect(await screen.findByTestId('hang-ly-do')).toBeInTheDocument();
    expect((await hu1(kho)).trangThai, 'chưa chốt khi mới lật lá').toBe('dang_chay');
    fireEvent.click(nut(CHU_LY_DO_VI_THE.hoan_canh_doi));

    await waitFor(async () => expect((await hu1(kho)).trangThai).toBe('xong'));
    const ld = (await hu1(kho)).loiDoan![0]!;
    expect(ld.khep).toMatchObject({ ly: 'quyet_toan', kq: 'khong_toi' });
    expect(ld.lyDo).toBe('hoan_canh_doi');
  });

  it('quyết toán hũ KHÔNG lệnh sống ⇒ không lá, bấm nấc là chốt ngay (hành vi cũ giữ nguyên)', async () => {
    const kho = await khoCo([tuTao({ ten: 'Laptop', muc: 6_000_000 }, LUC, 'h1')]);
    veHu(kho);
    await moHu('Laptop');
    await timLa('LAPTOP');
    fireEvent.click(nut(CHU_NUT_HU.danhDauXong));
    expect(screen.queryByTestId('la-ket-toan')).not.toBeInTheDocument();
    fireEvent.click(nut(CHU_KET_QUA_HU.du));
    await waitFor(async () => expect((await hu1(kho)).trangThai).toBe('xong'));
    expect(screen.queryByTestId('hang-ly-do')).not.toBeInTheDocument();
  });
});

/* ═══ §IV — GƯƠNG ═══════════════════════════════════════════════════════════════════ */

/** Ô NHÌN LẠI của GƯƠNG ⇒ lớp có thẻ NHÌN LẠI (chờ ô nói "· N câu" — dữ liệu đã tải). */
async function moNhinLai(): Promise<void> {
  const o = await oTheo('guong-nhin-lai');
  await waitFor(() => expect(o.textContent).toMatch(/ · \d+ câu/));
  fireEvent.click(o);
  await screen.findByRole('dialog');
}

describe('§IV — ⭐⭐⭐ GƯƠNG: thẻ NHÌN LẠI lật lá KẾT TOÁN của đúng lệnh đã vào', () => {
  it('⭐⭐⭐ hũ: mặt trước = điều đã đặt; bấm nấc ⇒ lá lật (TỚI + độ khớp) ⇒ VÌ SAO ⇒ sang bước kế; kho có nấc + nhãn', async () => {
    /* ⚠ Thêm một lệnh 70% đã kết toán SỚM (chốt 10/07, CHƯA TỚI) — để dòng độ khớp có n ≠ tới (2 và 1); chỉ một
       lượt thì n = tới = 1 và đảo hai số cho nhau vẫn xanh. Hũ ấy đã đóng trước kỳ 8 nên thẻ không hỏi lại nó. */
    const som = quyetToan(
      moLoiDoan(tuTao({ ten: 'Xe', muc: 2_000_000 }, '2026-06-01T05:00:00.000Z', 'h2'),
        { han: '2026-10-20', chac: 'vua' }, '2026-06-01T05:00:00.000Z', '2026-06-01'),
      'xong', 'xa', '2026-07-10T05:00:00.000Z',
    );
    const kho = await khoCo([huToiHanThang8(), som]);
    veGuong(kho);
    await moNhinLai();
    const the = await screen.findByTestId('the-cuoi-ky');
    const la = within(the).getByTestId('la-ket-toan');
    expect(la).toHaveAttribute('data-lat', 'khong');
    expect(la).toHaveTextContent(`${CV.ktPre}LAPTOP`);
    expect(la).toHaveTextContent(`${CV.matDuPre}6.000.000${CV.matToiGiua}20/08`);
    expect(la).toHaveTextContent(`${CV.chacPre}70%`);
    fireEvent.click(within(the).getByRole('button', { name: CHU_KET_QUA_HU.du }));

    // Lá lật khi nấc đã NẰM TRONG bản ghi (đọc lại kho), không phải khi nút vừa bị chạm.
    await waitFor(() => expect(within(the).getByTestId('la-ket-toan')).toHaveAttribute('data-lat', 'co'));
    const lat = within(the).getByTestId('la-ket-toan');
    expect(within(lat).getByTestId('ket-la')).toHaveTextContent(CV.ketToi);
    expect(lat).toHaveTextContent(`${CV.doKhopPre}70%${CV.doKhopGiua}2${CV.doKhopLan}1`);
    const hang = await within(the).findByTestId('ck-ly-do');
    fireEvent.click(within(hang).getByRole('button', { name: CHU_LY_DO_VI_THE.dung_nhu_nghi }));

    await waitFor(async () => {
      const h = (await kho.liet<Hu>('hu')).find((r) => r.id === 'h1')!.d;
      expect(h.ketQuaKy?.['2026-08']).toBe('du');
      expect(h.loiDoan?.[0]?.lyDo).toBe('dung_nhu_nghi');
    });
    await waitFor(() => expect(screen.queryByTestId('ck-ly-do')).not.toBeInTheDocument());
  });

  it('⭐⭐ luật: lưng lá là nhịp APP TỰ ĐẾM (bắn 2 · giữ 1 · vỡ 1 ⇒ CHƯA TỚI); trả lời ⇒ lá lật, hỏi VÌ SAO', async () => {
    const kho = await khoCo([], [luatThang8()]);
    veGuong(kho);
    await moNhinLai();
    const the = await screen.findByTestId('the-cuoi-ky');
    const la = within(the).getByTestId('la-ket-toan');
    expect(la).toHaveAttribute('data-lat', 'khong');
    expect(la).toHaveTextContent(`${CV.luatMatPre}8${CV.luatMatGiua}`);
    expect(la).toHaveTextContent(`${CV.chacPre}90%`);
    fireEvent.click(within(the).getByRole('button', { name: CHU_HIEU_QUA_LUAT.co }));
    await waitFor(() => expect(within(the).getByTestId('la-ket-toan')).toHaveAttribute('data-lat', 'co'));
    const lat = within(the).getByTestId('la-ket-toan');
    expect(within(lat).getByTestId('ket-la')).toHaveTextContent(CV.ketKhongToi);
    expect(lat).toHaveTextContent(`${CV.luatDemBan}2${CV.luatDemGiu}1${CV.luatDemVo}1`);

    const hang = await within(the).findByTestId('ck-ly-do');
    fireEvent.click(within(hang).getByRole('button', { name: CHU_LY_DO_VI_THE.danh_gia_sai }));
    await waitFor(async () => {
      const l = (await kho.liet<Luat>('luat'))[0]!.d;
      expect(l.hieuQuaKy?.['2026-08']).toBe('co');
      expect(l.loiDoan?.[0]?.lyDo).toBe('danh_gia_sai');
    });
  });

  it('⭐ luật KHÔNG bắn lần nào ⇒ "chưa đủ để xét", KHÔNG hỏi vì sao (không có gì để giải thích)', async () => {
    const kho = await khoCo([], [luatThang8(false)]);
    veGuong(kho);
    await moNhinLai();
    const the = await screen.findByTestId('the-cuoi-ky');
    expect(within(the).getByTestId('ket-la')).toHaveTextContent(CV.ketChuaXet);
    fireEvent.click(within(the).getByRole('button', { name: CHU_HIEU_QUA_LUAT.co }));
    await nhaNhip();
    expect(within(the).queryByTestId('ck-ly-do')).not.toBeInTheDocument();
    // ⚠ Và thẻ ĐI TIẾP ngay — không kẹt ở bước luật chờ một hàng VÌ SAO không bao giờ mọc.
    expect(await within(the).findByText(C.ckTuDem)).toBeInTheDocument();
  });
});

describe('§V — ⭐⭐ GƯƠNG: lời đoán của bạn (trong lớp KẾT TOÁN — tầng không gian) đếm theo mức chắc, không chấm điểm', () => {
  it('⭐⭐ đã xét ⇒ "Chắc 70%: 2 lần, tới 1"; hoàn cảnh đổi in tách dòng, vẫn đếm', async () => {
    const tru = ghiKetQuaKy(huToiHanThang8(), '2026-08', 'du');
    const truot = { ...ghiKetQuaKy(huToiHanThang8(), '2026-08', 'xa'), id: 'h2' };
    truot.loiDoan = [{ ...truot.loiDoan![0]!, lyDo: 'hoan_canh_doi' as const }];
    const kho = await khoCo([tru, truot]);
    veGuong(kho);
    fireEvent.click(await oTheo('guong-ket-toan'));
    const mat = await screen.findByTestId('mat-loi-doan');
    expect(within(mat).getByTestId('dem-chac-vua')).toHaveTextContent(`${CV.doKhopPre}70%${CV.doKhopGiua}2${CV.doKhopLan}1`);
    expect(mat).toHaveTextContent(`1${CV.hoanCanhDoiHau}`);
    // ⚠ "Độ khớp" là tên NẮP, không phải một con số: không Brier, không tỷ lệ thập phân nào (tệp 15 R5).
    expect(mat.textContent).not.toMatch(/\d,\d/);
  });

  it('⭐ D453 — chưa lời đoán nào, chưa hũ nào xong ⇒ lớp KẾT TOÁN nói MỘT câu "chưa có", không số 0 (không dựng mặt đếm rỗng)', async () => {
    /* Trước D453 nắp ĐỘ KHỚP luôn đứng đó và mở ra câu "đặt được ở đâu". Chỗ đặt độ chắc vẫn nói ở đúng nơi đặt nó (bảng
       đặt mức · hạn ở màn HŨ, form luật). Tầng không gian: ô KẾT TOÁN luôn có mặt; lớp của nó nói "chưa có" thay vì dựng bảng đếm toàn số 0. */
    const kho = await khoCo();
    veGuong(kho);
    fireEvent.click(await oTheo('guong-ket-toan'));
    expect(await screen.findByTestId('doan-trong')).toHaveTextContent(CV.chuaCoGi);
    expect(screen.queryByTestId('mat-loi-doan')).toBeNull();
    expect(within(screen.getByRole('dialog')).queryByText(/\b0\/|\b0%/)).toBeNull();
  });
});

describe('§VI — ⭐⭐ form đặt luật: chip độ chắc tuỳ chọn; sự kiện rời máy KHÔNG đổi', () => {
  it('⭐⭐ chọn 90% ⇒ luật mang độ chắc cho THÁNG LIỀN SAU; sự kiện `dat` vẫn đúng ba trường', async () => {
    const kho = await khoCo();
    veGuong(kho);
    fireEvent.click(await oTheo('guong-luat'));
    fireEvent.click(await screen.findByRole('button', { name: C.themLuat }));
    fireEvent.click(await screen.findByRole('button', { name: '90%' }));
    fireEvent.click(nut(C.nutDatLuat));

    await waitFor(async () => expect(await kho.liet<Luat>('luat')).toHaveLength(1));
    const l = (await kho.liet<Luat>('luat'))[0]!.d;
    // ⚠ Kỳ suy từ MỐC GHI (giờ thật — `bayGio` không bị giữ), không từ ngày giữ cố định của tệp.
    expect(l.loiDoan).toEqual([expect.objectContaining({
      ky: thangSauCua(l.taoLuc.slice(0, 7)), chac: 'cao',
    })]);
    const hop = await kho.liet<{ v: Record<string, unknown> }>('outbox');
    expect(Object.keys(hop[0]!.d.v).sort()).toEqual(['hanh_dong', 'luat_id', 'mau_id']);
    expect(JSON.stringify(hop[0]!.d)).not.toContain('loiDoan');
  });

  it('không chọn chip ⇒ luật không mang độ chắc (bỏ qua là mặc định)', async () => {
    const kho = await khoCo();
    veGuong(kho);
    fireEvent.click(await oTheo('guong-luat'));
    fireEvent.click(await screen.findByRole('button', { name: C.themLuat }));
    fireEvent.click(await screen.findByRole('button', { name: C.nutDatLuat }));
    await waitFor(async () => expect(await kho.liet<Luat>('luat')).toHaveLength(1));
    expect((await kho.liet<Luat>('luat'))[0]!.d.loiDoan).toBeUndefined();
  });
});
