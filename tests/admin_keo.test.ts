/**
 * BƯỚC 4 — TIỆN DỤNG QUẢN KÈO (bản yêu cầu 01 §5).
 *
 * ⚠ Hai bất biến quan trọng hơn cả bốn tính năng cộng lại:
 *  1. SỬA CHỈ KHI CÒN NHÁP. Kèo đã mở mà đổi câu hỏi hay đổi cửa là đổi luật
 *     giữa chừng với người đang giữ token trong đó.
 *  2. HẸN GIỜ MỞ PHẢI QUA CỬA NẶNG. Bật cờ đó là uỷ quyền trước một khoản chi
 *     Kho bạc sẽ tự chạy lúc không ai ngồi đó — nếu cửa nhẹ mở được nó thì
 *     `requireXacThucLai` của bước 2 bị đi vòng bằng hai cú bấm.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { runSchedulerPass } from '../server/scheduler.js';
import { kiemThanKeo } from '../server/admin_keo.js';
import { auditSupply } from '../scripts/audit_supply.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let admin: TestUser;
let thuong: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  admin = await createTestUser(pool, { role: 'admin', bankroll: 0 });
  await moCuaAdmin(pool, admin);
  thuong = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

const goi = async (
  path: string,
  opts: { method?: string; body?: unknown; u?: TestUser } = {},
): Promise<Response> =>
  app.request(path, {
    method: opts.method ?? 'GET',
    headers: { 'content-type': 'application/json', cookie: (opts.u ?? admin).cookie },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
const j = (r: Response): Promise<any> => r.json() as Promise<any>;

const gio = (lech: number) => new Date(Date.now() + lech).toISOString();
const than = (over: Record<string, unknown> = {}) => ({
  pool: 'life',
  question_text: 'Giá xăng RON95 tuần tới?',
  resolution_source_name: 'Petrolimex',
  resolution_source_url: 'https://petrolimex.test/gia',
  open_ts: gio(60_000),
  lock_ts: gio(3600_000),
  resolve_deadline_ts: gio(7200_000),
  seed_per_option: 0,
  options: [{ label: 'Tăng' }, { label: 'Giảm' }],
  ...over,
});

/** Tạo draft qua đường admin thường, trả market_id. */
async function taoDraft(over: Record<string, unknown> = {}): Promise<string> {
  const r = await goi('/api/v1/admin/markets', { method: 'POST', body: than(over) });
  expect(r.status).toBe(201);
  return (await j(r)).market_id as string;
}

