/**
 * D521 — BẮT ĐÁY: THÁC CÓ VẾT, CỠ NGẪU NHIÊN, VÀO NGƯỢC DÒNG BỊ TRƯỢT, SOI BÁO KHOẢNG (founder 05/10 chọn 1 + 2 + "nerf bộ tính %" · "Mập mờ hơn chứ ko
 * phải lừa xác suất nhé"). Màn `thac_v2`:
 *  (1) mỗi cú thanh lý để lại `CON_LAI` (0,4) tới hết màn — giá cuối màn lệch khỏi % vòng đúng phần này (quyết toán vẫn cân: lãi lỗ màn đọc đường);
 *  (2) lệnh VÀO ngược dòng cưỡng bức trượt thêm `TRUOT_THAC` (0,5) × độ sâu cú thác đang đè;
 *  (3) cỡ mỗi cú ×U[0,5; 1,5] (ẩn) ⇒ vạch soi báo KHOẢNG phân vị 10–90 % của chính phân bố đó (đúng tỷ lệ, không lừa).
 *
 * Vector tay:
 *  · lechTl cú {t0 0, mag −0,1, trai 2, tan 6, con 0,4}: s = 2 ⇒ −0,1 · s = 5 (tan nửa) ⇒ −0,1 × (0,4 + 0,6 × 0,5) = −0,07 · s = 8 trở đi ⇒ −0,04 (vết).
 *    Không `con` ⇒ s = 5: −0,05 · s = 8: 0.
 *  · trượt ngược dòng: độ sâu −0,04, mua (ch 1) ⇒ × (1 + 0,5 × 0,04) = × 1,02 · bán khống (ch −1) khi thác đè xuống ⇒ thuận dòng ⇒ × 1 ·
 *    độ sâu +0,04 (mua cưỡng bức đẩy lên), bán khống ⇒ × (1 − 0,5 × 0,04) = × 0,98.
 */
import { describe, expect, it } from 'vitest';
import { SO_NHIP, TL_DAY } from '../config/minigame.js';
import { dayChuyen, lechTl, soiTai, type BotDonBay, type NenMin, type VtDamDong } from '../server/holdem/minigame/dong_gia.js';
import { ketQuaMan, truotThac } from '../server/holdem/minigame/khop.js';

describe('§I — vector tay', () => {
  it('hằng số: CON_LAI 0,4 · cỡ ×[0,5; 1,5] · TRUOT_THAC 0,5 · soi 64 lần, phân vị 10–90 % (PLAYTEST-TUNE)', () => {
    expect([TL_DAY.CON_LAI, TL_DAY.CO_TU, TL_DAY.CO_DEN, TL_DAY.TRUOT_THAC, TL_DAY.SOI_SO, TL_DAY.SOI_TU, TL_DAY.SOI_DEN]).toEqual([0.4, 0.5, 1.5, 0.5, 64, 0.1, 0.9]);
  });
  it('⭐ cú có VẾT: −0,1 → −0,07 (tan nửa) → −0,04 mãi; không vết thì −0,05 → 0', () => {
    const x = { t0: 0, mag: -0.1, trai: 2, tan: 6 };
    expect(lechTl([{ ...x, con: 0.4 }], 2)).toBeCloseTo(-0.1, 12);
    expect(lechTl([{ ...x, con: 0.4 }], 5)).toBeCloseTo(-0.07, 12);
    expect(lechTl([{ ...x, con: 0.4 }], 8)).toBeCloseTo(-0.04, 12);
    expect(lechTl([{ ...x, con: 0.4 }], 50)).toBeCloseTo(-0.04, 12);
    expect(lechTl([x], 5)).toBeCloseTo(-0.05, 12);
    expect(lechTl([x], 8)).toBeCloseTo(0, 12);
  });
  it('⭐ trượt ngược dòng: mua giữa bán tháo −0,04 ⇒ ×1,02 · bán khống thuận dòng ⇒ ×1 · bán khống giữa mua cưỡng bức +0,04 ⇒ ×0,98 · không ghi ⇒ ×1', () => {
    const nen = (t: number): NenMin[] => [...Array.from({ length: 20 }, () => ({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 0, iSong: 0, rut: 0, quet: null })),
      ...Array.from({ length: 60 }, () => ({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), thac: Array(8).fill(t), v: 0, iSong: 0, rut: 0, quet: null }))] as NenMin[];
    expect(truotThac(nen(-0.04), 100, 1)).toBeCloseTo(1.02, 12);
    expect(truotThac(nen(-0.04), 100, -1)).toBe(1);
    expect(truotThac(nen(0.04), 100, -1)).toBeCloseTo(0.98, 12);
    expect(truotThac(nen(0.04), 100, 1)).toBe(1);
    const khong = nen(0).map((c) => { const { thac: _t, ...r } = c; return r; }) as NenMin[];
    expect(truotThac(khong, 100, 1)).toBe(1);
    // nối thật: Bắt Đáy VÀO HẾT ở nhịp 100 giữa bán tháo −0,04 ⇒ giá khớp đúng × 1,02 so với cùng đường không ghi `thac`
    const vao = (min: NenMin[]) => ketQuaMan({ min, von: 1000, ma: 'vn30', la: 'bat_day', lenh: [{ seq: 1, nhip: 100, nut: 'vao_het' }] } as never).vao[0]!.khop;
    expect(vao(nen(-0.04)) / vao(khong)).toBeCloseTo(1.02, 9);
  });
});

