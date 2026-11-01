import { daCai } from './cai_app';

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
 * consent PFM (`lib/pfm_chu.ts` — founder duyệt 12/10, D603). Bài canh `web/tests/pfm_khoa_web.test.tsx` đỏ nếu cờ bật mà kho còn tên chung.
 */
export const PFM_WEB_MO = false;

/**
 * ⭐ CỔNG PFM (SPEC `cai-app-pfm-trong-ban-cai` mục 4–5, D603 đợt 2 — founder 12/10: *BẮT BUỘC cài mới vào PFM*): khu Tài chính MỞ khi
 * app đang chạy BẢN CÀI (`daCai()` — đọc `display-mode`, không đoán UA); tab trình duyệt thường giữ khoá như chan-truoc-beta
 * (`PFM_WEB_MO` ở trên vẫn là chính sách của TAB, vẫn `false`). Điều kiện bật lại của chan-truoc-beta §3 đã đủ: kho theo tài khoản
 * (`kho_idb.ts` `tenKho`, đợt 1) · bài hai tài khoản (`pfm_kho_tai_khoan.test.tsx`) · founder duyệt bốn văn bản consent 12/10.
 *
 * ⚠ HÀM, KHÔNG HẰNG: mọi chỗ hỏi lúc DỰNG (route qua `CongPfm`, Hub, Cài đặt) — một hằng tính lúc nạp module sẽ đóng băng câu trả lời
 * của lần nạp đầu, và bài test không đổi được nó. Không dựng khu ⇒ không `KhoProvider` ⇒ driver nền PFM (đồng bộ · két) không chạy.
 * Tiêm ngược (`npm run tiem`): đảo điều kiện ⇒ `cai_app_cong.test.tsx` đỏ.
 */
export function pfmMo(): boolean {
  return PFM_WEB_MO || daCai();
}
