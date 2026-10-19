# GIỚI HẠN HẠ TẦNG — app chịu được bao nhiêu người, gãy ở đâu, gãy theo thứ tự nào

> Viết 31/08/2026 (D207). Nguồn: đọc code + hạn mức công bố của nhà cung cấp.
> ⚠ **CHƯA CÓ LOAD TEST NÀO TRONG REPO.** Mọi con số dưới đây là TÍNH TỪ HẠN
> MỨC, không phải ĐO. Chỗ nào là ước tính đều ghi rõ. Đừng trích ra ngoài như
> số đo — §7 ghi cách đo thật khi cần.

---

## 1. TRẢ LỜI NGẮN

| Câu hỏi | Trả lời |
|---|---|
| Vài nghìn người tràn vào thì app chết không? | **Không crash — nhưng ngừng phục vụ.** Và ngừng trong VÀI GIÂY, không phải vài ngày |
| Thứ gì gãy trước? | **Đã tìm ra 05/09/2026** (§Đo-05/09): trần cứng là **200 client đồng thời của pooler** — vượt là `EMAXCONN` ⇒ HTTP 500, không xuống cấp dần. Nhưng thứ người dùng cảm được trước đó từ rất lâu vẫn là **cold start ~2,2 giây** |
| Trần thực tế hiện nay | ước **~200–250 người chơi đều mỗi ngày** (trần quota Vercel — VẪN là ràng buộc chặt nhất) · **300 người cùng lúc** (trần cổng, nâng từ 150 sau phép đo 05/09) |
| Dữ liệu có mất không? | **Không.** `events` append-only, tiền đi trong transaction. Hỏng kiểu *không vào được*, không phải *vào rồi mất tiền* |
| Đã phòng gì? | Cổng hàng chờ ở Cloudflare Worker (D207) — §5 |
| Còn thiếu gì? | ~~Load test đường có transaction~~ — đã đo 11/10 (800 đồng thời, 0 `EMAXCONN`). Nay thiếu: **trần trận/ngày** (bộ nhớ Vercel do minigame ~55–60 trận/ngày — §"Đo 11/10/2026") · kiến trúc cho mốc C2 (§6) |

---

## 2. TRẦN CỨNG

> ⚠ Tiêu đề từng ghi "BỐN trần cứng" — bỏ số đếm 03/09/2026 (D214) sau khi thêm
> ba dòng mới bên dưới: một con số cứng trong tiêu đề là một bản sao thứ hai
> của phép đếm hàng bảng, và nó SẼ trôi mỗi lần có ai thêm dòng mà quên sửa số
> (đúng bài học D61 — xem `docs/giai-doan.md` "vì sao không chép số").

| Tầng | Trần | Ghi chú |
|---|---|---|
| **Vercel Hobby** | 1 triệu request/tháng | ≈ 33.000/ngày. **Ràng buộc chặt nhất về LƯỢNG** |
| **Vercel Hobby** | CPU 4 giờ/tháng · bộ nhớ 360 GB-h/tháng | Phát hiện D146 — không nằm trong bảng này tới 03/09/2026 dù đã ghi ở `docs/dac-ta/04-ha-tang-bao-mat.md` §F. Nguồn: vercel.com/docs/functions/usage-and-pricing (đọc lại 03/09/2026) |
| **Supabase Free** | 500 MB database | ~30 MB/tháng nếu ghi gọn (A9) ⇒ còn xa |
| **Supabase Free** | 5 GB egress/tháng | payload phải nhỏ; đừng cho client đọc thẳng PostgREST |
| **Supabase pooler (Supavisor)** | **200 client đồng thời** | ⚠ SỬA 03/09/2026 (D214): bản trước ghi "~15" — SAI. 15 là `default_pool_size` (xem dòng dưới), không phải trần client. Nguồn: supabase.com/docs/guides/platform/compute-add-ons |
| **Supabase pooler (Supavisor)** | `default_pool_size` = 15 kết nối THẬT tới Postgres | Pooler đa hợp (multiplex) tối đa 200 client xuống 15 kết nối backend; vượt 15 (mà dưới 200) là XẾP HÀNG trong pooler, không phải lỗi ngay — xem §3① |
| *(Cloudflare Workers, đích bậc `c2_5000`)* | 100.000 request/ngày | Chỉ tính `/api/*` + `/admin`; **asset tĩnh không tính**. Cao hơn trần Vercel nên không bind trước |
| *(Cloudflare Workers, đích bậc `c2_5000`)* | 10ms CPU/lượt gọi (gói free) | Đo được 03/09/2026 (D214, `scripts/do_cpu_vong_cuoi.ts`) — xem §"Đo 03/09/2026" |
| *(Cloudflare Hyperdrive, đích bậc `c2_5000`)* | 100.000 truy vấn DB/ngày (gói free) | **Hyperdrive CÓ trong gói free** (không cần nâng cấp) — đo được 03/09/2026 (D214, `scripts/do_sql_moi_tran.ts`). Nguồn: developers.cloudflare.com/hyperdrive/platform/pricing |

⚠ `vercel.json` khai `functions.api/index.ts.maxDuration: 60` (giây; **10 → 60 ở D466**, nhánh minigame — dòng nhịp của màn sống ~38 s và tự đóng ở 45 s, `DONG_TOI_DA_MS`) — đây là
GIỚI HẠN TỰ ĐẶT, không phải trần platform: Vercel Hobby với Fluid compute cho
tới 300 giây (mặc định VÀ tối đa đều là 300s — vercel.com/docs/functions/
configuring-functions/duration, đọc lại 03/09/2026). Hạ xuống 10s là quyết
định của repo (chặn sớm một request treo lâu), không phải thứ Vercel bắt buộc.
⚠ Giá của 60 s: chỉ có MỘT function, nên MỌI endpoint giờ được treo tới 60 s trước khi bị cắt (trước là 10 s) — một request kẹt (vd chờ kết nối DB) ăn
bộ nhớ cấp phát gấp 6 lần trước khi chết. Dòng nhịp không giữ kết nối DB (đọc màn một câu rồi trả), nên nó không kéo dài chỗ kẹt ①.

---

## 3. THỨ TỰ GÃY — đọc kỹ, thứ tự này phản trực giác

### ① Kết nối DB — CƠ CHẾ THẬT CHƯA ĐO (sửa 03/09/2026, D214 — bản trước sai một con số cốt lõi)

⚠ **Bản D207 ghi "~15 kết nối đồng thời" làm trần, và cả đoạn mô tả cơ chế bên
dưới suy ra từ con số đó.** Tra lại 03/09/2026: Supabase Nano free cho **60 kết
nối trực tiếp** và **200 client đồng thời qua pooler (Supavisor)** — không
phải ~15 (supabase.com/docs/guides/platform/compute-add-ons). Con số 15 vẫn có
thật, nhưng nó là `default_pool_size`: Supavisor NHẬN tới 200 kết nối phía
client (Vercel), rồi tự đa hợp (multiplex) chúng xuống một nhóm NHỎ HƠN nhiều
kết nối THẬT tới Postgres phía sau — mặc định 15. Vượt 200 mới là kết nối bị
TỪ CHỐI; vượt 15 (mà dưới 200) là XẾP HÀNG bên trong pooler, không phải lỗi
ngay như bản trước mô tả.

