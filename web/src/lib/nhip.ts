/**
 * NHỊP TRÌNH DIỄN — nguồn chân lý DUY NHẤT cho mọi thời lượng hiệu ứng.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * VÌ SAO FILE NÀY TỒN TẠI
 *
 * Founder 25/07: "hiệu ứng lật thẻ bài hay hiệu ứng trên ảnh diễn ra hơi nhanh
 * quá chưa kịp cảm nhận."
 *
 * Trước đó thời lượng nằm ở BA nơi không ai biết nhau: hằng số JS trong
 * component, `setTimeout` gõ tay giữa hàm, và `animation: … 0.52s` trong CSS.
 * Hậu quả đo được: `AlphaDraftMatch` chờ 700ms trong khi animation nhịp-tim nó
 * chờ dài 2.550ms (0,85s × 3) → hoạt hình bị CẮT giữa nhịp. Cùng lớp lỗi ở cú
 * nháy đỏ cháy tài khoản (chờ 520ms / animation 340ms + 500ms).
 *
 * Nay: số nằm ở đây, CSS đọc qua biến `--nhip-*`, JS đọc qua `NHIP.*`. Một chỗ
 * sửa, hai tầng đổi cùng nhau, không lệch được nữa.
 *
 * ⚠ LUẬT: cấm gõ `setTimeout(…, 620)` hay `animation: x 0.5s` trong module mới.
 * Cần nhịp mới thì thêm khoá vào đây trước.
 */

/**
 * Thời lượng (ms). Đã NỚI RỘNG so với bản 20/07 để kịp cảm nhận — con số cũ ghi
 * trong ngoặc để thấy hướng đổi.
 */
