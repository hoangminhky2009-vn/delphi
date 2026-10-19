/**
 * BUỔI ĐO CỦA TÔI — `GET /api/v1/holdem/ban-buoi-do` (D333), đường đọc của màn điều phối.
 *
 * Canh những thứ là RANH, không phải tiện ích:
 *  §I   chỉ người điều phối (cùng cổng với cú tạo bàn) — người thường, khách ⇒ 403;
 *  §II  chỉ bàn CỦA MÌNH, chỉ loại buổi đo;
 *  §III chỉ HAI SỐ ĐẾM (đã vào · đã xong) — không tên, không hạng, không seed. Số theo người đi qua `/nhom`
 *       sau khi đóng; ở đây mà lọt một handle là mở một đường đọc từng người lúc bàn còn mở.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, xongBanTap, type TestUser } from './helpers/fixtures.js';
import { DE_DANG_DUNG, NGAN_HANG_DE } from '../config/holdem_de.js';
import { CONSENT_PHIEN_BAN } from '../config/pfm_consent.js';
import { datQuyenDieuPhoi } from '../server/holdem/ban_buoi_do.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let DP: TestUser;
let DP2: TestUser;
let NT: TestUser;
let NT2: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', tickSecret: 'tick-bdds', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  DP = await createTestUser(pool);
  DP2 = await createTestUser(pool);
  NT = await createTestUser(pool);
  NT2 = await createTestUser(pool);
  await pool.query(`UPDATE users SET la_dieu_phoi = true WHERE user_id = ANY($1)`, [[DP.userId, DP2.userId]]);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function goi(u: TestUser | null, path: string, init: RequestInit = {}) {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(u ? { cookie: u.cookie } : {}), ...(init.headers ?? {}) },
  });
  return { status: r.status, body: await r.json() as any };
}
const post = (u: TestUser, path: string, body: unknown = {}) =>
  goi(u, path, { method: 'POST', body: JSON.stringify(body) });

async function taoBan(u: TestUser, nhan: string): Promise<string> {
  const r = await post(u, '/api/v1/holdem/ban', { loai: 'buoi_do', de_id: 'de-c', nhan });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.ma as string;
}

async function vao(u: TestUser, ma: string): Promise<{ match_id: string; tong_vong: number }> {
  expect((await post(u, `/api/v1/holdem/ban/${ma}/dong-y`, { phien_ban: CONSENT_PHIEN_BAN.buoi_do })).status).toBe(200);
  /*
   * D370 — từ nay đồng ý KHÔNG đủ để vào trận. HAI cửa: nộp PHIẾU 1 (phiếu ấy hỏi họ ĐOÁN nên phải
   * trả lời khi chưa mở app) và chơi XONG BÀN TẬP (founder chốt 22/09 "luật mới đúng"). Bài này đo
   * chuyện khác — số đếm của màn điều phối — nên chỉ cần qua cửa, không cần đo cửa. Cả hai cửa có
   * bài canh riêng đi đường thật ở `tests/buoi_do_tu_phuc_vu` §III.
   */
  expect((await post(u, '/api/v1/holdem/buoi-do/buoc', { buoc: 1 })).status).toBe(200);
  await xongBanTap(pool, u);
  const t = await post(u, '/api/v1/holdem/matches', { ban_ma: ma });
  expect(t.status, JSON.stringify(t.body)).toBe(201);
  return t.body;
}

async function choiXong(u: TestUser, t: { match_id: string; tong_vong: number }): Promise<void> {
  for (let v = 1; v <= Number(t.tong_vong); v += 1) {
    const r = await post(u, `/api/v1/holdem/matches/${t.match_id}/rounds`,
      { vong: v, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [] });
    expect(r.body.error, `vòng ${v}: ${JSON.stringify(r.body)}`).toBeUndefined();
  }
}

describe('§I — ai đọc được', () => {
  it('⭐ người thường ⇒ 403 khong_phai_dieu_phoi; không cookie ⇒ 401', async () => {
    const r = await goi(NT, '/api/v1/holdem/ban-buoi-do');
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('khong_phai_dieu_phoi');
    expect((await goi(null, '/api/v1/holdem/ban-buoi-do')).status).toBe(401);
  });
});

