# 2. UI-UX — client web (React + PWA + Discord Activity)

> Cập nhật 15/08/2026. ⚠ File này trôi được — CLAUDE.md + code thắng; sửa
> cùng commit khi thi công. Đọc `00-ban-do.md` trước.

## A. VAI TRÒ & HIỆN TRẠNG

Toàn bộ thứ người chơi NHÌN và CHẠM. Phong cách chốt: **Terminal × Neon +
Modern Pixel UI (§XI)** — mọi thứ người chơi thấy là pixel, radius 0, không
emoji hệ điều hành trong trận (D47; trang khoe `/tai-chinh` là ngoại lệ có
chủ ý D73). Mobile-first 390px (C6); màn TRẬN là toàn tâm (`toanMan`), màn
quản trị được nới rộng (`manRong`) — hai cờ trên `RouteHandle`.

Chạy trên 3 vỏ: web thường (Cloudflare Worker `dubao`), PWA installable
(service worker — bẫy cache D52), Discord Activity (iframe
`*.discordsays.com`, phiên Bearer, bắt tay có hạn giờ hai mức D66).

Hub sau D86: ĐẤU TRƯỜNG đứng đầu, Tài chính thứ hai, PREDICT MARKET hạ bậc
nhưng VẪN BẤM ĐƯỢC (founder: "đừng khóa chức năng gì đang chạy") — thứ tự
card là quyết định, có smoke test khoá.

## B. KIẾN TRÚC & DÒNG CHẢY

- `web/src/app/routes.tsx` + `AppShell.tsx` — khung, RouteHandle, errorElement
  + `RanhGioiLoi` (hai lớp bắt lỗi khác nhau, D57).
- `web/src/api/*` — React Query; `client.ts` fetch có hạn 15s; ranh giới
  retry là **`ApiError.chuaToiMayChu`** (máy chủ đã trả lời thì KHÔNG gửi
  lại; chưa tới thì gửi lại an toàn nhờ `idempotency_key` — D57/D78).
  `mang.ts` — nhịp đo mạng lùi dần, tab ẩn không tính vào backoff.
- `web/src/lib/*` — helper THUẦN. `xemTruocLenh.ts` gọi THẲNG hàm server qua
  alias `@server` (một nguồn — C4/D67: client hiển thị trên BẢN SAO phép
  tính thật, không bao giờ chép công thức). `vocab.ts`/`labels.ts`/
  `tinh_cach.ts`/`tu_dien` = tự điển nhãn (server trả ID+SỐ, chữ ở client —
  luật D26). `telemetry.ts` = hộp thư đi gộp lô (A9 — máy người chơi không
  phải kho).
- `web/src/components/holdem/*` — bàn đấu: GameCard (chia bài so le, lật
  theo key Ô — D78), ChainReveal (số neon vô điều kiện, "VÌ SAO" thu gọn —
  D44/D45), MarketMap, ShopManHinh, DongHoVong (đồng hồ bám kênh neo
  `dhNeo` — D76), CoachTap (spotlight màn tập — kịch bản GHIM theo
  `MAN_TAP_SEED`, đổi seed là rà lại cùng commit D50), ChuongHoi.
- `web/src/screens/*` — 6 màn gốc + Đấu trường + TaiChinh + admin.

## C. LUẬT BẤT BIẾN (một dòng + con trỏ)

- **C4** — client KHÔNG BAO GIỜ tự tính tiền/odds/payout/cap. Chỉ hiển thị.
- **§XI pixel** — radius 0, không gradient/blur, `crispEdges`;
  `lint:pixel-art` + test §XI canh.
- **D26 từ vựng** — ⚠ D91 (16/08): vế CẤM chữ casino + `lint:lexicon` ĐÃ GỠ
  (chỉ thị founder). Bảng từ vựng quỹ là giọng mặc định, một nguồn (`vocab.ts`).
- **R1** — field log là "đã cho thấy" PHẢI render vô điều kiện, không
  accordion/tooltip (D26; phần thu gọn duy nhất đã duyệt: chain chi tiết D44).
- **Hoạt ảnh chỉ `transform` + `opacity`** (D68; `lint:css-anim`);
  nhấp nháy ≤ 3 lần/giây là TRẦN SỨC KHOẺ, có test khoá chu kỳ (D77);
  reduced-motion: đứng yên chứ không mất THÔNG TIN.
