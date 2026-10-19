import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { docTokenPhien, dongDauAdmin, resolveSession } from '../server/auth/session.js';
import { AUTH } from '../config/auth.js';

/*
 * ĐƯỜNG BEARER PHẢI ĐƯỢC ĐỐI XỬ NHƯ ĐƯỜNG COOKIE (vá 11/08).
 *
 * ⚠⚠ VÌ SAO CÓ BÀI NÀY. Phiên có HAI đường đi: cookie (web) và
 * `Authorization: Bearer` (Activity Discord — iframe xuyên site nên cookie
 * `SameSite=Lax` không được gửi). `docTokenPhien` là bộ giải dùng chung, nhưng
 * hai chỗ đã TỰ CHÉP LẠI bằng `getCookie(...)`, và cả hai hỏng IM LẶNG:
 *   · `/auth/logout` — không thu hồi gì, vẫn trả `{ok:true}`. Người bấm "đăng
 *     xuất" tin là mình đã ra rồi rời máy; phiên sống tới lúc hết hạn.
 *   · `dongDauAdmin` — đóng dấu TOTP lên "phiên có token undefined", UPDATE khớp
 *     0 dòng, hàm trả về êm ru.
 *
 * Bài khoá HÀNH VI NGƯỜI DÙNG THẤY ("đăng xuất rồi thì token phải chết"), không
 * khoá cách cài đặt — dời bộ giải đi đâu thì vẫn phải đúng.
 */

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool,
    mailer: new CapturingMailer(),
    appBaseUrl: 'https://dubao.test',
    secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

/** Token thô của một phiên mới — `cookie` có dạng `<tên>=<token>`. */
async function tokenMoi(): Promise<string> {
  const u = await createTestUser(pool);
  const t = u.cookie.slice(u.cookie.indexOf('=') + 1);
  expect(t.length, 'fixture không trả ra token').toBeGreaterThan(0);
  return t;
}

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

describe('đăng xuất bằng phiên Bearer', () => {
  it('⭐ token Bearer PHẢI chết sau khi gọi /auth/logout', async () => {
    const token = await tokenMoi();
    // Còn sống trước đã — nếu không thì bài dưới xanh giả.
    expect(await resolveSession(pool, token), 'token phải sống trước khi thử').not.toBeNull();

    const r = await app.request('/api/v1/auth/logout', {
      method: 'POST', headers: bearer(token),
    });
    expect(r.status).toBe(200);

    // Hỏi THẲNG tầng phiên, không hỏi qua endpoint: endpoint có thể trả 401 vì
    // một lý do khác (thiếu cookie) và ta sẽ tưởng là đã thu hồi.
    expect(await resolveSession(pool, token), 'token vẫn sống sau khi đăng xuất').toBeNull();
  });

  it('và cửa API thật sự từ chối token đó', async () => {
    const token = await tokenMoi();
    expect((await app.request('/api/v1/auth/me', { headers: bearer(token) })).status).toBe(200);
    await app.request('/api/v1/auth/logout', { method: 'POST', headers: bearer(token) });
    expect((await app.request('/api/v1/auth/me', { headers: bearer(token) })).status).toBe(401);
  });

  it('đường cookie KHÔNG hỏng theo (bản vá không được đổi đường chính)', async () => {
    const token = await tokenMoi();
    const ck = `${AUTH.SESSION_COOKIE}=${token}`;
    expect((await app.request('/api/v1/auth/me', { headers: { cookie: ck } })).status).toBe(200);
    await app.request('/api/v1/auth/logout', { method: 'POST', headers: { cookie: ck } });
    expect(await resolveSession(pool, token)).toBeNull();
  });
});

describe('docTokenPhien — một nguồn cho cả hai đường', () => {
  const gia = (h: Record<string, string>) => ({
    req: { header: (n: string) => h[n.toLowerCase()] },
  });

  it('đọc được cookie', () => {
    expect(docTokenPhien(gia({ cookie: `${AUTH.SESSION_COOKIE}=abc123; khac=1` }))).toBe('abc123');
  });

  it('đọc được Bearer khi KHÔNG có cookie', () => {
    expect(docTokenPhien(gia({ authorization: 'Bearer xyz789' }))).toBe('xyz789');
  });

  it('cookie thắng Bearer khi có cả hai (web là đường chính)', () => {
    expect(docTokenPhien(gia({
      cookie: `${AUTH.SESSION_COOKIE}=abc123`, authorization: 'Bearer xyz789',
    }))).toBe('abc123');
  });

  it('không có gì → null, không ném', () => {
    expect(docTokenPhien(gia({}))).toBeNull();
  });
});

describe('dongDauAdmin — đóng dấu hụt phải KÊU', () => {
  it('token null → ném, không im lặng thành công', async () => {
    await expect(dongDauAdmin(pool, null, 'mo_quyen')).rejects.toThrow();
  });

  it('token không khớp phiên nào → ném (UPDATE 0 dòng là một THẤT BẠI)', async () => {
    await expect(dongDauAdmin(pool, 'token-khong-ton-tai', 'mo_quyen')).rejects.toThrow();
  });
});
