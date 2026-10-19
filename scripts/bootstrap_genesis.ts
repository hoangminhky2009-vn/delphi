/**
 * D10 — Cấp vốn Kho bạc MỘT LẦN khi khởi tạo môi trường (genesis_grant).
 *
 * Idempotent: đã có bút toán genesis_grant → bỏ qua, DB không đổi.
 * Lưới kép: unique partial index ở tầng DB chặn dòng genesis thứ hai kể cả
 * khi hai tiến trình chạy đua (advisory lock trong treasuryAppend đã chống
 * race, index là lớp bảo hiểm cuối).
 *
 * Chạy: `npm run bootstrap:genesis` (mọi môi trường, kể cả production).
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type pg from 'pg';
import { createPool } from '../server/db.js';
import { treasuryAppend } from '../server/treasury.js';
import { ECONOMY } from '../config/economy.js';

export async function bootstrapGenesis(pool: pg.Pool): Promise<'created' | 'skipped'> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // treasuryAppend lấy advisory xact lock → check-rồi-ghi là nguyên tử
    const exists = await client.query(
      `SELECT 1 FROM treasury_ledger WHERE reason = 'genesis_grant' LIMIT 1`,
    );
    if ((exists.rowCount ?? 0) > 0) {
      await client.query('ROLLBACK');
      return 'skipped';
    }
    await treasuryAppend(client, BigInt(ECONOMY.TREASURY_GENESIS), 'genesis_grant');
    await client.query('COMMIT');
    return 'created';
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const { chanEnvFileBiNuot, inDb } = await import('./moi_truong.js');
  const nuot = chanEnvFileBiNuot(process.env, 'bootstrap_genesis');
  if (nuot !== null) {
    console.error(`[31m${nuot}[0m`);
    process.exit(2);
  }
  inDb('CẤP VỐN GENESIS');
  const pool = createPool();
  try {
    const result = await bootstrapGenesis(pool);
    if (result === 'created') {
      console.log(`✔ Đã cấp vốn genesis Kho bạc: +${ECONOMY.TREASURY_GENESIS} T (một lần duy nhất).`);
    } else {
      console.log('✔ Genesis đã tồn tại — bỏ qua, DB không đổi.');
    }
  } finally {
    await pool.end();
  }
}
