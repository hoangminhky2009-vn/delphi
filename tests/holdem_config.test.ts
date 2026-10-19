/**
 * GHIM THAM SỐ KINH TẾ HOLD'EM.
 *
 * File này tồn tại vì `config/holdem.ts` có cửa `doThamSo` cho phép Monte Carlo
 * ghi đè tham số qua biến môi trường. Cửa đó tăng tốc dò cân bằng rất nhiều,
 * nhưng nếu nó rò ra production thì kinh tế trận đổi mà KHÔNG ai thấy —
 * đúng loại lỗi im lặng tệ nhất (A4: "nguồn chân lý duy nhất").
 *
 * Nên hai vế phải luôn đúng:
 *   1. Không có HOLDEM_SWEEP=1 → env bị PHỚT LỜ hoàn toàn.
 *   2. Mọi giá trị mặc định bị ghim cứng ở đây. Đổi hằng số mà không sửa test
 *      này = đỏ build, buộc phải cố ý.
 */
import { describe, expect, it } from 'vitest';
import { doThamSo, NHA_CAI } from '../config/holdem.js';

describe('Tham số nhà cái — ghim cứng, đổi phải cố ý', () => {
  it('giá trị mặc định đúng như đã chốt', () => {
    expect(NHA_CAI.TY_LE_TIN_GIA_BP).toBe(3500);
    expect(NHA_CAI.SUC_MANH_TELEGRAPH_BP).toBe(6000);
    expect(NHA_CAI.SO_VONG_ECHO).toBe(3);
    expect(NHA_CAI.SUY_GIAM_ECHO_BP).toBe(5000);
  });

  it('KHÔNG có HOLDEM_SWEEP=1 thì env bị phớt lờ hoàn toàn', () => {
    const cu = { ...process.env };
    try {
      delete process.env.HOLDEM_SWEEP;
      process.env.HOLDEM_SUC_MANH_TELEGRAPH_BP = '99999';
      expect(doThamSo('SUC_MANH_TELEGRAPH_BP', 6000)).toBe(6000);
    } finally {
      process.env = cu;
    }
  });

  it('CÓ HOLDEM_SWEEP=1 thì mới đọc env', () => {
    const cu = { ...process.env };
    try {
      process.env.HOLDEM_SWEEP = '1';
      process.env.HOLDEM_SUC_MANH_TELEGRAPH_BP = '12000';
      expect(doThamSo('SUC_MANH_TELEGRAPH_BP', 6000)).toBe(12000);
    } finally {
      process.env = cu;
    }
  });

  it('env rác → NÉM LỖI, không âm thầm về mặc định', () => {
    const cu = { ...process.env };
    try {
      process.env.HOLDEM_SWEEP = '1';
      process.env.HOLDEM_TY_LE_TIN_GIA_BP = 'ba nghìn';
      expect(() => doThamSo('TY_LE_TIN_GIA_BP', 3500)).toThrow();
    } finally {
      process.env = cu;
    }
  });

  it('thiếu env cụ thể → dùng mặc định, dù cửa đang mở', () => {
    const cu = { ...process.env };
    try {
      process.env.HOLDEM_SWEEP = '1';
      delete process.env.HOLDEM_SO_VONG_ECHO;
      expect(doThamSo('SO_VONG_ECHO', 3)).toBe(3);
    } finally {
      process.env = cu;
    }
  });
});
