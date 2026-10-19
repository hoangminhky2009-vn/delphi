-- ═══════════════════════════════════════════════════════════════════════════
-- BẬC 1 — HỎI NHÂN KHẨU SAU TRẬN ĐẦU (D64 phương án B; founder chốt 04/08)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- D64 chốt: bậc 0 KHÔNG hỏi gì, ngồi vào bàn chơi ngay; năm sinh + miền + nghề
-- hỏi ở bậc 1, SAU trận đầu, và BỎ QUA ĐƯỢC. Từ đó tới nay bậc 1 tồn tại đúng
-- một dòng chú thích trong `server/discord.ts` — nên thực tế là: người vào từ
-- Discord hoặc từ cửa KHÁCH KHÔNG BAO GIỜ được hỏi, và mọi trận họ chơi nằm
-- dưới một tài khoản không có nhân khẩu.
--
-- ⚠ VÌ SAO PHẢI LÀ MỘT CỘT, KHÔNG PHẢI `localStorage`:
-- "đã hỏi rồi" là trạng thái của MỘT NGƯỜI, không phải của một trình duyệt. Cất
-- ở máy người chơi thì đổi máy là hỏi lại, xoá cache là hỏi lại — và trong
-- Activity Discord thì iframe chết theo mỗi lượt mở, tức hỏi lại MỖI LẦN. Một
-- màn hỏi tuổi bật lên mỗi lần mở app là cách nhanh nhất để người ta bỏ đi.
--
-- ⚠ VÀ NÓ KHÔNG SUY RA ĐƯỢC TỪ `age_band IS NULL`: bỏ qua cũng để lại NULL. Gộp
-- hai thứ là biến "đã hỏi, họ không muốn trả lời" thành "chưa hỏi bao giờ", tức
-- hỏi lại vĩnh viễn đúng những người đã từ chối.
--
-- ⚠ ĐÂY LÀ MỘT CỘT ĐO ĐƯỢC, không chỉ một cái cờ: `count(*) FILTER (WHERE
-- nhan_khau_hoi_luc IS NOT NULL AND age_band IS NULL)` = số người ĐÃ HỎI MÀ BỎ
-- QUA. Không có cột này thì "bao nhiêu người từ chối khai" là câu không hỏi được.

ALTER TABLE users ADD COLUMN IF NOT EXISTS nhan_khau_hoi_luc TIMESTAMPTZ;

COMMENT ON COLUMN users.nhan_khau_hoi_luc IS
  'Lúc ĐÃ HỎI nhân khẩu ở bậc 1 (D64) — bất kể họ trả lời hay bỏ qua. NULL = '
  'chưa hỏi bao giờ. Cùng với age_band nó phân biệt ba trạng thái: chưa hỏi · '
  'đã hỏi và khai · đã hỏi và bỏ qua.';

-- ══════════════════════════════════════════════════════════════════════════════
-- ⚠ HAI THỨ CỐ Ý KHÔNG LÀM Ở ĐÂY
-- ══════════════════════════════════════════════════════════════════════════════
--
-- 1. KHÔNG backfill cho 6 tài khoản đã có `age_band` (đường đăng ký email). Họ
--    khai ở lúc đăng ký chứ không ở bậc 1, nên `nhan_khau_hoi_luc` của họ ĐÚNG
--    là NULL — "chưa từng hỏi ở bậc 1". Nhét một mốc giả vào là bịa ra một lần
--    hỏi chưa từng xảy ra, và bảng đếm "bao nhiêu người bỏ qua" sẽ sai ngay từ
--    dòng đầu. Điều kiện hiện màn đã có `age_band IS NULL` nên họ không bị hỏi.
--
-- 2. KHÔNG có CHECK "đã hỏi thì phải có age_band". Bỏ qua là một câu trả lời
--    hợp lệ — đó là toàn bộ điểm của phương án B.

CREATE INDEX IF NOT EXISTS users_chua_hoi_nhan_khau_idx
  ON users (user_id) WHERE age_band IS NULL AND nhan_khau_hoi_luc IS NULL;
