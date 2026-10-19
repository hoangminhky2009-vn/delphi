-- 0044 — CÂU TỰ KHAI (D101 Q4 · D106 bước 6). Dohmen 2011: một câu tự khai về khẩu
-- vị rủi ro dự đoán hành vi thật tốt hơn cả bài xổ số có tiền ⇒ ghép với số đo
-- trong trận, đừng khinh câu hỏi. Hỏi SAU khi đã chơi (ở trang Tài chính, cạnh
-- thẻ), KHÔNG ở onboard (D101: 66/90 lượt bỏ nằm ở phút đầu — hỏi ở cửa vào là
-- chọn mẫu trên chính đặc điểm đang đo).
--
-- Đây là CỘT "NGOÀI ĐỜI" đầu tiên — chỗ phần quản lý tài chính cá nhân sau này cắm
-- dữ liệu thật vào (D106). Lưu LỊCH SỬ (mỗi lần trả lời một dòng), đọc dòng mới
-- nhất; không xoá — đổi ý cũng là dữ liệu.
-- KHÔNG thưởng gì cho việc trả lời (D101: tuyệt đối không).
CREATE TABLE tu_khai (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id   UUID NOT NULL REFERENCES users(user_id),
  -- Mã câu hỏi — câu chữ ở client; thêm câu mới = thêm mã vào CHECK (migration).
  cau       TEXT NOT NULL CHECK (cau IN ('rui_ro')),
  tra_loi   SMALLINT NOT NULL CHECK (tra_loi BETWEEN 0 AND 10),
  ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tu_khai_user_idx ON tu_khai (user_id, cau, ts DESC);
ALTER TABLE tu_khai ENABLE ROW LEVEL SECURITY;
