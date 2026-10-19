/**
 * DẤU MỐC KỸ NĂNG (doc 06 §5.1, thi công 17/08) — hàm THUẦN, vector tay.
 *
 * Canh đúng LẰN RANH §1.2: mốc chỉ nhìn ĐỘ CHUẨN · ĐÚNG HƯỚNG · CẮT ĐÚNG LÚC.
 * KHÔNG có mốc nào thưởng "ôm nhiều mã", "giữ tiền mặt", "all-in" — ba trục đó
 * là thứ app đang ĐO (khẩu vị rủi ro), khen chúng là làm bẩn chính số đo.
 * Và mốc phải HIẾM: một lời khen phát mỗi trận là lời khen không ai đọc.
 */
import { describe, expect, it } from 'vitest';
import { dauMocCuaTran, NGUONG, type VongDauMoc } from '../server/holdem/dau_moc.js';

const v = (
  vong: number, brier: number | null, pnl: number | null, phoi: number | null,
  cho: number | null = pnl,
): VongDauMoc => ({ vong, brier, pnl_bp: pnl, phoi_nhiem_bp: phoi, cho_bp: cho });

describe('dauMocCuaTran', () => {
  it('trận nhạt ⇒ KHÔNG mốc nào (không khen cho có)', () => {
    const vongs = [v(1, 0.9, 10, 3000), v(2, 0.9, -10, 3000), v(3, 0.91, 5, 3000), v(4, 0.9, -5, 3000)];
    expect(dauMocCuaTran(vongs)).toEqual([]);
  });

  it('⭐ ĐỘ CHUẨN LÊN: nửa sau Brier thấp hơn nửa đầu quá ngưỡng', () => {
    const vongs = [v(1, 1.20, 0, 0), v(2, 1.10, 0, 0), v(3, 0.60, 0, 0), v(4, 0.50, 0, 0)];
    const ra = dauMocCuaTran(vongs);
    expect(ra.map((x) => x.id)).toContain('do_chuan_len');
    // (1,15 − 0,55) = 0,60 ⇒ 6000 (×10000)
    expect(ra.find((x) => x.id === 'do_chuan_len')!.so).toBe(6000);
    // Ngay dưới ngưỡng ⇒ không mốc.
    const sat = [v(1, 1.00, 0, 0), v(2, 1.00, 0, 0), v(3, 1.00 - NGUONG.DO_CHUAN_LEN / 2, 0, 0), v(4, 1.00, 0, 0)];
    expect(dauMocCuaTran(sat).map((x) => x.id)).not.toContain('do_chuan_len');
  });

  it('⭐ CHUỖI ĐÚNG HƯỚNG: ≥3 vòng LIỀN có vị thế và lãi; đứng ngoài KHÔNG tính là đúng', () => {
    const vongs = [v(1, null, 0, 0), v(2, 0.5, 300, 4000), v(3, 0.5, 120, 4000), v(4, 0.5, 90, 4000), v(5, 0.5, -10, 4000)];
    const ra = dauMocCuaTran(vongs);
    const m = ra.find((x) => x.id === 'chuoi_dung_huong');
    expect(m).toBeTruthy();
    expect(m!.so).toBe(3);
    expect(m!.vong).toBe(4);
    // ⚠ Lãi mà KHÔNG có vị thế (toàn tiền mặt, lãi do Quỹ vòng) KHÔNG tính:
    // mốc này khen ĐỌC ĐÚNG, không khen đứng ngoài may.
    const ngoai = [v(1, null, 300, 0), v(2, null, 300, 0), v(3, null, 300, 0)];
    expect(dauMocCuaTran(ngoai)).toEqual([]);
    // Đứt chuỗi ⇒ không đủ 3 liền.
    const dut = [v(1, 0.5, 100, 4000), v(2, 0.5, -100, 4000), v(3, 0.5, 100, 4000), v(4, 0.5, 100, 4000)];
    expect(dauMocCuaTran(dut).map((x) => x.id)).not.toContain('chuoi_dung_huong');
  });

  it('⭐⭐ CẮT TRƯỚC CÚ SẬP đo CHỢ, không đo NAV mình — cắt kịp thì NAV mình có sập đâu', () => {
    // Người CẮT KỊP: chợ −900bp, còn NAV mình chỉ −50 (vì đã đứng ngoài).
    const catKip = [v(1, 0.5, 50, 8000, 20), v(2, 0.5, -50, 1000, -900)];
    expect(dauMocCuaTran(catKip).map((x) => x.id)).toContain('cat_truoc_sap');
    // Chợ KHÔNG sập mà NAV mình rơi (mình chọn sai mã) ⇒ KHÔNG mốc.
    const chonSai = [v(1, 0.5, 50, 8000, 20), v(2, 0.5, -900, 1000, 10)];
    expect(dauMocCuaTran(chonSai).map((x) => x.id)).not.toContain('cat_truoc_sap');
  });

  it('⭐ CẮT TRƯỚC CÚ SẬP: hạ phơi nhiễm mạnh rồi vòng sau sập', () => {
    const vongs = [v(1, 0.5, 50, 8000), v(2, 0.5, -900, 1000), v(3, 0.5, 10, 1000)];
    const m = dauMocCuaTran(vongs).find((x) => x.id === 'cat_truoc_sap');
    expect(m).toEqual({ id: 'cat_truoc_sap', vong: 2, so: 900 });
    // Không hạ vị thế mà vẫn sập ⇒ KHÔNG mốc (đó là ăn đòn, không phải cắt kịp).
    const om = [v(1, 0.5, 50, 8000), v(2, 0.5, -900, 8000)];
    expect(dauMocCuaTran(om).map((x) => x.id)).not.toContain('cat_truoc_sap');
    // Hạ vị thế nhưng vòng sau KHÔNG sập ⇒ không mốc (không khen việc đứng ngoài).
    const hut = [v(1, 0.5, 50, 8000), v(2, 0.5, 100, 1000)];
    expect(dauMocCuaTran(hut).map((x) => x.id)).not.toContain('cat_truoc_sap');
  });

  it('CHUẨN NHẤT TỪ TRƯỚC: cần ≥2 trận trước để so; trận đầu không bao giờ có', () => {
    const vongs = [v(1, 0.2, 0, 0), v(2, 0.2, 0, 0)];
    expect(dauMocCuaTran(vongs, []).map((x) => x.id)).not.toContain('chuan_nhat_tu_truoc');
    expect(dauMocCuaTran(vongs, [0.9]).map((x) => x.id)).not.toContain('chuan_nhat_tu_truoc');
    expect(dauMocCuaTran(vongs, [0.9, 0.8]).map((x) => x.id)).toContain('chuan_nhat_tu_truoc');
    // Không tốt hơn mọi trận trước ⇒ im.
    expect(dauMocCuaTran(vongs, [0.9, 0.1]).map((x) => x.id)).not.toContain('chuan_nhat_tu_truoc');
  });

  it('tối đa 2 mốc — màn kết không thành bảng thành tích', () => {
    const vongs = [
      v(1, 1.4, 300, 8000), v(2, 1.3, 300, 8000), v(3, 0.2, 300, 8000),
      v(4, 0.2, -900, 1000), v(5, 0.2, 100, 1000),
    ];
    expect(dauMocCuaTran(vongs, [1.0, 1.0]).length).toBeLessThanOrEqual(2);
  });
});
