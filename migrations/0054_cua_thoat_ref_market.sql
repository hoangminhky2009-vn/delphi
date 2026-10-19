-- ════════════════════════════════════════════════════════════════════════════
-- 0054 — CỬA THOÁT HẸP: GỠ `ref_market_id` TRÊN BA SỔ TIỀN (D228, 03/09)
--
-- ─── ĐÂY LÀ CÚ UỐN LUẬT NẶNG NHẤT REPO TỪNG LÀM, GHI RA CHỨ KHÔNG LÁCH ───────
-- A11.17 liệt "tiền phải CÂN" là bất biến 🔒 DUY NHẤT của cả danh sách nói thẳng
-- về tiền. Migration 0049 (31/08) từng mở cửa cho `events`, và tự tuyên bố dứt
-- khoát: *"wallet_ledger · treasury_ledger · burn_ledger — … Trigger của chúng
-- GIỮ NGUYÊN, không cửa nào."* D225 (03/09) đo THẬT rằng lời hứa đó đúng — xoá
-- `markets` cần NULL `ref_market_id` trên ba sổ, và `forbid_mutation()` chặn
-- VÔ ĐIỀU KIỆN, không có cờ nào để bật.
--
-- D225 khi đó đã KHÔNG tự mở cửa — đúng quy trình A11.17/A8.2 (agent không tự
-- đặt tay vào bất biến 🔒): dừng, để lại 4 dòng `markets`/11 `market_options`
-- làm vỏ rỗng, hỏi thẳng founder. Founder (D228) chọn: **mở cửa thoát mới** để
-- xoá nốt, thay vì giữ vỏ. File này là cửa đó — và nó PHẢI hẹp hơn 0049 nhiều,
-- vì 0049 chỉ mở cho DELETE trên một bảng không giữ số dư; ở đây là ba bảng
-- CHÍNH LÀ nguồn recompute số dư (`npm run audit:supply`).
--
-- ─── HẸP TỚI MỨC NÀO ─────────────────────────────────────────────────────────
--  1. Chỉ UPDATE. DELETE vẫn cấm tuyệt đối trên cả ba bảng, không đổi gì.
--  2. Chỉ khi `ref_market_id` đi từ CÓ giá trị → NULL (không cho gán sang một
--     market khác, không cho set NULL→NULL vô nghĩa).
--  3. MỌI cột khác phải giữ NGUYÊN BYTE-CHO-BYTE — kiểm bằng
--     `to_jsonb(OLD) - 'ref_market_id' = to_jsonb(NEW) - 'ref_market_id'`, tức
--     `delta`/`amount`/`balance_after`/`reason`/`user_id`/`created_at` (tuỳ
--     bảng có cột nào) không thể đổi dù chỉ một bit. Không liệt tên cột tay vì
--     ba bảng không cùng hình dạng (`burn_ledger` dùng `amount`, không có
--     `delta`/`balance_after`/`user_id`) — jsonb-diff là cách DUY NHẤT đúng cho
--     cả ba mà không phải viết ba hàm khác nhau (A11.5 — một nguồn).
--  4. Chỉ trong transaction tự khai `delphi.go_ref_market = '1'` — CỤC BỘ
--     TRANSACTION, cùng cơ chế `set_config(..., true)` đã canh bằng test ở 0049
--     (không rò sang kết nối khác trong pool).
--  5. TRUNCATE vẫn đi `forbid_mutation()` — không cửa nào, kể cả cờ bật.
--
-- ⚠⚠ CỜ RIÊNG, KHÔNG DÙNG LẠI `delphi.don_beta`: cờ đó đã bị D225/0053 tuyên bố
-- "hết tác dụng vĩnh viễn" trên `events` — dùng lại tên cũ cho một cơ chế MỚI,
-- mạnh hơn (mở UPDATE trên sổ tiền) là tự làm mù chính tài liệu của mình.
--
-- ⚠⚠ ĐƯỜNG TẮT NÀY CÓ NGÀY CHẾT NGAY TRONG PHIÊN NÀY (A8.9): dùng đúng MỘT lần
-- để `scripts/don_data_beta.ts` xoá nốt `markets`/`market_options` còn sót lại
-- từ D225, sau đó khoá lại NGAY bằng migration kế tiếp (0055) — không lặp lại
-- bài học "mở rồi để treo" mà 0049 từng mắc (phải chờ tới D225 mới đóng).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cho_go_ref_market() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND current_setting('delphi.go_ref_market', true) = '1'
       AND OLD.ref_market_id IS NOT NULL
       AND NEW.ref_market_id IS NULL
       AND to_jsonb(OLD) - 'ref_market_id' = to_jsonb(NEW) - 'ref_market_id' THEN
        RETURN NEW;   -- CHỈ đường gỡ tham chiếu markets đã xoá (D225/D228)
    END IF;
    RAISE EXCEPTION
        'Bảng % là append-only: chỉ NULL ref_market_id qua cờ delphi.go_ref_market mới được phép, mọi cột khác phải giữ nguyên (CLAUDE.md A3.3/A3.10, migration 0054)',
        TG_TABLE_NAME
        USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS wallet_ledger_append_only ON wallet_ledger;
CREATE TRIGGER wallet_ledger_append_only
    BEFORE UPDATE OR DELETE ON wallet_ledger
    FOR EACH ROW EXECUTE FUNCTION cho_go_ref_market();

DROP TRIGGER IF EXISTS treasury_ledger_append_only ON treasury_ledger;
CREATE TRIGGER treasury_ledger_append_only
    BEFORE UPDATE OR DELETE ON treasury_ledger
    FOR EACH ROW EXECUTE FUNCTION cho_go_ref_market();

DROP TRIGGER IF EXISTS burn_ledger_append_only ON burn_ledger;
CREATE TRIGGER burn_ledger_append_only
    BEFORE UPDATE OR DELETE ON burn_ledger
    FOR EACH ROW EXECUTE FUNCTION cho_go_ref_market();

-- *_no_truncate giữ nguyên forbid_mutation() từ 0002 — không đổi, không cửa nào.
