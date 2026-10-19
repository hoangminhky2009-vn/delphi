/**
 * D341 — KHU SẢN PHẨM ĐỌC THEO KHOẢNG NGÀY (`server/admin_san_pham.ts`).
 *
 * Founder 16/09 trên prod: đổi mốc Hôm nay / 7 / 30 ngày ở `/quan-tri?khu=sp` mà số không đổi. Đo trước khi sửa: phễu
 * đăng ký `3→3→3→3` ở cả ba mốc, "màn cuối" ở Hôm nay rỗng vĩnh viễn, bốn mặt còn lại không nhận khoảng nào.
 *
 * ⚠ CÁCH BÀI NÀY CANH: hỏi CÙNG một route ở NHIỀU khoảng trên MỘT bộ dữ liệu dựng tay — số phải đổi đúng như đếm tay.
 *   Một route bỏ qua khoảng thì mọi khoảng ra cùng một số và ít nhất một cặp khẳng định đỏ. Không kỳ vọng nào chép từ
 *   kết quả chạy.
 *
 * D = hôm nay (ngày VN lúc chạy); "D−3 23:59:30" là giờ VN. Mọi thứ cần "đã im ≥ 24 giờ" nằm ở D−2 trở về trước, nên
 * bài không phụ thuộc giờ chạy.
 *
 *  người | tạo tài khoản | dữ liệu
 *  a1    | D−20 10:00    | telemetry ĐẦU TIÊN của kho (⇒ tho_tu = D−20): đăng nhập + /arena · trận xong D−20 (hạng 1/4)
 *  a2    | D−3 10:00     | D−2: đăng nhập 12 s → /arena · hướng dẫn mo-shop → het → /arena · trận xong 10 phút (bét 4/4)
 *        |               |      · tran_thoat vòng 3 · 2 cú sập 'render' · kèo A 100 + B 50, thấy pool rồi chỉnh
 *        |               | D−1 10:00: mở /hub (quay lại ⇒ KHÔNG "biến mất" ở D−2)
 *  a3    | D−3 23:59:30  | NỬA ĐÊM (thuộc D−3) · một trận ÉP THAM SỐ D−2 · màn cuối /shop D−2 01:00
 *  a4    | D−2 00:00:30  | NỬA ĐÊM (thuộc D−2) · màn cuối /hub D−2 20:00 · bước hướng dẫn mo-shop D−1 23:59:59 · kèo A 100 D−10
 *  off   | D−3 13:00     | ĐÃ TẮT GHI · trận bỏ dở bắt đầu D−2 00:00:30, nước cuối phút 5, vòng 3 · và đủ loại telemetry
 *        |               |   D−2 (đăng nhập 40 s, hướng dẫn, thoát, sập, màn) — telemetry KHÔNG được đếm, trận thì CÓ
 *  adm   | D−3 12:00     | quản trị · đăng nhập 30 s D−2 · trận xong D−2 · kèo A 70 D−2
 *  tst   | D−3 12:30     | tài khoản thử · trận xong D−2
 *  del   | D−3 14:00     | đã xoá
 *  —     | D−3 15:00     | tài khoản email chưa lập hồ sơ, chưa xác minh
 *  b1    | D−40 09:00    | ba trận bét liên tiếp D−9 · D−8 · D−7 (một event ở trận D−7) · MỘT trận chế độ rank_pve D−8 (một
 *        |               |   event) — cùng phiên bản, khác chế độ: event không được cộng chéo giữa hai dòng
 *  khách | —             | màn đăng ký: phiên p1 mở + gửi D−2 · phiên p2 mở D−20
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { congNgay, ngayVN } from '../server/admin_phan_tich.js';
import { cuaGopHoSo } from '../server/rieng_tu.js';
import { HOLDEM_BALANCE_VERSION } from '../config/holdem.js';
import type {
  HanhTrinhTraVe, KeoTraVe, PhienBanTraVe, TinhCachTraVe, TongQuanTraVe, TranTraVe,
} from '../server/admin_phan_tich_ids.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let admin: TestUser;
const U: Record<string, TestUser> = {};

const D = ngayVN(Date.now());
const ngay = (lui: number): string => congNgay(D, -lui);
/** Mốc UTC (ISO) của giờ VN hh:mm:ss trong ngày D−lui (lui âm = tương lai). */
const luc = (lui: number, gio: number, phut = 0, giay = 0): string =>
  new Date(Date.parse(`${ngay(lui)}T00:00:00Z`) - 7 * 3_600_000 + ((gio * 60 + phut) * 60 + giay) * 1000).toISOString();
