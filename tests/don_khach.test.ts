/**
 * D444 (28/09) — DỌN KHÁCH BỎ HOANG (`server/auth/don_khach.ts`).
 *
 * ⚠ ĐƯỜNG CHÍNH: khách được tạo qua HTTP THẬT (`POST /api/v1/auth/khach`) —
 * đúng cửa `hình dạng dữ liệu thật` sinh ra (2 `avatar_so_huu`, 1
 * `auth_accounts` email/password NULL, 1 `auth_sessions`). Sau đó lùi
 * `created_at`/giết phiên bằng SQL để dựng "đã lâu, phiên chết" mà không phải
 * chờ thật `AUTH.SESSION_TTL_DAYS` (30 ngày).
 *
 * Mỗi bài MỘT lý do giữ/loại — không bài nào kiểm hai điều kiện cùng lúc, để
 * tiêm lỗi ngược (F1..F11, xem báo cáo cuối phiên) trúng ĐÚNG một bài.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { donKhachBoHoang } from '../server/auth/don_khach.js';
import { AUTH } from '../config/auth.js';
import { congNgay, ngayVN } from '../server/admin_phan_tich.js';
import { currentSeasonId } from '../server/season.js';

const TICK_SECRET = 'dk-tick-secret';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let mailer: CapturingMailer;
let admin: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  mailer = new CapturingMailer();
  app = createApp({
    pool, mailer, appBaseUrl: 'https://dubao.test', secureCookie: false, tickSecret: TICK_SECRET,
  }) as Hono<any>;
  await ensureGenesis(pool);
  admin = await createTestUser(pool, { role: 'admin' });
  await moCuaAdmin(pool, admin);
}, 120_000);

afterAll(async () => { await db?.stop(); });

let demIp = 0;
/** Một IP mới mỗi lần — hạn mức `khach`/IP (AUTH.REGISTER_MAX_PER_IP = 5/giờ) không nhiễu test khác. */
function ipMoi(): string {
  demIp += 1;
  return `10.66.${Math.floor(demIp / 250)}.${demIp % 250}`;
}

/** Tạo một khách THẬT qua HTTP (đúng cửa /auth/khach) — trả user_id + handle. */
async function taoKhach(): Promise<{ userId: string; handle: string }> {
  const r = await app.request('/api/v1/auth/khach', {
    method: 'POST', headers: { 'x-forwarded-for': ipMoi() },
  });
  const b: any = await r.json();
  expect(r.status, `tạo khách thất bại: ${JSON.stringify(b)}`).toBe(200);
  const { rows } = await pool.query(`SELECT user_id FROM users WHERE handle = $1`, [b.handle]);
  return { userId: rows[0].user_id as string, handle: b.handle as string };
}

/** Lùi users.created_at + auth_accounts.created_at — KHÔNG đụng auth_sessions.expires_at (xem gietPhien). */
async function luiNgay(userId: string, soNgay: number): Promise<Date> {
  const { rows } = await pool.query(
    `UPDATE users SET created_at = now() - ($2 || ' days')::interval WHERE user_id = $1 RETURNING created_at`,
    [userId, soNgay],
  );
  await pool.query(
    `UPDATE auth_accounts SET created_at = now() - ($2 || ' days')::interval WHERE user_id = $1`,
    [userId, soNgay],
  );
  return rows[0].created_at as Date;
}

/**
 * Làm PHIÊN chết (hết hạn) — created_at lùi KHÔNG tự kéo theo expires_at, phải
 * giết riêng. ⚠ auth_sessions có CHECK (expires_at > created_at) — set thẳng
 * expires_at = now() - 1 ngày trong khi created_at còn nguyên "vừa tạo" thì VỠ
 * CHECK đó (expires_at < created_at). Lùi CẢ HAI, giữ đúng thứ tự tương đối.
 */
async function gietPhien(userId: string): Promise<void> {
  await pool.query(
    `UPDATE auth_sessions
        SET created_at = now() - interval '2 days',
            expires_at = now() - interval '1 day'
      WHERE account_id = (SELECT account_id FROM auth_accounts WHERE user_id = $1)`,
    [userId],
  );
}

