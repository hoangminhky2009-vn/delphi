-- GĐ1 / Migration 0003 — Index phục vụ truy vấn nóng (A6).

-- Sảnh kèo + scheduler quét kèo tới giờ khóa
CREATE INDEX markets_status_lock_idx ON markets (status, lock_ts);

-- Aggregate pool theo kèo (đường nóng nhất khi resolve + snapshot)
CREATE INDEX bets_market_idx ON bets (market_id);

-- Kiểm cap 20% + "phân bổ của tôi" theo (user, market)
CREATE INDEX bets_user_market_idx ON bets (user_id, market_id) WHERE NOT is_seed;

-- Event analytics: theo user theo thời gian, và theo context (vd mọi event 1 kèo)
CREATE INDEX events_user_ts_idx ON events (user_id, ts);
CREATE INDEX events_context_idx ON events (context_id);

-- Lịch sử ví phân trang mới → cũ; lấy bút toán cuối để đối chiếu bankroll
CREATE INDEX wallet_ledger_user_entry_idx ON wallet_ledger (user_id, entry_id DESC);

-- Rank per-pool đọc scores theo (user, pool)
CREATE INDEX scores_user_pool_idx ON scores (user_id, pool);
