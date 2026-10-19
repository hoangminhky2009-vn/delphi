-- ═══════════════════════════════════════════════════════════════════════════
-- 0083 — CHỈ MỤC CHO MỌI KHOÁ NGOẠI · PK CHO HAI BẢNG TELEMETRY TỔNG HỢP
--        (SPEC va-bao-mat-chuan-hoa-api-dot-1, Gói 3: D1 · D2)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- (1) D1 — Postgres KHÔNG tự tạo chỉ mục cho cột FK (chỉ cho cột được trỏ tới). Thiếu nó thì mỗi lần xoá/sửa dòng
-- cha (xoá tài khoản ⇒ `users`, dọn kèo ⇒ `markets`) Postgres quét CẢ bảng con để kiểm ràng buộc, dưới khoá ghi;
-- và mọi truy vấn "của người/kèo này" theo cột đó cũng quét cả bảng.
-- Danh sách đo bằng `npm run erd:ghi` (mục "Canh" của `docs/api/erd.md`), không gõ tay: 23 FK. SPEC đếm 20 — ba cái
-- thêm (`bets.user_id` · `dot_phat_hanh.mau_id` · `rank_dang_ky.user_id`) đã có chỉ mục MỘT PHẦN với điều kiện khác
-- `cột IS NOT NULL` (`WHERE NOT is_seed`, `WHERE trang_thai = …`), không phủ hàng ngoài điều kiện ⇒ vẫn quét.
-- Năm FK có chỉ mục một phần `WHERE cột IS NOT NULL` thì ĐỦ (phép tra FK `cột = $1` kéo theo NOT NULL) — không thêm.
-- Bài canh sống mãi: `tests/khoa_ngoai_co_chi_muc.test.ts` (canh cả FK thêm sau này).
--
-- (2) D2 — `telemetry_ngay` (0024) · `telemetry_ngay_nhom` (0026) là hai bảng duy nhất không PK. KHÔNG biến UNIQUE
-- thành PK được: PK ép NOT NULL mọi cột khoá, mà `man` / `age_band` / `region` / `occupation_band` NULL có nghĩa thật
-- (khách chưa đăng nhập, sự kiện ngoài màn — 0024 · 0026 · 0025 bác sentinel). Nên thêm khoá thay thế `id` identity;
-- UNIQUE `NULLS NOT DISTINCT` giữ nguyên làm khoá nghiệp vụ, `ON CONFLICT (…)` ở `server/telemetry_cuon.ts` không đổi
-- (DO UPDATE ghi đè tại chỗ ⇒ `id` của một ô không đổi khi cuộn lại).
--
-- ⚠ Một transaction (runner `scripts/migrate.ts`), không `CONCURRENTLY`: prod ~38 MB, khoá ghi thoáng qua.
-- ⚠ Đi cùng commit với bài canh (A11.4). Không đổi dữ liệu, không đổi luật.

-- ---------------------------------------------------------------------------
-- (1) Chỉ mục FK — theo thứ tự bảng
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS admin_audit_admin_id_idx              ON admin_audit (admin_id);
CREATE INDEX IF NOT EXISTS admin_phan_khuc_tao_boi_idx           ON admin_phan_khuc (tao_boi);
CREATE INDEX IF NOT EXISTS avatar_dan_sticker_id_idx             ON avatar_dan (sticker_id);
CREATE INDEX IF NOT EXISTS avatar_dan_user_id_idx                ON avatar_dan (user_id);
CREATE INDEX IF NOT EXISTS avatar_so_huu_khung_id_idx            ON avatar_so_huu (khung_id);
CREATE INDEX IF NOT EXISTS bet_intents_market_id_idx             ON bet_intents (market_id);
CREATE INDEX IF NOT EXISTS bet_intents_user_id_idx               ON bet_intents (user_id);
CREATE INDEX IF NOT EXISTS bets_option_id_idx                    ON bets (option_id);
CREATE INDEX IF NOT EXISTS bets_user_id_idx                      ON bets (user_id);
CREATE INDEX IF NOT EXISTS burn_ledger_ref_market_id_idx         ON burn_ledger (ref_market_id);
CREATE INDEX IF NOT EXISTS dot_phat_hanh_mau_id_idx              ON dot_phat_hanh (mau_id);
CREATE INDEX IF NOT EXISTS holdem_ban_chu_user_id_idx            ON holdem_ban (chu_user_id);
CREATE INDEX IF NOT EXISTS huy_hieu_cap_sticker_id_idx           ON huy_hieu_cap (sticker_id);
CREATE INDEX IF NOT EXISTS kho_sticker_sticker_id_idx            ON kho_sticker (sticker_id);
CREATE INDEX IF NOT EXISTS markets_created_by_idx                ON markets (created_by);
CREATE INDEX IF NOT EXISTS markets_outcome_option_id_idx         ON markets (outcome_option_id);
CREATE INDEX IF NOT EXISTS rank_dang_ky_ban_id_idx               ON rank_dang_ky (ban_id);
CREATE INDEX IF NOT EXISTS rank_dang_ky_user_id_idx              ON rank_dang_ky (user_id);
CREATE INDEX IF NOT EXISTS scores_market_id_idx                  ON scores (market_id);
CREATE INDEX IF NOT EXISTS treasury_ledger_ref_market_id_idx     ON treasury_ledger (ref_market_id);
CREATE INDEX IF NOT EXISTS user_cosmetics_cosmetic_id_idx        ON user_cosmetics (cosmetic_id);
CREATE INDEX IF NOT EXISTS users_avatar_dang_mac_idx             ON users (avatar_dang_mac);
CREATE INDEX IF NOT EXISTS wallet_ledger_ref_market_id_idx       ON wallet_ledger (ref_market_id);

-- ---------------------------------------------------------------------------
-- (2) Khoá thay thế cho hai bảng telemetry tổng hợp
-- ---------------------------------------------------------------------------
ALTER TABLE telemetry_ngay      ADD COLUMN IF NOT EXISTS id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY;
ALTER TABLE telemetry_ngay_nhom ADD COLUMN IF NOT EXISTS id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY;

-- Sequence mới của hai cột identity: thu quyền vai PostgREST như 0006 đã làm với mọi sequence cũ (Supabase cấp mặc
-- định cho đồ mới tạo trong `public`).
DO $$
DECLARE
    s TEXT;
BEGIN
    FOREACH s IN ARRAY ARRAY[pg_get_serial_sequence('telemetry_ngay', 'id'),
                             pg_get_serial_sequence('telemetry_ngay_nhom', 'id')] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon', s);
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM authenticated', s);
        END IF;
    END LOOP;
END $$;
