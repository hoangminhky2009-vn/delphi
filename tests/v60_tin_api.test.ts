/**
 * D532 — tin trong màn + MUA TIN SỚM qua HTTP + DB thật: bối cảnh màn GHI dòng tin · đầu màn báo giá mua tin (lá Lướt Sóng) · cú `mua_tin` trước
 * màn ⇒ danh sách tin THẬT (ID chữ, không chữ) · mua lần hai 409 · lá khác 403 · trước khi màn chạy dòng nhịp không lộ tin nào.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

describe('D532 — tin trong màn qua HTTP + DB', () => {
  let db: TestDb; let pool: pg.Pool; let app: Hono<any>; let tester: TestUser;
  beforeAll(async () => {
    db = await startTestDb(); pool = db.pool;
    app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
    tester = await createTestUser(pool, { role: 'admin' });
    await pool.query('UPDATE users SET la_tester = true WHERE user_id = $1', [tester.userId]);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });
  const req = (path: string, init: RequestInit = {}) => app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie: tester.cookie, ...(init.headers ?? {}) },
  });
  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await req(path, init)).json();
  /** Tạo trận Cá nhân có quầy bày lõi `loi`, mua lõi đó ở vòng 1 (+ BTC 50 %), mở màn vòng 1. */
  const moMan = async (loi: string) => {
    for (let lan = 0; lan < 40; lan++) {
      const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_vai: 'ca_nhan' }) });
      const sh = await json(`/api/v1/holdem/matches/${t.match_id}/shop?lan=0`);
      if (!(sh.shop?.chien_thuat ?? []).includes(loi)) continue;
      const r = await json(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
        method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: [loi], hanh_dong: 'giu_vi_the', them: 0, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] }),
      });
      expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
      const mo = await req(`/api/v1/holdem/matches/${t.match_id}/minigame`, { method: 'POST', body: JSON.stringify({ vong: 1 }) });
      expect(mo.status, await mo.clone().text()).toBe(200);
      return { id: t.match_id as string, dau: await mo.json() as any };
    }
    throw new Error(`40 trận không quầy nào bày ${loi}`);
  };
  const lenh = (id: string, body: object) => req(`/api/v1/holdem/matches/${id}/minigame/1/lenh`, { method: 'POST', body: JSON.stringify(body) });

  it('⭐ Lướt Sóng: bối cảnh ghi dòng tin · đầu màn báo giá · mua ⇒ danh sách tin thật · mua lần hai 409 · trước màn chạy không lộ tin', async () => {
    const { id, dau } = await moMan('luot_song');
    const bc = (await pool.query(`SELECT boi_canh FROM holdem_minigame_man WHERE match_id = $1 AND vong = 1`, [id])).rows[0]!.boi_canh;
    expect(Array.isArray(bc.tin) && bc.tin.length >= 3, 'bối cảnh ghi dòng tin').toBe(true);
    expect(dau.tin_mua).toMatchObject({ da_mua: false });
    expect(dau.tin_mua.phi).toBe(Math.floor((dau.von * 200) / 10000));
    expect(dau.tin_that, 'chưa mua thì không thấy tin thật').toBeUndefined();
    const r = await lenh(id, { nhip: -1, nut: 'mua_tin', khoa: 'mt1' });
    expect(r.status, await r.clone().text()).toBe(200);
    const b = await r.json() as any;
    expect(b.tin_mua.da_mua).toBe(true);
    expect(Array.isArray(b.tin_that)).toBe(true);
    for (const t of b.tin_that) { expect(typeof t.chu).toBe('string'); expect(t.that, 'không gửi trường thừa').toBeUndefined(); }
    expect(bc.tin.filter((t: any) => t.that).length + (bc.tin.some((t: any) => t.congBo) ? 0 : 0)).toBeGreaterThanOrEqual(b.tin_that.length);
    const lai = await lenh(id, { nhip: -1, nut: 'mua_tin', khoa: 'mt2' });
    expect(lai.status).toBe(409);
    expect((await lai.json() as any).error).toBe('da_mua_tin');
    const ml = await json(`/api/v1/holdem/matches/${id}/minigame/1/nhip?tu=0&mot_lan=1`);
    expect(ml.lo?.tin, 'màn chưa chạy ⇒ không tin nào lộ').toBeUndefined();
  }, 600_000);

  it('lá khác (Đòn Bẩy) ⇒ 403 `khong_mua_tin`; đầu màn không báo giá mua tin', async () => {
    const { id, dau } = await moMan('don_bay');
    expect(dau.tin_mua).toBeUndefined();
    const r = await lenh(id, { nhip: -1, nut: 'mua_tin', khoa: 'x1' });
    expect(r.status).toBe(403);
    expect((await r.json() as any).error).toBe('khong_mua_tin');
  }, 600_000);
});
