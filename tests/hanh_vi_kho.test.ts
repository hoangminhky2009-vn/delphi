/**
 * TẦNG CHUNG CHUYỂN HÀNH VI (D106) — ba câu hỏi, ba khối:
 *  §I  DỜI CHỖ KHÔNG DỜI NGHĨA: chơi thật qua endpoint, rồi hồ sơ đọc từ
 *      `hanh_vi_vong` phải GIỐNG TỪNG CHỮ SỐ hàm cũ (oracle chép nguyên văn từ
 *      HEAD trước D106 — tests/helpers/ho_so_cu.ts).
 *  §II CỜ + DẤU: tran_xong/man_tap/khẩu vị vào đúng cột; dựng hai lần ra y một
 *      bảng; dấu `hanh_vi_tran` chặn quét lại; tick quét nền.
 *  §III VECTOR THUẦN: nghi máy, tiêu dùng có ngữ cảnh.
 *  §VI TRẬN HỎNG (D396): replay nổ thì bảng của trận ấy NGUYÊN VẸN, và một trận hỏng không chặn cả lượt
 *      (script · tick) — prod có 7 trận v53 nổ "Vòng 12 vượt quá map 12 ô".
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { quaMan } from './helpers/minigame.js';
import { coBanGhim } from '../config/luoc_bo.js';
import { hoSoTinhCachCu } from './helpers/ho_so_cu.js';
import { hoSoTinhCachCuaUser, hanhViDeps } from '../server/holdem_api.js';
import {
  capNhatCuaUser, capNhatNen, docVongCuaTran, dungHanhViTran, dungLaiNhieuTran, type Deps, type HangHanhVi,
} from '../server/hanh_vi/kho.js';
import { dungHoSo } from '../server/holdem/insight.js';
import { GOI, chiaGoi } from '../server/hanh_vi/goi.js';
import { HOLDEM_BALANCE_VERSION, luatCua } from '../config/holdem.js';
import {
  EVENT_TRAI_TRAN, LOAI_TIEU_DUNG, danCoNghiMay, traiTieuDung, traiTran, type DongHanhViVong,
  type EventTho, type KhauViVong,
} from '../server/hanh_vi/trai.js';
import { laSeedManTap } from '../config/holdem.js';
import { chamNangLucTran } from '../server/holdem/nang_luc.js';
import { NANG_LUC_AN, NANG_LUC_HIEN } from '../config/nang_luc.js';

// D383 — số vòng = SỐ Ô − 1 (bối cảnh mở màn `o[0]` không quyết toán vòng nào).

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
    tickSecret: 'tick-test',
  }) as Hono<any>;
  /*
   * D413 — admin + `la_tester`: server CHỈ nhận `ep_seed` khi `laTester(actor)` (role admin VÀ la_tester); người
   * thường gửi thì tham số bị bỏ qua LẶNG LẼ và seed vẫn ngẫu nhiên — nên `choiTronTran` còn khẳng định seed ăn thật.
   * Không route nào ở tệp này đọc role, nên đổi vai không đổi thứ gì bài đang đo.
   */
  user = await createTestUser(pool, { role: 'admin' });
  await pool.query(`UPDATE users SET la_tester = true WHERE user_id = $1`, [user.userId]);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function json(path: string, init: RequestInit = {}, cookie = user.cookie): Promise<any> {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie, ...(init.headers ?? {}) },
  });
  return r.json();
}
const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}) =>
  json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], ...them,
    }),
  });

/*
 * D406 — mặc định lật sang v54 (chỉ bàn 16 ⇒ 15 vòng). Bài này đo KHO hành vi, viết quanh bàn 8 ô (7 vòng/trận,
 * gói = `GOI.TRAN` trận × 7) — ghim v53 ở một chỗ cho mọi trận tự tạo; kho trên trận v54 có bài riêng ở §II.
 */
const KHOA_BAI = 'balance-v53-upo';
const BODY_TRAN = JSON.stringify({ ep_balance: KHOA_BAI });
/*
 * ⭐ D413 — SEED GHIM cho trận trọn mà §II đọc khẩu vị. Không ghim thì bản đồ ngẫu nhiên, và ba vế của §II ("vòng 1
 * mua btc 50% ⇒ tiền mặt 30–70%", "vòng 5 all-in ⇒ tiền mặt < 25%, ≥ 2 mã", "đủ 7 vòng không lỗi") là câu về ĐA SỐ
 * bản đồ chứ không về MỌI bản đồ. Quét 1.100 seed bằng ĐÚNG chuỗi lệnh dưới đây (qua endpoint thật, admin-tester):
 * **22 seed (2%) làm đỏ ít nhất một vế** — 9 seed tiền mặt vòng 1 ≥ 7.000 bp (một cú rơi của btc ngay vòng 1, tệ
 * nhất 7.519), 11 seed tiền mặt vòng 5 ≥ 2.500 bp hoặc < 2 mã, 2 seed trận đóng sớm (all-in vn30 rồi cháy ⇒ vòng
 * 6/7 ăn 409 `match_closed`). Seed 12 nằm giữa đường: vòng 1 = 5.003 bp · 1 mã; vòng 5 = 760 bp (đúng "phần Quỹ vòng
 * vừa chia", không về 0) · 3 mã; đủ 7 vòng. Khoá v53 đã đóng băng (golden băm) nên con số này không trôi.
 * ⚠ Đổi chuỗi lệnh ở đây ⇒ chọn lại seed (chơi đúng chuỗi mới qua endpoint với vài seed, đọc `hanh_vi_vong` vòng 1 và
 * 5, lấy seed nằm giữa biên — cách quét ghi ở D413); đừng nới biên để bài xanh.
 */
const SEED_TRON = 12;

/** Chơi trọn một trận 8 ô với vài lệnh khác nhau để hồ sơ có đủ kiểu dòng. */
async function choiTronTran(opts: Record<string, unknown> = {}): Promise<string> {
  const tao = await json('/api/v1/holdem/matches', {
    method: 'POST', body: JSON.stringify({ ep_balance: KHOA_BAI, ep_seed: SEED_TRON, ...opts }),
  });
  expect(tao.match_id, JSON.stringify(tao)).toBeDefined();
  // Seed ép PHẢI ăn — server bỏ qua `ep_seed` lặng lẽ khi người tạo không phải admin-tester, và lúc ấy §II quay về xổ số.
  const { rows: [m] } = await pool.query(
    `SELECT seed::text AS seed, co_ep_tham_so FROM holdem_matches WHERE match_id = $1`, [tao.match_id]);
  expect(m, 'không thấy trận vừa tạo').toBeDefined();
  expect(m!.seed, 'ep_seed bị bỏ qua — người tạo trận phải là admin + la_tester').toBe(String(SEED_TRON));
  expect(m!.co_ep_tham_so).toBe(true);
  const tong = Number(tao.tong_vong ?? 8);
  for (let v = 1; v <= tong; v += 1) {
    const them = v === 1 ? { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] }
      : v === 3 ? { lenh: [{ ma: 'btc', chieu: 'ban', moc_bp: 5000 }, { ma: 'vang', chieu: 'mua', moc_bp: 2500 }] }
      : v === 5 ? { lenh: [{ ma: 'vn30', chieu: 'mua', moc_bp: 10000 }] }
      : {};
    const r = await nopVong(tao.match_id, v, them);
    expect(r.error, `vòng ${v}: ${JSON.stringify(r)}`).toBeUndefined();
  }
  return tao.match_id as string;
}

