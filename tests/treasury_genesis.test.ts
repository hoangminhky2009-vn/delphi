/**
 * VÁ D10 — test Kho bạc genesis:
 * (a) genesis lần 2 bị chặn (idempotent + unique index);
 * (b) chi vượt số dư Kho bạc → transaction fail sạch, không side effect;
 * (c) seed dev đầy đủ → audit CÂN, Kho bạc = 20.000 − 1.100 = 18.900.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { bootstrapGenesis } from '../scripts/bootstrap_genesis.js';
import { seedDev } from '../scripts/seed_dev.js';
import { auditSupply } from '../scripts/audit_supply.js';
import { treasuryAppend } from '../server/treasury.js';
import { ECONOMY } from '../config/economy.js';

let db: TestDb;
let pool: pg.Pool;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
});

afterAll(async () => {
  await db?.stop();
});

describe('D10 — Kho bạc genesis', () => {
  it('genesis lần 1 tạo đúng 20.000 T; lần 2 bị bỏ qua, DB không đổi', async () => {
    expect(await bootstrapGenesis(pool)).toBe('created');
    expect(await bootstrapGenesis(pool)).toBe('skipped');

    const { rows } = await pool.query(
      `SELECT delta, balance_after FROM treasury_ledger WHERE reason = 'genesis_grant'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].delta).toBe(BigInt(ECONOMY.TREASURY_GENESIS));
    expect(rows[0].balance_after).toBe(BigInt(ECONOMY.TREASURY_GENESIS));
  });

  it('chèn tay dòng genesis thứ hai → unique index chặn', async () => {
    await expect(
      pool.query(
        `INSERT INTO treasury_ledger (delta, balance_after, reason)
         VALUES (1, ${ECONOMY.TREASURY_GENESIS + 1}, 'genesis_grant')`,
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it('balance_after âm bị CHECK chặn ở tầng DB', async () => {
    await expect(
      pool.query(
        `INSERT INTO treasury_ledger (delta, balance_after, reason) VALUES (-1, -1, 'seed_out')`,
      ),
    ).rejects.toThrow(/balance_after/);
  });

  it('mở kèo với seed vượt số dư Kho bạc → transaction fail sạch, không side effect', async () => {
    const marketsBefore = await pool.query('SELECT count(*)::int AS n FROM markets');
    const treasuryBefore = await pool.query('SELECT count(*)::int AS n FROM treasury_ledger');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // tạo admin + kèo + seed trong cùng transaction như luồng "mở kèo" GĐ4
      const admin = await client.query(
        `INSERT INTO users (handle, age_band, region, occupation_band, role, season_id)
         VALUES ('admin_fail_test', '18-22', 'bac', 'khac', 'admin', '2026Q3')
         RETURNING user_id`,
      );
      const m = await client.query(
        `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url,
                              open_ts, lock_ts, resolve_deadline_ts, status, seed_per_option, season_id, created_by)
         VALUES ('macro', 'Kèo seed vượt quỹ?', 'GSO', 'https://gso.gov.vn',
                 now(), now() + interval '1 day', now() + interval '2 days', 'open',
                 1000000, '2026Q3', $1)
         RETURNING market_id`,
        [admin.rows[0].user_id],
      );
      // rút 1.000.000 T khi Kho bạc chỉ có 20.000 → phải ném lỗi
      await expect(
        treasuryAppend(client, -1_000_000n, 'seed_out', m.rows[0].market_id),
      ).rejects.toThrow(/Kho bạc không đủ/);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }

    // không side effect: số dòng markets/treasury_ledger y nguyên, user test không tồn tại
    const marketsAfter = await pool.query('SELECT count(*)::int AS n FROM markets');
    const treasuryAfter = await pool.query('SELECT count(*)::int AS n FROM treasury_ledger');
    expect(marketsAfter.rows[0].n).toBe(marketsBefore.rows[0].n);
    expect(treasuryAfter.rows[0].n).toBe(treasuryBefore.rows[0].n);
    const ghost = await pool.query(`SELECT 1 FROM users WHERE handle = 'admin_fail_test'`);
    expect(ghost.rowCount).toBe(0);
  });
});

describe('D10 — seed dev + audit trên DB trắng thứ hai', () => {
  let db2: TestDb;

  beforeAll(async () => {
    db2 = await startTestDb();
  });

  afterAll(async () => {
    await db2?.stop();
  });

  it('seed:dev (tự chạy genesis trước) → audit CÂN, Kho bạc = 18.900', async () => {
    await seedDev(db2.pool);
    const report = await auditSupply(db2.pool);
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.numbers['Vốn genesis Kho bạc (D10)']).toBe('20000');
    // 3 kèo: 4 + 3 + 4 cửa × 100 T seed = 1.100 T đã rút
    expect(report.numbers['Kho bạc']).toBe('18900');
  });
});
