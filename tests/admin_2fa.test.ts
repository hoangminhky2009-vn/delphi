/**
 * BƯỚC 2 — KHOÁ CỬA ADMIN (bản yêu cầu 01 §3; founder chốt A·B·A ngày 03/08).
 *
 * Đồ thật: Hono + PostgreSQL nhúng, TOTP thật, không mock.
 *
 * ⚠ BẤT BIẾN ĐẮT NHẤT NẰM Ở §II: **MỌI route admin từ chối một admin chưa qua
 * 2FA** — và danh sách route được LIỆT KÊ TỪ CHÍNH BẢNG ROUTE CỦA HONO, không
 * gõ tay. Gõ tay thì cái route thêm sau này sẽ không có trong danh sách, test
 * vẫn xanh, và lỗ hổng đi thẳng lên prod. Đây đúng là lớp lỗi mà bản yêu cầu
 * §3.4 suýt dính khi chỉ nói "/api/v1/admin/*" mà quên hai route trong
 * `avatar.ts`.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { AUTH } from '../config/auth.js';
import { buocCua, sinhMa } from '../server/auth/totp.js';
import { conTuoi, goBo2FA } from '../server/admin_bao_mat.js';

const PROXY = 'bi-mat-proxy-test';
// D444: /health giờ gọn thân trừ khi header này khớp — cần để các bài đọc
// khoá chi tiết (proxy_secret_cau_hinh, admin_allowlist…) ở dưới vẫn thấy được.
const TICK = 'bi-mat-tick-test';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let admin: TestUser;
let thuong: TestUser;

/** Mỗi test một IP riêng — rate limit admin là 60/phút/IP, đừng để test giẫm nhau. */
let demIp = 0;
const ipMoi = () => `198.51.100.${(demIp += 1) % 250}`;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool,
    mailer: new CapturingMailer(),
    appBaseUrl: 'https://dubao.test',
    secureCookie: false,
    proxySecret: PROXY,
    tickSecret: TICK,
  }) as Hono<any>;
  await ensureGenesis(pool);
  admin = await createTestUser(pool, { role: 'admin', bankroll: 0 });
  thuong = await createTestUser(pool);
}, 120_000);

afterAll(async () => {
  await db?.stop();
  delete process.env[AUTH.ADMIN.BIEN_ALLOWLIST];
});

