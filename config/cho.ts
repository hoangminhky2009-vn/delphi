/**
 * THAM SỐ ĐỊNH GIÁ CHỢ — bước B6 (`docs/thiet-ke-de-xuat/kinh-te/
 * kien-truc-ky-thuat.md` §9). Tầng T0.
 *
 * ⚠⚠ MỌI CON SỐ Ở ĐÂY LÀ **PLAYTEST-TUNE**, KHÔNG MỘT SỐ NÀO ĐÃ CHỐT (A8.2/
 * A11.8). Chúng tồn tại để `economy_sim` có cái mà quét và để property test có
 * miền mà chạy — **không phải để deploy**. Founder chốt sau khi đo.
 *
 * Hai ngoại lệ, và chỉ hai: `PHI_DOT_BP` + `PHI_KHO_BAC_BP` = 300 + 200 bp. Đó
 * **không phải số mới** — đó là khuôn rake của A4 (`RAKE_BURN_BP`/
 * `RAKE_TREASURY_BP`), và file này IMPORT chứ không chép (D61). D16 §6 gọi nó là
 * "hằng số niềm tin": người chơi đã quen 3%+2%, đổi hình dạng đó là đổi một lời
 * hứa, không phải vặn một tham số.
 *
 * ⚠ CHƯA NỐI VÀO CỬA NÀO. B6 cố ý chỉ dựng hàm thuần + property test; cửa giao
 * dịch là B7. Có hàm giá không có nghĩa là chợ đã mở.
 */
import { ECONOMY } from './economy.js';

/** Mẫu số basis point. */
export const CHO_BP = 10_000;

/** Phí mỗi giao dịch với Hệ thống — GIỮ NGUYÊN khuôn rake, không đặt số mới. */
export const PHI = {
  DOT_BP: ECONOMY.RAKE_BURN_BP,
  KHO_BAC_BP: ECONOMY.RAKE_TREASURY_BP,
} as const;

export const CHO = {
  /**
   * Giá gốc theo bậc hiếm — điểm neo trước mọi hệ số. PLAYTEST-TUNE.
   * Ba bậc lấy đúng tên bậc gacha đang chạy (`GACHA_RATES_BP` 70/25/5).
   */
  GIA_GOC: { thuong: 60, hiem: 180, epic: 600 } as Record<string, number>,

  /**
   * Hệ số TỒN KHO: kho Hệ thống càng đầy thì mua vào càng rẻ (bonding curve).
   * Bậc thang TRA BẢNG, không luỹ thừa — luỹ thừa số nguyên đòi quy ước làm tròn
   * từng bước, và floor-từng-bước ≠ floor-cuối ⇒ hai cài đặt lệch âm thầm
   * (C5 + D61). Chỉ số = số món cùng mẫu đang nằm trong kho Hệ thống.
   */
  HS_TON_KHO_BP: [10_000, 9_000, 8_000, 7_000, 6_000, 5_000] as const,

  /** Spread mua/bán. Hệ thống bán ra đắt hơn mua vào — nguồn nuôi quỹ chợ. */
  SPREAD_BP: 2_000,

  /**
   * Hệ số QUỸ: quỹ chợ cạn thì giá MUA VÀO tụt, tới 0 thì **cửa mua vào ĐÓNG**
   * (D65 — fail rõ, không treo). `gia_san = 0` là một trạng thái hợp lệ và có
   * nghĩa: "Hệ thống hiện không mua". Nó KHÔNG phải "món này vô giá trị".
   */
  HS_QUY_BP_MAC_DINH: 10_000,

  /** Bán lại vé cho Hệ thống (§7.11.4). Đôi với độ dốc bậc thang — chốt CÙNG nhau. */
  VE_BAN_LAI_BP: 6_000,

  /**
   * Bậc thang giá VÉ ĐĂNG CAI. **Số bậc CHÍNH LÀ trần vé của phiên** — không có
   * `min()` kẹp ở cuối, vì kẹp nghĩa là qua bậc cuối thì nguồn cung vô hạn ở một
   * giá phẳng, tức hết khan hiếm (founder bác 05/09, D246 §7.11.2).
   */
  VE_DANG_CAI_BAC: [100, 120, 150, 190, 240, 300, 380, 480] as const,

  /** Vé ĐẤU: rẻ và nhiều, đường cong rất thoải — nó là bảng số cầm tay, không phải suất. */
  VE_DAU_BAC: [10, 12, 14, 16, 18, 20] as const,
} as const;

/** Tham số gacha dùng cho phép tính kỳ vọng (§8 `nen-kinh-te-app.md`). */
export const GACHA_EV = {
  /** Tỷ lệ epic công khai: 5%. Chép từ bảng rate 70/25/5 đang chạy. */
  RATE_EPIC_BP: 500,
  /** Pity: lượt thứ N kể từ epic gần nhất đảm bảo ra epic. */
  PITY: 20,
} as const;

/** Tổng số bậc vé đăng cai = trần vé mỗi phiên. Suy ra, không khai riêng. */
export const TRAN_VE_DANG_CAI = CHO.VE_DANG_CAI_BAC.length;

/**
 * THANG GIÁ TIÊU DÙNG PHỔ BIẾN — founder 05/09/2026:
 * *"đơn vị T tiêu dùng phổ biến phải là từ 10-100 nhé. Chứ thấp quá thì nhìn ko đã."*
 *
 * ⚠ Đây là một luật về **CẢM GIÁC**, và nó là một yêu cầu thật chứ không phải
 * thẩm mỹ suông: một nền kinh tế mà mọi thứ giá 3–7 T thì con số thôi mang
 * thông tin — người chơi không phân biệt được đắt với rẻ, và mọi phép so sánh
 * (thứ ta muốn ĐO) trở thành nhiễu làm tròn.
 *
 * Luật này áp cho **những giá người chơi gặp thường xuyên**, KHÔNG áp cho thứ
 * cố ý khan hiếm (epic, vé đăng cai) — khan hiếm mà rẻ thì không còn khan hiếm.
 * Danh sách đóng + bài canh: `tests/thang_gia.test.ts`.
 *
 * ⚠⚠ Luật này kéo theo một hệ quả KHÓ, đã đo: ở thang 10–100 thì **phí 2% chạm
 * 0 với mọi giao dịch dưới 50 T** (làm tròn xuống). Xem `tests/thang_gia.test.ts`
 * và câu hỏi treo ở `docs/thiet-ke-de-xuat/kinh-te/ngan-hang-trung-uong.md` §11.
 */
export const THANG_TIEU_DUNG = { SAN: 10, TRAN: 100 } as const;
