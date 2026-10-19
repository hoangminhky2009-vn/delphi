/**
 * PFM — MÀN BIỂU ĐỒ (D426): ba thẻ đầu GƯƠNG (`BieuDoThang`) · ruột nắp 6 THÁNG / THÓI QUEN · nắp NÓI · LÀM · TRONG TRẬN
 * (`BaMat.tsx`) · đường góp trên lá vị thế ở màn HŨ.
 *
 * ⭐⭐⭐ Canh bốn điều:
 *   (1) số trên thẻ là số của SỔ/HŨ — biểu đồ là cách NHÌN, không phải phép đếm thứ hai (A11.5);
 *   (2) bước tháng ‹ › là "phân tích cuối tháng": lùi về tháng đã khép thì ba thẻ nói TRỌN tháng ấy;
 *   (3) ba mặt đặt CẠNH nhau, không chấm; mặt TRẬN dưới đúng cửa `noi_game`; thiếu thì "—" / "chưa trả lời", không bịa;
 *   (4) A10 — mọi chữ mới nằm trong tầm quét, ▲▼ không màu phán xét (canh ở `pfm_man_guong.test.tsx` §V).
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NangLucCuaToiDTO } from '@server/holdem/nang_luc_ids';

const NGAY = '2026-09-15';
const THANG = '2026-09';
const LUC = '2026-06-01T02:00:00.000Z';

vi.mock('../src/lib/telemetry.js', () => ({ ghiDo: vi.fn(), manCuaDuong: () => '/tai-chinh/guong' }));
vi.mock('../src/pfm/thoi_gian.js', async (goc) => {
  const m = await goc<typeof import('../src/pfm/thoi_gian.js')>();
  return { ...m, homNay: () => NGAY, thangNay: () => THANG };
});

const {
  BieuDoSauThang, BieuDoThang, BieuDoThoiQuen, BieuDoViThe, chenh, tienNgan, tomSauThang,
} = await import('../src/screens/tai-chinh/BieuDo');
const { KHUNG_CUA_NHIP, MatBaMat, dungBaMat, soCapDu } = await import('../src/screens/tai-chinh/BaMat');
const { RuotHu } = await import('../src/screens/tai-chinh/Hu');
const { KhoProvider } = await import('../src/pfm/dung_kho');
const { KhoTrongBoNho } = await import('../src/pfm/kho.js');
const { khoanRaBanGhi, taoKhoan, tongGopVaoHu } = await import('../src/pfm/so.js');
const { taoKhoanPhanBo } = await import('../src/pfm/phan_bo.js');
const { tuTao } = await import('../src/pfm/hu.js');
const { hanTuSoThang, tongLoiDoan } = await import('../src/pfm/vi_the.js');
const { lichSuThang } = await import('../src/pfm/bieu_do.js');
const { congNgay } = await import('../src/pfm/thoi_gian.js');
const { CAU_PV } = await import('../src/pfm/phong_van.js');
const { CHU_BIEU_DO: B, CHU_MAN_GUONG: C, CHU_MAN_HU, moiChuoiPfm } = await import('../src/lib/pfm_chu');
const sBieuDo = (await import('../src/screens/tai-chinh/BieuDo.module.css')).default;

type Khoan = import('../src/pfm/so.js').Khoan;
type Hu = import('../src/pfm/hu.js').Hu;
type HoSo = import('../src/pfm/ho_so.js').HoSo;

let dem = 0;
const id = (): string => `k${dem++}`;
const chi = (ngay: string, soTien: number, ghiChu?: string): Khoan =>
  taoKhoan({ ngay, soTien, ...(ghiChu !== undefined ? { ghiChu } : {}) }, `${ngay}T05:00:00.000Z`, id());
const thu = (ngay: string, soTien: number): Khoan => taoKhoan({ ngay, soTien, chieu: 'thu' }, `${ngay}T02:00:00.000Z`, id());
const nap = (ngay: string, soTien: number, huId: string): Khoan =>
  taoKhoanPhanBo({ ngay, soTien, huId, phanBo: 'tay' }, `${ngay}T13:00:00.000Z`, id());
const gan = (ngay: string, soTien: number, huId: string): Khoan =>
  taoKhoanPhanBo({ ngay, soTien, huId, phanBo: 'gan' }, `${ngay}T14:00:00.000Z`, id());

const huAn = (muc = 3_000_000): Hu => tuTao({ ten: 'Ăn uống', muc, nhom: 'tieu_dung' }, LUC, 'h-an');
const huXe = (): Hu => tuTao(
  { ten: 'Xe máy', muc: 12_000_000, lenh: { tu: '2026-08-01', kyHan: hanTuSoThang('2026-08-01', 12) } }, LUC, 'h-xe',
);

const veThang = (tatCa: Khoan[], hu: Hu[] = []) => render(
  <MemoryRouter><BieuDoThang tatCa={tatCa} hu={hu} thangNay={THANG} ngayNay={NGAY} /></MemoryRouter>,
);

/* ═══ §I — TIỀN VÀO ĐI ĐÂU ════════════════════════════════════════════════════════════════════ */

