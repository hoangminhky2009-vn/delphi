/**
 * BUỔI ĐO TỰ PHỤC VỤ (D370) — hai cửa mà founder vừa mở, canh trên DB thật.
 *
 * §I  BỎ XÁC MINH EMAIL cho người vào từ bàn buổi đo ĐANG MỞ (founder 21/09: *"bỏ xác minh đi :V vì
 *     đâu ai có link khác"*). Đây là cửa một chiều đã được chốt, nên bài canh phải ghim đúng **giới
 *     hạn** của nó: mở cho bàn buổi đo đang mở, và KHÔNG mở cho bất cứ đường nào khác. Ngày nào ai đó
 *     nới rộng thêm (bàn thường cũng qua · bàn đã đóng cũng qua · không mã cũng qua) thì bài này đỏ.
 *
 * §III CHẾ ĐỘ TESTER — `/auth/me` chở trạng thái, và HAI CỬA MỘT CHIỀU do app canh thay người điều phối:
 *     chưa nộp PHIẾU 1 ⇒ không vào được trận · chưa nộp PHIẾU 2 ⇒ màn kết KHÔNG trả thẻ năng lực.
 *     ⚠ Cửa thứ hai vá đúng chỗ rò tìm ra ở D367 lượt 2 (`GhiVaoThe` hiện ba bậc ngay khi hết trận).
 *
 * §II MÃ BUỔI ĐO cấp lúc bấm đồng ý, và **giữ nguyên khi rút rồi đồng ý lại** — mã đổi là mọi phiếu
 *     Google Form đã nộp thành mồ côi, mà bảng tính Form thì không ai đi sửa lại được.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { generateToken, hashToken } from '../server/auth/crypto.js';
import { AUTH } from '../config/auth.js';
import { CONSENT_PHIEN_BAN } from '../config/pfm_consent.js';
import { NANG_LUC_HIEN } from '../config/nang_luc.js';
import { khoiKetBuoiDo, maBuoiDo } from '../server/holdem_api.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, type TestUser } from './helpers/fixtures.js';
import { quaMan } from './helpers/minigame.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let DP: TestUser;
let BAN_MO: string;
let BAN_DONG: string;
let BAN_THUONG: string;

const KY = 'abcdefghjkmnpqrstuvwxyz23456789';

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-bdtpv', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  DP = await createTestUser(pool);
  await pool.query(`UPDATE users SET la_dieu_phoi = true WHERE user_id = $1`, [DP.userId]);

  BAN_MO = await taoBan('lop-tpv-mo');
  BAN_DONG = await taoBan('lop-tpv-dong');
  // Đóng bằng cách cho hết hạn — đúng đường prod dùng (`het_han <= now()` ⇒ `da_dong`).
  await pool.query(`UPDATE holdem_ban SET het_han = now() - interval '1 hour' WHERE ma = $1`, [BAN_DONG]);

  const r = await post(DP, '/api/v1/holdem/ban', { loai: 'chung', de_id: 'de-a' });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  BAN_THUONG = r.body.ma as string;
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function goi(u: TestUser | { cookie: string } | null, path: string, init: RequestInit = {}) {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(u ? { cookie: u.cookie } : {}), ...(init.headers ?? {}) },
  });
  return { status: r.status, body: await r.json().catch(() => null) as any };
}
const post = (u: TestUser | { cookie: string }, path: string, body: unknown = {}) =>
  goi(u, path, { method: 'POST', body: JSON.stringify(body) });

async function taoBan(nhan: string): Promise<string> {
  const r = await post(DP, '/api/v1/holdem/ban', { loai: 'buoi_do', de_id: 'de-c', nhan });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.ma as string;
}

/**
 * Tài khoản **CHƯA xác minh email** và **CHƯA onboard** — thứ fixture chuẩn không dựng được
 * (`createTestUser` luôn đặt `email_verified_at = now()` và đã có `user_id`).
 */
