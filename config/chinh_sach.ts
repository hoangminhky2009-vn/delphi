/**
 * CHÍNH SÁCH TIỀN TỆ — tham số của Kho bạc khi nó làm ngân hàng trung ương
 * (founder 05/09: *"thiết kế sao để sau này kho bạc thành một ngân hàng trung
 * ương điều phối thị trường"*).
 *
 * ⚠⚠ MỌI SỐ Ở ĐÂY LÀ PLAYTEST-TUNE (A8.2/A11.8). Chúng tồn tại để property test
 * có miền mà quét — **không phải để deploy**. Cờ chính sách đang tắt.
 *
 * ─── HAI THỨ TUYỆT ĐỐI KHÔNG ĐƯỢC LÀM CÔNG CỤ ──────────────────────────────
 *  1. **Mint T.** A3.4, A11.17 — không dẻo. Ngân hàng trung ương này không có
 *     máy in; nó chỉ đổi ĐIỀU KIỆN T di chuyển, không bao giờ tạo T.
 *  2. **Khuôn rake 3% đốt + 2% Kho bạc.** D16 §6 gọi đó là "hằng số niềm tin";
 *     người chơi đã quen con số đó, vặn nó là đổi một lời hứa chứ không phải
 *     điều tiết. Nó nằm ở `config/economy.ts` và KHÔNG được import vào đây như
 *     một biến điều khiển.
 *
 * Trợ cấp cũng không phải công cụ: nó là một cái SÀN cho người cạn ví (A4), và
 * biến sàn an sinh thành cần gạt vĩ mô là đúng thứ A10 cấm — lấy ví của người
 * chơi làm nút vặn.
 */

/**
 * Phiên bản LUẬT chính sách. Đổi luật = đổi chuỗi này, đúng nếp `balance_version`.
 * D196: cấm nhúng D-số / ngày / tên mùa vào chuỗi phiên bản.
 *
 * ⚠ Khi luật này lần đầu ghi vào dữ liệu prod, nó phải được đăng ký thành một
 * trục trong `config/phien_ban.ts` (sổ 14 trục). Chưa ghi gì ⇒ chưa đăng ký.
 */
export const CHINH_SACH_VERSION = 'nhtw-v1-luat';

/**
 * RỔ HÀNG của chỉ số giá — **CỐ ĐỊNH, có phiên bản**.
 *
 * Rổ đổi giữa chừng thì chỉ số mất nghĩa xuyên thời gian: hai lần đo không còn
 * so được với nhau, mà cả điểm của một ngân hàng trung ương là so được qua thời
 * gian. Đổi rổ = `VERSION` mới + một chuỗi số mới bắt đầu từ đầu, KHÔNG nối vào
 * chuỗi cũ. Cùng luật với trục phiên bản đã vào prod (D196).
 */
/**
 * Phiên bản RỔ. Tách thành hằng số EXPORT riêng chứ không nằm trong đối tượng —
 * bài quét `tests/phien_ban.test.ts` chỉ nhìn hằng EXPORT viết hoa, nên một
 * trường `VERSION` lồng bên trong sẽ **đi lọt im lặng**, đúng kiểu trôi mà sổ
 * đăng ký sinh ra để chặn (D169).
 */
export const RO_HANG_VERSION = 'ro-v1';

export const RO_HANG = {
  /**
   * Tồn kho THAM CHIẾU, cố định. Nếu lấy tồn kho thật thì chỉ số nhảy mỗi khi
   * kho đầy/vơi, và ta không còn phân biệt được "giá đổi vì chính sách" với
   * "giá đổi vì hôm nay nhiều người bán".
   */
  TON_KHO_THAM_CHIEU: 0,
  /** Trọng số theo bậc, tổng đúng 10.000 bp. Soi theo tỷ lệ rơi 70/25/5. */
  TRONG_SO_BP: { thuong: 6_000, hiem: 3_000, epic: 1_000 } as Record<string, number>,
} as const;

export const CHINH_SACH = {
  /** Chỉ số mục tiêu. 10.000 bp = đúng mức gốc (chỉ số 100). */
  MUC_TIEU_BP: 10_000,

  /**
   * BIÊN ĐỘ CHỊU ĐƯỢC — trong biên thì KHÔNG đổi gì.
   *
   * Đây không phải sự lười: một luật phản ứng không có vùng chết sẽ rung
   * (đổi → chỉ số đổi → đổi ngược), và một nhà điều tiết rung là một nhà điều
   * tiết bị người chơi học thuộc rồi đánh cược vào. Cùng vai với trễ 20/25 của
   * cờ G2 (E9 — "không nhấp nháy").
   */
  BIEN_DO_BP: 500,

  /** Bước đổi TỐI ĐA một kỳ. Trần tốc độ, để một cú đo lệch không lật cả chợ. */
  BUOC_TOI_DA_BP: 500,

  /**
   * Chặn dưới / chặn trên của công cụ `hs_quy_bp`.
   *
   * ⚠ SÀN KHÔNG PHẢI SỐ TỰ CHỌN — nó SUY RA từ luật thang giá (founder 05/09:
   * tiêu dùng phổ biến 10–100 T). Món rẻ nhất trong rổ (bậc thường, kho đầy) có
   * giá `60 × 0,5 × hs_quy`; muốn nó không tụt dưới sàn 10 T thì hs_quy phải
   * ≥ 3.334. Đặt 3.400 cho có biên. Bản trước là 3.000 và nó cho ra **9 T** —
   * dưới sàn. `tests/thang_gia.test.ts` tính lại ngưỡng đó và so, nên sửa
   * thang giá mà quên sửa đây thì đỏ.
   */
  HS_QUY_SAN_BP: 3_400,
  HS_QUY_TRAN_BP: 10_000,

  /**
   * Hệ số phản ứng: lệch 1 bp so với mục tiêu thì vặn công cụ bao nhiêu bp.
   * 10.000 bp = phản ứng 1:1. Dưới 10.000 = phản ứng dè dặt (khuyến nghị).
   */
  HE_SO_PHAN_UNG_BP: 5_000,
} as const;
