/**
 * D523 — BẮT ĐÁY: ĐƯỜNG GIÁ TRỊ + QUÁ BÁN (founder 05/10: "Cái vạch của bắt đáy vô dụng thế, nhái bán khống à?" → "A chính, B phụ (Nhãn quá bán …).
 * Đồng thời dải kia chỉ tương đối vì có những trường hợp 'Phi logic' trong các trường hợp cực đoan"; demo bản 46 đã chốt).
 *
 * Vector tay (nến hiện = 2 nến mịn = 16 nhịp; TRE 2 · cực đoan 3 · SAI ±0,3 % · DAI 0,012 × biên độ mã · cực đoan × 1,6):
 *  · gt nến mịn f = 100 + f ⇒ điểm ở nến hiện j đọc nến mịn (j − 2) × 2 + 1 ⇒ j = 5: 100 + 7 = 107 (± 0,3 %) · nhịp 95 ⇒ nến hiện 5 là điểm cuối.
 *  · BTC biên độ 1,3 ⇒ dải 0,012 × 1,3 = 0,0156 · cực đoan: biên độ cực đoan của mã × 0,012 × 1,6, trễ 3 nến.
 */
import { describe, expect, it } from 'vitest';
import { GIA_TRI, MA_MINIGAME } from '../config/minigame.js';
import { soiGiaTri, type NenMin } from '../server/holdem/minigame/dong_gia.js';

const nen = (sua?: (f: number) => Partial<NenMin>): NenMin[] => [
  ...Array.from({ length: 20 }, () => ({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 1, iSong: -1, rut: 0, quet: null })),
  ...Array.from({ length: 60 }, (_, f) => ({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 1, iSong: f, rut: 0, quet: null, gt: 100 + f, ...sua?.(f) })),
] as NenMin[];
const P = { seed: 7, ma: 'btc' };

describe('§I — đường giá trị (vector tay)', () => {
  it('hằng số: TRE 2 · TRE_CD 3 · SAI 0,003 · DAI 0,012 · DAI_CD 1,6 · QB 0,8 / 0,06 (PLAYTEST-TUNE)', () => {
    expect(GIA_TRI).toEqual({ TRE: 2, TRE_CD: 3, SAI: 0.003, DAI: 0.012, DAI_CD: 1.6, QB_DUNG: 0.8, QB_NHAM: 0.06 });
  });
  it('⭐ TRỄ 2 nến: điểm ở nến hiện j = gt nến mịn (j − 2)·2 + 1 (± 0,3 %); nhịp 95 ⇒ điểm cuối là nến 5 = 107; tất định', () => {
    const s = soiGiaTri(nen(), 95, P);
    expect(s.diem.map((d) => d.j)).toEqual([2, 3, 4, 5]);
    const d5 = s.diem[3]!;
    expect(Math.abs(d5.g / 107 - 1)).toBeLessThanOrEqual(0.003 + 1e-12);
    expect(soiGiaTri(nen(), 95, P)).toEqual(s);
    expect(new Set(s.diem.map((d, i) => (d.g / (100 + 2 * i + 1)).toFixed(6))).size, 'sai số đổi theo nến').toBeGreaterThan(1);
  });
  it('⭐ không lộ tương lai: đổi gt của mọi nến mịn sau nến (j − 2) không đổi gì', () => {
    const goc = soiGiaTri(nen(), 95, P);
    expect(soiGiaTri(nen((f) => (f > 7 ? { gt: 999 } : {})), 95, P)).toEqual(goc);
  });
  it('⭐ dải: BTC 0,012 × 1,3 = 0,0156 · cực đoan: trễ 3 nến, dải × 1,6 trên biên độ cực đoan của mã', () => {
    expect(soiGiaTri(nen(), 95, P).rong).toBeCloseTo(0.0156, 12);
    const cd = soiGiaTri(nen(), 95, { ...P, cheDo: 'cuc_doan' });
    expect(cd.diem[0]!.j).toBe(3);
    const amp = MA_MINIGAME.btc!.cd?.amp ?? MA_MINIGAME.btc!.amp;
    expect(cd.rong).toBeCloseTo(0.012 * amp * 1.6, 12);
  });
  it('Nóng Vội (nến mịn): điểm ở nến j đọc gt nến mịn j − 2', () => {
    const s = soiGiaTri(nen(), 47, { ...P, nongVoi: true });
    expect(s.diem[s.diem.length - 1]!.j).toBe(5);
    expect(Math.abs(s.diem[s.diem.length - 1]!.g / 103 - 1)).toBeLessThanOrEqual(0.003 + 1e-12);
  });
});

