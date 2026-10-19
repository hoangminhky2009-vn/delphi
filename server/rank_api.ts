/**
 * API XẾP HẠNG (/api/v1/me/rank · /api/v1/bxh/* · /api/v1/boards/forecast).
 *
 * L9/D11 — BẢNG XẾP HẠNG LÀ TRUY VẤN NẶNG MÀ AI CŨNG MỞ. Ba lớp, không lớp nào
 * aggregate lúc có request:
 *   LỚP 1  điểm cộng SẴN vào `rank_diem` trong đúng transaction kết trận.
 *   LỚP 2  snapshot dựng TRONG DB (`xay_bxh_dau_truong`) mỗi 10 phút — ở prod do
 *          pg_cron gọi nên tốn 0 request Vercel; ở local do /internal/tick gọi vì
 *          pg_cron không tồn tại ở DB dev (0005) và A8.9 cấm mock.
 *   LỚP 3  đọc = 1 SELECT theo khoá chính + `s-maxage` ở CDN + nút làm mới bị
 *          chặn 60s ở CẢ client lẫn server.
 *
 * Ngân sách (D11, phải xác minh lại lúc deploy): Vercel Hobby 1M invocation/tháng
 * = 32.900/ngày. Đọc bảng với cache đầy ở 4 PoP = 4 × 144 = 576 request/ngày =
 * 1,8% ngân sách. Không có polling ở bất kỳ endpoint nào dưới đây.
 *
 * ⚠ KHÔNG có endpoint nào trả điểm/hạng của MỘT user khác. Bảng xếp hạng là bề mặt
 *   duy nhất điểm được phép xuất hiện — mọi chỗ khác hiện BẬC (D25/R4).
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { BXH } from '../config/rank.js';
import { nguongVaoBangPct } from '../config/rank_dubao.js';
import { consumeLimit } from './auth/rate_limit.js';
import { currentSeasonId } from './season.js';
import { docBxhDauTruong, layTienDoRank, xayBxh } from './rank.js';
import { docBangDuBao, xayBangDoChinhXac, xayBangSoLuong } from './rank_bxh.js';

import type { Env, Mw as Middleware } from './http/types.js';

/**
 * Dựng lại cả ba bảng. Gọi từ /internal/tick (mỗi phút) nhưng CHỈ chạy khi
 * snapshot đã cũ hơn chu kỳ — tick mỗi phút mà dựng mỗi phút là 1.440 lần/ngày
 * cho một bảng gần như không đổi.
 */
export async function xayBxhTick(pool: pg.Pool, now: Date = new Date()): Promise<{
  da_xay: boolean; so_dong: number;
}> {
  const seasonId = currentSeasonId(now);
  /*
   * ⚠ KHOÁ TRƯỚC KHI HỎI — vá 03/08 (đợt kiểm 02/08 bắt được). Đây là
   * check-then-act kinh điển: đọc `computed_at` ngoài khoá rồi mới xây. Hai
   * tick trùng nhau (cron-job.org + UptimeRobot + một request người dùng) đều
   * thấy snapshot cũ, đều kết luận "đến hạn", rồi CẢ HAI cùng xây — ba lượt
   * quét toàn bảng chồng nhau trên một free tier, đúng lúc nhiều người online
   * nhất. Cùng LỚP lỗi với đua ghi `/rounds` của D55, chỉ khác là nó phí tài
   * nguyên chứ không sai số.
   *
   * `pg_advisory_xact_lock` chứ không phải khoá hàng: chưa chắc đã có hàng nào
   * để khoá (lần xây đầu mùa), mà thứ cần giữ độc quyền là VIỆC XÂY chứ không
   * phải một dòng dữ liệu. `try_` để tick đến sau ĐI TIẾP thay vì xếp hàng —
   * xây xong rồi thì nó cũng chẳng còn gì để làm.
   */
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const khoa = await client.query(
      'SELECT pg_try_advisory_xact_lock(hashtext($1)) AS co', [`bxh:${seasonId}`]);
    if (khoa.rows[0]?.co !== true) {
      await client.query('ROLLBACK');
      return { da_xay: false, so_dong: 0 };
    }
    const { rows } = await client.query(
      `SELECT computed_at FROM bxh_snapshots
        WHERE bang_id = 'dau_truong' AND season_id = $1`,
      [seasonId],
    );
    const cu = rows[0]?.computed_at ? new Date(rows[0].computed_at).getTime() : 0;
    if (now.getTime() - cu < BXH.CHU_KY_SNAPSHOT_PHUT * 60_000) {
      await client.query('ROLLBACK');
      return { da_xay: false, so_dong: 0 };
    }
    await client.query('COMMIT'); // nhả khoá TRƯỚC khi xây — xem ghi chú dưới
    /*
     * Khoá chỉ bao phần QUYẾT ĐỊNH, không bao phần XÂY. Giữ khoá suốt lúc xây
     * là giữ một kết nối bận trong cả chu kỳ trên pool 5 kết nối của free tier
     * (C1) — chữa một chỗ nghẽn bằng cách đẻ một chỗ nghẽn to hơn. Cửa sổ đua
     * còn lại chỉ là mấy mili-giây giữa COMMIT và dòng dưới, và hậu quả xấu
     * nhất của nó vẫn chỉ là xây thừa một lần, thứ vốn vô hại về dữ liệu.
     */
  } finally {
    client.release();
  }
  const soDong = await xayBxh(pool, seasonId);
  await xayBangSoLuong(pool, seasonId);
  await xayBangDoChinhXac(pool, nguongVaoBangPct());
  return { da_xay: true, so_dong: soDong };
}

