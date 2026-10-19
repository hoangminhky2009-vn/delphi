-- ═══════════════════════════════════════════════════════════════════════════
-- 0075 — BÀN TẬP 6 Ô (D527, nhịp xen kẽ khoá v58)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Founder 05/10: bàn tập *"6 ô"*, nhịp *"T-M-T-M-M"* (`NHIP_XEN_KE[6]`). CHECK của 0023 chỉ cho 8 · 12 · 16.
-- Nới thêm 6 — chỉ NỚI, không dòng cũ nào trái luật mới. Cỡ 6 chỉ đi vào DB qua bàn tập (`soOManTap`);
-- trận tự do vẫn kẹp trong `CO_MAP_CHON` ở tầng API.
--
-- ⚠ ĐI CÙNG COMMIT VỚI CODE GHI NÓ (A11.4): cửa tạo trận INSERT `so_o = 6` cho bàn tập; CHECK cũ từ chối
-- là bàn tập không bao giờ mở được.

ALTER TABLE holdem_matches DROP CONSTRAINT IF EXISTS holdem_matches_so_o_check;
ALTER TABLE holdem_matches ADD CONSTRAINT holdem_matches_so_o_check CHECK (so_o IN (6, 8, 12, 16));
