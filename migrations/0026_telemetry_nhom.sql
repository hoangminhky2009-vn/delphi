-- 0026 — KHỐI CUỘN THEO NHÓM: đủ ba chiều nhân khẩu cho drill-down (founder 03/08).
--
-- Founder muốn lọc dần: bấm "miền bắc" → hiện nhóm tuổi + nghề trong đó; bấm
-- tiếp một nhóm tuổi → hiện hai chiều còn lại. `telemetry_ngay` (0025) chỉ cắt
-- theo `age_band` nên KHÔNG phục vụ được — thiếu `region` và `occupation_band`.
--
-- ⏱ LÀM BÂY GIỜ VÌ BÂY GIỜ NÓ MIỄN PHÍ: `telemetry_ngay` mới chạy từ hôm nay và
-- trên prod đang có ĐÚNG 0 DÒNG. Một tháng nữa thì đây là migrate dữ liệu sống.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- VÌ SAO HAI KHỐI CHỨ KHÔNG NỚI KHOÁ CỦA KHỐI CŨ
-- ═══════════════════════════════════════════════════════════════════════════
-- Cách hiển nhiên là thêm `region` + `occupation_band` vào `telemetry_ngay`.
-- Đếm thử thì thấy nó phá đúng tính chất khiến bảng cuộn được chọn — "nhỏ vĩnh
-- viễn":
--     khoá đầy đủ = ngay × loai × man × tuổi × vùng × nghề
--     ≈ 52 cặp (loai,man) × ~40 bộ ba nhân khẩu có thật mỗi ngày
--     ≈ 2.000 dòng/ngày ≈ 730k dòng/năm ≈ 70–100 MB/năm
-- Trên ngân sách 500 MB thì đó không còn là bảng tổng hợp, nó là bảng thô thứ hai.
--
-- Nên tách theo đúng câu hỏi mỗi khối phải trả lời, và KHÔNG khối nào mang cả
-- `man` lẫn ba chiều nhân khẩu cùng lúc:
--     telemetry_ngay      (ngay, loai, man, age_band)                 ~260 dòng/ngày
--        → "màn nào tốn thời gian", cắt thô theo tuổi
--     telemetry_ngay_nhom (ngay, loai, tuổi, vùng, nghề)              ~400 dòng/ngày
--        → "nhóm nào chơi bao lâu, quay lại không", đủ ba chiều
-- Cộng lại ~25 MB/năm.
--
-- ⚠ ĐÁNH ĐỔI PHẢI KHAI: cắt CHÉO giữa `man` và (vùng|nghề) — vd "người miền bắc
-- ở màn nào lâu nhất" — KHÔNG có trong khối nào. Nó đọc từ bảng THÔ và vì thế
-- chỉ lùi được 90 ngày. Đây là lựa chọn: một cái kho nhỏ mãi mãi cộng một cửa
-- sổ 90 ngày soi sâu, thay vì một cái kho phình dần.

-- ═══════════════════════════════════════════════════════════════════════════
-- (1) TỔNG THỜI LƯỢNG — p50/p90 không cộng lại được
-- ═══════════════════════════════════════════════════════════════════════════
-- "Chơi trong mấy giờ" là một phép CỘNG. Trung vị không trả lời được nó, và
-- không có cách nào suy ngược ra từ p50/p90 sau khi đã cuộn. Thiếu cột này thì
-- câu hỏi §4.1 mục 2 mất vĩnh viễn phần "mấy giờ" của nó.
-- BIGINT: 500 người × 2 giờ/ngày × 365 ngày đã là 1,3 nghìn tỷ ms.

ALTER TABLE telemetry_ngay
  ADD COLUMN IF NOT EXISTS ms_tong BIGINT NOT NULL DEFAULT 0;

-- ═══════════════════════════════════════════════════════════════════════════
-- (2) KHỐI THEO NHÓM — đủ ba chiều, KHÔNG có `man`
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS telemetry_ngay_nhom (
    ngay            DATE NOT NULL,
    loai            TEXT NOT NULL,
    -- Cả ba NULL được: khách chưa đăng nhập không thuộc nhóm nào. Giữ NULL đúng
    -- nghĩa thay vì sentinel — xem lý do ở 0025 (một chuỗi giả sẽ có ngày bị
    -- đọc thành một nhóm thật).
    age_band        TEXT,
    region          TEXT,
    occupation_band TEXT,
    so_luot         INT    NOT NULL,
    so_nguoi        INT    NOT NULL,
    ms_tong         BIGINT NOT NULL DEFAULT 0,
    ms_p50          INT,
    ms_p90          INT
);

CREATE UNIQUE INDEX IF NOT EXISTS telemetry_ngay_nhom_khoa
    ON telemetry_ngay_nhom (ngay, loai, age_band, region, occupation_band)
    NULLS NOT DISTINCT;

-- ═══════════════════════════════════════════════════════════════════════════
-- (3) KHOÁ PostgREST — luật bảng mới của 0006
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE telemetry_ngay_nhom ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON telemetry_ngay_nhom FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON telemetry_ngay_nhom FROM authenticated;
    END IF;
END $$;
