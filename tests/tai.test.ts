/**
 * ĐO TẢI (D106 §6 bước 1) — /health khai pool + p95 /rounds; đo thật sau một cú nộp
 * vòng; cửa sổ 60 s; chưa mẫu ⇒ null (không bịa 0).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { ghiDoTreRounds, p95Rounds, xoaMauDoTre } from '../server/tai.js';

// D444: /health gọn thân trừ khi header này khớp — cần tickSecret để đọc `tai`.
const TICK = 'tick-secret-tai-test';
const hdrTick = { 'x-tick-secret': TICK };

let db: TestDb; let pool: pg.Pool; let app: Hono<any>; let user: TestUser;
beforeAll(async () => {
  db = await startTestDb(); pool = db.pool;
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false, tickSecret: TICK }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);
afterAll(async () => { await db?.stop(); });

describe('p95Rounds — thuần', () => {
  it('chưa mẫu ⇒ null; 20 mẫu 1..20 ⇒ p95 = 20; mẫu quá 60 s rơi khỏi cửa sổ', () => {
    xoaMauDoTre();
    expect(p95Rounds(1_000_000)).toEqual({ p95_ms: null, n: 0 });
    for (let i = 1; i <= 20; i += 1) ghiDoTreRounds(i, 1_000_000);
    expect(p95Rounds(1_000_000)).toEqual({ p95_ms: 20, n: 20 });
    expect(p95Rounds(1_000_000 + 61_000)).toEqual({ p95_ms: null, n: 0 });
    xoaMauDoTre();
  });
});

describe('/health.tai', () => {
  it('khai pool + rounds_60s; sau một cú /rounds thật thì n ≥ 1', async () => {
    xoaMauDoTre();
    const h0 = await (await app.request('http://localhost/api/v1/health', { headers: hdrTick })).json() as any;
    expect(h0.tai.pool).toMatchObject({ total: expect.any(Number), idle: expect.any(Number), waiting: expect.any(Number) });
    expect(h0.tai.rounds_60s).toEqual({ p95_ms: null, n: 0 });
    const hdr = { 'content-type': 'application/json', cookie: user.cookie };
    const tao = await (await app.request('http://localhost/api/v1/holdem/matches', { method: 'POST', headers: hdr, body: '{}' })).json() as any;
    const r = await app.request(`http://localhost/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST', headers: hdr,
      body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [] }),
    });
    expect(r.status).toBe(200);
    const h1 = await (await app.request('http://localhost/api/v1/health', { headers: hdrTick })).json() as any;
    expect(h1.tai.rounds_60s.n).toBeGreaterThanOrEqual(1);
    expect(h1.tai.rounds_60s.p95_ms).toBeGreaterThan(0);
  });
});
