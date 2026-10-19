-- 0029 — DANH TÍNH NGOÀI (Discord) + CHO PHÉP "CHƠI TRƯỚC, KHAI SAU".
--
-- Bản yêu cầu 02 §3 xếp cái này vào CỬA MỘT CHIỀU: mùa mới reset gần hết mọi thứ
-- nhưng KHÔNG reset `events` (append-only tuyệt đối, A3.3). Nên đây là một trong
-- ba chỗ duy nhất của cả kế hoạch Discord đáng cẩn thận kiểu doanh nghiệp (D64).
--
-- ══════════════════════════════════════════════════════════════════════════════
-- PHẦN 1 — BẢNG DANH TÍNH. VÌ SAO LÀ MỘT BẢNG, KHÔNG PHẢI MỘT CỘT.
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Đường dễ nhất là thêm `users.discord_id`. Nó SAI ở hai tầng cùng lúc:
--
--  · A8.9 — một cột mang tên nhà cung cấp là khoá nhà cung cấp ngay trong schema
--    nghiệp vụ. Thêm nhà cung cấp thứ hai là thêm cột thứ hai, rồi mọi truy vấn
--    "tìm người theo danh tính" phải biết trước có bao nhiêu cột.
--
--  · ⚠⚠ NGUY HIỂM HƠN NHIỀU: cột không có ràng buộc nào ngăn việc TẠO MỘT HÀNG
--    `users` THỨ HAI cho cùng một người. Một người vào bằng email hôm nay, bằng
--    Discord ngày mai — nếu thành hai hàng thì Brier, rank, phễu và mọi phép đo
--    R&D CHIA ĐÔI, và `events` append-only nên KHÔNG GỘP LẠI ĐƯỢC, kể cả khi
--    phát hiện ngay hôm sau, kể cả sang mùa mới.
--    `UNIQUE (provider, provider_user_id)` dưới đây là hàng rào duy nhất chặn
--    chuyện đó, và nó phải có TRƯỚC người dùng Discord đầu tiên.
--
-- Neo vào `auth_accounts` chứ không vào `users`: `users` chỉ ra đời khi onboarding
-- xong (bậc 2), còn danh tính có từ giây đầu. Neo nhầm chỗ là lại phải tạo `users`
-- sớm — đúng thứ "chơi trước, khai sau" muốn tránh.

