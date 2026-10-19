-- 0027 — HẸN GIỜ MỞ KÈO (bước 4, §5 "tạo hàng loạt + hẹn lịch mở").
--
-- Kèo VĨ MÔ là kèo THÁNG (A1), nên dựng cả quý một lần rồi để chúng tự mở đúng
-- ngày là việc đáng làm. `open_ts` đã có sẵn từ 0001 — thiếu đúng một cờ nói
-- "cái này được phép tự mở".
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠⚠ VÌ SAO PHẢI LÀ MỘT CỜ RIÊNG, KHÔNG PHẢI "cứ tới open_ts thì mở"
-- ═══════════════════════════════════════════════════════════════════════════
-- Mở kèo là CHI KHO BẠC (seed × số cửa) và không hoàn tác được. Bước 2 vừa đặt
-- `requireXacThucLai` lên đúng thao tác đó: phải có người cầm điện thoại nhập
-- mã ngay lúc bấm. Nếu scheduler tự mở MỌI draft tới giờ thì cái cổng ấy bị đi
-- vòng — và đi vòng bởi chính hệ thống, tức không ai thấy.
--
-- Nên uỷ quyền được DỜI CHỖ chứ không bị bỏ: bật `tu_mo` là một thao tác nặng,
-- đòi xác thực lại y như mở tay (xem `server/admin_keo.ts`). Người quản trị
-- đang nói "tôi đã duyệt khoản chi này, cho nó chạy lúc X" — một câu có chủ
-- ngữ, có thời điểm, có dấu vết trong `admin_audit`.
--
-- Mặc định FALSE: kèo cũ và kèo tạo bằng đường thường không tự mở. Muốn tự
-- động thì phải nói ra.

ALTER TABLE markets
  ADD COLUMN IF NOT EXISTS tu_mo BOOLEAN NOT NULL DEFAULT false;

-- Scheduler quét mỗi phút: chỉ quan tâm draft đã bật cờ và tới giờ. Index từng
-- phần nên nó nhỏ bằng đúng số kèo đang chờ, không bằng số kèo từng tồn tại.
CREATE INDEX IF NOT EXISTS markets_tu_mo_idx
    ON markets (open_ts) WHERE tu_mo AND status = 'draft';
