/**
 * ART THẺ BÀI — PIXEL, theo §XI "Modern Pixel UI".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 24/09/2026 — BỘ LÁ MỚI (D390) THAY BỘ CẢNH 80×60.
 *
 * 22 lưới vuông ở `server/art/la_bai.ts` (founder duyệt ở trang demo, bản 12) qua
 * `veLaBai()` — lá terminal: nét vẽ trên nền trong suốt, lớp neon + vệt sáng theo nét.
 * Sáu lõi chiến thuật bị cắt ở v54 (`LOI_BI_CAT`, D389/D394) KHÔNG được vẽ lại: chúng
 * còn chơi được ở bản mặc định nên giữ art cảnh cũ (`holdem_art_grids.ts` → `vePixel`)
 * tới ngày v54 thành mặc định.
 *
 * ⭐ MỘT LÁ THIÊN NGA ĐEN CHO MỌI TIN HOẢNG LOẠN (D390). Chiến tranh, phá sản dây chuyền,
 * dịch bệnh, siết pháp lý, cấm vận, thảm hoạ… không còn sáu bức tranh: cả bảy khoá `sk_*`
 * có tính chất nền `hoang_loan` (`TINH_CHAT_NEN`, config) nhận CÙNG art của
 * `sk_thien_nga_den`; loại tin là icon góc phải do khung ngoài vẽ (`web/src/lib/la_bai.ts`).
 * Suy từ bảng tính chất chứ không gõ danh sách: thêm một tin hoảng loạn mới thì nó tự
 * nhận lá thiên nga, không có ô nào lọt về hình cũ.
 * ⚠ Gộp là việc của TẦNG HÌNH: engine giữ nguyên từng `SuKienId` và tác động giá riêng.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 25/07/2026 — PIXEL HOÁ (founder: "nhớ là pixel cho mấy card nhé"): bộ vector cũ đo
 * được 84 feGaussianBlur + 502 gradient; lấy lại được ở tag `depth-d4-done`.
 *
 * `scripts/lint_pixel_art.ts` vỡ build nếu: art nào chứa blur/gradient, lưới sai khuôn,
 * dùng chữ ngoài bảng màu, lá mới mất lớp neon, hoặc thẻ trong catalog mà thiếu art.
 */
import { SU_KIEN, TINH_CHAT_NEN } from '../config/holdem.js';
import { LA_BAI } from './art/la_bai.js';
import { LUOI_PIXEL } from './holdem_art_grids.js';
import { veLaBai } from './holdem_art_la.js';
import { vePixel } from './holdem_art_pixel.js';

/** Khoá art của lá thiên nga đen — mọi tin `hoang_loan` mượn đúng hình này. */
export const KHOA_THIEN_NGA = 'sk_thien_nga_den';

/** Các khoá `sk_*` hiện bằng lá thiên nga (kể cả chính nó). */
export const KHOA_HOANG_LOAN: readonly string[] = SU_KIEN
  .filter((s) => TINH_CHAT_NEN[s.id] === 'hoang_loan')
  .map((s) => `sk_${s.id}`);

const LA_MOI: Record<string, string> = Object.fromEntries(
  Object.entries(LA_BAI).map(([id, la]) => [id, veLaBai(la)]),
);

export const ART: Record<string, string> = {
  ...Object.fromEntries(Object.entries(LUOI_PIXEL).map(([id, luoi]) => [id, vePixel(luoi)])),
  ...LA_MOI,
  ...Object.fromEntries(KHOA_HOANG_LOAN.map((k) => [k, LA_MOI[KHOA_THIEN_NGA]!])),
};

export const coArt = (id: string): boolean => id in ART;

/** Artwork của một mã; rỗng nếu chưa có (UI tự lo phương án dự phòng). */
export const artOf = (id: string): string => ART[id] ?? '';
