/**
 * GĐ1 việc 6 — Unit test cơ chế bảo vệ tầng DB:
 * append-only, CHECK constraints, UNIQUE chống trùng, tường lửa T↔Q.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { runMigrations } from '../scripts/migrate.js';

/** Gốc repo — file này nằm ở `tests/`, nên lùi một cấp. */
const ROOT = path.join(import.meta.dirname, '..');

let db: TestDb;
let pool: pg.Pool;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
});

afterAll(async () => {
  await db?.stop();
});

// ---------- fixtures ----------

async function createUser(handle: string, overrides: Record<string, unknown> = {}): Promise<string> {
  const cols = {
    handle,
    age_band: '18-22',
    region: 'bac',
    occupation_band: 'hs_sv',
    bankroll: '1000',
    role: 'user',
    season_id: '2026Q3',
    ...overrides,
  };
  const keys = Object.keys(cols);
  const { rows } = await pool.query(
    `INSERT INTO users (${keys.join(', ')})
     VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING user_id`,
    Object.values(cols),
  );
  return rows[0].user_id;
}

async function createMarket(createdBy: string): Promise<{ marketId: string; optionIds: string[] }> {
  const { rows } = await pool.query(
    `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url,
                          open_ts, lock_ts, resolve_deadline_ts, status, seed_per_option, season_id, created_by)
     VALUES ('macro', 'Kèo test?', 'GSO', 'https://gso.gov.vn',
             now() - interval '1 hour', now() + interval '1 day', now() + interval '2 days',
             'open', 0, '2026Q3', $1)
     RETURNING market_id`,
    [createdBy],
  );
  const marketId = rows[0].market_id;
  const optionIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const o = await pool.query(
      `INSERT INTO market_options (market_id, label, sort_order) VALUES ($1, $2, $3) RETURNING option_id`,
      [marketId, `Cửa ${i + 1}`, i],
    );
    optionIds.push(o.rows[0].option_id);
  }
  return { marketId, optionIds };
}

// ---------- migrations ----------

