-- 0047 — PFM LỚP NỀN: két lát tháng · bảng điểm · token · cúp · đặc trưng 4 lớp (D186).
--
-- Founder 30/08: *"Giờ thì build đi"* sau khi chốt khung chức năng A–K (05c) và
-- kiến trúc data (05b K1–K15). Đây là commit ĐẦU của PFM — chỉ lớp nền, chưa route,
-- chưa UI.
--
-- ⚠⚠ BA NGĂN, BA LUẬT KHÁC NHAU — đọc trước khi sửa bất kỳ dòng nào:
--   ① SỔ THÔ  → KHÔNG có ở đây. Nó nằm trong máy user (IndexedDB). Server không có
--     một bảng giao dịch nào, và đó là CỬA MỘT CHIỀU (P2 🔒): đổ thô lên rồi mới
--     nghĩ lại thì dữ liệu nhạy cảm đã nằm đó.
--   ② KÉT + BẢNG ĐIỂM → các bảng dưới đây. XOÁ ĐƯỢC (P9 🔒 — quyền của user với dữ
--     liệu đời thật của họ). Đây là loại bảng THỨ BA của hệ, không phải `events`,
--     không phải `telemetry`.
--   ③ NHỊP THÔ → `events` sẵn có, chỉ nới `action_type` ở cuối file. Dòng PFM vào
--     đó CHỈ mang id + enum — không số tiền, không chữ tự do (K5, founder chốt).
--
-- ⚠ VÌ SAO KHÔNG CÓ `pfm_chi_so_thang`: bảng đó (bản đầu 05b T1) đã bị `pfm_dac_trung`
-- THAY (T7.1). Ai đọc T1 rồi tạo cả hai là dựng bản sao thứ hai của cùng một việc (D61).

-- ─────────────────────────────────────────────────────────────────────────────
-- (1) users — consent riêng + ví token PFM + múi giờ
-- ─────────────────────────────────────────────────────────────────────────────

-- ⚠ CONSENT LÀ Ô RIÊNG, KHÔNG DÙNG LẠI `research_consent` (P9 🔒). Hai thứ khác mục
-- đích: research_consent nói về dữ liệu TRÒ CHƠI, cái này về dữ liệu TÀI CHÍNH THẬT.
-- Gộp là mượn sự đồng ý của việc này cho việc kia.
--
-- ⚠ CONSENT CONTEXTUAL (founder 30/08, D175): KHÔNG có màn hỏi-nghiên-cứu ở cửa vào.
-- Sổ chạy hoàn toàn local, không cần consent nào; cột này chỉ bật khi user chạm đúng
-- cái cửa cần nó (sao lưu / đặc trưng / nối game). Vết đồng ý (đã hiện văn bản id nào,
-- phiên bản nào, bấm gì) đi vào `events` — không có vết thì PDPD coi như chưa có consent.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pfm_consent  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pfm_bat_dau  TIMESTAMPTZ;

-- ⚠ BIGINT, KHÔNG PHẢI INT — cho khớp `bankroll`/`quest_points`. `server/db.ts` đăng
-- ký parser int8 → BigInt của JS; một cột INT đứng cạnh chúng là mời lỗi "Cannot mix
-- BigInt and other types" nổ giữa transaction (bug thật 18/07/2026).
ALTER TABLE users ADD COLUMN IF NOT EXISTS pfm_token BIGINT NOT NULL DEFAULT 0
  CHECK (pfm_token >= 0);

-- ⚠ MÚI GIỜ LÀ CỬA MỘT CHIỀU (K15): "ngày" của streak/tuần/kỳ một khi đã chốt thành
-- DATE thì không diễn giải lại được. Hôm nay mọi user là VN nên mặc định làm hành vi
-- y hệt bản không có cột; mai mở nước thứ hai chỉ là đổi một giá trị mặc định.
ALTER TABLE users ADD COLUMN IF NOT EXISTS mui_gio TEXT NOT NULL
  DEFAULT 'Asia/Ho_Chi_Minh';

