/**
 * K6 · K7 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — bài canh cấu trúc `server/**`, đọc mã đã gỡ chú thích.
 *
 *   · K6 — `type Env = …` (biến ngữ cảnh Hono) chỉ khai ở `server/http/types.ts`; không tệp nào tự khai lại middleware
 *          `(c: any, next: any)` làm kiểu. Trước bản vá: 25 bản chép — thêm một biến ngữ cảnh là sửa 25 chỗ, sót chỗ nào thì
 *          `c.get(…)` ở đó ra `any` mà `tsc` vẫn xanh (D61).
 *   · K7 — tầng route `holdem_api.ts` (8.000+ dòng) chỉ được `app.ts` import. `dot_thu.ts` (xuất dữ liệu buổi đo) và
 *          `admin_san_pham.ts` từng import nó ⇒ đọc một bảng admin là nạp cả engine trận; đổi tầng route là đụng tầng dưới.
 *
 * Tiêm ngược: thêm lại `type Env = …` vào một tệp ⇒ ca K6 đỏ · trả `dot_thu.ts` về `from './holdem_api.js'` ⇒ ca K7 đỏ.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tepServer(): Array<{ tep: string; ma: string }> {
  const ra: Array<{ tep: string; ma: string }> = [];
  const di = (d: string) => {
    for (const ten of readdirSync(d)) {
      const p = path.join(d, ten);
      if (statSync(p).isDirectory()) { di(p); continue; }
      if (!ten.endsWith('.ts')) continue;
      const ma = readFileSync(p, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
      ra.push({ tep: path.relative(ROOT, p).replace(/\\/g, '/'), ma });
    }
  };
  di(path.join(ROOT, 'server'));
  return ra;
}

describe('K6 — kiểu Hono một nguồn', () => {
  it('⭐ `type Env =` chỉ khai ở server/http/types.ts', () => {
    const co = tepServer().filter((t) => /\btype\s+Env\s*=/.test(t.ma)).map((t) => t.tep);
    expect(co).toEqual(['server/http/types.ts']);
  });

  it('không tệp nào khai kiểu middleware `(c: any, next: any)` riêng', () => {
    const co = tepServer().filter((t) => /type\s+\w+\s*=\s*\(\s*c\s*:\s*any\s*,\s*next\s*:\s*any\s*\)/.test(t.ma)).map((t) => t.tep);
    expect(co).toEqual([]);
  });
});

describe('K7 — tầng route holdem_api.ts chỉ app.ts import', () => {
  it('⭐ ngoài server/app.ts, không tệp server/** nào import ./holdem_api', () => {
    const co = tepServer()
      .filter((t) => t.tep !== 'server/app.ts' && t.tep !== 'server/holdem_api.ts')
      .filter((t) => /from\s+['"][./]*holdem_api(\.js)?['"]|import\(\s*['"][./]*holdem_api(\.js)?['"]\s*\)/.test(t.ma))
      .map((t) => t.tep);
    expect(co).toEqual([]);
  });
});
