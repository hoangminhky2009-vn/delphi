/**
 * ĐỔI TÊN HIỂN THỊ (founder 04/08: *"phải cho player đổi tên chứ"*).
 *
 * ⚠ Bài đáng giá nhất ở đây KHÔNG phải "đổi được tên" — nó là hai cái KHÔNG:
 * không lách được blocklist (D25/R2), và không cuốn theo lịch sử. `handle` chỉ
 * là NHÃN; `events`/`holdem_results`/`rank_diem` neo `user_id`. Ai lỡ nối lịch
 * sử vào handle thì bài §III đỏ.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { ensureGenesis } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { AUTH } from '../config/auth.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
}, 120_000);
afterAll(async () => { await db?.stop(); });

let ip = 0;
async function nguoiChoi(): Promise<{ token: string; handle: string; userId: string }> {
  ip += 1;
  const b: any = await (await app.request('/api/v1/auth/khach', {
    method: 'POST', headers: { 'x-forwarded-for': `203.0.114.${ip}` },
  })).json();
  const { rows } = await pool.query(`SELECT user_id FROM users WHERE handle = $1`, [b.handle]);
  // B5 (vá đợt 1 Gói 2) — khách qua cổng tuổi trước, như ngoài đời (tấm hỏi năm sinh); bài này canh đổi tên, không canh cổng tuổi.
  const tuoi = await app.request('/api/v1/me/tuoi', {
    method: 'POST',
    headers: { authorization: `Bearer ${b.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ birth_year: new Date().getUTCFullYear() - 20 }),
  });
  expect(tuoi.status).toBe(200);
  return { token: b.token, handle: b.handle, userId: rows[0].user_id };
}

const doi = (token: string, handle: string) =>
  app.request('/api/v1/me/handle', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ handle }),
  });

const tenCua = async (userId: string) =>
  (await pool.query(`SELECT handle FROM users WHERE user_id = $1`, [userId])).rows[0].handle;

describe('I. Đổi được', () => {
  it('tên máy cấp → tên người chọn', async () => {
    const u = await nguoiChoi();
    expect(u.handle).toMatch(/^khach_/);
    const r = await doi(u.token, 'minh_dep_trai');
    expect(r.status).toBe(200);
    expect(await tenCua(u.userId)).toBe('minh_dep_trai');
  });

  it('viết hoa / thừa khoảng trắng vẫn nhận, chuẩn hoá về thường', async () => {
    const u = await nguoiChoi();
    expect((await doi(u.token, '  BaoNgoc99  ')).status).toBe(200);
    expect(await tenCua(u.userId)).toBe('baongoc99');
  });

  it('đổi thành CHÍNH tên đang dùng → không tính là một lần đổi', async () => {
    const u = await nguoiChoi();
    await doi(u.token, 'giu_nguyen');
    const r = await doi(u.token, 'giu_nguyen');
    expect(r.status).toBe(200);
    expect((await r.json() as any).doi).toBe(false);
    const { rows } = await pool.query(
      `SELECT count(*)::int n FROM events WHERE user_id = $1 AND action_type = 'handle_doi'`,
      [u.userId]);
    expect(rows[0].n, 'thao tác rỗng mà ghi event = sổ đổi tên có dòng ma').toBe(1);
  });
});

describe('II. Hai cái KHÔNG', () => {
  /*
   * ⚠ D25/R2 dựng blocklist ĐÚNG VÌ tên hiện cho người lạ. Nếu cửa đổi tên tự
   * viết bộ kiểm riêng thì blocklist chỉ còn canh cửa đăng ký — tức canh đúng
   * cái cửa mà mùa 0.0 gần như không ai đi qua (ai cũng vào bằng KHÁCH).
   */
  it('⭐ không lách được blocklist qua cửa đổi tên', async () => {
    const u = await nguoiChoi();
    const r = await doi(u.token, 'suckmydik');
    expect(r.status).toBe(400);
    expect(await tenCua(u.userId)).toBe(u.handle);
  });

  it('không lấy được tên người khác đang dùng', async () => {
    const a = await nguoiChoi();
    const b = await nguoiChoi();
    await doi(a.token, 'ten_da_co');
    const r = await doi(b.token, 'ten_da_co');
    expect(r.status).toBe(409);
    expect((await r.json() as any).error).toBe('handle_taken');
  });

  it('sai hình dạng → 400, không nổ 500', async () => {
    const u = await nguoiChoi();
    for (const t of ['ab', 'a'.repeat(21), 'có dấu', 'hoa-gach', '']) {
      expect((await doi(u.token, t)).status, `tên: ${JSON.stringify(t)}`).toBe(400);
    }
  });

  it('chưa đăng nhập → 401', async () => {
    const r = await app.request('/api/v1/me/handle', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle: 'ai_do' }),
    });
    expect(r.status).toBe(401);
  });
});

