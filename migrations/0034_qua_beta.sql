-- 0034 — QUÀ TRI ÂN MÙA BETA 0.0 (D68b, founder chốt 04/08)
--
-- Bốn món: 500 T (rút Kho bạc) · 500 Q (phát mới) · 3 thẻ tạo phòng · Dấu niêm
-- Beta. Điều kiện: xong 4 việc lõi + chơi 3 trận. Trần 30 người.
--
-- Migration này trả bốn thứ DB phải giữ, và không thứ nào là "cho tiện":
--   (1) sổ ghi ai đã nhận — chốt cuối chống nhận hai lần;
--   (2) chỗ chứa thẻ tạo phòng;
--   (3) ba enum `reason`/`action_type` phải nới, nếu không nhánh cấp nổ 500;
--   (4) không có gì khác. Trần 30 người KHÔNG nằm ở DB — xem ghi chú (1).

-- (1) -------------------------------------------------------------------------
-- SỔ NHẬN QUÀ. `user_id` là khoá chính ⇒ nhận hai lần là BẤT KHẢ, kể cả khi hai
-- tab bấm cùng lúc và phép kiểm ở tầng code cùng đọc "chưa nhận".
--
-- ⚠ TRẦN 30 NGƯỜI CỐ Ý *KHÔNG* Ở ĐÂY. Một CHECK kiểu `(SELECT COUNT(*)…) <= 30`
-- không viết được trong Postgres (CHECK không được chứa truy vấn con), còn
-- trigger đếm thì vẫn thua đua ghi ở READ COMMITTED — hai transaction cùng đếm
-- 29 rồi cùng chèn. Trần được giữ bằng ADVISORY LOCK ở `server/qua_beta.ts`:
-- khoá → đếm → chèn, tuần tự tuyệt đối. Ghi ra đây vì người đọc schema sẽ đi
-- tìm trần trong DB và không thấy.
--
-- `so_thu_tu` là thứ tự nhận thật (1..30), gán DƯỚI KHOÁ. Nó không phải SERIAL:
-- SERIAL không lùi khi transaction rollback nên nó sẽ đếm cả những lượt hỏng,
-- và trần 30 sẽ chặn sớm hơn 30 người thật.
CREATE TABLE qua_beta_nhan (
    user_id     UUID PRIMARY KEY REFERENCES users (user_id),
    season_id   TEXT NOT NULL,
    so_thu_tu   INTEGER NOT NULL CHECK (so_thu_tu > 0),
    so_t        BIGINT NOT NULL CHECK (so_t >= 0),
    so_q        INTEGER NOT NULL CHECK (so_q >= 0),
    so_the      INTEGER NOT NULL CHECK (so_the >= 0),
    nhan_luc    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (season_id, so_thu_tu)
);

-- RLS bắt buộc theo 0006: bảng mới phải khoá trong chính migration tạo nó.
ALTER TABLE qua_beta_nhan ENABLE ROW LEVEL SECURITY;

-- (2) -------------------------------------------------------------------------
-- THẺ TẠO PHÒNG. Một cột đếm trên `users`, không phải bảng riêng.
--
-- ⚠ TẠO PHÒNG ĐANG KHOÁ Ở SẢNH (card khoá, tính năng chưa xây — xem
-- `docs/thiet-ke-de-xuat/noi-dung/lan-toa-va-khoanh-khac.md` §3). Nên đây là VÉ CHO MỘT
-- CÁNH CỬA CHƯA MỞ. Founder chọn phát dù đã đọc cảnh báo đó, và điều kiện kèm
-- theo là màn phải nói rõ — không thì nó là đúng thứ A8.9 cấm.
--
-- Cột đếm chứ không phải bảng: thẻ không có danh tính riêng (không seri, không
-- ngày hết hạn, không nguồn gốc phải truy). Dựng một bảng cho nó là dựng hạ tầng
-- cho một khái niệm chưa tồn tại — đúng thứ "tối ưu sớm" A8.9 dặn tránh. Ngày
-- nào thẻ cần danh tính thì migrate, và lúc đó ta đã biết nó cần gì.
ALTER TABLE users ADD COLUMN the_tao_phong INTEGER NOT NULL DEFAULT 0
    CHECK (the_tao_phong >= 0);

-- (3) -------------------------------------------------------------------------
-- BA ENUM PHẢI NỚI. Thiếu bất kỳ cái nào thì nhánh cấp quà nổ 500 ở đúng lượt
-- đầu tiên — và bài học 04/08 (`gacha_trung`, migration 0033) là lớp lỗi này
-- KHÔNG lộ ra khi test đường thường: nó lộ lúc có người thật bấm nút.

