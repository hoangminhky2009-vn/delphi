/**
 * CẦM CỐ — property test. Bài này canh đúng MỘT ranh giới, và nó là ranh giới
 * giữa một tiệm cầm đồ và một cái bẫy nợ:
 *
 *   nghĩa vụ của người chơi KHÔNG BAO GIỜ lớn hơn thứ họ đã đưa.
 *
 * Founder đã chốt "không vay nợ, chỉ mất cọc" cho công cụ liều mạng ở đấu giá.
 * Cơ chế này ở trong câu đó, và ba bất biến dưới đây là thứ giữ nó ở trong.
 */
import { describe, it, expect } from 'vitest';
import { CAM_CO, CAM_CO_BP } from '../config/cam_co.js';
import { CHO } from '../config/cho.js';
import { giaSan } from '../server/kinh_te/gia.js';
import {
  demRuiRoBp, dieuKhoanCamCo, loKhiBiBo, soLuotChoVayToiDa, soTChoVay, soTChuocLai,
} from '../server/kinh_te/cam_co.js';

const BAC = Object.keys(CHO.GIA_GOC);

describe('E31 — cầm cố KHÔNG BAO GIỜ tốt hơn bán thẳng (quét toàn miền)', () => {
  it('nhận về luôn THẤP HƠN giá bán thẳng, mọi bậc × tồn kho × hệ số quỹ', () => {
    let soCa = 0;
    let soCaCuaDong = 0;
    for (const bac of BAC) {
      for (let ton = 0; ton <= CHO.HS_TON_KHO_BP.length + 2; ton += 1) {
        for (let quy = 0; quy <= CAM_CO_BP; quy += 137) {
          const san = giaSan(bac, ton, quy);
          const vay = soTChoVay(san);
          soCa += 1;
          if (san === 0n) {
            // Cửa mua vào đóng ⇒ không cầm được. Trạng thái hợp lệ.
            expect(vay).toBe(0n);
            soCaCuaDong += 1;
          } else {
            expect(vay, `${bac} tồn=${ton} quỹ=${quy}: vay ${vay} vs bán ${san}`)
              .toBeLessThan(san);
          }
        }
      }
    }
    expect(soCa).toBeGreaterThan(1_000);
    expect(soCaCuaDong).toBeGreaterThan(0);
  });

  it('⚠ LTV ≥ 100% bị CHẶN NGAY — đó là một cửa bán giá cao hơn cửa bán', () => {
    expect(() => soTChoVay(600n, 10_000)).toThrow(/tốt hơn bán thẳng/);
    expect(() => soTChoVay(600n, 12_000)).toThrow();
    // Và cấu hình đang dùng phải nằm dưới ngưỡng đó.
    expect(CAM_CO.LTV_BP).toBeLessThan(CAM_CO_BP);
  });

  it('bỏ cọc = đã bán với giá `nhanVe`, và giá đó luôn tệ hơn bán thẳng', () => {
    const dk = dieuKhoanCamCo(600n);
    expect(dk.neuBoCoiNhuBanGia).toBe(dk.nhanVe);
    expect(dk.neuBoCoiNhuBanGia).toBeLessThan(600n);
  });
});

describe('E32 — KHÔNG có hình dạng nào để biểu diễn một khoản nợ', () => {
  it('⭐ điều khoản chỉ có bốn số và một hạn — không trường nào là "còn nợ"', () => {
    const dk = dieuKhoanCamCo(600n);
    expect(Object.keys(dk).sort()).toEqual(
      ['chuocLai', 'hanNgay', 'neuBoCoiNhuBanGia', 'nhanVe', 'phiThanhKhoan'].sort(),
    );
    // Không tên trường nào mang nghĩa nợ / quá hạn / phải trả thêm.
    for (const k of Object.keys(dk)) {
      expect(k, `trường ${k} nghe như một khoản nợ`)
        .not.toMatch(/no|dư_no|duno|qua_han|phat|lai_suat/i);
    }
  });

  it('⭐ số phải chuộc KHÔNG nhận tham số thời gian — không có chỗ cho lãi cộng dồn', () => {
    // Nếu ai đó thêm một tham số "số ngày" vào đây thì bài này đỏ ngay: đó
    // chính là bước biến cầm đồ thành bẫy nợ.
    expect(soTChuocLai.length).toBeLessThanOrEqual(2);   // (daVay, phiBp?)
    const a = soTChuocLai(360n);
    for (let i = 0; i < 5; i += 1) expect(soTChuocLai(360n)).toBe(a);
  });

  it('mọi số trong điều khoản đều KHÔNG ÂM — không có đường về số dư âm', () => {
    for (let g = 0n; g <= 2_000n; g += 7n) {
      const dk = dieuKhoanCamCo(g);
      expect(dk.nhanVe).toBeGreaterThanOrEqual(0n);
      expect(dk.chuocLai).toBeGreaterThanOrEqual(0n);
      expect(dk.phiThanhKhoan).toBeGreaterThanOrEqual(0n);
    }
  });
});

