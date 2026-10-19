# 07 — BÀN CƯỢC: SHOP "CHƠI BÀI", KHÔNG "ĐẶT LỆNH" (CHỐT 16/08 · ĐÃ THI CÔNG)

**Founder chốt 16/08 tối sau khi chơi demo §11: *"được đấy bro vip v* chốt cái
chợ này. Làm y nguyên cho tôi nhé!"*** ⇒ ba câu §10 tự trả lời theo "y nguyên
demo": **Q1** duyệt bố cục §2 + ngữ pháp §3 · **Q2** CÓ nút LẶP · **Q3** pane
LÕI CHIẾN THUẬT giữ chỗ hôm nay (dưới lưới, demo không dời). Thi công cùng
ngày, một lượt thay vì bốn: `HangChip.tsx` · `CocChip.tsx` · `GameCard`
(`phuKien`/`duocMoi`/`anNutMua`) · nhánh nav của `ShopManHinh` · cha truyền
`startVon` + `lenhTruoc` · coach ba bước · `CHAM_NUT_BAT` hai nhãn (ngày rà
30/09/2026) · `web/tests/ban_cuoc.test.tsx` (22) · scaffold bản 1 đã xoá. Ghi
nhật ký: CLAUDE.md D92.

*Founder 16/08: "thiết kế lại UI-UX shop cho giống chơi bài" · "để shop ở cửa sổ
riêng như TFT mobile" · "kéo thả có bị phiền không, chơi một tay thì sao, hiệu
ứng có gì đặc biệt hơn cũ, tham khảo game casino" · và **D91: gỡ luật cấm
casino** — chip, cọc, bàn cược dùng thoải mái. Bản 1 (dải mốc + kéo thả) ở
Phụ lục.*

## 0. Một câu

**Shop = BÀN CƯỢC. Cầm CHIP rồi CHẠM lá — hai cú chạm, một tay, không kéo.
Chip bay lên lá, mọc thành cọc; vị thế nhìn thấy bằng độ cao cọc. Giữ nguyên
cửa sổ shop, máy tính lệnh, art, server.** Server nhận đúng bộ `{ma, chieu,
moc_bp}` cũ (C4). Không lá nào, phí nào, bot nào, số nào đổi. Không cổng
`balance_version`.

## 1. Học gì từ game casino mobile (Zynga Poker · Governor of Poker · blackjack/roulette mobile · Balatro)

| Họ làm | Vì sao hợp ta |
|---|---|
| **Chip-first, chạm-chạm**: chạm mệnh giá chip → chạm ô cược. Kéo chỉ để DỜI chip. | Một tay, vùng ngón cái, không tranh với cuộn |
| Nút cược nhanh MIN · ½ · POT · ALL-IN cùng một hàng, cùng cỡ | = 25 · 50 · 75 · ALL-IN của ta |
| **Chip bay** theo cung từ ví lên ô, "cạch" + rung; ví đếm xuống; **cọc chip mọc** trên ô — mức cược thấy bằng mắt | Vị thế trở thành VẬT, không phải con số trong bảng |
| Rút = chạm cọc, chip bay ngược về ví | Bán = chính cử chỉ ngược của mua |
| REBET / ×2 — lặp lệnh vòng trước một nút | Vòng nào cũng phải xếp lại là "phiền v*" — đúng chữ founder |
| Dealer gạt cược vào giữa bàn khi chốt | Chốt vòng có một khoảnh khắc nhìn thấy |

Không mượn: chip dính tay để rải một mệnh giá lên nhiều ô (xem §5 — ma sát
lệch về đa dạng hoá).

## 2. Bố cục cửa sổ shop (trận nav), trên → dưới — số px đo prod 375×812

