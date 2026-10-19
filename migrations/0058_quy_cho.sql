-- 0058 — QUỸ CHỢ: `quy_cho_ledger` (bước B5, mốc M1 — "bán được một món, T về ví").
--
-- ─── VÌ SAO MỘT SỔ RIÊNG, KHÔNG PHẢI MỘT DÒNG TRONG KHO BẠC ────────────────
-- Kho bạc là túi tiền của NHÀ ĐIỀU TIẾT (trợ cấp, tier bonus, genesis). Quỹ chợ
-- là túi tiền của NGƯỜI BÁN HÀNG: trả T khi mua vật phẩm của người chơi, nhận
-- T khi bán ra. Gộp hai vai vào một sổ thì câu hỏi "Kho bạc còn gánh nổi trợ
-- cấp bao lâu?" (D68, D263) mất nghĩa — mỗi cú mua bán làm số đó nhảy. Bất biến
-- E1 của bản vẽ viết rõ vế thứ tư: Σví + kho bạc + QUỸ CHỢ + đã đốt.
--
-- ─── SOI GƯƠNG `treasury_ledger`, KHÔNG PHÁT MINH ──────────────────────────
-- Cùng hình dạng (0001): delta ≠ 0 · balance_after CHECK ≥ 0 · reason đóng ·
-- append-only bằng đúng `forbid_mutation()` của 0002 — không viết hàm thứ hai.
--
-- ─── ⚠ SỔ MỚI TẠO CÓ SỐ DƯ 0, VÀ ĐÓ LÀ CỐ Ý (A8.2) ──────────────────────────
-- Nạp bao nhiêu từ Kho bạc là quyết định của founder, chạy bằng
--     npm run quy-cho:nap -- <T>
-- Số 0 ⇒ gia_san = 0 ⇒ cửa mua vào ĐÓNG (D65). Fail-closed, không phải số tạm.

BEGIN;

CREATE TABLE quy_cho_ledger (
    entry_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    delta          BIGINT NOT NULL CHECK (delta <> 0),
    -- Ràng buộc cứng: quỹ không âm. Chi vượt quỹ là DB từ chối, không phải
    -- một số âm chờ ai đó phát hiện.
    balance_after  BIGINT NOT NULL CHECK (balance_after >= 0),
    reason         TEXT NOT NULL CHECK (reason IN
                     ('nap_tu_kho_bac', 'mua_vao', 'ban_ra', 'phi_in')),
    -- Bản thể liên quan (mua vào / bán ra). NULL cho nạp vốn và phí.
    ref_ban_the_id BIGINT NULL REFERENCES vat_pham_ban_the (ban_the_id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quy_cho_ledger_theo_ban_the
    ON quy_cho_ledger (ref_ban_the_id) WHERE ref_ban_the_id IS NOT NULL;

-- Append-only — cùng hàm với ba sổ tiền còn lại (0002). Một sổ tiền sửa được
-- là một sổ tiền không kiểm toán được (A3.10).
CREATE TRIGGER quy_cho_ledger_append_only
    BEFORE UPDATE OR DELETE ON quy_cho_ledger
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER quy_cho_ledger_no_truncate
    BEFORE TRUNCATE ON quy_cho_ledger
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- Khoá PostgREST — cùng nếp 0006/0010/0057.
ALTER TABLE quy_cho_ledger ENABLE ROW LEVEL SECURITY;

-- Kho bạc cần một reason cho vế đi ra: `quy_cho_out`. Nới CHECK theo đúng khuôn
-- 0034 — đọc danh sách đang có rồi thêm, không chép tay danh sách (D61).
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
      FROM (SELECT unnest(dang_co) AS v UNION SELECT 'quy_cho_out') u;

    EXECUTE 'ALTER TABLE treasury_ledger DROP CONSTRAINT treasury_ledger_reason_check';
    EXECUTE format(
        'ALTER TABLE treasury_ledger ADD CONSTRAINT treasury_ledger_reason_check CHECK (reason IN (%s))',
        day);
END $$;

COMMIT;