describe('§I — dời chỗ không dời nghĩa', () => {
  it('hồ sơ đọc từ hanh_vi_vong GIỐNG TỪNG CHỮ SỐ hàm cũ parse events', async () => {
    // Một trận trọn + một trận dở (2 vòng, có khớp giữa vòng) + một trận bỏ ở vòng 1.
    await choiTronTran();
    const do2 = await json('/api/v1/holdem/matches', { method: 'POST', body: BODY_TRAN });
    const rk = await app.request(
      `http://localhost/api/v1/holdem/matches/${do2.match_id}/khop-lenh`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: user.cookie },
        body: JSON.stringify({ vong: 1, lenh: [{ ma: 'vang', chieu: 'mua', moc_bp: 2500 }] }),
      });
    expect(rk.status).toBe(200);
    await nopVong(do2.match_id, 1);
    await nopVong(do2.match_id, 2, { lenh: [{ ma: 'vang', chieu: 'ban', moc_bp: 10000 }] });
    await json('/api/v1/holdem/matches', { method: 'POST', body: BODY_TRAN }); // bỏ ở vòng 1

    const cu = await hoSoTinhCachCu(pool, user.userId);
    // Bản mới: làm tươi kho rồi đọc ĐÚNG cửa sổ cũ (60 trận gần nhất → trận NAV,
    // không loại cờ) và đưa qua cùng `dungHoSo`. Thứ đang so là PHÉP TRẢI.
    await capNhatCuaUser(pool, user.userId, hanhViDeps);
    const ids = (await pool.query(
      `SELECT match_id, balance_version FROM (
         SELECT match_id, balance_version, started_at FROM holdem_matches
          WHERE owner_user_id = $1 ORDER BY started_at DESC LIMIT 60
       ) t ORDER BY started_at ASC`, [user.userId])).rows
      .filter((r) => luatCua(r.balance_version).nav).map((r) => String(r.match_id));
    const moi = dungHoSo(await docVongCuaTran(pool, ids), ids.length);
    expect(moi.n_vong, 'kho phải thấy đủ vòng').toBe(cu.n_vong);
    // D436 — vế ngược của bài D406 dưới: luật chưa có trait (v53) ⇒ kho chở `trait_json` null, không phải mảng rỗng.
    expect((await docVongCuaTran(pool, ids)).every((h) => h.trait_json === null), 'v53 không có hệ trait').toBe(true);
    // D383 — mỗi trận nay 7 vòng thay vì 8, nên sàn hạ theo. Sàn này chỉ để bắt "rỗng",
    // không phải một con số có nghĩa kinh tế.
    expect(moi.n_vong).toBeGreaterThanOrEqual(9);
    // Deep-equal qua JSON trên MỌI CỘT CŨ: mọi số, mọi null, mọi thứ tự chuỗi Brier.
    // Cột MỚI (khẩu vị từ replay → thẻ/trục suy từ nó) oracle cũ không có ⇒ bóc ra
    // so riêng: kho PHẢI có, oracle PHẢI không — hai bên khác nhau đúng ở chỗ khai.
    const bocMoi = (h: any) => {
      const { khau_vi: _kv, net: _n, tinh_cach: _t, bac_doc: _b, chi_so, ...con } = h;
      const { khau_vi: _ck, ...chiSoCu } = chi_so;
      return { ...con, chi_so: chiSoCu };
    };
    expect(JSON.parse(JSON.stringify(bocMoi(moi)))).toEqual(JSON.parse(JSON.stringify(bocMoi(cu))));
    expect(cu.chi_so.khau_vi).toBeNull();
    expect(moi.chi_so.khau_vi, 'kho phải cấp khẩu vị từ replay').not.toBeNull();
    expect(moi.chi_so.khau_vi!.n).toBe(cu.n_vong - 0); // mọi vòng quyết đều có số khẩu vị
    // Đường endpoint (ngữ nghĩa GÓI): mới 1 trận xong ⇒ chưa gói nào đầy ⇒ 🐣 + tiến độ.
    const api = await json('/api/v1/holdem/me/tinh-cach');
    expect(api.goi).toBeNull();
    expect(api.tinh_cach).toBe('dang_dinh_hinh');
    expect(api.tien_do.tran).toBe(1);
    expect(api.tien_do.vong_quyet).toBe(7); // D383 — 8 ô ⇒ 7 vòng
    expect(api.tien_do.can).toEqual({ tran: GOI.TRAN, vong_quyet: GOI.VONG_QUYET, vong_su_kien: GOI.VONG_SU_KIEN });
    expect(api.chi_so.hieu_chinh, 'chưa đủ gói thì chỉ số phải TẮT').toBeNull();
  }, 60_000);
});

