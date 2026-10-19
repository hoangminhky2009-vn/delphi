/**
 * D494 — THANH LÝ DÂY CHUYỀN trên server (demo bản 32 `botDonBayTick` · `xungThanhLy` · `lechLuc` (tam) · `lanSang`). Vector chép tay, viết TRƯỚC code.
 *   bot: vào ở nến mịn `vao` (giá lúc đó = p0) · chạm giá ≤ p0 × (1 − 0,9/L) ⇒ BÁN CƯỠNG BỨC
 *   cú đẩy: mag = −0,01 × liq × min(3, tiền × L / 10) (tiền theo bội vốn chuẩn) · trải 1 nến gốc (2 nến mịn) · tan hết sau 4 nến gốc (8 nến mịn)
 *   lệch(s) = mag × min(1, (s − t0)/trải) × max(0, 1 − max(0, s − t0 − trải)/tan) — đơn vị nến mịn; nhịp k ở s = (k + 1)/8
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, SO_NHIP } from '../config/minigame.js';
import { dayChuyen, type BotDonBay, type NenMin } from '../server/holdem/minigame/dong_gia.js';
import { dungDongMan, duongPhuCua, dungDongManDu, loNhip } from '../server/holdem/minigame/man.js';
import { boiCanhCuaGhe } from '../server/holdem/minigame/quyet_toan.js';
import { taoTran, type GheMoi } from '../server/holdem/engine.js';
import { luatCua } from '../config/holdem_balance.js';

const gia = (m: (k: number) => number) => Array.from({ length: SO_NHIP }, (_, k) => m(k));
const A: BotDonBay = { ai: 'dam_dong', L: 10, tien: 0.6, vao: 0 };
const B: BotDonBay = { ai: 'dam_dong', L: 5, tien: 0.6, vao: 0 };

describe('§I — dây chuyền (vector chép tay)', () => {
  // 100 tới nhịp 79 · 90,9 từ nhịp 80 (A ×10: ngưỡng 91) · 82,3 từ nhịp 120 (B ×5: ngưỡng 82 — riêng mình KHÔNG chạm)
  const P = gia((k) => (k < 80 ? 100 : k < 120 ? 90.9 : 82.3));

  it('⭐ A ×10 chạm 91 ở nhịp 80 ⇒ đẩy −0,6 %; cú đẩy còn −0,375 % ở nhịp 120 ⇒ 82,3 × 0,99625 = 81,99 ≤ 82 ⇒ B sập theo', () => {
    const r = dayChuyen(P, [A, B], 1);
    expect(r.suKien.map((e) => [e.nhip, e.L])).toEqual([[80, 10], [120, 5]]);
    expect(r.suKien[0]!.mag).toBeCloseTo(-0.006, 12);
    expect(r.suKien[1]!.mag).toBeCloseTo(-0.003, 12);
    expect(r.lech[120]).toBeCloseTo(-0.00375, 12);
    expect(r.lech[80]).toBe(0);                          // cú đẩy chỉ tác động SAU lúc bán (nhân quả)
  });

  it('vế ngược: không có A thì B KHÔNG sập (82,3 > 82) — chính A kéo B', () => {
    expect(dayChuyen(P, [B], 1).suKien).toEqual([]);
  });

  it('thanh khoản: liq 3 ⇒ cú đẩy gấp 3; cá mập ×4 tiền 3 ⇒ min(3, 1,2) ⇒ −1,2 %', () => {
    expect(dayChuyen(P, [A], 3).suKien[0]!.mag).toBeCloseTo(-0.018, 12);
    const r = dayChuyen(gia((k) => (k < 50 ? 100 : 77)), [{ ai: 'ca_map', L: 4, tien: 3, vao: 0 }], 1);
    expect(r.suKien[0]!.mag).toBeCloseTo(-0.012, 12);
  });

  it('tan HẾT trước cuối màn: sập sát cuối ⇒ không đẩy (điểm cuối giữ % engine); mọi cú đẩy về 0 ở nhịp cuối', () => {
    const r = dayChuyen(gia((k) => (k < 470 ? 100 : 80)), [A], 1);
    expect(r.lech[SO_NHIP - 1]).toBe(0);
    const r2 = dayChuyen(P, [A, B], 1);
    expect(r2.lech[SO_NHIP - 1]).toBe(0);
  });
});

describe('§II — dựng màn', () => {
  const ghe = (id: string, loai: 'nguoi' | 'bot'): GheMoi => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } });
  const st0 = { ...taoTran(5, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua('balance-v57-minigame'), 12), vong: 5 };
  /** Ghế bot g1 cầm lõi `loiBot` + khoản `vtBot`; người chơi cầm BTC (mã chính) + Vàng. */
  const stCo = (loiBot: string[], vtBot: Record<string, number>) => ({ ...st0, ghe: st0.ghe.map((g) => g.id === 'g1'
    ? { ...g, danh_muc: { ...g.danh_muc, chien_thuat: loiBot }, vi_the: vtBot } : { ...g, vi_the: { btc: 5000, vang: 2000, tpcp: 1500 } }) }) as never;
  const bcCua = (st: never) => {
    const nguoi = (st as { ghe: { id: string }[] }).ghe.find((g) => g.id === 'ban')!;
    const bc = boiCanhCuaGhe(st, 5, 4, nguoi as never, { btc: -2000, vang: 300, tpcp: 200 });   // BTC −20 % ⇒ hai người ×10 sập liền (đo 04/10: nhịp 225 → 235)
    if ('loi' in bc) throw new Error(bc.loi);
    return bc;
  };
  it('⭐ ghế KHÁC cầm Đòn Bẩy + cùng mã ⇒ `day_chuyen`; khác mã / không cầm Đòn Bẩy ⇒ không cờ', () => {
    expect(bcCua(stCo(['don_bay'], { btc: 3000 })).day_chuyen).toBe(true);
    expect(bcCua(stCo(['don_bay'], { vn30: 3000 })).day_chuyen).toBeUndefined();
    expect(bcCua(stCo(['bat_day'], { btc: 3000 })).day_chuyen).toBeUndefined();
  });
  it('⭐ có dây chuyền: điểm cuối giữ nguyên % engine; sự kiện tất định; tắt cờ thì đường gốc', () => {
    const bc0 = bcCua(stCo(['don_bay'], { btc: 3000 }));
    // D521 — màn `thac_v2`: cú thanh lý để lại vết ⇒ giá cuối lệch đúng Σ (vết × cú) so với đường không cú; màn cũ (bỏ cờ) giữ nguyên.
    const du2 = dungDongManDu(bc0), goc2 = dungDongMan({ ...bc0, day_chuyen: undefined, day_chuyen_khong: undefined, dam_dong: undefined, bay: undefined } as never);
    const vet = du2.xung.reduce((a, x) => a + (x.con ?? 0) * x.mag, 0);
    expect(vet, 'màn thử phải có vết').not.toBe(0);
    expect(du2.min[du2.min.length - 1]!.c / goc2[goc2.length - 1]!.c - 1).toBeCloseTo(vet, 9);
    const { thac_v2: _v, ...bc } = bc0;
    const du = dungDongManDu(bc), goc = dungDongMan({ ...bc, day_chuyen: undefined } as never);
    const cuoi = (m: NenMin[]) => m[m.length - 1]!.c;
    expect(cuoi(du.min)).toBeCloseTo(cuoi(goc), 9);
    expect(dungDongManDu(bc).tl).toEqual(du.tl);
    expect(du.tl.length, 'màn thử phải CÓ cú thanh lý — không thì bài này rỗng').toBeGreaterThanOrEqual(2);
    for (const e of du.tl) {
      const k = e.nhip + 8, chay = (m: NenMin[]) => m.slice(NEN_LS * K_MIN);
      expect(chay(du.min)[Math.floor(k / 8)]!.tick[k % 8]!, `nhịp ${k} sau cú bán`).toBeLessThan(chay(goc)[Math.floor(k / 8)]!.tick[k % 8]!);
    }
  });
  it('⭐ lô nhịp chỉ chở cú bán ĐÃ xảy ra trong khoảng của lô — không lộ cú tương lai', () => {
    const bc = bcCua(stCo(['don_bay'], { btc: 3000 })), du = dungDongManDu(bc), k = du.tl[0]!.nhip;
    expect(loNhip(du.min, 0, k - 1, undefined, du.tl).tl).toBeUndefined();
    expect(loNhip(du.min, 0, k, undefined, du.tl).tl).toEqual([{ nhip: k, ai: du.tl[0]!.ai, L: du.tl[0]!.L }]);
  });
  it('⭐ bảng phụ: cú bán LAN XUÔI sang mã đi cùng/sau (Vàng), KHÔNG sang mã đi TRƯỚC (Trái phiếu dẫn Crypto)', () => {
    const bc = bcCua(stCo(['don_bay'], { btc: 3000 })), co = duongPhuCua(bc), khong = duongPhuCua({ ...bc, day_chuyen: undefined } as never);
    const tp = bc.phu!.find((x) => x.ma === 'tpcp')!, vang = bc.phu!.find((x) => x.ma === 'vang')!;
    expect(tp.tre!, 'TP đi trước Crypto').toBeLessThan(0);
    expect(vang.tre ?? 0).toBeGreaterThanOrEqual(0);
    expect(co.tpcp).toEqual(khong.tpcp);
    const k = dungDongManDu(bc).tl[0]!.nhip + 1 + (vang.tre ?? 0) * 16 + 8;
    expect(co.vang![k]).not.toBeCloseTo(khong.vang![k]!, 6);
  });
  it('bảng phụ: điểm cuối mã phụ giữ nguyên (cú đẩy lan sang tan hết)', () => {
    // D521 — màn cũ (bỏ `thac_v2`): cú lan sang tan hết. Màn mới: vết lan sang theo hệ số kéo — không còn bất biến này.
    const bc = { ...bcCua(stCo(['don_bay'], { btc: 3000 })), thac_v2: undefined } as never as ReturnType<typeof bcCua>, co = duongPhuCua(bc), khong = duongPhuCua({ ...bc, day_chuyen: undefined } as never);
    for (const x of bc.phu ?? []) expect(co[x.ma]![SO_NHIP]).toBeCloseTo(khong[x.ma]![SO_NHIP]!, 9);
  });
});
