/**
 * D346 — PHÍ MUA BÁN HAI BẬC (`balance-v51-phibac`). Founder 17/09: *"Hãm lối chơi đó đi, trade off
 * rõ"* — lối "dồn hết vốn mỗi vòng".
 *
 * Bài này khoá ĐÚNG hai thứ mà gate không nhìn thấy:
 *  · BẬC 1 rẻ như ngoài đời và KHÔNG leo theo cỡ lệnh cho tới ngưỡng (đây là cái founder đòi);
 *  · BẬC 2 leo đúng theo cỡ phần vượt, kẹp trần, và áp cho CẢ lệnh bán (thử miễn bán ⇒ gate ✗ 52,9%).
 *
 * Vector tính TAY (A8.3), độ sâu chợ 10.000 · ngưỡng 4.000 · dốc ×70/độ sâu · trần ×60 · gốc
 * 60/30/15bp (mỏng/vừa/dày):
 *  · CP (vừa, 30bp) 2.500  → floor(2500·30/10000) = 7            (0,28% cỡ lệnh)
 *  · CP 4.000              → 12                                   (0,30%)
 *  · CP 5.000              → 12 + floor(3 · 80000/10000) = 36      (0,72%)
 *  · CP 10.000             → 12 + floor(18 · 430000/10000) = 786   (7,86%)
 *  · BTC (mỏng, 60bp) 10.000 → 24 + floor(36 · 430000/10000) = 1572 (15,72%)
 *  · CP 30.000 (cá mập)    → 12 + floor(78 · 600000/10000) = 4692  (15,64% — chạm TRẦN ×60)
 */
import { describe, expect, it } from 'vitest';
import { apLenhGiaoDich, truotBacV51, truotBacV51Bp } from '../server/holdem/nav.js';
import { apLenhMocNav, taoTran, type GheMoi } from '../server/holdem/engine.js';
import { DAC_QUYEN, HOLDEM_BALANCE_VERSION, PHI_LENH_V51 } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';

const phi = (ma: string, tien: number, opts: Record<string, unknown>): number => {
  const g = { von: Math.max(tien, 30_000), vi_the: {} as Record<string, number> };
  const r = apLenhGiaoDich(g, [{ ma, tien }], opts as never);
  expect(r.loi).toBeNull();
  return r.phi_quy;
};
const BAC = { phiLenhNhe: true, phiLenhBac: true };

describe('I. Bậc 1 — giá như ngoài đời, KHÔNG leo theo cỡ lệnh', () => {
  it('vector tay: CP 2.500 ⇒ 7 · CP 4.000 ⇒ 12 (0,28% và 0,30% cỡ lệnh)', () => {
    expect(phi('cp_cn', 2_500, BAC)).toBe(7);
    expect(phi('cp_cn', 4_000, BAC)).toBe(12);
  });

  it('mọi lệnh ≤ ngưỡng trả ĐÚNG suất gốc — phí/cỡ lệnh không đổi khi lệnh to dần', () => {
    const suat = (t: number) => phi('cp_cn', t, BAC) / t;
    const s1 = suat(1_000);
    for (const t of [2_000, 3_000, 4_000]) {
      expect(Math.abs(suat(t) - s1), `lệnh ${t} lệch suất gốc`).toBeLessThan(0.0002);
    }
  });

  it('ngưỡng đọc từ ĐỘ SÂU CHỢ, không từ vốn ghế: ghế 30.000 và ghế 10.000 trả y nhau cho cùng cỡ lệnh', () => {
    const g1 = { von: 10_000, vi_the: {} as Record<string, number> };
    const g2 = { von: 30_000, vi_the: {} as Record<string, number> };
    const a = apLenhGiaoDich(g1, [{ ma: 'cp_cn', tien: 4_000 }], BAC as never);
    const b = apLenhGiaoDich(g2, [{ ma: 'cp_cn', tien: 4_000 }], BAC as never);
    expect(a.phi_quy).toBe(b.phi_quy);
  });
});

describe('II. Bậc 2 — phần vượt bị đẩy giá, kẹp trần', () => {
  it('vector tay: CP 5.000 ⇒ 36 · CP 10.000 ⇒ 786 · BTC 10.000 ⇒ 1.572', () => {
    expect(phi('cp_cn', 5_000, BAC)).toBe(36);
    expect(phi('cp_cn', 10_000, BAC)).toBe(786);
    expect(phi('btc', 10_000, BAC)).toBe(1_572);
  });

  it('vector tay: cá mập dồn 30.000 vào CP ⇒ 4.692, đúng TRẦN ×60', () => {
    expect(truotBacV51Bp(30_000)).toBe(PHI_LENH_V51.TRAN_BP);
    expect(phi('cp_cn', 30_000, BAC)).toBe(4_692);
  });

  it('LỆNH BÁN cũng chịu bậc 2 — miễn cho bán là mở lại lối dồn hết (đo: 52,9% ✗)', () => {
    const g = { von: 0, vi_the: { cp_cn: 10_000 } as Record<string, number> };
    const r = apLenhGiaoDich(g, [{ ma: 'cp_cn', tien: -10_000 }], BAC as never);
    expect(r.loi).toBeNull();
    expect(r.phi_quy).toBe(786);
  });

  it('`truotBacV51` khớp từng chip với đường đi qua `apLenhGiaoDich`', () => {
    for (const t of [500, 4_000, 4_001, 7_500, 10_000, 22_000]) {
      expect(truotBacV51(t, PHI_LENH_V51.GOC_BP.vua), `cỡ ${t}`).toBe(phi('cp_cn', t, BAC));
    }
  });
});

