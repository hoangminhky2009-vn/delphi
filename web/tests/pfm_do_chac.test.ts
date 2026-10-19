/**
 * PFM — ĐỘ CHẮC (D354): "tỷ lệ thật có vượt mốc không", tính từ vài quan sát.
 *
 *   §I   VECTOR CHÉP TAY — hàm beta chính quy so với ĐUÔI NHỊ THỨC đếm bằng tay.
 *   §II  `xacSuatVuotMoc` — đúng các ca đã làm thẻ Oracle báo nhầm (D353).
 *   §III BIÊN — đầu vào hỏng thì ném, mốc sát 0/1 thì không nổ.
 *
 * ⚠ Vì sao vector lấy từ nhị thức: với a, b NGUYÊN thì I_x(a,b) = P(Bin(a+b−1, x) ≥ a) — một
 * tổng hữu hạn cộng tay được, không cần tin thư viện nào. Ca a < 1 dùng công thức arcsin.
 */
import { describe, expect, it } from 'vitest';
import { betaChinhQuy, xacSuatVuotMoc } from '../src/pfm/do_chac.js';

describe('§I — beta chính quy: vector chép tay', () => {
  it('I_x(1,1) = x (phân bố đều)', () => {
    for (const x of [0.1, 0.37, 0.5, 0.9]) expect(betaChinhQuy(x, 1, 1)).toBeCloseTo(x, 12);
  });

  it('a, b nguyên ⇒ bằng đuôi nhị thức cộng tay', () => {
    // I_0,5(5,2) = P(Bin(6; 0,5) ≥ 5) = (C(6,5) + C(6,6)) / 64 = 7/64
    expect(betaChinhQuy(0.5, 5, 2)).toBeCloseTo(7 / 64, 12);
    // I_0,5(6,2) = P(Bin(7; 0,5) ≥ 6) = (7 + 1) / 128 = 8/128
    expect(betaChinhQuy(0.5, 6, 2)).toBeCloseTo(8 / 128, 12);
    // I_0,5(7,3) = P(Bin(9; 0,5) ≥ 7) = (36 + 9 + 1) / 512 = 46/512
    expect(betaChinhQuy(0.5, 7, 3)).toBeCloseTo(46 / 512, 12);
    // I_0,3(2,5) = P(Bin(6; 0,3) ≥ 2) = 1 − 0,7⁶ − 6·0,3·0,7⁵ = 1 − 0,117649 − 0,302526
    expect(betaChinhQuy(0.3, 2, 5)).toBeCloseTo(0.579825, 10);
  });

  it('a < 1: I_x(½,½) = (2/π)·arcsin(√x) ⇒ x = 0,25 ra đúng 1/3', () => {
    expect(betaChinhQuy(0.25, 0.5, 0.5)).toBeCloseTo(1 / 3, 10);
  });

  it('đối xứng I_x(a,b) = 1 − I_{1−x}(b,a), và hai đầu mút', () => {
    expect(betaChinhQuy(0.3, 2.2, 4.8) + betaChinhQuy(0.7, 4.8, 2.2)).toBeCloseTo(1, 12);
    expect(betaChinhQuy(0, 3, 4)).toBe(0);
    expect(betaChinhQuy(1, 3, 4)).toBe(1);
  });
});

describe('§II — xacSuatVuotMoc: tiên nghiệm đặt TẠI mốc, nặng bằng k quan sát', () => {
  it('⭐ 3/3 với mốc 0,5 và k = 4 ⇒ hậu nghiệm Beta(5,2) ⇒ 1 − 7/64', () => {
    // tiên nghiệm Beta(k·mốc, k·(1−mốc)) = Beta(2,2); cộng 3 lần vượt, 0 lần không ⇒ Beta(5,2)
    expect(xacSuatVuotMoc(3, 3, 0.5, 4)).toBeCloseTo(1 - 7 / 64, 12);   // 0,890625
  });

  it('⭐ 4/4 ⇒ Beta(6,2) ⇒ 1 − 8/128 · 5/6 ⇒ Beta(7,3) ⇒ 1 − 46/512', () => {
    expect(xacSuatVuotMoc(4, 4, 0.5, 4)).toBeCloseTo(1 - 8 / 128, 12);   // 0,9375
    expect(xacSuatVuotMoc(5, 6, 0.5, 4)).toBeCloseTo(1 - 46 / 512, 12);  // 0,91015625
  });

  it('⭐⭐ CA BÁO NHẦM CỦA D353: 2/3 trên mốc 0,5 KHÔNG được coi là chắc', () => {
    // Beta(4,3): I_0,5(4,3) = P(Bin(6; 0,5) ≥ 4) = (15 + 6 + 1)/64 = 22/64 ⇒ 1 − 22/64 = 0,65625
    expect(xacSuatVuotMoc(2, 3, 0.5, 4)).toBeCloseTo(1 - 22 / 64, 12);
  });

  it('đúng bằng mốc ⇒ quanh ½; nhiều quan sát hơn ⇒ chắc hơn (đơn điệu theo n khi tỷ lệ giữ nguyên)', () => {
    expect(xacSuatVuotMoc(2, 4, 0.5, 4)).toBeCloseTo(0.5, 12);           // Beta(4,4) đối xứng
    const it = xacSuatVuotMoc(4, 5, 0.5, 4);
    const nhieu = xacSuatVuotMoc(16, 20, 0.5, 4);
    expect(nhieu).toBeGreaterThan(it);
  });

  it('k lớn hơn ⇒ khó thuyết phục hơn với cùng dữ liệu', () => {
    expect(xacSuatVuotMoc(4, 4, 0.5, 8)).toBeLessThan(xacSuatVuotMoc(4, 4, 0.5, 4));
  });
});

describe('§III — biên', () => {
  it('đầu vào hỏng thì NÉM — im lặng trả một con số ở đây là thẻ bắn sai mà không ai biết', () => {
    expect(() => xacSuatVuotMoc(4, 3, 0.5, 4)).toThrow();     // số lần > số quan sát
    expect(() => xacSuatVuotMoc(-1, 3, 0.5, 4)).toThrow();
    expect(() => xacSuatVuotMoc(1, 3, 0.5, 0)).toThrow();     // k phải dương
    expect(() => xacSuatVuotMoc(1.5, 3, 0.5, 4)).toThrow();   // đếm thì phải nguyên
    expect(() => xacSuatVuotMoc(1, 3, Number.NaN, 4)).toThrow();
  });

  it('mốc 0 hoặc 1 (sổ mọi ngày bằng nhau) ⇒ kẹp vào trong, ra số hữu hạn trong [0,1]', () => {
    for (const moc of [0, 1]) {
      const p = xacSuatVuotMoc(0, 3, moc, 4);
      expect(Number.isFinite(p)).toBe(true);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    // mốc 0 mà không lần nào vượt ⇒ không có gì để nói
    expect(xacSuatVuotMoc(0, 3, 0, 4)).toBeLessThan(0.5);
  });
});
