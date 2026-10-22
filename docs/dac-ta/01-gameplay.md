# Part 1 — Gameplay and game loop: the Arena (Alpha Draft)

Part of the [specification by part](00-ban-do.md). Corrected together with the code whenever the two disagree.

*The document below is in Vietnamese, the language of the project.*

## A. VAI TRÒ & HIỆN TRẠNG

Đấu trường là TRÒ CHƠI đang giữ chân người: 1.560 event · 267 trận, so với
22 event cả đời của chợ dự báo (D86) ⇒ mùa 0.0 dồn hết lực vào đây. Người
chơi quản lý danh mục ảo (NAV = tiền mặt + vị thế) qua 8/12/16 vòng trên một
tấm map sinh tất định từ seed; xếp hạng bằng NAV tuyệt đối; mất mát duy nhất
là danh dự (D25).

Trạng thái prod: đọc `HOLDEM_BALANCE_VERSION` ở `config/holdem.ts`, và
"đợt này đổi gì" ở `docs/phat-hanh/mua-0.0.md`. Bản nào đang **ở cổng** (xây
xong, chưa mặc định) thì `config/holdem_balance.ts` khai ngay tại chỗ bằng dấu
⏳; luật gỡ một khoá khỏi bảng đó ở `SO_KHOA_DA_GO` cùng tệp (D217).

⚠ **CỐ Ý KHÔNG CHÉP SỐ PHIÊN BẢN VÀO ĐÂY** (sửa 03/09/2026, D219). Bản trước
ghi cứng *"prod = balance-v31-quycogian, v32 đang ở cổng"* và nằm sai suốt hơn
một tháng: prod đã là v36, còn bảng luật đã có tới v38. Một con số phiên bản
chép tay trong tài liệu thì **không có gì báo khi nó trôi** — đúng cơ chế D61,
và đúng chỗ nó đau nhất, vì phiên bản cân bằng là thứ quyết định trận cũ replay
ra cái gì (A11.3).

Kết quả gate gần nhất ĐƯỢC GHI Ở ĐÂY chỉ đúng cho phiên bản đo được nó, nên nó
là **số đo có hạn dùng**, không phải trạng thái hiện tại: lần đo v32 (12.000
trận/ô) cho map 8 cả bốn XANH; map 12/16 thì G1/G2/G3 xanh, **G4 đỏ** — nợ có
TRƯỚC bản sắc (đã đo v31 đối chứng, cùng 3,54). Muốn biết số của bản ĐANG chạy
thì chạy lại `npm run gate`; đừng đọc đoạn này như tình trạng hôm nay. Lần đo gần nhất:
v40 (D303, 07/09/2026, 12.000 trận × map 8/12/16, 5 ghế): **12/12 XANH** — G1 cao nhất 32,5% (map 8, Tất tay) / 29,1% (12, Bắt đáy) / 31,9% (16, Bắt đáy), á quân cách ≤ 3,5 điểm; G2 oracle 1,80 / 1,95 / 1,90 < chơi-được 2,82 / 2,83 / 2,85 < bấm-bừa 3,77 / 3,98 / 4,03; G3 ngồi im hạng TB 4,14 / 4,32 / 4,29; G4 hoài-nghi 2,77 / 2,59 / 2,53 thắng cả tin-mọi-tin (3,14 / 2,85 / 2,72) lẫn phớt-tin (3,38 / 3,31 / 3,30). Nhật ký D303.

## B. KIẾN TRÚC & DÒNG CHẢY

**Tất định từ seed — replay là danh tính.** Trận = `taoTran(seed, ghe, luat,
soO)`; mọi thứ (map, bot, thẻ bày) suy từ seed + `action_log`. Không lưu
trạng thái trung gian; mỗi request dựng lại trận từ log. Hệ quả: **đổi bất kỳ
phép tính nào là viết lại kết quả mọi trận đã lưu** ⇒ cổng `balance_version`
(xem C).

