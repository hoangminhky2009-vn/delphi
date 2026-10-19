/**
 * D512 — CHUỖI SĂN phía server (demo bản 41 `datBot` · `botDonBayTick` · `mucXuLy` · `magThanhLy`): đám đông HAI PHE + đám đông NỀN + cú đẩy của người
 * châm ngòi đám đông NGAY TRONG MÀN. TEST VECTOR CHÉP TAY, viết TRƯỚC code (A8.3):
 *   phe mua ×L (chieu 1)  : vào ở p0, giá ≤ p0 × (1 − 0,9/L) ⇒ BÁN cưỡng bức, cú đẩy mag = −0,01 × liq × min(3, tiền × L / 10)   (D494 — giữ nguyên)
 *   phe khống ×L (chieu −1): giá ≥ p0 × (1 + 0,9/L) ⇒ MUA cưỡng bức, cú đẩy mag = +0,01 × liq × min(3, tiền × L / 10)
 *   đám đông NỀN (luôn có): phe mua · phe khống ×10/×5 xen kẽ, mỗi người 0,4; ô TĂNG 3 mua + 1 khống · ô GIẢM 1 + 3 · còn lại 2 + 2
 *   CHÂM NGÒI: đám đông xét ngưỡng trên giá ĐÃ CỘNG cú tự đẩy của người (vai lớn) — không có cú đẩy thì không có cú dây chuyền đó
 */
import { describe, expect, it } from 'vitest';
import { SO_NHIP } from '../config/minigame.js';
import { damDongDonBay, damDongKhong, damDongNen, dayChuyen } from '../server/holdem/minigame/dong_gia.js';

const phang = (gia: (i: number) => number = () => 100) => Array.from({ length: SO_NHIP }, (_, i) => gia(i));
const khong10 = { ai: 'nen' as const, chieu: -1 as const, L: 10, tien: 0.4, vao: 1 };
const mua10 = { ai: 'nen' as const, chieu: 1 as const, L: 10, tien: 0.4, vao: 1 };

describe('§I — phe khống bị MUA cưỡng bức', () => {
  it('⭐ khống ×10 vào ở 100 (nhịp 7) ⇒ giá 109,5 ở nhịp 40 ≥ 109 ⇒ mua cưỡng bức, cú đẩy +0,01 × 1 × min(3, 0,4) = +0,004', () => {
    const r = dayChuyen(phang((i) => (i >= 40 ? 109.5 : 100)), [khong10], 1);
    expect(r.suKien).toEqual([{ nhip: 40, ai: 'nen', L: 10, mag: expect.closeTo(0.004, 12) }]);
    expect(r.xung[0]!.mag).toBeCloseTo(0.004, 12);
  });
  it('vế ngược: giá 108,9 (< 109) ⇒ không ai bị mua; phe MUA không bị đụng khi giá lên', () => {
    expect(dayChuyen(phang((i) => (i >= 40 ? 108.9 : 100)), [khong10], 1).suKien).toEqual([]);
    expect(dayChuyen(phang((i) => (i >= 40 ? 120 : 100)), [mua10], 1).suKien).toEqual([]);
  });
  it('phe mua (D494) giữ nguyên: giá 90,9 ≤ 91 ⇒ bán cưỡng bức, cú đẩy −0,004', () => {
    const r = dayChuyen(phang((i) => (i >= 40 ? 90.9 : 100)), [mua10], 1);
    expect(r.suKien[0]).toEqual({ nhip: 40, ai: 'nen', L: 10, mag: expect.closeTo(-0.004, 12) });
  });
});

describe('§II — cú đẩy của người CHÂM NGÒI đám đông', () => {
  it('⭐ giá phẳng 100 + cú đẩy +10 % của người ở nhịp 30 ⇒ phe khống ×10 bị mua cưỡng bức ở nhịp 31; không có cú đẩy ⇒ không', () => {
    const lechNguoi = (i: number) => (i > 30 ? 0.1 : 0);
    expect(dayChuyen(phang(), [khong10], 1, lechNguoi).suKien.map((e) => e.nhip)).toEqual([31]);
    expect(dayChuyen(phang(), [khong10], 1).suKien).toEqual([]);
  });
});

