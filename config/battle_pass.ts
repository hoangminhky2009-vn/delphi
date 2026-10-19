/**
 * BATTLE PASS MÙA — "battle pass cho T và vật phẩm độc quyền mỗi mùa"
 * (founder 05/09/2026, D257).
 *
 * File này là CÂY CẦU giữa `config/progression.ts` (lịch, chặng — không biết gì
 * về tiền) và `config/economy.ts` (tiền — không biết gì về lịch). Nó là chỗ DUY
 * NHẤT hai tầng đó gặp nhau, nên nó cũng là chỗ duy nhất phải trả lời câu
 * "một chặng đáng bao nhiêu T".
 *
 * ⚠ `T_MOI_CHANG` CÒN `null` VÀ ĐÓ LÀ TRẠNG THÁI ĐÚNG HÔM NAY (A8.2/A11.8).
 * Agent không đặt tham số kinh tế. `null` ⇒ vòi ĐÓNG (fail-closed): tầng phát
 * phải TỪ CHỐI phát T chứ không được coi null là 0 rồi im lặng phát 0 T — im
 * lặng là cách một quyết định chưa có bị đọc nhầm thành một quyết định đã có.
 * Cùng khuôn `GIA_BAN_SAO_THEM` của `config/avatar.ts` (D36).
 */
import { MUA_0_0 } from './progression.js';

export const BATTLE_PASS = {
  /**
   * T mỗi chặng. ✔ **FOUNDER CHỐT 05/09/2026: 2** (*"Để 2 đi"*), sau khi nhìn
   * bảng ở `npm run kinh-te:sim`:
   *   · 60 (thang Q cũ) ⇒ mỗi bản độc quyền phải qua chợ ~50 lượt/mùa — vô lý;
   *   · 2               ⇒ ~2 lượt/bản/mùa, và ở nhịp đó battle pass **tự nuôi
   *     được**, còn dư (D258).
   *
   * Cả mùa một người nhận 2 × 30 = **60 T**, tức 6% vốn khởi điểm 1.000 T. Đây
   * là mức **tượng trưng có chủ ý** — battle pass trả sự công nhận là chính
   * (A11.11), T chỉ để nó chạm được vào nền kinh tế.
   */
  T_MOI_CHANG: 2 as number | null,

  /** Số chặng — LẤY từ lịch mùa, không chép lại (D61/A11.5). */
  SO_CHANG: MUA_0_0.SO_CHANG,

  /**
   * Số MẪU độc quyền phát mỗi mùa. Mùa 0.0 hiện có 3 mốc `doc_ban: true`
   * (`CHANG_LO_TRINH`), nên đây là phép ĐẾM một danh sách đã có, không phải một
   * con số mới. Đổi bảng chặng thì test đối chiếu sẽ đỏ.
   */
  SO_MAU_DOC_BAN: 3,
} as const;

/**
 * ⚠⚠ KHÔNG PHẢI THAM SỐ — ĐÂY LÀ BẤT BIẾN E24, VÀ ĐẢO NÓ LÀ ĐẢO DẤU CẢ CƠ CHẾ.
 *
 * Vật phẩm độc quyền phát MIỄN PHÍ **không vào cửa mua-vào của Hệ thống ngang
 * giá món đã trả tiền**.
 *
 * Bất đối xứng nằm ở phía TIỀN VÀO, không ở phía vật phẩm: món gacha có T đi vào
 * trước khi nó tồn tại (giá lượt quay), nên mua lại là trả bằng tiền đã thu. Món
 * battle pass không có đồng nào đi vào, mà quyền bán lại thì y hệt.
 *
 * Con số ép ra quyết định: 3.000 bản ở giá epic 600 T = **1.800.000 T quyền đòi**
 * trên một nền kinh tế 1.000 người chỉ có **1.020.000 T tồn tại**. Quyền đòi lớn
 * hơn TOÀN BỘ cung tiền (176%). A3.4 cấm mint, nên đây không phải "quỹ mỏng" —
 * là **không thể trả về mặt số học**, và `audit:supply` vẫn CÂN suốt quá trình
 * đó: sổ không biết đếm lời hứa, nó chỉ đếm tiền.
 *
 * ⚠ Cờ này KHÔNG nói món độc quyền cấm giao dịch. Nó vẫn là tài sản khan hiếm
 * làm chợ quay, và phí trên vòng quay đó chính là thứ trả cho T của battle pass.
 * Nó chỉ nói: giá Hệ thống trả cho một món phát miễn phí phải là một câu hỏi
 * RIÊNG, có nguồn riêng — không mượn đường giá của món đã bán.
 */
export const HE_THONG_MUA_LAI_DOC_BAN = false;

/**
 * CỔNG FAIL-CLOSED cho vòi T của battle pass.
 *
 * Tầng phát PHẢI đi qua đây thay vì đọc thẳng `BATTLE_PASS.T_MOI_CHANG`. Lý do:
 * đọc thẳng thì `null` rất dễ trôi thành `?? 0` ở một chỗ nào đó, và "phát 0 T"
 * trông y hệt "vòi đang đóng" cho tới ngày ai đó đổi mặc định. Ném lỗi thì một
 * quyết định chưa có không bao giờ giả trang thành một quyết định đã có.
 */
export function tMoiChangDaChot(): number {
  const v = BATTLE_PASS.T_MOI_CHANG;
  if (v === null) {
    throw new Error(
      'battle pass: T_MOI_CHANG chưa chốt (A8.2) — vòi T đóng, không phát đồng nào',
    );
  }
  return v;
}
