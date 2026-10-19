/**
 * ĐĂNG KÝ TỪ LINK BÀN BUỔI ĐO (D333). Một buổi đo chạy trong MỘT phòng học ⇒ cả lớp chung MỘT IP ⇒ trần
 * `REGISTER_MAX_PER_IP` (5/giờ) chặn người thứ sáu. Mã bàn buổi đo CÒN MỞ đổi xô hạn mức sang theo BÀN.
 *
 * Canh hai chiều — cửa này là cửa công khai, nới sai là mở cho kẻ dội thư:
 *  §I   ⭐ mã bàn buổi đo đang mở ⇒ cả lớp một IP đều tạo được tài khoản;
 *  §II  mã đã đóng · mã bàn KHÔNG phải buổi đo · mã không tồn tại ⇒ vẫn trần IP như chưa gửi mã;
 *  §III trần theo bàn có thật và đúng bằng `REGISTER_MAX_PER_BAN`;
 *  §IV  link xác minh mang mã bàn — chỉ mã đã kiểm, không vọng lại chữ người gửi tự đặt.
 *  §V   D392 — đăng ký từ bàn buổi đo ĐANG MỞ ⇒ có phiên ngay, lập hồ sơ không cần mở hộp thư (D370 ①).
 *       Đi trọn qua API thật: bài D370 cũ dựng phiên thẳng trong DB nên xanh trong khi cửa không có đường tới.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { AUTH } from '../config/auth.js';
import { DE_DANG_DUNG } from '../config/holdem_de.js';
import { checkAgeGate } from '../server/auth/age.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let mailer: CapturingMailer;
let DP: TestUser;

/** Năm sinh dưới tuổi: age gate chặn SAU khi đã tiêu suất, và KHÔNG băm mật khẩu — đếm trần rẻ. */
const NAM_DUOI_TUOI = new Date().getFullYear() - 10;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  mailer = new CapturingMailer();
  app = createApp({
    pool, mailer, appBaseUrl: 'https://dubao.test', tickSecret: 'tick-dk-ban', secureCookie: false,
  }) as Hono<any>;
  DP = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function taoBan(ma: string, loai: 'buoi_do' | 'doi', mo: boolean): Promise<void> {
  const de = DE_DANG_DUNG[0]!;
  const hetHan = mo ? `now() + interval '2 hours'` : `now() - interval '1 minute'`;
  if (loai === 'buoi_do') {
    await pool.query(
      `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, loai, het_han, de_id, nhan, balance_version)
       VALUES ($1, $2, $3, $4, 'buoi_do', ${hetHan}, $5, 'lop-dk', $6)`,
      [ma, de.seed, de.so_o, DP.userId, de.id, de.balance_version]);
  } else {
    await pool.query(
      `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, het_han) VALUES ($1, 42, 8, $2, ${hetHan})`,
      [ma, DP.userId]);
  }
}

/** Bắn `n` lượt đăng ký SONG SONG từ một IP; trả số lượt KHÔNG bị 429. */
async function banLoat(opts: { ip: string; n: number; banMa?: string; namSinh?: number; tienTo: string }) {
  const res = await Promise.all(Array.from({ length: opts.n }, (_, i) =>
    app.request('http://localhost/api/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': opts.ip },
      body: JSON.stringify({
        email: `${opts.tienTo}_${i}@test.local`,
        password: 'matkhaudumanh1',
        birth_year: opts.namSinh ?? 2005,
        ...(opts.banMa !== undefined ? { ban_ma: opts.banMa } : {}),
      }),
    })));
  return {
    khongChan: res.filter((r) => r.status !== 429).length,
    trangThai: res.map((r) => r.status),
  };
}

describe('§I — cả lớp chung một IP', () => {
  it('⭐ mã bàn buổi đo đang mở ⇒ mười người cùng một IP đều tạo được tài khoản', async () => {
    await taoBan('lop01', 'buoi_do', true);
    const kq = await banLoat({ ip: '203.0.113.10', n: 10, banMa: 'lop01', tienTo: 'lop01' });
    // 201 (không phải 202): từ D392 lượt đăng ký qua bàn đang mở trả luôn phiên — xem §V.
    expect(kq.trangThai.every((s) => s === 201), JSON.stringify(kq.trangThai)).toBe(true);
  });

  it('mã viết HOA / có khoảng trắng vẫn nhận (người ta chép mã từ bảng chiếu)', async () => {
    await taoBan('lop02', 'buoi_do', true);
    const kq = await banLoat({ ip: '203.0.113.11', n: 8, banMa: ' LOP02 ', tienTo: 'lop02' });
    expect(kq.khongChan).toBe(8);
  });
});

