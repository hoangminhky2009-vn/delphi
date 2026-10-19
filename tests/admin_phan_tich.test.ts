/**
 * D335 — NỐI DÂY CỦA APP QUẢN TRỊ RIÊNG (`server/admin_phan_tich.ts`).
 *
 * Founder 15/09: *"chú ý thật kỹ phần nối dây từ database sang để tránh dữ liệu phản ánh không chính xác"*.
 *
 * ⚠ CÁCH BÀI NÀY CANH: một bộ dữ liệu DỰNG TAY (bảng dưới), mỗi con số kỳ vọng TÍNH TAY từ bảng đó và ghi ngay
 * cạnh khẳng định — không một kỳ vọng nào được suy ra bằng cách chạy code rồi chép kết quả. Bộ dữ liệu cố ý chứa
 * đúng những thứ đã làm số sai ở repo này hoặc sẽ làm sai:
 *   · hai người tạo tài khoản cách nhau 2 phút quanh NỬA ĐÊM VIỆT NAM (u6 23:59, u7 00:01)
 *   · một người ĐÃ TẮT ghi nhưng còn telemetry cũ (u3) · một admin (u4) · một tester (u5) có trận ép tham số
 *   · một trận ép tham số của người KHÔNG còn là tester (u12) · một trận buổi đo (u7)
 *   · phiên thiếu dòng đóng (u2, u10, u11) · màn có HAI đoạn chú ý (u1) · trận bỏ dở có event bộ quét dọn (u3)
 *   · người quay lại đúng NGÀY CUỐI tuần 2 (u10, ngày c+13) và đúng ngày ĐẦU tuần 3 (u11, ngày c+14)
 *   · hai tài khoản email chưa lập hồ sơ (một chưa xác minh) · một tài khoản khách (u8)
 *
 * D = hôm nay (ngày VN lúc chạy). "D−20 10:00" = 10 giờ sáng giờ VN, 20 ngày trước.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import {
  SAN, congNgay, demNhom, docDieuKien, docKhoang, dungDongThoiGian, gomChia, gomGiuChan, laNgayThat,
  ngayVN, thoTu, type DongTho, type DongTran,
} from '../server/admin_phan_tich.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let admin: TestUser;
let thuong: TestUser;
const U: Record<string, TestUser> = {};
/*
 * Ở tệp này CHỮ của handle là dữ liệu (`tim=u1` tìm chuỗi con, `/nguoi/<handle>`, sắp theo handle) ⇒ tạo bằng `tienTo`
 * (handle = `pt_u1_<seq>`, duy nhất qua lượt chạy lại của CI) và đọc về NHÃN gốc để khẳng định giữ nguyên như bản gõ tay.
 */
const nhan = (h: string): string => Object.entries(U).find(([, u]) => u.handle === h)?.[0] ?? h;

const D = ngayVN(Date.now());
const ngay = (lui: number): string => congNgay(D, -lui);
/** Mốc UTC (ISO) của giờ VN hh:mm:ss trong ngày D−lui. */
const luc = (lui: number, gio: number, phut = 0, giay = 0): string =>
  new Date(Date.parse(`${ngay(lui)}T00:00:00Z`) - 7 * 3_600_000 + ((gio * 60 + phut) * 60 + giay) * 1000).toISOString();

const T = `tu=${ngay(20)}&den=${ngay(1)}`;

async function tele(u: TestUser, loai: string, ts: string, o: { man?: string; ms?: number; ct?: object } = {}) {
  await pool.query(
    `INSERT INTO telemetry (user_id, ts, loai, man, ms, chi_tiet) VALUES ($1, $2, $3, $4, $5, $6)`,
    [u.userId, ts, loai, o.man ?? null, o.ms ?? null, o.ct ? JSON.stringify(o.ct) : null]);
}

