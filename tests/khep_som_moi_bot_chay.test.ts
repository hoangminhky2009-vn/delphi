/**
 * D451 — TRẬN KHÉP SỚM KHI MỌI BOT CHÁY: hợp đồng API mà bài tải B1 (`stress.test.ts`) dựa vào.
 *
 * `daKetThuc` khép trận khi qua vòng cuối HOẶC khi chỉ còn ≤ 1 ghế trong trận. Bài B1 cũ nộp mù tới `tong_vong` nên đỏ
 * chập chờn theo seed ngẫu nhiên (đo 28/09: seed 2099466810 ở v56 — ba bot cháy, trận khép sau 11/15 vòng, vòng 12 bị
 * 409 `match_closed`, ghế người chơi còn NAV 8.852). B1 nay dừng khi cú nộp báo `xong`; bài này ghim đúng ca ấy bằng
 * seed ÉP để hợp đồng được canh mỗi lượt, không phụ thuộc xổ số:
 *   · chính cú nộp khép trận trả `xong: true` (không phải vòng sau mới biết);
 *   · khép TRƯỚC `tong_vong` và lúc ấy còn ≤ 1 ghế sống;
 *   · vòng kế bị từ chối SẠCH: 409 `match_closed`, không 5xx, không chạy lố.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

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
  // D415 — admin + `la_tester`: server CHỈ nhận `ep_seed` qua `laTester(actor)`; người thường bị bỏ qua lặng lẽ.
  user = await createTestUser(pool, { role: 'admin' });
  await pool.query(`UPDATE users SET la_tester = true WHERE user_id = $1`, [user.userId]);
}, 120_000);

afterAll(async () => { await db?.stop(); });

const goi = (path: string, init: RequestInit = {}): Promise<Response> => Promise.resolve(app.request(
  `http://localhost${path}`,
  { ...init, headers: { 'content-type': 'application/json', cookie: user.cookie } },
));
const nopVong = (id: string, vong: number): Promise<Response> => goi(`/api/v1/holdem/matches/${id}/rounds`, {
  method: 'POST',
  body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [] }),
});

const SEED_KHEP_SOM = 2099466810;

describe('D451 — trận khép sớm khi mọi bot cháy', () => {
  it('⭐ cú nộp khép trận báo `xong` ngay, trước `tong_vong`, còn ≤ 1 ghế sống; vòng kế 409 match_closed', async () => {
    const t = await (await goi('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v56-congdon', ep_seed: SEED_KHEP_SOM }),
    })).json() as { match_id: string; tong_vong: number };
    expect(t.match_id, JSON.stringify(t).slice(0, 200)).toBeTypeOf('string');
    const { rows: [m] } = await pool.query(
      `SELECT seed::text AS seed, balance_version FROM holdem_matches WHERE match_id = $1`, [t.match_id]);
    expect(m?.seed, 'ep_seed bị bỏ qua — người tạo trận phải là admin + la_tester').toBe(String(SEED_KHEP_SOM));
    expect(m?.balance_version).toBe('balance-v56-congdon');

    let khepO = 0;
    for (let v = 1; v <= t.tong_vong; v += 1) {
      const r = await nopVong(t.match_id, v);
      expect(r.status, `vòng ${v}`).toBe(200);
      if (((await r.json()) as { xong?: boolean }).xong === true) { khepO = v; break; }
    }
    expect(khepO, 'trận phải khép ở một cú nộp có `xong: true`').toBeGreaterThan(0);
    expect(khepO, 'ca này khép SỚM — nếu nó chạy đủ thì seed đã thôi tái hiện ca, cần tìm seed khác').toBeLessThan(t.tong_vong);

    const st = await (await goi(`/api/v1/holdem/matches/${t.match_id}`)).json() as
      { status: string; so_nguoi_song: number };
    expect(st.status).toBe('xong');
    expect(st.so_nguoi_song, 'khép sớm chỉ hợp lệ khi còn ≤ 1 ghế sống').toBeLessThanOrEqual(1);

    const qua = await nopVong(t.match_id, khepO + 1);
    expect(qua.status).toBe(409);
    expect(((await qua.json()) as { error?: string }).error).toBe('match_closed');
  }, 120_000);
});
