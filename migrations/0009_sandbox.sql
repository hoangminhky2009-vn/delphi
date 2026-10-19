-- ===========================================================================
-- 0009 — SANDBOX "Đấu trường" v0 (GĐ4.5 — D15 v2.1 + D16 + Prompt B VIỆC 2)
--
-- NGUYÊN TẮC LƯU TRỮ: KHÔNG lưu diễn biến trận.
--   Một trận = 12 vòng × 22 tick × 5 ghế. Lưu từng tick là ~1.300 dòng/trận;
--   5.000 user × 1 trận/ngày = 6,5 triệu dòng/ngày — thổi bay free tier
--   Supabase 500MB trong vài tuần (C1: 0đ/tháng).
--   Thay vào đó lưu ĐẦU VÀO: (map, seed, action_log). Engine tất định nên chạy
--   lại là dựng lại y hệt diễn biến (D16 mục 7.2). Đây cũng là cách chống gian
--   lận: server replay để xác minh, không tin số client khai (C4).
--
-- TƯỜNG LỬA A3.5: không bảng nào ở đây có cột token T, không khóa ngoại tới
--   wallet_ledger/treasury_ledger. Cột ticket_q_burned để dành cho v0.3 khi có
--   nguồn Q thật; ở v0.1 luôn = 0 (CHECK ép điều đó, xem cuối bảng).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- sandbox_matches — MỘT ván đấu (một kịch bản đã được khởi tạo)
-- ---------------------------------------------------------------------------
CREATE TABLE sandbox_matches (
    match_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- scenario_id = map. Đặt tên theo Prompt B để khớp từ vựng thiết kế.
    scenario_id    TEXT NOT NULL,
    seed           BIGINT NOT NULL CHECK (seed >= 0 AND seed <= 4294967295),
    mode           TEXT NOT NULL CHECK (mode IN ('thu_thach_ngay', 'dau_5', 'don')),
    table_id       TEXT NOT NULL CHECK (table_id IN ('tap', 'xep_hang', 'q40', 'q80')),

    -- Chủ ván (người bấm tạo). Ghost/bot ngồi các ghế còn lại.
    owner_user_id  UUID NOT NULL REFERENCES users (user_id),
    -- Ghế mà chủ ván ngồi; các ghế khác mô tả trong seat_plan.
    owner_seat     INTEGER NOT NULL DEFAULT 0 CHECK (owner_seat >= 0),
    -- [{seat, kind:'human'|'ghost'|'bot', archetype?, ghost_result_id?}]
    seat_plan      JSONB NOT NULL,

    status         TEXT NOT NULL DEFAULT 'playing'
                   CHECK (status IN ('playing', 'finished', 'abandoned')),
    current_round  INTEGER NOT NULL DEFAULT 0 CHECK (current_round >= 0),

    engine_version TEXT NOT NULL,
    season_id      TEXT NOT NULL,
    started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at    TIMESTAMPTZ,

    CHECK (status <> 'finished' OR finished_at IS NOT NULL)
);

CREATE INDEX idx_sandbox_matches_owner ON sandbox_matches (owner_user_id, started_at DESC);
CREATE INDEX idx_sandbox_matches_open  ON sandbox_matches (owner_user_id, status)
    WHERE status = 'playing';

-- ---------------------------------------------------------------------------
-- sandbox_results — kết quả + action_log của TỪNG ghế người trong ván
--
-- Ghế bot không có dòng ở đây (chính sách của chúng suy ra từ seed + seat_plan).
-- action_log của ghế người chính là NGUỒN GHOST cho ván sau: người tiếp theo
-- gặp "bóng" của bạn bằng cách phát lại đúng log này trên cùng seed.
-- ---------------------------------------------------------------------------
CREATE TABLE sandbox_results (
    result_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id        UUID NOT NULL REFERENCES sandbox_matches (match_id),
    user_id         UUID NOT NULL REFERENCES users (user_id),
    seat_index      INTEGER NOT NULL CHECK (seat_index >= 0),
    faction_id      TEXT,

    -- Toàn bộ đầu vào của người chơi: [{round, shopActions, enablePresets,
    -- orders, urgentOrder}]. Nguồn chân lý duy nhất để dựng lại ván.
    action_log      JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Số do SERVER tính sau khi chạy engine (không phải số client gửi lên).
    final_nav       INTEGER,
    hold_nav        INTEGER,
    vs_hold         INTEGER,
    rank            INTEGER CHECK (rank IS NULL OR (rank >= 1 AND rank <= 5)),
    turnover        INTEGER,
    busted          BOOLEAN NOT NULL DEFAULT false,
    season_points   INTEGER NOT NULL DEFAULT 0,

    -- Vé Q đã ĐỐT khi vào bàn. v0.1 LUÔN = 0: chưa có nguồn phát Q, và trigger
    -- users_quest_points_frozen (0002) cấm ghi quest_points. Bỏ CHECK này ở
    -- v0.3 CÙNG LÚC với migration nới trigger — không sớm hơn.
    ticket_q_burned INTEGER NOT NULL DEFAULT 0 CHECK (ticket_q_burned = 0),

    -- Ba vòng khóa chống rác data (D16 mục 7.4)
    is_replay       BOOLEAN NOT NULL DEFAULT false,
    is_practice     BOOLEAN NOT NULL DEFAULT true,
    is_private      BOOLEAN NOT NULL DEFAULT false,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (match_id, seat_index),
    -- Bàn tập không bao giờ tính điểm mùa (D15 mục 4).
    CONSTRAINT sandbox_practice_no_points CHECK (NOT (is_practice AND season_points <> 0)),
    -- Lượt chơi lại không tính điểm (chống farm — D16 mục 7.4 vòng khóa 2).
    CONSTRAINT sandbox_replay_no_points   CHECK (NOT (is_replay AND season_points <> 0))
);

