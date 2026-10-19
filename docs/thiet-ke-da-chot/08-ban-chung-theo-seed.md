# 08 — MỜI BẠN VÀO ĐỘI: BÀN CHUNG THEO SEED (đề xuất 16/08 · THI CÔNG BẢN A cùng ngày)

**Trạng thái 16/08 tối — founder: *"làm mấy cái chốt chiều nay đi đã"* ⇒ thi công
phương án A (đề xuất), đã lên PROD:** migration `0040_holdem_ban_chung` (bảng
`holdem_ban` + `holdem_matches.ban_ma` UNIQUE theo người) · `POST /holdem/ban`
(phát mã 5 ký tự, hạn 24h) · `POST /holdem/matches {ban_ma}` (seed + cỡ map từ
bàn; 409 `da_vao_ban` kèm match_id cũ; bàn chung = tự do dù xin rank) ·
`GET /holdem/ban/:ma` (bảng đội; số người khác chỉ lộ SAU khi mình xong — A3.1)
· sảnh: card TẠO PHÒNG khoá → **RỦ BẠN CÙNG BÀN** (phát mã · CHIA SẺ LINK
`/arena/ban/<mã>` · SAO CHÉP · NHẬP MÃ) · màn kết: khối **ĐỘI CỦA BẠN** ·
`hd_match_start` mang `ban_ma` + `nguon:'ban_chung'`. Test: 5 server + 5 web.
Q1–Q4 chốt theo đề xuất (A · trần đội chưa ép số, mã do server phát · khách vào
được · thấy NAV bạn SAU khi chốt). ⚠ Ghost NAV bạn trong dải đối thủ (§3) và
kèo T (D95) CHƯA — bàn chung nay là nền cho cả hai.

*Founder: "Mời bạn bè ý t là kiểu mời vào ĐỘI như TFT ấy — game hiện tại ít
người chơi mà không cho họ mời thì tìm trận đến bao giờ. Cân bằng số người mời
để game không mất cân bằng."*

## 0. Hôm nay có gì
- Card TẠO PHÒNG ở sảnh: `disabled` + ổ khoá, "chờ vé phòng ở Shop". Server:
  **không có API phòng/mời nào**.
- Mỗi trận là **một dòng `holdem_matches` của MỘT người**, ghế còn lại là bot
  (`soDoGhe(seed)` 4–8 ghế); `taoTran(seed, ghe, luat, soO)` **tất định theo
  seed** — cùng seed ⇒ cùng map, cùng bot, cùng ô lật. `rank_slot`/`rank_bu`
  (PvP thật) đóng từ đầu; D31 nói ĐẤU RANK phải toàn người thật — mùa Beta chấp
  nhận thiếu người.
- D15 đã thiết kế **"ghost async cùng seed"** (Đấu 5): người chơi cùng một bàn
  nhưng KHÔNG cùng lúc, so nhau bằng kết quả trên cùng seed. Chưa xây.

## 1. Hai cách "vào đội", chọn cách rẻ trước

| | A. BÀN CHUNG THEO SEED (async, đề xuất) | B. PHÒNG THẬT (đồng thời) |
|---|---|---|
| Cách chơi | trưởng đội tạo bàn ⇒ mã 5 ký tự/link; bạn vào ⇒ MỖI NGƯỜI một trận riêng CÙNG seed, cùng bot; xong thì bảng "ĐỘI CỦA BẠN" xếp NAV cả đội | mọi người ngồi một trận, engine tick chung, đợi nhau chốt vòng |
| Cần thay đổi | `POST /matches {ban_ma}` nhận seed do server phát · bảng `holdem_ban` (mã ↔ seed, cỡ, chủ, hạn 24h) · sảnh có ô NHẬP MÃ + link · màn kết có bảng đội (đọc `holdem_results` cùng `ban_ma`) · DoiThuStrip: ghế BẠN của người trong đội = ghost (NAV theo vòng nếu họ đã chơi tới đó, đọc từ `hd_chot_phien`) | engine đa người, đồng hồ đợi nhau (D38 pha cam kết đang treo D40 §CHỜ FOUNDER), ghép bàn, reconnect, đua ghi — cả một mùa |
| Cân bằng | **KHÔNG đổi một chip nào**: giá/chen chúc/bot y trận đơn — bạn không đẩy giá của tôi (mỗi người một sổ). Công bằng vì cùng seed = cùng đề (Wordle) | crowding giữa người thật là cơ chế mới, chưa gate nào đo |
| Data | thêm nhãn `ban_ma` + `nguon:'doi'` trong `hd_match_start` — cohort "được rủ" (D62 chưa đo được) | events mới, đua ghi |
| Khi nào | 1–2 lượt làm việc | mùa sau, sau khi có người |

⇒ **Đề xuất A** cho mùa 0.0. Nó trả lời đúng câu của founder — bạn bè chơi
CÙNG BÀN, so nhau, kể được — mà không cần ai online cùng lúc (n≈5 người, D86:
điều kiện "cùng lúc" là điều kiện không thoả được).

