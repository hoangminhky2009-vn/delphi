/**
 * ĐƯỜNG VỀ TRẬN ĐANG DỞ — `GET /holdem/me/matches` (D93 3/3, founder 16/08).
 *
 * Endpoint tồn tại từ lâu, client nối từ 11/08 (99c61be) — nhưng tới 16/08 chưa
 * có MỘT bài test nào cho nó, và nó chỉ trả `status`. Bộ quét (tick) chạy mỗi
 * phút và chỉ khi cron-job.org sống: giữa hai tick, một trận quá 45' vẫn
 * `dang_choi` trong DB ⇒ sảnh mời "TIẾP TỤC" một bàn mà cú bấm đầu ăn 409
 * `qua_han_tran` (nợ D78). Nay endpoint khai `tiep_duoc` bằng CHÍNH `tranHetHan`
 * của bộ quét — một nguồn, sảnh và bàn không bao giờ nói ngược nhau.
 *
 * Ba tính chất:
 *   1. Trận vừa tạo ⇒ dang_choi + tiep_duoc = true.
 *   2. Lùi `vong_mo_luc` quá hạn ⇒ tiep_duoc = false NGAY, dù status còn dang_choi
 *      (chưa tick nào quét) — đây là ca chính.
 *   3. Sau tick ⇒ status = bo_dở, tiep_duoc = false — hai đường ra cùng kết luận.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { DONG_HO } from '../config/holdem.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;
const TICK = 'tick-dangdo';

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    secureCookie: false, tickSecret: TICK,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);
afterAll(async () => { await db?.stop(); });

const req = (path: string, init: RequestInit = {}) =>
  app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
const json = async (p: string, i: RequestInit = {}): Promise<any> => (await req(p, i)).json();
const taoTran = () => json('/api/v1/holdem/matches', { method: 'POST' });
const cuaToi = async () => (await json('/api/v1/holdem/me/matches')).tran as any[];
const luiMoc = (matchId: string, phut: number) => pool.query(
  `UPDATE holdem_matches SET vong_mo_luc = now() - make_interval(mins => $2) WHERE match_id = $1`,
  [matchId, phut]);
const tick = () => req('/api/v1/internal/tick', { method: 'POST', headers: { 'x-tick-secret': TICK } });

describe('GET /holdem/me/matches — tiep_duoc', () => {
  it('trận vừa tạo ⇒ dang_choi + tiep_duoc, đúng vòng', async () => {
    const t = await taoTran();
    const r = (await cuaToi()).find((x) => x.match_id === t.match_id);
    expect(r).toBeTruthy();
    expect(r.status).toBe('dang_choi');
    expect(r.tiep_duoc).toBe(true);
    expect(r.vong_hien_tai).toBe(1);
  });

  it('⭐ quá hạn nhưng CHƯA tick ⇒ status vẫn dang_choi mà tiep_duoc = false (sảnh không mời bàn chết)', async () => {
    const t = await taoTran();
    await luiMoc(t.match_id, DONG_HO.HAN_TRAN_PHUT + 1);
    const r = (await cuaToi()).find((x) => x.match_id === t.match_id);
    expect(r.status, 'chưa tick nào quét — DB còn ghi dang_choi').toBe('dang_choi');
    expect(r.tiep_duoc,
      'sảnh dựa vào status sẽ mời TIẾP TỤC một bàn mà cú bấm đầu ăn 409 — nợ D78')
      .toBe(false);
  });

  it('sau tick ⇒ bo_dở + tiep_duoc = false — hai đường ra cùng kết luận', async () => {
    const t = await taoTran();
    await luiMoc(t.match_id, DONG_HO.HAN_TRAN_PHUT + 1);
    expect((await tick()).status).toBe(200);
    const r = (await cuaToi()).find((x) => x.match_id === t.match_id);
    expect(r.status).toBe('bo_dở');
    expect(r.tiep_duoc).toBe(false);
  });

  it('chỉ thấy trận CỦA MÌNH', async () => {
    const khac = await createTestUser(pool);
    const tKhac = await (await app.request('http://localhost/api/v1/holdem/matches', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: khac.cookie },
    })).json() as any;
    expect((await cuaToi()).some((x) => x.match_id === tKhac.match_id)).toBe(false);
  });
});
