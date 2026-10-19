/**
 * Gói 2 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — NĂM VÁ MỘT DÒNG, mỗi vá một bài đỏ được.
 *
 *   · B15 — `GET /holdem/ban/:ma` có xô `holdem:ban_xem:<uid>` trần `GIOI_HAN.BAN_XEM_MOI_GIO` = 600/giờ (SPEC đề xuất 120;
 *           client hỏi lặp 20 s/tab = 180/giờ nên 120 chặn oan người mở một tab ⇒ 600). Xô kiểm TRƯỚC khi tra bàn: kẻ quét mã
 *           bàn đoán bừa (404) cũng tiêu suất. Bài nạp sẵn 599 / 600 dòng `auth_attempts` ⇒ ghim cả số lẫn vị trí dòng chặn.
 *   · K4  — CORS cho phép `DELETE` (2 route DELETE: `admin.ts` · `rank_ghep_api.ts`); dev tách origin thì preflight đòi nó.
 *   · B13 — route có phiên không trả `Cache-Control: public, s-maxage` (Vercel CDN tôn trọng `s-maxage` ⇒ thân của người này
 *           có thể tới tay người khác). Quét `server/**`.
 *   · B3 (nốt) — không còn `rejectUnauthorized: false` ở `server/` · `api/` · `scripts/` (hai script prod nay dùng `tuyChonSsl`).
 *   · gỡ `@types/nodemailer` thừa — nodemailer ≥ 7 tự mang kiểu; gói kiểu cũ lệch phiên bản thì `tsc` đọc nhầm khai báo.
 *
 * Tiêm ngược (ghi ở báo cáo Gói 2): bỏ dòng `chanTanSuat(… 'ban_xem' …)` ⇒ ca 600 đỏ (404 thay 409) · đổi trần về 120 ⇒ ca 599
 * đỏ · bỏ `'DELETE'` ⇒ ca preflight đỏ · trả lại `public, s-maxage` ⇒ ca quét đỏ · trả lại `rejectUnauthorized: false` ở một
 * script ⇒ ca TLS đỏ · thêm lại `@types/nodemailer` ⇒ ca gói đỏ.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://dubao.test';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: ORIGIN, allowedOrigin: ORIGIN,
    tickSecret: 'tick-goi2', secureCookie: false,
  }) as Hono<any>;
}, 120_000);

afterAll(async () => { await db?.stop(); });

/** Nạp `n` lượt xem bàn trong giờ này cho người `u` — trạng thái "đã hỏi n lần", không phải mock xô. */
async function napLuotXem(u: TestUser, n: number): Promise<void> {
  await pool.query(
    `INSERT INTO auth_attempts (bucket) SELECT $1 FROM generate_series(1, $2)`,
    [`holdem:ban_xem:${u.userId}`, n],
  );
}

const xemBan = (u: TestUser) =>
  app.request('/api/v1/holdem/ban/abcde', { headers: { cookie: u.cookie } });

describe('B15 — xem bàn có trần 600 lượt/giờ, chặn trước khi tra bàn', () => {
  it('599 lượt đã dùng ⇒ lượt 600 vẫn tới route (404 bàn không có)', async () => {
    const u = await createTestUser(pool);
    await napLuotXem(u, 599);
    const r = await xemBan(u);
    expect(r.status).toBe(404);
    expect((await r.json() as any).error).toBe('ban_khong_co');
  });

  it('⭐ 600 lượt đã dùng ⇒ 409 rate_limited kể cả với mã bàn không tồn tại (kẻ quét mã cũng tiêu suất)', async () => {
    const u = await createTestUser(pool);
    await napLuotXem(u, 600);
    const r = await xemBan(u);
    expect(r.status).toBe(409);
    const b = await r.json() as { error: string; message: string };
    expect(b.error).toBe('rate_limited');
    expect(typeof b.message).toBe('string');
  });

  it('xô theo NGƯỜI: người khác đầy xô không chặn mình', async () => {
    const day = await createTestUser(pool);
    const minh = await createTestUser(pool);
    await napLuotXem(day, 600);
    expect((await xemBan(minh)).status).toBe(404);
  });
});

describe('K4 — CORS cho DELETE', () => {
  it('preflight DELETE từ origin được phép ⇒ Allow-Methods có DELETE', async () => {
    const r = await app.request('/api/v1/holdem/rank/suat', {
      method: 'OPTIONS',
      headers: { origin: ORIGIN, 'access-control-request-method': 'DELETE' },
    });
    expect(r.status).toBeLessThan(300);
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect((r.headers.get('access-control-allow-methods') ?? '').split(/\s*,\s*/)).toContain('DELETE');
  });
});

/** Mọi tệp .ts/.js dưới `goc` (bỏ node_modules), nội dung đã gỡ chú thích. */
function quetMa(goc: string): Array<{ tep: string; ma: string }> {
  const ra: Array<{ tep: string; ma: string }> = [];
  const di = (d: string) => {
    for (const ten of readdirSync(d)) {
      if (ten === 'node_modules' || ten.startsWith('.')) continue;
      const p = path.join(d, ten);
      if (statSync(p).isDirectory()) { di(p); continue; }
      if (!/\.(ts|js|mjs|cjs)$/.test(ten)) continue;
      const ma = readFileSync(p, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
      ra.push({ tep: path.relative(ROOT, p).replace(/\\/g, '/'), ma });
    }
  };
  di(path.join(ROOT, goc));
  return ra;
}

describe('B13 — route có phiên không cache công khai', () => {
  it('server/** không còn `public, s-maxage` (Vercel CDN tôn trọng s-maxage)', () => {
    const vi = quetMa('server').filter((t) => /public\s*,\s*s-maxage/.test(t.ma)).map((t) => t.tep);
    expect(vi).toEqual([]);
  });
});

describe('B3 (nốt) — không tệp nào tắt kiểm chứng chỉ TLS', () => {
  it('server/ · api/ · scripts/ không có `rejectUnauthorized: false`', () => {
    const vi = ['server', 'api', 'scripts']
      .flatMap(quetMa)
      .filter((t) => /rejectUnauthorized\s*:\s*false/.test(t.ma))
      .map((t) => t.tep);
    expect(vi).toEqual([]);
  });
});

describe('B16 (nốt) — không mang gói kiểu thừa', () => {
  it('package.json không khai @types/nodemailer (nodemailer tự mang kiểu)', () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty('@types/nodemailer');
  });
});
