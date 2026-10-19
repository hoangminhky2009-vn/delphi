import { describe, expect, it } from 'vitest';
import { formatDeltaT, formatT } from '@/lib/money';
import { formatFull, formatLockTime } from '@/lib/time';

describe('formatT (C5 — integer, vi-VN)', () => {
  it('nhóm nghìn kiểu Việt', () => {
    expect(formatT(4520)).toBe('4.520 T');
    expect(formatT(0)).toBe('0 T');
    expect(formatT(1000)).toBe('1.000 T');
  });
  it('delta kiểu Mẫu E', () => {
    expect(formatDeltaT(636)).toBe('▲ +636 T');
    expect(formatDeltaT(-120)).toBe('▼ −120 T');
  });
  it('số không nguyên → nổ ở dev (bắt vi phạm C4/C5 sớm)', () => {
    expect(() => formatT(1.5)).toThrow();
  });
});

describe('giờ hiển thị Asia/Ho_Chi_Minh (UTC+7, kèm thứ — chỉ đạo GĐ5 §1.3)', () => {
  it('12:00 UTC thứ Sáu → "19:00 T6 24/07"', () => {
    expect(formatLockTime('2026-07-24T12:00:00Z')).toBe('19:00 T6 24/07');
  });
  it('qua ngày + qua thứ đúng (18:00 UTC T6 → 01:00 T7 hôm sau)', () => {
    expect(formatLockTime('2026-07-24T18:00:00Z')).toBe('01:00 T7 25/07');
  });
  it('chủ nhật hiển thị CN', () => {
    expect(formatLockTime('2026-07-26T05:00:00Z')).toBe('12:00 CN 26/07');
  });
  it('bản đầy đủ có năm', () => {
    expect(formatFull('2026-07-24T12:00:00Z')).toBe('19:00 24/07/2026');
  });
});
