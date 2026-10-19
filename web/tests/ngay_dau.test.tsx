/**
 * PFM — MÀN NGÀY ĐẦU (`screens/tai-chinh/NgayDau.tsx`, GIAI ĐOẠN A, D355/D356).
 *
 * ⚠⚠ Bài đắt nhất ở đây là §III: KHÔNG NGÕ CỤT (founder 20/09: *"bấm nhầm cái là không
 * chọn lại được"*) — mọi lựa chọn phải có đường quay lại. "ĐỔI"/"HOÀN TÁC"/"THÔI, GIỮ
 * NHƯ CŨ" đều là MỘT hàm (`hoanTacNet`), và nó LUÔN đưa nét về ĐÚNG GỐC (không có một
 * trạng thái lưng chừng "đang chọn lại" khác gốc) — khác demo, vốn giữ điểm của nét
 * VĨNH VIỄN qua một biến đếm tách khỏi trạng thái hiển thị (`netXong`, không có tương
 * đương trong hai trường hồ sơ của A2). ⇒ TÍNH CHẤT THẬT SỰ giữ được ở bản này: quay về
 * gốc thì điểm quay về ĐÚNG mức TRƯỚC KHI bác (không thấp hơn), không phải "không bao
 * giờ giảm tuyệt đối". Xem `pfm_chan_dung.test.ts` cho vector chép tay của tính chất này.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/* D360 — cửa giả cho lượt mở kho (chỉ §IX/§X). Xem `lo_trinh_nut.test.tsx` §VI về vì sao cần: bơm kho thẳng
 * vào provider thì không bao giờ chạm cửa sổ `kho === null`, mà đó đúng là cửa sổ `dangTai` bỏ sót. */
const giaMoKho = vi.hoisted(() => ({ moKho: null as null | (() => Promise<unknown>) }));
vi.mock('../src/pfm/kho_idb.js', async (nhapGoc) => {
  const goc = await nhapGoc<typeof import('../src/pfm/kho_idb.js')>();
  return { ...goc, moKho: (chu: string) => (giaMoKho.moKho ? (giaMoKho.moKho() as ReturnType<typeof goc.moKho>) : goc.moKho(chu)) };
});
import { KhoTrongBoNho, type KhoPfm } from '../src/pfm/kho.js';
import { docHoSo, ghiHoSo, type HoSo } from '../src/pfm/ho_so.js';
import { KHOA_PFM, KhoProvider, quenLuotMo } from '../src/pfm/dung_kho';
import { RuotNgayDau } from '../src/screens/tai-chinh/NgayDau';
import { RuotPhongVan } from '../src/screens/tai-chinh/PhongVan';
import { CHAN_DUNG_NOI_DUNG, CHU_LOI_GHI, CHU_NGAY_DAU } from '../src/lib/pfm_chu';
import { tuKeDonTrong } from '../src/lib/khoanh_khac';
import { ME_ONBOARDED, stubFetch } from './helpers';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); giaMoKho.moKho = null; quenLuotMo(); });

const LUC = '2026-09-20T09:00:00.000Z';

/** Hiện đường hiện tại ra DOM — nguồn sự thật của mọi khẳng định "đi tới đâu" (cùng nếp `lo_trinh_nut.test.tsx`). */
function Vet(): React.ReactElement {
  const l = useLocation();
  return <i data-testid="duong">{`${l.pathname}${l.search}`}</i>;
}

function ve(ruot: React.ReactElement, kho: KhoTrongBoNho, dau = '/tai-chinh/ngay-dau') {
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
const phanTramHieu = (): number => Number(screen.getByTestId('hieu-so').textContent);
/** `.net` chứa dòng tiêu đề khớp `mau` — cùng thủ thuật `closest/parentElement` của `lo_trinh_nut.test.tsx`. */
const khoiNet = (mau: RegExp): HTMLElement => screen.getByText(mau).closest('div')!.parentElement!;

describe('I. Vẽ đúng chân dung theo hồ sơ', () => {
  it('bốn chip câu 6 ra đúng bốn chân dung (glyph + tên + dự đoán)', async () => {
    const kho = await khoVoi({ nhip: ['ngay sau khi tiền về'] });
    ve(<RuotNgayDau />, kho);
    expect(await screen.findByText('TIỀN VỀ LÀ TIÊU')).toBeInTheDocument();
    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText(CHAN_DUNG_NOI_DUNG.tien_ve.doan)).toBeInTheDocument();
  });

  it('⭐ bỏ câu 6 ⇒ CHƯA RÕ NÉT, không hiện khối dự đoán giả', async () => {
    const kho = await khoVoi({});
    ve(<RuotNgayDau />, kho);
    expect(await screen.findByText('CHƯA RÕ NÉT')).toBeInTheDocument();
    expect(screen.getByText(CHU_NGAY_DAU.chuaRoGhiChu)).toBeInTheDocument();
    expect(screen.queryByText(CHU_NGAY_DAU.doanTieu)).toBeNull();
  });

  it('dòng nhóm nguồn thu + nhịp tiền vào đọc đúng hồ sơ', async () => {
    const kho = await khoVoi({ nguonThuNhan: ['lương tháng'], deu: 'đều mỗi tháng', nhip: ['cuối tháng'] });
    ve(<RuotNgayDau />, kho);
    await screen.findByText('CUỐI THÁNG BUÔNG TAY');
    expect(screen.getByText(/LƯƠNG/)).toBeInTheDocument();
    expect(screen.getByText(/TIỀN VÀO ĐỀU MỖI THÁNG/)).toBeInTheDocument();
  });
});

