-- GĐ1.1 / Migration 0004 — D10: Kho bạc genesis (Nhật ký quyết định 17/07/2026).
-- 1) Thêm 'genesis_grant' vào danh mục reason của treasury_ledger.
-- 2) Kho bạc KHÔNG bao giờ âm: CHECK balance_after ≥ 0.
-- 3) Bút toán genesis chỉ được tồn tại DUY NHẤT MỘT LẦN mỗi môi trường.

-- (1) Thay CHECK reason cũ bằng danh mục mới có 'genesis_grant'.
-- Tìm constraint theo nội dung (không dựa vào tên tự sinh) cho chắc chắn.
DO $$
DECLARE
    cname text;
BEGIN
    SELECT conname INTO cname
    FROM pg_constraint
    WHERE conrelid = 'treasury_ledger'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%reason%';
    IF cname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE treasury_ledger DROP CONSTRAINT %I', cname);
    END IF;
END $$;

ALTER TABLE treasury_ledger
    ADD CONSTRAINT treasury_ledger_reason_check CHECK (reason IN
        ('genesis_grant', 'rake_in', 'seed_out', 'seed_return', 'seed_win',
         'subsidy_out', 'unclaimed_pool_in'));

-- (2) Kho bạc không bao giờ âm — tấm lưới DB chặn mọi bug rút quá quỹ.
ALTER TABLE treasury_ledger
    ADD CONSTRAINT treasury_ledger_balance_after_nonneg CHECK (balance_after >= 0);

-- (3) genesis_grant duy nhất một lần.
CREATE UNIQUE INDEX treasury_ledger_genesis_once
    ON treasury_ledger ((reason)) WHERE reason = 'genesis_grant';