export const NHIP = {
  /** Ô giai đoạn lật mặt (cũ 380–520). */
  LAT_O: 900,
  /** Ô SỰ KIỆN lật — nặng hơn giai đoạn, phải cảm được là tin tức. (cũ 760) */
  LAT_SU_KIEN: 1500,
  /** Sóng xung kích toả ra từ ô sự kiện. (cũ 720) */
  SONG_XUNG_KICH: 1100,

  /**
   * Cửa sổ CHẶN dây chuyền trong lúc ô đang lật. Phải ≥ LAT_SU_KIEN, nếu không
   * bảng "VÌ SAO" đè lên đúng lúc lá đang quay và người chơi mất cả hai.
   */
  CUA_SO_LAT: 1600,

  /** Một mắt xích thường đáp xuống. (cũ 260) */
  MAT_XICH: 420,
  /** Mắt xích NHÂN (Đòn Bẩy) — cao trào, chậm hơn hẳn. (cũ 440) */
  MAT_XICH_NHAN: 760,

  /**
   * Nhịp kể dây chuyền: ms giữa hai mắt xích.
   * "Thắng ỒN, thua NHANH" giữ nguyên triết lý — trận 8 vòng thua 5–6 lần là
   * bình thường, nghi lễ thua dài = trừng phạt lặp lại = bỏ bàn. Nhưng bản cũ
   * lỗ 85ms thì nhanh tới mức KHÔNG ĐỌC ĐƯỢC, tức là thua mà không biết vì sao.
   */
  KE_LAI_NEN: 340,
  /** Cộng thêm theo độ đậm của cú lãi (0 → +KE_LAI_DAM ms). */
  KE_LAI_DAM: 260,
  /** Nhịp khi lỗ — vẫn nhanh hơn lãi, nhưng đủ đọc. (cũ 85) */
  KE_LO: 210,

  /** Khoảnh khắc lớn (DỒN HẾT VỐN / ×2) hiện bao lâu. (cũ 1150) */
  KHOANH_KHAC_HIEN: 1700,
  /** …rồi tắt trong bao lâu. (cũ 300) */
  KHOANH_KHAC_TAT: 420,

  /** Băng-rôn tin tức quét ngang màn. (cũ 2200/1500) */
  BANG_RON: 2600,

  /** Nhịp tim trước khi dồn hết vốn — 3 nhịp, phải bằng animation. */
  NHIP_TIM_MOT: 850,
  NHIP_TIM_SO_LAN: 3,

  /** Cú nháy đỏ khi cháy tài khoản. */
  NHAY_DO: 900,

  /** Tự nộp vòng khi đã dồn hết vốn (chỉ ngồi xem board chạy). (cũ 1400) */
  TU_NOP_VONG: 2000,

  /**
   * NHỊP THỞ của đèn báo (chấm "có hàng mới", huy hiệu chờ xử lý).
   * Chậm có chủ đích: đèn báo nhấp nhanh thì tranh chú ý với viền GẤP GIỜ,
   * mà hai thứ nhấp cùng nhịp thì không cái nào còn nghĩa (D119).
   */
  THO: 1500,
  /**
   * ĐÀN CHIP BAY từ hàng chip lên lá — thời lượng của chip ĐẦU TIÊN.
   *
   * ⚠ Đây là con số DÙNG CHUNG giữa JS và CSS: `bayChip()` lấy nó làm thời
   * lượng, còn cọc đích (`CocChip .cho/.khg`) lấy nó làm ĐỘ TRỄ xuất hiện.
   * Hai bản riêng sẽ trôi, và cú trôi biểu hiện đúng bằng lỗi đang sửa: chip
   * lao về một cái cọc đã mọc sẵn.
   */
  CHIP_BAY: 260,
  /** Thẻ trong danh mục bị sự kiện đánh trúng — rung/sáng. */
  THE_TRUNG_DON: 900,
  /**
   * 12/09 (Q3) — MỘT NHỊP của dải thị trường (`DaiThiTruong`). D398: lá ĐỨNG YÊN
   * (founder 24/09: "cứ lên xuống rối mắt quá") — nay là nhịp huy hiệu mũi tên BẬT ra
   * `steps(3)`; nhóm ngược chiều chính bật nhịp THỨ HAI = trễ đúng một NHICH_LA.
   * Huy hiệu cái kéo sáng theo `THO`. Tên giữ nguyên: biến CSS `--nhip-nhich-la` đọc nó.
   */
  NHICH_LA: 360,
  /**
   * 12/09 — CHIA VAI đầu trận (`ChaoVai` pha 1): mỗi ghế nhận một lá vai cách nhau
   * một nhịp (cùng cỡ với `NHIP_PHONG_CHO.MOI_GHE`), lá cuối là mình; giữ thêm
   * CHIA_VAI_GIU rồi mới sang "VAI CỦA BẠN". Founder 12/09: bàn tập đi thẳng vào
   * trận nên chưa có khoảnh khắc nào cho thấy CẢ BÀN được chia vai.
   */
  CHIA_VAI: 350,
  CHIA_VAI_GIU: 700,
  /**
   * D343 — THANH PHONG CÁCH BẬT ĐÈN: đủ vòng thì thanh xám bò tới điểm thật rồi mới
   * sáng, bập bùng như bóng neon trước khi cháy hẳn. CSS `pcBatDen` và cái hẹn JS gỡ
   * lớp `.batDen` đọc CÙNG số này — hẹn ngắn hơn là cắt nhịp giữa chừng.
   */
  BAT_DEN_PHONG_CACH: 600,
  /**
   * D400 — KHOẢN NỔI (lãi/lỗ từng khoản kiểu scrolling combat text, bước LÃI/LỖ). Founder 24/09: *"hiệu ứng
   * Scrolling phải Ease In-Out, Freeze Frame (Khựng) và Spacing/Queue (Xếp hàng đẩy nhau)"*.
   * · CÁCH — hộp kế vào sau hộp trước bao lâu (đủ để mắt đọc xong một dòng ngắn trước khi hàng bị đẩy).
   * · SONG — vòng đời một hộp: vào ease-in-out ~15% → KHỰNG tới ~70% → trôi lên mờ đi. CSS `khoanNoiLen`.
   * · DAY — cú đẩy lên một nấc khi hộp mới vào (transition ease-in-out). CSS `.khoanNoiDay`.
   */
  KHOAN_NOI_CACH: 420,
  KHOAN_NOI_SONG: 2200,
  KHOAN_NOI_DAY: 240,
  /**
   * D401 — GIẢI VÒNG (bước CHIA QUỸ của nhịp kết quả, trước khi lá lật). Founder 24/09 chốt A: *"ở bước chia quỹ
   * (trước khi lật lá), xu từ các ghế bay vào giải. Tới bước LÃI/LỖ, hộp "Ăn chia cược" bay ra từ chính cái giải đó"*.
   * · XU_VAO_GIAI — một viên xu bay từ ghế lên hộp GIẢI (quãng dải ghế → hàng HUD, dài gấp đôi quãng chip Shop).
   * · XU_CACH_GHE — ghế kế thả xu sau ghế trước bao lâu (thác trái → phải theo dải ghế).
   * · XU_CACH_XU — các viên của CÙNG một ghế (ghế góp nhiều hơn nền thả 2–3 viên) cách nhau bao lâu.
   * · GIAI_GIU — viên cuối đáp xong, giữ bao lâu để đọc con số giải trước khi mắt rời sang lá.
   * · GIAI_NAY — hộp GIẢI nảy một nhịp mỗi lần một ghế đáp (`steps` — vật, không phải ánh sáng).
   * · GIAI_SANG — quầng vàng thở MỘT lần khi giải đủ (ánh sáng ⇒ ease-in-out). CSS `.sang::after`.
   * · GIAI_TRA_BAY — hộp "Ăn chia cược" rơi từ GIẢI xuống chỗ của nó trong hàng khoản nổi. ⚠ Cùng số với mốc đáp
   *   25% của `khoanNoiRaGiai` (motion.module.css) × KHOAN_NOI_SONG — bài canh `giai_vong.test.tsx` đối chiếu.
   */
  XU_VAO_GIAI: 520,
  XU_CACH_GHE: 80,
  XU_CACH_XU: 30,
  GIAI_GIU: 300,
  GIAI_NAY: 160,
  GIAI_SANG: 720,
  GIAI_TRA_BAY: 550,
  /**
   * D402 — GIẢI TRẢ VỀ GHẾ (bước LÃI/LỖ, cùng lúc giải cạn). Founder 24/09: *"TRẢ giải về 3 ghế đầu cùng nhịp LÃI/LỖ"*.
   * · GIAI_TRA_CACH — ghế hạng kế nhận sau ghế hạng trước bao lâu (trả theo HẠNG 1 → 2 → 3, không theo dải — thứ tự
   *   trao giải là thông tin). Gấp đôi XU_CACH_GHE: thác nộp là một đám đông, trả giải là từng người được xướng tên.
   * · GIAI_NOI_SONG — vòng đời nhãn "hạng · +tiền" nổi trên ghế nhận: bật lên → đứng đọc → trôi mờ.
   */
  GIAI_TRA_CACH: 160,
  GIAI_NOI_SONG: 1500,
  /* ── PFM (Đợt 1 — màn SỔ/HŨ/GƯƠNG). Bảng §B7 của kế hoạch 04/09. ── */
  /** Tấm trượt đáy mở/đóng. */
  PFM_TAM: 260,
  /** Số tiền bay từ tấm ghi xuống đầu danh sách. */
  PFM_BAY: 320,
  /** Dòng mới đáp xuống danh sách. */
  PFM_DAP: 340,
  /** Một ô LED sáng lên (thanh tiến độ hũ, dải nhịp 30 ngày). */
  PFM_LED: 60,
  /** Con dấu niêm phong tuần đóng xuống. */
  PFM_DAU: 420,
  /* ── PFM NGÀY ĐẦU (GIAI ĐOẠN A — D355/D356). Bảng `--nhip-*` của demo
     `docs/ui-ux/demo/pfm-ngay-dau.html`. Tên riêng tiền tố `ND` (Ngày Đầu) — CỐ Ý không
     dùng chung `--nhip-tho` đã có (1500ms, nhịp thở của đèn báo/huy hiệu chờ xử lý):
     demo đòi 2600ms cho nút chính, và đổi giá trị của `--nhip-tho` sẽ âm thầm đổi nhịp
     thở của MỌI chỗ khác đang dùng nó — ngoài phạm vi màn này. */
  /** Nút lún khi bấm (nhịp máy, `steps()` — pixel.module.css). */
  PFM_ND_LUN: 90,
  /** Khối/chip vừa "bật" ra (mẫu mới, việc vừa xong…) — vật lý, nảy quá rồi co lại. */
  PFM_ND_NAY: 340,
  /** Đổi bước (chân dung → ba việc): khối trượt lên có nảy. */
  PFM_ND_VAO: 380,
  /** Thanh hiểu / thanh hũ đầy lên có vượt rồi co lại. */
  PFM_ND_DAY: 620,
  /** Nút chính thở (glow nhẹ, vô hạn) — RIÊNG với `--nhip-tho` (khác nghĩa, khác số). */
  PFM_ND_THO: 2600,
  /** Hạt pixel phụt khi bấm nút chính (`lib/hat_pixel.ts`). */
  PFM_ND_HAT: 560,
  /**
   * KẾT TOÁN LẬT LÁ (tệp 15 lát 1 bản 2): lá vị thế lật 180° từ "điều đã đặt" sang "kết quả" — chuyển động VẬT LÝ
   * (`cubic-bezier` nảy, `LaKetToan.module.css`), đủ chậm để mắt thấy mặt sau hiện ra, đủ nhanh để không chờ.
   */
  PFM_LAT_LA: 560,
  /**
   * HẤP THỤ (D410 — khay phân bổ tối ở màn HŨ): tờ tiền co lại thành một hạt sáng rồi bay vút vào thanh đo của hũ
   * đang chọn. Chuyển động VẬT LÝ (co có nảy · bay có gia tốc) ⇒ `cubic-bezier`. Cú loé ở mốc mới và cú chạy số bắt
   * đầu đúng lúc hạt TỚI — cả hai hẹn giờ theo CHÍNH số này, không chờ `onfinish` (khung ẩn thì `onfinish` có thể
   * không bao giờ tới, mà con số thì phải tới).
   */
  PFM_HAP_THU_BAY: 560,
  /** Thanh đo loé ở điểm mốc mới khi hấp thụ — ÁNH SÁNG ⇒ `ease-out`, chỉ `opacity`/`transform`. */
  PFM_HAP_THU_LOE: 420,
  /** Số đã góp chạy từ số cũ lên số mới (count-up) sau cú hấp thụ. */
  PFM_DEM_SO: 700,
  /**
   * D420 — BÀN TIỀN THU XUỐNG khi chạm ra ngoài (founder: *"ẩn bàn phím xuống dưới để user có không gian nhìn"*) và
   * TRỒI LÊN khi chạm thanh "▲ GHI TIỀN". Chuyển động VẬT LÝ ⇒ `cubic-bezier`: xuống có gia tốc, lên có nảy — lên lâu
   * hơn xuống vì cú nảy cần chỗ. Hẹn giờ theo CHÍNH hai số này để đổi bố cục đúng lúc hình dừng.
   */
  PFM_BAN_THU: 190,
  PFM_BAN_MO: 280,
  /** D420 — quy tắc tự chia nhiều hũ: hạt thứ n bay trễ n × số này, thành một chuỗi "tách tách" chứ không một cục. */
  PFM_TU_CHIA_CACH: 150,
  /**
   * D426 — BIỂU ĐỒ: cột thứ n mọc trễ n × số này (cột/khúc mọc bằng `--nhip-nd-day`, back-ease-out). Một tháng 31 cột ⇒
   * sóng cột chạy ~0,7 s từ trái sang phải; dùng `PFM_LED` (60ms) thì 1,9 s — người xem chờ, không phải xem.
   */
  PFM_BD_CACH: 22,

  /**
   * D432 — MÀN CHỌN của shop: chọn LÕI xong thì chờ lá kịp "búng" lên (`.sel` → `adChonLa`) rồi mới sang BÀN CƯỢC.
   * Ngắn hơn là màn đổi trước khi mắt thấy cú chọn; dài hơn là người chơi tưởng chưa nhận.
   */
  CHON_XONG_SANG_BAN: 480,

  /**
   * D442 — NỀN BÀN THẺ ĐỔI THEO XU HƯỚNG (founder 27/09 tối, đặc tả ba trạng thái). `MT_DOI` = chuyển giữa đi ngang ·
   * đi lên · đi xuống: đặc tả đòi 0,5 s ease-in-out, "không đổi màu đột ngột". `MT_QUET` = một chu kỳ vệt lóe đi lên
   * (đặc tả: mỗi 3–5 s). `MT_THO` = quầng viền thở. `MT_LUA` = ánh lửa bập bùng đi xuống. `MT_TRO` = một hạt tro bay
   * từ chân bàn lên rồi tan — rất chậm, đặc tả đòi "tốc độ bay rất chậm".
   */
  MT_DOI: 500,
  MT_QUET: 4200,
  MT_THO: 3200,
  MT_LUA: 2600,
  MT_TRO: 9000,
  /**
   * D442 lượt 2 (founder xem ảnh: *"Tăng độ đậm đi hoặc làm màu hiệu ứng sáng hơn 1 tý (Kiểu tăng giảm cường độ sáng chậm
   * rãi và chỉ shake khi có thay đổi)"*). `MT_SANG` = một chu kỳ sáng lên rồi dịu xuống của nền đi lên / đi xuống — chậm
   * để đọc ra "nhịp thở" chứ không ra nhấp nháy. `MT_RUNG` = cú rung mặt bàn đúng lúc trạng thái ĐỔI (VFX §3: rung cực
   * ngắn 0,1–0,15 s + một nhịp tắt dần).
   */
  MT_SANG: 5200,
  MT_RUNG: 150,
  /**
   * D588 — CHUYỂN CẢNH bàn ↔ màn minigame (founder 11/10: *"chuyển tiếp từ màn chính sang màn mini-game chưa mượt"*). `MAN_VAO` =
   * lớp màn hiện dần + khung điện thoại trồi lên có nảy; `THE_VAO_MAN` = lá vừa lật trên bàn nhấc lên bay vào ô "VÒNG N" của màn
   * (dài hơn `MAN_VAO` một nhịp để lá đáp SAU khi khung đã đứng — mắt theo lá, không theo khung); `MAN_RA` = khung hạ + mờ trước khi
   * về bàn (ngắn: rời đi phải nhanh hơn bước vào).
   */
  MAN_VAO: 420,
  THE_VAO_MAN: 600,
  MAN_RA: 260,

  /*
   * ── HUB TẦNG KHÔNG GIAN (SPEC `ui-tang-khong-gian`, demo `hub-tang-khong-gian.html`) ─────────────────────────────
   * Màn không cuộn ⇒ cảm giác bấm là tất cả. Luật phản hồi chạm (founder 10–11/10): nhấn = LÚN 3px tức thì (≤ 0,05 s) ·
   * thả = NẢY về · nút chính phụt hạt rồi MỚI chuyển màn · giữ 0,45 s = thanh nạp · ô khoá lắc · lớp trượt trồi có nảy.
   * Nảy / trồi là chuyển động VẬT LÝ (`cubic-bezier` ở `motion.module.css`); lún là NHỊP MÁY (tức thì, không trượt).
   */
  /** Ngưỡng nhấn-lún (ms) — CSS lún tức thì; số này để bài canh khoá "≤ 0,05 s". */
  HUB_LUN: 50,
  /** Thả tay: ô nảy về chỗ cũ (vượt rồi co lại). */
  HUB_THA_NAY: 260,
  /** Giữ ô đi-thẳng này lâu thì bung thông tin (thanh nạp chạy đầy trong chính từng ấy). */
  HUB_GIU: 450,
  /** Lớp trượt trồi lên / xuống (có nảy). Hẹn gỡ khỏi DOM đọc CHÍNH số này. */
  HUB_TAM: 320,
  /** Nền tối mờ sau lớp trượt. */
  HUB_MAN_TOI: 180,
  /** Nút chính: hạt phụt xong 0,12 s mới đổi màn — đủ để mắt thấy hạt, không đủ để thấy chờ. */
  HUB_NUT_TRE: 120,
  /** Ô khoá lắc ngang rồi mới bung lý do. */
  HUB_LAC: 160,
  /** Banner ô Đấu trường đổi cảnh (founder 11/10: 7 s → 10 s). */
  HUB_BANNER: 10_000,
  /** Hai cảnh banner chuyển MỜ vào nhau. */
  HUB_BANNER_MO: 900,
  /** Dòng chữ banner mờ đi rồi đổi nội dung rồi hiện lại. */
  HUB_BANNER_CHU: 350,

  /*
   * ── PFM TẦNG KHÔNG GIAN (SPEC `pfm-tang-khong-gian`, demo `pfm-tang-khong-gian.html`) ─────────────────────────────
   * Bốn tab không cuộn: đổi tab là màn lướt ngang; ô vào so le; biểu đồ mọc; hũ nạp có xu rơi, mực dâng có vượt. Nhịp CŨ dùng
   * lại nguyên (PFM_ND_VAO ô vào · PFM_ND_DAY cột/mực mọc · PFM_BD_CACH so le cột · PFM_BAY tờ bay); dưới đây chỉ là nhịp MỚI.
   * Phần tử tạm (tờ bay · xu · hạt) dọn bằng HẸN GIỜ theo các số này, không bằng `onfinish` (khung ẩn thì `onfinish` không tới).
   */
  /** Đổi tab: màn mới lướt ngang vào (chuyển động VẬT LÝ, ease-out mạnh). */
  PFM_TAB_LUOT: 340,
  /** Hai ô liền nhau vào cách nhau bao lâu (so le, `ndVaoLen`). */
  PFM_O_CACH: 45,
  /** Vòng "tiền vào đi đâu" quét mở dần (ngoại lệ đã duyệt: `--quet` không phải transform/opacity). */
  PFM_QUET: 760,
  /** SAO THỔ mỗi lần dựng THẺ: cầu rơi xuống · vành quét vào · tên hiện · rồi phụt hạt sao. */
  PFM_SAO_CAU: 600,
  PFM_SAO_VANH: 520,
  PFM_SAO_HAT_TRE: 820,
  PFM_SAO_HAT_DON: 480,
  /** Tờ tiền chạm khay thì tổng ở khay NHẢY một nhịp máy (`steps(3)`). */
  PFM_KHAY_NHAY: 240,
  /** Xu rơi vào miệng hũ: một viên rơi bao lâu · viên kế trễ bao nhiêu · số viên mỗi cú nạp. */
  PFM_XU_ROI: 300,
  PFM_XU_CACH: 70,
  PFM_XU_SO: 4,
} as const;

