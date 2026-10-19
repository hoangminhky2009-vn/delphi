-- 0059 — CỬA BÁN CHO HỆ THỐNG (B7a, mốc M1 — "bán được một món, T về ví").
--
-- Hai chỗ phải nới, cả hai đều là CHECK đóng và cả hai đều nới bằng cách ĐỌC
-- danh sách đang có rồi thêm — không chép tay danh sách (D61):
--   1. `wallet_ledger.reason` thêm `ban_cho_he_thong` — T về ví người bán (khuôn 0034).
--   2. `events.action_type` thêm `cho_ban` — sự kiện bán, ghi CÙNG transaction với
--      bút toán (A7/A11.4: INSERT nằm trong transaction nghiệp vụ, DB từ chối là
--      hỏng cả cú bán — đúng chỗ luật đó muốn) (khuôn 0047).
--
-- Không bảng mới. Sổ vật (0057) và quỹ chợ (0058) đã đủ chỗ đứng cho một cú bán.

BEGIN;

-- 1. wallet_ledger.reason += 'ban_cho_he_thong'
DO $$
DECLARE
    dang_co TEXT[];
    day     TEXT;
BEGIN
    SELECT array_agg(DISTINCT m[1]) INTO dang_co
      FROM pg_constraint c,
           LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z0-9_]+)''', 'g') m
     WHERE c.conrelid = 'wallet_ledger'::regclass
       AND c.conname  = 'wallet_ledger_reason_check';

    IF dang_co IS NULL THEN
        RAISE EXCEPTION 'khong doc duoc wallet_ledger_reason_check — dung doan, dung tay';
    END IF;

    SELECT string_agg(quote_literal(v), ', ' ORDER BY v) INTO day
      FROM (SELECT unnest(dang_co) AS v UNION SELECT 'ban_cho_he_thong') u;

    EXECUTE 'ALTER TABLE wallet_ledger DROP CONSTRAINT wallet_ledger_reason_check';
    EXECUTE format(
        'ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_reason_check CHECK (reason IN (%s))',
        day);
END $$;

-- 2. events.action_type += 'cho_ban'
DO $$
DECLARE
    dinh_nghia TEXT;
    moi        TEXT;
BEGIN
    SELECT pg_get_constraintdef(oid) INTO dinh_nghia
      FROM pg_constraint
     WHERE conname = 'events_action_type_check'
       AND conrelid = 'events'::regclass;

    IF dinh_nghia IS NULL THEN
        RAISE EXCEPTION 'không thấy events_action_type_check — schema lệch dự đoán';
    END IF;

    IF dinh_nghia LIKE '%cho_ban%' THEN
        RETURN;   -- idempotent với chính nó
    END IF;

    moi := replace(dinh_nghia, '::text]', '::text, ''cho_ban''::text]');

    IF moi NOT LIKE '%cho_ban%' THEN
        RAISE EXCEPTION 'không chèn được cho_ban vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format('ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;

COMMIT;
