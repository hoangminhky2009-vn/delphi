-- 0023 — CHỌN CỠ MAP CHỦ ĐỘNG (D31 "người chơi tự chọn phòng 8/12/16 lá",
-- founder ra lệnh xây 02/08).
--
-- `so_o` NULL = trận cũ, replay dùng HOLDEM_DECISIONS.MAP_SIZE như từ trước
-- tới nay — không backfill, không đổi một trận đã lưu nào.
-- CHECK khóa đúng ba cỡ phòng D31 đã chốt; cỡ mới phải qua migration mới,
-- không nới bằng code.

ALTER TABLE holdem_matches
  ADD COLUMN IF NOT EXISTS so_o INT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'holdem_matches_so_o_check'
  ) THEN
    ALTER TABLE holdem_matches
      ADD CONSTRAINT holdem_matches_so_o_check CHECK (so_o IN (8, 12, 16));
  END IF;
END $$;
