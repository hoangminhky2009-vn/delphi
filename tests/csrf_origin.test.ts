/**
 * B7 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — CHẶN GHI CHÉO TRANG THEO `Origin` / `Sec-Fetch-Site`.
 *
 * Hành vi đổi: trước bản vá, chống CSRF chỉ dựa vào cookie `SameSite=Lax` — đủ cho trình duyệt hiện đại, nhưng là MỘT lớp: một
 * trình duyệt cũ, một cấu hình cookie bị nới (vd. `SameSite=None` cho iframe Discord) là trang lạ POST được kèm phiên người dùng.
 * Nay `/api/*` với method ghi (≠ GET/HEAD/OPTIONS): `Origin` có mà không thuộc danh sách (CORS `ALLOWED_ORIGIN` + gốc của
 * `APP_BASE_URL` + `https://<DISCORD_CLIENT_ID>.discordsays.com`) ⇒ 403 `origin_la`; `Sec-Fetch-Site: cross-site` ⇒ 403. Không có
 * cả hai header (cron · curl · script) ⇒ qua — CSRF cần trình duyệt, mà trình duyệt luôn gửi ít nhất một trong hai cho POST.
 * Chặn TRƯỚC route: lượt bị chặn không tiêu suất đăng nhập, không chạy argon2.
 *
 * Tiêm ngược: bỏ nhánh Origin ⇒ ca Origin lạ đỏ · bỏ nhánh Sec-Fetch-Site ⇒ ca cross-site đỏ · bỏ miễn GET ⇒ ca GET đỏ.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';

const WEB = 'https://dubao.test';
const DISCORD_ID = '123456789012345678';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://email-link.test', allowedOrigin: WEB,
    tickSecret: 'tick-csrf', secureCookie: false, discordClientId: DISCORD_ID,
  }) as Hono<any>;
}, 120_000);

afterAll(async () => { await db?.stop(); });

const demThu = async (email: string): Promise<number> =>
  (await pool.query(`SELECT count(*)::int AS n FROM auth_attempts WHERE bucket = $1`, [`login:email:${email}`])).rows[0].n;

const dangNhap = (email: string, headers: Record<string, string>) => app.request('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify({ email, password: 'mat-khau-bat-ky-123' }),
});

describe('B7 — POST từ gốc lạ bị chặn trước route', () => {
  it('⭐ Origin lạ ⇒ 403 origin_la, không tiêu suất đăng nhập', async () => {
    const email = 'la@dubao.test';
    const r = await dangNhap(email, { origin: 'https://ke-xau.example' });
    expect(r.status).toBe(403);
    const b = await r.json() as { error: string; message: string };
    expect(b.error).toBe('origin_la');
    expect(typeof b.message).toBe('string');
    expect(await demThu(email)).toBe(0);
  });

  it('⭐ Sec-Fetch-Site: cross-site (không Origin) ⇒ 403', async () => {
    const r = await dangNhap('cheo@dubao.test', { 'sec-fetch-site': 'cross-site' });
    expect(r.status).toBe(403);
    expect((await r.json() as any).error).toBe('origin_la');
  });

  it('Activity của app KHÁC trên discordsays.com ⇒ 403 (chỉ đúng client id của mình)', async () => {
    const r = await dangNhap('dc-la@dubao.test', { origin: 'https://999999999999999999.discordsays.com' });
    expect(r.status).toBe(403);
  });

  it('tên miền mạo danh có đuôi gốc thật ⇒ 403', async () => {
    const r = await dangNhap('mao@dubao.test', { origin: `${WEB}.ke-xau.example` });
    expect(r.status).toBe(403);
  });
});

describe('B7 — đường hợp lệ vẫn qua (tới route: email lạ ⇒ 401)', () => {
  for (const [ten, headers] of [
    ['Origin = ALLOWED_ORIGIN', { origin: WEB, 'sec-fetch-site': 'same-origin' }],
    ['Origin = gốc APP_BASE_URL', { origin: 'https://email-link.test' }],
    ['Origin = Activity Discord của app', { origin: `https://${DISCORD_ID}.discordsays.com` }],
    ['không Origin, không Sec-Fetch-Site (cron · curl)', {}],
    ['Sec-Fetch-Site: same-site', { 'sec-fetch-site': 'same-site' }],
  ] as Array<[string, Record<string, string>]>) {
    it(ten, async () => {
      const r = await dangNhap(`hop-le-${ten.length}@dubao.test`, headers);
      expect(r.status).toBe(401);
    });
  }

  it('GET không bị chặn dù Origin lạ (chỉ chặn method ghi)', async () => {
    const r = await app.request('/api/v1/health', { headers: { origin: 'https://ke-xau.example', 'sec-fetch-site': 'cross-site' } });
    expect(r.status).not.toBe(403);
  });
});