async function tran(u: TestUser, o: {
  st: 'xong' | 'bo_dở' | 'dang_choi'; bd: string; kt?: string; hang?: number; bot?: number;
  cheat?: boolean; ban?: string; soO?: number;
}): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO holdem_matches
       (owner_user_id, seed, status, vong_hien_tai, action_log, ghe_json, engine_version, balance_version,
        season_id, started_at, ended_at, so_o, co_ep_tham_so, ban_ma)
     VALUES ($1, 1, $2, 8, '[]'::jsonb, '[]'::jsonb, 'e', 'b', '2026Q3', $3, $4, $5, $6, $7)
     RETURNING match_id::text AS id`,
    [u.userId, o.st, o.bd, o.kt ?? null, o.soO ?? 12, o.cheat ?? false, o.ban ?? null]);
  const id = rows[0].id as string;
  if (o.hang !== undefined) {
    await pool.query(
      `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json)
       VALUES ($1, $2, 'ban', 'nguoi', 'tom', $3, 1000, 8, '{}'::jsonb)`, [id, u.userId, o.hang]);
    for (let i = 0; i < (o.bot ?? 0); i++) {
      await pool.query(
        `INSERT INTO holdem_results (match_id, user_id, ghe_id, loai, bac_rank, hang, von_cuoi, vong_chay, danh_muc_json)
         VALUES ($1, NULL, $2, 'bot', 'tom', $3, 900, 8, '{}'::jsonb)`, [id, `b${i}`, 3 + i]);
    }
  }
  return id;
}

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
  await ensureGenesis(pool);
  admin = U.pt_quan_tri = await createTestUser(pool, { role: 'admin', tienTo: 'pt_quan_tri' });
  await moCuaAdmin(pool, admin);
  thuong = U.pt_thuong = await createTestUser(pool, { tienTo: 'pt_thuong' });
  await pool.query(`UPDATE users SET research_consent = false WHERE user_id = $1`, [thuong.userId]);

  const tao = async (ten: string, taoLuc: string, o: {
    bat?: boolean; vung?: string; admin?: boolean; tester?: boolean; khach?: boolean;
  } = {}) => {
    const u = await createTestUser(pool, { tienTo: ten, role: o.admin ? 'admin' : 'user' });
    await pool.query(
      `UPDATE users SET created_at = $2, research_consent = $3, region = $4, la_tester = $5, la_khach = $6
        WHERE user_id = $1`,
      [u.userId, taoLuc, o.bat ?? true, o.vung ?? 'bac', o.tester ?? false, o.khach ?? false]);
    await pool.query(`UPDATE auth_accounts SET created_at = $2 WHERE user_id = $1`, [u.userId, taoLuc]);
    U[ten] = u;
    return u;
  };
  const u1 = await tao('pt_u1', luc(20, 10));
  const u2 = await tao('pt_u2', luc(20, 9));
  const u3 = await tao('pt_u3', luc(20, 11), { bat: false });
  const u4 = await tao('pt_u4', luc(20, 8), { admin: true });
  const u5 = await tao('pt_u5', luc(20, 8, 30), { tester: true });
  const u6 = await tao('pt_u6', luc(5, 23, 59), { vung: 'nam' });
  const u7 = await tao('pt_u7', luc(4, 0, 1), { vung: 'nam' });
  const u8 = await tao('pt_u8', luc(3, 12), { bat: false, khach: true });
  const u9 = await tao('pt_u9', luc(19, 12));
  const u10 = await tao('pt_u10', luc(19, 13));
  const u11 = await tao('pt_u11', luc(19, 14));
  const u12 = await tao('pt_u12', luc(60, 9), { bat: false });
  // Khách không có tài khoản email.
  await pool.query(
    `DELETE FROM auth_sessions WHERE account_id IN (SELECT account_id FROM auth_accounts WHERE user_id = $1)`, [u8.userId]);
  await pool.query(`DELETE FROM auth_accounts WHERE user_id = $1`, [u8.userId]);
  await pool.query(`UPDATE users SET pfm_bat_dau = $2 WHERE user_id = $1`, [u2.userId, luc(18, 9)]);
  // Hai tài khoản email chưa lập hồ sơ — một chưa xác minh.
  await pool.query(
    `INSERT INTO auth_accounts (email, password_hash, email_verified_at, user_id, created_at)
     VALUES ('pt_nv@test.local', 'x', NULL, NULL, $1), ('pt_v@test.local', 'x', $2, NULL, $2)`,
    [luc(15, 9), luc(15, 10)]);

  /* ── TELEMETRY ────────────────────────────────────────────────────────── */
  await tele(u1, 'phien_mo', luc(20, 10, 0, 5));
  await tele(u1, 'man_vao', luc(20, 10, 1), { man: '/arena' });
  await tele(u1, 'cham_nut', luc(20, 10, 1, 30), { man: '/arena', ct: { nut: 'ban-12-o' } });
  await tele(u1, 'man_ra', luc(20, 10, 2), { man: '/arena', ms: 60_000 });
  await tele(u1, 'man_ra', luc(20, 10, 5), { man: '/arena', ms: 30_000 }); // ẩn app rồi mở lại: đoạn thứ hai
  await tele(u1, 'loi_api', luc(20, 10, 6), { man: '/arena', ct: { ma: 'timeout' } });
  await tele(u1, 'loi_api', luc(20, 10, 6, 10), { man: '/arena', ct: { ma: 'timeout' } });
  await tele(u1, 'huong_dan_buoc', luc(20, 10, 8), { ct: { buoc: 'het' } });
  await tele(u1, 'phien_dong', luc(20, 10, 10), { ms: 600_000 });
  await tele(u1, 'phien_mo', luc(10, 10));
  await tele(u1, 'phien_dong', luc(10, 10, 30), { ms: 300_000 });

  await tele(u2, 'phien_mo', luc(20, 9));
  await tele(u2, 'man_vao', luc(20, 9, 1), { man: '/arena' });
  await tele(u2, 'man_ra', luc(20, 9, 2), { man: '/arena', ms: 45_000 });
  await tele(u2, 'phien_dong', luc(20, 9, 3), { ms: 120_000 });
  await tele(u2, 'phien_mo', luc(5, 9)); // không có dòng đóng

  await tele(u3, 'phien_mo', luc(12, 10));
  await tele(u3, 'loi_client', luc(12, 10, 1), { ct: { ma: 'render' } });
  await tele(u3, 'phien_dong', luc(12, 10, 20), { ms: 999_000 });

  await tele(u4, 'phien_mo', luc(15, 10));
  await tele(u4, 'man_vao', luc(15, 10, 1), { man: '/arena' });
  await tele(u4, 'phien_dong', luc(15, 10, 2), { ms: 5_000 });
  await tele(u5, 'phien_mo', luc(15, 11));
  await tele(u5, 'phien_dong', luc(15, 11, 1), { ms: 7_000 });

  await tele(u6, 'phien_mo', luc(5, 23, 59, 30));

  await tele(u9, 'phien_mo', luc(19, 12));
  await tele(u9, 'man_vao', luc(19, 12, 1), { man: '/' });
  await tele(u9, 'man_ra', luc(19, 12, 2), { man: '/', ms: 20_000 });
  await tele(u9, 'phien_dong', luc(19, 12, 3), { ms: 60_000 });
  await tele(u9, 'phien_mo', luc(12, 12));
  await tele(u9, 'phien_dong', luc(12, 12, 15), { ms: 900_000 });

  await tele(u10, 'phien_mo', luc(6, 8)); // c = D−19 ⇒ D−6 là ngày c+13: CUỐI tuần 2
  await tele(u11, 'phien_mo', luc(5, 8)); // c = D−19 ⇒ D−5 là ngày c+14: ĐẦU tuần 3

  /* ── TRẬN ─────────────────────────────────────────────────────────────── */
  await tran(u1, { st: 'xong', bd: luc(10, 10, 5), kt: luc(10, 10, 25), hang: 2, bot: 2 });
  for (const lui of [25, 24, 23]) await tran(u2, { st: 'xong', bd: luc(lui, 10), kt: luc(lui, 10, 20), hang: 1 });
  const bo = await tran(u3, { st: 'bo_dở', bd: luc(12, 10, 5), kt: luc(9, 0) });
  await pool.query(
    `INSERT INTO events (user_id, ts, context_type, context_id, action_type)
     VALUES ($1, $2, 'holdem', $3, 'hd_chot_phien'), ($1, $4, 'holdem', $3, 'hd_tran_het_han')`,
    [u3.userId, luc(12, 10, 15), bo, luc(9, 0)]);
  await tran(u4, { st: 'xong', bd: luc(15, 10, 1), kt: luc(15, 10, 20), hang: 1 });
  await tran(u5, { st: 'xong', bd: luc(15, 11), kt: luc(15, 11, 20), hang: 1, cheat: true });
  await tran(u12, { st: 'xong', bd: luc(8, 10), kt: luc(8, 10, 20), hang: 1, cheat: true });
  await pool.query(
    `INSERT INTO holdem_ban (ma, seed, so_o, chu_user_id, loai, het_han, de_id, nhan, balance_version)
     VALUES ('bd001', 7, 12, $1, 'buoi_do', now() + interval '7 days', 'de-a', 'lop-11a', 'b')`, [u4.userId]);
  await tran(u7, { st: 'xong', bd: luc(4, 9), kt: luc(4, 9, 20), hang: 1, bot: 1, ban: 'bd001' });

  /* ── TOKEN ────────────────────────────────────────────────────────────── */
  await pool.query(
    `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason, created_at) VALUES ($1, 50, 1050, 'payout', $2)`,
    [u1.userId, luc(10, 10, 26)]);
}, 180_000);

afterAll(async () => { await db?.stop(); });

const goi = (path: string, u: TestUser = admin) => app.request(path, { headers: { cookie: u.cookie } });
const guiJson = (path: string, body: unknown, method = 'POST', u: TestUser = admin) =>
  app.request(path, { method, headers: { cookie: u.cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const j = async (r: Response): Promise<any> => {
  if (r.status >= 400) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
  return r.json();
};

// ═══════════════════════════════════════════════════════════════════════════
describe('0. Hàm thuần — ngày, khoảng, hạn dữ liệu thô', () => {
  it('ngày VN đổi đúng lúc 17:00 UTC, không phải 00:00 UTC', () => {
    expect(ngayVN(Date.parse('2026-09-14T16:59:59Z'))).toBe('2026-09-14');
    expect(ngayVN(Date.parse('2026-09-14T17:00:00Z'))).toBe('2026-09-15');
  });

  it('ngày thật: không nhận 30/02, không nhận chuỗi lạ', () => {
    expect(laNgayThat('2026-02-28')).toBe(true);
    expect(laNgayThat('2026-02-30')).toBe(false);
    expect(laNgayThat("2026-01-01' OR 1=1")).toBe(false);
  });

  it('khoảng: mặc định 30 ngày tới hôm nay · kẹp tương lai · đổi chỗ · trần 366 · kỳ trước cùng độ dài', () => {
    const bay = Date.parse('2026-09-15T05:00:00Z'); // 12:00 VN ngày 15/09
    const q = (m: Record<string, string>) => (k: string) => m[k];
    expect(docKhoang(q({}), bay)).toMatchObject({ tu: '2026-08-17', den: '2026-09-15', so_ngay: 30 });
    expect(docKhoang(q({ tu: '2026-09-01', den: '2030-01-01' }), bay)).toMatchObject({ den: '2026-09-15' });
    expect(docKhoang(q({ tu: '2026-09-10', den: '2026-09-01' }), bay))
      .toMatchObject({ tu: '2026-09-01', den: '2026-09-10', so_ngay: 10, ky_truoc: { tu: '2026-08-22', den: '2026-08-31' } });
    expect(docKhoang(q({ tu: '2020-01-01', den: '2026-09-15' }), bay).so_ngay).toBe(366);
    expect(docKhoang(q({ tu: 'x', den: 'y' }), bay)).toMatchObject({ tu: '2026-08-17', den: '2026-09-15' });
  });

  it('hạn thô: ngày chứa mốc −90 ngày là ngày THIẾU; kho trẻ thì bắt đầu từ dòng đầu tiên', () => {
    const bay = Date.parse('2026-09-15T05:00:00Z');
    // 15/09 05:00Z − 90 ngày = 17/06 05:00Z = 17/06 12:00 VN ⇒ 17/06 thiếu một nửa ⇒ ngày đủ đầu tiên là 18/06.
    expect(thoTu(bay, null)).toBe('2026-06-18');
    expect(thoTu(bay, new Date('2026-08-03T01:00:00Z'))).toBe('2026-08-03');
    expect(thoTu(bay, new Date('2026-01-01T00:00:00Z'))).toBe('2026-06-18');
  });
});

describe('0b. Hàm thuần — điều kiện, giữ chân, chia nhóm, dòng thời gian', () => {
  it('điều kiện: lọc trắng giá trị, bỏ khoá lạ, sắp theo danh mục', () => {
    expect(docDieuKien({ tuoi: ['23-30', '16-17', '99', '16-17'], rac: 1, tran_tu: 0, vao_trong_ngay: 91, xong_tap: 'co' }))
      .toEqual({ tuoi: ['16-17', '23-30'] });
    expect(docDieuKien({ tao_tu: '2026-02-30', tran_tu: 3, vao_trong_ngay: 90, dung_tai_chinh: true }))
      .toEqual({ tran_tu: 3, vao_trong_ngay: 90, dung_tai_chinh: true });
    expect(docDieuKien([1, 2])).toBeNull();
  });

  it('giữ chân: có / ít / chưa tới / hết dữ liệu thô — tuần tính từ ngày tạo của CHÍNH người đó', () => {
    const homNay = '2026-09-15';
    const nam = (c: string, w: [boolean, boolean, boolean, boolean]) => ({ c, w });
    const ds = [
      nam('2026-08-20', [true, true, false, false]), nam('2026-08-20', [true, false, false, false]),
      nam('2026-08-21', [true, true, false, false]), nam('2026-08-21', [false, false, false, false]),
      nam('2026-08-22', [true, false, true, false]),
    ];
    // den 26/08 ⇒ khối 0 = 20–26/08 chứa cả năm người.
    const h = gomGiuChan(ds, '2026-08-26', homNay, '2026-06-18')[0]!;
    expect(h).toMatchObject({ tu: '2026-08-20', den: '2026-08-26', n: 5 });
    expect(h.tuan[0]).toEqual({ trang_thai: 'co', n: 5, co: 4 });
    expect(h.tuan[1]).toEqual({ trang_thai: 'co', n: 5, co: 2 });
    // Tuần 3 của người tạo 22/08 = 05–11/09 ≤ 15/09 ⇒ đo được; cả năm đều đủ.
    expect(h.tuan[2]).toEqual({ trang_thai: 'co', n: 5, co: 1 });
    // Tuần 4 = ngày c+21…c+27: người tạo sớm nhất (20/08) kết thúc 16/09 > 15/09 ⇒ cả năm người chưa tới.
    expect(h.tuan[3]).toEqual({ trang_thai: 'chua_toi' });
    // Cùng dữ liệu, hạn thô 01/09 ⇒ tuần 1 (20–26/08) hết hạn với mọi người.
    expect(gomGiuChan(ds, '2026-08-26', homNay, '2026-09-01')[0]!.tuan[0]).toEqual({ trang_thai: 'het_tho' });
    // Khối không ai ⇒ chưa tới (không phải hết hạn).
    expect(gomGiuChan(ds, '2026-08-26', homNay, '2026-06-18')[3]!.tuan[0]).toEqual({ trang_thai: 'chua_toi' });
  });

  it('chia nhóm: dòng dưới sàn vẫn còn nhưng không số; khoá đúng thứ tự; rổ số trận', () => {
    const x = (vung: string, so_xong: number) => ({
      tuoi: '18-22', vung, nghe: 'hs_sv', c: '2026-09-01', so_xong, tran_k: 1, quay_du: true, quay_co: so_xong > 0,
    });
    const ds = [x('bac', 0), x('bac', 1), x('bac', 2), x('bac', 3), x('bac', 12), x('nam', 1)];
    const v = gomChia('vung', ds, '2026-09-15');
    expect(v.map((r) => r.khoa)).toEqual(['bac', 'trung', 'nam', 'khac']);
    expect(v[0]).toEqual({ khoa: 'bac', n: 5, tran: 5, quay_lai: { nhom: 5, co: 4 } });
    expect(v[1]).toEqual({ khoa: 'trung', n: 0, tran: null, quay_lai: null });
    expect(v[2]).toEqual({ khoa: 'nam', n: null, tran: null, quay_lai: null });
    const s = gomChia('so_tran', ds, '2026-09-15');
    expect(s.map((r) => [r.khoa, r.n])).toEqual([['0', null], ['1', null], ['3', null], ['10', null]]);
  });

  it('dòng thời gian: gộp đoạn chú ý · phiên thiếu đóng · trận/token vào đúng phiên · buổi đo không lộ gì', () => {
    const d = (id: number, iso: string, loai: string, o: Partial<DongTho> = {}): DongTho =>
      ({ id, ts: new Date(iso), loai, man: null, ms: null, chi_tiet: null, ...o });
    const tele: DongTho[] = [
      d(1, '2026-09-10T03:00:00Z', 'phien_mo'),
      d(2, '2026-09-10T03:01:00Z', 'man_vao', { man: '/arena' }),
      d(3, '2026-09-10T03:02:00Z', 'man_ra', { man: '/arena', ms: 60_000 }),
      d(4, '2026-09-10T03:05:00Z', 'man_ra', { man: '/arena', ms: 30_000 }),
      d(5, '2026-09-10T03:10:00Z', 'phien_dong', { ms: 600_000 }),
      d(6, '2026-09-10T16:59:00Z', 'phien_mo'), // 23:59 VN — không có dòng đóng
      d(7, '2026-09-10T17:01:00Z', 'pfm_ghi', { chi_tiet: { cach: 'go' } }),
    ];
    const tran: DongTran[] = [
      { match_id: 'm1', started_at: new Date('2026-09-10T03:03:00Z'), status: 'xong', so_o: 12, che_do: 'tu_do',
        buoi_do: false, hang: 2, so_ghe: 3, ket_luc: new Date('2026-09-10T03:10:20Z') },
      { match_id: 'm2', started_at: new Date('2026-09-12T02:00:00Z'), status: 'xong', so_o: 12, che_do: 'tu_do',
        buoi_do: true, hang: 1, so_ghe: 8, ket_luc: new Date('2026-09-12T02:20:00Z') },
    ];
    const kq = dungDongThoiGian(tele, tran, [{ ts: new Date('2026-09-10T03:09:00Z'), delta: 50, reason: 'payout' }]);
    expect(kq.map((n) => n.ngay)).toEqual(['2026-09-12', '2026-09-10']);
    const p = kq[1]!.phien;
    expect(p).toHaveLength(2);
    const muon = p[0]!; // phiên 23:59 VN — mới nhất trong ngày lên đầu
    expect(muon).toMatchObject({ bd: '2026-09-10T16:59:00.000Z', kt: null, ms: null, thieu_dong: true });
    // pfm_ghi lúc 00:01 VN ngày 11 vẫn thuộc phiên mở lúc 23:59 ngày 10 — nhóm theo MỐC ĐẦU PHIÊN.
    expect(muon.su).toEqual([{ loai: 'tai_chinh', ts: '2026-09-10T17:01:00.000Z', ma: 'pfm_ghi' }]);
    const sang = p[1]!;
    expect(sang).toMatchObject({ ms: 600_000, thieu_dong: false });
    expect(sang.su.map((s) => s.loai)).toEqual(['man', 'tran_vao', 'token', 'tran_ket']);
    expect(sang.su[0]).toMatchObject({ man: '/arena', ms: 90_000 });
    expect(sang.su[3]).toMatchObject({ hang: 2, so_ghe: 3, trang_thai: 'xong' });
    expect(kq[0]!.ngoai_phien).toEqual([
      { loai: 'tran_ket', ts: '2026-09-12T02:20:00.000Z', trang_thai: 'xong', hang: null, so_ghe: null, buoi_do: true },
      { loai: 'tran_vao', ts: '2026-09-12T02:00:00.000Z', so_o: null, che_do: null, buoi_do: true },
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Tổng quan — mỗi số tính tay từ bộ dữ liệu', () => {
  it('ô số của khoảng D−20 → D−1 (loại quản trị & thử)', async () => {
    const b = await j(await goi(`/api/v1/admin/pt/tong-quan?${T}`));
    expect(b.khoang).toMatchObject({ tu: ngay(20), den: ngay(1), so_ngay: 20, tho_tu: ngay(20) });
    // Tạo trong khoảng, trừ u4 (admin) u5 (tester): u1 u2 u3 u6 u7 u8 u9 u10 u11. Khách: u8.
    expect(b.nay.tai_khoan_moi).toBe(9);
    expect(b.nay.tai_khoan_moi_khach).toBe(1);
    // Trận mở trong khoảng: u1 (xong) · u3 (bỏ dở) · u7 (xong). u4 admin, u5 tester, u12 ép tham số ⇒ loại.
    expect([b.nay.tran, b.nay.tran_xong, b.nay.tran_bo_do, b.nay.tran_dang_choi]).toEqual([3, 2, 1, 0]);
    // Người bật ghi có phiên: u1 u2 u6 u9 u10 u11 — u3 đã TẮT nên không tính dù còn dòng cũ.
    expect(b.nay.nguoi_hoat_dong).toBe(6);
    // Phiên: u1 2 · u2 2 · u6 1 · u9 2 · u10 1 · u11 1.
    expect(b.nay.phien).toBe(9);
    // Thời lượng có ở 5 phiên: 600k 300k 120k 60k 900k ⇒ trung vị 300k. (u3 999k không tính.)
    expect(b.nay.phien_co_thoi_luong).toBe(5);
    expect(b.nay.ms_moi_phien_tv).toBe(300_000);
    // Quay lại tuần 2: đo được u1 u2 u9 u10 u11 (cửa đã khép); có: u1 (D−10) u9 (D−12) u10 (D−6 = c+13).
    // u11 vào D−5 = c+14 là tuần 3 ⇒ không. u6 u7 cửa chưa khép.
    expect(b.nay.quay_lai).toEqual({ nhom: 5, co: 3, chua_toi: 2, het_tho: 0 });
    expect([b.nay.do_duoc, b.nay.cat_tho]).toEqual([true, false]);
    expect(b.pham_vi).toEqual({ tat_ca: 11, bat_ghi: 7 });
  });

  it('kỳ trước nằm TRƯỚC dòng telemetry đầu tiên ⇒ số hành vi là null, số vận hành vẫn đếm', async () => {
    const b = await j(await goi(`/api/v1/admin/pt/tong-quan?${T}`));
    expect(b.khoang.ky_truoc).toEqual({ tu: ngay(40), den: ngay(21) });
    expect(b.truoc.do_duoc).toBe(false);
    expect([b.truoc.nguoi_hoat_dong, b.truoc.phien, b.truoc.ms_moi_phien_tv]).toEqual([null, null, null]);
    expect([b.truoc.tran, b.truoc.tran_xong]).toEqual([3, 3]); // ba trận của u2 ở D−25…D−23
  });

  it('nửa đêm VN: u6 23:59 thuộc D−5, u7 00:01 thuộc D−4; phiên 23:59:30 vẫn là của D−5', async () => {
    const d5 = await j(await goi(`/api/v1/admin/pt/tong-quan?tu=${ngay(5)}&den=${ngay(5)}`));
    expect(d5.nay.tai_khoan_moi).toBe(1);
    expect(d5.nay.nguoi_hoat_dong).toBe(3); // u2 09:00 · u11 08:00 · u6 23:59:30
    const d4 = await j(await goi(`/api/v1/admin/pt/tong-quan?tu=${ngay(4)}&den=${ngay(4)}`));
    expect(d4.nay.tai_khoan_moi).toBe(1);
    expect(d4.nay.nguoi_hoat_dong).toBe(0);
  });

  it('khoảng bắt đầu trước dòng đầu tiên ⇒ cat_tho, số hành vi chỉ tính từ tho_tu (không đổi)', async () => {
    const b = await j(await goi(`/api/v1/admin/pt/tong-quan?tu=${ngay(25)}&den=${ngay(1)}`));
    expect([b.nay.do_duoc, b.nay.cat_tho]).toEqual([true, true]);
    expect(b.nay.nguoi_hoat_dong).toBe(6);
    expect(b.pheu.xong_tap).toBeNull(); // dấu "xong màn tập" của phần đầu nhóm không đo được
  });

  it('chuỗi theo ngày — đúng từng ngày đã dựng', async () => {
    const b = await j(await goi(`/api/v1/admin/pt/tong-quan?${T}`));
    const theo = new Map(b.chuoi.map((x: any) => [x.ngay, x]));
    expect(b.chuoi).toHaveLength(20);
    expect(theo.get(ngay(20))).toEqual({ ngay: ngay(20), tai_khoan_moi: 3, nguoi_hoat_dong: 2 });
    expect(theo.get(ngay(19))).toEqual({ ngay: ngay(19), tai_khoan_moi: 3, nguoi_hoat_dong: 1 });
    expect(theo.get(ngay(12))).toEqual({ ngay: ngay(12), tai_khoan_moi: 0, nguoi_hoat_dong: 1 });
    expect(theo.get(ngay(6))).toEqual({ ngay: ngay(6), tai_khoan_moi: 0, nguoi_hoat_dong: 1 });
    expect(theo.get(ngay(5))).toEqual({ ngay: ngay(5), tai_khoan_moi: 1, nguoi_hoat_dong: 3 });
    expect(theo.get(ngay(3))).toEqual({ ngay: ngay(3), tai_khoan_moi: 1, nguoi_hoat_dong: 0 });
  });

  it('phễu — mỗi bậc sau "bật ghi" là tập con của bật ghi', async () => {
    const b = await j(await goi(`/api/v1/admin/pt/tong-quan?${T}`));
    // Tài khoản email tạo trong khoảng: 8 người có hồ sơ (trừ u4 u5; u8 là khách) + 2 chưa lập hồ sơ.
    expect(b.pheu).toEqual({
      tao_tai_khoan: 10, xac_minh: 9, lap_ho_so: 8, bat_ghi: 7,
      xong_tap: 1, // u1
      vao_tran: 3, // u1 u2 u7 (u12 chỉ có trận ép tham số và cũng không bật ghi)
      xong_3_tran: 1, // u2
      quay_lai: { nhom: 5, co: 3, chua_toi: 2, het_tho: 0 },
    });
  });

  it('giữ chân theo tuần tạo tài khoản', async () => {
    const b = await j(await goi(`/api/v1/admin/pt/tong-quan?${T}`));
    const [k0, k1, k2] = b.giu_chan;
    expect(k0).toMatchObject({ tu: ngay(7), den: ngay(1), n: null });
    expect(k0.tuan.map((x: any) => x.trang_thai)).toEqual(['chua_toi', 'chua_toi', 'chua_toi', 'chua_toi']);
    expect(k1).toMatchObject({ tu: ngay(14), den: ngay(8), n: null });
    expect(k2).toMatchObject({ tu: ngay(21), den: ngay(15), n: 5 });
    expect(k2.tuan[0]).toEqual({ trang_thai: 'co', n: 5, co: 3 }); // u1 u2 u9
    expect(k2.tuan[1]).toEqual({ trang_thai: 'co', n: 5, co: 3 }); // u1 u9 u10
    expect(k2.tuan[2]).toEqual({ trang_thai: 'it' }); // chỉ u1 u2 đã khép tuần 3
    expect(k2.tuan[3]).toEqual({ trang_thai: 'chua_toi' });
  });

  it('màn dùng và lỗi — chỉ người bật ghi, thời gian cộng đủ các đoạn chú ý', async () => {
    const b = await j(await goi(`/api/v1/admin/pt/tong-quan?${T}`));
    expect(b.man).toEqual([
      { man: '/arena', luot: 2, nguoi: 2, ms_tong: 135_000, ms_moi_nguoi_tv: 67_500 }, // u1 90k · u2 45k
      { man: '/', luot: 1, nguoi: 1, ms_tong: 20_000, ms_moi_nguoi_tv: 20_000 },
    ]);
    expect(b.loi).toEqual([{ man: '/arena', loai: 'loi_api', ma: 'timeout', n: 2 }]);
  });

  it('gồm quản trị & thử: đúng phần của u4 u5 u12 được cộng vào', async () => {
    const b = await j(await goi(`/api/v1/admin/pt/tong-quan?${T}&gom=1`));
    expect(b.nay.tai_khoan_moi).toBe(11); // + u4 u5
    expect(b.nay.tran).toBe(6); // + u4 · u5 (ép tham số) · u12 (ép tham số)
    expect(b.nay.nguoi_hoat_dong).toBe(8); // + u4 u5
    expect(b.man[0]).toMatchObject({ man: '/arena', luot: 3 });
  });

  it('người không phải admin ⇒ 403', async () => {
    expect((await goi(`/api/v1/admin/pt/tong-quan?${T}`, thuong)).status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Người dùng — danh sách', () => {
  it('đủ người, số phiên chỉ của người bật ghi, lần cuối không bị bộ quét dọn kéo dài', async () => {
    const b = await j(await goi(`/api/v1/admin/pt/nguoi?${T}&sap=tao`));
    expect(b.tong).toBe(11); // u1…u12 + pt_thuong − u4 (admin) − u5 (tester); pt_quan_tri là admin
    const theo = new Map<string, any>(b.nguoi.map((x: any) => [nhan(x.handle), x]));
    expect(theo.get('pt_u1')).toMatchObject({ phien: 2, tran: 1, bat_ghi: true });
    expect(theo.get('pt_u3')).toMatchObject({ phien: null, tran: 1, bat_ghi: false });
    expect(theo.get('pt_u12')).toMatchObject({ tran: 0 }); // trận ép tham số không tính
    expect(new Date(theo.get('pt_u1').lan_cuoi).toISOString()).toBe(luc(10, 10, 30));
    // u3 tắt ghi ⇒ bỏ telemetry; event bộ quét dọn D−9 KHÔNG tính ⇒ lần cuối = nước cuối D−12 10:15.
    expect(new Date(theo.get('pt_u3').lan_cuoi).toISOString()).toBe(luc(12, 10, 15));
    expect(theo.get('pt_thuong').lan_cuoi).toBeNull();
  });

  it('lọc · tìm · sắp', async () => {
    const hs = async (qs: string) => (await j(await goi(`/api/v1/admin/pt/nguoi?${T}&${qs}`))).nguoi.map((x: any) => nhan(x.handle));
    expect((await hs('loc=ghi')).sort()).toEqual(['pt_u1', 'pt_u10', 'pt_u11', 'pt_u2', 'pt_u6', 'pt_u7', 'pt_u9']);
    expect((await hs('loc=tran')).sort()).toEqual(['pt_u1', 'pt_u3', 'pt_u7']);
    expect((await hs('loc=moi'))).toHaveLength(9);
    expect((await hs('tim=u1')).sort()).toEqual(['pt_u1', 'pt_u10', 'pt_u11', 'pt_u12']);
    expect((await hs('sap=tran')).slice(0, 3)).toEqual(['pt_u1', 'pt_u3', 'pt_u7']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Người dùng — một người', () => {
  it('u1: ô số, giờ vào app, dòng thời gian hai ngày; lần mở ghi nhật ký quản trị', async () => {
    const truoc = (await pool.query(`SELECT count(*)::int AS n FROM admin_audit WHERE action = 'xem_nguoi'`)).rows[0].n;
    const b = await j(await goi(`/api/v1/admin/pt/nguoi/${U.pt_u1!.handle}?${T}`));
    expect(b.ho_so).toMatchObject({ handle: U.pt_u1!.handle, bat_ghi: true, quan_tri: false, tong_tran: 1 });
    expect(b.o).toEqual({ phien: 2, ms_trong_app: 900_000, loi: 2, tran: 1 });
    const thu = (lui: number) => ((new Date(`${ngay(lui)}T00:00:00Z`).getUTCDay() + 6) % 7);
    const gio = Array.from({ length: 7 }, () => Array(24).fill(0));
    gio[thu(20)]![10] += 1; gio[thu(10)]![10] += 1;
    expect(b.gio).toEqual(gio);
    expect(b.ngay.map((n: any) => n.ngay)).toEqual([ngay(10), ngay(20)]);
    const p10 = b.ngay[0].phien[0];
    expect(p10).toMatchObject({ bd: luc(10, 10), kt: luc(10, 10, 30), ms: 300_000, thieu_dong: false });
    expect(p10.su).toEqual([
      { loai: 'tran_vao', ts: luc(10, 10, 5), so_o: 12, che_do: 'tu_do', buoi_do: false },
      { loai: 'tran_ket', ts: luc(10, 10, 25), trang_thai: 'xong', hang: 2, so_ghe: 3, buoi_do: false },
      { loai: 'token', ts: luc(10, 10, 26), delta: 50, ly_do: 'payout' },
    ]);
    const p20 = b.ngay[1].phien[0];
    expect(p20).toMatchObject({ bd: luc(20, 10, 0, 5), kt: luc(20, 10, 10), ms: 600_000 });
    expect(p20.su).toEqual([
      { loai: 'man', ts: luc(20, 10, 1), man: '/arena', ms: 90_000 },
      { loai: 'cham', ts: luc(20, 10, 1, 30), nut: 'ban-12-o', man: '/arena' },
      { loai: 'loi', ts: luc(20, 10, 6), nguon: 'api', ma: 'timeout', man: '/arena' },
      { loai: 'loi', ts: luc(20, 10, 6, 10), nguon: 'api', ma: 'timeout', man: '/arena' },
      { loai: 'huong_dan', ts: luc(20, 10, 8), buoc: 'het' },
    ]);
    expect(b.con_nua_truoc).toBeNull();
    const { rows } = await pool.query(
      `SELECT admin_id, payload_json FROM admin_audit WHERE action = 'xem_nguoi' ORDER BY audit_id DESC LIMIT 1`);
    expect((await pool.query(`SELECT count(*)::int AS n FROM admin_audit WHERE action = 'xem_nguoi'`)).rows[0].n).toBe(truoc + 1);
    // 11/10 (SPEC chan-truoc-beta, founder "A"): `admin_audit` append-only ⇒ ghi user_id, KHÔNG ghi tên (tên trong dòng không xoá được
    // là đường user_id → danh tính sống sau khi người ấy xoá tài khoản).
    expect(rows[0]).toMatchObject({ admin_id: admin.userId, payload_json: { user_id: U.pt_u1!.userId, tu: ngay(20), den: ngay(1) } });
    expect(JSON.stringify(rows[0].payload_json)).not.toContain(U.pt_u1!.handle);
    // Tải thêm (`truoc`) KHÔNG ghi thêm dòng nhật ký.
    await j(await goi(`/api/v1/admin/pt/nguoi/${U.pt_u1!.handle}?${T}&truoc=${ngay(10)}`));
    expect((await pool.query(`SELECT count(*)::int AS n FROM admin_audit WHERE action = 'xem_nguoi'`)).rows[0].n).toBe(truoc + 1);
  });

  it('u3 đã tắt ghi: không một dòng telemetry nào (kể cả cũ); trận bỏ dở kết ở nước cuối, không ở lúc quét dọn', async () => {
    const b = await j(await goi(`/api/v1/admin/pt/nguoi/${U.pt_u3!.handle}?${T}`));
    expect(b.o).toEqual({ phien: null, ms_trong_app: null, loi: null, tran: 1 });
    expect(b.gio).toBeNull();
    expect(b.ngay).toEqual([{
      ngay: ngay(12), phien: [],
      ngoai_phien: [
        { loai: 'tran_ket', ts: luc(12, 10, 15), trang_thai: 'bo_do', hang: null, so_ghe: null, buoi_do: false },
        { loai: 'tran_vao', ts: luc(12, 10, 5), so_o: 12, che_do: 'tu_do', buoi_do: false },
      ],
    }]);
  });

  it('u7 trận buổi đo: không cỡ bàn, không chế độ, không hạng', async () => {
    const b = await j(await goi(`/api/v1/admin/pt/nguoi/${U.pt_u7!.handle}?${T}`));
    expect(b.ngay).toEqual([{
      ngay: ngay(4), phien: [],
      ngoai_phien: [
        { loai: 'tran_ket', ts: luc(4, 9, 20), trang_thai: 'xong', hang: null, so_ghe: null, buoi_do: true },
        { loai: 'tran_vao', ts: luc(4, 9), so_o: null, che_do: null, buoi_do: true },
      ],
    }]);
    expect(JSON.stringify(b)).not.toContain('bd001');
  });

  it('không có người / handle sai ⇒ 404, không ghi nhật ký; không phải admin ⇒ 403', async () => {
    expect((await goi(`/api/v1/admin/pt/nguoi/khong_ai_ca?${T}`)).status).toBe(404);
    expect((await goi(`/api/v1/admin/pt/nguoi/X'--?${T}`)).status).toBe(404);
    expect((await goi(`/api/v1/admin/pt/nguoi/${U.pt_u1!.handle}?${T}`, thuong)).status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. Phân khúc', () => {
  it('cỡ thật từng điều kiện — biên ngày và biên "vào trong N ngày" lấy đủ hai đầu', async () => {
    const n = (dk: object, gom = false) => demNhom(pool, docDieuKien(dk)!, D, gom);
    expect(await n({})).toBe(7);
    expect(await n({}, true)).toBe(10); // + u4 · u5 · pt_quan_tri (admin gọi test — fixture mặc định bật ghi)
    expect(await n({ tao_tu: ngay(19), tao_den: ngay(19) })).toBe(3); // u9 u10 u11
    expect(await n({ tao_den: ngay(5) })).toBe(6); // u6 23:59 D−5 vào, u7 00:01 D−4 không
    expect(await n({ vung: ['nam'] })).toBe(2);
    expect(await n({ tran_tu: 1 })).toBe(3); // u1 u2 u7
    expect(await n({ tran_tu: 3 })).toBe(1); // u2
    expect(await n({ vao_trong_ngay: 5 })).toBe(0); // từ D−4
    expect(await n({ vao_trong_ngay: 6 })).toBe(3); // từ D−5: u2 u6 u11
    expect(await n({ vao_trong_ngay: 7 })).toBe(4); // từ D−6: + u10
    expect(await n({ xong_tap: true })).toBe(1);
    expect(await n({ dung_tai_chinh: true })).toBe(1);
  });

  it('chỉ số nhóm "mọi người bật ghi" KHỚP ô tổng quan cùng khoảng; nhóm nhỏ không lộ số', async () => {
    const tq = await j(await goi(`/api/v1/admin/pt/tong-quan?${T}`));
    const b = await j(await guiJson('/api/v1/admin/pt/phan-khuc/tinh', {
      nhom: [{}, { vung: ['nam'] }, { tran_tu: 3 }], tu: ngay(20), den: ngay(1),
    }));
    expect(b.nhom[0].chi_so).toEqual({
      n: 7, vao_app: 6, phien: 9, ms_moi_phien_tv: 300_000,
      tran: 2, // u1 · u7 (u3 không bật ghi)
      xong_tap: 1, dung_tai_chinh: 1,
      quay_lai: { nhom: 5, co: 3, chua_toi: 2, het_tho: 0 },
    });
    expect(b.nhom[0].chi_so.phien).toBe(tq.nay.phien);
    expect(b.nhom[0].chi_so.vao_app).toBe(tq.nay.nguoi_hoat_dong);
    expect(b.nhom[0].chi_so.ms_moi_phien_tv).toBe(tq.nay.ms_moi_phien_tv);
    expect(b.nhom[1]).toEqual({ n: null, chi_so: null });
    expect(b.nhom[2]).toEqual({ n: null, chi_so: null });
    expect(b.san).toBe(SAN);
  });

  it('chia theo vùng và theo số trận', async () => {
    const v = await j(await guiJson('/api/v1/admin/pt/phan-khuc/chia', {
      dieu_kien: {}, theo: 'vung', tu: ngay(20), den: ngay(1),
    }));
    expect(v.n).toBe(7);
    expect(v.nhom).toEqual([
      { khoa: 'bac', n: 5, tran: 1, quay_lai: { nhom: 5, co: 3 } },
      { khoa: 'trung', n: 0, tran: null, quay_lai: null },
      { khoa: 'nam', n: null, tran: null, quay_lai: null },
      { khoa: 'khac', n: 0, tran: null, quay_lai: null },
    ]);
    const s = await j(await guiJson('/api/v1/admin/pt/phan-khuc/chia', { dieu_kien: {}, theo: 'so_tran' }));
    // Trận đã xong: u6 u9 u10 u11 = 0 (4 người) · u1 u7 = 1 · u2 = 3.
    expect(s.nhom.map((x: any) => [x.khoa, x.n])).toEqual([['0', null], ['1', null], ['3', null], ['10', 0]]);
    expect((await guiJson('/api/v1/admin/pt/phan-khuc/chia', { dieu_kien: {}, theo: 'email' })).status).toBe(400);
  });

  it('nhóm đã lưu: tạo (lọc trắng điều kiện) · liệt kê kèm người tạo · xoá mềm', async () => {
    const tao = await guiJson('/api/v1/admin/pt/phan-khuc', { ten: 'Sinh viên', dieu_kien: { nghe: ['hs_sv'], rac: 1, tuoi: ['99'] } });
    expect(tao.status).toBe(201);
    const moi = await tao.json() as any;
    expect(moi.dieu_kien).toEqual({ nghe: ['hs_sv'] });
    const ds = await j(await goi('/api/v1/admin/pt/phan-khuc'));
    expect(ds.nhom.find((x: any) => x.id === moi.id)).toMatchObject({ ten: 'Sinh viên', tao_boi: admin.handle, dieu_kien: { nghe: ['hs_sv'] } });
    expect((await guiJson(`/api/v1/admin/pt/phan-khuc/${moi.id}/xoa`, {})).status).toBe(200);
    expect((await j(await goi('/api/v1/admin/pt/phan-khuc'))).nhom.find((x: any) => x.id === moi.id)).toBeUndefined();
    expect((await guiJson(`/api/v1/admin/pt/phan-khuc/${moi.id}/xoa`, {})).status).toBe(404);
    expect((await guiJson('/api/v1/admin/pt/phan-khuc', { ten: '', dieu_kien: {} })).status).toBe(400);
    expect((await guiJson('/api/v1/admin/pt/phan-khuc', { ten: 'x', dieu_kien: {} }, 'POST', thuong)).status).toBe(403);
  });
});
