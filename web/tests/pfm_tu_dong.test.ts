/**
 * PFM — QUY TẮC TỰ CHIA (`pfm/tu_dong.ts`, D420) — VECTOR CHÉP TAY.
 *
 * Founder 26/09: *"tự thiết lập số tiền sẽ được chia vào quỹ nào / ngày và nếu thiếu hoặc thừa thì app sẽ hỏi chứ ko tự
 * phân bổ. Cho phép chia theo % hoặc tiền cố định"*; khớp thì *"Tự chia + HOÀN TÁC"*. Hôm nay = 26/09; giờ ghi UTC.
 */
import { describe, expect, it } from 'vitest';
import { tuTao, type Hu, type QuyTacTuDong } from '../src/pfm/hu.js';
import { laChiTieu, taoKhoan, type Khoan } from '../src/pfm/so.js';
import { taoKhoanPhanBo, tienConLai } from '../src/pfm/phan_bo.js';
import { LoiTuDong, chayQuyTac, datTuDong, denHan, phanTiLe } from '../src/pfm/tu_dong.js';

const NAY = '2026-09-26';
const LUC_TAO = '2026-09-01T05:00:00.000Z';
const LUC_CHAY = '2026-09-26T13:00:00.000Z';

/** Hũ đang chạy mang quy tắc `q` (mốc tuỳ bài). */
function hu(id: string, q: Omit<QuyTacTuDong, 'tu' | 'chayToi' | 'moc'> & Partial<QuyTacTuDong> | null,
  trangThai: Hu['trangThai'] = 'dang_chay'): Hu {
  const h = { ...tuTao({ ten: id.toUpperCase() }, LUC_TAO, id), trangThai };
  return q === null ? h : { ...h, tuDong: { tu: NAY, chayToi: null, moc: null, ...q } };
}
/** Khoản với giờ GHI tuỳ bài (`taoLuc`). */
const thu = (id: string, soTien: number, ngay: string, luc: string, huId: string | null = null): Khoan =>
  taoKhoan({ ngay, soTien, chieu: 'thu', huId }, luc, id);
const chi = (id: string, soTien: number, ngay = '2026-09-10'): Khoan =>
  taoKhoan({ ngay, soTien }, `${ngay}T05:00:00.000Z`, id);
let dem = 0;
const sinhId = (): string => `pb${dem++}`;

describe('§I — đặt · đổi · gỡ quy tắc', () => {
  it('⭐⭐ đặt mới ⇒ tính từ HÔM NAY, chưa chạy lần nào', () => {
    const h = datTuDong(tuTao({ ten: 'Xe' }, LUC_TAO, 'h'), { kieu: 'ngay', gt: 50_000 }, NAY);
    expect(h.tuDong).toEqual({ kieu: 'ngay', gt: 50_000, tu: NAY, chayToi: null, moc: null });
  });

  it('⭐⭐ đổi SỐ giữ mốc (ngày đã chạy không chạy lại) · đổi KIỂU tính lại từ hôm nay · gỡ ⇒ mất khoá', () => {
    const h0 = hu('h', { kieu: 'ngay', gt: 50_000, tu: '2026-09-01', chayToi: '2026-09-25', moc: '2026-09-25T14:00:00.000Z' });
    expect(datTuDong(h0, { kieu: 'ngay', gt: 80_000 }, NAY).tuDong).toEqual({ ...h0.tuDong, gt: 80_000 });
    expect(datTuDong(h0, { kieu: 'phan_tram', gt: 10 }, NAY).tuDong)
      .toEqual({ kieu: 'phan_tram', gt: 10, tu: NAY, chayToi: null, moc: null });
    const bo = datTuDong(h0, null, NAY);
    expect('tuDong' in bo).toBe(false);
    const khong = hu('y', null);
    expect(datTuDong(khong, null, NAY), 'không quy tắc ⇒ trả nguyên hũ').toBe(khong);
  });

  it('⭐ số sai ⇒ ném: 0 · âm · lẻ · % quá 100', () => {
    const h = hu('h', null);
    for (const d of [
      { kieu: 'ngay' as const, gt: 0 }, { kieu: 'ngay' as const, gt: -5_000 }, { kieu: 'ngay' as const, gt: 1.5 },
      { kieu: 'phan_tram' as const, gt: 101 },
    ]) expect(() => datTuDong(h, d, NAY)).toThrow(LoiTuDong);
  });
});