describe('§II — cờ, khẩu vị, dấu, tick', () => {
  it('cột khẩu vị từ replay + cờ trận xong/màn tập đúng chỗ', async () => {
    const { rows } = await pool.query(
      `SELECT h.*, m.status FROM hanh_vi_vong h JOIN holdem_matches m USING (match_id)
        WHERE h.user_id = $1 ORDER BY m.started_at, h.vong`, [user.userId]);
    expect(rows.length).toBeGreaterThanOrEqual(9);
    const xong = rows.filter((r) => r.status === 'xong');
    expect(xong.length, 'trận trọn phải có 7 dòng (8 ô − lá mở màn)').toBe(7);
    expect(xong.every((r) => r.tran_xong === true)).toBe(true);
    expect(rows.filter((r) => r.status !== 'xong').every((r) => r.tran_xong === false)).toBe(true);
    // Vòng 1 mua btc 50% ⇒ tiền mặt ~50%, 1 mã; vòng 5 all-in vn30 ⇒ tiền mặt ≈ 0.
    const v1 = xong.find((r) => r.vong === 1)!;
    expect(v1.so_ma).toBe(1);
    expect(v1.tien_mat_bp).toBeGreaterThan(3000);
    expect(v1.tien_mat_bp).toBeLessThan(7000);
    // All-in vn30 ở vòng 5: tiền mặt chỉ còn phần Quỹ vòng vừa chia (không về 0 —
    // quỹ trả SAU chốt), và đang giữ ≥ 2 mã (vàng từ vòng 3 + vn30).
    const v5 = xong.find((r) => r.vong === 5)!;
    expect(v5.tien_mat_bp).toBeLessThan(v1.tien_mat_bp);
    expect(v5.tien_mat_bp).toBeLessThan(2500);
    expect(v5.so_ma).toBeGreaterThanOrEqual(2);
    expect(rows.every((r) => r.man_tap === false && r.la_khach === false)).toBe(true);
    // D323 — bump 1 → 2 (cột so_nhom). Trận thật ⇒ `hd_chot_phien` LUÔN có `chain`
    // (rỗng nhất cũng là mảng, xem holdem_api.ts) ⇒ so_nhom là SỐ 0..2, không null
    // (null chỉ hợp lệ cho dòng dựng trước formula v2 — không có dòng nào ở đây).
    // D327 — bump 2 → 3 (cột ms_quyet).
    // D409 — công thức trải 3 → 4 (sáu cột lửa/trait, migration 0071).
    expect(rows.every((r) => r.formula_version === 4)).toBe(true);
    /*
     * D327 — ĐƯỜNG CHÍNH, không đường tắt (A11.6/D78): vòng nộp tay qua route thật ⇒ event
     * `hd_chot_phien` mang `mo_luc`, và bảng phái sinh ra một SỐ (≥ 0 — hai giao dịch sát nhau
     * trong test có thể cùng mili-giây). Không bài này thì trường mới có thể không bao giờ được
     * ghi mà mọi vector thuần bên dưới vẫn xanh.
     */
    expect(rows.every((r) => typeof r.ms_quyet === 'number' && r.ms_quyet >= 0)).toBe(true);
    const { rows: ml } = await pool.query(
      `SELECT value_json->>'mo_luc' AS mo_luc FROM events
        WHERE user_id = $1 AND action_type = 'hd_chot_phien'`, [user.userId]);
    expect(ml.length).toBeGreaterThan(0);
    expect(ml.every((r) => typeof r.mo_luc === 'string' && Number.isFinite(Date.parse(r.mo_luc)))).toBe(true);
    expect(rows.every((r) => typeof r.so_nhom === 'number' && r.so_nhom >= 0 && r.so_nhom <= 2)).toBe(true);

    // Màn tập ⇒ cờ man_tap.
    const tap = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ tap: true }) });
    await nopVong(tap.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] });
    await hoSoTinhCachCuaUser(pool, user.userId); // làm tươi
    const { rows: t } = await pool.query(
      `SELECT man_tap FROM hanh_vi_vong WHERE match_id = $1`, [tap.match_id]);
    expect(t.length).toBe(1);
    expect(t[0]!.man_tap).toBe(true);
    // D300: seed bàn tập đi theo phiên bản luật — nhận ra bằng `laSeedManTap`, không so một hằng.
    expect(tap.seed === undefined || laSeedManTap(Number(tap.seed))).toBe(true);
  }, 60_000);

  it('dựng hai lần ra y một bảng; dấu hanh_vi_tran chặn quét lại', async () => {
    const truoc = (await pool.query(
      `SELECT match_id, vong, lenh_json::text AS l, pnl_bp, brier, tien_mat_bp, so_ma, nghi_may
         FROM hanh_vi_vong WHERE user_id = $1 ORDER BY match_id, vong`, [user.userId])).rows;
    const ids = [...new Set(truoc.map((r) => String(r.match_id)))];
    for (const id of ids) await dungHanhViTran(pool, id, hanhViDeps);
    const sau = (await pool.query(
      `SELECT match_id, vong, lenh_json::text AS l, pnl_bp, brier, tien_mat_bp, so_ma, nghi_may
         FROM hanh_vi_vong WHERE user_id = $1 ORDER BY match_id, vong`, [user.userId])).rows;
    expect(sau).toEqual(truoc);

    // Không có event mới ⇒ cập nhật tăng dần dựng 0 trận (kể cả trận bỏ ở vòng 1
    // ra 0 dòng — nhờ dấu `hanh_vi_tran`, không phải nhờ may).
    const kq = await capNhatCuaUser(pool, user.userId, hanhViDeps);
    expect(kq.tran).toBe(0);
    const dau = await pool.query(`SELECT count(*)::int AS n FROM hanh_vi_tran`);
    const tran = await pool.query(
      `SELECT count(*)::int AS n FROM holdem_matches WHERE owner_user_id = $1`, [user.userId]);
    expect(dau.rows[0]!.n, 'mọi trận — kể cả 0 dòng — phải có dấu').toBe(tran.rows[0]!.n);

    // Có event mới (nộp thêm một vòng ở trận dở) ⇒ đúng MỘT trận được dựng lại.
    const dang = await pool.query(
      `SELECT match_id FROM holdem_matches WHERE owner_user_id = $1 AND status = 'dang_choi'
        AND vong_hien_tai = 3 LIMIT 1`, [user.userId]);
    expect(dang.rowCount).toBe(1);
    await nopVong(String(dang.rows[0]!.match_id), 3);
    const kq2 = await capNhatCuaUser(pool, user.userId, hanhViDeps);
    expect(kq2.tran).toBe(1);
  }, 60_000);

  it('tick quét nền và khai số trận đã dựng', async () => {
    // Tạo người thứ hai có trận chưa được dựng (chưa ai mở hồ sơ của họ).
    const u2 = await createTestUser(pool);
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: BODY_TRAN }, u2.cookie);
    await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
      method: 'POST',
      body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the',
        them: 0, cuoc: [], lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] }),
    }, u2.cookie);
    const chua = await pool.query(`SELECT 1 FROM hanh_vi_vong WHERE match_id = $1`, [tao.match_id]);
    expect(chua.rowCount).toBe(0);

    const r = await app.request('http://localhost/api/v1/internal/tick', {
      method: 'POST', headers: { 'x-tick-secret': 'tick-test' },
    });
    expect(r.status).toBe(200);
    const body = await r.json() as any;
    expect(body.hanh_vi.tran).toBeGreaterThanOrEqual(1);
    const co = await pool.query(`SELECT 1 FROM hanh_vi_vong WHERE match_id = $1`, [tao.match_id]);
    expect(co.rowCount).toBe(1);
    // Lượt sau không có gì mới ⇒ 0.
    expect((await capNhatNen(pool, hanhViDeps)).tran).toBe(0);
  }, 60_000);
  /*
   * D406 — kho trên KHOÁ MẶC ĐỊNH (v54: bàn 16, o_up, luật từng lá): trận trọn phải ra đủ `tong_vong` dòng, cờ trận
   * xong đúng. Các bài còn lại ghim v53 (bàn 8) để giữ nhịp; bài này là chỗ duy nhất kho đi qua đường người chơi thật
   * đang đi từ 0.0.45 — người mới không được thấy hồ sơ rỗng chỉ vì bàn dài gấp đôi. ⚠ Đứng CUỐI §II: bài này dựng
   * thêm một dấu `hanh_vi_tran`, và bài "dựng hai lần" phía trên đếm dấu TOÀN BẢNG.
   */
  it('⭐ D406 — trận trọn ở khoá mặc định: kho có đủ tong_vong dòng, cờ trận xong đúng', async () => {
    const u3 = await createTestUser(pool);
    const tao = await json('/api/v1/holdem/matches', { method: 'POST', body: '{}' }, u3.cookie);
    const tong = Number(tao.tong_vong);
    // D525 — số vòng theo TÍNH CHẤT khoá mặc định (cỡ ghim − ô mở màn), không theo con số của một khoá.
    const luatMd = luatCua(HOLDEM_BALANCE_VERSION);
    expect(tong, 'tong_vong = cỡ bàn ghim của khoá mặc định − ô mở màn').toBe((coBanGhim(luatMd) ?? 0) - (luatMd.oUp ? 1 : 0));
    for (let v = 1; v <= tong; v += 1) {
      const r = await json(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
        method: 'POST',
        body: JSON.stringify({ vong: v, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [],
          ...(v === 1 ? { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] } : {}) }),
      }, u3.cookie);
      expect(r.error, `vòng ${v}: ${JSON.stringify(r)}`).toBeUndefined();
      // D525 — khoá mặc định có màn lõi: qua màn; màn cuối qua xong thì GET khép trận.
      if (r.cho_man) {
        await quaMan(pool, tao.match_id);
        await json(`/api/v1/holdem/matches/${tao.match_id}`, { method: 'GET' }, u3.cookie);
      }
    }
    await hoSoTinhCachCuaUser(pool, u3.userId);
    const { rows } = await pool.query(
      `SELECT vong, tran_xong FROM hanh_vi_vong WHERE match_id = $1 ORDER BY vong`, [tao.match_id]);
    expect(rows.map((r) => r.vong)).toEqual(Array.from({ length: tong }, (_, i) => i + 1));
    expect(rows.every((r) => r.tran_xong === true)).toBe(true);
    /*
     * D436 — khoá mặc định (v55) có hệ trait ⇒ kho chở `trait_json` là MẢNG (rỗng khi không mang lá nào) tới hàm chấm,
     * nên thẻ LỌC TIN của trận tách ra. Hàm thuần có bài riêng (`nang_luc.test.ts`); bài này hỏi ĐƯỜNG DB có tới không.
     */
    const hang = await docVongCuaTran(pool, [tao.match_id]);
    expect(hang.every((h) => Array.isArray(h.trait_json)), 'trận v55 phải chở trait_json là mảng').toBe(true);
    expect(chamNangLucTran(hang).nang_luc.find((n) => n.id === 'doc_tin')!.bang_chung)
      .toMatchObject({ tach_luat_trait: 1 });
  }, 60_000);
});

