/**
 * D359 — BÀN TẬP TÁCH KHỎI TRẬN THẬT trên mọi mặt quản trị.
 *
 * Founder 20/09: *"bàn tập chỉ thu dữ liệu product cho phần hướng dẫn thôi. Màn chơi thật thu dữ liệu phổ thông."*
 *
 * ⚠ VÌ SAO 61 BÀI ADMIN ĐANG XANH KHÔNG BẮT ĐƯỢC CHUYỆN NÀY. `tests/admin_san_pham.test.ts` chèn trận bằng một
 * helper ghim `seed = 1` — tức MỌI trận trong mọi bài admin đều là trận thật, và cái rổ "bàn tập" chưa từng có một
 * dòng nào để mà lẫn. Bài xanh ở đó không nói gì về hàng rào này; gỡ `loaiTranTap` đi thì cả 61 bài vẫn xanh.
 * Bài NÀY là bài duy nhất chèn trận mang seed bàn tập thật (`SEED_MAN_TAP_MOI_THOI`).
 *
 * ⚠ CÁCH BÀI NÀY CANH: mỗi con số kỳ vọng ĐẾM TAY được từ bảng fixture dưới, và mỗi cặp `mặc định` ↔ `?gom_tap=1`
 * phải LỆCH nhau. Một hàng rào bị gỡ ⇒ hai vế bằng nhau ⇒ đỏ. Không kỳ vọng nào chép từ kết quả chạy.
 *
 * ─── FIXTURE (D = hôm nay giờ VN) ──────────────────────────────────────────────────────────────────────────────
 *  người      | tạo         | trận
 *  bt_that    | D−9 10:00   | THẬT xong hạng 1 · TẬP xong hạng 1 · TẬP xong hạng 2 · TẬP bỏ dở ở vòng 5   (đều D−5)
 *  bt_chitap  | D−9 11:00   | TẬP xong hạng 2 (D−5)            ⇒ người này KHÔNG được tính là "đã chơi"
 *  bt_admin   | D−80        | người xem (tự loại khỏi mọi số)
 *
 *  ⇒ TRẬN THẬT: 1 trận · 1 người      ⇒ BÀN TẬP: 4 trận · 2 người · 3 xong · 1 bỏ dở · bỏ ở vòng 5
 *  ⇒ gộp cả hai (`gom_tap=1`): 5 trận
 *
 * ⭐ `bt_that` có ĐÚNG 4 ghế người (1 thật + 3 tập) — con số ấy chọn có chủ đích: bậc cuối của phễu là
 * *"xong ≥ 3 trận"*, nên nếu hàng rào rơi thì bậc ấy nhảy từ 0 lên 1. Một fixture 2 ghế sẽ cho 0 ở cả hai
 * phía và bài §5 thành bài rỗng — đúng lớp lỗi `feedback-tiem-loi-bat-test-rong` nói tới.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { congNgay, ngayVN } from '../server/admin_phan_tich.js';
import { HOLDEM_BALANCE_VERSION, SEED_MAN_TAP_MOI_THOI, laSeedManTap } from '../config/holdem.js';
import { HOLDEM_DECISIONS } from '../config/holdem.js';
import type { HanhTrinhTraVe, TongQuanTraVe, TranTraVe } from '../server/admin_phan_tich_ids.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let admin: TestUser;

const D = ngayVN(Date.now());
const ngay = (lui: number): string => congNgay(D, -lui);
const luc = (lui: number, gio: number, phut = 0): string =>
  new Date(Date.parse(`${ngay(lui)}T00:00:00Z`) - 7 * 3_600_000 + (gio * 60 + phut) * 60_000).toISOString();
/** Khoảng phủ trọn fixture. */
const K = `tu=${ngay(9)}&den=${ngay(1)}`;

const goi = async <T>(duong: string): Promise<T> => {
  const r = await app.request(duong, { headers: { cookie: admin.cookie } });
  expect(r.status, duong).toBe(200);
  return r.json() as Promise<T>;
};

/** SEED THẬT của trận không-phải-bàn-tập. Khẳng định ngay ở đây để một seed trùng nhau không âm thầm làm bài vô nghĩa. */
const SEED_THAT = 1;

