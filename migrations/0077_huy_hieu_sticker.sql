-- 0077 — STICKER VINH DANH HẠNG, THEO MÙA (SPEC docs/spec/huy-hieu-hang-sticker.md, founder 11/10)
--
-- Lên bậc Đấu trường ⇒ nhận sticker vinh danh của bậc đó (ĐỒNG Tôm · BẠC Cua · VÀNG Cá Ngựa · BẠCH KIM Cá Đuối ·
-- KIM CƯƠNG Cá Mập · ELITE Cá Voi vàng đội vương miện; SẮT không có). Hai thứ DB phải giữ:
--   (1) sáu hàng catalog — `kho_sticker.sticker_id` và `avatar_dan.sticker_id` là KHOÁ NGOẠI vào `cosmetic_items`,
--       thiếu hàng thì cấp sticker nổ 23503 giữa transaction kết trận;
--   (2) sổ `huy_hieu_cap` — chốt IDEMPOTENT: mỗi (người, mùa, bậc) nhận ĐÚNG MỘT lần.
--
-- ⚠ SÁU MÓN LÀ MERIT, KHÔNG MUA ĐƯỢC (design_sticker_shop Q7/Q8; D16 Họ 2 "Danh phận"):
--     family 'danh_phan' + nguon_cua 'merit' + price_q NULL — CHECK `cosmetic_mot_mon_mot_cua` (0015) và
--     `cosmetic_danh_phan_not_purchasable` (0009) đã khoá: không UPDATE nào đặt được giá Q cho chúng.
--     Cửa gacha lọc `nguon === 'gacha_t'` (server/sandbox/ung_vien.ts) nên chúng không bao giờ vào hộp.
--
-- ⚠ "THEO MÙA" NẰM Ở SỔ, KHÔNG Ở MÃ MÓN. `season_id` của hạng là `currentSeasonId()` (2026Q4, 2027Q1…) — sinh theo
--     ĐỒNG HỒ, không khai trước ở đâu cả. Nếu mã món chứa mùa (`st_hh_2026q4_tom`) thì mỗi quý phải thêm sáu hàng
--     catalog + sáu mục trong chuỗi diện mạo (chỉ số NHAN_DAN là mã 2 ký tự), và đến 01/01 mà quên thì người chơi
--     lên bậc nhận LỖI thay vì sticker. Nên: sáu món cố định, mùa nằm ở `huy_hieu_cap` — mùa mới leo lại ⇒ hàng sổ
--     mới ⇒ thêm MỘT bản của cùng món vào kho. Bộ mùa cũ đã nhận ở lại vĩnh viễn (kho_sticker không trừ lùi).
--
-- ⚠ KHÔNG PHÁT BÙ (founder 11/10: "đã làm đ** có ai mà lo"): migration này KHÔNG INSERT hàng nào vào
--     `huy_hieu_cap`/`kho_sticker` cho người đã ở bậc cao; chỉ lần LÊN bậc sau đó mới cấp.
--
-- ⚠ KHÔNG THÊM `action_type` MỚI: lần lên bậc đã có `rank_len_bac` trong `events` (server/rank.ts), còn việc nhận
--     sticker ghi ở chính `huy_hieu_cap.cap_luc`. Cần event riêng "nhận sticker vinh danh" ⇒ A7, hỏi founder.

INSERT INTO cosmetic_items
    (cosmetic_id, family, kind, label, rarity, price_q, phien_ban, gioi_han, nguon_cua)
VALUES
    ('st_hh_tom',     'danh_phan', 'sticker', 'Tôm · hạng Đồng',            'thuong', NULL, NULL, NULL, 'merit'),
    ('st_hh_cua',     'danh_phan', 'sticker', 'Cua · hạng Bạc',             'thuong', NULL, NULL, NULL, 'merit'),
    ('st_hh_ca_ngua', 'danh_phan', 'sticker', 'Cá Ngựa · hạng Vàng',        'hiem',   NULL, NULL, NULL, 'merit'),
    ('st_hh_ca_duoi', 'danh_phan', 'sticker', 'Cá Đuối · hạng Bạch Kim',    'hiem',   NULL, NULL, NULL, 'merit'),
    ('st_hh_ca_map',  'danh_phan', 'sticker', 'Cá Mập · hạng Kim Cương',    'epic',   NULL, NULL, NULL, 'merit'),
    ('st_hh_ca_voi',  'danh_phan', 'sticker', 'Cá Voi · hạng Elite',        'epic',   NULL, NULL, NULL, 'merit')
ON CONFLICT (cosmetic_id) DO NOTHING;

CREATE TABLE huy_hieu_cap (
    user_id    UUID NOT NULL REFERENCES users (user_id),
    -- Mùa của HẠNG (rank_diem.season_id) — không phải mùa lộ trình `beta-0.0`.
    season_id  TEXT NOT NULL,
    -- Bậc vừa đạt. Khớp BAC_THANG[].id có sticker (config/rank.ts); SẮT (tap_su) không có hàng.
    bac_id     TEXT NOT NULL CHECK (bac_id IN
        ('chuyen_vien', 'nha_giao_dich', 'quan_ly_danh_muc', 'giam_doc_dau_tu', 'chu_quy', 'tao_song')),
    sticker_id TEXT NOT NULL REFERENCES cosmetic_items (cosmetic_id),
    cap_luc    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- ĐÂY là chốt idempotent: lên lại bậc cũ trong cùng mùa không thêm được hàng thứ hai.
    PRIMARY KEY (user_id, season_id, bac_id)
);

-- RLS khoá kín như mọi bảng (0006): chỉ service role của API chạm được.
ALTER TABLE huy_hieu_cap ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON huy_hieu_cap FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON huy_hieu_cap FROM authenticated;
    END IF;
END $$;
