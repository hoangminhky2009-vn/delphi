# Arena — balance notes and measurements (D1–D6)

A historical notebook: each section is one round of balancing work, with the measurements taken at the time. On 27 Jul 2026 the core model changed (players now buy assets in a continuous market and are ranked by NAV), so **every number in this notebook is out of date**. The measurement methods — confound traps, paired twin runs, gates that end up testing a strategy nobody plays — still apply. Notes added after that date start with `⚠ VÁ D40`.

*The document below is in Vietnamese, the language of the project.*

## D3 — Áp lực đám đông đo bằng TỶ LỆ LOBBY (25/07/2026)

**Vấn đề.** Mọi ngưỡng đám đông trước cụm này đếm ĐẦU NGƯỜI tuyệt đối:

```
phat_bp = K × (dong − 1) × 10000 / L
```

`dong` là số ghế cùng nắm một mã. Ở bàn 4 ghế `dong−1` cao nhất là 3; ở bàn 8
ghế là 7. Cùng một hành vi "cả bàn dồn vào một mã" mà bàn to bị phạt hơn gấp
đôi — tức là **cỡ bàn tự nó đổi cân bằng**. D3 lại yêu cầu mở bàn 4–8, nên
không chuẩn hoá thì đó là phát hành năm game có cân bằng khác nhau, và gate
Monte Carlo đo ở cỡ nào cũng không nói được gì về cỡ còn lại.

**Công thức mới.**

```
tyLeDongBp(dong, songSot) = floor(10000 × (dong − 1) / (songSot − 1))     # 0 khi dong ≤ 1
phat_bp                   = K × DONG_QUY_CHIEU × tyLeDongBp / L
DONG_QUY_CHIEU            = 4        # số đối thủ ở bàn mặc định (5 ghế)
```

**Tính chất chịu lực — no-op ở bàn quy chiếu.** Tại `songSot = 5`:
`tyLeDongBp = 2500 × (dong−1)`, nên `phat = K × 4 × 2500 × (dong−1) / L
= K × 10000 × (dong−1) / L` — **đúng công thức cũ tới từng bp**. Nhờ vậy D3 đổi
ĐƠN VỊ ĐO mà không nuốt mất cân bằng D1 (15 vòng đo mới đạt). `tests/holdem_d3.test.ts`
khoá điều này qua cả ba hạng thanh khoản.

Bảng tra còn đánh chỉ số theo đầu người (`KHOP_NHANH_HOAN_BP`) đi qua
`dongQuyDoi(dong, songSot) = 1 + floor(DONG_QUY_CHIEU × tyLeDongBp / 10000)`,
trả lại đúng `dong` ở bàn 5 ghế.

**Bẫy đo đã gặp.** Test T4 cũ (`hoàn càng nhiều khi càng đông`) dựng bàn `n` ghế
rồi cho **cả n** người nắm btc — nên nó không đo mức dồn (luôn 100%) mà đo CỠ
BÀN. Hai biến lẫn vào nhau, chỉ lộ ra khi đổi đơn vị. Đã sửa fixture: bàn cố
định 5 ghế, chỉ đổi bao nhiêu người trong đó dồn. Cùng lớp lỗi đã làm chẩn đoán
sai ba lần khi cân bằng D1.

> **⚠ VÁ D40 — CỤM NÀY SỐNG, và nó vừa thành QUAN TRỌNG HƠN.**
> Chuẩn hoá đám đông theo **tỷ lệ lobby** không phụ thuộc pot chút nào — nó đếm
> *"bao nhiêu ghế cùng nắm một mã"*, mà chợ liên tục vẫn có vị thế nên vẫn đếm được.
> **Cái phải sửa là ĐƠN VỊ `dong`:** hôm nay `dong` = *số ghế cùng nắm mã*, nhị phân
> theo đầu người. Sau D40 mỗi ghế nắm **một số tiền**, nên hai người mỗi người bỏ 100
> và hai người mỗi người bỏ 5.000 ra **cùng một `dong`** — đúng lớp lỗi *"danh mục
> không có kích cỡ"* mà D40 chẩn cho `dungChuoi`. ⇒ Cân nhắc `dong` **theo tỷ trọng
> tiền** thay vì theo đầu người. **Chưa quyết — xem §CHỜ FOUNDER Q1 ở cuối sổ.**
> *Còn nợ, chưa trả (D31):* `DONG_QUY_CHIEU = 4` quy chiếu về bàn 5 ghế nên bàn 8 đọc
> sai đơn vị. D40 không sửa món này; nó vẫn treo.

## D2 — Cắt lỗ về Cash có giá (25/07/2026)

> **⚠⚠ VÁ D40 — CỤM NÀY BỊ ĐỘNG NẶNG NHẤT TRONG CẢ SỔ. Đọc trước khi dùng bất kỳ số nào.**
>
> *Trước:* "Cắt lỗ" = **bỏ bài, rút khỏi pot một vòng**. Nó miễn phí nên phải **bịa
> ra một khoản phí** (`PHI_LAM_PHAT_BP + PHI_RUT_KHAN_BP`) để nước đi đó có giá.
> *D40 đổi thành:* Cắt lỗ = **BÁN DANH MỤC VỀ TIỀN MẶT**. Nó **tự có giá** — trượt
> giá thật khi bán, cộng lạm phát ăn phần tiền mặt vừa thu về.
> ⇒ **Đây là tin tốt, không phải mất mát:** hai lớp phí mà cụm này phải dựng bằng tay
> ("lạm phát vòng" + "rút khẩn") nay là **hai cơ chế có thật trong engine**, không
> phải hai hằng số. Chính D40 §5.3 gọi đây là việc trả món nợ 19/07 *"tiền mặt phải
> CÓ GIÁ"*.
>
> **Cụ thể cái gì chết, cái gì sống:**
>
> | | |
> |---|---|
> | công thức `bp_goc = 150 + 350`, `GIAM_DAP_BP = 20000` | ⚠ phải **thay bằng trượt giá thật theo cỡ lệnh**, không giữ hằng số |
> | **giẫm đạp cần ≥2 người** + ngưỡng tỷ lệ | ✅ **sống, và đúng hơn** — nhiều người cùng bán một mã = trượt giá thật, không cần nhân `GIAM_DAP_BP` |
> | quota `soLanCatLo` (8→1 · 12→1 · 16→2) | ⚠ **mất lý do tồn tại.** Quota có để chặn "bỏ bài vô hạn"; bán về tiền mặt không cần chặn — bán nhiều thì trả trượt giá nhiều, đó đã là quota tự nhiên. **Xem Q2.** |
> | `choiVongCuoc` (chỗ gỡ `'bo'` khỏi `lam.duoc`) | ❌ **CHẾT** theo D40 (máy trạng thái cược tuần tự bị cắt) |
> | bot `chay_som` làm thước đo | ✅ **sống về vai trò**, nhưng phải viết lại chính sách: nó không "hay bỏ bài" nữa mà "hay bán sạch về tiền mặt" |
> | cách đọc gate D2 (bám nhóm chơi-được = phí nhẹ · bét như Bấm bừa = phí nặng) | ✅ **sống nguyên** — đây là phần phương pháp |
>
> ⚠ **MỘT CẠM BẪY MỚI D40 tự đẻ ra ở đúng chỗ này:** khi cắt lỗ = bán về tiền mặt, và
> tiền mặt chỉ mất `PHI_LAM_PHAT_BP = 150` mỗi vòng, thì **bán sạch có thể lại thành
> nước đi trội** ở cuối trận — đúng bệnh mà cả cụm D2 sinh ra để chữa. D40 §2.1 đã
> chặn một nửa (xếp hạng theo **NAV** nên bán sạch không tự cho điểm), nhưng số đo
> D40 cho thấy tiền mặt −150 bp **cạnh tranh được với cả nhóm phòng thủ**
> (`usd` −412 · `vang` −131 · `tpcp` −33). ⇒ **Gate D2 phải chạy lại NGAY sau khi có
> engine mới**, và đây là gate dễ đỏ nhất.

