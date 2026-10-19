/**
 * GĐ3 VIỆC 2+3+5 — Test tầng HTTP chợ kèo bằng đồ THẬT (Hono + embedded PG).
 * Trọng tâm: luật ẨN POOL A3.1 (soi RAW JSON — không tin object), pool_reveal
 * đúng 1 lần, transaction đặt cược (cap/no-withdraw/ledger/events), idempotency.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, createTestMarket, ensureGenesis, type TestUser, type TestMarket } from './helpers/fixtures.js';
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
    tickSecret: 'tick-secret-cho-test-purge',
    secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  admin = await createTestUser(pool, { role: 'admin', bankroll: 0 });
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

const get = (path: string, cookie: string) =>
  app.request(path, { method: 'GET', headers: { cookie } });

const post = (path: string, cookie: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const j = (res: Response): Promise<any> => res.json() as Promise<any>;

const betBody = (optionId: string, amount: number, key = randomUUID()) => ({
  allocations: [{ option_id: optionId, amount }],
  idempotency_key: key,
});

async function countEvents(action: string, userId: string, marketId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM events
      WHERE action_type = $1 AND user_id = $2 AND context_id = $3`,
    [action, userId, marketId],
  );
  return rows[0].n;
}

describe('A3.1 — ẨN POOL enforce tầng API', () => {
  let market: TestMarket;
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    market = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 3, seedPerOption: 100 });
    alice = await createTestUser(pool);
    bob = await createTestUser(pool);
    // Bob đặt trước để pool có token người chơi
    const r = await post(`/api/v1/markets/${market.marketId}/bets`, bob.cookie, betBody(market.optionIds[0]!, 50));
    expect(r.status).toBe(200);
  });

  it('sảnh: có volume, KHÔNG có phân bố, KHÔNG có số người (founder 19/07)', async () => {
    const res = await get('/api/v1/markets', bob.cookie);
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain('distribution');
    expect(raw).not.toContain('participants'); // ẩn số người ở TẦNG API
    const body = JSON.parse(raw);
    const m = body.markets.find((x: any) => x.market_id === market.marketId);
    expect(m.total_volume).toBe(350); // 300 seed + 50 Bob
    expect(m.seed_per_option).toBe(100); // seed minh bạch (A3.6)
  });

  it('chi tiết với user CHƯA đặt: RAW JSON không chứa chuỗi "distribution"', async () => {
    const res = await get(`/api/v1/markets/${market.marketId}`, alice.cookie);
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain('distribution'); // soi raw — không tin object
    expect(raw).not.toContain('participants'); // ẩn số người (founder 19/07)
    const body = JSON.parse(raw);
    expect(body.total_volume).toBe(350);
    expect(body.seed_total).toBe(300);
    expect(body.options).toHaveLength(3);
    expect(body.bankroll).toBe(1000);
    expect(body.bet_cap).toBe(200); // floor(20% × 1000)
  });

  it('/pool với user chưa đặt → 403 pool_hidden (chặn đường vòng)', async () => {
    const res = await get(`/api/v1/markets/${market.marketId}/pool`, alice.cookie);
    expect(res.status).toBe(403);
    expect((await j(res)).error).toBe('pool_hidden');
  });

  it('đặt 1 T đầu tiên → response CÓ distribution + đúng MỘT event pool_reveal', async () => {
    const res = await post(
      `/api/v1/markets/${market.marketId}/bets`,
      alice.cookie,
      betBody(market.optionIds[1]!, 1),
    );
    expect(res.status).toBe(200);
    const body = await j(res);
    expect(body.distribution).toBeDefined();
    expect(body.distribution).toHaveLength(3);
    expect(await countEvents('pool_reveal', alice.userId, market.marketId)).toBe(1);

    // Gọi lại chi tiết → giờ thấy phân bố; /pool cũng mở
    const detail = await get(`/api/v1/markets/${market.marketId}`, alice.cookie);
    const draw = await detail.text();
    expect(draw).toContain('distribution');
    const poolRes = await get(`/api/v1/markets/${market.marketId}/pool`, alice.cookie);
    expect(poolRes.status).toBe(200);
    expect(poolRes.headers.get('cache-control')).toContain('private');
  });

  it('điều chỉnh lần 2 KHÔNG sinh thêm pool_reveal', async () => {
    const res = await post(
      `/api/v1/markets/${market.marketId}/bets`,
      alice.cookie,
      betBody(market.optionIds[1]!, 5),
    );
    expect(res.status).toBe(200);
    expect(await countEvents('pool_reveal', alice.userId, market.marketId)).toBe(1);
  });

  it('market_view: snapshot null khi chưa reveal, có phân bố sau khi đặt', async () => {
    const fresh = await createTestUser(pool);
    await get(`/api/v1/markets/${market.marketId}`, fresh.cookie);
    const { rows: r1 } = await pool.query(
      `SELECT state_snapshot_json FROM events
        WHERE action_type = 'market_view' AND user_id = $1 AND context_id = $2
        ORDER BY event_id DESC LIMIT 1`,
      [fresh.userId, market.marketId],
    );
    expect(r1[0].state_snapshot_json).toBeNull();

    await post(`/api/v1/markets/${market.marketId}/bets`, fresh.cookie, betBody(market.optionIds[0]!, 10));
    await get(`/api/v1/markets/${market.marketId}`, fresh.cookie);
    const { rows: r2 } = await pool.query(
      `SELECT state_snapshot_json FROM events
        WHERE action_type = 'market_view' AND user_id = $1 AND context_id = $2
        ORDER BY event_id DESC LIMIT 1`,
      [fresh.userId, market.marketId],
    );
    expect(r2[0].state_snapshot_json).not.toBeNull();
    expect(r2[0].state_snapshot_json.d).toHaveLength(3); // [option_id, pct] gọn (A7)
  });

  it('kèo draft: 404 với mọi user (không tồn tại với thế giới)', async () => {
    const { rows } = await pool.query(
      `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url,
                            open_ts, lock_ts, resolve_deadline_ts, status, season_id, created_by)
       VALUES ('life', 'Draft?', 'x', 'https://x', now(), now() + interval '1 hour',
               now() + interval '2 hour', 'draft', '2026Q3', $1) RETURNING market_id`,
      [admin.userId],
    );
    const res = await get(`/api/v1/markets/${rows[0].market_id}`, alice.cookie);
    expect(res.status).toBe(404);
  });
});

describe('POST bets — transaction, cap A5.3, ledger, no-withdraw', () => {
  let market: TestMarket;
  let user: TestUser;

  beforeAll(async () => {
    market = await createTestMarket(pool, { createdBy: admin.userId, optionCount: 3 });
    user = await createTestUser(pool); // bankroll 1.000
  });

  it('nghiệm thu: đặt 201 T khi bankroll 1.000 (cap 200) → 400 kèm message rõ', async () => {
    const res = await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, betBody(market.optionIds[0]!, 201));
    expect(res.status).toBe(400);
    const body = await j(res);
    expect(body.error).toBe('cap_exceeded');
    expect(body.message).toContain('20%');
  });

  it('đặt 200 hợp lệ: bankroll 800, ledger bet_place −200, event bet_place snapshot NULL', async () => {
    const res = await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, betBody(market.optionIds[0]!, 200));
    expect(res.status).toBe(200);
    const body = await j(res);
    expect(body.bankroll).toBe(800);
    expect(body.bet_total_mine).toBe(200);

    const { rows: wl } = await pool.query(
      `SELECT delta, balance_after, reason FROM wallet_ledger
        WHERE user_id = $1 AND ref_market_id = $2 ORDER BY entry_id`,
      [user.userId, market.marketId],
    );
    expect(wl).toHaveLength(1);
    expect(Number(wl[0].delta)).toBe(-200);
    expect(Number(wl[0].balance_after)).toBe(800);
    expect(wl[0].reason).toBe('bet_place');

    const { rows: ev } = await pool.query(
      `SELECT state_snapshot_json FROM events
        WHERE action_type = 'bet_place' AND user_id = $1 AND context_id = $2`,
      [user.userId, market.marketId],
    );
    expect(ev).toHaveLength(1);
    expect(ev[0].state_snapshot_json).toBeNull(); // trước hành động chưa từng reveal
  });

  it('A5.3 chống lách: thêm 50 (tổng 250) khi quy chiếu 800+200=1.000 → TỪ CHỐI', async () => {
    const res = await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, betBody(market.optionIds[0]!, 250));
    expect(res.status).toBe(400);
    expect((await j(res)).error).toBe('cap_exceeded');
  });

  it('reallocation cùng tổng (200 → 120+80 hai cửa): OK, KHÔNG bút toán mới, event bet_adjust', async () => {
    const res = await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, {
      allocations: [
        { option_id: market.optionIds[0]!, amount: 120 },
        { option_id: market.optionIds[1]!, amount: 80 },
      ],
      idempotency_key: randomUUID(),
    });
    expect(res.status).toBe(200);
    const body = await j(res);
    expect(body.bankroll).toBe(800); // không đổi
    expect(body.my_allocation).toHaveLength(2);

    const { rows: wl } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM wallet_ledger WHERE user_id = $1 AND ref_market_id = $2`,
      [user.userId, market.marketId],
    );
    expect(wl[0].n).toBe(1); // vẫn chỉ bút toán bet_place ban đầu
    expect(await countEvents('bet_adjust', user.userId, market.marketId)).toBe(1);
  });

  it('no-withdraw: hạ tổng 200 → 150 → 400', async () => {
    const res = await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, betBody(market.optionIds[0]!, 150));
    expect(res.status).toBe(400);
    expect((await j(res)).error).toBe('no_withdraw');
  });

  it('cửa của kèo KHÁC → 400 invalid_option, không side effect', async () => {
    const other = await createTestMarket(pool, { createdBy: admin.userId });
    const res = await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, betBody(other.optionIds[0]!, 1));
    expect(res.status).toBe(400);
    expect((await j(res)).error).toBe('invalid_option');
  });

  it('kèo status=locked → 409; kèo lock_ts đã qua (còn open) → 409', async () => {
    const locked = await createTestMarket(pool, { createdBy: admin.userId, status: 'locked' });
    const r1 = await post(`/api/v1/markets/${locked.marketId}/bets`, user.cookie, betBody(locked.optionIds[0]!, 1));
    expect(r1.status).toBe(409);
    expect((await j(r1)).error).toBe('market_locked');

    const past = await createTestMarket(pool, { createdBy: admin.userId, lockInSeconds: -5 });
    const r2 = await post(`/api/v1/markets/${past.marketId}/bets`, user.cookie, betBody(past.optionIds[0]!, 1));
    expect(r2.status).toBe(409);
  });

  it('thiếu idempotency_key → 400; kèo không tồn tại → 404', async () => {
    const r1 = await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, {
      allocations: [{ option_id: market.optionIds[0]!, amount: 1 }],
    });
    expect(r1.status).toBe(400);
    const r2 = await post(`/api/v1/markets/${randomUUID()}/bets`, user.cookie, betBody(market.optionIds[0]!, 1));
    expect(r2.status).toBe(404);
  });

  it('chưa đăng nhập → 401', async () => {
    const res = await app.request('/api/v1/markets');
    expect(res.status).toBe(401);
  });
});

describe('Idempotency — double-click không trừ ví hai lần (nghiệm thu GĐ3)', () => {
  let market: TestMarket;
  let user: TestUser;

  beforeAll(async () => {
    market = await createTestMarket(pool, { createdBy: admin.userId });
    user = await createTestUser(pool);
  });

  it('cùng key gửi lại → replay response, DB chỉ 1 hiệu lực', async () => {
    const key = randomUUID();
    const body = betBody(market.optionIds[0]!, 100, key);

    const r1 = await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, body);
    expect(r1.status).toBe(200);
    const b1 = await j(r1);

    const r2 = await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, body);
    expect(r2.status).toBe(200);
    const b2 = await j(r2);
    expect(b2.replayed).toBe(true);
    expect(b2.bankroll).toBe(b1.bankroll); // 900 — không trừ lần 2

    const { rows: wl } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM wallet_ledger WHERE user_id = $1 AND ref_market_id = $2`,
      [user.userId, market.marketId],
    );
    expect(wl[0].n).toBe(1);
    const { rows: bets } = await pool.query(
      `SELECT amount FROM bets WHERE user_id = $1 AND market_id = $2`,
      [user.userId, market.marketId],
    );
    expect(bets).toHaveLength(1);
    expect(Number(bets[0].amount)).toBe(100);
  });

  it('cùng key nhưng body KHÁC → 409 idempotency_conflict', async () => {
    const fresh = await createTestUser(pool);
    const key = randomUUID();
    const r1 = await post(`/api/v1/markets/${market.marketId}/bets`, fresh.cookie, betBody(market.optionIds[1]!, 10, key));
    expect(r1.status).toBe(200); // intent phải được lưu thật
    const res = await post(`/api/v1/markets/${market.marketId}/bets`, fresh.cookie, betBody(market.optionIds[1]!, 20, key));
    expect(res.status).toBe(409);
    expect((await j(res)).error).toBe('idempotency_conflict');
  });

  it('key của user KHÁC → 409 (không đọc trộm response người khác)', async () => {
    const owner = await createTestUser(pool);
    const key = randomUUID();
    const r1 = await post(`/api/v1/markets/${market.marketId}/bets`, owner.cookie, betBody(market.optionIds[2]!, 5, key));
    expect(r1.status).toBe(200);
    const mallory = await createTestUser(pool);
    // Mallory gửi CÙNG body cùng key — user khác → vẫn 409, không replay response của owner
    const res = await post(`/api/v1/markets/${market.marketId}/bets`, mallory.cookie, betBody(market.optionIds[2]!, 5, key));
    expect(res.status).toBe(409);
  });
});

describe('VIỆC 5 — GET /wallet + GET /me/bets', () => {
  let market: TestMarket;
  let user: TestUser;

  beforeAll(async () => {
    market = await createTestMarket(pool, { createdBy: admin.userId });
    user = await createTestUser(pool);
    await post(`/api/v1/markets/${market.marketId}/bets`, user.cookie, betBody(market.optionIds[0]!, 30));
  });

  it('wallet: bankroll + ledger mới→cũ + phân trang', async () => {
    const res = await get('/api/v1/wallet', user.cookie);
    expect(res.status).toBe(200);
    const body = await j(res);
    expect(body.bankroll).toBe(970);
    expect(body.entries[0].reason).toBe('bet_place'); // mới nhất trước
    expect(body.entries[0].delta).toBe(-30);
    expect(body.entries[1].reason).toBe('signup_grant');

    const page1 = await get('/api/v1/wallet?limit=1', user.cookie);
    const p1 = await j(page1);
    expect(p1.entries).toHaveLength(1);
    expect(p1.next_before).toBe(p1.entries[0].entry_id);
    const page2 = await get(`/api/v1/wallet?limit=1&before=${p1.next_before}`, user.cookie);
    const p2 = await j(page2);
    expect(p2.entries[0].reason).toBe('signup_grant');
  });

  it('me/bets: trả đúng phân bổ của tôi, không lộ gì khác', async () => {
    const res = await get(`/api/v1/me/bets?market_id=${market.marketId}`, user.cookie);
    expect(res.status).toBe(200);
    const body = await j(res);
    expect(body.allocations).toEqual([{ option_id: market.optionIds[0], amount: 30 }]);
    expect(body.bet_total_mine).toBe(30);
  });

  it('wallet: before quá 19 chữ số (tràn BIGINT) bị bỏ qua an toàn, không 500', async () => {
    const res = await get('/api/v1/wallet?before=99999999999999999999999', user.cookie);
    expect(res.status).toBe(200);
  });
});

describe('bet_intents TTL 24h — /internal/tick dọn rác (spec dòng 957-959)', () => {
  it('intent quá 24h bị xóa, intent mới còn nguyên', async () => {
    const market = await createTestMarket(pool, { createdBy: admin.userId });
    const user = await createTestUser(pool);
    await pool.query(
      `INSERT INTO bet_intents (idempotency_key, user_id, market_id, request_hash, created_at)
       VALUES ('intent-cu-qua-24h', $1, $2, 'x', now() - interval '25 hours'),
              ('intent-moi-con-han', $1, $2, 'x', now())`,
      [user.userId, market.marketId],
    );
    const res = await app.request('/api/v1/internal/tick', {
      method: 'POST',
      headers: { 'x-tick-secret': 'tick-secret-cho-test-purge' },
    });
    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT idempotency_key FROM bet_intents
      WHERE idempotency_key IN ('intent-cu-qua-24h', 'intent-moi-con-han')`);
    expect(rows.map((r) => r.idempotency_key)).toEqual(['intent-moi-con-han']);
  });
});

describe('Kiểm toán sau toàn bộ test API', () => {
  it('audit_supply CÂN (A3.10)', async () => {
    const report = await auditSupply(pool);
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
