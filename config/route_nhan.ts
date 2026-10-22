/**
 * K5 (SPEC va-bao-mat-chuan-hoa-api-dot-1, Q4 = A) — NHÃN CHO ROUTE KHÔNG CLIENT NÀO GỌI.
 *
 * Rà 17/10: 13 route không có chỗ gọi nào trong `web/src` lẫn trang admin. Route "mồ côi" là bề mặt tấn công không ai canh
 * (không màn nào dùng ⇒ hỏng không ai thấy, mở sai quyền không ai thấy). Hai di sản đã xoá (`GET /holdem/choi` · `GET /admin/ping`);
 * phần còn lại có lý do sống và lý do ấy phải VIẾT RA ở đây — `tests/route_danh_sach.test.ts` đỏ khi một route mới không ai gọi
 * mà cũng không có nhãn. Cột "trạng thái" của `docs/api/danh-sach-route.md` sinh từ bảng này (`npm run route:ghi`).
 *
 * Khoá = `"<METHOD> <đường Hono>"` đúng như cột của danh sách route. Gỡ nhãn khi route có người gọi (bài canh báo nhãn thừa).
 */
export const NHAN_ROUTE = {
  /** Tính năng có route, cờ đang TẮT trong `config/` — bật cờ là có client. */
  cho_bat: 'waiting for a feature flag',
  /** Thuộc module đóng băng (chợ dự báo D86) — giữ tới khi founder chốt số phận module. */
  dong_bang: 'frozen module',
  /** Founder/admin gọi tay (curl, console) — không có màn. */
  admin_tay: 'called by hand (admin)',
  /** Route xong, màn chưa có (Ý chờ trong SPEC). */
  cho_ui: 'screen not built yet',
  /** Điều khoản HỨA một quyền mà nút chưa có — nợ cần trả trước beta rộng. */
  hua_thieu_nut: 'promised, button missing',
  /** Máy gọi (cron-job.org · Vercel cron) — không phải giao diện. */
  may_goi: 'called by a scheduler',
  /** Client đã gỡ nút, route giữ cho trận đang chơi dở trên `balance_version` cũ + replay. */
  ban_cu: 'kept for older matches',
} as const;

export type NhanRoute = keyof typeof NHAN_ROUTE;

export const ROUTE_NHAN: Readonly<Record<string, NhanRoute>> = {
  // cờ `BXH.BAT` tắt (config/bxh.ts)
  'GET /api/v1/bxh/dau-truong': 'cho_bat',
  'POST /api/v1/bxh/lam-moi': 'cho_bat',
  // cờ `RANK_GHEP_BAT` tắt
  'POST /api/v1/holdem/rank/suat': 'cho_bat',
  'DELETE /api/v1/holdem/rank/suat': 'cho_bat',
  'GET /api/v1/holdem/rank/suat/me': 'cho_bat',
  'POST /api/v1/holdem/rank/vao': 'cho_bat',
  // chợ dự báo đóng băng (D86)
  'GET /api/v1/me/bets': 'dong_bang',
  // khung avatar: route có, màn chưa (Ý chờ SPEC mục 6)
  'POST /api/v1/avatar/khung': 'cho_ui',
  // B6 — gỡ liên kết Discord: SPEC đợt 1 chỉ đòi route; nút ở Hồ sơ là Ý chờ (SPEC mục 6)
  'POST /api/v1/auth/discord/go': 'cho_ui',
  'POST /api/v1/admin/avatar/an': 'admin_tay',
  'POST /api/v1/admin/avatar/tang': 'admin_tay',
  // chế độ tester của founder (D224) — gọi tay; rà 17/10 sót ba route này
  'POST /api/v1/admin/tester/token': 'admin_tay',
  'POST /api/v1/admin/tester/mo-khoa': 'admin_tay',
  'POST /api/v1/admin/tester/dat-lai': 'admin_tay',
  // cron-job.org (tick mỗi phút) · Vercel cron (backup đêm) — `docs/deploy_gd0.md` Bước 5
  'POST /api/v1/internal/tick': 'may_goi',
  'GET /api/v1/internal/backup': 'may_goi',
  // D447 — nút KHỚP NGAY gỡ 28/09; route giữ cho trận dở trên bản cũ + replay (`khop_truoc`). Rà 17/10 sót.
  'POST /api/v1/holdem/matches/:id/khop-lenh': 'ban_cu',
  // `web/src/content/dieuKhoan.ts` hứa "rút lại đồng ý buổi đo" — nút chưa có (Ý chờ SPEC mục 6)
  'POST /api/v1/holdem/ban/:ma/rut-dong-y': 'hua_thieu_nut',
};
