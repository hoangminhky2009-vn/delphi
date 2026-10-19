-- ════════════════════════════════════════════════════════════════════════════
-- 0055 — ĐÓNG CỬA THOÁT 0054 (D228, 03/09, cùng phiên)
--
-- 0054 tự đặt ngày chết NGAY TRONG PHIÊN NÓ ĐƯỢC MỞ (A8.9): dùng đúng một lần
-- để `scripts/don_data_beta.ts` gỡ `ref_market_id` trên ba sổ tiền rồi xoá nốt
-- `markets`/`market_options` còn sót từ D225. Việc đó đã xong — đo THẬT sau khi
-- chạy: `markets`/`market_options` còn 0 dòng, `ref_market_id` còn treo trên sổ
-- tiền = 0, `audit_supply.ts` báo CÂN (26.685 = 26.685, không đổi trước/sau).
--
-- Khoá lại NGAY, không đợi thêm lý do — cửa 0054 không còn việc gì để làm từ
-- đây: mọi kèo dựng sau này (nếu chợ dự báo mở lại, D86) tạo bằng luồng nghiệp
-- vụ bình thường, không qua đường dọn dữ liệu. Trả cả ba trigger về
-- `forbid_mutation()` — giống hệt `events` sau 0053 — và DROP hẳn
-- `cho_go_ref_market()`, không để lại cơ chế UPDATE nào trên ba bảng này.
-- ════════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS wallet_ledger_append_only ON wallet_ledger;
CREATE TRIGGER wallet_ledger_append_only
    BEFORE UPDATE OR DELETE ON wallet_ledger
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DROP TRIGGER IF EXISTS treasury_ledger_append_only ON treasury_ledger;
CREATE TRIGGER treasury_ledger_append_only
    BEFORE UPDATE OR DELETE ON treasury_ledger
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DROP TRIGGER IF EXISTS burn_ledger_append_only ON burn_ledger;
CREATE TRIGGER burn_ledger_append_only
    BEFORE UPDATE OR DELETE ON burn_ledger
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

DROP FUNCTION IF EXISTS cho_go_ref_market();
