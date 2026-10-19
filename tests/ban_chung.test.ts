/**
 * BÀN CHUNG THEO SEED (16/08, migration 0040, đề xuất `moi-ban-vao-doi.md` A).
 *
 * Canh những thứ là LUẬT:
 *   · mã do server phát (5 ký tự), seed + cỡ map của MỌI trận trong bàn giống
 *     nhau — "cùng đề" (khuôn Wordle);
 *   · một tài khoản MỘT trận mỗi bàn (UNIQUE) — vào lần hai ⇒ 409 kèm match_id cũ;
 *   · bàn chung = đấu tự do dù client xin rank_pve;
 *   · GET /ban/:ma: số của NGƯỜI KHÁC chỉ lộ khi CHÍNH tôi đã xong (A3.1);
 *   · mã sai hình dạng / không tồn tại ⇒ 404 cùng một câu (D93);
 *   · bàn hết hạn ⇒ 409 `ban_het_han`;
 *   · `hd_match_start` mang nhãn `ban_ma` + `nguon:'ban_chung'` (cohort được rủ).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, luatCua } from '../config/holdem.js';
import { coBanGhim } from '../config/luoc_bo.js';
import { quaManNeuCo } from './helpers/minigame.js';

/*
 * D406 — bàn chung chơi luật MẶC ĐỊNH lúc phát bàn: khoá có `chiBan16` (v54) ⇒ luôn 16, cỡ xin bị bỏ qua (D389).
 * Ghim theo tính chất của khoá: lật khoá lần sau thì hai số này tự đi theo, không ai phải sửa bài.
 */
// D525 — mọi cỡ ghim của khoá mặc định (`coBanGhim`: v58 ⇒ 8, v54 ⇒ 16), không riêng `chiBan16`.
const CO_GHIM = coBanGhim(luatCua(HOLDEM_BALANCE_VERSION));
/** Cỡ bàn khi xin 12 · khi xin một số lạ (7). */
const SO_O_XIN_12 = CO_GHIM ?? 12;
const SO_O_XIN_LA = CO_GHIM ?? HOLDEM_DECISIONS.MAP_SIZE;

