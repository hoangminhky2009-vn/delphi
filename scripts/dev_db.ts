/**
 * PostgreSQL dev local — embedded Postgres (binary thật, tải qua npm),
 * KHÔNG cần cài đặt hệ thống, không cần Docker, không cần quyền admin.
 *
 * Chạy: `npm run db:dev`  (giữ terminal mở; Ctrl+C để tắt)
 * Data nằm ở .local/pgdata (đã gitignore). Xóa thư mục đó = reset DB trắng.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, '.local', 'pgdata');
const PORT = 5544;
const DB_NAME = 'delphi_dev';

const epg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: 'postgres',
  password: 'postgres',
  port: PORT,
  persistent: true,
  // Windows mặc định initdb theo locale hệ thống (WIN1252) → ép UTF-8
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  onLog: () => {},
});

const alreadyInitialised = existsSync(path.join(DATA_DIR, 'PG_VERSION'));
if (!alreadyInitialised) {
  console.log('Khởi tạo cluster Postgres lần đầu (initdb)...');
  await epg.initialise();
}
await epg.start();

// Đảm bảo database dev tồn tại
const admin = epg.getPgClient('postgres');
await admin.connect();
const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
if (exists.rowCount === 0) {
  await epg.createDatabase(DB_NAME);
  console.log(`Đã tạo database ${DB_NAME}.`);
}
await admin.end();

console.log('');
console.log('✔ PostgreSQL dev đang chạy.');
console.log(`  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${PORT}/${DB_NAME}`);
console.log('  (giữ terminal này mở; Ctrl+C để tắt DB)');

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('\nĐang tắt PostgreSQL...');
  await epg.stop();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
// Giữ tiến trình sống
setInterval(() => {}, 1 << 30);
