# Growth stages — when the architecture changes

Which stage the product is at, and which measurable trigger moves it to the next stage of infrastructure. The triggers and thresholds live in `config/bac_thang.ts` and are checked by `tests/bac_thang.test.ts`; this page explains them in words and deliberately repeats no numbers, so it cannot drift from the code.

*The document below is in Vietnamese, the language of the project.*

## Bảy bậc, theo thứ tự leo

### 1. Mùa 0.0 — hiện tại

Kiến trúc y như đang chạy: một function Vercel Hobby + Supabase Singapore free
tier. Cổng hàng chờ đã tồn tại nhưng đang đóng theo đúng mẫu số mùa này (D207) —
mẫu số hôm nay là vài người thật (D64/A11.1), không phải mốc C2 trong `CLAUDE.md`.

Trigger: không có — đây là điểm xuất phát, không phải một cửa cần mở.

### 2. Cổng chặn đồng thời

Bật cổng hàng chờ ở Cloudflare Worker. Cổng chặn ĐỒNG THỜI ở biên, đứng trước
cả Vercel lẫn DB, và có hai cửa fail-open có chủ ý (thiếu secret hoặc thiếu
binding sổ ⇒ cổng tự tắt, không khoá chết app).

Trigger: hằng số `TRAN_TRONG` trong `web/worker/cong.js`.

### 3. Kho lạnh cho events

Cold-archive bảng `events` theo THÁNG: detach partition cũ, chuyển ra kho lưu
trữ ngoài, giữ khôi phục được. Đây là diễn giải của A3.3 cho ca dung lượng —
"append-only" nghĩa là không mất dòng nào, không phải "không bao giờ đụng vào
bảng đang sống" — chứ không phải nới luật. Xoá dòng, hay bỏ/rút gọn
`state_snapshot_json` để né trần, vẫn bị cấm ở bậc này như mọi bậc khác.

Trigger: hằng số `TRAN_KHO_LANH_MB` trong `config/ha_tang.ts`.

### 4. Đóng gói app (native, hoặc vượt trần Discord Activity)

Nền lưu cục bộ của sổ PFM đổi từ IndexedDB sang SQLite, phiên đăng nhập đổi từ
cookie sang Bearer, thêm service worker. Đổi nền lưu trữ chạy song song/di trú
được — không phải cửa một chiều.

Trigger: chờ founder trả lời câu A1. Câu hỏi này mới, chưa có nhà cố định
trong repo — theo dõi ở `docs/nhat-ky/00-muc-luc.md` (entry của đợt A4-3 mang
nguyên văn câu hỏi).

### 5. Có doanh thu

Rời Vercel Hobby (fair-use cấm dùng thương mại), rời gói giám sát uptime free
(ToS cùng điều kiện), và mở van bán một cờ môi trường hiện đang tắt (D148).
Đây là mốc CÙNG LÚC là mốc pháp lý và mốc hạ tầng — hai thứ khoá vào nhau.

Trigger: mục "bốn mốc kích hoạt" ở `docs/luat/05-phap-ly.md` §2 (dòng "có
doanh thu").

### 6. C2 — mốc tải mục tiêu trong `CLAUDE.md`

Đổi tầng hosting: Cloudflare Workers + Hyperdrive (đích đang chọn), hoặc một
process thường trực cùng vùng với DB, thay cho serverless mỗi-request-một-
kết-nối. Đây cũng là lúc sổ sự kiện chạm trần dung lượng gói free của Supabase.
Chuyển hạ tầng tự nó làm được ngược; rủi ro là ghi bị từ chối nếu chạm trần
dung lượng trước khi kịp chuyển.

Trigger: chờ founder trả lời câu A2. Bối cảnh đầy đủ — ba việc phải làm, và
các ngưỡng đo được đã liệt kê nhưng chưa gộp thành một điều kiện bấm-nút duy
nhất — nằm ở `docs/gioi-han-ha-tang.md` §6.

### 7. Đa quốc gia

Múi giờ và tiền tệ đổi từ hằng số toàn cục sang cột theo từng người dùng thật
(hai cột này đã nằm sẵn từ trước — xem bên dưới), thêm chiều quốc gia vào cửa
tổng hợp nhóm, và mở một lượt hỏi pháp lý riêng cho mỗi nước mới.

Trigger: một QUYẾT ĐỊNH, không phải một con số — *ngày founder quyết định mở
nước thứ hai*, ghi ở `docs/yeu-cau-ky-thuat/05b-pfm-kien-truc.md` mục K15. Cố ép
nó thành một hằng số đo được là bịa ra một cái đồng hồ không đo gì cả (đây là
chỗ bản đầu của đợt A4-3 đã vấp — ghi ở D213).

Một chi tiết không phải trigger nhưng đáng nói: hai cột múi giờ/tiền tệ mà
bậc này cần đã được thêm sẵn TRƯỚC KHI cần, đúng để bậc này không phải là cửa
một chiều — lịch sử ngày đã ghi theo múi giờ cũ thì không diễn giải lại được,
nên cột phải có mặt từ hôm nay.

## Vì sao không chép số

Trang này không in một ngưỡng nào — không dung lượng, không phần trăm, không
số người, không số tiền. Mọi con số sống ở ĐÚNG MỘT chỗ: một hằng số trong
`config/`, hoặc một mục trong `docs/luat/`. Trang này chỉ trỏ tới đó.

Lý do là D61: hai bản chép cùng một sự thật thì sớm muộn một bản bị sửa còn
bản kia thì không, và không có gì báo động khi việc đó xảy ra — người đọc chỉ
âm thầm tin nhầm một số đã cũ. `docs/luat/05-phap-ly.md` §2.2 (bản A10 cũ) đã
trả giá đúng kiểu này suốt một tháng. Muốn biết số thật ở bậc nào, mở đúng
file được trỏ tới ở bậc đó.
