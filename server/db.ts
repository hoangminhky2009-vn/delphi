/**
 * Kết nối PostgreSQL dùng chung cho scripts/server.
 *
 * C5: mọi giá trị token là số nguyên → cột BIGINT (int8) được parse thành
 * BigInt của JS (thay vì string mặc định của node-postgres) để tính toán
 * tiền tệ luôn là số học nguyên, không bao giờ lẫn float.
 */
import 'dotenv/config';
import pg from 'pg';

import { SUPABASE_CA_GOC } from '../config/supabase_ca.js';

// OID 20 = int8/BIGINT
pg.types.setTypeParser(20, (value: string) => BigInt(value));

const laSupabase = (url: string): boolean => /supabase\./.test(url);

/**
 * TLS cho kết nối DB — B3 (SPEC va-bao-mat-chuan-hoa-api-dot-1).
 *
 * ⚠ Bản cũ là `{ rejectUnauthorized: false }`: có mã hoá nhưng KHÔNG kiểm đầu kia là ai ⇒ kẻ đứng giữa (Wi-Fi quán, mạng
 * trường khi founder chạy script) đọc được mật khẩu DB và mọi dòng dữ liệu. Supabase ký bằng CA riêng (không có trong
 * kho CA hệ thống) — đó là lý do bản cũ tắt kiểm, và cách chữa đúng là GHIM CA đó, không phải tắt kiểm.
 * `DATABASE_SSL_CA` (nội dung PEM) ghi đè — chữa nóng khi Supabase đổi CA, không cần deploy mã.
 * URL không phải Supabase (Postgres nhúng, local) ⇒ không TLS, như cũ.
 */
export function tuyChonSsl(url: string): { ca: string; rejectUnauthorized: true } | undefined {
  if (!laSupabase(url)) return undefined;
  return { ca: process.env.DATABASE_SSL_CA?.trim() || SUPABASE_CA_GOC, rejectUnauthorized: true };
}

/**
 * ⚠ `pg` để tham số `ssl*` TRONG URL ĐÈ lên `ssl` truyền vào (`Object.assign(config, parse(connectionString))`) ⇒ một
 * `?sslmode=no-verify` trong biến môi trường âm thầm tắt lại bản vá trên, mà không có gì báo. URL Supabase nên bỏ
 * mọi khoá `ssl*`: chính sách TLS chỉ có một nguồn là `tuyChonSsl`. URL khác giữ nguyên từng ký tự.
 */
export function urlChoPool(url: string): string {
  if (!laSupabase(url)) return url;
  const u = new URL(url);
  const khoaSsl = [...u.searchParams.keys()].filter((k) => k.toLowerCase().startsWith('ssl'));
  if (khoaSsl.length === 0) return url; // không dựng lại URL khi không cần — mật khẩu mã hoá % giữ nguyên byte
  for (const k of khoaSsl) u.searchParams.delete(k);
  return u.toString();
}

/**
 * MỌI entrypoint (api/index.ts, dev_api, scripts) PHẢI tạo pool qua hàm này —
 * tự chế `new pg.Pool(...)` là né mất type parser BigInt ở trên → bankroll về
 * dạng STRING → "Cannot mix BigInt" nổ giữa transaction đặt cược (bug thật
 * 18/07/2026: prod + dev API từng tự tạo pool, test không bắt được vì testdb
 * đăng ký parser riêng).
 */
export function createPool(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
  opts: { max?: number; idleTimeoutMillis?: number } = {},
): pg.Pool {
  if (!databaseUrl) {
    throw new Error('Thiếu DATABASE_URL — copy .env.example thành .env rồi điền (xem README).');
  }
  const pool = new pg.Pool({
    connectionString: urlChoPool(databaseUrl),
    max: opts.max ?? 10,
    ...(opts.idleTimeoutMillis !== undefined ? { idleTimeoutMillis: opts.idleTimeoutMillis } : {}),
    connectionTimeoutMillis: 10_000,
    ssl: tuyChonSsl(databaseUrl),
  });
  // Idle client đứt (DB restart, mạng chập) phát 'error' — không listener là
  // uncaught event → CRASH process. Ghi log rồi để pool tự thay client.
  pool.on('error', (err) => console.error('pg pool idle client error:', err.message));
  return pool;
}
