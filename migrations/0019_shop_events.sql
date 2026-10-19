-- ===========================================================================
-- 0018 — HAI LOẠI EVENT CỦA SHOP: `shop_mua` · `gacha_mo`.
--
-- ---------------------------------------------------------------------------
-- ⚠ VÌ SAO HAI DÒNG NÀY KHÔNG NẰM TRONG `0015_shop.sql` (nơi chúng thuộc về)
--
-- `events.action_type` là một CHECK ĐÓNG, và ba migration cùng đợt đều nới nó —
-- nhưng KHÔNG cùng cách:
--
--   0016_nhiem_vu : nới BẰNG CÁCH CHÈN vào định nghĩa đang có (DO block, đọc
--                   pg_get_constraintdef rồi replace) → cộng dồn được.
--   0017_rank     : nới bằng cách VIẾT LẠI TOÀN BỘ danh sách bằng tay.
--
-- Viết lại toàn bộ thì mọi loại được thêm bởi migration có số NHỎ HƠN mà không có
-- trong bản gõ tay đó sẽ BỊ XOÁ ÂM THẦM. Đặt `shop_mua`/`gacha_mo` ở 0015 nghĩa là
-- 0017 xoá chúng, và biểu hiện không phải một migration đỏ — nó là INSERT nổ 23514
-- GIỮA transaction mua hàng, sau khi người chơi đã bấm, ở lần chạy thật đầu tiên.
--
-- Nên file này mang số CAO HƠN 0017 và nới theo lối CỘNG DỒN: nó thêm vào bất kỳ
-- định nghĩa nào đang có, và tự bỏ qua nếu đã thêm rồi. Chạy lại bao nhiêu lần cũng
-- được, và nó không quan tâm danh sách hiện tại gồm những gì — nên migration sau này
-- có đổi thứ tự hay thêm loại thì file này vẫn đúng.
--
-- 👉 VIỆC CÒN LẠI CHO LUỒNG CHÍNH (không phải việc của file này): `0017_rank.sql`
--    đang xoá cả bốn loại của `0016_nhiem_vu` (`nv_diem_danh`, `nv_view`, `nv_xong`,
--    `bp_chang_nhan`) theo đúng cơ chế trên. Cách chữa gốc là 0017 dùng DO block
--    cộng dồn như 0016, chứ không phải mỗi đợt lại thêm một file vá đuôi.
--
-- ---------------------------------------------------------------------------
-- VÌ SAO HAI LOẠI NÀY ĐÁNG CÓ (A1 — dữ liệu mới là sản phẩm thật; A7)
--
--   · `shop_mua` — giá NIÊM YẾT, biết trước, không may rủi. Đây là mẫu quyết định
--     ĐỐI CHỨNG cho `gacha_mo`: cùng một người, một bên chọn cái chắc chắn, một bên
--     chọn cái ngẫu nhiên. Chênh lệch giữa hai bên là khẩu vị rủi ro đo trên tài sản
--     THẬT của họ, không phải trên chip ảo trong trận — thứ D25 phải dựng cả một bộ
--     luật để khử nhiễu, ở đây có sẵn và sạch.
--   · `gacha_mo` — ghi `b` (bậc trao), `bg` (bậc gốc trước khi hạ), `p` (có phải mốc
--     bảo hiểm), `du_t` (số dư SAU lượt) và `hat` (hạt ngẫu nhiên). `du_t` là trường
--     đắt nhất: nó cho biết ai quay tới sát ngưỡng chặn, tức ai đang đổi vốn dự báo
--     lấy ngoại hình — chỉ số §6.6 của docs/ui-ux/design_sticker_shop.md đòi theo dõi.
--     `hat` để một lượt quay TÁI LẬP ĐƯỢC khi có người hỏi "tôi có bị thiệt không";
--     rate công khai chỉ đáng tin nếu từng lượt kiểm lại được.
--
-- Cả hai KHÔNG backfill được (`events` append-only): không log từ dòng đầu là mất
-- vĩnh viễn.
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
    IF dinh_nghia LIKE '%gacha_mo%' THEN
        RETURN;
    END IF;

    -- pg in ra dạng: CHECK ((action_type = ANY (ARRAY['a'::text, ...])))
    -- ⚠ SỬA (luồng nhiệm vụ, 27/07): mốc cũ `']::text[]'` KHÔNG TỒN TẠI trong
    -- đầu ra của pg_get_constraintdef — nó in `ARRAY['a'::text, 'b'::text]`, không
    -- có hậu tố `::text[]`. Nên replace() không đổi gì, nhánh fail-closed nổ, và
    -- MỌI migration đứng lại ở đây (cả test suite đỏ). Mốc đúng là `'::text]'`,
    -- xuất hiện đúng một lần ở phần tử cuối.
    moi := replace(
        dinh_nghia,
        '::text]',
        '::text, ''shop_mua''::text, ''gacha_mo''::text]');

    IF moi NOT LIKE '%gacha_mo%' THEN
        RAISE EXCEPTION
            'không chèn được loại event mới vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;
