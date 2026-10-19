/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KHO HÀNH VI — dựng / cập nhật / đọc `hanh_vi_vong` + `hanh_vi_tieu_dung` (D106)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tầng CHUNG CHUYỂN giữa `events` (thô, append-only) và mọi phép phân tích.
 * Luật của tầng: PHÁI SINH — dựng lại được 100% từ events; không phải sự thật.
 *
 * ─── ĐỌC THÌ TỰ LÀM TƯƠI ─────────────────────────────────────────────────────
 * `capNhatCuaUser` chỉ dựng lại những trận CÓ EVENT MỚI hơn lần dựng trước (so
 * `max(events.ts)` với `cap_nhat_luc`). Nhờ vậy `/me/tinh-cach` không phụ thuộc
 * tick (mùa này tick chạy qua cron-job.org — phụ thuộc nó là đẻ thêm một lý do
 * để hồ sơ trống), còn tick chỉ là người quét nền cho bảng admin.
 *
 * ─── REPLAY ĐƯỢC TIÊM, KHÔNG IMPORT ──────────────────────────────────────────
 * Khẩu vị (tiền mặt/NAV, số mã) cần `replay` của holdem_api. Import thẳng là
 * vòng tròn (holdem_api → kho → holdem_api). Caller đưa hàm vào qua `Deps` —
 * và test vector thuần tiêm một hàm giả.
 */
import type pg from 'pg';
import {
  HOLDEM_DECISIONS, QUAN_TINH, laSeedManTap, luatCua,
} from '../../config/holdem.js';
import { sinhMap } from '../holdem/map.js';
import { tuyChonSinhMap } from '../holdem/engine.js';
import { dungHoSo, type HoSoTinhCach, type VongInsight } from '../holdem/insight.js';
import { chiaGoi, type HoSoGoi } from './goi.js';

export type { HoSoGoi } from './goi.js';
import {
  EVENT_TRAI_TRAN, HANH_VI_FORMULA_VERSION, LOAI_TIEU_DUNG, traiTran, traiTieuDung,
  type EventTho, type KhauViVong, type MocTran,
} from './trai.js';

type Db = pg.Pool | pg.PoolClient;

export interface Deps {
  /**
   * Khẩu vị theo vòng của ghế người chơi, từ replay tất định (seed + log).
   * Trận không NAV ⇒ mảng rỗng.
   */
  khauViCuaTran: (row: HangTran) => KhauViVong[];
}

/** Hàng `holdem_matches` tối thiểu cho việc dựng. */
export interface HangTran {
  match_id: string;
  owner_user_id: string;
  seed: number;
  action_log: unknown;
  ghe_json: unknown;
  balance_version: string | null;
  so_o: number | null;
  status: string;
}

/*
 * ⚠ D388 — danh sách event nạp cho `traiTran` KHÔNG sống ở đây nữa: bản chép tay cũ
 * (`EVENT_TRAN`) thiếu `hd_tiet_kiem` suốt từ D317, nên `tk_huy_so` luôn 0 trên đường DB.
 * Nguồn duy nhất là `EVENT_TRAI_TRAN`, khai ngay cạnh hàm đọc nó (trai.ts).
 */

/* ══════════════════════════════════════════════════════════════════════════
 * DỰNG MỘT TRẬN
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Dựng lại TOÀN BỘ dòng của một trận. Idempotent: gọi hai lần ra y một bảng.
 * Trận không NAV ⇒ 0 dòng (hồ sơ tính cách chưa bao giờ đọc trận không NAV).
 *
 * ⚠⚠ D396 — TÍNH XONG RỒI MỚI XOÁ, và xoá + chèn + dấu là MỘT transaction.
 * Bản trước xoá dòng cũ TRƯỚC, rồi mới replay — mà replay NỔ được (7 trận v53 trên prod: *"Vòng 12
 * vượt quá map 12 ô"*). Nổ giữa chừng ⇒ dòng cũ mất, dấu `hanh_vi_tran` vẫn tươi nên không ai dựng
 * lại: mất im lặng. Chú thích cũ ở đây còn hứa *"với pool thì tự mở transaction"* — code không làm.
 * Nay: mọi phép tính (đọc event, sinh map, replay, trải dòng) chạy TRƯỚC khi chạm bảng; nổ thì bảng
 * nguyên như cũ. Caller đưa client ⇒ caller giữ transaction; đưa pool ⇒ tự mở (prod `max: 1`, nên
 * trong transaction KHÔNG được gọi `pool.query` — mọi câu đi qua `c`).
 */
