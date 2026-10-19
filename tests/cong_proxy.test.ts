/**
 * B1 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — CỔNG PROXY: ai gọi thẳng `api.example.vercel.app` (không qua Worker) thì bị từ chối.
 *
 * Hành vi đổi: trước bản vá, origin Vercel trả lời MỌI người — vòng qua cổng hàng chờ 300 + cache Worker, và mỗi
 * `POST /auth/login` trần đốt một lượt argon2 ~100 ms (D444 cố ý giữ argon2 cho email lạ) trên quota Hobby. Nay
 * `/api/*` thiếu/sai `x-delphi-proxy-secret` ⇒ 403 `khong_qua_cong` TRƯỚC mọi route (không tiêu suất `auth_attempts`).
 * Hai miễn trừ có lý do riêng: `/internal/*` (cron-job.org + Vercel cron gọi thẳng, có secret riêng) và `/health`
 * (thân tối thiểu, KHÔNG chạm DB — gọi thẳng không đốt được truy vấn nào).
 * API không có `PROXY_SHARED_SECRET` ⇒ mở như cũ (dev/test; nếp `cuaNgoaiAdmin`).
 *
 * Tiêm ngược: bỏ `return 403` trong middleware ⇒ ca login trần đỏ; bỏ nhánh sớm của `/health` ⇒ ca đếm truy vấn đỏ.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';

const PROXY = 'proxy-secret-thu-0123456789';
const TICK = 'tick-secret-thu-0123456789';

let db: TestDb;
let pool: pg.Pool;
let coCong: Hono<any>;
let khongCong: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  const chung = { pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', tickSecret: TICK, secureCookie: false };
  coCong = createApp({ ...chung, proxySecret: PROXY }) as Hono<any>;
  khongCong = createApp(chung) as Hono<any>;
}, 120_000);

afterAll(async () => { await db?.stop(); });

const demThu = async (bucket: string): Promise<number> =>
  (await pool.query(`SELECT count(*)::int AS n FROM auth_attempts WHERE bucket = $1`, [bucket])).rows[0].n;

const dangNhap = (app: Hono<any>, email: string, them: Record<string, string> = {}) =>
  app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9', ...them },
    body: JSON.stringify({ email, password: 'mat-khau-bat-ky-123' }),
  });

describe('B1 — app có proxySecret: gọi thẳng origin bị chặn trước mọi route', () => {
  it('⭐ POST /auth/login trần ⇒ 403 khong_qua_cong, KHÔNG tiêu suất đăng nhập', async () => {
    const email = 'tran@dubao.test';
    const r = await dangNhap(coCong, email);
    expect(r.status).toBe(403);
    const b = await r.json() as { error: string; message: string };
    expect(b.error).toBe('khong_qua_cong');
    expect(typeof b.message).toBe('string');
    expect(await demThu(`login:email:${email}`)).toBe(0);
  });

  it('sai secret ⇒ 403 như không có', async () => {
    const r = await dangNhap(coCong, 'sai@dubao.test', { 'x-delphi-proxy-secret': 'doan-bua' });
    expect(r.status).toBe(403);
  });

  it('đúng secret (đường Worker) ⇒ tới route: email lạ 401 và suất bị tiêu như cũ', async () => {
    const email = 'quacong@dubao.test';
    const r = await dangNhap(coCong, email, { 'x-delphi-proxy-secret': PROXY, 'x-delphi-client-ip': '198.51.100.7' });
    expect(r.status).toBe(401);
    expect(await demThu(`login:email:${email}`)).toBe(1);
  });

  it('/internal/tick gọi thẳng đúng tick-secret ⇒ 200 (cron-job.org không đi qua Worker)', async () => {
    const r = await coCong.request('/api/v1/internal/tick', { method: 'POST', headers: { 'x-tick-secret': TICK } });
    expect(r.status).toBe(200);
  });

  it('/internal/tick gọi thẳng SAI tick-secret ⇒ 401 của route (miễn cổng không phải miễn khoá)', async () => {
    const r = await coCong.request('/api/v1/internal/tick', { method: 'POST', headers: { 'x-tick-secret': 'sai' } });
    expect(r.status).toBe(401);
  });

  it('⭐ /health gọi thẳng không secret nào ⇒ đúng hai trường, 0 truy vấn DB', async () => {
    const spy = vi.spyOn(pool, 'query');
    try {
      const r = await coCong.request('/api/v1/health');
      expect(r.status).toBe(200);
      const b = await r.json() as Record<string, unknown>;
      expect(Object.keys(b).sort()).toEqual(['ban_phat_hanh', 'status']);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('/health qua Worker (có proxy secret) vẫn kiểm DB như cũ — chỉ gọi thẳng mới bị cắt', async () => {
    const spy = vi.spyOn(pool, 'query');
    try {
      const r = await coCong.request('/api/v1/health', { headers: { 'x-delphi-proxy-secret': PROXY } });
      expect([200, 500]).toContain(r.status);
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('/health gọi thẳng kèm x-tick-secret (người vận hành) ⇒ thân chi tiết, db_ok thật', async () => {
    const r = await coCong.request('/api/v1/health', { headers: { 'x-tick-secret': TICK } });
    const b = await r.json() as { db_ok?: boolean; proxy_secret_cau_hinh?: boolean };
    expect(b.db_ok).toBe(true);
    expect(b.proxy_secret_cau_hinh).toBe(true);
  });
});

describe('B1 — app KHÔNG có proxySecret (dev/test): mở như cũ', () => {
  it('POST /auth/login trần ⇒ 401 của route, không 403', async () => {
    const r = await dangNhap(khongCong, 'dev@dubao.test');
    expect(r.status).toBe(401);
  });

  it('/health trần vẫn kiểm DB (hành vi cũ giữ nguyên)', async () => {
    const spy = vi.spyOn(pool, 'query');
    try {
      await khongCong.request('/api/v1/health');
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
