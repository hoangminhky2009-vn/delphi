# 00b — RÀ SOÁT LOGIC TÍNH TOÁN + TƯƠNG QUAN + MỐI NỐI (28/07)

> Founder: *"Kiểm tra lại toàn bộ logic tính toán, ma trận và tính năng tương quan
> cũng như các mối liên kết trong code. ĐẶC BIỆT KIỂM TRA KỸ PHẦN ALPHA DRAFT."*
>
> Phương pháp: **đo bằng số, không đọc chay**. Rà một mình, tuần tự (luật cấm agent
> song song 27/07). Mỗi kết luận kèm phép đo hoặc `file:dòng`.

---

## 1. MA TRẬN TƯƠNG QUAN D39 — ĐO ĐẠT, KHÔNG SỬA GÌ

Đo thực nghiệm 40.000 lượt rút nhiễu × 4 mã (btc·vn30·vàng·tpcp) × 3 chế độ,
so tương quan Pearson đo được với lý thuyết `ρ = β_i·β_j`:

| chế độ | cặp lệch lớn nhất | đo | lý thuyết |
|---|---|---|---|
| vòng thường | mọi cặp | ±0,003 | khớp |
| `hack_san` | vàng·tpcp | 0,162 | 0,160 |
| `chien_tranh` | btc·tpcp | −0,285 | −0,280 |

- **Khớp lý thuyết tới ±0,005 ở mọi cặp, mọi chế độ** — mô hình một nhân tố sinh
  đúng ma trận nó khai.
- **σ từng mã KHÔNG đổi giữa các chế độ** (btc ≈ 232 ở cả hack_san lẫn chien_tranh;
  σ/biên_độ = 0,577 = 1/√3, đúng phân phối đều) — `√(1−β²)` giữ biến động riêng
  y nguyên như D39 hứa.
- Chữ ký sự kiện đúng thiết kế: hack_san kéo CẢ vàng cùng chiều (phân tán thất bại
  đúng lúc cần); chien_tranh cho vàng/tpcp âm đậm (hộ giá thật).
- Bất biến tin giả: test *"cùng ô, đổi cờ tin giả ⇒ dãy nhiễu GIỐNG HỆT"* xanh
  (`holdem_tuong_quan.test.ts:185`).

## 2. BẢO TOÀN TIỀN — ĐO 14.000 VÒNG, KHÔNG MỘT ĐỒNG TỰ SINH

Script replay 2.000 trận × 7 vòng, bất biến: `Σ(delta vốn cả bàn) + mọi khoản
rời hệ (phí đứng ngoài · cắt lỗ · đòn bẩy · ký quỹ) ≤ 0`. **0 vi phạm.**
Phần dư chia Quỹ vòng do floor **cộng cho hạng nhất** (`engine.ts:1785`), không
đốt ngầm.

## 3. HAI LỖI TÌM RA — MỘT NẶNG, ĐÃ SỬA CẢ HAI

### 3.1. ⚠ NÚT BỎ CHẾT SAU BẢN VÁ `cuocTat` — bẫy trang trí LẦN THỨ 10

Bản vá sáng 28/07 ép mọi ghế `theo` **mà không mời callback**. Nhưng TOÀN BỘ
nhánh cắt lỗ — phí rút khẩn + lạm phát (`engine.ts:2086`), quota
`so_lan_cat_lo` (`:2094`), giẫm đạp ≥30% (`:2067`), rời pot — khoá theo
`ttCuoc.daBo`, mà `daBo` chỉ được ghi qua nước `'bo'` của chính máy cược.
⇒ BỎ bấm được, hộp xác nhận doạ phí, **không có gì xảy ra**.

**Sửa:** vẫn mời callback, ép mọi nước **trừ `'bo'`** về `'theo'`. Tố chết,
cắt lỗ sống. Kèm: `botTuQuyetCamKet` trong v10a trả về `true` — cờ đó còn là
nguồn ý định CẮT LỖ của bot; tắt nó là bot không bao giờ thoát hàng.
Test khoá hai chiều: `holdem_tatcuoc.test.ts` (5 test).

### 3.2. Journal có thể ghi ý định `to` của bot dù engine ép về `theo`

Nhật ký lượt (`ghiNhat` ở holdem_api) ghi ý định THÔ trước khi engine ép.
Vô hại với tiền (gop vẫn = nền, đã có test), chỉ là nhãn hành động của bot
trên UI có thể nói "tăng cam kết" trong vòng không ai tăng được. **Ghi nhận,
chưa sửa** — UI nhật ký cược đang ngủ (không còn đường bấm), và cả cụm chết
theo engine v10.

## 4. CÁC MỐI NỐI ĐÃ RÀ — SẠCH

