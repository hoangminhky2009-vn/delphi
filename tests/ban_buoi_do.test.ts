/**
 * BÀN BUỔI ĐO (D329, migration 0066). Canh những thứ là LUẬT, hoặc là LỜI HỨA của văn bản đồng ý:
 *  §I   chỉ người điều phối tạo bàn; đề lạ · nhãn sai hình · ngày đóng quá trần ⇒ 400; seed/cỡ/luật lấy từ ĐỀ.
 *  §II  vào bàn: chưa đồng ý ⇒ 403; đồng ý bản cũ ⇒ 400; khách ⇒ 403; đồng ý ⇒ tạo trận và
 *       `balance_version` của trận = của BÀN (ghim — kiểm bằng bàn trỏ một bộ luật KHÁC bản hiện hành).
 *  §III GET /ban/:ma: không danh sách tên; mã tham gia 4 ký tự, ổn định, là của CHÍNH người hỏi.
 *  §IV  ⭐ trang nhóm: chỉ người tạo; bàn còn mở ⇒ không số; đóng + đủ sàn ⇒ % làm tròn, không một dòng
 *       theo người; RÚT LẠI ⇒ ra khỏi n ở lần đọc kế (lời văn bản hứa).
 *  §V   cấp quyền điều phối cho MỌI admin (D349): chỉ đọc không ghi · chạm đúng admin thật · khách
 *       và người thường đứng ngoài.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, xongBanTap, type TestUser } from './helpers/fixtures.js';
import { DE_DANG_DUNG, NGAN_HANG_DE } from '../config/holdem_de.js';
import { CONSENT_PHIEN_BAN } from '../config/pfm_consent.js';
import { PFM } from '../config/pfm.js';
import { NANG_LUC_HIEN } from '../config/nang_luc.js';
import { BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS } from '../config/holdem.js';
import { soLienHe } from '../server/holdem/lien_he.js';
import { maThamGia } from '../server/holdem_api.js';
import { datQuyenDieuPhoiMoiAdmin } from '../server/holdem/ban_buoi_do.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let DP: TestUser;     // người điều phối
let NT: TestUser;     // người thường

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-bd', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  DP = await createTestUser(pool);
  NT = await createTestUser(pool);
  await pool.query(`UPDATE users SET la_dieu_phoi = true WHERE user_id = $1`, [DP.userId]);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function goi(u: TestUser, path: string, init: RequestInit = {}) {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: u.cookie, ...(init.headers ?? {}) },
  });
  return { status: r.status, body: await r.json() as any };
}
const post = (u: TestUser, path: string, body: unknown = {}) =>
  goi(u, path, { method: 'POST', body: JSON.stringify(body) });

const taoBan = (u: TestUser, them: Record<string, unknown> = {}) =>
  post(u, '/api/v1/holdem/ban', { loai: 'buoi_do', de_id: 'de-c', nhan: 'lop-thu-1', ...them });

const dongY = (u: TestUser, ma: string, phien_ban: string = CONSENT_PHIEN_BAN.buoi_do) =>
  post(u, `/api/v1/holdem/ban/${ma}/dong-y`, { phien_ban });

/*
 * D370 — từ nay đồng ý KHÔNG đủ để vào trận. Có HAI cửa, và bài này đi qua cả hai:
 *   1. nộp PHIẾU 1 (cửa một chiều — phiếu ấy hỏi họ ĐOÁN, nên phải trả lời khi chưa mở app;
 *      không còn người điều phối để canh bằng miệng);
 *   2. chơi XONG BÀN TẬP (founder chốt 22/09 "luật mới đúng"): người chưa thấy cơ chế nào mà
 *      vào thẳng thì số của họ đo sự bỡ ngỡ, không đo hành vi.
 * Bài này đo chuyện khác (luật bàn · mã tham gia · trang nhóm) nên chỉ QUA cửa, không đo cửa —
 * cả hai cửa có bài canh riêng đi đường thật ở `tests/buoi_do_tu_phuc_vu` §III.
 */
const quaCua1 = async (u: TestUser) => {
  expect((await post(u, '/api/v1/holdem/buoi-do/buoc', { buoc: 1 })).status).toBe(200);
  await xongBanTap(pool, u);
};

