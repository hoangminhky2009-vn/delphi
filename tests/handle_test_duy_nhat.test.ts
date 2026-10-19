/**
 * HANDLE TRONG TEST PHẢI DUY NHẤT — bài trong `tests/` không truyền `handle` cho `createTestUser`.
 *
 * Vì sao: CI chạy lại bài đỏ MỘT lần (`vitest.config.ts` — `retry: process.env.CI ? 1 : 0`) trong CÙNG DB của tệp.
 * Bài gõ `createTestUser(pool, { handle: 'mgcuoi' })` thì lượt chạy lại tạo lại đúng handle ấy ⇒ vấp `23505
 * users_handle_key` thay vì đo lại: retry thành vô dụng và lỗi thật bị che bằng lỗi trùng khoá (CI master 741f0dc0,
 * run 38020077890, 10/10). Đo 10/10: 147 lời gọi truyền `handle` trong 66 tệp — gỡ hết ở cùng commit với bài này.
 *
 * Cách đúng: bỏ `handle` (fixture sinh `u<seq>_<ngẫu nhiên>`), cần so/tìm thì đọc `u.handle`. Bài mà CHỮ của handle
 * là dữ liệu (tìm chuỗi con, sắp theo handle) dùng `tienTo` ⇒ `<tienTo>_<seq>` (xem `tests/helpers/fixtures.ts`).
 * Bắt cả `handle:` lẫn viết tắt `{ handle }`, cả hằng chuỗi lẫn template/biến: `\`a1_${lan}\`` cũng lặp lại y hệt ở
 * lượt chạy lại. Không bắt được: object dựng sẵn rồi mới truyền (`createTestUser(pool, o)`) — chưa có ca nào.
 *
 * Ngoại lệ khoá theo (tệp, tên bài) — KHÔNG theo chữ handle (feedback 15/09: miễn theo tên lọt). Đang rỗng.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const GOC = process.cwd();
const TU_THAN = 'tests/handle_test_duy_nhat.test.ts';

/** Miễn trừ — chỉ thêm khi founder gật, kèm lý do. `bai` = tên bài `it(...)`/`test(...)` bao quanh, `(ngoai bai)` nếu ở hook. */
export const MIEN: { tep: string; bai: string; ly_do: string }[] = [];

function tepTs(thuMuc: string): string[] {
  const ra: string[] = [];
  const di = (d: string) => {
    for (const ten of readdirSync(d)) {
      if (ten === 'node_modules') continue;
      const p = join(d, ten);
      if (statSync(p).isDirectory()) di(p);
      else if (/\.tsx?$/.test(ten)) ra.push(relative(GOC, p).replace(/\\/g, '/'));
    }
  };
  di(join(GOC, thuMuc));
  return ra;
}

/** Chỉ số ngay sau dấu `)` khớp với `(` ở `mo` (đếm ngoặc, bỏ qua ngoặc trong chuỗi '…' "…" `…`). */
function dongNgoac(s: string, mo: number): number {
  let sau = 0;
  let chuoi: string | null = null;
  for (let i = mo; i < s.length; i += 1) {
    const c = s[i]!;
    if (chuoi) {
      if (c === '\\') i += 1;
      else if (c === chuoi) chuoi = null;
      continue;
    }
    if (c === '\'' || c === '"' || c === '`') chuoi = c;
    else if (c === '(') sau += 1;
    else if (c === ')' && (sau -= 1) === 0) return i + 1;
  }
  return s.length;
}

/** Tên bài `it/test('…')` hẹp nhất bao quanh vị trí `vt`; `(ngoai bai)` nếu nằm ở hook/hàm phụ. */
function baiBaoQuanh(s: string, vt: number): string {
  let ten = '(ngoai bai)';
  for (const m of s.matchAll(/(?<![\w.$])(?:it|test)\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)) {
    const mo = m.index! + m[0].indexOf('(');
    if (mo > vt) break;
    if (dongNgoac(s, mo) > vt) ten = m[2]!;
  }
  return ten;
}

