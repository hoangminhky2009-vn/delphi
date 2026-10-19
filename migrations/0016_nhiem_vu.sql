-- ===========================================================================
-- 0016 — VIỆC TUẦN + LỘ TRÌNH MÙA 0.0 ("BETA ACCESS"): mở VÒI Q ĐẦU TIÊN.
--
-- Thi công `docs/khao-co/design_nhiem_vu.md` + `docs/khao-co/design_battle_pass_0_0.md`.
-- Ba thứ file này dựng, theo đúng thứ tự phụ thuộc:
--
--   (1) SỔ Q (`quest_ledger`) — TRƯỚC khi có vòi. Bật vòi rồi mới dựng sổ là
--       đúng món nợ A8.9 cấm: số dư không recompute được thì không audit được.
--   (2) NỚI trigger đóng băng `quest_points` — CÓ ĐIỀU KIỆN, không gỡ trắng.
--   (3) BẢNG TIẾN ĐỘ (`nhiem_vu_xong`, `lo_trinh_nhan`) — trần cày nằm ở KHOÁ
--       CHÍNH, không nằm ở một câu `if` trong tầng app.
--
-- ---------------------------------------------------------------------------
-- VÌ SAO TƯỜNG LỬA T↔Q (A3.5) KHÔNG BỊ NỚI DÙ TRIGGER BỊ THAY
--
-- Trigger 0002 cấm MỌI thay đổi `quest_points`. Nó là cái chốt đúng cho v0.1
-- (chưa có hệ quest), nhưng nó không phải chỗ tường lửa T↔Q sống. Tường lửa
-- sống ở DANH MỤC `reason`: `quest_ledger.reason` và `wallet_ledger.reason`
-- KHÔNG có một giá trị nào chung, không có 'convert', không có 'exchange',
-- không có 'refund_in_other_currency'. Muốn nối T với Q phải chạy một migration
-- mới — tức phải cố ý, và phải để lại dấu. `tests/nhiem_vu.test.ts` khẳng định
-- giao của hai danh mục = ∅ bằng cách đọc CHECK thật trong pg_constraint, không
-- bằng cách đọc hằng số TS (bẫy #7: test chép hằng số thì không kiểm gì).
--
-- ---------------------------------------------------------------------------
-- VÌ SAO KHÔNG CÓ CỘT ĐIỂM NÀO CHO LỘ TRÌNH
--
-- CHẶNG = `min(SO_CHANG, COUNT(*) nhiem_vu_xong)`. Nó là một PHÉP ĐỌC, cùng
-- khuôn `levelTuXp()` (`config/progression.ts`): không bảng nào cộng dồn, không
-- gì tiêu được, sửa giá trị một việc là mọi người có chặng mới ngay và không
-- backfill. Hệ quả kiểm được: một việc bị lỗi chỉ làm lộ trình CHẠY NHANH HƠN,
-- nó không thể đúc thêm một Q nào — trần Q của mùa là hằng số in trên hộp.
--
-- Phần KHÔNG dẫn xuất được là "mốc đã nhận Q", vì Q đã ra khỏi hệ. Đó là lý do
-- `lo_trinh_nhan` tồn tại và là lý do nó có PK — chống nhận hai lần khi retry.
-- ===========================================================================

-- (1) -------------------------------------------------------------------------
-- SỔ Q — append-only, đúng khuôn `wallet_ledger` (A3.10: số dư là kết quả suy
-- ra được từ sổ, recompute lại được để audit).
--
-- `delta <> 0` : một dòng sổ không nói gì thì không phải bút toán, là rác.
-- `balance_after >= 0` : Q không bao giờ âm, chốt ở tầng DB như `bankroll`.
CREATE TABLE quest_ledger (
    entry_id      BIGSERIAL PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES users (user_id),
    delta         INTEGER NOT NULL CHECK (delta <> 0),
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    -- PHÁT: đúng MỘT đường ('lo_trinh_moc'). Mọi đường phát khác phải qua
    -- migration mới — trần Q/mùa chỉ suy ra được từ lịch khi số vòi là đếm được.
    -- TIÊU: mo_he · shop_q · ve_ban_thi_dau (nhãn "BÀN CƯỢC" của D15/D16 phạm
    -- ban-list D26 nên KHÔNG dùng, kể cả trong wire value — D26 cho phép codename
    -- trong code, nhưng chuỗi này không cần thiết phải bẩn).
    reason        TEXT NOT NULL CHECK (reason IN (
                      'lo_trinh_moc',
                      'mo_he', 'shop_q', 've_ban_thi_dau', 'hoan_ve',
                      -- ⚠ 'admin_sua_q', KHÔNG phải 'admin_adjust' của ví T. Hai
                      -- danh mục phải giao nhau = ∅ (A3.5) và test khẳng định điều
                      -- đó bằng cách đọc CHECK thật. Dùng chung một chuỗi cho hai
                      -- sổ là chỗ một truy vấn audit gộp hai loại tiền lại mà
                      -- không ai thấy — tường lửa hỏng bằng một câu SQL, không
                      -- bằng một dòng code.
                      'admin_sua_q')),
    -- Chặng số / mã hệ / mã món. TEXT vì ba loại tham chiếu khác kiểu nhau.
    ref_id        TEXT,
    season_id     TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quest_ledger_user_idx ON quest_ledger (user_id, entry_id DESC);
CREATE INDEX quest_ledger_mua_idx  ON quest_ledger (season_id, user_id);

-- Append-only: dùng lại `forbid_mutation()` của 0002 (đang canh `events` và ba
-- sổ cái). Sổ sửa được thì audit là diễn.
CREATE TRIGGER quest_ledger_append_only
    BEFORE UPDATE OR DELETE ON quest_ledger
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER quest_ledger_no_truncate
    BEFORE TRUNCATE ON quest_ledger
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- (2) -------------------------------------------------------------------------
-- THAY trigger đóng băng `quest_points` — KHÔNG gỡ trắng.
--
-- Từ "cấm mọi thay đổi" thành "chỉ đổi được khi CÓ MỘT DÒNG SỔ khớp trong CÙNG
-- transaction". Kiểm lúc COMMIT bằng CONSTRAINT TRIGGER DEFERRABLE, vì thứ tự
-- ghi (UPDATE users trước hay INSERT sổ trước) là chuyện của tầng app và không
-- nên trở thành một luật ngầm mà người sau phải đoán.
--
-- ⚠ Đây là thi hành D16 ("battle pass = máy phát Q"), KHÔNG phải nới tường lửa
-- T↔Q. Tường lửa chuyển sang nằm ở danh mục `reason` ở (1).
DROP TRIGGER users_quest_points_frozen ON users;
DROP FUNCTION forbid_quest_points_change();

CREATE OR REPLACE FUNCTION kiem_quest_points_khop_so() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    cuoi     INTEGER;
    hien_tai BIGINT;
BEGIN
    SELECT balance_after INTO cuoi
      FROM quest_ledger
     WHERE user_id = NEW.user_id
     ORDER BY entry_id DESC
     LIMIT 1;

    -- ⚠ ĐỌC LẠI GIÁ TRỊ CUỐI TRONG BẢNG, KHÔNG DÙNG `NEW`.
    --
    -- Trigger này DEFERRED nên nó chạy lúc COMMIT, nhưng `NEW` là ảnh chụp tại
    -- thời điểm UPDATE. Một transaction đổi Q hai lần (nhận hai mốc liền nhau —
    -- chuyện thường ngày của lộ trình) sẽ xếp hai lần kiểm, và lần kiểm ĐẦU mang
    -- `NEW` cũ ⟹ luôn lệch dòng sổ cuối. Đọc lại từ `users` cho mọi lần kiểm
    -- cùng một câu trả lời: "sau khi mọi thứ xong, ví có khớp sổ không".
    SELECT quest_points INTO hien_tai FROM users WHERE user_id = NEW.user_id;

    IF cuoi IS NULL THEN
        RAISE EXCEPTION
            'quest_points đổi mà không có dòng quest_ledger nào (A3.10)'
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF cuoi IS DISTINCT FROM hien_tai THEN
        RAISE EXCEPTION
            'quest_points (%) lệch dòng cuối quest_ledger (%) — ví Q phải là số dư suy từ sổ',
            hien_tai, cuoi
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER users_quest_points_khop_so
    AFTER UPDATE ON users
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    WHEN (OLD.quest_points IS DISTINCT FROM NEW.quest_points)
    EXECUTE FUNCTION kiem_quest_points_khop_so();

-- (3) -------------------------------------------------------------------------
-- VIỆC ĐÃ XONG — đây là chỗ TRẦN CÀY sống.
--
-- PK (user_id, season_id, cua_so_key, nv_id): một việc chỉ xong được MỘT LẦN
-- trong một cửa sổ, ở tầng DB. Chơi thêm 10 giờ trong tuần đã hết việc thì
-- không có mã việc nào để mang → +0 chặng. Cày KHÔNG bị chặn (dữ liệu A1 vẫn
-- thu đủ), cày chỉ KHÔNG ĐƯỢC TRẢ — hai chuyện khác nhau và chỉ chuyện thứ hai
-- là chuyện của file này.
--
-- `cua_so_key` là CHUỖI ('2026-W31' | '2026-07-27' | '2026-07' | season_id) chứ
-- không phải week_no INT: nó cho phép trộn nhiều loại cửa sổ trong cùng một
-- bảng mà không đẻ ba bảng gần giống nhau, và nó do SERVER suy từ đồng hồ
-- (C4 — client không gửi cửa sổ; TV6 của tài liệu BP).
CREATE TABLE nhiem_vu_xong (
    user_id     UUID NOT NULL REFERENCES users (user_id),
    season_id   TEXT NOT NULL,
    cua_so_key  TEXT NOT NULL,
    nv_id       TEXT NOT NULL,
    xong_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, season_id, cua_so_key, nv_id)
);

-- Chặng = COUNT theo (user, mùa) → index đúng hình dạng truy vấn nóng đó.
CREATE INDEX nhiem_vu_xong_mua_idx ON nhiem_vu_xong (user_id, season_id);

-- (4) -------------------------------------------------------------------------
-- MỐC LỘ TRÌNH ĐÃ NHẬN — chống nhận hai lần.
CREATE TABLE lo_trinh_nhan (
    user_id    UUID NOT NULL REFERENCES users (user_id),
    season_id  TEXT NOT NULL,
    chang_no   SMALLINT NOT NULL CHECK (chang_no >= 1),
    -- 'q:60' | mã cosmetic. Lưu thứ ĐÃ TRAO, không phải thứ track hiện đang khai
    -- — đổi bảng thưởng ở mùa sau không được viết lại lịch sử của mùa này.
    thuong_id  TEXT NOT NULL,
    nhan_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, season_id, chang_no)
);

