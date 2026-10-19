/**
 * v17 — LỆNH BÁN KHỐNG (doc 05). Vector tay đi trước (A8.3) + đường chạy thật.
 */
import { describe, expect, it } from 'vitest';
import { BAN_KHONG_LENH, luatCua } from '../config/holdem.js';
import {
  apDinhGia, apLenhGiaoDich, apPhiGiuKhong, giaiLenhMoc, navCua, type GheNav,
} from '../server/holdem/nav.js';
import {
  apLenhMocNav, giaiQuyetVong, taoTran, xepHang, type GheMoi,
} from '../server/holdem/engine.js';

const ghe = (von: number, khong: Record<string, number> = {}): GheNav =>
  ({ von, vi_the: {}, vi_the_khong: { ...khong } });

describe('VECTOR TAY — sổ khống', () => {
  it('mở khống 1.000 BTC: trượt 12, ký quỹ 988, NAV mất đúng phần trượt', () => {
    const g = ghe(10000);
    const r = apLenhGiaoDich(g, [{ ma: 'btc', tien: 1000, khong: true }]);
    expect(r.loi).toBeNull();
    expect(g.von).toBe(9000);
    expect(g.vi_the_khong!.btc).toBe(988);
    expect(navCua(g)).toBe(9988);
  });

  it('định giá ĐẢO: btc −500bp ⇒ ký quỹ NỞ floor(988×10500/10000)=1037; +bp thì teo', () => {
    const g = ghe(0, { btc: 988 });
    const r = apDinhGia(g, { btc: -500 }, 0);
    expect(g.vi_the_khong!.btc).toBe(1037);
    expect(r.tien_theo_ma['khong:btc']).toBe(49);
    const g2 = ghe(0, { btc: 1000 });
    apDinhGia(g2, { btc: 10000 }, 0);       // mã ×2 ⇒ ký quỹ cháy về 0, xoá ô
    expect(g2.vi_the_khong!.btc).toBeUndefined();
    expect(navCua(g2)).toBe(0);
  });

  it('trần khống 30% NAV: mở quá bị chặn NÓI RA', () => {
    const g = ghe(10000);
    expect(apLenhGiaoDich(g, [{ ma: 'btc', tien: 3500, khong: true }]).loi)
      .toBe('qua_tran_khong');
    expect(apLenhGiaoDich(g, [{ ma: 'btc', tien: 2900, khong: true }]).loi).toBeNull();
  });

  it('phí giữ mỗi vòng 150bp trên ký quỹ: floor(988×150/10000)=14', () => {
    const g = ghe(0, { btc: 988 });
    expect(apPhiGiuKhong(g)).toBe(14);
    expect(g.vi_the_khong!.btc).toBe(974);
    expect(BAN_KHONG_LENH.PHI_GIU_BP).toBe(150);
  });

  it('mốc: MỞ khống cần lá ban_khong; ĐÓNG thì luôn được', () => {
    const g = ghe(10000, { btc: 500 });
    expect(giaiLenhMoc(g, [{ ma: 'btc', chieu: 'khong', moc_bp: 2500 }], false,
      { coBanKhong: false }).loi).toBe('can_la_ban_khong');
    expect(giaiLenhMoc(g, [{ ma: 'btc', chieu: 'khong', moc_bp: 2500 }], false,
      { coBanKhong: true }).loi).toBeNull();
    const dong = giaiLenhMoc(g, [{ ma: 'btc', chieu: 'dong_khong', moc_bp: 10000 }],
      false, { coBanKhong: false });
    expect(dong.loi).toBeNull();
    expect(dong.lenh[0]).toEqual({ ma: 'btc', tien: -500, khong: true });
  });
});

describe('đường chạy thật (v17)', () => {
  const gheMoi = (id: string, ct: string[] = []): GheMoi => ({
    id, loai: 'bot', bac_rank: 'Đồng',
    danh_muc: { tai_san: [], chien_thuat: ct as never },
  });
  const THEO = () => ({ loai: 'theo' as const });

  it('ghế cầm lá mở khống qua apLenhMocNav; mã rơi thì NAV ghế khống hưởng', () => {
    let st = taoTran(5, [gheMoi('a', ['ban_khong']), gheMoi('b')],
      luatCua('balance-v17-khong'));
    const r = apLenhMocNav(st, 'a', [{ ma: 'btc', chieu: 'khong', moc_bp: 2500 }]);
    expect(r.ok).toBe(true);
    st = r.st;
    expect(st.ghe.find((g) => g.id === 'a')!.vi_the_khong!.btc).toBeGreaterThan(0);
    // Sổ khống KHÔNG vào gương tai_san (vị thế độc lập).
    expect(st.ghe.find((g) => g.id === 'a')!.danh_muc.tai_san).toEqual([]);
    const kq = giaiQuyetVong(st, THEO);
    expect(kq.ketQua.ket_qua.find((k) => k.ghe_id === 'a')!.nav_sau)
      .toBeGreaterThan(0);
  });

  it('LỖI FOUNDER BÁO 01/08 — xếp hạng cuối theo NAV, không phải tiền mặt', () => {
    let st = taoTran(9, [gheMoi('a'), gheMoi('b'), gheMoi('c')],
      luatCua('balance-v17-khong'));
    // a all-in vào vị thế (tiền mặt ~0, NAV cao); b ôm tiền nhưng đốt bớt.
    st = apLenhMocNav(st, 'a', [{ ma: 'usd', chieu: 'mua', moc_bp: 10000 }]).st;
    const iB = st.ghe.findIndex((g) => g.id === 'b');
    st = { ...st, ghe: st.ghe.map((g, i) => (i === iB ? { ...g, von: 4000 } : g)) };
    const hang = xepHang(st);
    // NAV a ≈ 9.988 > c 10.000? c nguyên 10.000 — a sau trượt ~9.988 → c > a > b.
    expect(hang.indexOf('a')).toBeLessThan(hang.indexOf('b'));
    expect(hang[hang.length - 1]).toBe('b');
  });

  it('cổng version: v15 mở khống bị từ chối rõ', () => {
    const st = taoTran(5, [gheMoi('a', ['ban_khong']), gheMoi('b')],
      luatCua('balance-v15-chuky'));
    expect(apLenhMocNav(st, 'a', [{ ma: 'btc', chieu: 'khong', moc_bp: 2500 }]).loi)
      .toBe('can_la_ban_khong');
  });
});
