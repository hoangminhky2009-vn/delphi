/**
 * D531 — LÕI LƯỚT SÓNG TRONG MÀN (demo `LOI.luot_song` · `moVT` · `dongVT` · `chotMini`; founder: *"lướt sóng ở demo như nào thì làm như thế"*).
 * Vector CHÉP TAY (A8.3). Mã thử `cp_cn`: trượt 50 bp × `TRUOT_LS` 1,25 = 62,5 bp; vốn màn 1.000; phí `PHI_LS_BP` 45 ⇒ floor(4,5) = 4 mỗi lần khớp.
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, PHI_LS_BP, SO_NHIP, TRUOT_LS } from '../config/minigame.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { ketQuaMan, nutLoiCua, type LenhMan } from '../server/holdem/minigame/khop.js';

/** Dòng mịn thử (chép `v59_ke_lenh.test.ts`): 20 nến lịch sử phẳng 100 + 60 nến chạy từ 480 nhịp; `trang`/`trangBan` theo nến mịn CHẠY. */
function dong(gia: (k: number) => number, co: { trang?: number[]; trangBan?: number[] } = {}): NenMin[] {
  const ra: NenMin[] = [];
  for (let i = 0; i < NEN_LS * K_MIN; i++) ra.push({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 0, iSong: i, rut: 0, quet: null });
  let truoc = 100;
  for (let j = 0; j < SO_NHIP / 8; j++) {
    const tick = Array.from({ length: 8 }, (_, t) => gia(j * 8 + t));
    ra.push({
      o: truoc, c: tick[7]!, h: Math.max(truoc, ...tick), l: Math.min(truoc, ...tick), tick, v: 0, iSong: j, rut: 0, quet: null,
      ...(co.trang?.includes(j) ? { trang: true } : {}), ...(co.trangBan?.includes(j) ? { trangBan: true } : {}),
    });
    truoc = tick[7]!;
  }
  return ra;
}
const diem = (m: Record<number, number>, nen = 100) => (k: number) => m[k] ?? nen;
let seq = 0;
const L = (nhip: number, nut: string, x: { gia_bp?: number } = {}): LenhMan => ({ seq: ++seq, nhip, nut, ...x });
const chay = (min: NenMin[], lenh: LenhMan[], p: { luotSong?: boolean; toChuc?: boolean; ke?: { mua?: true; ban?: true }; denNhip?: number } = {}) =>
  ketQuaMan({ min, von: 1000, ma: 'cp_cn', la: 'luot_song', lenh, luotSong: p.luotSong ?? true,
    ...(p.toChuc ? { toChuc: true } : {}), ...(p.ke ? { ke: p.ke } : {}), ...(p.denNhip !== undefined ? { denNhip: p.denNhip } : {}) });

describe('D531 — hằng số + cổng', () => {
  it('phí 45 bp · trượt ×1,25 (số của demo D462)', () => { expect([PHI_LS_BP, TRUOT_LS]).toEqual([45, 1.25]); });
  it('nút chỉ có ở khoá v60; khoá cũ: Lướt Sóng chỉ xem', () => {
    expect(nutLoiCua('luot_song', true)).toEqual(['dao', 'chot']);
    expect(nutLoiCua('luot_song', false)).toBeUndefined();
    expect(nutLoiCua('bat_day', false)).toEqual(['vao_nua', 'vao_het', 'thoat']);
  });
  it('khoá cũ (không cờ) nhận cú `dao` ⇒ y như trước: chỉ xem, lãi lỗ màn 0, không chân nào', () => {
    const kq = chay(dong(diem({ 100: 90 })), [L(10, 'dao')], { luotSong: false });
    expect([kq.loi, kq.vao.length, kq.tuDong, kq.ls]).toEqual([0, 0, false, undefined]);
  });
});

