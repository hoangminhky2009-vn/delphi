-- 0065 — THỜI GIAN QUYẾT ĐỊNH MỖI VÒNG (D327, 13/09).
--
-- ⚠⚠ VÌ SAO CỘT NÀY CẦN MỘT TRƯỜNG MỚI Ở `events`, KHÔNG CHỈ Ở ĐÂY: `holdem_matches.vong_mo_luc`
-- chỉ giữ mốc mở của VÒNG HIỆN TẠI và bị ghi đè ở mỗi cú chốt. Nên từ trước D327, không một
-- nguồn nào biết một vòng ĐÃ QUA mở lúc nào — thời gian quyết định mất vĩnh viễn. D327 ghi
-- `mo_luc` vào `hd_chot_phien.value_json` (phép cộng, không action_type mới); cột này là phần
-- PHÁI SINH: `ms_quyet = ts(hd_cam_ket) − mo_luc`, dựng lại được từ `events` bất cứ lúc nào.
-- Đường học (`docs/yeu-cau-ky-thuat/10-buoi-do-va-thang-nang-luc.md` §3.7) cần nó: "đã thạo"
-- là lúc trung vị thời gian quyết định thôi giảm.
--
-- ⚠⚠ NULL ≠ 0 (A11.2), cùng lớp lỗi 0063/0064:
--   · NULL = KHÔNG ĐO ĐƯỢC — trận ghi trước D327 (không có `mo_luc`), vòng `tu_dong` (hết giờ:
--     "không kịp bấm" không phải một thời gian quyết định), hiệu âm, hoặc vượt trần INT.
--   · số   = mili-giây thật từ mở vòng tới nộp, cả hai đầu là `now()` của Postgres.
-- Suy 0 cho vế đầu là bịa ra hàng loạt "quyết định tức thì" từ những vòng không ai đo.
--
-- Bảng phái sinh ⇒ không backfill ở đây: `HANH_VI_FORMULA_VERSION` 3 làm mọi trận "cần dựng"
-- ở lần đọc sau (`kho.ts` §tranCanDung), và trận cũ dựng lại ra NULL — đúng nghĩa.

ALTER TABLE hanh_vi_vong
  ADD COLUMN IF NOT EXISTS ms_quyet INT;

COMMENT ON COLUMN hanh_vi_vong.ms_quyet IS
  'Mili-giây từ lúc vòng mở (hd_chot_phien.value_json.mo_luc) tới lúc nộp (ts của hd_cam_ket). NULL = không đo được: trận trước D327, vòng tu_dong, hiệu âm hoặc vượt INT — KHÁC HẲN một thời gian quyết định bằng 0.';
