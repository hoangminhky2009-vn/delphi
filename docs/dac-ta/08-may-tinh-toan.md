# 8. MÁY TÍNH TOÁN — xác suất, tương quan, và mọi phép tính tiền của Đấu trường

> 📄 **Gửi cho người NGOÀI repo thì gửi [`docs/xac-suat-va-nguon.html`](../xac-suat-va-nguon.html)**
> (D-số chờ cấp), không gửi tệp này. Bản HTML đứng một mình, chở đúng ba mục —
> *cách tính xác suất · nguồn ngoài đời của từng số · chỗ KHÔNG có nguồn* — cộng bảng đo
> sinh bằng cách CHẠY engine (`do:chu-ky-thuc-te` + đếm 20.000 bàn), không tính lại công
> thức bằng JS (D61). Tệp này vẫn là nguồn nội dung; sửa bên đây TRƯỚC rồi mới sửa HTML.

> Đọc `00-ban-do.md` trước nếu chưa quen bộ đặc tả. File này là bản đồ SỐ HỌC —
> không nói UI, không nói hạ tầng, không nói PFM hay chợ dự báo. Nó trả lời một câu
> duy nhất: **con số người chơi thấy trên màn được tính ra như thế nào, và vì sao
> lại tính kiểu đó.**
>
> ⚠ File này trôi được như mọi tệp trong `docs/dac-ta/` — code + `config/holdem.ts`
> + `config/holdem_balance.ts` LUÔN thắng khi mâu thuẫn (D61/D80). Mọi công thức dưới
> đây chép từ code tại thời điểm viết (09/09/2026, ngay sau khi founder duyệt lật
> `balance-v42-taisan`, D313). Đổi cân bằng ⇒ sửa file này cùng commit, hoặc ít nhất
> ghi một dòng "đã trôi" ở đầu mục liên quan.
>
> **Quy ước đọc số:** mọi hằng số hậu tố `_bp` là **phần vạn** (basis point kiểu
> nội bộ, KHÔNG phải bp tài chính chuẩn 1/100%): `10000 = 100% = hệ số ×1`. Công thức
> chuẩn dùng khắp repo là `applyBpInt(v, bp) = floor(v × bp / 10000)` — **luôn làm
> tròn xuống**, kể cả số âm (`server/sandbox/rng.ts:idiv`). Lãi suất nền là NGOẠI LỆ
> duy nhất: đơn vị của nó là **điểm** (1 điểm = 0,01%/năm), không phải `_bp` — trộn
> hai đơn vị này là lỗi có thật đã xảy ra trong lịch sử repo (xem `config/holdem.ts`
> ngay trên định nghĩa `LAI_SUAT_NEN`).

## Mục lục

