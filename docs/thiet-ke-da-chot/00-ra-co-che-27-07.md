# 00 — RÀ CƠ CHẾ (27/07/2026)

> Founder: *"Rà cơ chế"*, sau khi phát hiện *"cơ chế cũ chưa từng xuất hiện trên web chính"*.
>
> Phương pháp: **truy đường chạy, không đọc tên hàm**. Mỗi dòng dưới đây có `file:dòng`.
> Cái gì đo được thì ghi số; cái gì chỉ suy được thì ghi rõ là suy.

---

## 1. KẾT LUẬN NGẮN

Không có cơ chế nào "mất đường vào" theo nghĩa đứt dây. Client gửi đủ **10 trường**
hành động, server nhận đủ 10 (`server/holdem_api.ts:185–250` ↔
`web/src/screens/holdem/AlphaDraftMatch.tsx:384–399`), và `balance-v9-tuongquan` bật
`luatVon` + `dacQuyen` (`config/holdem.ts:2418–2428`).

**Vấn đề thật nằm ở NHỊP VÒNG, không ở dây nối.** Xem §4 — đó là phát hiện đáng giá
nhất đợt rà này, và nó giải thích đúng câu founder than.

---

## 2. ĐÃ XÂY, CÓ ĐƯỜNG CHẠY TỪ UI THẬT

| Cơ chế | Cổng mở | Bằng chứng |
|---|---|---|
| Đảo danh mục | `vòng ≥ 2` | `holdem_api.ts:934` |
| Khoá nắm giữ 2 vòng | vòng loại `tai_san` | `holdem_api.ts:938`, `config:2001` |
| Phòng Hộ (short, khớp vòng sau) | cầm lá `phong_ho` | `holdem_api.ts:979` |
| Bảng điện tử 3 hạng (100/80/110) | luôn | `dacQuyenCua().gia_bang` |
| 5 đặc quyền: `khop_nhanh` · `da_dang_hoa` · `phong_ho` · `luot_song` · `chan_lo` | cầm lá | `holdem_api.ts:999–1002` |
| Đồng hồ D38 | render | `AlphaDraftMatch.tsx:773–778` |
| Tương quan D39 | v9 bật | `config:2424` |
| Gọi ký quỹ mở rộng | v8/v9 bật | `config:2414, 2426` |
| Cấp thẻ (2 bản = cấp 2) — **chỉ cho TÀI SẢN** | | `engine.ts:1031, 1112` |

Ba cờ cổng đều **suy ở server** (C4), client không tự tính — đúng thiết kế, và đó là
lý do không xuất hiện lỗi "nút sáng mà bấm không ăn".

---

## 3. ĐÃ XÂY NHƯNG GIỮ Ở CỔNG (cố ý, có ghi lý do)

- `donBayCamKet: false` ở **mọi** phiên bản (`config:2414, 2426`). Đo ra vi phạm chính
  ràng buộc founder đặt: all-in vô não leo từ hạng 3/6 lên 1/6. Lý do dài ghi tại
  `config/holdem.ts:2384–2411`. **Chờ founder**, không phải quên.

---

## 4. ⚠ PHÁT HIỆN CHÍNH — NHỊP VÒNG MAP 8 LÀM PHẦN LỚN TRẬN KHÔNG CÓ VIỆC

Map thật đang chạy là **8 ô** (`config/holdem.ts:69` — `MAP_SIZE: 8`), không phải 12.
Chạy `loaiTheVong` + điều kiện cổng trên đúng map đó:

```
vòng | loại thẻ    | đảo? | khoá?
  1  | tai_san     |  ✗   |  ✓
  2  | chien_thuat |  ✓   |  ✗
  3  | chien_thuat |  ✓   |  ✗
  4  | chien_thuat |  ✓   |  ✗
  5  | tai_san     |  ✓   |  ✓
  6  | tai_san     |  ✓   |  ✓
  7  | khong       |  ✓   |  ✗
  8  | khong       |  ✓   |  ✗
```

**Đọc bảng này ra ba việc:**

1. **Chỉ 3/8 vòng có cửa hàng tài sản** (1 · 5 · 6). Vòng 2·3·4 bán thẻ chiến thuật;
   vòng 7·8 **không bán gì cả** (`loaiTheVong` trả `'khong'`).
2. **Khoá nắm giữ chỉ mở 3/8 vòng**, và vòng 1 thì người chơi mới có nhiều nhất 1 mã.
   Thực tế nó là cơ chế của **vòng 5–6**, tức phần cuối trận.