describe('§I — ⭐⭐⭐ TIỀN VÀO ĐI ĐÂU nói đúng số của SỔ và HŨ', () => {
  it('⭐⭐⭐ VÀO · CHI · ĐỂ DÀNH · CÒN DƯ đúng số; chú giải kể từng hũ + phần chưa chia', async () => {
    veThang([
      thu('2026-09-05', 4_500_000), chi('2026-09-05', 200_000), chi('2026-09-06', 300_000),
      gan('2026-09-06', 250_000, 'h-an'), nap('2026-09-07', 700_000, 'h-xe'),
    ], [huAn(), huXe()]);
    expect(screen.getByTestId('dd-vao')).toHaveTextContent('4.500.000');
    expect(within(screen.getByTestId('dd-chi')).getByText('500.000')).toBeInTheDocument();
    expect(within(screen.getByTestId('dd-de')).getByText('700.000')).toBeInTheDocument();
    expect(within(screen.getByTestId('dd-du')).getByText('3.300.000')).toBeInTheDocument();
    const the = screen.getByTestId('the-di-dau');
    expect(within(the).getByText('ĂN UỐNG 250k')).toBeInTheDocument();
    expect(within(the).getByText(`${B.chuaChia} 250k`)).toBeInTheDocument();
    expect(within(the).getByText('XE MÁY 700k')).toBeInTheDocument();
  });

  it('⭐⭐⭐ ‹ lùi về tháng ĐÃ KHÉP: ba thẻ nói trọn tháng ấy; mép trái là tháng sổ sớm nhất; › về lại tháng đang chạy', async () => {
    veThang([thu('2026-08-05', 4_000_000), chi('2026-08-20', 900_000), thu('2026-09-05', 4_500_000)]);
    const truoc = screen.getByRole('button', { name: B.thangTruocAria });
    const sau = screen.getByRole('button', { name: B.thangSauAria });
    expect(screen.getByTestId('bd-thang')).toHaveTextContent(`${B.thangPre}9`);
    expect(sau, 'tháng đang chạy là mép phải').toBeDisabled();

    fireEvent.click(truoc);
    expect(screen.getByTestId('bd-thang')).toHaveTextContent(`${B.thangPre}8`);
    expect(screen.getByText(B.daKhep)).toBeInTheDocument();
    expect(screen.getByTestId('dd-vao')).toHaveTextContent('4.000.000');
    // Tháng đã khép: đầu thẻ CHI TỪNG NGÀY là CẢ tháng (chi ngày 20 vào), không "tới ngày 15".
    expect(screen.getByText(`${B.caThangPre}8`)).toBeInTheDocument();
    expect(screen.getByTestId('tn-nay')).toHaveTextContent('900.000');
    expect(screen.getByRole('button', { name: B.thangTruocAria }), 'tháng 8 là tháng sổ sớm nhất').toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: B.thangSauAria }));
    expect(screen.getByTestId('bd-thang')).toHaveTextContent(`${B.thangPre}9`);
  });

  it('⭐⭐ tiêu + để dành vượt tiền vào ⇒ ô thứ ba là VƯỢT, và câu nói đúng phần vượt (không số âm trần)', () => {
    veThang([thu('2026-09-05', 1_000_000), chi('2026-09-06', 1_500_000)]);
    expect(within(screen.getByTestId('dd-du')).getByText(B.vuot)).toBeInTheDocument();
    expect(within(screen.getByTestId('dd-du')).getByText('50%')).toBeInTheDocument();
    expect(within(screen.getByTestId('dd-du')).getByText('500.000')).toBeInTheDocument();
    expect(screen.getByText(`${B.vuotPre}500.000 đ.`)).toBeInTheDocument();
  });

  it('⭐⭐ phần khác 0 mà làm tròn ra 0 ⇒ "<1%", không "0%" (5.000 trên 6.500.000)', () => {
    veThang([thu('2026-09-05', 6_500_000), chi('2026-09-06', 6_495_000)]);
    expect(within(screen.getByTestId('dd-du')).getByText('5.000')).toBeInTheDocument();
    expect(within(screen.getByTestId('dd-du')).getByText('<1%')).toBeInTheDocument();
  });

  it('tháng không một khoản nào ⇒ một câu, không thanh, không số 0', () => {
    veThang([]);
    expect(screen.getByText(B.thangTrong)).toBeInTheDocument();
    expect(screen.queryByTestId('dd-vao')).toBeNull();
  });
});

