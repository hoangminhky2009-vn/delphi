/**
 * GHÉP BÀN XẾP HẠNG — ĐƯỜNG CHẠY THẬT QUA DB (SPEC alpha-draft-tang-khong-gian mục 6; migration 0078).
 *
 * Bẫy số 1 của repo là cơ chế trang trí (code có, test có, không đường chạy nào gọi). Nên bài này KHÔNG gọi hàm toán: nó đăng ký bằng
 * `dangKySuat`, ghép bằng `ghepCacSuat` (đúng hàm `/internal/tick` gọi), chốt bằng `chotBan`, rồi ĐỌC LẠI từ bảng.
 *
 *   §I   đăng ký: suất kế tiếp đúng :00/:15/:30/:45, idempotent, rút được, KHÔNG lộ số người đăng ký.
 *   §II  ghép: 3 người ⇒ không mở bàn · 4 ⇒ mở, máy ≤ 3 · n ⇒ ⌈n/20⌉ bàn đều · mọi bàn máy < người (đọc từ DB) · hai tick giẫm nhau = một lần ghép.
 *   §III trần bàn đồng thời hoãn chứ không mất suất; thiếu secret ⇒ fail-closed.
 *   §IV  chốt bàn: điểm CHỈ cặp người–người (số máy không đổi một điểm), zero-sum đọc từ sổ, vắng về đáy, <2 người xong ⇒ 0 điểm; trigger DB chặn bàn lệch.
 *
 * Thời gian: mọi hàm nhận `now` — bài dựng trên đồng hồ THẬT + k×15 phút để suất luôn ở tương lai gần (hạn bàn chưa qua dù chạy ngày nào).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser } from './helpers/fixtures.js';
import { GHEP_BAN, RANK_GHEP_KHOA_LUAT, suatKeTiep } from '../config/rank_ghep.js';
import { deltaTran } from '../config/rank.js';
import { kiemToanLamPhat } from '../server/rank.js';
import { currentSeasonId } from '../server/season.js';
import {
  GhepError, chotBan, chotBanQuaHan, dangKySuat, ghepCacSuat, rutSuat, trangThaiNguoi,
} from '../server/rank_ghep.js';

let db: TestDb;
let pool: pg.Pool;
const ENV = { SLOT_SHUFFLE_SECRET: 'secret-test-ghep-0078' };

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
}, 180_000);
afterAll(async () => { await db?.stop(); });

/** Mỗi kịch bản một suất RIÊNG: now_k = đồng hồ thật + k × 15 phút ⇒ slot khác nhau, luôn ở tương lai. */
let k = 0;
const base = Date.now();
function moiKichBan(): { now: Date; ghepLuc: (slot: Date) => Date } {
  k += 1;
  return { now: new Date(base + k * 20 * 60_000), ghepLuc: (slot) => new Date(slot.getTime() + 1_000) };
}

/** Dọn bàn còn dang dở của kịch bản trước — trần bàn đồng thời đếm toàn DB. */
beforeEach(async () => {
  await pool.query(`UPDATE rank_ban SET trang_thai = 'da_chot', ly_do_chot = 'don_test' WHERE trang_thai = 'dang_choi'`);
  // Suất còn "mở" của kịch bản trước (đăng ký rồi bỏ) sẽ bị tick của kịch bản sau ghép chung — đóng chúng để đếm theo từng kịch bản.
  await pool.query(`UPDATE rank_suat SET trang_thai = 'thieu_nguoi' WHERE trang_thai = 'mo'`);
});

async function taoNguoi(n: number, bac?: (i: number) => { diem: number; dinh?: number; soTran?: number }) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const u = await createTestUser(pool, {});
    const b = bac?.(i);
    if (b) {
      await pool.query(
        `INSERT INTO rank_diem (user_id, season_id, diem, diem_dinh, so_tran) VALUES ($1,$2,$3,$4,$5)`,
        [u.userId, currentSeasonId(), b.diem, b.dinh ?? Math.max(0, b.diem), b.soTran ?? 12]);
    }
    out.push(u);
  }
  return out;
}