describe('migrations', () => {
  /*
   * DANH SÁCH SUY TỪ THƯ MỤC, KHÔNG GÕ TAY NỮA.
   *
   * Bản cũ ghim cứng 13 tên. Điều đó biến file này thành một CỔ CHAI: mỗi người
   * thêm một migration đều phải sửa đúng mảng này, nên khi bốn luồng làm song song
   * (27/07: shop 0015 · nhiệm vụ 0016 · rank 0017 · đồng hồ 0018) thì cả bốn giành
   * nhau một chỗ, và ai merge sau sẽ xoá tên của người merge trước — im lặng, chỉ
   * lộ ra bằng một test đỏ khó đọc.
   *
   * Điều test này THẬT SỰ muốn canh là "mọi migration có trong repo đều đã được áp
   * lên một DB trắng" — và đọc thư mục kiểm đúng điều đó CHẶT HƠN mảng gõ tay: mảng
   * còn có thể quên tên, thư mục thì không.
   *
   * Vẫn giữ hai bất biến mà mảng cũ cho không: thứ tự phải TĂNG DẦN theo số hiệu,
   * và không được nhảy cóc trùng số. `0014` CỐ Ý TRỐNG (D33 không cần cột mới) nên
   * phép kiểm là "không TRÙNG số", không phải "liên tục".
   */
  it('áp dụng đủ migration trên DB trắng — so với thư mục, không so mảng gõ tay', async () => {
    const tepTrongRepo = (await readdir(path.join(ROOT, 'migrations')))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const { rows } = await pool.query('SELECT name FROM schema_migrations ORDER BY name');

    expect(rows.map((r) => r.name)).toEqual(tepTrongRepo);
    // Chống xanh rỗng: thư mục trống thì hai mảng bằng nhau mà chẳng kiểm gì.
    expect(tepTrongRepo.length, 'không đọc được migration nào').toBeGreaterThan(10);

    const so = tepTrongRepo.map((f) => Number(f.slice(0, 4)));
    expect(new Set(so).size, `trùng số hiệu migration: ${tepTrongRepo.join(', ')}`)
      .toBe(so.length);
    expect([...so].sort((a, b) => a - b), 'tên tệp phải sắp đúng theo số hiệu')
      .toEqual(so);
  });

  it('chạy lại lần 2 không lỗi, không áp dụng gì thêm (idempotent)', async () => {
    const applied = await runMigrations(pool);
    expect(applied).toEqual([]);
  });

  it('đủ bảng đúng tên theo A6', async () => {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const names = new Set(rows.map((r) => r.table_name));
    for (const t of [
      'users', 'markets', 'market_options', 'bets',
      'wallet_ledger', 'treasury_ledger', 'burn_ledger',
      'scores', 'rank_snapshots', 'events', 'admin_audit',
      'scheduler_heartbeat',
    ]) {
      expect(names, `thiếu bảng ${t}`).toContain(t);
    }
  });

  it('RLS bật trên mọi bảng public (khóa PostgREST — 0006)', async () => {
    const { rows } = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'
       AND NOT rowsecurity ORDER BY tablename`,
    );
    expect(rows.map((r) => r.tablename)).toEqual([]);
  });
});

// ---------- append-only ----------

describe('append-only (A3.3, A3.10)', () => {
  it('events: UPDATE bị chặn', async () => {
    await pool.query(
      `INSERT INTO events (context_type, action_type) VALUES ('test', 'market_view')`,
    );
    await expect(
      pool.query(`UPDATE events SET context_type = 'sua' WHERE context_type = 'test'`),
    ).rejects.toThrow(/append-only/);
  });

  it('events: DELETE bị chặn', async () => {
    await expect(pool.query(`DELETE FROM events`)).rejects.toThrow(/append-only/);
  });

  it('events: TRUNCATE bị chặn', async () => {
    await expect(pool.query(`TRUNCATE events`)).rejects.toThrow(/append-only/);
  });

  it('wallet_ledger / treasury_ledger / burn_ledger / admin_audit: UPDATE và DELETE bị chặn', async () => {
    const uid = await createUser('ledger_user');
    await pool.query(
      `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason) VALUES ($1, 10, 1010, 'admin_adjust')`,
      [uid],
    );
    await pool.query(
      `INSERT INTO treasury_ledger (delta, balance_after, reason) VALUES (5, 5, 'rake_in')`,
    );
    await pool.query(`INSERT INTO burn_ledger (amount, reason) VALUES (3, 'rake_burn')`);
    await pool.query(
      `INSERT INTO admin_audit (admin_id, action) VALUES ($1, 'test_action')`,
      [uid],
    );

    for (const table of ['wallet_ledger', 'treasury_ledger', 'burn_ledger', 'admin_audit']) {
      await expect(pool.query(`DELETE FROM ${table}`)).rejects.toThrow(/append-only/);
    }
    await expect(pool.query(`UPDATE wallet_ledger SET delta = 99`)).rejects.toThrow(/append-only/);
    await expect(pool.query(`UPDATE treasury_ledger SET delta = 99`)).rejects.toThrow(/append-only/);
    await expect(pool.query(`UPDATE burn_ledger SET amount = 99`)).rejects.toThrow(/append-only/);
    await expect(pool.query(`UPDATE admin_audit SET action = 'x'`)).rejects.toThrow(/append-only/);
  });
});

// ---------- CHECK constraints ----------

describe('CHECK constraints', () => {
  it('bankroll âm bị từ chối', async () => {
    await expect(createUser('am_bankroll', { bankroll: '-1' })).rejects.toThrow(/bankroll/);
  });

  it('handle sai định dạng bị từ chối', async () => {
    await expect(createUser('AB')).rejects.toThrow(/handle/);
  });

  it('bet amount 0 bị từ chối', async () => {
    const uid = await createUser('bet_zero');
    const { marketId, optionIds } = await createMarket(uid);
    await expect(
      pool.query(
        `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed) VALUES ($1, $2, $3, 0, FALSE)`,
        [marketId, optionIds[0], uid],
      ),
    ).rejects.toThrow(/amount/);
  });

  it('wallet_ledger delta = 0 và balance_after âm bị từ chối', async () => {
    const uid = await createUser('wl_check');
    await expect(
      pool.query(
        `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason) VALUES ($1, 0, 100, 'admin_adjust')`,
        [uid],
      ),
    ).rejects.toThrow(/delta/);
    await expect(
      pool.query(
        `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason) VALUES ($1, -10, -10, 'admin_adjust')`,
        [uid],
      ),
    ).rejects.toThrow(/balance_after/);
  });

  it('markets: lock_ts ≤ open_ts bị từ chối', async () => {
    const uid = await createUser('mk_time');
    await expect(
      pool.query(
        `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url,
                              open_ts, lock_ts, resolve_deadline_ts, season_id, created_by)
         VALUES ('macro', 'q', 'src', 'https://x', now(), now() - interval '1 hour', now(), '2026Q3', $1)`,
        [uid],
      ),
    ).rejects.toThrow();
  });

  it('markets: status = resolved mà thiếu outcome bị từ chối', async () => {
    const uid = await createUser('mk_resolved');
    await expect(
      pool.query(
        `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url,
                              open_ts, lock_ts, resolve_deadline_ts, status, season_id, created_by)
         VALUES ('macro', 'q', 'src', 'https://x',
                 now() - interval '2 hour', now() - interval '1 hour', now(), 'resolved', '2026Q3', $1)`,
        [uid],
      ),
    ).rejects.toThrow();
  });

  it('events: action_type ngoài danh mục A7 bị từ chối', async () => {
    await expect(
      pool.query(`INSERT INTO events (context_type, action_type) VALUES ('test', 'hack_action')`),
    ).rejects.toThrow(/action_type/);
  });
});

// ---------- UNIQUE chống trùng ----------

describe('UNIQUE chống trùng bets', () => {
  it('một user không thể có 2 dòng bet cùng (market, option)', async () => {
    const uid = await createUser('dup_bet');
    const { marketId, optionIds } = await createMarket(uid);
    await pool.query(
      `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed) VALUES ($1, $2, $3, 10, FALSE)`,
      [marketId, optionIds[0], uid],
    );
    await expect(
      pool.query(
        `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed) VALUES ($1, $2, $3, 20, FALSE)`,
        [marketId, optionIds[0], uid],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it('mỗi option chỉ có 1 dòng seed', async () => {
    const uid = await createUser('dup_seed');
    const { marketId, optionIds } = await createMarket(uid);
    await pool.query(
      `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed) VALUES ($1, $2, NULL, 100, TRUE)`,
      [marketId, optionIds[0]],
    );
    await expect(
      pool.query(
        `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed) VALUES ($1, $2, NULL, 100, TRUE)`,
        [marketId, optionIds[0]],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it('seed có user_id hoặc bet người chơi thiếu user_id đều bị từ chối (A3.6)', async () => {
    const uid = await createUser('seed_shape');
    const { marketId, optionIds } = await createMarket(uid);
    await expect(
      pool.query(
        `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed) VALUES ($1, $2, $3, 100, TRUE)`,
        [marketId, optionIds[1], uid],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query(
        `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed) VALUES ($1, $2, NULL, 100, FALSE)`,
        [marketId, optionIds[1]],
      ),
    ).rejects.toThrow();
  });

  it('handle trùng bị từ chối', async () => {
    await createUser('trung_handle');
    await expect(createUser('trung_handle')).rejects.toThrow(/duplicate key/);
  });
});

// ---------- Tường lửa T↔Q ----------

describe('tường lửa T↔Q (A3.5)', () => {
  /*
   * ⚠ HỢP ĐỒNG NÀY ĐÃ ĐỔI Ở 0016 (lộ trình mùa 0.0 = vòi Q đầu tiên, thi hành D16).
   *
   * Trước: `users_quest_points_frozen` cấm MỌI thay đổi `quest_points` (đúng cho
   * v0.1 vì chưa có hệ quest nào).
   * Nay:   thay bằng constraint trigger DEFERRABLE — chỉ đổi được khi có một dòng
   *        `quest_ledger` khớp trong CÙNG transaction.
   *
   * Tường lửa T↔Q KHÔNG bị nới, nó CHUYỂN CHỖ: nó nằm ở DANH MỤC `reason` của hai
   * sổ, và test dưới khẳng định hai danh mục giao nhau = ∅. Đó là lý do bài test
   * này giữ nguyên tên: thứ được canh vẫn là "không có đường nào từ T sang Q".
   */
  it('đổi quest_points mà không có dòng sổ ⟹ bị chặn ở tầng DB', async () => {
    const uid = await createUser('quest_user');
    await expect(
      pool.query(`UPDATE users SET quest_points = 5 WHERE user_id = $1`, [uid]),
    ).rejects.toThrow(/quest_ledger|quest_points/);
    // đổi bankroll bình thường vẫn được (không phải khóa cả bảng users)
    await pool.query(`UPDATE users SET bankroll = 900 WHERE user_id = $1`, [uid]);
    const { rows } = await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [uid]);
    expect(rows[0].bankroll).toBe(900n);
  });

  it('cửa duy nhất: đổi quest_points KÈM dòng sổ khớp trong cùng transaction', async () => {
    const uid = await createUser('quest_user_co_so');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO quest_ledger (user_id, delta, balance_after, reason, season_id)
         VALUES ($1, 60, 60, 'lo_trinh_moc', 'beta-0.0')`,
        [uid],
      );
      await client.query(`UPDATE users SET quest_points = 60 WHERE user_id = $1`, [uid]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    const { rows } = await pool.query(
      `SELECT quest_points FROM users WHERE user_id = $1`, [uid]);
    expect(Number(rows[0].quest_points)).toBe(60);

    // Ví LỆCH sổ vẫn bị chặn — cửa hẹp, không phải cửa mở.
    const c2 = await pool.connect();
    try {
      await c2.query('BEGIN');
      await c2.query(`UPDATE users SET quest_points = 999 WHERE user_id = $1`, [uid]);
      await expect(c2.query('COMMIT')).rejects.toThrow(/lệch dòng cuối/);
    } finally {
      await c2.query('ROLLBACK').catch(() => {});
      c2.release();
    }
  });

  it('danh mục reason của sổ Q và ví T KHÔNG có giá trị nào chung', async () => {
    const doc = async (ten: string): Promise<string[]> => {
      const { rows } = await pool.query(
        `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = $1`,
        [ten],
      );
      return [...String(rows[0].d).matchAll(/'([a-z_0-9]+)'::text/g)].map((m) => m[1]!);
    };
    const q = await doc('quest_ledger_reason_check');
    const t = await doc('wallet_ledger_reason_check');
    expect(q.length).toBeGreaterThan(0);
    expect(q.filter((r) => t.includes(r))).toEqual([]);
  });
});
