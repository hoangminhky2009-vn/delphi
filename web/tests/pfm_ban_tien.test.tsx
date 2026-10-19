/**
 * PFM — BÀN TIỀN (`BanTien.tsx`), theo DEMO ĐÃ CHỐT (A11.25) + D410 (founder 26/09).
 *
 * ⚠ §I khoá đúng những con số của demo (chín tờ, ba bậc). Chúng là thứ founder đã bấm thử và duyệt, nên đổi một cái
 * là phải quay lại demo — bài test ở đây là chỗ chặn cú đổi lén.
 * ⚠⚠ §II khoá LUẬT D410: *"nguyên tắc cố định và nhanh tiện phần chọn tiền"* — hai đích CHI/THU luôn nằm sẵn, và
 * mặt bàn không mọc/mất khối nào giữa khay rỗng và khay có tiền (bản 04/09 mọc lưới nhãn + hũ + bong bóng Oracle,
 * đo 26/09: phình che gần hết màn, lưới tiền trượt 32px khi đang ở đáy trang).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BanTien, HOAN_TAC_MS, TO_TIEN, demKhuat, nhanTo,
} from '../src/components/pfm/BanTien';
import { KhoProvider } from '../src/pfm/dung_kho';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { locKhoanSo, type Khoan } from '../src/pfm/so.js';
import { CHU_BENTO as CB, CHU_PHAN_BO as CP } from '../src/lib/pfm_chu';

/** Số TO ở khay (bên trái — chỉ đọc). Cửa gõ số là nút GÕ SỐ ở hàng đáy. */
const khayTong = (): HTMLElement => screen.getByTestId('khay-tong');

vi.mock('../src/lib/telemetry.js', () => ({ ghiDo: vi.fn(), manCuaDuong: () => '/tai-chinh/so' }));
const { ghiDo } = await import('../src/lib/telemetry.js');

function ve(kho: KhoTrongBoNho, onGhi?: (id: string) => void) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <KhoProvider kho={kho}><BanTien onGhi={onGhi} /></KhoProvider>
    </QueryClientProvider>,
  );
}

/** Đọc sổ trong kho — nguồn sự thật, không đọc DOM. */
async function so(kho: KhoTrongBoNho): Promise<Khoan[]> {
  return locKhoanSo((await kho.liet<Khoan>('khoan')).map((b) => b.d));
}

/*
 * ⚠ Nhắm ĐÚNG lưới tiền. Chip trong khay cũng mang nhãn "500k", nên `getByRole` toàn cục
 * thành mơ hồ ngay khi đã cầm một tờ — và cái mơ hồ ấy làm bài test bấm nhầm vào chip
 * (tức BỎ một tờ) trong khi nó tưởng mình đang thêm.
 */
const bamTo = (k: number) => fireEvent.click(
  within(screen.getByRole('group', { name: 'Mệnh giá tiền' }))
    .getByRole('button', { name: nhanTo(k) }),
);

beforeEach(() => { vi.mocked(ghiDo).mockClear(); });

describe('§I — ⭐⭐ đúng con số của demo', () => {
  it('⭐⭐ CHÍN tờ, ba bậc, không tờ nào nổi hơn tờ nào', () => {
    /*
     * ⚠ Cỡ khoản chi là một TRỤC DỮ LIỆU đang đo. Làm nổi một mệnh giá (to hơn, sáng hơn,
     * đặt riêng) là bẻ trục ấy bằng ma sát — đúng luật bốn-chip-bằng-nhau (D92 §5). Ở đây
     * khoá bằng cấu trúc: chín tờ, và `soc` chỉ nhận ba giá trị = ba bậc.
     */
    expect(TO_TIEN).toHaveLength(9);
    expect(TO_TIEN.map((t) => t.gt)).toEqual([1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5]);
    expect(new Set(TO_TIEN.map((t) => t.soc)).size, 'ba bậc ⇒ ba bước sọc').toBe(3);
    expect(new Set(TO_TIEN.map((t) => t.m)).size, 'chín mã màu riêng').toBe(9);
  });

  it('nhãn tờ: 1k … 500k', () => {
    expect(nhanTo(1_000)).toBe('1k');
    expect(nhanTo(500_000)).toBe('500k');
  });
});

/**
 * "Hình khung" của bàn tiền: từng con TRỰC TIẾP của mặt bàn, theo thứ tự — thẻ · lớp · có bị ẩn không. Một khối mọc ra,
 * mất đi, hay ẩn/hiện (`hidden`) giữa hai cú chạm đều đổi chuỗi này.
 */
const khungBan = (c: HTMLElement): string[] => [...(c.firstElementChild as HTMLElement).children]
  .map((e) => `${e.tagName}.${e.className}${(e as HTMLElement).hidden ? '[hidden]' : ''}`);