export function registerRankRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  deps: { requireAuth: Middleware; requireOnboarded: Middleware },
): void {
  /**
   * Tiến độ xếp hạng của CHÍNH CHỦ — điểm, bậc, nấc, hạng, phân vị.
   *
   * Endpoint RIÊNG chứ không ghép vào `/me/progress` có chủ đích: `/me/progress`
   * là đường nóng (Hub gọi ngay khi mở app), còn màn Hồ sơ là đường lạnh. Ghép
   * vào đường nóng thì mọi lần mở Hub phải trả thêm hai lookup mà đa số không
   * xem tới. Đánh đổi đã khai: mở Hồ sơ tốn +1 request.
   */
  app.get('/api/v1/me/rank', deps.requireAuth, deps.requireOnboarded, async (c) => {
    const userId = c.get('actor').userId!;
    const seasonId = currentSeasonId();
    const tienDo = await layTienDoRank(pool, userId, seasonId);
    return c.json({ ...tienDo, bang_bat: BXH.BAT });
  });

  /**
   * Bảng Đấu trường — 1 SELECT theo khoá chính. `stale-while-revalidate` để lần
   * miss cache không dội thẳng vào function.
   *
   * ⚠ `BXH.BAT = false` ở beta: bảng hiện HANDLE cho người lạ, nên nó bị khoá tới
   *   khi rà xong handle prod theo blocklist D25/R2 (fail-closed — trả 200 với cờ
   *   tắt chứ không 404, để client biết phân biệt "chưa bật" với "lỗi").
   */
  app.get('/api/v1/bxh/dau-truong', deps.requireAuth, async (c) => {
    if (!BXH.BAT) {
      return c.json({
        bat: false,
        ly_do: 'Bảng xếp hạng mở sau khi rà soát tên người chơi.',
        dong: [], tong_xep_bac: 0, computed_at: null,
      });
    }
    const seasonId = String(c.req.query('mua') ?? currentSeasonId());
    const bang = await docBxhDauTruong(pool, seasonId);
    c.header('Cache-Control',
      `private, max-age=${BXH.S_MAXAGE_GIAY}`);
    return c.json({ bat: true, mua: seasonId, ...bang, so_dong_co_icon: BXH.SO_DONG_CO_ICON });
  });

  /**
   * Làm mới bằng tay — chặn 60s/người ở SERVER, không chỉ ở client.
   * Chặn ở client là chặn người tử tế; F12 mở ra là hết tác dụng.
   */
  app.post('/api/v1/bxh/lam-moi', deps.requireAuth, async (c) => {
    const userId = c.get('actor').userId!;
    const r = await consumeLimit(pool, `bxh:${userId}`, 1, 1);
    if (!r.allowed) {
      return c.json({ ok: false, message: 'Bảng vừa được làm mới. Thử lại sau một phút.' }, 429);
    }
    const kq = await xayBxhTick(pool);
    return c.json({ ok: true, ...kq });
  });

  /**
   * Hai bảng Hệ B cho HỒ SƠ. `private` vì response chứa vị trí của chính chủ.
   */
  app.get('/api/v1/boards/forecast', deps.requireAuth, deps.requireOnboarded, async (c) => {
    const userId = c.get('actor').userId!;
    const seasonId = currentSeasonId();
    const [soLuong, doChinhXac] = await Promise.all([
      docBangDuBao(pool, 'du_bao_so_lan', seasonId, userId),
      docBangDuBao(pool, 'du_bao_do_chinh_xac', '-', userId),
    ]);
    c.header('Cache-Control', 'private, max-age=60');
    return c.json({ mua: seasonId, so_luong: soLuong, do_chinh_xac: doChinhXac });
  });
}
