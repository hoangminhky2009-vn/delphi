-- 0052 — ĐÁNH DẤU TÀI KHOẢN THỬ NGHIỆM (`users.la_tester`).
--
-- Founder 03/09/2026: *"từ trước đến nay toàn là t tự chơi cả. Làm sạch để tránh
-- làm bẩn dữ liệu từ người thật sắp tới đây"* + *"cấp toàn quyền cho tài khoản
-- admin để làm tester… như kiểu cheat luôn ấy"*.
--
-- ⚠⚠ VÌ SAO PHẢI LÀ BÂY GIỜ, KHÔNG PHẢI SAU — ĐÂY LÀ CỬA MỘT CHIỀU DUY NHẤT CỦA
-- CẢ ĐỢT DỌN. Đo prod 03/09: 26 tài khoản, trong đó **24 mang `role='user'`**.
-- Về mặt schema chúng KHÔNG KHÁC GÌ tài khoản người thật. Chừng nào chưa có người
-- lạ thì còn phân biệt được ("tất cả đều là founder"); từ tài khoản thật ĐẦU TIÊN
-- trở đi thì KHÔNG AI trên đời phân biệt nổi nữa — không cột nào, không dấu vết
-- nào. Xoá dữ liệu chơi KHÔNG giải quyết chuyện này: xoá xong vẫn còn 26 tài khoản
-- vô danh nằm lẫn với người thật.
-- ⇒ Bước này chạy TRƯỚC mọi bước xoá, và trước khi mời người đầu tiên.
--
-- ─── MỘT CỜ, HAI HỆ QUẢ (cố ý gộp, không tách hai cột) ───────────────────────
--  1. **Ra khỏi mọi bảng phân tích sản phẩm.** Đây là vế "làm sạch": lứa người
--     thật sắp tới không bị trộn với hàng trăm trận founder ngồi test. Khác
--     `config/giai_doan.ts` (lọc theo CHẤT LƯỢNG SO SÁNH ĐƯỢC — bộ luật còn dựng
--     lại được không) và khác `server/rieng_tu.ts` (lọc theo QUYỀN + sàn cỡ ô):
--     ba lớp, ba vai, chạy độc lập. Đừng gộp chúng.
--  2. **Điều kiện CẦN để bật cheat** (xem dưới).
--
-- ─── VÌ SAO CHEAT ĐÒI CẢ `role='admin'` LẪN `la_tester` ─────────────────────
-- Từ D208 repo có ô uỷ quyền admin bấm-một-nút. Nếu cheat chỉ gác bằng `role`
-- thì mỗi lần trao quyền quản trị cho một người là **trao luôn máy in tiền** —
-- người được trao có thể tự nạp token, và `admin_adjust` là đường mint HỢP LỆ
-- nên `audit:supply` sẽ báo CÂN, không một hàng rào nào kêu. Đòi thêm `la_tester`
-- (cột này mặc định FALSE và chỉ bật bằng SQL tay, KHÔNG có route nào bật được)
-- tách hai quyền ra: quản trị là chuyện vận hành, cheat là chuyện thử nghiệm.
--
-- ⚠ KHÔNG có endpoint nào được phép GHI cột này. Bật thêm một tài khoản tester =
-- một câu UPDATE tay, có chủ ý, hiếm. Có route bật là có đường leo thang quyền.

ALTER TABLE users ADD COLUMN IF NOT EXISTS la_tester BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN users.la_tester IS
  'Tài khoản THỬ NGHIỆM của founder: (1) ra khỏi mọi bảng phân tích sản phẩm; '
  '(2) điều kiện CẦN để bật cheat (phải kèm role=admin). Mặc định false — tài '
  'khoản người thật KHÔNG BAO GIỜ mang cờ này. Không route nào ghi được cột này. '
  'Xem migrations/0052_tai_khoan_thu_nghiem.sql.';

