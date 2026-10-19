-- 0057 — SỔ VẬT: `dot_phat_hanh` + `vat_pham_ban_the` (bước B1, M1 + M2).
--
-- ⚠⚠ VÌ SAO CÓ, VÀ VÌ SAO PHẢI LÀ MỘT BẢNG MỚI CHỨ KHÔNG PHẢI MỘT CỘT THÊM:
--
-- Repo đã có một kỷ luật ĐÚNG cho tiền, và nó chưa được áp cho vật:
--     `users.bankroll` KHÔNG phải chân lý — nó suy ra từ `wallet_ledger`, và
--     `npm run audit:supply` recompute để đối chiếu (A3.10).
-- Vật phẩm thì ngược lại: `kho_sticker.so_luong` và `user_cosmetics` ĐANG là
-- chân lý, và không có gì đối chiếu được với chúng. Một con số đếm không có sổ
-- đằng sau thì sai lệch của nó **không phát hiện được** — đúng loại hỏng mà
-- `audit:supply` sinh ra để chặn ở phía tiền.
--
-- Sổ này lật lại: **`vat_pham_ban_the` là chân lý**, hai bảng kia hạ xuống thành
-- bản đọc nhanh. Không phải một cách làm mới — là dùng lại cách repo đã chứng
-- minh, ở miền thứ hai.
--
-- ─── HAI CỬA MỘT CHIỀU ĐƯỢC CHỐT Ở ĐÂY ──────────────────────────────────────
--  · **M1 — danh tính bản thể.** Từ đây một món là một DÒNG, không phải một số
--    đếm. Không quay lại được: một khi người chơi thấy "bản 3/20", gộp chúng
--    thành một con số là lấy đi thứ đã trao.
--  · **M2 — đợt phát hành.** Mọi lượt đúc phải trỏ vào một đợt. Đợt là nơi cổng
--    G1 (hạn mức) và G3 (đã đóng) bám vào; không có nó thì hai cổng đó không có
--    chỗ đứng và phải bịa ra sau.
--
-- ─── ⚠ BƯỚC NÀY KHÔNG ĐỔI MỘT DÒNG ĐƯỜNG ĐỌC NÀO ────────────────────────────
-- Khuôn ba nhịp (chuẩn cho mọi lần đổi nguồn chân lý trong repo này):
--   1. DI TRÚ      — sinh bản thể cho mọi vật đang tồn tại   ← migration này
--   2. GHI SONG SONG — mọi đường đúc/tiêu ghi CẢ hai, cùng transaction ← B1
--   3. CHUYỂN ĐỌC  — chỉ khi audit cân liên tục N ngày        ← B4, không phải giờ
-- Giữa nhịp 2 và 3, hỏng thì TẮT CỜ là xong, không mất dữ liệu.
--
-- ─── ⚠⚠ KHÔNG SỬA `forbid_cosmetic_transfer()` (0009:181) ───────────────────
-- Hàm đó đang canh BỐN bảng bằng một lời hứa tuyệt đối: *user_id của một dòng
-- không bao giờ đổi*. Nới nó ra để cho phép NULL là **hạ một bảo đảm đang đúng
-- cho cả bốn bảng** chỉ để mua một tính năng cần đến bảng thứ năm. Bảng mới mang
-- trigger mới; bốn bảng cũ giữ nguyên lời hứa, không sửa một dòng.

BEGIN;

-- (1) ĐỢT PHÁT HÀNH — M2 --------------------------------------------------------
CREATE TABLE dot_phat_hanh (
    dot_id      BIGSERIAL PRIMARY KEY,
    mau_id      TEXT NOT NULL REFERENCES cosmetic_items (cosmetic_id),
    -- NULL = phát không hạn mức (bể gacha thường). Số = bản giới hạn (cổng G1).
    han_muc     INTEGER NULL CHECK (han_muc IS NULL OR han_muc > 0),
    trang_thai  TEXT NOT NULL CHECK (trang_thai IN ('mo', 'dong_bao_truoc', 'dong_vinh_vien')),
    -- Mốc CÔNG BỐ sẽ đóng. Cú sốc cung phải có báo trước, nếu không thì "khan
    -- hiếm" chỉ là một cú bất ngờ, và bất ngờ thì không ai chuẩn bị được.
    cong_bo_luc TIMESTAMPTZ NULL,
    -- Mốc đóng THẬT ⇒ cổng G3.
    dong_luc    TIMESTAMPTZ NULL,
    -- Bộ đếm cấp seri. Suy được bằng COUNT, nhưng cấp seri tuần tự cần MỘT CHỖ
    -- để khoá. `audit:cung` đối chiếu nó với COUNT — y hệt bankroll ↔ ledger.
    da_phat     INTEGER NOT NULL DEFAULT 0 CHECK (da_phat >= 0),
    tao_luc     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dot_khong_vuot_han_muc CHECK (han_muc IS NULL OR da_phat <= han_muc),
    -- Đóng thì phải có mốc đóng; mở thì không được có.
    CONSTRAINT dot_dong_phai_co_moc
        CHECK ((trang_thai = 'dong_vinh_vien') = (dong_luc IS NOT NULL))
);