describe('§II — ⭐⭐⭐ cầm tiền rồi chạm CHI/THU — hai đích CỐ ĐỊNH (D410)', () => {
  it('⭐⭐⭐ khay RỖNG ⇒ hai đích CHI · THU đã nằm sẵn (tắt); không còn lưới nhãn/hũ nào', async () => {
    ve(new KhoTrongBoNho());
    const chi = screen.getByRole('button', { name: CP.nutChi }) as HTMLButtonElement;
    const thu = screen.getByRole('button', { name: CP.nutThu }) as HTMLButtonElement;
    expect(chi.disabled, 'khay rỗng ⇒ tắt, nhưng VẪN Ở ĐÓ').toBe(true);
    expect(thu.disabled).toBe(true);
    expect(screen.queryByText('GHI VÀO ↓')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ĂN' }), 'nhãn không hỏi lúc ghi nữa').not.toBeInTheDocument();
    expect(screen.getByText(CB.banChamTo)).toBeInTheDocument();
  });

  it('⭐⭐⭐ LUẬT CỐ ĐỊNH: chạm tờ KHÔNG làm mọc hay mất khối nào trong mặt bàn — kể cả món lớn', async () => {
    /*
     * ⚠⚠ Bài canh của câu founder: *"vừa bấm vào thì nhảy mẹ màn hình khác đẩy phần chọn tiền đi"*. jsdom không đo
     * được pixel, nên canh bằng HÌNH KHUNG: danh sách con trực tiếp của mặt bàn phải y hệt trước và sau cú chạm (một
     * khối mọc ra là một lần lưới tiền bị đẩy). Chạm cả tờ 500k để chắc dòng Oracle "món lớn" cũng không mọc khối mới.
     */
    const { container } = ve(new KhoTrongBoNho());
    const truoc = khungBan(container);
    bamTo(20_000);
    expect(khungBan(container)).toEqual(truoc);
    bamTo(500_000); bamTo(500_000);
    expect(khungBan(container)).toEqual(truoc);
    expect((screen.getByRole('button', { name: CP.nutChi }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('⭐⭐⭐ chạm tờ ⇒ tổng cộng dồn, hai đích bật', async () => {
    ve(new KhoTrongBoNho());
    bamTo(20_000);
    bamTo(5_000);
    expect(khayTong()).toHaveTextContent('25.000đ');
    expect(screen.getByText(CB.banDangCam), 'cầm tiền ⇒ nhãn ĐANG CẦM').toBeInTheDocument();
    expect((screen.getByRole('button', { name: CP.nutThu }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('⭐⭐ tờ TRÙNG mệnh giá gộp thành chồng có số đếm', async () => {
    // Bấm 500k bốn lần thì khay nói "500k ×4", không phải bốn ô giống hệt xếp hàng.
    ve(new KhoTrongBoNho());
    bamTo(500_000); bamTo(500_000); bamTo(500_000);
    expect(screen.getByTitle('Bỏ một tờ 500k').textContent).toMatch(/×3/);
  });

  it('⭐ chạm chồng ⇒ bỏ ra MỘT tờ, không bỏ cả chồng', async () => {
    ve(new KhoTrongBoNho());
    bamTo(100_000); bamTo(100_000);
    fireEvent.click(screen.getByTitle('Bỏ một tờ 100k'));
    expect(khayTong()).toHaveTextContent('100.000đ');
  });

  it('⭐⭐⭐ chạm − CHI ⇒ ghi đúng một khoản CHI, KHÔNG nhãn, KHÔNG hũ (tối phân bổ), khay sạch', async () => {
    const kho = new KhoTrongBoNho();
    ve(kho);
    bamTo(20_000);
    bamTo(10_000);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });

    await waitFor(async () => expect(await so(kho)).toHaveLength(1));
    const k = (await so(kho))[0]!;
    expect(k.soTien).toBe(30_000);
    expect(k.chieu).toBe('chi');
    expect(k.nhan, 'không hỏi nhãn lúc ghi (D410)').toBeNull();
    expect(k.huId, 'hũ gắn lúc tối, ở khay phân bổ').toBeNull();
    expect(screen.getByText(CB.banChamTo), 'khay phải sạch sau khi ghi').toBeInTheDocument();
    expect(khayTong().textContent).toBe('0đ');
  });

  it('⭐ THU ghi thẳng, KHÔNG hỏi nguồn', async () => {
    /*
     * Founder 04/09: *"user sẽ thắc mắc biết nguồn để làm gì"*. Không mất dữ liệu:
     * `ctx_nguon_thu` là câu hỏi HOÀN CẢNH hỏi một lần ở cửa vào, còn nhịp tiền vào suy
     * từ NGÀY các khoản thu.
     */
    const kho = new KhoTrongBoNho();
    ve(kho);
    bamTo(500_000);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutThu })); });
    await waitFor(async () => expect((await so(kho))[0]?.chieu).toBe('thu'));
    expect((await so(kho))[0]!.nhan, 'THU không mang nhãn loại chi').toBeNull();
  });

});

describe('§III — ⭐⭐ bàn phím: MỘT cửa gõ tay', () => {
  it('⭐⭐ nút GÕ SỐ (hàng đáy, cạnh CHI/THU) là cửa mở bàn phím, và bàn phím THAY CHỖ lưới tiền', async () => {
    // Demo bỏ ô `⌨ GÕ` cuối dải tiền: một cửa, không hai. Và bàn phím thay chỗ lưới tiền
    // nên đáy không cao thêm, lưới đích phía trên không xê dịch.
    ve(new KhoTrongBoNho());
    const nut = screen.getByTitle('Chạm để gõ số');
    expect(nut).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(nut);
    expect(nut).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '000' })).toBeInTheDocument();
  });

  it('⭐ "hai triệu" đúng BỐN chạm: ⌨ · 2 · 000 · 000', async () => {
    ve(new KhoTrongBoNho());
    fireEvent.click(screen.getByTitle('Chạm để gõ số'));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '000' }));
    fireEvent.click(screen.getByRole('button', { name: '000' }));
    expect(khayTong()).toHaveTextContent('2.000.000đ');
  });

  it('⭐⭐ ĐÓNG bàn phím thì CHỐT số đang gõ vào khay', async () => {
    // Không để nó treo ở chỗ người dùng không còn sửa được.
    ve(new KhoTrongBoNho());
    const nut = screen.getByTitle('Chạm để gõ số');
    fireEvent.click(nut);
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    fireEvent.click(nut);
    expect(screen.getByTitle('Bỏ một tờ 5')).toBeInTheDocument();
  });

  it('⌫ xoá một chữ số', async () => {
    ve(new KhoTrongBoNho());
    fireEvent.click(screen.getByTitle('Chạm để gõ số'));
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByLabelText('Xoá một chữ số'));
    expect(khayTong().textContent).toBe('1đ');
  });
});