async function dangKyHet(nguoi: { userId: string }[], now: Date): Promise<Date> {
  let slot = new Date(0);
  for (const u of nguoi) slot = (await dangKySuat(pool, u.userId, now)).slot;
  return slot;
}

const banCua = async (userId: string) => (await pool.query(
  `SELECT b.*, n.ghe_chi_so FROM rank_ban_nguoi n JOIN rank_ban b USING (ban_id) WHERE n.user_id = $1`, [userId])).rows;

describe('§I — đăng ký suất', () => {
  it('⭐ đăng ký vào đúng suất KẾ TIẾP (:00 :15 :30 :45 UTC), trả lại giờ ghép; bấm đúp = cùng một suất, chỉ một dòng', async () => {
    const { now } = moiKichBan();
    const [u] = await taoNguoi(1);
    const a = await dangKySuat(pool, u!.userId, now);
    expect(a.daCo).toBe(false);
    expect(a.slot.getTime()).toBe(suatKeTiep(now).getTime());
    expect(a.slot.getUTCMinutes() % 15).toBe(0);
    expect(a.slot.getUTCSeconds()).toBe(0);
    const b = await dangKySuat(pool, u!.userId, now);
    expect(b.daCo).toBe(true);
    expect(b.slot.getTime()).toBe(a.slot.getTime());
    const { rows } = await pool.query(`SELECT count(*)::int AS c FROM rank_dang_ky WHERE user_id = $1`, [u!.userId]);
    expect(rows[0].c).toBe(1);
  });

  it('⭐ hai cú bấm ĐỒNG THỜI không đẻ hai suất (chỉ mục duy nhất "một suất chờ")', async () => {
    const { now } = moiKichBan();
    const [u] = await taoNguoi(1);
    const kq = await Promise.all([dangKySuat(pool, u!.userId, now), dangKySuat(pool, u!.userId, now), dangKySuat(pool, u!.userId, now)]);
    expect(new Set(kq.map((x) => x.slot.getTime())).size).toBe(1);
    const { rows } = await pool.query(`SELECT count(*)::int AS c FROM rank_dang_ky WHERE user_id = $1 AND trang_thai = 'cho'`, [u!.userId]);
    expect(rows[0].c).toBe(1);
  });

  it('rút khỏi suất chưa tới giờ được; rút xong đăng ký lại sang suất kế được', async () => {
    const { now } = moiKichBan();
    const [u] = await taoNguoi(1);
    const a = await dangKySuat(pool, u!.userId, now);
    expect(await rutSuat(pool, u!.userId, now)).toBe(true);
    expect(await rutSuat(pool, u!.userId, now)).toBe(false);
    expect((await trangThaiNguoi(pool, u!.userId)).trang_thai).toBe('khong');
    const b = await dangKySuat(pool, u!.userId, now);
    expect(b.slot.getTime()).toBe(a.slot.getTime());
  });

  it('⭐ KHÔNG lộ số người đăng ký: trạng thái chờ chỉ có slot, không có bất kỳ số đếm nào (§7.3)', async () => {
    const { now } = moiKichBan();
    const nguoi = await taoNguoi(3);
    await dangKyHet(nguoi, now);
    const t = await trangThaiNguoi(pool, nguoi[0]!.userId);
    expect(t.trang_thai).toBe('cho');
    expect(Object.keys(t).sort()).toEqual(['slot', 'trang_thai']);
  });

  it('điểm ghép chốt lúc đăng ký = max(điểm, đỉnh − 150) và bậc hiển thị lúc đó', async () => {
    const { now } = moiKichBan();
    const [u] = await taoNguoi(1, () => ({ diem: 400, dinh: 700, soTran: 12 }));
    await dangKySuat(pool, u!.userId, now);
    const { rows } = await pool.query(`SELECT diem_ghep, bac_so FROM rank_dang_ky WHERE user_id = $1`, [u!.userId]);
    expect(rows[0].diem_ghep).toBe(550);                // đỉnh 700 − 150 > điểm hiện tại 400
    expect(rows[0].bac_so).toBeGreaterThanOrEqual(3);   // 400 điểm, 12 trận ⇒ đã xếp bậc (Nhà giao dịch+), không phải "chưa xếp"
  });
});

