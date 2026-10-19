/**
 * D516 — ĐỘ SÂU CHỢ THEO VỐN VAI (cờ `phiSauVaiV57`, founder 05/10: "Cái đầu tiên thì cân bằng lại 1 tý"). Vốn vai ×10 · ×20 · ×50 (D506) mà
 * phí hai bậc (v50/v51) vẫn quy chiếu độ sâu 10.000 ⇒ Cá Mập đặt 10 % vốn (20.000) trả 2.892 phí (14,5 %, chạm trần ×60), Cá nhân đặt 10 % vốn
 * trả 3 (0,3 %). Dưới cờ: độ sâu của ghế = 10.000 × hệ_số_vốn^MU (MU = 0,75 — PLAYTEST-TUNE). Vai vốn to vẫn trả nặng hơn khi dồn hết, chỉ bớt bị nghiền.
 * §I ghim vector theo một sauBp CHO SẴN (44.721) — không phụ thuộc MU; §II ghim bảng sauBp của MU đang chốt.
 *
 * Vector tính TAY (A8.3), gốc CP (vừa) 30bp · ngưỡng 40 % độ sâu · dốc 700.000 · trần 600.000 · v50 dốc 90.000:
 *  · MU 0,75: sauBp Đội Lái floor(10000·10^0,75) = 56.234 · Cá Mập floor(10000·20^0,75) = 94.574 · Tổ Chức floor(10000·50^0,75) = 188.030 · Cá nhân: không gửi
 *  · CP 20.000, sâu 44.721: ngưỡng 17.888 ⇒ bậc 1 floor(17888·30/1e4) = 53; phần vượt 2.112 ⇒ floor(2112·30/1e4) = 6,
 *    hệ số 10000 + floor(700000·2112/44721) = 43.058 ⇒ floor(6·43058/1e4) = 25. Tổng 78 (0,39 %). Không cờ: 12 + 48·60 = 2.892.
 *  · CP 100.000, sâu 44.721: 53 + floor(82112·30/1e4)=246 × trần 60 = 14.760 ⇒ 14.813 (14,8 %). Không cờ: 12 + 288·60 = 17.292.
 *  · v50 vội vàng 10.000 ở sâu 44.721: 10000 + floor(10000·90000/44721) = 30.124 (không cờ 100.000).
 */
import { describe, expect, it } from 'vitest';
import { apLenhGiaoDich, heSoVoiVangV50Bp, truotBacV51 } from '../server/holdem/nav.js';
import { phiLenhCua, taoTran, type GheMoi } from '../server/holdem/engine.js';
import { luatCua } from '../config/holdem_balance.js';
import { sauPhiVaiBp, type VaiId } from '../server/holdem/vai.js';

const phi = (tien: number, opts: Record<string, unknown>): number => {
  const g = { von: tien * 2, vi_the: {} as Record<string, number> };
  const r = apLenhGiaoDich(g, [{ ma: 'cp_cn', tien }], opts as never);
  expect(r.loi).toBeNull();
  return r.phi_quy;
};
const BAC = { phiLenhNhe: true, phiLenhBac: true };

describe('I. Vector tay — phí hai bậc theo độ sâu của ghế', () => {
  it('⭐ CP 20.000 ở sâu 44.721 ⇒ 78 (không cờ 2.892) · CP 100.000 ⇒ 14.813 (không cờ 17.292)', () => {
    expect(phi(20_000, { ...BAC, sauBp: 44_721 })).toBe(78);
    expect(phi(20_000, BAC)).toBe(2_892);
    expect(phi(100_000, { ...BAC, sauBp: 44_721 })).toBe(14_813);
    expect(phi(100_000, BAC)).toBe(17_292);
  });
  it('hàm trần: truotBacV51 nhận độ sâu; mặc định = 10.000 (trận cũ replay nguyên) · v50 vội vàng 30.124 / 100.000', () => {
    expect(truotBacV51(20_000, 30, 44_721)).toBe(78);
    expect(truotBacV51(10_000, 30)).toBe(786);
    expect(heSoVoiVangV50Bp(10_000, 44_721)).toBe(30_124);
    expect(heSoVoiVangV50Bp(10_000)).toBe(100_000);
  });
  it('sauBp = 10000 trả ĐÚNG số không cờ (lệnh nhỏ, vượt ngưỡng, chạm trần)', () => {
    for (const t of [2_500, 5_000, 10_000, 30_000]) expect(phi(t, { ...BAC, sauBp: 10_000 })).toBe(phi(t, BAC));
  });
});

describe('II. Cổng — chỉ dưới `phiSauVaiV57`, theo vốn vai', () => {
  it('⭐ sauPhiVaiBp (MU 0,75): Cá nhân 10000 · Đội Lái 56.234 · Cá Mập 94.574 · Tổ Chức 188.030; cờ tắt ⇒ 10000 mọi vai', () => {
    const co = { vonVaiV57: true, phiSauVaiV57: true };
    expect(sauPhiVaiBp('ca_nhan', co)).toBe(10_000);
    expect(sauPhiVaiBp('doi_lai', co)).toBe(56_234);
    expect(sauPhiVaiBp('ca_map', co)).toBe(94_574);
    expect(sauPhiVaiBp('to_chuc', co)).toBe(188_030);
    expect(sauPhiVaiBp('ca_map', { vonVaiV57: true })).toBe(10_000);
  });
  it('⭐ v57: phiLenhCua (MỘT nguồn engine + DTO) gửi sauBp cho vai lớn, KHÔNG gửi cho Cá nhân; v56 không gửi', () => {
    const ghe = (vai: VaiId): GheMoi[] => [
      { id: 'ban', loai: 'nguoi', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] }, vai },
      { id: 'g1', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } },
    ];
    const sau = (khoa: string, vai: VaiId) => {
      const st = taoTran(4470, ghe(vai), luatCua(khoa), 12);
      return phiLenhCua(st, st.ghe.find((g) => g.id === 'ban')!).sauBp;
    };
    expect(sau('balance-v57-minigame', 'ca_map')).toBe(94_574);
    expect(sau('balance-v57-minigame', 'ca_nhan')).toBeUndefined();
    expect(sau('balance-v56-congdon', 'ca_map')).toBeUndefined();
  });
});
