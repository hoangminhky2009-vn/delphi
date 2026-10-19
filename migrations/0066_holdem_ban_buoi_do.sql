-- 0066 — BÀN BUỔI ĐO (D329, 13/09): cờ điều phối · loại bàn `buoi_do` ghim đề + luật · vết đồng ý.
--
-- Thiết kế: `docs/yeu-cau-ky-thuat/10-buoi-do-va-thang-nang-luc.md` §3.1 · §3.6. Cưỡi lên `holdem_ban`
-- (0040/0041) chứ không dựng bàn thứ hai (D61): mã 5 ký tự, một tài khoản một trận mỗi bàn, bàn
-- hết hạn thì đóng — y như bàn đội. Khác ba chỗ, và cả ba là cột ở đây.
--
-- ⚠⚠ ĐỀ GHIM `balance_version` THEO BÀN, KHÔNG THEO NGÀY TẠO TRẬN. Trận thường mang
-- `HOLDEM_BALANCE_VERSION` hiện hành lúc tạo; bàn buổi đo thì không được: buổi 1 và buổi đo lại
-- phải cùng một ĐỀ, và lật cổng luật giữa hai buổi là đổi đề dưới chân người đang được đo.

-- (1) Cờ điều phối — cùng họ `la_tester` (0052): bật tay bằng SQL, không route nào ghi được.
ALTER TABLE users ADD COLUMN IF NOT EXISTS la_dieu_phoi BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN users.la_dieu_phoi IS
  'Người ĐIỀU PHỐI buổi đo: được tạo bàn loại buoi_do và đọc trang NHÓM của bàn mình tạo. '
  'Bật tay bằng SQL (như la_tester) — không route nào ghi được cột này. Xem 0066.';

-- (2) Bàn buổi đo — ba cột mới, NULL với mọi bàn cũ.
ALTER TABLE holdem_ban ADD COLUMN IF NOT EXISTS de_id TEXT NULL;
ALTER TABLE holdem_ban ADD COLUMN IF NOT EXISTS nhan TEXT NULL;
ALTER TABLE holdem_ban ADD COLUMN IF NOT EXISTS balance_version TEXT NULL;
COMMENT ON COLUMN holdem_ban.de_id IS
  'Đề của bàn buổi đo — id trong config/holdem_de.ts. Server không nhận seed tuỳ ý cho loại này.';
COMMENT ON COLUMN holdem_ban.nhan IS
  'Nhãn nội bộ của người điều phối (vd "lop-10a-buoi-1"). CHỈ [a-z0-9-] — không tên người, không trường (C7).';
COMMENT ON COLUMN holdem_ban.balance_version IS
  'Bộ luật GHIM của bàn buổi đo — trận trong bàn chạy đúng bộ này, không theo HOLDEM_BALANCE_VERSION hiện hành.';

-- ⚠ CHECK cột `loai` của 0040 là CHECK viết liền dòng ⇒ Postgres tự đặt tên `holdem_ban_loai_check`.
ALTER TABLE holdem_ban DROP CONSTRAINT IF EXISTS holdem_ban_loai_check;
ALTER TABLE holdem_ban ADD CONSTRAINT holdem_ban_loai_check
  CHECK (loai IN ('doi', 'ngay', 'buoi_do'));

ALTER TABLE holdem_ban DROP CONSTRAINT IF EXISTS holdem_ban_loai_chk;
ALTER TABLE holdem_ban ADD CONSTRAINT holdem_ban_loai_chk CHECK (
    (loai = 'doi'     AND chu_user_id IS NOT NULL AND ngay IS NULL AND de_id IS NULL)
 OR (loai = 'ngay'    AND ngay IS NOT NULL AND de_id IS NULL)
 OR (loai = 'buoi_do' AND chu_user_id IS NOT NULL AND ngay IS NULL
                      AND de_id IS NOT NULL AND balance_version IS NOT NULL)
);

ALTER TABLE holdem_ban DROP CONSTRAINT IF EXISTS holdem_ban_nhan_chk;
ALTER TABLE holdem_ban ADD CONSTRAINT holdem_ban_nhan_chk
  CHECK (nhan IS NULL OR nhan ~ '^[a-z0-9-]{1,32}$');

-- (3) Vết ĐỒNG Ý / RÚT LẠI của buổi đo → `events` (append-only, cùng khuôn vết consent D295).
--
-- ⚠⚠ VÌ SAO HAI LOẠI MỚI, không mượn `pfm_consent`: `pfm_consent` sống dưới whitelist K5 của PFM
-- (mọi trường BẮT BUỘC, không trường tuỳ chọn) — nhét `ban_ma` vào là bắt mọi vết PFM phải có nó.
-- Và buổi đo không phải một cửa PFM: khác dòng dữ liệu, khác người nhận (tệp 10 §9 câu 7).
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

    IF dinh_nghia LIKE '%hd_dong_y_buoi_do%' THEN
        RETURN;   -- idempotent với chính nó
    END IF;

    moi := replace(dinh_nghia, '::text]',
        '::text, ''hd_dong_y_buoi_do''::text, ''hd_rut_buoi_do''::text]');

    IF moi NOT LIKE '%hd_dong_y_buoi_do%' THEN
        RAISE EXCEPTION 'không chèn được loại event buổi đo vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format('ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;
