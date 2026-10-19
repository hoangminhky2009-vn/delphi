-- ═══════════════════════════════════════════════════════════════════════════
-- 0076 — TRẬN THẬT 14 Ô (D550, khoá v63 `ban14`)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Founder 07/10: *"Làm 14 ô đi"*. CHECK của 0075 chỉ cho 6 · 8 · 12 · 16 (trận) và 0040 chỉ 8 · 12 · 16 (bàn chung).
-- Nới thêm 14 ở cả hai — chỉ NỚI, không dòng cũ nào trái luật mới. Cỡ 14 đi vào DB qua cỡ ghim của luật (`coBanGhim`):
-- cửa tạo trận và cửa phát bàn chung đều hỏi nó.
--
-- ⚠ ĐI CÙNG COMMIT VỚI CODE GHI NÓ (A11.4): mặc định v63 INSERT `so_o = 14`; CHECK cũ từ chối là không trận thật nào mở được.

ALTER TABLE holdem_matches DROP CONSTRAINT IF EXISTS holdem_matches_so_o_check;
ALTER TABLE holdem_matches ADD CONSTRAINT holdem_matches_so_o_check CHECK (so_o IN (6, 8, 12, 14, 16));

ALTER TABLE holdem_ban DROP CONSTRAINT IF EXISTS holdem_ban_so_o_check;
ALTER TABLE holdem_ban ADD CONSTRAINT holdem_ban_so_o_check CHECK (so_o IN (8, 12, 14, 16));