describe('§II — ⭐⭐⭐ MỖI NGÀY: ngày chưa chạy thì dồn, đã chạy thì thôi', () => {
  const vi1tr = [thu('luong', 1_000_000, '2026-09-05', '2026-09-05T02:00:00.000Z')];

  it('⭐⭐⭐ đặt hôm nay ⇒ MỘT ngày · đã chạy tới hôm qua ⇒ một · đã chạy hôm nay ⇒ không · bỏ ba ngày ⇒ ba', () => {
    expect(denHan([hu('h', { kieu: 'ngay', gt: 50_000 })], vi1tr, NAY).tong).toBe(50_000);
    expect(denHan([hu('h', { kieu: 'ngay', gt: 50_000, chayToi: '2026-09-25', moc: LUC_TAO })], vi1tr, NAY).tong).toBe(50_000);
    const daChay = denHan([hu('h', { kieu: 'ngay', gt: 50_000, chayToi: NAY, moc: LUC_CHAY })], vi1tr, NAY);
    expect(daChay.tong).toBe(0);
    expect(daChay.ketQua, 'chạy rồi ⇒ im, không hỏi').toBe('khong');
    const d = denHan([hu('h', { kieu: 'ngay', gt: 50_000, chayToi: '2026-09-23', moc: LUC_TAO })], vi1tr, NAY);
    expect(d.phan[0]).toMatchObject({ soNgay: 3, soTien: 150_000 });
  });

  it('⭐⭐ hũ TẠM DỪNG ⇒ phần 0 đồng (nhưng vẫn có mặt để mốc tiến) · hũ XONG ⇒ không có mặt', () => {
    const d = denHan([
      hu('dung', { kieu: 'ngay', gt: 50_000 }, 'tam_dung'),
      hu('xong', { kieu: 'ngay', gt: 70_000 }, 'xong'),
    ], vi1tr, NAY);
    expect(d.phan.map((p) => [p.huId, p.soTien])).toEqual([['dung', 0]]);
    expect(d.tong).toBe(0);
  });
});

describe('§III — ⭐⭐⭐ % TIỀN VÀO: chỉ tiền VÀO MỚI, làm tròn xuống nghìn', () => {
  it('⭐⭐⭐ đặt tối nay ⇒ lương sáng nay (ĐỀ hôm nay) được tính; lương tuần trước thì không', () => {
    const so = [
      thu('cu', 1_000_000, '2026-09-20', '2026-09-20T02:00:00.000Z'),
      thu('nay', 2_000_000, NAY, '2026-09-26T01:00:00.000Z'),
    ];
    const d = denHan([hu('dp', { kieu: 'phan_tram', gt: 10 })], so, NAY);
    expect(d.phan[0]).toMatchObject({ tienVao: 2_000_000, soTien: 200_000 });
  });

  it('⭐⭐⭐ đã chạy ⇒ chỉ khoản GHI sau lần chạy (kể cả ghi bù đề ngày cũ); rút hũ không phải tiền vào', () => {
    const q = { kieu: 'phan_tram' as const, gt: 10, chayToi: NAY, moc: '2026-09-26T10:00:00.000Z' };
    const so = [
      thu('truoc', 2_000_000, NAY, '2026-09-26T09:00:00.000Z'),
      thu('ghiBu', 500_000, '2026-09-24', '2026-09-26T12:00:00.000Z'),
      thu('rut', 300_000, NAY, '2026-09-26T12:30:00.000Z', 'h-khac'),
    ];
    expect(denHan([hu('dp', q)], so, NAY).phan[0]).toMatchObject({ tienVao: 500_000, soTien: 50_000 });
  });

  it('⭐⭐ làm tròn XUỐNG nghìn (C5): 10 % của 2.345.500 = 234.000', () => {
    const so = [thu('t', 2_345_500, NAY, '2026-09-26T01:00:00.000Z')];
    expect(denHan([hu('dp', { kieu: 'phan_tram', gt: 10 })], so, NAY).phan[0]!.soTien).toBe(234_000);
  });
});

