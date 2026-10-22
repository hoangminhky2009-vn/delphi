# Part 5 — Token economy: two currencies, treasury, shop

Part of the [specification by part](00-ban-do.md). Corrected together with the code whenever the two disagree.

*The document below is in Vietnamese, the language of the project.*

## A. VAI TRÒ & HIỆN TRẠNG

Hai đồng tiền không bao giờ gặp nhau: **T** (token cược, INTEGER, không giá
trị thật) và **Q** (điểm quest) — tường lửa vĩnh viễn ở schema lẫn code
(A3.5, có test firewall canh). **Kho bạc** = quỹ MỘT LẦN (genesis 20.000 +
2% rake), `CHECK balance_after ≥ 0` ở DB — cạn là fail cứng, không in thêm.
**Burn** có sổ riêng để tổng cung kiểm toán được.

Prod: ví T + trợ cấp + shop/gacha SỐNG (D86 — T còn phục vụ cosmetic dù chợ
dự báo hạ bậc). Kho bạc đo 04/08: 20.135 T / 12 user — trần này CHẶN mọi
thiết kế quà/phát tiền (D68).

## B. KIẾN TRÚC & DÒNG CHẢY

- **Tham số ở MỘT chỗ:** `config/economy.ts` (A4 — STARTING_BANKROLL, rake
  3%+2%, cap 20%, trợ cấp…), `config/qua_beta.ts`. Không magic number rải.
- **Mọi thay đổi số dư đi qua ledger** (A3.10): `wallet_ledger` /
  `treasury_ledger` / `burn_ledger` — bankroll là KẾT QUẢ suy ra;
  `npm run audit:supply` recompute đối chiếu.
- **Parimutuel** (`server/parimutuel.ts` + `resolve.ts`): thủ tục số nguyên
  A5.1 — nhân trước chia sau floor một lần, residual ĐỐT, seed thắng về Kho
  bạc; 2 ngoại lệ (100% người chơi cửa thắng · kèo hủy); D18 kèo seed-only ⇒
  `seed_return` không rake. Bất biến
  `P == Σ payout + seed_về_kho + burn + residual + trea` là assertion.
- **Trợ cấp** (`server/subsidy.ts`): dưới 500 T, 50 T/ngày, trần tháng, chi
  từ Kho bạc, cổng `chanKhach` (D79 — khách từng rút được kho bạc).
- **Shop/gacha/avatar** (`server/shop.ts`, `shop_kho.ts`,
  `server/sandbox/{gacha,ung_vien,rng}.ts` — ⚠ TÊN sandbox, VAI shop thật):
  gacha chỉ nhận T, đốt 100%, rate công khai 70/25/5, pity, chặn khi
  bankroll ≤500; mọi thứ mua bằng Q phải NIÊM YẾT (D16). Avatar nền = vật
  TIÊU HAO, sticker dán là TIÊU VĨNH VIỄN + hộp xác nhận (D36/D41/D42);
  trùng lá ⇒ HOÀN T + nói rõ trên màn (D68a).
- **Mùa** (`server/season.ts`): reset MỀM D16 — nén `1.000 + isqrt(dư)×10`,
  sàn 700, thưởng theo RANK CƯỢC (không phải tier sandbox — mâu thuẫn đã
  giải 17/07); cosmetic không reset; quà beta D68 (Dấu niêm + T + Q + thẻ
  phòng — SỐ chưa chốt đủ).

## C. LUẬT BẤT BIẾN (một dòng + con trỏ)

- **C5** — INTEGER tuyệt đối, floor, cấm float trong đường tiền.
- **A3.4** — không bao giờ mint T; ngoại lệ duy nhất genesis (unique partial
  index, một lần mỗi môi trường).
- **A3.5** — không đường Q→T hay T→Q, vĩnh viễn, mọi tầng.
- **A3.6** — seed chia ĐỀU các cửa, cờ `is_seed`, loại khỏi thống kê, thắng
  về Kho bạc.
- **A3.9** — không mua lợi thế cược bằng tiền; cosmetic 0% sức mạnh.
- **A5.2** — test vector chép tay là hợp đồng; code phải pass ĐÚNG SỐ.
- **A8.2** — mọi con số ở đây là của founder; agent đo và trình.
- **D16** — đổi tham số kinh tế phải chạy lại economy_sim TRƯỚC deploy.
- **Cosmetic không trao đổi/bán lại/rời tài khoản** (D16 — ngòi pháp lý).

## D. RANH GIỚI FILE