/** Tổng thời lượng nhịp tim, để JS chờ ĐÚNG bằng animation chứ không cắt giữa. */
export const NHIP_TIM_TONG = NHIP.NHIP_TIM_MOT * NHIP.NHIP_TIM_SO_LAN;

/*
 * ═══ NHỊP KẾT QUẢ MỘT HÀNG (D398) ═══════════════════════════════════════════════════════════
 * Founder 24/09: *"hiện tại chúng ta có hiệu ứng nhưng chúng đang bị giẫm chân nhau, nên chia thứ
 * tự rõ ràng và áp luôn quy tắc cho sau này: Chốt vòng > Chia quỹ vòng > Thẻ bài lật > Lãi lỗ (Bản
 * cải tiến) Nhảy > Thanh chấm điểm phong cách và lửa monument thay đổi"* — và *"đừng làm quá nhiều
 * hiệu ứng khác nhau cùng 1 khoảng thời gian ngắn, ko ai thấy được cùng lúc đâu"*.
 *
 * Đo trước khi sửa (màn trận thật, 375px): ở t = 0 lá bắt đầu lật, CÙNG LÚC NAV · tiền mặt · dải ghế ·
 * thanh phong cách nhảy số và băng tin bung ra; tới 1,6 s dải 6 mã nhích ngay DƯỚI băng tin đang
 * che nó. Năm thứ tranh một khoảnh khắc ⇒ không thứ nào được nhìn.
 *
 * ⚠ LUẬT (A11.26 · docs/ui-ux/01-vfx-game-feel.md §2.7):
 *  · Mỗi BƯỚC một tiêu điểm; bước sau chỉ mở khi bước trước diễn xong — thời lượng lấy từ `NHIP`.
 *  · Hiệu ứng MỚI của nhịp kết quả phải khai vào đúng MỘT bước ở đây TRƯỚC khi viết.
 *  · Bước chưa có hiệu ứng = 0 ms: đi thẳng, không bắt người chơi chờ một khoảng trống.
 *  · Giảm chuyển động: GIỮ THỨ TỰ, bỏ thời lượng (mọi bước 0 ms).
 */
