/**
 * GHÉP BÀN XẾP HẠNG ≥ 4 NGƯỜI THẬT — tầng DB + scheduler (SPEC alpha-draft-tang-khong-gian mục 6, founder CHỐT 11/10).
 *
 * Toán thuần ở `config/rank_ghep.ts` (test không cần DB). File này làm bốn việc:
 *   1. `dangKySuat` / `rutSuat` / `trangThaiNguoi` — người chơi vào suất 15 phút (0 request polling: đúng giờ, tick ghép TRONG DB).
 *   2. `ghepCacSuat` — gọi từ `/internal/tick` (mỗi phút, D11 lớp 2; C3: KHÔNG setInterval trong serverless): suất tới giờ ⇒ kế hoạch ghép
 *      ⇒ ghi `rank_ban` + `rank_ban_nguoi`. Idempotent: `FOR UPDATE SKIP LOCKED` trên dòng suất ⇒ hai tick giẫm nhau vô hại.
 *   3. `ghiKetQuaVaoBan` / `chotBan` / `chotBanQuaHan` — cả bàn xong (hoặc hết hạn) ⇒ chia điểm CHỈ giữa cặp người–người (B3), một transaction.
 *   4. `layBanDangChoi` + `ghiTranVaoBan` — mỗi người một trận riêng cùng seed khi bấm vào bàn (đường tạo trận ở `holdem_api.ts`).
 *
 * ⚠ MÔ HÌNH CHƠI = ĐẤU BÙ CÙNG SEED (design_rank §7.4): engine hôm nay chỉ có MỘT ghế người, nên mỗi người chơi trận riêng cùng seed·cỡ ghế·bộ vai,
 *   so với nhau bằng NAV cuối. Ghế "người khác" trong trận của bạn do engine lái. Đây là điều SPEC chưa nói rõ — xem báo cáo, mục 4.
 * ⚠ KHÔNG ghi `events` mới (A7: action_type mới cần founder/migration riêng). Dữ liệu ghép nằm ở bảng `rank_*`; điểm đi qua `rank_diem_thay_doi` có sẵn.
 */
import { createHash } from 'node:crypto';
import type pg from 'pg';
import {
  GHEP_BAN, RANK_GHEP_KHOA_LUAT, diemGhep, keHoachGhep, suatKeTiep, tangHang,
  type DangKy, type KetQuaNguoi,
} from '../config/rank_ghep.js';
import {
  RANK_FORMULA_VERSION, bacSoTuNhan, bacTuDiem, deltaTheoTang, dinhNghiaBac, type BacId,
} from '../config/rank.js';
import { coBanGhim } from '../config/luoc_bo.js';
import { luatCua } from '../config/holdem.js';
import { currentSeasonId } from './season.js';
import { bocThamVaiTheoCoBan, type VaiId } from './holdem/vai.js';

type Db = pg.Pool | pg.PoolClient;

export class GhepError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/** Secret trộn bàn — CHỈ ở env server (§7.5). Thiếu ⇒ fail-closed: không ghép (thà chờ còn hơn để chia bàn đoán được). */
export function docSecret(env: Readonly<Record<string, string | undefined>> = process.env): string | null {
  const s = env.SLOT_SHUFFLE_SECRET;
  return s && s.length >= 8 ? s : null;
}

/** HASH(slot_id + secret + chuỗi) → số 32 bit không dấu. Client không có `secret` nên không tác động được vào chỗ ngồi. */
export function taoBam(slotId: Date, secret: string): (chuoi: string) => number {
  const sid = slotId.toISOString();
  return (chuoi: string) => createHash('sha256').update(`${secret}|${sid}|${chuoi}`).digest().readUInt32BE(0);
}

// ───────────────────────────────────────────────────────────────────────────────
// 1. ĐĂNG KÝ
// ───────────────────────────────────────────────────────────────────────────────

export interface KqDangKy { slot: Date; daCo: boolean }

/**
 * Đăng ký suất KẾ TIẾP. Idempotent: đã có đăng ký đang chờ ⇒ trả lại chính nó (bấm đúp không đẻ hai suất; chỉ MỘT suất chờ mỗi người).
 * ⚠ KHÔNG trả số người đã đăng ký — ở đâu cũng không (§7.3).
 */
