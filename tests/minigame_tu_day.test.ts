/**
 * D499 — TỰ ĐẨY GIÁ CỦA CHÍNH LỆNH + RẢI LỆNH + TỔ CHỨC TRONG MÀN. Vector chép tay, viết TRƯỚC code (A8.3). Chép demo bản 34 (`tuDay` · `lechLuc`
 * nhánh không-tạm · `moVT`/`dongVT` · khớp thỏa thuận · trần thua):
 *   cú đẩy  mag = chiều × hệ số đẩy × √(tiền × he / 10.000) ÷ √n   (D506 — QUY MÔ TUYỆT ĐỐI, căn bậc hai như tác động giá ngoài đời; mốc 10.000 =
 *                                                                   vốn đầu một nhà đầu tư cá nhân · Rải lệnh n nến chia thêm √n; không rải: n = 1)
 *           (trước D506: × tiền × he / vốn màn — vốn to không đẩy thêm; founder 04/10: "tăng vốn … cân bằng lại tỷ lệ đẩy giá")
 *   khớp    = giá × (1 ± trượt) × (1 + chiều × |mag| × f)          f = 1 · Rải lệnh n nến: (n + 1)/(2n)
 *   lệch(k) = mag × min(1, (k − k0)/trải) × (0,3 + 0,7 × max(0, 1 − max(0, k − k0 − trải)/64))   — đơn vị nhịp, trải = n × 16 (0 khi không rải)
 *   TỔ CHỨC: nến trắng vẫn khớp, trượt ×1,5 · trần thua −8 % vốn màn: chạm ⇒ tự chốt ĐÚNG giá trần, không tự đẩy
 * Mã thử: CP Chứng khoán (trượt 50 bp). V = 1.000, giá 100 trừ các nhịp ghi rõ.
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, SO_NHIP } from '../config/minigame.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { apXungBan, ketQuaMan, type LenhMan } from '../server/holdem/minigame/khop.js';
import { readFileSync } from 'node:fs';
import { TU_DAY } from '../config/minigame.js';

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
const chay = (min: NenMin[], lenh: LenhMan[], p: Partial<Parameters<typeof ketQuaMan>[0]> = {}) =>
  ketQuaMan({ min, von: 1000, ma: 'cp_cn', la: 'bat_day', lenh, ...p });
const giaTick = (min: NenMin[], k: number) => min[NEN_LS * K_MIN + Math.floor(k / 8)]!.tick[k % 8]!;

describe('§I — tự đẩy giá (vector chép tay)', () => {
  it('⭐ VÀO HẾT 10.000 ở 90 với hệ số đẩy 0,03 (√1 = 1): khớp 90 × 1,005 × 1,03 = 93,1635; nhịp kế giá bị đẩy ×1,02967; sau 64 nhịp còn 30 % (×1,009)', () => {
    const min = dong(diem({ 100: 90, 300: 99 }));
    const kq = chay(min, [L(100, 'vao_het'), L(300, 'thoat')], { tuDay: 0.03, von: 10000 });
    expect(kq.vao[0]!.khop).toBeCloseTo(93.1635, 9);
    expect(kq.xungBan[0]).toEqual({ nhip: 100, mag: expect.closeTo(0.03, 12), trai: 0 });
    const day = apXungBan(min, kq.xungBan);
    expect(giaTick(day, 101)).toBeCloseTo(100 * (1 + 0.03 * (0.3 + 0.7 * (63 / 64))), 9);
    expect(giaTick(day, 200)).toBeCloseTo(100 * 1.009, 9);
    // THOÁT ở nhịp 300: giá 99 × 1,009 = 99,891 · bán tự đẩy xuống −0,03 ⇒ ra = 99,891 × 0,995 × 0,97 = 96,40980 ⇒ floor(10000 × 3,2463/93,1635) = 348
    expect(kq.ra[0]!.ra).toBeCloseTo(99.891 * 0.995 * 0.97, 9);
    expect(kq.ra[0]!.lai).toBe(348);
    expect(kq.xungBan[1]).toEqual({ nhip: 300, mag: expect.closeTo(-0.03, 12), trai: 0 });
  });

  it('⭐ D506 CĂN BẬC HAI: VÀO NỬA 5.000 ⇒ mag = 0,03 × √0,5 = 0,0212132 (không phải 0,015) ⇒ khớp 90,45 × 1,0212132 = 92,36873', () => {
    const kq = chay(dong(diem({ 100: 90 })), [L(100, 'vao_nua')], { tuDay: 0.03, von: 10000 });
    expect(kq.xungBan[0]!.mag).toBeCloseTo(0.0212132, 7);
    expect(kq.vao[0]!.khop).toBeCloseTo(92.36873, 5);
  });

  it('⭐ D506 vốn to đẩy thêm: cùng VÀO HẾT, vốn 1.000 ⇒ √0,1 = 0,316 lần · vốn 40.000 ⇒ √4 = 2 lần cú đẩy của vốn 10.000', () => {
    const min = dong(diem({ 100: 90 }));
    expect(chay(min, [L(100, 'vao_het')], { tuDay: 0.03, von: 1000 }).xungBan[0]!.mag).toBeCloseTo(0.03 * Math.sqrt(0.1), 10);
    expect(chay(min, [L(100, 'vao_het')], { tuDay: 0.03, von: 40000 }).xungBan[0]!.mag).toBeCloseTo(0.06, 10);
  });

  it('⭐ D506 Đòn Bẩy ×10 vốn 10.000: giá trị vị thế 100.000 ⇒ mag = 0,03 × √10 = 0,0948683 ⇒ khớp 100 × 1,005 × 1,0948683 = 110,03427', () => {
    const kq = chay(dong(diem({})), [L(0, 'vao_x10')], { tuDay: 0.03, von: 10000, la: 'don_bay', laiVayPct: 9 });
    expect(kq.xungBan[0]!.mag).toBeCloseTo(0.0948683, 7);
    expect(kq.vao[0]!.khop).toBeCloseTo(110.03427, 4);
  });

  it('⭐ RẢI LỆNH 3 nến (D506 mạnh hơn): cú đẩy chia √3 ⇒ mag 0,0173205, khớp ăn (3+1)/6 ⇒ 90,45 × 1,011547 = 91,49443; trải 48 nhịp, giữa chừng một nửa', () => {
    const min = dong(diem({ 100: 90 }));
    const kq = chay(min, [L(100, 'vao_het')], { tuDay: 0.03, rai: 3, von: 10000 });
    expect(kq.vao[0]!.khop).toBeCloseTo(91.49443, 5);
    expect(kq.xungBan[0]).toEqual({ nhip: 100, mag: expect.closeTo(0.0173205, 7), trai: 48 });
    expect(giaTick(apXungBan(min, kq.xungBan), 124)).toBeCloseTo(100 * (1 + 0.0173205 * 0.5), 5);
  });

  it('vế ngược: không hệ số đẩy (Cá nhân) ⇒ khớp như cũ, không cú đẩy, đường giá nguyên', () => {
    const min = dong(diem({ 100: 90, 300: 99 }));
    const kq = chay(min, [L(100, 'vao_het'), L(300, 'thoat')]);
    expect(kq.vao[0]!.khop).toBeCloseTo(90.45, 10);
    expect(kq.theoLenh).toBe(89);
    expect(kq.xungBan).toEqual([]);
    expect(apXungBan(min, kq.xungBan)).toEqual(min);
  });
});

describe('§II — Tổ Chức trong màn', () => {
  it('⭐ KHỚP THỎA THUẬN: THOÁT đúng nến trắng bên mua vẫn khớp, trượt ×1,5; người thường thì hụt', () => {
    const min = dong(diem({ 100: 90, 300: 99 }), { trang: [37] });   // nến mịn 37 chứa nhịp 296–303
    const tc = chay(min, [L(100, 'vao_het'), L(300, 'thoat')], { toChuc: true });
    expect(tc.hut).toEqual([]);
    expect(tc.ra[0]!.ra).toBeCloseTo(99 * (1 - 0.0075), 9);
    const thuong = chay(min, [L(100, 'vao_het'), L(300, 'thoat')]);
    expect(thuong.hut).toEqual([{ nhip: 300, ben: 'mua' }]);
  });

  it('⭐ TRẦN THUA −8 %: vào 100 (khớp 100,5), giá rơi 90 ở nhịp 50 ⇒ tự chốt ở giá trần 92,9246 (× 0,995 = 92,46) ⇒ −80 đúng; lệnh sau bị bỏ', () => {
    const min = dong(diem({ 50: 90, 200: 120 }));
    const kq = chay(min, [L(0, 'vao_het'), L(200, 'thoat')], { toChuc: true });
    expect(kq.tranThua).toEqual({ nhip: 50, gia: expect.closeTo(92.46 / 0.995, 6) });
    expect(kq.ra).toHaveLength(1);
    expect(kq.ra[0]!.lai).toBe(-80);
    expect(kq.theoLenh).toBe(-80);
    expect(kq.nhan).toContain('cham_tran_thua');
  });

  it('sổ giữa màn trả GIÁ TRẦN để client bật búa đúng lúc (client chỉ so giá); người thường không có trần', () => {
    const min = dong(diem({}));
    expect(chay(min, [L(0, 'vao_het')], { toChuc: true, denNhip: 0 }).giaTran).toBeCloseTo(92.46 / 0.995, 6);
    expect(chay(min, [L(0, 'vao_het')], { denNhip: 0 }).giaTran).toBeUndefined();
  });
});

describe('§III — một nguồn với demo (A11.25)', () => {
  it('D506 — hệ số tự đẩy cơ sở + mốc căn bậc hai = `TAC_DONG_CO_SO` · `VON_CHUAN_DAY` của demo đã chốt; hệ số vai = `VAI[].tac` của demo', () => {
    const demo = readFileSync('docs/ui-ux/demo/minigame-bat-day.html', 'utf8');
    expect(Number(/const TAC_DONG_CO_SO = ([\d.]+);/.exec(demo)![1])).toBe(TU_DAY.CO_SO);
    expect(Number(/const VON_CHUAN_DAY = (\d+);/.exec(demo)![1])).toBe(TU_DAY.VON_CHUAN);
    for (const [vai, tac] of Object.entries(TU_DAY.VAI)) {
      if (!tac) continue;
      expect(new RegExp(`${vai}:\\s*\{[^}]*tac: ${String(tac).replace(/^0/, '')},`).test(demo), vai).toBe(true);
    }
  });
});