-- ─── ĐÁNH DẤU TRẬN "BỊ CHEAT" — độc lập với chủ sở hữu (TESTER MODE) ─────────
--
-- Founder 03/09/2026: "cấp toàn quyền cho tài khoản admin để làm tester nhé.
-- Như kiểu cheat luôn ấy". Quyền lực CHEAT lúc TẠO TRẬN (seed/so_o/
-- balance_version/số ghế/vai/thẻ khởi điểm ép tay) sinh ra dữ liệu KHÔNG đại
-- diện cho hành vi thật — đúng thứ `config/giai_doan.ts` gọi là "một thí
-- nghiệm khác hẳn trò người chơi đã chơi", chỉ khác là do TAY người ép, không
-- phải do phiên bản luật biến mất khỏi code.
--
-- ⚠ VÌ SAO MỘT CỘT TRÊN `holdem_matches`, KHÔNG PHẢI GỘP VÀO `che_do`:
-- `che_do` là trục CHẾ ĐỘ CHƠI (tu_do/rank_slot/rank_bu/phong_rieng/rank_pve) —
-- dùng khắp code để quyết luật nghiệp vụ (rank có tính điểm không, subsidy có
-- áp không…). "Bị cheat" là một trục KHÁC HẲN, trực giao với chế độ chơi: một
-- trận tu_do bình thường và một trận tu_do bị ép seed đều là 'tu_do' về LUẬT
-- CHƠI, chỉ khác về ĐỘ TIN CẬY của dữ liệu sinh ra. Nhét chung sẽ phải nhân đôi
-- số giá trị enum (`tu_do_cheat`, `rank_pve_cheat`…) và viết lại MỌI chỗ đang so
-- `che_do = 'tu_do'` trong repo — đổi nhiều, lợi ít, đúng thứ A8.9 gọi là
-- "không tối ưu sớm nhưng không chặn đường scale" đi ngược lại.
--
-- ⚠ VÌ SAO ĐÁNH DẤU TRÊN DÒNG, KHÔNG CHỈ SUY TỪ `owner_user_id` → `users.la_tester`:
-- cờ tester là thuộc tính của TÀI KHOẢN, có thể đổi sau (founder gỡ tư cách
-- tester một ngày nào đó — dù hiếm). Nếu chỉ suy qua chủ sở hữu thì một trận đã
-- ghi bằng seed ép tay sẽ ĐỔI Ý NGHĨA khi tài khoản đổi cờ, và `holdem_matches`
-- + `events` của nó là append-only — không viết lại lịch sử được (A3.3). Đánh
-- dấu ngay lúc tạo là chốt SỰ THẬT của khoảnh khắc đó vĩnh viễn, độc lập với ai
-- đang sở hữu tài khoản sau này — đúng đòi hỏi "loại trừ ĐỘC LẬP với chủ sở hữu"
-- của tác vụ Tester Mode.
ALTER TABLE holdem_matches ADD COLUMN IF NOT EXISTS co_ep_tham_so BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN holdem_matches.co_ep_tham_so IS
  'TRUE khi trận này được TẠO với ít nhất một tham số ép tay của tester '
  '(ep_seed/ep_balance/ep_chien_thuat/ep_so_ghe/ep_vai/ep_mien_gio, hoặc mở '
  'khoá so_o/khau_vi trước hạn). Ghi CÙNG câu INSERT tạo trận (A11.4), không '
  'bao giờ UPDATE sau đó — cùng luật "chốt lúc tạo" của seed/balance_version. '
  'Dùng để loại trận này khỏi phân tích sản phẩm ĐỘC LẬP với việc chủ tài '
  'khoản có còn là tester hay không (xem 0052, server/holdem_api.ts).';

-- ─── BACKFILL: MỌI TÀI KHOẢN ĐANG CÓ ĐỀU LÀ CỦA FOUNDER ──────────────────────
-- Founder xác nhận 03/09/2026: *"từ trước đến nay toàn là t tự chơi cả"*. Đo được
-- kèm theo: 26 tài khoản, 86 trận, 1.293 event, tất cả mùa `2026Q3`.
--
-- ⚠ CÂU NÀY CHỈ ĐÚNG MỘT LẦN, ĐÚNG LÚC NÀY. Chạy lại nó sau khi có người thật
-- đăng ký sẽ dán nhãn tester lên chính những người mình cần đo — nên nó kẹp
-- `created_at` theo mốc chạy migration, không phải `WHERE true`.
UPDATE users
   SET la_tester = true
 WHERE created_at < now()
   AND la_tester = false;

-- Kiểm tay sau khi chạy (kỳ vọng 03/09/2026: 26 / 26):
--   SELECT count(*) FILTER (WHERE la_tester) AS tester, count(*) AS tong FROM users;
