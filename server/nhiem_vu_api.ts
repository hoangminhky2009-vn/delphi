/**
 * ROUTE của VIỆC TUẦN + LỘ TRÌNH MÙA 0.0.
 *
 * Hai endpoint, và cố ý không có endpoint thứ ba:
 *   GET  /api/v1/me/nhiem-vu             — trạng thái đầy đủ (rà soát + nhận mốc)
 *   POST /api/v1/me/nhiem-vu/diem-danh   — nút điểm danh, trần 1 lần/ngày VN
 *
 * KHÔNG có `POST /nhiem-vu/:id/xong`. Client không bao giờ khai đã xong việc gì
 * (C4); tiến độ suy từ dấu vết đã có — xem docstring `server/nhiem_vu.ts`.
 *
 * Gắn vào app qua `registerProgressionRoutes` (`server/progression.ts`) chứ không
 * thêm một lời gọi mới trong `server/app.ts`: cụm route này là phần tiếp của
 * cùng một chủ đề (tiến trình người chơi), và `app.ts` đang bị luồng khác sửa
 * song song trong đợt này.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { diemDanh, ngayVN, trangThaiLoTrinh } from './nhiem_vu.js';

import type { Env, Mw as Middleware } from './http/types.js';

const VN = 'Asia/Ho_Chi_Minh';

/**
 * Ghi `nv_view` — ĐÃ ĐỌC danh sách việc. MỘT dòng mỗi ngày, không mỗi request.
 *
 * Vì sao trường này đáng log (A7: công thức index viết TRƯỚC): chỉ số I-N6 so
 * chất lượng hành vi của CÙNG MỘT NGƯỜI trong-cửa-sổ-nhiệm-vụ vs ngoài. Mọi thứ
 * khác suy được bằng join `nhiem_vu_xong × ts`, TRỪ một thứ: người chơi có thật
 * sự ĐỌC danh sách việc hay không. Không có nó thì không phân biệt được "làm tình
 * cờ" với "làm vì được bảo" — tức không đo được nhiệm vụ nào đang làm bẩn dữ liệu,
 * và không đo được thì `ngay_ra_soat` cuối mùa chỉ là một ngày trên giấy.
 *
 * Vì sao gộp theo NGÀY: mỗi lần mở Hub là một GET. Ghi mỗi request thì bảng
 * `events` phình bằng số lần điều hướng, và I-N6 không cần độ phân giải đó — nó
 * hỏi "hôm đó có đọc không". Snapshot giữ ≤300 byte theo A7: mảng [nv_id, xong].
 */
async function ghiNvView(
  pool: pg.Pool,
  userId: string,
  viec: ReadonlyArray<{ nv_id: string; xong: boolean }>,
): Promise<void> {
  const ngay = ngayVN();
  await pool.query(
    `INSERT INTO events (user_id, context_type, context_id, action_type,
                         state_snapshot_json)
     SELECT $1, 'nhiem_vu', $2, 'nv_view', $3
      WHERE NOT EXISTS (
        SELECT 1 FROM events
         WHERE user_id = $1 AND action_type = 'nv_view'
           AND (ts AT TIME ZONE $4)::date = (now() AT TIME ZONE $4)::date)`,
    [userId, ngay, JSON.stringify(viec.map((v) => [v.nv_id, v.xong])), VN],
  );
}

export function registerNhiemVuRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  requireAuth: Middleware,
  requireOnboarded: Middleware,
): void {
  app.get('/api/v1/me/nhiem-vu', requireAuth, requireOnboarded, async (c) => {
    const userId = c.get('actor').userId!;
    const tt = await trangThaiLoTrinh(pool, userId);
    await ghiNvView(pool, userId, tt.viec);
    return c.json(tt);
  });

  app.post('/api/v1/me/nhiem-vu/diem-danh', requireAuth, requireOnboarded, async (c) => {
    const userId = c.get('actor').userId!;
    const { moi } = await diemDanh(pool, userId);
    /*
     * Trả nguyên trạng thái mới, không trả `{ok:true}`: bấm điểm danh có thể
     * đóng luôn việc tuần "điểm danh 4 ngày" và do đó mở một chặng và trao Q
     * ngay trong cùng lượt bấm. D26 đòi feedback RÕ và NGAY — client không được
     * phải gọi thêm một vòng để biết mình vừa nhận gì (và C4: nó không được tự
     * suy ra).
     */
    const tt = await trangThaiLoTrinh(pool, userId);
    return c.json({ moi, ...tt });
  });
}
