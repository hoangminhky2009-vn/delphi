/**
 * D609 (founder 13/10: "chọn lõi là bắt buộc, không pick thì server pick hộ") — HẾT GIỜ ở LƯỢT LÕI mà ghế người chưa đủ lõi ⇒ server chọn hộ lá đầu quầy.
 *
 *   §I  trận khung minigame (cờ `loi_chon_truoc`): hết giờ vòng 1 (lượt lõi) ⇒ có ĐÚNG một lõi, dòng log + dòng event mang `loi_tu_chon`.
 *   §II vế ngược: người chơi TỰ nộp vòng 1 không mua gì ⇒ vẫn không lõi, không cờ (server không đoán ý người đang cầm lái);
 *       khoá không có cờ (v53) hết giờ ⇒ body rỗng như cũ, không cờ (replay trận cũ không đổi).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-loi-ho', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

const req = (path: string, init: RequestInit = {}) => app.request(`http://localhost${path}`, {
  ...init, headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
});
const json = async (p: string, i: RequestInit = {}): Promise<any> => (await req(p, i)).json();
const taoTran = (epBalance?: string) => json('/api/v1/holdem/matches', {
  method: 'POST', body: JSON.stringify(epBalance ? { ep_balance: epBalance } : {}),
});
const nopVong = (id: string, body: unknown) =>
  req(`/api/v1/holdem/matches/${id}/rounds`, { method: 'POST', body: JSON.stringify(body) });
/** Lùi mốc mở vòng quá cả hạn vòng lẫn ân hạn ⇒ server tuyên hết giờ (`qua_han_vong`). */
const luiMoc = (id: string, giay: number) => pool.query(
  `UPDATE holdem_matches SET vong_mo_luc = now() - make_interval(secs => $2) WHERE match_id = $1`, [id, giay]);
const docLog = async (id: string): Promise<any[]> => (await pool.query(
  `SELECT action_log FROM holdem_matches WHERE match_id = $1`, [id])).rows[0].action_log;
const bodyRong = (vong: number) => ({ vong, khao_sat_lai: 0, mua: [], hanh_dong: 'giu_vi_the', them: 0, cuoc: [] });
const docEvent = async (id: string): Promise<any[]> => (await pool.query(
  `SELECT value_json FROM events WHERE context_id = $1 AND action_type = 'hd_cam_ket' ORDER BY event_id`, [id])).rows.map((r) => r.value_json);

describe('I. hết giờ ở lượt lõi — server chọn hộ', () => {
  it('⭐ trận mặc định (cờ loi_chon_truoc): hết giờ vòng 1 ⇒ ĐÚNG một lõi trong danh mục, log + event mang loi_tu_chon, tu_dong vẫn có', async () => {
    const t = await taoTran();
    expect(t.loi_chon_truoc, 'bài này cần khoá mặc định có cờ lõi chọn lúc chốt').toBe(true);
    const quay = t.shop.chien_thuat as string[];
    expect(quay.length, 'vòng 1 phải là lượt lõi — quầy có lá').toBeGreaterThan(0);
    await luiMoc(t.match_id, 300);
    const r = await nopVong(t.match_id, { ...bodyRong(1), tu_dong: true });
    expect(r.status, await r.clone().text()).toBe(200);
    const body = await r.json() as any;
    expect(body.tu_dong).toBe(true);
    const dong = (await docLog(t.match_id))[0];
    expect(dong.tu_dong).toBe(true);
    expect(dong.loi_tu_chon).toBe(true);
    expect(dong.mua, 'đúng lá đầu quầy người chơi đang thấy').toEqual([quay[0]]);
    expect(dong.loi_man).toBe(quay[0]);
    // Phản hồi của cú nộp là trạng thái TRƯỚC chốt (màn minigame chờ) ⇒ đọc danh mục qua replay của chính trận: lá chọn hộ phải THẬT SỰ vào ví.
    const sau = await json(`/api/v1/holdem/matches/${t.match_id}`);
    expect(sau.ban.danh_muc.chien_thuat ?? []).toContain(quay[0]);
    const ev = (await docEvent(t.match_id))[0];
    expect(ev.loi_tu_chon).toBe(true);
    expect(ev.mua).toEqual([quay[0]]);
    expect(ev.tu_dong).toBe(true);
  });

  it('vế ngược: người chơi TỰ nộp vòng 1 không mua gì ⇒ không lõi, không cờ — server không đoán ý người đang cầm lái', async () => {
    const t = await taoTran();
    const r = await nopVong(t.match_id, bodyRong(1));
    expect(r.status).toBe(200);
    const body = await r.json() as any;
    const dong = (await docLog(t.match_id))[0];
    expect(dong.loi_tu_chon).toBeUndefined();
    expect(dong.tu_dong).toBeUndefined();
    expect(body.ban.danh_muc.chien_thuat).toEqual([]);
    expect((await docEvent(t.match_id))[0].loi_tu_chon).toBeUndefined();
  });

  it('vế ngược: khoá cũ không có cờ (v53) hết giờ ⇒ body rỗng như cũ, không cờ loi_tu_chon (replay trận cũ không đổi)', async () => {
    const t = await taoTran('balance-v53-upo');
    expect(t.loi_chon_truoc).toBeUndefined();
    await luiMoc(t.match_id, 300);
    const r = await nopVong(t.match_id, { ...bodyRong(1), tu_dong: true });
    expect(r.status).toBe(200);
    const dong = (await docLog(t.match_id))[0];
    expect(dong.tu_dong).toBe(true);
    expect(dong.loi_tu_chon).toBeUndefined();
    expect(dong.mua).toEqual([]);
  });
});
