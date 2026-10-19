/**
 * D527 — BÀN TẬP CHẠY NHỊP XEN KẼ (khoá v58, 6 ô · 5 vòng, founder 05/10 *"T-M-T-M-M"*). Qua HTTP + DB thật — đường chính, không dựng
 * tay: tạo bàn tập ⇒ đúng khoá · cỡ · seed · lịch · vai · quầy ghim; đi hết bàn ⇒ chợ ở 2 · 4, màn sau 2 · 4 · 5, vòng 1 · 3 không màn.
 * Bài khoá dãy ô của seed (lời trợ lý kể theo nó) nằm ở `web/tests/coach_minigame.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { HOLDEM_DECISIONS, NHIP_XEN_KE, laSeedManTap, luatCua, seedManTap, soOManTap } from '../config/holdem.js';

const V58 = 'balance-v58-xenke';

describe('D527 — bàn tập nhịp xen kẽ', () => {
  it('⭐ hằng số: bàn tập ghim v58 · 6 ô · seed riêng (nằm trong danh sách nhận diện bàn tập); khoá cũ vẫn 12 ô', () => {
    // D530 — bàn tập theo luật trận thật (v60): ghim TÍNH CHẤT — nhịp xen kẽ + lõi chỉ trong màn; seed / số ô y như v58.
    const tap = luatCua(HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION);
    expect([tap.nhipXenKe, tap.loiChiTrongMan]).toEqual([true, true]);
    // D545 — khoá v62 (kỳ họp ô 3) đổi seed bàn tập; khoá v58 giữ seed cũ.
    expect(seedManTap(HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION)).toBe(HOLDEM_DECISIONS.MAN_TAP_SEED_KY_HOP);
    expect(laSeedManTap(HOLDEM_DECISIONS.MAN_TAP_SEED_KY_HOP)).toBe(true);
    expect(soOManTap(luatCua(V58))).toBe(6);
    expect(soOManTap(luatCua('balance-v54-ngare'))).toBe(12);
    expect(seedManTap(V58)).toBe(HOLDEM_DECISIONS.MAN_TAP_SEED_XEN_KE);
    expect(laSeedManTap(HOLDEM_DECISIONS.MAN_TAP_SEED_XEN_KE)).toBe(true);
    expect(seedManTap('balance-v54-ngare'), 'bàn tập v54 giữ seed cũ').toBe(HOLDEM_DECISIONS.MAN_TAP_SEED_MAU_BAN);
  });

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
  const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}) =>
    json(`/api/v1/holdem/matches/${id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...them }),
    });

  it('⭐ tạo bàn tập ⇒ v58 · 6 ô · 5 vòng · lịch màn 2·4·5 · người chơi CÁ NHÂN · bàn đủ ba vai đặc biệt · quầy lõi vòng 1 ghim', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ tap: true }) });
    expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
    const row = (await pool.query('SELECT seed, so_o, balance_version FROM holdem_matches WHERE match_id = $1', [t.match_id])).rows[0]!;
    expect(row.balance_version).toBe(HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION);   // D530 — bàn tập theo khoá ghim (nay v60)
    expect(Number(row.so_o)).toBe(6);
    expect(Number(row.seed)).toBe(HOLDEM_DECISIONS.MAN_TAP_SEED_KY_HOP);   // D545
    expect(t.tong_vong).toBe(5);
    expect(t.lich_man).toEqual([...NHIP_XEN_KE[6]!.man]);
    expect(t.ban.vai).toBe('ca_nhan');
    // D542 — bàn tập giấu vai từng ghế như trận thật; đủ ba vai đọc qua `dem_vai`.
    for (const v of ['ca_map', 'to_chuc', 'doi_lai']) expect(t.dem_vai?.[v], `thiếu vai ${v}`).toBeGreaterThan(0);
    expect(t.doi_thu.some((d: { vai?: string }) => d.vai), 'vai từng ghế lộ ở bàn tập').toBe(false);
    expect(t.shop.chien_thuat).toEqual([...HOLDEM_DECISIONS.MAN_TAP_LOI_XEN_KE[1]!]);
  }, 120_000);

  it('⭐ đi hết bàn tập (miễn giờ, không mở màn ⇒ màn coi như xong): chợ đầu vòng 2 · 4, màn sau vòng 2 · 4 · 5', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ tap: true }) });
    const id = t.match_id as string;
    const coMan: number[] = [], coCho: number[] = [];
    let r: any;
    for (let v = 1; v <= 5; v += 1) {
      const g = await json(`/api/v1/holdem/matches/${id}`);
      expect(g.vong, `vòng ${v}`).toBe(v);
      if (g.ban?.cho_trait) coCho.push(v);
      r = await nopVong(id, v, v === 1 ? { mua: ['bat_day'], lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] } : {});
      expect(r.error, `vòng ${v}: ${JSON.stringify(r).slice(0, 200)}`).toBeUndefined();
      if (r.cho_man) coMan.push(v);
    }
    expect(coCho).toEqual([2, 4]);
    expect(coMan).toEqual([2, 4, 5]);
    const g = await json(`/api/v1/holdem/matches/${id}`);
    expect(g.status, 'bàn tập miễn giờ: màn cuối chưa mở ⇒ coi như xong, trận khép').toBe('xong');
  }, 240_000);

  it('vế ngược: ép khoá v54 (vitest · tester) vẫn dựng lại được bàn tập cũ 12 ô trên seed cũ — trận tập v54 còn dở replay nguyên', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ tap: true, ep_balance: 'balance-v54-ngare' }) });
    const row = (await pool.query('SELECT seed, so_o, balance_version FROM holdem_matches WHERE match_id = $1', [t.match_id])).rows[0]!;
    expect([row.balance_version, Number(row.so_o), Number(row.seed)])
      .toEqual(['balance-v54-ngare', 12, HOLDEM_DECISIONS.MAN_TAP_SEED_MAU_BAN]);
  }, 120_000);
});