describe('III. So với v50 và Khớp Nhanh', () => {
  it('lệnh vừa RẺ hơn v50, lệnh dồn hết ĐẮT hơn v50 — đúng hình "phanh dồn vào cái đuôi"', () => {
    const v50 = { phiLenhNhe: true };
    expect(phi('cp_cn', 2_500, BAC)).toBeLessThan(phi('cp_cn', 2_500, v50));
    expect(phi('cp_cn', 10_000, BAC)).toBeGreaterThan(phi('cp_cn', 10_000, v50));
  });

  it('Khớp Nhanh: phần còn lại áp SAU hai bậc ⇒ 30% của 786 = 235', () => {
    expect(phi('cp_cn', 10_000, { ...BAC, phiLenhConBp: DAC_QUYEN.KHOP_NHANH.LENH_CON_BP }))
      .toBe(Math.floor((786 * DAC_QUYEN.KHOP_NHANH.LENH_CON_BP) / 10000));
  });

  it('cờ TẮT ⇒ đúng số cũ từng chip (trận cũ replay nguyên)', () => {
    expect(phi('cp_cn', 10_000, { phiLenhNhe: true })).toBe(400);
    expect(phi('cp_cn', 10_000, { voiVang: true })).toBe(1_020);
    expect(phi('cp_cn', 10_000, {})).toBe(60);
    // `phiLenhBac` một mình (không có cờ nhẹ) KHÔNG mở được bậc — cổng đi theo cặp.
    expect(phi('cp_cn', 10_000, { phiLenhBac: true, voiVang: true })).toBe(1_020);
  });
});

describe('IV. Đường engine thật', () => {
  const ban = (pb: string, the: string[]) => taoTran(5, [
    { id: 'a', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: the as never } },
    { id: 'b', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } } as GheMoi,
  ], luatCua(pb), 8);
  const lenh = [{ ma: 'cp_cn', chieu: 'mua' as const, moc_bp: 10000 }];

  it('v51 mặc định: ALL-IN CP mất 786 · cầm Khớp Nhanh 235 · v50 vẫn 400 (replay trận cũ)', () => {
    expect(apLenhMocNav(ban('balance-v51-phibac', []), 'a', lenh).st.phi_giao_dich_vong).toBe(786);
    expect(apLenhMocNav(ban('balance-v51-phibac', ['khop_nhanh']), 'a', lenh).st.phi_giao_dich_vong)
      .toBe(Math.floor((786 * DAC_QUYEN.KHOP_NHANH.LENH_CON_BP) / 10000));
    expect(apLenhMocNav(ban('balance-v50-phinhe', []), 'a', lenh).st.phi_giao_dich_vong).toBe(400);
  });

  it('bảng luật: v51 bật cả `phiLenhNhe` lẫn `phiLenhBac`; v50 chỉ bật cờ nhẹ', () => {
    expect(luatCua('balance-v51-phibac').phiLenhBac).toBe(true);
    expect(luatCua('balance-v51-phibac').phiLenhNhe).toBe(true);
    expect(luatCua('balance-v50-phinhe').phiLenhBac).toBe(false);
  });

  /*
   * ⚠ GHIM TÍNH CHẤT, KHÔNG GHIM CHUỖI TÊN (sửa 21/09, D371).
   *
   * Dòng này từng là `expect(HOLDEM_BALANCE_VERSION).toBe('balance-v51-phibac')`, và nó đỏ ở
   * MỌI lần lật bộ luật kể cả khi phí hai bậc vẫn chạy đúng — tức nó canh "hằng số có đổi
   * không", không canh "cơ chế còn sống không". Thứ bài này phải bảo vệ là: trận MỚI vẫn chạy
   * phí hai bậc. Bản sau kế thừa cờ thì bài phải XANH; bản sau đánh rơi cờ thì bài phải ĐỎ —
   * và `toBe(tên)` cho kết quả ngược ở cả hai vế.
   */
  it('MẶC ĐỊNH của repo vẫn bật phí hai bậc — mọi trận MỚI chạy nó', () => {
    expect(luatCua(HOLDEM_BALANCE_VERSION).phiLenhBac).toBe(true);
    expect(luatCua(HOLDEM_BALANCE_VERSION).phiLenhNhe).toBe(true);
  });
});
