/**
 * ORACLE LEVEL + BẬC DỰ BÁO + TỰ ĐIỂN THẺ — hàm thuần.
 *
 * Level là CHỈ SỐ DẪN XUẤT: không bảng nào lưu XP, không gì tiêu được. Nên thứ
 * đáng test không phải "XP có cộng đúng vào DB" mà là "ngưỡng và bậc có nói
 * đúng sự thật", vì đó là chỗ dễ bị làm tròn cho đẹp.
 */
import { describe, expect, it } from 'vitest';
import {
  BAC_BRIER, LEVEL_TOI_DA, NGUONG_XEP_BAC, NGUONG_XP, XP,
  bacTuBrier, levelTuXp, tienDoCap,
} from '../config/progression.js';
import { dungTuDien } from '../server/holdem/tu_dien.js';
import { CHIEN_THUAT, TAI_SAN } from '../config/holdem.js';

describe('Level từ XP', () => {
  it('người vừa đăng ký là Level 1, KHÔNG phải 0', () => {
    // Level 0 đọc như "chưa tồn tại". Sàn là 1.
    expect(levelTuXp(0)).toBe(1);
  });

  it('đúng mốc ngưỡng thì lên cấp (mốc BAO GỒM)', () => {
    expect(levelTuXp(NGUONG_XP[1]!)).toBe(2);
    expect(levelTuXp(NGUONG_XP[1]! - 1)).toBe(1);
  });

  it('XP vượt bảng ngưỡng → kẹp ở cấp tối đa, không nổ', () => {
    expect(levelTuXp(999_999)).toBe(LEVEL_TOI_DA);
  });

  it('đơn điệu tăng — không có XP nào làm TỤT cấp', () => {
    let truoc = 0;
    for (let xp = 0; xp <= 16_000; xp += 37) {
      const lv = levelTuXp(xp);
      expect(lv, `tụt cấp ở xp=${xp}`).toBeGreaterThanOrEqual(truoc);
      truoc = lv;
    }
  });
});

describe('Tiến độ trong cấp', () => {
  it('vừa lên cấp → thanh về 0%', () => {
    expect(tienDoCap(NGUONG_XP[2]!).phan_tram).toBe(0);
  });

  it('sát cấp sau → thanh gần đầy nhưng CHƯA 100%', () => {
    const t = tienDoCap(NGUONG_XP[3]! - 1);
    expect(t.phan_tram).toBeGreaterThan(80);
    expect(t.phan_tram).toBeLessThan(100);
  });

  it('cấp tối đa → thanh đầy và không có cấp sau', () => {
    const t = tienDoCap(999_999);
    expect(t.xp_cap_sau).toBeNull();
    expect(t.phan_tram).toBe(100);
  });

  it('phần trăm luôn trong [0,100] trên toàn dải', () => {
    for (let xp = 0; xp <= 20_000; xp += 53) {
      const p = tienDoCap(xp).phan_tram;
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
    }
  });
});