describe('II. ⭐⭐ Bác nét nhịp rồi chọn chip khác ⇒ chân dung VÀ việc 2 đổi theo', () => {
  it('TIÊU ĐỂ XẢ → VUI LÀ CHI, và việc 2 đổi "BẬT LUẬT" thành "ĐẶT MỨC · 2 CHẠM"', async () => {
    const kho = await khoVoi({ nhip: ['ngày tệ'] });
    ve(<RuotNgayDau />, kho);
    await screen.findByText('TIÊU ĐỂ XẢ');

    fireEvent.click(within(khoiNet(/LÚC DỄ TIÊU QUÁ TAY/)).getByText(CHU_NGAY_DAU.khongHan));
    fireEvent.click(await screen.findByText('đi chơi cùng bạn'));

    await screen.findByText('VUI LÀ CHI');
    expect(screen.queryByText('TIÊU ĐỂ XẢ')).toBeNull();

    fireEvent.click(screen.getByText(CHU_NGAY_DAU.neoChanDung));
    await screen.findByTestId('ds-ba-viec');
    expect(screen.getByText(/ĐẶT MỨC/)).toBeInTheDocument();
    expect(screen.queryByText(/^BẬT LUẬT/)).toBeNull();
    expect(screen.getByText(CHU_NGAY_DAU.luatHaiChamGhiChu)).toBeInTheDocument();
  });
});

