/**
 * QUÀ TRI ÂN MÙA BETA — hai cửa: XEM TIẾN ĐỘ và NHẬN.
 *
 * Lõi nghiệp vụ ở `server/qua_beta.ts`; file này chỉ mở transaction và dịch lỗi.
 *
 * ⚠ VÌ SAO CÓ CỬA "XEM TIẾN ĐỘ" RIÊNG, KHÔNG PHẢI CHỈ MỘT NÚT NHẬN:
 * điều kiện là 4 việc lõi + 3 trận, tức người chơi phải CÀY trước khi bấm được.
 * Một cái nút xám không nói còn thiếu gì là một cái nút bị bỏ qua — và cùng với
 * nó là lý do người ta cày. Cửa này trả đúng hai con số đang thiếu, để màn ghi
 * "còn 1 việc và 2 trận nữa" thay vì "chưa đủ điều kiện".
 */
import { Hono } from 'hono';
import type pg from 'pg';
import { capQuaBeta, QuaBetaError, tienDoQuaBeta } from './qua_beta.js';

import type { Env, Mw as Middleware } from './http/types.js';

export function registerQuaBetaRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  requireAuth: Middleware,
  requireOnboarded: Middleware,
  chanKhach: Middleware,
): void {
  app.get('/api/v1/me/qua-beta', requireAuth, requireOnboarded, async (c) => {
    const userId = c.get('actor').userId!;
    return c.json(await tienDoQuaBeta(pool, userId));
  });

  app.post('/api/v1/me/qua-beta/nhan', requireAuth, requireOnboarded, chanKhach, async (c) => {
    const userId = c.get('actor').userId!;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const kq = await capQuaBeta(client, userId);
      await client.query('COMMIT');
      /*
       * Trả nguyên trạng thái mới kèm kết quả: bấm nhận đổi cả bốn số (ví, Q,
       * thẻ, kho sticker) cùng lúc. D26 đòi feedback RÕ và NGAY, và C4 cấm
       * client tự cộng — nên server phải nói hết trong đúng một lượt.
       *
       * ⚠ ĐỌC BẰNG `client`, KHÔNG BẰNG `pool` — bản đầu viết `tienDoQuaBeta(pool,…)`
       * và `npm run lint:pool-lock` bắt được. Đây đúng bug D65: `api/index.ts` mở
       * pool `max: 1` trên prod, nên xin kết nối thứ hai TRONG KHI đang cầm một
       * cái là xin chính cái mình đang giữ ⇒ chờ vĩnh viễn ⇒ Vercel cắt 10,4 giây
       * ⇒ 504. Test không bao giờ thấy: pool test mở `max: 5`.
       * Sau COMMIT thì `client` vẫn đang được giữ và đọc bình thường được.
       */
      const tienDo = await tienDoQuaBeta(client, userId);
      return c.json({ ok: true, ...kq, tien_do: tienDo });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err instanceof QuaBetaError) {
        return c.json({ error: err.code, message: err.message }, err.httpCode as 409);
      }
      /*
       * Kho bạc cạn ném `Error` thường từ `treasuryAppend` (nó không có lớp lỗi
       * riêng). Bắt riêng để người chơi nhận một câu tử tế thay vì 500 — đây là
       * tình huống ĐƯỢC BIẾT TRƯỚC (D68 tính tay: 30 người × 500 T = 15.000 /
       * 20.135 T kho), không phải sự cố.
       */
      if (err instanceof Error && err.message.includes('Kho bạc không đủ')) {
        return c.json({
          error: 'kho_bac_can',
          message: 'Quỹ tri ân mùa beta đã dùng hết. Không phát thêm được.',
        }, 409);
      }
      throw err;
    } finally {
      client.release();
    }
  });
}
