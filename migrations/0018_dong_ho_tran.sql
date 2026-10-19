-- ---------------------------------------------------------------------------
-- 0018 — ĐỒNG HỒ TRẬN (D38, founder 27/07)
--
-- Founder: "khi vào ván bài mà thoát ra ngoài không chơi nữa dù có cả ngày quay
-- trở lại vẫn là ván bài đó (trong chế độ đấu bot), điều này làm giảm khả năng
-- lưu trữ và tối ưu."
--
-- HAI THỨ HỎNG, KHÁC NHAU:
--   1. Không có hạn nào cho một vòng hay một trận (xem `DONG_HO` trong
--      config/holdem.ts — trước 27/07 repo KHÔNG có một hằng số thời gian nào).
--   2. `holdem_matches.status` cho phép 'bo_dở' NHƯNG KHÔNG DÒNG CODE NÀO GHI GIÁ
--      TRỊ ĐÓ. Nên trận rời dở nằm mãi ở 'dang_choi'. Đây là bẫy số 1 của repo
--      (nhánh tồn tại mà không có đường chạy) ở dạng schema — lần thứ 9.
--
-- Migration này chỉ dựng CHỖ ĐỂ ĐO THỜI GIAN. Luật cắt trận nằm ở tầng TS, vì nó
-- cần đọc `DONG_HO` và phải test được (A8.3) — không nhét vào trigger.
-- ---------------------------------------------------------------------------

-- MỐC MỞ VÒNG HIỆN TẠI — nguồn chân lý duy nhất của mọi phép tính thời gian.
--
-- Vì sao mốc theo VÒNG chứ không theo TRẬN: hạn tính từ `started_at` sẽ cắt giữa
-- trận một người đánh chậm mà đánh LIÊN TỤC — phạt sai người. Mốc theo vòng thì
-- ai còn đánh là mốc còn tiến, ai rời đi thì mốc đứng yên và hạn tự tới.
--
-- Vì sao SERVER giữ mốc chứ không client: C4 — client không bao giờ tự tính. Nếu
-- đồng hồ do client giữ thì đổi giờ máy là được thêm thời gian.
ALTER TABLE holdem_matches
    ADD COLUMN IF NOT EXISTS vong_mo_luc TIMESTAMPTZ;

-- Trận đang mở từ trước migration: coi như vòng vừa mở lúc chạy migration, để
-- chúng có một mốc hợp lệ thay vì NULL. Trận đã 'xong' thì không cần mốc.
UPDATE holdem_matches
   SET vong_mo_luc = COALESCE(vong_mo_luc, now())
 WHERE status = 'dang_choi';

-- Lý do một trận bị đóng — phân biệt "đánh xong" với "hết hạn" với "tự bỏ".
--
-- Vì sao KHÔNG nhét vào `status`: `status` trả lời "còn tiếp được không", còn cột
-- này trả lời "vì sao dừng". Gộp lại thì mỗi lý do mới là một giá trị enum mới và
-- mọi câu truy vấn `status = 'dang_choi'` phải sửa theo. Tách ra thì thêm lý do
-- không đụng gì tới các truy vấn nóng.
--
-- NULL = chưa đóng, hoặc đóng theo đường bình thường (đánh hết map / cháy).
ALTER TABLE holdem_matches
    ADD COLUMN IF NOT EXISTS ly_do_dong TEXT
        CHECK (ly_do_dong IS NULL OR ly_do_dong IN ('het_han', 'nguoi_choi_bo'));

-- Index cho ĐÚNG truy vấn dọn dẹp: "trận nào đang mở mà mốc vòng đã quá cũ".
-- Partial index vì tập 'dang_choi' luôn nhỏ so với toàn bảng — càng về sau càng
-- nhỏ tương đối, nên đây là index rẻ và không phình theo lịch sử.
CREATE INDEX IF NOT EXISTS idx_holdem_matches_qua_han
    ON holdem_matches (vong_mo_luc)
    WHERE status = 'dang_choi';

COMMENT ON COLUMN holdem_matches.vong_mo_luc IS
    'Mốc mở vòng hiện tại (UTC). Hạn vòng = mốc này + DONG_HO.giayChonBai(). '
    'Hạn TRẬN đếm từ đây, không từ started_at — xem đầu file 0018.';
COMMENT ON COLUMN holdem_matches.ly_do_dong IS
    'Vì sao trận dừng. NULL = đánh hết bình thường. het_han = quá DONG_HO.HAN_TRAN_PHUT.';
