/**
 * MIỄN GIỜ — CHỈ Ở MÀN TẬP (founder 16/08 chiều: "chỉ miễn giờ khi chơi hướng
 * dẫn thôi"). File này là CHỐT HỒI QUY cho một luật đã bị BÁC: sáng 16/08 tôi
 * cho hai trận đầu của mọi người không chạy đồng hồ (cột `mien_gio` 0039);
 * founder gạt ngay chiều cùng ngày — thời gian là cần gạt lười nhất, cân bằng
 * cho người mới phải bằng GIẢN LƯỢC, không bằng nới giờ.
 *
 * Giữ file (không xoá) vì hai lẽ: (a) luật cũ đã có bài test rất kỹ, xoá là
 * xoá luôn cửa canh nó KHÔNG quay lại; (b) cột 0039 vẫn tồn tại trên prod với
 * hai trận đã tạo dưới luật cũ — đường ĐỌC phải giữ đúng sự thật của chúng.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { DONG_HO, HOLDEM_DECISIONS } from '../config/holdem.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

const TICK_SECRET = 'tick-secret-miengio';

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: TICK_SECRET, secureCookie: false,
  }) as Hono<any>;
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function req(u: TestUser, path: string, init: RequestInit = {}): Promise<Response> {
  return app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: u.cookie, ...(init.headers ?? {}) },
  });
}
const json = async (u: TestUser, p: string, i: RequestInit = {}): Promise<any> =>
  (await req(u, p, i)).json();
const taoTran = (u: TestUser, body: Record<string, unknown> = {}) =>
  json(u, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify(body) });
const nopVong = (u: TestUser, id: string, vong: number) =>
  req(u, `/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({ vong, hanh_dong: 'giu_vi_the', them: 0, cuoc: [] }),
  });
const luiMoc = (matchId: string, giay: number) => pool.query(
  `UPDATE holdem_matches SET vong_mo_luc = now() - make_interval(secs => $2)
    WHERE match_id = $1`, [matchId, giay]);
const docTran = async (matchId: string) => (await pool.query(
  `SELECT status, mien_gio, action_log FROM holdem_matches WHERE match_id = $1`,
  [matchId])).rows[0];
const QUA_HAN_VONG_S = 60 + DONG_HO.AN_HAN_S + 30;

describe('⭐ LUẬT ĐÃ BÁC: người mới toanh KHÔNG được miễn giờ ở trận thường', () => {
  it('trận đầu tiên của tài khoản mới ⇒ có đồng hồ như mọi người (tam_dung vắng, cột false)', async () => {
    const u = await createTestUser(pool);
    const t = await taoTran(u);
    expect(t.dong_ho.tam_dung, 'không có luật "trận làm quen" — founder bác 16/08').toBeUndefined();
    expect(t.dong_ho.ly_do).toBeUndefined();
    expect((await docTran(t.match_id)).mien_gio).toBe(false);
    const { rows: ev } = await pool.query(
      `SELECT value_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_match_start'`, [t.match_id]);
    expect(ev[0].value_json.mien_gio, 'nhãn giữ khoá, luôn false').toBe(false);
  });

  it('và quá hạn vòng thì BỊ chốt hộ đúng luật D38 — kể cả trận đầu đời', async () => {
    const u = await createTestUser(pool);
    const t = await taoTran(u);
    await luiMoc(t.match_id, QUA_HAN_VONG_S);
    const r = await nopVong(u, t.match_id, 1);
    expect(r.status).toBe(200);
    expect((await r.json() as any).tu_dong).toBe(true);
  });

  it('catalog KHÔNG còn hứa số trận miễn giờ — sảnh không có gì để nói', async () => {
    const u = await createTestUser(pool);
    const cat = await json(u, '/api/v1/holdem/catalog');
    expect(cat.quyet_dinh.MIEN_GIO_DEN_TRAN_XONG).toBeUndefined();
    // Số vòng tạm dừng màn tập (D53) VẪN có — coach đọc để nói đúng "4 vòng".
    expect(cat.quyet_dinh.MAN_TAP_MIEN_GIO_DEN_VONG).toBe(HOLDEM_DECISIONS.MAN_TAP_MIEN_GIO_DEN_VONG);
  });
});

describe('MÀN TẬP giữ nguyên D53: tạm dừng vòng 1–4, vòng 5 chạy giờ — cho MỌI người, kể cả người mới', () => {
  it('người mới toanh vào màn tập ⇒ TẠM DỪNG (ly_do man_tap), qua vòng 4 thì chạy giờ', async () => {
    const u = await createTestUser(pool);
    // D527 — D53 (tạm dừng vòng 1–4, vòng 5 chạy giờ) là luật của bàn tập dài v54; bàn tập v58 chỉ 5 vòng, miễn giờ cả bàn.
    const t = await taoTran(u, { tap: true, ep_balance: 'balance-v54-ngare' });
    expect(t.dong_ho.tam_dung).toBe(true);
    expect(t.dong_ho.ly_do).toBe('man_tap');
    let st = t;
    for (let v = 1; v <= HOLDEM_DECISIONS.MAN_TAP_MIEN_GIO_DEN_VONG; v += 1) {
      st = await (await nopVong(u, t.match_id, v)).json();
    }
    expect(st.dong_ho.tam_dung, 'nửa sau bàn tập chạy giờ thật (D53)').toBeUndefined();
  });
});

describe('CỘT 0039 CÒN ĐÓ — đường đọc giữ đúng sự thật của trận đã ghi true', () => {
  it('trận có mien_gio=true (di sản sáng 16/08) ⇒ vẫn không giờ, ly_do tran_lam_quen — không đổi hành vi giữa chừng', async () => {
    const u = await createTestUser(pool);
    const t = await taoTran(u);
    await pool.query('UPDATE holdem_matches SET mien_gio = true WHERE match_id = $1', [t.match_id]);
    const st = await json(u, `/api/v1/holdem/matches/${t.match_id}`);
    expect(st.dong_ho.tam_dung).toBe(true);
    expect(st.dong_ho.ly_do).toBe('tran_lam_quen');
    await luiMoc(t.match_id, QUA_HAN_VONG_S);
    const r = await nopVong(u, t.match_id, 1);
    expect((await r.json() as any).tu_dong, 'trận di sản không bị chốt hộ').toBe(false);
  });
});
