/**
 * D438 — HÌNH SVG KHÔNG ĐƯỢC BỊ THAY NÚT MỖI LẦN VẼ LẠI (founder 27/09 tối: *"hiệu ứng thẻ trait đang bị lỗi khi bấm vào
 * (nhảy hình liên tục)"*).
 *
 * React 19 so prop `dangerouslySetInnerHTML` theo ĐỐI TƯỢNG: `{{ __html: s }}` gõ tại chỗ là đối tượng mới mỗi lần vẽ ⇒
 * `innerHTML` bị gán lại ⇒ `<svg>` bị thay nút mới. Màn trận vẽ lại mỗi giây (đồng hồ vòng) ⇒ hoạt ảnh `bat` của hình trong
 * tấm xem thẻ trait chạy lại liên tục. Đo trên màn thật trước khi vá: 7 lần chạy lại trong 6 giây, 242 nút DOM bị thay.
 *
 *  §I  hành vi — vẽ lại khung cha thì svg của thẻ trait VÀ của tấm xem vẫn là ĐÚNG nút cũ.
 *  §II cả lớp — `web/src` không còn chỗ nào dùng đối tượng gõ tại chỗ cho `dangerouslySetInnerHTML`.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TamTrait, TheTrait } from '../src/components/holdem/TheTrait';
import { htmlTinh } from '../src/lib/html_tinh';

function Khung() {
  const [n, setN] = useState(0);
  return (
    <div>
      <button type="button" onClick={() => setN((x) => x + 1)}>vẽ lại {n}</button>
      <TheTrait id="kien_nhan" onMo={() => {}} />
      <TamTrait id="kien_nhan" cheDo="cho" chon={[]} onDong={() => {}} />
    </div>
  );
}

describe('D438 §I — vẽ lại không thay nút svg', () => {
  it('htmlTinh: cùng chuỗi ⇒ CÙNG đối tượng; khác chuỗi ⇒ khác', () => {
    expect(htmlTinh('<svg></svg>')).toBe(htmlTinh('<svg></svg>'));
    expect(htmlTinh('<svg></svg>')).not.toBe(htmlTinh('<svg><path/></svg>'));
    expect(htmlTinh('<svg></svg>').__html).toBe('<svg></svg>');
  });

  it('⭐ thẻ trait và tấm xem thẻ: vẽ lại hai lần, svg vẫn là nút cũ (hoạt ảnh không chạy lại)', () => {
    render(<Khung />);
    const svgThe = document.querySelector('button[data-trait="kien_nhan"] svg');
    const svgTam = document.querySelector('[data-tap="tam-trait"] svg');
    expect(svgThe, 'thẻ phải có hình').not.toBeNull();
    expect(svgTam, 'tấm xem phải có hình').not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /vẽ lại/ }));
    fireEvent.click(screen.getByRole('button', { name: /vẽ lại/ }));
    expect(screen.getByRole('button', { name: /vẽ lại 2/ })).toBeTruthy();
    expect(document.querySelector('button[data-trait="kien_nhan"] svg'), 'svg của thẻ bị thay nút khi vẽ lại').toBe(svgThe);
    expect(document.querySelector('[data-tap="tam-trait"] svg'), 'svg của tấm xem bị thay nút ⇒ hoạt ảnh bật hình chạy lại').toBe(svgTam);
  });
});

function quetTsx(thuMuc: string): string[] {
  const ra: string[] = [];
  const di = (d: string) => {
    for (const e of readdirSync(join(process.cwd(), d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) di(p);
      else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) ra.push(p);
    }
  };
  di(thuMuc);
  return ra;
}

describe('D438 §II — cả lớp', () => {
  it('⭐ web/src không còn đối tượng gõ tại chỗ cho dangerouslySetInnerHTML; mọi chỗ đi qua htmlTinh', () => {
    const tep = quetTsx('src');
    const viPham: string[] = [];
    let soDung = 0;
    for (const p of tep) {
      const dong = readFileSync(join(process.cwd(), p), 'utf8').split('\n');
      dong.forEach((d, i) => {
        if (/dangerouslySetInnerHTML=\{\{/.test(d)) viPham.push(`${p}:${i + 1}`);
        if (/dangerouslySetInnerHTML=\{htmlTinh\(/.test(d)) soDung += 1;
      });
    }
    expect(tep.length, 'bài quét phải thấy mã nguồn web').toBeGreaterThan(100);
    expect(soDung, 'phải thấy các chỗ đã chuyển sang htmlTinh (bài không rỗng)').toBeGreaterThanOrEqual(19);
    expect(viPham, 'React 19 so theo ĐỐI TƯỢNG ⇒ svg bị thay nút mỗi lần vẽ lại — dùng htmlTinh(chuỗi)').toEqual([]);
  });
});
