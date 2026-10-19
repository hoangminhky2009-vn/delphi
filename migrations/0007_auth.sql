-- GĐ2 / Migration 0007 — Auth, session, age gate, xóa tài khoản (anonymize).
--
-- Thiết kế (A8.9 — hạn chế nợ kỹ thuật):
--   * TÁCH `auth_accounts` khỏi `users`: đăng ký/verify xảy ra TRƯỚC onboarding;
--     `users` chỉ ra đời trong transaction hoàn tất onboarding (cùng signup_grant
--     + event onboard_demo) → không có user "nửa vời" nào trong bảng nghiệp vụ.
--   * KHÔNG dùng citext (contrib có thể vắng ở môi trường khác) — email lưu
--     lowercase + CHECK + UNIQUE: zero dependency, portable mọi Postgres.
--   * KHÔNG lưu năm sinh (C7): chỉ `pending_age_band` tính từ năm sinh lúc đăng ký,
--     chuyển sang users.age_band khi onboard xong rồi biến mất cùng account.
--   * Session/token lưu HASH (sha256), không lưu giá trị thô → lộ DB không lộ được
--     phiên của ai.

-- ---------------------------------------------------------------------------
-- auth_accounts — danh tính đăng nhập
-- ---------------------------------------------------------------------------
CREATE TABLE auth_accounts (
    account_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             TEXT NOT NULL UNIQUE
                      CHECK (email = lower(email) AND email LIKE '%_@_%.__%' AND length(email) <= 254),
    password_hash     TEXT NOT NULL,
    email_verified_at TIMESTAMPTZ,
    -- age_band suy từ năm sinh lúc đăng ký; năm sinh KHÔNG được lưu (C7)
    pending_age_band  TEXT CHECK (pending_age_band IN ('16-17', '18-22', '23-30', '31-45', '46+')),
    -- NULL cho tới khi onboarding hoàn tất
    user_id           UUID UNIQUE REFERENCES users (user_id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auth_accounts_user_idx ON auth_accounts (user_id);

-- ---------------------------------------------------------------------------
-- auth_sessions — phiên đăng nhập (cookie httpOnly giữ token thô, DB giữ hash)
-- ---------------------------------------------------------------------------
CREATE TABLE auth_sessions (
    token_hash   TEXT PRIMARY KEY,
    account_id   UUID NOT NULL REFERENCES auth_accounts (account_id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (expires_at > created_at)
);

CREATE INDEX auth_sessions_account_idx ON auth_sessions (account_id);
CREATE INDEX auth_sessions_expires_idx ON auth_sessions (expires_at);

-- ---------------------------------------------------------------------------
-- auth_tokens — token dùng một lần: verify email / reset mật khẩu
-- ---------------------------------------------------------------------------
CREATE TABLE auth_tokens (
    token_hash TEXT PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES auth_accounts (account_id) ON DELETE CASCADE,
    purpose    TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auth_tokens_account_purpose_idx ON auth_tokens (account_id, purpose);

-- ---------------------------------------------------------------------------
-- auth_attempts — đếm lần thử để rate limit (theo IP và theo email)
-- Không phải ledger: được xóa (login thành công → reset chuỗi sai liên tiếp).
-- ---------------------------------------------------------------------------
CREATE TABLE auth_attempts (
    id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bucket TEXT NOT NULL,          -- vd 'login:email:a@b.c' | 'register:ip:1.2.3.4'
    at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auth_attempts_bucket_at_idx ON auth_attempts (bucket, at DESC);

-- ---------------------------------------------------------------------------
-- users: đánh dấu tài khoản đã xóa (anonymize — hồ sơ ở lại để ledger/events
-- không mồ côi; email biến mất cùng dòng auth_accounts).
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- RLS: bảng mới BẮT BUỘC bật (luật ghi ở migration 0006) — chặn PostgREST/anon.
-- ---------------------------------------------------------------------------
ALTER TABLE auth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_tokens   ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON auth_accounts, auth_sessions, auth_tokens, auth_attempts FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON auth_accounts, auth_sessions, auth_tokens, auth_attempts FROM authenticated;
    END IF;
END $$;
