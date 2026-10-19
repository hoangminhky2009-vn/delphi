/**
 * B6 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — GỠ LIÊN KẾT DISCORD: `POST /api/v1/auth/discord/go`.
 *
 * Hành vi đổi: trước bản vá, Discord gắn vào tài khoản là gắn vĩnh viễn — không route nào gỡ (SPEC pháp lý D2 hứa xoá được định
 * danh ngoài). Nay người có mật khẩu gỡ được (gõ lại mật khẩu: phiên bị mượn không đủ để cắt một đường đăng nhập); tài khoản CHỈ
 * có Discord thì 409 `khong_con_duong_dang_nhap` — gỡ là tự khoá mình ngoài tài khoản (lối ra của họ là xoá tài khoản, B4).
 * Gỡ rồi đăng nhập Discord lại khi đang có phiên ⇒ gắn lại vào CHÍNH tài khoản đó, không đẻ tài khoản thứ hai (`events` rẽ đôi
 * là vĩnh viễn — D64 luật 3).
 *
 * Tiêm ngược: bỏ kiểm mật khẩu ⇒ ca sai mật khẩu đỏ · bỏ nhánh "không mật khẩu" ⇒ ca 409 đỏ · bỏ câu DELETE ⇒ ca gỡ đỏ.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { timHoacTao } from '../server/discord.js';
import { createSession } from '../server/auth/session.js';
import { hashPassword } from '../server/auth/crypto.js';
import { AUTH } from '../config/auth.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser } from './helpers/fixtures.js';

const MK = 'mat-khau-dung-0123';
let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
}, 120_000);

afterAll(async () => { await db?.stop(); });

const go = (cookie: string, body: unknown) => app.request('/api/v1/auth/discord/go', {
  method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify(body),
});
const soDanhTinh = async (accountId: string): Promise<number> =>
  (await pool.query(`SELECT count(*)::int AS n FROM auth_identities WHERE account_id = $1 AND provider = 'discord'`, [accountId])).rows[0].n;

/** Tài khoản email CÓ MẬT KHẨU THẬT (argon2) đã gắn Discord `dcId`. */
async function emailCoDiscord(dcId: string) {
  const u = await createTestUser(pool);
  const { rows } = await pool.query(
    `UPDATE auth_accounts SET password_hash = $2 WHERE user_id = $1 RETURNING account_id`, [u.userId, await hashPassword(MK)]);
  const accountId = rows[0].account_id as string;
  const kq = await timHoacTao(pool, { id: dcId, ten: 'nguoi_thu' }, { seasonId: '2026Q4', accountHienTai: accountId });
  expect(kq.accountId).toBe(accountId);
  return { ...u, accountId };
}

describe('B6 — gỡ Discord', () => {
  it('⭐ sai mật khẩu ⇒ 401, liên kết còn nguyên', async () => {
    const u = await emailCoDiscord('dc-go-1');
    const r = await go(u.cookie, { password: 'sai-mat-khau-999' });
    expect(r.status).toBe(401);
    expect((await r.json() as any).error).toBe('invalid_credentials');
    expect(await soDanhTinh(u.accountId)).toBe(1);
  });

  it('⭐ đúng mật khẩu ⇒ gỡ; đăng nhập Discord lại khi có phiên ⇒ gắn lại CHÍNH tài khoản, không tài khoản thứ hai', async () => {
    const u = await emailCoDiscord('dc-go-2');
    const r = await go(u.cookie, { password: MK });
    expect(r.status).toBe(200);
    expect(await soDanhTinh(u.accountId)).toBe(0);

    const soUser = async () => (await pool.query(`SELECT count(*)::int AS n FROM users`)).rows[0].n as number;
    const truoc = await soUser();
    const lai = await timHoacTao(pool, { id: 'dc-go-2', ten: 'nguoi_thu' }, { seasonId: '2026Q4', accountHienTai: u.accountId });
    expect(lai.accountId).toBe(u.accountId);
    expect(lai.moi).toBe(false);
    expect(await soUser()).toBe(truoc);
    expect(await soDanhTinh(u.accountId)).toBe(1);
  });

  it('⭐ tài khoản CHỈ có Discord (không mật khẩu) ⇒ 409 khong_con_duong_dang_nhap, liên kết còn', async () => {
    const kq = await timHoacTao(pool, { id: 'dc-go-3', ten: 'chi_discord' }, { seasonId: '2026Q4' });
    const cookie = `${AUTH.SESSION_COOKIE}=${await createSession(pool, kq.accountId)}`;
    const r = await go(cookie, { password: 'gi-cung-duoc-1' });
    expect(r.status).toBe(409);
    expect((await r.json() as any).error).toBe('khong_con_duong_dang_nhap');
    expect(await soDanhTinh(kq.accountId)).toBe(1);
  });

  it('chưa gắn Discord ⇒ 404 chua_lien_ket_discord', async () => {
    const u = await createTestUser(pool);
    const r = await go(u.cookie, { password: MK });
    expect(r.status).toBe(404);
    expect((await r.json() as any).error).toBe('chua_lien_ket_discord');
  });

  it('chưa đăng nhập ⇒ 401', async () => {
    const r = await app.request('/api/v1/auth/discord/go', { method: 'POST', body: '{}' });
    expect(r.status).toBe(401);
  });
});
