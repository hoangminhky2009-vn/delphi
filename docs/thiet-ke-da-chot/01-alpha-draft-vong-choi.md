# 01 — ALPHA DRAFT: VÒNG CHƠI

> **ĐÃ CHỐT 27/07 (founder). ĐANG THI CÔNG.** Mọi luật dưới đây thay thế luật cũ.

**Chỉ đạo founder, nguyên văn:**
> *"Bỏ hết 2 cái nút kia đi chỉ còn lại nút bỏ và đúng chức năng của nó. Bỏ luôn
> tính năng chọn 3 mã cố định ngẫu nhiên mà cho người chơi chọn tự do và tự phân bổ
> vốn với chiến thuật của mình."*

Nối tiếp D40 (Vốn mua tài sản, chợ liên tục) — đây là bản THI HÀNH của D40 cho vòng chơi.

---

## 1. CÁI CHẾT

| Chết | Ở đâu | Vì sao |
|---|---|---|
| Pha cược tuần tự (theo · tố · bị tố lại) | `server/holdem/cuoc.ts` · `web/.../useVongCuoc.ts` | Không còn pot để tranh. **Đây cũng là chỗ founder báo GAME ĐƠ**: bấm theo/bỏ ở thẻ thứ 2 thì kẹt. |
| Pot + side pot | `server/holdem/pot.ts` | Không còn ai góp vào đâu. |
| Nút **GIỮ VỊ THẾ** | `AlphaDraftMatch.tsx` | Không giao dịch = mặc định. Không cần một nút để "không làm gì". |
| Nút **TĂNG CAM KẾT** | `AlphaDraftMatch.tsx` | Thay bằng **MUA** ở chợ. |
| Shop bày **3 mã tài sản ngẫu nhiên** mỗi vòng | `server/holdem/shop.ts` (`bayShop`) | Founder: cho chọn **tự do**. Ngoài đời không ai phải chờ vàng "xuất hiện trong shop". |
| `CAM_KET_NEN = 500` | `config/holdem.ts` | Không còn ante. ⚠ Xem §6 — nó đang là thước quy chiếu giá. |

⚠ **Shop KHÔNG chết** — nó tiếp tục bày **thẻ chiến thuật**, giữ reroll · pity · nhịp
D34 (map 8: vòng 2·3·4). Chỉ phần **tài sản** rời khỏi shop.

---

## 2. CÁI SỐNG, VÀ ĐÚNG CHỨC NĂNG

### 2.1. Nút **BỎ** — nghĩa mới, đúng nghĩa

Founder: *"chỉ còn lại nút bỏ và đúng chức năng của nó"*.

```
BỎ = BÁN TOÀN BỘ DANH MỤC VỀ TIỀN MẶT, ngay trong vòng này.
     Chịu trượt giá theo thanh khoản từng mã (bán gấp thì đắt).
```

Không phải "bỏ lượt", không phải "rút khỏi pot" — **thoát hàng**. Đây là hành động
CÓ HẬU QUẢ THẬT: cắt lỗ đúng lúc thì sống, cắt sai lúc thì bán đáy.
Cơ chế đã có sẵn: `CAT_LO_VE_CASH` trong `config/holdem.ts`.

### 2.2. Ba túi tiền, một thước đo

```
TIỀN MẶT   — Vốn chưa tiêu. Chịu lạm phát mỗi vòng (PHI_LAM_PHAT_BP = 150).
DANH MỤC   — số tiền đang nằm ở từng mã, định giá theo giá hiện tại.
NAV        = TIỀN MẶT + GIÁ TRỊ DANH MỤC          ← thước xếp hạng DUY NHẤT
```

Khởi điểm `START_VON = 10.000`, toàn bộ ở tiền mặt.

---

## 3. VÒNG CHƠI MỚI