-- (5) -------------------------------------------------------------------------
-- `events.action_type` — NỚI THEO CÁCH KHÔNG XOÁ VIỆC CỦA NGƯỜI KHÁC.
--
-- ⚠ BẪY ĐÃ CẮN BỐN LẦN (0010, 0011, 0012, 0013 đều ghi lại): `action_type` là
-- CHECK ĐÓNG. Nhưng cách bốn migration kia nới nó — DROP rồi ADD lại một danh
-- sách GÕ TAY — có một lỗ thứ hai mà chưa ai nói: nếu hai migration được viết
-- SONG SONG (đúng hoàn cảnh hôm nay: 0014/0015 thuộc luồng khác), migration
-- chạy SAU sẽ XOÁ SẠCH loại event mà migration chạy TRƯỚC vừa thêm — và không
-- gì báo lỗi, vì một CHECK hợp lệ vẫn hợp lệ khi thiếu vài giá trị. Lỗi chỉ nổ
-- 23514 giữa transaction nghiệp vụ, ở môi trường đã có người dùng.
--
-- Nên ở đây nới bằng cách ĐỌC constraint đang có rồi CHÈN vào, không gõ lại
-- danh sách. Và fail-closed: nếu không chèn được (định dạng constraint khác dự
-- đoán) thì migration NỔ ngay lúc migrate, chứ không im lặng giữ nguyên.
DO $$
DECLARE
    dinh_nghia TEXT;
    moi        TEXT;