describe('III. ⭐⭐⭐ KHÔNG NGÕ CỤT — mọi lựa chọn có đường quay lại', () => {
  it('bác nét TIỀN VÀO rồi HOÀN TÁC ⇒ trở lại "KHÔNG HẲN", giá trị gốc còn nguyên', async () => {
    /*
     * ⚠ KHỚP ĐÚNG DÒNG TIÊU ĐỀ CỦA NÉT ("TIỀN VÀO · câu 2"), không khớp trần NET_DEU: thẻ chân dung cũng in
     * "… · TIỀN VÀO THẤT THƯỜNG". Bản đầu của bài này khớp trần mà vẫn chạy được tới giữa chừng — vì lúc ấy màn
     * vẽ khi hồ sơ CHƯA nạp xong nên dòng kia chưa hiện. Chính bài này đã lộ ra lỗi ghi đè hồ sơ rỗng (D358).
     */
    const NET_DEU = new RegExp(`${CHU_NGAY_DAU.netDeuTen} · ${CHU_NGAY_DAU.netDeuCau}`);
    const kho = await khoVoi({ deu: 'thất thường' });
    ve(<RuotNgayDau />, kho);
    await screen.findByText(NET_DEU);

    fireEvent.click(within(khoiNet(NET_DEU)).getByText(CHU_NGAY_DAU.khongHan));
    await within(khoiNet(NET_DEU)).findByText(CHU_NGAY_DAU.daBoNet);

    fireEvent.click(within(khoiNet(NET_DEU)).getByText(CHU_NGAY_DAU.hoanTac));
    await waitFor(() => {
      expect(within(khoiNet(NET_DEU)).getByText(CHU_NGAY_DAU.khongHan)).toBeInTheDocument();
    });
    expect(within(khoiNet(NET_DEU)).getByText('thất thường')).toBeInTheDocument();
  });

  it('⭐⭐ hồ sơ CHƯA nạp xong ⇒ màn không vẽ MỘT nút nào; nạp xong mới hiện chân dung', async () => {
    const kho = await khoVoi({ nhip: ['ngày tệ'] });
    let tha: () => void = () => undefined;
    const cho = new Promise<void>((r) => { tha = r; });
    const docGoc = kho.doc.bind(kho);
    // Giữ lượt đọc hồ sơ lại — đúng thế kẹt của IndexedDB chậm lúc mở app nguội.
    (kho as unknown as { doc: typeof kho.doc }).doc = (async (ngan: never, id: never) => { await cho; return docGoc(ngan, id); }) as typeof kho.doc;
    ve(<RuotNgayDau />, kho);
    await new Promise((r) => setTimeout(r, 40));
    const man = screen.getByTestId('man-ngay-dau');
    expect(man.getAttribute('aria-busy')).toBe('true');
    expect(within(man).queryAllByRole('button'), 'nút vẽ ra lúc này đứng trên hồ sơ rỗng').toHaveLength(0);
    tha();
    expect(await screen.findByText('TIÊU ĐỂ XẢ')).toBeInTheDocument();
  });

  it('⭐⭐⭐ GHI LÀ ĐỌC–SỬA–GHI TỪ KHO, không từ state của màn — hồ sơ không bao giờ bị ghi đè mất câu trả lời (D358)', async () => {
    /*
     * Ca thật: `useHoSo()` trả `{}` khi chưa nạp xong; bản đầu ghi `f(hoSo)` từ state ấy ⇒ một cú chạm sớm GHI ĐÈ
     * cả hồ sơ, sáu câu phỏng vấn bay sạch. Bài này dựng đúng thế kẹt đó mà không cần đua thời gian: sau khi màn đã
     * nạp hồ sơ, ta ghi THÊM một câu trả lời thẳng vào kho (màn không hề biết), rồi mới chạm KHÔNG HẲN. Nếu màn ghi
     * từ state cũ của nó thì câu trả lời mới kia biến mất.
     */
    const kho = await khoVoi({ nhip: ['ngày tệ'], deu: 'thất thường' });
    ve(<RuotNgayDau />, kho);
    await screen.findByText('TIÊU ĐỂ XẢ');
    await ghiHoSo(kho, { ...(await docHoSo(kho)), mucTieu: ['chuyến đi'], coNo: true }, LUC);   // sau lưng màn

    const NET_DEU = new RegExp(`${CHU_NGAY_DAU.netDeuTen} · ${CHU_NGAY_DAU.netDeuCau}`);
    fireEvent.click(within(khoiNet(NET_DEU)).getByText(CHU_NGAY_DAU.khongHan));
    await waitFor(async () => { expect((await docHoSo(kho)).chanDungBac).toEqual(['deu']); });

    const sau = await docHoSo(kho);
    expect(sau.mucTieu, 'câu 4 ghi sau lưng màn phải CÒN').toEqual(['chuyến đi']);
    expect(sau.coNo).toBe(true);
    expect(sau.deu, 'câu 2 không bị cú bác nét xoá').toBe('thất thường');
    expect(sau.nhip).toEqual(['ngày tệ']);
  });

  it('⭐ chốt một chip cho nhịp rồi ĐỔI ⇒ trở lại ĐÚNG GỐC (không kẹt ở chốt), chân dung trả về đúng bản gốc', async () => {
    /*
     * ⚠ "ĐỔI"/"THÔI, GIỮ NHƯ CŨ"/"HOÀN TÁC" là MỘT hàm (`hoanTacNet`) — đúng cách demo tự
     * viết: cả ba nhãn cùng gọi `data-lai="net:khoa"`, và handler đó LUÔN đặt `bac=false`
     * (khác gốc "chọn lại"). Không có trạng thái lưng chừng nào giữa CHỐT và GỐC.
     */
    const kho = await khoVoi({ nhip: ['ngày tệ'] });
    ve(<RuotNgayDau />, kho);
    await screen.findByText('TIÊU ĐỂ XẢ');

    fireEvent.click(within(khoiNet(/LÚC DỄ TIÊU QUÁ TAY/)).getByText(CHU_NGAY_DAU.khongHan));
    fireEvent.click(await screen.findByText('đi chơi cùng bạn'));
    await screen.findByText(CHU_NGAY_DAU.daTuChon);
    await screen.findByText('VUI LÀ CHI');

    fireEvent.click(within(khoiNet(/LÚC DỄ TIÊU QUÁ TAY/)).getByText(CHU_NGAY_DAU.doi));
    // Về lại GỐC: "KHÔNG HẲN" hiện lại được, giá trị + chân dung trở về đúng bản gốc.
    await waitFor(() => {
      expect(within(khoiNet(/LÚC DỄ TIÊU QUÁ TAY/)).getByText(CHU_NGAY_DAU.khongHan)).toBeInTheDocument();
    });
    expect(within(khoiNet(/LÚC DỄ TIÊU QUÁ TAY/)).getByText('ngày tệ')).toBeInTheDocument();
    await screen.findByText('TIÊU ĐỂ XẢ');
    expect(screen.queryByText('VUI LÀ CHI')).toBeNull();
  });

  it('⭐ BỎ rồi HOÀN TÁC — CẢ BA việc, không chỉ việc 3 ⇒ trở lại "chưa làm", nút chính hiện lại, hồ sơ sạch', async () => {
    // ⚠ Bản đầu chỉ thử việc 3; tiêm lỗi "gỡ HOÀN TÁC của việc 1" ⇒ 15/15 XANH. Một bài canh không phủ thì bằng không có.
    const kho = await khoVoi({});
    ve(<RuotNgayDau />, kho);
    fireEvent.click(await screen.findByText(CHU_NGAY_DAU.neoChanDung));
    for (const so of [1, 2, 3]) {
      const viec = await screen.findByTestId(`viec-${so}`);
      const truoc = within(viec).getAllByRole('button').length;
      fireEvent.click(within(viec).getByText(CHU_NGAY_DAU.boViec));
      await within(viec).findByText(CHU_NGAY_DAU.daBoViec);
      fireEvent.click(within(viec).getByText(CHU_NGAY_DAU.hoanTac));
      await waitFor(() => { expect(within(viec).queryByText(CHU_NGAY_DAU.daBoViec)).toBeNull(); });
      expect(within(viec).getAllByRole('button').length, `việc ${so}: đủ nút như trước khi bỏ`).toBe(truoc);
    }
    expect((await docHoSo(kho)).ngayDauBo ?? []).toEqual([]);
  });

  it('⭐⭐ ĐỔI Ý VỀ MỘT NÉT: bác → chọn A → ĐỔI → bác lại → chọn B ⇒ thanh hiểu KHÔNG TỤT ở BƯỚC NÀO (khớp demo D356)', async () => {
    /*
     * ⚠ Bản đầu của bài này chỉ đòi "điểm CUỐI ≥ điểm lần bác đầu" và CHO PHÉP thanh tụt ở bước ĐỔI — vì bản thi
     * công đầu đếm `chanDungBac` (HOÀN TÁC gỡ khỏi đó). Demo founder duyệt thì KHÔNG tụt: bấm nhầm rồi hoàn tác không
     * được thành hình phạt. A11.25 — demo thắng ⇒ đếm `chanDungDaCham` (chỉ thêm), và bài siết lại: mọi bước ≥ bước trước.
     */
    const kho = await khoVoi({ nhip: ['ngay sau khi tiền về'] });
    ve(<RuotNgayDau />, kho);
    await screen.findByText('TIỀN VỀ LÀ TIÊU');
    const NET = /LÚC DỄ TIÊU QUÁ TAY/;
    const vet: number[] = [phanTramHieu()];
    const ghiVet = async (): Promise<void> => { await new Promise((r) => setTimeout(r, 30)); vet.push(phanTramHieu()); };

    fireEvent.click(within(khoiNet(NET)).getByText(CHU_NGAY_DAU.khongHan));
    fireEvent.click(await within(khoiNet(NET)).findByText('ngày tệ'));
    await screen.findByText('TIÊU ĐỂ XẢ'); await ghiVet();
    expect(vet[1]!, 'chạm một nét thì thanh LÊN').toBeGreaterThan(vet[0]!);

    fireEvent.click(within(khoiNet(NET)).getByText(CHU_NGAY_DAU.doi));
    await screen.findByText('TIỀN VỀ LÀ TIÊU'); await ghiVet();

    fireEvent.click(within(khoiNet(NET)).getByText(CHU_NGAY_DAU.khongHan));
    fireEvent.click(await within(khoiNet(NET)).findByText('cuối tháng'));
    await screen.findByText('CUỐI THÁNG BUÔNG TAY'); await ghiVet();

    for (let i = 1; i < vet.length; i++) expect(vet[i]!, `bước ${i} tụt: ${vet.join(' → ')}`).toBeGreaterThanOrEqual(vet[i - 1]!);
    expect((await docHoSo(kho)).chanDungDaCham).toEqual(['nhip']);
  });
});

