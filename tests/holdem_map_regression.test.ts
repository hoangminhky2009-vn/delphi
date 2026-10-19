/**
 * GATE 7.1 — REGRESSION TẤT ĐỊNH của bộ sinh map (03-chu-ky-tin-dung §0.2).
 *
 * Fixture chụp từ engine TRƯỚC refactor máy trạng thái (commit 09a37bc, script
 * scripts/holdem_map_golden.ts). Máy trạng thái chu kỳ tín dụng, khi ma trận
 * còn điền phân phối hiện tại + sức căng khoá 0, PHẢI cho chuỗi ô byte-hệt.
 *
 * Test này đỏ = bước refactor VỪA ĐỔI PHÂN PHỐI, tức đổi thế giới và đổi cấu
 * trúc cùng lúc — đúng lớp confound đã dính ba lần (Lỗi 2 · instrument bot ·
 * chọn lọc bất lợi). Sửa code cho test xanh, KHÔNG sửa fixture; fixture chỉ
 * được thay khi một balance_version mới CỐ Ý đổi phân phối và có gate đo kèm.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sinhMap } from '../server/holdem/map.js';

const golden = JSON.parse(
  readFileSync('tests/fixtures/holdem_map_golden.json', 'utf8')) as {
  chup_tai_commit: string;
  sweep_n: number;
  sweep: Record<string, string>;
  deep: { seed: number; size: number; o: unknown }[];
};

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

describe('gate 7.1 — sinhMap byte-hệt engine cũ', () => {
  it('24 map deep-equal đúng từng ô, từng cờ tin giả', () => {
    for (const { seed, size, o } of golden.deep) {
      expect(JSON.stringify(sinhMap(seed, size).o), `seed=${seed} size=${size}`)
        .toBe(JSON.stringify(o));
    }
  });

  it('quét 600 seed × 3 cỡ map — hash khớp fixture', () => {
    for (const [size, hash] of Object.entries(golden.sweep)) {
      let acc = '';
      for (let seed = 0; seed < golden.sweep_n; seed += 1) {
        acc += JSON.stringify(sinhMap(seed, Number(size)).o);
      }
      expect(fnv1a(acc), `size=${size}`).toBe(hash);
    }
  });

  it('trang_thai (máy trạng thái) có mặt và KHÔNG rò vào chuỗi ô', () => {
    const map = sinhMap(42, 12);
    // Metadata máy trạng thái là mảng song song, không được đổi hình dạng `o`.
    expect(map.trang_thai?.length).toBe(map.o.length);
    for (const o of map.o) {
      expect('trang_thai' in o).toBe(false);
    }
  });
});
