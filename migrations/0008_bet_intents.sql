-- GĐ3 / Migration 0008 — bet_intents: idempotency cho POST /markets/:id/bets.
--
-- Chống double-click/mạng chập: client sinh idempotency_key mỗi lần bấm gửi;
-- server INSERT ... ON CONFLICT DO NOTHING trong CÙNG transaction đặt cược →
-- trùng key + cùng request_hash = trả lại response đã lưu, KHÔNG trừ ví lần 2;
-- trùng key + body khác = 409. TTL 24h — dọn trong /internal/tick.
-- KHÔNG phải ledger (xóa được theo TTL), không nằm trong nhóm append-only.

CREATE TABLE bet_intents (
    idempotency_key TEXT PRIMARY KEY
                    CHECK (length(idempotency_key) BETWEEN 8 AND 128),
    user_id         UUID NOT NULL REFERENCES users (user_id),
    market_id       UUID NOT NULL REFERENCES markets (market_id),
    request_hash    TEXT NOT NULL,
    response_json   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bet_intents_created_idx ON bet_intents (created_at);

-- RLS bắt buộc với bảng mới (luật ở migration 0006)
ALTER TABLE bet_intents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON bet_intents FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON bet_intents FROM authenticated;
    END IF;
END $$;