const khoang = (tuLui: number, denLui: number) => `tu=${ngay(tuLui)}&den=${ngay(denLui)}`;

const goi = async <T>(duong: string): Promise<T> => {
  const r = await app.request(duong, { headers: { cookie: admin.cookie } });
  expect(r.status, duong).toBe(200);
  return r.json() as Promise<T>;
};

/** Telemetry chèn THEO THỨ TỰ THỜI GIAN của từng người — `id` là thứ tự đọc dòng của một người (luật 7). */
async function tele(u: TestUser | null, loai: string, ts: string, o: { man?: string; ms?: number; ct?: object; phien?: string } = {}) {
  await pool.query(
    `INSERT INTO telemetry (user_id, phien, ts, loai, man, ms, chi_tiet) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [u?.userId ?? null, o.phien ?? null, ts, loai, o.man ?? null, o.ms ?? null, o.ct ? JSON.stringify(o.ct) : null]);
}

async function tran(u: TestUser, o: {
  st: 'xong' | 'bo_dở' | 'dang_choi'; bd: string; kt?: string; hang?: number; cheat?: boolean; vong?: number;
  cheDo?: string;
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO holdem_matches
       (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json, engine_version, balance_version,
        season_id, started_at, ended_at, so_o, co_ep_tham_so, che_do)
     VALUES ($1, 1, $2, $3, '[]'::jsonb, '[]'::jsonb, 'e', $4, '2026Q3', $5, $6, 12, $7, $8)
     RETURNING match_id::text AS id`,
    [u.userId, o.st, o.vong ?? 8, HOLDEM_BALANCE_VERSION, o.bd, o.kt ?? null, o.cheat ?? false, o.cheDo ?? 'tu_do']);
  const id = rows[0].id as string;
  if (o.hang !== undefined) {
    await pool.query(
      `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json, created_at)
       VALUES ($1, $2, 'ban', 'nguoi', 'tom', $3, 1000, 8, '{}'::jsonb, $4)`, [id, u.userId, o.hang, o.bd]);
    let bot = 0;
    for (let h = 1; h <= 4; h++) {
      if (h === o.hang) continue;
      await pool.query(
        `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json, created_at)
         VALUES ($1, NULL, $2, 'bot', 'tom', $3, 900, 8, '{}'::jsonb, $4)`, [id, `b${bot++}`, h, o.bd]);
    }
  }
  return id;
}

async function suKien(u: TestUser, ts: string, ctxType: string, ctx: string, loai: string) {
  await pool.query(
    `INSERT INTO events (user_id, ts, context_type, context_id, action_type) VALUES ($1, $2, $3, $4, $5)`,
    [u.userId, ts, ctxType, ctx, loai]);
}

