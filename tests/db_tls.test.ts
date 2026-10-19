/**
 * B3 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — KẾT NỐI SUPABASE KIỂM CHỨNG CHỈ.
 *
 * Hành vi đổi: trước bản vá mọi URL `supabase.` đi TLS với `rejectUnauthorized: false` — mã hoá mà không biết đầu kia
 * là ai, nên kẻ đứng giữa (Wi-Fi quán, máy founder chạy script) đọc được cả mật khẩu DB lẫn dữ liệu. Nay ghim CA gốc của
 * Supabase (`config/supabase_ca.ts`, công khai) + `rejectUnauthorized: true`; `DATABASE_SSL_CA` ghi đè được.
 * Cái gãy được thứ hai, kín hơn: `pg` để `sslmode` TRONG URL đè lên `ssl` của mình (`Object.assign(config, parse(url))`)
 * ⇒ một `?sslmode=no-verify` trong biến môi trường âm thầm tắt lại bản vá. `urlChoPool` bỏ các khoá `ssl*` khỏi URL.
 *
 * Tiêm ngược: trả `rejectUnauthorized: false` ⇒ ca đầu đỏ; bỏ bước gỡ `sslmode` ⇒ ca URL đỏ.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { X509Certificate } from 'node:crypto';
import { tuyChonSsl, urlChoPool } from '../server/db.js';
import { SUPABASE_CA_GOC } from '../config/supabase_ca.js';

const POOLER = 'postgresql://postgres.abcxyz:mk@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';
const cu = process.env.DATABASE_SSL_CA;
afterEach(() => { if (cu === undefined) delete process.env.DATABASE_SSL_CA; else process.env.DATABASE_SSL_CA = cu; });

describe('B3 — tuyChonSsl', () => {
  it('⭐ URL Supabase (pooler lẫn trực tiếp) ⇒ rejectUnauthorized true + ca là chứng chỉ', () => {
    delete process.env.DATABASE_SSL_CA;
    for (const url of [POOLER, 'postgresql://postgres:mk@db.abcxyz.supabase.co:5432/postgres']) {
      const ssl = tuyChonSsl(url);
      expect(ssl?.rejectUnauthorized, url).toBe(true);
      expect(ssl?.ca).toContain('BEGIN CERTIFICATE');
    }
  });

  it('CA ghim là "Supabase Root 2021 CA", tự ký, còn hạn tới 2031 (hết hạn thì bài này đỏ trước prod)', () => {
    const cert = new X509Certificate(SUPABASE_CA_GOC);
    expect(cert.subject).toContain('CN=Supabase Root 2021 CA');
    expect(cert.issuer).toBe(cert.subject);
    expect(cert.fingerprint256).toBe(
      '80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA');
    expect(new Date(cert.validTo).getTime()).toBeGreaterThan(Date.now());
  });

  it('DATABASE_SSL_CA ghi đè CA ghim', () => {
    process.env.DATABASE_SSL_CA = '-----BEGIN CERTIFICATE-----\nKHAC\n-----END CERTIFICATE-----';
    expect(tuyChonSsl(POOLER)?.ca).toContain('KHAC');
  });

  it('URL local / Postgres nhúng ⇒ undefined (không TLS)', () => {
    expect(tuyChonSsl('postgresql://postgres:postgres@127.0.0.1:5432/delphi')).toBeUndefined();
  });
});

describe('B3 — urlChoPool: sslmode trong URL không được đè bản vá', () => {
  it('⭐ URL Supabase có sslmode=no-verify ⇒ bị gỡ, giữ nguyên tham số khác', () => {
    const u = urlChoPool(`${POOLER}?sslmode=no-verify&application_name=delphi&sslrootcert=x`);
    expect(u).not.toMatch(/sslmode|sslrootcert/);
    expect(u).toContain('application_name=delphi');
    expect(u.startsWith(POOLER)).toBe(true);
  });

  it('URL không phải Supabase ⇒ giữ nguyên từng ký tự', () => {
    const u = 'postgresql://a:b@127.0.0.1:5432/x?sslmode=disable';
    expect(urlChoPool(u)).toBe(u);
  });
});
