/**
 * PFM — MÀN SỔ, bản theo DEMO ĐÃ CHỐT (A11.25).
 *
 * ⚠ VIẾT LẠI 11/10 (TẦNG KHÔNG GIAN — SPEC `pfm-tang-khong-gian`, demo CHỐT bản 6, founder "A A A"): mặt SỔ không cuộn nay là BA Ô
 *   (CHI HÔM NAY · THÁNG · TỐI NAY) + khe gợi ý + bàn tiền; danh sách khoản · chi tiết tháng · chia tiền/hũ đầy nằm ở LỚP TRƯỢT mở từ ba ô.
 *   Mọi LUẬT bên dưới (sửa ghi đè cùng id · xoá = bia mộ · hũ đầy → ba lựa chọn → quyết toán do NGƯỜI DÙNG bấm · nảy một lần…) GIỮ NGUYÊN;
 *   chỉ ĐƯỜNG TỚI chúng đổi (mở lớp trước rồi mới thấy dòng/thẻ hũ). §I viết lại cho phương án mới (ba ô, không hàng thẻ hũ, không lối
 *   `loi-phan-bo` — thay bằng ô TỐI NAY). Hũ chưa đầy không còn bày ở SỔ (hũ sống ở tab HŨ) ⇒ vế "tiến độ %" kiểm bằng hàm thuần.
 *
 * ⚠⚠ §I LÀ BÀI CANH CHÍNH CỦA TỆP NÀY, và nó tồn tại vì một lỗi thật: bản D275 tôi dựng
 * màn theo VĂN BẢN kế hoạch trong khi demo đã chốt nằm sẵn. Không bài test nào lúc ấy đỏ,
 * vì test kiểm "màn có chạy không" chứ không kiểm "màn có ĐÚNG PHƯƠNG ÁN ĐÃ DUYỆT không".
 * ⇒ §I khoá đúng những chỗ hai bản khác nhau: một số tổng (không phải hai ô CHI/THU) ·
 *   có thẻ hũ · không có chuyển tháng · không có dải 30 ô (nó thuộc màn GƯƠNG).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import {
  RuotSo, dinhDangDong, gomTheoNgay, soThang,
} from '../src/screens/tai-chinh/So';
import { ThanhTienDo, nacCua } from '../src/components/pfm/ThanhTienDo';
import { KhoProvider } from '../src/pfm/dung_kho';
import { KhoTrongBoNho, type KhoPfm } from '../src/pfm/kho.js';
import { khoanRaBanGhi, locKhoanSo, taoKhoan, tongGopVaoHu, type Khoan } from '../src/pfm/so.js';
import { KET_QUA_HU, tienDo, tuTao, type Hu, type NhomHu } from '../src/pfm/hu.js';
import { CHU_BENTO as CB, CHU_KET_QUA_HU, CHU_MAN_HU, CHU_MAN_SO, CHU_PHAN_BO as CP } from '../src/lib/pfm_chu';
import { TU_KE_DON } from '../src/lib/khoanh_khac';
import { bayGio, thangNay } from '../src/pfm/thoi_gian.js';
import { taoKhoanPhanBo } from '../src/pfm/phan_bo.js';

/*
 * ⚠ Bàn tiền ở đáy màn có bắn telemetry, nên bài nào GHI thật đều phải chặn cửa ấy lại —
 * và §V dùng luôn bản giả để canh một lời hứa P2 🔒: `pfm_ghi` KHÔNG mang số tiền.
 */
vi.mock('../src/lib/telemetry.js', () => ({ ghiDo: vi.fn(), manCuaDuong: () => '/tai-chinh/so' }));
const { ghiDo } = await import('../src/lib/telemetry.js');

const LUC = '2026-09-05T10:00:00.000Z';

/** Đường dẫn hiện tại, để bài canh "chạm ô ⇒ đi đâu" đọc được mà không phải dựng cả bảng route. */
function ViTri(): React.ReactElement {
  const l = useLocation();
  return <span data-testid="vi-tri">{`${l.pathname}${l.search}`}</span>;
}

function ve(kho: KhoPfm) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/tai-chinh/so']}>
      <QueryClientProvider client={qc}>
        <KhoProvider kho={kho}><RuotSo /><ViTri /></KhoProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

/* ── ĐƯỜNG TỚI các lớp trượt (SPEC mục 5): chạm ô ⇒ lớp mở; mọi thứ cũ của SỔ nằm trong ba lớp này ── */
/** Ô đã vẽ xong số (hết "—"/đang tải): cả sổ THÁNG lẫn ô HÔM NAY. */
const choSoTai = (): Promise<void> => waitFor(() => {
  expect(screen.getByTestId('so-hom-nay').textContent, 'số vẫn đang tải').not.toBe('—');
  expect(screen.getByTestId('so-thang-chi')).toBeInTheDocument();
});
const oSo = (dau: string): Promise<HTMLElement> => waitFor(() => {
  const e = document.querySelector<HTMLElement>(`[data-o="${dau}"]`);
  expect(e, `ô ${dau}`).not.toBeNull();
  return e!;
});
/** Chạm ô ⇒ lớp trượt mở; trả hàm tìm TRONG lớp (cùng chữ có thể còn ở mặt ô — không lẫn). */
const moO = async (dau: string) => {
  fireEvent.click(await oSo(dau));
  return within(await screen.findByRole('dialog'));
};
const oSoDau = (dau: string): HTMLElement => document.querySelector<HTMLElement>(`[data-o="${dau}"]`)!;
const moDs = async () => { await choSoTai(); return moO('so-hom-nay'); };
const moToi = async () => { await choSoTai(); return moO('so-toi-nay'); };

async function khoCo(
  ds: Partial<Khoan & { ngayTrongThang: number }>[],
  hu: { id: string; ten: string; muc?: number; nhom?: NhomHu }[] = [],
): Promise<KhoTrongBoNho> {
  const kho = new KhoTrongBoNho();
  const th = thangNay();
  for (const [i, x] of ds.entries()) {
    const k = taoKhoan({
      soTien: x.soTien ?? 35_000,
      chieu: x.chieu ?? 'chi',
      ngay: `${th}-${String(x.ngayTrongThang ?? 3).padStart(2, '0')}`,
      ...(x.nhan != null ? { nhan: x.nhan } : {}),
      ...(x.ghiChu !== undefined ? { ghiChu: x.ghiChu } : {}),
      ...(x.huId != null ? { huId: x.huId } : {}),
    }, LUC, `k${i}`);
    await kho.ghi('khoan', khoanRaBanGhi(k));
  }
  for (const h of hu) {
    await kho.ghi('hu', {
      id: h.id, thang: th, suaLuc: LUC,
      d: tuTao({
        ten: h.ten, ...(h.muc !== undefined ? { muc: h.muc } : {}), ...(h.nhom !== undefined ? { nhom: h.nhom } : {}),
      }, LUC, h.id),
    });
  }
  return kho;
}