CREATE INDEX idx_sandbox_results_user ON sandbox_results (user_id, created_at DESC);
-- Kho ghost: tìm log người thật đã chơi cùng kịch bản, ưu tiên gần đây.
CREATE INDEX idx_sandbox_results_ghost ON sandbox_results (match_id, seat_index);

-- Mỗi user CHỈ MỘT lượt tính điểm cho mỗi (kịch bản, seed) ở Thử thách ngày.
-- Ép ở tầng DB — không tin tầng ứng dụng nhớ kiểm.
CREATE UNIQUE INDEX uq_sandbox_daily_scored
    ON sandbox_results (user_id, match_id)
    WHERE NOT is_replay;

-- ---------------------------------------------------------------------------
-- season_points — điểm mùa cộng dồn (D16 mục 7.3)
-- ---------------------------------------------------------------------------
CREATE TABLE season_points (
    user_id    UUID NOT NULL REFERENCES users (user_id),
    season_id  TEXT NOT NULL,
    points     INTEGER NOT NULL DEFAULT 0,
    matches    INTEGER NOT NULL DEFAULT 0 CHECK (matches >= 0),
    tier       TEXT NOT NULL DEFAULT 'dong'
               CHECK (tier IN ('dong', 'bac', 'vang', 'bach_kim', 'kim_cuong')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, season_id)
);

-- ---------------------------------------------------------------------------
-- sandbox_mastery — thành thạo thẻ, kiếm bằng CHƠI (D15 mục 4.4)
--
-- Founder chốt "mastery thuần", từ chối biến thể gacha rút ngắn. Bảng này cố ý
-- KHÔNG có cột `bought_at`/`source`: đường ghi duy nhất là "đã chơi xong một
-- trận tính điểm". Muốn bán được mastery thì phải sửa schema qua migration —
-- tức là phải có người review, không lỡ tay thêm được.
-- ---------------------------------------------------------------------------
CREATE TABLE sandbox_mastery (
    user_id        UUID NOT NULL REFERENCES users (user_id),
    card_id        TEXT NOT NULL,
    scored_matches INTEGER NOT NULL DEFAULT 0 CHECK (scored_matches >= 0),
    tier           INTEGER NOT NULL DEFAULT 0 CHECK (tier BETWEEN 0 AND 3),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, card_id)
);

-- ---------------------------------------------------------------------------
-- KHUNG SHOP / COSMETIC / VINH DANH (D16 phần III) — DỰNG SẴN, CHƯA BẬT
-- D18 v2: flags COSMETICS / GACHA / HONOR = OFF ở GĐ4.5. Tạo bảng trước để sau
-- bật bằng cờ chứ không phải bằng migration gấp giữa mùa (A8.9).
-- ---------------------------------------------------------------------------
CREATE TABLE cosmetic_items (
    cosmetic_id TEXT PRIMARY KEY,
    family      TEXT NOT NULL CHECK (family IN ('dien_mao', 'danh_phan')),
    kind        TEXT NOT NULL CHECK (kind IN ('skin', 'khung', 'hieu_ung', 'theme')),
    label       TEXT NOT NULL,
    rarity      TEXT NOT NULL CHECK (rarity IN ('thuong', 'hiem', 'epic')),
    -- Giá niêm yết bằng Q. NULL = không bán (chỉ rơi từ gacha hoặc merit).
    price_q     INTEGER CHECK (price_q IS NULL OR price_q > 0),
    -- Họ 2 "Danh phận" CHỈ đến từ merit — không xu Q/T nào chạm được (D16 mục 13).
    CONSTRAINT cosmetic_danh_phan_not_purchasable
        CHECK (NOT (family = 'danh_phan' AND price_q IS NOT NULL))
);