describe('§III — đám đông', () => {
  it('⭐ đám đông NỀN: ô tăng 3 mua + 1 khống · ô giảm 1 + 3 · ngang 2 + 2; mỗi người 0,4, ×10/×5 xen kẽ, vào rải từ nến 4', () => {
    const dem = (o: string) => { const b = damDongNen(77, o); return [b.filter((x) => x.chieu === 1).length, b.filter((x) => x.chieu === -1).length]; };
    expect(dem('tang')).toEqual([3, 1]);
    expect(dem('giam')).toEqual([1, 3]);
    expect(dem('ngang')).toEqual([2, 2]);
    const b = damDongNen(77, 'ngang');
    expect(b.every((x) => x.tien === 0.4 && x.ai === 'nen' && x.vao >= 4 * 2)).toBe(true);
    expect(b.filter((x) => x.chieu === 1).map((x) => x.L)).toEqual([10, 5]);
  });
  it('đám đông KHỐNG (ghế khác cầm Bán Khống cùng mã) là gương của đám đông đòn bẩy: cá mập ×4 + 3–5 người, chieu −1', () => {
    const k = damDongKhong(123), m = damDongDonBay(123);
    expect(k.every((x) => x.chieu === -1)).toBe(true);
    expect(m.every((x) => x.chieu === 1)).toBe(true);
    expect(k[0]).toMatchObject({ ai: 'ca_map', L: 4 });
    expect(k.length).toBeGreaterThanOrEqual(4);
  });
});

describe('§IV — nối vào màn thật (bối cảnh · đường khớp hai lượt)', async () => {
  const { luatCua } = await import('../config/holdem_balance.js');
  const { taoTran } = await import('../server/holdem/engine.js');
  const { boiCanhCuaGhe, dungDongManKhop } = await import('../server/holdem/minigame/quyet_toan.js');
  const { dungDongMan } = await import('../server/holdem/minigame/man.js');
  const ghe = (id: string, loai: 'nguoi' | 'bot') => ({ id, loai, bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } }) as never;
  const banThu = (seed: number, vai: 'ca_map' | 'ca_nhan') => {
    const st = taoTran(seed, [ghe('ban', 'nguoi'), ghe('g1', 'bot')], luatCua('balance-v57-minigame'), 12);
    return { ...st, vong: 3, ghe: st.ghe.map((g) => ({ ...g, vai: g.id === 'ban' ? vai : 'ca_nhan', trait: [], vi_the: { btc: 100000 },
      danh_muc: { ...g.danh_muc, chien_thuat: ['bat_day'] as never } })) } as never;
  };
  const LS = { btc: 300 };
  it('⭐ bối cảnh màn mới có ĐÁM ĐÔNG NỀN theo hướng ô (`dam_dong.o` = hướng kịch bản)', () => {
    const bc = boiCanhCuaGhe(banThu(11, 'ca_nhan'), 11, 2, (banThu(11, 'ca_nhan') as any).ghe[0], LS);
    if ('loi' in bc) throw new Error(bc.loi);
    expect(bc.dam_dong).toEqual({ o: bc.kb.o });
  });
  it('⭐ Cá Mập VÀO HẾT đẩy giá ⇒ ở ít nhất một seed đám đông bị châm ngòi: đường khớp hai lượt KHÁC đường một lượt; Cá nhân ⇒ giống hệt', () => {
    const lenh = [{ seq: 1, nhip: 150, nut: 'vao_het' }, { seq: 2, nhip: 350, nut: 'thoat' }];
    let khac = 0;
    for (const seed of [11, 22, 33, 44, 55, 66, 77, 88]) {
      const st = banThu(seed, 'ca_map') as any, bc0 = boiCanhCuaGhe(st, seed, 2, st.ghe[0], LS);
      if ('loi' in bc0) continue;
      const bc = { ...bc0, loi_cam: ['bat_day'] };   // màn thật ghi lõi đang cầm lúc mở màn
      const a = dungDongManKhop(bc, lenh), b = dungDongMan(bc, lenh);
      if (JSON.stringify(a) !== JSON.stringify(b)) khac += 1;
      const st2 = banThu(seed, 'ca_nhan') as any, bc20 = boiCanhCuaGhe(st2, seed, 2, st2.ghe[0], LS);
      if ('loi' in bc20) continue;
      const bc2 = { ...bc20, loi_cam: ['bat_day'] };
      expect(JSON.stringify(dungDongManKhop(bc2, lenh)), `seed ${seed}: Cá nhân không đẩy ⇒ một lượt`).toBe(JSON.stringify(dungDongMan(bc2, lenh)));
    }
    expect(khac, 'cú đẩy của Cá Mập không châm ngòi đám đông ở seed nào thì bài này không đo gì').toBeGreaterThan(0);
  });
});