describe('§I — ⭐⭐⭐ BÁM ĐÚNG DEMO ĐÃ CHỐT (bản 6 — tầng không gian)', () => {
  it('⭐⭐⭐ BA ô số (hôm nay · tháng · tối nay) + ô HƯỚNG, KHÔNG phải hai ô CHI/THU rời', async () => {
    /*
     * Demo: số TO là CHI HÔM NAY (D453), tổng tháng là một dòng trong ô THÁNG. Hai ô CHI/THU ngang nhau nói "bảng cân đối"; một số lớn nói
     * "hôm nay bạn đã chi bấy nhiêu" — câu chuyện mặt SỔ kể.
     */
    const kho = await khoCo([
      { soTien: 35_000, chieu: 'chi' },
      { soTien: 5_000_000, chieu: 'thu', ngayTrongThang: 1 },
    ]);
    ve(kho);
    await choSoTai();
    for (const dau of ['so-hom-nay', 'so-thang', 'so-toi-nay', 'so-huong']) expect(await oSo(dau)).toBeInTheDocument();
    expect(screen.queryByText('CHI'), 'demo không có ô CHI rời').not.toBeInTheDocument();
    expect(screen.queryByText('THU'), 'demo không có ô THU rời').not.toBeInTheDocument();
    expect(screen.getByTestId('so-thang-chi').getAttribute('data-day-du')).toBe('35.000');
    expect(screen.getByTestId('so-thang-thu').getAttribute('data-day-du')).toBe('5.000.000');
  });

  it('⭐⭐ KHÔNG có nút chuyển tháng — demo không có', async () => {
    ve(await khoCo([]));
    await choSoTai();
    expect(screen.queryByLabelText('Tháng trước')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tháng sau')).not.toBeInTheDocument();
  });

  it('⭐⭐ KHÔNG có dải 30 ô CÓ NHÃN ở màn SỔ — chi tiết ngày nằm ở GƯƠNG; ô THÁNG chỉ có lịch nhỏ trang trí', async () => {
    ve(await khoCo([{ ngayTrongThang: 3 }]));
    await choSoTai();
    expect(screen.queryByLabelText(/Ngày có ghi trong tháng/)).not.toBeInTheDocument();
  });

  it('⭐⭐⭐ KHÔNG còn hàng thẻ hũ trên mặt SỔ — hũ sống ở tab HŨ; hũ ĐẦY hiện thành chip ở ô TỐI NAY', async () => {
    /* SPEC mục 5: hàng `HU_TREN_SO` bị bỏ khỏi SỔ (mặt không cuộn không còn chỗ). Không mất lối: hũ đầy ⇒ chip "✓ N hũ đầy". */
    const kho = await khoCo(
      [{ soTien: 500_000, huId: 'h1', ngayTrongThang: 2 }],
      [{ id: 'h1', ten: 'Laptop', muc: 2_000_000 }],
    );
    ve(kho);
    await choSoTai();
    await waitFor(() => expect(tienDo({ ...tuTao({ ten: 'Laptop', muc: 2_000_000 }, LUC, 'h1') }, 500_000)).toBe(0.25));
    expect(screen.queryByText('LAPTOP'), 'mặt SỔ không bày thẻ hũ').not.toBeInTheDocument();
    expect(screen.queryByLabelText('Laptop: 25%')).not.toBeInTheDocument();
    expect(screen.queryByTestId('so-hu-day'), 'hũ 25% chưa đầy ⇒ không chip').not.toBeInTheDocument();
  });

  it('nhiều hũ ⇒ mặt SỔ không bày tên hũ nào (không thể tràn)', async () => {
    const kho = await khoCo([], [
      { id: 'a', ten: 'Một' }, { id: 'b', ten: 'Hai' }, { id: 'c', ten: 'Ba' },
    ]);
    ve(kho);
    await choSoTai();
    for (const t of ['MỘT', 'HAI', 'BA']) expect(screen.queryByText(t)).not.toBeInTheDocument();
  });

  it('⭐⭐ CHỈ có ba lớp trượt cho mặt SỔ: DANH SÁCH (chạm ô HÔM NAY) · THÁNG · TỐI NAY — chạm ô nào mở đúng lớp ấy, nút ĐÓNG luôn có', async () => {
    ve(await khoCo([{ ghiChu: 'cơm trưa' }]));
    const ds = await moDs();
    expect(await ds.findByText('cơm trưa')).toBeInTheDocument();
    expect(ds.getByRole('button', { name: 'ĐÓNG' })).toBeInTheDocument();
    const th = await moO('so-thang');
    expect(await th.findByText(CB.soTongChi)).toBeInTheDocument();
    const toi = await moO('so-toi-nay');
    expect(await toi.findByText(CB.soToiViPre)).toBeInTheDocument();
  });

  it('⭐⭐ chạm ô HƯỚNG ⇒ sang GƯƠNG (/tai-chinh/guong); chạm TỐI NAY › MỞ HŨ ĐỂ CHIA ⇒ /tai-chinh/hu?chia=1', async () => {
    ve(await khoCo([{ soTien: 500_000, chieu: 'thu' }], [{ id: 'h1', ten: 'Laptop' }]));
    const toi = await moToi();
    fireEvent.click(await toi.findByText(CB.soMoHu));
    // Nút chính phụt hạt pixel rồi MỚI đổi màn (0,12 s — luật phản hồi) ⇒ chờ.
    await waitFor(() => expect(screen.getByTestId('vi-tri').textContent).toBe('/tai-chinh/hu?chia=1'));
  });

  it('⭐⭐ ô HƯỚNG ⇒ navigate tới GƯƠNG', async () => {
    ve(await khoCo([]));
    await choSoTai();
    fireEvent.click(await oSo('so-huong'));
    expect(screen.getByTestId('vi-tri').textContent).toBe('/tai-chinh/guong');
  });
});

describe('§II — hàm thuần', () => {
  it('tiền ĐỒNG có dấu phân nghìn, khác hẳn định dạng token', () => {
    expect(dinhDangDong(1_250_000)).toMatch(/1.250.000/);
  });

  it('số tháng lấy đúng, không kèm năm (dòng phụ của demo viết "tháng 9")', () => {
    expect(soThang('2026-09')).toBe(9);
    expect(soThang('2026-01')).toBe(1);
  });

  it('gom theo ngày, MỚI NHẤT trước', () => {
    const k = (ngay: string, id: string): Khoan =>
      taoKhoan({ soTien: 1, chieu: 'chi', ngay }, LUC, id);
    const nhom = gomTheoNgay([k('2026-09-01', 'a'), k('2026-09-09', 'b'), k('2026-09-01', 'c')]);
    expect(nhom.map((n) => n.ngay)).toEqual(['2026-09-09', '2026-09-01']);
    expect(nhom[1]!.khoan).toHaveLength(2);
  });

  it('⭐⭐ mốc ĐÃ ĐẠT phải mang lớp `.dat` (25% ⇒ mốc 25 đạt)', () => {
    /*
     * ⚠⚠ Bài này sinh ra từ một lỗi ĐỘ ƯU TIÊN mà ảnh chụp không cho thấy: `.dat` viết
     * một mình là (0,1,0), thua `.tt u` (0,1,1), nên mốc đã đạt vẫn giữ nền xám. Một vạch
     * 2px xám giữa nền tối trông y như một vạch vàng bị ám — chỉ `getComputedStyle` nói
     * ra. Demo đã ghi sẵn cảnh báo này ("rút gọn về lớp đơn là thua độ ưu tiên") và tôi
     * vẫn dính. Ở đây khoá bằng LỚP, còn màu thật thì đo trên trình duyệt.
     */
    const { container } = render(<ThanhTienDo pct={25} />);
    const u = container.querySelectorAll('u');
    expect(u).toHaveLength(3);
    expect(u[0]!.className, 'mốc 25 phải đạt ở đúng 25%').not.toBe('');
    expect(u[1]!.className, 'mốc 50 chưa đạt').toBe('');
  });

  it('⭐ nấc màu: xanh `--win` DÀNH RIÊNG cho 100%', () => {
    /*
     * Demo đảo thứ tự nấc so với D239 đúng vì chuyện này: để `--win` ở nấc 50–74% thì một
     * hũ 60% và một hũ 100% cùng xanh — hai trạng thái khác hẳn nhau mà chung một mã màu.
     */
    expect(nacCua(0).tok).toBe('--c-2b');
    expect(nacCua(30).tok).toBe('--c-3');
    expect(nacCua(60).tok).toBe('--v-2b');
    expect(nacCua(80).tok).toBe('--v-3');
    expect(nacCua(100).tok).toBe('--win');
    expect(nacCua(99).tok, '99% CHƯA phải xanh').not.toBe('--win');
  });
});

describe('§III — danh sách', () => {
  it('⭐⭐ dòng là NÚT BẤM ĐƯỢC, chạm thì nở SỬA/XOÁ ngay dưới', async () => {
    // Demo: `.dong` là `<button aria-expanded>`. Bản D275 dựng `<li>` tĩnh — chạm không
    // được, tức mất hẳn đường sửa/xoá mà demo coi là mặc định.
    const kho = await khoCo([{ nhan: 'an_uong', ghiChu: 'cơm trưa' }]);
    ve(kho);
    const lop = await moDs();
    const dong = (await lop.findByText('cơm trưa')).closest('button')!;
    expect(dong).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(dong);
    expect(dong).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/SỬA LẠI/)).toBeInTheDocument();
    expect(screen.getByText(/XOÁ/)).toBeInTheDocument();
  });

  it('⭐ chạm dòng khác ⇒ dòng cũ đóng lại (một dòng mở tại một lúc)', async () => {
    const kho = await khoCo([
      { ghiChu: 'một', ngayTrongThang: 2 }, { ghiChu: 'hai', ngayTrongThang: 3 },
    ]);
    ve(kho);
    /*
     * ⚠ TÌM THEO Ô GHI CHÚ rồi trèo lên nút, KHÔNG tìm theo TÊN TRỢ NĂNG của nút. Tên trợ
     * năng gộp cả ô nhãn lẫn số tiền, và bàn tiền ở đáy còn có những nút mang chữ "một"
     * trong `title` (vd "Bỏ một tờ 500k") — nên `getByRole(name:/một/)` mơ hồ theo cách
     * chỉ lộ ra khi có đủ thứ trên màn. Ô ghi chú là thứ người dùng thật sự đọc.
     */
    const lop = await moDs();
    const a = (await lop.findByText('một')).closest('button')!;
    const b = lop.getByText('hai').closest('button')!;
    fireEvent.click(a);
    fireEvent.click(b);
    expect(a).toHaveAttribute('aria-expanded', 'false');
    expect(b).toHaveAttribute('aria-expanded', 'true');
  });

  it('⭐⭐ D420 — dòng ghi nhanh (không nhãn) là khoản CHI/THU trơn: "Khoản chi" / "Khoản thu" — không "Chưa phân loại", không "Khác"', async () => {
    /* Phân loại không còn là một bước lúc ghi (D410): gọi dòng ấy là "chưa phân loại" là giục một việc không tồn tại. */
    const kho = await khoCo([{ soTien: 12_000 }, { soTien: 500_000, chieu: 'thu', ngayTrongThang: 2 }]);
    ve(kho);
    const lop = await moDs();
    expect(await lop.findByText(CP.tenChi)).toBeInTheDocument();
    expect(lop.getByText(CP.tenThu)).toBeInTheDocument();
    expect(screen.queryByText(CHU_MAN_SO.chuaPhanLoai)).not.toBeInTheDocument();
    expect(screen.queryByText('KHÁC')).not.toBeInTheDocument();
  });

  it('⭐⭐ D420/D421 — khoản PHÂN BỔ là dòng CHUYỂN: "Vào <hũ>" (+ "· tự chia") + `→`; KHÔNG vào "đã chi"', async () => {
    const kho = await khoCo([{ soTien: 100_000 }], [{ id: 'h1', ten: 'Laptop', muc: 1_000_000 }]);
    const ngay = `${thangNay()}-04`;
    await kho.ghi('khoan', khoanRaBanGhi(taoKhoanPhanBo({ ngay, soTien: 50_000, huId: 'h1', phanBo: 'tay' }, LUC, 'pb-tay')));
    await kho.ghi('khoan', khoanRaBanGhi(taoKhoanPhanBo({ ngay, soTien: 30_000, huId: 'h1', phanBo: 'tu_dong' }, LUC, 'pb-td')));
    ve(kho);
    const lop = await moDs();
    const tuChia = (await lop.findByText(`${CP.vaoHuPre}Laptop${CP.tuChia}`)).closest('button')!;
    expect(within(tuChia).getByText('HŨ')).toBeInTheDocument();
    expect(tuChia).toHaveTextContent(`${CP.chuyenPre}30.000`);
    const tay = lop.getByText(`${CP.vaoHuPre}Laptop`).closest('button')!;
    expect(tay).toHaveTextContent(`${CP.chuyenPre}50.000`);
    await waitFor(() => expect(tongChiHien(), '"đã chi" = 100.000 — chuyển vào hũ không phải tiêu').toBe('100.000'));
  });

  it('⭐⭐⭐ D421 — RÚT (hũ → ví) là dòng CHUYỂN "Rút <hũ>" + `←`: KHÔNG ô THU, KHÔNG dấu +, KHÔNG màu tiền vào', async () => {
    /* Founder: *"phân biệt thu/chi vào hũ như nào?"* — rút tiền của chính mình ra khỏi hũ không phải một đợt tiền về. */
    const kho = await khoCo([{ soTien: 100_000 }], [{ id: 'h1', ten: 'Xe may', muc: 1_000_000 }]);
    const ngay = `${thangNay()}-04`;
    await kho.ghi('khoan', khoanRaBanGhi(taoKhoanPhanBo({ ngay, soTien: 500_000, huId: 'h1', phanBo: 'tay' }, LUC, 'pb-nap')));
    await kho.ghi('khoan', khoanRaBanGhi(taoKhoanPhanBo(
      { ngay, soTien: 200_000, huId: 'h1', phanBo: 'tay', chieu: 'thu' }, LUC, 'pb-rut',
    )));
    ve(kho);
    const lop = await moDs();
    const rut = (await lop.findByText(`${CP.rutHuPre}Xe may`)).closest('button')!;
    expect(within(rut).getByText('HŨ')).toBeInTheDocument();
    expect(rut).toHaveTextContent(`${CP.rutPre}200.000`);
    expect(rut.textContent, 'không dấu + của tiền vào').not.toContain('+');
    expect(within(rut).queryByText('THU'), 'không ô THU').toBeNull();
    expect(lop.queryByText('THU'), 'không dòng nào là tiền vào').toBeNull();
    await waitFor(() => expect(tongChiHien()).toBe('100.000'));
  });

  it('⭐⭐ D421 — thẻ hũ ĐẦY trong lớp TỐI NAY (đầy ⇒ chốt) chỉ là hũ TÍCH LŨY; hũ tiêu dùng cũng "đủ mức" vẫn không chiếm chỗ', async () => {
    const kho = await khoCo([
      { soTien: 1_000_000, huId: 'h-xe', ngayTrongThang: 2 },
      { soTien: 3_000_000, huId: 'h-an', ngayTrongThang: 2 },
      { soTien: 800_000, huId: 'h-dl', ngayTrongThang: 2 },
    ], [
      { id: 'h-an', ten: 'Ăn uống', muc: 3_000_000, nhom: 'tieu_dung' },
      { id: 'h-dl', ten: 'Đi lại', muc: 800_000, nhom: 'tieu_dung' },
      { id: 'h-xe', ten: 'Xe may', muc: 1_000_000 },
    ]);
    ve(kho);
    const toi = await moToi();
    expect(await toi.findByText('XE MAY')).toBeInTheDocument();
    expect(toi.queryByText('ĂN UỐNG')).toBeNull();
    expect(toi.queryByText('ĐI LẠI')).toBeNull();
    expect(screen.getByTestId('so-hu-day'), 'chip đếm đúng MỘT hũ đầy').toHaveAttribute('title', '1');
  });

  it('⭐⭐⭐ D424 — khoản GÁN chi tiêu (màn HŨ) KHÔNG có dòng ở sổ, không vào "đã chi", không đổi ví', async () => {
    /* Gán là nhãn "chừng ấy tiền đã tiêu thuộc hũ này", không phải tiền — một dòng cho nó là đếm cú tiêu hai lần. */
    const kho = await khoCo(
      [{ soTien: 500_000, chieu: 'thu' }, { soTien: 45_000 }, { soTien: 15_000 }],
      [{ id: 'h-an', ten: 'Ăn uống', muc: 3_000_000, nhom: 'tieu_dung' }, { id: 'h-xe', ten: 'Xe may' }],
    );
    const ngay = `${thangNay()}-03`;
    await kho.ghi('khoan', khoanRaBanGhi(taoKhoanPhanBo({ ngay, soTien: 40_000, huId: 'h-an', phanBo: 'gan' }, LUC, 'gan-1')));
    ve(kho);
    await choSoTai();
    await waitFor(() => expect(tongChiHien(), 'tiêu là tiêu — 45.000 + 15.000, không cộng khoản gán').toBe('60.000'));
    const ds = await moO('so-hom-nay');
    expect(ds.queryByText('Ăn uống'), 'không dòng nào mang tên hũ tiêu dùng').toBeNull();
    expect(ds.queryByText(new RegExp(`${CP.chuyenPre.trim()} 40\\.000`))).toBeNull();
    // Ví 500.000 − 45.000 − 15.000 = 440.000 · chi chưa chia 60.000 − 40.000 = 20.000 — nay nằm ở lớp TỐI NAY.
    const toi = await moO('so-toi-nay');
    expect(await toi.findByText(CB.soToiViPre)).toBeInTheDocument();
    await waitFor(() => expect(toi.getByText(CB.soToiViPre).parentElement).toHaveTextContent('440.000'));
    expect(toi.getByText(CB.soToiChiPre).parentElement).toHaveTextContent('20.000');
  });

  it('⭐⭐ D410 — khoản đã vào hũ nói tên HŨ (ô `HŨ`), không còn "Chưa phân loại"', async () => {
    const kho = await khoCo([{ soTien: 40_000, huId: 'h1' }], [{ id: 'h1', ten: 'Laptop', muc: 1_000_000 }]);
    ve(kho);
    const lop = await moDs();
    const dong = (await lop.findByText('Laptop')).closest('button')!;
    // ⚠ Nhắm TRONG dòng: tab "HŨ" ở đầu màn cũng mang đúng chữ ấy.
    expect(within(dong).getByText('HŨ')).toBeInTheDocument();
    expect(screen.queryByText(CHU_MAN_SO.chuaPhanLoai)).not.toBeInTheDocument();
  });

  it('⭐⭐ D420 — lối CHỜ PHÂN BỔ nói TIỀN CÒN LẠI (Σ THU − Σ CHI, mọi tháng) và dẫn sang màn HŨ', async () => {
    const kho = await khoCo([
      { soTien: 20_000 }, { soTien: 25_000, ngayTrongThang: 4 },
      { soTien: 99_000, nhan: 'an_uong' }, { soTien: 500_000, chieu: 'thu' }, { soTien: 7_000, huId: 'h1' },
    ], [{ id: 'h1', ten: 'Laptop' }]);
    // Tiêu của THÁNG TRƯỚC vẫn đã rời ví — tiền còn lại không đặt lại theo tháng.
    const th = thangNay();
    const truoc = `${Number(th.slice(5, 7)) === 1 ? Number(th.slice(0, 4)) - 1 : th.slice(0, 4)}-${String(Number(th.slice(5, 7)) === 1 ? 12 : Number(th.slice(5, 7)) - 1).padStart(2, '0')}`;
    await kho.ghi('khoan', khoanRaBanGhi(taoKhoan({ soTien: 60_000, ngay: `${truoc}-28` }, LUC, 'k-cu')));
    ve(kho);
    const toi = await moToi();
    // 500.000 − 20.000 − 25.000 − 99.000 − 7.000 − 60.000 (tháng trước) = 289.000 — số TO của ô TỐI NAY là bản gọn của đúng số này.
    await waitFor(() => expect(toi.getByText(CB.soToiViPre).parentElement).toHaveTextContent('289.000'));
    expect(screen.getByTestId('so-toi-nay').textContent).toBe('289k');
    fireEvent.click(toi.getByText(CB.soMoHu));
    await waitFor(() => expect(screen.getByTestId('vi-tri').textContent, 'dẫn sang màn HŨ, đúng lớp CHIA TIỀN').toBe('/tai-chinh/hu?chia=1'));
  });

  it('⭐⭐ D424 — lối nói thêm TIỀN CHI CHƯA CHIA, chỉ khi có hũ TIÊU DÙNG đang chạy; chỉ có hũ tiêu dùng ⇒ chỉ phần chi', async () => {
    const kho = await khoCo(
      [{ soTien: 45_000 }, { soTien: 100_000 }],
      [{ id: 'h-an', ten: 'Ăn uống', nhom: 'tieu_dung' }],
    );
    ve(kho);
    // Ví 0 (chỉ có chi) ⇒ không phần ví; chi chưa chia 145.000 — số TO của ô TỐI NAY là chính nó.
    const toi = await moToi();
    await waitFor(() => expect(toi.getByText(CB.soToiChiPre).parentElement).toHaveTextContent('145.000'));
    expect(screen.getByTestId('so-toi-nay').textContent).toBe('145k');
  });

  it('⭐ ví 0 ⇒ KHÔNG lối (không vẽ "0 đ") · ví còn tiền mà CHƯA hũ nào chạy ⇒ cũng không (không có chỗ để chia)', async () => {
    const kho = await khoCo([{ soTien: 99_000, nhan: 'an_uong' }], [{ id: 'h1', ten: 'Laptop' }]);
    const r = ve(kho);
    await choSoTai();
    // Ví âm/0 ⇒ ô TỐI NAY nói "—" (không vẽ "0 đ"), và không có lối chia.
    expect(screen.getByTestId('so-toi-nay').textContent).toBe('—');
    r.unmount();
    ve(await khoCo([{ soTien: 500_000, chieu: 'thu' }]));
    await choSoTai();
    await waitFor(() => expect(screen.getByTestId('so-thang-thu').getAttribute('data-day-du')).toBe('500.000'));
    // Ví còn tiền mà CHƯA hũ nào chạy ⇒ cũng "—": không có chỗ để chia.
    expect(screen.getByTestId('so-toi-nay').textContent).toBe('—');
    expect(oSoDau('so-toi-nay')).toHaveTextContent(CB.soChuaCoHu);
  });

  it('khoản THU mang ô THU và dấu +', async () => {
    const kho = await khoCo([{ chieu: 'thu', soTien: 8_000_000 }]);
    ve(kho);
    const lop = await moDs();
    expect(await lop.findByText('THU')).toBeInTheDocument();
    expect(lop.getByText(/\+8.000.000/)).toBeInTheDocument();
  });
});

