# PFM — data and technical architecture

Where the personal-finance (spending ledger) data lives, and why. The backup vault is encrypted end to end, so the server stores ciphertext only, and the only trace of PFM in the behaviour log is coded values, never amounts or free text. The main text explains each choice with its trade-offs and the alternatives considered; SQL, API and test details are in appendix T at the end. Written on 24 Aug 2026, before the code.

*The document below is in Vietnamese, the language of the project.*

## 0. BỨC TRANH MỘT PHÚT

Dữ liệu PFM sống ở **ba ngăn**, mỗi ngăn một chủ, một luật:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ NGĂN 1 — CUỐN SỔ TRONG TÚI (máy điện thoại của user)                     │
│   từng khoản chi/thu · ghi chú · hũ · luật nếu-thì · mục tiêu            │
│   chủ: USER — sửa, xoá tự do; app đọc tại chỗ, không cần mạng            │
└──────────────┬───────────────────────────────────────────────────────────┘
               │ chỉ BA thứ được rời máy, cả ba đều "đã lọc":
               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ NGĂN 2 — KÉT + BẢNG ĐIỂM (server, các bảng pfm_* — XOÁ ĐƯỢC)             │
│   a) KÉT: bản chụp sổ ĐÃ KHOÁ đầu-cuối — server giữ hộ, KHÔNG có chìa    │
│   b) BẢNG ĐIỂM: ngày có mặt · streak · tuần niêm phong · token PFM · cúp │
│      → chỉ đếm NGÀY và SỰ KIỆN, không chứa MỘT SỐ TIỀN nào               │
│   c) CHỈ SỐ THÁNG: vài tỷ lệ % (có consent) — nhân chứng 3 của hồ sơ     │
└──────────────┬───────────────────────────────────────────────────────────┘
               │ nhịp thô (đã điểm danh / luật bắn / giữ-vỡ) — chỉ mã số
               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ NGĂN 3 — SỔ CÁI SỰ KIỆN VĨNH VIỄN (`events` sẵn có — KHÔNG XOÁ, A3.3)    │
│   dòng dạng "user X vừa điểm danh / một luật nào đó vừa bắn"             │
│   → không tiền, không chữ tự do; xoá tài khoản = dòng thành vô danh      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Câu chốt của cả kiến trúc:** *số tiền thật của user không bao giờ rời máy ở dạng
server đọc được* — đây là cửa một chiều P2, nay được chốt thêm một tầng bằng mã hoá
(K2). Mọi thứ server cầm đều thuộc một trong ba loại: **khoá kín** (két), **không có
tiền trong đó** (bảng điểm), hoặc **chỉ là tỷ lệ %** (chỉ số tháng).

---

## 1. CHÍN QUYẾT ĐỊNH KIẾN TRÚC — mỗi cái: nó là gì · các phương án · vì sao chọn · đánh đổi · ảnh hưởng lâu dài

### K1 — Sổ nằm ở máy user, không nằm ở server (local-first) — *đã chốt từ 23/08, nhắc lại vì mọi thứ sau treo trên nó*

- **Nó là gì:** cuốn sổ chi tiêu là DỮ LIỆU CỦA USER, ở trong máy user; server không
  có bảng "giao dịch" nào để mà query.
- **Đã so sánh gì:** ba phương án A/B/C với số liệu đầy đủ ở research
  `pfm-quan-ly-chi-tieu.md` §4 — server-full (kiểu Money Lover) bị loại bằng số: lấp
  trần lưu trữ miễn phí trong ~6 tháng ở mốc 5.000 user, và biến ta thành kho dữ liệu
  tài chính nhạy cảm đúng mùa chưa có pháp nhân.
- **Ảnh hưởng lâu dài:** riêng tư thành ĐIỂM BÁN ("sổ không rời máy" — câu Gen Z ngày
  càng hỏi); chi phí server gần 0 vĩnh viễn; đổi sang app native sau này chỉ đổi lớp
  cất giữ trong máy (đã bọc adapter — T3), không viết lại logic.

### K2 — Két sao lưu MÃ HOÁ ĐẦU-CUỐI ✅ *founder chốt 24/08*

- **Nó là gì:** trước khi gửi bản chụp sổ lên server, máy user KHOÁ nó bằng một chìa
  chỉ user có. Server thành **người giữ két không có chìa** — cầm hộ được, mở không được.
- **Chìa là gì, dùng thế nào:** một **MÃ KHÔI PHỤC** (dãy ký tự ngắn, kiểu
  `XXXX-XXXX-XXXX`) sinh lúc bật PFM, hiện MỘT lần kèm lời dặn chép lại; máy đang
  dùng tự lưu một bản nên ngày thường không phải nhập gì. Đổi máy: đăng nhập + nhập
  mã ⇒ sổ về nguyên. Xem lại mã bất kỳ lúc nào trong Cài đặt (từ máy đang đăng nhập).
- **Phương án tương tự đã cân:**

  | | (A) Mã hoá đầu-cuối ✅ | (B) Nén thuần, ghi chú không vào két | (C) Nén thuần cả ghi chú |
  |---|---|---|---|
  | Ai đọc được sổ nếu DB lộ / admin cố tình | **không ai** | đọc được số tiền, không ghi chú | đọc được tất |
  | Đổi máy | cần nhập mã khôi phục | không cần mã, nhưng MẤT ghi chú | không cần mã |
  | Quên mã + mất máy | mất bản sao lưu (sổ máy cũ còn) | không có khái niệm mã | như B |
  | Két có được vào backup đêm (đẩy lên GitHub) | **được** — chỉ là chữ khoá | KHÔNG được — phải loại | KHÔNG được |
  | Câu luật sư "giữ dữ liệu chi tiêu người 16–17" | nhẹ hẳn: *"chúng tôi KHÔNG THỂ đọc"* | trung bình | nặng nhất |