`api/index.ts` mở pool `max: 1` mỗi function instance, `connectionTimeoutMillis: 10_000`
— dòng này KHÔNG đổi, nhưng ý nghĩa của nó phụ thuộc giả thuyết nào đúng bên dưới.

⇒ **HAI GIẢ THUYẾT — và một phép đo 03/09/2026 đã bác được một phần, xem dưới:**

- **H1 — trần thật là SỐ INSTANCE Fluid compute bung ra**, không phải trần
  pooler. Fluid compute (mặc định cho dự án tạo sau 23/04/2025 — dự án này tạo
  17/07/2026, nên đang chạy Fluid) có thể gộp nhiều request đồng thời vào MỘT
  instance thay vì luôn bung instance mới cho mỗi request. Nếu vậy, số kết nối
  DB thực tế mở ra dưới tải có thể THẤP HƠN nhiều so với số request đồng thời,
  và cả hai trần pooler (15 lẫn 200) có thể còn xa mới chạm.
- **H2 — trần thật là `default_pool_size` = 15 giao dịch đồng thời.** Supavisor
  ở transaction mode chỉ giữ một kết nối Postgres thật trong đúng thời gian một
  transaction chạy; giao dịch thứ 16 trở đi XẾP HÀNG bên trong pooler (không
  lỗi ngay) tới khi có chỗ trống — độ trễ tăng dần, không phải "đứng hình rồi
  hỏng" ngay lập tức.

**ĐO 03/09/2026 (D214) — 30 request ĐỒNG THỜI vào `GET /api/v1/health` trên prod**
(đường thật tới `api.example.vercel.app`; `/health` khai sẵn `tai.pool` nên đọc được
trạng thái pool của ĐÚNG instance vừa phục vụ mình — ⚠ phép đo này chạy TRƯỚC
D444 (28/09), lúc `tai.pool` còn công khai. Từ D444, `tai.pool` nằm ở phần CHI
TIẾT của `/health`, chỉ đọc được khi request kèm header `x-tick-secret` khớp
`TICK_SECRET` (xem `server/app.ts`). Muốn LẶP LẠI phép đo này (hay đo bằng
`scripts/do_tai_dong_thoi.ts` ở §"Đo 05/09/2026" dưới) sau D444 thì phải đặt
biến môi trường `TICK_SECRET` trước khi chạy script — ĐÃ SỬA cùng D444: script
tự gắn header khi biến có mặt, và in MỘT cảnh báo rõ (không lặng lẽ in
`undefined`) nếu thiếu biến, thay vì đọc `pool`/`cho_toi_da`/`lanh` sai mà
không báo gì):

| đo được | số |
|---|---|
| Thành công | **30/30 trả 200**, 0 lỗi, 0 timeout |
| Cả đợt | 2,45 giây |
| Cụm NHANH | 14 request, 320–650 ms, pool `total=1 idle=1 waiting=0` |
| Cụm CHẬM | 16 request, 2,07–2,43 giây, pool `total=0` — instance LẠNH |
| `waiting > 0` | **không một lần nào** |

Ba điều đọc ra, cả ba đều khác bản D207:

1. **Đợt tràn được hấp thụ bằng cách BUNG INSTANCE MỚI**, không phải bằng cách nhồi
   nhiều request vào một instance ⇒ ở mức đồng thời này, H1 không phải thứ đang xảy ra.
2. **Không kết nối nào phải chờ trong process** ⇒ chưa chạm trần pooler nào, và câu
   "request thứ 16 đợi 10 giây rồi ăn lỗi" của bản D207 KHÔNG xảy ra.
3. ⭐ **Thứ người dùng cảm được ĐẦU TIÊN khi đông là COLD START ~2,2 giây** trên hơn
   nửa số request — không phải lỗi kết nối. Hiệu ứng bậc nhất này chưa tài liệu nào
   của repo nhắc tới.

⚠ **Phép đo này CHƯA đóng được câu hỏi.** `/health` chỉ chạm DB một–hai câu và không
mở transaction; 30 request là ít. Nó BÁC được câu chuyện cũ chứ chưa TÌM RA trần
thật. Muốn biết trần thật vẫn phải làm đúng §7: tăng dần số đồng thời trên một route
CÓ TRANSACTION (`POST /rounds`), tìm chỗ p99 vọt lên.

**Nhưng kết luận không đổi ở CẢ HAI giả thuyết:** cái chắn phải đứng TRƯỚC DB.
Dù trần thật là 15, 200, hay do số instance Fluid quyết định, một cổng chặn
ĐỒNG THỜI ở biên (§5) vẫn là lớp phòng thủ đúng chỗ — nó không cần biết trần
thật nằm ở đâu, chỉ cần giữ tải dưới MỌI ngưỡng có thể có.

### ② Bộ chặn tần suất hiện có KHÔNG cứu được — nó làm nặng thêm

⚠ Đây là chỗ dễ hiểu sai nhất trong cả hệ.

`consumeLimit` (`server/auth/rate_limit.ts`) chạy **trên DB**:
`BEGIN → pg_advisory_xact_lock → (COUNT+INSERT gộp một câu) → COMMIT`.

⚠ SỬA 03/09/2026 (D207-b): trước đây COUNT và INSERT là hai câu riêng (5 câu
tổng); nay gộp còn 4 — xem docstring `consumeLimit` để biết vì sao KHÔNG gộp
được nốt câu khoá vào cùng một câu tự-commit (đã đo: gộp hết vào một câu làm
mất tính đúng, vì snapshot READ COMMITTED chốt trước khi khoá kịp chặn ai).
Kết luận dưới đây KHÔNG đổi — 4 câu vẫn giữ nguyên `pool.connect()` suốt cả
giao dịch, tức vẫn giữ đúng MỘT kết nối DB (thứ đang cạn) cho tới khi COMMIT.

⇒ **Từ chối một request tốn gần bằng phục vụ nó** — và tốn đúng thứ đang cạn
(kết nối DB). Nó là **bộ đếm công bằng**, không phải **bộ chắn tải**. Hai việc
khác nhau, và nó chỉ làm việc thứ nhất.

Tệ hơn: trần là **theo người** (`holdem:tao:<userId>`) và theo IP. 3.000 người
mỗi người trong hạn mức riêng của mình ⇒ **không ai bị chặn**, mà tổng tải vẫn
gấp 3.000 lần. Không có chỗ nào trong hệ biết *"tổng thể đang quá tải"*.

### ③ argon2id trong đường request

Băm mật khẩu ~100ms CPU mỗi lượt, chạy đồng bộ trong request, trên **một**
function. Đợt đăng ký ồ ạt đánh vào đây trước cả DB.

### ④ Quota tháng Vercel — vài ngày

3.000 người × ~150 request/ngày ≈ 450.000/ngày ⇒ hết 1 triệu trong **~2 ngày**.

