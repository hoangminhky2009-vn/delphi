/**
 * MỞ KHOÁ THEO TRẬN XONG (D86 founder chốt; thi công 17/08, config `MO_KHOA`).
 *
 * Founder 17/08: *"mấy cái mở cỡ map hay khẩu vị thì liên quan đ** gì phân biệt
 * trong trận đâu"* — đây là mốc tiến trình (độ dài ván + một hệ số), KHÔNG phải
 * cắt nội dung trong trận (thứ D90 bác). Canh những thứ là LUẬT:
 *   · thước là trận ĐÃ XONG (`holdem_results`), KHÔNG phải trận mở (D62: mở rồi
 *     thoát là farm được) — mở 5 trận rồi bỏ dở ⇒ vẫn khoá;
 *   · cỡ chưa mở ⇒ 403 `chua_mo_co_map` kèm SỐ TRẬN CÒN THIẾU (không im lặng
 *     rơi về 8 — màn bấm 12 mà được 8 là màn nói dối);
 *   · khẩu vị chưa mở ⇒ VỀ `can_bang`, KHÔNG chặn vào trận (⭐ D86: 5 trận đầu
 *     của mọi người cùng hệ số PnL = mẫu đối chứng sạch);
 *   · BÀN CHUNG / BÀN NGÀY / MÀN TẬP MIỄN gate — cỡ do bàn quyết, khẩu vị ghim;
 *   · `GET /me/tien-do` khai đúng thứ gate dùng (một nguồn `moKhoaTheoTran`).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, luatCua } from '../config/holdem.js';
import { coBanGhim } from '../config/luoc_bo.js';
import { moKhoaTheoTran } from '../server/holdem_api.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

// D383 — số vòng = SỐ Ô − 1 (bối cảnh mở màn `o[0]` không quyết toán vòng nào).

describe('moKhoaTheoTran — thuần', () => {
  it('D307 — CHỈ còn khoá khẩu vị; mọi cỡ bàn mở sẵn từ trận 0', () => {
    // Đường đi: D86 khoá cả ba cỡ → D300 gỡ 12 (thành cỡ mặc định) → D307 gỡ nốt 16.
    const DU = [...HOLDEM_DECISIONS.CO_MAP_CHON];
    expect(moKhoaTheoTran(0)).toEqual({
      co_map: DU, khau_vi: false, con_thieu: { khau_vi: HOLDEM_DECISIONS.MO_KHOA.KHAU_VI },
    });
    expect(moKhoaTheoTran(1).con_thieu).toEqual({ khau_vi: HOLDEM_DECISIONS.MO_KHOA.KHAU_VI - 1 });
    // Mốc đọc TỪ config, không chép số: founder đổi mốc thì bài này đi theo.
    expect(moKhoaTheoTran(HOLDEM_DECISIONS.MO_KHOA.KHAU_VI))
      .toEqual({ co_map: DU, khau_vi: true, con_thieu: {} });
    expect(moKhoaTheoTran(99)).toEqual({ co_map: DU, khau_vi: true, con_thieu: {} });
    // ⚠ Bài canh phải bắt được cú KHÔI PHỤC khoá cỡ bàn: không cỡ nào được vắng.
    for (const so of HOLDEM_DECISIONS.CO_MAP_CHON) {
      expect(moKhoaTheoTran(0).co_map, `cỡ ${so} bị khoá lại`).toContain(so);
      expect(moKhoaTheoTran(0).con_thieu[`map_${so}`], `cỡ ${so} còn đếm ngược`).toBeUndefined();
    }
  });
});

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let U: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-mk', secureCookie: false,
  }) as Hono<any>;
  U = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function goi(u: TestUser, path: string, init: RequestInit = {}) {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: u.cookie, ...(init.headers ?? {}) },
  });
  return { status: r.status, body: await r.json() as any };
}
/*
 * D406 — mặc định lật sang v54: chỉ bàn 16 (`chiBan16`) và khẩu vị tắt (`khauViTat`) ⇒ không còn gì để mở khoá trên
 * khoá mặc định. Cổng mở khoá khẩu vị + chọn cỡ vẫn là luật của v53 (bàn tập ghim v53), nên trận TỰ TẠO ở đây ghim v53;
 * bàn chung / bàn ngày / màn tập để server tự quyết khoá như người thật đi.
 */
const KHOA_BAI = 'balance-v53-upo';
const taoTran = (u: TestUser, body: Record<string, unknown>) =>
  goi(u, '/api/v1/holdem/matches', {
    method: 'POST',
    body: JSON.stringify(body.ban_ma !== undefined || body.tap ? body : { ep_balance: KHOA_BAI, ...body }),
  });

/** Ghi N dòng `holdem_results` — đúng thước `demTranXong` (không cần chơi thật). */
async function ghiTranXong(userId: string, n: number) {
  for (let i = 0; i < n; i++) {
    const m = await pool.query(
      `INSERT INTO holdem_matches (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id, che_do, status)
       VALUES ($1, $2, '[]'::jsonb, 'x', 'x', 1, 'tu_do', 'xong') RETURNING match_id`, [userId, 1000 + i]);
    await pool.query(
      `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json)
       VALUES ($1, $2, 'ban', 'nguoi', 'tom', 1, 10000, 8, '{}'::jsonb)`, [m.rows[0].match_id, userId]);
  }
}

