/**
 * GĐ4 VIỆC 4 — Trợ cấp sàn (chống phá sản, A4): bankroll < 500 → +50 T/ngày,
 * trần 1.000 T/tháng, CHI TỪ KHO BẠC (không bao giờ mint — A3.4).
 * "Ngày" và "tháng" tính theo Asia/Ho_Chi_Minh (A8.8) ngay trong SQL.
 *
 * Thứ tự khóa: users FOR UPDATE → advisory lock Kho bạc (trong treasuryAppend)
 * — cùng chiều với resolve (users trước, kho bạc sau) → không deadlock chéo.
 */
import { Hono } from 'hono';
import type pg from 'pg';
import { ECONOMY } from '../config/economy.js';
import { treasuryAppend } from './treasury.js';

import type { Env, Mw as Middleware } from './http/types.js';

const VN = 'Asia/Ho_Chi_Minh';

export function registerSubsidyRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware; chanKhach: Middleware },
): void {
  app.post('/api/v1/subsidy/claim', mw.requireAuth, mw.requireOnboarded, mw.chanKhach, async (c) => {
    const actor = c.get('actor');
    /*
     * ⚠⚠ CỬA KHÁCH KHÔNG ĐƯỢC RÚT KHO BẠC (rà soát 11/08 — lỗ đang mở, khai
     * thác được bằng curl, không cần một tài khoản nào).
     *
     * Cửa KHÁCH tạo một hàng `users` THẬT bằng đúng một cú POST: không email,
     * không xác minh, không age gate. Trước bản này `/subsidy/claim` chỉ có
     * `requireAuth` + `requireOnboarded`, mà `requireOnboarded` chỉ hỏi
     * `actor.userId` có null không — khách có `user_id` thật nên qua sạch.
     *
     * VÌ SAO NẶNG: Kho bạc là quỹ MỘT LẦN (`genesis_grant` khoá bằng unique
     * partial index — A3.4/D10), chỉ nạp thêm bằng 2% rake. Trần khách là
     * 5/IP/giờ ⇒ 120 tài khoản/ngày/IP × 50 T = 6.000 T/ngày/IP; vài IP là cạn
     * kho 20.135 T trong một ngày. Mà `CHECK balance_after >= 0` làm mọi khoản
     * chi FAIL CỨNG khi cạn: không mở được kèo có seed, người chơi THẬT hết
     * trợ cấp, quà beta trả `kho_bac_can`. Tức một người lạ phá được lõi kinh
     * tế của cả mùa.
     *
     * Đọc `actor.laKhach` (đã có trên phiên) chứ không hỏi DB lại — một nguồn,
     * và không tốn một vòng kết nối trên pool 5 (C1).
     */
    /*
     * ⚠ PHÉP KIỂM KHÁCH ĐÃ DỜI RA MIDDLEWARE `chanKhach` (12/08) — xem lý do
     * đầy đủ ở `server/app.ts`. Nó từng nằm ngay đây, và chính vì nằm trong
     * handler nên cửa rút Kho bạc THỨ HAI (`/me/qua-beta/nhan`, chi gấp mười
     * lần) còn nguyên lỗ suốt một ngày: người thêm cửa mới không đọc file này.
     * Giữ MỘT cơ chế ở MỘT chỗ — hai bản sao thì bản không ai nhìn sẽ trôi (D61).
     */
    const userId = actor.userId!;
    const amount = BigInt(ECONOMY.SUBSIDY_AMOUNT);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: uRows } = await client.query(
        `SELECT bankroll FROM users WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      const bankroll = uRows[0].bankroll as bigint;

      /*
       * ⚠⚠ PHẢI TỪNG ĐƯỢC CẤP VỐN MỚI ĐƯỢC TRỢ CẤP (siết 12/08).
       *
       * Trước đây điều kiện duy nhất là "ví < 500 T". Nó hỏi *bạn còn bao nhiêu*
       * trong khi thứ cần hỏi là *bạn đã từng được cấp ví chưa* — và hai câu đó
       * chỉ trùng nhau với người vào bằng cửa đăng ký.
       *
       * Đợt săn 12/08 chỉ ra vế còn lại: tài khoản vào qua **Discord** sinh ra
       * với ví 0 T và KHÔNG BAO GIỜ nhận 1.000 T vốn khởi điểm — `discord.ts`
       * tự khai "không đụng tới bankroll nên không cần cấp gì cả", đúng với Đấu
       * trường (không dùng ví T). Hệ quả không ai nhắm tới: họ vĩnh viễn nằm
       * dưới ngưỡng, tức **vĩnh viễn đủ điều kiện rút 50 T/ngày từ Kho bạc**.
       * Đây là lỗ TỰ CHẢY — không cần ai tấn công, lưu lượng bình thường cũng
       * làm cạn một quỹ MỘT LẦN, và cạn thì `CHECK balance_after >= 0` khiến
       * mọi khoản chi FAIL CỨNG (seed kèo, trợ cấp người thật, quà).
       *
       * Trợ cấp sinh ra để chống PHÁ SẢN — tức để đỡ người đã có vốn rồi mất.
       * Người chưa từng có vốn thì không phá sản; họ chỉ chưa mở ví. Nên phép
       * kiểm đúng là "tồn tại một dòng `signup_grant`", và nó cũng tự đóng mọi
       * cửa vào-không-qua-đăng-ký sau này mà không phải nhớ liệt kê từng cửa.
       */
      const { rows: gRows } = await client.query(
        `SELECT 1 FROM wallet_ledger
          WHERE user_id = $1 AND reason = 'signup_grant' LIMIT 1`,
        [userId],
      );
      if (gRows.length === 0) {
        await client.query('ROLLBACK');
        return c.json(
          {
            error: 'chua_co_vi',
            message: 'Ví dự báo của bạn chưa mở. Hoàn tất đăng ký hồ sơ để nhận vốn khởi điểm nhé.',
          },
          403,
        );
      }

      if (bankroll >= BigInt(ECONOMY.SUBSIDY_THRESHOLD)) {
        await client.query('ROLLBACK');
        return c.json(
          {
            error: 'not_eligible',
            message: `Trợ cấp chỉ dành cho ví dưới ${ECONOMY.SUBSIDY_THRESHOLD} T.`,
          },
          400,
        );
      }

      // Trần tháng kiểm TRƯỚC ngày — chạm trần thì mã lỗi luôn là monthly_cap,
      // bất kể hôm nay đã nhận hay chưa (tất định cả ở mốc đầu tháng).
      const { rows: monthRows } = await client.query(
        `SELECT COALESCE(SUM(delta), 0) AS s FROM wallet_ledger
          WHERE user_id = $1 AND reason = 'subsidy'
            AND date_trunc('month', created_at AT TIME ZONE $2)
              = date_trunc('month', now() AT TIME ZONE $2)`,
        [userId, VN],
      );
      if (BigInt(monthRows[0].s) + amount > BigInt(ECONOMY.SUBSIDY_MONTHLY_CAP)) {
        await client.query('ROLLBACK');
        return c.json(
          {
            error: 'monthly_cap',
            message: `Bạn đã nhận đủ trần trợ cấp ${ECONOMY.SUBSIDY_MONTHLY_CAP} T tháng này.`,
          },
          409,
        );
      }

      const { rows: dayRows } = await client.query(
        `SELECT 1 FROM wallet_ledger
          WHERE user_id = $1 AND reason = 'subsidy'
            AND (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
          LIMIT 1`,
        [userId, VN],
      );
      if (dayRows.length > 0) {
        await client.query('ROLLBACK');
        return c.json(
          { error: 'already_claimed_today', message: 'Hôm nay bạn đã nhận trợ cấp rồi. Mai quay lại nhé.' },
          409,
        );
      }

      // Chi từ Kho bạc — kho cạn thì treasuryAppend ném lỗi rõ ràng (A3.4)
      try {
        await treasuryAppend(client, -amount, 'subsidy_out', null);
      } catch {
        await client.query('ROLLBACK');
        return c.json(
          { error: 'treasury_empty', message: 'Kho bạc tạm cạn — trợ cấp sẽ mở lại sau.' },
          409,
        );
      }

      const bankrollAfter = bankroll + amount;
      await client.query(`UPDATE users SET bankroll = $1 WHERE user_id = $2`, [
        bankrollAfter.toString(),
        userId,
      ]);
      await client.query(
        `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
         VALUES ($1, $2, $3, 'subsidy')`,
        [userId, amount.toString(), bankrollAfter.toString()],
      );
      // Event checkin cùng transaction (A7: checkin = nhận trợ cấp)
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type, value_num)
         VALUES ($1, 'subsidy', NULL, 'checkin', $2)`,
        [userId, ECONOMY.SUBSIDY_AMOUNT],
      );
      await client.query('COMMIT');
      return c.json({ ok: true, amount: ECONOMY.SUBSIDY_AMOUNT, bankroll: Number(bankrollAfter) });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });
}
