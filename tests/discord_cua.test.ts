/**
 * CỬA DISCORD — ĐƯỜNG CHẠY THẬT (Hono + Postgres nhúng, không mock).
 *
 * ⚠ Ba bất biến ở đây là ba cách hỏng ÂM THẦM, không phải ba tính năng:
 *  1. vắng cấu hình ⇒ ĐÓNG, không mở toang;
 *  2. hai request song song của cùng một người ⇒ MỘT tài khoản, không phải hai
 *     (sai chỗ này thì `events` rẽ đôi VĨNH VIỄN — không sửa được kể cả sang mùa mới);
 *  3. phiên đi bằng `Bearer` phải được chấp nhận, vì cookie chết trong iframe.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { LoiDiscord, doiMaLayNguoi, timHoacTao } from '../server/discord.js';
import { createSession } from '../server/auth/session.js';

let db: TestDb;
let pool: pg.Pool;
/** App KHÔNG có cấu hình Discord — dùng để kiểm nhánh fail-closed. */
let appTat: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  await ensureGenesis(pool);
  appTat = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

describe('I. Fail-closed', () => {
  /*
   * ⚠ Quên đặt biến môi trường phải là "ĐÓNG", không phải "mở". Cùng kỷ luật với
   * CORS của D57 — ở đó `?? '*'` từng làm API mở toang kèm `credentials: true`.
   * Một cửa AUTH mở vì quên biến thì tệ hơn nhiều.
   */
  it('vắng client id/secret → 503, KHÔNG phải 200', async () => {
    const r = await appTat.request('/api/v1/auth/discord/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'ma-gia-de-thu-nghiem' }),
    });
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ error: 'discord_chua_cau_hinh' });
  });

  it('route CÓ TỒN TẠI (503 chứ không 404) — đã cắm vào app thật', async () => {
    const r = await appTat.request('/api/v1/auth/discord/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'x'.repeat(20) }),
    });
    expect(r.status).not.toBe(404);
  });
});

describe('I-b. Mã hỏng là lỗi CỦA NGƯỜI GỌI, không phải sự cố hệ thống', () => {
  /*
   * ⚠⚠ BÀI NÀY SINH RA TỪ MỘT LỖI ĐO ĐƯỢC TRÊN PROD, không phải từ suy luận.
   * Bản đầu trả 502 cho mã hết hạn / mã dùng lại — mà đó là chuyện THƯỜNG NGÀY
   * (tải lại trang, bấm hai lần). Cloudflare chặn MỌI 5xx của origin rồi thay
   * bằng trang HTML của chính nó ⇒ client nhận HTML thay vì JSON, `res.json()`
   * ném, và người chơi thấy một lỗi khác hẳn lỗi thật.
   */
  const gia = (status: number): typeof fetch =>
    (async () => new Response('{}', { status })) as unknown as typeof fetch;

  it('Discord trả 4xx → lỗi CỦA NGƯỜI GỌI', async () => {
    await expect(
      doiMaLayNguoi({ clientId: 'x', clientSecret: 'y' }, 'ma-het-han', gia(400)),
    ).rejects.toMatchObject({ cuaNguoiGoi: true });
  });

  it('Discord trả 5xx → lỗi HỆ THỐNG, không đổ cho người dùng', async () => {
    await expect(
      doiMaLayNguoi({ clientId: 'x', clientSecret: 'y' }, 'ma-tot', gia(503)),
    ).rejects.toMatchObject({ cuaNguoiGoi: false });
  });

  it('lỗi phân loại được bằng kiểu, không bằng cách đọc chuỗi thông điệp', () => {
    expect(new LoiDiscord('x', true)).toBeInstanceOf(Error);
  });
});

