/**
 * PFM — HỒ SƠ HOÀN CẢNH (`ho_so.ts`, G1): ba câu tự khai, và nguồn duy nhất của `ctx_*`.
 *
 * ⚠ Bài đắt nhất ở đây là §IV: **`ctx_*` thật sự đi vào gói đặc trưng**. Ba mã ấy nằm
 * trong sổ đăng ký từ đầu, có chú thích "vì sao" đàng hoàng, mà chưa từng có ai phát —
 * `grep ctx_` ngoài `config/` ra 0. Một trục nghiên cứu rỗng ở mọi kỳ mà không có gì đỏ.
 */
import { describe, expect, it } from 'vitest';
import {
  ID_HO_SO, LoiHoSo, ctxCuaHoSo, docHoSo, ghiHoSo, kiemHoSo, locHoSo, soCauDaTraLoi, soCauPhongVan,
  suaHoSo, tienDoHoSo, type HoSo,
} from '../src/pfm/ho_so.js';
import { dongGoiKy } from '../src/pfm/dac_trung.js';
import { mauHopVoiHoSo } from '../src/pfm/hu_mau.js';
import { KhoTrongBoNho } from '../src/pfm/kho.js';
import { SO_DANG_KY } from '@config/pfm_dac_trung';

const LUC = '2026-09-05T10:00:00.000Z';
const DAY: HoSo = { tuLap: 'tu_lap', nguonThu: 'luong', khung: 'kakeibo', coNo: true };

describe('§I — miền SUY từ sổ đăng ký, không chép tay', () => {
  it('⭐⭐ mọi giá trị của `SO_DANG_KY` đều qua được `kiemHoSo`', () => {
    /*
     * ⚠⚠ Đây là bài canh chống BẢN SAO THỨ HAI (A11.5/R9). Nếu ai đó gõ lại miền vào
     * `ho_so.ts` rồi config thêm một giá trị mới, bài này đỏ NGAY — thay vì để
     * `kiemGiaTri` ném lúc chạy, mà cú ném ấy nằm trong `dongGoiKy` nên nó làm hỏng
     * **cả gói của kỳ**, không riêng một dòng.
     */
    for (const v of SO_DANG_KY.ctx_tu_lap.mien) {
      expect(kiemHoSo({ tuLap: v }), v).toBeNull();
    }
    for (const v of SO_DANG_KY.ctx_nguon_thu.mien) {
      expect(kiemHoSo({ nguonThu: v }), v).toBeNull();
    }
    for (const v of SO_DANG_KY.ctx_khung.mien) {
      expect(kiemHoSo({ khung: v }), v).toBeNull();
    }
  });

  it('giá trị ngoài miền ⇒ nói rõ miền hợp lệ là gì', () => {
    const loi = kiemHoSo({ tuLap: 'giau' as never });
    expect(loi).toContain('tuLap');
    expect(loi, 'câu lỗi phải liệt kê miền để người sửa không phải đi tra').toContain('tu_lap');
  });

  it('hồ sơ RỖNG hợp lệ — cả ba câu đều "để sau" được', () => {
    expect(kiemHoSo({})).toBeNull();
  });
});

