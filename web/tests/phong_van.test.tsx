/**
 * PFM — MÀN PHỎNG VẤN CỬA VÀO (08/09; nâng SÁU→CHÍN câu 21/09, bỏ câu `khung`).
 *
 * Năm chỗ bài này canh, và cả năm đều hỏng IM LẶNG nếu không có ai canh:
 *  1. `locHoSo` dựng object MỚI và chỉ chép khoá nó biết ⇒ quên chép các câu
 *     chỉ-ở-lại-máy là mỗi lần đọc lại XOÁ SẠCH câu trả lời, không lỗi, không log,
 *     và người dùng thấy màn hỏi lại câu họ vừa trả lời.
 *  2. Câu "nguồn thu" cho chọn NHIỀU nhưng `ctx_nguon_thu` chỉ nhận MỘT mã. Chọn
 *     bừa một cái là BỊA dữ liệu cho đúng trục mà `ho_so.ts` gọi là "trục cohort
 *     mạnh nhất" — phải để trống, và phải có bài giữ điều đó.
 *  3. Cửa `/tai-chinh` phải đưa người MỚI vào phỏng vấn trước cả thẻ.
 *  4. Câu `no_so` chỉ hiện khi `co_no` đang có nợ thật — bỏ chip nợ về "không có"
 *     phải xoá luôn `noSo` cũ (`khoaCauAn`), không thì nó sống sót im lặng.
 *  5. Nhãn đáp án dài quá 18 ký tự tràn thành chip xám (trừ câu `no_so`, cố ý dài).
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KhoProvider } from '../src/pfm/dung_kho';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { docHoSo, ghiHoSo, locHoSo, type HoSo } from '../src/pfm/ho_so.js';
import {
  CAU_PV, KHOA_THEO_CAU, cauDangHien, coNoTuNhan, gameDienSan, hoSoTuTraLoi, khoaCauAn,
  nguonThuTuNhan, traLoiTuHoSo,
} from '../src/pfm/phong_van.js';
import { RuotPhongVan } from '../src/screens/tai-chinh/PhongVan';
import { NGUONG_TINH_CACH } from '@server/holdem/insight';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';

/*
 * SPEC chan-truoc-beta — khu Tài chính đang KHOÁ trên web (`lib/pfm_mo.ts`). Tệp này đo khu ấy ở trạng thái MỞ — mã của trạng thái
 * mở vẫn còn nguyên cho ngày mở lại (điều kiện ở `pfm_mo.ts`), nên GHIM cờ bật thay vì bỏ bài. Trạng thái KHOÁ: `pfm_khoa_web.test.tsx`.
 */
