/**
 * TESTER MODE (0052) — cheat cho tài khoản thử nghiệm, gác bằng CẢ role LẪN
 * cờ `la_tester`.
 *
 * Founder 03/09/2026: *"cấp toàn quyền cho tài khoản admin để làm tester nhé.
 * Như kiểu cheat luôn ấy"*, và xác nhận riêng 26/26 tài khoản hiện có trên
 * prod là của chính founder (D223).
 *
 * ⚠⚠ BÀI QUAN TRỌNG NHẤT TRONG FILE — mục I: "admin nhưng KHÔNG la_tester".
 * Nếu cheat chỉ gác bằng `role`, thì D208 (uỷ quyền admin bấm-một-nút) biến
 * MỌI người được uỷ quyền thành một máy in tiền: họ tự gọi
 * `POST /admin/tester/token`, và `admin_adjust` là đường mint HỢP LỆ theo
 * `server/audit.ts` nên `npm run audit:supply` vẫn báo CÂN — KHÔNG MỘT HÀNG
 * RÀO NÀO KÊU. Bài ở mục I chính là hàng rào đó.
 *
 * Năm quyền cheat, xem `server/admin_tester.ts` + phần ép tham số trong
 * `POST /holdem/matches` (`server/holdem_api.ts`):
 *   1. Cấp token           — mục II
 *   2. Ép tham số tạo trận — mục III
 *   3. Miễn giờ            — gộp trong mục III (ep_mien_gio)
 *   4. Mở khoá toàn bộ     — mục IV
 *   5. Đặt lại tiến trình  — mục V
 * Mục VI canh cột `holdem_matches.co_ep_tham_so` loại đúng trận khỏi phân
 * tích ĐỘC LẬP với cờ `la_tester` hiện tại của chủ. Mục VII canh việc không
 * route/script nào ghi được `la_tester` — cột chỉ bật bằng SQL tay (0052).
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { auditSupply } from '../scripts/audit_supply.js';
import { currentSeasonId } from '../server/season.js';
import { replay } from '../server/holdem_api.js';
import { HOLDEM_BALANCE_VERSION, luatCua } from '../config/holdem.js';
import { AVATAR_NEN, NHAN_DAN } from '../config/avatar.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-secret-holdem', secureCookie: false,
  }) as Hono<any>;
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function req(cookie: string, p: string, init: RequestInit = {}): Promise<Response> {
  return app.request(`http://localhost${p}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) },
  });
}
async function json(cookie: string, p: string, init: RequestInit = {}): Promise<any> {
  return (await req(cookie, p, init)).json();
}
/** Đọc body của một `Response` đã có sẵn (khi cần CẢ status LẪN body). */
async function readJson(res: Response): Promise<any> {
  return res.json();
}
const post = (cookie: string, p: string, body?: unknown) =>
  json(cookie, p, { method: 'POST', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

/**
 * Admin ĐÃ qua 2FA + xác thực lại, CHƯA phải tester (`la_tester` mặc định
 * false — đúng hình dạng một tài khoản vừa được D208 uỷ quyền admin).
 */
async function makeAdmin(
  opts: { questPoints?: number; bankroll?: number; handle?: string } = {},
): Promise<TestUser> {
  const u = await createTestUser(pool, { role: 'admin', ...opts });
  await moCuaAdmin(pool, u);
  return u;
}

/**
 * Admin + tester. `la_tester` bật bằng MỘT CÂU UPDATE TAY — đây là CÁCH DUY
 * NHẤT hợp lệ (không route nào ghi cột này, xem mục VII + migrations/0052).
 */
async function makeTester(
  opts: { questPoints?: number; bankroll?: number; handle?: string } = {},
): Promise<TestUser> {
  const u = await makeAdmin(opts);
  await pool.query(`UPDATE users SET la_tester = true WHERE user_id = $1`, [u.userId]);
  return u;
}

async function auditActions(adminId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT action FROM admin_audit WHERE admin_id = $1 ORDER BY audit_id`, [adminId]);
  return rows.map((r) => r.action as string);
}

describe('I. Gác CẢ role LẪN la_tester — case D208', () => {
  it('user thường (không admin) → 403 ở cửa cheat', async () => {
    const u = await createTestUser(pool);
    const res = await req(u.cookie, '/api/v1/admin/tester/token', {
      method: 'POST', body: JSON.stringify({ so_luong: 100 }),
    });
    expect(res.status).toBe(403);
  });

  it('⭐ admin ĐÃ qua 2FA nhưng KHÔNG la_tester → 403 khong_phai_tester (role KHÔNG đủ, D208)', async () => {
    const a2 = await makeAdmin();
    const truoc = await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [a2.userId]);

    const res = await req(a2.cookie, '/api/v1/admin/tester/token', {
      method: 'POST', body: JSON.stringify({ so_luong: 999 }),
    });
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('khong_phai_tester');

    // Đúng cái D208 sợ: không một T nào được in ra nếu chỉ gác bằng role.
    const sau = await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [a2.userId]);
    expect(sau.rows[0].bankroll).toEqual(truoc.rows[0].bankroll);
    const { rows: wl } = await pool.query(
      `SELECT 1 FROM wallet_ledger WHERE user_id = $1 AND reason = 'admin_adjust'`, [a2.userId]);
    expect(wl).toHaveLength(0);
    expect((await auditSupply(pool)).ok).toBe(true);
  });
});

describe('II. Cấp token — ledger thật, audit:supply vẫn CÂN', () => {
  it('mint đúng số, một dòng wallet_ledger admin_adjust, một dòng admin_audit', async () => {
    // bankroll:0 để số mint ra ĐÚNG BẰNG so_luong — mặc định tester đã có sẵn
    // STARTING_BANKROLL từ signup_grant (đúng thật, không phải lỗi), nên phép
    // so tuyệt đối ở dưới cần khởi điểm 0 mới không mập mờ.
    const t = await makeTester({ bankroll: 0 });
    const res = await req(t.cookie, '/api/v1/admin/tester/token', {
      method: 'POST', body: JSON.stringify({ so_luong: 500 }),
    });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.ok).toBe(true);
    expect(body.bankroll).toBe(500);

    const { rows: uRows } = await pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [t.userId]);
    expect(Number(uRows[0].bankroll)).toBe(500);

    const { rows: wl } = await pool.query(
      `SELECT delta, balance_after, reason FROM wallet_ledger
        WHERE user_id = $1 AND reason = 'admin_adjust' ORDER BY entry_id DESC LIMIT 1`,
      [t.userId]);
    expect(wl).toHaveLength(1);
    expect(Number(wl[0].delta)).toBe(500);
    expect(Number(wl[0].balance_after)).toBe(500);

    expect(await auditActions(t.userId)).toContain('tester_cap_token');
    expect((await auditSupply(pool)).ok).toBe(true);
  });

  it('so_luong <= 0 hoặc không phải số nguyên → 400, không ghi ledger', async () => {
    const t = await makeTester();
    for (const bad of [0, -5, 1.5, 'x', null]) {
      const res = await req(t.cookie, '/api/v1/admin/tester/token', {
        method: 'POST', body: JSON.stringify({ so_luong: bad }),
      });
      expect(res.status, `so_luong=${JSON.stringify(bad)} phải bị 400`).toBe(400);
    }
    const { rows } = await pool.query(
      `SELECT 1 FROM wallet_ledger WHERE user_id = $1 AND reason = 'admin_adjust'`, [t.userId]);
    expect(rows).toHaveLength(0);
  });
});

describe('III. Ép tham số lúc tạo trận', () => {
  it('seed/so_ghe/balance_version/so_o/vai/mien_gio/chien_thuat ép tay: đúng dòng DB, co_ep_tham_so=true, replay() tất định', async () => {
    const t = await makeTester();
    const EP_SEED = 123456789;
    const EP_BALANCE = 'balance-v31-quycogian'; // khác HOLDEM_BALANCE_VERSION — đo được sự khác biệt
    expect(EP_BALANCE).not.toBe(HOLDEM_BALANCE_VERSION);

    const res = await req(t.cookie, '/api/v1/holdem/matches', {
      method: 'POST',
      body: JSON.stringify({
        ep_seed: EP_SEED, ep_so_ghe: 6, ep_balance: EP_BALANCE, so_o: 12,
        ep_vai: 'to_chuc', ep_chien_thuat: ['don_bay'], ep_mien_gio: true,
      }),
    });
    expect(res.status).toBe(201);
    const body = await readJson(res);

    const { rows } = await pool.query(
      `SELECT seed, so_o, balance_version, mien_gio, co_ep_tham_so, ghe_json
         FROM holdem_matches WHERE match_id = $1`, [body.match_id]);
    const r = rows[0];
    expect(Number(r.seed)).toBe(EP_SEED);
    expect(r.so_o).toBe(12);
    expect(r.balance_version).toBe(EP_BALANCE);
    expect(r.mien_gio).toBe(true);
    expect(r.co_ep_tham_so).toBe(true);

    const ghe = r.ghe_json as any[];
    expect(ghe).toHaveLength(6); // ep_so_ghe
    const ban = ghe.find((g) => g.id === 'ban');
    expect(ban.vai).toBe('to_chuc');
    expect(ban.danh_muc.chien_thuat).toEqual(['don_bay']);

    // replay() TẤT ĐỊNH trên đúng dữ liệu vừa lưu (seed/ghế/luật/so_o) — gọi
    // hai lần, trạng thái phải khớp tuyệt đối (byte-for-byte).
    const luat = luatCua(r.balance_version);
    const rp1 = replay(Number(r.seed), [], false, ghe as never, luat, 0, false, r.so_o);
    const rp2 = replay(Number(r.seed), [], false, ghe as never, luat, 0, false, r.so_o);
    expect(JSON.stringify(rp1.st)).toBe(JSON.stringify(rp2.st));
  });

  it('ep_balance trỏ khoá KHÔNG có trong BO_LUAT_THEO_PHIEN_BAN → 400, không tạo trận (D217)', async () => {
    const t = await makeTester();
    const { rows: truoc } = await pool.query(
      `SELECT count(*)::int AS n FROM holdem_matches WHERE owner_user_id = $1`, [t.userId]);

    const res = await req(t.cookie, '/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ ep_balance: 'balance-khong-ton-tai-xyz' }),
    });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe('ep_balance_khong_hop_le');

    const { rows: sau } = await pool.query(
      `SELECT count(*)::int AS n FROM holdem_matches WHERE owner_user_id = $1`, [t.userId]);
    expect(sau[0].n).toBe(truoc[0].n);
  });

  it('user KHÔNG tester gửi ep_seed/ep_so_ghe/ep_vai/ep_mien_gio: bị lờ hẳn, co_ep_tham_so=false', async () => {
    const n = await createTestUser(pool);
    const res = await req(n.cookie, '/api/v1/holdem/matches', {
      method: 'POST',
      /*
       * D406 — ghim v53: khoá mặc định v54 luôn dựng bàn 16 (có vai ⇒ ghế người có vai bốc theo seed, không phân biệt
       * được với vai bị ép). Bàn 8 của v53 là mẫu đối chứng KHÔNG vai, nên "ep_vai bị lờ" đo được sạch. `ep_balance` ở
       * user thường chỉ được nhận dưới vitest và KHÔNG bật `co_ep_tham_so` — vế đang đo vẫn nguyên.
       */
      body: JSON.stringify({ ep_seed: 42, ep_so_ghe: 4, ep_vai: 'to_chuc', ep_mien_gio: true, ep_balance: 'balance-v53-upo' }),
    });
    expect(res.status).toBe(201);
    const body = await readJson(res);
    const { rows } = await pool.query(
      `SELECT seed, mien_gio, co_ep_tham_so, ghe_json FROM holdem_matches WHERE match_id = $1`,
      [body.match_id]);
    expect(rows[0].co_ep_tham_so).toBe(false);
    expect(rows[0].mien_gio).toBe(false);
    expect(Number(rows[0].seed)).not.toBe(42); // ep_seed bị lờ — seed vẫn ngẫu nhiên
    const ban = (rows[0].ghe_json as any[]).find((g) => g.id === 'ban');
    expect(ban.vai).toBeUndefined(); // ep_vai bị lờ
  });
});

describe('IV. Mở khoá toàn bộ (bất biến không phụ thuộc catalog seed cụ thể)', () => {
  it('200 ok, admin_audit tester_mo_khoa, cấp+bỏ-qua cộng đúng tổng catalog', async () => {
    const t = await makeTester();
    const res = await req(t.cookie, '/api/v1/admin/tester/mo-khoa', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.ok).toBe(true);
    expect(body.khung_cap).toBeGreaterThan(0); // 0013 seed sẵn nhiều khung 'song'
    expect(body.nen_cap + body.nen_bo_qua_huu_han).toBe(AVATAR_NEN.length);
    expect(body.sticker_cap + body.sticker_bo_qua).toBe(NHAN_DAN.length);
    expect(await auditActions(t.userId)).toContain('tester_mo_khoa');
  });
});

describe('V. Đặt lại tiến trình (rank + Q, KHÔNG đụng Brier/lịch sử)', () => {
  it('quest_points→0 qua quest_ledger, rank_diem mùa hiện tại→0 kèm đối ứng rank_quy_diem, admin_audit tester_dat_lai', async () => {
    const t = await makeTester({ questPoints: 250 });
    const season = currentSeasonId();
    await pool.query(
      `INSERT INTO rank_diem (user_id, season_id, diem, diem_dinh, so_tran, hang)
       VALUES ($1, $2, 300, 300, 5, 42)`, [t.userId, season]);

    const res = await req(t.cookie, '/api/v1/admin/tester/dat-lai', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body).toMatchObject({ ok: true, quest_points: 0, rank_diem: 0 });

    const { rows: uRows } = await pool.query(
      `SELECT quest_points FROM users WHERE user_id = $1`, [t.userId]);
    expect(uRows[0].quest_points).toBe(0n);

    const { rows: ql } = await pool.query(
      `SELECT delta, balance_after, reason FROM quest_ledger
        WHERE user_id = $1 ORDER BY entry_id DESC LIMIT 1`, [t.userId]);
    expect(Number(ql[0].delta)).toBe(-250);
    expect(Number(ql[0].balance_after)).toBe(0);
    expect(ql[0].reason).toBe('admin_sua_q');

    const { rows: rd } = await pool.query(
      `SELECT diem, diem_dinh, so_tran, hang FROM rank_diem WHERE user_id = $1 AND season_id = $2`,
      [t.userId, season]);
    expect(rd[0]).toMatchObject({ diem: 0, diem_dinh: 0, so_tran: 0, hang: null });

    const { rows: rq } = await pool.query(
      `SELECT delta, reason FROM rank_quy_diem WHERE season_id = $1 ORDER BY entry_id DESC LIMIT 1`,
      [season]);
    expect(rq[0]).toMatchObject({ delta: 300, reason: 'admin_sua' });

    expect(await auditActions(t.userId)).toContain('tester_dat_lai');
  });
});

describe('VI. Phân tích loại trận cheat ĐỘC LẬP với chủ sở hữu hiện tại', () => {
  it('mặc định loại trận co_ep_tham_so=true dù chủ đã hết la_tester; gom_tester=1 mới gộp lại', async () => {
    const t = await makeTester();
    const n = await createTestUser(pool);

    async function tranNhom(extra = ''): Promise<number> {
      const body = await json(t.cookie, `/api/v1/admin/tk/phien-ban?gom_admin=1${extra}`);
      const d = (body.dong as any[]).find(
        (x) => x.ver === HOLDEM_BALANCE_VERSION && x.che_do === 'tu_do');
      return d?.tran ?? 0;
    }

    const base = await tranNhom();

    // M2: trận BÌNH THƯỜNG, không cheat, chủ không phải tester.
    const m2 = await post(n.cookie, '/api/v1/holdem/matches');
    expect(m2.match_id).toBeTruthy();

    // M1: trận CHEAT của T lúc T còn tester.
    const m1 = await post(t.cookie, '/api/v1/holdem/matches', { ep_seed: 5551234 });
    expect(m1.match_id).toBeTruthy();
    const { rows: m1row } = await pool.query(
      `SELECT co_ep_tham_so FROM holdem_matches WHERE match_id = $1`, [m1.match_id]);
    expect(m1row[0].co_ep_tham_so).toBe(true);

    // Founder rút tư cách tester của T SAU KHI trận đã tạo — sự thật của
    // khoảnh khắc tạo trận đứng yên vĩnh viễn (append-only, không route nào
    // update lại co_ep_tham_so).
    await pool.query(`UPDATE users SET la_tester = false WHERE user_id = $1`, [t.userId]);

    const macDinh = await tranNhom();
    expect(macDinh).toBe(base + 1); // chỉ M2 — M1 vẫn bị loại dù T hết là tester NGAY LÚC ĐỌC

    const gomHet = await tranNhom('&gom_tester=1');
    expect(gomHet).toBe(base + 2); // cả M1 lẫn M2
  });
});

describe('VII. Không route/script nào GHI cột la_tester', () => {
  function tuocComment(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
  }

  async function tsFilesUnder(dir: string): Promise<string[]> {
    const out: string[] = [];
    const ds = await readdir(dir, { withFileTypes: true });
    for (const d of ds) {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) out.push(...await tsFilesUnder(full));
      else if (d.name.endsWith('.ts')) out.push(full);
    }
    return out;
  }

  it('không UPDATE...SET la_tester, không INSERT INTO users(...la_tester...) ở server/ hay scripts/', async () => {
    const files = [...await tsFilesUnder('server'), ...await tsFilesUnder('scripts')];
    expect(files.length).toBeGreaterThan(10);

    const ghiPattern = /\bSET\b[^;]{0,200}\bla_tester\s*=/i;
    const insertPattern = /INSERT\s+INTO\s+users\s*\(([^)]*)\)/gi;

    for (const f of files) {
      const code = tuocComment(await readFile(f, 'utf8'));
      expect(ghiPattern.test(code), `${f}: có vẻ UPDATE ... SET la_tester`).toBe(false);
      let m: RegExpExecArray | null;
      while ((m = insertPattern.exec(code)) !== null) {
        const cols = m[1]!.split(',').map((s) => s.trim().toLowerCase());
        expect(cols.includes('la_tester'), `${f}: INSERT INTO users(...) liệt kê la_tester`).toBe(false);
      }
    }
  });
});
