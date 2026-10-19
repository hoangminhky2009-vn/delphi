/**
 * TÍNH CÁCH TÀI CHÍNH — bài "ĐƯỜNG THẬT CÓ CHẠY RA KHÔNG" (bẫy cơ chế trang
 * trí, repo dính 17+ lần): lõi thuần đã có vector tay riêng
 * (holdem_insight.test.ts); file này chơi THẬT qua endpoint rồi hỏi
 * `/holdem/me/tinh-cach` — đứt bất kỳ khớp nào trong dây
 * events → trải → insight là bài này đỏ.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { quaManNeuCo } from './helpers/minigame.js';

// D383 — số vòng = SỐ Ô − 1 (bối cảnh mở màn `o[0]` không quyết toán vòng nào).

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function json(path: string, init: RequestInit = {}): Promise<any> {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
  return r.json();
}

// D525 — khoá mặc định có màn lõi sau cú nộp ⇒ qua màn rồi đọc trạng thái thật (`quaManNeuCo`).
const nopVong = async (id: string, vong: number, them: Record<string, unknown> = {}) =>
  quaManNeuCo(pool, id, await json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0,
      cuoc: [], ...them,
    }),
  }), () => json(`/api/v1/holdem/matches/${id}`));

describe('⭐ /holdem/me/tinh-cach — dây events → trải → insight', () => {
  it('chơi thật vài vòng ⇒ hồ sơ có số, cỡ mẫu đúng, id tính cách hợp lệ', async () => {
    // Chưa chơi gì: hồ sơ rỗng nhưng KHÔNG lỗi — người mới cũng mở được thẻ.
    const trong = await json('/api/v1/holdem/me/tinh-cach');
    expect(trong.n_vong).toBe(0);
    expect(trong.tinh_cach).toBe('dang_dinh_hinh');

    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: '{}' });
    // D406 — số vòng của TRẬN NÀY (khoá mặc định v54: bàn 16 ⇒ 15 vòng), không gõ 7.
    const tong = Number(tao.tong_vong);
    for (let v = 1; v <= 3; v += 1) {
      const r = await nopVong(tao.match_id, v, v === 1
        ? { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] } : {});
      expect(r.error, `vòng ${v}`).toBeUndefined();
    }

    // D106 — hồ sơ theo GÓI: trận đang dở KHÔNG vào gói (chỉ trận xong), chưa
    // gói nào đầy ⇒ 🐣, chỉ số TẮT, nhưng tiến độ phải nói rõ còn thiếu gì.
    const hs = await json('/api/v1/holdem/me/tinh-cach');
    expect(hs.goi).toBeNull();
    expect(hs.tinh_cach).toBe('dang_dinh_hinh');
    expect(hs.tien_do).toMatchObject({ tran: 0, vong_quyet: 0, day: false });
    expect(hs.tien_do.can.tran).toBeGreaterThan(0);
    expect(hs.chi_so.hieu_chinh).toBeNull();
    // Chơi HẾT trận ⇒ mọi vòng quyết vào gói đang mở; events có mà không trải = dây đứt.
    for (let v = 4; v <= tong; v += 1) {
      const r = await nopVong(tao.match_id, v);
      expect(r.error, `vòng ${v}`).toBeUndefined();
    }
    const hs2 = await json('/api/v1/holdem/me/tinh-cach');
    expect(hs2.tien_do.tran).toBe(1);
    expect(hs2.tien_do.vong_quyet, 'events có mà không trải ra vòng nào = dây đứt').toBe(tong);
    expect(hs2.n_vong).toBe(tong); // D383 — bộ bài k ô chỉ chạy k−1 vòng (o[0] là bối cảnh mở màn, không quyết toán).
    // Chuỗi Brier (đường độ chuẩn) đi cùng hồ sơ ngay cả khi chưa đủ gói — có vị thế từ vòng 1.
    expect(Array.isArray(hs2.brier_chuoi)).toBe(true);
    expect(hs2.brier_chuoi.length).toBeGreaterThan(0);
  });

  it('/me/dong-token — sổ cái của chính mình gộp theo lý do', async () => {
    const r = await json('/api/v1/me/dong-token');
    expect(Array.isArray(r.dong)).toBe(true);
    // Fixture cấp vốn khởi điểm ⇒ ít nhất một dòng signup_grant dương.
    const grant = r.dong.find((d: any) => d.reason === 'signup_grant');
    expect(grant, 'sổ cái không có vốn chào sân — đường đọc sai bảng').toBeDefined();
    expect(grant.vao).toBeGreaterThan(0);
  });

  it('lệnh KHỚP GIỮA VÒNG cũng vào hồ sơ (hd_khop_lenh được trải)', async () => {
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: '{}' });
    const rk = await app.request(
      `http://localhost/api/v1/holdem/matches/${tao.match_id}/khop-lenh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: user.cookie },
        body: JSON.stringify({ vong: 1, lenh: [{ ma: 'vang', chieu: 'mua', moc_bp: 2500 }] }),
      });
    expect(rk.status).toBe(200);
    await nopVong(tao.match_id, 1);

    // Lệnh khớp giữa vòng phải nằm trong tầng chung chuyển (trận dở chưa vào gói,
    // nên kiểm thẳng ở `hanh_vi_vong`).
    await json('/api/v1/holdem/me/tinh-cach'); // làm tươi kho
    const { rows } = await pool.query(
      `SELECT lenh_json FROM hanh_vi_vong WHERE match_id = $1 AND vong = 1`, [tao.match_id]);
    expect(rows.length).toBe(1);
    expect(rows[0]!.lenh_json).toEqual([{ chieu: 'mua', moc_bp: 2500 }]);
  });
});
