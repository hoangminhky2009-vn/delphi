-- ===========================================================================
-- 0079 — CHẶN TRƯỚC BETA CÔNG KHAI (SPEC docs/spec/chan-truoc-beta.md, CHỐT bản 1 11/10, D592)
--
-- Ba mảnh, một transaction:
--   (1) `users.research_consent_phien_ban` — ô đồng ý nghiên cứu có SỐ BẢN, như bốn cửa PFM và buổi đo (config/pfm_consent.ts).
--   (2) hai loại vết `nghien_cuu_dong_y` / `nghien_cuu_rut` trong `events` — mỗi lần bật/tắt một vết (van_ban_id, phien_ban).
--   (3) bảng `bao_loi` — người chơi tự báo lỗi trong app (KHÔNG phải `events`: không tiền, không niềm tin — A9; xoá theo tài khoản).
--
-- ⚠ KHÔNG ĐỤNG DỮ LIỆU CŨ. Người đang `research_consent = true` từ trước có phiên bản NULL ⇒ server coi là CHƯA đồng ý bản hiện hành:
-- `/telemetry` không ghi, `/auth/me` báo `hoi_lai_nghien_cuu` ⇒ app hỏi lại MỘT lần (founder 11/10: "chưa trả lời = TẮT"). Không cờ
-- nào bị lật âm thầm trong migration — lật là việc của người dùng, và nó để lại vết.
-- ===========================================================================

-- (1) Số bản của văn bản đồng ý nghiên cứu mà người này ĐÃ ĐỒNG Ý lần gần nhất. NULL = chưa từng đồng ý một bản có số
-- (gồm mọi người bật ô trước 0079). Server so với `CONSENT_PHIEN_BAN.nghien_cuu` — khác ⇒ coi như TẮT.
ALTER TABLE users ADD COLUMN IF NOT EXISTS research_consent_phien_ban TEXT NULL;
COMMENT ON COLUMN users.research_consent_phien_ban IS
  'Bản văn đồng ý nghiên cứu (config/pfm_consent.ts: nghien_cuu) người này đồng ý lần gần nhất. NULL hoặc khác bản hiện hành '
  '⇒ server coi research_consent như TẮT và hỏi lại. Vết từng lần bật/tắt nằm ở events (nghien_cuu_dong_y / nghien_cuu_rut). Xem 0079.';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_nghien_cuu_phien_ban_chk;
ALTER TABLE users ADD CONSTRAINT users_nghien_cuu_phien_ban_chk
  CHECK (research_consent_phien_ban IS NULL OR research_consent_phien_ban ~ '^v[0-9]{1,3}$');

-- (2) Vết đồng ý / rút lại → `events` (append-only, cùng khuôn vết consent D295 · buổi đo 0066).
-- ⚠ BẪY ĐÃ CẮN 7 LẦN (0047 §8): CHECK ĐÓNG — đọc định nghĩa hiện tại rồi NỐI THÊM, không gõ lại.
DO $$
DECLARE
    dinh_nghia TEXT;
    moi        TEXT;
BEGIN
    SELECT pg_get_constraintdef(oid) INTO dinh_nghia
      FROM pg_constraint
     WHERE conname = 'events_action_type_check'
       AND conrelid = 'events'::regclass;

    IF dinh_nghia IS NULL THEN
        RAISE EXCEPTION 'không thấy events_action_type_check — schema lệch dự đoán';
    END IF;

    IF dinh_nghia LIKE '%nghien_cuu_dong_y%' THEN
        RETURN;   -- idempotent với chính nó
    END IF;

    moi := replace(dinh_nghia, '::text]',
        '::text, ''nghien_cuu_dong_y''::text, ''nghien_cuu_rut''::text]');

    IF moi NOT LIKE '%nghien_cuu_dong_y%' THEN
        RAISE EXCEPTION 'không chèn được loại event nghiên cứu vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format('ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;

-- (3) BÁO LỖI CỦA NGƯỜI CHƠI. Chữ người chơi gõ CHỈ nằm ở đây (≤ 1.000 ký tự) — tin chuông Sentry chỉ chở mã số (C7).
-- `user_id` NOT NULL: chỉ người có tài khoản (kể cả khách) báo được — trần 5 báo/ngày đếm theo người. Xoá tài khoản ⇒ DELETE theo
-- user_id (đường xoá ở server/app.ts), không dựa vào CASCADE: `users` không bao giờ bị xoá cứng (ẩn danh hoá).
CREATE TABLE bao_loi (
    bao_loi_id  BIGSERIAL   PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users (user_id),
    ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
    noi_dung    TEXT        NOT NULL CHECK (char_length(noi_dung) BETWEEN 1 AND 1000),
    -- Màn đang đứng (đường dẫn đã chuẩn hoá, không query string) · bản app · mã lỗi gần nhất client thấy. Đều tuỳ chọn.
    man         TEXT        NULL CHECK (man IS NULL OR char_length(man) <= 80),
    ban         TEXT        NULL CHECK (ban IS NULL OR char_length(ban) <= 32),
    ma_loi      TEXT        NULL CHECK (ma_loi IS NULL OR char_length(ma_loi) <= 64)
);
CREATE INDEX bao_loi_user_ts_idx ON bao_loi (user_id, ts);
CREATE INDEX bao_loi_ts_idx ON bao_loi (ts DESC);
COMMENT ON TABLE bao_loi IS
  'Người chơi tự báo lỗi (SPEC chan-truoc-beta). KHÔNG phải events (A9). Xoá theo tài khoản. Chuông Sentry chỉ chở bao_loi_id + mã.';

-- RLS — BẮT BUỘC theo 0006: bảng mới khoá trong chính migration tạo nó (chở chữ người dùng gõ).
ALTER TABLE bao_loi ENABLE ROW LEVEL SECURITY;
