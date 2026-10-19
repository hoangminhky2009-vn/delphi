/**
 * B9 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — ĐỔI MẬT KHẨU · XOÁ TÀI KHOẢN CÓ TRẦN LẦN THỬ.
 *
 * Hành vi đổi: trước bản vá, ai cầm được một phiên (máy mượn, tab quên đăng xuất) đoán mật khẩu hiện tại KHÔNG giới
 * hạn qua `/account/password` hay `/account/delete` — hai cửa đó là máy dò mật khẩu không trần. Nay chung một xô
 * `mk:<account_id>` (`AUTH.MAT_KHAU_THU`), tiêu suất TRƯỚC khi băm (nếp login: không ai lọt giữa lúc argon2 đang chạy)
 * ⇒ lần vượt trần 429 `rate_limited` + `Retry-After`, KỂ CẢ khi lần đó gõ đúng.
 *
 * Tiêm ngược: bỏ `consumeLimit` ở `/account/password` ⇒ ca đầu đỏ; bỏ ở `/account/delete` ⇒ ca xô chung đỏ.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { hashPassword } from '../server/auth/crypto.js';
import { AUTH } from '../config/auth.js';

const MK = 'mat-khau-dung-123';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function nguoiCoMatKhau(): Promise<TestUser> {
  const u = await createTestUser(pool);
  await pool.query(`UPDATE auth_accounts SET password_hash = $1 WHERE user_id = $2`, [await hashPassword(MK), u.userId]);
  return u;
}

const goi = (u: TestUser, duong: string, body: unknown) => app.request(duong, {
  method: 'POST', headers: { 'content-type': 'application/json', cookie: u.cookie }, body: JSON.stringify(body),
});

describe('B9 — trần lần thử mật khẩu hiện tại', () => {
  it('trần là số kỹ thuật ở config: 5 lần / 15 phút', () => {
    expect(AUTH.MAT_KHAU_THU).toEqual({ MAX: 5, CUA_SO_PHUT: 15 });
  });

  it('⭐ đổi mật khẩu: 5 lần sai ⇒ lần 6 là 429 + Retry-After DÙ gõ đúng', async () => {
    const u = await nguoiCoMatKhau();
    for (let i = 0; i < AUTH.MAT_KHAU_THU.MAX; i++) {
      expect((await goi(u, '/api/v1/account/password', { current_password: 'sai', new_password: 'mat-khau-moi-123' })).status).toBe(401);
    }
    const r = await goi(u, '/api/v1/account/password', { current_password: MK, new_password: 'mat-khau-moi-123' });
    expect(r.status).toBe(429);
    expect(((await r.json()) as any).error).toBe('rate_limited');
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('⭐ xoá tài khoản dùng CHUNG xô: sai ở đổi mật khẩu rồi sang xoá vẫn bị chặn, tài khoản còn', async () => {
    const u = await nguoiCoMatKhau();
    for (let i = 0; i < AUTH.MAT_KHAU_THU.MAX; i++) {
      await goi(u, '/api/v1/account/password', { current_password: 'sai', new_password: 'mat-khau-moi-123' });
    }
    const r = await goi(u, '/api/v1/account/delete', { password: MK });
    expect(r.status).toBe(429);
    const { rows } = await pool.query(`SELECT deleted_at FROM users WHERE user_id = $1`, [u.userId]);
    expect(rows[0].deleted_at).toBeNull();
  });

  it('xoá tài khoản tự tiêu suất: 5 lần sai mật khẩu ở xoá ⇒ lần 6 là 429', async () => {
    const u = await nguoiCoMatKhau();
    for (let i = 0; i < AUTH.MAT_KHAU_THU.MAX; i++) {
      expect((await goi(u, '/api/v1/account/delete', { password: 'sai' })).status).toBe(401);
    }
    expect((await goi(u, '/api/v1/account/delete', { password: MK })).status).toBe(429);
  });

  it('xô theo TÀI KHOẢN: người khác không bị vạ lây', async () => {
    const a = await nguoiCoMatKhau();
    const b = await nguoiCoMatKhau();
    for (let i = 0; i < AUTH.MAT_KHAU_THU.MAX; i++) {
      await goi(a, '/api/v1/account/password', { current_password: 'sai', new_password: 'mat-khau-moi-123' });
    }
    expect((await goi(b, '/api/v1/account/password', { current_password: MK, new_password: 'mat-khau-moi-123' })).status).toBe(200);
  });
});