export async function dungHanhViTran(db: Db, matchId: string, deps: Deps): Promise<number> {
  const t = await db.query(
    `SELECT m.match_id, m.owner_user_id, m.seed, m.action_log, m.ghe_json,
            m.balance_version, m.so_o, m.status,
            u.la_khach,
            EXISTS (SELECT 1 FROM holdem_results r
                     WHERE r.match_id = m.match_id AND r.user_id = m.owner_user_id) AS tran_xong
       FROM holdem_matches m JOIN users u ON u.user_id = m.owner_user_id
      WHERE m.match_id = $1`,
    [matchId]);
  if (t.rowCount === 0) return 0;
  const row = t.rows[0]!;
  const luat = luatCua(row.balance_version as string | null);
  const hang: HangTran = {
    match_id: String(row.match_id),
    owner_user_id: String(row.owner_user_id),
    seed: Number(row.seed),
    action_log: row.action_log,
    ghe_json: row.ghe_json,
    balance_version: (row.balance_version ?? null) as string | null,
    so_o: row.so_o === null || row.so_o === undefined ? null : Number(row.so_o),
    status: String(row.status),
  };

  if (!luat.nav) {
    return trongGiaoDich(db, async (c) => {
      await c.query(`DELETE FROM hanh_vi_vong WHERE match_id = $1`, [matchId]);
      await danDau(c, matchId, 0);
      return 0;
    });
  }

  const ev = await db.query(
    `SELECT event_id, ts, action_type, value_num::float AS num, value_json
       FROM events
      WHERE user_id = $1 AND context_type = 'holdem' AND context_id = $2
        AND action_type = ANY($3::text[])
      ORDER BY ts ASC, event_id ASC`,
    [hang.owner_user_id, matchId, EVENT_TRAI_TRAN]);
  const soO = hang.so_o ?? HOLDEM_DECISIONS.MAP_SIZE;
  /*
   * ⚠ MỘT CỬA `tuyChonSinhMap` (D169) — bản chép tay ở đây đã TRÔI: nó dừng ở
   * v32 nên map dựng lại cho kho hành vi là map của một trò khác trò đã chạy.
   */
  const map = sinhMap(hang.seed, soO, tuyChonSinhMap(luat));
  const dong = traiTran(matchId, map, ev.rows as EventTho[], deps.khauViCuaTran(hang), {
    tran_xong: row.tran_xong === true,
    man_tap: laSeedManTap(Number(hang.seed)),
    la_khach: row.la_khach === true,
    // D169 — ngưỡng "chuỗi đã xác nhận" phải theo MÁY của trận đó: máy tick
    // coi nền sống ngay ô đầu, máy rút cũ đòi 2 ô. Đây là ĐỊNH NGHĨA của
    // thước tính cách #2 nên nó phải khớp thứ người chơi thấy (`xu_huong`).
    nguong_chuoi: luat.regimeTick ? 1 : QUAN_TINH.NGUONG_CHUOI,
    // D178 — hai khoá cắt lớp data. `vai` lấy từ GHẾ CỦA CHỦ TRẬN trong sơ đồ
    // đã lưu (`ghe_json`), không suy lại: vai bốc theo seed nhưng sơ đồ mới là
    // thứ trận đó THẬT SỰ chạy.
    so_o: soO,
    vai: vaiChuTran(hang),
    chan_lo_trait: luat.chanLoTrait === true,
  });
  return trongGiaoDich(db, async (c) => {
    await c.query(`DELETE FROM hanh_vi_vong WHERE match_id = $1`, [matchId]);
    for (const d of dong) {
      await c.query(
        `INSERT INTO hanh_vi_vong (user_id, match_id, vong, ts, lenh_json, pnl_bp, brier,
           brier_v, mo_bang, o_su_kien, la_tin_gia, chuoi_tang, tu_dong, cho_bp,
           tien_mat_bp, so_ma, tran_xong, man_tap, la_khach, nghi_may, formula_version,
           so_o, vai, thay_o_do, tiet_kiem_bp, tk_huy_so, so_nhom, ms_quyet,
           lua_nac, lua_dap, xu, trait_json, nguon_tin_rieng, co_che_cat_lo, cap_nhat_luc)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
           $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34, now())`,
        [hang.owner_user_id, matchId, d.vong, d.ts, JSON.stringify(d.lenh),
          d.pnl_bp === null ? null : Math.round(d.pnl_bp), d.brier, d.brier_v, d.mo_bang,
          d.o_su_kien, d.la_tin_gia, d.chuoi_tang, d.tu_dong, d.cho_bp, d.tien_mat_bp,
          d.so_ma, d.tran_xong, d.man_tap, d.la_khach, d.nghi_may, HANH_VI_FORMULA_VERSION,
          d.so_o ?? null, d.vai ?? null, d.thay_o_do ?? null,
          // ⚠ D317 — `?? null` là ĐÚNG ở đây và `?? 0` là SAI: xem 0063_*.sql.
          d.tiet_kiem_bp ?? null, d.tk_huy_so ?? null,
          // D323 — cùng nếp: `?? null`, không `?? 0` (xem 0064_*.sql).
          d.so_nhom ?? null,
          // D327 — cùng nếp: vòng không đo được là `null`, không phải 0 ms (xem 0065_*.sql).
          d.ms_quyet ?? null,
          // v55 (D409, 0071_*.sql) — sáu cột lửa · xu · trait · nguồn tin riêng · cơ chế cắt lỗ; cùng nếp `?? null`.
          d.lua_nac ?? null, d.lua_dap ?? null, d.xu ?? null,
          d.trait_json === null || d.trait_json === undefined ? null : JSON.stringify(d.trait_json),
          d.nguon_tin_rieng ?? null, d.co_che_cat_lo ?? null]);
    }
    await danDau(c, matchId, dong.length);
    return dong.length;
  });
}

