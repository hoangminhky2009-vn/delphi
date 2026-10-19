/**
 * API dev local — để frontend (web/) gọi API THẬT trên máy, không mock (A8.9).
 *
 * Chạy: `npm run dev:api` (cần DB dev đang chạy: `npm run db:dev` ở terminal khác,
 * và đã `npm run migrate`). Email in ra console (ConsoleMailer) — link verify/reset
 * copy từ terminal, dán vào trình duyệt.
 *
 * Cùng createApp với production (api/index.ts) — chỉ khác adapter + cookie không
 * Secure vì localhost chạy HTTP.
 */
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from '../server/app.js';
import { createPool } from '../server/db.js';
import { createMailerFromEnv } from '../server/email.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Thiếu DATABASE_URL. Copy .env.example thành .env rồi chạy lại.');
  process.exit(1);
}
if (/supabase\./.test(databaseUrl)) {
  console.error('DATABASE_URL đang trỏ Supabase (prod). dev:api CHỈ chạy với DB dev local.');
  process.exit(1);
}

const PORT = Number(process.env.DEV_API_PORT ?? 8787);
const WEB_ORIGIN = process.env.DEV_WEB_ORIGIN ?? 'http://localhost:5173';

const pool = createPool(databaseUrl, { max: 5 }); // createPool = có parser BigInt
const app = createApp({
  pool,
  mailer: createMailerFromEnv(),
  appBaseUrl: WEB_ORIGIN, // link trong email trỏ về frontend dev
  tickSecret: process.env.TICK_SECRET,
  allowedOrigin: WEB_ORIGIN,
  secureCookie: false, // localhost là HTTP — cookie Secure sẽ không bao giờ được lưu
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`✔ API dev: http://localhost:${PORT}/api/v1/health`);
  console.log(`  Frontend dev (web/) proxy /api → cổng này. Email in ra console.`);
});