**Vấn đề.** Bỏ vòng là MIỄN PHÍ. Mất phần quỹ vòng, mà chưa đặt gì thì cũng
chẳng mất. Hễ ô sắp lật trông xấu là bỏ luôn: rủi ro 0, chi phí 0 — nước đi trội
gần như tuyệt đối, và người chơi không phải cân gì cả.

**Phí, tính trên Vốn còn lại tại thời điểm chốt phiên.**

```
bp_goc  = PHI_LAM_PHAT_BP (150) + PHI_RUT_KHAN_BP (350)
giamDap = soBo ≥ 2  AND  tyLeBp(soBo, songSot) ≥ NGUONG_GIAM_DAP_BP (3000)
bp      = giamDap ? applyBpInt(bp_goc, GIAM_DAP_BP=20000) : bp_goc
mat     = min(von, applyBpInt(von, bp))
```

Hai lớp tách rời để dây chuyền đọc được lý do: **lạm phát vòng** (giữ tiền mặt
thì mất giá — cùng nguồn với phí đứng ngoài, lever D20) và **rút khẩn** (bán
tháo cả danh mục một nhịp thì ăn trượt giá, không bán ở giá niêm yết).

**Giẫm đạp cần ≥2 người.** Chỉ xét tỷ lệ là chưa đủ: ở bàn nhỏ một người bỏ đã
vượt 30% (1/2 = 50%), mà "bị giẫm đạp bởi chính mình" là vô nghĩa. Test bàn 2
ghế bắt được ngay vòng đầu.

**Quota.** `soLanCatLo(soO)`: map 8 → 1 · map 12 → 1 · map 16 → 2. Hết lượt thì
`'bo'` bị **gỡ khỏi `lam.duoc`** trong `choiVongCuoc` — chặn ở đó vì đó CŨNG LÀ
danh sách API gửi ra cho UI vẽ nút, nên bot và UI tự động đồng ý với nhau. Chặn
ở tầng dưới thì UI vẫn vẽ nút rồi bấm vào mới báo lỗi. Người đứng ngoài / đầu
hàng không bị thu phí này (không thu hai lần cùng một hành vi).

**Thước đo mới — bot `chay_som` ("Chạy sớm").** Gate D2 đòi "cắt lỗ có giá trị
nhưng không thành meta thống trị". Trước bot này KHÔNG bot nào chơi kiểu hay-bỏ:
mọi bot chơi-được dùng chung một chính sách cược (equity so pot odds), khác nhau
ở chỗ chọn lá. Nghĩa là gate đó đo một chiến lược không tồn tại — đặt phí bằng 0
hay 90% thì số Monte Carlo cũng gần như không đổi.

Cách đọc: `chay_som` bám sát nhóm chơi-được → phí quá nhẹ. `chay_som` bét hẳn
như Bấm bừa → phí quá nặng, cắt lỗ thành bẫy và trò dạy sai bài học (D22). Cả
hai phía đều là trượt gate.

**Đo được (12.000 trận, map 8, `balance-v3-D1`).**

| Gate | Kết quả |
|---|---|
| G1 không chạy trốn | ✓ đỉnh Tất tay 27,0% · á quân 26,3% · cách 0,7 |
| G2 gradient kỹ năng | ✓ oracle 2,45 < chơi-được 3,02 < bấm-bừa 3,66 |
| G3 ngồi im không trội | ✓ hạng TB 3,59 |
| G4 tin tức có kỹ năng | ✗ nợ cũ, thuộc trục Cổng 2 (hiệu chuẩn Kelly) |
| D2 — cắt lỗ được định giá | ✓ Chạy sớm hạng 3,62 · thắng 11,9% — trên Bấm bừa (8,6%) và Ngồi im (10,0%), dưới MỌI chiến lược chơi-được |

⚠ **G2 chuyển từ đỏ sang xanh, nhưng đây KHÔNG phải so sánh sạch:** đàn bot vừa
thêm thành viên thứ 13, nên đối thủ mà mọi bot gặp đã đổi. Muốn kết luận sạch
thì cần cửa tắt riêng cho `chay_som` rồi đo hai lượt — chưa làm.

⚠ Mọi số D2 mang `// MC-TUNE`: đây là điểm khởi đầu, chưa phải giá trị đã hiệu
chuẩn qua nhiều cỡ bàn.

### D2 — ba cách ra, và ba cơ chế từng chỉ là trang trí (25/07/2026)

Phát hiện khi CHƠI THẬT trên stack local, không phải khi đọc code: sheet "bỏ bài"
có hai nhánh, nhưng **cả hai gửi lên server cùng một thứ** (bỏ một vòng). Nên
`tu_the` của ghế chưa bao giờ rời `'choi'`, và ba cơ chế thành code chết — dù mỗi
cái đều có test riêng, và test nào cũng xanh:

