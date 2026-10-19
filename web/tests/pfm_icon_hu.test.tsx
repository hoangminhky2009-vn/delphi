/**
 * MỖI TÊN TRONG `ICON_HU` PHẢI VẼ RA THẬT (R16 · D246).
 *
 * ⚠⚠ VÌ SAO PHẢI LÀ BÀI RENDER CHỨ KHÔNG PHẢI BÀI KIỂU. Bản vá đầu tiên của tôi
 * dùng `ICON_HU ... satisfies readonly PixelIconName[]` và tin rằng trình biên
 * dịch sẽ canh hộ. Tiêm lỗi ngược thì lộ ra nó **không canh gì cả**:
 *
 *     const GRIDS: Record<string, string[]> = { … }      ← PixelIcon.tsx:54
 *     export type PixelIconName = keyof typeof GRIDS;     ← ⇒ chính là `string`
 *
 * `keyof Record<string, …>` là `string`, nên `PixelIconName` **không ràng buộc
 * gì hết** — mọi chuỗi đều "hợp lệ", ở đây và ở MỌI chỗ khác trong repo dùng
 * `name: PixelIconName`. Một tên gõ sai đi thẳng qua `GRIDS[name] ?? []`
 * (PixelIcon.tsx:894) và vẽ ra **ô rỗng**: không lỗi, không cảnh báo.
 * Đó chính là cách `'book'` sống sót trong `ICON_HU` — kèm một chú thích ngay
 * trên đầu tệp hứa rằng danh sách "đã đối chiếu với bộ lưới hiện có".
 *
 * ⇒ Bài học: **một cái chốt chỉ đáng tin sau khi đã thấy nó ĐỎ.** Chốt kiểu ở
 * trên trông rất thuyết phục khi đọc, và im lặng khi cần lên tiếng.
 * ⇒ Nên bài này đo THỨ CUỐI CÙNG người dùng nhận: có pixel nào được vẽ không.
 *
 * ⚠ Cách sửa tận gốc là bỏ chú thích kiểu ở `GRIDS` để TS tự suy ra 35 tên thật.
 * KHÔNG làm ở đây: `PixelIcon.tsx` đang được cửa sổ song song sửa (A11.7 —
 * `git add` đích danh, không giẫm chân). Đã báo founder để định tuyến.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PixelIcon } from '../src/components/ui/PixelIcon';
import { ICON_HU } from '../src/pfm/hu_mau';
import { MAU_HU } from '../src/pfm/hu_mau';

/** Lấy `box-shadow` của lớp trong — đó là toàn bộ hình của icon. */
function boCucIcon(ten: string): string {
  const { container } = render(<PixelIcon name={ten as never} size={16} />);
  const trong = container.querySelector('span > span') as HTMLElement | null;
  return trong?.style.boxShadow ?? '';
}

describe('ICON_HU — mọi tên phải vẽ ra pixel thật', () => {
  it('chống xanh rỗng: danh sách không rỗng', () => {
    expect(ICON_HU.length).toBeGreaterThan(5);
  });

  it('⭐ mỗi tên trong ICON_HU vẽ ra box-shadow KHÁC RỖNG', () => {
    const rong = ICON_HU.filter((t) => boCucIcon(t).trim() === '');
    expect(rong).toEqual([]);
  });

  it('⭐ mỗi icon của MAU_HU cũng vẽ ra thật — đây là thứ user nhìn thấy', () => {
    const rong = MAU_HU.filter((m) => boCucIcon(m.icon).trim() === '');
    expect(rong.map((m) => `${m.id}:${m.icon}`)).toEqual([]);
  });

  it('⚠ bài này ĐỎ được: một tên bịa ra phải cho box-shadow rỗng', () => {
    // Tiêm lỗi ngược ngay trong bài — nếu dòng này cũng "xanh" thì phép đo hỏng,
    // và hai bài trên không chứng minh được gì (A11.6).
    expect(boCucIcon('khong_he_ton_tai').trim()).toBe('');
  });
});