-- ─────────────────────────────────────────────────────────────────────────────
-- (2) pfm_luu — KÉT, cắt LÁT THÁNG, mã hoá đầu-cuối
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠ SERVER GIỮ KÉT NHƯNG KHÔNG CÓ CHÌA (K2, founder chốt). `blob` là ciphertext
-- AES-GCM do máy user khoá bằng khoá dẫn xuất từ MÃ KHÔI PHỤC. Server không giải mã
-- được, kể cả muốn — nên câu với luật sư đổi tính chất: không phải "chúng tôi giữ an
-- toàn", mà "chúng tôi KHÔNG THỂ đọc".
--
-- ⚠ CẮT LÁT THÁNG chứ không phải 3 bản trọn sổ (K10 — đo, không đoán):
--   trọn sổ 1 năm = 35 KB thật (bản đầu ước "10–20 KB", thấp 2–3 lần)
--   trọn sổ 3 năm = 103 KB ⇒ VỠ trần 64 KB của bản đầu vào khoảng NĂM THỨ HAI,
--                            im lặng, với đúng người dùng trung thành nhất.
--   lát tháng: mỗi cú đẩy 3,2 KB và ĐỨNG YÊN vĩnh viễn (không tăng theo tuổi sổ);
--              tổng dung lượng giảm 55–60%; giá phải trả: nén kém hơn 14–16%.
-- Tháng ĐÃ ĐÓNG giữ đúng 1 bản (the_he = 1) và không bao giờ ghi lại; chỉ THÁNG ĐANG
-- SỐNG mới giữ tới 3 thế hệ phòng bản mới nhất hỏng giữa chừng.
CREATE TABLE pfm_luu (
    user_id    UUID     NOT NULL REFERENCES users(user_id),
    thang      DATE     NOT NULL,      -- ngày 1 của tháng, theo users.mui_gio
    the_he     SMALLINT NOT NULL DEFAULT 1 CHECK (the_he BETWEEN 1 AND 3),
    blob       BYTEA    NOT NULL CHECK (octet_length(blob) <= 32768),
    schema_v   SMALLINT NOT NULL,
    -- ⚠ `ver` do SERVER cấp, tăng dần. KHÔNG dùng đồng hồ client làm trọng tài chống
    -- ghi đè: K7 vừa tuyên đồng hồ máy user là thứ không tin được, dùng nó ở đây là
    -- tự mâu thuẫn — và là đúng khuôn "ghi trước khoá sau" mà repo đã cấm.
    ver        INTEGER  NOT NULL DEFAULT 1 CHECK (ver >= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, thang, the_he)
);
CREATE INDEX pfm_luu_user_idx ON pfm_luu (user_id, thang DESC);
ALTER TABLE pfm_luu ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pfm_luu IS
  'KÉT: ciphertext do máy user khoá. Server KHÔNG có chìa. Cắt lát THÁNG (K10). '
  'KHÔNG vào backup đêm — xem BANG_PHU_DU ở server/backup.ts (K12).';

