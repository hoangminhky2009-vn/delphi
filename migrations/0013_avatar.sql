-- ===========================================================================
-- 0013 — DIỆN MẠO: avatar nền · khung viền · NHÃN DÁN DÁN TỰ DO, TIÊU VĨNH VIỄN.
--
-- Thi công **D36 (founder 27/07)**. Ba điểm D36 đảo so với thiết kế khe-neo trước
-- đó, và cả ba đều đổi HÌNH DẠNG DỮ LIỆU chứ không chỉ đổi UI:
--
--   1. Chỉ HAI avatar tặng; áo trùm đầu thành hàng bán (bản Beta Access).
--   2. Nhãn dán dán TỰ DO toàn khung, không giới hạn số lượng → toạ độ là (x,y)
--      trong lưới 32×32, không còn "ô neo + thế dán".
--   3. **DÁN LÀ TIÊU VĨNH VIỄN.** Mỗi avatar dán xong là MỘT TÁC PHẨM RIÊNG; muốn
--      tác phẩm mới thì phải có thêm một avatar nền → avatar nền là VẬT TIÊU HAO.
--
-- ---------------------------------------------------------------------------
-- VÌ SAO BA BẢNG MỚI CHỨ KHÔNG PHẢI THÊM CỘT VÀO `user_cosmetics`
--
-- `user_cosmetics` mã hoá đúng một câu: "user X sở hữu món Y" — một dòng, một lần,
-- không số lượng, không bản sao. D36 cần ba câu khác hẳn:
--
--   · `avatar_so_huu`  — "user X có TÁC PHẨM số N" (nhiều bản của cùng một nền).
--   · `avatar_dan`     — "trên tác phẩm N, nhãn Z nằm ở (x,y), dán lúc T, KHÔNG
--                         BAO GIỜ gỡ được".
--   · `kho_sticker`    — "user X còn ĐẾM ĐƯỢC bao nhiêu nhãn Z chưa dán".
--
-- Nhét ba câu đó vào một bảng khoá chính (user, cosmetic) là mất luôn khái niệm
-- bản sao — mà bản sao chính là thứ D36 dựng cả cơ chế kinh tế lên trên.
--
-- ---------------------------------------------------------------------------
-- "VĨNH VIỄN" LÀ MỘT TÍNH CHẤT CỦA CẤU TRÚC, KHÔNG PHẢI MỘT LỜI HỨA
--
-- `avatar_dan` gắn trigger `forbid_mutation()` (đã có từ 0002, dùng cho `events`
-- và ba sổ cái): **không UPDATE, không DELETE, không TRUNCATE**. Nên "gỡ nhãn dán"
-- không phải việc bị cấm bằng code review — nó là việc DB từ chối thực hiện. Cùng
-- lý do `events` append-only: một cơ chế mà người ta có thể lách khi vội thì sớm
-- muộn sẽ bị lách khi vội.
--
-- Hệ quả phải chấp nhận, khai thẳng: dán nhầm thì KHÔNG hoàn được, kể cả admin.
-- Đường duy nhất khi có sự cố là ẨN tác phẩm (`avatar_so_huu.an`) — không xoá (mất
-- lịch sử) và không hoàn (hoàn = mint, phạm A3.4).
--
-- ---------------------------------------------------------------------------
-- CHỖ CẮM KIỂM DUYỆT (D36 khai rủi ro, founder chấp nhận đánh đổi)
--
-- Dán tự do thì soạn được hình khiêu khích, mà app hiện mặt cho NGƯỜI LẠ. D36 nói
-- rõ: ĐỪNG xây blocklist bây giờ, nhưng đừng khoá đường làm nó sau. Ba chỗ cắm:
--   · `avatar_so_huu.an`  — ngừng render nhãn dán, GIỮ nền và GIỮ dòng sở hữu.
--   · `avatar_dan` lưu đủ ai · gì · ở đâu · lúc nào → truy vết và thống kê được.
--   · Không cột nào phải thêm để bật kiểm duyệt: chỉ cần một endpoint admin.
-- ===========================================================================