CREATE TABLE IF NOT EXISTS auth_identities (
    identity_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id       UUID NOT NULL REFERENCES auth_accounts (account_id) ON DELETE CASCADE,
    -- Chuỗi tự do có CHECK thay vì ENUM: thêm nhà cung cấp sau này là một dòng
    -- migration sửa CHECK, không phải một cuộc di trú kiểu dữ liệu.
    provider         TEXT NOT NULL CHECK (provider IN ('discord')),
    provider_user_id TEXT NOT NULL CHECK (length(provider_user_id) BETWEEN 1 AND 64),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS auth_identities_account_idx ON auth_identities (account_id);

COMMENT ON TABLE auth_identities IS
  'Danh tính ngoài (Discord…). MỘT DÒNG mỗi nhà cung cấp mỗi tài khoản. '
  'UNIQUE(provider, provider_user_id) là hàng rào chặn việc một người thành hai '
  'hàng users — điều KHÔNG sửa lại được vì events append-only (A3.3).';

-- ══════════════════════════════════════════════════════════════════════════════
-- PHẦN 2 — TÀI KHOẢN KHÔNG CÓ EMAIL/MẬT KHẨU
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Người vào từ Discord không có email và không đặt mật khẩu. Hai cột này sinh ra
-- khi email là đường vào DUY NHẤT (D17).
--
-- ⚠ CHECK cũ của `email` vẫn giữ nguyên và vẫn đúng: trong SQL, CHECK cho kết quả
-- UNKNOWN trên NULL nên nó KHÔNG chặn NULL — chỉ chặn email sai định dạng. Và
-- UNIQUE cho phép nhiều NULL. Nên nới NOT NULL là đủ, không phải sửa CHECK.

ALTER TABLE auth_accounts ALTER COLUMN email DROP NOT NULL;
ALTER TABLE auth_accounts ALTER COLUMN password_hash DROP NOT NULL;

-- ⚠ KHÔNG CÓ CHECK "phải có ít nhất một đường vào" — và đây là lựa chọn có ý thức,
-- không phải bỏ sót. Ràng buộc đó bắc qua HAI BẢNG nên CHECK không diễn đạt được;
-- diễn đạt bằng trigger thì đắt và dễ khoá chính mình lúc tạo tài khoản (dòng
-- `auth_accounts` phải có trước dòng `auth_identities`). Thi hành ở tầng code, và
-- ghi ra đây để người sau biết đó là chỗ code phải giữ lời chứ không phải DB.

-- ══════════════════════════════════════════════════════════════════════════════
-- PHẦN 3 — "CHƠI TRƯỚC, KHAI SAU" (founder chốt phương án B, D64)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Trong Discord người ta đang ở giữa một cuộc gọi và bấm thử một cái nút. Mọi câu
-- hỏi đứng TRƯỚC trò chơi là một cái cửa để quay ra — mà 66/90 lượt bỏ trận trên
-- prod đã nằm trong PHÚT ĐẦU.
--
-- Ba cột này đang NOT NULL từ migration 0001, nên hôm nay muốn ngồi vào bàn thì
-- BẮT BUỘC khai đủ. Mà hai trong ba (`region`, `occupation_band`) KHÔNG phục vụ
-- một dòng gameplay nào — chúng thuần là dữ liệu R&D. Không có lý do gì đứng ở cửa.

ALTER TABLE users ALTER COLUMN age_band DROP NOT NULL;
ALTER TABLE users ALTER COLUMN region DROP NOT NULL;
ALTER TABLE users ALTER COLUMN occupation_band DROP NOT NULL;

-- ⚠⚠ NỚI Ở TẦNG DB KHÔNG PHẢI LÀ NỚI Ở TẦNG NGHIỆP VỤ — ĐỌC KỸ TRƯỚC KHI DÙNG.
--
--  1. **C8 (age gate 16+) KHÔNG bị nới.** `age_band` NULL nghĩa là "CHƯA HỎI",
--     KHÔNG phải "được miễn". Luồng web vẫn phải hỏi năm sinh trước khi tạo
--     `users` (endpoint onboarding), và cửa Discord phải hỏi ở bậc 1. DB thôi ép
--     chỉ vì bậc 0 cần tồn tại trước lúc hỏi — chỗ ép chuyển sang code.
--
--  2. **Mọi truy vấn cắt theo nhân khẩu nay có thêm nhóm NULL.** `server/
--     admin_thongke.ts` và `server/telemetry_cuon.ts` đọc ba cột này. Nhóm NULL
--     phải hiện ra là "CHƯA KHAI" trên dashboard — gộp nó vào "khac" là nói dối,
--     vì "khác" là một câu trả lời còn NULL là chưa có câu trả lời.
--
--  3. **Tỷ lệ NULL chính là phép đo của bậc 1.** Nó cho biết đổi chác được gì:
--     có thêm người vốn sẽ bỏ ở cửa, đổi lấy dữ liệu nhân khẩu mỏng đi.
--     Không đo thì không biết mình đổi được gì.

COMMENT ON COLUMN users.age_band IS
  'NULL = CHƯA HỎI (bậc 0 của cửa Discord), KHÔNG phải được miễn age gate. '
  'C8 vẫn hiệu lực và được thi hành ở tầng code.';

-- ══════════════════════════════════════════════════════════════════════════════
-- PHẦN 4 — RLS
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Luật của 0006: "bảng mới trong tương lai PHẢI kèm ENABLE ROW LEVEL SECURITY
-- trong chính migration tạo nó." Không policy nào ⇒ anon/authenticated bị từ chối
-- toàn bộ; kết nối app (owner) bypass như thường.
--
-- ⚠ BẢN ĐẦU CỦA MIGRATION NÀY QUÊN DÒNG DƯỚI, và `tests/schema_constraints.test.ts`
-- bắt được. Đáng ghi lại vì hậu quả không nhỏ: Supabase phơi PostgREST ra ngoài,
-- nên một bảng public không RLS là một bảng ĐỌC ĐƯỢC TỪ INTERNET — mà đây lại là
-- bảng nối tài khoản DELPHI với tài khoản Discord ngoài đời.

ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY;
