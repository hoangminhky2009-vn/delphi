-- ═══════════════════════════════════════════════════════════════════════════
-- `hd_chon_trait` — LỜI TỰ KHAI PHONG CÁCH: chọn trait ở mốc (v55, D409)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠⚠ MIGRATION NÀY PHẢI ĐI CÙNG COMMIT VỚI CODE GHI NÓ (A11.4).
--
-- Câu INSERT `action_type = 'hd_chon_trait'` nằm TRONG transaction của cú NỘP VÒNG
-- MỐC (A7 — event đi cùng hành động nghiệp vụ). CHECK từ chối một loại chưa khai ⇒
-- cả transaction ROLLBACK ⇒ **người chơi chọn trait thì CHỐT VÒNG thất bại** — đúng
-- ca `hd_dat_short` (0037) và `hd_tiet_kiem` (0062) đã trả giá. Không lặp lại.
--
-- VÌ SAO ĐÂY LÀ `events` chứ không phải `telemetry` (A9): lựa chọn có NIỀM TIN —
-- người chơi tự khai "tôi sống chung được với tật này" (GÔNG CÙM = tự nhận trần
-- 40%, MỘT GIỎ = tự nhận chỉ ôm 2 mã) và trận sau đó KIỂM lời khai ấy. Đây là lớp
-- INTENT trong bốn lớp Context → Intent → Behavior → Outcome (kiến trúc 25/09).
-- Ghi CẢ lượt mời (`moi`) chứ không chỉ lá lấy: chọn giữa những gì được mời mới
-- là dữ liệu; và ghi cả cú bị bỏ qua (`bo_qua`) — ý định sai luật cũng là ý định.
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

    IF dinh_nghia LIKE '%hd_chon_trait%' THEN
        RETURN;
    END IF;

    -- ⚠ Mốc `'::text]'` — pg_get_constraintdef không in hậu tố kiểu mảng (0019).
    moi := replace(dinh_nghia, '::text]', '::text, ''hd_chon_trait''::text]');

    IF moi NOT LIKE '%hd_chon_trait%' THEN
        RAISE EXCEPTION
            'không chèn được loại event mới vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;