```
1. MỞ VÒNG    Đồng hồ D38 chạy (vòng 1: 45s · thường: 25s · +12s vòng chọn thẻ).
2. GIAO DỊCH  Người chơi tự do:
                · MUA  — chọn BẤT KỲ mã nào trong 6 mã, nhập SỐ TIỀN (bước 10)
                · BÁN  — rút một phần hoặc toàn bộ một mã về tiền mặt
                · BỎ   — bán sạch mọi mã về tiền mặt (§2.1)
                · không làm gì — tiền mặt ở yên, chịu lạm phát
              Mỗi lệnh chịu TRƯỢT GIÁ theo cỡ lệnh so với thanh khoản của mã đó.
3. LẬT Ô      Ô thị trường lật SAU KHI đã quyết — giữ nguyên căng thẳng hiện có.
4. ĐỊNH GIÁ   Giá từng mã đổi theo ô + dư âm + tương quan (D39) + thẻ chiến thuật.
              ⇒ GIÁ TRỊ DANH MỤC ĐỔI ⇒ NAV ĐỔI THẬT.
5. LẠM PHÁT   Tiền mặt bị trừ PHI_LAM_PHAT_BP.
6. QUỸ VÒNG   Gom TOÀN BỘ phí + trượt giá của cả bàn, chia theo hạng NAV.
```

⚠ **BƯỚC 3 MẤT 56 NGÀY MỚI THẬT SỰ CÓ (v53 · D373 · 21/09).** Engine vẫn định giá bằng ô của
vòng từ đầu, nhưng tầng API thì gửi ô ấy cho client NGAY ĐẦU VÒNG (`o_hien_tai`), nên trên màn
nó lật TRƯỚC khi quyết chứ không phải sau — đúng ngược bước 3. Founder bắt được khi chơi prod:
*"lối chơi đáng lẽ ra phải là đặt cược vào round này vào thẻ bài round sau"*. Cổng
`balance-v53-upo` trả lại đúng dòng này; lý lẽ + số đo ở `docs/nhat-ky/D373.md`.

⚠ **BƯỚC 4 LÀ THAY ĐỔI CỐT LÕI.** Hiện `pnl_bp` chỉ để sắp hạng chia pot và **không
bao giờ cộng/trừ vào `von`** (`server/holdem/engine.ts` — xem docstring `GOI_KY_QUY`).
Đó là lý do founder thấy *"Vốn đứng im"*. Sau bản này, sập là **cháy thật**.

---

## 4. CHỢ TỰ DO — luật cụ thể

> **Chốt bổ sung 27/07 (founder), nguyên văn:**
> *"đừng để phần đảo danh mục hay mua tài sản ở ngoài màn hình chơi, để nó trong shop.
> Và đ** phải là chọn 1 trong 3 tài sản 1 vòng mà là cả 6 tài sản hiển thị 1 lúc cho
> người chơi phân bổ vốn (Tối đa 3 loại tài sản trừ khi có lõi đa dạng hóa). Chiến
> thuật gán cho tài sản chọn sẽ là đòn bẩy còn những chiến thuật khác thì cho đặc
> quyền như đã nói. Giờ mấy nút poker vô dụng, bỏ đi cũng được. À mà chiến thuật cũng
> phải có dấu ! ở góc như tài sản."*

- **Cả 6 mã hiện CÙNG MỘT LÚC**: btc · cp_cn · vn30 · vang · usd · tpcp.
  Không rút thăm, không "3 lá mỗi vòng". Người chơi nhìn cả bảng rồi **phân bổ vốn**.
- **Mua theo SỐ TIỀN**, bước **10** (vẫn số nguyên — C5/A5, làm tròn luôn floor).
- **Trần số mã giữ đồng thời = 3** (`MAX_TAI_SAN: 4 → 3`, **founder chốt**), nới bởi
  thẻ Đa Dạng Hoá (+1 / +2 / +3 theo cấp — D40).
  ⚠ Trần này đếm **VỊ THẾ**, không đếm **LÁ**.
  ⚠ Đây là tham số kinh tế nên agent KHÔNG được tự đổi — con số 3 là của founder.
- **Chi phí tập trung** không còn là `CAP_STACK_BP` mà là **trượt giá theo cỡ lệnh so
  với thanh khoản** (`GIA_CUA_THANH_KHOAN_BP`, `THANH_KHOAN_DONG` — đã tồn tại).
  Dồn nhiều tiền vào một mã mỏng thì tự bị phạt, mượt và đúng bản chất.

### 4.1. MỌI GIAO DỊCH SỐNG TRONG SHOP

Founder: *"đừng để phần đảo danh mục hay mua tài sản ở ngoài màn hình chơi"*.

| | Trước | Sau |
|---|---|---|
| Mua tài sản | thẻ lật giữa màn chơi | **trong shop** |
| Đảo danh mục | bảng QUẢN TRỊ VỐN, ngoài màn chơi | **trong shop** |
| Khoá nắm giữ | bảng QUẢN TRỊ VỐN | thẻ Đầu Tư Dài Hạn (spec 02) |

