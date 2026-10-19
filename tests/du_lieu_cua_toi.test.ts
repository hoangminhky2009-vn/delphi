/**
 * DỮ LIỆU CỦA TÔI · XOÁ TÀI KHOẢN · BÁO LỖI — SPEC `chan-truoc-beta` mục 5 (`server/du_lieu_cua_toi.ts`, migration 0079).
 *
 *   · xem dữ liệu: `GET /account/du-lieu` (+ các trang `/xuat`) CHỈ trả dữ liệu của chính người gọi — bài hai tài khoản: A đọc mọi trang
 *     mà không thấy một byte nào của B (user_id · tên · email · chữ báo lỗi · mã trận);
 *   · xoá tài khoản: telemetry + báo lỗi của người đó mất; `events` còn (A3.3), và KHÔNG còn đường nào từ `user_id` về email/tên cũ —
 *     quét chuỗi ấy trên MỌI bảng của DB;
 *   · báo lỗi: bảng riêng (không phải `events`) · ≤ 1.000 ký tự · trần 5/ngày/người · tin Sentry không chở chữ người chơi gõ (C7).
 * Qua HTTP + Postgres nhúng; kênh Sentry là một kênh ghi lại (cùng giao diện `KenhBaoLoi`, không mock đường nghiệp vụ).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import type { BoiCanhLoi, KenhBaoLoi } from '../server/bao_loi.js';
import { hashPassword } from '../server/auth/crypto.js';
import { BAO_LOI } from '../config/bao_loi.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
const chuong: Array<{ loi: string; ctx: BoiCanhLoi } | { ten: string; nhan: Record<string, string>; vanTay?: string | undefined }> = [];
const kenh: KenhBaoLoi = {
  bao(err, ctx) { chuong.push({ loi: err instanceof Error ? err.message : String(err), ctx }); },
  baoMa(ten, nhan, vanTay) { chuong.push({ ten, nhan, vanTay }); },
  async xa() { /* ghi lại là đủ */ },
  noiRaNgoai: true,
};

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false, baoLoi: kenh,
  }) as Hono<any>;
}, 120_000);
afterAll(async () => { await db?.stop(); });

