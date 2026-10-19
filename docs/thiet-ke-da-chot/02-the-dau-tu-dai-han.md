# 02 — THẺ CHIẾN THUẬT: ĐẦU TƯ DÀI HẠN (KHOÁ VỊ THẾ)

> **ĐÃ CHỐT 27/07 (founder). CHƯA CÓ DÒNG CODE NÀO.**

**Chỉ đạo founder, nguyên văn:**
> *"Về chức năng đầu tư dài hạn thì sao? Cho nó luôn thành 1 chiến thuật mới, cho phép
> bổ sung chức năng khóa vị thế cho tài sản đang sở hữu (Chọn, bao nhiêu cũng được)
> trong số round quy định, đổi lại không thể tái phân bổ vốn hay thoát hàng nhưng sẽ
> nhận được đặc quyền miễn nhiễm trượt giá cũng như ít biến động hơn trong sự kiện xấu
> cực đoan và hưởng lợi hơn trong sự kiện siêu tốt."*

---

## 1. NÓ THAY THẾ CÁI GÌ

Repo đã có `KHOA_TAI_SAN` (`config/holdem.ts:1999`) — "Khoá nắm giữ 2 vòng", hiện là
**một nút trong bảng QUẢN TRỊ VỐN**, ai cũng bấm được, khoá **đúng 1 mã**.

D-27/07 chuyển nó thành **THẺ CHIẾN THUẬT**. Ba hệ quả:

| | Trước | Sau |
|---|---|---|
| Ai dùng được | mọi người, miễn phí | chỉ người **chọn thẻ** (D34: vòng 2·3·4 ở map 8) |
| Khoá được mấy mã | đúng 1 | **bao nhiêu cũng được**, trong số mã đang sở hữu |
| Có cấp không | không | **có** — 1/2/3 bản = cấp 1/2/3 (D40 "săn chiến thuật") |

⇒ **Bảng QUẢN TRỊ VỐN mất luôn mục "KHOÁ NẮM GIỮ"** — một trong hai khối founder gọi là
*"thừa thãi… vô giá trị hiển thị"*. Nó không bị xoá, nó **về đúng chỗ**: một lựa chọn
phải đánh đổi để có, không phải một nút bày sẵn.

---

## 2. LUẬT

### 2.1. Đặt khoá

- Chỉ người **đang cầm thẻ Đầu Tư Dài Hạn** mới đặt được.
- Chọn **bất kỳ số mã nào đang sở hữu** (0 → tất cả). Khoá **cả vị thế** của mã đó,
  không khoá một phần.
- Khoá kéo dài **`SO_VONG` vòng liên tiếp**, tính cả vòng bật.
- Đặt ở pha giao dịch, có hiệu lực **ngay vòng đó**.

### 2.2. Cái mất — RA ĐƯỢC, NHƯNG ĐẮT

> ⚠ **ĐÍNH CHÍNH 27/07 — bản đầu của tôi viết "CẤM TUYỆT ĐỐI". Founder sửa:**
> *"không cấm hẳn cho giống ngoài đời nhưng phạt đắt."*

Trong chu kỳ khoá, với **mọi mã đang khoá**: mua thêm · bán bớt · bán hết · đảo sang mã
khác đều **bị chặn ở đường thường**. Muốn ra thì phải **BẺ KÈO**, và bẻ kèo thì trả giá
nặng: giữ nguyên `PHAT_BE_KEO_BP` + `GIAM_VON_SO_VONG` của cơ chế hiện có, nâng mức cho
tương xứng với đặc quyền mạnh hơn (§4).

**Vì sao "đắt" ĐÚNG HƠN "cấm" — và vì sao lo ngại ban đầu của tôi sai:**
Tôi từng lập luận *"một hình phạt tính được thì người chơi sẽ tính, và khoá thành một
quyền chọn có giá"*. Điều đó **đúng**, nhưng nó **không phải lỗi — nó chính là thứ cần
có**:
- Ngoài đời khoá vốn luôn ra được, chỉ là mất tiền: phí tất toán trước hạn, thuế phạt,
  bán tháo dưới giá. Cấm hẳn là bịa ra một ràng buộc không tồn tại trong nghề này.