describe('XP — kỷ luật tham số', () => {
  it('THAM GIA luôn được cộng, và ĐÚNG chỉ là phần thêm', () => {
    // Level đo độ dày kinh nghiệm, không đo kỹ năng (kỹ năng đã có Bậc đo riêng).
    // Nếu "đúng" chi phối thì người mới đoán sai vài lần sẽ thấy mình không lên
    // cấp dù vẫn chơi đều — mất đúng động lực mà thang cấp sinh ra để giữ.
    expect(XP.KEO_THAM_GIA).toBeGreaterThan(0);
    expect(XP.KEO_DUNG).toBeLessThan(XP.KEO_THAM_GIA * 3);
  });

  it('mọi giá trị XP là số nguyên dương', () => {
    for (const v of Object.values(XP)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it('ngưỡng tăng dần và bắt đầu từ 0', () => {
    expect(NGUONG_XP[0]).toBe(0);
    for (let i = 1; i < NGUONG_XP.length; i += 1) {
      expect(NGUONG_XP[i]!, `ngưỡng ${i} không tăng`).toBeGreaterThan(NGUONG_XP[i - 1]!);
    }
  });
});

describe('Bậc dự báo từ Brier', () => {
  it('dưới ngưỡng số kèo → "Chưa xếp", kể cả Brier hoàn hảo', () => {
    expect(bacTuBrier(0, NGUONG_XEP_BAC - 1)).toBe('Chưa xếp');
  });

  it('chưa có snapshot nào → "Chưa xếp"', () => {
    expect(bacTuBrier(null, 99)).toBe('Chưa xếp');
  });

  it('Brier 0 (dồn đúng cửa mọi lần) → bậc cao nhất', () => {
    expect(bacTuBrier(0, 10)).toBe('Vàng');
  });

  /*
   * MỐC SO SÁNH LÀ 0,75 chứ không phải 1,0 — với kèo 4 cửa, rải đều 25% mỗi cửa
   * cho Brier = 3×0,0625 + 0,5625 = 0,75. Bậc phải neo quanh đó, nếu không thì
   * "Đồng" lại đang mô tả người chơi tệ hơn cả rải đều mà vẫn nghe như đang ổn.
   */
  it('rải đều 4 cửa (Brier 0,75) → Đồng, KHÔNG phải Bạc', () => {
    expect(bacTuBrier(0.75, 10)).toBe('Đồng');
  });

  it('tệ hơn rải đều rõ rệt → Chì', () => {
    expect(bacTuBrier(1.2, 10)).toBe('Chì');
  });

  it('Brier tối đa 2 (dồn hết vào cửa sai) không nổ', () => {
    expect(bacTuBrier(2, 10)).toBe('Chì');
  });

  it('thang bậc xếp đúng thứ tự tốt → xấu', () => {
    for (let i = 1; i < BAC_BRIER.length; i += 1) {
      expect(BAC_BRIER[i]!.toi_da).toBeGreaterThan(BAC_BRIER[i - 1]!.toi_da);
    }
  });

  it('đơn điệu: Brier càng cao thì bậc không bao giờ TỐT hơn', () => {
    const thuHang = ['Vàng', 'Bạc', 'Đồng', 'Chì'];
    let truoc = -1;
    for (let b = 0; b <= 2; b += 0.05) {
      const i = thuHang.indexOf(bacTuBrier(b, 10) as string);
      expect(i, `bậc tốt lên ở Brier ${b.toFixed(2)}`).toBeGreaterThanOrEqual(truoc);
      truoc = i;
    }
  });
});

describe('Tự điển thẻ — nội dung nút (!)', () => {
  const td = dungTuDien(TAI_SAN, CHIEN_THUAT.map((c) => c.id));

  it('phủ ĐỦ mọi tài sản và mọi chiến thuật trong catalog', () => {
    for (const t of TAI_SAN) expect(td.tai_san[t.id], `thiếu ${t.id}`).toBeTruthy();
    for (const c of CHIEN_THUAT) expect(td.chien_thuat[c.id], `thiếu ${c.id}`).toBeTruthy();
  });

  it('mỗi tài sản có phản ứng theo giai đoạn — không lá nào trống trơn', () => {
    for (const t of TAI_SAN) {
      expect(td.tai_san[t.id]!.giai_doan.length, `${t.id} không phản ứng giai đoạn nào`)
        .toBeGreaterThan(0);
    }
  });

  /*
   * 🔴 KHÔNG PHÁT CON SỐ RA CLIENT — founder bác cách cũ 25/07: hiện +/- % chính
   * xác làm game "dễ đoán và nhanh chán". Cắt ở TẦNG SERVER chứ không ở tầng
   * render, vì bp lọt vào payload thì F12 vẫn có bảng tra.
   */
  it('🔴 payload chỉ có MỨC định tính, KHÔNG có bp nào', () => {
    const HOP_LE = ['rat_tot', 'tot', 'trung_tinh', 'xau', 'rat_xau'];
    for (const t of TAI_SAN) {
      for (const [, muc] of td.tai_san[t.id]!.giai_doan) {
        expect(HOP_LE, `mức lạ: ${muc}`).toContain(muc);
      }
      for (const [, muc] of td.tai_san[t.id]!.su_kien) {
        expect(HOP_LE).toContain(muc);
      }
    }
    // Quét thô cả payload: không một khoá nào tên *_bp, không số lớn nào lọt ra.
    const raw = JSON.stringify(td);
    expect(raw).not.toMatch(/_bp/);
    expect(raw, 'có con số ≥100 lọt ra — nghi là bp').not.toMatch(/:\s*-?\d{3,}/);
  });

  it('thứ tự vẫn mạnh→yếu dù đã bỏ số', () => {
    const HANG = ['rat_tot', 'tot', 'trung_tinh', 'xau', 'rat_xau'];
    for (const t of TAI_SAN) {
      const g = td.tai_san[t.id]!.giai_doan;
      for (let i = 1; i < g.length; i += 1) {
        expect(HANG.indexOf(g[i]![1])).toBeGreaterThanOrEqual(HANG.indexOf(g[i - 1]![1]));
      }
    }
  });

  it('mỗi tài sản có mô tả khái quát — nút (!) không được trống', () => {
    for (const t of TAI_SAN) {
      expect(td.tai_san[t.id]!.mo_ta.length, `${t.id} thiếu mô tả`).toBeGreaterThan(20);
    }
  });

  /*
   * KHÔNG LỘ THÔNG TIN ẨN. Tự điển là LUẬT CHƠI (BTC ăn đòn ở giai đoạn Giảm) —
   * thứ app muốn dạy. Thông tin ẩn là lá kế tiếp và tin nào là tin bịa; hai thứ
   * đó không được có ở đây.
   */
  it('🔴 không rò cờ tin giả hay lá kế tiếp', () => {
    const raw = JSON.stringify(td);
    expect(raw).not.toContain('la_tin_gia');
    expect(raw).not.toContain('tin_gia');
    expect(raw).not.toContain('bao_truoc');
  });

  it('thẻ có cơ chế riêng thì tự điển nói ra được', () => {
    expect(td.chien_thuat.don_bay!.nhan_doi).toBe(true);
    expect(td.chien_thuat.bat_day!.canh_nhip).toBeTruthy();
    expect(td.chien_thuat.chan_lo!.phong_thu).toBeTruthy();
    expect(td.chien_thuat.da_dang_hoa!.da_dang).toBe(true);
    expect(td.chien_thuat.ban_khong!.su_kien!.length).toBeGreaterThan(0);
  });

  /*
   * Người chơi cần biết HÌNH DẠNG rủi ro để quyết (bắt trượt đau hơn bắt trúng),
   * nhưng không cần con số. Server so sánh rồi phát ra kết luận.
   */
  it('canh nhịp nói rõ "trượt nặng hơn" mà không phát con số', () => {
    const cn = td.chien_thuat.bat_day!.canh_nhip!;
    expect(cn.truot_nang_hon).toBe(true);
    expect(Object.keys(cn).sort()).toEqual(['sau_giai_doan', 'trung_khi', 'truot_nang_hon']);
  });

  it('xung đột/cộng hưởng đối xứng — A đụng B thì B cũng đụng A', () => {
    for (const [id, ct] of Object.entries(td.chien_thuat)) {
      for (const doi of ct.xung_dot) {
        expect(td.chien_thuat[doi]!.xung_dot, `${id}↔${doi} lệch`).toContain(id);
      }
      for (const doi of ct.cong_huong) {
        expect(td.chien_thuat[doi]!.cong_huong, `${id}↔${doi} lệch`).toContain(id);
      }
    }
  });
});