let seqTk = 0;
async function taiKhoanChuaXacMinh(): Promise<{ cookie: string; accountId: string }> {
  seqTk += 1;
  const raw = generateToken();
  const { rows } = await pool.query(
    `INSERT INTO auth_accounts (email, password_hash, email_verified_at, user_id)
     VALUES ($1, 'x', NULL, NULL) RETURNING account_id`,
    [`chuaxacminh${seqTk}_${Math.random().toString(36).slice(2, 8)}@test.local`],
  );
  await pool.query(
    `INSERT INTO auth_sessions (token_hash, account_id, expires_at) VALUES ($1, $2, now() + interval '1 day')`,
    [hashToken(raw), rows[0].account_id],
  );
  return { cookie: `${AUTH.SESSION_COOKIE}=${raw}`, accountId: rows[0].account_id };
}

const hoSo = (banMa?: string) => ({
  handle: `tpv${seqTk}${Math.random().toString(36).slice(2, 6)}`,
  age_band: '18-22', region: 'bac', occupation_band: 'hs_sv', research_consent: true,
  ...(banMa ? { ban_ma: banMa } : {}),
});

describe('§I · bỏ cửa xác minh — CHỈ cho bàn buổi đo đang mở', () => {
  it('có mã bàn buổi đo đang mở ⇒ onboard được dù email chưa xác minh', async () => {
    const tk = await taiKhoanChuaXacMinh();
    const r = await post(tk, '/api/v1/onboarding', hoSo(BAN_MO));
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);

    const { rows } = await pool.query(
      `SELECT email_verified_at, user_id FROM auth_accounts WHERE account_id = $1`, [tk.accountId]);
    expect(rows[0].user_id, 'phải có hồ sơ').not.toBeNull();
    expect(rows[0].email_verified_at, 'KHÔNG được âm thầm đánh dấu là đã xác minh').toBeNull();
  });

  it('KHÔNG gửi mã bàn ⇒ vẫn bị chặn 403', async () => {
    const tk = await taiKhoanChuaXacMinh();
    const r = await post(tk, '/api/v1/onboarding', hoSo());
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('email_not_verified');
  });

  it('bàn buổi đo ĐÃ ĐÓNG ⇒ vẫn bị chặn — cờ không sống quá hạn của bàn', async () => {
    const tk = await taiKhoanChuaXacMinh();
    const r = await post(tk, '/api/v1/onboarding', hoSo(BAN_DONG));
    expect(r.status).toBe(403);
  });

  it('bàn THƯỜNG (không phải buổi đo) ⇒ vẫn bị chặn', async () => {
    const tk = await taiKhoanChuaXacMinh();
    const r = await post(tk, '/api/v1/onboarding', hoSo(BAN_THUONG));
    expect(r.status).toBe(403);
  });

  it('mã bịa ⇒ vẫn bị chặn, và không báo gì khác đi (không thành máy dò mã bàn)', async () => {
    const tk = await taiKhoanChuaXacMinh();
    const r = await post(tk, '/api/v1/onboarding', hoSo('zzzz'));
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('email_not_verified');
  });

  it('email ĐÃ xác minh thì không cần mã bàn — đường thường không đổi', async () => {
    const tk = await taiKhoanChuaXacMinh();
    await pool.query(`UPDATE auth_accounts SET email_verified_at = now() WHERE account_id = $1`, [tk.accountId]);
    const r = await post(tk, '/api/v1/onboarding', hoSo());
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  });
});