BEGIN
    SELECT pg_get_constraintdef(oid) INTO dinh_nghia
      FROM pg_constraint
     WHERE conrelid = 'events'::regclass
       AND conname  = 'events_action_type_check';

    IF dinh_nghia IS NULL THEN
        RAISE EXCEPTION 'không thấy events_action_type_check — schema lệch dự đoán';
    END IF;

    -- Đã có rồi thì thôi (migration phải idempotent với chính nó).
    IF dinh_nghia LIKE '%nv_diem_danh%' THEN
        RETURN;
    END IF;

    -- pg in ra dạng: CHECK ((action_type = ANY (ARRAY['a'::text, 'b'::text])))
    -- ⟹ chuỗi `::text]` xuất hiện ĐÚNG MỘT LẦN, ở phần tử cuối. Chèn trước nó.
    moi := replace(
        dinh_nghia,
        '::text]',
        '::text, ''nv_diem_danh''::text, ''nv_view''::text, ''nv_xong''::text,'
        || ' ''bp_chang_nhan''::text]');

    IF moi NOT LIKE '%nv_diem_danh%' THEN
        RAISE EXCEPTION
            'không chèn được loại event mới vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;

-- Bốn loại event, và vì sao từng loại đáng có (A7: công thức index viết TRƯỚC,
-- suy ngược trường cần log):
--   · `nv_diem_danh`  — HIỆN DIỆN thuần. Đây là hành động tối thiểu để mở lương
--     tuần, và nó CỐ Ý không sinh dữ liệu quyết định nào (L-N5): người bấm cho
--     xong chỉ ghi một dòng siêu dữ liệu TRUNG THỰC ("người này mở app hôm nay"),
--     không ghi một dòng `bets` vô nghĩa vào đúng bảng đem đi bán.
--   · `nv_view`       — đã ĐỌC danh sách việc. Trường duy nhất không suy được từ
--     chỗ khác, và là trường I-N6 cần: không có nó thì không phân biệt "làm tình
--     cờ" với "làm vì được bảo", tức không đo được nhiệm vụ nào đang làm bẩn dữ
--     liệu. Snapshot = [[nv_id, xong?]…], ≤300 byte.
--   · `nv_xong`       — một việc chuyển sang xong, kèm cửa sổ. Cho I-N1 (dồn sát
--     hạn) và I-N5 (gai tại ngưỡng).
--   · `bp_chang_nhan` — chạm mốc + thứ đã trao.

-- (6) -------------------------------------------------------------------------
-- RLS: mọi bảng mới phải kèm RLS TRONG CHÍNH migration tạo nó (luật 0006).
-- Không policy nào — chỉ service role của API chạm được, client không bao giờ
-- nói chuyện thẳng với Postgres (D17a).
ALTER TABLE quest_ledger   ENABLE ROW LEVEL SECURITY;
ALTER TABLE nhiem_vu_xong  ENABLE ROW LEVEL SECURITY;
ALTER TABLE lo_trinh_nhan  ENABLE ROW LEVEL SECURITY;