async function conKhong(userId: string): Promise<boolean> {
  const { rows } = await pool.query(`SELECT 1 FROM users WHERE user_id = $1`, [userId]);
  return rows.length > 0;
}

const goi = (path: string) => app.request(path, { headers: { cookie: admin.cookie } });
const j = (r: Response): Promise<any> => r.json() as Promise<any>;

describe('I. Điều kiện dọn — mỗi bài một lý do giữ/loại', () => {
  it('1. khách cũ chưa chơi, phiên đã chết ⇒ mất users + auth_accounts + avatar_so_huu; sổ đếm đúng ngày VN; trả {da_don:1,bo_qua:0}', async () => {
    const k = await taoKhach();
    const taoLuc = await luiNgay(k.userId, AUTH.SESSION_TTL_DAYS + 1);
    await gietPhien(k.userId);
    const { rows: av0 } = await pool.query(
      `SELECT count(*)::int AS n FROM avatar_so_huu WHERE user_id = $1`, [k.userId]);
    // capBoKhoiDau tặng một lá cho MỖI phần tử NEN_TANG — hiện BA lá (config/avatar.ts:96
    // tự nhận "TỰ ĐỘNG thành ba lá", dù chú thích cũ ngay cạnh NEN_TANG vẫn ghi "hai" —
    // trôi có sẵn trong repo, không phải lỗi của bản vá này). Đo thay vì đoán theo comment cũ.
    expect(av0[0].n).toBe(3);

    const kq = await donKhachBoHoang(pool, 50);
    expect(kq).toEqual({ da_don: 1, bo_qua: 0 });

    expect(await conKhong(k.userId)).toBe(false);
    const { rows: acc } = await pool.query(`SELECT 1 FROM auth_accounts WHERE user_id = $1`, [k.userId]);
    expect(acc).toHaveLength(0);
    const { rows: av1 } = await pool.query(
      `SELECT count(*)::int AS n FROM avatar_so_huu WHERE user_id = $1`, [k.userId]);
    expect(av1[0].n).toBe(0);

    const ngay = ngayVN(taoLuc.getTime());
    const { rows: so } = await pool.query(`SELECT so FROM khach_da_don_ngay WHERE ngay = $1`, [ngay]);
    expect(so[0]?.so).toBe(1);
  });

  it('2. khách có 1 dòng events ⇒ còn, bo_qua 0 (bị LỌC, không phải bị khoá ngoại chặn)', async () => {
    const k = await taoKhach();
    await luiNgay(k.userId, AUTH.SESSION_TTL_DAYS + 1);
    await gietPhien(k.userId);
    await pool.query(
      `INSERT INTO events (user_id, context_type, action_type) VALUES ($1, 'holdem', 'checkin')`,
      [k.userId],
    );

    const kq = await donKhachBoHoang(pool, 50);
    expect(kq).toEqual({ da_don: 0, bo_qua: 0 });
    expect(await conKhong(k.userId)).toBe(true);
  });

  it('3. khách có 1 dòng telemetry ⇒ còn, bo_qua 0', async () => {
    const k = await taoKhach();
    await luiNgay(k.userId, AUTH.SESSION_TTL_DAYS + 1);
    await gietPhien(k.userId);
    await pool.query(`INSERT INTO telemetry (user_id, ts, loai) VALUES ($1, now(), 'phien_mo')`, [k.userId]);

    const kq = await donKhachBoHoang(pool, 50);
    expect(kq).toEqual({ da_don: 0, bo_qua: 0 });
    expect(await conKhong(k.userId)).toBe(true);
  });

  it('4. khách cũ mà phiên CÒN SỐNG ⇒ còn', async () => {
    const k = await taoKhach();
    await luiNgay(k.userId, AUTH.SESSION_TTL_DAYS + 1);
    // KHÔNG gietPhien — phiên tạo lúc taoKhach() còn nguyên hạn (SESSION_TTL_DAYS kể từ NGAY LÚC TẠO thật).

    const kq = await donKhachBoHoang(pool, 50);
    expect(kq.da_don).toBe(0);
    expect(await conKhong(k.userId)).toBe(true);
  });

  it('5. khách mới 1 ngày, phiên đã thu hồi ⇒ còn (chặn theo tuổi)', async () => {
    const k = await taoKhach();
    await luiNgay(k.userId, 1); // mới — KHÔNG đủ SESSION_TTL_DAYS
    await gietPhien(k.userId);

    const kq = await donKhachBoHoang(pool, 50);
    expect(kq.da_don).toBe(0);
    expect(await conKhong(k.userId)).toBe(true);
  });

  it('6. tài khoản đăng ký thật (email + mật khẩu), cũ, không events ⇒ còn', async () => {
    /*
     * ⚠ CỐ Ý KHÔNG dùng createTestUser: nó cấp `wallet_ledger` (signup_grant)
     * kèm theo — MỘT LỚP BẢO VỆ THỨ HAI ngoài ý định của bài này (wallet_ledger
     * cũng REFERENCES users, không cascade, nên tự chặn DELETE FROM users bằng
     * khoá ngoại y hệt cơ chế bo_qua của bài 9 — GIẤU MẤT liệu la_khach=false +
     * email/password NOT NULL có thật sự là thứ đang chặn hay không). Dựng tay
     * để cô lập ĐÚNG một lý do: một tài khoản KHÔNG phải khách.
     */
    const { rows } = await pool.query(
      `INSERT INTO users (handle, season_id, la_khach, research_consent)
       VALUES ('dk_tai_khoan_that', $1, false, false) RETURNING user_id`,
      [currentSeasonId()],
    );
    const userId = rows[0].user_id as string;
    await pool.query(
      `INSERT INTO auth_accounts (email, password_hash, email_verified_at, user_id)
       VALUES ('dk-that@test.local', 'x', now(), $1)`,
      [userId],
    );
    await luiNgay(userId, AUTH.SESSION_TTL_DAYS + 1);
    // Không có auth_sessions nào được tạo (không đăng nhập) — NOT EXISTS phiên
    // sống đã đúng tự nhiên, không cần gietPhien.

    const kq = await donKhachBoHoang(pool, 50);
    expect(kq.da_don).toBe(0);
    expect(await conKhong(userId)).toBe(true);
  });

  it('7. khách (la_khach=true) có dòng auth_identities ⇒ còn', async () => {
    const k = await taoKhach();
    await luiNgay(k.userId, AUTH.SESSION_TTL_DAYS + 1);
    await gietPhien(k.userId);
    const { rows: acc } = await pool.query(
      `SELECT account_id FROM auth_accounts WHERE user_id = $1`, [k.userId]);
    await pool.query(
      `INSERT INTO auth_identities (account_id, provider, provider_user_id) VALUES ($1, 'discord', $2)`,
      [acc[0].account_id, `dk-test-${k.userId}`],
    );

    const kq = await donKhachBoHoang(pool, 50);
    expect(kq.da_don).toBe(0);
    expect(await conKhong(k.userId)).toBe(true);
  });

  it('8. khách đã bật research_consent, không events/telemetry ⇒ còn', async () => {
    const k = await taoKhach();
    await luiNgay(k.userId, AUTH.SESSION_TTL_DAYS + 1);
    await gietPhien(k.userId);
    await pool.query(`UPDATE users SET research_consent = true WHERE user_id = $1`, [k.userId]);

    const kq = await donKhachBoHoang(pool, 50);
    expect(kq.da_don).toBe(0);
    expect(await conKhong(k.userId)).toBe(true);
  });

  it('9. khách bị một khoá ngoại KHÁC giữ (holdem_ban) + một khách dọn được ⇒ cái đầu bo_qua 1, cái sau bị dọn, hàm không ném', async () => {
    const ket = await taoKhach();
    await luiNgay(ket.userId, AUTH.SESSION_TTL_DAYS + 1);
    await gietPhien(ket.userId);
    // holdem_ban.chu_user_id REFERENCES users, KHÔNG cascade ⇒ chặn DELETE FROM users.
    await pool.query(
      `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, loai, het_han)
       VALUES ('kh009', 1, 12, $1, 'doi', now() + interval '7 days')`,
      [ket.userId],
    );
    const donDuoc = await taoKhach();
    await luiNgay(donDuoc.userId, AUTH.SESSION_TTL_DAYS + 1);
    await gietPhien(donDuoc.userId);

    await expect(donKhachBoHoang(pool, 50)).resolves.toEqual({ da_don: 1, bo_qua: 1 });
    expect(await conKhong(ket.userId)).toBe(true);
    expect(await conKhong(donDuoc.userId)).toBe(false);

    /*
     * Dọn sạch tiền đề cho các bài SAU: gỡ khoá chặn rồi xoá tay — một ứng
     * viên "kẹt vĩnh viễn" còn sót lại sẽ bị câu SELECT ứng viên của bài 10
     * chọn lại (ORDER BY random()), làm lệch đếm da_don/bo_qua của bài đó.
     */
    await pool.query(`DELETE FROM holdem_ban WHERE chu_user_id = $1`, [ket.userId]);
    await pool.query(`UPDATE users SET avatar_dang_mac = NULL WHERE user_id = $1`, [ket.userId]);
    await pool.query(`DELETE FROM avatar_so_huu WHERE user_id = $1`, [ket.userId]);
    await pool.query(`DELETE FROM auth_accounts WHERE user_id = $1`, [ket.userId]);
    await pool.query(`DELETE FROM users WHERE user_id = $1`, [ket.userId]);
  });

  it('10. ba khách dọn được, toiDa=2 ⇒ da_don 2; gọi lại ⇒ 1', async () => {
    const ba = [await taoKhach(), await taoKhach(), await taoKhach()];
    for (const k of ba) {
      await luiNgay(k.userId, AUTH.SESSION_TTL_DAYS + 1);
      await gietPhien(k.userId);
    }

    const kq1 = await donKhachBoHoang(pool, 2);
    expect(kq1).toEqual({ da_don: 2, bo_qua: 0 });
    const kq2 = await donKhachBoHoang(pool, 2);
    expect(kq2).toEqual({ da_don: 1, bo_qua: 0 });

    for (const k of ba) expect(await conKhong(k.userId)).toBe(false);
  });

  it('11. GIỮ SỐ — tổng quan + chuỗi ngày + phễu phân tích + phễu sản phẩm không đổi trước/sau khi dọn', async () => {
    const k = await taoKhach();
    const taoLuc = await luiNgay(k.userId, AUTH.SESSION_TTL_DAYS + 1);
    await gietPhien(k.userId);

    const ngay = ngayVN(taoLuc.getTime());
    const tu = congNgay(ngay, -3);
    const den = congNgay(ngay, 3);
    const truoc = await j(await goi(`/api/v1/admin/pt/tong-quan?tu=${tu}&den=${den}`));
    const spTruoc = await j(await goi(`/api/v1/admin/tk/hanh-trinh?tu=${tu}&den=${den}`));

    const kq = await donKhachBoHoang(pool, 50);
    expect(kq.da_don).toBeGreaterThanOrEqual(1);
    expect(await conKhong(k.userId)).toBe(false);

    const sau = await j(await goi(`/api/v1/admin/pt/tong-quan?tu=${tu}&den=${den}`));
    const spSau = await j(await goi(`/api/v1/admin/tk/hanh-trinh?tu=${tu}&den=${den}`));

    // (a) ô tổng quan
    expect(sau.nay.tai_khoan_moi).toBe(truoc.nay.tai_khoan_moi);
    expect(sau.nay.tai_khoan_moi_khach).toBe(truoc.nay.tai_khoan_moi_khach);

    // (b) chuỗi theo ngày (chuoiNgay) — đúng phần tử của ngày khách này được TẠO
    const ngayThu = (arr: any[]) => arr.find((x) => x.ngay === ngay);
    const bTruoc = ngayThu(truoc.chuoi);
    const bSau = ngayThu(sau.chuoi);
    expect(bTruoc).toBeDefined();
    expect(bSau?.tai_khoan_moi).toBe(bTruoc?.tai_khoan_moi);

    // (c) phễu "người mới" của trang phân tích (pheuNguoiMoi)
    expect(sau.pheu.tao_tai_khoan).toBe(truoc.pheu.tao_tai_khoan);
    expect(sau.pheu.lap_ho_so).toBe(truoc.pheu.lap_ho_so);

    // (d) phễu đăng ký của trang sản phẩm — so theo NHÃN bước, không theo chỉ số mảng
    const bacSP = (arr: any[], buoc: string) => arr.find((x) => x.buoc === buoc).so_nguoi;
    expect(bacSP(spSau.phieu_dang_ky, 'tao-tai-khoan')).toBe(bacSP(spTruoc.phieu_dang_ky, 'tao-tai-khoan'));
    expect(bacSP(spSau.phieu_dang_ky, 'xong-ho-so')).toBe(bacSP(spTruoc.phieu_dang_ky, 'xong-ho-so'));
  });

  it('12. POST /internal/tick (kèm secret) trả khach_don', async () => {
    const k = await taoKhach();
    await luiNgay(k.userId, AUTH.SESSION_TTL_DAYS + 1);
    await gietPhien(k.userId);

    const r = await app.request('/api/v1/internal/tick', {
      method: 'POST', headers: { 'x-tick-secret': TICK_SECRET },
    });
    expect(r.status).toBe(200);
    const b = await j(r);
    expect(b.khach_don).toMatchObject({ da_don: expect.any(Number), bo_qua: expect.any(Number) });
    expect(b.khach_don.da_don).toBeGreaterThanOrEqual(1);
    expect(await conKhong(k.userId)).toBe(false);
  });

  it('13. nhánh lỗi tick — sổ đếm bị hỏng ⇒ 200, khach_don: null, kênh báo lỗi nhận đúng 1 lần noi=tick:don_khach VÀ đã xả', async () => {
    const k = await taoKhach();
    await luiNgay(k.userId, AUTH.SESSION_TTL_DAYS + 1);
    await gietPhien(k.userId);

    const goiLoi: { err: unknown; noi: string }[] = [];
    let daXa = 0;
    const appLoi = createApp({
      pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
      secureCookie: false, tickSecret: TICK_SECRET,
      baoLoi: {
        bao: (err, ctx) => { goiLoi.push({ err, ...ctx }); },
        baoMa: () => {},
        xa: async () => { daXa += 1; },
        noiRaNgoai: true,
      },
    }) as Hono<any>;

    /*
     * Làm máy dọn ném lỗi: capNhatSoDemDaDon() ghi vào bảng này SAU KHI đã xoá
     * users/avatar_so_huu/auth_accounts trong CÙNG transaction — bảng mất thì
     * INSERT ném 42P01 (không phải 23503), donKhachBoHoang() CHỈ nuốt 23503 nên
     * ném tiếp ra ngoài, đúng nhánh catch ở app.ts (kenhBaoLoi.bao rồi .xa()).
     */
    await pool.query(`DROP TABLE khach_da_don_ngay`);
    try {
      const r = await appLoi.request('/api/v1/internal/tick', {
        method: 'POST', headers: { 'x-tick-secret': TICK_SECRET },
      });
      expect(r.status).toBe(200);
      const b = await j(r);
      expect(b.khach_don).toBeNull();
      expect(goiLoi).toHaveLength(1);
      expect(goiLoi[0]!.noi).toBe('tick:don_khach');
      expect(daXa).toBe(1);
    } finally {
      // Dựng lại đúng schema 0072 cho các bài SAU trong tệp này — không thì mọi
      // bài gọi donKhachBoHoang()/tick sau bài này sẽ ăn theo lỗi này.
      await pool.query(
        `CREATE TABLE IF NOT EXISTS khach_da_don_ngay (ngay DATE PRIMARY KEY, so INTEGER NOT NULL CHECK (so > 0))`,
      );
    }

    // Transaction của khách này bị ROLLBACK khi INSERT sổ đếm ném lỗi — khách
    // vẫn còn nguyên, đúng nghĩa giao dịch nguyên tử (chưa từng "mất" gì).
    expect(await conKhong(k.userId)).toBe(true);
  });
});