describe('§II · mã buổi đo', () => {
  const dongY = (u: TestUser, ma: string) =>
    post(u, `/api/v1/holdem/ban/${ma}/dong-y`, { phien_ban: CONSENT_PHIEN_BAN.buoi_do });
  const maCua = async (u: TestUser): Promise<string | null> => {
    const { rows } = await pool.query(`SELECT ma_buoi_do FROM users WHERE user_id = $1`, [u.userId]);
    return rows[0].ma_buoi_do as string | null;
  };

  it('chưa đồng ý ⇒ chưa có mã; bấm đồng ý ⇒ có mã 4 ký tự đúng bảng chữ', async () => {
    const u = await createTestUser(pool);
    expect(await maCua(u)).toBeNull();

    const r = await dongY(u, BAN_MO);
    expect(r.status, JSON.stringify(r.body)).toBe(200);

    const ma = await maCua(u);
    expect(ma).toHaveLength(4);
    for (const ch of ma!) expect(KY, `ký tự "${ch}" ngoài bảng chữ`).toContain(ch);
    expect(ma).toBe(maBuoiDo(u.userId, BAN_MO));
  });

  it('⭐ rút rồi đồng ý lại ⇒ GIỮ NGUYÊN mã cũ (mã đổi là phiếu đã nộp thành mồ côi)', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    const truoc = await maCua(u);

    const rut = await post(u, `/api/v1/holdem/ban/${BAN_MO}/rut-dong-y`);
    expect(rut.status).toBe(200);
    // Rút KHÔNG xoá mã — cùng lý do thu_chi_tiet_nhan không bị xoá (0068/0069).
    expect(await maCua(u)).toBe(truoc);

    await dongY(u, BAN_MO);
    expect(await maCua(u), 'đồng ý lại mà mã đổi').toBe(truoc);
  });

  it('⭐ mã ĐÃ LƯU thắng mã hàm sinh ra — đây mới là bài canh COALESCE', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    /*
     * Đặt tay một mã KHÁC mã tất định, giả lập ngày mã thôi tất định (vd thêm vòng thử lại khi đụng
     * unique index 0069). Không có mũi này thì bỏ COALESCE cũng không bài nào đỏ — đã tiêm thử và
     * đúng là 0 đỏ, vì hàm tất định nên hai lớp giữ luôn cho cùng kết quả.
     */
    const datTay = 'zzz9';
    expect(datTay, 'mã đặt tay phải KHÁC mã tất định, nếu không mũi tiêm vô hiệu')
      .not.toBe(maBuoiDo(u.userId, BAN_MO));
    await pool.query(`UPDATE users SET ma_buoi_do = $2 WHERE user_id = $1`, [u.userId, datTay]);

    await post(u, `/api/v1/holdem/ban/${BAN_MO}/rut-dong-y`);
    await dongY(u, BAN_MO);
    expect(await maCua(u), 'đồng ý lại đã ghi đè mã đang lưu — phiếu đã nộp thành mồ côi').toBe(datTay);
  });

  it('rút đồng ý vẫn tắt cờ thu chi tiết — mã còn không có nghĩa là còn trong bảng dữ liệu', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    await post(u, `/api/v1/holdem/ban/${BAN_MO}/rut-dong-y`);
    const { rows } = await pool.query(
      `SELECT thu_chi_tiet, ma_buoi_do FROM users WHERE user_id = $1`, [u.userId]);
    expect(rows[0].thu_chi_tiet).toBe(false);
    expect(rows[0].ma_buoi_do).not.toBeNull();
  });

  it('hai người khác nhau ⇒ hai mã khác nhau', async () => {
    const a = await createTestUser(pool);
    const b = await createTestUser(pool);
    await dongY(a, BAN_MO);
    await dongY(b, BAN_MO);
    expect(await maCua(a)).not.toBe(await maCua(b));
  });

  it('bước khởi điểm là 0 — chưa ai nộp phiếu nào', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    const { rows } = await pool.query(`SELECT buoi_do_buoc FROM users WHERE user_id = $1`, [u.userId]);
    expect(rows[0].buoi_do_buoc).toBe(0);
  });
});

