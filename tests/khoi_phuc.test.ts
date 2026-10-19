/**
 * Khôi phục backup (scripts/khoi_phuc.ts) — vòng kín bằng đồ THẬT: hai Postgres nhúng.
 *   DB A có dữ liệu → collectBackup(A) → khoiPhuc(B trống) → collectBackup(B) ⇒ từng bảng phải y hệt A.
 *
 * ⚠ VÌ SAO SO CẢ BẢNG CHỨ KHÔNG SO SỐ DÒNG: số dòng khớp mà nội dung sai là ca dễ nhất để lọt — jsonb nạp thành
 * mảng Postgres, `date` lùi một ngày, BIGINT thành float. So bản backup thứ hai với bản thứ nhất bắt được mọi
 * thứ mà đường backup nhìn thấy, mà không phải liệt kê kiểu cột nào.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import zlib from 'node:zlib';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, createTestMarket, xongBanTap } from './helpers/fixtures.js';
import { collectBackup } from '../server/backup.js';
import { auditSupply } from '../server/audit.js';
import { khoiPhuc, doiChieu, type TepBackup } from '../scripts/khoi_phuc.js';

let a: TestDb;
let b: TestDb;
let tep: TepBackup;

const moTep = (buf: Buffer): TepBackup => JSON.parse(zlib.gunzipSync(buf).toString('utf8')) as TepBackup;
const sapXep = (dong: unknown[]): string[] => dong.map((r) => JSON.stringify(r)).sort();

beforeAll(async () => {
  [a, b] = await Promise.all([startTestDb(), startTestDb()]);
  await ensureGenesis(a.pool);
  const u1 = await createTestUser(a.pool);
  const u2 = await createTestUser(a.pool, { role: 'admin' });
  await xongBanTap(a.pool, u1);
  await createTestMarket(a.pool, { createdBy: u2.userId, seedPerOption: 50 });
  // Admin ĐÃ bật 2FA — ca làm đổ diễn tập thật đầu tiên 11/10 (auth_accounts_totp_chk, xem DAT_LAI_KHI_NAP).
  await a.pool.query(
    `INSERT INTO auth_accounts (email, password_hash, user_id, totp_secret, totp_confirmed_at, totp_buoc_cuoi)
     VALUES ('admin-2fa-kp@t.vn', 'x', $1, 'JBSWY3DPEHPK3PXP', now(), 123)
     ON CONFLICT (user_id) DO UPDATE SET totp_secret = EXCLUDED.totp_secret,
       totp_confirmed_at = EXCLUDED.totp_confirmed_at, totp_buoc_cuoi = EXCLUDED.totp_buoc_cuoi`, [u2.userId]);
  // jsonb có MẢNG — `pg` nạp mảng JS thành mảng Postgres nếu không stringify ⇒ đỏ.
  await a.pool.query(
    `INSERT INTO events (user_id, context_type, context_id, action_type, value_num, value_json)
     VALUES ($1, 'khoi_phuc', 'x', 'market_view', 7, '{"cac":[1,2,3],"chu":"đ"}'::jsonb)`, [u1.userId]);
  await a.pool.query(
    `INSERT INTO pfm_ngay (user_id, ngay, trang_thai) VALUES ($1, DATE '2026-09-16', 'co_ghi')`, [u1.userId]);
  expect((await auditSupply(a.pool)).ok, 'DB nguồn phải CÂN trước khi so').toBe(true);
  tep = moTep((await collectBackup(a.pool)).buffer);
}, 240_000);

afterAll(async () => {
  await Promise.all([a?.stop(), b?.stop()]);
});

describe('khoiPhuc — vòng kín backup → DB trống → backup lại', () => {
  it('⭐ mọi bảng của bản backup thứ hai y hệt bản thứ nhất; đối chiếu 0 lệch · 0 mồ côi; audit CÂN', async () => {
    const kq = await khoiPhuc(b.pool, tep);
    expect(kq.cotThua).toEqual([]);
    expect(kq.bangLech).toEqual([]);
    expect(kq.datLai).toEqual([
      { bang: 'auth_accounts', cot: 'totp_confirmed_at', so_dong: 1 },
      { bang: 'auth_accounts', cot: 'totp_buoc_cuoi', so_dong: 1 },
    ]);

    // Kỳ vọng = tệp gốc với đúng hai ô 2FA đã đặt lại — không hơn.
    const kyVong: TepBackup = structuredClone(tep);
    for (const r of kyVong.tables.auth_accounts ?? []) { r.totp_confirmed_at = null; r.totp_buoc_cuoi = null; }
    const lai = moTep((await collectBackup(b.pool)).buffer);
    for (const t of Object.keys(kyVong.tables)) {
      expect(sapXep(lai.tables[t] ?? []), `bảng ${t} khác sau khôi phục`).toEqual(sapXep(kyVong.tables[t] ?? []));
    }
    expect(tep.row_counts.events).toBeGreaterThan(0);
    expect(tep.row_counts.users).toBeGreaterThanOrEqual(2);

    const dc = await doiChieu(b.pool, tep);
    expect(dc).toEqual({ lechSoDong: [], moCoi: [] });
    expect((await auditSupply(b.pool)).ok).toBe(true);
  });

  it('sequence được đặt lại: dòng mới sau khôi phục không đụng khoá chính', async () => {
    // events.id là khoá tự tăng — sequence đứng ở 1 thì INSERT này vấp 23505.
    await expect(b.pool.query(
      `INSERT INTO events (user_id, context_type, context_id, action_type) VALUES (NULL, 'sau_khoi_phuc', 'y', 'market_view')`,
    )).resolves.toBeDefined();
  });

  it('⚠ từ chối nạp vào DB đang có `events` (A3.3) — và không để lại gì dở dang', async () => {
    const truoc = (await b.pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
    await expect(khoiPhuc(b.pool, tep)).rejects.toThrow(/từ chối khôi phục đè/);
    const sau = (await b.pool.query('SELECT count(*)::int AS n FROM users')).rows[0].n;
    expect(sau).toBe(truoc);
  });

  it('doiChieu bắt được dòng mồ côi (nạp đã tắt kiểm khoá ngoại, nên đây là lưới duy nhất)', async () => {
    /*
     * Dựng mồ côi đúng cách khoiPhuc có thể tạo ra nó: chèn dưới `replica` (khoá ngoại không kiểm).
     * Không dựng DB nhúng thứ ba cho bài này — Windows hết tài nguyên ở instance thứ ba (win32 1450, 11/10).
     */
    const c = await b.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SET LOCAL session_replication_role = replica');
      await c.query(
        `INSERT INTO pfm_ngay (user_id, ngay, trang_thai) VALUES (gen_random_uuid(), DATE '2026-09-17', 'co_ghi')`);
      await c.query('COMMIT');
    } finally {
      c.release();
    }
    const dc = await doiChieu(b.pool, tep);
    expect(dc.moCoi.map((m) => m.bang), 'một dòng pfm_ngay không có users mà đối chiếu không thấy ⇒ mù').toContain('pfm_ngay');
  });

  it('doiChieu bắt được lệch số dòng giữa tệp và DB', async () => {
    const sai: TepBackup = { ...tep, row_counts: { ...tep.row_counts, users: (tep.row_counts.users ?? 0) + 1 } };
    const dc = await doiChieu(b.pool, sai);
    expect(dc.lechSoDong.map((l) => l.bang)).toContain('users');
  });
});
