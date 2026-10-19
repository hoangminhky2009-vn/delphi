/**
 * CHẾ ĐỘ KHÁCH — chơi ngay, không đăng nhập, KHOÁ RANK, vẫn thu dữ liệu.
 * Founder chốt 04/08.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { ensureGenesis } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

const vaoKhach = (ip = '203.0.113.9') =>
  app.request('/api/v1/auth/khach', { method: 'POST', headers: { 'x-forwarded-for': ip } });

/**
 * B5 (vá đợt 1 Gói 2) — khách qua cổng tuổi (`POST /me/tuoi`) trước khi tạo trận, như ngoài đời (tấm hỏi năm sinh). Cổng tuổi có bài
 * riêng (`tests/age_gate_moi_duong.test.ts`); các bài dưới canh khoá rank / chơi tự do, nên tiền đề là khách ĐÃ qua cổng.
 */
const quaCongTuoi = async (token: string) => {
  const r = await app.request('/api/v1/me/tuoi', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ birth_year: new Date().getUTCFullYear() - 20 }),
  });
  expect(r.status).toBe(200);
};

describe('I. Vào chơi — một cú bấm', () => {
  it('không gửi gì cả vẫn vào được, và có tên để đối thủ nhìn thấy', async () => {
    const r = await vaoKhach();
    expect(r.status).toBe(200);
    const b: any = await r.json();
    expect(b.la_khach).toBe(true);
    expect(b.handle).toMatch(/^khach_[a-z0-9]+$/);
    // Token trả ra THÂN phản hồi — đó là thứ chạy được trong iframe Discord,
    // nơi cookie SameSite=Lax không bao giờ được gửi.
    expect(typeof b.token).toBe('string');
  });

  it('token dùng được ngay bằng Bearer — không cần cookie', async () => {
    const b: any = await (await vaoKhach('203.0.113.10')).json();
    const me = await app.request('/api/v1/auth/me', {
      headers: { authorization: `Bearer ${b.token}` },
    });
    expect(me.status).toBe(200);
    expect((await me.json() as any).user.handle).toBe(b.handle);
  });

  it('khách là bậc 0: KHÔNG nhân khẩu, KHÔNG vốn — Đấu trường không đụng ví', async () => {
    const b: any = await (await vaoKhach('203.0.113.11')).json();
    const { rows } = await pool.query(
      `SELECT age_band, region, occupation_band, bankroll, la_khach
         FROM users WHERE handle = $1`, [b.handle]);
    expect(rows[0].la_khach).toBe(true);
    expect(rows[0].age_band).toBeNull();
    expect(Number(rows[0].bankroll)).toBe(0);
  });

  /*
   * ⚠ Cửa này TẠO MỘT HÀNG `users` mỗi lần gọi, mà `events` trỏ vào đó — không
   * chặn thì nó là cửa bơm phình bảng người dùng, và rác kéo theo rác vào một
   * bảng append-only.
   */
  it('bấm quá nhiều lần từ một IP thì bị chặn', async () => {
    let chan = false;
    for (let i = 0; i < 12; i += 1) {
      if ((await vaoKhach('198.51.100.7')).status === 429) { chan = true; break; }
    }
    expect(chan, 'không có trần = cửa bơm phình bảng users').toBe(true);
  });
});

describe('II. Khoá rank — HAI TẦNG', () => {
  /*
   * ⚠⚠ Hai tầng vì chúng hỏng theo hai cách khác nhau: quên tầng cửa thì người
   * chơi bị lừa (chơi xong mới biết không tính); quên tầng ghi điểm thì bảng xếp
   * hạng bị bẩn, mà `rank_diem` cộng dồn nên bẩn rồi phải đi bút toán ngược.
   */
  it('TẦNG 1 — khách tạo trận xếp hạng thì bị từ chối NGAY, biết trước khi chơi', async () => {
    const b: any = await (await vaoKhach('203.0.113.12')).json();
    await quaCongTuoi(b.token);
    const r = await app.request('/api/v1/holdem/matches', {
      method: 'POST',
      headers: { authorization: `Bearer ${b.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ che_do: 'rank_pve' }),
    });
    expect(r.status).toBe(403);
    expect((await r.json() as any).error).toBe('khach_khong_xep_hang');
  });

  it('TẦNG 2 — dù gọi thẳng đường ghi điểm, khách vẫn KHÔNG có điểm', async () => {
    const { ghiDiemPve } = await import('../server/rank.js');
    const b: any = await (await vaoKhach('203.0.113.13')).json();
    const { rows } = await pool.query(`SELECT user_id FROM users WHERE handle = $1`, [b.handle]);
    const diem = await ghiDiemPve(pool, {
      userId: rows[0].user_id, seasonId: '2026Q3', hang: 1,
    });
    expect(diem).toBe(0);
    const { rows: rd } = await pool.query(
      `SELECT count(*)::int n FROM rank_diem WHERE user_id = $1`, [rows[0].user_id]);
    expect(rd[0].n, 'khách không được để lại dòng nào trong thang xếp hạng').toBe(0);
  });

  it('nhưng chơi TỰ DO thì thoải mái — khoá rank không phải khoá cửa', async () => {
    const b: any = await (await vaoKhach('203.0.113.14')).json();
    await quaCongTuoi(b.token);
    const r = await app.request('/api/v1/holdem/matches', {
      method: 'POST',
      headers: { authorization: `Bearer ${b.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(r.status, 'khách phải vào được trận tự do').toBe(201);
  });
});

describe('III. Vẫn thu dữ liệu, và cắt riêng được nhóm này', () => {
  it('cờ `la_khach` tách được nhóm khách khỏi người có tài khoản', async () => {
    await vaoKhach('203.0.113.15');
    const { rows } = await pool.query(
      `SELECT count(*) FILTER (WHERE la_khach)::int khach,
              count(*) FILTER (WHERE NOT la_khach)::int thuong FROM users`);
    expect(rows[0].khach).toBeGreaterThan(0);
    // Founder: "Vẫn thu data riêng nhóm này" — một cột, cắt được, không cần
    // bảng thứ hai và không cần hợp nhất hai nguồn khi phân tích.
  });
});