describe('E33 — chuộc luôn đắt hơn nhận, và phí KHÔNG BAO GIỜ bằng 0', () => {
  it('∀ khoản vay > 0: chuộc > nhận, chênh lệch ít nhất 1 T', () => {
    for (let v = 1n; v <= 3_000n; v += 1n) {
      const c = soTChuocLai(v);
      expect(c, `vay ${v}`).toBeGreaterThan(v);
      expect(c - v).toBeGreaterThanOrEqual(1n);
    }
  });

  it('⚠ BẪY FLOOR Ở SỐ NHỎ — thanh khoản không được miễn phí', () => {
    // 9 × 10% = 0,9 → floor 0. Nếu để nguyên thì cầm 9 T rồi chuộc 9 T là một
    // vòng lặp hoà vốn, cùng họ với cái bẫy `giaBanRa` ở B6.
    expect((9n * BigInt(CAM_CO.PHI_CHUOC_BP)) / BigInt(CAM_CO_BP)).toBe(0n);
    expect(soTChuocLai(9n)).toBe(10n);
    // Đủ lớn thì phí theo tỷ lệ thắng mức tối thiểu.
    expect(soTChuocLai(1_000n)).toBe(1_100n);
  });

  it('vay 0 thì chuộc 0 — biên, không phải ca lỗi', () => {
    expect(soTChuocLai(0n)).toBe(0n);
  });

  it('cầm rồi chuộc rồi cầm lại luôn LỖ dần — không có vòng lặp sinh lời', () => {
    let vi = 10_000n;
    const gia = 600n;
    for (let i = 0; i < 20; i += 1) {
      const dk = dieuKhoanCamCo(gia);
      vi = vi + dk.nhanVe - dk.chuocLai;    // cầm rồi chuộc ngay
    }
    expect(vi).toBeLessThan(10_000n);
  });
});

describe('Haircut là tấm đệm rủi ro — nội dung dạy được, không phải lỗi', () => {
  it('LTV 6.000 bp ⇒ giá rơi tới 40% Hệ thống vẫn hoà', () => {
    expect(demRuiRoBp(6_000)).toBe(4_000);
    expect(demRuiRoBp(CAM_CO.LTV_BP)).toBe(CAM_CO_BP - CAM_CO.LTV_BP);
  });

  it('rơi trong đệm ⇒ không lỗ; rơi sâu hơn đệm ⇒ lỗ đúng phần vượt', () => {
    const vay = soTChoVay(600n);          // 360 ở LTV 6.000
    expect(vay).toBe(360n);
    expect(loKhiBiBo(vay, 600n)).toBe(0n);   // giá không đổi
    expect(loKhiBiBo(vay, 360n)).toBe(0n);   // rơi đúng 40% — vừa chạm đáy đệm
    expect(loKhiBiBo(vay, 300n)).toBe(60n);  // rơi sâu hơn ⇒ lỗ đúng phần vượt
    expect(loKhiBiBo(vay, 0n)).toBe(360n);   // vật thành vô giá ⇒ mất trọn khoản vay
  });
});

describe('Không có dự trữ phân đoạn — cho vay từ tiền ĐÃ CÓ (A3.4)', () => {
  it('số lượt cho vay bị chặn cứng bởi số dư quỹ', () => {
    expect(soLuotChoVayToiDa(20_000n, 360n)).toBe(55);
    expect(soLuotChoVayToiDa(0n, 360n)).toBe(0);
  });

  it('mỗi lượt bằng 0 ⇒ `null` = vô nghiệm, KHÔNG phải "vô hạn" (A11.2)', () => {
    expect(soLuotChoVayToiDa(20_000n, 0n)).toBeNull();
  });

  it('từ chối đầu vào vô nghĩa', () => {
    expect(() => soTChoVay(-1n)).toThrow();
    expect(() => soTChuocLai(-1n)).toThrow();
    expect(() => loKhiBiBo(-1n, 0n)).toThrow();
    expect(() => soLuotChoVayToiDa(-1n, 1n)).toThrow();
    expect(() => demRuiRoBp(10_001)).toThrow();
  });
});
