/**
 * D486 — KIÊN NHẪN · NÓNG VỘI chạy TRONG MÀN (demo `TR` · `khoaTrait` · `traitTick`, D471/D478) và mở cho khung v57.
 * Vector tiền chép tay ở §II (A8.3) — mã `cp_cn`: trượt nền 50 bp.
 *   §I   cửa sổ bấm theo nhịp: 10 s ⇒ nhịp 142 · 17 s ⇒ nhịp 240 (480 nhịp / 34 s)
 *   §II  khớp: Kiên Nhẫn bỏ lệnh trước mốc, trượt ×0,5 · Nóng Vội bỏ lệnh từ mốc, tự chốt ở mốc, "trắng" theo nến mịn
 *   §III bot đặt lệnh trong cửa sổ · tác dụng THEO VÒNG tắt ở khung minigame (vế ngược v56 còn) · kho v57 có hai lá
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, SO_NHIP, TRAIT_MAN } from '../config/minigame.js';
import { KHO_TRAIT_HEP } from '../config/trait.js';
import { luatCua } from '../config/holdem_balance.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { cuaSoTrait, ketQuaMan, lenhBotBatDay, type LenhMan } from '../server/holdem/minigame/khop.js';
import { rangBuocCua } from '../server/holdem/trait.js';
import { taoTran, type GheMoi } from '../server/holdem/engine.js';

function dong(gia: (k: number) => number, co: { trangBan?: number[] } = {}): NenMin[] {
  const ra: NenMin[] = [];
  for (let i = 0; i < NEN_LS * K_MIN; i++) ra.push({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 0, iSong: i, rut: 0, quet: null });
  let truoc = 100;
  for (let j = 0; j < SO_NHIP / 8; j++) {
    const tick = Array.from({ length: 8 }, (_, t) => gia(j * 8 + t));
    ra.push({ o: truoc, c: tick[7]!, h: Math.max(truoc, ...tick), l: Math.min(truoc, ...tick), tick, v: 0, iSong: j, rut: 0, quet: null,
      ...(co.trangBan?.includes(j) ? { trangBan: true } : {}) });
    truoc = tick[7]!;
  }
  return ra;
}
const diem = (m: Record<number, number>, nen = 100) => (k: number) => m[k] ?? nen;
let seq = 0;
const L = (nhip: number, nut: string): LenhMan => ({ seq: ++seq, nhip, nut });
const chay = (min: NenMin[], lenh: LenhMan[], t: { kienNhan?: boolean; nongVoi?: boolean } = {}) =>
  ketQuaMan({ min, von: 1000, ma: 'cp_cn', la: 'bat_day', lenh, ...t });

describe('§I — cửa sổ bấm', () => {
  it('hằng số demo: khoá 10 s, trượt ×0,5, hạn 17 s (founder: "1 nửa bảng")', () => {
    expect(TRAIT_MAN).toEqual({ KIEN_NHAN_KHOA_S: 10, KIEN_NHAN_TRUOT: 0.5, NONG_VOI_HAN_S: 17 });
  });
  it('⭐ 480 nhịp / 34 s: Kiên Nhẫn ⌈10 × 480/34⌉ = ⌈141,18⌉ = 142 · Nóng Vội ⌊17 × 480/34⌋ = 240 · không trait [0, 480)', () => {
    expect(cuaSoTrait({ kienNhan: true })).toEqual({ tu: 142, den: 480 });
    expect(cuaSoTrait({ nongVoi: true })).toEqual({ tu: 0, den: 240 });
    expect(cuaSoTrait({})).toEqual({ tu: 0, den: 480 });
  });
});

describe('§II — khớp (vector chép tay, cp_cn trượt 50 bp)', () => {
  const min = dong(diem({ 100: 90, 150: 90, 300: 99 }));
  it('⭐ KIÊN NHẪN: VÀO HẾT ở nhịp 150 giá 90 ⇒ khớp 90 × (1 + 25/10⁴) = 90,225; THOÁT 300 ở 99 ⇒ 98,7525; T = ⌊1000 × 8,5275 / 90,225⌋ = 94', () => {
    const kq = chay(min, [L(150, 'vao_het'), L(300, 'thoat')], { kienNhan: true });
    expect(kq.vao[0]!.khop).toBeCloseTo(90.225, 10);
    expect(kq.ra[0]!.ra).toBeCloseTo(98.7525, 10);
    expect(kq.theoLenh).toBe(94);
    expect(kq.giu).toBe(0);
    expect(kq.loi).toBe(94);
  });
  it('KIÊN NHẪN: lệnh trước mốc (nhịp 100 < 142) bị bỏ ⇒ không vào ⇒ giữ suốt, màn 0; vế ngược — không trait thì lệnh ấy khớp ở 90,45', () => {
    const kq = chay(min, [L(100, 'vao_het'), L(300, 'thoat')], { kienNhan: true });
    expect(kq.vao).toHaveLength(0);
    expect(kq.tuDong).toBe(true);
    expect(kq.loi).toBe(0);
    expect(chay(min, [L(100, 'vao_het')]).vao[0]!.khop).toBeCloseTo(90.45, 10);
  });
  const sap = dong(diem({ 10: 90, 479: 80 }));
  it('⭐ NÓNG VỘI: VÀO HẾT ở nhịp 10 giá 90 (khớp 90,45), giá sập về 80 cuối màn ⇒ TỰ CHỐT ở mốc 17 s (nhịp 239 giá 100 ⇒ 99,5): T = ⌊1000 × 9,05 / 90,45⌋ = 100 · H = −200 ⇒ màn +300', () => {
    const kq = chay(sap, [L(10, 'vao_het')], { nongVoi: true });
    expect(kq.ra).toHaveLength(1);
    expect(kq.ra[0]).toMatchObject({ nhip: 240, nongVoi: true, tuDongCuoi: true });
    expect(kq.ra[0]!.ra).toBeCloseTo(99.5, 10);
    expect(kq.theoLenh).toBe(100);
    expect(kq.giu).toBe(-200);
    expect(kq.loi).toBe(300);
  });
  it('vế ngược — không trait: cùng lệnh ôm tới cuối ⇒ ra 80 × 0,995 = 79,6 ⇒ T = ⌊1000 × (−10,85) / 90,45⌋ = −120', () => {
    expect(chay(sap, [L(10, 'vao_het')]).theoLenh).toBe(-120);
  });
  it('NÓNG VỘI: lệnh từ mốc (nhịp 240) bị bỏ', () => {
    expect(chay(sap, [L(240, 'vao_het')], { nongVoi: true }).vao).toHaveLength(0);
  });
  it('⭐ NÓNG VỘI xét "trắng" theo NẾN MỊN (khung nhanh): mịn 11 trắng bên bán, mịn 10 không ⇒ khung thường (gộp 5 = mịn 10+11) mua hụt ở nhịp 80; Nóng Vội (mịn 10) khớp', () => {
    const m = dong(diem({}), { trangBan: [11] });
    expect(chay(m, [L(80, 'vao_het')]).hut).toEqual([{ nhip: 80, ben: 'ban' }]);
    expect(chay(m, [L(80, 'vao_het')], { nongVoi: true }).vao).toHaveLength(1);
    expect(chay(m, [L(88, 'vao_het')], { nongVoi: true }).hut, 'mịn 11 (nhịp 88) trắng ⇒ hụt').toEqual([{ nhip: 88, ben: 'ban' }]);
  });
});

describe('§III — bot · engine · kho', () => {
  it('bot Bắt Đáy đặt lệnh TRONG cửa sổ: Kiên Nhẫn sớm nhất nhịp 142 (không trait: 80) · Nóng Vội muộn nhất nhịp 239 (không trait: 400)', () => {
    const rut = dong((k) => (k >= 10 ? 97 : 100));
    expect(lenhBotBatDay(rut)[0]!.nhip).toBe(80);
    expect(lenhBotBatDay(rut, cuaSoTrait({ kienNhan: true }))[0]!.nhip).toBe(142);
    const phang = dong(diem({}));
    expect(lenhBotBatDay(phang)[0]!.nhip).toBe(400);
    expect(lenhBotBatDay(phang, cuaSoTrait({ nongVoi: true }))[0]!.nhip).toBe(239);
  });
  const ghe = (id: string, loai: 'nguoi' | 'bot'): GheMoi => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } });
  it('⭐ khung minigame: tác dụng THEO VÒNG của hai lá TẮT (lãi lỗ dồn vào màn); vế ngược v56 còn', () => {
    for (const [khoa, con] of [['balance-v57-minigame', false], ['balance-v56-congdon', true]] as const) {
      const st = taoTran(3, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua(khoa), 12);
      const g = { ...st.ghe[0]!, trait: ['kien_nhan', 'nong_voi'] as never };
      const rb = rangBuocCua({ ...st, trait_bat: true }, g, 3);
      expect(rb.kienNhan, khoa).toBe(con);
      expect(rb.nongVoi, khoa).toBe(con);
    }
  });
  it('kho trait v57 chào hai lá (founder: "thi công và mở đi")', () => {
    expect(KHO_TRAIT_HEP).toContain('kien_nhan');
    expect(KHO_TRAIT_HEP).toContain('nong_voi');
  });
});