/** Các bước theo đúng thứ tự founder; `tin` và `thi_truong` là hai nhịp con của "Thẻ bài lật". */
/*
 * D442 lượt 3 (founder 28/09: *"Cẩn thận bị quá tải hiệu ứng, phân thứ tự xuất hiện hay thời gian của tất cả các hiệu ứng
 * từ sau khi bấm chốt vòng"*) — `moi_truong`: nền bàn thẻ đổi màu + rung, MỘT tiêu điểm riêng, NGAY SAU lá lật và băng tin
 * (lá lật là cái GÂY ra đổi xu hướng), TRƯỚC khi dải sáu mã phản ứng. Chỉ có mặt khi xu hướng THẬT SỰ đổi; không đổi = 0 ms.
 */
export const BUOC_KET_QUA = ['chia_quy', 'lat_la', 'tin', 'moi_truong', 'thi_truong', 'lai_lo', 'phong_cach', 'xong'] as const;
export type BuocKetQua = typeof BUOC_KET_QUA[number];
/** Bước thuộc PHA nào trong câu của founder — để bài canh đối chiếu thứ tự với đúng câu ấy. */
export const PHA_CUA_BUOC: Record<BuocKetQua, 'chia_quy' | 'the_bai_lat' | 'lai_lo' | 'phong_cach' | 'xong'> = {
  chia_quy: 'chia_quy',
  lat_la: 'the_bai_lat',
  tin: 'the_bai_lat',
  moi_truong: 'the_bai_lat',
  thi_truong: 'the_bai_lat',
  lai_lo: 'lai_lo',
  phong_cach: 'phong_cach',
  xong: 'xong',
};
/** Khoảng lặng giữa hai bước — đủ để mắt rời tiêu điểm cũ trước khi tiêu điểm mới bật. */
export const NGHI_BUOC_KQ = 240;
/** Nhịp LÃI/LỖ: NAV chạy số (8 × 40 ms) + thời gian đọc con số trước khi thanh phong cách đổi. */
export const LAI_LO_KQ = 1100;
/**
 * D400 — trần số hộp khoản nổi một vòng (quá thì gộp đuôi thành "Khoản khác" — `khoanNoiCuaVong`). Sáu hộp là
 * vừa cột nhìn được trên màn 375px mà cả chuỗi (tin + chia quỹ + hàng hộp) vẫn dưới 15 s pha ĐỌC.
 */