describe('§II — dây chuyền v2', () => {
  // giá rơi đều 100 → 90 trong 120 nhịp rồi đứng: người vay ×10 vào ở 100 (sàn 91) bị bán cưỡng bức
  const P = Array.from({ length: SO_NHIP }, (_, i) => (i < 120 ? 100 - (i * 10) / 120 : 90));
  const vay: BotDonBay[] = [{ ai: 'nen', chieu: 1, L: 10, tien: 0.4, vao: 0 }];
  it('⭐ v2: cú có `con` 0,4, cỡ = danh nghĩa × hệ số trong [0,5; 1,5], tất định theo hạt; lệch cuối màn = vết (≠ 0) · không v2: tan hết, cỡ danh nghĩa', () => {
    const cu = dayChuyen(P, vay, 1), moi = dayChuyen(P, vay, 1, undefined, undefined, { hat: 7 });
    expect(cu.xung).toHaveLength(1); expect(moi.xung).toHaveLength(1);
    expect(cu.xung[0]!.con).toBeUndefined();
    expect(moi.xung[0]!.con).toBe(0.4);
    const he = moi.xung[0]!.mag / cu.xung[0]!.mag;
    expect(he).toBeGreaterThanOrEqual(0.5); expect(he).toBeLessThanOrEqual(1.5);
    expect(dayChuyen(P, vay, 1, undefined, undefined, { hat: 7 }).xung).toEqual(moi.xung);
    // cỡ thật đổi theo hạt (ẩn với lớp soi) — 8 hạt cho ít nhất 6 cỡ khác nhau, trải cả hai phía danh nghĩa
    const hes = [1, 2, 3, 4, 5, 6, 7, 8].map((h) => dayChuyen(P, vay, 1, undefined, undefined, { hat: h }).xung[0]!.mag / cu.xung[0]!.mag);
    expect(new Set(hes.map((x) => x.toFixed(6))).size).toBeGreaterThanOrEqual(6);
    expect(Math.min(...hes)).toBeLessThan(1); expect(Math.max(...hes)).toBeGreaterThan(1);
    expect(cu.lech[SO_NHIP - 1]).toBeCloseTo(0, 12);
    expect(moi.lech[SO_NHIP - 1]).toBeCloseTo(0.4 * moi.xung[0]!.mag, 12);
  });
  it('⭐ soi v2 báo KHOẢNG quanh cỡ danh nghĩa: tu (nông) ≥ đáy danh nghĩa ≥ den (sâu); không v2 thì không có khoảng', () => {
    const vt: VtDamDong[] = [{ chieu: 1, L: 10, tien: 0.4, p0: 100, i0: 0, iChet: null, mag: -0.004 }, { chieu: 1, L: 10, tien: 0.4, p0: 99.8, i0: 0, iChet: null, mag: -0.004 }];
    const s = soiTai(vt, 10, 95, 'bat_day', { hat: 3 }) as { thac: { ngoi: number; day: number; tu: number; den: number } };
    expect(s.thac.tu).toBeGreaterThan(s.thac.den);
    expect(s.thac.tu).toBeGreaterThanOrEqual(s.thac.day * 0.999);
    expect(s.thac.den).toBeLessThanOrEqual(s.thac.day * 1.001);
    expect(s.thac.tu).toBeLessThan(s.thac.ngoi);
    const s0 = soiTai(vt, 10, 95, 'bat_day') as { thac: Record<string, number> };
    expect(s0.thac.tu).toBeUndefined();
  });
  it('⭐ "không lừa xác suất": trên 400 lần rút cỡ THẬT, phần đẩy thêm rơi trong khoảng soi ~80 % (70–90 %)', () => {
    const vt: VtDamDong[] = [{ chieu: 1, L: 10, tien: 0.4, p0: 100, i0: 0, iChet: null, mag: -0.01 }];
    const s = soiTai(vt, 10, 95, 'bat_day', { hat: 11 }) as { thac: { ngoi: number; tu: number; den: number } };
    let trong = 0;
    for (let i = 0; i < 400; i++) {
      const he = TL_DAY.CO_TU + ((i + 0.5) / 400) * (TL_DAY.CO_DEN - TL_DAY.CO_TU), day = s.thac.ngoi * (1 - 0.01 * he);
      if (day <= s.thac.tu && day >= s.thac.den) trong++;
    }
    expect(trong / 400).toBeGreaterThan(0.7); expect(trong / 400).toBeLessThan(0.9);
  });
});

