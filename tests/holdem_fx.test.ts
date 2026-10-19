/**
 * TRẠNG THÁI CẢM XÚC CỦA GHẾ — hàm thuần `fxCuaGhe`.
 *
 * D25: mode này miễn phí, thứ duy nhất mất được là danh dự, nên "đối thủ THẤY
 * mình" chính là cái để mất. Muốn vậy thì trạng thái phải suy ở SERVER: cả bàn
 * phải thấy cùng một trạng thái của cùng một ghế, và nó phải LOG được (R1).
 *
 * Test ngưỡng ở đây chứ không ở test API vì đây là hàm thuần — chạy 1ms, và
 * ngưỡng là thứ dễ bị "làm tròn cho đẹp" nhất.
 */
import { describe, expect, it } from 'vitest';
import { FX_GHE, HOLDEM_MATCH, fxCuaGhe } from '../config/holdem.js';

const V = HOLDEM_MATCH.START_VON;
/** Vốn tương ứng x% vốn khởi điểm. */
const pct = (p: number) => Math.floor((V * p) / 100);

describe('fxCuaGhe — ngưỡng', () => {
  it('vốn khởi điểm → bình thường', () => {
    expect(fxCuaGhe(V, false, 'choi', V)).toBe('binh_thuong');
  });

  it('lãi đúng mốc +25% → lai_dam (mốc là BAO GỒM, không phải vượt)', () => {
    expect(fxCuaGhe(pct(125), false, 'choi', V)).toBe('lai_dam');
    expect(fxCuaGhe(pct(124), false, 'choi', V)).toBe('binh_thuong');
  });

  it('lỗ đúng mốc −25% → lo_dam', () => {
    expect(fxCuaGhe(pct(75), false, 'choi', V)).toBe('lo_dam');
    expect(fxCuaGhe(pct(76), false, 'choi', V)).toBe('binh_thuong');
  });

  it('lỗ đúng mốc −50% → nguy_kich (đè lo_dam)', () => {
    expect(fxCuaGhe(pct(50), false, 'choi', V)).toBe('nguy_kich');
    expect(fxCuaGhe(pct(51), false, 'choi', V)).toBe('lo_dam');
  });

  it('vốn 0 → nguy_kich chứ không nổ', () => {
    expect(fxCuaGhe(0, false, 'choi', V)).toBe('nguy_kich');
  });

  /*
   * Thứ tự kiểm là một phần của hợp đồng: cháy/đầu hàng ĐÈ mọi mức vốn. Ghế đã
   * cháy mà còn phát sáng xanh vì vốn ghi nhận cao là mâu thuẫn thị giác trực
   * tiếp — người chơi thấy một ghế vừa "chết" vừa "đang thắng".
   */
  it('đã cháy → chay, kể cả khi vốn còn cao', () => {
    expect(fxCuaGhe(pct(300), true, 'choi', V)).toBe('chay');
  });

  it('đầu hàng → chay (thoát hẳn, thua luôn)', () => {
    expect(fxCuaGhe(pct(300), false, 'dau_hang', V)).toBe('chay');
  });

  it('đứng ngoài KHÔNG phải chay — vốn đóng băng nhưng vẫn được tính hạng', () => {
    expect(fxCuaGhe(V, false, 'dung_ngoai', V)).toBe('binh_thuong');
  });

  it('dồn hết vốn mà còn sống thì vẫn theo mức vốn, không có trạng thái riêng', () => {
    expect(fxCuaGhe(pct(40), false, 'all_in', V)).toBe('nguy_kich');
    expect(fxCuaGhe(pct(200), false, 'all_in', V)).toBe('lai_dam');
  });

  it('tất định — cùng đầu vào ra cùng kết quả', () => {
    for (const p of [0, 10, 50, 51, 75, 100, 125, 300]) {
      expect(fxCuaGhe(pct(p), false, 'choi', V)).toBe(fxCuaGhe(pct(p), false, 'choi', V));
    }
  });
});

describe('FX_GHE — kỷ luật tham số', () => {
  it('ba ngưỡng xếp đúng thứ tự nguy_kich < lo_dam < hoà < lai_dam', () => {
    expect(FX_GHE.NGUY_KICH_BP).toBeLessThan(FX_GHE.LO_DAM_BP);
    expect(FX_GHE.LO_DAM_BP).toBeLessThan(10000);
    expect(FX_GHE.LAI_DAM_BP).toBeGreaterThan(10000);
  });

  it('mọi ngưỡng là SỐ NGUYÊN bp — C5, cấm float trong tham số', () => {
    for (const v of Object.values(FX_GHE)) expect(Number.isInteger(v)).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
 * ⭐⭐ GHẾ CÓ VAI — MẪU SỐ LÀ VỐN CỦA CHÍNH NÓ (D312)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 15 bài trên đều chạy với `startVon = START_VON`, nên KHÔNG bài nào chạm vào
 * ca thật của bàn 12 ô: từ v34 vai phát vốn gấp bội (`ca_map`/`doi_lai` ×3,
 * `to_chuc` ×2). Founder bắt bằng mắt 08/09 — *"chả nhẽ xanh cả trận à?"*.
 */
describe('⭐ ghế có VAI — so với vốn khởi điểm CỦA CHÍNH GHẾ', () => {
  /** Cá mập / đội lái: ×3. Tổ chức: ×2. */
  const V3 = V * 3;

  it('cá mập đứng yên ở vốn khởi điểm ⇒ BÌNH THƯỜNG, không phải xanh cả trận', () => {
    expect(fxCuaGhe(V3, false, 'choi', V3)).toBe('binh_thuong');
    // Bằng chứng đây từng là lỗi: cùng số vốn, nhưng lấy START_VON làm mẫu số.
    expect(fxCuaGhe(V3, false, 'choi', V)).toBe('lai_dam');
  });

  it('⭐ cá mập LỖ NẶNG phải đỏ — trước đây đèn cảnh báo tắt đúng ở người dễ cháy nhất', () => {
    // 30.000 → 12.000 là mất 60% vốn của chính mình.
    expect(fxCuaGhe(Math.floor(V3 * 0.4), false, 'choi', V3)).toBe('nguy_kich');
    // Với mẫu số cũ, cùng ghế ấy ra "bình thường" — không một tín hiệu nào.
    expect(fxCuaGhe(Math.floor(V3 * 0.4), false, 'choi', V)).toBe('binh_thuong');
  });

  it('cá mập lãi thật 25% trên vốn của mình ⇒ xanh', () => {
    expect(fxCuaGhe(Math.floor(V3 * 1.25), false, 'choi', V3)).toBe('lai_dam');
  });

  it('ba vai + cá nhân cùng một mức % ⇒ CÙNG một trạng thái', () => {
    // Đây là phát biểu thật của luật: hiệu ứng nói về % của chính mình, nên
    // vai to hay nhỏ không đổi màu ghế khi thành tích như nhau.
    for (const heSo of [1, 2, 3]) {
      const v0 = V * heSo;
      expect(fxCuaGhe(Math.floor(v0 * 1.25), false, 'choi', v0), `hệ số ${heSo}`).toBe('lai_dam');
      expect(fxCuaGhe(Math.floor(v0 * 0.75), false, 'choi', v0), `hệ số ${heSo}`).toBe('lo_dam');
      expect(fxCuaGhe(Math.floor(v0 * 0.50), false, 'choi', v0), `hệ số ${heSo}`).toBe('nguy_kich');
    }
  });
});