describe('§II — ghép bàn', () => {
  it('⭐ 3 người thật ⇒ KHÔNG mở bàn: 0 dòng rank_ban, suất = thieu_nguoi, cả ba nhận "suất này chưa đủ người" và đăng ký lại (giữ suất) được', async () => {
    const { now, ghepLuc } = moiKichBan();
    const nguoi = await taoNguoi(3);
    const slot = await dangKyHet(nguoi, now);
    const kq = await ghepCacSuat(pool, ghepLuc(slot), ENV);
    expect(kq.suat_thieu_nguoi).toBe(1);
    expect(kq.ban_moi).toBe(0);
    const { rows } = await pool.query(`SELECT count(*)::int AS c FROM rank_ban WHERE slot_id = $1::timestamptz`, [slot.toISOString()]);
    expect(rows[0].c).toBe(0);
    for (const u of nguoi) {
      const t = await trangThaiNguoi(pool, u.userId);
      expect(t.trang_thai).toBe('thieu_nguoi');
      if (t.trang_thai === 'thieu_nguoi') expect(t.thong_bao).toBe('Suất này chưa đủ người.');
    }
    const lai = await dangKySuat(pool, nguoi[0]!.userId, ghepLuc(slot));
    expect(lai.daCo).toBe(false);
    expect(lai.slot.getTime()).toBeGreaterThan(slot.getTime());
  });

  it('⭐ 4 người thật ⇒ MỞ bàn, số máy ≤ 3 (đọc từ rank_ban); mỗi người đúng một chỗ ngồi; vai_json có đủ so_ghe phần tử', async () => {
    const { now, ghepLuc } = moiKichBan();
    const nguoi = await taoNguoi(4);
    const slot = await dangKyHet(nguoi, now);
    const kq = await ghepCacSuat(pool, ghepLuc(slot), ENV);
    expect(kq.suat_da_ghep).toBe(1);
    expect(kq.ban_moi).toBe(1);
    const ban = await banCua(nguoi[0]!.userId);
    expect(ban).toHaveLength(1);
    const b = ban[0]!;
    expect(b.so_nguoi).toBe(4);
    expect(b.so_may).toBeLessThanOrEqual(3);
    expect(b.so_ghe).toBe(4 + b.so_may);
    expect(b.vai_json).toHaveLength(b.so_ghe);
    expect(b.balance_version).toBe(RANK_GHEP_KHOA_LUAT);   // D590 — khoá bàn ghép hiện hành (v71)
    const { rows } = await pool.query(`SELECT user_id, ghe_chi_so FROM rank_ban_nguoi WHERE ban_id = $1 ORDER BY ghe_chi_so`, [b.ban_id]);
    expect(rows.map((r) => r.ghe_chi_so)).toEqual([0, 1, 2, 3]);
    expect(new Set(rows.map((r) => r.user_id))).toEqual(new Set(nguoi.map((u) => u.userId)));
    const t = await trangThaiNguoi(pool, nguoi[2]!.userId);
    expect(t.trang_thai).toBe('da_ghep');
    // Sau khi ghép thì chốt số đăng ký vào suất (cho chỉ số chống thả rank) nhưng KHÔNG xuất ra client.
    const s = await pool.query(`SELECT so_dang_ky, so_ban FROM rank_suat WHERE slot_id = $1::timestamptz`, [slot.toISOString()]);
    expect(s.rows[0]).toEqual({ so_dang_ky: 4, so_ban: 1 });
    expect(JSON.stringify(t)).not.toContain('so_dang_ky');
  });

  it('⭐ 21 người ⇒ 2 bàn 11 + 10, không ai lẻ; MỌI bàn trong DB: máy < người, người + máy = ghế ≤ 20', async () => {
    const { now, ghepLuc } = moiKichBan();
    const nguoi = await taoNguoi(21, (i) => ({ diem: 50 * i }));
    const slot = await dangKyHet(nguoi, now);
    const kq = await ghepCacSuat(pool, ghepLuc(slot), ENV);
    expect(kq.ban_moi).toBe(2);
    const { rows } = await pool.query(
      `SELECT so_nguoi, so_may, so_ghe FROM rank_ban WHERE slot_id = $1::timestamptz ORDER BY chi_so`, [slot.toISOString()]);
    expect(rows.map((r) => r.so_nguoi)).toEqual([11, 10]);
    for (const r of rows) {
      expect(r.so_may).toBeLessThan(r.so_nguoi);
      expect(r.so_may).toBeLessThanOrEqual(Math.min(r.so_nguoi - 1, 20 - r.so_nguoi));
      expect(r.so_ghe).toBeLessThanOrEqual(20);
      expect(r.so_ghe).toBe(r.so_nguoi + r.so_may);
    }
    const dem = await pool.query(
      `SELECT count(*)::int AS c, count(DISTINCT n.user_id)::int AS d
         FROM rank_ban_nguoi n JOIN rank_ban b USING (ban_id) WHERE b.slot_id = $1::timestamptz`, [slot.toISOString()]);
    expect(dem.rows[0]).toEqual({ c: 21, d: 21 });
  }, 120_000);

  it('⭐ ràng buộc DB: bàn có máy ≥ người, hoặc < 4 người, bị schema từ chối (bất biến SPEC ở tầng bảng)', async () => {
    const { now } = moiKichBan();
    const [u] = await taoNguoi(1);
    const a = await dangKySuat(pool, u!.userId, now);
    await pool.query(`UPDATE rank_dang_ky SET trang_thai = 'rut' WHERE user_id = $1`, [u!.userId]);
    const them = (nguoi: number, may: number, ghe: number) => pool.query(
      `INSERT INTO rank_ban (slot_id, chi_so, season_id, seed, so_nguoi, so_may, so_ghe, co_ban_boc, bac_thap, vai_json, balance_version, han_luc)
       VALUES ($1::timestamptz, 77, $2, 1, $3, $4, $5, 4, 1, '[]'::jsonb, 'balance-v67-banxephang', now())`,
      [a.slot.toISOString(), currentSeasonId(), nguoi, may, ghe]);
    await expect(them(4, 4, 8)).rejects.toThrow(/rank_ban_may_it_hon_nguoi_chk/);
    await expect(them(5, 6, 11)).rejects.toThrow(/rank_ban_may_it_hon_nguoi_chk/);
    await expect(them(3, 0, 3)).rejects.toThrow();
    await expect(them(10, 11, 21)).rejects.toThrow();
    await expect(them(4, 3, 7)).resolves.toBeDefined();
  });

  it('⭐ hai tick giẫm nhau (đồng thời) ⇒ ghép ĐÚNG MỘT lần; tick chạy lại không làm gì thêm', async () => {
    const { now, ghepLuc } = moiKichBan();
    const nguoi = await taoNguoi(6);
    const slot = await dangKyHet(nguoi, now);
    const [x, y] = await Promise.all([ghepCacSuat(pool, ghepLuc(slot), ENV), ghepCacSuat(pool, ghepLuc(slot), ENV)]);
    expect(x.ban_moi + y.ban_moi).toBe(1);
    const sau = await ghepCacSuat(pool, ghepLuc(slot), ENV);
    expect(sau.ban_moi).toBe(0);
    const { rows } = await pool.query(`SELECT count(*)::int AS c FROM rank_ban WHERE slot_id = $1::timestamptz`, [slot.toISOString()]);
    expect(rows[0].c).toBe(1);
  });

  it('suất CHƯA tới giờ thì tick không đụng vào (đúng giờ mới ghép — không ghép sớm)', async () => {
    const { now } = moiKichBan();
    const nguoi = await taoNguoi(5);
    const slot = await dangKyHet(nguoi, now);
    const kq = await ghepCacSuat(pool, new Date(slot.getTime() - 1_000), ENV);
    expect(kq.ban_moi + kq.suat_da_ghep + kq.suat_thieu_nguoi).toBe(0);
    expect((await trangThaiNguoi(pool, nguoi[0]!.userId)).trang_thai).toBe('cho');
  });

  it('⭐ tất định: cùng đăng ký + cùng secret ⇒ cùng người cùng bàn, cùng seed; secret KHÁC ⇒ seed khác', async () => {
    const a = moiKichBan();
    const nguoi = await taoNguoi(8, (i) => ({ diem: 10 * i }));
    const slot = await dangKyHet(nguoi, a.now);
    await ghepCacSuat(pool, a.ghepLuc(slot), ENV);
    const lan1 = (await pool.query(`SELECT seed, so_ghe, vai_json FROM rank_ban WHERE slot_id = $1::timestamptz`, [slot.toISOString()])).rows[0]!;
    // Dựng lại từ đầu với đúng đăng ký đó ở một bản sao in-memory: hàm kế hoạch phải ra cùng seed.
    const { keHoachGhep } = await import('../config/rank_ghep.js');
    const { taoBam } = await import('../server/rank_ghep.js');
    const { rows: dk } = await pool.query(
      `SELECT user_id, diem_ghep, bac_so, created_at FROM rank_dang_ky WHERE slot_id = $1::timestamptz`, [slot.toISOString()]);
    const mk = (secret: string) => keHoachGhep(dk.map((r) => ({
      userId: String(r.user_id), diemGhep: r.diem_ghep, bacSo: r.bac_so, dangKyLuc: new Date(r.created_at).getTime(),
    })), taoBam(slot, secret), 99).ban[0]!;
    expect(mk(ENV.SLOT_SHUFFLE_SECRET).seed).toBe(Number(lan1.seed));
    expect(mk(ENV.SLOT_SHUFFLE_SECRET).soGhe).toBe(lan1.so_ghe);
    expect(mk('mot-secret-khac-hoan-toan').seed).not.toBe(Number(lan1.seed));
  });
});

