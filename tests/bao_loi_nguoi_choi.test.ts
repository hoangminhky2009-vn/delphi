/**
 * BÁO LỖI CỦA NGƯỜI CHƠI (SPEC `docs/spec/bao-loi-nguoi-choi.md` mục 5) — đường server.
 *
 * Phần A — LỖI CLIENT ẨN DANH (`POST /api/v1/loi-client`). Lời hứa ở điều khoản T4: "máy gửi về đúng ba thứ: một mã lỗi,
 * tên màn, số bản app. Không mã tài khoản, không email, không chữ bạn gõ … Sentry cũng không thấy địa chỉ mạng của bạn."
 * Nên bài ở đây quét CHÍNH GÓI tới SDK giả (đi qua adapter thật `taoKenhBaoLoi`), không quét response.
 *
 * Phần B — Ô BÁO LỖI (`POST /api/v1/bao-loi`, bảng `bao_loi` 0079 + email 0080). Lời hứa ở T5: chữ người gõ + mã tài khoản +
 * email cất trong DB (đọc ở admin, xoá cùng tài khoản); Sentry chỉ nhận chuông 'có báo lỗi mới' kèm số bản · tên màn · mã lỗi.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { taoKenhBaoLoi, type SdkBaoLoi } from '../server/bao_loi.js';
import { BAO_LOI, BAO_LOI_AN_DANH } from '../config/bao_loi.js';

let db: TestDb;
let pool: pg.Pool;

interface GoiSdk { ham: 'captureMessage' | 'captureException'; args: unknown[] }
let goiSdk: GoiSdk[] = [];
const sdkGia: SdkBaoLoi = {
  init: () => {},
  captureException: (...args) => { goiSdk.push({ ham: 'captureException', args }); return 'id'; },
  captureMessage: (...args) => { goiSdk.push({ ham: 'captureMessage', args }); return 'id'; },
  flush: async () => true,
};

const taoApp = (dsn: string | undefined): Hono<any> => createApp({
  pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  baoLoi: taoKenhBaoLoi({ dsn }, sdkGia),
}) as Hono<any>;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  await ensureGenesis(pool);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  app = taoApp('https://abc@o1.ingest.sentry.io/1');
}, 120_000);

afterAll(async () => {
  vi.restoreAllMocks();
  await db?.stop();
});

beforeEach(async () => {
  goiSdk = [];
  await pool.query(`DELETE FROM auth_attempts WHERE bucket LIKE 'loi_an_danh:%'`);
});

const GOI_DUNG = { ma: 'route:typeerror:1f3kq2', man: '/arena', ban: '0.0.65' };

const guiLoi = (
  body: unknown,
  o: { ip?: string; cookie?: string | undefined; app?: Hono<any> } = {},
): Promise<Response> =>
  Promise.resolve((o.app ?? app).request('/api/v1/loi-client', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': o.ip ?? '203.0.113.7',
      ...(o.cookie ? { cookie: o.cookie } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));

describe('A. lỗi client ẩn danh — POST /api/v1/loi-client', () => {
  it('khách · người đã bật nghiên cứu · người đã tắt: cả ba đều tới Sentry, gói đúng ba nhãn ma/man/ban', async () => {
    const dongY = await createTestUser(pool);
    const khongDongY = await createTestUser(pool);
    await pool.query(`UPDATE users SET research_consent = FALSE WHERE user_id = $1`, [khongDongY.userId]);

    const cookies = [undefined, dongY.cookie, khongDongY.cookie];
    for (const [i, cookie] of cookies.entries()) {
      const r = await guiLoi(GOI_DUNG, { cookie, ip: `198.51.100.${i + 1}` });
      expect(r.status).toBe(202);
    }
    expect(goiSdk).toHaveLength(3);
    for (const g of goiSdk) {
      expect(g.ham).toBe('captureMessage');
      const [ten, ctx] = g.args as [string, { tags: Record<string, string> }];
      expect(ten).toBe('loi_client');
      expect(Object.keys(ctx.tags).sort()).toEqual(['ban', 'ma', 'man']);
      expect(ctx.tags).toEqual(GOI_DUNG);
    }
  });

  it('gói tới SDK KHÔNG có user id · handle · cookie · IP · email — quét mọi khoá và mọi giá trị', async () => {
    const u = await createTestUser(pool);
    const ip = '192.0.2.55';
    // Client gian/lỗi nhét thêm trường: server phải dựng lại gói từ ba trường đã khai, không chuyền thân request.
    const r = await guiLoi(
      { ...GOI_DUNG, user_id: u.userId, email: 'a@b.vn', handle: u.handle, ip },
      { cookie: u.cookie, ip },
    );
    expect(r.status).toBe(202);
    expect(goiSdk).toHaveLength(1);
    const phang = JSON.stringify(goiSdk[0]!.args);
    const giaTriCam = [u.userId, u.handle, ip, 'a@b.vn', u.cookie.split('=')[1]!.split(';')[0]!];
    for (const cam of giaTriCam) expect(phang).not.toContain(cam);
    for (const khoa of ['user', 'user_id', 'email', 'ip', 'ip_address', 'cookie', 'tai_khoan', 'handle']) {
      expect(phang).not.toMatch(new RegExp(`"${khoa}"\\s*:`));
    }
  });

  it.each([
    ['ma có dấu cách', { ...GOI_DUNG, ma: 'TypeError: x of undefined' }],
    ['ma có @', { ...GOI_DUNG, ma: 'route:a@b.vn' }],
    ['man là URL cụ thể, không phải mẫu route', { ...GOI_DUNG, man: '/keo/8f3a-1234' }],
    ['ban sai hình', { ...GOI_DUNG, ban: 'v0.0.65-abc' }],
    ['thiếu ma', { man: '/arena', ban: '0.0.65' }],
    ['ma không phải chuỗi', { ...GOI_DUNG, ma: 42 }],
  ])('sai hình dạng (%s) ⇒ 202, bỏ im lặng, không gọi SDK', async (_ten, body) => {
    const r = await guiLoi(body);
    expect(r.status).toBe(202);
    expect(goiSdk).toHaveLength(0);
  });

  it('thân không phải JSON ⇒ 202, không gọi SDK', async () => {
    const r = await guiLoi('{khong-phai-json');
    expect(r.status).toBe(202);
    expect(goiSdk).toHaveLength(0);
  });

  it(`trần theo IP: lượt ${BAO_LOI_AN_DANH.TRAN_MOI_IP_NGAY + 1} từ cùng một IP ⇒ 202 nhưng không gọi SDK`, async () => {
    for (let i = 0; i < BAO_LOI_AN_DANH.TRAN_MOI_IP_NGAY + 1; i += 1) {
      const r = await guiLoi({ ...GOI_DUNG, ma: `route:typeerror:${i}` }, { ip: '203.0.113.99' });
      expect(r.status).toBe(202);
    }
    expect(goiSdk).toHaveLength(BAO_LOI_AN_DANH.TRAN_MOI_IP_NGAY);
    // IP khác vẫn đi được — trần theo IP không đóng cửa người khác.
    await guiLoi(GOI_DUNG, { ip: '203.0.113.100' });
    expect(goiSdk).toHaveLength(BAO_LOI_AN_DANH.TRAN_MOI_IP_NGAY + 1);
  });

  it(`trần toàn cục: lượt ${BAO_LOI_AN_DANH.TRAN_TOAN_CUC_NGAY + 1} trong ngày (mỗi lượt một IP) ⇒ 202 nhưng không gọi SDK`, async () => {
    for (let i = 0; i < BAO_LOI_AN_DANH.TRAN_TOAN_CUC_NGAY + 1; i += 1) {
      const r = await guiLoi(GOI_DUNG, { ip: `10.9.${Math.floor(i / 200)}.${i % 200}` });
      expect(r.status).toBe(202);
    }
    expect(goiSdk).toHaveLength(BAO_LOI_AN_DANH.TRAN_TOAN_CUC_NGAY);
  });

  it('không DSN ⇒ kênh IM: 202, không gọi SDK, không ghi một dòng đếm trần nào', async () => {
    const appIm = taoApp(undefined);
    const r = await guiLoi(GOI_DUNG, { app: appIm });
    expect(r.status).toBe(202);
    expect(goiSdk).toHaveLength(0);
    const { rows } = await pool.query(`SELECT count(*)::int n FROM auth_attempts WHERE bucket LIKE 'loi_an_danh:%'`);
    expect(rows[0].n).toBe(0);
  });

  it('đường này không ghi DB nghiệp vụ: không thêm dòng telemetry, không thêm dòng events', async () => {
    const dem = async (): Promise<[number, number]> => {
      const t = await pool.query(`SELECT count(*)::int n FROM telemetry`);
      const e = await pool.query(`SELECT count(*)::int n FROM events`);
      return [t.rows[0].n, e.rows[0].n];
    };
    const truoc = await dem();
    const u = await createTestUser(pool);
    const sauTao = await dem();
    await guiLoi(GOI_DUNG, { cookie: u.cookie });
    expect(await dem()).toEqual(sauTao);
    expect(sauTao[0]).toBe(truoc[0]);
  });
});

const guiBao = (cookie: string, body: unknown): Promise<Response> => Promise.resolve(app.request('/api/v1/bao-loi', {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie, 'x-forwarded-for': '203.0.113.50' },
  body: JSON.stringify(body),
}));

describe('B. ô Báo lỗi — POST /api/v1/bao-loi', () => {
  const CHU = 'mật khẩu tôi là hunter2, bấm CHỐT VÒNG xong bàn đứng im';
  const EMAIL = 'nguoi.choi+tra.loi@vidu.test';

  it('cần đăng nhập: không cookie ⇒ 401, không ghi, không gọi SDK', async () => {
    const r = await guiBao('', { noi_dung: CHU });
    expect(r.status).toBe(401);
    expect(goiSdk).toHaveLength(0);
  });

  it('⭐ ghi BẢNG RIÊNG (không phải events) kèm email; chuông tới SDK chỉ có ban/man/ma_loi — không chữ, không mã tài khoản, không email', async () => {
    const u = await createTestUser(pool);
    const evTruoc = (await pool.query(`SELECT count(*)::int n FROM events WHERE user_id = $1`, [u.userId])).rows[0].n;
    const r = await guiBao(u.cookie, { noi_dung: CHU, man: '/arena', ban: '0.0.65', ma_loi: 'route:typeerror:1f3kq2', email: EMAIL });
    expect(r.status).toBe(201);
    const id = ((await r.json()) as { bao_loi_id: number }).bao_loi_id;
    const hang = (await pool.query(`SELECT * FROM bao_loi WHERE bao_loi_id = $1`, [id])).rows[0];
    expect(hang).toMatchObject({ user_id: u.userId, noi_dung: CHU, man: '/arena', ban: '0.0.65', ma_loi: 'route:typeerror:1f3kq2', email: EMAIL });
    expect((await pool.query(`SELECT count(*)::int n FROM events WHERE user_id = $1`, [u.userId])).rows[0].n).toBe(evTruoc);

    expect(goiSdk).toHaveLength(1);
    const [ten, ctx] = goiSdk[0]!.args as [string, { tags: Record<string, string>; fingerprint: string[] }];
    expect(goiSdk[0]!.ham).toBe('captureMessage');
    expect(ten).toBe('bao_loi_moi');
    expect(ctx.tags).toEqual({ ban: '0.0.65', man: '/arena', ma_loi: 'route:typeerror:1f3kq2' });
    const phang = JSON.stringify(goiSdk[0]!.args);
    for (const cam of [CHU, 'hunter2', 'CHỐT VÒNG', u.userId, u.handle, EMAIL, 'vidu.test']) {
      expect(phang.includes(cam), `gói tới Sentry chở "${cam}"`).toBe(false);
    }
  });

  it('email sai hình ⇒ bỏ trường (NULL), báo cáo vẫn lưu — không 4xx', async () => {
    const u = await createTestUser(pool);
    for (const email of ['khong-phai-email', 'a@b', 'x y@z.vn', `${'a'.repeat(260)}@vidu.test`]) {
      const r = await guiBao(u.cookie, { noi_dung: `thử ${email.slice(0, 10)}`, email });
      expect(r.status).toBe(201);
      const id = ((await r.json()) as { bao_loi_id: number }).bao_loi_id;
      expect((await pool.query(`SELECT email FROM bao_loi WHERE bao_loi_id = $1`, [id])).rows[0].email).toBeNull();
      await pool.query(`DELETE FROM bao_loi WHERE bao_loi_id = $1`, [id]); // giữ lượt cho vòng sau (trần 3/ngày)
    }
  });

  it('> 1.000 ký tự ⇒ 400, không ghi, không gọi SDK', async () => {
    const u = await createTestUser(pool);
    const r = await guiBao(u.cookie, { noi_dung: 'x'.repeat(BAO_LOI.DO_DAI_TOI_DA + 1) });
    expect(r.status).toBe(400);
    expect(goiSdk).toHaveLength(0);
    expect((await pool.query(`SELECT count(*)::int n FROM bao_loi WHERE user_id = $1`, [u.userId])).rows[0].n).toBe(0);
  });

  it(`⭐ ${BAO_LOI.TRAN_MOI_NGAY} lượt/ngày/tài khoản — lượt ${BAO_LOI.TRAN_MOI_NGAY + 1} ⇒ 429, không ghi, không gọi SDK`, async () => {
    expect(BAO_LOI.TRAN_MOI_NGAY).toBe(3); // founder 11/10; chữ T10 "gửi đủ 3 lượt" nói đúng số này
    const u = await createTestUser(pool);
    for (let i = 0; i < BAO_LOI.TRAN_MOI_NGAY; i += 1) expect((await guiBao(u.cookie, { noi_dung: `lượt ${i}` })).status).toBe(201);
    const truoc = goiSdk.length;
    expect((await guiBao(u.cookie, { noi_dung: 'lượt thừa' })).status).toBe(429);
    expect(goiSdk).toHaveLength(truoc);
    expect((await pool.query(`SELECT count(*)::int n FROM bao_loi WHERE user_id = $1`, [u.userId])).rows[0].n).toBe(BAO_LOI.TRAN_MOI_NGAY);
  });

  it('admin đọc được chữ + mã tài khoản + email; người thường ⇒ 403', async () => {
    const u = await createTestUser(pool);
    await guiBao(u.cookie, { noi_dung: 'cho admin đọc', email: EMAIL });
    const ad = await createTestUser(pool, { role: 'admin' });
    await moCuaAdmin(pool, ad);
    const doc = (cookie: string) => Promise.resolve(app.request('/api/v1/admin/bao-loi', { headers: { cookie } }));
    expect((await doc(u.cookie)).status).toBe(403);
    const r = await doc(ad.cookie);
    const ex = goiSdk.find((g) => g.ham === 'captureException');
    // ⚠ Bài này bắt được lỗi thật lúc gộp: `bao_loi_id` BIGINT ⇒ BigInt ⇒ trang admin 500.
    expect(r.status, `${await r.clone().text()} ${ex ? String((ex.args[0] as Error).message) : ''}`).toBe(200);
    const ds = ((await r.json()) as { bao_loi: Array<Record<string, unknown>> }).bao_loi;
    expect(ds.find((b) => b.noi_dung === 'cho admin đọc')).toMatchObject({ email: EMAIL, tai_khoan: u.userId });
  });
});
