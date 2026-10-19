/**
 * ═══ LƯỢC BỎ v54 (D389, founder 23/09) — danh sách thứ RỜI khỏi trận ở `balance-v54-ngare` ═══
 *
 * Founder: *"Tôi nghĩ nên lược bỏ bớt vài tính năng trong gameplay đang bị thừa, phức tạp hoá
 * mà không có nhiều giá trị data cũng như là vài lá chiến thuật"* → chốt *"Bỏ phần kỳ ngộ,
 * khẩu vị rủi ro và quỹ vòng, giữ cỡ bàn 16, giữ bán khống"* → *"phần cắt còn mở rộng ra các
 * lõi và thẻ sự kiện mà bạn đề xuất"*. Quỹ vòng sau đó được GIỮ lại (gate G1 đỏ khi bỏ nó —
 * D389): founder *"Giữ quỹ vòng nhưng làm nó không còn khó hiểu"*.
 *
 * Phép thử dùng để chọn cắt: GIỮ thứ tạo ra một quyết định có nghĩa ngoài đời (tức dữ liệu
 * hành vi) hoặc làm câu chuyện của chợ đọc được; CẮT thứ chỉ thêm luật phải học, trùng việc
 * với thứ khác, đo ra không ai dùng — hoặc làm bẩn chính phép đo.
 *
 * ⚠ CẮT = TẮT Ở KHOÁ MỚI, KHÔNG XOÁ CODE: trận ≤ v53 phải replay đúng từng chip, nên mọi
 * nhánh cũ còn nguyên; cờ ở `config/holdem_balance.ts` (`loiGon` · `khauViTat` · `vonDeu` ·
 * `chiBan16` · `kyNgo` · `duoiTelegraph` · cụm đám đông).
 */
import type { ChienThuatId } from './holdem.js';
import { luatCua } from './holdem_balance.js';

/**
 * SÁU LÕI rời shop dưới cờ `loiGon`. Còn lại năm lá HÀNH ĐỘNG: Mua Đuổi · Bắt Đáy · Đòn Bẩy ·
 * Lướt Sóng · Bán Khống (founder giữ Bán Khống 23/09).
 *   · Chia Lệnh — chỉ cho mốc lệnh mịn; D59 đo lãi ở 100% số seed: bữa trưa miễn phí.
 *   · Khớp Nhanh — "phí rẻ" thuần; D59 cũng đo lãi ở 100% số seed.
 *   · Đa Dạng Hoá — trả thưởng theo SỐ MÃ đang cầm, tức thưởng đúng trục khẩu vị đang đo
 *     (luật §1.2 cấm); D371 đo bộ số cũ của nó trị giá bằng 0.
 *   · Đi Ngược — "thấy đối thủ chọn gì", mà đối thủ là bot ⇒ đọc người thành đọc code bot.
 *   · Phòng Hộ — trùng việc Chặn Lỗ, kéo theo cả rủi ro đối tác (một ca "mắt xích rơi nhầm chỗ").
 *   · Chặn Lỗ — D394 (founder 24/09): *"Bỏ chặn lỗ đi, sau này chúng ta cho nó thành tính năng trait"*.
 *     Kỷ luật cắt lỗ là thứ mang theo CẢ TRẬN, không phải công cụ của một vòng.
 */
export const LOI_BI_CAT: readonly ChienThuatId[] = [
  'chia_lenh', 'khop_nhanh', 'da_dang_hoa', 'di_nguoc', 'phong_ho', 'chan_lo',
];

/**
 * CỠ BÀN DUY NHẤT dưới cờ `chiBan16` (founder 23/09: *"16 thành cỡ duy nhất"*). 16 ô ≈ 8 năm theo
 * thang 1 ô = 6 tháng — đủ dài cho ~1,3 vòng mùa của bánh xe (`config/banh_xe_mua.ts`). Bàn tập
 * và bàn chung giữ cỡ riêng đã lưu; bàn buổi đo ghim đề riêng (`config/holdem_de.ts`).
 */
export const CO_BAN_DUY_NHAT = 16;

