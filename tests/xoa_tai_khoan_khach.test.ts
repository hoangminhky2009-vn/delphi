/**
 * B4 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — KHÁCH VÀ DISCORD TỰ XOÁ ĐƯỢC TÀI KHOẢN.
 *
 * Hành vi đổi: trước bản vá `POST /account/delete` luôn đòi mật khẩu; khách (`/auth/khach`) và Discord không có
 * `password_hash` ⇒ `verifyPassword(null, …)` luôn false ⇒ không bao giờ tự xoá được — trái điều khoản "Xoá tài khoản ở
 * cuối Hồ sơ" (`web/src/content/dieuKhoan.ts`) và quyền xoá 20 ngày (SPEC pháp lý R6). Nay tài khoản KHÔNG mật khẩu xác
 * nhận bằng `xac_nhan: "XOA"` + phiên hiện tại; tài khoản CÓ mật khẩu vẫn phải gõ mật khẩu (gõ XOA không thay được).
 *
 * Tiêm ngược: bỏ nhánh `password_hash IS NULL` ⇒ ca khách 200 đỏ.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { hashPassword } from '../server/auth/crypto.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
}, 120_000);

afterAll(async () => { await db?.stop(); });

let ip = 0;
async function khachMoi(): Promise<{ token: string; userId: string }> {
  ip += 1;
  const r = await app.request('/api/v1/auth/khach', { method: 'POST', headers: { 'x-forwarded-for': `198.51.100.${ip}` } });
  expect(r.status).toBe(200);
  const b = await r.json() as { token: string };
  const me = await (await app.request('/api/v1/auth/me', { headers: { authorization: `Bearer ${b.token}` } })).json() as any;
  return { token: b.token, userId: me.user.user_id };
}

const xoa = (auth: { token?: string; cookie?: string }, body: unknown) => app.request('/api/v1/account/delete', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(auth.token ? { authorization: `Bearer ${auth.token}` } : {}),
    ...(auth.cookie ? { cookie: auth.cookie } : {}),
  },
  body: JSON.stringify(body),
});

describe('B4 — tài khoản không mật khẩu xoá bằng XOA', () => {
  it('⭐ khách gửi xac_nhan XOA ⇒ 200, users ẩn danh, phiên bị thu hồi', async () => {
    const k = await khachMoi();
    const r = await xoa({ token: k.token }, { xac_nhan: 'XOA' });
    expect(r.status).toBe(200);
    const { rows } = await pool.query(`SELECT handle, deleted_at FROM users WHERE user_id = $1`, [k.userId]);
    expect(rows[0].handle).toMatch(/^da_xoa_[0-9a-f]{12}$/);
    expect(rows[0].deleted_at).not.toBeNull();
    const { rows: acc } = await pool.query(`SELECT 1 FROM auth_accounts WHERE user_id = $1`, [k.userId]);
    expect(acc).toHaveLength(0);
    expect((await app.request('/api/v1/auth/me', { headers: { authorization: `Bearer ${k.token}` } })).status).toBe(401);
  });

  it('khách thiếu xac_nhan (hoặc gõ sai) ⇒ 400 thieu_xac_nhan, tài khoản còn nguyên', async () => {
    const k = await khachMoi();
    for (const body of [{}, { xac_nhan: 'xoa' }, { xac_nhan: 'XOA ' + 'X' }, { password: 'gi-cung-duoc' }]) {
      const r = await xoa({ token: k.token }, body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(((await r.json()) as any).error).toBe('thieu_xac_nhan');
    }
    const { rows } = await pool.query(`SELECT deleted_at FROM users WHERE user_id = $1`, [k.userId]);
    expect(rows[0].deleted_at).toBeNull();
  });

  it('tài khoản Discord (không email, không mật khẩu) đi cùng đường với khách', async () => {
    const u = await createTestUser(pool);
    await pool.query(
      `UPDATE auth_accounts SET email = NULL, password_hash = NULL, email_verified_at = NULL WHERE user_id = $1`, [u.userId]);
    await pool.query(
      `INSERT INTO auth_identities (account_id, provider, provider_user_id)
       SELECT account_id, 'discord', '123456789012345678' FROM auth_accounts WHERE user_id = $1`, [u.userId]);
    expect((await xoa({ cookie: u.cookie }, { xac_nhan: 'XOA' })).status).toBe(200);
    const { rows } = await pool.query(`SELECT 1 FROM auth_identities WHERE provider_user_id = '123456789012345678'`);
    expect(rows).toHaveLength(0);
  });
});

describe('B4 — tài khoản có mật khẩu: XOA không thay được mật khẩu', () => {
  it('⭐ gửi xac_nhan mà không mật khẩu ⇒ 401, tài khoản còn', async () => {
    const u = await createTestUser(pool);
    await pool.query(`UPDATE auth_accounts SET password_hash = $1 WHERE user_id = $2`,
      [await hashPassword('mat-khau-that-123'), u.userId]);
    const r = await xoa({ cookie: u.cookie }, { xac_nhan: 'XOA' });
    expect(r.status).toBe(401);
    expect(((await r.json()) as any).error).toBe('invalid_credentials');
    const { rows } = await pool.query(`SELECT deleted_at FROM users WHERE user_id = $1`, [u.userId]);
    expect(rows[0].deleted_at).toBeNull();
    expect((await xoa({ cookie: u.cookie }, { password: 'mat-khau-that-123' })).status).toBe(200);
  });

  it('không có phiên ⇒ 401 (XOA không phải chìa khoá thay phiên)', async () => {
    expect((await xoa({}, { xac_nhan: 'XOA' })).status).toBe(401);
  });
});
