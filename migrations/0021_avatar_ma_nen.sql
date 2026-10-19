-- ---------------------------------------------------------------------------
-- 0021 — NỚI MÃ NỀN AVATAR: [A-C] → [A-Z] (D41)
--
-- D41 thêm lá `av_an_danh` mang mã `D`. Hai ràng buộc trong 0013 ghim cứng dải
-- `[A-C]` nên INSERT mã `D` bị từ chối ở tầng DB:
--     users.dien_mao      CHECK (dien_mao ~ '^2[A-C]...')
--     avatar_so_huu.nen   CHECK (nen ~ '^[A-C]$')
--
-- ⚠ VÌ SAO NỚI THẲNG TỚI [A-Z] CHỨ KHÔNG PHẢI [A-D].
-- Ghim đúng số lá hiện có nghĩa là **mỗi avatar mới đều đẻ một migration** — một
-- khoản thuế lặp lại, và tệ hơn: nó là loại lỗi CHỈ LỘ RA LÚC CHẠY THẬT. Bản 0013
-- viết đúng vào ngày có 3 lá, và đúng đến khi có lá thứ 4; lúc đó nó không báo
-- "thiếu migration" mà báo một lỗi ràng buộc khó đọc giữa luồng onboarding.
-- Đây là cùng lớp bẫy "CHECK ĐÓNG" mà `events.action_type` đã cắn 6 lần và phải
-- vá bằng 0019 + 0020.
--
-- Nới tới `[A-Z]` KHÔNG làm mất tính kiểm: nó vẫn chặn ký tự thường, chữ số, ký
-- tự lạ và chuỗi rỗng — tức vẫn chặn đúng thứ một CHECK nên chặn (dữ liệu RÁC).
-- Còn "mã này có phải một lá CÓ THẬT không" là câu hỏi của TẦNG ỨNG DỤNG, nơi
-- `nenTheoMa()` đọc thẳng `AVATAR_NEN` và trả null cho mã lạ. Một nguồn chân lý,
-- đặt ở chỗ nó thay đổi được mà không cần migrate dữ liệu sống (A8.9).
--
-- Chỉ NỚI, không siết: mọi dòng đang hợp lệ vẫn hợp lệ ⇒ không cần dọn dữ liệu.
-- ---------------------------------------------------------------------------

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_dien_mao_dang_chuan;
ALTER TABLE users ADD CONSTRAINT users_dien_mao_dang_chuan
    CHECK (dien_mao ~ '^2[A-Z][0-9a-z]([0-9a-z]{2}|--)([0-9a-z]{2}[0-9a-v]{2}[01]){0,64}$');

-- Ràng buộc `nen` do Postgres tự đặt tên (avatar_so_huu_nen_check). Tra tên thật
-- rồi drop, thay vì đoán — tên tự sinh đổi theo thứ tự cột và không đáng để tin.
DO $$
DECLARE ten TEXT;
BEGIN
    SELECT con.conname INTO ten
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
     WHERE rel.relname = 'avatar_so_huu'
       AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) LIKE '%nen%~%';
    IF ten IS NOT NULL THEN
        EXECUTE format('ALTER TABLE avatar_so_huu DROP CONSTRAINT %I', ten);
    END IF;
END $$;

ALTER TABLE avatar_so_huu ADD CONSTRAINT avatar_so_huu_nen_dang_chuan
    CHECK (nen ~ '^[A-Z]$');

COMMENT ON CONSTRAINT users_dien_mao_dang_chuan ON users IS
    'Dải mã nền [A-Z] là LƯỚI CHẶN RÁC, không phải danh sách lá hợp lệ. '
    'Lá có thật hay không do config/avatar.ts quyết (nenTheoMa) — xem đầu 0021.';
