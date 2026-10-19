-- 0067 — NHÓM ĐÃ LƯU CỦA KHU PHÂN KHÚC (D335, 15/09): app quản trị riêng `/quan-tri`.
--
-- Founder 15/09: *"thêm luôn vài chức năng chia khu và phân tích data cơ bản cho bảng panel admin"* — demo đã
-- chốt (`docs/ui-ux/demo/phan-tich-quan-tri.html`) có ô NHÓM ĐÃ LƯU "dùng chung giữa các admin".
--
-- ⚠ LƯU ĐIỀU KIỆN, KHÔNG LƯU DANH SÁCH NGƯỜI. Một nhóm lưu là một CÂU HỎI (tuổi · vùng · số trận…), mỗi lần mở
-- là tính lại trên dữ liệu hôm đó. Lưu danh sách user_id thì (a) người rút đồng ý vẫn nằm trong nhóm cũ — đúng
-- thứ cổng tầng đọc D101 dựng ra để chặn, và (b) bảng này thành một bảng "mỗi người một dòng" nằm ngoài mọi
-- lớp lọc của tầng phân tích.
--
-- ⚠ Không phải `events` (A9): đây là cấu hình của công cụ quản trị, sửa/xoá được. Xoá MỀM để một nhóm ai đó
-- đang so sánh không biến mất giữa chừng mà không để lại dấu.

CREATE TABLE IF NOT EXISTS admin_phan_khuc (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ten         TEXT NOT NULL CHECK (length(ten) BETWEEN 1 AND 60),
    -- Điều kiện đã qua `docDieuKien` ở server — không bao giờ ghi thẳng từ body.
    dieu_kien   JSONB NOT NULL,
    tao_boi     UUID NOT NULL REFERENCES users (user_id),
    tao_luc     TIMESTAMPTZ NOT NULL DEFAULT now(),
    xoa_luc     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_phan_khuc_song ON admin_phan_khuc (tao_luc) WHERE xoa_luc IS NULL;

ALTER TABLE admin_phan_khuc ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON admin_phan_khuc FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON admin_phan_khuc FROM authenticated;
    END IF;
END $$;
