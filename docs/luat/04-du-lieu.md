# Rules — data: schema, event types, and what goes in `events` vs `telemetry`

The minimum tables, the catalogue of event types, and a one-line test for deciding which table a record belongs in. A row written to `events` stays there for good: the table is append-only.

*The document below is in Vietnamese, the language of the project.*

## A6. Data model chuẩn (mở rộng từ schema gốc mục 5.4)

Bảng tối thiểu (đặt tên đúng như sau; kiểu dữ liệu chi tiết do GĐ1 quyết):

```
users(user_id PK, handle UNIQUE, age_band, region, occupation_band,
      bankroll INT ≥0, quest_points INT ≥0, role ENUM(user|admin),
      research_consent BOOL, created_at, season_id)

markets(market_id PK, pool ENUM(macro|life|event), question_text,
        resolution_source_name, resolution_source_url,   -- BẮT BUỘC trước khi mở
        resolution_note,                                  -- điền khi resolve
        open_ts, lock_ts, resolve_deadline_ts, resolved_ts,
        outcome_option_id NULL, status ENUM(draft|open|locked|resolved|cancelled),
        seed_per_option INT ≥0, season_id, created_by)

market_options(option_id PK, market_id FK, label, sort_order,
               range_low NUMERIC NULL, range_high NUMERIC NULL)
               -- biên khoảng "từ X đến dưới Y"; schema chừa chỗ kèo liên tục

bets(bet_id PK, market_id FK, option_id FK, user_id FK NULL nếu is_seed,
     amount INT ≥1, is_seed BOOL, created_at, updated_at)
     -- mỗi (user, market, option) một dòng, adjust = update amount + ledger + event

wallet_ledger(entry_id PK, user_id, delta INT, balance_after INT,
              reason ENUM(signup_grant|bet_place|bet_adjust|payout|refund|
                          subsidy|admin_adjust), ref_market_id NULL, created_at)
              -- append-only; bankroll users = số dư dòng cuối; recompute được

treasury_ledger(entry_id PK, delta INT, balance_after INT,
                reason ENUM(rake_in|seed_out|seed_return|seed_win|subsidy_out|
                            unclaimed_pool_in), ref_market_id NULL, created_at)

burn_ledger(entry_id PK, amount INT, reason ENUM(rake_burn|residual_burn),
            ref_market_id, created_at)   -- tổng cung kiểm toán được

scores(user_id, market_id, pool, brier NUMERIC, resolved_at)
rank_snapshots(user_id, pool, rank_value NUMERIC, markets_counted INT,
               computed_at, formula_version)

events(event_id PK, user_id, ts, context_type, context_id,
       action_type, value_num, value_json, state_snapshot_json)
       -- APPEND-ONLY. Cấm UPDATE/DELETE ở tầng DB (trigger/permission).

admin_audit(audit_id PK, admin_id, action, payload_json, created_at)
```

Ràng buộc DB bắt buộc: `bankroll ≥ 0`, `amount ≥ 1`, khóa ngoại đầy đủ,
UNIQUE chống trùng (vd. một user một dòng bet mỗi option mỗi market),
index phục vụ truy vấn nóng: `bets(market_id)`, `events(user_id, ts)`,
`events(context_id)`, `markets(status, lock_ts)`.

## A7. Event logging — danh mục khởi điểm

`action_type` v0.1: `onboard_demo`, `market_view`, `pool_reveal`,
`bet_place`, `bet_adjust`, `checkin`(nhận trợ cấp), `subsidy_claim`.

Quy tắc vàng: **công thức index viết TRƯỚC, suy ngược trường cần log.**
- `bet_place/bet_adjust`: value_json = {option_id, amount, phân bổ mới toàn kèo};
  state_snapshot_json = phân bố % pool user ĐANG THẤY (null nếu chưa reveal).
- `pool_reveal`: snapshot = phân bố % tại khoảnh khắc reveal (đo herd:
  so lệnh trước/sau khi thấy pool).
- Snapshot phải GỌN THEO THỂ LOẠI: mảng `[option_id, pct]` + tổng volume cho
  `bet_*`/`pool_reveal` — không dump nguyên object market.
- **Trần byte KHÔNG còn là một số chung cho mọi loại** (sửa 03/09/2026, D222,
  founder chốt phương án (a)). Đo thật (`scripts/do_co_snapshot.ts`, lái app Hono
  thật qua Postgres nhúng) lộ ra `hd_cam_ket` ~1,7 KB — nhiều lần mục tiêu "~300
  byte/event" cũ — vì nó CỐ Ý nhúng nguyên bối cảnh đối thủ mỗi vòng (D25/R1).
  Founder chọn GIỮ snapshot giàu (dữ liệu hành vi đáng giá hơn byte), luật ĐỔI
  theo thực tế thay vì code bị ép nhỏ lại. ⇒ mỗi `action_type` có TRẦN RIÊNG, ĐO
  chứ không ước lượng, sống ở `config/su_kien.ts` (`TRAN_SNAPSHOT`/`tranSnapshot()`
  — MỘT nguồn, đọc ở đó thay vì chép số ra đây, D61); giữ bằng
  `tests/co_snapshot.test.ts`. Loại chưa đo dùng sàn mặc định = đúng con số ~300
  byte cũ (`TRAN_SNAPSHOT_MAC_DINH`) — mục tiêu gốc không mất, chỉ đổi vai thành
  sàn cho loại chưa ai đo.
  ⚠ Người đọc sau: `hd_cam_ket` to là CHỦ Ý, không phải nợ kỹ thuật chờ dọn — đừng
  tối ưu nó xuống mà không hỏi founder trước (A8.1).