-- ─────────────────────────────────────────────────────────────────────────────
-- (3) pfm_ngay — ĐIỂM DANH, bốn trạng thái (D139/D140)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠ BẢNG NÀY KHÔNG CÓ MỘT SỐ TIỀN NÀO, VÀ ĐÓ LÀ CẢ THIẾT KẾ (K3). Máy trả thưởng
-- (token/cúp/streak) chỉ đọc được ngăn này ⇒ nó KHÔNG CÓ GÌ ĐỂ ĐỌC nếu muốn thưởng
-- theo tiền. P5 ("thưởng không mua được bằng khối lượng") và P6 🔒 ("tự khai vô
-- trùng") vì thế đúng BẰNG CẤU TRÚC, không bằng kỷ luật của người viết code.
--
-- Bốn trạng thái, KHÔNG được gộp (D140 — founder bắt đúng hệ quả không lường trước):
--   tron       — điểm danh trơn                  ⇒ chỉ số tiền đọc NULL ("chưa biết")
--   khong_tieu — tự khai "hôm nay không tiêu gì" ⇒ SỐ 0 THẬT (loại ngày đáng ghi
--                nhận nhất; thiết kế cũ làm nó biến mất y hệt ngày không mở app)
--   tieu_it    — "tiêu ít, khỏi ghi từng khoản"  ⇒ trạng thái RIÊNG: có tiêu, không
--                rõ bao nhiêu. Gộp vào 0 là sai lệch xuống, gộp vào null là bỏ phí.
--   co_ghi     — có ghi chi tiết trong sổ         ⇒ đúng 1 bit, KHÔNG kèm nội dung.
CREATE TABLE pfm_ngay (
    user_id    UUID NOT NULL REFERENCES users(user_id),
    ngay       DATE NOT NULL,          -- theo users.mui_gio, SERVER tự tính
    trang_thai TEXT NOT NULL CHECK (trang_thai IN
                 ('tron', 'khong_tieu', 'tieu_it', 'co_ghi')),
    ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ngay)
);
ALTER TABLE pfm_ngay ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- (4) pfm_tuan — NIÊM PHONG TUẦN (nghi lễ Chủ nhật) + phán quyết token
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠ `moc_json` chở ID CÁC MỐC đạt được, KHÔNG chở số tiền. Cùng lý do (3).
CREATE TABLE pfm_tuan (
    user_id       UUID NOT NULL REFERENCES users(user_id),
    tuan          DATE NOT NULL,       -- thứ Hai của tuần, theo users.mui_gio
    token_thuong  INTEGER NOT NULL DEFAULT 0 CHECK (token_thuong >= 0),
    moc_json      JSONB   NOT NULL DEFAULT '[]'::jsonb,
    niem_phong_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, tuan)
);
ALTER TABLE pfm_tuan ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- (5) pfm_token_ledger — SỔ CÁI ĐỒNG TIỀN THỨ BA
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠ TƯỜNG LỬA BA CHIỀU T ↔ Q ↔ token-PFM (P4 🔒, mở rộng A3.5). Không một đường quy
-- đổi nào, ở schema lẫn code. Token PFM KHÔNG rút từ Kho bạc (A3.4) — nó được "in"
-- theo luật tất định có TRẦN PHÁT/NGÀY; in-có-trần an toàn ở đây vì token PFM chỉ đổi
-- được đồ trang trí (A3.9): lạm phát tệ nhất là "nhiều người có nhiều skin".
CREATE TABLE pfm_token_ledger (
    entry_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       UUID    NOT NULL REFERENCES users(user_id),
    delta         INTEGER NOT NULL,
    balance_after BIGINT  NOT NULL CHECK (balance_after >= 0),
    reason        TEXT    NOT NULL CHECK (reason IN
                    ('moc_su_kien', 'phan_quyet_tuan', 'mua_shop', 'admin_adjust')),
    ref           TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pfm_token_ledger_user_idx ON pfm_token_ledger (user_id, entry_id DESC);
ALTER TABLE pfm_token_ledger ENABLE ROW LEVEL SECURITY;

-- ⚠⚠ APPEND-ONLY *CÓ MỘT CỬA THOÁT DUY NHẤT*, và cửa đó tồn tại vì HAI LUẬT 🔒 CẮN
-- NHAU: A3.10 đòi mọi thay đổi số dư đi qua sổ cái bất biến, còn P9 🔒 đòi user xoá
-- tài khoản là sạch mọi bảng `pfm_*`. Quyền xoá của user (nghĩa vụ pháp lý) THẮNG quy
-- ước kế toán nội bộ — nhưng phải thắng TƯỜNG MINH, không phải bằng cách bỏ trigger.
--
-- Cửa thoát: chỉ DELETE được khi transaction tự khai `delphi.xoa_pfm = '1'`. Đúng MỘT
-- đường code được phép đặt cờ đó (`server/pfm/xoa.ts`), nên nó greppable và khoá được
-- bằng test. UPDATE thì cấm tuyệt đối, không cửa nào.
CREATE OR REPLACE FUNCTION pfm_token_ledger_chan() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting('delphi.xoa_pfm', true) = '1' THEN
        RETURN OLD;   -- đường xoá theo quyền user (P9 🔒)
    END IF;
    RAISE EXCEPTION
        'pfm_token_ledger là append-only: % bị cấm (A3.10; xoá theo P9 phải đặt delphi.xoa_pfm)',
        TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER pfm_token_ledger_append_only
    BEFORE UPDATE OR DELETE ON pfm_token_ledger
    FOR EACH ROW EXECUTE FUNCTION pfm_token_ledger_chan();
CREATE TRIGGER pfm_token_ledger_no_truncate
    BEFORE TRUNCATE ON pfm_token_ledger
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- ⚠ VÍ PHẢI KHỚP SỔ — chép khuôn `kiem_quest_points_khop_so` (0016), kể cả bài học
-- đắt nhất của nó: ĐỌC LẠI giá trị cuối trong bảng, KHÔNG dùng `NEW`. Trigger này
-- DEFERRED nên chạy lúc COMMIT, mà `NEW` là ảnh chụp lúc UPDATE — một transaction đổi
-- token hai lần (nhận hai mốc liền nhau, chuyện thường ngày) sẽ xếp hai lần kiểm và
-- lần đầu mang `NEW` cũ ⇒ luôn báo lệch sai.
CREATE OR REPLACE FUNCTION kiem_pfm_token_khop_so() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    cuoi     BIGINT;
    hien_tai BIGINT;
BEGIN
    SELECT balance_after INTO cuoi
      FROM pfm_token_ledger
     WHERE user_id = NEW.user_id
     ORDER BY entry_id DESC
     LIMIT 1;

    SELECT pfm_token INTO hien_tai FROM users WHERE user_id = NEW.user_id;

    IF cuoi IS NULL THEN
        RAISE EXCEPTION
            'pfm_token đổi mà không có dòng pfm_token_ledger nào (A3.10)'
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF cuoi IS DISTINCT FROM hien_tai THEN
        RAISE EXCEPTION
            'pfm_token (%) lệch dòng cuối pfm_token_ledger (%) — ví phải là số dư suy từ sổ',
            hien_tai, cuoi
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER users_pfm_token_khop_so
    AFTER UPDATE ON users
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    WHEN (OLD.pfm_token IS DISTINCT FROM NEW.pfm_token)
    EXECUTE FUNCTION kiem_pfm_token_khop_so();

-- ─────────────────────────────────────────────────────────────────────────────
-- (6) pfm_cup — CÚP / VINH DANH
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠ CỘT `nguon` LÀ BANK-PROOF (P8): bank feed sau này là nhân chứng thứ tư cắm vào
-- CÙNG khuôn — cúp "thành quả xác minh" bật lên bằng cách đổi giá trị cột này, không
-- phải bằng cách sửa schema.
-- ⚠ `cup_id` là ID TĨNH; chữ + hình ở client (D26 — server trả ID + SỐ).
CREATE TABLE pfm_cup (
    user_id    UUID NOT NULL REFERENCES users(user_id),
    cup_id     TEXT NOT NULL,
    nguon      TEXT NOT NULL DEFAULT 'tu_khai' CHECK (nguon IN ('tu_khai', 'xac_minh')),
    season_id  TEXT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, cup_id)
);
ALTER TABLE pfm_cup ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- (7) pfm_dac_trung — ỐNG NGỮ NGHĨA 4 LỚP (K14 · G7/P15)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠ CỬA MỘT CHIỀU (P2 🔒). Bảng này chở ĐẶC TRƯNG ĐÃ CHUẨN HOÁ, không bao giờ chở:
-- số tiền tuyệt đối · chữ tự do · thông tin định danh. Nhãn sinh từ CÚ CHỌN MENU của
-- user (P14) nên đúng 100% mà không cần một dòng NLP nào — thiết kế UX và thiết kế
-- data ở đây là MỘT việc.
--
-- ⚠ Danh mục mã + miền giá trị nằm ở `config/pfm_dac_trung.ts` (MỘT nguồn, D61).
-- Server validate registry-driven: mã lạ / lớp lệch / ngoài miền ⇒ từ chối ở cửa.
CREATE TABLE pfm_dac_trung (
    user_id        UUID NOT NULL REFERENCES users(user_id),
    ky             DATE NOT NULL,      -- ngày 1 của THÁNG, theo users.mui_gio; SERVER tự tính
    lop            TEXT NOT NULL CHECK (lop IN
                     ('context', 'intent', 'behavior', 'outcome', 'intervention')),
    ma             TEXT NOT NULL,
    -- id hũ/luật/content khi đặc trưng gắn với MỘT đối tượng; '' khi gắn cả kỳ.
    doi_tuong      TEXT NOT NULL DEFAULT '',
    gia_tri        JSONB NOT NULL CHECK (pg_column_size(gia_tri) <= 256),
    nguon          TEXT NOT NULL DEFAULT 'tu_khai' CHECK (nguon IN ('tu_khai', 'xac_minh')),
    schema_version SMALLINT NOT NULL,
    cap_nhat_luc   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ky, lop, ma, doi_tuong)
);
-- ⚠ INDEX CẮT NGANG — vá đúng lỗ mà audit hạ tầng chỉ ra (D146): mọi khoá chính
-- `pfm_*` đều bắt đầu bằng `user_id`, nên KHÔNG đường đọc nào theo đặc-trưng/kỳ có
-- index — kể cả đường nghiên cứu mà chính bảng này sinh ra để phục vụ.
CREATE INDEX pfm_dac_trung_ma_idx ON pfm_dac_trung (ma, ky);
ALTER TABLE pfm_dac_trung ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pfm_dac_trung IS
  'Đặc trưng 4 lớp C→I→B→O (+intervention). Không tiền tuyệt đối, không chữ tự do. '
  'Danh mục ở config/pfm_dac_trung.ts — MỘT nguồn.';

