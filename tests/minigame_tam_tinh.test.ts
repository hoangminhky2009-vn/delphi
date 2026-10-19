/**
 * D504 — LÃI LỖ TẠM TÍNH giữa màn (founder 04/10 chọn A: "giữ lại hiển thị lãi lỗ (số tiền)" mà client không tự tính tiền — C4).
 * TEST VECTOR CHÉP TAY, viết TRƯỚC code (A8.3). Chép demo đã chốt (`laiMo` · `giaDong(g, chieu)` bội 1 · `tongLoi`):
 *   giá đánh dấu  = giá nhịp k × (1 − trượt/10⁴)                    trượt CƠ BẢN (demo `giaDong` bội 1 — không ×bán mạnh, không tự đẩy)
 *   phần đang cầm = floor(tiền × he × (đánh dấu − khớp)/khớp) − lãi vay tới k (chỉ Đòn Bẩy)
 *   tạm tính(k)   = max(đã chốt + Σ phần đang cầm, −(V + Σ nạp nhận)) − phí gài
 * Mã thử: CP Chứng khoán (trượt 50 bp, nấc nền VỪA). V = 1.000, giá 100 trừ các nhịp ghi rõ. Lãi vay ẢM ĐẠM 9 %.
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, SO_NHIP } from '../config/minigame.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { ketQuaMan, type LenhMan } from '../server/holdem/minigame/khop.js';

function dong(gia: (k: number) => number): NenMin[] {
  const ra: NenMin[] = [];
  for (let i = 0; i < NEN_LS * K_MIN; i++) ra.push({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 0, iSong: i, rut: 0, quet: null });
  let truoc = 100;
  for (let j = 0; j < SO_NHIP / 8; j++) {
    const tick = Array.from({ length: 8 }, (_, t) => gia(j * 8 + t));
    ra.push({ o: truoc, c: tick[7]!, h: Math.max(truoc, ...tick), l: Math.min(truoc, ...tick), tick, v: 0, iSong: j, rut: 0, quet: null });
    truoc = tick[7]!;
  }
  return ra;
}
const diem = (m: Record<number, number>) => (k: number) => m[k] ?? 100;
let seq = 0;
const L = (nhip: number, nut: string): LenhMan => ({ seq: ++seq, nhip, nut });
const so = (la: string, min: NenMin[], lenh: LenhMan[], them: { tungTin?: boolean } = {}) =>
  ketQuaMan({ min, von: 1000, ma: 'cp_cn', la, lenh, laiVayPct: 9, denNhip: Math.max(-1, ...lenh.map((x) => x.nhip)), ...them });

describe('§I — Đòn Bẩy: vector chép tay', () => {
  const min = dong(diem({ 16: 80, 160: 101 }));
  const kq = so('don_bay', min, [L(0, 'vao_x10')]);
  it('A · VÀO ×10 ở 100 (khớp 100,5): nhịp 0 giá 100 ⇒ floor(10000 × (99,5 − 100,5)/100,5) = −100, chưa có lãi vay', () => {
    expect(kq.tamTinh!(0)).toBe(-100);
  });
  it('B · nhịp 160 giá 101 (đánh dấu 100,495): floor(−0,4975) = −1, lãi vay 10 nến 29 ⇒ −30 (CHỐT thật ra −75 vì ×bán mạnh — tạm tính theo demo `laiMo`)', () => {
    expect(kq.tamTinh!(160)).toBe(-30);
  });
  it('C · nhịp 16 giá 80: floor(10000 × (79,6 − 100,5)/100,5) − 2 = −2.082 ⇒ trần −1.000', () => {
    expect(kq.tamTinh!(16)).toBe(-1000);
  });
  it('vế ngược: chưa vào · đã CHỐT · đã bị thanh lý ⇒ không có tạm tính (dòng tạm tính đổi sang nhãn trạng thái)', () => {
    expect(so('don_bay', min, []).tamTinh).toBeUndefined();
    expect(so('don_bay', min, [L(0, 'vao_x10'), L(8, 'chot')]).tamTinh).toBeUndefined();
    expect(so('don_bay', dong(diem({ 16: 95, 32: 91 })), [L(0, 'vao_x10'), L(40, 'chot')]).db!.thanhLy).not.toBeNull();
    expect(so('don_bay', dong(diem({ 16: 95, 32: 91 })), [L(0, 'vao_x10'), L(40, 'chot')]).tamTinh).toBeUndefined();
  });
});

describe('§II — Bắt Đáy: vector chép tay', () => {
  it('D · VÀO HẾT ở 100 (khớp 100,5), nhịp 8 giá 110 (đánh dấu 109,45): floor(1000 × 8,95/100,5) = 89', () => {
    expect(so('bat_day', dong(diem({ 8: 110 })), [L(0, 'vao_het')]).tamTinh!(8)).toBe(89);
  });
  it('E · hai lần VÀO NỬA (100,5 · 110,55), nhịp 16 giá 105 (đánh dấu 104,475): floor(19,78) + floor(−27,48) = 19 − 28 = −9 — floor TỪNG phần như quyết toán', () => {
    expect(so('bat_day', dong(diem({ 8: 110, 16: 105 })), [L(0, 'vao_nua'), L(8, 'vao_nua')]).tamTinh!(16)).toBe(-9);
  });
  it('F · ghế TUNG TIN đã gài: phí gài floor(1000 × 300/10⁴) = 30 trừ cả vào tạm tính ⇒ 89 − 30 = 59', () => {
    expect(so('bat_day', dong(diem({ 8: 110 })), [L(-1, 'gai_tot'), L(0, 'vao_het')], { tungTin: true }).tamTinh!(8)).toBe(59);
  });
  it('tính chất: Bắt Đáy (he 1, không ×bán mạnh) — tạm tính ở k = đúng số THOÁT thật ở k (cùng một phép, không bản sao thứ hai)', () => {
    const min = dong(diem({ 8: 110, 16: 93, 24: 104 }));
    const vao = [L(0, 'vao_nua'), L(8, 'vao_nua')];
    const f = so('bat_day', min, vao).tamTinh!;
    for (const k of [8, 16, 24, 40]) expect(ketQuaMan({ min, von: 1000, ma: 'cp_cn', la: 'bat_day', lenh: [...vao, L(k, 'thoat')] }).theoLenh).toBe(f(k));
  });
  it('vế ngược: chưa vào / đã thoát hết ⇒ không có tạm tính', () => {
    const min = dong(diem({ 8: 110 }));
    expect(so('bat_day', min, []).tamTinh).toBeUndefined();
    expect(so('bat_day', min, [L(0, 'vao_het'), L(8, 'thoat')]).tamTinh).toBeUndefined();
  });
});
