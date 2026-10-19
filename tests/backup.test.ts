/**
 * Backup đêm (D11) — test bằng đồ THẬT: embedded Postgres + gzip thật + Hono app.
 * Phần đẩy GitHub (mạng) được tiêm qua deps.runBackup nên test cổng bảo vệ +
 * dây nối mà không chạm internet. collectBackup thì chạy thẳng trên DB thật.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import zlib from 'node:zlib';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import {
  collectBackup, backupPath, BACKUP_PAGE, BACKUP_TABLES, BANG_PHU_DU,
} from '../server/backup.js';
import { createTestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';

let db: TestDb;
let pool: pg.Pool;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
});

afterAll(async () => {
  await db?.stop();
});

function gunzipJson(buffer: Buffer): any {
  return JSON.parse(zlib.gunzipSync(buffer).toString('utf8'));
}

describe('collectBackup — đọc-thuần, gói toàn bảng lõi', () => {
  it('gồm mọi bảng lõi, loại bảng phù du, gzip mở ra JSON hợp lệ', async () => {
    const { buffer, rowCounts } = await collectBackup(pool);
    const doc = gunzipJson(buffer);

    for (const t of BACKUP_TABLES) {
      expect(doc.tables[t], `thiếu bảng ${t}`).toBeDefined();
      expect(doc.row_counts[t]).toBe(rowCounts[t]);
    }
    // Bảng phù du KHÔNG được đưa vào backup
    expect(doc.tables.auth_sessions).toBeUndefined();
    expect(doc.tables.auth_tokens).toBeUndefined();
    expect(doc.tables.scheduler_heartbeat).toBeUndefined();

    expect(typeof doc.meta.generated_at).toBe('string');
    expect(doc.meta.format).toBe(1);
  });

  it('PHÂN TRANG: bảng vượt một trang vẫn ra ĐỦ và KHÔNG lặp dòng', async () => {
    /*
     * ⚠ TEST NÀY LÀ LÝ DO CỦA CẢ BẢN VÁ (03/08). Bản cũ đọc `SELECT * FROM
     * events` một phát nên hết bộ nhớ ở mốc tải C2; bản mới đọc theo trang.
     * Nhưng phân trang là chỗ kinh điển để mất dòng (OFFSET trôi khi thứ tự
     * không ổn định) hoặc lặp dòng — và bộ test cũ chỉ có vài dòng dữ liệu,
     * tức CHƯA BAO GIỜ chạm sang trang thứ hai. Xanh mà không chứng minh gì.
     */
    const n = BACKUP_PAGE + 137; // cố ý lẻ: bắt cả lỗi biên "đúng bội số trang"
    await pool.query(
      `INSERT INTO events (user_id, context_type, context_id, action_type, value_num)
       SELECT NULL, 'test_phan_trang', g::text, 'market_view', g
         FROM generate_series(1, $1) AS g`, [n]);

    const { buffer, rowCounts } = await collectBackup(pool);
    const doc = gunzipJson(buffer);
    const rows = doc.tables.events.filter(
      (r: any) => r.context_type === 'test_phan_trang');

    expect(rowCounts.events).toBe(doc.tables.events.length);
    expect(rows.length, 'phải đủ số dòng, không rơi trang nào').toBe(n);
    const ids = new Set(rows.map((r: any) => String(r.context_id)));
    expect(ids.size, 'không dòng nào bị đọc hai lần').toBe(n);

    /*
     * KHÔNG dọn dẹp: `events` là APPEND-ONLY (A3.3) và trigger DB từ chối
     * DELETE — bản đầu của test này có dòng dọn và DB chặn đúng luật. Dòng
     * thừa ở lại không phiền ai vì các khẳng định trên đều LỌC theo
     * context_type, và một bộ test làm bẩn được bảng sản phẩm thật thì mới
     * là thứ đáng lo.
     */
  });

  it('token BigInt được lưu thành CHUỖI số nguyên (không mất số, không float)', async () => {
    // Genesis Kho bạc 20.000 T — delta/balance_after là BIGINT → BigInt trong JS.
    await pool.query(
      `INSERT INTO treasury_ledger (delta, balance_after, reason)
       VALUES (20000, 20000, 'genesis_grant')`,
    );

    const { buffer } = await collectBackup(pool);
    const doc = gunzipJson(buffer);

    expect(doc.row_counts.treasury_ledger).toBe(1);
    const row = doc.tables.treasury_ledger[0];
    expect(row.delta).toBe('20000');
    expect(row.balance_after).toBe('20000');
    expect(row.reason).toBe('genesis_grant');
  });

  it('⭐ cột kiểu `date` ra CHUỖI YYYY-MM-DD — không đổi theo giờ của máy chạy backup (D364)', async () => {
    /*
     * `pg` dựng cột `date` thành `Date` ở nửa đêm GIỜ MÁY, rồi `JSON.stringify` gọi
     * `toISOString()`. Cron Vercel (UTC) ghi ra `"2026-09-16T00:00:00.000Z"`, còn
     * `npm run backup:push` chạy tay trên máy ở VN (+07) ghi ra `"2026-09-15T17:00:00.000Z"`
     * — LÙI MỘT NGÀY. Bản khôi phục thảm hoạ không được phụ thuộc máy nào bấm nút.
     *
     * ⚠ Bài này đỏ ở CẢ HAI múi giờ nếu bản vá bị gỡ: giữ nguyên `Date` thì chuỗi luôn có
     * 'T', dù máy chạy ở đâu.
     */
    const u = await createTestUser(pool);
    await pool.query(
      `INSERT INTO pfm_ngay (user_id, ngay, trang_thai) VALUES ($1, DATE '2026-09-16', 'co_ghi')`,
      [u.userId]);

    const { buffer } = await collectBackup(pool);
    const doc = gunzipJson(buffer);
    const dong = doc.tables.pfm_ngay.find((r: any) => r.user_id === u.userId);
    expect(dong, 'thiếu dòng vừa chèn').toBeDefined();
    expect(dong.ngay).toBe('2026-09-16');
  });

  it('⚠⚠ KHÔNG BAO GIỜ đẩy `totp_secret` ra ngoài (rà soát 11/08)', async () => {
    /*
     * Bản backup đi lên một repo GitHub — một hệ thống THỨ BA — mỗi đêm.
     * `auth_accounts.totp_secret` là BÍ MẬT CHIA SẺ lưu BẢN GỐC (không băm
     * được: máy chủ phải tự tính lại mã để so — D61). `SELECT *` lấy mọi cột,
     * nên ai đọc được backup là đọc được lớp khoá thứ hai của cửa admin.
     *
     * Đây là lớp lỗi "hai quyết định đúng va nhau": danh sách bảng backup viết
     * TRƯỚC, cột `totp_secret` thêm SAU (D61), không có gì báo.
     */
    await pool.query(
      `INSERT INTO auth_accounts (email, password_hash, totp_secret)
       VALUES ($1, 'x', 'JBSWY3DPEHPK3PXP')`,
      [`totp-${Date.now()}@t.vn`]);

    const { buffer } = await collectBackup(pool);
    const raw = zlib.gunzipSync(buffer).toString('utf8');
    expect(raw, 'bí mật 2FA lọt vào file backup ⇒ nó không còn là bí mật')
      .not.toContain('JBSWY3DPEHPK3PXP');
    expect(raw, 'kể cả tên cột cũng không nên xuất hiện — nó chỉ dẫn tới thứ cần che')
      .not.toContain('totp_secret');

    // ĐỐI CHỨNG: bảng vẫn phải CÓ trong backup (nó nối user_id ↔ danh tính
    // đăng nhập; bỏ cả bảng là bản khôi phục thảm hoạ không biết ai là ai).
    const doc = JSON.parse(raw) as { tables: Record<string, unknown[] | undefined> };
    const hang = doc.tables.auth_accounts ?? [];
    expect(hang.length, 'loại CỘT, không loại BẢNG').toBeGreaterThan(0);
    expect(Object.keys(hang[0] as object)).toContain('account_id');
  });

  it('⭐ MỌI bảng có trong DB đều PHẢI được quyết: sao lưu, hoặc loại CÓ TÊN',
    async () => {
      /*
       * Danh sách backup viết ở GĐ4 rồi đứng yên trong khi repo mọc thêm cả
       * đấu trường, rank, cosmetic, quà beta. Rà 11/08 đo được nó bỏ sót 20
       * bảng CÓ DỮ LIỆU THẬT, trong đó 4 bảng APPEND-ONLY — tức thứ A3.3 bảo
       * vệ vì không dựng lại được, mà bản khôi phục thảm hoạ lại không có.
       *
       * Bài này không đòi sao lưu tất cả — nó đòi MỖI BẢNG PHẢI CÓ MỘT QUYẾT
       * ĐỊNH. Thêm bảng mới mà quên là đỏ, và người sửa buộc phải chọn: đưa
       * vào backup, hay khai vào danh sách loại (kèm lý do trong code).
       */
      const { rows } = await pool.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
      const trongDb = rows.map((r) => r.tablename);
      const daQuyet = new Set<string>([...BACKUP_TABLES, ...BANG_PHU_DU]);
      const boSot = trongDb.filter(
        (t) => !daQuyet.has(t) && !t.startsWith('_') && t !== 'schema_migrations');
      expect(boSot,
        'bảng chưa ai quyết số phận — đưa vào BACKUP_TABLES, hoặc khai vào '
        + 'BANG_PHU_DU kèm lý do vì sao mất được').toEqual([]);
    });

  it('backupPath sinh đường dẫn duy nhất theo mốc UTC', () => {
    const p = backupPath(new Date('2026-07-18T02:05:09Z'));
    expect(p).toBe('backups/2026/07/18/delphi-20260718T020509Z.json.gz');
  });
});