describe('§IV — ⭐⭐⭐ hoàn tác 4 giây', () => {
  it('⭐⭐⭐ HOÀN TÁC đặt BIA MỘ, không xoá hẳn', async () => {
    /*
     * ⚠⚠ Cú xoá phải LAN được sang máy khác qua két — xoá hẳn thì khoản ấy "sống lại" ở
     * lần khôi phục sau (`kho.ts`: bia mộ tồn tại đúng để làm việc đó).
     */
    const kho = new KhoTrongBoNho();
    ve(kho);
    bamTo(50_000);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(async () => expect(await so(kho)).toHaveLength(1));

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'HOÀN TÁC' })); });
    await waitFor(async () => expect(await so(kho), 'khuất khỏi sổ').toHaveLength(0));
    expect(await kho.liet('khoan', { keCaDaXoa: true }), 'nhưng BIA MỘ còn').toHaveLength(1);
  });

  it(`toast tự đóng sau ${HOAN_TAC_MS}ms`, async () => {
    vi.useFakeTimers();
    try {
      const kho = new KhoTrongBoNho();
      ve(kho);
      bamTo(10_000);
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
      expect(screen.getByRole('status')).toBeInTheDocument();
      await act(async () => { vi.advanceTimersByTime(HOAN_TAC_MS + 50); });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });
});

describe('§V — ⭐⭐ telemetry `pfm_ghi{cach}`', () => {
  it('⭐⭐ chạm tờ ⇒ `cach: to`, nhưng `cachGhi` của SỔ vẫn là `tay`', async () => {
    /*
     * ⚠⚠ HAI TRỤC KHÁC NHAU, và trộn chúng là đổi sổ đăng ký. `hv_cach_ghi` là ĐẶC TRƯNG
     * nghiên cứu (`tay | mau_lap | dan_sms`); nhập bằng tờ hay bàn phím **đều là `tay`**.
     * `pfm_ghi{cach}` là telemetry giao diện, trả lời câu *"chọn tờ có kéo người ta làm
     * tròn số không"*. Thêm giá trị vào `hv_cach_ghi` là phải tăng `SCHEMA_VERSION`.
     */
    const kho = new KhoTrongBoNho();
    ve(kho);
    bamTo(20_000);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(async () => expect(await so(kho)).toHaveLength(1));

    expect(vi.mocked(ghiDo)).toHaveBeenCalledWith('pfm_ghi', { chi_tiet: { cach: 'to' } });
    expect((await so(kho))[0]!.cachGhi, 'sổ vẫn ghi là `tay`').toBe('tay');
  });

  it('gõ số ⇒ `cach: go`', async () => {
    const kho = new KhoTrongBoNho();
    ve(kho);
    fireEvent.click(screen.getByTitle('Chạm để gõ số'));
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(async () => expect(await so(kho)).toHaveLength(1));
    expect(vi.mocked(ghiDo)).toHaveBeenCalledWith('pfm_ghi', { chi_tiet: { cach: 'go' } });
  });

  it('⭐ telemetry KHÔNG mang số tiền', async () => {
    // Số tiền của người dùng không rời máy (P2 🔒) — telemetry chỉ đếm CÁCH nhập.
    const kho = new KhoTrongBoNho();
    ve(kho);
    bamTo(123_000 - 23_000);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(async () => expect(await so(kho)).toHaveLength(1));
    const goi = vi.mocked(ghiDo).mock.calls.filter((c) => c[0] === 'pfm_ghi');
    expect(JSON.stringify(goi)).not.toMatch(/100000|100\.000/);
  });
});

describe('§VI — ↺ LẶP', () => {
  it('⭐ chỉ hiện khi khay RỖNG và đã từng ghi; một chạm là cầm lại số cũ', async () => {
    const kho = new KhoTrongBoNho();
    ve(kho);
    expect(screen.queryByTitle('Lặp lại khoản gần nhất')).not.toBeInTheDocument();

    bamTo(50_000);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(() => expect(screen.getByTitle('Lặp lại khoản gần nhất')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Lặp lại khoản gần nhất'));
    expect(khayTong()).toHaveTextContent('50.000đ');
  });
});

describe('§VII — ⭐⭐⭐ cầm tiền ⇒ khai "đang thao tác" cho lớp phủ toàn cục', () => {
  /*
   * ⚠⚠ ĐÂY LÀ CHỖ NỐI, và chỗ nối là họ lỗi đắt nhất của đợt này: một đầu khai đầy đủ,
   * đầu kia không ai gọi, và KHÔNG CÓ GÌ ĐỎ vì mỗi bên tự nó đúng. `thao_tac.test.tsx`
   * canh cái cờ; bài dưới đây canh việc BÀN TIỀN thật sự kéo cờ ấy lên đúng lúc.
   *
   * Vì sao lại là bàn tiền: bong bóng Oracle kéo được và neo mặc định của nó đè lên HÀNG
   * TỜ ĐẦU TIÊN ở màn 375px (D284 đã đo). Mờ thôi không đủ — thứ mờ vẫn ăn cú chạm.
   */
  it('⭐⭐⭐ khay rỗng ⇒ không cờ; cầm tiền ⇒ cờ lên; ghi xong ⇒ cờ xuống', async () => {
    const kho = new KhoTrongBoNho();
    ve(kho);
    expect(document.body.dataset.dangThaoTac, 'khay rỗng thì không giấu gì cả').toBeUndefined();

    bamTo(100_000);
    await waitFor(() => expect(document.body.dataset.dangThaoTac).toBe('co'));

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(async () => expect(await so(kho)).toHaveLength(1));
    // ⚠ Ghi xong là khay rỗng ⇒ phải TRẢ màn lại nguyên trạng, không giữ cờ.
    await waitFor(() => expect(document.body.dataset.dangThaoTac).toBeUndefined());
  });

  it('⭐⭐ rời màn giữa lúc đang cầm tiền vẫn nhả cờ', async () => {
    /*
     * Người dùng cầm 500k rồi bấm back. Nếu cờ kẹt thì Oracle biến mất ở MỌI màn còn lại
     * của phiên — hỏng im lặng, và không ai nối được nó về cú bấm này.
     */
    const kho = new KhoTrongBoNho();
    const r = ve(kho);
    bamTo(500_000);
    await waitFor(() => expect(document.body.dataset.dangThaoTac).toBe('co'));
    r.unmount();
    expect(document.body.dataset.dangThaoTac).toBeUndefined();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * §VIII — KHAY TRÀN: cuộn ngang + ô `+N`
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠⚠ ĐO BỐ CỤC TRONG jsdom: mọi số đo hình học là **0**, nên bài nào nói về tràn khay đều
 * phải TỰ ĐẶT số đo. Đó cũng là lý do `demKhuat()` được tách thành hàm thuần — phần khó
 * (đếm theo hướng) kiểm được bằng số, phần DOM chỉ còn là một lớp đọc thuộc tính.
 * ⚠ `scrollLeft` khai WRITABLE: chính component ghi vào nó (cú trượt tự lái), và một
 *   thuộc tính chỉ-đọc sẽ làm cú ghi ấy ném lỗi ở chế độ strict.
 */
function doKhung(el: HTMLElement, rong: number, noiDung: number, cuon = 0): void {
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: rong });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: noiDung });
  Object.defineProperty(el, 'scrollLeft', { configurable: true, writable: true, value: cuon });
}

function doChip(el: HTMLElement, trai: number, rong: number): void {
  Object.defineProperty(el, 'offsetLeft', { configurable: true, value: trai });
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: rong });
}

