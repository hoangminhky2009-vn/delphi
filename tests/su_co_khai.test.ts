/**
 * NHÃN "MẤT LƯỢT VÌ HỆ THỐNG" — `su_co_khai` (D93 2/3, founder chốt 16/08:
 * "dán nhãn, không đổi luật").
 *
 * Bối cảnh: đồng hồ vòng chạy bằng timestamp server, không biết server có sập
 * hay không. Vercel/Supabase chết dài hơn số giây còn lại + ân hạn ⇒ cú nộp
 * đến muộn ⇒ `het_gio` ⇒ vứt body, áp GIỮ NGUYÊN + `tu_dong`. Người chơi mất
 * lượt không phải lỗi họ — nhưng trong `events` nó y hệt một người AFK.
 * ⇒ Client KHAI "vòng này tôi đã gửi hỏng N lần, lỗi cuối là X"; server ghi vào
 * CÙNG dòng log + event, CHỈ khi vòng bị chốt hộ. Tên trường có chữ KHAI cố ý:
 * đây là lời khai của máy người chơi, không phải sự thật server chứng kiến.
 * Khai gian không được gì (lượt vẫn mất) nên không phải cửa gian lận — nhưng
 * server vẫn KHÔNG bịa: rác ⇒ vắng nhãn, không phải nhãn sai.
 *
 * Bốn tính chất khoá:
 *   1. Hết giờ + khai hợp lệ ⇒ log VÀ event cùng mang nhãn (hai chỗ phải khớp —
 *      cùng kỷ luật với `tu_dong` ở holdem_dong_ho_api.test.ts).
 *   2. Đúng giờ + khai ⇒ KHÔNG ghi. Nhãn chỉ có nghĩa khi mất lượt.
 *   3. Hết giờ + khai RÁC ⇒ không ghi, vòng vẫn chốt 200 (không bịa, không chặn).
 *   4. Hết giờ + không khai ⇒ `tu_dong` như cũ, không nhãn — client cũ / AFK.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { DONG_HO, giayChonBai } from '../config/holdem.js';
import { chuanHoaSuCoKhai } from '../server/holdem_api.js';

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

const req = (path: string, init: RequestInit = {}) =>
  app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
const json = async (p: string, i: RequestInit = {}): Promise<any> => (await req(p, i)).json();
// D525 — bài đo HẾT GIỜ chốt hộ theo đồng hồ Alpha Draft cổ điển (v56); khoá mặc định v58 cộng giờ màn vào hạn vòng ⇒ ghim v56.
const taoTran = () => json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v56-congdon' }) });
const nopVong = (id: string, body: unknown) =>
  req(`/api/v1/holdem/matches/${id}/rounds`, { method: 'POST', body: JSON.stringify(body) });
const luiMoc = (matchId: string, giay: number) => pool.query(
  `UPDATE holdem_matches SET vong_mo_luc = now() - make_interval(secs => $2) WHERE match_id = $1`,
  [matchId, giay]);
const docLog = async (matchId: string): Promise<any[]> => (await pool.query(
  `SELECT action_log FROM holdem_matches WHERE match_id = $1`, [matchId])).rows[0].action_log;
const docEvent = async (matchId: string): Promise<any> => (await pool.query(
  `SELECT value_json FROM events WHERE context_id = $1 AND action_type = 'hd_cam_ket'
    ORDER BY ts DESC LIMIT 1`, [matchId])).rows[0].value_json;

const KHAI = { so_lan_hong: 3, loi_cuoi: 'timeout' };
const payload = (vong: number, them: Record<string, unknown> = {}) => ({
  vong, khao_sat_lai: 0, mua: [], hanh_dong: 'giu_vi_the', them: 0, cuoc: [], ...them,
});
// D442 — vòng 1 của bàn mặc định là vòng MỐC CHỢ TRAIT (v55) ⇒ hạn dài thêm `CHON_TRAIT_THEM_S`; đọc cờ `cho_trait` của
// CHÍNH payload (cùng cách `holdem_dong_ho_api`), không gõ tay luật bàn nào có trait.
const quaHan = (t: any) => luiMoc(t.match_id, giayChonBai(1, t.tong_vong)
  + (t.ban?.cho_trait !== undefined ? DONG_HO.CHON_TRAIT_THEM_S : 0) + DONG_HO.AN_HAN_S + 5);

describe('chuanHoaSuCoKhai — thuần', () => {
  it('nhận đúng hình dạng, ép số nguyên, kẹp trần', () => {
    expect(chuanHoaSuCoKhai({ so_lan_hong: 3, loi_cuoi: 'timeout' }))
      .toEqual({ so_lan_hong: 3, loi_cuoi: 'timeout' });
    expect(chuanHoaSuCoKhai({ so_lan_hong: 2.9, loi_cuoi: 'network' }))
      .toEqual({ so_lan_hong: 2, loi_cuoi: 'network' });
    expect(chuanHoaSuCoKhai({ so_lan_hong: 10_000, loi_cuoi: 'server' })!.so_lan_hong)
      .toBeLessThanOrEqual(99);
  });
  it('rác ⇒ undefined (không bịa nhãn): thiếu, âm, 0, không số, loại lạ, không phải object', () => {
    for (const rac of [
      undefined, null, 'timeout', 7, [], {},
      { so_lan_hong: 0, loi_cuoi: 'timeout' },
      { so_lan_hong: -1, loi_cuoi: 'timeout' },
      { so_lan_hong: 'ba', loi_cuoi: 'timeout' },
      { so_lan_hong: 3, loi_cuoi: 'hack' },
      { so_lan_hong: 3 },
      { loi_cuoi: 'timeout' },
    ]) {
      expect(chuanHoaSuCoKhai(rac), JSON.stringify(rac)).toBeUndefined();
    }
  });
});

describe('su_co_khai qua API', () => {
  it('HẾT GIỜ + khai hợp lệ ⇒ log VÀ event cùng mang nhãn, response vẫn tu_dong', async () => {
    const t = await taoTran();
    await quaHan(t);
    const r = await nopVong(t.match_id, payload(1, { su_co_khai: KHAI, them: 500, hanh_dong: 'tang_cam_ket' }));
    expect(r.status).toBe(200);
    expect((await r.json() as any).tu_dong).toBe(true);

    const log = await docLog(t.match_id);
    expect(log[0].tu_dong).toBe(true);
    expect(log[0].su_co_khai, 'dòng log phải mang nhãn').toEqual(KHAI);
    // Nhãn KHÔNG được làm đổi nước đã áp — nó là nhãn, không phải luật.
    expect(log[0].hanh_dong).toBe('giu_vi_the');
    expect(log[0].them).toBe(0);

    const ev = await docEvent(t.match_id);
    expect(ev.tu_dong).toBe(true);
    expect(ev.su_co_khai, 'event phải khớp log — hai chỗ một sự thật').toEqual(KHAI);
  });

  it('ĐÚNG GIỜ + khai ⇒ KHÔNG ghi nhãn (nhãn chỉ có nghĩa khi mất lượt)', async () => {
    const t = await taoTran();
    const r = await nopVong(t.match_id, payload(1, { su_co_khai: KHAI }));
    expect(r.status).toBe(200);
    expect((await r.json() as any).tu_dong).toBe(false);
    const log = await docLog(t.match_id);
    expect(log[0].tu_dong).toBeUndefined();
    expect(log[0].su_co_khai, 'vòng bấm đúng giờ không có nhãn mất lượt').toBeUndefined();
    const ev = await docEvent(t.match_id);
    expect(ev.su_co_khai).toBeUndefined();
  });

  it('HẾT GIỜ + khai RÁC ⇒ vòng vẫn chốt 200, không ghi nhãn (không bịa, không chặn)', async () => {
    const t = await taoTran();
    await quaHan(t);
    const r = await nopVong(t.match_id, payload(1, { su_co_khai: { so_lan_hong: -5, loi_cuoi: 'hack' } }));
    expect(r.status).toBe(200);
    const log = await docLog(t.match_id);
    expect(log[0].tu_dong).toBe(true);
    expect(log[0].su_co_khai).toBeUndefined();
  });

  it('HẾT GIỜ + không khai ⇒ y hệt trước D93: tu_dong, không nhãn (client cũ / AFK)', async () => {
    const t = await taoTran();
    await quaHan(t);
    await nopVong(t.match_id, payload(1));
    const log = await docLog(t.match_id);
    expect(log[0].tu_dong).toBe(true);
    expect('su_co_khai' in log[0], 'vắng mặt, không phải null — trận cũ và trận không sự cố phải giống nhau từng byte').toBe(false);
  });
});