- **D47** — không emoji OS trong trận; icon = bộ pixel (`PixelIcon`).
- **A3.1 khuôn ẩn-tới-khi-chốt** — pool chợ dự báo, icon kỳ ngộ (doc 06
  §1.5): không thấy lựa chọn người khác trước khi mình chốt.
- **Mạng kém là mặc định** — mọi mutation tiền đi `idempotency_key`; màn
  lỗi có đường thoát; không để skeleton/màn trắng vĩnh viễn.

## D. RANH GIỚI FILE

**Sở hữu:** `web/src/**` (trừ hai điểm dưới) · `web/tests/**` ·
`web/public/_headers` (nội dung CSP là của phần 4 — sửa phải phối hợp) ·
`web/worker/` + `web/wrangler.jsonc` (cấu hình proxy của phần 4, chữ hiển
thị của phần 2).

**Dùng chung:** `web/src/lib/xemTruocLenh.ts` — phép tính bên trong thuộc
phần 1; UI chỉ trình bày. Tự điển nhãn — phần 1/7 đẻ khái niệm mới thì phần
2 đặt chữ, server không mang chuỗi hiển thị.

**Cấm:** không import ví T vào màn trận và ngược lại — tường lửa D24 có test
canh (`web/src/api/tinh_cach.ts` là kênh đọc thuần, xem phần 7). Không đụng
`server/ config/ migrations/ tests/` (ranh giới Codex, doc 04 §7).

## E. NGHIỆM THU

```
npm run web:test        # 48 file test web
cd web && npx tsc --noEmit
npm run lint:css-anim && npm run lint:pixel-art   # lint:lexicon đã bị D91 gỡ
```
- **Trình duyệt thật là nếp bắt buộc** (D74): dev stack local hoặc prod,
  phiên khách, đi ĐƯỜNG CHÍNH (nạp thẳng trang — không tin điều hướng SPA
  có cache, D78), console sạch, radius 0.
- PWA: unregister service worker + xoá cache trước khi đọc bản mới (D52).
- Sau deploy: so HASH bundle + grep chuỗi mới trong bundle prod (D74/D77).
- Tiêm lỗi ngược cho test mới.

## F. NỢ ĐANG TREO (khảo sát D78 đã có địa chỉ)

- ~~Băng MẤT KẾT NỐI · CHỐT VÒNG báo "chưa gửi được" · TIẾP TỤC TRẬN DỞ~~ —
  ⚠ đặc tả bản đầu chép nợ D78 mà KHÔNG kiểm: cả ba ĐÃ LÀM ở đợt "rà mạng
  kém 11/08" (`99c61be`); D93 (16/08) thêm `tiep_duoc` + test cho thẻ trận dở
  và nhãn `su_co_khai` khi mất lượt vì hệ thống. Còn lại của D78: catalog hỏng
  một lần ⇒ skeleton vĩnh viễn; telemetry `dangGui` kẹt khi fetch treo; giữ màn
  KẾT QUẢ VÒNG khi response rớt; mặt lưng lá + cú lật sang mặt thật.
- `qua_han_tran` không vào payload (trận quá 45' trông như sống tới khi 409).
- Màn ngang: Ví/Shop/Hồ sơ/Đấu trường chảy 2 cột chưa ai duyệt mắt (D66).
- Client kỳ ngộ (picker/chip tiến độ/icon avatar/màn kết) — theo doc 06 §1bis.

## G. ĐỀ XUẤT ĐANG CHỜ CHỐT (16/08)

- **Bàn cược — shop "chơi bài" thay "đặt lệnh"** (CHỐT + thi công 16/08, D92): `thiet-ke-da-chot/07-ban-cuoc-shop.md`.
  Cửa sổ shop giữ nguyên (TFT mobile), đổi cách nạp lệnh: CHIP-first cầm-chạm, cọc chip
  trên lá, chip bay — một tay, không kéo thả. Server,
  engine, art không đổi. CHƯA CODE — chốt rồi chuyển sang `thiet-ke-da-chot/07`.
- Bối cảnh cùng ngày: `khao-co/de-xuat/gian-luoc-cho-nguoi-moi.md` (M1–M4:
  nhịp lá map 8 · đồng hồ hai pha · lăng kính danh mục · lịch vòng — trên BÀN).
