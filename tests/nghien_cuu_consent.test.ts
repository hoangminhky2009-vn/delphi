/**
 * Ô ĐỒNG Ý NGHIÊN CỨU CÓ SỐ BẢN — SPEC `chan-truoc-beta` mục 5 (migration 0079, `server/nghien_cuu.ts`).
 *
 * Trước bản này `research_consent` là boolean trần: `POST /account/consent` UPDATE một cột, không vết, không biết người dùng đã đồng ý
 * với chữ nào. Luật mới, mỗi điều một bài:
 *   · bật phải kèm văn bản `nghien_cuu` ở bản hiện hành; mỗi lần bật/tắt MỘT vết (van_ban_id, phien_ban) — cùng khuôn consent PFM;
 *   · bản lưu không phải bản hiện hành ⇒ cổng `/telemetry` coi như TẮT;
 *   · người bật từ trước (true, không số bản) ⇒ `/auth/me` báo hỏi lại; chưa trả lời ⇒ không ghi telemetry, không vào xếp hạng.
 * Qua HTTP + Postgres nhúng.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { CONSENT_PHIEN_BAN } from '../config/pfm_consent.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
}, 120_000);
afterAll(async () => { await db?.stop(); });

const V = CONSENT_PHIEN_BAN.nghien_cuu;
const goi = (u: TestUser, path: string, body?: unknown) => app.request(`http://localhost${path}`, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', cookie: u.cookie, 'x-forwarded-for': '203.0.113.7' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const datDongY = (u: TestUser, body: Record<string, unknown>) => goi(u, '/api/v1/account/consent', body);
const bat = (u: TestUser) => datDongY(u, { research_consent: true, van_ban_id: 'nghien_cuu', phien_ban: V });
const tat = (u: TestUser) => datDongY(u, { research_consent: false });
const me = async (u: TestUser): Promise<any> => (await goi(u, '/api/v1/auth/me')).json();
const vet = async (u: TestUser) => (await pool.query(
  `SELECT action_type, value_json FROM events
    WHERE user_id = $1 AND action_type IN ('nghien_cuu_dong_y', 'nghien_cuu_rut') ORDER BY event_id`, [u.userId])).rows;
const guiTelemetry = (u: TestUser, khoa: string) => goi(u, '/api/v1/telemetry',
  { idempotency_key: khoa, su_kien: [{ loai: 'man_vao', man: '/arena' }] });
const demTelemetry = async (u: TestUser) =>
  (await pool.query('SELECT count(*)::int AS n FROM telemetry WHERE user_id = $1', [u.userId])).rows[0].n as number;

/** Người TẮT sẵn (fixture mặc định bật ở bản hiện hành). */
async function nguoiTat(): Promise<TestUser> {
  const u = await createTestUser(pool);
  await pool.query('UPDATE users SET research_consent = false, research_consent_phien_ban = NULL WHERE user_id = $1', [u.userId]);
  return u;
}

describe('bật/tắt có văn bản + vết', () => {
  it('⭐ bật KHÔNG kèm văn bản / sai bản ⇒ 400, không đổi gì, không vết', async () => {
    const u = await nguoiTat();
    for (const body of [
      { research_consent: true },
      { research_consent: true, van_ban_id: 'nghien_cuu', phien_ban: 'v0' },
      { research_consent: true, van_ban_id: 'pfm_ket', phien_ban: V },
    ]) {
      const r = await datDongY(u, body);
      expect(r.status, JSON.stringify(body)).toBe(400);
    }
    expect((await me(u)).user.research_consent).toBe(false);
    expect(await vet(u)).toEqual([]);
  });

  it('⭐ bật đúng bản ⇒ cột + số bản, MỘT vết {van_ban_id, phien_ban}; bật lần hai không vết trùng; tắt ⇒ vết rút; bật lại ⇒ vết mới', async () => {
    const u = await nguoiTat();
    expect((await bat(u)).status).toBe(200);
    const h = (await pool.query('SELECT research_consent, research_consent_phien_ban FROM users WHERE user_id = $1', [u.userId])).rows[0];
    expect(h).toEqual({ research_consent: true, research_consent_phien_ban: V });
    expect((await bat(u)).status).toBe(200);
    expect(await tat(u)).toHaveProperty('status', 200);
    expect((await bat(u)).status).toBe(200);
    expect(await vet(u)).toEqual([
      { action_type: 'nghien_cuu_dong_y', value_json: { van_ban_id: 'nghien_cuu', phien_ban: V } },
      { action_type: 'nghien_cuu_rut', value_json: { van_ban_id: 'nghien_cuu', phien_ban: V } },
      { action_type: 'nghien_cuu_dong_y', value_json: { van_ban_id: 'nghien_cuu', phien_ban: V } },
    ]);
  });

  it('tắt khi đang tắt ⇒ không vết (thao tác rỗng)', async () => {
    const u = await nguoiTat();
    expect((await tat(u)).status).toBe(200);
    expect(await vet(u)).toEqual([]);
  });
});