/* ═══ §II — CHI TỪNG NGÀY ═════════════════════════════════════════════════════════════════════ */

describe('§II — CHI TỪNG NGÀY: cột là tiêu thật, chạm cột đọc đúng ngày', () => {
  it('⭐⭐ tháng đang chạy chọn sẵn HÔM NAY; chạm một cột ⇒ khoản của đúng ngày ấy (ghi chú của chính khoản)', () => {
    veThang([chi(NGAY, 45_000, 'Cơm trưa'), chi(NGAY, 100_000, 'Grab'), chi('2026-09-10', 70_000)]);
    const chiTiet = screen.getByTestId('tn-chi-tiet');
    expect(within(chiTiet).getByText('Cơm trưa')).toBeInTheDocument();
    expect(within(chiTiet).getByText('145.000')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '10/09: 70.000 đ' }));
    const moi = screen.getByTestId('tn-chi-tiet');
    expect(moi.textContent).toContain('10/09');
    expect(within(moi).getByText(B.khoanChi), 'khoản không ghi chú ⇒ "chi", không để trống').toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10/09: 70.000 đ' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('⭐⭐ ngày KHÔNG GHI ⇒ "sổ không ghi gì" — khác ngày có ghi mà chỉ có tiền vào (P7)', () => {
    veThang([thu('2026-09-05', 1_000_000), chi('2026-09-06', 50_000)]);
    fireEvent.click(screen.getByRole('button', { name: '03/09: 0 đ' }));
    expect(within(screen.getByTestId('tn-chi-tiet')).getByText(B.ngayKhongGhi)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '05/09: 0 đ' }));
    const ct = screen.getByTestId('tn-chi-tiet');
    expect(within(ct).getByText(B.ngayKhongChi)).toBeInTheDocument();
    expect(within(ct).getByText('+1.000.000')).toBeInTheDocument();
  });

  it('⭐⭐ ngày LỚN mang đỉnh vàng đúng ngưỡng chỉ số chi bù (nền × hệ số) — ngày thường thì không', () => {
    // Bảy ngày 50k ⇒ nền (trung vị) 50k; ngày 12 chi 500k ⇒ lớn.
    const so = [3, 4, 5, 6, 7, 8, 9].map((d) => chi(`2026-09-0${d}`, 50_000));
    veThang([...so, chi('2026-09-12', 500_000)]);
    const cot = (ten: string) => screen.getByRole('button', { name: ten }).querySelector('i')!;
    expect(cot('12/09: 500.000 đ').classList.contains(sBieuDo.lon!)).toBe(true);
    expect(cot('05/09: 50.000 đ').classList.contains(sBieuDo.lon!)).toBe(false);
  });

  it('CỘNG DỒN: đường tháng này (tới hôm nay) chồng tháng trước; chú giải nói đúng hai tổng', () => {
    veThang([chi('2026-08-03', 300_000), chi('2026-09-02', 120_000), chi('2026-09-20', 999_000)]);
    fireEvent.click(screen.getByRole('button', { name: B.cheDoDon }));
    expect(screen.getByRole('button', { name: B.cheDoDon })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('tn-cong-don')).toBeInTheDocument();
    const the = screen.getByTestId('the-tung-ngay');
    expect(within(the).getByText('120k'), 'tháng này tới hôm nay — khoản ngày 20 chưa tới').toBeInTheDocument();
    expect(within(the).getByText('300k')).toBeInTheDocument();
  });
});

