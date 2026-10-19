# 4. HẠ TẦNG KỸ THUẬT + BẢO MẬT

> Cập nhật 15/08/2026. ⚠ File này trôi được — CLAUDE.md + code thắng; sửa
> cùng commit khi thi công. Đọc `00-ban-do.md` trước.

## A. VAI TRÒ & HIỆN TRẠNG

⚠ **TRẦN CỤ THỂ + THỨ TỰ GÃY: `docs/gioi-han-ha-tang.md`** (D207) — một nguồn,
đừng chép số sang đây. Tóm tắt: thứ gãy ĐẦU TIÊN là **kết nối DB (~15 qua
pooler)**, trong vài giây — KHÔNG phải quota tháng Vercel (thứ tư, vài ngày).
Cổng hàng chờ ở `web/worker/` giữ trần ĐỒNG THỬI; nó KHÔNG cứu quota tháng.

Giữ app chạy 24/7 với chi phí 0đ (C1 — free tier không thẻ), chịu mốc C2
bằng XUỐNG CẤP CÓ KIỂM SOÁT chứ không sập, và giữ cửa: mùa 0.0 chạy sau bản
rà D79 + nhóm bảo mật D84 (đã vá: cửa sau allowlist, logout thu hồi thật,
bộ header đầu tiên, khách không rút được kho bạc).

⚠ Mẫu số của mọi quyết định là MÙA NÀY (~150 người trần Discord), không phải
C2 (D64) — trừ ba nhóm cửa-một-chiều: events, danh tính, replay.

## B. KIẾN TRÚC & DÒNG CHẢY

**Topology:**
```
người chơi ── Cloudflare Worker `dubao` (web/worker + wrangler.jsonc)
              ├─ static assets (dist, SPA fallback; CSP ở web/public/_headers)
              └─ proxy same-origin /api/* + /admin → Vercel
                     Vercel Hobby — MỘT function Hono (api/index.ts, pool max:1)
                            └─ Supabase Free PG17 — transaction pooler :6543
scheduler:  LỚP 1 pg_cron trong DB (khoá kèo mỗi phút — sống độc lập mọi dịch vụ)
            LỚP 2 cron-job.org → /internal/tick + secret (huỷ kèo quá hạn, heartbeat)
            UptimeRobot ping /health · backup đêm → GitHub (Vercel cron)
```

**Auth:** tự code (D17) — argon2id, session cookie HttpOnly + Bearer cho
Discord Activity; `docTokenPhien` ở `server/auth/session.ts` là MỘT nguồn
giải phiên (D84). Admin 3 bậc: role + TOTP tự viết (RFC 6238/4226 vectors,
bí mật KHÔNG băm được — bản chất shared secret) + allowlist IP qua
`PROXY_SHARED_SECRET` (fail-closed khi API có secret; fail-open CÓ CHỦ Ý khi
thiếu — đọc docstring trước khi "sửa"). Khách: `chanKhach` chặn cửa kho bạc
(D79), trần 5/IP/giờ. **Cổng proxy (B1, D613):** API có `PROXY_SHARED_SECRET` ⇒
`/api/*` thiếu/sai `x-delphi-proxy-secret` ⇒ 403 `khong_qua_cong` trước `cors`
và mọi route; miễn `/internal/*` (secret riêng) + `/health` (gọi thẳng = 2
trường, 0 truy vấn DB); thiếu secret ⇒ mở + log một lần (cùng lý lẽ allowlist).
Worker gắn secret mọi request, xoá `x-delphi-*`/`x-dp-*` client gửi (B12).
Đổi/xoá tài khoản: xô `mk:<account>` 5/15 phút trước khi băm (B9); khách/Discord
(không `password_hash`) xoá bằng `xac_nhan: "XOA"` + phiên (B4). Trần body
toàn cục 256 KB đọc `content-length`, không tiêu luồng (B14). DB: TLS ghim CA
Supabase `config/supabase_ca.ts` + bỏ `ssl*` khỏi URL (B3).

**Rate limit:** `chanTanSuat` (route nghiệp vụ) · `consumeLimit` theo IP cho
khách · `tieuHanMucIp` hai bậc; khoá đều là `pg_advisory_xact_lock` — code
viết cho transaction pooler, KHÔNG khoá cấp session.

**Headers (D84):** JSON mặc định `default-src 'none'` + nosniff + HSTS 180
ngày (không preload); `/admin` CSP riêng `'unsafe-inline'` CÓ CHỦ Ý (19
onclick — giá trị là chống clickjacking/rò rỉ, không phải chặn XSS); vỏ SPA
ở `web/public/_headers` (`font-src data:` bắt buộc — subset tiếng Việt);
**TUYỆT ĐỐI không `X-Frame-Options`** — giết Discord iframe; "cho ai nhúng"
nói bằng `frame-ancestors`, một lần, một chỗ.

