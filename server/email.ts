/**
 * Gửi email — adapter, không khóa nhà cung cấp (A8.9).
 *   * dev/test: in ra console (và test bắt được qua CapturingMailer).
 *   * production: SMTP bất kỳ qua env SMTP_URL (Brevo/Mailjet/… — đổi provider
 *     = đổi env, không đụng code).
 * Nội dung email tiếng Việt (A8.8).
 */
// nodemailer ≥ 10 tự mang kiểu (viết lại bằng TypeScript) — không còn namespace `Transporter` của @types/nodemailer.
import type { Mail as ThuNodemailer } from 'nodemailer';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/**
 * Máy dev: in thư ra console.
 *
 * ⚠ B10 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — CHỈ người nhận + tiêu đề. Thân thư chở link có TOKEN (xác minh / đặt lại
 * mật khẩu); bản cũ in cả thân, và môi trường thử Vercel không đặt `APP_ENV` ⇒ token nằm trong log Vercel, ai đọc log là
 * đặt lại được mật khẩu người khác. Dev cần link thì bật `MAIL_LOG_BODY=1`.
 */
export class ConsoleMailer implements Mailer {
  async send(mail: Mail): Promise<void> {
    const than = process.env.MAIL_LOG_BODY === '1' ? `\n${mail.text}` : ' (thân thư ẩn — đặt MAIL_LOG_BODY=1 để in)';
    console.log(`[email → ${mail.to}] ${mail.subject}${than}`);
  }
}

/** Dùng trong test: giữ lại thư để assert (không mock HTTP, không cần SMTP). */
export class CapturingMailer implements Mailer {
  readonly sent: Mail[] = [];
  async send(mail: Mail): Promise<void> {
    this.sent.push(mail);
  }
  last(): Mail | undefined {
    return this.sent[this.sent.length - 1];
  }
}

export class SmtpMailer implements Mailer {
  private transport: ThuNodemailer | undefined;
  constructor(
    private readonly url: string,
    private readonly from: string,
  ) {}
  async send(mail: Mail): Promise<void> {
    if (!this.transport) {
      const nodemailer = await import('nodemailer');
      this.transport = nodemailer.createTransport(this.url);
    }
    await this.transport.sendMail({ from: this.from, ...mail });
  }
}

/** Chọn mailer theo env — production thiếu SMTP thì báo lỗi to, không im lặng nuốt thư. */
export function createMailerFromEnv(): Mailer {
  const url = process.env.SMTP_URL;
  const from = process.env.MAIL_FROM ?? 'Dự báo <no-reply@delphi.app>';
  if (url) return new SmtpMailer(url, from);
  /*
   * B10 — "ngoài máy dev" không chỉ là `APP_ENV=production`: Vercel tự đặt `VERCEL=1` cho MỌI project (kể cả
   * `delphi-api-thu`, nơi không ai đặt `APP_ENV`), và `NODE_ENV=production` là dấu chuẩn của các nền tảng khác.
   * Ở đó rơi về console là nuốt thư thật vào log — báo to lúc khởi động, không im lặng.
   */
  if (process.env.APP_ENV === 'production' || process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    throw new Error('Môi trường triển khai thiếu SMTP_URL — email xác minh sẽ không gửi được.');
  }
  return new ConsoleMailer();
}

export function verifyEmailMail(to: string, link: string): Mail {
  return {
    to,
    subject: 'Xác minh email — Dự báo',
    text:
      `Chào bạn,\n\nBấm liên kết sau để xác minh email và bắt đầu dùng Dự báo:\n${link}\n\n` +
      `Liên kết có hiệu lực trong 24 giờ. Nếu bạn không đăng ký, hãy bỏ qua thư này.`,
  };
}

export function resetPasswordMail(to: string, link: string): Mail {
  return {
    to,
    subject: 'Đặt lại mật khẩu — Dự báo',
    text:
      `Chào bạn,\n\nBấm liên kết sau để đặt lại mật khẩu:\n${link}\n\n` +
      `Liên kết có hiệu lực trong 2 giờ. Nếu bạn không yêu cầu, hãy bỏ qua thư này.`,
  };
}