-- ─────────────────────────────────────────────────────────────────────────────
-- (8) events.action_type — nới cho nhịp PFM
-- ─────────────────────────────────────────────────────────────────────────────
--
-- ⚠⚠ BẪY ĐÃ CẮN 7 LẦN (0009→0019): `action_type` là CHECK ĐÓNG. Nới bằng cách ĐỌC
-- định nghĩa hiện tại rồi nối thêm — KHÔNG gõ lại danh sách, vì gõ lại là xoá việc
-- của người khác đang chạy song song.
--
-- ⚠ DÒNG PFM VÀO ĐÂY CHỈ MANG ID + ENUM (K5, founder chốt). Không số tiền, không chữ
-- tự do — nội dung luật/hũ nằm trong sổ ở máy. Nhờ vậy quyền xoá P9 🔒 và A3.3
-- (events không xoá) không cắn nhau: sau khi xoá tài khoản, phần còn lại chỉ là xác
-- số học vô danh. Whitelist trường của từng loại khoá bằng test.
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

    IF dinh_nghia LIKE '%pfm_diem_danh%' THEN
        RETURN;   -- idempotent với chính nó
    END IF;

    moi := replace(
        dinh_nghia,
        '::text]',
        '::text, ''pfm_bat''::text, ''pfm_tat''::text, ''pfm_consent''::text,'
        || ' ''pfm_diem_danh''::text, ''pfm_hu''::text, ''pfm_luat''::text,'
        || ' ''pfm_tuan_niem_phong''::text]');

    IF moi NOT LIKE '%pfm_diem_danh%' THEN
        RAISE EXCEPTION
            'không chèn được loại event PFM vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;
