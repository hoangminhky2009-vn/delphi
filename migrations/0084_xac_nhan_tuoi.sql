-- ===========================================================================
-- 0084 — XÁC NHẬN TUỔI CHO MỌI ĐƯỜNG VÀO (SPEC docs/spec/va-bao-mat-chuan-hoa-api-dot-1.md B5; C8)
--
-- Age gate 16+ trước nay chỉ ở `POST /auth/register` (email). Khách (`/auth/khach`) và Discord vào chơi KHÔNG bị hỏi tuổi ⇒ "16+"
-- chỉ đúng với một trong ba đường vào. Nay `requireOnboarded` đòi `age_band IS NOT NULL OR tuoi_ok_luc IS NOT NULL`;
-- `POST /me/tuoi {birth_year}` ghi mốc này khi đủ tuổi (năm sinh KHÔNG lưu — C7; chỉ quy ra `age_band` nếu còn trống).
--
-- Vì sao một cột MỐC riêng chứ không chỉ `age_band`: `age_band` là nhân khẩu (C7, khai ở `/me/nhan-khau` có nút bỏ qua) — người bỏ
-- qua nhân khẩu vẫn phải qua được cổng tuổi; mốc giữ "đã xác nhận đủ tuổi lúc nào" tách khỏi "đã khai nhóm tuổi chưa".
-- Không đụng dữ liệu cũ: NULL cho mọi dòng đã có — tài khoản email đã có `age_band` nên qua cổng như cũ; khách/Discord cũ gặp tấm
-- hỏi năm sinh một lần ở lần mở app kế tiếp.
-- ===========================================================================
ALTER TABLE users ADD COLUMN tuoi_ok_luc TIMESTAMPTZ NULL;

COMMENT ON COLUMN users.tuoi_ok_luc IS
  'B5 (C8) — lúc người dùng xác nhận đủ tuổi qua POST /me/tuoi. NULL + age_band NULL ⇒ requireOnboarded trả 403 chua_xac_nhan_tuoi.';
