/**
 * D43 BƯỚC 4 — SỨC CĂNG (v13): S-map nạp/xả có thật, khuếch đại CHẢY vào
 * chain qua đường chạy thật, và cổng tắt thì thế giới cũ nguyên vẹn.
 */
import { describe, expect, it } from 'vitest';
import { SUC_CANG, luatCua } from '../config/holdem.js';
import { sinhMap } from '../server/holdem/map.js';
import {
  apLenhVongNav, giaiQuyetVong, taoTran, type GheMoi,
} from '../server/holdem/engine.js';

const V13 = luatCua('balance-v13-succang');
const ghe = (id: string): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] },
});
const THEO = () => ({ loai: 'theo' as const });

describe('S-map trong sinhMap', () => {
  it('v13: S sống — có ô căng thật, không âm, không vượt trần; v12: khoá 0', () => {
    let coCang = false;
    for (let seed = 1; seed <= 300; seed += 1) {
      const m = sinhMap(seed, 12, { lich: true, quanTinh: true, sucCang: true });
      for (const t of m.trang_thai!) {
        for (const sBp of t.suc_cang_bp) {
          expect(sBp).toBeGreaterThanOrEqual(0);
          expect(sBp).toBeLessThanOrEqual(SUC_CANG.TRAN_BP);
          if (sBp > 0) coCang = true;
        }
      }
      const v12 = sinhMap(seed, 12, { lich: true, quanTinh: true });
      expect(v12.trang_thai!.every((t) => t.suc_cang_bp.every((x) => x === 0)))
        .toBe(true);
    }
    expect(coCang).toBe(true);
  });

  it('tất định: cùng seed → cùng S từng ô', () => {
    const a = sinhMap(555, 12, { lich: true, quanTinh: true, sucCang: true });
    const b = sinhMap(555, 12, { lich: true, quanTinh: true, sucCang: true });
    expect(JSON.stringify(a.trang_thai)).toBe(JSON.stringify(b.trang_thai));
  });
});

describe('khuếch đại qua đường chạy thật (giaiQuyetVong)', () => {
  it('mắt xích cang_bp NỔ end-to-end trên trận v13 — không phải hàng trang trí', () => {
    let coCangChain = false;
    for (let seed = 1; seed <= 60 && !coCangChain; seed += 1) {
      let st = taoTran(seed, [ghe('a'), ghe('b'), ghe('c')], V13);
      st = apLenhVongNav(st, 'a', [{ ma: 'btc', tien: 8000 }]).st;
      let guard = 0;
      while (guard < 12 && !coCangChain) {
        guard += 1;
        const r = giaiQuyetVong(st, THEO);
        const cuaA = r.ketQua.ket_qua.find((k) => k.ghe_id === 'a');
        if (cuaA?.chain.some((m) => (m as { cang_bp?: number }).cang_bp
          !== undefined)) coCangChain = true;
        st = r.trangThai;
        if (st.ghe.every((g) => g.da_chay)) break;
        if (st.vong > st.map.o.length) break;
      }
    }
    expect(coCangChain).toBe(true);
  });

  it('cổng tắt (v12) → không mắt xích nào mang cang_bp', () => {
    let st = taoTran(7, [ghe('a'), ghe('b')], luatCua('balance-v12-quantinh'));
    st = apLenhVongNav(st, 'a', [{ ma: 'btc', tien: 8000 }]).st;
    for (let v = 0; v < 6; v += 1) {
      const r = giaiQuyetVong(st, THEO);
      for (const k of r.ketQua.ket_qua) {
        expect(k.chain.every((m) => (m as { cang_bp?: number }).cang_bp
          === undefined)).toBe(true);
      }
      st = r.trangThai;
    }
  });
});