- Mọi event ghi CÙNG transaction với hành động nghiệp vụ (không fire-and-forget).

## A9. RANH GIỚI `events` ↔ `telemetry` (D60, founder chốt 03/08 — phương án A)

Founder hỏi *"có lo quá tải database không?"* trước khi dựng khung quản trị.
Đo ra: nếu ghi thô (từng cú chạm + nhịp tim 30 giây) thì 500 user ≈ **200 MB/
tháng** ⇒ lấp 500 MB free tier trong ~2,5 tháng; ghi gọn thì ~30 MB/tháng.

⚠ Cặp số này ước lượng khối lượng **`telemetry`** (thô so với gọn) — KHÔNG phải
khối lượng `events`. Từng bị đọc nhầm một lần ("mỗi dòng `events` nặng gấp 3
ngân sách A7") và bị bác vì đúng lý do này — cú bác nằm ở **D79** (11/08,
"HAI PHÁT HIỆN BỊ BÁC"), còn **D60** là nơi đẻ ra cặp số. Khối lượng `events` thật
theo TỪNG `action_type` nay đo được ở A7/`config/su_kien.ts` (D222); phép đo đó
không mâu thuẫn với cặp số 200/30 MB ở đây vì chúng KHÔNG đo cùng một đại lượng
— đừng lấy con số của bảng này làm chuẩn so với bảng kia.

**Chốt: HAI BẢNG, HAI VAI, KHÔNG TRỘN.**

| | `events` | `telemetry` |
|---|---|---|
| chứa gì | **hành vi kinh tế** — hành động có tiền hoặc có niềm tin đi kèm | **vận hành giao diện** — thời gian màn hình, phễu, lỗi client |
| luật | APPEND-ONLY vĩnh viễn (A3.3, trigger DB) | xoá được, **có hạn lưu 90 ngày** rồi cuộn thành tổng hợp ngày |
| vì sao | đây là SẢN PHẨM (A1), mất một dòng là mất doanh thu tương lai | đây là dụng cụ vận hành; giá trị của nó ở XU HƯỚNG, không ở từng dòng |

**Phép thử khi phân vân — hỏi đúng một câu: *"dòng này có tiền hoặc có niềm
tin trong đó không?"*** Có ⇒ `events`. Không ⇒ `telemetry`.
· đặt/điều chỉnh lệnh · thấy pool lần đầu · chốt vòng · kết trận · nhận trợ
  cấp · mặc avatar ⇒ **`events`**
· ở màn Hub 4 giây · bỏ hướng dẫn ở bước 7 · bấm nút X · lỗi render ⇒
  **`telemetry`**

⚠ **QUYẾT ĐỊNH NÀY MỘT CHIỀU.** `events` không xoá được, nên thứ đã đổ nhầm
vào đó thì nằm đó mãi và chiếm chỗ vĩnh viễn của dữ liệu thật. Phân loại
SAI KIỂU AN TOÀN là để nó ở `telemetry` (mất thì mất xu hướng, còn dòng nào
hoá ra quan trọng thì nâng cấp sang `events` từ hôm sau) — KHÔNG phải đổ hết
vào `events` cho chắc.

⚠ **A3.3 KHÔNG BỊ NỚI.** Nó bảo vệ bảng `events`, và bảng đó vẫn append-only
tuyệt đối. `telemetry` là bảng MỚI, chưa từng nằm trong phạm vi A3.3.

**Ba trần phải tôn trọng khi thi công:** Supabase free 500 MB · Vercel free
1 triệu request/tháng (⇒ **gộp lô là bắt buộc**, gửi từng event một ăn hơn
nửa hạn mức) · pool kết nối (C1).

**Máy người chơi = HỘP THƯ ĐI, không phải kho.** Hàng đợi trong trình duyệt
chỉ để gộp lô và sống sót lúc mất mạng; xoá app là mất, trình duyệt thu hồi
bộ nhớ bất kỳ lúc nào, và dữ liệu rải trên 500 điện thoại thì không phân
tích được.

## B1. Diễn giải A3.3 cho ca DUNG LƯỢNG (founder chốt 03/09/2026, D216)

⚠ **ĐÂY LÀ DIỄN GIẢI, KHÔNG PHẢI NỚI LUẬT** — A3.3 vẫn không dẻo (A11.17).
"Append-only" nghĩa là **không mất dòng nào, không mất trường nào của dòng đó**
(kể cả `state_snapshot_json`) — KHÔNG có nghĩa "không bao giờ đụng vào bảng
đang sống".

**Được phép khi chạm trần dung lượng:** cold-archive — partition `events` theo
THÁNG, detach partition cũ, chuyển ra kho lưu trữ ngoài, giữ khôi phục được.

**Không được phép, kể cả khi chạm trần:** xoá dòng · bỏ hay rút gọn
`state_snapshot_json` để tiết kiệm chỗ. Đó mới đúng là thứ A3.3 sinh ra để
chặn — mất một dòng là mất doanh thu tương lai (A9).

**Trigger đo được:** `pg_database_size(current_database()) ≥ 300 MB` — chừa
~200 MB (trần Supabase free 500 MB, xem `docs/gioi-han-ha-tang.md` §2) để làm
việc này thong thả, không phải giữa lúc cháy nhà. Hôm nay (03/09/2026) prod
~38 MB. Máy đọc được: `config/bac_thang.ts`, bậc `kho_lanh`.

Người đọc sau: đây là diễn giải cho ĐÚNG MỘT tình huống — hết CHỖ VẬT LÝ,
không phải hết Ý CHÍ giữ dữ liệu. Đừng dùng nó để biện minh xoá, lược, hay
giấu bất kỳ dòng `events` nào vì lý do khác.
