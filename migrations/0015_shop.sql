-- ===========================================================================
-- 0015 — SHOP: hai cửa TÁCH HẲN NHAU (Q niêm yết · T quay hộp) + kho hữu hạn.
--
-- Thi công D36 ("sticker phải MUA hoặc QUAY, không phát miễn phí") trên bảng giá
-- D16 đã duyệt (skin 600 Q · khung 250 Q · hộp 100 T đốt 100%, rate 70/25/5,
-- pity epic ≤20). KHÔNG một con số kinh tế mới nào được đặt ở đây (A8.2); catalog
-- và giá đọc từ `config/avatar.ts`, migration này chỉ dựng ĐƯỜNG ĐI của hai loại xu.
--
-- ---------------------------------------------------------------------------
-- SỔ Q **KHÔNG** DỰNG Ở ĐÂY — VÀ ĐÓ LÀ CHỦ ĐÍCH
--
-- `quest_ledger` + việc nới trigger `users_quest_points_frozen` thuộc `0016_nhiem_vu`
-- (hệ nhiệm vụ / battle pass) vì bên đó là VÒI PHÁT Q, và bên phát phải là bên định
-- nghĩa sổ: danh mục `reason` chính là chỗ tường lửa T↔Q sống sau khi Q có nguồn.
-- 0016 đã chừa sẵn `reason = 'shop_q'` cho cửa này.
--
-- Nên shop CHỈ tiêu, không bao giờ tạo Q. Kiểm được bằng cấu tạo: `server/shop.ts`
-- chỉ ghi dòng sổ âm, và `kiem_quest_points_khop_so` của 0016 đòi `users.quest_points`
-- luôn khớp dòng cuối của sổ — nên "trừ mà không ghi sổ" hay "ghi sổ mà không trừ"
-- đều nổ ngay lúc COMMIT, không phải bị phát hiện khi audit đêm.
--
-- ⚠ HỆ QUẢ THỨ TỰ: 0015 chạy TRƯỚC 0016, nên migration này không được tham chiếu
-- `quest_ledger`. Nó không tham chiếu. Đường ghi sổ nằm ở tầng app, chạy sau khi
-- toàn bộ migration đã áp.
--
-- ---------------------------------------------------------------------------
-- MỘT MÓN ĐÚNG MỘT CỬA (thi hành ở tầng DB, không phải ở code review)
--
-- Nhãn dán chỉ rơi từ hộp T; khung/nền chỉ bán bằng Q. Nếu một món đứng ở CẢ HAI
-- cửa thì một lượt tiêu T trả ra giá trị TÍNH BẰNG Q — mà Q chạm voucher thật, tức
-- hộp T thành hộp có giá trị thật, đúng cửa chết pháp lý mà luật ngẫu nhiên D16
-- dựng ra để tránh, chỉ đi vòng qua một MÓN thay vì một XU. CHECK ở (3) làm điều đó
-- KHÔNG BIỂU DIỄN ĐƯỢC: món cửa Q bắt buộc CÓ giá, món cửa T bắt buộc KHÔNG giá.
-- ===========================================================================

-- (1) -------------------------------------------------------------------------
-- `wallet_ledger` — thêm lý do `gacha_burn`.
--
-- ⚠ BẪY: 0009 đã thêm 'gacha_burn' vào `burn_ledger` nhưng KHÔNG vào
-- `wallet_ledger`. Một lượt quay phải ghi HAI dòng (ví −100 · đốt +100) để bất
-- biến A của `server/audit.ts` còn cân, nên thiếu lý do bên ví thì lượt quay ĐẦU
-- TIÊN nổ 23514 giữa transaction — sau khi người chơi đã bấm.
ALTER TABLE wallet_ledger DROP CONSTRAINT wallet_ledger_reason_check;
ALTER TABLE wallet_ledger ADD CONSTRAINT wallet_ledger_reason_check
    CHECK (reason IN ('signup_grant', 'bet_place', 'bet_adjust', 'payout',
                      'refund', 'subsidy', 'admin_adjust', 'gacha_burn'));

-- (2) -------------------------------------------------------------------------
-- `gacha_pity` — bộ đếm pity PHẢI SỐNG QUA REQUEST.
--
-- `pull()` là hàm thuần: nhận `pullsSinceEpic` rồi trả bộ đếm mới. Không ai lưu thì
-- mỗi lượt bắt đầu lại từ 0 và mốc bảo hiểm "epic trong 20 lượt" thành một câu
-- quảng cáo không bao giờ chạm tới — mà nó lại là thứ được công bố cho người chơi.
--
-- Một dòng/người, và transaction quay khoá nó bằng `INSERT … ON CONFLICT DO UPDATE`
-- nên hai lượt song song của CÙNG một người không thể cùng đọc một bộ đếm.
CREATE TABLE gacha_pity (
    user_id     UUID PRIMARY KEY REFERENCES users (user_id),
    tu_epic     INTEGER NOT NULL DEFAULT 0 CHECK (tu_epic >= 0),
    tong_luot   INTEGER NOT NULL DEFAULT 0 CHECK (tong_luot >= 0),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (3) -------------------------------------------------------------------------
-- MỘT MÓN ĐÚNG MỘT CỬA — bất biến ở tầng DB.
--
-- `nguon_cua` khai cửa duy nhất của món; CHECK bắt nó khớp với sự có/không của
-- `price_q`. Nên một món "vừa bán 100 Q vừa rơi từ hộp T" không viết ra được bằng
-- một UPDATE nào — kể cả UPDATE của một endpoint admin viết sau này.
ALTER TABLE cosmetic_items ADD COLUMN nguon_cua TEXT
    CHECK (nguon_cua IN ('niem_yet_q', 'gacha_t', 'merit', 'bp', 'quest'));

UPDATE cosmetic_items SET nguon_cua = CASE
    WHEN family = 'danh_phan' THEN 'merit'
    WHEN price_q IS NOT NULL  THEN 'niem_yet_q'
    ELSE 'gacha_t' END
  WHERE nguon_cua IS NULL;

ALTER TABLE cosmetic_items ALTER COLUMN nguon_cua SET NOT NULL;

ALTER TABLE cosmetic_items ADD CONSTRAINT cosmetic_mot_mon_mot_cua CHECK (
    (nguon_cua = 'niem_yet_q' AND price_q IS NOT NULL)
    OR (nguon_cua <> 'niem_yet_q' AND price_q IS NULL)
);

-- (4) -------------------------------------------------------------------------
-- RLS: khoá kín như mọi bảng khác (0006). Client không bao giờ nói chuyện thẳng
-- với Postgres (D17a) — chỉ service role của API chạm được.
ALTER TABLE gacha_pity ENABLE ROW LEVEL SECURITY;
