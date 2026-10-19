/**
 * B14 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — TRẦN BODY TOÀN CỤC, đọc `content-length`, KHÔNG tiêu luồng body.
 *
 * Hành vi đổi: request `/api/*` khai thân > `AUTH.THAN_TOI_DA_BYTE` ⇒ 413 `body_qua_lon` trước mọi route.
 * Cái gãy được (bài học 12/08, chú thích ở `server/app.ts`): bản `hono/body-limit` cũ chặn đúng nhưng BỌC luồng
 * body ⇒ mọi route đọc body + `consumeLimit` treo tới 504. Nghiệm thu năm đó đo trên `/health` (không đọc body) nên
 * xanh mà prod chết. Nên bài này đo ĐÚNG đường hỏng: máy chủ HTTP thật (`@hono/node-server`, luồng thật như Vercel),
 * `POST /auth/login` đọc body + tiêu suất `consumeLimit` ⇒ vẫn 401 trong < 2 s.
 *
 * Tiêm ngược: bỏ middleware ⇒ ca 300 KB không còn 413 ⇒ đỏ.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import { serve, type ServerType } from '@hono/node-server';
import type { Hono } from 'hono';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { AUTH } from '../config/auth.js';

let db: TestDb;
let may: ServerType;
let goc: string;

beforeAll(async () => {
  db = await startTestDb();
  const app = createApp({
    pool: db.pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await new Promise<void>((xong) => {
    may = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => xong());
  });
  goc = `http://127.0.0.1:${(may.address() as AddressInfo).port}`;
}, 120_000);

afterAll(async () => {
  await new Promise<void>((xong) => { if (may) may.close(() => xong()); else xong(); });
  await db?.stop();
});

const guiLogin = (than: string) => fetch(`${goc}/api/v1/auth/login`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: than,
});

describe('B14 — trần body toàn cục', () => {
  it('trần là số kỹ thuật ở config, 256 KB', () => {
    expect(AUTH.THAN_TOI_DA_BYTE).toBe(256 * 1024);
  });

  it('⭐ thân 300 KB ⇒ 413 body_qua_lon, có message', async () => {
    const than = JSON.stringify({ email: 'a@b.vn', password: 'x'.repeat(300 * 1024) });
    const r = await guiLogin(than);
    expect(r.status).toBe(413);
    const b = await r.json() as { error: string; message: string };
    expect(b.error).toBe('body_qua_lon');
    expect(typeof b.message).toBe('string');
  });

  it('⭐ đường ĐỌC BODY + consumeLimit không treo: login thường vẫn 401 trong < 2 s (bài học 12/08)', async () => {
    const t0 = Date.now();
    const r = await guiLogin(JSON.stringify({ email: 'khong-co@dubao.test', password: 'mat-khau-bat-ky-1' }));
    expect(r.status).toBe(401);
    expect(Date.now() - t0).toBeLessThan(2_000);
  });

  it('thân sát trần (dưới 256 KB) vẫn tới route — trần không cắt nhầm', async () => {
    const than = JSON.stringify({ email: 'khong-co-2@dubao.test', password: 'x'.repeat(200 * 1024) });
    const r = await guiLogin(than);
    expect(r.status).not.toBe(413);
  });
});