3. ⇒ Câu founder than — *"chọn mã xong và thẻ tiếp theo lật thì đ** có gì xảy ra?"* —
   **không phải bug.** Ở 5 trong 8 vòng thì đúng là không có gì để làm với tài sản.
   Đây là hệ quả **có thật và đo được** của nhịp D34 (ba lần chọn thẻ dồn vào
   vòng 2·3·4 ở map 8 — D34 đã tự khai đánh đổi này: *"ba vòng LIÊN TIẾP, gần như
   không còn vòng nào để CHƠI giữa hai lần chọn"*).

⚠ **D34 khai đánh đổi nhưng khai THIẾU MỘT NỬA.** Nó chỉ nói về ba vòng chọn thẻ liên
tiếp; nó không nói rằng **hai vòng cuối không có thẻ nào**. Cộng lại thì map 8 có
5/8 vòng không đụng được tài sản — và map 8 chính là map founder đang chơi.

*Vì sao chỗ này quan trọng hơn mọi mục khác trong tài liệu:* D40 sẽ thay chợ lá bằng
**chợ liên tục**, tức "vòng nào cũng mua bán được". Nếu chỉ đổi cơ chế mua mà giữ
nguyên `loaiTheVong` thì vòng 7·8 vẫn là hai vòng chết. **Spec 01 phải xử nhịp vòng,
không chỉ xử cách mua.**

---

## 5. FOUNDER ĐÃ DUYỆT NHƯNG CHƯA CÓ DÒNG NÀO

| # | Việc | Ai duyệt | Trạng thái đo được |
|---|---|---|---|
| 1 | **Đi Ngược = thấy đối thủ chọn gì** (2/3/4 người theo cấp, cân theo cỡ lobby) | D37(6) + D40 | Không có trong `DAC_QUYEN_THEO_THE` (`holdem_api.ts:999`). Lá `di_nguoc` CHỈ có một mắt xích tính `delta_bp` (`engine.ts:1506–1518`) — **không phải** đặc quyền đã duyệt |
| 2 | **Cấp thẻ chiến thuật** ("săn chiến thuật") | D40 | `capThe` chỉ áp cho **tài sản** (`engine.ts:1031, 1112`). Đặc quyền hiện **phẳng**, không cấp 1/2/3 ⇒ Đa Dạng Hoá +1/+2/+3 và Đi Ngược 2/3/4 người **đều không tồn tại** |
| 3 | Đặc quyền **Bắt Đáy · Bán Khống · Chia Lệnh** | D37(4) | `ban_khong` xuất hiện đúng **1 lần** trong server, và là trong danh sách ưu tiên của BOT (`bots.ts:752`) — không có logic nào |
| 4 | **Xem lại bàn đấu sau trận** | D34(3) | Không tìm thấy gì trong `web/src/screens/holdem/` |
| 5 | **Toàn bộ D40** (chợ liên tục · NAV · mua bằng tiền) | D40 | Spec `01-alpha-draft-vong-choi.md`, chưa code |
| 6 | **Đầu tư dài hạn** | 27/07 | Spec `02-the-dau-tu-dai-han.md`, chưa code |

`mua_duoi` không có đặc quyền là **đúng chủ ý** — D37(7) chọn đường (a) giữ làm "lá bẫy".

---

## 6. "VỐN ĐỨNG IM" — ĐO ĐƯỢC, VÀ KHÔNG PHẢI BUG

Mọi chỗ ghi vào `von` trong một trận (`server/holdem/engine.ts`):

| dòng | việc | dấu |
|---|---|---|
| 1968 | trừ phần đã cam kết | − |
| 1974 | trả lại phần thừa khi chia pot | + |
| 1989 | phí đứng ngoài | − |
| 2042 | phí cắt lỗ | − |
| 2084 | phí tài trợ | − |
| **2143** | **chia Quỹ vòng theo thứ hạng** | **+** |
| 2185 | gọi ký quỹ | − |
| `bang_dien_tu.ts:243` | phí mở bảng | − |

**Sáu trong tám bút toán là TRỪ. Nguồn CỘNG thực chất chỉ có một: Quỹ vòng (2143).**
Và Quỹ vòng chia theo `TRONG_SO: [5000, 3000, 2000]` (`config:643`) — đúng **ba** suất.

⇒ Danh mục lãi bao nhiêu cũng **không** cộng vào Vốn; nó chỉ dịch thứ hạng, mà thứ
hạng thì chỉ ba người đầu có tiền. Với bàn 5 ghế thì 2 người mỗi vòng **chắc chắn**
chỉ thấy Vốn đi xuống. Đây đúng là chẩn đoán D35 và là thứ D40 sửa bằng **NAV**.

⚠ Và nó chồng với món nợ D31 chưa trả: ba suất thưởng **không chuẩn hoá theo cỡ bàn**
— bàn 4 thì 3/4 người có thưởng, bàn 8 thì 3/8.

---

## 7. VIỆC PHẢI LÀM, THEO THỨ TỰ PHỤ THUỘC

1. **Spec 01** (chợ liên tục + NAV) — và **phải gồm nhịp vòng** (§4), không chỉ cách mua.
2. **Spec 02** (Đầu tư dài hạn) — phụ thuộc 01.
3. Cấp thẻ chiến thuật (§5.2) — chặn cả Đa Dạng Hoá lẫn Đi Ngược, nên làm trước hai lá đó.
4. Đặc quyền Đi Ngược (§5.1).
5. Bắt Đáy · Bán Khống · Chia Lệnh (§5.3).
6. Xem lại bàn đấu (§5.4).

⚠ **Bốn số kinh tế vẫn chờ founder** (A8.2), và mục 1 không đo được nếu thiếu chúng:
mốc quy chiếu thay `CAM_KET_NEN` · cỡ Quỹ vòng (khảo sát đề xuất 400–900) · cách hãm
vòng phản hồi kẻ dẫn đầu (đề xuất chia theo % tăng trưởng) · ngưỡng cháy NAV.