describe('§II.b — GÓI', () => {
  it('chơi đủ trận xong ⇒ gói 1 đầy, ảnh chụp lưu một lần, trận sau vào gói 2', async () => {
    /*
     * ⭐ SEED GHIM + handle tự sinh. Seed ngẫu nhiên thì có bản đồ khép trận sớm (D451 — mọi bot cháy) ⇒ vòng 5–7 ăn 409
     * `match_closed` (CI master 413ced0c). Quét 1.000 seed 32-bit qua đúng chuỗi lệnh dưới (10/10): 4 trận khép sớm (0,4 %) ⇒
     * 11 trận/lượt ≈ 4 % lượt đỏ. Seed 1–200 cùng chuỗi lệnh: 0 trận khép sớm; khoá v53 đóng băng (golden băm) nên không trôi.
     * Handle cố định làm lượt chạy lại của CI vấp `users_handle_key` (23505) — bỏ ghim. Admin + `la_tester` để `ep_seed` ăn (D413).
     */
    const u = await createTestUser(pool, { role: 'admin' });
    await pool.query(`UPDATE users SET la_tester = true WHERE user_id = $1`, [u.userId]);
    const j = (p: string, init: RequestInit = {}) => json(p, init, u.cookie);
    let soTran = 0;
    const choi = async () => {
      soTran += 1;
      const tao = await j('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: KHOA_BAI, ep_seed: soTran }) });
      const { rows: [m] } = await pool.query(`SELECT seed::text AS seed FROM holdem_matches WHERE match_id = $1`, [tao.match_id]);
      expect(m?.seed, 'ep_seed bị bỏ qua — người tạo trận phải là admin + la_tester').toBe(String(soTran));
      for (let v = 1; v <= 7; v += 1) {
        const r = await j(`/api/v1/holdem/matches/${tao.match_id}/rounds`, {
          method: 'POST',
          body: JSON.stringify({ vong: v, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the',
            them: 0, cuoc: [], ...(v === 1 ? { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 2500 }] } : {}) }),
        });
        expect(r.error, JSON.stringify(r)).toBeUndefined();
      }
    };
    for (let i = 0; i < GOI.TRAN - 1; i += 1) await choi();
    let hs = await j('/api/v1/holdem/me/tinh-cach');
    expect(hs.goi).toBeNull();
    expect(hs.tien_do.tran).toBe(GOI.TRAN - 1);
    expect(hs.tinh_cach).toBe('dang_dinh_hinh');

    await choi();
    hs = await j('/api/v1/holdem/me/tinh-cach');
    expect(hs.tien_do.tran, 'gói 1 vừa khép, gói 2 mở rỗng').toBe(0);
    expect(hs.goi).toEqual({ so: 1, tong: 1 });
    expect(hs.n_tran).toBe(GOI.TRAN);
    // D383 — bàn 8 ô ⇒ 7 vòng/trận (o[0] là bối cảnh mở màn, không quyết toán).
    expect(hs.n_vong).toBe(GOI.TRAN * 7);
    expect(hs.tinh_cach).not.toBe('dang_dinh_hinh');
    expect(hs.chi_so.hieu_chinh).not.toBeNull();
    expect(hs.lich_su.length).toBe(1);
    expect(hs.lich_su[0].goi_so).toBe(1);
    const luu = await pool.query(
      `SELECT goi_so, n_tran, tinh_cach FROM ho_so_goi WHERE user_id = $1`, [u.userId]);
    expect(luu.rows).toEqual([{ goi_so: 1, n_tran: GOI.TRAN, tinh_cach: hs.tinh_cach }]);

    // Trận 11: gói 1 KHÔNG đổi (ảnh chụp), tiến độ gói 2 = 1 trận.
    await choi();
    const hs2 = await j('/api/v1/holdem/me/tinh-cach');
    expect(hs2.goi).toEqual({ so: 1, tong: 1 });
    expect(hs2.tien_do.tran).toBe(1);
    expect(hs2.chi_so).toEqual(hs.chi_so);
    expect((await pool.query(`SELECT count(*)::int AS n FROM ho_so_goi WHERE user_id = $1`, [u.userId])).rows[0]!.n).toBe(1);
  }, 120_000);

  it('chiaGoi thuần: màn tập/bỏ dở/nghi máy không vào gói; gói kéo dài tới khi đủ sự kiện', () => {
    const v = (match_id: string, o: Partial<HangHanhVi> = {}): HangHanhVi => ({
      match_id, vong: 1, ts: new Date(0), lenh: [], pnl_bp: 0, brier: null, brier_v: null, mo_bang: false,
      o_su_kien: false, la_tin_gia: false, chuoi_tang: false, tu_dong: false, cho_bp: null,
      tien_mat_bp: null, so_ma: null, tiet_kiem_bp: null, tk_huy_so: null, so_nhom: null,
      ms_quyet: null, tran_xong: true, man_tap: false, la_khach: false,
      nghi_may: false, ...o,
    });
    const tran = (id: string, n: number, suKien: number, o = {}) =>
      Array.from({ length: n }, (_, i) => v(id, { vong: i + 1, o_su_kien: i < suKien, ...o }));
    // 10 trận × 4 vòng, 0 sự kiện ⇒ 40 vòng quyết nhưng thiếu sự kiện ⇒ CHƯA đầy.
    const a = Array.from({ length: 10 }, (_, i) => tran(`m${i}`, 4, 0)).flat();
    expect(chiaGoi(a).day.length).toBe(0);
    expect(chiaGoi(a).dangMo).toMatchObject({ tran: 10, vong_quyet: 40, vong_su_kien: 0, day: false });
    // Thêm 1 trận có 8 sự kiện ⇒ đầy, gói dài 11 trận.
    const b = a.concat(tran('m10', 8, 8));
    const kq = chiaGoi(b);
    expect(kq.day.length).toBe(1);
    expect(kq.day[0]!.tran_ids.length).toBe(11);
    // Màn tập · bỏ dở · nghi máy · tu_dong không đếm.
    const c = b.concat(tran('tap', 8, 8, { man_tap: true }), tran('do', 8, 8, { tran_xong: false }),
      tran('bot', 8, 8, { nghi_may: true }), tran('ngu', 8, 8, { tu_dong: true }));
    const kq2 = chiaGoi(c);
    expect(kq2.day.length).toBe(1);
    expect(kq2.dangMo).toMatchObject({ tran: 1, vong_quyet: 0, vong_su_kien: 0 });
  });
});