export async function dangKySuat(pool: pg.Pool, userId: string, now: Date = new Date()): Promise<KqDangKy> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dangChoi = await client.query(
      `SELECT 1 FROM rank_ban_nguoi n JOIN rank_ban b USING (ban_id)
        WHERE n.user_id = $1 AND b.trang_thai = 'dang_choi' LIMIT 1`, [userId]);
    if (dangChoi.rowCount) {
      throw new GhepError(409, 'dang_trong_ban', 'Bạn đang có một bàn xếp hạng chưa xong — chơi xong bàn đó trước đã.');
    }
    const co = await client.query(
      `SELECT slot_id FROM rank_dang_ky WHERE user_id = $1 AND trang_thai = 'cho'`, [userId]);
    if (co.rows[0]) {
      await client.query('ROLLBACK');
      return { slot: new Date(co.rows[0].slot_id), daCo: true };
    }
    const seasonId = currentSeasonId(now);
    const { rows: dr } = await client.query(
      `SELECT diem, diem_dinh, so_tran, hang FROM rank_diem WHERE user_id = $1 AND season_id = $2`, [userId, seasonId]);
    const d = dr[0];
    const diem = d ? Number(d.diem) : 0;
    const dinh = d ? Number(d.diem_dinh) : 0;
    const bac: BacId = d ? bacTuDiem(diem, Number(d.so_tran), d.hang === null ? null : Number(d.hang)) : 'chua_xep';
    const bacSo = bac === 'chua_xep' ? 0 : dinhNghiaBac(bac).bac;

    let slot = suatKeTiep(now);
    for (let thu = 0; thu < 3; thu += 1) {
      await client.query(
        `INSERT INTO rank_suat (slot_id, season_id) VALUES ($1::timestamptz, $2) ON CONFLICT (slot_id) DO NOTHING`,
        [slot.toISOString(), seasonId]);
      const s = await client.query(
        `SELECT trang_thai FROM rank_suat WHERE slot_id = $1::timestamptz FOR SHARE`, [slot.toISOString()]);
      if (s.rows[0]?.trang_thai === 'mo') break;
      slot = suatKeTiep(slot);   // tick vừa đóng suất này giữa chừng ⇒ sang suất kế
    }
    // Đã rút (hoặc suất trước báo thiếu người) rồi đăng ký lại đúng suất đó: cập nhật dòng cũ thay vì đụng khoá chính.
    await client.query(
      `INSERT INTO rank_dang_ky (slot_id, user_id, diem_ghep, bac_so)
       VALUES ($1::timestamptz, $2, $3, $4)
       ON CONFLICT (slot_id, user_id) DO UPDATE
          SET trang_thai = 'cho', diem_ghep = EXCLUDED.diem_ghep, bac_so = EXCLUDED.bac_so, ban_id = NULL, created_at = now()
        WHERE rank_dang_ky.trang_thai IN ('rut', 'thieu_nguoi')`,
      [slot.toISOString(), userId, diemGhep(diem, dinh), bacSo]);
    await client.query('COMMIT');
    return { slot, daCo: false };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    // Hai cú bấm đồng thời: chỉ mục duy nhất "một suất chờ" chặn cú thứ hai ⇒ coi như đã có.
    // ⚠ `client`, KHÔNG `pool`: client chưa nhả (finally ở dưới) — xin kết nối thứ hai là bế tắc khi prod mở `max: 1` (lint:pool-lock).
    if ((e as { code?: string }).code === '23505') {
      const r = await client.query(`SELECT slot_id FROM rank_dang_ky WHERE user_id = $1 AND trang_thai = 'cho'`, [userId]);
      if (r.rows[0]) return { slot: new Date(r.rows[0].slot_id), daCo: true };
    }
    throw e;
  } finally {
    client.release();
  }
}

/** Rút khỏi suất khi suất chưa tới giờ. Trả `true` nếu có gì để rút. */
export async function rutSuat(pool: pg.Pool, userId: string, now: Date = new Date()): Promise<boolean> {
  const r = await pool.query(
    `UPDATE rank_dang_ky SET trang_thai = 'rut'
      WHERE user_id = $1 AND trang_thai = 'cho' AND slot_id > $2::timestamptz`,
    [userId, now.toISOString()]);
  return (r.rowCount ?? 0) > 0;
}

