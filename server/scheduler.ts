/**
 * GĐ4 VIỆC 2 — Scheduler nghiệp vụ, chạy mỗi phút qua /internal/tick (lớp 2 D11).
 * Lớp 1 (pg_cron trong DB, prod) chạy CÙNG câu UPDATE khóa kèo — deadline-critical
 * sống độc lập mọi dịch vụ ngoài; hai lớp giẫm nhau vô hại vì mọi bước idempotent.
 *
 * Chống 2 instance song song ("advisory lock hoặc tương đương" — spec GĐ4):
 *   * Khóa kèo = MỘT câu UPDATE nguyên tử — chạy trùng lần 2 khớp 0 dòng.
 *   * Tự hủy = cancelMarket khóa dòng kèo FOR UPDATE + kiểm status trong tx —
 *     instance thứ hai nhận LifecycleError và bỏ qua.
 */
import type pg from 'pg';
import { ECONOMY } from '../config/economy.js';
import { cancelMarket, LifecycleError } from './resolve.js';
import { moKeo } from './admin.js';

export interface SchedulerReport {
  /** Số kèo vừa chuyển open → locked (đúng giờ ±60s theo nhịp cron). */
  locked: number;
  /** Kèo tự hủy vì nguồn không công bố trong 7 ngày sau hạn (A3.2). */
  cancelled: string[];
  /** Kèo tự MỞ theo lịch đã hẹn (bước 4). */
  opened: string[];
}

export async function runSchedulerPass(pool: pg.Pool): Promise<SchedulerReport> {
  /*
   * (0) TỰ MỞ KÈO ĐÃ HẸN GIỜ (bước 4, §5). Chạy TRƯỚC bước khoá để một kèo có
   * cửa sổ cực ngắn vẫn đi đúng thứ tự mở → khoá trong cùng một lượt, thay vì
   * mở ở lượt này rồi khoá ở lượt sau (trễ một phút, và một phút ấy là một
   * phút người chơi đặt được vào kèo lẽ ra đã đóng).
   *
   * ⚠ CHỈ kèo đã bật `tu_mo` — cờ đó chỉ đặt được qua cửa nặng (0027). Đây là
   * chỗ khoản chi Kho bạc THẬT SỰ chạy khi không có ai ngồi đó, nên nó phải
   * chạy đúng thứ đã được một con người duyệt trước, không nhiều hơn.
   */
  const opened: string[] = [];
  const { rows: hen } = await pool.query(
    `SELECT market_id, created_by FROM markets
      WHERE tu_mo AND status = 'draft' AND open_ts <= now()
      ORDER BY open_ts`,
  );
  for (const row of hen) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const kq = await moKeo(client, row.market_id);
      if (!kq.ok) {
        /*
         * Kho bạc không đủ hoặc ai đó vừa mở tay → BỎ QUA, không nổ cả lượt
         * tick. Nhưng TẮT CỜ nếu là thiếu tiền: để nguyên thì mỗi phút nó lại
         * thử và lại thất bại, im lặng, mãi mãi. Tắt cờ + ghi audit biến một
         * vòng lặp vô hình thành một dòng đọc được.
         */
        await client.query('ROLLBACK');
        if (kq.ma === 'treasury_insufficient') {
          /*
           * ⚠⚠ `client`, KHÔNG PHẢI `pool` — bế tắc `max: 1` (bug thật 04/08,
           * commit 20b4bec, ở cửa KHÁCH). `finally` bên dưới mới nhả kết nối, nên
           * xin thêm một kết nối ở đây là xin chính cái mình đang giữ: chờ vĩnh
           * viễn, Vercel cắt ở 10,4 giây. Hậu quả ở ĐÂY nặng hơn ở cửa khách —
           * treo cả lượt tick, tức C3 (kèo khoá/resolve đúng giờ dù 0 người online)
           * chết theo, và chết IM LẶNG mỗi phút một lần.
           *
           * ⚠ Đã ROLLBACK nên `client` không còn trong transaction: hai câu dưới
           * chạy autocommit, đúng bằng ngữ nghĩa cũ. Đổi tên biến, không đổi nghĩa —
           * chúng CỐ Ý nằm ngoài transaction vừa bị huỷ.
           */
          await client.query(`UPDATE markets SET tu_mo = false WHERE market_id = $1`, [row.market_id]);
          await client.query(
            `INSERT INTO admin_audit (admin_id, action, payload_json) VALUES ($1,$2,$3)`,
            [row.created_by, 'market_tu_mo_that_bai',
              JSON.stringify({ market_id: row.market_id, ly_do: kq.message })],
          );
        }
        continue;
      }
      // Ghi công người ĐÃ HẸN LỊCH, không ghi "hệ thống": uỷ quyền có chủ ngữ.
      await client.query(
        `INSERT INTO admin_audit (admin_id, action, payload_json) VALUES ($1,$2,$3)`,
        [row.created_by, 'market_open',
          JSON.stringify({ market_id: row.market_id, seed_total: kq.seed_total.toString(), qua: 'hen_gio' })],
      );
      await client.query('COMMIT');
      opened.push(row.market_id);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // (1) Khóa kèo tới giờ — C3: đúng giờ kể cả 0 người online
  const lockRes = await pool.query(
    `UPDATE markets SET status = 'locked'
      WHERE status = 'open' AND lock_ts <= now()
      RETURNING market_id`,
  );

  // (2) Tự hủy kèo quá hạn nguồn: now ≥ resolve_deadline_ts + RESOLUTION_TIMEOUT
  const { rows: overdue } = await pool.query(
    `SELECT market_id FROM markets
      WHERE status IN ('open', 'locked')
        AND resolve_deadline_ts + make_interval(days => $1) <= now()`,
    [ECONOMY.RESOLUTION_TIMEOUT_DAYS],
  );
  const cancelled: string[] = [];
  for (const row of overdue) {
    try {
      await cancelMarket(pool, {
        marketId: row.market_id,
        reason: `Tự hủy: nguồn không công bố kết quả trong ${ECONOMY.RESOLUTION_TIMEOUT_DAYS} ngày sau hạn (scheduler). Hoàn 100% cược.`,
      });
      cancelled.push(row.market_id);
    } catch (err) {
      // Admin vừa resolve/hủy song song → trạng thái đã đổi, bỏ qua (idempotent)
      if (!(err instanceof LifecycleError)) throw err;
    }
  }

  return { locked: lockRes.rowCount ?? 0, cancelled, opened };
}