describe('§II — nhãn QUÁ BÁN', () => {
  it('⭐ chỉ nến ĐÃ đóng: cao trào ở nến hiện 6 (nến mịn 12–13) — ở nhịp 100 (nến 6 đang chạy) chưa có, ở nhịp 112 (nến 7) mới có (khi u < 0,8)', () => {
    let co = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const m = nen((f) => (f === 13 ? { ctx: true } : {}));
      expect(soiGiaTri(m, 100, { ...P, seed }).quaBan).not.toContain(6);
      if (soiGiaTri(m, 112, { ...P, seed }).quaBan.includes(6)) co++;
    }
    expect(co / 200).toBeGreaterThan(0.7); expect(co / 200).toBeLessThan(0.9);
  });
  it('⭐ nhãn NHẦM ~6 %: nến đỏ đóng đáy mới so với 3 nến trước; nến đỏ thường (không đáy mới) không bao giờ có nhãn', () => {
    // nến hiện 6 đỏ, đóng 95 < ba nến trước (100)
    const dayMoi = nen((f) => (f === 12 ? { o: 100 } : f === 13 ? { o: 99, c: 95 } : {}));
    const thuong = nen((f) => (f === 12 ? { o: 101 } : f === 13 ? { o: 101, c: 100.5 } : {}));
    let a = 0, b = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      if (soiGiaTri(dayMoi, 112, { ...P, seed }).quaBan.includes(6)) a++;
      if (soiGiaTri(thuong, 112, { ...P, seed }).quaBan.includes(6)) b++;
    }
    expect(a / 1000).toBeGreaterThan(0.03); expect(a / 1000).toBeLessThan(0.09);
    expect(b).toBe(0);
  });
});

describe('§III — nối vào màn thật', async () => {
  const { luatCua } = await import('../config/holdem_balance.js');
  const { taoTran } = await import('../server/holdem/engine.js');
  const { boiCanhCuaGhe } = await import('../server/holdem/minigame/quyet_toan.js');
  const { dungDongManDu } = await import('../server/holdem/minigame/man.js');
  const ghe = (id: string, loai: 'nguoi' | 'bot') => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } }) as never;
  it('⭐ bối cảnh mới có `gia_tri`; đường giá có `gt` ở mọi nến chạy, nghiêng theo đích như nến (gt cuối ≈ giá đóng cuối khi không đám đông), có nến cao trào', () => {
    let coCtx = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const st0 = taoTran(seed, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua('balance-v57-minigame'), 12) as any;
      const st = { ...st0, vong: 4, ghe: st0.ghe.map((g: any) => ({ ...g, vai: 'ca_nhan', trait: [], vi_the: { btc: 5000 } })) };
      const bc = boiCanhCuaGhe(st, seed, 3, st.ghe[0], { btc: 400 }) as any;
      if ('loi' in bc) continue;
      expect(bc.gia_tri).toBe(true);
      const { dam_dong: _a, bay: _b, day_chuyen: _c, day_chuyen_khong: _d, ...tron } = bc;
      const min = dungDongManDu(tron).min.slice(20);
      expect(min.every((c) => typeof c.gt === 'number')).toBe(true);
      expect(Math.abs(min[59]!.gt! / min[59]!.c - 1), 'gt cuối nghiêng cùng nến').toBeLessThan(0.05);
      if (min.some((c) => c.ctx)) coCtx++;
    }
    expect(coCtx, 'không gặp cao trào nào thì nhãn QUÁ BÁN đúng không được đo').toBeGreaterThan(0);
  });
});
