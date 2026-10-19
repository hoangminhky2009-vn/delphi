/**
 * v54 (D403) — ba cờ quỹ vòng qua ĐƯỜNG THẬT (endpoint), không qua engine trần:
 *   · cờ `bo_bai_tat` tới client (màn gỡ nút BỎ, shop có BÁN SẠCH);
 *   · `quy_vong_hien_tai` = nền theo cỡ bàn × số ghế (một cửa `nenVongCua`, không tự nhân CAM_KET_NEN);
 *   · nhật ký cược KHÔNG ghi nước 'bo' mà engine đã ép về THEO (dải đối thủ từng đọc ra "CẮT" cho ghế vẫn trong pot);
 *   · cú CẮT LỖ của client cũ (`hanh_dong: 'cat_lo'`) chỉ còn là bán — không trừ lượt, không cờ `da_cat_lo`.
 *
 * Cờ bật bằng cách GHI ĐÈ khoá v54 TRONG TIẾN TRÌNH TEST (vitest cô lập từng tệp; hoàn nguyên ở afterAll) — nên bài
 * đúng cả trước lẫn sau khi v54 bật chúng thật. Vế ngược chạy TRƯỚC (cờ tắt, cùng seed): bot phải có nước 'bo' — không
 * thì vế cờ-bật xanh mà không canh gì.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { BO_LUAT_THEO_PHIEN_BAN } from '../config/holdem_balance.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

const V54 = 'balance-v54-ngare';
const GOC = { ...BO_LUAT_THEO_PHIEN_BAN[V54]! };
const batCo = (bat: boolean) => Object.assign(BO_LUAT_THEO_PHIEN_BAN[V54]!, {
  boBaiTat: bat, quyTheoCoBan: bat, quyTranHang1: bat,
});

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
}, 120_000);

afterAll(async () => {
  Object.assign(BO_LUAT_THEO_PHIEN_BAN[V54]!, GOC);
  await db?.stop();
});

/** Tester mới cho mỗi trận: `ep_seed` chỉ nhận ở tester, và mỗi user chỉ một trận mở. */
async function tester(): Promise<(path: string, init?: RequestInit) => Promise<any>> {
  const u: TestUser = await createTestUser(pool, { role: 'admin' });
  await pool.query(`UPDATE users SET la_tester = true WHERE user_id = $1`, [u.userId]);
  return async (path, init = {}) => (await app.request(
    `http://localhost${path}`,
    { ...init, headers: { 'content-type': 'application/json', cookie: u.cookie } },
  )).json();
}

const nop = (j: Awaited<ReturnType<typeof tester>>, id: string, vong: number, them: Record<string, unknown> = {}) =>
  j(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], lenh: [], ...them }),
  });

type Nuoc = { ghe_id: string; loai: string };
// Số ghế = 4 + seed % 5 (`soGheTuSeed`): 10 ⇒ 4 ghế (nền 625 > 500 — bắt phân loại theo nền CŨ), 23 ⇒ 7, 57 ⇒ 6.
const SEED = [10, 23, 57];

