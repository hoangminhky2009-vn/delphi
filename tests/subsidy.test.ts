/**
 * GĐ4 VIỆC 4 — Trợ cấp sàn: đủ nhánh nghiệm thu (400→450, chặn ngày, trần
 * tháng, kho bạc cạn không mint).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { treasuryAppend } from '../server/treasury.js';
import { auditSupply } from '../scripts/audit_supply.js';

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
    secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

const claim = async (u: TestUser) =>
  app.request('/api/v1/subsidy/claim', { method: 'POST', headers: { cookie: u.cookie } });

const setBankroll = async (u: TestUser, to: number) => {
  const { rows } = await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [u.userId]);
  const delta = BigInt(to) - (rows[0].bankroll as bigint);
  if (delta === 0n) return;
  await pool.query(`UPDATE users SET bankroll = $1 WHERE user_id = $2`, [to, u.userId]);
  await pool.query(
    `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
     VALUES ($1, $2, $3, 'admin_adjust')`,
    [u.userId, delta.toString(), to],
  );
};

describe('⚠⚠ CỬA KHÁCH KHÔNG ĐƯỢC RÚT KHO BẠC (rà soát 11/08)', () => {
  /*
   * Lỗ đang mở tìm ra 11/08, khai thác được bằng curl và KHÔNG cần tài khoản:
   * cửa KHÁCH tạo một hàng `users` thật bằng đúng một cú POST (không email,
   * không age gate), mà `/subsidy/claim` chỉ có `requireAuth` +
   * `requireOnboarded` — `requireOnboarded` chỉ hỏi `userId` có null không.
   *
   * Kho bạc là quỹ MỘT LẦN (genesis khoá bằng unique partial index, A3.4/D10),
   * chỉ nạp thêm bằng 2% rake. Trần khách 5/IP/giờ ⇒ 6.000 T/ngày/IP; vài IP
   * là cạn kho 20.135 T. Cạn kho thì `CHECK balance_after >= 0` làm mọi khoản
   * chi FAIL CỨNG: không mở được kèo có seed, người chơi THẬT hết trợ cấp.
   */
  const taoKhach = async () => {
    const r = await app.request('/api/v1/auth/khach', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(r.status, 'cửa khách phải còn sống — nếu 404 thì bài này vô nghĩa').toBe(200);
    const setCookie = r.headers.get('set-cookie') ?? '';
    const cookie = setCookie.split(';')[0]!;
    // B5 (vá đợt 1 Gói 2) — khách qua cổng tuổi trước, như ngoài đời: bài này canh `chanKhach`, không canh cổng tuổi.
    const tuoi = await app.request('/api/v1/me/tuoi', {
      method: 'POST', headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ birth_year: new Date().getUTCFullYear() - 20 }),
    });
    expect(tuoi.status).toBe(200);
    return cookie;
  };

  const khoBac = async (): Promise<bigint> => {
    const { rows } = await pool.query(
      `SELECT balance_after FROM treasury_ledger ORDER BY entry_id DESC LIMIT 1`);
    return (rows[0]?.balance_after ?? 0n) as bigint;
  };

  it('⭐ phiên KHÁCH xin trợ cấp ⇒ 403, và Kho bạc KHÔNG đổi một T', async () => {
    const cookie = await taoKhach();
    const truoc = await khoBac();
    const r = await app.request('/api/v1/subsidy/claim', {
      method: 'POST', headers: { cookie },
    });
    expect(r.status, 'khách rút được Kho bạc = một người lạ phá được lõi kinh tế cả mùa')
      .toBe(403);
    expect((await r.json() as any).error).toBe('khach_khong_duoc');
    expect(await khoBac(), 'Kho bạc phải đứng yên tuyệt đối').toBe(truoc);
  });

  it('ĐỐI CHỨNG — tài khoản THẬT vẫn nhận được (không chặn nhầm người chơi)', async () => {
    /*
     * Bắt buộc có: thiếu nó thì một lỗi chặn-tất-cả vẫn cho bài trên xanh
     * trong khi trợ cấp — cơ chế chống kiệt quệ của A4 — chết hẳn.
     */
    const u = await createTestUser(pool, { bankroll: 100 });
    const r = await claim(u);
    expect(r.status).toBe(200);
    expect(((await r.json()) as any).bankroll).toBe(150);
  });
});

