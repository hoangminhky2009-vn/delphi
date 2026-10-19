/**
 * B5 (SPEC va-bao-mat-chuan-hoa-api-dot-1, C8) — CỔNG TUỔI 16+ CHO CẢ BA ĐƯỜNG VÀO (email · khách · Discord).
 *
 * Hành vi đổi: trước bản vá age gate chỉ ở `POST /auth/register`; khách (`/auth/khach`) và Discord vào chơi ngay, không ai hỏi
 * tuổi — "16+" chỉ đúng với một trong ba đường. Nay `requireOnboarded` đòi `age_band` HOẶC mốc `tuoi_ok_luc` (0084) ⇒ thiếu cả hai
 * là 403 `chua_xac_nhan_tuoi` ở mọi cửa nghiệp vụ; `POST /me/tuoi` ghi mốc khi đủ tuổi, dưới tuổi 403 `duoi_tuoi` (tài khoản giữ,
 * cửa vẫn đóng). `/auth/me` báo `can_xac_nhan_tuoi` để web hiện tấm hỏi năm sinh. Tài khoản email (có `age_band` lúc đăng ký)
 * không bị hỏi lại. Khai năm sinh ở tấm nhân khẩu (`/me/nhan-khau`) cũng là qua cổng.
 *
 * Tiêm ngược: bỏ điều kiện tuổi trong `requireOnboarded` ⇒ ca khách 403 đỏ · bỏ `tuoi_ok_luc` khỏi câu `resolveSession` ⇒ ca
 * "2008 ⇒ trận 201" đỏ · đổi `/me/nhan-khau` về `requireOnboarded` ⇒ ca nhân khẩu đỏ.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { timHoacTao } from '../server/discord.js';
import { createSession } from '../server/auth/session.js';
import { AUTH } from '../config/auth.js';
import { ECONOMY } from '../config/economy.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser } from './helpers/fixtures.js';

const NAM = new Date().getUTCFullYear();
const NAM_DU_TUOI = NAM - 20;
const NAM_DUOI_TUOI = NAM - (ECONOMY.AGE_GATE_MIN - 2);

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let ipSo = 0;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
}, 120_000);

afterAll(async () => { await db?.stop(); });

/** Khách mới qua đường thật `/auth/khach` — mỗi khách một IP (xô tạo khách theo IP). */
async function khachMoi(): Promise<string> {
  ipSo += 1;
  const r = await app.request('/api/v1/auth/khach', { method: 'POST', headers: { 'x-forwarded-for': `198.51.100.${ipSo}` } });
  expect(r.status).toBe(200);
  return `Bearer ${(await r.json() as { token: string }).token}`;
}

const goi = (auth: string, path: string, body?: unknown) => app.request(path, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', ...(auth.startsWith('Bearer') ? { authorization: auth } : { cookie: auth }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const taoTran = (auth: string) => goi(auth, '/api/v1/holdem/matches', {});
const can = async (auth: string) => ((await (await goi(auth, '/api/v1/auth/me')).json()) as any).can_xac_nhan_tuoi;

describe('B5 — khách', () => {
  it('⭐ khách mới tạo trận ⇒ 403 chua_xac_nhan_tuoi; /auth/me báo cần xác nhận', async () => {
    const k = await khachMoi();
    const r = await taoTran(k);
    expect(r.status).toBe(403);
    const b = await r.json() as { error: string; message: string };
    expect(b.error).toBe('chua_xac_nhan_tuoi');
    expect(typeof b.message).toBe('string');
    expect(await can(k)).toBe(true);
  });

  it('⭐ dưới tuổi ⇒ 403 duoi_tuoi và trận vẫn 403; gửi lại năm đủ tuổi ⇒ 200 rồi tạo trận 201', async () => {
    const k = await khachMoi();
    const duoi = await goi(k, '/api/v1/me/tuoi', { birth_year: NAM_DUOI_TUOI });
    expect(duoi.status).toBe(403);
    expect((await duoi.json() as any).error).toBe('duoi_tuoi');
    expect((await taoTran(k)).status).toBe(403);

    const du = await goi(k, '/api/v1/me/tuoi', { birth_year: NAM_DU_TUOI });
    expect(du.status).toBe(200);
    expect(await can(k)).toBe(false);
    expect((await taoTran(k)).status).toBe(201);
  });

  it('năm sinh không lưu, nhóm tuổi KHÔNG bị ghi (giữ câu hỏi nhân khẩu bậc 1 cho khách)', async () => {
    const k = await khachMoi();
    await goi(k, '/api/v1/me/tuoi', { birth_year: NAM_DU_TUOI });
    const me = await (await goi(k, '/api/v1/auth/me')).json() as any;
    const { rows } = await pool.query(`SELECT age_band, tuoi_ok_luc FROM users WHERE user_id = $1`, [me.user.user_id]);
    expect(rows[0].tuoi_ok_luc).not.toBeNull();
    expect(rows[0].age_band).toBeNull();
  });

  it('năm sinh rác ⇒ 400', async () => {
    const k = await khachMoi();
    expect((await goi(k, '/api/v1/me/tuoi', { birth_year: 'abc' })).status).toBe(400);
  });

  it('khai năm sinh ở tấm nhân khẩu (cửa chưa qua cổng với tới được) cũng là qua cổng', async () => {
    const k = await khachMoi();
    const r = await goi(k, '/api/v1/me/nhan-khau', { birth_year: NAM_DU_TUOI, region: 'bac', occupation_band: 'hs_sv' });
    expect(r.status).toBe(200);
    expect((await taoTran(k)).status).toBe(201);
  });
});

describe('B5 — tài khoản email và Discord', () => {
  it('tài khoản email có age_band (đăng ký) ⇒ không bị hỏi, tạo trận 201', async () => {
    const u = await createTestUser(pool);
    expect(await can(u.cookie)).toBe(false);
    expect((await taoTran(u.cookie)).status).toBe(201);
  });

  it('⭐ Discord vào thẳng ⇒ như khách: 403 tới khi xác nhận', async () => {
    const kq = await timHoacTao(pool, { id: 'dc-tuoi-1', ten: 'nguoi_discord' }, { seasonId: '2026Q4' });
    const cookie = `${AUTH.SESSION_COOKIE}=${await createSession(pool, kq.accountId)}`;
    expect((await taoTran(cookie)).status).toBe(403);
    expect((await goi(cookie, '/api/v1/me/tuoi', { birth_year: NAM_DU_TUOI })).status).toBe(200);
    expect((await taoTran(cookie)).status).toBe(201);
  });
});
