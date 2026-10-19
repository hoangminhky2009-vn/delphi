/**
 * POOL `max: 1` — CHẠY ĐÚNG RÀNG BUỘC CỦA PROD, KHÔNG PHẢI RÀNG BUỘC CỦA MÁY MÌNH.
 *
 * ─── VÌ SAO CẢ MỘT FILE TEST CHO MỘT CON SỐ CẤU HÌNH ─────────────────────────
 *
 * `api/index.ts` mở pool với **`max: 1`** — đúng cho serverless: mỗi instance chỉ
 * nên giữ MỘT kết nối thật qua transaction pooler của Supabase (D11, C1). Pool ở
 * local và trong mọi test khác mở `max: 5`/`max: 10`.
 *
 * Chênh lệch ấy che một lớp lỗi trọn vẹn: **đang cầm `client` mà lại xin thêm một
 * kết nối từ `pool`**. Ở `max ≥ 2` nó chỉ chậm đi; ở `max: 1` nó là **xin chính cái
 * mình đang giữ** ⇒ chờ vĩnh viễn ⇒ Vercel cắt ở 10,4 giây ⇒ người dùng thấy 504.
 *
 * ⚠⚠ VÀ ĐÂY LÀ LỚP LỖI TEST BÌNH THƯỜNG KHÔNG BAO GIỜ BẮT ĐƯỢC:
 * `tests/discord_cua.test.ts` chạy **10 lượt ghi danh song song** trên đúng đoạn
 * code đã hỏng, và nó XANH. Vì sao: với `max ≥ 2`, chỉ cần MỘT kết nối làm xong
 * việc và nhả ra là hàng đợi nhích một bước, cái vừa nhích lại nhả tiếp — cả đám
 * drain. Với `max: 1` thì kết nối duy nhất đang nằm trong tay chính kẻ đang chờ
 * nó, và không có gì nhả nó ra. Cùng một đoạn code: xanh ở máy mình, chết trên prod.
 *
 * Bug thật 04/08 (`20b4bec`, cửa KHÁCH: `createSession(pool, …)` khi đang cầm
 * `client`). Rà lại cả repo bằng `scripts/lint_pool_lock.ts` moi thêm HAI chỗ:
 * đệ quy thua-đua của `timHoacTao` (⭐ nằm đúng trên đường bắt tay Discord) và
 * nhánh "Kho bạc không đủ" của scheduler (treo cả lượt tick ⇒ C3 chết im lặng).
 *
 * ⇒ HAI LỚP, bắt hai thứ khác nhau:
 *   · lint — tên pool xuất hiện thẳng trong khối đang cầm client (tĩnh, rẻ, quét cả repo);
 *   · file này — đường CHẠY THẬT, bắt được cả đường vòng qua một hàm phụ mà lint
 *     không nhìn thấy.
 *
 * ⚠ MỖI BÀI PHẢI CÓ HẠN GIỜ RIÊNG. Hồi quy ở đây biểu hiện là TREO, không phải
 * assert sai — không kẹp hạn giờ thì test đỏ với thông điệp "timeout" chung chung
 * và người đọc mất một buổi mới hiểu.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { timHoacTao } from '../server/discord.js';
import { runSchedulerPass } from '../server/scheduler.js';
import { currentSeasonId } from '../server/season.js';
import { quetRepo } from '../scripts/lint_pool_lock.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

// D444: secret của tick — dùng cho mục V (donKhachBoHoang đi nhờ /internal/tick).
const TICK_SECRET = 'max1-tick-secret';

beforeAll(async () => {
  // ⭐ ĐÚNG CON SỐ CỦA PROD. Đây là toàn bộ lý do file này tồn tại.
  db = await startTestDb({ max: 1 });
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
    discordClientId: 'test-client', discordClientSecret: 'test-secret',
    tickSecret: TICK_SECRET,
  }) as Hono<any>;
  await ensureGenesis(pool);
}, 180_000);

afterAll(async () => { await db?.stop(); });

/**
 * Kẹp hạn giờ và GỌI TÊN cái hỏng. Bế tắc pool không tự bỏ cuộc (pg không đặt
 * `connectionTimeoutMillis` ở pool test), nên không có cái này thì bài test treo
 * tới lúc vitest giết cả file.
 */
