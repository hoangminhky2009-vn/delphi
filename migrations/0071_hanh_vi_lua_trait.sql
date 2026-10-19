-- 0071 — SÁU CỘT ĐO LỬA · XU · TRAIT · THÔNG TIN RIÊNG · CƠ CHẾ CẮT LỖ (v55, D409).
--
-- Bảng `hanh_vi_vong` là PHÁI SINH (0043): dựng lại 100% từ `events` bằng
-- `scripts/hanh_vi_dung_lai.ts`. Cột thêm ở đây đi CÙNG COMMIT với `HANH_VI_FORMULA_VERSION`
-- 3 → 4 (server/hanh_vi/trai.ts) — bump ⇒ mọi trận tự thành "cần dựng" ở lần đọc sau.
--
-- ⚠⚠ NULL ≠ 0 (A11.2 / D62 / D67 — cùng chữ với 0063):
--   · `lua_nac` / `lua_dap` / `xu` / `trait_json`: NULL = trận chạy luật CHƯA có lửa/trait (trước v55).
--     `lua_nac = 0` là QUAN SÁT: có lửa mà đang tàn.
--   · `nguon_tin_rieng`: NULL = vòng này KHÔNG có thông tin riêng (khác với chưa đo — cột này suy được ở
--     mọi trận từ `mo_bang` + trait, nên không có ca "chưa đo"). 'bang' = mở Bảng điện tử · 'trait' = NỘI GIÁN
--     hoặc cặp vai THÍNH TIN (`ghim_luot_song`) CÓ HIỆU LỰC TRONG vòng (đọc `hd_chot_phien.trait_vong`, không đọc
--     danh sách SAU vòng — lá lấy ở vòng mốc chỉ tính từ vòng kế). Thước Brier / năng lực ĐỌC TIN phải TÁCH những vòng này —
--     không thì lợi thế thông tin bị chấm thành kỹ năng đọc (kiến trúc 25/09 §5).
--   · `co_che_cat_lo`: NULL = luật trận không có cửa cắt lỗ bằng trait (trước v55); true/false = có cửa,
--     KỶ LUẬT có / không có hiệu lực TRONG vòng. Chỉ số #4 (kỷ luật cắt lỗ) đọc cột này trước khi đọc hành vi.
--   · `lua_dap`: lý do dập TRONG vòng — 'doi_bias' · 'doi_tay' · 'mua_duoi_muon' — hoặc NULL (không dập).
--     'mua_duoi_muon' là nhãn của một CAN THIỆP lên đúng trục #2 FOMO: phân tích FOMO cắt theo nhãn này.

ALTER TABLE hanh_vi_vong
  ADD COLUMN IF NOT EXISTS lua_nac         SMALLINT,
  ADD COLUMN IF NOT EXISTS lua_dap         TEXT CHECK (lua_dap IN ('doi_bias', 'doi_tay', 'mua_duoi_muon')),
  ADD COLUMN IF NOT EXISTS xu              INT,
  ADD COLUMN IF NOT EXISTS trait_json      JSONB,
  ADD COLUMN IF NOT EXISTS nguon_tin_rieng TEXT CHECK (nguon_tin_rieng IN ('bang', 'trait')),
  ADD COLUMN IF NOT EXISTS co_che_cat_lo   BOOLEAN;

COMMENT ON COLUMN hanh_vi_vong.lua_nac IS
  'Nấc ngọn lửa đà SAU khi chốt vòng (0..3). NULL = trận chạy luật chưa có lửa (trước v55).';
COMMENT ON COLUMN hanh_vi_vong.lua_dap IS
  'Lý do lửa bị dập trong vòng: doi_bias · doi_tay · mua_duoi_muon; NULL = không dập (hoặc luật chưa có lửa — xem lua_nac).';
COMMENT ON COLUMN hanh_vi_vong.xu IS
  'Xu đang có SAU vòng (chỉ để cuộn chợ trait; không phải tiền). NULL = luật chưa có xu.';
COMMENT ON COLUMN hanh_vi_vong.trait_json IS
  'Danh sách id trait đang mang SAU vòng (cặp vai đứng đầu). NULL = luật chưa có trait.';
COMMENT ON COLUMN hanh_vi_vong.nguon_tin_rieng IS
  'Vòng có thông tin riêng: bang (mở Bảng điện tử) · trait (NỘI GIÁN / cặp vai THÍNH TIN CÓ HIỆU LỰC TRONG vòng — lá vừa lấy ở vòng mốc chỉ tính từ vòng kế). NULL = không có. Thước đọc tin phải tách.';
COMMENT ON COLUMN hanh_vi_vong.co_che_cat_lo IS
  'Có cửa cắt lỗ bằng trait không: true = KỶ LUẬT có hiệu lực TRONG vòng · false = có cửa mà vòng này không có nó · NULL = luật trận không có cửa (trước v55).';

-- Câu hỏi đắt: "mọi vòng ai đó bị dập lửa vì đuổi giá muộn" — index partial, phần lớn dòng NULL.
CREATE INDEX IF NOT EXISTS hanh_vi_vong_lua_dap_idx
  ON hanh_vi_vong (user_id, ts)
  WHERE lua_dap IS NOT NULL;