**Minigame (đo 03/10/2026, D464; thi công D466 — chưa ship):** mỗi màn mở một DÒNG ~40 s (nhịp 1 s). Dòng không tốn lượt gọi mà tốn BỘ NHỚ CẤP PHÁT: 2 GB × thời
gian máy mở, fluid compute chỉ dồn ~1,4 dòng/máy ⇒ một trận (10 màn) ≈ 0,16–0,22 GB-giờ ⇒ 360 GB-giờ/tháng của Hobby ≈ **1.600–2.300 trận/tháng
(~50–75 trận/ngày)**. Kiểu hỏi mỗi giây thì ~400 lượt gọi/trận và ăn chung quỹ 1 triệu ở trên. Vượt hạn mức Hobby = chờ 30 ngày.
D466: cửa `GET …/minigame/:vong/nhip` (NDJSON, mỗi giây một lô) + đường lui `?mot_lan=1`. Mỗi lần mở/nối dòng qua xô chống spam `MG_NHIP_MOI_GIO` = 600/giờ
(mỗi lần là một function sống tới 45 s ⇒ một người spam tối đa ~7,5 giờ máy/giờ — trần thô, chưa phải trần ngân sách). Trần ngân sách theo tháng CHƯA có: khi
minigame lên prod phải đếm GB-giờ thật trên bảng Vercel ở buổi test đầu (điều kiện kích hoạt: > 50 % hạn mức 360 GB-giờ trong 15 ngày đầu tháng).

### ⑤ Egress Supabase — cùng khoảng thời gian với ④

---

## 4. ƯỚC TÍNH TRẦN NGƯỜI DÙNG — và cách tính, để ai cũng kiểm lại được

**Quan trọng: trận đấu KHÔNG polling nhịp nào.** `refetchInterval: false` —
một người chơi thì client tự biết hết. Nhịp 20 giây duy nhất nằm ở bảng **bàn
chung** (`useBan`), và chỉ khi được bật. Nên tải chủ yếu là **hành động mỗi
vòng**, không phải nhịp hỏi.

```
một trận 8 vòng   ≈ 4–8 request/vòng (shop · khớp lệnh · chốt vòng · mở bảng)
                  ≈ 32–64 request/trận
cộng sảnh, /me, hồ sơ, hành trình            ≈ 20
⇒ một người chơi tích cực                    ≈ 150 request/ngày

33.000 request/ngày ÷ 150  ≈  220 người chơi đều mỗi ngày
```

⚠ **Sai số rộng.** Con số này nhạy với thói quen chơi (chơi 1 trận hay 5 trận),
và chưa tính chi phí thử lại khi mạng chập. Coi nó là **bậc độ lớn** — "vài
trăm", không phải "220".

Trần này là trần **LƯỢNG THÁNG**. Trần **ĐỒNG THỜI** thấp hơn nhiều và do §3①
quyết định — đó là lý do phải có cổng.

---

## 5. CỔNG HÀNG CHỜ (D207) — làm gì, và KHÔNG làm gì

Nằm ở Cloudflare Worker (`web/worker/`), **đứng trước cả Vercel lẫn DB**.
Luật ở `cong.js` (hàm thuần, có test), sổ ở `cua.js` (Durable Object).

**Vì sao phải ở Worker chứ không trong app:** thứ gãy là kết nối DB, nên cái
chắn phải đứng trước DB và **không được đụng DB**. Worker là chỗ duy nhất thoả
cả hai, và miễn phí (C1).

### Làm được

- **Chặn đồng thời** — trần 150 người ở trong cùng lúc (`CONG.TRAN_TRONG`).
- **Hàng chờ FIFO có SỐ THỨ TỰ**, tự nhích khi có người nhả ghế. Không phải
  lỗi 503 trần — người dùng thấy mình đứng thứ mấy, nên không F5.
- **Không tốn kết nối DB nào** để từ chối một request. Đây là khác biệt cốt
  lõi so với `consumeLimit`.
- **Vỏ app vẫn tải được khi cổng đóng** — asset tĩnh do Cloudflare trả thẳng ở
  biên, không qua Vercel. Nhờ vậy người xếp hàng thấy màn hàng chờ THẬT của
  DELPHI, không phải trang lỗi trần của trình duyệt. Không có tính chất này
  thì cả cơ chế vô nghĩa.
- **Tự nhả ghế** khi người dùng đóng tab / mất mạng / ngủ máy.

### KHÔNG làm được — đừng nhầm

- ⚠ **Không cứu quota THÁNG.** Cổng chặn ĐỒNG THỜI, không chặn TỔNG LƯỢNG. 150
  người chơi liên tục cả ngày vẫn đốt hết 1 triệu request/tháng. Cổng là van
  chống **đợt tràn**, không phải giải pháp cho **tăng trưởng bền**.
- **Không áp cho Discord Activity.** Cổng nhận diện bằng cookie, mà trong iframe
  Discord đường phiên là `Authorization: Bearer`. Chấp nhận được: cửa Discord
  đã bị Discord chặn ở ~150 người rồi. Cửa **web/PWA** mới là cửa không trần —
  và đó đúng là cửa cổng này gác.
- **Không chặn `/admin`, `/health`, `/internal/*`.** Founder phải xem được bảng
  số trong lúc đang cháy; UptimeRobot không được báo động giả; cron khoá kèo +
  backup đêm phải chạy kể cả 0 người online (C3).

### Hai cửa thoát, cả hai đều MỞ TOANG

Thiếu secret `CONG_BI_MAT` **hoặc** thiếu binding `CUA` ⇒ **tắt cổng**, mọi
request đi thẳng như trước. Durable Object lỗi giữa chừng ⇒ cũng cho qua.

Lý do: **một cái cổng cấu hình sai mà khoá chết cả app thì tệ hơn nhiều lần
một cái cổng không chạy.** Cùng nếp fail-open của `PROXY_SHARED_SECRET`.

Kiểm cổng còn sống: header `x-dp-cong` trên mọi phản hồi API — `tat` · `vao` ·
`cho`.

### Bật cổng

⚠⚠ **HAI LỆNH, HAI VIỆC KHÁC NHAU — ĐỪNG NỐI BẰNG `&&`.** Bản trước của mục này
nối, và nó là một cái bẫy: người đọc tưởng phải deploy mới bật được cổng, trong
khi deploy mới là vế mang rủi ro (D271, 05/09/2026).

**Bật cổng = đặt secret. Chỉ thế.** Mã cổng đã nằm trong worker đang chạy, nên
không cần đẩy mã mới:

```bash
cd web && npx wrangler secret put CONG_BI_MAT
```

Kiểm ngay, không cần đợi: `x-dp-cong` phải đổi từ `tat` sang `vao`.

```bash
curl -s -o /dev/null -D - https://dubao.example.workers.dev/api/v1/health | grep -i x-dp-cong
```

**`wrangler deploy` chỉ cần khi MÃ WORKER ĐỔI** — ví dụ nâng `CONG.TRAN_TRONG`.

⚠⚠ **Và nó không chỉ đẩy worker.** `wrangler.jsonc` khai `assets.directory:
"./dist"`, nên `wrangler deploy` đẩy luôn **`web/dist` trên máy lên làm trang
tĩnh đang sống**. Chạy nó lúc `dist` cũ, hoặc lúc `web/src` đang dở việc của
cửa sổ khác, là thay frontend prod bằng một bản không ai duyệt — mà không có gì
báo, vì lệnh vẫn xanh. Ca thật 05/09: `dist` trên máy build 31/08 trong khi bản
đang sống deploy 01/09.