describe('§III · chế độ tester — trạng thái và hai cửa một chiều', () => {
  const dongY = (u: TestUser, ma: string) =>
    post(u, `/api/v1/holdem/ban/${ma}/dong-y`, { phien_ban: CONSENT_PHIEN_BAN.buoi_do });
  const me = (u: TestUser) => goi(u, '/api/v1/auth/me');
  const tien = (u: TestUser, buoc: number) => post(u, '/api/v1/holdem/buoi-do/buoc', { buoc });
  const vaoTran = (u: TestUser, banMa: string) => post(u, '/api/v1/holdem/matches', { ban_ma: banMa });

  it('người thường: /me không có khối buoi_do', async () => {
    const u = await createTestUser(pool);
    expect((await me(u)).body.buoi_do).toBeNull();
  });

  it('đồng ý ⇒ /me chở mã, nhãn nhóm và bước 0', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    const b = (await me(u)).body.buoi_do;
    expect(b).not.toBeNull();
    expect(b.ma).toBe(maBuoiDo(u.userId, BAN_MO));
    expect(b.nhan).toBe('lop-tpv-mo');
    expect(b.buoc).toBe(0);
  });

  /*
   * ⭐⭐ D392 — /me chở MÃ BÀN buổi đo (khác mã buổi đo của người). Thiếu nó thì chơi xong bàn tập là không có
   * đường về bàn (đi thử 23/09). Bàn = bàn của vết đồng ý MỚI NHẤT — người đo lại ở bàn thứ hai được dắt về bàn ấy.
   */
  it('⭐⭐ đồng ý ⇒ /me chở mã BÀN đã đồng ý; đồng ý bàn khác sau đó ⇒ trỏ bàn mới', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    expect((await me(u)).body.buoi_do.ban).toBe(BAN_MO);
    const banHai = await taoBan('lop-tpv-hai');
    await dongY(u, banHai);
    const b = (await me(u)).body.buoi_do;
    expect(b.ban).toBe(banHai);
    expect(b.ma, 'mã buổi đo của NGƯỜI giữ nguyên qua bàn thứ hai').toBe(maBuoiDo(u.userId, BAN_MO));
  });

  it('rút đồng ý ⇒ khối buoi_do biến mất khỏi /me', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    await post(u, `/api/v1/holdem/ban/${BAN_MO}/rut-dong-y`);
    expect((await me(u)).body.buoi_do).toBeNull();
  });

  it('⭐ CỬA 1: chưa nộp PHIẾU 1 ⇒ KHÔNG vào được trận', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    const r = await vaoTran(u, BAN_MO);
    expect(r.status, JSON.stringify(r.body)).toBe(409);
    expect(r.body.error).toBe('chua_nop_phieu_1');
  });

  it('⭐ CỬA 1: nộp PHIẾU 1 rồi thì vào được', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    await tien(u, 1);
    await choiTap(u);   // D370 lượt 5 — cửa bàn tập đứng trước trận thật
    const r = await vaoTran(u, BAN_MO);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  }, 90_000);

  /** Nộp vòng cho tới khi trận xong — đường THẬT, không chèn tay vào DB (A8.9). */
  async function choiHet(u: TestUser, id: string) {
    for (let v = 1; v <= 40; v += 1) {
      const r = await goi(u, `/api/v1/holdem/matches/${id}/rounds`, {
        method: 'POST',
        body: JSON.stringify({ vong: v, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [] }),
      });
      // ⚠ Trường báo hết trận là `xong` (boolean), KHÔNG phải `status` — `tests/ban_ngay.test.ts`
      //   kiểm `status === 'xong'`, trường ấy không tồn tại ở route này nên vòng lặp chạy tới cạn.
      if (r.body?.xong === true) return;
      // D525 — khoá mặc định có màn lõi: qua màn rồi đọc lại; màn cuối qua xong thì GET khép trận (`status: 'xong'`).
      if (r.body?.cho_man) {
        await quaMan(pool, id);
        const g = await goi(u, `/api/v1/holdem/matches/${id}`);
        if (g.body?.status === 'xong') return;
      }
    }
    throw new Error('trận không kết thúc sau 40 vòng');
  }

  const choiTap = async (u: TestUser) => {
    const r = await post(u, '/api/v1/holdem/matches', { tap: true });
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    await choiHet(u, r.body.match_id as string);
  };

  it('⭐ CỬA BÀN TẬP: nộp phiếu 1 rồi nhưng CHƯA chơi bàn tập ⇒ không vào trận thật', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    await tien(u, 1);
    const r = await vaoTran(u, BAN_MO);
    expect(r.status, JSON.stringify(r.body)).toBe(409);
    expect(r.body.error).toBe('chua_xong_ban_tap');
  }, 60_000);

  it('⭐ chơi XONG bàn tập rồi thì vào được trận thật', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    await tien(u, 1);
    await choiTap(u);
    const r = await vaoTran(u, BAN_MO);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  }, 90_000);

  it('⭐⭐ TỰ TIẾN 1→2 khi xong TRẬN THẬT — bàn tập KHÔNG tính (lỗi kẹt của lượt 4)', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    await tien(u, 1);

    await choiTap(u);
    const sauTap = await goi(u, '/api/v1/auth/me');
    expect(sauTap.body.buoi_do.buoc, 'bàn tập KHÔNG được tính là đã chơi').toBe(1);

    const t = await vaoTran(u, BAN_MO);
    await choiHet(u, t.body.match_id as string);
    await goi(u, `/api/v1/holdem/matches/${t.body.match_id}/autopsy`);
    const sauThat = await goi(u, '/api/v1/auth/me');
    expect(sauThat.body.buoi_do.buoc, 'xong trận thật mà bước không tiến ⇒ tester KẸT vĩnh viễn').toBe(2);
  }, 120_000);

  /*
   * ⭐⭐ D404 — TỰ TIẾN 1→2 NGAY LÚC TRẬN KHÉP, không cần mở màn kết. Bài trên gọi `/autopsy` rồi mới đọc bước —
   * tức nó không phân biệt được "tiến lúc khép" với "tiến lúc mở màn kết". Tester thoát đúng lúc ô cuối lật thì
   * không bao giờ mở màn kết, và trước D404 họ đứng mãi ở bước 1.
   */
  it('⭐⭐ D404 — trận khép là bước lên 2, KHÔNG cần mở màn kết', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    await tien(u, 1);
    await choiTap(u);
    const t = await vaoTran(u, BAN_MO);
    await choiHet(u, t.body.match_id as string);
    // KHÔNG gọi /autopsy.
    const me1 = await goi(u, '/api/v1/auth/me');
    expect(me1.body.buoi_do.buoc, 'trận khép mà bước chưa lên 2 ⇒ ai thoát ngay lúc hết trận là kẹt').toBe(2);
  }, 120_000);

  /*
   * ⭐⭐ D404 — CỬA 2 Ở ĐƯỜNG THỨ HAI. D370 giấu thẻ ở màn kết; nhưng Hồ sơ → Thẻ (và Gương · Lộ trình PFM) đọc
   * `/me/nang-luc`, đường ấy trước D404 trả đủ bậc ⇒ tester bấm sang Hồ sơ là thấy thẻ trước khi nhớ lại.
   */
  it('⭐⭐ D404 — /me/nang-luc bị GIỮ tới khi nộp Phiếu 2; người thường không chạm', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    await tien(u, 1);
    await choiTap(u);
    const t = await vaoTran(u, BAN_MO);
    await choiHet(u, t.body.match_id as string);

    const giu = await goi(u, '/api/v1/holdem/me/nang-luc');
    expect(giu.status).toBe(200);
    expect(giu.body.the_dang_giu, 'chưa nộp Phiếu 2 mà đường Hồ sơ → Thẻ vẫn mở').toBe(true);
    expect(giu.body.nang_luc, 'bậc lọt ra ở đường thứ hai').toEqual([]);
    expect(giu.body.so_de).toBe(0);

    await tien(u, 3);
    const mo = await goi(u, '/api/v1/holdem/me/nang-luc');
    expect(mo.body.the_dang_giu).toBeFalsy();
    expect(mo.body.nang_luc.map((n: { id: string }) => n.id)).toEqual([...NANG_LUC_HIEN]);

    const thuong = await createTestUser(pool);
    const r = await goi(thuong, '/api/v1/holdem/me/nang-luc');
    expect(r.body.the_dang_giu, 'người thường không có cửa này').toBeFalsy();
    expect(r.body.nang_luc.map((n: { id: string }) => n.id)).toEqual([...NANG_LUC_HIEN]);
  }, 120_000);

  it('⭐⭐ CỬA 2: chưa nộp PHIẾU 2 ⇒ màn kết KHÔNG trả thẻ năng lực (vá chỗ rò D367)', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    await tien(u, 1);
    await choiTap(u);   // D370 lượt 5 — cửa bàn tập đứng trước trận thật
    const tao = await vaoTran(u, BAN_MO);
    expect(tao.status, JSON.stringify(tao.body)).toBeLessThan(300);
    const id = tao.body.match_id as string;
    await choiHet(u, id);

    const giu = await goi(u, `/api/v1/holdem/matches/${id}/autopsy`);
    expect(giu.status, JSON.stringify(giu.body)).toBe(200);
    expect(giu.body.xong, 'trận phải đã xong thì bài canh mới nói được gì').toBe(true);
    expect(giu.body.the_dang_giu, 'phải BÁO là đang giữ, im lặng thì người ta tưởng hỏng').toBe(true);
    expect(giu.body.nang_luc, 'ba bậc năng lực lọt ra trước khi nộp PHIẾU 2').toBeUndefined();
    expect(giu.body.khoanh_khac, 'khối "vừa chạm" cũng kể ra đề có cơ chế gì').toEqual([]);
    // Màn kết vẫn phải có nghĩa — chỉ hai khối kia bị giữ.
    expect(giu.body.xep_hang.length).toBeGreaterThan(0);

    // Nộp PHIẾU 2 ⇒ mở.
    await tien(u, 3);
    const mo = await goi(u, `/api/v1/holdem/matches/${id}/autopsy`);
    expect(mo.body.the_dang_giu).toBe(false);
    expect(mo.body.nang_luc, 'nộp phiếu 2 rồi mà thẻ vẫn bị giữ').toBeDefined();
  }, 60_000);

  it('người THƯỜNG chơi xong vẫn thấy thẻ ngay — cửa 2 không chạm đường thường', async () => {
    const u = await createTestUser(pool);
    const tao = await post(u, '/api/v1/holdem/matches', {});
    expect(tao.status, JSON.stringify(tao.body)).toBeLessThan(300);
    const id = tao.body.match_id as string;
    await choiHet(u, id);
    const r = await goi(u, `/api/v1/holdem/matches/${id}/autopsy`);
    expect(r.body.the_dang_giu).toBe(false);
    expect(r.body.nang_luc).toBeDefined();
  }, 60_000);

  it('bước CHỈ TIẾN, không lùi — xin số nhỏ hơn thì giữ nguyên số lớn', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    expect((await tien(u, 3)).body.buoc).toBe(3);
    expect((await tien(u, 1)).body.buoc, 'đã lùi được bước — mở đường làm lại phiếu sau khi xem thẻ').toBe(3);
  });

  it('bước ngoài 1–5 ⇒ 400; người không ở chế độ tester ⇒ 409', async () => {
    const u = await createTestUser(pool);
    await dongY(u, BAN_MO);
    expect((await tien(u, 0)).status).toBe(400);
    expect((await tien(u, 6)).status).toBe(400);
    const t = await createTestUser(pool);
    expect((await tien(t, 1)).status).toBe(409);
  });
});