/** Làm tươi mốc xác thực lại để đi qua cửa nặng. */
const moCuaNang = () =>
  pool.query(
    `UPDATE auth_sessions s SET xac_thuc_lai_luc = now()
       FROM auth_accounts a
      WHERE a.account_id = s.account_id AND a.email = $1`,
    [`${admin.handle}@test.local`],
  );

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Kiểm thân kèo — MỘT luật cho ba đường (tạo · hàng loạt · sửa)', () => {
  it('thân hợp lệ đi qua, và chuỗi được cắt khoảng trắng', () => {
    const kq = kiemThanKeo(than({ question_text: '  Có mưa không?  ' }));
    expect(kq.ok).toBe(true);
    if (kq.ok) expect(kq.than.question_text).toBe('Có mưa không?');
  });

  it('bắt đủ các lỗi mà đường tạo vẫn bắt', () => {
    const loi = (b: unknown) => {
      const k = kiemThanKeo(b);
      return k.ok ? null : k.field;
    };
    expect(loi(than({ pool: 'sao_hoa' }))).toBe('pool');
    expect(loi(than({ resolution_source_url: '' }))).toBe('resolution_source_url');
    expect(loi(than({ lock_ts: gio(-1000) }))).toBe('lock_ts');
    expect(loi(than({ resolve_deadline_ts: gio(1000) }))).toBe('resolve_deadline_ts');
    expect(loi(than({ seed_per_option: -5 }))).toBe('seed_per_option');
    expect(loi(than({ options: [{ label: 'Chỉ một' }] }))).toBe('options');
    expect(loi(null)).toBe('body');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Danh sách toàn bộ + lọc + tìm', () => {
  it('người thường 403 trên mọi cửa mới', async () => {
    const cua: Array<[string, string]> = [
      ['GET', '/api/v1/admin/keo'],
      ['GET', '/api/v1/admin/keo/00000000-0000-4000-8000-000000000000/xem-truoc'],
      ['POST', '/api/v1/admin/keo/hang-loat'],
      ['POST', '/api/v1/admin/keo/00000000-0000-4000-8000-000000000000/sua'],
      ['POST', '/api/v1/admin/keo/00000000-0000-4000-8000-000000000000/hen-gio'],
    ];
    for (const [m, p] of cua) {
      // GET không mang được body — gửi kèm là undici ném trước cả khi tới guard.
      const r = await goi(p, { method: m, u: thuong, ...(m === 'POST' ? { body: {} } : {}) });
      expect(r.status, `${m} ${p}`).toBe(403);
    }
  });

  it('trả kèo Ở MỌI TRẠNG THÁI — không chỉ draft+locked như /pending', async () => {
    const id = await taoDraft({ question_text: 'Kèo nháp một' });
    await moCuaNang();
    await goi(`/api/v1/admin/markets/${id}/open`, { method: 'POST' });

    const b = await j(await goi('/api/v1/admin/keo'));
    expect(b.keo.some((k: any) => k.market_id === id && k.status === 'open')).toBe(true);
    expect(b).toHaveProperty('tong');
  });

  it('lọc theo trạng thái và pool', async () => {
    await taoDraft({ pool: 'macro', question_text: 'CPI tháng sau?' });
    const b = await j(await goi('/api/v1/admin/keo?tt=draft&pool=macro'));
    expect(b.keo.length).toBeGreaterThan(0);
    expect(b.keo.every((k: any) => k.status === 'draft' && k.pool === 'macro')).toBe(true);
  });

  it('tìm theo câu hỏi — và ký tự đại diện được hiểu theo NGHĨA ĐEN', async () => {
    await taoDraft({ question_text: 'Vàng SJC cuối tháng?' });
    await taoDraft({ question_text: 'Có dấu 100% ở đây' });
    expect((await j(await goi('/api/v1/admin/keo?q=Vàng SJC'))).keo).toHaveLength(1);

    /*
     * ⚠ Tham số hoá chặn TIÊM SQL nhưng KHÔNG chặn `%`/`_` — chúng vẫn là ký tự
     * đại diện của LIKE. Bản đầu để nguyên, và gõ `%` thì khớp TẤT CẢ. Không
     * phải lỗ hổng, nhưng là ô tìm kiếm nói dối. Nay `%` tìm ra đúng kèo CÓ dấu
     * phần trăm, và `_` không còn khớp bừa một ký tự bất kỳ.
     */
    const b2 = await j(await goi('/api/v1/admin/keo?q=%25'));
    expect(b2.keo).toHaveLength(1);
    expect(b2.keo[0].question_text).toBe('Có dấu 100% ở đây');
    expect((await j(await goi('/api/v1/admin/keo?q=V_ng'))).keo).toHaveLength(0);
  });

  it('giá trị lọc lạ bị bỏ qua, không 400 (URL chia sẻ được)', async () => {
    expect((await goi('/api/v1/admin/keo?tt=bay_gio&pool=sao_hoa')).status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Sửa kèo — CHỈ khi còn nháp', () => {
  it('sửa nháp: đổi câu hỏi, đổi giờ, THAY TRỌN BỘ cửa', async () => {
    const id = await taoDraft();
    const r = await goi(`/api/v1/admin/keo/${id}/sua`, {
      method: 'POST',
      body: than({
        question_text: 'Câu hỏi đã sửa',
        options: [{ label: 'A' }, { label: 'B' }, { label: 'C' }],
      }),
    });
    expect(r.status).toBe(200);

    const { rows } = await pool.query(
      `SELECT question_text FROM markets WHERE market_id = $1`, [id]);
    expect(rows[0].question_text).toBe('Câu hỏi đã sửa');
    const { rows: o } = await pool.query(
      `SELECT label FROM market_options WHERE market_id = $1 ORDER BY sort_order`, [id]);
    expect(o.map((x) => x.label)).toEqual(['A', 'B', 'C']);
  });

  it('⚠ kèo ĐÃ MỞ → 409, và KHÔNG đổi một chữ nào', async () => {
    const id = await taoDraft({ question_text: 'Kèo sẽ mở' });
    await moCuaNang();
    expect((await goi(`/api/v1/admin/markets/${id}/open`, { method: 'POST' })).status).toBe(200);

    const r = await goi(`/api/v1/admin/keo/${id}/sua`, {
      method: 'POST', body: than({ question_text: 'ĐỔI TRỘM' }),
    });
    expect(r.status).toBe(409);
    expect((await j(r)).error).toBe('khong_con_draft');
    const { rows } = await pool.query(
      `SELECT question_text FROM markets WHERE market_id = $1`, [id]);
    expect(rows[0].question_text).toBe('Kèo sẽ mở');
  });

  it('thân sai → 400 và không đụng bản ghi', async () => {
    const id = await taoDraft({ question_text: 'Giữ nguyên nhé' });
    const r = await goi(`/api/v1/admin/keo/${id}/sua`, {
      method: 'POST', body: than({ options: [{ label: 'chỉ một' }] }),
    });
    expect(r.status).toBe(400);
    const { rows } = await pool.query(
      `SELECT question_text FROM markets WHERE market_id = $1`, [id]);
    expect(rows[0].question_text).toBe('Giữ nguyên nhé');
  });

  it('ghi admin_audit', async () => {
    const id = await taoDraft();
    await goi(`/api/v1/admin/keo/${id}/sua`, { method: 'POST', body: than() });
    const { rows } = await pool.query(
      `SELECT count(*)::int n FROM admin_audit
        WHERE action = 'market_sua' AND payload_json->>'market_id' = $1`, [id]);
    expect(rows[0].n).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. Tạo hàng loạt — được tất hoặc không gì', () => {
  it('ba kèo một lô', async () => {
    const r = await goi('/api/v1/admin/keo/hang-loat', {
      method: 'POST',
      body: { keo: [1, 2, 3].map((i) => than({ question_text: `Kèo lô ${i}` })) },
    });
    expect(r.status).toBe(201);
    const b = await j(r);
    expect(b.so_keo).toBe(3);
    expect(b.market_ids).toHaveLength(3);
  });

  it('⚠ một kèo hỏng → KHÔNG kèo nào được tạo', async () => {
    const truoc = (await pool.query(`SELECT count(*)::int n FROM markets`)).rows[0].n;
    const r = await goi('/api/v1/admin/keo/hang-loat', {
      method: 'POST',
      body: {
        keo: [
          than({ question_text: 'Hợp lệ 1' }),
          than({ question_text: 'Hợp lệ 2' }),
          than({ pool: 'sao_hoa' }), // hỏng ở cái thứ ba
        ],
      },
    });
    expect(r.status).toBe(400);
    expect((await j(r)).field).toContain('keo[2]');
    /*
     * Tạo 2 rồi hỏng ở cái thứ 3 mà vẫn giữ 2 cái đầu là để lại một mớ nửa vời
     * phải dọn tay — đúng thứ "tiện dụng" sinh ra để tránh.
     */
    const sau = (await pool.query(`SELECT count(*)::int n FROM markets`)).rows[0].n;
    expect(sau).toBe(truoc);
  });

  it('lô rỗng / quá trần → 400', async () => {
    expect((await goi('/api/v1/admin/keo/hang-loat', { method: 'POST', body: { keo: [] } })).status)
      .toBe(400);
    const to = Array.from({ length: 51 }, () => than());
    expect((await goi('/api/v1/admin/keo/hang-loat', { method: 'POST', body: { keo: to } })).status)
      .toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V. Hẹn giờ mở — cửa NẶNG, và scheduler thật sự mở', () => {
  it('⚠ KHÔNG có xác thực lại → 403: uỷ quyền được DỜI CHỖ, không được BỎ', async () => {
    const id = await taoDraft();
    await pool.query(
      `UPDATE auth_sessions s SET xac_thuc_lai_luc = NULL
         FROM auth_accounts a
        WHERE a.account_id = s.account_id AND a.email = $1`,
      [`${admin.handle}@test.local`],
    );
    const r = await goi(`/api/v1/admin/keo/${id}/hen-gio`, { method: 'POST', body: { bat: true } });
    expect(r.status).toBe(403);
    expect((await j(r)).error).toBe('can_xac_thuc_lai');
    const { rows } = await pool.query(`SELECT tu_mo FROM markets WHERE market_id = $1`, [id]);
    expect(rows[0].tu_mo).toBe(false);
  });

  it('có xác thực lại → bật được, ghi audit', async () => {
    const id = await taoDraft();
    await moCuaNang();
    const r = await goi(`/api/v1/admin/keo/${id}/hen-gio`, { method: 'POST', body: { bat: true } });
    expect(r.status).toBe(200);
    const { rows } = await pool.query(`SELECT tu_mo FROM markets WHERE market_id = $1`, [id]);
    expect(rows[0].tu_mo).toBe(true);
    const { rows: a } = await pool.query(
      `SELECT count(*)::int n FROM admin_audit
        WHERE action = 'market_hen_gio_bat' AND payload_json->>'market_id' = $1`, [id]);
    expect(a[0].n).toBe(1);
  });

  it('scheduler MỞ kèo đã hẹn khi tới giờ — kèo KHÔNG hẹn thì không đụng', async () => {
    await moCuaNang();
    const coHen = await taoDraft({ question_text: 'Có hẹn', open_ts: gio(-60_000) });
    const khongHen = await taoDraft({ question_text: 'Không hẹn', open_ts: gio(-60_000) });
    await goi(`/api/v1/admin/keo/${coHen}/hen-gio`, { method: 'POST', body: { bat: true } });

    const bc = await runSchedulerPass(pool);
    expect(bc.opened).toContain(coHen);
    expect(bc.opened).not.toContain(khongHen);

    const { rows } = await pool.query(
      `SELECT market_id, status FROM markets WHERE market_id = ANY($1)`, [[coHen, khongHen]]);
    const tt = Object.fromEntries(rows.map((r) => [r.market_id, r.status]));
    expect(tt[coHen]).toBe('open');
    expect(tt[khongHen]).toBe('draft');
  });

  it('kèo hẹn giờ CHƯA tới giờ thì không mở', async () => {
    await moCuaNang();
    const id = await taoDraft({ open_ts: gio(3600_000), lock_ts: gio(7200_000), resolve_deadline_ts: gio(10800_000) });
    await goi(`/api/v1/admin/keo/${id}/hen-gio`, { method: 'POST', body: { bat: true } });
    const bc = await runSchedulerPass(pool);
    expect(bc.opened).not.toContain(id);
  });

  it('tự mở CÓ SEED: rút Kho bạc đúng, audit ghi người ĐÃ HẸN, cung tiền vẫn CÂN', async () => {
    await moCuaNang();
    const id = await taoDraft({
      question_text: 'Có seed', open_ts: gio(-60_000), seed_per_option: 100,
    });
    await goi(`/api/v1/admin/keo/${id}/hen-gio`, { method: 'POST', body: { bat: true } });
    await runSchedulerPass(pool);

    const { rows: b } = await pool.query(
      `SELECT COALESCE(SUM(amount),0)::text s FROM bets WHERE market_id = $1 AND is_seed`, [id]);
    expect(b[0].s).toBe('200'); // 100 × 2 cửa
    const { rows: a } = await pool.query(
      `SELECT admin_id, payload_json FROM admin_audit
        WHERE action = 'market_open' AND payload_json->>'market_id' = $1`, [id]);
    expect(a).toHaveLength(1);
    // Uỷ quyền có CHỦ NGỮ: ghi người đã hẹn lịch, không ghi "hệ thống".
    expect(a[0].admin_id).toBe(admin.userId);
    expect(a[0].payload_json.qua).toBe('hen_gio');

    // Tiền tự chạy khi không ai ngồi đó ⇒ bất biến cung tiền phải còn nguyên.
    expect((await auditSupply(pool)).ok).toBe(true);
  });

  it('⚠ Kho bạc không đủ → TẮT CỜ + ghi audit, không lặp im lặng mỗi phút', async () => {
    await moCuaNang();
    const id = await taoDraft({
      question_text: 'Seed quá tay', open_ts: gio(-60_000), seed_per_option: 999_999_999,
    });
    await goi(`/api/v1/admin/keo/${id}/hen-gio`, { method: 'POST', body: { bat: true } });

    const bc = await runSchedulerPass(pool);
    expect(bc.opened).not.toContain(id);
    const { rows } = await pool.query(
      `SELECT status, tu_mo FROM markets WHERE market_id = $1`, [id]);
    expect(rows[0]).toMatchObject({ status: 'draft', tu_mo: false });
    const { rows: a } = await pool.query(
      `SELECT count(*)::int n FROM admin_audit
        WHERE action = 'market_tu_mo_that_bai' AND payload_json->>'market_id' = $1`, [id]);
    expect(a[0].n).toBe(1);
    expect((await auditSupply(pool)).ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VI. Xem trước ĐÚNG thứ người chơi thấy — kiểm A3.1 bằng mắt', () => {
  it('góc nhìn NGƯỜI CHƯA ĐẶT không có `distribution` (A3.1)', async () => {
    await moCuaNang();
    const id = await taoDraft({ question_text: 'Xem trước', open_ts: gio(-60_000) });
    await goi(`/api/v1/admin/markets/${id}/open`, { method: 'POST' });

    const r = await goi(`/api/v1/admin/keo/${id}/xem-truoc`);
    expect(r.status).toBe(200);
    const b = await j(r);
    expect(b.nhu_nguoi_chua_dat).not.toHaveProperty('distribution');
    expect(b.a31_an_phan_bo).toBe(true);
    expect(b.co_nguoi_da_dat).toBe(false);
    expect(b.nhu_nguoi_da_dat).toBeNull();
  });

  it('có người đã đặt → góc nhìn thứ hai CÓ `distribution`, và hai bên khác nhau', async () => {
    await moCuaNang();
    const id = await taoDraft({ question_text: 'Xem trước 2', open_ts: gio(-60_000) });
    await goi(`/api/v1/admin/markets/${id}/open`, { method: 'POST' });
    const { rows: o } = await pool.query(
      `SELECT option_id FROM market_options WHERE market_id = $1 ORDER BY sort_order`, [id]);
    await goi(`/api/v1/markets/${id}/bets`, {
      method: 'POST', u: thuong,
      body: {
        idempotency_key: `xem-truoc-${id.slice(0, 8)}`,
        allocations: [{ option_id: o[0].option_id, amount: 50 }],
      },
    });

    const b = await j(await goi(`/api/v1/admin/keo/${id}/xem-truoc`));
    expect(b.co_nguoi_da_dat).toBe(true);
    /*
     * Chính SỰ KHÁC NHAU giữa hai góc nhìn mới là thứ cần nhìn: đây là bằng
     * chứng A3.1 còn sống, đọc thẳng chứ không phải suy.
     */
    expect(b.nhu_nguoi_chua_dat).not.toHaveProperty('distribution');
    expect(b.nhu_nguoi_da_dat).toHaveProperty('distribution');
    expect(b.a31_an_phan_bo).toBe(true);
  });

  it('kèo còn NHÁP → 404 kèm lời giải thích (người chơi chưa thấy gì cả)', async () => {
    const id = await taoDraft();
    const r = await goi(`/api/v1/admin/keo/${id}/xem-truoc`);
    expect(r.status).toBe(404);
    expect((await j(r)).message).toContain('nháp');
  });
});
