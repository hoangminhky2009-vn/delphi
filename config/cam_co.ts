/**
 * CẦM CỐ — "cơ chế thế chấp để vay mượn ngân hàng T" (founder 05/09/2026).
 *
 * ─── ⚠⚠ CẦM CỐ, KHÔNG PHẢI VAY NỢ. RANH NÀY LÀ CẢ THIẾT KẾ ────────────────
 *
 * Founder đã chốt trước đó, cho công cụ "liều mạng" ở đấu giá:
 *   *"Liều mạng ko bao gồm vay nợ, chỉ có mất cọc, bỏ quyền hoặc all-in."*
 *
 * Cơ chế ở đây **không mâu thuẫn với câu đó**, và lý do là một tính chất chứ
 * không phải một cách gọi tên:
 *
 *   · **cầm cố** — đưa vật, nhận T. Không chuộc thì **mất vật, HẾT**. Nghĩa vụ
 *     không bao giờ lớn hơn thứ đã đưa. Đây đúng là "mất cọc" mà founder cho phép.
 *   · **vay nợ**  — nhận T rồi CÒN NỢ. Có số dư âm, có gọi ký quỹ, có đòi thêm,
 *     có lãi cộng dồn. **Không có gì trong file này tạo ra được hình dạng đó.**
 *
 * Ranh giới đó được canh bằng ba bất biến E31–E33, không bằng lời dặn.
 *
 * ─── VÌ SAO NÓ LÀ MỘT CÔNG CỤ NGÂN HÀNG TRUNG ƯƠNG THẬT ───────────────────
 * Đây chính là **nghiệp vụ chiết khấu / repo**: ngân hàng trung ương cho vay có
 * bảo đảm, với một **haircut**. `LTV_BP` chính là haircut đó, và nó là **đòn bẩy
 * thứ ba** bên cạnh `hs_quy_bp` và spread — hạ LTV là thắt, nâng LTV là nới.
 * Rủi ro của Hệ thống khi giá vật rơi đúng bằng phần haircut chưa phủ, y hệt
 * ngoài đời. Đó là nội dung dạy được, không phải một chi tiết kỹ thuật.
 *
 * ⚠ A10 — MÔ TẢ ĐƯỢC, KÊ ĐƠN KHÔNG. Giao diện phải hiện **số** (nhận bao nhiêu,
 * chuộc lại bao nhiêu, hạn ngày nào) và tuyệt đối không có câu mời gọi kiểu
 * "vay ngay". Chi phí thanh khoản là thứ để người chơi TỰ nhìn thấy.
 *
 * ⚠⚠ MỌI SỐ Ở ĐÂY LÀ PLAYTEST-TUNE (A8.2). Cờ đang tắt, chưa nối vào cửa nào.
 */

export const CAM_CO = {
  /**
   * Cho vay bao nhiêu phần trăm giá Hệ thống mua vào. **BẮT BUỘC < 10.000 bp.**
   *
   * Dưới 100% không phải để Hệ thống ăn dày: nếu ≥ 100% thì cầm cố rồi bỏ luôn
   * sẽ TỐT HƠN bán thẳng, và lúc đó cửa cầm cố trở thành một cửa bán giá cao
   * hơn cửa bán — tức một máy in tiền đội lốt dịch vụ (E31).
   */
  LTV_BP: 6_000,

  /**
   * Phí chuộc lại, tính MỘT LẦN trên số đã vay, **CHỐT NGAY LÚC CẦM**.
   *
   * ⚠ KHÔNG phải lãi suất, và khác biệt đó là ranh giữa cầm đồ và bẫy nợ: lãi
   * cộng dồn theo thời gian là thứ biến một khoản nhỏ thành một khoản không trả
   * nổi. Ở đây số phải trả **in ra ngay lúc vay và không đổi một đồng nào** cho
   * tới hạn (E33).
   */
  PHI_CHUOC_BP: 1_000,

  /** Hạn chuộc, tính bằng ngày. Quá hạn ⇒ vật thuộc Hệ thống, nghĩa vụ CHẤM DỨT. */
  HAN_NGAY: 7,

  /**
   * Trần số vật một người cầm cùng lúc. Không phải để chống gian lận — để chống
   * chính người chơi dồn cả kho vào một cú, đúng tinh thần A10.
   */
  TRAN_MOI_NGUOI: 3,
} as const;

/** Mẫu số bp dùng chung. */
export const CAM_CO_BP = 10_000;
