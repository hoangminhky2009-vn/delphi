/**
 * PFM — MÀN GƯƠNG (`screens/tai-chinh/Guong.tsx`), theo DEMO ĐÃ CHỐT (A11.25).
 *
 * ⚠ VIẾT LẠI 11/10 (TẦNG KHÔNG GIAN — SPEC `pfm-tang-khong-gian`, demo CHỐT bản 6, founder "A A A"): GƯƠNG không cuộn nay là mặt BENTO
 *   (ô HƯỚNG · tầng PHÂN TÍCH ĐOÁN↔THẬT · KẾT TOÁN · TIỀN VÀO ĐI ĐÂU · CHI TỪNG NGÀY · sáu ô nhỏ · nút CHỐT); các NẮP gấp cũ (THÁNG · LUẬT · KHUNG),
 *   thẻ Oracle, thẻ NHÌN LẠI, ba thẻ biểu đồ, form đặt luật, chốt tuần đều nằm ở LỚP TRƯỢT mở từ một ô. Mọi LUẬT bên dưới GIỮ NGUYÊN (thiếu mẫu ⇒
 *   "chưa đủ để nói" · "Tắt Gương" thật sự tắt · form luật: app ghép HÌNH, người dùng điền SỐ · ô chênh không màu phán xét · 409 là một câu trả lời ·
 *   khấc pixel · giá trị đã kẹp nói là đã kẹp); chỉ ĐƯỜNG TỚI chúng đổi (mở ô trước rồi mới thấy khối). Bài "mở nắp B đóng nắp A" thành "mở lớp B
 *   thay lớp A — chỉ MỘT lớp"; bài thứ-tự-DOM của nắp/thẻ bỏ (không còn nắp). Lượt HIỂN THỊ thẻ Oracle ghi lúc lớp TIỀN TỚI mở (lúc thẻ thật sự hiện).
 *
 * ⚠ Nhại `pfm_man_hu.test.tsx`: `KhoTrongBoNho` + `QueryClientProvider` + `KhoProvider`,
 * đọc KHO làm nguồn sự thật (không chỉ đọc DOM).
 *
 * ⚠⚠ ĐỒNG HỒ BỊ GIỮ CỐ ĐỊNH, và đó KHÔNG phải chuyện tiện tay: `chonNoiDung` có một điều
 * kiện đọc NGÀY TRONG THÁNG (`guong_dau_thang`: ngày ≤ 3). Để đồng hồ thật thì bài "thẻ
 * Oracle `null`" xanh 28 ngày một tháng rồi ĐỎ vào mùng 1 — đúng lớp bài test "đỏ vào một
 * ngày nào đó trong năm" mà `thoi_gian.ts` viết cả một khối để cảnh báo.
 * ⚠ Giữ bằng `vi.mock` trên `thoi_gian.ts` chứ không bằng fake timer: `sinhId`/`bayGio`
 * vẫn phải chạy thật (id ngẫu nhiên, mốc ISO), và fake timer thì đụng cả hàng chờ của
 * react-query.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const THANG = '2026-09';
const THANG_TRUOC = '2026-08';
const NGAY = '2026-09-15';
const LUC = '2026-09-15T10:00:00.000Z';

vi.mock('../src/lib/telemetry.js', () => ({
  ghiDo: vi.fn(), manCuaDuong: () => '/tai-chinh/guong',
}));
const { ghiDo } = await import('../src/lib/telemetry.js');

vi.mock('../src/pfm/thoi_gian.js', async (goc) => {
  const m = await goc<typeof import('../src/pfm/thoi_gian.js')>();
  return { ...m, homNay: () => NGAY, thangNay: () => THANG };
});

const {
  NHIP_AN_MUNG, PHIM_NGUONG, RuotGuong, dungChiSo,
} = await import('../src/screens/tai-chinh/Guong');
const { soVoiMoc } = await import('../src/pfm/guong.js');
const { KhoProvider } = await import('../src/pfm/dung_kho');
const { KhoTrongBoNho } = await import('../src/pfm/kho.js');
const { khoanRaBanGhi, taoKhoan } = await import('../src/pfm/so.js');
const { taoKhoanPhanBo } = await import('../src/pfm/phan_bo.js');
const { taoLuatMoi } = await import('../src/pfm/luat.js');
const { tuTao, quyetToan } = await import('../src/pfm/hu.js');
const sGuong = (await import('../src/screens/tai-chinh/Guong.module.css')).default;
const { MAU_LUAT } = await import('../src/pfm/mau_luat.js');
const { CHU_BENTO: CB, CHU_BIEU_DO: B, CHU_MAN_GUONG: C, CHU_MAN_HU, CHU_HUONG: H } = await import('../src/lib/pfm_chu');
const sBieuDo = (await import('../src/screens/tai-chinh/BieuDo.module.css')).default;
const sBento = (await import('../src/components/pfm/PfmBento.module.css')).default;
const sGuongBento = (await import('../src/screens/tai-chinh/GuongBento.module.css')).default;
/** Lớp của dòng phụ trong ô nhỏ (`GuongBento.module.css .phu`). */
const lopBento = (ten: string): string => ((sGuongBento as Record<string, string | undefined>)[ten] ?? (sBento as Record<string, string | undefined>)[ten])!;
const { ID_CAI_DAT_MAY } = await import('../src/pfm/cai_dat_may.js');

type Kho = InstanceType<typeof KhoTrongBoNho>;
type Luat = import('../src/pfm/luat.js').Luat;
type Hu = import('../src/pfm/hu.js').Hu;

/* ═══ dựng cảnh ═══════════════════════════════════════════════════════════════════ */

interface HatKhoan {
  ngay: string;
  soTien: number;
  chieu?: 'chi' | 'thu';
  nhan?: import('../src/pfm/so.js').MaNhanKhoan;
  ghiChu?: string;
}

/** Hạt → `Khoan` thật. MỘT nguồn cho cả kho lẫn các bài gọi thẳng hàm thuần (D61). */
function hatRaKhoan(hat: HatKhoan[]): import('../src/pfm/so.js').Khoan[] {
  return hat.map((h, i) => taoKhoan({
    ngay: h.ngay,
    soTien: h.soTien,
    chieu: h.chieu ?? 'chi',
    ...(h.nhan !== undefined ? { nhan: h.nhan } : {}),
    ...(h.ghiChu !== undefined ? { ghiChu: h.ghiChu } : {}),
  }, LUC, `k${i}`));
}

async function khoCo(hat: HatKhoan[] = []): Promise<Kho> {
  const kho = new KhoTrongBoNho();
  for (const k of hatRaKhoan(hat)) await kho.ghi('khoan', khoanRaBanGhi(k));
  return kho;
}

/** Tách theo tháng — các bài dựng chỉ số cần đúng hai lát sổ mà màn cũng đọc. */
const cuaThang = (hat: HatKhoan[], thang: string) =>
  hatRaKhoan(hat).filter((k) => k.ngay.startsWith(thang));

/** Một luật ĐANG BẬT — đủ để `moi_dat_luat` (lời mời bậc 3) thôi đủ điều kiện. */
async function themLuat(kho: Kho, id = 'l1'): Promise<Luat> {
  const l = taoLuatMoi({ loiNhac: 'Cau tu dan minh', dieuKien: 'ngay_chi_lon' }, LUC, id);
  await kho.ghi('luat', { id, thang: THANG, suaLuc: LUC, d: l });
  return l;
}

/** `/auth/me` mặc định: đã bật PFM, tuần CHƯA niêm phong. */
const ME_CO_PFM = {
  email: 'a@b.c', email_verified: true, onboarded: true, user: null,
  pfm: {
    consent: true, tuan: '2026-W37', tuan_da_niem_phong: false,
    tuan_token_thuong: 0, tuan_so_ngay_co_mat: 6,
  },
};

/** Stub fetch tối thiểu: `/auth/me` + `POST /pfm/tuan`. Đường lạ ⇒ 401 (như `helpers`). */
function stubMang(tuan?: { status: number; body: unknown }): void {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const dap = (status: number, body: unknown) => new Response(JSON.stringify(body), {
      status, headers: { 'content-type': 'application/json' },
    });
    if (url.includes('/telemetry')) return dap(202, { ok: true });
    if (url.includes('/auth/me')) return dap(200, ME_CO_PFM);
    if (url.includes('/pfm/tuan')) {
      return dap(tuan?.status ?? 200, tuan?.body ?? { tuan: '2026-W37', moi: true, tokenThuong: 12 });
    }
    return dap(401, { error: 'unauthorized', message: 'Bạn cần đăng nhập.' });
  }));
}

/**
 * ⚠ `qc` và `nghiemNgat` là hai NÚM CỦA BÀI TEST, không phải tuỳ chọn cho đẹp:
 *   · `qc` dùng lại một `QueryClient` giữa hai lượt render ⇒ dựng được cảnh CACHE ẤM, thứ
 *     duy nhất làm effect chạy ngay ở nhịp render đầu.
 *   · `nghiemNgat` bọc `<StrictMode>` ⇒ React gọi effect HAI lần, đúng điều kiện lúc dev.
 * Thiếu cả hai thì bài "bắn đúng một lần" không có gì để bắt (xem §III-2).
 */
function ve(kho: Kho, tuyChon: { qc?: QueryClient; nghiemNgat?: boolean } = {}) {
  const qc = tuyChon.qc ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const cay = (
    <MemoryRouter initialEntries={['/tai-chinh/guong']}>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}><RuotGuong /></KhoProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  return render(tuyChon.nghiemNgat === true ? <StrictMode>{cay}</StrictMode> : cay);
}

/* ── ĐƯỜNG TỚI các lớp trượt (SPEC mục 4.3): chạm ô ⇒ lớp mở; mọi khối cũ của GƯƠNG nằm trong một lớp ── */
/** Ô theo `data-o` (chờ tới khi có mặt). */
const oG = (dau: string): Promise<HTMLElement> => waitFor(() => {
  const e = document.querySelector<HTMLElement>(`[data-o="${dau}"]`);
  expect(e, `ô ${dau}`).not.toBeNull();
  return e!;
});
/** Chạm ô ⇒ lớp trượt mở; trả hàm tìm TRONG lớp (cùng chữ có thể còn ở mặt ô — không lẫn). */
const moG = async (dau: string) => {
  fireEvent.click(await oG(dau));
  return within(await screen.findByRole('dialog'));
};

