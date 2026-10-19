-- 0064 — CỘT ĐO PHÂN TÁN: SỐ NHÓM TÀI SẢN ĐANG GIỮ (D323, 13/09).
--
-- ⚠⚠ VÌ SAO KHÔNG DÙNG `so_ma` CÓ SẴN: năng lực "phân tán rủi ro" (N3, xem
-- `docs/yeu-cau-ky-thuat/10-buoi-do-va-thang-nang-luc.md` §3.3) mà chỉ đếm SỐ
-- MÃ đang giữ thì hai mã CÙNG PHE (vd Crypto + VN30, cả hai `nhom: 'rui_ro'`
-- trong `config/holdem.ts TAI_SAN`) vẫn ra "hai mã" — tức "phân tán" trông y
-- hệt "dồn hết vào một rổ khác tên". `so_ma` không phân biệt được hai chuyện
-- đó; cột này đếm số NHÓM (rui_ro / phong_thu) khác nhau, không đếm số mã.
--
-- Bảng này PHÁI SINH (cùng nếp 0063): dựng lại được 100% từ `action_log` qua
-- `scripts/hanh_vi_dung_lai.ts`, không mất gì nếu thiếu cột hôm nay — nhưng
-- thêm hôm nay rẻ hơn hẳn "dựng lại trên dữ liệu sống" mai sau (A8.9).
--
-- ⚠⚠ NULL ≠ 0 — CÙNG LỚP LỖI VỚI 0063 (A11.2):
--   · NULL = dòng KHÔNG có mắt xích `tai_san` để đếm — trận dựng trước
--     `HANH_VI_FORMULA_VERSION` 2 (cột chưa tồn tại lúc trải), hoặc trận
--     không chạy luật NAV (không có `hd_chot_phien.chain`).
--   · 0    = CÓ chuỗi mắt xích mà không cầm mã tài sản nào trong đó (toàn
--     tiền mặt sau chốt vòng) — một QUAN SÁT, không phải thiếu dữ liệu.
-- Suy 0 cho dòng thuộc vế đầu là bịa ra hàng loạt quan sát "trận này không
-- phân tán" từ những trận mà khái niệm "nhóm" chưa từng được tính.

ALTER TABLE hanh_vi_vong
  ADD COLUMN IF NOT EXISTS so_nhom SMALLINT;

COMMENT ON COLUMN hanh_vi_vong.so_nhom IS
  'Số NHÓM tài sản khác nhau (rui_ro/phong_thu, config/holdem.ts TAI_SAN) đang giữ SAU khi chốt vòng. NULL = dòng không có mắt xích tai_san để đếm (trận cũ trước formula v2, hoặc không NAV) — KHÁC HẲN 0 = có chuỗi mà không cầm mã nào.';
