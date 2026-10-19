/**
 * KHÓA PFM TRÊN WEB (SPEC chan-truoc-beta mục 6 — founder 11/10: *"PFM để sau khi chuyển từ web thành app"*, trọng tâm là gameloop +
 * giáo dục/giữ chân).
 *
 * `false` ⇒ ô Tài chính ở Hub xám ổ khoá ("Admin cần donate để mua database 😓", KHÔNG có nút nhận tiền) · mọi `/tai-chinh/*` về Hub ·
 * khối sổ ở Cài đặt không dựng ⇒ không `KhoProvider` nào mở ⇒ driver nền PFM (đồng bộ · két) không chạy. Dữ liệu cũ KHÔNG xoá; nút
 * XOÁ SẠCH SỔ vẫn với tới được ở Hồ sơ → Dữ liệu của tôi (điều khoản đã hứa).
 *
 * ⚠ ĐIỀU KIỆN KÍCH HOẠT LẠI (A11.15): trước commit nào lật cờ này sang `true` phải làm xong việc đã hoãn ở SPEC mục 3 — tách kho PFM
 * theo tài khoản (`delphi_pfm_<user_id>`, kho chung cũ BỎ không chuyển) + bài hai tài khoản trên một trình duyệt + duyệt bốn văn bản
 * consent PFM (`lib/pfm_chu.ts` "CHỜ FOUNDER DUYỆT"). Bài canh `web/tests/pfm_khoa_web.test.tsx` đỏ nếu cờ bật mà kho còn tên chung.
 */
export const PFM_WEB_MO = false;
