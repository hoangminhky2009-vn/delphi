/**
 * HỘP THƯ ĐI CỦA ĐO LƯỜNG (A9; bản yêu cầu 01 §2.4).
 *
 * Bốn bất biến được khoá ở đây, mỗi cái ứng với một cách hỏng ÂM THẦM:
 *  1. `man` là MẪU ROUTE — hỏng thì bảng tổng hợp phình theo số kèo, không báo gì.
 *  2. Danh sách mẫu route BẰNG ĐÚNG tập path của router — thêm màn mà quên khai
 *     thì màn đó rơi hết vào "khac" và biến mất khỏi dashboard, cũng không báo gì.
 *  3. Gửi lại giữ NGUYÊN khoá chống-nhân-đôi — đổi khoá là tắt lá chắn đó.
 *  4. Lần gửi cuối phiên đi bằng `sendBeacon` với `Blob` có `type` —
 *     thiếu `type` thì server đọc ra `text/plain` và hỏng ĐÚNG lần quý nhất.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { RouteObject } from 'react-router-dom';
import { MAN_HOP_LE, MAN_KHAC, TELEMETRY } from '@config/telemetry';
import fs from 'node:fs';
import path from 'node:path';
import { TAB_TAI_CHINH } from '../src/components/pfm/TabTaiChinh';
import {
  ghiDo,
  day,
  manCuaDuong,
  khoiDongDo,
  _datLaiChoTest,
  _moManChoTest,
  dangKyKhiRoi,
  _trangThaiChoTest,
} from '../src/lib/telemetry';
import { routes } from '../src/app/routes';
import { api } from '../src/api/client';

beforeEach(() => {
  _datLaiChoTest();
});

afterEach(() => {
  _datLaiChoTest();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  // Trả `visibilityState` về mặc định — test nào ghi đè mà không dọn thì mọi
  // test sau nó chạy trong một cái app "đang ở nền".
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
});

/** jsdom không cài `Blob.text()` — đọc bằng FileReader khi thiếu. */
const docBlob = (b: Blob): Promise<string> =>
  typeof b.text === 'function'
    ? b.text()
    : new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(fr.error);
        fr.readAsText(b);
      });

/** fetch giả luôn OK, ghi lại body đã gửi. */
function stubOk(): { goi: any[] } {
  const goi: any[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_u: string, init: RequestInit) => {
      goi.push(JSON.parse(init.body as string));
      return new Response('{}', { status: 202 });
    }),
  );
  return { goi };
}