describe('§II + §III — bàn của mình, chỉ số đếm', () => {
  it('⭐ đếm đúng người đã vào / trận đã xong; chỉ bàn của mình; bàn đóng có cờ', async () => {
    const maMo = await taoBan(DP, 'lop-ds-mo');
    const maDong = await taoBan(DP, 'lop-ds-dong');
    const maKhac = await taoBan(DP2, 'lop-cua-nguoi-khac');

    const t1 = await vao(NT, maMo);
    await choiXong(NT, t1);
    await vao(NT2, maMo);          // vào, chưa xong
    await pool.query(`UPDATE holdem_ban SET het_han = now() - interval '1 minute' WHERE ma = $1`, [maDong]);

    const r = await goi(DP, '/api/v1/holdem/ban-buoi-do');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const theoMa = new Map((r.body.ban as any[]).map((b) => [b.ma, b]));
    expect(theoMa.has(maKhac)).toBe(false);
    expect(theoMa.get(maMo)).toMatchObject({ nhan: 'lop-ds-mo', de_id: 'de-c', da_dong: false, so_nguoi: 2, so_xong: 1 });
    expect(theoMa.get(maDong)).toMatchObject({ da_dong: true, so_nguoi: 0, so_xong: 0 });
  });

  it('⭐ không một handle, email, user_id, hạng hay seed nào trong phản hồi', async () => {
    const r = await goi(DP, '/api/v1/holdem/ban-buoi-do');
    const tho = JSON.stringify(r.body);
    for (const u of [NT, NT2, DP]) {
      const hang = (await pool.query(`SELECT handle FROM users WHERE user_id = $1`, [u.userId])).rows[0];
      expect(tho).not.toContain(hang.handle);
      expect(tho).not.toContain(u.userId);
    }
    for (const d of NGAN_HANG_DE) expect(tho).not.toContain(String(d.seed));
    expect(tho).not.toMatch(/"(hang|von_cuoi|seed|email|handle|bac)"/);
    expect(r.body.de).toEqual(DE_DANG_DUNG.map((d) => ({ id: d.id, so_o: d.so_o })));
  });
});

describe('§IV — trao quyền điều phối (lõi của `npm run dieu-phoi`)', () => {
  const coCo = async (u: TestUser) =>
    (await pool.query(`SELECT la_dieu_phoi FROM users WHERE user_id = $1`, [u.userId])).rows[0].la_dieu_phoi;

  it('⭐ không cờ ⇒ CHỈ ĐỌC: báo trạng thái, không ghi', async () => {
    const u = await createTestUser(pool);
    expect(await datQuyenDieuPhoi(pool, u.handle, null)).toEqual(
      { loai: 'ok', handle: u.handle, truoc: false, sau: false });
    expect(await coCo(u)).toBe(false);
  });

  it('bật (handle viết hoa/khoảng trắng vẫn trúng) ⇒ ghi; bật lại ⇒ không đổi; gỡ ⇒ tắt', async () => {
    const u = await createTestUser(pool);
    expect(await datQuyenDieuPhoi(pool, ` ${u.handle.toUpperCase()} `, true)).toMatchObject({ loai: 'ok', truoc: false, sau: true });
    expect(await coCo(u)).toBe(true);
    expect(await datQuyenDieuPhoi(pool, u.handle, true)).toMatchObject({ truoc: true, sau: true });
    expect(await datQuyenDieuPhoi(pool, u.handle, false)).toMatchObject({ truoc: true, sau: false });
    expect(await coCo(u)).toBe(false);
  });

  it('handle không tồn tại ⇒ khong_co; tài khoản khách ⇒ la_khach và KHÔNG ghi', async () => {
    expect((await datQuyenDieuPhoi(pool, 'khong_ai_ten_nay', true)).loai).toBe('khong_co');
    const k = await createTestUser(pool);
    await pool.query(`UPDATE users SET la_khach = true WHERE user_id = $1`, [k.userId]);
    expect((await datQuyenDieuPhoi(pool, k.handle, true)).loai).toBe('la_khach');
    expect(await coCo(k)).toBe(false);
  });
});