| Mối nối | Kết quả |
|---|---|
| Shop payload vòng 7·8 | chỉ gate `da_chay` (`holdem_api.ts:1123`) — chợ mở mọi vòng là THẬT, không chỉ trên giấy |
| `dong_ho` payload ↔ client | `het_gio` có mặt, test màn thật xanh |
| Cổng khoá client ↔ server | cùng gọi `khoaKipChot` — một nguồn |
| Trần mua client ↔ server | `maxTaiSanCua` server suy, client chỉ vẽ |
| Quota `'bo'` dưới `cuocTat` | vẫn gác qua `duoc` như v9 |
| Chia pot khi gop bằng nhau | một pot duy nhất, residual về hạng nhất |

## 5. NỢ ĐÃ BIẾT, KHÔNG PHẢI LỖI MỚI

1. **`pnl_bp` ≠ Vốn tuyệt đối** trên UI (bot `9.337 (+4,92%)`) — bệnh cấu trúc
   D35, co lại còn ±nền/vòng sau `cuocTat`, **chết hẳn khi NAV v10 xong**.
2. `TRONG_SO [5000,3000,2000]` không chuẩn hoá theo cỡ bàn (nợ D31).
3. Mọi số cân bằng đo trên v9 (gate G1–G4 · đòn bẩy · divon) không còn tả v10a —
   D40 đã tuyên phải đo lại; đo trên v10a là đo một bước đệm, không đáng.

---

## 6. ĐỢT HAI (28/07, founder: "cực kỳ nhiều lỗi logic và hiển thị khi lật thẻ / tương quan")

Đo thêm ba lớp, tìm ra ba lỗi hiển thị THẬT + một điểm căng phải chờ founder:

### 6.1. Đo được — sạch

- **Tổng mắt xích = PnL**: 28.000 ghế-vòng qua `giaiQuyetVong`, **0 lệch**. Con số
  trên màn chốt phiên luôn cộng khớp.
- **Ma trận kỳ vọng × tờ (!) khớp dấu 100%**: không ô nào matrix dương mà (!) nói
  xấu hay ngược lại (script đối chiếu cả 6 mã × 7 sự kiện × 5 giai đoạn).
- **Trục lật thẻ không lệch chỉ số**: ô UI hiện (`o_hien_tai = o[vong−1]`) đúng là
  ô engine áp (`o[vong−1]` trong replay). Nhãn hành động đối thủ suy từ KẾT QUẢ
  THẬT (`suyHanhDong` đọc `cam_ket`/`da_cat_lo`), không từ ý định.

### 6.2. Ba lỗi hiển thị đã sửa

1. **4 kind mắt xích không có nhãn** — engine phát `dac_quyen` (5.600 lần /
   28.000 ghế-vòng đo), `chan_lo_san` (431 lần), `short`, `don_bay_cam_ket` mà
   ChainReveal thiếu case ⇒ rơi vào default *"cơ chế chưa có nhãn (báo lỗi giúp
   mình nhé)"*. Ba trong bốn là ĐẶC QUYỀN THẺ — đúng khoảnh khắc lá bài làm được
   việc thì màn hình bảo người chơi đi báo lỗi. Đã thêm 4 nhãn + shape
   `don_bay_cam_ket` vào DTO.
2. **Bộ đếm bài lệch một ô** — `thanhPhanCongKhai(map, vong−1)` đếm cả Ô ĐANG
   NGỬA vào "còn lại": vòng 1 map 8 hiện *"còn 8 ô"* trong khi ô 1 ngửa giữa màn
   (đúng ảnh founder). Sửa thành `vong`; test khoá "còn = tổng − ô đã ngửa".
3. *(sửa từ đợt trước, ghi cho đủ)* nút BỎ chết theo `cuocTat` — §3.1.

### 6.3. ✅ FOUNDER ĐÃ CHỐT: PHƯƠNG ÁN A (28/07 — "A")

Giữ SỐ, thêm CHỮ. Thi hành: tờ (!) của mã bị mâu thuẫn có thêm dòng ⚠
*"Khủng hoảng thanh khoản (…): đám đông bán cả nơi trú để gom tiền mặt — mức
'tốt' ở đây là trung bình nhiều trận, không phải lời hứa trong cơn hoảng loạn."*
Dòng SUY TỪ CONFIG (`luuYThanhKhoan` trong tu_dien.ts): sự kiện tính là khủng
hoảng thanh khoản khi β nhóm phòng thủ ≥ 3000 (hack_san · thien_nga_den), mã
được cảnh báo khi kỳ vọng dương và β riêng ≥ 2500 ⇒ vàng · usd · tpcp. Đổi
ma trận/β là dòng tự theo. Ba test khoá cả hai chiều (mã rủi ro KHÔNG có dòng —
bản đầu heuristic dính btc × hạ_lãi_suất, test bắt được: β dương trong sự kiện
TỐT là cùng bay lên, không có đuôi nào để cảnh báo).

Nguyên văn phần trình founder trước khi chốt:

**`vàng × hack_san = +1800 (rất tốt)` nhưng β = +4000.** Tờ (!) hứa vàng là nơi
trú khi hack sàn (kỳ vọng dương), nhưng D39 cố ý cho vàng SẬP CÙNG đám đông ở
đuôi khủng hoảng thanh khoản. Trung bình thì tờ (!) đúng; người cầm vàng xuyên
một cú đuôi xấu sẽ thấy nó "nói dối". Hai lối: (A) giữ nguyên — dạy đúng bài
"trú ẩn trung bình ≠ trú ẩn trong hoảng loạn" (tháng 3/2020 thật); (B) hạ kỳ
vọng vàng/usd/tpcp trong `hack_san`/`thien_nga_den` cho khớp chữ ký D39.
⭐ Khuyến nghị (A) + một dòng trong tờ (!) nói rõ "khủng hoảng thanh khoản kéo
cả nơi trú" — sửa CHỮ, không sửa SỐ. `thien_nga_den` cùng dạng.

## ĐÃ SỬA

| Ngày | Đổi gì | Ai quyết |
|---|---|---|
| 28/07 | §3.1: `cuocTat` mời callback + ép trừ `'bo'`; v10a giữ `botTuQuyetCamKet: true` | agent (sửa lỗi, không đổi tham số kinh tế) |
| 28/07 | §6.2: 4 nhãn mắt xích + shape DTO; bộ đếm bài trừ ô đang ngửa | agent (sửa lỗi hiển thị) |


## AUDIT ĐƯỜNG TIỀN 01/08 (founder: "audit tìm điểm mù") — v13

Máy quét bất biến `scripts/holdem_audit_tien.ts` (600 trận × 2 lần, bàn 5, bot
hỗn hợp all-in/ngẫu nhiên/tiền mặt) + soi tay `nav.ts` trọn file.

**SẠCH (bất biến cứng, 0 vi phạm):** `pnl_bp` đúng công thức tăng trưởng từng
bp trên mọi ghế mọi vòng · NAV/vị thế không bao giờ âm · ghế CHÁY đóng băng
tuyệt đối (không nhận thêm một chip) · tất định end-to-end (chạy lại cùng seed
ra cùng NAV cuối). Toán tiền của v10–v13 đứng vững.

**ĐIỂM MÙ #1 — hàm chia quỹ chết (ĐÃ GỠ):** `chiaQuyTheoTangTruong` được
engine import mà KHÔNG một đường gọi nào — chia quỹ thật đi đường
`pnl_bp := tăng trưởng NAV` → `chiaQuyVong` (engine ~2422, cùng kết quả xếp
hạng). Hàm chết CÓ TEST XANH = "cơ chế trang trí" lần 12, loại nguy hiểm nhất
vì ai đọc cũng tưởng nó chạy. Đã xoá hàm + test + import.

**ĐIỂM MÙ #2 — NỀN NÉ ĐƯỢC BẰNG ALL-IN (CHỜ FOUNDER, A8.2):** cam kết nền 500
chỉ trừ được TIỀN MẶT ⇒ all-in xong tiền mặt 0 là né nộp quỹ hợp lệ; cuối trận
cả bàn đầu tư hết ⇒ quỹ vòng teo về phí trượt (~76–124) và **678 vòng quỹ = 0**
trong 600 trận. Hệ quả kép: (a) phần thưởng xếp hạng vòng mất nghĩa ở nửa sau
trận (khảo sát D40: dưới ~250 chip là chìm trong nhiễu); (b) nghịch khuyến
khích — phơi nhiễm tối đa còn được MIỄN phí quỹ. Ba đường:
· (A) giữ nguyên — chấp nhận all-in miễn quỹ;
· ⭐ (B) nền = PHÍ QUẢN LÝ trừ trên NAV: tiền mặt trước, thiếu trừ pro-rata vào
  vị thế (không trượt giá — không phải lệnh bán). Không ai né được, "chi phí
  chơi mỗi vòng" đúng nghĩa quỹ thật, quỹ vòng sống cả trận;
· (C) bỏ nền, quỹ = phí thuần — chính khảo sát D40 đã đo "phí một mình KHÔNG
  đủ nuôi".

**FOUNDER CHỐT B cùng ngày — ĐÃ THI HÀNH:** `balance-v14-nennav` (MẶC ĐỊNH
01/08): máy cược nhìn sức đóng = NAV; chỗ trừ chia tiền-mặt-trước, thiếu trừ
pro-rata vị thế (không trượt giá — phí, không phải lệnh bán; dư floor vào mã
lớn nhất, tất định). Đo lại 400 trận × 2: **0 vòng quỹ hụt** (v13: ~4.800 vòng
hụt + 678 vòng quỹ = 0), bất biến cứng vẫn sạch. Trận ≤ v13 replay luật cũ.

**GHI NHẬN #3:** chip gọi ký quỹ ĐỐT im lặng (không vào quỹ vòng) — chủ ý D37,
là sink; ghi để người đọc sổ cái sau này không đi tìm chỗ rò.

**GHI NHẬN #4 (đã sửa cùng ngày):** nhãn danh mục "trùng lá = nâng cấp" nói
dối trận nav (tài sản đi bằng tiền); danh mục nay BẤM BẰNG HÌNH → mở panel
phân bổ + hiện giá trị vị thế từng mã (lệnh founder 01/08).