⇒ **Bảng QUẢN TRỊ VỐN biến mất khỏi màn chơi.** Đây chính là khối founder gọi là
*"thừa thãi… vô giá trị hiển thị"*. Màn chơi còn đúng thứ phải nhìn khi ô đang lật:
danh mục · NAV · ô thị trường · đối thủ · đồng hồ.

*Vì sao gom vào shop là đúng chứ không chỉ là dọn nhà:* "đảo danh mục" và "mua/bán"
là **cùng một hành động** — đổi phân bổ vốn. Tách làm hai chỗ là dựng hai giao diện
cho một quyết định, và đó là gốc của cảm giác *"khó hiểu và nhập nhằng"* founder nêu
khi mở D40.

### 4.2. GẮN THẺ VÀO MÃ = ĐÒN BẨY. Các thẻ khác KHÔNG gắn.

Founder: *"chiến thuật gán cho tài sản chọn sẽ là đòn bẩy còn những chiến thuật khác
thì cho đặc quyền như đã nói"*.

```
don_bay        → GẮN vào một mã. Nhân lãi/lỗ của ĐÚNG mã đó.
9 lá còn lại   → KHÔNG gắn. Đặc quyền ở tầng người chơi / danh mục.
```

⚠ **Đây là lời giải cho món nợ D40 đã ghi mà chưa ai gỡ:** `pham_vi` khai 9/11 lá là
`tai_san`, và D40 tự nhận *"`pham_vi` CÓ TRƯỚC D33 và nay mô tả sai vài lá"*. Luật của
founder cắt thẳng nút đó: **chỉ Đòn Bẩy có đích ngắm.** `pham_vi` thôi làm nguồn chân
lý cho việc gắn; nó còn lại đúng một giá trị dùng được.

⚠ **Diễn giải của agent, founder sửa nếu sai:** tôi đọc "chiến thuật gán cho tài sản"
là **lá Đòn Bẩy**, vì nó là lá duy nhất mà "nhân lên trên một mã" có nghĩa. Nếu ý
founder là *mọi* lá đều gắn được và việc gắn tự nó tạo đòn bẩy thì nói, tôi đổi.

### 4.2b. MỐC PHÂN BỔ VỐN — TỰ DO, KHÔNG THÔ

> **Founder 27/07 (tối), nguyên văn:** *"Cho mốc tự do hơn một tý để ông nào try
> hard có thể ngồi tính toán theo công thức phân bổ vốn ngoài đời và phải có hiệu
> quả thật trong game thay vì kéo vốn bừa. All-in vừa là kéo tới cùng vừa là bấm
> dứt khoát."*

- Đề xuất 4 mốc thô (10/25/50/ALL-IN) của agent **BỊ SỬA**: quá thô để tính
  Kelly/Markowitz thật. Mốc mới: **bước 5%, từ 5% đến 100%** trên tiền mặt còn
  lại — 20 nấc, kéo là bắt được 35%, 40%, 65%… đủ mịn cho công thức thật, vẫn
  không phải gõ số.
- **ALL-IN là nấc cuối của chính thanh kéo** (kéo tới cùng) **và** có nút bấm dứt
  khoát riêng — hai đường vào cùng một hành động, giữ nguyên cảm giác BetBar cũ.
- **"Hiệu quả thật trong game"** = ràng buộc nghiệm thu, không phải lời văn: bot
  phân bổ theo công thức (Kelly bậc thang) phải xếp trên bot kéo bừa (uniform
  random) qua Monte Carlo, nếu không thì phân bổ chỉ là trang trí. Đo khi engine
  v10 xong.

### 4.2b-2. MỐC MỊN LÀ ĐẶC QUYỀN CHIA LỆNH (founder 28/07)

> Nguyên văn: *"Chỉ chiến thuật chia lệnh mới cho phép đi vốn cụ thể (các mốc
> 5-10-15...100) Còn người chơi chưa có chiến thuật chia lệnh chỉ có thể đi vốn
> cố định các mốc lớn hơn, xử lý logic tính toán phần này kỹ."*

| | Không lá Chia Lệnh | Cầm lá Chia Lệnh |
|---|---|---|
| Mốc đi vốn | **bước 25%**: 25 · 50 · 75 · ALL-IN | **bước 5%**: 5 · 10 · … · 95 · ALL-IN |

