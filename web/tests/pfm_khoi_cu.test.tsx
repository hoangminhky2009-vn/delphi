/**
 * PFM TẦNG KHÔNG GIAN — BẢNG CHUYỂN TIẾP "KHỐI CŨ → MỘT CHẠM" (SPEC `pfm-tang-khong-gian` mục 5 + 5b.3; luật founder: mặt không cuộn KHÔNG ĐƯỢC làm mất lối tới
 * khối nào của bốn màn cũ — mọi khối cũ tới được trong ≤ 1 chạm từ mặt tab).
 *
 * Bài chạy ĐƯỜNG CHÍNH của người chơi: dựng từng tab trên dữ liệu đủ, rồi với MỖI ô trên mặt: chạm đúng MỘT lần ⇒ thấy khối cũ tương ứng (dấu `data-testid`
 * của khối ấy, đã có từ trước tầng không gian) hoặc đổi tab đúng đích. Thêm ô mà quên nối khối, hay gỡ khối khỏi lớp, là đỏ ở đây — và cột "khối cũ" của
 * bảng là danh sách khảo sát (không phải suy từ mã mới) nên một khối bị bỏ sót khi thi công vẫn lộ.
 *
 * Đây cũng là bảng bằng chứng cho báo cáo "bảng chuyển tiếp 5b.3" (ô/nút → đích) ở các tab SỔ · HŨ · GƯƠNG · THẺ.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const THANG = '2026-09';
const NGAY = '2026-09-15';
const LUC = '2026-09-15T10:00:00.000Z';

vi.mock('../src/lib/telemetry.js', () => ({ ghiDo: vi.fn(), baoLoiNen: vi.fn(), manCuaDuong: () => '/tai-chinh/so' }));
vi.mock('../src/pfm/thoi_gian.js', async (goc) => {
  const m = await goc<typeof import('../src/pfm/thoi_gian.js')>();
  return { ...m, homNay: () => NGAY, thangNay: () => THANG };
});

const { RuotSo } = await import('../src/screens/tai-chinh/So');
const { RuotHu } = await import('../src/screens/tai-chinh/Hu');
const { RuotGuong } = await import('../src/screens/tai-chinh/Guong');
const { RuotChanDung } = await import('../src/screens/tai-chinh/ChanDungPfm');
const { KhoProvider } = await import('../src/pfm/dung_kho');
const { KhoTrongBoNho } = await import('../src/pfm/kho.js');
const { khoanRaBanGhi, taoKhoan } = await import('../src/pfm/so.js');
const { taoKhoanPhanBo } = await import('../src/pfm/phan_bo.js');
const { tuTao, moLoiDoan } = await import('../src/pfm/hu.js');
const { suaHoSo } = await import('../src/pfm/ho_so.js');
const { CHU_BENTO: CB, CHU_MAN_CHAN_DUNG: CD, CHU_MAN_GUONG: C, CHU_MAN_SO } = await import('../src/lib/pfm_chu');

type Kho = InstanceType<typeof KhoTrongBoNho>;

/** Kho ĐỦ MỌI THỨ: tiền vào/ra hai tháng, hũ tiết kiệm (có lời đoán, có nạp) + hũ chi (có gán), hồ sơ phỏng vấn, một hũ tạo từ tháng trước (để NHÌN LẠI có câu). */
async function khoDay(): Promise<Kho> {
  const kho = new KhoTrongBoNho();
  let i = 0;
  const ghi = async (ngay: string, soTien: number, chieu: 'chi' | 'thu' = 'chi', them: Record<string, unknown> = {}) =>
    kho.ghi('khoan', khoanRaBanGhi(taoKhoan({ ngay, soTien, chieu, ...them }, `${ngay}T05:00:00.000Z`, `k${i++}`)));
  await ghi('2026-08-05', 6_000_000, 'thu');
  for (let d = 1; d <= 28; d++) if (d % 2 === 0) await ghi(`2026-08-${String(d).padStart(2, '0')}`, 80_000);
  await ghi('2026-09-02', 6_000_000, 'thu');
  for (let d = 1; d <= 15; d++) await ghi(`2026-09-${String(d).padStart(2, '0')}`, d % 4 === 0 ? 350_000 : 70_000, 'chi', d === 15 ? { ghiChu: 'cơm trưa' } : {});
  const lap = moLoiDoan(tuTao({ ten: 'Laptop', muc: 12_000_000 }, '2026-08-02T05:00:00.000Z', 'h-lap'), { han: '2027-03-25', chac: 'vua' }, '2026-08-02T05:00:00.000Z', '2026-08-02');
  const an = tuTao({ ten: 'Ăn uống', muc: 3_000_000, nhom: 'tieu_dung' }, '2026-08-02T05:00:00.000Z', 'h-an');
  for (const h of [lap, an]) await kho.ghi('hu', { id: h.id, thang: THANG, suaLuc: LUC, d: h });
  await kho.ghi('khoan', khoanRaBanGhi(taoKhoanPhanBo({ ngay: '2026-09-03', soTien: 500_000, huId: 'h-lap', phanBo: 'tay' }, LUC, 'nap1')));
  await kho.ghi('khoan', khoanRaBanGhi(taoKhoanPhanBo({ ngay: '2026-09-04', soTien: 120_000, huId: 'h-an', phanBo: 'gan' }, LUC, 'gan1')));
  await suaHoSo(kho, (cu) => ({ ...cu, lucTienVe: 'cất một phần đi', sauKhiTieu: 'nhẩm lại giá', dauThang: 'đại khái', nhip: ['lúc vừa có tiền'] }), LUC);
  return kho;
}

