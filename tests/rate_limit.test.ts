/**
 * Rate limit — test HỒI QUY cho lỗ hổng TOCTOU phát hiện 19/07/2026.
 *
 * Lỗ hổng: `checkLimit()` chỉ SELECT count rồi trả về; caller gọi
 * `recordAttempt()` là câu lệnh RIÊNG. Giữa hai câu đó, N request song song
 * cùng đọc một con số cũ và cùng được cho qua.
 *
 * Đo được trước khi vá (trần 5): tuần tự 20 → lọt 5 ✔ · SONG SONG 20 → lọt 16 ✘
 *
 * Test này chạy ĐÚNG kịch bản đó. Nếu ai đó sau này tách lại thành
 * "kiểm rồi mới ghi", test sẽ đỏ ngay.
 *
 * Chạy nhiều VÒNG vì lỗi đồng thời hay lọt qua một lần chạy may mắn.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { consumeLimit, countAttempts, clearAttempts } from '../server/auth/rate_limit.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { AUTH } from '../config/auth.js';

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
    tickSecret: 'tick-secret-cho-test-ratelimit',
    secureCookie: false,
  }) as Hono<any>;
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

describe('consumeLimit — nguyên tử dưới đồng thời', () => {
  it('20 request SONG SONG, trần 5 → ĐÚNG 5 lọt (kịch bản đã phá được bản cũ)', async () => {
    for (let round = 0; round < 10; round += 1) {
      const bucket = `song_song:${round}`;
      const results = await Promise.all(
        Array.from({ length: 20 }, () => consumeLimit(pool, bucket, 5, 60)),
      );
      const passed = results.filter((r) => r.allowed).length;
      expect(passed, `vòng ${round}: lọt ${passed}, phải là 5`).toBe(5);

      // Và sổ chỉ ghi đúng 5 lần — không ghi cho request bị từ chối.
      expect(await countAttempts(pool, bucket, 60)).toBe(5);
    }
  });

  it('tuần tự vẫn đúng như cũ', async () => {
    const bucket = 'tuan_tu';
    let passed = 0;
    for (let i = 0; i < 20; i += 1) {
      if ((await consumeLimit(pool, bucket, 5, 60)).allowed) passed += 1;
    }
    expect(passed).toBe(5);
  });

  it('bucket khác nhau không ảnh hưởng nhau (khoá theo bucket, không khoá toàn cục)', async () => {
    const res = await Promise.all([
      ...Array.from({ length: 10 }, () => consumeLimit(pool, 'A', 3, 60)),
      ...Array.from({ length: 10 }, () => consumeLimit(pool, 'B', 3, 60)),
    ]);
    expect(res.filter((r) => r.allowed).length).toBe(6); // 3 + 3
  });

  it('clearAttempts trả lại toàn bộ suất', async () => {
    const bucket = 'xoa';
    for (let i = 0; i < 5; i += 1) await consumeLimit(pool, bucket, 5, 60);
    expect((await consumeLimit(pool, bucket, 5, 60)).allowed).toBe(false);
    await clearAttempts(pool, bucket);
    expect((await consumeLimit(pool, bucket, 5, 60)).allowed).toBe(true);
  });

  it('cửa sổ thời gian: lần thử cũ hơn cửa sổ không còn tính', async () => {
    const bucket = 'cua_so';
    for (let i = 0; i < 5; i += 1) await consumeLimit(pool, bucket, 5, 60);
    expect((await consumeLimit(pool, bucket, 5, 60)).allowed).toBe(false);
    // Đẩy mọi lần thử về quá khứ xa hơn cửa sổ.
    await pool.query(`UPDATE auth_attempts SET at = at - interval '2 hours' WHERE bucket = $1`, [bucket]);
    expect((await consumeLimit(pool, bucket, 5, 60)).allowed).toBe(true);
  });
});

describe('Rate limit qua HTTP — đường code production', () => {
  it('đăng ký song song từ CÙNG một IP không vượt được trần', async () => {
    const ip = '203.0.113.77';
    const attempts = Array.from({ length: 20 }, (_, i) =>
      app.request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({
          email: `song_song_${i}@test.local`,
          password: 'matkhaudumanh1',
          birth_year: 2005,
        }),
      }));
    const res = await Promise.all(attempts);
    const rateLimited = res.filter((r) => r.status === 429).length;
    const notLimited = res.length - rateLimited;

    // Trần là REGISTER_MAX_PER_IP; mọi request còn lại PHẢI bị 429.
    expect(notLimited).toBeLessThanOrEqual(AUTH.REGISTER_MAX_PER_IP);
    expect(rateLimited).toBeGreaterThanOrEqual(20 - AUTH.REGISTER_MAX_PER_IP);
  });

  it('đăng nhập sai song song cùng email không vượt được trần', async () => {
    // Bản cũ: cả loạt chui lọt trong lúc argon2 đang băm (~100ms) vì chưa ai
    // kịp ghi lỗi nào. Nay suất bị tiêu TRƯỚC khi verify.
    const email = 'nan_nhan@test.local';
    const res = await Promise.all(
      Array.from({ length: 20 }, () =>
        app.request('http://localhost/api/v1/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password: 'sai_mat_khau_hoan_toan' }),
        })),
    );
    const notLimited = res.filter((r) => r.status !== 429).length;
    expect(notLimited).toBeLessThanOrEqual(AUTH.LOGIN_MAX_FAILS);
  });

  it('đăng nhập ĐÚNG xoá sạch bucket → người dùng thật không bị vạ lây', async () => {
    // Dựng một tài khoản thật đã xác minh email.
    const email = 'nguoi_that@test.local';
    const password = 'matkhaudumanh1';
    await app.request('http://localhost/api/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.9' },
      body: JSON.stringify({ email, password, birth_year: 2004 }),
    });
    await pool.query(
      `UPDATE auth_accounts SET email_verified_at = now() WHERE email = $1`, [email]);

    // Gõ sai vài lần (chưa chạm trần), rồi gõ đúng.
    for (let i = 0; i < AUTH.LOGIN_MAX_FAILS - 1; i += 1) {
      await app.request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'sai_roi' }),
      });
    }
    const ok = await app.request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(ok.status).toBe(200);

    // Bucket đã sạch: gõ sai tiếp vẫn còn nguyên hạn mức, không bị khoá oan.
    const after = await app.request('http://localhost/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'sai_lai' }),
    });
    expect(after.status).toBe(401);
  });
});
