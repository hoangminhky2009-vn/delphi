/**
 * BÀN NGÀY — THỬ THÁCH HÔM NAY (17/08, migration 0041; D85 §5.2 founder chốt,
 * nền của kèo T D95 "một seed/ngày").
 *
 * Canh những thứ là LUẬT:
 *   · `ngayVN`: ngày theo Asia/Ho_Chi_Minh (UTC+7 cố định), bàn đóng lúc 0:00 VN
 *     kế tiếp — vector tính tay, kể cả mốc 17:00 UTC (đúng nửa đêm VN);
 *   · `phanVi`: hạng 1-1-3 khi đồng NAV, top_pct = ceil(100·hạng/tổng), một mình = 100;
 *   · GET /holdem/ngay: find-or-create MỘT bàn mỗi ngày (gọi 2 lần ⇒ cùng mã;
 *     8 request SONG SONG ⇒ vẫn một dòng), loai 'ngay', so_o = THU_THACH_NGAY.SO_O (khoá `chiBan16` ⇒ 16 — D389/D406),
 *     het_han = 0:00 VN kế tiếp, không chủ (`chu: 'DELPHI'`, la_chu false);
 *   · vào bàn ngày = POST /matches {ban_ma} như bàn đội: khẩu vị GHIM `can_bang`
 *     dù client gửi `quyet_liet`; `hd_match_start.nguon = 'ban_ngay'`; một lượt/ngày (409);
 *   · A3.1 + D32: `thu_thach` KHÔNG có danh sách tên (`doi` rỗng), phân vị của
 *     TÔI chỉ hiện sau khi TÔI xong; số người xong công khai;
 *   · bàn hôm qua (het_han đã qua) ⇒ 409 `ban_het_han` với câu riêng của bàn ngày;
 *   · CHECK loại ở DB: bàn đội không chủ / bàn ngày không ngày đều bị từ chối.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, luatCua } from '../config/holdem.js';
import { coBanGhim } from '../config/luoc_bo.js';
import { quaManNeuCo } from './helpers/minigame.js';
import { ngayVN, phanVi } from '../server/holdem/ban_ngay.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

describe('ngayVN — thuần', () => {
  it('ngày VN + mốc đóng bàn (vector tay)', () => {
    // 16/08 23:30 VN = 16/08 16:30 UTC ⇒ vẫn ngày 16, đóng lúc 16/08 17:00 UTC.
    expect(ngayVN(new Date('2026-08-16T16:30:00Z'))).toEqual({
      ngay: '2026-08-16', het_han: new Date('2026-08-16T17:00:00Z'),
    });
    // ĐÚNG 17:00 UTC = 0:00 VN ngày 17 ⇒ đã sang ngày 17, đóng 17/08 17:00 UTC.
    expect(ngayVN(new Date('2026-08-16T17:00:00Z'))).toEqual({
      ngay: '2026-08-17', het_han: new Date('2026-08-17T17:00:00Z'),
    });
    // Sáng sớm VN (2:00 VN = 19:00 UTC hôm trước theo lịch UTC).
    expect(ngayVN(new Date('2026-08-31T19:00:00Z')).ngay).toBe('2026-09-01');
    expect(ngayVN(new Date('2026-12-31T18:00:00Z'))).toEqual({
      ngay: '2027-01-01', het_han: new Date('2027-01-01T17:00:00Z'),
    });
  });
});

describe('phanVi — thuần', () => {
  it('hạng 1-1-3 khi đồng NAV; top_pct ceil; một mình = 100; sân rỗng = hạng 1', () => {
    expect(phanVi(12_000, [12_000])).toEqual({ hang: 1, tong: 1, top_pct: 100 });
    expect(phanVi(9_000, [12_000, 11_000, 9_000, 8_000])).toEqual({ hang: 3, tong: 4, top_pct: 75 });
    expect(phanVi(12_000, [12_000, 12_000, 9_000])).toEqual({ hang: 1, tong: 3, top_pct: 34 });
    expect(phanVi(9_000, [12_000, 12_000, 9_000])).toEqual({ hang: 3, tong: 3, top_pct: 100 });
    // 1/9 ⇒ ceil(11,1) = 12 — "TOP 12%".
    expect(phanVi(20_000, [20_000, 1, 2, 3, 4, 5, 6, 7, 8]).top_pct).toBe(12);
    expect(phanVi(5, []).hang).toBe(1);
  });
});

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
    tickSecret: 'tick-bn', secureCookie: false,
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
async function choiHet(u: TestUser, id: string, tong: number) {
  for (let v = 1; v <= tong; v++) {
    const r = await nopVong(u, id, v);
    if (r.body.status === 'xong') return;
  }
}

/*
 * D406 — cỡ bàn ngày theo KHOÁ MẶC ĐỊNH lúc phát bàn: khoá có `chiBan16` (v54) thì bàn ngày cũng 16 (D389), không thì
 * `THU_THACH_NGAY.SO_O`. Ghim theo TÍNH CHẤT của khoá, không theo con số — lật khoá lần sau không phải sửa bài này.
 */
