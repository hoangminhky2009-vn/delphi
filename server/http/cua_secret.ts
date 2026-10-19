/**
 * K3 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — CỬA SECRET CHO ROUTE MÁY GỌI (`/internal/tick` · `/internal/backup`).
 *
 * Trước bản này mỗi handler tự so secret ở dòng đầu; cột guard của `docs/api/danh-sach-route.md` vì thế ghi
 * "_không_" cho hai cửa đắt nhất app (tick chạy scheduler + dọn rác; backup đọc toàn DB) — người đọc danh sách
 * tưởng chúng mở. Nay là middleware có tên, hiện trong cột guard.
 *
 * ⚠ FAIL-CLOSED: secret cấu hình trống/thiếu ⇒ KHÔNG BAO GIỜ mở (đặt nhầm biến môi trường thì cửa đóng, không
 * toang). So bằng `safeEqual` (hằng thời gian) — không lộ độ dài khớp qua thời gian phản hồi.
 */
import type { Context } from 'hono';
import { safeEqual } from '../auth/crypto.js';
import type { Mw } from './types.js';

/**
 * @param docHeader lấy secret NGƯỜI GỌI gửi (header nào tuỳ cửa: `x-tick-secret`, `Authorization: Bearer` của Vercel cron…)
 * @param docSecret lấy secret ĐÚNG lúc request tới (không chụp lúc dựng app — test và env đổi được)
 */
export function requireSecret(
  docHeader: (c: Context) => string | undefined,
  docSecret: () => string | undefined,
): Mw {
  const cua: Mw = async (c, next) => {
    const dung = docSecret();
    const gui = docHeader(c);
    if (!dung || !gui || !safeEqual(gui, dung)) {
      return c.json({ error: 'unauthorized', message: 'Sai hoặc thiếu khoá máy gọi.' }, 401);
    }
    await next();
  };
  /*
   * Tên hàm là thứ cột guard của danh sách route in ra (`scripts/sinh_route.ts` đọc `.name`). Đặt tường minh: hàm trong trùng tên hàm
   * ngoài thì esbuild (vitest) đổi thành `requireSecret2` ⇒ bản sinh trong test lệch bản sinh bằng tsx.
   */
  Object.defineProperty(cua, 'name', { value: 'requireSecret' });
  return cua;
}
