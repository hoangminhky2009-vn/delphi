/**
 * SỔ LỜI ĐOÁN CỦA APP (`pfm/so_doan.ts`) — VECTOR CHÉP TAY.
 *
 * ⚠⚠ Bài đắt nhất là §I: **app không được chấm lời đoán trên một kỳ khép lại TRƯỚC khi nó đưa
 * ra lời đoán**. Tuần được niêm phong là tuần ĐÃ KẾT THÚC gần nhất, nên người phỏng vấn thứ Ba
 * rồi chốt sổ ngay sẽ chốt tuần trước — chấm ở đó là tự chấm mà nhìn đáp án.
 *
 * Mốc lịch dùng trong tệp (đã kiểm): 2026-09-21 là THỨ HAI · 2026-05-31 là CHỦ NHẬT, ngày cuối
 * tháng 5 · 2027-01-04 là THỨ HAI.
 */
import { describe, expect, it } from 'vitest';
import { chamKy, kyCanCham, ngayGhiDauTien, thanhTich, type SoDoan } from '../src/pfm/so_doan.js';
import type { Khoan } from '../src/pfm/so.js';

const LUC = '2026-09-01T00:00:00.000Z';
let dem = 0;
function k(ngay: string, soTien: number, chieu: 'chi' | 'thu' = 'chi'): Khoan {
  dem += 1;
  return { id: `c${dem}`, ngay, soTien, chieu, nhan: null, huId: null, cachGhi: 'tay', viSale: null, taoLuc: LUC, suaLuc: LUC };
}

describe('§I — ⭐⭐⭐ KHÔNG CHẤM KỲ ĐÃ KHÉP LẠI TRƯỚC KHI APP ĐOÁN', () => {
  it('⭐⭐⭐ tuần bắt đầu TRƯỚC ngày lời đoán ⇒ null (không chấm)', () => {
    // Đoán hôm thứ Tư 16/09; tuần 14–20/09 mở ra từ thứ Hai 14 ⇒ đã có 2 ngày trước lời đoán.
    expect(kyCanCham('tien_ve', '2026-09-14', '2026-09-16', '2026-09-01')).toBeNull();
  });

  it('tuần bắt đầu TỪ ngày lời đoán trở đi ⇒ chấm, cửa sổ thứ Hai → Chủ nhật', () => {
    expect(kyCanCham('tien_ve', '2026-09-21', '2026-09-16', '2026-09-01'))
      .toEqual({ khoa: 'tuan:2026-09-21', tu: '2026-09-21', den: '2026-09-27' });
  });

  it('lời đoán đưa ra ĐÚNG thứ Hai tuần ấy ⇒ vẫn chấm (không bị loại oan)', () => {
    expect(kyCanCham('ngay_te', '2026-09-21', '2026-09-21', null)?.khoa).toBe('tuan:2026-09-21');
  });

  it('chưa có ngày bắt đầu lời đoán ⇒ null (không có mốc thì không biết kỳ nào hợp lệ)', () => {
    expect(kyCanCham('tien_ve', '2026-09-21', undefined, '2026-09-01')).toBeNull();
  });

  it('`chua_ro` không đoán gì ⇒ không chấm gì', () => {
    expect(kyCanCham('chua_ro', '2026-09-21', '2026-09-01', '2026-09-01')).toBeNull();
  });
});

describe('§I-bis — ⭐⭐ ĐẦU VÀO SAI DẠNG ⇒ null, KHÔNG NÉM', () => {
  it('⭐⭐ tuần dạng ISO `2026-W37` (dạng fixture cũ) ⇒ null thay vì RangeError làm sập màn', () => {
    expect(() => kyCanCham('tien_ve', '2026-W37', '2026-09-01', '2026-09-01')).not.toThrow();
    expect(kyCanCham('tien_ve', '2026-W37', '2026-09-01', '2026-09-01')).toBeNull();
    expect(kyCanCham('cuoi_thang', '2026-W37', '2026-07-01', '2026-07-01')).toBeNull();
  });

  it('mốc lời đoán sai dạng ⇒ null', () => {
    expect(kyCanCham('tien_ve', '2026-09-21', 'hôm qua', '2026-09-01')).toBeNull();
  });
});

