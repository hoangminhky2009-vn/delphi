-- GĐ1 / Migration 0001 — Toàn bộ bảng theo CLAUDE.md mục A6.
-- Quy ước kiểu:
--   * Mọi giá trị token (bankroll, amount, delta, payout...) là BIGINT (C5: integer).
--   * ENUM nghiệp vụ dùng TEXT + CHECK (dễ mở rộng bằng migration, không khóa cứng kiểu).
--   * Thời gian dùng TIMESTAMPTZ, lưu UTC (A8.8).
--   * PK bảng thực thể dùng UUID (portable giữa các nhà cung cấp Postgres);
--     PK bảng ledger/event dùng BIGINT IDENTITY (thứ tự chèn = thứ tự bút toán).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    user_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle           TEXT NOT NULL UNIQUE
                     CHECK (handle ~ '^[a-z0-9_]{3,20}$'),
    age_band         TEXT NOT NULL
                     CHECK (age_band IN ('16-17', '18-22', '23-30', '31-45', '46+')),
    region           TEXT NOT NULL
                     CHECK (region IN ('bac', 'trung', 'nam', 'khac')),
    occupation_band  TEXT NOT NULL
                     CHECK (occupation_band IN ('hs_sv', 'van_phong', 'tu_do', 'khac')),
    bankroll         BIGINT NOT NULL DEFAULT 0 CHECK (bankroll >= 0),
    quest_points     BIGINT NOT NULL DEFAULT 0 CHECK (quest_points >= 0),
    role             TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    research_consent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    season_id        TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- markets (outcome_option_id FK thêm sau khi có market_options)
-- ---------------------------------------------------------------------------
CREATE TABLE markets (
    market_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool                   TEXT NOT NULL CHECK (pool IN ('macro', 'life', 'event')),
    question_text          TEXT NOT NULL CHECK (length(question_text) > 0),
    -- A3.2: nguồn resolve BẮT BUỘC có trước khi mở kèo
    resolution_source_name TEXT NOT NULL CHECK (length(resolution_source_name) > 0),
    resolution_source_url  TEXT NOT NULL CHECK (length(resolution_source_url) > 0),
    resolution_note        TEXT,
    open_ts                TIMESTAMPTZ NOT NULL,
    lock_ts                TIMESTAMPTZ NOT NULL,
    resolve_deadline_ts    TIMESTAMPTZ NOT NULL,
    resolved_ts            TIMESTAMPTZ,
    outcome_option_id      UUID,
    status                 TEXT NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'open', 'locked', 'resolved', 'cancelled')),
    seed_per_option        BIGINT NOT NULL DEFAULT 0 CHECK (seed_per_option >= 0),
    season_id              TEXT NOT NULL,
    created_by             UUID NOT NULL REFERENCES users (user_id),
    CHECK (lock_ts > open_ts),
    CHECK (resolve_deadline_ts >= lock_ts),
    -- resolved thì phải có outcome + resolved_ts; cancelled thì không có outcome
    CHECK (status <> 'resolved' OR (outcome_option_id IS NOT NULL AND resolved_ts IS NOT NULL)),
    CHECK (status <> 'cancelled' OR outcome_option_id IS NULL)
);

-- ---------------------------------------------------------------------------
-- market_options
-- ---------------------------------------------------------------------------
CREATE TABLE market_options (
    option_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id  UUID NOT NULL REFERENCES markets (market_id),
    label      TEXT NOT NULL CHECK (length(label) > 0),
    sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
    -- biên khoảng "từ X đến dưới Y"; NULL nếu cửa không phải dạng khoảng
    range_low  NUMERIC,
    range_high NUMERIC,
    UNIQUE (market_id, sort_order),
    CHECK (range_low IS NULL OR range_high IS NULL OR range_high > range_low)
);

ALTER TABLE markets
    ADD CONSTRAINT markets_outcome_option_fk
    FOREIGN KEY (outcome_option_id) REFERENCES market_options (option_id);

-- ---------------------------------------------------------------------------
-- bets — mỗi (user, market, option) một dòng; seed là dòng user_id NULL
-- ---------------------------------------------------------------------------
CREATE TABLE bets (
    bet_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id  UUID NOT NULL REFERENCES markets (market_id),
    option_id  UUID NOT NULL REFERENCES market_options (option_id),
    user_id    UUID REFERENCES users (user_id),
    amount     BIGINT NOT NULL CHECK (amount >= 1),
    is_seed    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A3.6: seed không thuộc user nào; bet người chơi bắt buộc có user
    CHECK ((is_seed AND user_id IS NULL) OR (NOT is_seed AND user_id IS NOT NULL))
);

