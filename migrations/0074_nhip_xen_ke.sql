-- ═══════════════════════════════════════════════════════════════════════════
-- 0074 — NHỊP XEN KẼ: màn minigame có ở VÒNG 1 (D526, khoá v58)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Founder 05/10 trên demo nhịp trận: *"Vòng 1 cũng có mini game nhưng kết hợp cái đầu"*. Khung v57
-- chỉ mở màn từ vòng 2 nên 0073 khoá `vong >= 2`; nhịp xen kẽ (cờ `nhipXenKe`, lịch `NHIP_XEN_KE`) mở
-- màn ngay sau khi chốt vòng 1. Nới CHECK xuống `vong >= 1` — chỉ NỚI, không dòng cũ nào trái luật mới.
--
-- ⚠ ĐI CÙNG COMMIT VỚI CODE GHI NÓ (A11.4): cửa mở màn (`POST /matches/:id/minigame`) INSERT dòng
-- vòng 1 trong transaction; CHECK cũ từ chối là màn vòng 1 không bao giờ mở được.

ALTER TABLE holdem_minigame_man DROP CONSTRAINT IF EXISTS holdem_minigame_man_vong_check;
ALTER TABLE holdem_minigame_man ADD CONSTRAINT holdem_minigame_man_vong_check CHECK (vong >= 1);