describe('IV. Nút mỗi việc điều hướng đúng đích', () => {
  it('hũ → /tai-chinh/hu · luật → /tai-chinh/cam-ket?dk=... · ghi → /tai-chinh/so', async () => {
    /*
     * ⚠ Mỗi nút MỘT lần vẽ. Ngoài đời bấm nút đầu là màn đã gỡ khỏi cây; bản đầu của bài này bấm ba nút liên tiếp
     * trên cùng một lần vẽ — chỉ chạy được vì bước từng nằm trong state. Bước giờ sống trên URL (D358) ⇒ đổi đường
     * là mất `?buoc`, đúng như ngoài đời.
     */
    const CA: readonly [number, string | RegExp, string][] = [
      [1, CHU_NGAY_DAU.huNut, '/tai-chinh/hu'],
      [2, /BẬT LUẬT/, '/tai-chinh/cam-ket?dk=tien_vua_ve'],
      [3, CHU_NGAY_DAU.ghiNut, '/tai-chinh/so'],
    ];
    for (const [so, nut, dich] of CA) {
      const kho = await khoVoi({ nhip: ['ngay sau khi tiền về'] });
      const r = ve(<RuotNgayDau />, kho, '/tai-chinh/ngay-dau?buoc=viec');
      fireEvent.click(within(await screen.findByTestId(`viec-${so}`)).getByText(nut));
      expect(duong(), `việc ${so}`).toBe(dich);
      r.unmount();
    }
  });

  it('⭐⭐ BƯỚC SỐNG TRÊN URL: LÀM THEO đẩy `?buoc=viec`; mở thẳng `?buoc=viec` (đường Back từ CAM KẾT) ⇒ thấy NGAY ba việc', async () => {
    // Soi mắt 20/09 bắt được: bước nằm trong useState ⇒ Back từ CAM KẾT rơi về CHÂN DUNG, dấu ✓ vừa kiếm được nằm khuất sau một lần bấm nữa.
    const kho = await khoVoi({ nhip: ['ngày tệ'] });
    const r = ve(<RuotNgayDau />, kho);
    fireEvent.click(await screen.findByText(CHU_NGAY_DAU.neoChanDung));
    await screen.findByTestId('ds-ba-viec');
    expect(duong()).toBe('/tai-chinh/ngay-dau?buoc=viec');
    r.unmount();

    ve(<RuotNgayDau />, kho, '/tai-chinh/ngay-dau?buoc=viec');
    expect(await screen.findByTestId('ds-ba-viec')).toBeInTheDocument();
    expect(screen.queryByText(CHU_NGAY_DAU.neoChanDung), 'không bắt bấm LÀM THEO lần hai').toBeNull();
  });

  it('⭐ neo đáy KHOÁ tới khi có ít nhất một việc được làm hoặc bỏ, rồi mới bấm được', async () => {
    const kho = await khoVoi({});
    ve(<RuotNgayDau />, kho);
    fireEvent.click(await screen.findByText(CHU_NGAY_DAU.neoChanDung));
    const neo = await screen.findByText(CHU_NGAY_DAU.neoBaViec);
    expect(neo.closest('button')).toBeDisabled();

    fireEvent.click(within(await screen.findByTestId('viec-3')).getByText(CHU_NGAY_DAU.boViec));
    await waitFor(() => expect(neo.closest('button')).not.toBeDisabled());
  });
});

describe('V. Quét TU_KE_DON trên mọi chữ mới hiện cho người dùng', () => {
  it('màn chân dung sạch', async () => {
    const kho = await khoVoi({
      nhip: ['ngày tệ'], coNo: true, deu: 'đều mỗi tháng', nguonThuNhan: ['lương tháng'],
    });
    ve(<RuotNgayDau />, kho);
    await screen.findByText('TIÊU ĐỂ XẢ');
    const chu = screen.getByTestId('man-ngay-dau').textContent ?? '';
    expect(tuKeDonTrong(chu)).toEqual([]);
  });

  it('màn ba việc sạch, kể cả nhánh hai chạm (haiCham) và nhánh có nợ', async () => {
    const kho = await khoVoi({ nhip: ['đi chơi cùng bạn'], coNo: true, coNoNhan: ['trả góp'] });
    ve(<RuotNgayDau />, kho);
    fireEvent.click(await screen.findByText(CHU_NGAY_DAU.neoChanDung));
    await screen.findByTestId('ds-ba-viec');
    const chu = screen.getByTestId('man-ngay-dau').textContent ?? '';
    expect(tuKeDonTrong(chu)).toEqual([]);
  });
});

