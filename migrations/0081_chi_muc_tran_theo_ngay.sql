-- ═══════════════════════════════════════════════════════════════════════════
-- 0081 — CHỈ MỤC TRẬN THEO GIỜ TẠO (SPEC tran-tran-ngay — lưới trần ngày)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `POST /holdem/matches` nay ĐẾM trận người thường tạo từ 0:00 giờ VN TRONG transaction tạo trận, dưới khoá tư vấn
-- (`server/suat_tran.ts`). Chỉ mục cũ đều đứng sau `owner_user_id` (0010), nên đếm theo `started_at` toàn bảng là quét
-- cả bảng — mỗi lần tạo trận, trong lúc giữ khoá chung, tức càng đông càng nghẽn đúng chỗ đang nối tiếp mọi người.
-- Chỉ mục này biến phép đếm thành quét một khúc ngắn (vài chục dòng/ngày).
--
-- ⚠ ĐI CÙNG COMMIT VỚI CODE ĐẾM NÓ (A11.4). Không đổi dữ liệu, không đổi luật — chỉ thêm chỉ mục.
-- ⚠ Không `CONCURRENTLY`: mỗi tệp migration chạy trong một transaction; bảng prod còn nhỏ nên khoá ghi thoáng qua.

CREATE INDEX IF NOT EXISTS idx_holdem_matches_started_at ON holdem_matches (started_at);
