/**
 * Age gate (C8) + quy đổi năm sinh → age_band (C7: KHÔNG lưu năm sinh).
 *
 * Chỉ thu NĂM sinh nên tuổi tính theo năm dương lịch (cách hiểu phổ thông ở VN):
 *   tuổi = năm hiện tại − năm sinh
 * Ví dụ nghiệm thu GĐ2: 2012 → 14 (chặn) · 2009 → 17 (qua). Ngưỡng lấy từ
 * ECONOMY.AGE_GATE_MIN (A4 — luật sư có thể nâng 18, sửa ở đúng một chỗ).
 */
import { ECONOMY } from '../../config/economy.js';
import type { AgeBand } from '../../config/auth.js';

export const EARLIEST_BIRTH_YEAR = 1900;

export interface AgeGateResult {
  ok: boolean;
  age?: number;
  ageBand?: AgeBand;
  reason?: 'invalid_year' | 'under_age';
}

export function checkAgeGate(birthYear: number, now: Date = new Date()): AgeGateResult {
  const currentYear = now.getUTCFullYear();
  if (
    !Number.isInteger(birthYear) ||
    birthYear < EARLIEST_BIRTH_YEAR ||
    birthYear > currentYear
  ) {
    return { ok: false, reason: 'invalid_year' };
  }
  const age = currentYear - birthYear;
  if (age < ECONOMY.AGE_GATE_MIN) {
    return { ok: false, age, reason: 'under_age' };
  }
  return { ok: true, age, ageBand: toAgeBand(age) };
}

export function toAgeBand(age: number): AgeBand {
  if (age <= 17) return '16-17';
  if (age <= 22) return '18-22';
  if (age <= 30) return '23-30';
  if (age <= 45) return '31-45';
  return '46+';
}
