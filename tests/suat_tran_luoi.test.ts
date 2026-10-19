/**
 * LƯỚI TRẦN NGÀY Ở SERVER — `POST /api/v1/holdem/matches` (SPEC `docs/spec/tran-tran-ngay.md` mục 5).
 *
 * Cổng Worker fail-open (DO lỗi, thiếu secret, gọi thẳng Vercel ⇒ cho qua) nên đây là chốt KHÔNG mở toang được. Khoá:
 *   1. chạm trần ⇒ 503 `het_suat_ngay` + mốc mở lại 0:00 VN, và KHÔNG một dòng `holdem_matches`/`events` nào được tạo
 *   2. ⭐ hai request sát trần KHÔNG cùng lọt (đếm + INSERT trong một transaction dưới khoá tư vấn)
 *   3. ranh ngày là 0:00 giờ VN (DB lưu UTC — A8.8); trận hôm qua không tính
 *   4. admin miễn: vẫn tạo được lúc hết suất, và trận của admin không ăn suất của người thường
 *   5. server báo cổng "phiên admin" bằng header `x-dp-mien-suat` — chỉ cho admin
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { SUAT_TRAN, dauNgayVN, moLaiLuc } from '../config/suat_tran.js';
import { HetSuatNgay, demTranTu, tranNgayHieuLuc, trongLuoiNgay } from '../server/suat_tran.js';
import { currentSeasonId } from '../server/season.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let A: TestUser;
let B: TestUser;
let AD: TestUser;
let DEM: TestUser;

const TRAN = SUAT_TRAN.TRAN_NGAY_SERVER;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-suat', secureCookie: false,
    // Vitest mặc định TẮT lưới (bộ test cũ tạo > 48 trận một DB) ⇒ bài đo lưới tiêm trần thật, tường minh.
    tranNgaySuat: SUAT_TRAN.TRAN_NGAY_SERVER,
  }) as Hono<any>;
  A = await createTestUser(pool);
  B = await createTestUser(pool);
  AD = await createTestUser(pool, { role: 'admin' });
  DEM = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function tao(u: TestUser) {
  const r = await app.request('http://localhost/api/v1/holdem/matches', {
    method: 'POST', body: '{}', headers: { 'content-type': 'application/json', cookie: u.cookie },
  });
  return { status: r.status, headers: r.headers, body: await r.json() as any };
}

const demHomNay = () => demTranTu(pool, dauNgayVN(Date.now()));

const chenLot = (db: pg.Pool | pg.PoolClient, seed = 1000) => db.query(
  `INSERT INTO holdem_matches (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id)
   VALUES ($1, $2, '[]'::jsonb, 'lot', 'lot', $3)`, [DEM.userId, seed, currentSeasonId()]);

/** Đưa số trận người thường hôm nay về đúng `k` bằng trận lót (thêm, hoặc xoá bớt trận lót — trận lót không có dòng con). */
async function datDem(k: number) {
  const lech = k - await demHomNay();
  for (let i = 0; i < lech; i += 1) await chenLot(pool, 1000 + i);
  if (lech < 0) {
    await pool.query(
      `DELETE FROM holdem_matches WHERE match_id IN (
         SELECT match_id FROM holdem_matches WHERE owner_user_id = $1 AND engine_version = 'lot' AND started_at >= $2 LIMIT $3)`,
      [DEM.userId, new Date(dauNgayVN(Date.now())), -lech]);
  }
}

const soTranCua = async (u: TestUser) => Number((await pool.query(
  'SELECT count(*)::int AS n FROM holdem_matches WHERE owner_user_id = $1', [u.userId])).rows[0].n);
const soMoTranCua = async (u: TestUser) => Number((await pool.query(
  `SELECT count(*)::int AS n FROM events WHERE user_id = $1 AND action_type = 'hd_match_start'`, [u.userId])).rows[0].n);

