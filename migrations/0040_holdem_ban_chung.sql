-- 0040 — BÀN CHUNG THEO SEED (16/08, đề xuất `moi-ban-vao-doi.md` A, founder
-- chốt "làm mấy cái chốt chiều nay").
--
-- Mời bạn kiểu TFT mà không cần ai online cùng lúc: một MÃ bàn ↔ (seed, cỡ map)
-- do server phát; mỗi người vào bàn được MỘT trận riêng cùng seed cùng bot,
-- xong thì so NAV với nhau. Engine không đổi một chip (mỗi người một sổ, giá
-- không ảnh hưởng nhau) — bàn chung chỉ là "cùng một đề" (khuôn Wordle).
--
-- Đây cũng là nền cho KÈO T (đề xuất keo-o-ke bản 3, D95): pool parimutuel cần
-- ≥ 2 người thật cùng ô ⇒ chỉ có nghĩa trên bàn chung.

CREATE TABLE holdem_ban (
    -- Mã 5 ký tự [a-z0-9], server phát (không nhận seed tuỳ ý — luật MAN_TAP_SEED).
    ma            TEXT PRIMARY KEY CHECK (ma ~ '^[a-z0-9]{5}$'),
    seed          BIGINT NOT NULL,
    so_o          INT NOT NULL CHECK (so_o IN (8, 12, 16)),
    chu_user_id   UUID NOT NULL REFERENCES users (user_id),
    -- 'doi' = bàn mời bạn (mã); 'ngay' = bàn ngày (một seed/ngày) — chưa dùng,
    -- khai sẵn để không phải migrate cột khi thử thách ngày (D85) mở.
    loai          TEXT NOT NULL DEFAULT 'doi' CHECK (loai IN ('doi', 'ngay')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    het_han       TIMESTAMPTZ NOT NULL
);

-- Trận thuộc bàn nào (NULL = trận đơn như trước). Một tài khoản MỘT lần mỗi bàn:
-- chơi hai lần cùng seed là biết trước ô (rò rỉ có cấu trúc, không phải rò rỉ
-- xã hội) — UNIQUE chặn ở tầng DB, không tin client.
ALTER TABLE holdem_matches ADD COLUMN ban_ma TEXT NULL REFERENCES holdem_ban (ma);
CREATE UNIQUE INDEX holdem_matches_ban_user_uq
    ON holdem_matches (ban_ma, owner_user_id) WHERE ban_ma IS NOT NULL;
CREATE INDEX holdem_matches_ban_ma_idx ON holdem_matches (ban_ma) WHERE ban_ma IS NOT NULL;
