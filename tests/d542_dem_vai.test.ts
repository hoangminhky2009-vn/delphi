/**
 * D542 (founder 06/10: *"phần role thì lộ ngay đầu trận rồi, đầu trận chỉ nên báo là 'Trận có X role (icon)(số)'"*) — BÀN TẬP cũng giấu vai từng
 * ghế như trận thật (D530 từng miễn), và mọi trận có vai gửi `dem_vai`: số ghế KHÁC theo vai — biết bàn có bao nhiêu tay to, không biết ai.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

describe('D542 — số vai thay cho vai từng ghế', () => {
  let db: TestDb; let pool: pg.Pool; let app: Hono<any>; let tester: TestUser;
  beforeAll(async () => {
    db = await startTestDb(); pool = db.pool;
    app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
    tester = await createTestUser(pool, { role: 'admin' });
    await pool.query('UPDATE users SET la_tester = true WHERE user_id = $1', [tester.userId]);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });
  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie: tester.cookie, ...(init.headers ?? {}) },
  })).json();

  it('⭐ bàn tập (khoá mặc định) ⇒ không ghế nào lộ vai; `dem_vai` khớp đúng số ghế mang từng vai', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ tap: true }) });
    expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
    const doiThu = t.doi_thu as any[];
    expect(doiThu.every((d) => d.vai === undefined), 'bàn tập vẫn lộ vai từng ghế').toBe(true);
    expect(doiThu.filter((d) => d.vai_an === true).length).toBeGreaterThan(0);
    const dem = t.dem_vai as Record<string, number>;
    expect(Object.values(dem).reduce((a, b) => a + b, 0)).toBe(doiThu.filter((d) => d.vai_an === true).length);
    // Bàn tập dựng đủ ba vai lớn (D527) — số phải nói ra được điều đó.
    expect((dem.ca_map ?? 0) + (dem.doi_lai ?? 0) + (dem.to_chuc ?? 0)).toBeGreaterThan(0);
  }, 300_000);

  it('khoá cũ v58 (lộ vai) vẫn lộ như cũ và cũng có `dem_vai` khớp với vai đã lộ', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v58-xenke' }) });
    const doiThu = t.doi_thu as any[];
    const dem: Record<string, number> = {};
    for (const d of doiThu) if (typeof d.vai === 'string') dem[d.vai] = (dem[d.vai] ?? 0) + 1;
    expect(t.dem_vai).toEqual(dem);
  }, 120_000);
});