- Về trò chơi: **cấm thì XOÁ một quyết định, đắt thì TẠO ra một quyết định.** Mỗi vòng
  bão, người khoá phải tự hỏi *"cơn này đủ nặng để ăn phạt chưa?"* — đúng loại phán
  đoán mà trò này muốn đo.

⇒ Mức phạt phải đặt sao cho bẻ kèo **thường là sai, thỉnh thoảng là đúng**. Đó là tiêu
chí cân bằng, không phải một con số đẹp: phạt ≤ tổng thưởng của chu kỳ thì ai cũng bẻ
mỗi lần ô xấu (khoá thành quyền chọn miễn phí); phạt quá nặng thì không ai bẻ và ta
quay về "cấm" bằng cửa sau.

Nút **BỎ** (01 §2.1) bán sạch phần **không khoá**; muốn bán cả phần khoá thì phải bẻ kèo
tường minh, có hộp xác nhận nói rõ mất gì. Tiền mặt và mã không khoá giao dịch tự do.

### 2.3. Cái được — ba đặc quyền

**(a) MIỄN NHIỄM TRƯỢT GIÁ.**
⚠ Phải nói chính xác nếu không nó vô nghĩa hoặc bá đạo. Không giao dịch thì vốn đã
không trả trượt giá của **lệnh mình**. Thứ được miễn là **trượt giá do NGƯỜI KHÁC chen
vào mã mình đang khoá** — phần `GIA_CUA_THANH_KHOAN_BP` / phạt chen chúc theo
`demNguoiNam`. Bản cũ giảm một nửa (`TRUOT_GIA_CON_BP = 5000`); nay **về 0**.
*Vì sao đây là đặc quyền thật:* trong D40, trượt giá là **chi phí tập trung CHÍNH**
(thay `CAP_STACK_BP`). Miễn nhiễm nó là được phép tập trung mà không trả giá — nhưng
chỉ trên phần vốn mình đã **khoá cứng**, tức đã trả bằng quyền tự do.

**(b) ÍT BIẾN ĐỘNG HƠN TRONG SỰ KIỆN XẤU CỰC ĐOAN.**
Áp cho các sự kiện xấu cực đoan: **`hack_san` · `thien_nga_den` · `chien_tranh`**.
Cách áp: **giảm ĐỘ LỚN cú sốc** trên mã đang khoá (`GIAM_SOC_XAU_BP`).
⚠ Giảm ĐỘ LỚN, không phải đổi dấu — đây là giảm chấn, không phải áo giáp. Người khoá
vẫn lỗ trong khủng hoảng, chỉ lỗ **nông hơn**.
⚠ Và nó phải chạm **cả phần tương quan D39**: khủng hoảng thanh khoản kéo mọi mã cùng
chiều, nên nếu chỉ giảm phần riêng mà không giảm phần sốc chung thì đặc quyền gần như
không cảm nhận được đúng lúc nó đáng giá nhất.

**(c) HƯỞNG LỢI HƠN TRONG SỰ KIỆN SIÊU TỐT.**
Áp cho: **`ha_lai_suat` · `bong_bong`** (nhánh phồng).
Cách áp: **khuếch đại** phần lãi trên mã đang khoá (`TANG_SOC_TOT_BP`).

*Vì sao (b) và (c) đi cặp:* chỉ có (b) thì thẻ này là bảo hiểm thuần và ai sợ rủi ro
cũng cầm; chỉ có (c) thì nó là đòn bẩy trá hình. Có cả hai thì nó đúng bản chất **đầu
tư dài hạn ngoài đời**: ngồi yên qua bão để còn ngồi đó lúc trời hửng.

### 2.4. Thang cấp (D40 — săn chiến thuật)

| | cấp 1 | cấp 2 | cấp 3 |
|---|---|---|---|
| Số vòng khoá | `SO_VONG` | dài hơn | dài nhất |
| Giảm sốc xấu | có | mạnh hơn | mạnh nhất |
| Khuếch đại sốc tốt | có | mạnh hơn | mạnh nhất |

