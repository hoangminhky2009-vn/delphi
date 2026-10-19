-- 0046 — PHÂN LOẠI DATA THEO CỠ MAP + VAI (D178, 30/08).
--
-- Founder 30/08: *"chú ý luôn phần thu data theo mỗi map và role (VD map 8 thì áp
-- lực thời gian, role cá mập thì có vốn nhiều) cho 1 loại data khác nhau. Phân loại
-- rõ vào"*.
--
-- ⚠⚠ VÌ SAO ĐÂY LÀ LỖ THẬT, KHÔNG PHẢI "THÊM CHO ĐẦY ĐỦ":
-- `hanh_vi_vong` (0043) không có cột nào nói trận đó CỠ MAP mấy hay ghế đó VAI gì.
-- Nghĩa là mọi đường đọc gộp — thẻ tính cách, phong cách, admin, và cột "xuất B2B
-- sau này" mà chính 0043 hứa — đang TRỘN ba loại quan sát khác bản chất vào một rổ:
--   · map 8  = ÁP LỰC THỜI GIAN + mật độ tin cao nhất (D177: 42% ô phải quyết,
--     2,39 tin/trận) ⇒ đo được "quyết dưới sức ép", KHÔNG đo được "đọc chu kỳ";
--   · map 16 = CHU KỲ ĐỦ DÀI (1,60 chuỗi ≥2 ô/trận) ⇒ ngược lại;
--   · vai cá mập = VỐN GẤP BA + lõi Đòn Bẩy GHIM ⇒ mọi con số "khẩu vị rủi ro"
--     của ghế đó là khẩu vị CỦA MỘT NGƯỜI ĐANG CÓ VỐN LỚN VÀ BỊ ÉP ĐÒN BẨY, không
--     phải khẩu vị tự do (D107/D108 dựng vai chính là để ép khác nhau).
-- Trộn ba thứ đó rồi kết luận "người này ưa rủi ro" là đọc HOÀN CẢNH thành TÍNH CÁCH
-- — đúng lỗi mà D106 dựng cả tầng chung chuyển này để tránh.
--
-- ⚠ HAI CỘT NÀY LÀ KHOÁ CẮT, KHÔNG PHẢI KẾT LUẬN. Ý nghĩa của từng tổ hợp (đo được
-- gì / KHÔNG đo được gì) nằm ở `LOP_DATA` trong `config/holdem.ts` — một nguồn, sửa
-- một chỗ. Bảng chỉ chở dữ kiện thô.
--
-- PHÁI SINH như cả bảng: dựng lại bằng `scripts/hanh_vi_dung_lai.ts`, không migrate
-- dữ liệu cũ ở đây (NULL = dòng dựng trước 0046, dựng lại là có).

ALTER TABLE hanh_vi_vong
  ADD COLUMN IF NOT EXISTS so_o SMALLINT,
  ADD COLUMN IF NOT EXISTS vai  TEXT;

COMMENT ON COLUMN hanh_vi_vong.so_o IS
  'Cỡ map của trận (8/12/16) — khoá cắt lớp data. NULL = dòng dựng trước 0046.';
COMMENT ON COLUMN hanh_vi_vong.vai IS
  'Vai của GHẾ NÀY trong trận (ca_nhan/doi_lai/ca_map/to_chuc). NULL = trận không vai (map 8) hoặc dòng cũ.';

-- Index phục vụ đúng câu hỏi mới: "cắt hồ sơ theo lớp data của một người".
-- Cắt-ngang theo lớp (mọi user, một lớp) đi bằng seq scan — mùa này n nhỏ, và
-- thêm index thứ hai lúc chưa có ai hỏi là tối ưu sớm (A8.9).
CREATE INDEX IF NOT EXISTS hanh_vi_vong_user_lop_idx
  ON hanh_vi_vong (user_id, so_o, vai);