/** Tên ô sáu-ô-nhỏ ứng với nắp THÓI QUEN cũ (chỉ số + biểu đồ hành vi + khoản lặp). */
const NAP_THOI_QUEN = 'guong-thoi-quen';

/**
 * Tên lớp CSS-module đã băm, đọc qua MỘT cửa.
 *
 * ⚠ `noUncheckedIndexedAccess` làm mọi lớp có kiểu `string | undefined`, và một tên gõ sai
 * sẽ lặng lẽ thành selector `.undefined` — khớp 0 phần tử, bài xanh, canh số không. Cửa này
 * bắt nó ngay tại chỗ. (Việc lớp có THẬT trong tệp CSS hay không thì bài §VIII-2 canh: dưới
 * `css: false` của vitest, tên lớp là proxy sinh theo yêu cầu.)
 */
function lop(ten: string): string {
  const v = (sGuong as Record<string, string | undefined>)[ten];
  expect(v, `thiếu lớp "${ten}"`).toBeTruthy();
  return v!;
}

const demOracleHien = (): number =>
  vi.mocked(ghiDo).mock.calls.filter((c) => c[0] === 'oracle_hien').length;

/*
 * ⚠ TƯỚC COMMENT TRƯỚC KHI QUÉT — đúng nếp `scripts/lint_css_anim.ts`. Không tước thì bài
 * tự tố mình: chú thích của chính tệp CSS viết "`--win`/`--lose` không xuất hiện trong tệp
 * này", và phép quét đọc câu ấy thành một lần dùng màu.
 */