⚠ **Số mã khoá được KHÔNG lên theo cấp** — founder đã cho "bao nhiêu cũng được" ngay từ
cấp 1. Cấp nâng **độ sâu**, không nâng **bề rộng**.

---

## 3. VA CHẠM PHẢI XỬ, ĐỪNG ĐỂ PHÁT HIỆN LÚC CHẠY

1. **Nút BỎ (01 §2.1)** — "bán sạch về tiền mặt" phải **bỏ qua mã đang khoá**, và UI
   phải nói rõ "bán X mã, giữ Y mã đang khoá" chứ không im lặng bán thiếu.
2. **Trần số mã đi vốn** (`MAX_TAI_SAN`, nới bởi Đa Dạng Hoá): mã đang khoá **vẫn tính**
   vào trần. Khoá không phải cách lách trần.
3. **Cháy tài khoản**: NAV gồm cả vị thế đang khoá. Khoá **không** cứu khỏi cháy — nếu
   không thì nó thành lá bất tử.
4. **Phòng Hộ / Bán Khống** trên mã đang khoá: **CẤM**. Khoá là lời hứa giữ nguyên vị
   thế; short chống lại chính nó là lách luật bằng cửa sau.
5. **Đảo danh mục** (`apDaoDanhMuc`): không được chọn mã khoá làm vế bán.
6. **Replay**: cổng `balance_version` mới. Trận cũ không có thẻ này ⇒ luật cũ nguyên vẹn.

---

## 4. SỐ — CHỜ FOUNDER (A8.2)

Agent **không tự đặt**. Đề xuất khởi điểm để founder chốt, đánh dấu MC-TUNE:

| Hằng số | Đề xuất | Ghi chú |
|---|---|---|
| `SO_VONG` (cấp 1/2/3) | 2 / 3 / 4 | map 8 chỉ có 8 vòng — khoá 4 vòng là nửa trận |
| `GIAM_SOC_XAU_BP` | 3000 / 4500 / 6000 | giảm 30% → 60% độ lớn cú sốc xấu |
| `TANG_SOC_TOT_BP` | 1500 / 2500 / 3500 | khuếch đại 15% → 35% |
| trượt giá chen chúc | **0 ở mọi cấp** | founder nói "miễn nhiễm", không phải "giảm" |

⚠ **PHẢI ĐO TRƯỚC KHI TIN.** Cặp song sinh (cùng bàn · cùng seed · khác đúng một biến),
và mốc so sánh đã có: Đòn Bẩy 2× về nhất **34,6%** vs ô trống **14,8%** — lá mới vượt
34,6% là quá mạnh. Chặn Lỗ **12,0%** là mốc dưới-trung-tính.
⚠ Và phải đo **tỷ lệ cháy**: lá này giảm biến động nên có thể hạ cháy quá tay, biến trò
thành ai cũng sống.

---

## 5. CHƯA LÀM

Toàn bộ tài liệu này. Không một dòng code.
Phụ thuộc: cần **01-alpha-draft-vong-choi.md** xong trước (chợ tự do + phân bổ vốn),
vì "khoá vị thế" chỉ có nghĩa khi vị thế là **một số tiền**, không phải một lá bài.

---

## ĐÃ SỬA

| Ngày | Đổi gì | Vì sao | Ai quyết |
|---|---|---|---|
| 27/07 | Lập file. `KHOA_TAI_SAN` từ nút miễn phí trong QUẢN TRỊ VỐN → **thẻ chiến thuật**; 1 mã → bao nhiêu cũng được; bỏ đường bẻ kèo có phí → **cấm tuyệt đối**; giảm-một-nửa trượt giá → **miễn nhiễm**; thêm giảm sốc xấu + khuếch đại sốc tốt | Founder muốn "đầu tư dài hạn" thành một chiến thuật có đánh đổi thật, không phải một nút bày sẵn | Founder |
