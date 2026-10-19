/**
 * PFM — BẢY NÚT LỘ TRÌNH CÓ ĐÍCH THẬT, và cửa SỬA LẠI PHỎNG VẤN (D308).
 *
 * ⚠⚠ VÌ SAO BÀI NÀY TỒN TẠI — nó canh đúng thứ mà 1.591 bài xanh của D306 KHÔNG
 * canh: *người chơi bấm vào thì có đi tới đâu không*. Lộ trình vẽ đủ bảy nút, chỉ
 * `ĐẶT CAM KẾT` đi được, sáu cái còn lại bấm vào **không có gì xảy ra** — không
 * lỗi, không log, không bài đỏ. Cùng họ với ngõ cụt 07/09 (A11.21: mốc là ĐIỀU
 * NGƯỜI CHƠI LÀM ĐƯỢC, không phải "màn dựng được").
 *
 * ⚠ Bài đọc ĐƯỜNG ĐI thật (`useLocation`), không đọc `navigate` bị mock: mock
 * một hàm điều hướng rồi khẳng định "đã gọi" là kiểm chính bản mock.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KhoTrongBoNho, type KhoPfm } from '../src/pfm/kho.js';
import { docHoSo, ghiHoSo, type HoSo } from '../src/pfm/ho_so.js';
import { KHOA_PFM, KhoProvider, quenLuotMo } from '../src/pfm/dung_kho';
import { CAU_PV, cauDangHien } from '../src/pfm/phong_van.js';
import { tuTao } from '../src/pfm/hu.js';
import { RuotLoTrinh } from '../src/screens/tai-chinh/LoTrinh';
import { RuotCamKet } from '../src/screens/tai-chinh/CamKet';
import { RuotPhongVan } from '../src/screens/tai-chinh/PhongVan';
import { BoardCaiDatPfm } from '../src/components/pfm/BoardCaiDatPfm';
import { CHU_CAI_DAT, CHU_LOI_GHI } from '../src/lib/pfm_chu';
import { NGUONG_TINH_CACH } from '@server/holdem/insight';
import { TELEMETRY } from '@config/telemetry';
import { ME_ONBOARDED, stubFetch } from './helpers';

/*
 * ⚠⚠ XOÁ CỜ `pfm_da_phong_van` SAU MỖI BÀI — bài "để sau ⇒ xoá câu" bấm XONG,
 * mà XONG gọi `danhDauDaPhongVan()` ghi localStorage. Cờ ấy sống qua ranh giới
 * tệp trong một lượt chạy đầy đủ, và `phong_van.test.tsx` §IV lại dựa đúng vào
 * "chưa từng phỏng vấn" ⇒ bài ấy ĐỎ khi chạy cả bộ, XANH khi chạy một mình.
 * Đã đỏ hai lượt trước khi tìm ra: một bài test làm bẩn bài khác thì cái đỏ
 * không nói gì về code cả.
 */
/*
 * D360 — CỬA GIẢ CHO LƯỢT MỞ KHO, chỉ §VI dùng. Mọi bài khác BƠM kho thẳng vào `<KhoProvider kho=…>` nên không bao
 * giờ chạm `moKho`; §VI cần đúng cái cửa sổ mà cách bơm ấy bỏ qua: provider TỰ mở kho, và trong lúc chưa mở xong thì
 * `useHoSo()` trả `{ data: {}, dangTai: false }` — hồ sơ RỖNG mà cờ "đang tải" lại TẮT. `null` ⇒ đi đường thật.
 */
const gia = vi.hoisted(() => ({ moKho: null as null | (() => Promise<unknown>) }));
vi.mock('../src/pfm/kho_idb.js', async (nhapGoc) => {
  const goc = await nhapGoc<typeof import('../src/pfm/kho_idb.js')>();
  return { ...goc, moKho: (chu: string) => (gia.moKho ? (gia.moKho() as ReturnType<typeof goc.moKho>) : goc.moKho(chu)) };
});

afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); localStorage.clear();
  gia.moKho = null; quenLuotMo();   // lượt mở đang nhớ là biến cấp MODULE — không quên thì bài sau nhận kho của bài trước
});

const LUC = '2026-09-08T09:00:00.000Z';

/**
 * Tín hiệu game hợp lệ cho `gameDienSan` — cùng khuôn với `phong_van.test.tsx` (A11.5:
 * fixture cố định của một hợp đồng DTO, không phải công thức nghiệp vụ, nên chép tay ở
 * đây không phải bản sao thứ hai đáng lo — chỉ §V dùng, để dựng cửa `noi_game` cho bài
 * "đáp án game không đè lên lựa chọn thật".
 */
const tinHieu = (sauThua: number | null) => ({
  formula_version: 2, hieu_chuan: 'chua' as const, n_tran: 3, n_vong: 30, bac_doc: 'chua' as const,
  tiet_kiem: null,
  chi_so: {
    hieu_chinh: null, duoi_gia: null, theo_tin: null, chot_non: null, mua_tin: null, khau_vi: null,
    don_von: sauThua === null ? null : { nen_bp: 1000, sau_thang_x: 1, sau_thua_x: sauThua, n: 8 },
  },
});

/** Hiện đường hiện tại ra DOM — nguồn sự thật của mọi khẳng định "đi tới đâu". */
function Vet(): React.ReactElement {
  const l = useLocation();
  return <i data-testid="duong">{`${l.pathname}${l.search}`}</i>;
}

function ve(ruot: React.ReactElement, kho: KhoTrongBoNho, dau = '/tai-chinh/lo-trinh') {
  stubFetch([]);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[dau]}>
        <Vet />
        <KhoProvider kho={kho}>{ruot}</KhoProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function khoVoi(h: HoSo): Promise<KhoTrongBoNho> {
  const kho = new KhoTrongBoNho();
  await ghiHoSo(kho, h, LUC);
  return kho;
}