/* ═══ §III — HŨ TIÊU DÙNG ═════════════════════════════════════════════════════════════════════ */

describe('§III — HŨ TIÊU DÙNG so với mức tự đặt', () => {
  it('⭐⭐ vượt mức ⇒ "vượt mức X" (một câu tả), vạch nhịp ┆ chỉ ở tháng đang chạy', () => {
    veThang([chi('2026-08-05', 100_000), gan('2026-08-05', 100_000, 'h-an'), chi('2026-09-05', 450_000),
      gan('2026-09-05', 450_000, 'h-an')], [huAn(300_000)]);
    const the = screen.getByTestId('the-hu-tieu');
    expect(within(the).getByText(`${B.vuotMucPre}150.000 đ`)).toBeInTheDocument();
    expect(the.querySelector(`.${sBieuDo.thanhHu} u`), 'tháng đang chạy có vạch nhịp').not.toBeNull();
    expect(within(the).getByText(`${B.nhipNgayPre}15/30`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: B.thangTruocAria }));
    const cu = screen.getByTestId('the-hu-tieu');
    expect(cu.querySelector(`.${sBieuDo.thanhHu} u`), 'tháng đã khép: không "hôm nay" nào để vạch').toBeNull();
  });

  it('⭐ D453 — chưa có hũ tiêu dùng ⇒ KHÔNG dựng thẻ (một thẻ trống chỉ để nói "chưa có" là chữ không mang tin)', () => {
    /* Lối vào hũ tiêu dùng nay là hướng "một hũ tiêu dùng cho phần chưa chia" trên tấm HƯỚNG (`pfm_huong.test.ts`). */
    veThang([chi('2026-09-05', 45_000)], [huXe()]);
    expect(screen.getByTestId('bieu-do-thang')).toBeInTheDocument();
    expect(screen.queryByTestId('the-hu-tieu')).toBeNull();
    expect(screen.queryByText(B.chuaCoHuTieu)).toBeNull();
  });
});

/* ═══ §IV — 6 THÁNG · THÓI QUEN ════════════════════════════════════════════════════════════════ */

