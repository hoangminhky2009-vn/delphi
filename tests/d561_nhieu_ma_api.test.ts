/**
 * D561 — đánh màn nhiều mã qua HTTP + DB thật (khoá v65): mở màn khai mọi mã có màn · khung nhìn `?ma=` trả đúng màn con (vốn = cả khoản, bảng phụ
 * gồm mã chính) · cửa lệnh nhận `ma`, từ chối mã lạ và việc-của-cả-màn trên mã phụ. Khoá v64 ⇒ một mã như cũ.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

describe('D561 — nhiều mã qua HTTP + DB', () => {
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
  const moMan = async (khoa: string) => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_vai: 'ca_nhan', ep_balance: khoa }) });
    expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
    const r = await json(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0,
        lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }, { ma: 'vang', chieu: 'mua', moc_bp: 2500 }] }),
    });
    expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
    expect(r.cho_man?.vong).toBe(1);
    const mo = await req(`/api/v1/holdem/matches/${t.match_id}/minigame`, { method: 'POST', body: JSON.stringify({ vong: 1 }) });
    expect(mo.status, await mo.clone().text()).toBe(200);
    return { id: t.match_id as string, dau: await mo.json() as any };
  };
  const lenh = (id: string, body: Record<string, unknown>) => req(`/api/v1/holdem/matches/${id}/minigame/1/lenh`, { method: 'POST', body: JSON.stringify(body) });

  it('⭐ khoá v65: đầu màn khai hai mã; `?ma=vang` là màn con vốn = cả khoản Vàng, bảng phụ là BTC; lệnh mã lạ / chọn lá trên mã phụ ⇒ 400', async () => {
    const { id, dau } = await moMan('balance-v65-thangkynang');
    expect(dau.ma).toBe('btc');
    expect(dau.nhieu_ma).toEqual(['btc', 'vang']);
    expect(dau.phu).toEqual(['vang']);
    const mv = await req(`/api/v1/holdem/matches/${id}/minigame?ma=vang`, { method: 'POST', body: JSON.stringify({ vong: 1 }) });
    const v = await mv.json() as any;
    expect(v.ma).toBe('vang');
    expect(v.phu).toEqual(['btc']);
    const row = await pool.query('SELECT boi_canh FROM holdem_minigame_man WHERE match_id = $1 AND vong = 1', [id]);
    const bc = row.rows[0]!.boi_canh as any;
    expect(bc.nhieu.map((x: any) => x.ma)).toEqual(['vang']);
    expect(v.von).toBe(bc.nhieu[0].von);
    expect(Object.keys(bc.nap_tu ?? {}).filter((x) => x !== 'tien')).toEqual([]);
    const mot = await json(`/api/v1/holdem/matches/${id}/minigame/1/nhip?mot_lan=1&ma=vang`);
    expect(mot.dau.ma).toBe('vang');
    const la = await lenh(id, { nhip: -1, nut: 'la_bat_day', ma: 'vang', khoa: 'a1' });
    expect(la.status).toBe(400);
    const lag = await lenh(id, { nhip: 0, nut: 'vao_het', ma: 'usd', khoa: 'a2' });
    expect(lag.status).toBe(400);
    expect((await lag.json() as any).error).toBe('ma_sai');
  }, 300_000);

  it('khoá v64: một mã, bảng phụ tương quan như cũ; `?ma=vang` ⇒ 400', async () => {
    const { id, dau } = await moMan('balance-v64-congoi');
    expect(dau.nhieu_ma).toBeUndefined();
    const mv = await req(`/api/v1/holdem/matches/${id}/minigame?ma=vang`, { method: 'POST', body: JSON.stringify({ vong: 1 }) });
    expect(mv.status).toBe(400);
  }, 300_000);
  it('⭐ úp lá pha: khoá v65 — chờ màn của ô PHA chỉ nói "lá úp" (không mặt lá); khoá v64 lộ mặt lá như cũ', async () => {
    const thu = async (khoa: string) => {
      for (let i = 0; i < 12; i++) {
        const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_vai: 'ca_nhan', ep_balance: khoa }) });
        const r = await json(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
          method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] }),
        });
        const o = r.cho_man?.o;
        if (o?.kind === 'giai_doan') return { o, st: await json(`/api/v1/holdem/matches/${t.match_id}`) };
      }
      throw new Error('12 trận không gặp ô pha ở vòng 1');
    };
    const moi = await thu('balance-v65-thangkynang');
    expect(moi.o).toEqual({ kind: 'giai_doan', up: true });
    expect(moi.st.cho_man?.o).toEqual({ kind: 'giai_doan', up: true });
    const cu = await thu('balance-v64-congoi');
    expect(typeof cu.o.giai_doan).toBe('string');
  }, 300_000);
});
