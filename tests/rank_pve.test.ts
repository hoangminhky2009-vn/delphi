/**
 * XẾP HẠNG MÙA BETA (rank_pve) — mở khoá 28/07 theo lệnh founder.
 *
 * Ba bất biến, mỗi cái canh một đường hỏng:
 * 1. Trận rank_pve kết thúc → điểm mùa VÀO rank_diem, đối ứng ÂM ở
 *    rank_quy_diem (reason chi_pve) — bất biến kiểm toán Σ điểm + quỹ = 0
 *    GIỮ NGUYÊN qua chính `kiemToanLamPhat`.
 * 2. Thang PvE KHÔNG ÂM: về bét vẫn 0 điểm, không tụt.
 * 3. Trận tự do KHÔNG ghi một điểm nào — nếu không thì mọi trận thành trận rank.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { quaMan } from './helpers/minigame.js';
import { kiemToanLamPhat } from '../server/rank.js';
import { DIEM_PVE } from '../config/rank.js';
import { currentSeasonId } from '../server/season.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-pve', secureCookie: false,
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

/**
 * Chơi trọn một trận (CHỐT VÒNG suông mọi vòng). Hạng cuối đọc từ event
 * `hd_match_end` (value_num = hạng của 'ban') — đúng con số hệ thống đã ghi,
 * không đoán lại từ payload.
 */
async function choiHetTran(cheDo?: 'rank_pve'): Promise<number> {
  const tao = await json('/api/v1/holdem/matches', {
    method: 'POST', body: JSON.stringify(cheDo ? { che_do: cheDo } : {}),
  });
  // D525 — khoá mặc định (v58) có màn lõi: qua màn sau mỗi cú nộp có màn; màn cuối qua thì GET khép trận (điểm mùa ghi lúc khép).
  let vong = 1;
  let xong = false;
  for (let i = 0; i < 20 && !xong; i++) {
    const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({
        vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [],
      }),
    });
    xong = r.xong === true;
    vong = r.vong ?? vong + 1;
    if (r.cho_man) {
      await quaMan(pool, tao.match_id);
      const g = await json(`/api/v1/holdem/matches/${tao.match_id}`);
      xong = g.status === 'xong';
      vong = (r.cho_man.vong as number) + 1;
    }
  }
  if (!xong) throw new Error('trận không kết thúc sau 20 vòng');
  const ev = await pool.query(
    `SELECT value_num FROM events
      WHERE context_id = $1 AND action_type = 'hd_match_end'
      ORDER BY ts DESC LIMIT 1`, [tao.match_id]);
  return Number(ev.rows[0]?.value_num ?? 0);
}

describe('rank_pve — điểm mùa Beta', () => {
  it('trận rank_pve kết thúc → điểm vào sổ, quỹ đối ứng, kiểm toán CÂN', async () => {
    const hang = await choiHetTran('rank_pve');
    expect(hang).toBeGreaterThanOrEqual(1);

    const diemKyVong = DIEM_PVE[hang - 1] ?? 0;
    const rd = await pool.query(
      `SELECT diem, so_tran FROM rank_diem WHERE user_id = $1`, [user.userId]);
    expect(Number(rd.rows[0]?.so_tran ?? 0), 'so_tran phải đếm cả trận 0 điểm')
      .toBe(1);
    expect(Number(rd.rows[0]?.diem ?? 0)).toBe(diemKyVong);

    if (diemKyVong > 0) {
      const quy = await pool.query(
        `SELECT delta, reason FROM rank_quy_diem ORDER BY entry_id DESC LIMIT 1`);
      expect(quy.rows[0]?.reason).toBe('chi_pve');
      expect(Number(quy.rows[0]?.delta)).toBe(-diemKyVong);
    }

    // Bất biến hệ: Σ điểm mọi người + số dư quỹ = 0 — qua CHÍNH hàm kiểm toán.
    const kt = await kiemToanLamPhat(pool, currentSeasonId());
    expect(kt.can, `kiểm toán lệch: hệ ${kt.tong_he} + quỹ ${kt.quy_diem} ≠ 0`)
      .toBe(true);
  });

  it('trận TỰ DO không ghi một điểm nào', async () => {
    const truoc = await pool.query(
      `SELECT diem, so_tran FROM rank_diem WHERE user_id = $1`, [user.userId]);
    await choiHetTran();
    const sau = await pool.query(
      `SELECT diem, so_tran FROM rank_diem WHERE user_id = $1`, [user.userId]);
    expect(sau.rows[0]?.diem).toBe(truoc.rows[0]?.diem);
    expect(sau.rows[0]?.so_tran).toBe(truoc.rows[0]?.so_tran);
  });
});