describe('§III — trần bàn đồng thời và fail-closed', () => {
  it('⭐ đang có đủ 4 bàn rank ⇒ suất sau KHÔNG mở thêm bàn, người đăng ký chuyển sang suất kế (không mất suất)', async () => {
    const { now, ghepLuc } = moiKichBan();
    const [u0] = await taoNguoi(1);
    const mau = await dangKySuat(pool, u0!.userId, now);
    await pool.query(`UPDATE rank_dang_ky SET trang_thai = 'rut' WHERE user_id = $1`, [u0!.userId]);
    for (let i = 0; i < GHEP_BAN.TRAN_BAN_DONG_THOI; i += 1) {
      await pool.query(
        `INSERT INTO rank_ban (slot_id, chi_so, season_id, seed, so_nguoi, so_may, so_ghe, co_ban_boc, bac_thap, vai_json, balance_version, han_luc)
         VALUES ($1::timestamptz, $2, $3, 1, 4, 0, 4, 4, 1, '[]'::jsonb, 'balance-v67-banxephang', now() + interval '1 hour')`,
        [mau.slot.toISOString(), 90 + i, currentSeasonId()]);
    }
    const nguoi = await taoNguoi(5);
    const slot = await dangKyHet(nguoi, now);
    const kq = await ghepCacSuat(pool, ghepLuc(slot), ENV);
    expect(kq.hoan).toBe(5);
    const t = await trangThaiNguoi(pool, nguoi[0]!.userId);
    expect(t.trang_thai).toBe('cho');                 // vẫn đang chờ — ở suất sau
    if (t.trang_thai === 'cho') expect(new Date(t.slot).getTime()).toBeGreaterThan(slot.getTime());
  });

  it('⭐ thiếu SLOT_SHUFFLE_SECRET ⇒ fail-closed: không ghép bàn nào, suất vẫn "mở" để ghép khi có secret', async () => {
    const { now, ghepLuc } = moiKichBan();
    const nguoi = await taoNguoi(5);
    const slot = await dangKyHet(nguoi, now);
    const kq = await ghepCacSuat(pool, ghepLuc(slot), {});
    expect(kq.loi).toBe('thieu_secret');
    const { rows } = await pool.query(`SELECT trang_thai FROM rank_suat WHERE slot_id = $1::timestamptz`, [slot.toISOString()]);
    expect(rows[0].trang_thai).toBe('mo');
    const ok = await ghepCacSuat(pool, ghepLuc(slot), ENV);
    expect(ok.ban_moi).toBe(1);
  });

  it('đang ngồi bàn xếp hạng chưa xong thì không đăng ký thêm suất (không ngồi hai bàn rank cùng lúc)', async () => {
    const { now, ghepLuc } = moiKichBan();
    const nguoi = await taoNguoi(4);
    const slot = await dangKyHet(nguoi, now);
    await ghepCacSuat(pool, ghepLuc(slot), ENV);
    await expect(dangKySuat(pool, nguoi[0]!.userId, ghepLuc(slot))).rejects.toBeInstanceOf(GhepError);
  });
});

