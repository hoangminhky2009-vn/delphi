-- ═══════════════════════════════════════════════════════════════════════════
-- 0073 — MÀN MINIGAME + NHẬT KÝ CÚ BẤM (D466, bước 3.3–3.4 kế hoạch minigame)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠⚠ CỬA MỘT CHIỀU (A11.1, kế hoạch §5): giá của màn = f(bối cảnh, cú bấm THEO SỐ NHỊP,
-- phiên bản dòng giá). Định dạng hai thứ dưới đây phải đúng ngay lần đầu — chỉ được
-- THÊM trường, không đổi nghĩa trường cũ.
--
-- ⚠⚠ ĐI CÙNG COMMIT VỚI CODE GHI NÓ (A11.4): INSERT `mg_lenh` nằm trong transaction
-- của cú bấm — CHECK từ chối thì cú bấm thất bại (ca 0037 · 0062).
--
-- 1. `holdem_minigame_man` — MỘT dòng mỗi (trận, vòng). Ghi lúc mở màn:
--    · `boi_canh` = đầu vào ĐÃ TÍNH của dòng giá (mã · vốn · seed · lá · kịch bản · dải
--      căng · xác suất quét · hình). Ghi kết quả chứ không ghi "cách tính": đổi hàm
--      chọn hình về sau không đổi màn đã chơi.
--    · `phien_ban` = `MINIGAME_DONG_GIA_VERSION` (config/minigame.ts) — trục `luu_db`.
--    · `bat_dau` = mốc đầu đếm ngược. Giờ chỉ dùng để đổi ra số nhịp ở tầng API.
--    · `lenh` = cú bấm, NỐI THÊM theo thứ tự nhận. Đây là nguồn replay (nếp
--      `holdem_matches.action_log`); bản cho phân tích hành vi ghi song song ở
--      `events` (`mg_lenh`), y như vòng đấu ghi `action_log` + `hd_cam_ket`.
--      Ghi CÚ BẤM (nút + nhịp đang thấy), không ghi số tiền đã khớp: tiền là thứ
--      lõi tính lại từ cú bấm (bước 4) — ghi số đã tính là đóng băng một luật chưa có.
--
-- 2. Trigger: không đổi `boi_canh`/`bat_dau`/`phien_ban`, và `lenh` mới phải bắt đầu
--    bằng đúng `lenh` cũ (chỉ nối, không sửa, không xoá cú nào). DELETE cả dòng vẫn được
--    — xoá trận (dọn beta, `scripts/don_data_beta.ts`) kéo theo màn; `events` thì không
--    bao giờ mất (A3.3).

CREATE TABLE holdem_minigame_man (
    match_id   UUID NOT NULL REFERENCES holdem_matches (match_id) ON DELETE CASCADE,
    vong       INT NOT NULL CHECK (vong >= 2),
    phien_ban  TEXT NOT NULL,
    boi_canh   JSONB NOT NULL,
    bat_dau    TIMESTAMPTZ NOT NULL,
    lenh       JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(lenh) = 'array'),
    tao_luc    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, vong)
);

-- Khoá PostgREST như mọi bảng public (0006): chỉ server (vai owner) đọc/ghi.
ALTER TABLE holdem_minigame_man ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION holdem_minigame_man_chi_noi() RETURNS trigger AS $$
DECLARE
    n INT := jsonb_array_length(OLD.lenh);
BEGIN
    IF NEW.boi_canh IS DISTINCT FROM OLD.boi_canh
       OR NEW.bat_dau IS DISTINCT FROM OLD.bat_dau
       OR NEW.phien_ban IS DISTINCT FROM OLD.phien_ban
       OR NEW.match_id IS DISTINCT FROM OLD.match_id
       OR NEW.vong IS DISTINCT FROM OLD.vong THEN
        RAISE EXCEPTION 'holdem_minigame_man: bối cảnh màn đã ghi thì không đổi (D466, cửa một chiều)';
    END IF;
    IF jsonb_array_length(NEW.lenh) < n
       OR COALESCE((SELECT jsonb_agg(e ORDER BY i)
                      FROM jsonb_array_elements(NEW.lenh) WITH ORDINALITY AS x(e, i)
                     WHERE i <= n), '[]'::jsonb) IS DISTINCT FROM OLD.lenh THEN
        RAISE EXCEPTION 'holdem_minigame_man: nhật ký cú bấm chỉ được NỐI THÊM (D466, cửa một chiều)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER holdem_minigame_man_chi_noi
    BEFORE UPDATE ON holdem_minigame_man
    FOR EACH ROW EXECUTE FUNCTION holdem_minigame_man_chi_noi();

-- `mg_lenh` — nới CHECK theo lối CỘNG DỒN (bài học 0019; nếp 0070).
-- VÌ SAO `events` (A9): cú bấm trong màn là lệnh có TIỀN đi kèm (lõi khớp nó thành lãi lỗ).
DO $$
DECLARE
    dinh_nghia TEXT;
    moi        TEXT;
BEGIN
    SELECT pg_get_constraintdef(oid) INTO dinh_nghia
      FROM pg_constraint
     WHERE conname = 'events_action_type_check'
       AND conrelid = 'events'::regclass;

    IF dinh_nghia IS NULL THEN
        RAISE EXCEPTION 'không thấy events_action_type_check — schema lệch dự đoán';
    END IF;

    IF dinh_nghia LIKE '%mg_lenh%' THEN
        RETURN;
    END IF;

    moi := replace(dinh_nghia, '::text]', '::text, ''mg_lenh''::text]');

    IF moi NOT LIKE '%mg_lenh%' THEN
        RAISE EXCEPTION
            'không chèn được loại event mới vào (%) — hãy nới bằng tay', dinh_nghia;
    END IF;

    EXECUTE 'ALTER TABLE events DROP CONSTRAINT events_action_type_check';
    EXECUTE format(
        'ALTER TABLE events ADD CONSTRAINT events_action_type_check %s', moi);
END $$;
