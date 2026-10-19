/**
 * D528 — khoá v59: KÊ LỆNH (trait KÊ MUA / KÊ BÁN) · TÂM LÝ YẾU · trần thua Tổ Chức áp KHOẢN GIỮ SUỐT. TEST VECTOR CHÉP TAY (A8.3).
 *
 * Mã thử CP Chứng khoán (trượt 50 bp, nấc nền VỪA). V = 1.000, giá mở 100. Ký hiệu như `minigame_khop.test.ts`:
 *   lệnh kê   khớp TRỌN đúng giá lệnh (giới hạn: không trượt, không tự đẩy) · giá lệnh = 100 × (1 + gia_bp / 10⁴)
 *   khoản giữ mua ở giá mở 100, ×1, bán ở giá ra · phần còn lại cuối màn ở giá cuối (vẫn là giữ ⇒ không trượt)
 *   lãi lỗ màn = T − H (T = Σ lãi các lần ra; H = giữ suốt = floor(V × (cuối / mở − 1)))
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, LAI_VAY_PCT, NEN_LS, SO_NHIP } from '../config/minigame.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { ketQuaMan, type LenhMan } from '../server/holdem/minigame/khop.js';
import { laiVayGop } from '../server/holdem/minigame/tien.js';
import { bayTrait, khoTraitCua } from '../server/holdem/trait.js';
import { KHO_TRAIT_V59, TRAIT } from '../config/trait.js';

/** Dòng mịn thử (chép `minigame_khop.test.ts`): 20 nến lịch sử phẳng 100 + 60 nến chạy từ 480 nhịp; `trang`/`trangBan` theo nến mịn CHẠY. */
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
const L = (nhip: number, nut: string, x: { gia_bp?: number; L?: number } = {}): LenhMan => ({ seq: ++seq, nhip, nut, ...x });
type Them = { la?: string | null; ke?: { mua?: true; ban?: true }; tamLyYeu?: boolean; toChuc?: boolean; tranThuaGiu?: boolean };
const chay = (min: NenMin[], lenh: LenhMan[], p: Them = {}) =>
  ketQuaMan({ min, von: 1000, ma: 'cp_cn', la: p.la === undefined ? 'bat_day' : p.la, lenh,
    ...(p.ke ? { ke: p.ke } : {}), ...(p.tamLyYeu ? { tamLyYeu: true } : {}), ...(p.toChuc ? { toChuc: true } : {}), ...(p.tranThuaGiu ? { tranThuaGiu: true } : {}) });
const HAI = { mua: true, ban: true } as const;