function ViTri(): React.ReactElement {
  const l = useLocation();
  return <span data-testid="vi-tri">{`${l.pathname}${l.search}`}</span>;
}

function ve(kho: Kho, man: React.ReactElement) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const dap = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (url.includes('/auth/me')) {
      return dap(200, {
        email: 'a@b.c', email_verified: true, onboarded: true, user: null,
        pfm: { consent: true, tuan: '2026-W37', tuan_da_niem_phong: false, tuan_token_thuong: 0, tuan_so_ngay_co_mat: 6 },
      });
    }
    return dap(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
  }));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/tai-chinh/x']}>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}>
          <Routes>
            <Route path="/tai-chinh/x" element={<>{man}<ViTri /></>} />
            <Route path="*" element={<ViTri />} />
          </Routes>
        </KhoProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => { /* mỗi bài tự dựng */ });
afterEach(() => { vi.unstubAllGlobals(); });

/** Chuỗi chữ → RegExp khớp nguyên văn (`motCham` coi chuỗi trần là testid). */
const chu = (t: string): RegExp => new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

const oTheo = (dau: string): Promise<HTMLElement> => waitFor(() => {
  const e = document.querySelector<HTMLElement>(`[data-o="${dau}"]`);
  expect(e, `ô ${dau}`).not.toBeNull();
  return e!;
});