| Cơ chế | Trạng thái trước 25/07 |
|---|---|
| `PHI_DUNG_NGOAI` — lạm phát bào vốn người đứng ngoài | chưa từng bị thu một lần |
| `xepHang` đẩy người đầu hàng xuống bét bảng | chưa từng chạy — nút chỉ `navigate` về sảnh |
| phí + quota Cắt lỗ (D2) | chỉ BOT đi qua; người chơi không có cửa vào |

Nhãn nút hứa "ngồi xem tới hết trận" và "tính là THUA" trong khi engine chỉ bỏ
một vòng. **Test cũ không bắt được vì chúng dựng sẵn state ở tư thế `dung_ngoai`
rồi kiểm luật** — tức kiểm "nếu ở tư thế đó thì đúng", chưa bao giờ kiểm "có
đường nào ĐẾN được tư thế đó". `tests/holdem_bacachra.test.ts` kiểm cái thứ hai.

Nay `HanhDongVong.hanh_dong` nhận thêm `dung_ngoai` / `dau_hang`; `doiTuThe()` là
hàm thuần, gọi **trong `replay()`** nên tư thế vẫn là hàm thuần của log và replay
giữ nguyên tính tất định. Quota cắt lỗ còn lại do **server** cấp
(`con_lai_cat_lo`) — client tự tính là luật tồn tại ở hai nơi, và biểu hiện khi
lệch sẽ là "nút vẫn sáng, bấm vào không có gì xảy ra".

**Bẫy UI đã dính và đã sửa:** bản đầu của nhánh Cắt lỗ chép y đường cũ
(`vc.chon`/`batDauVong` với nước `'bo'`). Đo trên trận thật: bấm xong
`so_lan_cat_lo` **vẫn 0** và Vốn **TĂNG 250** — không hề bỏ bài. Vì "Đứng ngoài"
cũ dùng đúng đường ấy, nghĩa là nút đó cũng chưa bao giờ bỏ bài thật. Nay nộp
trực tiếp `nopVong([{loai:'bo'}], 'cat_lo')` theo hợp đồng đã chốt bằng test.

**Phí phải được KỂ RA.** `web/src` trước đó không có một dòng nào đọc
`phi_dung_ngoai` / `phi_cat_lo`, dù docstring engine ghi rõ "phải trả ra để UI
cho thấy". Nay response mang `phi_cua_ban {loai, mat, giam_dap}` +
`ty_le_cat_lo_bp`, và màn bàn đấu vẽ một dòng ngay TRÊN bảng "VÌ SAO".

Quan sát trên trận thật, cả hai nhánh giẫm đạp:

```
lượt A: PHÍ CẮT LỖ −950  "GẤP ĐÔI — 40% cả bàn cùng chạy một cửa"   10.000 → 8.550
lượt B: PHÍ CẮT LỖ −475  "giữ tiền mặt + bán gấp cả danh mục"        10.000 → 9.025
```

### Lỗ đã bịt: autopsy lộ toàn bộ map giữa trận

`GET /matches/:id/autopsy` **không kiểm trận đã xong** — khác `/rounds` và
`/luot`. Đo trên trận thật: đang ở **vòng 1**, endpoint trả `xong:false` kèm đủ
**8 ô** map và cờ `la_tin_gia`. Ai mở F12 là biết trước từng ô sắp lật và tin nào
bịa. Thiệt hại nặng nhất không phải thắng-thua mà là **A1**: "% vốn đặt vào = độ
tự tin" thôi phản ánh niềm tin, tức phá chính bộ dữ liệu là sản phẩm thật.

Comment ngay trên `map_da_lo` vẫn ghi đúng bất biến ("trước đó là thông tin ẩn").
**Bất biến chỉ nằm trong comment là bất biến không tồn tại.** Nay 409 `chua_xong`.

## D3 — lobby biến thiên 4–8 ghế (25/07/2026)

**Không cần migration nào.** Cột `ghe_json` đã được GHI từ ngày đầu (sơ đồ ghế lúc
tạo trận) nhưng **chưa ai ĐỌC** — `replay()` tự suy lại sơ đồ bằng
`soDoGhe(seed, '')`. Nay `layTran` đọc cột đó và truyền vào `replay`.

Việc này giải quyết ba chuyện một lúc:

1. **Lobby 4–8 mở được** (`soGheTuSeed(seed)` → 4..8).
2. **Trận cũ trên prod không hỏng.** Nếu replay suy số ghế từ seed thì mọi trận đã
   lưu (đều 5 ghế) sẽ replay ra 4–8 ghế → xếp hạng, ví, event log đều lệch và không
   cách nào dựng lại. Đọc cột đã lưu là bất biến ngược tuyệt đối.
3. **Vá một cái bẫy đang ngủ:** lúc tạo trận gọi `soDoGhe(seed, uid(actor))`, lúc
   replay gọi `soDoGhe(seed, '')` — hai đối số khác nhau, vô hại CHỈ VÌ `soDoGhe`
   đang bỏ qua `userId`. Bất kỳ ai sau này cho danh tính ảnh hưởng sơ đồ ghế là gãy
   ngay, im lặng.

**Gate D3 — đo 12.000 trận ở TỪNG cỡ bàn** (`npx tsx scripts/holdem_montecarlo.ts 12000 <sốghế>`):

| Bàn | G1 | G2 | G3 | G4 | Đỉnh | Mốc 1/N | Trội |
|---|---|---|---|---|---|---|---|
| 4 | ✓ | ✓ | ✓ | ✗ | 33,0% (cách 0,4) | 25% | 1,32× |
| 5 | ✓ | ✓ | ✓ | ✗ | 27,0% (cách 0,7) | 20% | 1,35× |
| 6 | ✓ | ✓ | ✓ | ✗ | 22,6% (cách 0,9) | 16,7% | 1,35× |
| 8 | ✓ | ✓ | ✓ | ✗ | 17,6% (cách 1,9) | 12,5% | 1,41× |

Mức trội **tương đối** gần như không đổi qua bốn cỡ bàn — đó là bằng chứng việc
chuẩn hoá theo tỷ lệ lobby có thật, không chỉ là đổi công thức trên giấy.