describe('§II — không phải bàn buổi đo đang mở thì như chưa gửi mã', () => {
  it('bàn buổi đo ĐÃ ĐÓNG ⇒ trần IP', async () => {
    await taoBan('dong1', 'buoi_do', false);
    const kq = await banLoat({ ip: '203.0.113.20', n: 12, banMa: 'dong1', namSinh: NAM_DUOI_TUOI, tienTo: 'dong1' });
    expect(kq.khongChan).toBe(AUTH.REGISTER_MAX_PER_IP);
  });

  it('bàn mời bạn (loai doi) còn mở ⇒ trần IP — chỉ người điều phối mới mở được xô theo bàn', async () => {
    await taoBan('doi01', 'doi', true);
    const kq = await banLoat({ ip: '203.0.113.21', n: 12, banMa: 'doi01', namSinh: NAM_DUOI_TUOI, tienTo: 'doi01' });
    expect(kq.khongChan).toBe(AUTH.REGISTER_MAX_PER_IP);
  });

  it('mã không tồn tại · sai hình dạng · không phải chuỗi ⇒ trần IP', async () => {
    for (const [i, ma] of (['zzzzz', 'abc', 12345] as unknown as string[]).entries()) {
      const kq = await banLoat({
        ip: `203.0.113.3${i}`, n: 12, banMa: ma, namSinh: NAM_DUOI_TUOI, tienTo: `la${i}`,
      });
      expect(kq.khongChan, String(ma)).toBe(AUTH.REGISTER_MAX_PER_IP);
    }
  });
});

describe('§III — trần theo bàn có thật', () => {
  it('⭐ song song vượt trần ⇒ lọt ĐÚNG REGISTER_MAX_PER_BAN, dù mỗi lượt một IP khác', async () => {
    await taoBan('tran1', 'buoi_do', true);
    const n = AUTH.REGISTER_MAX_PER_BAN + 10;
    const res = await Promise.all(Array.from({ length: n }, (_, i) =>
      app.request('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${i}` },
        body: JSON.stringify({
          email: `tran1_${i}@test.local`, password: 'matkhaudumanh1', birth_year: NAM_DUOI_TUOI, ban_ma: 'tran1',
        }),
      })));
    expect(res.filter((r) => r.status !== 429).length).toBe(AUTH.REGISTER_MAX_PER_BAN);
  });
});

describe('§IV — link xác minh', () => {
  it('đăng ký qua bàn mở ⇒ link mang &ban=<mã chuẩn hoá>; mã giả ⇒ link không mang gì', async () => {
    await taoBan('link1', 'buoi_do', true);
    await banLoat({ ip: '203.0.113.40', n: 1, banMa: 'LINK1', tienTo: 'link1' });
    const thu = mailer.sent.find((m) => m.to === 'link1_0@test.local');
    expect(thu?.text).toContain('/verify-email?token=');
    expect(thu?.text).toMatch(/&ban=link1(\s|$)/);

    await banLoat({ ip: '203.0.113.41', n: 1, banMa: 'qqqqq', tienTo: 'link2' });
    const thuGia = mailer.sent.find((m) => m.to === 'link2_0@test.local');
    expect(thuGia?.text).toContain('/verify-email?token=');
    expect(thuGia?.text).not.toContain('&ban=');
  });
});

/*
 * §V — D392. Trước bản này: đăng ký qua bàn buổi đo vẫn ra hộp "KIỂM TRA HỘP THƯ" và đăng nhập thì chặn email
 * chưa xác minh — tức cửa D370 ở `/onboarding` đứng đó mà không ai đi tới được. Đi thử bằng trình duyệt 23/09
 * mới lộ; bài D370 ở `buoi_do_tu_phuc_vu.test.ts` dựng phiên thẳng trong DB nên không thấy.
 */
async function dangKy(email: string, opts: { banMa?: string; ip: string }) {
  const r = await app.request('http://localhost/api/v1/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': opts.ip },
    body: JSON.stringify({
      email, password: 'matkhaudumanh1', birth_year: 2005,
      ...(opts.banMa !== undefined ? { ban_ma: opts.banMa } : {}),
    }),
  });
  const cookie = /(?:^|,\s*)([^=;,\s]+=[^;]+)/.exec(r.headers.get('set-cookie') ?? '')?.[1] ?? null;
  return { status: r.status, body: await r.json() as Record<string, unknown>, cookie };
}

async function goiVoiCookie(cookie: string, path: string, init: RequestInit = {}) {
  const r = await app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) },
  });
  return { status: r.status, body: await r.json().catch(() => null) as any };
}

