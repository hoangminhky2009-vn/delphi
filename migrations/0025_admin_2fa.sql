-- 0025 — KHOÁ CỬA ADMIN: TOTP hai lớp + quyền admin có hạn ngắn.
-- Bản yêu cầu 01 §3.1 + §3.2 (founder chốt A·B·A ngày 03/08).

-- ═══════════════════════════════════════════════════════════════════════════
-- (1) BÍ MẬT TOTP — trên TÀI KHOẢN ĐĂNG NHẬP, không trên `users`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Đặt ở `auth_accounts` vì 2FA là chuyện của DANH TÍNH ĐĂNG NHẬP, còn `users`
-- là hồ sơ người chơi. Xoá tài khoản (`DELETE FROM auth_accounts`) là bí mật đi
-- theo; xoá mềm hồ sơ người chơi thì không đụng tới nó.
--
-- ⚠⚠ `totp_secret` LƯU BẢN GỐC, KHÔNG BĂM — và đây là chỗ người quen argon2 đi
-- sai theo quán tính. Nó là BÍ MẬT CHIA SẺ: máy chủ phải tự tính lại được mã để
-- so. Băm xong thì không còn đường xác minh nào cả.
-- Chấp nhận được vì ai đọc được DB thì đã sở hữu toàn bộ hệ thống rồi — cùng
-- lý lẽ đã dùng để chọn đường thoát bằng script thay vì mã khôi phục.

ALTER TABLE auth_accounts
  ADD COLUMN IF NOT EXISTS totp_secret       TEXT,
  ADD COLUMN IF NOT EXISTS totp_confirmed_at TIMESTAMPTZ,
  -- Bước thời gian của mã ĐÃ DÙNG gần nhất. Chống dùng lại (điều kiện bắt buộc
  -- founder đặt): không có cột này thì một mã bị nhìn trộm dùng được cho CẢ
  -- đăng nhập LẪN xác nhận thao tác phá huỷ trong cùng 30 giây — tức lớp thứ
  -- hai thôi là lớp thứ hai.
  ADD COLUMN IF NOT EXISTS totp_buoc_cuoi    BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'auth_accounts_totp_chk'
  ) THEN
    -- Đã xác nhận thì BẮT BUỘC có bí mật. Chặn trạng thái "bật 2FA mà không có
    -- gì để kiểm" — nó sẽ khoá vĩnh viễn chủ tài khoản.
    ALTER TABLE auth_accounts ADD CONSTRAINT auth_accounts_totp_chk
      CHECK (totp_confirmed_at IS NULL OR totp_secret IS NOT NULL);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- (2) DẤU MỐC TRÊN PHIÊN — quyền admin hết hạn sớm hơn phiên
-- ═══════════════════════════════════════════════════════════════════════════
--
-- KHÔNG dựng cookie thứ hai, KHÔNG dựng bảng phiên thứ hai. Admin cũng là NGƯỜI
-- CHƠI: phiên 30 ngày của họ phải sống nguyên để họ còn chơi bình thường. Thứ
-- cần hết hạn sớm là QUYỀN ADMIN, không phải phiên. Hai dấu mốc trên chính hàng
-- phiên diễn tả đúng điều đó và không đẻ thêm trạng thái nào cần đồng bộ.
--
--   `admin_xac_thuc_luc` — lúc qua TOTP để MỞ quyền admin cho phiên này.
--   `xac_thuc_lai_luc`   — lúc qua TOTP LẦN NỮA ngay trước thao tác phá huỷ
--                          (resolve · cancel · chi kho bạc · trao vật phẩm).
--
-- Vì sao mốc thứ hai không thừa: mối đe doạ thật là CÁI LAPTOP ĐĂNG NHẬP SẴN BỊ
-- BỎ QUÊN. Mốc thứ nhất chỉ chứng minh "một giờ trước có người cầm điện thoại";
-- mốc thứ hai đòi chứng minh lại NGAY BÂY GIỜ.

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS admin_xac_thuc_luc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS xac_thuc_lai_luc   TIMESTAMPTZ;
