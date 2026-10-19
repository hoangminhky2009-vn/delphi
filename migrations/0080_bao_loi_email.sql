-- ===========================================================================
-- 0080 — BÁO LỖI: ô EMAIL TUỲ CHỌN (SPEC docs/spec/bao-loi-nguoi-choi.md mục 4.1 · T5 · T10; D600)
--
-- Người chơi tự điền email ngay dưới ô Báo lỗi "để được trả lời" — vắng là NULL. Cùng dòng `bao_loi` (0079), nên cùng số phận:
-- đọc ở trang admin (requireAdmin), tải về ở "Dữ liệu của tôi", xoá cùng tài khoản. KHÔNG đi Sentry (chuông chỉ ban/man/ma_loi — C7).
-- Không đụng dữ liệu cũ: cột mới NULL cho mọi dòng đã có.
-- ===========================================================================
ALTER TABLE bao_loi
  ADD COLUMN email TEXT NULL CHECK (email IS NULL OR (char_length(email) BETWEEN 3 AND 254 AND email LIKE '%_@_%'));
