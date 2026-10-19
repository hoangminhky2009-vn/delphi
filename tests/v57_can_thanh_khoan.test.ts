/**
 * D470 — CẠN THANH KHOẢN CÓ NGÒI (cổng `canSauKhung`, khoá v57). Founder 04/10: *"thẻ cạn thanh khoản chỉ xuất hiện sau thiên nga đen hoặc
 * g chuỗi bear dài"*. Lá `hack_san` ở MỌI mùa chỉ hợp lệ khi có hoảng loạn thật ≤ 5 ô trước hoặc chuỗi ≥ 2 lá Giảm (founder chọn B sau khi thấy 2 %).
 *
 *   §I   MÁY ĐỌC LUẬT  chuoiGiam · sauCuSoc · tinHopLe có / không cờ
 *   §II  MAP THẬT      1.000 map v57: mọi lá cạn thanh khoản đều có ngòi; v56 (vế ngược) vẫn có lá không ngòi ở mùa giảm
 */
import { describe, expect, it } from 'vitest';
import { LUAT_LA } from '../config/luat_la.js';
import { luatCua } from '../config/holdem_balance.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { chuoiGiam, sauCuSoc, tinHopLe } from '../server/holdem/luat_la.js';
import { sinhMap, type OThiTruong } from '../server/holdem/map.js';
import type { GiaiDoanId, SuKienId } from '../config/holdem.js';

const gd = (g: GiaiDoanId): OThiTruong => ({ kind: 'giai_doan', giai_doan: g });
const sk = (id: SuKienId): OThiTruong =>
  ({ kind: 'su_kien', su_kien: id, la_tin_gia: false, boi_canh: 'don_doc', bao_truoc: 'giam' } as OThiTruong);

describe('§I — máy đọc luật', () => {
  it('chuỗi Giảm đếm từ cuối; lá tin xen giữa KHÔNG cắt; lá pha khác thì cắt', () => {
    expect(chuoiGiam([gd('tang'), gd('giam'), gd('giam')])).toBe(2);
    expect(chuoiGiam([gd('giam'), sk('lam_phat'), gd('giam'), gd('giam')])).toBe(3);
    expect(chuoiGiam([gd('giam'), gd('di_ngang'), gd('giam')])).toBe(1);
    expect(chuoiGiam([gd('giam'), gd('tang')])).toBe(0);
    expect(chuoiGiam([])).toBe(0);
  });
  it('ngưỡng: chuỗi ≥ 2 lá Giảm · hoảng loạn ≤ 5 ô (founder chọn B, PLAYTEST-TUNE)', () => {
    expect(LUAT_LA.CAN_SAU_KHUNG.CHUOI_GIAM).toBe(2);
    expect(LUAT_LA.CAN_SAU_KHUNG.trong_o).toBe(5);
  });
  it('có ngòi: thiên nga đen thật trong 5 ô gần nhất, hoặc chuỗi Giảm ≥ 2', () => {
    const tang = (n: number) => Array.from({ length: n }, () => gd('tang'));
    expect(sauCuSoc([gd('tang'), sk('thien_nga_den'), ...tang(4)])).toBe(true);    // ô thứ 5
    expect(sauCuSoc([sk('thien_nga_den'), ...tang(5)])).toBe(false);               // quá 5 ô
    expect(sauCuSoc([gd('tang'), gd('giam'), gd('giam')])).toBe(true);
    expect(sauCuSoc([gd('giam'), gd('tang'), gd('giam')])).toBe(false);
    const gia = { ...sk('thien_nga_den'), la_tin_gia: true } as OThiTruong;
    expect(sauCuSoc([gd('tang'), gia])).toBe(false);   // tin GIẢ không phải ngòi
  });
  it('⭐ có cờ: mùa GIẢM không ngòi ⇒ CHẶN; không cờ (khoá cũ) ⇒ mùa giảm vẫn rút tự do (vế ngược, luật 24/09 chỉ chặn mùa lành)', () => {
    const o = [gd('tang'), gd('tang'), gd('giam')];
    expect(tinHopLe('hack_san', 'giam', o, true)).toBe(false);
    expect(tinHopLe('hack_san', 'giam', o, false)).toBe(true);
    expect(tinHopLe('hack_san', 'giam', [...o, gd('giam')], true)).toBe(true);
    expect(tinHopLe('hack_san', 'tang', [gd('tang'), sk('thien_nga_den')], true)).toBe(true);
    expect(tinHopLe('lam_phat', 'giam', o, true)).toBe(tinHopLe('lam_phat', 'giam', o, false));   // lá khác không đổi
  });
});

describe('§II — map thật', () => {
  const dem = (khoa: string, n: number) => {
    const opt = tuyChonSinhMap(luatCua(khoa));
    let la = 0, khongNgoi = 0;
    for (let s = 1; s <= n; s++) {
      const m = sinhMap(s * 7919 + 13, 12, opt);
      m.o.forEach((o, i) => {
        if (o.kind !== 'su_kien' || o.su_kien !== 'hack_san') return;
        la += 1;
        if (!sauCuSoc(m.o.slice(0, i))) khongNgoi += 1;
      });
    }
    return { la, khongNgoi };
  };
  it('⭐ v57: mọi lá CẠN THANH KHOẢN trên 1.000 map đều có ngòi, và lá vẫn còn xuất hiện (không bị xoá sổ)', () => {
    const r = dem('balance-v57-minigame', 1000);
    expect(r.khongNgoi).toBe(0);
    expect(r.la).toBeGreaterThan(5);
  });
  it('vế ngược: v56 vẫn có lá cạn thanh khoản KHÔNG ngòi (luật cũ chỉ chặn mùa lành)', () => {
    const r = dem('balance-v56-congdon', 400);
    expect(r.khongNgoi).toBeGreaterThan(0);
  });
});
