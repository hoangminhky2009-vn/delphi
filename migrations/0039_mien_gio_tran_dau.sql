-- ═══════════════════════════════════════════════════════════════════════════
-- `holdem_matches.mien_gio` — MIỄN GIỜ HAI TRẬN ĐẦU (founder 16/08, tầng 2)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Cờ CHỐT LÚC TẠO TRẬN: người chơi có ít hơn `MIEN_GIO_DEN_TRAN_XONG` trận đã
-- xong (dòng holdem_results — D62/D86, bỏ dở không đếm) và không phải xếp hạng
-- ⇒ cả trận không chạy đồng hồ. Xem HOLDEM_DECISIONS trong config/holdem.ts.
--
-- Vì sao là CỘT trên dòng trận chứ không tính lại mỗi request: số trận xong
-- TĂNG theo thời gian, mà "trận này có giờ hay không" phải là một sự thật cố
-- định của trận — nếu tính lại thì người đang chơi trận thứ 2 (không giờ) mà
-- kết trận thứ 1 song song ở tab khác sẽ thấy đồng hồ BẬT LÊN giữa chừng và
-- vòng đang mở bị chốt hộ. Cùng lớp lỗi D53 dựng `manTapMienGio` để tránh
-- (màn hiện "tạm dừng" mà server chốt hộ).
--
-- `DEFAULT false`: mọi trận đã tồn tại đều đã chạy giờ — không viết lại
-- lịch sử; và mọi cửa nộp vòng cũ đọc cột này ra false thì hành vi y như trước.
ALTER TABLE holdem_matches
  ADD COLUMN IF NOT EXISTS mien_gio BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN holdem_matches.mien_gio IS
  'Trận không chạy đồng hồ (2 trận đầu của người chơi, không áp cho xếp hạng). '
  'Chốt lúc tạo — config/holdem.ts HOLDEM_DECISIONS.MIEN_GIO_DEN_TRAN_XONG.';