const duong = (): string => screen.getByTestId('duong').textContent ?? '';

/**
 * Mở phần thân của một chặng (chặng 1 mở sẵn; chặng 2/3 phải chạm tiêu đề).
 *
 * ⚠ CHỜ tiêu đề chặng (D360): màn không vẽ gì trước khi hồ sơ về. Bản cũ `getByText` ĐỒNG BỘ ngay sau `render` — nó
 * chạy được vì màn từng vẽ lộ trình của hồ sơ RỖNG ở nhịp đầu, tức bài đang bấm vào đúng cái màn-loé mà D360 gỡ.
 */
async function moChang(ten: string): Promise<void> {
  fireEvent.click(await screen.findByText(ten));
}

describe('I. ⭐ Sáu nút câm của D306 giờ đi tới màn thật', () => {
  it('ĐẶT MỨC / ĐỔI MẪU về màn HŨ — nơi ranh A10 đã cài sẵn, không dựng ô tiền thứ hai', async () => {
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng'] });
    ve(<RuotLoTrinh />, kho);
    fireEvent.click(await screen.findByText('ĐẶT MỨC'));
    expect(duong()).toBe('/tai-chinh/hu');
  });

  it('CHỌN MẪU (câu 4 còn trống) cũng về màn HŨ', async () => {
    const kho = await khoVoi({});
    ve(<RuotLoTrinh />, kho);
    /*
     * ⚠ KHOANH ĐÚNG KHỐI "câu 4 trống" (D360). Hồ sơ rỗng + sổ không hũ ⇒ màn có HAI nút CHỌN MẪU (khối trạng thái
     * `#DP_THIEU` cũng mang một cái). Bản cũ `findByText('CHỌN MẪU')` chỉ qua được vì nó bắt trúng nhịp hũ CHƯA tải
     * xong — lúc ấy mới có một nút. Một bài xanh nhờ bắt kịp một khung hình trung gian thì không canh gì.
     */
    const khoi = (await screen.findByText('Chưa có hũ nào')).closest('[data-ma]') as HTMLElement;
    fireEvent.click(within(khoi).getByText('CHỌN MẪU'));
    expect(duong()).toBe('/tai-chinh/hu');
  });

  it('XEM THỬ về màn GƯƠNG', async () => {
    const kho = await khoVoi({ khung: 'hu' });
    ve(<RuotLoTrinh />, kho);
    await moChang('SOI GƯƠNG');
    fireEvent.click(await screen.findByText('XEM THỬ'));
    expect(duong()).toBe('/tai-chinh/guong');
  });

  it('ĐỔI KHUNG về màn PHỎNG VẤN — khung LÀ câu 5, không phải một màn chọn khung thứ hai', async () => {
    const kho = await khoVoi({ khung: 'hu' });
    ve(<RuotLoTrinh />, kho);
    await moChang('SOI GƯƠNG');
    fireEvent.click(await screen.findByText('ĐỔI KHUNG'));
    expect(duong()).toBe('/tai-chinh/phong-van');
  });

  it('XEM (khối RÀO) mở CAM KẾT với đúng luật "khoản vượt mức"', async () => {
    const kho = await khoVoi({});
    ve(<RuotLoTrinh />, kho);
    await moChang('TỰ ĐẶT LUẬT');
    fireEvent.click(await screen.findByText('XEM'));
    expect(duong()).toBe('/tai-chinh/cam-ket?dk=khoan_vuot_muc');
  });

  it('TẮT NHẮC mở ĐÚNG board ⚙ — công tắc `nhacTat` chỉ có một bản', async () => {
    const kho = await khoVoi({});
    ve(<RuotLoTrinh />, kho);
    expect(screen.queryByTestId('ct-nhac'), 'board không được mở sẵn').toBeNull();
    fireEvent.click(await screen.findByText('TẮT NHẮC'));
    expect(await screen.findByTestId('ct-nhac')).toBeInTheDocument();
    // Không rời màn: board là lớp phủ, không phải một route khác.
    expect(duong()).toBe('/tai-chinh/lo-trinh');
  });
});

describe('II. ⭐ BỎ — che khối, KHÔNG sửa câu trả lời sau lưng', () => {
  it('bấm BỎ thì khối biến mất và ghi vào hồ sơ, mà câu 4 còn nguyên', async () => {
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng', 'chuyến đi'] });
    ve(<RuotLoTrinh />, kho);
    expect(await screen.findByText('Hũ dự phòng')).toBeInTheDocument();
    expect(screen.getByText('Hũ chuyến đi')).toBeInTheDocument();

    // Nút BỎ đầu tiên thuộc khối đầu tiên (Hũ dự phòng).
    fireEvent.click(screen.getAllByText('BỎ')[0]!);

    await waitFor(() => expect(screen.queryByText('Hũ dự phòng')).toBeNull());
    expect(screen.getByText('Hũ chuyến đi'), 'bỏ nhầm cả khối kia').toBeInTheDocument();

    const h = await docHoSo(kho);
    expect(h.loTrinhBo).toEqual(['quỹ dự phòng']);
    expect(h.mucTieu, '⭐ BỎ không được sửa lời khai câu 4')
      .toEqual(['quỹ dự phòng', 'chuyến đi']);
  });
});