⚠ **Cần founder quyết (không tự sửa):** ngưỡng G1 của D21 là số TUYỆT ĐỐI 30%/45%.
Với bàn 8, mốc ngẫu nhiên chỉ 12,5% nên **G1 gần như không thể fail** dù một chiến
lược trội gấp đôi phần còn lại; với bàn 4, mốc đã là 25% nên 30% chỉ hơn mốc 1,2
lần. Script nay in thêm mức trội tương đối như **dòng bổ trợ**, KHÔNG phải gate —
D21 nói rõ số 30% giữ nguyên, nên biến nó thành điều kiện chặn deploy là việc của
founder.

## D4 — PHẢN THÂN: "THAY Ô — GIỮ LOẠI" (25/07/2026)

**Từ chối hướng sinh map lười.** Hướng hiển nhiên là đổi `sinhMap` từ sinh-một-lượt
sang sinh theo vòng, để ô tương lai phụ thuộc hành vi. Nhưng năm chỗ trong repo
dùng `map.o.length` làm TỔNG SỐ VÒNG (`daKetThuc`, quota cắt lỗ `soLanCatLo`,
`tong_vong` gửi client, bảng đếm bài) → mảng ngắn dần thì trận tự kết thúc ở vòng 2
và quota đổi mỗi vòng. Nặng hơn: `bo_bai_con_lai` đang **công bố** thành phần toàn
bộ tương lai, nên tương lai đổi được là con số đó thành lời khai sai.

> **⚠ VÁ D40 — CỤM D4 SỐNG NGUYÊN VẸN, và nó được THĂNG CHỨC.**
> Phản thân không đọc pot, không đọc cam kết — nó đọc `dong_truoc = demTheoMa(ghe)`,
> tức thành phần danh mục. Chợ liên tục vẫn có danh mục ⇒ cơ chế chạy y nguyên.
> **Cái đổi là VAI TRÒ:** D40 §5.4 chốt phản thân từ *"một cơ chế chạy ngầm"* thành
> **tương tác chính giữa người chơi** — vì sau khi mất "lừa nhau bằng cỡ cược", thứ
> thay thế là *"đoán đám đông đang dồn đâu để đứng phía ngược"*.
> ⇒ Hai hệ quả phải xử lý, cả hai đã ghi ở chỗ khác nhưng gom lại đây cho dễ tra:
> (a) `dong_truoc` **chưa bao giờ gửi ra client** — driver giá mạnh nhất đang vô
> hình, và lá **Đi Ngược** là đường lộ nó ra (`design_dac_quyen_con_lai.md` §2.5-BIS);
> (b) `dong` đếm theo **đầu người**, cần cân nhắc đếm theo **tỷ trọng tiền** sau D40
> (xem ghi chú ở cụm D3 phía trên, và Q1).
> ⚠ Còn "Ngưỡng 60% lobby quá dễ chạm ở bàn nhỏ" (phát hiện 1 bên dưới) thì **nặng
> hơn** sau D40, vì phản thân nay là cửa đấu trí chính chứ không phải hiệu ứng nền.

**Cơ chế đã chọn:** khi chốt phiên vòng k−1, nếu lobby dồn thì ô thứ k bị THAY bằng
một ô **cùng loại** — sự kiện↔sự kiện, giai đoạn↔giai đoạn. Số ô và loại từng ô
không đổi, nên mọi con số đã công bố vẫn nói thật. Thay ở lúc chốt phiên (không
phải đầu vòng k) vì trạng thái được công bố GIỮA hai vòng.

**Không thay ô đang bị telegraph:** ô giai đoạn ngay sau một sự kiện THẬT đã được
hứa "nghiêng về X" (`map.ts` biasing + `telegraph.nghieng_ve`). Sau TIN GIẢ thì
thay được — tin giả vốn được cảnh báo có thể bịa.

### Bẫy từ ngữ trong chính spec D4 — đo ra mới thấy

D4 viết "tăng xác suất **Bong bóng**/Hack sàn". Cài đúng chữ đó rồi đo: bật phản
thân làm đám đông risk-on **GIÀU THÊM 6,9%**. Vì trong bảng số của engine này
`bong_bong` là một cú **BƠM** (btc +2400 · cp_cn +2400 · vn30 +1800). Cú sập là
chuỗi ép SAU đó (`chuoiEp` đặt hai ô "giảm, giảm" nối tiếp bong bóng thật) — mà
phép thay ô không mang theo chuỗi ép, vì mang theo là đổi loại các ô sau và phá
đúng bất biến giữ-loại. Tức tôi vừa **thưởng cho đúng đám đông cần phạt**.

Đã đổi sang các sự kiện thực sự đánh risk-on: `tang_lai_suat` (cả ba mã âm),
`thien_nga_den` (cả ba −1800), `hack_san` (btc −2400). Ý nghĩa kể lại vẫn nguyên —
bong bóng vỡ vào mặt người thổi — chỉ là cú vỡ biểu diễn bằng sự kiện siết/sập.

### Gate D4 — đo CÙNG MỘT BÀN, bật vs tắt (4.000 trận/cấu hình, bàn 5)

Bản đầu của script so "bàn toàn đám đông" với "bàn solo trộn" → ra kết quả NGƯỢC
(đám đông 20.364 vs solo 14.145). Phép đo đó **bị lẫn biến**: hai bàn có thành phần
khác nhau nên dòng tiền đã khác sẵn, dù phản thân có tồn tại hay không. Cùng lớp lỗi
đã làm chẩn đoán sai ba lần ở D1. Phép đo sạch: giữ nguyên bàn, đổi một biến duy
nhất — cờ `PHAN_THAN.BAT`.

| Gate | tat_tay | duoi_da |
|---|---|---|
| D4a cơ chế có nổ (tắt phải = 0) | ✓ 1,70 lần/trận vs 0,00 | ✓ 1,71 vs 0,00 |
| D4b đám đông bị phạt | ✓ 17.995 vs 19.278 (**−6,7%**) | ✓ 26.581 vs 27.553 (**−3,5%**) |
| D4c phân phối không thoái hoá | ✓ trội nhất 21,9%/7 loại | ✓ 21,9%/7 loại |

### Hai phát hiện cần founder biết

