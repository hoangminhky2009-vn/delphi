/**
 * D517 — BẦY CÁ NHÂN (founder 05/10 chọn B "nhưng hệ số thấp hơn" + "Bot cá nhân ko được tính ư mà phải đợi người thật?"). Mỗi Cá nhân không tự đẩy
 * giá (TU_DAY.VAI ca_nhan = 0); nhưng cả BẦY đuổi theo chuỗi nến: đủ `CHUOI` nến hiện liền cùng màu thì cả bầy vào CÙNG chiều ⇒ một cú đẩy TẠM (tan
 * hết như cú thanh lý, điểm cuối giữ % engine). Cỡ bầy n = `NPC` Cá nhân nền + số ghế Cá nhân KHÁC (bot hay người) đang giữ mã — không chờ người thật.
 *
 * Vector tay (liq 1; nến hiện = 2 nến mịn = 16 nhịp; MAG 0,002 · CHUAN 4 · TRAN 2 · TAN 3 nến hiện):
 *  · 3 nến xanh (nhịp 0–47) ⇒ bầy MUA ở nhịp 47 (s = 48/8 = 6): mag = 0,002 × min(2, √(4/4)) = 0,002; cú {t0 6, trai 2, tan 6}. Nhịp 63 (s = 8) lệch đủ +0,002.
 *    Sau đó giá đứng yên: cú bầy tan dần vẽ 3 nến đỏ, nhưng bầy KHÔNG đuổi theo bóng mình ⇒ đúng MỘT cú.
 *  · n 9 ⇒ 0,002 × 1,5 = 0,003 · n 16 ⇒ × 2 = 0,004 · n 25 ⇒ kẹp trần 0,004 (thấp hơn một cú thanh lý TL_DAY tối đa 0,03).
 *  · 3 nến đỏ (100 → 99,4) ⇒ bầy BÁN −0,004 (n 16): người vay mua ×100 vào ở 100 (ngưỡng 100·(1 − 0,9/100) = 99,1) — giá tự nó chỉ xuống 99,4,
 *    bầy đè thêm: nhịp 59 (s 7,5; dốc 0,75) 99,4 × 0,997 = 99,102 > 99,1 · nhịp 60 (s 7,625; dốc 0,8125) 99,4 × 0,99675 = 99,077 ⇒ BÁN CƯỠNG BỨC ở nhịp 60.
 */
import { describe, expect, it } from 'vitest';
import { BAY_CA_NHAN, SO_NHIP } from '../config/minigame.js';
import { dayChuyen, type BotDonBay } from '../server/holdem/minigame/dong_gia.js';

const P = (f: (i: number) => number) => Array.from({ length: SO_NHIP }, (_, i) => f(i));
const len3 = P((i) => (i < 48 ? 100 + i * 0.01 : 100.47));
const xuong3 = P((i) => (i < 48 ? 100 - (i * 0.6) / 47 : 99.4));