describe('§II — ⭐⭐ ghi thì NÉM, đọc thì LỌC', () => {
  it('ghi giá trị ngoài miền ⇒ ném (menu cố định ⇒ đó là lỗi lập trình)', async () => {
    await expect(ghiHoSo(new KhoTrongBoNho(), { khung: 'phong_thuy' as never }, LUC))
      .rejects.toBeInstanceOf(LoiHoSo);
  });

  it('⭐⭐ đọc bản ghi CŨ có giá trị đã bị gỡ khỏi miền ⇒ BỎ câu đó, không ném', async () => {
    /*
     * ⚠⚠ Vì sao hai cửa hai thái độ: dữ liệu này ĐÃ nằm trên máy người dùng, có thể do
     * một bản app cũ ghi. Một giá trị đã bị gỡ khỏi miền ở đó **không phải lỗi hôm nay**.
     * Nhưng để nó đi tiếp thì `them()` ném trong `dongGoiKy` ⇒ mất TOÀN BỘ đặc trưng của
     * tháng vì một câu trả lời cũ. Bỏ đúng câu đó, giữ hai câu còn lại.
     */
    const kho = new KhoTrongBoNho();
    await kho.ghi('meta', {
      id: ID_HO_SO, thang: '2026-09', suaLuc: LUC,
      d: { tuLap: 'tu_lap', nguonThu: 'khai_thac_bitcoin', khung: 'hu' },
    });
    expect(await docHoSo(kho)).toEqual({ tuLap: 'tu_lap', khung: 'hu' });
  });

  it('chưa khai ⇒ `{}`, KHÔNG phải null', async () => {
    // "Chưa trả lời câu nào" và "chưa từng mở màn hồ sơ" là cùng một trạng thái với mọi
    // thứ phía sau — bắt người gọi phân biệt là đẻ ra một nhánh `null` chết.
    expect(await docHoSo(new KhoTrongBoNho())).toEqual({});
  });

  it('ghi rồi đọc lại ⇒ y nguyên, kể cả `coNo`', async () => {
    const kho = new KhoTrongBoNho();
    await ghiHoSo(kho, DAY, LUC);
    expect(await docHoSo(kho)).toEqual(DAY);
  });

  it('rác hoàn toàn (null · số · mảng) ⇒ `{}`, không ném', () => {
    for (const x of [null, 42, 'chuoi', [1, 2]]) expect(locHoSo(x)).toEqual({});
  });
});

describe('§III — ⭐⭐⭐ câu chưa trả lời phải VẮNG MẶT, không hoá thành nhãn', () => {
  it('⭐⭐⭐ chưa khai nguồn thu ⇒ KHÔNG có dòng `ctx_nguon_thu` (đừng điền "khac")', () => {
    /*
     * ⚠⚠ `'khac'` CÓ trong miền, nên phản xạ là điền nó cho người chưa khai. Đó là một cú
     * nói dối có cấu trúc: `'khac'` nghĩa là *"tôi có nguồn thu và nó không thuộc ba loại
     * kia"* — một phát biểu về hoàn cảnh; còn chưa khai nghĩa là **không biết gì cả**.
     * Gộp hai thứ làm nhóm `'khac'` phình lên bằng mọi người lười bấm, và mọi kết luận về
     * nhóm đó thành rác. Đúng luật P7/D62 mà `them()` đã theo.
     */
    const ra = ctxCuaHoSo({ tuLap: 'tu_lap' });
    expect(ra.map((x) => x.ma)).toEqual(['ctx_tu_lap']);
    expect(JSON.stringify(ra), 'không được có chữ "khac" ở đâu cả').not.toContain('khac');
  });

  it('hồ sơ rỗng ⇒ không dòng nào', () => {
    expect(ctxCuaHoSo({})).toEqual([]);
  });

  it('⭐ `coNo` KHÔNG ra ngoài — cố ý không có mã đặc trưng nào cho nó', () => {
    /*
     * Nó chỉ dùng để `mauHopVoiHoSo` đưa hũ trả nợ lên đầu, tức một quyết định TRÌNH BÀY.
     * Thêm một mã cho nó là biến "tôi đang có nợ" thành dữ liệu nghiên cứu rời máy — mà
     * A8.2 nói agent không tự thêm trục đo, và đây là trục nhạy nhất trong ba câu.
     */
    expect(ctxCuaHoSo({ coNo: true })).toEqual([]);
    expect(Object.keys(SO_DANG_KY).filter((k) => k.includes('no'))).toEqual([]);
  });

  it('tiến độ đếm BA câu đi ra ngoài, không đếm `coNo`', () => {
    expect(tienDoHoSo({})).toEqual({ daTraLoi: 0, tong: 3, xong: false });
    expect(tienDoHoSo({ coNo: true }), '`coNo` không làm hồ sơ đầy hơn')
      .toMatchObject({ daTraLoi: 0, xong: false });
    expect(tienDoHoSo(DAY)).toEqual({ daTraLoi: 3, tong: 3, xong: true });
  });
});

