-- ===========================================================================
-- 0011 — BẢNG ĐIỆN TỬ (Market Terminal nội bộ; người chơi thấy "Bảng điện tử").
--
-- Chỉ thêm MỘT loại event: `hd_mo_bang`.
--
-- ⚠ VÌ SAO PHẢI CÓ MIGRATION CHO ĐÚNG MỘT DÒNG: `events.action_type` là CHECK
-- ĐÓNG, không phải TEXT tự do (0010 đã ghi đúng cái bẫy này). Ghi event loại mới
-- mà không mở rộng constraint thì INSERT nổ 23514 lúc chạy thật — mà ở đây nó nổ
-- SAU khi phí 25 Vốn đã vào `action_log`, tức đúng chỗ tệ nhất.
--
-- VÌ SAO LOẠI EVENT NÀY ĐÁNG CÓ (A1 — dữ liệu mới là sản phẩm thật): người chơi
-- TRẢ TIỀN để xem số liệu môi trường. "Chịu mất 25 Vốn ở tình huống nào" là tín
-- hiệu hành vi hạng nhất — nó đo trực tiếp mức bất định người chơi tự cảm nhận,
-- và không đo được bằng cách nào khác. Không log ở đây thì tín hiệu mất vĩnh
-- viễn (events append-only, không backfill được).
--
-- LƯU Ý: phí Vốn KHÔNG sống trong bảng này. Nó nằm trong
-- `holdem_matches.action_log` vì trạng thái trận được REPLAY từ log — xem
-- docstring `apPhiMoBang` trong server/holdem/bang_dien_tu.ts. Bảng `events` là
-- kênh đo lường, không phải nguồn dựng lại trận.
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
    -- Bảng điện tử: mở bảng có TRẢ PHÍ (25 Vốn) — xem đầu file.
     'hd_mo_bang'));