-- ⚠ MỖI MẪU CHỈ MỘT ĐỢT MỞ. Không phải để gọn — để câu "lượt đúc này vào đợt
-- nào?" có ĐÚNG MỘT câu trả lời. Hai đợt mở cùng lúc thì câu đó thành một lựa
-- chọn, và một lựa chọn không ai định nghĩa là chỗ hai đường code trả lời khác
-- nhau rồi seri lệch mà không ai thấy.
CREATE UNIQUE INDEX dot_mo_duy_nhat_moi_mau
    ON dot_phat_hanh (mau_id) WHERE trang_thai = 'mo';

-- (2) SỔ BẢN THỂ — M1 -----------------------------------------------------------
-- Một dòng = một bản tồn tại trên đời.
CREATE TABLE vat_pham_ban_the (
    ban_the_id  BIGSERIAL PRIMARY KEY,
    dot_id      BIGINT  NOT NULL REFERENCES dot_phat_hanh (dot_id),
    -- Số thứ tự TRONG ĐỢT, không phải trong mẫu suốt đời.
    --
    -- ⚠ Đây là chỗ uốn `migrations/0013:114` một cách CÓ KIỂM SOÁT. 0013 bác seri
    -- toàn cục vì nó biến mọi món thường thành một bảng xếp hạng tốc độ bấm.
    -- Theo ĐỢT thì lý do đó không còn: "bản 3/20 của đợt A" đọc một cái là hiểu
    -- và tra được, còn "bản thứ 4.271 của nhãn dán X" thì không nói lên gì.
    -- Giữ được ý nghĩa sưu tầm mà không đẻ ra thứ hạng toàn cục.
    seri        INTEGER NOT NULL CHECK (seri > 0),
    chu_so_huu  UUID NULL REFERENCES users (user_id),
    -- Kho của Hệ thống. ĐÚNG MỘT trong hai cột chủ sở hữu được khác NULL.
    kho         TEXT NULL CHECK (kho IN ('amm', 'dau_gia', 'trung_bay')),
    trang_thai  TEXT NOT NULL CHECK (trang_thai IN ('tu_do', 'da_gan', 'da_tieu')),
    nguon       TEXT NOT NULL CHECK (nguon IN ('gacha', 'mua_he_thong', 'di_tru', 'tang')),
    tao_luc     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (dot_id, seri),
    -- Không có bản thể vô chủ, cũng không có bản thể hai chủ.
    CONSTRAINT ban_the_mot_chu CHECK (num_nonnulls(chu_so_huu, kho) = 1)
);

CREATE INDEX ban_the_theo_chu ON vat_pham_ban_the (chu_so_huu) WHERE chu_so_huu IS NOT NULL;
CREATE INDEX ban_the_theo_kho ON vat_pham_ban_the (kho) WHERE kho IS NOT NULL;
CREATE INDEX ban_the_theo_dot ON vat_pham_ban_the (dot_id);

-- (3) TRIGGER R1 — bảng MỚI, trigger MỚI ---------------------------------------
-- Đổi chủ chỉ hợp lệ khi MỘT ĐẦU là Hệ thống. Không bao giờ user → user.
--
-- ⚠ Đây là tường lửa PHÁP LÝ (NĐ 147/2024 Điều 57 K5 — cấm P2P), đặt ở tầng DB
-- chứ không ở tầng route: một luật chỉ sống ở route thì nó chết vào ngày ai đó
-- viết route thứ hai.
CREATE FUNCTION ban_the_doi_chu_hop_le() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.chu_so_huu IS DISTINCT FROM OLD.chu_so_huu THEN
        IF OLD.trang_thai <> 'tu_do' THEN
            RAISE EXCEPTION 'Bản đã gắn/đã tiêu không đổi chủ được'
                USING ERRCODE = 'check_violation';
        END IF;
        IF OLD.chu_so_huu IS NOT NULL AND NEW.chu_so_huu IS NOT NULL THEN
            RAISE EXCEPTION 'Không có đường user → user (Điều 57 K5)'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    -- Seri và đợt là danh tính, không phải thuộc tính — đổi chúng là đánh tráo
    -- một bản thể chứ không phải sửa nó.
    IF NEW.dot_id IS DISTINCT FROM OLD.dot_id OR NEW.seri IS DISTINCT FROM OLD.seri THEN
        RAISE EXCEPTION 'Không đổi được danh tính bản thể (dot_id/seri)'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END; $$;

