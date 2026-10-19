/**
 * D526 — NHỊP XEN KẼ (khoá v58, founder 05/10 chốt demo `docs/ui-ux/demo/nhip-tran.html`): bàn 8 ô · 7 vòng, sau mỗi lần chốt là MỘT chặng —
 * màn minigame HOẶC chợ trait (vòng 1 có cả hai), lõi theo lịch của cỡ bàn, chợ 45 s, vai ở bàn 8.
 * §I bảng + hàm thuần · §II qua HTTP + DB thật (mở màn vòng 1 · vòng mở chợ không có màn · màn cuối khép trận).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import {
  DONG_HO_MINIGAME, NHIP_XEN_KE, coManMinigame, giayChonBai, giayManMinigame, luatCua, nhipChonBai, vongChonChienThuat,
} from '../config/holdem.js';
import { BO_LUAT_THEO_PHIEN_BAN } from '../config/holdem_balance.js';
import { CO_BAN_DUY_NHAT, CO_BAN_MINIGAME, CO_BAN_XEN_KE, coBanGhim } from '../config/luoc_bo.js';
import { laMocTrait } from '../server/holdem/trait.js';
import { themGiayTrait } from '../server/holdem/dong_ho.js';

const V58 = 'balance-v58-xenke';
const V57 = 'balance-v57-minigame';

describe('§I — bảng nhịp xen kẽ + hàm thuần', () => {
  it('⭐ v58 khác v57 ĐÚNG hai cờ: chiBan12 → false, nhipXenKe MỚI', () => {
    const a = BO_LUAT_THEO_PHIEN_BAN[V57]! as unknown as Record<string, unknown>;
    const b = BO_LUAT_THEO_PHIEN_BAN[V58]! as unknown as Record<string, unknown>;
    const khac = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();
    expect(khac).toEqual(['chiBan12', 'nhipXenKe']);
    expect(b.nhipXenKe).toBe(true);
    expect(luatCua(V57).nhipXenKe, 'khoá cũ vắng cờ').not.toBe(true);
  });

  it('⭐ bàn 8 (7 vòng) và bàn 6 (5 vòng): sau MỖI lần chốt đúng một chặng (vòng 1 trận thật: hai), vòng cuối là màn', () => {
    const soVong = { 8: 7, 6: 5 } as const;
    for (const [co, n] of Object.entries(soVong)) {
      const lich = NHIP_XEN_KE[Number(co)]!;
      for (let v = 1; v <= n; v += 1) {
        const chang = Number(lich.man.includes(v)) + Number(lich.trait.includes(v + 1));
        const mong = Number(co) === 8 && v === 1 ? 2 : 1;
        expect(chang, `bàn ${co} vòng ${v}`).toBe(mong);
      }
      expect(lich.man.at(-1), `bàn ${co}: kết bằng màn`).toBe(n);
      expect(Math.max(...lich.trait), 'chợ không rơi ra ngoài trận').toBeLessThanOrEqual(n);
    }
    // Đúng thứ tự founder duyệt trên demo.
    expect(NHIP_XEN_KE[8]).toEqual({ man: [1, 2, 4, 6, 7], trait: [2, 4, 6], loi: [1, 4, 6] });
    expect(NHIP_XEN_KE[6]!.man).toEqual([2, 4, 5]);
    expect(NHIP_XEN_KE[6]!.trait).toEqual([2, 4]);
    expect(CO_BAN_XEN_KE).toBe(8);
  });

  it('⭐ `coBanGhim` — một nguồn cho tạo trận · catalog · bàn chung · bàn ngày: v58 8 · v57 12 · v54 16 · khoá cho chọn null', () => {
    expect(coBanGhim(luatCua(V58))).toBe(CO_BAN_XEN_KE);
    expect(coBanGhim(luatCua(V57))).toBe(CO_BAN_MINIGAME);
    expect(coBanGhim(luatCua('balance-v54-ngare'))).toBe(CO_BAN_DUY_NHAT);
    expect(coBanGhim(luatCua('balance-v49-bankhong'))).toBeNull();
  });

  it('⭐ `coManMinigame`: khung v57 (không cờ) = mọi vòng ≥ 2 ở mọi cỡ — byte-hệt luật cũ; có cờ thì đọc lịch', () => {
    for (const co of [6, 8, 12, 16]) {
      for (let v = 1; v <= co; v += 1) expect(coManMinigame(v, co, false), `${co}/${v}`).toBe(v >= 2);
    }
    expect([1, 2, 3, 4, 5, 6, 7].filter((v) => coManMinigame(v, 8, true))).toEqual([1, 2, 4, 6, 7]);
    // Cờ bật mà cỡ bàn không có lịch ⇒ rơi về khung v57, không im lặng mất màn.
    expect(coManMinigame(1, 12, true)).toBe(false);
    expect(coManMinigame(5, 12, true)).toBe(true);
  });

  it('⭐ lượt lõi theo lịch: bàn 8 = 1 · 4 · 6, đi KÈM chợ ở 4 · 6; vòng lõi có quầy (`chien_thuat`)', () => {
    expect(vongChonChienThuat(8, true, true, true)).toEqual([1, 4, 6]);
    expect(vongChonChienThuat(6, true, true, true), 'bàn tập: một lượt lõi (demo: chợ vòng 4 không kèm lõi)').toEqual([1]);
    const nhip = nhipChonBai(8, false, true, true, true);
    expect([1, 4, 6].map((v) => nhip[v - 1])).toEqual(['chien_thuat', 'chien_thuat', 'chien_thuat']);
    // Khung v57 ở bàn 12 không đổi.
    expect(vongChonChienThuat(12, true, true, false)).toEqual([1, 4, 6]);
    expect(vongChonChienThuat(12, true, true, true), 'cờ bật mà cỡ không có lịch').toEqual([1, 4, 6]);
  });

  it('⭐ đồng hồ: màn của vòng trước chỉ cộng giờ khi lịch có màn; vòng mở chợ cộng 45 s', () => {
    const M = giayManMinigame();
    const nen = DONG_HO_MINIGAME.CHON_BAI_S + DONG_HO_MINIGAME.XEM_KET_QUA_S;
    expect(giayChonBai(2, 8, true, true, true), 'vòng 2: màn vòng 1').toBe(nen + M);
    expect(giayChonBai(3, 8, true, true, true), 'vòng 3: màn vòng 2').toBe(nen + M);
    expect(giayChonBai(4, 8, true, true, true), 'vòng 4: vòng 3 không màn (chợ) + lượt lõi').toBe(nen + DONG_HO_MINIGAME.CHON_BAI_THEM_KHI_CO_THE_S);
    expect(giayChonBai(5, 8, true, true, true), 'vòng 5: màn vòng 4').toBe(nen + M);
    // Khung v57: màn từ vòng 2 ⇒ vòng 2 chưa cộng, vòng 3 cộng.
    expect(giayChonBai(2, 12, true, true, false)).toBe(nen);
    expect(giayChonBai(3, 12, true, true, false)).toBe(nen + M);
    const st = { trait_bat: true, trait_kho_hep: true, dong_ho_minigame: true, nhip_xen_ke: true, map: { o: new Array(8).fill(0) } };
    expect([1, 2, 3, 4, 5, 6, 7].filter((v) => laMocTrait(v, 8, st))).toEqual([2, 4, 6]);
    for (const v of [2, 4, 6]) expect(themGiayTrait(st, v)).toBe(DONG_HO_MINIGAME.CHON_TRAIT_XEN_KE_S);
    expect(DONG_HO_MINIGAME.CHON_TRAIT_XEN_KE_S).toBe(45);
    const st57 = { trait_bat: true, trait_kho_hep: true, dong_ho_minigame: true, map: { o: new Array(12).fill(0) } };
    expect([...Array(11).keys()].map((i) => i + 1).filter((v) => laMocTrait(v, 12, st57)), 'v57 giữ 5 · 9').toEqual([5, 9]);
    expect(themGiayTrait(st57, 5)).toBe(DONG_HO_MINIGAME.CHON_TRAIT_THEM_S);
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
  /** Qua hết phần màn: lùi mốc mở vòng (cùng cách `minigame_api.test.ts`). */
  const quaMan = (id: string) => pool.query(`UPDATE holdem_matches SET vong_mo_luc = now() - interval '50 seconds' WHERE match_id = $1`, [id]);
  /** Màn đã mở thì giờ neo ở dòng màn: ghi lại dòng với mốc bắt đầu lùi 60 s (trigger cấm sửa `bat_dau` — DELETE + INSERT). */
  const luiMan = async (id: string, vong: number) => {
    const r = await pool.query('DELETE FROM holdem_minigame_man WHERE match_id = $1 AND vong = $2 RETURNING boi_canh, phien_ban', [id, vong]);
    await pool.query(
      `INSERT INTO holdem_minigame_man (match_id, vong, phien_ban, boi_canh, bat_dau) VALUES ($1, $2, $3, $4, now() - interval '60 seconds')`,
      [id, vong, r.rows[0]!.phien_ban, JSON.stringify(r.rows[0]!.boi_canh)]);
  };

  it('⭐ tạo trận v58 ⇒ bàn 8 ô · 7 vòng · lịch màn trong DTO · ghế người có vai', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V58 }) });
    expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
    expect(t.tong_vong).toBe(7);
    expect(t.lich_man).toEqual([1, 2, 4, 6, 7]);
    const so = (await pool.query('SELECT so_o FROM holdem_matches WHERE match_id = $1', [t.match_id])).rows[0]!.so_o;
    expect(Number(so)).toBe(8);
    expect(t.ban.vai, 'bàn 8 nhịp xen kẽ vẫn bốc vai').toBeTruthy();
    // v57 cũng mang lịch (dẫn xuất cùng `coManMinigame`): mọi vòng ≥ 2 — web không tự suy luật nào.
    const t57 = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V57 }) });
    expect(t57.lich_man).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const t56 = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v56-congdon' }) });
    expect(t56.lich_man, 'trận không có màn').toBeUndefined();
  }, 120_000);

  it('⭐ đổi lõi MỘT lần mỗi vòng (founder: "đổi lõi chỉ đổi được 1 lần"): DTO báo trần 1, cửa shop + cửa nộp chặn lần 2; v57 giữ trần cũ', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V58 }) });
    expect(t.doi_loi_toi_da).toBe(1);
    expect((await req(`/api/v1/holdem/matches/${t.match_id}/shop?lan=1`)).status).toBe(200);
    const hai = await req(`/api/v1/holdem/matches/${t.match_id}/shop?lan=2`);
    expect(hai.status).toBe(409);
    expect((await hai.json() as any).error).toBe('het_doi_loi');
    const nop = await nopVong(t.match_id, 1, { khao_sat_lai: 2 });
    expect(nop.error).toBe('het_doi_loi');
    const t57 = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V57 }) });
    expect(t57.doi_loi_toi_da).toBeUndefined();
    expect((await req(`/api/v1/holdem/matches/${t57.match_id}/shop?lan=2`)).status, 'v57: trần cũ').not.toBe(409);
  }, 120_000);

  it('⭐ đi hết trận: màn sau vòng 1 · 2 · 4 · 6 · 7, vòng 3 · 5 không màn (chợ ở 4 · 6); màn cuối khép trận', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V58 }) });
    const id = t.match_id as string;
    const coMan: number[] = [], coCho: number[] = [];
    let r: any = t;
    for (let v = 1; v <= 7; v += 1) {
      if (v > 1) await quaMan(id);
      const g = await json(`/api/v1/holdem/matches/${id}`);
      expect(g.vong, `trạng thái vòng ${v}`).toBe(v);
      if (g.ban?.cho_trait) coCho.push(v);
      // D528 — mốc 25 %: vai bốc ngẫu nhiên, Tổ Chức trần 40 % một mã ⇒ lệnh 50 % bị bỏ ⇒ "khong_co_ma" (bài chập chờn theo vai).
      r = await nopVong(id, v, v === 1 ? { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] } : {});
      expect(r.error, `vòng ${v}: ${JSON.stringify(r).slice(0, 200)}`).toBeUndefined();
      if (r.cho_man) {
        expect(r.cho_man.vong).toBe(v);
        coMan.push(v);
        const mo = await post(`/api/v1/holdem/matches/${id}/minigame`, { vong: v });
        expect(mo.status, `mở màn vòng ${v}: ${await mo.clone().text()}`).toBe(200);
        await luiMan(id, v);
      } else {
        expect(r.ket_qua_vong, `vòng ${v} không màn ⇒ kết quả vòng ngay`).toBeDefined();
        const mo = await post(`/api/v1/holdem/matches/${id}/minigame`, { vong: v });
        expect(mo.status, `vòng ${v} không có màn`).toBe(409);
      }
    }
    expect(coMan).toEqual([1, 2, 4, 6, 7]);
    expect(coCho).toEqual([2, 4, 6]);
    expect(r.xong, 'màn cuối chưa chạy ⇒ chưa khép').not.toBe(true);
    // D525 — chờ màn cuối thì không còn vòng nào để nộp: 409 nói rõ, không phải 500 nổ trong replay.
    const thua = await json(`/api/v1/holdem/matches/${id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong: 8, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0 }),
    });
    expect(thua.error).toBe('tran_da_het');
    await quaMan(id);
    const g = await json(`/api/v1/holdem/matches/${id}`);
    expect(g.status).toBe('xong');
    const n = Number((await pool.query('SELECT count(*)::int AS n FROM holdem_minigame_man WHERE match_id = $1', [id])).rows[0]!.n);
    expect(n, 'năm màn đã ghi').toBe(5);
  }, 400_000);
});
