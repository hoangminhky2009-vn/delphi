/**
 * THẺ NĂNG LỰC (D323) qua ENDPOINT THẬT — cùng nếp `tests/khoanh_khac_api.test.ts`:
 * hàm thuần đã khoá ở `tests/nang_luc.test.ts`; file này hỏi câu hàm thuần không
 * trả lời được — CÓ ĐƯỜNG CHẠY NÀO GỌI TỚI KHÔNG (`/autopsy` dựng tại chỗ,
 * `/me/nang-luc` làm tươi rồi gộp) — nên chơi trọn bàn qua `/rounds` thật.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { quaMan } from './helpers/minigame.js';
import { NANG_LUC_FORMULA_VERSION, NANG_LUC_HIEN } from '../config/nang_luc.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-nl', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

/** `cookie` mặc định là user chính — truyền cookie khác để gọi thay một user khác. */
async function json(path: string, init: RequestInit = {}, cookie = user.cookie): Promise<any> {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) },
  });
  return r.json();
}
const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}, cookie = user.cookie) =>
  json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], ...them,
    }),
  }, cookie);

/** Chơi trọn MỘT bàn (tap hoặc thường) tới khi `xong`, trả về match_id + tổng vòng. */
async function choiTronBan(
  opts: Record<string, unknown>, cookie = user.cookie,
): Promise<{ matchId: string; tongVong: number }> {
  const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify(opts) }, cookie);
  expect(tao.match_id, JSON.stringify(tao)).toBeTruthy();
  let st = await nopVong(tao.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] }, cookie);
  for (let v = 2; v <= tao.tong_vong; v += 1) st = await nopVong(tao.match_id, v, {}, cookie);
  // D525/D527 — khung minigame (bàn tập v58, trận mặc định): cú nộp cuối trả CHỜ MÀN; màn cuối qua thì GET khép trận.
  if (st.cho_man) {
    await quaMan(pool, tao.match_id);
    st = await json(`/api/v1/holdem/matches/${tao.match_id}`, {}, cookie);
    expect(st.status, `phải đi hết bàn: ${JSON.stringify(st).slice(0, 300)}`).toBe('xong');
  } else {
    expect(st.xong, `phải đi hết bàn: ${JSON.stringify(st)}`).toBe(true);
  }
  return { matchId: tao.match_id as string, tongVong: Number(tao.tong_vong) };
}

describe('/autopsy mang nang_luc (D323)', () => {
  // D396 — "đủ" = đủ những năng lực đang HIỆN (`NANG_LUC_HIEN`; N2 ẩn tới khi đổi thước), không ghim con số 3.
  it('⭐ bàn TẬP đã xong: autopsy có đủ năng lực đang hiện, nhưng tinh_vao_the = false (man_tap)', async () => {
    const { matchId } = await choiTronBan({ tap: true });
    const mo = await json(`/api/v1/holdem/matches/${matchId}/autopsy`);
    expect(mo.xong, JSON.stringify(mo)).toBe(true);
    expect(mo.nang_luc, 'autopsy phải mang khối nang_luc').toBeTruthy();
    expect(mo.nang_luc.formula_version).toBe(NANG_LUC_FORMULA_VERSION);
    expect(mo.nang_luc.tinh_vao_the, 'bàn tập không được tính vào thẻ theo người').toBe(false);
    expect(mo.nang_luc.ly_do_khong_tinh).toBe('man_tap');
    expect(mo.nang_luc.nang_luc.map((n: { id: string }) => n.id)).toEqual([...NANG_LUC_HIEN]);
    for (const n of mo.nang_luc.nang_luc) {
      expect(['chua_gap', 'gap_chua_vung', 'lam_duoc']).toContain(n.bac);
      expect(n.bang_chung).toBeTruthy();
    }
  }, 60_000);

  it('gọi /autopsy hai lần liên tiếp ra CÙNG một thẻ (dungHanhViTran idempotent)', async () => {
    const { matchId } = await choiTronBan({ tap: true });
    const a = await json(`/api/v1/holdem/matches/${matchId}/autopsy`);
    const b = await json(`/api/v1/holdem/matches/${matchId}/autopsy`);
    expect(b.nang_luc).toEqual(a.nang_luc);
  }, 60_000);
});

describe('/holdem/me/nang-luc (D323)', () => {
  it('người mới toanh (chỉ có bàn tập) ⇒ mọi năng lực đang hiện đều chua_gap, so_de = 0', async () => {
    const moi = await createTestUser(pool);
    await choiTronBan({ tap: true }, moi.cookie);

    const dto = await json('/api/v1/holdem/me/nang-luc', {}, moi.cookie);
    expect(dto.formula_version).toBe(NANG_LUC_FORMULA_VERSION);
    expect(dto.so_de, 'bàn tập không vào mẫu số').toBe(0);
    expect(dto.nang_luc.map((n: { id: string }) => n.id)).toEqual([...NANG_LUC_HIEN]);
    for (const n of dto.nang_luc) {
      expect(n.bac).toBe('chua_gap');
      expect(n.so_de_gap).toBe(0);
      expect(n.so_de_lam_duoc).toBe(0);
      expect(n.lan_dau_lam_duoc).toBeNull();
    }
  }, 60_000);

  /*
   * Ca "nếu helper cho phép tạo trận THƯỜNG (không tap) và chơi tới xong" —
   * `body: '{}'` (không `tap`) là đúng đường tạo trận thường đã dùng ở
   * `tests/hanh_vi_kho.test.ts` (§I `choiTronTran`), nên KHÔNG bỏ ca này.
   */
  it('⭐ trận THƯỜNG chơi xong (không tap, không nghi máy) ⇒ tinh_vao_the = true, so_de = 1', async () => {
    const nguoi = await createTestUser(pool);
    // Trận THƯỜNG: body rỗng, không `tap: true` — seed thật, không phải seed màn tập.
    // D406 — ghim v53 (bàn 8 không vai): cú mua 50% vòng 1 bị trần TỔ CHỨC chặn ngẫu nhiên dưới v54.
    const { matchId } = await choiTronBan({ ep_balance: 'balance-v53-upo' }, nguoi.cookie);

    const mo = await json(`/api/v1/holdem/matches/${matchId}/autopsy`, {}, nguoi.cookie);
    expect(mo.xong, JSON.stringify(mo)).toBe(true);
    expect(mo.nang_luc.tinh_vao_the, 'trận thường chơi hết ⇒ phải tính vào thẻ').toBe(true);
    expect(mo.nang_luc.ly_do_khong_tinh).toBeNull();

    const dto = await json('/api/v1/holdem/me/nang-luc', {}, nguoi.cookie);
    expect(dto.so_de, 'người này chỉ có đúng một trận tính vào thẻ').toBe(1);
  }, 60_000);
});
