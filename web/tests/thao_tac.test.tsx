/**
 * CỜ "ĐANG THAO TÁC" (`lib/thao_tac.ts`) + chỗ lớp phủ bám vào nó.
 *
 * ⚠ Bài đắt nhất ở đây là §III: hằng số TS và selector CSS là **hai đầu dây** — đổi tên
 * hằng thì CSS trỏ vào hư không, và hỏng ấy IM LẶNG (lớp phủ chỉ đơn giản không ẩn nữa).
 * Đúng họ lỗi đã cắn cả đợt này.
 */
import { describe, expect, it, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THUOC_TINH_THAO_TAC, quenThaoTac, useDangThaoTac } from '../src/lib/thao_tac';

function Ban({ bat }: { bat: boolean }) {
  useDangThaoTac(bat);
  return null;
}

const co = () => document.body.dataset[THUOC_TINH_THAO_TAC] ?? null;

afterEach(() => { cleanup(); quenThaoTac(); });

describe('§I — bật/tắt', () => {
  it('bật ⇒ cờ lên body; tắt ⇒ mất', () => {
    const { rerender } = render(<Ban bat />);
    expect(co()).toBe('co');
    rerender(<Ban bat={false} />);
    expect(co()).toBeNull();
  });

  it('⭐ UNMOUNT giữa chừng vẫn nhả cờ', () => {
    /*
     * ⚠ Người dùng đang cầm tiền mà bấm back thì component biến mất **giữa lúc cờ đang
     * bật**. Thiếu dọn ở effect là cờ kẹt vĩnh viễn và lớp phủ không bao giờ trở lại —
     * hỏng im lặng, và chỉ lộ ra ở màn khác.
     */
    const { unmount } = render(<Ban bat />);
    expect(co()).toBe('co');
    unmount();
    expect(co()).toBeNull();
  });
});

describe('§II — ⭐⭐ ĐẾM CHỒNG, không phải cờ bật/tắt', () => {
  it('⭐⭐ hai chỗ cùng giữ, một chỗ xong ⇒ cờ VẪN bật', () => {
    /*
     * Nếu chỉ xoá thuộc tính khi một bên xong thì bên còn lại **mất cờ trong khi vẫn đang
     * bận**, và lớp phủ hiện lại đúng giữa lúc người ta đang bấm. Chỉ hạ khi người cuối
     * cùng xong.
     */
    const a = render(<Ban bat />);
    const b = render(<Ban bat />);
    expect(co()).toBe('co');
    a.unmount();
    expect(co(), 'còn một chỗ đang giữ').toBe('co');
    b.unmount();
    expect(co()).toBeNull();
  });
});

describe('§III — ⭐⭐⭐ hằng số TS và selector CSS phải khớp', () => {
  it('⭐⭐⭐ CSS của Oracle bám đúng thuộc tính mà `thao_tac.ts` đặt', () => {
    /*
     * ⚠⚠ HAI ĐẦU DÂY. `useDangThaoTac` đặt `body[data-dang-thao-tac]`; `OracleChat.module.css`
     * ẩn theo đúng chuỗi ấy. Không có gì trong TypeScript nối hai bên — đổi tên hằng thì
     * CSS trỏ vào một thuộc tính không còn ai đặt, và hỏng ấy **im lặng**: Oracle chỉ đơn
     * giản thôi ẩn, không lỗi, không cảnh báo. Bài này là sợi dây duy nhất.
     */
    const kebab = THUOC_TINH_THAO_TAC.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    const css = readFileSync(
      resolve(__dirname, '../src/components/OracleChat.module.css'), 'utf8');
    expect(kebab).toBe('dang-thao-tac');
    expect(css, `CSS phải ẩn theo data-${kebab}`).toContain(`data-${kebab}`);
    expect(css, 'phải là display:none, không phải opacity:0 — xem chú thích trong CSS')
      .toMatch(/data-dang-thao-tac[^{}]*\{[^}]*display:\s*none/);
  });
});