describe('bản không hiện hành ⇒ coi như TẮT', () => {
  it('⭐ số bản lưu khác bản hiện hành ⇒ /telemetry KHÔNG ghi; /auth/me nói TẮT + hỏi lại', async () => {
    const u = await createTestUser(pool);
    await pool.query(`UPDATE users SET research_consent_phien_ban = 'v0' WHERE user_id = $1`, [u.userId]);
    expect((await guiTelemetry(u, 'lo-ban-cu-0001')).status).toBe(202);
    expect(await demTelemetry(u)).toBe(0);
    const m = await me(u);
    expect(m.user.research_consent).toBe(false);
    expect(m.user.hoi_lai_nghien_cuu).toBe(true);
  });

  it('đối chứng: bản hiện hành ⇒ ghi bình thường, không hỏi lại', async () => {
    const u = await createTestUser(pool);
    await guiTelemetry(u, 'lo-ban-moi-001');
    expect(await demTelemetry(u)).toBe(1);
    const m = await me(u);
    expect(m.user.research_consent).toBe(true);
    expect(m.user.hoi_lai_nghien_cuu).toBe(false);
    expect(m.user.research_consent_phien_ban).toBe(V);
  });
});

describe('người bật TỪ TRƯỚC khi có số bản (true, NULL)', () => {
  async function nguoiCu(): Promise<TestUser> {
    const u = await createTestUser(pool);
    await pool.query('UPDATE users SET research_consent_phien_ban = NULL WHERE user_id = $1', [u.userId]);
    return u;
  }

  it('⭐ bị hỏi lại; CHƯA trả lời ⇒ không ghi telemetry, không vào xếp hạng', async () => {
    const u = await nguoiCu();
    const m = await me(u);
    expect(m.user.hoi_lai_nghien_cuu).toBe(true);
    expect(m.user.research_consent).toBe(false);
    await guiTelemetry(u, 'lo-chua-tra-loi');
    expect(await demTelemetry(u)).toBe(0);
    const r = await goi(u, '/api/v1/holdem/matches', { che_do: 'rank_pve' });
    expect(r.status).toBe(403);
    expect(((await r.json()) as any).error).toBe('chua_dong_y');
  });

  it('⭐ trả lời ĐỒNG Ý ⇒ hết hỏi, ghi telemetry, có vết v1', async () => {
    const u = await nguoiCu();
    expect((await bat(u)).status).toBe(200);
    expect((await me(u)).user.hoi_lai_nghien_cuu).toBe(false);
    await guiTelemetry(u, 'lo-da-dong-y-1');
    expect(await demTelemetry(u)).toBe(1);
    expect((await vet(u)).map((x) => x.action_type)).toEqual(['nghien_cuu_dong_y']);
  });

  it('⭐ trả lời KHÔNG ⇒ hết hỏi, vẫn tắt, vết rút mang phien_ban null (bản cũ không có số)', async () => {
    const u = await nguoiCu();
    expect((await tat(u)).status).toBe(200);
    const m = await me(u);
    expect(m.user.hoi_lai_nghien_cuu).toBe(false);
    expect(m.user.research_consent).toBe(false);
    expect(await vet(u)).toEqual([{ action_type: 'nghien_cuu_rut', value_json: { van_ban_id: 'nghien_cuu', phien_ban: null } }]);
  });
});

describe('onboarding', () => {
  async function dangKy(email: string): Promise<string> {
    const r = await app.request('http://localhost/api/v1/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
      body: JSON.stringify({ email, password: 'matkhau-dai-du-1', birth_year: 2005 }),
    });
    expect(r.status, await r.clone().text()).toBeLessThan(300);
    await pool.query(`UPDATE auth_accounts SET email_verified_at = now() WHERE email = $1`, [email]);
    const l = await app.request('http://localhost/api/v1/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
      body: JSON.stringify({ email, password: 'matkhau-dai-du-1' }),
    });
    expect(l.status, await l.clone().text()).toBe(200);
    return l.headers.get('set-cookie')?.split(';')[0] ?? '';
  }
  const onboard = (cookie: string, handle: string, them: Record<string, unknown>) =>
    app.request('http://localhost/api/v1/onboarding', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ handle, age_band: '18-22', region: 'bac', occupation_band: 'hs_sv', ...them }),
    });

  it('⭐ đồng ý lúc onboarding KÈM số bản ⇒ cột + số bản + một vết', async () => {
    const cookie = await dangKy('nc_onb1@vidu.test');
    const r = await onboard(cookie, 'nc_onb_mot', { research_consent: true, research_consent_phien_ban: V });
    expect(r.status, await r.clone().text()).toBeLessThan(300);
    const u = (await pool.query(
      `SELECT user_id, research_consent, research_consent_phien_ban FROM users WHERE handle = 'nc_onb_mot'`)).rows[0];
    expect([u.research_consent, u.research_consent_phien_ban]).toEqual([true, V]);
    const v = await pool.query(`SELECT count(*)::int AS n FROM events WHERE user_id = $1 AND action_type = 'nghien_cuu_dong_y'`, [u.user_id]);
    expect(v.rows[0].n).toBe(1);
  });

  it('web cũ (đồng ý mà không gửi số bản) ⇒ vẫn tạo hồ sơ, nhưng coi như TẮT và hỏi lại — không vết giả', async () => {
    const cookie = await dangKy('nc_onb2@vidu.test');
    const r = await onboard(cookie, 'nc_onb_hai', { research_consent: true });
    expect(r.status, await r.clone().text()).toBeLessThan(300);
    const m: any = await (await app.request('http://localhost/api/v1/auth/me', { headers: { cookie } })).json();
    expect(m.user.research_consent).toBe(false);
    expect(m.user.hoi_lai_nghien_cuu).toBe(true);
    const v = await pool.query(
      `SELECT count(*)::int AS n FROM events e JOIN users u ON u.user_id = e.user_id
        WHERE u.handle = 'nc_onb_hai' AND e.action_type = 'nghien_cuu_dong_y'`);
    expect(v.rows[0].n).toBe(0);
  });
});
