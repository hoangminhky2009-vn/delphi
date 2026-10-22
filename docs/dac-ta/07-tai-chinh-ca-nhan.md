# Part 7 — Personal finance and insight: personality card, radar chart, business direction

Part of the [specification by part](00-ban-do.md). Corrected together with the code whenever the two disagree.

*The document below is in Vietnamese, the language of the project.*

## A. VAI TRÒ & HIỆN TRẠNG

Phần này là MẶT B2C của bộ data (D73, founder lái hướng): người chơi nhận
**thẻ tính cách tài chính** — profile vui, dễ flex, tạo lan toả; founder chỉ
cần *"data để làm product và phân tích tỷ lệ"*. Trang `/tai-chinh` sống trên
prod: thẻ đọc vị emoji to (ngoại lệ D47 có chủ ý — trang khoe), radar 6
trục, đường độ chuẩn, dòng token, bảng số gốc.

**Hướng business (founder nhấn lại 15/08):** *"Tích hợp cả hỗ trợ quản lý
tài chính cá nhân ở phần tính cách"* — quản lý tài chính cá nhân ĐẦY ĐỦ là
mùa sau, trang đã nói rõ điều đó với người chơi. Phần này là chỗ hướng đó
mọc ra, nên giữ nó TÁCH khỏi phần thu-data: thu-data (phần 3) định nghĩa
ĐO GÌ; phần này định nghĩa NÓI GÌ VỚI NGƯỜI CHƠI và bán trải nghiệm gì.

"Biến thành Behavioral Finance Platform nếu profile cuốn hơn game?" — CHƯA
QUYẾT, và cố ý (D86): ở lại là công ty game tới khi game chứng minh giữ
chân; để dữ liệu sử dụng quyết.

## B. KIẾN TRÚC & DÒNG CHẢY

- **`server/holdem/insight.ts`** — 6 chỉ số tâm lý, hàm THUẦN tính từ
  `events` + map, KHÔNG replay: hiệu chỉnh Brier + xu hướng · đuổi giá ·
  theo tin chưa kiểm chứng · chốt non/gồng lỗ · dồn vốn sau thắng/thua ·
  giá của thông tin. Vòng `tu_dong` (hết giờ) loại khỏi đo HÀNH VI nhưng
  Brier vẫn tính (D38). **Thiếu mẫu ⇒ `null`, không phải 0** (D62 — bảng
  đứng ở 0.00 là bảng nói sai).
- **9 tính cách** — luật tất định, THỨ TỰ là một phần của luật (nét "đắt"
  xét trước nét "đẹp"). Server trả **ID + SỐ**; toàn bộ câu chữ + emoji ở
  `web/src/lib/tinh_cach.ts` (luật tự điển D26, vùng lint quét).
- **Kênh đọc thuần `web/src/api/tinh_cach.ts`** — ra đời vì tường lửa D24
  tự bắt bài giữa chừng: KHÔNG import ví trận, KHÔNG mutation; có MỘT bài
  firewall test canh vĩnh viễn chính kênh này. Đây là ranh giới kiến trúc
  quan trọng nhất của phần: màn tính cách đọc được cả hai thế giới (ví T +
  trận) mà không dựng cầu quy đổi.
- **`/tai-chinh`** (`web/src/screens/TaiChinh.tsx`): radar SVG thuần (trục
  thiếu dữ liệu vẽ MỜ giữa thang), dòng token đọc thẳng `wallet_ledger` gộp
  theo lý do (`/me/dong-token`), hoạt ảnh kéo-từ-tâm `useKeoRa`
  (IntersectionObserver + callback ref — bài học đo-đường-chính D76/D78),
  hai khối số gốc Ở CUỐI trang nhưng KHÔNG BỎ — mọi hình chỉ là biến hình
  của số thật (D78).
- **Admin đối chiếu:** mặt TÍNH CÁCH (khu SẢN PHẨM của app quản trị `/quan-tri`, D335) dùng CHUNG
  `hoSoTinhCachCuaUser` — hai màn một con số (chống trôi hai bản D61).
- **THẺ NĂNG LỰC (D323, 13/09)** — lớp thứ hai bên cạnh thẻ tính cách, đo thứ
  KHÁC: tính cách là *bạn quyết định KIỂU gì* (theo NGƯỜI, cần gói 10 trận);
  năng lực là *bạn đã LÀM ĐƯỢC gì trên ĐỀ này* (theo TRẬN, có ngay sau một
  trận). `config/nang_luc.ts` (ba năng lực, ngưỡng PLAYTEST-TUNE, mã khung
  ngoài OECD/INFE + GDKT&PL) · `server/holdem/nang_luc.ts` (hàm thuần:
  `chamNangLucTran` một trận → ba bậc `chua_gap · gap_chua_vung · lam_duoc`;
  `gopNangLuc` qua mọi trận → `chung_minh` chỉ khi `lam_duoc` ở ≥ 2 seed khác,
  tức test-retest) · `server/holdem/nang_luc_ids.ts` (DTO, client import qua
  `@server`) · `hanh_vi_vong.so_nhom` (0064 — số NHÓM tài sản, không phải số
  mã; `HANH_VI_FORMULA_VERSION` 2) · route `/holdem/me/nang-luc` + trường
  `nang_luc` của `/autopsy` (dựng dòng tại chỗ, idempotent) · client:
  `web/src/lib/nang_luc.ts` (tên khung ngoài, chữ quét A10) ·
  `components/holdem/NangLucKet.tsx` (khối màn kết) ·
  `screens/tai-chinh/NangLuc.tsx` (tab NĂNG LỰC, `/tai-chinh/nang-luc`).
  Demo đã chốt bố cục: `docs/ui-ux/demo/the-nang-luc.html`. Bàn tập vẫn được
  chấm nhưng `tinh_vao_the = false`. Thiết kế + bảng ánh xạ 7 ứng viên:
  `docs/yeu-cau-ky-thuat/10-buoi-do-va-thang-nang-luc.md` §3.2–§3.3.