-- (1) -------------------------------------------------------------------------
-- `users.dien_mao` — CHUỖI DIỆN MẠO ĐANG MẶC (bản v2, độ dài thay đổi được).
--
-- Regex PHẢI khớp từng ký tự với `DIEN_MAO_REGEX` trong config/avatar.ts —
-- tests/avatar.test.ts đọc CẢ HAI file và so, nên lệch là vỡ build chứ không phải
-- vỡ lúc INSERT.
--   vị trí 0    '2'        phiên bản dạng chuỗi (v1 dùng khe neo, đã bỏ)
--   vị trí 1    A|B|C      nền
--   vị trí 2    base36     bảng màu ('0' = bảng gốc)
--   vị trí 3-4  '--'|2 ký  khung ('--' = không khung)
--   sau đó      N nhóm 5   [ID nhãn base36 ×2][x base36][y base36][lật 0|1]
--
-- Đây là BẢN SAO ĐỌC NHANH, không phải nguồn chân lý: nguồn chân lý là
-- `avatar_so_huu` + `avatar_dan`. Nó tồn tại vì payload ghế bị poll theo bậc thang
-- 30s/10s/5s (D11, ngân sách 1M request/tháng) và phải lấy được trong CÙNG câu
-- truy vấn đã lấy handle/bậc — không thêm round-trip, không N+1. Mọi đường ghi đi
-- qua đúng một hàm (`dongBoDienMao` trong server/avatar.ts), và test recompute lại
-- từ `avatar_dan` rồi so, nên "hai nguồn lệch nhau" là thứ CI bắt được.
ALTER TABLE users ADD COLUMN dien_mao TEXT NOT NULL
    DEFAULT '2A0--'
    CONSTRAINT users_dien_mao_dang_chuan
    CHECK (dien_mao ~ '^2[A-C][0-9a-z]([0-9a-z]{2}|--)([0-9a-z]{2}[0-9a-v]{2}[01]){0,64}$');

-- (2) -------------------------------------------------------------------------
-- CATALOG — nới `cosmetic_items` cho ba loại món mới + hai công tắc vận hành.
ALTER TABLE cosmetic_items DROP CONSTRAINT cosmetic_items_kind_check;
ALTER TABLE cosmetic_items ADD CONSTRAINT cosmetic_items_kind_check
    CHECK (kind IN ('skin', 'khung', 'hieu_ung', 'theme',
                    'avatar_nen', 'sticker', 'bang_mau'));

-- Công tắc ẩn. 'an' = ngừng render, GIỮ dòng sở hữu. Khi một món hoá ra có vấn đề
-- thì phải NGỪNG RENDER được mà KHÔNG xoá lịch sử — xoá là mất dữ liệu, hoàn tiền
-- là MINT (phạm A3.4). Ngừng render + cho đổi sang món cùng bậc là đường duy nhất
-- không mint.
ALTER TABLE cosmetic_items ADD COLUMN trang_thai TEXT NOT NULL DEFAULT 'song'
    CHECK (trang_thai IN ('song', 'an', 'thu_hoi'));

-- Tổng số bản được phát hành. NULL = không giới hạn.
--
-- D36: "sticker độc quyền — SỐ LƯỢNG CỰC ÍT, cực hiếm". Con số cụ thể là THAM SỐ
-- KINH TẾ nên agent không đặt (A8.2): cột có sẵn, giá trị để NULL, chốt số về sau
-- là một dòng UPDATE chứ không phải một migration. `capMon()` trong
-- server/avatar.ts đã đếm tồn kho theo cột này, nên bật giới hạn KHÔNG cần code mới.
ALTER TABLE cosmetic_items ADD COLUMN gioi_han INTEGER
    CHECK (gioi_han IS NULL OR gioi_han > 0);