describe('VI. ⭐ Phỏng vấn xong ⇒ sang CHÂN DUNG (21/09 — đích đổi từ /tai-chinh/ngay-dau sang /tai-chinh/the)', () => {
  it('bấm XONG sau phỏng vấn đổi đường sang /tai-chinh/the', async () => {
    // ⚠ Hé dần (21/09): nút XONG chỉ hiện khi hết câu đã xử — hồ sơ trống nên "bỏ qua hết" trước.
    const kho = new KhoTrongBoNho();
    ve(<RuotPhongVan />, kho, '/tai-chinh/phong-van');
    fireEvent.click(await screen.findByText('bỏ qua hết'));
    fireEvent.click(await screen.findByText(/XONG — XEM CHÂN DUNG/));
    await waitFor(() => expect(duong()).toBe('/tai-chinh/the'));
  });
});

describe('VI-bis. ⭐⭐ SỬA CHÍN CÂU rồi quay lại chân dung — lời gần nhất của người dùng thắng (D358)', () => {
  /*
   * ⚠ 21/09 — `nhip` đổi từ nhãn DI SẢN `'ngay sau khi tiền về'` sang nhãn HIỆN HÀNH `'lúc vừa có
   * tiền'` (cùng mã chân dung `tien_ve` / điều kiện luật `tien_vua_ve` — xem `MA_THEO_NHIP` ở
   * `chan_dung.ts`, `THEO_NHIP` ở `cam_ket.ts`). Nhãn cũ KHÔNG còn nằm trong `CAU_PV` (chỉ còn sống
   * như khoá tra bảng cho hồ sơ cũ), nên không còn CHIP nào để bấm mang đúng chữ đó nữa — ba bài dưới
   * đây cần mở lại/đổi câu 6 bằng chạm thật.
   */
  const GOC: HoSo = { nhip: ['lúc vừa có tiền'], chanDungNhip: 'ngày tệ', chanDungBac: ['nhip'], chanDungDaCham: ['nhip'] };

  it('mở phỏng vấn rồi bấm XONG (sau khi bỏ qua hết) mà KHÔNG đổi câu nào đã có ⇒ chip tự chọn ở chân dung CÒN NGUYÊN', async () => {
    /*
     * ⚠ Hé dần (21/09): GOC chỉ có câu 6 (`nhip`) trả lời sẵn — tám câu còn lại hiện TRỐNG, mở dần
     * từng câu một, và nút XONG chỉ hiện khi cả tám đã xử. Đợi 40ms cho lớp điền sẵn (từ hồ sơ cũ)
     * kịp chạy TRƯỚC khi chạm gì — nó chỉ chạy ĐÚNG một lần, và chạm sớm hơn nó thì khoá cờ mất luôn
     * đáp án câu 6 (xem `daDien` ở `PhongVan.tsx`) — rồi "bỏ qua hết" cho bảy câu còn lại.
     */
    const kho = await khoVoi(GOC);
    ve(<RuotPhongVan />, kho, '/tai-chinh/phong-van');
    await new Promise((r) => setTimeout(r, 40));
    fireEvent.click(await screen.findByText('bỏ qua hết'));
    await screen.findByText(/XONG — XEM CHÂN DUNG \(1\/8\)/); // mốc ĐIỀN SẴN XONG: đúng một câu (nhip) đã có sẵn.
    fireEvent.click(screen.getByText(/XONG — XEM CHÂN DUNG/));
    await waitFor(() => expect(duong()).toBe('/tai-chinh/the'));
    const h = await docHoSo(kho);
    expect([h.chanDungNhip, h.chanDungBac]).toEqual(['ngày tệ', ['nhip']]);
  });

  it('⭐⭐⭐ bấm XONG TRƯỚC khi hồ sơ nạp xong ⇒ hồ sơ trong kho GIỮ ĐỦ những câu vừa nộp lại (trước D358: bị ghi `{}` đè mất trọn)', async () => {
    /*
     * Bài này ra đời vì chính bản đầu của hai bài bên cạnh: tôi chờ nhầm mốc, bấm XONG khi màn còn cầm hồ sơ `{}`,
     * và kho đọc lại ra `{}` — sáu câu phỏng vấn, khối đã bỏ, dấu vết chân dung bay sạch. `xong()` từng dựng bản ghi
     * từ `hoSoCu` của state. Giữ LƯỢT ĐỌC ĐẦU (của `useHoSo`) lại để thế kẹt ấy là tất định, không phụ thuộc máy.
     *
     * ⚠⚠ HÉ DẦN ĐỔI HẲN CÁCH DỰNG BÀI NÀY (21/09). Nút XONG giờ CHỈ hiện khi đủ tám câu đã xử — mà lớp điền sẵn từ
     * hồ sơ cũ (`daDien`) lại CHỈ chạy sau khi `coHoSo` lên `true`, đúng lúc lượt đọc đầu tiên đang CỐ Ý bị giữ lại
     * ở đây. Không còn đường "bấm XONG với 0 câu đã xử" (bản cũ luôn hiện nút XONG bất kể còn câu nào). Bài này giờ
     * đi BẰNG TAY qua đủ tám câu, LẶP đúng những gì DAY đã có (deu · co_no · muc_tieu · nhip) và bỏ qua bốn câu DAY
     * chưa từng trả lời — TRONG LÚC lượt đọc hồ sơ đầu tiên vẫn còn bị giữ. Cái được canh KHÔNG đổi: `xong()` phải
     * đọc THẲNG từ kho (không phải từ state `{}` của màn) để ghép đúng bản DAY thật đang nằm trong kho.
     *
     * ⚠ `loTrinhBo` phải còn nguyên sau lượt nộp lặp lại — xem khẳng định cuối bài.
     */
    const DAY: HoSo = { ...GOC, deu: 'thất thường', coNo: false, coNoNhan: ['không có'], mucTieu: ['quỹ dự phòng'], loTrinhBo: ['chuyến đi'], ngayDauBo: [2] };
    const kho = await khoVoi(DAY);
    let tha: () => void = () => undefined;
    const cho = new Promise<void>((r) => { tha = r; });
    const docGoc = kho.doc.bind(kho);
    let lan = 0;
    (kho as unknown as { doc: typeof kho.doc }).doc = (async (ngan: never, id: never) => { if (lan++ === 0) await cho; return docGoc(ngan, id); }) as typeof kho.doc;
    ve(<RuotPhongVan />, kho, '/tai-chinh/phong-van');

    // Lượt đọc hồ sơ đầu tiên (`useHoSo`) còn bị giữ ⇒ `coHoSo` = false ⇒ lớp điền sẵn CHƯA chạy — đi bằng tay,
    // LẶP đúng những gì DAY đã có; bốn câu DAY chưa từng trả lời thì bỏ qua.
    fireEvent.click(await screen.findByText('bỏ qua câu này'));                     // 1: nguon_thu — DAY chưa có
    fireEvent.click(await screen.findByRole('button', { name: 'thất thường' }));    // 2: deu — khớp DAY (tự thu, một lựa chọn)
    fireEvent.click(await screen.findByRole('button', { name: 'không có' }));       // 3: co_no — khớp DAY (ẩn no_so)
    fireEvent.click(await screen.findByText('✓ XONG (1)'));                         // đóng câu NHIỀU (co_no)
    fireEvent.click(await screen.findByRole('button', { name: 'quỹ dự phòng' }));   // 4: muc_tieu — khớp DAY
    fireEvent.click(await screen.findByText('✓ XONG (1)'));                         // đóng câu NHIỀU (muc_tieu)
    fireEvent.click(await screen.findByText('bỏ qua câu này'));                     // 5: luc_tien_ve — DAY chưa có
    fireEvent.click(await screen.findByText('bỏ qua câu này'));                     // 6: sau_khi_tieu — DAY chưa có
    fireEvent.click(await screen.findByText('bỏ qua câu này'));                     // 7: dau_thang — DAY chưa có
    fireEvent.click(await screen.findByRole('button', { name: 'lúc vừa có tiền' })); // 8: nhip — khớp DAY
    fireEvent.click(await screen.findByText('✓ XONG (1)'));                         // đóng câu NHIỀU (nhip)

    fireEvent.click(await screen.findByText(/XONG — XEM CHÂN DUNG/));
    // Thả NGAY SAU cú bấm: bản cũ dựng bản ghi ĐỒNG BỘ trong `xong()` (trước `await` đầu tiên) nên `{}` đã bị chốt ở
    // đúng dòng trên; còn giữ tiếp thì lượt nạp lại sau khi ghi (`invalidateQueries`) đứng chờ mãi lượt đọc đang treo.
    tha();
    await waitFor(() => expect(duong()).toBe('/tai-chinh/the'));
    /*
     * ⭐⭐ `loTrinhBo` PHẢI SỐNG SÓT. Bài này từng phải loại nó ra vì một bug thật (hé dần làm
     * `'muc_tieu' in sach` luôn đúng ⇒ xoá ở mọi lượt nộp). Bug đã sửa: `PhongVan.xong` nay SO
     * GIÁ TRỊ câu 4 chứ không so sự có mặt của khoá. Lặp lại y nguyên đáp án cũ = không nói
     * khác đi = không được đụng vào khối người dùng đã bấm BỎ trên lộ trình.
     */
    expect(await docHoSo(kho)).toEqual(DAY);
  });

  it('⭐⭐ ĐỔI câu 6 ⇒ `chanDungNhip` + dấu bác `nhip` được dọn, `chanDungDaCham` GIỮ (thanh không tụt), và chân dung đọc câu 6 MỚI', async () => {
    const kho = await khoVoi(GOC);
    const r = ve(<RuotPhongVan />, kho, '/tai-chinh/phong-van');
    await new Promise((r2) => setTimeout(r2, 40));   // lớp điền sẵn (từ hồ sơ) kịp chạy trước khi ta chạm gì
    fireEvent.click(await screen.findByText('bỏ qua hết'));                    // 7 câu còn lại: bỏ qua hết
    await screen.findByText(/XONG — XEM CHÂN DUNG \(1\/8\)/);
    fireEvent.click(screen.getByText(/Lúc nào bạn dễ tiêu quá tay/));          // mở lại câu 6 đang thu gọn
    fireEvent.click(await screen.findByRole('button', { name: 'lúc vừa có tiền' })); // bỏ chip cũ
    fireEvent.click(screen.getByRole('button', { name: 'cuối tháng' }));         // chọn chip mới
    fireEvent.click(screen.getByText('✓ XONG (1)'));                             // đóng lại câu NHIỀU (nhip)
    fireEvent.click(screen.getByText(/XONG — XEM CHÂN DUNG/));
    await waitFor(() => expect(duong()).toBe('/tai-chinh/the'));
    const h = await docHoSo(kho);
    expect(h.nhip).toEqual(['cuối tháng']);
    expect(h.chanDungNhip).toBeUndefined();
    expect(h.chanDungBac ?? []).not.toContain('nhip');
    expect(h.chanDungDaCham).toEqual(['nhip']);
    r.unmount();

    ve(<RuotNgayDau />, kho);
    expect(await screen.findByText('CUỐI THÁNG BUÔNG TAY'), 'trước D358: vẫn là TIÊU ĐỂ XẢ của chip cũ').toBeInTheDocument();
  });
});

