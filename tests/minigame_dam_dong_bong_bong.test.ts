/**
 * D518 — ĐÁM ĐÔNG NỀN DÀY HƠN Ở BONG BÓNG (founder 05/10: *"Đám đông nền sẽ 'dày hơn bình thường' ở những sự kiện bong bóng"*). Bong bóng = tiền rẻ đẻ
 * người vay mua đổ xô: lớp TRƯỚC (1–2 ô trước ô bong bóng, đang thổi) và NỔ (chính ô đó) thêm `DAM_DONG_NEN.BONG_BONG` = [3 vay mua, 1 bán khống];
 * DƯ ÂM (sau khi vỡ) như thường — phe vay đã bị quét. Người thêm vào xen giữa người thường (lệch 2 nến hiện), rút số SAU người thường ⇒ người thường
 * của màn y hệt khi không bong bóng. Ghi `dam_dong.bb` vào bối cảnh ⇒ màn trước D518 dựng y cũ (D466).
 */
import { describe, expect, it } from 'vitest';
import { DAM_DONG_NEN, K_MIN } from '../config/minigame.js';
import { damDongNen } from '../server/holdem/minigame/dong_gia.js';

describe('§I — số người', () => {
  it('hằng số: BONG_BONG = [3, 1] (PLAYTEST-TUNE)', () => {
    expect(DAM_DONG_NEN.BONG_BONG).toEqual([3, 1]);
  });
  it('⭐ ô tăng: thường 3 mua + 1 khống ⇒ bong bóng 6 mua + 2 khống; người thường y hệt, người thêm đi SAU trong mảng', () => {
    for (const seed of [1, 7, 42, 2026]) {
      const thuong = damDongNen(seed, 'tang'), bb = damDongNen(seed, 'tang', true);
      expect(bb.filter((b) => b.chieu === 1)).toHaveLength(6);
      expect(bb.filter((b) => b.chieu === -1)).toHaveLength(2);
      expect(bb.slice(0, thuong.length)).toEqual(thuong);
      expect(bb.every((b) => b.ai === 'nen')).toBe(true);
    }
  });
  it('người thêm vào xen giữa: nến vào = (VAO_TU + 2 + VAO_BUOC·j + rút) × K_MIN, trong khoảng chạy', () => {
    const them = damDongNen(5, 'giam', true).slice(damDongNen(5, 'giam').length);
    const N = DAM_DONG_NEN;
    them.filter((b) => b.chieu === 1).forEach((b, j) => {
      const tu = (N.VAO_TU + 2 + N.VAO_BUOC * j) * K_MIN;
      expect(b.vao).toBeGreaterThanOrEqual(tu);
      expect(b.vao).toBeLessThan(tu + N.VAO_THEM * K_MIN);
    });
  });
});

describe('§II — bối cảnh màn thật', async () => {
  const { luatCua } = await import('../config/holdem_balance.js');
  const { taoTran } = await import('../server/holdem/engine.js');
  const { boiCanhCuaGhe } = await import('../server/holdem/minigame/quyet_toan.js');
  const { damDongCua } = await import('../server/holdem/minigame/man.js');
  const ghe = (id: string, loai: 'nguoi' | 'bot') => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } }) as never;
  it('⭐ lớp TRƯỚC + NỔ của bong bóng ⇒ `dam_dong.bb`; DƯ ÂM và mọi nguồn khác ⇒ không; đám đông của màn dày thêm đúng 4', () => {
    const gap = { co: 0, khong: 0, duAm: 0 };
    for (let seed = 1; seed <= 120; seed++) {
      const st0 = taoTran(seed, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua('balance-v57-minigame'), 12) as any;
      for (let vong = 1; vong <= 11; vong++) {
        const st = { ...st0, vong: vong + 1, ghe: st0.ghe.map((g: any) => ({ ...g, vai: 'ca_nhan', trait: [], vi_the: { btc: 5000 } })) };
        const bc = boiCanhCuaGhe(st, seed, vong, st.ghe[0], { btc: 300 }) as any;
        if ('loi' in bc) continue;
        const bb = bc.nguon.kind === 'su_kien' && bc.nguon.the === 'bong_bong';
        if (bb && bc.nguon.lop !== 'du_am') {
          gap.co++;
          expect(bc.dam_dong).toEqual({ o: bc.kb.o, bb: true });
          const { bb: _b, ...dd } = bc.dam_dong;
          expect(damDongCua(bc).length - damDongCua({ ...bc, dam_dong: dd }).length).toBe(4);
        } else {
          if (bb) gap.duAm++; else gap.khong++;
          expect(bc.dam_dong).toEqual({ o: bc.kb.o });
        }
      }
    }
    expect(gap.co, 'không gặp ô bong bóng nào thì bài này không đo gì').toBeGreaterThan(0);
    expect(gap.duAm, 'không gặp DƯ ÂM bong bóng nào').toBeGreaterThan(0);
  });
});
