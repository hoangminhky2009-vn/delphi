-- ═══════════════════════════════════════════════════════════════════════════
-- `hd_tiet_kiem` — HỢP ĐỒNG GỬI TIẾT KIỆM (v43, D314)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠⚠ MIGRATION NÀY PHẢI ĐI CÙNG COMMIT VỚI CODE GHI NÓ (A11.4).
--
-- Câu INSERT `action_type = 'hd_tiet_kiem'` nằm TRONG transaction của cú NỘP
-- VÒNG (A7 — event đi cùng hành động nghiệp vụ). CHECK từ chối một loại chưa
-- khai ⇒ cả transaction ROLLBACK ⇒ **người chơi gửi tiết kiệm thì CHỐT VÒNG
-- thất bại**, và thất bại theo kiểu khó hiểu nhất: bấm mãi không đi tiếp được.
-- Đó đúng ca `hd_dat_short` (0037) đã trả giá — lỗi mở suốt từ 27/07 tới 11/08
-- mà không một bài test nào chạm tới. Không lặp lại.
--
-- VÌ SAO GHI CẢ CÚ BỊ TỪ CHỐI: `value_json.ok = false` kèm `loi`. Ý ĐỊNH là dữ
-- liệu — "người chơi ĐỊNH gửi 75% ở vòng 9 nhưng không kịp đáo hạn" nói nhiều
-- về hành vi hơn là sự im lặng. Cùng nếp `hd_khoa_tai_san`.
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

    IF dinh_nghia LIKE '%hd_tiet_kiem%' THEN
        RETURN;
    END IF;

    -- ⚠ Mốc `'::text]'` — pg_get_constraintdef không in hậu tố kiểu mảng (0019).
    moi := replace(dinh_nghia, '::text]', '::text, ''hd_tiet_kiem''::text]');

    IF moi NOT LIKE '%hd_tiet_kiem%' THEN
        RAISE EXCEPTION
            'không chèn được loại event mới vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;
