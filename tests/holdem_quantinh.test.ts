/**
 * D43 BƯỚC 3 — QUÁN TÍNH TỪNG HÀNG (v12). Gate 7.5 nằm trong file này:
 * autocorrelation chuỗi pha phải TĂNG RÕ so engine không quán tính — "không
 * tăng ⇒ cấu trúc chưa ăn thua, DỪNG, đừng chồng thêm tầng" (03 §7.5).
 */
import { describe, expect, it } from 'vitest';
import { QUAN_TINH, luatCua } from '../config/holdem.js';
import { sinhMap } from '../server/holdem/map.js';

/** Lag-1 autocorrelation của dãy HƯỚNG các ô pha (sự kiện bỏ qua). */
function autocorr(quanTinh: boolean, soSeed: number): number {
  const HUONG = { tang: 1, phuc_hoi: 1, giam: -1, di_ngang: 0, bien_dong: 0 } as const;
  const x: number[] = [];
  const y: number[] = [];
  for (let seed = 1; seed <= soSeed; seed += 1) {
    const day = sinhMap(seed, 12, { quanTinh }).o
      .filter((o) => o.kind === 'giai_doan')
      .map((o) => (o.kind === 'giai_doan' ? HUONG[o.giai_doan] : 0));
    for (let i = 0; i + 1 < day.length; i += 1) {
      x.push(day[i]!);
      y.push(day[i + 1]!);
    }
  }
  const mx = x.reduce((a, b) => a + b, 0) / x.length;
  const my = y.reduce((a, b) => a + b, 0) / y.length;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < x.length; i += 1) {
    cov += (x[i]! - mx) * (y[i]! - my);
    vx += (x[i]! - mx) ** 2;
    vy += (y[i]! - my) ** 2;
  }
  return cov / Math.sqrt(vx * vy);
}

describe('gate 7.5 — quán tính phải CÓ THẬT', () => {
  it('autocorrelation v12 cao hơn engine cũ rõ rệt (≥ +0,10)', () => {
    const cu = autocorr(false, 800);
    const moi = autocorr(true, 800);
    expect(moi - cu).toBeGreaterThanOrEqual(0.10);
    // Và không phải "xu hướng nuốt cả map": vẫn dưới trần lỏng.
    expect(moi).toBeLessThan(0.75);
  });
});

describe('luật hàng Giảm — đáy cần thời gian', () => {
  it('không Phục hồi nào mọc ngay sau MỘT ô Giảm lẻ', () => {
    for (let seed = 1; seed <= 400; seed += 1) {
      const m = sinhMap(seed, 12, { quanTinh: true });
      for (let i = 1; i < m.o.length; i += 1) {
        if (m.o[i]!.kind !== 'giai_doan') continue;
        if ((m.o[i] as { giai_doan: string }).giai_doan !== 'phuc_hoi') continue;
        // Ô pha gần nhất trước i (sự kiện đóng băng run, bỏ qua).
        let j = i - 1;
        while (j >= 0 && m.o[j]!.kind !== 'giai_doan') j -= 1;
        if (j < 0) continue;
        const truoc = m.o[j] as { giai_doan: string };
        if (truoc.giai_doan === 'giam') {
          expect(m.trang_thai![j]!.run_dai,
            `seed=${seed} ô=${i}: phục hồi sau giảm lẻ`)
            .toBeGreaterThanOrEqual(QUAN_TINH.PHUC_HOI_SAU_GIAM_O);
        }
      }
    }
  });

  it('tắt cờ → phân phối cũ (gate 7.1 đã khoá byte-hệt); v12 bật đủ cả cụm', () => {
    const v12 = luatCua('balance-v12-quantinh');
    expect(v12.quanTinh).toBe(true);
    expect(v12.lichChinhSach).toBe(true);
    expect(v12.nav).toBe(true);
    expect(luatCua('balance-v11-lich').quanTinh).toBe(false);
    const a = sinhMap(99, 12, { quanTinh: true });
    const b = sinhMap(99, 12, { quanTinh: true });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