const cssGuong = (): string =>
  readFileSync(resolve(__dirname, '../src/screens/tai-chinh/Guong.module.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

beforeEach(() => { vi.mocked(ghiDo).mockClear(); stubMang(); });
afterEach(() => { vi.unstubAllGlobals(); });

/* ═══ §I — P7: thiếu mẫu ⇒ MỘT CÂU, không phải số 0 ═══════════════════════════════ */

describe('§I — ⭐⭐⭐ Chỉ số thiếu mẫu: "chưa đủ để nói", KHÔNG BAO GIỜ "0%"', () => {
  it('⭐⭐⭐ sổ rỗng ⇒ cả bốn chỉ số nói "chưa đủ để nói", và không đâu hiện 0%', async () => {
    /*
     * ⚠⚠ ĐÂY LÀ BÀI ĐẮT NHẤT CỦA MÀN. Một tỷ lệ 0% đọc ra là "đã đo, kết quả bằng không"
     * — đúng điều ta CHƯA BIẾT. Và nó không có triệu chứng nào: con số vẫn nằm trong
     * [0,1], thanh vẫn vẽ được, không lỗi, không cảnh báo (D62/P7).
     * ⚠ D426 — BỐN chỉ số, không phải năm: "vì sale / bạn rủ" chỉ dựng khi sổ có câu trả lời cho nó (từ D410 không màn
     *   nào hỏi) — xem bài §I-ter. Và giờ có thêm ba thẻ biểu đồ: "không đâu hiện 0%" soi cả MẶT lẫn lớp.
     */
    const kho = await khoCo([]);
    ve(kho);
    await moG(NAP_THOI_QUEN);

    await waitFor(() => expect(document.querySelectorAll(`.${lop('csD')}`)).toHaveLength(4));
    for (const dong of document.querySelectorAll(`.${lop('csD')}`)) {
      expect(dong.textContent, 'mỗi dòng chỉ số nói "chưa đủ để nói"').toContain(C.thieuMau);
    }
    /* `\b0%` KHÔNG khớp "10%"/"20%" (không có ranh từ giữa '1' và '0') — nó chỉ bắt đúng
       con số 0 đứng một mình, tức đúng thứ bài này canh. */
    expect(document.body.textContent ?? '').not.toMatch(/\b0%/);
  });

  it('⭐⭐ có đủ mẫu ⇒ hiện SỐ THẬT, và mẫu số `n=` đi kèm', async () => {
    // Một tỷ lệ dựng từ hai ngày mà nói cùng giọng với tỷ lệ dựng từ ba mươi ngày là cách
    // app tự tin sai — nên `n` không bao giờ vắng mặt (bài học D123).
    const kho = await khoCo([
      { ngay: `${THANG}-02`, soTien: 10_000_000, chieu: 'thu' },
      { ngay: `${THANG}-03`, soTien: 2_000_000 },
    ]);
    ve(kho);
    const tl = await moG(NAP_THOI_QUEN);
    await waitFor(() => expect(tl.getByText('80%')).toBeInTheDocument());
    expect(screen.getByRole('dialog').textContent).toContain('n=2');
  });

  it('⭐⭐ §I-ter — "vì sale / bạn rủ": không câu trả lời nào ⇒ KHÔNG dòng; có câu trả lời (di sản) ⇒ dòng quay lại', async () => {
    /*
     * D426 — từ D410 không màn nào hỏi câu ấy nữa; dựng dòng là một "chưa đủ để nói" VĨNH VIỄN — hứa một con số sẽ tới
     * mà không đường nào tới. Nhưng sổ cũ CÓ câu trả lời thì dòng phải còn: ẩn nó lúc ấy là giấu dữ liệu của người dùng.
     */
    const { unmount } = ve(await khoCo([{ ngay: `${THANG}-03`, soTien: 50_000 }]));
    const tl = await moG(NAP_THOI_QUEN);
    await waitFor(() => expect(tl.getByText(C.csTietKiem)).toBeInTheDocument());
    expect(tl.queryByText(C.csViSale)).toBeNull();
    unmount();

    const kho = new KhoTrongBoNho();
    const k = taoKhoan({ ngay: `${THANG}-03`, soTien: 50_000, viSale: true }, LUC, 'ks');
    await kho.ghi('khoan', khoanRaBanGhi(k));
    ve(kho);
    const tl2 = await moG(NAP_THOI_QUEN);
    expect(await tl2.findByText(C.csViSale)).toBeInTheDocument();
  });
});

/* ═══ §I-bis — công tắc "Tắt Gương" phải có NGƯỜI ĐỌC ════════════════════════════ */

describe('§I-bis — ⭐⭐ "Tắt Gương" (Cài đặt › KHÁC) thật sự tắt các chỉ số', () => {
  /*
   * ⚠ Bài này canh một lớp lỗi KHÔNG có triệu chứng: một công tắc GHI được vào kho mà
   * không ai ĐỌC. Màn vẫn vẽ, kho vẫn đúng, test cũ vẫn xanh — chỉ có câu chữ đã duyệt
   * (*"Màn Gương ngừng tính các chỉ số mô tả"*) là nói một điều không xảy ra, và A10 🔒
   * cấm đúng thứ đó: app chỉ được MÔ TẢ, nên mô tả sai còn nặng hơn kê đơn.
   * ⚠ Khoá `meta/cai_dat_may` phải TRÙNG khoá bên `CaiDatPfm` — khác khoá thì cú gạt công
   * tắc không làm tươi màn này, và người dùng thấy nó "không ăn" tới lần tải sau.
   */
  const HAI_KHOAN: HatKhoan[] = [
    { ngay: `${THANG}-02`, soTien: 10_000_000, chieu: 'thu' },
    { ngay: `${THANG}-03`, soTien: 2_000_000 },
  ];

  async function khoTatGuong(tat: boolean): Promise<Kho> {
    const kho = await khoCo(HAI_KHOAN);
    await kho.ghi('meta', {
      id: ID_CAI_DAT_MAY, thang: THANG, suaLuc: LUC, d: { guongTat: tat, nhacTat: false },
    });
    return kho;
  }

  it('⭐⭐ guongTat = true ⇒ lớp CHỈ SỐ không dựng dòng nào, hiện đúng câu đã duyệt', async () => {
    ve(await khoTatGuong(true));
    await moG(NAP_THOI_QUEN);
    expect(await screen.findByTestId('guong-tat')).toHaveTextContent(C.guongTat);
    // Không một chỉ số nào TRONG LỚP — kể cả câu "chưa đủ để nói" (đó vẫn là một chỉ số đang nói). (Mặt ô nhỏ có thể nói "chưa đủ để nói" cho ô của nó.)
    expect(within(screen.getByRole('dialog')).queryByText(C.thieuMau)).toBeNull();
    expect(document.body.textContent ?? '').not.toContain('n=2');
    // D426 — cả hai biểu đồ hành vi trong nắp cũng im (chúng là chỉ số mô tả, đúng lời hứa của công tắc).
    expect(screen.queryByTestId('bd-thoi-quen')).toBeNull();
    // D453 — khối NÓI · LÀM · TRONG TRẬN dời sang THẺ, mang theo công tắc (bài canh ở `pfm_chan_dung_man`).
    expect(screen.queryByTestId('mat-ba-mat')).toBeNull();
  });

  it('guongTat = false (và khi vắng hẳn bản ghi) ⇒ chỉ số vẫn chạy như cũ', async () => {
    const { unmount } = ve(await khoTatGuong(false));
    const tl = await moG(NAP_THOI_QUEN);
    await waitFor(() => expect(tl.getByText('80%')).toBeInTheDocument());
    expect(screen.queryByTestId('guong-tat')).toBeNull();
    unmount();

    ve(await khoCo(HAI_KHOAN));                       // chưa ai chạm công tắc bao giờ
    const tl2 = await moG(NAP_THOI_QUEN);
    await waitFor(() => expect(tl2.getByText('80%')).toBeInTheDocument());
  });
});

/* ═══ §II — Nắp gấp: mở B là đóng A, và mỗi lá nắp TỰ MANG một con số ═════════════ */

describe('§ 13/09 — ⭐ chú giải lịch tháng nằm sau một chạm, không nằm sẵn trên mặt', () => {
  it('⭐ mặt GƯƠNG không mang câu chú giải lịch; chạm ô 6 THÁNG ⇒ lớp có lịch + câu chú giải', async () => {
    /*
     * Founder 13/09: *"chữ thì chỉ dành cho bách khoa toàn thư"*. Tầng không gian giữ đúng ý ấy ở cấp cao hơn: mặt chỉ có ô + số; câu giải
     * thích CHỈ có khi chạm mở lớp (lớp trượt chính là "bách khoa" theo yêu cầu). Tiêm lỗi: dựng chú giải ở mặt ô ⇒ bài đỏ.
     */
    const kho = await khoCo([]);
    ve(kho);
    const chuGiai = (c: string) => c.includes(C.chuThichLichHau.trim());
    await oG('guong-sau-thang');
    expect(screen.queryByText(chuGiai), 'mặt chưa mở: không câu chú giải').toBeNull();
    const tl = await moG('guong-sau-thang');
    expect(tl.getByText(chuGiai)).toBeInTheDocument();
    expect(tl.getByText(`${C.napThangPre}9${C.napThangHau}`)).toBeInTheDocument();
  });
});

describe('§II — ⭐⭐ Các lớp: một lớp mở tại một lúc, mỗi ô nhỏ mang số', () => {
  it('⭐⭐ mở lớp B khi đang mở lớp A ⇒ vẫn MỘT hộp thoại, nội dung của B; đóng ⇒ không còn hộp nào', async () => {
    /*
     * ⚠ Hai lớp cùng mở là màn vỡ — ở nắp cũ luật này là "mở B đóng A"; ở tầng không gian là cùng một hộp thoại đổi nội dung (TamTruot duy
     * nhất, không chồng lớp). Bài khoá: đếm hộp thoại và đọc tiêu đề.
     */
    const kho = await khoCo([]);
    ve(kho);
    await moG('guong-luat');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', CB.guLuat);
    await moG('guong-sau-thang');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', CB.guSauThang);

    fireEvent.click(screen.getByRole('button', { name: 'ĐÓNG' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('⭐⭐⭐ mỗi ô nhỏ mang một con số tóm tắt NGAY CẢ KHI ĐÓNG', async () => {
    /*
     * ⚠⚠ Ô không mang số là GIẤU thông tin, không phải progressive disclosure — đó là
     * ranh giới giữa hai thứ và nó dễ vượt qua mà không nhận ra (§4-bis điều 1).
     */
    const kho = await khoCo([
      { ngay: `${THANG_TRUOC}-05`, soTien: 59_000, nhan: 'choi', ghiChu: 'goi nhac' },
      { ngay: `${THANG}-05`, soTien: 59_000, nhan: 'choi', ghiChu: 'goi nhac' },
      { ngay: `${THANG}-06`, soTien: 45_000, nhan: 'an_uong' },
    ]);
    await themLuat(kho);
    /* ⚠ `quyetToan` TỰ chuyển trạng thái — gọi `doiTrangThai(…,'xong')` trước nó là đi
       từ "xong" sang "xong", và máy trạng thái của `hu.ts` từ chối đúng như phải thế. */
    const huXong = quyetToan(tuTao({ ten: 'Laptop', muc: 1_000_000 }, LUC, 'h1'), 'xong', 'du', LUC);
    await kho.ghi('hu', { id: 'h1', thang: THANG, suaLuc: LUC, d: huXong satisfies Hu });

    ve(kho);
    const tom: Record<string, (string | RegExp)[]> = {
      // Hai tháng có khoản ⇒ ô 6 THÁNG đếm tháng.
      'guong-sau-thang': [/2 tháng/],
      'guong-luat': [/1 luật/],
    };
    for (const [dau, ds] of Object.entries(tom)) {
      const o = await oG(dau);
      await waitFor(() => expect(o.textContent ?? '').not.toContain(CB.dangTai));
      for (const x of ds) {
        if (typeof x === 'string') expect(o.textContent, `ô "${dau}"`).toContain(x);
        else expect(o.textContent, `ô "${dau}"`).toMatch(x);
      }
    }
    // Mọi ô nhỏ đều có dòng phụ KHÔNG rỗng (hoặc "chưa đủ để nói" — một câu nói thật, không phải khoảng trống).
    for (const dau of ['phan-tich', 'thoi-quen', 'luat', 'sau-thang', 'nhin-lai', 'tien-toi']) {
      const phu = (await oG(`guong-${dau}`)).querySelector(`.${lopBento('phu')}`);
      expect(phu?.textContent?.trim().length ?? 0, `ô ${dau} không dòng phụ`).toBeGreaterThan(0);
    }
    // Hũ ĐÃ XONG nằm ở lớp KẾT TOÁN (ghi nhận theo cùng mốc RESET với màn SỔ/HŨ).
    const kt = await moG('guong-ket-toan');
    expect(await kt.findByText('LAPTOP')).toBeInTheDocument();
    // D453 — khoản LẶP: dòng tóm của nó đứng đầu mục của nó trong lớp THÓI QUEN.
    const tq = await moG(NAP_THOI_QUEN);
    expect(tq.getByText(/1 khoản · 59\.000\/tháng/)).toBeInTheDocument();
  });
});

/* ═══ §III — Thẻ Oracle ══════════════════════════════════════════════════════════ */

describe('§III — ⭐⭐⭐ Thẻ Oracle: `null` là im lặng, và ghi hiển thị ĐÚNG MỘT LẦN', () => {
  /** Thẻ Oracle sống trong lớp TIỀN TỚI (ô nhỏ cuối hàng) — mở lớp ấy như người dùng. */
  const moTienToi = () => moG('guong-tien-toi');

  it('⭐⭐⭐ không nội dung nào đủ điều kiện ⇒ KHÔNG dựng thẻ, và không ghi đo', async () => {
    /*
     * ⚠ `null` là kết quả HỢP LỆ, không phải lỗi — im lặng đúng tinh thần "không giục"
     * của gương. Dựng một thẻ rỗng (hoặc một câu mặc định) là app tự nói khi nó không có
     * gì để nói.
     * Cảnh: sổ rỗng (mọi chỉ số `null` ⇒ không boost nào) · đã có một luật BẬT ⇒
     * `moi_dat_luat` tắt · ngày 15 ⇒ `guong_dau_thang` tắt.
     */
    const kho = await khoCo([]);
    await themLuat(kho);
    ve(kho);
    const oLuat = await oG('guong-luat');
    await waitFor(() => expect(oLuat.textContent).toContain(C.donViLuat));
    /*
     * ⚠⚠ PHẢI NHẢ ĐỦ NHỊP CHO CÚ QUYẾT ĐỊNH BẤT ĐỒNG BỘ. Quyết định Oracle đọc kho
     * (`docDaHienKy`) rồi mới `setState`, nên khẳng định ngay sau `waitFor` ở trên là
     * khẳng định "thẻ CHƯA KỊP hiện", không phải "thẻ không hiện". Mũi tiêm đã chứng minh
     * đúng chỗ này: ép `soLuatDangBat: 0` (thẻ PHẢI hiện) mà bài vẫn xanh — bài rỗng.
     */
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const tl = await moTienToi();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    expect(tl.queryByRole('button', { name: C.nutBoQua })).not.toBeInTheDocument();
    expect(tl.queryByRole('button', { name: C.nutViSao })).not.toBeInTheDocument();
    expect(demOracleHien()).toBe(0);
  });

  it('⭐⭐⭐ `ghiHienThi` bắn ĐÚNG MỘT LẦN — StrictMode trên CACHE ẤM, và chỉ khi thẻ THẬT SỰ hiện (lớp mở)', async () => {
    /*
     * ⚠⚠ Bắn hai lần là hỏng cả phễu 5 nấc (T7.5): "hiển thị" là mẫu số của mọi tỷ lệ
     * tương tác phía sau, nên đếm đôi thì mọi nấc sau đọc ra thấp đúng một nửa — sai IM
     * LẶNG, và không ai nối được con số ấy về đây.
     *
     * ⚠⚠⚠ BẢN TRƯỚC CỦA BÀI NÀY RỖNG, và mũi tiêm đã chứng minh: xoá hai dòng `daChonRef`
     * ⇒ 17/17 VẪN XANH. Hai lý do cộng lại, thiếu một là bài không bắt được gì:
     *   1. Không có `<StrictMode>` ⇒ React chỉ gọi effect MỘT lần ⇒ cái ref canh đúng cú
     *      thứ hai chẳng có cú thứ hai nào để canh.
     *   2. Cache LẠNH ⇒ nhịp render đầu còn `dangTai`, effect thoát sớm ở cả hai lượt của
     *      StrictMode; tới lúc dữ liệu về thì chỉ còn MỘT lượt chạy. Nên cảnh phải là
     *      CACHE ẤM: render lượt 1, tháo, xoá kho, rồi render lượt 2 với ĐÚNG
     *      `QueryClient` ấy (`staleTime`/`gcTime: Infinity` giữ nguyên dữ liệu).
     * ⭐ Tầng không gian: thẻ nằm trong lớp TIỀN TỚI ⇒ lượt hiển thị tính LÚC MỞ LỚP (mặt chưa mở: 0 lượt — thẻ chưa ai thấy).
     */
    const kho = await khoCo([]);          // chưa có luật nào ⇒ `moi_dat_luat` đủ điều kiện
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const luot1 = ve(kho, { qc, nghiemNgat: true });
    await oG('guong-tien-toi');
    await act(async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); });
    expect(demOracleHien(), 'lớp chưa mở: thẻ chưa hiện ⇒ chưa lượt hiển thị nào').toBe(0);
    const tl1 = await moTienToi();
    await tl1.findByRole('button', { name: C.nutBoQua });
    await waitFor(() => expect(demOracleHien()).toBe(1));
    // Kỳ đã được ghi nhận ⇒ lần mở sau trong cùng tháng không hiện lại thẻ ấy nữa.
    await waitFor(async () => {
      const nhip = await kho.liet<{ ky: string; daHien: string[] }>('nhip');
      expect(nhip).toHaveLength(1);
      expect(nhip[0]!.d.daHien).toEqual(['moi_dat_luat']);
    });
    luot1.unmount();

    // Quên "đã hiện kỳ này" để thẻ được chọn lại; dữ liệu sổ/luật vẫn nằm trong `qc`.
    await kho.xoaSach();
    vi.mocked(ghiDo).mockClear();

    ve(kho, { qc, nghiemNgat: true });
    const tl2 = await moTienToi();
    await tl2.findByRole('button', { name: C.nutBoQua });
    /*
     * ⚠⚠ KHẲNG ĐỊNH NGOÀI `waitFor`, VÀ SAU KHI ĐÃ NHẢ NHỊP. `waitFor(…toBe(1))` thoát
     * ngay giây phút chạm 1, nên nó KHÔNG BAO GIỜ nhìn thấy cú thứ hai đến sau — đúng cái
     * bẫy đã làm bản trước xanh. Nhả vài nhịp cho mọi nhánh async xong rồi mới đếm.
     */
    await act(async () => {
      for (let i = 0; i < 4; i++) await Promise.resolve();
    });
    expect(demOracleHien(), 'StrictMode + cache ấm ⇒ vẫn phải đúng MỘT cú `oracle_hien`')
      .toBe(1);
  });

  it('⭐⭐⭐ mở rồi ĐÓNG rồi MỞ LẠI lớp TIỀN TỚI ⇒ vẫn đúng MỘT lượt hiển thị (cùng một thẻ không được đếm hai lần)', async () => {
    const kho = await khoCo([]);
    ve(kho);
    const tl = await moTienToi();
    await tl.findByRole('button', { name: C.nutBoQua });
    await waitFor(() => expect(demOracleHien()).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'ĐÓNG' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(await oG('guong-tien-toi'));
    await screen.findByRole('dialog');
    await act(async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); });
    expect(demOracleHien(), 'mở lại cùng thẻ không tính thêm lượt').toBe(1);
  });

  it('⭐⭐ BỎ QUA gỡ hẳn thẻ khỏi DOM (demo: `.oracle.remove()`)', async () => {
    const kho = await khoCo([]);
    ve(kho);
    const tl = await moTienToi();
    fireEvent.click(await tl.findByRole('button', { name: C.nutBoQua }));
    expect(tl.queryByRole('button', { name: C.nutViSao })).not.toBeInTheDocument();
  });

  it('⭐ VÌ SAO? mở lý do (P13 — thẻ nào cũng nói được vì sao bạn thấy nó)', async () => {
    const kho = await khoCo([]);
    ve(kho);
    const tl = await moTienToi();
    const nut = await tl.findByRole('button', { name: C.nutViSao });
    fireEvent.click(nut);
    expect(tl.getByRole('button', { name: C.nutAnLyDo })).toBeInTheDocument();
  });
});

/* ═══ §IV — Form đặt luật (D290) ═════════════════════════════════════════════════ */

describe('§IV — ⭐⭐⭐ Form đặt luật: app ghép HÌNH, người dùng điền SỐ', () => {
  /** Chạm ô LUẬT ⇒ lớp luật; chạm nút chính "+ ĐẶT MỘT LUẬT" (trễ một nhịp phụt hạt) ⇒ form hiện trong lớp. */
  async function moForm(kho: Kho): Promise<void> {
    ve(kho);
    const tl = await moG('guong-luat');
    fireEvent.click(await screen.findByRole('button', { name: C.themLuat }));
    await tl.findByText(C.formHoi);
  }
  const lopForm = () => within(screen.getByRole('dialog'));

  it('⭐⭐⭐ ô ngưỡng CHỈ hiện với điều kiện thật sự cần ngưỡng', async () => {
    /*
     * ⚠ `canNguong()` ở `luat.ts` trả true CHỈ cho `khoan_vuot_muc`. Bản demo cũ hiện ô
     * mức với MỌI điều kiện — vừa hỏi thừa vừa hỏi thiếu: engine không có trường nào cho
     * một số tiền ở vế hành động (D290).
     */
    const kho = await khoCo([]);
    await moForm(kho);
    expect(screen.queryByText(C.tieuMucCuaBan), 'NGÀY TIÊU ĐẬM không cần ngưỡng')
      .not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: MAU_LUAT[1]!.ten.toUpperCase() }));
    expect(screen.getByText(C.tieuMucCuaBan)).toBeInTheDocument();
    // ⚠⚠ Ô để TRỐNG — app KHÔNG BAO GIỜ tự đề xuất một mức tiền (`NGUONG_GOI_Y = null`).
    expect(lopForm().getByText('—')).toBeInTheDocument();
  });

  it('⭐⭐⭐ chốt khi ngưỡng còn TRỐNG ⇒ TỪ CHỐI, không luật nào vào kho', async () => {
    const kho = await khoCo([]);
    await moForm(kho);
    fireEvent.click(screen.getByRole('button', { name: MAU_LUAT[1]!.ten.toUpperCase() }));
    fireEvent.click(screen.getByRole('button', { name: C.nutDatLuat }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // Form vẫn mở, và ô ngưỡng NÓI RA là nó đang thiếu — không phải im lặng nuốt cú bấm.
    expect(screen.getByText(C.tieuMucCuaBan)).toBeInTheDocument();
    const o = lopForm().getByText('—');
    /*
     * ⚠ Hai vế, và mũi tiêm đã chứng minh cần cả hai: gỡ chốt UI thì `taoLuatMoi` vẫn ném
     * (nên "0 bản ghi" MỘT MÌNH vẫn xanh trên một bản đã hỏng — nó chỉ chứng minh engine
     * còn sống, không chứng minh màn hình có từ chối). Vế báo-lỗi-nhìn-thấy-được mới là
     * thứ canh đúng cú từ chối của màn.
     */
    expect(o.className, 'ô ngưỡng phải bật trạng thái lỗi').toContain(sGuong.loi);
    expect(await kho.liet('luat'), 'ngưỡng trống ⇒ 0 bản ghi').toHaveLength(0);
  });

  it('⭐⭐⭐ chốt hợp lệ ⇒ ĐÚNG 1 bản ghi ngăn `luat`, `thamSo.nguong` đúng số đã gõ', async () => {
    const kho = await khoCo([]);
    await moForm(kho);
    fireEvent.click(screen.getByRole('button', { name: MAU_LUAT[1]!.ten.toUpperCase() }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '000' }));
    fireEvent.click(screen.getByRole('button', { name: '000' }));
    fireEvent.click(screen.getByRole('button', { name: C.nutDatLuat }));

    await waitFor(async () => expect(await kho.liet<Luat>('luat')).toHaveLength(1));
    const l = (await kho.liet<Luat>('luat'))[0]!.d;
    expect(l.dieuKien).toBe('khoan_vuot_muc');
    expect(l.thamSo?.nguong).toBe(2_000_000);
    expect(l.mauId).toBe(MAU_LUAT[1]!.id);
    // ⚠ Lời nhắc là NGUYÊN VĂN `loiNhacGoiY` — app không tự sáng tác một câu nào (P3 🔒).
    expect(l.loiNhac).toBe(MAU_LUAT[1]!.loiNhacGoiY);

    // ⚠ Chỉ `{luat_id, mau_id, hanh_dong}` rời máy — câu luật KHÔNG nằm trong sự kiện.
    const hop = await kho.liet<{ v: Record<string, unknown> }>('outbox');
    expect(hop).toHaveLength(1);
    expect(hop[0]!.d.v).toEqual({ luat_id: l.id, mau_id: MAU_LUAT[1]!.id, hanh_dong: 'dat' });
    expect(JSON.stringify(hop[0]!.d)).not.toContain(l.loiNhac);
  });

  it('⭐⭐⭐ bàn gõ ngưỡng gõ RA ĐƯỢC mọi mức tròn quen thuộc (phím `0` là bắt buộc)', () => {
    /*
     * ⚠⚠ BỎ PHÍM '0' LÀ DỰNG LẠI CÁI NEO VỪA GỠ. Không có '0' thì tập số gõ được chỉ còn
     * ghép từ {1, 2, 5} với các cụm '000' — và trong dải 20.000–600.000 KHÔNG một giá trị
     * nào chia hết cho 10.000: 50k · 100k · 200k · 500k đều KHÔNG gõ được, còn 125.000 thì
     * được. Ô ngưỡng để trống vì A10 🔒 cấm app định nghĩa hộ "bao nhiêu thì lớn"; một bàn
     * phím chỉ gõ được vài mức là đúng lời ấy, chỉ ở sâu hơn một lớp.
     * ⚠ ĐI TÌM chuỗi phím thay vì gõ tay từng ca: gõ tay là chép lại đúng giả định đang sai.
     */
    const MUC_TRON = [50_000, 100_000, 200_000, 500_000];
    const goDuoc = new Set<number>();
    let bien = new Set<string>(['']);
    for (let sau = 0; sau < 7 && bien.size > 0; sau++) {
      const ke = new Set<string>();
      for (const cur of bien) {
        for (const k of PHIM_NGUONG) {
          if (k === '⌫') continue;                      // xoá không sinh số mới
          const t = `${cur}${k}`.slice(0, 9);           // đúng luật cắt của màn
          if (t.length > 7 || ke.has(t)) continue;
          ke.add(t);
          const n = Number.parseInt(t, 10);
          if (Number.isFinite(n)) goDuoc.add(n);
        }
      }
      bien = ke;
    }
    expect(goDuoc.size, 'phép tìm không sinh được gì — bài đang canh số không')
      .toBeGreaterThan(20);
    for (const m of MUC_TRON) {
      expect(goDuoc.has(m), `${m.toLocaleString('vi-VN')} không gõ được bằng bàn phím này`)
        .toBe(true);
    }
  });

  it('⭐⭐ và bàn phím THẬT trên màn gõ ra 50.000 — vào kho đúng số ấy', async () => {
    // ⚠ Vế trên chứng minh TẬP PHÍM đủ; vế này chứng minh những phím ấy có mặt và chạy.
    const kho = await khoCo([]);
    await moForm(kho);
    fireEvent.click(screen.getByRole('button', { name: MAU_LUAT[1]!.ten.toUpperCase() }));
    for (const phim of ['5', '0', '000']) {
      fireEvent.click(screen.getByRole('button', { name: phim }));
    }
    expect(lopForm().getByText('50.000')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: C.nutDatLuat }));
    await waitFor(async () => expect(await kho.liet<Luat>('luat')).toHaveLength(1));
    expect((await kho.liet<Luat>('luat'))[0]!.d.thamSo?.nguong).toBe(50_000);
  });

  it('⭐⭐ form mở ⇒ CHIẾM CẢ THÂN LỚP (ẩn danh sách luật + nút thêm); HUỶ ⇒ danh sách trở lại', async () => {
    /*
     * ⚠⚠ Đo được, không phải thẩm mỹ (D290): form đứng dưới danh sách ⇒ tràn 437px ·
     * thay chỗ danh sách ⇒ 248px · chiếm cả thân ⇒ 0. Mặt NHẬP LIỆU thuộc hạng
     * phải-tràn-0 (§11), khác cuộn danh sách. Ở tầng không gian "thân" là thân LỚP TRƯỢT.
     */
    const kho = await khoCo([]);
    await themLuat(kho);
    await moForm(kho);
    const tl = lopForm();
    expect(tl.getByText(C.formHoi)).toBeInTheDocument();
    expect(tl.queryByText(C.donViLuat), 'danh sách luật phải nhường chỗ cho form').toBeNull();
    expect(screen.queryByRole('button', { name: C.themLuat }), 'nút chính cũng nhường (form có nút ĐẶT riêng)').toBeNull();

    // Đóng form ⇒ danh sách + nút thêm trở lại nguyên trạng.
    fireEvent.click(tl.getByRole('button', { name: CHU_MAN_HU.huy }));
    expect(await screen.findByRole('button', { name: C.themLuat })).toBeInTheDocument();
    await waitFor(() => expect(lopForm().queryByText(C.formHoi)).toBeNull());
  });
});