⇒ Trước mọi `wrangler deploy`: `git status web/` phải sạch, rồi build lại, rồi
so hash bundle sau khi deploy (cùng nếp "deploy chưa xong khi chưa đo",
`docs/dac-ta/04-ha-tang-bao-mat.md` §C):

```bash
git status --short web/    # phải RỖNG. Có dòng nào thì DỪNG, không chạy tiếp
npm --prefix web run build
cd web && npx wrangler deploy
```

⚠ Ba dòng RỜI, cố ý không nối `&&`: `git status` trả mã 0 kể cả khi cây bẩn, nên
nối vào chuỗi là dựng một cái chốt không chặn gì — thứ còn tệ hơn không có chốt,
vì nó tạo cảm giác đã kiểm. (Bản đầu của chính mục này mắc đúng lỗi đó.)

⚠ Nếu `wrangler deploy` báo Durable Objects không dùng được trên gói này: chú
thích hai khối `durable_objects` + `migrations` trong `wrangler.jsonc` rồi
deploy lại. Mất hàng chờ, **không mất trang web**.

### 5b. Hàng chờ SUẤT TRẬN — cổng thứ hai, chống khoá Vercel 30 ngày (SPEC `tran-tran-ngay`, 11/10)

Cổng trên chặn ĐỒNG THỜI; thứ khoá Vercel Hobby 30 ngày là **GB-giờ**, mà GB-giờ đi theo số **TRẬN** (9 màn × 41 s
× 2 GB). Nên có cổng thứ hai, chỉ cho `POST /api/v1/holdem/matches`:

- **Cửa chính — Worker** (`web/worker/suat.js` luật thuần · instance `suat-v1` của `CuaHang` · nối ở `index.js`):
  quỹ NGÀY chia theo giờ VN bằng bảng trọng số, suất thừa cộng dồn trong ngày; hết suất ⇒ 503 `hang_cho_tran` +
  `vi_tri` · `du_kien` · `Retry-After`, **không gọi Vercel**. FIFO, không chen hàng, im quá nhịp + ân hạn ⇒ rời hàng.
  Đếm bằng 201 thật (lỗi trả suất). Bộ đếm `daDung` ghi xuống storage của DO (một lượt ghi mỗi trận) để deploy không
  cấp lại cả quỹ ngày.
- **Lưới — server** (`server/suat_tran.ts`): cổng fail-open nên server đếm trận người thường từ 0:00 VN, trong
  transaction tạo trận dưới khoá tư vấn (hai request sát trần không cùng lọt); chạm trần ⇒ 503 `het_suat_ngay`,
  không tạo dòng nào. Chỉ mục `started_at` (migration 0081).
- **Admin miễn cả hai lớp** (tester ⊂ admin): server gắn `x-dp-mien-suat` lên phản hồi đã xác thực; Worker đổi thành
  cookie `dp_mien` ký bằng `CONG_BI_MAT`, gắn với sha256 token phiên, rồi bóc header. Trận tập + bàn ngày/bàn đôi
  TÍNH vào quỹ (founder 11/10: A).
- **Mọi số ở `config/suat_tran.ts`, PLAYTEST-TUNE** (tạm 40/ngày ở cổng, 48/ngày ở lưới — dưới ~55–60 của phép đo
  thưa 11/10). Cửa sổ VẬN HÀNH đo GB-giờ thật rồi founder chốt. **Điều kiện gỡ/nâng:** dòng nhịp minigame rời Vercel.
- `/admin` khối "⏳ SUẤT TRẬN" đọc hai nửa: `/api/v1/_suat` (Worker) + `/api/v1/admin/suat-tran` (DB).

**Ngân sách Durable Object (free: 100.000 lượt/ngày, CHUNG với cổng trên):**
- mỗi trận tạo: 2 lượt (xin + báo) ⇒ quỹ 40 ⇒ ~80/ngày;
- mỗi người đứng chờ: nhịp hỏi = ¼ quãng còn tới giờ dự kiến, kẹp [5 s, 300 s] ⇒ chờ W giây tốn ≈ 16 + (W − 1.200)/300
  lượt; mỗi lượt quá 60 s còn chạm cổng trên một lần (vé thông hành 60 s) ⇒ ×2. Chờ 3 giờ ≈ 48 × 2 ≈ **100 lượt/người**;
  hết suất ngày (hỏi mỗi 300 s) ≈ 24 lượt/giờ/người;
- ⇒ 500 người chờ 3 giờ/ngày ≈ 50.000 + cổng trên cho 200 người chơi ~1 giờ (~12.000) ≈ **62.000 < 100.000**. Vượt (DO
  báo lỗi) ⇒ cả hai cổng fail-open, **lưới server vẫn chặn quota**. Nhiều hơn ~800 người chờ dài mỗi ngày là lúc
  phải nghĩ lại (nhịp thưa hơn, hoặc hàng chờ đóng ở mức "hết suất ngày").

⚠ Cổng suất trận sống ở mã Worker ⇒ lên prod cần **`wrangler deploy`** (đọc khối trên trước) + migration 0081 + deploy
API, theo đúng thứ tự `docs/deploy_gd0.md`. Thiếu Worker mới thì chỉ còn lưới server — vẫn an toàn quota, mất số thứ tự.

---

## 6. KHI NÀO PHẢI ĐỔI KIẾN TRÚC

Mốc C2 trong hiến pháp là **5.000 user đăng ký, đỉnh 2.000 online đồng thời**.
**Kiến trúc hiện tại không gánh nổi mốc đó**, và điều này đã được phân tích từ
17/07/2026 (`docs/khao-co/research_hosting_freetier.md` §3):

> nền 300–500 CCU polling 5–10s ≈ 30–100 request/giây ≈ **1,3–8,6 triệu
> request/NGÀY**. Mọi kiến trúc cho polling đánh thẳng vào serverless function
> đều gãy.

Đó là **gấp 40–260 lần** hạn mức tháng của Vercel.

⚠ Kiến trúc đang chạy đúng là kiến trúc bị phân tích đó nói sẽ gãy. Chọn thế
**có chủ ý** vì mùa 0.0 trần ~150 người (D64 — mẫu số là MÙA NÀY), không phải
vì vấn đề đã được giải.

**Ba việc phải làm khi chạm trigger đo được ở bậc `c2_5000`** (trigger nằm ở
`config/bac_thang.ts`, hiện đang `cho: 'A2'` — chưa chốt; theo
`research_hosting_freetier.md` §3, chưa làm dòng nào):

1. **Backend process thường trực, CÙNG REGION với DB** thay cho serverless
   mỗi-request-một-kết-nối; pool cố định 5–10 kết nối.
2. **Polling trả từ cache/CDN**, không đánh thẳng function.
3. **Transaction một vòng round-trip** cho đường tiền (parimutuel chạm cùng
   một dòng tổng pool ⇒ khoá nối tiếp; backend khác region DB thì trần chỉ
   1,3–3,3 tx/s, thiếu 5–20 lần).
4. **Đích đang chọn (03/09/2026): Cloudflare Workers + Hyperdrive** — gói free
   có Hyperdrive; Vercel Hobby cấm dùng thương mại (xem bậc `doanh_thu` ở
   `config/bac_thang.ts`).

