/**
 * D1 — ĐÓNG BỮA TRƯA MIỄN PHÍ. Bốn cơ chế, và MỘT phát hiện đo được.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PHÁT HIỆN (25/07, ghi lại để mùa sau không đoán lại từ đầu):
 *
 * Bot "Bắt đáy" chạy trốn khỏi cả nhóm (30–32%, cách á quân ~9) KHÔNG phải nhờ
 * lá `bat_day`. Đã sweep lá đó bốn mức — số gần như không nhúc nhích. Cũng không
 * chủ yếu nhờ khiên `chia_lenh` (hạ khiên từ 50% xuống 10% chỉ đưa 31,8 → 31,2).
 *
 * Nó thắng vì cầm `cp_cn` + `vn30` — HAI MÃ SỔ LỆNH SÂU NHẤT — nên né sạch trượt
 * giá do đông, tức chi phí hệ thống DUY NHẤT của trận, mà không trả gì cho sự an
 * toàn đó. Lever đúng là ĐỊNH GIÁ THANH KHOẢN, và nó đưa G1 từ ✗ (cách 8,7) về
 * ✓ (cách 0,7) đồng thời nén cả bảng lại — "chen chúc" theo D21 là khoẻ.
 *
 * Bài học phương pháp: sweep đúng knob chỉ bắt đầu SAU KHI đếm cơ chế. Ba lần
 * đoán theo TÊN bot là ba lần đo sai biến.
 */
import { describe, expect, it } from 'vitest';
import {
  GIA_CUA_THANH_KHOAN_BP, MT_SU_KIEN_KE_TIEP, PHI_CO_HOI_KEP,
  THANH_KHOAN_DONG, TRUYEN_NHAN_QUA,
} from '../config/holdem.js';