describe('§II — lời đoán THEO THÁNG', () => {
  it('⭐ Chủ nhật của tuần là ngày cuối tháng ⇒ chấm CHÍNH tháng ấy', () => {
    expect(kyCanCham('cuoi_thang', '2026-05-25', '2026-04-20', '2026-04-20'))
      .toEqual({ khoa: 'thang:2026-05', tu: '2026-05-01', den: '2026-05-31' });
  });

  it('⭐ Chủ nhật giữa tháng ⇒ chấm tháng LIỀN TRƯỚC (tháng gần nhất đã trọn)', () => {
    expect(kyCanCham('cuoi_thang', '2026-09-21', '2026-07-01', '2026-07-01'))
      .toEqual({ khoa: 'thang:2026-08', tu: '2026-08-01', den: '2026-08-31' });
  });

  it('qua năm: tuần đầu tháng 1 ⇒ tháng 12 năm trước, đủ 31 ngày', () => {
    expect(kyCanCham('cuoi_thang', '2027-01-04', '2026-11-01', '2026-11-01'))
      .toEqual({ khoa: 'thang:2026-12', tu: '2026-12-01', den: '2026-12-31' });
  });

  it('⭐⭐ tháng KHÔNG được ghi từ ngày 1 ⇒ null (nửa đầu trống thì "nửa cuối nhiều hơn" là trúng giả)', () => {
    expect(kyCanCham('cuoi_thang', '2026-09-21', '2026-07-01', '2026-08-03')).toBeNull();
  });

  it('⭐⭐ tháng mở ra TRƯỚC ngày lời đoán ⇒ null (cùng bẫy §I, ở cỡ tháng)', () => {
    expect(kyCanCham('cuoi_thang', '2026-09-21', '2026-08-15', '2026-07-01')).toBeNull();
  });

  it('sổ trống ⇒ null', () => {
    expect(kyCanCham('cuoi_thang', '2026-09-21', '2026-07-01', null)).toBeNull();
  });
});

describe('§III — sổ & thành tích', () => {
  it('⭐ thành tích ĐẾM LẠI từ sổ; `chua_du` không tính', () => {
    const so: SoDoan = {
      'tuan:2026-09-07': { ma: 'tien_ve', kq: 'trung', doDuoc: 1, moc: 2 },
      'tuan:2026-09-14': { ma: 'tien_ve', kq: 'trat', doDuoc: 1, moc: 2 },
      'tuan:2026-09-21': { ma: 'tien_ve', kq: 'chua_du', doDuoc: null, moc: null },
      'thang:2026-08': { ma: 'cuoi_thang', kq: 'trung', doDuoc: 9, moc: 3 },
    };
    expect(thanhTich(so)).toEqual({ trung: 2, trat: 1 });
    expect(thanhTich(undefined)).toEqual({ trung: 0, trat: 0 });
  });

  it('chamKy gói đúng phán quyết + hai số của chamDoan', () => {
    // Sáu ngày chi phẳng 30k + đỉnh ngày 23; ngày 24 nâng lên 50k > trung vị ⇒ ngay_te trúng.
    const so = [21, 22, 23, 24, 25, 26].map((d) => k(`2026-09-${d}`, 30_000));
    so.push(k('2026-09-23', 500_000), k('2026-09-24', 20_000));
    const r = chamKy('ngay_te', so, { khoa: 'tuan:2026-09-21', tu: '2026-09-21', den: '2026-09-27' });
    expect(r).toEqual({ ma: 'ngay_te', kq: 'trung', doDuoc: 50_000, moc: 30_000 });
  });

  it('ngày ghi sớm nhất — mọi chiều, sổ trống ⇒ null', () => {
    expect(ngayGhiDauTien([k('2026-09-10', 1), k('2026-09-03', 1, 'thu'), k('2026-09-20', 1)])).toBe('2026-09-03');
    expect(ngayGhiDauTien([])).toBeNull();
  });
});