1. **Ngưỡng 60% lobby quá dễ chạm ở bàn nhỏ.** Bàn 5 ghế thì 60% = **3 ghế**, mà
   `duoi_da` + `da_dang` + `bat_day` đều ôm vn30 → nhánh risk-on nổ do **trùng lặp
   tình cờ**, không do ai đàn theo ai. Đo được: bàn "trộn" vẫn lệch −9,1%/−13,5% khi
   bật phản thân. Đây là lý do gate D4c ban đầu của tôi (đo "người không dồn theo ai
   có bị đánh oan không") không dùng được — bàn control không phải control.
2. **Meta đã dịch sang phòng thủ.** Gate chính ở bàn 5: đỉnh từ Tất tay 27,0% (cách
   á quân 0,7) → **Phòng thủ 28,4% (cách 4,2)**. Vẫn dưới ngưỡng 8 của D21 nên còn
   là "chen chúc", nhưng khoảng cách giãn gấp 6 lần. Nguyên nhân là **bất đối xứng
   trong chính spec**: nhánh risk-on bị đánh trực tiếp (−1800bp), nhánh phòng thủ chỉ
   bị chi phí cơ hội (`ha_lai_suat` bullish). Làm nhánh phòng thủ đau hơn là đổi ý
   founder nên tôi không tự làm.

`HOLDEM_BALANCE_VERSION` → `balance-v4-D2D3D4`.

## D5 — KHẮC CHẾ thay vì vặn số (26/07/2026)

Chỉ đạo founder 25/07: *"không thể cân bằng tuyệt đối nên hãy nghĩ cách thêm bài hay
tính năng khắc chế và mức độ chịu rủi ro khác nhau"*. Hai cơ chế ra đời từ đó.

**Thẻ ĐI NGƯỢC** — thưởng vị thế lệch đám, phạt vị thế theo đám, có trần hai chiều.
Nó khắc chế BẤT KỲ meta nào đang thắng: chiến lược nào trội thì nhiều người copy, mà
càng đông copy thì thẻ này càng đáng cầm. Meta tự cân bằng bằng lựa chọn người chơi
thay vì bằng tay tôi mỗi mùa.

> **⚠ ĐÍNH CHÍNH — LÁ ĐI NGƯỢC ĐÃ BỊ ĐỊNH NGHĨA LẠI HAI LẦN SAU CỤM NÀY.**
> *Bản D5 (26/07, ở trên):* một **hệ số** — thưởng `DI_NGUOC.THUONG_BP` cho vị thế
> lệch đám, phạt vị thế theo đám.
> *D33 (27/07):* thẻ chiến thuật **không còn là hệ số nhân**, mà là **ĐẶC QUYỀN mở
> không gian hành động**.
> *Founder 27/07 (bản hiện hành):* Đi Ngược = **THẤY ĐỐI THỦ CHỌN GÌ** (2/3/4 người
> theo cấp thẻ), cộng vế "ăn ở phía trống". Toàn văn:
> `docs/khao-co/design_dac_quyen_con_lai.md` §2.5-BIS.
> ⇒ Số `THUONG_BP 320 → 210` và kết luận *"sức mạnh của `nguoc_dong` không đến từ thẻ
> mang tên nó"* ở mục "hai knob mang tên đúng" bên dưới **vẫn là một bài học phương
> pháp đúng**, nhưng nó nói về một lá **không còn tồn tại ở dạng đó**.
> *Phần **RỦI RO ĐỐI TÁC** thì SỐNG* — nó không phụ thuộc pot lẫn hình dạng thẻ.

**RỦI RO ĐỐI TÁC** — cả bàn cùng núp một thẻ phòng thủ thì phần che teo còn một nửa.
Chuyện thật trong tài chính: ai cũng phòng hộ nghĩa là không còn ai bên kia chịu rủi
ro hộ. Chỉ teo phần ĂN, không tăng phần phí — đánh cả hai đầu là biến thẻ phòng thủ
thành bẫy và dạy sai (D22).

### Hai lỗi ĐO đã mắc và đã sửa trong cụm này

1. **Thẻ không ai cầm.** Thêm "Đi Ngược" vào bộ bài nhưng không archetype nào chọn nó
   → Monte Carlo sẽ đo một chiến lược KHÔNG TỒN TẠI rồi báo "không ảnh hưởng". Đúng
   lỗi D2 (gate "cắt lỗ không thành meta" chạy trên đàn chưa con nào hay bỏ). Đã thêm
   archetype `nguoc_dong`.
2. **Tham số không bao giờ chạm.** `RUI_RO_DOI_TAC.NGUONG_BP = 6000` (60% lobby):
   bật và tắt cho ra kết quả Monte Carlo **giống nhau từng chữ số** ở 12.000 trận, vì
   bàn 5 ghế chỉ có 2/5 bot cùng cầm `chan_lo` = 40%. Không bao giờ kích hoạt thì
   không phải "cân bằng lỏng" — là **code chết đội lốt tham số**. Hạ về 4000.
   `tests/holdem_d5.test.ts` nay khoá: ngưỡng phải nằm DƯỚI mức đàn bot thật chạm tới.

### Thêm bot KHÔNG được viết lại lịch sử

`botCuaGhe` suy danh tính trận cũ bằng `(seed + i) % độ_dài đàn`. Thêm archetype thứ
7 là đổi mọi ánh xạ → viết lại đối thủ của mọi trận đã lưu chưa có `bot_id`, im lặng.
Đã đóng băng `BOT_V1_DONG_BANG` (6 id, thứ tự gốc) và nhánh fallback chỉ dùng mảng đó.
Nó không phải cấu hình cân bằng, nó là **dấu vết lịch sử**.

### Đo được (12.000 trận, bàn 5, `balance-v4-D2D3D4`)

| Archetype | Thắng% | Hạng TB |
|---|---|---|
| Đuổi đà | **32,6%** | 2,32 |
| Ngược dòng *(mới)* | 24,9% | 2,73 |
| Đa dạng hoá | 18,5% | 3,09 |
| Phòng thủ | 13,9% | 3,36 |

**Quyết định cân bằng (founder giao quyền 25/07):** giữ nguyên, KHÔNG nerf Đuổi đà.
G1 vẫn ✓ (32,6% với cách á quân 7,7 — dưới ngưỡng 8 của D21). Thẻ Đi Ngược mới ra
mắt đã lên thẳng vị trí á quân 24,9%, tức khắc chế CÓ hiệu lực và người chơi có công
cụ để phản đòn. Nerf thẳng đỉnh bảng là quay lại đúng vòng vặn số mà chỉ đạo bảo bỏ.

⚠ **Cần theo dõi:** cách 7,7 chỉ kém ngưỡng "chạy trốn" 0,3. Nếu mùa sau nó vượt 8
thì lever tiếp theo là **khẩu vị rủi ro** (chưa xây), không phải hạ số Đuổi đà.

⚠ **Không so được với con số 28,4% của Phòng thủ ở cụm D4:** đàn bot đã đổi từ 6 lên
7 thành viên nên hai lần đo khác thành phần. Không phải "cơ chế mới hạ phe thủ".

## D6 — KHẨU VỊ RỦI RO (26/07/2026)

Vế thứ hai của chỉ đạo 25/07 ("mức độ chịu rủi ro khác nhau"). Ba mức chọn ở SẢNH,
chốt lúc tạo trận, **không đổi giữa chừng** — cam kết đổi được bất cứ lúc nào thì
không phải cam kết, ai cũng sẽ bật "quyết liệt" khi đang thắng rồi tắt khi đang thua.

| Mức | Hệ số | |
|---|---|---|
| 🛡 Thận trọng | ×0,75 | khó cháy, khó bứt lên nhất |
| ⚖ Cân bằng | ×1 | đúng như bàn tính |
| 🔥 Quyết liệt | ×1,35 | về nhất dễ hơn, cháy cũng dễ hơn |

**Nhân CẢ HAI CHIỀU — kỳ vọng không đổi, chỉ phương sai đổi.** Ba lý do:
(1) không đẻ ra lựa chọn trội, nếu không nó là nút-bấm-là-đúng chứ không phải khẩu
vị; (2) khi hai lựa chọn cùng kỳ vọng thì thứ duy nhất quyết định là **người chơi
chịu được bao nhiêu biến động** — đúng tín hiệu hành vi A1 muốn bán, lệch kỳ vọng là
làm bẩn phép đo; (3) không bịa alpha, không bẻ động cơ giá (D22).

Đánh đổi vẫn thật: trong trò XẾP HẠNG, phương sai cao vừa tăng cơ hội về nhất vừa
tăng cơ hội cháy. "Cùng kỳ vọng" ≠ "cùng giá trị" khi chỉ hạng nhất mới đáng kể.

> **⚠ VÁ D40 — CƠ CHẾ SỐNG, HẬU QUẢ NẶNG GẤP BỘI. Phải đo lại ba hệ số.**
> Ba mức ×0,75 / ×1 / ×1,35 nhân **cả hai chiều** nên lập luận "kỳ vọng không đổi,
> chỉ phương sai đổi" **vẫn đúng về mặt đại số**. Nhưng nó được hiệu chuẩn ở thời
> `pnl_bp` **không bao giờ chạm `von`** — tức phương sai chỉ dịch thứ hạng.
> Sau D40, cùng ba hệ số đó nhân vào **biến động của NAV thật**, và cháy tài khoản
> có một ngưỡng cứng (`NAV < NGUONG_CHAY`). Với một quá trình có hàng rào hấp thụ,
> nhân phương sai lên 1,35 **KHÔNG giữ nguyên kỳ vọng kết cục** — nó tăng xác suất
> chạm hàng rào, tức mức 🔥 Quyết liệt tự nhiên xấu đi so với bàn tính.
> ⇒ **Ba hệ số phải đo lại**, và tiêu chí đạt vẫn là tiêu chí cũ, đúng nguyên văn lý
> do (1) ở trên: **không mức nào được là lựa chọn trội**. Nếu không thì cột "khẩu vị
> rủi ro" — tín hiệu B2B đắt nhất (A1) — đo áp lực tối ưu chứ không đo khẩu vị.
> ⚠ Đọc kèm cảnh báo D37: tỷ lệ cháy sau D33 đã gần gấp đôi (ngồi im 52,5% · phòng
> thủ 44,2%). Chồng ×1,35 lên một engine mà PnL nay chạm vốn là đúng cảnh báo
> *"vượt ~60% thì hạ hệ số và báo số, không ship"*.

Mắt xích `khau_vi` đứng CUỐI dây chuyền, sau cả Đòn Bẩy: nó là hệ số của toàn bộ
vòng, đặt trước thì hai hệ số nhân dồn nhau và người chơi không đọc được cái nào gây
ra bao nhiêu. Mức ×1 KHÔNG vẽ dòng nào (đỡ rối bảng VÌ SAO).

## Trạng thái gate sau D5+D6 — và hai lần đoán sai đã đo ra

> **⚠ VÁ D40 — BẢNG TRẠNG THÁI DƯỚI ĐÂY LÀ ẢNH CHỤP NGÀY 26/07, KHÔNG PHẢI TRẠNG THÁI
> HÔM NAY.** Sau D37 (nới gọi ký quỹ) · D39 (tương quan một nhân tố) · D40 (đổi mô
> hình lõi), cả bốn ô ✓/✗ đều **chưa có giá trị**. D39 đo lại và thấy *"không gate nào
> đổi trạng thái"* — nhưng đó là D39 đo **trên engine pot**; D40 thì cắt chính engine
> đó. ⇒ **Không trích bảng này làm bằng chứng cho bất cứ quyết định nào sau 27/07.**
> Định nghĩa gate và cách đọc thì vẫn dùng được — xem `docs/khao-co/design_gate_moi.md`.
> ⚠ Riêng **G3 "ngồi im không trội"** phải đọc lại cả ĐỊNH NGHĨA, không chỉ con số:
> sau D40 "ngồi im" nghĩa là **giữ 100% tiền mặt và ăn lạm phát**, chứ không phải
> "buy-and-hold một danh mục". Chi tiết ở `design_gate_moi.md`.

| Gate | | |
|---|---|---|
| G1 không chạy trốn | ✓ | Đuổi đà 32,6% · cách á quân 7,4 |
| G2 gradient kỹ năng | ✗ | oracle 2,87 vs chơi-được 2,91 (cần cách ≥0,25) |
| G3 ngồi im không trội | ✓ | 3,68 |
| G4 tin tức có kỹ năng | ✗ | phớt-tin 2,64 đang TỐT NHẤT — đọc tin đang có hại |

**Hai knob mang tên đúng nhưng KHÔNG phải nguyên nhân — đo, không đoán:**

1. `DI_NGUOC.THUONG_BP` 320 → 210: bot cầm thẻ đó gần như không đổi (24,9% → 25,2%).
   Sức mạnh của `nguoc_dong` không đến từ thẻ mang tên nó.
2. `TY_LE_TIN_GIA_BP` 3500 → 2500 → 1800: G4 gần như đứng yên (phớt-tin 2,63 → 2,62).
   Chính thông điệp gate gợi ý knob này ("TY_LE_TIN_GIA_BP quá THẤP") là **sai**.

**Thứ THẬT SỰ giữ G1 xanh:** `chia_lenh` trong loadout của `nguoc_dong`. Đổi sang
`phong_ho` thì bot tụt 25,2% → 23,6% và G1 **vỡ ngay** (cách 7,4 → 9,0). Xác nhận lại
chẩn đoán D1: khiên phẳng + mã sổ lệnh sâu né được chi phí hệ thống duy nhất của trận.

**G2/G4 KHÔNG tự chỉnh tiếp.** Hai gate này nằm trên trục cường độ-tin-so-với-nhiễu,
tức phải đụng động cơ giá — vùng D22 và đúng phạm vi **Cổng 2** (thí nghiệm Kelly-3-bot)
mà founder đã tách riêng. Vặn mù ở đây là đúng thứ D22 cấm.

## D3 — STRATEGY ATTACHMENT (26/07/2026)

Docstring của `XUNG_DOT` đã viết *"hai thẻ cùng danh mục trên **CÙNG TÀI SẢN** thì
đánh nhau"* từ ngày đầu — thiết kế luôn là attachment, chỉ là cài đặt cũ không có
chỗ nào để biết thẻ nhắm vào đâu nên đành kiểm danh sách phẳng. Cụm này làm câu đó
thành sự thật.

**Biểu diễn: BẢNG PHỤ, không đổi kiểu mảng.** `DanhMuc.gan?: Record<ChienThuatId,
string>` thay vì đổi `chien_thuat` thành mảng cặp. Đổi kiểu mảng bắt sửa ~30 chỗ
`chien_thuat.includes(...)` rải khắp engine/shop/bot/API/test — mỗi chỗ là một cơ
hội đổi hành vi ngoài ý muốn, trong khi thứ thật sự cần thêm chỉ là "thẻ này nhắm
vào mã nào". Một thẻ có ĐÚNG một mục tiêu kể cả khi cầm nhiều bản sao, vì bản sao là
NÂNG CẤP (`capThe`) chứ không phải hai lá độc lập — nên `Record` đúng hình dạng.

**Hai phạm vi thẻ.** 9 thẻ `pham_vi: 'tai_san'` (gắn được) và **2 thẻ
`'danh_muc'`** — `da_dang_hoa` đếm số mã KHÁC NHAU, `di_nguoc` xét cả danh mục so
với lobby. Ép chúng gắn vào một mã là làm chúng vô nghĩa, đúng kiểu "ô chết" mà test
cũ từng bắt ở thẻ phòng thủ.

**Gắn khác mã CHỈ GIẢM, KHÔNG THOÁT (`KHAC_MA_BP = 4500`).** Nếu xung đột chỉ nổ khi
gắn cùng mã thì tránh nó tốn một cú bấm → xung đột gần như biến mất → mất luôn cơ chế
dạy-bằng-nỗi-đau mà D24 §16.5 cố ý dựng (mô phỏng overfitting, và là engine cháy tài
khoản của luật buộc-mua-≥1). Nay cùng mã 100%, khác mã 45%. Cộng hưởng đối xứng: muốn
ăn đủ thì phải chủ động dồn cặp lên cùng một mã — mà dồn cặp lại làm xung đột (nếu có)
cũng đủ 100%. Đó là chỗ attachment thành QUYẾT ĐỊNH chứ không phải ô phải điền.

Hệ số áp cho **cả phần ăn lẫn phần phí**: chỉ giảm phần ăn mà giữ nguyên phí là biến
gắn-khác-mã thành nước đi luôn tệ, tức lại xoá mất lựa chọn.

**Tương thích ngược tuyệt đối:** `gan` optional vĩnh viễn. Trận cũ (`ghe_json` không
có bảng này) ⇒ hệ số 10000 ⇒ ra đúng kết quả nó từng có. `events` append-only.

Gate G1 sau attachment, 6.000 trận mỗi cỡ: bàn 4 ✓ (cách 6,2) · bàn 6 ✓ (7,3) ·
bàn 8 ✓ (4,8).

**CÒN LẠI của cụm này (chưa làm):**
1. **UI chọn mã lúc mua thẻ** — attachment hiện chưa có đường cho người chơi đặt, nên
   nó đang trơ (mọi thẻ chạy như cũ). Không phải hồi quy, nhưng chưa dùng được.
2. **Thu phạm vi tác động của từng thẻ** — `don_bay` vẫn nhân đôi TOÀN BỘ PnL thay vì
   chỉ phần của mã nó gắn. Việc này đòi tách `dungChuoi` thành các rổ theo từng mã,
   là một đợt tái cấu trúc riêng chứ không phải thêm điều kiện.

### D3 attachment — hai việc còn nợ đã làm nốt (26/07/2026)

**1. UI chọn mã lúc mua thẻ.** Bảng chọn hiện NGAY DƯỚI hai mục thẻ trong shop —
đúng chỗ mắt vừa rời sau khi chọn thẻ. Không tách thành bước hai: attachment là một
phần của quyết định mua, tách ra là người chơi quên mất mình chưa gắn.

Chỉ hỏi khi thẻ có `pham_vi: 'tai_san'` VÀ người chơi đang cầm ít nhất một mã. Chưa
cầm mã nào mà bắt chọn thì đó là ô trống không trả lời được — lúc ấy không gắn, và
thẻ tác động toàn danh mục như trước. Phạm vi tra **từ catalog (server)**, không gõ
lại ở client: thêm thẻ toàn-danh-mục mới mà quên sửa client là UI hỏi "gắn vào đâu"
cho một thẻ không có chỗ nào để gắn.

Lọc **ba lớp ở server**, không tin client: chỉ nhận cặp (thẻ đang cầm, mã đang cầm)
và chỉ với thẻ `pham_vi:'tai_san'`. Lọc cả ở tầng NHẬN (`chuanHoaGan`) chứ không chỉ
lúc áp — `action_log` là nguồn dựng lại trận, rác lọt vào log là rác vĩnh viễn.

**2. Thu phạm vi tác động của thẻ.**

- `chia_lenh` / `khop_nhanh` — hai thẻ giảm trượt giá, mà trượt giá vốn tính THEO
  TỪNG MÃ, nên đây là chỗ attachment có nghĩa rõ nhất: khiên đặt ở đâu che ở đó.
  Trước D3 chúng che cả 4 mã cùng lúc.
- `don_bay` — nhân đôi CHỈ phần đóng góp của mã nó gắn.

⚠ **Không phải tái cấu trúc `dungChuoi` thành rổ theo mã** như tôi tưởng lúc đầu.
Dây chuyền ĐÃ mang sẵn `id` tài sản trên mọi mắt xích theo mã (`tai_san`, `echo`,
`crowding`, `hoan_truot`), nên phần đóng góp của một mã cộng lại được từ chính nó.
Rẻ hơn hẳn, và giữ nguyên bất biến "tổng mắt xích khớp PnL" mà test cũ đang canh.

**Bẫy đo trong chính test của tôi:** bản đầu khẳng định "gắn một mã ⇒ delta nhỏ hơn
nhân cả vòng" và ĐỎ (55.057 vs 36.818). Vì nhân cả vòng là nhân cả phần ÂM (trượt
giá, xung đột), nên delta của nó có thể nhỏ hơn phần dương của riêng một mã. **"Thu
phạm vi" không đồng nghĩa với "yếu đi"** — nó mạnh hơn khi mã được gắn đang gánh
phần lãi. Bất biến đúng là *bằng đúng phần đóng góp của mã đó*.