describe('§IV — 6 THÁNG · THÓI QUEN', () => {
  const so6 = (): Khoan[] => [
    thu('2026-07-05', 4_000_000), chi('2026-07-10', 3_000_000), nap('2026-07-11', 400_000, 'h-xe'),
    thu('2026-08-05', 5_000_000), chi('2026-08-10', 3_500_000), nap('2026-08-11', 1_000_000, 'h-xe'),
    chi('2026-09-03', 800_000),
  ];

  it('⭐⭐ tỷ lệ để dành từng tháng; tháng không tiền vào ⇒ "—"; tháng đang chạy mang dấu "·nay"', () => {
    render(<BieuDoSauThang ds={lichSuThang(so6(), THANG, 3)} thangNay={THANG} />);
    // Mỗi tỷ lệ đứng ngay dưới cột của CHÍNH tháng ấy (soi ảnh 26/09: dồn một hàng thì mắt phải đếm cột).
    expect(screen.getByTestId('ty-le-2026-07')).toHaveTextContent('10%');
    expect(screen.getByTestId('ty-le-2026-08')).toHaveTextContent('20%');
    expect(screen.getByTestId('ty-le-2026-09')).toHaveTextContent('—');
    expect(screen.getByText(`${B.thangNganPre}9${B.thangDangChayHau}`)).toBeInTheDocument();
  });

  it('⭐⭐ lá nắp: TB trên các tháng ĐÃ KHÉP có tiền vào (không lấy tháng đang chạy); rỗng ⇒ "chưa có"', () => {
    expect(tomSauThang(lichSuThang(so6(), THANG, 3), THANG)).toBe(`${B.deDanhTbPre}15%`);
    expect(tomSauThang(lichSuThang([chi('2026-09-03', 1)], THANG, 1), THANG)).toBe(`1${B.donViThang}`);
    expect(tomSauThang([], THANG)).toBe(C.chuaCo);
  });

  it('THÓI QUEN: chưa đủ hai ngày mỗi thứ ⇒ "chưa đủ để nói", không cột 0', () => {
    render(<BieuDoThoiQuen tatCa={[chi('2026-09-14', 50_000)]} ngayNay={NGAY} />);
    expect(screen.getAllByText(C.thieuMau).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('bd-thoi-quen').textContent).not.toMatch(/\b0k\b/);
  });
});

/* ═══ §V — NÓI · LÀM · TRONG TRẬN ═════════════════════════════════════════════════════════════ */

const NANG_LUC: NangLucCuaToiDTO = {
  formula_version: 1, so_de: 3,
  nang_luc: [
    { id: 'cam_ket_tiet_kiem', bac: 'lam_duoc', so_de_gap: 3, so_de_lam_duoc: 2, lan_dau_lam_duoc: null },
    { id: 'doc_tin', bac: 'gap_chua_vung', so_de_gap: 2, so_de_lam_duoc: 0, lan_dau_lam_duoc: null },
    { id: 'phan_tan', bac: 'chua_gap', so_de_gap: 0, so_de_lam_duoc: 0, lan_dau_lam_duoc: null },
  ],
};

const veBaMat = (hoSo: HoSo, noiGame: boolean, nl: NangLucCuaToiDTO | undefined, tatCa: Khoan[], hu: Hu[] = []) =>
  render(
    <MemoryRouter>
      <MatBaMat
        so={dungBaMat(tatCa, hu, NGAY, THANG)} hoSo={hoSo} noiGame={noiGame} nl={nl}
        tongDoan={tongLoiDoan(hu, [], THANG)} thang={THANG}
      />
    </MemoryRouter>,
  );

