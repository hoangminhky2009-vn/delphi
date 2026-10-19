/**
 * KHỐI XÁC THỰC TIN trên Bảng điện tử (cấp 2 Lướt Sóng, vai ĐỘI LÁI — 22/08).
 * Canh: không có `xac_thuc` ⇒ không vẽ gì; có thì hai dòng phải nói rõ mình là
 * XÁC SUẤT và LỘ SỚM — không dòng nào đọc thành "đáp án".
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Khối xác thực — đọc nguồn component', () => {
  const src = readFileSync('src/components/holdem/BangDienTu.tsx', 'utf8');

  it('chỉ render khi có xac_thuc (API cũ/cấp 1 không vẽ khung rỗng)', () => {
    expect(src).toMatch(/d\.xac_thuc && <KhoiXacThuc/);
  });

  it('xác suất nói rõ là "của loại tin này", không phải lời phán về chính tin', () => {
    expect(src).toContain('không phải lời');
  });

  it('lộ sớm nói rõ LÝ DO (tâm bão) — người chơi hiểu vì sao mình biết mà người khác không', () => {
    expect(src).toMatch(/tâm bão/);
  });
});
