/** Bậc thang polling D11 — đổi số trong polling.ts phải sửa test này CÙNG commit. */
import { describe, expect, it } from 'vitest';
import { marketPollIntervalMs } from '@/api/polling';

const NOW = 1_800_000_000_000;
const MIN = 60_000;
const on = { hasBet: true, visible: true };

describe('marketPollIntervalMs (D11)', () => {
  it('chưa đặt kèo → không polling (dù tab đang mở)', () => {
    expect(marketPollIntervalMs(NOW, NOW + 60 * MIN, { hasBet: false, visible: true })).toBe(false);
  });
  it('tab ẩn → không polling (dù đã đặt)', () => {
    expect(marketPollIntervalMs(NOW, NOW + 60 * MIN, { hasBet: true, visible: false })).toBe(false);
  });
  it('đã khóa → không polling', () => {
    expect(marketPollIntervalMs(NOW, NOW, on)).toBe(false);
    expect(marketPollIntervalMs(NOW, NOW - 1, on)).toBe(false);
  });
  it('còn xa (>30 phút) → 30s', () => {
    expect(marketPollIntervalMs(NOW, NOW + 31 * MIN, on)).toBe(30_000);
  });
  it('còn ≤30 phút → 10s (biên đúng tại 30 phút)', () => {
    expect(marketPollIntervalMs(NOW, NOW + 30 * MIN, on)).toBe(10_000);
    expect(marketPollIntervalMs(NOW, NOW + 6 * MIN, on)).toBe(10_000);
  });
  it('5 phút cuối → 5s (biên đúng tại 5 phút)', () => {
    expect(marketPollIntervalMs(NOW, NOW + 5 * MIN, on)).toBe(5_000);
    expect(marketPollIntervalMs(NOW, NOW + 1, on)).toBe(5_000);
  });
});
