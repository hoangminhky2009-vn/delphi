-- 0041 — BÀN NGÀY / THỬ THÁCH HÔM NAY (17/08; D85 §5.2 founder chốt, D95 cần
-- "một seed/ngày" làm nền cho kèo T).
--
-- Dùng lại `holdem_ban` (0040 đã khai sẵn loai 'ngay'): một dòng mỗi ngày VN,
-- server tự phát khi có người hỏi đầu tiên (find-or-create), không có chủ.
-- Trận vào bàn ngày đi ĐÚNG đường POST /matches {ban_ma} như bàn đội — UNIQUE
-- (ban_ma, owner) của 0040 ⇒ mỗi tài khoản MỘT lượt mỗi ngày, ở tầng DB.

-- Bàn ngày không có chủ ⇒ nới NOT NULL, nhưng khoá lại bằng CHECK theo loại:
-- bàn đội PHẢI có chủ và KHÔNG có ngày; bàn ngày PHẢI có ngày.
ALTER TABLE holdem_ban ALTER COLUMN chu_user_id DROP NOT NULL;
ALTER TABLE holdem_ban ADD COLUMN ngay DATE NULL;
ALTER TABLE holdem_ban ADD CONSTRAINT holdem_ban_loai_chk CHECK (
    (loai = 'doi'  AND chu_user_id IS NOT NULL AND ngay IS NULL)
 OR (loai = 'ngay' AND ngay IS NOT NULL)
);
-- Một ngày MỘT bàn — hai request cùng lúc sáng sớm chỉ một cái tạo được,
-- cái kia đọc lại (ON CONFLICT (ngay) WHERE loai = 'ngay' DO NOTHING).
CREATE UNIQUE INDEX holdem_ban_ngay_uq ON holdem_ban (ngay) WHERE loai = 'ngay';

COMMENT ON COLUMN holdem_ban.ngay IS
  'Ngày (Asia/Ho_Chi_Minh) của bàn ngày; NULL với bàn đội. het_han của bàn ngày = 0:00 VN kế tiếp.';
