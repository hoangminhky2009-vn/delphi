/**
 * API GHÉP BÀN XẾP HẠNG (/api/v1/holdem/rank/suat · /api/v1/holdem/rank/vao ở holdem_api.ts) — SAU CỜ `RANK_GHEP_BAT` (TẮT mặc định).
 *
 *   POST   /api/v1/holdem/rank/suat     đăng ký suất kế tiếp (:00 :15 :30 :45). 1 request. Idempotent. KHÔNG trả số người đăng ký.
 *   DELETE /api/v1/holdem/rank/suat     rút khỏi suất chưa tới giờ.
 *   GET    /api/v1/holdem/rank/suat/me  trạng thái của CHÍNH MÌNH: chờ · chưa đủ người · đã ghép bàn (số người/máy/ghế, hạn, match_id).
 *
 * Ngân sách (C1): ~2–3 request/người/suất (đăng ký + một lần đọc lúc giờ + jitter), không polling (design_rank §7.3). Client nên gọi `GET …/me`
 * một lần ở `giờ_suất + (hash(user_id) mod 20 s)` — jitter để khỏi vắt cạn pool kết nối free tier.
 *
 * ⚠ Cùng hai cổng với `rank_pve`: KHÁCH không xếp hạng được (tầng một, lời hứa với người dùng) và cần ĐỒNG Ý điều khoản (tên đứng cạnh người lạ).
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { GHEP_BAN, THONG_BAO_CAN_NGUOI, ghepBanBat } from '../config/rank_ghep.js';
import { consumeLimit } from './auth/rate_limit.js';
import { GhepError, dangKySuat, rutSuat, trangThaiNguoi } from './rank_ghep.js';
import { docNghienCuuHieuLuc } from './nghien_cuu.js';

import type { Env, Mw as Middleware } from './http/types.js';

export function registerRankGhepRoutes(
  app: Hono<Env>, pool: pg.Pool,
  deps: { requireAuth: Middleware; requireOnboarded: Middleware },
): void {
  const guard = [deps.requireAuth, deps.requireOnboarded] as const;
  const chuaMo = (c: any) => c.json({ error: 'ghep_ban_chua_mo', bat: false, message: THONG_BAO_CAN_NGUOI }, 403);

  app.post('/api/v1/holdem/rank/suat', ...guard, async (c) => {
    if (!ghepBanBat()) return chuaMo(c);
    const actor = c.get('actor');
    const userId = actor.userId!;
    if (actor.laKhach) {
      return c.json({
        error: 'khach_khong_xep_hang',
        message: 'Chế độ khách chơi tự do thoải mái, nhưng chưa lên bảng xếp hạng được. Tạo tài khoản là giữ được thành tích.',
      }, 403);
    }
    // 0079 — đồng ý có hiệu lực (bật + đúng bản văn hiện hành), một nguồn `server/nghien_cuu.ts`.
    if (!(await docNghienCuuHieuLuc(pool, userId))) {
      return c.json({
        error: 'chua_dong_y',
        message: 'Xếp hạng cần đồng ý điều khoản (tên bạn sẽ đứng trên bảng chung). Chơi tự do thì không cần. Bật ở Hồ sơ → DỮ LIỆU CỦA TÔI.',
      }, 403);
    }
    const gioi = await consumeLimit(pool, `rank_suat:${userId}`, 30, 60);
    if (!gioi.allowed) {
      return c.json({ error: 'rate_limited', message: 'Bạn thao tác hơi nhanh. Thử lại sau ít phút nhé.' }, 429);
    }
    try {
      const kq = await dangKySuat(pool, userId, new Date());
      return c.json({
        ok: true, da_co: kq.daCo, slot: kq.slot.toISOString(),
        // Trả giờ ghép để client đếm ngược. TUYỆT ĐỐI không có số người đã đăng ký (design_rank §7.3).
        gio_ghep: kq.slot.toISOString(),
        so_nguoi_toi_thieu: GHEP_BAN.SO_NGUOI_TOI_THIEU,
      }, kq.daCo ? 200 : 201);
    } catch (e) {
      if (e instanceof GhepError) return c.json({ error: e.code, message: e.message }, e.status as 409);
      throw e;
    }
  });

  app.delete('/api/v1/holdem/rank/suat', ...guard, async (c) => {
    if (!ghepBanBat()) return chuaMo(c);
    const rut = await rutSuat(pool, c.get('actor').userId!, new Date());
    return c.json({ ok: true, da_rut: rut });
  });

  app.get('/api/v1/holdem/rank/suat/me', ...guard, async (c) => {
    if (!ghepBanBat()) {
      // Cờ tắt vẫn trả 200 để client phân biệt "chưa mở" với "lỗi" (cùng nếp `/bxh/dau-truong`).
      return c.json({ bat: false, trang_thai: 'khong', message: THONG_BAO_CAN_NGUOI });
    }
    const t = await trangThaiNguoi(pool, c.get('actor').userId!);
    c.header('Cache-Control', 'private, no-store');
    return c.json({ bat: true, so_nguoi_toi_thieu: GHEP_BAN.SO_NGUOI_TOI_THIEU, ...t });
  });
}
