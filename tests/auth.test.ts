/**
 * GĐ2 — Test toàn bộ tầng HTTP auth/onboarding bằng đồ THẬT:
 * Hono app + embedded Postgres + argon2 thật + mailer bắt thư.
 * Không mock cái gì (A8.9) → test này chính là nghiệm thu tự động của GĐ2.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { moCuaAdmin } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { auditSupply } from '../scripts/audit_supply.js';
import { ECONOMY } from '../config/economy.js';
import { checkAgeGate, toAgeBand } from '../server/auth/age.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let mailer: CapturingMailer;

const TICK_SECRET = 'test-tick-secret-0123456789';
const PASSWORD = 'mat-khau-du-dai-123';

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  mailer = new CapturingMailer();
  app = createApp({
    pool,
    mailer,
    appBaseUrl: 'https://dubao.test',
    tickSecret: TICK_SECRET,
    secureCookie: false,
  }) as Hono<any>;
});

afterAll(async () => {
  await db?.stop();
});

// ---------- helpers ----------

let ipCounter = 0;
/** Mỗi lần gọi một IP khác — rate limit đăng ký theo IP không làm nhiễu test khác. */
function freshIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

async function post(path: string, body: unknown, opts: { cookie?: string; ip?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.cookie) headers.cookie = opts.cookie;
  headers['x-forwarded-for'] = opts.ip ?? freshIp();
  return app.request(path, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function get(path: string, opts: { cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  return app.request(path, { method: 'GET', headers });
}

/** Body JSON của response (Hono trả unknown — test đọc thoải mái). */
const j = (res: Response): Promise<any> => res.json() as Promise<any>;

function sessionCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? '';
  const value = raw.split(';')[0];
  return value ?? '';
}

function tokenFromLastMail(): string {
  const link = mailer.last()!.text.match(/token=([A-Za-z0-9_-]+)/);
  return link![1]!;
}

/** Đăng ký → xác minh email → đăng nhập. Trả cookie phiên. */
async function registerVerifyLogin(email: string, birthYear = 2000): Promise<string> {
  const reg = await post('/api/v1/auth/register', { email, password: PASSWORD, birth_year: birthYear });
  expect(reg.status).toBe(202);
  const verify = await post('/api/v1/auth/verify-email', { token: tokenFromLastMail() });
  expect(verify.status).toBe(200);
  const login = await post('/api/v1/auth/login', { email, password: PASSWORD });
  expect(login.status).toBe(200);
  return sessionCookie(login);
}

async function onboard(
  cookie: string, handle: string, ageBand = '23-30',
  avatar: { avatar_goc?: string; avatar_ms?: number } = { avatar_goc: 'B', avatar_ms: 4200 },
) {
  return post(
    '/api/v1/onboarding',
    {
      handle,
      age_band: ageBand,
      region: 'bac',
      occupation_band: 'hs_sv',
      research_consent: true,
      ...avatar,
    },
    { cookie },
  );
}

// ---------- hàm thuần: age gate ----------

describe('age gate (C8) — hàm thuần', () => {
  const now = new Date('2026-07-17T00:00:00Z');

  it('2012 → 14 tuổi → CHẶN; 2009 → 17 tuổi → QUA (đúng nghiệm thu GĐ2)', () => {
    const under = checkAgeGate(2012, now);
    expect(under.ok).toBe(false);
    expect(under.age).toBe(14);
    expect(under.reason).toBe('under_age');

    const ok = checkAgeGate(2009, now);
    expect(ok.ok).toBe(true);
    expect(ok.age).toBe(17);
    expect(ok.ageBand).toBe('16-17');
  });

  it('đúng ngưỡng AGE_GATE_MIN: 16 tuổi qua, 15 tuổi chặn', () => {
    expect(checkAgeGate(now.getUTCFullYear() - ECONOMY.AGE_GATE_MIN, now).ok).toBe(true);
    expect(checkAgeGate(now.getUTCFullYear() - ECONOMY.AGE_GATE_MIN + 1, now).ok).toBe(false);
  });

  it('năm sinh vô lý bị từ chối', () => {
    expect(checkAgeGate(1800, now).reason).toBe('invalid_year');
    expect(checkAgeGate(2030, now).reason).toBe('invalid_year');
    expect(checkAgeGate(1.5, now).reason).toBe('invalid_year');
  });

  it('band đúng biên', () => {
    expect(toAgeBand(16)).toBe('16-17');
    expect(toAgeBand(17)).toBe('16-17');
    expect(toAgeBand(18)).toBe('18-22');
    expect(toAgeBand(22)).toBe('18-22');
    expect(toAgeBand(23)).toBe('23-30');
    expect(toAgeBand(30)).toBe('23-30');
    expect(toAgeBand(31)).toBe('31-45');
    expect(toAgeBand(46)).toBe('46+');
  });
});

// ---------- đăng ký ----------

describe('POST /auth/register', () => {
  it('năm sinh 2012 (14 tuổi) → 403 under_age, KHÔNG tạo tài khoản', async () => {
    const res = await post('/api/v1/auth/register', {
      email: 'teen@dubao.test',
      password: PASSWORD,
      birth_year: 2012,
    });
    expect(res.status).toBe(403);
    expect((await j(res)).error).toBe('under_age');
    const { rows } = await pool.query(`SELECT 1 FROM auth_accounts WHERE email = 'teen@dubao.test'`);
    expect(rows).toHaveLength(0);
  });

  it('hợp lệ → 202, chỉ lưu age_band, KHÔNG lưu năm sinh (C7)', async () => {
    const res = await post('/api/v1/auth/register', {
      email: 'ok@dubao.test',
      password: PASSWORD,
      birth_year: 2009,
    });
    expect(res.status).toBe(202);
    const { rows } = await pool.query(
      `SELECT pending_age_band, email_verified_at FROM auth_accounts WHERE email = 'ok@dubao.test'`,
    );
    expect(rows[0].pending_age_band).toBe('16-17');
    expect(rows[0].email_verified_at).toBeNull();
    expect(mailer.last()!.to).toBe('ok@dubao.test');
    expect(mailer.last()!.text).toContain('https://dubao.test/verify-email?token=');
  });

  it('KHÔNG bảng nào có cột năm sinh/ngày sinh (C7)', async () => {
    const { rows } = await pool.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (column_name ILIKE '%birth%' OR column_name ILIKE '%dob%'
               OR column_name ILIKE '%ngay_sinh%' OR column_name ILIKE '%nam_sinh%')`,
    );
    expect(rows).toEqual([]);
  });

  it('mật khẩu ngắn → 400; email sai định dạng → 400', async () => {
    const short = await post('/api/v1/auth/register', {
      email: 'a@dubao.test', password: '123', birth_year: 2000,
    });
    expect(short.status).toBe(400);
    const bad = await post('/api/v1/auth/register', {
      email: 'khong-phai-email', password: PASSWORD, birth_year: 2000,
    });
    expect(bad.status).toBe(400);
  });

  it('email trùng → vẫn 202 (không tiết lộ email đã tồn tại), không tạo dòng thứ hai', async () => {
    const res = await post('/api/v1/auth/register', {
      email: 'ok@dubao.test', password: PASSWORD, birth_year: 2000,
    });
    expect(res.status).toBe(202);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM auth_accounts WHERE email = 'ok@dubao.test'`,
    );
    expect(rows[0].n).toBe(1);
  });

  it('email hoa/thường coi là một (chuẩn hóa lowercase)', async () => {
    await post('/api/v1/auth/register', {
      email: 'HOA@Dubao.Test', password: PASSWORD, birth_year: 2000,
    });
    const { rows } = await pool.query(`SELECT email FROM auth_accounts WHERE email = 'hoa@dubao.test'`);
    expect(rows).toHaveLength(1);
  });

  it('rate limit: quá 5 lần đăng ký/IP/giờ → 429', async () => {
    const ip = '203.0.113.9';
    for (let i = 0; i < 5; i++) {
      const r = await post(
        '/api/v1/auth/register',
        { email: `spam${i}@dubao.test`, password: PASSWORD, birth_year: 2000 },
        { ip },
      );
      expect(r.status).toBe(202);
    }
    const blocked = await post(
      '/api/v1/auth/register',
      { email: 'spam-x@dubao.test', password: PASSWORD, birth_year: 2000 },
      { ip },
    );
    expect(blocked.status).toBe(429);
  });

  /**
   * Hồi quy sự cố PROD 19/07/2026: Vercel ghi đè x-forwarded-for bằng IP edge
   * Cloudflare → cả PoP dùng chung bucket → khóa oan hàng loạt lúc beta.
   * Worker gửi IP thật qua x-delphi-client-ip + secret; API chỉ tin khi khớp.
   */
  describe('IP thật sau proxy Cloudflare (x-delphi-client-ip)', () => {
    const PROXY_SECRET = 'proxy-secret-cho-test-0123456789';
    let proxyApp: Hono<any>;

    beforeAll(() => {
      proxyApp = createApp({
        pool, mailer, appBaseUrl: 'https://dubao.test',
        proxySecret: PROXY_SECRET, secureCookie: false,
      }) as Hono<any>;
    });

    const reg = (email: string, headers: Record<string, string>) =>
      proxyApp.request('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ email, password: PASSWORD, birth_year: 2000 }),
      });

    it('CÙNG IP edge nhưng KHÁC IP thật → KHÔNG khóa oan (đúng bug prod)', async () => {
      const edge = '172.71.215.57'; // IP Cloudflare — trước đây cả đám dính chung
      for (let i = 0; i < 7; i++) {
        const res = await reg(`proxyok${i}@dubao.test`, {
          'x-forwarded-for': edge,
          'x-delphi-client-ip': `113.161.0.${i + 1}`, // 7 người thật khác nhau
          'x-delphi-proxy-secret': PROXY_SECRET,
        });
        expect(res.status).toBe(202); // vượt 5 vẫn qua vì đếm theo IP thật
      }
    });

    it('CÙNG IP thật → vẫn khóa sau 5 lần (rate limit còn hiệu lực)', async () => {
      const real = '113.161.99.99';
      const h = { 'x-forwarded-for': '172.70.208.24', 'x-delphi-client-ip': real,
                  'x-delphi-proxy-secret': PROXY_SECRET };
      for (let i = 0; i < 5; i++) {
        expect((await reg(`proxylim${i}@dubao.test`, h)).status).toBe(202);
      }
      expect((await reg('proxylim-x@dubao.test', h)).status).toBe(429);
    });

    /*
     * ⚠ ĐỔI LUẬT CÓ CHỦ ĐÍCH (B1, D613 — SPEC va-bao-mat-chuan-hoa-api-dot-1): bài cũ khẳng định "secret sai ⇒ route bỏ
     * qua IP giả, đếm theo x-forwarded-for, lần 6 mới 429". Từ cổng proxy, secret sai/thiếu KHÔNG TỚI ĐƯỢC route: 403
     * `khong_qua_cong` ngay lần đầu. Điều bài canh — kẻ giả IP không né được hạn mức để đẻ tài khoản — giữ nguyên và
     * chặt hơn: 0 tài khoản thay vì 5.
     */
    it('secret SAI/thiếu → 403 khong_qua_cong ngay lần đầu, không đẻ tài khoản nào dù đổi IP giả', async () => {
      const spoof = {
        'x-forwarded-for': '198.51.100.7',
        'x-delphi-client-ip': '1.2.3.4',
        'x-delphi-proxy-secret': 'secret-bia-dat',
      };
      for (let i = 0; i < 6; i++) {
        const r = await reg(`spoof${i}@dubao.test`, { ...spoof, 'x-delphi-client-ip': `9.9.9.${i}` });
        expect(r.status).toBe(403);
        expect((await j(r)).error).toBe('khong_qua_cong');
      }
      expect((await reg('spoof-thieu@dubao.test', { 'x-forwarded-for': '198.51.100.7' })).status).toBe(403);
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM auth_accounts WHERE email LIKE 'spoof%'`);
      expect(rows[0].n).toBe(0);
    });
  });
});

// ---------- xác minh email + đăng nhập ----------

describe('verify email + login', () => {
  it('chưa xác minh email → không đăng nhập được (403)', async () => {
    await post('/api/v1/auth/register', {
      email: 'chuaverify@dubao.test', password: PASSWORD, birth_year: 2000,
    });
    const res = await post('/api/v1/auth/login', { email: 'chuaverify@dubao.test', password: PASSWORD });
    expect(res.status).toBe(403);
    expect((await j(res)).error).toBe('email_not_verified');
  });

  it('token sai/đã dùng → 400; token đúng → verify được, đăng nhập được', async () => {
    await post('/api/v1/auth/register', {
      email: 'verify@dubao.test', password: PASSWORD, birth_year: 2000,
    });
    const token = tokenFromLastMail();
    expect((await post('/api/v1/auth/verify-email', { token: 'sai-token' })).status).toBe(400);
    expect((await post('/api/v1/auth/verify-email', { token })).status).toBe(200);
    // dùng lại token → chặn
    expect((await post('/api/v1/auth/verify-email', { token })).status).toBe(400);

    const login = await post('/api/v1/auth/login', { email: 'verify@dubao.test', password: PASSWORD });
    expect(login.status).toBe(200);
    expect(await j(login)).toMatchObject({ ok: true, onboarded: false });
    expect(sessionCookie(login)).toContain('delphi_session=');
    expect(login.headers.get('set-cookie')).toContain('HttpOnly');
  });

  it('sai mật khẩu 10 lần liên tiếp → 429; thông điệp không tiết lộ email tồn tại', async () => {
    const email = 'brute@dubao.test';
    await registerVerifyLogin(email);
    for (let i = 0; i < 10; i++) {
      const r = await post('/api/v1/auth/login', { email, password: 'sai-mat-khau-roi' });
      expect(r.status).toBe(401);
      expect((await j(r)).message).toBe('Email hoặc mật khẩu không đúng.');
    }
    const blocked = await post('/api/v1/auth/login', { email, password: PASSWORD });
    expect(blocked.status).toBe(429);
  });

  it('đăng nhập đúng xóa chuỗi sai → không bị khóa oan', async () => {
    const email = 'reset-fail@dubao.test';
    await registerVerifyLogin(email);
    for (let i = 0; i < 9; i++) {
      await post('/api/v1/auth/login', { email, password: 'sai' });
    }
    expect((await post('/api/v1/auth/login', { email, password: PASSWORD })).status).toBe(200);
    for (let i = 0; i < 9; i++) {
      await post('/api/v1/auth/login', { email, password: 'sai' });
    }
    expect((await post('/api/v1/auth/login', { email, password: PASSWORD })).status).toBe(200);
  });

  it('phiên: /auth/me cần cookie; logout giết phiên hẳn', async () => {
    const cookie = await registerVerifyLogin('phien@dubao.test');
    expect((await get('/api/v1/auth/me')).status).toBe(401);
    expect((await get('/api/v1/auth/me', { cookie })).status).toBe(200);
    expect((await post('/api/v1/auth/logout', {}, { cookie })).status).toBe(200);
    expect((await get('/api/v1/auth/me', { cookie })).status).toBe(401);
  });

  it('DB chỉ lưu HASH của phiên, không lưu token thô', async () => {
    const cookie = await registerVerifyLogin('hash-phien@dubao.test');
    const raw = cookie.split('=')[1]!;
    const { rows } = await pool.query(`SELECT token_hash FROM auth_sessions`);
    expect(rows.some((r) => r.token_hash === raw)).toBe(false);
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash))).toBe(true);
  });
});

// ---------- onboarding ----------

describe('POST /onboarding — một transaction: user + signup_grant + event', () => {
  it('hoàn tất → ví 1.000 T, ĐÚNG 1 ledger signup_grant, ĐÚNG 1 event onboard_demo', async () => {
    const cookie = await registerVerifyLogin('onb@dubao.test');
    const res = await onboard(cookie, 'nguoi_du_bao');
    expect(res.status).toBe(201);
    const body = await j(res);
    expect(body.bankroll).toBe(ECONOMY.STARTING_BANKROLL);

    const userId = body.user_id;
    const { rows: u } = await pool.query(`SELECT bankroll, season_id FROM users WHERE user_id = $1`, [userId]);
    expect(u[0].bankroll).toBe(BigInt(ECONOMY.STARTING_BANKROLL));
    expect(u[0].season_id).toMatch(/^\d{4}Q[1-4]$/);

    const { rows: led } = await pool.query(
      `SELECT delta, balance_after, reason FROM wallet_ledger WHERE user_id = $1`, [userId],
    );
    expect(led).toHaveLength(1);
    expect(led[0]).toMatchObject({ reason: 'signup_grant' });
    expect(led[0].delta).toBe(BigInt(ECONOMY.STARTING_BANKROLL));
    expect(led[0].balance_after).toBe(BigInt(ECONOMY.STARTING_BANKROLL));

    const { rows: ev } = await pool.query(
      `SELECT action_type, value_json FROM events WHERE user_id = $1 ORDER BY event_id`,
      [userId],
    );
    expect(ev.map((e) => e.action_type)).toEqual(['onboard_demo', 'avatar_chon']);
    expect(ev[0].value_json).toMatchObject({ region: 'bac', research_consent: true });
    /*
     * `avatar_chon` — revealed preference cua 100% nguoi dung, ghi CUNG transaction
     * voi viec tao ho so. `tu_chon` phai la `true` khi client co gui lua chon:
     * neu no la `false` thi phan bo thu ve la phan bo cua CAI MAC DINH chu khong
     * phai cua GU, va `events` append-only nen khong backfill lai duoc.
     */
    expect(ev[1].value_json).toMatchObject({ goc: 'B', tu_chon: true, ms_can_nhac: 4200 });

    const me = await j(await get('/api/v1/auth/me', { cookie }));
    expect(me).toMatchObject({ onboarded: true, user: { handle: 'nguoi_du_bao', bankroll: 1000 } });
    // Dien mao di KEM /auth/me (mot cot tren `users`, 0 round-trip them) va phai
    // mang dung la vua chon — khong phai la mac dinh.
    expect(me.user.dien_mao[1]).toBe('B');
  });

  it('KHONG gui avatar_goc (ban web cu trong cache) -> van onboard duoc, nhung tu_chon=false', async () => {
    /*
     * App la PWA co service worker va da co user that, nen "ban web cu hon API" la
     * trang thai binh thuong. Siet thanh 400 o day nghia la NGUOI MOI KHONG DANG KY
     * DUOC. Du lieu van sach vi `tu_chon` tach duoc "chon la A" khoi "khong chon".
     */
    const cookie = await registerVerifyLogin('onb_khong_avatar@dubao.test');
    const res = await onboard(cookie, 'khong_chon_la', '23-30', {});
    expect(res.status).toBe(201);
    const userId = (await j(res)).user_id;
    const { rows } = await pool.query(
      `SELECT value_json FROM events WHERE user_id = $1 AND action_type = 'avatar_chon'`,
      [userId],
    );
    expect(rows[0].value_json).toMatchObject({ tu_chon: false, ms_can_nhac: null });
  });

  it('onboard lần hai → 409, KHÔNG cấp vốn lần hai', async () => {
    const cookie = await registerVerifyLogin('onb2@dubao.test');
    expect((await onboard(cookie, 'lan_mot')).status).toBe(201);
    const again = await onboard(cookie, 'lan_hai');
    expect(again.status).toBe(409);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM wallet_ledger wl
        JOIN auth_accounts a ON a.user_id = wl.user_id WHERE a.email = 'onb2@dubao.test'`,
    );
    expect(rows[0].n).toBe(1);
  });

  it('handle trùng → 409; handle bậy/mạo danh → 400; handle sai định dạng → 400', async () => {
    const c1 = await registerVerifyLogin('h1@dubao.test');
    expect((await onboard(c1, 'trung_ten')).status).toBe(201);
    const c2 = await registerVerifyLogin('h2@dubao.test');
    expect((await onboard(c2, 'trung_ten')).status).toBe(409);
    expect((await onboard(c2, 'admin')).status).toBe(400);
    expect((await onboard(c2, 'AB')).status).toBe(400);
  });

  it('khai age_band khác năm sinh đã đăng ký → 400 (không lách age gate)', async () => {
    const cookie = await registerVerifyLogin('lach@dubao.test', 2009); // 17 tuổi → 16-17
    const res = await onboard(cookie, 'ke_lach', '23-30');
    expect(res.status).toBe(400);
    expect((await j(res)).error).toBe('age_band_mismatch');
    expect((await onboard(cookie, 'ke_lach', '16-17')).status).toBe(201);
  });

  it('chưa đăng nhập → 401', async () => {
    expect((await post('/api/v1/onboarding', { handle: 'ai_do' })).status).toBe(401);
  });
});

// ---------- phân quyền ----------

describe('phân quyền user/admin (GĐ2 việc 5)', () => {
  it('BA BẬC cửa admin: người thường → admin chưa 2FA → admin đã qua 2FA', async () => {
    const cookie = await registerVerifyLogin('thuong@dubao.test');
    const created = await j(await onboard(cookie, 'dan_thuong'));

    // (1) người thường — không lộ ra là phía sau còn lớp nào nữa
    // K5 — `/admin/ping` (route chỉ để test) đã xoá; `/admin/quyen` là route admin GET rẻ nhất mang đúng ba guard.
    const r1 = await get('/api/v1/admin/quyen', { cookie });
    expect(r1.status).toBe(403);
    expect((await j(r1)).error).toBe('forbidden');

    // (2) admin gán tay trong DB (đúng spec đợt đầu) — NHƯNG chưa bật 2FA.
    // Trước 0025 bậc này đã là 200; nay nó phải dừng lại, và bị dừng ĐÚNG CHỖ:
    // ép đi bật 2FA chứ không phải một câu "không có quyền" khó hiểu.
    await pool.query(`UPDATE users SET role = 'admin' WHERE user_id = $1`, [created.user_id]);
    const r2 = await get('/api/v1/admin/quyen', { cookie });
    expect(r2.status).toBe(403);
    expect((await j(r2)).error).toBe('can_ghi_danh_2fa');

    // (3) qua cửa 2FA → vào được
    await moCuaAdmin(pool, 'thuong@dubao.test');
    expect((await get('/api/v1/admin/quyen', { cookie })).status).toBe(200);
  });

  it('chưa onboarding → API cần hồ sơ trả 403 not_onboarded', async () => {
    const cookie = await registerVerifyLogin('chua-onb@dubao.test');
    const res = await get('/api/v1/admin/quyen', { cookie });
    expect(res.status).toBe(403);
    expect((await j(res)).error).toBe('not_onboarded');
  });
});

// ---------- tài khoản ----------

describe('tài khoản: đổi mật khẩu, quên mật khẩu, xóa (anonymize)', () => {
  it('đổi mật khẩu: sai mk hiện tại → 401; đúng → mọi phiên cũ chết, mk mới dùng được', async () => {
    const email = 'doimk@dubao.test';
    const cookie = await registerVerifyLogin(email);
    expect(
      (await post('/api/v1/account/password', { current_password: 'sai', new_password: 'mat-khau-moi-123' }, { cookie }))
        .status,
    ).toBe(401);

    const ok = await post(
      '/api/v1/account/password',
      { current_password: PASSWORD, new_password: 'mat-khau-moi-123' },
      { cookie },
    );
    expect(ok.status).toBe(200);
    expect((await get('/api/v1/auth/me', { cookie })).status).toBe(401);
    expect((await post('/api/v1/auth/login', { email, password: PASSWORD })).status).toBe(401);
    expect((await post('/api/v1/auth/login', { email, password: 'mat-khau-moi-123' })).status).toBe(200);
  });

  it('quên mật khẩu: email lạ vẫn 202 (không dò được user); token đặt lại dùng được một lần', async () => {
    const email = 'quenmk@dubao.test';
    await registerVerifyLogin(email);
    expect((await post('/api/v1/auth/forgot-password', { email: 'khong-ton-tai@dubao.test' })).status).toBe(202);
    expect((await post('/api/v1/auth/forgot-password', { email })).status).toBe(202);

    const token = tokenFromLastMail();
    expect((await post('/api/v1/auth/reset-password', { token, new_password: 'mat-khau-reset-1' })).status).toBe(200);
    expect((await post('/api/v1/auth/reset-password', { token, new_password: 'lan-hai-khong-duoc' })).status).toBe(400);
    expect((await post('/api/v1/auth/login', { email, password: 'mat-khau-reset-1' })).status).toBe(200);
  });

  /*
   * B11 (SPEC va-bao-mat-chuan-hoa-api-dot-1): đặt lại xong thì MỌI link đặt lại khác của tài khoản đó chết theo — trước
   * bản vá chỉ link vừa dùng bị đánh dấu, link thứ hai (thư cũ trong hộp thư, hoặc kẻ đã xin trước) sống tới hết hạn 2 giờ
   * và đổi được mật khẩu người vừa giành lại tài khoản. Tiêm: bỏ câu UPDATE thu hồi ⇒ link 2 trả 200 ⇒ đỏ.
   */
  it('⭐ B11 — xin 2 link, dùng link 1 ⇒ link 2 chết (400 invalid_token)', async () => {
    const email = 'quenmk2link@dubao.test';
    await registerVerifyLogin(email);
    expect((await post('/api/v1/auth/forgot-password', { email })).status).toBe(202);
    const link1 = tokenFromLastMail();
    expect((await post('/api/v1/auth/forgot-password', { email })).status).toBe(202);
    const link2 = tokenFromLastMail();
    expect(link2).not.toBe(link1);

    expect((await post('/api/v1/auth/reset-password', { token: link1, new_password: 'mat-khau-reset-2' })).status).toBe(200);
    const r = await post('/api/v1/auth/reset-password', { token: link2, new_password: 'ke-gian-doi-lai-1' });
    expect(r.status).toBe(400);
    expect((await j(r)).error).toBe('invalid_token');
    expect((await post('/api/v1/auth/login', { email, password: 'mat-khau-reset-2' })).status).toBe(200);
  });

  it('xóa tài khoản: email biến mất, KHÔNG đăng nhập lại được, events/ledger Ở LẠI dạng ẩn danh', async () => {
    const email = 'xoa@dubao.test';
    const cookie = await registerVerifyLogin(email);
    const created = await j(await onboard(cookie, 'sap_xoa'));
    const userId = created.user_id;

    expect((await post('/api/v1/account/delete', { password: 'sai' }, { cookie })).status).toBe(401);
    expect((await post('/api/v1/account/delete', { password: PASSWORD }, { cookie })).status).toBe(200);

    // danh tính biến mất
    const { rows: acc } = await pool.query(`SELECT 1 FROM auth_accounts WHERE email = $1`, [email]);
    expect(acc).toHaveLength(0);
    expect((await post('/api/v1/auth/login', { email, password: PASSWORD })).status).toBe(401);
    expect((await get('/api/v1/auth/me', { cookie })).status).toBe(401);

    // dữ liệu nghiên cứu ở lại, ẩn danh
    const { rows: u } = await pool.query(
      `SELECT handle, deleted_at, age_band, bankroll FROM users WHERE user_id = $1`, [userId],
    );
    expect(u).toHaveLength(1);
    expect(u[0].handle).toMatch(/^da_xoa_[0-9a-f]{12}$/);
    expect(u[0].deleted_at).not.toBeNull();
    /*
     * Xoá tài khoản = ẨN DANH HOÁ, KHÔNG xoá event (A3.3 append-only, và events
     * là sản phẩm). Đếm bằng DANH SÁCH LOẠI chứ không bằng con số: onboarding ghi
     * hai event (`onboard_demo` + `avatar_chon`), và một con số trần thì lần sau
     * thêm một loại event là test đỏ mà không nói được đỏ vì cái gì.
     */
    const { rows: ev } = await pool.query(
      `SELECT action_type FROM events WHERE user_id = $1 ORDER BY event_id`, [userId],
    );
    expect(ev.map((e) => e.action_type)).toEqual(['onboard_demo', 'avatar_chon']);
    const { rows: led } = await pool.query(
      `SELECT count(*)::int AS n FROM wallet_ledger WHERE user_id = $1`, [userId],
    );
    expect(led[0].n).toBe(1);
  });
});

// ---------- hạ tầng + bất biến tiền tệ ----------

describe('hạ tầng & bất biến', () => {
  it('/health trả JSON, db_ok true (heartbeat rỗng → degraded, đúng thiết kế)', async () => {
    // D444: db_ok ở phần CHI TIẾT, cần header x-tick-secret mới đọc được;
    // status thì luôn công khai (mã HTTP dựa vào nó, xem bài dưới).
    const res = await app.request('/api/v1/health', {
      headers: { 'x-tick-secret': TICK_SECRET },
    });
    const body = await j(res);
    expect(body.db_ok).toBe(true);
    expect(body.status).toBe('degraded');
    expect(res.status).toBe(500);
  });

  it('/internal/tick: sai secret → 401; đúng secret → ghi heartbeat + dọn rác', async () => {
    expect((await post('/api/v1/internal/tick', {})).status).toBe(401);
    const res = await app.request('/api/v1/internal/tick', {
      method: 'POST',
      headers: { 'x-tick-secret': TICK_SECRET },
    });
    expect(res.status).toBe(200);
    expect((await j(res)).ok).toBe(true);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM scheduler_heartbeat WHERE source = 'tick'`,
    );
    expect(rows[0].n).toBeGreaterThan(0);
  });

  it('endpoint không tồn tại → 404 JSON', async () => {
    const res = await get('/api/v1/khong-co-dau');
    expect(res.status).toBe(404);
    expect((await j(res)).error).toBe('not_found');
  });

  it('audit_supply CÂN sau toàn bộ kịch bản auth ở trên', async () => {
    const report = await auditSupply(pool);
    expect(report.problems).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