describe('lưới trần ngày', () => {
  it('trận HÔM QUA (trước 0:00 giờ VN) không tính vào hôm nay', async () => {
    const homQua = new Date(dauNgayVN(Date.now()) - 60_000);
    await pool.query(
      `INSERT INTO holdem_matches (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id, started_at)
       VALUES ($1, 1, '[]'::jsonb, 'lot', 'lot', $2, $3)`, [DEM.userId, currentSeasonId(), homQua]);
    expect(await demHomNay()).toBe(0);
  });

  it('dưới trần ⇒ tạo trận bình thường', async () => {
    expect((await tao(A)).status).toBe(201);
  });

  it('⭐ KHOÁ: hai transaction cùng đã ĐẾM (47) trước khi bên nào kịp chèn ⇒ bên sau phải chờ khoá, đếm lại ra 48, bị chặn', async () => {
    /*
     * Hai request qua API hiếm khi đan xen đúng chỗ hở (mỗi bên làm cả trăm ms việc khác trước khi tới câu đếm) — tiêm ngược
     * "bỏ khoá" mà bài API vẫn xanh. Bài này ÉP đan xen: `lam` của cả hai treo ở một cái chốt, chỉ mở khi cả hai đã có cơ hội
     * đếm. Có khoá ⇒ bên thứ hai đứng ở `pg_advisory_xact_lock`, chưa đếm. Không khoá ⇒ cả hai đếm 47 rồi cùng chèn ⇒ 49.
     */
    await datDem(TRAN - 1);
    let mo!: () => void;
    const chot = new Promise<void>((r) => { mo = r; });
    const lamCham = async (db: pg.Pool | pg.PoolClient) => { await chot; return chenLot(db, 4242); };
    const p1 = trongLuoiNgay(pool, false, lamCham);
    const p2 = trongLuoiNgay(pool, false, lamCham);
    await new Promise((r) => setTimeout(r, 400));
    mo();
    const kq = await Promise.allSettled([p1, p2]);
    expect(kq.filter((k) => k.status === 'fulfilled')).toHaveLength(1);
    const bi = kq.find((k) => k.status === 'rejected') as PromiseRejectedResult | undefined;
    expect(bi?.reason).toBeInstanceOf(HetSuatNgay);
    expect(await demHomNay()).toBe(TRAN);
  });

  it('⭐ hai request SÁT TRẦN cùng lúc ⇒ đúng MỘT lọt', async () => {
    await datDem(TRAN - 1);
    const [ra, rb] = await Promise.all([tao(A), tao(B)]);
    expect([ra.status, rb.status].sort()).toEqual([201, 503]);
    expect(await demHomNay()).toBe(TRAN);
  });

  it('chạm trần ⇒ 503 het_suat_ngay + mở lại 0:00 VN, KHÔNG tạo dòng trận lẫn event nào', async () => {
    await datDem(TRAN);
    const truocTran = await soTranCua(A);
    const truocEv = await soMoTranCua(A);
    const r = await tao(A);
    expect(r.status).toBe(503);
    expect(r.body.error).toBe('het_suat_ngay');
    expect(r.body.mo_lai_luc).toBe(moLaiLuc(Date.now()));
    expect(Number(r.headers.get('Retry-After'))).toBeGreaterThanOrEqual(SUAT_TRAN.HOI_LAI_MIN_S);
    expect(await soTranCua(A)).toBe(truocTran);
    expect(await soMoTranCua(A)).toBe(truocEv);
  });

  it('admin MIỄN: hết suất vẫn tạo được, và không ăn suất của người thường', async () => {
    await datDem(TRAN);
    const r = await tao(AD);
    expect(r.status).toBe(201);
    expect(await demHomNay()).toBe(TRAN);
  });
});

describe('lưới bật ở đâu', () => {
  it('⭐ vắng tiêm ⇒ BẬT ở mọi nơi trừ vitest (prod không có VITEST nên quên tiêm không tắt được lưới); tiêm thì theo tiêm', () => {
    expect(tranNgayHieuLuc(undefined, {})).toBe(SUAT_TRAN.TRAN_NGAY_SERVER);
    expect(tranNgayHieuLuc(undefined, { NODE_ENV: 'production' })).toBe(SUAT_TRAN.TRAN_NGAY_SERVER);
    expect(tranNgayHieuLuc(undefined, { VITEST: 'true' })).toBeNull();
    expect(tranNgayHieuLuc(7, { VITEST: 'true' })).toBe(7);
    expect(tranNgayHieuLuc(null, {})).toBeNull();
  });
});

describe('báo cổng phiên miễn suất', () => {
  it('phản hồi đã xác thực của admin mang x-dp-mien-suat; người thường thì không', async () => {
    const hoi = (u: TestUser) => app.request('http://localhost/api/v1/holdem/me/tien-do', { headers: { cookie: u.cookie } });
    expect((await hoi(AD)).headers.get('x-dp-mien-suat')).toBe('1');
    expect((await hoi(A)).headers.get('x-dp-mien-suat')).toBeNull();
  });
});