**Báo lỗi (D93, `server/bao_loi.ts`):** adapter `KenhBaoLoi` — `server/`
không import Sentry, `api/index.ts` là nơi DUY NHẤT nạp SDK; không DSN ⇒ im;
không bao giờ ném; `app.onError` bao + `await xa()` trước khi trả 500
(serverless). Đổi nhà cung cấp = shim thoả `SdkBaoLoi` + đổi một import.

**Backup (`server/backup.ts`):** phân trang `BACKUP_PAGE`, `ORDER BY ctid`,
loại CỘT `totp_secret` (không loại bảng), `BANG_PHU_DU` = danh sách loại CÓ
TÊN + test đối chiếu `pg_tables` — thêm bảng mới mà quên khai là đỏ. Rời máy
chủ là bản MÃ (B2, D613): AES-256-GCM `BACKUP_KHOA` sau gzip ⇒ `.json.gz.enc`;
thiếu khoá ⇒ không runner ⇒ 501, KHÔNG bao giờ đẩy trần; mỗi lượt xoá ngày
> 30 (D2 pháp lý — lịch sử git repo backup vẫn giữ bản mã cũ).

## C. LUẬT BẤT BIẾN (một dòng + con trỏ)

- **C1/C3/C4** — 0đ; scheduler độc lập traffic (cấm setInterval serverless);
  server-authoritative.
- **`max: 1` của prod là RÀNG BUỘC** (D65) — đang cầm client thì cấm xin
  `pool.*`; `lint:pool-lock` + `tests/pool_max1.test.ts` canh; test đồng
  thời xanh ở max:5 KHÔNG nói gì về max:1.
- **Ghi TRƯỚC khoá sau là cấm** — compare-and-set trên `action_log` (D55),
  advisory lock cho việc xây BXH (D57), idempotency key trong đuôi (D78).
- **Secret:** `.env` dev duy nhất; xuất hiện ngoài env = COI NHƯ LỘ, rotate
  (D17e). `.env.example` phải đủ biến kèm cách kiểm.
- **Đổi mật khẩu DB và đổi cổng pooler làm HAI LẦN RIÊNG** (D61).
- **Đường tạm phải có ngày chết** (A8.9); fail-open phải KÊU TO và có điều
  kiện đo được (D84).
- **Deploy chưa xong khi chưa đo:** so HASH bundle; curl một route ĐỌC BODY
  và một route CÓ rate-limit — `/health` 200 không đủ (sự cố bodyLimit
  15/08); tick phải 401 khi thiếu secret.

## D. RANH GIỚI FILE

**Sở hữu:** `api/index.ts` · `server/app.ts` (middleware, headers, CORS
fail-closed) · `server/auth/*` · `server/db.ts`, `backup.ts`, `scheduler.ts`,
`email.ts`, `discord.ts` (bắt tay/hạ tầng — nội dung màn là phần 2) ·
`scripts/{deploy,migrate,bootstrap_*,backup_now,apply_db_password,
admin_reset_2fa,check_prod_heartbeat,probe_prod_url}.ts` · `vercel.json`,
`web/wrangler.jsonc` (proxy), `web/public/_headers` · khuôn `migrations/`
(từng migration thuộc phần đẻ ra nó, luật cùng-commit).

**Dùng chung:** `server/app.ts` — mọi phần đăng ký route ở đây nhưng
middleware/thứ tự middleware là của phần này; ai thêm route ĐỌC BODY hoặc
route công khai phải khai để rà rate-limit.

**Cấm:** không ai ngoài phần này đổi headers/CSP/cookie flags/pool config
"nhân tiện". Không đụng nội dung backup format (bản khôi phục thảm hoạ không
đổi hình dạng nhân dịp vá — D57).

## E. NGHIỆM THU

```
npm run typecheck && npm test
npm run lint:pool-lock
vitest run tests/stress.test.ts tests/pool_max1.test.ts
```
- Prod sau deploy: `/health` 200 (+ `proxy_secret_cau_hinh` — D444: cần kèm
  header `x-tick-secret` mới đọc được, không header thì `/health` chỉ trả
  `{status, ban_phat_hanh}`), tick 401 đúng, một route đọc body 200, một route
  rate-limited hoạt động, so hash bundle.
- Bản vá bảo mật: tiêm lỗi ngược (gỡ vá ⇒ test đỏ đúng bài); nghĩ như D79:
  "user tìm đường dị hợm" — thử đường KHÔNG đi qua cửa trước.

## F. NỢ ĐANG TREO

_Nợ kỹ thuật và việc vận hành đang mở được theo dõi riêng, không công bố ở đây. Nợ kỹ thuật công khai: `docs/architecture.md` (mục Known debt)._
