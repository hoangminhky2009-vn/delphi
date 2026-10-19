-- 0024 — ĐO LƯỜNG VẬN HÀNH: bảng `telemetry` (A9, founder chốt 03/08 — phương án A).
--
-- ⚠ HAI BẢNG, HAI VAI, KHÔNG TRỘN. `events` là SẢN PHẨM (A1: "mất event = mất
-- doanh thu tương lai") nên nó append-only VĨNH VIỄN (A3.3). Mấy bảng dưới đây
-- là DỤNG CỤ VẬN HÀNH: xoá được, hạn lưu 90 ngày, giá trị nằm ở XU HƯỚNG chứ
-- không ở từng dòng.
--
-- ⚠ A3.3 KHÔNG BỊ NỚI MỘT LY NÀO. Nó bảo vệ bảng `events`, và bảng đó vẫn
-- append-only tuyệt đối. Đây là bảng MỚI, chưa từng nằm trong phạm vi A3.3.
--
-- ⚠ MIGRATION NÀY KHÔNG ĐỤNG `events.action_type`. Bước 1 không thêm một loại
-- event nào — mọi thứ nó đo đều trả lời "KHÔNG" cho phép thử A9 (*"dòng này có
-- tiền hoặc có niềm tin trong đó không?"*). Cái bẫy CHECK-đóng đã cắn ở
-- 0010/0011/0012/0013/0016 nên nói rõ ở đây là nó KHÔNG được kích hoạt, để
-- người đọc sau không đi tìm đoạn nới constraint mà tưởng ai đó quên.

-- ═══════════════════════════════════════════════════════════════════════════
-- (1) BẢNG THÔ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `id` IDENTITY không chỉ để có khoá chính: nó GIỮ THỨ TỰ TRONG MỘT LÔ. Cả lô
-- được ghi bằng một câu INSERT nên mọi dòng chung một `now()`; thứ tự phễu
-- ("bước 3 trước hay sau bước 4") đọc theo `id`, không đọc theo `ts`.
--
-- ⚠ `loai` CỐ Ý KHÔNG CÓ CHECK — ngược hẳn `events.action_type`, và đó là chủ
-- đích. Lọc trắng nằm ở endpoint (`config/telemetry.ts`), nên thêm một loại đo
-- mới là sửa một mảng TypeScript chứ không phải chờ một migration. Với bảng
-- SẢN PHẨM thì CHECK cứng là đúng (sai một dòng là sai vĩnh viễn); với bảng
-- DỤNG CỤ thì nó chỉ đổi ma sát lấy một sự an toàn ta không cần — phân loại
-- sai ở đây chỉ tốn một dòng xoá được sau 90 ngày (A9: "sai kiểu an toàn").

CREATE TABLE IF NOT EXISTS telemetry (
    id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- NULL = khách chưa đăng nhập. `users` xoá MỀM (`deleted_at`) nên khoá
    -- ngoại thường là đủ, không cần ON DELETE.
    user_id  UUID REFERENCES users (user_id),
    -- ⚠ SERVER ĐẶT, KHÔNG NHẬN TỪ CLIENT. Đồng hồ máy người dùng sai hoặc bị
    -- sửa tay là chuyện thường; client chỉ được gửi THỜI LƯỢNG (`ms`).
    ts       TIMESTAMPTZ NOT NULL DEFAULT now(),
    loai     TEXT NOT NULL,
    -- MẪU route (`/keo/:marketId`), không bao giờ là URL cụ thể — xem
    -- `MAN_HOP_LE`. NULL = sự kiện không thuộc màn nào ('khac' = màn lạ).
    man      TEXT,
    ms       INT CHECK (ms IS NULL OR ms >= 0),
    chi_tiet JSONB
);

CREATE INDEX IF NOT EXISTS telemetry_ts_idx      ON telemetry (ts);
CREATE INDEX IF NOT EXISTS telemetry_loai_ts_idx ON telemetry (loai, ts);
-- Phục vụ HAI việc: cắt theo người lúc soi sâu, và phép đếm rate-limit của
-- endpoint (xem `TELEMETRY.TRAN_MOI_USER` — nó cố ý không tốn bảng riêng).
CREATE INDEX IF NOT EXISTS telemetry_user_ts_idx ON telemetry (user_id, ts);

-- ═══════════════════════════════════════════════════════════════════════════
-- (2) BẢNG CUỘN NGÀY — thứ dashboard THẬT SỰ đọc
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Nhỏ vĩnh viễn (số ngày × số loại × số màn × số nhóm tuổi), nên dashboard
-- nhanh mà kho không phình. Giữ VĨNH VIỄN — xu hướng dài hạn không mất gì khi
-- bản thô hết hạn 90 ngày.
--
-- ⚠ KHÔNG DÙNG PRIMARY KEY (ngay, loai, man, age_band) như bản yêu cầu ghi.
-- PK hàm ý NOT NULL MỌI CỘT, mà cả `man` NULL (sự kiện không thuộc màn nào) lẫn
-- `age_band` NULL (khách chưa đăng nhập) đều là TRẠNG THÁI HỢP LỆ. Founder đã
-- duyệt sửa 03/08.
-- Và KHÔNG chữa bằng sentinel `'-'`: một chuỗi giả sẽ rò lên dashboard rồi có
-- ngày ai đó đọc nó thành một nhóm tuổi thật. `NULLS NOT DISTINCT` (PG 15+; dev
-- 17.10 · prod 17.6 — D12) cho phép giữ NULL đúng nghĩa mà vẫn upsert được.

CREATE TABLE IF NOT EXISTS telemetry_ngay (
    ngay     DATE NOT NULL,
    loai     TEXT NOT NULL,
    man      TEXT,
    age_band TEXT,          -- cắt theo nhóm NGAY TỪ LÚC CUỘN (C7), không lưu ai là ai
    so_luot  INT  NOT NULL,
    so_nguoi INT  NOT NULL,
    ms_p50   INT,
    ms_p90   INT
);

-- Khoá duy nhất của một ô tổng hợp. `ON CONFLICT (ngay, loai, man, age_band)`
-- suy đúng index này ⇒ cuộn lại một ngày là GHI ĐÈ, không nhân đôi.
CREATE UNIQUE INDEX IF NOT EXISTS telemetry_ngay_khoa
    ON telemetry_ngay (ngay, loai, man, age_band) NULLS NOT DISTINCT;

-- ═══════════════════════════════════════════════════════════════════════════
-- (3) CHỐNG GỬI LẠI (idempotency) — cùng idiom `bet_intents`, khác cái bảng
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Không tái dụng được `bet_intents`: bảng đó có `market_id NOT NULL` và
-- `user_id NOT NULL`, mà một lô telemetry không có kèo nào và có thể do khách
-- chưa đăng nhập gửi.
-- KHÔNG phải ledger ⇒ xoá được theo TTL, dọn trong `/internal/tick`.

CREATE TABLE IF NOT EXISTS telemetry_lo (
    lo_key TEXT PRIMARY KEY CHECK (length(lo_key) BETWEEN 8 AND 128),
    at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telemetry_lo_at_idx ON telemetry_lo (at);

-- ═══════════════════════════════════════════════════════════════════════════
-- (4) SỔ ĐÁNH DẤU NGÀY ĐÃ CUỘN
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Vì sao cần, thay vì suy từ `max(ngay)` của `telemetry_ngay`: một ngày KHÔNG
-- CÓ hoạt động nào sinh ra 0 dòng tổng hợp, nên `max(ngay)` đứng yên và tick sẽ
-- cuộn lại ngày rỗng đó MÃI MÃI, kéo theo mọi ngày sau nó. Rẻ hôm nay, nhưng
-- đúng loại nợ im lặng mà A8.9 cấm. Một dòng mỗi ngày = 365 dòng/năm.

CREATE TABLE IF NOT EXISTS telemetry_cuon (
    ngay     DATE PRIMARY KEY,
    cuon_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
    so_dong  INT NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════
-- (5) INDEX CÒN THIẾU TRÊN BẢNG CŨ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Mọi câu hỏi của dashboard đều lọc theo LOẠI HÀNH ĐỘNG + KHOẢNG THỜI GIAN, mà
-- `events` mới có `(user_id, ts)` và `(context_id)` (0003). Đây là index, không
-- phải dữ liệu — `events` không bị thêm/sửa/xoá một dòng nào.

CREATE INDEX IF NOT EXISTS events_action_ts_idx ON events (action_type, ts);

-- ═══════════════════════════════════════════════════════════════════════════
-- (6) KHOÁ PostgREST — luật bảng mới của 0006
-- ═══════════════════════════════════════════════════════════════════════════
--
-- "Bảng mới trong tương lai PHẢI kèm ENABLE ROW LEVEL SECURITY trong chính
-- migration tạo nó." Không policy nào ⇒ anon/authenticated bị từ chối toàn bộ;
-- kết nối app (owner) bypass RLS như thường.

ALTER TABLE telemetry      ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_ngay ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_lo   ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_cuon ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON telemetry, telemetry_ngay, telemetry_lo, telemetry_cuon FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON telemetry, telemetry_ngay, telemetry_lo, telemetry_cuon FROM authenticated;
    END IF;
END $$;