describe('§IV — ⭐⭐⭐ `ctx_*` THẬT SỰ đi vào gói đặc trưng', () => {
  const goi = (hoSo?: HoSo) => dongGoiKy({ ky: '2026-09', so: [], hu: [], hoSo });

  it('⭐⭐⭐ ba mã context có mặt trong gói — trục nghiên cứu hết rỗng', () => {
    /*
     * ⚠⚠ Trước lượt này `dongGoiKy` không hề nhận hồ sơ, nên ba mã `ctx_*` nằm trong sổ
     * đăng ký mà **chưa từng có một dòng nào ở bất kỳ kỳ nào**. Không có gì đỏ, không có
     * gì thiếu — chỉ là mọi so sánh cohort đang so hai nhóm không so được với nhau.
     */
    const dong = goi(DAY).dong;
    const ctx = dong.filter((d) => d.ma.startsWith('ctx_'));
    expect(ctx).toEqual([
      { ma: 'ctx_tu_lap', giaTri: 'tu_lap' },
      { ma: 'ctx_nguon_thu', giaTri: 'luong' },
      { ma: 'ctx_khung', giaTri: 'kakeibo' },
    ]);
  });

  it('⭐ context đi ĐẦU gói — mọi chỉ số phía dưới chỉ có nghĩa khi đọc cùng chúng', () => {
    const dong = goi(DAY).dong;
    expect(dong.slice(0, 3).every((d) => d.ma.startsWith('ctx_'))).toBe(true);
  });

  it('không đưa hồ sơ ⇒ gói vẫn dựng được, chỉ thiếu ba dòng', () => {
    // Sổ chưa khai hoàn cảnh vẫn phải gửi được đặc trưng — thiếu context là thiếu một
    // trục, không phải hỏng cả gói.
    expect(goi().dong.some((d) => d.ma.startsWith('ctx_'))).toBe(false);
    expect(goi().ky).toBe('2026-09');
  });

  it('⭐⭐ hồ sơ có giá trị ngoài miền ⇒ `dongGoiKy` NÉM (đường ghi đã chặn từ trước)',
    () => {
      /*
       * Đây là lý do `docHoSo` lọc: chỉ cần một câu trả lời lạc miền đi lọt tới đây là
       * MẤT CẢ GÓI của kỳ. Bài này khoá đúng cái hậu quả ấy để không ai gỡ phép lọc đi.
       */
      expect(() => goi({ khung: 'phong_thuy' as never })).toThrow();
    });
});

describe('§V — nối với mẫu hũ (`mauHopVoiHoSo` dùng CHÍNH kiểu này)', () => {
  it('⭐ `HoSo` là MỘT kiểu — `hu_mau.ts` không còn bản chép tay của miền `tuLap`', () => {
    // Trước lượt này `mauHopVoiHoSo` khai inline `'phu_thuoc' | 'ban_tu_lap' | 'tu_lap'`,
    // tức bản thứ ba của cùng một enum (config · ho_so · hu_mau). Giờ nó nhận `HoSo`.
    const h: HoSo = { tuLap: 'phu_thuoc', coNo: true };
    const mau = mauHopVoiHoSo(h);
    expect(mau.length).toBeGreaterThanOrEqual(2);
    expect(mau[0]!.id, 'có nợ ⇒ hũ trả nợ lên đầu').toBe('tra_no');
  });

  it('hồ sơ rỗng vẫn ra 2–4 mẫu', () => {
    const mau = mauHopVoiHoSo({});
    expect(mau.length).toBeGreaterThanOrEqual(2);
    expect(mau.length).toBeLessThanOrEqual(4);
  });
});