const hoSo = (banMa?: string) => ({
  handle: `dk${Math.random().toString(36).slice(2, 9)}`,
  age_band: '18-22', region: 'bac', occupation_band: 'hs_sv', research_consent: true,
  ...(banMa ? { ban_ma: banMa } : {}),
});

describe('§V — D392: đăng ký từ bàn buổi đo đang mở ⇒ vào thẳng hồ sơ', () => {
  it('⭐⭐ đăng ký → có phiên ngay → /me đã đăng nhập → lập hồ sơ được mà email CHƯA xác minh', async () => {
    await taoBan('vao01', 'buoi_do', true);
    const dk = await dangKy('vao01@test.local', { banMa: 'vao01', ip: '203.0.113.50' });
    expect(dk.status, JSON.stringify(dk.body)).toBe(201);
    expect(dk.body.dang_nhap).toBe(true);
    expect(dk.body.onboarded).toBe(false);
    expect(typeof dk.body.token, 'token ra thân phản hồi như /auth/login (Activity Discord)').toBe('string');
    expect(dk.cookie, 'phải cấp cookie phiên').not.toBeNull();

    const me = await goiVoiCookie(dk.cookie!, '/api/v1/auth/me');
    expect(me.status, JSON.stringify(me.body)).toBe(200);
    expect(me.body.onboarded).toBe(false);
    expect(me.body.email_verified).toBe(false);
    // D396 — /me chở nhóm tuổi đã suy từ năm sinh lúc đăng ký (màn hồ sơ chọn sẵn, không bắt chọn lại).
    expect(me.body.nhom_tuoi_khai).toBe(checkAgeGate(2005).ageBand);

    const ob = await goiVoiCookie(dk.cookie!, '/api/v1/onboarding', { method: 'POST', body: JSON.stringify(hoSo('vao01')) });
    expect(ob.status, JSON.stringify(ob.body)).toBeLessThan(300);

    const { rows } = await pool.query(
      `SELECT email_verified_at, user_id FROM auth_accounts WHERE email = 'vao01@test.local'`);
    expect(rows[0].user_id, 'phải có hồ sơ').not.toBeNull();
    expect(rows[0].email_verified_at, 'KHÔNG được âm thầm đánh dấu là đã xác minh').toBeNull();
    // Thư xác minh vẫn đi: là đường khôi phục mật khẩu sau này, và link vẫn mang mã bàn.
    expect(mailer.sent.find((m) => m.to === 'vao01@test.local')?.text).toMatch(/&ban=vao01(\s|$)/);
  });

  it('token trong thân phản hồi dùng được như Bearer (đường Activity Discord)', async () => {
    await taoBan('vao02', 'buoi_do', true);
    const dk = await dangKy('vao02@test.local', { banMa: 'vao02', ip: '203.0.113.51' });
    const r = await app.request('http://localhost/api/v1/auth/me', {
      headers: { authorization: `Bearer ${String(dk.body.token)}` },
    });
    expect(r.status).toBe(200);
  });

  it('không mã bàn · bàn đã đóng · bàn không phải buổi đo ⇒ 202, KHÔNG phiên, KHÔNG token — đường thường y cũ', async () => {
    await taoBan('vao03', 'buoi_do', false);
    await taoBan('vao04', 'doi', true);
    for (const [i, banMa] of ([undefined, 'vao03', 'vao04', 'zzzzz'] as const).entries()) {
      const dk = await dangKy(`vao0x_${i}@test.local`, { ...(banMa ? { banMa } : {}), ip: `203.0.113.6${i}` });
      expect(dk.status, String(banMa)).toBe(202);
      expect(dk.cookie, String(banMa)).toBeNull();
      expect(dk.body.token, String(banMa)).toBeUndefined();
      expect(dk.body.dang_nhap, String(banMa)).toBeUndefined();
    }
  });

  it('⭐⭐ email ĐÃ CÓ tài khoản + bàn đang mở ⇒ 202, KHÔNG phiên (không trao tài khoản người khác cho ai gõ được email)', async () => {
    await taoBan('vao05', 'buoi_do', true);
    const dau = await dangKy('chu_that@test.local', { ip: '203.0.113.70' });
    expect(dau.status).toBe(202);
    const ke = await dangKy('chu_that@test.local', { banMa: 'vao05', ip: '203.0.113.71' });
    expect(ke.status).toBe(202);
    expect(ke.cookie).toBeNull();
    expect(ke.body.token).toBeUndefined();
    expect(ke.body.dang_nhap).toBeUndefined();
  });
});
