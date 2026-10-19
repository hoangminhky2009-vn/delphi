/**
 * Linh vật Oracle là NGUỒN CHUNG của icon app + UI. Lưới hỏng = icon hỏng ở
 * mọi nơi (favicon, PWA, nav) mà không ai thấy tới lúc cài lên điện thoại.
 * Test này khóa tính toàn vẹn của lưới trước khi tới đó.
 */
import { describe, expect, it } from 'vitest';
import spec from '@/assets/mascot.json';

describe('mascot.json — lưới nguồn của icon + linh vật', () => {
  it('đúng số hàng và mọi hàng đủ độ dài', () => {
    expect(spec.grid).toHaveLength(spec.size);
    for (const [y, row] of spec.grid.entries()) {
      expect(`hàng ${y}: ${row.length}`).toBe(`hàng ${y}: ${spec.size}`);
    }
  });

  it('mọi ký tự đều có màu trong palette', () => {
    const palette = spec.palette as Record<string, string>;
    for (const row of spec.grid) {
      for (const ch of row) {
        if (ch !== '.') expect(palette[ch]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('có nội dung và nằm gọn trong lưới (không rỗng, không tràn)', () => {
    const filled = spec.grid.join('').split('').filter((c) => c !== '.').length;
    expect(filled).toBeGreaterThan(100);
    expect(filled).toBeLessThan(spec.size * spec.size);
  });
});