describe('trợ cấp sàn (A4: <500 → +50/ngày, trần 1.000/tháng, chi từ Kho bạc)', () => {
  it('nghiệm thu: ví 400 nhận → 450; bấm lại trong ngày → từ chối', async () => {
    const u = await createTestUser(pool, { bankroll: 400 });
    const r1 = await claim(u);
    expect(r1.status).toBe(200);
    expect(((await r1.json()) as any).bankroll).toBe(450);

    // Bút toán 2 sổ khớp nhau (Bất biến D) + event checkin
    const { rows: wl } = await pool.query(
      `SELECT delta, reason FROM wallet_ledger WHERE user_id = $1 AND reason = 'subsidy'`,
      [u.userId],
    );
    expect(wl.map((r) => Number(r.delta))).toEqual([50]);
    const { rows: ev } = await pool.query(
      `SELECT value_num FROM events WHERE user_id = $1 AND action_type = 'checkin'`,
      [u.userId],
    );
    expect(ev).toHaveLength(1);
    expect(Number(ev[0].value_num)).toBe(50);

    const r2 = await claim(u);
    expect(r2.status).toBe(409);
    expect(((await r2.json()) as any).error).toBe('already_claimed_today');

    const report = await auditSupply(pool);
    expect(report.problems).toEqual([]);
  });

  it('ví ≥ 500 → 400 not_eligible, không side effect', async () => {
    const u = await createTestUser(pool, { bankroll: 500 });
    const res = await claim(u);
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error).toBe('not_eligible');
    const { rows } = await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [u.userId]);
    expect(rows[0].bankroll as bigint).toBe(500n);
  });

  it('trần tháng 1.000 T: đã nhận đủ 20 lần trong tháng → monthly_cap', async () => {
    const u = await createTestUser(pool, { bankroll: 0 });
    // Dựng 20 lần nhận trong THÁNG VN hiện tại (đầu tháng + i phút — khác ngày
    // hôm nay trừ khi chạy đúng mùng 1; thứ tự kiểm monthly-trước-daily giữ mã
    // lỗi tất định). Ghi CẶP hai sổ + bankroll để audit vẫn CÂN.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < 20; i++) {
        await treasuryAppend(client, -50n, 'subsidy_out', null);
        await client.query(
          `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason, created_at)
           VALUES ($1, 50, $2, 'subsidy',
                   (date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))
                     AT TIME ZONE 'Asia/Ho_Chi_Minh' + ($3 || ' minutes')::interval)`,
          [u.userId, (i + 1) * 50, i],
        );
      }
      await client.query(`UPDATE users SET bankroll = 1000 WHERE user_id = $1`, [u.userId]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    // Kéo ví xuống dưới ngưỡng để chỉ còn trần tháng là rào cản
    await setBankroll(u, 100);

    const res = await claim(u);
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error).toBe('monthly_cap');

    const report = await auditSupply(pool);
    expect(report.problems).toEqual([]);
  });

  it('Kho bạc cạn → 409 treasury_empty, KHÔNG mint, không side effect', async () => {
    // Rút gần cạn Kho bạc (còn 30 < 50). Bút toán rút này làm lệch Bất biến A
    // tạm thời (không có đối ứng) → hoàn trả ngay sau test, KHÔNG chạy audit ở giữa.
    const { rows } = await pool.query(
      `SELECT balance_after FROM treasury_ledger ORDER BY entry_id DESC LIMIT 1`,
    );
    const balance = rows[0].balance_after as bigint;
    const drain = balance - 30n;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await treasuryAppend(client, -drain, 'subsidy_out', null);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const u = await createTestUser(pool, { bankroll: 100 });
    const res = await claim(u);
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error).toBe('treasury_empty');
    const { rows: after } = await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [u.userId]);
    expect(after[0].bankroll as bigint).toBe(100n); // không side effect

    // Hoàn lại Kho bạc cho các test sau
    const client2 = await pool.connect();
    try {
      await client2.query('BEGIN');
      await treasuryAppend(client2, drain, 'unclaimed_pool_in', null);
      await client2.query('COMMIT');
    } finally {
      client2.release();
    }
  });
});
