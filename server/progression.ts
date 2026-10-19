/**
 * GET /api/v1/me/progress — Oracle Level + Bậc dự báo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * KHÔNG LƯU GÌ. Mỗi request tính lại từ dữ liệu đã có:
 *   · `bets` ⋈ `markets`  → số kèo tham gia / đoán đúng
 *   · `holdem_results`     → số trận Đấu trường đã xong / về nhất
 *   · `rank_snapshots`     → Brier trung bình per-pool (bản mới nhất mỗi pool)
 *
 * Nên: không thêm bảng, không thêm faucet, không backfill, và đổi công thức là
 * đổi một số trong `config/progression.ts`. Xem docstring file đó.
 *
 * TƯỜNG LỬA: file này KHÔNG đọc/ghi `users.bankroll`, `quest_points`, không
 * chạm ledger, không sinh ra thứ gì tiêu được. Level và Bậc là NHÃN, hết.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import {
  LEVEL_FORMULA_VERSION, LEVEL_TOI_DA, NGUONG_XEP_BAC, XP,
  bacTuBrier, tienDoCap,
} from '../config/progression.js';
import { registerNhiemVuRoutes } from './nhiem_vu_api.js';
import { registerQuaBetaRoutes } from './qua_beta_api.js';

import type { Env, Mw as Middleware } from './http/types.js';

const POOLS = ['macro', 'life', 'event'] as const;

export function registerProgressionRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  requireAuth: Middleware,
  requireOnboarded: Middleware,
  /** Cổng chặn tài khoản khách — BẮT BUỘC cho mọi cửa chi Kho bạc (xem app.ts). */
  chanKhach: Middleware,
): void {
  /*
   * VIỆC TUẦN + LỘ TRÌNH MÙA 0.0 gắn ở đây, không thêm một lời gọi trong
   * `server/app.ts`: cùng chủ đề (tiến trình người chơi), và mọi route tiến
   * trình vào app qua ĐÚNG MỘT cửa nên không có đường nào "đã viết mà chưa nối".
   */
  registerNhiemVuRoutes(app, pool, requireAuth, requireOnboarded);
  /*
   * Quà tri ân mùa beta (D68b) vào cùng cửa này, cùng lý do: điều kiện nhận nó
   * ĐỌC TỪ tiến trình (4 việc lõi + 3 trận), nên nó thuộc chủ đề tiến trình chứ
   * không thuộc shop. Và một lời gọi ở `server/app.ts` là một chỗ nữa để quên.
   */
  registerQuaBetaRoutes(app, pool, requireAuth, requireOnboarded, chanKhach);

  app.get('/api/v1/me/progress', requireAuth, requireOnboarded, async (c) => {
    const userId = c.get('actor').userId!;

    /*
     * Ba truy vấn SONG SONG. Chúng độc lập nhau nên tuần tự chỉ cộng độ trễ:
     * màn Hub gọi endpoint này ngay khi mở, và Hub là màn đầu tiên người chơi
     * thấy — chậm ở đây là chậm ở ấn tượng đầu.
     */
    const [keo, tran, bac] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT b.market_id)::int AS tham_gia,
                COUNT(DISTINCT b.market_id) FILTER
                  (WHERE m.status = 'resolved'
                     AND b.option_id = m.outcome_option_id)::int AS dung
           FROM bets b
           JOIN markets m ON m.market_id = b.market_id
          WHERE b.user_id = $1 AND NOT b.is_seed`,
        [userId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS xong,
                COUNT(*) FILTER (WHERE hang = 1)::int AS nhat
           FROM holdem_results
          WHERE user_id = $1`,
        [userId],
      ),
      /*
       * `rank_snapshots` là bảng LỊCH SỬ (PK gồm computed_at), không phải bảng
       * trạng thái → phải lấy dòng MỚI NHẤT mỗi pool. DISTINCT ON là cách gọn
       * nhất trong Postgres; đọc "GROUP BY pool rồi MAX(computed_at)" rồi join
       * lại là hai lần quét cho cùng một việc.
       */
      pool.query(
        `SELECT DISTINCT ON (pool) pool, rank_value, markets_counted
           FROM rank_snapshots
          WHERE user_id = $1
          ORDER BY pool, computed_at DESC`,
        [userId],
      ),
    ]);

    const k = keo.rows[0] ?? { tham_gia: 0, dung: 0 };
    const t = tran.rows[0] ?? { xong: 0, nhat: 0 };

    const nguon = {
      keo_tham_gia: k.tham_gia * XP.KEO_THAM_GIA,
      keo_dung: k.dung * XP.KEO_DUNG,
      tran_xong: t.xong * XP.TRAN_XONG,
      tran_nhat: t.nhat * XP.TRAN_NHAT,
    };
    const xp = nguon.keo_tham_gia + nguon.keo_dung + nguon.tran_xong + nguon.tran_nhat;

    // Bậc theo TỪNG pool — A3.8 gốc đã đúng ở điểm này: Brier per-pool, không
    // gộp một con số chung. Pool khác nhau khó khác nhau, gộp lại là vô nghĩa.
    const theoPool = new Map(bac.rows.map((r) => [r.pool as string, r]));
    const bac_du_bao = POOLS.map((p) => {
      const r = theoPool.get(p);
      const brier = r ? Number(r.rank_value) : null;
      const soKeo = r ? Number(r.markets_counted) : 0;
      return {
        pool: p,
        bac: bacTuBrier(brier, soKeo),
        so_keo_da_tinh: soKeo,
        con_thieu: Math.max(0, NGUONG_XEP_BAC - soKeo),
      };
    });

    return c.json({
      ...tienDoCap(xp),
      xp,
      level_toi_da: LEVEL_TOI_DA,
      formula_version: LEVEL_FORMULA_VERSION,
      nguon,
      dem: {
        keo_tham_gia: k.tham_gia,
        keo_dung: k.dung,
        tran_xong: t.xong,
        tran_nhat: t.nhat,
      },
      bac_du_bao,
    });
  });
}