beforeAll(async () => {
  db = await startTestDb();
  /*
   * ⚠ PHIÊN UTC NHƯ PROD. Postgres nhúng lấy múi giờ của máy chạy test — đo 16/09: `Asia/Bangkok` (+07, TRÙNG độ lệch
   * Việt Nam) — còn Supabase chạy UTC. Trên phiên +07 một câu lỡ dùng `::date` trần vẫn ra đúng ngày VN và mọi bài
   * xanh; lên prod nó lệch 7 tiếng. Pool riêng ép UTC để bài này ĐỎ được đúng lỗi đó (§0 canh chính việc ép).
   */
  pool = new pg.Pool({ connectionString: (db.pool as unknown as { options: { connectionString: string } }).options.connectionString, max: 5 });
  pool.on('connect', (cn) => { void cn.query(`SET TIME ZONE 'UTC'`); });
  pool.on('error', () => {});
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
  await ensureGenesis(pool);
  admin = await createTestUser(pool, { role: 'admin' });
  await moCuaAdmin(pool, admin);
  // Người xem tự loại khỏi mọi số (quản trị) — dời ngày tạo ra xa để không lẫn vào khoảng nào của bài.
  await pool.query(`UPDATE users SET created_at = $2 WHERE user_id = $1`, [admin.userId, luc(80, 9)]);
  await pool.query(`UPDATE auth_accounts SET created_at = $2 WHERE user_id = $1`, [admin.userId, luc(80, 9)]);

  const tao = async (ten: string, taoLuc: string, o: { bat?: boolean; admin?: boolean; tester?: boolean; xoa?: boolean } = {}) => {
    const u = await createTestUser(pool, { role: o.admin ? 'admin' : 'user' });
    await pool.query(
      `UPDATE users SET created_at = $2, research_consent = $3, la_tester = $4, deleted_at = $5 WHERE user_id = $1`,
      [u.userId, taoLuc, o.bat ?? true, o.tester ?? false, o.xoa ? luc(1, 9) : null]);
    await pool.query(`UPDATE auth_accounts SET created_at = $2, email_verified_at = $2 WHERE user_id = $1`, [u.userId, taoLuc]);
    U[ten] = u;
    return u;
  };
  const a1 = await tao('sp_a1', luc(20, 10));
  const a2 = await tao('sp_a2', luc(3, 10));
  const a3 = await tao('sp_a3', luc(3, 23, 59, 30));
  const a4 = await tao('sp_a4', luc(2, 0, 0, 30));
  const off = await tao('sp_off', luc(3, 13), { bat: false });
  const adm = await tao('sp_adm', luc(3, 12), { admin: true });
  const tst = await tao('sp_tst', luc(3, 12, 30), { tester: true });
  await tao('sp_del', luc(3, 14), { xoa: true });
  const b1 = await tao('sp_b1', luc(40, 9));
  await pool.query(
    `INSERT INTO auth_accounts (email, password_hash, email_verified_at, user_id, created_at)
     VALUES ('sp_chua_ho_so@test.local', 'x', NULL, NULL, $1)`, [luc(3, 15)]);

  /* ── TELEMETRY — theo thứ tự thời gian ──────────────────────────────────── */
  await tele(null, 'dang_ky_buoc', luc(20, 8), { phien: '22222222-2222-4222-a222-222222222222', ct: { buoc: 'mo-dang-ky' } });
  await tele(a1, 'dang_nhap', luc(20, 10, 1));
  await tele(a1, 'man_ra', luc(20, 10, 1, 1), { man: '/onboard', ms: 99_000 });
  await tele(a1, 'man_vao', luc(20, 10, 1, 2), { man: '/arena' });

  await tele(null, 'dang_ky_buoc', luc(2, 8), { phien: '11111111-1111-4111-a111-111111111111', ct: { buoc: 'mo-dang-ky' } });
  await tele(null, 'dang_ky_buoc', luc(2, 8, 1), { phien: '11111111-1111-4111-a111-111111111111', ct: { buoc: 'gui-dang-ky' } });

  await tele(a2, 'dang_nhap', luc(2, 9));
  await tele(a2, 'man_ra', luc(2, 9, 0, 1), { man: '/onboard', ms: 12_000 });
  await tele(a2, 'man_vao', luc(2, 9, 0, 2), { man: '/arena' });
  await tele(a2, 'huong_dan_buoc', luc(2, 9, 5), { ct: { buoc: 'mo-shop' } });
  await tele(a2, 'huong_dan_buoc', luc(2, 9, 10), { ct: { buoc: 'het' } });
  await tele(a2, 'man_vao', luc(2, 9, 11), { man: '/arena' });
  await tele(a2, 'tran_thoat', luc(2, 10, 20), { ct: { vong: 3, giay: 200 } });
  await tele(a2, 'loi_client', luc(2, 10, 30), { ct: { ma: 'render' } });
  await tele(a2, 'loi_client', luc(2, 10, 31), { ct: { ma: 'render' } });

  await tele(off, 'dang_nhap', luc(2, 9, 30));
  await tele(off, 'man_ra', luc(2, 9, 30, 1), { man: '/onboard', ms: 40_000 });
  await tele(off, 'man_vao', luc(2, 9, 30, 2), { man: '/shop' });
  await tele(off, 'huong_dan_buoc', luc(2, 9, 31), { ct: { buoc: 'mo-shop' } });
  await tele(off, 'huong_dan_buoc', luc(2, 9, 32), { ct: { buoc: 'het' } });
  await tele(off, 'tran_thoat', luc(2, 9, 40), { ct: { vong: 5, giay: 300 } });
  await tele(off, 'loi_client', luc(2, 9, 41), { ct: { ma: 'render' } });

  await tele(adm, 'dang_nhap', luc(2, 11));
  await tele(adm, 'man_ra', luc(2, 11, 0, 1), { man: '/onboard', ms: 30_000 });
  await tele(adm, 'man_vao', luc(2, 11, 0, 2), { man: '/admin' });

  await tele(a3, 'man_vao', luc(2, 1), { man: '/shop' });
  await tele(a4, 'man_vao', luc(2, 20), { man: '/hub' });
  await tele(a4, 'huong_dan_buoc', luc(1, 23, 59, 59), { ct: { buoc: 'mo-shop' } });
  await tele(a2, 'man_vao', luc(1, 10), { man: '/hub' });

  /* ── TRẬN ───────────────────────────────────────────────────────────────── */
  await tran(a1, { st: 'xong', bd: luc(20, 11), kt: luc(20, 11, 20), hang: 1 });
  await tran(a2, { st: 'xong', bd: luc(2, 10), kt: luc(2, 10, 10), hang: 4 });
  const boDo = await tran(off, { st: 'bo_dở', bd: luc(2, 0, 0, 30), kt: luc(1, 1), vong: 3 });
  await suKien(off, luc(2, 0, 5, 30), 'holdem', boDo, 'hd_chot_phien');
  await suKien(off, luc(1, 1), 'holdem', boDo, 'hd_tran_het_han');
  await tran(a3, { st: 'xong', bd: luc(2, 12), kt: luc(2, 12, 30), cheat: true });
  await tran(adm, { st: 'xong', bd: luc(2, 13), kt: luc(2, 13, 30) });
  await tran(tst, { st: 'xong', bd: luc(2, 14), kt: luc(2, 14, 30) });
  for (const lui of [9, 8, 7]) {
    const id = await tran(b1, { st: 'xong', bd: luc(lui, 20), kt: luc(lui, 20, 30), hang: 4 });
    if (lui === 7) await suKien(b1, luc(7, 20, 10), 'holdem', id, 'hd_chot_phien');
  }
  const pve = await tran(b1, { st: 'xong', bd: luc(8, 21), kt: luc(8, 21, 30), cheDo: 'rank_pve' });
  await suKien(b1, luc(8, 21, 10), 'holdem', pve, 'hd_chot_phien');

  /* ── KÈO ────────────────────────────────────────────────────────────────── */
  const { rows: [mk] } = await pool.query(
    `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url, open_ts, lock_ts,
                          resolve_deadline_ts, status, seed_per_option, season_id, created_by)
     VALUES ('life', 'Kèo khoảng', 'n', 'https://x', $1, $2, $3, 'open', 0, '2026Q3', $4) RETURNING market_id`,
    [luc(12, 10), luc(-2, 10), luc(-3, 10), admin.userId]);
  const { rows: op } = await pool.query(
    `INSERT INTO market_options (market_id, label, sort_order) VALUES ($1,'A',0),($1,'B',1) RETURNING option_id`,
    [mk.market_id]);
  const cuoc = (u: TestUser, cua: number, n: number, ts: string) => pool.query(
    `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed, created_at) VALUES ($1, $2, $3, $4, false, $5)`,
    [mk.market_id, op[cua]!.option_id, u.userId, n, ts]);
  await suKien(a4, luc(10, 9, 59), 'market', mk.market_id, 'pool_reveal');
  await cuoc(a4, 0, 100, luc(10, 10));
  await suKien(a2, luc(2, 9, 59), 'market', mk.market_id, 'pool_reveal');
  await cuoc(a2, 0, 100, luc(2, 10));
  await cuoc(a2, 1, 50, luc(2, 10, 5));
  await suKien(a2, luc(2, 10, 5), 'market', mk.market_id, 'bet_adjust');
  await cuoc(adm, 0, 70, luc(2, 11));
}, 180_000);