describe('1. GIÁ CỦA THANH KHOẢN — an toàn phải trả phí', () => {
  it('sổ mỏng được phần bù, sổ dày trả phí, sổ vừa trung tính', () => {
    expect(GIA_CUA_THANH_KHOAN_BP.mong).toBeGreaterThan(0);
    expect(GIA_CUA_THANH_KHOAN_BP.day).toBeLessThan(0);
    expect(GIA_CUA_THANH_KHOAN_BP.vua).toBe(0);
  });

  /*
   * ĐỐI XỨNG là cố ý: nếu phần bù mỏng lớn hơn phí dày thì cả bảng được cộng
   * thêm kỳ vọng dương, tức là bơm lạm phát vào PnL toàn trận. D20 đã dính đúng
   * bệnh ngược lại — cú đạp cổ phiếu quá nặng kéo kỳ vọng CẢ THỊ TRƯỜNG về âm
   * làm "ai cầm ít nhất thì thắng".
   */
  it('đối xứng — không bơm/hút kỳ vọng của cả thị trường', () => {
    expect(GIA_CUA_THANH_KHOAN_BP.mong + GIA_CUA_THANH_KHOAN_BP.day).toBe(0);
  });

  it('mọi giá trị là số nguyên bp (C5)', () => {
    for (const v of Object.values(GIA_CUA_THANH_KHOAN_BP)) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('2. THANH KHOẢN ĐỘNG — khủng hoảng làm sổ lệnh mỏng đi', () => {
  it('có cửa TẮT để đo đóng góp riêng (dụng cụ đo, không phải cờ tạm)', () => {
    // Thiếu cửa này đã tốn bốn lần sweep sai biến hôm 25/07.
    expect(THANH_KHOAN_DONG.BAT).toBe(1);
  });

  it('biến động + thiên nga + chiến tranh làm mỏng; bong bóng làm dày risk-on', () => {
    expect(THANH_KHOAN_DONG.MONG_DI_GIAI_DOAN).toContain('bien_dong');
    expect(THANH_KHOAN_DONG.MONG_DI_SU_KIEN).toContain('thien_nga_den');
    expect(THANH_KHOAN_DONG.MONG_DI_SU_KIEN).toContain('chien_tranh');
    expect(THANH_KHOAN_DONG.DAY_THEM_SU_KIEN).toContain('bong_bong');
  });

  it('nhánh dày thêm CHỈ cho risk-on — trú ẩn không được hưởng', () => {
    expect(THANH_KHOAN_DONG.MA_RISK_ON).toEqual(['btc', 'cp_cn']);
    for (const ma of ['vang', 'usd', 'tpcp']) {
      expect(THANH_KHOAN_DONG.MA_RISK_ON).not.toContain(ma);
    }
  });
});

describe('3. TRUYỀN NHÂN QUẢ F0 → F1 → F2', () => {
  it('F1 mạnh hơn F2, và cả hai đều yếu hơn F0', () => {
    expect(TRUYEN_NHAN_QUA.F1_BP).toBeLessThan(10000);
    expect(TRUYEN_NHAN_QUA.F2_BP).toBeLessThan(TRUYEN_NHAN_QUA.F1_BP);
  });

  /*
   * NGƯỠNG XỊT là thứ giữ cho cơ chế này không thành nhiễu: không có nó thì mỗi
   * tin toả ra cả cây hệ quả và mọi vòng đều có mọi thứ tác động một chút.
   */
  it('ngưỡng xịt chặn được đời sâu — echo cũ không toả vô hạn', () => {
    expect(TRUYEN_NHAN_QUA.NGUONG_XIT_BP).toBeGreaterThan(0);
    // Echo đã suy giảm 2 vòng (còn 25%) thì nhánh F2 của nó phải bị chặn.
    const echoCu = 2500; // 10000 × 50% × 50%
    const f2 = Math.floor((echoCu * TRUYEN_NHAN_QUA.F2_BP) / 10000);
    expect(f2).toBeLessThan(TRUYEN_NHAN_QUA.NGUONG_XIT_BP);
  });

  it('chỉ lấy vài nhánh nặng nhất, không lấy cả cây', () => {
    expect(TRUYEN_NHAN_QUA.SO_NHANH).toBeGreaterThan(0);
    expect(TRUYEN_NHAN_QUA.SO_NHANH).toBeLessThanOrEqual(3);
  });

  it('nhánh suy từ bảng dây chuyền đã có — LUẬT SINH, không domino viết tay', () => {
    // Thêm một quan hệ nhân quả ở MT_SU_KIEN_KE_TIEP là tự có F1/F2 tương ứng.
    // Nếu bảng này rỗng thì cả cơ chế truyền im lặng không làm gì — kiểm cho chắc.
    expect(Object.keys(MT_SU_KIEN_KE_TIEP).length).toBeGreaterThan(0);
    const chienTranh = MT_SU_KIEN_KE_TIEP.chien_tranh as Record<string, number> | undefined;
    expect(chienTranh, 'chiến tranh phải có hệ quả để truyền').toBeTruthy();
    expect(Object.keys(chienTranh!).length).toBeGreaterThan(0);
  });
});

describe('4. PHÍ CƠ HỘI CẶP ĐA DẠNG HÓA + CHẶN LỖ', () => {
  it('ăn trong Giảm/Biến động, mất phí trong Tăng/Phục hồi', () => {
    expect(PHI_CO_HOI_KEP.AN_BP).toBeGreaterThan(0);
    expect(PHI_CO_HOI_KEP.PHI_BP).toBeLessThan(0);
    expect(PHI_CO_HOI_KEP.AN_KHI).toContain('giam');
    expect(PHI_CO_HOI_KEP.AN_KHI).toContain('bien_dong');
    expect(PHI_CO_HOI_KEP.PHI_KHI).toContain('tang');
    expect(PHI_CO_HOI_KEP.PHI_KHI).toContain('phuc_hoi');
  });

  it('hai tập giai đoạn KHÔNG giao nhau — một vòng không thể vừa ăn vừa mất', () => {
    for (const g of PHI_CO_HOI_KEP.AN_KHI) {
      expect(PHI_CO_HOI_KEP.PHI_KHI).not.toContain(g);
    }
  });

  it('triệt biên tăng là PHẦN CÒN LẠI, không phải phần bị lấy', () => {
    // 5000 = còn lại một nửa. Đọc nhầm chiều là triệt 50% thành triệt 5000%.
    expect(PHI_CO_HOI_KEP.TRIET_BIEN_TANG_BP).toBeGreaterThan(0);
    expect(PHI_CO_HOI_KEP.TRIET_BIEN_TANG_BP).toBeLessThanOrEqual(10000);
  });

  it('bong bóng tính là "thị trường đang lên" cho luật này', () => {
    expect(PHI_CO_HOI_KEP.PHI_KHI_SU_KIEN).toContain('bong_bong');
  });
});