/* ═══ §V — A10: ô "so tháng trước" KHÔNG mang màu phán xét ═════════════════════════ */

/**
 * D426 — cảnh HŨ TIÊU DÙNG: hai hũ, các khoản GÁN (tiền chi đã chia vào hũ) ở tháng trước và tháng này. Hôm nay 15/09 ⇒
 * "so tháng trước" là so tới CÙNG ngày 15/08 (`hangHuTieu` · `daTieuTrongThang(…, denNgay)`).
 * ⚠ Bảng CHI THEO NHÃN — nơi ô chênh sống trước D426 — đã bỏ (từ D410 không còn nhãn để gom). Luật của ô chênh thì y
 *   nguyên, nên hai bài dưới chuyển sang ô chênh của thẻ HŨ TIÊU DÙNG, cùng lý lẽ, cùng mũi tiêm.
 */
async function khoHuTieu(gan: { huId: string; ngay: string; soTien: number }[]): Promise<Kho> {
  const kho = await khoCo([{ ngay: `${THANG}-02`, soTien: 1_000_000 }]);
  for (const [id, ten] of [['h-an', 'Ăn uống'], ['h-di', 'Đi lại']] as const) {
    const h = tuTao({ ten, muc: 3_000_000, nhom: 'tieu_dung' }, LUC, id);
    await kho.ghi('hu', { id, thang: THANG, suaLuc: LUC, d: h satisfies Hu });
  }
  for (const [i, g] of gan.entries()) {
    const k = taoKhoanPhanBo({ ngay: g.ngay, soTien: g.soTien, huId: g.huId, phanBo: 'gan' }, `${g.ngay}T14:00:00.000Z`, `g${i}`);
    await kho.ghi('khoan', khoanRaBanGhi(k));
  }
  return kho;
}

