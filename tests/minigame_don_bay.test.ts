/**
 * D492 — LÕI ĐÒN BẨY TRONG MÀN. TEST VECTOR CHÉP TAY, viết TRƯỚC code (A8.3). Chép demo đã chốt (`moVT` · `dongVT` · `laiVay` · `dbVonCon` ·
 * `dbGia` · `tangDb` · `nap` · `banHet`, lõi `don_bay`):
 *   khớp vào  = giá × (1 + trượt/10⁴)                                  mỗi PHẦN: tiền = vốn màn V, hệ số `he` (VÀO ×L ⇒ he = L; TĂNG ×K ⇒ he = K − L)
 *   lãi vay   = floor(tiền × vay × ((1 + pct/9 %)^(n/30) − 1))          vay = he − 1 (phần VÀO) · he (phần TĂNG) · n = số nến gốc đã giữ (16 nhịp/nến)
 *   ra        = giá × (1 − trượt × bội × k/10⁴)                        k = 1 + 0,1 × (he bình quân − 1); thanh lý ×1,5; bội 3 khi nến TRẮNG BÊN MUA
 *   phần lãi  = floor(tiền × he × (ra − khớp)/khớp) − lãi vay
 *   ký quỹ Q  = V + Σ nạp nhận                                         gọi: vốn còn ≤ 0,5 Q · thanh lý: vốn còn ≤ 0,1 Q (xét MỌI nhịp)
 *   ngưỡng(t) = (t·Q − Q − đã chốt + Σ tiền·he + Σ lãi vay thô) / (c × Σ tiền·he/khớp)   c = 1 − trượt/10⁴ — giá ≤ ngưỡng ⇔ vốn còn ≤ t·Q
 *   nạp       = min(floor(V × 0,2), khoản còn) · phí = floor(nạp × (trượt mã nạp + 20)/10⁴) · nhận = nạp − phí
 *   theo lệnh T = max(Σ phần lãi, −Q) · lãi lỗ màn = T − giữ + Σ nhận (khoản mã chính nhận lại phần đã nạp) · khoản nạp: − nạp
 * Mã thử: CP Chứng khoán (trượt 50 bp, nấc nền VỪA). V = 1.000, giá 100 trừ các nhịp ghi rõ. Lãi vay ẢM ĐẠM 9 %.
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, SO_NHIP } from '../config/minigame.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { ketQuaMan, type LenhMan } from '../server/holdem/minigame/khop.js';
import { apMg } from '../server/holdem/minigame/quyet_toan.js';

function dong(gia: (k: number) => number, co: { trang?: number[] } = {}): NenMin[] {
  const ra: NenMin[] = [];
  for (let i = 0; i < NEN_LS * K_MIN; i++) ra.push({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 0, iSong: i, rut: 0, quet: null });
  let truoc = 100;
  for (let j = 0; j < SO_NHIP / 8; j++) {
    const tick = Array.from({ length: 8 }, (_, t) => gia(j * 8 + t));
    ra.push({ o: truoc, c: tick[7]!, h: Math.max(truoc, ...tick), l: Math.min(truoc, ...tick), tick, v: 0, iSong: j, rut: 0, quet: null,
      ...(co.trang?.includes(j) ? { trang: true } : {}) });
    truoc = tick[7]!;
  }
  return ra;
}
const diem = (m: Record<number, number>) => (k: number) => m[k] ?? 100;
let seq = 0;
const L = (nhip: number, nut: string): LenhMan => ({ seq: ++seq, nhip, nut });
const chay = (min: NenMin[], lenh: LenhMan[], p: { napTu?: Record<string, number>; denNhip?: number } = {}) =>
  ketQuaMan({ min, von: 1000, ma: 'cp_cn', la: 'don_bay', lenh, laiVayPct: 9, ...p });

describe('§I — vector chép tay', () => {
  it('A · VÀO ×10 ở 100, CHỐT ở 101 sau 10 nến: phần lãi floor(10000 × (100,0405 − 100,5)/100,5) = −46, lãi vay 29 ⇒ −75', () => {
    const kq = chay(dong(diem({ 160: 101 })), [L(0, 'vao_x10'), L(160, 'chot')]);
    expect(kq.vao[0]!.khop).toBeCloseTo(100.5, 10);
    expect(kq.ra[0]!.ra).toBeCloseTo(100.0405, 10);   // 101 × (1 − 50 × 1,9/10⁴)
    expect(kq.ra[0]!.lai).toBe(-75);
    expect(kq.theoLenh).toBe(-75);
    expect(kq.loi).toBe(-75);
    expect(kq.db!.L).toBe(10);
    expect(kq.db!.thanhLy).toBeNull();
    expect(kq.nhan).toEqual(['db_x10']);
  });

  it('B · ×10 bị GỌI ở 95 (nhịp 16) rồi THANH LÝ ở 91 (nhịp 32): ra 91 × (1 − 50 × 2,85/10⁴) ⇒ −1.075 − 5 vay ⇒ trần −1.000', () => {
    const kq = chay(dong(diem({ 16: 95, 32: 91 })), [L(0, 'vao_x10'), L(200, 'chot')]);
    expect(kq.db!.daGoi).toBe(true);
    expect(kq.db!.thanhLy).toEqual({ nhip: 32, gia: 91 });
    expect(kq.ra).toHaveLength(1);                     // CHỐT ở nhịp 200 tới sau khi đã bị thanh lý ⇒ bỏ
    expect(kq.ra[0]!.ra).toBeCloseTo(89.70325, 10);
    expect(kq.ra[0]!.lai).toBe(-1080);
    expect(kq.theoLenh).toBe(-1000);
    expect(kq.chamTran).toBe(true);
    expect(kq.loi).toBe(-1000);
    expect(kq.nhan).toEqual(['db_x10', 'bi_thanh_ly']);
  });

  it('C · bị gọi ⇒ NẠP Vàng 200 (phí 1, nhận 199): thanh lý dời xuống 90,17 ⇒ 91 KHÔNG thanh lý; CHỐT ở 92 ⇒ −941 · màn −742 · Vàng −200', () => {
    const kq = chay(dong(diem({ 16: 95, 32: 91, 48: 92 })), [L(0, 'vao_x10'), L(20, 'nap_vang'), L(48, 'chot')], { napTu: { vang: 3000 } });
    expect(kq.db!.nap).toEqual([{ ma: 'vang', lay: 200, phi: 1, nhan: 199, nhip: 20, luc: 'chu_dong' }]);
    expect(kq.db!.napNhan).toBe(199);
    expect(kq.db!.thanhLy).toBeNull();
    expect(kq.ra[0]!.ra).toBeCloseTo(91.126, 10);
    expect(kq.ra[0]!.lai).toBe(-941);                  // −933 − 8 vay
    expect(kq.theoLenh).toBe(-941);
    expect(kq.loi).toBe(-742);                         // −941 − 0 + 199
    expect(kq.db!.catKhiGoi).toBe(true);
    expect(kq.nhan).toEqual(['db_x10', 'pha_quy_du_phong', 'ban_tai_san_nap', 'cat_khi_goi']);
  });

  it('D · ×2 rồi TĂNG ×4 khi đang lời: hai phần he 2 + 2, k bán = 1,1 ⇒ 58 + 17 = 75', () => {
    const kq = chay(dong(diem({ 16: 102, 32: 104 })), [L(0, 'vao_x2'), L(16, 'tang_x4'), L(32, 'chot')]);
    expect(kq.vao.map((x) => x.khop)).toEqual([expect.closeTo(100.5, 10), expect.closeTo(102.51, 10)]);
    expect(kq.db!.tang).toEqual([{ nhip: 16, tu: 2, len: 4, khiLoi: true }]);
    expect(kq.ra[0]!.ra).toBeCloseTo(103.428, 10);
    expect(kq.theoLenh).toBe(75);
    expect(kq.nhan).toEqual(['db_x2', 'tang_don_bay', 'nhoi_khi_loi']);
  });

  it('E · đang bị gọi thì KHÔNG được TĂNG; ×10 không TĂNG tiếp; nút ×L thứ hai sau khi đã vào bị bỏ', () => {
    const kq = chay(dong(diem({ 16: 88 })), [L(0, 'vao_x4'), L(16, 'tang_x10'), L(17, 'vao_x10')]);
    expect(kq.vao).toHaveLength(1);
    expect(kq.db!.L).toBe(4);
    expect(kq.db!.tang).toEqual([]);
    const k2 = chay(dong(diem({})), [L(0, 'vao_x10'), L(16, 'tang_x10'), L(17, 'tang_x4')]);
    expect(k2.vao).toHaveLength(1);
  });

  it('F · D507 — BÁN HẾT khi bị gọi KHÔNG còn đóng vị thế (founder 04/10: "bán vào để đỡ đòn bẩy"): dồn khoản nguồn vào ký quỹ, vị thế mở tới hết màn', () => {
    // Trước D507: BÁN HẾT = thanh lý thật ở min(giá, ngưỡng) — luật đó founder đã bỏ. Vector chép tay của luật mới: `minigame_ban_het.test.ts`.
    const kq = chay(dong(diem({ 16: 95 })), [L(0, 'vao_x10'), L(16, 'ban_het')], { napTu: { vang: 3000 } });
    expect(kq.db!.thanhLy).toBeNull();
    expect(kq.db!.banHet).toBe(16);
    expect(kq.db!.nap.map((n) => [n.ma, n.lay, n.luc])).toEqual([['vang', 3000, 'ban_het']]);
    expect(kq.ra.filter((r) => !r.tuDongCuoi)).toEqual([]);
    expect(kq.nhan).not.toContain('cat_khi_goi');
    // không bị gọi ⇒ BÁN HẾT không nhận
    const k2 = chay(dong(diem({})), [L(0, 'vao_x10'), L(16, 'ban_het')]);
    expect(k2.db!.thanhLy).toBeNull();
  });

  it('G · KHÔNG BẤM = giữ suốt; NẠP khi chưa từng bị gọi bị bỏ; nạp không quá khoản còn', () => {
    const kq = chay(dong(diem({ 479: 95 })), []);
    expect(kq.tuDong).toBe(true);
    expect(kq.loi).toBe(0);
    const k2 = chay(dong(diem({})), [L(0, 'vao_x10'), L(10, 'nap_vang')], { napTu: { vang: 3000 } });
    expect(k2.db!.nap).toEqual([]);
    const k3 = chay(dong(diem({ 16: 95 })), [L(0, 'vao_x10'), L(16, 'nap_vang'), L(17, 'nap_vang')], { napTu: { vang: 250 } });
    expect(k3.db!.nap.map((x) => x.lay)).toEqual([200, 50]);
  });
});

describe('§II — ngưỡng server gửi xuống = đúng điều kiện server dùng (client so giá, không tính tiền — C4)', () => {
  it('ngưỡng gọi / thanh lý theo từng nhịp từ sau cú bấm cuối; giá ≤ ngưỡng thanh lý ⇔ server thanh lý ở đúng nhịp đó', () => {
    const min = dong(diem({ 32: 91 }));
    const so = chay(min, [L(0, 'vao_x10')], { denNhip: 0 });
    const ng = so.db!.nguong!;
    expect(ng.tu).toBe(1);
    expect(ng.goi[16 - ng.tu]).toBeCloseTo(95.9849, 3);
    expect(ng.thanhLy[32 - ng.tu]).toBeCloseTo(91.9749, 3);
    expect(so.db!.thanhLy).toBeNull();                 // sổ tới nhịp 0: chưa lộ cú thanh lý tương lai
    expect(so.ra).toEqual([]);
    const full = chay(min, [L(0, 'vao_x10')]);
    expect(full.db!.thanhLy!.nhip).toBe(32);
    // dò mọi nhịp: lần đầu giá ≤ ngưỡng chính là nhịp server thanh lý
    const k = Array.from({ length: SO_NHIP }, (_, i) => i).find((i) => i >= ng.tu && (i === 32 ? 91 : 100) <= ng.thanhLy[i - ng.tu]!);
    expect(k).toBe(32);
  });
});

describe('§III — quyết toán: khoản nạp bị trừ, tiền cân', () => {
  it('apMg: mã chính += lãi lỗ màn, khoản nạp −= nạp; tổng NAV đổi đúng T − giữ − phí', () => {
    const st = { ghe: [{ id: 'ban', da_chay: false, vi_the: { cp_cn: 1000, vang: 3000 } }] } as never;
    const sau = apMg(st, { ban: { ma: 'cp_cn', loi: -742, nap: { vang: 200 } } }) as unknown as { ghe: { vi_the: Record<string, number> }[] };
    expect(sau.ghe[0]!.vi_the).toEqual({ cp_cn: 258, vang: 2800 });
    expect(258 + 2800 - 4000).toBe(-941 - 1);
  });
});