describe('VII. Trạng thái THẬT của ba việc phản ánh vào hồ sơ khi rời màn', () => {
  it('BỎ việc rồi rời màn — hồ sơ ghi lại đúng chỉ số đã bỏ', async () => {
    const kho = await khoVoi({});
    ve(<RuotNgayDau />, kho);
    fireEvent.click(await screen.findByText(CHU_NGAY_DAU.neoChanDung));
    const viec1 = await screen.findByTestId('viec-1');
    fireEvent.click(within(viec1).getByText(CHU_NGAY_DAU.boViec));
    await waitFor(async () => {
      const h = await docHoSo(kho);
      expect(h.ngayDauBo).toEqual([0]);
    });
  });
});

describe('VIII. ⭐⭐ (D360) HAI CÚ CHẠM SÁT NHAU không nuốt nhau — phép sửa hồ sơ XẾP HÀNG', () => {
  /*
   * Đọc-lại-từ-kho (D358) chặn được cú ghi dựng từ state, nhưng MỘT MÌNH nó chưa chặn được hai phép sửa phát ra sát
   * nhau: kho không có transaction đọc-rồi-ghi, nên cả hai lượt cùng ĐỌC trước khi lượt nào kịp GHI, và lượt ghi sau
   * nuốt lượt ghi trước. Hai cú chạm trong CÙNG một nhịp (không `await` nào chen giữa) là mô hình tất định của "chạm
   * nhanh hơn một lượt đọc–ghi IndexedDB". Luật xếp hàng ở `ho_so.ts` §`suaHoSo`; bài thuần: `pfm_ho_so_sua.test.ts`.
   */
  it('BỎ việc 1 rồi BỎ việc 2 trong cùng một nhịp ⇒ hồ sơ ghi ĐỦ cả hai', async () => {
    const kho = await khoVoi({});
    ve(<RuotNgayDau />, kho, '/tai-chinh/ngay-dau?buoc=viec');
    const bo1 = within(await screen.findByTestId('viec-1')).getByText(CHU_NGAY_DAU.boViec);
    const bo2 = within(screen.getByTestId('viec-2')).getByText(CHU_NGAY_DAU.boViec);
    fireEvent.click(bo1);
    fireEvent.click(bo2);
    await waitFor(async () => {
      expect([...((await docHoSo(kho)).ngayDauBo ?? [])].sort()).toEqual([0, 1]);
    });
  });

  it('bác nét TIỀN VÀO rồi bác nét NGUỒN THU trong cùng một nhịp ⇒ cả hai dấu bác đều còn', async () => {
    const kho = await khoVoi({ nhip: ['ngày tệ'], deu: 'thất thường', nguonThuNhan: ['lương tháng'] });
    ve(<RuotNgayDau />, kho);
    await screen.findByText('TIÊU ĐỂ XẢ');
    const NET_DEU = new RegExp(`${CHU_NGAY_DAU.netDeuTen} · ${CHU_NGAY_DAU.netDeuCau}`);
    const NET_NGUON = new RegExp(`${CHU_NGAY_DAU.netNguonTen} · ${CHU_NGAY_DAU.netNguonCau}`);
    const bacDeu = within(khoiNet(NET_DEU)).getByText(CHU_NGAY_DAU.khongHan);
    const bacNguon = within(khoiNet(NET_NGUON)).getByText(CHU_NGAY_DAU.khongHan);
    fireEvent.click(bacDeu);
    fireEvent.click(bacNguon);
    await waitFor(async () => {
      expect([...((await docHoSo(kho)).chanDungBac ?? [])].sort()).toEqual(['deu', 'nguon']);
    });
    expect([...((await docHoSo(kho)).chanDungDaCham ?? [])].sort()).toEqual(['deu', 'nguon']);
  });
});