describe('mở khoá — API', () => {
  it('⭐ D307 — người 0 trận vào được MỌI cỡ bàn; không còn cổng chua_mo_co_map', async () => {
    const td = await goi(U, '/api/v1/holdem/me/tien-do');
    expect(td.status).toBe(200);
    expect(td.body).toMatchObject({ so_tran_xong: 0, khau_vi: false });
    expect(td.body.co_map).toEqual([...HOLDEM_DECISIONS.CO_MAP_CHON]);
    expect(td.body.con_thieu).toEqual({ khau_vi: HOLDEM_DECISIONS.MO_KHOA.KHAU_VI });

    for (const so of HOLDEM_DECISIONS.CO_MAP_CHON) {
      const r = await taoTran(U, { so_o: so });
      expect(r.status, `cỡ ${so} phải vào được ngay`).toBe(201);
      expect(r.body.tong_vong, 'so ô − 1').toBe(so - 1); // D383 — bộ bài k ô chỉ chạy k−1 vòng (o[0] là bối cảnh mở màn, không quyết toán).
      expect(r.body.error).toBeUndefined();
    }
  });

  it('⭐ khẩu vị chưa mở ⇒ VỀ can_bang, KHÔNG chặn (mấy trận đầu cùng hệ số — mẫu đối chứng)', async () => {
    const r = await taoTran(U, { so_o: 8, khau_vi: 'quyet_liet' });
    expect(r.status).toBe(201);
    const row = await pool.query(`SELECT ghe_json FROM holdem_matches WHERE match_id = $1`, [r.body.match_id]);
    const ghe = row.rows[0].ghe_json as { id: string; khau_vi?: string }[];
    expect(ghe.find((g) => g.id === 'ban')?.khau_vi).toBe('can_bang');
  });

  it('⚠ TRẬN MỞ KHÔNG TÍNH — chỉ trận XONG mới mở khoá (D62: mở rồi thoát là farm được)', async () => {
    // D307 — thước đo đổi sang KHẨU VỊ (cỡ bàn thôi khoá nên không dò được bằng nó nữa).
    for (let i = 0; i < 4; i++) await taoTran(U, { so_o: 8 });
    const dangChoi = await pool.query(
      `SELECT COUNT(*)::int AS n FROM holdem_matches WHERE owner_user_id = $1 AND status = 'dang_choi'`, [U.userId]);
    expect(dangChoi.rows[0].n).toBeGreaterThanOrEqual(5);
    const td = (await goi(U, '/api/v1/holdem/me/tien-do')).body;
    expect(td.so_tran_xong).toBe(0);
    expect(td.khau_vi, 'mở nhiều trận rồi bỏ dở KHÔNG được mở khẩu vị').toBe(false);
  });

  it('⭐ D307 — xong ĐÚNG mốc trận thì khẩu vị nhận đúng; cỡ bàn không liên quan', async () => {
    await ghiTranXong(U.userId, HOLDEM_DECISIONS.MO_KHOA.KHAU_VI);
    const td = (await goi(U, '/api/v1/holdem/me/tien-do')).body;
    expect(td).toMatchObject({ so_tran_xong: HOLDEM_DECISIONS.MO_KHOA.KHAU_VI, khau_vi: true });
    expect(td.con_thieu).toEqual({});

    const r = await taoTran(U, { so_o: 8, khau_vi: 'quyet_liet' });
    const row = await pool.query(`SELECT ghe_json FROM holdem_matches WHERE match_id = $1`, [r.body.match_id]);
    expect((row.rows[0].ghe_json as { id: string; khau_vi?: string }[]).find((g) => g.id === 'ban')?.khau_vi)
      .toBe('quyet_liet');
  });

  it('⭐ BÀN CHUNG / BÀN NGÀY / MÀN TẬP — người 0 trận vào bình thường (khẩu vị ghim ở đó)', async () => {
    const M = await createTestUser(pool);
    expect((await goi(M, '/api/v1/holdem/me/tien-do')).body.so_tran_xong).toBe(0);
    // Bàn đội 16 ô do người khác phát.
    const ban = await goi(U, '/api/v1/holdem/ban', { method: 'POST', body: JSON.stringify({ so_o: 16 }) });
    const vaoBan = await taoTran(M, { ban_ma: ban.body.ma });
    expect(vaoBan.status).toBe(201);
    // D525 — cỡ bàn chung theo cỡ ghim của khoá mặc định (`coBanGhim`: v58 ⇒ 8), xin 16 hay gì cũng vậy.
    const coGhim = coBanGhim(luatCua(HOLDEM_BALANCE_VERSION));
    expect(vaoBan.body.tong_vong).toBe((coGhim ?? 16) - 1);
    // Bàn ngày — cỡ theo khoá mặc định lúc phát bàn (v54 `chiBan16` ⇒ 16, D389).
    const ngay = await goi(M, '/api/v1/holdem/ngay');
    const vaoNgay = await taoTran(M, { ban_ma: ngay.body.ma });
    expect(vaoNgay.status).toBe(201);
    const soONgay = coGhim ?? HOLDEM_DECISIONS.THU_THACH_NGAY.SO_O;
    expect(vaoNgay.body.tong_vong).toBe(soONgay - 1);
    // Màn tập.
    expect((await taoTran(M, { tap: true })).status).toBe(201);
  });
});