describe('§I — KÊ LỆNH nhánh thường (Bắt Đáy)', () => {
  it('A · kê mua −10 % (giá 90) đặt trong đếm ngược; nhịp 100 chạm 89 ⇒ khớp TRỌN ở 90; tự chốt cuối ở 99,5 ⇒ T = floor(1000 × 9,5 / 90) = 105', () => {
    const kq = chay(dong(diem({ 100: 89 })), [L(-1, 'ke_mua', { gia_bp: -1000 })], { ke: HAI });
    expect(kq.ke?.mua).toMatchObject({ khop: 100, vt: 'mo', dat: -1, sua: 0, huy: null });
    expect(kq.vao).toHaveLength(1);
    expect(kq.vao[0]!.khop).toBeCloseTo(90, 10);
    expect(kq.vao[0]!.loai).toBe('ke');
    expect(kq.theoLenh).toBe(105);
    expect(kq.loi).toBe(105);
    expect(kq.nhan).toContain('ke_mua_khop');
  });

  it('B · kê bán +10 % khi chưa vào = BÁN KHOẢN GIỮ ở đúng 110: lãi floor(1000 × 10 / 100) = 100 · giá cuối 95 ⇒ H = −50 ⇒ lãi lỗ màn 150', () => {
    const kq = chay(dong(diem({ 200: 111, 479: 95 })), [L(-1, 'ke_ban', { gia_bp: 1000 })], { ke: HAI });
    expect(kq.ke?.ban).toMatchObject({ khop: 200, vt: 'ban_giu' });
    expect(kq.ra).toHaveLength(1);
    expect(kq.ra[0]).toMatchObject({ tien: 1000, lyDo: 'ke_lenh', giu: true, lai: 100 });
    expect(kq.khoanGiu).toEqual({ tien: 1000, con: 0 });
    expect(kq.giu).toBe(-50);
    expect(kq.theoLenh).toBe(100);
    expect(kq.loi).toBe(150);
  });

  it('C · lệnh sai phía bị bỏ qua: kê MUA trên giá đang chạy / kê BÁN dưới giá · lệnh không trait cũng bỏ qua', () => {
    expect(chay(dong(diem({})), [L(-1, 'ke_mua', { gia_bp: 500 })], { ke: HAI }).ke?.mua).toBeUndefined();
    expect(chay(dong(diem({})), [L(-1, 'ke_ban', { gia_bp: -500 })], { ke: HAI }).ke?.ban).toBeUndefined();
    const k = chay(dong(diem({ 100: 89 })), [L(-1, 'ke_mua', { gia_bp: -1000 })], { ke: { ban: true } });
    expect(k.ke?.mua).toBeUndefined();
    expect(k.tuDong).toBe(true);
  });

  it('D · huỷ trước khi chạm ⇒ không khớp, giữ suốt', () => {
    const kq = chay(dong(diem({ 100: 89 })), [L(-1, 'ke_mua', { gia_bp: -1000 }), L(50, 'ke_huy_mua')], { ke: HAI });
    expect(kq.ke?.mua).toMatchObject({ khop: null, huy: 'nguoi_huy' });
    expect(kq.tuDong).toBe(true);
    expect(kq.loi).toBe(0);
  });

  it('E · dời lệnh ở nhịp 50 lên 95; nhịp 100 xuống 94 ⇒ khớp ở 95 · sua = 1 · T = floor(1000 × 4,5 / 95) = 47', () => {
    const kq = chay(dong(diem({ 100: 94 })), [L(-1, 'ke_mua', { gia_bp: -1000 }), L(50, 'ke_mua', { gia_bp: -500 })], { ke: HAI });
    expect(kq.ke?.mua).toMatchObject({ khop: 100, sua: 1, dat: -1 });
    expect(kq.vao[0]!.khop).toBeCloseTo(95, 10);
    expect(kq.theoLenh).toBe(47);
  });

  it('F · nến TRẮNG BÊN BÁN (không ai bán) ⇒ lệnh mua chờ; lần chạm sau mới khớp', () => {
    // nhịp 100 thuộc nến mịn 12 ⇒ nến gộp 6 (mịn 12 + 13) trắng bên bán
    const kq = chay(dong(diem({ 100: 89, 200: 89 }), { trangBan: [12] }), [L(-1, 'ke_mua', { gia_bp: -1000 })], { ke: HAI });
    expect(kq.ke?.mua?.khop).toBe(200);
  });

  it('G · kê sẵn CẢ HAI: mua 90 mở, bán 105 chốt (chưa mở thì chưa bán khoản — bán đứng sau mua trong nhịp 300)', () => {
    const kq = chay(dong(diem({ 100: 89, 300: 106 })), [L(-1, 'ke_mua', { gia_bp: -1000 }), L(-1, 'ke_ban', { gia_bp: 500 })], { ke: HAI });
    expect(kq.ke?.mua).toMatchObject({ khop: 100, vt: 'mo' });
    expect(kq.ke?.ban).toMatchObject({ khop: 300, vt: 'chot' });
    // T = floor(1000 × (105 − 90) / 90) = 166
    expect(kq.ra).toHaveLength(1);
    expect(kq.ra[0]).toMatchObject({ ra: 105, lyDo: 'ke_lenh', lai: 166 });
    expect(kq.theoLenh).toBe(166);
  });

  it('H · không cầm lõi (la = null) vẫn kê được: mua 90 rồi tự chốt cuối ⇒ như A', () => {
    const kq = chay(dong(diem({ 100: 89 })), [L(-1, 'ke_mua', { gia_bp: -1000 })], { la: null, ke: HAI });
    expect(kq.theoLenh).toBe(105);
  });
});