describe('II. Tìm-hoặc-tạo: một người = MỘT tài khoản, vĩnh viễn', () => {
  it('gọi lại lần hai trả về ĐÚNG tài khoản cũ, không tạo thêm', async () => {
    const nguoi = { id: 'dc-100', ten: 'Nguyễn Hoàng Minh' };
    const a = await timHoacTao(pool, nguoi, { seasonId: '2026Q3' });
    const b = await timHoacTao(pool, nguoi, { seasonId: '2026Q3' });
    expect(a.moi).toBe(true);
    expect(b.moi).toBe(false);
    expect(b.userId).toBe(a.userId);
    expect(b.accountId).toBe(a.accountId);
    expect(a.handle).toBe('nguyen_hoang_minh');
  });

  /*
   * ⚠⚠ BÀI QUAN TRỌNG NHẤT CỦA FILE. Bấm hai lần, mạng chập, hoặc client thử lại
   * — hai request cùng lúc mà cả hai cùng "không thấy thì tạo" là HAI HÀNG `users`
   * cho một người. `events` append-only (A3.3) nên không gộp lại được, kể cả khi
   * phát hiện ngay hôm sau, kể cả sang mùa mới.
   *
   * Chỗ chặn là `ON CONFLICT`, KHÔNG phải câu SELECT mở đầu — bài này chạy song
   * song thật để chứng minh điều đó, chứ không gọi tuần tự rồi tự trấn an.
   */
  it('MƯỜI request SONG SONG cùng một người → đúng một hàng users', async () => {
    const nguoi = { id: 'dc-đua-200', ten: 'Trần Đức Anh' };
    const kq = await Promise.all(
      Array.from({ length: 10 }, () => timHoacTao(pool, nguoi, { seasonId: '2026Q3' })),
    );
    const userIds = new Set(kq.map((k) => k.userId));
    expect(userIds.size, 'nhiều hơn 1 = bộ dữ liệu đã rẽ đôi').toBe(1);
    expect(kq.filter((k) => k.moi)).toHaveLength(1);

    const { rows } = await pool.query(
      `SELECT count(*)::int n FROM auth_identities
        WHERE provider = 'discord' AND provider_user_id = $1`, [nguoi.id]);
    expect(rows[0].n).toBe(1);
  });

  it('người mới KHÔNG có nhân khẩu và KHÔNG có vốn — bậc 0 đúng nghĩa', async () => {
    const kq = await timHoacTao(pool, { id: 'dc-300', ten: 'Lê Thị Mai' }, { seasonId: '2026Q3' });
    const { rows } = await pool.query(
      `SELECT age_band, region, occupation_band, bankroll FROM users WHERE user_id = $1`,
      [kq.userId]);
    expect(rows[0].age_band).toBeNull();
    expect(rows[0].region).toBeNull();
    expect(rows[0].occupation_band).toBeNull();
    // Đấu trường không đụng ví, nên không cấp vốn khởi điểm cho bậc 0.
    expect(Number(rows[0].bankroll)).toBe(0);
  });

  it('tên Discord không dùng được → tên trung tính, KHÔNG chặn người ta vào', async () => {
    const kq = await timHoacTao(pool, { id: 'dc-400', ten: '🎮🎮' }, { seasonId: '2026Q3' });
    expect(kq.handle).toMatch(/^nguoi_choi_[a-z0-9]{6}$/);
  });
});

