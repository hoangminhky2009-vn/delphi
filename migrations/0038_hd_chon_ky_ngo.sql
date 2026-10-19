-- ═══════════════════════════════════════════════════════════════════════════
-- `hd_chon_ky_ngo` — CÚ CHỌN NHIỆM VỤ KỲ NGỘ (D85/D86 §1, doc 06 §4)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠⚠ MIGRATION NÀY PHẢI Ở CÙNG COMMIT VỚI CODE GHI NÓ. Không phải kỷ luật
-- hình thức: câu INSERT `hd_chon_ky_ngo` nằm TRONG transaction của cú NỘP VÒNG
-- (A7 — event đi cùng hành động nghiệp vụ). `events.action_type` là CHECK ĐÓNG,
-- nên DB từ chối một loại chưa khai ⇒ CẢ transaction ROLLBACK ⇒ người chơi chọn
-- nhiệm vụ xong thì CHỐT VÒNG hỏng, và hỏng theo kiểu khó hiểu nhất: bấm mãi
-- không đi tiếp được. D79 đã trả đúng cái giá này cho `hd_dat_short`, lỗ mở từ
-- 27/07 tới 11/08 mà không một bài test nào chạm tới.
--
-- LOẠI NÀY GHI GÌ (xem `server/holdem_api.ts`, khối `hd_chon_ky_ngo`):
--   value_json  = { vong, chon, moi }  — `moi` là bộ ĐƯỢC CHÀO (3 trong 4).
--                 Thiếu `moi` là mất phép so "lựa chọn thứ hai khi món ruột
--                 vắng mặt" — một trục data mà bản thuần không bao giờ có.
--   snapshot    = bối cảnh vòng (ô đang lật, Vốn, số người sống, fx) — chọn
--                 trong lúc đang thắng hay đang cháy là hai hành vi khác nhau.
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

    IF dinh_nghia LIKE '%hd_chon_ky_ngo%' THEN
        RETURN;
    END IF;

    -- ⚠ Mốc `'::text]'` — pg_get_constraintdef không in hậu tố kiểu mảng (0019).
    moi := replace(dinh_nghia, '::text]', '::text, ''hd_chon_ky_ngo''::text]');

    IF moi NOT LIKE '%hd_chon_ky_ngo%' THEN
        RAISE EXCEPTION
            'không chèn được loại event mới vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;