describe('§VI — `soCauDaTraLoi`: TÁM/CHÍN câu phỏng vấn (no_so là câu điều kiện), MỘT luật đếm cho LỘ TRÌNH và NGÀY ĐẦU (D358/21-09)', () => {
  /*
   * ⚠ Trước D358 luật đếm này có HAI bản (`LoTrinh.tsx` và `chan_dung.ts` — bản sau do agent thi công chép lại vì
   * "LoTrinh ngoài phạm vi"). Hai bản giống nhau từng chữ HÔM NAY; A11.5 nói chuyện NGÀY MAI. Vector chép tay:
   */
  it('⭐ chép tay: rỗng = 0 · đủ tám (không nợ) = 8 · đủ chín (có nợ + noSo) = 9 · từng câu một = 1', () => {
    expect(soCauDaTraLoi({})).toBe(0);
    const DU: HoSo = {
      nguonThu: 'luong', deu: 'đều mỗi tháng', coNo: false, mucTieu: ['quỹ dự phòng'],
      lucTienVe: 'cất một phần đi', sauKhiTieu: 'nhẩm lại giá', dauThang: 'đại khái', nhip: ['ngày tệ'],
    };
    expect(soCauDaTraLoi(DU), 'không nợ ⇒ noSo không tính vào mẫu, đủ 8/8').toBe(8);
    const DU_NO: HoSo = { ...DU, coNo: true, noSo: 'trên 2tr' };
    expect(soCauDaTraLoi(DU_NO), 'có nợ + đã khai noSo ⇒ đủ 9/9').toBe(9);
    const TUNG: HoSo[] = [
      { nguonThu: 'luong' }, { deu: 'đều mỗi tháng' }, { coNo: false }, { mucTieu: ['quỹ dự phòng'] },
      { lucTienVe: 'cất một phần đi' }, { sauKhiTieu: 'nhẩm lại giá' }, { dauThang: 'đại khái' }, { nhip: ['ngày tệ'] },
    ];
    for (const h of TUNG) expect(soCauDaTraLoi(h), JSON.stringify(h)).toBe(1);
  });

  it('⭐ `soCauPhongVan` — MẪU SỐ co theo người, không phải hằng số: không nợ (hoặc chưa khai nợ) ⇒ 8, có nợ thật ⇒ 9', () => {
    expect(soCauPhongVan({})).toBe(8);
    expect(soCauPhongVan({ coNo: false })).toBe(8);
    expect(soCauPhongVan({ coNo: true })).toBe(9);
  });

  it('⭐⭐ `coNo: false` LÀ một câu trả lời ("không nợ"), mảng RỖNG thì KHÔNG (người dùng bỏ chọn hết = để sau)', () => {
    // Hai chỗ dễ viết sai nhất: `if (h.coNo)` nuốt mất câu "không"; `h.nhip !== undefined` đếm cả mảng rỗng.
    expect(soCauDaTraLoi({ coNo: false })).toBe(1);
    expect(soCauDaTraLoi({ mucTieu: [], nhip: [] })).toBe(0);
  });

  it('các trường KHÔNG phải câu phỏng vấn thì không đẩy số đếm (tuLap · nhãn nợ thô · dấu vết chân dung · lộ trình)', () => {
    expect(soCauDaTraLoi({ tuLap: 'tu_lap', chanDungBac: ['nhip'], chanDungDaCham: ['nhip'], chanDungNhip: 'ngày tệ', ngayDauBo: [0], loTrinhBo: ['x'] })).toBe(0);
  });

  it('⭐⭐⭐ câu 1 chọn HAI nhóm nguồn thu ⇒ mã `nguonThu` TRỐNG (A8.2) nhưng câu ĐÃ được trả lời — đếm đủ 8/8', async () => {
    /*
     * Ca thật, soi mắt 20/09: chọn "gia đình cho" + "làm thêm" rồi trả lời đủ bảy câu còn lại (không nợ, nên mẫu
     * là 8) ⇒ phải vẫn ra 8/8, không phải 7/8. `nguonThuNhan` (nhãn thô) là thứ giữ câu 1 "đã trả lời" ngay cả khi
     * `nguonThu` (mã đã đúc) cố ý để trống — xem `soCauDaTraLoi` §nguon_thu.
     */
    const { hoSoTuTraLoi } = await import('../src/pfm/phong_van.js');
    const h = hoSoTuTraLoi({
      nguon_thu: ['gia đình cho', 'làm thêm'], deu: ['thất thường'], co_no: ['không có'],
      muc_tieu: ['quỹ dự phòng'], luc_tien_ve: ['cất một phần đi'], sau_khi_tieu: ['nhẩm lại giá'],
      dau_thang: ['đại khái'], nhip: ['ngày tệ'],
    }) as HoSo;
    expect(h.nguonThu, 'hai mã ⇒ cohort để trống, đúng A8.2').toBeUndefined();
    expect(h.nguonThuNhan, 'nhãn thô vẫn giữ đủ chip dù mã để trống').toEqual(['gia đình cho', 'làm thêm']);
    expect(soCauDaTraLoi(h)).toBe(8);
    // hồ sơ cũ chỉ có MÃ, chưa có nhãn thô ⇒ vẫn đếm
    expect(soCauDaTraLoi({ nguonThu: 'luong' })).toBe(1);
    // nhãn thô rỗng = để sau
    expect(soCauDaTraLoi({ nguonThuNhan: [] })).toBe(0);
  });
});