describe('IX. ⭐⭐ (D360) Cổng của màn đứng vững ở CẢ HAI cửa sổ chưa-có-hồ-sơ', () => {
  /*
   * Bài §III đã canh cửa sổ "kho mở rồi, lượt đọc đang bay". Cửa sổ THỨ HAI — kho ĐANG MỞ — thì `dangTai` TẮT
   * (`isPending && kho !== null`), nên bản cổng bằng `dangTai` vẫn vẽ chân dung "CHƯA RÕ NÉT" của hồ sơ RỖNG đúng
   * một nhịp khi mở app nguội thẳng vào màn. Ở đây provider TỰ mở kho (đường prod) và lượt mở bị giữ lại.
   */
  it('KHO CÒN ĐANG MỞ ⇒ không vẽ nút nào, không loé "CHƯA RÕ NÉT"', async () => {
    const kho = await khoVoi({ nhip: ['ngày tệ'] });
    let tha: (k: KhoPfm) => void = () => undefined;
    giaMoKho.moKho = () => new Promise<KhoPfm>((r) => { tha = r; });
    stubFetch([['/auth/me', { status: 200, body: ME_ONBOARDED }]]);   // D603: provider mở kho của ĐÚNG người ⇒ cần biết là ai
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/tai-chinh/ngay-dau']}>
          <KhoProvider><RuotNgayDau /></KhoProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 40));
    const man = screen.getByTestId('man-ngay-dau');
    expect(man.getAttribute('aria-busy')).toBe('true');
    expect(within(man).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText('CHƯA RÕ NÉT'), 'chân dung của hồ sơ RỖNG loé lên = kể sai chuyện người dùng').toBeNull();
    tha(kho);
    expect(await screen.findByText('TIÊU ĐỂ XẢ')).toBeInTheDocument();
  });

  it('⭐ hồ sơ ĐÃ CÓ trong cache ⇒ vẽ NGAY ở nhịp đầu — cổng không làm nháy khung', () => {
    giaMoKho.moKho = () => new Promise<KhoPfm>(() => undefined);
    stubFetch([['/auth/me', { status: 200, body: ME_ONBOARDED }]]);   // D603: provider mở kho của ĐÚNG người ⇒ cần biết là ai
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(KHOA_PFM.hoSo, { nhip: ['ngày tệ'] } satisfies HoSo);
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/tai-chinh/ngay-dau']}>
          <KhoProvider><RuotNgayDau /></KhoProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId('man-ngay-dau').getAttribute('aria-busy'), 'khung chờ hiện dù hồ sơ có sẵn').toBeNull();
    expect(screen.getByText('TIÊU ĐỂ XẢ')).toBeInTheDocument();
  });
});