## C. LUẬT BẤT BIẾN (một dòng + con trỏ)

- **A10 — MÔ TẢ được, KÊ ĐƠN không.** Câu chữ chỉ tả + đặt câu hỏi; không
  khuyên đầu tư (đụng cả ranh pháp lý). Ai viết thêm câu chữ mới phải giữ
  khuôn này.
- **Tường lửa D24** — không import chéo ví T ↔ ví trận qua kênh này; test
  firewall là luật, không phải gợi ý.
- **Thiếu mẫu = `null`** ở MỌI chỉ số mới — 0 là một giá trị đo được, null
  là "chưa biết"; trộn hai cái là thước nói dối (D62/D67).
- **Server ID+SỐ, chữ ở client** (D26) — thêm tính cách/chỉ số mới thì
  server không mang chuỗi hiển thị.
- **Hình nào cũng phải có số gốc kiểm được** (D73/D78) — radar không đứng
  một mình.
- **Mô tả ra ngoài dùng câu mùa 0.0** (D63) — insight phục vụ R&D, chưa bán.

## D. RANH GIỚI FILE

**Sở hữu:** `server/holdem/insight.ts` (+ route `/me/tinh-cach`,
`/me/dong-token` trong phạm vi đọc) · `web/src/lib/tinh_cach.ts` ·
`web/src/api/tinh_cach.ts` · `web/src/screens/TaiChinh.tsx` + css ·
tests insight/tinh_cach/firewall tương ứng · **lớp năng lực (D323):**
`config/nang_luc.ts` · `server/holdem/nang_luc.ts` + `nang_luc_ids.ts` ·
route `/me/nang-luc` · `web/src/lib/nang_luc.ts` · `components/holdem/NangLucKet.tsx` ·
`screens/tai-chinh/NangLuc.tsx` · tests `nang_luc*` (root + web).

**Dùng chung:** định nghĩa 6 chỉ số đo từ events — schema log là phần 3;
`hd_brier_vong`/`ky_ngo` là nguồn nguyên liệu do phần 1 phát; tab TÍNH CÁCH
admin render là phần 6, con số là của phần này.

**Cấm:** thêm mutation vào kênh đọc thuần; hiển thị chỉ số cho NGƯỜI KHÁC
xem (A3.8 — bảng đua Brier đẻ động cơ méo, D32 đã phân tích).

## E. NGHIỆM THU

```
npm test          # 13+ vector chép tay insight (nếp A5.2) + firewall D24
npm run web:test
```
- Chỉ số mới: vector tính tay TRƯỚC; một bài riêng hỏi *"engine có CHẠY RA
  nó không"* (D67 — 10 bài xanh kể cả khi không ai gọi hàm).
- UI mới: trình duyệt thật, nạp THẲNG trang (không SPA-cache), radar phải
  chạy từ 0→thật, lưới an toàn khi IO không bắn.

## F. NỢ ĐANG TREO

- Ngữ cảnh log 04 §2.3 để làm dày 6 chỉ số (chờ phần 3 nối).
- Kỳ ngộ mở trục hành vi mới (cú CHỌN nhiệm vụ + khẩu vị sau 5 trận khoá
  D86) — chỉ số mới ăn theo, thiết kế khi data về.
- "Quản lý tài chính cá nhân": founder ĐÃ GỌI 23/08 — research + đề xuất ở
  `docs/khao-co/de-xuat/pfm-quan-ly-chi-tieu.md` (sổ 2 chạm local-first, gương
  ba mặt, tủ cúp) + `dan-dat-hanh-vi-ca-nhan-hoa.md` (thang can thiệp 4 bậc dưới
  A10). Mục tiêu + tiên đề P1–P13 + bảng trạng thái chốt: ĐÃ CÓ ở
  `yeu-cau-ky-thuat/05-pfm-muc-tieu-va-tien-de.md` (D133). Spec thi công chi
  tiết chỉ viết sau khi bảng §3 của file 05 hết hàng CHỜ — không code thẳng
  từ thiet-ke-de-xuat.
- ⚠ **n người thật = 0** (D223, founder xác nhận 03/09/2026 — 26/26 tài khoản là
  của chính mình). "Phân tích tỷ lệ" chưa có mẫu, và chưa từng có: đừng hứa số,
  hứa đường ống. Con số "n ≈ 3" ghi ở đây trước 03/09 đếm TÀI KHOẢN chứ không
  đếm NGƯỜI.
