# Part 3 — Behavioural data collection: events, telemetry, scoring data

Part of the [specification by part](00-ban-do.md). Corrected together with the code whenever the two disagree.

*The document below is in Vietnamese, the language of the project.*

## A. VAI TRÒ & HIỆN TRẠNG

**Data là sản phẩm thật của DELPHI (A1)** — app chỉ là công cụ tạo dữ liệu
hành vi. ⚠ Mô tả ra ngoài PHẢI dùng câu mùa 0.0 (D63): *"dữ liệu chỉ phục
vụ R&D, không bán, không chia cho ai"* — câu "sản phẩm thật" là giá trị dài
hạn, không phải việc đang làm.

Hiện trạng: đường ống events + telemetry chạy prod từ D61; mặt hành trình
đọc từ nguồn bền (`holdem_matches` + `auth_accounts`) thay vì telemetry
(D62); `hd_brier_vong` ghi mỗi vòng trong tx nộp (migration 0035 — blocker
"tính rồi vứt" ĐÃ TAN, kiểm 15/08); thiết kế hai-bộ-data cho kỳ ngộ đã chốt
(map 8 đối chứng thuần · map 12/16 có kích thích CÓ NHÃN — D85).

## B. KIẾN TRÚC & DÒNG CHẢY

**Hai bảng, hai vai, không trộn (A9 — quyết định MỘT CHIỀU):**

| | `events` | `telemetry` |
|---|---|---|
| chứa | hành vi KINH TẾ (có tiền/niềm tin) | vận hành giao diện (thời gian màn, phễu, lỗi) |
| luật | append-only vĩnh viễn (trigger DB) | xoá được, hạn 90 ngày, cuộn tổng hợp ngày |

Phép thử một câu: *"dòng này có tiền hoặc niềm tin trong đó không?"* Có ⇒
events. Phân vân ⇒ telemetry (sai kiểu AN TOÀN — nâng cấp sang events từ hôm
sau được; chiều ngược thì vĩnh viễn).

**Đường ghi events:** CÙNG transaction với hành động nghiệp vụ (A7, không
fire-and-forget). `action_type` là ENUM ở DB ⇒ loại mới cần migration CÙNG
COMMIT (D79 — DB từ chối loại chưa khai là rollback CẢ cú chốt vòng; có test
lớp đọc danh sách từ chính mã nguồn theo vị trí cột INSERT rồi thử trên DB
thật). Snapshot GỌN ≤ ~300 byte, chỉ những gì user NHÌN THẤY (A3.3), kèm bối
cảnh đối thủ R1 (D25).

**Đường ghi telemetry:** client gộp lô (`web/src/lib/telemetry.ts` — hộp thư
đi, có trần số lượng + KÍCH CỠ, `chi_tiet` danh sách trắng khoá chống PII
C7) → `server/telemetry.ts` (CTE một vòng, rate limit bằng chính dữ liệu
user) → `telemetry_cuon.ts` cuộn ngày. `man` là MẪU ROUTE, không URL cụ thể.

**Số liệu chấm điểm:** Brier chợ dự báo (A5.4, bảng `scores`) · Brier vòng
trận (`server/holdem/brier.ts`, thước A5.4 dùng lại — D67; toàn tiền mặt =
`null` KHÔNG phải 0) · kỳ ngộ (`vi_the_truoc`/`loi_suat_ma` engine phát sẵn,
`ky_ngo.ts` chấm — phần 1 sở hữu code, phần này sở hữu ĐỊNH NGHĨA đo).

**Nguyên tắc nguồn (D62):** cái gì máy chủ đã biết thì KHÔNG đo lại bằng
telemetry — telemetry chỉ đo thứ CHỈ máy người chơi biết. Hai nguồn cho cùng
sự thật thì nguồn yếu là chỗ để trôi.

## C. LUẬT BẤT BIẾN (một dòng + con trỏ)

- **A3.3** — events append-only, trigger DB chặn UPDATE/DELETE/TRUNCATE.
- **A7** — công thức index viết TRƯỚC, suy ngược trường cần log; event cùng
  transaction.
