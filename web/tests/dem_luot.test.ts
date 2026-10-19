/**
 * ĐẾM LƯỢT GỌI VERCEL — `web/worker/dem.js` (D594). Hai tính chất mà một bộ đếm SAI vẫn "chạy được":
 *   1. KHÔNG gọi sổ (Durable Object) mỗi lượt — gọi mỗi lượt là nhân đôi lượt gọi DO, ăn chung trần với cổng hàng chờ.
 *   2. KHÔNG mất lượt khi xả — tổng các lô xả + phần còn chờ phải bằng đúng số lượt đã ghi.
 */
import { describe, expect, it } from 'vitest';
import { LO_XA, NHIP_XA_MS, boDemMoi, ghiLuot, khoaThang } from '../worker/dem.js';

describe('dem.js — đếm theo lô', () => {
  it('⭐ 1.000 lượt dồn dập ⇒ chỉ xả 1.000 / LO_XA lần, tổng không mất lượt nào', () => {
    const bd = boDemMoi(0);
    let soLanXa = 0;
    let tongXa = 0;
    for (let i = 0; i < 1000; i++) {
      const n = ghiLuot(bd, 1);
      if (n > 0) { soLanXa += 1; tongXa += n; }
    }
    expect(soLanXa).toBe(Math.floor(1000 / LO_XA));
    expect(tongXa + bd.cho).toBe(1000);
  });

  it('vắng người: lượt lẻ vẫn được xả sau NHIP_XA_MS (không nằm chờ mãi trong isolate)', () => {
    const bd = boDemMoi(0);
    expect(ghiLuot(bd, 10)).toBe(0);
    expect(ghiLuot(bd, NHIP_XA_MS + 1)).toBe(2);
    expect(bd.cho).toBe(0);
  });

  it('khoá tháng theo UTC', () => {
    expect(khoaThang(Date.parse('2026-10-31T23:30:00Z'))).toBe('2026-10');
    expect(khoaThang(Date.parse('2026-11-01T00:00:00Z'))).toBe('2026-11');
  });
});
