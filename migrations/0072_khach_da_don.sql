-- 0072 — SỔ ĐẾM KHÁCH ĐÃ DỌN (D444, 28/09): bù đắp cho `admin_phan_tich.ts` khi
-- `server/auth/don_khach.ts` XOÁ HẲN các tài khoản khách "bỏ hoang" — chưa từng chơi,
-- chưa từng có telemetry, phiên đã chết quá `AUTH.SESSION_TTL_DAYS`, không có đường
-- quay lại (không email/mật khẩu).
--
-- ⚠⚠ QUYẾT ĐỊNH MỚI, KHÔNG PHẢI NỚI TIỀN LỆ 0049. Migration 0049 (dọn beta 31/08)
-- founder từng chốt "chỉ ko xóa tài khoản thôi" — tức XOÁ một tài khoản ĐÃ TỪNG CÓ
-- HOẠT ĐỘNG là điều founder bác. D444 chỉ áp cho một nhóm HẸP HƠN HẲN: khách "Chơi
-- ngay" (`POST /api/v1/auth/khach`) mà sau khi tạo KHÔNG một dấu vết nào (không
-- `events`, không `telemetry`) — tức không ai MẤT gì, vì chưa ai từng CÓ gì để mất.
-- Không nới 0049; đứng CẠNH 0049 với ranh khác hẳn.
--
-- ⚠ VÌ SAO MỘT BẢNG RIÊNG THAY VÌ ĐẾM LẠI TỪ `users`: "xoá tài khoản" (anonymize,
-- migration 0007) GIỮ dòng `users` lại (`deleted_at`) để phân tích vẫn đếm được người
-- đó vào `moi` — ledger/events của họ vẫn neo vào dòng đó. Khách bỏ hoang thì KHÔNG
-- giữ dòng: không có gì neo vào để phải giữ, và giữ một dòng "khách" vô danh mãi mãi
-- chỉ để đếm là đúng thứ kho dữ liệu (C1, 500 MB free tier) không cần trả giá. Xoá
-- hẳn thì `admin_phan_tich.ts` (moi/moi_khach, đếm theo `users.created_at`) ĐẾM THIẾU
-- — sổ này là phần bù, tách khỏi bảng nghiệp vụ nên xoá `users` không kéo mất số.
--
-- ⚠ `ngay` LÀ NGÀY VIỆT NAM CỦA `users.created_at` GỐC (ngày tài khoản được TẠO,
-- KHÔNG PHẢI ngày bị DỌN) — cùng cách chia ngày với `ngayCua()` ở admin_phan_tich.ts
-- (`(cột AT TIME ZONE '<TZ>')::date`, TZ = `TELEMETRY.MUI_GIO` = Asia/Ho_Chi_Minh).
-- Sai chỗ này thì "hôm qua có bao nhiêu tài khoản mới" đổi số MỖI ĐÊM sau khi tick
-- dọn chạy — đúng thứ founder gọi là "dữ liệu phản ánh không chính xác" (15/09).
--
-- Một dòng MỘT NGÀY (PK), cộng dồn qua `so` — KHÔNG một dòng mỗi khách: đây không
-- phải sổ audit (không cần biết TỪNG khách là ai, chỉ cần biết SỐ), và một dòng mỗi
-- khách sẽ phình vô hạn trong khi giá trị đọc ra chỉ là một con số cộng theo ngày.

CREATE TABLE IF NOT EXISTS khach_da_don_ngay (
    ngay DATE PRIMARY KEY,
    so   INTEGER NOT NULL CHECK (so > 0)
);

COMMENT ON TABLE khach_da_don_ngay IS
  'D444: bù đếm cho admin_phan_tich.ts (moi/moi_khach) khi donKhachBoHoang() xoá hẳn '
  'khách bỏ hoang. ngay = ngày VN của users.created_at GỐC (lúc tạo), KHÔNG PHẢI '
  'ngày bị dọn. so = số khách bị dọn có created_at rơi vào đúng ngày đó, cộng dồn.';

-- RLS: bảng mới BẮT BUỘC bật (luật 0006) — chặn PostgREST/anon đọc thẳng qua Supabase.
ALTER TABLE khach_da_don_ngay ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON khach_da_don_ngay FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON khach_da_don_ngay FROM authenticated;
    END IF;
END $$;