async function choiTron(u: TestUser, ma: string): Promise<string> {
  await quaCua1(u);
  const t = await post(u, '/api/v1/holdem/matches', { ban_ma: ma });
  expect(t.status, JSON.stringify(t.body)).toBe(201);
  for (let v = 1; v <= Number(t.body.tong_vong); v += 1) {
    const r = await post(u, `/api/v1/holdem/matches/${t.body.match_id}/rounds`,
      { vong: v, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [] });
    expect(r.body.error, `vòng ${v}: ${JSON.stringify(r.body)}`).toBeUndefined();
  }
  return t.body.match_id as string;
}

describe('§I — ai tạo bàn, bàn chở gì', () => {
  it('⭐ người thường ⇒ 403; người điều phối ⇒ 201 với seed/cỡ/luật của ĐỀ ghi vào bàn', async () => {
    expect((await taoBan(NT)).status).toBe(403);
    const r = await taoBan(DP);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body).toMatchObject({ loai: 'buoi_do', so_o: 12, de_id: 'de-c', nhan: 'lop-thu-1' });
    const de = NGAN_HANG_DE.find((d) => d.id === 'de-c')!;
    const hang = (await pool.query(
      `SELECT seed, so_o, balance_version, loai FROM holdem_ban WHERE ma = $1`, [r.body.ma])).rows[0];
    expect(Number(hang.seed)).toBe(de.seed);
    expect(hang.balance_version).toBe(de.balance_version);
  });

  it('đề lạ · nhãn có dấu/khoảng trắng · ngày đóng quá 14 ngày ⇒ 400', async () => {
    expect((await taoBan(DP, { de_id: 'de-z' })).body.error).toBe('de_khong_co');
    expect((await taoBan(DP, { nhan: 'Lớp 10A' })).body.error).toBe('nhan_khong_hop_le');
    const xa = new Date(Date.now() + 20 * 86_400_000).toISOString();
    expect((await taoBan(DP, { ngay_dong: xa })).body.error).toBe('ngay_dong_khong_hop_le');
  });

  it('mọi đề trong ngân hàng trỏ một bộ luật còn sống', () => {
    for (const d of NGAN_HANG_DE) expect(d.balance_version in BO_LUAT_THEO_PHIEN_BAN, d.id).toBe(true);
  });

  it('⭐ D392 — đề THÔI DÙNG không mở được bàn mới (400), và vắng khỏi lời báo đề hợp lệ', async () => {
    const cu = NGAN_HANG_DE.filter((d) => d.thoi_dung !== undefined);
    expect(cu.length, 'phải còn ít nhất một đề thôi dùng để bài này có nghĩa').toBeGreaterThan(0);
    for (const d of cu) {
      const r = await taoBan(DP, { de_id: d.id });
      expect(r.status, d.id).toBe(400);
      expect(r.body.error, d.id).toBe('de_thoi_dung');
      for (const x of cu) expect(String(r.body.message)).not.toContain(x.id);
    }
  });

  /*
   * D392 ghim "tập luật nào thì bị đo bằng luật ấy". D433 — founder 27/09 chọn bàn tập chạy v54 (luật trận thật mới
   * nhất) và CHẤP NHẬN lệch: đề đang dùng của buổi đo giữ v52. Bài khoá đúng thế lệch ấy thay vì xoá: đổi một bên mà
   * không đổi bên kia, hay gỡ lệch, đều phải là một quyết định có chủ ý — không phải tác dụng phụ của một cú sửa khác.
   * D437 — founder 27/09 cho buổi đo chạy luật trận thật v55 ⇒ THÊM đề E (v55 bàn 16), đề C/D giữ v52. Bảng dưới là quyết
   * định từng đề; đề mới hay luật đề đổi mà không sửa bảng này là đỏ.
   */
  it('⭐⭐ D392 → D433 → D437 — luật từng đề đang dùng đúng như founder chốt; bàn tập chạy v54', () => {
    const LUAT_DE: Record<string, string> = {
      'de-c': 'balance-v52-dadang', 'de-d': 'balance-v52-dadang', 'de-e': 'balance-v55-build',
    };
    expect(DE_DANG_DUNG.map((d) => d.id).sort()).toEqual(Object.keys(LUAT_DE).sort());
    for (const d of DE_DANG_DUNG) {
      expect(d.balance_version, `${d.id}: luật đề đổi mà chưa ai quyết`).toBe(LUAT_DE[d.id]);
    }
    // D527 (founder 05/10: "Làm bàn tập rồi deploy") — bàn tập sang nhịp xen kẽ v58; đề buổi đo giữ khoá riêng của chúng ở trên.
    // D530 — bàn tập sang v60 (lõi chỉ trong màn, founder 06/10).
    // D536 — bàn tập sang v61 theo nguyên tắc founder chốt ở D527/D530 (bàn tập chạy đúng luật trận thật); lệnh lớn không có bước dạy.
    // D545 — v61 → v62: founder 06/10 giao "thay đổi bàn tập" (kỳ họp ô 3 + Delphi chỉ còn kể từ vòng 3).
    expect(HOLDEM_DECISIONS.MAN_TAP_BALANCE_VERSION, 'luật bàn tập đổi mà chưa ai quyết').toBe('balance-v62-kyhoptap');
  });

  it('D392 — chữ ký sự kiện ghi trong đề = chữ ký tính lại từ sổ liên hệ (bắt cú trôi khi đổi luật sinh map)', () => {
    for (const d of NGAN_HANG_DE) {
      const tinh = soLienHe([{ luc: null, seed: d.seed, so_o: d.so_o, balance_version: d.balance_version }])
        .filter((x) => x.so_lan > 0).map((x) => x.id).sort();
      expect([...d.chu_ky].sort(), d.id).toEqual(tinh);
    }
  });
});