describe('§III — vector thuần', () => {
  const dong = (vong: number, tu_dong: boolean, giay: number): DongHanhViVong => ({
    match_id: 'm', vong, ts: new Date(1_000_000 + giay * 1000), lenh: [], pnl_bp: 0,
    brier: null, brier_v: null, mo_bang: false, o_su_kien: false, la_tin_gia: false,
    chuoi_tang: false, tu_dong, cho_bp: null, tien_mat_bp: null, so_ma: null,
    thay_o_do: null, tiet_kiem_bp: null, tk_huy_so: null, so_nhom: null, ms_quyet: null,
    tran_xong: true, man_tap: false, la_khach: false, nghi_may: false,
  });

  it('nghi máy: toàn tu_dong ⇒ cờ; có một vòng tự bấm ⇒ không; 1 vòng ⇒ không đủ cơ sở', () => {
    expect(danCoNghiMay([dong(1, true, 0), dong(2, true, 30)]).every((d) => d.nghi_may)).toBe(true);
    // Nộp nhanh (script/test) KHÔNG phải tiêu chí — xem ghi chú ở danCoNghiMay.
    expect(danCoNghiMay([dong(1, false, 0), dong(2, false, 1), dong(3, false, 2), dong(4, false, 3)])
      .some((d) => d.nghi_may)).toBe(false);
    expect(danCoNghiMay([dong(1, false, 0), dong(2, true, 20), dong(3, true, 45), dong(4, true, 70)])
      .some((d) => d.nghi_may)).toBe(false);
    expect(danCoNghiMay([dong(1, true, 0)]).some((d) => d.nghi_may)).toBe(false);
  });

  it('tiêu dùng mang ngữ cảnh: phút sau trận, trận đó thắng/thua, phút sau trợ cấp, số dư trước', () => {
    const t0 = new Date('2026-08-22T10:00:00Z');
    const luc = (phut: number) => new Date(t0.getTime() + phut * 60_000);
    const ra = traiTieuDung(
      [
        { event_id: 7, ts: luc(5), action_type: 'gacha_t', num: 100, value_json: {} },
        { event_id: 8, ts: luc(50), action_type: 'checkin', num: 50, value_json: {} },
        { event_id: 9, ts: luc(52), action_type: 'shop_q', num: null, value_json: { gia: 250 } },
        { event_id: 10, ts: luc(53), action_type: 'market_view', num: null, value_json: {} },
      ],
      [{ ts: luc(0), thang: false }, { ts: luc(40), thang: true }],
      [luc(50)],
      (ts) => (ts.getTime() === luc(5).getTime() ? 900 : ts.getTime() === luc(52).getTime() ? 1200 : null),
    );
    expect(ra.map((d) => d.action_type)).toEqual(['gacha_t', 'checkin', 'shop_q']); // market_view không phải tiền
    const g = ra[0]!;
    expect(g.loai).toBe('gacha'); expect(g.don_vi).toBe('T'); expect(g.so_tien).toBe(100);
    expect(g.phut_sau_tran).toBe(5); expect(g.tran_truoc_thang).toBe(false);
    expect(g.phut_sau_tro_cap).toBeNull(); expect(g.so_du_truoc).toBe(900);
    const s = ra[2]!;
    expect(s.loai).toBe('shop_q'); expect(s.don_vi).toBe('Q'); expect(s.so_tien).toBe(250);
    expect(s.phut_sau_tran).toBe(12); expect(s.tran_truoc_thang).toBe(true);
    expect(s.phut_sau_tro_cap).toBe(2); expect(s.so_du_truoc).toBe(1200);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * §IV — HAI CỘT NGÂN HÀNG (D317). Vì sao có khối riêng: cả hai cột đứng hay đổ
 * trên ĐÚNG MỘT phân biệt — `null` (cơ chế chưa tồn tại) khác `0` (có cửa mà
 * không bước vào). Điền 0 nhầm chỗ không làm gãy gì, không làm đỏ gì; nó lặng
 * lẽ đẻ ra hàng chục nghìn quan sát "người này không thích gửi tiết kiệm" từ
 * những trận chưa hề có sổ tiết kiệm, và mọi trung bình gộp sau đó lệch xuống.
 * Đó là lớp lỗi A11.2 sinh ra để chặn, và nó chỉ chặn được bằng một bài canh.
 * ══════════════════════════════════════════════════════════════════════════ */
describe('§IV — cột ngân hàng: null ≠ 0', () => {
  const MAP = { o: [{ kind: 'nen' }, { kind: 'nen' }, { kind: 'nen' }] };
  const CO = { tran_xong: true, man_tap: false, la_khach: false };
  /** Một vòng "đã quyết" cần `hd_cam_ket`, nếu không `traiTran` bỏ qua nó. */
  const camKet = (vong: number): EventTho =>
    ({ ts: new Date(1000 * vong), action_type: 'hd_cam_ket', num: null, value_json: { vong } });
  const tk = (vong: number, vj: Record<string, unknown>): EventTho =>
    ({ ts: new Date(1000 * vong + 1), action_type: 'hd_tiet_kiem', num: null,
       value_json: { vong, ...vj } });
  const kv = (vong: number, tiet_kiem_bp: number | null): KhauViVong =>
    ({ vong, tien_mat_bp: 5000, so_ma: 1, thay_o_do: null, tiet_kiem_bp });

  it('⭐ luật CHƯA có ngân hàng ⇒ CẢ HAI cột null, kể cả khi không có event nào', () => {
    const d = traiTran('m', MAP, [camKet(1), camKet(2)], [kv(1, null), kv(2, null)], CO);
    expect(d).toHaveLength(2);
    for (const x of d) {
      expect(x.tiet_kiem_bp, `vòng ${x.vong}`).toBeNull();
      expect(x.tk_huy_so, `vòng ${x.vong}`).toBeNull();
    }
  });

  it('⭐ luật CÓ ngân hàng mà ghế không gửi gì ⇒ 0, KHÔNG phải null', () => {
    const d = traiTran('m', MAP, [camKet(1)], [kv(1, 0)], CO);
    // Hai `toBe` này là cả lý do khối §IV tồn tại: `0` là một QUAN SÁT về khẩu
    // vị (có nút, không bấm), `null` là "không có nút". `??` lẫn chỗ là mất vế đầu.
    expect(d[0]!.tiet_kiem_bp).toBe(0);
    expect(d[0]!.tk_huy_so).toBe(0);
  });

  it('đếm ĐÚNG số hợp đồng huỷ, và chỉ đếm cú engine ĐÃ NHẬN', () => {
    const d = traiTran('m', MAP, [
      camKet(1), tk(1, { huy: ['tk1_0', 'tk1_1'], ok: true }),
      camKet(2), tk(2, { huy: ['tk2_0'], ok: false, loi: 'khong_du_von' }),
      camKet(3), tk(3, { mo: [{ moc_bp: 500, so_vong: 3 }], ok: true }),
    ], [kv(1, 4000), kv(2, 4000), kv(3, 6000)], CO);
    expect(d.map((x) => x.tk_huy_so)).toEqual([2, 0, 0]);
    //  ⚠ vòng 2: lệnh huỷ BỊ BÁC ⇒ hợp đồng còn nguyên, không mất đồng lãi nào.
    //     Đếm nó là đếm Ý ĐỊNH thành HÀNH ĐỘNG, mà cột này đo cái giá ĐÃ TRẢ.
    //     Sổ vẫn ghi dòng ấy (ý định là dữ liệu) — chỗ tách là ở đây.
    expect(d.map((x) => x.tiet_kiem_bp)).toEqual([4000, 4000, 6000]);
  });

  it('⭐ D327 — ms_quyet: số khi có mo_luc; null khi tu_dong · trận cũ · mốc hỏng · hiệu âm', () => {
    const MO = '2026-09-13T03:00:00.000Z';
    const chot = (vong: number, vj: Record<string, unknown> = {}): EventTho =>
      ({ ts: new Date(Date.parse(MO) + 90_000 * vong + 5), action_type: 'hd_chot_phien', num: 0,
         value_json: { vong, chain: [], ...vj } });
    const nop = (vong: number, giay: number, vj: Record<string, unknown> = {}): EventTho =>
      ({ ts: new Date(Date.parse(MO) + giay * 1000), action_type: 'hd_cam_ket', num: null,
         value_json: { vong, ...vj } });
    const d = traiTran('m', MAP, [
      nop(1, 42), chot(1, { mo_luc: MO }),
      nop(2, 60, { tu_dong: true }), chot(2, { mo_luc: MO }),
      nop(3, 30), chot(3),
    ], [], CO);
    expect(d.map((x) => x.ms_quyet)).toEqual([42_000, null, null]);
    const hong = traiTran('m', MAP, [nop(1, 10), chot(1, { mo_luc: 'không phải ngày' })], [], CO);
    expect(hong[0]!.ms_quyet).toBeNull();
    const am = traiTran('m', MAP, [nop(1, 10), chot(1, { mo_luc: '2026-09-13T04:00:00.000Z' })], [], CO);
    expect(am[0]!.ms_quyet).toBeNull();
  });

  it('vắng khẩu vị hẳn (trận không NAV) ⇒ null, không phải 0', () => {
    const d = traiTran('m', MAP, [camKet(1), tk(1, { huy: ['tk1_0'], ok: true })], [], CO);
    expect(d[0]!.tiet_kiem_bp).toBeNull();
    expect(d[0]!.tk_huy_so).toBeNull();
  });
});

/* ══════════════════════════════════════════════════════════════════════════
 * §V — ĐƯỜNG DB CỦA CỘT HUỶ SỔ (D388). Vì sao có khối riêng dù §IV đã khoá cột:
 * mọi bài §IV gọi thẳng `traiTran` với event DỰNG TAY, nên không bài nào đi qua
 * câu SQL nạp event của `dungHanhViTran`. Danh sách nạp ấy thiếu `hd_tiet_kiem` từ
 * D317 tới D388 ⇒ `tk_huy_so` ra 0 ở MỌI trận có sổ tiết kiệm, thẻ N1 chấm người
 * huỷ sổ sớm thành `lam_duoc` — mà §IV lẫn `nang_luc.test.ts` vẫn xanh suốt.
 * Khối này chơi thật qua `/rounds`, rồi đọc ở đúng những cửa người dùng chạm tới.
 * ══════════════════════════════════════════════════════════════════════════ */
describe('§V — đường DB: huỷ sổ sớm phải tới được cột và thẻ N1 (D388)', () => {
  const VONG_HUY = 3;
  let u: TestUser;
  let matchId: string;
  const j = (p: string, init: RequestInit = {}) => json(p, init, u.cookie);
  const n1 = (ds: { id: string }[]): any => ds.find((x) => x.id === 'cam_ket_tiet_kiem');

  beforeAll(async () => {
    u = await createTestUser(pool);
    /*
     * ⚠ GHIM `balance-v43-nganhang` ĐÍCH DANH (nếp `ngan_hang_api.test.ts`): khối này
     * đo ĐƯỜNG NẠP EVENT, không đo luật mặc định — mặc định lật thì bài vẫn phải đo
     * đúng một trận có sổ tiết kiệm.
     */
    const tao = await j('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v43-nganhang' }),
    });
    expect(tao.match_id, JSON.stringify(tao)).toBeDefined();
    matchId = tao.match_id as string;
    const tong = Number(tao.tong_vong);
    const bg = (await j(`/api/v1/holdem/matches/${matchId}`)).ban.tiet_kiem_bao_gia as { so_vong: number }[];
    const kyHan = Math.max(...bg.map((b) => b.so_vong));
    for (let v = 1; v <= tong; v += 1) {
      let them: Record<string, unknown> = {};
      if (v === 1) them = { tiet_kiem: { mo: [{ moc_bp: 5000, so_vong: kyHan }] } };
      if (v === VONG_HUY) {
        const so = (await j(`/api/v1/holdem/matches/${matchId}`)).ban.tiet_kiem as { id: string }[];
        expect(so, 'sổ mở ở vòng 1 phải còn tới vòng huỷ — không thì là đáo hạn, không phải huỷ sớm')
          .toHaveLength(1);
        them = { tiet_kiem: { huy: [so[0]!.id] } };
      }
      // Một lệnh huỷ BỊ BÁC (id không có): hợp đồng không tồn tại để mất lãi ⇒ KHÔNG được đếm.
      if (v === VONG_HUY + 1) them = { tiet_kiem: { huy: ['tk9_9'] } };
      const r = await j(`/api/v1/holdem/matches/${matchId}/rounds`, {
        method: 'POST',
        body: JSON.stringify({
          vong: v, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], ...them,
        }),
      });
      expect(r.error, `vòng ${v}: ${JSON.stringify(r)}`).toBeUndefined();
      if (v === 1 || v === VONG_HUY) expect(r.loi_von?.tiet_kiem ?? null, `vòng ${v}`).toBeNull();
      if (v === VONG_HUY + 1) expect(r.loi_von?.tiet_kiem, 'lệnh huỷ id lạ phải bị bác').toBeTruthy();
      if (v === tong) expect(r.xong, 'phải đi hết bàn để trận vào thẻ theo người').toBe(true);
    }
  }, 120_000);

  it('tiền đề: `events` có ĐỦ hai lệnh huỷ — một ĂN (ok) và một BỊ BÁC', async () => {
    // Không có tiền đề này thì mọi bài dưới có thể xanh vì fixture chưa hề chạm cửa huỷ.
    const { rows } = await pool.query(
      `SELECT value_json FROM events
        WHERE context_id = $1 AND action_type = 'hd_tiet_kiem' ORDER BY event_id`, [matchId]);
    const huy = rows.map((r) => r.value_json).filter((x) => Array.isArray(x.huy));
    expect(huy).toHaveLength(2);
    expect(huy[0]).toMatchObject({ vong: VONG_HUY, ok: true });
    expect(huy[0].huy).toHaveLength(1);
    expect(huy[1]).toMatchObject({ vong: VONG_HUY + 1, ok: false });
  });

  it('⭐ làm tươi kho ⇒ tk_huy_so = 1 ĐÚNG ở vòng huỷ, 0 (không null) ở mọi vòng khác', async () => {
    const kq = await capNhatCuaUser(pool, u.userId, hanhViDeps);
    expect(kq.tran, 'trận chưa ai dựng ⇒ lần làm tươi này phải dựng nó').toBe(1);
    const { rows } = await pool.query(
      `SELECT vong, tiet_kiem_bp, tk_huy_so FROM hanh_vi_vong WHERE match_id = $1 ORDER BY vong`,
      [matchId]);
    expect(rows.length).toBeGreaterThan(VONG_HUY + 1);
    // Phía replay cũng phải thấy cú huỷ: có tiền trong sổ trước vòng huỷ, 0 sau nó.
    expect(rows.find((r) => r.vong === 1)!.tiet_kiem_bp).toBeGreaterThan(0);
    expect(rows.find((r) => r.vong === VONG_HUY)!.tiet_kiem_bp).toBe(0);
    for (const r of rows) {
      expect(r.tk_huy_so, `vòng ${r.vong}`).toBe(r.vong === VONG_HUY ? 1 : 0);
    }
  });

  it('⭐ thẻ N1 chấm từ dòng kho = gap_chua_vung, vòng huỷ đầu đúng vòng huỷ', async () => {
    const the = chamNangLucTran(await docVongCuaTran(pool, [matchId]));
    expect(the.tinh_vao_the).toBe(true);
    const n = n1(the.nang_luc);
    expect(n.bac).toBe('gap_chua_vung');
    expect(n.bang_chung).toMatchObject({ so_huy: 1, vong_huy_dau: VONG_HUY });
  });

  it('⭐ màn kết (/autopsy) nói gap_chua_vung', async () => {
    const mo = await j(`/api/v1/holdem/matches/${matchId}/autopsy`);
    expect(mo.xong, JSON.stringify(mo)).toBe(true);
    expect(n1(mo.nang_luc.nang_luc).bac).toBe('gap_chua_vung');
  });

  it('⭐ thẻ theo người (/me/nang-luc) nói gap_chua_vung, không phải lam_duoc', async () => {
    const dto = await j('/api/v1/holdem/me/nang-luc');
    expect(dto.so_de, 'đúng một trận vào thẻ').toBe(1);
    expect(n1(dto.nang_luc)).toMatchObject({ bac: 'gap_chua_vung', so_de_gap: 1, so_de_lam_duoc: 0 });
  });

  /*
   * D396 — N2 ("đọc tin") ẨN khỏi mọi cửa ra (`NANG_LUC_AN`): thước thưởng người dồn một mã, phạt người chia
   * giỏ. Vẫn CHẤM (hàm thuần trả đủ ba) — chỉ không rời máy chủ.
   */
  it('⭐⭐ D396 — màn kết và thẻ theo người KHÔNG trả năng lực đang ẩn; năng lực đang hiện vẫn đủ', async () => {
    expect(NANG_LUC_AN, 'tiền đề: đang có năng lực bị ẩn').toContain('doc_tin');
    const vong = await docVongCuaTran(pool, [matchId]);
    expect(chamNangLucTran(vong).nang_luc.map((x) => x.id), 'hàm chấm vẫn chấm đủ').toContain('doc_tin');

    const mo = await j(`/api/v1/holdem/matches/${matchId}/autopsy`);
    expect(mo.nang_luc.nang_luc.map((x: { id: string }) => x.id)).toEqual([...NANG_LUC_HIEN]);
    const dto = await j('/api/v1/holdem/me/nang-luc');
    expect(dto.nang_luc.map((x: { id: string }) => x.id)).toEqual([...NANG_LUC_HIEN]);
    for (const tho of [JSON.stringify(mo.nang_luc), JSON.stringify(dto)]) {
      for (const an of NANG_LUC_AN) expect(tho, `"${an}" không được rời máy chủ`).not.toContain(an);
    }
  });

  it('⭐ tín hiệu game → PFM (/me/tin-hieu) đếm được cú huỷ', async () => {
    const t = await j('/api/v1/holdem/me/tin-hieu');
    // gm_tk_huy / gm_tk_giu của PFM đọc đúng hai số này (tin_hieu.ts · dongGameCuaKy).
    expect(t.tiet_kiem).toMatchObject({ n_tran_gui: 1, so_huy_tong: 1, ty_le_tran_giu_du: 0 });
  });

  it('⭐ bài canh CẢ LỚP: nhánh `action_type === …` của traiTran ≡ EVENT_TRAI_TRAN; kho.ts không giữ bản chép', () => {
    // Bóc chú thích trước khi quét (nếp gate_dung_map.test.ts): chính chú thích D388 nhắc tên event.
    const boc = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const trai = boc(readFileSync(resolve(process.cwd(), 'server/hanh_vi/trai.ts'), 'utf8'));
    const dau = trai.indexOf('export function traiTran(');
    const cuoi = trai.indexOf('\nexport function', dau + 1);
    expect(dau, 'không thấy traiTran — cấu trúc tệp đã đổi, đọc lại').toBeGreaterThan(-1);
    expect(cuoi).toBeGreaterThan(dau);
    // ⚠ `[^']+`, không `[a-z_]+`: bản đầu bỏ lọt tên có chữ số — mũi tiêm `'hd_gia_lap_d388'` ra 0 đỏ.
    const docTrongHam = new Set(
      [...trai.slice(dau, cuoi).matchAll(/action_type\s*===\s*'([^']+)'/g)].map((m) => m[1]));
    expect([...docTrongHam].sort(),
      'traiTran đọc một event mà câu SQL nạp không lấy (hoặc ngược lại) — sửa EVENT_TRAI_TRAN')
      .toEqual([...EVENT_TRAI_TRAN].sort());
    const kho = boc(readFileSync(resolve(process.cwd(), 'server/hanh_vi/kho.ts'), 'utf8'));
    expect(kho).toMatch(/\bEVENT_TRAI_TRAN\b/);
    // Không một action_type nào được GÕ trong kho.ts — kể cả loại tiêu dùng (cùng họ lỗi).
    const goTay = [...new Set([
      ...(kho.match(/'hd_[^']+'/g) ?? []),
      ...Object.keys(LOAI_TIEU_DUNG).map((a) => `'${a}'`).filter((a) => kho.includes(a)),
    ])];
    expect(goTay, 'kho.ts giữ lại bản chép tay action_type — nạp bằng danh sách của trai.ts').toEqual([]);
  });
});

describe('§VI — trận hỏng (D396): bảng nguyên vẹn, không chặn cả lượt', () => {
  /** Deps giả: replay NỔ đúng ở những trận trong `xau` — chỗ 7 trận v53 trên prod nổ thật (`khauViCuaTran`). */
  const depsNo = (xau: ReadonlySet<string>): Deps => ({
    khauViCuaTran: (row) => {
      if (xau.has(row.match_id)) throw new Error('Vòng 12 vượt quá map 12 ô (giả lập)');
      return hanhViDeps.khauViCuaTran(row);
    },
  });
  const demDong = async (id: string): Promise<number> =>
    (await pool.query(`SELECT count(*)::int AS n FROM hanh_vi_vong WHERE match_id = $1`, [id])).rows[0]!.n;
  const dauCua = async (id: string): Promise<string> =>
    String((await pool.query(`SELECT cap_nhat_luc::text AS t FROM hanh_vi_tran WHERE match_id = $1`, [id])).rows[0]?.t);

  it('⭐⭐ replay nổ ⇒ dòng CŨ của trận còn nguyên (trước D396: xoá trước rồi mới nổ — mất im lặng)', async () => {
    const id = await choiTronTran();
    await dungHanhViTran(pool, id, hanhViDeps);
    const truoc = await demDong(id);
    expect(truoc, 'tiền đề: trận đã có dòng').toBeGreaterThan(0);
    const dauTruoc = await dauCua(id);

    await expect(dungHanhViTran(pool, id, depsNo(new Set([id])))).rejects.toThrow(/vượt quá map/);
    expect(await demDong(id), 'dòng cũ phải còn nguyên').toBe(truoc);
    expect(await dauCua(id), 'dấu không được làm mới khi chưa dựng xong').toBe(dauTruoc);
  }, 60_000);

  it('⭐⭐ nhiều trận: trận hỏng bị bỏ qua + khai ra, trận lành XẾP SAU nó vẫn dựng (script · trang nhóm)', async () => {
    const xau = await choiTronTran();
    const lanh = await choiTronTran();
    await pool.query(`DELETE FROM hanh_vi_vong WHERE match_id = $1`, [lanh]);
    const kq = await dungLaiNhieuTran(pool, [xau, lanh], depsNo(new Set([xau])));
    expect(kq.hong.map((h) => h.match_id)).toEqual([xau]);
    expect(kq.hong[0]!.loi).toMatch(/vượt quá map/);
    expect(await demDong(lanh), 'trận lành xếp SAU trận hỏng vẫn phải được dựng').toBeGreaterThan(0);
  }, 60_000);

  it('⭐⭐ tick: trận hỏng CŨ NHẤT hàng đợi không chặn trận cần dựng xếp sau (bẫy của lần tăng formula_version)', async () => {
    const xau = await choiTronTran();
    const lanh = await choiTronTran();
    await dungHanhViTran(pool, xau, hanhViDeps);
    await dungHanhViTran(pool, lanh, hanhViDeps);
    // Giả lập "tăng HANH_VI_FORMULA_VERSION": dấu của cả hai trận thành bản cũ ⇒ cả hai thành "cần dựng",
    // trận hỏng đứng TRƯỚC (bắt đầu sớm hơn) trong hàng đợi của tick.
    await pool.query(`UPDATE holdem_matches SET started_at = started_at - interval '1 day' WHERE match_id = $1`, [xau]);
    await pool.query(
      `UPDATE hanh_vi_tran SET formula_version = formula_version - 1 WHERE match_id = ANY($1::uuid[])`, [[xau, lanh]]);
    await pool.query(`DELETE FROM hanh_vi_vong WHERE match_id = $1`, [lanh]);

    const kq = await capNhatNen(pool, depsNo(new Set([xau])), 40);
    expect(kq.hong, 'tick phải khai số trận không dựng được').toBeGreaterThanOrEqual(1);
    expect(await demDong(lanh), 'trận xếp sau trận hỏng vẫn phải được tick dựng').toBeGreaterThan(0);
    expect(await demDong(xau), 'trận hỏng giữ nguyên dòng cũ').toBeGreaterThan(0);
  }, 60_000);
});