Tức là **đổi tầng hosting, không phải tối ưu code.** Đừng hứa mốc C2 khi chưa
làm xong các việc này.

### Trần riêng của đích Cloudflare (thêm 03/09/2026, D214)

Hai trần MỚI của chính đích đang chọn — không có ở Vercel/Supabase, xem bảng ở
§2: **Workers 10ms CPU/lượt gọi** (gói free) và **Hyperdrive 100.000 truy vấn
DB/ngày** (gói free — Hyperdrive KHÔNG cần nâng cấp trả phí). Đo được 03/09/2026,
xem §"Đo 03/09/2026" ngay dưới §7.

**Hai chỗ chặn ĐÃ BIẾT, chưa ai sửa** (đọc trước khi bắt đầu di cư sang Workers
— cùng hai món nợ này được khai chi tiết hơn ở `docs/dac-ta/04-ha-tang-bao-mat.md` §F):

1. **`@node-rs/argon2` là module NAPI (native binding) — KHÔNG chạy được trên
   Workers.** Workers isolate không có filesystem/dlopen cho `.node` binary.
   Phải thay bằng argon2id chạy WASM thuần (ví dụ `hash-wasm`), và bản thay thế
   phải XÁC MINH ĐƯỢC hash cũ (định dạng PHC, `server/auth/crypto.ts`) — nếu
   không thì mọi mật khẩu đã băm bằng `@node-rs/argon2` sẽ không đăng nhập lại
   được sau khi chuyển. Test bắt buộc TRƯỚC khi migrate: băm bằng thư viện CŨ,
   verify bằng thư viện MỚI (và ngược lại) — hai chiều, không chỉ một.
2. **`pg` + type parser BigInt trong `server/db.ts` chưa từng chạy trên
   Workers** (cần `nodejs_compat`). `node:crypto`/`node:zlib` (dùng ở
   `server/auth/crypto.ts`, nén payload…) THÌ được kỳ vọng chạy đúng dưới
   `nodejs_compat` (Cloudflare tự khai hỗ trợ hai module này), nhưng đó là kỳ
   vọng chưa đo — `pg`'s driver TCP thô tới Postgres là thứ rủi ro nhất trong
   cụm này vì Workers không có TCP socket thường, phải đi qua Hyperdrive làm
   proxy; chưa có test nào trong repo chạy `pg` dưới runtime Workers thật.

**Ước tính trận/ngày dưới trần Hyperdrive** (từ phép đo bước 5 — số liệu đầy đủ
ở §"Đo 03/09/2026"): một trận map 8 ô tốn **~136 câu SQL** (đo qua HTTP thật,
`scripts/do_sql_moi_tran.ts`, dao động ±1 giữa các lần chạy) ⇒ 100.000 ÷ 136 ≈
**~735 trận/ngày** là TRẦN TRÊN lý thuyết nếu Hyperdrive là NGUỒN DUY NHẤT cạnh
tranh ngân sách 100k đó (chưa tính sảnh/hồ sơ/admin/PFM — số thật sẽ THẤP HƠN
con số này).

---

## 7. ĐO THẬT — cách làm (đã chạy lần đầu 05/09/2026)

⚠ **Bước 1 đã làm, xem §"Đo 05/09/2026" ở cuối tệp.** Script: `scripts/do_tai_dong_thoi.ts` (`npx tsx scripts/do_tai_dong_thoi.ts --muc 30,120,500`).
Bước 2–4 vẫn còn nguyên — đặc biệt là đường CÓ TRANSACTION. Khi cần con số THẬT (trước khi mở công khai, hoặc
trước khi nâng `TRAN_TRONG`):

1. **Đo trần kết nối trước tiên** — nó gãy đầu. Bắn N request đồng thời vào một
   endpoint có chạm DB, tăng N, tìm chỗ p99 vọt lên 10 giây (`connectionTimeoutMillis`).
2. **Đo trên ĐƯỜNG CHÍNH**, không đường tắt (D78) — qua Cloudflare → Vercel →
   Supabase, đúng như người dùng đi.
3. **Đếm request/người thật** từ `telemetry` sau khi có cohort đầu, thay cho ước
   tính §4.
4. ✅ **Đã làm 05/09/2026: 150 → 300** sau khi đo. Nâng tiếp thì phải đo mục 1 trên đường có transaction.
   Lý lẽ đầy đủ sống ngay trên hằng số ở `web/worker/cong.js` (một nguồn, D61). Câu cũ: Số đó đang mang nhãn
   PLAYTEST-TUNE và là **một** hằng số ở `web/worker/cong.js`.

---

## Đo 03/09/2026 (D214) — CPU vòng cuối + SQL mỗi trận, bước 0 cho đích Cloudflare

Hai phép đo LOCAL (không chạm prod, không chạm Workers/Hyperdrive thật) — trả
lời câu "trần nào của đích Cloudflare (Workers 10ms CPU/lượt, Hyperdrive 100k
truy vấn/ngày — §2) sẽ chạm TRƯỚC khi chuyển hạ tầng". Cả hai script đọc/đo
trực tiếp code production (`replay()` thật của `server/holdem_api.ts`, app Hono
thật qua `server/app.ts`), không dựng bản mô phỏng song song (D61).

### A. CPU mỗi lượt nộp vòng — worst case (map lớn nhất × bàn đông nhất)

Lệnh: `npx tsx scripts/do_cpu_vong_cuoi.ts` — 20 seed tất định/map × 3 cỡ map
(8/12/16, từ `CO_MAP_CHON`) × bàn 8 ghế (trần D3). Đo quanh ĐÚNG cặp `replay()`
mà `POST /rounds` gọi (`server/holdem_api.ts`, hai lời gọi quanh dòng nộp vòng).

**Vòng CUỐI mỗi map — p50/p95/max, ms đồng hồ tường (≈ CPU vì khối đo hoàn
toàn đồng bộ), gộp cả cặp replay TRƯỚC+SAU:**

| map (ô) | p50 (ms) | p95 (ms) | max (ms) | so trần 10ms Workers |
|---|---|---|---|---|
| 8 | 8,47 | 11,57 | 12,55 | p95 **1,16×** — VƯỢT |
| 12 | 10,82 | 13,19 | 13,83 | p95 **1,32×** — VƯỢT |
| 16 | 14,11 | 19,94 | 20,70 | p95 **1,99×** — VƯỢT |

**Max tuyệt đối trên toàn trận (mọi vòng, mọi seed):** map 8 → 15,14ms (vòng
5) · map 12 → 15,73ms (vòng 8) · map 16 → 23,51ms (vòng 15).

⚠ **Kết luận đọc được, dù số dao động ±15–20% giữa các lần chạy (nhiễu hệ
điều hành, không phải nhiễu seed — engine tất định, đồng hồ tường thì không):
ở CẢ BA cỡ map, vòng cuối trên bàn đông nhất đã VƯỢT trần 10ms CPU của Workers
free ngay trên máy dev — và Workers isolate thường CHẶT hơn một máy dev, không
lỏng hơn.** Nghĩa là: nếu chuyển sang Workers HÔM NAY, đúng-y-nguyên-code, vòng
cuối của phần lớn trận sẽ bị Workers cắt CPU giữa chừng (lỗi, không phải chậm).
`replay()` phát lại TOÀN BỘ log mỗi lần gọi (không giữ state — xem docstring
đầu `server/holdem_api.ts`) nên chi phí tăng theo số vòng đã qua; đây chính là
cái giá của lựa chọn kiến trúc đó, đo được lần đầu.

