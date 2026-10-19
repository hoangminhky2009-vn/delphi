-- ════════════════════════════════════════════════════════════════════════════
-- 0053 — ĐÓNG CỬA THOÁT 0049 (D225, 03/09)
--
-- 0049 tự đặt ngày chết cho chính nó (A8.9 — "không có đường tắt tạm thời không
-- có ngày chết"): *"gỡ cửa thoát này TRƯỚC KHI MỜI NGƯỜI NGOÀI VÒNG QUEN BIẾT
-- VÀO APP… Gỡ bằng migration mới đặt lại trigger forbid_mutation."*
--
-- D225 (03/09) là lần dùng cửa này lần thứ hai và — theo đúng lý do founder ra
-- lệnh cú dọn ("làm sạch để tránh làm bẩn dữ liệu từ người thật SẮP TỚI ĐÂY") —
-- là lần CUỐI trước khi có người ngoài. Đóng lại NGAY, không đợi ngày người đầu
-- tiên thật sự bấm nút, vì cửa mở không có việc gì để làm từ thời điểm này: mọi
-- cú dọn tiếp theo (nếu có) là chuyện của một migration MỚI, tự đặt lý do và
-- ngày chết riêng — không phải hồi sinh cờ `delphi.don_beta` cũ.
--
-- `events` trở lại DÙNG CHUNG `forbid_mutation()` — giống hệt wallet_ledger /
-- treasury_ledger / burn_ledger / admin_audit từ migration 0002. Không còn hàm
-- nào trên `events` đọc `delphi.don_beta` nữa; hàm `events_chan()` bị DROP hẳn
-- (không để lại dead code có khả năng bị nhầm là "còn dùng được" nếu ai đó chỉ
-- đọc danh sách hàm mà không đọc trigger đang gắn).
-- ════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS events_append_only ON events;
CREATE TRIGGER events_append_only
    BEFORE UPDATE OR DELETE ON events
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DROP FUNCTION IF EXISTS events_chan();

-- events_no_truncate đã trỏ forbid_mutation() từ 0049, không cần đổi gì.
