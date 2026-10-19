/**
 * season_id — gắn trên dữ liệu từ ngày 1 (A4: SEASON_LENGTH 3 tháng; v0.1 chưa
 * chạy reset mùa, chỉ lưu). Suy ra từ thời điểm, không lưu state → không lệch.
 */
import { ECONOMY } from '../config/economy.js';

/** Ví dụ: 2026-07-17 → '2026Q3' (mùa 3 tháng). */
export function currentSeasonId(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const monthsPerSeason = ECONOMY.SEASON_LENGTH_MONTHS;
  const index = Math.floor(now.getUTCMonth() / monthsPerSeason) + 1;
  return `${year}Q${index}`;
}