// D383 — số vòng = SỐ Ô − 1 (bối cảnh mở màn `o[0]` không quyết toán vòng nào).

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let A: TestUser;
let B: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-bc', secureCookie: false,
  }) as Hono<any>;
  A = await createTestUser(pool);
  B = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function goi(u: TestUser, path: string, init: RequestInit = {}) {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: u.cookie, ...(init.headers ?? {}) },
  });
  return { status: r.status, body: await r.json() as any };
}
// D525 — khoá mặc định có màn lõi sau cú nộp ⇒ qua màn rồi đọc trạng thái thật (`quaManNeuCo`).
const nopVong = async (u: TestUser, id: string, vong: number) => {
  const r = await goi(u, `/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [] }),
  });
  return { ...r, body: await quaManNeuCo(pool, id, r.body, async () => (await goi(u, `/api/v1/holdem/matches/${id}`)).body) };
};

describe('bàn chung theo seed', () => {
  let ma = '';

  it('POST /ban phát mã 5 ký tự, cỡ map lạ ⇒ mặc định', async () => {
    const r = await goi(A, '/api/v1/holdem/ban', { method: 'POST', body: JSON.stringify({ so_o: 12 }) });
    expect(r.status).toBe(201);
    expect(r.body.ma).toMatch(/^[a-z0-9]{5}$/);
    expect(r.body.so_o).toBe(SO_O_XIN_12);
    ma = r.body.ma;
    const r2 = await goi(A, '/api/v1/holdem/ban', { method: 'POST', body: JSON.stringify({ so_o: 7 }) });
    expect(r2.body.so_o).toBe(SO_O_XIN_LA);
  });

  it('⭐ A và B vào cùng bàn ⇒ CÙNG seed, cùng cỡ map, cùng ô mở màn; chế độ tự do dù xin rank', async () => {
    const ta = await goi(A, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ban_ma: ma, che_do: 'rank_pve' }) });
    const tb = await goi(B, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ban_ma: ma.toUpperCase() }) });
    expect(ta.status).toBe(201);
    expect(tb.status).toBe(201);
    expect(ta.body.ban_ma).toBe(ma);
    expect(tb.body.ban_ma).toBe(ma);
    expect(ta.body.tong_vong).toBe(SO_O_XIN_12 - 1);
    expect(tb.body.tong_vong).toBe(SO_O_XIN_12 - 1);
    expect(JSON.stringify(ta.body.o_hien_tai)).toBe(JSON.stringify(tb.body.o_hien_tai));
    // Cùng seed ⇒ cùng dàn đối thủ máy.
    expect(JSON.stringify(ta.body.doi_thu.map((d: any) => d.loai + d.bot_id)))
      .toBe(JSON.stringify(tb.body.doi_thu.map((d: any) => d.loai + d.bot_id)));
    const rows = await pool.query(
      `SELECT seed, so_o, che_do, ban_ma FROM holdem_matches WHERE ban_ma = $1 ORDER BY started_at`, [ma]);
    expect(rows.rowCount).toBe(2);
    expect(rows.rows[0]!.seed).toBe(rows.rows[1]!.seed);
    expect(rows.rows.every((r) => r.che_do === 'tu_do')).toBe(true);
    // Nhãn cohort trong events (A1).
    const ev = await pool.query(
      `SELECT value_json FROM events WHERE action_type = 'hd_match_start' AND context_id = $1`,
      [ta.body.match_id]);
    expect(ev.rows[0]!.value_json.ban_ma).toBe(ma);
    expect(ev.rows[0]!.value_json.nguon).toBe('ban_chung');
  });

  it('một tài khoản một trận mỗi bàn: vào lần hai ⇒ 409 kèm match_id cũ', async () => {
    const r = await goi(A, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ban_ma: ma }) });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('da_vao_ban');
    expect(r.body.match_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('⭐ GET /ban/:ma — A3.1: số của người khác chỉ lộ khi CHÍNH tôi đã xong', async () => {
    // A chơi hết bàn; B chưa.
    const idA = (await goi(A, `/api/v1/holdem/ban/${ma}`)).body.toi.match_id as string;
    for (let v = 1; v <= SO_O_XIN_12 - 1; v++) {
      const r = await nopVong(A, idA, v);
      if (r.body.status === 'xong') break;
    }
    const nhinA = (await goi(A, `/api/v1/holdem/ban/${ma}`)).body;
    expect(nhinA.toi_da_xong).toBe(true);
    expect(nhinA.so_nguoi).toBe(2);
    expect(nhinA.la_chu).toBe(true);
    const meA = nhinA.doi.find((d: any) => d.la_toi);
    expect(meA.xong).toBe(true);
    expect(typeof meA.von_cuoi).toBe('number');
    // B chưa xong: A thấy B "đang chơi", không có số (B không có số để lộ).
    const bTrongMatA = nhinA.doi.find((d: any) => !d.la_toi);
    expect(bTrongMatA.dang_choi).toBe(true);
    expect(bTrongMatA.von_cuoi).toBeUndefined();

    // B nhìn: A đã xong nhưng B CHƯA ⇒ số của A bị che (cùng đề mù).
    const nhinB = (await goi(B, `/api/v1/holdem/ban/${ma}`)).body;
    expect(nhinB.toi_da_xong).toBe(false);
    const aTrongMatB = nhinB.doi.find((d: any) => !d.la_toi);
    expect(aTrongMatB.xong).toBe(true);
    expect(aTrongMatB.von_cuoi).toBeUndefined();
    expect(aTrongMatB.hang).toBeUndefined();
    expect(aTrongMatB.duong).toBeUndefined();   // ghost cũng bị che (A3.1)

    // B chơi xong ⇒ thấy số của A.
    const idB = nhinB.toi.match_id as string;
    for (let v = 1; v <= SO_O_XIN_12 - 1; v++) {
      const r = await nopVong(B, idB, v);
      if (r.body.status === 'xong') break;
    }
    const nhinB2 = (await goi(B, `/api/v1/holdem/ban/${ma}`)).body;
    expect(nhinB2.toi_da_xong).toBe(true);
    const aTrongMatB2 = nhinB2.doi.find((d: any) => !d.la_toi);
    expect(typeof aTrongMatB2.von_cuoi).toBe('number');
    /*
     * ⭐ GHOST (17/08): đường NAV từng vòng của A cho thẻ kết trận của B — CHỈ
     * xuất hiện cùng lúc với số (A3.1). Trước khi B xong, ở phép đo bên trên,
     * `duong` phải VẮNG — có đường là lộ diễn biến trận của người khác trong
     * khi đề của B còn đang mở.
     */
    expect(Array.isArray(aTrongMatB2.duong)).toBe(true);
    expect(aTrongMatB2.duong.length).toBeGreaterThan(0);
    expect(aTrongMatB2.duong.at(-1)).toBe(aTrongMatB2.von_cuoi);
    // GET /matches/:id mang ban_ma để màn kết biết hỏi bảng đội.
    const tran = (await goi(B, `/api/v1/holdem/matches/${idB}`)).body;
    expect(tran.ban_ma).toBe(ma);
  });

  it('mã sai hình dạng / không tồn tại ⇒ 404 cùng một câu; bàn hết hạn ⇒ 409', async () => {
    for (const x of ['zzzzz', 'ab', 'ABCDEF']) {
      const r = await goi(A, `/api/v1/holdem/matches`, { method: 'POST', body: JSON.stringify({ ban_ma: x }) });
      expect(r.status).toBe(404);
      expect(r.body.error).toBe('ban_khong_co');
    }
    expect((await goi(A, '/api/v1/holdem/ban/zzzzz')).status).toBe(404);
    // Hết hạn: lùi het_han về quá khứ rồi thử vào bằng B2.
    const C = await createTestUser(pool);
    await pool.query(`UPDATE holdem_ban SET het_han = now() - interval '1 hour' WHERE ma = $1`, [ma]);
    const r = await goi(C, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ban_ma: ma }) });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('ban_het_han');
  });
});