**Sở hữu:** `config/{economy,guardrail,qua_beta,avatar,avatar_art,sandbox,
sandbox_cards}.ts` · `server/{treasury,subsidy,shop,shop_kho,season,
parimutuel,resolve,qua_beta,qua_beta_api,avatar,admin_kinh_te}.ts` ·
`server/kinh_te/{mo_phong,bao_cao}.ts` · `server/sandbox/{gacha,ung_vien,rng}.ts` ·
`scripts/{audit_supply,bootstrap_genesis,economy_sim}.ts` ·
`scripts/doi_chung/economy_sim_doi_chung.py` (⚠ có NGÀY CHẾT — xem đầu tệp) ·
migrations ledger/shop/quà · tests tương ứng.

**Ba tầng của `server/kinh_te/` (theo `thiet-ke-de-xuat/kinh-te/kien-truc-ky-thuat.md` §2):**
`mo_phong.ts` là **T0 — hàm thuần**, không I/O, không đọc `now()`; `bao_cao.ts` là
**T5 — chỉ đọc**, không một câu ghi nào; `admin_kinh_te.ts` chỉ là cửa HTTP.
Mũi tên phụ thuộc chỉ đi xuống: báo cáo gọi mô phỏng, không bao giờ ngược lại.

**Dùng chung:** `server/holdem/shop.ts` (shop TRONG TRẬN — cơ chế của phần
1, không đụng ví T) — ranh giới: Vốn trong trận ≠ T, không có đường quy đổi.
`server/markets.ts` gọi parimutuel — vòng đời kèo là phần 6, phép chia tiền
là phần này. `server/sandbox/rng.ts` được holdem/bots/map dùng — đổi RNG là
đổi replay, phải qua phần 1 + cổng version.

**Cấm:** viết bất kỳ code chuyển đổi T↔Q "tạm" nào, kể cả trong test.

## E. NGHIỆM THU

```
npm test                 # gồm test vector A5.2 + firewall T/Q + trigger ledger
npm run audit:supply     # sổ cái CÂN — chạy cả sau migration prod
```
- Phần tiền: test TRƯỚC theo vector tính tay, code sau, chứng minh pass
  (A8.3). Bất biến hệ kín viết thành assertion trong code.
- Đổi tham số: economy_sim + trình số cho founder; KHÔNG deploy trước duyệt.
- Đường chi Kho bạc mới: chứng minh nhánh "kho không đủ" FAIL RÕ RÀNG và
  không treo pool (D65 — nhánh lỗi từng gọi `pool.query` sau ROLLBACK).

## F. NỢ ĐANG TREO

- ~~**`economy_sim.py` chưa nộp vào repo**~~ → **TRẢ 05/09 (D246/B0)**, nhưng
  bằng **TypeScript** chứ không phải Python: một bản Python là cài đặt thứ hai
  của cùng công thức và sẽ trôi (D61/A11.5), nên `scripts/economy_sim.ts` +
  `server/kinh_te/mo_phong.ts` import thẳng `config/economy.ts`. Chạy:
  `npm run kinh-te:sim` (thêm `-- --that` để đọc số thật từ sổ).
  ⚠ **Nợ CÒN MỘT NỬA:** phần tái lập được là *đẳng thức chu kỳ Kho bạc* (kiểm
  tay từng số với D16) và *quét trợ cấp*. **Mô hình TÁC NHÂN của D16 §5 thì
  không** — các giả định hành vi sinh ra bảng đó (kèo/ngày, cỡ cược, lượt gacha,
  tỷ lệ xong quest) chưa bao giờ được ghi ra, nên dựng lại là bịa. Muốn có lại
  thì phải ĐO từ `wallet_ledger` thật (`server/kinh_te/bao_cao.ts`).
- **Báo cáo kinh tế** (D16 §6 đòi "đo hàng tuần" từ 17/07, chưa ai dựng): đã có
  ở `/api/v1/admin/kinh-te`, admin-only. Bản công khai cho người chơi là bước B4
  của `thiet-ke-de-xuat/kinh-te/kien-truc-ky-thuat.md` §9, sau cờ.
- **Hai guardrail chết của D16 §6 đã sửa** (`config/guardrail.ts`): "Q tồn >
  2.500/user" không bao giờ nổ được vì trần phát cả mùa chỉ 1.200 ⇒ đổi sang tỷ
  lệ của `tranQMua()`; "Q sink/phát > 0,9" chỉ có trần ⇒ thêm SÀN 0,55, đúng
  bệnh đang mắc.
- Số chưa chốt (A8.2): giá bản sao avatar nền (D42 khuyến nghị 200–300 Q) ·
  số T/Q/thẻ phòng của quà beta + trần số người nhận · `GACHA.COST_T` mùa
  beta (D68 khuyến nghị 100→50).
- Art trader #1/#2 (D68) — nợ VẼ, không phải code.
- Ledger reason `season_reset` cần migration khi chạy reset mùa đầu tiên.