describe('§IV — ⭐⭐⭐ KHỚP ⇒ tự chia · THIẾU / THỪA ⇒ hỏi', () => {
  it('⭐⭐⭐ KHỚP: 50.000/ngày, ví 1 triệu, không tiền vào mới', () => {
    const so = [thu('luong', 1_000_000, '2026-09-05', '2026-09-05T02:00:00.000Z'), chi('an', 200_000)];
    const d = denHan([hu('xe', { kieu: 'ngay', gt: 50_000, chayToi: '2026-09-25', moc: '2026-09-25T13:00:00.000Z' })], so, NAY);
    expect(d).toMatchObject({ tong: 50_000, conLai: 800_000, tienVaoMoi: 0, thieu: 0, ketQua: 'khop' });
  });

  it('⭐⭐⭐ THIẾU: đến hạn 250.000, ví còn 120.000 ⇒ thiếu 130.000', () => {
    const so = [thu('t', 120_000, '2026-09-05', '2026-09-05T02:00:00.000Z')];
    const d = denHan([hu('xe', { kieu: 'ngay', gt: 250_000, chayToi: '2026-09-25', moc: LUC_TAO })], so, NAY);
    expect(d).toMatchObject({ tong: 250_000, conLai: 120_000, thieu: 130_000, ketQua: 'thieu' });
  });

  it('⭐⭐⭐ THỪA: lương 2 triệu hôm nay, quy tắc XE 50k/ngày + DỰ PHÒNG 10% ⇒ chia 250.000, còn tiền vào mới ngoài quy tắc', () => {
    const so = [thu('luong', 2_000_000, NAY, '2026-09-26T01:00:00.000Z'), chi('an', 45_000, NAY), chi('grab', 100_000, NAY)];
    const d = denHan([
      hu('xe', { kieu: 'ngay', gt: 50_000, chayToi: '2026-09-25', moc: '2026-09-25T13:00:00.000Z' }),
      hu('dp', { kieu: 'phan_tram', gt: 10, chayToi: '2026-09-25', moc: '2026-09-25T13:00:00.000Z' }),
    ], so, NAY);
    expect(d).toMatchObject({ tong: 250_000, conLai: 1_855_000, tienVaoMoi: 2_000_000, thua: 1_800_000, ketQua: 'thua' });
  });

  it('⭐⭐ "thừa" đo trên TIỀN VÀO MỚI, không trên cả ví — ví còn nhiều mà không tiền vào mới thì vẫn KHỚP', () => {
    const so = [thu('cu', 9_000_000, '2026-09-05', '2026-09-05T02:00:00.000Z')];
    expect(denHan([hu('xe', { kieu: 'ngay', gt: 50_000, chayToi: '2026-09-25', moc: '2026-09-25T13:00:00.000Z' })], so, NAY)
      .ketQua).toBe('khop');
  });

  it('⭐⭐ phần lẻ do làm tròn KHÔNG phải thừa: 100 % của 2.345.500 ⇒ khớp; 99 % ⇒ thừa 23.455', () => {
    const so = [thu('t', 2_345_500, NAY, '2026-09-26T01:00:00.000Z')];
    expect(denHan([hu('dp', { kieu: 'phan_tram', gt: 100 })], so, NAY)).toMatchObject({ tong: 2_345_000, thua: 0, ketQua: 'khop' });
    expect(denHan([hu('dp', { kieu: 'phan_tram', gt: 99 })], so, NAY)).toMatchObject({ thua: 23_455, ketQua: 'thua' });
  });

  it('⭐ THIẾU đứng trước THỪA · không quy tắc nào ⇒ im', () => {
    const so = [thu('t', 100_000, NAY, '2026-09-26T01:00:00.000Z')];
    expect(denHan([hu('xe', { kieu: 'ngay', gt: 500_000 })], so, NAY).ketQua).toBe('thieu');
    expect(denHan([hu('h', null)], so, NAY)).toMatchObject({ phan: [], tong: 0, ketQua: 'khong' });
  });
});