CREATE TABLE user_cosmetics (
    user_id     UUID NOT NULL REFERENCES users (user_id),
    cosmetic_id TEXT NOT NULL REFERENCES cosmetic_items (cosmetic_id),
    source      TEXT NOT NULL CHECK (source IN ('shop_q', 'gacha_t', 'merit')),
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    equipped    BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, cosmetic_id)
);

-- Danh xưng (Họ 2 "Danh phận") — CHỈ merit, không mua được bằng bất cứ gì.
CREATE TABLE user_titles (
    user_id    UUID NOT NULL REFERENCES users (user_id),
    title_id   TEXT NOT NULL,
    -- Lý do được trao: 'chien_luoc_gia_mua', 'top_brier_pool', ...
    merit_kind TEXT NOT NULL,
    season_id  TEXT NOT NULL,
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    equipped   BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, title_id, season_id)
);

-- Cosmetic KHÔNG trao đổi / bán lại / rời tài khoản (D16 mục 11 — bỏ đúng
-- tính giao dịch được của mô hình CS:GO, ngòi nổ pháp lý). Không có bảng
-- chuyển nhượng, và chốt cứng: user_id của một dòng không bao giờ đổi.
CREATE OR REPLACE FUNCTION forbid_cosmetic_transfer() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Cosmetic không được chuyển nhượng (D16 mục 11)'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER user_cosmetics_no_transfer
    BEFORE UPDATE ON user_cosmetics
    FOR EACH ROW EXECUTE FUNCTION forbid_cosmetic_transfer();

CREATE TRIGGER user_titles_no_transfer
    BEFORE UPDATE ON user_titles
    FOR EACH ROW EXECUTE FUNCTION forbid_cosmetic_transfer();

-- ---------------------------------------------------------------------------
-- burn_ledger: thêm lý do 'gacha_burn' (Prompt B VIỆC 2)
--
-- Gacha đốt 100% T (D16 mục 3). Chuẩn bị sẵn lý do, CHƯA CÓ CODE NÀO DÙNG —
-- flag GACHA = OFF. Thêm bây giờ để lúc bật v0.3 không phải chạy migration
-- gấp trên prod đang sống.
-- ---------------------------------------------------------------------------
ALTER TABLE burn_ledger DROP CONSTRAINT burn_ledger_reason_check;
ALTER TABLE burn_ledger ADD CONSTRAINT burn_ledger_reason_check
    CHECK (reason IN ('rake_burn', 'residual_burn', 'gacha_burn'));

-- ---------------------------------------------------------------------------
-- events: nới danh mục action_type cho sandbox (A7 + D15 mục 7 + Prompt B)
--
-- events.action_type có CHECK chốt cứng danh mục v0.1 (0001 dòng 175). Đó là
-- thiết kế ĐÚNG — "công thức index viết TRƯỚC, suy ngược trường cần log" (A7),
-- nên danh mục phải là danh sách đóng, không phải TEXT tự do. Thêm loại event
-- mới thì phải khai báo ở đây, cố ý bắt người viết dừng lại suy nghĩ.
--
-- Giữ nguyên 7 loại cũ, thêm 10 loại sandbox theo đúng tên Prompt B VIỆC 2.
-- ---------------------------------------------------------------------------
ALTER TABLE events DROP CONSTRAINT events_action_type_check;
ALTER TABLE events ADD CONSTRAINT events_action_type_check CHECK (action_type IN
    -- v0.1 (GĐ1–GĐ4)
    ('onboard_demo', 'market_view', 'pool_reveal',
     'bet_place', 'bet_adjust', 'checkin', 'subsidy_claim',
    -- GĐ4.5 Đấu trường
     'sb_match_start', 'sb_faction_pick', 'sb_shop_roll', 'sb_card_buy',
     'sb_alloc_set', 'sb_rule_set', 'sb_news_react', 'sb_round_end',
     'sb_match_end', 'sb_autopsy_view'));

-- ---------------------------------------------------------------------------
-- Khóa PostgREST cho bảng mới (BẮT BUỘC — xem 0006_rls_lockdown.sql:
-- "Bảng mới trong tương lai PHẢI kèm ENABLE ROW LEVEL SECURITY trong chính
-- migration tạo nó"). Không có dòng này thì ai cầm anon key của Supabase đọc
-- được toàn bộ lịch sử chơi của mọi user.
-- ---------------------------------------------------------------------------
ALTER TABLE sandbox_matches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_points    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sandbox_mastery  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosmetic_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cosmetics   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_titles      ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    END IF;
END $$;

COMMENT ON TABLE sandbox_matches IS
    'Đấu trường: lưu ĐẦU VÀO (seed + action_log ở sandbox_results) chứ không '
    'lưu diễn biến — engine tất định dựng lại được. Xem migrations/0009 đầu file.';