export const KHOAN_NOI_TOI_DA = 6;
/** Hàng `n` hộp diễn xong sau bao lâu: hộp cuối vào ở (n−1)·CÁCH, sống trọn SONG. */
export function thoiLuongKhoanNoi(n: number): number {
  const k = Math.min(Math.max(0, n), KHOAN_NOI_TOI_DA);
  return k === 0 ? 0 : (k - 1) * NHIP.KHOAN_NOI_CACH + NHIP.KHOAN_NOI_SONG;
}

/** D401 — trần số viên xu MỘT ghế thả vào giải (cùng trần 3 của chip Shop: số nhiều nói bằng CON SỐ, không bằng đàn). */
export const XU_TOI_DA_MOI_GHE = 3;
/**
 * D401 — bước CHIA QUỸ dài bao lâu khi `soGhe` ghế nộp xu: ghế cuối thả sau (n−1)·CÁCH_GHẾ, viên thứ ba của nó bay
 * trễ thêm 2·CÁCH_XU, bay trọn XU_VAO_GIAI, rồi giữ GIAI_GIU cho mắt đọc con số + một khoảng lặng trước khi lá lật.
 * 0 ghế ⇒ 0 ms (không có gì để nộp thì không bắt chờ khoảng trống — luật 3 §2.7).
 */
