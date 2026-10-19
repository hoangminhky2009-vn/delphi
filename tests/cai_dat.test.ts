/**
 * CÀI ĐẶT — giọng hồ sơ (D106). Ba câu: đổi được và /auth/me nói lại đúng giá
 * trị · giá trị lạ bị 400 CÓ TÊN TRƯỜNG (không im lặng rơi về mặc định) · khách
 * (bậc 0, có user_id) cũng đổi được.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);
afterAll(async () => { await db?.stop(); });

const goi = (path: string, init: RequestInit = {}, cookie = user.cookie) =>
  app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) },
  });

describe('POST /me/cai-dat', () => {
  it('mặc định tu_dong; đổi sang tre ⇒ /auth/me trả giong_ho_so = tre', async () => {
    const me0 = await (await goi('/api/v1/auth/me')).json() as any;
    expect(me0.user.giong_ho_so).toBe('tu_dong');
    const r = await goi('/api/v1/me/cai-dat', { method: 'POST', body: JSON.stringify({ giong_ho_so: 'tre' }) });
    expect(r.status).toBe(200);
    const b = await r.json() as any;
    expect(b).toMatchObject({ ok: true, giong_ho_so: 'tre' });
    const me1 = await (await goi('/api/v1/auth/me')).json() as any;
    expect(me1.user.giong_ho_so).toBe('tre');
  });

  it('giá trị lạ ⇒ 400 có tên trường, giá trị cũ giữ nguyên', async () => {
    const r = await goi('/api/v1/me/cai-dat', { method: 'POST', body: JSON.stringify({ giong_ho_so: 'meme_lord' }) });
    expect(r.status).toBe(400);
    expect(((await r.json()) as any).field).toBe('giong_ho_so');
    const me = await (await goi('/api/v1/auth/me')).json() as any;
    expect(me.user.giong_ho_so).toBe('tre');
    // DB cũng từ chối ở tầng CHECK — cửa thứ hai, phòng ai đó ghi thẳng.
    await expect(pool.query(`UPDATE users SET giong_ho_so = 'x' WHERE user_id = $1`, [user.userId]))
      .rejects.toThrow();
  });

  it('không đăng nhập ⇒ 401', async () => {
    const r = await goi('/api/v1/me/cai-dat', { method: 'POST', body: '{"giong_ho_so":"vua"}' }, '');
    expect(r.status).toBe(401);
  });
});

describe('câu TỰ KHAI — /me/tu-khai', () => {
  it('chưa trả lời ⇒ null; trả 7 ⇒ đọc lại 7; trả lại 3 ⇒ dòng mới nhất thắng, dòng cũ còn', async () => {
    const r0 = await (await goi('/api/v1/me/tu-khai')).json() as any;
    expect(r0).toEqual({ rui_ro: null, ts: null });
    const p1 = await goi('/api/v1/me/tu-khai', { method: 'POST', body: JSON.stringify({ cau: 'rui_ro', tra_loi: 7 }) });
    expect(p1.status).toBe(200);
    await expect(((await goi("/api/v1/me/tu-khai")).json() as any)).resolves.toMatchObject({ rui_ro: 7 });
    await goi('/api/v1/me/tu-khai', { method: 'POST', body: JSON.stringify({ cau: 'rui_ro', tra_loi: 3 }) });
    await expect(((await goi("/api/v1/me/tu-khai")).json() as any)).resolves.toMatchObject({ rui_ro: 3 });
    const n = await pool.query(`SELECT count(*)::int AS n FROM tu_khai WHERE user_id = $1`, [user.userId]);
    expect(n.rows[0]!.n, 'lịch sử giữ nguyên — đổi ý cũng là dữ liệu').toBe(2);
  });

  it('ngoài 0–10 hay câu lạ ⇒ 400 có tên trường', async () => {
    const a = await goi('/api/v1/me/tu-khai', { method: 'POST', body: JSON.stringify({ cau: 'rui_ro', tra_loi: 11 }) });
    expect(a.status).toBe(400);
    expect(((await a.json()) as any).field).toBe('tra_loi');
    const b = await goi('/api/v1/me/tu-khai', { method: 'POST', body: JSON.stringify({ cau: 'thu_nhap', tra_loi: 5 }) });
    expect(b.status).toBe(400);
    expect(((await b.json()) as any).field).toBe('cau');
  });
});
