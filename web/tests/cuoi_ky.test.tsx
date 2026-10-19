/**
 * PFM — THẺ NHÌN LẠI THÁNG TRƯỚC (D325). Câu hỏi của bài này: người dùng trả lời trên màn
 * GƯƠNG thì câu trả lời có THẬT SỰ tới đúng dòng dataset không — không phải "nút có hiện không".
 *  §I   ai được hỏi: hũ còn mở lúc kỳ khép (không hũ tạo sau, không hũ đã chốt), luật còn sống;
 *  §II  thẻ: mỗi lần MỘT câu, BỎ QUA không gọi ghi, bước cuối là hai dòng TỰ ĐẾM;
 *  §III ⭐⭐ đường thật: bấm nấc trên RuotGuong ⇒ kho có `ketQuaKy` ⇒ `xepGoiKy` phát
 *       `kq_dat_muc_tieu` vào gói THÁNG TRƯỚC, đúng id hũ; XONG ⇒ dấu nằm ở lát THÁNG SỐNG.
 *
 * ⚠ 11/10 (TẦNG KHÔNG GIAN): thẻ NHÌN LẠI nằm trong LỚP mở từ ô NHÌN LẠI (một trong sáu ô nhỏ của GƯƠNG), không đứng sẵn trên mặt — §III
 *   mở ô ấy trước. Luật giữ nguyên: câu trả lời tới đúng dòng dataset · XONG ghi dấu ở lát tháng sống · ĐỂ SAU không ghi gì.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const THANG = '2026-09';
const NGAY = '2026-09-15';

vi.mock('../src/lib/telemetry.js', () => ({ ghiDo: vi.fn(), manCuaDuong: () => '/tai-chinh/guong' }));
vi.mock('../src/pfm/thoi_gian.js', async (goc) => {
  const m = await goc<typeof import('../src/pfm/thoi_gian.js')>();
  return { ...m, homNay: () => NGAY, thangNay: () => THANG };
});

const { RuotGuong, TheCuoiKy } = await import('../src/screens/tai-chinh/Guong');
const { KhoProvider } = await import('../src/pfm/dung_kho');
const { KhoTrongBoNho } = await import('../src/pfm/kho.js');
const { khoanRaBanGhi, taoKhoan } = await import('../src/pfm/so.js');
const { doiTrangThai, quyetToan, tuTao } = await import('../src/pfm/hu.js');
const { banLuat, datBat, ghiNhanGiuVo, taoLuatMoi } = await import('../src/pfm/luat.js');
const { cauCuoiKy } = await import('../src/pfm/cuoi_ky.js');
const { xepGoiKy } = await import('../src/pfm/goi_ky.js');
const { CHU_BENTO: CB, CHU_KET_QUA_HU, CHU_MAN_GUONG: C } = await import('../src/lib/pfm_chu');

type Hu = import('../src/pfm/hu.js').Hu;
type MonHangDoi = import('../src/pfm/dong_bo.js').MonHangDoi;

const T8 = (ngay: number) => `2026-08-${String(ngay).padStart(2, '0')}T03:00:00.000Z`;
const khoan = (ngay: string, i: number) => taoKhoan({ ngay, soTien: 20_000, chieu: 'chi' }, T8(1), `k${i}`);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401, headers: { 'content-type': 'application/json' },
  })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/* ═══ §I ═════════════════════════════════════════════════════════════════════ */