- **Vì sao chọn A:** "nén" KHÔNG phải "khoá" — file nén ai cầm cũng mở ra đọc được,
  tức phương án B/C thực chất vi phạm tinh thần P9 🔒 (*"không rời máy ở dạng đọc
  được"*) ngay từ thiết kế. A là cách duy nhất làm cho lời hứa riêng tư (K1) **đúng
  cả khi có sự cố**: DB bị lộ, backup bị lộ, hay chính người vận hành tò mò — đều
  không đọc được gì. Đây cũng là chuẩn của mọi app giữ đồ nhạy cảm (password manager,
  Signal).
- **Đánh đổi (khai thẳng):** thêm MỘT bước lúc bật PFM (chép mã); và trường hợp xấu
  nhất — user **mất máy VÀ quên mã** — thì bản sao lưu thành vô dụng, sổ mất thật.
  Giảm nhẹ: mã xem lại được trong Cài đặt bất kỳ lúc nào; Oracle nhắc chép mã ở tuần
  đầu. Cái giá này là cái giá ĐÚNG: giữ chìa hộ user thì "không thể đọc" thành nói dối.
> ⚠ **MỘT VẾ CỦA K2 ĐÃ SAI, K12 (§1b) SỬA:** vế (b) dưới đây nói két vào được bản
> sao lưu đêm. Đúng về AN TOÀN, sai về TẢI — dữ liệu đã khoá không nén được, và nó
> làm bản sao lưu vỡ trần 10 giây ở khoảng 500 người dùng PFM. Két nay đứng NGOÀI
> bản sao lưu đêm. Vế (a) và (c) vẫn nguyên.

- **Ảnh hưởng lâu dài:** (a) câu 2.2/3.4 `hoi-luat-su.md` đổi hẳn tính chất — ta
  không "giữ an toàn" dữ liệu nhạy cảm, ta **không sở hữu khả năng đọc nó**; (b) két
  được vào backup đêm ⇒ thảm hoạ mất DB cũng không mất két của user; (c) bank feed
  sau này không đổi gì — feed đổ vào máy rồi cũng nằm trong sổ đã khoá.
- **Hệ quả ghi vào luật:** P2/P9 file 05 đã được chú thêm cùng ngày (D141).

### K3 — "CÓ MẶT" tách khỏi "SỐ TIỀN": server chỉ đếm ngày và sự kiện

- **Nó là gì:** mọi thứ server cần để vận hành phần thưởng (streak, gói tháng, token
  PFM, cúp) chỉ dựa trên **"hôm nay user có chăm sổ không"** — một cú điểm danh với
  trạng thái thô (D140: trơn · "không tiêu gì" · "tiêu ít" · "có ghi chi tiết") —
  **không bao giờ dựa trên user tiêu bao nhiêu, ghi mấy dòng.**
- **Vì sao đây là quyết định đắt nhất của kiến trúc:** hai luật khó giữ nhất của PFM
  là P5 (thưởng không mua được bằng khối lượng) và P6 🔒 (tự khai vô trùng — không
  thưởng nào đọc số tự khai). Kiến trúc này làm hai luật đó đúng **bằng cấu trúc chứ
  không bằng kỷ luật code**: máy trả thưởng nằm ở server, mà server KHÔNG CÓ số tiền
  nào để mà đọc — muốn thưởng theo tiền cũng không được. Giống tường lửa T↔Q: không
  phải "không nên", là "không thể".
- **Phương án tương tự:** app PFM thường cho server thấy hết rồi thưởng theo dòng ghi
  — kết quả là farm dòng rác lấy thưởng, chính là kịch bản "mua data bẩn" mà
  D99/D101 cấm. Chiều ngược (máy user tự tính thưởng rồi báo lên) vi phạm C4 — client
  không bao giờ tự tính thứ có giá trị.
- **Đánh đổi:** lời Oracle loại "khịa theo nội dung sổ" (lần thứ 3 trà sữa tuần này…)
  bắt buộc phải chạy TRÊN MÁY user chứ server không ghép được — chấp nhận, và thật ra
  thuận: chữ vốn đã ở client theo luật tự điển (D26), content tĩnh có id (P13).
- **Ảnh hưởng lâu dài:** chống gian lận token vĩnh viễn không tốn thêm gì; và khi
  bank feed cắm vào (nhân chứng 4), luật thưởng KHÔNG đổi một chữ — feed chỉ nâng cột
  `nguon` từ `tu_khai` lên `xac_minh`.

### K4 — Token PFM: đồng tiền THỨ BA, sổ cái riêng, tường lửa ba chiều ở tầng DB

- **Nó là gì:** một loại điểm thưởng riêng của PFM (Oracle phát — D138 4-C), chỉ mua
  được đồ trang trí ở shop PFM riêng. Có **sổ cái riêng** ghi từng lần cộng/trừ, và
  máy chủ DB tự kiểm "số dư luôn bằng tổng sổ" — đúng cái khuôn đã chạy ổn cho điểm
  Q (nhiệm vụ) từ migration 0016.
- **Phương án tương tự đã cân:** dùng chung điểm Q? — bị bác: P4 🔒 đã tuyên tường lửa
  BA chiều T ↔ Q ↔ token-PFM, và Q gắn với hệ nhiệm vụ game, trộn vào là hai hệ thưởng
  giẫm chân nhau. Dùng T càng không — T là track record + Kho bạc hữu hạn (A3.4).
- **Vì sao khuôn này:** A3.10 (mọi thay đổi số dư đi qua ledger) là luật gốc của cả
  repo; khuôn "cột số dư + sổ cái + trigger khớp sổ" đã được chứng minh ở Q — dùng lại
  nguyên xi là ít rủi ro nhất, và test tiêm-lỗi sẵn có khuôn để chép.
- **Điểm khác T:** token PFM **không rút từ Kho bạc** — nó được "in" theo luật tất
  định có TRẦN PHÁT/NGÀY (P4). In-có-trần an toàn ở đây vì token PFM chỉ đổi được đồ
  trang trí (A3.9), không phải tiền cược — lạm phát tệ nhất là "nhiều người có nhiều
  skin", không phá kinh tế nào.
- **Con số còn chờ:** trần phát/ngày và tỷ lệ vi-mô/tuần là tham số kinh tế — founder
  chốt (hàng 13-Q5 file 05, A8.2). Kiến trúc chỉ chừa chỗ hằng số, dán nhãn ⏳.
- **Ảnh hưởng lâu dài:** thêm nguồn thưởng mới mùa sau = thêm một `reason` vào sổ
  cái, không đổi cấu trúc; audit "token từ đâu ra" luôn trả lời được bằng một câu SQL.

### K5 — Nhịp PFM vào sổ cái sự kiện vĩnh viễn (`events`) — CHỈ MÃ SỐ ✅ *founder chốt 24/08*

- **Nó là gì:** các cú NHỊP của PFM — điểm danh (kèm trạng thái thô), đặt/sửa luật
  nếu-thì, luật bắn, user đánh dấu giữ/vỡ, niêm phong tuần — được ghi vào `events`
  (bảng sự thật vĩnh viễn của app, A3.3), nhưng dòng ghi **chỉ mang mã số + nhãn
  thô**: "user X có MỘT luật (id 7f3a…) vừa bắn". KHÔNG số tiền, KHÔNG chữ tự do —
  nội dung luật là gì, hũ mức bao nhiêu, chỉ máy user biết.
- **Vì sao phải vào `events`:** P10 — không có nhãn can thiệp từ commit đầu thì câu
  "gương/luật có làm hành vi đổi thật không" **vĩnh viễn không trả lời được** (bài học
  hai-bộ-data D85). `events` là nơi đo nghiêm túc duy nhất của app.
- **Xung đột đã giải:** `events` không xoá được, trong khi P9 🔒 đòi xoá tài khoản =
  sạch dữ liệu PFM. Giải bằng thiết kế dòng ghi: vì dòng **vốn không mang nội dung
  gì về tiền**, nên sau khi xoá tài khoản (đường ẩn danh hoá sẵn có) phần còn lại chỉ
  là xác số học vô chủ — "một người từng có một luật nào đó" — không đọc ra được gì.
- **Phương án bị loại:** bảng PFM riêng xoá được thật — mất tính bất biến của dữ liệu
  đo (sửa được lịch sử can thiệp là hết đo), và trái thẳng P10 + phép thử A9 ("điểm
  danh có niềm tin trong đó").
- **Đánh đổi:** phân tích chi tiết ("luật về trà sữa hiệu quả hơn luật về game?")
  server KHÔNG làm được — chỉ đo được ở cấp "luật thuộc mẫu nào/trục nào" qua
  `mau_id` (mẫu luật tĩnh có id). Chấp nhận: cấp đó đủ cho câu hỏi nghiên cứu, cấp
  sâu hơn là việc của gương trên máy user.
- **Cửa một chiều — vì thế có RÀO CỨNG:** đây là chỗ DUY NHẤT dữ liệu PFM chạm bảng
  không-xoá-được, nên danh mục trường được KHOÁ bằng test: mọi `action_type` họ
  `pfm_*` bị quét — xuất hiện trường tiền hay chuỗi tự do trong payload là test đỏ
  ngay lúc viết, không đợi tới lúc lộ.

### K6 — Chỉ số tháng: CHỈ TỶ LỆ + ĐẾM, không một số tiền tuyệt đối; server nhận theo danh sách trắng

> ⚠⚠ **K6 HẸP HƠN YÊU CẦU MỚI CỦA FOUNDER — CẦN MỘT QUYẾT ĐỊNH K14, CHƯA VIẾT.**
> Founder bổ sung 26/08 (`sua-doi-founder.md` + bản 05 v2.0 → **G7/P15** file 05):
> PFM là *privacy-preserving behavioral data platform*, thu **semantic features** theo
> khung 4 lớp **Context → Intent → Behavior → Outcome**, mỗi feature có
> `schema_version` + `cohort_key`, để sau này bán được **cohort intelligence** (không
> bán raw). K6 dưới đây chỉ cho phép **tỷ lệ % + đếm** — hẹp hơn hẳn: nó KHÔNG chở
> được Context (hoàn cảnh tài chính khai báo), KHÔNG chở được Intent (mục tiêu của hũ:
> loại · horizon · priority), và KHÔNG có `cohort_key`.
> ⇒ **Phần cần thiết kế thêm (K14):** danh mục feature 4 lớp · cách chuẩn hoá text tự
> do của user thành nhãn ngữ nghĩa **NGAY TRÊN MÁY** (raw không rời máy — P2 🔒 không
> đổi) · ngưỡng mẫu tối thiểu mỗi cohort + cấm kết hợp dimension vô hạn (chống tái
> nhận diện) · gate thương mại hoá tách riêng khỏi gate thu thập (D63 mùa này).
> ⚠ Đây là **cửa một chiều** (thứ đã đổ lên server thì đã đổ) ⇒ phải chốt TRƯỚC commit
> đầu, đúng lý lẽ của chính P2. **K14 ĐÃ VIẾT — xem §1c (D148):** founder duyệt 29/08
> (*"Viết đi"*) kèm đính chính quan trọng: KHÔNG bán bây giờ — xây ỐNG sẵn, van bán
> đóng, "bấm nút" sau. Bảng `pfm_chi_so_thang` của T1 bị `pfm_dac_trung` (T7.1) thay.

- **Nó là gì:** cuối tháng, máy user tự tính vài con số đã lọc — ví dụ "đoán hoá đơn
  lệch 18%" (P1), "tỷ lệ chi trong 48h sau ngày tiền về: 62%" (P3), "tháng này 20
  ngày có mặt, 4 ngày khai không-tiêu-gì" — và đẩy lên server (khi đã consent). Đây là
  **nhân chứng thứ ba** của hồ sơ hợp nhất (game · tự khai · sổ) và là nguồn R&D D63.
- **Luật cứng của ngăn này:** trong gói chỉ số **không có số tiền tuyệt đối nào** —
  chỉ tỷ lệ %, đếm ngày, đếm sự kiện. Server kiểm bằng **danh sách trắng trường + biên
  giá trị** (bài học danh-sách-trắng telemetry D61): trường lạ bị TỪ CHỐI ngay cửa,
  không phải "nhận rồi tính sau".
- **Phương án tương tự:** đẩy nguyên sổ lên rồi server tự tính (bị loại từ K1); hoặc
  không đẩy gì hết — bị loại vì mất luôn nhân chứng 3 và mất câu hỏi nghiên cứu quý
  nhất ("chỉ số trong game có TIÊN ĐOÁN pattern sổ thật không").
- **Đánh đổi:** gương trên trang Tài chính khi đọc từ server chỉ nói được bằng tỷ lệ
  ("chi bù cao hơn nền 40%"), không nói "bạn tiêu 5 triệu" — nhưng gương chạy TRÊN MÁY
  vẫn hiện đủ số tuyệt đối vì nó đọc thẳng cuốn sổ local. Không mất gì với user.
- **Ảnh hưởng lâu dài:** kho server không bao giờ tích tụ thành kho PII tài chính —
  giảm vĩnh viễn cả rủi ro pháp lý (C7) lẫn giá trị-cho-kẻ-tấn-công của DB.

### K7 — Điểm danh · streak · tuần: server cầm cân, ngày tính theo giờ Việt Nam

- **Nó là gì:** mỗi ngày một dòng "có mặt" duy nhất (server tự tính "hôm nay" theo
  giờ VN — không tin đồng hồ máy user); trạng thái 4 nấc — trơn (⇒ null) ·
  "không tiêu gì" (⇒ số 0 thật) · "tiêu ít" (⇒ trạng thái riêng) · "có ghi chi tiết"
  (máy báo đúng 1 bit "hôm nay sổ có dòng", không kèm nội dung). Trạng thái trong ngày
  chỉ nâng cấp một chiều (trơn → có khai/có ghi), đúng D139/D140.
- **Streak + bảo hiểm:** chuỗi ngày tính LÚC ĐỌC từ bảng ngày (không lưu số chuỗi
  riêng — hai bản sẽ trôi, D61), kèm **bảo hiểm 1 ngày lỡ/tuần** (Lally 2010: lỡ một
  ngày không phá thói quen; chính Duolingo A/B ra kết luận "cho nghỉ làm chăm hơn") —
  số PLAYTEST-TUNE.
- **Nghi lễ Chủ nhật (3-B/3-C/4-C gộp một):** user bấm "niêm phong tuần" (mỗi tuần
  một lần duy nhất) ⇒ server phán token tuần bằng luật tất định **trên dữ liệu ngăn 2**
  (ngày có mặt, luật giữ được — toàn thứ không có tiền, K3 bảo đảm); máy user ghép
  phần lời Oracle (đọc tuần, callback lời cũ) **từ sổ local**. Một bong bóng, hai
  nguồn, nguồn nào cũng chỉ thấy phần của mình.
- **Vì sao KHÔNG cần cron/scheduler mới:** mọi nhịp PFM đều bắn theo cú mở app của
  user. Khác kèo dự báo (phải khoá ĐÚNG GIỜ kể cả 0 người online — C3), sổ của một
  người không có nghĩa vụ gì khi chủ nó vắng mặt. Ít bộ phận chuyển động = ít thứ hỏng.
- **Đánh đổi:** không có push notification mùa này (đúng research — Oracle nhắc khi
  mở app); tuần không niêm phong thì token tuần đó không phát bù vô hạn (luật cụ thể
  PLAYTEST-TUNE).

### K8 — Két giữ 3 THẾ HỆ TRỌN SỔ, định dạng tự mô tả

> ⚠⚠ **K8 ĐÃ BỊ K10 THAY (§1b).** Đo lại bằng số thật cho thấy hai chỗ hỏng:
> ước lượng cỡ sổ thấp hơn thực tế 2–3 lần, và trần 64 KB VỠ ở khoảng năm thứ hai.
> Giữ nguyên văn K8 ở đây làm vết truy — lý lẽ "trọn sổ chứ không phải lát 3 tháng"
> của nó vẫn ĐÚNG và được K10 kế thừa; cái đổi là CÁCH CẤT, không phải lời hứa.

- **Nó là gì:** "≤3 bản/user" (đã chốt hàng 1) đọc là **3 thế hệ của TRỌN cuốn sổ**,
  xoay vòng (bản mới nhất + 2 bản trước đó phòng hỏng) — không phải "3 tháng gần nhất".
- **Vì sao:** lời hứa số 1 của két là *"đổi máy KHÔNG MẤT SỔ"*. Nếu mỗi bản chỉ là một
  tháng và giữ 3 bản, người dùng 1 năm đổi máy sẽ mất 9 tháng sổ — phản bội đúng lời
  hứa khiến két tồn tại. Số liệu cho phép: trọn sổ MỘT NĂM nén lại ≈ 10–20 KB, ba thế
  hệ vẫn nhỏ hơn một tấm ảnh chụp màn hình.
- **So sánh tải (thành thật, vì đây là chỗ hai phương án cắn nhau):**

  | | 3 thế hệ trọn sổ ✅ | 3 lát tháng gần (bản phác cũ ở research) |
  |---|---|---|
  | Đổi máy | về NGUYÊN sổ | chỉ về 3 tháng gần, cũ hơn mất |
  | Server @150 user | ~7 MB | ~1 MB |
  | Server @5.000 user (nếu ~30% dùng PFM sổ 1 năm) | ~70 MB — đáng kể, còn trong trần | ~9 MB |

  ⇒ Chọn trải nghiệm đúng trước, và ghi **điều kiện kích hoạt** (A11.15) cho ngày
  đông người: tổng dung lượng két vượt 50 MB HOẶC >500 user PFM ⇒ tách "kho năm cũ"
  thành bản riêng ít khi ghi lại. Định dạng bản chụp có số phiên bản + trường phạm-vi
  ngay từ đầu, nên cú chuyển đó **không vỡ gì, không phải dọn lại** — đúng tinh thần
  D64 "mốc năng lực để chọn kiến trúc, không phải mẫu số kế hoạch".
- **Hai máy cùng lúc:** KHÔNG hỗ trợ mùa này (không-mục-tiêu, ghi để khỏi ai đề xuất
  lại): một máy là "máy chính"; máy khác khôi phục là GHI ĐÈ có xác nhận; server chặn
  cú ghi đè mù (máy chưa từng thấy bản mới nhất thì bị báo, phải kéo về trước).

### K9 — Consent PFM là công tắc riêng; xoá là xoá thật, một cú

- **Nó là gì:** bật PFM = tick một ô consent RIÊNG (không dùng lại `research_consent`
  — P9 🔒) + màn giải thích ba ngăn bằng lời thường + sinh mã khôi phục (K2). TẮT =
  mọi đường lên server ngừng ngay, sổ trên máy vẫn dùng được. **XOÁ** = một lệnh xoá
  sạch mọi bảng `pfm_*` của user (két, bảng điểm, chỉ số, token, cúp); thứ duy nhất
  còn là dòng `events` — mà theo K5 nó vốn không mang nội dung, và vô danh hoá khi
  xoá tài khoản.
- **Tài khoản khách:** sổ + gương chạy được ngay trên máy (không cần server); còn
  streak/token/cúp/két đòi tài khoản thật — vì khách tạo được 5 tài khoản/IP/giờ, mở
  đường thưởng cho khách là mở đường farm token + bẩn mẫu (dẻo — founder muốn khác
  thì chỉ đổi một middleware).
- **Ảnh hưởng lâu dài:** "quyền xoá" là thứ luật PDPD và người dùng ngày càng đòi —
  ở kiến trúc này nó RẺ (các bảng pfm_* độc lập, xoá theo user_id một transaction),
  thay vì là món nợ phải retrofit như các app giữ hết trên server.


---

## 1b. BỐN QUYẾT ĐỊNH BỔ SUNG SAU KHI SOI HẠ TẦNG THẬT (K10–K13)

> Phần này viết sau khi đọc trọn cấu hình hạ tầng đang chạy (Vercel · Cloudflare ·
> Supabase · máy sao lưu đêm) và **đo lại bằng số thật** thay vì ước lượng. Ba trong
> bốn quyết định dưới đây là **sửa lỗi của chính bản kiến trúc hôm qua** — chỗ sai và
> vì sao sai ghi đủ ở §3b, không giấu.

### K10 — KÉT CẮT LÁT THEO THÁNG, thay "3 thế hệ trọn sổ" của K8

- **Nó là gì:** thay vì mỗi lần sao lưu đẩy lên **trọn cuốn sổ** (và giữ 3 bản trọn
  sổ), cuốn sổ được cắt thành **từng lát THÁNG** — mỗi tháng một gói nhỏ riêng. Tháng
  đã qua thì **đóng băng, không bao giờ ghi lại**; chỉ tháng đang sống mới được cập
  nhật, và chỉ tháng đó mới giữ thêm 2 bản phòng hỏng.
- **Vì sao đổi — phép đo lật ba con số của bản đầu.** Tôi dựng một cuốn sổ giả đúng
  hình dạng thật (mã giao dịch, mốc thời gian, số tiền VND, ghi chú tiếng Việt) rồi
  nén + mã hoá thật để đo, thay vì ước lượng:

  | | bản đầu (K8) ước | ĐO THẬT |
  |---|---|---|
  | trọn sổ 1 năm, 3 khoản/ngày | "10–20 KB" | **35 KB** — thấp hơn thực tế 2–3 lần |
  | trọn sổ 1 năm, ghi chăm + nhiều ghi chú | — | **57 KB** |
  | trọn sổ 3 năm | — | **103 KB** ⇒ **VỠ trần 64 KB mà tôi đã đánh dấu 🔒** |
  | dữ liệu đã khoá có nén thêm được không | (không xét) | **KHÔNG** — nén lại còn phình 0,1% |

  ⇒ Trần 64 KB của bản đầu không phải một con số an toàn, nó là **quả bom hẹn giờ nổ
  vào khoảng năm thứ hai**: người ghi sổ đều đặn sẽ tới ngày bản sao lưu lặng lẽ không
  gửi lên được nữa — đúng kiểu hỏng tệ nhất, vì nó xảy ra với người dùng TRUNG THÀNH
  NHẤT và không ai biết cho tới lúc họ mất máy.

- **Đo phương án thay thế (cùng một cuốn sổ, chỉ khác cách cất):**

  | | 3 thế hệ TRỌN SỔ (K8 cũ) | LÁT THÁNG (K10) |
  |---|---|---|
  | dung lượng server, sổ 1 năm | 100 KB | **44 KB — tiết kiệm 55%** |
  | dung lượng server, sổ 5 năm | 491 KB | **196 KB — tiết kiệm 60%** |
  | mỗi cú sao lưu đẩy lên bao nhiêu | 35 KB, **tăng mãi theo tuổi sổ** | **3,2 KB, đứng yên vĩnh viễn** |
  | gói lớn nhất có thể tồn tại | 103 KB ở năm 3 ⇒ vỡ trần | **5,2 KB** — một tháng không thể to hơn thế |
  | @1.500 người dùng PFM | 146 MB | **65 MB** |
  | @5.000 người dùng PFM | **487 MB — gần trọn trần 500 MB** | **217 MB** |
  | giá phải trả | — | nén kém hơn **14–16%** (gói nhỏ nén kém hơn gói to) |

- **Vì sao chọn:** nó đổi một khoản phí NHỎ và CỐ ĐỊNH (16% nén) lấy bốn thứ lớn:
  (1) tiết kiệm 55–60% dung lượng — mà dung lượng chính là cái trần PFM đe doạ nhất;
  (2) băng thông mỗi cú sao lưu **không còn tăng theo tuổi sổ** — người dùng 5 năm tốn
  đúng bằng người dùng 1 tháng, tức app thôi tự phạt người trung thành; (3) trần kích
  cỡ thành **bất khả vỡ theo cấu trúc** thay vì một con số phải canh — một tháng không
  thể to hơn một tháng; (4) việc "tách kho năm cũ" mà K8 hẹn cho tương lai thì nay
  **không cần làm nữa** — các tháng vốn đã nằm riêng từ đầu.
- **Đánh đổi khai thẳng:** khôi phục phải ghép nhiều gói thay vì mở một gói (chậm hơn
  vài trăm mili-giây, người dùng không cảm được); và một tháng hỏng thì mất đúng tháng
  đó chứ không mất cả sổ — thật ra đây là điểm CỘNG chứ không phải trừ.
- **Ảnh hưởng lâu dài:** khi nối ngân hàng (nhân chứng thứ tư), dữ liệu đổ vào tháng
  đang sống, các tháng cũ không bị ghi lại — cùng một cấu trúc, không sửa gì.

### K11 — MỘT CỬA CHO MỘT CÚ MỞ APP (ngân sách lượt gọi)

- **Nó là gì:** mọi thứ PFM cần khi người dùng mở app (chuỗi ngày, gói tháng, token,
  cúp, có việc gì đang chờ) **đi chung MỘT lượt hỏi** với dữ liệu người dùng mà app
  vốn đã hỏi — không phải một lượt hỏi riêng.
- **Vì sao — repo đã từ chối đúng hình dạng này một lần, bằng chữ:** ở
  `server/app.ts:1147` có sẵn lời giải thích vì sao một thuộc tính người dùng nằm
  CHUNG thay vì có đường hỏi riêng: *"Tách ra endpoint riêng là thêm một request trên
  mỗi lần mở app, trong một ngân sách 1M request/tháng"*. Bản kiến trúc hôm qua của
  tôi đặt trạng thái PFM thành **lượt hỏi thứ tư** mỗi khi mở app — đi ngược một quyết
  định repo đã cân nhắc và ghi lại.
- **Con số:** bản đầu tôi khai PFM tốn *"~2 cú/ngày/user"*, nhưng chính phụ lục kỹ
  thuật của nó liệt kê **10 đường** và cho phép sao lưu **6 lần/ngày**. Đếm lại đúng:
  **4,2 lượt/ngày** ở nhịp thường, **13,2** ở kịch bản dùng nhiều — bản đầu đếm thiếu
  2–6 lần. Cộng thêm: nền cố định của hệ thống đã ăn ~52.500 lượt/tháng **trước khi có
  một người dùng nào**, và mỗi phiên chơi game tốn ~28 lượt.
- **Ba việc cụ thể:** (1) trạng thái PFM ghép vào lượt hỏi sẵn có; (2) sao lưu hạ từ
  6 lần/ngày xuống **1 lần khi rời app + 1 lần dự phòng** — sổ là thứ đổi vài lần một
  ngày, không phải thứ cần đồng bộ liên tục; (3) nhịp luật/sự kiện **gộp lô** theo
  đúng khuôn hàng đợi đo-đạc đã chạy ổn — ⚠ nhưng CHỈ mượn phần gộp lô, **tuyệt đối
  không mượn phần "đầy thì vứt cái cũ nhất"**: dữ liệu đo-đạc được phép mất dòng, nhịp
  PFM đi vào sổ cái vĩnh viễn thì không.
- **Ảnh hưởng lâu dài:** ở mốc 5.000 người, ngân sách lượt gọi vỡ **114–155%** — nhưng
  phần lớn cái vỡ đó là GAME chứ không phải PFM. Gộp cửa giữ cho PFM không thành giọt
  nước làm tràn ly, và đây là thứ **không sửa lại được rẻ** sau khi client phát hành:
  đường mạng là hợp đồng với mọi bản app đang chạy ngoài kia.

### K12 — KÉT KHÔNG VÀO BẢN SAO LƯU ĐÊM (sửa một câu tôi viết sai ở K2)

- **Tôi đã viết sai gì:** K2 khai một cái LỢI của mã hoá là *"két được vào backup đêm
  ⇒ thảm hoạ mất DB cũng không mất két"*. Câu đó đúng về **an toàn** (dữ liệu đã khoá
  thì đẩy đi đâu cũng kín) nhưng sai về **chịu tải**, và tôi chỉ xét vế đầu.
- **Máy sao lưu đêm thật ra làm gì:** mỗi đêm nó đọc **toàn bộ** các bảng, gộp thành
  một file, nén, rồi đẩy lên một kho lưu trữ bên ngoài — và toàn bộ việc đó phải xong
  trong **10 giây**, giới hạn cứng của nền tảng.
- **Ba lý do két không được vào đó (đo, không đoán):**
  1. **Két là dữ liệu đã khoá nên KHÔNG NÉN ĐƯỢC** (đo: nén lại còn phình 0,1%). Bản
     sao lưu vốn sống nhờ nén; két đi vào đó là đi vào nguyên cỡ.
  2. **Nó còn phình thêm trên đường đi:** cách hệ thống hiện tại đóng gói dữ liệu nhị
     phân làm mỗi gói **nở 3,57 lần trong bộ nhớ** và ~1,3 lần trong file cuối. Chi
     tiết kỹ thuật này tôi không biết khi viết K2; kiểm định độc lập đo lại và xác nhận.
  3. **Máy đọc theo LÔ 5.000 DÒNG, không theo dung lượng** — với bảng thường thì vô
     hại, với két thì một lô có thể là hàng trăm MB nhồi vào bộ nhớ cùng lúc.

  ⇒ Ngưỡng vỡ đo được: **khoảng 500 người dùng PFM là bản sao lưu đêm quá 10 giây**,
  và khi bị nền tảng cắt giữa chừng thì nó **hỏng IM LẶNG** — không kịp báo đi đâu.
- **Mất gì khi loại ra — nói thẳng:** mất đúng một kịch bản: *người dùng mất điện
  thoại **VÀ** cơ sở dữ liệu của ta bị phá huỷ, cùng lúc*. Hai thảm hoạ chồng nhau.
  Bù lại: **két bản thân nó ĐÃ LÀ một bản sao** (bản gốc nằm ở máy người dùng) — sao
  lưu một bản sao mỗi đêm, vĩnh viễn, là trả giá rất đắt cho một kịch bản rất hiếm.
  Năm bảng PFM còn lại (ngày · tuần · token · cúp · chỉ số) **vẫn vào** bản sao lưu:
  chúng nhẹ, nén tốt, và **không dựng lại được** nếu mất.
- **Ảnh hưởng lâu dài:** bản sao lưu đêm giữ được đặc tính "nhỏ, nhanh, nén tốt" — tức
  nó còn tiếp tục bảo vệ được thứ đắt nhất của cả dự án là sổ sự kiện. Điều kiện xem
  lại chuyện này được ghi bằng **con số hệ thống vốn đã tự báo mỗi đêm** (dung lượng
  bản sao lưu), không phải "khi nào đông người".

### K13 — BỐN CÁI ĐỒNG HỒ, KHÔNG PHẢI BA (và một cái chưa ai treo lên tường)

- **Nó là gì:** hiến pháp (A9) và mọi tài liệu đang nói tới **ba** trần: dung lượng
  500 MB · 1 triệu lượt gọi/tháng · số kết nối. Soi hạ tầng thì có trần **thứ tư**, đã
  được ghi từ 17/07 trong tài liệu triển khai nhưng **chưa từng vào bất kỳ bản spec
  nào**: **4 giờ CPU/tháng** của gói miễn phí.
- **Nó có phải báo động không — đo rồi mới nói:** kiểm định độc lập tính lại bằng số
  đo có sẵn trong repo (chi phí engine đo bằng Monte Carlo): một lượt nộp vòng tốn
  **1,2–3,8 mili-giây CPU**, trong khi điểm mà CPU trở thành trần chặn trước là
  **12,2 mili-giây/lượt**. ⇒ Hôm nay **1 triệu lượt gọi vẫn là trần chặn trước**, CPU
  còn rộng. Nghĩa là: **không phải báo động, nhưng phải treo cái đồng hồ đó lên tường**
  — một trần không ai nhìn là một trần sẽ bị đâm vào trong im lặng.
- **Phát hiện kèm theo, rẻ và đáng làm (thuộc phần GAME, không phải PFM):** nhịp tim
  gọi mỗi phút đang ăn **15% ngân sách CPU** cả tháng, trong khi lớp hẹn giờ CHÍNH đã
  chạy sẵn ngay trong cơ sở dữ liệu. Giãn nhịp đó ra vẫn đúng luật C3 mà trả lại ~12%
  ngân sách — **không sửa một dòng code, chỉ đổi một ô cấu hình**. Ghi lại để founder
  quyết; không tự làm vì nằm ngoài phạm vi PFM.
- **Ảnh hưởng lâu dài:** mỗi lượt gọi API tiêu **hai** hạn mức (Cloudflare tính theo
  NGÀY, Vercel tính theo THÁNG) — trần ngày không san phẳng được cú dồn người vào giờ
  cao điểm mà C2 mô tả. Đây là lý do thứ hai để gộp cửa (K11): gộp một lượt gọi là
  tiết kiệm ở cả bốn đồng hồ cùng lúc.


---

## 1c. ỐNG DỮ LIỆU NGỮ NGHĨA + ĐA QUỐC GIA (K14–K15 — D148, founder duyệt hướng 29/08)

> Founder 29/08, sau khi đọc bản G7/P15: *"Viết đi. Nhưng ý t ko phải là bán luôn —
> đó là định hướng mục tiêu. T chỉ viết để bạn biết target mà xây dựng hạ tầng/ống
> dẫn sẵn để sau này scale và bán/lưu trữ thật thì không phải xây lại từ đầu. Kiểu
> sau này chỉ cần bấm nút là mở kho lưu trữ và tổng hợp còn hiện tại xây sẵn kiến
> trúc. À mà định hướng Delphi sau này có thể đa quốc gia nên bạn làm sao để ko quá
> nhiều nợ kỹ thuật cho việc scale sau này là được chứ ko cần phải làm ngay từ bây
> giờ."* ⇒ K14 viết theo đúng tinh thần đó: **xây ỐNG hôm nay, van BÁN đóng** —
> "bấm nút" sau này là bật một tầng đọc, không phải một cuộc migrate.

### K14 — ỐNG NGỮ NGHĨA 4 LỚP: nhãn sinh từ CÚ CHỌN của user, ngay trên máy

- **Nó là gì:** thay vì server chỉ nhận vài tỷ lệ % (K6 cũ), máy user dịch hành vi
  thành **bản ghi đặc trưng** theo 4 lớp — **Hoàn cảnh** (Context: nhóm tuổi, vùng,
  mức tự lập tài chính) → **Ý định** (Intent: hũ này để làm gì · hạn bao lâu · ưu
  tiên mức nào) → **Hành vi** (Behavior: nhịp ghi, giữ/vỡ luật, phản ứng với gương)
  → **Kết quả** (Outcome: mục tiêu đạt bao nhiêu phần, còn dùng sổ không). Ví dụ
  của chính founder: *"Để dành mua laptop phục vụ học tập trong 5 tháng"* → máy dịch
  thành `thiet_bi_hoc_tap · han_vua · uu_tien_cao` rồi CHỈ ba nhãn đó rời máy.
  **Không số tiền. Không chữ tự do. Không gì nhận diện được cá nhân.**
- **Phát kiến chính — nhãn không cần máy đọc trộm:** vì G6/P14 đã bắt mọi điểm cấu
  hình mở bằng MENU 2–4 đường, nhãn ngữ nghĩa là **sản phẩm phụ của chính cú chọn**:
  user chọn "hũ du lịch, 3 tháng" từ menu ⇒ nhãn `du_lich · han_ngan` sinh ra tại
  chỗ, đúng 100% vì user tự chọn. Text tự gõ ngoài menu ⇒ máy GỢI nhãn, user **xác
  nhận** mới tính; không xác nhận ⇒ không nhãn (thiếu mẫu = null, D62 — không đoán).
  Thiết kế UX và thiết kế data ở đây là MỘT việc, không phải hai.
- **Hai cái van, tách nhau bằng cấu trúc:**

  | | van THU (mở từ commit đầu) | van BÁN (ĐÓNG — "bấm nút" sau) |
  |---|---|---|
  | mở bằng gì | consent PFM của từng user (P9 🔒) | quyết định tường minh của founder + luật sư (câu 3.5 mới) |
  | cái gì chảy qua | đặc trưng 4 lớp của TỪNG user (ẩn danh nội bộ, R&D — D63) | chỉ số GỘP THEO NHÓM: %, trung vị, xu hướng, lift |
  | "bấm nút" tốn gì | — | bật một tầng ĐỌC (view tổng hợp + export); **không migrate, không đụng client, không đổi schema** |

- **Phương án tương tự đã cân:** (A) giữ K6 hẹp (chỉ tỷ lệ + đếm) — không chở nổi
  Context/Intent, tới ngày bật bán là đập lại schema, trái thẳng G7 · (B) đổ text
  thô lên server rồi phân loại bằng máy — vỡ P2 🔒, vỡ C7, và chính là con đường
  thành kho PII mà K1 sinh ra để tránh · **(C — chọn):** chuẩn hoá trên máy, server
  chỉ nhận nhãn từ một **sổ đăng ký đặc trưng có version** (danh sách trắng — bài
  học telemetry D61): nhãn lạ, giá trị ngoài miền ⇒ từ chối ngay cửa.
- **Chống tái nhận diện — luật ghi từ hôm nay dù tầng đọc xây sau:** mọi con số rời
  hệ đi qua MỘT cửa tổng hợp duy nhất, cửa đó (1) có **sàn mẫu tối thiểu** mỗi nhóm
  (dưới sàn ⇒ trả "chưa đủ mẫu", không trả số); (2) có **trần số chiều** được phép
  kết hợp trong một câu hỏi (cấm cắt lát vô hạn tới khi nhóm chỉ còn một người);
  (3) chỉ trả **số gộp**, không bao giờ trả dòng cá nhân. Mùa này n≈3–5 ⇒ MỌI nhóm
  đều dưới sàn ⇒ cửa tổng hợp câm hoàn toàn — đó không phải khiếm khuyết, đó là
  bằng chứng van bán đang đóng **bằng cấu trúc** chứ không bằng lời hứa.
- **Đánh đổi khai thẳng:** (1) danh mục nhãn (taxonomy) là việc BIÊN TẬP phải nuôi —
  v1 cố ý nhỏ (~12 loại mục tiêu, 3 mức hạn, 3 mức ưu tiên; PLAYTEST-TUNE, founder
  duyệt danh mục); menu thiết kế tồi thì nhãn sai HỆ THỐNG — nhưng lỗi đó nhìn thấy
  được và sửa được bằng `schema_version`, khác lỗi đoán-từ-text sai âm thầm. (2) Bản
  ghi đặc trưng chi tiết hơn K6 ⇒ dung lượng nhỉnh hơn (~vài trăm byte/user/tháng —
  vẫn không đáng kể cạnh két).
- **Ảnh hưởng lâu dài:** bank feed sau này đổ vào cùng khuôn nhãn với `nguon:
  xac_minh` — hồ sơ hợp nhất tự dày lên, không sửa schema; và vì đặc trưng **không
  mang tiền tệ, không mang ngôn ngữ** (nhãn là ID, chữ ở client — D26), nó tự do
  với chuyện đa quốc gia ngay từ hình dạng.

### K15 — ĐA QUỐC GIA: KHÔNG XÂY HÔM NAY, KHÔNG CHẶN NGÀY MAI

- **Đọc đúng chỉ thị:** không làm tính năng đa quốc gia nào bây giờ — chỉ rà xem
  hôm nay có đang **đổ bê tông** vào chỗ nào mà mai muốn mở nước thứ hai phải đập.
  Rà xong: kiến trúc local-first vốn đã là kiến trúc đa quốc gia rẻ nhất (sổ nằm ở
  máy user nên trải nghiệm KHÔNG phụ thuộc độ trễ tới server Singapore; CDN
  Cloudflare vốn đã toàn cầu), chỉ có **ba chỗ đang chôn hằng số** phải đổi thành
  cột — đổi hôm nay gần như 0 đồng, đổi sau này là một cuộc migrate đau:
  1. **Múi giờ:** K7 đang khai "ngày tính theo giờ VN" như hằng số. Streak/điểm danh
     của user Bangkok hay Berlin mà tính theo giờ VN là sai ngày — và LỊCH SỬ ngày đã
     ghi thì không diễn giải lại được (cửa một chiều). ⇒ thêm cột múi giờ trên user,
     mặc định `Asia/Ho_Chi_Minh`, server tính "hôm nay" theo cột đó (T7). Hôm nay
     mọi user là VN nên hành vi y hệt; mai mở nước mới = đổi một giá trị mặc định.
  2. **Tiền tệ:** sổ trong máy thêm một cột `tien_te` mặc định `VND` (một cột, không
     logic gì kèm — multi-currency vẫn là KHÔNG-mục-tiêu). Đặc trưng rời máy vốn
     không mang số tiền nên tự do sẵn.
  3. **Chiều quốc gia trong nhóm:** bộ chiều của cửa tổng hợp (K14) là danh sách mở
     — thêm chiều `quoc_gia` sau này là thêm một dòng vào sổ đăng ký, không đổi bảng.
- **Cái gì CỐ Ý không làm:** đa ngôn ngữ giao diện (chữ ở client, D26 — sẵn đường
  rồi, làm khi cần) · data residency từng nước · pháp lý từng nước (đi cùng van bán:
  mỗi nước mở là một lượt luật sư riêng — ghi ở câu 3.5) · hạ tầng đa vùng. Tất cả
  có điều kiện kích hoạt tự nhiên: **ngày quyết định mở nước thứ hai**, không sớm hơn.

---

## 2. BẢNG TRA NHANH — CÁI GÌ NẰM Ở ĐÂU

| Thứ | Nằm ở | Server đọc được? | Xoá được? |
|---|---|---|---|
| Từng khoản chi/thu, ghi chú, hũ, nội dung luật, mục tiêu | máy user (+ két đã khoá) | **KHÔNG** | user xoá tự do |
| Bản chụp sổ (két, 3 thế hệ) | server `pfm_luu` | **KHÔNG** (mã hoá đầu-cuối) | có — theo lệnh user / xoá tài khoản |
| Ngày có mặt + trạng thái 4 nấc, tuần niêm phong | server `pfm_ngay` / `pfm_tuan` | có (nhưng **không có tiền trong đó**) | có |
| Token PFM + sổ cái, cúp | server `pfm_token_ledger` / `pfm_cup` | có | có |
| Chỉ số tháng (chỉ tỷ lệ % + đếm) | server `pfm_chi_so_thang` | có (đã consent, danh sách trắng) | có |
| Nhịp thô (điểm danh/luật đặt-bắn-giữ-vỡ/niêm phong) | `events` | có (chỉ mã số, không nội dung) | KHÔNG — vô danh hoá khi xoá tài khoản |

⚠ **Sửa sau khi soi hạ tầng (§1b):** két nay cắt **theo lát THÁNG** chứ không phải 3
bản trọn sổ (K10), và **KHÔNG đi vào bản sao lưu đêm** (K12) — năm bảng PFM còn lại thì có.

---

## 3. HẠ TẦNG THẬT — BỐN CÁI ĐỒNG HỒ, VÀ KIẾN TRÚC ĐỌC THEO CHÚNG

### 3.1. Hệ thống hiện tại, nói bằng lời thường

```
  điện thoại người dùng
        │
        ▼
  CỔNG NGOÀI (Cloudflare) — phát giao diện từ máy chủ gần người dùng nhất.
        │                    Phần này RẺ: không tính vào hạn mức máy chủ.
        ▼
  MÁY CHỦ (Vercel, Singapore) — ĐÚNG MỘT chương trình xử lý mọi thứ,
        │                        mỗi lượt gọi tối đa 10 GIÂY, giữ ĐÚNG MỘT
        │                        đường nối tới cơ sở dữ liệu.
        ▼
  CƠ SỞ DỮ LIỆU (Supabase, Singapore) — 500 MB, đang dùng ~38 MB.
        
  + MỘT máy hẹn giờ chạy ngay trong cơ sở dữ liệu (khoá kèo đúng giờ, C3)
  + MỘT máy sao lưu chạy mỗi đêm 19h, gói toàn bộ dữ liệu đẩy ra kho ngoài
```

Ba đặc điểm định hình mọi thiết kế PFM, và cả ba đều đã được trả giá bằng sự cố thật:

- **Một chương trình, một đường nối.** Máy chủ không giữ trí nhớ giữa hai lượt gọi và
  chỉ có MỘT đường nối tới cơ sở dữ liệu tại một thời điểm. Nghĩa là mọi việc phải làm
  **tuần tự**, và một việc chậm sẽ chắn đường mọi việc khác. Sự cố 12/08 (một lớp kiểm
  tra kích cỡ làm treo cửa đăng nhập của cả app) sinh ra từ đúng ràng buộc này.
- **Trần 10 giây là trần CỨNG.** Quá hạn thì nền tảng cắt ngang, và cắt ngang nghĩa là
  **không kịp báo lỗi đi đâu** — hỏng mà im lặng.
- **Đã có sẵn hai thứ PFM nên dùng lại thay vì xây mới:** một hàng đợi gộp lô ở phía
  máy người dùng (đang dùng cho dữ liệu đo-đạc) và một máy hẹn giờ trong cơ sở dữ liệu.

### 3.2. Bốn cái đồng hồ — PFM ăn vào cái nào

| đồng hồ | trần | ai ăn nhiều nhất hôm nay | PFM ăn thêm | vỡ ở mốc nào |
|---|---|---|---|---|
| **Dung lượng** | 500 MB (đang 38) | sổ sự kiện + lịch sử trận | **nhiều nhất** — két + nhịp vào sổ sự kiện | ~5.000 người dùng PFM nếu giữ K8 cũ; K10 đẩy xa hơn 2 lần |
| **Lượt gọi** | 1 triệu/tháng | nền cố định 52.500 + game ~28/phiên | 4,2–13,2/ngày/người | ~5.000 người (và phần lớn là GAME, không phải PFM) |
| **Giờ CPU** ⚠ | 4 giờ/tháng — **chưa spec nào ghi** | nhịp tim mỗi phút: **15%** | rất ít (PFM chỉ ghi/đọc, không tính toán nặng) | chưa tới; 1 triệu lượt gọi vỡ trước |
| **10 giây/lượt** | cứng | máy sao lưu đêm | **CHỈ nếu để két vào sao lưu** (K12) | ~500 người dùng PFM |

⭐ **Đọc bảng này ra một câu:** PFM **không** đe doạ CPU và **không** đe doạ tốc độ —
nó đe doạ **DUNG LƯỢNG** trước nhất, rồi tới **LƯỢT GỌI**. Nên hai quyết định đắt nhất
của bản này (K10 cắt lát tháng, K11 gộp cửa) nhắm đúng vào hai đồng hồ đó, và K12 gỡ
PFM ra khỏi cái đồng hồ mà nó không có việc gì phải đứng cạnh.

### 3.3. Ba mốc, tính lại đầy đủ (bản đầu đếm thiếu — xem §3b)

> **Cách phát biểu MỐC (founder chốt vòng 2, D173) — ba dòng, không trộn:**
> **Năng lực ĐÃ KIỂM hôm nay: 5.000** (C2 — mọi con số K10/K11 tính trên nó) ·
> **Hướng thiết kế tương lai, KHÔNG cam kết: 50k+** (chưa benchmark — cấm viết
> thành "architecture target") · **Scale trigger:** chạm ngưỡng ĐO ĐƯỢC (két >50 MB
> · >500 user PFM · backup >20 MB/đêm · request >50% trần tháng) thì mới chuyển
> kiến trúc ingestion/analytics — chuyển là một dự án có đo, không phải hệ quả
> của một câu văn.

Giả định ghi rõ: mỗi người dùng PFM ghi 3 khoản/ngày, sổ 1 năm; ở mốc 5.000 thì 30%
dùng PFM; **mọi con số dưới đây đã tính CẢ két, CẢ bảng điểm, CẢ nhịp vào sổ sự kiện.**

| | mùa này (n≈5) | 150 người (trần Discord) | 5.000 người (C2) |
|---|---|---|---|
| dung lượng PFM thêm | **~0,2 MB** | **~9 MB** | **~250 MB** (két 217 + bảng điểm + nhịp) |
| tổng dung lượng | 38 MB / 500 | 47 MB / 500 | ~330 MB / 500 — **còn sống, nhưng phải theo dõi** |
| lượt gọi PFM/tháng | ~600 | ~19.000 | ~190.000 |
| tổng lượt gọi | ~55.000 / 1M | ~120.000 / 1M | **vỡ 114–155%** — do GAME là chính |
| sao lưu đêm | không đổi | không đổi | không đổi (K12 giữ két ngoài) |

⇒ **Mùa này PFM gần như vô hình** (0,04% dung lượng, 1% lượt gọi) — đúng D64: kiến
trúc chọn cho mốc NĂNG LỰC, không phải cho mẫu số hôm nay. Cái phải canh ở mốc C2 hoá
ra **không phải PFM** mà là ngân sách lượt gọi của chính game; PFM chỉ cần không làm
nó tệ thêm, và K11 lo đúng việc đó.

### 3.4. Đường xuống cấp có kiểm soát (C2) — PFM đứng ở đâu khi hệ thống quá tải

Luật sẵn có: *"người đang chơi là bất khả xâm phạm"*. PFM xếp sau, theo thứ tự hi sinh:

```
KHÔNG BAO GIỜ CHẶN   ghi sổ, xem sổ, xem gương    → chạy hoàn toàn trên máy user,
                                                    không cần mạng, nên van không
                                                    chạm tới được kể cả muốn
CHẶN SAU CÙNG        điểm danh                    → 1 lượt/ngày, và là khoảnh khắc
                                                    giữ chân; chặn nó là phá streak
CHẶN TRƯỚC           sao lưu két, đẩy chỉ số       → hoãn được vài giờ, không ai mất gì
```

⚠ **Một thiệt hại phụ phải xử ngay từ thiết kế:** nếu van chặn đúng lúc người dùng
điểm danh, họ mất chuỗi ngày vì lỗi của HỆ THỐNG. ⇒ Cú điểm danh bị van chặn phải được
**ghi nợ ở máy và gửi bù** khi hết tải, và chuỗi ngày tính theo ngày người dùng BẤM chứ
không theo ngày máy chủ NHẬN. Không có vế này thì van tải trở thành cỗ máy phá streak.

---

## 3b. NHỮNG CHỖ BẢN KIẾN TRÚC HÔM QUA SAI — ĐÃ SỬA

> Ghi lại đầy đủ vì hai lẽ: (a) nếp repo là giữ vết, không lặng lẽ sửa; (b) mấy con số
> ở đây tôi đã trình founder hôm qua như số chắc, nên phải nói rõ cái nào không còn đúng.
> Nguồn: soi hạ tầng + tôi tự đo lại + một đợt kiểm định đối kháng (5 nhánh audit,
> 13 lượt phản biện hoàn tất — 12 xác nhận-có-sửa, 1 bác bỏ).

| # | Bản đầu viết | Thực tế | Sửa ở |
|---|---|---|---|
| 1 | trọn sổ 1 năm ≈ "10–20 KB" | **35 KB** (chăm: 57 KB) — thấp 2–3 lần | K10 |
| 2 | trần 64 KB/gói, đánh dấu 🔒 an toàn | sổ 3 năm = **103 KB** ⇒ **vỡ ở ~năm thứ 2** | K10 |
| 3 | "két vào backup đêm là cái LỢI của mã hoá" | đúng về an toàn, **sai về tải** — vỡ trần 10 giây ở ~500 người | K12 |
| 4 | PFM tốn "~2 lượt gọi/ngày/người" | **4,2–13,2** — chính phụ lục có 10 đường và cho sao lưu 6 lần/ngày | K11 |
| 5 | §3 tính tải bằng 2 bảng (két + chỉ số) | thiếu 5 bảng + **thiếu hẳn nhịp vào sổ sự kiện** — tổng thật gấp 4,5–8 lần | §3.3 |
| 6 | "ba trần phải tôn trọng" | **bốn** — thiếu 4 giờ CPU/tháng, đã ghi từ 17/07 mà chưa spec nào chép vào | K13 |
| 7 | trạng thái PFM là một đường hỏi riêng | repo đã từ chối đúng hình dạng này bằng chữ ở `server/app.ts:1147` | K11 |

**Bảy lỗi thiết kế khác đã sửa thẳng trong phụ lục T** (chi tiết ở T5): xoá tài khoản
không chạm bảng PFM nào · chống ghi đè dựa vào đồng hồ máy người dùng (thứ chính K7 vừa
tuyên là không tin được) · sổ cái token thiếu chốt chống sửa ở tầng dữ liệu · để client
tự đặt khoá chính của bảng chỉ số ⇒ số dòng không có trần · cửa chặn khách không phải
hàng rào như tôi tưởng (tài khoản Discord đi lối khác) · nhịp sự kiện không khai trần lô
· xoay 3 thế hệ khiến mỗi lần lưu ghi lại cả ba gói thay vì một.

⚠ **Trung thực về mức độ chắc chắn:** đợt kiểm định bị cắt giữa chừng vì chạm hạn mức,
nên **13 phát hiện đã qua phản biện, phần còn lại thì chưa**. Những gì viết vào K10–K13
và bảng trên đều thuộc nhóm ĐÃ qua phản biện hoặc do tôi **tự đo lại được**; nhóm chưa
thẩm định nằm ở T5 dưới dạng danh sách phải-kiểm-khi-thi-công, không nâng lên thành luật.

---

## 4. VÌ SAO KIẾN TRÚC NÀY KHÔNG PHẢI DỌN LẠI KHI CÁC HÀNG "CHỜ" CHỐT

Từng hàng CHỜ của bảng trạng thái file 05 §3 — chỗ cắm đã chừa sẵn:

| Hàng chờ | Chỗ cắm trong kiến trúc |
|---|---|
| 5 — Tủ cúp 4 họ + 4 luật chống bẩn | bảng `pfm_cup` chở được mọi họ (id tĩnh + cột `nguon` + mùa); luật phát là code trên dữ liệu ngăn 2 — thêm họ không đổi schema |
| 6 — Hồ sơ hợp nhất 3 nhân chứng | nhân chứng 3 = `pfm_chi_so_thang` (K6); hai nhân chứng kia đã có (`ho_so_goi`, `tu_khai`) — hồ sơ là tầng ĐỌC, không cần bảng mới |
| 7 — Phạm vi M1–M4 | toàn bộ tính năng nhìn thấy được (sổ, gương, hũ, streak UI) nằm ở NGĂN 1 (client) — thêm/bớt màn không đổi schema server |
| 8 — Present bias tại trợ cấp | một cú chọn tại checkin có sẵn của game — không đụng ngăn PFM nào |
| 9 — Thang can thiệp 4 bậc | content tĩnh có id ở client (P13) + nhãn đo đã có đường K5 |
| 13 — Ngưỡng khen thật, tỷ lệ token | hằng số config dán nhãn ⏳/PLAYTEST-TUNE — đổi số không đổi cấu trúc |

---

## 5. ⚠ CÒN CHỜ FOUNDER (không chặn duyệt kiến trúc, ghi để không trôi)

1. **Duyệt toàn văn file này** ⇒ nó thành spec nền; hai quyết định K2/K5 đã chốt
   24/08, phần còn lại là đề xuất của agent.
2. **Bước kế** (câu đã hỏi, chưa trả lời trực tiếp): chờ chốt phạm vi M1–M4 (hàng 7)
   rồi mới code — mặc định đang theo hướng này vì đúng gate D133; muốn cho code lớp
   nền trước (migration + két + adapter kho + đường xoá) thì nói một câu.
3. Con số kinh tế token PFM (trần/ngày, tỷ lệ vi-mô/tuần) — hàng 13-Q5, A8.2.
4. ⭐ **CÂU CHẶN, cần anh quyết:** Discord Activity và PWA nhiều khả năng là **hai
   nguồn gốc khác nhau** với trình duyệt ⇒ cùng một điện thoại có thể thành **hai cuốn
   sổ riêng**, và dùng xen kẽ thì mỗi lần lại ghi đè lên nhau. Ba đường:
   **(A)** PFM chỉ chạy ở PWA/web, trong Discord Activity thì chỉ hiện lời mời mở app
   ngoài ⭐ (đơn giản, không mất dữ liệu, Activity vốn là cửa GAME) ·
   **(B)** cho chạy cả hai, chấp nhận hai sổ tách biệt, nói rõ với người dùng ·
   **(C)** làm đồng bộ hai chiều thật — đắt, và là thứ K1 (local-first) cố ý tránh.
   Cần đo xác nhận trước khi chốt, nhưng hướng nên quyết sớm vì nó đổi phạm vi M1.
5. **Ngoài phạm vi PFM, ghi để anh biết:** nhịp tim gọi mỗi phút đang ăn 15% ngân sách
   CPU tháng trong khi lớp hẹn giờ chính đã chạy trong DB — giãn nhịp trả lại ~12%, đổi
   một ô cấu hình, không sửa code (K13). Và máy sao lưu đêm đang **hỏng im lặng được**
   (chỉ 1/5 kiểu hỏng báo ra ngoài) — nợ hạ tầng có sẵn, không phải nợ PFM.
6. ~~K14 viết ngay hay chờ?~~ **ĐÃ TRẢ LỜI 29/08** — founder: *"Viết đi"*, kèm hai ý
   mới: (a) KHÔNG bán bây giờ, G7 là ĐÍCH để xây ống sẵn — "sau này chỉ cần bấm nút";
   (b) DELPHI có thể đa quốc gia — không xây ngay, chỉ đừng để nợ chặn đường. ⇒ K14 +
   K15 ở §1c, thi công ở T7; câu pháp lý về BÁN cohort (cả vế 16–17 tuổi) đã thêm vào
   `hoi-luat-su.md` §3.5. Còn chờ trong cụm này: taxonomy v1 + sàn mẫu/trần chiều
   (câu hỏi đóng ở `thiet-ke-de-xuat/pfm-hanh-vi/pfm-thu-lam-sach-ket-hop-data.md` §6).
7. **File 07 (phản biện founder 29/08, D151)** xác nhận K10–K14 + thêm yêu cầu MỚI:
   phễu can thiệp eligible→…→outcome thành dữ liệu hạng nhất — đề xuất rollup-theo-kỳ
   (T7.5 tương lai) + 3 điểm tranh luận (phạm vi 🔒 không-ghi-đè · ranh đường-đo/
   đường-tiền · mốc 50k) — **vòng 2 (D173) đã xử:** phễu → T7.5 · mốc → cách phát
   biểu ba-dòng ở §3.3 · hai điểm không bị bác (phạm vi P17, ranh đường-tiền) ⇒ mặc
   định theo. Chi tiết: `pfm-dinh-huong-data-doi-chieu.md` §6.

---
---

## PHỤ LỤC T — CHI TIẾT KỸ THUẬT (cho agent thi công; founder không cần đọc)

> Luật đọc phụ lục: đây là bản thi công của §1 — mọi mâu thuẫn giữa phụ lục và thân
> văn bản ⇒ thân văn bản thắng, sửa phụ lục. Mọi số ở đây là khởi điểm PLAYTEST-TUNE
> trừ khi ghi 🔒.

### T1. Schema — migration `0046_pfm.sql` (MỘT transaction, cùng commit với code dùng nó — A11.4)

```sql
-- users: consent riêng (P9 🔒) + số dư token PFM
ALTER TABLE users ADD COLUMN pfm_consent  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN pfm_bat_dau  TIMESTAMPTZ;           -- lần bật đầu
ALTER TABLE users ADD COLUMN pfm_token    INT NOT NULL DEFAULT 0 CHECK (pfm_token >= 0);
-- trigger kiem_pfm_token_khop_so: users.pfm_token == SUM(pfm_token_ledger.delta)
-- (chép khuôn kiem_quest_points_khop_so của 0016, đổi tên bảng)

-- KÉT (K2/K8) — 3 thế hệ xoay vòng, ciphertext opaque
CREATE TABLE pfm_luu (
  user_id    UUID NOT NULL REFERENCES users(user_id),
  the_he     SMALLINT NOT NULL CHECK (the_he BETWEEN 1 AND 3),
  blob       BYTEA NOT NULL CHECK (octet_length(blob) <= 65536),
  schema_v   SMALLINT NOT NULL,          -- phiên bản định dạng bản chụp (client)
  client_ts  TIMESTAMPTZ NOT NULL,       -- lúc client serialize (chống ghi đè mù K8)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, the_he)
);

-- BẢNG ĐIỂM NGÀY (K7) — server-authoritative; ngày = now() theo Asia/Ho_Chi_Minh
CREATE TABLE pfm_ngay (
  user_id    UUID NOT NULL REFERENCES users(user_id),
  ngay       DATE NOT NULL,
  trang_thai TEXT NOT NULL CHECK (trang_thai IN ('tron','khong_tieu','tieu_it','co_ghi')),
  ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ngay)            -- 1 dòng/ngày; UPDATE nâng cấp một chiều
);

-- TUẦN NIÊM PHONG (K7) — tuan = thứ Hai ISO của tuần VN
CREATE TABLE pfm_tuan (
  user_id      UUID NOT NULL REFERENCES users(user_id),
  tuan         DATE NOT NULL,
  token_thuong INT  NOT NULL DEFAULT 0,
  moc_json     JSONB,                    -- id các mốc P5 đạt — KHÔNG số tiền
  niem_phong_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tuan)
);

-- SỔ CÁI TOKEN PFM (K4) — append-only (trigger như quest_ledger)
CREATE TABLE pfm_token_ledger (
  entry_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(user_id),
  delta         INT NOT NULL,
  balance_after INT NOT NULL CHECK (balance_after >= 0),
  reason        TEXT NOT NULL CHECK (reason IN
                  ('moc_su_kien','phan_quyet_tuan','mua_shop','admin_adjust')),
  ref           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pfm_token_ledger_user_idx ON pfm_token_ledger (user_id, entry_id DESC);

-- CÚP (chỗ cắm hàng 5) — cột nguon bank-proof (P8)
CREATE TABLE pfm_cup (
  user_id    UUID NOT NULL REFERENCES users(user_id),
  cup_id     TEXT NOT NULL,              -- id tĩnh, chữ ở client (D26)
  nguon      TEXT NOT NULL CHECK (nguon IN ('tu_khai','xac_minh')),
  season_id  TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cup_id)
);

-- CHỈ SỐ THÁNG (K6) — chỉ tỷ lệ/đếm; server validate danh sách trắng TRƯỚC khi ghi
CREATE TABLE pfm_chi_so_thang (
  user_id         UUID NOT NULL REFERENCES users(user_id),
  thang           DATE NOT NULL,         -- ngày 1 của tháng VN
  chi_so_json     JSONB NOT NULL,
  formula_version SMALLINT NOT NULL,
  nguon           TEXT NOT NULL DEFAULT 'tu_khai' CHECK (nguon IN ('tu_khai','xac_minh')),
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thang, formula_version)
);
-- RLS: ENABLE trên mọi bảng pfm_* (khuôn 0043).
```

- **`events.action_type` nới thêm** (theo ĐÚNG khuôn đọc-rồi-nối của 0016/0019 —
  bẫy CHECK-đóng đã cắn 6 lần): `pfm_bat`, `pfm_tat`, `pfm_diem_danh`, `pfm_luat`,
  `pfm_tuan_niem_phong`. value_json whitelist (K5 🔒): `pfm_diem_danh {trang_thai}` ·
  `pfm_luat {luat_id, mau_id, hanh_dong: dat|sua|xoa|ban|giu|vo}` ·
  `pfm_tuan_niem_phong {tuan, moc_ids}`. Cấm mọi khoá khác — test quét.
- **Backup (`server/backup.ts`):** thêm vào `BACKUP_TABLES`: `pfm_luu` (ciphertext —
  an toàn NHỜ K2-A; nếu ai đổi K2 thì phải rút bảng này ra cùng commit),
  `pfm_ngay`, `pfm_tuan`, `pfm_token_ledger`, `pfm_cup`, `pfm_chi_so_thang`
  (không dựng lại được). Test đối chiếu `pg_tables` sẵn có sẽ đỏ nếu quên khai.
- **Config `config/pfm.ts`** (tách file, không nhét vào economy.ts của T):
  `TRAN_TOKEN_NGAY = ⏳ chờ founder` · `BAO_HIEM_STREAK_TUAN = 1` ·
  `GOI_THANG_NGAY = 20` · `GOI_DAU_NGAY = 7` (endowed progress 3-A) ·
  `BLOB_MAX = 65536` 🔒 · `BLOB_THE_HE = 3` 🔒(hàng 1) · `SO_LAN_LUU_NGAY = 6`.

### T2. API `/api/v1/pfm/*` (Hono, sau auth; mọi route sau middleware `doiPfmConsent` trừ consent)

> ⚠⚠ **DANH SÁCH ĐƯỜNG THẬT NẰM Ở [`docs/api/danh-sach-route.md`](../api/danh-sach-route.md)
> — tệp đó SINH RA từ app (`npm run route:ghi`) và có bộ canh trôi (`npm run route:kiem`).**
> Khối dưới đây là **ý ĐỊNH ban đầu**, giữ lại vì phần chú thích giải thích *vì sao* mỗi
> đường tồn tại; **tên và hình dây của nó đã lệch thực tế** và đừng code từ nó.
> Đo 05/09 (D251): `/pfm/su-kien`, `PUT /pfm/luu`, `GET /pfm/trang-thai`,
> `PUT /pfm/chi-so/:thang` **chưa từng tồn tại** dưới những tên ấy — thật ra là
> `POST /pfm/dong-bo`, `POST /pfm/luu`, trạng thái gộp vào `/auth/me` (T5.9), và `POST /pfm/xoa`.
> ⇒ Đây đúng ca A11.5: bản thứ hai của một danh sách SẼ trôi. Chữa bằng cách **trỏ về
> bản sinh ra**, không phải chép lại nó lần nữa — chép lại là dựng bản thứ ba.

```
POST   /pfm/consent        {bat}            — bật/tắt; bật lần đầu ghi pfm_bat_dau + event pfm_bat
POST   /pfm/diem-danh      {trang_thai}     — server tự tính "hôm nay" giờ VN; upsert nâng cấp
                                              một chiều; CÙNG transaction: events + pfm_ngay
                                              + token vi-mô nếu chạm mốc (trần/ngày)
POST   /pfm/tuan           {}               — niêm phong tuần GẦN NHẤT ĐÃ KẾT THÚC (UNIQUE;
                                              CN = tuần này, T2–T7 = tuần trước — R4/D251,
                                              bản đầu chốt tuần ĐANG CHẠY nên khoá luôn
                                              những ngày chưa tới); phán quyết token tất
                                              định từ pfm_ngay/pfm_tuan/events pfm_luat
POST   /pfm/su-kien        [{...}]          — lô nhỏ nhịp luật (đặt/sửa/bắn/giữ/vỡ), validate enum
PUT    /pfm/luu            (body ciphertext)— rotate thế hệ; chặn content-length TRƯỚC khi đọc;
                                              409 nếu client_ts cũ hơn bản server mới nhất (K8)
GET    /pfm/luu[?the_he]   — bản mới nhất / thế hệ chỉ định
PUT    /pfm/chi-so/:thang  {chi_so_json, formula_version} — danh sách trắng + biên giá trị
GET    /pfm/trang-thai     — streak (tính lúc đọc + bảo hiểm), gói tháng, token, cúp, tuần
POST   /pfm/shop/mua       {item_id}        — cosmetic; trừ qua pfm_token_ledger
DELETE /pfm                — xoá sạch mọi bảng pfm_* của user (một transaction)
```
Rate limit: `chanTanSuat` từng route; `chanKhach` trên mọi route trừ… không trừ gì —
toàn bộ `/pfm/*` chặn khách (K9). Pool `max:1` (D65): không giữ client qua await ngoài
transaction.

### T3. Client (`web/src/pfm/`) — local-first + mã hoá

- `kho.ts` — interface `KhoPfm` (adapter 🔒 A8.9: mai native thay SQLite không viết
  lại logic); `kho_idb.ts` — IndexedDB db `pfm`, stores: `giao_dich`, `hu`, `luat`,
  `ngay`, `meta`. Gọi `navigator.storage.persist()` khi bật PFM (chống eviction
  Safari 7 ngày — research §3.3).
- `sao_luu.ts` — serialize `{schema_v, pham_vi:'tron_so', exported_at, ...stores}`
  → gzip (`CompressionStream`) → **AES-GCM-256** (WebCrypto). Khoá: PBKDF2-SHA256
  600k vòng từ MÃ KHÔI PHỤC (12 ký tự Base32 nhóm `XXXX-XXXX-XXXX`, ~60 bit entropy,
  sinh từ `crypto.getRandomValues`), salt = user_id, AAD = `{user_id, the_he,
  schema_v}`; khoá dẫn xuất cache trong `meta` (máy đã lộ thì sổ local cũng lộ —
  ngang mức rủi ro, không thêm). IV ngẫu nhiên mỗi blob. Đổi mã = re-encrypt + đẩy
  lại 3 thế hệ. Nhịp đẩy: debounce sau phiên ghi + khi mở app nếu có thay đổi,
  ≤ `SO_LAN_LUU_NGAY`.
- `chi_so.ts` — hàm THUẦN tính chỉ số tháng từ sổ (formula_version; null vs 0 vs
  tieu_it theo D140); `luat_engine.ts` — đánh giá nếu-thì trên máy (dan-dat §5);
  content gương/boost/Oracle-PFM = bản tĩnh có id (P13), test quét A10 mở rộng
  chuỗi PFM.

### T4. Test + tiêm lỗi ngược (viết TRƯỚC theo nếp A8.3 cho phần chạm token)

1. **Tường lửa 3 chiều (P4 🔒):** quét schema + code — không FK, không hàm, không
   route nào chuyển T/Q↔pfm_token; trigger khớp-sổ tiêm lỗi (ghi tay users.pfm_token
   ⇒ DB gào). Chép khuôn firewall test D24.
2. **P6-by-construction:** quét mã đường phán thưởng — cấm import/đọc
   `pfm_chi_so_thang`, `tu_khai`, blob; chỉ được đọc `pfm_ngay`/`pfm_tuan`/events.
3. **K5 🔒:** quét value_json mọi action `pfm_*` theo whitelist — thêm trường lạ
   (tiền/chuỗi tự do) ⇒ đỏ ngay lúc viết.
4. **Ba trạng thái D140:** vector tính tay — trơn ⇒ null · khai 0 ⇒ 0 thật ·
   tiêu ít ⇒ riêng, không gộp; đủ cả ở chi_so client lẫn thống kê server.
5. **Két:** giải mã sai mã ⇒ lỗi rõ, không nửa vời; round-trip serialize→mã
   hoá→giải→bằng từng byte; server thử `gunzip` thẳng blob ⇒ PHẢI fail (chứng minh
   không đọc được); content-length > 64KB ⇒ 413 trước khi đọc body; 409 ghi đè mù.
6. **Streak:** vector bảo hiểm 1 ngày/tuần; ngày VN qua nửa đêm UTC không gãy chuỗi.
7. **Xoá sạch:** DELETE /pfm ⇒ mọi bảng pfm_* rỗng theo user; events còn nhưng
   payload không đọc ra nội dung.
8. Tiêm lỗi ngược tối thiểu: gỡ trigger khớp sổ · thêm trường `so_tien` vào một
   event pfm · đổi mã hoá thành gzip thuần · gỡ chanKhach — mỗi mũi phải đỏ ĐÚNG bài.

### T5. SỬA THEO AUDIT HẠ TẦNG (D146) — thay các phần tương ứng của T1/T2

**T5.1 — `pfm_luu` cắt lát tháng (K10), thay bảng ở T1:**

```sql
CREATE TABLE pfm_luu (
  user_id    UUID     NOT NULL REFERENCES users(user_id),
  thang      DATE     NOT NULL,              -- ngày 1 của tháng VN; lát sổ
  the_he     SMALLINT NOT NULL DEFAULT 1 CHECK (the_he BETWEEN 1 AND 3),
  blob       BYTEA    NOT NULL CHECK (octet_length(blob) <= 32768),  -- đo: lát dày nhất 5,2 KB
  schema_v   SMALLINT NOT NULL,
  ver        INT      NOT NULL,   -- SERVER cấp, tăng dần — KHÔNG dùng đồng hồ client
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thang, the_he)
);
CREATE INDEX pfm_luu_user_idx ON pfm_luu (user_id, thang DESC);
```
- Tháng ĐÃ ĐÓNG: chỉ `the_he = 1`, ghi một lần rồi không đụng nữa. Tháng ĐANG SỐNG:
  tối đa 3 thế hệ. ⇒ mỗi cú lưu ghi **một dòng**, không phải ba (sửa lỗi xoay-thế-hệ).
- Trần hạ 64 KB → **32 KB**: đo cho thấy lát dày nhất (5 khoản/ngày + ghi chú 80%) là
  5,2 KB, nên 32 KB đã là biên an toàn 6 lần. Trần thấp cũng chặn được cú nhồi rác.
- ⚠ `ver` do SERVER cấp (`ver = ver + 1` trong cùng câu ghi). Chống ghi đè mù bằng
  **so `ver` client gửi lên với `ver` đang có**, KHÔNG bằng `client_ts` — đồng hồ máy
  người dùng là thứ K7 đã tuyên không tin được, dùng nó làm trọng tài là tự mâu thuẫn,
  và là đúng khuôn "ghi trước khoá sau" mà repo đã cấm.

**T5.2 — `pfm_luu` KHÔNG vào backup (K12):** khai đích danh vào `BANG_PHU_DU`
(`server/backup.ts`) kèm lý do; bài test đối chiếu `pg_tables` sẵn có buộc mỗi bảng
phải có một quyết định, nên "loại có tên" là đúng khuôn. **Năm bảng PFM còn lại VÀO
`BACKUP_TABLES`** (`pfm_ngay`, `pfm_tuan`, `pfm_token_ledger`, `pfm_cup`,
`pfm_chi_so_thang`) — JSON thuần, nén tốt, không dựng lại được.

**T5.3 — Xoá tài khoản phải chạm PFM (lỗi thật của bản đầu):** `DELETE /pfm` là route
riêng mà người vừa xoá tài khoản không còn cửa nào gọi ⇒ đường xoá tài khoản sẵn có
phải gọi CÙNG hàm `xoaSachPfm(userId)` trong cùng transaction. Một hàm, hai lối vào
(D61). Test: xoá tài khoản ⇒ 6 bảng `pfm_*` rỗng theo user.

**T5.4 — Sổ cái token (K4):** thêm THẬT các trigger append-only + trigger khớp sổ vào
DDL, không để ở dạng chú thích "như quest_ledger" (bản đầu chỉ có chú thích). Trigger
khớp sổ chép khuôn `kiem_quest_points_khop_so` của `0016` — vốn đã là
`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`, dùng lại nguyên.
⚠ `users.pfm_token` khai **BIGINT** (không phải INT) cho khớp `bankroll`/`quest_points`
— repo đã dính bẫy "Cannot mix BigInt" một lần (`server/db.ts` đăng ký parser cho int8).
⚠ Trần phát/ngày phải kiểm bằng **một câu ghi có điều kiện**, không SELECT-rồi-INSERT
(TOCTOU — repo đã đo cuộc đua này một lần).

**T5.5 — Chỉ số tháng:** khoá chính do client đặt (`thang`) ⇒ số dòng mỗi tài khoản
không có trần cấu trúc. Sửa: server tự tính `thang` (giờ VN) từ thời điểm nhận, chỉ
nhận tháng hiện tại hoặc tháng liền trước; thêm `CHECK (pg_column_size(chi_so_json)
<= 2048)` cho cân với `blob` (bản đầu bất đối xứng: blob có trần, chi_so không).

**T5.6 — Cổng vào:** `chanKhach` KHÔNG phải hàng rào tạo-tài-khoản như bản đầu tưởng —
tài khoản Discord có `la_khach = false` và đi lối khác. ⇒ trần chống farm phải theo
**tài khoản + IP** bằng `consumeLimit` sẵn có, và có **một bài test ĐỘ PHỦ** liệt kê
mọi route `/pfm/*` rồi ép từng cái phải qua cổng (nếp này thiếu là cách cửa Kho bạc
thứ hai từng bị quên).
⚠ `consumeLimit` **tự xin một đường nối riêng** (`server/auth/rate_limit.ts:75`) ⇒ với
`max: 1`, gọi nó khi đang giữ đường nối khác là treo đúng như sự cố 12/08. Luật thi
công: gọi rate-limit **xong hẳn** rồi mới mở transaction nghiệp vụ.

**T5.7 — Trần thân request:** cửa "chặn theo `content-length` trước khi đọc thân" mà
T2 dựa vào **CHƯA TỒN TẠI** — nó bị gỡ 12/08 và chưa ai làm lại. `PUT /pfm/luu` là
route đầu tiên cố ý nhận thân nhị phân lớn ⇒ phải làm lớp đó **riêng cho route này**
(đọc `content-length`, không tiêu luồng), và nhớ `content-length` có thể VẮNG MẶT
(thiếu ⇒ từ chối, không ⇒ cho qua).

**T5.8 — Đường mạng:** repo chưa từng có route `PUT`/`DELETE` và CORS chỉ mở
`GET/POST/OPTIONS`. ⇒ dùng `POST /pfm/luu` và `POST /pfm/xoa` cho khớp hạ tầng, hoặc
mở rộng CORS có chủ đích — không để lệch âm thầm rồi hỏng ở Discord Activity.

**T5.9 — Gộp cửa (K11):** bỏ `GET /pfm/trang-thai` như một đường riêng; trạng thái PFM
đi kèm payload `/me` sẵn có. `POST /pfm/su-kien` khai trần lô (số dòng/lô, lô/ngày,
byte/lô) — đích đến là sổ append-only nên phải chặt hơn hàng đợi đo-đạc, không lỏng hơn.

### T6. DANH SÁCH PHẢI KIỂM KHI THI CÔNG (audit nêu, CHƯA qua phản biện)

Không nâng thành luật, nhưng phải kiểm trước khi viết dòng code tương ứng:

1. ⭐ **Discord Activity và PWA là HAI nguồn gốc khác nhau ⇒ có thể thành HAI cuốn sổ
   riêng trên cùng một điện thoại.** Nếu đúng, luật ghi-đè của két biến việc dùng xen
   kẽ thành mất dữ liệu lặp lại. **Đây là câu hỏi chặn** — xem §5 câu 4.
2. ⭐ **Xoá dữ liệu trình duyệt xoá cả SỔ lẫn CHÌA** (chìa đang được nhớ trong máy) ⇒
   két trên server thành vĩnh viễn không mở được nếu người dùng chưa chép mã khôi phục.
   K2 không liệt kê kịch bản này. ⇒ bắt buộc có bước xác nhận "tôi đã chép mã" + nhắc
   lại định kỳ, và nói thẳng hậu quả bằng lời thường.
3. Bản cũ do Service Worker phục vụ có thể **chặn vô thời hạn** việc nâng cấp cấu trúc
   kho dữ liệu trong máy (đo được: sự kiện chặn bắn, lời gọi mở không bao giờ trả về).
4. `navigator.storage.persist()` trả về **false** theo mặc định — nó là lời XIN, không
   phải bảo đảm. Không được treo toàn bộ lớp chống mất dữ liệu lên nó.
5. `CompressionStream` đòi Safari/iOS **16.4+** ⇒ phải khai nền tảng tối thiểu hoặc có
   nhánh dự phòng.
6. Mỗi giao dịch mang một mã dài chiếm ~60% dung lượng két — đổi sang mã ngắn là được
   ngay ~2,5 lần miễn phí. (Phép đo của tôi đã dùng mã dài, tức số đo là biên TRÊN.)
7. Khoá mã hoá nên nhớ ở dạng không-trích-xuất-được thay vì byte thô.
8. PBKDF2 600.000 vòng **không** chặn luồng chính (đo được) ⇒ giữ nguyên, không cần
   Web Worker.
9. Phân trang bản sao lưu quét lại toàn bảng mỗi trang — chi phí tăng theo bình phương;
   chưa vỡ, nhưng là lý do thứ hai để két đứng ngoài.
10. Máy sao lưu **hỏng im lặng**: chỉ 1/5 kiểu hỏng báo được ra ngoài, và `/health`
    không khai tuổi bản sao lưu gần nhất. **Đây là lỗ hôm nay, không phụ thuộc PFM** —
    ghi vào nợ hạ tầng (phần 04), không phải nợ PFM.

### T7. ỐNG NGỮ NGHĨA + ĐA QUỐC GIA (K14/K15, D148) — bản thi công

**T7.1 — `pfm_dac_trung` THAY `pfm_chi_so_thang` (T1/T5.5 hết hiệu lực phần đó).**
Chưa có một dòng code nào nên đổi tự do; K6 (chỉ tỷ lệ + đếm) trở thành TẬP CON của
lớp `behavior`.

```sql
CREATE TABLE pfm_dac_trung (
  user_id        UUID  NOT NULL REFERENCES users(user_id),
  ky             DATE  NOT NULL,   -- ngày 1 của THÁNG theo múi giờ user (T7.4); server tự tính
  lop            TEXT  NOT NULL CHECK (lop IN ('context','intent','behavior','outcome')),
  ma             TEXT  NOT NULL,   -- id trong SỔ ĐĂNG KÝ tĩnh (T7.2); server từ chối ma lạ
  doi_tuong      TEXT  NOT NULL DEFAULT '',  -- id hũ/luật (client sinh) khi đặc trưng gắn 1 mục tiêu
  gia_tri        JSONB NOT NULL CHECK (pg_column_size(gia_tri) <= 256),
  nguon          TEXT  NOT NULL DEFAULT 'tu_khai' CHECK (nguon IN ('tu_khai','xac_minh')),
  schema_version SMALLINT NOT NULL,
  cap_nhat_luc   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ky, lop, ma, doi_tuong)
);
-- Đường đọc CẮT NGANG cho nghiên cứu/cohort (vá đúng lỗ audit D146 nêu: mọi PK pfm_*
-- đều bắt đầu bằng user_id nên không đường đọc theo-đặc-trưng nào có index):
CREATE INDEX pfm_dac_trung_ma_idx ON pfm_dac_trung (ma, ky);
```
- Server chỉ nhận `ky` = tháng hiện tại hoặc tháng liền trước (theo múi giờ user, tự
  tính — client không gửi `ky`); trần dòng/kỳ = kích cỡ sổ đăng ký × số `doi_tuong`
  (trần `doi_tuong`/user: 32, PLAYTEST-TUNE) ⇒ số dòng CÓ trần cấu trúc (vá lỗi T5.5).
- ⚠ P6 🔒 soi lại trên bảng mới: đường phán thưởng token bị CẤM đọc `pfm_dac_trung`
  (mở rộng bài test P6-by-construction ở T4.2 — thêm tên bảng này vào danh sách cấm).

**T7.2 — Sổ đăng ký đặc trưng: `config/pfm_dac_trung.ts` (MỘT nguồn, D61).**
```ts
export const SCHEMA_VERSION = 1;
export const SO_DANG_KY = {
  // CONTEXT — khai một lần ở onboarding PFM, sửa được; toàn bộ là CHỌN TỪ MENU
  ctx_tu_lap:      { lop: 'context', mien: ['phu_thuoc', 'ban_tu_lap', 'tu_lap'] },
  ctx_nguon_thu:   { lop: 'context', mien: ['tro_cap_gd', 'luong', 'tu_do', 'khac'] },
  // (age_band/region đã có trên users — không chép lại, cửa tổng hợp JOIN lúc đọc)
  // INTENT — sinh từ cú chọn menu tạo hũ/mục tiêu (P14), gắn doi_tuong
  y_loai:    { lop: 'intent', mien: ['an_uong','di_lai','giao_duc','thiet_bi','du_lich',
               'du_phong','tra_no','qua_tang','su_kien','suc_khoe','choi','khac'] }, // ~12, founder duyệt
  y_han:     { lop: 'intent', mien: ['ngan','vua','dai'] },      // <3 · 3–6 · >6 tháng
  y_uu_tien: { lop: 'intent', mien: ['cao','vua','thap'] },
  y_thiet_yeu: { lop: 'intent', mien: ['thiet_yeu','khong'] },   // nhãn user gắn (nuôi Oracle §7-Q1)
  // BEHAVIOR — K6 cũ nằm trọn ở đây (tỷ lệ/đếm) + chuyển tiếp
  hv_ngay_co_mat:  { lop: 'behavior', kieu: 'dem', max: 31 },
  hv_ngay_co_ghi:  { lop: 'behavior', kieu: 'dem', max: 31 },
  hv_khai_0:       { lop: 'behavior', kieu: 'dem', max: 31 },
  hv_tieu_it:      { lop: 'behavior', kieu: 'dem', max: 31 },
  hv_chi_bu:       { lop: 'behavior', kieu: 'ty_le' },           // P2 gương
  hv_tien_ve_tieu: { lop: 'behavior', kieu: 'ty_le' },           // P3
  hv_doan_lech:    { lop: 'behavior', kieu: 'ty_le' },           // P1 calibration
  hv_tiet_kiem_rong:{ lop: 'behavior', kieu: 'ty_le' },          // P5 (âm được: kẹp [-1,1])
  hv_sua_muc_tieu: { lop: 'behavior', mien: ['tang','giam','khong'] }, // hướng, KHÔNG số
  hv_doi_duong:    { lop: 'behavior', kieu: 'dem', max: 9 },     // P14 — cú đổi đường là data
  hv_phan_ung_guong:{ lop: 'behavior', mien: ['ghi_tiep','tat','khong'] }, // P10 tổng hợp kỳ
  hv_mau_thuan:    { lop: 'behavior', kieu: 'ty_le' },           // research làm-sạch §2
  // OUTCOME — quyết toán cuối tháng / nghi lễ tuần (M3, D139); P6: không sinh thưởng
  kq_dat_muc_tieu: { lop: 'outcome', mien: ['du','gan_du','nua','xa'] }, // bucket, KHÔNG %  chính xác
  kq_con_dung_so:  { lop: 'outcome', mien: ['con','thua'] },
  kq_giu_luat:     { lop: 'outcome', kieu: 'ty_le' },            // luật nếu-thì giữ được
} as const;
```
- Validation server = registry-driven: `ma` lạ / `lop` lệch / giá trị ngoài miền /
  `ty_le` ngoài biên ⇒ 400 từ chối ngay cửa (khuôn danh-sách-trắng D61). Đổi danh mục
  = tăng `SCHEMA_VERSION` + migration nới CHECK nếu cần — dữ liệu cũ giữ version cũ,
  không ghi đè.
- Client `web/src/pfm/dac_trung.ts` — hàm THUẦN `tinhDacTrungKy(soThang, luat, hu)`:
  đọc kho local, trả mảng bản ghi đúng sổ đăng ký; test vector chép tay (nếp A5.2);
  nhãn Intent sinh từ CÚ CHỌN menu lúc tạo hũ, lưu trong kho local cùng hũ — không có
  bước "phân loại" nào chạy lúc tính.

**T7.3 — Cửa tổng hợp cohort (tầng ĐỌC — chưa xây, LUẬT ghi trước 🔒):**
- MỘT hàm/view duy nhất `cohortTongHop(chieu[], loc, ma)`; mọi export/R&D đọc qua nó.
- **`cohort_key` KHÔNG PHẢI CỘT LƯU SẴN — SUY LÚC ĐỌC (quyết định B4, founder
  03/09/2026, D216).** `cohortTongHop` tự ghép khoá nhóm từ `users.age_band` ×
  `users.region` × các mã lớp `context` trong `pfm_dac_trung` (`ctx_tu_lap`,
  `ctx_nguon_thu`, `ctx_khung`…) NGAY LÚC TRUY VẤN — `chieu[]` chính là danh sách
  trục suy được theo cách này. Không có cột `cohort_key` nào trên bảng
  `pfm_dac_trung` (xem T7.1 — schema thật không có, và sẽ KHÔNG thêm). Vì sao:
  một khoá lưu sẵn là BẢN SAO THỨ HAI của một sự thật đã nằm trọn trong
  `age_band`/`region`/`ctx_*` (D61 — bản sao sẽ trôi khỏi ba trường gốc mỗi lần
  một trong chúng đổi mà khoá không được tính lại), và nó ĐÓNG BĂNG taxonomy
  cohort tại thời điểm GHI trong khi chính taxonomy còn PLAYTEST-TUNE (K14: "v1
  cố ý nhỏ… founder duyệt danh mục"). Suy lúc đọc thì đổi cách nhóm = sửa một
  hàm, không phải một lượt backfill hàng triệu dòng đã ghi. Người thi công
  `cohortTongHop`: ĐỪNG thêm cột `cohort_key` — nếu thấy thiếu, đó là dấu hiệu
  hàm đang thiếu một chiều JOIN, không phải thiếu một cột.
- `SAN_MAU_COHORT = 20` · `TRAN_CHIEU = 4` (cả hai PLAYTEST-TUNE, ghi ở
  `config/pfm.ts`): nhóm dưới sàn ⇒ trả `{du_mau: false}` không kèm số; quá trần
  chiều ⇒ từ chối. Test: n=5 hiện tại ⇒ MỌI truy vấn trả không-đủ-mẫu (bằng chứng van
  đóng); tiêm lỗi hạ sàn về 1 ⇒ đỏ.
- **Chống HIỆU SỐ (D173, đi kèm P18):** kết quả gateway LÀM TRÒN về bội
  `BUOC_LAM_TRON = 5` (PLAYTEST-TUNE) và sàn k áp cho cả PHẦN BÙ trong lát cắt
  cha — `n_cha − n_cohort` dưới sàn ⇒ nén cả kết quả. Không có rào này thì hai
  truy vấn HỢP LỆ trừ nhau tách được nhóm nhỏ hơn sàn (25 − 22 = 3 người). Test
  dựng đúng ca đó ⇒ cả hai phía bị chặn/tròn.
- Van BÁN: cờ env `PFM_COHORT_XUAT` mặc định tắt + điều kiện ghi trong doc: chỉ bật
  sau chữ ký founder + trả lời câu 3.5 `hoi-luat-su.md`. Bật cờ ≠ code mới.

**T7.4 — Đa quốc gia, ba cột rẻ (K15):**
```sql
ALTER TABLE users ADD COLUMN mui_gio TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';
```
- K7/T5.1 sửa theo: MỌI chỗ "ngày giờ VN" (`pfm_ngay.ngay`, `pfm_tuan.tuan`,
  `pfm_dac_trung.ky`) đổi thành "ngày theo `users.mui_gio`" — hôm nay giá trị mặc
  định làm hành vi Y HỆT bản cũ; test khoá: user đổi `mui_gio` không làm gãy streak
  đã có (ngày cũ đã chốt là DATE, không tính lại).
- Kho local (T3): cột `tien_te TEXT DEFAULT 'VND'` trong store `giao_dich` + trường
  `tien_te` trong định dạng blob — một cột, không logic.
- A8.8 (hiển thị Asia/Ho_Chi_Minh) KHÔNG đổi mùa này — nó là chuyện hiển thị của app
  tiếng Việt; cột `mui_gio` là chuyện chốt NGÀY của dữ liệu.

**T7.5 — Phễu can thiệp (file 07 §9 + vòng 2, D173): NĂM NẤC TÁCH BẠCH TỪ NGÀY 1.**
Eligible ≠ assigned ≠ exposed — thiếu nấc nào là selection bias đội lốt experimental
data (nguyên văn vòng 2), kể cả khi policy đang tất định:

- Bốn `ma` lớp behavior trong `pfm_dac_trung` (`doi_tuong` = content id P13, chốt
  theo KỲ từ dòng thô telemetry — A9 nguyên, thô vẫn 90 ngày):
  `iv_du_dieu_kien` (đủ điều kiện) · `iv_duoc_chon` (hệ thống CHỌN — ghi RIÊNG dù
  policy tất định; policy id đi theo `schema_version`) · `iv_phoi_nhiem` (exposed =
  content RENDER THẬT trên màn, không phải được xếp hàng) · `iv_tuong_tac` (engaged
  = chạm/mở/đọc chi tiết).
- adopted = hành động theo gợi ý → `events` (P10/K5, thêm trường `tu_goi_y`:
  content id vào whitelist K5) · outcome = lớp `kq_*` sẵn có, nối theo kỳ.
- Đo lift mùa này: within-person theo kỳ (P11) + exposed vs eligible-không-exposed
  (quasi); ngày đủ n để randomize thì trường assigned đã đứng sẵn.
- Đăng ký 4 `ma` này vào sổ T7.2 khi thi công (một nguồn — khai ở đây, T7.2 trỏ về).
