-- 0022 — MỞ KHOÁ XẾP HẠNG MÙA BETA: chế độ rank_pve (founder 28/07).
--
-- Founder: "chế độ rank đã làm rồi thì mở khóa luôn". Hạ tầng điểm PvP
-- (rank_ledger zero-sum) đã xây nhưng LỚP GHÉP NGƯỜI THẬT chưa — mở hôm nay
-- nghĩa là rank đấu MÁY. D16 đã chốt sẵn thang cho đúng việc này: "điểm mùa
-- PvE không âm". Đây là LẬT D31.4 ("rank toàn người thật") CHO MÙA BETA theo
-- lệnh founder — D31.1 vốn đã cho phép mùa Beta cân bằng tạm, số liệu lưu
-- riêng một mùa.
--
-- Điểm PvE KHÔNG đi qua rank_ledger (sổ đó zero-sum theo bàn, thiêng, PvP-only)
-- mà đi ĐÚNG khuôn sổ đối ứng có sẵn: "mọi dịch chuyển điểm KHÔNG PHẢI từ một
-- bàn phải có đối ứng ở rank_quy_diem" (0017). Quỹ chi ra → delta âm, reason
-- 'chi_pve'. Bất biến kiểm toán Σ điểm + quỹ = 0 GIỮ NGUYÊN, kiemToanLamPhat
-- không đổi một dòng.

-- (1) che_do nhận 'rank_pve'. Constraint inline tự đặt tên → phải dò tên
-- (đúng bẫy đã gặp ở 0021 với [A-C]).
DO $$
DECLARE ten TEXT;
BEGIN
    SELECT conname INTO ten
      FROM pg_constraint
     WHERE conrelid = 'holdem_matches'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%che_do%';
    IF ten IS NOT NULL THEN
        EXECUTE format('ALTER TABLE holdem_matches DROP CONSTRAINT %I', ten);
    END IF;
    ALTER TABLE holdem_matches ADD CONSTRAINT holdem_matches_che_do_chk
        CHECK (che_do IN ('tu_do', 'rank_slot', 'rank_bu', 'phong_rieng', 'rank_pve'));
END $$;

-- (2) Quỹ điểm nhận reason 'chi_pve'.
DO $$
DECLARE ten TEXT;
BEGIN
    SELECT conname INTO ten
      FROM pg_constraint
     WHERE conrelid = 'rank_quy_diem'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%reason%';
    IF ten IS NOT NULL THEN
        EXECUTE format('ALTER TABLE rank_quy_diem DROP CONSTRAINT %I', ten);
    END IF;
    ALTER TABLE rank_quy_diem ADD CONSTRAINT rank_quy_diem_reason_chk
        CHECK (reason IN ('nen_dau_mua', 'du_lam_tron', 'hao_khong_hoat_dong',
                          'admin_sua', 'chi_pve'));
END $$;