**Giới hạn của phép đo** (đầy đủ hơn trong output của chính script):
`process.cpuUsage()` trên máy Windows này lượng tử hoá ~15,6ms (`GetProcessTimes`
độ phân giải thấp) nên KHÔNG dùng được trực tiếp — bảng trên dùng đồng hồ tường
(`process.hrtime.bigint()`) làm số chính, đáng tin hơn nhiều vì khối đo không có
`await` nào bên trong (đồng bộ ⇒ tường ≈ CPU thật của đúng khối này). Nhưng vẫn
là máy dev, không phải isolate V8 Workers — chỉ so được TƯƠNG ĐỐI. Ghế `'ban'`
mỗi vòng GIỮ VỊ THẾ + mua 1 thẻ chiến thuật (không mô phỏng lệnh NAV/đảo/khoá/
short/chuỗi cược) — số đo là CẬN DƯỚI, không phải trần tuyệt đối.

### B. Số câu SQL mỗi trận

Lệnh: `npx tsx scripts/do_sql_moi_tran.ts` — lái qua app Hono thật bằng
`app.request` (như `tests/holdem_api.test.ts`), map 8 ô, đếm mọi câu SQL thật
sự chạm Postgres (bọc `pg.Client.prototype.query` — MỘT điểm bọc duy nhất, xem
lý do trong docstring script: hai lớp lỗi đo lường đã dính và đã sửa ở đó,
đáng đọc trước khi tin bất kỳ số nào từ một script đếm-query tương tự).

| hành động | số câu SQL |
|---|---|
| tạo user (đường fixture, KHÔNG qua `/register` thật — xem docstring script) | 6 |
| `POST /matches` (map 8) | 11 |
| nộp cả 8 vòng (tổng) | 113 |
| `GET /matches/:id/autopsy` (đọc kết quả) | 6 |
| **TỔNG một trận** | **~136** |

Câu SQL mỗi vòng nộp: 13 câu/vòng ỔN ĐỊNH cho vòng 1–7, **22 câu ở vòng CUỐI**
(chốt hạng, ghi `holdem_results`, mở khoá tiến trình). Không tăng dần theo số
vòng — khác hẳn chi phí CPU ở mục A, đúng như kỳ vọng kiến trúc: `action_log` là
MỘT cột JSON ghi bằng MỘT câu UPDATE, nên số CÂU SQL không phụ thuộc log dài
bao nhiêu; chỉ CPU của `replay()` mới phụ thuộc (nó đọc lại log trong bộ nhớ,
không truy vấn thêm).

**Ước tính trận/ngày dưới trần Hyperdrive (100.000 truy vấn/ngày):**
100.000 ÷ 136 ≈ **735 trận/ngày** — TRẦN TRÊN lý thuyết, giả định Hyperdrive
không cạnh tranh với truy vấn nào khác (sảnh, hồ sơ, admin, PFM đều CHƯA
tính vào đây). So với ước tính CPU ở mục A (mỗi vòng cuối đã gần/vượt 10ms), **CPU
Workers nhiều khả năng chạm trần TRƯỚC Hyperdrive** — hai trần không cùng đơn
vị nên không cộng thẳng được, nhưng bậc độ lớn đã đủ rõ để không cần chờ đo lại.

**Giới hạn:** đo trên Postgres embedded cục bộ (không phải Hyperdrive/Supabase
thật) — số CÂU không đổi theo hạ tầng chạy nó (cùng code, cùng câu lệnh), ĐỘ
TRỄ mỗi câu thì có (RTT tới Hyperdrive/Supabase khác RTT tới Postgres cục bộ,
không đo ở đây). "Tạo user" đo đường fixture — phễu đăng ký thật
(`/register`→verify-email→`/login`→onboard) tốn thêm nhưng là chi phí MỘT LẦN
mỗi người dùng mới, không lặp mỗi trận, nên không phải mẫu số đang cần.

---

## 8. NHỮNG GÌ ĐÃ CÓ SẴN ĐỂ ĐỠ TẢI

- **Ngân sách polling bậc thang** (`web/src/api/polling.ts`, luật D11): sảnh
  không polling · chi tiết kèo chỉ polling khi người đó ĐÃ đặt tiền *và* tab
  đang hiển thị · 30s → 10s (dưới 30 phút tới giờ khoá) → 5s (5 phút cuối).
  Chạm 70% quota Vercel thì nâng bậc.
- **Telemetry gộp lô** (A9) — gửi từng event một sẽ ăn hơn nửa hạn mức Vercel.
- **Xuống cấp có kiểm soát** là yêu cầu C2, không phải tuỳ chọn: chậm lại, giãn
  polling — **không sập, không mất dữ liệu**.
- **Cache biên** — danh sách trắng RẤT hẹp, chỉ `/avatar/catalog` và `/health`.
  ⚠ Gần như mọi endpoint khác đều theo user và xác thực bằng cookie; cache theo
  URL cho một endpoint như thế là **phát phiên của người này cho người khác**.
  Nới danh sách phải chứng minh endpoint không đọc phiên.

---

## 9. Quyết định 03/09/2026 — cái gì làm bây giờ, cái gì đợi (D216)

> Ba câu hỏi đóng, founder chọn giữa các phương án agent trình, cùng đợt với
> quyết định kho lạnh cho `events` (`docs/luat/04-du-lieu.md` §B1) và cách suy
> `cohort_key` (`05b-pfm-kien-truc.md` T7.3). Toàn văn: `docs/nhat-ky/D216.md`.
> Mã **C1/C2/C4** dưới đây là mã riêng của đợt quyết định này — ĐỪNG lẫn với
> cột `C1`…`C8` ở bảng ràng buộc cứng CLAUDE.md A2 (trùng tên ngẫu nhiên, hai
> bảng mã độc lập; §8 phía trên dùng "C2" theo nghĩa CLAUDE.md).

**Idempotency key cho `POST /rounds` và `/bang-dien-tu` (C1) — HOÃN, không
phải BÁC.** `/khop-lenh` đã có khuôn (`idempotency_key` trong body, ≤64 ký
tự) — nhân bản khuôn đó khi tới lượt. Kích hoạt: cùng đợt đổi hạ tầng ở bậc
`c2_5000` (`config/bac_thang.ts`, câu hỏi A2) — hoặc SỚM HƠN nếu quan sát được
một ca trùng submit thật trên prod. ⚠ Đề xuất của agent là làm ngay; founder
chọn hoãn — ghi rõ đây là lựa chọn của founder, không phải khuyến nghị mặc
định agent đưa ra.

**Tín hiệu "hệ thống đang giảm tải" cho client (C2) — đi CÙNG LÚC với van tải,
không đi trước.** Founder từng chọn hoãn tới khi van thật tồn tại.

