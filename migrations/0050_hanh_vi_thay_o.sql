-- 0050 — CỜ "VÒNG NÀY BỊ ĐÁM ĐÔNG SỬA ĐỀ BÀI" (D205, 31/08).
--
-- ⚠⚠ VÌ SAO ĐÂY LÀ LỖ THẬT, không phải "thêm cho đầy đủ":
-- Hai máy phản-thân (D4) và bẻ-chuỗi-vốn (D160) THAY MẶT ô sắp lật khi bàn dồn
-- đủ mạnh. Vòng đó người chơi vẫn ra quyết định như thường — nhưng ĐỀ BÀI họ
-- nhận đã bị chính đám đông sửa. Trước bản này, sổ thay ô (`st.phan_than` /
-- `st.be_chuoi`) KHÔNG rời khỏi engine: không ra DTO, không vào `events`, không
-- có cột nào ở đây. Nghĩa là mọi đường đọc gộp (thẻ tính cách · phong cách ·
-- cột "xuất B2B sau này") đang TRỘN hai loại quan sát khác bản chất:
--   · vòng THƯỜNG      → hành vi trước một đề bài do seed viết;
--   · vòng BỊ THAY Ô   → hành vi trước một đề bài do CHÍNH ĐÁM ĐÔNG viết lại.
-- Trộn rồi kết luận "người này ưa rủi ro" là đọc HOÀN CẢNH thành TÍNH CÁCH —
-- đúng lỗi mà cả tầng D106 dựng ra để tránh, và đúng lớp lỗi 0046 vừa vá cho
-- (cỡ map × vai).
--
-- ⭐ MAY LÀ KHÔNG PHẢI CỬA MỘT CHIỀU. Bảng này PHÁI SINH và engine TẤT ĐỊNH, nên
-- `scripts/hanh_vi_dung_lai.ts` dựng lại được cờ cho MỌI trận đã lưu từ trước —
-- replay chạy lại đúng hai máy đó. Nếu cờ này bắt buộc phải nằm trong `events`
-- thì mọi trận trước hôm nay đã vĩnh viễn không tách được (A3.3 append-only).
-- Đây là lần thứ hai kiến trúc phái sinh D106 trả tiền cho chính nó.
--
-- ⚠ KHÔNG LỌC BỎ vòng bị thay khi đọc — mùa này n≈3–5, lọc là còn 0 mẫu. Hồ sơ
-- KHAI RA tỷ lệ (cùng nếp `lop_data` D178: nói mình đang là hỗn hợp nào).

ALTER TABLE hanh_vi_vong
  ADD COLUMN IF NOT EXISTS thay_o_do TEXT;

COMMENT ON COLUMN hanh_vi_vong.thay_o_do IS
  'Ô của vòng này bị THAY vì hành vi đám đông: phan_than (đếm ghế, D4) | be_chuoi (đếm vốn, D160) | NULL = không. Dòng dựng trước 0050 cũng là NULL — dựng lại để có.';

-- Index phục vụ đúng câu hỏi mới: "cắt hồ sơ của một người theo vòng sạch/bẩn".
-- Partial vì phần lớn dòng là NULL (cơ chế nổ ~1,7 lần/trận trên bàn dồn, và
-- phần lớn bàn không dồn) — index đầy ở đây là trả tiền cho hàng triệu NULL.
CREATE INDEX IF NOT EXISTS hanh_vi_vong_thay_o_idx
  ON hanh_vi_vong (user_id, thay_o_do)
  WHERE thay_o_do IS NOT NULL;
