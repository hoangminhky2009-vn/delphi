-- ===========================================================================
-- 0010 — MARKET HOLD'EM (lát 1). Codename nội bộ; người chơi thấy "Đấu trường".
--
-- TƯỜNG LỬA D24 LUẬT SỐ MỘT: Vốn/Lượt khảo sát/Quỹ vòng là CHIP ẢO, sống và
-- chết trong một trận. KHÔNG cột nào ở đây tham chiếu users.bankroll hay
-- quest_points, và KHÔNG có ledger nào. Thứ duy nhất rời khỏi trận là THỨ HẠNG.
--
-- D25/R1 — BỐI CẢNH ĐỐI THỦ: sự kiện `hd_cam_ket` PHẢI mang bối cảnh người
-- chơi ĐANG NHÌN THẤY lúc quyết định (bậc rank các đối thủ, số người sống, vị
-- thế Quỹ vòng). events là append-only nên thiếu trường = hỏng vĩnh viễn,
-- không backfill được. Đây là lý do các loại event dưới đây phải có mặt NGAY
-- từ migration đầu tiên của tính năng, chứ không thêm sau.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Trận
-- ---------------------------------------------------------------------------
CREATE TABLE holdem_matches (
    match_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id    UUID NOT NULL REFERENCES users (user_id),
    seed             BIGINT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'dang_choi'
                     CHECK (status IN ('dang_choi', 'xong', 'bo_dở')),
    vong_hien_tai    INT NOT NULL DEFAULT 1 CHECK (vong_hien_tai >= 1),
    -- Toàn bộ hành động đã nộp. Trạng thái trận KHÔNG được lưu rời: mỗi
    -- request replay engine từ log. Loại hẳn hai lớp bug — state trôi lệch
    -- khỏi log, và state mất khi serverless cold start (cùng lý do GĐ4.5).
    action_log       JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Sơ đồ ghế: ai là người, ai là bot nào (D25/R3 — bot phải lộ mặt là bot).
    ghe_json         JSONB NOT NULL,
    engine_version   TEXT NOT NULL,
    balance_version  TEXT NOT NULL,
    season_id        TEXT NOT NULL,
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at         TIMESTAMPTZ
);

CREATE INDEX idx_holdem_matches_owner ON holdem_matches (owner_user_id, started_at DESC);
CREATE INDEX idx_holdem_matches_open  ON holdem_matches (owner_user_id, status)
    WHERE status = 'dang_choi';

-- ---------------------------------------------------------------------------
-- Kết quả từng ghế (kể cả bot — cần cho thống kê cân bằng)
-- ---------------------------------------------------------------------------
CREATE TABLE holdem_results (
    result_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id      UUID NOT NULL REFERENCES holdem_matches (match_id) ON DELETE CASCADE,
    -- NULL khi ghế là bot/bóng.
    user_id       UUID REFERENCES users (user_id),
    ghe_id        TEXT NOT NULL,
    loai          TEXT NOT NULL CHECK (loai IN ('nguoi', 'bot', 'bong')),
    bot_id        TEXT,
    -- D25/R4: lưu BẬC, không lưu điểm — bậc là thứ đã hiển thị cho đối thủ.
    bac_rank      TEXT NOT NULL,
    hang          INT NOT NULL CHECK (hang >= 1),
    von_cuoi      INT NOT NULL CHECK (von_cuoi >= 0),
    vong_chay     INT,
    -- Danh mục lúc kết trận — phục vụ đo archetype sống sót (D24 mục 6).
    danh_muc_json JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id, ghe_id)
);

CREATE INDEX idx_holdem_results_user ON holdem_results (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;
CREATE INDEX idx_holdem_results_match ON holdem_results (match_id);

-- ---------------------------------------------------------------------------
-- Loại event mới. GIỮ NGUYÊN 17 loại cũ, thêm 8 loại holdem.
--
-- ⚠ Bẫy đã dính ở 0009: action_type là CHECK ĐÓNG, không phải TEXT tự do.
-- Thêm loại mới mà quên mở rộng constraint thì INSERT nổ 23514 lúc chạy thật.
-- ---------------------------------------------------------------------------
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
     'hd_match_start',   -- vào bàn
     'hd_tai_co_cau',    -- Tái cơ cấu / Giữ nguyên + thẻ đã mua
     'hd_khao_sat_lai',  -- khảo sát lại shop
     'hd_cam_ket',       -- Giữ vị thế / Tăng cam kết / Cắt lỗ  ← R1 bắt buộc
     'hd_chot_phien',    -- kết quả vòng + dây chuyền chấm điểm
     'hd_tin_gia_lo',    -- TIN GIẢ lộ mặt (đo phản ứng tín hiệu — 17.4)
     'hd_chay',          -- cháy tài khoản
     'hd_match_end'));

-- ---------------------------------------------------------------------------
-- Khoá PostgREST (BẮT BUỘC — 0006_rls_lockdown.sql: "Bảng mới trong tương lai
-- PHẢI kèm ENABLE ROW LEVEL SECURITY trong chính migration tạo nó").
-- Không CREATE POLICY nào → không role nào đọc được qua PostgREST; API đi
-- bằng connection string riêng nên không ảnh hưởng.
-- ---------------------------------------------------------------------------
ALTER TABLE holdem_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdem_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    END IF;
END $$;
