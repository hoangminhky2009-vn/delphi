-- GĐ0 / Migration 0005 — bảng heartbeat cho scheduler 2 lớp (D11).
-- Lớp 1: pg_cron (source='pg_cron') ghi mỗi phút NGAY TRONG DB.
-- Lớp 2: cron-job.org → /api/v1/internal/tick (source='tick') ghi mỗi phút.
-- /api/v1/health coi hệ là "ốm" khi một trong hai chuỗi trễ > 3 phút.
-- (Việc ĐĂNG KÝ job pg_cron là setup riêng của môi trường Supabase —
--  xem scripts/supabase/setup_pg_cron.sql — vì pg_cron không có ở DB dev local.)

CREATE TABLE scheduler_heartbeat (
    id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source  TEXT NOT NULL CHECK (source IN ('pg_cron', 'tick')),
    beat_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scheduler_heartbeat_source_beat_idx
    ON scheduler_heartbeat (source, beat_at DESC);