describe('§VII — ⭐⭐⭐ D385: hai trường SỔ LỜI ĐOÁN (`doanTu` · `soDoan`) qua được `locHoSo`', () => {
  /*
   * ⚠⚠ Đây là NỬA ĐỌC của cùng cái bẫy "quên chép là xoá im lặng" mà `locHoSo` đã cảnh báo
   * ba lần trong chú thích của nó (D355/D356/D385). `docHoSo` LUÔN đi qua `locHoSo`, nên
   * thiếu một dòng chép ở đây là mất mốc lời đoán hoặc mất cả sổ thành tích SAU MỖI LẦN
   * ĐỌC — không phải một lần, mà là MÃI MÃI, vì kho không giữ bản chưa lọc.
   */
  const DUNG = { ma: 'ngay_te', kq: 'trung', doDuoc: 50_000, moc: 30_000 } as const;

  it('⭐⭐ giữ `doanTu` ĐÚNG DẠNG `YYYY-MM-DD`, bỏ chuỗi không phải ngày ("hôm qua")', () => {
    expect(locHoSo({ doanTu: '2026-09-16' })).toEqual({ doanTu: '2026-09-16' });
    expect(locHoSo({ doanTu: 'hôm qua' }), 'sai dạng ⇒ bỏ, không ném').toEqual({});
  });

  it('⭐⭐⭐ giữ dòng `soDoan` ĐÚNG HÌNH, bỏ khoá sai dạng · `kq` lạ · `doDuoc` không phải số', () => {
    expect(locHoSo({ soDoan: { 'tuan:2026-09-21': DUNG } }))
      .toEqual({ soDoan: { 'tuan:2026-09-21': DUNG } });

    // Khoá sai dạng — fixture cũ của màn Gương dùng số tuần ISO (`kyCanCham` §I-bis canh
    // đúng ca này ở phía GHI; đây là phía ĐỌC của cùng một mối lo).
    expect(locHoSo({ soDoan: { 'tuan:2026-W37': DUNG } })).toEqual({});
    // `kq` ngoài ba giá trị hợp lệ (`trung` · `trat` · `chua_du`).
    expect(locHoSo({ soDoan: { 'tuan:2026-09-21': { ...DUNG, kq: 'win' } } })).toEqual({});
    // `doDuoc` không phải số (và không phải `null`).
    expect(locHoSo({ soDoan: { 'tuan:2026-09-21': { ...DUNG, doDuoc: '50000' } } })).toEqual({});
  });

  it('⭐⭐ trộn MỘT dòng đúng với các dòng hỏng ⇒ chỉ dòng đúng sống; toàn bộ hỏng ⇒ vắng hẳn `soDoan`', () => {
    expect(locHoSo({
      soDoan: {
        'tuan:2026-09-21': DUNG,
        'tuan:2026-W37': DUNG,
        'thang:2026-09': { ...DUNG, kq: 'win' },
      },
    })).toEqual({ soDoan: { 'tuan:2026-09-21': DUNG } });

    // Không còn dòng nào sống sót ⇒ khoá `soDoan` phải VẮNG MẶT, không phải `{}` —
    // cùng luật P7 mà mọi trường chỉ-ở-lại-máy khác của tệp này đã theo.
    expect(locHoSo({ soDoan: { 'tuan:2026-W37': DUNG } })).not.toHaveProperty('soDoan');
  });
});

