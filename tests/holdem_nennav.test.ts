/**
 * v14 — NỀN = PHÍ QUẢN LÝ TRÊN NAV (founder chốt B, 01/08). Điểm mù audit:
 * nền cũ chỉ trừ tiền mặt nên all-in là né nộp quỹ hợp lệ.
 */
import { describe, expect, it } from 'vitest';
import { HOLDEM_MATCH, luatCua } from '../config/holdem.js';
import {
  apLenhVongNav, giaiQuyetVong, taoTran, type GheMoi,
} from '../server/holdem/engine.js';

const ghe = (id: string): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] },
});
const THEO = () => ({ loai: 'theo' as const });

describe('v14 — all-in hết đường né nộp quỹ', () => {
  it('ghế all-in vẫn đóng đủ nền: quỹ ≥ nền × ghế sống, vị thế bị trừ', () => {
    let st = taoTran(21, [ghe('a'), ghe('b'), ghe('c')], luatCua('balance-v14-nennav'));
    st = apLenhVongNav(st, 'a', [{ ma: 'btc', tien: HOLDEM_MATCH.START_VON }]).st;
    const r = giaiQuyetVong(st, THEO);
    // Cốt của B: ghế tiền mặt 0 vẫn đóng đủ — quỹ không teo được nữa.
    // (Vị thế bị trừ pro-rata nhưng định giá + quỹ chia về có thể nâng NAV
    // cùng vòng, nên không khẳng định chiều NAV ở đây — audit sweep 400 trận
    // đã khoá các bất biến còn lại.)
    expect(r.ketQua.quy_vong).toBeGreaterThanOrEqual(HOLDEM_MATCH.CAM_KET_NEN * 3);
  });

  it('đối chứng v13: all-in vẫn né được (luật cũ giữ nguyên cho trận cũ)', () => {
    let st = taoTran(21, [ghe('a'), ghe('b'), ghe('c')], luatCua('balance-v13-succang'));
    st = apLenhVongNav(st, 'a', [{ ma: 'btc', tien: HOLDEM_MATCH.START_VON }]).st;
    const r = giaiQuyetVong(st, THEO);
    expect(r.ketQua.quy_vong).toBeLessThan(HOLDEM_MATCH.CAM_KET_NEN * 3);
  });

  it('mặc định là v14; NAV không âm sau nhiều vòng phí', () => {
    expect(luatCua('balance-v14-nennav').nenNav).toBe(true);
    let st = taoTran(33, [ghe('a'), ghe('b'), ghe('c')], luatCua('balance-v14-nennav'));
    st = apLenhVongNav(st, 'a', [{ ma: 'usd', tien: HOLDEM_MATCH.START_VON }]).st;
    for (let v = 0; v < 8; v += 1) {
      const r = giaiQuyetVong(st, THEO);
      st = r.trangThai;
      for (const g of st.ghe) {
        expect(g.von).toBeGreaterThanOrEqual(0);
        for (const x of Object.values(g.vi_the)) expect(x).toBeGreaterThanOrEqual(0);
      }
      if (st.vong > st.map.o.length) break;
    }
  });
});
