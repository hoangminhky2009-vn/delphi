-- ════════════════════════════════════════════════════════════════════════════
-- 0051 — UỶ QUYỀN ADMIN (D208)
--
-- Founder 31/08: *"t muốn người có quyền tương đương t. Vì t cầm mã nguồn code
-- nên ko lo gì, cho họ quyền tương đương t ở 2 web kia, thêm cơ chế uỷ quyền đi"*.
--
-- Trước migration này, cách DUY NHẤT để thêm một admin là gõ thẳng vào DB:
--   UPDATE users SET role='admin' WHERE handle='...'
-- tức phải có `.env.prod` — toàn quyền database — chỉ để trao một quyền ứng
-- dụng. Thu hồi cũng vậy. Không có dấu vết trong `admin_audit`, nên không ai
-- trả lời được "ai cho người này quyền, lúc nào".
--
-- ─── VÌ SAO CẦN CỘT `chu_so_huu`, KHI FOUNDER MUỐN "QUYỀN TƯƠNG ĐƯƠNG" ──────
-- Quyền thì tương đương THẬT: admin mới làm được đúng 31 route như founder, kể
-- cả 5 thao tác không hoàn tác được. Cột này KHÔNG tạo bậc quyền thứ hai — nó
-- chỉ chặn đúng MỘT nước đi: **admin khác không thu hồi được quyền của chủ sở
-- hữu.**
--
-- Không có nó thì hệ thống có một trạng thái tự huỷ: A uỷ quyền cho B, B thu
-- quyền của A, và app còn đúng một admin là người founder không định trao. Đó
-- không phải chuyện nghi ngờ đồng đội — nó là chuyện một cú bấm nhầm hoặc một
-- phiên bị chiếm cũng đủ gây ra, và nó chặn đường resolve kèo (A3.2 — kèo có
-- hạn và đang giữ token người chơi).
--
-- ⚠ Founder VẪN luôn khôi phục được bằng `.env.prod`. Cột này không phải hàng
-- rào chống founder mất quyền vĩnh viễn; nó là hàng rào chống một cú lỡ tay
-- biến thành một cuộc gọi điện lúc nửa đêm.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS chu_so_huu BOOLEAN NOT NULL DEFAULT false;

-- Admin CŨ NHẤT là chủ sở hữu. Chọn theo `created_at` chứ không theo một id gõ
-- tay: id gõ tay đúng trên prod và sai trên mọi DB test/local, rồi bài test sẽ
-- xanh vì lý do sai.
UPDATE users SET chu_so_huu = true
 WHERE user_id = (SELECT user_id FROM users
                   WHERE role = 'admin' AND deleted_at IS NULL
                   ORDER BY created_at LIMIT 1);

-- Đúng MỘT chủ sở hữu, ép ở tầng DB. Index một phần: chỉ ràng buộc các dòng
-- `true`, nên hàng nghìn dòng `false` không đụng nhau.
CREATE UNIQUE INDEX IF NOT EXISTS users_mot_chu_so_huu
    ON users ((chu_so_huu)) WHERE chu_so_huu;

-- Chủ sở hữu thì bắt buộc là admin. Ràng buộc này chặn một trạng thái vô nghĩa
-- (chủ sở hữu mà không phải admin) mà mọi đường code đều giả định là không có.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_chu_so_huu_phai_admin;
ALTER TABLE users ADD CONSTRAINT users_chu_so_huu_phai_admin
    CHECK (NOT chu_so_huu OR role = 'admin');