// `app.request` khai kiểu `Response | Promise<Response>` (Hono trả thẳng khi
// không có middleware bất đồng bộ) ⇒ nhận cả hai, đừng bắt chỗ gọi tự bọc.
async function trongHan<T>(viec: Promise<T> | T, ten: string, ms = 15_000): Promise<T> {
  let hetGio: NodeJS.Timeout;
  const chuong = new Promise<never>((_, tuChoi) => {
    hetGio = setTimeout(
      () => tuChoi(new Error(
        `BẾ TẮC POOL: "${ten}" không xong trong ${ms}ms trên pool max:1. ` +
        'Gần như chắc chắn có chỗ đang cầm client mà xin thêm kết nối từ pool ' +
        '(xem scripts/lint_pool_lock.ts).',
      )),
      ms,
    );
  });
  try {
    return await Promise.race([Promise.resolve(viec), chuong]);
  } finally {
    clearTimeout(hetGio!);
  }
}

describe('I. Cửa KHÁCH — bug gốc 04/08, giữ làm bài hồi quy', () => {
  it('POST /auth/khach xong trong hạn và trả token', async () => {
    const r = await trongHan(
      app.request('/api/v1/auth/khach', {
        method: 'POST', headers: { 'x-forwarded-for': '198.51.100.7' },
      }),
      'POST /auth/khach',
    );
    expect(r.status).toBe(200);
    const b: any = await r.json();
    expect(b.la_khach).toBe(true);
    expect(typeof b.token).toBe('string');
  });

  it('token dùng được ngay — phiên tạo TRONG transaction, không phải sau COMMIT', async () => {
    const b: any = await (await trongHan(
      app.request('/api/v1/auth/khach', {
        method: 'POST', headers: { 'x-forwarded-for': '198.51.100.8' },
      }),
      'POST /auth/khach (lượt 2)',
    )).json();
    const me = await trongHan(
      app.request('/api/v1/auth/me', { headers: { authorization: `Bearer ${b.token}` } }),
      'GET /auth/me',
    );
    expect(me.status).toBe(200);
  });
});

describe('II. Ghi danh Discord — đường bắt tay đang chờ thử trên prod', () => {
  it('người mới: tạo tài khoản xong trong hạn', async () => {
    const kq = await trongHan(
      timHoacTao(pool, { id: 'max1-100', ten: 'Người Mới' }, { seasonId: currentSeasonId() }),
      'timHoacTao (người mới)',
    );
    expect(kq.moi).toBe(true);
    expect(kq.userId).toBeTruthy();
  });

  it('người cũ: đi đường SELECT nhanh, vẫn một kết nối', async () => {
    const kq = await trongHan(
      timHoacTao(pool, { id: 'max1-100', ten: 'Người Mới' }, { seasonId: currentSeasonId() }),
      'timHoacTao (người cũ)',
    );
    expect(kq.moi).toBe(false);
  });

  it('⭐ THUA CUỘC ĐUA ghi danh: thử lại có TRẦN, không đệ quy khi đang cầm kết nối', async () => {
    /*
     * Dựng đúng trạng thái đẩy code vào nhánh `ON CONFLICT … DO NOTHING` khớp 0
     * dòng: có `auth_identities` nhưng `auth_accounts.user_id` NULL ⇒ SELECT mở
     * đầu KHÔNG nhận là "đã có", mà INSERT thì đụng UNIQUE.
     *
     * ⚠ Không dựng bằng hai request song song được: trên `max: 1` chúng tự xếp
     * hàng, người thứ hai đi đường SELECT nhanh và không bao giờ chạm nhánh này.
     * Muốn kiểm một nhánh thì phải dựng ĐÚNG tiền đề của nhánh đó.
     *
     * Bản CŨ ở đây: ROLLBACK → gọi lại chính mình trong khi `finally` chưa chạy →
     * xin kết nối thứ hai → treo tới khi vitest giết. Bản MỚI: nhả kết nối, thử
     * lại có trần, hết trần thì NÉM LỖI ĐỌC ĐƯỢC.
     */
    const { rows } = await pool.query(
      `INSERT INTO auth_accounts DEFAULT VALUES RETURNING account_id`);
    await pool.query(
      `INSERT INTO auth_identities (account_id, provider, provider_user_id)
       VALUES ($1, 'discord', $2)`,
      [rows[0].account_id, 'max1-mo-coi'],
    );

    await expect(trongHan(
      timHoacTao(pool, { id: 'max1-mo-coi', ten: 'Mồ Côi' }, { seasonId: currentSeasonId() }),
      'timHoacTao (thua đua)',
    )).rejects.toThrow(/discord_ghi_danh_dua/);
  });
});

