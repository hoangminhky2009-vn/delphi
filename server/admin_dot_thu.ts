/**
 * KHU TESTER của `/quan-tri` — ĐỌC CHI TIẾT TỪNG NGƯỜI TRONG ĐỢT THỬ NGHIỆM (D362).
 *
 * Founder 20/09: *"trên dashboard admin cũng có riêng 1 phần cho tester, thu chi tiết từng cá nhân"*.
 *
 * ⚠⚠ ĐÂY LÀ MẶT DUY NHẤT CỦA `/quan-tri` TRẢ DÒNG THEO NGƯỜI, và nó chỉ làm được vì ba thứ khớp nhau:
 *   1. người vào bằng LINK bàn buổi đo (0068) — tức đã tự chọn vào đợt thử nghiệm;
 *   2. họ đã bấm văn bản `buoi_do` bản HIỆN HÀNH, bản nói thẳng *"Nhóm làm app đọc dữ liệu của từng
 *      người để sửa app và viết báo cáo"*;
 *   3. dòng trả về KHÔNG mang danh tính — khoá là `ma_tham_gia`, đúng mã người chơi thấy ở màn kết.
 * Thiếu bất kỳ cái nào trong ba là mặt này không được phép tồn tại. Mọi mặt khác của `/quan-tri` vẫn
 * giữ nguyên luật cũ: sàn mẫu, làm tròn, không một dòng theo người.
 *
 * ⚠ Phép đọc nằm ở `server/dot_thu.ts`, dùng chung với lệnh xuất CSV — một nguồn, không hai bảng số.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { CONSENT_PHIEN_BAN } from '../config/pfm_consent.js';
import { docDotThu, dsDotThu, LoiDotThu } from './dot_thu.js';

import type { Env, Mw as Middleware } from './http/types.js';

export function registerAdminDotThuRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware; requireAdmin: Middleware },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded, mw.requireAdmin] as const;

  /**
   * `GET /api/v1/admin/dot-thu` — mọi người đang bật cờ thu chi tiết, một dòng mỗi trận buổi đo.
   * `?dot=<nhãn>` lọc theo một đợt; không có thì lấy tất cả.
   *
   * ⚠ KHÔNG phân trang. Đợt thử nghiệm mùa này tính bằng chục người, và một mặt "đọc từng người" mà
   * phải bấm sang trang là mặt không ai đọc hết. Khi nào một đợt vượt vài trăm người thì đây là chỗ
   * phải sửa — ghi ra để lần sau không phải đoán là cố ý hay sót.
   */
  app.get('/api/v1/admin/dot-thu', ...guard, async (c) => {
    const dot = c.req.query('dot');
    try {
      const [ds, kq] = await Promise.all([
        dsDotThu(pool),
        docDotThu(pool, { kieu: 'dot', nhan: dot === undefined || dot === '' ? null : dot }),
      ]);
      return c.json({
        dot: dot ?? null,
        cac_dot: ds,
        consent_ban: CONSENT_PHIEN_BAN.buoi_do,
        thong_ke: kq.thongKe,
        nguoi: kq.hangNguoi,
        vong: kq.hangVong,
      });
    } catch (e) {
      if (e instanceof LoiDotThu) return c.json({ error: e.ma, ...e.them }, 400);
      throw e;
    }
  });
}
