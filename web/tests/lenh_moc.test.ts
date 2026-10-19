/**
 * LUẬT GỘP LỆNH MỐC — vá bug xung đột mua/bán (founder 08/08).
 *
 * ⚠ Bug gốc: cùng mã NGƯỢC chiều thì cả hai lệnh cùng nằm hàng đợi — engine
 * chạy cả hai (bán trước mua sau), kết quả không khớp ý định nào, trượt giá ×2.
 */
import { describe, expect, it } from 'vitest';
import {
  TRAN_LENH, lenhCanLaChuaCam, themLenhMoc, type LenhMocNhap,
} from '@/lib/lenh_moc';

const L = (ma: string, chieu: LenhMocNhap['chieu'], moc = 2500): LenhMocNhap =>
  ({ ma, chieu, moc_bp: moc });

describe('Xung đột trong cùng một vế → lệnh sau ĐÈ lệnh trước', () => {
  it('⭐ MUA rồi đổi ý BÁN cùng mã → chỉ còn BÁN (bug founder báo)', () => {
    const ds = themLenhMoc([L('btc', 'mua')], L('btc', 'ban', 5000));
    expect(ds).toEqual([L('btc', 'ban', 5000)]);
  });

  it('BÁN rồi đổi ý MUA → chỉ còn MUA', () => {
    expect(themLenhMoc([L('btc', 'ban')], L('btc', 'mua'))).toEqual([L('btc', 'mua')]);
  });

  it('vế SHORT y hệt: mở khống rồi đóng khống → chỉ còn lệnh sau', () => {
    expect(themLenhMoc([L('btc', 'khong')], L('btc', 'dong_khong', 10000)))
      .toEqual([L('btc', 'dong_khong', 10000)]);
  });

  it('cùng chiều = THAY MỐC (luật cũ giữ nguyên — 18 tag một mã, D67)', () => {
    expect(themLenhMoc([L('btc', 'mua', 2500)], L('btc', 'mua', 5000)))
      .toEqual([L('btc', 'mua', 5000)]);
  });
});

describe('⚠ Hai combo ĐẢO CHIỀU là nước đi thật — không được nuốt', () => {
  it('bán long + mở khống cùng mã: CẢ HAI sống (đảo long→short)', () => {
    const ds = themLenhMoc([L('btc', 'ban', 10000)], L('btc', 'khong'));
    expect(ds).toEqual([L('btc', 'ban', 10000), L('btc', 'khong')]);
  });

  it('đóng khống + mua cùng mã: CẢ HAI sống (đảo short→long)', () => {
    const ds = themLenhMoc([L('btc', 'dong_khong', 10000)], L('btc', 'mua'));
    expect(ds).toEqual([L('btc', 'dong_khong', 10000), L('btc', 'mua')]);
  });
});

describe('Không đụng mã khác + trần', () => {
  it('lệnh mã KHÁC không bị luật gộp chạm vào', () => {
    const ds = themLenhMoc([L('vang', 'mua'), L('btc', 'mua')], L('btc', 'ban'));
    expect(ds).toEqual([L('vang', 'mua'), L('btc', 'ban')]);
  });

  it(`quá ${TRAN_LENH} lệnh → bỏ CŨ nhất, khớp tầng nhận server`, () => {
    let ds: LenhMocNhap[] = [];
    for (let i = 0; i < TRAN_LENH + 3; i += 1) ds = themLenhMoc(ds, L(`ma_${i}`, 'mua'));
    expect(ds).toHaveLength(TRAN_LENH);
    expect(ds[0]!.ma).toBe('ma_3');
  });
});

describe('§4.5c — lệnh CẦN LÁ CHƯA CẦM (nhốt KHỚP NGAY, lọc khi bỏ chọn lá)', () => {
  const CHUA_GI = { chiaLenh: false, banKhong: false, buocThoBp: 2500 };

  it('mở khống khi chưa cầm Bán Khống → bị điểm danh', () => {
    expect(lenhCanLaChuaCam([L('btc', 'khong')], CHUA_GI))
      .toEqual([L('btc', 'khong')]);
    expect(lenhCanLaChuaCam([L('btc', 'khong')], { ...CHUA_GI, banKhong: true }))
      .toEqual([]);
  });

  it('⚠ ĐÓNG khống LUÔN được — không ai bị giam trong vị thế vì lỡ bán lá (v17)', () => {
    expect(lenhCanLaChuaCam([L('btc', 'dong_khong', 10000)], CHUA_GI)).toEqual([]);
  });

  it('mốc mịn 5% khi chưa cầm Chia Lệnh → bị điểm danh; ALL-IN thì không', () => {
    expect(lenhCanLaChuaCam([L('vang', 'mua', 500)], CHUA_GI))
      .toEqual([L('vang', 'mua', 500)]);
    expect(lenhCanLaChuaCam([L('vang', 'mua', 500)], { ...CHUA_GI, chiaLenh: true }))
      .toEqual([]);
    expect(lenhCanLaChuaCam(
      [L('vang', 'mua', 10000), L('btc', 'ban', 2500)], CHUA_GI)).toEqual([]);
  });
});