- Bước thô 25% là ⭐ đề xuất agent ("mốc lớn" founder chưa cho số) — một chỗ
  trong `NAV_V10.BUOC_MOC_THO_BP`, đổi không đụng code.
- ENFORCE Ở SERVER (C4): API nhận **MỐC** (`moc_bp`), không nhận tiền thô —
  server kiểm mốc hợp lệ theo việc ghế có cầm `chia_lenh` LÚC ÁP, rồi mới giải
  ra tiền tuần tự (lệnh sau tính trên số dư sau lệnh trước). Client gửi tiền
  tuỳ ý là hết đường từ hôm nay.
- Lá Chia Lệnh nay có HAI đặc quyền: giảm trượt giá (D33, giữ nguyên) + mốc
  mịn (mới) — đúng bản chất "chia lệnh" ngoài đời: chẻ nhỏ được lệnh.
- Log lưu MỐC, replay giải lại — cùng trạng thái thì cùng tiền, tất định.

### 4.2c. ALL-IN MỞ TỪ VÒNG 1 — CHỈ "LẬT ĐẾN CUỐI" CẦN 3 CHIẾN THUẬT

> **Founder 27/07 (tối), nguyên văn:** *"Không khóa all in ở mấy round đầu nữa,
> chỉ khóa tính năng lật bài đến cuối (Chỉ lật khi đã chọn đủ 3 chiến thuật)."*

