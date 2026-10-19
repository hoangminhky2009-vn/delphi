-- 0063 — HAI CỘT ĐO HÀNH VI NGÂN HÀNG (D317, 09/09).
--
-- ⚠⚠ VÌ SAO MIGRATION NÀY PHẢI ĐI TRƯỚC CÚ LẬT v43, KHÔNG PHẢI SAU:
-- `balance-v43-nganhang` mở một loại quyết định tiền CHƯA TỪNG CÓ trong trận —
-- "khoá N ô lấy lãi cố định" và "phá cam kết của chính mình để lấy tiền về".
-- Đó là hai hành vi mà cả tầng D106 sinh ra để đo, và cột phải có mặt TRƯỚC
-- trận v43 đầu tiên. Không phải vì mất được dữ liệu — bảng này PHÁI SINH, và
-- `scripts/hanh_vi_dung_lai.ts` dựng lại được từ `action_log` (D50 đã trả tiền
-- cho kiến trúc này hai lần) — mà vì "dựng lại bảng trên dữ liệu sống" là đúng
-- món nợ A8.9 cấm nhận khi tránh được bằng một tệp .sql viết hôm nay.
--
-- ⭐ VÌ SAO HAI CỘT CHỨ KHÔNG MỘT: chúng đo hai thứ khác hẳn nhau.
--   · `tiet_kiem_bp` — TRẠNG THÁI: bao nhiêu phần trăm gia sản đang nằm trong
--     ô an toàn, cuối mỗi vòng. Cùng họ với `tien_mat_bp`, đọc chung được.
--   · `tk_huy_so`    — CÚ VỠ: vòng này người chơi phá bao nhiêu hợp đồng của
--     CHÍNH MÌNH trước hạn, chịu mất toàn bộ lãi treo. Đây là thứ đắt nhất
--     của cả cơ chế về mặt đo hành vi: một cam kết tự nguyện bị bẻ dưới áp
--     lực, có giá tiền cụ thể, ghi được đúng vòng nó xảy ra.
-- Gộp hai thứ này vào một cột là mất hẳn vế thứ hai: một người giữ nguyên 40%
-- gia sản trong sổ suốt trận và một người gửi 40% rồi rút sạch ở vòng bão có
-- thể cho ra cùng một chuỗi `tiet_kiem_bp` trung bình.
--
-- ⚠⚠ NULL ≠ 0, VÀ ĐÂY LÀ CHỖ DỄ SAI NHẤT CỦA CẢ TỆP (A11.2 / D62 / D67).
-- Dòng của trận chạy luật CŨ phải là NULL, KHÔNG phải 0. "0% gửi tiết kiệm"
-- là một QUAN SÁT — người chơi có cửa mà không bước vào. Trận trước v43 thì
-- KHÔNG CÓ CỬA. Điền 0 cho chúng là bịa ra hàng chục nghìn quan sát "người
-- này không thích gửi tiết kiệm" từ những trận mà nút ấy chưa tồn tại, và mọi
-- trung bình gộp sau đó lệch xuống mà không dấu hiệu nào báo. Nên: cả hai cột
-- NULLABLE, KHÔNG default, và tầng trải chỉ điền khi luật trận có `tietKiem`.

ALTER TABLE hanh_vi_vong
  ADD COLUMN IF NOT EXISTS tiet_kiem_bp INT,
  ADD COLUMN IF NOT EXISTS tk_huy_so    INT;

COMMENT ON COLUMN hanh_vi_vong.tiet_kiem_bp IS
  'Tỷ trọng NAV đang khoá trong hợp đồng gửi tiết kiệm SAU khi chốt vòng (bp, 10000 = toàn bộ). NULL = trận chạy luật chưa có cơ chế ngân hàng (KHÁC HẲN 0 = có cửa mà không gửi).';

COMMENT ON COLUMN hanh_vi_vong.tk_huy_so IS
  'Số hợp đồng bị HUỶ TRƯỚC HẠN trong vòng này (mất toàn bộ lãi treo). NULL = trận chạy luật chưa có cơ chế ngân hàng; 0 = có hợp đồng/có cửa mà không huỷ.';

-- Index partial, cùng lý lẽ 0050: phần lớn dòng sẽ là NULL (mọi trận trước v43)
-- hoặc 0, nên index đầy là trả tiền cho hàng triệu ô rỗng. Câu hỏi nó phục vụ là
-- câu hỏi ĐẮT: "cho tôi mọi vòng ai đó bẻ cam kết của chính mình".
CREATE INDEX IF NOT EXISTS hanh_vi_vong_tk_huy_idx
  ON hanh_vi_vong (user_id, ts)
  WHERE tk_huy_so > 0;