-- Chống trùng: 1 user 1 dòng mỗi option mỗi market; 1 dòng seed mỗi option
CREATE UNIQUE INDEX bets_user_market_option_uq
    ON bets (user_id, market_id, option_id) WHERE NOT is_seed;
CREATE UNIQUE INDEX bets_seed_market_option_uq
    ON bets (market_id, option_id) WHERE is_seed;

-- ---------------------------------------------------------------------------
-- wallet_ledger — append-only (trigger ở migration 0002)
-- ---------------------------------------------------------------------------
CREATE TABLE wallet_ledger (
    entry_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users (user_id),
    delta         BIGINT NOT NULL CHECK (delta <> 0),
    balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
    reason        TEXT NOT NULL CHECK (reason IN
                  ('signup_grant', 'bet_place', 'bet_adjust', 'payout',
                   'refund', 'subsidy', 'admin_adjust')),
    ref_market_id UUID REFERENCES markets (market_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- treasury_ledger — append-only, một sổ duy nhất toàn hệ thống
-- ---------------------------------------------------------------------------
CREATE TABLE treasury_ledger (
    entry_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    delta         BIGINT NOT NULL CHECK (delta <> 0),
    balance_after BIGINT NOT NULL,
    reason        TEXT NOT NULL CHECK (reason IN
                  ('rake_in', 'seed_out', 'seed_return', 'seed_win',
                   'subsidy_out', 'unclaimed_pool_in')),
    ref_market_id UUID REFERENCES markets (market_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- burn_ledger — append-only; tổng cung kiểm toán được
-- ---------------------------------------------------------------------------
CREATE TABLE burn_ledger (
    entry_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    amount        BIGINT NOT NULL CHECK (amount > 0),
    reason        TEXT NOT NULL CHECK (reason IN ('rake_burn', 'residual_burn')),
    ref_market_id UUID REFERENCES markets (market_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- scores — Brier per (user, market); pool denormalized để query rank per-pool
-- ---------------------------------------------------------------------------
CREATE TABLE scores (
    user_id     UUID NOT NULL REFERENCES users (user_id),
    market_id   UUID NOT NULL REFERENCES markets (market_id),
    pool        TEXT NOT NULL CHECK (pool IN ('macro', 'life', 'event')),
    brier       NUMERIC NOT NULL CHECK (brier >= 0 AND brier <= 2),
    resolved_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, market_id)
);

-- ---------------------------------------------------------------------------
-- rank_snapshots — v0.1 tính + lưu, KHÔNG hiển thị (A3.8)
-- ---------------------------------------------------------------------------
CREATE TABLE rank_snapshots (
    user_id         UUID NOT NULL REFERENCES users (user_id),
    pool            TEXT NOT NULL CHECK (pool IN ('macro', 'life', 'event')),
    rank_value      NUMERIC NOT NULL,
    markets_counted INTEGER NOT NULL CHECK (markets_counted >= 0),
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    formula_version TEXT NOT NULL,
    PRIMARY KEY (user_id, pool, computed_at)
);

-- ---------------------------------------------------------------------------
-- events — SẢN PHẨM THẬT của platform. APPEND-ONLY (trigger ở 0002).
-- ---------------------------------------------------------------------------
CREATE TABLE events (
    event_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             UUID REFERENCES users (user_id),
    ts                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    context_type        TEXT NOT NULL,
    context_id          TEXT,
    action_type         TEXT NOT NULL CHECK (action_type IN
                        ('onboard_demo', 'market_view', 'pool_reveal',
                         'bet_place', 'bet_adjust', 'checkin', 'subsidy_claim')),
    value_num           NUMERIC,
    value_json          JSONB,
    state_snapshot_json JSONB
);

-- ---------------------------------------------------------------------------
-- admin_audit — append-only
-- ---------------------------------------------------------------------------
CREATE TABLE admin_audit (
    audit_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id     UUID NOT NULL REFERENCES users (user_id),
    action       TEXT NOT NULL CHECK (length(action) > 0),
    payload_json JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
