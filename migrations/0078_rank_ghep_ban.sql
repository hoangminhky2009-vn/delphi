-- ===========================================================================
-- 0078 — GHÉP BÀN XẾP HẠNG ≥ 4 NGƯỜI THẬT (SPEC alpha-draft-tang-khong-gian mục 6, founder CHỐT 11/10)
--
-- Suất đấu mỗi 15 phút (:00 :15 :30 :45): người chơi ĐĂNG KÝ vào suất; đúng giờ, /internal/tick (mỗi phút, D11 lớp 2) ghép TRONG DB — không
-- hàng chờ mở, không polling (design_rank §7.2–7.3). n < 4 ⇒ không mở bàn; n ≥ 4 ⇒ k = ⌈n/20⌉ bàn chia đều; bàn m người có thêm
-- tối đa min(m−1, 20−m) máy. Toàn bộ tính năng nằm sau cờ RANK_GHEP_BAT (TẮT mặc định) — migration này chỉ dựng bảng, không bật gì.
--
-- MÔ HÌNH CHƠI = ĐẤU BÙ CÙNG SEED (design_rank §7.4 · D15 "ghost async cùng seed" · bàn chung 0040): mỗi người một trận `holdem_matches`
-- riêng (che_do 'rank_slot') cùng seed, cùng cỡ ghế, cùng bộ vai; engine hiện chỉ có MỘT ghế người. Điểm tính khi cả bàn xong hoặc hết
-- hạn, CHỈ giữa cặp người–người (B3, §2.10) — zero-sum theo BÀN GHÉP, không theo từng trận lẻ ⇒ `rank_ledger` cần khoá nhóm `ban_id`.
-- ===========================================================================

-- (1) SUẤT — một dòng mỗi giờ khởi tranh. Tạo lười khi có người đăng ký đầu tiên.
CREATE TABLE rank_suat (
    slot_id     TIMESTAMPTZ PRIMARY KEY,
    season_id   TEXT        NOT NULL,
    trang_thai  TEXT        NOT NULL DEFAULT 'mo' CHECK (trang_thai IN ('mo', 'da_ghep', 'thieu_nguoi')),
    -- ⚠ CHỐT lúc ghép để phục vụ chỉ số chống thả rank (§10) và KHÔNG BAO GIỜ trả cho client (§7.3 L5-tinh thần): số người đăng ký
    -- mà lộ ra thì thành "số người tham gia" (D19 vừa cắt) và là cớ hẹn nhau vào suất đang vắng.
    so_dang_ky  INT,
    so_ban      INT,
    ghep_luc    TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rank_suat_gio_chk CHECK (
        date_part('second', slot_id AT TIME ZONE 'UTC') = 0
        AND date_part('minute', slot_id AT TIME ZONE 'UTC')::int % 15 = 0)
);

-- (2) BÀN GHÉP — kết quả ghép của một suất. `seed` là thông tin ẨN (đọc được seed là dựng lại map trước khi lật, xem 0042): RLS khoá bên dưới.
CREATE TABLE rank_ban (
    ban_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id         TIMESTAMPTZ NOT NULL REFERENCES rank_suat (slot_id),
    chi_so          INT         NOT NULL CHECK (chi_so >= 0),
    season_id       TEXT        NOT NULL,
    seed            BIGINT      NOT NULL,
    so_nguoi        INT         NOT NULL CHECK (so_nguoi >= 4),
    so_may          INT         NOT NULL CHECK (so_may >= 0),
    so_ghe          INT         NOT NULL CHECK (so_ghe BETWEEN 4 AND 20),
    co_ban_boc      INT         NOT NULL CHECK (co_ban_boc IN (4, 8, 12, 16, 20)),
    bac_thap        INT         NOT NULL CHECK (bac_thap BETWEEN 1 AND 7),
    -- Vai của MỌI ghế bàn (so_ghe phần tử), bốc một lần theo bảng cỡ bàn. Mỗi người chơi nhận một vai, ghế máy nhận phần còn lại.
    vai_json        JSONB       NOT NULL,
    balance_version TEXT        NOT NULL,
    trang_thai      TEXT        NOT NULL DEFAULT 'dang_choi' CHECK (trang_thai IN ('dang_choi', 'da_chot')),
    ly_do_chot      TEXT,
    han_luc         TIMESTAMPTZ NOT NULL,
    chot_luc        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- BẤT BIẾN CỦA SPEC ở tầng schema: máy luôn ÍT HƠN người, tổng ghế ≤ 20, người ≥ 4.
    CONSTRAINT rank_ban_may_it_hon_nguoi_chk CHECK (so_may < so_nguoi AND so_nguoi + so_may = so_ghe),
    UNIQUE (slot_id, chi_so)
);
CREATE INDEX rank_ban_dang_choi_idx ON rank_ban (han_luc) WHERE trang_thai = 'dang_choi';