## 2. "Cân bằng số người mời" — luật đề xuất
- **Trần đội = 4 người** (kể cả trưởng). Lý do không phải cân bằng chip (không
  đổi) mà là **so được**: bảng đội 2–4 dòng đọc trong một liếc; 8 dòng thì thành
  bảng xếp hạng, và bảng xếp hạng đẻ động cơ méo (D32).
- **Bàn đội = đấu TỰ DO**, không rank_pve: rank đòi toàn người thật (D31), và
  seed công khai trong đội thì người vào sau xem được người vào trước ⇒ không
  công bằng cho xếp hạng. Trong đội thì đó lại là TÍNH NĂNG ("nó chơi bàn này
  ra +24%, tao chơi thử") — nên bảng đội hiện NAV người khác **CHỈ SAU KHI mình
  chốt xong bàn** (khuôn A3.1: thấy sau khi đã đặt).
- **Hạn 24h**, một người một lần mỗi bàn (UNIQUE `(ban_ma, user_id)`), mã do
  server phát (chặn seed tuỳ ý — luật `MAN_TAP_SEED` D50).
- Khách CHƠI NGAY vào được (D64/D89) — người được rủ chưa có tài khoản là đúng
  người cần cửa này. Bảng đội hiện handle khách dạng "KHÁCH·a3f9".
- Cổng pháp lý A10: mời TRONG vòng quen biết là điều bro đã làm bằng tay; đây
  chỉ là đường link cho việc đó. Không quảng bá công khai mã bàn.

## 3. UI (đúng khuôn sảnh hôm nay)
- Card TẠO PHÒNG → **"RỦ BẠN CÙNG BÀN"** (mở khoá): bấm ⇒ tạo mã + hai nút
  CHIA SẺ LINK / SAO CHÉP MÃ (dùng chung với thẻ kết trận, xem
  `man-ket-de-khoe.md` §2.3) ⇒ vào trận ngay.
- Ô **NHẬP MÃ BÀN** ngay dưới (5 ký tự) + link `/ban/<mã>` mở thẳng.
- Trong trận: dải đối thủ có thêm ghế **"@bạn (đội)"** vẽ khác bot (D25/R3: bot
  lộ mặt bot, người là người) — NAV vòng N của bạn hiện nếu bạn đã qua vòng N.
- Màn kết: khối **ĐỘI CỦA BẠN** — avatar + NAV + hạng trong bàn, người chưa
  xong ghi "đang chơi…"; nút "GỬI KẾT QUẢ CHO ĐỘI" = share thẻ.

## 4. Câu chờ founder
**Q1** Đi A (bàn chung theo seed) mùa này, B để mùa sau? · **Q2** Trần đội 4?
· **Q3** Khách không tài khoản được vào đội? (đề xuất CÓ) · **Q4** Người vào
sau có được thấy NAV người trước TRƯỚC khi chơi không? (đề xuất KHÔNG — thấy
sau khi chốt bàn, giữ "cùng đề mù").

## 5. Bổ sung cùng tối 16/08 — PHÒNG CHỜ (đã thi công, `PhongCho.tsx`)
Founder: *"bàn chung còn là kiểu mời anh em vào tìm trận chung; tạo lobby tìm
trận ở chế độ rank đi chứ bấm phát vào trận luôn thì hơi không quen."*
- Mọi cửa vào trận ở sảnh (VÀO BÀN · TÌM TRẬN rank · RỦ BẠN → VÀO BÀN NÀY /
  nhập mã / link mời) đi qua **phòng chờ** ba pha: TÌM (1,6s, HUỶ được, CHƯA
  tạo trận) → LỘ (`POST /matches`, ghế lộ 350ms/ghế từ `doi_thu` server) → SẴN
  (VÀO BÀN hoặc tự vào sau 3s). Ghế BẠN ngồi sẵn từ đầu.
- **Thật thà:** mùa Beta không có hàng đợi người thật — ghế máy lộ mặt là MÁY
  (D25/R3), chữ nói thẳng "ghép với máy". Không giả vờ "đang có người vào".
- **Bàn chung** trong phòng chờ hiện khối ĐỘI (ai đã vào mã · đang chơi/xong,
  số của người khác vẫn theo A3.1 server) + RỦ THÊM · CHIA SẺ LINK; nhãn số ô
  đọc từ bàn (server), không từ nút cỡ đang chọn ở sảnh.
- Lỗi tạo trận hiện câu của máy chủ ngay trong phòng chờ (khách bấm rank ⇒
  `khach_khong_xep_hang`); `chua_dong_y` ⇒ về sảnh mở khối đồng ý; 409
  `da_vao_ban` ⇒ về trận cũ. Màn tập vào thẳng. Nhịp `NHIP_PHONG_CHO` PLAYTEST-TUNE.
- Không đổi API/engine/data. Ghép người thật (rank toàn người thật, D31) khi
  mở sẽ dùng đúng cái vỏ này — pha TÌM lúc đó là chờ thật.