/** Mọi lời gọi `createTestUser(...)` có khoá `handle` trong đối số ⇒ một dòng lỗi. */
export function quetHandleCoDinh(tep: string, noiDung: string, mien = MIEN): string[] {
  const loi: string[] = [];
  for (const m of noiDung.matchAll(/(?<![\w.$])createTestUser\(/g)) {
    const mo = m.index! + m[0].length - 1;
    const doiSo = noiDung.slice(mo + 1, dongNgoac(noiDung, mo) - 1);
    if (!/(?<![\w.$?])handle\s*(?::|(?=[,}]))/.test(doiSo)) continue;
    const bai = baiBaoQuanh(noiDung, m.index!);
    if (mien.some((x) => x.tep === tep && x.bai === bai)) continue;
    const dong = noiDung.slice(0, m.index!).split('\n').length;
    loi.push(`${tep}:${dong} [${bai}] — ${doiSo.replace(/\s+/g, ' ').trim().slice(0, 90)}`);
  }
  return loi;
}

describe('handle trong test phải duy nhất — retry của CI phải đo lại được', () => {
  it('⭐ không bài nào trong tests/ truyền `handle` cho createTestUser', () => {
    const tep = tepTs('tests').filter((t) => t !== TU_THAN && t !== 'tests/helpers/fixtures.ts');
    const loi = tep.flatMap((t) => quetHandleCoDinh(t, readFileSync(join(GOC, t), 'utf8')));
    expect(loi, 'bỏ `handle` (đọc `u.handle`), hoặc `tienTo` nếu chữ handle là dữ liệu bài — xem đầu tệp này:\n'
      + loi.join('\n')).toEqual([]);
    // Bài quét rỗng thì xanh mà không canh gì: phải thấy đủ lời gọi (đo 10/10: > 600).
    const soGoi = tep.reduce((n, t) => n + (readFileSync(join(GOC, t), 'utf8').match(/(?<![\w.$])createTestUser\(/g)?.length ?? 0), 0);
    expect(soGoi).toBeGreaterThan(300);
  });

  it('bắt hằng chuỗi · template · biến · viết tắt · nhiều dòng; tha `tienTo`, `u.handle`, không đối số', () => {
    const do_ = [
      `const u = await createTestUser(pool, { handle: 'mgcuoi' });`,
      `const u = await createTestUser(pool, { role: 'admin', handle: \`a1_\${lan}\` });`,
      `const u = await createTestUser(pool, { handle: ten, role: 'user' });`,
      `const u = await createTestUser(pool, { role: 'admin', handle });`,
      `const u = await createTestUser(pool, {\n  bankroll: 5,\n  handle: 'x(y)',\n});`,
    ];
    for (const s of do_) expect(quetHandleCoDinh('t.ts', s), s).toHaveLength(1);
    const xanh = [
      `const u = await createTestUser(pool);`,
      `const u = await createTestUser(db.pool, { role: 'admin', bankroll: 400 });`,
      `const u = await createTestUser(pool, { tienTo: 'pt_u1' }); expect(b).toMatchObject({ handle: u.handle });`,
      `const u = await createTestUser(pool, { tienTo: k.handle });`,
      `export async function createTestUser(pool: pg.Pool, opts: { handle?: string } = {}) {}`,
    ];
    for (const s of xanh) expect(quetHandleCoDinh('t.ts', s), s).toEqual([]);
  });

  it('miễn khoá theo (tệp, tên bài): cùng handle ở bài khác hay tệp khác vẫn đỏ', () => {
    const s = [
      `it('bài được miễn', async () => { const a = await createTestUser(pool, { handle: 'trung' }); });`,
      `it('bài khác', async () => { const b = await createTestUser(pool, { handle: 'trung' }); });`,
      `beforeAll(async () => { await createTestUser(pool, { handle: 'trung' }); });`,
    ].join('\n');
    const mien = [{ tep: 'a.test.ts', bai: 'bài được miễn', ly_do: 'thử' }];
    expect(quetHandleCoDinh('a.test.ts', s, mien).map((x) => x.replace(/ —.*/, ''))).toEqual([
      'a.test.ts:2 [bài khác]', 'a.test.ts:3 [(ngoai bai)]',
    ]);
    expect(quetHandleCoDinh('b.test.ts', s, mien)).toHaveLength(3);
  });
});
