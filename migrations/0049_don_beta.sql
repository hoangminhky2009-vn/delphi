-- ════════════════════════════════════════════════════════════════════════════
-- 0049 — CỬA THOÁT DỌN DỮ LIỆU BETA (founder 31/08)
--
-- Founder: *"chỉnh sửa/ xóa bớt hoặc cô lập data giai đoạn thử nghiệm để ko ảnh
-- hưởng đến dashboard phân tích product… Phase hiện tại đa số data thu được là
-- rác"*, và khi được nêu ràng buộc A3.3 thì chốt lại: *"Kệ mẹ mấy chỉ thị đó đi
-- cu. có ai dùng giai đoạn này ngoài t ngồi test đâu. CHỈ ko xóa tài khoản thôi."*
--
-- ─── ĐÂY LÀ MỘT CÚ UỐN LUẬT, VÀ NÓ ĐƯỢC GHI RA CHỨ KHÔNG LÁCH IM LẶNG ────────
-- A3.3 (events append-only) nằm trong nhóm 🔒 "không dẻo" của A11.17. Quy trình
-- mà chính A11.17 đặt ra cho tình huống này là: NÊU hoàn cảnh → đề xuất cách
-- lệch → hỏi founder → uốn xong GHI NHẬT KÝ. Ba bước đầu đã xong; file này là
-- bước thứ tư, và nó cố ý để lại vết ở tầng schema chứ không phải chỉ trong chat.
--
-- Hoàn cảnh, đo được chứ không phải cảm giác (prod 31/08):
--   · 95/179 trận (53%) mang `balance_version` ĐÃ BIẾN MẤT khỏi
--     `BO_LUAT_THEO_PHIEN_BAN` ⇒ `luatCua()` trả bộ cờ tắt hết ⇒ mọi phép dựng
--     lại từ chúng mô tả một trò khác. Lý do tồn tại của A3.3 là "dữ liệu là sản
--     phẩm, mất một dòng là mất doanh thu tương lai" (A1) — nhưng 838 event mô tả
--     một trò chưa từng phát hành thì không có doanh thu nào để mất, mà chúng lại
--     đang làm hỏng đúng cái bảng phân tích product mà A3.3 sinh ra để phục vụ.
--   · Mùa 0.0 chưa có người dùng ngoài founder (152/179 trận là của tài khoản
--     admin) và dữ liệu CHỈ phục vụ R&D, không bán, không chia (D63).
--
-- ⚠ CÁI KHÔNG ĐƯỢC UỐN, VÀ FILE NÀY KHÔNG ĐỤNG TỚI:
--   · `wallet_ledger` · `treasury_ledger` · `burn_ledger` — bất biến "tiền phải
--     CÂN" (A11.17 🔒, `npm run audit:supply`). Trigger của chúng GIỮ NGUYÊN,
--     không cửa nào. Xoá trận holdem không đụng ba bảng này (đã kiểm khoá ngoại:
--     holdem không ghi sổ ví), nên không có lý do nào để mở.
--   · `admin_audit` — giữ nguyên: nó chính là chỗ ghi lại cú dọn này.
--   · `users` / `auth_*` — founder khoanh vùng rõ: *"chỉ ko xóa tài khoản thôi"*.
--
-- ⚠⚠ ĐƯỜNG TẮT NÀY CÓ NGÀY CHẾT (A8.9 — "không có đường tắt tạm thời không có
-- ngày chết"): **gỡ cửa thoát này trước khi mời người ngoài vòng quen biết vào
-- app** (đúng cái mốc A10 đã đặt cho buổi tư vấn luật sư). Từ khoảnh khắc có
-- người lạ tạo dữ liệu, `events` thôi là sổ nháp của founder và A3.3 quay lại
-- hiệu lực tuyệt đối. Gỡ bằng migration mới đặt lại trigger `forbid_mutation`.
-- ════════════════════════════════════════════════════════════════════════════

-- Cửa thoát: chỉ DELETE được khi transaction TỰ KHAI `delphi.don_beta = '1'`.
-- Chuỗi cờ đặt bằng `set_config('delphi.don_beta','1',true)` — tham số thứ ba là
-- `is_local = true` nên cờ chết khi transaction kết thúc; nó không thể rò sang
-- kết nối khác trong pool (có bài test canh đúng chuyện này).
--
-- UPDATE VẪN CẤM TUYỆT ĐỐI, không cửa nào. Sửa một dòng đã ghi là làm hỏng bằng
-- chứng một cách không phát hiện được; xoá cả dòng thì ít nhất phép đếm biết.
CREATE OR REPLACE FUNCTION events_chan() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting('delphi.don_beta', true) = '1' THEN
        RETURN OLD;   -- đường dọn dữ liệu beta 0.0 (founder 31/08)
    END IF;
    RAISE EXCEPTION
        'events là append-only: % bị cấm (A3.3; dọn beta phải đặt delphi.don_beta)',
        TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS events_append_only ON events;
CREATE TRIGGER events_append_only
    BEFORE UPDATE OR DELETE ON events
    FOR EACH ROW EXECUTE FUNCTION events_chan();

-- TRUNCATE vẫn đi `forbid_mutation` — không cửa nào, kể cả khi cờ bật.
-- Lý do: TRUNCATE không đếm được nó vừa bỏ đi cái gì, không đi qua điều kiện
-- WHERE nào, và không thể xem trước. Mọi cú dọn phải là DELETE có mệnh đề, để
-- bản chạy khô nói đúng số dòng mà bản chạy thật sẽ bỏ.
DROP TRIGGER IF EXISTS events_no_truncate ON events;
CREATE TRIGGER events_no_truncate
    BEFORE TRUNCATE ON events
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
