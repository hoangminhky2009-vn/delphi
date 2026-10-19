/**
 * D465 — TIỀN của minigame: TEST VECTOR CHÉP TAY, viết TRƯỚC code (A8.3). Mọi số tiền là số nguyên, luôn FLOOR (C5) — kể cả số âm (floor về −∞).
 * Nguồn luật: demo đã chốt `docs/ui-ux/demo/minigame-bat-day.html` (A11.25) — `lai` · `tran` · `laiVay` (D462/D463) · phí Lướt Sóng (D462) · bán mạnh (D462).
 * Mỗi vector có phép tính tay ngay bên cạnh; đổi một con số ở đây là đổi LUẬT, phải có D-số.
 */
import { describe, expect, it } from 'vitest';
import {
  coKyQuy, heLoi, laiVi, tranLo, laiVayGop, phiKhopLs, kBanManh, mucLaiVay, HE_SO_LOI, PHI_LS_BP, LAI_VAY_PCT,
} from '../server/holdem/minigame/tien.js';

describe('§I — lãi lỗ một phần vị thế: floor(tiền × hệ số × chiều × (ra − vào) / vào)', () => {
  it('long ×2 giá +10%: 10.000 × 2 × 1 × 10/100 = 2.000', () => {
    expect(laiVi(10000, 100, 110, 1, 2)).toBe(2000);
  });
  it('short ×2 giá −10%: 10.000 × 2 × (−1) × (−10)/100 = 2.000', () => {
    expect(laiVi(10000, 100, 90, -1, 2)).toBe(2000);
  });
  it('FLOOR dương: 333 × 2 × 1/100 = 6,66 ⇒ 6', () => {
    expect(laiVi(333, 100, 101, 1, 2)).toBe(6);
  });
  it('FLOOR âm về −∞: 333 × 2 × (−1)/100 = −6,66 ⇒ −7 (không phải −6)', () => {
    expect(laiVi(333, 100, 99, 1, 2)).toBe(-7);
  });
  it('×10 giá −9%: 1.000 × 10 × (−9)/100 = −900', () => {
    expect(laiVi(1000, 100, 91, 1, 10)).toBe(-900);
  });
  it('D479 — trait ×3 trên lõi ×1 (bỏ ×2) ⇒ hệ số 3: 1.000 × 3 × 5/100 = 150', () => {
    expect(HE_SO_LOI).toBe(1);
    expect(laiVi(1000, 100, 105, 1, HE_SO_LOI * 3)).toBe(150);
  });
  it('kết quả luôn là số nguyên', () => {
    for (const [t, a, b, c, h] of [[4960, 101.37, 99.12, 1, 2], [777, 55.5, 61.25, -1, 4], [12345, 99.9, 100.1, 1, 10]] as const) {
      expect(Number.isInteger(laiVi(t, a, b, c, h))).toBe(true);
    }
  });
});

describe('§II — trần lỗ = cả khoản; lõi có vay thì cộng phần ĐÃ NẠP', () => {
  it('không vay: lỗ 15.000 trên khoản 10.000 ⇒ −10.000', () => {
    expect(tranLo(-15000, 10000, 0)).toBe(-10000);
  });
  it('có vay, đã nạp 2.000: lỗ 15.000 ⇒ −12.000', () => {
    expect(tranLo(-15000, 10000, 2000)).toBe(-12000);
  });
  it('lãi thì không đụng: +3.000 ⇒ +3.000', () => {
    expect(tranLo(3000, 10000, 0)).toBe(3000);
  });
});

