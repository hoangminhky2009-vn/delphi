-- ═══════════════════════════════════════════════════════════════════════════
-- KHỚP LỆNH GIỮA VÒNG (founder 08/08: "không có nút chốt mua/bán ngay trong
-- phiên mà phải đợi round sau lệnh mới được khớp")
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Event `hd_khop_lenh`: một cú bấm KHỚP NGAY giữa vòng — hành động CÓ TIỀN
-- (phép thử A9) nên thuộc `events`, cùng transaction với cú ghi đuôi vào
-- `action_log`. Không có nó thì trình phân tích (04 §3) mù đúng nhịp giao dịch
-- chi tiết nhất: ai bán rồi NHÌN tiền về rồi mới mua, ai đặt cả cụm một lần.
--
-- Nới CHECK theo lối CỘNG DỒN (bài học 0019 — gõ lại danh sách là xoá âm thầm).

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

    IF dinh_nghia LIKE '%hd_khop_lenh%' THEN
        RETURN;
    END IF;

    -- ⚠ Mốc `'::text]'` — pg_get_constraintdef không in hậu tố kiểu mảng (0019).
    moi := replace(dinh_nghia, '::text]', '::text, ''hd_khop_lenh''::text]');

    IF moi NOT LIKE '%hd_khop_lenh%' THEN
        RAISE EXCEPTION
            'không chèn được loại event mới vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;
