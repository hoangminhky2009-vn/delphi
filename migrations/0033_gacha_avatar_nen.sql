-- 0033 — HAI LÁ TRADER VÀO HỘP GACHA (D68a, founder 04/08)
--
-- Trước migration này hai lá `av_trader_1`/`av_trader_2` đã khai đủ trong
-- `config/avatar.ts` (nguồn `gacha_t`, bậc hiếm, `doc_ban`) và art đã vẽ — nhưng
-- KHÔNG một dòng code server nào đọc chúng: `ungVien()` chỉ lọc `NHAN_DAN`, còn
-- `docTonKho()` chỉ đọc `kind = 'sticker'`. Chúng là config chết.
--
-- Migration này trả hai thứ DB phải giữ, và chỉ hai thứ đó:
--   (1) chỗ đứng trong catalog — để có công tắc `trang_thai` và cột `gioi_han`;
--   (2) CHỐT CUỐI cho luật độc bản — thứ code không tự bảo đảm được.

-- (1) -------------------------------------------------------------------------
-- CATALOG. `kind = 'avatar_nen'` đã hợp lệ từ 0013; `nguon_cua = 'gacha_t'` bắt
-- buộc `price_q IS NULL` theo CHECK `cosmetic_mot_mon_mot_cua` (0015) — đúng ý:
-- lá quay ra được thì KHÔNG được đồng thời bán bằng Q, nếu không thì một lượt
-- tiêu T vừa trả ra giá trị tính bằng Q, và hộp T thành hộp có giá trị thật.
--
-- `gioi_han` để NULL: hai lá này giới hạn theo NGƯỜI (mỗi người một bản), không
-- giới hạn theo TỔNG BẢN PHÁT HÀNH. Nhét một con số vào đây là trần toàn hệ —
-- một khái niệm khác hẳn, và nó sẽ chặn người thứ N+1 nhận lá của chính họ.
INSERT INTO cosmetic_items
    (cosmetic_id, family, kind, label, rarity, price_q, nguon_cua, gioi_han)
VALUES
    ('av_trader_1', 'dien_mao', 'avatar_nen', 'TRADER #1', 'hiem', NULL, 'gacha_t', NULL),
    ('av_trader_2', 'dien_mao', 'avatar_nen', 'TRADER #2', 'epic', NULL, 'gacha_t', NULL)
ON CONFLICT (cosmetic_id) DO NOTHING;

-- (2) -------------------------------------------------------------------------
-- ĐỘC BẢN — chốt ở tầng DB, không chỉ ở tầng code.
--
-- ⚠ VÌ SAO KHÔNG ĐỦ NẾU CHỈ LỌC TRONG `ungVien()`: phép lọc đọc tập sở hữu ở đầu
-- transaction, còn dòng `avatar_so_huu` chỉ được ghi ở cuối. Hai tab quay cùng
-- lúc thì cả hai cùng đọc "chưa có", cả hai cùng ghi, và `UNIQUE (user_id, nen,
-- seri)` KHÔNG chặn — vì `taoAvatarNen` tự tăng seri, nên bản thứ hai vào ô
-- seri 2 một cách hoàn toàn hợp lệ. Kết quả: một người hai bản của lá độc bản,
-- và không có gì nổ.
--
-- Partial unique index chặn đúng chỗ đó và KHÔNG đụng các lá còn lại: lá tặng và
-- lá mua bằng Q vẫn là VẬT TIÊU HAO (D36 — mỗi tác phẩm sticker cần một tấm nền
-- mới), nên chúng phải giữ được nhiều bản.
--
-- Danh sách mã ở đây trùng với `doc_ban: true` trong `config/avatar.ts`. Hai chỗ
-- là hai nguồn chân lý, và đó là chủ ý: DB không đọc được TypeScript, mà chốt
-- cuối thì phải nằm ở DB. `tests/gacha_nen.test.ts` so hai danh sách và đỏ nếu
-- chúng lệch — nên thêm lá độc bản mới mà quên migration thì test bắt ngay.
CREATE UNIQUE INDEX avatar_so_huu_doc_ban_uniq
    ON avatar_so_huu (user_id, nen)
    WHERE nen IN ('E', 'F');

-- (3) -------------------------------------------------------------------------
-- LOẠI EVENT MỚI: `gacha_trung` — lượt bốc trúng lá đã sở hữu, KHÔNG trừ T.
--
-- ⚠⚠ CHỖ NÀY SUÝT LÊN PROD DƯỚI DẠNG LỖI 500, và cách nó lộ ra đáng ghi lại:
-- `events.action_type` là CHECK ĐÓNG (0001 dòng 175), không phải TEXT tự do —
-- migration 0010 đã ghi đúng cảnh báo này ("bẫy đã dính ở 0009") và đợt này dính
-- lại. Nhánh trùng chỉ chạy khi có ĐUA (người nhận lá từ nguồn khác giữa lúc lọc
-- và lúc ghi), nên đường chạy thường không bao giờ chạm tới nó: bộ test xanh
-- tuyệt đối, rồi người đầu tiên gặp đua ăn 500 thay vì lời giải thích.
-- Thứ moi nó ra là PHÉP TIÊM LỖI NGƯỢC (D62) — cố ý gỡ phép lọc theo sở hữu để
-- ép nhánh trùng chạy thật.
--
-- Nới THEO HIỆU (idiom 0017), không chép lại danh sách: chép là xoá loại của
-- migration khác, và 0017 đã dính đúng lỗi đó với 0013.
DO $$
DECLARE
    dang_co TEXT[];
    them    TEXT[] := ARRAY['gacha_trung'];
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