vi.mock('@/lib/pfm_mo', () => ({ PFM_WEB_MO: true }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
/*
 * ⚠ Dọn TRƯỚC mỗi bài, không chỉ trông vào tệp khác dọn sau: §IV dựng cảnh
 * "người CHƯA từng phỏng vấn", mà cảnh ấy là VẮNG MẶT một khoá localStorage —
 * loại tiền đề dễ bị tệp khác phá nhất và khó truy nhất khi đỏ.
 */
beforeEach(() => { localStorage.clear(); });

const LUC = '2026-09-08T09:00:00.000Z';

/**
 * Tín hiệu game hợp lệ cho `gameDienSan` — MỘT nguồn cho cả §I (hàm thuần) và §IV (canh cờ
 * ⚑ trên DOM thật), đừng chép tay lần hai (A11.5).
 */
const tinHieu = (sauThua: number | null) => ({
  formula_version: 2, hieu_chuan: 'chua' as const, n_tran: 3, n_vong: 30, bac_doc: 'chua' as const,
  tiet_kiem: null,
  chi_so: {
    hieu_chinh: null, duoi_gia: null, theo_tin: null, chot_non: null, mua_tin: null, khau_vi: null,
    don_von: sauThua === null ? null : { nen_bp: 1000, sau_thang_x: 1, sau_thua_x: sauThua, n: 8 },
  },
});

/**
 * Vẽ THẲNG `RuotPhongVan` với một `kho` trong bộ nhớ tự đưa vào (không qua `/tai-chinh` +
 * fake-indexeddb dùng chung của cả tệp) — dùng ở §IV khi cần một hồ sơ ĐÃ CÓ SẴN vài câu,
 * tất định. Cùng nếp `ve()` của `ngay_dau.test.tsx`.
 */
function veTrucTiep(kho: KhoTrongBoNho, duong = '/tai-chinh/phong-van') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[duong]}>
        <KhoProvider kho={kho}>
          <RuotPhongVan />
        </KhoProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('I. Chín câu — danh mục TĨNH, không sinh tự do', () => {
  /*
   * ⚠ Ranh đỏ của cả thang can thiệp, chép từ demo: mọi lựa chọn phải là bản tĩnh
   * có mã, duyệt được. Bài này đỏ nếu ai đó nhét một câu sinh động vào.
   */
  it('đúng chín câu, mỗi câu có id + ít nhất hai lựa chọn cố định', () => {
    expect(CAU_PV).toHaveLength(9);
    for (const c of CAU_PV) {
      expect(c.id, 'câu thiếu id ⇒ không quét test được').toBeTruthy();
      expect(c.dap.length).toBeGreaterThanOrEqual(2);
    }
    expect(CAU_PV.map((c) => c.id)).toEqual([
      'nguon_thu', 'deu', 'co_no', 'no_so', 'muc_tieu', 'luc_tien_ve', 'sau_khi_tieu',
      'dau_thang', 'nhip',
    ]);
  });

  /*
   * D277 — nhãn dài quá 18 ký tự tràn ngang thành mảng xám (`.chip.doi` trong demo),
   * founder kêu khó đọc. `no_so` cố ý miễn: nó là câu duy nhất dùng bố cục HÀNG
   * (mỗi đáp án một dòng), không phải lưới chip — xem `phong_van.ts` §`CAU_PV`.
   */
  it('⭐ mọi nhãn đáp án ≤ 18 ký tự, TRỪ câu no_so (cố ý dài, dùng bố cục hàng)', () => {
    for (const c of CAU_PV) {
      if (c.id === 'no_so') continue;
      for (const d of c.dap) {
        expect(d.length, `câu ${c.id}: nhãn "${d}" dài ${d.length} ký tự ⇒ tràn thành chip xám`)
          .toBeLessThanOrEqual(18);
      }
    }
  });

  /*
   * D324 — ⚑ thôi là HẰNG SỐ, nay suy từ số thật (`gameDienSan`). Hai câu canh:
   * (a) mọi đáp án nó có thể trả PHẢI nằm trong danh sách lựa chọn của câu (lệch một ký
   *     tự là chip cờ vàng không bao giờ khớp ⇒ "điền sẵn" chết lặng);
   * (b) không có tín hiệu / thiếu mẫu / dưới ngưỡng ⇒ KHÔNG điền gì — thứ trước D324 làm
   *     ngược lại với MỌI người.
   */
  it('⭐ đáp án game điền sẵn PHẢI nằm trong chính danh sách lựa chọn của câu', () => {
    const ra = gameDienSan(tinHieu(NGUONG_TINH_CACH.KET_QUA_X + 0.1));
    expect(Object.keys(ra).length).toBeGreaterThan(0);
    for (const [id, dap] of Object.entries(ra)) {
      const c = CAU_PV.find((x) => x.id === id);
      expect(c, `câu ${id} không tồn tại`).toBeDefined();
      expect(c!.dap, `câu ${id}`).toContain(dap);
    }
  });

  it('⭐ không tín hiệu · thiếu mẫu · dưới ngưỡng ⇒ không điền câu nào', () => {
    expect(gameDienSan(undefined)).toEqual({});
    expect(gameDienSan(tinHieu(null))).toEqual({});
    expect(gameDienSan(tinHieu(NGUONG_TINH_CACH.KET_QUA_X - 0.1))).toEqual({});
  });
});

describe('II. Nhãn → mã: thà TRỐNG còn hơn ĐOÁN', () => {
  it('một nhóm duy nhất ⇒ ra mã', () => {
    expect(nguonThuTuNhan(['lương tháng'])).toBe('luong');
    // hai nhãn nhưng CÙNG một mã ⇒ vẫn suy được, không phải mơ hồ
    expect(nguonThuTuNhan(['làm thêm', 'bán hàng'])).toBe('tu_do');
  });

  it('⭐ hai nhóm khác nhau ⇒ undefined, KHÔNG chọn bừa cái đầu', () => {
    expect(nguonThuTuNhan(['lương tháng', 'gia đình cho'])).toBeUndefined();
    expect(nguonThuTuNhan([])).toBeUndefined();
  });

  it('"không có" là câu trả lời PHỦ ĐỊNH, khác với chưa trả lời', () => {
    expect(coNoTuNhan(['không có'])).toBe(false);
    expect(coNoTuNhan(['trả góp'])).toBe(true);
    expect(coNoTuNhan(['không có', 'học phí']), 'chọn thêm ⇒ vẫn là có nợ').toBe(true);
    expect(coNoTuNhan([]), 'chưa chạm gì ⇒ chưa khai').toBeUndefined();
  });

  it('câu để sau (null) không đẻ ra trường nào', () => {
    const r = hoSoTuTraLoi({ nguon_thu: null, nhip: null, co_no: null });
    expect(r).toEqual({});
  });
});

describe('III. ⭐ Ba câu chỉ-ở-lại-máy phải SỐNG SÓT qua một vòng ghi–đọc', () => {
  it('ghi rồi đọc lại vẫn còn deu · mucTieu · nhip · noSo · lucTienVe · sauKhiTieu · dauThang', async () => {
    const kho = new KhoTrongBoNho();
    const h: HoSo = {
      ...hoSoTuTraLoi({
        nguon_thu: ['lương tháng'],
        deu: ['thất thường'],
        co_no: ['trả góp'],
        no_so: ['500k–2tr · dưới 6 tháng'],
        muc_tieu: ['quỹ dự phòng', 'chuyến đi'],
        luc_tien_ve: ['cất một phần đi'],
        sau_khi_tieu: ['nhẩm lại giá'],
        dau_thang: ['đại khái'],
        nhip: ['ngày tệ'],
      }),
    };
    await ghiHoSo(kho, h, LUC);
    const doc = await docHoSo(kho);

    expect(doc.nguonThu).toBe('luong');
    expect(doc.coNo).toBe(true);
    // ⚠ Chính là chỗ `locHoSo` từng sẵn sàng vứt im lặng:
    expect(doc.deu, 'deu bị locHoSo vứt').toBe('thất thường');
    expect(doc.mucTieu, 'mucTieu bị locHoSo vứt').toEqual(['quỹ dự phòng', 'chuyến đi']);
    expect(doc.nhip, 'nhip bị locHoSo vứt').toEqual(['ngày tệ']);
    // ⚠ Bốn câu thêm 21/09 — cùng cái bẫy, nặng hơn: mất chúng là mất luôn hành tinh (chan_dung_hanh.ts).
    expect(doc.noSo, 'noSo bị locHoSo vứt').toBe('500k–2tr · dưới 6 tháng');
    expect(doc.lucTienVe, 'lucTienVe bị locHoSo vứt').toBe('cất một phần đi');
    expect(doc.sauKhiTieu, 'sauKhiTieu bị locHoSo vứt').toBe('nhẩm lại giá');
    expect(doc.dauThang, 'dauThang bị locHoSo vứt').toBe('đại khái');
  });

  it('rác trong mảng bị lọc, mảng rỗng ⇒ vắng mặt (không phải [])', () => {
    const r = locHoSo({ mucTieu: ['ok', 7, null], nhip: [], deu: 12 });
    expect(r.mucTieu).toEqual(['ok']);
    expect(r.nhip).toBeUndefined();
    expect(r.deu).toBeUndefined();
  });
});

describe('IV. Cửa /tai-chinh đưa người MỚI vào phỏng vấn trước cả thẻ', () => {
  it('⭐ chưa từng phỏng vấn ⇒ thấy ĐÚNG số câu áp dụng (8 — no_so ẩn tới khi biết câu nợ), không thấy màn thẻ', async () => {
    stubFetch([]);   // 401 mặc định — người mới thường chưa có gì
    renderAt('/tai-chinh');
    /*
     * ⚠ TIMEOUT RỘNG CÓ CHỦ Ý (08/09). Bài này XANH khi chạy một mình và ĐỎ
     * trong vài lượt chạy cả bộ — không phải logic sai mà là hết giờ: đường đi
     * là `/tai-chinh` → `CuaPfm` → `Navigate` → chunk LAZY của màn phỏng vấn,
     * ba nhịp, dưới tải của 125 tệp chạy song song. Mặc định 1000ms của
     * `findByText` không đủ, và cái đỏ ấy nói về máy chạy test chứ không nói gì
     * về app. Nới giờ chứ KHÔNG nới điều kiện — vẫn phải thấy đúng màn ấy.
     */
    const soCau = cauDangHien({}).length; // 8 — co_no chưa trả lời ⇒ no_so chưa hiện (phong_van.ts)
    expect(await screen.findByText(new RegExp(`^${soCau} CÂU · CHẠM LÀ XONG`), undefined, { timeout: 5000 }))
      .toBeInTheDocument();
    // Mốc của màn THẺ — phải VẮNG, nếu không thì cửa đang đi sai nhánh.
    expect(screen.queryByText('RADAR SÁU TRỤC')).toBeNull();
  });

  /*
   * ⚠ HÉ DẦN (21/09): câu chưa tới thì CHƯA render, nên bài này KHÔNG còn đòi thấy hết chín câu
   * cùng lúc như bản cũ (đúng ranh mà A11.25/task ghi rõ: mở màn chỉ MỘT câu hiện). Đổi cách dựng
   * màn sang `veTrucTiep` (kho trong bộ nhớ, tất định) thay vì `renderAt('/tai-chinh')`: câu `nhip`
   * — câu game điền sẵn — là câu CUỐI trong chín câu, và lớp điền sẵn của game (`daDien`) chỉ chạy
   * ĐÚNG MỘT LẦN, TRƯỚC BẤT KỲ cú chạm nào của người dùng (xem `PhongVan.tsx`). Bấm "bỏ qua" bảy lần
   * để dò tới nó thì có rủi ro đua thời gian thật (bấm sớm hơn lượt điền ⇒ cờ ⚑ không bao giờ tới);
   * nạp sẵn bảy câu kia thẳng vào kho thì hé dần lộ đủ tám câu MỘT lượt, tất định, không đua giờ.
   */
  it('⭐⭐ câu game điền sẵn vẫn được đánh dấu ⚑ khi mở lại (gameDienSan vẫn điền nhip: "ngày tệ")', async () => {
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
    const BAY_CAU: HoSo = {
      nguonThuNhan: ['lương tháng'], deu: 'đều mỗi tháng', coNo: false, coNoNhan: ['không có'],
      mucTieu: ['quỹ dự phòng'], lucTienVe: 'cất một phần đi', sauKhiTieu: 'nhẩm lại giá', dauThang: 'đại khái',
      // ⚠ CỐ Ý không đặt `nhip` — câu đó phải tới từ GAME, không phải từ hồ sơ đã có sẵn.
    };
    const kho = new KhoTrongBoNho();
    await ghiHoSo(kho, BAY_CAU, LUC);
    veTrucTiep(kho);

    const cauNhip = CAU_PV.find((c) => c.id === 'nhip')!;
    // Bảy câu đã có sẵn + `nhip` do game điền ⇒ hé dần lộ đủ tám câu một lượt, `nhip` thu gọn với
    // đáp án của game. Bấm dòng thu gọn để mở lại (ĐỔI) — đúng nếp `ngay_dau.test.tsx`.
    fireEvent.click(await screen.findByText(cauNhip.hoi));
    const chipNgayTe = await screen.findByRole('button', { name: 'ngày tệ' });
    expect(chipNgayTe.className, 'chip do GAME điền phải mang lớp cờ ⚑ (chipGame)').toContain('chipGame');
    expect(chipNgayTe.getAttribute('aria-pressed'), 'đáp án của game phải đã được CHỌN sẵn').toBe('true');
    expect(calls.some((c) => c.url.includes('/holdem/me/tin-hieu')), 'phải thật sự gọi tín hiệu game').toBe(true);
  });
});

describe('V. ⭐ (D308) Chiều ngược — mở lại sáu câu đúng như đã trả lời', () => {
  /*
   * Từ D308 màn phỏng vấn SỬA LẠI ĐƯỢC. Mở ra mà trống trơn thì người dùng phải
   * khai lại cả sáu câu để đổi một câu — và tệ hơn: hai câu bị ĐÚC MẤT THÔNG TIN
   * (`nguon_thu` 6 nhãn ⇒ 4 mã, `co_no` 5 nhãn ⇒ 1 boolean) nên KHÔNG dựng lại
   * được nếu không giữ nhãn thô.
   */
  const DAP = {
    nguon_thu: ['lương tháng', 'gia đình cho'],
    deu: ['thất thường'],
    co_no: ['trả góp', 'học phí'],
    no_so: ['trên 2tr'],
    muc_tieu: ['quỹ dự phòng', 'chuyến đi'],
    luc_tien_ve: ['tiêu cái đang cần'],
    sau_khi_tieu: ['tiếc mất mấy hôm'],
    dau_thang: ['rồi, khá rõ'],
    nhip: ['ngày tệ'],
  };

  it('mọi câu đều có mặt trong KHOA_THEO_CAU — thiếu một khoá là "để sau" không xoá nổi', () => {
    for (const c of CAU_PV) {
      expect(KHOA_THEO_CAU[c.id], `câu ${c.id} chưa khai khoá nào`).toBeTruthy();
      expect(KHOA_THEO_CAU[c.id]!.length).toBeGreaterThan(0);
    }
  });

  it('⭐ đi một vòng ghi → đọc → dựng lại: chín câu về đúng nguyên trạng', async () => {
    const kho = new KhoTrongBoNho();
    await ghiHoSo(kho, hoSoTuTraLoi(DAP) as HoSo, LUC);
    expect(traLoiTuHoSo(await docHoSo(kho))).toEqual(DAP);
  });

  it('⭐ câu nguồn thu MƠ HỒ vẫn nhớ đủ chip, dù cohort để trống', () => {
    const h = hoSoTuTraLoi({ nguon_thu: ['lương tháng', 'gia đình cho'] }) as HoSo;
    expect(h.nguonThu, 'hai mã khác nhau ⇒ vẫn phải để trống (A8.2)').toBeUndefined();
    expect(traLoiTuHoSo(h).nguon_thu).toEqual(['lương tháng', 'gia đình cho']);
  });

  it('hồ sơ cũ (chỉ có mã, không có nhãn thô) ⇒ câu ấy VẮNG, không bịa nhãn đại diện', () => {
    expect(traLoiTuHoSo({ nguonThu: 'luong', coNo: true })).toEqual({});
  });

  it('nhãn thô sống sót qua locHoSo — cùng cái bẫy đã bắt ở khối III', () => {
    const r = locHoSo({ nguonThuNhan: ['lương tháng'], coNoNhan: ['trả góp'], loTrinhBo: ['chuyến đi'] });
    expect(r.nguonThuNhan).toEqual(['lương tháng']);
    expect(r.coNoNhan).toEqual(['trả góp']);
    expect(r.loTrinhBo).toEqual(['chuyến đi']);
  });
});

describe('VI. ⭐ cauDangHien — no_so chỉ hiện khi câu nợ đang nói CÓ nợ thật', () => {
  /*
   * ⚠ `no_so` là câu ĐIỀU KIỆN duy nhất trong chín câu (21/09). Ba ca dưới đây khoá
   * đúng ba trạng thái của câu `co_no` đứng trước nó — xem chú thích `hienKhi` ở
   * `phong_van.ts`: "không có" là một câu trả lời PHỦ ĐỊNH, khác hẳn "chưa trả lời".
   */
  it('chưa trả lời co_no ⇒ no_so vắng mặt (chưa hỏi được chi tiết của thứ chưa biết có hay không)', () => {
    expect(cauDangHien({}).map((c) => c.id)).not.toContain('no_so');
  });

  it('trả lời ["không có"] ⇒ no_so vắng mặt — phủ định cũng là một câu trả lời', () => {
    const hien = cauDangHien({ co_no: ['không có'] }).map((c) => c.id);
    expect(hien).not.toContain('no_so');
  });

  it('⭐ trả lời ["trả góp"] ⇒ no_so hiện', () => {
    const hien = cauDangHien({ co_no: ['trả góp'] }).map((c) => c.id);
    expect(hien).toContain('no_so');
  });

  it('tám câu còn lại LUÔN hiện, bất kể trả lời gì (không có hienKhi nào khác)', () => {
    const luonHien = CAU_PV.filter((c) => c.id !== 'no_so').map((c) => c.id);
    const hien = cauDangHien({ co_no: ['không có'] }).map((c) => c.id);
    for (const id of luonHien) expect(hien, `câu ${id} lẽ ra luôn hiện`).toContain(id);
  });
});

describe('VII. ⭐⭐ khoaCauAn — giá trị cũ không được sống sót im lặng khi câu biến mất', () => {
  it('mọi câu đang hiện ⇒ không khoá nào bị coi là ẩn', () => {
    expect(khoaCauAn({ co_no: ['trả góp'] })).toEqual([]);
  });

  it('⭐⭐ ca "giá trị cũ sống sót im lặng": trả lời no_so rồi đổi co_no về "không có"', () => {
    /*
     * Người dùng từng khai "trả góp" + chi tiết khoản (no_so), rồi mở lại câu nợ và
     * đổi ý thành "không có". Câu `no_so` biến mất khỏi `cauDangHien` ngay — nhưng
     * `noSo` cũ vẫn còn nằm trong `traLoi`/hồ sơ cho tới khi có ai đó XOÁ nó theo
     * đúng khoá mà `khoaCauAn` chỉ ra. Thiếu bước này thì hồ sơ giữ "500k–2tr·…"
     * trong khi người dùng vừa nói "tôi không có nợ".
     */
    const traLoi = { co_no: ['không có'], no_so: ['500k–2tr · dưới 6 tháng'] };
    expect(cauDangHien(traLoi).map((c) => c.id), 'no_so phải đã biến mất').not.toContain('no_so');
    expect(khoaCauAn(traLoi)).toEqual(['noSo']);
  });

  it('câu no_so vẫn hiện (còn nợ) ⇒ khoá noSo KHÔNG bị liệt vào danh sách ẩn', () => {
    const traLoi = { co_no: ['trả góp'], no_so: ['trên 2tr'] };
    expect(khoaCauAn(traLoi)).not.toContain('noSo');
  });
});

describe('VIII. ⭐⭐⭐ CUỘC ĐUA: chạm chip TRƯỚC khi hồ sơ nạp xong', () => {
  /*
   * ⚠⚠ ĐƯỜNG MẤT DỮ LIỆU THẬT, và HÉ DẦN làm nó nặng lên.
   *
   * Lớp điền sẵn chỉ chạy khi `coHoSo` đã true, và chỉ chạy ĐÚNG MỘT LẦN (`daDien`). Bản cũ
   * mở đầu bằng `if (Object.keys(cu).length) return cu;` — nên chỉ cần người dùng chạm MỘT
   * chip trước khi hồ sơ cũ kịp nạp là lớp điền sẵn bị khoá vĩnh viễn: màn hiện ra trống,
   * và người dùng tưởng app quên hết lời khai của mình.
   *
   * Trước 21/09 hậu quả còn nhẹ (nộp mà không đụng câu nào thì câu ấy vắng khỏi `sach`, giá
   * trị cũ sống sót). Từ khi hé dần, muốn hiện nút XONG thì phải XỬ hết câu — mà "bỏ qua"
   * ghi `null`, và `null` XOÁ khoá. Tức lời khai cũ bị xoá sạch, im lặng.
   */
  it('⭐⭐⭐ chạm chip khi kho CHƯA sẵn sàng ⇒ lời khai cũ VẪN được điền lại, và cú chạm ấy THẮNG', async () => {
    const CU: HoSo = {
      deu: 'thất thường', coNo: false, coNoNhan: ['không có'],
      mucTieu: ['quỹ dự phòng'], nhip: ['cuối tháng'],
      lucTienVe: 'cất một phần đi', sauKhiTieu: 'quên luôn', dauThang: 'đại khái',
    };
    const kho = new KhoTrongBoNho();
    await ghiHoSo(kho, CU, LUC);
    stubFetch([]);
    veTrucTiep(kho);
    /* KHÔNG chờ kho sẵn sàng — chạm ngay, đúng cuộc đua. */
    fireEvent.click(await screen.findByRole('button', { name: 'lương tháng' }));
    await new Promise((r) => setTimeout(r, 80));
    /* Câu 1 là câu NHIỀU nên nó giữ mở, và hé dần dừng ở đó — đóng nó lại thì các câu sau
       mới lộ ra dưới dạng dòng co, và đó mới là chỗ đọc được lời khai cũ. */
    fireEvent.click(await screen.findByRole('button', { name: /XONG \(1\)/ }));
    await new Promise((r) => setTimeout(r, 80));

    const chu = document.body.textContent ?? '';
    expect(chu, 'câu vừa chạm phải còn').toContain('lương tháng');
    for (const cu of ['thất thường', 'quỹ dự phòng', 'cất một phần đi']) {
      expect(chu, `lời khai cũ "${cu}" bị mất — lớp điền sẵn đã bị khoá`).toContain(cu);
    }
  });
});
