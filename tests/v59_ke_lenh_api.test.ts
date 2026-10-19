/**
 * D528 — khoá v59 qua HTTP + DB thật: cửa lệnh nhận KÊ LỆNH (trait KÊ MUA / KÊ BÁN; Tổ Chức mang sẵn) · đầu màn khai trait · sổ trả lệnh kê ·
 * VAI GHẾ KHÁC BỊ GIẤU (chỉ còn cờ `vai_an`) — v58 vẫn lộ vai.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { HOLDEM_BALANCE_VERSION } from '../config/holdem.js';
import { luatCua } from '../config/holdem_balance.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

describe('D528 — kê lệnh + giấu vai qua HTTP + DB', () => {
  let db: TestDb; let pool: pg.Pool; let app: Hono<any>; let tester: TestUser;
  beforeAll(async () => {
    db = await startTestDb(); pool = db.pool;
    app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
    tester = await createTestUser(pool, { role: 'admin' });
    await pool.query('UPDATE users SET la_tester = true WHERE user_id = $1', [tester.userId]);   // ep_vai chỉ mở cho admin + tester
  }, 120_000);
  afterAll(async () => { await db?.stop(); });
  const req = (path: string, init: RequestInit = {}) => app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie: tester.cookie, ...(init.headers ?? {}) },
  });
  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await req(path, init)).json();
  const lenh = (id: string, body: Record<string, unknown>) => req(`/api/v1/holdem/matches/${id}/minigame/1/lenh`, { method: 'POST', body: JSON.stringify(body) });
  /** Tạo trận vai `vai` (Tổ Chức: mỗi mã ≤ 40 % NAV ⇒ mốc 25 %), nộp vòng 1 (mua Crypto) rồi mở màn vòng 1 — màn còn trong pha lật thẻ / chọn lá ⇒ lệnh kê ghi nhịp −1. */
  const moManVong1 = async (vai: string, khoa?: string) => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_vai: vai, ...(khoa ? { ep_balance: khoa } : {}) }) });
    expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
    const r = await json(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: vai === 'to_chuc' ? 2500 : 5000 }] }),
    });
    expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
    expect(r.cho_man?.vong, 'nhịp xen kẽ: vòng 1 có màn').toBe(1);
    const mo = await req(`/api/v1/holdem/matches/${t.match_id}/minigame`, { method: 'POST', body: JSON.stringify({ vong: 1 }) });
    expect(mo.status, await mo.clone().text()).toBe(200);
    return { t, dau: await mo.json() as any };
  };

  it('mặc định mang kê lệnh (v59 trở đi — ghim tính chất)', () => { expect(luatCua(HOLDEM_BALANCE_VERSION).keLenhV59).toBe(true); });

  it('⭐ Tổ Chức mang sẵn KÊ MUA + KÊ BÁN: đầu màn khai trait; lệnh sai phía 409; lệnh đúng vào sổ (nhịp −1); huỷ ⇒ sổ báo huỷ', async () => {
    const { t, dau } = await moManVong1('to_chuc');
    expect(dau.ke_trait).toEqual({ mua: true, ban: true });
    expect(dau.tran_thua_giu, 'Tổ Chức: trần thua áp khoản giữ').toBe(true);
    const sai = await lenh(t.match_id, { nhip: -1, nut: 'ke_mua', gia_bp: 500, khoa: 'k1' });
    expect(sai.status).toBe(409);
    expect((await sai.json() as any).error).toBe('ke_sai_phia');
    const rac = await lenh(t.match_id, { nhip: -1, nut: 'ke_mua', gia_bp: 99999, khoa: 'k2' });
    expect(rac.status, 'giá rác').toBe(400);
    const dung = await lenh(t.match_id, { nhip: -1, nut: 'ke_mua', gia_bp: -800, khoa: 'k3' });
    expect(dung.status, await dung.clone().text()).toBe(200);
    const so = (await dung.json() as any).so;
    expect(so.ke.mua).toMatchObject({ gia_bp: -800, khop: null, huy: null });
    const ban = await (await lenh(t.match_id, { nhip: -1, nut: 'ke_ban', gia_bp: 600, khoa: 'k4' })).json() as any;
    expect(ban.so.ke.ban).toMatchObject({ gia_bp: 600, khop: null });
    const huy = await (await lenh(t.match_id, { nhip: -1, nut: 'ke_huy_mua', khoa: 'k5' })).json() as any;
    expect(huy.so.ke.mua.huy).toBe('nguoi_huy');
    const ghi = await pool.query(`SELECT lenh FROM holdem_minigame_man WHERE match_id = $1 AND vong = 1`, [t.match_id]);
    const ds = ghi.rows[0]!.lenh as any[];
    expect(ds.find((x) => x.nut === 'ke_mua' && x.gia_bp === -800)?.nhip, 'trong pha trước màn ghi nhịp −1').toBe(-1);
  }, 300_000);

  it('⭐ Cá nhân không mang trait ⇒ 403 `khong_ke`; vai ghế khác bị GIẤU (cờ `vai_an`, không có `vai`)', async () => {
    const { t, dau } = await moManVong1('ca_nhan');
    expect(dau.ke_trait).toBeUndefined();
    const r = await lenh(t.match_id, { nhip: -1, nut: 'ke_mua', gia_bp: -800, khoa: 'c1' });
    expect(r.status).toBe(403);
    expect((await r.json() as any).error).toBe('khong_ke');
    const doiThu = t.doi_thu as any[];
    expect(doiThu.length).toBeGreaterThan(0);
    expect(doiThu.some((d) => d.vai_an === true), 'có ghế mang vai mà bị giấu').toBe(true);
    expect(doiThu.every((d) => d.vai === undefined), 'không ghế nào lộ vai').toBe(true);
  }, 300_000);

  it('v58 (khoá cũ) vẫn lộ vai ghế khác', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v58-xenke' }) });
    expect((t.doi_thu as any[]).some((d) => typeof d.vai === 'string')).toBe(true);
    expect((t.doi_thu as any[]).every((d) => d.vai_an === undefined)).toBe(true);
  }, 120_000);
});