Gate G1 sau khi thu phạm vi, 6.000 trận/cỡ: bàn 4 ✓ (6,2) · 6 ✓ (7,3) · 8 ✓ (4,8).

> **⚠ VÁ D40 — ATTACHMENT SỐNG, và nó vừa trở nên DỄ HƠN. Nhưng `pham_vi` phải rà lại.**
>
> **Sống, mạnh hơn:** cả cụm attachment dựng trên tiền đề *"trượt giá vốn tính THEO
> TỪNG MÃ, nên khiên đặt ở đâu che ở đó"*. Chợ liên tục làm tiền đề đó **đúng hơn**:
> mỗi mã nay có một **cỡ tiền**, nên "phần đóng góp của mã được gắn" là một số có
> tham chiếu thật, không còn là bp-của-cái-gì-không-ai-định-nghĩa (đúng chẩn đoán gốc
> của D40). `don_bay` nhân đôi đúng phần của mã nó gắn ⇒ nay là một phép nhân **trên
> tiền**, không phải trên một tỷ lệ trừu tượng.
>
> **Phải sửa — D40 nói thẳng:**
> 1. `pham_vi` **có TRƯỚC D33 và nay mô tả sai vài lá.** Ví dụ `luot_song` khai
>    `tai_san` nhưng đặc quyền D33 của nó là **giá Bảng điện tử** — chuyện của người
>    chơi, không của mã nào. **Rà lại từng lá theo đặc quyền D33 trước khi code.**
> 2. **Ghim không còn vĩnh viễn.** D40 chốt: thẻ cần đích ngắm cho **chỉnh lại MỖI
>    VÒNG** (đúng nghề: quỹ đổi tỷ trọng phòng hộ theo tuần, không khoá cả năm).
>    ⇒ `DanhMuc.gan` từ một bảng **cố định cả trận** thành một bảng **theo vòng**, và
>    `action_log` phải ghi được lần đổi ghim. Đây là thay đổi hình dạng dữ liệu, không
>    phải thêm một điều kiện — phải làm cùng đợt engine mới, không "để sau" (A8.9).
> 3. `XUNG_DOT` / `KHAC_MA_BP = 4500` giữ được **nguyên tắc** (cùng mã 100%, khác mã
>    45%), nhưng số phải đo lại như mọi số khác.
>
> **Không đổi:** bất biến "tổng mắt xích khớp PnL", `gan` optional vĩnh viễn, và bài
> học đo *"thu phạm vi ≠ yếu đi"* — cả ba là phương pháp, D40 không chạm.

