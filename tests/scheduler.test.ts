/**
 * GĐ4 VIỆC 2 — Scheduler: khóa kèo đúng giờ + tự hủy quá hạn nguồn (A3.2, C3).
 * Gọi qua /internal/tick như production (lớp 2 D11); mọi bước idempotent.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, createTestMarket, ensureGenesis, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { auditSupply } from '../scripts/audit_supply.js';

const TICK_SECRET = 'tick-secret-scheduler-test';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let admin: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool,
    mailer: new CapturingMailer(),
    appBaseUrl: 'https://dubao.test',
    tickSecret: TICK_SECRET,
    secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  admin = await createTestUser(pool, { role: 'admin', bankroll: 0 });
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

const tick = async (): Promise<any> => {
  const res = await app.request('/api/v1/internal/tick', {
    method: 'POST',
    headers: { 'x-tick-secret': TICK_SECRET },
  });
  expect(res.status).toBe(200);
  return res.json();
};

const bet = async (u: TestUser, marketId: string, optionId: string, amount: number) =>
  app.request(`/api/v1/markets/${marketId}/bets`, {
    method: 'POST',
    headers: { cookie: u.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ allocations: [{ option_id: optionId, amount }], idempotency_key: randomUUID() }),
  });

describe('khóa kèo đúng giờ (C3 — kể cả 0 người online)', () => {
  it('kèo quá lock_ts → tick chuyển locked; đặt thêm bị 409; tick lần 2 khớp 0 dòng', async () => {
    const user = await createTestUser(pool);
    const m = await createTestMarket(pool, { createdBy: admin.userId, lockInSeconds: -5 });

    const r1 = await tick();
    expect(r1.scheduler.locked).toBeGreaterThanOrEqual(1);

    const { rows } = await pool.query(`SELECT status FROM markets WHERE market_id = $1`, [m.marketId]);
    expect(rows[0].status).toBe('locked');

    const betRes = await bet(user, m.marketId, m.optionIds[0]!, 10);
    expect(betRes.status).toBe(409);

    const r2 = await tick();
    expect(r2.scheduler.locked).toBe(0); // idempotent
  });

  it('kèo CHƯA tới giờ khóa → tick không đụng', async () => {
    const m = await createTestMarket(pool, { createdBy: admin.userId, lockInSeconds: 3600 });
    await tick();
    const { rows } = await pool.query(`SELECT status FROM markets WHERE market_id = $1`, [m.marketId]);
    expect(rows[0].status).toBe('open');
  });
});

describe('tự hủy kèo quá hạn nguồn 7 ngày (A3.2)', () => {
  it('deadline + 7 ngày đã qua → tick tự hủy, hoàn 100%, seed về Kho bạc, ghi lý do', async () => {
    const user = await createTestUser(pool);
    const m = await createTestMarket(pool, { createdBy: admin.userId, seedPerOption: 50 });
    const betRes = await bet(user, m.marketId, m.optionIds[0]!, 100);
    expect(betRes.status).toBe(200);

    // Đẩy kèo về quá khứ: deadline + 7 ngày + 1 phút đã trôi qua
    await pool.query(
      `UPDATE markets SET open_ts = now() - interval '20 days',
                          lock_ts = now() - interval '9 days',
                          resolve_deadline_ts = now() - interval '8 days'
        WHERE market_id = $1`,
      [m.marketId],
    );

    const r = await tick();
    expect(r.scheduler.cancelled).toContain(m.marketId);

    const { rows: mk } = await pool.query(
      `SELECT status, resolution_note FROM markets WHERE market_id = $1`,
      [m.marketId],
    );
    expect(mk[0].status).toBe('cancelled');
    expect(mk[0].resolution_note).toContain('7 ngày');

    // Hoàn đủ 100%
    const { rows: u } = await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [user.userId]);
    expect(u[0].bankroll as bigint).toBe(1000n);
    // Seed về Kho bạc nguyên vẹn
    const { rows: tl } = await pool.query(
      `SELECT reason, delta FROM treasury_ledger WHERE ref_market_id = $1 ORDER BY entry_id`,
      [m.marketId],
    );
    expect(tl.map((r2) => [r2.reason, Number(r2.delta)])).toEqual([
      ['seed_out', -150], ['seed_return', 150],
    ]);

    // Idempotent: tick lần 2 không hủy lại
    const r2 = await tick();
    expect(r2.scheduler.cancelled).not.toContain(m.marketId);

    const report = await auditSupply(pool);
    expect(report.problems).toEqual([]);
  });

  it('kèo resolved rồi thì không bị scheduler đụng dù quá deadline', async () => {
    const m = await createTestMarket(pool, { createdBy: admin.userId });
    await pool.query(
      `UPDATE markets SET status = 'locked', open_ts = now() - interval '20 days',
                          lock_ts = now() - interval '9 days',
                          resolve_deadline_ts = now() - interval '8 days'
        WHERE market_id = $1`,
      [m.marketId],
    );
    const { resolveMarket } = await import('../server/resolve.js');
    await resolveMarket(pool, { marketId: m.marketId, outcomeOptionId: m.optionIds[0]!, resolutionNote: 'kịp' });
    const r = await tick();
    expect(r.scheduler.cancelled).not.toContain(m.marketId);
    const { rows } = await pool.query(`SELECT status FROM markets WHERE market_id = $1`, [m.marketId]);
    expect(rows[0].status).toBe('resolved');
  });
});