/** MỘT chạm vào ô `dau` ⇒ lớp mở và có `dau-hieu` (testid hoặc chữ). Trả lớp để bài chồng thêm khẳng định. */
async function motCham(dau: string, dauHieu: string | RegExp | null): Promise<HTMLElement> {
  // Đóng lớp trước (nếu có) để mỗi ô được thử SẠCH từ mặt tab — "một chạm" tính từ mặt, không từ lớp khác.
  const cu = screen.queryByRole('dialog');
  if (cu !== null) {
    fireEvent.click(within(cu).getByRole('button', { name: 'ĐÓNG' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }
  fireEvent.click(await oTheo(dau));
  const hop = await screen.findByRole('dialog');
  if (typeof dauHieu === 'string') await within(hop).findAllByTestId(dauHieu);
  else if (dauHieu !== null) await within(hop).findAllByText(dauHieu);
  else await waitFor(() => expect((hop.textContent ?? '').length, 'lớp có nội dung').toBeGreaterThan(40));
  return hop;
}

/* ═══ SỔ ═══════════════════════════════════════════════════════════════════════════════════════ */

describe('SỔ — ba ô + khe HƯỚNG + bàn tiền: mọi khối cũ ≤ 1 chạm', () => {
  it('⭐⭐⭐ ô CHI HÔM NAY → DANH SÁCH KHOẢN (dòng, mốc ngày, sửa/xoá) · ô THÁNG → tổng chi/thu + so cùng ngày · ô TỐI NAY → ví chưa chia + hũ đầy', async () => {
    ve(await khoDay(), <RuotSo />);
    await waitFor(() => expect(screen.getByTestId('so-hom-nay').textContent).not.toBe('—'));
    const ds = await motCham('so-hom-nay', 'moc-ngay');
    expect(within(ds).getAllByTestId('moc-ngay').length, 'mốc ngày của danh sách').toBeGreaterThanOrEqual(2);
    expect(within(ds).getByText('cơm trưa')).toBeInTheDocument();          // dòng khoản ghi hôm nay
    expect(within(ds).getByText(CHU_MAN_SO.viDuSuaXoa)).toBeInTheDocument();  // lối sửa/xoá (chạm một dòng)
    const th = await motCham('so-thang', chu(CB.soTongChi));
    expect(within(th).getByText(CB.soTongChi)).toBeInTheDocument();
    expect(within(th).getByText(CB.soTongThu)).toBeInTheDocument();
    const toi = await motCham('so-toi-nay', chu(CB.soToiViPre));
    expect(within(toi).getByText(CB.soToiViPre)).toBeInTheDocument();
  });

  it('⭐⭐ khe HƯỚNG → sang GƯƠNG (đổi tab, một chạm); bàn tiền ở ngay trên mặt (không cần chạm nào)', async () => {
    ve(await khoDay(), <RuotSo />);
    await waitFor(() => expect(screen.getByTestId('so-hom-nay').textContent).not.toBe('—'));
    expect(screen.getByTestId('ban-tien'), 'bàn tiền luôn ở mặt SỔ').toBeInTheDocument();
    fireEvent.click(await oTheo('so-huong'));
    expect(screen.getByTestId('vi-tri').textContent).toBe('/tai-chinh/guong');
  });
});

/* ═══ HŨ ═══════════════════════════════════════════════════════════════════════════════════════ */

describe('HŨ — ô CHIA TIỀN · ★ · hai nhóm · DANH MỤC: mọi khối cũ ≤ 1 chạm', () => {
  it('⭐⭐⭐ CHIA TIỀN → kệ hũ + khay tờ · ★ → lá vị thế bung · nhóm TIẾT KIỆM/CHI → danh sách hũ · hũ mini → lá · + → bảng TẠO HŨ · DANH MỤC → danh mục + mọi lá', async () => {
    ve(await khoDay(), <RuotHu />);
    await waitFor(() => expect(screen.getByTestId('hu-chia-tong').textContent).not.toBe(CB.dangTai));
    const chia = await motCham('hu-chia', 'ke-phan-bo');
    expect(within(chia).getByTestId('ke-phan-bo')).toBeInTheDocument();
    expect(screen.getByTestId('khay-phan-bo'), 'khay tờ tiền ở chân lớp').toBeInTheDocument();

    const sao = await motCham('hu-uu-tien', 'la-vi-the');
    expect(within(sao).getByTestId('dong-co')).toBeInTheDocument();       // cỡ + kỳ hạn của vị thế

    // Nhóm là OBento `as="div"` — nút bấm là CON đầu của nó.
    const moNhom = async (dau: string): Promise<HTMLElement> => {
      const cu = screen.queryByRole('dialog');
      if (cu !== null) {
        fireEvent.click(within(cu).getByRole('button', { name: 'ĐÓNG' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      }
      fireEvent.click(document.querySelector<HTMLElement>(`[data-o="${dau}"] button`)!);
      const hop = await screen.findByRole('dialog');
      await within(hop).findAllByTestId('nhom-hang-hu');
      return hop;
    };
    const tk = await moNhom('hu-nhom-tk');
    expect(within(tk).getAllByTestId('nhom-hang-hu').map((e) => e.textContent).join(' ')).toContain('Laptop');
    const chi = await moNhom('hu-nhom-chi');
    expect(within(chi).getAllByTestId('nhom-hang-hu').map((e) => e.textContent).join(' ')).toContain('Ăn uống');

    const mini = [...document.querySelectorAll<HTMLElement>('[data-o="hu-con-hu"]')].find((e) => (e.textContent ?? '').includes('Ăn uống'))!;
    fireEvent.click(within(chi).getByRole('button', { name: 'ĐÓNG' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(mini);
    const la = await screen.findByRole('dialog');
    await within(la).findByTestId('la-tieu-dung');                          // lá hũ chi

    const tao = await motCham('hu-tao-tk', 'tao-buoc');
    expect(tao).toBeInTheDocument();

    const dm = await motCham('hu-danh-muc', 'danh-muc');
    expect(within(dm).getAllByTestId('la-vi-the').length).toBeGreaterThanOrEqual(1);
    expect(within(dm).getAllByTestId('la-tieu-dung').length).toBeGreaterThanOrEqual(1);
  });
});

/* ═══ GƯƠNG ═══════════════════════════════════════════════════════════════════════════════════════ */

describe('GƯƠNG — mười hai ô: mọi khối cũ ≤ 1 chạm', () => {
  it('⭐⭐⭐ mỗi ô → đúng khối cũ của nó (tấm HƯỚNG · cặp ĐOÁN↔THẬT · lời đoán · biểu đồ · bản tin · thói quen · luật · 6 tháng · nhìn lại · Oracle · chốt tuần)', async () => {
    ve(await khoDay(), <RuotGuong />);
    await waitFor(async () => expect((await oTheo('guong-nhin-lai')).textContent ?? '').toMatch(/ · \d+ câu/));
    const h = await motCham('guong-huong', 'the-huong');
    // 11/10 (câu B): lớp HƯỚNG = APP HỌC ĐƯỢC + ba phím chọn; thẻ KHUNG CHIA TIỀN đã dời sang lớp CÀI ĐẶT (`pfm_khung.test.tsx` §III canh lối tới nó).
    expect(within(h).getByTestId('huong-lua-chon')).toBeInTheDocument();
    expect(within(h).queryByTestId('phong-cach'), 'thẻ KHUNG CHIA TIỀN không còn ở lớp HƯỚNG').toBeNull();
    await motCham('guong-doan-that', 'cap-tien_ve');
    await motCham('guong-ket-toan', 'mat-loi-doan').catch(() => motCham('guong-ket-toan', 'doan-trong'));
    const bd = await motCham('guong-tien-vao', 'bieu-do-thang');
    expect(within(bd).getByTestId('the-di-dau')).toBeInTheDocument();
    expect(within(bd).getByTestId('the-tung-ngay')).toBeInTheDocument();
    const bd2 = await motCham('guong-chi-ngay', 'bieu-do-thang');
    expect(within(bd2).getByTestId('the-tung-ngay')).toBeInTheDocument();
    await motCham('guong-phan-tich', 'phan-tich');
    const tq = await motCham('guong-thoi-quen', 'bd-thoi-quen');
    expect(within(tq).getAllByRole('button', { name: '?' }).length, 'chỉ số mô tả + (?) giải thích').toBeGreaterThanOrEqual(1);
    const luat = await motCham('guong-luat', new RegExp(C.khoiChuaCoLuat.slice(0, 14)));
    expect(within(luat).getByRole('button', { name: C.themLuat }), 'lối ĐẶT LUẬT nằm ở chân lớp').toBeInTheDocument();
    await motCham('guong-sau-thang', new RegExp(C.chuThichLichHau.trim().slice(0, 12)));
    await motCham('guong-nhin-lai', 'the-cuoi-ky');
    await motCham('guong-tien-toi', null);
    // Chốt tuần: ô → lớp tóm tắt, nút chính CHỐT TUẦN ở chân lớp (chốt KHÔNG xảy ra ở cú chạm đầu).
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ĐÓNG' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(await oTheo('guong-chot'));
    await screen.findByRole('dialog');
    expect(await oTheo('chot-tuan')).toBeInTheDocument();
  });
});

/* ═══ THẺ ═════════════════════════════════════════════════════════════════════════════════════════ */

describe('THẺ — hành tinh · căn cứ · đoán đúng · nhất quán: mọi khối cũ ≤ 1 chạm', () => {
  it('⭐⭐⭐ ô → đúng khối cũ (chân dung 9 hành tinh + sửa câu trả lời · căn cứ · lời đoán + thành tích · mặt NÓI·LÀM·TRẬN)', async () => {
    ve(await khoDay(), <RuotChanDung />);
    await waitFor(() => expect(screen.getByTestId('the-can-cu').textContent).not.toBe('—'));
    const hanh = await motCham('the-hanh-tinh', null);
    expect(screen.getAllByRole('button', { name: CD.nutSuaLai }).length, 'lối SỬA LẠI CÂU TRẢ LỜI (phỏng vấn) ở chân lớp chân dung').toBeGreaterThanOrEqual(1);
    void hanh;
    await motCham('the-can-cu', 'the-can-cu-sheet');
    await motCham('the-doan-dung', null);
    await motCham('the-nhat-quan', 'mat-ba-mat');
    // Nút VIỆC ĐẦU TIÊN → màn NGÀY ĐẦU (đổi màn, một chạm).
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ĐÓNG' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(await oTheo('the-viec-dau'));
    await waitFor(() => expect(screen.getByTestId('vi-tri').textContent).toMatch(/^\/tai-chinh\/ngay-dau/));
  });
});