describe('§II — KÊ LỆNH với Đòn Bẩy / Bán Khống', () => {
  const pct = LAI_VAY_PCT.AM_DAM;
  it('I · Đòn Bẩy: kê mua ×4 ở 90 mở vị thế (tiền 1.000, hệ 4) · kê bán 105 chốt lời đúng giá: floor(4000 × 15 / 90) = 666 − lãi vay 3 phần × 100/16 nến', () => {
    const kq = chay(dong(diem({ 100: 89, 200: 106 })), [L(-1, 'ke_mua', { gia_bp: -1000, L: 4 }), L(150, 'ke_ban', { gia_bp: 500 })], { la: 'don_bay', ke: HAI });
    expect(kq.vao[0]).toMatchObject({ tien: 1000, he: 4, loai: 'ke' });
    expect(kq.vao[0]!.khop).toBeCloseTo(90, 10);
    expect(kq.db?.L0).toBe(4);
    expect(kq.ke?.ban).toMatchObject({ khop: 200, vt: 'chot' });
    expect(kq.ra[0]).toMatchObject({ ra: 105, lyDo: 'ke_lenh' });
    expect(kq.ra[0]!.lai).toBe(666 - laiVayGop(1000, 3, pct, (200 - 100) / 16));
  });

  it('J · Bán Khống: kê bán ×2 ở 110 mở khống · kê mua 95 đặt từ đầu — nhịp 50 giá CHẠM 94 khi chưa có vị thế ⇒ CHỜ (không huỷ); nhịp 200 mua lại đúng 95', () => {
    const kq = chay(dong(diem({ 50: 94, 100: 111, 200: 94 })), [L(-1, 'ke_ban', { gia_bp: 1000, L: 2 }), L(-1, 'ke_mua', { gia_bp: -500 })], { la: 'ban_khong', ke: HAI });
    expect(kq.ke?.ban).toMatchObject({ khop: 100, vt: 'mo' });
    expect(kq.ke?.mua).toMatchObject({ khop: 200, vt: 'chot', huy: null });
    // laiVi(1000, 110, 95, −1, 2) = floor(1000 × 2 × 15 / 110) = 272
    expect(kq.ra[0]!.lai).toBe(272 - laiVayGop(1000, 1, pct, (200 - 100) / 16));
  });

  it('K · Bán Khống không mua mở được: kê mua một mình bị huỷ "khong_hop" khi giá chạm', () => {
    const kq = chay(dong(diem({ 100: 89 })), [L(-1, 'ke_mua', { gia_bp: -1000 })], { la: 'ban_khong', ke: HAI });
    expect(kq.ke?.mua).toMatchObject({ khop: null, huy: 'khong_hop' });
  });
});

describe('§III — TÂM LÝ YẾU', () => {
  it('L · giữ suốt: nhịp 100 rơi 85 (−15 % ≤ −14 %) ⇒ bán 600 ở 84,575: floor(600 × −15,425 / 100) = −93 · 400 còn lại giá cuối 100 ⇒ lãi lỗ màn −93', () => {
    const kq = chay(dong(diem({ 100: 85 })), [], { tamLyYeu: true });
    expect(kq.tly).toEqual({ nhip: 100 });
    expect(kq.ra[0]).toMatchObject({ tien: 600, lyDo: 'tam_ly_yeu', giu: true, lai: -93 });
    expect(kq.ra[0]!.ra).toBeCloseTo(84.575, 10);
    expect(kq.ra[1]).toMatchObject({ tien: 400, lai: 0, giu: true, tuDongCuoi: true });
    expect(kq.loi).toBe(-93);
    expect(kq.nhan).toContain('tam_ly_yeu_ban');
  });

  it('M · chưa chạm −14 % (−13 %) ⇒ không bán, giữ suốt', () => {
    const kq = chay(dong(diem({ 100: 87 })), [], { tamLyYeu: true });
    expect(kq.tly).toBeUndefined();
    expect(kq.tuDong).toBe(true);
  });

  it('N · đang cầm (VÀO HẾT 100,5): nhịp 100 về 86 ⇒ lỗ tạm −149 ⇒ bán 600 ở 85,57 (−90) · 400 tự chốt 99,5 (−4) ⇒ T = −94', () => {
    const kq = chay(dong(diem({ 100: 86 })), [L(50, 'vao_het')], { tamLyYeu: true });
    expect(kq.tly).toEqual({ nhip: 100 });
    expect(kq.ra[0]).toMatchObject({ tien: 600, lyDo: 'tam_ly_yeu', lai: -90 });
    expect(kq.theoLenh).toBe(-94);
  });

  it('O · một lần mỗi màn: rơi lần hai không bán thêm', () => {
    const kq = chay(dong(diem({ 100: 85, 300: 70 })), [], { tamLyYeu: true });
    expect(kq.ra.filter((x) => x.lyDo === 'tam_ly_yeu')).toHaveLength(1);
  });
});