✅ **Van ĐÃ BẬT 06/09/2026 (D274)** — nhưng KHÔNG phải cái van D106 phác. Phác
cũ là van NGƯỠNG (đóng ~92% tải, mở lại ~75%); phép đo D271 cho thấy nó không
cài được đúng ở đây, vì trần thật là **toàn cục** (200 client pooler) trong khi
mọi số ở `server/tai.ts` là của **một instance** — 200 instance mỗi cái tự thấy
"ổn" thì không cái nào đạt 92% của gì cả, đúng thứ "van đoán mù" mà đầu tệp đó
cấm. Van đang chạy PHẢN ỨNG thay vì đoán: bắt `EMAXCONN` ở `app.onError` rồi
đổi 500 thành **503 + `Retry-After` 3–8 giây có nhiễu**, kèm bóp nhịp báo lỗi
còn một lần mỗi phút mỗi instance. Nó đúng ở mọi mức tải vì phản ứng với SỰ
KIỆN, không với số đo cục bộ.

⚠ Van KHÔNG thay cổng (§5): cổng chặn TRƯỚC khi chạm DB, van chỉ trả lời cho tử
tế khi đã chạm. Kênh báo hiệu cho client giờ CÓ thứ để báo — mã `qua_tai` +
`thu_lai_sau_giay` trong thân phản hồi.

**Cổng hàng chờ `CONG_BI_MAT` (C4) — bật khi MỜI NGƯỜI NGOÀI VÒNG QUEN lần
đầu**, không đợi tới lúc mở công khai hoàn toàn. Cổng fail-open (§5) nên bật
sớm gần như không tốn gì kể cả khi chưa cần dùng tới. Lệnh bật, chép nguyên
từ §5 để khỏi dựng lại giữa lúc gấp — **một lệnh, không kèm deploy**:

```bash
cd web && npx wrangler secret put CONG_BI_MAT
```

⚠ Bản trước ở đây nối thêm `&& npx wrangler deploy`. Đã bỏ (D271): deploy KHÔNG
cần để bật cổng, và nó đẩy `web/dist` trên máy lên làm trang tĩnh đang sống —
đúng thứ không nên làm giữa lúc gấp.

Chi tiết (khi nào mới thật sự cần deploy, đường lui nếu Durable Objects không
dùng được trên gói, ý nghĩa header `x-dp-cong`…): xem §5.

---

## Đo 05/09/2026 — TRẦN KẾT NỐI: tìm ra rồi, và nó gãy KHÔNG ÊM

Founder: *"đo thử đi rồi nâng nếu được"*. Chạy `scripts/do_tai_dong_thoi.ts` —
script tải **đầu tiên của repo**, bắn thang đồng thời qua ĐÚNG đường người dùng
đi (Cloudflare Worker → Vercel → Supabase, D78) vào `GET /api/v1/health`.

| đồng thời | ok | p50 | p95 | p99 | `pool.waiting` tối đa | cả đợt |
|---|---|---|---|---|---|---|
| 10 | 10/10 | 331ms | 2.129ms | 2.129ms | 0 | 2,21s |
| 30 | 30/30 | 280ms | 2.059ms | 2.071ms | 0 | 2,08s |
| 60 | 60/60 | 299ms | 411ms | 536ms | 1 | 0,56s |
| 120 | 120/120 | 294ms | 438ms | 492ms | 4 | 0,55s |
| 200 | 200/200 | 389ms | 1.965ms | 2.006ms | 8 | 2,13s |
| 300 | 300/300 | 764ms | 2.257ms | 2.416ms | 9 | 2,61s |
| 500 | 500/500 | 1.887ms | 2.141ms | 2.174ms | 17 | 2,62s |
| **800** | **689/800** | 988ms | 2.080ms | 2.156ms | 11 | 2,25s |

**800 đồng thời ⇒ 111 request trả HTTP 500.** Lỗi thật, đọc từ log Vercel:

```
(EMAXCONN) max client connections reached, limit: 200
```

### Ba điều đóng lại được

1. ⭐ **Trần thật là 200 client đồng thời của Supavisor** — đúng con số §2 đã ghi,
   nay có bằng chứng. Mỗi instance Vercel giữ MỘT client (pool `max: 1`), nên
   trần này là trần SỐ INSTANCE đang sống cùng lúc.
2. **H2 sai, H1 đúng một nửa** (§3①). `default_pool_size` = 15 KHÔNG phải chỗ gãy:
   đo được `waiting` lên tới 17 mà không một lỗi nào — xếp hàng trong pooler chạy
   êm, đúng như bản D214 sửa lại. Fluid compute CÓ gộp nhiều request vào một
   instance (500 request đồng thời vẫn dưới 200 instance), nhưng nó chỉ đẩy lùi
   chỗ gãy chứ không xoá.
3. ⚠ **Gãy KHÔNG ÊM.** C2 đòi *"xuống cấp có kiểm soát chứ không sập"*; thực tế là
   HTTP 500 thẳng, không hàng chờ, không `Retry-After`. Người dùng thứ 201 không
   bị chậm — họ ăn lỗi. Đây là lý do cổng (§5) phải đứng TRƯỚC, và là lý do van
   `server/tai.ts` nên tồn tại.

### Đổi từ request sang NGƯỜI — đừng đọc nhầm bảng trên

Một người chơi bắn ~1 request mỗi 5–10 giây, mỗi request giữ kết nối ~0,3s (p50
đo được) ⇒ **N người ≈ N/20 kết nối đồng thời**. Trần 200 kết nối ứng với HÀNG
NGHÌN người. ⇒ **Kết nối KHÔNG phải thứ chặn quy mô mùa này**; quota tháng (§2)
vẫn là ràng buộc chặt nhất, và cold start vẫn là thứ người dùng cảm thấy.

### Vì sao nâng lên 300 chứ không kịch trần

`/health` chạm DB nhưng KHÔNG mở transaction, nên con số trên là **TRẦN TRÊN**.
Đường có transaction giữ kết nối lâu hơn ⇒ chỉ có thể thấp hơn. Và nó CHƯA đo
được: bắn tải vào `POST /rounds` là bơm rác **vĩnh viễn** vào `events`
append-only (cửa một chiều, A11.1/A3.3) — không đánh đổi được.

⚠ **Điều kiện để nâng tiếp (A11.15):** dựng một DB Supabase THỨ HAI (project
trống, cùng free tier) rồi chạy `--muc` trên `POST /rounds` ở đó. Chưa làm điều
đó thì đừng nâng quá 300.

### Giá phải trả của chính phép đo — ghi để lần sau tính trước

- **~2.100 request** quota Vercel (~6% ngân sách một ngày).
- ⚠ **ĐÍNH CHÍNH 06/09: KHÔNG có sự kiện Sentry nào.** Bản đầu mục này ghi "111
  sự kiện" — sai. Handler `/health` tự `try/catch` quanh truy vấn DB rồi trả 500
  qua nhánh `healthy === false`, nên lỗi không rơi xuống `app.onError` và chuông
  không kêu. Kết luận không đảo mà dời chỗ: đợt tràn trên một route THẬT sẽ đẻ
  một sự kiện Sentry mỗi request, trên hạn mức 5.000/tháng. Van D274 bóp nhịp đó
  còn một lần mỗi phút mỗi instance.
  **Vá 11/10:** `/health` trả 500 nay tự báo Sentry (`health_degraded`, van 10 phút —
  `server/canh.ts` `nenBaoCanh`). Đo lại kiểu này sẽ đẻ đúng MỘT sự kiện mỗi 10 phút mỗi instance.