describe('III. Phiên đi bằng Bearer (cookie chết trong iframe)', () => {
  /*
   * ⚠ Không có bài này thì cửa Discord cấp token xong mà KHÔNG AI ĐỌC ĐƯỢC —
   * và triệu chứng là "đăng nhập thành công nhưng mọi thứ 401", đúng lớp lỗi khó
   * tra nhất vì màn hình trông như đã vào được.
   */
  it('Authorization: Bearer được chấp nhận y như cookie', async () => {
    const kq = await timHoacTao(pool, { id: 'dc-500', ten: 'Bảo Ngọc' }, { seasonId: '2026Q3' });
    const token = await createSession(pool, kq.accountId);

    const r = await appTat.request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(r.status, 'Bearer bị từ chối = cửa Discord cấp token mà không ai đọc được').toBe(200);
    const b: any = await r.json();
    expect(b.user?.handle).toBe('bao_ngoc');
  });

  it('Bearer rác → 401, không nhận bừa', async () => {
    const r = await appTat.request('/api/v1/auth/me', {
      headers: { authorization: 'Bearer khong-phai-token-that' },
    });
    expect(r.status).toBe(401);
  });

  it('header sai hình dạng không làm sập gì cả', async () => {
    for (const h of ['Bearer', 'Bearer ', 'Basic abc', '']) {
      const r = await appTat.request('/api/v1/auth/me', { headers: { authorization: h } });
      // Hình dạng lạ phải rơi về "chưa đăng nhập", KHÔNG được nổ 500.
      expect(r.status, `hỏng ở header: ${JSON.stringify(h)}`).toBe(401);
    }
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * IV. NÂNG CẤP TÀI KHOẢN KHÁCH — cửa MỘT CHIỀU nặng nhất của cửa Discord
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Trong Activity, người chơi vào KHÁCH ngay từ giây đầu (founder 04/08: "làm cơ
 * chế đăng nhập thuận tiện"). Nếu về sau bắt tay Discord chạy được mà ta tạo tài
 * khoản MỚI, thì lịch sử đã chơi nằm dưới `user_id` cũ — và `events` append-only
 * (A3.3) nên **không gộp lại được, kể cả sang mùa mới**. Cùng một người sẽ vĩnh
 * viễn là hai người trong bảng sản phẩm (A1).
 */
describe('IV. Khách nâng cấp thành tài khoản Discord', () => {
  /** Tạo một tài khoản KHÁCH thật qua đúng endpoint người chơi đi. */
  async function taoKhach(ip: string): Promise<{ accountId: string; userId: string }> {
    const r = await appTat.request('/api/v1/auth/khach', {
      method: 'POST', headers: { 'x-forwarded-for': ip },
    });
    const b: any = await r.json();
    const { rows } = await pool.query(
      `SELECT a.account_id, u.user_id FROM users u
         JOIN auth_accounts a ON a.user_id = u.user_id WHERE u.handle = $1`, [b.handle]);
    return { accountId: rows[0].account_id, userId: rows[0].user_id };
  }

  it('⭐ gắn danh tính vào CHÍNH tài khoản khách — không đẻ tài khoản thứ hai', async () => {
    const k = await taoKhach('198.51.100.31');
    const truoc = (await pool.query(`SELECT count(*)::int n FROM users`)).rows[0].n;

    const kq = await timHoacTao(
      pool, { id: 'dc-nangcap-1', ten: 'Khách Lên Đời' },
      { seasonId: '2026Q3', accountHienTai: k.accountId },
    );

    expect(kq.userId, 'user_id đổi = lịch sử chơi đứt vĩnh viễn').toBe(k.userId);
    expect(kq.accountId).toBe(k.accountId);
    expect(kq.nangCap).toBe(true);
    expect(kq.moi).toBe(false);
    const sau = (await pool.query(`SELECT count(*)::int n FROM users`)).rows[0].n;
    expect(sau, 'có hàng users mới = đã rẽ đôi danh tính').toBe(truoc);
  });

  it('…và BỎ cờ khách trong cùng transaction (đường mà 0030 đã khai)', async () => {
    const k = await taoKhach('198.51.100.32');
    await timHoacTao(pool, { id: 'dc-nangcap-2', ten: 'Hai' },
      { seasonId: '2026Q3', accountHienTai: k.accountId });
    const { rows } = await pool.query(`SELECT la_khach FROM users WHERE user_id = $1`, [k.userId]);
    expect(rows[0].la_khach).toBe(false);
  });

  /*
   * ⚠ Danh tính Discord đã có tài khoản riêng thì tài khoản ĐÓ thắng. KHÔNG gộp
   * hai lịch sử — gộp là bịa ra một quá khứ chưa từng xảy ra trong một bảng
   * append-only. Người chơi mất phần đã chơi ở phiên khách, và đó là giá đúng:
   * chỉ một trong hai là "họ".
   */
  it('danh tính đã có chủ → dùng tài khoản CŨ, kệ phiên khách đang gọi', async () => {
    const nguoi = { id: 'dc-nangcap-3', ten: 'Ba' };
    const goc = await timHoacTao(pool, nguoi, { seasonId: '2026Q3' });
    const k = await taoKhach('198.51.100.33');

    const kq = await timHoacTao(pool, nguoi, { seasonId: '2026Q3', accountHienTai: k.accountId });
    expect(kq.userId).toBe(goc.userId);
    expect(kq.nangCap).toBe(false);
    // Tài khoản khách phải còn nguyên là khách — không bị đụng vào.
    const { rows } = await pool.query(`SELECT la_khach FROM users WHERE user_id = $1`, [k.userId]);
    expect(rows[0].la_khach).toBe(true);
  });

  /*
   * ⚠ KHÔNG TIN CLIENT. `accountKhach` đến từ phiên, nhưng phiên có thể là của
   * một tài khoản đã CÓ danh tính Discord rồi. Gắn đè lên đó là để một tài khoản
   * mang hai danh tính, và tệ hơn: là chiếm tài khoản người khác bằng một cú đổi mã.
   */
  it('tài khoản ĐÃ có danh tính → không gắn đè, tạo tài khoản mới như thường', async () => {
    const that = await timHoacTao(pool, { id: 'dc-nangcap-4a', ten: 'Bốn' }, { seasonId: '2026Q3' });
    const kq = await timHoacTao(
      pool, { id: 'dc-nangcap-4b', ten: 'Năm' },
      { seasonId: '2026Q3', accountHienTai: that.accountId },
    );
    expect(kq.accountId, 'gắn đè lên tài khoản đã liên kết = chiếm tài khoản').not.toBe(that.accountId);
    expect(kq.moi).toBe(true);
    expect(kq.lienKet).toBe(false);
  });

  it('accountHienTai rác → bỏ qua, không nổ', async () => {
    const kq = await timHoacTao(
      pool, { id: 'dc-nangcap-5', ten: 'Sáu' },
      { seasonId: '2026Q3', accountHienTai: '00000000-0000-0000-0000-000000000000' },
    );
    expect(kq.moi).toBe(true);
    expect(kq.nangCap).toBe(false);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * V. LIÊN KẾT TÀI KHOẢN WEB ↔ DISCORD (founder 04/08)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * *"ít nhất phải cho t đăng ký bằng discord chứ"* — và trước bản này, người ĐÃ CÓ
 * tài khoản email mở Activity thì Discord đẻ cho họ một tài khoản THỨ HAI, vì
 * nhánh gắn chỉ nhận tài khoản `la_khach`. Điều kiện đúng không phải "phải là
 * khách" mà là "CHƯA gắn danh tính nào".
 */
describe('V. Liên kết tài khoản email với Discord', () => {
  /** Tài khoản email thật (đã onboard), CHƯA có danh tính ngoài nào. */
  async function taoTaiKhoanEmail(): Promise<{ accountId: string; userId: string; handle: string }> {
    const u = await createTestUser(pool);
    const { rows } = await pool.query(
      `SELECT account_id FROM auth_accounts WHERE user_id = $1`, [u.userId]);
    return { accountId: rows[0].account_id, userId: u.userId, handle: u.handle };
  }

  it('⭐ gắn Discord vào CHÍNH tài khoản email — không đẻ tài khoản thứ hai', async () => {
    const tk = await taoTaiKhoanEmail();
    const truoc = (await pool.query(`SELECT count(*)::int n FROM users`)).rows[0].n;

    const kq = await timHoacTao(
      pool, { id: 'dc-lienket-1', ten: 'Có Email' },
      { seasonId: '2026Q3', accountHienTai: tk.accountId },
    );

    expect(kq.userId).toBe(tk.userId);
    expect(kq.lienKet).toBe(true);
    // ⚠ KHÔNG phải "nâng cấp": tài khoản này vốn đã là tài khoản thật.
    expect(kq.nangCap).toBe(false);
    expect((await pool.query(`SELECT count(*)::int n FROM users`)).rows[0].n).toBe(truoc);
  });

  it('…và giữ nguyên handle + email đang có, không đổi theo tên Discord', async () => {
    const tk = await taoTaiKhoanEmail();
    await timHoacTao(
      pool, { id: 'dc-lienket-2', ten: 'Tên Discord Khác Hẳn' },
      { seasonId: '2026Q3', accountHienTai: tk.accountId },
    );
    const { rows } = await pool.query(
      `SELECT u.handle, a.email IS NOT NULL AS co_email FROM users u
         JOIN auth_accounts a ON a.user_id = u.user_id WHERE u.user_id = $1`, [tk.userId]);
    expect(rows[0].handle, 'liên kết mà đổi tên người ta = mất danh tính đã chọn')
      .toBe(tk.handle);
    expect(rows[0].co_email, 'liên kết Discord không được xoá đường email').toBe(true);
  });

  it('lần mở sau: cùng Discord đó → vào ĐÚNG tài khoản email, không tạo mới', async () => {
    const tk = await taoTaiKhoanEmail();
    await timHoacTao(pool, { id: 'dc-lienket-3', ten: 'X' },
      { seasonId: '2026Q3', accountHienTai: tk.accountId });
    // Lần sau không còn phiên nào (iframe mới) — chỉ có mã Discord.
    const lai = await timHoacTao(pool, { id: 'dc-lienket-3', ten: 'X' }, { seasonId: '2026Q3' });
    expect(lai.userId).toBe(tk.userId);
    expect(lai.moi).toBe(false);
    expect(lai.lienKet).toBe(false);
  });
});
