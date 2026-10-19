-- ===========================================================================
-- 0017 — ĐIỂM XẾP HẠNG ĐẤU TRƯỜNG · BẢNG XẾP HẠNG (Hệ A)
--
-- TƯỜNG LỬA L1/A3.5: không cột nào ở đây tham chiếu users.bankroll hay
-- users.quest_points; không thêm reason nào vào ledger tiền tệ. Điểm xếp hạng
-- KHÔNG PHẢI T, KHÔNG PHẢI Q, và không có đường quy đổi nào giữa chúng.
-- Tên enum `reason` của rank_quy_diem cố ý KHÔNG trùng một chữ nào với
-- wallet_ledger / treasury_ledger / burn_ledger — trùng chữ là bước đầu của
-- việc trộn hai hệ.
--
-- BẤT BIẾN LẠM PHÁT (yêu cầu founder: "tính toán sao cho không bị lạm phát"):
--     SUM(rank_ledger.delta) trên mỗi match_id = 0
-- Đây là CONSTRAINT TRIGGER DEFERRABLE, kiểm lúc COMMIT — vì N ghế là N dòng
-- INSERT rời nhau, kiểm ngay dòng đầu thì luôn sai. Không phải một câu cam kết
-- trong tài liệu: nếu code tính lệch, transaction NỔ, không ghi được điểm nào.
--
-- Vì sao SỔ chứ không phải một cột số dư: "không lạm phát" phải ĐO ĐƯỢC bằng
-- một câu SQL, đúng kỷ luật A3.10 đang dùng cho tiền. rank_diem chỉ là CACHE
-- dẫn xuất, dựng lại 100% từ rank_ledger.
-- ===========================================================================

-- (1) SỔ ĐIỂM ---------------------------------------------------------------
CREATE TABLE rank_ledger (
    entry_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users (user_id),
    season_id       TEXT NOT NULL,
    -- ⬅ CHỈ hai chế độ này ghi điểm. Đấu tự do (có bot) và phòng riêng KHÔNG có
    --    đường nào vào bảng này — đó là cách D31 "rank toàn người thật" thành
    --    sự thật ở tầng schema, không phải một câu if trong code.
    che_do          TEXT NOT NULL CHECK (che_do IN ('rank_slot', 'rank_bu')),
    match_id        UUID NOT NULL REFERENCES holdem_matches (match_id),
    so_ghe          INT  NOT NULL CHECK (so_ghe BETWEEN 2 AND 8),
    so_la           INT  NOT NULL CHECK (so_la IN (8, 12, 16)),
    hang            INT  NOT NULL CHECK (hang >= 1),
    -- Số cặp mình xếp TRÊN. Đây là câu "vì sao +37" hiện trên màn Chốt phiên;
    -- không lưu thì màn đó phải tự suy lại và sẽ suy lệch khi luật đổi.
    so_cap_thang    INT  NOT NULL CHECK (so_cap_thang >= 0),
    bac_vao_ban     TEXT NOT NULL,   -- bậc lúc VÀO BÀN = đầu vào của p(), replay được
    delta           INT  NOT NULL,
    -- CÓ THỂ ÂM. Kẹp sàn ở 0 là phá zero-sum: người ở sàn về bét thì không trừ
    -- được, nhưng người trên vẫn nhận → mint điểm từ không khí.
    diem_sau        INT  NOT NULL,
    formula_version TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (match_id, user_id)       -- một ghế một bút toán; chống cộng đôi khi retry
);

-- Append-only, cùng khuôn 0002.
CREATE TRIGGER rank_ledger_append_only
    BEFORE UPDATE OR DELETE ON rank_ledger
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER rank_ledger_no_truncate
    BEFORE TRUNCATE ON rank_ledger
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

CREATE INDEX rank_ledger_user_idx  ON rank_ledger (user_id, season_id, created_at DESC);
CREATE INDEX rank_ledger_match_idx ON rank_ledger (match_id);

-- BẤT BIẾN ZERO-SUM Ở TẦNG DB. N ≤ 8 nên FOR EACH ROW là ≤8 lần đọc theo index.
CREATE FUNCTION kiem_zero_sum_rank() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE tong INT;
BEGIN
    SELECT COALESCE(SUM(delta), 0) INTO tong
      FROM rank_ledger WHERE match_id = NEW.match_id;
    IF tong <> 0 THEN
        RAISE EXCEPTION
            'rank_ledger tran % co tong delta = % (phai = 0, CLAUDE.md A3.4)',
            NEW.match_id, tong
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER rank_ledger_zero_sum
    AFTER INSERT ON rank_ledger
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION kiem_zero_sum_rank();