describe('§IV — TỔ CHỨC: trần thua áp khoản GIỮ SUỐT', () => {
  it('P · không bấm, nhịp 100 rơi 91 (≤ giá trần 92 / 0,995) ⇒ chốt cả khoản đúng 92: −80 · bấm VÀO sau đó bị bỏ qua', () => {
    const kq = chay(dong(diem({ 100: 91 })), [L(150, 'vao_het')], { toChuc: true, tranThuaGiu: true });
    expect(kq.tranThua?.nhip).toBe(100);
    expect(kq.ra).toHaveLength(1);
    expect(kq.ra[0]).toMatchObject({ tien: 1000, lyDo: 'tran_thua', giu: true, lai: -80 });
    expect(kq.ra[0]!.ra).toBeCloseTo(92, 10);
    expect(kq.vao).toHaveLength(0);
    expect(kq.loi).toBe(-80);
  });

  it('Q · cờ cũ (không tranThuaGiu) ⇒ như v58: không bấm là giữ suốt, lãi lỗ màn 0', () => {
    const kq = chay(dong(diem({ 100: 91 })), [], { toChuc: true });
    expect(kq.tuDong).toBe(true);
    expect(kq.loi).toBe(0);
  });

  it('R · không cầm lõi (la = null) vẫn áp trần thua khoản giữ', () => {
    const kq = chay(dong(diem({ 100: 91 })), [], { la: null, toChuc: true, tranThuaGiu: true });
    expect(kq.loi).toBe(-80);
  });
});

/*
 * Lá của khoá v59 KHÔNG được vào kho chung của khoá cũ (≤ v56 dựng kho từ cả bảng TRAIT): lần đầu thi công SOI VAI · TÂM LÝ YẾU lọt vào cú xáo
 * ⇒ lượt mời trận v56 đổi ⇒ golden lệch 80 trận. Bài này bắt cùng lỗi ở tầng hàm, khỏi chờ golden 4 phút.
 */
describe('D528 — lá v59 chỉ ở kho đích danh', () => {
  const LA_V59 = TRAIT.filter((t) => t.chiKhoHep).map((t) => t.id);
  it('bốn lá mang cờ; kho chung (khoá cũ) không bao giờ chào; kho v59 chào được', () => {
    expect([...LA_V59].sort()).toEqual(['ke_ban', 'ke_mua', 'soi_vai', 'tam_ly_yeu']);
    expect(khoTraitCua({})).toBeUndefined();
    const chung = new Set<string>(), v59 = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      for (const id of bayTrait(seed, 'g1', 1, 0, [])) chung.add(id);
      for (const id of bayTrait(seed, 'g1', 1, 0, [], KHO_TRAIT_V59, 'ca_nhan')) v59.add(id);
    }
    expect(LA_V59.filter((id) => chung.has(id)), 'kho chung').toEqual([]);
    expect(LA_V59.filter((id) => v59.has(id)).length, 'kho v59 có chào lá mới').toBeGreaterThan(0);
  });
});