```
┌ ĐẦU (sticky) — VÒNG n · nhịp · Bảng điện tử (2 hạng / phiếu) · ✕ ──────── 40 ┐
│ [vòng lá] LÕI CHIẾN THUẬT — 2 lá chia so le · ⟳ roll · cảnh báo xung đột   ~200 │
├ CHỢ — 6 lá art 3×2 (giữ nguyên lưới hôm nay) ────────────────────────── 381 ┤
│  mỗi lá đang giữ mang CỌC CHIP (1 chip = 25% giá trị so ví lúc mua)             │
│  chip vừa xếp (chưa chốt) là màu khác, chồng lên cọc đang giữ                   │
├ DANH MỤC SAU LỆNH + PHÍ (giữ nguyên, D67) — cho ai muốn đọc số ────────── ~90 ┤
├ TAY — lá chiến thuật đang cầm + thẻ KHỐNG (nếu có) ────────────────────── ~70 ┤
├ HÀNG CHIP (sticky đáy, trên nút chốt — vùng ngón cái) ────────────────── ~56 ┤
│  MUA  ⟵ mặt đang lật ⟶ RÚT · KHỐNG(nếu cầm Bán Khống)                            │
│  [25%] [50%] [75%] [ALL-IN]   · lá đã xếp: [BTC 50 ✕] [VÀNG rút hết ✕]  · KHỚP NGAY│
├ CHỐT VÒNG (sticky đáy) · LẶP LỆNH VÒNG TRƯỚC (nếu bạn muốn) ──────────── 43 ┘
```
Trạng thái thường ≈ 40 + 381 + 90 + 70 + 56 + 43 ≈ **680 < 812**, không cuộn;
vòng lá cuộn. Hàng chip và CHỐT sticky đáy nên **ngón cái luôn với tới**; lưới
lá ở trên là thứ duy nhất phải với — đúng vùng người ta vẫn cuộn hằng ngày.

## 3. Cử chỉ — "CẦM rồi CHẠM", một ngữ pháp cho mọi thứ

| Việc | Cử chỉ (2 chạm) | Ghi chú |
|---|---|---|
| Mua | chạm CHIP (25/50/75/ALL-IN) → chạm lá; **hoặc** chạm lá → chạm chip | thứ tự nào cũng được; sau lệnh chip TỰ THẢ (§5) |
| Bán | chạm CỌC trên lá đang giữ → hàng chip lật mặt RÚT → chạm chip | HẾT = rút sạch |
| Mở khống (cầm Bán Khống) | lật hàng chip sang mặt KHỐNG (nút nhỏ, chỉ hiện khi cầm lá) → chip → lá | như hôm nay: 25/50/75/100 tiền cọc |
| Đóng khống | chạm thẻ KHỐNG ở TAY → HẾT | |
| Gắn / đổi đích Đòn Bẩy | chạm lá ĐÒN BẨY ở TAY → chạm lá đích | cùng ngữ pháp "cầm rồi chạm"; khung chạm cũ giữ làm dự phòng |
| Rút lệnh chưa chốt | chạm chip vừa xếp trên lá (hoặc ✕ ở hàng "lá đã xếp") | |
| Lặp lệnh vòng trước | nút LẶP cạnh CHỐT (rebet) | tuỳ founder — tiện, không mặc định |
| Khớp giữa vòng · Chốt · Bảng điện tử · roll | nút như hôm nay | |
| Kéo thả | **không** — có thể thêm sau như đường phụ (desktop) | hook đã viết, để ngoài |

## 4. Hiệu ứng — mượn bàn cược, vẽ pixel (§XI vẫn là phong cách)

1. **Chip bay** từ hàng chip lên lá theo cung 4–5 khung (steps), đáp "cạch" + rung
   nhẹ (`NHIP_RUNG.cham`); ví đếm xuống bằng `useSoChay` có sẵn.
2. **Cọc mọc** trên lá: 25% = 1 chip, ALL-IN = cả cột trượt lên một lượt + rung
   nặng (`NHIP_RUNG.nang`) + chữ ALL-IN đã có (D74). Chip "chưa chốt" khác màu.
3. **Rút** = chip rơi ngược về hàng, ví đếm lên.
4. **Chốt vòng** = cọc đổi màu "khoá" một nhịp (dealer gạt cược), rồi ChainReveal
   chạy như cũ; sau kết quả cọc NỞ/CO theo lãi lỗ trước khi số neon nhảy.
5. Chia lá so le · lật lá · (!) tự điển — giữ (D78).
Tất cả chỉ `transform`/`opacity`, ≤3 nháy/giây, reduced-motion đứng yên nhưng
không mất thông tin (luật D68/D77 giữ).

## 5. Luật giữ nguyên & vì sao data sạch

- **Bốn chip bằng nhau, không chip nào sáng sẵn** (A1 khẩu vị · D85 §1.2): cỡ
  vị thế là trục đang đo. ⚠ **Founder 16/08 tối, sửa D68 ở đúng chỗ này:** ALL-IN
  *"đặc biệt hơn KHI BẤM VÀO chứ không phải phát sáng mặc định"* — lúc YÊN nó là
  nút thứ tư y hệt ba nút kia (viền, nền, dải chip; chỉ chữ đậm hơn); lúc BẤM
  chip: nút lún sâu → bật vàng, cả cột chip vàng trượt lên lá, rung nhẹ. Đúng
  hơn D68 cả về data: viền vàng thường trực là một "gợi ý" nhỏ về phía all-in.
  ⚠ **Founder sửa lần hai (sau khi lên prod): *"all in chỉ hiện lên màn hình
  khi bấm CHỐT thôi chứ người chơi bấm cho vui mắt thì hiện liên tục à"*** ⇒
  **dấu ALL-IN toàn màn + loé vàng + rung mạnh CHỈ nổ ở cú CAM KẾT** — CHỐT
  VÒNG hoặc KHỚP NGAY khi hàng đợi có ALL-IN (shop giữ thêm 700ms cho dấu đóng
  xong rồi mới trao cho cha). Bấm chip là xếp lệnh, chưa cam kết gì — không có
  gì để "nổ".
