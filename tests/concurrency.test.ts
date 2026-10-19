/**
 * GĐ3 VIỆC 4 — Concurrency (nghiệm thu bắt buộc, lặp lại được).
 *
 * Đồ THẬT: Hono app + embedded Postgres, các request bắn song song qua
 * Promise.all — row lock FOR UPDATE trên ví + unique index bet_intents là
 * hai cơ chế được kiểm ở đây. Sau MỖI khối: audit_supply phải CÂN.
 *
 * Ngữ nghĩa declarative cần nhớ khi đọc test: 50 request song song của cùng
 * user không CỘNG DỒN — kết quả cuối phải khớp MỘT thứ tự tuần tự nào đó
 * (linearizable), và tiền không bao giờ sinh/mất ngoài ledger.
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
    secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  admin = await createTestUser(pool, { role: 'admin', bankroll: 0 });
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

const post = async (path: string, cookie: string, body: unknown): Promise<Response> =>
  app.request(path, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

async function expectAuditOk() {
  const report = await auditSupply(pool);
  expect(report.problems).toEqual([]);
}

describe('VIỆC 4 — concurrency', () => {
  it(
    '50 request song song 1 user (40 key khác + 10 CÙNG key): linearizable, ledger khớp, không âm',
    async () => {
      const user = await createTestUser(pool); // 1.000 T, cap 200
      const market = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 3 });
      const opt = market.optionIds[0]!;

      const sharedKey = randomUUID();
      const requests: Promise<Response>[] = [];
      for (let i = 1; i <= 40; i++) {
        requests.push(
          post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, {
            allocations: [{ option_id: opt, amount: i }], // 1..40 — đều dưới cap
            idempotency_key: randomUUID(),
          }),
        );
      }
      for (let i = 0; i < 10; i++) {
        requests.push(
          post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, {
            allocations: [{ option_id: opt, amount: 77 }],
            idempotency_key: sharedKey, // 10 phát CÙNG key cùng body (double-click)
          }),
        );
      }
      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);
      // Mọi response phải là 200 (áp dụng/replay) hoặc 400 no_withdraw (tổng mới
      // nhỏ hơn tổng một request khác đã commit trước) — không được có 5xx
      const bad: unknown[] = [];
      for (const r of responses) {
        if (r.status !== 200 && r.status !== 400) {
          bad.push({ status: r.status, body: await r.json().catch(() => null) });
        }
      }
      expect(bad).toEqual([]);

      // Trạng thái cuối: đúng MỘT dòng bet, amount == một giá trị đã gửi
      const { rows: bets } = await pool.query(
        `SELECT amount FROM bets WHERE user_id = $1 AND market_id = $2 AND NOT is_seed`,
        [user.userId, market.marketId],
      );
      expect(bets).toHaveLength(1);
      const finalBet = bets[0].amount as bigint;
      expect([...Array(40).keys()].map((i) => BigInt(i + 1)).concat([77n])).toContainEqual(finalBet);

      // Tiền khớp tuyệt đối: bankroll + đang đặt == 1.000; ledger cộng dồn đúng
      const { rows: u } = await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [user.userId]);
      expect((u[0].bankroll as bigint) + finalBet).toBe(1000n);
      expect((u[0].bankroll as bigint) >= 0n).toBe(true);

      const { rows: wl } = await pool.query(
        `SELECT COALESCE(SUM(delta), 0) AS s FROM wallet_ledger
          WHERE user_id = $1 AND ref_market_id = $2`,
        [user.userId, market.marketId],
      );
      expect(BigInt(wl[0].s)).toBe(-finalBet);

      // 10 phát cùng key: hiệu lực đúng 1 lần — tổng số bút toán của kèo này
      // phải ≤ số lần tổng-tăng thực sự (không thể có 2 bút toán cùng một key)
      const { rows: intents } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM bet_intents WHERE idempotency_key = $1`,
        [sharedKey],
      );
      expect(intents[0].n).toBe(1);

      await expectAuditOk();
    },
    120_000,
  );

  it(
    'double-spend chéo kèo: bankroll 10.000, 2 lệnh 2.000 song song 2 kèo → đúng 1 thành công',
    async () => {
      const rich = await createTestUser(pool, { bankroll: 10_000 }); // cap 2.000
      const m1 = await createTestMarket(pool, { createdBy: admin.userId });
      const m2 = await createTestMarket(pool, { createdBy: admin.userId });

      const [r1, r2] = await Promise.all([
        post(`/api/v1/markets/${m1.marketId}/bets`, rich.cookie, {
          allocations: [{ option_id: m1.optionIds[0]!, amount: 2000 }],
          idempotency_key: randomUUID(),
        }),
        post(`/api/v1/markets/${m2.marketId}/bets`, rich.cookie, {
          allocations: [{ option_id: m2.optionIds[0]!, amount: 2000 }],
          idempotency_key: randomUUID(),
        }),
      ]);
      const oks = [r1.status, r2.status].filter((s) => s === 200).length;
      // Lệnh sau nhìn bankroll 8.000 → cap 1.600 < 2.000 → cap_exceeded
      expect(oks).toBe(1);

      const { rows: u } = await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [rich.userId]);
      expect(u[0].bankroll as bigint).toBe(8000n);

      await expectAuditOk();
    },
    60_000,
  );

  it(
    '200 user song song vào 1 kèo: tổng pool = Σ amount + seed, aggregate khớp bets, audit CÂN',
    async () => {
      const market = await createTestMarket(pool, {
        createdBy: admin.userId,
        optionCount: 3,
        seedPerOption: 100, // 300 seed từ Kho bạc
      });
      const users = await Promise.all(
        Array.from({ length: 200 }, () => createTestUser(pool)),
      );

      let expectedPlayerTotal = 0n;
      const responses = await Promise.all(
        users.map((u, i) => {
          const amount = (i % 150) + 1; // 1..150, đều dưới cap 200
          expectedPlayerTotal += BigInt(amount);
          const option = market.optionIds[i % 3]!;
          return post(`/api/v1/markets/${market.marketId}/bets`, u.cookie, {
            allocations: [{ option_id: option, amount }],
            idempotency_key: randomUUID(),
          });
        }),
      );
      expect(responses.every((r) => r.status === 200)).toBe(true);

      const { rows: agg } = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS total,
                COALESCE(SUM(amount) FILTER (WHERE NOT is_seed), 0) AS player_total,
                COUNT(DISTINCT user_id) FILTER (WHERE NOT is_seed)::int AS participants
           FROM bets WHERE market_id = $1`,
        [market.marketId],
      );
      expect(BigInt(agg[0].player_total)).toBe(expectedPlayerTotal);
      expect(BigInt(agg[0].total)).toBe(expectedPlayerTotal + 300n);
      expect(agg[0].participants).toBe(200);

      // Σ trừ ví của 200 user == tổng token người chơi trong pool
      const { rows: wl } = await pool.query(
        `SELECT COALESCE(SUM(delta), 0) AS s FROM wallet_ledger WHERE ref_market_id = $1`,
        [market.marketId],
      );
      expect(BigInt(wl[0].s)).toBe(-expectedPlayerTotal);

      await expectAuditOk();
    },
    180_000,
  );

  it(
    'biên lock_ts: trước giờ khóa đặt được, sau giờ khóa bị 409 (giờ SERVER trong DB)',
    async () => {
      const user = await createTestUser(pool);
      const market = await createTestMarket(pool, { createdBy: admin.userId, lockInSeconds: 2 });

      await new Promise((r) => setTimeout(r, 1_000)); // canh đúng mốc spec: TRƯỚC lock ~1s
      const before = await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, {
        allocations: [{ option_id: market.optionIds[0]!, amount: 10 }],
        idempotency_key: randomUUID(),
      });
      expect(before.status).toBe(200);

      await new Promise((r) => setTimeout(r, 2_000)); // giờ là SAU lock ~1s

      const after = await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, {
        allocations: [{ option_id: market.optionIds[0]!, amount: 20 }],
        idempotency_key: randomUUID(),
      });
      expect(after.status).toBe(409);
      expect(((await after.json()) as any).error).toBe('market_locked');

      await expectAuditOk();
    },
    30_000,
  );
});