CREATE TRIGGER ban_the_doi_chu
    BEFORE UPDATE ON vat_pham_ban_the
    FOR EACH ROW EXECUTE FUNCTION ban_the_doi_chu_hop_le();

-- (3b) KHOÁ PostgREST -----------------------------------------------------------
-- Bật RLS mà KHÔNG tạo policy nào ⇒ không role nào đọc được qua PostgREST; chỉ
-- service role của API đi qua. Cùng nếp 0006/0010/0017 — và `tests/
-- schema_constraints.test.ts` canh: mọi bảng public phải có RLS, không ngoại lệ.
-- Sổ vật là sổ tài sản của người chơi, nên đây không phải thủ tục cho đủ.
ALTER TABLE dot_phat_hanh ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_pham_ban_the ENABLE ROW LEVEL SECURITY;

-- (4) DI TRÚ — nhịp 1 -----------------------------------------------------------
--
-- ⚠ DI TRÚ SOI GƯƠNG HIỆN TẠI, KHÔNG DỰNG LẠI QUÁ KHỨ.
-- Sinh bản thể cho những gì ĐANG tồn tại: mỗi dòng `user_cosmetics`, và
-- `so_luong` bản cho mỗi dòng `kho_sticker`. Nhãn đã dán (đã tiêu) thì KHÔNG
-- sinh dòng `da_tieu` — ta không có dữ liệu để biết bản nào đã dán, và bịa ra
-- một lịch sử trông-như-thật là thứ tệ hơn hẳn một sổ bắt đầu từ hôm nay.
-- Đó cũng đúng điều E2 cần: `kho_sticker.so_luong` = COUNT bản thể `tu_do`.
--
-- Mỗi MẪU một đợt `di_tru`, `han_muc = NULL`, `trang_thai = 'mo'` (founder chốt).

INSERT INTO dot_phat_hanh (mau_id, han_muc, trang_thai)
SELECT ci.cosmetic_id, NULL, 'mo'
FROM cosmetic_items ci
WHERE EXISTS (SELECT 1 FROM user_cosmetics uc WHERE uc.cosmetic_id = ci.cosmetic_id)
   OR EXISTS (SELECT 1 FROM kho_sticker ks
              WHERE ks.sticker_id = ci.cosmetic_id AND ks.so_luong > 0);

WITH hang AS (
    -- Cosmetic sở hữu: mỗi dòng đúng một bản.
    SELECT uc.cosmetic_id AS mau_id, uc.user_id AS chu,
           uc.acquired_at AS luc, 0 AS thu_tu
    FROM user_cosmetics uc
    UNION ALL
    -- Nhãn trong kho: `so_luong` bản. `generate_series` là LATERAL ngầm.
    SELECT ks.sticker_id, ks.user_id, NULL::timestamptz, g.i
    FROM kho_sticker ks, generate_series(1, ks.so_luong) AS g(i)
    WHERE ks.so_luong > 0
),
danh_so AS (
    -- Thứ tự seri phải TẤT ĐỊNH, nếu không thì chạy lại migration trên hai máy
    -- ra hai bộ seri khác nhau — mà seri là danh tính.
    SELECT h.*,
           row_number() OVER (
               PARTITION BY h.mau_id
               ORDER BY h.luc NULLS LAST, h.chu, h.thu_tu
           ) AS seri
    FROM hang h
)
INSERT INTO vat_pham_ban_the (dot_id, seri, chu_so_huu, kho, trang_thai, nguon)
SELECT d.dot_id, ds.seri, ds.chu, NULL, 'tu_do', 'di_tru'
FROM danh_so ds
JOIN dot_phat_hanh d ON d.mau_id = ds.mau_id AND d.trang_thai = 'mo';

-- Bộ đếm phải khớp COUNT ngay từ dòng đầu tiên — đó là bất biến E2, và nếu nó
-- sai ngay lúc di trú thì mọi phép đối chiếu sau này đo trên một nền lệch.
UPDATE dot_phat_hanh d
SET da_phat = (SELECT count(*) FROM vat_pham_ban_the b WHERE b.dot_id = d.dot_id);

COMMIT;