describe('§I — luật bầy (vector tay)', () => {
  it('hằng số: NPC 3 · CHUOI 3 · MAG 0,002 · CHUAN 4 · TRAN 2 · TAN 3 (PLAYTEST-TUNE)', () => {
    expect(BAY_CA_NHAN).toEqual({ NPC: 3, CHUOI: 3, MAG: 0.002, CHUAN: 4, TRAN: 2, TAN: 3 });
  });
  it('⭐ 3 nến xanh liền ⇒ bầy MUA ở cuối nến thứ 3: đúng MỘT cú +0,002 (không đuổi theo bóng mình), ramp đủ ở nhịp 63', () => {
    const r = dayChuyen(len3, [], 1, undefined, { n: 4 });
    expect(r.bay).toEqual([{ nhip: 47, n: 4, mag: 0.002 }]);
    expect(r.xung).toEqual([{ t0: 6, mag: 0.002, trai: 2, tan: 6 }]);
    expect(r.lech[63]).toBeCloseTo(0.002, 12);
  });
  it('⭐ cỡ theo căn bậc hai, kẹp trần: n 9 ⇒ 0,003 · n 16 ⇒ 0,004 · n 25 ⇒ 0,004', () => {
    expect(dayChuyen(len3, [], 1, undefined, { n: 9 }).bay[0]!.mag).toBeCloseTo(0.003, 12);
    expect(dayChuyen(len3, [], 1, undefined, { n: 16 }).bay[0]!.mag).toBeCloseTo(0.004, 12);
    expect(dayChuyen(len3, [], 1, undefined, { n: 25 }).bay[0]!.mag).toBeCloseTo(0.004, 12);
  });
  it('2 nến xanh rồi đi ngang ⇒ không bầy · bối cảnh cũ (không `bay`) ⇒ không cú nào', () => {
    const len2 = P((i) => (i < 32 ? 100 + i * 0.01 : 100.31));
    expect(dayChuyen(len2, [], 1, undefined, { n: 4 }).bay).toEqual([]);
    const cu = dayChuyen(len3, [], 1);
    expect(cu.xung).toEqual([]);
    expect(cu.bay).toEqual([]);
  });
  it('⭐ 3 nến đỏ ⇒ bầy BÁN (cú âm) và CHÂM NGÒI người vay ×100 ở nhịp 60; không bầy thì người đó sống', () => {
    const vay: BotDonBay[] = [{ ai: 'nen', chieu: 1, L: 100, tien: 0.4, vao: 0 }];
    const co = dayChuyen(xuong3, vay, 1, undefined, { n: 16 });
    expect(co.bay[0]).toMatchObject({ nhip: 47, n: 16 });
    expect(co.bay[0]!.mag).toBeCloseTo(-0.004, 12);
    expect(co.suKien.map((x) => x.nhip)).toEqual([60]);
    expect(dayChuyen(xuong3, vay, 1).suKien).toEqual([]);
  });
});

describe('§II — nối vào màn thật: bot Cá nhân được tính, không chờ người thật', async () => {
  const { luatCua } = await import('../config/holdem_balance.js');
  const { taoTran } = await import('../server/holdem/engine.js');
  const { boiCanhCuaGhe } = await import('../server/holdem/minigame/quyet_toan.js');
  const ghe = (id: string, loai: 'nguoi' | 'bot') => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } }) as never;
  const ban = (khoa: string, viTheBot: Record<string, number>) => {
    const st = taoTran(11, [ghe('ban', 'nguoi'), ghe('g1', 'bot'), ghe('g2', 'bot'), ghe('g3', 'bot')], luatCua(khoa), 12);
    return { ...st, vong: 3, ghe: st.ghe.map((g) => ({ ...g, vai: g.id === 'g3' ? 'ca_map' : 'ca_nhan', trait: [],
      vi_the: g.id === 'ban' ? { btc: 100000 } : viTheBot, danh_muc: { ...g.danh_muc, chien_thuat: ['bat_day'] as never } })) } as never;
  };
  const bcCua = (st: any) => {
    const bc = boiCanhCuaGhe(st, 11, 2, st.ghe[0], { btc: 300 });
    if ('loi' in bc) throw new Error(bc.loi);
    return bc;
  };
  it('⭐ v57: n = 3 NPC + 2 bot Cá nhân giữ BTC = 5 (Cá Mập giữ BTC không tính, chính mình không tính)', () => {
    expect(bcCua(ban('balance-v57-minigame', { btc: 5000 })).bay).toEqual({ n: 5 });
  });
  it('bot Cá nhân không giữ mã của màn ⇒ chỉ NPC: n = 3', () => {
    expect(bcCua(ban('balance-v57-minigame', { vang: 5000 })).bay).toEqual({ n: 3 });
  });
  it('v56 (không cờ `bayCaNhanV57`) ⇒ bối cảnh không có `bay` (màn cũ dựng lại byte-hệt)', () => {
    expect(bcCua(ban('balance-v56-congdon', { btc: 5000 })).bay).toBeUndefined();
  });
});
