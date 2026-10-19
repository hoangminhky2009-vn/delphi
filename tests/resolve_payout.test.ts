/**
 * GĐ4 VIỆC 3 — Engine resolve/payout: test TRƯỚC theo A5.2 (A8.3).
 * Đường đầy đủ: user thật đặt cược qua API (GĐ3) → khóa kèo → resolve engine
 * → soi TỪNG bút toán wallet/treasury/burn + scores/rank + audit CÂN.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, createTestMarket, ensureGenesis, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { resolveMarket, cancelMarket, updateScoresAndRanks } from '../server/resolve.js';
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

/** Nâng vốn qua admin_adjust — mint hợp lệ trong audit (Bất biến A). */
async function boost(u: TestUser, to: number): Promise<void> {
  const { rows } = await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [u.userId]);
  const delta = BigInt(to) - (rows[0].bankroll as bigint);
  if (delta === 0n) return;
  await pool.query(`UPDATE users SET bankroll = $1 WHERE user_id = $2`, [to, u.userId]);
  await pool.query(
    `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
     VALUES ($1, $2, $3, 'admin_adjust')`,
    [u.userId, delta.toString(), to],
  );
}

const bet = async (
  u: TestUser,
  marketId: string,
  allocs: { option_id: string; amount: number }[],
) => {
  const res = await app.request(`/api/v1/markets/${marketId}/bets`, {
    method: 'POST',
    headers: { cookie: u.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ allocations: allocs, idempotency_key: randomUUID() }),
  });
  expect(res.status).toBe(200);
};

const lockMarket = (marketId: string) =>
  pool.query(`UPDATE markets SET status = 'locked' WHERE market_id = $1`, [marketId]);

const bankrollOf = async (u: TestUser): Promise<bigint> =>
  (await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [u.userId])).rows[0].bankroll;

const expectAuditOk = async () => {
  const report = await auditSupply(pool);
  expect(report.problems).toEqual([]);
};

describe('Vector 1 — resolve end-to-end, soi từng bút toán (nghiệm thu GĐ4)', () => {
  it('A 200@X thua; B 300@Y, C 500@Y thắng → 356/593, burn 30+1, treasury +20', async () => {
    const [A, B, C] = [await createTestUser(pool), await createTestUser(pool), await createTestUser(pool)];
    for (const u of [A, B, C]) await boost(u, 5000); // cap 20% đủ rộng cho mức cược vector
    const m = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 3 });
    const [X, Y] = [m.optionIds[0]!, m.optionIds[1]!];
    await bet(A, m.marketId, [{ option_id: X, amount: 200 }]);
    await bet(B, m.marketId, [{ option_id: Y, amount: 300 }]);
    await bet(C, m.marketId, [{ option_id: Y, amount: 500 }]);
    await lockMarket(m.marketId);

    const summary = await resolveMarket(pool, {
      marketId: m.marketId,
      outcomeOptionId: Y,
      resolutionNote: 'Nguồn công bố: Y (test Vector 1)',
    });
    expect(summary.mode).toBe('normal');
    expect(summary.totalPlayerPayout).toBe(949n);
    expect(summary.burnTotal).toBe(31n);
    expect(summary.treasuryRake).toBe(20n);

    // Từng ví đúng từng đồng
    expect(await bankrollOf(A)).toBe(4800n); // mất 200, không nhận gì
    expect(await bankrollOf(B)).toBe(5056n); // 5000 − 300 + 356
    expect(await bankrollOf(C)).toBe(5093n); // 5000 − 500 + 593

    const { rows: wl } = await pool.query(
      `SELECT delta, reason FROM wallet_ledger
        WHERE ref_market_id = $1 AND reason = 'payout' ORDER BY delta`,
      [m.marketId],
    );
    expect(wl.map((r) => Number(r.delta))).toEqual([356, 593]);

    const { rows: bl } = await pool.query(
      `SELECT amount, reason FROM burn_ledger WHERE ref_market_id = $1 ORDER BY reason`,
      [m.marketId],
    );
    expect(bl.map((r) => [r.reason, Number(r.amount)])).toEqual([
      ['rake_burn', 30], ['residual_burn', 1],
    ]);

    const { rows: tl } = await pool.query(
      `SELECT delta, reason FROM treasury_ledger WHERE ref_market_id = $1`,
      [m.marketId],
    );
    expect(tl.map((r) => [r.reason, Number(r.delta)])).toEqual([['rake_in', 20]]);

    const { rows: mk } = await pool.query(
      `SELECT status, outcome_option_id, resolved_ts FROM markets WHERE market_id = $1`,
      [m.marketId],
    );
    expect(mk[0].status).toBe('resolved');
    expect(mk[0].outcome_option_id).toBe(Y);
    expect(mk[0].resolved_ts).not.toBeNull();

    // Brier: A 100% cửa thua → 2; B/C 100% cửa thắng → 0. Rank snapshot đủ 3.
    await updateScoresAndRanks(pool, m.marketId);
    const { rows: sc } = await pool.query(`SELECT user_id, brier FROM scores WHERE market_id = $1`, [m.marketId]);
    const brierOf = (u: TestUser) => Number(sc.find((r) => r.user_id === u.userId)!.brier);
    expect(brierOf(A)).toBeCloseTo(2, 6);
    expect(brierOf(B)).toBeCloseTo(0, 6);
    expect(brierOf(C)).toBeCloseTo(0, 6);
    const { rows: rk } = await pool.query(
      `SELECT markets_counted, formula_version FROM rank_snapshots WHERE user_id = ANY($1)`,
      [[A.userId, B.userId, C.userId]],
    );
    expect(rk).toHaveLength(3);
    expect(rk.every((r) => r.markets_counted === 1 && r.formula_version === 'brier-decay-v1')).toBe(true);

    await expectAuditOk();
  });
});