const goi = async (
  path: string,
  opts: { cookie?: string; method?: string; body?: unknown; ip?: string } = {},
): Promise<Response> =>
  app.request(path, {
    method: opts.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      'x-delphi-client-ip': opts.ip ?? ipMoi(),
      'x-delphi-proxy-secret': PROXY,
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

const j = (r: Response): Promise<any> => r.json() as Promise<any>;

/** Email do fixture đặt: `<handle>@test.local`. */
const emailCua = (u: TestUser) => `${u.handle}@test.local`;

async function biMatCua(u: TestUser): Promise<string> {
  const { rows } = await pool.query(
    `SELECT totp_secret FROM auth_accounts WHERE email = $1`, [emailCua(u)],
  );
  return rows[0].totp_secret as string;
}

/**
 * Ghi danh trọn vẹn rồi mở quyền — trạng thái "admin đã sẵn sàng làm việc".
 *
 * ⚠ CỐ Ý dùng mã của bước TRƯỚC (`buocCua() - 1`, vẫn nằm trong cửa sổ ±1).
 * Chống-dùng-lại tiêu luôn bước đã dùng, nên nếu ghi danh bằng bước HIỆN TẠI
 * thì mọi test sau đó không còn mã hợp lệ nào để gọi tiếp — đời thật thì người
 * ta chờ 30 giây, test thì không chờ được. Đây là điều chỉnh của DỤNG CỤ ĐO,
 * không phải nới lỏng luật: luật vẫn là "một bước dùng đúng một lần".
 */
async function ghiDanhXong(u: TestUser): Promise<string> {
  await goi('/api/v1/admin/2fa/ghi-danh', { cookie: u.cookie, method: 'POST' });
  const biMat = await biMatCua(u);
  const xacNhan = () => goi('/api/v1/admin/2fa/xac-nhan', {
    cookie: u.cookie, method: 'POST', body: { ma: sinhMa(biMat, buocCua() - 1) },
  });
  let r = await xacNhan();
  /*
   * ⚠ THỬ LẠI MỘT LẦN KHI 401 — bẫy BIÊN 30 GIÂY của dụng cụ đo, không phải nới
   * luật. Mã được tính cho bước `buocCua() - 1`; nếu request vắt qua đúng ranh
   * giới bước (chạy nguyên bộ, máy tải nặng) thì tới lúc máy chủ kiểm, con số ấy
   * đã lùi thành HAI bước và rơi ra ngoài cửa sổ chấp nhận ⇒ 401.
   *
   * Ca thật: suite server 01/09 đỏ đúng một bài ở đây (`expected 401 to be 200`)
   * trong lượt chạy đầy, còn chạy riêng thì 37/37 xanh. Một đỏ-giả nằm lại trong
   * suite thì lần sau người ta bắt đầu bỏ qua màu đỏ — mà đó là thứ đắt nhất có
   * thể mất.
   *
   * Lần thử lại tính mã MỚI theo đồng hồ lúc đó, nên nó kiểm đúng thứ cũ: một
   * bước hợp lệ vẫn phải được chấp nhận. Nếu cả hai lần cùng 401 thì bài vẫn đỏ.
   */
  if (r.status === 401) r = await xacNhan();
  expect(r.status).toBe(200);
  return biMat;
}

/** Đẩy lùi dấu mốc để giả lập hết hạn — thời gian THẬT trong DB, không mock. */
const laoHoaMoc = (cot: 'admin_xac_thuc_luc' | 'xac_thuc_lai_luc', phut: number) =>
  pool.query(`UPDATE auth_sessions SET ${cot} = now() - ($1 || ' minutes')::interval`, [phut]);

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Ghi danh — và không được tự nhốt mình ra ngoài', () => {
  it('admin CHƯA ghi danh vẫn vào được cửa ghi danh (nếu không thì khoá vĩnh viễn)', async () => {
    const r = await goi('/api/v1/admin/2fa/trang-thai', { cookie: admin.cookie });
    expect(r.status).toBe(200);
    expect((await j(r)).da_ghi_danh).toBe(false);
  });

  it('ghi danh trả bí mật base32 + URI otpauth', async () => {
    const r = await goi('/api/v1/admin/2fa/ghi-danh', { cookie: admin.cookie, method: 'POST' });
    expect(r.status).toBe(200);
    const b = await j(r);
    expect(b.bi_mat).toMatch(/^[A-Z2-7]{32}$/);
    expect(b.uri).toContain('otpauth://totp/');
  });

  it('mã sai → 401, KHÔNG bật 2FA', async () => {
    const r = await goi('/api/v1/admin/2fa/xac-nhan', {
      cookie: admin.cookie, method: 'POST', body: { ma: '000000' },
    });
    expect(r.status).toBe(401);
    const t = await j(await goi('/api/v1/admin/2fa/trang-thai', { cookie: admin.cookie }));
    expect(t.da_ghi_danh).toBe(false);
  });

  it('mã đúng → bật 2FA và MỞ LUÔN quyền cho phiên này', async () => {
    const biMat = await biMatCua(admin);
    const r = await goi('/api/v1/admin/2fa/xac-nhan', {
      cookie: admin.cookie, method: 'POST', body: { ma: sinhMa(biMat, buocCua()) },
    });
    expect(r.status).toBe(200);
    const t = await j(await goi('/api/v1/admin/2fa/trang-thai', { cookie: admin.cookie }));
    expect(t).toMatchObject({ da_ghi_danh: true, quyen_con_han: true });
  });

  it('ghi danh LẠI khi đã bật → 409 (chặn cướp tài khoản bằng phiên đang mở)', async () => {
    const r = await goi('/api/v1/admin/2fa/ghi-danh', { cookie: admin.cookie, method: 'POST' });
    expect(r.status).toBe(409);
    expect((await j(r)).error).toBe('da_ghi_danh');
  });

  it('người thường: mọi cửa 2FA admin đều 403', async () => {
    const cua: Array<[string, string]> = [
      ['GET', '/api/v1/admin/2fa/trang-thai'],
      ['POST', '/api/v1/admin/2fa/ghi-danh'],
      ['POST', '/api/v1/admin/2fa/xac-nhan'],
      ['POST', '/api/v1/admin/2fa/mo-khoa'],
      ['POST', '/api/v1/admin/2fa/xac-thuc-lai'],
    ];
    for (const [method, p] of cua) {
      const r = await goi(p, {
        cookie: thuong.cookie, method, ...(method === 'POST' ? { body: { ma: '000000' } } : {}),
      });
      expect(r.status, p).toBe(403);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. MỌI route admin đều bị khoá khi chưa qua 2FA', () => {
  /**
   * Liệt kê từ bảng route THẬT của Hono. Không gõ tay danh sách — route thêm
   * sau này tự động lọt vào phép kiểm này.
   */
  const routeAdmin = (): Array<{ method: string; path: string }> =>
    (app as any).routes
      .filter((r: any) =>
        r.path.startsWith('/api/v1/admin/')
        && !r.path.startsWith('/api/v1/admin/2fa/')   // đây LÀ cửa ghi danh
        && r.method !== 'ALL',                         // bỏ middleware tiền tố
      )
      .map((r: any) => ({ method: r.method, path: r.path }));

  it('phát hiện được đủ route admin (kể cả hai route trong avatar.ts)', () => {
    const ds = routeAdmin();
    expect(ds.length).toBeGreaterThanOrEqual(10);
    // §3.4 chỉ nói "/api/v1/admin/*"; hai route này nằm ở avatar.ts và rất dễ
    // bị bỏ quên nếu ai đó đi gắn guard bằng tay.
    const paths = ds.map((r) => r.path);
    expect(paths).toContain('/api/v1/admin/avatar/tang');
    expect(paths).toContain('/api/v1/admin/avatar/an');
  });

  it('admin CHƯA ghi danh → mọi route trả 403 can_ghi_danh_2fa', async () => {
    const moi = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    for (const r of routeAdmin()) {
      const duong = r.path.replace(/:[a-zA-Z]+/g, '00000000-0000-4000-8000-000000000000');
      // GET không mang được body — gửi kèm là undici ném trước cả khi tới guard.
      const res = await goi(duong, {
        cookie: moi.cookie, method: r.method, ...(r.method === 'POST' ? { body: {} } : {}),
      });
      expect(res.status, `${r.method} ${r.path}`).toBe(403);
      expect((await j(res)).error, `${r.method} ${r.path}`).toBe('can_ghi_danh_2fa');
    }
  });

  it('admin ĐÃ ghi danh nhưng phiên chưa mở quyền → 403 can_mo_khoa_2fa', async () => {
    const moi = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    await ghiDanhXong(moi);
    await laoHoaMoc('admin_xac_thuc_luc', AUTH.ADMIN.TTL_PHUT + 5);
    for (const r of routeAdmin()) {
      const duong = r.path.replace(/:[a-zA-Z]+/g, '00000000-0000-4000-8000-000000000000');
      // GET không mang được body — gửi kèm là undici ném trước cả khi tới guard.
      const res = await goi(duong, {
        cookie: moi.cookie, method: r.method, ...(r.method === 'POST' ? { body: {} } : {}),
      });
      expect(res.status, `${r.method} ${r.path}`).toBe(403);
      expect((await j(res)).error, `${r.method} ${r.path}`).toBe('can_mo_khoa_2fa');
    }
  });

  it('người thường vẫn 403 forbidden (không lộ ra là có 2FA hay không)', async () => {
    const res = await goi('/api/v1/admin/dashboard', { cookie: thuong.cookie });
    expect(res.status).toBe(403);
    expect((await j(res)).error).toBe('forbidden');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Quyền admin có HẠN, mở lại bằng mã', () => {
  it('hết hạn → khoá; nhập mã mới → mở lại; phiên NGƯỜI CHƠI không hề mất', async () => {
    const u = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    const biMat = await ghiDanhXong(u);
    expect((await goi('/api/v1/admin/dashboard', { cookie: u.cookie })).status).toBe(200);

    await laoHoaMoc('admin_xac_thuc_luc', AUTH.ADMIN.TTL_PHUT + 1);
    expect((await goi('/api/v1/admin/dashboard', { cookie: u.cookie })).status).toBe(403);

    // ⚠ Đây là nửa còn lại của thiết kế: admin cũng là NGƯỜI CHƠI. Quyền admin
    // hết hạn KHÔNG được kéo theo phiên chơi — nếu không, mỗi giờ lại đăng xuất.
    expect((await goi('/api/v1/auth/me', { cookie: u.cookie })).status).toBe(200);

    const r = await goi('/api/v1/admin/2fa/mo-khoa', {
      cookie: u.cookie, method: 'POST', body: { ma: sinhMa(biMat, buocCua()) },
    });
    expect(r.status).toBe(200);
    expect((await goi('/api/v1/admin/dashboard', { cookie: u.cookie })).status).toBe(200);
  });

  it('conTuoi: biên đúng ở cả hai phía', () => {
    expect(conTuoi(null, 60)).toBe(false);
    expect(conTuoi(new Date(Date.now() - 59 * 60_000), 60)).toBe(true);
    expect(conTuoi(new Date(Date.now() - 61 * 60_000), 60)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. Chống dùng lại mã — nửa còn lại của lớp thứ hai', () => {
  it('CÙNG một mã không dùng được lần thứ hai', async () => {
    const u = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    const biMat = await ghiDanhXong(u);
    const ma = sinhMa(biMat, buocCua());

    const lan1 = await goi('/api/v1/admin/2fa/mo-khoa', {
      cookie: u.cookie, method: 'POST', body: { ma },
    });
    expect(lan1.status).toBe(200);

    /*
     * ⚠ Không có bước này thì một mã bị nhìn trộm dùng được cho CẢ đăng nhập
     * LẪN xác nhận thao tác phá huỷ trong cùng 30 giây — hai lần hỏi mà chỉ tốn
     * một lần trộm, tức lớp thứ hai thôi là lớp thứ hai.
     */
    const lan2 = await goi('/api/v1/admin/2fa/mo-khoa', {
      cookie: u.cookie, method: 'POST', body: { ma },
    });
    expect(lan2.status).toBe(401);
    expect((await j(lan2)).error).toBe('ma_sai');
  });

  it('mã CŨ HƠN mã đã dùng cũng bị từ chối (không lùi bước được)', async () => {
    const u = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    const biMat = await ghiDanhXong(u);
    const buoc = buocCua();
    await goi('/api/v1/admin/2fa/mo-khoa', {
      cookie: u.cookie, method: 'POST', body: { ma: sinhMa(biMat, buoc) },
    });
    const cu = await goi('/api/v1/admin/2fa/mo-khoa', {
      cookie: u.cookie, method: 'POST', body: { ma: sinhMa(biMat, buoc - 1) },
    });
    expect(cu.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V. Thao tác không hoàn tác được đòi xác thực LẠI', () => {
  const NANG: Array<[string, string]> = [
    ['POST', '/api/v1/admin/markets/00000000-0000-4000-8000-000000000000/resolve'],
    ['POST', '/api/v1/admin/markets/00000000-0000-4000-8000-000000000000/cancel'],
    ['POST', '/api/v1/admin/markets/00000000-0000-4000-8000-000000000000/open'],
    ['POST', '/api/v1/admin/avatar/tang'],
  ];

  it('mở quyền admin thôi CHƯA đủ — cả bốn cửa nặng đều 403 can_xac_thuc_lai', async () => {
    const u = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    await ghiDanhXong(u);
    for (const [method, path] of NANG) {
      const res = await goi(path, { cookie: u.cookie, method, body: {} });
      expect(res.status, path).toBe(403);
      expect((await j(res)).error, path).toBe('can_xac_thuc_lai');
    }
  });

  it('cửa NHẸ vẫn đi qua bình thường (khoá phiền quá mức là khoá sắp bị gỡ)', async () => {
    const u = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    await ghiDanhXong(u);
    expect((await goi('/api/v1/admin/dashboard', { cookie: u.cookie })).status).toBe(200);
    expect((await goi('/api/v1/admin/pending', { cookie: u.cookie })).status).toBe(200);
  });

  it('xác thực lại xong thì qua được, và HẾT HẠN thì khoá lại', async () => {
    const u = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    const biMat = await ghiDanhXong(u);
    const r = await goi('/api/v1/admin/2fa/xac-thuc-lai', {
      cookie: u.cookie, method: 'POST', body: { ma: sinhMa(biMat, buocCua()) },
    });
    expect(r.status).toBe(200);

    // Qua được cửa nặng: 404 (kèo không có thật) chứ KHÔNG còn 403.
    const q = await goi('/api/v1/admin/markets/00000000-0000-4000-8000-000000000000/cancel', {
      cookie: u.cookie, method: 'POST', body: { reason: 'thử' },
    });
    expect(q.status).toBe(404);

    await laoHoaMoc('xac_thuc_lai_luc', AUTH.ADMIN.XAC_THUC_LAI_PHUT + 1);
    const het = await goi('/api/v1/admin/markets/00000000-0000-4000-8000-000000000000/cancel', {
      cookie: u.cookie, method: 'POST', body: { reason: 'thử' },
    });
    expect(het.status).toBe(403);
    expect((await j(het)).error).toBe('can_xac_thuc_lai');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VI. Allowlist IP — và cửa sau đã đóng (siết 11/08)', () => {
  /*
   * ⚠ DỌN BẰNG `afterEach`, KHÔNG DỌN Ở CUỐI THÂN HÀM.
   * Bản cũ xoá biến ở dòng cuối mỗi bài; assertion đỏ trước đó là biến RÒ sang
   * ba khối test sau, và chúng đỏ theo với thông điệp chẳng liên quan gì. Một
   * bài đỏ nên tố cáo đúng một thứ.
   */
  afterEach(() => { delete process.env[AUTH.ADMIN.BIEN_ALLOWLIST]; });

  it('VẮNG biến → KHÔNG chặn ai (§3.3: khoá nhầm founder là hỏng nặng hơn)', async () => {
    delete process.env[AUTH.ADMIN.BIEN_ALLOWLIST];
    const r = await goi('/api/v1/admin/2fa/trang-thai', { cookie: admin.cookie, ip: '1.2.3.4' });
    expect(r.status).toBe(200);
  });

  it('CÓ biến → IP lạ bị chặn, IP trong danh sách đi qua', async () => {
    process.env[AUTH.ADMIN.BIEN_ALLOWLIST] = '203.0.113.7, 203.0.113.8';
    const la = await goi('/api/v1/admin/2fa/trang-thai', { cookie: admin.cookie, ip: '9.9.9.9' });
    expect(la.status).toBe(403);
    const quen = await goi('/api/v1/admin/2fa/trang-thai', { cookie: admin.cookie, ip: '203.0.113.8' });
    expect(quen.status).toBe(200);
  });

  it('⭐ CỬA SAU: gọi thẳng origin API, không qua proxy → 403 (trước 11/08 là 200)', async () => {
    /*
     * ĐÂY LÀ BÀI CANH CHÍNH LỖ HỔNG.
     *
     * Không có `x-delphi-proxy-secret` ⇒ máy chủ KHÔNG xác thực được IP. Bản cũ
     * cho đi tiếp (fail-open) với lý do "có thể PROXY_SHARED_SECRET đang lệch".
     * Nhưng kẻ gọi thẳng `api.example.vercel.app` cũng KHÔNG BAO GIỜ mang secret,
     * nên họ rơi vào đúng nhánh ấy và luôn được cho qua — tức allowlist chỉ chặn
     * người đi đúng cửa trước, còn cửa sau thì mở toang.
     */
    process.env[AUTH.ADMIN.BIEN_ALLOWLIST] = '203.0.113.7';
    const r = await app.request('/api/v1/admin/2fa/trang-thai', {
      headers: { cookie: admin.cookie, 'x-forwarded-for': '9.9.9.9' },
    });
    expect(r.status).toBe(403);
  });

  it('⭐ giả IP nằm TRONG allowlist mà không qua proxy → vẫn 403', async () => {
    /*
     * Vế thứ hai, và là vế làm lỗ hổng thành nghiêm trọng: `x-forwarded-for` là
     * header do NGƯỜI GỌI đặt. Nếu chỉ so IP mà không hỏi "IP này có đáng tin
     * không" thì allowlist tự khai luôn đáp án — ai đọc được danh sách là vào được.
     */
    process.env[AUTH.ADMIN.BIEN_ALLOWLIST] = '203.0.113.7';
    const r = await app.request('/api/v1/admin/2fa/trang-thai', {
      headers: { cookie: admin.cookie, 'x-forwarded-for': '203.0.113.7' },
    });
    expect(r.status).toBe(403);
  });

  it('⚠ API KHÔNG có PROXY_SHARED_SECRET → allowlist fail-OPEN (đóng là khoá tất cả)', async () => {
    /*
     * Nhánh này KHÔNG phải nhượng bộ, nó là hệ quả logic: thiếu secret thì
     * `tinDuoc` vĩnh viễn false, tức máy chủ không có cách nào phân biệt ai với
     * ai. Đóng cửa lúc đó không chặn đúng người — nó chặn 100%, kể cả founder đi
     * đúng cửa trước, và không request hợp lệ nào cứu được. Nên: đi tiếp, kêu to,
     * và `/health` khai `proxy_secret_cau_hinh` để thấy TRƯỚC khi bật allowlist.
     */
    // D444: tickSecret CÓ để đọc được khoá chi tiết dưới — không liên quan tới
    // proxySecret (cố ý vắng: đúng cái nhánh test này cần).
    const appKhongSecret = createApp({
      pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
      secureCookie: false, tickSecret: TICK,
    }) as Hono<any>;
    process.env[AUTH.ADMIN.BIEN_ALLOWLIST] = '203.0.113.7';
    const r = await appKhongSecret.request('/api/v1/admin/2fa/trang-thai', {
      headers: { cookie: admin.cookie, 'x-forwarded-for': '9.9.9.9' },
    });
    expect(r.status).not.toBe(403);

    const h = await j(await appKhongSecret.request('/api/v1/health', {
      headers: { 'x-tick-secret': TICK },
    }));
    expect(h.proxy_secret_cau_hinh, 'phải khai là THIẾU để thấy trước khi bật').toBe(false);
  });

  it('/health khai proxy_secret_cau_hinh khi API CÓ secret', async () => {
    const h = await j(await app.request('/api/v1/health', {
      headers: { 'x-tick-secret': TICK },
    }));
    expect(h.proxy_secret_cau_hinh).toBe(true);
  });

  it('/health vẫn nói ra trạng thái allowlist (bật nhưng không tin được IP)', async () => {
    // Giữ nguyên mục đích của bài cũ: "bật nhưng vô hiệu" phải LỘ RA, không im.
    process.env[AUTH.ADMIN.BIEN_ALLOWLIST] = '203.0.113.7';
    const h = await j(await app.request('/api/v1/health', {
      headers: { 'x-forwarded-for': '9.9.9.9', 'x-tick-secret': TICK },
    }));
    expect(h.admin_allowlist).toMatchObject({ bat: true, so_muc: 1, tin_duoc_ip: false });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VI-b. Header bảo mật PHẢI THẬT SỰ ĐƯỢC PHÁT RA', () => {
  /*
   * ⚠ Bộ header có thể khai đủ trong code mà không tới được response nào — đúng
   * lớp "cơ chế trang trí" repo đã dính 18+ lần. Nên bài này hỏi đúng một câu:
   * response THẬT có mang nó không.
   */
  it('response API mang nosniff + Referrer-Policy + HSTS + CSP mặc định', async () => {
    const r = await goi('/api/v1/health');
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('referrer-policy')).toBe('no-referrer');
    expect(r.headers.get('strict-transport-security')).toMatch(/max-age=\d+/);
    expect(r.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('HSTS không kèm preload/includeSubDomains (cam kết khó rút lại)', async () => {
    const h = (await goi('/api/v1/health')).headers.get('strict-transport-security') ?? '';
    expect(h.toLowerCase()).not.toContain('preload');
    expect(h.toLowerCase()).not.toContain('includesubdomains');
  });

  it('⭐ /admin mang CSP riêng — CẢ nhánh 403, vì nhánh đó cũng là HTML có style=', async () => {
    // Người thường ⇒ nhánh 403. Trước bản vá nó rơi vào CSP JSON `default-src
    // 'none'` và mất sạch style ⇒ chữ sáng trên nền trắng (lớp lỗi D74).
    const r = await goi('/admin', { cookie: thuong.cookie });
    expect(r.status).toBe(403);
    const csp = r.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("style-src 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('KHÔNG phát X-Frame-Options ở đâu cả (một cơ chế, một chỗ)', async () => {
    for (const p of ['/api/v1/health', '/admin']) {
      const r = await goi(p, { cookie: admin.cookie });
      expect(r.headers.get('x-frame-options'), `${p} có XFO`).toBeNull();
    }
  });

  it('D444 — response API VÀ /admin đều mang Permissions-Policy (camera/microphone/geolocation tắt hẳn)', async () => {
    for (const p of ['/api/v1/health', '/admin']) {
      const r = await goi(p, { cookie: admin.cookie });
      const pp = r.headers.get('permissions-policy') ?? '';
      expect(pp, `${p} thiếu Permissions-Policy`).not.toBe('');
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
      expect(pp).toContain('geolocation=()');
      // ⭐ Cùng luật với _headers: web-share/clipboard-write PHẢI CHỪA.
      expect(pp).not.toContain('web-share');
      expect(pp).not.toContain('clipboard-write');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VII. Rate limit cửa admin — trước 03/08 KHÔNG CÓ GÌ', () => {
  it('vượt trần trên một IP → 429', async () => {
    const ip = '198.51.100.254';
    await pool.query(
      `INSERT INTO auth_attempts (bucket) SELECT $1 FROM generate_series(1, $2)`,
      [`admin:ip:${ip}`, AUTH.ADMIN.MAX_MOI_PHUT],
    );
    const r = await goi('/api/v1/admin/2fa/trang-thai', { cookie: admin.cookie, ip });
    expect(r.status).toBe(429);
  });

  it('phủ CẢ trang HTML /admin, không riêng /api', async () => {
    const ip = '198.51.100.253';
    await pool.query(
      `INSERT INTO auth_attempts (bucket) SELECT $1 FROM generate_series(1, $2)`,
      [`admin:ip:${ip}`, AUTH.ADMIN.MAX_MOI_PHUT],
    );
    const r = await goi('/admin', { cookie: admin.cookie, ip });
    expect(r.status).toBe(429);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IX. Trang admin phải CÓ CỬA để bấm vào', () => {
  /*
   * ⚠ Bẫy §6.1 ở chiều ngược lại — và ở đây nó không chỉ là phiền toái mà là
   * KHOÁ CHÍNH MÌNH RA NGOÀI: endpoint ghi danh tồn tại nhưng trang admin
   * không có ô nào gọi nó ⇒ admin duy nhất không bao giờ bật được 2FA, mà
   * không bật thì mọi cửa khác đã đóng. Tiền lệ có thật: `/avatar/goc` được UI
   * gọi suốt nhiều tuần trong khi route chưa từng tồn tại (D47.7).
   */
  it('HTML admin có khối 2FA và gọi đủ ba đường', async () => {
    const html = await (await goi('/admin', { cookie: admin.cookie })).text();
    expect(html).toContain('MÃ HAI LỚP');
    for (const duong of ['xac-nhan', 'mo-khoa', 'xac-thuc-lai']) {
      expect(html, duong).toContain(duong);
    }
    // Tự tải lúc mở trang — bắt người bấm một nút để thấy mình đang bị khoá
    // thì họ sẽ không bấm.
    expect(html).toContain('loadTfa()');
  });

  it('HTML admin có khối UỶ QUYỀN và gọi đủ hai đường (D208)', async () => {
    /*
     * Cùng bẫy với bài 2FA ngay trên: route tồn tại mà trang không có ô nào gọi
     * nó thì tính năng coi như không có. Uỷ quyền là đường DUY NHẤT thêm người
     * mà không phải gõ SQL vào prod, nên mất ô này là quay lại chỗ cũ.
     */
    const html = await (await goi('/admin', { cookie: admin.cookie })).text();
    expect(html).toContain('NGƯỜI CÓ QUYỀN QUẢN TRỊ');
    for (const t of ['loadQuyen()', 'doiQuyen(true)', 'doiQuyen(false)',
      'q_handle', '/api/v1/admin/quyen']) {
      expect(html, t).toContain(t);
    }
  });

  it('đoạn <script> của trang admin PARSE ĐƯỢC (một dấu nháy lệch là trang chết)', async () => {
    const html = await (await goi('/admin', { cookie: admin.cookie })).text();
    const js = html.split('<script>')[1]!.split('</script>')[0]!;
    // Trang này là một chuỗi ký tự trong TS: lỗi cú pháp JS bên trong KHÔNG bị
    // tsc bắt, và nó chỉ lộ ra khi mở trang thật — tức lúc đang cần dùng.
    expect(() => new Function(js)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('VIII. Đường thoát mất thiết bị — và nó phải ĐỂ LẠI DẤU VẾT', () => {
  it('gỡ 2FA: xoá bí mật + thu hồi quyền mọi phiên + GHI admin_audit', async () => {
    const u = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    await ghiDanhXong(u);
    expect((await goi('/api/v1/admin/dashboard', { cookie: u.cookie })).status).toBe(200);

    const kq = await goBo2FA(pool, emailCua(u), 'mất điện thoại');
    expect(kq.trang_thai).toBe('da_go');

    // Bí mật đi, và phiên đang mở KHÔNG còn quyền — thiếu vế sau thì đúng lúc
    // cần khoá lại (thiết bị đã mất) nó vẫn mở hết TTL.
    const { rows } = await pool.query(
      `SELECT totp_secret, totp_confirmed_at FROM auth_accounts WHERE email = $1`, [emailCua(u)],
    );
    expect(rows[0]).toMatchObject({ totp_secret: null, totp_confirmed_at: null });

    const sau = await goi('/api/v1/admin/dashboard', { cookie: u.cookie });
    expect(sau.status).toBe(403);
    expect((await j(sau)).error).toBe('can_ghi_danh_2fa');

    // ⚠ ĐIỀU KIỆN BẮT BUỘC: một cú reset 2FA không bao giờ được im lặng.
    const { rows: a } = await pool.query(
      `SELECT payload_json FROM admin_audit
        WHERE action = 'admin_2fa_reset' AND admin_id = $1`, [u.userId],
    );
    expect(a).toHaveLength(1);
    expect(a[0].payload_json).toMatchObject({ ly_do: 'mất điện thoại', qua: 'script' });
  });

  it('ghi danh LẠI được sau khi gỡ (đường thoát phải dẫn tới đâu đó)', async () => {
    const u = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    await ghiDanhXong(u);
    await goBo2FA(pool, emailCua(u), 'thử');
    await ghiDanhXong(u);
    expect((await goi('/api/v1/admin/dashboard', { cookie: u.cookie })).status).toBe(200);
  });

  it('KHÔNG gỡ được cho tài khoản không phải admin (fail-closed)', async () => {
    const kq = await goBo2FA(pool, emailCua(thuong), 'thử');
    expect(kq.trang_thai).toBe('khong_phai_admin');
  });

  it('email lạ → không nổ, báo không có tài khoản', async () => {
    expect((await goBo2FA(pool, 'khong@co.that', 'x')).trang_thai).toBe('khong_co_tai_khoan');
  });
});