describe('§I — ai được hỏi', () => {
  it('⭐ không hũ, không luật ⇒ null (không vẽ gì), dù tháng trước có ghi sổ', () => {
    expect(cauCuoiKy('2026-08', [khoan('2026-08-03', 0)], [], [])).toBeNull();
  });

  it('hũ còn mở qua tháng 8 được hỏi; hũ tạo tháng 9 và hũ chốt trong tháng 8 thì không', () => {
    const mo = tuTao({ ten: 'Mở' }, T8(2), 'h1');
    const sau = tuTao({ ten: 'Sau' }, '2026-09-02T03:00:00.000Z', 'h2');
    const chot = quyetToan(tuTao({ ten: 'Chốt' }, T8(2), 'h3'), 'xong', 'du', T8(20));
    const c = cauCuoiKy('2026-08', [], [mo, sau, chot], [])!;
    expect(c.hu.map((h) => h.id)).toEqual(['h1']);
  });

  it('luật đang tắt và không nhịp nào trong tháng 8 ⇒ không hỏi; tắt nhưng có nhịp tháng 8 ⇒ hỏi', () => {
    const tatIm = datBat(taoLuatMoi({ loiNhac: 'a', dieuKien: 'ngay_chi_lon' }, T8(1), 'l1'), false);
    let tatCoNhip = taoLuatMoi({ loiNhac: 'b', dieuKien: 'tien_vua_ve' }, T8(1), 'l2');
    tatCoNhip = datBat(ghiNhanGiuVo(banLuat(tatCoNhip, T8(9)), 'giu', T8(9)), false);
    const c = cauCuoiKy('2026-08', [], [], [tatIm, tatCoNhip])!;
    expect(c.luat.map((l) => l.id)).toEqual(['l2']);
  });

  it('hai dòng tự đếm: hũ bỏ TRONG kỳ, số NGÀY khác nhau có ghi', () => {
    const bo = doiTrangThai(tuTao({ ten: 'Bỏ' }, T8(2), 'h1'), 'bo_do', T8(11));
    const boThang7 = doiTrangThai(tuTao({ ten: 'Cũ' }, '2026-07-02T03:00:00.000Z', 'h2'), 'bo_do', '2026-07-09T03:00:00.000Z');
    const mo = tuTao({ ten: 'Mở' }, T8(2), 'h3');
    const so = [khoan('2026-08-03', 0), khoan('2026-08-03', 1), khoan('2026-08-07', 2), khoan('2026-09-01', 3)];
    const c = cauCuoiKy('2026-08', so, [bo, boThang7, mo], [])!;
    expect(c.soHuBo).toBe(1);
    expect(c.soNgayGhi).toBe(2);
  });
});

/* ═══ §II ════════════════════════════════════════════════════════════════════ */

describe('§II — thẻ: mỗi lần một câu', () => {
  function veThe(hu: Hu[]) {
    const luat = [taoLuatMoi({ loiNhac: 'Tối về xem lại sổ', dieuKien: 'ngay_chi_lon' }, T8(1), 'l1')];
    const cau = cauCuoiKy('2026-08', [khoan('2026-08-03', 0)], hu, luat)!;
    const f = { onHu: vi.fn(), onLuat: vi.fn(), onXong: vi.fn(), onDeSau: vi.fn() };
    render(<TheCuoiKy cau={cau} {...f} />);
    return f;
  }

  it('⭐ bấm nấc ⇒ gọi ghi với ĐÚNG hũ + nấc, rồi sang câu luật; bước cuối có XONG', () => {
    const f = veThe([tuTao({ ten: 'Đi Đà Lạt' }, T8(2), 'h1')]);
    expect(screen.getByText('1/3')).toBeTruthy();
    expect(screen.getByText(/HŨ ĐI ĐÀ LẠT · THÁNG 8 TỚI ĐÂU\?/)).toBeTruthy();
    fireEvent.click(screen.getByText(CHU_KET_QUA_HU.gan_du));
    expect(f.onHu).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1' }), 'gan_du');
    expect(screen.getByText('2/3')).toBeTruthy();
    fireEvent.click(screen.getByText('CHƯA RÕ'));
    expect(f.onLuat).toHaveBeenCalledWith(expect.objectContaining({ id: 'l1' }), 'chua_ro');
    expect(screen.getByTestId('ck-ngay-ghi').textContent).toBe('1');
    fireEvent.click(screen.getByText(C.ckXong));
    expect(f.onXong).toHaveBeenCalledTimes(1);
  });

  it('BỎ QUA sang câu sau mà KHÔNG gọi ghi; ĐỂ SAU gọi onDeSau, không gọi ghi', () => {
    const f = veThe([tuTao({ ten: 'Máy' }, T8(2), 'h1')]);
    fireEvent.click(screen.getByText(C.ckBoQua));
    expect(screen.getByText('2/3')).toBeTruthy();
    fireEvent.click(screen.getByText(C.ckDeSau));
    expect(f.onDeSau).toHaveBeenCalledTimes(1);
    expect(f.onHu).not.toHaveBeenCalled();
    expect(f.onLuat).not.toHaveBeenCalled();
  });
});

/* ═══ §III — đường thật ═════════════════════════════════════════════════════ */

function ve(kho: InstanceType<typeof KhoTrongBoNho>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/tai-chinh/guong']}>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}><RuotGuong /></KhoProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function khoMotHu(): Promise<InstanceType<typeof KhoTrongBoNho>> {
  const kho = new KhoTrongBoNho();
  await kho.ghi('khoan', khoanRaBanGhi(khoan('2026-08-03', 0)));
  await kho.ghi('hu', { id: 'h1', thang: THANG, suaLuc: T8(2), d: tuTao({ ten: 'Quỹ' }, T8(2), 'h1') });
  return kho;
}