-- Nhãn bản phát hành, hiện cho người chơi ('Beta Access'…). Chỉ là chữ.
ALTER TABLE cosmetic_items ADD COLUMN phien_ban TEXT;

-- (3) -------------------------------------------------------------------------
-- `user_cosmetics` — nới nguồn, và BỎ `equipped`.
--
-- `equipped` là NGUỒN CHÂN LÝ THỨ HAI cho cùng một sự thật ("đang mặc gì"), mà sự
-- thật đó nay nằm ở `users.avatar_dang_mac` + `users.dien_mao`. Hai nguồn thì
-- chúng SẼ lệch, và biểu hiện sẽ là "hồ sơ hiện một đằng, trong trận hiện một
-- nẻo". Bỏ ngay khi chưa có dòng nào thì rẻ; bỏ sau là migrate dữ liệu sống.
ALTER TABLE user_cosmetics DROP CONSTRAINT user_cosmetics_source_check;
ALTER TABLE user_cosmetics ADD CONSTRAINT user_cosmetics_source_check
    CHECK (source IN ('shop_q', 'gacha_t', 'merit', 'bp', 'quest', 'tang_khoi_dau'));
ALTER TABLE user_cosmetics DROP COLUMN equipped;

-- (4) -------------------------------------------------------------------------
-- `avatar_so_huu` — MỘT DÒNG = MỘT TÁC PHẨM.
--
-- `seri` chạy riêng theo (user, nền): "ĐỘI MŨ #3" là tác phẩm thứ ba của chính
-- người đó trên nền đó. Đánh số theo user chứ không theo toàn hệ thống là có chủ
-- ý — số seri toàn hệ thống ("bản thứ 42 trên đời") tạo ra một thứ hạng KHAN HIẾM
-- mua được bằng tốc độ bấm, và đó là Họ 2 giả (D16 mục 13: danh phận CHỈ merit).
CREATE TABLE avatar_so_huu (
    avatar_id   BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users (user_id),
    -- Mã nền trong `config/avatar.ts` (A|B|C). Không FK sang cosmetic_items vì hai
    -- lá tặng KHÔNG phải món sở hữu được — xem ghi chú ở (7).
    nen         TEXT NOT NULL CHECK (nen ~ '^[A-C]$'),
    nguon       TEXT NOT NULL CHECK (nguon IN
                    ('tang_khoi_dau', 'shop_q', 'gacha_t', 'merit', 'bp', 'quest')),
    seri        INTEGER NOT NULL CHECK (seri > 0),
    -- Khung ĐANG ĐEO trên tác phẩm này. Khung KHÔNG bị tiêu hao: tháo ra lắp vào
    -- tuỳ ý, nên nó là một cột đổi được chứ không phải một dòng append-only.
    khung_id    TEXT REFERENCES cosmetic_items (cosmetic_id),
    -- Bản sao đọc nhanh của (nền + khung + mọi dòng avatar_dan). Xem (1).
    chuoi       TEXT NOT NULL,
    -- Công tắc kiểm duyệt: ẩn NHÃN DÁN, giữ nền. Không xoá, không hoàn.
    an          BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, nen, seri)
);

CREATE INDEX avatar_so_huu_user_idx ON avatar_so_huu (user_id, created_at);

-- Không chuyển nhượng (D16 mục 11.2 — bỏ đúng tính giao dịch được của CS:GO).
-- Dùng lại đúng trigger đã canh `user_cosmetics` từ 0009.
CREATE TRIGGER avatar_so_huu_no_transfer
    BEFORE UPDATE ON avatar_so_huu
    FOR EACH ROW EXECUTE FUNCTION forbid_cosmetic_transfer();

-- Ghế đang mặc. NULL khi chưa onboard xong.
ALTER TABLE users ADD COLUMN avatar_dang_mac BIGINT
    REFERENCES avatar_so_huu (avatar_id);

