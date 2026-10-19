-- 0028 — MÃ PHIÊN CHO TELEMETRY.
--
-- ⚠ VÁ MỘT PHÉP ĐO CHẾT, KHÔNG PHẢI THÊM TÍNH NĂNG. Phễu đăng ký (mặt HÀNH
-- TRÌNH, 03/08) đếm `count(DISTINCT user_id)` — mà các bước đăng ký THEO BẢN
-- CHẤT xảy ra TRƯỚC khi tài khoản tồn tại, nên `user_id` ở đó luôn NULL và phễu
-- đọc 0 vĩnh viễn. Nó dựng lên, chạy được, không báo lỗi, và không bao giờ nói
-- gì. Đúng lớp "cơ chế trang trí" repo đã dính bốn lần.
--
-- Đo lượt (đếm dòng) không thay được: một người do dự tải lại trang đăng ký ba
-- lần thành "3 người vào, 1 người gửi" — đọc ra rơi 67% trong khi rơi 0%. Ở quy
-- mô beta vài chục người thì đó không phải nhiễu nhỏ, đó là kết luận ngược.
--
-- ⚠ `phien` KHÔNG PHẢI ĐỊNH DANH NGƯỜI DÙNG (C7). Nó sinh trong BỘ NHỚ mỗi lần
-- mở trang và KHÔNG BAO GIỜ ghi xuống localStorage — nên nó không nối được hai
-- lần ghé của cùng một người, không sống qua lần tải lại, không nối được sang
-- thiết bị khác. Nó chỉ trả lời đúng một câu: "mấy sự kiện này có phải cùng một
-- lượt ngồi không?". Ghi rõ để lần sau không ai "tiện tay" đem nó đi lưu.
--
-- Cột NULL cho dòng cũ — 29 dòng đã ghi trước 03/08 không có mã phiên, và
-- telemetry không sửa lại được. Truy vấn phải chịu được NULL, không được coi
-- NULL là một phiên chung.
--
-- KHÔNG đánh index: cột này chỉ dùng trong `count(DISTINCT …)` trên tập ĐÃ lọc
-- sẵn bằng `loai` + `ts`, mà đây là bảng ghi nóng nhất app (C1) — thêm index là
-- thêm giá cho mọi lượt ghi để phục vụ một truy vấn admin chạy vài lần một ngày.

ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS phien uuid;

COMMENT ON COLUMN telemetry.phien IS
  'Mã một LƯỢT NGỒI, sinh trong bộ nhớ client mỗi lần mở trang, không lưu xuống '
  'đĩa. Dùng để đếm phễu của khách CHƯA có tài khoản. Không phải định danh người '
  'dùng và tuyệt đối không được lưu bền ở client (C7).';