// D525 — mọi cỡ ghim của khoá mặc định (`coBanGhim`), không riêng `chiBan16`.
const SO_O_NGAY = coBanGhim(luatCua(HOLDEM_BALANCE_VERSION)) ?? HOLDEM_DECISIONS.THU_THACH_NGAY.SO_O;

describe('bàn ngày — API', () => {
  let ma = '';

  it('⭐ GET /holdem/ngay: tự phát một bàn cho hôm nay; gọi lại + 8 request song song ⇒ vẫn MỘT bàn', async () => {
    const r1 = await goi(A, '/api/v1/holdem/ngay');
    expect(r1.status).toBe(200);
    expect(r1.body.ma).toMatch(/^[a-z0-9]{5}$/);
    expect(r1.body.loai).toBe('ngay');
    expect(r1.body.so_o).toBe(SO_O_NGAY);
    expect(r1.body.chu).toBe('DELPHI');
    expect(r1.body.la_chu).toBe(false);
    expect(r1.body.toi).toBeNull();
    expect(r1.body.doi).toEqual([]);
    expect(r1.body.thu_thach).toMatchObject({ so_nguoi_vao: 0, so_nguoi_xong: 0 });
    expect(r1.body.thu_thach.hang).toBeUndefined();
    const { ngay, het_han } = ngayVN(new Date());
    expect(r1.body.thu_thach.ngay).toBe(ngay);
    expect(new Date(r1.body.het_han).getTime()).toBe(het_han.getTime());
    ma = r1.body.ma;

    const nhieu = await Promise.all(Array.from({ length: 8 }, (_, i) => goi(i % 2 ? A : B, '/api/v1/holdem/ngay')));
    expect(new Set(nhieu.map((x) => x.body.ma)).size).toBe(1);
    expect(nhieu[0]!.body.ma).toBe(ma);
    const dem = await pool.query(`SELECT COUNT(*)::int AS n FROM holdem_ban WHERE loai = 'ngay'`);
    expect(dem.rows[0].n).toBe(1);
  });

  it('⭐ vào bàn ngày: khẩu vị GHIM can_bang dù xin quyet_liet; nguon ban_ngay; một lượt/ngày', async () => {
    const ta = await goi(A, '/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ ban_ma: ma, khau_vi: 'quyet_liet', che_do: 'rank_pve' }),
    });
    expect(ta.status).toBe(201);
    expect(ta.body.ban_ma).toBe(ma);
    expect(ta.body.tong_vong).toBe(SO_O_NGAY - 1); // D383 — bộ bài k ô chỉ chạy k−1 vòng (o[0] là bối cảnh mở màn, không quyết toán).
    const row = await pool.query(
      `SELECT che_do, ghe_json FROM holdem_matches WHERE match_id = $1`, [ta.body.match_id]);
    expect(row.rows[0].che_do).toBe('tu_do');
    const ghe = row.rows[0].ghe_json as { id: string; khau_vi?: string }[];
    expect(ghe.find((g) => g.id === 'ban')?.khau_vi).toBe('can_bang');
    const ev = await pool.query(
      `SELECT value_json FROM events WHERE action_type = 'hd_match_start' AND context_id = $1`,
      [ta.body.match_id]);
    expect(ev.rows[0]!.value_json.nguon).toBe('ban_ngay');
    expect(ev.rows[0]!.value_json.ban_ma).toBe(ma);
    // Lượt thứ hai trong ngày ⇒ 409 kèm trận cũ.
    const lai = await goi(A, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ban_ma: ma }) });
    expect(lai.status).toBe(409);
    expect(lai.body.error).toBe('da_vao_ban');
    expect(lai.body.match_id).toBe(ta.body.match_id);
    // /holdem/ngay giờ biết TÔI đang chơi, và đếm 1 người vào.
    const nhin = (await goi(A, '/api/v1/holdem/ngay')).body;
    expect(nhin.toi.match_id).toBe(ta.body.match_id);
    expect(nhin.thu_thach.so_nguoi_vao).toBe(1);
  });

  it('⭐ A3.1 + D32: phân vị của TÔI chỉ sau khi TÔI xong; không danh sách tên; số người xong công khai', async () => {
    const tb = await goi(B, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ban_ma: ma }) });
    expect(tb.status).toBe(201);
    // A chơi hết; B chưa.
    const idA = (await goi(A, '/api/v1/holdem/ngay')).body.toi.match_id as string;
    await choiHet(A, idA, SO_O_NGAY);
    const nhinA = (await goi(A, '/api/v1/holdem/ngay')).body;
    expect(nhinA.toi_da_xong).toBe(true);
    expect(nhinA.doi).toEqual([]);                       // D32: không top-N, không tên
    expect(nhinA.thu_thach.so_nguoi_vao).toBe(2);
    expect(nhinA.thu_thach.so_nguoi_xong).toBe(1);
    expect(nhinA.thu_thach).toMatchObject({ hang: 1, tong: 1, top_pct: 100 });
    expect(typeof nhinA.thu_thach.nav).toBe('number');
    // B chưa xong: thấy số người, KHÔNG thấy hạng/nav của mình (chưa có), không thấy của A.
    const nhinB = (await goi(B, `/api/v1/holdem/ban/${ma}`)).body;
    expect(nhinB.loai).toBe('ngay');
    expect(nhinB.toi_da_xong).toBe(false);
    expect(nhinB.thu_thach.so_nguoi_xong).toBe(1);
    expect(nhinB.thu_thach.hang).toBeUndefined();
    expect(nhinB.thu_thach.nav).toBeUndefined();
    expect(JSON.stringify(nhinB)).not.toContain(A.handle);
    // B xong ⇒ có hạng trong sân 2 người; hạng + tong nhất quán với A nhìn lại.
    await choiHet(B, tb.body.match_id, SO_O_NGAY);
    const nhinB2 = (await goi(B, '/api/v1/holdem/ngay')).body;
    expect(nhinB2.thu_thach.tong).toBe(2);
    expect([1, 2]).toContain(nhinB2.thu_thach.hang);
    const nhinA2 = (await goi(A, '/api/v1/holdem/ngay')).body;
    expect(nhinA2.thu_thach.tong).toBe(2);
    expect(nhinA2.thu_thach.so_nguoi_xong).toBe(2);
  });

  it('bàn hôm qua đã đóng ⇒ 409 ban_het_han (câu của bàn ngày); DB CHECK theo loại', async () => {
    const C = await createTestUser(pool);
    await pool.query(`UPDATE holdem_ban SET het_han = now() - interval '1 hour' WHERE ma = $1`, [ma]);
    const r = await goi(C, '/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ban_ma: ma }) });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('ban_het_han');
    expect(r.body.message).toMatch(/hôm nay có bàn mới/);
    // Bàn đội không chủ ⇒ DB từ chối; bàn ngày không ngày ⇒ DB từ chối.
    await expect(pool.query(
      `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, loai, het_han) VALUES ('zzz01', 1, 8, NULL, 'doi', now())`,
    )).rejects.toThrow(/holdem_ban_loai_chk/);
    await expect(pool.query(
      `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, loai, ngay, het_han) VALUES ('zzz02', 1, 8, NULL, 'ngay', NULL, now())`,
    )).rejects.toThrow(/holdem_ban_loai_chk/);
    // Ngày mới (giả lập: dời ngày dòng cũ về hôm qua) ⇒ /ngay phát bàn MỚI, mã khác.
    await pool.query(`UPDATE holdem_ban SET ngay = ngay - 1 WHERE ma = $1`, [ma]);
    const moi = (await goi(C, '/api/v1/holdem/ngay')).body;
    expect(moi.ma).not.toBe(ma);
    expect(moi.thu_thach.so_nguoi_vao).toBe(0);
  });
});