export function thoiLuongChiaQuy(soGhe: number): number {
  const n = Math.max(0, Math.floor(soGhe));
  return n === 0 ? 0 : (n - 1) * NHIP.XU_CACH_GHE + (XU_TOI_DA_MOI_GHE - 1) * NHIP.XU_CACH_XU
    + NHIP.XU_VAO_GIAI + NHIP.GIAI_GIU + NGHI_BUOC_KQ;
}

/** D402 — số viên xu giải bay về một ghế theo HẠNG nhận: hạng 1 ba viên, hạng 2 hai viên, còn lại một viên. */
export function xuTraTheoHang(hang: number): number {
  return hang <= 1 ? XU_TOI_DA_MOI_GHE : hang === 2 ? 2 : 1;
}
/** D402 — hộp khoản nổi thứ `i` (0-based) vào hàng lúc nào, tính từ đầu bước LÃI/LỖ — đúng nhịp đếm của `KhoanNoi`. */
export function mocKhoanNoiVao(i: number): number {
  return Math.max(0, i) * NHIP.KHOAN_NOI_CACH;
}
/**
 * D402 — cú TRẢ GIẢI về `soGhe` ghế diễn xong sau bao lâu kể từ lúc giải cạn: ghế hạng cuối bắt đầu sau
 * (n−1)·GIAI_TRA_CACH, viên chót của nó trễ thêm tối đa 2·XU_CACH_XU, bay trọn XU_VAO_GIAI, rồi nhãn sống trọn
 * GIAI_NOI_SONG. 0 ghế ⇒ 0.
 */