**Map = máy trạng thái chu kỳ tín dụng** (doc 03-chu-ky-tin-dung.md — file
luật quan trọng nhất): giai đoạn (tăng/giảm/biến động/đi ngang/phục hồi) +
sự kiện (tin thật/giả theo loại, kỳ họp lãi suất theo LỊCH, bong bóng có gốc
tiền tệ v28) + quán tính v12 + sức căng v13 + bản sắc cỡ map v32 (bias theo
HỒI, map 8 byte-hệt đối chứng).

**Một vòng:** shop (mua tài sản bằng TIỀN — chợ liên tục D40, trượt giá +
phí vội vàng v29 là chi phí tập trung) → thẻ chiến thuật (3 lần chọn trải
đều tới giữa trận, D34; chọn là CHỐT — commit-on-click) → khớp lệnh giữa
vòng (`/khop-lenh`, idempotency trong đuôi `cho_nop`, D70/D78) → CHỐT VÒNG
(`nopVong` — một transaction: giải lệnh mốc, áp giao dịch, lá, Brier vòng,
events) → ChainReveal "VÌ SAO" → Quỹ vòng chia co giãn theo ghế (v31).

**Thứ tự bên trong `chotPhien`** (v42/D311 thêm hai bước, đánh dấu ⭐ — chỉ chạy khi
cổng `balance-v42-taisan` bật):

```
mỗi ghế:  dựng chuỗi → đòn bẩy cam kết → ĐỊNH GIÁ vị thế → ⭐ COUPON vào tiền mặt
sau đó:   lạm phát nền 150 → phí giữ khống → ⭐ SỐC TIỀN MẶT (ô lạm phát)
          → đo tăng trưởng NAV → chia Quỹ vòng → gọi ký quỹ → cháy
```

⚠ Coupon đứng SAU định giá (lãi trả trên giá trị đã chạy giá của vòng) và TRƯỚC lạm phát
(nhận tiền rồi mới bị bào — đúng thứ tự ngoài đời). Sốc tiền mặt đứng SAU phí giữ khống để
bào trên số dư cuối, và áp cho MỌI ghế còn trong trận **kể cả ghế đứng ngoài** — đứng ngoài
không né được lạm phát, đó là cả điểm của cơ chế. Bù lại, khối phí đứng-ngoài THÔI cộng
`PHI_DUNG_NGOAI.LAM_PHAT_BP` (một nguồn, không thu hai lần).

**Bot:** `lenhBotNav` + `BoiCanhLenh` (v22) — mọi bot chung MỘT hàm chấm
điểm, khác nhau ở ĐẦU VÀO (oracle nhận ô thật, hoài-nghi chiết khấu
`tyLeTinGiaHieuDung`…). `von_khong_doc` giữ danh tính bot đo lường
('khong'/'mu'). Hành vi bot KHÔNG nằm trong log — suy lại mỗi lần dựng ⇒ đổi
bot cũng cần cổng version (D80).

**Đồng hồ** (D38/D76): pha chọn 45s/25s/+12s; `XEM_KET_QUA_S` 15s cộng vòng
≥2; hết giờ = GIỮ NGUYÊN + cờ `tu_dong`; màn tập miễn giờ 4 vòng đầu; hạn
trận 45' đếm từ `vong_mo_luc`.

**Kỳ ngộ (D85/D86)** — lõi thuần XONG (`config/holdem.ts` `NHIEM_VU_KY_NGO`
+ `server/holdem/ky_ngo.ts`), NỐI DÂY đang làm ở phiên khác — thứ tự 6 bước
và các bẫy ở `docs/thiet-ke-da-chot/06-ky-ngo-va-dong-luc.md` §1bis.

## C. LUẬT BẤT BIẾN (một dòng + con trỏ)

- **A8.2** — không tự chỉnh tham số kinh tế; số nằm HẾT trong
  `config/holdem.ts`, đánh dấu MC-TUNE / PLAYTEST-TUNE.
- **Cổng `balance_version`** — mọi thay đổi tiền/map/bot; version cũ khai cờ
  `false` tường minh (TypeScript ép); cờ tắt = từng chip cũ, có test song sinh.
- **Gate G1–G4 đo trò ĐANG SHIP** (D55/D83) — đúng bộ luật, đúng hành vi bot,
  đúng cỡ map qua `taoTran(...,soO)`; số đo cũ không mang sang engine mới.
