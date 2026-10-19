/**
 * LUỒNG QUA API — bối cảnh dài hạn trên khoá mặc định v67 (D574, SPEC `docs/spec/boi-canh-dai-han.md` §5 "kịch bản luồng").
 *
 * Đi đúng đường web: tạo trận → nộp vòng 1 (mua lõi) → mở màn → đọc đầu màn + trạng thái trận. Khẳng định:
 *   · trận mới chạy `balance-v67-boicanh`;
 *   · bối cảnh LATENT: không DTO nào (trạng thái trận · đầu màn · lô nhịp) mang `boi_canh_dh` / `do_deo` (founder: "Không lật");
 *   · dòng tin màn ghi trong DB có dòng vĩ mô ĐÚNG KHI `tinViMoVong(seed, vòng, bối cảnh ô)` nói có — một nguồn với máy.
 * Phần engine của luồng (Lên + Nới → kỳ họp tăng → gấu chu kỳ) ở `boi_canh_chuyen_no.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../../server/app.js';
import { CapturingMailer } from '../../server/email.js';
import { startTestDb, type TestDb } from '../helpers/testdb.js';
import { createTestUser, type TestUser } from '../helpers/fixtures.js';
import { HOLDEM_BALANCE_VERSION, luatCua } from '../../config/holdem.js';
import { taoTran } from '../../server/holdem/engine.js';
import { tinViMoVong } from '../../server/holdem/boi_canh_dai_han.js';

describe('D574 — luồng API: bối cảnh dài hạn trên khoá mặc định', () => {
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
  const text = async (path: string, init: RequestInit = {}): Promise<string> => (await req(path, init)).text();

  it('⭐ trận mới = khoá mặc định (mang bối cảnh dài hạn) · không DTO nào lộ bối cảnh · dòng tin màn có dòng vĩ mô đúng khi máy nói có', async () => {
    expect(luatCua(HOLDEM_BALANCE_VERSION).boiCanhDaiHan).toBe(true);
    let soMan = 0;
    for (let lan = 0; lan < 30 && soMan < 4; lan++) {
      const t = JSON.parse(await text('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_vai: 'ca_nhan' }) }));
      const id = t.match_id as string;
      const row = (await pool.query('SELECT seed, balance_version, so_o FROM holdem_matches WHERE match_id = $1', [id])).rows[0]!;
      expect(row.balance_version).toBe(HOLDEM_BALANCE_VERSION);
      const sh = JSON.parse(await text(`/api/v1/holdem/matches/${id}/shop?lan=0`));
      const loi = (sh.shop?.chien_thuat ?? [])[0];
      if (!loi) continue;
      const r = await req(`/api/v1/holdem/matches/${id}/rounds`, {
        method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: [loi], hanh_dong: 'giu_vi_the', them: 0, lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] }),
      });
      if (r.status !== 200) continue;
      const mo = await req(`/api/v1/holdem/matches/${id}/minigame`, { method: 'POST', body: JSON.stringify({ vong: 1 }) });
      if (mo.status !== 200) continue;
      soMan += 1;
      const dto = [await mo.text(), await text(`/api/v1/holdem/matches/${id}`), await text(`/api/v1/holdem/matches/${id}/minigame/1/nhip?tu=0&mot_lan=1`)];
      for (const x of dto) { expect(x).not.toContain('boi_canh_dh'); expect(x).not.toContain('do_deo'); }
      const bc = (await pool.query('SELECT boi_canh FROM holdem_minigame_man WHERE match_id = $1 AND vong = 1', [id])).rows[0]!.boi_canh;
      const st = taoTran(Number(row.seed), [], luatCua(row.balance_version), row.so_o ?? undefined);
      const i = st.o_up === true ? 1 : 0;
      const ky = tinViMoVong(Number(row.seed), 1, st.map.trang_thai![i]!.boi_canh_dh!);
      const vm = (bc.tin ?? []).filter((x: { viMo?: true }) => x.viMo);
      expect(vm.length, `trận ${id}`).toBe(ky ? 1 : 0);
      if (ky) { expect(vm[0].chu).toBe(`vm.${ky.noi}.${ky.mau}`); }
    }
    expect(soMan, 'mở được màn ở ít nhất 3 trận').toBeGreaterThanOrEqual(3);
  }, 900_000);
});