/**
 * D396 — chạy `lam` trong MỘT transaction. Caller đưa client ⇒ caller đang giữ transaction của nó,
 * chạy thẳng (không BEGIN lồng). Đưa pool ⇒ mượn một client, BEGIN/COMMIT, nổ thì ROLLBACK.
 */
async function trongGiaoDich<T>(db: Db, lam: (c: Db) => Promise<T>): Promise<T> {
  if ('release' in db) return lam(db);
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    const kq = await lam(c);
    await c.query('COMMIT');
    return kq;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

/**
 * VAI của GHẾ CHỦ TRẬN, đọc từ sơ đồ ĐÃ LƯU (`ghe_json`) — không suy lại từ seed.
 *
 * ⚠ Vai bốc theo seed (D107) nên suy lại thường ra đúng, nhưng "thường đúng" là
 * đúng thứ không được phép ở tầng ĐO: sơ đồ đã lưu là thứ trận đó THẬT SỰ chạy,
 * và nếu luật bốc vai đổi ở phiên bản sau thì bản suy-lại sẽ dán nhãn sai cho
 * mọi trận cũ — im lặng (đúng lớp bug D169 vừa vá).
 */
function vaiChuTran(hang: { ghe_json?: unknown; owner_user_id?: unknown }): string | null {
  const ds = hang.ghe_json;
  if (!Array.isArray(ds)) return null;
  const ghe = ds.find((g) => (g as { id?: unknown })?.id === hang.owner_user_id)
    ?? ds[0];
  const vai = (ghe as { vai?: unknown } | undefined)?.vai;
  return typeof vai === 'string' ? vai : null;
}

/** Dấu "đã dựng" — kể cả 0 dòng, để cập nhật tăng dần không quét lại mãi. */
async function danDau(db: Db, matchId: string, soDong: number): Promise<void> {
  await db.query(
    `INSERT INTO hanh_vi_tran (match_id, so_dong, formula_version, cap_nhat_luc)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (match_id) DO UPDATE
       SET so_dong = EXCLUDED.so_dong, formula_version = EXCLUDED.formula_version,
           cap_nhat_luc = now()`,
    [matchId, soDong, HANH_VI_FORMULA_VERSION]);
}

/* ══════════════════════════════════════════════════════════════════════════
 * CẬP NHẬT TĂNG DẦN
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Trận của user có event mới hơn lần dựng gần nhất (hoặc chưa dựng bao giờ).
 * D329 — `matchIds` lọc thêm theo danh sách trận (trang nhóm buổi đo): CÙNG một điều kiện "cũ", không
 * chép câu SQL này ra chỗ thứ hai (A11.5).
 */
async function tranCanDung(
  db: Db, userId: string | null, tran: number, matchIds: readonly string[] | null = null,
): Promise<string[]> {
  const r = await db.query(
    `SELECT m.match_id
       FROM holdem_matches m
      WHERE ($1::uuid IS NULL OR m.owner_user_id = $1)
        AND ($4::uuid[] IS NULL OR m.match_id = ANY($4::uuid[]))
        AND GREATEST(
              COALESCE((SELECT max(e.ts) FROM events e
                         WHERE e.context_type = 'holdem' AND e.context_id = m.match_id::text
                           AND e.user_id = m.owner_user_id), m.started_at),
              COALESCE(m.ended_at, m.started_at))
            > COALESCE((SELECT d.cap_nhat_luc FROM hanh_vi_tran d
                         WHERE d.match_id = m.match_id
                           AND d.formula_version = $3), '-infinity'::timestamptz)
      ORDER BY m.started_at ASC
      LIMIT $2`,
    [userId, tran, HANH_VI_FORMULA_VERSION, matchIds]);
  return r.rows.map((x) => String(x.match_id));
}

/**
 * D329 — dựng những trận TRONG DANH SÁCH mà dấu đã cũ. Trang nhóm buổi đo đọc trận của NHIỀU người, mà
 * `capNhatCuaUser` đi theo từng người (kèm cả dòng tiêu dùng) — gọi nó cho mỗi người là làm thừa; gọi
 * `dungHanhViTran` cho mọi trận mỗi lần đọc là dựng lại cả bàn dù không có gì mới.
 */
export async function dungTranCu(db: Db, matchIds: readonly string[], deps: Deps): Promise<number> {
  if (matchIds.length === 0) return 0;
  return (await dungLaiNhieuTran(db, await tranCanDung(db, null, matchIds.length, matchIds), deps)).dong;
}

/** Kết quả dựng lại nhiều trận: số dòng đã ghi + những trận KHÔNG dựng được (bảng của chúng giữ nguyên). */
export interface KetQuaDungNhieu {
  dong: number;
  hong: { match_id: string; loi: string }[];
}

/**
 * D396 — MỘT TRẬN HỎNG KHÔNG ĐƯỢC KÉO CẢ LƯỢT ĐỔ THEO. Mọi vòng lặp dựng lại (tick · trang nhóm · làm tươi
 * theo người · script) đi qua đây.
 *
 * ⚠ Vì sao phải có: `tranCanDung` xếp trận CŨ NHẤT lên đầu. Một trận replay nổ (7 trận v53 trên prod) mà
 * thành "cần dựng" — chỉ cần ai đó tăng `HANH_VI_FORMULA_VERSION` — thì MỌI lượt tick nổ đúng ở trận ấy và
 * không trận nào xếp sau nó được dựng nữa, kể cả trận buổi đo. Nay trận hỏng bị bỏ qua, ghi một dòng log,
 * còn bảng của nó nguyên vẹn (`dungHanhViTran` tính xong mới xoá).
 */
export async function dungLaiNhieuTran(
  db: Db, ids: readonly string[], deps: Deps,
): Promise<KetQuaDungNhieu> {
  const kq: KetQuaDungNhieu = { dong: 0, hong: [] };
  for (const id of ids) {
    try {
      kq.dong += await dungHanhViTran(db, id, deps);
    } catch (e) {
      const loi = e instanceof Error ? e.message : String(e);
      kq.hong.push({ match_id: id, loi });
      console.error(`[hanh_vi] bỏ qua trận ${id.slice(0, 8)} — không dựng được: ${loi}`);
    }
  }
  return kq;
}

/**
 * Dấu `hanh_vi_tran` mang cả `formula_version` ⇒ tăng version là MỌI trận tự
 * thành "cần dựng" ở lần đọc sau, không cần script chạy tay (script vẫn có để
 * dựng lại đồng loạt).
 */
export async function capNhatCuaUser(
  db: Db, userId: string, deps: Deps, tran = 80,
): Promise<{ tran: number; dong: number }> {
  const ids = await tranCanDung(db, userId, tran);
  const { dong } = await dungLaiNhieuTran(db, ids, deps);
  await capNhatTieuDungCuaUser(db, userId);
  return { tran: ids.length, dong };
}

/** Quét nền (tick): mọi user, mỗi lượt tối đa `tran` trận để không vượt ngân sách serverless. */
export async function capNhatNen(
  db: Db, deps: Deps, tran = 40,
): Promise<{ tran: number; dong: number; hong: number }> {
  const ids = await tranCanDung(db, null, tran);
  const { dong, hong } = await dungLaiNhieuTran(db, ids, deps);
  // `hong` ra thẳng thân phản hồi của tick: số > 0 kéo dài nhiều lượt là có trận hỏng nằm lì đầu hàng đợi.
  return { tran: ids.length, dong, hong: hong.length };
}

/* ══════════════════════════════════════════════════════════════════════════
 * TIÊU DÙNG NGOÀI TRẬN
 * ══════════════════════════════════════════════════════════════════════════ */

/*
 * D388 — suy từ bảng mà `traiTieuDung` tra (`LOAI_TIEU_DUNG`), không chép tay: cùng họ
 * với lỗi `hd_tiet_kiem` ở trên (danh sách nạp sống xa hàm đọc thì sẽ trôi khỏi nó).
 * Hôm nay hai bên đang khớp đúng tám loại — đổi cách viết, không đổi tập nào.
 */
const EVENT_TIEU_DUNG = Object.keys(LOAI_TIEU_DUNG);

/**
 * Dựng lại toàn bộ dòng tiêu dùng của một user (rẻ: vài chục dòng/người mùa này).
 * Số dư TRƯỚC mỗi cú chi đọc từ `wallet_ledger` (bút toán gần nhất trước ts).
 */
export async function capNhatTieuDungCuaUser(db: Db, userId: string): Promise<number> {
  const ev = await db.query(
    `SELECT event_id, ts, action_type, value_num::float AS num, value_json
       FROM events WHERE user_id = $1 AND action_type = ANY($2::text[])
      ORDER BY ts ASC, event_id ASC`,
    [userId, EVENT_TIEU_DUNG]);
  if (ev.rowCount === 0) {
    await db.query(`DELETE FROM hanh_vi_tieu_dung WHERE user_id = $1`, [userId]);
    return 0;
  }
  const tran = await db.query(
    `SELECT r.hang, m.ended_at FROM holdem_results r
       JOIN holdem_matches m ON m.match_id = r.match_id
      WHERE r.user_id = $1 AND m.ended_at IS NOT NULL ORDER BY m.ended_at ASC`,
    [userId]);
  const mocTran: MocTran[] = tran.rows.map((r) => ({
    ts: new Date(r.ended_at), thang: Number(r.hang) === 1,
  }));
  const troCap = await db.query(
    `SELECT created_at FROM wallet_ledger WHERE user_id = $1 AND reason = 'subsidy'
      ORDER BY created_at ASC`,
    [userId]);
  const mocTroCap = troCap.rows.map((r) => new Date(r.created_at));
  const so = await db.query(
    `SELECT created_at, balance_after, delta FROM wallet_ledger WHERE user_id = $1
      ORDER BY created_at ASC, entry_id ASC`,
    [userId]);
  const ledger = so.rows.map((r) => ({
    ts: new Date(r.created_at).getTime(),
    truoc: Number(r.balance_after) - Number(r.delta),
    sau: Number(r.balance_after),
  }));
  // Số dư ngay TRƯỚC ts: bút toán cuối có ts < ts ⇒ `sau`; không có ⇒ null.
  // Bút toán cùng ts với event (cùng transaction) là bút toán CỦA cú chi ⇒ lấy `truoc`.
  const soDuTruoc = (ts: Date): number | null => {
    const t = ts.getTime();
    let kq: number | null = null;
    for (const l of ledger) {
      if (l.ts < t) kq = l.sau;
      else if (l.ts === t) { kq = l.truoc; break; }
      else break;
    }
    return kq;
  };
  const dong = traiTieuDung(ev.rows as EventTho[], mocTran, mocTroCap, soDuTruoc);
  await db.query(`DELETE FROM hanh_vi_tieu_dung WHERE user_id = $1`, [userId]);
  for (const d of dong) {
    await db.query(
      `INSERT INTO hanh_vi_tieu_dung (user_id, event_id, ts, loai, action_type, so_tien,
         don_vi, so_du_truoc, phut_sau_tran, tran_truoc_thang, phut_sau_tro_cap,
         formula_version, cap_nhat_luc)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())`,
      [userId, d.event_id, d.ts, d.loai, d.action_type, d.so_tien, d.don_vi,
        d.so_du_truoc, d.phut_sau_tran, d.tran_truoc_thang, d.phut_sau_tro_cap,
        HANH_VI_FORMULA_VERSION]);
  }
  return dong.length;
}

/* ══════════════════════════════════════════════════════════════════════════
 * ĐỌC
 * ══════════════════════════════════════════════════════════════════════════ */

/** Một dòng đọc từ `hanh_vi_vong`, đã về kiểu. */
export interface HangHanhVi extends VongInsight {
  vong: number;
  /** D436 — trait đang mang SAU vòng (0071); null = luật chưa có trait. Thẻ LỌC TIN đọc nó để tách trận v55. */
  trait_json?: string[] | null;
  ts: Date;
  brier_v: number | null;
  cho_bp: number | null;
  tien_mat_bp: number | null;
  so_ma: number | null;
  /** D317 — tỷ trọng NAV khoá trong sổ (bp). `null` = luật trận chưa có ngân hàng. */
  tiet_kiem_bp: number | null;
  /** D317 — số hợp đồng huỷ trước hạn vòng này. `null` = chưa có cơ chế · `0` = có cửa mà không huỷ. */
  tk_huy_so: number | null;
  /** D323 — số NHÓM tài sản khác nhau đang giữ sau chốt vòng. `null` = không có chain để đếm. */
  so_nhom: number | null;
  /** D327 — ms từ mở vòng tới nộp. `null` = không đo được (trận cũ · `tu_dong`). */
  ms_quyet: number | null;
  tran_xong: boolean;
  man_tap: boolean;
  la_khach: boolean;
  nghi_may: boolean;
}

/**
 * Dòng của một danh sách trận, theo thời gian TĂNG (started_at rồi vòng).
 * Không lọc cờ nào ở đây — người đọc gộp tự quyết (cờ là nhãn, §1.1 doc).
 */
export async function docVongCuaTran(db: Db, matchIds: readonly string[]): Promise<HangHanhVi[]> {
  if (matchIds.length === 0) return [];
  const r = await db.query(
    `SELECT h.*, m.started_at FROM hanh_vi_vong h
       JOIN holdem_matches m ON m.match_id = h.match_id
      WHERE h.match_id = ANY($1::uuid[])
      ORDER BY m.started_at ASC, h.vong ASC`,
    [matchIds]);
  return r.rows.map((h) => ({
    match_id: String(h.match_id),
    vong: Number(h.vong),
    ts: new Date(h.ts),
    lenh: (h.lenh_json ?? []) as VongInsight['lenh'],
    pnl_bp: h.pnl_bp === null ? null : Number(h.pnl_bp),
    brier: h.brier === null ? null : Number(h.brier),
    brier_v: h.brier_v === null || h.brier_v === undefined ? null : Number(h.brier_v),
    mo_bang: h.mo_bang === true,
    o_su_kien: h.o_su_kien === true,
    la_tin_gia: h.la_tin_gia === true,
    chuoi_tang: h.chuoi_tang === true,
    tu_dong: h.tu_dong === true,
    cho_bp: h.cho_bp === null ? null : Number(h.cho_bp),
    tien_mat_bp: h.tien_mat_bp === null ? null : Number(h.tien_mat_bp),
    so_ma: h.so_ma === null ? null : Number(h.so_ma),
    // ⚠ `== null` bắt CẢ `undefined` — cột mới, dòng cũ đọc ra là undefined.
    tiet_kiem_bp: h.tiet_kiem_bp == null ? null : Number(h.tiet_kiem_bp),
    tk_huy_so: h.tk_huy_so == null ? null : Number(h.tk_huy_so),
    // D323 — cột mới (0064): `== null` bắt cả `undefined` của dòng dựng trước formula v2.
    so_nhom: h.so_nhom == null ? null : Number(h.so_nhom),
    // D327 — cột mới (0065): `== null` bắt cả `undefined` của dòng dựng trước formula v3.
    ms_quyet: h.ms_quyet == null ? null : Number(h.ms_quyet),
    tran_xong: h.tran_xong === true,
    man_tap: h.man_tap === true,
    la_khach: h.la_khach === true,
    nghi_may: h.nghi_may === true,
    // D436 — `== null` bắt cả `undefined` của dòng dựng trước 0071.
    trait_json: h.trait_json == null ? null : (h.trait_json as string[]),
  }));
}

/** Mọi dòng của một user, theo thời gian tăng. */
export async function docVongCuaUser(db: Db, userId: string): Promise<HangHanhVi[]> {
  const r = await db.query(
    `SELECT match_id FROM holdem_matches WHERE owner_user_id = $1 ORDER BY started_at ASC`,
    [userId]);
  return docVongCuaTran(db, r.rows.map((x) => String(x.match_id)));
}

/* ══════════════════════════════════════════════════════════════════════════
 * HỒ SƠ THEO GÓI
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Hồ sơ = GÓI ĐẦY GẦN NHẤT. Chưa gói nào đầy ⇒ 🐣 với chỉ số rỗng + tiến độ —
 * đúng "phân tích chỉ bật khi có đủ pack data". Gói đầy mới được lưu ảnh chụp
 * (ON CONFLICT DO NOTHING — ảnh chụp là thứ ĐÃ THẤY, không ghi đè).
 * `brier_chuoi` (đường độ chuẩn theo thời gian) lấy trên MỌI vòng hợp lệ: đó là
 * kỹ năng đang lên/xuống, không phải phân tích tính cách, nên không chờ gói.
 */
export async function hoSoTheoGoi(db: Db, userId: string, deps: Deps): Promise<HoSoGoi> {
  await capNhatCuaUser(db, userId, deps);
  /*
   * ⚠ BRIER CHỈ LẤY THƯỚC v2 (D103): thước v1 (trước 17/08) chấm bằng bảng riêng
   * ghế, 63,4% vòng đổi "mã thắng" — trộn vào gói là trộn hai đại lượng. Dòng
   * v1 coi như KHÔNG có Brier (null = không dự báo được đo, không phải 0).
   * Đảo lại nếu founder quyết dùng tiếp thước cũ kèm ghi chú (D103 chờ founder).
   */
  const vongs = (await docVongCuaUser(db, userId))
    .map((v) => (v.brier !== null && v.brier_v !== 2 ? { ...v, brier: null } : v));
  const { day, dangMo, vongDangMo } = chiaGoi(vongs);
  for (const g of day) {
    await db.query(
      `INSERT INTO ho_so_goi (user_id, goi_so, formula_version, tran_dau, tran_cuoi, n_tran,
         n_vong_quyet, chi_so_json, tinh_cach)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, goi_so, formula_version) DO NOTHING`,
      [userId, g.goi_so, HANH_VI_FORMULA_VERSION, g.tran_ids[0], g.tran_ids[g.tran_ids.length - 1],
        g.tran_ids.length, g.tien_do.vong_quyet, JSON.stringify(g.ho_so.chi_so), g.ho_so.tinh_cach]);
  }
  const ls = await db.query(
    `SELECT goi_so, tinh_cach, n_tran, computed_at FROM ho_so_goi
      WHERE user_id = $1 AND formula_version = $2 ORDER BY goi_so ASC`,
    [userId, HANH_VI_FORMULA_VERSION]);
  const brierChuoi = vongs.filter((v) => v.tran_xong && !v.man_tap && !v.nghi_may)
    .map((v) => v.brier).filter((b): b is number => b !== null).slice(-48);
  const cuoi = day[day.length - 1];
  const loi: HoSoTinhCach = cuoi
    ? { ...cuoi.ho_so, brier_chuoi: brierChuoi }
    : { ...dungHoSo([], 0), brier_chuoi: brierChuoi, n_vong: dangMo.vong_quyet, n_tran: dangMo.tran };
  void vongDangMo;
  return {
    ...loi,
    goi: cuoi ? { so: cuoi.goi_so, tong: day.length } : null,
    tien_do: dangMo,
    lich_su: ls.rows.map((r) => ({
      goi_so: Number(r.goi_so), tinh_cach: String(r.tinh_cach), n_tran: Number(r.n_tran),
      computed_at: new Date(r.computed_at).toISOString(),
    })),
  };
}
