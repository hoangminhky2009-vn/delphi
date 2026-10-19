/**
 * D550 — TRẬN THẬT 14 Ô (khoá v63 `ban14`; founder 07/10: *"Làm 14 ô đi"* · nhịp DÀY *"Nhiều trait hơn đi. Như kiểu chiến thuật eco trong TFT ấy"*).
 * 14 ô · 13 vòng (`o_up`), kỳ họp ô 4 · 9, sau mỗi lần chốt MỘT chặng theo `NHIP_XEN_KE[14]`: chín màn · năm chợ trait · lõi 1 · 5 · 10.
 * §I bảng + hàm thuần · §II qua HTTP + DB thật (đường chính: trận mặc định, đi hết 13 vòng).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import {
  HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, LICH_CHINH_SACH, NHIP_XEN_KE, coManMinigame, giayChonBai, giayManMinigame, luatCua, vongChonChienThuat,
} from '../config/holdem.js';
import { BO_LUAT_THEO_PHIEN_BAN } from '../config/holdem_balance.js';
import { CO_BAN_14, CO_BAN_XEN_KE, coBanGhim } from '../config/luoc_bo.js';
import { laMocTrait } from '../server/holdem/trait.js';
import { themGiayTrait } from '../server/holdem/dong_ho.js';

const V63 = 'balance-v63-ban14';
const V62 = 'balance-v62-kyhoptap';
const LICH = NHIP_XEN_KE[14]!;

describe('§I — bảng nhịp 14 ô + hàm thuần', () => {
  it('⭐ v63 khác v62 ĐÚNG một cờ MỚI `ban14`; là mặc định trận thật; bàn tập giữ v62', () => {
    const a = BO_LUAT_THEO_PHIEN_BAN[V62]! as unknown as Record<string, unknown>;
    const b = BO_LUAT_THEO_PHIEN_BAN[V63]! as unknown as Record<string, unknown>;
    const khac = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();
    expect(khac).toEqual(['ban14']);
    // D560 — mặc định đi tiếp v63 → v64; ghim TÍNH CHẤT (trận thật vẫn bàn 14), không ghim tên khoá.
    expect(luatCua(HOLDEM_BALANCE_VERSION).ban14).toBe(true);
    expect(HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION).toBe(V62);
  });

  it('⭐ `coBanGhim`: v63 ⇒ 14 (đứng trước nhịp xen kẽ); v62 vẫn 8', () => {
    expect(coBanGhim(luatCua(V63))).toBe(CO_BAN_14);
    expect(CO_BAN_14).toBe(14);
    expect(coBanGhim(luatCua(V62))).toBe(CO_BAN_XEN_KE);
  });

  it('⭐ 13 vòng: sau MỖI lần chốt đúng một chặng (vòng 1: màn + chợ), kết bằng màn; năm chợ, chín màn, lõi đi kèm chợ ở 5 · 10', () => {
    for (let v = 1; v <= 13; v += 1) {
      const chang = Number(LICH.man.includes(v)) + Number(LICH.trait.includes(v + 1));
      expect(chang, `vòng ${v}`).toBe(v === 1 ? 2 : 1);
    }
    expect(LICH.man.at(-1)).toBe(13);
    expect(LICH.trait).toHaveLength(5);
    expect(LICH.man).toHaveLength(9);
    expect(LICH.loi).toEqual([1, 5, 10]);
    for (const v of LICH.loi.slice(1)) expect(LICH.trait, `lõi vòng ${v} đi kèm chợ`).toContain(v);
    expect(vongChonChienThuat(14, false, true, true)).toEqual([1, 5, 10]);
  });

  it('⭐ kỳ họp ô 4 · 9, và màn chạy ĐÚNG ô kỳ họp (màn sau chốt vòng v chơi ô v + 1)', () => {
    expect(LICH_CHINH_SACH.O_THEO_MAP[14]).toEqual([4, 9]);
    for (const o of LICH_CHINH_SACH.O_THEO_MAP[14]!) expect(LICH.man, `màn ở ô kỳ họp ${o}`).toContain(o - 1);
  });

  it('đồng hồ: chợ 45 s ở năm vòng mở chợ; tối đa cả trận ≤ 17 phút', () => {
    const st = { trait_bat: true, dong_ho_minigame: true, nhip_xen_ke: true, map: { o: Array(14).fill(0) } };
    expect([...Array(13).keys()].map((i) => i + 1).filter((v) => laMocTrait(v, 14, st))).toEqual([...LICH.trait]);
    let tong = 0;
    for (let v = 1; v <= 13; v += 1) tong += giayChonBai(v, 14, false, true, true) + themGiayTrait(st, v);
    tong += giayManMinigame();   // màn cuối
    expect(coManMinigame(13, 14, true)).toBe(true);
    expect(tong).toBeLessThanOrEqual(17 * 60);
    expect(tong).toBeGreaterThan(14 * 60);
  });
});

describe('§II — qua HTTP + DB thật', () => {
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

  const req = (path: string, init: RequestInit = {}) => app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await req(path, init)).json();
  const post = (path: string, body: unknown) => req(path, { method: 'POST', body: JSON.stringify(body) });
  const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}) =>
    json(`/api/v1/holdem/matches/${id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...them }),
    });
  const quaMan = (id: string) => pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '60 seconds' WHERE match_id = $1`, [id]);
  const luiMan = async (id: string, vong: number) => {
    const r = await pool.query('DELETE FROM holdem_minigame_man WHERE match_id = $1 AND vong = $2 RETURNING boi_canh, phien_ban', [id, vong]);
    await pool.query(
      `INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau) VALUES ($1, $2, $3, $4, now() - interval '60 seconds')`,
      [id, vong, r.rows[0]!.phien_ban, JSON.stringify(r.rows[0]!.boi_canh)]);
  };

  it('⭐ trận mặc định ⇒ v63 · 14 ô · 13 vòng · lịch màn trong DTO; bàn tập vẫn 6 ô v62', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({}) });
    expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
    const row = (await pool.query('SELECT so_o, balance_version FROM holdem_matches WHERE match_id = $1', [t.match_id])).rows[0]!;
    // D560 — mặc định đi tiếp v63 → v64: ghim TÍNH CHẤT (khoá mặc định, bàn 14), không ghim tên.
    expect(row.balance_version).toBe(HOLDEM_BALANCE_VERSION);
    expect(luatCua(row.balance_version).ban14).toBe(true);
    expect(Number(row.so_o)).toBe(14);
    expect(t.tong_vong).toBe(13);
    expect(t.lich_man).toEqual([...LICH.man]);
    const tap = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ tap: true }) });
    const rt = (await pool.query('SELECT so_o, balance_version FROM holdem_matches WHERE match_id = $1', [tap.match_id])).rows[0]!;
    expect([Number(rt.so_o), rt.balance_version]).toEqual([6, V62]);
  }, 120_000);

  it('⭐ đi hết 13 vòng (cầm mã ⇒ có màn riêng): màn sau đúng chín vòng, năm chợ, kỳ họp lật ở ô 4 · 9, màn cuối khép trận', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_vai: 'ca_nhan' }) });
    const id = t.match_id as string;
    const coMan: number[] = [], coCho: number[] = [];
    let r: any = t;
    for (let v = 1; v <= 13; v += 1) {
      if (v > 1) await quaMan(id);
      const g = await json(`/api/v1/holdem/matches/${id}`);
      expect(g.vong, `trạng thái vòng ${v}`).toBe(v);
      if (g.ban?.cho_trait) coCho.push(v);
      // Mua lại mỗi vòng cho chắc còn cầm mã (màn riêng cần mã — D549 bỏ chờ khi không cầm).
      r = await nopVong(id, v, { lenh: [{ ma: 'vang', chieu: 'mua', moc_bp: 1000 }] });
      expect(r.error, `vòng ${v}: ${JSON.stringify(r).slice(0, 200)}`).toBeUndefined();
      if (r.cho_man) {
        expect(r.cho_man.vong).toBe(v);
        coMan.push(v);
        const mo = await post(`/api/v1/holdem/matches/${id}/minigame`, { vong: v });
        if (mo.status === 200) await luiMan(id, v);
      } else {
        expect(r.ket_qua_vong, `vòng ${v} không màn ⇒ kết quả vòng ngay`).toBeDefined();
      }
    }
    expect(coMan).toEqual([...LICH.man]);
    expect(coCho).toEqual([...LICH.trait]);
    await quaMan(id);
    const g = await json(`/api/v1/holdem/matches/${id}`);
    expect(g.status).toBe('xong');
    // Kỳ họp: DTO `o_lich` (vị trí kỳ họp, 1-indexed — client vẽ badge ⚖) = đúng ô 4 · 9 ngay từ lúc tạo trận.
    expect(t.o_lich).toEqual([4, 9]);
  }, 600_000);
});
