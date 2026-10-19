-- 0056 — `pfm_lo_da_nhan`: KHOÁ CHỐNG TRÙNG CẤP MÓN CHO `POST /pfm/dong-bo` (R8, D251).
--
-- ⚠⚠ VÌ SAO PHẢI CÓ, VÀ VÌ SAO PHẢI CÓ NGAY BÂY GIỜ:
--
-- Đường `/pfm/dong-bo` là đường DUY NHẤT nhịp PFM đi vào `events` — một bảng
-- **append-only tuyệt đối** (A3.3, không dẻo). Và hàng đợi client cố ý chỉ bỏ món
-- **sau khi server xác nhận** (`xacNhanGui`), vì bỏ lúc gửi là đánh cược rằng mạng
-- không bao giờ đứt giữa chừng.
--
-- Ghép hai điều đó lại ra một lỗ có thật: server COMMIT xong, phản hồi mất trên
-- đường về ⇒ client không bỏ món ⇒ lần sau nó gửi lại **đúng những món ấy** ⇒
-- `events` có hai dòng cho một sự kiện. Không có cột nào phân biệt được bản sao với
-- một hành động lặp lại thật (hai lần `pfm_hu {hu_id, ma:'sua_ten'}` trong một buổi
-- là chuyện bình thường), và **không xoá được** để sửa. Đây không phải rủi ro hiếm:
-- mạng di động đứt giữa request là chuyện thường ngày của đúng nhóm 16–30 này.
--
-- ⇒ Không được ghi nợ. A11.1 nói thẳng "mùa sau làm lại" KHÔNG áp dụng cho cửa một
-- chiều, và `events` là ví dụ đầu tiên nó liệt kê.
--
-- ─── VÌ SAO MỘT BẢNG RỜI, KHÔNG PHẢI RÀNG BUỘC TRÊN `events` ─────────────────
-- Thêm UNIQUE lên `events` là (a) động dao vào bảng một chiều đang có dữ liệu prod
-- của mọi hệ thống khác, (b) đòi nhét id chống trùng vào `value_json`, mà K5 🔒 đã
-- hứa ô đó CHỈ chở id + enum nghiệp vụ — một id kỹ thuật lẫn vào đó là chính cái
-- "chữ tự do lọt vào" mà K5 dựng ra để chặn. Bảng rời thì `events` không biết gì và
-- không phải đổi gì.
--
-- ─── KHOÁ LÀ ID CỦA CHÍNH MÓN, DO CLIENT ĐẶT ────────────────────────────────
-- Hàng đợi client đã có sẵn khoá ổn định cho mỗi món (`khoaMon` → `nhip:<id>`), và
-- nó KHÔNG đổi qua các lần gửi lại. Dùng lại chính nó là chống trùng **cấp món**,
-- không phải cấp lô — đúng ngữ nghĩa của một route nhận lô hỗn hợp, nơi lô sau có
-- thể chỉ còn lại vài món của lô trước.
--
-- ⚠ Client đặt khoá nên khoá KHÔNG đáng tin về nội dung: một client hỏng gửi trùng
-- id cho hai món khác nhau thì món thứ hai bị bỏ. Đó là hỏng phía client và nó chỉ
-- hại chính user đó — đổi lại ta chặn được ca hỏng phía HỆ THỐNG (nhân đôi vĩnh
-- viễn trong bảng chung). Đánh đổi đúng chiều.
--
-- ─── DỌN ────────────────────────────────────────────────────────────────────
-- Bảng này là bộ nhớ ngắn hạn, không phải dữ liệu. Dọn cơ hội theo user ngay trong
-- chính transaction ghi lô (`PFM_LO.NHO_MON_NGAY`) — không cần cron, không cần job,
-- và chi phí bị chặn theo số user đang hoạt động chứ không theo tuổi hệ thống.

CREATE TABLE IF NOT EXISTS pfm_lo_da_nhan (
    user_id  UUID NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
    -- Khoá do client đặt; trần 64 để một client hỏng không bơm chuỗi dài vào đây.
    mon_id   TEXT NOT NULL CHECK (length(mon_id) BETWEEN 1 AND 64),
    nhan_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, mon_id)
);

-- Dọn theo tuổi, trong phạm vi MỘT user (câu DELETE luôn có `user_id = $1`).
CREATE INDEX IF NOT EXISTS pfm_lo_da_nhan_don_dep
    ON pfm_lo_da_nhan (user_id, nhan_luc);

-- RLS bật cho MỌI bảng pfm_* — bộ canh 'mọi bảng PFM có RLS bật' quét theo tiền tố
-- tên, nên một bảng mới quên dòng này là đỏ ngay, không lọt.
ALTER TABLE pfm_lo_da_nhan ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE pfm_lo_da_nhan IS
    'Chống trùng cấp món cho POST /pfm/dong-bo — bộ nhớ ngắn hạn, dọn theo PFM_LO.NHO_MON_NGAY (D251).';
