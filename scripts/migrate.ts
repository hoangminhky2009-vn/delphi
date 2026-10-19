/**
 * Migration runner tối giản, tất định:
 * - Áp dụng migrations/*.sql theo thứ tự tên file (0001_, 0002_, ...).
 * - Mỗi file chạy trong MỘT transaction; lỗi → rollback file đó và dừng.
 * - Đã áp dụng thì bỏ qua (bảng schema_migrations) → chạy lại idempotent.
 * - Advisory lock chống 2 tiến trình migrate song song.
 *
 * Quy tắc GĐ1: mọi thay đổi schema từ nay về sau đều qua migration file mới —
 * CẤM sửa tay DB, CẤM sửa nội dung file migration đã áp dụng.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(ROOT, 'migrations');
/** Khóa advisory riêng cho migrate (số bất kỳ, cố định). */
const MIGRATE_LOCK_KEY = 81_500_1;

export async function runMigrations(pool: pg.Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATE_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    const done = new Set(
      (await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name as string),
    );
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} thất bại: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATE_LOCK_KEY]).catch(() => {});
    client.release();
  }
  return applied;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const { chanEnvFileBiNuot, inDb } = await import('./moi_truong.js');
  const nuot = chanEnvFileBiNuot(process.env, 'migrate');
  if (nuot !== null) {
    console.error(`[31m${nuot}[0m`);
    process.exit(2);
  }
  inDb('MIGRATE');
  const { createPool } = await import('../server/db.js');
  const pool = createPool();
  try {
    const applied = await runMigrations(pool);
    if (applied.length === 0) {
      console.log('✔ Không có migration mới — schema đã ở phiên bản mới nhất.');
    } else {
      for (const f of applied) console.log(`✔ Đã áp dụng: ${f}`);
    }
  } finally {
    await pool.end();
  }
}
