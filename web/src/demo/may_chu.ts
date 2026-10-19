/**
 * BẢN DEMO "KHÁCH NÂNG CAO" — DỰNG MÁY CHỦ TRONG TRANG: PGlite (Postgres WASM) + đủ migration + CHÍNH `createApp` của
 * server + một khách gieo sẵn. Hàm thuần (không đụng `self`) để worker gọi và để bài test chạy được y hệt (A11.6: đo trên
 * đường chính, không đường tắt) — xem `web/tests/demo_may_chu.test.ts`.
 */
import './dem_node';
import { PGlite, types } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { taoPoolPglite } from './pg_pglite';
import { gieoKhach } from './gieo';

const MIGRATION = import.meta.glob('../../../migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as
  Record<string, string>;

export interface MayChu {
  /** `app.request(url, init)` — CHÍNH Hono app của server. */
  app: { request: (url: string, init?: RequestInit) => Response | Promise<Response> };
  /** Token phiên của khách — đi bằng `Authorization: Bearer` (xem `may_chu.worker.ts`). */
  token: string;
  userId: string;
  db: PGlite;
}

export async function dungMayChu(origin: string): Promise<MayChu> {
  // int8 trả CHUỖI như node-pg — server viết cho node-pg (đo: `count(*)` dùng `Number(...)`, id bigint so chuỗi).
  const db = new PGlite({ extensions: { pgcrypto }, parsers: { [types.INT8]: (x: string) => x } });
  await db.waitReady;
  // Phiên DB giờ UTC như prod và như testdb (D364) — PGlite mặc định lấy múi giờ máy người xem.
  await db.exec("SET TIME ZONE 'UTC'");
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  for (const ten of Object.keys(MIGRATION).sort()) {
    await db.exec(MIGRATION[ten]!);
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [ten.split('/').pop()]);
  }
  const pool = taoPoolPglite(db);
  const [{ createApp }, { CapturingMailer }] = await Promise.all([import('@server/app'), import('@server/email')]);
  const app = createApp({
    pool: pool as never, mailer: new CapturingMailer(), appBaseUrl: origin, tickSecret: 'demo', secureCookie: false,
  });
  const { userId, token } = await gieoKhach(pool as never);
  return { app, token, userId, db };
}
