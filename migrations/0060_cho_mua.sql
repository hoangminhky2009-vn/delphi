-- 0060 — CỬA MUA TỪ HỆ THỐNG (B7b, mốc M2 — "mua lại được một món, và phí chảy
-- vào đúng ba túi").
--
-- Bốn CHECK đóng phải nới, và cả bốn nới theo đúng khuôn 0034/0047/0059: ĐỌC
-- danh sách đang có rồi thêm, KHÔNG chép tay lại danh sách (D61 — bản sao thứ
-- hai sẽ trôi).
--
--   1. `wallet_ledger.reason`   += 'mua_cua_he_thong'  — T rời ví người mua.
--   2. `events.action_type`     += 'cho_mua'           — sự kiện mua.
--   3. `treasury_ledger.reason` += 'phi_cho_in'        — 2% phí về Kho bạc.
--   4. `burn_ledger.reason`     += 'phi_cho_burn'      — 3% phí đốt.
--
-- ⭐ VÌ SAO PHẢI CÓ HAI LÝ DO PHÍ MỚI, KHÔNG DÙNG LẠI `rake_in`/`rake_burn`.
-- Hai cái tên cũ thuộc về chợ dự báo, và chợ dự báo đang đóng băng (D86) — nên
-- hôm nay `rake_in ≈ 0` là một PHÉP ĐO có nghĩa: "nguồn thu cũ đã tắt". Đổ phí
-- chợ vật phẩm vào cùng cái tên ấy là xoá mất phép đo đó, và câu hỏi trung tâm
-- của cả bản thiết kế — *"chợ vật phẩm có thay nổi vai rake không?"* (D68/D263)
-- — sẽ không còn cách nào trả lời bằng SQL. Một cái tên là một cái đồng hồ.
--
-- Không bảng mới: sổ vật (0057) giữ hàng trong kho, quỹ chợ (0058) giữ tiền, và
-- ba sổ tiền cũ đã có sẵn chỗ cho ba mảnh của một khoản phí.

BEGIN;

-- 1. wallet_ledger.reason += 'mua_cua_he_thong'
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
      FROM (SELECT unnest(dang_co) AS v UNION SELECT 'mua_cua_he_thong') u;

    EXECUTE 'ALTER TABLE wallet_ledger DROP CONSTRAINT wallet_ledger_reason_check';
    EXECUTE format(
        'ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_reason_check CHECK (reason IN (%s))',
        day);
END $$;

-- 2. treasury_ledger.reason += 'phi_cho_in'
DO $$
DECLARE
    dang_co TEXT[];
    day     TEXT;
BEGIN
    SELECT array_agg(DISTINCT m[1]) INTO dang_co
      FROM pg_constraint c,
           LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z0-9_]+)''', 'g') m
     WHERE c.conrelid = 'treasury_ledger'::regclass
       AND c.conname  = 'treasury_ledger_reason_check';

    IF dang_co IS NULL THEN
        RAISE EXCEPTION 'khong doc duoc treasury_ledger_reason_check — dung doan, dung tay';
    END IF;

    SELECT string_agg(quote_literal(v), ', ' ORDER BY v) INTO day
      FROM (SELECT unnest(dang_co) AS v UNION SELECT 'phi_cho_in') u;

    EXECUTE 'ALTER TABLE treasury_ledger DROP CONSTRAINT treasury_ledger_reason_check';
    EXECUTE format(
        'ALTER TABLE treasury_ledger ADD CONSTRAINT treasury_ledger_reason_check CHECK (reason IN (%s))',
        day);
END $$;

-- 3. burn_ledger.reason += 'phi_cho_burn'
DO $$
DECLARE
    dang_co TEXT[];
    day     TEXT;
BEGIN
    SELECT array_agg(DISTINCT m[1]) INTO dang_co
      FROM pg_constraint c,
           LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z0-9_]+)''', 'g') m
     WHERE c.conrelid = 'burn_ledger'::regclass
       AND c.conname  = 'burn_ledger_reason_check';

    IF dang_co IS NULL THEN
        RAISE EXCEPTION 'khong doc duoc burn_ledger_reason_check — dung doan, dung tay';
    END IF;

    SELECT string_agg(quote_literal(v), ', ' ORDER BY v) INTO day
      FROM (SELECT unnest(dang_co) AS v UNION SELECT 'phi_cho_burn') u;

    EXECUTE 'ALTER TABLE burn_ledger DROP CONSTRAINT burn_ledger_reason_check';
    EXECUTE format(
        'ALTER TABLE burn_ledger ADD CONSTRAINT burn_ledger_reason_check CHECK (reason IN (%s))',
        day);
END $$;

-- 4. events.action_type += 'cho_mua'
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

    IF dinh_nghia LIKE '%cho_mua%' THEN
        RETURN;   -- idempotent với chính nó
    END IF;

    moi := replace(dinh_nghia, '::text]', '::text, ''cho_mua''::text]');

    IF moi NOT LIKE '%cho_mua%' THEN
        RAISE EXCEPTION 'không chèn được cho_mua vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format('ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;

COMMIT;
