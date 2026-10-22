# Part 6 — Prediction market and admin panel

Part of the [specification by part](00-ban-do.md). Corrected together with the code whenever the two disagree.

*The document below is in Vietnamese, the language of the project.*

## A. VAI TRÒ & HIỆN TRẠNG

Chợ dự báo parimutuel là SẢN PHẨM GỐC (A1) — mùa 0.0 **HẠ BẬC, không khoá**
(D86, founder chỉnh 15/08): card Hub tụt dưới Tài chính nhưng vẫn bấm được;
admin thi thoảng vẫn set kèo; kèo đang mở resolve ĐÚNG LUẬT; phễu sau
onboard + lời mời ở ví trỏ về Đấu trường. Mở lại đầy đủ = đổi thứ tự card,
không có cờ khoá nào phải gỡ. Số đo dẫn tới quyết định: 22 event · 4 người
cả đời app.

Panel quản trị (D335, 15/09): **app quản trị riêng `/quan-tri`** — trang HTML
thứ hai của bản build web (`web/quan-tri.html` + `web/src/quan-tri/`), người chơi
không tải một byte, service worker không cache — gom đo lường (tổng quan · người
dùng · phân khúc, `server/admin_phan_tich.ts`) · sản phẩm · vận hành (kinh tế ·
quản kèo · tạo kèo nháp) · kho dữ liệu. Trang `/admin` Hono (server-render, CSP
riêng) chỉ còn **xác thực + quản trị cấp cao**: mã hai lớp · uỷ quyền · MỞ / CHỐT /
HUỶ kèo (chuyển token, không hoàn tác — sống cả khi bản build web hỏng, §8.1).
Đường vào khoá 3 bậc + TOTP (phần 4).

## B. KIẾN TRÚC & DÒNG CHẢY

**Vòng đời kèo:** draft → open (nguồn resolve khai TRƯỚC — A3.2; seed chia
đều từ Kho bạc) → lock (pg_cron LỚP 1, đúng giờ kể cả 0 người online — C3)
→ resolve (admin, cửa nặng có xác-thực-lại) hoặc tự huỷ sau 7 ngày không
nguồn (LỚP 2 tick) → payout A5.1 (phần 5 sở hữu phép chia).

⚠ **Đính chính D84 phải nhớ:** scheduler chỉ KHOÁ và TỰ HUỶ; TRẢ THƯỞNG đi
qua `POST /admin/markets/:id/resolve` — khoá nhầm admin quá 7 ngày là kèo
lần lượt tự huỷ hoàn 100% thay vì trả đúng kết quả, trên sổ append-only
KHÔNG hoàn tác. Rủi ro khoá nhầm là rủi ro tiền thật.

**Ẩn thông tin (A3.1 + D19, enforce Ở TẦNG API):** chưa đặt ⇒ chỉ thấy tổng
volume; đã đặt ⇒ thấy phân bố TOKEN từng cửa; KHÔNG BAO GIỜ trả
`implied_payout_ratio` lẫn `participants_count` cho người chơi (F12 không
moi được — có test hồi quy trên raw JSON). Khoảnh khắc thấy lần đầu ghi
`pool_reveal`.

**Quản kèo (D61 bước 4):** `dungChiTietKeo` / `moKeo` / `kiemThanKeo` là
MỘT NGUỒN cho cả đường người chơi lẫn đường admin/xem trước/hàng loạt. Hẹn
giờ mở (`tu_mo`, migration 0027) đòi mã TOTP y như mở tay — uỷ quyền dời
chỗ, không bỏ; Kho bạc không đủ ⇒ TẮT CỜ + audit. ⚠ Bẫy `setMonth(+1)` ngày
31 (tháng 2 biến mất) — đã có xử lý, đừng viết lại bằng tay.

**Dashboard:** mặt hành trình đọc từ `holdem_matches`+`auth_accounts`+
`events` (KHÔNG từ telemetry — D62); mặt nhóm = tập bộ lọc 3 chiều, bảng
chéo nhân khẩu bị che khi cắt chéo; tab TÍNH CÁCH dùng chung
`hoSoTinhCachCuaUser` với phần 7. Panel kho đo `pg_database_size` (không
lọc `public` — bẫy D80). Mọi hành động admin ghi `admin_audit`.

## C. LUẬT BẤT BIẾN (một dòng + con trỏ)

- **A3.2** — resolution thiêng: nguồn công bố trước, số lần đầu chung thẩm,
  7 ngày không nguồn ⇒ huỷ hoàn 100%.
- **A3.1/D19** — ẩn ở API; không tỷ lệ ăn ngụ ý, không số người, ở MỌI màn.
- **A3.7** — cấm kèo thể thao/chính trị/đời tư người nổi tiếng.
- **A3.8/D32** — rank Brier tính + lưu, KHÔNG hiển thị; hai bảng dự báo
  theo định nghĩa D32 (cửa nặng nhất thắng · token theo MÙA · phân vị).
- **D86** — hạ bậc không khoá; không xoá code/route/API/events; thứ tự card
  Hub là quyết định có test khoá.
- **Admin làm gì cũng có dấu** — `admin_audit` + xác-thực-lại cho cửa chi
  Kho bạc/kết thúc kèo.

## D. RANH GIỚI FILE

**Sở hữu:** `server/{markets,admin,admin_keo,admin_thongke,admin_san_pham,admin_bao_mat,
admin_ui,audit,scheduler(nội dung tick kèo)}.ts` · `web/src/screens/
{PredictMarket,MarketDetail,MarketResult}.tsx` + `web/src/screens/admin/*` ·
`web/src/api/quankeo.ts`, `thongke.ts` · `scripts/ra_handle.ts` ·
migrations kèo (`0027`…).

**Dùng chung:** `server/parimutuel.ts`/`resolve.ts` — phép chia tiền của
phần 5, vòng đời kèo của phần này. `server/scheduler.ts` — khung tick của
phần 4, nội dung việc kèo của phần này. Dashboard đọc số — ĐỊNH NGHĨA số
đúng/sai thuộc phần 3.

**Cấm:** mở lại chợ dự báo nổi bật / đổi thứ tự card Hub — đó là quyết định
mùa của founder, không phải việc kỹ thuật.

## E. NGHIỆM THU

```
npm test    # gồm test A3.1 raw-JSON, parimutuel vectors, tu_mo, scheduler
```
- Kèo mới trên prod: xem trước bằng CHÍNH `dungChiTietKeo` (một nguồn);
  kiểm nguồn resolve có URL công khai trước khi mở.
- Đụng admin: thử cả nhánh KHÔNG CÓ QUYỀN (người chơi gõ nhầm phải thấy
  trang tử tế, không kẹt "đang tải…" — D61 lỗi 5).
- Đụng scheduler: chạy tick HAI LẦN liên tiếp (đường tranh khoá) + nhánh
  "Kho bạc không đủ" không được treo pool (D65).

## F. NỢ ĐANG TREO

_Nợ kỹ thuật và việc vận hành đang mở được theo dõi riêng, không công bố ở đây. Nợ kỹ thuật công khai: `docs/architecture.md` (mục Known debt)._