describe('D531 — vector chép tay', () => {
  it('A · SHORT ở nhịp 10 (100) khớp 99,375 · CHỐT ở nhịp 100 (90) ra 90,5625 ⇒ lãi floor(1000 × 8,8125 / 99,375) = 88 · phí 4 + 4 ⇒ 80', () => {
    const kq = chay(dong(diem({ 100: 90 })), [L(10, 'dao'), L(100, 'chot')]);
    expect(kq.vao[0]).toMatchObject({ chieu: -1, loai: 'short', tien: 1000 });
    expect(kq.vao[0]!.khop).toBeCloseTo(99.375, 9);
    expect(kq.ra[0]!.ra).toBeCloseTo(90.5625, 9);
    expect(kq.ra[0]!.lai).toBe(88);
    expect(kq.ls).toEqual({ chieu: 0, soDao: 0, phi: 8 });
    expect([kq.giu, kq.theoLenh, kq.loi]).toEqual([0, 80, 80]);
  });

  it('B · SHORT 10 → ĐẢO ở 100 (90): đóng short +88, mở LONG 90,5625 · tự chốt cuối (99) ra 98,38125 không phí ⇒ +86 · phí 12 ⇒ 162; giữ −10 ⇒ màn 172', () => {
    const kq = chay(dong(diem({ 100: 90, 479: 99 })), [L(10, 'dao'), L(100, 'dao')]);
    expect(kq.vao.map((v) => [v.chieu, v.loai])).toEqual([[-1, 'short'], [1, 'dao']]);
    expect(kq.ra.map((r) => r.lai)).toEqual([88, 86]);
    expect(kq.ra[1]).toMatchObject({ tuDongCuoi: true, chieu: 1 });
    expect(kq.ls).toEqual({ chieu: 0, soDao: 1, phi: 12 });
    expect([kq.giu, kq.theoLenh, kq.loi]).toEqual([-10, 162, 172]);
  });

  it('C · CHỐT về tiền mặt: phần còn lại của màn không ăn gì (demo: không dựng lại khoản giữ) — SHORT 10, CHỐT 20 (−13, phí 8), giá cuối 80 ⇒ màn 179', () => {
    const kq = chay(dong(diem({ 479: 80 })), [L(10, 'dao'), L(20, 'chot')]);
    expect(kq.ra.map((r) => r.lai)).toEqual([-13]);
    expect([kq.giu, kq.theoLenh, kq.loi]).toEqual([-200, -21, 179]);
  });

  it('D · nến mịn TRẮNG BÊN MUA chặn SHORT (không ai mua) ⇒ hụt; cả màn không chân nào ⇒ vẫn giữ suốt', () => {
    const kq = chay(dong(diem({ 100: 90 }), { trang: [1] }), [L(10, 'dao')]);
    expect(kq.hut).toEqual([{ nhip: 10, ben: 'mua' }]);
    expect([kq.tuDong, kq.loi, kq.vao.length]).toEqual([true, 0, 0]);
  });

  it('E · TRẮNG BÊN BÁN chặn ĐẢO lên LONG (không ai bán) nhưng không chặn SHORT', () => {
    const kq = chay(dong(diem({}), { trangBan: [12] }), [L(10, 'dao'), L(100, 'dao')]);
    expect(kq.vao).toHaveLength(1);
    expect(kq.hut).toEqual([{ nhip: 100, ben: 'ban' }]);
  });

  it('F · KÊ BÁN +5 % mở SHORT đúng 105 (không trượt) + phí 4; tự chốt ở 100 ra 100,625 ⇒ +41 ⇒ màn 37 · kê mua không có vai trò', () => {
    const kq = chay(dong(diem({ 50: 105 })), [L(-1, 'ke_ban', { gia_bp: 500 }), L(-1, 'ke_mua', { gia_bp: -500 })], { ke: { mua: true, ban: true } });
    expect(kq.vao[0]).toMatchObject({ chieu: -1, khop: 105 });
    expect(kq.ra[0]!.lai).toBe(41);
    expect(kq.loi).toBe(37);
    expect(kq.ke?.mua?.khop ?? null).toBeNull();
  });

  it('G · Tổ Chức: SHORT bị ép lên 110 ⇒ chạm TRẦN THUA (8 % vốn) ⇒ chốt ĐÚNG giá trần 107,325, không phí, thôi giao dịch', () => {
    const kq = chay(dong(diem({ 100: 110 })), [L(10, 'dao'), L(200, 'dao')], { toChuc: true });
    expect(kq.tranThua?.nhip).toBe(100);
    expect(kq.tranThua!.gia).toBeCloseTo(107.325, 9);
    expect(kq.ra[0]!.lai).toBeGreaterThanOrEqual(-81);
    expect(kq.ra[0]!.lai).toBeLessThanOrEqual(-80);
    expect(kq.vao).toHaveLength(1);   // cú ĐẢO ở 200 bị bỏ
    expect(kq.ls!.phi).toBe(4);
  });

  it('H · sổ giữa màn (denNhip): đang SHORT ⇒ chiều −1, tạm tính = lãi đang cầm − phí', () => {
    const kq = chay(dong(diem({ 30: 95 })), [L(10, 'dao')], { denNhip: 30 });
    expect(kq.ls).toEqual({ chieu: -1, soDao: 0, phi: 4 });
    expect(kq.tamTinh!(30)).toBe(Math.floor((1000 * (99.375 - 95 * 1.00625)) / 99.375) - 4);
  });

  it('I · đảo ≥ 6 lần ⇒ nhãn ĐẢO NHIỀU', () => {
    const lenh = [10, 20, 30, 40, 50, 60, 70].map((n) => L(n, 'dao'));
    expect(chay(dong(diem({})), lenh).nhan).toContain('dao_nhieu');
  });
});
