# 03 — HỆ THỐNG THẺ SỰ KIỆN: TỪ "TÚI BỐC NGẪU NHIÊN" → "CHU KỲ TÍN DỤNG"

**Nguồn:** founder dán toàn văn bản v2 ngày 01/08/2026 (soạn ở phiên chat thiết kế
ngoài repo — tham chiếu "§16/§17/§18" trong đó là số mục của tài liệu chat, KHÔNG
tồn tại trong repo; bảng ánh xạ dưới đây là bản dịch sang địa chỉ code thật).
File này là LUẬT ĐANG CÓ HIỆU LỰC của cụm; toàn văn v2 giữ trong lịch sử chat.

## 1. Chẩn đoán gốc và luận điểm

Thẻ đang rút gần-như-i.i.d. từ một túi cố định ⇒ chuỗi ô không có quán tính ⇒ cảm
giác hỗn loạn. Thay *túi* bằng **máy trạng thái**: thẻ là **quan sát của một trạng
thái**, và trạng thái bị chính thẻ vừa lật làm thay đổi. Các luật founder liệt kê
là các đoạn của MỘT vòng — **chu kỳ tín dụng**:

```
Hạ lãi suất → NỚI LỎNG → sức căng dồn → VỠ → khủng hoảng thanh khoản
     ↑                                              ↓
  Phục hồi  ←────  Hạ lãi suất KHẨN CẤP (ngoài lịch)  ←┘
```

Người chơi thôi đếm thẻ — người chơi **ĐOÁN TRẠNG THÁI**.

## 2. Ánh xạ khái niệm v2 → code thật

| Khái niệm v2 | Trong repo | Ghi chú |
|---|---|---|
| `giai_đoạn` 5 trạng thái ("§16.4") | `GIAI_DOAN` [config/holdem.ts:789](../../config/holdem.ts) | CẤM tạo biến regime thứ hai — máy ĐỌC VÀ GHI đúng biến này |
| bộ bài mặt thẻ | `SU_KIEN` (7 mặt) + 5 giai đoạn, [config/holdem.ts:813](../../config/holdem.ts) | v2 KHÔNG thêm mặt nào |
| dây chuyền sự kiện | `MT_SU_KIEN_KE_TIEP` [config/holdem.ts:842](../../config/holdem.ts) | trở thành một phần EmissionRow |
| sự kiện theo giai đoạn | `SU_KIEN_THEO_GIAI_DOAN` [config/holdem.ts:1813](../../config/holdem.ts) | đã là mầm "hàm phản ứng" — bước 2 thay bằng lịch + hàm công khai |
| `tail_pending` (MODIFIERS) | `chuoiEp` của bong bóng, [map.ts](../../server/holdem/map.ts) | bong bóng-là-thẻ sẽ chết ở bước 4 khi sức căng thay nó |
| echo_stack ("§17.2") | `echoDangCo` [engine.ts:1033](../../server/holdem/engine.ts) | đầu vào nạp/xả sức căng |
| joker/tin giả ("§17.1") | `la_tin_gia` + `TY_LE_TIN_GIA_THEO_BOI_CANH` | dùng lại cho "báo động giả" của telegraph ngoài lịch |
| nhóm tương quan ("§16.2") | mô hình một nhân tố β (D39) + `nhom` trong `TAI_SAN` | kênh LAN sức căng |
| `P_TAIL` | = P(ô ra `thien_nga_den`) suy từ `TY_LE_O_SU_KIEN_BP` × trọng số hiện tại — KHÔNG đặt số mới | giữ envelope tỷ lệ cháy đã tune |
| Bust | cháy NAV ≤ `NGUONG_CHAY_BP` (v10) | |
| Lướt Sóng + bộ đo | `DAC_QUYEN.LUOT_SONG` + Bảng điện tử | bước 5, SAU bước 4 |
| thí nghiệm Kelly | task #27 (Kelly-3-bot) — CHƯA CHẠY | §0.3: cấm tune trước khi xong |

## 3. Bất biến (không được phạm)

- **Một lớp trạng thái duy nhất** — máy đọc/ghi `giai_doan`, cấm regime song song.
- **Tất định:** mọi sample từ seed qua `rngAt` địa chỉ hoá; S là hàm toàn phần của
  trạng thái đã ghi; integer bps; replay byte-hệt.
- **Ngân sách xác suất:** `P(mặt) = P_TAIL + P_CAL + (1−P_TAIL−P_CAL)×EmissionRow`.
  P_TAIL đọc từ config đang chạy. Sức căng KHÔNG chiếm mặt thẻ, KHÔNG đụng P_TAIL —
  chỉ (a) nắn EmissionRow, (b) nhân độ lớn. Hai đường tách bạch.
