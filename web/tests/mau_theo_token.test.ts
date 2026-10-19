/**
 * MÀU PHẢI Ở TRONG HỆ TOKEN — chống trôi ngược.
 *
 * Đo 31/08 trước khi gom: 408 hex trong CSS, trong đó 62 chỗ gõ CỨNG một giá
 * trị TRÙNG KHÍT một token đang có (`--lose` · `--win` · `--gold-amber` · …).
 * Chúng render y hệt hôm nay, nên không ai thấy gì sai — cái hỏng chỉ lộ vào
 * ngày ai đó sửa `--lose` và 9 chỗ "mất tiền" không đổi theo.
 *
 * ⚠ BÀI NÀY CỐ Ý HẸP. Nó KHÔNG cấm hex nói chung: 97 hex còn lại là màu riêng
 * chưa có token (cam #f97316 của ngọn lửa, nâu #7c2d12…), và nắn chúng về một
 * token gần giống là BỊA một quan hệ không có — đúng cái bẫy vừa làm hỏng việc
 * gom NHỊP cùng ngày (2600ms của "tro bay" trùng số với hằng "băng-rôn tin",
 * gom lại là dựng một cần gạt giả). Bài chỉ cấm đúng ca TRÙNG KHÍT.
 *
 * ⚠ Và nó KHÔNG đụng `var(--x, #hex)`: hex ở đó là GIÁ TRỊ LÙI, khuôn hợp lệ
 * mà `css_bien_ma.test.ts` vốn đã chấp nhận.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Tệp KHAI token — được phép (và bắt buộc) chứa hex thô. Xem chú thích trong `quetCss`. */
const KHAI_TOKEN = ['tokens.css', 'pfm_token.css'] as const;

function quetCss(thuMuc: string): string[] {
  const ra: string[] = [];
  (function di(d: string) {
    for (const e of readdirSync(join(process.cwd(), d))) {
      const p = join(d, e);
      if (statSync(join(process.cwd(), p)).isDirectory()) di(p);
      /*
       * ⚠ Bỏ qua các tệp ĐỊNH NGHĨA token — chúng phải chứa hex thô, đó là việc của
       *   chúng. `pfm_token.css` là bảng màu của khu PFM, chép nguyên từ demo đã chốt
       *   (A11.25): mọi số đo tương phản/ΔE của demo tính trên đúng những mã ấy, nên nó
       *   khai hex là ĐÚNG chứ không phải "trôi khỏi hệ token".
       * ⚠ Danh sách này chỉ được có tệp KHAI token. Thêm một tệp dùng-màu vào đây là gỡ
       *   bộ canh cho chính chỗ nó sinh ra để canh.
       */
      else if (e.endsWith('.css') && !KHAI_TOKEN.some((t) => p.includes(t))) ra.push(p);
    }
  })(thuMuc);
  return ra;
}

describe('Màu trùng khít token thì phải gọi token', () => {
  it('⭐⭐ không file CSS nào gõ cứng một hex bằng đúng giá trị của một token', () => {
    const tok = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
    const TOKEN = new Map<string, string>();
    for (const m of tok.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
      if (!TOKEN.has(m[2]!.toLowerCase())) TOKEN.set(m[2]!.toLowerCase(), m[1]!);
    }
    expect(TOKEN.size, 'tokens.css không còn khai màu đơn nào — đọc lại').toBeGreaterThan(10);

    const pham: string[] = [];
    for (const f of quetCss('src')) {
      const s = readFileSync(join(process.cwd(), f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // giá trị lùi trong var() là khuôn HỢP LỆ — bỏ qua
        .replace(/var\(\s*--[a-z0-9-]+\s*,\s*#[0-9a-fA-F]{3,8}\s*\)/g, 'VAR');
      for (const m of s.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        const t = TOKEN.get(m[0]!.toLowerCase());
        if (t) pham.push(`${f}: ${m[0]} → đáng lẽ var(${t})`);
      }
    }
    expect(pham, `${pham.length} màu trôi khỏi hệ token:\n${pham.join('\n')}`).toEqual([]);
  });
});