- **A9** — ranh giới hai bảng; ba trần: Supabase 500 MB · Vercel 1M
  request/tháng (gộp lô bắt buộc) · pool kết nối.
- **C7 PDPD** — chỉ khoảng (`age_band`…), không PII; bảng chéo nhân khẩu bị
  che khi CẮT CHÉO (D61).
- **D64 luật 3** — mùa reset gần hết mọi thứ NHƯNG không reset events; thứ
  ghi vào events / quyết định danh tính / đổi replay = cẩn thận kiểu doanh
  nghiệp. Đó là chỗ duy nhất.
- **D85 hai bộ data** — map 8 giữ THUẦN làm đối chứng (test byte-hệt đang
  canh); mẫu có kích thích phải CÓ NHÃN để tách khi phân tích.
- **Event cũ mang thước cũ** — đổi ngữ nghĩa một trường (vd fx D46, man_ra
  D62) thì query phân tích phải biết MỐC đổi; ghi mốc vào Nhật ký.

## D. RANH GIỚI FILE

**Sở hữu:** `server/telemetry.ts`, `server/telemetry_cuon.ts`,
`config/telemetry.ts` · `web/src/lib/telemetry.ts` · migrations
telemetry/events (`0024/0026/0028/0035/0037/0038`…) · định nghĩa
`action_type` + test lớp canh nó · `server/holdem/brier.ts` (thước đo — sửa
phải phối hợp phần 1).

**Dùng chung:** mọi file NGHIỆP VỤ có ghi event (`holdem_api.ts`,
`markets.ts`, `shop.ts`…) — phần chủ file đó code, phần này duyệt SCHEMA
dòng log (trường gì, snapshot gì, events hay telemetry).

**Cấm:** viết code đọc telemetry để trả lời câu hỏi mà `events`/bảng bền đã
trả lời được (D62); dashboard đọc số là việc phần 6 (admin) — định nghĩa
đúng/sai của con số là việc phần này.

## E. NGHIỆM THU

```
npm test          # gồm test lớp action_type + trigger append-only + A9
npm run audit:supply
```
- Loại event mới: chứng minh INSERT chạy trên DB THẬT (không mock — A8.9),
  tiêm lỗi ngược (bỏ migration ⇒ test đỏ).
- Truy vấn phân tích mới: kiểm TÍNH CHẤT (phễu đơn điệu giảm, không bậc
  >100% — D62), không khoá con số fixture.
- Mỗi lần thêm nguồn đo: hỏi *"máy chủ đã biết chưa?"* trước khi thêm.

## F. NỢ ĐANG TREO

- Ngữ cảnh log 04 §2.3 (`bb_dang_phong`, độ trễ quyết định…) để làm dày 6
  chỉ số — chưa làm.
- ⚠ **n người thật = 0** (founder xác nhận 03/09/2026, D223): *"từ trước đến nay
  toàn là t tự chơi cả"*. Cả **26/26 tài khoản** trên prod là của founder — kể cả
  24 tài khoản mang `role='user'`. Con số "n ≈ 3 người thật" ghi ở đây trước 03/09
  là SAI: nó đếm tài khoản, không đếm NGƯỜI. ⇒ mọi tỷ lệ đo tới hôm nay là tỷ lệ
  của MỘT người ngồi thử, không phải mẫu; đừng vặn sản phẩm theo chúng, và đừng
  trích chúng ra ngoài như số đo người dùng. Cờ `users.la_tester` (D223) đánh dấu
  đúng 26 tài khoản đó để lứa người thật sắp tới không bị trộn vào.
- Sự kiện `ky_ngo` (chọn nhiệm vụ = trục hành vi mới) — vào cùng đợt nối dây
  phần 1, schema dòng log duyệt ở phần này.
- 66/90 lượt bỏ trận trong phút đầu (D62) — caveat founder-tự-thử nay được XÁC
  NHẬN chứ không còn là nghi ngờ (D223): 100% số lượt đó là của founder. Đo lại
  từ đầu khi có người lạ; con số này không nói gì về người dùng thật.