describe('§V — ⭐⭐⭐ NÓI · LÀM · TRONG TRẬN: từng cặp đặt cạnh nhau, không chấm', () => {
  const SO: () => Khoan[] = () => [thu('2026-09-05', 4_500_000), nap('2026-09-06', 500_000, 'h-xe'), chi('2026-09-06', 90_000)];

  it('⭐⭐⭐ mặt NÓI là câu trả lời phỏng vấn NGUYÊN VĂN; mặt SỔ là số đếm được trên đúng cửa sổ tiền về', () => {
    veBaMat({ lucTienVe: 'cất một phần đi', sauKhiTieu: 'nhẩm lại giá', dauThang: 'đại khái' }, false, undefined, SO());
    const tienVe = screen.getByTestId('cap-tien-ve');
    expect(within(tienVe).getByText('“cất một phần đi”')).toBeInTheDocument();
    expect(tienVe.textContent).toContain('1/1');
    expect(within(screen.getByTestId('cap-sau-tieu')).getByText('“nhẩm lại giá”')).toBeInTheDocument();
    expect(within(screen.getByTestId('cap-dau-thang')).getByText('“đại khái”')).toBeInTheDocument();
  });

  it('⭐⭐ quá 12 lượt ⇒ THANH tỷ lệ, không cắt ô: "7/13" không được vẽ thành 7 ô đặc trên 12', () => {
    /* Soi ảnh 26/09: bản đầu cắt ở 12 ô mà vẫn tô đủ số ô đặc — "10/20" hiện như 10/12, mắt đọc 83% thay vì 50%. */
    /* Mười ba lần tiền về cách nhau BA ngày (cửa sổ tiền về là hai ngày — sát nhau thì cửa sổ của lần này trùm cú nạp của
       lần kế); nạp ở bảy lần. */
    const so: Khoan[] = [];
    for (let i = 0; i < 13; i++) {
      const ngay = congNgay('2026-07-01', i * 3);
      so.push(thu(ngay, 100_000));
      if (i % 2 === 0) so.push(nap(ngay, 10_000, 'h-xe'));
    }
    veBaMat({ lucTienVe: 'cất một phần đi' }, false, undefined, so);
    const cap = screen.getByTestId('cap-tien-ve');
    expect(cap.textContent).toContain('7/13');
    const thanh = within(cap).getByTestId('dem-thanh');
    expect(Number.parseFloat((thanh.firstElementChild as HTMLElement).style.width)).toBeCloseTo((7 / 13) * 100, 1);
    expect(cap.querySelectorAll('i').length, 'không vẽ ô nào khi đã là thanh').toBe(1);
  });

  it('⭐⭐⭐ "ngày tệ" · "đi chơi cùng bạn" ⇒ "sổ không đo được" — không suy từ lịch', () => {
    veBaMat({ nhip: ['cuối tháng', 'ngày tệ'] }, false, undefined, SO());
    const quaTay = screen.getByTestId('cap-qua-tay');
    expect(within(quaTay).getByText(B.khongDo)).toBeInTheDocument();
    expect(quaTay.textContent).toContain(`7${B.khungCuoiThangHau}`);
  });

  it('⭐⭐⭐ bảng khung ↔ câu 9 phỏng vấn: MỌI khoá là một nhãn có thật của câu ấy, và ngược lại', () => {
    /* Đổi nhãn ở `phong_van.ts` mà quên bảng này là chip của người dùng rơi vào "sổ không đo được" im lặng. */
    const cau = CAU_PV.find((c) => c.id === 'nhip')!;
    expect(new Set(Object.keys(KHUNG_CUA_NHIP))).toEqual(new Set(cau.dap));
  });

  it('chưa trả lời phỏng vấn ⇒ NÓI nói thẳng "chưa trả lời", LÚC DỄ TIÊU QUÁ TAY vẫn bày hai khung sổ', () => {
    veBaMat({}, false, undefined, SO());
    expect(screen.getAllByText(B.chuaTraLoi).length).toBe(4);
    expect(screen.getByTestId('cap-qua-tay').textContent).toContain(B.khungSauVeHau.trim());
  });

  it('⭐⭐⭐ cửa noi_game ĐÓNG ⇒ câu cửa + đường tới Cài đặt, KHÔNG một dấu trận', () => {
    veBaMat({}, false, NANG_LUC, SO());
    expect(screen.getByText(C.tranCuaDong)).toBeInTheDocument();
    expect(screen.queryByTestId('dau-tinh-cam_ket_tiet_kiem')).toBeNull();
    expect(screen.queryByTestId('cap-giu-so')).toBeNull();
  });

  it('⭐⭐⭐ cửa mở + có đề ⇒ mỗi dấu TĨNH đúng bậc đứng cạnh dòng SỔ của cùng năng lực', () => {
    veBaMat({}, true, NANG_LUC, SO(), [huXe()]);
    expect(within(screen.getByTestId('cap-giu-so')).getByTestId('dau-tinh-cam_ket_tiet_kiem'))
      .toHaveAttribute('data-bac', 'lam_duoc');
    expect(within(screen.getByTestId('cap-loc-tin')).getByTestId('dau-tinh-doc_tin'))
      .toHaveAttribute('data-bac', 'gap_chua_vung');
    expect(within(screen.getByTestId('cap-chia-gio')).getByTestId('dau-tinh-phan_tan'))
      .toHaveAttribute('data-bac', 'chua_gap');
    expect(screen.getByText(C.tranChuaHieuChuan)).toBeInTheDocument();
    // Hũ XE MÁY có kỳ hạn, đang chạy ⇒ mặt SỔ của GIỮ SỔ đếm nó.
    expect(screen.getByTestId('cap-giu-so').textContent).toContain(`${B.giuChayPre}1`);
  });

  it('⭐⭐ năng lực VẮNG trong dữ liệu trận ⇒ "—", không tự gán "chưa gặp" (P7)', () => {
    veBaMat({}, true, { ...NANG_LUC, nang_luc: NANG_LUC.nang_luc.slice(0, 2) }, SO());
    expect(screen.queryByTestId('dau-tinh-phan_tan')).toBeNull();
    expect(within(screen.getByTestId('cap-chia-gio')).getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('lá nắp đếm cặp có ĐỦ hai mặt — không phải "khớp bao nhiêu"', () => {
    const so = dungBaMat(SO(), [huXe()], NGAY, THANG);
    const doan = tongLoiDoan([], [], THANG);
    expect(soCapDu(so, {}, false, doan), 'không lời khai, không trận ⇒ 0 cặp').toBe(0);
    expect(soCapDu(so, { lucTienVe: 'cất một phần đi' }, false, doan)).toBe(1);
    expect(soCapDu(so, { lucTienVe: 'cất một phần đi' }, true, doan), '+ GIỮ SỔ (hũ có kỳ hạn) + CHIA GIỎ (vị thế có cỡ)')
      .toBe(3);
  });
});

/* ═══ §VI — màn HŨ: đường góp của lá vị thế ════════════════════════════════════════════════════ */

describe('§VI — ⭐⭐⭐ Lá vị thế mở ⇒ biểu đồ KẾ HOẠCH · THỰC GÓP, điểm cuối = số "đã góp" trên lá', () => {
  async function veHu(hu: Hu[], so: Khoan[]) {
    const kho = new KhoTrongBoNho();
    for (const h of hu) await kho.ghi('hu', { id: h.id, thang: THANG, suaLuc: LUC, d: h });
    for (const k of so) await kho.ghi('khoan', khoanRaBanGhi(k));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter initialEntries={['/tai-chinh/hu']}>
        <QueryClientProvider client={qc}><KhoProvider kho={kho}><RuotHu /></KhoProvider></QueryClientProvider>
      </MemoryRouter>,
    );
  }
  /**
   * Mở lá theo tên đã viết hoa. ⚠ Tầng không gian (11/10): mặt HŨ chỉ có hũ mini / ô ★ — lá vị thế nằm trong LỚP chi tiết của hũ, mở bằng
   * cú chạm hũ mini (hoặc ô ★) mang tên ấy; lớp mở là thẻ đã bung sẵn (biểu đồ hiện ngay, không cần chạm lá thêm lần nữa).
   */
  async function moLa(tenHoa: string): Promise<HTMLElement> {
    const ten = tenHoa.toLowerCase();
    const e = await waitFor(() => {
      const t = [...document.querySelectorAll<HTMLElement>('[data-o="hu-con-hu"], [data-o="hu-uu-tien"]')]
        .find((x) => (x.textContent ?? '').toLowerCase().includes(ten));
      expect(t, `không thấy hũ "${tenHoa}" trên mặt HŨ`).toBeTruthy();
      return t!;
    });
    fireEvent.click(e);
    const o = await waitFor(() => {
      const x = within(screen.getByRole('dialog')).getAllByText(tenHoa).find((el) => el.closest('[data-testid="la-vi-the"]') !== null);
      expect(x).toBeTruthy();
      return x!;
    });
    return o.closest('[data-testid="la-vi-the"]') as HTMLElement;
  }

  it('⭐⭐⭐ hũ có kỳ hạn: biểu đồ hiện khi MỞ lá; THỰC GÓP = tongGopVaoHu (đúng số trên lá)', async () => {
    const so = [nap('2026-08-02', 1_200_000, 'h-xe'), nap('2026-09-05', 500_000, 'h-xe')];
    await veHu([huXe()], so);
    const la = await moLa('XE MÁY');
    const bd = await within(la).findByTestId('bd-vi-the');
    const soLa = tongGopVaoHu(so, 'h-xe', null).toLocaleString('vi-VN');
    expect(within(bd).getByTestId('vt-da-gop')).toHaveTextContent(soLa);
    expect(within(la).getAllByText(soLa).length, 'số đã góp trên lá và trên biểu đồ là MỘT số').toBeGreaterThanOrEqual(2);
  });

  it('hũ chưa vào lệnh (không mức/kỳ hạn) ⇒ mở lá không có biểu đồ — không có kế hoạch nào để vẽ', async () => {
    await veHu([tuTao({ ten: 'Quỹ' }, LUC, 'h-quy')], [nap('2026-09-05', 100_000, 'h-quy')]);
    const la = await moLa('QUỸ');
    expect(within(la).getByText(CHU_MAN_HU.daGop)).toBeInTheDocument();
    expect(within(la).queryByTestId('bd-vi-the')).toBeNull();
  });

  it('BieuDoViThe: đường kế hoạch từ 0 lúc vào lệnh tới mức lúc tới hạn; nhãn "hôm nay" đứng đúng chỗ', () => {
    const { container } = render(
      <BieuDoViThe
        muc={12_000_000} lenh={{ tu: '2026-08-01', kyHan: '2027-08-01' }}
        duong={[{ ngay: '2026-08-02', luyKe: 1_200_000 }]} homNay="2027-02-01"
      />,
    );
    const keHoach = container.querySelector(`.${sBieuDo.vKeHoach}`)!.getAttribute('d')!;
    expect(keHoach.startsWith('M0 100'), 'kế hoạch bắt đầu ở 0 ngày vào lệnh').toBe(true);
    const homNay = screen.getByText(B.homNay);
    expect(Number.parseFloat(homNay.style.left)).toBeCloseTo((184 / 365) * 100, 0);
  });
});

/* ═══ §VII — chữ & tiện ích ═════════════════════════════════════════════════════════════════════ */

describe('§VII — ⭐⭐⭐ chữ mới nằm trong tầm quét A10; ▲▼ có cổng', () => {
  it('⭐⭐⭐ mọi chuỗi CHU_BIEU_DO nằm trong `moiChuoiPfm()`', () => {
    const quet = new Set(moiChuoiPfm());
    for (const [k, v] of Object.entries(B)) {
      expect(quet.has(v), `CHU_BIEU_DO.${k}: "${v}" chưa nằm trong tầm quét A10`).toBe(true);
    }
    expect(Object.keys(B).length).toBeGreaterThan(60);
  });

  it('chenh(): mốc 0 ⇒ không ô (không "∞%"); ▲/▼ theo dấu; bằng nhau ⇒ "= 0%"', () => {
    expect(chenh(100, 0)).toBeNull();
    expect(chenh(180, 100)).toBe('▲ 80%');
    expect(chenh(60, 100)).toBe('▼ 40%');
    expect(chenh(100, 100)).toBe('= 0%');
    expect(chenh(300, 100), 'không kẹp — gấp ba là ▲ 200%').toBe('▲ 200%');
  });

  it('tienNgan(): tr · k · đồng lẻ — số đủ vẫn ở hàng số', () => {
    expect(tienNgan(1_341_000)).toBe('1,34tr');
    expect(tienNgan(550_000)).toBe('550k');
    expect(tienNgan(900)).toBe('900');
    expect(tienNgan(-300_000)).toBe('−300k');
  });
});