describe('GET /internal/backup — cổng bảo vệ + dây nối', () => {
  let app: Hono<any>;
  let calls: number;

  beforeAll(() => {
    calls = 0;
    app = createApp({
      pool,
      mailer: new CapturingMailer(),
      appBaseUrl: 'https://dubao.test',
      backupSecret: 'cron-secret-abc',
      runBackup: async () => {
        calls += 1;
        return { path: 'backups/x.json.gz', bytes: 42, rowCounts: { events: 0 }, pushed: true };
      },
      secureCookie: false,
    }) as Hono<any>;
  });

  const call = (headers: Record<string, string> = {}) =>
    app.request('/api/v1/internal/backup', { method: 'GET', headers });

  it('thiếu secret → 401, không chạy backup', async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect(calls).toBe(0);
  });

  it('sai secret → 401', async () => {
    const res = await call({ 'x-cron-secret': 'sai-be-bét' });
    expect(res.status).toBe(401);
    expect(calls).toBe(0);
  });

  it('đúng secret qua x-cron-secret → 200, chạy đúng một lần', async () => {
    const res = await call({ 'x-cron-secret': 'cron-secret-abc' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.path).toBe('backups/x.json.gz');
    expect(body.pushed).toBe(true);
    expect(calls).toBe(1);
  });

  it('đúng secret qua Authorization: Bearer (đường Vercel cron) → 200', async () => {
    const res = await call({ authorization: 'Bearer cron-secret-abc' });
    expect(res.status).toBe(200);
    expect(calls).toBe(2);
  });

  it('chưa cấu hình runBackup → 501 dù secret đúng (không mở cửa hớ)', async () => {
    const bare = createApp({
      pool,
      mailer: new CapturingMailer(),
      appBaseUrl: 'https://dubao.test',
      backupSecret: 'cron-secret-abc',
      secureCookie: false,
    }) as Hono<any>;
    const res = await bare.request('/api/v1/internal/backup', {
      method: 'GET',
      headers: { 'x-cron-secret': 'cron-secret-abc' },
    });
    expect(res.status).toBe(501);
    const body = (await res.json()) as any;
    expect(body.error).toBe('not_configured');
  });
});