- **EV phẳng, phương sai nổ:** độ lớn cú sập tỉ lệ S lúc nổ; đu đỉnh bị phạt qua
  rủi ro phá sản, KHÔNG qua EV bóp tay (không ai đu = không có dữ liệu).
- **Không tín hiệu nào tin cậy 100%** (kể cả hàm phản ứng chính sách: ~15% sai lầm,
  độ lớn giấu). Tín hiệu chắc chắn = cột calibration chết.
- **Phân phối CÔNG KHAI, realization GIẤU:** ma trận + hàm phản ứng + luật nạp/xả +
  3 tham số chu kỳ của map vào bách khoa; chỉ giá trị S tức thời và thứ tự bị giấu.
- **Ẩn ex-ante được, LỘ ex-post BẮT BUỘC:** Chốt phiên phải hiện đường đọc
  ("Hạ lãi suất ô 4 → sức căng BTC dồn 3 vòng → thẻ Giảm giáng ×S vào đúng BTC").
  Không hiện được đường đọc = cấm ship cơ chế đó.
- **D26:** bộ đo gọi là **"Sức căng thị trường"**; "thiên nga đen" không vào chuỗi
  player-facing khi chia 5 mặt đuôi (bước 7).
- **Đường di trú §0.2:** đổi CẤU TRÚC và SỐ ở hai bước khác nhau; mỗi lần sửa MỘT
  hàng ma trận, đo lại sau mỗi hàng. Đã dính confound 3 lần — không có lần 4.

## 4. Trường dữ liệu §8.3 — ĐÃ ĐỊNH NGHĨA, append-only

**Đã chảy vào DB từ 01/08** (test khoá: `tests/holdem_nav_api.test.ts` "§8.3").

`hd_chot_phien.state_snapshot_json` — trạng thái máy của Ô VỪA LẬT, ghi MỌI vòng
(~230 byte, trong mục tiêu A7 ≤ ~300). Nguồn: `TrangThaiO` trong
[map.ts](../../server/holdem/map.ts), mảng `trang_thai` song song với `o`:

| Field | Nghĩa (KHÔNG được đổi về sau — chỉ được THÊM field) |
|---|---|
| `market_state` | giai đoạn nền của máy NGAY TRƯỚC khi phát ô |
| `run_direction` / `run_length` | chuỗi hiện hành SAU khi tính ô; hướng: tăng/phục hồi=1 · giảm=−1 · đi ngang/biến động=0; **ô sự kiện ĐÓNG BĂNG chuỗi** (tin không phải giá) |
| `face_prior_bps` | xác suất ex-ante của đúng mặt đã nổ, theo TRẠNG THÁI MÁY trước cú rút (ô bị chuỗi ép = 10000) — mẫu số của cột calibration |
| `tension_true_bps` | mảng 6 phần tử theo `THU_TU_MA_SUC_CANG` (btc·cp_cn·vn30·vang·usd·tpcp — đổi thứ tự là hỏng dữ liệu cũ). Bước 1 khoá 0: **số 0 là ground truth**, không phải placeholder |
| `tension_visible` / `tension_band_shown` | cờ hiển thị — chống confound thứ tư: hai quần thể (thấy/không thấy bộ đo) phải tách được vĩnh viễn |
| `is_policy_cell` | ô lịch chính sách (bước 2 mới tồn tại → hôm nay false là sự thật) |
| `tail_face` | mặt đuôi đã nổ (hôm nay = `thien_nga_den`; chia 5 mặt là bước 7) |

`hd_cam_ket.value_json` thêm: `lenh` (lệnh ĐÃ ÁP — cùng kỷ luật "ghi nước đã áp")
và **`tension_at_exit_bps`** {mã: bp} — cột vàng: sức căng THẬT tại lúc người chơi
RỜI HẲN một mã (vị thế >0 → 0). Ghép với `tension_visible` đo được "biết thì thoát
sớm hơn bao nhiêu" — thí nghiệm tự nhiên nằm sẵn trong game.

**Field của cơ chế CHƯA tồn tại cố ý VẮNG MẶT thay vì null** (`policy_expected_dir`,
`policy_actual_dir`, `cycle_*`, `is_offcalendar_rate`, `telegraph_reliability_bps`):
vắng = cơ chế chưa ship, có mặt = giá trị thật — hai nghĩa không được trộn. Chúng
BẮT BUỘC vào cùng commit với cơ chế tương ứng (bước 2/3/6), không được trễ hơn.