export type TrangThaiNguoi =
  | { trang_thai: 'khong' }
  | { trang_thai: 'cho'; slot: string }
  | { trang_thai: 'thieu_nguoi'; slot: string; thong_bao: string; lua_chon: ['giu_suat', 'dau_tu_do'] }
  | {
    trang_thai: 'da_ghep'; slot: string;
    ban: { so_nguoi: number; so_may: number; so_ghe: number; han_luc: string; ban_trang_thai: 'dang_choi' | 'da_chot'; match_id: string | null; xong: boolean };
  };

/** Trạng thái đăng ký gần nhất của người này. Chỉ đọc theo khoá — không đếm ai khác. */
export async function trangThaiNguoi(db: Db, userId: string): Promise<TrangThaiNguoi> {
  const { rows } = await db.query(
    `SELECT d.slot_id, d.trang_thai, d.ban_id,
            b.so_nguoi, b.so_may, b.so_ghe, b.han_luc, b.trang_thai AS ban_tt,
            n.match_id, n.xong
       FROM rank_dang_ky d
       LEFT JOIN rank_ban b ON b.ban_id = d.ban_id
       LEFT JOIN rank_ban_nguoi n ON n.ban_id = d.ban_id AND n.user_id = d.user_id
      WHERE d.user_id = $1 AND d.trang_thai <> 'rut'
      ORDER BY d.slot_id DESC LIMIT 1`, [userId]);
  const r = rows[0];
  if (!r) return { trang_thai: 'khong' };
  const slot = new Date(r.slot_id).toISOString();
  if (r.trang_thai === 'cho') return { trang_thai: 'cho', slot };
  if (r.trang_thai === 'thieu_nguoi') {
    return {
      trang_thai: 'thieu_nguoi', slot, thong_bao: 'Suất này chưa đủ người.', lua_chon: ['giu_suat', 'dau_tu_do'],
    };
  }
  return {
    trang_thai: 'da_ghep', slot,
    ban: {
      so_nguoi: Number(r.so_nguoi), so_may: Number(r.so_may), so_ghe: Number(r.so_ghe),
      han_luc: new Date(r.han_luc).toISOString(), ban_trang_thai: r.ban_tt,
      match_id: r.match_id ?? null, xong: r.xong === true,
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// 2. GHÉP — gọi từ /internal/tick
// ───────────────────────────────────────────────────────────────────────────────

export interface KqGhepSuat {
  bat: boolean;
  loi?: 'thieu_secret';
  suat_da_ghep: number;
  suat_thieu_nguoi: number;
  ban_moi: number;
  hoan: number;
}

/** Ghép mọi suất đã tới giờ mà chưa ghép. Mỗi suất một transaction riêng. */
export async function ghepCacSuat(
  pool: pg.Pool, now: Date = new Date(), env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<KqGhepSuat> {
  const kq: KqGhepSuat = { bat: true, suat_da_ghep: 0, suat_thieu_nguoi: 0, ban_moi: 0, hoan: 0 };
  const secret = docSecret(env);
  if (!secret) return { ...kq, loi: 'thieu_secret' };
  const { rows } = await pool.query(
    `SELECT slot_id FROM rank_suat WHERE trang_thai = 'mo' AND slot_id <= $1::timestamptz ORDER BY slot_id LIMIT 8`,
    [now.toISOString()]);
  for (const r of rows) {
    const k = await ghepMotSuat(pool, new Date(r.slot_id), now, secret);
    if (k === null) continue;                       // tick khác đang giữ suất này
    if (k.thieuNguoi) kq.suat_thieu_nguoi += 1; else kq.suat_da_ghep += 1;
    kq.ban_moi += k.soBan;
    kq.hoan += k.hoan;
  }
  return kq;
}

async function ghepMotSuat(
  pool: pg.Pool, slot: Date, now: Date, secret: string,
): Promise<{ thieuNguoi: boolean; soBan: number; hoan: number } | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const khoa = await client.query(
      `SELECT season_id FROM rank_suat WHERE slot_id = $1::timestamptz AND trang_thai = 'mo' FOR UPDATE SKIP LOCKED`,
      [slot.toISOString()]);
    if (!khoa.rows[0]) { await client.query('ROLLBACK'); return null; }
    const seasonId = String(khoa.rows[0].season_id);
    const { rows: dk } = await client.query(
      `SELECT user_id, diem_ghep, bac_so, created_at FROM rank_dang_ky WHERE slot_id = $1::timestamptz AND trang_thai = 'cho'`,
      [slot.toISOString()]);
    const dangKy: DangKy[] = dk.map((x) => ({
      userId: String(x.user_id), diemGhep: Number(x.diem_ghep), bacSo: Number(x.bac_so),
      dangKyLuc: new Date(x.created_at).getTime(),
    }));
    // Trần bàn rank đồng thời (§7.6): bàn đang chơi chiếm chỗ; hết chỗ ⇒ hoãn sang suất sau, không mất suất.
    const { rows: dem } = await client.query(`SELECT count(*)::int AS c FROM rank_ban WHERE trang_thai = 'dang_choi'`);
    const choTrong = Math.max(0, GHEP_BAN.TRAN_BAN_DONG_THOI - Number(dem[0]!.c));
    const bam = taoBam(slot, secret);
    const kh = keHoachGhep(dangKy, bam, choTrong);

    if (kh.trangThai === 'thieu_nguoi') {
      await client.query(
        `UPDATE rank_dang_ky SET trang_thai = 'thieu_nguoi' WHERE slot_id = $1::timestamptz AND trang_thai = 'cho'`,
        [slot.toISOString()]);
      await client.query(
        `UPDATE rank_suat SET trang_thai = 'thieu_nguoi', so_dang_ky = $2, so_ban = 0, ghep_luc = $3::timestamptz
          WHERE slot_id = $1::timestamptz`,
        [slot.toISOString(), dangKy.length, now.toISOString()]);
      await client.query('COMMIT');
      return { thieuNguoi: true, soBan: 0, hoan: 0 };
    }

    const theoId = new Map(dk.map((x) => [String(x.user_id), x]));
    // Cửa sổ chơi tính từ lúc bàn THẬT SỰ mở (không phải từ giờ suất) — tick trễ vài phút không ăn mất thời gian của người chơi.
    const hanLuc = new Date(Math.max(slot.getTime(), now.getTime()) + GHEP_BAN.HAN_BAN_PHUT * 60_000);
    for (const b of kh.ban) {
      const vai = bocThamVaiTheoCoBan(b.seed, b.soGhe);
      const { rows: ins } = await client.query(
        `INSERT INTO rank_ban (slot_id, chi_so, season_id, seed, so_nguoi, so_may, so_ghe, co_ban_boc, bac_thap,
                               vai_json, balance_version, han_luc)
         VALUES ($1::timestamptz, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12::timestamptz)
         RETURNING ban_id`,
        [slot.toISOString(), b.chiSo, seasonId, b.seed, b.soNguoi, b.soMay, b.soGhe, b.coBanBoc, b.bacThap,
          JSON.stringify(vai), RANK_GHEP_KHOA_LUAT, hanLuc.toISOString()]);
      const banId = String(ins[0]!.ban_id);
      for (const [i, userId] of b.nguoi.entries()) {
        const x = theoId.get(userId)!;
        const bacSo = Number(x.bac_so);
        await client.query(
          `INSERT INTO rank_ban_nguoi (ban_id, user_id, ghe_chi_so, bac_id, bac_so) VALUES ($1,$2,$3,$4,$5)`,
          [banId, userId, i, bacIdTuSo(bacSo), bacSo]);
      }
      await client.query(
        `UPDATE rank_dang_ky SET trang_thai = 'da_ghep', ban_id = $3
          WHERE slot_id = $1::timestamptz AND user_id = ANY($2::uuid[])`,
        [slot.toISOString(), b.nguoi, banId]);
    }
    if (kh.hoan.length > 0) {
      // Vượt trần bàn đồng thời: chuyển nguyên đăng ký sang suất kế tiếp (giữ chỗ, giữ điểm ghép đã chốt).
      const tiep = suatKeTiep(now);
      await client.query(
        `INSERT INTO rank_suat (slot_id, season_id) VALUES ($1::timestamptz, $2) ON CONFLICT (slot_id) DO NOTHING`,
        [tiep.toISOString(), seasonId]);
      await client.query(
        `UPDATE rank_dang_ky SET slot_id = $3::timestamptz
          WHERE slot_id = $1::timestamptz AND user_id = ANY($2::uuid[]) AND trang_thai = 'cho'`,
        [slot.toISOString(), kh.hoan, tiep.toISOString()]);
    }
    await client.query(
      `UPDATE rank_suat SET trang_thai = 'da_ghep', so_dang_ky = $2, so_ban = $3, ghep_luc = $4::timestamptz
        WHERE slot_id = $1::timestamptz`,
      [slot.toISOString(), dangKy.length, kh.ban.length, now.toISOString()]);
    await client.query('COMMIT');
    return { thieuNguoi: false, soBan: kh.ban.length, hoan: kh.hoan.length };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Bậc SỐ 1..7 → BacId (0 = chưa xếp). Dùng khi ghi `bac_id` hiển thị. */
function bacIdTuSo(so: number): BacId {
  const ids: BacId[] = ['chua_xep', 'tap_su', 'chuyen_vien', 'nha_giao_dich', 'quan_ly_danh_muc', 'giam_doc_dau_tu', 'chu_quy', 'tao_song'];
  return ids[so] ?? 'chua_xep';
}

// ───────────────────────────────────────────────────────────────────────────────
// 3. VÀO BÀN
// ───────────────────────────────────────────────────────────────────────────────

export interface BanCuaNguoi {
  banId: string;
  seed: number;
  soGhe: number;
  soNguoi: number;
  soMay: number;
  vai: VaiId[];
  balanceVersion: string;
  seasonId: string;
  hanLuc: Date;
  gheChiSo: number;
  bacId: BacId;
  matchId: string | null;
}

/** Bàn xếp hạng ĐANG MỞ của người này (nếu có). */
export async function layBanDangChoi(db: Db, userId: string, khoa = false): Promise<BanCuaNguoi | null> {
  const { rows } = await db.query(
    `SELECT b.ban_id, b.seed, b.so_ghe, b.so_nguoi, b.so_may, b.vai_json, b.balance_version, b.season_id, b.han_luc,
            n.ghe_chi_so, n.bac_id, n.match_id
       FROM rank_ban_nguoi n JOIN rank_ban b USING (ban_id)
      WHERE n.user_id = $1 AND b.trang_thai = 'dang_choi'
      ORDER BY b.created_at DESC LIMIT 1 ${khoa ? 'FOR UPDATE OF n' : ''}`, [userId]);
  const r = rows[0];
  if (!r) return null;
  return {
    banId: String(r.ban_id), seed: Number(r.seed), soGhe: Number(r.so_ghe), soNguoi: Number(r.so_nguoi), soMay: Number(r.so_may),
    vai: r.vai_json as VaiId[], balanceVersion: String(r.balance_version), seasonId: String(r.season_id),
    hanLuc: new Date(r.han_luc), gheChiSo: Number(r.ghe_chi_so), bacId: r.bac_id as BacId, matchId: r.match_id ?? null,
  };
}

/** Gắn trận vừa tạo vào chỗ ngồi. Chỉ ghi khi chỗ còn trống — hai cú bấm đồng thời không đẻ hai trận. */
export async function ghiTranVaoBan(db: Db, banId: string, userId: string, matchId: string): Promise<boolean> {
  const r = await db.query(
    `UPDATE rank_ban_nguoi SET match_id = $3 WHERE ban_id = $1 AND user_id = $2 AND match_id IS NULL`,
    [banId, userId, matchId]);
  return (r.rowCount ?? 0) === 1;
}

/**
 * Sơ đồ vai CHO GHẾ NGƯỜI THỨ j: ghế 'ban' mang vai của chỗ j, các ghế còn lại nhận lần lượt phần vai dư theo thứ tự bàn.
 * Tập vai cả bàn là một và giống nhau với mọi người chơi (chỉ khác ai cầm vai nào).
 */
export function vaiChoGheNguoi(vaiBan: readonly VaiId[], gheChiSo: number): VaiId[] {
  const conLai = vaiBan.filter((_, i) => i !== gheChiSo);
  return [vaiBan[gheChiSo]!, ...conLai];
}

// ───────────────────────────────────────────────────────────────────────────────
// 4. CHỐT BÀN — chia điểm CHỈ cặp người–người (B3, §2.10)
// ───────────────────────────────────────────────────────────────────────────────

/** Ít nhất bấy nhiêu người ĐÃ XONG trận thì bàn mới có nghĩa để so; dưới ngưỡng ⇒ 0 điểm cho cả bàn (không ai thắng một mình). */
export const SO_NGUOI_XONG_TOI_THIEU = 2;

export type KqChotBan = 'chua_den_luc' | 'da_chot_san' | 'it_nguoi_xong' | 'da_ghi_diem';

/** Gọi khi MỘT trận của bàn kết thúc, TRONG transaction kết trận (`luuKetQua`). Không thuộc bàn ghép ⇒ trả `null`. */
export async function ghiKetQuaVaoBan(client: pg.PoolClient, matchId: string, now: Date = new Date()): Promise<KqChotBan | null> {
  const { rows } = await client.query(
    `SELECT ban_id, user_id FROM rank_ban_nguoi WHERE match_id = $1`, [matchId]);
  const m = rows[0];
  if (!m) return null;
  const { rows: kq } = await client.query(
    `SELECT von_cuoi, dau_hang FROM holdem_results WHERE match_id = $1 AND ghe_id = 'ban'`, [matchId]);
  const r = kq[0];
  if (!r) return null;
  const banId = String(m.ban_id);
  // Khoá bàn TRƯỚC khi ghi kết quả: hai người kết trận cùng lúc không cùng thấy "mình là người cuối" hay "chưa ai là người cuối".
  const b = await client.query(`SELECT trang_thai FROM rank_ban WHERE ban_id = $1 FOR UPDATE`, [banId]);
  if (b.rows[0]?.trang_thai === 'da_chot') return 'da_chot_san';   // bàn đã chốt (hết hạn): kết quả muộn không đổi điểm
  await client.query(
    `UPDATE rank_ban_nguoi SET xong = true, dau_hang = $3, nav_cuoi = $4 WHERE ban_id = $1 AND user_id = $2`,
    [banId, m.user_id, r.dau_hang === true, Math.trunc(Number(r.von_cuoi))]);
  return chotBan(client, banId, now);
}

/**
 * Chốt một bàn nếu đủ điều kiện: mọi người đã xong / bỏ dở, hoặc quá hạn. PHẢI trong transaction (trigger zero-sum DEFERRED kiểm lúc COMMIT).
 * Người chưa xong lúc chốt = VẮNG ⇒ về tầng đáy (§7.7), nhận Δ của hạng cuối.
 */
export async function chotBan(client: pg.PoolClient, banId: string, now: Date = new Date()): Promise<KqChotBan> {
  const { rows: bb } = await client.query(`SELECT * FROM rank_ban WHERE ban_id = $1 FOR UPDATE`, [banId]);
  const ban = bb[0];
  if (!ban || ban.trang_thai === 'da_chot') return 'da_chot_san';
  const { rows: nguoi } = await client.query(
    `SELECT n.user_id, n.bac_id, n.match_id, n.xong, n.dau_hang, n.nav_cuoi, m.status AS m_status
       FROM rank_ban_nguoi n LEFT JOIN holdem_matches m ON m.match_id = n.match_id
      WHERE n.ban_id = $1 ORDER BY n.ghe_chi_so`, [banId]);
  const quaHan = now.getTime() >= new Date(ban.han_luc).getTime();
  const conDo = nguoi.filter((x) => !x.xong && x.m_status !== 'bo_dở' && x.m_status !== 'xong');
  if (conDo.length > 0 && !quaHan) return 'chua_den_luc';

  const kq: KetQuaNguoi[] = nguoi.map((x) => ({
    userId: String(x.user_id), xong: x.xong === true, dauHang: x.dau_hang === true, nav: Number(x.nav_cuoi ?? 0),
  }));
  const nXong = kq.filter((x) => x.xong).length;
  if (nXong < SO_NGUOI_XONG_TOI_THIEU) {
    await client.query(
      `UPDATE rank_ban SET trang_thai = 'da_chot', ly_do_chot = 'it_nguoi_xong', chot_luc = $2::timestamptz WHERE ban_id = $1`,
      [banId, now.toISOString()]);
    return 'it_nguoi_xong';
  }

  const tang = tangHang(kq);
  const bacSo: Record<string, number> = {};
  const bacId: Record<string, string> = {};
  const matchCua: Record<string, string | null> = {};
  for (const x of nguoi) {
    const u = String(x.user_id);
    bacSo[u] = bacSoTuNhan(String(x.bac_id));
    bacId[u] = String(x.bac_id);
    matchCua[u] = x.match_id ?? null;
  }
  const delta = deltaTheoTang(tang, bacSo);
  const soNguoi = nguoi.length;
  const soLa = coBanGhim(luatCua(String(ban.balance_version))) ?? 14;
  const seasonId = String(ban.season_id);

  let truoc = 0;
  for (const t of tang) {
    const hang = truoc + 1;
    const soCapThang = soNguoi - truoc - t.length;     // số người ở các tầng DƯỚI mình
    for (const userId of t) {
      const d = delta[userId]!;
      const { rows } = await client.query(
        `INSERT INTO rank_diem (user_id, season_id, diem, diem_dinh, so_tran, updated_at)
              VALUES ($1, $2, $3, GREATEST($3, 0), 1, now())
         ON CONFLICT (user_id, season_id) DO UPDATE
            SET diem = rank_diem.diem + $3,
                diem_dinh = GREATEST(rank_diem.diem_dinh, rank_diem.diem + $3),
                so_tran = rank_diem.so_tran + 1,
                updated_at = now()
         RETURNING diem, so_tran`,
        [userId, seasonId, d]);
      const diemSau = Number(rows[0]!.diem);
      const soTran = Number(rows[0]!.so_tran);
      await client.query(
        `INSERT INTO rank_ledger
           (user_id, season_id, che_do, match_id, ban_id, so_ghe, so_la, hang, so_cap_thang,
            bac_vao_ban, delta, diem_sau, formula_version)
         VALUES ($1,$2,'rank_slot',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [userId, seasonId, matchCua[userId], banId, Math.max(2, soNguoi), soLa, hang, soCapThang,
          bacId[userId], d, diemSau, RANK_FORMULA_VERSION]);
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type, value_num, value_json)
         VALUES ($1, 'holdem', $2, 'rank_diem_thay_doi', $3, $4)`,
        [userId, matchCua[userId] ?? banId, d, JSON.stringify({
          hang, so_ghe: soNguoi, so_cap_thang: soCapThang, bac_vao_ban: bacId[userId],
          bac_doi_thu: nguoi.filter((x) => String(x.user_id) !== userId).map((x) => String(x.bac_id)),
          diem_sau: diemSau, v: RANK_FORMULA_VERSION,
          // Bàn ghép có máy: điểm CHỈ tính cặp người–người (B3). Nhãn để phân tích tách được hai loại bàn.
          ban_ghep: true, so_may: Number(ban.so_may), vang: !kq.find((k) => k.userId === userId)!.xong,
        })]);
      const bacTruoc = bacTuDiem(diemSau - d, soTran - 1);
      const bacSauTran = bacTuDiem(diemSau, soTran);
      if (bacSauTran !== bacTruoc) {
        const len = (dinhNghiaBac(bacSauTran).bac || 0) > (dinhNghiaBac(bacTruoc).bac || 0);
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
           VALUES ($1, 'holdem', $2, $3, $4)`,
          [userId, matchCua[userId] ?? banId, len ? 'rank_len_bac' : 'rank_tut_bac',
            JSON.stringify({ tu: bacTruoc, den: bacSauTran, diem: diemSau })]);
      }
      if (matchCua[userId]) {
        await client.query(
          `UPDATE holdem_results SET diem_truoc = $1, diem_sau = $2 WHERE match_id = $3 AND ghe_id = 'ban'`,
          [diemSau - d, diemSau, matchCua[userId]]);
      }
    }
    truoc += t.length;
  }
  await client.query(
    `UPDATE rank_ban SET trang_thai = 'da_chot', ly_do_chot = $3, chot_luc = $2::timestamptz WHERE ban_id = $1`,
    [banId, now.toISOString(), quaHan && conDo.length > 0 ? 'het_han' : 'du_nguoi']);
  return 'da_ghi_diem';
}

/** Tick: chốt mọi bàn quá hạn hoặc đã không còn ai đang chơi. Mỗi bàn một transaction. */
export async function chotBanQuaHan(pool: pg.Pool, now: Date = new Date()): Promise<{ chot: number; khong_diem: number }> {
  const { rows } = await pool.query(
    `SELECT ban_id FROM rank_ban WHERE trang_thai = 'dang_choi' ORDER BY han_luc LIMIT 50`);
  let chot = 0;
  let khongDiem = 0;
  for (const r of rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const k = await chotBan(client, String(r.ban_id), now);
      await client.query('COMMIT');
      if (k === 'da_ghi_diem') chot += 1;
      if (k === 'it_nguoi_xong') khongDiem += 1;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
  return { chot, khong_diem: khongDiem };
}