describe('III. Scheduler — nhánh Kho bạc không đủ treo cả lượt tick', () => {
  it('⭐ tự mở thất bại vì thiếu quỹ: TẮT CỜ + audit, và lượt tick VẪN XONG', async () => {
    const admin = await createTestUser(pool, { role: 'admin' });
    const { rows } = await pool.query(
      `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url,
                            open_ts, lock_ts, resolve_deadline_ts, status, seed_per_option,
                            season_id, created_by, tu_mo)
       VALUES ('life', 'Seed quá tay (max1)?', 'Nguồn Test', 'https://test.local/nguon',
               now() - interval '1 minute', now() + interval '1 hour',
               now() + interval '2 hours', 'draft', $1, $2, $3, true)
       RETURNING market_id`,
      ['999999999', currentSeasonId(), admin.userId],
    );
    const marketId: string = rows[0].market_id;
    for (let i = 0; i < 2; i += 1) {
      await pool.query(
        `INSERT INTO market_options (market_id, label, sort_order) VALUES ($1, $2, $3)`,
        [marketId, `Cửa ${i + 1}`, i],
      );
    }

    const bc = await trongHan(runSchedulerPass(pool), 'runSchedulerPass (thiếu quỹ)');
    expect(bc.opened).not.toContain(marketId);

    // Cùng bất biến mà `admin_keo.test.ts` khoá — nhắc lại ở đây vì bản vá đổi
    // `pool.query` thành `client.query`, và hai câu đó CỐ Ý nằm ngoài transaction
    // vừa bị huỷ. Đổi nhầm sang trong transaction thì ROLLBACK nuốt mất cả hai.
    const { rows: m } = await pool.query(
      `SELECT status, tu_mo FROM markets WHERE market_id = $1`, [marketId]);
    expect(m[0]).toMatchObject({ status: 'draft', tu_mo: false });
    const { rows: a } = await pool.query(
      `SELECT count(*)::int n FROM admin_audit
        WHERE action = 'market_tu_mo_that_bai' AND payload_json->>'market_id' = $1`, [marketId]);
    expect(a[0].n).toBe(1);
  }, 60_000);
});

describe('IV. Lint tĩnh — quét cả repo, không chỉ mấy đường đã nghĩ ra', () => {
  it('không file nào trong server/ · api/ xin kết nối thứ hai khi đang cầm client', async () => {
    const viPham = await quetRepo();
    expect(
      viPham.map((v) => `${v.file}:${v.dongViPham} → ${v.noiDung}`),
    ).toEqual([]);
  });
});

describe('V. Tick — donKhachBoHoang (D444) đi nhờ /internal/tick, pool max:1', () => {
  it('POST /internal/tick xong trong hạn và trả khach_don, kể cả khi CÓ khách bị dọn thật', async () => {
    /*
     * ⚠ Phải có ÍT NHẤT MỘT ứng viên đủ điều kiện — nếu không, nhánh vòng lặp
     * `pool.connect()` mỗi khách bên trong `donKhachBoHoang` không bao giờ
     * chạy, và bài này chỉ đo được câu SELECT ứng viên (không đo được đúng
     * lớp lỗi 04/08 mà cả tệp này tồn tại để canh: đang cầm client rồi xin
     * thêm một kết nối từ pool).
     */
    const { rows } = await pool.query(
      `INSERT INTO users (handle, season_id, la_khach, research_consent, created_at)
       VALUES ('max1_khach_bo_hoang', $1, true, false, now() - interval '31 days')
       RETURNING user_id`,
      [currentSeasonId()],
    );
    const userId = rows[0].user_id as string;
    await pool.query(
      `INSERT INTO auth_accounts (user_id, created_at) VALUES ($1, now() - interval '31 days')`,
      [userId],
    );

    const r = await trongHan(
      app.request('/api/v1/internal/tick', {
        method: 'POST', headers: { 'x-tick-secret': TICK_SECRET },
      }),
      'POST /internal/tick (donKhachBoHoang có ứng viên thật)',
      20_000,
    );
    expect(r.status).toBe(200);
    const b: any = await r.json();
    expect(b.khach_don).toMatchObject({ da_don: expect.any(Number), bo_qua: expect.any(Number) });
    expect(b.khach_don.da_don).toBeGreaterThanOrEqual(1);

    const { rows: con } = await pool.query(`SELECT 1 FROM users WHERE user_id = $1`, [userId]);
    expect(con).toHaveLength(0);
  });
});
