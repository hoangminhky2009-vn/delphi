/**
 * ĐẾM LƯỢT GỌI TỚI VERCEL — luật đếm (hàm thuần, có test). Sổ ở `cua.js` (instance `dem-v1` của `CuaHang`).
 *
 * ⚠ VÌ SAO ĐẾM Ở ĐÂY (D594, founder 11/10): vượt hạn mức tháng của Vercel Hobby là sập tới hết chu kỳ
 * (`docs/gioi-han-ha-tang.md` §④), mà API đọc mức dùng của Vercel trả 404 "Plan not found" cho tài khoản Hobby.
 * Worker thấy mọi request người chơi gửi tới API, nên nó tự đếm được — 0đ, không token.
 *
 * ⚠ VÌ SAO ĐẾM THEO LÔ, KHÔNG GỌI DO MỖI LƯỢT: Durable Object free cũng có trần lượt gọi mỗi ngày, và cổng hàng
 * chờ dùng chung lớp đó. Gọi DO trên MỌI request là nhân đôi lượt gọi DO để đi đếm — đúng kiểu cơ chế chống sập
 * thành nguyên nhân sập (D293). Mỗi isolate đếm trong bộ nhớ, xả lên DO mỗi `LO_XA` lượt hoặc mỗi `NHIP_XA_MS`.
 * Isolate chết trước khi xả thì mất vài chục lượt — CHẤP NHẬN ĐƯỢC: đây là ước lượng để biết sắp chạm trần,
 * không phải sổ tiền.
 *
 * Chỉ đếm request THẬT SỰ đi tới Vercel (gọi `ghiLuot` ngay trước `fetch(upstream)`): lượt trúng cache biên và
 * lượt bị cổng giữ lại không tốn quota Vercel. Lượt KHÔNG đi qua Worker (cron-job.org tick · UptimeRobot · cron
 * backup) cộng thêm ở máy chủ bằng `LUOT_NGOAI_WORKER_MOI_NGAY` (config/ha_tang.ts).
 */

export const LO_XA = 50;
export const NHIP_XA_MS = 60_000;

/** @returns {{ cho: number, lanXa: number }} */
export function boDemMoi(now = Date.now()) {
  return { cho: 0, lanXa: now };
}

/**
 * Ghi một lượt. Trả số lượt cần XẢ lên sổ (và đưa bộ đếm về 0), hoặc 0 nếu chưa tới lúc.
 * @param {{ cho: number, lanXa: number }} bd
 */
export function ghiLuot(bd, now = Date.now()) {
  bd.cho += 1;
  if (bd.cho < LO_XA && now - bd.lanXa < NHIP_XA_MS) return 0;
  const n = bd.cho;
  bd.cho = 0;
  bd.lanXa = now;
  return n;
}

/** Khoá tháng UTC `YYYY-MM` — sổ cộng dồn theo khoá này. */
export function khoaThang(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 7);
}