export function thoiLuongTraGiai(soGhe: number): number {
  const n = Math.max(0, Math.floor(soGhe));
  return n === 0 ? 0 : (n - 1) * NHIP.GIAI_TRA_CACH + (XU_TOI_DA_MOI_GHE - 1) * NHIP.XU_CACH_XU
    + NHIP.XU_VAO_GIAI + NHIP.GIAI_NOI_SONG;
}

export interface BuocLich { buoc: BuocKetQua; batDau: number; ms: number }

/**
 * Lịch của MỘT lần kết quả về: mỗi bước bắt đầu khi bước trước kết thúc.
 * `soGheNop` — D401: số ghế thả xu vào GIẢI ở bước chia quỹ (`gheNopCuaVong`); 0/vắng ⇒ bước 0 ms.
 * `coTin` — ô vừa lật là tin, hoặc tin cũ vừa lộ giả ⇒ có băng tin.
 * `soKhoan` — D400: số hộp khoản nổi của vòng; bước LÃI/LỖ chờ đủ cho hàng hộp diễn xong.
 * `traGiai` — D402: giải trả về `soGhe` ghế, bắt đầu `luc` ms sau đầu bước LÃI/LỖ (lúc hộp "Ăn chia cược" rời giải, hoặc
 *   0 khi mình không được chia); bước LÃI/LỖ chờ đủ cho cú trả diễn xong.
 */
export function lichKetQua(o: {
  soGheNop?: number; coTin: boolean; giamChuyenDong: boolean; soKhoan?: number;
  traGiai?: { luc: number; soGhe: number };
  /** D442 — xu hướng (nền bàn thẻ) đổi ở vòng này ⇒ bước `moi_truong` có mặt: đổi màu + rung + khoảng lặng. */
  doiMoiTruong?: boolean;
}): BuocLich[] {
  const ms: Record<BuocKetQua, number> = {
    chia_quy: thoiLuongChiaQuy(o.soGheNop ?? 0),
    lat_la: NHIP.CUA_SO_LAT,
    tin: o.coTin ? NHIP.BANG_RON + NGHI_BUOC_KQ : 0,
    moi_truong: o.doiMoiTruong ? NHIP.MT_DOI + NHIP.MT_RUNG + NGHI_BUOC_KQ : 0,
    thi_truong: 2 * NHIP.NHICH_LA + NGHI_BUOC_KQ,
    lai_lo: Math.max(
      LAI_LO_KQ, thoiLuongKhoanNoi(o.soKhoan ?? 0),
      // + một khoảng lặng: mốc `luc` tính theo nhịp đếm của hàng hộp — dưới tải nó trễ vài trăm ms (soi màn 24/09: hai
      // nhãn cuối bị cắt khi bước PHONG CÁCH mở).
      o.traGiai && o.traGiai.soGhe > 0 ? o.traGiai.luc + thoiLuongTraGiai(o.traGiai.soGhe) + NGHI_BUOC_KQ : 0,
    ),
    phong_cach: NHIP.BAT_DEN_PHONG_CACH + NGHI_BUOC_KQ,
    xong: 0,
  };
  let t = 0;
  return BUOC_KET_QUA.map((buoc) => {
    const d = o.giamChuyenDong ? 0 : ms[buoc];
    const r = { buoc, batDau: t, ms: d };
    t += d;
    return r;
  });
}

/** Đã tới (hoặc qua) bước `b` chưa — so theo thứ tự trong `BUOC_KET_QUA`. */
export function daToiBuoc(hienTai: BuocKetQua, b: BuocKetQua): boolean {
  return BUOC_KET_QUA.indexOf(hienTai) >= BUOC_KET_QUA.indexOf(b);
}

/**
 * Bơm nhịp vào CSS dưới dạng biến `--nhip-*`.
 *
 * ⚠ Vì sao đi qua biến CSS chứ không set `style.animationDuration`:
 * `*.module.css` bị CSS Modules ĐỔI TÊN animation, nên không thể gõ lại
 * `animation: latO …` ở nơi khác (đã chết 20 khai báo/12 file ngày 20/07, có
 * lint `lint:css-anim` canh). Biến CSS thì KHÔNG bị đổi tên → đây là đường duy
 * nhất để TS điều khiển thời lượng của keyframes dùng chung.
 *
 * Gọi MỘT lần lúc khởi động app (main.tsx).
 */
