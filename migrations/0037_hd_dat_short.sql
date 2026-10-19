-- ═══════════════════════════════════════════════════════════════════════════
-- `hd_dat_short` — LOẠI EVENT CODE ĐANG GHI MÀ DB TỪ CHỐI (rà soát 11/08)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠⚠ ĐÂY LÀ LỖI ĐANG MỞ, KHÔNG PHẢI DỌN DẸP.
--
-- `server/holdem_api.ts` INSERT `action_type = 'hd_dat_short'` mỗi khi người
-- chơi đặt lệnh short (đặc quyền lá PHÒNG HỘ, D33 — chọn vòng này, khớp vòng
-- sau). Nhưng `events_action_type_check` chưa bao giờ được nới cho nó.
--
-- HẬU QUẢ KHÔNG PHẢI "MẤT MỘT DÒNG LOG": câu INSERT đó nằm TRONG transaction
-- của cú NỘP VÒNG (A7 — event đi cùng hành động nghiệp vụ). CHECK từ chối ⇒
-- cả transaction ROLLBACK ⇒ người chơi cầm Phòng Hộ đặt short thì CHỐT VÒNG
-- thất bại, và thất bại theo kiểu khó hiểu nhất: bấm mãi không đi tiếp được.
-- Lỗi mở từ 27/07 (D33) và không một bài test nào chạm tới.
--
-- Nới CHECK theo lối CỘNG DỒN (bài học 0019 — gõ lại cả danh sách là xoá âm
-- thầm những loại đã thêm ở các migration trước).

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

    IF dinh_nghia LIKE '%hd_dat_short%' THEN
        RETURN;
    END IF;

    -- ⚠ Mốc `'::text]'` — pg_get_constraintdef không in hậu tố kiểu mảng (0019).
    moi := replace(dinh_nghia, '::text]', '::text, ''hd_dat_short''::text]');

    IF moi NOT LIKE '%hd_dat_short%' THEN
        RAISE EXCEPTION
            'không chèn được loại event mới vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;
