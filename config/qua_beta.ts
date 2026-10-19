/**
 * QUÀ TRI ÂN MÙA BETA 0.0 — tham số, founder chốt 04/08 (D68b).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * VÌ SAO QUÀ NÀY CÓ ĐIỀU KIỆN, VÀ VÌ SAO ĐIỀU KIỆN LÀ PHẦN QUAN TRỌNG NHẤT
 *
 * Founder, nguyên văn: *"phải làm xong hết nhiệm vụ cơ bản và chơi 3 trận mới
 * được nhận quà beta nhé chứ cứ đăng nhập mà nhận thì toang"*.
 *
 * Đây không phải làm khó người chơi. Kho bạc có 20.135 T và **không đúc thêm
 * được** (A3.4 — `genesis_grant` khoá bằng unique partial index, chạy đúng một
 * lần mỗi môi trường). Quà phát cho tài khoản chỉ-đăng-nhập nghĩa là ai đó mở
 * 30 tài khoản là rút sạch phần dành cho người thật, mà `treasury_ledger` có
 * `CHECK balance_after >= 0` nên khi cạn thì lệnh cấp **FAIL CỨNG** — người thứ
 * N nhận LỖI thay vì quà. Điều kiện là thứ giữ cho chuyện đó không xảy ra.
 *
 * Điều kiện đọc từ DẤU VẾT ĐÃ CÓ (`nhiem_vu_xong` + `holdem_results`), không
 * thêm một hook nào vào luồng khác — cùng kỷ luật `server/nhiem_vu.ts`, và cùng
 * lý do: hook mới là chỗ "quên gọi", tức mầm của cơ chế trang trí.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BỐN MÓN, HAI BẢN CHẤT — KHÔNG ĐƯỢC GỘP (D68b)
 *
 * D64: mùa reset gần hết mọi thứ TRỪ danh tính và sở hữu. Nên:
 *   · T và Q là NGÂN SÁCH THỬ NGHIỆM — bị nén cuối mùa là ĐÚNG, đó là tiền.
 *   · Dấu niêm Beta là phần TRI ÂN thật — cosmetic, không bao giờ phát lại.
 * Một món tri ân mà bốc hơi lúc reset mùa thì thôi là tri ân. Ghi ra đây để
 * mùa sau không ai "dọn dẹp" bằng cách gộp bốn món vào một khoản tiền.
 */

/** Tham số quà — founder chốt 04/08. Đổi số phải qua founder (A8.2). */
export const QUA_BETA = {
  /**
   * T rút từ KHO BẠC (không đúc — A3.4).
   *
   * Phép chia founder đã cân: 500 T × 30 người = 15.000 / 20.135 T kho, còn
   * ~5.000 T cho trợ cấp ngày (50 T/người) và seed thanh khoản kèo.
   * ⚠ Ở `GACHA.COST_T = 100` thì 500 T = 5 lượt quay, mà pity cần 20 lượt ⇒
   * ~23% người beta sẽ thấy cửa `epic`. Founder biết và chọn giữ giá 100.
   */
  T: 500,
  /** Q phát mới (không rút kho bạc — Q có vòi riêng ở lộ trình mùa). */
  Q: 500,
  /**
   * Thẻ tạo phòng.
   *
   * ⚠ TẠO PHÒNG ĐANG KHOÁ Ở SẢNH. Founder chọn phát dù đã đọc cảnh báo đó, nên
   * màn BẮT BUỘC ghi rõ "dùng được khi cửa mở" — một tấm vé cho cánh cửa chưa
   * mở mà không chú thích là đúng thứ A8.9 cấm.
   */
  THE_PHONG: 3,
  /**
   * Trần số người nhận. PHẢI CÓ, và phải kiểm ATOMIC.
   *
   * Không trần thì người thứ N gặp `CHECK balance_after >= 0` của kho bạc và
   * nhận một lỗi 500 thay vì lời từ chối tử tế. Con số 30 khớp trần 150 người
   * của Discord Activity chưa verify (D64) và vừa ngân sách kho.
   */
  TRAN_NGUOI: 30,
  /** Vật phẩm tri ân — chuyển từ cửa gacha sang đây (D68b). */
  STICKER_ID: 'st_niem_beta',
} as const;

/**
 * ĐIỀU KIỆN NHẬN — founder 04/08.
 *
 * `VIEC_LOI` = bốn việc lõi của roster tuần (`config/progression.ts`): điểm danh
 * 4 ngày · xem 1 câu hỏi dự báo · chơi xong 1 phiên · mở lại 1 câu đã chốt.
 * Đòi ĐỦ BỐN, tính trên CẢ MÙA (không bắt xong trong cùng một tuần) — mục đích
 * là chặn tài khoản rỗng, không phải bắt cày liên tục.
 *
 * `SO_TRAN` đếm `holdem_results`, tức trận ĐÃ XONG. Việc lõi `mot_tran` chỉ đòi
 * 1 phiên nên con số 3 ở đây là ràng buộc THÊM, không trùng lặp.
 */
export const DIEU_KIEN_QUA_BETA = {
  /** Số việc lõi phải xong (đủ cả bốn). */
  VIEC_LOI_XONG: 4,
  /** Số trận Đấu trường đã chơi xong. */
  SO_TRAN: 3,
} as const;