-- (3) ĐĂNG KÝ — một người một suất; đang chờ thì chỉ MỘT suất tại một thời điểm.
CREATE TABLE rank_dang_ky (
    slot_id     TIMESTAMPTZ NOT NULL REFERENCES rank_suat (slot_id),
    user_id     UUID        NOT NULL REFERENCES users (user_id),
    -- diem_ghep = max(điểm hiện tại, đỉnh − BIEN_TRUOT) chốt LÚC ĐĂNG KÝ (§7.5); bac_so = bậc số hiển thị lúc đó (0 = chưa xếp).
    diem_ghep   INT         NOT NULL,
    bac_so      INT         NOT NULL CHECK (bac_so BETWEEN 0 AND 7),
    trang_thai  TEXT        NOT NULL DEFAULT 'cho' CHECK (trang_thai IN ('cho', 'da_ghep', 'thieu_nguoi', 'rut')),
    ban_id      UUID        REFERENCES rank_ban (ban_id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (slot_id, user_id)
);
CREATE UNIQUE INDEX rank_dang_ky_mot_suat_cho_uq ON rank_dang_ky (user_id) WHERE trang_thai = 'cho';
CREATE INDEX rank_dang_ky_cho_idx ON rank_dang_ky (slot_id) WHERE trang_thai = 'cho';

-- (4) NGƯỜI TRONG BÀN — mỗi người một trận riêng cùng seed.
CREATE TABLE rank_ban_nguoi (
    ban_id      UUID        NOT NULL REFERENCES rank_ban (ban_id),
    user_id     UUID        NOT NULL REFERENCES users (user_id),
    -- ghế vai của người này trong vai_json (0 .. so_nguoi−1)
    ghe_chi_so  INT         NOT NULL CHECK (ghe_chi_so >= 0),
    bac_id      TEXT        NOT NULL,   -- BacId lúc đăng ký = bậc hiển thị cho đối thủ
    bac_so      INT         NOT NULL CHECK (bac_so BETWEEN 0 AND 7),
    match_id    UUID        UNIQUE REFERENCES holdem_matches (match_id),
    xong        BOOLEAN     NOT NULL DEFAULT false,
    dau_hang    BOOLEAN     NOT NULL DEFAULT false,
    nav_cuoi    BIGINT,
    PRIMARY KEY (ban_id, user_id)
);
CREATE INDEX rank_ban_nguoi_user_idx ON rank_ban_nguoi (user_id, ban_id);

-- (5) SỔ ĐIỂM: khoá NHÓM `ban_id`. Trận lẻ cũ (toàn người, ban_id NULL) giữ nguyên hành vi.
ALTER TABLE rank_ledger ADD COLUMN ban_id UUID REFERENCES rank_ban (ban_id);
-- Người VẮNG (đăng ký mà không vào bàn) vẫn nhận Δ hạng cuối (§7.7) nhưng chưa có trận ⇒ match_id có thể NULL, miễn có ban_id.
ALTER TABLE rank_ledger ALTER COLUMN match_id DROP NOT NULL;
ALTER TABLE rank_ledger ADD CONSTRAINT rank_ledger_match_hoac_ban_chk CHECK (match_id IS NOT NULL OR ban_id IS NOT NULL);
CREATE UNIQUE INDEX rank_ledger_ban_user_uq ON rank_ledger (ban_id, user_id) WHERE ban_id IS NOT NULL;
-- Cỡ bàn không còn ≤ 8 và cỡ map không còn 8/12/16 (v63 là 14 ô): nới theo khoảng, dò tên constraint như 0022.
DO $$
DECLARE ten TEXT;
BEGIN
    FOR ten IN
        SELECT conname FROM pg_constraint
         WHERE conrelid = 'rank_ledger'::regclass AND contype = 'c'
           AND (pg_get_constraintdef(oid) LIKE '%so_ghe%' OR pg_get_constraintdef(oid) LIKE '%so_la%')
    LOOP
        EXECUTE format('ALTER TABLE rank_ledger DROP CONSTRAINT %I', ten);
    END LOOP;
    ALTER TABLE rank_ledger ADD CONSTRAINT rank_ledger_so_ghe_chk CHECK (so_ghe BETWEEN 2 AND 20);
    ALTER TABLE rank_ledger ADD CONSTRAINT rank_ledger_so_la_chk CHECK (so_la BETWEEN 4 AND 40);
END $$;

-- BẤT BIẾN ZERO-SUM, nay theo NHÓM: bàn ghép cộng theo `ban_id`, trận lẻ cộng theo `match_id` như cũ.
CREATE OR REPLACE FUNCTION kiem_zero_sum_rank() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE tong INT;
BEGIN
    IF NEW.ban_id IS NOT NULL THEN
        SELECT COALESCE(SUM(delta), 0) INTO tong FROM rank_ledger WHERE ban_id = NEW.ban_id;
    ELSE
        SELECT COALESCE(SUM(delta), 0) INTO tong FROM rank_ledger WHERE match_id = NEW.match_id AND ban_id IS NULL;
    END IF;
    IF tong <> 0 THEN
        RAISE EXCEPTION
            'rank_ledger nhom % co tong delta = % (phai = 0, CLAUDE.md A3.4)',
            COALESCE(NEW.ban_id, NEW.match_id), tong
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NULL;
END;
$$;

-- View kiểm toán: cột vẫn tên `match_id` (server/rank.ts đọc cột đó) nhưng là khoá NHÓM — ban_id nếu có, không thì match_id.
CREATE OR REPLACE VIEW rank_kiem_toan AS
SELECT COALESCE(ban_id, match_id) AS match_id, sum(delta) AS tong_delta, count(*) AS so_ghe
  FROM rank_ledger
 GROUP BY COALESCE(ban_id, match_id)
HAVING sum(delta) <> 0;

-- (6) RLS — BẮT BUỘC theo 0006: bảng mới khoá trong chính migration tạo nó (rank_ban chứa `seed`, xem 0042).
ALTER TABLE rank_suat       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_ban        ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_dang_ky    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_ban_nguoi  ENABLE ROW LEVEL SECURITY;