-- (5) -------------------------------------------------------------------------
-- `avatar_dan` — MỖI LẦN DÁN MỘT DÒNG, APPEND-ONLY.
--
-- Đây là chỗ chữ "VĨNH VIỄN" của D36 được thi hành. `thu_tu` = thứ tự dán, và nó
-- cũng là thứ tự chồng lớp: dán sau đè lên dán trước. Không có cột z để sắp xếp
-- lại — sắp xếp lại được thì tác phẩm không còn là một chuỗi hành động không thu
-- hồi được, nó chỉ là một cấu hình.
CREATE TABLE avatar_dan (
    dan_id      BIGSERIAL PRIMARY KEY,
    avatar_id   BIGINT NOT NULL REFERENCES avatar_so_huu (avatar_id),
    -- Ai dán. Suy được qua avatar_id nhưng lưu thẳng: cột này là cột KIỂM DUYỆT,
    -- và một truy vấn kiểm duyệt không nên phụ thuộc vào một JOIN.
    user_id     UUID NOT NULL REFERENCES users (user_id),
    sticker_id  TEXT NOT NULL REFERENCES cosmetic_items (cosmetic_id),
    -- Ô trên-trái của lưới nhãn dán. 0..31, KHÔNG phải phần trăm, KHÔNG phải px.
    x           SMALLINT NOT NULL CHECK (x BETWEEN 0 AND 31),
    y           SMALLINT NOT NULL CHECK (y BETWEEN 0 AND 31),
    lat         BOOLEAN NOT NULL DEFAULT false,
    thu_tu      INTEGER NOT NULL CHECK (thu_tu > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (avatar_id, thu_tu)
);

CREATE INDEX avatar_dan_avatar_idx ON avatar_dan (avatar_id, thu_tu);

-- KHÔNG UPDATE, KHÔNG DELETE, KHÔNG TRUNCATE — "dán là vĩnh viễn" ở tầng DB.
CREATE TRIGGER avatar_dan_append_only
    BEFORE UPDATE OR DELETE ON avatar_dan
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER avatar_dan_no_truncate
    BEFORE TRUNCATE ON avatar_dan
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- (6) -------------------------------------------------------------------------
-- `kho_sticker` — nhãn dán CHƯA DÁN, có SỐ LƯỢNG.
--
-- Nhãn dán là vật tiêu hao nên nó cần một con số, không phải một dòng sở hữu. Trừ
-- kho và ghi `avatar_dan` nằm trong CÙNG một transaction (server/avatar.ts), nên
-- không có trạng thái "đã trừ mà chưa dán" hay ngược lại.
--
-- CHECK `so_luong >= 0` là chốt cuối chống dán quá số có: kể cả khi một endpoint
-- mới quên kiểm, DB vẫn từ chối. Cùng lối `bankroll >= 0` của A6.
CREATE TABLE kho_sticker (
    user_id    UUID NOT NULL REFERENCES users (user_id),
    sticker_id TEXT NOT NULL REFERENCES cosmetic_items (cosmetic_id),
    so_luong   INTEGER NOT NULL DEFAULT 0 CHECK (so_luong >= 0),
    -- Tổng đã từng nhận, chỉ tăng. Dùng cho thống kê "đã tiêu bao nhiêu nhãn" mà
    -- không phải quét cả `avatar_dan`.
    tong_nhan  INTEGER NOT NULL DEFAULT 0 CHECK (tong_nhan >= 0),
    PRIMARY KEY (user_id, sticker_id)
);

CREATE TRIGGER kho_sticker_no_transfer
    BEFORE UPDATE ON kho_sticker
    FOR EACH ROW EXECUTE FUNCTION forbid_cosmetic_transfer();

-- (7) -------------------------------------------------------------------------
-- CATALOG — các dòng dưới đây tồn tại vì `user_cosmetics.cosmetic_id`,
-- `kho_sticker.sticker_id` và `avatar_so_huu.khung_id` đều là KHOÁ NGOẠI trỏ vào
-- `cosmetic_items`. Không có chúng thì việc trao một món nổ 23503 ngay lần đầu
-- chạy thật.
--
-- HAI LÁ TẶNG (A, B) KHÔNG CÓ HÀNG Ở ĐÂY. Chúng không phải món sở hữu được: ai
-- cũng được tặng, và cái sở hữu được là TÁC PHẨM (`avatar_so_huu`), không phải
-- quyền dùng nền. Tạo hàng cho chúng là mở đường cho câu hỏi "vậy có mất được
-- không?" — câu hỏi không nên tồn tại.
--
-- ⚠ MỖI MÓN ĐÚNG MỘT CỬA. Món `niem_yet_q` có `price_q`; món gacha có
-- `price_q = NULL` và KHÔNG BAO GIỜ được đặt giá. Nếu một nhãn vừa bán bằng Q vừa
-- rơi ra từ hộp T thì một lượt tiêu T trả ra GIÁ TRỊ TÍNH BẰNG Q — mà Q chạm
-- voucher thật, tức hộp T vừa thành hộp có giá trị thật. Đó đúng cửa chết pháp lý
-- mà luật ngẫu nhiên D16 dựng ra để tránh, chỉ đi vòng qua một MÓN thay vì một XU.
--
-- Giá: khung 250 Q và skin 600 Q lấy NGUYÊN từ bảng giá D16 đã duyệt. Avatar nền
-- đúng là một "skin" theo phân loại D16 (Họ 1 Diện mạo, quầy Phong cách, niêm yết
-- Q) nên 600 Q KHÔNG phải số mới. Cái CHƯA CÓ GIÁ là **bản sao thứ hai trở đi** —
-- xem `GIA_BAN_SAO_THEM` trong config/avatar.ts, cố ý để `null` chờ founder (A8.2).
INSERT INTO cosmetic_items
    (cosmetic_id, family, kind, label, rarity, price_q, phien_ban, gioi_han)
VALUES
    -- AVATAR NỀN bán ở shop (D36: áo trùm đầu chuyển từ quà sang hàng).
    ('av_ao_trum_dau', 'dien_mao', 'avatar_nen', 'Áo trùm đầu', 'hiem', 600,
     'Beta Access', NULL),
    -- KHUNG VIỀN — đồ ĐEO, không tiêu hao.
    ('kh_manh_cyan',   'dien_mao', 'khung', 'Khung mảnh cyan',  'thuong', 250, NULL, NULL),
    ('kh_kep_violet',  'dien_mao', 'khung', 'Khung kép violet', 'thuong', 250, NULL, NULL),
    ('kh_moc_neo',     'dien_mao', 'khung', 'Khung móc neo',    'thuong', 250, NULL, NULL),
    -- NHÃN DÁN — vật TIÊU HAO, chỉ ra từ cửa gacha T (đốt 100%, D16).
    ('st_kinh_ram',    'dien_mao', 'sticker', 'Kính râm',        'hiem',   NULL, NULL, NULL),
    ('st_ria_mep',     'dien_mao', 'sticker', 'Ria mép',         'thuong', NULL, NULL, NULL),
    ('st_khau_trang',  'dien_mao', 'sticker', 'Khẩu trang',      'thuong', NULL, NULL, NULL),
    ('st_mui_ten_len', 'dien_mao', 'sticker', 'Mũi tên tăng',    'thuong', NULL, NULL, NULL),
    ('st_xu_vang',     'dien_mao', 'sticker', 'Đồng xu',         'thuong', NULL, NULL, NULL),
    ('st_canh_bao',    'dien_mao', 'sticker', 'Biển cảnh báo',   'hiem',   NULL, NULL, NULL),
    ('st_niem_beta',   'dien_mao', 'sticker', 'Dấu niêm Beta',   'epic',   NULL,
     'Beta Access', NULL)
ON CONFLICT (cosmetic_id) DO NOTHING;

-- (8) -------------------------------------------------------------------------
-- `events.action_type` — thêm bốn loại.
--
-- ⚠ BẪY ĐÃ CẮN BA LẦN (0010, 0011, 0012 đều ghi lại): `action_type` là CHECK ĐÓNG,
-- không phải TEXT tự do. Ghi loại event mới mà không mở constraint thì INSERT nổ
-- 23514 LÚC CHẠY THẬT — ở đây là giữa transaction dán nhãn, tức người chơi bấm
-- "DÁN VĨNH VIỄN", nhãn bị trừ khỏi kho... rồi rollback và không có gì xảy ra.
--
-- VÌ SAO BỐN LOẠI NÀY ĐÁNG CÓ (A1 — dữ liệu mới là sản phẩm thật):
--   · `avatar_chon` — revealed preference MIỄN PHÍ của 100% người dùng, ghi đúng
--     một lần trong đời tài khoản. `ms_can_nhac` tách "chọn thật" khỏi "bấm cho
--     xong"; `tu_chon` tách "chọn" khỏi "nhận mặc định".
--   · `cos_equip`  — gu TRÔI theo thời gian; ghép với khẩu vị rủi ro đã có thì
--     thành một trục phân khúc.
--   · `sticker_dan` — ĐÂY LÀ LOẠI ĐẮT NHẤT TRONG BỐN. Nó ghi một quyết định KHÔNG
--     THU HỒI ĐƯỢC, có giá, trên một vật hiếm, TRƯỚC KHI biết người khác nghĩ gì.
--     Đó là cùng cấu trúc quyết định với "cam kết vốn" mà cả D35 đang đi tìm, chỉ
--     khác là ở đây tiền cược là DANH DỰ. `ms_can_nhac` + `so_lan_doi_cho` (số lần
--     dời vị trí trước khi chốt) đo trực tiếp mức ngần ngại.
--   · `avatar_tao`  — một tác phẩm mới ra đời, kèm nguồn. Đo vòng đời tiêu hao.
--
-- Cả bốn KHÔNG backfill được (`events` append-only): không log từ dòng đầu là mất
-- vĩnh viễn.
ALTER TABLE events DROP CONSTRAINT events_action_type_check;
ALTER TABLE events ADD CONSTRAINT events_action_type_check CHECK (action_type IN
    -- v0.1 (GĐ1–GĐ4)
    ('onboard_demo', 'market_view', 'pool_reveal',
     'bet_place', 'bet_adjust', 'checkin', 'subsidy_claim',
    -- GĐ4.5 Đấu trường (loop cũ)
     'sb_match_start', 'sb_faction_pick', 'sb_shop_roll', 'sb_card_buy',
     'sb_alloc_set', 'sb_rule_set', 'sb_news_react', 'sb_round_end',
     'sb_match_end', 'sb_autopsy_view',
    -- Market Hold'em (lát 1)
     'hd_match_start', 'hd_tai_co_cau', 'hd_khao_sat_lai', 'hd_cam_ket',
     'hd_chot_phien', 'hd_tin_gia_lo', 'hd_chay', 'hd_match_end',
    -- Bảng điện tử: mở bảng có TRẢ PHÍ.
     'hd_mo_bang',
    -- Lõi vốn: hai cần gạt của nhịp 1.
     'hd_dao_danh_muc', 'hd_khoa_tai_san',
    -- Diện mạo (D36).
     'avatar_chon', 'cos_equip', 'sticker_dan', 'avatar_tao'));

-- (9) -------------------------------------------------------------------------
-- RLS: khoá kín như mọi bảng khác (0006). Không policy nào — chỉ service role của
-- API chạm được, client không bao giờ nói chuyện thẳng với Postgres (D17a).
ALTER TABLE avatar_so_huu ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_dan    ENABLE ROW LEVEL SECURITY;
ALTER TABLE kho_sticker   ENABLE ROW LEVEL SECURITY;
