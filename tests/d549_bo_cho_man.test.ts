/**
 * D549 — BÀN TOÀN MÁY, NGƯỜI CHƠI KHÔNG CÓ MÀN RIÊNG ⇒ CHỐT XONG SANG VÒNG SAU NGAY (founder 07/10: *"cái chốt xong bị kẹt trong khi bàn toàn
 * bot thì vô lý quá"*). Trước đây: chốt vòng có màn mà không cầm mã ⇒ server đặt `cho_man` ~49 s (lịch chung của màn) dù không ai cần màn.
 * Qua HTTP + DB thật (đường chính):
 *   ⭐ không cầm mã ⇒ `het_ms` 0, hỏi lại ngay là vòng 2, đồng hồ vòng 2 còn đủ phần QUYẾT
 *   ⭐ vế ngược: cầm mã (có màn riêng) ⇒ vẫn chờ màn như cũ
 *   kết quả trận không đổi: vòng 2 sau khi bỏ chờ = vòng 2 sau khi chờ hết giờ (cùng seed, cùng nước đi)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { giayManMinigame, HOLDEM_BALANCE_VERSION } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';

describe('D549 — bàn toàn máy không bắt chờ màn khi người chơi không có màn', () => {
  let db: TestDb;
  let pool: pg.Pool;
  let app: Hono<any>;
  let user: TestUser;
  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
    app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
    user = await createTestUser(pool);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });

  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  })).json();
  const tao = () => json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({}) });
  const nop1 = (id: string, them: Record<string, unknown> = {}) => json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...them }),
  });

  it('⭐ không cầm mã ⇒ không chờ: `het_ms` 0 · hỏi lại là vòng 2 · đồng hồ vòng 2 còn đủ phần QUYẾT', async () => {
    const t = await tao();
    expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
    expect(t.doi_thu.every((d: { loai: string }) => d.loai !== 'nguoi'), 'bàn mặc định toàn máy').toBe(true);
    expect(t.lich_man, 'vòng 1 có màn').toContain(1);
    const r = await nop1(t.match_id);
    expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
    expect(r.cho_man?.het_ms, 'không ai cần màn ⇒ hết ngay').toBe(0);
    const s = await json(`/api/v1/holdem/matches/${t.match_id}`);
    expect(s.vong).toBe(2);
    expect(s.cho_man).toBeUndefined();
    // Mốc mở vòng lùi đúng một màn ⇒ hạn vòng 2 (gồm phần màn của vòng 1) tính từ bây giờ chỉ còn phần QUYẾT.
    const moc = new Date((await pool.query('SELECT vong_mo_luc FROM holdem_matches WHERE match_id = $1', [t.match_id])).rows[0]!.vong_mo_luc).getTime();
    expect(Math.abs(Date.now() - moc - giayManMinigame(luatCua(HOLDEM_BALANCE_VERSION).loiChonTruoc === true) * 1000)).toBeLessThan(5000);   // D561 — v65 bỏ pha chọn lá
  }, 120_000);

  it('⭐ vế ngược: cầm mã (có màn riêng) ⇒ vẫn chờ màn của lịch chung', async () => {
    let id = '', r: any;
    for (let lan = 0; lan < 6 && !id; lan += 1) {
      const t = await tao();
      r = await nop1(t.match_id, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] });
      if (!r.error && (r.cho_man?.het_ms ?? 0) > 0) id = t.match_id;
    }
    expect(id, `cầm BTC mà không có màn: ${JSON.stringify(r).slice(0, 200)}`).not.toBe('');
    expect(r.cho_man.het_ms).toBeGreaterThan(30_000);
    expect((await json(`/api/v1/holdem/matches/${id}`)).vong, 'còn đang chờ màn').toBe(1);
  }, 120_000);

  it('kết quả không đổi: vòng 2 lúc bỏ chờ = vòng 2 khi như đã chờ đủ (bỏ chờ chỉ đổi giờ tường, không vào replay)', async () => {
    const a = await tao();
    await nop1(a.match_id);
    const truoc = await json(`/api/v1/holdem/matches/${a.match_id}`);
    await pool.query(`UPDATE holdem_matches SET vong_mo_luc = vong_mo_luc - interval '60 seconds' WHERE match_id = $1`, [a.match_id]);
    const sau = await json(`/api/v1/holdem/matches/${a.match_id}`);
    expect(sau.vong).toBe(2);
    expect(sau.ban.von).toBe(truoc.ban.von);
    expect(sau.ban.vi_the).toEqual(truoc.ban.vi_the);
    expect(sau.doi_thu).toEqual(truoc.doi_thu);
    expect(sau.lich_su_o).toEqual(truoc.lich_su_o);
  }, 120_000);
});