describe('§II — vào bàn', () => {
  it('⭐ chưa đồng ý ⇒ 403; đồng ý bản cũ ⇒ 400; đồng ý ⇒ vào được, trận chạy LUẬT CỦA BÀN', async () => {
    const { body: b } = await taoBan(DP);
    /*
     * Đề hôm nay trùng bản luật hiện hành, nên "ghim" và "theo hiện hành" cho cùng một chuỗi — bài
     * không phân biệt được hai thứ. Trỏ bàn vào một bộ luật SỐNG khác rồi mới kiểm.
     */
    const khac = Object.keys(BO_LUAT_THEO_PHIEN_BAN).find((k) => k !== HOLDEM_BALANCE_VERSION
      && k.startsWith('balance-v4'))!;
    await pool.query(`UPDATE holdem_ban SET balance_version = $2 WHERE ma = $1`, [b.ma, khac]);

    const chua = await post(NT, '/api/v1/holdem/matches', { ban_ma: b.ma });
    expect(chua.status).toBe(403);
    expect(chua.body.error).toBe('chua_dong_y_buoi_do');
    expect((await dongY(NT, b.ma, 'v0')).body.error).toBe('consent_cu');
    expect((await dongY(NT, b.ma)).status).toBe(200);

    await quaCua1(NT);
    const t = await post(NT, '/api/v1/holdem/matches', { ban_ma: b.ma });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    const m = (await pool.query(
      `SELECT balance_version FROM holdem_matches WHERE match_id = $1`, [t.body.match_id])).rows[0];
    expect(m.balance_version).toBe(khac);
    const ev = (await pool.query(
      `SELECT value_json FROM events WHERE context_id = $1 AND action_type = 'hd_match_start'`,
      [t.body.match_id])).rows[0];
    expect(ev.value_json).toMatchObject({ ban_ma: b.ma, nguon: 'ban_buoi_do', de_id: 'de-c' });
  }, 60_000);

  it('khách ⇒ 403, cả khi đồng ý lẫn khi vào', async () => {
    const { body: b } = await taoBan(DP);
    const k = await app.request('/api/v1/auth/khach', {
      method: 'POST', headers: { 'x-forwarded-for': '198.51.100.77' },
    });
    const token = ((await k.json()) as { token: string }).token;
    const hdr = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    /*
     * B5 (vá đợt 1 Gói 2) — khách mới vướng cổng tuổi (`chua_xac_nhan_tuoi`) TRƯỚC cổng buổi đo; bài này canh cổng buổi đo, nên
     * khách qua cổng tuổi trước như ngoài đời (tấm hỏi năm sinh). Không làm thế thì 403 ở dưới đến từ cổng khác — xanh mà không đo.
     */
    const tuoi = await app.request('/api/v1/me/tuoi', {
      method: 'POST', headers: hdr, body: JSON.stringify({ birth_year: new Date().getUTCFullYear() - 20 }),
    });
    expect(tuoi.status).toBe(200);
    const dy = await app.request(`/api/v1/holdem/ban/${b.ma}/dong-y`, {
      method: 'POST', headers: hdr, body: JSON.stringify({ phien_ban: CONSENT_PHIEN_BAN.buoi_do }),
    });
    expect(dy.status).toBe(403);
    const vao = await app.request('/api/v1/holdem/matches', {
      method: 'POST', headers: hdr, body: JSON.stringify({ ban_ma: b.ma }),
    });
    expect(vao.status).toBe(403);
    expect(((await vao.json()) as any).error).toBe('khach_khong_vao_buoi_do');
  });
});