describe('Vector 2 — seed 100/cửa, seed thắng về Kho bạc', () => {
  it('A 300@c1 thắng → 712; seed cửa thắng 237 → seed_win; burn 31; rake 20', async () => {
    const [A, B, C] = [await createTestUser(pool), await createTestUser(pool), await createTestUser(pool)];
    await boost(A, 5000);
    const m = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 4, seedPerOption: 100 });
    await bet(A, m.marketId, [{ option_id: m.optionIds[0]!, amount: 300 }]);
    await bet(B, m.marketId, [{ option_id: m.optionIds[1]!, amount: 100 }]);
    await bet(C, m.marketId, [{ option_id: m.optionIds[2]!, amount: 200 }]);
    await lockMarket(m.marketId);

    const summary = await resolveMarket(pool, {
      marketId: m.marketId,
      outcomeOptionId: m.optionIds[0]!,
      resolutionNote: 'Vector 2',
    });
    expect(summary.mode).toBe('normal');
    expect(await bankrollOf(A)).toBe(5412n); // 5000 − 300 + 712
    expect(summary.seedToTreasury).toBe(237n);
    expect(summary.burnTotal).toBe(31n);
    expect(summary.treasuryRake).toBe(20n);

    const { rows: tl } = await pool.query(
      `SELECT delta, reason FROM treasury_ledger WHERE ref_market_id = $1 ORDER BY entry_id`,
      [m.marketId],
    );
    // seed_out lúc mở kèo (−400), rồi seed_win 237 + rake_in 20 khi resolve
    expect(tl.map((r) => [r.reason, Number(r.delta)])).toEqual([
      ['seed_out', -400], ['seed_win', 237], ['rake_in', 20],
    ]);
    await expectAuditOk();
  });
});

describe('Ngoại lệ A5.1', () => {
  it('100% token người chơi ở cửa thắng → hoàn nguyên (reason refund), seed_return nguyên vẹn, không rake', async () => {
    const [A, B] = [await createTestUser(pool), await createTestUser(pool)];
    const m = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 3, seedPerOption: 50 });
    await bet(A, m.marketId, [{ option_id: m.optionIds[0]!, amount: 120 }]);
    await bet(B, m.marketId, [{ option_id: m.optionIds[0]!, amount: 80 }]);
    await lockMarket(m.marketId);

    const summary = await resolveMarket(pool, {
      marketId: m.marketId, outcomeOptionId: m.optionIds[0]!, resolutionNote: 'Ngoại lệ 1',
    });
    expect(summary.mode).toBe('refund_players');
    expect(await bankrollOf(A)).toBe(1000n);
    expect(await bankrollOf(B)).toBe(1000n);

    const { rows: wl } = await pool.query(
      `SELECT reason, delta FROM wallet_ledger WHERE ref_market_id = $1 AND delta > 0 ORDER BY delta`,
      [m.marketId],
    );
    expect(wl.map((r) => [r.reason, Number(r.delta)])).toEqual([['refund', 80], ['refund', 120]]);

    const { rows: bl } = await pool.query(`SELECT 1 FROM burn_ledger WHERE ref_market_id = $1`, [m.marketId]);
    expect(bl).toHaveLength(0); // không rake, không residual

    const { rows: tl } = await pool.query(
      `SELECT reason, delta FROM treasury_ledger WHERE ref_market_id = $1 ORDER BY entry_id`,
      [m.marketId],
    );
    expect(tl.map((r) => [r.reason, Number(r.delta)])).toEqual([['seed_out', -150], ['seed_return', 150]]);
    await expectAuditOk();
  });

  it('D18 — kèo có seed, 0 bet người chơi → seed_return nguyên vẹn, không rake', async () => {
    const m = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 3, seedPerOption: 100 });
    await lockMarket(m.marketId);
    const summary = await resolveMarket(pool, {
      marketId: m.marketId, outcomeOptionId: m.optionIds[1]!, resolutionNote: 'kèo ế (D18)',
    });
    expect(summary.mode).toBe('refund_players');
    expect(summary.seedToTreasury).toBe(300n);
    expect(summary.burnTotal + summary.treasuryRake).toBe(0n);
    await expectAuditOk();
  });

  it('hủy kèo (ngoại lệ 2) — hoàn 100% mọi cửa, seed_return, status cancelled + lý do', async () => {
    const [A, B] = [await createTestUser(pool), await createTestUser(pool)];
    const m = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 3, seedPerOption: 50 });
    await bet(A, m.marketId, [{ option_id: m.optionIds[0]!, amount: 90 }]);
    await bet(B, m.marketId, [{ option_id: m.optionIds[1]!, amount: 60 }]);

    const summary = await cancelMarket(pool, { marketId: m.marketId, reason: 'Nguồn ngừng công bố (test)' });
    expect(summary.mode).toBe('cancelled');
    expect(await bankrollOf(A)).toBe(1000n);
    expect(await bankrollOf(B)).toBe(1000n);

    const { rows: mk } = await pool.query(
      `SELECT status, outcome_option_id, resolution_note FROM markets WHERE market_id = $1`,
      [m.marketId],
    );
    expect(mk[0].status).toBe('cancelled');
    expect(mk[0].outcome_option_id).toBeNull();
    expect(mk[0].resolution_note).toContain('Nguồn ngừng công bố');
    await expectAuditOk();
  });
});

