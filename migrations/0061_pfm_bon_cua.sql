-- 0061 — PFM: BỐN CỬA CONSENT RIÊNG (D295, founder 06/09: "4 công tắc riêng và 1
-- công tắc chung cho cả 4 nếu muốn bật tắt nhanh").
--
-- Bốn cột BOOLEAN NOT NULL DEFAULT FALSE trên `users`, tên lấy ĐÚNG `CUA_PFM_COT`
-- ở `config/pfm_consent.ts` — MỘT NGUỒN cho tên cột (D61); SQL phía server ghép tên
-- từ đó, không gõ tay ở chỗ thứ hai:
--
--     pfm_cua_ket        — két sao lưu (POST /pfm/luu)
--     pfm_cua_dac_trung  — đặc trưng nghiên cứu + dấu vết thao tác (POST /pfm/dong-bo)
--     pfm_cua_thuong     — điểm danh & niêm phong tuần (POST /pfm/diem-danh, /pfm/tuan)
--     pfm_cua_noi_game   — QUYỀN ghép nhãn sổ ↔ thẻ tính cách; không canh đường nào
--
-- ⭐ VÌ SAO BỐN CỘT, KHÔNG PHẢI MỘT CỘT JSONB HAY BITMASK: mỗi cửa là một vị từ
-- SQL đứng trong WHERE của một cổng, và một cột boolean là thứ grep được, EXPLAIN
-- được, và `information_schema` kể ra được cho bài test canh. Một túi jsonb đưa câu
-- hỏi "cửa nào" quay lại vào code — đúng chỗ bản một-công-tắc đã không trả lời được.
--
-- ⚠ `pfm_consent` (0047) KHÔNG XOÁ. Nó đổi nghĩa thành "CÓ ÍT NHẤT MỘT CỬA BẬT" và
-- mọi chỗ đang đọc nó (`/me`, `xoa.ts`, thống kê) giữ nguyên hình. Server cập nhật
-- nó trong CÙNG câu UPDATE với cửa (server/pfm/api.ts) — hai cột không bao giờ được
-- lệch nhau giữa hai câu lệnh.
--
-- ⚠⚠ KHÔNG BACKFILL CỬA NÀO — và đây là phần đắt nhất của tệp này.
-- Bản đầu của migration bật ba cửa (ket · dac_trung · thuong) cho ai đang `pfm_consent =
-- TRUE`, lý lẽ: "họ đã đọc văn bản gộp `pfm_dong_bo`, bản ấy nói về ba dòng dữ liệu ấy".
-- Rà đối kháng bác lại, và bác đúng: CÙNG commit này bỏ chữ của `pfm_dong_bo` khỏi tự
-- điển client, và `config/pfm_consent.ts` tự ghi *"chữ của nó không cần giữ: chưa ai đọc"*.
-- Nên cú backfill ấy tạo ra ĐÚNG cái trạng thái mà tệp config mở đầu bằng lời cấm: cột nói
-- "đã đồng ý" mà không ai dựng lại được đồng ý với văn bản NÀO. Một cửa suy diễn là một cửa
-- không có vết — và consent là cửa MỘT CHIỀU (A11.17), chỗ duy nhất luật không dẻo.
--
-- ⇒ Không cửa nào được bật bởi migration. Thay vào đó GIỮ BẤT BIẾN của cột gộp:
-- `pfm_consent` từ 0061 nghĩa là "có ít nhất một cửa bật", nên hàng nào còn cờ gộp TRUE mà
-- bốn cửa đều đóng thì cờ ấy về FALSE. Người ấy (nếu có) sẽ được hỏi TỪNG cửa ở màn Cài
-- đặt — mất một lần bấm, đổi lại mỗi cửa có một vết thật.
-- `pfm_bat_dau` GIỮ NGUYÊN: nó là mốc lịch sử "lần đầu chạm PFM", không phải một quyền.
-- Dữ liệu KHÔNG bị đụng: xoá là việc riêng của `POST /pfm/xoa` (P9 🔒).
--
-- Đo prod 06/09 trước khi viết: **0 hàng** có `pfm_consent = TRUE` (chưa màn nào bật được
-- PFM trước D295) ⇒ trên prod câu UPDATE này chạm 0 hàng. Nó là NGUYÊN TẮC, không phải nhu
-- cầu — nhưng một migration phải đúng với mọi dữ liệu có thể có, kể cả dev/staging đã bật
-- cờ bằng fixture.
--
-- Idempotent: `IF NOT EXISTS` cho cột; câu UPDATE chỉ khớp trạng thái "cờ gộp bật mà bốn
-- cửa đóng" — sau khi nó chạy, không hàng nào còn ở trạng thái ấy. Chạy lần hai: 0 hàng.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS pfm_cua_ket        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pfm_cua_dac_trung  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pfm_cua_thuong     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pfm_cua_noi_game   BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
   SET pfm_consent = FALSE
 WHERE pfm_consent = TRUE
   AND NOT (pfm_cua_ket OR pfm_cua_dac_trung OR pfm_cua_thuong OR pfm_cua_noi_game);

COMMIT;
