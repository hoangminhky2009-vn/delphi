-- 0030 — CHẾ ĐỘ KHÁCH: chơi ngay, không đăng nhập, khoá rank, vẫn thu dữ liệu.
--
-- Founder 04/08: *"cho phép player chơi ở chế độ khách mà không cần đăng nhập
-- nhưng khóa rank (Vẫn thu data riêng nhóm này)"*.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- VÌ SAO KHÁCH LÀ MỘT HÀNG `users` THẬT, KHÔNG PHẢI MỘT ĐƯỜNG DỮ LIỆU THỨ HAI
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Đường dễ nghĩ ra là "khách thì đừng tạo tài khoản, ghi dữ liệu vào chỗ khác".
-- Nó sai vì `events.user_id` có KHOÁ NGOẠI trỏ `users(user_id)` — muốn ghi
-- `events` cho khách thì hoặc có hàng `users`, hoặc phải đẻ ra một bảng sự kiện
-- THỨ HAI. Mà bảng thứ hai nghĩa là:
--   · mọi truy vấn phân tích phải nhớ hợp nhất hai nguồn, mãi mãi;
--   · mọi đường ghi phải rẽ nhánh theo loại người dùng;
--   · và `events` là APPEND-ONLY (A3.3), nên hợp nhất sai một lần là sai vĩnh viễn.
--
-- Tài khoản khách thật thì MỌI đường ghi hiện có dùng lại nguyên vẹn, không một
-- chỗ nào phải biết người này là khách — trừ đúng hai chỗ khoá rank.
--
-- ⭐ Và schema đã sẵn sàng từ 0029: `age_band`/`region`/`occupation_band` đã
-- NULL-able cho "chơi trước, khai sau", `email`/`password_hash` đã NULL-able cho
-- người vào từ Discord. Khách chính là bậc 0 của cùng thiết kế đó.

ALTER TABLE users ADD COLUMN IF NOT EXISTS la_khach BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.la_khach IS
  'Tài khoản KHÁCH: vào chơi không cần đăng nhập. Bị khoá rank (hai tầng: chặn '
  'lúc tạo trận + chặn lúc ghi điểm). Vẫn ghi `events` như mọi người dùng khác, '
  'và cột này là thứ cắt riêng nhóm đó ra khi phân tích.';

-- Đường truy vấn nóng của phân tích là "cắt theo nhóm khách / không khách", và
-- ở mùa 0.0 nhóm khách nhiều khả năng là phần lớn. Index một phần cho đúng nhánh
-- ÍT hơn — nhánh nhiều thì quét bảng vẫn rẻ hơn đọc index.
CREATE INDEX IF NOT EXISTS users_khach_idx ON users (user_id) WHERE la_khach;

-- ══════════════════════════════════════════════════════════════════════════════
-- ⚠ BA THỨ CỐ Ý KHÔNG LÀM Ở ĐÂY
-- ══════════════════════════════════════════════════════════════════════════════
--
-- 1. KHÔNG có CHECK "khách thì không được có email". Khách NÂNG CẤP thành tài
--    khoản đầy đủ là đường đi mong muốn (bậc 2), và lúc đó `la_khach` chuyển
--    false trong cùng transaction với việc gắn email. Một CHECK ở đây sẽ chặn
--    đúng con đường mà thiết kế muốn khuyến khích.
--
-- 2. KHÔNG có lệnh dọn tài khoản khách cũ. Ở mùa 0.0 (~150 người, D64) một hàng
--    `users` là vài chục byte và số lượng không đáng kể. ⚠ Nhưng ghi ra đây để
--    không quên: khi mở cho người ngoài, mỗi lần bấm "chơi thử" là một hàng, và
--    kẻ nghịch có thể bấm hàng nghìn lần. Cửa chặn hôm nay là RATE LIMIT THEO IP
--    ở tầng endpoint, không phải ở DB.
--
-- 3. KHÔNG đụng `research_consent`. Khách mặc định `false` như mọi tài khoản mới,
--    nên `telemetry` (đo giao diện) KHÔNG ghi cho họ — đúng luật đang chạy. Còn
--    `events` (hành vi kinh tế) thì vẫn ghi, vì đó là VẬN HÀNH chứ không phải
--    nghiên cứu (A9). Founder muốn "vẫn thu data" và đây chính là phần đó.
