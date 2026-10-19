/**
 * LƯU BRIER MỖI VÒNG (04 §2.1 — việc số 1 tuần cuối mùa 0.0).
 *
 * D67 dựng thước ĐỘ CHUẨN rồi chỉ HIỆN nó lên màn — không bảng nào giữ. Đây là
 * lỗ MỘT CHIỀU: `events` append-only nên mọi vòng chơi trước migration 0035 là
 * mất vĩnh viễn. File này khoá cho nó không bao giờ tuột lại.
 *
 * ⚠ Bài học D67 lặp lại có chủ ý: bài §I hỏi đúng câu *"engine có CHẠY RA dòng
 * này không"* qua ENDPOINT THẬT — vì một INSERT có thể đúng cú pháp mà không
 * đường nào gọi tới (bẫy "cơ chế trang trí", repo dính 17 lần).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { quaManNeuCo } from './helpers/minigame.js';

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

// Trận MẶC ĐỊNH của prod (v27, nav bật) — không ép version nào: bài này canh
// đúng đường người chơi thật đi.
const taoTran = () => json('/api/v1/holdem/matches', { method: 'POST', body: '{}' });
// D525 — khoá mặc định có màn lõi: kết quả vòng (kèm Brier) hiện SAU màn ⇒ qua màn rồi đọc trạng thái thật (`quaManNeuCo`).
const nopVong = async (id: string, vong: number, them: Record<string, unknown> = {}) =>
  quaManNeuCo(pool, id, await json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0,
      cuoc: [], ...them,
    }),
  }), () => json(`/api/v1/holdem/matches/${id}`, { method: 'GET' }));

const demDong = async (matchId: string) =>
  (await pool.query(
    `SELECT value_num::float AS brier, value_json->>'vong' AS vong
       FROM events
      WHERE context_id = $1 AND action_type = 'hd_brier_vong'
      ORDER BY ts`, [matchId],
  )).rows as { brier: number; vong: string }[];

describe('I. ⭐ Engine có CHẠY RA dòng Brier không — qua endpoint thật', () => {
  it('vòng CÓ vị thế ⇒ có dòng, value_num đúng thang 0–2, đúng số vòng', async () => {
    const tao = await taoTran();
    const r1 = await nopVong(tao.match_id, 1, {
      lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }],
    });
    expect(r1.loi_von?.lenh).toBeUndefined();
    await nopVong(tao.match_id, 2);

    const dong = await demDong(tao.match_id);
    expect(dong.length, 'không một dòng nào = INSERT là cơ chế trang trí')
      .toBeGreaterThan(0);
    for (const d of dong) {
      expect(d.brier).toBeGreaterThanOrEqual(0);
      expect(d.brier).toBeLessThanOrEqual(2);
      expect(Number(d.vong)).toBeGreaterThanOrEqual(1);
    }
  });

  /*
   * ⚠ Số dòng khớp SỐ VÒNG CÓ HIỆN BRIER TRÊN MÀN — sổ và màn phải là một.
   * `ket_qua_vong.cua_ban.brier` là thứ người chơi thấy (D67); dòng events là
   * thứ B2B đọc. Lệch nhau là hai nguồn chân lý cho cùng một con số.
   */
  it('màn hiện Brier vòng nào thì sổ có đúng vòng đó', async () => {
    const tao = await taoTran();
    const coBrierTrenMan: number[] = [];
    for (let v = 1; v <= 3; v += 1) {
      const r = await nopVong(tao.match_id, v, v === 1
        ? { lenh: [{ ma: 'vn30', chieu: 'mua', moc_bp: 2500 }] } : {});
      if (typeof r.ket_qua_vong?.cua_ban?.brier === 'number') {
        coBrierTrenMan.push(v);
      }
    }
    const dong = await demDong(tao.match_id);
    expect(dong.map((d) => Number(d.vong))).toEqual(coBrierTrenMan);
  });
});

describe('II. Toàn tiền mặt = KHÔNG dự báo — không dòng, không số 0', () => {
  /*
   * ⚠ D67: trả 0 cho người đứng ngoài là cho người KHÔNG BAO GIỜ vào lệnh điểm
   * hoàn hảo — thước đo ngược hẳn thứ nó đo. Null thì KHÔNG ghi (0035): dòng
   * "không dự báo" là dòng thừa chiếm chỗ vĩnh viễn, và "vòng nào đứng ngoài"
   * đã đọc được từ `hd_cam_ket`.
   */
  it('trận không mở vị thế nào ⇒ 0 dòng hd_brier_vong', async () => {
    const tao = await taoTran();
    await nopVong(tao.match_id, 1);
    await nopVong(tao.match_id, 2);
    expect(await demDong(tao.match_id)).toEqual([]);
  });
});