describe('§III — lãi vay GỘP trên SỐ VAY (D463, founder chọn B): ×10 giữ trọn màn mất 15% / 12% / 9% khoản', () => {
  it('mức theo thị trường: thẻ tăng hoặc rất căng 15 · căng 12 · êm/ảm đạm 9', () => {
    expect(LAI_VAY_PCT).toEqual({ NONG: 15, CANG: 12, AM_DAM: 9 });
    expect(mucLaiVay('tang', 'em')).toBe(15);
    expect(mucLaiVay('giam', 'rat')).toBe(15);
    expect(mucLaiVay('ngang', 'cang')).toBe(12);
    expect(mucLaiVay('giam', 'em')).toBe(9);
  });
  it('$1.000 ×10 = vay $9.000; giữ trọn 30 nến gốc ở mức NÓNG: 9.000 × 15%/9 = 150', () => {
    expect(laiVayGop(1000, 9, 15, 30)).toBe(150);
  });
  it('cùng khoản ×4 = vay 3.000 ⇒ 3.000 × 15%/9 = 50 (⅓ của ×10)', () => {
    expect(laiVayGop(1000, 3, 15, 30)).toBe(50);
  });
  it('mức ẢM ĐẠM 9%: ×10 giữ trọn màn ⇒ 9.000 × 9%/9 = 90', () => {
    expect(laiVayGop(1000, 9, 9, 30)).toBe(90);
  });
  it('giữ nửa màn (15 nến gốc) — gộp: 9.000 × ((1 + 15%/9)^(1/2) − 1) = 74,6… ⇒ 74', () => {
    expect(laiVayGop(1000, 9, 15, 15)).toBe(74);
  });
  it('không vay (lõi thường ×2, không trait) ⇒ 0', () => {
    expect(laiVayGop(1000, 0, 15, 30)).toBe(0);
  });
});

describe('§IV — phí Lướt Sóng 45 bp mỗi lần khớp (D462), ĐẢO = 2 lần khớp', () => {
  it('khớp 4.960 ⇒ floor(4.960 × 45 / 10.000) = floor(22,32) = 22', () => {
    expect(PHI_LS_BP).toBe(45);
    expect(phiKhopLs(4960)).toBe(22);
  });
  it('khớp 10.000 ⇒ 45', () => {
    expect(phiKhopLs(10000)).toBe(45);
  });
});

describe('§V — bán mạnh trượt sâu (D462): × (1 + 0,1 × phần vượt hệ số lõi); thanh lý thêm ×1,5', () => {
  it('D479 — lõi thường ×1 ⇒ ×1', () => { expect(kBanManh(1, false)).toBe(1); });
  it('×10 ⇒ 1 + 0,1 × 9 = 1,9', () => { expect(kBanManh(10, false)).toBeCloseTo(1.9, 12); });
  it('×10 bị thanh lý ⇒ 1,9 × 1,5 = 2,85', () => { expect(kBanManh(10, true)).toBeCloseTo(2.85, 12); });
});

describe('§VI — trait ĐÒN BẨY chỉ nhân lõi KHÁC (founder 03/10: "có lõi đòn bẩy rồi mà pick trait đòn bẩy thì sẽ chỉ hiện của lõi đòn bẩy")', () => {
  it('D479 — lõi thường không trait ⇒ ×1; trait ×1,5 / ×2 / ×3 ⇒ ×1,5 / ×2 / ×3', () => {
    expect(heLoi('bat_day', 1)).toBe(1);
    expect(heLoi('bat_day', 1.5)).toBe(1.5);
    expect(heLoi('luot_song', 2)).toBe(2);
    expect(heLoi('ca_map', 3)).toBe(3);
  });
  it('lõi Đòn Bẩy cầm trait ×3 ⇒ trait KHÔNG tác dụng (hệ số do mức ×2/×4/×10 của lõi quyết)', () => {
    expect(heLoi('don_bay', 3)).toBe(heLoi('don_bay', 1));
  });
  it('ký quỹ (nạp/cắt): lõi Đòn Bẩy luôn có; lõi khác chỉ khi cầm trait > 1', () => {
    expect(coKyQuy('don_bay', 1)).toBe(true);
    expect(coKyQuy('bat_day', 1)).toBe(false);
    expect(coKyQuy('bat_day', 1.5)).toBe(true);
  });
});
