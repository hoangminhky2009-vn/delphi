/**
 * HỆ THỐNG CÓ MUA LẠI MÓN NÀY KHÔNG — bất biến **E24**, tầng T0 (hàm thuần).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ LỖ ĐÃ MỞ TRÊN PROD 06/09, BẮT ĐƯỢC KHI THỬ CHỢ TRÊN DỮ LIỆU THẬT (D291)
 *
 * Cửa bán (B7a) định giá theo **bậc hiếm**, không hỏi món ấy có ai từng trả T
 * để có hay không. Kết quả đo trên prod: `Dấu niêm Beta` — quà tri ân beta
 * (D68b), **đã bị gỡ khỏi hộp gacha từ 04/08** nên không ai mua được nó bằng T —
 * vẫn bán lại được cho Hệ thống ở giá epic **600 T**. Đó là 30% quỹ chợ trong
 * một cú bấm, cho một món chưa từng có đồng T nào đi vào.
 *
 * Và `HOP_GACHA` đã viết sẵn lý do bằng đúng chữ ấy từ 04/08:
 *   *"`st_niem_beta` rời khỏi đây vì từ 04/08 nó là QUÀ BETA, **không bán không
 *   quay** (D68b)."*
 * Luật có rồi, cửa bán chỉ không hỏi. `HE_THONG_MUA_LAI_DOC_BAN = false` cũng đã
 * chốt từ D258 và nằm ở `config/battle_pass.ts` — nhưng nó là một hằng số **chưa
 * ai đọc**, tức một công tắc không nối vào đâu.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VÌ SAO HỎI `HOP_GACHA` CHỨ KHÔNG TỰ DỰNG DANH SÁCH THỨ HAI
 *
 * Câu hỏi "món này có cửa nào tốn T để lấy không" đã có đúng một nguồn chân lý
 * trong repo: **`HOP_GACHA`** — *"nguồn chân lý DUY NHẤT cho câu hỏi hộp có thể
 * trả ra gì"*. Món nằm trong hộp ⇒ có người đã đốt 100 T/lượt để lấy ⇒ mua lại
 * là trả bằng tiền đã thu. Món KHÔNG nằm trong hộp ⇒ nó tới bằng quà, battle
 * pass, hay tay admin ⇒ chưa đồng nào đi vào.
 *
 * Dựng một danh sách "món cấm bán" riêng ở đây là bản sao thứ hai của cùng một
 * sự thật, và bản thứ hai SẼ trôi (D61/A11.5) — đúng vào mùa thêm món.
 *
 * ⚠ KHÔNG dùng `cosmetic_items.nguon_cua` của DB: prod đang ghi
 * `st_niem_beta.nguon_cua = 'gacha_t'` trong khi CODE đã loại nó khỏi hộp. Cột
 * đó lạc hậu so với `HOP_GACHA`, và tin nó là tin đúng cái đã sai.
 *
 * ⚠ KHÔNG dùng `vat_pham_ban_the.nguon` (nguồn từng BẢN THỂ): nghe hợp lý hơn
 * nhưng cả 4 bản thể trên prod đều mang `di_tru` — di trú không dựng lại được
 * quá khứ. Một luật đọc trường đó hôm nay sẽ đóng cửa với **mọi** món đang có.
 *
 * ⇒ Luật theo MẪU, không theo bản thể. Hệ quả có ý: nó đúng cả với bản thể mà
 *   di trú đã mất dấu, và nó không cần một cột dữ liệu mới nào.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ E24 KHÔNG CẤM MÓN ĐỘC QUYỀN GIAO DỊCH
 *
 * `kien-truc-ky-thuat.md` §7.16 nói rõ: E24 chỉ nói **giá Hệ thống TRẢ cho một
 * món phát miễn phí là câu hỏi RIÊNG, có nguồn riêng** — không mượn đường giá
 * của món đã bán. Nên đây chặn đúng một chiều: Hệ thống không TRẢ TIỀN cho nó.
 * Chiều Hệ thống BÁN RA một món như thế (nếu có trong kho) không bị chặn, và
 * chuyện đó cũng không xảy ra được hôm nay vì kho chỉ có hàng do mua vào.
 *
 * Bật `HE_THONG_MUA_LAI_DOC_BAN = true` là mở lại — và lúc đó phải kèm một
 * nguồn giá riêng, không phải bậc hiếm. Con số ép ra quyết định (D258): 3.000
 * bản × 600 T = 1.800.000 T quyền đòi trên một nền kinh tế có 1.020.000 T.
 */
import { HE_THONG_MUA_LAI_DOC_BAN } from '../../config/battle_pass.js';
import { HOP_GACHA } from '../sandbox/ung_vien.js';

/** Mã lý do — máy đọc; chữ hiển thị ở client (D26). */
export type LyDoKhongMuaLai = 'khong_ban_lai';

/** Id mọi món có cửa tốn T để lấy. Suy ra từ `HOP_GACHA`, không khai lần hai. */
const CO_CUA_TRA_TIEN: ReadonlySet<string> = new Set(HOP_GACHA.map((m) => m.id));

/**
 * Hệ thống có TRẢ TIỀN mua lại mẫu này không.
 *
 * `true` khi mẫu có một cửa tốn T để lấy (đang nằm trong hộp gacha), hoặc khi
 * founder đã bật `HE_THONG_MUA_LAI_DOC_BAN`. Ngoài ra: `false` — fail-closed,
 * vì cái giá của việc đoán sai theo chiều "mua" là tiền thật rời quỹ.
 */
export function heThongMuaLai(mauId: string): boolean {
  if (HE_THONG_MUA_LAI_DOC_BAN) return true;
  return CO_CUA_TRA_TIEN.has(mauId);
}

/** Lý do từ chối, hoặc `null` khi mẫu này mua lại được. */
export function lyDoKhongMuaLai(mauId: string): LyDoKhongMuaLai | null {
  return heThongMuaLai(mauId) ? null : 'khong_ban_lai';
}