describe('X. ⭐⭐ (D360) PHỎNG VẤN mở NGUỘI vẫn điền sẵn đúng lời khai cũ', () => {
  it('kho đang mở lúc màn dựng ⇒ câu đã trả lời KHÔNG hiện trống; chip đã chạm hiện lại (sau khi đi hết hé dần)', async () => {
    /*
     * Lớp điền sẵn chạy đúng MỘT lần (cờ `daDien`, D324). Bản cũ mở cổng bằng `!dangTai`, mà cờ ấy TẮT trong lúc kho
     * đang mở ⇒ lượt điền duy nhất chạy trên `hoSoCu = {}` rồi KHOÁ: người vào ⚙ › SỬA CHÍN CÂU thấy cả chín câu trống,
     * tưởng app quên hết lời khai. Không mất dữ liệu (`xong()` trộn vào bản của kho) nhưng là một lời nói dối.
     *
     * ⚠ Bỏ `khung` khỏi dữ liệu mẫu (21/09): câu đó KHÔNG còn ở màn phỏng vấn (`lo_trinh.ts` hỏi nó, lúc người ta
     * đã có sổ) — giữ nó ở đây chỉ còn kiểm một trường `HoSo` không mặt trên màn này nữa.
     */
    const kho = await khoVoi({ nguonThuNhan: ['lương tháng', 'gia đình cho'], mucTieu: ['chuyến đi'] });
    let tha: (k: KhoPfm) => void = () => undefined;
    giaMoKho.moKho = () => new Promise<KhoPfm>((r) => { tha = r; });
    stubFetch([['/auth/me', { status: 200, body: ME_ONBOARDED }]]);   // D603: provider mở kho của ĐÚNG người ⇒ cần biết là ai
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/tai-chinh/phong-van']}>
          <KhoProvider><RuotPhongVan /></KhoProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 40));   // đủ để lượt điền SAI kịp chạy và khoá cờ
    tha(kho);
    /*
     * ⚠⚠ MỐC CHỜ PHẢI LÀ MỘT CHUỖI KHÔNG CHIP NÀO CÓ. Bản đầu của bài này chờ `'lương tháng'` ⇒ **XANH cả khi tiêm
     * lỗi** (mũi M18), vì đó đúng là nhãn của một CHIP câu 1 — nó có mặt ngay cả khi lớp điền sẵn chưa chạy. Đây là
     * đúng cái bẫy mà `lo_trinh_nut.test.tsx` §V đã ghi ra và tôi vẫn dẫm vào. Hai nhãn nối bằng ' · ' thì chỉ tồn
     * tại ở DÒNG THU GỌN của một câu ĐÃ có đáp án.
     */
    expect(await screen.findByText('lương tháng · gia đình cho')).toBeInTheDocument();
    /*
     * ⚠ HÉ DẦN (21/09): câu `deu` (câu 2) chưa từng được trả lời trong hồ sơ mẫu ⇒ hé dần DỪNG ở đó, và câu
     * `muc_tieu` (câu 5, ĐÃ có "chuyến đi") vẫn chưa được lộ ra — không phải vì lớp điền sẵn quên nó, mà vì màn
     * cố ý chưa cho thấy câu sau khi câu trước còn dở. "Bỏ qua hết" để lộ nốt những câu phía sau, đúng nếp
     * founder cho phép (không phải cổng thu phí).
     */
    fireEvent.click(await screen.findByText('bỏ qua hết'));
    expect(await screen.findByText('chuyến đi')).toBeInTheDocument();
  });
});

describe('XI. ⭐⭐⭐ (D360) Cú ghi HỎNG báo cho NGƯỜI DÙNG, không chỉ cho người vận hành', () => {
  it('bác một nét mà kho ghi hỏng ⇒ hiện câu báo chung, giữ khuôn ✕ + role="alert"', async () => {
    const kho = await khoVoi({ nhip: ['ngày tệ'], deu: 'thất thường' });
    ve(<RuotNgayDau />, kho);
    await screen.findByText('TIÊU ĐỂ XẢ');
    (kho as unknown as { ghi: typeof kho.ghi }).ghi = (async () => { throw new Error('ghi hỏng'); }) as typeof kho.ghi;
    const vet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const NET_DEU = new RegExp(`${CHU_NGAY_DAU.netDeuTen} · ${CHU_NGAY_DAU.netDeuCau}`);
      fireEvent.click(within(khoiNet(NET_DEU)).getByText(CHU_NGAY_DAU.khongHan));
      const bao = await screen.findByRole('alert');
      expect(bao.textContent).toContain(CHU_LOI_GHI);
      expect(bao.textContent).toContain('✕');
    } finally {
      vet.mockRestore();
    }
  });
});