describe('Brier A5.4 qua engine + chốt trạng thái', () => {
  it('60@c1 + 40@c3 kèo 4 cửa, c1 thắng → Brier 0,32 vào scores', async () => {
    const [A, B] = [await createTestUser(pool), await createTestUser(pool)];
    const m = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 4 });
    await bet(A, m.marketId, [
      { option_id: m.optionIds[0]!, amount: 60 },
      { option_id: m.optionIds[2]!, amount: 40 },
    ]);
    await bet(B, m.marketId, [{ option_id: m.optionIds[1]!, amount: 50 }]); // để U_lose > 0
    await lockMarket(m.marketId);
    await resolveMarket(pool, { marketId: m.marketId, outcomeOptionId: m.optionIds[0]!, resolutionNote: 'x' });
    await updateScoresAndRanks(pool, m.marketId);

    const { rows } = await pool.query(
      `SELECT brier FROM scores WHERE market_id = $1 AND user_id = $2`,
      [m.marketId, A.userId],
    );
    expect(Number(rows[0].brier)).toBeCloseTo(0.32, 6);
    await expectAuditOk();
  });

  it('resolve kèo chưa khóa → lỗi; resolve lần 2 → lỗi; hủy kèo đã resolve → lỗi', async () => {
    const A = await createTestUser(pool);
    const m = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 3 });
    await bet(A, m.marketId, [{ option_id: m.optionIds[0]!, amount: 10 }]);

    await expect(
      resolveMarket(pool, { marketId: m.marketId, outcomeOptionId: m.optionIds[0]!, resolutionNote: 'x' }),
    ).rejects.toThrow(/chưa khóa|not_locked/);

    await lockMarket(m.marketId);
    await resolveMarket(pool, { marketId: m.marketId, outcomeOptionId: m.optionIds[0]!, resolutionNote: 'x' });
    await expect(
      resolveMarket(pool, { marketId: m.marketId, outcomeOptionId: m.optionIds[0]!, resolutionNote: 'x' }),
    ).rejects.toThrow();
    await expect(
      cancelMarket(pool, { marketId: m.marketId, reason: 'x' }),
    ).rejects.toThrow();
    await expectAuditOk();
  });

  it('GĐ5 §2.5 — detail kèo resolved lộ outcome/note; /me/results ±T server tính; /me/stats đếm đúng/sai', async () => {
    const [D, E] = [await createTestUser(pool), await createTestUser(pool)];
    const m = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 3 });
    await bet(D, m.marketId, [{ option_id: m.optionIds[0]!, amount: 100 }]); // thắng
    await bet(E, m.marketId, [{ option_id: m.optionIds[1]!, amount: 60 }]);  // thua
    await lockMarket(m.marketId);
    await resolveMarket(pool, {
      marketId: m.marketId, outcomeOptionId: m.optionIds[0]!,
      resolutionNote: 'Nguồn X công bố — Bằng chứng: https://x.test',
    });

    // Detail công khai cửa thắng + note cho CẢ user thua (E)
    const detail = await app.request(`/api/v1/markets/${m.marketId}`, {
      headers: { cookie: E.cookie },
    });
    const dBody = (await detail.json()) as any;
    expect(dBody.outcome_option_id).toBe(m.optionIds[0]);
    expect(dBody.resolution_note).toContain('Bằng chứng');
    expect(dBody.resolved_ts).not.toBeNull();

    // /me/results: D đặt 100, pool 160 → burn 4, trea 3, D = 153 → payout D = 153
    const rD = await app.request('/api/v1/me/results', { headers: { cookie: D.cookie } });
    const bodyD = (await rD.json()) as any;
    const entryD = bodyD.results.find((x: any) => x.market_id === m.marketId);
    expect(entryD.my_total_bet).toBe(100);
    expect(entryD.my_return).toBe(153);
    expect(entryD.net).toBe(53);

    const rE = await app.request('/api/v1/me/results', { headers: { cookie: E.cookie } });
    const entryE = ((await rE.json()) as any).results.find((x: any) => x.market_id === m.marketId);
    expect(entryE.my_total_bet).toBe(60);
    expect(entryE.my_return).toBe(0);
    expect(entryE.net).toBe(-60);

    // /me/stats
    const sD = (await (await app.request('/api/v1/me/stats', { headers: { cookie: D.cookie } })).json()) as any;
    expect(sD.markets_joined).toBeGreaterThanOrEqual(1);
    expect(sD.correct_count).toBeGreaterThanOrEqual(1);
    const sE = (await (await app.request('/api/v1/me/stats', { headers: { cookie: E.cookie } })).json()) as any;
    expect(sE.incorrect_count).toBeGreaterThanOrEqual(1);
    await expectAuditOk();
  });

  /*
   * ORACLE LEVEL — chỉ số DẪN XUẤT, không bảng nào lưu XP.
   * Điều đáng kiểm không phải "XP có ghi vào DB" (nó không ghi) mà là: cùng một
   * hành động thật thì XP có nhúc nhích, và bậc dự báo có tôn trọng ngưỡng số kèo.
   */
  it('/me/progress — Level suy từ dữ liệu thật, Bậc chờ đủ ngưỡng kèo', async () => {
    const F = await createTestUser(pool);

    const truoc = (await (await app.request('/api/v1/me/progress', {
      headers: { cookie: F.cookie },
    })).json()) as any;
    expect(truoc.level).toBe(1);          // người mới là Level 1, không phải 0
    expect(truoc.xp).toBe(0);
    expect(truoc.formula_version).toBeTruthy();
    // Chưa chơi gì → cả 3 pool đều "Chưa xếp", và nói rõ còn thiếu mấy kèo.
    expect(truoc.bac_du_bao).toHaveLength(3);
    for (const b of truoc.bac_du_bao) {
      expect(b.bac).toBe('Chưa xếp');
      expect(b.con_thieu).toBeGreaterThan(0);
    }

    // Tham gia MỘT kèo thật rồi đo lại.
    const m2 = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 3 });
    await bet(F, m2.marketId, [{ option_id: m2.optionIds[0]!, amount: 50 }]);

    const sau = (await (await app.request('/api/v1/me/progress', {
      headers: { cookie: F.cookie },
    })).json()) as any;
    expect(sau.xp, 'tham gia rồi mà XP không nhúc nhích').toBeGreaterThan(truoc.xp);
    expect(sau.dem.keo_tham_gia).toBe(1);
    // Thanh tiến độ phải nằm trong dải vẽ được.
    expect(sau.phan_tram).toBeGreaterThanOrEqual(0);
    expect(sau.phan_tram).toBeLessThanOrEqual(100);
    await expectAuditOk();
  });

  it('/me/progress — khách bị chặn, không rò tiến trình của ai', async () => {
    const r = await app.request('/api/v1/me/progress');
    expect(r.status).toBe(401);
  });

  it('updateScoresAndRanks idempotent — chạy 2 lần không nhân đôi scores', async () => {
    const A = await createTestUser(pool);
    const B = await createTestUser(pool);
    const m = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 3 });
    await bet(A, m.marketId, [{ option_id: m.optionIds[0]!, amount: 10 }]);
    await bet(B, m.marketId, [{ option_id: m.optionIds[1]!, amount: 10 }]);
    await lockMarket(m.marketId);
    await resolveMarket(pool, { marketId: m.marketId, outcomeOptionId: m.optionIds[0]!, resolutionNote: 'x' });
    await updateScoresAndRanks(pool, m.marketId);
    await updateScoresAndRanks(pool, m.marketId);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM scores WHERE market_id = $1`, [m.marketId],
    );
    expect(rows[0].n).toBe(2);
  });
});