describe('III. CAM KẾT nhận `?dk=` từ khối RÀO', () => {
  it('điều kiện trong URL được chọn sẵn, và ô MỨC hiện ra', async () => {
    const kho = await khoVoi({});
    ve(<RuotCamKet />, kho, '/tai-chinh/cam-ket?dk=khoan_vuot_muc');
    const chip = await screen.findByRole('radio', { name: /vượt mức/i });
    expect(chip).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Mức tiền do bạn đặt')).toBeInTheDocument();
  });

  it('⭐ URL THẮNG gợi ý câu 6 — bấm khối RÀO phải ra đúng luật của khối RÀO', async () => {
    // Câu 6 gợi `tien_vua_ve`; nếu gợi ý thắng thì nút RÀO mở nhầm luật.
    const kho = await khoVoi({ nhip: ['ngay sau khi tiền về'] });
    ve(<RuotCamKet />, kho, '/tai-chinh/cam-ket?dk=khoan_vuot_muc');
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /vượt mức/i }))
        .toHaveAttribute('aria-checked', 'true');
    });
  });

  it('mã lạ trong URL bị bỏ qua, không ném — query là thứ ai cũng gõ được', async () => {
    const kho = await khoVoi({});
    ve(<RuotCamKet />, kho, '/tai-chinh/cam-ket?dk=khong-co-that');
    expect(await screen.findByText('MỘT LUẬT BẠN TỰ ĐẶT')).toBeInTheDocument();
  });
});

describe('IV. ⭐ Lời hứa "đổi lúc nào cũng được ở ⚙" phải có cửa thật', () => {
  it('board ⚙ có hàng SỬA SÁU CÂU và nó đi tới màn phỏng vấn', async () => {
    const kho = new KhoTrongBoNho();
    ve(<BoardCaiDatPfm onDong={() => {}} />, kho, '/tai-chinh/so');
    fireEvent.click(await screen.findByTestId('nut-sua-pv'));
    expect(duong()).toBe('/tai-chinh/phong-van');
  });

  it('hàng ấy nói rõ câu trả lời ở lại máy', async () => {
    const kho = new KhoTrongBoNho();
    ve(<BoardCaiDatPfm onDong={() => {}} />, kho, '/tai-chinh/so');
    expect(await screen.findByText(CHU_CAI_DAT.suaPv)).toBeInTheDocument();
    expect(screen.getByText(/nằm trên máy bạn/)).toBeInTheDocument();
  });
});

describe('IV-bis. ⭐ (D325) Lộ trình VÀO LẠI được, và câu hỏi khung chỉ ghi khung', () => {
  it('⭐ board ⚙ có hàng XEM LẠI LỘ TRÌNH và nó đi tới màn lộ trình', async () => {
    const kho = new KhoTrongBoNho();
    ve(<BoardCaiDatPfm onDong={() => {}} />, kho, '/tai-chinh/so');
    expect(await screen.findByText(CHU_CAI_DAT.moLt)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('nut-mo-lt'));
    expect(duong()).toBe('/tai-chinh/lo-trinh');
  });

  it('⭐ THỬ KHUNG NÀY ghi ĐÚNG hoSo.khung (không đụng câu nào khác), và câu hỏi biến mất', async () => {
    const kho = await khoVoi({ deu: 'thất thường', mucTieu: ['chuyến đi'] });
    ve(<RuotLoTrinh />, kho);
    fireEvent.click(await screen.findByText('THỬ KHUNG NÀY'));
    await waitFor(async () => expect((await docHoSo(kho)).khung).toBe('hu'));
    const h = await docHoSo(kho);
    expect(h.deu).toBe('thất thường');
    expect(h.mucTieu).toEqual(['chuyến đi']);
    expect(h.loTrinhBo).toBeUndefined();
    await waitFor(() => expect(screen.queryByText('THỬ KHUNG NÀY')).toBeNull());
    expect(duong()).toBe('/tai-chinh/lo-trinh');
  });

  it('ĐỂ SAU ẩn câu hỏi bằng khoá #GOI_Y_KHUNG — khung vẫn trống', async () => {
    const kho = await khoVoi({ deu: 'đều mỗi tháng' });
    ve(<RuotLoTrinh />, kho);
    fireEvent.click(await screen.findByText('ĐỂ SAU'));
    await waitFor(async () => expect((await docHoSo(kho)).loTrinhBo).toContain('#GOI_Y_KHUNG'));
    expect((await docHoSo(kho)).khung).toBeUndefined();
  });

  it('⭐ khối HŨ DỰ PHÒNG đọc từ sổ: không hũ nào ⇒ hiện; mở một hũ dự phòng ⇒ biến mất', async () => {
    const kho = await khoVoi({ mucTieu: ['chuyến đi'] });
    const { unmount } = ve(<RuotLoTrinh />, kho);
    // 13/09 — dòng VÌ SAO nằm sau nút (?) của khối: mặc định KHÔNG hiện, chạm (?) mới đọc được.
    const nutDP = await screen.findByRole('button', { name: 'Về khối Hũ dự phòng' });
    expect(screen.queryByText(/sổ của bạn đang không có hũ dự phòng nào mở/)).toBeNull();
    fireEvent.click(nutDP);
    expect(screen.getByText(/sổ của bạn đang không có hũ dự phòng nào mở/)).toBeInTheDocument();
    unmount();
    await kho.ghi('hu', { id: 'dp', thang: '2026-09', suaLuc: LUC, d: tuTao({ ten: 'Dự phòng', loai: 'du_phong' }, LUC, 'dp') });
    ve(<RuotLoTrinh />, kho);
    expect(await screen.findByText('Ghi hằng ngày · 2 chạm')).toBeInTheDocument();
    // Khối còn thì mở (?) của nó ra rồi mới khẳng định — không để chữ "ẩn sau nút" làm bài xanh hộ.
    const nutSau = screen.queryByRole('button', { name: 'Về khối Hũ dự phòng' });
    if (nutSau) fireEvent.click(nutSau);
    expect(screen.queryByText(/sổ của bạn đang không có hũ dự phòng nào mở/)).toBeNull();
  });
});