afterAll(async () => { await pool?.end(); await db?.stop(); });

// ═══════════════════════════════════════════════════════════════════════════
describe('0. Dụng cụ đo', () => {
  it('phiên DB của bài này là UTC như prod (thiếu nó thì lỗi "ngày theo múi giờ phiên" không bao giờ đỏ ở đây)', async () => {
    const { rows } = await pool.query(`SELECT current_setting('TimeZone') AS tz`);
    expect(rows[0].tz).toBe('UTC');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('I. HÀNH TRÌNH — mỗi khoảng một bộ số', () => {
  const ht = (qs: string) => goi<HanhTrinhTraVe>(`/api/v1/admin/tk/hanh-trinh?${qs}`);
  const pheu = (b: HanhTrinhTraVe) => b.phieu_dang_ky.map((x) => x.so_nguoi);

  it('⭐ phễu đăng ký đổi theo khoảng — ca founder bắt (trước D341: cùng một số ở mọi mốc)', async () => {
    // [D−3, D−1]: a2 · a3 (23:59:30 D−3) · a4 (00:00:30 D−2) · off · tài khoản email chưa hồ sơ. adm/tst/del loại.
    // xác minh: trừ tài khoản chưa xác minh = 4 · hồ sơ = 4 · đã chơi (trận KHÔNG ép tham số): a2, off = 2.
    expect(pheu(await ht(khoang(3, 1)))).toEqual([5, 4, 4, 2]);
    // [D−2, D−2]: chỉ a4 — a3 tạo 23:59:30 D−3 KHÔNG thuộc D−2 (biên nửa đêm VN, không phải UTC).
    expect(pheu(await ht(khoang(2, 2)))).toEqual([1, 1, 1, 0]);
    // [D−3, D−3]: a2 · a3 · off · tài khoản chưa hồ sơ.
    expect(pheu(await ht(khoang(3, 3)))).toEqual([4, 3, 3, 2]);
    // Hôm nay: không ai ⇒ tỷ lệ null, KHÔNG phải 0% (A11.2).
    const nay = await ht(khoang(0, 0));
    expect(pheu(nay)).toEqual([0, 0, 0, 0]);
    expect(nay.phieu_dang_ky.every((x) => x.ty_le_con_lai === null)).toBe(true);
    // Thiếu tu/den ⇒ 30 ngày tới hôm nay: thêm a1 (D−20, có trận).
    expect(pheu(await ht(''))).toEqual([6, 5, 5, 3]);
  });

  it('khoảng máy chủ trả về là khoảng đã kẹp, kèm tho_tu', async () => {
    const b = await ht(khoang(3, 1));
    expect([b.khoang.tu, b.khoang.den, b.khoang.so_ngay, b.khoang.tho_tu]).toEqual([ngay(3), ngay(1), 3, ngay(20)]);
  });

  it('đăng nhập · đi đâu · hướng dẫn: chỉ người đang bật ghi, chỉ trong khoảng', async () => {
    const b = await ht(khoang(3, 1));
    // a2 (12 s). off (40 s, tắt ghi) và adm (30 s, quản trị) không vào; a1 ở D−20.
    expect(b.dang_nhap).toEqual({ so_lan: 1, giay_p50: 12, giay_p90: 12 });
    expect(b.sau_dang_nhap).toEqual([{ man: '/arena', n: 1 }]);
    // a2 mo-shop → het (rồi mở /arena ⇒ ở lại) · a4 mo-shop lúc 23:59:59 D−1 (vẫn thuộc khoảng). off loại.
    expect(b.huong_dan).toMatchObject({ bat_dau: 2, di_het: 1, tu_tat: 0, xong_roi_o_lai: 1, xong_roi_di_luon: 0 });
    const buoc = Object.fromEntries(b.huong_dan!.buoc.map((x) => [x.buoc, x.so_nguoi]));
    expect([buoc['mo-shop'], buoc.het]).toEqual([2, 1]);
    // [D−2, D−2]: bước của a4 nằm ở D−1 ⇒ còn một mình a2.
    expect((await ht(khoang(2, 2))).huong_dan!.bat_dau).toBe(1);
  });

  it('màn đăng ký (lượt, theo phiên) · cú sập · client kịp báo thoát — cắt theo khoảng', async () => {
    const b = await ht(khoang(3, 1));
    expect(b.man_dang_ky!.map((x) => [x.buoc, x.so_nguoi])).toEqual([['mo-dang-ky', 1], ['gui-dang-ky', 1]]);
    expect(b.loi_client).toEqual([{ ma: 'render', n: 2 }]); // cú sập của off (tắt ghi) không vào
    expect(b.tran.client_kip_bao).toBe(1);
    const x = await ht(khoang(20, 20));
    expect(x.man_dang_ky!.map((y) => [y.buoc, y.so_nguoi])).toEqual([['mo-dang-ky', 1], ['gui-dang-ky', 0]]);
    expect(x.loi_client).toEqual([]);
  });

  it('⭐ trận: đúng tập trận của khu TỔNG QUAN trong cùng khoảng (một khoảng, một con số)', async () => {
    const b = await ht(khoang(3, 1));
    // a2 xong 10 phút · off bỏ dở (TRẬN không qua cổng ghi — trận là trạng thái vận hành). a3 ép tham số, adm, tst loại.
    expect(b.tran).toMatchObject({ so_lan_vao: 2, so_xong: 1, so_lan_bo_do: 1, so_dang_choi: 0, phut_p50: 10 });
    // Nước cuối của off ở phút 5; event bộ quét dọn ở D−1 01:00 bị loại, `ended_at` không dùng.
    expect(b.tran.bo_do_theo_phut).toEqual([{ phut: 5, n: 1 }]);
    expect(b.tran.bo_do_theo_vong).toEqual([{ vong: 3, n: 1 }]);
    const tq = await goi<TongQuanTraVe>(`/api/v1/admin/pt/tong-quan?${khoang(3, 1)}`);
    expect(tq.nay.tran).toBe(b.tran.so_lan_vao);
    // Bật công tắc gồm: + adm + tst + trận ép tham số của a3 = 5 — tổng quan (một công tắc) cũng ra 5.
    const g = await ht(`${khoang(3, 1)}&gom_admin=1&gom_tester=1`);
    const tqg = await goi<TongQuanTraVe>(`/api/v1/admin/pt/tong-quan?${khoang(3, 1)}&gom=1`);
    expect([g.tran.so_lan_vao, tqg.nay.tran]).toEqual([5, 5]);
    expect(g.dang_nhap!.so_lan).toBe(2); // + adm
  });

  it('⭐ màn cuối: lần xem màn CUỐI CÙNG rơi vào khoảng, người quay lại sau khoảng không tính', async () => {
    const b = await ht(khoang(3, 2));
    // a3 /shop (D−2 01:00) · a4 /hub (D−2 20:00). a2 xem /arena D−2 nhưng QUAY LẠI /hub D−1 ⇒ chưa biến mất ở khoảng
    // này. off tắt ghi, adm quản trị. a1 ở D−20.
    expect(b.man_cuoi).toEqual({
      trang_thai: 'co', tinh_toi: luc(1, 0), dong: [{ man: '/hub', n: 1 }, { man: '/shop', n: 1 }],
    });
  });

  it('⭐ màn cuối ở mốc Hôm nay nói "chưa đủ 24 giờ" thay vì một bảng rỗng (trước D341: rỗng vĩnh viễn)', async () => {
    expect((await ht(khoang(0, 0))).man_cuoi).toEqual({ trang_thai: 'chua_du_24h' });
    // Khoảng tới hôm nay dài hơn 24 giờ ⇒ đo được, chặn trên ở 24 giờ trước lúc đọc.
    const b = await ht(khoang(6, 0));
    expect(b.man_cuoi.trang_thai).toBe('co');
    if (b.man_cuoi.trang_thai === 'co') {
      expect(Math.abs(Date.parse(b.man_cuoi.tinh_toi) - (Date.now() - 24 * 3_600_000))).toBeLessThan(120_000);
    }
  });

  it('khoảng trước tho_tu: khối telemetry null (không phải 0), khối trạng thái bền vẫn có số', async () => {
    const b = await ht(khoang(25, 21));
    expect([b.do_duoc, b.cat_tho]).toEqual([false, false]);
    expect([b.dang_nhap, b.sau_dang_nhap, b.huong_dan, b.man_dang_ky, b.loi_client, b.tran.client_kip_bao])
      .toEqual([null, null, null, null, null, null]);
    expect(b.man_cuoi).toEqual({ trang_thai: 'khong_do_duoc' });
    // Khoảng vắt qua tho_tu: đo được, và nói ra phần đầu bị cắt.
    const v = await ht(khoang(25, 18));
    expect([v.do_duoc, v.cat_tho, v.dang_nhap!.so_lan]).toEqual([true, true, 1]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. TRẬN & HẠNG — phiên bản VÀ khoảng', () => {
  const tr = (qs: string) => goi<TranTraVe>(`/api/v1/admin/tk/tran?${qs}`);

  it('mẫu · phân bố hạng · thoát theo vòng đổi theo khoảng', async () => {
    const b = await tr(khoang(3, 1));
    expect(b.mau).toMatchObject({ tran: 2, xong: 1, nguoi: 2 });
    expect(b.phan_bo_hang).toEqual([{ hang: 4, so_ghe: 4, n: 1 }]);
    expect(b.thoat_theo_vong).toEqual([{ vong: 3, n: 1 }]); // off (vòng 5) tắt ghi
    const x = await tr(khoang(20, 20));
    expect(x.mau).toMatchObject({ tran: 1, xong: 1, nguoi: 1 });
    expect(x.phan_bo_hang).toEqual([{ hang: 1, so_ghe: 4, n: 1 }]);
    expect(x.thoat_theo_vong).toEqual([]);
    expect((await tr(khoang(25, 21))).thoat_theo_vong).toBeNull();
  });

  it('chuỗi về bét tính trên trận TRONG khoảng — khoảng cắt ngang thì chuỗi ngắn lại', async () => {
    expect((await tr(khoang(9, 7))).chuoi_ve_bet).toEqual({ dai_nhat: 3, so_lan_tu_3: 1, nguoi_dinh: 1 });
    expect((await tr(khoang(8, 7))).chuoi_ve_bet).toEqual({ dai_nhat: 2, so_lan_tu_3: 0, nguoi_dinh: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. KÈO DỰ BÁO', () => {
  const k = (qs: string) => goi<KeoTraVe>(`/api/v1/admin/tk/keo?${qs}`);

  it('khẩu vị · bầy đàn · kèo trong khoảng đổi theo khoảng', async () => {
    const b = await k(khoang(3, 1));
    // a2: A 100 + B 50 ⇒ dồn 100/150 = 0,667. adm (quản trị) loại.
    expect(b.khau_vi_rui_ro).toEqual({ n: 1, tb: 0.667, p50: 0.667, tat_tay: 0 });
    expect(b.bay_dan).toEqual({ da_thay: 1, co_chinh_sau: 1 });
    expect(b.keo_trong_khoang.map((x) => [x.question_text, x.nguoi, x.volume])).toEqual([['Kèo khoảng', 1, '150']]);
    // Khoá sau 96 giờ ⇒ rổ tràn 7 của width_bucket(0..72, 6 rổ).
    expect(b.dat_truoc_gio_khoa).toEqual([{ o: 7, n: 2 }]);

    const x = await k(khoang(12, 8));
    // a4: tất tay A 100 ở D−10; thấy pool mà không chỉnh. Kèo mở D−12 cũng thuộc khoảng.
    expect(x.khau_vi_rui_ro).toEqual({ n: 1, tb: 1, p50: 1, tat_tay: 1 });
    expect(x.bay_dan).toEqual({ da_thay: 1, co_chinh_sau: 0 });
    expect(x.keo_trong_khoang.map((y) => [y.nguoi, y.volume])).toEqual([[1, '100']]);

    const trong = await k(khoang(30, 25));
    expect(trong.khau_vi_rui_ro).toEqual({ n: 0, tb: null, p50: null, tat_tay: 0 });
    expect(trong.keo_trong_khoang).toEqual([]);

    expect((await k(`${khoang(3, 1)}&gom_admin=1&gom_tester=1`)).khau_vi_rui_ro.n).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. TÍNH CÁCH — người có trận trong khoảng (founder chốt 16/09)', () => {
  it('cửa gom nhận khoảng: đúng tập người có trận bắt đầu trong khoảng', async () => {
    const tap = async (tuLui: number, denLui: number) =>
      (await cuaGopHoSo(pool, { khoang: { tu: ngay(tuLui), den: ngay(denLui) } })).user_ids;
    // a2 · a3 (trận ép tham số vẫn là trận — cửa gom không lọc cờ đó, như trước). off tắt ghi ⇒ bị loại khỏi tập.
    expect(await tap(3, 1)).toEqual([U.sp_a2!.userId, U.sp_a3!.userId]);
    expect(await tap(9, 7)).toEqual([U.sp_b1!.userId]);
    expect(await tap(20, 20)).toEqual([U.sp_a1!.userId]);
    expect(await tap(30, 25)).toEqual([]);
  });

  it('route: số người bị loại vì chưa đồng ý cũng theo khoảng', async () => {
    const tc = (qs: string) => goi<TinhCachTraVe>(`/api/v1/admin/tk/tinh-cach?${qs}`);
    const b = await tc(khoang(3, 1));
    expect([b.bo_qua_chua_dong_y, b.khoang.tu, b.khoang.den]).toEqual([1, ngay(3), ngay(1)]);
    expect((await tc(khoang(9, 7))).bo_qua_chua_dong_y).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('V. PHIÊN BẢN — kho của các trận bắt đầu trong khoảng', () => {
  const pb = (qs: string) => goi<PhienBanTraVe>(`/api/v1/admin/tk/phien-ban?${qs}`);

  it('đếm trận/event trong khoảng; ngày đầu/cuối là NGÀY VIỆT NAM', async () => {
    const b = await pb(khoang(3, 1));
    const d = b.dong.find((x) => x.ver === HOLDEM_BALANCE_VERSION && x.che_do === 'tu_do')!;
    // a2 (xong) · off (bỏ dở, 2 event). Trận off bắt đầu 00:00:30 D−2 giờ VN = 17:00:30 D−3 UTC ⇒ `tu` phải là D−2.
    expect([d.tran, d.xong, d.bo_do, d.nguoi, d.n_events, d.tu, d.den]).toEqual([2, 1, 1, 2, 2, ngay(2), ngay(2)]);
    expect(b.tong).toEqual({ tran: 2, events: 2, so_phien_ban: 1 });
    expect((await pb(khoang(30, 25))).dong).toEqual([]);
  });

  it('⚠ event theo (phiên bản, CHẾ ĐỘ): một phiên bản hai chế độ không bị cộng event hai lần', async () => {
    // [D−9, D−7] của b1: ba trận tu_do (một event) + một trận rank_pve (một event). Trước D341 khoá chỉ là phiên bản
    // ⇒ mỗi dòng nhận 2 và tổng thành 4.
    const b = await pb(khoang(9, 7));
    expect(b.dong.map((d) => [d.che_do, d.tran, d.n_events])).toEqual([['tu_do', 3, 1], ['rank_pve', 1, 1]]);
    expect(b.tong).toEqual({ tran: 4, events: 2, so_phien_ban: 1 });
  });
});