/** Bốn tờ khác mệnh giá, mỗi chip rộng 40 đứng liền nhau ⇒ dải 160px. */
function bonToTrongKhay(container: HTMLElement, rongKhay: number, cuon = 0): HTMLElement {
  bamTo(1_000); bamTo(2_000); bamTo(5_000); bamTo(10_000);
  const cuonEl = container.querySelector<HTMLElement>('[data-khay="cuon"]')!;
  const chip = [...container.querySelectorAll<HTMLElement>('[data-gt]')];
  expect(chip, 'bốn mệnh giá khác nhau ⇒ bốn chip').toHaveLength(4);
  chip.forEach((c, i) => doChip(c, i * 40, 40));
  doKhung(cuonEl, rongKhay, 160, cuon);
  return cuonEl;
}

describe('§VII-bis — ⭐⭐⭐ chạm RA NGOÀI ⇒ bàn tiền thu xuống (D420)', () => {
  /*
   * Founder 26/09: *"Phần sổ khi bấm ra ngoài bàn phím thì có thể ẩn bàn phím xuống dưới để user có không gian nhìn"*.
   * Luật đi kèm (D410, founder): bàn tiền CỐ ĐỊNH giữa hai cú chạm — nên chỉ cú chạm RA NGOÀI mới thu nó, và tiền đang
   * cầm không được mất. (jsdom không có WAAPI ⇒ thu/mở tức thì; nhịp trượt đo trên bản build.)
   */
  const ban = (): HTMLElement => screen.getByTestId('ban-tien');

  it('⭐⭐⭐ chạm TRONG bàn (tờ) không thu · chạm ra ngoài ⇒ thu, tiền cầm vẫn còn · chạm hàng khay ⇒ CHỈ mở · ghi tiếp được', async () => {
    const kho = new KhoTrongBoNho();
    ve(kho);
    expect(ban().getAttribute('data-thu')).toBe('khong');
    bamTo(50_000);
    expect(ban().getAttribute('data-thu'), 'chạm tờ là chạm TRONG bàn').toBe('khong');
    await act(async () => { fireEvent.click(document.body); });
    await waitFor(() => expect(ban().getAttribute('data-thu')).toBe('co'));
    expect(khayTong().textContent, 'thu xuống không bỏ tiền đang cầm').toMatch(/50\.000/);
    fireEvent.click(khayTong());
    await waitFor(() => expect(ban().getAttribute('data-thu')).toBe('khong'));
    expect(screen.getByTitle('Chạm để gõ số').getAttribute('aria-pressed'), 'cú chạm mở bàn KHÔNG lật bàn phím').toBe('false');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(async () => expect((await so(kho)).map((k) => k.soTien)).toEqual([50_000]));
  });

  it('⭐⭐ khay rỗng mà thu ⇒ hàng khay nói "▲ GHI TIỀN"', async () => {
    ve(new KhoTrongBoNho());
    await act(async () => { fireEvent.click(document.body); });
    await waitFor(() => expect(screen.getByText(CP.moBan)).toBeInTheDocument());
  });

  it('⭐⭐ đang thu mà chạm HOÀN TÁC ⇒ hoàn tác chạy (không bị nuốt thành cú mở bàn)', async () => {
    const kho = new KhoTrongBoNho();
    ve(kho);
    bamTo(20_000);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(async () => expect(await so(kho)).toHaveLength(1));
    await act(async () => { fireEvent.click(document.body); });
    await waitFor(() => expect(ban().getAttribute('data-thu')).toBe('co'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'HOÀN TÁC' })); });
    await waitFor(async () => expect(await so(kho)).toHaveLength(0));
  });

  it('⭐ nút mang `data-mo-ban-tien` (SỬA LẠI một dòng) là lối VÀO — chạm nó không thu bàn', async () => {
    ve(new KhoTrongBoNho());
    const nut = document.createElement('button');
    nut.setAttribute('data-mo-ban-tien', '');
    document.body.appendChild(nut);
    await act(async () => { fireEvent.click(nut); });
    expect(ban().getAttribute('data-thu')).toBe('khong');
    nut.remove();
  });
});