- Không ghi một dòng nào vào DB (đó là lý do chọn `/health`).

---

## Đo 11/10/2026 — đường CÓ TRANSACTION trên DB thứ hai · và trần thật là BỘ NHỚ, không phải kết nối

Phiếu chuyển từ `1-chan-truoc-beta-khao-sat` (founder chọn mở beta CÔNG KHAI, SPEC `chan-truoc-beta` mục 3). Cửa sổ
`8-do-tai-truoc-beta-cong-khai`. Founder chốt hạ tầng thử (sổ chốt 11/10): Supabase project 2 `delphi-thu` (Singapore, free,
role riêng `delphi_tai` — Supabase chặn đổi mật khẩu `postgres` qua SQL; mật khẩu chỉ ở `.env.thu` cây chính, gửi đi dạng băm
SCRAM) · Vercel project riêng `delphi-api-thu` (sin1, env: `DATABASE_URL` · `TICK_SECRET` · `APP_ENV=thu`; không Sentry).

⚠ **Bẫy đã dính:** project Vercel tạo qua API mặc định **iad1** (Mỹ) — `vercel.json` `regions` không ăn khi deploy bằng API
files. Mỗi câu SQL đi-về Mỹ ↔ Singapore ~200 ms ⇒ `POST /rounds` 3 s lúc 0 tải (local 40 ms). Sửa: PATCH project
`resourceConfig.functionDefaultRegions: ['sin1']`. Kiểm `regions` của deployment TRƯỚC khi đọc số nào.

### A. Thang đồng thời `POST /matches` → `GET /shop` → `POST /rounds` (`scripts/do_tai_rounds.ts`)

Laptop → thẳng origin `api-staging.example.vercel.app` (KHÔNG qua Worker — lệch D78 có chủ ý: Worker thử chưa có, và Worker chỉ
chuyển tiếp; trần đang tìm nằm sau nó). Ba pha tách nhau, mỗi pha N người cùng lúc. Script có hai chốt cứng chặn prod (URL +
ref Supabase), không cờ lách — `events` append-only (A3.3).

| N | `POST /matches` p50 / p99 | `POST /rounds` p50 / p99 | lỗi |
|---|---|---|---|
| 10 | 2,2 s / 2,4 s (lạnh) | 0,20 s / 0,31 s | 0 |
| 30 | 0,61 / 0,65 s | 0,56 / 0,71 s | 0 |
| 60 | 0,88 / 1,08 s | 0,38 / 2,07 s | 0 |
| 120 | 1,87 / 2,32 s | 2,60 / 3,15 s | 0 |
| 200 | 2,59 / 3,26 s | 0,61 / 2,13 s | 0 |
| 300 | 2,9–7,1 / 3,3–7,5 s | 3,9–6,2 / 4,0–6,2 s | 0 |
| 500 | 8,2 / 9,0 s | 4,0 / 4,4 s | 0 |
| **800** | **12,3 / 13,2 s** | **3,8 / 4,6 s** | **1** (`409 sai_vong` — chưa rõ, mở phiếu) |

Đọc ra:
1. ⭐ **Không chạm `EMAXCONN` kể cả 800 đồng thời trên route có transaction** — Fluid compute dồn nhiều request vào một máy, nên số
   máy (= số client pooler, pool `max: 1`) không tới 200. Điều kiện "đo đường có transaction trên DB khác prod" (mục "Vì sao nâng
   lên 300") nay ĐÃ thoả; kết nối DB không phải thứ chặn mùa này.
2. Chậm tăng gần tuyến tính ở `POST /matches` (~15 ms/người) — không có khoá chung trong route; khớp với phần CPU (~25 ms/trận
   local) xếp hàng trên máy 1 vCPU bị dồn. Chậm chứ không lỗi.
3. Một lượt lẻ lúc nóng: `POST /matches` ~0,5 s · `GET /shop` ~0,45 s · `POST /rounds` ~0,45 s (gồm RTT laptop → Singapore).

### B. Trần thật: bộ nhớ Vercel do dòng nhịp minigame

Trận mặc định (bàn 14 ô, `NHIP_XEN_KE[14].man`) có **9 màn**; mỗi màn giữ MỘT function mở **41,1 s** (đo 60/60 màn,
`scripts/do_gb_gio_minigame.ts`) — dòng NDJSON `GET …/minigame/:vong/nhip`. Function 2 GB ⇒ trường hợp thưa (không có gì để dồn):
9 × 41 s × 2 GB ≈ **0,2 GB-giờ/trận** ⇒ 360 GB-giờ/tháng ≈ **~55–60 trận/ngày cho cả tài khoản** (mọi project dùng chung quỹ).
Vượt hạn mức Hobby ⇒ *"wait until 30 days have passed"* (vercel.com/docs/plans/hobby, đọc 11/10). Code chưa có trần trận/ngày nào.

Thí nghiệm sạch (số GB-giờ chỉ đọc được trên trang Usage — Observability · billing API đều 404 cho Hobby): project riêng
`delphi-api-mg` = 30 màn THƯA (1 người, 15:16–15:37 UTC) · `delphi-api-mg2` = 30 màn DÀY (10 người, 15:16–15:18 UTC); mỗi project
không làm gì khác ⇒ GB-giờ của project ÷ 30 = GB-giờ/màn. **Kết quả: chờ đọc Usage** (founder đăng nhập).

### C. Ngân sách theo ngày khi mở công khai (bảng ước — thay bằng số đo khi có)

| ngân sách | trần trận/ngày | nguồn |
|---|---|---|
| Bộ nhớ Vercel 360 GB-giờ/tháng | ~55–60 (thưa) | đo thời lượng dòng; GB-giờ chờ Usage |
| Lượt gọi Vercel 1 triệu/tháng | ~200 (~160 lượt/trận đếm từ mã) | ước — số thật khi bộ đếm Worker D594 lên prod |
| CPU Vercel 4 giờ/tháng | ~400+ | chưa đo |
| Workers 100.000 lượt/ngày | ~600 | ước |
| Durable Object (cổng: ≤ 1 lượt/phút/người đang chơi) | xa | đọc mã `web/worker/index.js` |
| DB · pooler | không phải trần | đo mục A |

⇒ Founder chọn (11/10, sổ chốt): **hàng chờ suất trận kiểu 2b2t nhả theo quỹ giờ + lưới trần ngày ở server** — SPEC
`docs/spec/tran-tran-ngay.md`. Gỡ gốc = dòng nhịp rời Vercel (Worker giữ dòng) ⇒ trần kế ~200 trận/ngày (lượt gọi). "Số lượng lớn"
(vài trăm–nghìn người/ngày) cần rời Vercel (bậc `c2_5000`, §6).

### Giá của phép đo
~6.000 lượt gọi + ~1.235 × 2 giây dòng ≈ ước 1–2 % hạn mức tháng của tài khoản. 0 dòng nào vào prod.