/**
 * CỠ BÀN DUY NHẤT dưới cờ `chiBan12` (D457 — khoá v57 minigame, bước 2; founder 03/10 chọn A: *"bàn 12 lá"*). Đây là SỐ Ô của
 * bản đồ; vì ô đầu là ô mở màn lật sẵn (`o_up`, `soVong`) nên bàn 12 ô chạy **11 vòng**, 10 vòng có lõi để chơi minigame. Cỡ 12 đã
 * sống sẵn: có trong `CO_MAP_CHON` và CHECK của DB (migration 0023), `vongChonChienThuat(12)` = 2·4·6, bàn tập chạy nó, và vai chỉ
 * được bốc ở bàn ≥ 12. ⚠ Không dùng 13 ô để có đủ 12 vòng: phải sửa CHECK của DB và dựng cỡ chưa từng chạy.
 */
export const CO_BAN_MINIGAME = 12;

/**
 * D526 — CỠ BÀN của NHỊP XEN KẼ (cờ `nhipXenKe`, khoá v58; founder 05/10: *"8 ô"* sau khi chê *"12 ô thì bị bão hòa"*). 8 ô = 7 vòng
 * (`o_up`): năm màn minigame + ba chợ trait theo `NHIP_XEN_KE[8]`. Cỡ 8 có sẵn trong `CO_MAP_CHON` và CHECK của DB (0023).
 */
export const CO_BAN_XEN_KE = 8;

/** D550 — cỡ bàn trận thật của khoá v63 (cờ `ban14`): 14 ô · 13 vòng, lịch `NHIP_XEN_KE[14]`. */
export const CO_BAN_14 = 14;

/**
 * D526 — CỠ BÀN GHIM của một bộ luật (MỘT nguồn cho ba cửa: tạo trận · catalog sảnh · bàn chung). Thứ tự ưu tiên giữ đúng chỗ chọn cỡ cũ:
 * `nhipXenKe` (8) trước `chiBan12` (12) trước `chiBan16` (16). `null` = luật cho chọn cỡ trong `CO_MAP_CHON`.
 * ⚠ Trước D526 catalog và bàn chung chỉ hỏi `chiBan16` — khoá v57 (`chiBan12`) mà lên mặc định thì sảnh mời 8/12/16 trong khi server dựng 12.
 */
export function coBanGhim(luat: { ban14?: boolean; nhipXenKe?: boolean; chiBan12?: boolean; chiBan16?: boolean }): number | null {
  // D550 — `ban14` đứng TRƯỚC `nhipXenKe` (v63 mang cả hai: 14 ô chạy nhịp xen kẽ của cỡ 14).
  if (luat.ban14) return CO_BAN_14;
  return luat.nhipXenKe ? CO_BAN_XEN_KE : luat.chiBan12 ? CO_BAN_MINIGAME : luat.chiBan16 ? CO_BAN_DUY_NHAT : null;
}

/**
 * KHOÁ LUẬT CỦA BÀN TẬP khi mặc định mang bánh xe (D389). Kịch bản CoachTap kể từng ô của bàn
 * tập 12 ô seed ghim — dãy ô sinh bằng máy cũ. Bánh xe (`banhXe`) sinh dãy ô KHÁC trên cùng seed
 * ⇒ Oracle kể một bàn không tồn tại (đúng lỗi D302). Chừng nào chưa có bàn tập viết cho bánh xe,
 * bàn tập chạy khoá cuối cùng TRƯỚC bánh xe dù mặc định là gì.
 * ⚠ Đây là lưới an toàn, không phải đích: "cơ chế mới phải dạy TRONG màn tập" — lật v54 thành
 * mặc định mà bàn tập vẫn dạy luật v53 (kỳ ngộ · khẩu vị · quỹ vòng) là dạy sai trò.
 * Hôm nay mặc định là v53 ⇒ hàm trả đúng mặc định, không đổi gì.
 */
export const KHOA_BAN_TAP_TRUOC_BANH_XE = 'balance-v53-upo';

export function khoaBanTap(macDinh: string): string {
  return luatCua(macDinh).banhXe ? KHOA_BAN_TAP_TRUOC_BANH_XE : macDinh;
}