describe('§VIII — ⭐⭐⭐ D385: `suaHoSo` tự GỠ `doanTu` khi chip nhịp ĐỔI (lời đoán mới ⇒ mốc mới)', () => {
  /*
   * ⚠⚠ Bài đắt nhất của D385 ở phía `ho_so.ts`: giữ mốc CŨ sau khi chip đổi là cho lời đoán
   * MỚI hưởng ngày của lời đoán CŨ — tức được chấm trên những ngày đã trôi qua trước khi nó
   * tồn tại (đúng bẫy "đoán sau khi biết" mà `so_doan.ts` §I dựng cả một bộ test để chặn).
   */
  const GOC: HoSo = { nhip: ['ngày tệ'], doanTu: '2026-09-16' };

  async function khoVoiGoc(): Promise<KhoTrongBoNho> {
    const kho = new KhoTrongBoNho();
    await ghiHoSo(kho, GOC, LUC);
    return kho;
  }

  it('⭐⭐⭐ đổi `nhip` (câu 6) sang một chip khác ⇒ `doanTu` BỊ GỠ', async () => {
    const kho = await khoVoiGoc();
    const ra = await suaHoSo(kho, (cu) => ({ ...cu, nhip: ['cuối tháng'] }), LUC);
    expect(ra?.nhip).toEqual(['cuối tháng']);
    expect(ra?.doanTu, 'chip đổi (ngày tệ → cuối tháng) ⇒ lời đoán đổi ⇒ mốc cũ hết hiệu lực')
      .toBeUndefined();
    expect((await docHoSo(kho)).doanTu, 'phải GỠ THẬT trong kho, không chỉ ở giá trị trả về')
      .toBeUndefined();
  });

  it('⭐⭐ đổi `chanDungNhip` (chip tự chọn lại ở màn chân dung, ưu tiên hơn câu 6) ⇒ cũng GỠ', async () => {
    const kho = await khoVoiGoc();
    const ra = await suaHoSo(kho, (cu) => ({ ...cu, chanDungNhip: 'cuối tháng' }), LUC);
    expect(ra?.chanDungNhip).toBe('cuối tháng');
    expect(ra?.doanTu).toBeUndefined();
  });

  it('sửa thứ KHÔNG liên quan tới chip nhịp (`mucTieu`) ⇒ `doanTu` GIỮ NGUYÊN', async () => {
    const kho = await khoVoiGoc();
    const ra = await suaHoSo(kho, (cu) => ({ ...cu, mucTieu: ['quỹ dự phòng'] }), LUC);
    expect(ra?.mucTieu).toEqual(['quỹ dự phòng']);
    expect(ra?.doanTu, 'chip nhịp không đổi ⇒ lời đoán vẫn là lời đoán cũ ⇒ mốc phải sống')
      .toBe('2026-09-16');
  });

  it('phép sửa trả `null` ⇒ KHÔNG ghi gì, hồ sơ trong kho y nguyên (kể cả `doanTu`)', async () => {
    const kho = await khoVoiGoc();
    const ra = await suaHoSo(kho, () => null, LUC);
    expect(ra).toBeNull();
    expect(await docHoSo(kho)).toEqual(GOC);
  });
});