describe('III. Lịch sử KHÔNG đi theo tên', () => {
  /*
   * ⚠⚠ ĐÂY LÀ BÀI GIỮ CHO ĐỔI TÊN RẺ. Ngày nào có người nối lịch sử vào `handle`
   * thay vì `user_id` thì đổi tên biến từ "đổi một cái nhãn" thành "xoá thành
   * tích" — và `events` append-only nên hỏng là hỏng vĩnh viễn.
   */
  it('⭐ đổi tên xong, event cũ vẫn thuộc về đúng người', async () => {
    const u = await nguoiChoi();
    await app.request('/api/v1/holdem/matches', {
      method: 'POST',
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const truoc = (await pool.query(
      `SELECT count(*)::int n FROM events WHERE user_id = $1`, [u.userId])).rows[0].n;
    expect(truoc).toBeGreaterThan(0);

    await doi(u.token, 'ten_moi_toanh');

    const sau = (await pool.query(
      `SELECT count(*)::int n FROM events WHERE user_id = $1`, [u.userId])).rows[0].n;
    expect(sau, 'event rơi mất khi đổi tên = lịch sử neo nhầm vào handle')
      .toBe(truoc + 1);   // +1 = chính dòng handle_doi
    const tran = (await pool.query(
      `SELECT count(*)::int n FROM holdem_matches WHERE owner_user_id = $1`, [u.userId])).rows[0].n;
    expect(tran).toBe(1);
  });

  /*
   * ⚠ HỢP ĐỒNG ĐỔI (SPEC chan-truoc-beta, founder 11/10 "A"): bản cũ ghi `{cu, moi}` để nối hai cái tên — nhưng `events` không xoá được,
   * nên người đã đổi tên thì xoá tài khoản xong vẫn còn đường `user_id` → tên (SPEC mục 5 cấm). Nay mỗi lần đổi vẫn MỘT dòng, và dòng
   * KHÔNG chở tên nào.
   */
  it('event `handle_doi` ghi mỗi lần đổi MỘT dòng, và KHÔNG chở tên nào (events không xoá được)', async () => {
    const u = await nguoiChoi();
    await doi(u.token, 'ten_thu_nhat');
    await doi(u.token, 'ten_thu_hai');
    const { rows } = await pool.query(
      `SELECT value_json FROM events
        WHERE user_id = $1 AND action_type = 'handle_doi' ORDER BY ts`, [u.userId]);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      const chu = JSON.stringify(r.value_json);
      for (const ten of [u.handle, 'ten_thu_nhat', 'ten_thu_hai']) expect(chu.includes(ten), `dòng chở "${ten}"`).toBe(false);
    }
  });
});

describe('IV. Van chống spam', () => {
  it(`quá ${AUTH.HANDLE_DOI_MAX} lần trong cửa sổ → 429, và tên giữ nguyên`, async () => {
    const u = await nguoiChoi();
    for (let i = 0; i < AUTH.HANDLE_DOI_MAX; i += 1) {
      expect((await doi(u.token, `ten_so_${i}`)).status, `lần ${i + 1}`).toBe(200);
    }
    const r = await doi(u.token, 'mot_lan_nua');
    expect(r.status).toBe(429);
    expect(await tenCua(u.userId)).toBe(`ten_so_${AUTH.HANDLE_DOI_MAX - 1}`);
  });
});
