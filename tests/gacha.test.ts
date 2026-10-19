/**
 * GĐ4.5 scaffold — test gacha engine (hàm thuần, CHƯA route nào gọi).
 *
 * Viết test trước khi bật tính năng vì đây là chỗ dễ sai kiểu "chạy 6 tháng
 * không ai thấy": rate lệch vài phần nghìn, pity đếm lệch một lượt, hoặc quên
 * luật chặn kiệt quệ. Bật ở v0.3 thì chỉ việc gỡ cờ, không phải cân lại luật.
 */
import { describe, expect, it } from 'vitest';
import {
  GACHA, GACHA_RATES_BP, GachaError, pull, pullMany, type Rarity,
} from '../server/sandbox/gacha.js';
import { makeRng, rngAt } from '../server/sandbox/rng.js';

describe('Gacha — luật công bố', () => {
  it('rate cộng lại đúng 100% (10.000 bp)', () => {
    const total = Object.values(GACHA_RATES_BP).reduce((s, x) => s + x, 0);
    expect(total).toBe(10_000);
  });

  it('rate thực đo khớp rate công bố trong sai số thống kê', () => {
    // Tắt pity bằng cách reset bộ đếm mỗi lượt → đo rate thuần.
    const count = { thuong: 0, hiem: 0, epic: 0 } as Record<Rarity, number>;
    const N = 200_000;
    for (let i = 0; i < N; i += 1) {
      count[pull(10_000, 0, rngAt(999, 'rate', i)).rarity] += 1;
    }
    expect(count.thuong / N).toBeGreaterThan(0.69);
    expect(count.thuong / N).toBeLessThan(0.71);
    expect(count.hiem / N).toBeGreaterThan(0.24);
    expect(count.hiem / N).toBeLessThan(0.26);
    expect(count.epic / N).toBeGreaterThan(0.045);
    expect(count.epic / N).toBeLessThan(0.055);
  });

  it('pity: epic ĐẢM BẢO trong 20 lượt, không bao giờ quá', () => {
    // Chuỗi dài, đếm khoảng cách giữa các epic.
    const results = pullMany(500_000, 0, 4242, 3_000);
    let since = 0;
    let maxGap = 0;
    for (const r of results) {
      since += 1;
      if (r.rarity === 'epic') {
        maxGap = Math.max(maxGap, since);
        since = 0;
      }
    }
    expect(maxGap).toBeLessThanOrEqual(GACHA.PITY_EPIC);
    expect(results.some((r) => r.fromPity)).toBe(true);
  });

  it('pity đếm đúng: lượt thứ 20 kể từ epic gần nhất chắc chắn ra epic', () => {
    const r = pull(10_000, GACHA.PITY_EPIC - 1, makeRng(1));
    expect(r.rarity).toBe('epic');
    expect(r.fromPity).toBe(true);
    expect(r.pullsSinceEpic).toBe(0);
  });

  it('ra epic thì bộ đếm pity về 0; không epic thì tăng 1', () => {
    const notEpic = pull(10_000, 3, rngAt(7, 'x', 1));
    if (notEpic.rarity === 'epic') expect(notEpic.pullsSinceEpic).toBe(0);
    else expect(notEpic.pullsSinceEpic).toBe(4);
  });
});

describe('Gacha — chốt chặn bảo vệ người chơi', () => {
  it('bankroll ≤ 500 T thì CẤM quay (chống tự hủy khi sắp kiệt quệ)', () => {
    expect(() => pull(500, 0, makeRng(1))).toThrow(GachaError);
    expect(() => pull(500, 0, makeRng(1))).toThrow(/500 T/);
    expect(() => pull(400, 0, makeRng(1))).toThrow(/500 T/);
    // Ngay trên ngưỡng thì được.
    expect(() => pull(501, 0, makeRng(1))).not.toThrow();
  });

  it('quay liên tục sẽ DỪNG ở ngưỡng, không rơi xuống dưới 500 T', () => {
    const results = pullMany(1_000, 0, 5, 100);
    // 1.000 T, mỗi lượt 100 T, dừng khi còn ≤ 500 → tối đa 5 lượt.
    expect(results.length).toBeLessThanOrEqual(5);
    const burned = results.reduce((s, r) => s + r.burnedT, 0);
    expect(1_000 - burned).toBeGreaterThan(GACHA.MIN_BANKROLL_T);
  });

  it('đầu vào rác bị từ chối rõ ràng', () => {
    expect(() => pull(-1, 0, makeRng(1))).toThrow(/số dư/i);
    expect(() => pull(1.5, 0, makeRng(1))).toThrow(/số dư/i);
    expect(() => pull(10_000, -1, makeRng(1))).toThrow(/pity/i);
  });

  it('mỗi lượt đốt đúng 100 T, không hơn không kém', () => {
    for (const r of pullMany(10_000, 0, 8, 20)) {
      expect(r.burnedT).toBe(GACHA.COST_T);
    }
  });
});

describe('Gacha — tất định & tường lửa', () => {
  it('cùng hạt → cùng chuỗi kết quả', () => {
    const a = pullMany(100_000, 0, 31, 200).map((r) => r.rarity);
    const b = pullMany(100_000, 0, 31, 200).map((r) => r.rarity);
    expect(a).toEqual(b);
    expect(pullMany(100_000, 0, 32, 200).map((r) => r.rarity)).not.toEqual(a);
  });

  it('module gacha KHÔNG có bất kỳ tham số nào nhận Q', async () => {
    // Q chạm voucher thật → quay số bằng Q là cờ bạc theo nghĩa pháp lý.
    // Chốt bằng test để không ai "tiện tay" thêm một tham số questPoints.
    const { readFile } = await import('node:fs/promises');
    const src = await readFile(new URL('../server/sandbox/gacha.ts', import.meta.url), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/quest/i);
    expect(code).not.toMatch(/\bQ\b.*:\s*number/);
  });
});