describe('§III — nối vào màn thật', async () => {
  const { luatCua } = await import('../config/holdem_balance.js');
  const { taoTran } = await import('../server/holdem/engine.js');
  const { boiCanhCuaGhe } = await import('../server/holdem/minigame/quyet_toan.js');
  const { dungDongManDu } = await import('../server/holdem/minigame/man.js');
  const ghe = (id: string, loai: 'nguoi' | 'bot') => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } }) as never;
  it('⭐ bối cảnh màn mới có `thac_v2`; màn có cú thanh lý thì đường giá ghi `thac` (âm khi bán tháo) và cú có vết; bỏ cờ ⇒ không ghi, không vết', () => {
    let coThac = 0;
    for (let seed = 1; seed <= 12 && !coThac; seed++) {
      const st0 = taoTran(seed, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua('balance-v57-minigame'), 12) as any;
      const st = { ...st0, vong: 4, ghe: st0.ghe.map((g: any) => ({ ...g, vai: 'ca_nhan', trait: [], vi_the: { btc: 5000 } })) };
      const bc = boiCanhCuaGhe(st, seed, 3, st.ghe[0], { btc: -500 }) as any;
      if ('loi' in bc) continue;
      expect(bc.thac_v2).toBe(true);
      const du = dungDongManDu(bc);
      const tl = du.xung.filter((x) => x.con !== undefined);
      if (!tl.length) continue;
      coThac++;
      expect(tl.every((x) => x.con === 0.4)).toBe(true);
      expect(du.min.some((c) => c.thac?.some((t) => t !== 0))).toBe(true);
      const { thac_v2: _t, ...cu } = bc;
      const du0 = dungDongManDu(cu);
      expect(du0.min.some((c) => c.thac)).toBe(false);
      expect(du0.xung.some((x) => x.con !== undefined)).toBe(false);
    }
    expect(coThac, 'không gặp màn nào có cú thanh lý thì bài này không đo gì').toBeGreaterThan(0);
  });
  it('⭐ vết là TIỀN THẬT (chọn 1: "% vòng gánh cú thác"): người giữ suốt có loi = vet = giu − floor(vốn × (cuối ÷ (1 + vết cuối) ÷ đầu − 1)) ≠ 0', async () => {
    const { ketQuaMan } = await import('../server/holdem/minigame/khop.js');
    const { thamSoKhop } = await import('../server/holdem/minigame/quyet_toan.js');
    const { thacTaiNhip } = await import('../server/holdem/minigame/dong_gia.js');
    const { NEN_LS, K_MIN } = await import('../config/minigame.js');
    let do_ = 0;
    for (let seed = 1; seed <= 12 && do_ < 2; seed++) {
      const st0 = taoTran(seed, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua('balance-v57-minigame'), 12) as any;
      const st = { ...st0, vong: 4, ghe: st0.ghe.map((g: any) => ({ ...g, vai: 'ca_nhan', trait: [], vi_the: { btc: 5000 } })) };
      const bc = boiCanhCuaGhe(st, seed, 3, st.ghe[0], { btc: -500 }) as any;
      if ('loi' in bc) continue;
      const min = dungDongManDu(bc).min, vet = thacTaiNhip(min, SO_NHIP - 1);
      if (!vet) continue;
      do_++;
      const kq = ketQuaMan({ min, ...thamSoKhop(bc), la: 'bat_day', lenh: [] } as never);
      const dau = min[NEN_LS * K_MIN - 1]!.c, cuoi = min[min.length - 1]!.c;
      const tay = kq.giu - Math.floor(bc.von * (cuoi / (1 + vet) / dau - 1) + 1e-9);
      expect(tay, 'màn thử phải có vết đủ lớn để thành chip').not.toBe(0);
      expect(kq.vet).toBe(tay);
      expect(kq.loi).toBe(tay);
    }
    expect(do_).toBeGreaterThan(0);
  });
});