describe('§VIII — ⭐⭐ khay tràn: `demKhuat` đếm theo HƯỚNG', () => {
  const chip4 = [
    { trai: 0, rong: 40 }, { trai: 40, rong: 40 },
    { trai: 80, rong: 40 }, { trai: 120, rong: 40 },
  ];

  it('⭐ khay ĐỦ RỘNG ⇒ không tràn, không đếm gì', () => {
    // Không có dòng này thì mọi khay đều đeo một cái ô "+0" vô nghĩa.
    const k = demKhuat({ scrollLeft: 0, clientWidth: 400, scrollWidth: 160 }, chip4);
    expect(k).toEqual({ tran: false, trai: 0, phai: 0 });
  });

  it('⭐⭐ ở ĐẦU DẢI: đếm tờ khuất bên PHẢI, không đếm bên trái', () => {
    const k = demKhuat({ scrollLeft: 0, clientWidth: 80, scrollWidth: 160 }, chip4);
    expect(k).toEqual({ tran: true, trai: 0, phai: 2 });
  });

  it('⭐⭐⭐ cuộn tới CUỐI ⇒ số đổi sang đầu KIA — "đúng số học, sai lời hứa" là lỗi cũ', () => {
    /*
     * ⚠⚠ Bản demo đầu đếm cả hai phía nên tới mép phải nó vẫn báo "+4" — mấy tờ đã lùi ra
     * SAU lưng — mà bấm thì không đi đâu được. Bài này khoá đúng chỗ ấy: hết đường phải
     * thì `phai` phải về 0, và `trai` mới là số nói lên có gì sau lưng.
     */
    const k = demKhuat({ scrollLeft: 80, clientWidth: 80, scrollWidth: 160 }, chip4);
    expect(k).toEqual({ tran: true, trai: 2, phai: 0 });
  });

  it('⭐ đứng GIỮA dải ⇒ khuất cả hai đầu, đếm rời nhau', () => {
    const k = demKhuat({ scrollLeft: 40, clientWidth: 80, scrollWidth: 160 }, chip4);
    expect(k).toEqual({ tran: true, trai: 1, phai: 1 });
  });
});