describe('§V — LỚP SOI (D513): chỉ vị thế đã mở + còn sống ở nhịp đang lộ; mỗi lõi một lớp', async () => {
  const { soiTai } = await import('../server/holdem/minigame/dong_gia.js');
  // hai phe mua ×10 (mở nhịp 10, p0 100 ⇒ sàn 91; mở nhịp 12, p0 100 ⇒ ×5 sàn 82) · một phe khống ×10 (mở nhịp 20, p0 100 ⇒ mức ép 109; bị mua ở nhịp 30)
  const vt = [
    { chieu: 1 as const, L: 10, tien: 0.4, p0: 100, i0: 10, iChet: null, mag: -0.03 },
    { chieu: 1 as const, L: 5, tien: 0.4, p0: 100, i0: 12, iChet: null, mag: -0.03 },
    { chieu: -1 as const, L: 10, tien: 0.4, p0: 100, i0: 20, iChet: 30, mag: 0.004 },
  ];
  it('⭐ Bán Khống thấy SÀN phe mua (91 · 82) — vị thế CHƯA mở ở nhịp đang lộ thì không hiện', () => {
    expect(soiTai(vt, 11, 100, 'ban_khong')).toEqual({ muc: [{ gia: expect.closeTo(91, 9), L: 10, tien: 0.4, vao: 10 }] });
    expect((soiTai(vt, 15, 100, 'ban_khong') as any).muc.map((m: { gia: number }) => +m.gia.toFixed(6))).toEqual([91, 82]);
  });
  it('⭐ Mua Đuổi thấy MỨC ÉP phe khống (109) khi đã mở và còn sống; bị mua cưỡng bức rồi (nhịp 30) thì biến mất', () => {
    expect((soiTai(vt, 25, 100, 'mua_duoi') as any).muc.map((m: { gia: number }) => +m.gia.toFixed(6))).toEqual([109]);
    expect(soiTai(vt, 31, 100, 'mua_duoi')).toEqual({ muc: [] });
  });
  it('⭐ Bắt Đáy thấy ĐÁY THÁC: châm sàn cao nhất dưới giá (91) ⇒ ×0,97 = 88,27 ≤ 82? không ⇒ dừng ở 88,27 · 1 cú; giá 95 ở dưới sàn ×5? không', () => {
    const t = (soiTai(vt, 15, 100, 'bat_day') as any).thac!;
    expect(t.ngoi).toBeCloseTo(91, 9);
    expect(t.day).toBeCloseTo(88.27, 9);
    expect(t.n).toBe(1);
  });
  it('đáy thác đổ DÂY CHUYỀN: sàn 91 và 89 ⇒ 91 × 0,97 = 88,27 ≤ 89 ⇒ đổ tiếp × 0,97 = 85,6219 · 2 cú; không ai ⇒ null; lõi khác ⇒ không lớp', () => {
    const v2 = [{ ...vt[0]!, p0: 100 }, { chieu: 1 as const, L: 10, tien: 0.4, p0: 100 * 89 / 91, i0: 12, iChet: null, mag: -0.03 }];
    const t = (soiTai(v2, 15, 100, 'bat_day') as any).thac!;
    expect(t.day).toBeCloseTo(85.6219, 6);
    expect(t.n).toBe(2);
    expect(soiTai([], 15, 100, 'bat_day')).toEqual({ thac: null });
    expect(soiTai(vt, 15, 100, 'don_bay')).toBeNull();
  });
});
