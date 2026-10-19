/**
 * D511 — LÕI MUA ĐUỔI TRONG MÀN (chuỗi săn bước 3; demo `LOI.mua_duoi` · `truotVao` · `chuoiXanh` · `dongVT(.5)` · `nhanHanhVi`). TEST VECTOR CHÉP TAY,
 * viết TRƯỚC code (A8.3):
 *   VÀO / NHỒI   tối đa 3 phần: phần 1–2 = min(floor(V/3), vốn còn) · phần 3 = vốn còn; đã ra hết thì thôi
 *   khớp vào     = giá × (1 + trượt × (1 + 0,25 × chuỗi xanh)/10⁴) × (1 + cú tự đẩy)
 *                  chuỗi xanh = số nến XEM liền nhau xanh tính tới nến đang chạy (nến đang chạy: giá nhịp này > giá mở của nó)
 *   CHỐT NỬA     = min(đang cầm, max(1, floor(đã mua/2))) theo FIFO · CHỐT HẾT = đang cầm; ra = giá × (1 − trượt/10⁴) (he 1)
 *   phần lãi     = floor(tiền × (ra − khớp)/khớp) TỪNG phần
 *   nến TRẮNG BÊN BÁN chặn VÀO · TRẮNG BÊN MUA chặn CHỐT
 * Mã thử: CP Chứng khoán (trượt 50 bp). V = 900, giá 100 trừ các nhịp ghi rõ.
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
  ketQuaMan({ min, von: 900, ma: 'cp_cn', la: 'mua_duoi', lenh, ...p });

describe('§I — nút', () => {
  it('Mua Đuổi: VÀO/NHỒI (`vao`) · CHỐT NỬA · CHỐT HẾT', () => {
    expect(NUT_LOI.mua_duoi).toEqual(['vao', 'chot_nua', 'chot_het']);
  });
});

describe('§II — vector chép tay', () => {
  it('A · VÀO ở 100, nến đang chạy chưa xanh (chuỗi 0): 300 khớp 100,5; CHỐT HẾT ở 110 ⇒ ra 109,45 ⇒ floor(300 × 8,95/100,5) = 26', () => {
    const kq = chay(dong(diem({ 160: 110 })), [L(0, 'vao'), L(160, 'chot_het')]);
    expect(kq.vao.map((v) => [v.tien, +v.khop.toFixed(6)])).toEqual([[300, 100.5]]);
    expect(kq.ra[0]!.lai).toBe(26);
    expect(kq.theoLenh).toBe(26);
  });

  it('B · NHỒI 3 phần (100,5 · 102,6375 · 104,65 — chuỗi 1 ⇒ trượt ×1,25), lần thứ tư bị bỏ; CHỐT NỬA 450 FIFO ở 106 ⇒ 14 + 4 = 18; CHỐT HẾT ở 100 ⇒ −5 − 15 ⇒ tổng −2', () => {
    const kq = chay(dong(diem({ 16: 102, 32: 104, 48: 106 })), [L(0, 'vao'), L(16, 'vao'), L(32, 'vao'), L(40, 'vao'), L(48, 'chot_nua'), L(64, 'chot_het')]);
    expect(kq.vao.map((v) => [v.tien, +v.khop.toFixed(6)])).toEqual([[300, 100.5], [300, 102.6375], [300, 104.65]]);
    expect(kq.ra.map((r) => [r.tien, r.lai])).toEqual([[450, 18], [450, -20]]);
    expect(kq.theoLenh).toBe(-2);
  });

  it('C · chuỗi 5 nến xanh (4 nến đóng xanh + nến đang chạy xanh) ⇒ trượt 50 × 2,25 ⇒ khớp 105 × 1,01125 = 106,18125; nhãn ĐUỔI MUỘN', () => {
    const g = (k: number) => (k < 16 ? 101 : k < 32 ? 102 : k < 48 ? 103 : k < 64 ? 104 : 105);
    const kq = chay(dong(g), [L(64, 'vao'), L(200, 'chot_het')]);
    expect(kq.vao[0]!.khop).toBeCloseTo(106.18125, 8);
    expect(kq.nhan).toContain('duoi_muon');
  });

  it('B2 · V = 1.000: ba phần 333 · 333 · 334 — phần ba lấy TRỌN vốn còn, không phải 1/3', () => {
    const kq = chay(dong(diem({})), [L(0, 'vao'), L(16, 'vao'), L(32, 'vao')], { von: 1000 });
    expect(kq.vao.map((v) => v.tien)).toEqual([333, 333, 334]);
  });

  it('D · nến TRẮNG BÊN BÁN chặn VÀO; TRẮNG BÊN MUA chặn CHỐT', () => {
    expect(chay(dong(diem({}), { trangBan: [0] }), [L(0, 'vao')]).hut).toEqual([{ nhip: 0, ben: 'ban' }]);
    expect(chay(dong(diem({}), { trang: [10] }), [L(0, 'vao'), L(80, 'chot_het')]).hut).toEqual([{ nhip: 80, ben: 'mua' }]);
  });

  it('E · đã CHỐT HẾT thì VÀO nữa bị bỏ; không bấm ⇒ giữ suốt', () => {
    const kq = chay(dong(diem({})), [L(0, 'vao'), L(20, 'chot_het'), L(40, 'vao')]);
    expect(kq.vao).toHaveLength(1);
    expect(chay(dong(diem({})), []).tuDong).toBe(true);
  });

  it('F · sổ giữa màn có tạm tính (cùng phép đánh dấu với Bắt Đáy)', () => {
    const kq = chay(dong(diem({ 160: 110 })), [L(0, 'vao')], { denNhip: 0 });
    expect(kq.tamTinh!(160)).toBe(26);
  });

  it('vế ngược: Bắt Đáy không nhận nút của Mua Đuổi', () => {
    expect(ketQuaMan({ min: dong(diem({})), von: 900, ma: 'cp_cn', la: 'bat_day', lenh: [L(0, 'vao')] }).vao).toEqual([]);
  });
});
