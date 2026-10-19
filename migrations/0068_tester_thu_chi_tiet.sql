-- 0068 — VÀO BẰNG LINK TESTER ⇒ BẬT THU CHI TIẾT (D362, founder 20/09).
--
-- Founder: *"nếu 1 người nhận được đường link cụ thể thì sẽ đánh dấu họ là tester để bật thu và phân tích
-- dữ liệu chi tiết hơn, và trên dashboard admin cũng có riêng 1 phần cho tester, thu chi tiết từng cá nhân"*
-- — kèm chỉ thị gọn lại: *"chúng ta đang tester nội bộ mà rườm rà v**"*.
--
-- ⚠⚠ KHÔNG DỰNG CƠ CHẾ LINK THỨ HAI. Link tester ĐÃ TỒN TẠI: đó là nút CHIA SẺ LINK của bàn buổi đo
-- (`holdem_ban.loai = 'buoi_do'`, 0066). Ai mở link ấy thì đăng ký → đọc văn bản → bấm ĐỒNG Ý VÀ VÀO. Ba
-- việc founder cần (nhận diện · đồng ý · vào đúng bàn) đã nằm trọn trong một đường có sẵn. Thêm một bảng
-- `tester_link` nữa là dựng bản thứ hai của cùng một thứ, và bản thứ hai sẽ trôi (A11.5/D61).
-- ⇒ Migration này chỉ thêm CỜ mà đường ấy bật lên.
--
-- ⚠⚠ VÌ SAO KHÔNG DÙNG LẠI `la_tester` (0052). Hai cờ NGƯỢC HƯỚNG nhau:
--   · `la_tester` = tài khoản thử nghiệm/cheat ⇒ dashboard **LOẠI** họ khỏi mọi số (đúng: họ ép tham số).
--   · `thu_chi_tiet` = người thật đang thử sản phẩm ⇒ dashboard **ĐỌC KỸ HƠN** về họ.
-- Gộp hai cái là bảo dashboard vừa giấu vừa soi cùng một người. Đây là hai trục, không phải hai tên gọi.
--
-- ⚠ CỜ NÀY KHÔNG MỞ CỬA DỮ LIỆU NÀO MỚI. Nó không thay `research_consent` (cổng ghi telemetry), không thay
-- bốn cửa PFM, không thay vết đồng ý trong `events`. Nó chỉ trả lời một câu cho tầng ĐỌC: *"người này có
-- thuộc đợt thử nghiệm đang cần soi từng người không"*. Thu gì vẫn do consent quyết.
--
-- ⚠ TẮT ĐƯỢC VÀ PHẢI TẮT: rút đồng ý ⇒ cờ về false trong cùng transaction với vết rút. Cờ còn bật sau khi
-- người ta đã rút là đúng thứ khiến "rút lại" thành một nút không làm gì.

ALTER TABLE users ADD COLUMN IF NOT EXISTS thu_chi_tiet      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS thu_chi_tiet_luc  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS thu_chi_tiet_nhan TEXT;

COMMENT ON COLUMN users.thu_chi_tiet IS
  'Đợt thử nghiệm: người này vào bằng link bàn buổi đo và đã bấm đồng ý ⇒ khu TESTER của '
  '/quan-tri đọc từng người. KHÔNG phải la_tester (cờ ấy LOẠI khỏi phân tích — ngược hướng). '
  'Bật/tắt bởi POST /holdem/ban/:ma/dong-y và /rut-dong-y. Xem 0068.';
COMMENT ON COLUMN users.thu_chi_tiet_luc IS
  'Lúc bật lần gần nhất. Rút rồi đồng ý lại thì ghi đè — mốc này là "từ khi nào đang bật", '
  'không phải lịch sử; lịch sử nằm ở events (append-only).';
COMMENT ON COLUMN users.thu_chi_tiet_nhan IS
  'Nhãn nhóm của bàn đã đưa họ vào (holdem_ban.nhan, vd "lop-10a-buoi-1") — để tách ĐỢT khi '
  'đọc khu TESTER. Chỉ [a-z0-9-], không tên người, không tên trường (C7).';

-- Khu TESTER quét theo đúng cờ này; không index thì mỗi lần mở là một seq scan trên toàn bảng users.
-- Index BỘ PHẬN: đợt thử nghiệm luôn là thiểu số, nên index đầy đủ chỉ tốn chỗ cho những dòng không đọc tới.
CREATE INDEX IF NOT EXISTS users_thu_chi_tiet_idx ON users (thu_chi_tiet_nhan, user_id)
    WHERE thu_chi_tiet;