describe('§IV — kho không bền + A10', () => {
  it('⭐⭐⭐ kho tạm ⇒ NÓI RA rằng dữ liệu sẽ mất khi đóng app', async () => {
    ve(new KhoTrongBoNho());
    const canh = await screen.findByRole('alert');
    expect(canh.textContent).toMatch(/mất khi đóng app/i);
  });

  it('mọi chữ của màn KHÔNG chứa từ kê đơn', async () => {
    const kho = await khoCo([{ nhan: 'an_uong' }], [{ id: 'h1', ten: 'Laptop', muc: 100 }]);
    ve(kho);
    await choSoTai();
    // MẶT SỔ + cả ba lớp trượt (một lớp mở tại một lúc — chữ lớp chỉ có trong DOM khi nó đang mở).
    let chu = (document.body.textContent ?? '').toLowerCase();
    for (const dau of ['so-hom-nay', 'so-thang', 'so-toi-nay']) {
      await moO(dau);
      chu += (document.body.textContent ?? '').toLowerCase();
    }
    for (const tu of TU_KE_DON) {
      expect(chu, `màn chứa "${tu}"`).not.toContain(tu);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * §V — ⭐⭐⭐ SỬA / XOÁ MỘT DÒNG ĐÃ GHI (mảnh nợ ⓒ của D284)
 *
 * ⚠⚠ Lỗi số 8 của §8 (`03-pfm-ban-tien.md`): *"Mất đường sửa sau 4 giây — sửa/xoá là MẶC
 * ĐỊNH, hoàn tác chỉ là lối tắt."* Sổ là dữ liệu của user, nên hai nút này phải chạy thật
 * ở mọi lúc, không chỉ trong cửa sổ ân huệ 4 giây sau khi ghi.
 * ═════════════════════════════════════════════════════════════════════════ */

/** Đọc sổ trong kho — NGUỒN SỰ THẬT, không đọc DOM. */
async function docSo(kho: KhoTrongBoNho): Promise<Khoan[]> {
  return locKhoanSo((await kho.liet<Khoan>('khoan')).map((b) => b.d));
}

/**
 * Tổng chi THÁNG đang hiện ở ô THÁNG (`data-day-du` = số đầy đủ có dấu phân nghìn; mặt ô hiện bản gọn 125k).
 * ⭐ D453 — số TO của ô đầu là HÔM NAY. Bài nào canh tổng tháng đọc đúng con số ấy, không đọc số to.
 */
function tongChiHien(): string {
  return screen.getByTestId('so-thang-chi').getAttribute('data-day-du') ?? '';
}

/** Mở lớp DANH SÁCH rồi chạm dòng (nở SỬA/XOÁ). */
const moDong = async (chu: string): Promise<void> => {
  const lop = await moDs();
  fireEvent.click((await lop.findByText(chu)).closest('button')!);
};

describe('§V — sửa một dòng', () => {
  it('⭐⭐⭐ SỬA ⇒ GHI ĐÈ cùng `id`: sổ vẫn ĐÚNG MỘT bản ghi, số mới đúng, tổng tháng đúng',
    async () => {
      /*
       * ⚠⚠ BÀI CANH CHÍNH CỦA MẢNH ⓒ. "Xoá rồi ghi mới" cũng cho ra một dòng trên màn
       * hình, nên mắt không phân biệt được — nhưng nó để lại MỘT BIA MỘ và MỘT bản ghi
       * thứ hai cho cùng một khoản có thật: két hoà giải theo `id` (K8) nên máy kia sẽ
       * thấy hai dòng, và `taoLuc` gốc mất luôn. Nên bài này soi thẳng vào kho.
       */
      const kho = await khoCo([{ soTien: 35_000, nhan: 'an_uong', ghiChu: 'cơm trưa' }]);
      ve(kho);
      await moDong('cơm trưa');
      fireEvent.click(screen.getByText(/SỬA LẠI/));

      // Dòng RỜI danh sách trong lúc sửa, và tổng tháng trừ nó ra — không thì một khoản
      // vừa nằm trong danh sách vừa nằm trong khay, tức đếm hai lần.
      await waitFor(() => expect(screen.queryByText('cơm trưa'), 'dòng đang sửa phải rời danh sách')
        .not.toBeInTheDocument());
      expect(tongChiHien()).toBe('0');
      // Số của chính người dùng được NHẤC VỀ, và bàn phím mở sẵn (không phải app tự đề
      // xuất một mức tiền — P3 🔒: họ vừa chỉ đúng dòng ấy).
      expect(screen.getByTestId('khay-tong').textContent).toMatch(/35\.000/);
      expect(screen.getByRole('button', { name: '000' })).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Xoá một chữ số'));   // 35000 → 3500
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });

      await waitFor(async () => expect((await docSo(kho))[0]?.soTien).toBe(3_500));
      const ds = await docSo(kho);
      expect(ds, 'KHÔNG được đẻ dòng thứ hai').toHaveLength(1);
      expect(ds[0]!.id, 'cùng `id` với bản ghi cũ').toBe('k0');
      expect(ds[0]!.ghiChu, 'ghi chú cũ không bị cú sửa nuốt mất').toBe('cơm trưa');
      expect(ds[0]!.nhan, 'D410: bỏ CÂU HỎI nhãn lúc ghi, không xoá CÂU TRẢ LỜI cũ').toBe('an_uong');
      expect(await kho.liet('khoan', { keCaDaXoa: true }), 'không có bia mộ nào')
        .toHaveLength(1);
      await waitFor(() => expect(tongChiHien()).toBe('3.500'));
    });

  it('⭐⭐ HUỶ giữa chừng (✕) ⇒ dòng trở lại NGUYÊN VẸN, không mất khoản nào', async () => {
    /*
     * ⚠⚠ Demo bỏ dòng khỏi danh sách NGAY lúc bấm SỬA LẠI, nên bấm ✕ sau đó là mất luôn
     * khoản ấy — một cú xoá không ai yêu cầu, và không có gì báo. Ở đây dòng chỉ ĐANG ẨN.
     */
    const kho = await khoCo([{ soTien: 35_000, ghiChu: 'cơm trưa' }]);
    ve(kho);
    await moDong('cơm trưa');
    fireEvent.click(screen.getByText(/SỬA LẠI/));
    await waitFor(() => expect(screen.queryByText('cơm trưa')).not.toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Bỏ hết tiền trong khay'));

    await waitFor(() => expect(tongChiHien()).toBe('35.000'));
    expect(await (await moDs()).findByText('cơm trưa')).toBeInTheDocument();
    expect(await docSo(kho)).toHaveLength(1);
  });

  it('⭐⭐ hoàn tác sau khi SỬA ⇒ số CŨ trở lại, vẫn một bản ghi', async () => {
    const kho = await khoCo([{ soTien: 35_000, nhan: 'an_uong', ghiChu: 'cơm trưa' }]);
    ve(kho);
    await moDong('cơm trưa');
    fireEvent.click(screen.getByText(/SỬA LẠI/));
    fireEvent.click(screen.getByLabelText('Xoá một chữ số'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(async () => expect((await docSo(kho))[0]?.soTien).toBe(3_500));

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'HOÀN TÁC' })); });
    await waitFor(async () => expect((await docSo(kho))[0]?.soTien).toBe(35_000));
    expect(await docSo(kho)).toHaveLength(1);
  });

  /*
   * ⚠⚠ BÀI NÀY TRƯỚC ĐÂY KHOÁ ĐÚNG CÁI LỖI VÀO. Bản cũ chỉ khẳng định `goi.length === 1`
   * và "không mang số tiền" — hai vế đều đúng trong khi sự kiện bắn ra thì SAI HẲN ở
   * trường `cach`, và không dòng nào nhìn tới `cach`. Một bài canh không hỏi tới trường
   * quan trọng nhất của sự kiện là một bài canh giữ chỗ cho lỗi.
   */
  it('⭐⭐⭐ cú SỬA KHÔNG bắn `pfm_ghi` — kể cả khi sửa bằng cách CHẠM THÊM TỜ', async () => {
    /*
     * ⚠⚠ MẪU SỐ, KHÔNG PHẢI TIẾT KIỆM SỰ KIỆN. `config/telemetry.ts` khai câu hỏi của
     * `pfm_ghi` là *"chọn tờ cho tiện có kéo người ta LÀM TRÒN số không?"* — mẫu số phải
     * là những cú NHẬP MỘT SỐ MỚI.
     * ⚠ Ca thật, và nó là ca này: bấm SỬA LẠI thì bàn tiền ĐIỀN SẴN `goSo` (nhấc số cũ về
     * khay), mà `cach` tính bằng `goSo ? 'go' : 'to'` ⇒ cú sửa nào cũng khai `'go'` **dù
     * người ấy không gõ một phím nào** — dưới đây họ chỉ chạm tờ 1k rồi chạm ĂN. Người
     * hay sửa bị đếm thành người hay gõ số, và kết luận "bàn phím không kéo người ta làm
     * tròn" lật ngược chỉ vì hành vi sửa. Hoàn tác cũng không rút lại được sự kiện.
     */
    const kho = await khoCo([{ soTien: 123_000, ghiChu: 'cơm trưa' }]);
    ve(kho);
    await moDong('cơm trưa');
    fireEvent.click(screen.getByText(/SỬA LẠI/));
    vi.mocked(ghiDo).mockClear();

    // Không chạm một phím số nào — chỉ chạm thêm một tờ rồi chạm đích.
    fireEvent.click(screen.getByRole('button', { name: '1k' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
    await waitFor(async () => expect((await docSo(kho))[0]?.soTien).toBe(124_000));

    const goi = vi.mocked(ghiDo).mock.calls.filter((c) => c[0] === 'pfm_ghi');
    expect(goi, `cú sửa không thuộc mẫu số của pfm_ghi — bắn ra: ${JSON.stringify(goi)}`)
      .toHaveLength(0);
  });

  it('⭐⭐ cú GHI MỚI vẫn bắn ĐÚNG MỘT `pfm_ghi{cach:"to"}`, và không mang số tiền (P2 🔒)',
    async () => {
      /*
       * ⚠ Vế thứ hai của cùng một luật, và nó phải đi cùng vế trên: "không bắn cho cú sửa"
       * mà cài quá tay thành "không bắn gì cả" thì `pfm_ghi` chết câm — xanh y hệt.
       */
      const kho = await khoCo([]);
      vi.mocked(ghiDo).mockClear();
      ve(kho);
      await choSoTai();

      fireEvent.click(screen.getByRole('button', { name: '100k' }));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: CP.nutChi })); });
      await waitFor(async () => expect(await docSo(kho)).toHaveLength(1));

      const goi = vi.mocked(ghiDo).mock.calls.filter((c) => c[0] === 'pfm_ghi');
      expect(goi).toHaveLength(1);
      expect(goi[0]![1], 'chạm tờ ⇒ `to`, không phải `go`')
        .toEqual({ chi_tiet: { cach: 'to' } });
      expect(JSON.stringify(goi), 'số tiền không rời máy').not.toMatch(/100000|100\.000/);
    });
});

