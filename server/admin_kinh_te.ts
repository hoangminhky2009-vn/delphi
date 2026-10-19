/**
 * CỬA ADMIN CỦA BÁO CÁO KINH TẾ — một route, CHỈ ĐỌC.
 *
 * Tách khỏi `admin_thongke.ts` có chủ ý, hai lý do:
 *  1. `admin_thongke.ts` trả lời câu hỏi về NGƯỜI DÙNG (nhóm, hành trình, tính
 *     cách). Đây là câu hỏi về TIỀN. Trộn vào là để một tệp 1.300 dòng phình
 *     tiếp và mất luôn cái ranh "ai sở hữu số nào".
 *  2. Tệp kia đang có cửa sổ khác chạm (`docs/nhieu-cua-so.md`) — thêm route vào
 *     một tệp đang nóng là tự chuốc lấy xung đột không cần thiết (A11.7).
 *
 * Báo cáo công khai cho NGƯỜI CHƠI là bước B4 của lộ trình, sau cờ
 * `BAO_CAO_CONG_KHAI`. Ở đây mới chỉ có cửa admin.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { docBaoCaoKinhTe } from './kinh_te/bao_cao.js';

import type { Env, Mw as Middleware } from './http/types.js';

export function registerAdminKinhTeRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware; requireAdmin: Middleware },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded, mw.requireAdmin] as const;

  /**
   * Toàn bộ báo cáo trong MỘT lượt gọi. Không phân trang, không lọc: đây là bảng
   * vĩ mô, và nó phải đọc được trong một cái liếc — chia nhỏ ra nhiều route là
   * cách chắc chắn để không ai nhìn thấy bức tranh.
   */
  app.get('/api/v1/admin/kinh-te', ...guard, async (c) => {
    return c.json(await docBaoCaoKinhTe(pool));
  });
}