## 5. Thứ tự thực thi — mỗi bước một gate

| Bước | Nội dung | Gate | Trạng thái |
|---|---|---|---|
| 1 | Cấu trúc máy + ma trận phẳng + field §8.3 | 7.1 regression byte-hệt | **XONG 01/08** — `sinhMap` là máy trạng thái, fixture `tests/fixtures/holdem_map_golden.json` chụp tại 09a37bc, 24 map deep-equal + 600 seed×3 cỡ hash |
| 2 | Ô lịch chính sách + hàm phản ứng nội sinh | 7.6 bot-theo-dõi ≥~80%, bot-lờ ≈ random | **XONG 01/08** — `balance-v11-lich` (CHƯA mặc định): `LICH_CHINH_SACH` config, `huongChinhSachKyVong` công khai trong catalog, ~15% sai lầm, lãi ngoài lịch ×0,2, cấm sự kiện đứng ngay trước ô lịch (giữ tính-được), gate 7.6 nằm trong `tests/holdem_lich.test.ts`. CÒN THIẾU của §4.3: telegraph đuôi 75–80% cho lãi suất ngoài lịch (làm cùng bước 4 vì đụng lịch đuôi). Flip mặc định CHỜ đo lại envelope trên v11 |
| 3 | Quán tính từng hàng (con số quan trọng nhất) | 7.5 autocorrelation ↑ rõ | **XONG 01/08** — `QUAN_TINH` (chuỗi ≥2 nghiêng tiếp diễn ⭐3500bp · giảm kéo biến động ⭐1500 · Phục hồi chỉ mở sau Giảm ≥2), gate 7.5: autocorr 0,034→0,155; chuỗi tăng p99,9 = 9 (hazard tự nhiên, Q3). `balance-v12-quantinh` = MẶC ĐỊNH từ 01/08 (founder lệnh "thắng đậm thua đau"); nợ bước 7: G1–G4 chạy lại toàn bộ |
| 4 | Sức căng: nạp/xả + hazard + độ lớn | 7.2 EV phẳng · 7.3 thua ở BXH · 7.4 không đu miễn phí cuối map | **XONG 01/08 (lõi)** — `SUC_CANG` hai tầng: S-map trong `sinhMap` (nạp pha thuận × thanh khoản × nới lỏng, xả dần/xì khi giảm, lan nhóm, giải phóng khi nổ; hazard Giảm += S_max×0,5) + crowding bàn ở tầng ĐỘ LỚN (`sucCangLuc`, phản thân C4); khuếch đại bất đối xứng TỐT 1,0 / XẤU 3,5 (dò từ 0,8/2,0 — mức đầu chưa đủ đau); chain gọi tên "sức căng khuếch đại" (8.4). `balance-v13-succang` = MẶC ĐỊNH 01/08. **GATE §4.2b ĐẠT** (xem §7). CÒN NỢ: đo riêng 7.2 EV-theo-chuỗi + 7.4 cuối-map; telegraph đuôi §4.3; bộ đo 3 dải cho Lướt Sóng là bước 5 |
| 5 | Bộ đo cho Lướt Sóng (dải thô + log cờ) | 7.7 ≤30% D21 · 7.8 nhỏ hơn khoảng cách oracle–naive | **XONG 01/08 (lõi)** — 3 dải ÊM/CĂNG/RẤT CĂNG (`daiSucCang`), che ở TẦNG API (ghế không cầm lá: field vắng — F12 không moi được), ngưỡng dải vào catalog (luật công khai 8.2), ex-post MỌI NGƯỜI thấy dải trong chain ("sức căng RẤT CĂNG khuếch đại"), cờ `tension_visible`/`tension_band_shown` vào events (chống confound thứ tư — thí nghiệm tự nhiên §5.5c sống). Đo lại Kelly trên v14: gate vẫn ĐẠT (2,602). CÒN NỢ: gate 7.7/7.8 đo trên dàn archetype (gộp vào G1–G4 re-run bước 7) |
| 6 | 3 tham số chu kỳ/map | 7.9 hình dạng map phân tán rõ | **XONG 01/08** — `CHU_KY` rút từ seed (phân phối đều công khai), speed nhân quán tính + map CHẬM hạ ngưỡng chuỗi về 1 (gate 7.9: autocorr chậm−nhanh ≥ 0,04 sau khi đo ra chỉ nhân biên là bất lực 0,023); amp/asym nhân độ lớn chốt phiên (`apChuKyBienDo`, Bảng điện tử cùng closure); công bố đầu trận trên MarketMap; cycle_* vào log. **§4.3 CŨNG XONG**: lãi suất ngoài lịch ~75% ép thiên nga ở i+2..i+4 (chỉ TUYÊN điềm khi còn chỗ báo — đo 4.000 map: né quá tay + hết map từng nuốt nửa số điềm, ứng nghiệm 38,6%→65%±; ngoai_lich/telegraph_bps vào log). Kelly v15: GATE ĐẠT (kelly 2,839 < bừa 3,005/3,190); ghi nhận tien_mat 2,814 thành đấu thủ thật — map sập gắt thì đứng ngoài là kỹ năng, đúng chủ đích §5.6. `balance-v15-chuky` = MẶC ĐỊNH 01/08 |
| 7 | 5 mặt đuôi thay thẻ Thiên nga đen (founder 01/08: BỎ thẻ, vẽ 5 thẻ mới; thiên nga = icon trạng thái Bảng điện tử) | 7.10 chạy lại TOÀN BỘ | **XÂY XONG — GIỮ Ở CỔNG (v16 CHƯA mặc định)**: 5 mặt (phap_ly 30 · pha_san 25 · cam_van 20 · tham_hoa 15 · dich_benh 10% của trọng số thiên nga cũ — P_TAIL bảo toàn, test khoá ±20%), chữ ký tài sản + β riêng từng mặt, chains khép vòng (mọi đuôi → hạ lãi; cấm vận → lạm phát), điềm báo ép mặt theo ngân sách, art pixel 5 lá đạt lint (34/34), icon thiên nga 'RỦI RO ĐUÔI CÒN DƯ ÂM' trong Bảng. **GATE §4.2b ĐỎ trên v16 sau 4 lần dò** (kelly 3,31 · tien_mat 2,27 nhất — 'không chơi' thống trị = mất dữ liệu): đuôi hẹp-sâu nghiền ghế tập trung; đã thử hạ độ sâu 25%, trả phần bù phòng thủ, gỡ răng khi-dồn/mỏng-đi — đều bất động ⇒ đòn bẩy thật chưa tìm ra (nghi: tương tác đuôi × sức căng × chu kỳ asym). VIỆC ĐẦU PHIÊN SAU: cô lập từng cờ (v16 trừ sucCang, trừ chuKy) để quy trách nhiệm, rồi mới flip + G1–G4 |