describe('§II-b — ⭐ LINK BÀN BUỔI ĐO LÀ LINK TESTER (D362)', () => {
  /*
   * ⚠ BÀI NÀY CANH MỘT CÁI CÔNG TẮC KHÔNG AI NHÌN THẤY. Bấm ĐỒNG Ý vừa ghi vết vừa bật
   * `users.thu_chi_tiet` — cờ quyết định khu TESTER của /quan-tri có đọc dòng của người này không.
   * Cờ bật mà quên tắt lúc rút là biến nút "rút lại" thành một nút không làm gì, và KHÔNG một bài
   * nào khác đỏ: trang nhóm vẫn đúng, trận vẫn chạy, chỉ có một người bị soi sau khi đã xin thôi.
   */
  const coCo = async (u: TestUser) => (await pool.query(
    `SELECT thu_chi_tiet, thu_chi_tiet_nhan, thu_chi_tiet_luc IS NOT NULL AS co_luc
       FROM users WHERE user_id = $1`, [u.userId])).rows[0];

  it('⭐ đồng ý ⇒ BẬT cờ + ghi nhãn đợt; rút ⇒ TẮT; đồng ý lại ⇒ bật lại', async () => {
    const { body: b } = await taoBan(DP, { nhan: 'lop-co-tester' });
    const u = await createTestUser(pool);

    expect((await coCo(u)).thu_chi_tiet, 'cờ đã bật trước khi bấm gì').toBe(false);

    expect((await dongY(u, b.ma)).status).toBe(200);
    const sauDongY = await coCo(u);
    expect(sauDongY.thu_chi_tiet, 'bấm đồng ý mà cờ không bật ⇒ khu TESTER sẽ câm').toBe(true);
    expect(sauDongY.thu_chi_tiet_nhan, 'nhãn đợt không được ghi ⇒ không tách được hai buổi').toBe('lop-co-tester');
    expect(sauDongY.co_luc).toBe(true);

    expect((await post(u, `/api/v1/holdem/ban/${b.ma}/rut-dong-y`, {})).status).toBe(200);
    const sauRut = await coCo(u);
    expect(sauRut.thu_chi_tiet, 'rút rồi mà cờ còn bật ⇒ "rút lại" là nút không làm gì').toBe(false);
    expect(sauRut.co_luc, 'mốc bật phải xoá cùng cờ').toBe(false);

    expect((await dongY(u, b.ma)).status).toBe(200);
    expect((await coCo(u)).thu_chi_tiet, 'đồng ý lại phải bật lại').toBe(true);
  });

  it('đồng ý bản CŨ bị từ chối ⇒ cờ KHÔNG được bật (vết và cờ đi cùng nhau hoặc không cái nào)', async () => {
    const { body: b } = await taoBan(DP);
    const u = await createTestUser(pool);
    expect((await dongY(u, b.ma, 'v0-khong-ton-tai')).status).toBe(400);
    expect((await coCo(u)).thu_chi_tiet, 'consent bị từ chối mà cờ vẫn bật').toBe(false);
  });
});

describe('§III — GET /ban/:ma của buổi đo', () => {
  it('không danh sách tên; mã tham gia là của CHÍNH người hỏi, 4 ký tự, ổn định', async () => {
    const { body: b } = await taoBan(DP);
    await dongY(NT, b.ma);
    await quaCua1(NT);
    const t = await post(NT, '/api/v1/holdem/matches', { ban_ma: b.ma });
    const g1 = await goi(NT, `/api/v1/holdem/ban/${b.ma}`);
    const g2 = await goi(NT, `/api/v1/holdem/ban/${b.ma}`);
    expect(g1.body.loai).toBe('buoi_do');
    expect(g1.body.doi).toEqual([]);
    expect(g1.body.buoi_do.ma_tham_gia).toMatch(/^[a-z2-9]{4}$/);
    expect(g1.body.buoi_do.ma_tham_gia).toBe(maThamGia(t.body.match_id));
    expect(g2.body.buoi_do.ma_tham_gia).toBe(g1.body.buoi_do.ma_tham_gia);
    expect(g1.body.buoi_do.da_dong_y).toBe(true);
    // Người điều phối chưa vào ⇒ không có mã của ai khác.
    expect((await goi(DP, `/api/v1/holdem/ban/${b.ma}`)).body.buoi_do.ma_tham_gia).toBeNull();
  });
});

