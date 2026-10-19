/**
 * D510 — LÕI BÁN KHỐNG TRONG MÀN = ĐÒN BẨY CHIỀU BÁN (founder 05/10: "thêm ký quỹ cho bán khống" · "Bán khống cho mức ký quỹ và cơ chế thanh lý bù hay
 * call margin tương tự đòn bẩy … Cả lãi vay các thứ nữa"; demo bản 41 `nutKyQuy(-1)`). TEST VECTOR CHÉP TAY, viết TRƯỚC code (A8.3).
 * Cùng mọi phép của Đòn Bẩy (D492), đảo chiều:
 *   khớp BÁN    = giá × (1 − trượt/10⁴) × (1 − cú tự đẩy)                 (bán: nhận giá thấp hơn)
 *   ra MUA LẠI  = giá × (1 + trượt × bội × k/10⁴) × (1 + cú tự đẩy)          k = 1 + 0,1 × (he − 1) · mua cưỡng bức ×1,5 · bội 3 khi nến TRẮNG BÊN BÁN
 *   phần lãi    = floor(tiền × he × −(ra − khớp)/khớp) − lãi vay           lãi vay như Đòn Bẩy (vay = he − 1 phần VÀO · he phần TĂNG)
 *   vốn còn     = Q + đã chốt + Σ tiền·he − giá·(1 + trượt/10⁴)·Σ tiền·he/khớp − lãi vay thô
 *   ngưỡng(t)   = (Q + đã chốt + Σ tiền·he − vay − t·Q) / ((1 + trượt/10⁴) × Σ tiền·he/khớp)      GIÁ ≥ ngưỡng ⇔ vốn còn ≤ t·Q
 *   nến TRẮNG BÊN MUA (không ai mua) ⇒ BÁN hụt · TRẮNG BÊN BÁN (không ai bán) ⇒ MUA LẠI hụt
 * Mã thử: CP Chứng khoán (trượt 50 bp). V = 1.000, giá 100 trừ các nhịp ghi rõ. Lãi vay ẢM ĐẠM 9 %.
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, NUT_LOI, SO_NHIP } from '../config/minigame.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { ketQuaMan, type LenhMan } from '../server/holdem/minigame/khop.js';

function dong(gia: (k: number) => number, co: { trang?: number[]; trangBan?: number[] } = {}): NenMin[] {
  const ra: NenMin[] = [];
  for (let i = 0; i < NEN_LS * K_MIN; i++) ra.push({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 0, iSong: i, rut: 0, quet: null });
  let truoc = 100;
  for (let j = 0; j < SO_NHIP / 8; j++) {
    const tick = Array.from({ length: 8 }, (_, t) => gia(j * 8 + t));
    ra.push({ o: truoc, c: tick[7]!, h: Math.max(truoc, ...tick), l: Math.min(truoc, ...tick), tick, v: 0, iSong: j, rut: 0, quet: null,
      ...(co.trang?.includes(j) ? { trang: true } : {}), ...(co.trangBan?.includes(j) ? { trangBan: true } : {}) });
    truoc = tick[7]!;
  }
  return ra;
}
const diem = (m: Record<number, number>) => (k: number) => m[k] ?? 100;
let seq = 0;
const L = (nhip: number, nut: string): LenhMan => ({ seq: ++seq, nhip, nut });
const chay = (min: NenMin[], lenh: LenhMan[], p: Partial<Parameters<typeof ketQuaMan>[0]> = {}) =>
  ketQuaMan({ min, von: 1000, ma: 'cp_cn', la: 'ban_khong', lenh, laiVayPct: 9, ...p });

describe('§I — nút', () => {
  it('Bán Khống có bàn phím ký quỹ: BÁN ×2/×4/×10 · TĂNG · DỒN HẾT (`ban_het`) · MUA LẠI · nạp từ từng khoản (cả Tiền mặt)', () => {
    expect(NUT_LOI.ban_khong).toEqual(['ban_x2', 'ban_x4', 'ban_x10', 'tang_x4', 'tang_x10', 'ban_het', 'mua_lai',
      'nap_btc', 'nap_usd', 'nap_cp_cn', 'nap_vn30', 'nap_vang', 'nap_tpcp', 'nap_tien']);
  });
});

describe('§II — vector chép tay', () => {
  it('A · BÁN ×10 ở 100 (khớp 99,5), MUA LẠI ở 99 sau 10 nến: ra 99 × 1,0095 = 99,9405 ⇒ floor(−10000 × 0,4405/99,5) = −45, lãi vay 29 ⇒ −74', () => {
    const kq = chay(dong(diem({ 160: 99 })), [L(0, 'ban_x10'), L(160, 'mua_lai')]);
    expect(kq.vao[0]!.khop).toBeCloseTo(99.5, 10);
    expect(kq.ra[0]!.ra).toBeCloseTo(99.9405, 10);
    expect(kq.ra[0]!.lai).toBe(-74);
    expect(kq.theoLenh).toBe(-74);
    expect(kq.db!.L).toBe(10);
    expect(kq.nhan).toEqual(['bk_x10']);
  });

  it('B · giá 105 (nhịp 16) ⇒ BỊ GỌI (ngưỡng ~103,95); giá 109 (nhịp 32) ⇒ MUA CƯỠNG BỨC: ra 109 × 1,01425 ⇒ −1.111 − 5 vay ⇒ trần −1.000', () => {
    const kq = chay(dong(diem({ 16: 105, 32: 109 })), [L(0, 'ban_x10'), L(200, 'mua_lai')]);
    expect(kq.db!.daGoi).toBe(true);
    expect(kq.db!.thanhLy).toEqual({ nhip: 32, gia: 109 });
    expect(kq.ra).toHaveLength(1);
    expect(kq.ra[0]!.ra).toBeCloseTo(110.55325, 9);
    expect(kq.ra[0]!.lai).toBe(-1116);
    expect(kq.theoLenh).toBe(-1000);
    expect(kq.nhan).toEqual(['bk_x10', 'bi_thanh_ly']);
  });

  it('C · sổ giữa màn: ngưỡng GỌI ~103,95 và MUA CƯỠNG BỨC ~107,9 nằm TRÊN giá vào; `chieu` −1 để client so ≥', () => {
    const kq = chay(dong(diem({})), [L(0, 'ban_x10')], { denNhip: 0 });
    expect(kq.db!.chieu).toBe(-1);
    expect(kq.db!.nguong!.goi[0]).toBeCloseTo((11000 - 500) / (1.005 * 10000 / 99.5), 2);
    expect(kq.db!.nguong!.thanhLy[0]).toBeCloseTo((11000 - 100) / (1.005 * 10000 / 99.5), 2);
  });

  it('D · tạm tính ở giá 99 sau 10 nến: đánh dấu 99 × 1,005 = 99,495 ⇒ floor(+0,5025) = 0, trừ lãi vay 29 ⇒ −29', () => {
    const kq = chay(dong(diem({ 160: 99 })), [L(0, 'ban_x10')], { denNhip: 0 });
    expect(kq.tamTinh!(160)).toBe(-29);
  });

  it('E · nến TRẮNG BÊN MUA ⇒ BÁN hụt; TRẮNG BÊN BÁN ⇒ MUA LẠI hụt (ngược Đòn Bẩy)', () => {
    const a = chay(dong(diem({}), { trang: [0] }), [L(0, 'ban_x10')]);
    expect(a.vao).toEqual([]);
    expect(a.hut).toEqual([{ nhip: 0, ben: 'mua' }]);
    const b = chay(dong(diem({}), { trangBan: [10] }), [L(0, 'ban_x4'), L(80, 'mua_lai')]);
    expect(b.hut).toEqual([{ nhip: 80, ben: 'ban' }]);
  });

  it('F · vai lớn: BÁN tự đẩy giá XUỐNG, MUA LẠI tự đẩy LÊN', () => {
    const kq = chay(dong(diem({})), [L(0, 'ban_x2'), L(100, 'mua_lai')], { tuDay: 0.01 });
    expect(kq.xungBan[0]!.mag).toBeLessThan(0);
    expect(kq.xungBan[1]!.mag).toBeGreaterThan(0);
  });

  it('G · bị gọi (giá lên) ⇒ DỒN HẾT vào ký quỹ như Đòn Bẩy; vế ngược: chưa gọi thì bỏ', () => {
    const giaTang = dong((k) => (k >= 16 && k < 40 ? 105 : 100));
    const kq = chay(giaTang, [L(0, 'ban_x10'), L(20, 'ban_het')], { napTu: { tien: 500 } });
    expect(kq.db!.banHet).toBe(20);
    expect(kq.db!.napNhan).toBe(500);
    expect(chay(dong(diem({})), [L(0, 'ban_x10'), L(20, 'ban_het')], { napTu: { tien: 500 } }).db!.banHet).toBeNull();
  });

  it('vế ngược: lõi Đòn Bẩy KHÔNG nhận nút của Bán Khống và ngược lại', () => {
    expect(ketQuaMan({ min: dong(diem({})), von: 1000, ma: 'cp_cn', la: 'don_bay', lenh: [L(0, 'ban_x10')], laiVayPct: 9 }).vao).toEqual([]);
    expect(chay(dong(diem({})), [L(0, 'vao_x10')]).vao).toEqual([]);
  });
});