describe('§V-bis — xoá một dòng', () => {
  it('⭐⭐⭐ XOÁ ⇒ đặt BIA MỘ (không xoá cứng), `locKhoanSo` thôi trả, tổng tháng giảm đúng',
    async () => {
      /*
       * ⚠⚠ Cú xoá phải LAN được sang máy khác qua két. Xoá cứng thì khoản ấy **sống lại**
       * ở lần khôi phục sau — `kho.ts` viết sẵn lý do bia mộ tồn tại.
       */
      const kho = await khoCo([
        { soTien: 35_000, ghiChu: 'cơm trưa' },
        { soTien: 15_000, ghiChu: 'gửi xe', ngayTrongThang: 4 },
      ]);
      ve(kho);
      const lop0 = await moDs();
      expect(await lop0.findByText('gửi xe')).toBeInTheDocument();
      expect(tongChiHien()).toBe('50.000');

      fireEvent.click((await lop0.findByText('cơm trưa')).closest('button')!);
      await act(async () => { fireEvent.click(screen.getByText(/XOÁ/)); });

      await waitFor(async () => expect(await docSo(kho)).toHaveLength(1));
      expect((await docSo(kho))[0]!.ghiChu, 'dòng kia không bị đụng').toBe('gửi xe');
      expect(await kho.liet('khoan', { keCaDaXoa: true }), 'bia mộ CÒN trong kho')
        .toHaveLength(2);
      await waitFor(() => expect(tongChiHien()).toBe('15.000'));
      await waitFor(() => expect(screen.queryByText('cơm trưa')).not.toBeInTheDocument());
    });

  it('⭐⭐⭐ hoàn tác sau khi XOÁ ⇒ dòng trở lại, bia mộ biến mất', async () => {
    const kho = await khoCo([{ soTien: 35_000, ghiChu: 'cơm trưa' }]);
    ve(kho);
    await moDong('cơm trưa');
    await act(async () => { fireEvent.click(screen.getByText(/XOÁ/)); });
    await waitFor(async () => expect(await docSo(kho)).toHaveLength(0));

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'HOÀN TÁC' })); });

    await waitFor(async () => expect(await docSo(kho)).toHaveLength(1));
    expect(await (await moDs()).findByText('cơm trưa')).toBeInTheDocument();
    expect(tongChiHien()).toBe('35.000');
    expect((await kho.liet<Khoan>('khoan', { keCaDaXoa: true }))[0]?.daXoa,
      'bia mộ phải được gỡ, không thì cú khôi phục sau lại chôn nó lần nữa').toBeUndefined();
  });

  it('⭐ XOÁ đi qua ĐÚNG đường ghi của bàn tiền ⇒ cùng một toast hoàn tác', async () => {
    /*
     * D284: *"một màn có hai đường ghi là hai đường phải giữ đồng bộ mãi mãi"*. Toast là
     * chỗ nhìn thấy được của lời hứa ấy: nút XOÁ ở DANH SÁCH mở đúng cái toast mà cú
     * chạm-đích ở ĐÁY mở.
     */
    const kho = await khoCo([{ soTien: 35_000, ghiChu: 'cơm trưa' }]);
    ve(kho);
    await moDong('cơm trưa');
    await act(async () => { fireEvent.click(screen.getByText(/XOÁ/)); });
    const toast = await screen.findByRole('status');
    expect(toast.textContent).toMatch(/đã xoá 35\.000 đ/);
    expect(within(toast).getByRole('button', { name: 'HOÀN TÁC' })).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * §VI — ⭐⭐⭐ HŨ ĐẦY → BA LỰA CHỌN → QUYẾT TOÁN C7 (mảnh nợ ⓐ; founder chốt 06/09, PA A)
 *
 * ⚠⚠ BÀI ĐẮT NHẤT CỦA CẢ TỆP LÀ "KHÔNG AI ĐẶT `ketQua` HỘ NGƯỜI DÙNG". Demo tự điền
 * `ketQua='du'` khi bấm CHỐT HŨ, lý lẽ là *"hũ đang ở đúng 100%, dữ liệu đã trả lời câu
 * đó rồi"*. Founder bác: app biết họ góp bao nhiêu **qua app**, không biết họ có gom thêm
 * ở chỗ khác không — tiền mặt, tài khoản khác, người nhà cho. Suy nấc từ phần trăm là app
 * **bịa một outcome** rồi bán nó như câu trả lời của người dùng, mà `kq_dat_muc_tieu` là
 * lớp OUTCOME: nó đi thẳng vào dataset và **không dựng lại được ở kỳ sau** (P7/D62).
 * ⇒ Bài "KHÔNG có đường nào đặt ketQua mà không qua một cú bấm" ở dưới là bài canh chính.
 * ═════════════════════════════════════════════════════════════════════════ */

async function docHu(kho: KhoTrongBoNho, id: string): Promise<Hu> {
  const b = (await kho.liet<Hu>('hu')).find((x) => x.id === id);
  if (b === undefined) throw new Error(`không thấy hũ ${id}`);
  return b.d;
}

/** Thẻ hũ ĐẦY trong lớp TỐI NAY — nút mang tên hũ VIẾT HOA (hũ chưa đầy không có thẻ ở SỔ). */
const theHuNut = (ten: string): HTMLElement | null =>
  within(document.querySelector('[role="dialog"]') ?? document.body).queryByText(ten.toUpperCase())?.closest('button') ?? null;

/**
 * ⚠⚠ CSS Modules BĂM TÊN LỚP: `s.huDay` ra `_huDay_32f462`. Nên `/\bhuDay\b/` **không bao
 * giờ khớp** — `_` là ký tự từ, `\b` không đứng giữa `_` và `h`. Một bài canh viết bằng
 * `\b` sẽ xanh ở cả hai phía: `toMatch` thì đỏ, mà `not.toMatch` thì xanh VĨNH VIỄN, tức
 * mọi khẳng định phủ định về lớp CSS thành rỗng. Đã dính đúng cú ấy khi viết tệp này.
 */
const coLop = (el: Element, ten: string): boolean =>
  el.className.split(/\s+/).some(
    (c) => c === ten || new RegExp(`(^|_)${ten}(_|$)`).test(c),
  );

/** Hũ ĐÃ ĐẦY sẵn: mức 100k, một khoản 100k đã nối vào. */
const khoHuDay = () => khoCo(
  [{ soTien: 100_000, huId: 'h1', ngayTrongThang: 2 }],
  [{ id: 'h1', ten: 'Laptop', muc: 100_000 }],
);

/** Mở lớp TỐI NAY, chờ thẻ hũ trở thành nút (dữ liệu về không đồng bộ) rồi trả nó ra. */
async function choTheHu(ten: string): Promise<HTMLElement> {
  await moToi();
  return waitFor(() => {
    const t = theHuNut(ten);
    expect(t, 'thẻ hũ ĐẦY phải là một nút bấm được').not.toBeNull();
    return t!;
  });
}

describe('§VI — hũ đầy: ba lựa chọn', () => {
  it('⭐⭐⭐ hũ 100% ⇒ chạm thẻ ⇒ hiện ĐÚNG ba lựa chọn', async () => {
    ve(await khoHuDay());
    const the = await choTheHu('Laptop');
    expect(screen.getByTestId('so-hu-day'), 'ô TỐI NAY mang chip hũ đầy').toBeInTheDocument();
    // Chưa chạm thì chưa có lựa chọn nào — không tự bung ra dưới tay người ta.
    expect(screen.queryByRole('button', { name: 'CHỐT HŨ' })).not.toBeInTheDocument();

    fireEvent.click(the);

    expect(screen.getByRole('button', { name: 'CHỐT HŨ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GIA HẠN' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'RESET' })).toBeInTheDocument();
  });

  it('⭐⭐ hũ CHƯA đầy ⇒ thẻ không bấm được, không có lựa chọn nào', async () => {
    const kho = await khoCo(
      [{ soTien: 50_000, huId: 'h1', ngayTrongThang: 2 }],
      [{ id: 'h1', ten: 'Laptop', muc: 100_000 }],
    );
    ve(kho);
    await moToi();
    expect(theHuNut('Laptop'), 'hũ chưa đầy KHÔNG có thẻ để chạm ở SỔ').toBeNull();
    expect(screen.queryByTestId('so-hu-day'), 'không chip').toBeNull();
    expect(screen.queryByRole('button', { name: 'CHỐT HŨ' })).not.toBeInTheDocument();
  });

  it('⭐⭐ hũ CHƯA ĐẶT MỨC không bao giờ "đầy" — `null` không phải 0, cũng không phải 100%',
    async () => {
      /*
       * ⚠ `tienDo` trả `null` cho hũ chưa đặt mức. Ngã về `?? 0` rồi so `>= 1` thì không
       * đầy — nhưng ngã về `?? 1`, hay so `>= muc` với `muc = 0`, thì MỌI hũ chưa đặt mức
       * đều đầy ngay lúc tạo, và app mời người ta quyết toán một mục tiêu chưa từng có.
       */
      const kho = await khoCo(
        [{ soTien: 900_000, huId: 'h1', ngayTrongThang: 2 }],
        [{ id: 'h1', ten: 'Laptop' }],
      );
      ve(kho);
      await moToi();
      expect(theHuNut('Laptop')).toBeNull();
      expect(screen.queryByTestId('so-hu-day'), 'chưa đặt mức ⇒ không bao giờ "đầy"').toBeNull();
    });
});

describe('§VI-bis — ⭐⭐⭐ quyết toán C7: người bấm là NGƯỜI DÙNG', () => {
  it('⭐⭐⭐ KHÔNG đường nào đặt `ketQua` mà không qua một cú bấm của người dùng', async () => {
    /*
     * ⚠⚠ BÀI CANH CHÍNH. Cả ba chặng đều phải để hũ NGUYÊN TRẠNG: mở màn · chạm thẻ ·
     * bấm CHỐT HŨ. Chỉ cú bấm vào MỘT NẤC mới được đổi `ketQua`, và đó là chặng cuối.
     */
    const kho = await khoHuDay();
    ve(kho);
    const the = await choTheHu('Laptop');
    expect((await docHu(kho, 'h1')).ketQua, 'mở màn: chưa ai hỏi ⇒ `null`').toBeNull();
    expect((await docHu(kho, 'h1')).trangThai).toBe('dang_chay');

    fireEvent.click(the);
    expect((await docHu(kho, 'h1')).ketQua, 'chạm thẻ: vẫn chưa ai hỏi').toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'CHỐT HŨ' }));
    expect((await docHu(kho, 'h1')).ketQua, 'mở hộp hỏi: VẪN chưa ai trả lời').toBeNull();
    expect((await docHu(kho, 'h1')).trangThai, 'và hũ chưa bị đóng hộ').toBe('dang_chay');
  });

  it('⭐⭐ hộp quyết toán sống trong lớp TỐI NAY — DANH SÁCH KHOẢN không ở đó (mặt quyết định phải-bằng-0), chọn xong thì danh sách vẫn đủ', async () => {
    /*
     * Hộp bốn nấc là mặt QUYẾT ĐỊNH — cùng hạng phải-bằng-0 với mọi mặt nhập liệu (§11 của `03-pfm-ban-tien.md`). Trước đây phải RỜI
     * KHỎI DOM danh sách khoản để màn khỏi tràn; ở tầng không gian danh sách nằm ở lớp RIÊNG (chạm ô HÔM NAY), nên đúng-từ-cấu-trúc:
     * lớp TỐI NAY không bao giờ có nó. Bài khoá cả hai vế: không có trong lớp quyết toán · không mất khi quyết toán xong.
     */
    const kho = await khoHuDay();
    ve(kho);
    fireEvent.click(await choTheHu('Laptop'));
    const coDanhSach = () => screen.queryByText(CHU_MAN_SO.viDuSuaXoa) !== null;
    expect(coDanhSach(), 'lớp TỐI NAY không mang danh sách khoản').toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'CHỐT HŨ' }));
    expect(coDanhSach(), 'đang hỏi: vẫn không').toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CHU_KET_QUA_HU.gan_du }));
    });
    await waitFor(async () => expect((await docHu(kho, 'h1')).trangThai).toBe('xong'));
    const ds = await moO('so-hom-nay');
    expect(await ds.findByText(CHU_MAN_SO.viDuSuaXoa), 'chọn xong: danh sách khoản vẫn đủ ở lớp riêng của nó').toBeInTheDocument();
  });

  it('⭐⭐⭐ CHỐT HŨ ⇒ hộp BỐN nấc, `GOM ĐỦ RỒI` mang lớp nút CHÍNH', async () => {
    ve(await khoHuDay());
    fireEvent.click(await choTheHu('Laptop'));
    fireEvent.click(screen.getByRole('button', { name: 'CHỐT HŨ' }));

    // Bốn nấc, đúng bốn nhãn của `CHU_KET_QUA_HU` — suy từ `KET_QUA_HU`, không chép tay.
    expect(KET_QUA_HU).toHaveLength(4);
    for (const ma of KET_QUA_HU) {
      expect(screen.getByRole('button', { name: CHU_KET_QUA_HU[ma] }), ma).toBeInTheDocument();
    }
    // Câu hỏi có tên hũ; `phuXong` nói "không có nấc nào là sai".
    expect(screen.getByText(`${CHU_MAN_HU.hoiXongPre}LAPTOP${CHU_MAN_HU.hoiHau}`))
      .toBeInTheDocument();
    expect(screen.getByText(CHU_MAN_HU.phuXong)).toBeInTheDocument();

    /*
     * ⚠ Founder chốt phương án A vì đúng chỗ này: `GOM ĐỦ RỒI` tô sẵn làm NÚT CHÍNH nên
     * vẫn "một chạm là xong" — không thêm ma sát như §12 lo — mà người bấm vẫn là người
     * dùng. Bỏ lớp `chinh` đi là lặng lẽ đổi phương án A thành một câu hỏi bốn nấc ngang
     * nhau, tức thêm đúng cái ma sát founder đã cân nhắc rồi loại.
     */
    const chinh = screen.getByRole('button', { name: CHU_KET_QUA_HU.du });
    expect(coLop(chinh, 'chinh'), '`GOM ĐỦ RỒI` phải là nút chính').toBe(true);
    for (const ma of ['gan_du', 'dang_tien', 'xa'] as const) {
      expect(coLop(screen.getByRole('button', { name: CHU_KET_QUA_HU[ma] }), 'chinh'), ma)
        .toBe(false);
    }
  });

  it('⭐⭐⭐ chọn một nấc ⇒ kho có `trangThai:"xong"` VÀ `ketQua` đúng mã', async () => {
    /*
     * ⚠ Chọn nấc KHÔNG PHẢI `du` một cách cố ý: một cài đặt lười ("đầy thì `du`") vẫn
     * xanh nếu bài test chỉ bấm đúng nút đầu tiên.
     */
    const kho = await khoHuDay();
    ve(kho);
    fireEvent.click(await choTheHu('Laptop'));
    fireEvent.click(screen.getByRole('button', { name: 'CHỐT HŨ' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CHU_KET_QUA_HU.gan_du }));
    });

    await waitFor(async () => expect((await docHu(kho, 'h1')).trangThai).toBe('xong'));
    const h = await docHu(kho, 'h1');
    expect(h.ketQua, 'nấc người dùng bấm, không phải nấc app suy ra').toBe('gan_du');
    expect(h.lichSu.map((d) => d.ma), 'cú chuyển tiếp phải để lại dấu').toContain('xong');
  });

  it('⭐⭐ hũ đã `xong` thôi bày lựa chọn — `xong` là điểm cuối', async () => {
    const kho = await khoHuDay();
    ve(kho);
    fireEvent.click(await choTheHu('Laptop'));
    fireEvent.click(screen.getByRole('button', { name: 'CHỐT HŨ' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CHU_KET_QUA_HU.du }));
    });
    await waitFor(async () => expect((await docHu(kho, 'h1')).trangThai).toBe('xong'));

    await waitFor(() => expect(theHuNut('Laptop')).toBeNull());
    expect(screen.queryByRole('button', { name: 'CHỐT HŨ' })).not.toBeInTheDocument();
  });
});

