-- ═══════════════════════════════════════════════════════════════════════════
-- ĐỔI TÊN HIỂN THỊ (founder 04/08: *"phải cho player đổi tên chứ"*)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Chuyện gấp vì cửa KHÁCH cấp tên máy: `khach_p83m0c21`. Đó là tên đọc được cho
-- MÁY CHỦ, không phải cho người ngồi cùng bàn. D25 nói thẳng thứ làm trò có sức
-- nặng là **đối thủ NHÌN THẤY mình** — mà một dãy ký tự ngẫu nhiên thì không ai
-- nhìn thấy ai cả.
--
-- ⚠ ĐỔI TÊN KHÔNG ĐỘNG TỚI LỊCH SỬ: `events`, `holdem_results`, `rank_diem`,
-- `scores` đều neo vào `user_id`. `handle` chỉ là NHÃN. Đó là lý do việc này rẻ
-- và lùi được — khác hẳn việc đổi danh tính (D64 luật 3).
--
-- ⚠ VÌ SAO PHẢI CÓ EVENT: A9 xếp "mặc avatar" vào `events`, và đổi tên đúng cùng
-- lớp — nó là DIỆN MẠO XÃ HỘI, thứ D25 gọi là stakes engine của trò này. Không
-- ghi thì bảng phân tích thấy một cái tên đổi mà không biết lúc nào, và `events`
-- append-only nên không backfill được.

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
    IF dinh_nghia LIKE '%handle_doi%' THEN
        RETURN;
    END IF;

    /*
     * ⚠ NỚI THEO LỐI CỘNG DỒN, KHÔNG VIẾT LẠI DANH SÁCH BẰNG TAY (bài học 0019).
     * Gõ lại toàn bộ danh sách thì mọi loại được thêm bởi một migration số nhỏ
     * hơn mà mình quên chép sẽ BỊ XOÁ ÂM THẦM — và biểu hiện không phải một
     * migration đỏ, mà là INSERT nổ 23514 giữa transaction, ở lần chạy thật đầu.
     *
     * ⚠ Mốc là `'::text]'` chứ không phải `']::text[]'` — `pg_get_constraintdef`
     * in `ARRAY['a'::text, 'b'::text]`, không có hậu tố `::text[]`. Sai mốc thì
     * replace() không đổi gì và nhánh fail-closed dưới đây nổ (0019 đã dính).
     */
    moi := replace(dinh_nghia, '::text]', '::text, ''handle_doi''::text]');

    IF moi NOT LIKE '%handle_doi%' THEN
        RAISE EXCEPTION
            'không chèn được loại event mới vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- ⚠ MỘT THỨ CỐ Ý KHÔNG LÀM: KHÔNG GIỮ CHỖ TÊN CŨ
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Đổi tên xong thì tên cũ được thả ra, và người khác lấy được ngay — tức mạo
-- danh được. Cách chặn là một bảng giữ chỗ N ngày, và nó KHÔNG khó.
--
-- Không làm ở mùa 0.0 vì mùa này ~150 người quen biết nhau (D64), nên mạo danh là
-- vấn đề xã hội chứ chưa phải vấn đề kỹ thuật. Nhưng đây là "để sau" CÓ ĐIỀU KIỆN
-- KÍCH HOẠT, không phải "để sau" vô hạn định (A8.9):
--     làm khi BXH công khai bật (`BXH.BAT`), hoặc khi mời người ngoài vòng quen biết.
-- Lúc đó tên trở thành thứ có giá trị để chiếm, và hôm nay thì chưa.