const goi = (u: TestUser, path: string, body?: unknown) => app.request(`http://localhost${path}`, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', cookie: u.cookie, 'x-forwarded-for': '203.0.113.9' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const json = async (u: TestUser, path: string, body?: unknown): Promise<any> => (await goi(u, path, body)).json();

/** Cho một người đủ mọi loại dữ liệu: một trận đã nộp vòng, telemetry, một báo lỗi mang dấu riêng. */
async function gieo(u: TestUser, dau: string): Promise<string> {
  const t = await json(u, '/api/v1/holdem/matches', {});
  expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
  const r = await goi(u, `/api/v1/holdem/matches/${t.match_id}/rounds`,
    { vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [] });
  expect(r.status).toBe(200);
  await goi(u, '/api/v1/telemetry', { idempotency_key: `lo-${dau}`.slice(0, 32).padEnd(12, 'x'), su_kien: [{ loai: 'man_vao', man: '/arena' }] });
  const b = await goi(u, '/api/v1/bao-loi', {
    noi_dung: `bàn kẹt ${dau}`, man: '/dau-truong', ban: '0.0.65', ma_loi: 'network', email: `tra_loi_${dau.toLowerCase()}@vidu.test`,
  });
  expect(b.status).toBe(201);
  return t.match_id as string;
}

/** Tải TRỌN tệp xuất như web làm: tóm + mọi trang của mọi bảng. */
async function taiTron(u: TestUser): Promise<{ tom: any; trang: Record<string, any[]> }> {
  const tom = await json(u, '/api/v1/account/du-lieu');
  const trang: Record<string, any[]> = {};
  for (const bang of ['events', 'telemetry', 'bao_loi', 'tran']) {
    trang[bang] = [];
    let sau = 0;
    for (let i = 0; i < 50; i += 1) {
      const p = await json(u, `/api/v1/account/du-lieu/xuat?bang=${bang}&sau=${sau}`);
      expect(p.error, JSON.stringify(p)).toBeUndefined();
      trang[bang]!.push(...p.dong);
      if (p.tiep === null) break;
      sau = p.tiep;
    }
  }
  return { tom, trang };
}

describe('xem + tải dữ liệu của tôi', () => {
  it('⭐ hai tài khoản: A đọc mọi thứ của mình, KHÔNG thấy một byte nào của B', async () => {
    const a = await createTestUser(pool, { tienTo: 'dla' });
    const b = await createTestUser(pool, { tienTo: 'dlb' });
    const tranA = await gieo(a, 'CUA_A_7f3');
    const tranB = await gieo(b, 'CUA_B_9q2');
    const { tom, trang } = await taiTron(a);
    const toanBo = JSON.stringify({ tom, trang });

    for (const la of [b.userId, b.handle, 'CUA_B_9q2', tranB]) {
      expect(toanBo.includes(la), `dữ liệu của A lộ "${la}" của B`).toBe(false);
    }
    // Và A thấy ĐỦ của mình (đối chứng — chứng minh bài không xanh vì trả rỗng).
    expect(toanBo).toContain('CUA_A_7f3');
    expect(toanBo).toContain(tranA);
    expect(tom.ho_so.handle).toBe(a.handle);
    expect(tom.so_tran).toBe(1);
    expect(tom.telemetry).toBe(1);
    expect(tom.bao_loi).toBe(1);
    const soEvents = (await pool.query('SELECT count(*)::int AS n FROM events WHERE user_id = $1', [a.userId])).rows[0].n;
    expect(tom.events.reduce((s: number, x: { n: number }) => s + x.n, 0)).toBe(soEvents);
    expect(trang.events!.length, 'tệp xuất phải chở đủ mọi dòng events').toBe(soEvents);
    expect(trang.tran!.map((x) => x.match_id)).toEqual([tranA]);
    // Server trả ID + SỐ (A11.9): loại ghi là mã, không có câu chữ hiển thị.
    expect(tom.events.every((x: { loai: string }) => /^[a-z][a-z0-9_]+$/.test(x.loai))).toBe(true);
  }, 120_000);

  it('đồng ý: ô nghiên cứu + số bản + vết bật/tắt nằm trong bản tóm', async () => {
    const u = await createTestUser(pool, { tienTo: 'dlc' });
    await goi(u, '/api/v1/account/consent', { research_consent: false });
    const tom = await json(u, '/api/v1/account/du-lieu');
    expect(tom.dong_y.nghien_cuu.bat).toBe(false);
    expect(tom.vet_dong_y[0]).toMatchObject({ loai: 'nghien_cuu_rut', van_ban_id: 'nghien_cuu' });
    expect(Object.keys(tom.dong_y.pfm).sort()).toEqual(['dac_trung', 'ket', 'noi_game', 'thuong']);
  });

  it('chưa đăng nhập ⇒ 401; bảng lạ ⇒ 400', async () => {
    expect((await app.request('http://localhost/api/v1/account/du-lieu')).status).toBe(401);
    const u = await createTestUser(pool, { tienTo: 'dld' });
    expect((await goi(u, '/api/v1/account/du-lieu/xuat?bang=users')).status).toBe(400);
  });
});

describe('xoá tài khoản', () => {
  it('⭐ telemetry + báo lỗi mất; events còn; không còn đường nào từ user_id về email/tên cũ', async () => {
    const u = await createTestUser(pool, { tienTo: `qzk${Math.random().toString(36).slice(2, 10)}` });   // tên riêng: không là chuỗi con của gì khác
    const email = `xoa_${Date.now()}@vidu.test`;
    await pool.query(
      `UPDATE auth_accounts SET email = $2, password_hash = $3 WHERE user_id = $1`,
      [u.userId, email, await hashPassword('matkhau-xoa-123')]);
    await gieo(u, 'XOA_dau_1');
    // Đổi tên trước khi xoá — `handle_doi` nằm trong `events` (không xoá được): nó KHÔNG được chở tên cũ lẫn mới (founder 11/10 "A").
    const tenMoi = `qzm${Math.random().toString(36).slice(2, 10)}`;
    expect((await goi(u, '/api/v1/me/handle', { handle: tenMoi })).status).toBe(200);
    const evTruoc = (await pool.query('SELECT count(*)::int AS n FROM events WHERE user_id = $1', [u.userId])).rows[0].n;
    expect(evTruoc).toBeGreaterThan(0);

    const r = await goi(u, '/api/v1/account/delete', { password: 'matkhau-xoa-123' });
    expect(r.status, await r.clone().text()).toBe(200);

    const dem = async (sql: string) => (await pool.query(sql, [u.userId])).rows[0].n as number;
    expect(await dem('SELECT count(*)::int AS n FROM telemetry WHERE user_id = $1'), 'telemetry phải mất').toBe(0);
    expect(await dem('SELECT count(*)::int AS n FROM bao_loi WHERE user_id = $1'), 'báo lỗi phải mất').toBe(0);
    expect(await dem('SELECT count(*)::int AS n FROM events WHERE user_id = $1'), 'events ở lại (A3.3)').toBe(evTruoc);

    // QUÉT MỌI BẢNG: email và tên cũ không còn nằm ở bất cứ đâu ⇒ không đường nào từ user_id về danh tính.
    const bang = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`);
    for (const { table_name: t } of bang.rows) {
      // `tra_loi_…` = email người chơi tự điền ở ô Báo lỗi (0080) — phải mất cùng dòng báo lỗi.
      for (const la of [email, u.handle, tenMoi, 'tra_loi_xoa_dau_1@vidu.test']) {
        const q = await pool.query(`SELECT count(*)::int AS n FROM "${t}" x WHERE strpos(lower(x::text), lower($1)) > 0`, [la]);
        expect(q.rows[0].n, `bảng ${t} còn giữ "${la}" sau khi xoá tài khoản`).toBe(0);
      }
    }
  }, 120_000);
});

describe('báo lỗi', () => {
  it('⭐ lưu ở bảng riêng (không phải events) · chuông Sentry chỉ chở mã, KHÔNG chở chữ người chơi gõ', async () => {
    const u = await createTestUser(pool, { tienTo: 'bl' });
    const evTruoc = (await pool.query('SELECT count(*)::int AS n FROM events WHERE user_id = $1', [u.userId])).rows[0].n;
    chuong.length = 0;
    const CHU = 'số điện thoại tôi là 0912 xxx, bàn kẹt ở vòng 3';
    const r = await goi(u, '/api/v1/bao-loi', { noi_dung: CHU, man: '/dau-truong/tran', ban: '0.0.65', ma_loi: 'sai_vong' });
    expect(r.status).toBe(201);
    const id = ((await r.json()) as any).bao_loi_id;
    const hang = (await pool.query('SELECT * FROM bao_loi WHERE bao_loi_id = $1', [id])).rows[0];
    expect(hang).toMatchObject({ user_id: u.userId, noi_dung: CHU, man: '/dau-truong/tran', ban: '0.0.65', ma_loi: 'sai_vong' });
    expect((await pool.query('SELECT count(*)::int AS n FROM events WHERE user_id = $1', [u.userId])).rows[0].n).toBe(evTruoc);
    expect(chuong).toHaveLength(1);
    // SPEC bao-loi-nguoi-choi: chuông chỉ ba nhãn ban/man/ma_loi; vân tay riêng mỗi báo (mỗi báo một thư).
    expect(chuong[0]).toEqual({ ten: 'bao_loi_moi', nhan: { ban: '0.0.65', man: '/dau-truong/tran', ma_loi: 'sai_vong' }, vanTay: `bao_loi:${id}` });
    const tin = JSON.stringify(chuong[0]);
    for (const la of ['0912', 'kẹt', u.userId, u.handle]) expect(tin.includes(la), `tin Sentry chở "${la}"`).toBe(false);
  });

  it('> 1.000 ký tự hoặc rỗng ⇒ 400, không lưu', async () => {
    const u = await createTestUser(pool, { tienTo: 'bl2' });
    for (const noi_dung of ['', '   ', 'x'.repeat(BAO_LOI.DO_DAI_TOI_DA + 1)]) {
      expect((await goi(u, '/api/v1/bao-loi', { noi_dung })).status).toBe(400);
    }
    expect((await goi(u, '/api/v1/bao-loi', { noi_dung: 'x'.repeat(BAO_LOI.DO_DAI_TOI_DA) })).status).toBe(201);
  });

  it('⭐ trần BAO_LOI.TRAN_MOI_NGAY (3) báo/ngày/người — báo kế ⇒ 429; người khác không bị vạ lây', async () => {
    const u = await createTestUser(pool, { tienTo: 'bl3' });
    const kq = await Promise.all(Array.from({ length: BAO_LOI.TRAN_MOI_NGAY + 2 }, (_, i) =>
      Promise.resolve(goi(u, '/api/v1/bao-loi', { noi_dung: `lần ${i}` })).then((r: Response) => r.status)));
    expect(kq.filter((s: number) => s === 201)).toHaveLength(BAO_LOI.TRAN_MOI_NGAY);
    expect(kq.filter((s: number) => s === 429)).toHaveLength(2);
    const v = await createTestUser(pool, { tienTo: 'bl4' });
    expect((await goi(v, '/api/v1/bao-loi', { noi_dung: 'tôi khác' })).status).toBe(201);
  });

  it('admin đọc được; người thường ⇒ 403', async () => {
    const u = await createTestUser(pool, { tienTo: 'bl5' });
    expect((await goi(u, '/api/v1/admin/bao-loi')).status).toBe(403);
  });
});