-- ⚠⚠ BA KHỐI DƯỚI ĐÂY ĐỀU NỚI **THEO HIỆU**, KHÔNG CHÉP LẠI DANH SÁCH.
--
-- Bản đầu của migration này GÕ CỨNG cả danh sách cho `wallet_ledger` và
-- `treasury_ledger` — chép đúng 8 và 7 giá trị đang có rồi thêm một. Nó chạy
-- đúng hôm nay, và đó chính là điều nguy hiểm: nó chỉ đúng CHỪNG NÀO không ai
-- thêm reason ở một migration khác trước nó.
--
-- CLAUDE.md đã ghi cái giá của lối viết đó: *"0017 chép danh sách của 0013 nên
-- làm 0018 đỏ"*. Và đợt này suýt trả giá thật — migration 0033/0034 viết khi
-- cây làm việc mới tới 0032, rồi repo tiến lên 0037 (Brier vòng · khớp lệnh ·
-- `hd_dat_short`). Lần này ba migration đó không đụng hai sổ tiền nên không mất
-- gì; lần sau thì không có gì bảo đảm.
--
-- Nới theo hiệu thì migration này không bao giờ xoá reason của ai, bất kể nó
-- chạy trước hay sau migration nào.

-- 3a. Ví người chơi: khoản T quà.
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
      FROM (SELECT unnest(dang_co) AS v UNION SELECT 'qua_beta_t') u;

    EXECUTE 'ALTER TABLE wallet_ledger DROP CONSTRAINT wallet_ledger_reason_check';
    EXECUTE format(
        'ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_reason_check CHECK (reason IN (%s))',
        day);
END $$;

-- 3b. Kho bạc: đây là nơi 500 T đi ra. KHÔNG tái dụng `subsidy_out` — trợ cấp và
--     quà tri ân là hai khoản chi khác nhau, và gộp chúng là làm hỏng đúng phép
--     đo "kho bạc còn gánh nổi trợ cấp bao lâu" mà D68 vừa phải tính tay.
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
      FROM (SELECT unnest(dang_co) AS v UNION SELECT 'qua_beta_out') u;

    EXECUTE 'ALTER TABLE treasury_ledger DROP CONSTRAINT treasury_ledger_reason_check';
    EXECUTE format(
        'ALTER TABLE treasury_ledger ADD CONSTRAINT treasury_ledger_reason_check CHECK (reason IN (%s))',
        day);
END $$;

-- 3c. Sổ Q.
DO $$
DECLARE
    dang_co TEXT[];
    day     TEXT;
BEGIN
    SELECT array_agg(DISTINCT m[1]) INTO dang_co
      FROM pg_constraint c,
           LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z0-9_]+)''', 'g') m
     WHERE c.conrelid = 'quest_ledger'::regclass
       AND c.conname LIKE '%reason%';

    IF dang_co IS NULL THEN
        RAISE EXCEPTION 'khong doc duoc rang buoc reason cua quest_ledger';
    END IF;

    SELECT string_agg(quote_literal(v), ', ' ORDER BY v) INTO day
      FROM (SELECT unnest(dang_co) AS v UNION SELECT 'qua_beta_q') u;

    EXECUTE format('ALTER TABLE quest_ledger DROP CONSTRAINT %I',
        (SELECT conname FROM pg_constraint
          WHERE conrelid = 'quest_ledger'::regclass AND conname LIKE '%reason%' LIMIT 1));
    EXECUTE format(
        'ALTER TABLE quest_ledger ADD CONSTRAINT quest_ledger_reason_check CHECK (reason IN (%s))',
        day);
END $$;

-- 3d. `events.action_type` — nới THEO HIỆU (idiom 0017), không chép lại danh sách.
DO $$
DECLARE
    dang_co TEXT[];
    them    TEXT[] := ARRAY['qua_beta_nhan'];
    day     TEXT;
BEGIN
    SELECT array_agg(DISTINCT m[1]) INTO dang_co
      FROM pg_constraint c,
           LATERAL regexp_matches(pg_get_constraintdef(c.oid), '''([a-z0-9_]+)''', 'g') m
     WHERE c.conrelid = 'events'::regclass
       AND c.conname  = 'events_action_type_check';

    IF dang_co IS NULL THEN
        RAISE EXCEPTION 'khong doc duoc events_action_type_check — dung doan, dung tay';
    END IF;

    SELECT string_agg(quote_literal(v), ', ' ORDER BY v) INTO day
      FROM (SELECT unnest(dang_co) AS v UNION SELECT unnest(them)) u;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check CHECK (action_type IN (%s))',
        day);
END $$;