-- (2) CACHE ĐIỂM ------------------------------------------------------------
-- Cập nhật bằng 1 UPDATE trong ĐÚNG transaction kết trận (chỗ đã có transaction
-- rồi). Không tồn tại truy vấn "SUM mọi trận của mọi người" ở bất kỳ đâu — đó là
-- cách duy nhất bảng xếp hạng không giết ngân sách request (L9/D11, §6.2).
CREATE TABLE rank_diem (
    user_id    UUID NOT NULL REFERENCES users (user_id),
    season_id  TEXT NOT NULL,
    diem       INT  NOT NULL DEFAULT 0,
    diem_dinh  INT  NOT NULL DEFAULT 0,   -- cao nhất trong mùa → sàn chống thả rank
    so_tran    INT  NOT NULL DEFAULT 0,
    -- job 10 phút ghi sẵn; NULL = chưa xếp. `rank() OVER ()` lúc có request là
    -- quét cả bảng, nên "hạng của tôi" phải là một lookup theo khoá chính.
    hang       INT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, season_id)
);

-- ⚠ KHÔNG có cột `bac`: bậc là DẪN XUẤT từ `diem` (config/rank.ts bacTuDiem).
-- Lưu bậc = trạng thái thứ hai trôi lệch khỏi sổ, mà bậc lại là ĐẦU VÀO của p()
-- → lệch bậc thì lệch luôn delta của mọi người cùng bàn.

-- Quét top 100 = 100 entry index, không chạm bảng chính.
CREATE INDEX rank_diem_bxh_idx ON rank_diem (season_id, diem DESC, so_tran)
    WHERE so_tran >= 5;