---

## ⚠ CHỜ FOUNDER — phát sinh khi hoà giải sổ này với D40 (A8.2 · A8.7)

**Q1 — Sau D40, `dong` (áp lực đám đông, D3/D4) đếm ĐẦU NGƯỜI hay TỶ TRỌNG TIỀN?**
Hôm nay `dong` nhị phân theo đầu người. Trong chợ liên tục, hai ghế bỏ 100 và hai ghế
bỏ 5.000 ra **cùng một `dong`** — đúng lớp lỗi *"danh mục không có kích cỡ"* mà D40
sinh ra để chữa.
(A) **đổi sang tỷ trọng tiền** (`dong` → tổng vốn của lobby đang nằm ở mã đó, chuẩn
hoá) — **⭐ KHUYẾN NGHỊ**: nhất quán với chính lý do tồn tại của D40, và chen chúc
thật ngoài đời là chen chúc **về tiền**, không phải về số người ·
(B) giữ đếm đầu người (đơn giản, và mọi ngưỡng cũ 60%/40% giữ nguyên đơn vị — nhưng
để nguyên một cần gạt giả ngay sau khi vừa thay một cần gạt giả khác) ·
(C) đếm cả hai, phản thân dùng tiền còn trượt giá chen chúc dùng đầu người
(⚠ hai định nghĩa cho một khái niệm = A8.9 cấm).
*Đây là tham số kinh tế và nó chạm D3 · D4 · D5 cùng lúc ⇒ không tự quyết.*

**Q2 — Quota `soLanCatLo` (8→1 · 12→1 · 16→2) còn giữ không?**
(A) **BỎ** — cắt lỗ nay = bán về tiền mặt, trượt giá đã là quota tự nhiên và đúng bản
chất hơn — **⭐ KHUYẾN NGHỊ** ·
(B) giữ, đổi nghĩa thành "số lần được bán SẠCH danh mục trong một trận"
(⚠ khó giải thích cho người chơi: vì sao bán 99% thì được mà bán 100% thì hết lượt) ·
(C) giữ nguyên như một trần chống spam giao dịch.

**Q3 — Ba hệ số khẩu vị rủi ro (×0,75 / ×1 / ×1,35) giữ nguyên rồi đo, hay hạ trước?**
(A) **giữ nguyên, đo lại, chỉ sửa nếu gate đỏ** — **⭐ KHUYẾN NGHỊ**, đúng kỷ luật
"đo, không đoán" của cả sổ này ·
(B) hạ ×1,35 xuống trước vì đã biết hàng rào cháy làm nó xấu đi
(⚠ sửa trước khi đo là đúng thứ D5/D6 đã chứng minh dẫn tới vặn nhầm knob hai lần).