describe('§VI-ter — ⭐⭐ GIA HẠN & RESET', () => {
  it('⭐⭐⭐ GIA HẠN ⇒ `muc` về `null`, và app KHÔNG điền một con số nào', async () => {
    /*
     * ⚠⚠ App đề xuất một mức tiền là lúc nó thôi MÔ TẢ và bắt đầu KÊ ĐƠN (A10 🔒 · P3 🔒)
     * — kể cả một con số "hợp lý" như mức cũ nhân đôi hay đúng bằng số đã góp. Nên bài này
     * soi thẳng vào kho: `muc` phải là `null`, không phải 200000, không phải 100000, không
     * phải 0 (0 là "đặt mức bằng không", một phát biểu khác hẳn "chưa đặt mức").
     */
    const kho = await khoHuDay();
    ve(kho);
    fireEvent.click(await choTheHu('Laptop'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'GIA HẠN' })); });

    await waitFor(async () => expect((await docHu(kho, 'h1')).muc).toBeNull());
    const h = await docHu(kho, 'h1');
    expect(h.trangThai, 'gia hạn KHÔNG đóng hũ').toBe('dang_chay');
    expect(h.ketQua, 'gia hạn không phải một cú quyết toán').toBeNull();
    /*
     * ⚠ BỎ MỨC KHÔNG PHẢI HẠ MỨC (`hu.ts`): ghi `sua_muc_giam` ở đây làm
     * `hv_sua_muc_tieu` đọc ra một người hay hạ chuẩn, trong khi họ đang dọn hũ.
     */
    expect(h.lichSu.map((d) => d.ma)).not.toContain('sua_muc_giam');

    // Trên màn: thẻ về "chưa đặt mức" (dấu gạch), hết đầy, ba lựa chọn tự đóng.
    await waitFor(() => expect(theHuNut('Laptop')).toBeNull());
    expect(screen.queryByRole('button', { name: 'GIA HẠN' })).not.toBeInTheDocument();
  });

  it('⭐⭐⭐ RESET ⇒ về 0% bằng MỐC: `mocGop` được đặt, `muc` giữ nguyên, khoản cũ VẪN trong sổ và trên màn',
    async () => {
      /*
       * Founder chốt phương án A (D292 §Còn nợ): "đưa về 0" không cất một con số tổng
       * (`hu.ts` vẫn cấm `daGop`) và không cắt `huId` của khoản đã góp — nó dời MỐC. Bốn thứ
       * phải cùng đúng, và bài đọc KHO chứ không tin DOM:
       *   · `mocGop` có giá trị · `muc` nguyên vẹn (RESET ≠ GIA HẠN) · sổ vẫn đủ dòng, dòng
       *     cũ vẫn nối `huId` và vẫn HIỆN trong danh sách · thẻ hết đầy nên thôi là nút.
       */
      const kho = await khoCo(
        [{ soTien: 100_000, huId: 'h1', ngayTrongThang: 2, ghiChu: 'góp laptop' }],
        [{ id: 'h1', ten: 'Laptop', muc: 100_000 }],
      );
      ve(kho);
      fireEvent.click(await choTheHu('Laptop'));
      expect(screen.getByText(CHU_MAN_SO.huChonGiai).textContent, 'câu giải về đúng demo')
        .toMatch(/RESET: đưa về 0, giữ nguyên mức/);
      const nut = screen.getByRole('button', { name: 'RESET' });
      expect(nut, 'nút đã mở — không còn là nút chết').toBeEnabled();
      await act(async () => { fireEvent.click(nut); });

      await waitFor(async () => expect((await docHu(kho, 'h1')).mocGop).not.toBeNull());
      const h = await docHu(kho, 'h1');
      expect(h.muc, 'RESET giữ mức').toBe(100_000);
      expect(h.trangThai).toBe('dang_chay');
      expect(h.ketQua, 'RESET không phải quyết toán').toBeNull();
      expect(h, 'vẫn không có con số tổng nào cất trên hũ').not.toHaveProperty('daGop');

      // Khoản cũ: vẫn trong kho, vẫn nối hũ, vẫn hiện trên màn — chỉ thôi được đếm.
      const so = await docSo(kho);
      expect(so).toHaveLength(1);
      expect(so[0]!.huId, 'RESET không cắt `huId`').toBe('h1');
      expect(await (await moO('so-hom-nay')).findByText('góp laptop'), 'dòng cũ còn trong danh sách').toBeInTheDocument();
      expect(tongChiHien(), 'tổng chi tháng không đổi — RESET không đụng sổ').toBe('100.000');

      // Thẻ: 0%, hết đầy (không còn là nút — `huDay` tắt), ba lựa chọn tự đóng.
      // ⚠ Không soi nhãn "✓ HŨ ĐÃ ĐẦY" ở đây: `TheHu` luôn vẽ span ấy và GIẤU bằng CSS
      //   (`.nhanDay{display:none}` trừ `.huDay`), mà jsdom không tính style — "thẻ thôi là
      //   nút" mới là tín hiệu DOM thật của `huDay` tắt.
      // ⚠ Hũ 0% không còn thẻ ở SỔ (hũ sống ở tab HŨ) nên "0%" kiểm bằng hàm thuần: đúng phép tính mà tab HŨ vẽ.
      expect(tongGopVaoHu(so, 'h1', h.mocGop), 'sau mốc chưa góp gì').toBe(0);
      expect(tienDo(h, tongGopVaoHu(so, 'h1', h.mocGop))).toBe(0);
      expect(theHuNut('Laptop'), 'hết đầy ⇒ thẻ không còn là nút').toBeNull();
      expect(screen.queryByRole('button', { name: 'RESET' })).not.toBeInTheDocument();
    });

  it('⭐⭐ góp tiếp SAU reset ⇒ chỉ khoản mới được đếm (50k / 100k = 50%)', async () => {
    /*
     * Vế thứ hai của cùng một luật: mốc không "khoá" hũ — nó chỉ đổi điểm bắt đầu đếm.
     * ⚠ D420: góp không còn ở bàn tiền — tối về chia tiền còn lại ở khay màn HŨ, mỗi cú là một KHOẢN PHÂN BỔ mới tạo
     *   lúc nạp (nên `taoLuc` của nó đứng sau mốc). Bài này đi đúng đường ấy, rồi MỞ LẠI màn SỔ như người dùng quay về.
     */
    const kho = await khoHuDay();
    const r = ve(kho);
    fireEvent.click(await choTheHu('Laptop'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'RESET' })); });
    await waitFor(() => expect(theHuNut('Laptop')).toBeNull());
    // Đồng hồ thật ở cả hai đầu: chắc chắn lúc nạp đứng SAU mốc (`>` chặt).
    await act(async () => { await new Promise((res) => { setTimeout(res, 5); }); });

    const moi = taoKhoanPhanBo({ soTien: 50_000, ngay: `${thangNay()}-04`, huId: 'h1', phanBo: 'tay' }, bayGio(), 'moi');
    await kho.ghi('khoan', khoanRaBanGhi(moi));
    r.unmount();
    ve(kho);
    await choSoTai();

    // "50%" kiểm bằng hàm thuần (hũ không còn thẻ % ở SỔ — tab HŨ vẽ đúng phép tính này).
    const h = await docHu(kho, 'h1');
    expect(tongGopVaoHu(await docSo(kho), 'h1', h.mocGop), 'chỉ khoản SAU mốc được đếm').toBe(50_000);
    expect(tienDo(h, 50_000)).toBe(0.5);
    expect(await docSo(kho), 'sổ giờ có hai khoản, cả hai đều nối hũ').toHaveLength(2);
    expect((await docSo(kho)).every((x) => x.huId === 'h1')).toBe(true);
  });
});

