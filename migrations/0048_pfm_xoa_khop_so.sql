-- 0048 — CỬA THOÁT CỦA TRIGGER KHỚP-SỔ CHO ĐƯỜNG XOÁ PFM (D188).
--
-- ⚠⚠ VÌ SAO CÓ MIGRATION NÀY: 0047 dựng hai chốt đúng, nhưng chúng CẮN NHAU ở đúng
-- một đường — và bài test viết trước code đã bắt được ngay lượt chạy đầu:
--
--     error: pfm_token đổi mà không có dòng pfm_token_ledger nào (A3.10)
--
-- Chuyện xảy ra khi `xoaSachPfm` chạy: nó xoá sạch `pfm_token_ledger` (được phép — cờ
-- `delphi.xoa_pfm`), rồi trả `users.pfm_token` về 0. Trigger khớp-sổ là DEFERRED nên
-- nó kiểm lúc COMMIT: lúc đó ví ĐÃ đổi mà sổ thì ĐÃ trống ⇒ nó gào đúng theo thiết kế.
--
-- Hai luật 🔒 đứng hai bên:
--   · A3.10 — mọi thay đổi số dư phải suy được từ sổ cái. Đây là thứ giữ cho "ví" luôn
--     là kết quả của một chuỗi bút toán, không phải một con số ai đó gõ vào.
--   · P9 🔒  — user yêu cầu xoá thì dữ liệu PFM phải sạch. Đây là nghĩa vụ pháp lý.
--
-- Quyền xoá THẮNG quy ước kế toán nội bộ (nghĩa vụ với người dùng đứng trên tiện lợi
-- kiểm toán của chúng ta), nhưng phải thắng TƯỜNG MINH: dùng ĐÚNG cái cờ mà 0047 đã
-- dựng cho `pfm_token_ledger`, không phải một cửa sau thứ hai. Một cờ, một chỗ đặt
-- (`server/pfm/xoa.ts`), grep ra được, có test canh cả chuyện cờ là cục bộ transaction.
--
-- ⚠ KHÔNG NỚI GÌ KHÁC. Ngoài đường xoá, trigger vẫn gào y như cũ: đổi ví mà không có
-- sổ ⇒ chặn; ví lệch dòng cuối ⇒ chặn. Bài test `pfm_nen` §II vẫn canh cả hai.

CREATE OR REPLACE FUNCTION kiem_pfm_token_khop_so() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    cuoi     BIGINT;
    hien_tai BIGINT;
BEGIN
    -- CỬA THOÁT DUY NHẤT: transaction đang thực thi quyền xoá của user (P9 🔒).
    -- Cùng cờ với `pfm_token_ledger_chan()` ở 0047 — một cơ chế, không phải hai.
    IF current_setting('delphi.xoa_pfm', true) = '1' THEN
        RETURN NEW;
    END IF;

    SELECT balance_after INTO cuoi
      FROM pfm_token_ledger
     WHERE user_id = NEW.user_id
     ORDER BY entry_id DESC
     LIMIT 1;

    -- ⚠ ĐỌC LẠI TỪ BẢNG, KHÔNG DÙNG `NEW` (bài học của khuôn gốc 0016): trigger
    -- DEFERRED chạy lúc COMMIT nhưng `NEW` là ảnh chụp lúc UPDATE, nên một transaction
    -- đổi token hai lần sẽ xếp hai lần kiểm và lần đầu mang giá trị cũ ⇒ báo lệch sai.
    SELECT pfm_token INTO hien_tai FROM users WHERE user_id = NEW.user_id;

    IF cuoi IS NULL THEN
        RAISE EXCEPTION
            'pfm_token đổi mà không có dòng pfm_token_ledger nào (A3.10)'
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF cuoi IS DISTINCT FROM hien_tai THEN
        RAISE EXCEPTION
            'pfm_token (%) lệch dòng cuối pfm_token_ledger (%) — ví phải là số dư suy từ sổ',
            hien_tai, cuoi
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$;