/** CSS của một tệp màn, bỏ chú thích — bài chỉ soi khai báo, không soi lời giải thích. */
const cssTep = (ten: string): string =>
  readFileSync(resolve(__dirname, `../src/screens/tai-chinh/${ten}`), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('§V — ⭐⭐⭐ Đỏ-xanh là MÀU PHÁN XÉT, và thẻ HŨ TIÊU DÙNG không được có ý kiến', () => {
  it('⭐⭐⭐ CẢ HAI CHIỀU (▲ và ▼) dùng CÙNG một lớp trung tính `delta`', async () => {
    /*
     * ⚠⚠ Đỏ-xanh ở đây nói "tăng là xấu, giảm là tốt" — app đang có ý kiến về tiền của
     * người chơi (A10 🔒). Ô chênh vì thế chỉ hiện DẤU và SỐ, một màu cho cả hai chiều.
     *
     * ⚠⚠⚠ BẢN ĐẦU (bảng nhãn) CHỈ CÓ MỘT NHÁNH trong cảnh, nên nó canh đúng nửa bài: mũi
     * tiêm thêm một lớp `.giamXanh{color:#22c55e}` cho nhánh GIẢM ⇒ vẫn xanh, tức màn có thể
     * tô XANH cho "tháng này chi ít hơn" — app khen tiền người chơi — mà không bài nào đỏ.
     * Cảnh dưới đây có cả hai chiều, và đòi chúng cùng MỘT lớp.
     */
    const kho = await khoHuTieu([
      // TĂNG: 100.000 (tới 15/08) → 180.000 (▲ 80%)
      { huId: 'h-an', ngay: `${THANG_TRUOC}-05`, soTien: 100_000 },
      { huId: 'h-an', ngay: `${THANG}-05`, soTien: 180_000 },
      // GIẢM: 200.000 → 120.000 (▼ 40%)
      { huId: 'h-di', ngay: `${THANG_TRUOC}-08`, soTien: 200_000 },
      { huId: 'h-di', ngay: `${THANG}-08`, soTien: 120_000 },
      // Gán SAU 15/08: nằm ngoài mốc so CÙNG NGÀY — lọt vào mốc thì ▲ 80% thành ▼.
      { huId: 'h-an', ngay: `${THANG_TRUOC}-25`, soTien: 900_000 },
    ]);
    ve(kho);
    await moG('guong-chi-ngay');
    const the = await screen.findByTestId('the-hu-tieu');
    const len = await within(the).findByText('▲ 80%');
    const xuong = within(the).getByText('▼ 40%');
    // ⚠ So với chính lớp CSS-module (tên đã băm lúc build), không so chuỗi gõ tay.
    expect(len.classList.contains(sGuong.delta!), 'nhánh TĂNG: lớp trung tính').toBe(true);
    expect(xuong.classList.contains(sGuong.delta!), 'nhánh GIẢM: PHẢI cùng lớp ấy').toBe(true);
    expect(xuong.className).toBe(len.className);
  });

  it('⭐⭐⭐ CSS: `--win` không xuất hiện, `--lose` chỉ ở ô ngưỡng báo lỗi', () => {
    /*
     * ⚠ Bài DOM ở trên chứng minh lớp đúng; bài này chứng minh cái LỚP ấy không lén mang
     * màu thắng/thua. Thiếu vế thứ hai thì đổi `.delta{color:var(--win)}` vẫn xanh.
     * D426 — hai tệp CSS mới của biểu đồ không được có màu thắng/thua NÀO: không ô nhập liệu
     * nào ở đó cần báo lỗi.
     */
    const css = cssGuong();
    expect(css, 'không có màu THẮNG nào trong màn này').not.toMatch(/--win/);
    expect([...css.matchAll(/--lose/g)], '--lose chỉ dùng cho ô ngưỡng báo lỗi')
      .toHaveLength(1);
    expect(css).toMatch(/\.delta\s*\{[^}]*var\(--chu-phu\)/);
    for (const ten of ['BieuDo.module.css', 'BaMat.module.css']) {
      expect(cssTep(ten), `${ten}: màu thắng/thua là phán xét`).not.toMatch(/--win|--lose/);
    }
  });

  it('⭐⭐⭐ CSS: khối `.delta{…}` KHÔNG chứa một mã màu thô nào', () => {
    /*
     * ⚠⚠ SOI VỊ TRÍ, KHÔNG SOI HAI CHUỖI. Cấm `--win`/`--lose` là cấm đúng hai cái tên;
     * `color: #22c55e` viết thẳng vào `.delta` thì lọt qua cả hai bài trên. Ô chênh chỉ
     * được nhận màu qua token trung tính, nên khối của nó không có chỗ cho `#` hay `rgb(`.
     */
    const khoi = /\.delta\s*\{([^}]*)\}/.exec(cssGuong())?.[1];
    expect(khoi, 'không tìm thấy khối `.delta` — bài đang canh một selector đã trôi')
      .toBeTruthy();
    expect(khoi!, 'mã màu thô trong ô chênh = màu phán xét lẻn vào').not.toMatch(/#|rgb\(/);
  });
});

/* ═══ §V-bis — cổng: "tháng trước chưa có số" thay cho một phép chia cho 0 ═══════════ */

describe('§V-bis — ⭐⭐⭐ Ô chênh có CỔNG, và cổng ấy phải có người canh', () => {
  it('⭐⭐⭐ hũ chỉ có số tháng này (tháng trước 0) ⇒ KHÔNG ô chênh, không "▲ Infinity%"', async () => {
    /*
     * ⚠⚠ Cảnh hỏng thật rất tầm thường: một hũ MỚI tạo tháng này ⇒ mốc tháng trước = 0 ⇒ chia
     * cho 0 ⇒ thẻ in **"▲ Infinity%"** vào mặt người dùng. Cổng `chenh()` (mốc ≤ 0 ⇒ không ô).
     */
    const kho = await khoHuTieu([
      { huId: 'h-an', ngay: `${THANG_TRUOC}-05`, soTien: 100_000 },
      { huId: 'h-an', ngay: `${THANG}-05`, soTien: 180_000 },
      { huId: 'h-di', ngay: `${THANG}-08`, soTien: 120_000 },
    ]);
    ve(kho);
    await moG('guong-chi-ngay');
    const the = await screen.findByTestId('the-hu-tieu');
    // Dòng đủ mốc vẫn nói được — nếu không thì bài dưới xanh vì thẻ rỗng.
    expect(await within(the).findByText('▲ 80%')).toBeInTheDocument();
    const dongDi = the.querySelector('[data-hu="h-di"]');
    expect(dongDi, 'thiếu dòng hũ ĐI LẠI — bài đang canh số không').not.toBeNull();
    expect(dongDi!.textContent, 'hũ mới: không mốc tháng trước ⇒ không ▲▼').not.toMatch(/[▲▼]/);
    expect(document.body.textContent ?? '', 'chia cho 0 lọt ra tới mặt người dùng').not.toMatch(/Infinity|NaN/);
  });
});

/* ═══ §V-ter — ba thẻ biểu đồ đầu màn: khấc · thứ tự · số của SỔ ═══════════════════════════ */

describe('§V-ter — ⭐⭐ D426: ba thẻ biểu đồ nằm trong MỘT lớp, đúng thứ tự, mang góc khấc', () => {
  it('⭐⭐ thứ tự trong DOM: tiền đi tới ngày nào → chi từng ngày → hũ tiêu dùng; cả ba thẻ mang khấc', async () => {
    /*
     * Founder 26/09: *"những cái ở vị trí đầu tiên / dễ nhìn nhất thì ưu tiên hữu ích"*. Bài canh THỨ TỰ bằng DOM: một lượt sửa sau đổi chỗ
     * là lớp quay về cũ mà mọi bài tìm-chữ vẫn xanh. (Tầng không gian: hai ô TIỀN VÀO ĐI ĐÂU và CHI TỪNG NGÀY cùng mở lớp này.)
     */
    // D453 — thẻ HŨ TIÊU DÙNG chỉ dựng khi có hũ tiêu dùng ⇒ cảnh có hai hũ ấy để đủ ba thẻ.
    ve(await khoHuTieu([{ huId: 'h-an', ngay: `${THANG}-05`, soTien: 60_000 }]));
    await moG('guong-tien-vao');
    const khoi = await screen.findByTestId('bieu-do-thang');
    await waitFor(() => expect(within(khoi).getByTestId('the-hu-tieu')).toBeInTheDocument());
    const cacThe = [...khoi.querySelectorAll(`.${sBieuDo.the}`)];
    expect(cacThe.map((el) => el.getAttribute('data-testid'))).toEqual(['the-di-dau', 'the-tung-ngay', 'the-hu-tieu']);
    for (const el of cacThe) expect(el.classList.contains(lop('khac')), 'thẻ biểu đồ mất góc khấc').toBe(true);
  });

  it('⭐⭐ ô NHÌN LẠI THÁNG TRƯỚC nói số câu đang chờ; chạm ⇒ lớp có thẻ NHÌN LẠI', async () => {
    /*
     * D426 — trước đó thẻ NHÌN LẠI đứng trên cùng; nó chờ tới khi người dùng trả lời, nên có thể đứng đầu màn cả tháng. Tầng không gian:
     * thẻ nằm sau một ô, ô ấy mang số câu chờ (không giấu việc cần làm); trả lời xong ô đổi thành "đã xong".
     */
    const kho = await khoCo([{ ngay: `${THANG}-05`, soTien: 60_000 }]);
    await kho.ghi('hu', { id: 'h1', thang: THANG_TRUOC, suaLuc: LUC, d: tuTao({ ten: 'Quỹ' }, `${THANG_TRUOC}-02T03:00:00.000Z`, 'h1') });
    ve(kho);
    const o = await oG('guong-nhin-lai');
    await waitFor(() => expect(o.textContent).toMatch(new RegExp(`${B.thangNganPre}8 · 1 ${CB.guCauHau.trim()}`)));
    const tl = await moG('guong-nhin-lai');
    expect(await tl.findByTestId('the-cuoi-ky')).toBeInTheDocument();
  });

  it('⭐⭐⭐ đầu thẻ CHI TỪNG NGÀY = chi tới hôm nay của SỔ; tháng chưa tiêu gì ⇒ "—", không "0" (P7)', async () => {
    const { unmount } = ve(await khoCo([
      { ngay: `${THANG}-05`, soTien: 60_000 }, { ngay: `${THANG}-12`, soTien: 40_000 },
      { ngay: `${THANG}-20`, soTien: 999_000 },   // sau hôm nay (15/09) — không vào "tới ngày 15"
    ]));
    await moG('guong-chi-ngay');
    expect(await screen.findByTestId('tn-nay')).toHaveTextContent('100.000');
    unmount();
    ve(await khoCo([{ ngay: `${THANG}-02`, soTien: 1_000_000, chieu: 'thu' }]));
    await moG('guong-chi-ngay');
    expect(await screen.findByTestId('tn-nay')).toHaveTextContent('—');
    // Và ĐỂ DÀNH của tháng không một cú nạp nào là "—": app không biết người dùng để dành ở chỗ khác.
    expect(within(screen.getByTestId('dd-de')).getByText('—', { selector: 'b' })).toBeInTheDocument();
  });
});

/* ═══ §VI — Niêm phong tuần: 409 là một CÂU TRẢ LỜI, không phải mã lỗi ═══════════ */

/**
 * Đường chốt tuần của người chơi: chạm nút CHỐT SỔ TUẦN dưới mặt ⇒ lớp tóm tắt tuần ⇒ nút chính CHỐT TUẦN (cả hai nút chính trễ một nhịp
 * phụt hạt). Chốt KHÔNG xảy ra ở cú chạm đầu — người chơi thấy tuần mình trước khi niêm phong (xem bài dưới).
 */
async function chotTuanQuaLop(): Promise<void> {
  fireEvent.click(await oG('guong-chot'));
  fireEvent.click(await oG('chot-tuan'));
}

describe('§VI — ⭐⭐⭐ 409 `chua_diem_danh_hom_nay` ⇒ câu người đọc hiểu', () => {
  it('⭐⭐⭐ hiện lời mời điểm danh, và KHÔNG lộ chuỗi mã lỗi ra DOM', async () => {
    /*
     * ⚠⚠ Đúng vào Chủ nhật, tuần được niêm phong kết thúc HÔM NAY — chưa điểm danh mà
     * chốt là khoá ngày cuối ra ngoài vĩnh viễn (`api/pfm.ts`). Đây là một câu trả lời có
     * nghĩa, không phải sự cố; để lộ `chua_diem_danh_hom_nay` là bắt người dùng đọc tên
     * biến của ta.
     */
    stubMang({
      status: 409,
      body: { error: 'chua_diem_danh_hom_nay', message: 'chua_diem_danh_hom_nay' },
    });
    const kho = await khoCo([]);
    ve(kho);
    await chotTuanQuaLop();

    expect(await screen.findByText(C.loiChuaDiemDanh)).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toContain('chua_diem_danh_hom_nay');
    expect(document.body.textContent ?? '').not.toContain('409');
  });

  it('⭐⭐ chốt xong ⇒ ô ăn mừng rơi xuống SAU MỘT NHỊP, và nó mang góc khấc', async () => {
    /*
     * ⚠ EMOJI ĐƯỢC PHÉP Ở KHU PFM (founder chốt 06/09) với ranh: emoji cho KHOẢNH KHẮC
     * (ăn mừng, linh vật) · PIXEL do ta vẽ cho thứ mang THÔNG TIN (ngôi sao ưu tiên, thanh
     * đo, mốc). Ô này không mang một con số nào ⇒ nó là một khoảnh khắc.
     * ⚠ Trễ một nhịp là CÓ LÝ DO: con dấu `dongDau` chạy 420ms, hai vật cùng rơi một lúc
     * thì không vật nào được nhìn.
     */
    let daChot = false;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const dap = (body: unknown) => new Response(JSON.stringify(body), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
      if (url.includes('/pfm/tuan')) {
        daChot = true;
        return dap({ tuan: '2026-W37', moi: true, tokenThuong: 12 });
      }
      if (url.includes('/auth/me')) {
        return dap(daChot
          ? { ...ME_CO_PFM, pfm: { ...ME_CO_PFM.pfm, tuan_da_niem_phong: true, tuan_token_thuong: 12 } }
          : ME_CO_PFM);
      }
      return dap({ ok: true });
    }));

    const kho = await khoCo([]);
    ve(kho);
    await chotTuanQuaLop();
    // ⚠ Ngay lúc bấm thì CHƯA có gì để mừng — máy chủ còn chưa trả lời.
    expect(screen.queryByText(C.anMung)).toBeNull();

    const o = await screen.findByText(C.anMung, {}, { timeout: NHIP_AN_MUNG + 1500 });
    expect(o.classList.contains(lop('vothay'))).toBe(true);
    expect(o.classList.contains(lop('khac')), 'ô ăn mừng cũng là một VẬT — phải có khấc')
      .toBe(true);
    // Con dấu niêm phong đứng cùng khối, và cũng mang khấc.
    const dau = document.querySelector(`.${lop('dau')}`);
    expect(dau?.classList.contains(lop('khac'))).toBe(true);
  });

  it('⭐⭐ máy chủ TỪ CHỐI (409) ⇒ KHÔNG vỗ tay, dù đã qua nhịp', async () => {
    // ⚠ Vỗ tay cho một cú niêm phong rồi mới báo lỗi thì tệ hơn không vỗ tay.
    stubMang({
      status: 409,
      body: { error: 'chua_diem_danh_hom_nay', message: 'chua_diem_danh_hom_nay' },
    });
    const kho = await khoCo([]);
    ve(kho);
    await chotTuanQuaLop();
    await screen.findByText(C.loiChuaDiemDanh);
    await act(async () => {
      await new Promise((r) => { setTimeout(r, NHIP_AN_MUNG + 150); });
    });
    expect(screen.queryByText(C.anMung)).toBeNull();
  });

  it('⭐⭐⭐ chạm CHỐT SỔ TUẦN KHÔNG chốt ngay: mở lớp tóm tắt tuần, và máy chủ chỉ nhận lệnh khi bấm CHỐT TUẦN', async () => {
    // Người chơi phải thấy tuần của mình (số ngày ghi) TRƯỚC khi niêm phong — niêm phong là cửa một chiều.
    const kho = await khoCo([]);
    const mang = vi.mocked(fetch as unknown as (...a: unknown[]) => Promise<Response>);
    ve(kho);
    fireEvent.click(await oG('guong-chot'));
    const tl = within(await screen.findByRole('dialog'));
    expect(await tl.findByText(CB.guChotNgayGhi)).toBeInTheDocument();
    expect(mang.mock.calls.filter((c) => String(c[0]).includes('/pfm/tuan')), 'chưa bấm CHỐT TUẦN ⇒ chưa gọi máy chủ').toHaveLength(0);
    fireEvent.click(await oG('chot-tuan'));
    await waitFor(() => expect(mang.mock.calls.filter((c) => String(c[0]).includes('/pfm/tuan'))).toHaveLength(1));
  });

  it('⭐⭐ tuần ĐÃ niêm phong ⇒ nút chốt đổi vai ("đã chốt") và mở dải CHẤM, không mời niêm phong lần nữa', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/auth/me')
        ? { ...ME_CO_PFM, pfm: { ...ME_CO_PFM.pfm, tuan_da_niem_phong: true, tuan_token_thuong: 12 } }
        : { ok: true };
      return new Response(JSON.stringify(body), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }));
    const kho = await khoCo([]);
    ve(kho);
    const nut = await screen.findByRole('button', { name: CB.guDaChot });
    // Chạm ⇒ lớp HƯỚNG (dải CHẤM), không phải lớp CHỐT.
    fireEvent.click(nut);
    // D453 — kết quả tuần là dải CHẤM của tấm HƯỚNG: con dấu + số ngày có ghi của tuần.
    const dai = await screen.findByTestId('cham-niem-phong');
    expect(dai.textContent).toContain(C.dauDaChot);
    expect(dai.textContent).toContain(`6${H.ngayCoGhiHau}`);
    expect(screen.queryByRole('button', { name: CB.guChotNut }), 'đã chốt: không còn nút niêm phong').toBeNull();
  });
});