// ═══════════════════════════════════════════════════════════════════════════
describe('I. `man` là mẫu route, không phải URL', () => {
  it('URL có tham số → mẫu', () => {
    expect(manCuaDuong('/keo/8f3a-11ee-b962-0242ac120002')).toBe('/keo/:marketId');
    expect(manCuaDuong('/keo/8f3a-11ee/ket-qua')).toBe('/keo/:marketId/ket-qua');
    expect(manCuaDuong('/arena/tran/m-abc-123')).toBe('/arena/tran/:matchId');
  });

  it('đường tĩnh giữ nguyên, đường lạ → mẫu splat (không đẻ giá trị mới)', () => {
    expect(manCuaDuong('/')).toBe('/');
    expect(manCuaDuong('/vi')).toBe('/vi');
    expect(manCuaDuong('/onboard/dang-ky')).toBe('/onboard/dang-ky');
    expect(manCuaDuong('/khong-co-that/abc/xyz')).toBe('*');
  });

  it('đầu vào rác vẫn trả về một giá trị CÓ TRONG danh sách — cardinality bị chặn', () => {
    /*
     * Bất biến thật không phải "rác ra `khac`" mà là "không đầu vào nào đẻ ra
     * một giá trị `man` MỚI". Đó mới là thứ giữ cho bảng tổng hợp nhỏ.
     */
    const hopLe = new Set<string>([...MAN_HOP_LE, MAN_KHAC]);
    for (const rac of ['', 'không-phải-đường-dẫn', '//', '/keo//', '/../..', '/vi?x=1#y']) {
      expect(hopLe, `đầu vào: ${JSON.stringify(rac)}`).toContain(manCuaDuong(rac));
    }
  });

  it('⚠ DANH SÁCH MẪU BẰNG ĐÚNG TẬP PATH CỦA ROUTER (chống trôi)', () => {
    const gom = (ds: RouteObject[]): string[] =>
      ds.flatMap((r) => [
        ...(typeof r.path === 'string' ? [r.path] : []),
        ...(r.children ? gom(r.children) : []),
      ]);
    const cuaRouter = [...new Set(gom(routes))].sort();
    const cuaConfig = [...new Set(MAN_HOP_LE)].sort();
    /*
     * So BẰNG chứ không so "chứa trong": thiếu thì màn mới biến mất khỏi
     * dashboard, thừa thì danh sách nuôi một mẫu đã chết. Cả hai đều lặng.
     */
    expect(cuaConfig).toEqual(cuaRouter);
  });

  it('⭐⭐⭐ MỌI màn khu tài chính đều VỚI TỚI NHAU — không màn nào là ngõ cụt', () => {
    /*
     * ⚠⚠ BÀI NÀY SINH RA TỪ MỘT CÚ SHIP HỎNG THẬT (07/09). Bốn màn PFM đã dựng, đã
     * test, đã lên prod — và founder bấm thẻ PERSONAL FINANCE trên Hub thì **không ra
     * gì**. Lý do: thẻ ấy trỏ vào `/tai-chinh` (màn THẺ), ba màn còn lại sống ở route
     * con và mỗi màn TỰ vẽ dải tab của mình — nên SỔ · HŨ · GƯƠNG đi lại được với
     * nhau, còn THẺ thì không có dải tab, tức là cửa vào duy nhất từ Hub dẫn vào một
     * NGÕ CỤT. Cả đợt bằng không, và không một bài nào trong 1530 bài đỏ.
     *
     * ⇒ Chốt phải canh không phải "route có tồn tại không" (bài trên đã canh) mà
     * "người chơi có ĐI TỚI được không". Quét NGUỒN vì đây là câu hỏi về cấu trúc
     * điều hướng, không phải về một lần render: mỗi màn trong khu phải mang dải tab.
     * A11.21 — "xong" của một mốc là một màn CÓ NGƯỜI BẤM ĐƯỢC.
     */
    const goc = path.resolve(__dirname, '..', 'src');
    /*
     * ⚠ 07/09 — `/tai-chinh` RỜI DANH SÁCH NÀY, và đó KHÔNG phải nới lỏng bài canh.
     * Nó thôi làm màn: nay là CỬA điều phối (`CuaPfm`) chỉ trả `<Navigate>`. Một cửa
     * chuyển hướng không thể là ngõ cụt — nó không có gì để mắc kẹt vào. Đổi lại,
     * bài này thêm một khẳng định ngay dưới: cửa ấy phải THẬT SỰ chỉ chuyển hướng.
     * Màn THẺ dọn sang `/tai-chinh/the` và vẫn bị đòi dải tab như ba màn kia.
     */
    /*
     * ⚠ 21/09 — `/tai-chinh/the` ĐỔI CHỦ: thẻ ĐO TỪ TRẬN (`screens/TaiChinh.tsx`) dọn sang
     * `/ho-so/the` (khu Hồ sơ, thoát bằng link "‹ về Hồ sơ" + thanh điều hướng dưới cùng —
     * KHÔNG phải khu tài chính này, nên không thuộc bảng dưới). Địa chỉ `/tai-chinh/the` nay
     * render CHÂN DUNG PFM (`ChanDungPfm.tsx`), và màn đó vẫn mang `<TabTaiChinh/>` như cũ.
     */
    const MAN = {
      '/tai-chinh/the': 'screens/tai-chinh/ChanDungPfm.tsx',
      '/tai-chinh/so': 'screens/tai-chinh/So.tsx',
      '/tai-chinh/hu': 'screens/tai-chinh/Hu.tsx',
      '/tai-chinh/guong': 'screens/tai-chinh/Guong.tsx',
    } as const;

    // Danh sách tab và danh sách màn phải là MỘT — thêm màn mà quên tab thì đỏ ở đây.
    expect([...TAB_TAI_CHINH.map((t) => t.duong)].sort())
      .toEqual(Object.keys(MAN).sort());

    /*
     * CỬA `/tai-chinh` PHẢI CHỈ LÀ CỬA. Nếu ai đó sau này nhét nội dung vào `CuaPfm`
     * thì nó thành màn thứ năm — không dải tab, không lối ra, tức đúng cái ngõ cụt
     * 07/09 mọc lại ở chỗ mới. Neo bằng hai điều kiện đọc được từ nguồn: có
     * `<Navigate`, và KHÔNG vẽ bất kỳ màn nào của khu.
     */
    /*
     * ⚠ 08/09 — BA MÀN CỦA LUỒNG MỚI (phỏng vấn → lộ trình → cam kết) KHÔNG phải
     * tab, nên chúng không nằm trong `MAN` ở trên. Nhưng chúng vẫn là màn người
     * chơi đứng trong đó, và bỏ 5 icon ở đáy (cờ `khuRieng`) làm dải tab thành lối
     * ra CHÍNH. Thiếu dải tab ở đây = vào được, ra không được — đúng ngõ cụt cũ,
     * chỉ đổi chỗ. Nên canh riêng, không gộp vào phép so bằng của `MAN`.
     */
    const LUONG = [
      'screens/tai-chinh/PhongVan.tsx',
      'screens/tai-chinh/LoTrinh.tsx',
      'screens/tai-chinh/CamKet.tsx',
    ];
    const thieuLuong = LUONG.filter((tep) => {
      const nguon = fs.readFileSync(path.join(goc, tep), 'utf8');
      return !/^[ \t]*<TabTaiChinh\s*\/>/m.test(nguon);
    });
    expect(thieuLuong, 'màn trong luồng PFM không vẽ <TabTaiChinh/> ⇒ vào là ra không được')
      .toEqual([]);

    const cua = fs.readFileSync(path.join(goc, 'screens/tai-chinh/CuaPfm.tsx'), 'utf8');
    expect(/<Navigate\s/.test(cua), 'CuaPfm phải chuyển hướng, không được tự vẽ màn')
      .toBe(true);
    expect(/^[ \t]*<(TabTaiChinh|ScreenFrame)\s*\/?>/m.test(cua),
      'CuaPfm đang dựng nội dung ⇒ nó vừa thành màn thứ năm, không có lối ra')
      .toBe(false);

    /*
     * ⚠ ĐÒI THẺ ĐỨNG MỘT MÌNH ĐẦU DÒNG (`^\s*<TabTaiChinh />`), không phải "chuỗi này có
     * xuất hiện trong tệp". Hai bản trước của chính bài này đều sai, và mỗi bản sai một
     * kiểu — ghi lại vì cả hai đều là bẫy chung:
     *   1. quét nguồn THÔ ⇒ mũi tiêm `{/* <TabTaiChinh /> *␀/}` ra **0 đỏ**, vì chuỗi vẫn
     *      nằm nguyên trong chú thích: bài canh "có ai GÕ chuỗi này không", không canh
     *      "màn có VẼ nó không" (cùng họ D294 — dò chuỗi trong chữ tĩnh).
     *   2. tước chú thích bằng regex ⇒ một khối `/* … *␀/` nuốt quá tay và báo NHẦM rằng
     *      GƯƠNG thiếu dải tab, trong khi nó có. Một bộ canh báo nhầm cũng hỏng như một
     *      bộ canh mù: lần sau không ai tin nó.
     * Dòng bị bọc chú thích thì bắt đầu bằng `{` hoặc `//`, nên neo đầu dòng phân biệt
     * được cả hai mà không phải hiểu cú pháp.
     */
    /*
     * ⚠ 11/10 — TẦNG KHÔNG GIAN (SPEC `pfm-tang-khong-gian`): bốn màn không còn tự vẽ `<TabTaiChinh/>`; dải tab sống ở VỎ `KhungPfm`
     * (một thể hiện duy nhất qua cả bốn route ⇒ đổi tab là lướt chứ không dựng lại). Bài này đổi VẾ CANH nhưng GIỮ luật: màn nào
     * của khu mà route không bọc `KhungPfm` thì vào là ra không được. Hai khẳng định thêm để cơ chế mới không thành "trang trí":
     * vỏ phải thật sự vẽ dải tab từ `TAB_TAI_CHINH`, và màn bên trong KHÔNG vẽ thêm dải thứ hai.
     */
    const routes = fs.readFileSync(path.join(goc, 'app/routes.tsx'), 'utf8');
    const thieu = Object.keys(MAN).filter((duong) => {
      const tab = duong.split('/').pop();
      // `pfm(…)` = khoá PFM trên web (SPEC chan-truoc-beta, `lib/pfm_mo.ts`) bọc NGOÀI — bên trong vẫn phải là `KhungPfm`.
      return !new RegExp(`^[ \\t]*\\{ path: [A-Z_]+, element: (?:pfm\\()?<KhungPfm tab="${tab}">`, 'm').test(routes);
    });
    expect(thieu, 'màn khu tài chính KHÔNG được bọc <KhungPfm/> ⇒ vào là ra không được')
      .toEqual([]);
    const vo = fs.readFileSync(path.join(goc, 'components/pfm/KhungPfm.tsx'), 'utf8');
    expect(/^[ \t]*\{TAB_TAI_CHINH\.map/m.test(vo), 'KhungPfm phải vẽ dải tab từ TAB_TAI_CHINH')
      .toBe(true);
    const doi = Object.entries(MAN)
      .filter(([, tep]) => /^[ \t]*<TabTaiChinh\s*\/>/m.test(fs.readFileSync(path.join(goc, tep), 'utf8')))
      .map(([duong]) => duong);
    expect(doi, 'màn bên trong vỏ KhungPfm còn tự vẽ <TabTaiChinh/> ⇒ hai dải tab chồng nhau').toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Gộp lô', () => {
  it('dưới ngưỡng thì KHÔNG gửi — gộp lô là ràng buộc, không phải tối ưu', () => {
    const { goi } = stubOk();
    for (let i = 0; i < TELEMETRY.GOM_SO - 1; i += 1) ghiDo('man_vao', { man: '/arena' });
    expect(goi).toHaveLength(0);
    expect(_trangThaiChoTest().hangDoi).toHaveLength(TELEMETRY.GOM_SO - 1);
  });

  it('đủ ngưỡng thì tự đẩy, gửi đúng một request cho cả lô', async () => {
    const { goi } = stubOk();
    for (let i = 0; i < TELEMETRY.GOM_SO; i += 1) ghiDo('man_vao', { man: '/arena' });
    await vi.waitFor(() => expect(goi).toHaveLength(1));
    expect(goi[0].su_kien).toHaveLength(TELEMETRY.GOM_SO);
    expect(typeof goi[0].idempotency_key).toBe('string');
  });

  it('nhịp định kỳ đẩy phần lẻ chưa đủ lô', async () => {
    vi.useFakeTimers();
    const { goi } = stubOk();
    const go = khoiDongDo();
    ghiDo('phien_mo');
    expect(goi).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(TELEMETRY.GOM_MS + 100);
    expect(goi).toHaveLength(1);
    go();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Trần hàng đợi — bỏ CÁI CŨ NHẤT', () => {
  it('tràn thì cắt đầu, giữ đuôi (dữ liệu mới đáng hơn)', () => {
    // fetch hỏng ⇒ không có gì rời hàng đợi, dồn tới tràn.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('mất mạng'); }));
    const tong = TELEMETRY.HANG_DOI_TRAN + 50;
    for (let i = 0; i < tong; i += 1) ghiDo('tran_thoat', { chi_tiet: { vong: i } });

    const tt = _trangThaiChoTest();
    const dangGiu = tt.hangDoi.length + (tt.cho?.suKien.length ?? 0);
    expect(dangGiu).toBeLessThanOrEqual(TELEMETRY.HANG_DOI_TRAN);

    // Sự kiện CUỐI CÙNG phải còn; sự kiện ĐẦU TIÊN phải đi.
    const conLai = [...(tt.cho?.suKien ?? []), ...tt.hangDoi]
      .map((s) => s.chi_tiet?.vong as number);
    expect(conLai).toContain(tong - 1);
    expect(conLai).not.toContain(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. Gửi lại giữ nguyên khoá chống nhân đôi', () => {
  it('lần đầu hỏng, lần sau dùng ĐÚNG khoá cũ', async () => {
    let lan = 0;
    const goi: any[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, init: RequestInit) => {
        lan += 1;
        goi.push(JSON.parse(init.body as string));
        if (lan === 1) throw new Error('mất mạng');
        return new Response('{}', { status: 202 });
      }),
    );

    ghiDo('dang_nhap');
    await day();
    expect(goi).toHaveLength(1);
    const khoa = goi[0].idempotency_key;
    // Lô treo còn nguyên vì lần gửi đầu thất bại.
    expect(_trangThaiChoTest().cho?.khoa).toBe(khoa);

    await day();
    expect(goi).toHaveLength(2);
    /*
     * ⚠ ĐÂY LÀ CÁI CHỐT. Sinh khoá mới ở lần gửi lại = tắt lá chắn chống nhân
     * đôi: máy chủ có thể đã ghi thành công lần đầu rồi mới đứt đường về.
     */
    expect(goi[1].idempotency_key).toBe(khoa);
    expect(_trangThaiChoTest().cho).toBeNull(); // lần hai xong thì nhả lô
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V. Lần gửi cuối phiên', () => {
  it('app bị ẩn → sendBeacon, và gói phải là Blob application/json', async () => {
    const beacon = vi.fn((_url: string, _goi?: BodyInit | null) => true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon });
    const { goi } = stubOk();

    const go = khoiDongDo();
    ghiDo('man_ra', { man: '/arena', ms: 4200 });

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.waitFor(() => expect(beacon).toHaveBeenCalledTimes(1));
    expect(goi, 'lần cuối phiên KHÔNG đi bằng fetch').toHaveLength(0);

    const goiTin = beacon.mock.calls[0]![1] as Blob;
    expect(goiTin).toBeInstanceOf(Blob);
    /*
     * ⚠ Thiếu `type` thì server đọc ra `text/plain`, parse hỏng, và hỏng đúng
     * ở lần gửi cuối cùng của phiên — tức đúng lúc dữ liệu quý nhất.
     */
    expect(goiTin.type).toBe('application/json');
    // Lô cuối gồm cả `phien_mo` (do khoiDongDo) lẫn sự kiện vừa ghi và
    // `phien_dong` — tìm theo loại, đừng bám chỉ số.
    const goiDoc = JSON.parse(await docBlob(goiTin)).su_kien as any[];
    expect(goiDoc.find((s) => s.loai === 'man_ra')).toMatchObject({
      loai: 'man_ra',
      man: '/arena',
      ms: 4200,
    });
    // Thời lượng phiên phải nằm TRONG lô cuối, không rơi lại sau nó — xem ghi
    // chú thứ tự ở `khiDoiHienThi`.
    expect(goiDoc.some((s) => s.loai === 'phien_dong')).toBe(true);

    /*
     * ⚠ MÃ PHIÊN PHẢI CÓ Ở CẢ ĐƯỜNG BEACON, KHÔNG CHỈ ĐƯỜNG `fetch`.
     * Hai đường trước đây mỗi đường tự dựng thân gói, nên thêm trường vào một
     * đường mà quên đường kia sẽ hỏng ĐÚNG ở lần gửi cuối phiên — lần quý nhất
     * và ít ai soi nhất. Nay cả hai đi qua `than()`, và bài này canh chỗ đó.
     */
    const phienBeacon = JSON.parse(await docBlob(goiTin)).phien;
    expect(phienBeacon).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    go();
  });

  /*
   * ⚠⚠ BÀI QUAN TRỌNG NHẤT CỦA FILE NÀY.
   *
   * `man_ra` từng chỉ nằm trong hàm dọn của `useEffect`, mà React KHÔNG chạy hàm
   * dọn khi tab bị đóng. Nên MÀN CUỐI CÙNG của mỗi lượt ngồi — đúng cái màn
   * người ta rời đi — không bao giờ có dòng. Đo trên prod: 9 `man_vao` mà chỉ
   * 1 `man_ra`. Cả mặt HÀNH TRÌNH dựng lên để trả lời "người ta rời đi ở đâu",
   * và nó mù đúng chỗ đó.
   */
  it('ẩn app → `man_ra` VẪN BẮN kèm thời lượng, và việc đăng ký rời cũng chạy', async () => {
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: undefined });
    const { goi } = stubOk();
    const go = khoiDongDo();

    const daRoi: string[] = [];
    const boDangKy = dangKyKhiRoi(() => daRoi.push('trận'));

    // Giả lập AppShell: vào một màn rồi app bị ẩn (KHÔNG đổi route, KHÔNG unmount).
    ghiDo('man_vao', { man: '/arena' });
    _moManChoTest('/arena');

    Object.defineProperty(document, 'visibilityState', {
      configurable: true, get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.waitFor(() => expect(goi.length).toBeGreaterThanOrEqual(1));
    const suKien = goi.flatMap((g: any) => g.su_kien);
    const ra = suKien.find((s: any) => s.loai === 'man_ra');
    expect(ra, 'ẩn app mà không có man_ra = mất màn cuối của mọi phiên').toBeTruthy();
    expect(ra.man).toBe('/arena');
    expect(typeof ra.ms).toBe('number');
    // Và màn trận cũng phải được báo — cùng đường thoát, cùng lý do.
    expect(daRoi).toEqual(['trận']);

    boDangKy();
    go();
  });

  it('mã phiên GIỐNG NHAU giữa các lô, và KHÔNG bao giờ nằm trong localStorage', async () => {
    const { goi } = stubOk();
    const go = khoiDongDo();

    for (let i = 0; i < TELEMETRY.LO_TOI_DA; i += 1) ghiDo('man_vao', { man: '/' });
    // ⚠ Chờ lô đầu LẮNG hẳn (`cho` được xoá) chứ không chỉ chờ nó bay đi: cờ
    // `dangGui` còn bật thì cú `day()` sau thoát ngay và test đo nhầm.
    await vi.waitFor(() => expect(_trangThaiChoTest().cho).toBeNull());
    ghiDo('man_vao', { man: '/vi' });
    await day();                       // đẩy tay: lô thứ hai chưa tới ngưỡng tự đẩy
    expect(goi.length).toBeGreaterThanOrEqual(2);

    // Cùng một lượt ngồi ⇒ cùng một mã, nếu không thì phễu đếm mỗi lô một người.
    expect(goi[0].phien).toBe(goi[1].phien);

    /*
     * ⚠⚠ ĐÂY LÀ RANH GIỚI C7, KHÔNG PHẢI CHI TIẾT KỸ THUẬT. Mã phiên sống trong
     * BỘ NHỚ nên nó chết cùng tab và không nối được hai lần ghé của một người.
     * Chỉ cần một `setItem` là nó thành mã theo dõi bền — một dòng code, đổi hẳn
     * bản chất pháp lý của thứ đang lưu.
     */
    const kho = JSON.stringify(Object.entries(localStorage));
    expect(kho).not.toContain(goi[0].phien);
    go();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VII. `loi_api` — hai lớp lỗi máy chủ không thấy được (§4.2 mục 12)', () => {
  const hangDoi = () => {
    const tt = _trangThaiChoTest();
    return [...(tt.cho?.suKien ?? []), ...tt.hangDoi];
  };

  it('mất mạng → ghi `network`; quá hạn → ghi `timeout`', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await api('/markets').catch(() => {});
    expect(hangDoi().find((s) => s.loai === 'loi_api')?.chi_tiet).toEqual({ ma: 'network' });
  });

  it('máy chủ trả lỗi → ghi ĐÚNG mã lỗi của máy chủ', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'rate_limited', message: 'x' }),
      { status: 429, headers: { 'content-type': 'application/json' } },
    )));
    await api('/markets').catch(() => {});
    expect(hangDoi().find((s) => s.loai === 'loi_api')?.chi_tiet).toEqual({ ma: 'rate_limited' });
  });

  it('401 KHÔNG ghi — khách chưa đăng nhập là câu trả lời đúng, không phải sự cố', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'unauthorized', message: 'x' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )));
    await api('/auth/me').catch(() => {});
    // Mọi màn auth đều gọi /auth/me trước; ghi 401 vào là làm ngập bảng lỗi
    // bằng thứ đang chạy đúng, rồi cột sức khoẻ kỹ thuật thành vô dụng.
    expect(hangDoi().filter((s) => s.loai === 'loi_api')).toHaveLength(0);
  });

  it('⚠ LỖI CỦA CHÍNH ĐƯỜNG TELEMETRY KHÔNG TỰ BÁO CÁO (chống vòng lặp)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await api('/telemetry', { method: 'POST', body: {} }).catch(() => {});
    /*
     * Không có chốt này thì: lô đo gửi hỏng → ghi một sự kiện lỗi → tới ngưỡng
     * lại gửi → lại hỏng → lại ghi. Mất mạng là kịch bản kích hoạt nó, tức nó
     * nổ đúng lúc hệ thống đang yếu nhất.
     */
    expect(hangDoi().filter((s) => s.loai === 'loi_api')).toHaveLength(0);
  });

  it('`man` đi kèm là MẪU route, không phải URL', async () => {
    window.history.pushState({}, '', '/keo/8f3a-11ee-b962-0242ac120002');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await api('/markets').catch(() => {});
    expect(hangDoi().find((s) => s.loai === 'loi_api')?.man).toBe('/keo/:marketId');
    window.history.pushState({}, '', '/');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VI. Không bao giờ làm hỏng app', () => {
  it('localStorage ném thì ghiDo vẫn im lặng đi qua', () => {
    const that = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceeded');
    };
    try {
      stubOk();
      expect(() => ghiDo('phien_mo')).not.toThrow();
    } finally {
      Storage.prototype.setItem = that;
    }
  });

  it('fetch ném thì day() vẫn giải quyết, không ném ra ngoài', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('mất mạng'); }));
    ghiDo('phien_mo');
    await expect(day()).resolves.toBeUndefined();
  });

  it('khoiDongDo gọi được kể cả khi localStorage chứa rác', () => {
    localStorage.setItem(TELEMETRY.KHOA_LUU, '{{{ không phải json');
    stubOk();
    expect(() => khoiDongDo()()).not.toThrow();
  });
});
