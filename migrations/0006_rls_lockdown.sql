-- GĐ0 / Migration 0006 — Khóa PostgREST/Data API (an ninh D11).
--
-- Kiến trúc D11: client KHÔNG BAO GIỜ gọi thẳng Supabase Data API — mọi thứ
-- đi qua /api/v1 trên Vercel. Nhưng Supabase mặc định expose schema public
-- qua PostgREST với anon key (vốn công khai). Không khóa = ai có anon key
-- đọc được mọi bảng.
--
-- Hai lớp khóa (đều vô hại trên Postgres thường ngoài Supabase):
-- 1) ENABLE ROW LEVEL SECURITY, KHÔNG tạo policy nào → anon/authenticated
--    bị từ chối toàn bộ. Kết nối của app (role postgres, owner bảng) không
--    bị ảnh hưởng — owner mặc định bypass RLS.
-- 2) REVOKE quyền của anon/authenticated (chỉ chạy nếu role tồn tại).
--
-- Bảng mới trong tương lai PHẢI kèm ENABLE ROW LEVEL SECURITY trong chính
-- migration tạo nó.

ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_options      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_ledger       ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_ledger     ENABLE ROW LEVEL SECURITY;
ALTER TABLE burn_ledger         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduler_heartbeat ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
        REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
        REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
    END IF;
END $$;