Đây là **sửa D34 điều 4** (bản cũ: "All-in và 'lật bài đến hết giờ' CHỈ mở sau
khi đã chọn xong cả 3 thẻ"). Tách đôi:

| | Trước (D34) | **Sau (27/07)** |
|---|---|---|
| Dồn 100% vốn | khoá tới khi đủ 3 thẻ | **mở từ vòng 1** — chỉ là một mức phân bổ |
| Lật bài đến hết trận (`tu_the = 'all_in'`) | cùng cổng trên | **giữ nguyên: cần đủ 3 chiến thuật** |

Ghi chú thi công: engine hiện đã tách sẵn hai nghĩa này ở `apDatTuThe`/vòng khoá
(all-in sớm không set `tu_the`), nhưng còn một chỗ **kẹp trần tố −1 chip**
(`engine.ts` ~1859) để chặn dồn-đến-0 khi chưa đủ thẻ. Chỗ kẹp đó nằm trong máy
cược tuần tự — thứ đã không còn đường bấm từ UI và sẽ chết theo engine v10 — nên
**không vá riêng** (vá là bump version chỉ để sửa hành vi bot với nhau). Luật mới
ship cùng engine phân bổ v10.

### 4.4. SHOP — TÀI SẢN 3 LÁ/HÀNG · CHIẾN THUẬT KIỂU LÕI TFT

> **Founder 27/07 (tối), nguyên văn:** *"phần tài sản có thể để thành 3 cái 1
> hàng ngang trong shop. Giờ đây chiến thuật không còn khóa cứng vị trí xuất hiện
> trong shop nữa mà chỉ hiện lên khi đến vòng (Đúng như tính năng chọn lõi trong
> TFT)."*

- Tài sản: lưới **3 lá/hàng** (6 mã = 2 hàng). Đã đúng từ commit `30da4a9`.
- Chiến thuật: **bỏ khối cố định bị xám** khi chưa tới vòng. Mục CHIẾN THUẬT chỉ
  render **đúng vòng chọn** (nhịp D34 giữ nguyên: map 8 → vòng 2·3·4) — như lõi
  TFT hiện lên rồi biến mất. Ngoài vòng đó chỉ còn một dòng hint "lõi tiếp theo ở
  vòng N" để người chơi còn hẹn giờ được; hết lượt thì thôi hẳn.

### 4.3. THẺ CHIẾN THUẬT PHẢI CÓ DẤU (!) NHƯ TÀI SẢN

Founder: *"chiến thuật cũng phải có dấu ! ở góc như tài sản để mô tả rõ thứ người chơi
sẽ nhận được khi chọn chiến thuật này"*.

Tờ (!) của thẻ chiến thuật phải nói **thứ NHẬN ĐƯỢC** (đặc quyền + cấp), không phải
đặc điểm ngoài đời. ⚠ Đây **không** trái D28: D28 buộc *chú thích trên mặt thẻ* tả đặc
điểm thật ngoài đời; (!) là chỗ tả **cơ chế**. Hai lớp khác nhau, và tài sản đã làm
đúng như vậy sẵn.

---

## 5. CHƯA LÀM — ghi thẳng, không giấu

| Việc | Trạng thái |
|---|---|
| Toàn bộ §1–§4 | **ĐÃ THI CÔNG** — engine v10 (`balance-v10a-tatcuoc` · `v10b-nav`), chợ tự do mọi vòng, mốc 25% / 5%. Dòng "chưa có dòng code nào" viết 27/07 và bị đọc nhầm là hiện trạng tới 07/09 (D300) |
| Đặc quyền 6 lá còn lại (Bắt Đáy · Bán Khống · Chia Lệnh · Đi Ngược · Mua Đuổi bị bỏ) | **CHƯA** — thiết kế ở `docs/khao-co/design_dac_quyen_con_lai.md` |
| Đặc quyền 5 lá đã xây (Khớp Nhanh · Đa Dạng Hoá · Phòng Hộ · Lướt Sóng · Chặn Lỗ) | **ĐÃ XÂY** — commit `af7f379` |

---

## 6. CHỜ FOUNDER — không tự chốt (A8.2)

1. **Mốc quy chiếu giá thay cho `CAM_KET_NEN = 500`.** Ba mức Bảng điện tử
   100/80/110 (D33) biện minh bằng "20%/16%/22% của 500". Xoá 500 là ba mức thành số
   mồ côi. ⭐ Khuyến nghị neo vào **Quỹ vòng**.
2. **Quỹ vòng bao nhiêu mỗi vòng.** Đo được: dưới ~250 thì thứ hạng chìm trong may
   rủi; trên ~1.200 thì xếp hạng lấn át đọc thị trường. ⭐ **400–900.**
3. **Cách hãm vòng phản hồi kẻ dẫn đầu** (hạng cao → nhiều quỹ → mua nhiều → càng dẫn).
   ⭐ Khuyến nghị chia quỹ theo **% tăng trưởng vòng**, không theo NAV tuyệt đối.
4. **Ngưỡng cháy.** Đề xuất NAV < 10% `START_VON`.

---

## ĐÃ SỬA

| Ngày | Đổi gì | Vì sao | Ai quyết |
|---|---|---|---|
| 27/07 | Lập file. Bỏ pha cược tuần tự + 2 nút giữ/tăng; giữ nút BỎ = bán sạch về tiền mặt; bỏ shop 3 mã ngẫu nhiên → chợ tự do + tự phân bổ vốn | Founder báo game ĐƠ ở pha cược, và ba nút không có hậu quả thật (D35 đo: dải hạng 6 triết lý đi vốn chỉ 0,244) | Founder |
| 27/07 (tối) | §4.1 mọi giao dịch vào SHOP (bỏ bảng QUẢN TRỊ VỐN khỏi màn chơi) · §4 cả 6 mã hiện cùng lúc, `MAX_TAI_SAN` 4→**3** · §4.2 chỉ Đòn Bẩy gắn vào mã · §4.3 thẻ chiến thuật có (!) · bỏ nút poker | Chỉ đạo founder, nguyên văn ở đầu §4 | Founder |

---

## 7. NHỊP VÒNG — VIỆC PHÁT SINH TỪ ĐỢT RÀ (`00-ra-co-che-27-07.md` §4)

Map thật là **8 ô** (`config/holdem.ts:69`), và `loaiTheVong` cho ra:

```
v1 tài sản · v2·v3·v4 chiến thuật · v5·v6 tài sản · v7·v8 KHÔNG CÓ THẺ NÀO
```

⚠ **Chợ liên tục KHÔNG tự giải chuyện này.** Nếu chỉ đổi cách mua mà giữ nguyên
`loaiTheVong` thì vòng 7·8 vẫn là hai vòng không làm gì được — đúng thứ founder than
(*"chọn mã xong và thẻ tiếp theo lật thì đ** có gì xảy ra?"*).

**Luật mới:** chợ tài sản **mở ở MỌI vòng**. `loaiTheVong` thôi gác cửa chợ; nó chỉ
còn quyết **vòng nào bày thẻ chiến thuật** (nhịp D34 giữ nguyên: map 8 → vòng 2·3·4).