export function capNhipVaoCss(root: HTMLElement = document.documentElement): void {
  const ms = (n: number) => `${n}ms`;
  root.style.setProperty('--nhip-lat-o', ms(NHIP.LAT_O));
  root.style.setProperty('--nhip-tho', ms(NHIP.THO));
  root.style.setProperty('--nhip-chip-bay', ms(NHIP.CHIP_BAY));
  root.style.setProperty('--nhip-lat-su-kien', ms(NHIP.LAT_SU_KIEN));
  root.style.setProperty('--nhip-song-xung-kich', ms(NHIP.SONG_XUNG_KICH));
  root.style.setProperty('--nhip-mat-xich', ms(NHIP.MAT_XICH));
  root.style.setProperty('--nhip-mat-xich-nhan', ms(NHIP.MAT_XICH_NHAN));
  root.style.setProperty('--nhip-bang-ron', ms(NHIP.BANG_RON));
  root.style.setProperty('--nhip-nhip-tim', ms(NHIP.NHIP_TIM_MOT));
  root.style.setProperty('--nhip-nhay-do', ms(NHIP.NHAY_DO));
  root.style.setProperty('--nhip-the-trung-don', ms(NHIP.THE_TRUNG_DON));
  root.style.setProperty('--nhip-nhich-la', ms(NHIP.NHICH_LA));
  root.style.setProperty('--nhip-chia-vai', ms(NHIP.CHIA_VAI));
  root.style.setProperty('--nhip-bat-den-phong-cach', ms(NHIP.BAT_DEN_PHONG_CACH));
  root.style.setProperty('--nhip-khoan-noi-song', ms(NHIP.KHOAN_NOI_SONG));
  root.style.setProperty('--nhip-khoan-noi-day', ms(NHIP.KHOAN_NOI_DAY));
  root.style.setProperty('--nhip-giai-sang', ms(NHIP.GIAI_SANG));
  root.style.setProperty('--nhip-pfm-tam', ms(NHIP.PFM_TAM));
  root.style.setProperty('--nhip-pfm-bay', ms(NHIP.PFM_BAY));
  root.style.setProperty('--nhip-pfm-dap', ms(NHIP.PFM_DAP));
  root.style.setProperty('--nhip-pfm-led', ms(NHIP.PFM_LED));
  root.style.setProperty('--nhip-pfm-dau', ms(NHIP.PFM_DAU));
  root.style.setProperty('--nhip-nd-lun', ms(NHIP.PFM_ND_LUN));
  root.style.setProperty('--nhip-nd-nay', ms(NHIP.PFM_ND_NAY));
  root.style.setProperty('--nhip-nd-vao', ms(NHIP.PFM_ND_VAO));
  root.style.setProperty('--nhip-nd-day', ms(NHIP.PFM_ND_DAY));
  root.style.setProperty('--nhip-nd-tho', ms(NHIP.PFM_ND_THO));
  root.style.setProperty('--nhip-lat-la', ms(NHIP.PFM_LAT_LA));
  root.style.setProperty('--nhip-hap-thu-loe', ms(NHIP.PFM_HAP_THU_LOE));
  root.style.setProperty('--nhip-bd-cach', ms(NHIP.PFM_BD_CACH));
  root.style.setProperty('--nhip-mt-doi', ms(NHIP.MT_DOI));
  root.style.setProperty('--nhip-mt-quet', ms(NHIP.MT_QUET));
  root.style.setProperty('--nhip-mt-tho', ms(NHIP.MT_THO));
  root.style.setProperty('--nhip-mt-lua', ms(NHIP.MT_LUA));
  root.style.setProperty('--nhip-mt-tro', ms(NHIP.MT_TRO));
  root.style.setProperty('--nhip-mt-sang', ms(NHIP.MT_SANG));
  root.style.setProperty('--nhip-mt-rung', ms(NHIP.MT_RUNG));
  root.style.setProperty('--nhip-man-vao', ms(NHIP.MAN_VAO));
  root.style.setProperty('--nhip-man-ra', ms(NHIP.MAN_RA));
  root.style.setProperty('--nhip-hub-tha-nay', ms(NHIP.HUB_THA_NAY));
  root.style.setProperty('--nhip-hub-tam', ms(NHIP.HUB_TAM));
  root.style.setProperty('--nhip-hub-man-toi', ms(NHIP.HUB_MAN_TOI));
  root.style.setProperty('--nhip-hub-lac', ms(NHIP.HUB_LAC));
  root.style.setProperty('--nhip-hub-giu', ms(NHIP.HUB_GIU));
  root.style.setProperty('--nhip-hub-banner', ms(NHIP.HUB_BANNER));
  root.style.setProperty('--nhip-hub-banner-mo', ms(NHIP.HUB_BANNER_MO));
  root.style.setProperty('--nhip-hub-banner-chu', ms(NHIP.HUB_BANNER_CHU));
  root.style.setProperty('--nhip-pfm-tab-luot', ms(NHIP.PFM_TAB_LUOT));
  root.style.setProperty('--nhip-pfm-o-cach', ms(NHIP.PFM_O_CACH));
  root.style.setProperty('--nhip-pfm-quet', ms(NHIP.PFM_QUET));
  root.style.setProperty('--nhip-pfm-sao-cau', ms(NHIP.PFM_SAO_CAU));
  root.style.setProperty('--nhip-pfm-sao-vanh', ms(NHIP.PFM_SAO_VANH));
  root.style.setProperty('--nhip-pfm-khay-nhay', ms(NHIP.PFM_KHAY_NHAY));
}