describe('§IV — ⭐⭐ trang nhóm', () => {
  it('⭐⭐ chỉ người tạo · mở chỉ SAU khi đóng · đủ sàn mới có số · % làm tròn · rút lại ⇒ ra khỏi n', async () => {
    const { body: b } = await taoBan(DP);
    const nguoi: TestUser[] = [];
    const tranIds: string[] = [];
    for (let i = 0; i < PFM.SAN_MAU_BAN; i += 1) {
      const u = await createTestUser(pool);
      expect((await dongY(u, b.ma)).status).toBe(200);
      tranIds.push(await choiTron(u, b.ma));
      nguoi.push(u);
    }
    expect((await goi(NT, `/api/v1/holdem/ban/${b.ma}/nhom`)).status).toBe(403);

    const mo = await goi(DP, `/api/v1/holdem/ban/${b.ma}/nhom`);
    expect(mo.body).toMatchObject({ da_dong: false, du_mau: false, n: PFM.SAN_MAU_BAN });
    expect(mo.body.nang_luc).toBeUndefined();

    expect((await post(NT, `/api/v1/holdem/ban/${b.ma}/dong`)).status).toBe(403);
    expect((await post(DP, `/api/v1/holdem/ban/${b.ma}/dong`)).status).toBe(200);
    const du = await goi(DP, `/api/v1/holdem/ban/${b.ma}/nhom`);
    expect(du.body, JSON.stringify(du.body)).toMatchObject({ da_dong: true, du_mau: true, n: PFM.SAN_MAU_BAN });
    // D396 — chỉ năng lực đang HIỆN (N2 ẩn tới khi đổi thước: `NANG_LUC_AN`).
    expect(du.body.nang_luc.map((x: { id: string }) => x.id)).toEqual([...NANG_LUC_HIEN]);
    expect(JSON.stringify(du.body)).not.toContain('doc_tin');
    for (const nl of du.body.nang_luc) {
      for (const v of Object.values(nl.pct) as number[]) expect(v % PFM.BUOC_LAM_TRON).toBe(0);
    }
    // Không một dòng theo người: không handle, không mã trận, không mã tham gia nào trong payload.
    const chuoi = JSON.stringify(du.body);
    for (const u of nguoi) {
      expect(chuoi.includes(u.userId)).toBe(false);
      expect(chuoi.includes(u.handle), `lọt handle ${u.handle}`).toBe(false);
    }

    /*
     * Trận xong mà KHÔNG vào thẻ (vd nghi máy) không đếm vào n: sàn tính trên trận ĐẾM ĐƯỢC, không trên
     * trận đã xong. Giả một trận nghi máy ngay ở bảng phái sinh (đầu vào của phép chấm), rồi trả lại.
     */
    await pool.query(`UPDATE hanh_vi_vong SET nghi_may = true WHERE match_id = $1`, [tranIds[1]]);
    const nghiMay = await goi(DP, `/api/v1/holdem/ban/${b.ma}/nhom`);
    expect(nghiMay.body).toMatchObject({ du_mau: false, n: PFM.SAN_MAU_BAN - 1 });
    expect(nghiMay.body.nang_luc).toBeUndefined();
    await pool.query(`UPDATE hanh_vi_vong SET nghi_may = false WHERE match_id = $1`, [tranIds[1]]);

    // Rút lại SAU khi đóng ⇒ lần đọc kế còn n − 1 ⇒ dưới sàn ⇒ câm.
    expect((await post(nguoi[0]!, `/api/v1/holdem/ban/${b.ma}/rut-dong-y`)).body.doi).toBe(true);
    const sau = await goi(DP, `/api/v1/holdem/ban/${b.ma}/nhom`);
    expect(sau.body).toMatchObject({ du_mau: false, n: PFM.SAN_MAU_BAN - 1 });
    expect(sau.body.nang_luc).toBeUndefined();
  }, 240_000);

  it('⭐ D396 — trận ĐẦU HÀNG không vào n của trang nhóm, không vào "đã xong" của màn điều phối', async () => {
    const { body: b } = await taoBan(DP, { nhan: 'lop-dau-hang' });
    const choi = await createTestUser(pool);
    const bo = await createTestUser(pool);
    for (const u of [choi, bo]) expect((await dongY(u, b.ma)).status).toBe(200);
    await choiTron(choi, b.ma);
    await quaCua1(bo);
    const t = await post(bo, '/api/v1/holdem/matches', { ban_ma: b.ma });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    const r = await post(bo, `/api/v1/holdem/matches/${t.body.match_id}/rounds`,
      { vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'dau_hang', them: 0, cuoc: [{ loai: 'bo' }] });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const trangThai = await pool.query(`SELECT status FROM holdem_matches WHERE match_id = $1`, [t.body.match_id]);
    expect(trangThai.rows[0]!.status, 'tiền đề: đầu hàng làm trận xong').toBe('xong');

    const nhom = await goi(DP, `/api/v1/holdem/ban/${b.ma}/nhom`);
    expect(nhom.body.n, 'trận đầu hàng không được đếm vào n').toBe(1);
    const ds = await goi(DP, '/api/v1/holdem/ban-buoi-do');
    const dong = (ds.body.ban as { ma: string; so_nguoi: number; so_xong: number }[]).find((x) => x.ma === b.ma);
    expect(dong).toMatchObject({ so_nguoi: 2, so_xong: 1 });
  }, 240_000);
});

