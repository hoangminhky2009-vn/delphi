/**
 * D529 — MÀN MINIGAME MƯỢT NHƯ DEMO (founder 06/10: *"hiệu ứng của minigame trên app cảm giác khựng và không mượt/đẹp bằng trên demo"*).
 *
 * Ba lớp lỗi, mỗi lớp một bài:
 *   §I  NỘI SUY ĐỂ VẼ — demo `giaGoc` kéo giá liên tục giữa hai mốc; app nhảy từng nhịp (14 lần/giây). `thayDeVe` chỉ đổi PHẦN VẼ, không
 *       bao giờ đoán nhịp chưa tới, không đụng các nhịp đã qua.
 *   §II ĐỆM DÒNG NHỊP — xem trễ đúng bằng một lô phát (1000 = `LO_NHIP_MS`) ⇒ lô nào tới trễ bao nhiêu thì đồ thị ĐỨNG bấy nhiêu, mỗi giây.
 *       Trễ xem phải dư hơn một lô, nhưng vẫn chừa chỗ cho cú bấm đi lên trong cửa sổ nhận lệnh của server.
 *   §III VÒNG VẼ KHÔNG ÉP TÍNH BỐ CỤC — `getComputedStyle` / `getBoundingClientRect` mỗi khung, xen giữa các cú ghi DOM, là layout thrash.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CUA_SO_LENH_MS, LO_NHIP_MS } from '@config/minigame';
import { thayDeVe } from '@/components/holdem/ManMinigame';

const SRC = readFileSync(resolve(process.cwd(), 'src/components/holdem/ManMinigame.tsx'), 'utf8');

describe('I. thayDeVe — nội suy chỉ để vẽ', () => {
  const thay = [100, 101, 102];
  it('⭐ giữa nhịp 2 và nhịp 3: giá vẽ đi đúng phần lẻ, các nhịp trước giữ nguyên', () => {
    const r = thayDeVe(thay, 106, 2.25, true, 480);
    expect(r.slice(0, 2)).toEqual([100, 101]);
    expect(r[2]).toBeCloseTo(103, 9);
    expect(r).toHaveLength(3);
  });
  it('chưa có nhịp kế ⇒ đứng yên (không đoán tương lai)', () => { expect(thayDeVe(thay, undefined, 2.9, true, 480)).toBe(thay); });
  it('ngoài pha chạy ⇒ không nội suy', () => { expect(thayDeVe(thay, 106, 2.5, false, 480)).toBe(thay); });
  it('nhịp kế nằm ngoài màn ⇒ không nội suy', () => { expect(thayDeVe(thay, 106, 2.5, true, 3)).toBe(thay); });
  it('đồng hồ vượt xa dữ liệu (đệm cạn) ⇒ kẹp ở nhịp kế, không vọt quá', () => { expect(thayDeVe(thay, 106, 9, true, 480)[2]).toBe(106); });
});

describe('II. Đệm dòng nhịp dư hơn một lô', () => {
  const tre = Number(/const TRE_XEM_MS = (\d+);/.exec(SRC)?.[1]);
  it('⭐ trễ xem ≥ một lô + 300 ms (chịu lô trễ) và ≤ cửa sổ lệnh − 500 ms (chừa đường bấm đi lên)', () => {
    expect(tre, 'không tìm thấy TRE_XEM_MS').toBeGreaterThan(0);
    expect(tre).toBeGreaterThanOrEqual(LO_NHIP_MS + 300);
    expect(tre).toBeLessThanOrEqual(CUA_SO_LENH_MS - 500);
  });
});

describe('III. Vòng vẽ không đo bố cục mỗi khung', () => {
  // Thân effect vẽ: từ `const ve = () => {` tới dòng dọn dẹp của chính effect ấy (`raf = requestAnimationFrame(ve)` còn nằm ngay đầu thân `ve`).
  const dau = SRC.indexOf('const ve = () => {'), cuoi = SRC.indexOf('return () => { cancelAnimationFrame(raf); roCv?.disconnect(); };', dau);
  const than = dau >= 0 && cuoi > dau ? SRC.slice(dau, cuoi) : '';
  // Khối đo MỘT lần khi canvas mới gắn được phép gọi `getBoundingClientRect`.
  const ngoaiKhoiMotLan = than.replace(/if \(c !== cvTheoDoi\) \{[\s\S]*?\n {6}\}/, '');
  it('bắt được thân vòng vẽ', () => { expect(than.length).toBeGreaterThan(2000); });
  it('⭐ không `getComputedStyle` trong vòng vẽ (màu đọc một lần qua `mauCua`)', () => {
    expect(ngoaiKhoiMotLan).not.toMatch(/getComputedStyle\(/);
  });
  it('⭐ không `getBoundingClientRect` trong vòng vẽ ngoài khối đo một lần', () => {
    expect(ngoaiKhoiMotLan).not.toMatch(/getBoundingClientRect\(/);
  });
});