- **Cần gạt phải CHỨNG MINH CÒN SỐNG trước khi kết luận** (D58) —
  `doThamSo` cần `HOLDEM_SWEEP=1` + tiền tố `HOLDEM_`.
- **Đổi luật = bàn tập đổi dãy ô** (D50) — đổi `MAN_TAP_SEED`/ma trận là rà
  CoachTap + trang HƯỚNG DẪN cùng commit.
- **Lằn ranh data kỳ ngộ** (D85) — thưởng ĐỌC ĐÚNG, tuyệt đối không thưởng
  mức phơi nhiễm / đa dạng hoá / mức tiền mặt (trục khẩu vị rủi ro đang đo).
- **Ba động từ, không có động từ thứ tư** (D67): VÀO · RA · ĐỨNG NGOÀI — mọi
  cơ chế mới chỉ được đổi GIÁ hoặc THÔNG TIN của ba nước đó.
- **Từ vựng D26** — mọi chuỗi tới người chơi qua tự điển client, lint quét.

## D. RANH GIỚI FILE

**Sở hữu:** `server/holdem/*` (engine, map, nav, bots, shop, bang_dien_tu,
dong_ho, tu_dien, brier, ky_ngo — riêng `insight.ts` xem phần 7) ·
`server/holdem_api.ts` · `config/holdem.ts`, `config/rank.ts`,
`config/progression.ts` · `scripts/holdem_*.ts`, `scripts/do_don_bay.ts` ·
`tests/holdem_*`, `tests/ky_ngo*`, `tests/ban_sac_map*`, `tests/gate_*`.

**Dùng chung:** `server/app.ts` (chỉ đăng ký route — middleware là phần 4) ·
`web/src/lib/xemTruocLenh.ts` (UI gọi, phép tính của phần này) · art thẻ
(`server/art/*`, `server/holdem_art*`) vẽ theo §XI — đổi art là việc phần 2
duyệt lưới pixel.

**Cấm/cẩn trọng:** `server/holdem/{pot,cuoc}.ts` — D40 khai tử cơ chế nhưng
file CÒN import từ engine/bots/holdem_api: đo đường gọi trước khi dọn (bài
học D81, không xoá mù). `server/sandbox/` là của phần 5 dù tên gợi arena.

## E. NGHIỆM THU

```
npm test                                  # toàn bộ test gốc
npm run gate -- [trận] [ghế] [map] [ver]  # G1-G4 — BẮT BUỘC 3 cỡ map khi đổi engine
npm run typecheck
```
- Đổi engine: test song sinh cùng seed (cờ bật/tắt), tiêm lỗi ngược ≥2 mũi,
  bất biến hệ kín (`tiền mặt sau + vị thế sau + phí == NAV trước`).
- Phần tiền: test TRƯỚC theo vector chép tay (nếp A5.2), code sau.
- Số cân bằng mới ⇒ trình founder, KHÔNG tự lật version mặc định.

## F. NỢ ĐANG TREO

- **G4 đỏ map 12/16** (từ D80; v32 không gây ra — đã đối chứng v31).
- **v31 map12 G4 trôi 3,08 → 3,54** giữa D83 và 15/08 — một commit ở giữa,
  chưa truy; đáng một phiên soi riêng.
- ~~Nối dây kỳ ngộ → lật v32~~ — xong từ lâu (prod chạy v36 từ D179). Dòng cũ bị đọc nhầm
  là hiện trạng suốt hơn một tháng; sửa 07/09 (D300). Nợ thật còn lại: G4 đỏ map 12/16 chưa
  đo lại trên bản đang chạy — chạy `npm run gate` trước khi lật v37/v38.
- Số chưa chốt (A8.2): THẺ GIỜ +8s? · ngưỡng Brier TAY CÂN.
- Vòng lặp kẻ dẫn đầu D40 §4 — founder HOÃN, note giữ trong doc 06 §6.
- "Ngồi im bò dần theo cỡ map" (D72) — theo dõi mùa sau.