/*
 * §V — LƯỢT CẤP QUYỀN CHO MỌI ADMIN (D349). Founder 19/09 chốt người điều phối là "tất cả admin
 * hiện tại", nên đường cấp thôi đi theo handle. Ba thứ canh ở đây đều là thứ hỏng thì hỏng ÂM
 * THẦM trên prod — không màn nào báo, và người vận hành chỉ thấy chữ ✔:
 *   1. không cờ ⇒ KHÔNG ĐỘNG VÀO GÌ (luật của cả tệp script này là "mặc định chỉ đọc");
 *   2. cấp cả lượt KHÔNG được chạm người thường — `UPDATE` thiếu `WHERE role` là cấp cho cả app;
 *   3. khách không nhận cờ, y hệt đường theo handle (cấp cho khách = một quyền không dùng được).
 */
describe('§V — cấp quyền điều phối cho mọi admin', () => {
  it('⭐ chỉ đọc thì không đổi gì · --ghi chạm ĐÚNG admin thật · khách và người thường đứng ngoài', async () => {
    const A1 = await createTestUser(pool, { role: 'admin' });
    const A2 = await createTestUser(pool, { role: 'admin' });
    const KHACH = await createTestUser(pool, { role: 'admin' });
    await pool.query(`UPDATE users SET la_khach = true WHERE user_id = $1`, [KHACH.userId]);

    const co = async (u: TestUser): Promise<boolean> => {
      const r = await pool.query(`SELECT la_dieu_phoi FROM users WHERE user_id = $1`, [u.userId]);
      return r.rows[0].la_dieu_phoi as boolean;
    };

    // 1. CHỈ ĐỌC — liệt kê đúng hai admin không-khách, và không ghi một dòng nào.
    const nhin = await datQuyenDieuPhoiMoiAdmin(pool, null);
    const tenNhin = nhin.map((h) => h.handle);
    expect(tenNhin, 'phải thấy cả hai admin thật').toEqual(
      expect.arrayContaining([A1.handle, A2.handle]));
    expect(tenNhin, 'khách là admin vẫn KHÔNG được liệt kê').not.toContain(KHACH.handle);
    expect(await co(A1), 'lượt chỉ đọc mà đã bật cờ').toBe(false);

    // 2. CẤP CẢ LƯỢT.
    await datQuyenDieuPhoiMoiAdmin(pool, true);
    expect(await co(A1)).toBe(true);
    expect(await co(A2)).toBe(true);

    // 3. Ranh giới: người thường và khách không được thơm lây.
    expect(await co(NT), 'người thường bị cấp lây ⇒ UPDATE thiếu WHERE role').toBe(false);
    expect(await co(KHACH), 'khách bị cấp lây').toBe(false);

    // 4. `truoc` phải kể trạng thái TRƯỚC lượt ghi — người vận hành đọc nó để biết mình đổi gì.
    const lanHai = await datQuyenDieuPhoiMoiAdmin(pool, null);
    expect(lanHai.find((h) => h.handle === A1.handle)?.truoc).toBe(true);

    // Trả bàn về như cũ: các mục khác trong tệp này dùng chung một DB.
    await datQuyenDieuPhoiMoiAdmin(pool, false);
    expect(await co(A1)).toBe(false);
  }, 120_000);
});
