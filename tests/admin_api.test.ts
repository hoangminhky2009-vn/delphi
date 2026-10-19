/**
 * GĐ4 VIỆC 1 — Admin API: vòng đời kèo TRỌN VẸN qua API (tạo → mở+seed →
 * khóa → preview → resolve có mã xác nhận → audit), quyền, dashboard.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { randomUUID } from 'node:crypto';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { auditSupply } from '../scripts/audit_supply.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let admin: TestUser;
let normie: TestUser;

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
  // Cửa 2FA (0025) — test này về VÒNG ĐỜI KÈO, không phải về cái cửa.
  await moCuaAdmin(pool, admin);
  normie = await createTestUser(pool);
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

const req = (path: string, cookie: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
const j = (r: Response): Promise<any> => r.json() as Promise<any>;

const validMarketBody = (over: Record<string, unknown> = {}) => ({
  pool: 'life',
  question_text: 'Giá xăng RON95 tuần tới?',
  resolution_source_name: 'Petrolimex',
  resolution_source_url: 'https://petrolimex.test/gia',
  open_ts: new Date(Date.now() - 60_000).toISOString(),
  lock_ts: new Date(Date.now() + 3600_000).toISOString(),
  resolve_deadline_ts: new Date(Date.now() + 7200_000).toISOString(),
  seed_per_option: 0,
  options: [{ label: 'Tăng' }, { label: 'Giảm' }, { label: 'Đi ngang' }],
  ...over,
});

describe('quyền admin', () => {
  it('user thường: /admin và mọi API admin → 403; admin: /admin trả HTML', async () => {
    expect((await req('/admin', normie.cookie)).status).toBe(403);
    expect((await req('/api/v1/admin/dashboard', normie.cookie)).status).toBe(403);
    const page = await req('/admin', admin.cookie);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('DELPHI — Admin');
  });
});

describe('tạo + mở kèo', () => {
  it('nghiệm thu: thiếu URL nguồn resolve → 400, không tạo được', async () => {
    const res = await req('/api/v1/admin/markets', admin.cookie, 'POST',
      validMarketBody({ resolution_source_url: '' }));
    expect(res.status).toBe(400);
    expect((await j(res)).field).toBe('resolution_source_url');
  });

  it('1 cửa hoặc 7 cửa → 400 (kèo cần 2–6 cửa)', async () => {
    const one = await req('/api/v1/admin/markets', admin.cookie, 'POST',
      validMarketBody({ options: [{ label: 'x' }] }));
    expect(one.status).toBe(400);
    const seven = await req('/api/v1/admin/markets', admin.cookie, 'POST',
      validMarketBody({ options: Array.from({ length: 7 }, (_, i) => ({ label: `c${i}` })) }));
    expect(seven.status).toBe(400);
  });

  it('tạo draft → user thường KHÔNG thấy; mở kèo → seed chia đều, rút Kho bạc, user thấy', async () => {
    const created = await req('/api/v1/admin/markets', admin.cookie, 'POST',
      validMarketBody({ seed_per_option: 100 }));
    expect(created.status).toBe(201);
    const { market_id } = await j(created);

    expect((await req(`/api/v1/markets/${market_id}`, normie.cookie)).status).toBe(404); // draft vô hình

    const opened = await req(`/api/v1/admin/markets/${market_id}/open`, admin.cookie, 'POST', {});
    expect(opened.status).toBe(200);
    expect((await j(opened)).seed_total).toBe(300);

    const { rows: seeds } = await pool.query(
      `SELECT amount FROM bets WHERE market_id = $1 AND is_seed`, [market_id],
    );
    expect(seeds.map((r) => Number(r.amount))).toEqual([100, 100, 100]); // CHIA ĐỀU (A3.6)
    const { rows: tl } = await pool.query(
      `SELECT reason, delta FROM treasury_ledger WHERE ref_market_id = $1`, [market_id],
    );
    expect(tl.map((r) => [r.reason, Number(r.delta)])).toEqual([['seed_out', -300]]);

    expect((await req(`/api/v1/markets/${market_id}`, normie.cookie)).status).toBe(200);
    // Mở lần 2 → 409
    expect((await req(`/api/v1/admin/markets/${market_id}/open`, admin.cookie, 'POST', {})).status).toBe(409);
    // audit đủ 2 thao tác
    const { rows: au } = await pool.query(
      `SELECT action FROM admin_audit WHERE admin_id = $1 ORDER BY audit_id`, [admin.userId],
    );
    expect(au.map((r) => r.action)).toEqual(expect.arrayContaining(['market_create', 'market_open']));
  });

  it('seed vượt quỹ Kho bạc → 409 rõ ràng, kèo vẫn draft, không bút toán (A3.4/D10)', async () => {
    const created = await req('/api/v1/admin/markets', admin.cookie, 'POST',
      validMarketBody({ seed_per_option: 1_000_000_000 }));
    const { market_id } = await j(created);
    const res = await req(`/api/v1/admin/markets/${market_id}/open`, admin.cookie, 'POST', {});
    expect(res.status).toBe(409);
    expect((await j(res)).error).toBe('treasury_insufficient');
    const { rows } = await pool.query(`SELECT status FROM markets WHERE market_id = $1`, [market_id]);
    expect(rows[0].status).toBe('draft');
    const { rows: tl } = await pool.query(
      `SELECT 1 FROM treasury_ledger WHERE ref_market_id = $1`, [market_id],
    );
    expect(tl).toHaveLength(0);
  });
});

describe('preview → resolve có mã xác nhận (Vector 1 qua API admin)', () => {
  let marketId: string;
  let X: string;
  let Y: string;
  let code: string;

  beforeAll(async () => {
    const created = await req('/api/v1/admin/markets', admin.cookie, 'POST', validMarketBody());
    const body = await j(created);
    marketId = body.market_id;
    [X, Y] = [body.option_ids[0], body.option_ids[1]];
    await req(`/api/v1/admin/markets/${marketId}/open`, admin.cookie, 'POST', {});

    const users = [await createTestUser(pool), await createTestUser(pool), await createTestUser(pool)];
    for (const u of users) {
      await pool.query(`UPDATE users SET bankroll = 5000 WHERE user_id = $1`, [u.userId]);
      await pool.query(
        `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
         VALUES ($1, 4000, 5000, 'admin_adjust')`, [u.userId],
      );
    }
    const bet = (u: TestUser, opt: string, amount: number) =>
      req(`/api/v1/markets/${marketId}/bets`, u.cookie, 'POST', {
        allocations: [{ option_id: opt, amount }], idempotency_key: randomUUID(),
      });
    await bet(users[0]!, X, 200);
    await bet(users[1]!, Y, 300);
    await bet(users[2]!, Y, 500);
  });

  it('preview khi kèo còn open → 409; khóa xong preview ra đúng số Vector 1 + mã, KHÔNG ghi gì', async () => {
    const early = await req(
      `/api/v1/admin/markets/${marketId}/preview-resolve?outcome_option_id=${Y}`, admin.cookie,
    );
    expect(early.status).toBe(409);

    await pool.query(`UPDATE markets SET status = 'locked' WHERE market_id = $1`, [marketId]);
    const res = await req(
      `/api/v1/admin/markets/${marketId}/preview-resolve?outcome_option_id=${Y}`, admin.cookie,
    );
    expect(res.status).toBe(200);
    const p = await j(res);
    expect(p.pool_total).toBe(1000);
    expect(p.total_player_payout).toBe(949);
    expect(p.burn_total).toBe(31);
    expect(p.treasury_rake).toBe(20);
    expect(p.players_paid).toBe(2);
    expect(p.confirm_code).toMatch(/^[0-9A-F]{6}$/);
    code = p.confirm_code;

    // Preview thuần đọc — không có bút toán nào
    const { rows } = await pool.query(
      `SELECT 1 FROM wallet_ledger WHERE ref_market_id = $1 AND reason IN ('payout','refund')`,
      [marketId],
    );
    expect(rows).toHaveLength(0);
  });

  it('resolve sai mã → 409 không đổi gì; đúng mã → chia tiền + scores + audit', async () => {
    const wrong = await req(`/api/v1/admin/markets/${marketId}/resolve`, admin.cookie, 'POST', {
      outcome_option_id: Y, confirm_code: '000000', evidence_url: 'https://x', resolution_note: 'n',
    });
    expect(wrong.status).toBe(409);
    expect((await j(wrong)).error).toBe('confirm_mismatch');

    const ok = await req(`/api/v1/admin/markets/${marketId}/resolve`, admin.cookie, 'POST', {
      outcome_option_id: Y, confirm_code: code,
      evidence_url: 'https://petrolimex.test/cong-bo', resolution_note: 'Giá tăng',
    });
    expect(ok.status).toBe(200);
    const body = await j(ok);
    expect(body.total_player_payout).toBe(949);

    const { rows: mk } = await pool.query(
      `SELECT status, resolution_note FROM markets WHERE market_id = $1`, [marketId],
    );
    expect(mk[0].status).toBe('resolved');
    expect(mk[0].resolution_note).toContain('Bằng chứng');

    const { rows: sc } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM scores WHERE market_id = $1`, [marketId],
    );
    expect(sc[0].n).toBe(3);
    const { rows: au } = await pool.query(
      `SELECT 1 FROM admin_audit WHERE action = 'market_resolve'`,
    );
    expect(au.length).toBeGreaterThanOrEqual(1);

    // Resolve lần 2 → mã cũ vẫn khớp pool nhưng engine chặn theo status
    const again = await req(`/api/v1/admin/markets/${marketId}/resolve`, admin.cookie, 'POST', {
      outcome_option_id: Y, confirm_code: code, evidence_url: 'https://x', resolution_note: 'n',
    });
    expect(again.status).toBe(409);

    const report = await auditSupply(pool);
    expect(report.problems).toEqual([]);
  });
});

describe('hủy kèo + dashboard', () => {
  it('hủy không lý do → 400; có lý do → cancelled + audit', async () => {
    const created = await req('/api/v1/admin/markets', admin.cookie, 'POST', validMarketBody());
    const { market_id } = await j(created);
    await req(`/api/v1/admin/markets/${market_id}/open`, admin.cookie, 'POST', {});

    const noReason = await req(`/api/v1/admin/markets/${market_id}/cancel`, admin.cookie, 'POST', {});
    expect(noReason.status).toBe(400);

    const ok = await req(`/api/v1/admin/markets/${market_id}/cancel`, admin.cookie, 'POST',
      { reason: 'Nguồn ngừng công bố chỉ số' });
    expect(ok.status).toBe(200);
    const { rows } = await pool.query(
      `SELECT status, resolution_note FROM markets WHERE market_id = $1`, [market_id],
    );
    expect(rows[0].status).toBe('cancelled');
    expect(rows[0].resolution_note).toContain('Admin hủy');
  });

  it('/admin/pending: gom đủ việc cần làm + options kèm sẵn (không phải gõ ID)', async () => {
    // draft (cần mở) + locked (cần chốt) đều phải xuất hiện, kèm đủ dữ liệu
    const draft = await req('/api/v1/admin/markets', admin.cookie, 'POST',
      validMarketBody({ seed_per_option: 30 }));
    const draftId = (await j(draft)).market_id;

    const locked = await req('/api/v1/admin/markets', admin.cookie, 'POST', validMarketBody());
    const lockedBody = await j(locked);
    await req(`/api/v1/admin/markets/${lockedBody.market_id}/open`, admin.cookie, 'POST', {});
    await pool.query(`UPDATE markets SET status = 'locked' WHERE market_id = $1`,
      [lockedBody.market_id]);

    const res = await req('/api/v1/admin/pending', admin.cookie);
    expect(res.status).toBe(200);
    const body = await j(res);
    const ids = body.markets.map((m: any) => m.market_id);
    expect(ids).toContain(draftId);
    expect(ids).toContain(lockedBody.market_id);

    // locked xếp TRƯỚC draft (việc gấp hơn) và mang đủ options + nguồn để prefill
    const lk = body.markets.find((m: any) => m.market_id === lockedBody.market_id);
    expect(lk.status).toBe('locked');
    expect(lk.options).toHaveLength(3);
    expect(lk.options[0].option_id).toBeTruthy();
    expect(lk.options[0].label).toBeTruthy();
    expect(typeof lk.options[0].volume).toBe('number');
    expect(lk.resolution_source_url).toContain('http'); // prefill URL bằng chứng
    expect(body.markets[0].status).toBe('locked');

    // Kèo open bình thường KHÔNG phải việc cần làm
    const openOne = await req('/api/v1/admin/markets', admin.cookie, 'POST', validMarketBody());
    const openId = (await j(openOne)).market_id;
    await req(`/api/v1/admin/markets/${openId}/open`, admin.cookie, 'POST', {});
    const res2 = await j(await req('/api/v1/admin/pending', admin.cookie));
    expect(res2.markets.map((m: any) => m.market_id)).not.toContain(openId);
  });

  it('/admin/pending: user thường → 403', async () => {
    expect((await req('/api/v1/admin/pending', normie.cookie)).status).toBe(403);
  });

  it('dashboard guardrail: audit CÂN + đủ chỉ số', async () => {
    const res = await req('/api/v1/admin/dashboard', admin.cookie);
    expect(res.status).toBe(200);
    const d = await j(res);
    expect(d.audit_ok).toBe(true);
    expect(d.users).toBeGreaterThan(0);
    expect(d.bankroll_gini).toBeGreaterThanOrEqual(0);
    expect(d.bankroll_gini).toBeLessThanOrEqual(1);
    expect(d.supply['Kho bạc']).toBeDefined();
    expect(d.markets_by_status.resolved).toBeGreaterThanOrEqual(1);
  });
});
