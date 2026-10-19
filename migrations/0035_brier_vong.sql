-- ═══════════════════════════════════════════════════════════════════════════
-- LƯU BRIER MỖI VÒNG (bản yêu cầu 04 §2.1 — việc số 1 của tuần cuối mùa 0.0)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- D67 dựng ĐỘ CHUẨN (Brier) mỗi vòng: `brierVong` tính đúng công thức A5.4,
-- hiện lên màn kết quả vòng… rồi VỨT. Không một bảng nào giữ nó.
--
-- ⚠⚠ ĐÂY LÀ LỖ MỘT CHIỀU ĐANG MỞ: Brier là thước "niềm tin có khớp thực tế
-- không" — cột B2B đúng nghĩa (A1), và là đầu vào của chỉ số tâm lý số 1 lẫn
-- số 6 (04 §3). `events` append-only nên MỌI vòng chơi trước khi migration này
-- chạy là mất vĩnh viễn — vì thế nó đứng đầu thứ tự thi công, trước cả v28.
--
-- Nới `events.action_type` theo lối CỘNG DỒN (bài học 0019: gõ lại danh sách
-- bằng tay là xoá âm thầm loại của migration số nhỏ hơn, và biểu hiện là INSERT
-- nổ 23514 GIỮA transaction ở lần chạy thật đầu tiên).

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

    -- Idempotent với chính nó.
    IF dinh_nghia LIKE '%hd_brier_vong%' THEN
        RETURN;
    END IF;

    -- ⚠ Mốc là `'::text]'` (phần tử cuối mảng), KHÔNG phải `']::text[]'` —
    -- pg_get_constraintdef không in hậu tố kiểu mảng. 0019 đã dính bẫy này.
    moi := replace(dinh_nghia, '::text]', '::text, ''hd_brier_vong''::text]');

    IF moi NOT LIKE '%hd_brier_vong%' THEN
        RAISE EXCEPTION
            'không chèn được loại event mới vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- ⚠ HAI THỨ CỐ Ý trong thiết kế dòng event (đọc trước khi "sửa cho gọn"):
--
-- 1. `value_num` = Brier (0..2, NUMERIC — cùng kiểu cột `scores.brier`). KHÔNG
--    phải token nên C5 không đòi INTEGER; scores (0001) là tiền lệ.
-- 2. CHỈ ghi khi Brier ≠ null. Toàn tiền mặt ⇒ null = "KHÔNG dự báo" (D67) —
--    ghi 0 là thưởng người không bao giờ vào lệnh điểm hoàn hảo, thước đo ngược
--    hẳn thứ nó đo. Còn "vòng nào đứng ngoài" đã đọc được từ `hd_cam_ket`
--    (vị thế rỗng), nên dòng null ở đây là dòng thừa chiếm chỗ vĩnh viễn (A9).
-- ══════════════════════════════════════════════════════════════════════════════
