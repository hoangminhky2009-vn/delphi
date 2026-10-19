/**
 * LƯỚI PIXEL CỦA ART THẺ — 80×60 ô, mỗi ô 2,5px (=200×150 viewBox).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FILE NÀY CHỈ CÒN LÀ CHỖ GỘP. Lưới thật nằm ở `server/art/grids_*.ts`.
 *
 * Vì sao tách (26/07/2026): bốn hoạ sĩ vẽ lại bộ bài SONG SONG, mỗi người một
 * nhóm. Một file 1.740 dòng thì bốn người sửa cùng lúc là ghi đè lên nhau —
 * và với art, "ghi đè" nghĩa là mất luôn công vẽ chứ không phải một conflict
 * marker sửa được. Tách theo nhóm là ranh giới tự nhiên: không lá nào thuộc
 * hai nhóm, nên hai file không bao giờ đụng cùng một lá.
 *
 * `LUOI_PIXEL` giữ NGUYÊN hình dạng cũ (Record<string, readonly string[]> phẳng,
 * khoá là mã thẻ) nên `holdem_art.ts`, `scripts/lint_pixel_art.ts` và
 * `tests/holdem_art.test.ts` không phải sửa một dòng nào.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TIÊU CHUẨN CHẤT LƯỢNG — đo được, không cãi nhau (`scripts/lint_pixel_art.ts`):
 *
 *   ĐỘ PHỦ ≥ 60%    ô không phải '.' — chống tật "vật thể giữa khung, xung quanh
 *                   trống trơn", tật founder phàn nàn ba lần liền.
 *   ĐỘ PHONG PHÚ ≥ 12 ký tự màu khác nhau — chống tật "khối đặc một màu". Muốn đủ
 *                   12 thì buộc phải đổ bóng nhiều sắc độ, tức phải có mặt cong.
 *   PHÁT SÁNG ≤ 25% ô có màu thuộc {W C Y V N R} — chống tật lá nào cũng chói loà.
 *
 * Ba ngưỡng này KHÔNG PHẢI ĐỘ PHÂN GIẢI. Lưới 80×60 = 4.800 ô, thừa sức vẽ chi
 * tiết; hai lần sửa trước đã nâng độ phân giải và vẫn xấu, vì vấn đề là BỐ CỤC.
 */
import { LUOI_CHIEN_THUAT } from './art/grids_chien_thuat.js';

export { LUOI_CHIEN_THUAT };

/**
 * ⚠ 24/09 (D393) — CHỈ CÒN SÁU LÁ CẢNH CŨ: các lõi chiến thuật bị cắt ở v54 (xem
 * `./art/grids_chien_thuat.ts`). Mọi lá khác đã sang bộ lá mới `./art/la_bai.ts`, vẽ bằng
 * `holdem_art_la.ts`; bốn tệp lưới tài sản · giai đoạn · sự kiện · đuôi đã xoá (lấy lại
 * được ở commit trước D393). Luật 80×60 + ba ngưỡng chất lượng bên dưới giờ chỉ canh
 * sáu lá này.
 */
export const LUOI_PIXEL: Record<string, readonly string[]> = {
  ...LUOI_CHIEN_THUAT,
};
