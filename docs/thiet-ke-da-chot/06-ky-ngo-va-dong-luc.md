# 06 — KỲ NGỘ TRONG TRẬN, BẢN SẮC CỠ MAP, VÀ ĐỘNG LỰC

**Nguồn:** founder chốt trong phiên 12/08/2026 sau khi bác thẳng đợt làm việc
trước đó (*"t bảo m cải tiến gameplay và cơ chế app mà cả phiên mày chỉ ngồi
vẽ"*). Yêu cầu rõ: **nghĩ và chốt cơ chế trước, KHÔNG build ngay**.
File này là KIẾN TRÚC đã chốt. Chưa có dòng code nào.

**CẬP NHẬT 15/08 (D86):** founder chốt nốt SỐ (§7 → §7bis), ĐẢO một ý ở §1.3
(đặc quyền không được trùng lá chiến thuật), thêm §8 (mở khoá theo trận) và §9
(bối cảnh đóng băng chợ dự báo — toàn lực dồn vào cụm này).

---

## 0. Bốn phàn nàn (nguyên văn) và chẩn đoán gốc

1. *"map 8 và map 12 đang hơi chán"*
2. *"cơ chế app hay cả chính game cũng chưa có nhiệm vụ ngắn hạn nào cho người
   chơi cảm giác hoàn thành"*
3. *"player hiện tại chả có động lực gì để chơi game cả"*
4. *"map 12 và 16 thì chỉ là map 8 dài lê thê quá chán, chả có định hướng nào cụ
   thể hơn"*

**GỐC — cả bốn là một thứ: THIẾU VÒNG CUNG.** Trận không có mở–cao trào–kết;
meta không có sợi chỉ kéo người quay lại.

· **Trong trận:** cỡ map chỉ đổi *số ô*. `sinhMap(seed, size, luat)` nhận cùng
  một bộ cờ cho cả ba cỡ (xác nhận khi sửa dụng cụ đo, D83) ⇒ map 16 là 16 lần
  lặp cùng một kiểu thời tiết. Không có cao trào, và người chơi không biết mình
  đang ở đoạn nào của cái gì.
· **Giữa các trận:** rank có (Tôm→Cá Voi, D48) nhưng không kéo — không có mốc kế
  tiếp hiện rõ, và **không có lý do nào để hôm nay khác hôm qua**.
· ⚠ **Chất xúc tác giấu mặt:** vòng lặp kẻ dẫn đầu (D40 §4, treo từ 27/07). Hạng
  cao → chia nhiều Quỹ vòng → nhiều tiền mặt → mua nhiều → càng dẫn tiếp. Trận
  ngã ngũ từ vòng 3, nên **nửa sau của map nào cũng chết, và map dài chết lâu
  hơn**. Đây chính là cơ chế đứng sau chữ "dài lê thê".

---

## 1. ⭐ KỲ NGỘ TRONG TRẬN — trục chính của cụm này

**Founder chốt (nguyên văn):** *"Tôi nghĩ nên thêm hệ thống 'Nhiệm vụ phụ' cho
map lớn thay vì chỉ đơn thuần là kiếm nhiều tiền nhất"* → *"Hiện trong trận ấy,
như kiểu các vòng kỳ ngộ các thứ trong TFT, hoàn thành sẽ được thêm đặc quyền nào
đó chẳng hạn. (Cái này cũng giúp thu data hành vi) Và có đa dạng nhiệm vụ/lần cho
user chọn"*.

### 1.1. Cơ chế

Ở một số vòng nhất định của map lớn, trận **dừng lại và mời chọn**: hiện ra một
bộ nhiệm vụ (đa dạng, mỗi lần một bộ khác), người chơi **chọn đúng một**. Hoàn
thành trong phần còn lại của trận → nhận **đặc quyền**.

Đây là khuôn *augment* của TFT, và nó được chọn vì ba lý do độc lập cùng chỉ về
một hướng:

1. **Nó tạo VÒNG CUNG.** Vòng kỳ ngộ là mốc chia hồi: trước nó là mở màn, sau nó
   là "đang theo đuổi một thứ". Map 16 thôi là 16 lần lặp.
2. **Nó cho MỤC TIÊU NGẮN HẠN** (phàn nàn #2) mà không cần một danh sách quest
   dán ngoài trận.
3. ⭐ **CÚ CHỌN CHÍNH LÀ DATA** — founder tự nhận ra điều này. Xem §4.

### 1.2. ⚠⚠ LẰN RANH KHÔNG ĐƯỢC BƯỚC QUA — nếu bước, nhiệm vụ phụ GIẾT sản phẩm

Đây là chỗ dễ hỏng nhất của toàn bộ thiết kế, và nó là ràng buộc A1 + D69.
`events` là sản phẩm; app đo **khẩu vị rủi ro TỰ NHIÊN**. Một nhiệm vụ kê đơn tư
thế rủi ro thì từ đó về sau ta đo **sự vâng lời**, không đo khẩu vị — và `events`
là append-only (A3.3) nên **không gắn nhãn lại được về sau**.

> **LUẬT:** thưởng cho **ĐỌC ĐÚNG** và **ĐIỀU HƯỚNG QUA CUNG**. Tuyệt đối không
> thưởng cho **MỨC PHƠI NHIỄM · ĐA DẠNG HOÁ · MỨC TIỀN MẶT** — vì ba cái đó
> *chính là* trục khẩu vị rủi ro mà ta đang đo.

| SẠCH — được phép | CẤM — nói dối data |
|---|---|
| **Nhà tiên tri** — đọc đúng ≥3 điểm ngoặt (đo bằng Brier *hướng*, không đo cỡ lệnh) | *"Giữ ≥50% tiền mặt qua đỉnh"* — kê thẳng mức phơi nhiễm |
| **Qua trọn cung** — kết trận NAV cao hơn đỉnh bong bóng (nhiều đường tới, không ép một tư thế) | *"Đa dạng hoá ≥4 mã"* — kê đúng một trục rủi ro |
| **Bắt được nhịp** — ≥N vòng danh mục thắng chỉ số thị trường | *"All-in ít nhất 1 vòng"* — kê thẳng việc liều |

**Phép thử trước khi thêm bất kỳ nhiệm vụ nào:** *"cái này nói với người chơi
PHẢI PHƠI RA BAO NHIÊU, hay chỉ nói HÃY ĐỌC ĐÚNG?"* Cái đầu ⇒ loại.

Lý lẽ giữ được: nhiệm vụ sạch đổi thứ người chơi **chú ý tới** (đọc chu kỳ), chứ
không đổi **mức họ dám phơi ra**. Toàn bộ chỗ dựa của lằn ranh này nằm ở câu đó.

### 1.3. Đặc quyền — quy về THÔNG TIN và HIỆU QUẢ

Founder để agent chọn (*"Tùy bạn"*). Chốt: đặc quyền là **thông tin** hoặc
**hiệu quả**, KHÔNG phải token/NAV cho không.

· **Được phép:** thấy trước hé một ô · Bảng điện tử rẻ hơn/sạch hơn · một lượt
  khảo sát lại · miễn một phần trượt giá · mốc vốn mịn hơn.
· **KHÔNG:** thưởng T/Q, hoặc bơm NAV.

Ba lý do, và lý do thứ ba là lý do bắt buộc:
1. Token phải rút từ Kho bạc — quỹ MỘT LẦN, `CHECK ≥ 0` ở tầng DB (A3.4/D10).
   Thêm một cửa chi là thêm một đường làm cạn quỹ, và đó là **tham số kinh tế**
   cần founder duyệt số (A8.2).
2. Bơm NAV **đẩy snowball** — đúng thứ §3 đang muốn hãm.
3. ~~⭐ Đặc quyền thông tin tái dùng đúng cơ chế lá chiến thuật đã có~~
   ⚠⚠ **LÝ DO 3 BỊ FOUNDER ĐẢO 15/08** (nguyên văn: *"đặc quyền nhiệm vụ không
   nên trùng lặp với lõi chiến thuật"*) — và founder đúng: đặc quyền trùng lá
   thì lá thành thừa (ai còn mua Lướt Sóng khi nhiệm vụ phát bảng sạch?). Vế
   "không thêm nước đi mới" (phép thử D67) VẪN GIỮ; cái đổi là đặc quyền phải
   tìm TRỤC KHÁC — trục mà không lá nào chạm. Bộ chốt ở §1.4.

### 1.4. BỘ NHIỆM VỤ + ĐẶC QUYỀN ĐÃ CHỐT (15/08)

**"ĐÚNG HƯỚNG" — định nghĩa tất định (nền của LA BÀN và KẺ BẮT NHỊP):**
· Một VỊ THẾ đúng hướng ⟺ dấu vị thế khớp dấu lợi suất mã đó trong vòng
  (mua đúng khi r > 0 · bán khống đúng khi r < 0 · r = 0 → bỏ mã đó ra).
· Một VÒNG đúng hướng ⟺ **phần vốn đã triển khai nằm đúng phía > 50%** —
  TRỌNG SỐ VỐN, không đếm đầu mã ("đọc đúng" = phần lớn TIỀN ở đúng phía,
  không phải trúng một mã lẻ giữ 2%).
· ⚠ Vòng toàn tiền mặt KHÔNG TÍNH (cả tử lẫn mẫu) — tiền lệ Brier D67:
  *"đứng ngoài không phải dự báo sai, nó là KHÔNG dự báo"*.
· ⚠⚠ Chống lách: phải có **≥ ⌈50% runway⌉ vòng có vị thế** mới được xét xong.
  Thiếu vế này thì chiến lược trội là nằm im toàn tiền mặt, vào đúng một vòng
  ăn chắc. Khai thẳng cái giá: đây là ràng buộc phơi nhiễm NHẸ (đòi CÓ MẶT,
  không đòi NẶNG BAO NHIÊU) — trục khẩu vị rủi ro vẫn sạch.

| Nhiệm vụ | Xong khi | Đặc quyền | Trục — vì sao không lá nào chạm |
|---|---|---|---|
| **LA BÀN** | đúng hướng ≥60% vòng có vị thế | **BẢN ĐỒ CHU KỲ** — nhãn pha mọi ô ĐÃ lật + tên pha hiện tại | thông tin HỒI CỐ; mọi lá đều nói về tương lai |
| **TAY CÂN** | Brier trung bình ≤ ngưỡng (chưa chốt số) | **PHIẾU MỞ BẢNG ×2** | LƯỢT DÙNG; lá đổi giá/chất lượng vĩnh viễn — khác chất |
| **KẺ VƯỢT SÓNG** | thắng chỉ số thị trường ≥50% vòng còn lại | **THẺ GIỜ** — +giây mỗi vòng còn lại (đề xuất +8s, chưa chốt) | THỜI GIAN — chưa cơ chế nào chạm đồng hồ |
| **KẺ BẮT NHỊP** | đúng hướng ở ≥2 vòng ĐỔI PHA | **CHUÔNG ĐỔI PHA** — báo ô kế là ô đổi pha, KHÔNG nói pha nào | CẤU TRÚC; Lướt Sóng đoán NỘI DUNG (tên sự kiện) |

**Luật vận hành:** mời **3 trong 4**, xoay vòng (2 = tung xu, 4 = mỏng data với
~150 người; 3/4 còn lộ *lựa chọn thứ hai* khi món ruột vắng mặt) · **thất bại
KHÔNG phạt** (phạt ⇒ cú chọn thành né rủi ro ⇒ sập đúng cái đa dạng cần đo) ·
**giấu trong trận, LẬT Ở MÀN KẾT** (không bầy đàn theo lựa chọn — lằn D19; và
màn kết được thêm một khối lật bài) · dải hoàn thành mục tiêu **40–55%**
(PLAYTEST-TUNE; >70% là giải tham dự, <25% là bỏ cố).

**Vị trí kỳ ngộ** (THAY một vòng mua tài sản, không chèn thêm — map 16 có 11
vòng mua tài sản, chính nhịp lặp đó là "dài lê thê"; đặt ngay sau thẻ chiến
thuật cuối nên All-in đã mở):
· map 8 — KHÔNG (mẫu đối chứng, §4) · map 12 — vòng **7** · map 16 — vòng **6**
  và **12** (mở Hồi 2 và Hồi 3 của cung).

⚠ Chống trùng đặc quyền: không mời đặc quyền trùng lá đang cầm — hoặc nâng lá
đó một cấp (tái dùng hệ `MAX_BAN_SAO`). *(Với bộ đặc quyền mới thì va chạm gần
như biến mất, giữ luật để phòng bộ sau.)*

~~⚠⚠ BLOCKER thi công: TAY CÂN cần Brier mỗi vòng ĐƯỢC LƯU~~
✅ **BLOCKER NÀY ĐÃ TAN (kiểm 15/08) — KHÔNG CÒN VIỆC PHẢI LÀM.** D69 ghi *"Brier
mỗi vòng TÍNH rồi VỨT"* và doc này chép lại; nhưng thực tế `hd_brier_vong` đã có
`migrations/0035_brier_vong.sql` và đang được GHI trong transaction nộp vòng
(`holdem_api.ts`, cùng tx theo A7). Món nợ đã trả từ trước, chỉ là văn bản chưa
theo kịp. ⇒ TAY CÂN đo được ngay.
⚠ Bài học: doc chép lại một món nợ từ nhật ký thì phải KIỂM lại khi thi công —
một blocker ma làm người sau đi giải việc không tồn tại.

### 1.5. ICON CON ĐƯỜNG TRÊN AVATAR (founder 15/08) — và cách nó KHÔNG phá data

**Founder:** *"hiện luôn 1 icon nho nhỏ trên avatar người chơi cho người chơi
khác biết con đường họ chọn"*.

⚠ Yêu cầu này NGƯỢC §1.4 (*"giấu trong trận, lật ở màn kết"*). Soi lại thì lý do
cũ **quá tay**: bầy đàn chỉ xảy ra khi thấy lựa chọn của người khác **TRƯỚC KHI
mình chọn**. Sau khi đã chốt thì nhìn thấy nhau không đổi được gì đã chọn.

⇒ **CHỐT — khuôn A3.1 (ẩn pool tới lần đặt đầu), tiền lệ có sẵn trong hiến pháp:**
icon hiện **SAU KHI chính người xem đã chốt lựa chọn của mình** ở kỳ ngộ đó.
· Được cái founder muốn: người khác biết mình đi đường nào ⇒ cú chọn có khán giả
  (D25: "đối thủ thấy mình = cái để mất").
· Giữ data sạch: không ai copy được lựa chọn vì không thấy trước khi chọn — kể cả
  ở kỳ ngộ THỨ HAI của map 16, vì luật là "sau khi CHÍNH MÌNH chốt", không phải
  "sau khi kỳ ngộ 1 xong".
· Icon dùng BỘ PIXEL SẴN CÓ: la_ban=`target` · tay_can=`chart` · ve_song=`bolt`
  · bat_nhip=`candle`. KHÔNG emoji (D47), và dùng lại bộ có sẵn để không đẻ nợ
  art — art mới mới là phần tốn thời gian thật.

---

## 1bis. TRẠNG THÁI THI CÔNG (cập nhật 15/08 — đọc trước khi làm tiếp)

| Món | Trạng thái |
|---|---|
| Chương hồi có tên (§2) | ✅ XONG, đã lên prod (commit `6c8ce51`) |
| Bản sắc cỡ map (§2) | ✅ XONG, **ở CỔNG** `balance-v32-bansac` — CHƯA mặc định |
| Kỳ ngộ — lõi thuần | ✅ XONG: `config` (4 nhiệm vụ + `boNhiemVuMoi` + `laVongKyNgo`) và `server/holdem/ky_ngo.ts` (`dungHuong`/`thangChiSo`/`chamNhiemVu`), 25 test |
| Kỳ ngộ — engine phát số liệu | ✅ XONG: `KetQuaGhe.vi_the_truoc` + `.loi_suat_ma`, phát từ đúng chỗ tính Brier |
| **Kỳ ngộ — NỐI DÂY** | ✅ **XONG 15/08** — cả 6 bước, xem dưới |
| Dấu mốc kỹ năng (§5.1) | ◐ MỘT PHẦN — D89 "HÔM NAY BẠN VỪA CHẠM" (gọi tên khái niệm sau trận) + SỔ TAY khái niệm; "độ chuẩn đang lên / 3 vòng liền đọc đúng" chưa |
| Thử thách hôm nay (§5.2) | ✅ **XONG 17/08** — `GET /holdem/ngay` (bàn ngày find-or-create, migration 0041), card sảnh + phòng chờ + khối phân vị màn kết; xem D96 CLAUDE.md |

**NỐI DÂY — ĐÃ ĐI HẾT SÁU BƯỚC (15/08):**
1. ✅ `HanhDongLog.ky_ngo?: NhiemVuId` — optional VĨNH VIỄN (khuôn `dao`/`khoa`/
   `short`). ⚠ Lọc ở TẦNG NHẬN theo **bộ ĐƯỢC MỜI** của đúng (seed, vòng), không
   chỉ theo "có phải một trong bốn id không": mời 3 trong 4 là một phần của luật.
2. ✅ Migration `0038_hd_chon_ky_ngo.sql` **cùng commit** với code ghi nó.
3. ✅ Vòng kỳ ngộ THAY một vòng `tai_san` trong `nhipChonBai(soO, kyNgo)` — tổng
   số vòng KHÔNG đổi, và số vòng `chien_thuat` cũng không (All-in vẫn mở đúng hẹn).
4. ✅ DTO `ky_ngo`: bộ mời · lựa chọn · tiến độ · đặc quyền đang có · icon đối thủ.
5. ✅ Bốn đặc quyền, mỗi cái một trục — ba đặc quyền THÔNG TIN che ở TẦNG API
   (trường vắng mặt, F12 không moi ra được); PHIẾU MỞ BẢNG đi qua `phieuConLai`,
   MỘT nguồn cho cả chỗ trừ tiền (`replay`) lẫn chỗ báo giá (`/bang-dien-tu`).
6. ✅ Client: màn chọn · chip tiến độ (vẽ CẢ vế chống lách) · icon trên avatar ·
   lật hết ở màn kết.

⚠ **CỔNG PHIÊN BẢN LÀ MỘT CẦN GẠT RIÊNG (`kyNgo`), không dùng chung `banSacMap`.**
Tách để đo được "G1–G4 dịch vì cung tín dụng hay vì kỳ ngộ". Và nó CẦN cổng dù
nghe như thuần trình bày: PHIẾU MỞ BẢNG miễn một khoản phí có thật.
⚠ **BOT CHỌN CON ĐƯỜNG NHƯNG KHÔNG NHẬN ĐẶC QUYỀN** — không phải bất đối xứng
lén: không đặc quyền nào trong bốn cái có kênh phía bot (bot không mở Bảng điện
tử, không có đồng hồ, đọc thẳng trạng thái map). Cho bot chọn là để icon con
đường có gì để hiện ở bàn toàn bot; khai thẳng đó là con đường TUYÊN BỐ, không
phải con đường nó theo đuổi.

**Cổng lật cả cụm (founder chọn phương án B):** xong nối dây ⇒ đo lại G1–G4 ba cỡ
⇒ trình số ⇒ founder duyệt ⇒ mới đổi `HOLDEM_BALANCE_VERSION` sang v32.
**ĐÃ ĐO 15/08 — số ở §10.**

---

## 2. BẢN SẮC CỠ MAP — cung tín dụng làm nền cho kỳ ngộ

Founder thay ba lựa chọn của agent bằng ý hay hơn (§1), nhưng bản sắc map vẫn
cần — vì **kỳ ngộ phải có nội dung để điều hướng qua**. Hai thứ là một thiết kế
nhìn từ hai phía: cung cho nhiệm vụ nội dung, nhiệm vụ cho cung sức nặng.

Engine đã có sẵn máy trạng thái chu kỳ tín dụng (D43): tiền rẻ → tăng → bong
bóng → sức căng → sập → hồi. Nó đang chạy nhưng **cỡ map không dùng nó để kể
chuyện**.

| Cỡ | Bản sắc | Nội dung cung | Kỳ ngộ |
|---|---|---|---|
| **8 — NHANH** | một mảnh thời tiết, nhiễu cao | không đủ dài cho trọn cung | **KHÔNG** (xem §4) |
| **12 — CHUẨN** | một cú xoay chiều | kỹ năng = bắt điểm ngoặt | có |
| **16 — DÀI** | trọn cung | bong bóng phồng → sập → gây dựng lại | có, nhiều mốc hơn |

Đây đúng bản sắc D31 đặt từ 26/07 (*"8 lướt sóng · 16 dài hạn"*) mà **chưa bao
giờ được xây** — nó chỉ tồn tại dưới dạng số ô.

**Chương hồi có tên** (gần như thuần trình bày, rẻ nhất cả cụm): gọi tên đoạn
đang chơi — **MÙA TIỀN RẺ → BONG BÓNG PHỒNG → SÓNG GIÓ → GẦY DỰNG LẠI**. Biến
16 vòng giống nhau thành một câu chuyện có chương, và **tự đẻ ra mục tiêu ngắn
hạn mà không cần một danh sách nào** ("trụ qua sóng gió"). Đây là món chạm phàn
nàn #2 với chi phí thấp nhất.

⚠ Đổi cách sinh map ⇒ **cần cổng `balance_version`** và **phải đo lại G1–G4** ở
cả ba cỡ. D83 vừa trả giá cho đúng việc bỏ qua điều này.

---

## 3. ⏸ VÒNG LẶP KẺ DẪN ĐẦU — HOÃN, note để mai

**Founder chốt:** *"Để riêng nhưng cứ note lại trong file dự án để mai cải tiến.
Hiện tại chỉ là build kiến trúc, không phải xây dựng"*.

**Vấn đề (D40 §4, treo từ 27/07):** Quỹ vòng chia theo hạng ⇒ hạng cao nhận nhiều
tiền mặt ⇒ mua nhiều hơn ⇒ càng dẫn. Trận ngã ngũ từ vòng 3.

**Hướng đã đề xuất và chưa ai đo:** Quỹ vòng thưởng **LEO HẠNG** thay vì thưởng
**ĐỨNG ĐẦU** — kẻ giữ #1 ăn ít hơn kẻ nhảy #5→#2. Kèm điều kiện: không được
thưởng phương sai (trèo hạng bằng ĐÚNG, không bằng all-in).

⚠ Chạm **tham số kinh tế** (A8.2) ⇒ cần founder duyệt số, và đổi phân bố thứ hạng
⇒ phải đo lại G1–G4. Đáng một phiên riêng có đo lường.

⭐ **Nhưng ý §1 của founder tự làm dịu nó một phần:** khi "nhiều tiền nhất" không
còn là thứ **duy nhất** để thắng, kẻ dẫn đầu NAV không sở hữu cả trận — vẫn còn
làn khác để về đích. Thành thật về giới hạn: nó giảm cái **đau** của snowball,
không sửa cái **gốc** (NAV vẫn cuộn). Nên D40 §4 vẫn phải làm.

---

## 4. ⭐ HAI BỘ DATA, KHÔNG TRỘN — và đây là phần thiết kế đáng giá nhất

Founder nhận ra cú chọn nhiệm vụ *"cũng giúp thu data hành vi"*. Đúng, và nó giải
sạch một nút mà D69 để lại (*"nhiệm vụ ép hành vi nên trộn vào là phá dữ liệu
khẩu vị"* → khuyến nghị hồi đó là **chế độ RIÊNG**).

| | **map 8 — NHANH** | **map 12/16 — có kỳ ngộ** |
|---|---|---|
| vai | mẫu **ĐỐI CHỨNG** | mẫu **CÓ KÍCH THÍCH** |
| khẩu vị rủi ro | **TỰ NHIÊN, sạch** | bị nhiễu, nhưng **CÓ NHÃN** |
| đo được thêm | — | chọn nhiệm vụ nào ⇒ khuynh hướng CÓ NHÃN |

Hai điều làm cách này tốt hơn cả hai phương án cũ:

1. **map 8 giữ thuần** ⇒ nền đối chứng của D69 còn nguyên. Cột khẩu vị rủi ro
   sạch vẫn tồn tại.
2. **Nhiễu ở map lớn CÓ NHÃN** ⇒ tách ra được khi phân tích. `events` ghi rõ:
   bộ nhiệm vụ được mời, cái được chọn, hoàn thành hay không. So được người chọn
   "Nhà tiên tri" với người chọn "Qua trọn cung" — một trục hành vi mới mà bản
   thuần **không bao giờ đo được**, vì không ai bị hỏi.

⚠ Điều kiện cứng: **`action_type` mới cho kỳ ngộ phải vào migration CÙNG COMMIT**
với code ghi nó. D79 đã trả giá cho `hd_dat_short` — DB từ chối loại chưa khai và
cú INSERT nằm trong transaction nộp vòng, nên **cả cú chốt vòng hỏng**, không chỉ
mất một dòng log.

---

## 5. CẢM GIÁC HOÀN THÀNH — founder chốt CẢ HAI

### 5.1. Dấu mốc kỹ năng — ghi nhận VỀ SAU

Ghi nhận *sau khi* chơi, không kê trước: "độ chuẩn của bạn đang lên", "3 vòng
liền đọc đúng hướng", "cắt lỗ trước cú sập". Vì không có danh sách trước, nó
**không thể lái hành vi** — đó là toàn bộ lý do nó tồn tại song song với §1.

⚠ Lằn ranh y hệt §1.2: **khen KỸ NĂNG** (độ chuẩn, đọc đúng), **không khen TƯ
THẾ RỦI RO** (đếm all-in, đếm mã đang giữ).
⚠ Điểm yếu thật, khai thẳng: nó **không tạo mong đợi**. Một mình nó không kéo
được người quay lại — nên phải đi cùng §5.2.

### 5.2. Thử thách hôm nay — một bàn CHUNG cho cả ngày

Một map hôm nay ai cũng chơi; xem **phân vị** của mình so với cả sân.

Bốn cái lợi: lý do hôm nay ≠ hôm qua (phàn nàn #3) · một thứ để hoàn thành mỗi
ngày (#2) · so kè mà không đẻ acc ảo · và **data controlled**: cùng một kích
thích cho mọi người ⇒ so khẩu vị rủi ro trong điều kiện kiểm soát.

⚠ Bắt buộc theo D32: hiện **PHÂN VỊ** cho mọi người, không top-N (một bảng
top-100 nói với 99% người chơi rằng "bạn không có ở đây"). D32 đã BÁC "bảng riêng
cho người mới" (mời gọi tài khoản phụ) và BÁC "chuẩn hoá theo % tăng trưởng" (dạy
all-in) — **đọc D32 trước khi chạm bất kỳ bảng xếp hạng nào**.

---

## 6. THỨ TỰ THI CÔNG ĐỀ XUẤT

| # | Món | Đụng engine? | Vì sao ở đây |
|---|---|---|---|
| 1 | Chương hồi có tên (§2) | không (đọc trạng thái có sẵn) | rẻ nhất, cảm được ngay, không rủi ro |
| 2 | Bản sắc cỡ map (§2) | **có** — cổng version + đo lại G1–G4 | làm §1 và §3 có nội dung |
| 3 | Kỳ ngộ trong trận (§1) | **có** — + migration action_type | trục chính; cần §2 làm nền |
| 4 | Dấu mốc kỹ năng (§5.1) | không | thuần quan sát |
| 5 | Thử thách hôm nay (§5.2) | không engine, cần bảng mới | lực kéo mạnh nhất, nhưng phụ thuộc §1–2 |
| ⏸ | Phá snowball (§3) | **có** + tham số kinh tế | HOÃN theo founder — phiên riêng, có đo |

**Lý lẽ thứ tự:** làm §1 trước §2 thì kỳ ngộ không có cung nào để điều hướng qua,
và nhiệm vụ sẽ tụt xuống thành quest chung chung. Làm §2 trước thì mỗi nhiệm vụ
có một đoạn cung cụ thể để nói về.

---

## 7. CÒN NỢ SỐ — ĐÃ TRẢ GẦN HẾT 15/08 (xem §1.4 và D86)

1. ~~Vòng nào là kỳ ngộ~~ → **12: v7 · 16: v6+v12 · 8: không** (§1.4).
2. ~~Bao nhiêu nhiệm vụ mỗi lần mời~~ → **3 trong 4** (§1.4).
3. ~~Ngưỡng hoàn thành~~ → chốt theo nhiệm vụ (§1.4); dải mục tiêu 40–55%.
   ⚠ RIÊNG ngưỡng Brier của TAY CÂN: chưa chốt số.
4. ~~Độ mạnh đặc quyền~~ → bộ mới ở §1.4. ⚠ RIÊNG số giây THẺ GIỜ (+8s?) chưa chốt.
5. Hệ số Quỹ vòng theo leo hạng (§3) — vẫn chờ, phiên riêng.

## 8. MỞ KHOÁ THEO TRẬN (founder chốt 15/08)

Gate đếm **trận HOÀN THÀNH** (`holdem_results`) — không đếm trận mở ra (D62:
105 bỏ dở / 50 xong ⇒ đếm trận mở là farm được bằng vào-rồi-thoát).

| Mở | Điều kiện | Ghi chú |
|---|---|---|
| map 8 | tự do | cửa vào, không chặn ai |
| map 12 | **3 trận xong** | ~25 phút chơi — mở đúng lúc "thèm cái mới" |
| khẩu vị rủi ro | **5 trận xong** | số founder tự đặt |
| map 16 | **8 trận xong** | đã quen nhịp dài của map 12 |

⭐ Hệ quả lớn hơn con số: cỡ map từ CÀI ĐẶT thành PHẦN THƯỞNG — có mốc kế tiếp
nhìn thấy được từ trận đầu (chạm thẳng phàn nàn #3).
⭐ Khoá khẩu vị 5 trận là CÁI LỢI DATA: 5 trận đầu của mọi người cùng hệ số PnL
(`can_bang` 1.0×) ⇒ mẫu đối chứng sạch; cú CHỌN ở trận 6 thành tín hiệu có
trước/sau để đối chiếu.
⚠ Level ĐÃ CÓ (config/progression.ts, 20 cấp, XP suy-ra-khi-đọc, đo KINH
NGHIỆM — Bậc Brier đo KỸ NĂNG). Gate KHÔNG đi bằng Level: Level trộn cả hoạt
động chợ dự báo, "chơi kèo để mở map" là câu vô lý với người chơi. Đi bằng số
trận xong — đọc thẳng ra miệng được ("còn 2 trận nữa").
⚠ Gate không cứu người bỏ ở phút đầu (D62: 66/90 bỏ trong phút 1) — họ không
tới trận 3. Vấn đề 60 giây đầu là việc KHÁC, còn nguyên.

## 9. BỐI CẢNH D86 — cụm này là canh bạc duy nhất

15/08 founder chốt **đóng băng chợ dự báo, dồn hết vào Đấu trường** (số liệu và
toàn văn ở nhật ký D86). Hệ quả cho file này: cụm kỳ ngộ/động lực là canh bạc
DUY NHẤT nhắm vào cái chết #1/#2 (không đủ vui / quá khó) — ship nó, đo trên
nhóm nhỏ hiện có, rồi DỪNG thêm tính năng cho tới khi cổng pháp lý (A10) mở và
n vượt ~50.

⚠ Và một món nợ ĐO, không phải nợ số: **§2 đổi cách sinh map ⇒ mọi số G1–G4 phải
đo lại ở cả ba cỡ**. Đừng lặp lại D83.

---

## 10. SỐ ĐO G1–G4 (15/08) — VÀ MỘT LỖI THƯỚC PHẢI ĐỌC TRƯỚC

### 10.1. ⚠⚠ ĐỌC CÁI NÀY TRƯỚC KHI ĐỌC BẤT KỲ SỐ NÀO

**Bàn đo `scripts/holdem_montecarlo.ts` vẫn còn nguyên lỗi D83 cho tới hôm nay.**
Commit của D83 (`734cc81`, 11/08) viết trọn một đoạn chú thích *"CỠ MAP ĐI QUA
`taoTran`, KHÔNG BAO GIỜ SINH MAP LẦN THỨ HAI (sửa 11/08)"* — **nhưng để nguyên
dòng code**: `taoTran(...)` vẫn gọi ba tham số (không `soO`), và
`if (CO_MAP !== MAP_SIZE) st = { ...st, map: sinhMap(seed, CO_MAP) }` vẫn đứng
ngay dưới đoạn chú thích ấy.

⇒ Từ 11/08 tới 15/08 file **KHAI đã sửa trong khi chưa sửa**. Mọi số G1–G4 đo ở
map 12/16 trong quãng đó — **gồm cả bảng "G1 xanh khắp nơi · G4 xanh thêm map 12"
của chính D83** — vẫn đo một tấm map TẮT HẾT cổng hành vi. Ô map 8 thoát vì
`CO_MAP === MAP_SIZE` nên dòng ghi đè không chạy.

**Đo A/B cùng ngày, cùng seed, chỉ khác một dòng bàn đo (12.000 trận · bàn 5):**

|  | bàn đo HỎNG | bàn đo ĐÃ SỬA |
|---|---|---|
| map 12 · G1 | ✗ Tất tay 31,5% cách á quân **8,1** | ✓ 29,3% cách **1,9** |
| map 12 · G4 | ✗ hoài-nghi **3,00** vs 2,77 vs 2,81 | ✓ **2,63** < 2,72 < 3,44 |
| map 16 · G4 | ✗ hoài-nghi **3,00** vs 2,74 vs 2,84 | ✓ **2,56** < 2,61 < 3,43 |

⭐ **Con số `3,00` chằn chặn là DẤU TAY của lỗi thước**, không phải một kết quả:
trên tấm map không có v28, bot hoài-nghi chiết khấu một thứ tin giả KHÔNG TỒN
TẠI, nên nó rơi đúng vào hạng trung tính của bàn 5 ghế. Thấy `3,00` tròn ở G4 thì
đừng đọc nó thành "hoài nghi vô dụng" — đi kiểm bàn đo trước.

⇒ **"G4 đỏ ở map lớn" KHÔNG phải nợ của trò. Nó là lần thứ BA của cùng một lỗi
dụng cụ**, và nó tan khi thước được sửa. Khoá lại bằng
`tests/gate_dung_map.test.ts` (tiêm lỗi ngược: dựng lại dòng cũ ⇒ đỏ đúng bài).

⚠ Bài học nằm TRÊN bài học của D83: **một chú thích tuyên bố "đã sửa" nguy hiểm
hơn không có chú thích nào** — nó làm người sau thôi kiểm. Nên nó phải được khoá
bằng TEST, không bằng chữ.

### 10.2. Số trên bàn đo ĐÃ SỬA (12.000 trận · bàn 5 ghế)

| cỡ map | phiên bản | G1 | G2 | G3 | G4 |
|---|---|---|---|---|---|
| 8 | v31 | ✓ 33,2% / cách 5,6 | ✓ 1,88 < 2,82 < 3,92 | ✓ 4,26 | ✓ 2,72 < 2,81 < 3,33 |
| 8 | **v32** | ✓ 33,2% / cách 5,6 | ✓ 1,88 < 2,82 < 3,92 | ✓ 4,26 | ✓ 2,72 < 2,81 < 3,33 |
| 12 | v31 | ✓ 28,8% / cách 0,7 | ✓ 1,85 < 2,82 < 4,00 | ✓ 4,43 | ✓ 2,66 < 2,71 < 3,39 |
| 12 | **v32** | ✓ 29,3% / cách 1,9 | ✓ 1,88 < 2,81 < 4,02 | ✓ 4,45 | ✓ 2,63 < 2,72 < 3,44 |
| 16 | v31 | ✓ 29,2% / cách 3,2 | ✓ 1,80 < 2,83 < 4,09 | ✓ 4,43 | ✓ 2,59 < 2,61 < 3,40 |
| 16 | **v32** | ✓ 28,7% / cách 3,4 | ✓ 1,83 < 2,83 < 4,09 | ✓ 4,42 | ✓ 2,56 < 2,61 < 3,43 |

**BỐN GATE XANH Ở CẢ BA CỠ MAP, CẢ HAI PHIÊN BẢN.**

⭐ **map 8 ra số GIỐNG HỆT nhau tới từng chữ số giữa v31 và v32** — đúng thiết kế:
map 8 là mẫu ĐỐI CHỨNG (không bản sắc, không kỳ ngộ), nên đây là bằng chứng đo
được rằng cổng v32 không rò sang ô đối chứng. Nếu ô này lệch dù chỉ 0,01 thì
`BAN_SAC_MAP` đang chạm map 8 và cả §4 (hai bộ data, không trộn) hỏng theo.

⚠ **Kỳ ngộ KHÔNG dịch gate, và đó là điều đã dự kiến:** bàn đo toàn bot, mà bot
không nhận đặc quyền nào (§1bis). Chênh lệch v31↔v32 ở map 12/16 là của **bản
sắc map**, không phải của kỳ ngộ. Muốn đo kỳ ngộ thì phải đo NGƯỜI THẬT — dải
hoàn thành mục tiêu 40–55% (§1.4) là số PLAYTEST-TUNE, chưa ai đo được.

⚠ **CÒN NỢ SỐ, chưa ai chốt (A8.2):** ngưỡng Brier của TAY CÂN (đang tạm
`TAY_CAN_BRIER_BP = 4500`) · số giây THẺ GIỜ (đang tạm `+8s`). Cả hai đánh dấu
PLAYTEST-TUNE trong `config/holdem.ts`.

### 10.3. Cổng lật — CHƯA LẬT, chờ founder

`HOLDEM_BALANCE_VERSION` vẫn là `balance-v31-quycogian`. Số đã có, bốn gate xanh
ở cả ba cỡ; **đổi sang `balance-v32-bansac` là cú bấm của founder** (A8.2).

---

## 11. NÂNG CẤP KỲ NGỘ — CHỐT CƠ CHẾ, CHƯA BUILD (16/08)

**Founder:** *"cho nó sáng tạo hơn tý và tăng giá trị của data thu được nhưng phải
tạo cảm giác hoàn thành / lựa chọn khác biệt cho người chơi ngay trong trận."*
Rồi chốt cách làm: **chốt cơ chế trên giấy trước, chưa build** (nếp D85).

Nguồn: 15 đề xuất từ 5 góc nhìn độc lập (data · game design · "lựa chọn phải khác
nhau" · tái dùng cơ chế có sẵn · kẻ phá hoại đi trước).
⚠ Vòng phản biện CHẠM TRẦN PHIÊN: 12/21 agent chết vì quota, chỉ 4/15 đề xuất được
phản biện thật, agent tổng hợp không chạy. Nên phần dưới là tổng hợp TAY.
**Không đề xuất nào ở đây đã qua đủ vòng kiểm — đọc như bản nháp CÓ CĂN CỨ, không
phải kết luận.**

### 11.1. ⚠⚠ HAI THỨ ĐO ĐƯỢC KHI KIỂM — quan trọng hơn cả 15 ý tưởng

**(1) CỬA SỔ DÙNG ĐẶC QUYỀN GẦN NHƯ KHÔNG TỒN TẠI.**
Chạy `chamNhiemVu` ở ca **HOÀN HẢO** (đọc đúng MỌI vòng kể từ vòng kỳ ngộ, bàn 6
mã, ôm đúng mã tốt nhất):

```
map 12 · v7  · runway 6    la_ban   xong sớm nhất v10 ⇒ đặc quyền từ v11 ⇒ 2 vòng [khong,khong]
                           ve_song  xong sớm nhất v9  ⇒ từ v10 ⇒ 3 vòng [tai_san,khong,khong]
                           bat_nhip xong sớm nhất v9  ⇒ từ v10 ⇒ 3 vòng
                           tay_can  xong sớm nhất v10 ⇒ từ v11 ⇒ 2 vòng [khong,khong]
map 16 · v6  · runway 11   sớm nhất v11–v12 ⇒ từ v12–v13 ⇒ 4–5 vòng
map 16 · v12 · runway 5    MỌI nhiệm vụ: từ v15 ⇒ 2 vòng [khong,khong]
```

⇒ Người chơi **hoàn hảo** trên map 12 nhận đặc quyền vào đúng hai vòng cuối, mà
hai vòng đó là `khong` (`SO_VONG_CUOI_KHONG_SHOP = 2`). Cộng dải mục tiêu hoàn
thành **40–55%**: **quá nửa số người chơi không bao giờ nhận gì cả.** Với họ, kỳ
ngộ là "bấm một lá ở vòng 7 rồi không có gì xảy ra nữa".

⚠ Đây KHÔNG phải lỗi cài đặt — `dacQuyenKyNgo` trả `xong_o_vong + 1` đúng lý lẽ đã
ghi (kết quả vòng V chỉ biết SAU khi V chốt). Nó là **lỗi cấu trúc của thiết kế
"một lần trả công ở cuối"**, và nó chính là thứ founder đang mô tả.

**(2) KẺ VƯỢT SÓNG ĐANG CHẠM LẰN RANH §1.2 — trong code ĐÃ SHIP ở cổng v32.**

```
thangChiSo(ôm đúng mã tốt nhất) → true
thangChiSo(dàn ĐỀU 6 mã)        → false      ← không bao giờ đạt
```

`thangChiSo` so danh mục với **trung bình lợi suất của MỌI mã trên bàn**, nên danh
mục dàn đều = chỉ số ⇒ vĩnh viễn không thắng. Muốn xong nhiệm vụ thì phải lệch
khỏi dàn đều, và cách chắc ăn nhất là dồn vốn.

Áp đúng phép thử §1.2 — *"cái này nói PHẢI PHƠI RA BAO NHIÊU, hay chỉ nói HÃY ĐỌC
ĐÚNG?"* — lá này nói **cả hai**. Nó không ép all-in, nhưng gradient thưởng chỉ về
một phía: **càng ít dàn đều càng dễ đạt**. Mà "đa dạng hoá" là đúng một trong ba
trục §1.2 cấm chạm.

⚠ Khai thẳng phần chưa chắc: có thể đọc đây là "thưởng cho CHỌN ĐÚNG MÃ" (sạch)
chứ không phải "thưởng cho TẬP TRUNG" (bẩn). Hai cách đọc cùng khớp dữ liệu hôm
nay. Nhưng §1.2 nói phân loại **SAI KIỂU AN TOÀN** là coi nó bẩn.

✅ **ĐÃ XỬ 16/08 THEO ĐƯỜNG (a)** — founder lệnh "xây đi, phục vụ mục tiêu ban
đầu" sau khi đọc ba đường; (a) là đường đứng đầu khuyến nghị. Định nghĩa mới
(`soVoiCho`): so TẬP MÃ GIỮ với TẬP MÃ LOẠI, trung bình ĐỀU (không trọng số
vốn — cỡ vị thế không đổi được kết quả, có test khoá); vế giữ tính theo
CHIỀU vị thế (khống nhận dấu ngược); ôm CẢ BÀN ⇒ null (chọn tất cả = không
chọn, tiền lệ D67). Dàn đều mà đọc đúng VẪN ĐẠT — gradient "bớt đa dạng để
dễ đạt" đã chết. v32 chưa có trận thật nào (cổng chưa lật) nên sửa ngay trong
v32, không cần cổng mới.

*(Ba đường đã trình, giữ để truy vết:)*
· **(a)** Đổi mốc so sánh sao cho **đọc đúng mà vẫn dàn đều thì vẫn đạt được** —
  vd so với chỉ số của các mã ĐÃ LOẠI khỏi danh mục, hoặc so với chính danh mục
  vòng trước. Giữ được tên lá, sửa được gradient.
· **(b)** **Thay hẳn** KẺ VƯỢT SÓNG bằng một nhiệm vụ khác trên cùng trục "tương
  đối so với chợ" mà không đòi vượt trung bình.
· **(c)** Giữ nguyên, khai nhãn, tách khi phân tích. ⭐ KHÔNG khuyến nghị: §1.2 gọi
  lằn ranh này là chỗ "bước qua là giết sản phẩm", không phải chỗ đánh đổi.

### 11.2. XƯƠNG SỐNG ĐỀ XUẤT — "ỐNG KÍNH CON ĐƯỜNG" (rẻ nhất, trúng cả ba)

**Một câu:** con đường thôi là một điều kiện chấm điểm ở cuối, nó thành **CÁCH
NHÌN bàn đấu**, có hiệu lực từ giây chốt.

**Luật tất định:** từ vòng kỳ ngộ V trở đi (không cần đạt gì), khối kết quả mỗi
vòng thêm **ĐÚNG MỘT DÒNG** do con đường quyết định:

| Con đường | Dòng thêm | Lấy từ đâu |
|---|---|---|
| LA BÀN | ĐÚNG HƯỚNG — % phần vốn triển khai nằm đúng phía | `dungHuong` đang tính `dung/tong` rồi **vứt**, chỉ trả boolean |
| TAY CÂN | ĐỘ CHUẨN — Brier vòng | `KetQuaGhe.brier`, đã có và đã lưu (`hd_brier_vong`) |
| KẺ VƯỢT SÓNG | SO VỚI CHỢ — lợi suất danh mục − chỉ số (bp) | `thangChiSo` đang tính `loi/von` và `chiSo` rồi **vứt** |
| KẺ BẮT NHỊP | PHA — ô vừa lật có phải ô đổi pha không | `doiPhaCuaMap`, đã có |

⭐ **Không một bit thông tin MỚI nào được cấp.** Cả bốn dòng đều **HỒI CỐ** về vòng
vừa chốt, dựng từ số engine đã tính. Nên:
· sạch **D67** — không thêm nước đi, chỉ đổi THÔNG TIN của ba nước cũ;
· sạch **§1.3** — không lá chiến thuật nào soi lại quá khứ của chính bạn (mọi lá
  đều nói về tương lai), nên không đặc quyền nào thành thừa;
· sạch **A3.1** — nói về CHÍNH MÌNH, không lộ gì của người khác.

**Vì sao trúng cả ba mục tiêu founder:**
1. *Khác biệt ngay trong trận* — hai người cùng bàn, cùng ô, sau mỗi vòng đọc hai
   con số khác nhau. Lựa chọn đổi **cách chơi**, không chỉ đổi bảng điểm.
2. *Cảm giác hoàn thành* — dòng số chạy mỗi vòng là phản hồi liên tục, thay cho
   một lần trả công có ~45% khả năng không bao giờ tới (§11.1).
3. *Data* — kỳ ngộ thành **thí nghiệm LOẠI PHẢN HỒI CÓ NHÃN**: bốn con đường =
   bốn loại phản hồi khác bản chất (hướng · độ chuẩn · tương đối · cấu trúc), nhãn
   đã nằm sẵn ở `hd_chon_ky_ngo.chon`. Đo bằng cột ĐANG GHI, không migration.

⚠ **RÌA §1.2, phải khai:** dòng SO VỚI CHỢ (và nhẹ hơn, Brier sống) có thể hối
thúc dồn vốn — Brier nhỏ nhất khi dồn hết vào mã thắng (A5.4). **Chốt chặn bắt
buộc:** vòng toàn tiền mặt hiện `—`, **không hiện số âm**; và dòng SO VỚI CHỢ chỉ
ship SAU khi §11.1(2) được xử.

**Chỗ sống trong code:** `dungHuong`/`thangChiSo` (`server/holdem/ky_ngo.ts`) trả
thêm phần định lượng thay vì chỉ boolean · `replay` đã gom `soLieuKyNgo` cho MỌI
vòng nên không cần đường ống mới · một trường trong `ket_qua_vong` của `/rounds` ·
một dòng trong `ChainReveal`.

### 11.3. GHÉP: BỘ MỜI SINH THEO HỒI (rẻ, trục data mới)

Hôm nay `boNhiemVuMoi(seed, vong)` là phép chia lấy dư **mù bối cảnh**: người đang
giữa BONG BÓNG PHỒNG và người đang giữa SÓNG GIÓ nhận y hệt một bộ.
⇒ Rút bộ 3 theo **CHƯƠNG HỒI** đang chơi (`lib/chuong_hoi.ts` đã tính sẵn, chỉ cần
dời luật xuống server): hồi nào làm một nhiệm vụ quá dễ hoặc bất khả thì chính
nhiệm vụ đó là món bị loại.

**Trục data mới:** *"chọn gì KHI đang ở chế độ thị trường nào"* — khuynh hướng
đọc-thị-trường CÓ ĐIỀU KIỆN. `hd_chon_ky_ngo.value_json` thêm khoá `hoi`. Không
action_type mới ⇒ **không migration**.

⚠ **RỦI RO CHÍNH, phải đo TRƯỚC khi gõ bảng:** nếu một hồi hay rơi đúng vòng kỳ
ngộ thì nhiệm vụ bị nó loại sẽ hiếm được mời ⇒ cột data của nhiệm vụ đó mỏng đi.
Với ~150 người thì mỏng là chết. Quét phân bố hồi tại vòng kỳ ngộ trên vài nghìn
seed trước khi chốt.

### 11.4. GIỮ Ở CỔNG — "BẬC TỰ TIN" (giá trị data cao nhất, rủi ro sâu nhất)

**Bốn trong năm góc nhìn tự phát minh ra cùng một thứ** (BẬC TỰ TIN · LỜI KHAI ·
TUYÊN BỐ MỨC · LỜI THỀ). Tín hiệu mạnh, nên ghi đủ:

Người chơi tự đặt vạch NHẸ / CHUẨN / NẶNG ngay trên lá nhiệm vụ. **Không thêm cú
bấm** (R6 sạch): chạm lá = vạch CHUẨN mặc định; đổi vạch là một chạm TỰ NGUYỆN.
Vạch chỉ dịch NGƯỠNG ĐÚNG ĐẮN, không dịch gì khác.

⇒ Đo được **TỰ TIN THÁI QUÁ** (khoảng cách giữa mức TỰ KHAI trước khi biết kết quả
và mức THẬT SỰ đạt) — chỉ số hành vi tài chính đắt nhất app chưa từng chạm, và nó
khác hẳn Brier: Brier đo hiệu chỉnh về THỊ TRƯỜNG, cái này đo hiệu chỉnh về CHÍNH
MÌNH.

⚠⚠ **VÌ SAO CHƯA LÀM — hai rủi ro, cái đầu giết chính phép đo:**
1. Nếu vạch cao thưởng nặng thì người **GIỎI** chọn vạch cao vì nó ĐÁNG, không phải
   vì họ tự tin ⇒ số đo ra là KỸ NĂNG chứ không phải TỰ TIN, **mà nó vẫn trông rất
   hợp lý** (đúng lớp lỗi D62: thước nói sai tệ hơn thước im). Muốn sạch thì độ
   mạnh đặc quyền phải gần như KHÔNG đổi theo vạch — nhưng lúc đó vạch cao hết lý
   do tồn tại. **Đây là mâu thuẫn thật, chưa có lời giải.**
2. Đuổi theo vạch cao chảy sang rủi ro TIỀN, **cả hai chiều**: LA BÀN khắc nghiệt
   đẩy người ta chờ đợi (phơi nhiễm ÍT đi), KẺ VƯỢT SÓNG khắc nghiệt đẩy đánh tập
   trung (NHIỀU lên). Vế chống lách 50% runway chỉ chặn phần thô.

### 11.5. ĐÃ LOẠI (ghi lý do để không ai đi lại)

· **BẢNG CON ĐƯỜNG** (làn thắng thứ hai hiện trong trận) — chạm §1.2 nặng nhất:
  một cuộc đua NHÌN THẤY ĐƯỢC trên thước "thắng chỉ số" đẩy thẳng vào tập trung
  danh mục. Và §3 nói phá snowball đang HOÃN theo founder.
· **CON ĐƯỜNG ĐÔNG THÌ HẸP** (chen chúc trên kỳ ngộ) — ý data hay nhất cả đợt (đo
  bầy đàn trong một quyết định KHÔNG có đồng nào trong đó), nhưng chính tác giả
  khai: chết nếu bot không chọn theo tính cách, vì lúc đó phân bố không đoán được
  và cú chọn thành xổ số. Và nó đổi cân bằng mà **gate G1–G4 không bắt được** (bàn
  đo toàn bot, bot không nhận đặc quyền — §1bis).
· **GỌI TÊN** (gọi tên mã sẽ dẫn bàn) — trục "khoảng cách NÓI–LÀM" rất đáng, nhưng
  nó THÊM MỘT QUYẾT ĐỊNH ⇒ thêm chi phí HIỂU, đúng thứ D67 nói làm khó HIỂU chứ
  không làm khó GIỎI. Để dành cho mùa có thời gian dạy.
· **NGÃ BA THỨ HAI / KỲ NGỘ NỐI KỲ NGỘ** — trục "kiên trì vs thăm dò sau một kết
  quả" rất mạnh, nhưng chỉ sống ở map 16, và chính tác giả khai rủi ro: nếu GIỮ
  mang theo toàn bộ tiến độ thì giữ luôn trội (~90%) và cú chọn thành trang trí.
  Xét lại sau khi có cohort thật.

### 11.6. SỐ CHỜ FOUNDER (A8.2 — agent không tự chốt)

1. §11.1(2) — xử KẺ VƯỢT SÓNG theo đường (a), (b) hay (c).
2. §11.1(1) — có đổi sang "trả công theo NẤC / tạm ứng" không, hay ống kính là đủ?
   ⚠ Ống kính **KHÔNG sửa** được việc >45% người không nhận đặc quyền — nó làm việc
   đó bớt đau, không làm nó biến mất.
3. Ngưỡng Brier TAY CÂN (tạm 4500bp) · số giây THẺ GIỜ (tạm +8s) — **nợ cũ từ §7**.
4. Bảng "hồi nào loại nhiệm vụ nào" của §11.3, sau khi có phân bố đo được.

### 11.7. THỨ TỰ THI CÔNG (khi founder cho phép build)

| # | Món | Giá | Trạng thái (16/08) |
|---|---|---|---|
| 1 | Xử KẺ VƯỢT SÓNG (§11.1.2) | rẻ | ✅ XONG — `soVoiCho`, đường (a) |
| 2 | ỐNG KÍNH, ba dòng sạch trước | rẻ | ✅ XONG — `ongKinhVong` + `ket_qua_vong.ong_kinh` + dòng trong ChainReveal |
| 3 | Dòng SO VỚI CHỢ | rẻ | ✅ XONG — ship cùng (1) vì (1) đã xử xong gradient |
| 4 | Bộ mời theo hồi | vừa | ✅ XONG — `boNhiemVuTheoHoi` + `hoiTaiTran` + `hd_chon_ky_ngo.hoi`; phân bố đo ở `scripts/quet_hoi_ky_ngo.ts`, số ở §11.8 |
| ⏸ | BẬC TỰ TIN | vừa | VẪN Ở CỔNG — mâu thuẫn §11.4.1 chưa giải |

⚠ Món 2 và 3 **thuần quan sát, không đổi một chip nào** ⇒ không cần cổng
`balance_version` (tiền lệ Brier D67). Món 1 và 4 CÓ đổi luật chấm / lời mời ⇒
phải qua cổng và phải đo lại G1–G4 ba cỡ map.


### 11.8. SỐ ĐO PHÂN BỐ HỒI (16/08) — và một entry bị phép đo BÁC

Chạy `scripts/quet_hoi_ky_ngo.ts` (4.000 seed/cỡ, v32):

⚠⚠ **Bản đầu của bảng gán `song_gio` → loại TAY CÂN, và phép đo BÁC NGAY:**
sóng gió là hồi PHỔ BIẾN NHẤT tại vòng kỳ ngộ (25–46% tuỳ cỡ) ⇒ tay_can tụt
còn **49,3%** được mời ở map 12 — thủng sàn 50% mà chính §11.3 đặt ra. Mà về
nội dung, sóng gió là hồi GIÀU CẤU TRÚC nhất (phân tán cao, đổi pha dày):
không nhiệm vụ nào thành quá dễ/bất khả ở đó. ⇒ Bỏ entry, để phép xoay.
**Luật rút ra: HỒI PHỔ BIẾN PHẢI MỜI ĐA DẠNG** — entry cố định chỉ dành cho
hồi làm một nhiệm vụ suy biến THẬT, và tần suất hồi là một nửa quyết định.

**Bảng đã chốt (bong_bong→la_ban · tien_re→bat_nhip · gay_dung→ve_song),
tỷ lệ ĐƯỢC MỜI sau sửa — không ai dưới sàn:**

| | map 12 v7 | map 16 v6 | map 16 v12 |
|---|---|---|---|
| la_ban | 75,3% | 81,0% | 83,8% |
| tay_can | 84,5% | 85,5% | 85,0% |
| ve_song | 69,8% | 68,7% | 77,5% |
| bat_nhip | 70,5% | 64,8% | 53,7% |

⚠ `bat_nhip` ở map 16 v12 (53,7%) là cận sàn — vì `tien_re` chiếm 31,6% tại
đó. Chấp nhận được (trên sàn), nhưng founder đổi bất kỳ entry nào thì PHẢI
chạy lại script trước khi tin.

## 12. v32 ĐÃ LẬT (16/08 tối) — VÀ CẢM GIÁC "CON ĐƯỜNG KHÁC BIỆT" CHƯA CÓ

**Founder: *"Mở kỳ ngộ cho các bàn đã chốt đi, tiện xem luôn UI-UX nó xem đã tạo
cảm giác 'con đường khác biệt' chưa."*** ⇒ `HOLDEM_BALANCE_VERSION =
'balance-v32-bansac'` (D94), API + web prod. Trận ≤ v31 replay nguyên; map 8
byte-hệt (đối chứng §4).

**Đo trên stack local, map 12, chơi tới vòng 7 (DOM, không ảnh — pane ẩn):**
- Khối KỲ NGỘ là một **panel chữ nằm giữa dòng chảy của bàn** ở y=328, cao
  410px trên trang 1.387px — dưới dải đối thủ, trên CHƯƠNG HỒI. Ba lá = ba nút
  102px, mỗi lá **bốn dòng chữ** (tên · mô tả nhiệm vụ · tên đặc quyền · mô tả
  đặc quyền), cỡ 10–14px, một icon 16px. Không có gì dừng lại: đồng hồ vòng
  vẫn chạy, shop vẫn bấm được, kỳ ngộ đứng như một hộp cấu hình.
- Chọn LA BÀN → chốt → **chip 18px** "LA BÀN 0/4 · cần có vị thế 0/3 vòng" ở
  đỉnh, và một dòng "ĐÚNG HƯỚNG —" trong khối kết quả (ống kính §11.7). Đúng
  cơ chế. Nhưng người chơi vừa "chọn con đường cho nửa trận còn lại" và thứ họ
  nhận về là một chip 18px.
- Đối chiếu khuôn TFT augment (thứ founder gọi tên từ đầu): trận **DỪNG**, màn
  **tối lại**, ba lá **to** có ART, lật/xoay khi chọn, đồng hồ riêng, ai cũng
  chọn cùng lúc, và sau đó con đường **tô màu** cả HUD (icon lớn cạnh tên, hiệu
  ứng khi nhiệm vụ nhích).

**Kết luận thẳng:** cơ chế ĐÚNG, cảm giác CHƯA. Kỳ ngộ hôm nay đọc như "một
lựa chọn nữa trong shop", không phải "một khoảnh khắc". Đây là lỗi TRÌNH BÀY,
không phải luật — không đụng cổng version, không đụng data.

**Đề xuất (chưa build, chờ founder):**
1. **KỲ NGỘ = LỚP PHỦ TOÀN MÀN** khi vào vòng kỳ ngộ (như shop D92 là lớp
   phủ): bàn tối, tiêu đề "KỲ NGỘ · HỒI SÓNG GIÓ" (chương hồi hiện tại — hồi
   quyết định bộ mời, §11.7 món 4, người chơi PHẢI thấy nó), ba lá bài cỡ lá
   chợ (art pixel: dùng bộ icon target/chart/bolt/candle phóng 4× kiểu
   PixelIcon, không đẻ art mới), mặt trước = TÊN + một câu nhiệm vụ; chạm =
   lá **lật** ra đặc quyền (pxLat sẵn có), chạm lần hai = chọn; **BỎ QUA** là
   nút thật, không giấu. Đồng hồ vòng vẫn là đồng hồ vòng (không thêm giờ —
   D90 cấm nới), nhưng lớp phủ hiện đồng hồ to.
2. **Con đường TÔ MÀU phần còn lại**: chip tiến độ thành **huy hiệu cạnh
   avatar ghế BẠN** (icon 16 + vạch tiến độ), nhích một nấc là loé (pxSang);
   dòng ống kính trong VÌ SAO **đậm màu con đường**; màn kết: khối "CON ĐƯỜNG:
   LA BÀN — xong ở v10" đứng cạnh HÔM NAY BẠN VỪA CHẠM (và lên THẺ KẾT TRẬN,
   xem `thiet-ke-de-xuat/gameplay/man-ket-de-khoe.md`).
3. Icon con đường trên avatar đối thủ (D86 bổ sung, A3.1 sau khi mình chốt) —
   đã nối; phóng từ 8px lên 16px cho thấy được.
Không cái nào đổi luật §1.2/§11; toàn bộ là lớp trình bày + hai test web.