describe('§IV — chốt bàn: điểm CHỈ cặp người–người', () => {
  /** Dựng một bàn ĐÃ GHÉP qua đường thật rồi (tuỳ chọn) ép số máy để so sánh. */
  async function banThat(n: number, bac: (i: number) => { diem: number }, may?: number) {
    const s = moiKichBan();
    const nguoi = await taoNguoi(n, bac);
    const slot = await dangKyHet(nguoi, s.now);
    await ghepCacSuat(pool, s.ghepLuc(slot), ENV);
    const [b] = await banCua(nguoi[0]!.userId);
    if (may !== undefined) {
      await pool.query(`UPDATE rank_ban SET so_may = $2, so_ghe = so_nguoi + $2 WHERE ban_id = $1`, [b!.ban_id, may]);
    }
    return { nguoi, banId: String(b!.ban_id), han: new Date(b!.han_luc) };
  }
  const xong = (banId: string, userId: string, nav: number, dauHang = false) => pool.query(
    `UPDATE rank_ban_nguoi SET xong = true, dau_hang = $3, nav_cuoi = $4 WHERE ban_id = $1 AND user_id = $2`, [banId, userId, dauHang, nav]);
  const chot = async (banId: string, now: Date) => {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const r = await chotBan(c, banId, now);
      await c.query('COMMIT');
      return r;
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  };
  const ledger = async (banId: string) => (await pool.query(
    `SELECT user_id, delta, hang, so_cap_thang, so_ghe, match_id FROM rank_ledger WHERE ban_id = $1 ORDER BY hang, user_id`, [banId])).rows;

  it('⭐ cả bàn xong ⇒ chia điểm: tổng delta ĐỌC TỪ SỔ = 0; hạng theo NAV; kho bạc điểm cân; bàn chuyển da_chot', async () => {
    const { nguoi, banId, han } = await banThat(4, () => ({ diem: 300 }));
    const nav = [1500, 1200, 1100, 900];
    // Không đủ người xong thì chưa chốt.
    await xong(banId, nguoi[0]!.userId, nav[0]!);
    expect(await chot(banId, new Date(han.getTime() - 60_000))).toBe('chua_den_luc');
    for (const [i, u] of nguoi.entries()) await xong(banId, u.userId, nav[i]!);
    expect(await chot(banId, new Date(han.getTime() - 60_000))).toBe('da_ghi_diem');
    const sổ = await ledger(banId);
    expect(sổ).toHaveLength(4);
    expect(sổ.reduce((s, r) => s + r.delta, 0)).toBe(0);
    expect(sổ.map((r) => r.hang)).toEqual([1, 2, 3, 4]);
    expect(sổ.every((r) => r.so_ghe === 4)).toBe(true);
    expect(sổ.map((r) => r.so_cap_thang)).toEqual([3, 2, 1, 0]);
    const kt = await kiemToanLamPhat(pool, currentSeasonId());
    expect(kt.tran_lech).toEqual([]);
    const { rows } = await pool.query(`SELECT trang_thai, ly_do_chot FROM rank_ban WHERE ban_id = $1`, [banId]);
    expect(rows[0]).toEqual({ trang_thai: 'da_chot', ly_do_chot: 'du_nguoi' });
    // chốt lại lần nữa không ghi thêm dòng sổ nào (idempotent)
    expect(await chot(banId, han)).toBe('da_chot_san');
    expect(await ledger(banId)).toHaveLength(4);
  });

  it('⭐ SỐ MÁY KHÔNG ĐỔI MỘT ĐIỂM: hai bàn cùng người·cùng bậc·cùng NAV, một bàn 0 máy, một bàn 3 máy ⇒ delta GIỐNG HỆT và bằng `deltaTran` toàn người', async () => {
    const A = await banThat(4, () => ({ diem: 200 }), 0);
    const B = await banThat(4, () => ({ diem: 200 }), 3);
    const nav = [1500, 1200, 1100, 900];
    for (const x of [A, B]) {
      for (const [i, u] of x.nguoi.entries()) await xong(x.banId, u.userId, nav[i]!);
      expect(await chot(x.banId, new Date(x.han.getTime() - 1000))).toBe('da_ghi_diem');
    }
    const da = (await ledger(A.banId)).map((r) => r.delta);
    const dbb = (await ledger(B.banId)).map((r) => r.delta);
    expect(dbb).toEqual(da);
    // đối chiếu với công thức toàn người cùng bậc (bậc 2 mặc định cho nhãn đã xếp thấp) — cùng vector
    const bacSo = (await pool.query(`SELECT bac_so FROM rank_ban_nguoi WHERE ban_id = $1 LIMIT 1`, [A.banId])).rows[0]!.bac_so;
    const ids = ['w', 'x', 'y', 'z'];
    const goc = deltaTran(ids, Object.fromEntries(ids.map((g) => [g, bacSo === 0 ? 2 : bacSo])));
    expect(da).toEqual(ids.map((g) => goc[g]));
  });

  it('⭐ người VẮNG (không vào bàn) hết hạn ⇒ về tầng đáy, nhận Δ hạng cuối; sổ có dòng cho cả người chưa có trận (match_id NULL); zero-sum giữ', async () => {
    const { nguoi, banId, han } = await banThat(5, () => ({ diem: 300 }));
    await xong(banId, nguoi[0]!.userId, 1300);
    await xong(banId, nguoi[1]!.userId, 1100);
    await xong(banId, nguoi[2]!.userId, 1000, true);          // đầu hàng
    // nguoi[3], nguoi[4] không bao giờ vào bàn
    expect(await chot(banId, new Date(han.getTime() - 1000))).toBe('chua_den_luc');
    expect(await chot(banId, new Date(han.getTime() + 1000))).toBe('da_ghi_diem');
    const s = await ledger(banId);
    expect(s).toHaveLength(5);
    expect(s.reduce((a, r) => a + r.delta, 0)).toBe(0);
    const theo = new Map(s.map((r) => [r.user_id, r]));
    expect(theo.get(nguoi[0]!.userId)!.hang).toBe(1);
    expect(theo.get(nguoi[1]!.userId)!.hang).toBe(2);
    expect(theo.get(nguoi[2]!.userId)!.hang).toBe(3);         // đầu hàng thua người chưa đầu hàng
    expect(theo.get(nguoi[3]!.userId)!.hang).toBe(4);         // hai người vắng cùng tầng đáy (hạng 4, hoà)
    expect(theo.get(nguoi[4]!.userId)!.hang).toBe(4);
    expect(theo.get(nguoi[3]!.userId)!.match_id).toBeNull();
    expect(theo.get(nguoi[3]!.userId)!.delta).toBe(theo.get(nguoi[4]!.userId)!.delta);
    expect(theo.get(nguoi[3]!.userId)!.delta).toBeLessThan(0);
    const { rows } = await pool.query(`SELECT ly_do_chot FROM rank_ban WHERE ban_id = $1`, [banId]);
    expect(rows[0].ly_do_chot).toBe('het_han');
  });

  it('⭐ chỉ 1 người xong (3 người vắng) ⇒ 0 ĐIỂM cho cả bàn, bàn vẫn đóng — không ai thắng một mình trước người vắng (chống nuôi tài khoản phụ)', async () => {
    const { nguoi, banId, han } = await banThat(4, () => ({ diem: 300 }));
    await xong(banId, nguoi[0]!.userId, 1800);
    expect(await chot(banId, new Date(han.getTime() + 1000))).toBe('it_nguoi_xong');
    expect(await ledger(banId)).toHaveLength(0);
    const { rows } = await pool.query(`SELECT trang_thai, ly_do_chot FROM rank_ban WHERE ban_id = $1`, [banId]);
    expect(rows[0]).toEqual({ trang_thai: 'da_chot', ly_do_chot: 'it_nguoi_xong' });
  });

  it('tick `chotBanQuaHan` chốt các bàn đã hết hạn mà không cần ai mở app (C3: 0 người online)', async () => {
    const { nguoi, banId, han } = await banThat(4, () => ({ diem: 300 }));
    for (const [i, u] of nguoi.entries()) if (i < 3) await xong(banId, u.userId, 1500 - i * 100);
    const sớm = await chotBanQuaHan(pool, new Date(han.getTime() - 1000));
    expect(sớm.chot).toBe(0);
    const muon = await chotBanQuaHan(pool, new Date(han.getTime() + 1000));
    expect(muon.chot).toBeGreaterThanOrEqual(1);
    expect(await ledger(banId)).toHaveLength(4);
  });

  it('⭐ TRIGGER DB chặn bàn ghép lệch: ghi tay hai dòng cùng ban_id tổng ≠ 0 ⇒ COMMIT nổ', async () => {
    const { nguoi, banId } = await banThat(4, () => ({ diem: 300 }));
    const c = await pool.connect();
    let no = false;
    try {
      await c.query('BEGIN');
      for (const [u, d] of [[nguoi[0]!.userId, 30], [nguoi[1]!.userId, -20]] as const) {
        await c.query(
          `INSERT INTO rank_ledger (user_id, season_id, che_do, match_id, ban_id, so_ghe, so_la, hang, so_cap_thang, bac_vao_ban, delta, diem_sau, formula_version)
           VALUES ($1,$2,'rank_slot',NULL,$3,4,14,1,1,'tap_su',$4,$4,'test')`, [u, currentSeasonId(), banId, d]);
      }
      await c.query('COMMIT');
    } catch (e) {
      no = true;
      expect(String((e as Error).message)).toMatch(/tong delta/);
      await c.query('ROLLBACK').catch(() => {});
    } finally { c.release(); }
    expect(no).toBe(true);
  });
});