describe('V. ⭐ Mở lại phỏng vấn thấy ĐÚNG chip đã chạm', () => {
  it('câu đã trả lời hiện lại; đáp án game KHÔNG đè lên lựa chọn thật', async () => {
    /*
     * ⚠ 21/09 — câu `khung` (câu 5 cũ, đáp án game hằng `'chưa biết'`) đã BỎ khỏi phỏng vấn
     * (nay hỏi ở `lo_trinh.ts`, lúc đã có sổ). GAME điền sẵn giờ CHỈ còn suy được `nhip`
     * (`gameDienSan`, và chỉ khi cửa `noi_game` mở) — đổi kịch bản sang đúng câu ấy: người
     * này đã tự chọn 'cuối tháng' cho câu 6, còn tín hiệu trận lại gợi 'ngày tệ'. Mở lại
     * phải thấy 'cuối tháng' ĐÃ CHỌN, không bị ⚑ của game đè lên.
     * ⚠ Không đi qua `ve()` của tệp này — hàm đó tự gọi `stubFetch([])` nên sẽ xoá mất bảng
     * stub cần cho GAME. Dựng render trực tiếp, cùng nếp `veTrucTiep` của `phong_van.test.tsx`.
     */
    const calls = stubFetch([
      ['/auth/me', {
        status: 200,
        body: {
          ...ME_ONBOARDED,
          pfm: { consent: true, bat_dau: LUC, cua: { ket: false, dac_trung: false, thuong: false, noi_game: true } },
        },
      }],
      ['/holdem/me/tin-hieu', { status: 200, body: tinHieu(NGUONG_TINH_CACH.KET_QUA_X + 0.1) }],
    ]);
    const kho = await khoVoi({
      nguonThuNhan: ['lương tháng', 'gia đình cho'],
      deu: 'đều mỗi tháng',
      coNo: false, coNoNhan: ['không có'],
      mucTieu: ['chuyến đi'],
      lucTienVe: 'cất một phần đi',
      sauKhiTieu: 'nhẩm lại giá',
      dauThang: 'đại khái',
      nhip: ['cuối tháng'],
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/tai-chinh/phong-van']}>
          <KhoProvider kho={kho}><RuotPhongVan /></KhoProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    /*
     * Hồ sơ trả lời đủ tám câu ⇒ hé dần lộ cả tám dưới dạng dòng thu gọn. Dòng thu gọn chỉ
     * tồn tại KHI câu đã có đáp án, nên nó là mốc thật (không phải một chip đang chờ hồ sơ về).
     * ⚠ CẢ HAI đều PHẢI `await findByText`, không chỉ câu đầu: điền sẵn (`setTraLoi`) và hé dần
     * (`setHien`) là HAI effect tách rời — câu 1 (đã có đáp án ngay từ state đầu) có thể collapse
     * ở một lượt render SỚM HƠN câu 5, và một `getByText` đồng bộ ngay sau đó bắt trúng đúng khe
     * hở giữa hai lượt ấy (bài đã tự dính chỗ này khi chạy lại nhiều lần).
     */
    expect(await screen.findByText('lương tháng · gia đình cho')).toBeInTheDocument();
    expect(await screen.findByText('chuyến đi')).toBeInTheDocument();

    const cauNhip = CAU_PV.find((c) => c.id === 'nhip')!;
    fireEvent.click(screen.getByText(cauNhip.hoi));   // dòng thu gọn ⇒ mở lại câu 6
    expect(await screen.findByRole('button', { name: 'cuối tháng' }))
      .toHaveAttribute('aria-pressed', 'true');
    const chipGame = screen.getByRole('button', { name: 'ngày tệ' });
    expect(chipGame.getAttribute('aria-pressed'), 'đáp án game đè lên lựa chọn thật').toBe('false');
    expect(chipGame.className, 'chip do GAME gợi ý vẫn phải mang cờ ⚑').toContain('chipGame');
    expect(calls.some((c) => c.url.includes('/holdem/me/tin-hieu')), 'phải thật sự gọi tín hiệu game').toBe(true);
  });

  it('⭐ mở lại một câu rồi chạm "để sau" ⇒ XOÁ câu ấy, không giữ lời cũ', async () => {
    /*
     * Không có cú xoá này thì người dùng KHÔNG CÓ đường nào rút lại một câu: họ
     * bấm "để sau", app gật đầu, rồi hồ sơ vẫn giữ lời cũ.
     * ⚠ 21/09 — "để sau" đổi từ CHIP sang TEXT LINK ("bỏ qua câu này"), và câu `khung`
     * (câu 5 cũ) đã BỎ khỏi phỏng vấn. Đổi sang câu 1 (`nguon_thu`) — câu LUÔN đứng đầu,
     * nên hé dần lộ nó ngay cả khi các câu sau vẫn còn trống.
     */
    const kho = await khoVoi({ nguonThuNhan: ['lương tháng', 'gia đình cho'], mucTieu: ['chuyến đi'] });
    ve(<RuotPhongVan />, kho, '/tai-chinh/phong-van');
    // Câu 1 đã trả lời ⇒ vào thẳng dạng dòng thu gọn; câu 2 (chưa trả lời) hé kế tiếp, còn mở.
    fireEvent.click(await screen.findByText('lương tháng · gia đình cho'));   // mở lại câu 1
    const cau1 = screen.getByText(CAU_PV[0]!.hoi).closest('div')!.parentElement!;
    fireEvent.click(within(cau1).getByText('bỏ qua câu này'));
    // Câu 1 vừa "để sau" thì thu gọn lại ngay — chỉ còn câu 2 mở, nên "bỏ qua hết" hết mơ hồ.
    fireEvent.click(await screen.findByText('bỏ qua hết'));
    // D355 — nút nay dẫn sang NGÀY ĐẦU (chân dung), không còn LỘ TRÌNH.
    fireEvent.click(await screen.findByText(/XONG — XEM CHÂN DUNG/));

    await waitFor(async () => {
      const h = await docHoSo(kho);
      expect(h.nguonThu, 'chạm "để sau" mà câu cũ vẫn sống').toBeUndefined();
      expect(h.nguonThuNhan, 'nhãn thô cũng phải bị xoá theo').toBeUndefined();
    });
    // Câu KHÁC không bị đụng tới.
    expect((await docHoSo(kho)).mucTieu).toEqual(['chuyến đi']);
  });

  it('hồ sơ CŨ (trước D308, không có nhãn thô) ⇒ câu 1 mở ra trống, không bịa nhãn', async () => {
    const kho = await khoVoi({ nguonThu: 'luong' });
    ve(<RuotPhongVan />, kho, '/tai-chinh/phong-van');
    // 21/09 — chín câu (trước là sáu); số câu ÁP DỤNG suy từ chính hàm sản xuất, không chép tay.
    const soCau = cauDangHien({}).length;
    await screen.findByText(new RegExp(`^${soCau} CÂU · CHẠM LÀ XONG`));
    /*
     * ⚠ DÒNG ĐẾM KHÔNG PHẢI MỐC "ĐÃ ĐIỀN SẴN XONG" — nó suy từ CẤU TRÚC `cauHien` (không phụ
     * thuộc hồ sơ), nên hiện ra ngay ở lượt vẽ ĐẦU, trước cả khi `coHoSo` kịp true. Lớp điền sẵn
     * (`traLoiTuHoSo(hoSoCu)`) chạy trong MỘT effect riêng, sau khi kho đọc xong — một khoảng lặng
     * ngắn nhưng thật (cùng lý do `phong_van.test.tsx` §VIII phải chờ 80ms). Đợi ở đây trước khi
     * đọc trạng thái câu 1, không thì phép kiểm chạy TRƯỚC khi có gì để bịa hay không bịa.
     */
    await new Promise((r) => setTimeout(r, 80));
    /*
     * ⭐ Câu 1 phải ở dạng MỞ (chip rời, chưa chọn cái nào) — bịa nhãn sẽ khiến `traLoi.nguon_thu`
     * có giá trị, và câu tự thu gọn lại (`thu = daXu && !moCau`) thay vì đứng mở chờ chạm. Chờ
     * chip qua `findByRole` bắt được CẢ HAI dạng hỏng: câu thu gọn (chip biến mất hẳn ⇒ không tìm
     * thấy) lẫn câu vẫn mở nhưng chip đã bị đánh dấu chọn sẵn (`aria-pressed`).
     */
    const chipLuong = await screen.findByRole('button', { name: 'lương tháng' });
    expect(chipLuong.getAttribute('aria-pressed'), 'bịa nhãn cho khớp mã').toBe('false');
    expect(screen.queryByText('lương tháng · '), 'bịa nhãn cho khớp mã').toBeNull();
  });
});

describe('VI. ⭐⭐⭐ (D360) Hồ sơ KHÔNG BAO GIỜ bị ghi đè từ state của màn', () => {
  /*
   * ⚠⚠ VÌ SAO KHỐI NÀY TỒN TẠI. `useHoSo()` trả `{}` trong lúc hồ sơ chưa nạp xong, và hai đường ghi của `bamNut` từng
   * dựng bản mới từ state ấy (`{ ...hoSo, loTrinhBo: […] }`) rồi GHI ĐÈ TRỌN bản ghi ⇒ một cú chạm sớm là sáu câu phỏng
   * vấn bay sạch, im lặng. Màn đã lên prod từ 0.0.5 với đúng thế kẹt này; D358 bắt được nó ở màn NGÀY ĐẦU và cắm việc
   * này riêng. Ba tầng, mỗi tầng một bài: (1) nguồn của cú ghi là KHO, không phải state; (2) chưa có hồ sơ thì không vẽ
   * nút; (3) hai lượt sửa sát nhau XẾP HÀNG — lượt sau đọc bản lượt trước đã ghi.
   */
  const SAU_LUNG: HoSo = { deu: 'thất thường', coNo: true, coNoNhan: ['trả góp'], chanDungBac: ['nhip'], ngayDauBo: [1] };

  /** Provider TỰ mở kho (không ai bơm) — đúng đường prod. `qc` đưa vào để bài cache-nóng gieo sẵn hồ sơ. */
  function veTuMo(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    stubFetch([['/auth/me', { status: 200, body: ME_ONBOARDED }]]);   // D603: provider mở kho của ĐÚNG người ⇒ cần biết là ai
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/tai-chinh/lo-trinh']}>
          <Vet />
          <KhoProvider><RuotLoTrinh /></KhoProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('⭐⭐⭐ BỎ là ĐỌC–SỬA–GHI TỪ KHO — câu trả lời ghi SAU LƯNG màn phải CÒN', async () => {
    /*
     * Dựng thế kẹt mà không cần đua thời gian (cùng nếp `ngay_dau.test.tsx` §III): màn nạp hồ sơ xong, rồi ta ghi
     * THÊM vào kho mà không vô hiệu hoá gì — state của màn giờ CŨ hơn kho. Bấm BỎ: nếu cú ghi dựng từ state thì mọi
     * thứ vừa ghi thêm biến mất.
     */
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng', 'chuyến đi'] });
    ve(<RuotLoTrinh />, kho);
    await screen.findByText('Hũ dự phòng');
    await ghiHoSo(kho, { ...(await docHoSo(kho)), ...SAU_LUNG }, LUC);

    fireEvent.click(screen.getAllByText('BỎ')[0]!);
    await waitFor(async () => expect((await docHoSo(kho)).loTrinhBo).toEqual(['quỹ dự phòng']));

    expect(await docHoSo(kho), 'cú BỎ chỉ được THÊM một khoá, không được dựng lại hồ sơ từ thứ màn đang cầm')
      .toEqual({ mucTieu: ['quỹ dự phòng', 'chuyến đi'], ...SAU_LUNG, loTrinhBo: ['quỹ dự phòng'] });
  });

  it('⭐⭐⭐ THỬ KHUNG NÀY cũng thế — ghi đúng `khung`, mọi thứ trong kho còn nguyên', async () => {
    const kho = await khoVoi({ deu: 'thất thường', mucTieu: ['chuyến đi'] });
    ve(<RuotLoTrinh />, kho);
    await screen.findByText('THỬ KHUNG NÀY');
    await ghiHoSo(kho, { ...(await docHoSo(kho)), coNo: false, nhip: ['cuối tháng'], loTrinhBo: ['chuyến đi'] }, LUC);

    fireEvent.click(screen.getByText('THỬ KHUNG NÀY'));
    await waitFor(async () => expect((await docHoSo(kho)).khung).toBe('hu'));

    expect(await docHoSo(kho)).toEqual({
      deu: 'thất thường', mucTieu: ['chuyến đi'], coNo: false, nhip: ['cuối tháng'], loTrinhBo: ['chuyến đi'], khung: 'hu',
    });
  });

  it('khối ĐÃ nằm trong `loTrinhBo` CỦA KHO (màn chưa biết) ⇒ không thêm lần hai, và màn tự đồng bộ lại', async () => {
    // Phép kiểm "đã bỏ rồi" phải chạy trên bản ĐỌC TỪ KHO. Kiểm trên state rồi nối vào bản của kho là ra hai khoá trùng.
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng', 'chuyến đi'] });
    ve(<RuotLoTrinh />, kho);
    await screen.findByText('Hũ dự phòng');
    await ghiHoSo(kho, { ...(await docHoSo(kho)), loTrinhBo: ['quỹ dự phòng'] }, LUC);

    fireEvent.click(screen.getAllByText('BỎ')[0]!);
    await waitFor(() => expect(screen.queryByText('Hũ dự phòng'), 'màn phải đọc lại kho dù không ghi gì').toBeNull());
    expect((await docHoSo(kho)).loTrinhBo).toEqual(['quỹ dự phòng']);
    expect(screen.getByText('Hũ chuyến đi')).toBeInTheDocument();
  });

  it('⭐⭐ hồ sơ CHƯA nạp xong ⇒ màn không vẽ MỘT nút nào; nạp xong mới hiện lộ trình', async () => {
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng'] });
    let tha: () => void = () => undefined;
    const cho = new Promise<void>((r) => { tha = r; });
    const docGoc = kho.doc.bind(kho);
    // Giữ lượt đọc hồ sơ lại — đúng thế kẹt của IndexedDB chậm lúc mở app nguội.
    (kho as unknown as { doc: typeof kho.doc }).doc = (async (ngan: never, id: never) => { await cho; return docGoc(ngan, id); }) as typeof kho.doc;
    ve(<RuotLoTrinh />, kho);
    await new Promise((r) => setTimeout(r, 40));
    expect(screen.getByTestId('man-lo-trinh').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryAllByRole('button'), 'nút vẽ ra lúc này đứng trên hồ sơ rỗng').toHaveLength(0);
    expect(screen.queryByText('CHỌN MẪU'), 'lộ trình của hồ sơ RỖNG loé lên = kể sai lời khai của người dùng').toBeNull();
    tha();
    expect(await screen.findByText('Hũ dự phòng')).toBeInTheDocument();
    expect(screen.queryByTestId('man-lo-trinh'), 'khung chờ phải đi khi hồ sơ về').toBeNull();
  });

  it('⭐⭐ KHO CÒN ĐANG MỞ (provider tự mở — đường prod) ⇒ cũng không vẽ nút nào, dù cờ `dangTai` lúc này TẮT', async () => {
    /*
     * Cổng theo `dangTai` (nếp màn NGÀY ĐẦU) hở đúng cửa sổ này: `dangTai = isPending && kho !== null`, mà kho đang mở
     * thì `kho === null` ⇒ `dangTai` = false trong khi chưa một byte hồ sơ nào được đọc. Mở app nguội thẳng vào màn là
     * lộ trình của hồ sơ RỖNG hiện ra trước, rồi mới tới khung chờ, rồi mới tới lộ trình thật — nháy ba nhịp.
     */
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng'] });
    let tha: (k: KhoPfm) => void = () => undefined;
    gia.moKho = () => new Promise<KhoPfm>((r) => { tha = r; });
    veTuMo();
    await new Promise((r) => setTimeout(r, 40));
    expect(screen.getByTestId('man-lo-trinh').getAttribute('aria-busy')).toBe('true');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    tha(kho);
    expect(await screen.findByText('Hũ dự phòng')).toBeInTheDocument();
  });

  it('⭐ người MỚI TOANH (kho chưa từng có hồ sơ) ⇒ màn VẪN hiện — hồ sơ rỗng THẬT không phải "chưa nạp xong"', async () => {
    // Cổng viết kiểu "hồ sơ có khoá nào chưa" sẽ nhốt đúng người dùng mới nhất ở khung chờ mãi mãi.
    ve(<RuotLoTrinh />, new KhoTrongBoNho());
    expect(await screen.findByText('Chưa có hũ nào')).toBeInTheDocument();
    expect(screen.queryByTestId('man-lo-trinh')).toBeNull();
  });

  it('lượt đọc hồ sơ HỎNG HẲN ⇒ màn vẫn mở, không treo khung chờ mãi', async () => {
    /*
     * Đọc hỏng thì không còn gì để chờ: giữ khung trắng mãi là một màn chết không lời giải thích. Màn vẽ ra lúc này
     * đứng trên `{}` — lớp bảo vệ còn lại là đường GHI (đọc lại từ kho; đọc không được thì không ghi), canh ở
     * `pfm_ho_so_sua.test.ts` §III chứ không ở đây: cú bấm trên màn ném trong một lời hứa không ai chờ.
     */
    const kho = await khoVoi({ deu: 'thất thường', mucTieu: ['chuyến đi'] });
    (kho as unknown as { doc: typeof kho.doc }).doc = (async () => { throw new Error('đọc hỏng'); }) as typeof kho.doc;
    ve(<RuotLoTrinh />, kho);
    expect(await screen.findByText('Chưa có hũ nào')).toBeInTheDocument();
    expect(screen.queryByTestId('man-lo-trinh')).toBeNull();
  });

  it('⭐ hồ sơ ĐÃ CÓ trong cache (đi từ màn PFM khác sang) ⇒ vẽ NGAY ở nhịp đầu — cổng không được làm nháy khung', () => {
    /*
     * Mỗi màn PFM bọc một `<KhoProvider>` riêng, và provider nào cũng có ít nhất MỘT nhịp `kho === null` (lượt mở là một
     * lời hứa, kể cả khi kho đã mở từ màn trước). Cổng viết kiểu `dangMo || dangTai` sẽ vẽ một khung trắng ở MỌI lần
     * chuyển màn dù hồ sơ thật đang nằm sẵn trong cache. Khẳng định ĐỒNG BỘ, ngay sau `render`: không `await` nào.
     */
    gia.moKho = () => new Promise<KhoPfm>(() => undefined);   // kho không mở xong trong suốt bài này
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(KHOA_PFM.hoSo, { mucTieu: ['quỹ dự phòng'] } satisfies HoSo);
    veTuMo(qc);
    expect(screen.queryByTestId('man-lo-trinh'), 'khung chờ hiện ra dù hồ sơ có sẵn').toBeNull();
    expect(screen.getByText('Hũ dự phòng')).toBeInTheDocument();
  });

  it('⭐ hồ sơ có trong cache mà HŨ thì chưa đọc ⇒ KHÔNG loé khối "sổ không có hũ dự phòng" (D360)', async () => {
    /*
     * Ca thật của người đi từ một màn PFM khác sang: hồ sơ nằm sẵn trong cache (`gcTime: Infinity`) nên cổng `coHoSo`
     * mở màn ngay, nhưng provider MỚI của màn này vẫn đang mở kho ⇒ `useHu()` trả `[]`. Đọc mảng rỗng ấy thành "sổ
     * không có hũ nào" là kể sai về sổ của người ĐANG CÓ hũ — cùng lỗi `dangTai` đã vá cho hồ sơ.
     */
    const kho = await khoVoi({ mucTieu: ['chuyến đi'] });
    await kho.ghi('hu', { id: 'dp', thang: '2026-09', suaLuc: LUC, d: tuTao({ ten: 'Dự phòng', loai: 'du_phong' }, LUC, 'dp') });
    let tha: (k: KhoPfm) => void = () => undefined;
    gia.moKho = () => new Promise<KhoPfm>((r) => { tha = r; });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(KHOA_PFM.hoSo, { mucTieu: ['chuyến đi'] } satisfies HoSo);
    veTuMo(qc);
    // Màn mở ngay (hồ sơ có sẵn) — nhưng chưa được phép nói gì về SỔ.
    expect(screen.getByText('Hũ chuyến đi')).toBeInTheDocument();
    expect(screen.queryByText('Hũ dự phòng'), 'khối đọc-từ-sổ dựng trên mảng rỗng chưa ai đọc').toBeNull();
    tha(kho);
    // Hũ về: người này ĐÃ CÓ hũ dự phòng ⇒ khối ấy vĩnh viễn không được hiện.
    await new Promise((r) => setTimeout(r, 40));
    expect(screen.queryByText('Hũ dự phòng')).toBeNull();
  });

  it('⭐⭐ cú ghi HỎNG để lại DẤU — không biến mất im lặng (D360)', async () => {
    /*
     * `void f()` vứt lời hứa đi, nên `f` ném là thành unhandled rejection: app không có bộ bắt nào cho nó
     * (grep `unhandledrejection` = 0) và `ManLoi` chỉ bắt lỗi lúc RENDER. Người dùng bấm, cú ghi hỏng, và KHÔNG CÓ
     * GÌ xảy ra — không chữ, không log, không một dòng đếm được. Bài này khoá hai đường để lại dấu: console (người
     * soi prod) và `loi_client` (đếm được).
     * ⚠ Nó KHÔNG khoá việc báo cho NGƯỜI DÙNG — dải lỗi trên màn là thành phần nhìn thấy ⇒ A11.25 đòi demo trước,
     *   còn nợ (D360 §Bị bác). Đừng đọc bài xanh này thành "người dùng đã được báo".
     */
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng'] });
    ve(<RuotLoTrinh />, kho);
    await screen.findByText('Hũ dự phòng');
    (kho as unknown as { ghi: typeof kho.ghi }).ghi = (async () => { throw new Error('ghi hỏng'); }) as typeof kho.ghi;
    localStorage.removeItem(TELEMETRY.KHOA_LUU);
    const vet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      fireEvent.click(screen.getAllByText('BỎ')[0]!);
      await waitFor(() => expect(vet).toHaveBeenCalled());
      expect(String(vet.mock.calls[0]?.[0])).toContain('việc chạy nền hỏng');
      const luu = localStorage.getItem(TELEMETRY.KHOA_LUU) ?? '';
      expect(luu, 'lỗi phải ĐẾM ĐƯỢC, không chỉ nằm trong console của một máy').toContain('loi_client');
      expect(luu).toContain('nen:');
    } finally {
      vet.mockRestore();
    }
  });

  it('⭐⭐⭐ cú ghi HỎNG nay BÁO CHO NGƯỜI DÙNG — không còn câm (D360)', async () => {
    /*
     * Vế còn lại của bài trên: dấu cho người VẬN HÀNH là chưa đủ. Người đang bấm phải biết thao tác của mình không
     * vào, và phải biết **dữ liệu cũ còn nguyên** — im lặng ở đây làm họ tưởng vừa mất cái gì đó.
     * ⚠ Khuôn ô lỗi chép ĐÚNG của `PhongVan`/`CamKet` (`role="alert"` + `✕`), không dựng kiểu thứ ba (A11.25:
     *   áp một mẫu đã chốt trong cùng khu, không phải thiết kế mới).
     */
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng'] });
    ve(<RuotLoTrinh />, kho);
    await screen.findByText('Hũ dự phòng');
    (kho as unknown as { ghi: typeof kho.ghi }).ghi = (async () => { throw new Error('ghi hỏng'); }) as typeof kho.ghi;
    const vet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      fireEvent.click(screen.getAllByText('BỎ')[0]!);
      const bao = await screen.findByRole('alert');
      expect(bao.textContent).toContain(CHU_LOI_GHI);
      expect(bao.textContent, 'giữ dấu ✕ của khuôn chung').toContain('✕');
    } finally {
      vet.mockRestore();
    }
  });

  it('câu báo lỗi KHÔNG chở thông điệp kỹ thuật của Error (C7 — chỗ PII rò ra tự nhiên nhất)', async () => {
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng'] });
    ve(<RuotLoTrinh />, kho);
    await screen.findByText('Hũ dự phòng');
    (kho as unknown as { ghi: typeof kho.ghi }).ghi = (async () => {
      throw new Error('ai@example.com vừa làm hỏng bảng users');
    }) as typeof kho.ghi;
    const vet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      fireEvent.click(screen.getAllByText('BỎ')[0]!);
      const bao = await screen.findByRole('alert');
      expect(bao.textContent).not.toContain('@example.com');
      expect(bao.textContent).not.toContain('users');
    } finally {
      vet.mockRestore();
    }
  });

  it('ghi LẠI thành công ⇒ câu báo lỗi ĐI MẤT (không dính lại trên màn)', async () => {
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng', 'chuyến đi'] });
    ve(<RuotLoTrinh />, kho);
    await screen.findByText('Hũ dự phòng');
    const ghiThat = kho.ghi.bind(kho);
    (kho as unknown as { ghi: typeof kho.ghi }).ghi = (async () => { throw new Error('ghi hỏng'); }) as typeof kho.ghi;
    const vet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      fireEvent.click(screen.getAllByText('BỎ')[0]!);
      await screen.findByRole('alert');
      (kho as unknown as { ghi: typeof kho.ghi }).ghi = ghiThat;    // kho lành lại
      fireEvent.click(screen.getAllByText('BỎ')[0]!);
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    } finally {
      vet.mockRestore();
    }
  });

  it('⭐⭐ HAI LẦN CHẠM SÁT NHAU ⇒ cả hai cú BỎ đều còn — lượt sau đọc bản lượt trước ĐÃ GHI', async () => {
    /*
     * Hai cú chạm trong CÙNG một nhịp (không `await` nào chen giữa) là mô hình tất định của "chạm nhanh hơn một lượt
     * đọc–ghi IndexedDB". Đọc-lại-từ-kho một mình KHÔNG đủ: cả hai lượt cùng đọc trước khi lượt nào kịp ghi ⇒ lượt sau
     * vẫn nuốt lượt trước. Phải XẾP HÀNG.
     */
    const kho = await khoVoi({ mucTieu: ['quỹ dự phòng', 'chuyến đi'] });
    ve(<RuotLoTrinh />, kho);
    await screen.findByText('Hũ dự phòng');
    const nut = screen.getAllByText('BỎ');
    fireEvent.click(nut[0]!);
    fireEvent.click(nut[1]!);
    await waitFor(async () => {
      expect([...((await docHoSo(kho)).loTrinhBo ?? [])].sort()).toEqual(['chuyến đi', 'quỹ dự phòng']);
    });
    expect((await docHoSo(kho)).mucTieu).toEqual(['quỹ dự phòng', 'chuyến đi']);
  });

  it('⭐⭐ THỬ KHUNG NÀY + BỎ trong cùng một nhịp ⇒ `khung` VÀ `loTrinhBo` cùng sống', async () => {
    const kho = await khoVoi({ deu: 'thất thường', mucTieu: ['chuyến đi'] });
    ve(<RuotLoTrinh />, kho);
    const thu = await screen.findByText('THỬ KHUNG NÀY');
    // ⚠ KHOANH ĐÚNG KHỐI: với hồ sơ này nút BỎ ĐẦU TIÊN trên màn thuộc khối trạng thái `#DP_THIEU` (đọc từ sổ), không
    // phải hũ chuyến đi — bản đầu của bài lấy `getAllByText('BỎ')[0]` và đỏ vì một lý do khác hẳn thứ nó định canh.
    const boChuyenDi = within(screen.getByText('Hũ chuyến đi').closest('[data-ma]') as HTMLElement).getByText('BỎ');
    fireEvent.click(thu);
    fireEvent.click(boChuyenDi);
    await waitFor(async () => {
      const h = await docHoSo(kho);
      expect([h.khung, h.loTrinhBo]).toEqual(['hu', ['chuyến đi']]);
    });
    expect((await docHoSo(kho)).deu).toBe('thất thường');
  });
});