describe('§V — ⭐⭐⭐ chạy một lần: khoản phân bổ + mốc tiến', () => {
  const soKhop = [thu('luong', 1_000_000, '2026-09-05', '2026-09-05T02:00:00.000Z')];
  const huKhop = [hu('xe', { kieu: 'ngay', gt: 50_000, chayToi: '2026-09-25', moc: '2026-09-25T13:00:00.000Z' })];

  it('⭐⭐⭐ CHIA ĐỦ ⇒ một khoản `tu_dong` mỗi quy tắc, mốc tiến tới hôm nay; chạy lại ⇒ không còn gì đến hạn', () => {
    const kq = chayQuyTac(huKhop, soKhop, NAY, LUC_CHAY, 'du', sinhId);
    expect(kq.khoan).toHaveLength(1);
    expect(kq.khoan[0]).toMatchObject({ chieu: 'chi', huId: 'xe', soTien: 50_000, phanBo: 'tu_dong', ngay: NAY, taoLuc: LUC_CHAY });
    expect(kq.hu[0]!.tuDong).toMatchObject({ chayToi: NAY, moc: LUC_CHAY });
    const soSau = [...soKhop, ...kq.khoan];
    expect(laChiTieu(kq.khoan[0]!), 'tự chia không phải tiêu').toBe(false);
    expect(tienConLai(soSau)).toBe(950_000);
    expect(denHan(kq.hu, soSau, NAY)).toMatchObject({ tong: 0, ketQua: 'khong' });
  });

  it('⭐⭐⭐ CHIA ĐỦ khi ví THIẾU ⇒ ném — thiếu phải hỏi, không được chia bằng tiền không có', () => {
    const so = [thu('t', 20_000, '2026-09-05', '2026-09-05T02:00:00.000Z')];
    expect(() => chayQuyTac(huKhop, so, NAY, LUC_CHAY, 'du', sinhId)).toThrow(LoiTuDong);
  });

  it('⭐⭐⭐ THEO TỈ LỆ: 300k + 200k đến hạn, ví 125.500 ⇒ 75.000 + 50.000 (xuống nghìn, không vượt ví) · mốc tiến', () => {
    const h2 = [
      hu('a', { kieu: 'ngay', gt: 300_000, chayToi: '2026-09-25', moc: LUC_TAO }),
      hu('b', { kieu: 'ngay', gt: 200_000, chayToi: '2026-09-25', moc: LUC_TAO }),
    ];
    const so = [thu('t', 125_500, '2026-09-05', '2026-09-05T02:00:00.000Z')];
    const d = denHan(h2, so, NAY);
    expect(phanTiLe(d)).toEqual([75_000, 50_000]);
    const kq = chayQuyTac(h2, so, NAY, LUC_CHAY, 'ti_le', sinhId);
    expect(kq.khoan.map((x) => x.soTien), 'một nguồn: nút TỈ LỆ và cú chia thật ra cùng số').toEqual(phanTiLe(d));
    expect(kq.hu.every((x) => x.tuDong!.chayToi === NAY)).toBe(true);
  });

  it('⭐⭐ BỎ QUA ⇒ không khoản nào, mốc VẪN tiến (bỏ qua là một quyết định, không hỏi lại) · hũ tạm dừng cũng tiến mốc', () => {
    const h2 = [...huKhop, hu('dung', { kieu: 'ngay', gt: 30_000, chayToi: '2026-09-20', moc: LUC_TAO }, 'tam_dung')];
    const kq = chayQuyTac(h2, soKhop, NAY, LUC_CHAY, 'bo_qua', sinhId);
    expect(kq.khoan).toEqual([]);
    expect(kq.hu.map((x) => [x.id, x.tuDong!.chayToi])).toEqual([['xe', NAY], ['dung', NAY]]);
    expect(denHan(kq.hu, soKhop, NAY).ketQua).toBe('khong');
  });

  it('⭐ khoản phân bổ có sẵn trong sổ (chạm tay) KHÔNG phải tiền vào mới', () => {
    const tay = taoKhoanPhanBo({ ngay: NAY, soTien: 100_000, huId: 'xe', phanBo: 'tay' }, LUC_CHAY, 'tay');
    expect(denHan(huKhop, [...soKhop, tay], NAY)).toMatchObject({ tienVaoMoi: 0, conLai: 900_000 });
  });
});
