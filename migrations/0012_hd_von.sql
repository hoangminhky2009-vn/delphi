-- ===========================================================================
-- 0012 — LÕI VỐN: hai loại event của Đấu trường (Tái cơ cấu · Khoá nắm giữ).
--
-- Thêm đúng hai dòng: `hd_dao_danh_muc`, `hd_khoa_tai_san`.
--
-- ⚠ VÌ SAO PHẢI CÓ MIGRATION CHO HAI DÒNG: `events.action_type` là CHECK ĐÓNG,
-- không phải TEXT tự do. 0010 và 0011 đều đã ghi lại đúng cái bẫy này, và nó vẫn
-- cắn lần thứ ba — INSERT nổ 23514 lúc chạy thật, SAU khi vòng đã được ghi vào
-- `action_log`. Với transaction ở `/rounds` thì nó rollback cả vòng, tức người
-- chơi bấm chốt phiên và không có gì xảy ra.
--
-- VÌ SAO HAI LOẠI EVENT NÀY ĐÁNG CÓ (A1 — dữ liệu mới là sản phẩm thật):
--
--  · `hd_khoa_tai_san` đo CAM KẾT DÀI HẠN. Người chơi hứa nắm giữ một mã suốt
--    chu kỳ TRƯỚC khi biết ô kế lật ra gì, và trả giá rất đắt nếu bỏ giữa chừng.
--    Lựa chọn xảy ra trước kết quả nên nó là NIỀM TIN, không phải phản xạ — đúng
--    loại tín hiệu D25 dựng cả bộ khử nhiễu xã hội để bảo vệ.
--  · `hd_dao_danh_muc` đo PHẢN ỨNG HOẢNG. Cùng một cú bấm, đọc kèm `o_kind`/
--    `o_id` trong snapshot thì phân biệt được "tái cơ cấu có kế hoạch" với "bán
--    tháo ngay sau một ô xấu".
--
-- Hai cái này KHÔNG suy lại được từ kết quả trận, và `events` là append-only nên
-- không backfill được: không log bây giờ là mất vĩnh viễn.
--
-- LƯU Ý: hai lệnh này KHÔNG có cột DB nào của riêng chúng. Trạng thái khoá/đảo
-- suy lại được từ (seed, action_log) mỗi lần replay — xem `apDaoDanhMuc` /
-- `apKhoaTaiSan` trong server/holdem/engine.ts. Bảng `events` là kênh ĐO LƯỜNG,
-- không phải nguồn dựng lại trận.
-- ===========================================================================

ALTER TABLE events DROP CONSTRAINT events_action_type_check;
ALTER TABLE events ADD CONSTRAINT events_action_type_check CHECK (action_type IN
    -- v0.1 (GĐ1–GĐ4)
    ('onboard_demo', 'market_view', 'pool_reveal',
     'bet_place', 'bet_adjust', 'checkin', 'subsidy_claim',
    -- GĐ4.5 Đấu trường (loop cũ)
     'sb_match_start', 'sb_faction_pick', 'sb_shop_roll', 'sb_card_buy',
     'sb_alloc_set', 'sb_rule_set', 'sb_news_react', 'sb_round_end',
     'sb_match_end', 'sb_autopsy_view',
    -- Market Hold'em (lát 1)
     'hd_match_start', 'hd_tai_co_cau', 'hd_khao_sat_lai', 'hd_cam_ket',
     'hd_chot_phien', 'hd_tin_gia_lo', 'hd_chay', 'hd_match_end',
    -- Bảng điện tử: mở bảng có TRẢ PHÍ.
     'hd_mo_bang',
    -- Lõi vốn: hai cần gạt của nhịp 1 — xem đầu file.
     'hd_dao_danh_muc', 'hd_khoa_tai_san'));