- **Chip KHÔNG dính tay**: casino để chip dính để rải nhanh; với ta đó là làm
  "25% × 4 mã" rẻ hơn "100% × 1 mã" ⇒ ma sát lệch về đa dạng hoá. Mọi lệnh
  đúng hai cú chạm bất kể cỡ và số mã.
- **Cọc so với ví lúc mua**, không so với NAV hiện tại — hình chỉ để đọc nhanh;
  con số thật vẫn ở DANH MỤC SAU LỆNH (server tính, C4). Không có "gợi ý".
- **Nhãn cách nhập lệnh** → `telemetry` (A9): bật `cham_nut` cho `shop-chip-truoc`
  · `shop-la-truoc` (câu hỏi §8.4: *"chip-trước và lá-trước có ra hai phân bố cỡ
  lệnh khác nhau không"*; ngày rà 30/09/2026). Không đụng `events`.

## 6. Từng lá chiến thuật cần gì (từ `DAC_QUYEN`)
Mua Đuổi · Bắt Đáy · Chặn Lỗ · Khớp Nhanh · Đa Dạng Hoá · Đi Ngược — không gì
(bị động). Lướt Sóng — nút Bảng điện tử ở đầu (giá 80/110). **Chia Lệnh** —
hàng chip có thêm nấc ±5% (chip 5%) — vẫn cách đều. **Đòn Bẩy** — "cầm rồi
chạm". **Bán Khống** — mặt KHỐNG của hàng chip + thẻ KHỐNG ở TAY. Phòng Hộ — ở
`QuanTriVon` trên bàn, không đổi. Kỳ ngộ (v32) — modal riêng, không đổi.

## 7. Giữ / Đổi / Bỏ
**Giữ:** vỏ overlay + mở/đóng · lưới 6 lá art · chia bài · lật · rung · (!) ·
DANH MỤC SAU LỆNH · KHỚP NGAY + hàng đợi + idempotency · CHỐT · khung GẮN/ĐỔI
ĐÍCH · cảnh báo · pane LÕI · Bảng điện tử · trận cũ (không nav) y nguyên.
**Đổi:** panel mốc bung-sau-khi-chạm → HÀNG CHIP sticky đáy · lệnh đã xếp → chip
trên lá + hàng "lá đã xếp" · kho DANH MỤC → TAY (chỉ lá chiến thuật + khống; tài
sản đang giữ hiện bằng CỌC ngay trên lá chợ) · lời 3 bước coach (id giữ).
**Bỏ:** nút "MUA" dưới mỗi lá (trận nav) · panel MUA/BÁN/KHỐNG.

## 8. Code chạm tới (dự kiến)
`HangChip.tsx` (+css, MỚI: 4 chip · 3 mặt · lá đã xếp · KHỚP NGAY) ·
`CocChip.tsx` (MỚI: cọc trên lá, chip bay/rơi) · `ShopManHinh.tsx` (nhánh nav)
· `GameCard.tsx` (`anNutMua`, ô đặt cọc) · `CoachTap.tsx` (lời 3 bước) ·
`config/telemetry.ts` (`CHAM_NUT_BAT` + ngày rà) · tests: hàng chip (4 chip
bằng nhau, không `aria-pressed` sẵn, chip tự thả sau lệnh, mặt RÚT chỉ khi có
cọc, mặt KHỐNG chỉ khi cầm lá, thứ tự chip→lá và lá→chip cùng ra một lệnh, Chia
Lệnh thêm nấc 5%, Đòn Bẩy cầm-chạm ⇒ `onDoiGan`, telemetry đúng id) ·
`shop_chuyen_canh` · `xemtruoc` · `coach*` giữ xanh. Không đụng `server/`.
`useKeoLa.ts` / `DaiMoc.tsx` (bản 1) không dùng — xoá khi chốt bản 2.

## 9. Thi công theo lượt
1. HÀNG CHIP + cầm-chạm thay panel cũ (chưa hiệu ứng) — shop đã là bàn cược.
2. CỌC trên lá + chip bay/rơi + khoá lúc chốt.
3. Coach lời + telemetry nhãn + LẶP (nếu duyệt).
4. Đo trên điện thoại thật một tay, rồi deploy.

## 10. Câu chờ founder
**Q1** Duyệt bố cục §2 + ngữ pháp "cầm rồi chạm" §3? · **Q2** Nút LẶP lệnh vòng
trước — có không? · **Q3** Vòng lá: pane LÕI CHIẾN THUẬT đứng đầu (chia bài
trước, chợ sau — đề xuất) hay dưới lưới như hôm nay?

## 11. DEMO CHƠI ĐƯỢC (16/08 tối) — founder: *"thử demo cho t xem"*

Artifact: https://claude.ai/code/artifact/90116bd5-37aa-4fea-9dcf-5f54db0c406e
(mở trên điện thoại là đúng khổ; nguồn: `ban-cuoc-template.html` + `build_demo.cjs`
trong scratchpad phiên 16/08 — ghép art + font từ repo, không phải file repo).

**Founder chỉnh trước khi làm: *"xem UI-UX cũ dùng được cái gì thì tận dụng lại
chứ không cần build mới 100%"*.** Nên demo là ĐỒ THẬT của app ghép lại, không
vẽ lại: `tokens.css` (màu · thang chữ) · `pixel.module.css` (khung khấc, nút lún
`steps`, `pxSang`) · `GameCard.module.css` nguyên (bevel · gem · scanline · art
70% · nút (!) · `.sel` chia xuống) · art pixel 80×60 thật của 6 mã + Đòn Bẩy +
Bán Khống (xuất từ `server/holdem_art.ts`) · mô tả (!) = `mo_ta` thật trong
`config/holdem.ts` (D28) · `ShopManHinh.module.css`: nền `.phu`, `.dau`, `.nutMoc`
+ `.nutMocAll:active`, tag `chipDap`, `.khopNgay`, `.nutChotShop`, khối
`.xemTruoc`, khối GẮN (`.ganKhung/.ganO`) · `adTheVao` chia bài so le · font
JetBrains Mono subset latin+vietnamese nhúng data-URI.
**Lớp MỚI duy nhất** = đúng phần thiết kế: hàng chip cầm-chạm 3 mặt (dán đáy) ·
cọc chip trên lá (xanh = chưa chốt · xám = đang giữ · đỏ = khống · vàng = all-in)
· chip bay `steps(6)` · cú ALL-IN (§5) · chốt = cọc khoá + lá pop % (số ngẫu
nhiên, chỉ để cảm) · LẶP · Đòn Bẩy cầm-chạm gắn ×2 · Bán Khống mở mặt KHỐNG.
Đo DOM 375px: đầu 40 · lưới 328 · sau lệnh 94 · tay ~165 · đáy dán 134 — cuộn
được, hàng chip + CHỐT luôn trong tay. Chưa chụp được ảnh (pane không hiện) —
founder tự mở link.

## Phụ lục — Bản 1 (16/08 sáng): DẢI MỐC + KÉO THẢ
Dải 4 vạch sticky dưới đầu, nhấc lá giữ 160ms rồi kéo lên vạch; TAY kéo bán;
Đòn Bẩy kéo đè lên lá. Founder: *"vòng nào cũng kéo kéo thả thả nếu chơi một
tay thì phiền"* — đúng, và casino mobile cũng không kéo. Giữ lại đây để không ai
đề xuất lại; hook `useKeoLa` viết xong nhưng không nối.

## ĐÃ SỬA
- 16/08 — bản 1: dải mốc + kéo thả.
- 16/08 chiều — bản 2: chip-first cầm-chạm, cọc chip, hiệu ứng casino, một tay;
  sau D91 (gỡ luật cấm casino) và câu hỏi một-tay/hiệu-ứng của founder.
- 16/08 tối — §11 demo chơi được từ đồ thật của app; §5 ALL-IN: yên thì ngang
  hàng, bấm mới đặc biệt (founder sửa).
- 16/08 tối — CHỐT ("làm y nguyên") + THI CÔNG: chuyển sang `thiet-ke-da-chot/07`,
  đo trên stack local thật (cầm→chạm hai chiều · KHỚP NGAY thật · LẶP · chạm cọc
  → RÚT · ALL-IN bốn hiệu ứng · CHỐT khoá → sang vòng), 3 mũi tiêm lỗi ngược đỏ
  đúng bài. Khác demo một chỗ nhỏ: cọc "đang giữ" đếm theo `START_VON/4` từ
  catalog (không gõ 2.500), chip đang xếp đếm theo mốc.