1. [Cổng phiên bản đang chạy](#1-cổng-phiên-bản-đang-chạy)
2. [Máy sinh ô thị trường](#2-máy-sinh-ô-thị-trường-serverholdemmaptssinhmap)
3. [Tương quan tài sản — mô hình một nhân tố](#3-tương-quan-tài-sản--mô-hình-một-nhân-tố)
4. [Ma trận TÀI SẢN × GIAI ĐOẠN / SỰ KIỆN — ba đời](#4-ma-trận-tài-sản--giai-đoạn--sự-kiện--ba-đời)
5. [Dây chuyền chấm điểm một vòng (`dungChuoi`)](#5-dây-chuyền-chấm-điểm-một-vòng-dungchuoi)
6. [`apDinhGia` và thứ tự đầy đủ trong `chotPhien`](#6-apdinhgia-và-thứ-tự-đầy-đủ-trong-chotphien)
7. [LÕI ↔ LÕI — các cơ chế nói chuyện với nhau](#7-lõi--lõi--các-cơ-chế-nói-chuyện-với-nhau)
8. [Thẻ chiến thuật: xung đột, cộng hưởng, ma trận × sự kiện](#8-thẻ-chiến-thuật-xung-đột-cộng-hưởng-ma-trận--sự-kiện)
9. [Tiền: quỹ vòng, phí, lạm phát, đòn bẩy, ký quỹ, cháy, ngân hàng](#9-tiền-quỹ-vòng-phí-lạm-phát-đòn-bẩy-ký-quỹ-cháy-ngân-hàng)
10. [Bot chấm điểm — phản chiếu công thức engine](#10-bot-chấm-điểm--phản-chiếu-công-thức-engine)
11. [NHỮNG CHỖ MÔ HÌNH ÉP THỰC TẾ](#11-những-chỗ-mô-hình-ép-thực-tế)
12. [Phụ lục — hằng số sống ở đâu](#12-phụ-lục--hằng-số-sống-ở-đâu)

---

## 1. Cổng phiên bản đang chạy

Mọi cơ chế dưới đây nằm sau một **cờ phiên bản** (`config/holdem_balance.ts:BoLuatCanBang`,
tra bằng `luatCua(balance_version)`). Trận cũ replay bằng đúng bộ cờ đã lưu — không phải
bộ đang mặc định. Bảng dưới liệt kê MỌI cờ đã đổi qua bốn phiên bản gần nhất; cờ nào không
xuất hiện ở một cột nghĩa là giữ y hệt cột bên trái.

**Mặc định hiện tại: `balance-v45-duongcong`** (`config/holdem.ts:HOLDEM_BALANCE_VERSION`,
D318 — xếp chồng nên kéo cả `v43` ngân hàng và `v44` tương quan lên cùng). Toàn bộ tài liệu này
mô tả hành vi dưới cờ ấy trừ khi ghi rõ khác.

⚠ **Đã trôi một bản, sửa 10/09:** tệp này viết lúc mặc định là `v44` và câu trên vẫn nói v44
cho tới 10/09. Ba cờ v45 (`duongCong` · `bienDongV45` · `couponGiuDu`) **không chạm máy xác
suất** — chúng đổi coupon Trái phiếu Mỹ và biên nhiễu bốn mã — nên §2/§4-nghiêng/§5 vẫn đúng;
thứ §4.1 nói sai là cột `bien_dong_bp`, xem bảng ngay dưới. Dump thẳng từ config 10/09:
`btc 500 · cp_cn 380 · vn30 170 · vang 150 · usd 70 · tpcp 90` (`bienDongCua`, lớp v45 đè
trước lớp v44).

⚠ Tài liệu này viết lúc mặc định còn là v42, và hai khối ⛔ dưới đây được viết cho trạng thái
"đang ở cổng". Chúng đã được sửa lúc lật; nếu còn thấy chỗ nào nói v43/v44 "chưa mặc định" thì
đó là chỗ trôi — **CODE thắng** (A11.5), sửa tài liệu chứ đừng tin nó.

| cờ (`BoLuatCanBang`) | ý nghĩa | v40<br>(lịch cố định) | v41<br>(lớp VN) | **v42 — MẶC ĐỊNH** | v43<br>(ngân hàng) | v44<br>(tương quan v2) |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `lopVn` | ma trận độ lớn theo dữ liệu VN | tắt | **bật** | bật | bật | bật |
| `taiSanV42` | bộ số 3 mã suy lại cho CP Chứng khoán/USDT/TPMỹ | tắt | tắt | **bật** | bật | bật |
| `couponTpcp` | Trái phiếu Mỹ trả lãi vào tiền mặt mỗi ô | tắt | tắt | **bật** | bật | bật |
| `khongTheoMa` | sàn VN chặn MỞ khống cổ phiếu cơ sở | tắt | tắt | **bật** | bật | bật |
| `tienMatSuKien` | ô lạm phát trừ thẳng tiền mặt tự do (mọi ghế) | tắt | tắt | **bật** | bật | bật |
| `khoaTaiSanTat` | **TẮT hẳn** cơ chế Khoá nắm giữ 2 vòng | tắt | tắt | tắt | **bật (= tắt cơ chế)** | bật |
| `tietKiem` | hợp đồng gửi tiết kiệm (`TIET_KIEM`) | tắt | tắt | tắt | **bật** | bật |
| `betaTaiSanV2` | β riêng theo mã cho CTCK/USDT (`BETA_V44`) | tắt | tắt | tắt | tắt | **bật** |

✔ **`balance-v43-nganhang` (D314) — ĐÃ LẬT 09/09 cùng v44 (D317).** Đây là hai cờ founder đã
duyệt HÌNH DẠNG, chưa duyệt SỐ (`config/holdem_balance.ts` dòng khai `'balance-v43-nganhang'`).
Bật nó là một cú đổi luật kép: cơ chế "Cam kết giữ tài sản 2 vòng" (§7.5 dưới) chết hẳn,
nhường chỗ cho **hợp đồng gửi tiết kiệm** — khoá tiền mặt N ô lấy lãi cố định cao hơn hẳn
lãi suất nền, huỷ trước hạn mất toàn bộ lãi treo (§9.8). Gate riêng cho cụm này là **G5**
(`scripts/holdem_montecarlo.ts`), canh đúng ba cửa: có ai "gửi hết rồi ngồi im" không, mốc
dài có đáng thật không, và ngân hàng có ăn vào lãi cân bằng chỗ khác không.

✔ **G5 ĐÃ XANH sau khi chốt số ở D317.** Bộ đầu (`PHAN_BU 50` / `THEM_4 100`) làm G5a và G5b
đỏ; bộ chốt là **`PHAN_BU 25` / `THEM_KY_HAN [0,50,50]`**. Gate 12.000 × 3 cỡ × 2 phiên bản:
**15/15 xanh**, ba mốc nằm trong 0,31 hạng với đỉnh Ở GIỮA (tk_3).
⚠ Chỗ trông như lỗi mà là chủ ý: **mốc 3 và mốc 4 trả CÙNG lãi/ô**. Bản dốc đều (`[0,25,50]`)
đã được đo và TÁI TẠO ĐÚNG lỗi cũ — `tk_4` trội lại. Trong một trận ngắn, khoá lâu gần như
không mất gì mà lại ăn lãi nhiều ô hơn, nên bất kỳ phần bù kỳ hạn dương nào cũng làm mốc dài
nhất thắng tuyệt đối. Chỗ phẳng CHÍNH LÀ cách chữa. Chi tiết ở D317.

✔ **`balance-v44-tuongquan` (D315) — MẶC ĐỊNH TỪ 09/09 (D317).** Founder chỉ ra 09/09: D311
(v42) đổi ĐỘ LỚN của ba hàng ma trận nhưng quên đổi TƯƠNG QUAN — USDT ăn đòn đúng ở ba mặt
tin crypto nhưng phần rủi ro riêng (β) vẫn y hệt đô la, và CP Chứng khoán được mô tả "lên
xuống mạnh hơn cả thị trường nó phục vụ" nhưng β của nó vẫn là β của CP Công nghệ cũ. Xem §3.4.

**Cách đọc bảng khi vặn số:** mọi hằng số đánh dấu `// MC-TUNE` trong `config/holdem.ts`
là **đề xuất của agent, chưa qua tay founder theo đúng nghĩa** — kể cả khi đang là mặc định.
A8.2 cấm agent tự chỉnh chúng; đổi phải qua Monte Carlo (`npm run gate`) rồi trình. Hằng số
không có nhãn đó là **founder đã chốt bằng lời** (trích trong docstring ngay cạnh).

---

## 2. Máy sinh ô thị trường (`server/holdem/map.ts:sinhMap`)

### 2.1 Cấu trúc, và vì sao tất định tuyệt đối

> ⚠ **ĐÃ TRÔI TỪ v53 (D373) — ô của vòng KHÔNG còn ngửa lúc người chơi quyết định.**
> Mọi câu dưới đây nói "ô đang lật" viết theo luật ≤ v52, khi `o_hien_tai` gửi thẳng
> `map.o[vong-1]` cho client TRƯỚC pha đặt lệnh. Từ `balance-v53-upo`, ô ấy còn ÚP tới lúc
> chốt: người chơi cược vào lá SẮP LẬT, đọc tín hiệu từ lá tin VỪA LẬT (telegraph).
> **Không một phép tính nào ở tệp này đổi** — `chotPhien` vẫn định giá bằng `map.o[vong-1]`;
> thứ đổi là ai được THẤY nó lúc nào (một cửa `vongDaLat(st)`). Xem `docs/nhat-ky/D373.md`.

Một trận là một dãy N ô úp (`HoldemMap.o`, N ∈ {8, 12, 16}), sinh **một lần** lúc tạo trận
từ `seed`, lật 1 ô/vòng. Mỗi ô là:

- **Giai đoạn nền** (`ONenGiaiDoan`): một trong 5 pha — `di_ngang · tang · giam · bien_dong
  · phuc_hoi` (`config/holdem.ts:GIAI_DOAN`).
- **Sự kiện** (`OSuKien`): một trong 12 loại (`config/holdem.ts:SU_KIEN`), kèm cờ ẩn
  `la_tin_gia` (tin giả hay thật — **đã định đoạt lúc sinh map, không random lúc chơi**) và
  `bao_truoc` (giai đoạn nó telegraph nếu là tin thật).

Mọi lần rút số trong `sinhMap` đi qua `rngAt(seed, domain, ...toạ_độ)` — băm theo TOẠ ĐỘ,
không phải một dòng ngẫu nhiên tuần tự. Hệ quả: thêm/bớt người chơi hay đổi thứ tự duyệt
không xê dịch một ô nào. Đây là lớp phòng thủ chính giữ cho **replay = tính lại từ đầu**
luôn ra đúng một kết quả, mãi mãi — kể cả khi luật engine đã đổi mười lần, vì mỗi trận
mang theo `balance_version` của chính nó và `luatCua()` tra ra đúng bộ cờ lịch sử.

**Xác suất một ô là sự kiện** (thay vì giai đoạn nền): `NHA_CAI.TY_LE_O_SU_KIEN_BP = 3500`
(35%), trừ **map 8** dùng hồ sơ riêng "ngắn & căng" (`config/holdem.ts:HO_SO_MAP[8]`):
`TY_LE_SU_KIEN_BP = 5600` (56%) — mật độ tin cao nhất trong ba cỡ bàn, để bù việc map 8 quá
ngắn để có nổi một chu kỳ đọc được. Không có sự kiện ở vòng 1 và vòng ngay trước ô
lịch chính sách (`NHA_CAI.KHONG_SU_KIEN_TRUOC_VONG = 2`); không hai sự kiện liền nhau (để
tin giả của ô trước LUÔN kịp lộ trước khi ô sau lật — nền của cả cơ chế đọc tin).

### 2.2 Hai máy sinh khác nhau qua lịch sử: rút pha độc lập → REGIME TICK

Trước v36 (`config/holdem.ts:REGIME_TICK` docstring), mỗi ô giai đoạn là một cú rút có
trọng số ĐỘC LẬP, chỉ được nghiêng bởi quán tính (v12) và telegraph. Từ v36
(**đang mặc định**, cổng `regimeTick`), map 8 vẫn dùng máy CŨ (hồ sơ D177 "ngắn & căng"),
còn **map 12/16 dùng MÁY REGIME TICK**: nền có HƯỚNG (`runHuong ∈ {lên, xuống, không}`)
và TUỔI (`runDai`), mỗi ô là một "tick" của nền đó, theo 5 nhịp cố định
(`server/holdem/map.ts:sinhMap`, đoạn `coTick`):

1. **Tin tốt THẬT cắt chuỗi giảm** — nếu nền đang xuống và ô sự kiện thật ngay trước có
   `bao_truoc: 'tang'`, có `RT.CAT_CHUOI_XAU_BP` cơ hội mở mặt **`phuc_hoi`** (đường DUY NHẤT
   mặt này còn xuất hiện — nó không còn là một mặt rút ngẫu nhiên).
2. Nếu không, và nền ĐANG có hướng: tính **hazard gãy** (§2.4).
3. Không gãy ⇒ nền SỐNG, rút mặt trên nền (thuận hướng / nghỉ / biến động).
4. Gãy ⇒ rút mặt CHUYỂN TIẾP (về ngang / đảo hướng / biến động) — **XUỐNG không bao giờ nhảy
   thẳng lên qua hazard**, chỉ tin tốt thật ở nhịp 1 mới cắt được. "Đáy cần thời gian" giờ là
   cấu trúc, không phải một luật vá riêng.
5. Nền ĐANG NGANG (`runHuong = 0`): rút giữa nghỉ/biến động/mở lên/mở xuống.

### 2.3 Hazard gãy chuỗi — công thức đầy đủ

Với nền đang có hướng (nhịp 2 ở trên), `hz` (bp, xác suất gãy) cộng dồn từ:

```
hz = HAZARD_NEN_BP + tuổi_nền × HAZARD_TUOI_BP                 (nền LÊN)
hz = HAZARD_GIAM_NEN_BP + tuổi_nền × HAZARD_GIAM_TUOI_BP        (nền XUỐNG — v39, có "tuổi")
  × (HAZARD_NGUON_LI_BP nếu nguồn mở chuỗi "lì" | HAZARD_NGUON_TAN_BP nếu "mau tàn")
  + HAZARD_NGUOC_MT_BP    nếu môi trường tiền tệ NGƯỢC hướng nền
  + HAZARD_TELEGRAPH_BP   nếu ô thật liền trước báo trước hướng NGƯỢC
  × HAZARD_CANG_BP/10000  (chiết khấu, chỉ nền LÊN) × sức căng lớn nhất trong 6 mã (§7.3)
  × HAZARD_X_BP           (hồ sơ cỡ map — map 8 nhân ×1,7 theo D177)
  kẹp ≤ 9000  (90% — hazard 100% là ĐỊNH ĐOẠT, phạm luật "nghiêng không ép")
```

Bảng số **đang chạy** (`REGIME_TICK_THUC_TE`, mặc định vì `chuKyThucTe` đã bật từ v39/v40 —
§2.4) so với bộ số gốc `REGIME_TICK_GOC`:

| tham số | gốc (`REGIME_TICK_GOC`) | thực tế (`REGIME_TICK_THUC_TE`) |
|---|---:|---:|
| `HAZARD_NEN_BP` (nền lên) | 1800 | **2000** |
| `HAZARD_TUOI_BP` (nền lên già thêm 1 ô) | 1900 | **0** — bull không "già đi" |
| `HAZARD_GIAM_NEN_BP` / `_TUOI_BP` (nền xuống) | = nền lên | **2500 / 2000** — bear có tuổi |
| `HAZARD_CANG_BP` | 4000 | **1500** |
| `HAZARD_NGUON_TAN_BP` / `_LI_BP` | 19000 / 6000 | **12000 / 7500** |
| `HAZARD_NGUOC_MT_BP` | 1500 | **800** |
| `HAZARD_TELEGRAPH_BP` | 3000 | **1500** |
| `MAT_THUAN_BP` (nền sống → mặt thuận) | 6000 | **7000** |
| `GAY_DAO_HUONG_BP` (LÊN gãy → thẳng xuống) | 2200 | **3700** |
| `NGANG_MO_GIAM_X_BP` (nền ngang, cửa mở XUỐNG) | ×1 | **×0,54** — chợ có drift dương |

### 2.4 Chu kỳ thực tế (v39) — số có nguồn, không phải MC-TUNE

`REGIME_TICK_THUC_TE` khác mọi bảng số khác trong file: **mỗi con số đi kèm một dòng nguồn**
trong chính code, quy đổi từ dữ liệu ngoài đời chứ không phải dò Monte Carlo
(`docs/thiet-ke-de-xuat/gameplay/chu-ky-thuc-te-nguon-va-quy-doi.md` giữ toàn văn). Thang
thời gian: **1 ô = 6 tháng** — chọn vì 12 ô ≈ 74,5 tháng khớp đúng một chu kỳ trough-to-trough
trung bình của NBER 1945–2020. Vài mốc:

- Chuỗi tăng gãy: bull trung bình 988 ngày (Hartford Funds, S&P từ 1928) ≈ 5,4 ô ⇒ hazard nền
  ≈ 18,5%/ô.
- Chuỗi tăng KHÔNG có "duration dependence" (Diebold–Rudebusch 1990/1993) ⇒ `HAZARD_TUOI_BP = 0`.
- Chuỗi giảm CÓ (bear trung bình 289 ngày ≈ 1,6 ô) ⇒ hazard nạp theo tuổi.
- Bong bóng: Greenwood–Shleifer–You (JFE 2019) — 40 đợt một ngành tăng ≥100%/2 năm
  (1928–2014), 53% sập ≥40% trong 2 năm kế (quy đổi ra xác suất phồng tiếp/ô ở §2.9).
- Gãy chuỗi tăng thành GIẢM hẳn: 38/(38+14) ≈ 37% (Stacker/Plus500, S&P 1950–), phần còn lại
  về ngang/biến động.

Cờ `chuKyThucTe` **chỉ đổi SỐ, không đổi MÁY**: tắt thì `thamSoTick(false)` trả về đúng
`REGIME_TICK_GOC`, byte-hệt bảng cũ (`tests/chu_ky_thuc_te.test.ts` §II khoá hash 300 map ×
3 cỡ × 4 phiên bản).

### 2.5 Telegraph — báo trước, không định đoạt

Mỗi sự kiện có `bao_truoc: GiaiDoanId` — nếu là **tin THẬT**, ô kế được nghiêng (cộng
`NHA_CAI.SUC_MANH_TELEGRAPH_BP = 6000` vào trọng số mặt được báo, ở máy cũ; ở máy REGIME
TICK nó cộng vào `MAT_THUAN_BP`/`NGANG_MO_HUONG_BP` qua hệ số `NGANG_MO_TELEGRAPH_X_BP`).
Tin GIẢ thì **không** — telegraph của nó câm, và dư âm (echo) của nó bị ĐẢO DẤU khi lộ ra
ở ô kế (§5, Bước 2). Đây là cơ chế duy nhất người chơi có để phân biệt "tin sắp ứng nghiệm" khỏi
"tin bịa" — họ không bao giờ thấy cờ `la_tin_gia` trực tiếp, chỉ thấy hệ quả của nó.

### 2.6 Dây chuyền nhân quả sự kiện (`MT_SU_KIEN_KE_TIEP`) + vế ghìm (v38)

Sau một sự kiện THẬT (tin giả không kéo được dây chuyền — nếu không người chơi mất luôn
cách phân biệt thật/giả), lần rút sự kiện KẾ TIẾP được cộng trọng số theo bảng
`MT_SU_KIEN_KE_TIEP`. Hai chuỗi founder nêu đích danh:

```
chiến_tranh → lạm_phát (+4500) → tăng_lãi_suất (+5000)   (sốc cung → giá → thắt tiền)
hạ_lãi_suất → bong_bóng (+5000)                            (tiền rẻ → thổi giá)
```

`MT_KE_TIEP_MO_RONG` (v35, cổng `chuoiMoRong`) cộng thêm bốn cạnh: NHTW dập bong bóng
(`bong_bong → tang_lai_suat +2000`), đứt cung sau thảm hoạ (`+3000` vào `lam_phat`), chiến
tranh kéo cấm vận (`+1200`, cần cú ép `EP_CAM_VAN_BP` mới đủ mạnh — đo D158: cạnh một mình
chỉ nổ 0–2/1500 trận), lạm phát tự nuôi nó (`lam_phat → lam_phat +1500`, mô phỏng 1970s).

**Vế GHÌM (v38, D185, cổng `nhanQuaDoiXung`)** vá một lỗ hổng đo được 07/09: máy chỉ biết
"sập ⇒ NHTW nới tay" và "nóng ⇒ siết tiền" nhưng KHÔNG biết vế ngược — chợ đang TĂNG vẫn có
thể rút ra "hạ lãi suất" với trọng số nền, không một cớ nào. Đo được: ở ô 2 (khe tin dày
nhất, 56,1% số trận map 8 có tin ở đó), hạ-lãi-thật xảy ra 2,88% số trận, và **29,9% trong
số đó rơi đúng lúc ô 1 đang TĂNG** — cú hạ đó định hình cả trận: môi trường RẺ chiếm
92,5%/88,9%/90,9% số ô còn lại (map 8/12/16), so với 27,2%/35,4%/40,9% ở trận không có cú
hạ đó. `SU_KIEN_THEO_GIAI_DOAN_GHIM` cộng `+4000` (nhân) ghìm hai cạnh phi lý này:
`hạ_lãi_suất sau tang` và `tang_lai_suat sau giam`.

**T2 — Lướt Sóng bám dây chuyền:** thẻ này thưởng `+1500bp` khi tin nổ ĐÚNG hướng dây chuyền
từ tin gần nhất, phạt `−1000bp` khi bám nhầm (`LUOT_SONG_DAY_CHUYEN`).

### 2.7 Tin thật / tin giả — tỷ lệ hiệu dụng (v28)

Tỷ lệ một sự kiện là tin giả **KHÔNG phẳng**. Công thức đầy đủ
(`config/holdem.ts:tyLeTinGiaHieuDung`):

```
tỷ_lệ = kẹp[SAN=500, TRAN=8000](
          gốc(bối_cảnh) × nhân(loại_sự_kiện | bong_bóng: nhân(môi_trường_tiền))
          × nhân_dò(mặc_định 10000)   ÷ 10000²  , floor)
```

- **`gốc(bối_cảnh)`** — hai giá trị theo `boi_canh` CÔNG KHAI của chính ô (không phải cờ ẩn):
  `noi_chuoi` (khớp dây chuyền tin trước) hay `don_doc` (đứng một mình).
  - Bảng "thiết kế" (`TY_LE_TIN_GIA_THEO_BOI_CANH`, dùng khi `chuKyThucTe` tắt): nối chuỗi
    20% giả · đơn độc 50% giả.
  - Bảng "chu kỳ thực tế" (mặc định — `TY_LE_TIN_GIA_THUC_TE`): đơn độc **67%** giả, nguồn
    Ahern & Sosyura ("Rumor Has It", RFS 2015) — 501 tin đồn thâu tóm 2000–2011, chỉ 33% có
    bid thật trong 1 năm. Nối chuỗi giữ nguyên 20% (không có số riêng cho "tin nhất quán với
    chuỗi" trong nguồn — đánh dấu PLAYTEST-TUNE).
- **`nhân(loại_sự_kiện)`** (`MAP_V28.NHAN_TIN_GIA_SU_KIEN`): hack sàn ×1,6 (đồn sập sàn rẻ
  nhất để dựng) · thiên nga đen/chiến tranh ×1,2 · lạm phát ×0,6 · lãi suất ×0,4 (họp báo có
  thật thì khó đồn — mã KHÔNG có trong bảng ⇒ ×1, không đụng).
- Bong bóng đi theo **môi trường tiền tệ** riêng: rẻ ×0,5 · trung tính ×1,4 · đắt ×2,0
  ("không tiền rẻ ⇒ bong bóng phần lớn là hơi nước").
- **Tin giả lộ ⇒ mồi lửa:** nếu sự kiện gần nhất (bất kể thật/giả) là tin giả, trọng số rút
  `hack_san` ở ô kế nhân **×15** (`SAP_SAN_SAU_TIN_GIA_X_BP = 150000`) — tin đồn không còn
  vô hại, nó gần như đảm bảo châm ngòi Sập sàn thật ở lần sự kiện kế tiếp.

`tyLeTinGiaHieuDung` là **MỘT CỬA** cho ba nơi: `sinhMap` (rút thật), bot hoài nghi
(chiết khấu `1 − 2p`), và tự điển/Bảng điện tử (kể luật cho người chơi) — hai bản cài đặt
của cùng công thức này từng trôi khỏi nhau (D61), khiến gate G4 (đo "đọc tin có phải kỹ
năng") chấm nhầm một con bot không hoài nghi đúng mức.

### 2.8 Lịch chính sách + lãi suất nền

**Ô lịch** (`LICH_CHINH_SACH.O_THEO_MAP = {8:[4], 12:[4,9], 16:[4,8,12]}`) là kỳ họp NHTW,
đặt CỐ ĐỊNH ở vị trí map biết trước (công khai — "bách khoa", không phải bí mật). Hàm phản
ứng, CÔNG KHAI với người chơi:

```
≥ 1 ô lạm_phát/chiến_tranh THẬT trong 4 ô gần nhất  ⇒  kỳ vọng TĂNG
giai đoạn nền đang giảm/biến động, hoặc có sập THẬT trong cửa sổ  ⇒  kỳ vọng HẠ
(v35, cổng chuoiMoRong) bong bóng THẬT trong cửa sổ mà chưa có lý do hạ  ⇒  kỳ vọng TĂNG
còn lại  ⇒  GIỮ NGUYÊN (mặt thứ ba hợp lệ, hành xử như đi ngang)
```

Rồi **15%** cơ hội "sai lầm chính sách" (`TY_LE_SAI_LAM_BP`) đổi hướng THỰC sang một trong
hai hướng còn lại — không tín hiệu nào tin cậy 100%, kể cả luật công khai này.

**Lãi suất nền** (`LAI_SUAT_NEN`) là MỘT SỐ tích luỹ, công khai suốt trận, khởi điểm **400
điểm = 4,00%/năm**, kẹp `[0, 1200]`. Kỳ họp dịch **75 điểm**/lần theo hướng THỰC; lá lãi
suất NGOÀI lịch dịch **50 điểm**, chỉ khi THẬT (tin giả không dịch được mức — cho nó dịch
là phát không một máy dò tin giả). Ba môi trường suy từ mức: `≤350` = **rẻ**, `≥450` = **đắt**,
giữa = trung tính (`moiTruongTienTe`) — mốc đặt cách khởi điểm đúng MỘT bước kỳ họp, để luật
đọc được thành một câu: *"một lần hạ là tiền rẻ, một lần tăng là tiền đắt."*

Hai tác động ngược vào chính máy sinh map:

1. **Xác suất thẻ sự kiện** (`LAI_SUAT_NEN.NHAN_THAP_BP` / `NHAN_CAO_BP`): tiền rẻ nhân
   bong bóng ×2,2 và lạm phát ×1,6; tiền đắt nhân hack sàn/phá sản ×1,8 mỗi loại — đúng dây
   chuyền tín dụng: tiền rẻ thổi bong bóng và lạm phát, tiền đắt vỡ nợ.
2. **Thanh khoản** (`NAC_THAP = +1`, `NAC_CAO = −1` nấc) — cộng dồn với nhánh giai
   đoạn/sự kiện của `THANH_KHOAN_DONG`, kẹp cuối vào `[mỏng, vừa, dày]` (§7.4).

### 2.9 Bong bóng — ba đời

**v27 (đang sống, KHÔNG phải một thẻ sự kiện — một CHẾ ĐỘ):** sự kiện `bong_bong` thật mở
"chế độ phồng". Mỗi ô sau đó, xác suất `tang` được nghiêng mạnh
(`NGHIENG_TANG_BP = 18000`, mòn dần `−2500`/ô đã phồng — leo cao khó leo tiếp). Rút ra bất
cứ gì khác `tang` (hoặc chạm trần `DAI_TOI_DA`) ⇒ **GÃY**: ô đó thành `giam`, và một chuỗi
giảm dài theo độ cao đã leo được xếp tiếp (`VO_TOI_THIEU_O=2` + `VO_THEO_DAI_O × số_ô_đã_leo`,
trần `VO_TOI_DA_O=4`). "Thắng đậm thua đau" là công thức, không phải khẩu hiệu.

**v28 — có gốc:** đi theo môi trường tiền tệ ở TỪNG ô (không chốt lúc vào chế độ): rẻ giữ
nguyên độ nghiêng, trung tính ×0,6, đắt ×0,35 — "không tiền rẻ thì phần lớn là hơi nước".

**v39 — xác suất phồng đặt TƯỜNG MINH theo dữ liệu:** thay vì để trọng số cộng dồn tự quyết,
`BONG_BONG_PHONG_TIEP_BP` khoá thẳng P(phồng tiếp)/ô = 83% (rẻ) · 75% (trung tính) · 65%
(đắt) — số 83% suy từ GSY: 53% sập trong 2 năm (=4 ô) ⇒ `(1−0,53)^(1/4) ≈ 0,83`. Cửa sổ
tối đa cũng đổi: `DAI_TOI_DA = 4` (thay vì 5) đúng khung "2 năm" của GSY.

### 2.10 Sức căng (`SUC_CANG`) — bộ đo ẨN mỗi mã

Khác lãi suất nền (công khai), **sức căng là per-mã và ẨN** — "đọc bàn" là kỹ năng chỉ
đọc được gián tiếp qua dải công bố thô (êm/căng/rất căng, định nghĩa dưới đây). Nạp/xả TRONG `sinhMap`
(chỉ nhìn chuỗi ô, không nhìn hành vi người chơi — bộ bài vẫn cố định lúc tạo trận):

```
pha thuận hướng lên, m > 0:  nạp = NAP_BP(600) × HS_THANH_KHOAN[nấc]/10000
                              (×2 nếu đang trong 3 ô "nới lỏng" sau hạ lãi thật)
pha khác:                    xả XA_GIAM_BP(900)/ô nếu giảm, XA_BP(300)/ô nếu êm
sự kiện đánh THẬT vào mã:    giải phóng GIAI_PHONG_BP(6667‱) của S hiện có
bong bóng thật nổ:           nạp gấp đôi công thức nạp thường vào mã hưởng lợi
lan sang mã CÙNG NHÓM:       +LAN_BP(3000‱) phần nạp của mã kia
```

Kẹp `[0, TRAN_BP=6000]`. Ba dải công bố: `< 2000` êm · `< 4000` căng · `≥ 4000` rất căng
(`daiSucCang`, `nav.ts`). Tại `chotPhien`, sức căng ĐẦY ĐỦ = S-map (snapshot lúc lật ô) +
**crowding của bàn** (`sucCangLuc`, `server/holdem/engine.ts`):

```
S_đầy_đủ = min(TRAN_BP, S_map + CROWD_BP(3000) × (số_ghế_đang_nắm_mã / số_ghế_còn_sống))
```

S đầy đủ khuếch đại theo bất đối xứng: `apCang(delta, S) = delta + trunc(delta × S × hệ_số
/ 10⁸)`, `hệ_số = HS_TOT_BP(10000)` nếu lãi, `HS_XAU_BP(35000)` nếu lỗ — **ở S tối đa (6000),
lãi được nhân tối đa ×1,6, lỗ bị nhân tối đa ×3,1.** Đây là công thức "thắng đậm thua đau"
áp riêng cho từng mã — khác hẳn khẩu vị rủi ro (§9.6, áp cho cả vòng, cả hai chiều bằng
nhau).

### 2.11 Áp lực bàn (v37, D181)

Hai máy thay ô cũ (phản thân §7.1, bẻ-chuỗi-bằng-vốn §7.2) trước đây là CÔNG TẮC: qua
ngưỡng thì xác suất cố định, dưới ngưỡng thì im. Không có TRÍ NHỚ (dồn 5 vòng liền = dồn 2
vòng), không có ĐỘ LỚN (61% = 95%). `AP_LUC_BAN` vá cả hai:

```
mucVuot   = max(0, tỷ_lệ_ghế_dồn − ngưỡng, tỷ_lệ_vốn_dồn − ngưỡng)   (lấy MAX, không cộng)
ápLựcMới = min(TRAN_BP=10000, ápLựcCũ × MON_BP(6500)/10000 + mucVuot × NAP_X_BP(8000)/10000)
xácSuất   = min(XS_TRAN_BP=7000, xácSuấtGốc × SAN_X_BP(5000)/10000 + ápLựcMới × VAO_XS_BP(2600)/10000)
```

Nạp ở điểm nối vòng (`napApLuc`, gọi TRƯỚC hai máy thay ô), mòn dần mỗi vòng — bàn chớm
ngưỡng nổ ít hơn máy công tắc cũ, bàn dồn lì nhiều vòng nổ nhiều hơn. **Trần 70% là bất khả
thương lượng**: dù cả bàn dồn 100% vốn suốt trận, chợ vẫn còn ≥30% cửa đi ngược đám đông.

---

## 3. Tương quan tài sản — mô hình một nhân tố

### 3.1 Vì sao không phải ma trận 6×6 gõ tay

Một ma trận tương quan phải nửa xác định dương; 36 số điền bằng cảm giác gần như chắc chắn
vi phạm điều đó, và khi vi phạm thì **không tồn tại** bộ biến ngẫu nhiên nào có đúng các
tương quan ấy — sinh số theo nó ra một thứ khác, im lặng, không ai phát hiện bằng mắt. Nên
`config/holdem.ts:TUONG_QUAN` dùng **mô hình một nhân tố** (đúng "market model" của tài
chính thật): mỗi mã có một hệ số nhạy **β** với "cú sốc chung" của cả thị trường, phần còn
lại là nhiễu riêng.

### 3.2 Công thức nhiễu đầy đủ

`server/holdem/engine.ts:nhieuCua` (khi cờ `tuongQuan` bật — mặc định từ v9):

```
β        = betaCua(mã, nhóm, sự_kiện)                    kẹp [−9900, +9900]
k        = heSoRiengBp(β) = ⌊√(10000² − β²)⌋               ("phần nhiễu riêng còn lại")
z_chung  = symmetricNoise(rng chung cho CẢ BÀN, vòng này)   Uniform[−10000, +10000] nguyên
z_riêng  = symmetricNoise(rng riêng của (vòng, mã))          Uniform[−10000, +10000] nguyên
nhiễu    = trunc( (β·z_chung + k·z_riêng) × bien_dong_bp / 10⁸ )
```

`z_chung` dùng **một domain RNG duy nhất, không toạ độ mã** — cả bàn cùng một lần rút mỗi
vòng, vì nếu mỗi mã tự rút cú sốc "chung" của riêng nó thì nó không còn là chung. Vì sao
kẹp `±9900` chứ không `±10000`: `β = ±1` làm `k = 0` — mã đó mất hẳn phần nhiễu riêng, trở
thành **bản sao chính xác** của cú sốc chung, và "danh mục 4 mã" thành một lời nói dối trên
màn hình (hai mã cùng nhóm sẽ luôn đi cùng một hướng, cùng độ lớn).

**`√(1−β²)` giữ tổng biến động của mỗi mã KHÔNG ĐỔI** so với trước khi có tương quan (D39).
Nếu chỉ cộng thêm cú sốc chung mà không co phần riêng thì phương sai tổng phình lên, và mọi
chênh lệch đo được sau đó không tách được "tương quan làm khó hơn" khỏi "engine vừa ồn hơn
thôi". `bien_dong_bp` (biên nhiễu nền, `TaiSan.bien_dong_bp`) không đổi theo cờ tương quan.

Với cờ `tuongQuan` TẮT: `nhiễu = symmetricNoise(rng riêng, bien_dong_bp)` — bốn/sáu mã rút
độc lập hoàn toàn, trung bình hoá mất khoảng một nửa mọi cú sốc, và "mọi thứ sụp cùng lúc"
không thể xảy ra về mặt toán học (đây chính là lý do v9 ra đời).

### 3.3 Bảng β

**Vòng THƯỜNG (ô giai đoạn) — chỉ 2 số cho TOÀN BỘ thị trường** (`TUONG_QUAN.BETA_NEN`):

| nhóm | β nền |
|---|---:|
| rủi ro (`btc`, `cp_cn`, `vn30`) | +3000 |
| phòng thủ (`vang`, `usd`, `tpcp`) | −1500 |

**Theo sự kiện** (`TUONG_QUAN.BETA_SU_KIEN` — β theo NHÓM, một số `rieng` đè cho mã lệch
hẳn nhóm của nó):

| sự kiện | β rủi ro | β phòng thủ | `rieng` |
|---|---:|---:|---|
| Sập sàn (`hack_san`) | 8500 | 4000 | |
| Thiên nga đen | 8000 | 3000 | |
| Siết pháp lý | 5000 | 1000 | |
| Phá sản dây chuyền | 8500 | 4000 | |
| Cấm vận | 7000 | −4000 | |
| Thảm hoạ tự nhiên | 4000 | 1000 | |
| Khủng hoảng sinh học | 8000 | 2500 | `tpcp: −2000` |
| Chiến tranh | 7000 | −4000 | |
| Lạm phát nóng | 6000 | 2000 | `vang: −3000` |
| Tăng lãi suất | 6500 | 2500 | `vang: −2000` |
| Bong bóng | 7500 | −1000 | |
| Hạ lãi suất | 6000 | 1000 | |

Đọc bảng: **khủng hoảng thanh khoản** (sập sàn/thiên nga đen/phá sản) có β cả hai nhóm CÙNG
dương và cao — người ta bán cả vàng để lấy tiền mặt trả ký quỹ, đúng "phân tán không cứu
được" (tháng 3/2020 có thật). **Chiến tranh/cấm vận** có β phòng thủ ÂM đậm — vàng hộ giá
thật. **Lạm phát/tăng lãi suất** kéo trái phiếu rơi CÙNG cổ phiếu (chữ ký 2022) nhưng vàng
vẫn hộ (`rieng.vang` âm trong khi nhóm dương). **Bong bóng** có β rủi ro cao mà CÙNG chiều
lên — mọi thứ cùng bay, và chính cái cùng-bay đó là lý do cú sập sau quét sạch.

⚠ Toàn bộ bảng này đánh dấu `// MC-TUNE` — số khởi đầu, chưa chạy Monte Carlo xác nhận độ
lớn. Hai số cần theo dõi khi đo: **tỷ lệ cháy** (đang 30–50%, vượt ~60% thì phải hạ β) và
**thứ hạng của thẻ Chặn Lỗ** (đang thấp bất thường — tương quan phải kéo nó lên mà không sửa
một con số nào của chính lá đó).

### 3.4 v44 (ở cổng) — β riêng theo MÃ, không chỉ theo nhóm

`config/holdem.ts:BETA_V44` (cổng `betaTaiSanV2`, chưa mặc định — xa hơn cả v43) là lớp ĐÈ,
không phải bảng thay thế: `betaCua(mã, nhóm, sự_kiện, betaV2=true)` tra `BETA_V44` TRƯỚC,
rơi về `TUONG_QUAN` nếu không có đè. Đây là chỗ **mô hình được NỚI, không phải một số được
vặn** — `BETA_NEN` cũ chỉ có hai số theo nhóm nên "CTCK bám chỉ số chặt hơn VN30 ở vòng
thường" là điều không diễn đạt được:

- `NEN_RIENG.cp_cn = 5500` (thay 3000 của nhóm rủi ro) — CTCK là cược đòn bẩy vào **thanh
  khoản của cả thị trường**, không có đường đi riêng như một công ty công nghệ có sản phẩm
  riêng (nguồn: 2021 VN-Index +35,7%/nhóm CTCK ≈+190%, 2022 −32,8%/≈−63% — cùng chiều, biên
  độ nhân lên = β cao).
- `SU_KIEN_RIENG` hạ β của `usd` (USDT) ở đúng ba mặt tin mà nó KHÔNG hành xử như đô la:
  `hack_san` 4000→1500 · `phap_ly` 1000→500 · `pha_san` 4000→1000 — cú mất neo là chuyện
  RIÊNG của nó, không phải chuyện cả chợ đi xuống.
- `BIEN_DONG_RIENG.cp_cn = 380` (thay 280 nền) — biên nhiễu riêng của nhóm CTCK dôi ra,
  không phải β.

Cũng ở cổng này: `bienDongCua(ts, betaV2)` (`config/holdem.ts`) — chọn `bien_dong_bp` gốc
hay bản đè v44, dùng trong `nhieuCua`.

---

## 4. Ma trận TÀI SẢN × GIAI ĐOẠN / SỰ KIỆN — ba đời

### 4.1 Sáu tài sản

`config/holdem.ts:TAI_SAN` — id KHÔNG ĐỔI qua mọi lần đổi tên (D310: id nằm trong
`events`/`action_log` của mọi trận đã lưu, đổi id là hỏng dữ liệu; chỉ `label` đổi):

| id | nhãn hiện tại | nhóm | thanh khoản nền | biên nhiễu (`bien_dong_bp`) | dòng tiền | khống được |
|---|---|---|---|---:|---|:-:|
| `btc` | Crypto | rủi ro | mỏng | 400 | không | có |
| `cp_cn` | CP Chứng khoán | rủi ro | vừa | 280 (380 ở v44) | không | có |
| `vn30` | VN30 | rủi ro | dày | 170 | không | có |
| `vang` | Vàng | phòng thủ | vừa | 240 | không | có |
| `usd` | USDT | phòng thủ | dày | 150 | không | có |
| `tpcp` | Trái phiếu Mỹ | phòng thủ | vừa | 160 | **coupon** | có |

Trần theo nhóm tương quan (`TRAN_NHOM_BP`, D20): rủi ro ≤ 70% NAV, phòng thủ ≤ 55% —
không được dồn hết vào một rổ dù rổ đó có "an toàn" tới đâu. `tpcp` là mã DUY NHẤT trả dòng
tiền định kỳ (§9.9); từ v42 sổ khống `cp_cn` bị chặn MỞ (sàn VN không cho bán khống cổ phiếu
cơ sở), `vn30` vẫn khống được (có phái sinh).

### 4.2 Chọn bảng nào — `boMaTranCua`

```
tai_san_v42 = true  ⇒  v42   (mặc định)
lop_vn = true        ⇒  v41
mặc định              ⇒  v40  (toàn cầu)
```

**MỘT CỬA bắt buộc** (`config/holdem.ts:mtGiaiDoan`/`mtSuKien`) — engine đổi bảng theo cờ
trong khi bot từng đọc thẳng hằng số cũ (`can_troi` v21↔v23, D61): bot MUA theo bảng này rồi
bị CHẤM bằng bảng kia, và gate đo chênh lệch hai bảng chứ không đo kỹ năng. `bo` (kiểu
`'v40'|'v41'|'v42'`) — KHÔNG phải hai boolean cạnh nhau: hai boolean gọi sai thứ tự tham số
là trình biên dịch im (D311 ghi lại bài học này).

### 4.3 v40 — bảng toàn cầu (tiên nghiệm gốc)

Đơn vị bp lợi suất NỀN mỗi vòng, kẹp `|giai đoạn| ≤ 1200`, `|sự kiện| ≤ 2400`. Đây là bảng
mọi bảng khác GỘP LÊN TRÊN (§4.4/4.5), không phải bảng bị thay thế hoàn toàn.

**Tài sản × Giai đoạn** (`MT_TAI_SAN_GIAI_DOAN`):

| mã | tăng | giảm | đi ngang | biến động | phục hồi |
|---|---:|---:|---:|---:|---:|
| btc | 1200 | −1200 | 0 | 600 | 1200 |
| cp_cn | 1200 | −600 | 0 | −600 | 600 |
| vn30 | 600 | −600 | 600 | 0 | 600 |
| vang | −600 | 600 | −600 | 1200 | −600 |
| usd | −600 | 600 | −600 | 600 | −600 |
| tpcp | 0 | 600 | −300 | 0 | 0 |

**Tài sản × Sự kiện** (`MT_TAI_SAN_SU_KIEN`, echo ngay vòng sự kiện nổ):

| mã | hạ lãi | tăng lãi | sập sàn | thiên nga đen | lạm phát | chiến tranh | bong bóng | pháp lý | phá sản | cấm vận | thảm hoạ | dịch bệnh |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| btc | 2400 | −1800 | −2400 | −1800 | 1200 | −1200 | 2400 | −1800 | −1800 | −1200 | −300 | −2100 |
| cp_cn | 2400 | −1800 | 0 | −1800 | 600 | −1800 | 2400 | −600 | −1500 | −1200 | −600 | −2100 |
| vn30 | 1800 | −1200 | 0 | −1800 | 600 | −1800 | 1800 | −300 | −1500 | −900 | −1500 | −1800 |
| vang | 600 | −1200 | 1800 | 1800 | 1200 | 2400 | −1200 | 900 | −900 | 2400 | 900 | 2400 |
| usd | −1200 | 1800 | 1200 | 1800 | 600 | 1800 | −600 | 900 | 2400 | 1800 | 600 | 1800 |
| tpcp | 1800 | −1800 | 600 | 1200 | −1800 | 1200 | −1200 | 600 | 1200 | −600 | 300 | 3000 |

### 4.4 v41 — lớp VN (gộp có công thức, ở cổng)

`docs/thiet-ke-de-xuat/gameplay/lop-vn-nguon-va-gop.md` (D307). Vẫn ở cổng `lopVn`, **nhưng
bị v42 kéo theo bật** vì v42 xếp chồng lên nó (§1). Công thức gộp — **partial pooling kiểu
James–Stein/empirical Bayes**, mỗi ô đều truy được về nguồn:

```
ô_mới = làm_tròn_300( kẹp( g + w × (K·r_VN − g) ) )
  g      = ô đang chạy ở v40 (tiên nghiệm — đã qua gate 12.000×3)
  r_VN   = lợi suất THẬT 6 tháng của mã đó ở trạng thái đó, đo từ dữ liệu VN
  w      = n/(n+k),  k = 4  (= số đợt bear trọn vẹn VN có sổ: 2008·2011·2018·2022)
  K      = 0,55  (hằng NÉN THANG CHƠI — không phải từ dữ liệu; chọn để bear sâu nhất
           VN, −16,3%/ô, rơi đúng dải "rất xấu" −900)
  kẹp    = trần biên độ v40 giữ nguyên
```

`w = n/(n+4)` làm đúng một việc: mẫu VN dày (12 năm pha tăng ⇒ w=0,75) thì kéo mạnh; mẫu
mỏng (1 đợt dịch bệnh ⇒ w=0,20) gần như không nhúc nhích; **không có mẫu VN** (BTC, chiến
tranh, cấm vận, thảm hoạ) ⇒ w=0, ô giữ NGUYÊN v40. **32/102 ô đổi** (16 giai đoạn + 16 sự
kiện, đếm bằng máy — `tests/lop_vn.test.ts`).

**Tài sản × Giai đoạn — bộ VN đầy đủ** (`MT_TAI_SAN_GIAI_DOAN_VN`; số có mũi tên là ô đã
đổi so v40, số đứng một mình là ô `w` quá nhỏ nên đứng yên):

| mã | tăng | giảm | đi ngang | biến động | phục hồi |
|---|---:|---:|---:|---:|---:|
| btc | 1200 | −1200 | 0 | 600 | 1200 |
| cp_cn | 1200→**900** | −600→**−900** | 0 | −600→**−300** | 600→**900** |
| vn30 | 600 | −600→**−900** | 600→**300** | 0 | 600 |
| vang | −600→**−300** ⛔ | 600→**300** | −600→**−300** | 1200 | −600→**−300** |
| usd | −600→**−300** ⛔ | 600→**300** | −600→**−300** | 600 | −600→**−300** |
| tpcp | 0 | 600→**300** | −300→**0** | 0 | 0 |

⛔ = lever D20 chặn (§ đoạn trên) — công thức thô ra dương ở hai ô này, lever ép về −300.

Ba phát hiện đổi dấu so bộ toàn cầu, đúng lý do "đổi tên để tránh hiểu lầm" mà founder nêu:

| bộ toàn cầu (logic Mỹ) | Việt Nam thật (dữ liệu) |
|---|---|
| Bear ⇒ trái phiếu chính phủ LÊN (trú ẩn) | Cả 3 đợt bear VN (2008·2011·2022) đi kèm SIẾT LÃI ⇒ giá TPCP rơi CÙNG cổ phiếu |
| Tăng lãi ⇒ vàng XUỐNG (lợi suất thực lên) | Cả 3 đợt NHNN tăng lãi đều là siết ĐỂ CHỮA LẠM PHÁT ⇒ vàng SJC TĂNG cả 3 lần |
| Lạm phát ⇒ cổ phiếu được lợi (danh nghĩa) | CPI 23% (2008) và 18,6% (2011) ⇒ VN-Index −49,8% và −27,5% |

**Lever D20 đè lên kết quả** (không phải dữ liệu): mã trú ẩn không được DƯƠNG ở `tang`/
`phuc_hoi` — nếu không thì "phòng thủ phải có giá" (D20, cùng nguyên tắc với phí giữ tiền
mặt ở §9.2) bị dữ liệu đơn thuần lật ngược
(vàng SJC gần như không tương quan cổ phiếu VN nên giữ vàng suốt một mùa tăng gần như không
tốn gì, và Phòng thủ chạy trốn — đã đo 47% thắng khi chưa có lever). Hai ô bị chặn:
`vang`/`usd` ở `tang` bị ép xuống −300 dù công thức thô ra dương.

⚠ Founder đã CHỐT giữ nguyên bộ số VN dù nó làm map 8 đổ gate G1 (Tất tay 34,9% cách á quân
10,3 điểm) — thay vì "sửa" dữ liệu cho xanh, luật G1 được nới RIÊNG cho bàn ngắn (đo hạng
trung bình thay vì chỉ tỷ lệ thắng, vì phương sai ở ván ngắn thổi phồng tỷ lệ thắng của
chiến lược liều) — đây là ví dụ chọn TRUNG THỰC hơn XANH GATE, cùng tinh thần với mục 5 ở §11.

### 4.5 v42 — bộ tài sản v2 (mặc định)

`docs/thiet-ke-de-xuat/gameplay/tai-san-v42-nguon-va-quy-doi.md` (D311). D310 đổi TÊN bốn
lá; ba lá có VẬT đằng sau cái tên cũng đổi nên số phải đổi theo — `btc`/`vn30`/`vang` chép
nguyên v41.

**`tpcp` (nay là Trái phiếu Mỹ) — QUAY VỀ v40, không giữ v41.** Lý do: v41 kéo bốn ô của nó
bằng dữ liệu trái phiếu CHÍNH PHỦ VIỆT NAM; lá này giờ là trái phiếu Mỹ nên mọi mẫu VN có
w=0 theo đúng luật gộp — giữ hàng v41 là gán hành vi trái phiếu VN cho trái phiếu Mỹ. Bản
nháp đầu của agent giữ nhầm một ô (`ha_lai_suat`) và tự bịa sáu ô khác không nguồn; bài test
`tai_san_v42.test.ts` §I bắt được, đã sửa thành bản sao đúng nguyên của v40.

**Giá trái phiếu Mỹ nay là GIÁ-THUẦN** — carry (trước gói trong ma trận vì không mã nào trả
dòng tiền) tách ra thành coupon tường minh (§9.9); giữ cả hai là trả lãi hai lần.

Bảng nguồn `tpcp` (US Treasury, quy đổi 6 tháng × K=0,55 × 100):

| pha | quan sát | r (6 tháng) | v42 | ghi chú |
|---|---|---:|---:|---|
| giảm | TB 4 đợt suy thoái có sổ (2002·2008·2011·2020) | +8,75% | **+600** | trùng v40 |
| biến động | duration ≈7,5 × Δlợi suất −60bp | +4,5% | **+300** | trú ẩn khi nhiễu |
| phục hồi | lợi suất bò lên khi tăng trưởng về | −3,0% | **−300** | + coupon 200 = −100 ✔ lever |
| tăng | risk-on, lợi suất nhích | −2,25%→0 | **−300** | ⛔ lever D20 ép (0+coupon>0 là phạm) |
| đi ngang | — | ≈0 | **0** | |

⚠ 2022 là bear **lạm phát** (trái phiếu Mỹ CŨNG sập, lợi suất 10 năm +237bp) — trong game đó
nằm ở cột `lam_phat` (−1800, giữ nguyên v40), KHÔNG ở cột `giam`. Đọc gộp hai cột là hiểu sai
2022.

**USDT — hàng giai đoạn giữ nguyên v41** (vẫn là tỷ giá USD/VND neo); rủi ro riêng là RỜI RẠC
nên chỉ chạm hàng sự kiện, ba ô ĐỔI DẤU so USD:

| sự kiện | v41 (USD) | v42 (USDT) | vì sao |
|---|---:|---:|---|
| Sập sàn | +1200 | **−900** | sàn là nơi token sống; đô la trong ngân hàng thì không |
| Siết pháp lý | +900 | **−600** | đô la LÀ luật; stablecoin là thứ BỊ luật siết (NYAG 2021, MiCA 2024) |
| Phá sản dây chuyền | +2400 | **−300** | 03/2023: rời neo vì NGÂN HÀNG GIỮ DỰ TRỮ sập (SVB) — nhẹ vì USDT lại LÊN GIÁ đúng đợt đó (tiền chạy từ USDC sang); ghi "neo rung", không ghi "neo đứt" |

Cỡ mẫu nhỏ, khai thẳng: `n=3` (Luna 05/2022, FTX 11/2022, SVB 03/2023) ⇒ `w=3/7≈0,43`.

**CP Chứng khoán** — đòn bẩy trên THANH KHOẢN, không trên chỉ số (bội không ổn định: 2021
VN-Index +35,7%/nhóm CTCK ≈+190% [5,3×]; 2022 −32,8%/≈−63% [1,9×]; 2024 +12,1%/≈+10%
[0,8×]) — `n=4` ⇒ `w=0,50`. Ăn đòn NẶNG hơn VN30 ở đúng ba chỗ có bối cảnh cụ thể: siết pháp
lý (UBCKNN 2022 đánh thẳng vào nhóm), sập sàn (mất cả phí môi giới lẫn tài sản trên sàn),
lạm phát (siết margin). Bù lại bay xa nhất bàn khi hạ lãi/bong bóng.

**CP Chứng khoán × Giai đoạn** (v41→v42 — mã đổi mạnh nhất của cả đợt v42):

| pha | v41 | `r` (6 tháng) | v42 | ghi chú |
|---|---:|---:|---:|---|
| tăng | 900 | +70% (2021) | **1200** | ⌊r×55⌋=3850 → kẹp trần 1200 |
| giảm | −900 | −39% (2022) | **−1200** | −2145 → kẹp trần −1200 |
| đi ngang | 0 | +5% (2024) | **0** | giữ v41 — một năm không lật được tiên nghiệm |
| biến động | −300 | *(không có mẫu riêng)* | **−600** | ⚠ CHƯA CÓ NGUỒN — lập luận (biến động cao ⇒ margin call ⇒ thanh khoản co) đứng được nhưng chưa đo; 2018 gợi ý đau hơn (−900), 2021 gợi ý ngược lại (thanh khoản bùng) |
| phục hồi | 900 | +26% (2023) | **1200** | 1430 → kẹp trần 1200 |

**CP Chứng khoán × Sự kiện** (v41→v42):

| sự kiện | v41 | v42 | vì sao |
|---|---:|---:|---|
| Hạ lãi suất | 2100 | **2400** | tiền rẻ ⇒ margin nở ⇒ phí môi giới nở; nhóm bay xa nhất bàn |
| Tăng lãi suất | −2100 | **−2400** | đối xứng, và 2022 là bằng chứng |
| Sập sàn | 0 | **−900** | mất cả phí môi giới lẫn tài sản trên sàn |
| Thiên nga đen | −1800 | **−2100** | beta cao thì đuôi cũng dày hơn |
| Lạm phát nóng | 0 | **−600** | siết margin |
| Siết pháp lý | −600 | **−1500** | UBCKNN 2022 đánh THẲNG vào nhóm này, không phải vào cả chợ |
| Phá sản dây chuyền | −1500 | **−1800** | khủng hoảng trái phiếu doanh nghiệp 2022 |

**Đếm tổng: 22/102 ô đổi so v41** (`cp_cn` 4+7 · `usd` 0+3 · `tpcp` 4+4; ba mã còn lại 0 —
đếm bằng máy, `tests/tai_san_v42.test.ts` §I, hai lần gõ tay của chính agent đều sai trước
đó).

**Gate 12/12 ba cỡ map** — và một hệ quả đáng chú ý: bàn 8 (map ngắn) qua G1 **mà không cần
vé nới của v41** (khoảng cách 4,1 điểm so ngưỡng 8, so với 10,3 ở v41). Lý do: v41 làm mọi
trú ẩn che kém hẳn nên ván ngắn thưởng phương sai; v42 trả trái phiếu Mỹ về chỗ che được
(+600/+300 ở giảm/biến động thay vì +300/0) VÀ trả coupon đều mỗi ô, nên "tất tay" thôi là
nước đi trội ở bàn ngắn.

---

## 5. Dây chuyền chấm điểm một vòng (`dungChuoi`)

`server/holdem/engine.ts:dungChuoi(st, ghế, ô)` dựng `chain: MatXich[]` — **thứ tự mảng =
thứ tự diễn hoạt hình VÌ SAO trên UI**, và cũng là thứ tự cộng dồn thật. Chạy MỘT LẦN cho
MỖI ghế còn sống, mỗi vòng. Tên gọi "chuỗi chấm điểm" mượn khuôn Balatro (chips × mult):
cộng dồn từng nguồn → nhân ở cuối.

### Bước 1 — Tài sản × giai đoạn (+ nhiễu) × hệ số stack

Với MỖI mã khác nhau đang cầm (không lặp theo bản sao — bản sao chỉ nhân qua hệ số stack):

```
nền   = MT_TAI_SAN_GIAI_ĐOẠN[mã][giai_đoạn]        (bảng đúng theo boMaTranCua — §4.2)
      + GIA_CUA_THANH_KHOAN_BP[nấc thanh khoản]      (§7.4 — sổ mỏng được bù, sổ dày trả phí)
      + bangCanTroi(...)[mã]                          (§11 — hiệu chỉnh cân trôi kỳ vọng)
nhiễu = nhieuCua(...)                                 (§3.2 — một nhân tố)
trước_căng = applyBpInt(nền + nhiễu, heSoStackBp(số_bản_sao))   [1,1.6,2.0]×
delta = apCang( apChuKyBienDo(trước_căng) , sức_căng_đầy_đủ_của_mã )
```

`apChuKyBienDo` (chỉ khi cờ `chuKy` bật) nhân biên độ chu kỳ map (`0,75×/1,0×/1,3×` theo
`chu_ky.amp`, rồi thêm `×1,3` cho vế XẤU nếu chu kỳ "gắt" — `chu_ky.asym`); `apCang` khuếch
đại theo sức căng (§2.10). **Ví dụ số cực đoan** (biên độ lớn + chu kỳ gắt + sức căng tối
đa): một khoản lỗ gốc bị nhân tới `1,3 × 1,3 × 3,1 ≈ 5,24×` trước khi tới các bước sau — ba
lớp khuếch đại độc lập cộng dồn.

### Bước 2 — Echo sự kiện (dư âm)

`machEcho(nguồn_lực, mã_đang_cầm, danh_mục, ...)` — nguồn lực gồm:

- Sự kiện ĐANG NỔ ở ô này (`do_lon_bp = 10000`, đã nhân hệ số nền §7.6 nếu `giaChongNen` bật).
- **Dư âm** của mọi sự kiện đã lật trong `SO_VONG_ECHO = 3` vòng gần nhất
  (`echoDangCo`/`echoCua`): độ lớn suy giảm `SUY_GIAM_ECHO_BP = 5000` (50%) MỖI vòng đã qua —
  vòng vừa nổ trước đó = 100%, vòng trước nữa = 50%, trước nữa = 25%, quá 3 vòng thì biến
  mất. Tin GIẢ thì dư âm **ĐẢO DẤU** khi lộ ra (`dao: true`) — kẻ vào lệnh theo tin đồn bị
  whipsaw đúng lúc nó lộ là bịa.
- (Trận ≤ v17, cờ `boNhanhHeQua` tắt) nhánh hệ quả F1/F2 (`nhanhHeQua`, `TRUYEN_NHAN_QUA`) —
  cơ chế này đã CHẾT ở GIÁ từ v18 (founder bắt lỗi trên prod: một lá "sắp lật tiếp theo" đang
  bị trừ tiền như đã lật thật), chỉ còn sống trong `sinhMap` như một cách nghiêng xác suất ô
  kế — ai đọc được dây chuyền (§2.6) thì đoán trước, nhưng tiền không còn chạy trước sự kiện.

Mỗi lực × hệ số stack của mã (nắm 3 lá BTC thì tin về BTC đánh mạnh hơn) → `apCang` (§2.10)
→ `apChuKyBienDo`. **Cộng hưởng trú ẩn** (v35, `coCongHuongTruAn`): nếu chiến tranh + cấm
vận cùng nằm trong cửa sổ lực (ô đang lật + dư âm còn sống, cửa sổ riêng `5` vòng — KHÔNG ăn
ké tuổi echo) thì dòng VÀNG của CẢ HAI nguồn được nhân `CONG_HUONG_VANG_BP = 15000` (×1,5).

### Bước 3 — Trượt giá do đông (crowding) + Lõi vốn A (hàng chờ khớp lệnh)

Đây là **chi phí hệ thống chính** của trận (D40) — khác hẳn trượt giá lúc ĐẶT LỆNH (§9.1),
đây là phạt SAU khi biết ai đang ôm gì:

```
phạt = ⌊ K(45) × DONG_QUY_CHIEU(4) × tỷ_lệ_lobby_đang_nắm / độ_sâu_sổ_hiệu_dụng ⌋
```

`tỷ_lệ_lobby = floor(10000 × (số_người_nắm−1) / (số_người_sống−1))` — **chuẩn hoá theo tỷ lệ,
không theo đầu người** (D3): bàn 4 và bàn 8 ghế cùng một hành vi "cả bàn dồn vào một mã" chịu
đúng một mức phạt, không phải bàn to bị phạt gấp đôi. `độ_sâu_sổ_hiệu_dụng` tra theo nấc
thanh khoản ĐỘNG của ô (§7.4): mỏng=2500, vừa=6000, dày=14000. Thẻ Chia Lệnh giảm còn 50%
CHÍNH lệnh của người cầm nó (`GIAM_TRUOT_GIA_BP.chia_lenh`); vai (cá mập/đội lái ×2, cá
nhân ×0,5) nhân thêm (§7.7). Người đang khoá mã đó (§7.5) được hoàn 50% khoản này; người cầm
Khớp Nhanh được hoàn 0/0/0/30/50/70% theo số người tương đương cùng nắm (`KHOP_NHANH_HOAN_BP`).

**Lõi vốn A — hàng chờ khớp lệnh** (chỉ khi `luatVon` bật, tách biệt với crowding): đo
DÒNG TIỀN MỚI vào một mã TRONG ĐÚNG vòng này (người đảo sang + người mua thẳng), cùng công
thức K nhưng hệ số `HE_SO_XEP_HANG_K = 25` (nhẹ hơn K=45 của crowding — đứng xếp hàng một
vòng nhẹ hơn ôm hàng bị kẹt nhiều vòng), chỉ tính khi ≥2 người cùng vào một mã trong vòng.
Người khoá mã đó đứng ĐẦU hàng, miễn phí này. Phí chuyển đổi cố định của một lần Đảo danh
mục (bán A/mua B): 100 chip phẳng.

### Bước 4 — Xung đột / cộng hưởng thẻ chiến thuật

Xem §8.

### Bước 5 — Nhân: thẻ Đòn Bẩy 2×

Thẻ `don_bay` nhân TOÀN BỘ PnL đã cộng dồn tới đây ×2, HOẶC — nếu cầm cấp ≥2 và đã GHIM một
mã cụ thể (`gan.don_bay`) — chỉ cộng thêm đúng phần đóng góp của (các) mã đã ghim, tính bằng
cách cộng lại mọi mắt xích mang `id` của (các) mã đó (`tai_san`/`echo`/`crowding`/
`hoan_truot`). Cấp 2 (chỉ vai cá mập, cổng `vaiCoRang`) nhắm được HAI mã cùng lúc.

### Bước 6 — Khẩu vị rủi ro (mắt xích cuối cùng)

Xem §9.6 — nhân TOÀN BỘ kết quả vòng theo hệ số đã chọn TRƯỚC trận, cả hai chiều bằng nhau.

---

## 6. `apDinhGia` và thứ tự đầy đủ trong `chotPhien`

### 6.1 `apDinhGia` (`server/holdem/nav.ts`) — nơi giá cắn vào vị thế

Hai tầng, đúng thứ tự dây chuyền §5:

```
tầng 1 (riêng từng mã):  sau₁ = max(0, ⌊ trước × (10000 + r_riêng[mã]) / 10000 ⌋ )
tầng 2 (cả danh mục):    sau  = max(0, ⌊ sau₁ × (10000 + r_danh_mục) / 10000 ⌋ )
```

`r_riêng[mã]` = tổng mọi mắt xích §5 CÓ mã (tài sản/echo/crowding/hàng chờ/khoá/be_kèo);
`r_danh_mục` = phần còn lại (thẻ chiến thuật không gắn mã, khẩu vị, sự kiện×chiến thuật) —
áp lên TỔNG sau tầng 1. Sổ KHỐNG định giá NGƯỢC DẤU ở tầng 1 (mã rơi ⇒ ký quỹ nở). Vị thế
kẹp ≥0; về 0 thì XOÁ Ô (không giữ ô rác). `tien_theo_ma` (delta CHIP, không phải bp) trả ra
để UI khớp đúng NAV — không đối soát lại lần hai.

### 6.2 Toàn bộ trình tự MỘT VÒNG trong `chotPhien` (`server/holdem/engine.ts`)

```
 1. Trừ phần góp nền (CAM_KET_NEN=500) khỏi vốn mỗi ghế còn cược
    — trận NAV: tiền mặt trước, thiếu thì trừ PRO-RATA vào vị thế (không trượt giá — đây
      là phí, không phải lệnh bán)
 2. Chia pot (đa pot nếu có người all-in ít hơn — di tích poker, xem §11), phí giao dịch
    của vòng (trượt giá lúc đặt lệnh, §9.1) đổ vào pot cuối
 3. Chụp NAV TRƯỚC (mốc đo tăng trưởng)
 4. Phí ĐỨNG NGOÀI (ghế dung_ngoai): NEN_BP=150‱/vòng, +400‱ nếu ô là lạm phát
    VÀ cờ tienMatSuKien TẮT (bật thì khoản này chuyển sang bước 9 — không thu hai lần)
 5. Phí CẮT LỖ (ghế vừa bỏ vòng): 150‱ (lạm phát vòng) + 350‱ (rút khẩn) — ×2 nếu
    GIẪM ĐẠP (≥2 người VÀ ≥30% lobby cùng bỏ); Khớp Nhanh giảm vế rút khẩn
 6. Đánh dấu BẺ KÈO (ai vừa phá cam kết Khoá tài sản — §7.5) TRƯỚC khi chấm điểm
 7. Dựng bảng lợi suất CÔNG KHAI của vòng (ghế ảo cầm đủ 6 mã, cấp 1, không thẻ) —
    dùng cho Brier + trung vị "chợ đổi bao nhiêu"
 8. MỖI GHẾ: dungChuoi (§5) → apDonBayCamKet (§9.4 công thức, §11 mục 8 vì sao LUÔN tắt) → trừ phí tài trợ
    đòn bẩy nếu có → apDinhGia (§6.1) → COUPON vào tiền mặt (§9.9, NGAY SAU định giá:
    lãi trả trên giá đã chạy của vòng) → Brier
 9. (nav) Lạm phát tiền mặt (150‱/vòng) → phí giữ khống → SỐC TIỀN MẶT do sự kiện
    (§9.2, SAU phí giữ khống — bào trên số dư cuối; áp cho MỌI ghế
    còn trong trận, kể cả ghế đứng ngoài — đứng ngoài không né được lạm phát)
10. (ngân hàng, ở cổng) cộng lãi tiết kiệm treo + tất toán hợp đồng tới hạn — TRƯỚC bước
    11 để lãi vừa cộng không bị chính vòng đó ăn lạm phát ngay
11. GHI ĐÈ pnl_bp = % TĂNG TRƯỞNG NAV thật (không còn là tổng chuỗi §5 nữa — chuỗi chỉ
    còn vai trò GIẢI THÍCH)
12. Chia pot theo HẠNG pnl_bp mới — phá hoà bằng băm (seed,vòng,ghế), KHÔNG bằng so
    chuỗi id (bug lịch sử: ghế 'ban' luôn thắng hoà vì 'ban' < 'bot_1')
13. GỌI KÝ QUỸ: ai cầm Đòn Bẩy mà lỗ vượt ngưỡng bị trừ THẲNG Vốn (§9.5)
14. SIẾT PHÁP LÝ: đội lái phơi nhiễm quá ngưỡng khi ô là "Siết pháp lý" (§7.7)
15. CHÁY tài khoản (NAV ≤ 10% vốn khởi điểm CỦA GHẾ) — van casual giữ sàn 500 chip
    tới hết vòng 4
16. Khoá tư thế ALL-IN nếu vừa dồn hết (chỉ sau khi đã chốt ≥3 thẻ chiến thuật)
17. Nối vòng: ghi dong_truoc + tai_san_truoc (ảnh chụp cho vòng sau) → napApLuc
    (§2.11) → apPhanThan (§7.1) → apBeChuoiVon (§7.2)
```

Mọi khoản "trừ thẳng Vốn" (bước 13/14, và ký quỹ khống/siết) đi qua MỘT hàm chung
(`truVonTuNav`, tiền mặt trước, thiếu thì pro-rata vào vị thế) từ v34 (`kyQuyTuNav`) — trước
đó chỉ trừ tiền mặt, nên ai all-in 100% (0 tiền mặt) KHÔNG BAO GIỜ bị phạt, ngược hẳn ý định
"đòn bẩy phải có rủi ro thật".

---

## 7. LÕI ↔ LÕI — các cơ chế nói chuyện với nhau

### 7.1 Phản thân (D4) ↔ đám đông

Kích hoạt khi ≥60% lobby (`PHAN_THAN.NGUONG_LOBBY_BP`) cùng nắm một NHÓM tài sản **2 vòng
LIÊN TIẾP** (`huongDonCuaLobby` — so cả `dong_truoc` của vòng trước lẫn `demTheoMa` của vòng
này). Xác suất kích hoạt = `xsCongApLuc(TANG_BP=3500)` — đã cộng thêm áp lực bàn (§2.11).
Khi đủ điều kiện: ô SẮP LẬT bị **THAY** bằng ô khác CÙNG LOẠI (sự kiện↔sự kiện, giai
đoạn↔giai đoạn — không đổi tổng số ô/loại đã công bố):

- Dồn vào nhóm rủi ro (risk-on) ⇒ ô đổi sang `tang_lai_suat`/`thien_nga_den`/`hack_san`
  (sự kiện) hoặc `giam` (giai đoạn) — bong bóng ĐÁM ĐÔNG THỔI vỡ vào mặt chính họ.
- Trốn vào nhóm phòng thủ ⇒ đổi sang `ha_lai_suat`/`phuc_hoi` — phạt bằng CHI PHÍ CƠ HỘI
  (cả bàn núp vàng/USD thì thị trường rướn lên mà không có họ).

**KHÔNG thay ô đang bị telegraph** (lời hứa "nghiêng về X" đã công bố) và **KHÔNG thay ô
kỳ họp** (`lich_khong_doi`, v40 — lịch là công khai, đám đông không huỷ được cuộc họp NHTW).

### 7.2 Bẻ chuỗi bằng vốn (v35) ↔ phản thân

Cơ chế RIÊNG, đếm VỐN (giá trị vị thế/tổng NAV bàn) chứ không đếm GHẾ như phản thân — hai
máy có thể một cái nổ một cái im trên cùng một bàn. Điều kiện: chuỗi PHA đang chạy ≥2 ô
CÙNG lúc môi trường tiền tệ NGƯỢC chiều chuỗi (chuỗi giảm + tiền đắt, hoặc chuỗi tăng +
tiền rẻ — "phi lý = CẢ HAI vế", một vế không đủ vì đi ngược chuỗi khi môi trường ủng hộ là
đầu cơ có cơ sở). Phe NGƯỢC chuỗi phải giữ ≥60% NAV bàn. Xác suất nền 25%, +10% nếu có cá
mập tập trung ≥60% NAV riêng nó vào phe đó. **Nhường phản thân nếu cả hai cùng đủ điều kiện
trong một vòng** — hai máy cùng đẩy về phía đám đông thì thay hai lần là đếm một lực hai
lần. Cũng bị chặn bởi ô kỳ họp và ô đang telegraph, giống §7.1.

### 7.3 Sức căng ↔ pha (hazard)

Sức căng lớn nhất trong 6 mã cộng thẳng vào hazard gãy của nền LÊN trong máy Regime Tick
(§2.3, hệ số `HAZARD_CANG_BP`) — mã nào bị đám đông bơm căng nhất kéo cả NỀN dễ gãy hơn, dù
sức căng vốn là chỉ số PER-MÃ. Đây là cầu nối duy nhất giữa lớp "đọc bàn ẩn" (sức căng) và
lớp "đọc chu kỳ công khai" (giai đoạn nền).

### 7.4 Lãi suất nền ↔ thanh khoản ↔ xác suất thẻ

Một biến (`lai_suat_diem`) tác động BA nơi cùng lúc: (a) nghiêng xác suất RÚT sự kiện ở
`sinhMap` (§2.8); (b) dịch NẤC thanh khoản hiệu dụng của MỌI mã ±1 (`nacHieuDung`, cộng dồn
với nhánh giai đoạn/sự kiện của `THANH_KHOAN_DONG`, kẹp cuối vào 3 nấc); (c) qua đó dịch cả
ĐỘ SÂU SỔ dùng trong công thức trượt giá crowding (§5 bước 3) — môi trường thắt chặt làm
"cả bàn dồn một mã" đắt hơn hẳn, đúng lúc đám đông hay dồn nhất.

### 7.5 Khoá tài sản (Lõi vốn B) — TẮT hẳn ở v43

`KHOA_TAI_SAN` (2 vòng liên tiếp, giảm 50% trượt giá crowding của mã khoá + 150‱/vòng
thưởng "sống sót qua bão" nếu mã đó đi qua pha giảm/biến động mà vẫn còn trong danh mục,
phạt 600 + THU HỒI TOÀN BỘ thưởng đã nhận nếu bẻ kèo giữa chừng) là cơ chế "cam kết trước,
ăn ưu đãi" đối trọng với Lõi vốn A (đảo danh mục tự do). Từ v43 (ở cổng, `khoaTaiSanTat`),
`apKhoaTaiSan` từ chối MỌI lệnh khoá mới bằng lỗi `co_che_tat` — **kiểm ĐẦU TIÊN, trước cả
cờ `luatVon`**: cơ chế chết thì mọi lý do từ chối khác là chuyện của một cơ chế không còn
tồn tại. Code KHÔNG bị xoá (trận ≤v42 vẫn replay đúng khoá/bẻ kèo đã có).

### 7.6 Nền pha nhân vào lực tin (v36 R2, bản C)

`heSoTinTheoNen` (cổng `giaChongNen`): tin đi THUẬN nền đang chạy được NHÂN đậm hơn
(`TIN_THUAN_NEN_X_BP=12500`, ×1,25), tin đi NGƯỢC bị nền ghì (`TIN_NGUOC_NEN_X_BP=8000`,
×0,8). Bản đầu (D166-170) CỘNG nền vào giá vòng tin — đo ra bệnh: nền là thành phần CHUNG,
không phụ thuộc tin thật/giả, nên nó pha loãng đúng tín hiệu mà gate G4 (đọc tin có phải kỹ
năng) sống nhờ. NHÂN thì nền không tự sinh khoản riêng — chỉ quyết tin ĐẬM hay NHẠT.

### 7.7 Vai bất đối xứng — cái giá của vốn to

`config/holdem.ts:LOP_THEO_VAI` (cổng `vaiCoRang`, chỉ bàn ≥12 ghế): cá nhân vốn ×1, không
ghim gì; **cá mập** vốn ×3, GHIM Đòn Bẩy, tác động giá ×2 (nhân vào cả trượt giá đặt lệnh
lẫn crowding); **đội lái** vốn ×3, GHIM Lướt Sóng, tác động giá ×1,5, có thể bị SIẾT PHÁP LÝ
(trừ thẳng 1500 chip khi phơi nhiễm ≥60% NAV lúc ô "Siết pháp lý" nổ); **tổ chức** vốn ×2,
GHIM Đa Dạng Hoá, MANDATE ≤40% NAV/mã và cấm khống. Vốn to không chỉ là "nhiều chip hơn" —
nó tự ĐẨY GIÁ XẤU HƠN cho chính mình ở cả hai kênh giao dịch, đúng nghĩa "vào to là tự đẩy
giá mình lên".

---

## 8. Thẻ chiến thuật: xung đột, cộng hưởng, ma trận × sự kiện

**Xung đột** (`config/holdem.ts:XUNG_DOT_V19`, phạt cố định `250‱` mỗi cặp): chỉ còn ĐÚNG
một cặp còn nghĩa — Mua Đuổi × Chặn Lỗ (đuổi đỉnh rồi tự bán khi rơi = whipsaw mua-đỉnh-
bán-đáy). Ba cặp cũ (dính Lướt Sóng/Bán Khống) đã hết nghĩa từ khi hai lá đó thành đặc
quyền chức năng thay vì hệ số nhân (v19).

**Cộng hưởng** (`CONG_HUONG_V20`, thưởng/phí tuỳ pha, không phải hằng số phẳng): Chặn Lỗ +
Phòng Hộ ăn `900‱` trong giảm/biến động, MẤT `250‱` trong tăng/đi ngang (bảo hiểm có phí,
D20); Đa Dạng Hoá + Chặn Lỗ ăn `900‱` khi cần phanh, mất `400‱` khi không, VÀ triệt nửa
biên tăng của mọi mã đang lãi trong uptrend (`TRIET_BIEN_TANG_BP=5000‱`) — ép người chơi
XÉ CẶP nếu muốn ăn trọn một con sóng tăng.

**Cả hai bảng** chỉ áp đủ 100% khi hai thẻ GẮN cùng một mã (`gan[the] === gan[the_khác]`);
gắn khác mã còn `KHAC_MA_BP = 4500` (45%) — không cho thoát hẳn (0%), nếu không tránh xung
đột chỉ tốn một cú bấm và mất luôn cơ chế "dạy bằng nỗi đau" mô phỏng overfitting.

**T1 — Chiến thuật × Sự kiện** (`MT_CHIEN_THUAT_SU_KIEN`, chỉ có một hàng — `ban_khong`):
tổng mỗi hàng qua 7 sự kiện ≈ 0 có chủ ý (không được dương ròng vô điều kiện). Bán Khống ăn
đậm khi Sập sàn/Thiên nga đen (`+1500‱`), mất khi Hạ lãi/Bong bóng (`−1500‱`/`−2700‱`) —
đúng nghĩa một vị thế NGƯỢC thị trường.

---

## 9. Tiền: quỹ vòng, phí, lạm phát, đòn bẩy, ký quỹ, cháy, ngân hàng

### 9.1 Hai loại trượt giá — đừng lẫn

| | trượt giá LÚC ĐẶT LỆNH (`nav.ts:apLenhGiaoDich`) | trượt giá CROWDING (§5 bước 3) |
|---|---|---|
| khi nào | ngay lúc mua/bán/khống | lúc `chotPhien`, sau khi biết cả bàn đang nắm gì |
| công thức | `cỡ_lệnh × NAV_V10.TRUOT_GIA_BP[nấc] × heSoVoiVangBp(cỡ)/10⁸` | `K(45)×4×tỷ_lệ_lobby/độ_sâu` |
| ai trả | người ĐẶT lệnh | mọi người đang NẮM mã đó, kể cả không giao dịch gì vòng này |
| tiền đi đâu | Quỹ vòng (`phi_giao_dich_vong`) | không đi đâu — chỉ TRỪ pnl_bp, không đụng Vốn trực tiếp |

Trượt giá lúc đặt lệnh có hệ số "vội vàng" phi tuyến theo cỡ lệnh so ĐỘ SÂU SỔ QUY CHIẾU
(mặc định = vốn khởi điểm; vai to dùng vốn khởi điểm CỦA VAI):

```
heSoVoiVangBp(cỡ) = min(TRAN_BP=220000, 10000 + ⌊cỡ × DOC_BP(160000) / quy_chiếu⌋)
```

Ví dụ đã dò (map 8, mã mỏng — `mong`, gốc `120‱` = 1,2%): lệnh 1.000 chip (10% vốn) →
hệ số 2,6× → trượt ~3,1%. Lệnh ALL-IN 10.000 (100% vốn) → hệ số 17,0× → trượt **~20%** MỘT
CHIỀU — đây là chi phí thật của việc "đập một lệnh bằng cả độ sâu sổ", không phải hình phạt
tuỳ tiện. Thẻ Chia Lệnh né được phần phi tuyến này bằng cách chia nhỏ lệnh.

### 9.2 Phí giữ tiền mặt — "tiền mặt phải CÓ GIÁ"

Ba lớp riêng biệt, cùng một triết lý (D20: an toàn miễn phí thì mọi luật siết rủi ro phản
tác dụng):

- **Lạm phát nền** (`NAV_V10.LAM_PHAT_TIEN_MAT_BP = 150‱/vòng`) — áp lên TIỀN MẶT của MỌI
  ghế còn trong trận, mỗi vòng, vô điều kiện. Đây là khoản ĐỐT (rời khỏi hệ kín).
- **Phí đứng ngoài** (`PHI_DUNG_NGOAI.NEN_BP = 150‱/vòng`, riêng ghế `dung_ngoai`) — cộng
  thêm 400‱ nếu ô là lạm phát (v42 trở về trước), hoặc KHÔNG cộng nữa nếu cờ `tienMatSuKien`
  đã bật (v42 trở lên — khoản đó dời sang bullet "Cú sốc tiền mặt" ngay dưới, không thu hai lần).
- **Cú sốc tiền mặt v42** (`TIEN_MAT_SU_KIEN`, cổng `tienMatSuKien`): ô lạm phát trừ THẲNG
  `400‱` tiền mặt tự do của **MỌI** ghế còn trong trận (kể cả đứng ngoài) — trước v42, ôm
  tiền mặt là cách NÉ lạm phát (bài học đọc ngược); nay tiền mặt chính là thứ lạm phát ăn,
  đúng ngoài đời.

### 9.3 Cắt lỗ về cash (D2)

```
bp_gốc = 150 (lạm phát vòng) + 350 (rút khẩn, hoặc thấp hơn nếu cầm Khớp Nhanh)
giẫm_đạp = (số_người_bỏ ≥ 2) VÀ (tỷ_lệ_lobby_bỏ ≥ 30%)
bp = giẫm_đạp ? bp_gốc × 2 : bp_gốc
mất = min(vốn, applyBpInt(vốn, bp))
```

Số lần được cắt lỗ giới hạn theo cỡ map (`soLanCatLo`: map 8→1 · 12→1 · 16→2). Hết lượt thì
`'bo'` bị GỠ khỏi danh sách nước được làm — chỉ còn chiến đấu tiếp hoặc Đầu hàng (mất hạng
hẳn).

### 9.4 Đòn bẩy — HAI cơ chế khác nhau, một sống một chết

**Thẻ chiến thuật "Đòn Bẩy 2×"** (§5 bước 5) — SỐNG, mặc định. Nhân toàn bộ hoặc một phần
PnL ×2. Ba lực đối trọng bắt buộc để all-in không thành nước đi trội: gọi ký quỹ (§9.5),
Chặn lỗ/Phòng hộ đắt hơn khi ai cũng dùng (§8), và trượt giá phi tuyến (§9.1) tự nhiên phạt
lệnh to.

**"Cam kết = Đòn bẩy" (D35 hướng 1, `DON_BAY_CAM_KET`/`apDonBayCamKet`)** — code ĐẦY ĐỦ,
CHẾT VĨNH VIỄN trong mọi phiên bản đã lật (`donBayCamKet: false` ở MỌI dòng của
`BO_LUAT_THEO_PHIEN_BAN`, kể cả v44 ở cổng). Công thức (nếu bật): tỷ lệ cam kết vòng này so
Vốn đầu vòng chạy qua đường cong lõm `10000 + TOI_DA_BP(7000) × √u` (u = phần vượt ngưỡng
10% đã chuẩn hoá), nhân LỆCH thêm cho vế lỗ (`LECH_LO_BP=12000`, ×1,2), kẹp trần tích với
thẻ Đòn Bẩy (`TRAN_TONG_BP=24000`, tối đa 2,4× khi chồng cả hai), trừ phí tài trợ trên phần
vượt ngưỡng. Xem §11 mục 8 vì sao nó chết và vì sao việc nó chết còn SÂU hơn một cái cờ tắt.

### 9.5 Ký quỹ (margin call) — cơ chế trừ thẳng Vốn duy nhất ngoài cược/phí

```
điều kiện: cầm thẻ Đòn Bẩy 2×  VÀ  pnl_bp vòng này ≤ ngưỡng
  hack sàn nổ:  ngưỡng = −3000 (−30%)   mất 800 chip
  ô thường:     ngưỡng = −1800 (−18%)   mất 700 chip   (chỉ khi cổng kyQuyRong bật — mặc định BẬT)
```

Trừ từ NAV (tiền mặt trước, pro-rata vào vị thế nếu thiếu — §6.2) từ v34. TRÁNH ĐƯỢC bằng
kỹ năng: đọc telegraph/dư âm rồi hạ đòn bẩy TRƯỚC vòng xấu thì không mất gì — đây là cần
gạt KỸ NĂNG, không phải thuế cố định. Trước v34, cửa nổ duy nhất là `hack_san` (~5% số ô) ⇒
Đòn Bẩy gần như miễn phí (đo được: về nhất 34,6% so 14,8% của ô trống).

### 9.6 Khẩu vị rủi ro — nhân CẢ HAI CHIỀU, mắt xích cuối tuyệt đối

| mức | hệ số | |
|---|---:|---|
| Thận trọng | ×0,75 | khó cháy, khó bứt lên |
| Cân bằng | ×1,00 | mặc định, không vẽ dòng nào trên UI |
| Quyết liệt | ×1,35 | dễ về nhất, dễ cháy |

Chọn Ở SẢNH, khoá suốt trận (D6). Nhân cả lãi lẫn lỗ để KHÔNG đẻ lựa chọn trội — nếu
"quyết liệt" có kỳ vọng cao hơn thì nó là nút-bấm-là-đúng chứ không phải khẩu vị, và đó
chính là tín hiệu hành vi app muốn bán (A1): thứ duy nhất phân biệt hai lựa chọn CÙNG kỳ
vọng là người chơi CHỊU ĐƯỢC BAO NHIÊU BIẾN ĐỘNG.

### 9.7 Ngưỡng cháy + van casual

`NAV ≤ 10% vốn khởi điểm CỦA GHẾ ĐÓ` (`NGUONG_CHAY_BP=1000`, đọc theo NAV — khoá tài sản
KHÔNG cứu được khỏi cháy, spec 02 §3.3). 4 vòng đầu trận có "van casual": thay vì cháy, vốn
được giữ ở sàn 500 chip (`CASUAL_VALVE_FLOOR`) để không ai bị loại ngay từ đầu trận rồi ngồi
nhìn hết trận.

### 9.8 Hợp đồng gửi tiết kiệm (v43, ở cổng)

`TIET_KIEM` — ba mốc kỳ hạn `[2, 3, 4]` ô (FOUNDER CHỐT, không phải MC-TUNE), không giới
hạn số hợp đồng cùng lúc. Lãi CHỐT LÚC MỞ:

✔ **Bộ số đã chốt bằng đo ở D317** (§1): `PHAN_BU_BP 25`, `THEM_KY_HAN_BP {2:0, 3:50, 4:50}`.
⚠ Mốc 3 và 4 trả bằng nhau — CHỦ Ý, xem §1.

```
lãi/ô = ⌊lãi_suất_nền_lúc_mở / 2⌋  +  THEM_KY_HAN_BP[mốc]{2:25, 3:50, 4:50}  +  PHAN_BU_BP(25)
```

Ví dụ: lãi nền 400 điểm, mốc 4 ô ⇒ `200 + 50 + 25 = 275 bp/ô` (mốc 3 cũng 275; mốc 2 là 250).

⭐ **QUY ĐỔI RA ĐỜI THẬT — thước cuối cùng chốt bộ số này** (founder đưa bảng lãi VN 09/09).
1 ô = 6 tháng ⇒ **%/năm = 2 × %/ô**:

| mốc | = tháng | game (%/năm) | lãi tiết kiệm VN thật |
|---|---|---|---|
| 2 ô | 12 | 5,0 | 5,5 – 7,4 |
| 3 ô | 18 | 5,5 | 5,5 – 7,4 |
| 4 ô | 24 | 5,5 | 5,5 – 7,4 |

⚠ Bảng thật cho thấy 12 và 24 tháng gần như trả BẰNG NHAU ngoài đời — nên một bậc thang trung
thực tuyệt đối sẽ không cho người chơi lý do nào để khoá lâu hơn, và cơ chế mất luôn phần
"chọn kỳ hạn". Mốc 2 vì thế đặt hơi DƯỚI dải thật (5,0 thay vì 5,5): một chỗ ép thực tế CÓ CHỦ
Ý, xem mục 11. Lãi tích luỹ (`lai_don`) nằm
TRONG NAV ngay từ lúc cộng (không chờ đáo hạn) — hợp đồng KHÔNG cứu khỏi cháy. Huỷ trước
hạn: mất TOÀN BỘ lãi treo, chỉ lấy lại gốc — hình phạt là tiền thấy được ngay vòng huỷ, không
phải một câu chữ trong luật.

### 9.9 Coupon trái phiếu (v42) + đường cong lợi suất (v45)

`couponBp(lãi_suất_điểm) = ⌊⌊lãi_suất_điểm/2⌋ × NHAN_BP(10000)/10000⌋` — trả vào TIỀN MẶT
mỗi ô cho ai cầm `tpcp` sổ dài; sổ KHỐNG bị TRỪ đúng khoản đó khỏi ký quỹ (người khống đi vay
tờ trái phiếu, chủ tờ vẫn phải nhận lãi của họ — khoản này ĐỐT, không ai trong bàn nhận).
Neo vào lãi suất ĐANG CÔNG BỐ, không phải một hằng số riêng — trận đã có một máy lãi suất,
thêm máy thứ hai là hai nguồn chân lý cho cùng một khái niệm (D61).

⭐ **v45 (D318): neo vào LỢI SUẤT DÀI, không phải lãi chính sách.**

```
lãi_dài = NEO_BP(400) + ⌊TRUYEN_DAN_BP(4000) × (lãi_chính_sách − 400) / 10000⌋
coupon  = ⌊lãi_dài / 2⌋ × NHAN_BP / 10000
```

Tờ trái phiếu trong game là **10 năm**; trước v45 coupon đọc thẳng lãi chính sách nên một kỳ
họp tăng 75 đẩy coupon lên đúng 75 — ngoài đời lãi dài không chạy 1:1. Nay 75 chỉ đẩy coupon
lên **15**. `NEO_BP` = khởi điểm ⇒ ở lãi nền coupon KHÔNG đổi một bp so bản cũ (cú vá chỉ chạm
cách lãi dài PHẢN ỨNG, không chạm mức nền — xem mục 11 điều 1).

⭐ **Và phải GIỮ ĐỦ MỘT Ô** (v45, founder 09/09): coupon của ô N chỉ trả trên
`min(vị_thế cuối ô N−1, vị_thế hiện tại)` — phần đã nằm im trọn một ô. Trái phiếu kho bạc Mỹ
trả lãi nửa năm một lần, mà 1 ô = nửa năm ⇒ đúng một kỳ mỗi ô; trước v45 ai mua sát vòng chốt
cũng ăn nguyên coupon, tức nhặt lãi miễn phí. Ngoài đời mua giữa kỳ thì người mua TRẢ phần lãi
đã dồn cho người bán. Sổ khống đối xứng. Ảnh chụp ở `Ghe.vi_the_o_truoc`, ghi tại điểm nối vòng
và **chỉ khi cờ bật** (ghi vô điều kiện là golden lệch hash ở bản ghim — đã dính).

⭐ Hệ quả chơi được: **đường cong đảo ngược**. Gửi tiết kiệm neo lãi CHÍNH SÁCH, coupon neo lãi
DÀI, nên từ kỳ họp tăng đầu tiên trở đi tiền gửi bắt đầu trả cao hơn trái phiếu dài. Ra DTO ở
`lai_suat.dai`; màn nói thẳng "ĐƯỜNG CONG ĐẢO NGƯỢC" khi `dai < diem`.

### 9.10 Chia Quỹ vòng

```
quỹ_vòng = tổng nền mọi ghế còn cược + phí trượt giá lúc đặt lệnh của vòng
```

Chia theo HẠNG `pnl_bp` (không phải winner-take-all): trọng số `[5000, 3000, 2000]‱` (hạng
1/2/3 = 50%/30%/20%), số suất CO GIÃN theo số ghế còn tranh (`quyCoGian`, mặc định BẬT —
`⌈60% × số_ghế⌉` suất, tuyến tính giảm dần nếu >3 suất) để bàn 8 ghế không còn "3 suất cố
định = 3/8 ghế có thưởng, hạng 4 và hạng 8 nhận như nhau".

---

## 10. Bot chấm điểm — phản chiếu công thức engine

`server/holdem/bots.ts` KHÔNG có công thức riêng cho giá trị tài sản — nó gọi lại đúng
`mtGiaiDoan(bo)`/`mtSuKien(bo)` mà engine dùng (tham số `bo: BoMaTran` truyền từ
`BoiCanhLenh`, cùng cửa `boMaTranCua` — §4.2). Từng có bug hai bản `BoiCanhLenh` (đường thật
và đường đo) trôi khỏi nhau: bot MUA theo bảng v41 trong khi engine ĐỊNH GIÁ bằng bảng v42,
khiến gate Monte Carlo đo chênh lệch hai bảng chứ không đo kỹ năng — dấu hiệu duy nhất là
số ra GIỐNG HỆT lần đo trước tới từng chữ số thập phân. Vá bằng một cửa duy nhất
`coV42ChoBot(st)`.

**Kỳ vọng một mã dưới một phân bố xác suất** (`kyVongTaiSan`): `Σ mtGiaiDoan[mã][pha] ×
xác_suất(pha)` — không phải kỳ vọng dưới MỘT kịch bản mà dưới CẢ PHÂN BỐ (sau khi phát hiện
20/07: cho bot dự đoán một giai đoạn ĐƠN khiến oracle và bot "tin mù" bốc thẻ giống hệt
nhau, chỉ khác cỡ cược). **Rủi ro của một mã** (`daoDongTaiSan`) là độ lệch tuyệt đối CÓ
TRỌNG SỐ so kỳ vọng — dùng làm thước phòng hộ cho bot "hiệu chỉnh" (nó trừ bớt điểm theo độ
dao động, `NE_PHUONG_SAI_BP=5000‱`, để ưu tiên mã sống được ở nhiều kịch bản).

**Lợi suất kỳ vọng một mã** (`loiSuatKyVongBp`, dùng để đặt lệnh trong vòng): cân trôi +
điểm giai đoạn/sự kiện (× hệ số tin theo nền nếu `giaChongNen` bật) + echo + coupon (nếu
`tpcp`) − giá của việc giữ tiền mặt (nếu `tienMatSuKien` bật — bot chỉ đọc thông tin nó CÓ,
không đọc ô thật, để không phát không một máy dò tin giả).

**Bốn nhóm bot** (`NhomBot`): `tham_chieu` (đối thủ lấp ghế thật) · `tin_hieu` (ba bot ĐO —
tin mọi tin / phớt mọi tin / hoài nghi hiệu chỉnh, chỉ tồn tại để trả lời "đọc tin có phải
kỹ năng không" cho gate G4) · `choi_duoc` (archetype có phong cách — Tất tay, Phòng thủ, Đa
dạng hoá…) · `di_von` (dụng cụ đo riêng cho chẩn đoán D35, không lẫn vào trung bình
`choi_duoc`). Bot "Ngồi im" (`von_khong_doc: 'khong'`) và "Bấm bừa" (`'mu'`) giữ DANH TÍNH
đọc bối cảnh riêng — cho cả đàn dùng chung một chính sách từng làm "Ngồi im" hoá ra có giao
dịch và "Bấm bừa" hoá ra giỏi.

---

## 11. NHỮNG CHỖ MÔ HÌNH ÉP THỰC TẾ

Đây là mục có giá trị nhất của tài liệu — liệt kê chỗ trò chơi đơn giản hoá thị trường thật,
và LÝ DO đơn giản hoá đó tồn tại (thường là "chơi được" thắng "đúng tuyệt đối", có chủ ý).

1. **Một lãi suất nền — nhưng ĐÃ CÓ hai điểm trên đường cong từ v45 (D318).**
   `LAI_SUAT_NEN` (lãi CHÍNH SÁCH) vẫn là con số duy nhất chi phối xác suất thẻ và thanh
   khoản. Nhưng coupon Trái phiếu Mỹ thôi đọc thẳng nó: nó suy từ **lợi suất DÀI** qua
   `laiSuatDaiBp` — chính sách nhích 100 thì lãi dài chỉ nhích **40** (`TRUYEN_DAN_BP` 4000;
   beta thật đo được 0,3–0,5). ⭐ Nhờ đó **đường cong đảo ngược được**: lãi lên cao thì gửi
   tiết kiệm (neo lãi chính sách) trả cao hơn coupon trái phiếu dài, và màn nói thẳng ra.
   ⚠ Còn thiếu: **phần bù kỳ hạn** (~+100 bp ngoài đời). Bản đầu D318 có nó và gate BÁC —
   coupon nền cao hơn làm khống trái phiếu đắt hơn, đẩy bot khống qua ngưỡng `GOI_KY_QUY`
   (`Ngược dòng` tụt từ 25,5% xuống 11,5% thắng). Thêm lại là một việc riêng, cần cân lại
   chi phí khống trước. Và đường cong vẫn chỉ có HAI điểm, không phải một đường.

2. **Tương quan chỉ có 2 số MỖI CHẾ ĐỘ, theo NHÓM chứ không theo mã** (§3.3, mặc định
   trước v44). "CTCK bám sát chỉ số hơn VN30" là điều bộ máy KHÔNG diễn đạt được cho tới khi
   v44 (còn ở cổng) nới ra `NEN_RIENG`. Trước đó mọi mã trong nhóm `rui_ro` có CÙNG một β dù
   bản chất rủi ro khác hẳn nhau.

3. **Nhiễu một nhân tố, không phải nhiều nhân tố.** Thị trường thật có nhiều "nhân tố ẩn"
   (lãi suất, hàng hoá, tín dụng…) tác động khác nhau lên từng nhóm tài sản; ở đây chỉ MỘT
   cú sốc chung `z_chung` cho toàn bộ 6 mã mỗi vòng. Đủ để tạo "mọi thứ sụp cùng lúc" nhưng
   không đủ để tạo "nhóm A sụp mà nhóm B thì không, vì lý do khác nhóm A".

4. **Hằng nén thang chơi `K = 0,55` là một LỰA CHỌN, không phải số đo**
   (`lop-vn-nguon-va-gop.md` §2). Tín hiệu thị trường thật (VN-Index năm 2008: −49,8%) nếu
   đưa thẳng vào bp sẽ lấn át nhiễu ngẫu nhiên của engine, làm "đọc đúng thị trường" trở
   thành chắc thắng tuyệt đối — mất hết phần "đọc sai vẫn có thể đúng do may". `K` ép độ
   lớn TÍN HIỆU THẬT phải nằm trong biên độ mà một trò chơi còn chơi được, hy sinh độ trung
   thực tuyệt đối để giữ được cảm giác bất định.

5. **Co rút Bayes `w = n/(n+4)` — phần lớn ô Việt Nam vẫn là tiên nghiệm toàn cầu, không
   phải dữ liệu VN.** `n` cho hầu hết sự kiện là 1–4 (một, hai, ba, hoặc bốn lần quan sát
   trong lịch sử 25 năm của thị trường VN); 8/12 sự kiện có `w=0` tuyệt đối (không đổi một
   bp). Đây là chỗ tài liệu nguồn tự nhận: "tiên nghiệm toàn cầu, không phải một quy luật đo
   được" — và số đợt bear "trọn vẹn" dùng làm mẫu số k=4 tự nó cũng là một lựa chọn, không
   phải một hằng số vật lý.

6. **6 tài sản, tối đa 3 mã giữ đồng thời** (`MAX_TAI_SAN`, trừ Đa Dạng Hoá nới +1) — một
   danh mục thật có hàng chục/hàng trăm vị thế; ở đây trần thấp có chủ ý để MỖI lần chọn
   mã là một đánh đổi thật, không phải một phép tối ưu hoá danh mục hiện đại (Markowitz).

7. **Thanh khoản chỉ có 3 NẤC rời rạc** (`mong/vua/day`, `DO_SAU_L = {2500,6000,14000}`),
   không phải một sổ lệnh liên tục. Trượt giá tính bằng công thức tuyến tính đơn giản
   `K×flow/L`, không phải mô hình vi cấu trúc thị trường thật (order book depth, market
   maker inventory…).

8. **"Cam kết = Đòn bẩy" (D35 hướng 1) là code sống nhưng KHÔNG BAO GIỜ chạy được** — không
   chỉ vì cờ `donBayCamKet` luôn `false` ở mọi phiên bản đã lật (kể cả v44 ở cổng), mà còn
   vì **máy cược tuần tự (tố/theo/bỏ kiểu poker) đã bị TẮT từ `balance-v10a-tatcuoc`**
   — biệt danh phiên bản nói thẳng ra điều đó, và 36/41 khoá từ đó tới v44 giữ nguyên
   `cuocTat: true`; năm khoá cổ hơn (v5…v9) vẫn `false` và replay đúng bằng máy cược cũ (`cuocTat: true` ở mọi
   phiên bản, `server/holdem/engine.ts:choiVongCuoc`): mọi nước ngoài "bỏ" bị ép về "theo"
   ở đúng giá nền phẳng (`CAM_KET_NEN = 500`). Nghĩa là `camKet` mà `apDonBayCamKet` đọc để
   tính tỷ lệ đòn bẩy GẦN NHƯ LUÔN đúng bằng 500/vốn_đầu_vòng ≈ 5% — dưới hẳn ngưỡng kích
   hoạt 10% (`DON_BAY_CAM_KET.NGUONG_BP`). Tức là ngay cả khi ai đó bật cờ này lên, cơ chế
   vẫn gần như câm vì KHÔNG CÒN đường nào để "cam kết" biến thiên thật — cái tên
   "Market **Hold'em**" giữ lại từ thời trò chơi còn là poker đấu giá, nhưng phần đấu giá
   đã bị thay bằng một khoản góp bắt buộc phẳng từ rất sớm trong lịch sử repo.

9. **`CO_VI_THE` (cỡ lệnh bot theo độ tin, kiểu Kelly) đã ĐO và bị BÁC BỎ, không phải chưa
   thử.** D58 dựng cơ chế này để trả lời "vì sao oracle biết trước mọi tin mà vẫn xếp dưới
   bot chơi-được", đo ra oracle TỆ ĐI (2,27→2,31 ở map 8) — vì lợi thế thật của oracle nằm ở
   ĐỌC ĐÚNG DẤU, không nằm ở ĐỘ LỚN điểm kỳ vọng, mà cấp vốn theo độ lớn giúp MỌI bot như
   nhau (kể cả bot đuổi giá cũng dồn to khi điểm thiên lệch của nó cao). Giữ tắt vĩnh viễn ở
   cổng — một quyết định có số liệu, không phải một tính năng dở dang.

10. **Bong bóng là một CHẾ ĐỘ nhị phân (phồng/vỡ), không phải một quá trình liên tục.** Mỗi
    ô trong chế độ chỉ có hai kết cục khả dĩ được engine "biết trước là sẽ hỏi": tiếp tục
    phồng hay gãy ngay lập tức toàn bộ. Thị trường thật không có ranh giới rõ vậy — bong
    bóng xì hơi từ từ cũng có thật, không chỉ nổ.

11. **Trái phiếu Mỹ ở v42 là GIÁ-THUẦN, tách carry ra khỏi ma trận một cách áp đặt** (§4.5)
    — một quyết định kiến trúc đúng đắn (tránh trả lãi hai lần) nhưng cũng là dấu hiệu cả hệ
    thống ma trận trước đó đã GÓI carry vào biến động giá của MỌI tài sản khác một cách
    không tường minh (chỉ `tpcp` được "giải phẫu" carry ra riêng; 5 mã còn lại vẫn trộn
    carry/dividend/funding-cost chung vào con số biến động giá của chúng, nếu có).

12. **Rủi ro mất neo của USDT được mô hình bằng 3 SỐ RỜI RẠC ở 3 SỰ KIỆN CỤ THỂ**
    (§4.5), suy từ đúng BA lần rời neo có sổ sách trong lịch sử stablecoin (`n=3`) — một
    tài sản còn quá non để có "quy luật thống kê", nên bộ số này gần với một danh sách
    tình huống lịch sử được mã hoá hơn là một mô hình rủi ro tổng quát.

13. **`GIAM_TRUOT_GIA_BP.khop_nhanh` là hằng số chết** — khai trong `config/holdem.ts`
    nhưng không nơi nào trong `server/` đọc nó nữa (đã xác minh bằng grep toàn repo); vai
    trò "giảm trượt giá crowding cho Khớp Nhanh" mà tên hằng số này gợi ý đã chuyển hẳn
    sang cơ chế HOÀN TIỀN theo bậc người đông (`KHOP_NHANH_HOAN_BP`, §5 bước 3) từ đợt T4.
    Không ảnh hưởng cân bằng (không ai đọc nó) nhưng là một chỗ tên gọi nói dối về việc gì
    đang thật sự chạy.

15. **Bậc thang kỳ hạn tiết kiệm ÉP DỐC HƠN ĐỜI THẬT, có chủ ý** (§9.8, D317). Lãi tiết kiệm
    VN cho 12 và 24 tháng gần như bằng nhau (5,5–7,4%/năm cả hai), tức ngoài đời **không có
    phần thưởng đáng kể cho việc khoá lâu hơn** — thứ trả cho kỳ hạn dài là quan hệ với ngân
    hàng và sự tiện, không phải lãi suất. Chép trung thực điều đó vào game thì mốc ngắn nhất
    luôn trội và "chọn kỳ hạn" thành một nút giả. Nên mốc 2 ô bị đặt ở 5,0%/năm — dưới sàn dải
    thật một chút. Đây là chỗ hiếm hoi tài liệu này ghi một sai lệch mà bản thân **số đo** đòi:
    ba bộ đã thử đều cho thấy phần bù kỳ hạn DƯƠNG làm mốc dài nhất thắng tuyệt đối, còn phần
    bù BẰNG KHÔNG thì giết mốc dài — chỉ một chỗ phẳng ở đỉnh cộng một chênh nhỏ ở đáy mới cho
    ba mốc nằm trong 0,2 hạng của nhau.

14. **Phí đứng ngoài/cắt lỗ/lạm phát là các con số PHẲNG không phụ thuộc quy mô lệnh hay độ
    biến động thị trường thời điểm đó** — ngoài đời chi phí "đứng ngoài thị trường" (cơ hội
    phí) biến thiên rất mạnh theo giai đoạn; ở đây nó là 150‱/vòng bất kể thị trường đang êm
    hay đang bão (trừ cộng thêm rời rạc khi đúng ô lạm phát).

---

## 12. Phụ lục — hằng số sống ở đâu

| chủ đề | hằng số / hàm | tệp |
|---|---|---|
| Tương quan một nhân tố | `TUONG_QUAN`, `betaCua`, `heSoRiengBp`, `BETA_V44` | `config/holdem.ts` |
| Biên nhiễu nền theo mã (3 lớp) | `TaiSan.bien_dong_bp` → `BETA_V44.BIEN_DONG_RIENG` → `BIEN_DONG_V45`, đọc qua `bienDongCua` | `config/holdem.ts` |
| Đường cong lợi suất | `DUONG_CONG`, `laiSuatDaiBp`, `couponBp(diem, duongCong)` | `config/holdem.ts` |
| Ma trận Tài sản×Giai đoạn/Sự kiện (3 đời) | `MT_TAI_SAN_GIAI_DOAN[_VN][_V42]`, `MT_TAI_SAN_SU_KIEN[_VN][_V42]`, `boMaTranCua` | `config/holdem.ts` |
| Regime Tick + chu kỳ thực tế | `REGIME_TICK`, `REGIME_TICK_THUC_TE`, `thamSoTick` | `config/holdem.ts` |
| Lịch chính sách + lãi suất nền | `LICH_CHINH_SACH`, `LAI_SUAT_NEN` | `config/holdem.ts` |
| Tin giả theo bối cảnh | `TY_LE_TIN_GIA_THEO_BOI_CANH`, `TY_LE_TIN_GIA_THUC_TE`, `MAP_V28`, `tyLeTinGiaHieuDung` | `config/holdem.ts` |
| Bong bóng (3 đời) | `BONG_BONG`, `BONG_BONG_V27`, `BONG_BONG_THUC_TE`, `BONG_BONG_PHONG_TIEP_BP` | `config/holdem.ts` |
| Sức căng | `SUC_CANG`, `sucCangLuc`, `apCang` | `config/holdem.ts` / `server/holdem/engine.ts` |
| Áp lực bàn | `AP_LUC_BAN`, `napApLuc`, `xsCongApLuc` | `config/holdem.ts` / `server/holdem/engine.ts` |
| Dây chuyền sự kiện | `MT_SU_KIEN_KE_TIEP`, `MT_KE_TIEP_MO_RONG`, `SU_KIEN_THEO_GIAI_DOAN[_GHIM]` | `config/holdem.ts` |
| Cân trôi kỳ vọng | `CAN_TROI_BP[_V23][_V42]`, `bangCanTroi` | `config/holdem.ts` |
| Dây chuyền chấm điểm 1 vòng | `dungChuoi`, `machEcho`, `echoDangCo`, `nhieuCua` | `server/holdem/engine.ts` |
| Định giá vị thế | `apDinhGia`, `apLenhGiaoDich`, `heSoVoiVangBp` | `server/holdem/nav.ts` |
| Trượt giá crowding + hàng chờ | công thức trong `dungChuoi` (bước 3), `DAO_DANH_MUC` | `server/holdem/engine.ts` / `config/holdem.ts` |
| Thanh khoản động | `THANH_KHOAN_DONG`, `nacHieuDung`, `GIA_CUA_THANH_KHOAN_BP` | `config/holdem.ts` / `server/holdem/engine.ts` |
| Xung đột/cộng hưởng thẻ | `XUNG_DOT_V19`, `CONG_HUONG_V20`, `MT_CHIEN_THUAT_SU_KIEN` | `config/holdem.ts` |
| Đòn bẩy (thẻ, sống) | `dungChuoi` bước 5, `CAP_STACK_BP` | `server/holdem/engine.ts` / `config/holdem.ts` |
| Đòn bẩy (cam kết, chết) | `DON_BAY_CAM_KET`, `heSoDonBayBp`, `apDonBayCamKet` | `config/holdem.ts` / `server/holdem/engine.ts` |
| Ký quỹ / Siết pháp lý | `GOI_KY_QUY`, `SIET_DOI_LAI`, `truVonTuNav` | `config/holdem.ts` / `server/holdem/engine.ts` |
| Khẩu vị rủi ro | `KHAU_VI` | `config/holdem.ts` |
| Cháy / van casual | `NAV_V10.NGUONG_CHAY_BP`, `daChayNav`, `HOLDEM_DECISIONS.CASUAL_VALVE_*` | `config/holdem.ts` / `server/holdem/nav.ts` |
| Cắt lỗ / đứng ngoài | `CAT_LO_VE_CASH`, `PHI_DUNG_NGOAI`, `TIEN_MAT_SU_KIEN` | `config/holdem.ts` |
| Khoá tài sản (Lõi vốn B) | `KHOA_TAI_SAN`, `apKhoaTaiSan` | `config/holdem.ts` / `server/holdem/engine.ts` |
| Ngân hàng / tiết kiệm | `TIET_KIEM`, `laiTietKiemBp`, `apMoTietKiem`, `apHuyTietKiem` | `config/holdem.ts` / `server/holdem/engine.ts` |
| Coupon trái phiếu | `COUPON`, `couponBp`, `apCoupon` | `config/holdem.ts` / `server/holdem/nav.ts` |
| Chia Quỹ vòng | `CHIA_QUY_VONG`, `trongSoQuyVong`, `chiaQuyVong` | `config/holdem.ts` / `server/holdem/engine.ts` |
| Vai bất đối xứng | `LOP_THEO_VAI`, `MANDATE_TO_CHUC`, `heSoTacDongGia` | `config/holdem.ts` / `server/holdem/engine.ts` |
| Cờ phiên bản | `BoLuatCanBang`, `BO_LUAT_THEO_PHIEN_BAN`, `luatCua` | `config/holdem_balance.ts` |
| Bot chấm điểm | `kyVongTaiSan`, `daoDongTaiSan`, `loiSuatKyVongBp`, `coV42ChoBot` | `server/holdem/bots.ts` / `server/holdem/engine.ts` |