-- (3) QUỸ ĐIỂM — sổ đối ứng, đúng khuôn Kho bạc -----------------------------
-- Bất biến: Σ rank_diem.diem + rank_quy_diem.so_du_sau(mới nhất) = 0 mỗi mùa.
-- Mọi dịch chuyển điểm KHÔNG PHẢI từ một bàn phải có đối ứng ở đây, nếu không
-- thì "không lạm phát" chỉ còn đúng với các trận và sai với cả hệ.
CREATE TABLE rank_quy_diem (
    entry_id   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    season_id  TEXT NOT NULL,
    delta      INT  NOT NULL,
    -- ĐƯỢC PHÉP ÂM — khác Kho bạc T ở D10. Đây là đối ứng của một đại lượng CÓ
    -- DẤU, không phải một quỹ tiền, nên CHECK ≥ 0 ở đây sẽ chặn oan reset mùa.
    so_du_sau  INT  NOT NULL,
    reason     TEXT NOT NULL CHECK (reason IN
                 ('nen_dau_mua', 'du_lam_tron', 'hao_khong_hoat_dong', 'admin_sua')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER rank_quy_diem_append_only
    BEFORE UPDATE OR DELETE ON rank_quy_diem
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE INDEX rank_quy_diem_mua_idx ON rank_quy_diem (season_id, entry_id DESC);

-- (4) SNAPSHOT BẢNG ---------------------------------------------------------
-- MỘT bảng cache cho CẢ BA bảng: một job, một đường cache, MỘT chỗ lọc blocklist
-- tên (D25/R2). Hai đường thì một đường sẽ quên bản vá.
CREATE TABLE bxh_snapshots (
    bang_id      TEXT NOT NULL CHECK (bang_id IN
                   ('dau_truong', 'du_bao_so_lan', 'du_bao_do_chinh_xac')),
    season_id    TEXT NOT NULL,       -- 'du_bao_do_chinh_xac' dùng '-' (không theo mùa)
    payload_json JSONB NOT NULL,      -- ≤100 dòng, ~6 KB
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bang_id, season_id)
);

-- (5) TRƯỜNG THIẾU TRÊN BẢNG ĐÃ CÓ -----------------------------------------
ALTER TABLE holdem_results
    -- Replay được delta mà KHÔNG lưu điểm ẩn nào: bậc lúc vào bàn đã có ở
    -- `bac_rank`, hai cột này chỉ để đối chiếu sổ khi điều tra.
    ADD COLUMN diem_truoc INT,
    ADD COLUMN diem_sau   INT;

-- Chế độ trận: điều kiện CỨNG để một trận được phép ghi điểm.
ALTER TABLE holdem_matches ADD COLUMN che_do TEXT NOT NULL DEFAULT 'tu_do'
    CHECK (che_do IN ('tu_do', 'rank_slot', 'rank_bu', 'phong_rieng'));

-- ⚠⚠ action_type là CHECK ĐÓNG (bẫy đã dính ở 0009, 0010, 0011, 0012, 0013).
-- Nhưng cách MỌI migration trước xử lý nó lại là một cái bẫy THỨ HAI, và nó vừa
-- nổ thật: mỗi lần ai đó cần một loại event mới, họ CHÉP LẠI cả danh sách cũ rồi
-- thêm loại của mình. Khi hai người làm song song, người chạy SAU chép một danh
-- sách đã cũ và XOÁ SẠCH loại event của người trước — schema vẫn hợp lệ, migration
-- vẫn xanh, và tính năng của người kia chết bằng 23514 lúc chạy thật.
-- (Đo được ngay trong đợt này: 0017 chép danh sách của 0013 nên làm 0018 đỏ.)
--
-- Nay: NỚI THEO HIỆU, không chép lại. Đọc danh sách đang có từ chính constraint
-- rồi hợp với các loại mới. Migration này vì thế không bao giờ xoá loại của ai,
-- bất kể nó chạy trước hay sau migration nào.
DO $$
DECLARE
    dang_co TEXT[];
    them    TEXT[] := ARRAY[
        -- `rank_diem_thay_doi` mang cả delta lẫn bối cảnh đối thủ (D25/R1: các
        -- BẬC đã hiển thị, số ghế, hạng) — thiếu là không khử được nhiễu "nể cao
        -- / lấn thấp", và events append-only nên không backfill được.
        'rank_diem_thay_doi', 'rank_len_bac', 'rank_tut_bac', 'bxh_xem'
    ];
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

-- (6) RLS — BẮT BUỘC theo 0006: bảng mới phải khoá trong chính migration tạo nó.
-- Không CREATE POLICY nào → PostgREST không đọc được, chỉ service role của API.
ALTER TABLE rank_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_diem     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_quy_diem ENABLE ROW LEVEL SECURITY;
ALTER TABLE bxh_snapshots ENABLE ROW LEVEL SECURITY;

-- (7) JOB DỰNG SNAPSHOT -----------------------------------------------------
-- SQL FUNCTION, KHÔNG phải cron inline. Ở prod pg_cron gọi mỗi 10 phút → tốn 0
-- request Vercel (D11 LỚP 1: deadline không phụ thuộc dịch vụ ngoài).
-- ⚠ pg_cron KHÔNG CÓ ở DB local (0005), nên hàm này phải gọi được TRỰC TIẾP từ
--   test và từ /internal/tick. A8.9: mọi thứ test được ở local, cấm mock.
--
-- Hàm làm ĐÚNG HAI VIỆC, cùng transaction:
--   (a) ghi sẵn rank_diem.hang bằng một window function (≤5.000 dòng);
--   (b) ghi 1 dòng bxh_snapshots — payload là 100 dòng đầu.
-- Bậc KHÔNG tính ở đây: nó là dẫn xuất, tính ở tầng TS từ `diem` (một nguồn
-- chân lý duy nhất cho công thức bậc — nhân đôi công thức sang SQL là nhân đôi
-- chỗ phải sửa khi bump RANK_FORMULA_VERSION).
CREATE FUNCTION xay_bxh_dau_truong(p_season TEXT, p_so_dong INT DEFAULT 100)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE so_dong INT;
BEGIN
    WITH xh AS (
        SELECT user_id,
               rank() OVER (ORDER BY diem DESC, so_tran ASC, user_id) AS h
          FROM rank_diem
         WHERE season_id = p_season AND so_tran >= 5
    )
    UPDATE rank_diem d SET hang = xh.h
      FROM xh
     WHERE d.user_id = xh.user_id AND d.season_id = p_season
       AND (d.hang IS DISTINCT FROM xh.h);

    -- Người dưới ngưỡng trận không lên bảng → hạng phải TRẢ VỀ NULL, nếu không
    -- thì một người từng đủ trận ở mùa trước giữ mãi hạng cũ.
    UPDATE rank_diem SET hang = NULL
     WHERE season_id = p_season AND so_tran < 5 AND hang IS NOT NULL;

    SELECT count(*) INTO so_dong
      FROM rank_diem WHERE season_id = p_season AND hang IS NOT NULL;

    -- Payload là OBJECT, không phải mảng: `tong_xep_bac` nằm trong cùng snapshot
    -- để tính PHÂN VỊ (D32 — phân vị cho mọi người, top-N chỉ cho dẫn đầu) mà
    -- không tốn thêm một COUNT nào lúc có request.
    INSERT INTO bxh_snapshots (bang_id, season_id, payload_json, computed_at)
    SELECT 'dau_truong', p_season,
           jsonb_build_object(
             'tong_xep_bac', so_dong,
             'dong', COALESCE(jsonb_agg(jsonb_build_object(
               'hang', t.hang, 'user_id', t.user_id, 'handle', t.handle,
               'diem', t.diem, 'so_tran', t.so_tran
             ) ORDER BY t.hang), '[]'::jsonb)),
           now()
      FROM (
        SELECT d.hang, d.user_id, u.handle, d.diem, d.so_tran
          FROM rank_diem d JOIN users u USING (user_id)
         WHERE d.season_id = p_season AND d.so_tran >= 5 AND d.hang IS NOT NULL
         ORDER BY d.hang
         LIMIT p_so_dong
      ) t
        ON CONFLICT (bang_id, season_id)
        DO UPDATE SET payload_json = EXCLUDED.payload_json,
                      computed_at  = EXCLUDED.computed_at;

    RETURN so_dong;
END;
$$;

-- (8) KIỂM TOÁN — một câu, chạy được bằng tay bất cứ lúc nào ----------------
-- Trả về các mùa/trận LỆCH. Rỗng = không lạm phát. Đây là bản SQL của phép kiểm
-- mà tests/rank.test.ts chạy trên 300.000 bàn ngẫu nhiên.
CREATE VIEW rank_kiem_toan AS
SELECT match_id, sum(delta) AS tong_delta, count(*) AS so_ghe
  FROM rank_ledger
 GROUP BY match_id
HAVING sum(delta) <> 0;
