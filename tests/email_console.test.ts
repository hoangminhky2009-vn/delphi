/**
 * B10 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — THƯ IN RA CONSOLE KHÔNG CHỞ TOKEN, VÀ CHỈ Ở MÁY DEV.
 *
 * Hành vi đổi: trước bản vá, thiếu `SMTP_URL` mà `APP_ENV ≠ production` ⇒ `ConsoleMailer` in CẢ THÂN THƯ (link xác minh /
 * đặt lại mật khẩu có token). Môi trường thử Vercel `delphi-api-thu` không đặt `APP_ENV` ⇒ token nằm trong log Vercel,
 * ai đọc log là đặt lại được mật khẩu người khác. Nay: chạy trên Vercel (`VERCEL=1`) hoặc `NODE_ENV=production` cũng
 * ném lỗi như production; `ConsoleMailer` chỉ in người nhận + tiêu đề, thân thư chỉ khi `MAIL_LOG_BODY=1`.
 *
 * Tiêm ngược: trả lại `${mail.text}` trong log ⇒ ca token đỏ; bỏ điều kiện `VERCEL` ⇒ ca Vercel đỏ.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { ConsoleMailer, createMailerFromEnv, resetPasswordMail } from '../server/email.js';

const TOKEN = 'tok3n-bi-mat-ABCDEF0123456789';
const BIEN = ['SMTP_URL', 'APP_ENV', 'VERCEL', 'NODE_ENV', 'MAIL_LOG_BODY'] as const;
const cu = Object.fromEntries(BIEN.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of BIEN) {
    if (cu[k] === undefined) delete process.env[k];
    else process.env[k] = cu[k];
  }
  vi.restoreAllMocks();
});

const datEnv = (e: Partial<Record<(typeof BIEN)[number], string>>): void => {
  for (const k of BIEN) delete process.env[k];
  Object.assign(process.env, e);
};

async function batLog(f: () => Promise<void>): Promise<string> {
  const dong: string[] = [];
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { dong.push(a.map(String).join(' ')); });
  await f();
  return dong.join('\n');
}

describe('B10 — ConsoleMailer', () => {
  const thu = resetPasswordMail('ai@dubao.test', `https://dubao.test/reset-password?token=${TOKEN}`);

  it('⭐ log KHÔNG chứa token, vẫn có người nhận + tiêu đề', async () => {
    datEnv({});
    const log = await batLog(() => new ConsoleMailer().send(thu));
    expect(log).not.toContain(TOKEN);
    expect(log).toContain('ai@dubao.test');
    expect(log).toContain(thu.subject);
  });

  it('MAIL_LOG_BODY=1 (dev chủ động bật) ⇒ in cả thân thư', async () => {
    datEnv({ MAIL_LOG_BODY: '1' });
    const log = await batLog(() => new ConsoleMailer().send(thu));
    expect(log).toContain(TOKEN);
  });
});

describe('B10 — createMailerFromEnv không rơi về console ngoài máy dev', () => {
  it('⭐ VERCEL=1 thiếu SMTP_URL ⇒ ném (môi trường thử delphi-api-thu không có APP_ENV)', () => {
    datEnv({ VERCEL: '1' });
    expect(() => createMailerFromEnv()).toThrow(/SMTP_URL/);
  });

  it('NODE_ENV=production thiếu SMTP_URL ⇒ ném', () => {
    datEnv({ NODE_ENV: 'production' });
    expect(() => createMailerFromEnv()).toThrow(/SMTP_URL/);
  });

  it('APP_ENV=production thiếu SMTP_URL ⇒ ném (hành vi cũ giữ)', () => {
    datEnv({ APP_ENV: 'production' });
    expect(() => createMailerFromEnv()).toThrow(/SMTP_URL/);
  });

  it('máy dev (không biến nào) ⇒ ConsoleMailer', () => {
    datEnv({});
    expect(createMailerFromEnv()).toBeInstanceOf(ConsoleMailer);
  });
});