Mọi bước đổi hành vi đi sau cổng `balance_version` mới — trận cũ replay nguyên luật
cũ. Bước 1 KHÔNG cần cổng: byte-hệt là bằng chứng.

## 6. BỐN CÂU §10 — FOUNDER CHỐT 01/08

1. **Ô lịch map 8 = Ô 4** (theo khuyến nghị — số học vừa khít map 8).
2. **Bộ đo sức căng = 3 DẢI** êm/căng/rất căng (theo khuyến nghị).
3. **Chuỗi thẻ Tăng = HAZARD TỰ NHIÊN, không cap cứng** (theo khuyến nghị) —
   Monte Carlo phải báo lại phân vị 99,9 khi bước 3/4 chạy.
4. **`P_TAIL` = THEO TRẠNG THÁI ngay từ v1** — ⚠ NGƯỢC khuyến nghị, founder chấp
   nhận cái giá: envelope cháy đổi từ đầu ⇒ bước 4 khi nắn hazard đuôi theo S
   được phép đụng cả P_TAIL, và toàn bộ gate cũ (bust 20–50%, G1–G4) PHẢI đo lại
   trên engine mới trước khi bất kỳ version nào chứa nó thành mặc định. Tổng
   ngân sách đuôi lúc trung tính vẫn đọc từ config đang chạy (không đặt số mới).

## 7. THÍ NGHIỆM KELLY (§0.3) — ĐÃ CHẠY 01/08: **KHÔNG ĐẠT, và đó là chẩn đoán**

`scripts/holdem_kelly.ts` (2.000 trận × bàn 5 × map 12 × v10b, ba bot đi vốn
CHUNG chính sách chọn mã — kỷ luật D37). Ba biến thể Kelly đều thua bot bừa:

| Bot | hạng TB (3 lần chạy) | ghi chú |
|---|---|---|
| kelly (3 biến thể: all-in-switch → +var sự kiện → +lợi suất vượt) | 3,025 · 3,142 · 3,106 | luôn BÉT nhóm giao dịch |
| co_dinh 50% | 2,537 · 2,878 · 2,837 | |
| bua_size (cùng mã, cỡ bừa) | 2,881 · 2,826 · 2,854 | |
| bua_full (mã bừa + cỡ bừa, ôm nhiều mã) | 2,891 · 2,748 · 2,763 | NAV cao nhất, nhất 35% |
| tien_mat (không chơi) | 3,666 · 3,406 · 3,440 | luôn bét |