/** Chơi trọn một trận v54 (người GIỮ VỊ THẾ mọi vòng); đếm nước 'bo' của BOT trong nhật ký + cờ CẮT của đối thủ. */
async function choiTron(seed: number): Promise<{ boBot: number; catDoiThu: number; vong: number; tt0: any; hanhDong: Set<string> }> {
  const j = await tester();
  const t = await j('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V54, ep_seed: seed }) });
  expect(t.match_id, JSON.stringify(t).slice(0, 300)).toBeTypeOf('string');
  let boBot = 0; let catDoiThu = 0; let vong = 0;
  const hanhDong = new Set<string>();
  for (let v = 1; v <= Number(t.tong_vong); v += 1) {
    const r = await nop(j, t.match_id, v);
    const kv = r.ket_qua_vong;
    if (!kv) break;
    vong += 1;
    boBot += ((kv.nhat_ky ?? []) as Nuoc[]).filter((n) => n.ghe_id !== 'ban' && n.loai === 'bo').length;
    catDoiThu += ((kv.cua_doi_thu ?? []) as { da_cat_lo: boolean }[]).filter((d) => d.da_cat_lo).length;
    for (const d of [kv.cua_ban, ...(kv.cua_doi_thu ?? [])] as ({ hanh_dong?: string } | null)[]) {
      if (d?.hanh_dong) hanhDong.add(d.hanh_dong);
    }
  }
  return { boBot, catDoiThu, vong, tt0: t, hanhDong };
}

describe('v54 (D403) — ba cờ quỹ vòng qua endpoint', () => {
  it('vế ngược — cờ TẮT: bot CÓ nước BỎ trong nhật ký và có ghế CẮT (không thì vế bật là bài rỗng)', async () => {
    batCo(false);
    let bo = 0; let cat = 0;
    for (const s of SEED) { const r = await choiTron(s); bo += r.boBot; cat += r.catDoiThu; expect(r.tt0.bo_bai_tat).toBeUndefined(); }
    expect(bo, 'ba trận không bot nào bỏ — chọn seed khác').toBeGreaterThan(0);
    expect(cat).toBeGreaterThan(0);
  }, 600_000);

  it("⭐ cờ BẬT, cùng seed: cờ `bo_bai_tat` tới client · quỹ tối thiểu = nền theo cỡ bàn × số ghế · KHÔNG nước 'bo', KHÔNG ghế CẮT", async () => {
    batCo(true);
    for (const s of SEED) {
      const r = await choiTron(s);
      expect(r.vong, `seed ${s}: trận không chạy vòng nào`).toBeGreaterThan(0);
      expect(r.tt0.bo_bai_tat, `seed ${s}`).toBe(true);
      const soGhe = Number(r.tt0.so_nguoi_song);
      expect(r.tt0.quy_vong_hien_tai, `seed ${s}: ${soGhe} ghế`).toBe(Math.floor((500 * 5) / soGhe) * soGhe);
      expect(r.boBot, `seed ${s}: nhật ký còn ghi nước BỎ của bot`).toBe(0);
      expect(r.catDoiThu, `seed ${s}: còn ghế CẮT`).toBe(0);
      // Máy cược tắt ⇒ không ai tố; nộp đúng nền theo cỡ bàn là GIỮ VỊ THẾ — kể cả bàn 4 ghế nộp 625 (> 500 cũ).
      expect([...r.hanhDong], `seed ${s}`).toEqual(['giu_vi_the']);
    }
  }, 600_000);

  it('⭐ client CŨ bấm CẮT LỖ (hanh_dong cat_lo + nước bo + bán sạch) ⇒ chỉ còn là BÁN: không trừ lượt, không cờ CẮT, vẫn trong quỹ', async () => {
    batCo(true);
    const j = await tester();
    const t = await j('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: V54, ep_seed: 11 }) });
    const r1 = await nop(j, t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] });
    const luot = r1.ban.con_lai_cat_lo;
    const r2 = await nop(j, t.match_id, 2, {
      hanh_dong: 'cat_lo', cuoc: [{ loai: 'bo' }], lenh: [{ ma: 'btc', chieu: 'ban', moc_bp: 10000 }],
    });
    const kv = r2.ket_qua_vong;
    expect(kv.cua_ban.da_cat_lo).toBe(false);
    expect(kv.cua_ban.hanh_dong).toBe('giu_vi_the');
    expect(((kv.nhat_ky ?? []) as Nuoc[]).filter((n) => n.ghe_id === 'ban').map((n) => n.loai)).not.toContain('bo');
    expect(r2.ban.con_lai_cat_lo, 'không còn nước BỎ thì không có lượt nào bị trừ').toBe(luot);
    expect(r2.ban.vi_the?.btc ?? 0, 'lệnh bán sạch vẫn đi như lệnh thường').toBe(0);
    const nen = Math.floor((500 * 5) / Number(t.so_nguoi_song));
    expect(kv.cua_ban.cam_ket, 'ghế vẫn nộp nền ⇒ vẫn trong quỹ').toBe(nen);
  }, 300_000);
});
