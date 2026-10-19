-- 0069 — BUỔI ĐO TỰ PHỤC VỤ: MỘT MÃ, NĂM BƯỚC (D370, founder 21/09).
--
-- Founder: *"À ko có người điều phối mà. Nhưng mà chúng tôi chỉ đóng vai trò helper và nhận kết quả thôi."*
-- — và trước đó: *"tester cũng rải rác nên là t cần chi tiết từng người vì ko thể nào 20 người cùng lúc được"*.
--
-- ⚠⚠ ĐIỀU NÀY ĐỔI AI CANH THỨ TỰ. Bộ ba phiếu (D367) đứng được là nhờ mấy CỬA MỘT CHIỀU: đoán chi tiêu
-- TRƯỚC khi mở app · nhớ lại trận TRƯỚC khi xem thẻ. Trong một phòng học, thứ canh chúng là GIỌNG người
-- điều phối. Không có phòng, không có giọng ⇒ **app phải là thứ canh**, nếu không mấy cửa ấy chỉ còn là
-- lời dặn trong một tài liệu không ai đọc lúc đang chơi.
-- ⇒ Hai cột dưới đây là bộ nhớ của người canh ấy: người này là ai (mã) và đang đứng ở đâu (bước).
--
-- ⚠⚠ VÌ SAO MỘT MÃ MỚI, KHÔNG DÙNG `maThamGia(match_id)` (holdem_api.ts:699). Mã ấy sinh từ match_id nên
-- **chỉ tồn tại sau khi đã có một trận**. Nhưng phiếu ĐẦU TIÊN điền lúc chưa ai chơi gì — đúng chỗ cần khoá
-- nhất thì mã kia chưa ra đời. Bản trước vá bằng mẩu giấy "SỐ GHẾ" phát ở cửa; không còn ai đứng cửa để phát.
-- ⇒ Cấp mã ngay lúc bấm ĐỒNG Ý VÀ VÀO, giữ nguyên cả đợt, dùng cho cả ba phiếu. MỘT khoá thay cho hai.
--
-- ⚠ MÃ KHÔNG PHẢI DANH TÍNH. Bốn ký tự từ bảng chữ đã bỏ 0/o/1/l/i (giống `maThamGia`), không sinh từ tên
-- hay email, không tra ngược ra người. Nó chỉ nối *phiếu Google Form* với *dòng dữ liệu app* — đúng vai mà
-- `ma_tham_gia` đang làm, chỉ là ra đời sớm hơn một nhịp. Không cột danh tính nào rời server (C7).
--
-- ⚠ UNIQUE TOÀN CỤC, không chỉ trong một bàn. Người nhập số đọc mã từ bảng tính Form, mà bảng tính KHÔNG
-- biết bàn nào — nên hai bàn trùng mã là hai dòng không phân biệt nổi. 31^4 ≈ 923k tổ hợp, 60 người/bàn
-- nên đụng độ hiếm; hiếm không phải là không, nên có index UNIQUE và server thử lại khi đụng.
--
-- ⚠ RÚT ĐỒNG Ý KHÔNG XOÁ MÃ — cùng lý do `thu_chi_tiet_nhan` không bị xoá ở 0068: `server/dot_thu.ts` đã
-- lọc theo vết đồng ý MỚI NHẤT, nên người đã rút không lọt vào bảng dù cột còn giá trị. Xoá mã thì người
-- đồng ý lại sau đó nhận mã khác, và mọi phiếu họ đã nộp thành mồ côi.

ALTER TABLE users ADD COLUMN IF NOT EXISTS ma_buoi_do    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS buoi_do_buoc  SMALLINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.ma_buoi_do IS
  'Mã buổi đo 4 ký tự (bảng chữ abcdefghjkmnpqrstuvwxyz23456789 — đã bỏ 0/o/1/l/i cho dễ chép). '
  'Cấp lúc bấm ĐỒNG Ý VÀ VÀO ở bàn buổi đo, giữ nguyên cả đợt, điền sẵn vào cả ba Google Form. '
  'Thay CẢ "số ghế" lẫn ma_tham_gia(match_id) — mã kia chỉ có sau trận, mà phiếu 1 điền trước trận. '
  'KHÔNG phải danh tính: không sinh từ tên/email, không tra ngược. Xem 0069.';

COMMENT ON COLUMN users.buoi_do_buoc IS
  'Tester đang đứng ở bước nào của lộ trình tự phục vụ: 0 chưa đồng ý · 1 đã nộp PHIẾU 1 · 2 đã chơi '
  'xong Alpha Draft · 3 đã nộp PHIẾU 2 · 4 đã xong PFM · 5 đã nộp PHIẾU 3 (xong). '
  'KHÔNG có người điều phối nên đây là thứ canh cửa một chiều: chưa 1 thì không vào trận được, '
  'chưa 3 thì không xem được thẻ. CHỈ TIẾN, không lùi (server không hạ số này). Xem 0069.';

-- Khoá ghép của cả đợt: người nhập số tra theo mã, nên nó phải unique và tra nhanh.
-- Index BỘ PHẬN vì tuyệt đại đa số tài khoản không thuộc đợt đo nào — index đầy đủ chỉ tốn chỗ cho NULL.
CREATE UNIQUE INDEX IF NOT EXISTS users_ma_buoi_do_idx ON users (ma_buoi_do)
    WHERE ma_buoi_do IS NOT NULL;