**Chẩn đoán cấu trúc — vì sao KHÔNG sửa được bằng bot khôn hơn:** trong
30.000 ghế-trận **không một ai cháy** (NGUONG_CHAY 10% không chạm nổi trong 12
vòng), tiền mặt chảy máu 150 bp/vòng, tài sản trôi dương ⇒ **chiều CỠ VỊ THẾ
không có đánh đổi**: phơi nhiễm nhiều hơn thì tốt hơn, tuyệt đối. Kelly — bản
chất là máy cân đánh đổi lãi/phương sai — không thể thắng ở nơi phương sai
không bị trừng phạt; bot bừa "vô tình" phơi nhiễm cao + ít đảo + rải mã nên
đứng đầu. Đây chính là "all-in vô não" của D37 tái sinh ở v10 dưới dạng cỡ lệnh.

**Hệ quả cho lộ trình (không tự chốt số — A8.2):** thứ làm cỡ vị thế thành
quyết định thật là chính bước 4 của tài liệu này — sức căng ("EV phẳng, PHƯƠNG
SAI NỔ"), trừng phạt cá biệt theo S, và một đường cháy CHẠM ĐƯỢC. Gate §4.2b
đo lại bằng ĐÚNG script này sau bước 4; nó chính là gate 7.2/7.3 nhìn từ phía
người đi vốn. Trước đó KHÔNG tune số nào lên chiều cỡ lệnh — thước đang cong.

**Đo lại trên v12 (sau bước 3, 01/08):** kelly 2,804 · co_dinh 2,796 ·
bua_size 3,017 · bua_full 2,613 · tien_mat 3,769. **Kelly ĐÃ vượt bot bừa-cỡ**
— đọc chuỗi thành có giá trị thật; gate còn hụt đúng một vế: `bua_full` (ôm
mọi mã, phơi nhiễm tối đa) vẫn nhất vì phương sai vẫn chưa bị trừng phạt
(30.000 ghế-trận vẫn 0 ai cháy). Vế đó là ĐÍCH ĐO của bước 4.

**Đo lại trên v13 (sau bước 4, 01/08) — GATE ĐẠT:** kelly **2,623** (nhất
bàn, top-1 32,9%) < bua_full 2,969 < co_dinh 3,091 < bua_size 3,215;
gradient chuẩn từng nấc; cháy chạm được (0,2–0,3% nhóm bừa). Hai điều kiện
làm gate xanh: (a) vế xấu 3,5× + crowding 2× — ôm-tất và dồn-một-mã đều có
giá; (b) bot kelly nâng lên ĐA MÃ (f_a = ½μ_vượt/σ² từng mã, ≤3 mã, chuẩn
hoá) — công thức thật có chiều chọn RỔ, và v13 làm đa dạng hoá thành có giá
thật. ⚠ Ghi để canh: kelly top-1 32,9% vs á quân 24,5% — chớm ngưỡng
"chạy trốn" D21 (>30% + cách ≥8); bot này gần oracle-của-luật hơn người
thường, phán quyết cuối thuộc về G1–G4 re-run trên dàn archetype (bước 7).

## ĐÃ SỬA

- 01/08/2026 — tạo file; thi công bước 1 cùng ngày (gate 7.1 xanh). Ai quyết:
  founder (dán bản v2), agent thi hành đúng thứ tự §9.
- 01/08/2026 — founder chốt 4 câu §10 (mục 6); thi công bước 2 (`balance-v11-lich`,
  chưa mặc định). Số đo gate 7.6 (`scripts/holdem_lich_do.ts`, 3.000 seed/cỡ):
  bot theo dõi đúng **85,2–85,3%** (trần lý thuyết 85%, sàn gate 80%) · phân bố
  hướng tăng/hạ/giữ ≈ **13/36/51%** — cả ba hướng sống · lãi suất chiếm 32,6–44,3%
  số sự kiện v11 (phần lớn là ô lịch; đối chứng v10b 33,1% rải ngẫu nhiên).
  Lưu ý cân bằng đã thấy trước: "hạ" chiếm ~36% kỳ họp mà hạ→bong bóng nặng 5000
  trong `MT_SU_KIEN_KE_TIEP` ⇒ v11 sẽ đẻ nhiều bong bóng quanh ô lịch hơn — đúng
  loại dịch chuyển phân phối khiến flip mặc định phải chờ đo lại envelope.