describe('§VI-quater — ⭐⭐ cú NẢY chỉ ở khoảnh khắc VỪA đầy', () => {
  it('⭐⭐ mở màn với hũ ĐÃ đầy sẵn ⇒ KHÔNG nảy', async () => {
    /*
     * ⚠ Một cú ăn mừng phát lại mỗi lần quay về màn SỔ là một cú ăn mừng không còn nghĩa
     * gì — và nó nảy đúng lúc người ta đang đọc danh sách.
     */
    ve(await khoHuDay());
    const the = await choTheHu('Laptop');
    expect(coLop(the, 'huDay'), 'phải đang ở trạng thái đầy').toBe(true);
    expect(coLop(the, 'nay'), 'đầy sẵn từ trước ⇒ KHÔNG nảy').toBe(false);
  });

  it('⭐⭐⭐ góp nốt cho đủ ⇒ nảy MỘT lần, và lượt vẽ sau không nảy lại', async () => {
    const kho = await khoCo(
      [{ soTien: 50_000, huId: 'h1', ngayTrongThang: 2, ghiChu: 'góp laptop' }],
      [{ id: 'h1', ten: 'Laptop', muc: 100_000 }],
    );
    ve(kho);
    await moToi();
    expect(theHuNut('Laptop'), 'chưa đầy thì chưa là nút').toBeNull();

    /*
     * ⚠ D410: bàn tiền không còn đích hũ — đường làm hũ ĐẦY ngay trên màn SỔ giờ là SỬA một khoản đã nối hũ (sửa giữ
     * nguyên hũ): 50k ⇒ 100k.
     */
    await moDong('góp laptop');
    fireEvent.click(screen.getByText(/SỬA LẠI/));
    for (let i = 0; i < 5; i += 1) fireEvent.click(screen.getByLabelText('Xoá một chữ số'));
    for (const d of ['1', '0', '0', '000']) fireEvent.click(screen.getByRole('button', { name: d }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: CP.nutChi }));
    });
    await waitFor(async () => expect((await docSo(kho))[0]?.soTien).toBe(100_000));

    const the = await choTheHu('Laptop');
    expect(coLop(the, 'nay'), 'vừa đầy ⇒ nảy').toBe(true);

    /*
     * ⚠ Lượt vẽ SAU không được nảy LẠI. Ở React, "không nảy lại" nghĩa là lớp `nay` giữ
     * NGUYÊN (gỡ rồi gắn lại mới là cái làm animation chạy lại), nên bài này ép thêm một
     * lượt vẽ bằng cú chạm thẻ rồi soi lại.
     */
    fireEvent.click(theHuNut('Laptop')!);
    expect(coLop(theHuNut('Laptop')!, 'nay')).toBe(true);
  });
});
