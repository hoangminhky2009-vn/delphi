-- ===========================================================================
-- 0020 — MỘT LOẠI EVENT: `hd_tran_het_han` (D38).
--
-- ---------------------------------------------------------------------------
-- VÌ SAO PHẢI CÓ MIGRATION CHO ĐÚNG MỘT DÒNG
--
-- `events.action_type` là CHECK ĐÓNG (0001 dòng 175). Bẫy này đã cắn SÁU lần
-- (0010, 0011, 0012, 0013, 0016, 0019 đều ghi lại), và nó cắn theo cách tệ nhất:
-- không phải migration đỏ, mà là INSERT nổ 23514 GIỮA transaction nghiệp vụ —
-- ở đây là giữa lúc tiến trình dọn đang đóng một trận. Dính đúng như vậy khi nối
-- D38 vào đường chạy: `dongTranQuaHan` chạy `UPDATE ... 'bo_dở'` xong thì INSERT
-- event ném 23514, tx rollback, và trận quá hạn KHÔNG BAO GIỜ đóng được — tick
-- thử lại mỗi phút, thất bại mỗi phút, im lặng.
--
-- Nới theo lối CỘNG DỒN (đọc `pg_get_constraintdef` rồi chèn) chứ KHÔNG gõ lại
-- danh sách: gõ lại thì mọi loại do migration số nhỏ hơn thêm vào mà mình quên
-- chép sẽ bị xoá âm thầm — đúng lỗ mà 0019 đã phải viết một file vá để chữa.
--
-- ---------------------------------------------------------------------------
-- VÌ SAO LOẠI EVENT NÀY ĐÁNG CÓ (A1 — dữ liệu mới là sản phẩm thật)
--
-- Nó đo TỶ LỆ BỎ TRẬN GIỮA CHỪNG và bỏ ở VÒNG NÀO. Đó chính là con số trả lời
-- câu founder hỏi 27/07 ("trận có đang quá dài không"), và không suy lại được từ
-- dữ liệu khác: một trận bỏ dở không có `hd_chot_phien`, không có bảng kết quả,
-- nên nếu không ghi ở đây thì nó biến mất khỏi bộ dữ liệu hoàn toàn — chỉ còn là
-- một dòng `holdem_matches` với status lạ. `events` append-only nên không
-- backfill được (A3.3): không log từ dòng đầu là mất vĩnh viễn.
-- ===========================================================================
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
    IF dinh_nghia LIKE '%hd_tran_het_han%' THEN
        RETURN;
    END IF;

    -- pg in ra dạng: CHECK ((action_type = ANY (ARRAY['a'::text, 'b'::text])))
    -- ⟹ `::text]` xuất hiện ĐÚNG MỘT LẦN, ở phần tử cuối. Chèn trước nó.
    moi := replace(
        dinh_nghia, '::text]', '::text, ''hd_tran_het_han''::text]');

    -- FAIL-CLOSED: định dạng constraint khác dự đoán thì NỔ ngay lúc migrate,
    -- chứ không im lặng giữ nguyên rồi để lỗi rơi vào giờ chạy thật.
    IF moi NOT LIKE '%hd_tran_het_han%' THEN
        RAISE EXCEPTION
            'không chèn được loại event mới vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;
