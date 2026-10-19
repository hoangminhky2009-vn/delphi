/**
 * D444 (28/09) — `/api/v1/auth/login` KHÔNG ĐƯỢC lộ "email này có tồn tại
 * không" qua THỜI GIAN phản hồi. Đường CHÍNH qua HTTP, DB thật (không mock
 * `kiemMatKhau`) — đo đúng thứ kẻ tấn công đo được từ ngoài.
 *
 * ⚠ HAI NHÁNH:
 *   A. email KHÔNG tồn tại (một email ngẫu nhiên MỖI VÒNG — mỗi email một
 *      bucket rate-limit riêng, không vòng nào bị 429).
 *   B. email CÓ tồn tại (một tài khoản đã xác minh, tạo MỘT LẦN) + sai mật
 *      khẩu (cùng một bucket — 1 lần làm nóng + 5 vòng đo = 6 suất, dưới
 *      trần AUTH.LOGIN_MAX_FAILS=10 nên không vòng nào bị 429).
 * Trước D444: nhánh A không chạy argon2 (email lạ ⇒ trả 401 ngay), nhánh B
 * luôn chạy — chênh timing đo được từ ngoài. Sau D444 (`kiemMatKhau`, xem
 * `server/auth/crypto.ts`): cả hai nhánh đều tốn đúng một lượt argon2.
 *
 * ⚠ XEN KẼ A/B trong cùng một vòng lặp (không đo hết A rồi mới đo B) — chặn
 * trường hợp máy "nóng dần" theo thời gian làm một nhánh trông nhanh hơn nhánh
 * kia chỉ vì chạy sau.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';

const PASSWORD_THAT = 'mat-khau-that-du-dai-123';
const SO_VONG = 5;

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let mailer: CapturingMailer;

let demIp = 0;
/** Một IP mới mỗi lần gọi — hạn mức đăng ký/đăng nhập theo IP không nhiễu bài đo. */
function ipMoi(): string {
  demIp += 1;
  return `10.44.${Math.floor(demIp / 250)}.${demIp % 250}`;
}

function tokenTuMailCuoi(): string {
  const m = mailer.last()!.text.match(/token=([A-Za-z0-9_-]+)/);
  return m![1]!;
}

/** Đăng ký + xác minh email — cùng cách `tests/auth.test.ts` làm. Trả về email đã sẵn sàng đăng nhập. */
async function taoTaiKhoanDaXacMinh(): Promise<string> {
  const email = `da-xac-minh-${Date.now()}@dubao.test`;
  const reg = await app.request('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ipMoi() },
    body: JSON.stringify({ email, password: PASSWORD_THAT, birth_year: 2000 }),
  });
  if (reg.status !== 202) throw new Error(`đăng ký thất bại: HTTP ${reg.status}`);
  const verify = await app.request('/api/v1/auth/verify-email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ipMoi() },
    body: JSON.stringify({ token: tokenTuMailCuoi() }),
  });
  if (verify.status !== 200) throw new Error(`xác minh thất bại: HTTP ${verify.status}`);
  return email;
}

/** Một lượt đăng nhập, đo bằng performance.now(); khẳng định luôn 401 invalid_credentials. */
async function motLuotDangNhap(email: string, password: string): Promise<number> {
  const t0 = performance.now();
  const res = await app.request('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ipMoi() },
    body: JSON.stringify({ email, password }),
  });
  const ms = performance.now() - t0;
  const body = (await res.json()) as { error?: string };
  expect(res.status, `HTTP ${res.status}: ${JSON.stringify(body)}`).toBe(401);
  expect(body.error).toBe('invalid_credentials');
  return ms;
}

function trungVi(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!;
}

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  mailer = new CapturingMailer();
  app = createApp({
    pool, mailer, appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

describe('POST /auth/login — thời gian phản hồi không lộ email đã đăng ký (D444)', () => {
  it('trungVi(email lạ) / trungVi(email có, sai mật khẩu) >= 0.4', async () => {
    const emailThat = await taoTaiKhoanDaXacMinh();

    // Làm nóng MỖI NHÁNH một lần — bỏ kết quả, chỉ để JIT/thư viện argon2 hết
    // cold-start trước khi đo thật.
    await motLuotDangNhap(`nong-a-${Date.now()}@dubao.test`, 'bat-ky');
    await motLuotDangNhap(emailThat, 'sai-mat-khau-nong');

    const A: number[] = [];
    const B: number[] = [];
    for (let vong = 0; vong < SO_VONG; vong += 1) {
      // XEN KẼ trong cùng một vòng — không đo trọn A rồi mới đo trọn B.
      A.push(await motLuotDangNhap(`la-${Date.now()}-${vong}-${Math.random().toString(36).slice(2, 8)}@dubao.test`, 'bat-ky-mat-khau'));
      B.push(await motLuotDangNhap(emailThat, `sai-mat-khau-vong-${vong}`));
    }

    const trungViA = trungVi(A);
    const trungViB = trungVi(B);
    // In ra để báo cáo — hai trung vị (ms), đọc trực tiếp từ log chạy test.
    console.log(`[D444] trungVi(A email lạ) = ${trungViA.toFixed(2)} ms · trungVi(B email có, sai mk) = ${trungViB.toFixed(2)} ms · ti_le = ${(trungViA / trungViB).toFixed(3)}`);

    expect(trungViA / trungViB).toBeGreaterThanOrEqual(0.4);
  }, 60_000);
});
