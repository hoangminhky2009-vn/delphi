/**
 * Cửa duy nhất của API trên Vercel: mọi /api/* rewrite về đây (xem vercel.json).
 *
 * Vì sao MỘT function (A8.9): Hobby giới hạn 12 function/deployment — mỗi endpoint
 * một file sẽ chạm trần ngay ở GĐ3. Toàn bộ route nằm trong server/app.ts (Hono),
 * file này chỉ là ADAPTER: Vercel Node function nhận (IncomingMessage, ServerResponse)
 * → getRequestListener biến app.fetch (Web standard) thành listener Node.
 * Rời Vercel = thay đúng file này.
 */
import { getRequestListener } from '@hono/node-server';
import * as Sentry from '@sentry/node';
import { createApp } from '../server/app.js';
import { createPool } from '../server/db.js';
import { createMailerFromEnv } from '../server/email.js';
import { taoBackupRunnerTuEnv } from '../server/backup.js';
import { taoKenhBaoLoi } from '../server/bao_loi.js';
import { taoDocBanWeb } from '../server/canh.js';

/*
 * KÊNH BÁO LỖI (D93) — ĐÂY LÀ NƠI DUY NHẤT TRONG REPO IMPORT `@sentry/node`.
 * `server/` chỉ biết `KenhBaoLoi`; đổi nhà cung cấp = viết shim thoả `SdkBaoLoi`
 * rồi đổi đúng dòng import trên (A8.9). Không DSN ⇒ kênh im, app chạy y hệt.
 * `VERCEL_ENV`/`VERCEL_GIT_COMMIT_SHA` do Vercel tự đặt — không cần cấu hình.
 * Kiểm sau deploy: `curl -H "x-tick-secret: …" /api/v1/health` →
 * `bao_loi.noi_ra_ngoai: true` (từ D444, khoá này ở phần CHI TIẾT — không
 * header thì /health chỉ trả `{status, ban_phat_hanh}`, xem server/app.ts).
 */
const baoLoi = taoKenhBaoLoi({
  dsn: process.env.SENTRY_DSN,
  moiTruong: process.env.VERCEL_ENV ?? process.env.APP_ENV,
  phienBan: process.env.VERCEL_GIT_COMMIT_SHA,
}, Sentry);

// Pool ở scope module: tái dùng giữa các lần gọi trên cùng instance.
// max=1 vì serverless — mỗi instance một kết nối qua transaction pooler của
// Supabase (D11: serverless BẮT BUỘC dùng pooler, không nối thẳng DB).
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Thiếu env DATABASE_URL (transaction pooler URL của Supabase)');

// createPool BẮT BUỘC (đăng ký parser BIGINT→BigInt + pool.on('error') + SSL)
const pool = createPool(databaseUrl, { max: 1, idleTimeoutMillis: 10_000 });


const webCanh = process.env.CANH_WEB_ORIGIN
  ?? (process.env.ALLOWED_ORIGIN ?? '').split(',').map((x) => x.trim()).find(Boolean);

const app = createApp({
  pool,
  mailer: createMailerFromEnv(),
  appBaseUrl: process.env.APP_BASE_URL ?? 'https://api.example.vercel.app',
  tickSecret: process.env.TICK_SECRET,
  backupSecret: process.env.CRON_SECRET,
  proxySecret: process.env.PROXY_SHARED_SECRET,
  // Cửa Discord — vắng một trong hai thì endpoint trả 503 (fail-closed, D57).
  discordClientId: process.env.DISCORD_CLIENT_ID,
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET,
  // Backup đêm chỉ bật khi có đủ token + repo GitHub + BACKUP_KHOA (B2: bản mã AES-256-GCM) — thiếu một thì
  // endpoint trả 501, không bao giờ đẩy bản trần. Xem server/backup.ts + vercel.json (crons).
  runBackup: taoBackupRunnerTuEnv(process.env),
  allowedOrigin: process.env.ALLOWED_ORIGIN,
  secureCookie: true,
  baoLoi,
  // `/canh` so bản API với `/phien-ban.json` của web ở biên: CANH_WEB_ORIGIN nếu đặt, không thì origin ĐẦU của
  // ALLOWED_ORIGIN (Worker `dubao`). Không có cả hai ⇒ bỏ phép so bản, các phép kiểm khác vẫn chạy.
  docBanWeb: webCanh ? taoDocBanWeb(webCanh) : undefined,
});

export default getRequestListener(app.fetch);
