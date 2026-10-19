/**
 * v29 — PHÍ VỘI VÀNG phi tuyến theo cỡ lệnh (04 §4.6–4.7; cổng `phiVoiVang`).
 *
 * Trượt giá trước v29 TUYẾN TÍNH thuần ⇒ cỡ vị thế không có đánh đổi — gốc đo
 * được của G1 (Tất tay 60%, founder xác nhận tay). v29 nhân trượt với hệ số
 * luỹ tiến theo cỡ lệnh so vốn khởi điểm, kẹp trần. Số chốt bằng dò 5 nấc +
 * gate 12.000 trận (xem docstring `NAV_V10.VOI_VANG`).
 *
 * ⚠⚠ BÀI ĐẮT NHẤT: CỜ TẮT = TỪNG CHIP CŨ. `apLenhGiaoDich` là số học tiền của
 * MỌI trận đã lưu — lệch một chip là replay dựng ra một trận chưa từng xảy ra.
 */
import { describe, expect, it } from 'vitest';
import {
  apLenhGiaoDich, heSoVoiVangBp, type GheNav,
} from '../server/holdem/nav.js';
import { HOLDEM_MATCH, NAV_V10, luatCua } from '../config/holdem.js';

const ghe = (von: number, viThe: Record<string, number> = {}): GheNav =>
  ({ von, vi_the: { ...viThe }, vi_the_khong: {} });

describe('I. Hệ số vội vàng — thuần, số nguyên, kẹp trần', () => {
  it('luỹ tiến theo cỡ: lệnh nhỏ gần ×1, lệnh bằng cả vốn khởi điểm ăn trần', () => {
    const { DOC_BP, TRAN_BP } = NAV_V10.VOI_VANG;
    expect(heSoVoiVangBp(100))
      .toBe(10000 + Math.floor((100 * DOC_BP) / HOLDEM_MATCH.START_VON));
    expect(heSoVoiVangBp(100)).toBeLessThan(13000);
    // Đơn điệu tăng — không có cỡ nào rẻ hơn cỡ nhỏ hơn nó.
    expect(heSoVoiVangBp(2500)).toBeGreaterThan(heSoVoiVangBp(500));
    expect(heSoVoiVangBp(10000)).toBeGreaterThanOrEqual(heSoVoiVangBp(2500));
    // Kẹp trần: to mấy cũng không vượt.
    expect(heSoVoiVangBp(10 * HOLDEM_MATCH.START_VON)).toBe(TRAN_BP);
    // Bán dùng trị tuyệt đối — cỡ là cỡ, không có chiều rẻ hơn.
    expect(heSoVoiVangBp(-5000)).toBe(heSoVoiVangBp(5000));
  });

  it('bảng luật: v29 = trọn v28 + phiVoiVang; mọi bản cũ tắt', () => {
    const v29 = luatCua('balance-v29-voivang');
    const v28 = luatCua('balance-v28-goc');
    expect(v29.phiVoiVang).toBe(true);
    expect(v28.phiVoiVang).toBe(false);
    expect(luatCua('balance-v27-bongbong').phiVoiVang).toBe(false);
    const { phiVoiVang: _a, ...conLai29 } = v29;
    const { phiVoiVang: _b, ...conLai28 } = v28;
    expect(conLai29).toEqual(conLai28);
  });
});

describe('II. ⭐ CỔNG REPLAY — cờ tắt thì từng chip như cũ', () => {
  it('voiVang tắt (hoặc vắng): trượt đúng công thức tuyến tính cũ', () => {
    for (const opts of [undefined, { voiVang: false }] as const) {
      const g = ghe(10000);
      const r = apLenhGiaoDich(g, [{ ma: 'btc', tien: 10000 }], opts);
      expect(r.loi).toBeNull();
      // btc hạng "mỏng" 120bp: trượt cũ = floor(10000×120/10000) = 120, không hơn.
      expect(r.phi_quy).toBe(120);
      expect(g.vi_the.btc).toBe(9880);
    }
  });

  it('voiVang bật: trượt = gốc × hệ số cỡ, đúng từng chip theo công thức', () => {
    const g = ghe(10000);
    const r = apLenhGiaoDich(g, [{ ma: 'btc', tien: 10000 }], { voiVang: true });
    expect(r.loi).toBeNull();
    const heSo = heSoVoiVangBp(10000);
    const mong = Math.floor((10000 * Math.floor((120 * heSo) / 10000)) / 10000);
    expect(r.phi_quy).toBe(mong);
    expect(r.phi_quy, 'phi tuyến mà không đắt hơn tuyến tính = cần gạt chết')
      .toBeGreaterThan(120);
  });
});

describe('III. Đánh đổi cỡ vị thế — điều v29 sinh ra để tạo', () => {
  it('⭐ RA DẦN rẻ hơn BÁN THÁO: 4 lệnh 2.500 trả ít phí hơn hẳn 1 lệnh 10.000', () => {
    const mot = apLenhGiaoDich(ghe(10000), [{ ma: 'btc', tien: 10000 }], { voiVang: true });
    const bon = ghe(10000);
    let phiBon = 0;
    for (let i = 0; i < 4; i += 1) {
      const r = apLenhGiaoDich(bon, [{ ma: 'btc', tien: 2500 }], { voiVang: true });
      expect(r.loi).toBeNull();
      phiBon += r.phi_quy;
    }
    expect(phiBon, 'chia nhỏ không rẻ hơn = không còn gì để giỏi')
      .toBeLessThan(mot.phi_quy * 0.5);
  });

  it('phí là ĐÁNH ĐỔI chứ không phải tường: all-in vẫn đi được, chỉ đắt', () => {
    const g = ghe(10000);
    const r = apLenhGiaoDich(g, [{ ma: 'vang', tien: 10000 }], { voiVang: true });
    expect(r.loi).toBeNull();
    expect(g.von).toBe(0);
    // Vị thế nhận được vẫn là phần lớn số tiền — phí nặng nhưng không nuốt lệnh.
    expect(g.vi_the.vang).toBeGreaterThan(6000);
  });
});