/**
 * §IV · HAI Ô BỊ GIỮ — canh bằng dữ liệu KHÔNG RỖNG.
 *
 * ⚠ Vì sao phải có mục này: bài §III kiểm `khoanh_khac` rỗng trên một trận thật, mà một trận thật
 *   CŨNG hay rỗng sẵn — nên nó xanh cả khi quên giấu (tiêm thử: 0 đỏ). Đây là bài canh rỗng thứ hai
 *   bị bắt trong D370; lần đầu là COALESCE ở §II. Cả hai cùng một bệnh: **xanh vì lý do khác với lý
 *   do nó được viết ra.**
 */
describe('§IV · hai ô bị giữ tới khi nộp PHIẾU 2', () => {
  const the = { cam_ket_tiet_kiem: 'lam_duoc' };
  const cham = [{ id: 'tin_gia', vong: 3 }, { id: 'don_bay', vong: 7 }];

  it('đang giữ ⇒ giấu CẢ HAI ô', () => {
    const r = khoiKetBuoiDo(true, the, cham);
    expect(r.nang_luc, 'ba bậc năng lực lọt ra').toBeUndefined();
    expect(r.khoanh_khac, 'khối "vừa chạm" kể ra đề có cơ chế gì').toEqual([]);
  });

  it('đã nộp ⇒ trả NGUYÊN VẸN cả hai ô', () => {
    const r = khoiKetBuoiDo(false, the, cham);
    expect(r.nang_luc).toBe(the);
    expect(r.khoanh_khac).toBe(cham);
  });

  it('giữ ô này mà quên ô kia là hỏng — hai ô đi cùng nhau', () => {
    for (const giu of [true, false]) {
      const r = khoiKetBuoiDo(giu, the, cham);
      expect(r.nang_luc === undefined, 'hai ô phải cùng giấu hoặc cùng mở')
        .toBe(r.khoanh_khac.length === 0);
    }
  });
});