async function tran(u: TestUser, o: {
  seed: number; st: 'xong' | 'bo_dở' | 'dang_choi'; bd: string; hang?: number; vong?: number;
}): Promise<void> {
  const { rows } = await pool.query(
    `INSERT INTO holdem_matches
       (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json, engine_version, balance_version,
        season_id, started_at, ended_at, so_o, co_ep_tham_so, che_do)
     VALUES ($1, $2, $3, $4, '[]'::jsonb, '[]'::jsonb, 'e', $5, '2026Q3', $6, $7, 12, false, 'tu_do')
     RETURNING match_id::text AS id`,
    [u.userId, o.seed, o.st, o.vong ?? 8, HOLDEM_BALANCE_VERSION, o.bd, o.st === 'xong' ? o.bd : null]);
  const id = rows[0].id as string;
  if (o.hang === undefined) return;
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

beforeAll(async () => {
  db = await startTestDb();
  // Phiên UTC như prod (cùng lý do `admin_san_pham.test.ts` §beforeAll).
  pool = new pg.Pool({ connectionString: (db.pool as unknown as { options: { connectionString: string } }).options.connectionString, max: 5 });
  pool.on('connect', (cn) => { void cn.query(`SET TIME ZONE 'UTC'`); });
  pool.on('error', () => {});
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
  await ensureGenesis(pool);

  admin = await createTestUser(pool, { role: 'admin' });
  await moCuaAdmin(pool, admin);
  await pool.query(`UPDATE users SET created_at = $2 WHERE user_id = $1`, [admin.userId, luc(80, 9)]);
  await pool.query(`UPDATE auth_accounts SET created_at = $2 WHERE user_id = $1`, [admin.userId, luc(80, 9)]);

  const tao = async (taoLuc: string): Promise<TestUser> => {
    const u = await createTestUser(pool, { role: 'user' });
    await pool.query(
      `UPDATE users SET created_at = $2, research_consent = true, la_tester = false WHERE user_id = $1`,
      [u.userId, taoLuc]);
    await pool.query(
      `UPDATE auth_accounts SET created_at = $2, email_verified_at = $2 WHERE user_id = $1`, [u.userId, taoLuc]);
    return u;
  };

  const that = await tao(luc(9, 10)); // bt_that
  const chiTap = await tao(luc(9, 11)); // bt_chitap

  await tran(that, { seed: SEED_THAT, st: 'xong', bd: luc(5, 10), hang: 1 });
  await tran(that, { seed: HOLDEM_DECISIONS.MAN_TAP_SEED_12, st: 'xong', bd: luc(5, 11), hang: 1 });
  await tran(that, { seed: HOLDEM_DECISIONS.MAN_TAP_SEED_THUC_TE, st: 'xong', bd: luc(5, 12), hang: 2 });
  await tran(that, { seed: HOLDEM_DECISIONS.MAN_TAP_SEED, st: 'bo_dở', bd: luc(5, 13), vong: 5 });
  await tran(chiTap, { seed: HOLDEM_DECISIONS.MAN_TAP_SEED_V36, st: 'xong', bd: luc(5, 14), hang: 2 });
}, 180_000);

afterAll(async () => {
  await pool?.end().catch(() => {});
  await db?.stop();
});

describe('D359 — bàn tập là một rổ riêng', () => {
  it('§0 tiền đề: seed fixture đúng loại — một seed trùng nhau làm mọi khẳng định dưới vô nghĩa', () => {
    expect(laSeedManTap(SEED_THAT), 'seed "thật" của bài lại là seed bàn tập').toBe(false);
    for (const s of SEED_MAN_TAP_MOI_THOI) expect(laSeedManTap(s)).toBe(true);
    // Bốn seed bàn tập phải đôi một khác nhau — trùng thì fixture dưới đếm hụt mà không ai biết.
    expect(new Set(SEED_MAN_TAP_MOI_THOI).size).toBe(SEED_MAN_TAP_MOI_THOI.length);
  });

  it('§1 /tk/hanh-trinh: ô TRẬN chỉ đếm trận thật; bàn tập có rổ riêng, đếm đủ', async () => {
    const r = await goi<HanhTrinhTraVe>(`/api/v1/admin/tk/hanh-trinh?${K}`);
    expect(r.tran.so_lan_vao, 'ô TRẬN đang nuốt cả bàn tập').toBe(1);
    expect(r.tran.so_xong).toBe(1);
    expect(r.ban_tap, 'thiếu hẳn rổ bàn tập').not.toBeNull();
    expect(r.ban_tap!.so_tran).toBe(4);
    expect(r.ban_tap!.so_nguoi_vao).toBe(2);
    expect(r.ban_tap!.so_xong).toBe(3);
    expect(r.ban_tap!.so_bo_do).toBe(1);
    expect(r.ban_tap!.bo_o_vong).toEqual([{ vong: 5, n: 1 }]);
  });

  it('§2 /tk/hanh-trinh: phễu đăng ký — người CHỈ chơi bàn tập không phải "đã chơi"', async () => {
    const r = await goi<HanhTrinhTraVe>(`/api/v1/admin/tk/hanh-trinh?${K}`);
    const bac = (b: string) => r.phieu_dang_ky.find((x) => x.buoc === b)?.so_nguoi;
    expect(bac('tao-tai-khoan'), 'fixture lệch: phải có đúng hai tài khoản trong khoảng').toBe(2);
    expect(bac('tran-dau'), 'bt_chitap chỉ có bàn tập mà vẫn bị đếm là đã chơi').toBe(1);
  });

  it('§3 gom_tap=1 mở lại rổ gộp — và hai vế PHẢI lệch nhau', async () => {
    const sach = await goi<HanhTrinhTraVe>(`/api/v1/admin/tk/hanh-trinh?${K}`);
    const gop = await goi<HanhTrinhTraVe>(`/api/v1/admin/tk/hanh-trinh?${K}&gom_tap=1`);
    expect(gop.tran.so_lan_vao).toBe(5);
    expect(gop.phieu_dang_ky.find((x) => x.buoc === 'tran-dau')?.so_nguoi).toBe(2);
    // Hàng rào bị gỡ ⇒ hai vế bằng nhau ⇒ đỏ ngay ở đây, kể cả khi các số tuyệt đối ở trên có đổi.
    expect(gop.tran.so_lan_vao).toBeGreaterThan(sach.tran.so_lan_vao);
    // …còn rổ bàn tập KHÔNG chịu công tắc: nó là chủ đề, không phải nhiễu.
    expect(gop.ban_tap!.so_tran).toBe(sach.ban_tap!.so_tran);
  });

  it('§4 /tk/tran: phân bố hạng không còn hạng của bàn tập', async () => {
    const r = await goi<TranTraVe>(`/api/v1/admin/tk/tran?${K}`);
    const tong = r.phan_bo_hang.reduce((a, x) => a + x.n, 0);
    expect(tong, 'phân bố hạng đang cộng cả ghế của bàn tập').toBe(1);
    const gop = await goi<TranTraVe>(`/api/v1/admin/tk/tran?${K}&gom_tap=1`);
    expect(gop.phan_bo_hang.reduce((a, x) => a + x.n, 0)).toBe(4);
  });

  it('§5 /pt/tong-quan: phễu người mới — "vào trận" là số của trận thật', async () => {
    const r = await goi<TongQuanTraVe>(`/api/v1/admin/pt/tong-quan?${K}`);
    expect(r.pheu.vao_tran, 'phễu người mới đang đếm bàn tập là "vào trận"').toBe(1);
  });

  /*
   * ⚠ TÁCH KHỎI §5 CÓ CHỦ ĐÍCH. Hai khẳng định này đọc cùng một phản hồi, nhưng `vao_tran` đỏ trước thì
   * `xong_3_tran` không bao giờ chạy — và một khẳng định không bao giờ chạy là một khẳng định không ai
   * biết nó có bắt được gì không. Mũi tiêm D359 phải thấy CẢ HAI cùng đỏ.
   */
  it('§6 /pt/tong-quan: bậc "xong ≥ 3 trận" cũng chỉ đếm trận thật', async () => {
    const r = await goi<TongQuanTraVe>(`/api/v1/admin/pt/tong-quan?${K}`);
    // bt_that có 4 ghế người, trong đó CHỈ 1 là trận thật ⇒ 0. Hàng rào rơi ⇒ 1 (xem ⭐ đầu tệp).
    expect(r.pheu.xong_3_tran, 'bậc "xong ≥3 trận" đang cộng cả ghế của bàn tập').toBe(0);
  });
});