describe('§VIII-bis — ⭐⭐⭐ ô `+N` trên màn thật', () => {
  it('⭐ khay NGẮN (không tràn) ⇒ KHÔNG có ô `+N`', () => {
    const { container } = ve(new KhoTrongBoNho());
    const cuonEl = bonToTrongKhay(container, 400);
    fireEvent.scroll(cuonEl);
    expect(container.querySelector('[data-khay="cuon"] ~ button[title]')?.textContent ?? '')
      .not.toMatch(/^\+/);
    expect(screen.queryByTitle(/còn \d+ tờ nữa/)).not.toBeInTheDocument();
    expect(screen.queryByTitle('về đầu dải')).not.toBeInTheDocument();
  });

  it('⭐⭐⭐ tràn ⇒ ô `+N` hiện với ĐÚNG N, và nó nằm NGOÀI vùng cuộn', () => {
    const { container } = ve(new KhoTrongBoNho());
    const cuonEl = bonToTrongKhay(container, 80);
    fireEvent.scroll(cuonEl);

    const nut = screen.getByTitle(/còn 2 tờ nữa/);
    expect(nut.textContent).toBe('+2');
    /*
     * ⚠ Ô `+N` phải là ANH EM của vùng cuộn, không phải con: để trong thì chính cái báo
     * tràn cũng trôi mất — cái báo tràn lại bị tràn.
     */
    expect(cuonEl.contains(nut), 'ô +N nằm TRONG vùng cuộn').toBe(false);
    expect(nut.parentElement).toBe(cuonEl.parentElement);
  });

  it('⭐⭐⭐ cuộn tới cuối ⇒ nút ĐỔI VAI thành `↺ về đầu dải`, và mờ đổi sang mép TRÁI', () => {
    const { container } = ve(new KhoTrongBoNho());
    const cuonEl = bonToTrongKhay(container, 80);
    fireEvent.scroll(cuonEl);
    expect(screen.getByTitle(/còn 2 tờ nữa/)).toBeInTheDocument();

    (cuonEl as unknown as { scrollLeft: number }).scrollLeft = 80;
    fireEvent.scroll(cuonEl);

    expect(screen.queryByTitle(/còn \d+ tờ nữa/), 'hết đường phải').not.toBeInTheDocument();
    expect(screen.getByTitle('về đầu dải').textContent).toBe('↺');
    // Mờ trái = "sau lưng còn"; mờ phải phải TẮT, không thì nó hứa một hướng đã hết.
    expect(cuonEl.style.getPropertyValue('--mL')).toBe('20px');
    expect(cuonEl.style.getPropertyValue('--mR')).toBe('0px');
  });

  it('⭐⭐⭐ bấm `+N` ⇒ khay trượt VÀ số đếm lại NGAY, không chờ sự kiện `scroll`', () => {
    /*
     * ⚠⚠ ĐÂY LÀ BÀI CANH CỦA §9: mọi thứ móc vào nhịp vẽ đều có thể LẶNG LẼ không chạy
     * (rAF không gọi khi khung ẩn · `scroll` không bắn · `behavior:'smooth'` đứng yên).
     * Bài này không bắn một sự kiện `scroll` nào sau cú bấm — nếu phép đếm chờ sự kiện
     * thì con số đứng nguyên trong khi khay đã trượt, tức một con số nói dối.
     */
    const { container } = ve(new KhoTrongBoNho());
    const cuonEl = bonToTrongKhay(container, 80);
    fireEvent.scroll(cuonEl);

    fireEvent.click(screen.getByTitle(/còn 2 tờ nữa/));

    expect(cuonEl.scrollLeft, 'bước đầu của cú trượt tự lái').toBeGreaterThan(0);
    expect(screen.getByTitle(/còn 1 tờ nữa/).textContent).toBe('+1');
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * §IX — ⭐⭐⭐ VÙNG CHẠM CỦA Ô `+N`: hằng TS ↔ selector CSS là HAI ĐẦU DÂY
 *
 * ⚠⚠ Bài này đọc THẲNG TỆP CSS, đúng nếp §III của `thao_tac.test.tsx`, và nó phải làm thế
 * vì không có gì trong TypeScript nối hai đầu ấy: `SAN_CHAM_PX` là một con số trong TS,
 * còn thứ quyết định ngón tay bấm trúng hay không là một luật CSS. `jsdom` không tính bố
 * cục nên `getBoundingClientRect()` ở đây trả 0 hết — đo trên DOM là đo một con số giả.
 * ⚠ Và hỏng ở đây IM LẶNG theo kiểu tệ nhất: nút vẫn hiện, vẫn bấm được bằng chuột, vẫn
 *   xanh mọi bài — chỉ ngón tay trượt.
 * ═════════════════════════════════════════════════════════════════════════ */

/** Sàn vùng chạm — LỖI #2 của D236: *"44px là sàn, không phải mục tiêu."* */
const SAN_CHAM_PX = 44;

/**
 * Tước comment TRƯỚC khi tìm selector — tệp CSS này viết chú thích tiếng Việt có nhắc
 * `.themNua::before` và cả `44px`, nên không tước là bài test tự đọc trúng lời mình dặn
 * rồi xanh dù luật thật đã bị xoá.
 */
const tuocChuThich = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Cắt đúng thân một luật CSS theo selector (đã tước comment). */
function than(css: string, selector: string): string {
  const i = css.indexOf(selector);
  if (i < 0) return '';
  return css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
}

describe('§IX — ⭐⭐⭐ ô `+N` phải có vùng chạm ≥ 44px', () => {
  const css = tuocChuThich(
    readFileSync(resolve(__dirname, '../src/components/pfm/BanTien.module.css'), 'utf8'),
  );

  it('⭐⭐⭐ có LỚP PHỦ `::before` ≥ 44px ở cả hai chiều', () => {
    /*
     * ⚠ Ô `+N` là đường điều khiển **DUY NHẤT bằng ngón tay** cho khay tràn — kéo ngang
     * bằng chuột và lăn chuột đều là đường của CHUỘT. Trượt ngón khỏi một ô 26px là mất
     * luôn cách xem mấy tờ đang khuất, mà không có gì báo.
     */
    const phu = than(css, '.themNua::before');
    expect(phu, 'demo đã sửa 06/09: nới vùng chạm bằng lớp phủ trong suốt').not.toBe('');
    const rong = /width:\s*(\d+(?:\.\d+)?)px/.exec(phu);
    const cao = /height:\s*(\d+(?:\.\d+)?)px/.exec(phu);
    expect(rong, 'lớp phủ phải khai `width` bằng px').not.toBeNull();
    expect(cao, 'lớp phủ phải khai `height` bằng px').not.toBeNull();
    expect(Number(rong![1]), `bề ngang vùng chạm < ${SAN_CHAM_PX}px`)
      .toBeGreaterThanOrEqual(SAN_CHAM_PX);
    expect(Number(cao![1]), `bề cao vùng chạm < ${SAN_CHAM_PX}px`)
      .toBeGreaterThanOrEqual(SAN_CHAM_PX);
    expect(phu, 'phải trong suốt — có nền là đổi HÌNH, demo giữ nguyên 26×28')
      .not.toMatch(/background(?!-)/);
  });

  it('⭐⭐ lớp phủ neo vào ĐÚNG ô: `.themNua` phải `position: relative`', () => {
    /*
     * ⚠⚠ Thiếu dòng này thì `position:absolute` của lớp phủ bám vào một tổ tiên khác, và
     * vùng chạm 44px nở ra ở MỘT CHỖ KHÁC trên màn — vẫn không lỗi, vẫn không cảnh báo,
     * và tệ hơn hẳn ô 26px vì giờ có một vùng bấm vô hình nằm sai chỗ.
     */
    expect(than(css, '.themNua {')).toMatch(/position:\s*relative/);
  });

  it('⭐ HÌNH vẫn đúng demo: ô 26×28, không phóng to theo vùng chạm', () => {
    // Vùng đáy có chiều cao đã chốt ở demo — phóng ô lên 44px là đẩy cả khay.
    const o = than(css, '.themNua {');
    expect(o).toMatch(/min-width:\s*26px/);
    expect(o).toMatch(/height:\s*28px/);
  });
});

describe('§ORACLE GIÚP 4 — món lớn đang cầm, quy ra đơn vị của chính bạn (D365 → D410: một dòng giữ chỗ sẵn)', () => {
  /** Sáu ngày có chi, trung vị 50.000 ⇒ ngưỡng "món lớn" = 100.000. */
  const SAU_NGAY: Khoan[] = [30_000, 40_000, 50_000, 50_000, 60_000, 70_000].map((soTien, i) => ({
    id: `nen${i}`, ngay: `2026-08-0${i + 1}`, soTien, chieu: 'chi', nhan: null, huId: null,
    cachGhi: 'tay', viSale: null, taoLuc: '2026-08-01T00:00:00.000Z', suaLuc: '2026-08-01T00:00:00.000Z',
  }));

  async function khoVoiNen(): Promise<KhoTrongBoNho> {
    const kho = new KhoTrongBoNho();
    for (const k of SAU_NGAY) await kho.ghi('khoan', { id: k.id, thang: '2026-08', suaLuc: k.suaLuc, d: k });
    return kho;
  }

  it('⭐⭐ cầm 200.000 trên nền 50.000/ngày ⇒ dòng quy đổi nói “≈ 4 ngày chi thường”; khay rỗng thì dòng TRỐNG mà vẫn giữ chỗ', async () => {
    const kho = await khoVoiNen();
    const { container } = ve(kho);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Mệnh giá tiền' })).toBeInTheDocument());
    const dong = screen.getByTestId('dong-quy');
    const khung = khungBan(container);
    expect(dong.textContent, 'khay rỗng ⇒ chưa nói gì').toBe('');
    bamTo(200_000);
    await waitFor(() => expect(dong).toHaveTextContent(`${CP.quyGonPre}4${CP.quyGonNgay}`));
    expect(screen.getByTestId('dong-quy'), 'cùng MỘT phần tử — không phải khối mới mọc ra').toBe(dong);
    expect(khungBan(container), 'Oracle lên tiếng mà mặt bàn không mọc khối nào (D410)').toEqual(khung);
  });

  it('⭐⭐⭐ khoản DƯỚI ngưỡng ⇒ im — và đây là chỗ một khối “giúp” dễ hoá thành lời phán mỗi lần ghi', async () => {
    // 50.000 = đúng một ngày thường ⇒ chưa phải "món lớn" (ngưỡng 2×). Bàn tiền vẫn ghi như thường.
    const kho = await khoVoiNen();
    ve(kho);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Mệnh giá tiền' })).toBeInTheDocument());
    bamTo(50_000);
    await waitFor(() => expect((screen.getByRole('button', { name: CP.nutChi }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByTestId('dong-quy').textContent).toBe('');
  });

  it('⭐⭐ sổ CHƯA đủ sáu ngày có chi ⇒ im, dù cầm rất nhiều (P7: chưa biết “ngày thường” là bao nhiêu)', async () => {
    const kho = new KhoTrongBoNho();
    for (const k of SAU_NGAY.slice(0, 5)) await kho.ghi('khoan', { id: k.id, thang: '2026-08', suaLuc: k.suaLuc, d: k });
    ve(kho);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Mệnh giá tiền' })).toBeInTheDocument());
    bamTo(500_000);
    await waitFor(() => expect((screen.getByRole('button', { name: CP.nutChi }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.getByTestId('dong-quy').textContent).toBe('');
  });

  it('⭐ khối GIÚP không chen thêm nút nào — đường ghi vẫn đúng hai chạm', async () => {
    /*
     * ⚠ Demo đã chốt để phần quy đổi là CHỮ, hành động vẫn là lưới đích. Nếu ai đó thêm một nút
     * "GHI KHOẢN NÀY" vào trong bong bóng thì bàn tiền có HAI đường ghi, và đường thứ hai không đi
     * qua `chamDich` (không nhãn, không hũ, không telemetry).
     */
    const kho = await khoVoiNen();
    ve(kho);
    await waitFor(() => expect(screen.getByRole('group', { name: 'Mệnh giá tiền' })).toBeInTheDocument());
    bamTo(200_000);
    const dong = screen.getByTestId('dong-quy');
    await waitFor(() => expect(dong.textContent).not.toBe(''));
    expect(within(dong).queryAllByRole('button')).toHaveLength(0);
  });
});

/* ═══ §IX — ⭐⭐⭐ TẦNG KHÔNG GIAN: bàn tiền ở màn SỔ không thu, không nhảy bố cục ═════════════════════════════════════ */

describe('§IX — ⭐⭐⭐ `khongThu` (màn SỔ bento không cuộn): chạm ra ngoài KHÔNG thu bàn; bàn đứng một chỗ giữa hai cú chạm', () => {
  /*
   * SPEC `pfm-tang-khong-gian`, luật founder 26/09 "bàn tiền SỔ cố định": màn SỔ là khung không cuộn, danh sách đã nằm ở lớp trượt nên "thu xuống để
   * nhìn danh sách" (D420) không còn lý do — và thu/mở còn làm bố cục bento nở ra co lại giữa hai cú chạm. `khongThu` tắt đúng nhánh ấy. Số đo toạ độ
   * "hai cú chạm liền nhau không khối nào nhích" ở trình duyệt thật: `tests/luong/trinh-duyet/pfm_bento.mjs` (phần `ghi`).
   */
  function veKhongThu(kho: KhoTrongBoNho) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}><BanTien khongThu /></KhoProvider>
      </QueryClientProvider>,
    );
  }
  const ban = (): HTMLElement => screen.getByTestId('ban-tien');

  it('⭐⭐⭐ ĐỐI CHỨNG: cùng thao tác mà KHÔNG `khongThu` thì bàn thu xuống — để bài dưới không xanh vì dựng sai', async () => {
    ve(new KhoTrongBoNho());
    await act(async () => { fireEvent.click(document.body); });
    await waitFor(() => expect(ban().getAttribute('data-thu')).toBe('co'));
  });

  it('⭐⭐⭐ `khongThu`: chạm ra ngoài (nhiều lần) bàn vẫn mở; chạm hai tờ liền nhau không đổi khung của bàn; ghi vẫn đúng một khoản', async () => {
    const kho = new KhoTrongBoNho();
    const { container } = veKhongThu(kho);
    const khungTruoc = khungBan(container);
    await act(async () => { fireEvent.click(document.body); });
    await act(async () => { fireEvent.click(document.body); });
    expect(ban().getAttribute('data-thu'), 'chạm ngoài không thu').toBe('khong');
    bamTo(50_000);
    bamTo(100_000);
    expect(khayTong().textContent).toMatch(/150\.000/);
    expect(khungBan(container), 'hai cú chạm tờ không mọc / mất khối nào của mặt bàn').toEqual(khungTruoc);
    expect(ban().getAttribute('data-thu')).toBe('khong');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(async () => expect((await so(kho)).map((k) => k.soTien)).toEqual([150_000]));
  });
});

describe('§X — ⭐⭐⭐ BẤM ĐÚP đích CHI/THU ⇒ ĐÚNG MỘT khoản (khoá đồng bộ — bắt được ở khung 360×640 trên máy chậm, 11/10)', () => {
  it('⭐⭐⭐ hai cú chạm − CHI liền nhau (trước khi ghi kho xong) ⇒ MỘT khoản, không hai', async () => {
    /* Trước khoá: khay chỉ dọn SAU `await ghi`, cú chạm thứ hai vẫn thấy tiền đang cầm và ghi lần nữa. `fireEvent` hai lần trong MỘT `act` là đúng ca "nhanh hơn kho". */
    const kho = new KhoTrongBoNho();
    ve(kho);
    bamTo(100_000);
    const chi = screen.getByRole('button', { name: CP.nutChi });
    await act(async () => { fireEvent.click(chi); fireEvent.click(chi); });
    await waitFor(async () => expect(await so(kho)).toHaveLength(1));
    await act(async () => { await new Promise((r) => { setTimeout(r, 120); }); });
    expect(await so(kho), 'vẫn một khoản sau khi mọi nhánh async xong').toHaveLength(1);
    expect((await so(kho))[0]!.soTien).toBe(100_000);
  });

  it('khoá nhả sau khi ghi xong: cầm tiền lần sau ghi được bình thường', async () => {
    const kho = new KhoTrongBoNho();
    ve(kho);
    bamTo(20_000);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(async () => expect(await so(kho)).toHaveLength(1));
    bamTo(50_000);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutThu })); });
    await waitFor(async () => expect((await so(kho)).map((k) => k.soTien).sort()).toEqual([20_000, 50_000]));
  });
});

describe('§XI — ⭐⭐⭐ BỐ CỤC BÀN TIỀN = DEMO CHỐT bản 6 (founder 11/10): khay · quy đổi · lưới 3×3 · hàng đáy GÕ SỐ − CHI + THU', () => {
  /*
   * Founder rà ảnh cặp: bản đầu đặt "CHẠM TỜ, HOẶC GÕ SỐ" ở khay và −CHI/+THU LÊN TRÊN lưới — sai demo. Bài khoá THỨ TỰ + hình của bốn khối, và để
   * luật D410 (chiều cao cố định, không khối nào mọc/mất) không bị lật theo bố cục mới thì hàng đáy luôn đủ ba nút ở cả hai trạng thái khay.
   */
  const ban = (): HTMLElement => screen.getByTestId('ban-tien');
  const doc = (p: string): string => readFileSync(resolve(__dirname, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

  it('⭐⭐ chữ của khay đúng CHỮ DEMO (không đọc qua tự điển — tự điển đổi chữ thì bài này đỏ): "CHẠM TỜ ĐỂ CẦM" · "ĐANG CẦM" · nút đáy "GÕ SỐ" không biểu tượng', () => {
    expect(CB.banChamTo).toBe('CHẠM TỜ ĐỂ CẦM');
    expect(CB.banDangCam).toBe('ĐANG CẦM');
    expect(CP.goSo).toBe('GÕ SỐ');
  });

  it('⭐⭐⭐ thứ tự DOM: KHAY → dòng quy đổi → LƯỚI 9 tờ (hoặc bàn phím) → HÀNG ĐÁY', () => {
    ve(new KhoTrongBoNho());
    const khay = ban().querySelector('[class*="_khay_"]')!;
    const quy = screen.getByTestId('dong-quy');
    const luoi = screen.getByRole('group', { name: 'Mệnh giá tiền' });
    const dai = screen.getByRole('button', { name: CP.nutChi }).parentElement!;
    const truoc = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(truoc(khay, quy), 'khay trên dòng quy đổi').toBe(true);
    expect(truoc(quy, luoi), 'dòng quy đổi trên lưới tờ').toBe(true);
    expect(truoc(luoi, dai), 'hàng đáy DƯỚI lưới tờ (bản đầu đặt CHI/THU lên trên — sai demo)').toBe(true);
  });

  it('⭐⭐⭐ khay: số TO bên trái (chỉ đọc), nhãn bên phải — "0đ" + "CHẠM TỜ ĐỂ CẦM" rồi "ĐANG CẦM"', () => {
    ve(new KhoTrongBoNho());
    const khay = ban().querySelector('[class*="_khay_"]')!;
    expect(khay.firstElementChild, 'số tổng là con ĐẦU của khay (bên trái)').toBe(khayTong());
    expect(khayTong().tagName, 'chỉ đọc — không phải nút').toBe('B');
    expect(khayTong().textContent).toBe('0đ');
    expect(within(khay as HTMLElement).getByText(CB.banChamTo)).toBeInTheDocument();
    bamTo(50_000);
    expect(khayTong().textContent).toBe('50.000đ');
    expect(within(khay as HTMLElement).getByText(CB.banDangCam)).toBeInTheDocument();
    expect(within(khay as HTMLElement).queryByText(CB.banChamTo)).toBeNull();
  });

  it('⭐⭐⭐ hàng đáy luôn đủ BA nút đúng thứ tự GÕ SỐ · − CHI · + THU; GÕ SỐ luôn bật, CHI/THU tắt khi khay rỗng', () => {
    ve(new KhoTrongBoNho());
    const nut = [...screen.getByRole('button', { name: CP.nutChi }).parentElement!.querySelectorAll('button')];
    expect(nut.map((b) => b.textContent)).toEqual([CP.goSo, CP.nutChi, CP.nutThu]);
    expect(nut.map((b) => b.disabled)).toEqual([false, true, true]);
    bamTo(10_000);
    expect(nut.map((b) => b.disabled)).toEqual([false, false, false]);
  });

  it('⭐⭐ CSS khớp demo: khay cao CỐ ĐỊNH 44px; hàng đáy lưới `.8fr 1fr 1fr`', () => {
    const css = doc('../src/components/pfm/BanTien.module.css');
    expect(/\.khay\s*\{[^}]*height:\s*44px/.exec(css), 'khay không cao 44px').not.toBeNull();
    expect(/\.hangChieu\s*\{[^}]*grid-template-columns:\s*\.8fr 1fr 1fr/.exec(css), 'hàng đáy lệch tỉ lệ demo').not.toBeNull();
  });
});