/** Ô NHÌN LẠI (chờ có mặt) và lớp của nó. */
const oNhinLai = (): Promise<HTMLElement> => waitFor(() => {
  const e = document.querySelector<HTMLElement>('[data-o="guong-nhin-lai"]');
  expect(e).not.toBeNull();
  return e!;
});
async function moNhinLai(): Promise<void> {
  const o = await oNhinLai();
  // Ô nói "tháng 8 · N câu" khi còn câu chờ — mở khi dữ liệu đã tải xong.
  await waitFor(() => expect(o.textContent).toMatch(/ · \d+ câu/));
  fireEvent.click(o);
  await screen.findByRole('dialog');
}

describe('§III — ⭐⭐ từ màn GƯƠNG tới dòng dataset', () => {
  it('⭐⭐ bấm GẦN ĐỦ ⇒ kho giữ nấc tháng 8 ⇒ gói tháng 8 phát kq_dat_muc_tieu cho h1', async () => {
    const kho = await khoMotHu();
    ve(kho);
    await moNhinLai();
    fireEvent.click(within(await screen.findByTestId('the-cuoi-ky')).getByText(CHU_KET_QUA_HU.gan_du));
    await waitFor(async () => {
      expect((await kho.doc<Hu>('hu', 'h1'))!.d.ketQuaKy).toEqual({ '2026-08': 'gan_du' });
    });
    await xepGoiKy(kho, THANG, '2026-09-15T10:00:00.000Z');
    const m = (await kho.doc<MonHangDoi>('outbox', 'goi:2026-08'))!.d;
    const dong = m.loai === 'goi' ? m.goi.dong : [];
    expect(dong.filter((d) => d.ma === 'kq_dat_muc_tieu')).toEqual([
      { ma: 'kq_dat_muc_tieu', giaTri: 'gan_du', doiTuong: 'h1' },
    ]);
  });

  it('⭐ XONG ⇒ dấu cuoi_ky_2026-08 nằm ở lát THÁNG SỐNG (không làm bẩn lát tháng đã đóng); mở lại ⇒ thẻ không hiện', async () => {
    const kho = await khoMotHu();
    const { unmount } = ve(kho);
    await moNhinLai();
    // ⚠ Trong THẺ: thẻ Oracle cùng màn cũng có một nút BỎ QUA.
    const the = await screen.findByTestId('the-cuoi-ky');
    fireEvent.click(within(the).getByText(C.ckBoQua));
    fireEvent.click(within(the).getByText(C.ckXong));
    await waitFor(async () => {
      const dau = await kho.doc<{ ky: string }>('nhip', 'cuoi_ky_2026-08');
      expect(dau?.thang).toBe(THANG);
    });
    expect(screen.queryByTestId('the-cuoi-ky')).toBeNull();
    unmount();
    ve(kho);
    /* Tầng không gian: mốc "màn đã dựng xong" là ô NHÌN LẠI đổi sang "đã xong" (dấu `cuoi_ky_2026-08` đã nằm trong kho); mở ô ⇒ lớp KHÔNG có thẻ. */
    const o = await oNhinLai();
    await waitFor(() => expect(o.textContent).toContain(CB.guDaXong));
    fireEvent.click(o);
    expect(await screen.findByTestId('nhin-lai-trong')).toHaveTextContent(CB.guNhinLaiXong);
    expect(screen.queryByTestId('the-cuoi-ky')).toBeNull();
  });

  it('ĐỂ SAU ⇒ ẩn lần này, KHÔNG ghi gì; mở lại Gương ⇒ thẻ quay lại', async () => {
    const kho = await khoMotHu();
    const { unmount } = ve(kho);
    await moNhinLai();
    fireEvent.click(within(await screen.findByTestId('the-cuoi-ky')).getByText(C.ckDeSau));
    // ĐỂ SAU đóng lớp (lớp còn trượt xuống một nhịp rồi mới rời DOM) và ẩn thẻ tới lần mở Gương sau.
    await waitFor(() => expect(screen.queryByTestId('the-cuoi-ky')).toBeNull());
    expect(await kho.doc('nhip', 'cuoi_ky_2026-08')).toBeNull();
    expect((await kho.doc<Hu>('hu', 'h1'))!.d.ketQuaKy).toBeUndefined();
    unmount();
    ve(kho);
    await moNhinLai();
    expect(await screen.findByTestId('the-cuoi-ky')).toBeTruthy();
  });
});
