/**
 * D345 — PHÍ MUA BÁN NHẸ NHƯ NGOÀI ĐỜI, NẶNG THEO CỠ TIỀN (cổng `balance-v50-phinhe`). Vector tay đi trước.
 *
 * Founder 16/09 (sau khi D344 lần đầu kể phí trên tấm VÌ SAO): *"Phí nặng quá, phân chia theo role đi
 * (kiểu ai nhiều tiền lắm mới bị). À mà nhớ là lõi khớp nhanh thì được giảm mạnh nhé. Và ngoài đời
 * cũng đ** bị nặng đến thế"*. Số cũ: ALL-IN 10.000 vào CP Chứng khoán mất 1.020 (trận founder vòng 1).
 */
import { describe, expect, it } from 'vitest';
import { DAC_QUYEN, PHI_LENH_V50 } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';
import { apLenhGiaoDich, heSoVoiVangV50Bp, type GheNav } from '../server/holdem/nav.js';
import { apLenhMocNav, taoTran, type GheMoi } from '../server/holdem/engine.js';

const vi = (von: number): GheNav => ({ von, vi_the: {}, vi_the_khong: {} });
const phi = (von: number, ma: string, tien: number, opts: Parameters<typeof apLenhGiaoDich>[2]) =>
  apLenhGiaoDich(vi(von), [{ ma, tien }], opts).phi_quy;

describe('0. VECTOR TAY', () => {
  it('bảng gốc 0,8% · 0,4% · 0,2%; vội vàng ×(1 + 9 × cỡ/độ sâu 10.000), trần ×30; Khớp Nhanh còn 30%', () => {
    expect(PHI_LENH_V50.TRUOT_GIA_BP).toEqual({ mong: 80, vua: 40, day: 20 });
    expect(heSoVoiVangV50Bp(2500)).toBe(32500);
    expect(heSoVoiVangV50Bp(10000)).toBe(100000);
    expect(heSoVoiVangV50Bp(30000)).toBe(280000);
    expect(heSoVoiVangV50Bp(90000)).toBe(300000);
    expect(DAC_QUYEN.KHOP_NHANH.LENH_CON_BP).toBe(3000);
  });

  it('⭐ cá nhân ALL-IN 10.000 vào CP Chứng khoán: v49 mất 1.020 (số trận founder) · v50 mất 400', () => {
    expect(phi(10000, 'cp_cn', 10000, { voiVang: true })).toBe(1020);
    // floor(10.000 × floor(40 × 100.000 / 10.000) / 10.000) = floor(10.000 × 400 / 10.000) = 400
    expect(phi(10000, 'cp_cn', 10000, { voiVang: true, phiLenhNhe: true })).toBe(400);
    // Crypto (sổ mỏng): floor(80 × 10) = 800bp ⇒ 800 (v49: 2.040)
    expect(phi(10000, 'btc', 10000, { voiVang: true, phiLenhNhe: true })).toBe(800);
    expect(phi(10000, 'btc', 10000, { voiVang: true })).toBe(2040);
    // Lệnh 25% vốn: floor(40 × 32.500/10.000) = 130bp ⇒ floor(2.500 × 130/10.000) = 32 (v49: 75)
    expect(phi(10000, 'cp_cn', 2500, { voiVang: true, phiLenhNhe: true })).toBe(32);
    expect(phi(10000, 'cp_cn', 2500, { voiVang: true })).toBe(75);
  });

  it('⭐ "ai nhiều tiền lắm mới bị": cá mập ALL-IN 30.000 vào Crypto (hệ số vai ×1,5) mất 10.080 = 33,6%', () => {
    // hệ số ×28 ⇒ floor(80 × 280.000/10.000) = 2.240bp ⇒ floor(30.000 × 2.240/10.000) = 6.720 ⇒ ×1,5 = 10.080
    expect(phi(30000, 'btc', 30000, { phiLenhNhe: true, tacDongGia: 1.5, vonQuyChieu: 30000 })).toBe(10080);
    // Cùng ghế, lệnh 10% vốn: cỡ tiền nhỏ ⇒ tỷ lệ phí nhỏ hơn hẳn (không theo vốn riêng của vai).
    const nho = phi(30000, 'btc', 3000, { phiLenhNhe: true, tacDongGia: 1.5, vonQuyChieu: 30000 });
    expect(nho / 3000).toBeLessThan(10080 / 30000);
    // Và cá nhân ALL-IN (10.000) trả tỷ lệ thấp hơn cá mập ALL-IN (30.000) trên cùng mã.
    expect(800 / 10000).toBeLessThan(10080 / 30000);
  });

  it('⭐ Khớp Nhanh: cá nhân ALL-IN CP còn floor(400 × 30%) = 120', () => {
    expect(phi(10000, 'cp_cn', 10000, { phiLenhNhe: true, phiLenhConBp: 3000 })).toBe(120);
  });

  it('bất biến hệ kín vẫn giữ: tiền mặt sau + vị thế + phí = tiền trước', () => {
    const g = vi(10000);
    const r = apLenhGiaoDich(g, [{ ma: 'btc', tien: 6000 }, { ma: 'vang', tien: 4000 }], { phiLenhNhe: true });
    expect(g.von + Object.values(g.vi_the).reduce((a, b) => a + b, 0) + r.phi_quy).toBe(10000);
  });
});

describe('I. qua cửa engine thật', () => {
  const ban = (luat: ReturnType<typeof luatCua>, the: string[]) => taoTran(5, [
    { id: 'a', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: the as never } },
    { id: 'b', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } } as GheMoi,
  ], luat, 8);
  const lenh = [{ ma: 'cp_cn', chieu: 'mua' as const, moc_bp: 10000 }];

  it('v50: ALL-IN CP mất 400; cầm Khớp Nhanh mất 120 · v49 vẫn 1.020 (replay trận cũ)', () => {
    const v50 = luatCua('balance-v50-phinhe');
    expect(apLenhMocNav(ban(v50, []), 'a', lenh).st.phi_giao_dich_vong).toBe(400);
    expect(apLenhMocNav(ban(v50, ['khop_nhanh']), 'a', lenh).st.phi_giao_dich_vong).toBe(120);
    expect(apLenhMocNav(ban(luatCua('balance-v49-bankhong'), []), 'a', lenh).st.phi_giao_dich_vong).toBe(1020);
  });
});