/* ═══ §VIII — §XI: góc khấc pixel, thứ mất đi mà không gì đỏ ════════════════════ */

describe('§VIII — ⭐⭐⭐ Cả màn phải có GÓC KHẤC (demo gắn `.khac` 13 chỗ)', () => {
  /** Mọi phần tử mang lớp `ten` phải mang cả lớp khấc. Trả về số phần tử ĐÃ SOI. */
  function moiVatCoKhac(goc: HTMLElement, ten: string): number {
    const ds = [...goc.querySelectorAll(`.${lop(ten)}`)];
    /* ⚠ Vế này quan trọng hơn vòng lặp dưới nó: `for` trên một danh sách RỖNG luôn xanh,
       và không có cách nào nhìn ra từ kết quả chạy (bài học `phong_cach_ui` 01/09). */
    expect(ds.length, `cảnh không có phần tử .${ten} nào để soi — bài đang canh số không`)
      .toBeGreaterThan(0);
    for (const el of ds) {
      expect(el.classList.contains(lop('khac')), `.${ten} mất góc khấc`).toBe(true);
    }
    return ds.length;
  }

  it('⭐⭐⭐ mọi VẬT trong các lớp mang lớp khấc — thẻ Oracle · linh vật · nút · tấm HƯỚNG · nút (?) · ô lặp · khối luật', async () => {
    /*
     * ⚠⚠ HỎNG IM LẶNG TUYỆT ĐỐI. `Guong.module.css` từng có **0 `clip-path`**: cả một màn
     * rơi khỏi chữ ký thị giác "Pixel Casino" (§XI luật 1 — không bo góc, vát bằng
     * `clip-path`) mà tsc sạch, mọi bài tìm-chữ vẫn xanh, console không một dòng.
     * ⚠ Bài đi theo ĐƯỜNG CHÍNH (D78): mở từng lớp như người dùng, vì `.hoi` sống trong lớp CHỈ SỐ còn `.oNho` sống trong lớp
     *   khoản LẶP — và các lớp không bao giờ cùng mở. Tầng không gian: nắp/lá nắp không còn (mặt là ô OBento, bóng pixel cứng ở
     *   `OBento.module.css`); những VẬT còn lại nằm trong lớp.
     */
    const kho = await khoCo([
      { ngay: `${THANG_TRUOC}-05`, soTien: 59_000, nhan: 'choi', ghiChu: 'goi nhac' },
      { ngay: `${THANG}-05`, soTien: 59_000, nhan: 'choi', ghiChu: 'goi nhac' },
    ]);
    ve(kho);   // ⚠ KHÔNG có luật nào: có luật bật thì thẻ Oracle `moi_dat_luat` tắt (lớp TIỀN TỚI trống) — khối luật soi qua FORM đặt luật.
    let dem = 0;
    const trongLop = () => screen.getByRole('dialog');

    // Lớp TIỀN TỚI: thẻ Oracle + ô linh vật + hai nút của thẻ.
    const tt = await moG('guong-tien-toi');
    await tt.findByRole('button', { name: C.nutBoQua });
    dem += moiVatCoKhac(trongLop(), 'oracle');
    dem += moiVatCoKhac(trongLop(), 'linh');
    dem += moiVatCoKhac(trongLop(), 'nut2');

    // Lớp HƯỚNG: chính tấm + ba PHÍM chọn hướng của nó (11/10: thay hình (?) cũ).
    await moG('guong-huong');
    const tam = await screen.findByTestId('the-huong');
    expect(tam.classList.contains(lop('khac')), 'tấm HƯỚNG mất góc khấc').toBe(true);
    const phim = [...within(tam).getByTestId('huong-lua-chon').querySelectorAll('button')];
    expect(phim.length, 'tấm HƯỚNG không có phím nào để soi').toBeGreaterThan(0);
    for (const p of phim) expect(p.classList.contains(lop('khac')), 'phím chọn hướng mất góc khấc').toBe(true);
    dem += 1 + phim.length;

    // D453 — chỉ số (`.hoi`) và khoản lặp (`.oNho`) cùng sống trong lớp THÓI QUEN.
    await moG(NAP_THOI_QUEN);
    dem += moiVatCoKhac(trongLop(), 'hoi');
    dem += moiVatCoKhac(trongLop(), 'oNho');

    // Lớp LUẬT: form đặt luật (khối luật).
    await moG('guong-luat');
    fireEvent.click(await screen.findByRole('button', { name: C.themLuat }));
    await within(trongLop()).findByText(C.formHoi);
    dem += moiVatCoKhac(trongLop(), 'khoi2');

    expect(dem, 'soi được ít hơn thế là cảnh đã trôi (bài đang canh số không)').toBeGreaterThanOrEqual(8);
  });

  it('⭐⭐⭐ lớp `khac` THẬT SỰ cắt góc — `composes` lớp `khung`, không tự chép polygon', () => {
    /*
     * ⚠⚠ Bài DOM ở trên chỉ chứng minh lớp được GẮN. Dưới `css: false` của vitest, tên lớp
     * là một proxy sinh theo yêu cầu — `sGuong.khac` có giá trị KỂ CẢ KHI tệp CSS không
     * khai `.khac` dòng nào. Nên vế thứ hai này bắt buộc: đọc thẳng nguồn CSS.
     * ⚠ MỘT NGUỒN (A11.5): đòi `composes`, không đòi một polygon chép tay — bản chép thứ
     * hai sẽ trôi khi `--px-notch` đổi, và trôi im lặng vì góc vát sai 1px không làm gì đỏ.
     */
    expect(cssGuong(), '`.khac` phải composes `khung` của pixel.module.css')
      .toMatch(/\.khac\s*\{[^}]*composes:\s*khung\s+from\s+['"][^'"]*pixel\.module\.css['"]/);

    // Và lớp được mượn ấy phải còn cắt thật — nếu `khung` mất `clip-path` thì cả 13 chỗ
    // mất khấc mà bài trên vẫn xanh.
    const pixel = readFileSync(resolve(__dirname, '../src/styles/pixel.module.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');
    expect(/\.khung\s*\{[^}]*clip-path:\s*polygon\(/.test(pixel), '`khung` hết cắt góc')
      .toBe(true);
  });
});

/* ═══ §IX — Giá trị ĐÃ BỊ KẸP phải nói ra là đã kẹp ═════════════════════════════ */

describe('§IX — ⭐⭐⭐ App không được nói nhẹ đi con số tiền của chính người dùng', () => {
  /** Cảnh: tháng trước chi 1.000.000 · tháng này thu 1.000.000, chi 3.000.000. */
  const HAT_GAP_BA: HatKhoan[] = [
    { ngay: `${THANG_TRUOC}-05`, soTien: 1_000_000, nhan: 'an_uong' },
    { ngay: `${THANG}-02`, soTien: 1_000_000, chieu: 'thu' },
    { ngay: `${THANG}-05`, soTien: 3_000_000, nhan: 'an_uong' },
  ];

  it('⭐⭐⭐ `soVoiMoc(3e6, 1e6)` ⇒ nhãn KHÔNG được là chuỗi "+100%" trần', () => {
    /*
     * ⚠⚠ ĐÂY LÀ CHỖ APP NÓI DỐI VỀ TIỀN. `soVoiMoc` KẸP về [−1, 1] rồi bật `chamSan`, và
     * chuỗi "chamSan" trước đây KHÔNG xuất hiện một lần nào trong `Guong.tsx`: tháng trước
     * chi 1 triệu, tháng này 3 triệu ⇒ màn hiện "+100%" ⇒ người dùng đọc ra "tôi tiêu gấp
     * đôi" trong khi sự thật là GẤP BA. Cùng chuyện với `tiet_kiem_rong` (cũng kẹp).
     */
    const moc = soVoiMoc(3_000_000, 1_000_000);
    expect(moc.gt, 'cảnh phải THẬT SỰ chạm biên, không thì bài không canh gì').toBe(1);
    expect(moc.chamSan).toBe(true);

    const ds = dungChiSo(cuaThang(HAT_GAP_BA, THANG), cuaThang(HAT_GAP_BA, THANG_TRUOC));
    const tongChi = ds.find((d) => d.id === 'tong_chi');
    expect(tongChi?.nhan, 'giá trị đã kẹp mà in như số thật').not.toBe('+100%');
    expect(tongChi?.nhan).toBe(`${C.vuotTran}+100%`);

    // Chi gấp đôi thu ⇒ tiết kiệm ròng cũng chạm biên, và chạm ở đầu KIA.
    const tietKiem = ds.find((d) => d.id === 'tiet_kiem');
    expect(tietKiem?.nhan).not.toBe('-100%');
    expect(tietKiem?.nhan).toBe(`${C.duoiSan}-100%`);
  });

  it('⭐⭐ và màn HIỆN đúng nhãn ấy — không phải chỉ hàm dựng trả đúng', async () => {
    const kho = await khoCo(HAT_GAP_BA);
    ve(kho);
    await moG(NAP_THOI_QUEN);
    expect(await screen.findByText(`${C.vuotTran}+100%`)).toBeInTheDocument();
    expect(screen.queryByText('+100%'), 'con số trần vẫn còn ở đâu đó trên màn').toBeNull();
  });

  it('⭐⭐ giá trị KHÔNG chạm biên thì KHÔNG mang tiền tố — dấu ≥ phải có nghĩa', async () => {
    /*
     * ⚠ Dán `≥` cho mọi con số là mất luôn thông tin mà nó chở: một tháng chi tăng 50% thì
     * "+50%" là SỰ THẬT, không phải một biên.
     */
    const kho = await khoCo([
      { ngay: `${THANG_TRUOC}-05`, soTien: 1_000_000, nhan: 'an_uong' },
      { ngay: `${THANG}-05`, soTien: 1_500_000, nhan: 'an_uong' },
    ]);
    ve(kho);
    await moG(NAP_THOI_QUEN);
    expect(await screen.findByText('+50%')).toBeInTheDocument();
  });

  it('⭐⭐⭐ D426 — "tổng chi so tháng trước" là so CÙNG NGÀY, cùng cặp số với đầu thẻ CHI TỪNG NGÀY', async () => {
    /*
     * ⚠⚠ Trước D426 dòng này so tháng đang chạy với CẢ tháng trước: hôm nay 15/09, tháng 8 chi 1 triệu ngày 05 và thêm 3
     * triệu ngày 25 ⇒ màn nói "−75%" cho một người mới tiêu y như tháng trước tới cùng ngày. Cùng màn, đầu thẻ CHI TỪNG
     * NGÀY nói "tháng 8 cùng ngày 1.000.000" — hai con số "so tháng trước" cãi nhau.
     */
    const hat: HatKhoan[] = [
      { ngay: `${THANG_TRUOC}-05`, soTien: 1_000_000 },
      { ngay: `${THANG_TRUOC}-25`, soTien: 3_000_000 },
      { ngay: `${THANG}-05`, soTien: 1_000_000 },
    ];
    const ds = dungChiSo(cuaThang(hat, THANG), cuaThang(hat, THANG_TRUOC), { nay: 1_000_000, truoc: 1_000_000 });
    expect(ds.find((d) => d.id === 'tong_chi')?.nhan).toBe('0%');
    expect(dungChiSo(cuaThang(hat, THANG), cuaThang(hat, THANG_TRUOC)).find((d) => d.id === 'tong_chi')?.nhan,
      'cách cũ (cả tháng) — cảnh phải thật sự phân biệt hai cách').toBe('-75%');

    ve(await khoCo(hat));
    const tl = await moG(NAP_THOI_QUEN);
    const dong = await tl.findByText(`${C.csTongChiPre}8${B.csTongChiCungNgay}`);
    expect(dong.closest(`.${lop('csD')}`)?.textContent).toContain('0%');
    expect(screen.getByRole('dialog').textContent, 'màn không được còn con số so-cả-tháng').not.toContain('-75%');
    // Cặp số của đầu thẻ CHI TỪNG NGÀY nằm ở lớp biểu đồ — cùng một phép `soCungNgay`.
    await moG('guong-chi-ngay');
    expect((await screen.findByTestId('tn-truoc')).textContent).toContain('1.000.000');
  });
});

/* ═══ §X — chép demo: token · selector · vùng chạm · ô ăn mừng ══════════════════ */

describe('§X — ⭐⭐ Chép demo NGUYÊN VĂN, không diễn giải lại', () => {
  it('⭐⭐ `--chu-thieu` ở bậc `--n-7`, và `.thieuMau` không tự thêm `font-weight`', () => {
    /*
     * ⚠⚠ `--n-6` (#5d7290) đo trên `--surface-card` ra 3,85 — DƯỚI sàn 4,5 của
     * `04-mau-va-tuong-phan.md` §6.2. Và vì selector cũ là code chết nên chưa phép đo nào
     * từng chạy trên nó: câu "chưa đủ để nói" hiện bằng diện mạo của một con số.
     * ⚠ `font-weight: 600` là thứ bản thi công tự thêm — không có ở demo, không có ở đâu
     * cả. Mọi phép đo tương phản/ΔE của demo tính trên đúng những giá trị demo khai
     * (A11.25), nên chép sang phải nguyên vẹn.
     */
    /*
     * ⚠ TOKEN ĐÃ DỜI SANG `styles/pfm_token.css` (08/09, D308) — `Guong.module.css`
     * chỉ khai TẠM nó từ D292 và tự ghi nợ "đưa về tệp token là một lượt riêng".
     * Bài này canh GIÁ TRỊ, không canh chỗ ở, nên nó đọc tệp token; và nó vẫn phải
     * canh rằng màn KHÔNG khai lại — hai bản của một token là mầm trôi (A11.5).
     */
    const css = cssGuong();
    const token = readFileSync(resolve(__dirname, '../src/styles/pfm_token.css'), 'utf8');
    expect(token).toMatch(/--chu-thieu:\s*var\(--n-7\)/);
    expect(token, '`--n-6` dưới sàn tương phản').not.toMatch(/--chu-thieu:\s*var\(--n-6\)/);
    expect(css, 'màn khai lại token đã có ở tệp chung').not.toMatch(/--chu-thieu:/);

    const khoi = /\.csTop\s+\.v\.thieuMau\s*\{([^}]*)\}/.exec(css)?.[1];
    expect(khoi, 'không thấy selector `.csTop .v.thieuMau` — `.cs .v` là code chết').toBeTruthy();
    expect(khoi!).not.toMatch(/font-weight/);
  });

  it('⭐⭐⭐ CSS nút (?): NÚT `.cham44` 44px không khấc/không clip · HÌNH `.hoi` 21px · lớp phủ giả đã bỏ', () => {
    /*
     * ⚠⚠ Bản trước của bài này canh "chép đúng demo" (lớp phủ `::before` 44px) và tự ghi
     * chú rằng vùng chạm ấy KHÔNG có hiệu lực — `clip-path` của lớp khấc xén cả pseudo-element
     * lẫn vùng nhận chạm. Founder đã chốt phương án (c): nút là phần tử BỌC không khấc.
     * Nên bài canh giờ soi đúng ba điều làm phương án ấy đúng:
     *   · khối `.hoi{}` và `.cham44{}` KHÔNG tự `clip-path`/`composes` (khấc chỉ được gắn
     *     lên HÌNH qua lớp `.khac` ở JSX, không bao giờ lên NÚT);
     *   · `.hoi::before` không còn — vùng chạm giờ là chính cái nút, không phải một lớp phủ;
     *   · số đo chép nguyên: 44 (chạm) · 21 (hình) · lề âm (44−21)/2 để hàng chữ không cao lên.
     */
    const css = cssGuong();
    const khoiHoi = /\.hoi\s*\{([^}]*)\}/.exec(css)?.[1];
    const khoiCham = /\.cham44\s*\{([^}]*)\}/.exec(css)?.[1];
    expect(khoiHoi, 'không thấy khối `.hoi`').toBeTruthy();
    expect(khoiCham, 'không thấy khối `.cham44`').toBeTruthy();
    for (const [ten, khoi] of [['.hoi', khoiHoi!], ['.cham44', khoiCham!]] as const) {
      expect(khoi, `${ten} không được tự cắt góc`).not.toMatch(/clip-path|composes/);
    }
    expect(css, 'lớp phủ giả trên `.hoi` đã bỏ — vùng chạm giờ là chính cái nút')
      .not.toMatch(/\.hoi::before/);
    expect(khoiCham).toMatch(/width:\s*44px/);
    expect(khoiCham).toMatch(/height:\s*44px/);
    expect(khoiCham).toMatch(/margin:\s*-11\.5px/);
    expect(khoiHoi).toMatch(/width:\s*21px/);
    // Trạng thái nằm trên NÚT: selector mở phải đi từ `.cham44[aria-expanded]` xuống hình.
    expect(css).toMatch(/\.cham44\[aria-expanded=['"]true['"]\]\s+\.hoi/);
  });

  it('⭐⭐⭐ DOM nút (?): phần tử BẤM ĐƯỢC không mang khấc; hình khấc là CON của nó', async () => {
    /*
     * ⚠⚠ Bài CSS ở trên chứng minh hai khối không tự cắt; bài này chứng minh JSX không gắn
     * `khac` lên nút (một `${s.cham44} ${s.khac}` là đủ để lớp phủ 44px vô hiệu trở lại mà
     * mọi bài tìm chữ vẫn xanh). Soi HÌNH DẠNG DOM: nút ≠ hình, và trạng thái ở trên NÚT.
     */
    const kho = await khoCo([]);
    ve(kho);
    const tl = await moG(NAP_THOI_QUEN);
    // D426 — bốn chỉ số (vì sale chỉ dựng khi có câu trả lời). Nút (?) của thẻ biểu đồ mang tên riêng (aria-label).
    const nut = await waitFor(() => {
      const ds = tl.getAllByRole('button', { name: '?' });
      expect(ds).toHaveLength(4);
      return ds;
    });
    expect(nut, 'bốn chỉ số, bốn nút (?)').toHaveLength(4);
    for (const b of nut) {
      expect(b.classList.contains(lop('cham44')), 'nút phải là `.cham44`').toBe(true);
      expect(b.classList.contains(lop('khac')), 'NÚT không được mang khấc').toBe(false);
      expect(b.classList.contains(lop('hoi')), 'NÚT không phải là hình').toBe(false);
      const hinh = b.querySelector(`.${lop('hoi')}`);
      expect(hinh, 'hình (?) nằm TRONG nút').not.toBeNull();
      expect(hinh!.classList.contains(lop('khac')), 'hình vẫn có khấc (§XI)').toBe(true);
    }
    // Bấm NÚT ⇒ trạng thái đổi trên NÚT, lời giải mở, hình đổi thành ✕.
    fireEvent.click(nut[0]!);
    expect(nut[0]).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector(`.${lop('giai')}`), 'lời giải phải mở').not.toBeNull();
    expect(nut[0]!.textContent).toBe('✕');
  });
});

/* ═══ §VII — A10 🔒: bảng chữ mới phải NẰM TRONG tầm quét ════════════════════════ */

describe('§VII — ⭐⭐⭐ `CHU_MAN_GUONG` có mặt trong `moiChuoiPfm()`', () => {
  it('⭐⭐⭐ mọi chuỗi của bảng GƯƠNG đều bị bộ quét A10 soi', async () => {
    /*
     * ⚠⚠ `pfm_chu.test.ts` §I quét `moiChuoiPfm()`, mà hàm ấy gom bảng bằng cách LIỆT KÊ
     * TAY. Thêm một bảng mà quên nối vào thì §I vẫn XANH — nó quét đủ mọi thứ nó biết,
     * chỉ là nó không biết bảng mới. Màn GƯƠNG chở nhiều câu giải thích/hỏi han, đúng
     * loại dễ trượt A10 nhất, nên nó phải chứng minh được là đang bị soi.
     */
    const { moiChuoiPfm } = await import('../src/lib/pfm_chu');
    const quet = new Set(moiChuoiPfm());
    for (const [k, v] of Object.entries(C)) {
      expect(quet.has(v), `CHU_MAN_GUONG.${k}: "${v}" chưa nằm trong tầm quét A10`).toBe(true);
    }
    expect(Object.keys(C).length, 'bảng rỗng làm bài trên xanh mà chẳng chứng minh gì')
      .toBeGreaterThan(50);
  });
});
