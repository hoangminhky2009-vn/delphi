/**
 * MARKET HOLD'EM — NGUỒN CHÂN LÝ DUY NHẤT CHO THAM SỐ (A4).
 *
 * Codename nội bộ "Market Hold'em"; tên người chơi thấy là **Đấu trường** (D26).
 * Mọi `label` trong file này LÀ CHUỖI NGƯỜI CHƠI ĐỌC → phải tuân D26.
 *
 * ─── LUẬT SỐ MỘT (D24 mục 1) ────────────────────────────────────────────────
 * Vốn / Lượt khảo sát / Quỹ vòng = CHIP ẢO, reset mỗi trận, KHÔNG BAO GIỜ là
 * Q hay T, không quy đổi, không giá trị mặt tiền. File này KHÔNG được import
 * `config/economy` và không được có bất kỳ hằng số nào chạm ví/token.
 * Test `holdem_firewall.test.ts` khoá điều đó.
 *
 * ─── CON SỐ Ở ĐÂY LÀ PLACEHOLDER ────────────────────────────────────────────
 * D24 mục 16.10: μ/σ, độ lớn ô ma trận, L, K, drop-rate, ngưỡng bust do
 * MONTE CARLO chốt, KHÔNG hand-tune. Số hiện tại chỉ để engine chạy được và
 * test có mốc. Đừng coi là đã cân bằng.
 */

export const HOLDEM_VERSION = 'holdem-v0.1.0-lat1';
/** Đổi khi đổi bất kỳ số cân bằng nào — để so sánh giữa các lần Monte Carlo. */
/*
 * ⚠ ĐỔI CHUỖI NÀY LÀ ĐỔI HÀNH VI BOT CỦA TRẬN MỚI, và CỐ Ý như vậy.
 * `holdem_matches.balance_version` lưu theo từng trận; trận cũ mang chuỗi cũ nên
 * replay ra đúng kết quả đã lưu. Đây là cổng duy nhất giữ cho lịch sử không bị
 * viết lại mỗi lần chỉnh bot — hành động của bot được SUY LẠI lúc replay, không
 * đọc từ log.
 * v5: bot dùng `chonCamKet` cho lượt đầu mỗi vòng (trước đó là code chết).
 * v6: LÕI VỐN — Đảo danh mục (phí + hàng chờ khớp lệnh) và Khoá tài sản 2 vòng.
 * v7: ĐẶC QUYỀN THẺ CHIẾN THUẬT (D33) + nhịp chọn thẻ co theo đường cong (D34).
 * v8: Đa Dạng Hoá nới trần số mã + gọi ký quỹ nổ ở mọi ô (cần gạt kỹ năng Đòn Bẩy).
 * v9: MA TRẬN TƯƠNG QUAN TÀI SẢN — phân tán thôi cứu được giữa khủng hoảng (D39).
 *
 * ⚠ ĐỪNG SO CHUỖI NÀY BẰNG `===` ĐỂ QUYẾT LUẬT. Dùng `luatCua(balance_version)`
 * ở cuối file: phép so bằng làm mọi trận phiên bản CŨ tụt về bộ luật cổ nhất
 * ngay lúc bump chuỗi, tức là cổng chống-viết-lại-lịch-sử tự viết lại lịch sử.
 */
/*
 * 28/07 — LẬT SANG v10b-nav: engine NAV thành luật của trận MỚI. Đúng thứ tự
 * đã khoá bằng test: engine (chặng 1-2) → API + bot (3a) → UI mốc (3b) → LẬT.
 * Trận cũ replay theo version đã lưu của chúng, không đổi.
 */
/*
 * ⚠ FOUNDER CHỐT 04/08 ("Thực hiện đi") — v27 gồm TRỌN v26.
 * Đo đối chiếu công bằng (6.000 trận · 5 ghế · map 8, chỉ khác phiên bản):
 *     G1 ✗ 59,4% → ✗ 60,5%   G2 ✓ 2,90 → ✓ 2,90
 *     G3 ✓ 3,98 → ✓ 4,02      G4 ✗ 2,84 → ✗ 2,83
 * Không gate nào đổi trạng thái; mọi chỉ số trong nhiễu (±0,04 hạng).
 * ⚠⚠ G1 và G4 ĐÃ ĐỎ SẴN trên v25 trước khi có hai cơ chế này — đó là món nợ
 * riêng, lớn hơn, và KHÔNG phải thứ hai bản này gây ra.
 */
/**
 * ⚠⚠ v30 — SỬA THƯỚC ĐO, KHÔNG PHẢI ĐỔI LUẬT CHƠI (rà soát 11/08).
 *
 * Rà ra BA lỗi trong chính DỤNG CỤ đo, và cả ba đều làm gate G1/G4 chấm một
 * con bot khác con bot đang chơi ở trận thật:
 *  1. Bot chấm điểm mã bằng bảng cân trôi v21 trong khi engine định giá bằng
 *     v23 — mua theo một bảng rồi bị chấm bằng bảng khác (`bangCanTroi` nay là
 *     MỘT NGUỒN cho cả hai).
 *  2. Bot hoài-nghi chiết khấu tin giả 35% PHẲNG ở hai trong ba kênh, trong
 *     khi tỷ lệ thật từ v28 chạy 5–80% (`tyLeCua` nay cấp cho cả ba).
 *  3. Gate không nằm trong npm script nào ⇒ không có gì bắt được cú trôi.
 *
 * ⚠ PHẢI CÓ CỔNG dù đây "chỉ là bot": hành vi bot KHÔNG nằm trong `action_log`
 * mà được SUY LẠI mỗi lần dựng trận. Bật thẳng là viết lại vị thế đối thủ của
 * MỌI trận đã lưu — im lặng, không lỗi, không cách nào biết (đúng lý lẽ của
 * cờ `botDocTin` ở v22).
 *
 * ⚠ KHÔNG chỉnh một tham số nào ở bản này. Sửa thước xong phải ĐO LẠI rồi mới
 * bàn tới tham số — chỉnh trong lúc thước còn sai là chỉnh mù, đúng thứ đốt
 * cả một phiên ở D56.
 *
 * ═══ 16/08 — v32 THÀNH MẶC ĐỊNH: founder lật cổng ═══════════════════════════
 * Founder: *"Mở kỳ ngộ cho các bàn đã chốt đi"* (D94). v32 = BẢN SẮC CỠ MAP
 * (kịch bản hồi map 12/16, D85/D86 §2) + KỲ NGỘ (D86 §1, D87 nối dây, D88b
 * §11.7). Số đã có trước khi lật (D87/D88b, 12.000 trận/ô): map 8 v31 ≡ v32
 * GIỐNG HỆT từng chữ số (mẫu đối chứng không rò) · map 12 G1 ✓ 29,3 · G2 ✓ ·
 * G3 ✓ · G4 ✓ 2,63 · map 16 G1 ✓ 28,7 · G2 ✓ · G3 ✓ · G4 ✓ 2,56. Trận ≤ v31
 * replay nguyên (mọi cờ v32 false ở các bản cũ). Kỳ ngộ CHƯA đo bằng người
 * thật (dải hoàn thành 40–55% §1.4) — đó là việc của mùa này với người chơi.
 *
 * ═══ 30/08 — v35 THÀNH MẶC ĐỊNH: founder lật cổng (D164) ════════════════════
 * Founder: *"Làm đi"* trên kế hoạch v36 mà bước 2-khuyến-nghị-⭐ là lật v35
 * trước rồi xây v36 song song ở cổng. Số đã có trước khi lật (D161, 12.000
 * trận × 3 cỡ map + gate phản thân 3.000): 13/13 gate XANH, bám sát mốc v34
 * (map 8: Tất tay 33,7/oracle 1,87; map 12 G4 3,94<4,08<5,16). v35 = chuỗi mở
 * rộng + duoi5 bật lại (5 mặt đuôi vào chợ, thiên nga đen ra) + NHTW dập bong
 * bóng ở kỳ họp + 3 luật tương tác thẻ + Markov theo nguyên nhân + bẻ chuỗi
 * bằng vốn. Trận ≤ v34 replay nguyên (mọi cờ v35 false ở các bản cũ).
 *
 * ═══ 30/08 — v36 THÀNH MẶC ĐỊNH: founder lật cổng (D179) ════════════════════
 * Founder: *"Làm đi"* sau khi duyệt bảng số v36 + đợt kéo xu hướng. v36 = MÁY
 * REGIME TICK (nền tick trước, ô công bố sau; `phuc_hoi` rời bộ rút — chỉ sinh
 * khi tin tốt THẬT cắt chuỗi giảm) + giá vòng tin NHÂN theo nền (bản C) + bot
 * đọc cùng nền + dự báo xếp hạng bằng máy đang sinh ô + hồ sơ map 8 "ngắn &
 * căng". Số trước khi lật (12.000 trận × 3 cỡ map, D176/D177): **12/12 gate
 * XANH**; hình dạng chợ: ô có hướng 54–56% (v35: 53–58), chuỗi/trận và đổi
 * chiều/trận CAO HƠN v35 ở cả ba cỡ.
 * ⚠ Ba thứ ĐỔI THẬT, không phải tinh chỉnh — người chơi cũ sẽ thấy:
 *   · `phuc_hoi` hiếm hẳn và luôn có nguyên nhân (v35: 952/1011 rơi từ trời);
 *   · map 8 dày quyết định hơn (32% → 42% ô phải quyết, tin +34%);
 *   · kỹ năng ĐỌC CHU KỲ nay đáng giá hơn kỹ năng ĐỌC TIN GIẢ ở map 12/16
 *     (G4 biên +0,14 → ~+0,01) — hệ quả của chính máy tick, đã trình founder.
 * Trận ≤ v35 replay nguyên (mọi cờ v36 false ở các bản cũ).
 *
 * ═══ 07/09 — v40 THÀNH MẶC ĐỊNH: founder lật cổng, kéo theo v37+v38+v39 (D303) ═══
 * Founder: *"Lật tất. Ship luôn."* ngay sau D302. v40 = v36 + ÁP LỰC BÀN (v37) + NHÂN
 * QUẢ ĐỐI XỨNG (v38) + CHU KỲ THỰC TẾ (v39 — bộ số máy tick QUY ĐỔI từ dữ liệu ngoài
 * đời, 1 ô = 6 tháng, nguồn ở doc chu-ky-thuc-te-nguon-va-quy-doi) + LỊCH CỐ ĐỊNH
 * (v40 — ô kỳ họp miễn nhiễm đám đông đổi ô). Số trước khi lật, đo trên CHÍNH v40,
 * 12.000 trận × 3 cỡ map: 12/12 ✓ (map 8: Tất tay 32,5% / á quân 29,0%, oracle 1,80 < chơi-được 2,82 < bấm-bừa 3,77, hoài-nghi 2,77 < tin-mọi-tin 3,14 < phớt-tin 3,38 · map 12: Bắt đáy 29,1% / 29,0%, oracle 1,95 < 2,83 < 3,98, hoài-nghi 2,59 < 2,85 < 3,31 · map 16: Bắt đáy 31,9% / 30,1%, oracle 1,90 < 2,85 < 4,03, hoài-nghi 2,53 < 2,72 < 3,30). Bàn tập đổi seed theo luật
 * (`MAN_TAP_SEED_THUC_TE` — v39 đổi bộ số nên seed 12 ô cũ sinh dãy khác; `seedManTap`
 * chọn theo cờ `chuKyThucTe`). Trận ≤ v36 replay nguyên (mọi cờ v37–v40 false ở bản cũ).
 *
 * ═══ 09/09 — v42 THÀNH MẶC ĐỊNH: founder duyệt bộ số và lật, kéo theo v41 (D313) ═══
 * Founder: *"Hiện tại đã có user đâu mà lo không tách được dữ liệu, thực hiện đi. Duyệt."*
 *
 * ⚠ Câu đó bác một lập luận CỦA TÔI, và bác đúng: tôi khuyên hoãn lật để "tách được ảnh
 * hưởng từng đợt trên dữ liệu trận thật" — trong khi mùa 0.0 chưa có một người chơi thật
 * nào, tức không có dữ liệu nào để tách. Đó đúng lỗi A11.1 cấm: viện một mẫu số chưa tồn
 * tại. Ghi lại vì lần sau rất dễ lặp.
 *
 * v42 = v41 + bốn cờ, và lật v42 là **kéo cả v41 lên cùng** (quy ước xếp chồng):
 *   · v41 `lopVn` — hai ma trận độ lớn hiệu chỉnh theo dữ liệu thị trường VN (D307);
 *   · v42 `taiSanV42` — ba hàng `cp_cn`/`usd`/`tpcp` suy lại cho CP Chứng khoán · USDT ·
 *     Trái phiếu Mỹ, 22/102 ô đổi (máy đếm);
 *   · `couponTpcp` — Trái phiếu Mỹ trả lãi vào TIỀN MẶT mỗi ô, sổ khống trả ngược;
 *   · `khongTheoMa` — sàn VN không cho khống cổ phiếu cơ sở ⇒ chặn `cp_cn`;
 *   · `tienMatSuKien` — ô lạm phát trừ thẳng tiền mặt tự do (một nguồn thay
 *     `PHI_DUNG_NGOAI.LAM_PHAT_BP`, không thu hai lần).
 * Số đo TRƯỚC khi lật, trên CHÍNH v42, 12.000 trận × 3 cỡ map: **12/12 ✓**
 * (map 8: Tất tay 33,7% / á quân 29,6%, oracle 1,88 < chơi-được 2,84 < bấm-bừa 3,80,
 * hoài-nghi 2,79 / tin-mọi-tin 3,24 / phớt-tin 3,13 · map 12: Tất tay 29,2% / 27,1%,
 * oracle 2,00 < 2,87 < 3,97, 2,61 / 2,97 / 3,04 · map 16: Khắc chế 28,6% / 27,9%,
 * oracle 2,03 < 2,89 < 4,03, 2,59 / 2,87 / 3,07).
 * ⚠⚠ Hai lần chạy gate ĐẦU cũng ra 12/12 nhưng ĐO SAI — bot đọc bảng v41 trong khi engine
 * định giá bằng V42 (khối dựng `BoiCanhLenh` có hai bản). Dấu hiệu duy nhất: số giống hệt
 * lần trước tới từng chữ số thập phân. Số ở trên là lần chạy thứ ba, sau khi gộp về một
 * cửa `coV42ChoBot`. Nguồn từng ô: `docs/thiet-ke-de-xuat/gameplay/tai-san-v42-nguon-va-quy-doi.md`.
 * Bàn tập KHÔNG đổi: `seedManTap(v42)` trả cùng seed và `sinhMap` ra cùng dãy ô như
 * v40/v41 (có bài canh — `tests/tai_san_v42.test.ts` §V-c), nên kịch bản CoachTap còn đúng.
 * Trận ≤ v41 replay nguyên (mọi cờ v42 false ở bản cũ; golden replay là bằng chứng).
 */
/*
 * v46 (D338, 16/09) — ĐÒN BẨY Ở TRẬN NAV nhân đúng từng mã + lãi vay neo lãi nền (founder chốt mức).
 * Gate 12.000 trận · bàn 5 ghế — map 8: Tất tay 28,8% / á quân 28,4% (lần đo D313 ở v42: 33,7% / 29,6%),
 * oracle 1,98 < chơi-được 2,85 < bấm-bừa 3,73, hoài-nghi 3,05 / tin-mọi-tin 3,35 /
 * phớt-tin 3,34 · map 12: Gửi bậc thang 27,3% / 27,2%, oracle 2,05 < 2,89 < 3,88, 2,78 / 3,02 / 3,16
 * · map 16: Bắt đáy 36,4% / 33,5%, oracle 1,99 < 2,93 < 3,98, 2,68 / 2,86 / 3,16 · G5a/G5c ✓ cả ba cỡ,
 * mốc gửi tốt nhất tk_3 · tk_4 · tk_3 (G5b ✓). Số khác lần đo trước ⇒ bot đã nhận cờ mới.
 * Bàn tập KHÔNG đổi dãy ô (cờ v46 không chạm `sinhMap`); đường nghe-Oracle vẫn nhất + SSS (`ban_tap_sss`).
 */
/*
 * v47 (D339, 16/09) — KHẨU VỊ RỦI RO nhân ĐÚNG BIÊN ĐỘ. Một cờ, sửa lỗi đơn vị cuối của họ
 * "mắt xích rơi nhầm tầng" (v46 sửa `nhan`, v47 sửa `khau_vi`).
 * ⚠ GATE KHÔNG ĐO ĐƯỢC CỜ NÀY và điều đó là bình thường: `holdem_montecarlo` không đặt
 * `khau_vi` cho ghế nào ⇒ mọi bot chạy `can_bang` (he_so_bp 10000 ⇒ bước 6 không sinh mắt
 * xích) ⇒ số gate v47 TRÙNG v46 tới từng chữ số. Trùng ở đây KHÔNG phải dấu hiệu "bot chưa
 * nhận cờ" (bẫy D313) mà là hệ quả đọc được từ chính bàn đo — có bài canh giữ tính chất ấy.
 * Phép đo thật là BỘ BA SONG SINH (cùng seed, cùng bàn, cùng bot, chỉ khác khẩu vị ghế 0),
 * 2.000 bộ ba map 12 — thận trọng / cân bằng / quyết liệt:
 *   v46 (lỗi):  về nhất  5,0% / 17,3% / 53,3% · NAV TB −36,6% / — / +69,1% so cân bằng
 *   v47 (sửa):  về nhất  7,5% / 16,9% / 33,9% · NAV TB −20,6% / — / +34,4% · cháy 1,1/2,5/4,4%
 * ⏳ CÒN MỞ (founder chốt, A8.2): phần chênh còn lại là DO THIẾT KẾ, không phải lỗi — nhân
 * biên độ lên một thị trường có đà tăng thì kỳ vọng cũng nhân theo. Bảng quét hệ số ở D339.
 */
/*
 * v48 (D340, 16/09) — RỦI RO ĐỐI TÁC TRỪ ĐÚNG MỘT LẦN. Ca cuối của họ lỗi ba ca (v46 `nhan` ·
 * v47 `khau_vi` · v48 `doi_tac`), và là ca duy nhất không phải xếp nhầm tầng mà là ĐẾM HAI LẦN:
 * phần ăn thẻ phòng thủ bị teo trong `d` RỒI còn bị trừ tiếp bằng một mắt xích trong chuỗi ⇒
 * tiền áp 0 thay vì một nửa (đo 133/133 vòng kích hoạt).
 * Gate 12.000 trận · bàn 5 ghế, cả ba cỡ map G1–G5 ✓ — map 8: Gửi bậc thang 29,0% / á quân 28,5%,
 * oracle 1,99 < chơi-được 2,85 < bấm-bừa 3,73 · map 12: Gửi bậc thang 28,3% / 26,5%,
 * oracle 2,08 < 2,89 < 3,88 · map 16: Bắt đáy 35,9% / 32,5%, oracle 2,01 < 2,92 < 3,98.
 * ⚠ Số ĐỔI so với v47 ở cả ba cỡ (v47: Tất tay 28,8 / Gửi bậc thang 27,3 / Bắt đáy 36,4) ⇒ bot đã
 * nhận cờ mới. KHÁC v47 ở chỗ này: v47 trùng số mới là đúng, v48 trùng số mới là sai.
 * Mức đổi ở gate NHỎ vì bể bot trộn hiếm khi đủ 40% lobby cùng cầm MỘT thẻ phòng thủ. Đo riêng
 * đúng tình huống cơ chế nhắm tới (3/5 ghế cùng núp `phong_ho`, 1.500 cặp cùng seed): ghế núp về
 * nhất 13,4% → 14,4%, NAV TB +6,0%, xếp cao hơn ở 10,7% cặp / thấp hơn 5,1%.
 */
/*
 * v49 (D342, 16/09) — LÕI BÁN KHỐNG: sổ khống ăn ngược đúng giá chợ · chip KHỐNG theo hạn mức ·
 * lá Bán Khống thuần quyền · xếp hàng khớp lệnh vào tầng mã. Xem docstring bộ luật v49 (gate đo
 * được gì) và D342 (số đo).
 */
/*
 * v50 (D345, 16/09) — PHÍ MUA BÁN NHẸ NHƯ NGOÀI ĐỜI, nặng theo cỡ tiền tuyệt đối (vai nhiều tiền mới bị),
 * Khớp Nhanh còn 30%. Xem `PHI_LENH_V50` và docstring bộ luật v50 (gate).
 */
/*
 * v52 (D371, 21/09) — ĐA DẠNG HOÁ THÔI THU TIỀN THUÊ MỖI VÒNG: hoà vốn dời từ 2,69 mã xuống
 * 0,86 mã, đầu trên hạ từ +340 xuống +110 bp/vòng. Xem `DA_DANG_HOA_V52` (bảng đo 8 bộ + vì sao
 * bộ cũ trị giá đúng bằng KHÔNG) và docstring bộ luật v52 (gate đo được gì).
 */
/*
 * ⚠⚠ D381 (founder 22/09 tối: *"lùi đi, nhưng nhớ note vào không là mất bản hiện tại."*)
 * LÙI CỜ MẶC ĐỊNH VỀ v52 — **KHÔNG XOÁ GÌ CỦA v53.** `balance-v53-upo` vẫn nguyên trong
 * `BO_LUAT_THEO_PHIEN_BAN`; `oVongUp` · `vongDaLat` · `laiSuatThayDuoc` · `boiCanhUpCua`
 * vẫn nguyên trong engine; bài canh `o_up_v53*` · `ban_do_up_o` vẫn chạy; golden vẫn ghim
 * hash v53. Thử v53 bằng `ep_balance` lúc tạo trận. Mọi CÚ SỬA LỖI của 22/09 GIỮ NGUYÊN,
 * không phụ thuộc cờ này: một vòng chốt một lần (D379) · lá mở màn thôi lật hai lần (D380)
 * · cả màn nói một vòng (D376).
 *
 * VÌ SAO LÙI — ĐỌC TRƯỚC KHI AI ĐÓ BẬT LẠI. v53 tính lãi/lỗ vòng N bằng CHÍNH lá N, nên
 * hai yêu cầu của founder KHÔNG THỂ cùng đúng:
 *   · lá 1 NGỬA ⇒ lá tính tiền vòng 1 đã bị nhìn thấy, và sang vòng 2 không còn lá nào mới
 *     để lật (lá 2 phải ở lại úp để tính vòng 2) — *"thẻ 1 bấm chốt vòng xong chỉ xám chứ
 *     không lật thẻ thứ 2"*;
 *   · lá 1 ÚP ⇒ vòng 2 có lá lật, nhưng vào trận không thấy gì — *"vào trận úp hết thế này
 *     t biết làm gì ngoài chốt vòng đợi"*.
 * Chúng chỉ cùng đúng khi **số lá NHIỀU HƠN số vòng một lá**.
 *
 * ⇒ v54 phải làm BA việc, không phải một:
 *   (1) `sinhMap` sinh `size + 1` ô — ô đầu là BỐI CẢNH MỞ MÀN, không tính tiền;
 *   (2) `chotPhien` đọc Ô KẾ TIẾP (`o[vong]`), không phải `o[vong-1]`;  ⭐ CHỖ THẬT SỰ QUAN TRỌNG
 *   (3) `tong_vong = size - 1`.
 * Rồi sinh lại golden + chạy G1–G5 ba cỡ bàn. Ba cú vá 22/09 (D378 · D379 · D380) đều
 * trượt vì chỉ chạm tầng HIỂN THỊ mà không chạm (2) — đó là bài học đắt nhất của ngày.
 */
/*
 * D406 (25/09) — MẶC ĐỊNH v53 → v54 (`balance-v54-ngare`): chu kỳ có ngã rẽ + lược bỏ (D389), bộ luật từng lá (D399),
 * thanh khoản năm nấc (D395), trần hạng 1 (D403) và sổ tiết kiệm chịu nền kinh tế (D405). Founder duyệt: *"A, cho phép
 * đấy"* (lật một lần) rồi *"A, deploy luôn đi"*. v53 ghim vào golden (`PHIEN_BAN_DO`) — trận v53 cũ replay y nguyên.
 */
/*
 * D434 (27/09) — MẶC ĐỊNH v54 → v55 (`balance-v55-build`): ngọn lửa đà · xu · trait TÀI/TẬT · chốt lời trong ô (D409 →
 * D430). Founder đọc báo cáo 0.0.46 (*"deploy rồi sao t ko thấy lửa hay trait"*) rồi chọn *"Bật ngay hôm nay"*. v54 ghim
 * vào golden (`PHIEN_BAN_DO`) — trận v54 cũ replay y nguyên. Bàn tập (v54) và đề buổi đo (v52) ghim khoá riêng, không đổi.
 */
// D447 (28/09) — v55 → v56: phí mua bán cộng dồn cả vòng theo từng mã (golden ghim v55 đích danh).
/*
 * D525 (05/10) — MẶC ĐỊNH v56 → v58 (`balance-v58-xenke`): trận thật thành MINIGAME THEO LÕI (D455 → D524, khoá v57) với NHỊP 8 Ô XEN
 * KẼ màn lõi / chợ trait (D526). Founder: *"deploy và bật"* → *"Làm bàn tập rồi deploy"* (D527) → *"Chốt. Deploy lên web đi"*. v56 ghim
 * vào golden (`PHIEN_BAN_DO`) — trận v56 cũ replay y nguyên. v57 chưa từng là mặc định (không ghim). Bàn tập ghim v58 (D527), đề buổi
 * đo ghim khoá riêng.
 */
/*
 * D528 (05/10) — MẶC ĐỊNH v58 → v59 (`balance-v59-kelenh`): trait KÊ MUA / KÊ BÁN (Tổ Chức mang sẵn) · TÂM LÝ YẾU · trần thua Tổ Chức áp khoản giữ
 * suốt · vai ghế khác giấu trong trận (trừ SOI VAI). Founder chốt demo bản 49: *"Chốt thi công đi"*. v58 chưa từng lên prod ⇒ không ghim golden.
 * Bàn tập vẫn v58 (`MAN_TAP_BALANCE_VERSION`) — kê lệnh chưa dạy trong bàn tập. (D530: bàn tập sang v60.)
 */
/*
 * D530 (06/10) — MẶC ĐỊNH v59 → v60 (`balance-v60-loiman`): lõi chỉ tác động trong màn minigame — engine thôi canh nhịp · Đòn Bẩy ×2 + lãi vay +
 * gọi ký quỹ · sóng Lướt Sóng · hàng tin · cặp lõi · sổ khống. Founder chọn *"Chỉ tác động trong màn"*. v59 đã chạy prod (0.0.53, 05/10) ⇒ ghim golden.
 */
/*
 * D536 (06/10) — MẶC ĐỊNH v60 → v61 (`balance-v61-lenhlon`): LỆNH LỚN trong màn — bot Cá Mập / Đội Lái cùng mã đẩy giá theo demo + cột khối lượng +
 * nhãn LỆNH LỚN. Founder chọn *"Làm đủ như demo"*. v60 đã chạy prod (0.0.54, 06/10) ⇒ ghim golden.
 */
/*
 * D545 (06/10) — MẶC ĐỊNH v61 → v62 (`balance-v62-kyhoptap`): bàn tập 6 ô có kỳ họp cố định ở ô 3. Trận thật 8 ô KHÔNG đổi một ô nào (cờ chỉ chạm
 * cỡ 6); đổi cả hai khoá để bàn tập và trận thật cùng một luật (D527). v61 đã chạy prod (0.0.55) ⇒ ghim golden.
 */
/*
 * D550 (07/10) — MẶC ĐỊNH v62 → v63 (`balance-v63-ban14`): trận thật 14 ô · 13 vòng, kỳ họp ô 4 · 9, năm chợ trait (founder: *"Làm 14 ô đi"* ·
 * *"Nhiều trait hơn đi. Như kiểu chiến thuật eco trong TFT"*). Bàn tập GIỮ v62: cờ mới chỉ đổi cỡ trận thật (`coBanGhim`), bàn tập 6 ô y nguyên.
 * v62 đã chạy prod (0.0.56–0.0.58) ⇒ ghim golden.
 */
/*
 * D560 (08/10) — MẶC ĐỊNH v63 → v64 (`balance-v64-congoi`): chu kỳ có ngòi — Quá nóng là cuối mùa tăng, Đi ngang tích lũy / phân phối (icon góc
 * lá + hình màn Spring / Upthrust), bò / gấu theo loại, không ngòi không sập, sức căng có đèn (founder: *"tăng xong mà ko có sự kiện bất ngờ gì
 * thì nó thường đi ngang tích lũy hoặc giảm nhẹ chứ có đùng phát chuyển sang bear đâu"* → chọn A + C). Bàn tập GIỮ v62. v63 đã chạy prod
 * (0.0.59–0.0.60) ⇒ ghim golden.
 */
/*
 * D561 (08/10) — MẶC ĐỊNH v64 → v65 (`balance-v65-thangkynang`): thang kỹ năng trong màn — Bán Khống ×2 · lõi chọn lúc chốt vòng · Bắt Đáy / Mua Đuổi
 * bán bớt · xếp hạng cách E · tin "đã vào giá" (khối lượng cạn + nến rút chân) · đánh màn nhiều mã · khoản chạy theo giá tới cú bấm đầu · úp lá pha
 * tới hết màn (founder 07–08/10). Bàn tập GIỮ v62. v64 đã chạy prod (0.0.61) ⇒ ghim golden.
 */
/*
 * D566 (10/10) — MẶC ĐỊNH v65 → v66 (`balance-v66-laiap`): lãi áp theo LÁ QUYẾT TOÁN dưới ô úp — kỳ họp lật cuối vòng N đổi coupon · lãi sổ
 * thả nổi · lãi vay đòn bẩy · độ sâu thanh khoản ngay vòng N (chỗ D382 bỏ sót, D563). Founder 10/10 *"Theo đề xuất của bạn"*. Gate
 * 12.000 · 5 ghế · bàn 14 ĐẠT. Bàn tập GIỮ v62. v65 đã chạy prod (0.0.62) ⇒ ghim golden.
 */
/*
 * D574 (10/10) — MẶC ĐỊNH v66 → v67 (`balance-v67-boicanh`): bối cảnh dài hạn — sóng công nghệ × pha nợ ẩn trong trận (bánh xe mùa ·
 * kỳ họp · nghiêng giá mỗi ô · đổ đèo), tin vĩ mô 1/2 số màn × đúng 85 %. Founder chọn bộ số A·B (P3) rồi "A" lật. Gate 12.000 · 5 ghế ·
 * bàn 14 ĐẠT trên đúng bộ cuối. Bàn tập GIỮ v62. v66 đã chạy prod (0.0.64) ⇒ ghim golden. Bảng xếp hạng E tách theo khoá (`bangXepHangE`).
 */
/*
 * D584 (11/10) — MẶC ĐỊNH v67 → v68 (`balance-v68-giaixu`): giải vòng trả bằng XU TRAIT (không nền, không hũ tiền). Founder *"Đổi đi chờ gì"*.
 * Gate 24.000 · 5 ghế · bàn 14 ĐẠT (bảng E TẠM của v67 — founder A, xem `XEP_HANG_E_V68`). v67 chưa từng lên prod ⇒ không ghim golden.
 */
/*
 * D586 (11/10) — MẶC ĐỊNH v68 → v69 (`balance-v69-banbot`): BÁN BỚT bán hết được khoản giữ, mỗi cú = khoản ÷ số lần theo Rải lệnh (2 / 3 / 4) —
 * Bắt Đáy · Mua Đuổi · màn không lõi. Founder 11/10. v68 chưa từng lên prod ⇒ không ghim. Bot không bấm nút mới ⇒ gate = v68 (đo lại 24.000).
 */
/*
 * D589 (11/10) — MẶC ĐỊNH v69 → v70 (`balance-v70-baphan`): VÀO 3 phần (Mua Đuổi 3 : 2 : 1 · Bắt Đáy 1 : 2 : 3) · Mua Đuổi ×2 thay chỗ ô VÀO sau 3 cú
 * nhồi + CHỐT gộp. Founder 11/10 chọn làm chung nhánh (B). v69 chưa từng lên prod ⇒ không ghim.
 */
export const HOLDEM_BALANCE_VERSION = 'balance-v70-baphan';

/**
 * ═══ ENGINE v10 — NAV (D40 + spec 01, thi công 28/07) ═══════════════════════
 *
 * Vị thế có KÍCH CỠ TIỀN; NAV = tiền mặt + giá trị danh mục là thước xếp hạng
 * DUY NHẤT. Đây là lời giải gốc cho chẩn đoán D35 ("thứ hạng xếp theo phần trăm
 * nên số vốn không ảnh hưởng") — sau v10, giá cắn thẳng vào vị thế ⇒ NAV ⇒
 * cháy thật, và phân bổ 35% khác hẳn phân bổ 70%.
 *
 * NGUỒN GỐC TỪNG SỐ — ba hạng khác nhau, đừng đánh đồng:
 * · ĐÃ CHỐT (founder): `BUOC_MOC_BP` = 5% (spec 01 §4.2b, "mốc tự do hơn để
 *   try hard tính được công thức thật"); `BUOC_TIEN` = 10 (C5 + D40 "bước 10
 *   chip, vẫn số nguyên").
 * · ĐO RỒI (khảo sát D40): `LAM_PHAT_TIEN_MAT_BP` = 150 — "tiền mặt KHÔNG phải
 *   bẫy... PHI_LAM_PHAT_BP = 150 đang đúng cỡ" (kỳ vọng/vòng: usd −412bp ·
 *   vàng −131 · tpcp −33 so tiền mặt −150).
 * · ⭐ KHUYẾN NGHỊ AGENT, CHỜ FOUNDER DUYỆT SỐ (A8.2 — cơ chế founder đã lệnh
 *   "làm đi", số thì chưa ai đo): `TRUOT_GIA_BP` (MC-TUNE) và `NGUONG_CHAY_BP`
 *   (spec 01 §6.4 đề xuất NAV < 10%). Đổi số KHÔNG đụng code — một chỗ này.
 */
export const NAV_V10 = {
  /**
   * Bước mốc phân bổ MỊN: 5% (founder chốt 27/07) — từ 28/07 là ĐẶC QUYỀN của
   * lá CHIA LỆNH (founder: "Chỉ chiến thuật chia lệnh mới cho phép đi vốn cụ
   * thể (các mốc 5-10-15...100)"). Đúng bản chất lá: chẻ nhỏ được lệnh.
   */
  BUOC_MOC_BP: 500,
  /**
   * Bước mốc THÔ cho ghế KHÔNG cầm Chia Lệnh: 25 · 50 · 75 · ALL-IN.
   * ⭐ Founder nói "các mốc lớn hơn" chưa cho số — 2500 là đề xuất agent, đổi
   * một chỗ này không đụng code. Enforce Ở SERVER (C4): API nhận MỐC chứ không
   * nhận tiền thô, xem `mocHopLe`/`giaiLenhMoc`.
   */
  BUOC_MOC_THO_BP: 2500,
  /** Lệnh làm tròn XUỐNG về bội số này — trừ ALL-IN (10000bp) dồn hết. */
  BUOC_TIEN: 10,
  /** Lạm phát tiền mặt mỗi vòng (D40 đo: đúng cỡ so nhóm phòng thủ). */
  /*
   * ⚠ BỌC `doThamSo` 02/08 — MẶC ĐỊNH KHÔNG ĐỔI (150). Trước đó đây là số
   * CỨNG, nên mọi phép dò `HOLDEM_LAM_PHAT_TIEN_MAT_BP=...` đều là PHÉP RỖNG:
   * script chạy, in ra số mới, mà engine vẫn dùng 150 — đúng loại "đo mà
   * không đo" đã đốt cả buổi. Đây là cần gạt CHÍNH của gate G3 (chi phí đứng
   * im), nên nó phải dò được thì mới chỉnh có căn cứ.
   */
  LAM_PHAT_TIEN_MAT_BP: doThamSo('LAM_PHAT_TIEN_MAT_BP', 150),
  /**
   * Trượt giá giao dịch theo thanh khoản (bp trên CỠ LỆNH) — chi phí tập trung
   * CHÍNH của v10, thay `CAP_STACK_BP` (D40: "thay cần gạt giả bằng cần gạt
   * thật"). Thu vào QUỸ VÒNG, không đốt. ⭐ MC-TUNE — chưa đo Monte Carlo.
   */
  /*
   * ⚠ HỆ SỐ NHÂN ĐỂ DÒ ĐƯỢC (03/08). Mặc định 10.000 = ×1,00, KHÔNG đổi số
   * gốc. Trước bản này ba mức dưới là SỐ CỨNG, nên mọi phép dò trượt giá đều
   * là PHÉP RỖNG — script chạy, in số mới, engine vẫn dùng số cũ. Đúng lỗi đã
   * bắt ở `LAM_PHAT_TIEN_MAT_BP` (D56): thứ không dò được thì không đo được,
   * và nó im lặng cho ra số đẹp.
   */
  TRUOT_GIA_BP: (() => {
    const n = doThamSo('TRUOT_GIA_NHAN_BP', 10000);
    const g: Record<string, number> = { mong: 120, vua: 60, day: 25 };
    for (const k of Object.keys(g)) g[k] = Math.round((g[k]! * n) / 10000);
    return g as Record<ThanhKhoan, number>;
  })(),
  /** Cháy khi NAV ≤ ngưỡng này × vốn khởi điểm. ⭐ CHỜ FOUNDER (spec 01 §6.4). */
  NGUONG_CHAY_BP: 1000,

  /**
   * ═══ v29 — PHÍ VỘI VÀNG PHI TUYẾN THEO CỠ LỆNH (04 §4.6 + §4.7) ═══════════
   *
   * Trước bản này trượt giá TUYẾN TÍNH THUẦN theo cỡ: lệnh 10.000 trả đúng
   * cùng TỶ LỆ % với lệnh 500 ⇒ cỡ vị thế không có đánh đổi — đúng câu D43 đã
   * ghi ("all-in vô não tái sinh dạng cỡ lệnh") và đúng số đo được: Tất tay
   * thắng 47–60% (G1 đỏ, founder xác nhận bằng tay 08/08). D40 hứa "trượt giá
   * theo cỡ lệnh SO VỚI thanh khoản" nhưng bản cài chỉ lấy HẠNG thanh khoản
   * làm hệ số tỷ lệ — chưa bao giờ so cỡ lệnh với độ sâu sổ. Trang HƯỚNG DẪN
   * §03 còn dạy sẵn *"vung tay MỘT PHÁT TO là giá tự đội lên"* — lời dạy đi
   * trước cơ chế; bản này cho code đuổi kịp lời.
   *
   * CÔNG THỨC (số nguyên): trượt hiệu dụng = trượt gốc × heSoVoiVangBp(cỡ),
   *   heSoVoiVang = min(TRAN_BP, 10000 + cỡ_lệnh × DOC_BP / START_VON)
   * — impact thị trường thật: lệnh to so với độ sâu sổ (quy ước = vốn khởi
   * điểm) đẩy giá luỹ tiến. DOC_BP=10000 ⇒ lệnh bằng cả vốn khởi điểm trượt
   * ×2, lệnh 25% trượt ×1,25, lệnh 5% gần như không đổi.
   *
   * BA VIỆC MỘT CẦN GẠT, không cơ chế mới (04 §4.6 cấm đẻ cơ chế phạt mới):
   * · G1 — all-in trả phí luỹ tiến, cỡ vị thế thành đánh đổi thật;
   * · phạt reactive play — cú bán tháo 100% SAU khi thấy thẻ trả nặng, người
   *   ra dần từ trước trả nhẹ ("dùng dữ liệu hiện tại đoán tương lai, không
   *   phải thấy thẻ lật thì phản ứng theo" — founder 08/08);
   * · hãm kẻ dẫn đầu (D40 §4) — càng giàu lệnh càng to càng đắt, tự nhiên.
   * Lá CHIA LỆNH né được phần phi tuyến bằng cách chẻ lệnh — đúng nghề của nó
   * (D67: "người giỏi học dự đoán phí rồi chia nhỏ lệnh để né").
   *
   * ⚠ Đổi số học lệnh ⇒ CỔNG `phiVoiVang` (v29) — trận cũ replay nguyên.
   * ⚠ Số DÒ ĐƯỢC qua env (bài học D56/D58: cần gạt phải sống mới đo được).
   */
  /*
   * SỐ CHỐT BẰNG DÒ 08/08 (6.000 trận/nấc, map 8, rồi xác nhận 12/16):
   *      DOC_BP     10000    40000    80000    120000   160000
   *      Tất tay %  56,8     45,4     38,0     33,5     30,5 ✓
   * 160000/220000 là nấc đầu tiên G1 XANH cả ba cỡ map (30,5/30,7/29,2%,
   * cách á quân 7,7/8,0/4,5) mà G2 giữ nguyên độ rộng và G3 vẫn ✓ (Ngồi im
   * 3,81/3,70/3,54 — có bò lên theo cỡ map, theo dõi ở mùa sau).
   * Đọc ra tiền: all-in 10.000 vào mã mỏng trượt ~20%/chiều — nghe dữ nhưng
   * là impact thật của việc đập một lệnh bằng CẢ độ sâu sổ; lệnh 1.000 chỉ
   * ~3%. Màn DANH MỤC SAU LỆNH hiện phí TRƯỚC khi bấm (D67) nên không ai bị
   * úp sọt — và chia nhỏ lệnh chính là bài trò này dạy.
   */
  VOI_VANG: {
    DOC_BP: doThamSo('VOI_VANG_DOC_BP', 160000),
    TRAN_BP: doThamSo('VOI_VANG_TRAN_BP', 220000),
  },
} as const;

/**
 * v50 (D345) — PHÍ MUA BÁN "NHƯ NGOÀI ĐỜI", NẶNG THEO CỠ TIỀN. Founder 16/09 sau khi tấm VÌ SAO
 * lần đầu kể phí (D344): *"Phí nặng quá, phân chia theo role đi (kiểu ai nhiều tiền lắm mới bị).
 * À mà nhớ là lõi khớp nhanh thì được giảm mạnh nhé. Và ngoài đời cũng đ** bị nặng đến thế"*.
 *
 * Số cũ (v29–v49, `NAV_V10`): gốc 120/60/25bp × hệ số vội vàng tới ×17–22 tính trên VỐN RIÊNG của
 * vai ⇒ một cú ALL-IN 10.000 vào CP Chứng khoán mất 1.020 (10,2%), vào Crypto 20%; đảo trọn danh mục
 * một vòng ~20% — trận founder vòng 2 mất 1.832 chỉ vì phí.
 *
 * Mới:
 *  · GỐC: sổ dày 0,2% (VN30 · USDT), vừa 0,4% (CP · vàng · trái phiếu), mỏng 0,8% (Crypto) — một lệnh
 *    NHỎ trả gần mức ngoài đời (môi giới CK VN ~0,15–0,25%/chiều + chênh giá).
 *  · VỘI VÀNG theo CỠ TIỀN TUYỆT ĐỐI so với ĐỘ SÂU CHỢ (không theo vốn riêng của vai): lệnh càng to so
 *    với lượng hàng treo thì càng đẩy giá — nên vai NHIỀU TIỀN mới bị nặng. Cá nhân mua 25% vốn ×3,25
 *    (CP 1,3%; v49 3%); ALL-IN 10.000 ×10 (CP 4% · Crypto 8%; v49 10,2% · 20,4%); cá mập ALL-IN 30.000
 *    vào Crypto ×28 × hệ số vai 1,5 = 33,6% (v49 30,6%); trần ×30.
 *  · Lõi KHỚP NHANH: phí mua bán còn `DAC_QUYEN.KHOP_NHANH.LENH_CON_BP` (30% ⇒ cá nhân ALL-IN CP 1,2%).
 * ⚠ VÌ SAO KHÔNG NHẸ HƠN NỮA (đo, không đoán): phí vội vàng là phanh của lối dồn hết vốn mỗi vòng. Quét
 *    gate (6.000 trận/mức): gốc 0,4/0,2/0,1% ⇒ bot "Tất tay" về nhất 45–55% (G1 ✗ cả ba map); gốc
 *    0,8/0,4/0,2% ALL-IN ×7 ⇒ bàn 12/16 ✓ nhưng bàn 8 (không vai, ai cũng 10.000) Tất tay 48,7% ✗;
 *    ALL-IN ×10 (bộ số này) ⇒ bàn 8 Tất tay 30,5% vs 29,4% ✓. Bảng quét đủ ở D345.
 * ⭐ PLAYTEST-TUNE — founder chốt HƯỚNG ("nhẹ · theo vai nhiều tiền · Khớp Nhanh giảm mạnh"), con số
 *    do gate chọn (A8.2).
 */
export const PHI_LENH_V50 = {
  TRUOT_GIA_BP: (() => {
    const n = doThamSo('PHI50_NHAN_BP', 10000);
    const g: Record<string, number> = { mong: 80, vua: 40, day: 20 };
    for (const k of Object.keys(g)) g[k] = Math.round((g[k]! * n) / 10000);
    return g as Readonly<Record<ThanhKhoan, number>>;
  })(),
  /** Độ sâu chợ quy chiếu (chip) — lệnh cỡ này chịu hệ số vội vàng ×(1 + DOC). */
  DO_SAU_THI_TRUONG: doThamSo('PHI50_DO_SAU', 10000),
  /** Độ dốc hệ số vội vàng (bp) trên mỗi một độ sâu chợ. */
  DOC_BP: doThamSo('PHI50_DOC_BP', 90000),
  /** Trần hệ số vội vàng (bp). */
  TRAN_BP: doThamSo('PHI50_TRAN_BP', 300000),
} as const;

/**
 * v51 (D346) — PHÍ MUA BÁN HAI BẬC. Founder 17/09: *"Hãm lối chơi đó đi, trade off rõ"* (lối "dồn hết
 * vốn mỗi vòng"). v50 hãm nó bằng MỘT đường cong trơn, nên muốn hãm đủ thì phí của lệnh vừa cũng phải
 * nặng (25% vốn = 1,28% — gấp ~4 lần ngoài đời). Hai bậc tách hẳn hai việc:
 *
 * · BẬC 1 — `NGUONG_BP` đầu tiên của MỖI lệnh (tính trên ĐỘ SÂU CHỢ, không trên vốn riêng của vai):
 *   trả đúng giá gốc `GOC_BP` ≈ ngoài đời (VN ~0,25–0,35%/chiều cổ phiếu; crypto spot ~0,1–0,6%).
 * · BẬC 2 — phần VƯỢT: giá khớp xấu dần theo cỡ phần vượt so độ sâu chợ, kẹp `TRAN_BP`.
 *
 * Ghế vốn 10.000, cổ phiếu: 10%/25%/40% vốn = 0,30% · 50% = 0,72% · 75% = 3,56% · dồn hết = 7,86%
 * (crypto gấp đôi). Cá mập vốn 30.000 dồn hết = 15,64% — 4.000 chip đầu vẫn rẻ, phần sau mới cắn,
 * đúng nguyên tắc "ai nhiều tiền lắm mới bị" của v50.
 *
 * ⚠ VÌ SAO KHÔNG CHỌN CÁCH KHÁC — tám phanh đã ĐO (4.000–12.000 trận/cấu hình, bàn 8, ở mức phí nhẹ;
 * số là tỷ lệ về nhất của bot "Tất tay"): không hãm 59,7 · chờ tiền bán về một vòng 50,0 · trần tỷ trọng
 * một mã 60%/50% 56,3/56,9 · bỏ lá Đòn Bẩy 60,2 · biến động ×2 56,4 · bỏ/nhân đôi lạm phát 57,1/61,2 ·
 * khoản phải chi định kỳ + bán gấp 53,5 (bàn 12 vỡ: cháy 47%) · chợ chỉ nuốt 35% NAV mỗi vòng 41,8 ·
 * HAI BẬC 32,4 ✓. Lối đó mạnh vì luôn phơi nhiễm tối đa trong thị trường kỳ vọng dương — chi phí đánh
 * đều lên cả bàn không hãm được, chỉ chi phí theo LƯỢNG TIỀN đẩy vào chợ trong MỘT vòng mới trúng.
 * ⚠ Bậc 2 áp cho CẢ lệnh bán: thử miễn cho bán (thoát hàng rẻ) ⇒ 52,9% ✗. Trần dốc ×22 (giữ dồn-hết ở
 * 4% như v50) ⇒ 41,0% ✗. Founder chốt "phanh chắc" 17/09.
 * ⭐ PLAYTEST-TUNE — founder chốt HƯỚNG + mức phanh; con số do gate chọn (A8.2).
 */
export const PHI_LENH_V51 = {
  /** Giá gốc bậc 1 (bp trên cỡ lệnh) theo độ dày sổ — 0,6% / 0,3% / 0,15%. */
  GOC_BP: (() => {
    const n = doThamSo('PHI51_GOC_NHAN_BP', 10000);
    const g: Record<string, number> = { mong: 60, vua: 30, day: 15 };
    for (const k of Object.keys(g)) g[k] = Math.max(1, Math.round((g[k]! * n) / 10000));
    return g as Readonly<Record<ThanhKhoan, number>>;
  })(),
  /** Ngưỡng bậc 1 (bp của ĐỘ SÂU CHỢ `PHI_LENH_V50.DO_SAU_THI_TRUONG`): 40% ⇒ 4.000 chip. */
  NGUONG_BP: doThamSo('PHI51_NGUONG_BP', 4000),
  /** Độ dốc bậc 2 (bp) trên mỗi một độ sâu chợ của phần vượt. */
  DOC_BP: doThamSo('PHI51_DOC_BP', 700000),
  /** Trần hệ số bậc 2 (bp) — ×60. */
  TRAN_BP: doThamSo('PHI51_TRAN_BP', 600000),
} as const;

/**
 * D516 — ĐỘ SÂU CHỢ THEO VỐN VAI dưới cờ `phiSauVaiV57` (founder 05/10: "cân bằng lại 1 tý"). Vốn vai ×10 · ×20 · ×50 (D506) mà phí hai bậc
 * vẫn quy chiếu độ sâu `PHI_LENH_V50.DO_SAU_THI_TRUONG` ⇒ Cá Mập đặt 10 % vốn trả 14,5 % phí (chạm trần ×60), Cá nhân đặt 10 % vốn trả 0,3 %.
 * Độ sâu của ghế = DO_SAU × hệ_số_vốn^(MU_BP/10000). MU 0,75 (đo MC 600 trận, D516): lệnh 10 % vốn của Cá Mập về đúng suất bậc 1 như Cá nhân
 * (0,3 %), lệnh DỒN HẾT vẫn chạm trần (14,6 % so với 7,9 % của Cá nhân) — vốn to vẫn đắt khi vội, chỉ bớt bị nghiền. MU 0 = như cũ · MU 1 = đủ
 * tỷ lệ (đo: Tổ Chức vượt Cá nhân — quá tay). PLAYTEST-TUNE (A8.2).
 */
export const PHI_SAU_VAI_V57 = { MU_BP: doThamSo('PHI57_SAU_MU_BP', 7500) } as const;

// ---------------------------------------------------------------------------
// NĂM CÂU MỞ CỦA D24 (mục 10) — chốt theo khuyến nghị 20/07/2026.
// Để thành hằng số có tên: đổi ý = sửa một dòng, không phải viết lại engine.
// ---------------------------------------------------------------------------

export const HOLDEM_DECISIONS = {
  /**
   * Câu 1 — mô hình chốt phiên.
   * 'A' = bối cảnh là bài chung, danh mục là tay, PnL là độ mạnh tay, ai mạnh
   *       nhất ăn Quỹ vòng. Poker thật vì danh mục đối thủ bị giấu.
   * 'B' = PnL trừ thẳng Vốn, Quỹ vòng tách rời (double-count, rối hơn).
   */
  SHOWDOWN_MODEL: 'A' as 'A' | 'B',

  /**
   * Câu 2 — van casual. Trước ô thứ N, Vốn chạm sàn chứ KHÔNG bị loại, để
   * không ai bị loại vòng 2 rồi ngồi nhìn hết trận.
   * null = tắt van (cháy bất cứ lúc nào).
   */
  CASUAL_VALVE_UNTIL_ROUND: 4 as number | null,
  /** Sàn Vốn khi van còn hiệu lực (chip ảo). */
  CASUAL_VALVE_FLOOR: 500,

  /**
   * Câu 3 — lớp chiến thuật. 'auto' = thẻ hành-vi-tự-động (bỏ pipeline tham
   * số của loop cũ). 'pipeline' = giữ trình soạn quy tắc KHI→NẾU→THÌ.
   */
  TACTIC_LAYER: 'auto' as 'auto' | 'pipeline',

  /** Câu 3b — cỡ map MẶC ĐỊNH (trận cũ không có `so_o` replay bằng số này). */
  MAP_SIZE: 8,

  /**
   * D31 + founder 02/08 — CHỌN CỠ MAP CHỦ ĐỘNG ở sảnh: "người chơi tự chọn
   * phòng 8/12/16 lá". Server validate theo danh sách này; CHECK trong DB
   * (migration 0023) khoá cùng bộ số — thêm cỡ mới phải qua migration.
   */
  CO_MAP_CHON: [8, 12, 16],

  /**
   * D300 (founder 07/09: *"Bỏ map 8 đi cũng hợp lý nhỉ? Hoặc đổi lại map 12 thành
   * mặc định"*) — CỠ BÀN SẢNH CHỌN SẴN. TÁCH KHỎI `MAP_SIZE` có chủ ý: `MAP_SIZE` là số
   * thay cho trận CŨ không có cột `so_o` (replay) — đổi nó là dựng lại trận cũ sai;
   * còn đây là thứ người chơi mới gặp đầu tiên. Vai chỉ bốc ở bàn ≥ 12 (`holdem_api`)
   * và kỳ ngộ chỉ có ở 12/16 (`KY_NGO.VONG`), nên 8 làm mặc định là giấu hai cơ chế
   * lớn khỏi mọi trận đầu — đo 07/09: 8/9 trận prod trong 30 ngày là bàn 8, founder
   * chơi xong hỏi "vai đâu, kỳ ngộ đâu". Bàn 8 GIỮ trong `CO_MAP_CHON` (nhãn NHANH,
   * hồ sơ D177) và giữ trong engine cho replay; nó chỉ thôi là cửa vào.
   * Server phát ra catalog `quyet_dinh.MAP_MAC_DINH`; sảnh đọc, không gõ số.
   */
  MAP_MAC_DINH_SANH: 12,

  /**
   * MÀN TẬP (founder 02/08) — seed GHIM của bàn dạy người mới: ai vào màn tập
   * cũng gặp ĐÚNG bàn này (map, bot, thẻ như nhau) nên lời coach ở client nói
   * đúng đến TỪNG THẺ đang diễn ra.
   *
   * Seed này CHỌN TAY (quét 100 seed) vì chuỗi 8 ô của nó tự là một bài giảng
   * (founder: "thẻ thị trường cố định — làm hoàn chỉnh 1 chuỗi và giải thích
   * cách các sự kiện tác động lên nhau"). Map dưới balance-v18:
   *   V1 biến động · V2 THIÊN NGA ĐEN (TIN GIẢ!) · V3 biến động ·
   *   V4 KỲ HỌP ⚖ hạ lãi suất · V5 tăng · V6 BONG BÓNG (thật) · V7 tăng · V8 tăng
   * — có tin giả để dạy dư âm ĐẢO, và chuỗi kinh điển tiền-rẻ → tăng →
   * bong bóng → sức căng.
   *
   * ⚠ ĐỔI SỐ NÀY (hoặc đổi luật sinh map của version mặc định) = đổi bàn dạy
   * = PHẢI rà lại kịch bản BUOC trong web/src/components/holdem/CoachTap.tsx
   * cùng commit — coach đang gọi tên từng thẻ theo đúng thứ tự trên.
   */
  /*
   * ⚠⚠ ĐỔI 20260841 → 20260373 (04/08) VÌ BẬT v27 ĐÃ LÀM HỎNG BÀN CŨ.
   *
   * Seed thì ghim, nhưng LUẬT SINH MAP đổi thì dãy ô cũng đổi — và đó đúng là
   * thứ vừa xảy ra: bàn 20260841 dưới v27 KHÔNG CÒN ô bong bóng ở ô 6
   * (`6.[lam_phat] 7.giam 8.di_ngang`), trong khi CoachTap vẫn đang kể về một
   * bong bóng ở đó. Tức hướng dẫn nói một đằng, màn hình hiện một nẻo.
   * D50 đã dặn "đổi MAN_TAP_SEED phải rà lại kịch bản CoachTap"; đổi LUẬT có
   * đúng hậu quả ấy, và đó là chỗ dễ quên hơn nhiều.
   *
   * Seed mới chọn tay (quét dải 20260000–20261200, lọc: có hạ lãi TRƯỚC bong
   * bóng · bong bóng THẬT · chuỗi tăng rồi GÃY trong map · có ít nhất một tin
   * giả để đối chứng). Dãy nó kể trọn câu founder đặt ra 04/08:
   *
   *   ô 1  đi ngang            4,00%  trung tính
   *   ô 2  [THẢM HOẠ — GIẢ]    4,00%  ← tin bịa, và ô 3 chứng minh nó vô hại
   *   ô 3  giảm                4,00%
   *   ô 4  [HẠ LÃI SUẤT]       3,25%  TIỀN RẺ   ← kỳ họp, mức tụt QUA NGƯỠNG
   *   ô 5  tăng                3,25%
   *   ô 6  [BONG BÓNG — THẬT]  3,25%  ← tiền rẻ đẻ bong bóng
   *   ô 7  tăng                3,25%  ← chuỗi phồng
   *   ô 8  giảm                3,25%  ← GÃY: sập
   *
   * Cùng một bàn dạy được cả bốn bài: thật/giả · kỳ họp đổi môi trường · môi
   * trường đổi xác suất thẻ · chuỗi phồng rồi gãy. Bàn cũ không có cặp đối
   * chứng thật/giả của CÙNG một loại thẻ.
   * ⚠ Đổi seed hay đổi luật lần nữa thì PHẢI chạy lại `scripts/holdem_lai_suat_do.ts`
   * và rà lại `BUOC` trong `CoachTap.tsx` — lời ở đó gọi tên từng ô của bàn này.
   * ✅ ĐÃ QUÉT LẠI 08/08 khi lật `balance-v28-goc`: dãy 8 ô GIỮ NGUYÊN từng ô
   * dưới luật mới (may — các cú rút của seed này nằm cùng phía ở cả hai bảng
   * ngưỡng), nên seed không phải đổi; lời CoachTap đã cập nhật theo luật v28.
   */
  MAN_TAP_SEED: 20260373,

  /**
   * ⚠⚠ SEED MÀN TẬP CỦA v36 (D168) — RIÊNG, vì `regimeTick` đổi luật sinh map
   * và bàn cũ 20260373 THÔI KỂ ĐÚNG: dưới v36 nó ra `5.bien_dong … 8.tang`,
   * tức cú GÃY ở ô 8 mà CoachTap đang kể KHÔNG CÒN. Đúng hậu quả mà chú thích
   * MAN_TAP_SEED đã cảnh báo từ 04/08 ("đổi LUẬT có đúng hậu quả ấy, và đó là
   * chỗ dễ quên hơn nhiều") — lần này nó xảy ra thật.
   *
   * Bàn mới quét tay (20260000–20263000, khuôn ĐÚNG kịch bản CoachTap) — dãy
   * dưới v36, so với bàn cũ chỉ khác ô 2 (loại tin giả) và ô 5:
   *   ô 1  đi ngang            4,00%
   *   ô 2  [THẢM HOẠ — GIẢ]    4,00%  ← tin bịa
   *   ô 3  giảm                4,00%  ← và ô 3 chứng minh nó vô hại
   *   ô 4  [HẠ LÃI SUẤT]       3,25%  TIỀN RẺ (kỳ họp, tụt QUA NGƯỠNG)
   *   ô 5  PHỤC HỒI            3,25%  ← tin tốt THẬT vừa CẮT chuỗi giảm (v36!)
   *   ô 6  [BONG BÓNG — THẬT]  3,25%  ← tiền rẻ đẻ bong bóng
   *   ô 7  tăng                3,25%  ← chuỗi phồng
   *   ô 8  giảm                3,25%  ← GÃY
   * Dạy đủ bốn bài cũ CỘNG bài mới của v36: cú CẮT chuỗi xấu bằng tin tốt thật
   * (ô 4 → ô 5) — chính cơ chế thay thẻ recovery.
   * ⚠ Bàn 20260291 (bản D176) có cặp đối chứng CÙNG loại thẻ, đẹp hơn — nhưng
   * hồ sơ map 8 của D177 làm nó đổi, và quét 20 nghìn seed dưới hồ sơ mới
   * KHÔNG còn bàn nào vừa có cặp cùng loại vừa giữ đủ năm mốc kịch bản. Chọn
   * bàn giữ MỐC (ô 4 · 6 · 8 là ba chỗ CoachTap gọi tên) thay vì giữ bonus.
   * ⭐ Ba ô mà `CoachTap.tsx` GỌI TÊN (ô 4 kỳ họp · ô 6 bong bóng · ô 8 vỡ)
   * giữ nguyên như bàn cũ ⇒ không phải sửa một chữ lời nào.
   * ⚠⚠ SEED NÀY PHỤ THUỘC THAM SỐ MÁY TICK: chỉnh `REGIME_TICK` là bàn đổi.
   * Bàn 20260037 (bản D168) chết đúng kiểu đó khi cân lại gate ở D170 — quét
   * lại là bước CUỐI của mọi lượt chỉnh số, không phải bước đầu.
   */
  MAN_TAP_SEED_V36: 20260790,

  /**
   * ⚠⚠ D300 — MÀN TẬP CHUYỂN SANG BÀN 12 Ô (founder 07/09, đường C: bàn 12 làm mặc
   * định VÀ làm màn tập). Lý do không phải thẩm mỹ: vai chỉ bốc ở bàn ≥ 12
   * (`holdem_api`), kỳ ngộ chỉ có ở 12/16 (`KY_NGO.VONG`), nên bàn tập 8 ô VỀ CẤU
   * TRÚC không bao giờ dạy được hai cơ chế đó — founder chơi xong hỏi "vai đâu, kỳ
   * ngộ đâu" (07/09). Và bàn 20260790 đã kể sai từ 30/08: CoachTap gọi ô 2 là
   * "BONG BÓNG… tiền đang đắt" trong khi ô 2 là THẢM HOẠ giả với lãi suất trung
   * tính — test §VII chỉ khoá "ô 2 là tin giả", không khoá TÊN tin, nên xanh mà sai.
   *
   * Seed quét 07/09 (20260000–20299999, v36; bộ lọc: ô1 đi ngang · ô2 tin GIẢ · ô4
   * kỳ họp HẠ LÃI · PHỤC HỒI trong ô5–8 · BONG BÓNG thật sau đó rồi TĂNG rồi GIẢM ·
   * ô9 kỳ họp TĂNG LÃI · ≥ 6 ghế · người chơi bốc CÁ NHÂN) — 12 seed đạt, chọn bàn
   * 8 ghế có đủ ba vai đặc biệt:
   *   ô 1  đi ngang            4,00%
   *   ô 2  [HACK SÀN — GIẢ]    4,00%  ← tin đồn "sàn sắp sập"
   *   ô 3  giảm                4,00%  ← hoảng theo tin đồn
   *   ô 4  [HẠ LÃI SUẤT] ⚖     3,25%  TIỀN RẺ (kỳ họp, tụt qua ngưỡng)
   *   ô 5  PHỤC HỒI            3,25%  ← tin tốt THẬT (ô 4) cắt chuỗi giảm (v36)
   *   ô 6  biến động           3,25%
   *   ô 7  [BONG BÓNG — THẬT]  3,25%  ← tiền rẻ đẻ bong bóng; CŨNG là vòng KỲ NGỘ
   *   ô 8  tăng                3,25%  ← phồng
   *   ô 9  [TĂNG LÃI SUẤT] ⚖   4,00%  ← NHTW dập bong bóng (luật v35, dạy ở Hướng dẫn)
   *   ô 10–12 giảm ×3          4,00%  ← vỡ
   * Ghế: 8 · người chơi CÁ NHÂN · bàn có CÁ MẬP, TỔ CHỨC, ĐỘI LÁI.
   * ⚠ Khoá bằng HAI bài: `tests/regime_tick.test.ts` §VII (chuỗi ô + vai + kỳ ngộ) và
   * `web/tests/coach_ban_tap.test.ts` (lời CoachTap ↔ ô thật, neo tồn tại). Đổi seed,
   * chỉnh `REGIME_TICK`/`HO_SO_MAP`, hay lật một phiên bản đổi luật sinh map là hai bài
   * đó đỏ — đúng như phải thế: quét seed lại là bước CUỐI của mọi lượt chỉnh số.
   * Hai seed 8 ô ở trên GIỮ để nhận ra trận tập đã lưu (`laSeedManTap`).
   */
  MAN_TAP_SEED_12: 20276709,
  /**
   * D303 — BÀN TẬP 12 Ô CHO LUẬT CHU KỲ THỰC TẾ (v39 trở lên, mặc định v40 từ 07/09).
   * v39 đổi bộ số máy tick (`REGIME_TICK_THUC_TE`, `BONG_BONG_THUC_TE`…) nên seed
   * 20276709 sinh dãy ô khác hẳn — lật v40 mà giữ seed cũ là Oracle kể một bàn không
   * tồn tại (đúng cảnh báo ở docstring trên). Quét lại 07/09 trong 20260000–21259999
   * (1.000.000 seed): bộ lọc CHẶT "đúng 12 ô y hệt D300" ra 0 bàn — dưới bộ số v39 pha
   * tăng dài hơn nên "phục hồi → biến động → bong bóng" không còn xảy ra; bộ lọc theo
   * MỌI Ô COACHTAP KỂ (đi ngang · HACK SÀN giả · giảm · ⚖ HẠ LÃI · PHỤC HỒI · BONG BÓNG
   * thật ô 7 · tăng · ⚖ TĂNG LÃI ô 9 · giảm ×3; ≥ 6 ghế; người chơi CÁ NHÂN; bàn đủ CÁ
   * MẬP · TỔ CHỨC · ĐỘI LÁI) ra 2 bàn, chọn bàn đầu. Khác D300 đúng ô 6: TĂNG thay biến
   * động (phục hồi chảy thẳng vào tăng rồi bong bóng — sát đời hơn); không bước CoachTap
   * nào kể ô 6, nên lời giữ NGUYÊN. Lãi suất: 400 → ⚖4 hạ 325 (rẻ) → ⚖9 tăng 400.
   * Ghế: 8 · vai [CÁ NHÂN, cá nhân, TỔ CHỨC, ĐỘI LÁI, CÁ MẬP, cá nhân ×3]. Cùng hai bài
   * khoá như seed trên (`regime_tick` §VII D303 + `coach_ban_tap`).
   */
  MAN_TAP_SEED_THUC_TE: 20417769,
  /**
   * D433 (founder 27/09: bàn tập chạy luật trận thật MỚI NHẤT — v54) — SEED BÀN TẬP DƯỚI BÁNH XE. Bánh xe mùa (`banhXe`)
   * sinh dãy ô KHÁC trên cùng seed: 20417769 dưới v54 ra tăng · lạm phát giả · biến động · ⚖ TĂNG LÃI ở ô 4 … — Oracle kể
   * một bàn không tồn tại (đúng cảnh báo D302/D389). Quét 0–399.999 dưới `balance-v54-ngare`, 12 ô, lọc theo MỌI ô CoachTap
   * kể (ô 2 tin GIẢ · ⚖ HẠ LÃI thật ô 4 · PHỤC HỒI ô 5 · BONG BÓNG thật ô 7 · ⚖ TĂNG LÃI thật ô 9 · giảm ô 10) + ghế ≥ 6,
   * người chơi CÁ NHÂN, bàn đủ CÁ MẬP · TỔ CHỨC · ĐỘI LÁI ⇒ 3 bàn điểm cao nhất; chọn bàn đầu: đi ngang · HACK SÀN giả (báo
   * trước giảm) · giảm · ⚖ HẠ LÃI · phục hồi · phục hồi · BONG BÓNG · tăng · ⚖ TĂNG LÃI · giảm ×3 — trùng bàn 20417769/v52
   * TỪNG Ô trừ ô 6 (phục hồi thay tăng; không bước CoachTap nào kể ô 6). 8 ghế.
   * ⚠ v54 là Ô ÚP (`oUp`): ô của vòng k còn úp lúc đặt lệnh, chốt xong mới lật ⇒ bước KỂ ô k chạy ở vòng k+1 (CoachTap).
   */
  MAN_TAP_SEED_BANH_XE: 77004,
  /**
   * D445 → D448 (founder 28/09) — SEED BÀN TẬP DẠY ĐỌC LÁ + MÀU BÀN. Nền bàn thẻ (D442) đổi theo `xu_huong` công khai = HƯỚNG
   * của mùa ẩn khi mùa đã chạy ≥ 2 ô. D445 chọn 5601539 (lá mở màn ĐI NGANG xám trên nền ĐỎ) và cho Oracle nói tỷ lệ của
   * bánh xe; founder bác cả hai: *"Lá đầu trong màn hướng dẫn nên là lá xu hướng/ sự kiện để oracle hướng dẫn cách dựa vào
   * lá hiện tại để nhận biết chu kỳ và đoán lá tiếp theo"* · *"oracle ko nói xác suất cụ thể, dễ dính đòn (giáo dục ko thực
   * tiễn) chỉ dự đoán xu hướng dựa trên lá đang được lật thôi"*.
   * D448: quét CHẶT 0–14.000.000 dưới `balance-v54-ngare`, 12 ô, 8 ghế đủ CÁ MẬP · TỔ CHỨC · ĐỘI LÁI, người chơi CÁ NHÂN:
   * ô 1 GIẢM trên bàn ĐỎ, và MỌI ô mà các bước Oracle sau ghim (`keO` / `keMau`) trùng 5601539 ⇒ 14 seed, trạng thái ẩn
   * trùng 5601539 từ ô 2 tới ô 12 (mùa, tuổi mùa, lãi suất, cả xác suất mặt lá), khác đúng ô 1. Chấm cả 14 bằng CHÍNH đường
   * nghe-Oracle (`tests/ban_tap_sss.test.ts`, API thật): seed đầu tiên (1033864) chỉ lên SS ở vòng 8, SSS ở vòng 10 — thứ
   * tự vai bot khác đổi cả bàn ai dẫn NAV, mà thanh phong cách không vượt được thứ hạng. Chọn 9900694: chuỗi hạng
   * [S+, SS, SS, SSS, SSS, SSS, SSS] từ vòng 4 — TRÙNG TỪNG NẤC nhịp D433 (SS lúc phục hồi vòng 5, SSS lúc bong bóng thật
   * vòng 7), về nhất, màn kết SSS. Lời Oracle từ vòng 2 trở đi giữ nguyên ý, chỉ bỏ con số.
   * Dãy: giảm · giảm · đi ngang (đình trệ) · ⚖ hạ lãi · phục hồi ×2 · bong bóng · tăng · ⚖ tăng lãi · giảm ×3; màu bàn theo
   * vòng: đỏ · đỏ · xám ×3 · xanh ×4 · xám · đỏ. 5601539 chưa từng lên prod (D445 chưa ship) ⇒ không cần nhận ra nó nữa.
   * ⚠ Vẫn không có bài TIN GIẢ trước ô 9 (như D445).
   */
  MAN_TAP_SEED_MAU_BAN: 9900694,
  /**
   * D527 (founder 05/10: bàn tập *"6 ô"*, nhịp *"T-M-T-M-M"*) — SEED BÀN TẬP CỦA NHỊP XEN KẼ (khoá v58, 6 ô, 5 vòng). Quét 0–39.999
   * dưới `balance-v58-xenke` (tệp tạm `tim_seed`): ≥ 5 ghế · người chơi CÁ NHÂN · bàn đủ TỔ CHỨC · CÁ MẬP · ĐỘI LÁI (giữ luật D300:
   * bàn tập dạy được vai) · màn sau vòng 2 rơi vào cú rơi · một trong hai màn cuối rơi vào nhịp hồi ⇒ 128 seed; chọn 3823 (7 ghế).
   * Dãy (ô 1 mở màn): tăng → ⚡ DỊCH BỆNH → giảm → giảm → phục hồi → phục hồi — cú sốc, rơi, rồi hồi: màn vòng 2 trên cú rơi (QUÁ BÁN ·
   * dải giá trị có việc), màn 4 · 5 trên nhịp hồi. Quầy lõi vòng 1 ghim ở `MAN_TAP_LOI_XEN_KE` (Oracle gọi tên).
   */
  MAN_TAP_SEED_XEN_KE: 3823,
  /**
   * D545 — seed bàn tập khoá v62 (`kyHopBanTap`: kỳ họp cố định ô 3). Seed 3823 dưới v62 ra "tăng ×5 + biến động" (kỳ họp GIỮ hiện như ô
   * pha, dịch bệnh ô 2 bị dời vì luật né ô sát kỳ họp) — không dạy được gì. Dò 60.000 seed (`scripts_tam/do_seed_tap.ts`): kỳ họp ra TĂNG/HẠ,
   * đúng một sự kiện thật khác, chợ có lên có xuống, bàn đủ Cá Mập · Đội Lái · Tổ Chức, người chơi Cá nhân ⇒ chọn 29949 (8 ghế):
   * GIẢM → GIẢM → ⚖ HẠ LÃI SUẤT → PHỤC HỒI → 🎈 BONG BÓNG → TĂNG — chợ rơi, ngân hàng đỡ, tiền rẻ kéo chợ dậy rồi thổi bong bóng.
   */
  MAN_TAP_SEED_KY_HOP: 29949,
  /** D300 — cỡ bàn tập; server ghim qua `laTap`, thay cho số 8 gõ cứng. ⚠ Chỉ khoá cũ — nhịp xen kẽ dùng `MAN_TAP_SO_O_XEN_KE`. */
  MAN_TAP_SO_O: 12,
  /** D527 — cỡ bàn tập của nhịp xen kẽ (founder: *"6 ô"*): 5 vòng, lịch `NHIP_XEN_KE[6]`. Đọc qua `soOManTap`. */
  MAN_TAP_SO_O_XEN_KE: 6,
  /**
   * D392 — LUẬT CỦA BÀN TẬP GHIM RIÊNG, không đi theo `HOLDEM_BALANCE_VERSION`.
   * Seed 20417769 và kịch bản Oracle (`CoachTap`) viết cho nhịp v52: vòng k tính tiền bằng ô k
   * đang NGỬA (*"giá chạy theo ô HIỆN TẠI"*). Mặc định sang v53 (ô úp, vòng k tính bằng ô k+1)
   * thì bàn tập chạy một luật mà Oracle dạy luật khác — đo 23/09: làm đúng từng lời Oracle ra thứ
   * 4/8, ví 9.897 (lỗ) dưới v53; thứ 1/8, ví 208.440, hạng SSS dưới v52 (`tests/ban_tap_sss.test.ts`).
   * Đề buổi đo cũng ghim v52 (`config/holdem_de.ts`) ⇒ tester tập đúng luật mình sắp được đo.
   * ⚠ Seed không đổi: `seedManTap` của v52 và v53 là cùng một số (cả hai đều `chuKyThucTe`).
   * GỠ GHIM = sửa đúng dòng này, và chỉ khi CoachTap đã viết lại cho luật mới VÀ `ban_tap_sss` xanh
   * trên luật ấy. Không vào replay của trận cũ: mỗi trận tập đã lưu mang `balance_version` của nó.
   */
  /*
   * ⭐ D433 — GỠ GHIM v52 ⇒ v54 (founder 27/09: *"Bản mới nhất chuẩn bị deploy"* → hỏi lại → chọn v54, *"Làm v54 xong mới
   * deploy một lượt"*). Điều kiện gỡ ghi ngay trên được đáp: CoachTap viết lại cho ô úp (bước kể ô k chạy ở vòng k+1, lời
   * cược vào ô SẮP LẬT), seed bánh xe `MAN_TAP_SEED_BANH_XE`, và `ban_tap_sss` xanh trên v54. Đề buổi đo C/D vẫn ghim v52
   * (`config/holdem_de.ts`) — founder chấp nhận tester tập v54 rồi được đo trên đề v52.
   */
  /*
   * ⭐ D527 — GỠ GHIM v54 ⇒ v58 (founder 05/10: *"Bản local bạn vừa gửi tôi vẫn dùng bàn tập cũ mà"* → "Làm bàn tập rồi deploy"):
   * bàn tập chạy nhịp xen kẽ 6 ô (`MAN_TAP_SO_O_XEN_KE`) trên seed `MAN_TAP_SEED_XEN_KE`, trợ lý `KICH_BAN_MINIGAME`. Kịch bản v54
   * (`KICH_BAN`) giữ cho trận tập v54 còn dở — mỗi trận mang `balance_version` của nó.
   */
  /*
   * ⭐ D530 — v58 ⇒ v60 (cùng luật trận thật): founder 06/10 chọn lõi CHỈ tác động trong màn, và *"Bàn tập ko cần dạy hết đâu. Dạy mấy cái
   * chính thôi"* ⇒ bàn tập theo đúng luật trận thật (nguyên tắc D527) dù kê lệnh không có bước dạy. Lời trợ lý "khoản đổi theo đúng phần trăm"
   * chỉ ĐÚNG khi lõi không chạy ngoài màn — ở v58 Đòn Bẩy vẫn ×2 mọi vòng. Seed / số ô giữ nguyên (cờ `nhipXenKe` vẫn bật).
   */
  /* D536 — v60 ⇒ v61 cùng luật trận thật (nguyên tắc D527/D530); lệnh lớn không cần bước dạy (chỉ dạy cái CHÍNH). */
  /* D545 — v61 ⇒ v62: bàn tập có kỳ họp ở ô 3. */
  MAN_TAP_BALANCE_VERSION: 'balance-v62-kyhoptap',

  /**
   * MÀN TẬP — SỐ VÒNG ĐẦU KHÔNG CHẠY ĐỒNG HỒ (founder 02/08: "làm bộ đếm tạm
   * thời dừng ở mấy vòng hướng dẫn đầu"). Bốn vòng đầu là lúc Oracle nói
   * nhiều nhất (tour chức năng + hai bài thẻ đầu); bắt người mới vừa đọc vừa
   * đua đồng hồ là dạy trong lúc họ hoảng.
   *
   * ⚠ MIỄN GIỜ CHỈ Ở BÀN TẬP (seed ghim) và CHỈ mấy vòng đầu — nửa sau bàn
   * tập vẫn chạy giờ thật, để người chơi nếm áp lực TRƯỚC khi ra trận thật.
   *
   * ⭐ 15/09 (D336, founder chọn A): 4 → 9. Số 4 chốt 02/08 cho bàn tập 8 vòng, lúc
   * "bốn vòng đầu là lúc Oracle nói nhiều nhất". Bàn 12 vòng thì 15/35 bước — gồm
   * cả hai bước bắt thao tác (chọn kỳ ngộ V7, chọn kỳ hạn gửi V9) — nằm ở vòng 5–12;
   * tự chơi trên dev thấy máy chốt hộ giữa lúc Oracle đang nói và bài của vòng đó
   * hết hạn giữa câu. Vòng 9 là vòng dạy có thao tác CUỐI CÙNG; 10–12 vẫn chạy giờ
   * thật — ý "nếm áp lực trước trận thật" của 02/08 giữ nguyên.
   * Không vào replay (đồng hồ chỉ quyết khi nào máy chốt hộ, nước đi đã ghi log) ⇒
   * không cần cổng `balance_version`.
   */
  MAN_TAP_MIEN_GIO_DEN_VONG: 9,

  /**
   * BỘ LÕI GHIM CỦA BÀN TẬP (founder 02/08: "làm chiến thuật cố định riêng
   * cho vòng này luôn để hướng dẫn chứ không ngẫu nhiên"). `bayShop` tra bảng
   * này khi seed === MAN_TAP_SEED — mọi người chơi (và mọi lần khảo sát lại)
   * thấy đúng bộ lá này ở đúng vòng, nên Oracle gọi tên được từng lá.
   *
   * Cấu trúc bài dạy: V2 một lá THÔNG TIN + một lá PHÒNG THỦ (hai triết lý);
   * V3 RỦI RO + TRẢI RỘNG; V4 chào lại LƯỚT SÓNG cạnh BÁN KHỐNG — ai lấy
   * Lướt Sóng ở V2 sẽ thấy nhãn "ĐANG CẦM ×1 → LẤY = CẤP 2" (dạy nâng cấp),
   * và Bán Khống gieo trước cho bài bong bóng V6.
   * ⚠ Đổi bảng = đổi lời Oracle (CoachTap.tsx) cùng commit.
   */
  MAN_TAP_LOI: {
    2: ['luot_song', 'chan_lo'],
    3: ['don_bay', 'da_dang_hoa'],
    4: ['ban_khong', 'luot_song'],
  } as Record<number, readonly string[]>,

  /**
   * BỘ LÕI GHIM CỦA BÀN TẬP DƯỚI NHỊP GIÃN (v33, D90 M1) — cùng ba cặp, dời
   * sang đúng ba vòng lá mới (2·4·6). Bài dạy KHÔNG đổi: V2 thông tin + phòng
   * thủ · V4 rủi ro + trải rộng · V6 chào lại LƯỚT SÓNG cạnh BÁN KHỐNG (dạy
   * nâng cấp qua lá trùng, và gieo Bán Khống ngay trước bài bong bóng).
   *
   * ⚠ BẢNG RIÊNG, KHÔNG SỬA BẢNG CŨ: `bayShop` là hàm tất định của (seed, vòng)
   * và bot đọc chính list nó trả, nên thêm một khoá vào bảng cũ là đổi shop —
   * tức đổi hành vi bot — của mọi trận tập ĐÃ LƯU. Cổng theo version, y như mọi
   * lần đụng thứ nằm trên đường replay.
   */
  /**
   * D433 — BỘ LÕI GHIM CỦA BÀN TẬP DƯỚI LÕI GỌN (v54, `loiGon`). Năm lõi bị động (`LOI_BI_CAT`) đã rời kệ trận thật, nên
   * bảng nhịp giãn bên dưới (có CHẶN LỖ · ĐA DẠNG HOÁ) sẽ chào lá không còn tồn tại. Cùng ba vòng lá (2·4·6) và cùng bài dạy:
   * V2 LƯỚT SÓNG (Oracle gọi tên) cạnh BẮT ĐÁY · V4 ĐÒN BẨY (Oracle gọi tên) cạnh MUA ĐUỔI · V6 chào lại LƯỚT SÓNG cạnh BÁN
   * KHỐNG (dạy nâng cấp qua lá trùng, gieo Bán Khống trước bài bong bóng).
   * ⚠ BẢNG RIÊNG theo cờ `loiGon` — y lý do của bảng giãn: `bayShop` tất định theo (seed, vòng), bot đọc chính list nó.
   */
  MAN_TAP_LOI_GON: {
    2: ['luot_song', 'bat_day'],
    4: ['don_bay', 'mua_duoi'],
    6: ['ban_khong', 'luot_song'],
  } as Record<number, readonly string[]>,

  /**
   * D527 — QUẦY LÕI GHIM CỦA BÀN TẬP NHỊP XEN KẼ (lượt lõi duy nhất: vòng 1). BẮT ĐÁY + ĐÒN BẨY — hai lõi trợ lý dạy (đường giá trị ·
   * QUÁ BÁN · ký quỹ). Ghim theo ĐÚNG seed `MAN_TAP_SEED_XEN_KE` (không theo cờ): seed mới, chưa trận nào khác mang nó, nên không đổi
   * shop của trận đã lưu nào. ⚠ Đổi bảng = đổi lời Oracle (`KICH_BAN_MINIGAME`) cùng commit.
   */
  MAN_TAP_LOI_XEN_KE: {
    1: ['bat_day', 'don_bay'],
  } as Record<number, readonly string[]>,

  MAN_TAP_LOI_GIAN: {
    2: ['luot_song', 'chan_lo'],
    4: ['don_bay', 'da_dang_hoa'],
    6: ['ban_khong', 'luot_song'],
  } as Record<number, readonly string[]>,

  /**
   * Câu 4 — vé vào. 0 = free (lát 1–2). Cắm vé Q phải chờ Q-core, và khi bật
   * thì là PHÍ PHẲNG vào hệ thống, KHÔNG BAO GIỜ là pot P2P (D24 mục 1).
   */
  ENTRY_TICKET_Q: 0,

  /**
   * MỞ KHOÁ THEO TRẬN ĐÃ XONG (D86 founder chốt 15/08; thi công 17/08).
   *
   * Khẩu vị rủi ro từ CÀI ĐẶT thành PHẦN THƯỞNG — mốc nhìn thấy được
   * từ trận đầu ("còn 2 trận nữa"). Thước là **trận ĐÃ XONG** (`holdem_results`,
   * `demTranXong`), KHÔNG phải trận mở: D62 đo 105 bỏ dở / 50 xong ⇒ đếm trận mở
   * là farm được bằng cách mở rồi thoát.
   *
   * ⚠ ĐÂY KHÔNG PHẢI THỨ D90 BÁC. D90 bác thang "NHẬP MÔN 3 mã · không lá ·
   * không bảng" — tức CẮT NỘI DUNG TRONG TRẬN theo trình độ, làm người mới và
   * người cũ chơi HAI TRÒ khác nhau. Ở đây mọi người chơi CÙNG một trò với đủ
   * mọi cơ chế; thứ mở dần chỉ là ĐỘ DÀI ván và một hệ số PnL tự chọn. Founder
   * 17/08: *"mấy cái mở cỡ map hay khẩu vị thì liên quan đ** gì phân biệt trong
   * trận đâu"*.
   *
   * ⭐ Khoá khẩu vị còn là CÁI LỢI DATA (D86): những trận đầu của MỌI người cùng hệ
   * số PnL ⇒ mẫu đối chứng sạch trước khi biến số mở, và cú CHỌN khẩu vị ngay sau đó
   * thành tín hiệu có-trước/có-sau. D307 co cửa sổ này từ 5 xuống 3 trận (founder
   * chốt) — số đọc ở `MO_KHOA.KHAU_VI`, đừng chép lại vào đây.
   *
   * ⚠ MIỄN cho BÀN CHUNG và BÀN NGÀY: ở đó cỡ map do BÀN quyết (cùng một đề) và
   * khẩu vị bị ghim, nên không có gì để "chọn" — chặn ở đó là chặn người mới khỏi
   * thứ đang kéo người quay lại (thử thách hôm nay) vì một luật nói về quyền CHỌN.
   * PLAYTEST-TUNE — founder chỉnh số, không đụng engine.
   */
  MO_KHOA: {
    /**
     * ⚠⚠ KHOÁ CỠ BÀN ĐÃ GỠ HẲN — founder 08/09 (D307): *"nếu đã quyết định để map 12
     * làm mặc định thì bỏ cơ chế khóa map 12 đi, giờ chỉ còn khóa khẩu vị rủi ro thôi
     * (3 trận để mở)"*.
     *
     * Đường đi của khoá này: D86 (15/08) khoá cả ba cỡ (12 cần 3 trận, 16 cần 8) →
     * D300 (07/09) gỡ 12 vì nó thành cỡ mặc định, còn `{16: 8}` → D307 gỡ nốt 16.
     * Lý do gỡ nốt: khi 12 ô là mặc định thì mọi cơ chế lớn (VAI · KỲ NGỘ) đã có ở
     * trận đầu, nên khoá 16 ô không còn giữ lại thứ gì để "mở dần" — nó chỉ còn chặn
     * độ DÀI ván, tức chặn đúng người đang muốn chơi nhiều hơn. Phần thưởng-mở-dần
     * dồn hết vào MỘT khoá duy nhất là khẩu vị rủi ro, cho mốc đó rõ nghĩa.
     *
     * `CO_MAP` bị XOÁ khỏi bảng thay vì để `{}`: một bảng rỗng là một cơ chế còn sống
     * mà không ai thấy, và sáu tháng sau sẽ có người "khôi phục" nó (A8.9 — thứ tạm
     * phải có ngày chết). Cửa API `co_map` GIỮ trong DTO và luôn trả đủ cỡ, để client
     * cũ trong cache không vỡ.
     */
    /**
     * Chọn khẩu vị rủi ro (khác `can_bang`) mở sau ngần này trận ĐÃ XONG.
     * D307 hạ 5 → 3 (founder chốt). ⚠ Cái giá đã biết: cửa sổ đối chứng sạch của D86
     * (mọi người cùng hệ số PnL ở N trận đầu) co từ 5 xuống 3 trận — mẫu mỏng hơn cho
     * phép so có-trước/có-sau, đổi lấy việc người chơi chạm được nút chọn sớm hơn.
     */
    KHAU_VI: 3,
  },

  /**
   * THỬ THÁCH HÔM NAY (D85 §5.2, founder chốt "cả hai"; thi công 17/08) — MỘT bàn
   * chung cho cả ngày, ai cũng chơi cùng seed cùng bot, xong thì thấy PHÂN VỊ
   * của mình so với cả sân (D32: phân vị, KHÔNG top-N). Nền của KÈO T (D95:
   * "kèo T CHỈ ở BÀN NGÀY — một seed/ngày ⇒ một túi/ngày").
   *
   * · SO_O 12 — cỡ CHUẨN (D31 mặc định), có kỳ ngộ ở vòng 7 (D86) ⇒ mỗi ngày
   *   một cú xoay chiều để so cách đọc; map 8 giữ THUẦN làm đối chứng (D86) nên
   *   không lấy 8; 16 dài (~14') cho một việc "mỗi ngày một lần".
   * · KHAU_VI ghim `can_bang` cho MỌI người: phân vị so NAV mà hệ số PnL khác
   *   nhau thì hai người cùng đọc đúng ra hai NAV — bảng hết công bằng (D31),
   *   và "cùng một kích thích cho mọi người" (D85 §5.2 — data controlled) đòi
   *   cả hệ số cũng cùng. Khẩu vị tự chọn vẫn nguyên ở bàn tự do/rank/đội.
   * · Ngày tính theo Asia/Ho_Chi_Minh (A8.8): bàn đóng cửa VÀO lúc 0:00 VN,
   *   trận đã mở thì chơi nốt (hạn trận 45' riêng).
   * PLAYTEST-TUNE — hai số đầu founder chỉnh được, không đụng engine.
   */
  THU_THACH_NGAY: {
    SO_O: 12,
    KHAU_VI: 'can_bang' as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Cấu trúc trận
// ---------------------------------------------------------------------------

export const HOLDEM_MATCH = {
  /** Số ghế gồm cả người chơi (còn lại là bot/bóng). */
  /**
   * Số ghế MẶC ĐỊNH. Từ D3 (25/07/2026) mỗi trận có thể 4–8 ghế; hằng số này chỉ
   * còn là giá trị tham chiếu cho cân bằng (xem `DONG_QUY_CHIEU`) và cho map cũ.
   * Số ghế THẬT của một trận nằm ở `ghe_json` trong DB — xem `soGheTuSeed`.
   */
  SEATS: 5,
  /** Vốn khởi điểm — bằng nhau mọi ghế (D24 mục 3: thí nghiệm có kiểm soát). */
  START_VON: 10000,
  /** Lượt khảo sát khởi điểm + cấp thêm mỗi vòng. */
  START_LUOT_KHAO_SAT: 2,
  LUOT_KHAO_SAT_MOI_VONG: 1,
  /** Khảo sát lại lần đầu mỗi vòng miễn phí; từ lần 2 tốn ngần này. */
  CHI_PHI_KHAO_SAT_LAI: 2,
  /*
   * Shop mỗi vòng: **CẢ 6 mã tài sản** (chung cả bàn, không rút thăm — founder
   * chốt 27/07, spec 01 §4) + 2 thẻ chiến thuật RIÊNG.
   *
   * ⚠ `SHOP_TAI_SAN: 3` ĐÃ GỠ, không phải quên. Sau khi chợ bày đủ 6 mã thì nó
   * không điều khiển gì nữa, và một hằng số còn tên mà hết tác dụng chính là
   * bẫy "cơ chế trang trí" của repo này (đã gặp 9 lần). Số mã bày = `TAI_SAN.length`.
   */
  SHOP_CHIEN_THUAT: 2,
  /**
   * Sức chứa danh mục — ép chọn, tạo xung đột (D24 mục 16.9).
   *
   * ⚠ CHIẾN THUẬT LÊN 3 (D34 điều 4, 27/07). Trước đó là 2, và con số 2 khớp
   * đúng hai vòng chiến thuật của nhịp cũ. D34 chốt BA lần chọn thẻ chiến thuật
   * trải đều từ vòng 2 → ⌈số_ô/2⌉, nên sức chứa phải theo: 2 ô mà 3 lần chọn thì
   * lần thứ ba là một cú bấm không có chỗ để đặt.
   *
   * ⚠ BẤT BIẾN "VỪA KHÍT" CỦA FOUNDER (20/07) ĐÃ CHẾT CÙNG NHỊP CŨ — ghi rõ ở
   * đây để không ai đi tìm lại nó. Nhịp cũ cho ĐÚNG 4 vòng tài sản + 2 vòng
   * chiến thuật, khớp tuyệt đối sức chứa 4+2. Nhịp D34 co theo cỡ map nên số
   * vòng tài sản đổi theo map:
   *       map  8 → 3 vòng tài sản · 3 vòng chiến thuật
   *       map 12 → 7 · 3
   *       map 16 → 11 · 3
   * Chỉ vế CHIẾN THUẬT còn khít (3 ô = 3 lần chọn, và D34 gắn All-in vào đúng
   * lần thứ ba). Vế TÀI SẢN nay là một TRẦN chứ không phải một phép đếm: map
   * ngắn thì thiếu vòng để lấp đủ 4 ô (Đa Dạng Hoá bù lại được — 2 lá/vòng),
   * map dài thì thừa vòng và người chơi phải chọn stack hay dàn mỏng. Cả hai
   * đều là quyết định thật, nên đây là hệ quả CHẤP NHẬN của D34, không phải lỗi.
   */
  /*
   * ⚠ 4 → 3, FOUNDER CHỐT 27/07 (spec 01 §4): *"Tối đa 3 loại tài sản trừ khi có
   * lõi đa dạng hóa"*. Đây là tham số kinh tế — agent KHÔNG được tự chỉnh (A8.2);
   * con số 3 là của founder, không phải kết quả đo.
   *
   * Đọc cùng đoạn ở trên cho đúng: đoạn đó viết khi trần còn là 4 và khi chợ còn
   * bày 3 lá ngẫu nhiên mỗi vòng, nên câu "map ngắn thiếu vòng để lấp đủ 4 ô" nay
   * KHÔNG còn đúng — spec 01 mở chợ ở MỌI vòng và cho phân bổ tự do, nên trần
   * này thôi là hệ quả của nhịp vòng và trở lại đúng nghĩa một TRẦN RỦI RO:
   * dàn tối đa 3 mã, muốn rộng hơn thì phải trả bằng một ô chiến thuật.
   */
  MAX_TAI_SAN: 3,
  MAX_CHIEN_THUAT: 3,
  /** Cam kết nền mỗi vòng (chip ảo vào Quỹ vòng, ai cũng phải bỏ). */
  CAM_KET_NEN: 500,
  /** Trần một lần Tăng cam kết, theo % Vốn hiện có (bp). */
  TRAN_TANG_CAM_KET_BP: 4000,
} as const;

export type LoaiTheVong = 'tai_san' | 'chien_thuat' | 'khong' | 'ky_ngo';

/**
 * NHỊP CHỌN BÀI — vòng nào được lấy loại thẻ nào.
 *
 * ─── D34 ĐIỀU 4 (founder chốt 27/07): NHỊP CO THEO ĐƯỜNG CONG ───────────────
 * Ba lần chọn CHIẾN THUẬT trải đều từ vòng 2 tới vòng ⌈số_ô / 2⌉, tức All-in
 * mở đúng GIỮA TRẬN ở mọi cỡ map:
 *       map  8 → 2 · 3 · 4    (All-in từ vòng 4, 50%)
 *       map 12 → 2 · 4 · 6    (All-in từ vòng 6, 50%)
 *       map 16 → 2 · 5 · 8    (All-in từ vòng 8, 50%)
 *
 * ⚠ ĐÂY LÀ TỔNG QUÁT HOÁ, KHÔNG PHẢI THAY LUẬT. Map 12 (mặc định của D31) ra
 * ĐÚNG 2/4/6 — chính là luật "1 thẻ mỗi 2 vòng" founder đặt ban đầu. Luật cũ là
 * trường hợp riêng của luật mới tại cỡ map mặc định. Nếu ai đó "sửa" hàm này về
 * bước cố định 2 vòng thì map 8 và map 16 lệch khỏi mốc 50% mà founder chốt.
 *
 * ⚠ VÌ SAO LÀ HÀM CHỨ KHÔNG CÒN LÀ MẢNG HẰNG: nhịp nay PHỤ THUỘC CỠ MAP. Một
 * mảng hằng chỉ đúng ở đúng một cỡ, và D31 sắp mở 8/12/16 — mảng hằng nghĩa là
 * hai cỡ kia âm thầm dùng nhịp của cỡ thứ ba.
 *
 * Phần còn lại giữ nguyên tinh thần bản 20/07: hai vòng CUỐI không có shop (chỉ
 * còn cam kết thuần, đúng khúc river), mọi vòng khác là tài sản.
 */
export const SO_THE_CHIEN_THUAT = 3;

/** Hai vòng cuối không có shop — xem docstring `nhipChonBai`. */
export const SO_VONG_CUOI_KHONG_SHOP = 2;

/**
 * Ba vòng được chọn thẻ chiến thuật ở một cỡ map. Tăng dần, không trùng.
 *
 * Công thức: `2 + round(k × (H − 2) / (SO_THE − 1))` với `H = ⌈số_ô / 2⌉`.
 * Map quá ngắn (H ≤ 2) thì ba mốc dồn lại — `dedup + đẩy lên` giữ cho vẫn đủ ba
 * vòng khác nhau thay vì im lặng mất một lần chọn.
 */
export function vongChonChienThuat(soO: number, gianLa = false, minigame = false, xenKe = false): number[] {
  // D526 — NHỊP XEN KẼ (cờ `nhipXenKe`): lượt lõi đọc thẳng lịch của cỡ bàn (`NHIP_XEN_KE`). Cỡ không có trong bảng ⇒ rơi về khung minigame.
  const lich = minigame && xenKe ? NHIP_XEN_KE[soO] : undefined;
  if (lich) return [...lich.loi];
  /*
   * D473 — KHUNG MINIGAME (v57, cờ `dongHoMinigame`; founder 04/10 *"cho user chọn lõi ngay trận đầu đi thay vì trait"*): lượt lõi ĐẦU dời về
   * vòng 1 (có lõi trước màn minigame đầu tiên ở vòng 2), hai lượt sau giữ nhịp cũ ⇒ bàn 12: 1 · 4 · 6. Lượt thứ ba (vòng 6) chỉ dành cho ghế
   * cầm trait khẩu vị đa dạng — trần lõi theo ghế ở `LOI_MINIGAME`. Vắng cờ ⇒ nhịp cũ, byte-hệt.
   */
  if (minigame) {
    const goc = vongChonChienThuat(soO, gianLa);
    return [1, ...goc.slice(1)];
  }
  /*
   * M1 (D90, cổng v33 — founder 17/08 "làm hết"): MAP NGẮN GIÃN RA "1 lá / 2
   * vòng" — map 8 chọn lá ở 2·4·6 thay vì 2·3·4.
   *
   * Vì sao chỉ map ngắn: công thức D34 trải đều từ vòng 2 tới ⌈soO/2⌉ nên map 8
   * dồn thành BA VÒNG LIỀN (2·3·4) — augment ba nhịp liên tiếp, thứ TFT không
   * bao giờ làm; map 12 vốn đã ra đúng 2·4·6 (chính luật gốc founder đặt) và
   * map 16 ra 2·5·8, cả hai đều đã giãn. D34 đã ghi sẵn hướng này: *"cho map
   * ngắn mở SỚM HƠN 50%… phải chọn một trong hai"*.
   * ⚠ ĐÁNH ĐỔI ĐÃ KHAI: All-in ở map 8 mở từ vòng 6 (75%) thay vì vòng 4 (50%)
   * — mốc 50%-mọi-map của D34 mất ở map ngắn. Đổi lại vòng 1·3 chỉ còn ĐÚNG
   * MỘT việc (mua/bán/đọc thẻ), đúng "ván bắt đầu nhỏ".
   * ⚠ CẦN CỔNG `balance_version`: nhịp là luật engine (bot lấy lá theo nhịp,
   * `giayChonBai` đọc nó) ⇒ đổi thẳng là viết lại mọi trận map 8 đã lưu.
   */
  if (gianLa && soO <= 8) {
    const ra: number[] = [];
    for (let k = 0; k < SO_THE_CHIEN_THUAT; k += 1) {
      const v = 2 + 2 * k;
      // Không tràn vào khúc river không shop — thà trùng công thức cũ còn hơn
      // mời chọn lá ở vòng đã khoá.
      if (v <= soO - SO_VONG_CUOI_KHONG_SHOP) ra.push(v);
    }
    if (ra.length === SO_THE_CHIEN_THUAT) return ra;
    // Map quá ngắn để giãn ⇒ rơi về công thức D34 (không bao giờ mất một lượt lá).
  }
  const cuoi = Math.max(2, Math.ceil(soO / 2));
  const ra: number[] = [];
  for (let k = 0; k < SO_THE_CHIEN_THUAT; k += 1) {
    const tho = 2 + Math.round((k * (cuoi - 2)) / (SO_THE_CHIEN_THUAT - 1));
    // Không trùng vòng đã lấy: mốc sau luôn ít nhất là mốc trước + 1.
    const truoc = ra[ra.length - 1];
    ra.push(truoc === undefined ? tho : Math.max(tho, truoc + 1));
  }
  return ra;
}

/**
 * Bảng nhịp đầy đủ của một cỡ map (chỉ số 0 = vòng 1).
 *
 * `kyNgo` (v32) — vòng kỳ ngộ THAY một vòng `tai_san`, KHÔNG chèn thêm vòng
 * (doc 06 §1.4: map 16 có 11 vòng mua tài sản, chính nhịp lặp đó là "dài lê
 * thê"). Mặc định `false` nên mọi chỗ gọi cũ ra bảng byte-hệt: trận trước v32
 * đọc nhịp y như trước, và `giayChonBai` — thứ duy nhất trong engine hỏi hàm
 * này — chỉ so `=== 'chien_thuat'` nên đồng hồ không nhúc nhích.
 *
 * ⚠ Kỳ ngộ CHỈ được đặt lên vòng vốn là `tai_san`. Đè lên `chien_thuat` là mất
 * một lần chọn thẻ (All-in không bao giờ mở); đè lên `khong` là mời chọn nhiệm
 * vụ ở khúc river không còn gì để làm. `KY_NGO.VONG` đã chọn đúng, và có test
 * canh — nhưng phép lọc dưới đây là thứ giữ cho một lần chỉnh số sau này không
 * âm thầm ăn mất một vòng chiến thuật.
 */
export function nhipChonBai(soO: number, kyNgo = false, gianLa = false, minigame = false, xenKe = false): LoaiTheVong[] {
  const ct = new Set(vongChonChienThuat(soO, gianLa, minigame, xenKe));
  const ra: LoaiTheVong[] = [];
  for (let v = 1; v <= soO; v += 1) {
    if (v > soO - SO_VONG_CUOI_KHONG_SHOP) ra.push('khong');
    else if (ct.has(v)) ra.push('chien_thuat');
    else if (kyNgo && laVongKyNgo(v, soO)) ra.push('ky_ngo');
    else ra.push('tai_san');
  }
  return ra;
}

/**
 * Loại thẻ được lấy ở vòng này. Ngoài map thì không có shop.
 *
 * ⚠ `soO` có mặc định để mọi chỗ gọi cũ không gãy, NHƯNG người gọi ở server
 * PHẢI truyền `st.map.o.length`. Dựa vào mặc định là dựa vào `MAP_SIZE` toàn
 * cục — đúng cái bẫy mà bản mảng-hằng vừa gỡ.
 */
export function loaiTheVong(
  vong: number, soO: number = HOLDEM_DECISIONS.MAP_SIZE, gianLa = false, minigame = false, xenKe = false,
): LoaiTheVong {
  return nhipChonBai(soO, false, gianLa, minigame, xenKe)[vong - 1] ?? 'khong';
}

/**
 * D473 — LUẬT LÕI CỦA KHUNG MINIGAME (v57; founder 04/10: *"A, phải có trait khẩu vị đa dạng ở đầu thì mới cho phép đổi lõi lượt 3, với user
 * bình thường thì ko có"*): giữ tối đa 2 lõi (demo "Hai lá"), trait khẩu vị đa dạng (`tam_rong`, kế hoạch §6b TẦM TAY) mở lượt 3 và trần 3.
 * All-in mở khi đủ 2 lõi khác nhau (khuyến nghị agent — founder chưa trả lời câu All-in; đổi một số ở đây). PLAYTEST-TUNE.
 */
export const LOI_MINIGAME = { TOI_DA: 2, TOI_DA_KHAU_VI: 3, ALL_IN_KHI: 2, TRAIT_LUOT_3: 'tam_rong' } as const;

/**
 * ALL-IN + "lật bài đến hết giờ" ĐÃ MỞ CHƯA (D34 điều 4).
 *
 * Điều kiện: đã chốt đủ `SO_THE_CHIEN_THUAT` thẻ chiến thuật KHÁC NHAU.
 * Đếm theo Ô (Set) chứ không theo số lá: bản sao là NÂNG CẤP (xem `heSoStackBp`),
 * mua ba bản của cùng một thẻ không phải là "đã chọn xong cả ba".
 */
export function allInDaMo(soTheChienThuatKhacNhau: number): boolean {
  return soTheChienThuatKhacNhau >= SO_THE_CHIEN_THUAT;
}

/**
 * Bảng nhịp của cỡ map MẶC ĐỊNH — chỉ để catalog/test khỏi gọi hàm ở mọi chỗ.
 * KHÔNG dùng để quyết luật trong engine: engine phải hỏi theo map thật.
 */
export const NHIP_CHON_BAI: readonly LoaiTheVong[] =
  nhipChonBai(HOLDEM_DECISIONS.MAP_SIZE);

// ───────────────────────────────────────────────────────────────────────────────
// MA TRẬN TƯƠNG QUAN TÀI SẢN — D39 (founder 27/07)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * TƯƠNG QUAN GIỮA CÁC TÀI SẢN, ĐỔI THEO CHẾ ĐỘ THỊ TRƯỜNG.
 *
 * Founder 27/07: *"logic cộng gộp tuyến tính đang hơi ngây thơ khi thiếu đi tính
 * tương quan giữa các loại tài sản trong các sự kiện đặc biệt"* → *"Được, thêm ma
 * trận tương quan giữa các tài sản"*.
 *
 * ─── CHẨN ĐOÁN, ĐỌC TỪ CODE ─────────────────────────────────────────────────
 * `dungChuoi` rút nhiễu THEO TỪNG MÃ: `rngAt(seed,'holdem_nhieu', vòng, tsId)` —
 * độc lập hoàn toàn. Nên giữ 4 mã là trung bình hoá mất khoảng một nửa cú sốc,
 * LUÔN LUÔN, kể cả giữa Thiên nga đen.
 *
 * Nói chính xác: ma trận sự kiện CÓ kéo các mã cùng chiều — nhưng đó là phần KỲ
 * VỌNG, thứ đoán trước được. Phần NGẪU NHIÊN thì không bao giờ cùng chiều, nên kết
 * quả của một danh mục dàn đều luôn hội tụ về cái đã biết. Không có hỗn loạn, và
 * vì thế không có khoảnh khắc "mọi thứ sụp cùng lúc" — đúng thứ founder muốn có.
 *
 * ─── VÌ SAO KHÔNG GÕ THẲNG MỘT BẢNG 6×6 ─────────────────────────────────────
 * ⚠ MỘT MA TRẬN TƯƠNG QUAN GÕ TAY GẦN NHƯ CHẮC CHẮN KHÔNG HỢP LỆ. Ma trận tương
 * quan phải nửa xác định dương; một bảng 36 số điền bằng cảm giác thì hầu như luôn
 * vi phạm, và khi đó KHÔNG TỒN TẠI bộ biến ngẫu nhiên nào có đúng các tương quan
 * ấy. Sinh số theo nó sẽ ra một thứ khác — im lặng, không lỗi, và không ai phát
 * hiện được bằng mắt. Đúng lớp bệnh mà repo này đã dính tám lần.
 *
 * Nên dùng MÔ HÌNH MỘT NHÂN TỐ (đúng "market model" của tài chính thật):
 *
 *      nhiễu_i = β_i · SỐC_CHUNG  +  √(1 − β_i²) · nhiễu_riêng_i
 *
 * Từ đó ma trận sinh ra chứ không phải điền vào:  **ρ_ij = β_i · β_j**
 *  · HỢP LỆ THEO CẤU TRÚC — không cách nào viết ra một ma trận không hợp lệ.
 *  · 2 số mỗi chế độ thay vì 36, nên chỉnh cân bằng còn khả thi.
 *  · Hệ số √(1−β²) giữ ĐỘ BIẾN ĐỘNG RIÊNG CỦA TỪNG MÃ Y NGUYÊN như trước. Thứ duy
 *    nhất đổi là mức CÙNG NHỊP. Nếu chỉ cộng thêm cú sốc chung mà không co phần
 *    riêng thì tổng biến động phình lên và mọi thứ dữ dội hơn vì một lý do SAI —
 *    lúc đó không tách được "tương quan làm khó" khỏi "chỉ là ồn hơn".
 *
 * ─── MỖI SỰ KIỆN MỘT CHỮ KÝ, VÀ ĐÓ LÀ PHẦN DẠY ĐƯỢC ─────────────────────────
 * Đây mới là chỗ nó thành kiến thức thật (A1) chứ không phải một cần gạt độ khó:
 *  · KHỦNG HOẢNG THANH KHOẢN (hack sàn, thiên nga đen) — β của cả hai nhóm cùng
 *    DƯƠNG và cao: người ta bán CẢ VÀNG để lấy tiền mặt trả ký quỹ. Đây đúng là
 *    lúc "phân tán không cứu được", và nó có thật (tháng 3/2020).
 *  · CHIẾN TRANH — β phòng thủ ÂM đậm: vàng hộ giá thật.
 *  · LẠM PHÁT / TĂNG LÃI SUẤT — trái phiếu rơi CÙNG cổ phiếu (chữ ký 2022), nhưng
 *    vàng vẫn giữ vai trò hộ giá. Nên `rieng.vang` âm còn nhóm phòng thủ dương.
 *  · BONG BÓNG — β rủi ro cao mà theo chiều LÊN: mọi thứ cùng bay, và chính cái
 *    cùng-bay đó là lý do cú sập sau đó quét sạch.
 *
 * ⚠ SỐ KHỞI ĐẦU, đánh dấu MC-TUNE. Phải chạy Monte Carlo trước khi tin, và hai con
 * số phải theo dõi là TỶ LỆ CHÁY (đang 30–50%, vượt ~60% thì hạ β) và thứ hạng của
 * CHẶN LỖ (đang 12,0% về nhất — thấp hơn cả ô trống; tương quan phải kéo nó lên mà
 * không phải sửa một con số nào của chính lá đó).
 */
export const TUONG_QUAN = {
  /** Vòng THƯỜNG (ô giai đoạn): phân tán vẫn có tác dụng thật. */ // MC-TUNE
  BETA_NEN: { rui_ro: 3000, phong_thu: -1500 } as Record<NhomTaiSan, number>,

  /**
   * β theo NHÓM cho từng sự kiện, kèm `rieng` để đè cho vài mã có hành vi khác
   * hẳn nhóm của nó. Theo nhóm chứ không theo từng mã: 7 sự kiện × 6 mã = 42 số
   * là quá nhiều để chỉnh và quá nhiều để biện minh.
   */ // MC-TUNE
  BETA_SU_KIEN: {
    // Ai cũng bán để lấy tiền mặt — kể cả vàng. Phân tán thất bại đúng lúc cần nhất.
    hack_san: { rui_ro: 8500, phong_thu: 4000 },
    thien_nga_den: { rui_ro: 8000, phong_thu: 3000 },
    // 5 mặt đuôi (bước 7) — chữ ký KHÁC NHAU là lý do tồn tại của cả bảng §6.2:
    // phải có đuôi mà đa dạng hoá THẮNG (hẹp) và đuôi mà nó GÃY (rộng).
    phap_ly: { rui_ro: 5000, phong_thu: 1000 },
    // Phá sản dây chuyền = 🏦 khủng hoảng thanh khoản: bán cả vàng bù ký quỹ.
    pha_san: { rui_ro: 8500, phong_thu: 4000 },
    cam_van: { rui_ro: 7000, phong_thu: -4000 },
    tham_hoa: { rui_ro: 4000, phong_thu: 1000 },
    dich_benh: { rui_ro: 8000, phong_thu: 2500, rieng: { tpcp: -2000 } },
    // Vàng hộ giá THẬT trong chiến tranh.
    chien_tranh: { rui_ro: 7000, phong_thu: -4000 },
    // Chữ ký 2022: trái phiếu rơi cùng cổ phiếu, riêng vàng vẫn hộ.
    lam_phat: { rui_ro: 6000, phong_thu: 2000, rieng: { vang: -3000 } },
    tang_lai_suat: { rui_ro: 6500, phong_thu: 2500, rieng: { vang: -2000 } },
    // Mọi thứ cùng bay — và chính cái cùng-bay là lý do cú sập sau quét sạch.
    bong_bong: { rui_ro: 7500, phong_thu: -1000 },
    ha_lai_suat: { rui_ro: 6000, phong_thu: 1000 },
  } as Record<string, { rui_ro: number; phong_thu: number; rieng?: Record<string, number> }>,
} as const;

/**
 * β của một mã trong bối cảnh hiện tại, theo bp. `suKien` null ⇒ ô giai đoạn.
 *
 * Kẹp trong [−9900, +9900] chứ không [−10000, 10000]: β = ±1 làm `√(1−β²)` = 0,
 * tức mã đó MẤT HẲN phần nhiễu riêng và trở thành bản sao chính xác của cú sốc
 * chung. Lúc ấy hai mã cùng nhóm là MỘT tài sản, và "danh mục 4 mã" thành một lời
 * nói dối trên màn hình.
 */
/*
 * ═══ v44 (D315) — LỚP TƯƠNG QUAN CỦA BỘ TÀI SẢN v2 ═══════════════════════════
 *
 * D311 đổi ĐỘ LỚN của ba hàng (`MT_TAI_SAN_*_V42`) nhưng KHÔNG đụng tương quan — và
 * đó là một lỗ hổng có thật, founder chỉ ra 09/09. Hệ quả cụ thể:
 *
 *  · **USDT** trung bình ăn đòn đúng ở ba mặt tin crypto, nhưng phần RỦI RO RIÊNG vẫn
 *    y như đô la. Mà cái làm một cú MẤT NEO khác hẳn một cú chợ chung đi xuống chính là
 *    chỗ đó: 03/2023 USDC rời neo còn 0,878 trong khi phần còn lại của chợ không sao.
 *    β cao ⇒ mã đi theo cú sốc CHUNG; β thấp/riêng ⇒ nó có đường đi của riêng nó.
 *  · **CP Chứng khoán** được tôi mô tả là "lên xuống mạnh hơn cả thị trường nó phục vụ"
 *    trong chính sổ nguồn, rồi để nguyên β và `bien_dong_bp` của CP Công nghệ. Bộ số và
 *    lời giải thích của nó mâu thuẫn nhau.
 *
 * ⚠⚠ VÌ SAO LÀ CỔNG MỚI (v44) CHỨ KHÔNG SỬA THẲNG VÀO v42: v42 ĐÃ LÀ MẶC ĐỊNH và đang
 * chạy trên prod từ 09/09. Sửa số của một phiên bản đang sống là viết lại kết quả những
 * trận đang được chơi bằng nó (A11.3). Bảng `TUONG_QUAN` dùng chung mọi phiên bản, nên
 * lớp đè này PHẢI đọc qua cờ — đó là lý do `betaCua` mọc thêm tham số `bo`.
 */
export const BETA_V44 = {
  /**
   * Đè β NỀN (ô giai đoạn) cho TỪNG MÃ. v40–v42 không có khái niệm này: `BETA_NEN` chỉ
   * có hai số theo NHÓM, nên "CTCK bám chỉ số chặt hơn VN30" là điều bộ máy cũ **không
   * diễn đạt được**. Đây là chỗ mô hình được nới, không phải một con số được vặn.
   *
   * `cp_cn` 3000 → 5500: công ty chứng khoán là một cú đặt cược đòn bẩy vào THANH KHOẢN
   * của chính thị trường nó phục vụ — nó không có đường đi riêng như một công ty công
   * nghệ có sản phẩm riêng. Nguồn: 2021 VN-Index +35,7% / nhóm ≈ +190%; 2022 −32,8% /
   * ≈ −63% (sổ nguồn v42 §3.3). Cùng chiều, biên độ nhân lên — đó là β cao, không phải
   * nhiễu riêng cao.
   */
  NEN_RIENG: { cp_cn: 5500 } as Record<string, number>,
  /**
   * Đè β theo TỪNG MÃ ở ba mặt tin mà USDT KHÔNG hành xử như đô la. Số dương lớn = đi
   * theo cú sốc chung; ở đây cố ý ĐỂ THẤP so nhóm `phong_thu` của chính ba sự kiện đó,
   * vì cú mất neo là chuyện của RIÊNG nó, không phải chuyện cả chợ.
   *
   * `hack_san` 4000 → 1500 · `phap_ly` 1000 → 500 · `pha_san` 4000 → 1000.
   * Nguồn (sổ nguồn v42 §3.2): USDT 0,95 ngày 12/05/2022 (Luna) · USDC 0,878 tháng
   * 3/2023 (SVB) — cả hai lần phần còn lại của chợ KHÔNG cùng rơi theo cách đó.
   */
  SU_KIEN_RIENG: {
    hack_san: { usd: 1500 },
    phap_ly: { usd: 500 },
    pha_san: { usd: 1000 },
  } as Record<string, Record<string, number>>,
  /**
   * Đè `bien_dong_bp` (biên nhiễu nền của mã). `cp_cn` 280 → 380: nhóm CTCK dao động xa
   * hơn hẳn nhóm công nghệ, và phần dôi ra ấy KHÔNG phải β (β đã tính ở trên) mà là
   * phương sai riêng — thanh khoản sàn VN co giãn theo những thứ chỉ số không nói.
   * ⚠ `TaiSan.bien_dong_bp` là trường dùng chung mọi phiên bản; đè qua đây chứ không sửa
   * `TAI_SAN`, cùng lý do với β.
   */
  BIEN_DONG_RIENG: { cp_cn: 380 } as Record<string, number>,
} as const;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * v45 (D318) — RÀ LẠI BIÊN NHIỄU BỐN MÃ CÒN LẠI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * D315 đè `bien_dong_bp` cho ĐÚNG `cp_cn` và tự ghi vào §Còn mở: *"bien_dong_bp
 * của bốn mã còn lại chưa rà lại"*. Đây là lượt rà đó.
 *
 * Đo bằng TỶ LỆ, không bằng số tuyệt đối — `bien_dong_bp` là biên nhiễu của
 * engine, không phải một con số phần trăm ngoài đời, nên thứ so được là **mã
 * này ồn gấp mấy lần VN30**. Giữ `vn30 = 170` làm mốc neo và không đụng vào nó:
 * đổi mốc là đổi cả sáu tỷ lệ cùng lúc, và không đối chứng được với gì.
 *
 * | mã     | cũ  | tỷ lệ cũ | ĐỜI THẬT | mới | tỷ lệ mới |
 * |--------|----:|---------:|---------:|----:|----------:|
 * | btc    | 400 |    2,35× |    ~3,25 | 500 |     2,94× |
 * | cp_cn  | 380 |    2,24× |    ~2,25 | 380 |     2,24× |  (v44, đã đúng)
 * | vn30   | 170 |    1,00× |     1,00 | 170 |     1,00× |  (mốc neo)
 * | vang   | 240 |    1,41× |    ~0,75 | 150 |     0,88× |
 * | usd    | 150 |    0,88× |   ~0,025 |  70 |     0,41× |
 * | tpcp   | 160 |    0,94× |    ~0,35 |  90 |     0,53× |
 *
 * Nguồn (biến động năm, dài hạn): BTC ≈ 65% · CTCK VN ≈ 45% · VN30 ≈ 20% ·
 * vàng ≈ 15% · tổng lợi suất 10 năm Mỹ ≈ 7% · USDT ≈ 0,5% ngoài các cú mất neo.
 *
 * ⚠⚠ BA MÃ PHÒNG THỦ CỐ Ý DỪNG TRÊN CON SỐ THẬT, và đây là chỗ phải khai chứ
 * không lặng lẽ. Chép USDT đúng tỷ lệ thật (0,025×) là biến nó thành một lá
 * KHÔNG BAO GIỜ nhúc nhích — một ô chết trên bàn, và người chơi thôi phải nghĩ
 * về nó. Cái đúng đã được sửa ở TẦNG KHÁC: v44 cho USDT β riêng ở ba mặt tin
 * crypto, tức rủi ro thật của nó nay nằm ở **mất neo**, không nằm ở nhiễu nền.
 * Nên bản này kéo nhiễu nền xuống MẠNH (0,88× → 0,41×) mà vẫn để nó thở. Cùng
 * lý lẽ, nhẹ hơn, cho vàng và trái phiếu.
 *
 * ⭐ Thứ bộ số này SỬA ĐƯỢC: trước v45, "phân tán sang tài sản phòng thủ" gần
 * như không giảm phương sai — vàng ồn hơn VN30 và trái phiếu gần bằng. Tức lời
 * khuyên trung tâm của cả trò (đa dạng hoá có giá trị) bị chính bộ số bác bỏ.
 */
export const BIEN_DONG_V45: Record<string, number> = {
  btc: doThamSo('BD45_BTC', 500),
  vang: doThamSo('BD45_VANG', 150),
  usd: doThamSo('BD45_USD', 70),
  tpcp: doThamSo('BD45_TPCP', 90),
};

/** Biên nhiễu nền của mã: lớp đè v45 (rà bốn mã) trên lớp v44 (`cp_cn`). */
export function bienDongCua(
  ts: { id: string; bien_dong_bp: number }, betaV2: boolean, bienDongV45 = false,
): number {
  /*
   * ⚠ THỨ TỰ: v45 TRƯỚC v44. Hai lớp không giao nhau (v44 chỉ `cp_cn`, v45 chỉ
   * bốn mã còn lại) nên hôm nay thứ tự không đổi kết quả — nhưng viết rõ ràng
   * để ngày ai đó thêm một mã vào cả hai bảng thì luật đã có sẵn: lớp MỚI thắng.
   */
  if (bienDongV45 && BIEN_DONG_V45[ts.id] !== undefined) return BIEN_DONG_V45[ts.id]!;
  return betaV2 ? (BETA_V44.BIEN_DONG_RIENG[ts.id] ?? ts.bien_dong_bp) : ts.bien_dong_bp;
}

export function betaCua(
  maTaiSan: string, nhom: NhomTaiSan, suKien: string | null,
  /** v44 (D315) — bật lớp đè `BETA_V44`. Vắng ⇒ hành vi v40–v42, byte-hệt. */
  betaV2 = false,
): number {
  const bang = suKien ? TUONG_QUAN.BETA_SU_KIEN[suKien] : undefined;
  const de = betaV2
    ? (suKien ? BETA_V44.SU_KIEN_RIENG[suKien]?.[maTaiSan] : BETA_V44.NEN_RIENG[maTaiSan])
    : undefined;
  const tho = de ?? (bang
    ? (bang.rieng?.[maTaiSan] ?? bang[nhom])
    : TUONG_QUAN.BETA_NEN[nhom]);
  return Math.max(-9900, Math.min(9900, tho));
}

/**
 * Hệ số phần nhiễu RIÊNG: `√(1 − β²)` tính trong thang bp, bằng số nguyên.
 *
 * Đây là thứ giữ tổng biến động của từng mã KHÔNG ĐỔI so với trước D39 — nên mọi
 * chênh lệch Monte Carlo đo được sau đây chỉ có thể đến từ mức CÙNG NHỊP, không
 * lẫn với "engine vừa ồn hơn".
 */
export function heSoRiengBp(betaBp: number): number {
  const b = Math.min(10000, Math.abs(betaBp));
  return isqrt(10000 * 10000 - b * b);
}

/**
 * Tương quan giữa hai mã trong một bối cảnh — `ρ_ij = β_i · β_j`, thang bp.
 * Không dùng trong engine; đây là cửa để TEST và công cụ đo đọc ra ma trận thật
 * mà engine đang chạy, thay vì đọc lại bảng số rồi tự nhân.
 */
export function tuongQuanBp(
  maA: string, nhomA: NhomTaiSan, maB: string, nhomB: NhomTaiSan, suKien: string | null,
): number {
  return Math.round(
    (betaCua(maA, nhomA, suKien) * betaCua(maB, nhomB, suKien)) / 10000);
}

// ───────────────────────────────────────────────────────────────────────────────
// ĐỒNG HỒ TRẬN — D38 (founder 27/07)
// ───────────────────────────────────────────────────────────────────────────────

/**
 * ĐỒNG HỒ VÒNG + HẠN TRẬN.
 *
 * *"khi vào ván bài mà thoát ra ngoài không chơi nữa dù có cả ngày quay trở lại vẫn
 * là ván bài đó (trong chế độ đấu bot), điều này làm giảm khả năng lưu trữ và tối
 * ưu. Hãy cho mốc time tối đa cho 1 trận và thời gian cố định các round lật bài
 * thay vì vô hạn."* — founder 27/07.
 *
 * ─── HAI THỨ HỎNG, KHÁC NHAU, ĐÃ TRA RA ─────────────────────────────────────
 *  1. TRƯỚC FILE NÀY, REPO KHÔNG CÓ MỘT HẰNG SỐ THỜI GIAN NÀO. D15 từng thiết kế
 *     "trận ≤12 vòng (60s+45s)" nhưng chưa bao giờ được cài. Thứ duy nhất trông
 *     giống đồng hồ là `NHIP.TU_NOP_VONG = 2000` bên web — đó là 2 giây chờ ANIMATION
 *     khi đã all-in và chỉ còn ngồi xem, không phải hạn ra quyết định.
 *  2. `holdem_matches.status` cho phép `'bo_dở'` NHƯNG KHÔNG DÒNG CODE NÀO GHI GIÁ
 *     TRỊ ĐÓ. Nên mọi trận rời dở nằm mãi ở `dang_choi` — đúng hiện tượng founder
 *     gặp. Đây là bẫy số 1 của repo (một nhánh tồn tại mà không có đường chạy) ở
 *     dạng schema, lần thứ 9.
 *
 * ─── VÌ SAO CHIA HAI PHA CHỨ KHÔNG MỘT ĐỒNG HỒ CHUNG ────────────────────────
 * Hai pha trong một vòng khác nhau về BẢN CHẤT, nên một con số chung sẽ hoặc quá
 * chật cho pha này hoặc quá rề cho pha kia:
 *  · PHA CHỌN BÀI (shop · đảo danh mục · mở Bảng điện tử) là chơi MỘT MÌNH — không
 *    ai phải đợi ai. Dài thì chỉ tự mình sốt ruột.
 *  · PHA CAM KẾT (giữ · tăng · cắt lỗ · all-in) là chơi VỚI NGƯỜI — và đây là chỗ
 *    lừa nhau. Ở đây thời gian là thứ ĐANG BỊ ĐỢI, mà đợi người khác là thứ nhàm
 *    nhất trong một trò chơi theo lượt.
 *
 * ⚠ PHA CAM KẾT DÙNG ĐỒNG HỒ THEO LƯỢT, KHÔNG PHẢI THEO PHA. Một vòng cược có thể
 * có nhiều lượt tố qua lại. Nếu cấp 20s cho CẢ pha thì ai tố ở giây thứ 19 là không
 * còn ai kịp phản ứng — tức luật thưởng cho việc bấm chậm, và làm chết đúng cái
 * chiều đấu trí mà D35 vừa chẩn là đang thiếu. Nên: mỗi lượt một khoảng riêng, có
 * TRẦN TỔNG để vòng không kéo vô hạn.
 *
 * ─── NGÂN SÁCH THỜI GIAN THẬT (map 8 · mặc định) ─────────────────────────────
 *   vòng 1        45s chọn bài (nhiều việc nhất, chưa biết gì)  + ~24s cam kết
 *   vòng thường   25s chọn bài                                   + ~24s cam kết
 *   vòng chọn thẻ 25 + 12 = 37s (thẻ chiến thuật là chọn VĨNH VIỄN — D34)
 *   ⇒ map 8 ≈ 6–7 phút · map 12 ≈ 9–10 phút · map 16 ≈ 12–13 phút
 * Đây là cỡ một trận mobile lành mạnh. KHÔNG lấy 30–40 phút của TFT làm mốc: TFT là
 * game để ngồi máy, còn đây mở trên điện thoại giữa giờ nghỉ.
 *
 * ⚠ CÁC SỐ NÀY CHƯA QUA PLAYTEST NGƯỜI THẬT. Monte Carlo KHÔNG đo được "cảm giác
 * lâu" — chỉ người thật đo được (đúng như đã ghi ở căng thẳng thiết kế 19/07: "bot
 * không đo được vui"). Đánh dấu PLAYTEST-TUNE, không phải MC-TUNE.
 */
export const DONG_HO = {
  /** Pha chọn bài, vòng MỞ BÀN. */ // PLAYTEST-TUNE
  CHON_BAI_VONG_1_S: doThamSo('DH_CHON_BAI_VONG_1_S', 45),
  /** Pha chọn bài, vòng thường. */ // PLAYTEST-TUNE
  CHON_BAI_S: doThamSo('DH_CHON_BAI_S', 25),
  /**
   * Cộng thêm ở vòng được chọn THẺ CHIẾN THUẬT (D34) — chọn vĩnh viễn, đáng nghĩ.
   * D442 (founder 27/09 tối: *"Thời gian nghĩ hiện tại hơi ít cho mấy vòng chọn lõi/ trait"*) — 12 → 25.
   */ // PLAYTEST-TUNE
  CHON_BAI_THEM_KHI_CO_THE_S: doThamSo('DH_CHON_BAI_THEM_S', 25),
  /**
   * D442 — cộng thêm ở vòng MỐC CHỢ TRAIT (v55: bàn 16 mốc 1 · 6 · 9 · 13) — đọc sáu lá, cân về 0, lá mang tới hết trận.
   * Trước D442 vòng này không được cộng gì (chỉ vòng lõi được +12). Cộng qua `themGiayTrait` (server/holdem/dong_ho.ts)
   * — một nguồn cho payload lẫn mọi cửa soi hạn, cùng nếp `themGiayKyNgo`.
   */ // PLAYTEST-TUNE
  CHON_TRAIT_THEM_S: doThamSo('DH_CHON_TRAIT_THEM_S', 25),

  /**
   * ĐỆM XEM KẾT QUẢ (founder báo lỗi 08/08) — cộng vào hạn của MỌI VÒNG TỪ
   * VÒNG 2, vì mốc `vong_mo_luc` của vòng N+1 đặt NGAY tại commit của vòng N:
   * toàn bộ thời gian xem khoảnh khắc (2,1s/cái, trần 12s) + đọc số neon +
   * bảng VÌ SAO đều bị TRỪ vào 25s của vòng mới. Đo prod 08/08: founder ĐANG
   * NGỒI TẠI MÀN (khớp lệnh giây 13, nộp tay vòng kế) mà vẫn bị chốt hộ
   * `tu_dong` hai vòng trong một trận — họ đang đọc kết quả, không phải rê giờ.
   *
   * Đây là hoàn thiện D38 chứ không phải nới lỏng: 25s của D38 là ngân sách
   * cho pha QUYẾT ĐỊNH; thời gian ĐỌC KẾT QUẢ chưa từng được cấp ngân sách ở
   * đâu cả (ChainReveal/VÌ SAO ra đời sau D38, và D74/D75 vừa làm nó đáng đọc
   * hơn). Vòng 1 không có kết quả để đọc nên KHÔNG có đệm.
   */ // PLAYTEST-TUNE
  XEM_KET_QUA_S: doThamSo('DH_XEM_KET_QUA_S', 15),

  /**
   * Đồng hồ MỖI LƯỢT ở pha cam kết (shot clock). Reset mỗi khi có người tố lại.
   *
   * 12s là đủ để đọc mức cam kết của đối thủ rồi quyết, và ngắn đủ để việc bấm
   * chậm không thành một chiến thuật.
   */ // PLAYTEST-TUNE
  CAM_KET_MOI_LUOT_S: doThamSo('DH_CAM_KET_LUOT_S', 12),
  /** Trần TỔNG của một pha cam kết — chặn vòng tố qua lại vô hạn. */ // PLAYTEST-TUNE
  CAM_KET_TRAN_S: doThamSo('DH_CAM_KET_TRAN_S', 60),

  /**
   * HẾT GIỜ = GIỮ NGUYÊN, và PHẢI ĐƯỢC ĐÁNH DẤU LÀ TỰ ĐỘNG.
   *
   * ⚠ ĐÂY LÀ ĐIỂM CHẠM A1, KHÔNG PHẢI CHI TIẾT KỸ THUẬT. "Không làm gì" và "cố ý
   * giữ vị thế" ra CÙNG một nước đi nhưng là HAI hành vi khác nhau về bản chất tâm
   * lý. Nếu log gộp chúng thành một thì cột khẩu vị rủi ro — tín hiệu B2B đắt nhất
   * (A1) — bị pha loãng bởi những lần người chơi chỉ đơn giản là đang bận. Không
   * sửa lại được về sau vì `events` là append-only (A3.3).
   * ⇒ Mọi nước do hết giờ sinh ra phải mang cờ `tu_dong: true` trong `action_log`
   *   và trong event.
   */
  HET_GIO_LA_GIU_NGUYEN: true,

  /**
   * ÂN HẠN MẤT MẠNG — mất kết nối/đổi app thì không mất vòng ngay.
   *
   * Vì sao cần: đây là app điện thoại, và cú "app chạy nền 10 giây" xảy ra thường
   * xuyên hơn cú "người chơi cố tình rê". Không có ân hạn thì đồng hồ trở thành
   * hình phạt cho chất lượng mạng, không phải cho sự chần chừ.
   */ // PLAYTEST-TUNE
  AN_HAN_S: doThamSo('DH_AN_HAN_S', 8),

  /**
   * HẠN TRẬN — quá hạn thì trận thành `bo_dở`, không còn tiếp được.
   *
   * TÍNH TỪ `vong_mo_luc` (lúc vòng hiện tại mở) CHỨ KHÔNG TỪ `started_at`: người
   * chơi đánh chậm mà đánh liên tục thì không đáng bị cắt giữa trận, còn người rời
   * đi thì `vong_mo_luc` đứng yên và hạn tự tới.
   *
   * 45 phút: đủ rộng để một cuộc điện thoại hay một chuyến xe không giết trận, đủ
   * chặt để "cả ngày sau quay lại vẫn ván đó" không xảy ra nữa.
   */ // PLAYTEST-TUNE
  HAN_TRAN_PHUT: doThamSo('DH_HAN_TRAN_PHUT', 45),

  /**
   * HẠN TRẬN khi vòng hiện tại đang MIỄN GIỜ (màn tập vòng 1–4, D53).
   *
   * Màn hình hứa "TẠM DỪNG ∞" thì hạn 45 phút cắt ngang là một lời nói dối —
   * đúng lớp lỗi mà D53 dựng `manTapMienGio` để tránh. Nhưng ∞ THẬT thì trận
   * bỏ dở ở vòng 1 (đa số tuyệt đối theo D62) không bao giờ được dọn. 24 giờ:
   * không người thật nào đọc lời Oracle lâu hơn thế, và bảng vẫn sạch.
   */
  HAN_TRAN_TAP_PHUT: doThamSo('DH_HAN_TRAN_TAP_PHUT', 24 * 60),
} as const;

/**
 * ĐỒNG HỒ NHỊP NGẮN (D457, cổng `dongHoMinigame` — khoá v57 minigame, bước 2; founder 03/10: *"chia tiền 5 s"*, đồng hồ rút gọn).
 *
 * Mỗi vòng có lõi sẽ dài ~69 s (đặt lệnh · khoá + lật thẻ · chọn lá · minigame 38 s · chia tiền) — dài hơn vòng cũ ~25 s — nên
 * phần ĐẶT LỆNH và ĐỌC KẾT QUẢ phải co lại, vì chọn mã giờ chủ yếu là chọn MAP. Bước 2 đổi HAI số (D457), D459 thêm hai số nữa;
 * các số còn lại của `DONG_HO` giữ nguyên:
 *   · vòng 1 vẫn 45 s (bốc vai · chợ trait · chưa có lõi);
 *   · phần CỘNG THÊM ở vòng lõi / mốc trait: D459 (founder 03/10: *"Co về +20s"*) — 20 s thay cho 25 s của D442, KHÔNG về 12 s
 *     của trước D442 (founder 27/09: 12 s quá ít để đọc sáu lá trait). Hằng riêng của khung này; khoá cũ vẫn đọc `DONG_HO`;
 *   · khoảnh khắc từng vòng thôi diễn (dồn về màn cuối trận) — 5 s không chứa nổi chúng.
 * Ba số CHỪA KHUNG cho minigame (bước 4) dưới đây CHƯA được tính vào hạn vòng: chưa có màn chơi thì cộng 46 s trống vào mỗi vòng
 * chỉ làm bàn thử nghiệm chậm đi. Bước 4 mới nối chúng vào `giayChonBai`.
 * Mọi số PLAYTEST-TUNE (A8.2) — founder chốt bằng lựa chọn A ngày 03/10, không phải agent tự đặt.
 */
export const DONG_HO_MINIGAME = {
  /** Pha đặt lệnh vòng ≥ 2 — thay `DONG_HO.CHON_BAI_S` (25). */ // PLAYTEST-TUNE
  CHON_BAI_S: doThamSo('DHM_CHON_BAI_S', 15),
  /** Đọc kết quả + chia tiền ở đầu vòng ≥ 2 — thay `DONG_HO.XEM_KET_QUA_S` (15). */ // PLAYTEST-TUNE
  XEM_KET_QUA_S: doThamSo('DHM_XEM_KET_QUA_S', 5),
  /**
   * Cộng thêm ở vòng LÕI (vòng có quầy thẻ chiến thuật — bàn 12: 2 · 4 · 6) — thay `DONG_HO.CHON_BAI_THEM_KHI_CO_THE_S` (25, D442).
   * D459 (founder 03/10: *"Co về +20s"*).
   */ // PLAYTEST-TUNE
  CHON_BAI_THEM_KHI_CO_THE_S: doThamSo('DHM_CHON_BAI_THEM_S', 20),
  /** Cộng thêm ở vòng MỐC CHỢ TRAIT (bàn 12: 1 · 5 · 9) — thay `DONG_HO.CHON_TRAIT_THEM_S` (25, D442); cộng qua `themGiayTrait`. D459. */ // PLAYTEST-TUNE
  CHON_TRAIT_THEM_S: doThamSo('DHM_CHON_TRAIT_THEM_S', 20),
  /**
   * D526 — chợ trait của NHỊP XEN KẼ (cờ `nhipXenKe`) là một CHẶNG thay chỗ màn minigame, không phải phần cộng vào pha đặt lệnh ⇒ dài hơn
   * (founder 05/10 trên demo nhịp trận: *"Cho thêm thời gian chọn trait"* — 25 s → 45 s). Cộng qua `themGiayTrait`.
   */ // PLAYTEST-TUNE
  CHON_TRAIT_XEN_KE_S: doThamSo('DHM_CHON_TRAIT_XEN_KE_S', 45),
  /** D473 — khoá lệnh + lật thẻ trước màn (kế hoạch §2 ghi 2,6 s; làm tròn lên giây cho đồng hồ số nguyên). */ // PLAYTEST-TUNE
  LAT_THE_S: 3,
  /** Màn chọn lá kiểu TFT, bấm vào lá là chọn. D473: tính vào hạn vòng kế (`giayManMinigame`). */ // PLAYTEST-TUNE
  CHON_LA_S: 8,
  /** Đếm ngược đầu màn chơi, chung cho MỌI lá (founder: 4 s + 34 s). Màn trên server đọc ở `server/holdem/minigame/man.ts` (D466); chưa tính vào hạn vòng (bước 4). */
  DEM_NGUOC_S: 4,
  /** Thời gian đồ thị chạy, chung cho MỌI lá — 480 nhịp giá (D466, `man.ts`); chưa tính vào hạn vòng (bước 4). */
  CHAY_S: 34,
} as const;

/**
 * Số giây của PHA CHỌN BÀI ở một vòng cụ thể. Hàm chứ không phải mảng, vì nhịp
 * chọn thẻ chiến thuật phụ thuộc CỠ MAP (D34 — `vongChonChienThuat`).
 */
export function giayChonBai(
  vong: number, soO: number, gianLa = false,
  /** D457 — cổng `dongHoMinigame`: đặt lệnh và đọc kết quả co lại (`DONG_HO_MINIGAME`). Vắng = đồng hồ cũ, byte-hệt. */
  dongHoMinigame = false,
  /** D526 — cờ `nhipXenKe`: màn của vòng trước chỉ chiếm giờ khi lịch có màn ở vòng đó (`coManMinigame`); lõi theo `NHIP_XEN_KE`. */
  xenKe = false,
  /** D561 — cờ `loiChonTruoc`: màn không còn pha chọn lá. */
  loiChonTruoc = false,
): number {
  const nen = vong <= 1 ? DONG_HO.CHON_BAI_VONG_1_S
    : dongHoMinigame ? DONG_HO_MINIGAME.CHON_BAI_S : DONG_HO.CHON_BAI_S;
  const coThe = loaiTheVong(vong, soO, gianLa, dongHoMinigame, xenKe) === 'chien_thuat';
  // Vòng ≥ 2 gánh thêm việc XEM kết quả vòng trước (xem `XEM_KET_QUA_S`).
  const xemKq = vong >= 2 ? (dongHoMinigame ? DONG_HO_MINIGAME.XEM_KET_QUA_S : DONG_HO.XEM_KET_QUA_S) : 0;
  // D459 — khung minigame cộng 20 s ở vòng lõi (founder: "Co về +20s"); khoá cũ giữ 25 s của D442.
  const them = dongHoMinigame ? DONG_HO_MINIGAME.CHON_BAI_THEM_KHI_CO_THE_S : DONG_HO.CHON_BAI_THEM_KHI_CO_THE_S;
  // D473 — màn minigame của vòng TRƯỚC chạy ở đầu vòng này (vòng ≥ 3: màn có từ vòng 2): lật thẻ + chọn lá + đếm + chạy, theo lịch server chung.
  const man = dongHoMinigame && vong >= 2 && coManMinigame(vong - 1, soO, xenKe) ? giayManMinigame(loiChonTruoc) : 0;
  return nen + (coThe ? them : 0) + xemKq + man;
}

/**
 * D526 — NHỊP XEN KẼ (cờ `nhipXenKe`; founder 05/10 trên demo `docs/ui-ux/demo/nhip-tran.html`: *"12 ô thì bị bão hòa"* → bàn 8 ô,
 * *"Sao ko xếp màn chọn trait xen kẽ với màn chơi mini-game?"*, *"Vòng 1 cũng có mini game nhưng kết hợp cái đầu"*, bàn tập *"T-M-T-M-M"*).
 * Sau khi chốt vòng `v` là MỘT chặng: màn minigame (`man` có `v`) hoặc chợ trait ở đầu vòng `v + 1` (`trait` có `v + 1`). Vòng 1 có cả
 * hai (màn rồi chợ). Chợ ở vòng 4 · 6 đi KÈM lượt lõi thứ hai · thứ ba (`loi`) — cùng một màn chọn ở web.
 * Bàn tập chỉ một lượt lõi (vòng 1): demo founder duyệt có chợ ở vòng 3 → 4 mà không kèm lõi.
 *   · bàn 8 ô (trận thật, 7 vòng vì `o_up`): M+T · M · T+lõi · M · T+lõi · M · M ⇒ năm màn, ba chợ;
 *   · bàn 6 ô (bàn tập, 5 vòng): T · M · T+lõi · M · M ⇒ ba màn, hai chợ.
 * Lõi thứ ba (index 2) chỉ mở cho ghế có trait khẩu vị đa dạng (`coLuotLoi`). PLAYTEST-TUNE.
 * ⚠ Bảng RIÊNG, chỉ đọc dưới cờ — không nhét vào `MOC_TRAIT_MINIGAME`/`vongChonChienThuat` chung (bài học D457: thêm cỡ vào bảng chung là
 * đổi mọi khoá cũ có cờ đó).
 */
export const NHIP_XEN_KE: Readonly<Record<number, { readonly man: readonly number[]; readonly trait: readonly number[]; readonly loi: readonly number[] }>> = {
  8: { man: [1, 2, 4, 6, 7], trait: [2, 4, 6], loi: [1, 4, 6] },
  /*
   * D550 — bàn 14 ô (khoá v63, 13 vòng vì `o_up`; founder 07/10 chọn nhịp DÀY: *"Nhiều trait hơn đi. Như kiểu chiến thuật eco trong TFT ấy vì mấy
   * trait đầu đâu phải ai cũng lấy"*). Sau chốt vòng: M+T · M · M⚖ · T+lõi · M · T · M · M⚖ · T+lõi · M · T · M · M ⇒ chín màn, NĂM chợ trait,
   * lõi 1 · 5 · 10. Màn sau vòng 3 · 8 chạy ĐÚNG ô kỳ họp (ô 4 · 9 — `O_THEO_MAP[14]`). Năm chợ (bàn 8 có ba) để bỏ qua chợ đầu giữ xu là một
   * lối chơi được. Tối đa ~16,9 phút (bàn 8 ~10). PLAYTEST-TUNE.
   */
  14: { man: [1, 2, 3, 5, 7, 8, 10, 12, 13], trait: [2, 5, 7, 10, 12], loi: [1, 5, 10] },
  6: { man: [2, 4, 5], trait: [2, 4], loi: [1] },
};

/**
 * D526 — sau khi chốt vòng `vong` có màn minigame không. MỘT nguồn cho mọi cửa (mở màn · chờ màn · trả trạng thái chờ màn · khép trận sau
 * màn cuối · đồng hồ vòng kế · web). Không hỏi cờ `dongHoMinigame` — người gọi hỏi trước. Khung minigame cũ (v57): mọi vòng ≥ 2.
 */
export function coManMinigame(vong: number, soO: number, xenKe = false): boolean {
  const lich = xenKe ? NHIP_XEN_KE[soO] : undefined;
  return lich ? lich.man.includes(vong) : vong >= 2;
}

/**
 * D526 — TRẦN SỐ LẦN ĐỔI LÕI (khảo sát lại quầy lõi) trong MỘT vòng. Founder 05/10: *"đổi lõi chỉ đổi được 1 lần"* ⇒ nhịp xen kẽ: 1.
 * Khoá cũ: 5 (trần cũ gõ ở ba cửa API). Server chặn ở cửa xem shop lượt `lan` và cửa nộp vòng; web khoá nút theo DTO `doi_loi_toi_da`.
 */
export function doiLoiToiDa(st: { nhip_xen_ke?: boolean }): number {
  return st.nhip_xen_ke === true ? 1 : 5;
}

/**
 * D561 — XẾP HẠNG CÁCH E (khoá v65 `xepHangE`, founder 07/10): điểm ghế = phân vị TRONG VAI của (% tăng trưởng ghế − trung vị % các ghế cùng trận).
 * Trừ trung vị bàn khử phần "cả bàn cùng lên/xuống" (lệnh lớn của Cá Mập nuôi Cá nhân cùng bàn — đo 06/10); phân vị trong vai khử vốn đầu khác nhau.
 * Bảng = 21 điểm phân vị (p0, p5 … p100) của hiệu ấy, bp, dựng từ trận toàn bot (`scripts/bang_xep_hang_e.ts`); nội suy tuyến tính giữa hai điểm.
 * Số hiện tại: `npx tsx scripts/bang_xep_hang_e.ts 20000 balance-v65-thangkynang` (08/10 — 20.000 trận · 120.000 ghế, luật v65 cuối).
 * ⚠ A8.2 — PLAYTEST-TUNE: bảng từ bot là tạm; đổi sang dữ liệu người thật khi mỗi vai có ≥ 200 ghế thật cuối trận (A11.15).
 */
export const XEP_HANG_E: Readonly<Record<'ca_nhan' | 'doi_lai' | 'ca_map' | 'to_chuc', readonly number[]>> = {
  ca_nhan: [-100999, -7019, -4513, -3212, -2298, -1602, -1003, -507, -81, 0, 162, 617, 1159, 1804, 2566, 3492, 4685, 6337, 8948, 14378, 207771],
  doi_lai: [-66976, -11017, -7819, -6121, -5042, -4232, -3558, -2994, -2473, -2066, -1669, -1313, -974, -654, -331, 0, 0, 320, 1069, 2670, 39590],
  ca_map: [-97375, -22704, -16743, -13993, -11894, -10444, -9254, -8159, -7324, -6576, -5876, -5260, -4676, -4109, -3549, -2966, -2335, -1530, -511, 0, 22458],
  to_chuc: [-86038, -17850, -13394, -10695, -8940, -7708, -6728, -5759, -4937, -4298, -3611, -3019, -2453, -1880, -1281, -785, -270, 0, 263, 1328, 15462],
};

/**
 * D574 — BẢNG E CỦA KHOÁ v67 (bối cảnh dài hạn): `npx tsx scripts/bang_xep_hang_e.ts 20000 balance-v67-boicanh` trên bộ số founder chốt
 * 10/10 (120.000 ghế, 1.413 s). Bảng chung `XEP_HANG_E` (dựng trên v65) đặt lên v67 làm Cá Mập lệch tới 3,8 điểm phân vị ⇒ founder chọn A:
 * tách bảng theo khoá, làm cùng lúc lật mặc định. Bảng chung giữ nguyên cho v65/v66 (replay — A11.3). ⚠ A8.2 — PLAYTEST-TUNE.
 */
export const XEP_HANG_E_V67: Readonly<Record<'ca_nhan' | 'doi_lai' | 'ca_map' | 'to_chuc', readonly number[]>> = {
  ca_nhan: [-127693, -6812, -4413, -3164, -2277, -1576, -997, -506, -81, 0, 159, 600, 1134, 1776, 2539, 3447, 4639, 6306, 8883, 14216, 380555],
  doi_lai: [-81841, -11302, -7750, -6243, -5075, -4278, -3526, -2943, -2482, -2024, -1650, -1296, -957, -605, -275, 0, 0, 363, 1049, 2586, 37678],
  ca_map: [-96658, -22715, -17032, -14132, -12147, -10740, -9607, -8587, -7733, -6969, -6243, -5525, -4899, -4272, -3715, -3099, -2453, -1757, -725, 0, 17866],
  to_chuc: [-88866, -17375, -13044, -10571, -8951, -7690, -6660, -5771, -5022, -4270, -3654, -3026, -2367, -1760, -1255, -767, -231, 0, 318, 1445, 22977],
};

/**
 * D584 — BẢNG E ĐO TRÊN KHOÁ v68 (giải vòng bằng xu trait): `bang_xep_hang_e.ts 20000 balance-v68-giaixu` (120.000 ghế, 1.091 s). Bỏ giải tiền
 * ⇒ tăng trưởng cuối trận hẹp hẳn (Cá nhân p95 +42 % so với +142 % ở v67).
 * ⚠ CHƯA DÙNG (founder 11/10 chọn A): chấm v68 bằng bảng này ⇒ gate 24.000 G1 ĐỎ (Đa dạng hoá 37,0 % / 28,4 %) — bảng hẹp thưởng bot rải đều;
 *   v68 TẠM chấm bằng `XEP_HANG_E_V67` (G1 ĐẠT 31,5 %). ĐIỀU KIỆN GỠ (A11.15): G1 được chữa cho bảng đúng, hoặc ≥ 30 người thật chơi v68
 *   (dựng lại bảng từ trận thật). Giữ số đo ở đây để lần gỡ không phải chạy lại.
 */
export const XEP_HANG_E_V68: Readonly<Record<'ca_nhan' | 'doi_lai' | 'ca_map' | 'to_chuc', readonly number[]>> = {
  ca_nhan: [-112298, -3428, -1973, -1310, -893, -595, -365, -192, -64, 0, 0, 82, 224, 406, 632, 923, 1299, 1821, 2596, 4187, 79086],
  doi_lai: [-66953, -5311, -3361, -2457, -1886, -1495, -1195, -916, -714, -521, -347, -190, -46, 0, 77, 323, 675, 1182, 1920, 3487, 38736],
  ca_map: [-39417, -7178, -5211, -4223, -3592, -3158, -2825, -2519, -2242, -2007, -1781, -1545, -1320, -1072, -780, -497, -158, 0, 508, 1764, 25970],
  to_chuc: [-34223, -4334, -2815, -2068, -1557, -1148, -806, -522, -304, -84, 0, 76, 295, 547, 836, 1163, 1543, 2028, 2714, 3910, 24004],
};

/** D574 · D584 — bảng E của trận: MỘT cửa, theo cờ đã đóng băng trên trạng thái trận (không theo khoá mặc định hiện hành — trận cũ replay luật đã lưu). */
export function bangXepHangE(st: { boi_canh_dai_han?: boolean; giai_xu?: boolean }): Readonly<Record<'ca_nhan' | 'doi_lai' | 'ca_map' | 'to_chuc', readonly number[]>> {
  // D584 — v68 (`giai_xu`) TẠM chấm bằng bảng v67 — xem `XEP_HANG_E_V68` (G1 đỏ với bảng đúng; điều kiện gỡ ghi ở đó).
  return st.boi_canh_dai_han === true ? XEP_HANG_E_V67 : XEP_HANG_E;
}

/** D561 — phân vị (bp, 0…10000) của `x` trên bảng 21 điểm `bang` (p0…p100): nội suy tuyến tính; đoạn phẳng (nhiều điểm bằng nhau) lấy giữa. */
export function phanViBang(bang: readonly number[], x: number): number {
  const n = bang.length - 1;
  if (n < 1) return 5000;
  if (x <= bang[0]!) return 0;
  if (x >= bang[n]!) return 10000;
  let lo = -1, hi = -1;
  for (let i = 0; i <= n; i++) {
    if (bang[i]! === x) { if (lo < 0) lo = i; hi = i; }
  }
  if (lo >= 0) return Math.round(((lo + hi) / 2) * (10000 / n));
  let i = 0;
  while (bang[i + 1]! < x) i++;
  const a = bang[i]!, b = bang[i + 1]!;
  return Math.round((i + (x - a) / (b - a)) * (10000 / n));
}

/** D561 — giây CHỌN LÁ của màn: khoá v65 (`loiChonTruoc`) chọn lõi lúc chốt vòng ⇒ 0; khoá cũ `CHON_LA_S`. */
export function giayChonLa(loiChonTruoc = false): number {
  return loiChonTruoc ? 0 : DONG_HO_MINIGAME.CHON_LA_S;
}

/** D473 — giây màn minigame chiếm ở đầu vòng kế: lật thẻ · chọn lá · đếm ngược · chạy (kế hoạch §2). D561: chọn lá 0 s ở khoá v65. */
export function giayManMinigame(loiChonTruoc = false): number {
  return DONG_HO_MINIGAME.LAT_THE_S + giayChonLa(loiChonTruoc) + DONG_HO_MINIGAME.DEM_NGUOC_S + DONG_HO_MINIGAME.CHAY_S;
}

/**
 * Trần thời lượng CẢ TRẬN (giây) — dùng để hiện cho người chơi biết mình đang vào
 * một trận dài bao lâu, và để kiểm hồi quy khi ai đó chỉnh một con số ở trên.
 *
 * KHÔNG dùng làm hạn cắt trận: cắt theo tổng là phạt người đánh chậm mà liên tục.
 * Hạn cắt là `DONG_HO.HAN_TRAN_PHUT`, tính theo vòng đứng yên.
 */
export function giayToiDaCaTran(soO: number): number {
  let t = 0;
  for (let v = 1; v <= soO; v += 1) {
    t += giayChonBai(v, soO) + DONG_HO.CAM_KET_TRAN_S;
  }
  return t;
}

/**
 * STACK — mua trùng là NÂNG CẤP, không phải mua thêm ô.
 *
 * ⚠ Trước 20/07 tài sản trùng bị BỎ QUA IM LẶNG (`mua` trả về danh mục y
 * nguyên, báo ok). Người chơi bấm mua lá thứ hai, thấy "thành công", mà không
 * có gì xảy ra — lớp lỗi tệ nhất: im lặng và tưởng đã được việc.
 *
 * Hệ số GIẢM DẦN là cố ý (founder chốt "cấp tăng dần"): dồn hết vào một mã
 * phải là ĐÁNH ĐỔI THẬT, không phải nước đi trội. ×2,0 cho 3 lá nghĩa là lá
 * thứ ba chỉ thêm 0,4 trong khi lá thứ nhất cho trọn 1,0 — ai dồn cực đoan thì
 * trả giá bằng mất đa dạng hoá, đúng tinh thần trần theo nhóm của D20.
 */
export const CAP_STACK_BP: readonly number[] = [10000, 16000, 20000] as const;
export const MAX_BAN_SAO = CAP_STACK_BP.length;

/** Hệ số của một thẻ đang có `soBan` bản (bp). */
export function heSoStackBp(soBan: number): number {
  if (soBan <= 0) return 0;
  return CAP_STACK_BP[Math.min(soBan, MAX_BAN_SAO) - 1]!;
}

/**
 * PHÍ GIỮ TIỀN khi ĐỨNG NGOÀI — "tiền mặt phải CÓ GIÁ".
 *
 * Founder thêm 20/07, và nó trả đúng món nợ đã ghi trong CLAUDE.md từ D20:
 * "tiền mặt gần như miễn phí khiến MỌI luật siết rủi ro phản tác dụng — siết
 * trần nhóm lại đẩy người chơi vào tiền mặt và làm phe thủ MẠNH LÊN".
 *
 * Không có phí này thì ĐỨNG NGOÀI là bến an toàn miễn phí: bỏ bài sớm rồi ngồi
 * im thành nước đi mạnh nhất, và toàn bộ cơ chế poker vừa dựng tự vô hiệu.
 *
 * Đây KHÔNG phải alpha giả (D22 cấm): nó là chi phí giữ tiền có thật, phạt
 * người đứng ngoài chứ không thưởng cho ai canh giá.
 *
 * Nền áp mọi vòng; sự kiện lạm phát thì cộng thêm. Con số dưới đây là ĐIỂM
 * KHỞI ĐẦU chờ Monte Carlo chốt — nhẹ quá thì đứng ngoài vẫn là bến an toàn,
 * nặng quá thì bỏ bài thành bẫy chết.
 */
export const PHI_DUNG_NGOAI = {
  /** Trừ mỗi vòng còn lại, bp của vốn đang đóng băng. */
  NEN_BP: 150,
  /**
   * Cộng thêm khi ô vòng đó là sự kiện lạm phát.
   *
   * ⚠ v42 (D311) — DƯỚI CỜ `tienMatSuKien` THÌ KHÔNG CỘNG NỮA. Con số này dời sang
   * `TIEN_MAT_SU_KIEN.MT.lam_phat` và áp cho MỌI ghế còn trong trận (kể cả ghế đứng
   * ngoài), thay vì chỉ ghế đứng ngoài. Tổng của ghế đứng ngoài KHÔNG đổi — cái đổi là
   * cả bàn cùng chịu. Giữ cả hai là thu hai lần đúng vào người đang bị phạt nặng nhất.
   * Có bài canh khoá hai hằng số bằng nhau về độ lớn (`tests/tai_san_v42.test.ts` V6).
   */
  LAM_PHAT_BP: 400,
} as const;

/**
 * v42 (D311) — HÀNG THỨ BẢY CỦA MA TRẬN SỰ KIỆN: tiền mặt.
 *
 * Founder 08/09: *"lạm phát phải trừ thẳng tiền mặt"*. Trước v42 thẻ `lam_phat`
 * KHÔNG chạm một đồng tiền mặt nào của người đang chơi — nó chỉ đánh vào VỊ THẾ qua
 * ma trận, nên bài học đọc ngược: ôm tiền mặt là cách né lạm phát. Ngoài đời thì
 * tiền mặt chính là thứ lạm phát ăn.
 *
 * ⚠ ĐÂY LÀ MỘT NGUỒN THAY MỘT NGUỒN, KHÔNG PHẢI THÊM MỘT KHOẢN THU. Dưới cờ
 * `tienMatSuKien`, khối `PHI_DUNG_NGOAI` thôi cộng `LAM_PHAT_BP` — con số 400 dời
 * về đây và áp cho MỌI ghế còn trong trận thay vì chỉ ghế đứng ngoài. Đặt số mới ở
 * đây mà quên rút bên kia là thu hai lần (D61).
 *
 * ⚠ Nền `apLamPhat` 150 bp/vòng và `CAT_LO_VE_CASH.PHI_LAM_PHAT_BP` GIỮ NGUYÊN: đó
 * là lạm phát NỀN, luôn chạy; hàng này là cú SỐC của riêng ô lạm phát.
 *
 * ⚠ Ô nào cũng khai, kể cả 0 — `Record<SuKienId, number>` ép đủ 12 mặt, nên thêm
 * một mặt tin mới mà quên hàng tiền mặt là ĐỎ lúc biên dịch chứ không im lặng.
 */
export const TIEN_MAT_SU_KIEN = {
  /** bp trên TIỀN MẶT TỰ DO. v1 chỉ `lam_phat` khác 0 — không đẻ số mới. */
  MT: {
    ha_lai_suat: 0, tang_lai_suat: 0, hack_san: 0, thien_nga_den: 0,
    lam_phat: doThamSo('TIEN_MAT_LAM_PHAT_BP', -400),
    chien_tranh: 0, bong_bong: 0, phap_ly: 0, pha_san: 0, cam_van: 0, tham_hoa: 0, dich_benh: 0,
  } as Record<SuKienId, number>,
} as const;

/** Tỷ lệ `so/tong` ra bp. Dùng cho ngưỡng "bao nhiêu phần lobby đã làm X". */
export function tyLeBp(so: number, tong: number): number {
  if (tong <= 0) return 0;
  return Math.floor((10000 * so) / tong);
}

/**
 * D2 — CẮT LỖ VỀ CASH: bỏ vòng này thì PHẢI TRẢ GIÁ, không còn miễn phí.
 *
 * ⚠ Phân biệt với `PHI_DUNG_NGOAI`, hai thứ khác nhau:
 *   · ĐỨNG NGOÀI = rời hẳn tới cuối trận, vốn đóng băng, chịu phí MỖI vòng.
 *   · CẮT LỖ = bỏ ĐÚNG vòng này, vòng sau cầm tiền mặt quay lại. Trước D2 nước
 *     này MIỄN PHÍ — chỉ mất phần quỹ vòng, mà không đặt thì cũng chẳng mất gì.
 *     Nên khi ô sắp lật trông xấu, bỏ luôn là nước đi trội gần như tuyệt đối:
 *     rủi ro bằng 0, chi phí bằng 0. Đó là chỗ chiều sâu bị rút ruột.
 *
 * Hai lớp phí, tách ra để đọc được lý do trên dây chuyền:
 *   · LẠM PHÁT VÒNG — giữ tiền mặt qua một vòng thì tiền mặt mất giá (đúng lever
 *     D20 "tiền mặt phải CÓ GIÁ", cùng nguồn với phí đứng ngoài).
 *   · RÚT KHẨN — bán tháo cả danh mục trong một nhịp thì ăn trượt giá, không
 *     phải bán ở giá niêm yết. Đây là phần khiến cắt lỗ là QUYẾT ĐỊNH, không
 *     phải nút thoát.
 *
 * GIẪM ĐẠP: khi ≥30% lobby cùng bỏ trong một vòng, phí ×2. Cả bàn cùng chạy ra
 * một cửa thì không ai bán được ở giá mình muốn — đúng cơ chế thật của bán tháo,
 * và nó chặn "ai cũng bỏ" thành meta an toàn. Đo bằng TỶ LỆ chứ không phải đầu
 * người (D3): bàn 4 và bàn 8 phải cùng một ngưỡng hành vi.
 *
 * ⚠ MỌI SỐ DƯỚI ĐÂY LÀ ĐIỂM KHỞI ĐẦU CHỜ MONTE CARLO. Gate của cụm D2 là
 * "Cắt lỗ CÓ giá trị nhưng KHÔNG thành meta thống trị" — hai phía đều là lỗi:
 * nhẹ quá thì bỏ bài vẫn trội, nặng quá thì cắt lỗ thành bẫy và người chơi học
 * được bài học SAI (ngoài đời cắt lỗ đúng lúc là kỷ luật, không phải thất bại).
 */
export const CAT_LO_VE_CASH = {
  /** Giữ tiền mặt qua vòng — cùng họ với phí đứng ngoài. */ // MC-TUNE
  PHI_LAM_PHAT_BP: 150,
  /** Bán tháo cả danh mục trong một nhịp → trượt giá. */ // MC-TUNE
  PHI_RUT_KHAN_BP: 350,
  /** Từ bao nhiêu phần lobby cùng bỏ thì tính giẫm đạp (bp). */ // MC-TUNE
  NGUONG_GIAM_DAP_BP: 3000,
  /** Hệ số phí khi giẫm đạp (bp của phí gốc; 20000 = ×2). */ // MC-TUNE
  GIAM_DAP_BP: 20000,
  /**
   * Số lần cắt lỗ mỗi trận theo CỠ MAP. Map dài thì cho nhiều hơn — cùng một
   * "một lần" ở map 8 và map 16 là hai độ chặt hoàn toàn khác nhau.
   * Hết lượt → phải chiến đấu hoặc Đầu hàng (đường ra vẫn còn, nhưng đắt).
   */ // MC-TUNE
  SO_LAN_THEO_MAP: { 8: 1, 12: 1, 16: 2 } as Record<number, number>,
  /** Cỡ map lạ → dùng số này. */ // MC-TUNE
  SO_LAN_MAC_DINH: 1,
} as const;

/** Số lần cắt lỗ được phép ở một cỡ map. */
export function soLanCatLo(soO: number): number {
  return CAT_LO_VE_CASH.SO_LAN_THEO_MAP[soO] ?? CAT_LO_VE_CASH.SO_LAN_MAC_DINH;
}

/**
 * TRẠNG THÁI CẢM XÚC CỦA MỘT GHẾ — ngưỡng vốn so với vốn khởi điểm.
 *
 * D25: xã hội LÀ stakes engine của mode này. Trò chơi miễn phí, thứ duy nhất
 * mất được là danh dự, nên "đối thủ THẤY mình" chính là cái để mất. Muốn vậy
 * thì trạng thái phải HIỆN RA trên ghế của người khác, không chỉ là con số vốn.
 *
 * ⚠ SUY Ở SERVER, không ở client. Ba lý do:
 *   1. cả bàn phải thấy CÙNG một trạng thái của cùng một ghế;
 *   2. nó là "thông tin đang được thấy" nên phải LOG được (R1) — client tính
 *      thì log không bao giờ khớp thứ đã hiển thị;
 *   3. client tính = mỗi bản build một ngưỡng khác nhau.
 *
 * ⚠⚠ NGƯỠNG LÀ BP SO VỚI VỐN KHỞI ĐIỂM **CỦA CHÍNH GHẾ ẤY**, không phải so với
 * `START_VON`. Trước 08/09 tham số cuối có giá trị mặc định `START_VON` và cả
 * bốn chỗ gọi đều bỏ trống nó — mà từ v34 (22/08) VAI phát vốn gấp bội:
 * `ca_map`/`doi_lai` ×3, `to_chuc` ×2. Hậu quả đo được: cá mập vào bàn đã có
 * bp = 30.000 ≥ ngưỡng 12.500 ⇒ **phát sáng xanh từ vòng 1 tới hết trận**, kể
 * cả khi đang lỗ; và chiều ngược còn tệ hơn — cá mập lỗ 60% (30.000 → 12.000)
 * vẫn ra `binh_thuong`, tức **đèn "SẮP CHÁY" tắt đúng ở người dễ cháy nhất**.
 * Founder bắt được bằng mắt 08/09: *"chả nhẽ xanh cả trận à?"*
 * ⇒ Tham số nay **BẮT BUỘC**. Một mặc định đúng-ở-đa-số-ca là cái bẫy: nó im
 * lặng đúng cho tới ngày có vai, rồi im lặng sai. Người gọi ở server đã có sẵn
 * `vonDauCua(st, g)` — cùng thước mà xếp hạng cuối trận dùng.
 */
export const FX_GHE = {
  /** ≥ +25% → phát sáng xanh, nảy nhẹ. */
  LAI_DAM_BP: 12500,
  /** ≤ −25% → quầng đỏ, rung. */
  LO_DAM_BP: 7500,
  /** ≤ −50% → phóng to giữa màn, nứt vỡ, cảnh báo. */
  NGUY_KICH_BP: 5000,
} as const;

/** Trạng thái cảm xúc của ghế — thứ tự nặng dần. */
export type FxGhe = 'binh_thuong' | 'lai_dam' | 'lo_dam' | 'nguy_kich' | 'chay';

/**
 * Suy trạng thái từ vốn + tư thế. Hàm THUẦN, tất định, dùng chung server ↔ test.
 * Thứ tự kiểm quan trọng: cháy/đầu hàng đè mọi thứ, rồi mới tới các mốc lỗ.
 */
export function fxCuaGhe(
  von: number,
  daChay: boolean,
  tuThe: string,
  /** Vốn khởi điểm CỦA GHẾ NÀY — `vonDauCua(st, g)` ở server. Xem khối ⚠⚠ trên. */
  startVon: number,
): FxGhe {
  if (daChay || tuThe === 'dau_hang') return 'chay';
  const bp = Math.floor((von * 10000) / startVon);
  if (bp <= FX_GHE.NGUY_KICH_BP) return 'nguy_kich';
  if (bp <= FX_GHE.LO_DAM_BP) return 'lo_dam';
  if (bp >= FX_GHE.LAI_DAM_BP) return 'lai_dam';
  return 'binh_thuong';
}

/**
 * CHIA QUỸ VÒNG THEO HẠNG PnL (founder chốt 20/07 — phương án 1).
 *
 * Vẫn là MÔ HÌNH A: Vốn chỉ đổi qua Quỹ vòng, một kênh kế toán, không
 * double-count. Chỉ đổi cách CHIA quỹ đó: top-N thay vì all-to-1.
 *
 * VÌ SAO ĐỔI (đo được, không phải khẩu vị): winner-take-all là hàm bậc thang —
 * thưởng "giỏi NHẤT", không thưởng "giỏi HƠN". Nên nhỉnh 10% về thông tin trả
 * công ≈ 0, và bot biết trước tin thật/giả vẫn xếp gần bét qua 6 vòng đo dù đã
 * sửa nhiễu, tiền cửa, độ hung hăng và căn cứ quyết định. Chia theo hạng biến
 * bậc thang thành gradient: giữ hạng 1–2 đều đặn thì được trả đều đặn.
 *
 * Kèm ba cái lợi: hợp theme quỹ (quỹ thật chấm theo percentile so peer), data
 * sạch hơn (phân bố hạng liên tục > nhị phân thắng/thua — phục vụ cross-signal
 * rank×rank), và giữ chân tốt hơn (winner-take-all khiến 3–4/5 người thấy mình
 * thua MỖI vòng).
 *
 * ⚠ CANH G3 KHI TUNE: chia theo hạng thưởng SỰ ỔN ĐỊNH — mà ổn định đúng là
 * thứ "Ngồi im / Đa dạng hoá / Rùa" bán. Có rủi ro Rùa leo top và vỡ G3 ngay
 * trong lúc vá G2/G4. Chốt chặn: tín hiệu thông tin phải đủ mạnh để oracle xếp
 * TRÊN Rùa. Tune đồng thời fake-rate + telegraph/echo + vector chia + số suất.
 */
export const CHIA_QUY_VONG = {
  /**
   * Trọng số theo hạng (hạng 1 trước). Số suất = độ dài mảng.
   * KHÔNG hardcode theo 5 người: khi số người còn trong vòng ít hơn, engine
   * cắt bớt rồi chuẩn hoá lại — xem `chiaQuyVong()`.
   * PLACEHOLDER — Monte Carlo chốt (D20/D21, mục 16.10).
   */
  TRONG_SO: [5000, 3000, 2000] as readonly number[],

  /**
   * LEVER DỰ PHÒNG (mặc định TẮT). Bật = chấm hạng trên TOÀN bàn kể cả người
   * đã Cắt lỗ, phòng trường hợp kẻ yếu cắt lỗ hết và Quỹ vòng chỉ còn tay mạnh
   * so nhau (adverse selection tái xuất). Làm YẾU lớp Cắt lỗ nên để dành,
   * đừng dùng trước khi đo thấy cần.
   */
  CHAM_CA_NGUOI_CAT_LO: false,

  /**
   * TỶ LỆ GHẾ ĐƯỢC CHIA QUỸ VÒNG — founder chốt 11/08: *"co dãn theo số bàn"*.
   *
   * 60% ⇒ bàn 4→3 suất · bàn 5→3 · bàn 6→4 · bàn 7→5 · bàn 8→5. Hai cỡ bàn
   * đang XANH (4, 5) rơi đúng vào 3 suất nên không đổi một chip; chỉ bàn 6/7/8
   * — nơi G1 đang đỏ — mới được nới.
   *
   * Vì sao con số này là 60% chứ không phải một hằng số suất: "ba suất" có
   * nghĩa khác hẳn ở bàn 4 (3/4 ghế có thưởng) và bàn 8 (3/8). Chính chênh
   * lệch đó là thứ làm phân phối LỒI PHƯƠNG SAI ở bàn lớn — hạng 4 và hạng 8
   * nhận như nhau (đều 0) nên cú đánh liều không mất thêm gì. Giữ tỷ lệ cố
   * định thì mọi cỡ bàn có cùng độ "cụt đuôi".
   */ // MC-TUNE — xem bảng đo ở D82
  TY_LE_SUAT_BP: 6000,
} as const;

/**
 * ═══ D584 — GIẢI VÒNG TRẢ BẰNG XU TRAIT (cờ `giaiXu`, khoá balance-v68-giaixu) ═══════════════════════════════════════════════════
 * Founder 10/10 (bấm thử v67 local): *"Cái ăn chia tiền cược lỗi cân bằng quá… khó hiểu… có bị trùng lặp không"* ⇒ đo v66 (1.500 trận bàn 14):
 * bỏ giải khỏi kết quả thì người NHẤT đổi ở 40 % trận; Cá nhân ~3/4 tăng trưởng đến từ giải (nộp nền phẳng 500/vòng = 65 % vốn, nhận 100 %);
 * trùng: lãi vòng thưởng hai lần (NAV + giải) · chuyển chéo vai phá xếp hạng E · phí giao dịch về tay người thắng. ⇒ *"Thay bằng xu trait nhé"*:
 * KHÔNG thu nền, không hũ tiền (phí giao dịch mất hẳn — đúng vai hãm); mỗi vòng vẫn xếp hạng % lãi/lỗ vòng như cũ (cùng phá hoà, cùng số suất
 * co giãn `trongSoQuyVong`), suất thứ k nhận `XU_THEO_HANG[k]` xu trait (suất vượt bảng nhận phần tử cuối). Xu chỉ để cuộn chợ trait (A3.5).
 * ⚠ A8.2 — PLAYTEST-TUNE (đề xuất agent), đo gate (G7: xu không về ghế ngồi im) rồi founder chốt.
 */
export const GIAI_XU = { XU_THEO_HANG: [3, 2, 1] as readonly number[] } as const;

/** D584 — xu trait của suất hạng `hang` (1 = cao nhất). */
export function xuGiaiTheoHang(hang: number): number {
  const b = GIAI_XU.XU_THEO_HANG;
  return b[Math.min(Math.max(1, hang), b.length) - 1] ?? 0;
}

/** D584 — tổng xu giải của một vòng có `soNguoi` ghế tranh (số suất co giãn như quỹ cũ). */
export function tongXuGiai(soNguoi: number, coGian: boolean): number {
  let t = 0;
  for (let h = 1; h <= trongSoQuyVong(soNguoi, coGian).length; h++) t += xuGiaiTheoHang(h);
  return t;
}

/**
 * TRỌNG SỐ CHIA QUỸ VÒNG — CẦN GẠT DÒ ĐƯỢC (mở 11/08 để dò G1).
 *
 * ⚠⚠ VÌ SAO PHẢI MỞ CẦN GẠT NÀY TRƯỚC KHI DÒ. Rà soát 11/08 chỉ ra Quỹ vòng
 * chia ĐÚNG BA SUẤT bất kể bàn mấy người (`slice` chỉ CẮT, không bao giờ NỚI):
 * bàn 5 thì 3/5 ghế có thưởng, bàn 8 thì 3/8. Đuôi càng cụt thì phân phối càng
 * LỒI PHƯƠNG SAI — hạng 4 và hạng 8 nhận như nhau (đều 0), nên cú đánh liều
 * không mất thêm gì mà được thêm rất nhiều. Đó đúng là cấu trúc D72 đã chẩn
 * khi giải G1 lần đầu, và nó giải thích vì sao G1 xanh ở bàn 5 mà đỏ nặng ở
 * bàn 8 (Tất tay 39,9%, bỏ xa á quân 21,3 điểm).
 *
 * ⚠ MẶC ĐỊNH GIỮ NGUYÊN TỪNG CHIP: `QUY_SO_SUAT = 3` đi thẳng vào nhánh cũ,
 * trả về đúng `TRONG_SO.slice(...)`. Không cần cổng version, không đổi replay.
 * Chỉ khi DÒ (đặt biến môi trường) nó mới sinh vector khác.
 *
 * ⚠ VÀ PHẢI CHỨNG MINH CẦN GẠT CÒN SỐNG TRƯỚC KHI KẾT LUẬN (D58 dính bốn lần:
 * gõ sai tên biến ⇒ phép dò RỖNG ⇒ in ra số đẹp ⇒ kết luận "cần gạt không có
 * tác dụng"). Đo hai nấc khác nhau phải ra hai số khác nhau.
 */
export function trongSoQuyVong(
  soNguoi: number, coGian = false,
): readonly number[] {
  /*
   * ⚠ CỔNG v31. Tắt ⇒ ba suất cứng như mọi trận đã lưu, byte-hệt.
   * Bật ⇒ số suất CO GIÃN theo số ghế (founder chốt 11/08: *"co dãn theo số
   * bàn"*), vì "ba suất" có nghĩa khác hẳn ở bàn 4 và ở bàn 8.
   */
  if (!coGian) return CHIA_QUY_VONG.TRONG_SO.slice(0, soNguoi);

  const tyLe = doThamSo('QUY_TY_LE_SUAT_BP', CHIA_QUY_VONG.TY_LE_SUAT_BP);
  const soSuat = Math.max(1, Math.min(
    soNguoi, Math.ceil((soNguoi * tyLe) / 10000)));

  /*
   * ≤3 suất ⇒ ĐÚNG bảng gốc [5000, 3000, 2000]. Ở 60% thì bàn 4 và bàn 5 rơi
   * vào đây, nên hai cỡ bàn ĐANG XANH không đổi một chip nào — chỉ bàn 6/7/8
   * (đang đỏ) mới được nới. Sửa đúng chỗ hỏng, không đụng chỗ lành.
   */
  if (soSuat <= 3) return CHIA_QUY_VONG.TRONG_SO.slice(0, soSuat);

  /*
   * >3 suất: trọng số TUYẾN TÍNH giảm (n, n−1, …, 1) chuẩn hoá về 10.000.
   * Tuyến tính chứ không hình học — hình học vẫn để đuôi rơi về gần 0 rất
   * nhanh, tức không thật sự chữa cái "đuôi cụt" đang đo.
   */
  const w = Array.from({ length: soSuat }, (_, i) => soSuat - i);
  const tong = w.reduce((a, b) => a + b, 0);
  return w.map((x) => Math.round((x * 10000) / tong));
}

// ---------------------------------------------------------------------------
// TÀI SẢN (D24 mục 16.2) — 6 lá, 2 nhóm tương quan
// ---------------------------------------------------------------------------

export type NhomTaiSan = 'rui_ro' | 'phong_thu';

/** Hạng độ sâu sổ lệnh. Mỏng → trượt giá thảm khi đông; dày → chịu được đám đông. */
export type ThanhKhoan = 'mong' | 'vua' | 'day';

export interface TaiSan {
  id: string;
  /** CHUỖI NGƯỜI CHƠI ĐỌC — D26. */
  label: string;
  icon: string;
  nhom: NhomTaiSan;
  /**
   * Thanh khoản NỀN: quyết định crowding phạt nặng hay nhẹ. Mỏng = trượt giá
   * thảm khi cả bàn dồn vào, nhưng thưởng cao (D24 mục 16.7).
   *
   * ⚠ Từ D1 (25/07) đây chỉ là hạng NỀN — hạng HIỆU DỤNG mỗi vòng còn phụ thuộc
   * ô đang lật (`THANH_KHOAN_DONG`): khủng hoảng làm sổ lệnh mỏng đi, risk-on
   * làm dày lên. Đừng đọc trường này như thanh khoản thật của vòng.
   */
  thanh_khoan: ThanhKhoan;
  /** Biến động nền (bp) — biên nhiễu mỗi vòng. */
  bien_dong_bp: number;
  /**
   * Mô tả KHÁI QUÁT cho nút (!) — đặc điểm và tác dụng, KHÔNG con số.
   * Là chuỗi người chơi đọc nên chịu lint từ vựng D26.
   */
  mo_ta: string;
  /**
   * v42 (D311) — mã này có TRẢ DÒNG TIỀN không, và trả kiểu gì.
   *
   * `'coupon'` = trả lãi vào TIỀN MẶT mỗi ô theo lãi suất nền đang công bố
   * (`couponBp`); sổ KHỐNG thì ngược lại, người khống phải TRẢ khoản đó.
   * `'khong'` = tài sản chết, chỉ lãi/lỗ theo giá.
   *
   * ⚠ Bắt buộc mọi phần tử (không `?`): thêm một lá mà quên khai là im lặng
   * cho nó thành tài sản chết, và không gì báo.
   * ⚠ Chỉ có tác dụng khi cờ `couponTpcp` bật — trận cũ không đổi một chip nào.
   */
  dong_tien: 'coupon' | 'khong';
  /**
   * v42 (D311) — mã này BÁN KHỐNG được không.
   *
   * `false` cho `cp_cn`: sàn Việt Nam không cho bán khống cổ phiếu cơ sở. VN30
   * khống được vì có hợp đồng phái sinh, nên nó vẫn `true` — đó là ranh giới
   * thật của thị trường, không phải một luật cân bằng.
   * ⚠ Chỉ chặn lệnh MỞ khống. `dong_khong` không bao giờ bị chặn: cấm đóng một
   * vị thế đang mở là nhốt người chơi trong đó.
   * ⚠ Chỉ có tác dụng khi cờ `khongTheoMa` bật.
   */
  khong_duoc: boolean;
}

/*
 * ─── D310 (08/09/2026) — ĐỔI TÊN BỐN LÁ, `id` ĐÓNG BĂNG ──────────────────────
 *
 * Founder chốt bộ tài sản v2 cho thị trường Việt Nam: `BTC`→**Crypto** ·
 * `CP Công nghệ`→**CP Chứng khoán** · `USD`→**USDT** · `Trái phiếu CP`→**Trái
 * phiếu Mỹ**. `vn30` và `vang` giữ nguyên.
 *
 * ⚠ CHỈ `label` · `mo_ta` · `icon` ĐỔI. `id` KHÔNG ĐỔI, và đây không phải sự
 * cẩn thận thừa — id tài sản là khoá của bảy nơi, trong đó hai nơi là cửa MỘT
 * CHIỀU:
 *   · `THU_TU_MA_SUC_CANG` (`server/holdem/map.ts`) sinh mảng `tension_true_bps`
 *     GHI VÀO `events` — luật 03 §4: đổi thứ tự/khoá là hỏng dữ liệu đã lưu.
 *   · `action_log` của mọi trận đã chơi mang id trong lệnh; đổi id = replay sai.
 * Năm nơi còn lại (`MT_TAI_SAN_*`, `TUONG_QUAN`, `CAN_TROI_BP`, `PHAN_THAN`,
 * `BE_CHUOI_VON`) thì đổi id là hỏng cân bằng im lặng.
 *
 * Tiền lệ cùng kiểu: `hack_san` giữ id khi nhãn đổi thành "Sập sàn" (v28, xem
 * `SU_KIEN` dưới). Nhãn là trình bày nên trận cũ replay cũng mang nhãn mới —
 * đúng ý: người chơi xem lại trận cũ thấy tên hiện hành, không thấy tên đã bỏ.
 *
 * ⚠ `nhom` · `thanh_khoan` · `bien_dong_bp` GIỮ NGUYÊN ở đợt này. Bộ số theo
 * tên mới (CTCK beta cao hơn, USDT có rủi ro mất neo, trái phiếu Mỹ tách coupon)
 * nằm ở cổng `balance-v42-taisan` — đổi số ở đây là đổi luật engine không qua
 * cổng (A11.3).
 *
 * ─── 10/10/2026 (sổ chốt) — TÊN CHUNG, KHÔNG TÊN CỤ THỂ NGOÀI ĐỜI ─────────────
 *
 * Founder chốt: tên lá là TÊN LỚP chung; ví dụ cụ thể ngoài đời dời vào Bách
 * khoa (A10 "mô tả được"). `CP Chứng khoán`→**Cổ tech** · `VN30`→**Blue-chip**
 * · `USDT`→**Stablecoin** · `Trái phiếu Mỹ`→**Trái phiếu**. Bản đầu cùng ngày
 * ("CP Công nghệ · Rổ 30 · Đồng ổn định USD · Trái phiếu chính phủ") founder bác:
 * *"gượng ép, ngắn gọn dễ nhớ và mang tính biểu tượng thôi"*.
 * Crypto · Vàng giữ. Như D310: chỉ `label` · `mo_ta` đổi, id và mọi số giữ —
 * không `balance_version` mới.
 */
export const TAI_SAN: readonly TaiSan[] = [
  { id: 'btc',    label: 'Crypto',        icon: '◈', nhom: 'rui_ro',    thanh_khoan: 'mong', bien_dong_bp: 400,
    dong_tien: 'khong', khong_duoc: true,
    mo_ta: 'Tiền mã hoá: sổ cái chung không ai in thêm được, giá đi theo dòng tiền rẻ và niềm tin của đám đông. Không ngân hàng trung ương nào đứng ra đỡ khi nó rơi.' },
  { id: 'cp_cn',  label: 'Cổ tech',       icon: '💻', nhom: 'rui_ro',  thanh_khoan: 'vua',  bien_dong_bp: 280,
    dong_tien: 'khong', khong_duoc: false,
    mo_ta: 'Cổ phiếu nhóm công nghệ. Giá đặt cược vào lợi nhuận tương lai xa, nên nhạy với tiền rẻ, lãi suất và luật lệ — lên xuống mạnh hơn cả thị trường chung.' },
  { id: 'vn30',   label: 'Blue-chip',     icon: '📊', nhom: 'rui_ro',   thanh_khoan: 'day',  bien_dong_bp: 170,
    dong_tien: 'khong', khong_duoc: true,
    mo_ta: 'Rổ cổ phiếu của những công ty lớn và vững nhất sàn. Mua nó là mua một lát cắt của cả nền kinh tế, thay vì đặt cược vào một công ty.' },
  { id: 'vang',   label: 'Vàng',          icon: '🥇', nhom: 'phong_thu', thanh_khoan: 'vua', bien_dong_bp: 240,
    dong_tien: 'khong', khong_duoc: true,
    mo_ta: 'Kim loại người ta bám vào suốt 5.000 năm mỗi khi mất niềm tin vào tiền giấy. Không trả lãi, không sinh lời — giá trị nằm ở chỗ ai cũng công nhận nó.' },
  { id: 'usd',    label: 'Stablecoin',    icon: '🪙', nhom: 'phong_thu', thanh_khoan: 'day', bien_dong_bp: 150,
    dong_tien: 'khong', khong_duoc: true,
    mo_ta: 'Đồng tiền số neo 1:1 vào đô la Mỹ, nằm trên sàn crypto. Giá đi theo tỷ giá USD/VND, nhưng sàn sập hay bị siết thì tấm neo cũng rung.' },
  { id: 'tpcp',   label: 'Trái phiếu',    icon: '🏛', nhom: 'phong_thu', thanh_khoan: 'vua', bien_dong_bp: 160,
    dong_tien: 'coupon', khong_duoc: true,
    mo_ta: 'Chính phủ một nước lớn vay tiền của bạn và trả lãi cố định mỗi kỳ. Lãi suất thị trường tăng thì tờ cũ mất giá, vì tờ phát hành mới trả cao hơn.' },
] as const;

/** Trần theo nhóm tương quan — D20 vẫn áp: không dồn hết vào một rổ (bp). */
export const TRAN_NHOM_BP: Record<NhomTaiSan, number> = {
  rui_ro: 7000,
  phong_thu: 5500,
};

// ---------------------------------------------------------------------------
// GIAI ĐOẠN THỊ TRƯỜNG (regime) — D24 mục 16.4
// ---------------------------------------------------------------------------

export type GiaiDoanId = 'di_ngang' | 'tang' | 'giam' | 'bien_dong' | 'phuc_hoi';

export interface GiaiDoan {
  id: GiaiDoanId;
  label: string;
  icon: string;
}

export const GIAI_DOAN: readonly GiaiDoan[] = [
  { id: 'di_ngang',  label: 'Đi ngang',       icon: '➖' },
  { id: 'tang',      label: 'Tăng',           icon: '📈' },
  { id: 'giam',      label: 'Giảm',           icon: '📉' },
  { id: 'bien_dong', label: 'Quá nóng',       icon: '⚡' },   // D560 — khớp art lá QUÁ NÓNG (D393)
  { id: 'phuc_hoi',  label: 'Phục hồi',       icon: '🌱' },
] as const;

// ---------------------------------------------------------------------------
// SỰ KIỆN BẤT NGỜ — D24 mục 16.4 + 17.1
// ---------------------------------------------------------------------------

export type SuKienId =
  | 'ha_lai_suat' | 'tang_lai_suat' | 'hack_san' | 'thien_nga_den' | 'lam_phat'
  | 'chien_tranh' | 'bong_bong'
  | 'phap_ly' | 'pha_san' | 'cam_van' | 'tham_hoa' | 'dich_benh';

export interface SuKien {
  id: SuKienId;
  label: string;
  icon: string;
  /** TELEGRAPH: sự kiện THẬT làm ô kế nghiêng về giai đoạn này (D24 mục 17.1b). */
  bao_truoc: GiaiDoanId;
}

export const SU_KIEN: readonly SuKien[] = [
  { id: 'ha_lai_suat',   label: 'Hạ lãi suất',  icon: '🕊', bao_truoc: 'tang' },
  { id: 'tang_lai_suat', label: 'Tăng lãi suất', icon: '🔒', bao_truoc: 'giam' },
  /*
   * ⚠⚠ v52 nhãn (D351, founder 19/09): 'Sập sàn' → **'Sàn khoá rút tiền'**, icon 💀 → 🧊 (KHÔNG dùng 🔒: 'Tăng lãi suất' đã cầm hình đó — suite root bắt).
   * Id GIỮ NGUYÊN — đây là lần đổi nhãn THỨ HAI của cùng một ô, đúng lý lẽ ghi bên dưới.
   * Hai teammate chơi thử 19/09: *"hình ảnh hiện tại hơi khó hiểu và xa vời"*. Đối soát ra hai
   * lỗi, không phải một:
   *   1. XA — "sàn sập" trong đầu người Việt 16–30 là chuyện sàn crypto nước ngoài (FTX), và
   *      nó là ô SỰ KIỆN ĐẦU TIÊN người mới gặp (vòng 2 bàn tập).
   *   2. NHẬP NHẰNG, nặng hơn — trong tiếng lóng chứng khoán VN, **"sàn" là giá kịch sàn**
   *      ("giảm sàn"), và CHÍNH APP dùng nghĩa ấy ở mục Gọi ký quỹ (*"nhiều mã giảm sàn nhiều
   *      phiên liền"*). Tức một từ, hai nghĩa, trong cùng một sản phẩm.
   * Nhãn mới tả HẬU QUẢ NGƯỜI CHƠI CHỊU (không lấy được tiền ra) thay vì tả sự cố kỹ thuật,
   * nên nó đúng cho cả ba ca mà id này gom: bị hack · mất khả năng chi trả · ôm tiền bỏ chạy.
   * ⚠ Nhãn KHÔNG khẳng định gian lận — "khoá rút tiền" đúng với cả ca sàn bị hack.
   *
   * v28 (founder 08/08): đổi nhãn 'Hack sàn' → 'Sập sàn' — id GIỮ NGUYÊN vì id
   * nằm trong action_log/events của mọi trận đã lưu (đổi id là viết lại lịch
   * sử); nhãn chỉ là trình bày nên trận cũ replay cũng mang nhãn mới, đúng ý.
   */
  { id: 'hack_san',      label: 'Sàn khoá rút tiền', icon: '🧊', bao_truoc: 'giam' },
  { id: 'thien_nga_den', label: 'Thiên nga đen', icon: '🦢', bao_truoc: 'bien_dong' },
  { id: 'lam_phat',      label: 'Lạm phát nóng', icon: '🔥', bao_truoc: 'bien_dong' },
  { id: 'chien_tranh',   label: 'Chiến tranh',   icon: '⚔', bao_truoc: 'bien_dong' },
  { id: 'bong_bong',     label: 'Bong bóng',     icon: '🫧', bao_truoc: 'tang' },
  /*
   * ─── NHÓM ĐUÔI 5 MẶT (D43 bước 7, founder 01/08: "bỏ thẻ thiên nga đen, vẽ
   * thành 5 thẻ khác nhau cho người chơi dễ nhận biết") ───────────────────────
   * Thiên nga đen thật thì không có tên trước — thứ nằm trong bộ bài với xác
   * suất biết trước là RỦI RO ĐUÔI ĐÃ BIẾT; đặt tên là trung thực hơn (03 §6.1).
   * Tần suất giảm dần, độ lớn tăng dần — quy luật thật và là bài học của bảng.
   * Mặt `thien_nga_den` GIỮ trong mảng cho trận ≤ v15 replay; v16 khoá nó = 0.
   */
  { id: 'phap_ly',   label: 'Siết pháp lý',        icon: '⚖', bao_truoc: 'bien_dong' },
  { id: 'pha_san',   label: 'Phá sản dây chuyền',  icon: '🏦', bao_truoc: 'giam' },
  { id: 'cam_van',   label: 'Cấm vận',             icon: '⛓', bao_truoc: 'bien_dong' },
  { id: 'tham_hoa',  label: 'Thảm hoạ tự nhiên',   icon: '🌪', bao_truoc: 'bien_dong' },
  { id: 'dich_benh', label: 'Khủng hoảng sinh học', icon: '🦠', bao_truoc: 'giam' },
] as const;

/**
 * ⭐⭐ TÍNH CHẤT Ô SỰ KIỆN (D152/K1 — founder chỉnh lần hai 29/08: *"đ** phải
 * huy hiệu HỌ lên ô sự kiện mà là huy hiệu TÍNH CHẤT của ô — ở thiết kế mới,
 * 1 thẻ với chuỗi sự kiện trước đó có thể có tính chất khác nhau"*).
 *
 * KIẾN TRÚC: tính chất là thuộc tính CỦA TỪNG Ô THEO NGỮ CẢNH, do SERVER tính
 * và gửi trong DTO ô (`oCongKhai`) — client chỉ vẽ ID nhận được (D26). Bảng
 * dưới là TÍNH CHẤT NỀN (khi không có ngữ cảnh đè); v35 thêm luật tương tác
 * thì cùng một hàm đó trả tính chất NGỮ CẢNH (vd `tang_lai_suat` nổ khi dư âm
 * lạm phát còn sống ⇒ ĐÚNG THUỐC chứ không phải van-tiền-đánh-hết) — client
 * không phải sửa một dòng, chỉ thêm entry icon/tên.
 *
 * Bốn tính chất nền, suy từ PHE ĂN của `MT_TAI_SAN_SU_KIEN`:
 *   van_tien   — van thanh khoản: tiền rẻ nâng gần hết (usd chịu), tiền đắt
 *                đánh gần hết (usd ăn).
 *   hung_phan  — tiền RÚT từ trú ẩn BƠM vào rủi ro, xoay gắt chiều lên.
 *   hoang_loan — rủi ro chảy máu, trú ẩn ăn.
 *   lech_ma    — đánh CHỌN LỌC từng mã, không theo phe.
 *
 * ⚠ `Record<SuKienId, ...>` CÓ CHỦ ĐÍCH: thêm sự kiện mới mà quên gán là LỖI
 * BIÊN DỊCH, không phải một ô "vô danh" lặng lẽ (bẫy im lặng lớp `MAU_O` D125).
 * ⚠ Tính theo MẶT CHỮ của tin — tin giả mang tính chất của tin nó GIẢ DẠNG;
 * ngữ cảnh cũng đọc theo mặt chữ (dư âm tin giả chưa lộ vẫn "sống"). Cờ
 * `la_tin_gia` không được rò qua bất kỳ nhãn nào (D149 §2).
 * ⚠ Đổi tính chất nền của một sự kiện là đổi thứ người chơi ĐÃ HỌC — cần D-số.
 */
export type TinhChatO = 'van_tien' | 'hung_phan' | 'hoang_loan' | 'lech_ma';
export const TINH_CHAT_NEN: Record<SuKienId, TinhChatO> = {
  ha_lai_suat: 'van_tien',
  tang_lai_suat: 'van_tien',
  bong_bong: 'hung_phan',
  thien_nga_den: 'hoang_loan',
  chien_tranh: 'hoang_loan',
  phap_ly: 'hoang_loan',
  pha_san: 'hoang_loan',
  cam_van: 'hoang_loan',
  tham_hoa: 'hoang_loan',
  dich_benh: 'hoang_loan',
  hack_san: 'lech_ma',
  lam_phat: 'lech_ma',
} as const;
/**
 * NGÂN SÁCH ĐUÔI (03 §6.2): 30/25/20/15/10% của trọng số nền thiên nga cũ
 * (1000) — envelope P_TAIL BẢO TOÀN theo cấu trúc, không đặt số mới (Q4/8.2).
 */
export const DUOI_5MAT: Record<string, number> = {
  phap_ly: 300, pha_san: 250, cam_van: 200, tham_hoa: 150, dich_benh: 100,
};

/**
 * DÂY CHUYỀN SỰ KIỆN — sự kiện nào KÉO THEO sự kiện nào (founder 20/07).
 *
 * Trước đây mỗi ô sự kiện rút ĐỘC LẬP và ĐỀU NHAU, nên thị trường không có trí
 * nhớ nhân quả: chiến tranh nổ ra rồi vòng sau có thể là "hack sàn" chẳng liên
 * quan gì. Founder gọi đúng: "cơ chế tương tác giữa các thẻ sự kiện và mùa thị
 * trường hiện tại hơi nghèo nàn".
 *
 * Bảng này là TRỌNG SỐ CỘNG THÊM cho lần rút sự kiện kế tiếp, tính từ sự kiện
 * THẬT gần nhất. Nền mỗi sự kiện là 1.000; cộng thêm ở đây làm nó trội lên.
 *
 * Vì sao chỉ tính từ tin THẬT: tin giả mà vẫn kéo được dây chuyền thì người
 * chơi không có cách nào phân biệt thật/giả qua hệ quả — mất luôn tín hiệu
 * hiệu chỉnh mà gate G4 tồn tại để đo.
 *
 * Hai chuỗi founder nêu đích danh, cộng vài chuỗi kinh tế học cùng họ:
 *   chiến tranh → lạm phát → tăng lãi suất   (sốc cung → giá → thắt tiền)
 *   hạ lãi suất → bong bóng                  (tiền rẻ → thổi giá)
 */
export const MT_SU_KIEN_KE_TIEP: Record<SuKienId, Partial<Record<SuKienId, number>>> = {
  // Bonus TỚI đuôi chia đúng tỷ lệ 30/25/20/15/10 — tổng giữ nguyên ngân sách
  // chain cũ (2000/1500); mục thien_nga_den giữ cho trận ≤ v15 (v16 khoá 0).
  chien_tranh:   { lam_phat: 4500, thien_nga_den: 1500,
    phap_ly: 450, pha_san: 375, cam_van: 300, tham_hoa: 225, dich_benh: 150 },
  lam_phat:      { tang_lai_suat: 5000 },
  tang_lai_suat: { hack_san: 1200 },
  ha_lai_suat:   { bong_bong: 5000 },
  bong_bong:     { thien_nga_den: 2000, hack_san: 1500,
    phap_ly: 600, pha_san: 500, cam_van: 400, tham_hoa: 300, dich_benh: 200 },
  hack_san:      { thien_nga_den: 1500,
    phap_ly: 450, pha_san: 375, cam_van: 300, tham_hoa: 225, dich_benh: 150 },
  thien_nga_den: { ha_lai_suat: 2500 },
  // Đuôi kéo hạ lãi suất khẩn — khép vòng chu kỳ 0.1; sinh học kéo MẠNH NHẤT
  // (2020→2021: đại dịch → tiền rẻ → sức căng dồn lại). Cấm vận đẩy lạm phát
  // → kỳ họp kế nghiêng Tăng (chữ ký §6.2).
  phap_ly:   { ha_lai_suat: 2000 },
  pha_san:   { ha_lai_suat: 3000 },
  cam_van:   { lam_phat: 4500, ha_lai_suat: 1500 },
  tham_hoa:  { ha_lai_suat: 1500 },
  dich_benh: { ha_lai_suat: 4000 },
};

/**
 * v35 — CẠNH DÂY CHUYỀN MỞ RỘNG (D157; founder duyệt hướng 29/08: *"cải tiến
 * và làm đa dạng về cơ chế chuỗi thẻ và tác động giữa các thẻ, mô phỏng nền
 * kinh tế thật"*). Trọng số CỘNG THÊM vào bảng nền, chỉ sống sau cổng
 * `chuoiMoRong` — bảng nền có sáu người đọc (nghiêng ô map-gen · nối-chuỗi tỷ
 * lệ tin giả · Lướt Sóng dây chuyền · keo_theo telegraph · dự báo bảng điện tử
 * · nhanhHeQua legacy), sửa thẳng nó là đổi map của mọi trận đã lưu.
 *
 * ⚠ MỌI SỐ LÀ MC-TUNE (A8.2): agent đề xuất, founder chốt sau khi xem MC.
 * ⚠ Hai cạnh (chien_tranh→cam_van · tham_hoa→lam_phat) chỉ SỐNG khi
 * `duoi5: true` — v34 khoá trọng số 5 mặt đuôi về 0 (D147 chẩn đúng lớp này
 * cho SIẾT PHÁP LÝ). Entry v35 vì thế đề xuất bật lại duoi5; giữ duoi5 tắt mà
 * giữ hai cạnh này là dựng thêm hai cơ chế trang trí.
 */
export const MT_KE_TIEP_MO_RONG: Partial<Record<SuKienId, Partial<Record<SuKienId, number>>>> = {
  // NHTW dập bong bóng — cú gãy bằng CHÍNH SÁCH, khác cú gãy bằng tai hoạ
  // (D150). Đứng cạnh thien_nga_den 2000 của bảng nền: hai đường vỡ cân nhau.
  bong_bong: { tang_lai_suat: 2000 },
  // Đứt cung sau tai hoạ (Tōhoku 2011 → giá linh kiện; 2020 → chuỗi cung).
  tham_hoa: { lam_phat: 3000 },
  // Chiến tranh kéo cấm vận — nâng cạnh đuôi 300 sẵn có lên 1500 hiệu dụng.
  // ⚠ Cạnh MỘT MÌNH không đủ nuôi cộng-hưởng-trú-ẩn: đo D158 cặp nổ 0/1500
  // trận (kế thừa tự do hiếm theo cấu trúc, nâng cạnh lên 4500 cũng chỉ ra
  // 2/1500) — cú ÉP `EP_CAM_VAN_BP` bên dưới mới là van sống của cặp.
  chien_tranh: { cam_van: 1200 },
  // Lạm phát DAI DẲNG — cạnh TỰ THÂN duy nhất của bảng: kỳ vọng giá tự nuôi nó
  // (1970s). Chỉ nghiêng lần rút SỰ KIỆN KẾ (hai sự kiện không bao giờ liền
  // nhau — luật xen kẽ); `nhanhHeQua` legacy đọc bảng NỀN nên không bao giờ
  // thấy cạnh tự thân — echo không tự nhân.
  lam_phat: { lam_phat: 1500 },
};

/** Bảng đã gộp, tính MỘT lần lúc nạp module — cạnh trùng thì CỘNG DỒN. */
const MT_KE_TIEP_GOP_V35: Record<SuKienId, Partial<Record<SuKienId, number>>> = (() => {
  const gop: Record<string, Partial<Record<string, number>>> = {};
  for (const [tu, hang] of Object.entries(MT_SU_KIEN_KE_TIEP)) gop[tu] = { ...hang };
  for (const [tu, hang] of Object.entries(MT_KE_TIEP_MO_RONG)) {
    const dich = gop[tu] ?? (gop[tu] = {});
    for (const [den, w] of Object.entries(hang)) dich[den] = (dich[den] ?? 0) + w;
  }
  return gop as Record<SuKienId, Partial<Record<SuKienId, number>>>;
})();

/**
 * MỘT CỬA đọc bảng dây chuyền cho mọi đường SỐNG (map-gen · Lướt Sóng ·
 * keo_theo · dự báo). Cờ tắt ⇒ trả CHÍNH object bảng nền — so sánh `===` được,
 * là bằng chứng cấu trúc rằng trận cũ không trôi một bp nào. Ngoại lệ duy nhất
 * được đọc thẳng bảng nền: `nhanhHeQua` (chỉ chạy khi `boNhanhHeQua` tắt, tức
 * trận ≤ v17 — thời chưa có cạnh mở rộng); test nguồn-một-cửa đếm đúng nó.
 */
export function mtKeTiep(
  moRong?: boolean,
): Record<SuKienId, Partial<Record<SuKienId, number>>> {
  return moRong === true ? MT_KE_TIEP_GOP_V35 : MT_SU_KIEN_KE_TIEP;
}

/**
 * v35 — CẠNH NGHE MÔI TRƯỜNG TIỀN TỆ (K3c): cùng một cạnh nhân quả, môi trường
 * khác thì LỰC KÉO khác. Chỉ HAI luật — mỗi luật thêm là một chiều phải đo lại
 * gate (D150). Cặp không khai ⇒ 10000 (không đụng). Nhân lên phần BONUS chuỗi,
 * không đụng nền — xác suất nền theo môi trường là việc của bảng v26.
 */
export const KE_TIEP_THEO_MOI_TRUONG: readonly {
  tu: SuKienId; den: SuKienId; moi_truong: 're' | 'trung_tinh' | 'dat'; nhan_bp: number;
}[] = [
  // Tiền ĐÃ đắt mà lạm phát vẫn nổ ⇒ NHTW hết dư địa chờ — thuốc gần hơn. MC-TUNE.
  { tu: 'lam_phat', den: 'tang_lai_suat', moi_truong: 'dat', nhan_bp: 15000 },
  // Tiền rẻ chồng tiền rẻ ⇒ bong bóng gần hơn (vế thuận "bong bóng có gốc" v28). MC-TUNE.
  { tu: 'ha_lai_suat', den: 'bong_bong', moi_truong: 're', nhan_bp: 15000 },
];

/**
 * v35 — BA LUẬT TƯƠNG TÁC THẺ (D158; cổng `tuongTacThe`). Giữ ĐÚNG BA — mỗi
 * luật thêm là một chiều phải đo lại gate (D150). Mọi số MC-TUNE (A8.2).
 *
 * · ĐÚNG THUỐC không có hằng số: tăng lãi THẬT dập HẲN dư âm lạm phát còn
 *   sống (cắt echo, không giảm nửa) — thêm hệ số là thêm một cần gạt phải đo.
 * · ĐỔ DẦU đếm bằng `bbDoDau` trong máy sinh map: mỗi lần hạ lãi THẬT rơi
 *   giữa chế độ bong bóng là một lần tiếp nhiên liệu — leo bằng dầu thì hố
 *   cũng sâu bằng dầu (cả nghiêng lẫn độ sâu vỡ cùng ăn).
 * · CỘNG HƯỞNG TRÚ ẨN đọc cửa sổ dư âm (SO_VONG_ECHO) — "≤2 vòng" của D150
 *   chính là tuổi echo 0..2, không đặt cửa sổ thứ hai.
 */
export const TUONG_TAC_THE = {
  /** ĐỔ DẦU: mỗi lần tiếp dầu cộng thêm bấy nhiêu vào nghiêng `tang` của chế độ. MC-TUNE. */
  DO_DAU_THEM_BP: 6000,
  /** …và cú vỡ sâu thêm bấy nhiêu ô mỗi lần (vẫn chịu trần VO_TOI_DA_O). MC-TUNE. */
  DO_DAU_VO_THEM_O: 1,
  /** CỘNG HƯỞNG TRÚ ẨN: hệ số nhân lên delta VÀNG của hai nguồn trong cặp. MC-TUNE. */
  CONG_HUONG_VANG_BP: 15000,
  /**
   * …và xác suất chiến tranh THẬT ép một ô CẤM VẬN vào khe sự kiện kế (khuôn
   * `epDuoi` của điềm). Không có cú ép này thì cặp cộng hưởng là cơ chế trang
   * trí (đo D158: 0/1500 trận) — hai mặt đuôi hiếm nhân nhau. MC-TUNE.
   */
  EP_CAM_VAN_BP: 4000,
  /**
   * Cửa sổ VÒNG của cặp cộng hưởng: hai sự kiện nổ cách nhau trong bấy nhiêu
   * vòng thì cặp mở (mở ở vòng thành viên sau nổ + các vòng dư âm nó còn nằm
   * trong cửa sổ). ⚠ KHÔNG ăn ké tuổi echo (3): đo D158 — cú ép đậu ở khe
   * i+3/i+4 thì dư âm chiến tranh đã chết trước khi cấm vận lật, cặp câm ở
   * 100% các ca đó. Phác thảo D150 ghi "≤2 vòng" — số này CHỜ FOUNDER cùng
   * bảng MC. MC-TUNE.
   */
  CONG_HUONG_CUA_SO_VONG: 5,
} as const;

/** v35 — nguồn mở chuỗi (D159). LATENT — không hiển thị, không DTO (§7/D154). */
export type NguonChuoi = 'tien_re' | 'tin_don' | 'chinh_sach_that' | 'hoang_loan';

/**
 * v35 — MARKOV THEO NGUYÊN NHÂN (D159, cổng `markovNguon`): độ lì của chuỗi
 * đọc theo NGUỒN lúc chuỗi MỞ (ô đứng trước ô mở + môi trường tiền tệ — cờ tin
 * giả của ô đó ĐÃ LỘ khi các ô sau được rút, máy chỉ phản ứng thông tin công
 * khai, cùng lý lẽ v28).
 *
 * ⚠⚠ VÌ SAO KHÔNG PHẢI HỆ SỐ NHÂN LÊN TU_LAP: bản đầu D159 nhân ×1,4/×0,5 và
 * ĐO RA TRANG TRÍ — tuổi chuỗi 1,70→1,71 trên 1200 seed, đúng điều chú thích
 * `tuLapBp` đã đo từ trước ("chỉ nhân biên tilt thì autocorr gần như không
 * nhúc nhích — đòn bẩy hình dạng thật sự là NGƯỠNG"). Nên hai đòn bẩy THẬT:
 *  · nguồn LÌ (tien_re · chinh_sach_that): quán tính bám NGAY TỪ Ô ĐẦU
 *    (ngưỡng chuỗi 1 thay 2 — khuôn map-chậm speed-0 sẵn có);
 *  · nguồn MAU TÀN (tin_don · hoang_loan): cộng trọng số cho MẶT ĐẢO CHIỀU
 *    từ ô thứ hai — hazard chủ động, không phải tilt yếu đi.
 *
 * ⚠ BONG BÓNG (hung_phan) CỐ Ý VẮNG MẶT: chế độ v27 sở hữu độ lì mòn dần của
 * nó (D152 "giữ v27") — trong chế độ, cả hai đòn bẩy TẮT (guard `bbDaPhong`).
 * MỌI SỐ MC-TUNE (A8.2).
 */
export const MARKOV_NGUON = {
  /** Nguồn LÌ: ngưỡng chuỗi hiệu dụng (thay QUAN_TINH.NGUONG_CHUOI). */
  NGUONG_LI: 1,
  /**
   * …VÀ biên TU_LAP nhân lên cho nguồn lì — hai đòn phải đi CẶP: đo D159,
   * ngưỡng-1 một mình chỉ thêm đúng một cú rút được nghiêng (tuổi chuỗi
   * 1,70→1,74); ×2,5 trên nền ngưỡng-1 mới thành gradient đọc được. MC-TUNE.
   */
  LI_TU_LAP_X_BP: 25000,
  /** Nguồn MAU TÀN: +bp cho mặt đảo chiều mỗi ô từ ô thứ hai. MC-TUNE. */
  GAY_BP: 3500,
  /** Phân lớp nguồn — một nguồn hoặc lì hoặc mau tàn, không cả hai. */
  NGUON_LI: ['tien_re', 'chinh_sach_that'] as readonly NguonChuoi[],
  NGUON_MAU_TAN: ['tin_don', 'hoang_loan'] as readonly NguonChuoi[],
} as const;

/**
 * v35 — BẺ CHUỖI VĨ MÔ BẰNG VỐN (D160, cổng `beChuoiVon`). Phần lớn VỐN bàn
 * dồn TẬP TRUNG vào một phe theo cách PHI LÝ (ngược chiều chuỗi pha đang chạy
 * VÀ ngược môi trường tiền tệ — founder chốt "cả 2") ⇒ ô PHA sắp lật có xác
 * suất bị bẻ về phía đám đông. Nghiêng xác suất, không định đoạt (§3 addendum
 * giữ stochasticity — vẫn một cú rút theo seed). Cá mập tập trung ⇒ cộng nhẹ,
 * tính bằng lượng vốn (lời founder). MỌI SỐ MC-TUNE (A8.2).
 */
export const BE_CHUOI_VON = {
  /** Ngưỡng: nhóm phi lý phải giữ ≥ bấy nhiêu bp TỔNG NAV bàn. MC-TUNE. */
  NGUONG_VON_BP: 6000,
  /** Xác suất bẻ khi hội đủ điều kiện. MC-TUNE. */
  XAC_SUAT_BP: 2500,
  /** Cá mập tập trung cùng phe ⇒ cộng thêm vào xác suất. MC-TUNE. */
  CA_MAP_THEM_BP: 1000,
  /** "Tập trung" của cá mập: ≥ bấy nhiêu bp NAV RIÊNG nó nằm trong phe. MC-TUNE. */
  NGUONG_CA_MAP_BP: 6000,
  /** Chỉ chuỗi pha đã chạy ≥ bấy nhiêu ô mới có gì để bẻ. */
  CHUOI_TOI_THIEU_O: 2,
} as const;

/**
 * v36 — MÁY REGIME TICK (D165, cổng `regimeTick`). Kiến trúc: mỗi ô pha là
 * MỘT TICK của nền — (1) chuỗi giảm có thể bị TIN TỐT THẬT cắt (⇒ mặt
 * `phuc_hoi`, đường DUY NHẤT mặt này còn xuất hiện); (2) nền có hướng đổ
 * HAZARD gãy (tuổi · nguồn Markov D159 · sức căng · môi trường ngược · điềm
 * xấu); (3) sống ⇒ rút MẶT trên nền (thuận/nghỉ/biến động — mặt NGƯỢC hướng
 * không tồn tại khi nền sống: mặt ngược CHÍNH LÀ cú gãy); (4) gãy ⇒ rút
 * chuyển tiếp. Nền NGANG mở hướng mới bằng cú rút riêng.
 *
 * Đáy-cần-thời-gian nay là CẤU TRÚC: XUỐNG không bao giờ nhảy thẳng LÊN qua
 * hazard — chỉ TIN TỐT THẬT cắt được (đúng chữ founder D152: "không cần thẻ
 * recovery nữa, thay bằng tin tức tốt cắt đứt chuỗi vĩ mô xấu").
 * MỌI SỐ MC-TUNE (A8.2).
 */
export const REGIME_TICK = {
  /** P(tin tốt THẬT vừa nổ CẮT chuỗi giảm) — cú sinh `phuc_hoi`. MC-TUNE. */
  CAT_CHUOI_XAU_BP: 7500,
  /** Hazard nền mỗi ô pha của nền CÓ HƯỚNG. MC-TUNE. */
  HAZARD_NEN_BP: 1800,
  /** …cộng mỗi ô tuổi nền (già hơn giòn hơn — thay độ mòn NGHIENG cũ). MC-TUNE. */
  HAZARD_TUOI_BP: 1900,
  /** Nhân hazard theo nguồn nền: LÌ ×0,6 · MAU TÀN ×1,9 (D159). MC-TUNE. */
  HAZARD_NGUON_LI_BP: 6000,
  HAZARD_NGUON_TAN_BP: 19000,
  /** Môi trường tiền tệ NGƯỢC hướng nền ⇒ cộng hazard. MC-TUNE. */
  HAZARD_NGUOC_MT_BP: 1500,
  /**
   * SỨC CĂNG cộng vào hazard của nền LÊN — CHIẾT KHẤU, không nguyên.
   * ⚠ Đo D170: cộng nguyên làm chợ LỆCH GẤU hẳn (mặt tăng 34,8% ở v35 →
   * 21,5%) vì máy tick giết CẢ NỀN chứ không chỉ nghiêng một ô như máy cũ —
   * và chợ lệch gấu kéo đổ hai gate (G1 map 8 · G4 map 12/16). MC-TUNE.
   */
  HAZARD_CANG_BP: 4000,
  /** Điềm xấu (tin thật bao_truoc ngược hướng nền vừa nổ) ⇒ cộng hazard. MC-TUNE. */
  HAZARD_TELEGRAPH_BP: 3000,
  /** Mặt trên nền SỐNG: thuận hướng · nghỉ (đi ngang) · biến động. MC-TUNE. */
  MAT_THUAN_BP: 6000,
  MAT_NGHI_BP: 2000,
  MAT_BIEN_DONG_BP: 1600,
  /** Nền NGANG: giữ nghỉ · biến động · mở LÊN · mở XUỐNG (mỗi hướng). MC-TUNE. */
  NGANG_NGHI_BP: 2400,
  NGANG_BIEN_DONG_BP: 1800,
  NGANG_MO_HUONG_BP: 5200,
  /** Điềm (tin thật bao_truoc có hướng) nhân vào cửa MỞ hướng đó của nền NGANG. MC-TUNE. */
  /**
   * ⚠ ĐO D170: 30000 (×3) làm bot TIN-MỌI-TIN thắng bot HOÀI-NGHI (G4 đỏ ba
   * map) — vì máy tick ĐẾM TELEGRAPH HAI LẦN: một lần cộng vào mặt thuận,
   * một lần nhân cửa mở hướng, nên tin THẬT kéo theo hệ quả đậm hơn hẳn máy
   * cũ và cược to theo tin lời hơn chiết khấu. MC-TUNE.
   */
  NGANG_MO_TELEGRAPH_X_BP: 16000,
  /** Gãy từ nền CÓ HƯỚNG: về NGANG · đảo hướng (LÊN gãy ⇒ mặt giảm mở XUỐNG;
   *  XUỐNG gãy chỉ về NGANG — cấu trúc đáy-cần-thời-gian) · mặt biến động giữ nền. MC-TUNE. */
  GAY_VE_NGANG_BP: 4500,
  GAY_DAO_HUONG_BP: 2200,
  GAY_BIEN_DONG_BP: 2000,
  /**
   * ═══ NỀN VÀO VÒNG TIN — BẢN C: NHÂN, KHÔNG CỘNG (D172, founder chốt "C đi")
   *
   * BẢN CŨ (D166–D170) CỘNG nền vào giá vòng tin. Đo ra một bệnh có gốc rõ:
   * nền là thành phần CHUNG, **không phụ thuộc tin thật hay giả**, nên nó pha
   * loãng đúng tín hiệu mà bot hoài-nghi sống nhờ ⇒ G4 đổ. Và hạ số KHÔNG cứu
   * được (map 16, N=12.000): 15% ✗ −0,03 · 8% ✗ −0,04 · 0% ✓ +0,01 — quan hệ
   * không đơn điệu, chỉ tắt hẳn mới xanh, mà tắt là mất addendum §1.
   *
   * BẢN C chữa GỐC: nền không tự sinh một khoản lãi/lỗ riêng nữa, nó **NHÂN
   * vào chính lực của TIN** — tin đi THUẬN nền ăn đậm hơn, tin đi NGƯỢC nền bị
   * nền ghì lại. Ba cái được cùng lúc:
   *   · vẫn đúng §1 addendum — "tin SỬA ĐIỀU KIỆN", đây đúng nghĩa đen của nó;
   *   · KHÔNG đẻ thành phần chung ⇒ hết pha loãng, G4 giữ được;
   *   · THƯỞNG người đọc được CẢ hai (nền + tin) thay vì phạt — kỹ năng lên.
   * Hướng tin đọc từ `bao_truoc` (nhãn CÔNG KHAI trên ô, đúng thứ người chơi
   * nhìn thấy); nền đọc từ `giai_doan_nen` (công khai qua khối K4 + `xu_huong`).
   * Tin GIẢ vẫn đảo dấu như cũ — nhân xong mới đảo, nên tin bịa thuận nền cũng
   * bị phạt đậm hơn: nói dối to giữa lúc chợ đang thuận thì trả giá to.
   * MC-TUNE.
   */
  TIN_THUAN_NEN_X_BP: 12500,
  TIN_NGUOC_NEN_X_BP: 8000,
} as const;

/**
 * ═══ CHU KỲ THỰC TẾ (D301, cổng `chuKyThucTe` — balance-v39-thucte, Ở CỔNG) ════════
 *
 * Founder 07/09: *"cải tiến cơ chế seed hiện tại sao cho mô phỏng sát nền kinh tế/chu kỳ
 * kinh tế ngoài đời nhất… mỗi chu kỳ đều phải có nguồn dữ liệu để dựa vào làm xác suất
 * tương đối… Ghi luôn rõ nguồn và cách quy đổi sang xác suất ingame."* Toàn văn nguồn
 * (URL) + quy đổi: `docs/thiet-ke-de-xuat/gameplay/chu-ky-thuc-te-nguon-va-quy-doi.md`.
 * Ở đây mỗi số kèm MỘT DÒNG nguồn để người đọc code không phải mở doc.
 *
 * ⚠ THANG THỜI GIAN: **1 ô = 6 tháng**. Chọn vì 12 ô ≈ 74,5 tháng = đúng một chu kỳ
 * trough-to-trough trung bình của NBER 1945–2020 (64,2 tháng mở rộng + 10,3 tháng co
 * hẹp) ⇒ bàn CHUẨN 12 ô kể trọn một chu kỳ, bàn 16 ô ≈ 1,3 chu kỳ.
 * ⚠ CÙNG MÁY TICK v36 — chỉ đổi SỐ. Cờ tắt ⇒ `thamSoTick(false)` = REGIME_TICK cũ
 * (hai tham số mới rơi về giá trị làm phép tính y hệt) ⇒ mọi trận đã lưu byte-hệt
 * (tests/chu_ky_thuc_te.test.ts §II khoá hash 300 map × 3 cỡ × 4 phiên bản).
 * ⚠ A8.2: số ở CỔNG, chưa mặc định. Founder chốt sau khi xem `npm run do:chu-ky-thuc-te`
 * (bản đang chạy vs v39 vs mục tiêu có nguồn) + gate G1–G4 ba cỡ map. Đổi số = đổi nguồn.
 */
export const REGIME_TICK_THUC_TE = {
  ...REGIME_TICK,
  /**
   * Chuỗi TĂNG gãy/ô: bull TB 988 ngày ≈ 2,7 năm = 5,4 ô ⇒ 1/5,4 = 18,5% (Hartford Funds, S&P từ
   * 1928). Đặt 20% vì nền bị nguồn-lì nhân 0,75 ở một phần chuỗi; tổng đo được ≈ 18–19% (bàn 12/16).
   */
  HAZARD_NEN_BP: 2000,
  /** Chuỗi TĂNG không "già đi": expansions KHÔNG có duration dependence (Diebold–Rudebusch 1990/1993). */
  HAZARD_TUOI_BP: 0,
  /**
   * Chuỗi GIẢM gãy/ô, CÓ tuổi (contractions duration dependence DƯƠNG — Diebold–Rudebusch):
   * 55% ô1 · 75% ô2 · 95% ô3 ⇒ E[dài] ≈ 1,57 ô — khớp bear TB 289 ngày ≈ 9,6 tháng ≈ 1,6 ô
   * (Hartford) và contraction NBER 10,3 tháng ≈ 1,7 ô.
   */
  HAZARD_GIAM_NEN_BP: 2500,
  HAZARD_GIAM_TUOI_BP: 2000,
  /**
   * PHỤ PHÍ HAZARD (sức căng · nguồn mau tàn/lì · ngược môi trường tiền · telegraph ngược)
   * KHÔNG có nguồn riêng — chúng là cơ chế của trò. Số có nguồn là TỔNG hazard đo được
   * (1/5,4 = 18,5%; đo lần 1 với phụ phí gốc ra 43–55% vì phụ phí cộng ~25 điểm lên nền).
   * Co phụ phí để tổng đo trên bàn 12/16 rơi vào 18–30% (`npm run do:chu-ky-thuc-te`);
   * bàn 8 giữ ×1,7 của D177 nên cao hơn có chủ ý.
   */
  HAZARD_CANG_BP: 1500,
  HAZARD_NGUON_TAN_BP: 12000,
  HAZARD_NGUON_LI_BP: 7500,
  HAZARD_NGUOC_MT_BP: 800,
  HAZARD_TELEGRAPH_BP: 1500,
  /**
   * Nền sống rút mặt: thuận 70 · nghỉ 18 · biến động 12. S&P dương 65% số tháng (Crestmont
   * Research, 1950–); correction ≥10% ~1 lần/năm = 1 mỗi 2 ô ⇒ ~30% ô trong chuỗi tăng là
   * nghỉ/biến động chứ không phải thuận.
   */
  MAT_THUAN_BP: 7000,
  MAT_NGHI_BP: 1800,
  MAT_BIEN_DONG_BP: 1200,
  /**
   * Gãy chuỗi TĂNG đi đâu: 38 correction ≥10% vs 14 bear ≥20% từ 1950 (Stacker/Plus500 theo
   * S&P) ⇒ P(cú gãy thành GIẢM) = 14/38 = 37%; còn lại về ngang / biến động.
   */
  GAY_VE_NGANG_BP: 4300,
  GAY_DAO_HUONG_BP: 3700,
  GAY_BIEN_DONG_BP: 2000,
  /** Từ NGANG mở hướng: lên : xuống = 65 : 35 (tỷ lệ tháng dương) ⇒ cửa xuống nhân 0,54. */
  NGANG_MO_GIAM_X_BP: 5400,
} as const;

export type ThamSoTick = { readonly [K in keyof typeof REGIME_TICK]: number } & {
  readonly HAZARD_GIAM_NEN_BP: number;
  readonly HAZARD_GIAM_TUOI_BP: number;
  readonly NGANG_MO_GIAM_X_BP: number;
};
/** Bộ số GỐC dưới dạng đủ trường: hai tham số mới đặt ở giá trị làm map byte-hệt. */
export const REGIME_TICK_GOC: ThamSoTick = {
  ...REGIME_TICK,
  HAZARD_GIAM_NEN_BP: REGIME_TICK.HAZARD_NEN_BP,
  HAZARD_GIAM_TUOI_BP: REGIME_TICK.HAZARD_TUOI_BP,
  NGANG_MO_GIAM_X_BP: 10000,
};
/** MỘT CỬA chọn bộ số máy tick theo cờ `chuKyThucTe` — `sinhMap` là người gọi duy nhất. */
export function thamSoTick(thucTe: boolean): ThamSoTick {
  return thucTe ? REGIME_TICK_THUC_TE : REGIME_TICK_GOC;
}


/**
 * SEED MÀN TẬP của một phiên bản luật — MỘT CỬA cho mọi nơi hỏi (tạo trận ·
 * miễn giờ · ghim lõi shop · cờ `man_tap` của kho hành vi). Hai chỗ hỏi hai
 * kiểu là bàn tập chạy seed này mà miễn giờ theo seed kia (D168).
 */
export function seedManTap(phienBan?: string | null): number {
  const luat = luatCua(phienBan);
  // D433: bánh xe mùa (v54+) sinh dãy ô khác ⇒ seed riêng. D445: seed dạy MÀU BÀN (xem `MAN_TAP_SEED_MAU_BAN`);
  // 77004 thôi được cấp cho trận mới, chỉ còn được NHẬN RA ở `laSeedManTap`.
  // D527: nhịp xen kẽ (v58) — bàn 6 ô, seed riêng.
  if (luat.kyHopBanTap) return HOLDEM_DECISIONS.MAN_TAP_SEED_KY_HOP;   // D545 — bàn tập có kỳ họp ô 3
  if (luat.nhipXenKe) return HOLDEM_DECISIONS.MAN_TAP_SEED_XEN_KE;
  if (luat.banhXe) return HOLDEM_DECISIONS.MAN_TAP_SEED_MAU_BAN;
  // D303: luật CHU KỲ THỰC TẾ (v39+) đổi bộ số sinh map ⇒ seed riêng, cùng kịch bản.
  if (luat.chuKyThucTe) return HOLDEM_DECISIONS.MAN_TAP_SEED_THUC_TE;
  // D300: luật v36 trở lên ⇒ bàn tập 12 ô (có vai + kỳ ngộ). `MAN_TAP_SEED_V36` (8 ô)
  // thôi được cấp cho trận mới, chỉ còn được NHẬN RA ở `laSeedManTap`.
  return luat.regimeTick
    ? HOLDEM_DECISIONS.MAN_TAP_SEED_12 : HOLDEM_DECISIONS.MAN_TAP_SEED;
}

/**
 * Mọi seed từng được dùng làm bàn tập — dùng để NHẬN RA bàn tập ở trận cũ.
 *
 * ⚠ D359 — DANH SÁCH, KHÔNG PHẢI CHUỖI `||`. Dashboard quản trị phải lọc bàn tập bằng SQL
 * (`loaiTranTap` ở `server/admin_thongke.ts`), và một hàm TypeScript không nhúng được vào
 * `WHERE`. Trước D359 chuỗi `||` này là bản cài đặt DUY NHẤT, nên mặt admin không có cách
 * nào hỏi "trận này có phải bàn tập không" mà không gõ lại bốn con số — tức dựng bản thứ
 * hai, và bản thứ hai SẼ trôi khi thêm seed thứ năm (A11.5/D61).
 * Thêm seed bàn tập mới ⇒ thêm ĐÚNG MỘT chỗ: mảng dưới. `tests/ban_tap_mot_nguon.test.ts`
 * canh mảng này khớp mọi hằng `MAN_TAP_SEED*` trong `HOLDEM_DECISIONS`.
 */
export const SEED_MAN_TAP_MOI_THOI: readonly number[] = [
  HOLDEM_DECISIONS.MAN_TAP_SEED,
  HOLDEM_DECISIONS.MAN_TAP_SEED_V36,
  HOLDEM_DECISIONS.MAN_TAP_SEED_12,
  HOLDEM_DECISIONS.MAN_TAP_SEED_THUC_TE,
  HOLDEM_DECISIONS.MAN_TAP_SEED_BANH_XE,
  HOLDEM_DECISIONS.MAN_TAP_SEED_MAU_BAN,
  HOLDEM_DECISIONS.MAN_TAP_SEED_XEN_KE,
  HOLDEM_DECISIONS.MAN_TAP_SEED_KY_HOP,
];

/** D527 — cỡ bàn tập theo luật bàn tập: nhịp xen kẽ 6 ô, khoá cũ 12 ô. MỘT chỗ cho cửa tạo trận. */
export function soOManTap(luat: { nhipXenKe?: boolean }): number {
  return luat.nhipXenKe ? HOLDEM_DECISIONS.MAN_TAP_SO_O_XEN_KE : HOLDEM_DECISIONS.MAN_TAP_SO_O;
}

export function laSeedManTap(seed: number): boolean {
  return SEED_MAN_TAP_MOI_THOI.includes(seed);
}

/**
 * D302 — BÀN TẬP KỂ CHUYỆN CỐ ĐỊNH: đám đông KHÔNG đổi được ô ở bàn tập 12 ô.
 *
 * Đo 07/09 bằng chính `replay()` (bot chơi theo seed; người ngồi im, hoặc mua một
 * mã ở vòng 1): phản thân đổi ô 6 (BIẾN ĐỘNG → GIẢM) và ô ⚖ 9 (TĂNG LÃI → HACK
 * SÀN) ở MỌI kịch bản thử — tức lời Oracle bước `chuyen-v9` ("ngân hàng dập bong
 * bóng") kể một ô không còn tồn tại, mà bài `coach_ban_tap` xanh vì nó đối chiếu
 * `sinhMap` (map tĩnh), không phải trận thật. Bàn tập là kịch bản dắt tay có seed
 * ghim — kể được thì dãy ô phải cố định; cơ chế đám đông người chơi học ở Hướng
 * dẫn §16 và gặp ở trận thật (câu chốt của Oracle nói rõ điều đó).
 *
 * ⚠ CHỈ hai seed 12 ô (D300 · D303 — chưa từng có trận lưu trước đợt ship 07/09).
 * Hai seed bàn tập 8 ô cũ đã có trận lưu; đổi luật của chúng là đổi replay — cửa
 * một chiều (A11.1), không đi.
 */
export function laSeedManTapCoDinh(seed: number): boolean {
  return seed === HOLDEM_DECISIONS.MAN_TAP_SEED_12
    || seed === HOLDEM_DECISIONS.MAN_TAP_SEED_THUC_TE
    // D433 — seed bàn tập dưới bánh xe (v54). v54 đã tắt phản thân ở mọi trận, nhưng bàn tập CỐ ĐỊNH là tính
    // chất của seed chứ không phải của một khoá luật: ghim sang khoá có phản thân thì Oracle vẫn kể đúng bàn.
    || seed === HOLDEM_DECISIONS.MAN_TAP_SEED_BANH_XE
    // D445 — seed dạy màu bàn: cùng tính chất (bàn kể chuyện thì dãy ô phải cố định).
    || seed === HOLDEM_DECISIONS.MAN_TAP_SEED_MAU_BAN;
}

/**
 * ═══ HỒ SƠ SINH MAP THEO CỠ (D177) — MAP 8 THÀNH BÀN "NGẮN & CĂNG" ═══════════
 *
 * Founder chốt đường (A) rồi đặt thêm: *"làm chuỗi tạo seed riêng cho map 8 để
 * user chơi CĂNG THẲNG và phải RA QUYẾT ĐỊNH NHIỀU HƠN"*.
 *
 * Vì sao map 8 không thể là bàn chu kỳ (đo D176): nó chỉ có ~6,2 ô PHA, chuỗi
 * trung bình 1,4 ô ⇒ 0,77 chuỗi ≥2 ô mỗi trận — phần lớn trận KHÔNG có nổi một
 * xu hướng đọc được, và quan hệ đó gần TUYẾN TÍNH theo số ô pha nên không tham
 * số nào vượt qua. Thay vì ép nó kể chu kỳ, cho nó chơi ĐÚNG SỞ TRƯỜNG: mật độ
 * TIN cao nhất ba cỡ map.
 *
 * "Căng thẳng + nhiều quyết định" dịch thành ba cần gạt, mỗi cái một lý do:
 *   · TY_LE_SU_KIEN — nhiều TIN hơn: mỗi ô tin là một lần phải đọc lại và
 *     quyết (giữ hay xoay), khác hẳn ô pha êm;
 *   · NGHI_X — ít ô ĐI NGANG hơn: ô nghỉ là ô không có gì để quyết;
 *   · HAZARD_X — chuỗi gãy nhanh hơn: đảo chiều nhiều ⇒ vị thế cũ hết đúng
 *     sớm hơn, phải xoay.
 *
 * ⚠ CÁI GIÁ PHẢI NÓI: map 8 THÔI là mẫu đối chứng trung tính (D85/D86 — cỡ map
 * duy nhất không vai/không kỳ ngộ/không kịch bản hồi, dùng để so hai phiên bản
 * "byte-hệt"). Vai trò đó thực ra đã mất từ lúc v36 đổi máy sinh; hồ sơ này
 * chốt hẳn điều đó. Ai cần một mẫu đối chứng mới thì phải dựng riêng, đừng
 * mượn map 8 nữa.
 *
 * ⚠ Chỉ sống sau cổng `regimeTick` (v36+) — map 8 của v35 và trước replay
 * nguyên. MỌI SỐ MC-TUNE (A8.2).
 */
export const HO_SO_MAP: Readonly<Record<number, {
  TY_LE_SU_KIEN_BP: number; NGHI_X_BP: number; HAZARD_X_BP: number;
}>> = {
  8: { TY_LE_SU_KIEN_BP: 5600, NGHI_X_BP: 4000, HAZARD_X_BP: 17000 },
};

/**
 * ═══ LỚP DATA: MỖI (CỠ MAP × VAI) LÀ MỘT LOẠI QUAN SÁT KHÁC NHAU (D178) ══════
 *
 * Founder 30/08: *"chú ý luôn phần thu data theo mỗi map và role (VD map 8 thì áp
 * lực thời gian, role cá mập thì có vốn nhiều) cho 1 loại data khác nhau. Phân
 * loại rõ vào"*.
 *
 * ⚠⚠ ĐÂY LÀ LUẬT ĐỌC, KHÔNG PHẢI SIÊU DỮ LIỆU TRANG TRÍ. Cùng một hành vi
 * ("dồn 80% vốn vào BTC") mang nghĩa KHÁC HẲN nhau tuỳ lớp:
 *   · map 8 (áp lực) — quyết nhanh dưới sức ép, ít thời gian đọc ⇒ đó là bằng
 *     chứng về CÁCH QUYẾT KHI GẤP, không phải về khẩu vị rủi ro "bình tĩnh";
 *   · vai cá mập — ghế đó có VỐN GẤP BA và bị GHIM lõi Đòn Bẩy (D107/D108), tức
 *     hoàn cảnh ép nó phơi nhiễm; đọc con số phơi nhiễm ấy thành "người này ưa
 *     rủi ro" là đọc HOÀN CẢNH thành TÍNH CÁCH.
 * Ranh giới này nối thẳng §1.2 (đo, KHÔNG thưởng/phạt khẩu vị) và A10 (mô tả,
 * không kê đơn): thẻ tính cách nói về NGƯỜI, nên nó chỉ được ăn những lớp mà
 * hoàn cảnh không tự tay tạo ra con số đó.
 *
 * ⚠ `hop_le_cho` / `khong_do_duoc` là DANH SÁCH TRỤC, không phải lời khuyên —
 * người đọc gộp tự quyết dùng lớp nào (đúng nếp "cờ chất lượng là NHÃN, không
 * phải bộ lọc xoá", 0043/D62).
 */
export type TrucDo = 'quyet_khi_gap' | 'doc_tin' | 'doc_chu_ky' | 'khau_vi_tu_do'
  | 'ky_luat_von' | 'phan_ung_dan_dat';

export interface LopData {
  /** Nhãn ngắn cho admin/xuất data đọc. */
  ten: string;
  /** Áp lực CHÍNH mà hoàn cảnh này đặt lên người chơi. */
  ap_luc: string;
  /** Trục mà quan sát ở lớp này LÀ bằng chứng hợp lệ. */
  hop_le_cho: readonly TrucDo[];
  /** Trục mà lớp này KHÔNG đo được — hoàn cảnh đã tự tay tạo ra con số. */
  khong_do_duoc: readonly TrucDo[];
}

/** Lớp theo CỠ MAP (áp lực của khung thời gian + mật độ quyết định). */
export const LOP_THEO_CO_MAP: Readonly<Record<number, LopData>> = {
  8: {
    ten: 'ngắn & căng',
    ap_luc: 'áp lực thời gian + mật độ tin cao nhất (42% ô phải quyết, 2,39 tin/trận)',
    hop_le_cho: ['quyet_khi_gap', 'doc_tin'],
    // 6,2 ô pha ⇒ 0,77 chuỗi ≥2 ô/trận (D176): phần lớn trận KHÔNG CÓ chu kỳ để
    // đọc, nên "không đọc được chu kỳ" ở đây là thiếu ĐỀ BÀI, không phải thiếu kỹ năng.
    khong_do_duoc: ['doc_chu_ky'],
  },
  12: {
    ten: 'cân bằng',
    ap_luc: 'vừa đủ chu kỳ vừa đủ tin',
    hop_le_cho: ['doc_tin', 'doc_chu_ky', 'khau_vi_tu_do', 'ky_luat_von'],
    khong_do_duoc: [],
  },
  16: {
    ten: 'dài & chu kỳ',
    ap_luc: 'chu kỳ đủ dài để đọc (1,60 chuỗi ≥2 ô/trận), nhịp thong thả',
    hop_le_cho: ['doc_chu_ky', 'ky_luat_von', 'khau_vi_tu_do'],
    // Nhịp thong thả ⇒ không ép ai phải quyết vội; đo "quyết khi gấp" ở đây là
    // đo một sức ép không tồn tại.
    khong_do_duoc: ['quyet_khi_gap'],
  },
};

/** Lớp theo VAI (hoàn cảnh vốn + lõi bị ghim). Vắng vai ⇒ `null` (xem `lopData`). */
export const LOP_THEO_VAI: Readonly<Record<string, LopData>> = {
  ca_nhan: {
    ten: 'cá nhân',
    ap_luc: 'vốn ×1, KHÔNG ghim lõi — hoàn cảnh tự do nhất',
    hop_le_cho: ['khau_vi_tu_do', 'ky_luat_von', 'doc_tin', 'doc_chu_ky'],
    khong_do_duoc: [],
  },
  doi_lai: {
    ten: 'đội lái',
    ap_luc: 'vốn ×3, GHIM lõi Lướt Sóng, tác động giá ×1,5, có thể bị SIẾT',
    hop_le_cho: ['doc_tin', 'phan_ung_dan_dat'],
    // Lõi bị ghim ⇒ một phần danh mục do LUẬT chọn, không do người chọn.
    khong_do_duoc: ['khau_vi_tu_do'],
  },
  ca_map: {
    ten: 'cá mập',
    ap_luc: 'vốn ×3, GHIM lõi Đòn Bẩy, tác động giá ×2 — hoàn cảnh ÉP phơi nhiễm',
    hop_le_cho: ['ky_luat_von', 'phan_ung_dan_dat'],
    // ⚠ Vốn lớn + đòn bẩy ghim: con số phơi nhiễm ở đây là của HOÀN CẢNH.
    khong_do_duoc: ['khau_vi_tu_do'],
  },
  to_chuc: {
    ten: 'tổ chức',
    ap_luc: 'vốn ×2, GHIM Đa Dạng Hoá, MANDATE ≤40%/mã và cấm khống',
    hop_le_cho: ['doc_chu_ky', 'phan_ung_dan_dat'],
    // Mandate CẤM tập trung ⇒ "đa dạng" là luật, không phải lựa chọn.
    khong_do_duoc: ['khau_vi_tu_do', 'ky_luat_von'],
  },
};

/**
 * LỚP DATA của một quan sát. `vai` vắng = trận không có vai (map 8, hoặc trận cũ).
 * Trục hợp lệ = GIAO của hai lớp, TRỪ mọi trục bị một trong hai lớp cấm.
 *
 * ⚠ VẾ TRỪ HIỆN LÀ HÀNG RÀO, KHÔNG PHẢI LOGIC SỐNG — nói thẳng để người sau
 * không hiểu nhầm theo cả hai hướng: với bảng hôm nay nó KHÔNG BAO GIỜ cắt
 * thêm gì (phép GIAO đã loại sẵn, vì bài test cấm một lớp vừa CHO vừa CẤM cùng
 * một trục). Phát hiện bằng tiêm lỗi: gỡ vế trừ ⇒ 0 bài đỏ. Giữ lại vì nó là
 * chốt chặn cho ngày ai đó thêm một lớp mới phá bất biến ấy — nhưng đừng viết
 * test giả vờ rằng nó đang chạy (bẫy D93).
 */
export function lopData(soO: number | null, vai: string | null): {
  ma: string; ten: string; ap_luc: readonly string[];
  hop_le_cho: readonly TrucDo[]; khong_do_duoc: readonly TrucDo[];
} {
  const lm = soO !== null ? LOP_THEO_CO_MAP[soO] : undefined;
  const lv = vai !== null ? LOP_THEO_VAI[vai] : undefined;
  const cam = new Set<TrucDo>([
    ...(lm?.khong_do_duoc ?? []), ...(lv?.khong_do_duoc ?? []),
  ]);
  const hopLe = (lv
    ? (lm ? lm.hop_le_cho.filter((t) => lv.hop_le_cho.includes(t)) : lv.hop_le_cho)
    : (lm?.hop_le_cho ?? [])).filter((t) => !cam.has(t));
  return {
    ma: `${soO ?? '?'}:${vai ?? 'khong_vai'}`,
    ten: [lm?.ten, lv?.ten].filter(Boolean).join(' · ') || 'chưa phân loại',
    ap_luc: [lm?.ap_luc, lv?.ap_luc].filter(Boolean) as string[],
    hop_le_cho: hopLe,
    khong_do_duoc: [...cam],
  };
}

/** Hồ sơ của cỡ map — cỡ không khai ⇒ trung tính (mọi hệ số = 10000). */
export function hoSoMap(size: number, bat: boolean): {
  tyLeSuKienBp: number; nghiXBp: number; hazardXBp: number;
} {
  const h = bat ? HO_SO_MAP[size] : undefined;
  return {
    tyLeSuKienBp: h?.TY_LE_SU_KIEN_BP ?? NHA_CAI.TY_LE_O_SU_KIEN_BP,
    nghiXBp: h?.NGHI_X_BP ?? 10000,
    hazardXBp: h?.HAZARD_X_BP ?? 10000,
  };
}

/**
 * ═══ ÁP LỰC BÀN (D181) — HÀNH VI GỘP THÀNH BIẾN LIÊN TỤC CÓ TRÍ NHỚ ══════════
 *
 * Addendum §3/§4/§11 đòi hành vi gộp của người chơi ĐỔI XÁC SUẤT regime. Hai
 * máy hiện có (phản thân D4 · bẻ-chuỗi-vốn D160) đã làm điều đó, nhưng ở dạng
 * CÔNG TẮC: qua ngưỡng ⇒ xác suất cố định, dưới ngưỡng ⇒ không gì cả. Ba chỗ
 * hụt so với addendum:
 *   · không có TRÍ NHỚ — bàn dồn 5 vòng liền và bàn vừa dồn 2 vòng thì như nhau;
 *   · không có ĐỘ LỚN — dồn 61% và dồn 95% cũng thế;
 *   · một cú duy nhất — "đổi xác suất" thành "thay đúng một ô".
 *
 * Áp lực bàn vá cả ba: mỗi vòng bàn NẠP theo mức dồn vượt ngưỡng (đo bằng cả
 * GHẾ lẫn VỐN — hai máy cũ mỗi máy đọc một thước, nay cộng lại), áp lực MÒN
 * mỗi vòng, và nó cộng vào xác suất của CẢ HAI máy thay ô.
 *
 * ⚠ TRẦN LÀ BẤT KHẢ THƯƠNG LƯỢNG (§3 addendum): áp lực cao đến mấy cũng chỉ
 * nghiêng, không bao giờ ép — `XS_TRAN_BP` chặn ở 70%, còn 30% cho chợ cãi lại
 * đám đông. Bỏ trần là biến "thị trường phản ứng" thành "đám đông điều khiển".
 * MỌI SỐ MC-TUNE (A8.2).
 */
export const AP_LUC_BAN = {
  /** Nạp mỗi vòng: (tỷ lệ dồn − ngưỡng) × hệ số này. bp. MC-TUNE. */
  NAP_X_BP: 8000,
  /** Áp lực còn lại sau mỗi vòng (mòn dần — trí nhớ ngắn). bp. MC-TUNE. */
  MON_BP: 6500,
  /** Trần tích luỹ. bp. */
  TRAN_BP: 10000,
  /**
   * ⭐ SÀN — xác suất GỐC bị nhân hệ số này khi cờ bật. bp.
   *
   * ⚠⚠ VẾ NÀY LÀ THỨ BIẾN R6 THÀNH "PHÂN PHỐI LẠI" THAY VÌ "VẶN TO HƠN". Không
   * có nó thì mọi bàn qua ngưỡng đều ăn xác suất cũ CỘNG thêm phần thưởng ⇒ trò
   * chỉ khắc nghiệt hơn đều, mà "liên tục" thì vẫn không có (bàn chớm 61% và bàn
   * dồn 95% cùng được cộng, chỉ khác độ lớn phần cộng). Với sàn 0,5: bàn vừa chớm
   * ngưỡng nổ ÍT HƠN v36, bàn dồn lì nhiều vòng mới nổ nhiều hơn — đúng câu
   * addendum §4 "hành vi gộp ĐỔI XÁC SUẤT", không phải "hành vi gộp bị phạt nặng".
   */
  SAN_X_BP: 5000,
  /** Áp lực cộng bao nhiêu vào xác suất thay ô: áp lực × hệ số. bp. MC-TUNE. */
  VAO_XS_BP: 2600,
  /** ⚠ TRẦN xác suất thay ô sau khi cộng — chợ luôn còn cửa cãi lại (§3). */
  XS_TRAN_BP: 7000,
} as const;

/** Hệ số bp của cạnh (tu→den) trong môi trường `mt` — 10000 nếu không khai. */
export function heSoKeTiepMoiTruong(
  tu: SuKienId, den: SuKienId, mt: 're' | 'trung_tinh' | 'dat',
): number {
  const luat = KE_TIEP_THEO_MOI_TRUONG.find(
    (r) => r.tu === tu && r.den === den && r.moi_truong === mt);
  return luat ? luat.nhan_bp : 10000;
}

/**
 * HỆ QUẢ NHIỀU VÒNG của BONG BÓNG — chỗ duy nhất một ô ép được NHIỀU ô sau.
 *
 * Founder: "thẻ bong bóng sẽ có xác suất tạo ra ít nhất 2 thẻ uptrend liên tiếp
 * hoặc ngược lại là sập ngay và tạo ra thẻ downtrend".
 *
 * Đây là thứ làm bong bóng đáng sợ theo đúng nghĩa thật: nó KHÔNG nói cho bạn
 * biết mình đang ở nhánh nào. Vào sớm mà trúng nhánh phồng thì ăn hai vòng
 * xanh; trúng nhánh vỡ thì đỏ ngay lập tức. Cùng một lá bài, hai số phận —
 * và đó chính là khẩu vị rủi ro mà app muốn ĐO (A1).
 */
export const BONG_BONG = {
  /** Xác suất nhánh PHỒNG (còn lại là vỡ ngay). bp. */
  XAC_SUAT_PHONG_BP: 5500,
  /** Nhánh phồng: chuỗi giai đoạn bị ép. */
  CHUOI_PHONG: ['tang', 'tang'] as const,
  /** Nhánh vỡ: sập thẳng, không có đường lui. */
  CHUOI_VO: ['giam', 'giam'] as const,
} as const;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * v27 — BONG BÓNG THÀNH MỘT CHUỖI GÃY ĐƯỢC (founder 04/08)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Founder: *"cơ chế thẻ hiện tại tác động chưa rõ ràng lắm, có thể khiến người
 * chơi chơi mãi mà không cảm thấy mình tiến bộ"*, và tả đúng thứ muốn thấy:
 * *"sau sự kiện hạ lãi suất sẽ có xác suất sinh ra thẻ bong bóng, từ thẻ bong
 * bóng có xác suất sinh ra các thẻ uptrend sau đó cao hơn nhưng chỉ cần 1 thẻ
 * uptrend gãy thì sẽ thành sập sàn và bắt đầu rơi vào downtrend"*.
 *
 * ─── VÌ SAO BẢN CŨ MỜ, dù cơ chế CÓ chạy ────────────────────────────────────
 * `BONG_BONG` quyết định TẤT CẢ ngay tại ô bong bóng: tung một đồng xu 55/45 rồi
 * ép cứng hai ô — `[tăng, tăng]` hoặc `[giảm, giảm]`. Người chơi thấy bong bóng,
 * rồi thấy hai ô đã định đoạt từ trước mà họ không tham gia gì vào.
 * ⇒ Không có KHOẢNH KHẮC NÀO để đọc, nên không có gì để giỏi lên. Đúng cái
 * founder gọi là "chơi mãi mà không thấy mình tiến bộ": chuỗi có tồn tại, nhưng
 * nó xảy ra SAU LƯNG người chơi.
 *
 * ─── BẢN MỚI: MỘT TRẠNG THÁI SỐNG, ĐỌC ĐƯỢC TỪNG Ô ─────────────────────────
 *   bong bóng THẬT  →  vào CHẾ ĐỘ BONG BÓNG
 *   mỗi ô sau đó    →  nghiêng MẠNH về `tăng` (nhưng KHÔNG ép)
 *   rút ra `tăng`   →  bong bóng phồng thêm một nấc, và nấc sau khó hơn nấc trước
 *   rút ra thứ khác →  GÃY: sập ngay, rồi downtrend DÀI THEO ĐỘ CAO đã leo
 *
 * ⭐ Ba tính chất, và cả ba đều là thứ người chơi CẢM được:
 *  1. Mỗi ô là một khoảnh khắc thật — vào hay ra, và câu trả lời đổi theo số ô
 *     đã leo. Bản cũ không có khoảnh khắc nào.
 *  2. Càng leo cao càng dễ gãy (`NGHIENG_GIAM_MOI_O`) — bong bóng tự ăn mình,
 *     đúng đời, và nó chặn luôn chuỗi tăng vô tận.
 *  3. Leo càng lâu thì rơi càng sâu — "thắng đậm thua đau" (founder 01/08),
 *     và nó làm cú gãy thành một SỰ KIỆN đáng nhớ chứ không phải một ô giảm.
 *
 * ⚠ GIỮ TRONG TẦNG GIAI ĐOẠN, KHÔNG ĐẺ THẺ SỰ KIỆN MỚI. Ngân sách mặt đuôi
 * (`P_TAIL`, `DUOI_5MAT`) được cân riêng ở D43 bước 7; nhét thêm một cú "sập
 * sàn" vào bể sự kiện là phá bảng đó mà không ai thấy ngay.
 *
 * ⭐ Số agent đặt, CHỜ ĐO (A8.2) — tiền lệ `QUAN_TINH` của D43.
 */
export const BONG_BONG_V27 = {
  /** Trọng số CỘNG cho `tang` ở mỗi ô trong chế độ bong bóng. */
  NGHIENG_TANG_BP: 18000,
  /**
   * Mỗi ô đã phồng thì trừ bớt phần nghiêng ấy — leo càng cao càng khó leo tiếp.
   * Không có nó thì bong bóng có thể chạy tới hết map.
   */
  NGHIENG_GIAM_MOI_O: 2500,
  /** Trần tuyệt đối: phồng quá số này thì tự gãy ở ô kế. */
  DAI_TOI_DA: 5,
  /** Gãy thì rơi ít nhất bấy nhiêu ô. */
  VO_TOI_THIEU_O: 2,
  /** …cộng thêm một ô cho mỗi ô đã phồng (leo cao rơi sâu). */
  VO_THEO_DAI_O: 1,
  /** …nhưng không quá bấy nhiêu — trận còn phải chơi tiếp. */
  VO_TOI_DA_O: 4,
} as const;

/**
 * Bong bóng dưới chu kỳ thực tế (D301). Greenwood–Shleifer–You, "Bubbles for Fama" (JFE
 * 2019; NBER WP 23191): 40 đợt một ngành tăng ≥100% trong 2 năm (1928–2014), **21 sập
 * ≥40% trong 2 năm kế = 53%**; tăng 50% chỉ 20% sập. Quy đổi: cửa sổ 2 năm = 4 ô ⇒
 * P(phồng tiếp)/ô = (1 − 0,53)^(1/4) ≈ 0,83 ⇒ trọng số 'tang' ≈ 5× phần còn lại
 * (nền ~6.000) ⇒ nghiêng ≈ 27.500; không mòn theo tuổi trong cửa sổ; trần 4 ô.
 * ⚠ v28 vẫn nhân theo môi trường tiền (rẻ ×1 · trung tính ×0,6 · đắt ×0,35) — 53% là
 * mức KHÔNG điều kiện của GSY; trong game nó ứng với tiền RẺ, tiền đắt vỡ sớm hơn.
 */
export const BONG_BONG_THUC_TE = {
  ...BONG_BONG_V27,
  /** Cửa sổ GSY = 2 năm = 4 ô phồng tối đa sau đợt tăng ép. */
  DAI_TOI_DA: 4,
} as const;
/**
 * P(PHỒNG TIẾP)/ô trong chế độ bong bóng, ĐẶT TƯỜNG MINH theo môi trường tiền (D301).
 * Đo lần 2 (3.000 map/cỡ): để trọng số cộng dồn (nghiêng + sức căng cộng vào 'giam' +
 * bản sắc + telegraph) quyết định thì bong bóng thật vỡ 82–100% trong cửa sổ 2 năm,
 * trong khi GSY đo 53%. Nên `sinhMap` đặt lại trọng số 'tang' sao cho tỷ phần đúng p —
 * cùng máy rút, cùng RNG, các mặt còn lại giữ tỷ lệ tương đối.
 *   · rẻ: (1 − 0,53)^(1/4) = 0,83 — số GSY (bong bóng thật ngoài đời phần lớn nở dưới tiền
 *     rẻ: sau hạ lãi thật, trọng số bong bóng ×2,2 — `LAI_SUAT_NEN.NHAN_THAP_BP`).
 *   · trung tính 0,75 · đắt 0,65 — SUY GIẢM CÓ HƯỚNG, không có số riêng (PLAYTEST-TUNE);
 *     hướng có nguồn: 8/11 chu kỳ siết của Fed kết thúc bằng suy thoái (Blinder 2023).
 */
export const BONG_BONG_PHONG_TIEP_BP: Record<MoiTruongTienTe, number> = {
  re: 8300, trung_tinh: 7500, dat: 6500,
};
export type ThamSoBongBong = { readonly [K in keyof typeof BONG_BONG_V27]: number };
/** MỘT CỬA chọn bộ số bong bóng theo cờ `chuKyThucTe` — `sinhMap` là người gọi duy nhất. */
export function thamSoBongBong(thucTe: boolean): ThamSoBongBong {
  return thucTe ? BONG_BONG_THUC_TE : BONG_BONG_V27;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * v28 — TIN CÓ GỐC, TIN GIẢ CÓ HẬU QUẢ (founder 08/08, một cổng `mapV28`)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Bốn chỉ đạo trong một tin nhắn, và cả bốn là MỘT ý: thẻ không được rơi từ
 * trời — nó phải có gốc trong trạng thái, và nói dối phải trả giá.
 *
 * 1. *"sẽ có sự kiện xác suất tin giả cao và sự kiện xác suất tin giả thấp"*
 *    → `NHAN_TIN_GIA_SU_KIEN`: nhân (bp) trên tỷ lệ bối cảnh. Kiến thức THẬT
 *    (A1): tin chính sách có họp báo nên khó dựng; đồn sập sàn (FUD) dựng rẻ
 *    nhất thị trường. Loại sự kiện là thông tin CÔNG KHAI ngay trên lá nên đây
 *    là luật người chơi HỌC ĐƯỢC — tự điển (!) phải kể.
 * 2. *"bong bóng phải có GỐC: không tiền-rẻ ⇒ thiên về GIẢ/gãy sớm"*
 *    → `NHAN_TIN_GIA_BONG_BONG` theo môi trường tiền tệ lúc rút (vế GIẢ) +
 *    `NGHIENG_BB_THEO_MOI_TRUONG` co độ nghiêng leo (vế GÃY SỚM). Tiền rẻ thì
 *    bong bóng là thật và leo được; không tiền rẻ thì phần lớn là hơi nước.
 * 3. *"tin giả lộ ra phải kéo xác suất SẬP SÀN lên cực cao"* →
 *    `SAP_SAN_SAU_TIN_GIA_X_BP`: sự kiện KẾ TIẾP sau một tin giả đã lộ nghiêng
 *    áp đảo về `hack_san` (nhãn mới: Sập sàn) — tin giả thôi là nhiễu vô hại,
 *    nó thành mồi lửa. Tần suất tin giả GIỮ NGUYÊN (D58: nó là cần gạt G2).
 *    ⚠ VÌ SAO ĐỌC `la_tin_gia` Ở ĐÂY KHÔNG PHẠM LUẬT D39 ("không đọc cờ giả"):
 *    luật đó chặn RÒ RỈ thứ CHƯA LỘ. Hai sự kiện không bao giờ liền nhau nên
 *    sự kiện gần nhất luôn cách ô đang rút ≥ 2 ô — thật/giả của nó ĐÃ CÔNG KHAI
 *    với người chơi từ lúc ô kế nó lật. Máy chỉ phản ứng với tin ĐÃ LỘ, và
 *    người chơi dùng được đúng luật này để né trước — đó là kỹ năng, không
 *    phải máy dò.
 * 4. *"recovery = cầu downtrend→uptrend"* → `PHUC_HOI_CAU`: pha ngay sau
 *    Phục hồi nghiêng về `tang`, nén `giam` — phục hồi thôi là một chớp xanh
 *    giữa hai màu đỏ. KHÔNG khoá hẳn `giam`: đáy hai lần (double-dip) có thật,
 *    khoá là ngưỡng thành công tắc đọc được 100%.
 *
 * ⭐ Số agent đặt, CHỜ ĐO G1–G4 (A8.2) — tiền lệ `QUAN_TINH`/`LAI_SUAT_NEN`.
 * Trung bình nhân tin giả qua 7 mặt đang mở ≈ 1,0 CÓ CHỦ Ý: D58 đo tin giả là
 * cần gạt của G2 (÷2 là gradient chết 0,63→0,26) nên chỉ PHÂN PHỐI LẠI theo
 * loại, không đổi tổng lượng nhiễu.
 */
export const MAP_V28 = {
  /** Nhân (bp) tỷ lệ tin giả theo LOẠI sự kiện. Vắng ⇒ 10000 (giữ nguyên). */
  NHAN_TIN_GIA_SU_KIEN: {
    ha_lai_suat: 4000, tang_lai_suat: 4000, lam_phat: 6000,
    hack_san: 16000, thien_nga_den: 12000, chien_tranh: 12000,
  } as Record<string, number>,
  /** Bong bóng đi theo MÔI TRƯỜNG TIỀN TỆ, không theo bảng trên. */
  NHAN_TIN_GIA_BONG_BONG:
    { re: 5000, trung_tinh: 14000, dat: 20000 } as Record<MoiTruongTienTe, number>,
  /** Kẹp tỷ lệ cuối — không tin nào chắc thật hay chắc giả (calibration sống). */
  TIN_GIA_SAN_BP: 500,
  /*
   * ⚠ TRẦN NÀY LÀ ỨNG VIÊN GỐC CỦA G4 (mở cần gạt 11/08 để dò).
   *
   * Bot hoài-nghi tin theo hệ số `1 − 2p`. Khi `p > 50%` hệ số ÂM, tức nó
   * không còn "chiết khấu" mà ĐẢO CHIỀU — đặt ngược hẳn lại tin. Ở trần 8000
   * (80%) hệ số xuống −0,6: một cú cược mạnh vào chiều ngược, và nó SAI 20%
   * số lần. Trên map dài, những lần sai đó tích lại — khớp đúng triệu chứng
   * G4 ở map 12/16, nơi hoài-nghi thua CẢ tin-mọi-tin LẪN phớt-tin (tức
   * nghi ngờ đang có hại chứ không phải vô ích).
   */
  TIN_GIA_TRAN_BP: doThamSo('TIN_GIA_TRAN_BP', 8000),
  /** Sự kiện kế sau tin giả đã lộ: trọng số `hack_san` ×15 ⇒ ~⅔ số lần rút. */
  SAP_SAN_SAU_TIN_GIA_X_BP: 150000,
  /** Gãy sớm khi leo không có gốc: nhân độ nghiêng leo của chế độ bong bóng. */
  NGHIENG_BB_THEO_MOI_TRUONG:
    { re: 10000, trung_tinh: 6000, dat: 3500 } as Record<MoiTruongTienTe, number>,
  /** Cầu phục hồi: cộng cho `tang`, nén `giam` (bp nhân) ở pha NGAY SAU. */
  PHUC_HOI_CAU: { THEM_TANG_BP: 6000, GIAM_CON_BP: 2500 },
} as const;

/**
 * D43 BƯỚC 2 — Ô LỊCH CHÍNH SÁCH + HÀM PHẢN ỨNG NỘI SINH (03-chu-ky-tin-dung §2).
 *
 * Lãi suất ngoài đời không rơi từ trời: ngân hàng TW họp THEO LỊCH và phản ứng
 * với những gì đã xảy ra. Ai theo dõi lạm phát thì biết trước hướng; ai phớt lờ
 * thì bị bất ngờ — đây là khoảnh khắc dạy học mạnh nhất game (nhiên liệu G2/G4).
 *
 * TOÀN BỘ khối này CÔNG KHAI với người chơi (bách khoa): giấu luật là hỏng cả
 * đếm bài lẫn cột calibration (bất biến 8.2). Chỉ realization bị giấu.
 *
 * Nguồn gốc từng số:
 * · O_THEO_MAP — founder chốt 01/08 (Q1: ô 4; map 12/16 theo đề xuất v2).
 *   Số học ô 4: hạ lãi ô 4 → sức căng dồn 5–6 → chuỗi tăng 6–7 → nổ 7–8, vừa
 *   khít map 8. Luật cứng: không ô 1 (chưa có gì để đọc), không ô cuối (quyết
 *   định không giao dịch được = hên xui thuần).
 * · TY_LE_SAI_LAM_BP = 1500 — bản v2 founder dán ("~15% sai lầm chính sách").
 *   Không tín hiệu nào được tin cậy 100%: tín hiệu chắc chắn = đọc miễn phí =
 *   cột calibration chết.
 * · ⭐ CUA_SO_O = 4, NGUONG_LAM_PHAT_O = 1, HA_NGOAI_LICH_BP = 2000 — agent đặt
 *   chờ Monte Carlo (A8.2): cửa sổ ≈ khoảng cách hai kỳ họp; ngưỡng 1 vì luật
 *   cấm hai sự kiện liền nhau khiến cửa sổ 4 ô chứa tối đa 2 sự kiện — ngưỡng 2
 *   là gần như không bao giờ tăng lãi (hướng thoái hoá, gate 7.6 sẽ đỏ).
 */
export type HuongChinhSach = 'tang' | 'ha' | 'giu';

export const LICH_CHINH_SACH = {
  /** Ô lịch theo cỡ map (1-indexed). Cỡ lạ → không có lịch. */
  // D550 — 14: [4, 9] (bàn 14 ô, khoá v63): kỳ họp hai lần, lần sau còn năm ô để thấy chu kỳ sau nó (founder 07/10).
  O_THEO_MAP: { 8: [4], 12: [4, 9], 14: [4, 9], 16: [4, 8, 12] } as Record<number, readonly number[]>,
  /**
   * D545 (founder 06/10: bàn tập không có thẻ kỳ họp — *"Màn hướng dẫn cũng chưa có chỗ cho thẻ sự kiện ngân hàng hạ/tăng lãi suất"*) — BÀN TẬP 6 ô
   * (nhịp xen kẽ, D526) rơi vào "cỡ lạ ⇒ không lịch" nên mất hẳn kỳ họp. Cờ `kyHopBanTap` (v62) thêm lịch cho cỡ 6: ô 3 — lá lật thứ hai, đủ
   * sớm để người mới gặp và đủ muộn để hàm phản ứng có ô trước mà đọc.
   */
  O_BAN_TAP: { 6: [3] } as Record<number, readonly number[]>,
  /** Cửa sổ nhìn lại của hàm phản ứng (số ô). */
  CUA_SO_O: 4,
  /** ≥ N ô lạm phát/chiến tranh THẬT trong cửa sổ → Tăng lãi suất. */
  NGUONG_LAM_PHAT_O: 1,
  /** Xác suất "sai lầm chính sách" — hướng thực lệch khỏi hàm phản ứng. */
  TY_LE_SAI_LAM_BP: 1500,
  /** Trọng số lãi suất NGOÀI lịch ×0,2 — "hạ rất thấp" (v2 §4.3). */
  HA_NGOAI_LICH_BP: 2000,
} as const;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LÃI SUẤT NỀN — MỘT CON SỐ CÔNG KHAI, CHẠY SUỐT TRẬN (founder 04/08)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Founder: *"cho nó tác động rõ ràng hơn tới xác suất thẻ sự kiện và thanh
 * khoản"*, và trước đó: *"nhìn lãi suất nền có thể giúp đoán phần nào các thẻ
 * sau đó… nếu vượt hoặc giảm tới ngưỡng cố định sẽ xảy ra các sự kiện của môi
 * trường đó"*.
 *
 * ─── CÁI ĐÃ CÓ VÀ CÁI CÒN THIẾU ────────────────────────────────────────────
 * Trước bản này, lãi suất chỉ tồn tại dưới dạng **HƯỚNG** tại mỗi kỳ họp
 * (`huongChinhSachKyVong` — tăng/giữ/hạ) và dưới dạng **THẺ** rời rạc. Không có
 * MỨC nào cả: hạ ba kỳ liên tiếp và tăng ba kỳ liên tiếp cho ra cùng một thị
 * trường, vì không gì nhớ được là ta đang ở đâu.
 * ⇒ Bản này thêm đúng cái đang thiếu: một biến trạng thái TÍCH LUỸ, công khai,
 * và nó là cầu nối giữa "dư âm sự kiện" và "thẻ sắp tới".
 *
 * ⚠ ĐƠN VỊ LÀ **ĐIỂM**, KHÔNG PHẢI `bp`. Trong repo này `_bp` luôn có nghĩa
 * "phần vạn của một HỆ SỐ" (`applyBpInt`), còn đây là một MỨC LÃI SUẤT. Đặt tên
 * `_bp` là mời người sau nhân nó vào một hệ số nào đó và không ai thấy.
 *     1 điểm = 0,01%   →   400 điểm = 4,00%/năm
 *
 * ⚠ TOÀN SỐ NGUYÊN (C5 tinh thần): cộng/trừ điểm, so ngưỡng bằng `>=`/`<=`.
 * Không có phép chia nào trong đường quyết định.
 *
 * ─── VÌ SAO CÔNG KHAI, TRONG KHI SỨC CĂNG THÌ ẨN ───────────────────────────
 * Hai vật khác nhau, và sự khác nhau đó là cả thiết kế:
 *   · SỨC CĂNG là **per-mã**, đo mức bong bóng đã tích trong từng tài sản —
 *     giấu đi thì "đọc bàn" mới là kỹ năng (D43 bước 5).
 *   · LÃI SUẤT NỀN là **một số vĩ mô của cả bàn**, và ngoài đời nó là thứ CÔNG
 *     KHAI NHẤT trên thị trường. Giấu nó đi là bịa ra một thế giới không có
 *     bản tin nào — và mất luôn khoảnh khắc dạy học mà D43 gọi là chính.
 * Qua phép thử D67: nó **không thêm một nước đi nào** (vẫn VÀO · RA · ĐỨNG
 * NGOÀI), nó chỉ đổi THÔNG TIN của ba nước cũ. Đúng loại đáng làm.
 *
 * ⭐ CÁC SỐ DƯỚI ĐÂY LÀ SỐ AGENT ĐẶT, CHỜ MONTE CARLO (A8.2) — đúng tiền lệ
 * `QUAN_TINH.TU_LAP_BP` của D43. Thước là G1–G4 + envelope; chưa đo xong thì
 * chưa được coi là đã cân.
 */
export const LAI_SUAT_NEN = {
  /** Mức khởi điểm mỗi trận — 4,00%, giữa hai ngưỡng, không thiên vị phía nào. */
  KHOI_DIEM: 400,
  /** Kẹp cứng. Ngoài dải này thì các ngưỡng mất nghĩa. */
  SAN: 0,
  TRAN: 1200,

  /**
   * Bước nhảy tại KỲ HỌP. To có chủ ý: một kỳ họp phải ĐỔI ĐƯỢC môi trường,
   * không phải nhích một hạt. Hai kỳ họp cùng hướng là chạm ngưỡng.
   */
  BUOC_KY_HOP: 75,
  /**
   * Bước của lá lãi suất NGOÀI lịch (đã bị hạ trọng số ×0,2 ở `LICH_CHINH_SACH`).
   * Nhỏ hơn kỳ họp: chính sách thật nằm ở kỳ họp, tin ngoài lịch chỉ là tin.
   * ⚠ CHỈ tin THẬT mới dịch được mức — tin giả dịch được mức thì người chơi có
   * một máy dò tin giả miễn phí, và gate G4 chết (cùng lý lẽ với `nacHieuDung`).
   */
  BUOC_NGOAI_LICH: 50,

  /* ── NGƯỠNG: hai mốc, ba môi trường ────────────────────────────────────
   *
   * ⚠⚠ ĐẶT THEO PHÂN BỐ ĐO ĐƯỢC, KHÔNG THEO TRỰC GIÁC — và bản đầu của chính
   * tôi đặt sai vì bỏ qua bước đo. Với ngưỡng 250/600, môi trường "tiền đắt"
   * XẢY RA 0,0% trên 3.000 map ở cả ba cỡ: một cơ chế xây xong rồi không bao
   * giờ chạy. Đo (3.000 seed, `scripts/holdem_lai_suat_do.ts`):
   *
   *      hướng kỳ họp (map 16):  hạ 3.649 · giữ 4.241 · TĂNG 1.110
   *      dải mức thực tế:  map 8 [275…525] · map 12 [200…550] · map 16 [125…625]
   *
   * Hàm phản ứng LỆCH SẴN về phía hạ, và lệch có lý do: điều kiện "hạ"
   * (giảm HOẶC biến động HOẶC có cú sập) rộng hơn hẳn điều kiện "tăng" (≥1 ô
   * lạm phát/chiến tranh THẬT). Đó là thiết kế D43, không phải lỗi — nên chỗ
   * phải sửa là NGƯỠNG, không phải hàm phản ứng. Sửa hàm phản ứng là đổi luật
   * công khai mà người chơi đang học thuộc, và đụng thẳng gate 7.6.
   *
   * ⇒ Mốc đặt cách khởi điểm ĐÚNG MỘT BƯỚC KỲ HỌP. Vừa khớp phân bố, vừa cho
   * người chơi một luật đọc được bằng một câu: **một lần hạ là tiền rẻ, một lần
   * tăng là tiền đắt.** Tần suất sau khi đặt (map 8 / 12 / 16):
   *      rẻ   23,7% / 33,9% / 43,3%
   *      đắt   8,5% / 10,6% / 10,6%
   * Lệch nhau là ĐÚNG — nó phản chiếu chính độ lệch của hàm phản ứng.
   */
  /** ≤ mốc này = TIỀN RẺ (khởi điểm − 1 bước kỳ họp). */
  NGUONG_THAP: 350,
  /** ≥ mốc này = TIỀN ĐẮT (khởi điểm + 1 bước kỳ họp). */
  NGUONG_CAO: 450,

  /**
   * TÁC ĐỘNG 1 — XÁC SUẤT THẺ SỰ KIỆN (hệ số nhân trọng số, bp).
   *
   * Đây là chỗ "vượt ngưỡng thì xảy ra sự kiện của môi trường đó" thành cơ chế.
   * KHÔNG ép cứng một lá — ép cứng là bỏ luôn cờ bạc ra khỏi trò và biến ngưỡng
   * thành một cái công tắc đọc được 100%. Nghiêng MẠNH thì vừa đoán được vừa
   * còn chỗ cho bất ngờ.
   *
   * Đọc bảng: tiền rẻ thổi bong bóng và lạm phát; tiền đắt thì vỡ nợ, hack sàn,
   * phá sản — và dập bong bóng. Đúng dây chuyền tín dụng mà D43 dựng.
   */
  NHAN_THAP_BP: {
    bong_bong: 22000, lam_phat: 16000, hack_san: 7000, pha_san: 6000,
  } as Record<string, number>,
  NHAN_CAO_BP: {
    hack_san: 18000, pha_san: 18000, bong_bong: 3000, lam_phat: 6000,
  } as Record<string, number>,

  /**
   * TÁC ĐỘNG 2 — THANH KHOẢN, cùng chiều tiền tệ ngoài đời.
   *
   * Tiền đắt ⇒ sổ lệnh MỎNG đi một nấc (vốn rút khỏi thị trường); tiền rẻ ⇒ DÀY
   * thêm một nấc. Nạp thẳng vào tầng trượt giá do đông, nên "cả bàn dồn một mã"
   * trong môi trường thắt chặt đắt hơn hẳn — đúng chỗ đám đông hay dồn nhất.
   *
   * ⚠ Cộng dồn với `THANH_KHOAN_DONG` (giai đoạn/sự kiện), KHÔNG thay thế:
   * `nacHieuDung` kẹp cuối cùng vào [0, 2] nên chồng nhau không tràn.
   * ⚠ Áp cho MỌI mã, khác nhánh `DAY_THEM_SU_KIEN` chỉ ưu ái nhóm risk-on —
   * lãi suất là điều kiện tiền tệ của cả thị trường, không của riêng ai.
   */
  NAC_THAP: 1,
  NAC_CAO: -1,
} as const;

/**
 * v42 (D311) — COUPON của Trái phiếu Mỹ.
 *
 * Lá `tpcp` là mã DUY NHẤT trả dòng tiền (`TaiSan.dong_tien === 'coupon'`), và nó trả
 * vào TIỀN MẶT chứ không cộng vào giá — đó là điểm dạy được: trái phiếu trả bạn tiền
 * đều đặn trong lúc GIÁ của nó vẫn có thể rơi. Trước v42 không mã nào có dòng tiền,
 * nên carry bị gói vào ma trận và người chơi không thấy nó bao giờ.
 *
 * NEO VÀO LÃI SUẤT NỀN ĐANG CÔNG BỐ, không phải một hằng số riêng: ngân hàng trung
 * ương trong trận đã là một máy (`LAI_SUAT_NEN`), thêm máy thứ hai là hai nguồn (D61).
 * ⚠ Sổ KHỐNG trả ngược khoản này — khống trái phiếu là đi vay tờ trái phiếu, mà chủ
 * tờ vẫn phải được nhận lãi của họ.
 */
export const COUPON = {
  /** 1 ô = 6 tháng (v39 `chuKyThucTe`) ⇒ hai ô một năm. */
  O_MOI_NAM: 2,
  /** ⭐ MC-TUNE — hệ số nhân, 10000 = ×1 (trả đúng lãi suất chia đôi). */
  NHAN_BP: doThamSo('COUPON_NHAN_BP', 10000),
} as const;

/**
 * bp trả cho mỗi chip đang giữ, MỘT Ô. `diem` = lãi suất nền đang công bố (bp/năm).
 * Lãi 400 (4,00%/năm) ⇒ 200 bp/ô. Số nguyên, floor hai lần (C5).
 *
 * ⚠ v45: `duongCong` bật thì `diem` ĐI QUA `laiSuatDaiBp` trước — coupon trả theo
 * lợi suất DÀI, không theo lãi chính sách. Ở đúng khởi điểm (400) hai đường trùng
 * nhau nên ví dụ trên vẫn đúng; rời khởi điểm thì KHÔNG (xem `DUONG_CONG`).
 */
export function couponBp(diem: number, duongCong = false): number {
  const mot = Math.floor((duongCong ? laiSuatDaiBp(diem) : diem) / COUPON.O_MOI_NAM);
  return Math.floor((mot * COUPON.NHAN_BP) / 10000);
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * v45 (D318) — ĐƯỜNG CONG LỢI SUẤT: lãi DÀI không chạy 1:1 theo lãi CHÍNH SÁCH
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠⚠ ĐÂY LÀ CHỖ ÉP THỰC TẾ TÔI TỰ KHAI Ở D315 VÀ ĐẶC TẢ 08 MỤC 1, nay vá.
 * Trận chỉ có MỘT lãi suất (`LAI_SUAT_NEN`, lãi chính sách), mà Trái phiếu Mỹ
 * trong game là tờ **10 NĂM** (FRED `DGS10`, duration ≈ 7,5). Trước v45, coupon
 * đọc thẳng lãi chính sách ⇒ một kỳ họp tăng 75 điểm đẩy coupon 10 năm lên đúng
 * 75. Ngoài đời lãi dài **không hề** chạy 1:1 — đường cong lợi suất bẹp thành
 * một điểm là mất luôn thứ vẫn được dạy là "chỉ báo suy thoái đáng tin nhất".
 *
 * MÔ HÌNH — hai số, cả hai có nguồn:
 *
 *   lãi_dài = NEO_BP + ⌊TRUYEN_DAN_BP × (lãi_chính_sách − khởi_điểm) / 10000⌋
 *
 * · `TRUYEN_DAN_BP` 4000 = **0,40**: lãi dài chỉ nhích 40 điểm khi chính sách
 *   nhích 100. Đây là phần đã đo được nhiều lần ở thị trường thật (beta của
 *   thay đổi lãi 10 năm theo thay đổi lãi chính sách rơi vào 0,3–0,5; giai đoạn
 *   "conundrum" 2004–2006 còn gần 0). Lấy giữa dải.
 * · `NEO_BP` **400 = ĐÚNG khởi điểm** ⇒ **KHÔNG có phần bù kỳ hạn**, và ở lãi
 *   khởi điểm coupon ra ĐÚNG con số của bản trước v45. Cố ý: xem khối ⚠⚠ dưới.
 *
 * ⭐⭐ HỆ QUẢ CHƠI ĐƯỢC, và nó là cả lý do cơ chế này đáng làm: **ĐƯỜNG CONG ĐẢO
 * NGƯỢC ĐƯỢC**. Lãi lên trên khởi điểm ⇒ lãi dài chỉ theo 0,4 ⇒ gửi tiết kiệm
 * (neo lãi CHÍNH SÁCH) bắt đầu trả CAO HƠN coupon trái phiếu dài. Người chơi
 * không cần biết chữ "đường cong đảo ngược" để dùng nó — họ chỉ thấy hai con số
 * trên màn đổi ngôi, và đó đúng là cách người ta gặp hiện tượng này ngoài đời.
 * Chiều ngược lại cũng đúng: hạ lãi về 0 ⇒ lãi dài 240 vs chính sách 0, đường
 * cong DỐC HẲN — trái phiếu thành nơi duy nhất còn trả tiền.
 *
 * ⚠⚠ VÌ SAO KHÔNG CÓ PHẦN BÙ KỲ HẠN, DÙ NGOÀI ĐỜI CÓ (~1 điểm phần trăm).
 * Bản đầu của D318 đặt `NEO_BP = 500` đúng theo dữ kiện ấy. Gate bác:
 *
 *   | NEO_BP | phần bù | `Gửi hết` hạng | `Ngược dòng` thắng% | G5a |
 *   |--------|---------|---------------:|--------------------:|:---:|
 *   | 500    | +100 bp |           2,55 |               11,5% |  ✗  |
 *   | 450    |  +50 bp |           2,54 |               11,4% |  ✗  |
 *   | 400    |       0 |           2,95 |               25,5% |  ✓  |
 *
 * Cơ chế đọc được từ bảng chênh lệch từng bot: coupon nền cao hơn nghĩa là
 * **khống trái phiếu đắt hơn đúng chừng ấy phần trăm**, mà khoản ấy bị ĐỐT. Nó
 * bào đệm ký quỹ của bot khống nặng cho tới lúc qua ngưỡng `GOI_KY_QUY` — và
 * vách đứng nằm gọn giữa 400 và 450 rồi PHẲNG, đúng hình dạng của một ngưỡng
 * chứ không phải của một chi phí tuyến tính.
 *
 * ⚠ Và đây là chỗ tôi LẤN PHẠM VI CỦA CHÍNH MÌNH: thứ D315 khai là sai chỉ có
 * **truyền dẫn 1:1**. Phần bù kỳ hạn là một thay đổi KINH TẾ thứ hai đội lốt
 * một thay đổi ĐỘ TRUNG THỰC, và chính nó gây toàn bộ cú đỏ. Thêm nó lại là một
 * việc RIÊNG, phải đo riêng và phải cân lại chi phí khống — ghi ở D318 §Còn mở.
 *
 * Hệ quả nhỏ đáng biết: `NEO_BP` = khởi điểm nghĩa là đường cong PHẲNG lúc mở
 * trận và đảo ngay từ kỳ họp tăng đầu tiên. Với một trò dạy đọc thị trường thì
 * đó không phải nhược điểm — "tăng lãi làm đường cong đảo" chính là bài học.
 *
 * ⚠ CỐ Ý CHỈ ĐỔI COUPON, KHÔNG ĐỔI HÀNG GIÁ của `tpcp` trong ma trận. Hàng giá
 * v42 suy từ biến động GIÁ THẬT của tờ 10 năm (`giam` +8,75%/6 tháng, v.v.), tức
 * nó ĐÃ mang sẵn hệ số truyền dẫn thật bên trong. Sửa cả hai là đếm hai lần —
 * đúng lớp lỗi "hai nguồn cho một khái niệm" (D61). Thứ sai trước v45 chỉ là
 * carry: nó đọc lãi chính sách như thể đó là lợi suất 10 năm.
 */
export const DUONG_CONG = {
  /** Lợi suất 10 năm khi lãi chính sách ở khởi điểm. = khởi điểm ⇒ KHÔNG phần bù kỳ hạn. */
  NEO_BP: doThamSo('DC_NEO_BP', 400),
  /** Lãi dài chạy bao nhiêu phần khi lãi chính sách chạy 1. 10000 = 1:1 (bản trước v45). */
  TRUYEN_DAN_BP: doThamSo('DC_TRUYEN_DAN_BP', 4000),
  SAN_BP: 0,
  TRAN_BP: 1500,
} as const;

/** Lợi suất DÀI (bp/năm) suy từ lãi chính sách. Kẹp hai đầu; số nguyên (C5). */
export function laiSuatDaiBp(diem: number): number {
  const tho = DUONG_CONG.NEO_BP
    + Math.floor((DUONG_CONG.TRUYEN_DAN_BP * (diem - LAI_SUAT_NEN.KHOI_DIEM)) / 10000);
  return Math.max(DUONG_CONG.SAN_BP, Math.min(DUONG_CONG.TRAN_BP, tho));
}

/**
 * v43 (D314) — HỢP ĐỒNG GỬI TIẾT KIỆM.
 *
 * Founder 08/09: khoá một lượng tiền mặt N ô, lãi cố định cao; huỷ trước hạn **mất
 * toàn bộ lãi tích luỹ**, trả gốc. Và (D309): *"hợp đồng gửi TK thì không có giới hạn
 * nhé. Chia ra làm các mốc cam kết VD: 2 thẻ, 3 thẻ, 4 thẻ và tính toán cân bằng
 * quyền lợi/rủi ro mỗi cái."*
 *
 * ⚠ ĐÂY LÀ CƠ CHẾ DẠY ĐƯỢC NHẤT CỦA CẢ ĐỢT, và cũng dễ hỏng nhất: nếu lãi đủ cao thì
 * "gửi hết rồi ngồi im" thành nước đi trội, và bàn thôi là một trò đọc chợ. Gate **G5**
 * (`scripts/holdem_montecarlo.ts`) canh đúng ba cửa đó — xem docstring của nó.
 *
 * BA MỐC, và cái giá của từng mốc phải thấy được:
 *  · mốc dài trả thêm (`THEM_KY_HAN_BP`) vì nó khoá thanh khoản lâu hơn;
 *  · lãi CHỐT LÚC MỞ — kỳ họp ⚖ tăng lãi sau đó thì hợp đồng kẹt dưới thị trường;
 *  · huỷ mất TOÀN BỘ lãi treo, mà lãi treo nằm trong NAV ⇒ huỷ là NAV tụt thấy được
 *    ngay vòng huỷ. Hình phạt là TIỀN, không phải một câu chữ.
 */
export const TIET_KIEM = {
  /** Mốc kỳ hạn (số ô). FOUNDER CHỐT 08/09 — KHÔNG phải MC-TUNE. */
  MOC: [2, 3, 4] as readonly number[],
  /** 1 ô = 6 tháng (v39) ⇒ hai ô một năm. Cùng máy với `COUPON`. */
  O_MOI_NAM: 2,
  /**
   * ⭐ Cộng vào lãi mỗi ô theo mốc. CHỐT 09/09 (D317) BẰNG ĐO, sau khi bộ đầu
   * (0 / 50 / 100) làm G5b ĐỎ ở CẢ BA cỡ map.
   *
   * ⚠⚠ ĐỌC KỸ CHỖ PHẲNG Ở ĐỈNH — nó trông như lỗi và nó KHÔNG phải lỗi.
   * Mốc 3 và mốc 4 trả CÙNG một lãi suất/ô, tức bậc thang kỳ hạn không dốc lên
   * tới cùng. Ngoài đời đường cong thường dốc lên, nên bản năng là sửa nó. Tôi
   * đã thử sửa và ĐO: bản dốc đều thoải hơn (0 / 25 / 50) TÁI TẠO ĐÚNG lỗi cũ —
   * `tk_4` lại là mốc tốt nhất (4,20 · 4,14 · **3,60**), tức "chọn mốc" lại
   * thành nút "chọn 4 luôn".
   *
   * VÌ SAO: trong một trận ngắn, khoá tiền lâu gần như KHÔNG mất gì (ít khi
   * cần đúng số tiền ấy đúng vòng ấy), mà mốc dài lại ăn lãi NHIỀU Ô HƠN. Nên
   * BẤT KỲ phần bù kỳ hạn dương nào cũng làm mốc dài nhất thắng tuyệt đối. Chỗ
   * phẳng là câu mà bộ số đang nói với người chơi: *quá 3 ô thì anh trả thêm
   * thanh khoản mà không mua thêm được gì* — và đó chính là thứ biến chọn kỳ
   * hạn thành một cân nhắc thật.
   *
   * ⭐⭐ QUY ĐỔI RA ĐỜI THẬT — founder đưa bảng lãi tiết kiệm VN 09/09, và nó là
   * thước cuối cùng chốt bộ số này. 1 ô = 6 tháng (v39) ⇒ **lãi/năm = 2 × lãi/ô**:
   *
   *   | mốc | = tháng | game (%/năm) | thực tế (founder)  |
   *   |-----|---------|--------------|--------------------|
   *   | 2 ô | 12      | 5,0          | 5,5 – 7,4          |
   *   | 3 ô | 18      | 5,5          | 5,5 – 7,4          |
   *   | 4 ô | 24      | 5,5          | 5,5 – 7,4          |
   *
   * ⚠ Bảng thật cho thấy 12 và 24 tháng gần như TRẢ BẰNG NHAU ngoài đời — tức
   * một bậc thang trung thực tuyệt đối sẽ không cho người chơi LÝ DO NÀO để khoá
   * lâu hơn, và cơ chế mất luôn phần "chọn kỳ hạn". Nên mốc 2 được đặt hơi DƯỚI
   * dải thật (5,0 thay vì 5,5): đó là một chỗ ép thực tế CÓ CHỦ Ý, đủ nhỏ để vẫn
   * đọc ra là lãi ngân hàng, đủ lớn để mốc dài có nghĩa. Ghi ở đặc tả 08 mục 11.
   *
   * Số đo (12.000 trận × 3 cỡ map, 5 ghế) — mốc 2 từ 0 lên 25 thu hẹp khoảng cách
   * của nó với mốc tốt nhất từ 0,31/0,32/0,28 xuống **0,21/0,22/0,19**, G5 vẫn xanh
   * cả ba cỡ. Ba mốc càng sát nhau thì "chọn kỳ hạn" càng là cân nhắc thật.
   */
  THEM_KY_HAN_BP: {
    2: doThamSo('TK_THEM_2_BP', 25),
    3: doThamSo('TK_THEM_3_BP', 50),
    4: doThamSo('TK_THEM_4_BP', 50),
  } as Readonly<Record<number, number>>,
  /**
   * ⭐ Phần bù so coupon trái phiếu (bp/ô). "Lãi cố định CAO" nghĩa là DƯƠNG so
   * coupon; cái đổi lại là mất thanh khoản N ô.
   *
   * CHỐT 25 (từ 50) ngày 09/09 — D317. Ở 50 thì bot "gửi sạch rồi ngồi im" xếp
   * TRÊN trung bình nhóm chơi được (2,71 vs 2,83 bàn 8; 2,90 vs 2,91 bàn 16),
   * tức ngân hàng thành BẾN AN TOÀN: không cần đọc gì vẫn không bao giờ về bét.
   * G1 không bắt được vì G1 đo TỶ LỆ THẮNG, mà bến an toàn không làm ai thắng
   * nhiều hơn — nó phá HẠNG TRUNG BÌNH. Đó là lý do G5a tồn tại.
   */
  PHAN_BU_BP: doThamSo('TK_PHAN_BU_BP', 25),
  /** Gốc tối thiểu một hợp đồng (chip) — lưới chắn rác, KHÔNG phải luật kinh tế. */
  GOC_TOI_THIEU: 100,
  /** Trần số hợp đồng: `null` = KHÔNG giới hạn (founder chốt 08/09). */
  TRAN_SO_HOP_DONG: null as number | null,
  /** Số lệnh MỞ tối đa trong MỘT request — lưới chắn rác request, không phải luật chơi. */
  TRAN_MO_MOI_VONG: 8,
} as const;

/**
 * Lãi bp/ô của một hợp đồng, CHỐT LÚC MỞ. `diem` = lãi suất nền lúc mở (bp/năm).
 *
 * `floor(diem / O_MOI_NAM) + THEM_KY_HAN_BP[soVong] + PHAN_BU_BP`
 * Lãi nền 400, mốc 4 ô ⇒ 200 + 50 + 25 = **275 bp/ô** = 5,5 %/năm (1 ô = 6 tháng).
 * ⚠ Ví dụ này ĐỌC TỪ hằng số ngay trên — hai lần D317/D318 hạ `PHAN_BU_BP` và
 * `THEM_KY_HAN_BP` mà quên câu này, nên nó đứng nói 350 suốt một ngày. Đổi số
 * ở trên thì sửa luôn ở đây, hoặc xoá hẳn ví dụ — đừng để nó trôi tiếp (D61).
 *
 * ⚠ Neo vào lãi suất nền chứ không phải một hằng số riêng — cùng lý do với `couponBp`:
 * trong trận đã có MỘT máy lãi suất, thêm máy thứ hai là hai nguồn (D61). Nhờ vậy "gửi
 * lúc tiền đắt" là một quyết định đọc chu kỳ được, và ô kỳ họp ⚖ thành thứ đáng chờ.
 */
/**
 * LÃI MỘT Ô của một hợp đồng, tính bằng chip.
 *
 * ⚠ VÌ SAO ĐÂY LÀ MỘT HÀM RIÊNG chứ không phải một phép nhân viết tại chỗ: màn
 * hình ngân hàng phải niêm yết ĐÚNG con số engine sẽ cộng, và cách duy nhất
 * chắc chắn đúng là gọi CHÍNH phép tính ấy. Viết lại `floor(goc*lai/10000)` ở
 * client là bản cài đặt thứ hai, và bản thứ hai SẼ trôi (D61) — biểu hiện của
 * nó ở đây là "màn báo 42, sổ cộng 41", loại lỗi tiền người chơi không tha.
 *
 * Làm tròn XUỐNG (C5 — token là số nguyên, phần dư không rơi vào túi ai).
 */
export function laiMoiO(goc: number, laiBp: number): number {
  return Math.floor((goc * laiBp) / 10000);
}

export function laiTietKiemBp(diem: number, soVong: number): number {
  const nen = Math.floor(diem / TIET_KIEM.O_MOI_NAM);
  return nen + (TIET_KIEM.THEM_KY_HAN_BP[soVong] ?? 0) + TIET_KIEM.PHAN_BU_BP;
}

/**
 * v46 (D338) — LÃI VAY ĐÒN BẨY: bp mỗi ô, trả trên phần tiền ĐANG được Đòn Bẩy nhân đôi.
 *
 * Founder 15/09: *"lõi đòn bẩy tôi nghĩ nên cho thêm cơ chế lãi vay hay gì đó giống ngoài
 * đời nhỉ chứ bây giờ cho phép gán vào mã mình chọn rồi thì OP quá"*. Neo vào CÙNG máy lãi
 * suất với sổ tiết kiệm và coupon (D61 — một máy lãi suất): tiền rẻ thì vay rẻ, sau cú tăng
 * lãi ở kỳ họp thì Đòn Bẩy tự đắt lên — đúng bài bàn tập dạy.
 *
 * `floor(floor(diem / O_MOI_NAM) × HE_SO_NEN_BP / 10000) + PHAN_BU_BP`, kẹp ≥ 0.
 * FOUNDER CHỐT 16/09 (D338) sau bảng cặp song sinh: *"như ngoài đời thôi"* + *"theo trạng thái nền
 * kinh tế"* ⇒ đúng lãi nền quy ra ô + 1%/ô — ở lãi nền 400 là 300 bp/ô, cao hơn sổ tiết kiệm
 * (250–275 bp/ô) như ngoài đời, và chạy theo kỳ họp. Không phải MC-TUNE; `doThamSo` giữ để quét lại.
 */
export const LAI_VAY_DON_BAY = {
  /** Phần của lãi nền mỗi ô được tính (10000 = đúng bằng lãi nền). */
  HE_SO_NEN_BP: doThamSo('DB_LAI_HE_SO_NEN_BP', 10000),
  /** Phần bù cộng thêm, bp mỗi ô. */
  PHAN_BU_BP: doThamSo('DB_LAI_PHAN_BU_BP', 100),
} as const;

export function laiVayDonBayBp(diem: number): number {
  const nen = Math.floor(diem / TIET_KIEM.O_MOI_NAM);
  return Math.max(0,
    Math.floor((nen * LAI_VAY_DON_BAY.HE_SO_NEN_BP) / 10000) + LAI_VAY_DON_BAY.PHAN_BU_BP);
}

/** Ba môi trường tiền tệ suy từ mức — dùng chung cho engine, bảng, giao diện. */
export type MoiTruongTienTe = 're' | 'trung_tinh' | 'dat';

export function moiTruongTienTe(diem: number): MoiTruongTienTe {
  if (diem <= LAI_SUAT_NEN.NGUONG_THAP) return 're';
  if (diem >= LAI_SUAT_NEN.NGUONG_CAO) return 'dat';
  return 'trung_tinh';
}

/**
 * Dịch mức theo một hướng chính sách. Thuần, kẹp trong [SAN, TRAN].
 *
 * ⚠ MỘT NGUỒN CHÂN LÝ cho cả `sinhMap` lẫn mọi chỗ muốn suy lại mức. Hai bản
 * cài đặt của cùng phép cộng này sẽ trôi, và cú trôi biểu hiện là bảng hiện một
 * mức còn engine dùng một mức khác — sai IM LẶNG, đúng lớp lỗi D61 đặt tên.
 */
export function dichLaiSuat(diem: number, huong: HuongChinhSach, buoc: number): number {
  const moi = huong === 'tang' ? diem + buoc : huong === 'ha' ? diem - buoc : diem;
  return Math.max(LAI_SUAT_NEN.SAN, Math.min(LAI_SUAT_NEN.TRAN, moi));
}

/**
 * v28 — TỶ LỆ TIN GIẢ HIỆU DỤNG (bp) của một ô sự kiện, theo LUẬT CÔNG KHAI:
 * bối cảnh × loại sự kiện (bong bóng đi theo môi trường tiền tệ), kẹp sàn/trần.
 *
 * ⚠ MỘT NGUỒN CHÂN LÝ cho cả ba người dùng: `sinhMap` (rút thật), bot hoài
 * nghi (chiết khấu 1−2p), và tự điển/UI (kể luật cho người chơi). Hai bản cài
 * đặt của cùng công thức sẽ trôi (D61), và cú trôi ở đây nghĩa là gate G4 đo
 * một bot hiệu chỉnh theo một tỷ lệ không còn tồn tại.
 * ⚠ Số học thuần cộng-nhân-chia-nguyên (floor) — khớp `applyBpInt` bên server.
 */
export function tyLeTinGiaHieuDung(
  boiCanh: BoiCanhTin, suKien: SuKienId, laiSuatDiem: number,
  /** D301 — trận chạy cổng `chuKyThucTe` đọc bảng hiệu chỉnh (tin đơn độc 67% giả). */
  thucTe = false,
): number {
  const goc = (thucTe ? TY_LE_TIN_GIA_THUC_TE : TY_LE_TIN_GIA_THEO_BOI_CANH)[boiCanh];
  const nhan = suKien === 'bong_bong'
    ? MAP_V28.NHAN_TIN_GIA_BONG_BONG[moiTruongTienTe(laiSuatDiem)]
    : (MAP_V28.NHAN_TIN_GIA_SU_KIEN[suKien] ?? 10000);
  /*
   * ⚠⚠ CẦN GẠT ĐO LƯỜNG, mở 11/08 — ĐÂY LÀ CHỖ DUY NHẤT CẢ BA BẢNG HỘI TỤ.
   *
   * Từ v28, tỷ lệ tin giả THẬT là tích của ba bảng (bối cảnh × loại sự kiện ×
   * môi trường tiền tệ) — không bảng nào dò được. Hệ quả: `TY_LE_TIN_GIA_BP`,
   * thứ D58 gọi là "cần gạt của G2/G4" và thông điệp gate VẪN đang chỉ tên,
   * đã CHẾT mà không ai biết — dò ba nấc ra số giống hệt tới từng chữ số.
   *
   * Đặt MỘT hệ số nhân ở đây thay vì mở ba bảng: ba cần gạt cho một câu hỏi
   * thì không đọc được kết quả (đổi cái nào gây ra cái gì?), và ba bảng ấy
   * mang HÌNH DẠNG phân phối — thứ v28 dựng có chủ đích — còn câu hỏi của G4
   * là về MỨC. Một cần gạt dịch cả phân phối mà giữ nguyên hình dạng.
   *
   * Mặc định 10000 = ×1,00 ⇒ không đổi một chip. Sàn/trần kẹp SAU khi nhân
   * nên calibration vẫn sống ở mọi mức.
   */
  const nhanDo = doThamSo('TIN_GIA_NHAN_BP', 10000);
  return Math.min(MAP_V28.TIN_GIA_TRAN_BP,
    Math.max(MAP_V28.TIN_GIA_SAN_BP,
      Math.floor((goc * nhan * nhanDo) / 100000000)));
}

/**
 * D43 BƯỚC 3 — QUÁN TÍNH TỪNG HÀNG (03-chu-ky-tin-dung §3 + §5.3).
 *
 * Đây là thứ duy nhất biến "chuỗi xúc xắc" thành "xu hướng". Founder 01/08:
 * "thắng thì đậm mà thua thì đau nhưng bám sát logic ngoài đời" — ngoài đời
 * regime BÁM DÍNH: một chuỗi tăng đã xác nhận có xu hướng kéo dài, và người
 * cầm đúng phía ăn LŨY THỪA theo chuỗi, cầm sai phía trả lũy thừa theo chuỗi.
 * EV mỗi vòng không đổi — cái nở ra là PHƯƠNG SAI, đúng bất biến §5.3.
 *
 * Luật (chỉ chạm cú rút PHA, không chạm sự kiện/ô lịch/chuỗi ép bong bóng):
 * · Chuỗi CHỈ tính khi ≥ NGUONG_CHUOI ô pha cùng hướng — một ô lẻ chưa phải
 *   xu hướng, phát tiếp từ hàng TRUNG TÍNH (chính là luật reset §5.3: gãy
 *   hướng ⇒ run về 1 ⇒ dưới ngưỡng ⇒ trung tính).
 * · Chuỗi hướng LÊN (tăng/phục hồi, đại diện = pha vừa lật): +TU_LAP_BP cho
 *   chính pha đó.
 * · Chuỗi hướng XUỐNG: +TU_LAP_BP cho giảm, +KEM_BIEN_DONG_BP cho biến động
 *   (sập kéo hỗn loạn — §3 hàng Giảm).
 * · PHỤC HỒI CHỈ MỞ SAU GIẢM ≥ PHUC_HOI_SAU_GIAM_O: đáy cần thời gian; đảo
 *   đáy một-ô chính là "răng cưa lên-xuống" gây cảm giác hỗn loạn mà bản v2
 *   gọi tên. Chặn bằng trọng số 0, không phải hạ thấp.
 *
 * ⭐ TU_LAP_BP/KEM_BIEN_DONG_BP là số agent đặt CHỜ Monte Carlo (A8.2) — gate
 * 7.5 (autocorrelation phải tăng RÕ) là thước; số đo ghi ở doc 03.
 */
/**
 * ─── KỲ NGỘ TRONG TRẬN (D85/D86 §1, doc 06 §1.4) — món 3 của cụm ────────────
 *
 * Ở một số vòng của map lớn, trận mời chọn MỘT nhiệm vụ; hoàn thành trong phần
 * còn lại → nhận một đặc quyền. Khuôn augment của TFT, founder chốt 12/08.
 *
 * ⚠⚠ LẰN RANH GIỮ DATA (A1 + D69) — bước qua là giết sản phẩm. `events` đo
 * KHẨU VỊ RỦI RO TỰ NHIÊN. Nhiệm vụ kê đơn tư thế rủi ro thì từ đó ta đo SỰ
 * VÂNG LỜI, và `events` append-only nên KHÔNG gắn nhãn lại được (A3.3).
 * ⇒ LUẬT: bốn nhiệm vụ khác nhau ở KIỂU ĐÚNG ĐẮN ĐƯỢC ĐO, không khác ở HÀNH
 * ĐỘNG phải làm. Cả bốn chỉ nói "hãy đúng"; KHÔNG cái nào nói "hãy phơi ra bao
 * nhiêu / hãy đa dạng hoá / hãy giữ tiền mặt".
 * Phép thử trước khi thêm nhiệm vụ: *"cái này nói PHẢI PHƠI RA BAO NHIÊU, hay
 * chỉ nói HÃY ĐỌC ĐÚNG?"* Cái đầu ⇒ loại.
 *
 * ⚠ ĐẶC QUYỀN KHÔNG ĐƯỢC TRÙNG LÕI CHIẾN THUẬT (founder đảo ý D85 ngày 12/08:
 * *"đặc quyền nhiệm vụ không nên trùng lặp với lõi chiến thuật"*). Trùng thì lá
 * thành thừa — ai còn mua Lướt Sóng khi nhiệm vụ phát bảng sạch? Nên mỗi đặc
 * quyền ăn một TRỤC mà không lá nào chạm:
 *   · BẢN ĐỒ CHU KỲ  — thông tin HỒI CỐ (mọi lá đều nói về tương lai)
 *   · PHIẾU MỞ BẢNG  — LƯỢT DÙNG (lá đổi giá/chất lượng vĩnh viễn)
 *   · THẺ GIỜ        — THỜI GIAN (chưa cơ chế nào chạm đồng hồ)
 *   · CHUÔNG ĐỔI PHA — CẤU TRÚC (Lướt Sóng đoán NỘI DUNG: tên sự kiện)
 */
export type NhiemVuId = 'la_ban' | 'tay_can' | 've_song' | 'bat_nhip';
export type DacQuyenKyNgoId = 'ban_do_chu_ky' | 'phieu_mo_bang' | 'the_gio' | 'chuong_doi_pha';

export interface NhiemVuKyNgo {
  id: NhiemVuId;
  ten: string;
  /**
   * Tên icon PIXEL (bộ `PixelIcon` sẵn có) — hiện nhỏ trên avatar để người khác
   * biết mình chọn con đường nào (founder 15/08).
   * ⚠ KHÔNG emoji: màn trận cấm icon do hệ điều hành vẽ (D47). Dùng lại bộ có
   * sẵn để không đẻ nợ art (§XI) — art mới là phần tốn thời gian thật, không
   * phải code.
   */
  icon: string;
  /** MÔ TẢ điều kiện — A10: nói ĐO GÌ, không khuyên nước đi. */
  mo_ta: string;
  dac_quyen: DacQuyenKyNgoId;
  ten_dac_quyen: string;
  mo_ta_dac_quyen: string;
}

export const NHIEM_VU_KY_NGO: readonly NhiemVuKyNgo[] = [
  {
    id: 'la_ban',
    icon: 'target',
    ten: 'LA BÀN',
    mo_ta: 'Đọc đúng hướng ở phần lớn số vòng bạn có vị thế.',
    dac_quyen: 'ban_do_chu_ky',
    ten_dac_quyen: 'BẢN ĐỒ CHU KỲ',
    mo_ta_dac_quyen: 'Mọi ô ĐÃ lật hiện tên pha chu kỳ của nó.',
  },
  {
    id: 'tay_can',
    icon: 'chart',
    ten: 'TAY CÂN',
    mo_ta: 'Cỡ vị thế khớp độ tin — độ chuẩn trung bình đủ tốt.',
    dac_quyen: 'phieu_mo_bang',
    ten_dac_quyen: 'PHIẾU MỞ BẢNG ×2',
    mo_ta_dac_quyen: 'Hai lượt mở Bảng điện tử miễn phí.',
  },
  {
    id: 've_song',
    icon: 'bolt',
    ten: 'KẺ VƯỢT SÓNG',
    /*
     * D88 §11.1(2) — ĐỊNH NGHĨA LẠI: so phần chợ CHỌN với phần chợ LOẠI (trung
     * bình đều, không trọng số vốn), thay cho "thắng trung bình mọi mã". Bản cũ
     * làm dàn đều VĨNH VIỄN không đạt — gradient chạm trục "đa dạng hoá" mà lằn
     * ranh §1.2 cấm. Toàn văn lý lẽ ở `soVoiCho` (server/holdem/ky_ngo.ts).
     */
    mo_ta: 'Phần chợ bạn chọn thắng phần chợ bạn loại ở phần lớn số vòng còn lại.',
    dac_quyen: 'the_gio',
    ten_dac_quyen: 'THẺ GIỜ',
    mo_ta_dac_quyen: 'Thêm giây suy nghĩ ở mỗi vòng còn lại.',
  },
  {
    id: 'bat_nhip',
    icon: 'candle',
    ten: 'KẺ BẮT NHỊP',
    mo_ta: 'Đọc đúng hướng ở những vòng thị trường ĐỔI PHA.',
    dac_quyen: 'chuong_doi_pha',
    ten_dac_quyen: 'CHUÔNG ĐỔI PHA',
    mo_ta_dac_quyen: 'Báo trước ô kế là ô đổi pha — không nói pha nào.',
  },
] as const;

export const KY_NGO = {
  /**
   * Vòng kỳ ngộ theo cỡ map (1-indexed). THAY một vòng mua tài sản, không chèn
   * thêm — map 16 có 11 vòng mua tài sản, chính nhịp lặp đó là "dài lê thê".
   * Đặt ngay sau vòng chọn thẻ chiến thuật cuối (12: v6 · 16: v8) nên All-in đã mở.
   * ⚠ map 8 VẮNG MẶT có chủ ý: mẫu đối chứng (doc 06 §4).
   */
  VONG: { 12: [7], 16: [6, 12] } as Readonly<Record<number, readonly number[]>>,
  /** Mời 3 trong 4, xoay vòng — 2 là tung xu, 4 mỏng data với ~150 người. */
  SO_MOI: 3,
  /** LA BÀN: đúng hướng ≥ 60% số vòng CÓ VỊ THẾ. */
  LA_BAN_TY_LE_BP: 6000,
  /** KẺ VƯỢT SÓNG: thắng chỉ số ≥ 50% số vòng còn lại. */
  VE_SONG_TY_LE_BP: 5000,
  /** KẺ BẮT NHỊP: đúng hướng ở ≥ 2 vòng đổi pha. */
  BAT_NHIP_SO_VONG: 2,
  /** TAY CÂN: Brier trung bình ≤ ngưỡng (thang 0–2). PLAYTEST-TUNE. */
  TAY_CAN_BRIER_BP: 4500,
  /**
   * ⚠⚠ CHỐNG LÁCH — phải có vị thế ở ≥ 50% số vòng còn lại mới được tính XONG.
   * Thiếu vế này thì chiến lược trội là nằm im toàn tiền mặt rồi vào đúng một
   * vòng ăn chắc. Khai thẳng cái giá: đây là ràng buộc phơi nhiễm NHẸ (đòi CÓ
   * MẶT, không đòi NẶNG BAO NHIÊU) — trục khẩu vị rủi ro vẫn sạch.
   */
  TOI_THIEU_VONG_CO_VI_THE_BP: 5000,
  /** THẺ GIỜ cộng bao nhiêu giây mỗi vòng còn lại. PLAYTEST-TUNE. */
  THE_GIO_THEM_S: 8,
  /** PHIẾU MỞ BẢNG cấp mấy lượt miễn phí. */
  PHIEU_MO_BANG_SO: 2,
  /**
   * D88 §11.3 — BỘ MỜI SINH THEO CHƯƠNG HỒI: hồi nào LOẠI nhiệm vụ nào.
   *
   * Hồi (chương đang chơi, suy từ thông tin CÔNG KHAI — `chuongHoi`) quyết món
   * bị loại khỏi bộ mời 3/4, thay cho phép chia lấy dư mù bối cảnh. Mỗi entry
   * loại đúng nhiệm vụ mà hồi đó làm QUÁ DỄ (thành giải tham dự), BẤT KHẢ
   * (thành bỏ cố) hoặc XỔ SỐ (thành may rủi) — cả ba đều giết dải mục tiêu
   * hoàn thành 40–55%:
   * · `bong_bong` loại LA BÀN — mọi thứ cùng lên, "đúng hướng" thành quá dễ.
   * · `tien_re` loại KẺ BẮT NHỊP — chợ êm, hồi cố ít đổi pha ⇒ dễ thành bỏ cố.
   * · `gay_dung` loại KẺ VƯỢT SÓNG — phục hồi kéo cả bàn, phân tán thấp ⇒
   *   chọn/loại thành tung xu.
   * Hồi không có entry (`mo_man`/`song_gio`/`tien_dat`/`giu_nhip`) → phép xoay cũ.
   *
   * ⚠⚠ `song_gio` CỐ Ý KHÔNG CÓ ENTRY — bản đầu gán nó loại TAY CÂN ("biến
   * động cao, độ chuẩn thành xổ số") và PHÉP ĐO BÁC NGAY: sóng gió là hồi PHỔ
   * BIẾN NHẤT tại vòng kỳ ngộ (đo 25–46% tuỳ cỡ), nên món nó loại bị bỏ đói —
   * tay_can tụt còn 49,3% được mời ở map 12, thủng sàn 50%. Mà về nội dung,
   * sóng gió là hồi GIÀU CẤU TRÚC nhất (phân tán cao, đổi pha dày): không
   * nhiệm vụ nào thành quá dễ hay bất khả ở đó để đáng loại cố định. Luật rút
   * ra: HỒI PHỔ BIẾN PHẢI MỜI ĐA DẠNG — entry cố định chỉ dành cho hồi làm
   * một nhiệm vụ suy biến THẬT, và tần suất hồi là một nửa quyết định.
   *
   * ⚠ CHỈ đọc hồi CÔNG KHAI (nhãn hồi cố của ô ĐÃ lật) — bộ mời không được rò
   * một bit nào về ô CHƯA lật, nếu không lời mời thành máy dò map phát không.
   * ⚠ PLAYTEST-TUNE + CHỜ FOUNDER (A8.2): bảng đã kiểm bằng quét phân bố hồi
   * trên hàng nghìn seed (không nhiệm vụ nào bị bỏ đói lời mời) — số đo trong
   * báo cáo D88; founder đổi entry nào thì phải quét lại.
   * ⚠⚠ BẢNG NÀY NẰM TRÊN ĐƯỜNG REPLAY (bộ mời phải dựng lại được y hệt):
   * đổi nó sau khi v32 có trận thật là phải qua cổng `balance_version` mới.
   */
  LOAI_THEO_HOI: {
    bong_bong: 'la_ban',
    tien_re: 'bat_nhip',
    gay_dung: 've_song',
  } as Readonly<Record<string, NhiemVuId>>,
} as const;

/** Vòng này có phải vòng kỳ ngộ của cỡ map đó không. */
export function laVongKyNgo(vong: number, soO: number): boolean {
  return (KY_NGO.VONG[soO] ?? []).includes(vong);
}

/**
 * Bộ nhiệm vụ được mời ở một vòng kỳ ngộ — TẤT ĐỊNH theo (seed, vòng).
 *
 * Tất định là bắt buộc: bộ mời phải dựng lại được khi replay, y như map. Không
 * lưu vào log (suy được) — cùng lý lẽ với `bayShop`.
 * Xoay vòng 3/4 để có lúc món ruột vắng mặt ⇒ lộ ra lựa chọn THỨ HAI, một trục
 * data mà bản mời-đủ-bốn không bao giờ đo được.
 */
export function boNhiemVuMoi(seed: number, vong: number): readonly NhiemVuId[] {
  const n = NHIEM_VU_KY_NGO.length;
  // Bỏ đúng một món, xoay theo (seed, vòng) — phép chia lấy dư tất định.
  const bo = Math.abs((seed * 31 + vong * 7)) % n;
  return NHIEM_VU_KY_NGO.filter((_, i) => i !== bo).map((x) => x.id).slice(0, KY_NGO.SO_MOI);
}

/**
 * D88 §11.3 — bộ mời SINH THEO HỒI: hồi đang chơi quyết món bị loại; hồi không
 * có trong bảng (hoặc chưa suy được hồi) thì rơi về phép xoay cũ.
 *
 * Vẫn TẤT ĐỊNH — hồi là hàm thuần của (map, vòng) và map là hàm thuần của
 * (seed, cỡ, luật), nên bộ mời dựng lại được khi replay y như trước. Cái đổi
 * là lời mời nay CÓ TÁC GIẢ: đứng giữa BONG BÓNG PHỒNG nhận bộ khác đứng giữa
 * SÓNG GIÓ, và cú chọn ghi kèm `hoi` thành trục data "chọn gì KHI đang ở chế
 * độ thị trường nào" — thứ phép chia lấy dư không bao giờ đo được.
 */
export function boNhiemVuTheoHoi(
  seed: number, vong: number, hoi: string | null | undefined,
): readonly NhiemVuId[] {
  const loai = hoi ? KY_NGO.LOAI_THEO_HOI[hoi] : undefined;
  if (!loai) return boNhiemVuMoi(seed, vong);
  return NHIEM_VU_KY_NGO.filter((x) => x.id !== loai).map((x) => x.id);
}

/**
 * D85/D86 §2 — BẢN SẮC CỠ MAP: kịch bản HỒI cho map dài (cờ `banSacMap`, v32).
 *
 * D31 đặt bản sắc "8 lướt sóng · 16 dài hạn" từ 26/07 mà nó chỉ tồn tại dưới
 * dạng SỐ Ô — cùng máy sinh, map 16 là 16 lần lặp một kiểu thời tiết (chẩn
 * đoán gốc của "dài lê thê", doc 06 §0). Bảng này cho mỗi cỡ map một KỊCH BẢN
 * HỒI: cộng bp vào trọng số PHA theo VỊ TRÍ ô.
 *
 * ⚠⚠ NGHIÊNG, KHÔNG ÉP — cùng triết lý BONG_BONG_V27: đây là cộng vào trọng
 * số một cú rút vẫn ngẫu nhiên, không phải một cái script. Quán tính (3500bp),
 * telegraph (6000bp), sức căng, lịch họp, bong bóng chuỗi VẪN vận hành và VẪN
 * thắng được kịch bản — độ nghiêng hồi cố ý nhỏ hơn cả hai lực đó. Trận lệch
 * kịch bản phải TỒN TẠI, nếu không thì đọc-cung thành đọc-thuộc-lòng và người
 * chơi thuộc bài sau ba trận.
 *
 * ⚠ MAP 8 CỐ Ý VẮNG MẶT = không hồi = byte-hệt máy cũ. Nó là MẪU ĐỐI CHỨNG
 * của cả thiết kế data hai-bộ (doc 06 §4): khẩu vị rủi ro sạch sống ở đây.
 * Có test khoá điều này — thêm kịch bản cho map 8 là bài đó đỏ.
 *
 * ⚠ Vế "phồng" của map 16 KHÔNG tự đẻ cơ chế: nghiêng `tang` đủ dài thì máy
 * bong-bóng-chuỗi v27 SẴN CÓ tự kích (chuỗi tăng xác nhận ⇒ bong bóng ⇒ gãy
 * theo độ cao) — hồi III nhận cú sập từ chính vật lý cũ, kịch bản chỉ dọn sân.
 *
 * MC-TUNE toàn bộ — founder duyệt trước khi v32 thành mặc định (A8.2).
 */
export interface NhipHoi {
  /** Hết hồi tại vị trí này (bp của tiến độ map, [0..10000]). */
  den: number;
  /** Cộng (âm = trừ, kẹp sàn 0) vào trọng số pha. */
  them: Partial<Record<GiaiDoanId, number>>;
}

export const BAN_SAC_MAP: Readonly<Record<number, readonly NhipHoi[]>> = {
  // 12 — MỘT CÚ XOAY CHIỀU: gây đà → xoay → hậu xoay.
  12: [
    { den: 5000, them: { tang: 800 } },
    { den: 7500, them: { bien_dong: 700, giam: 800, tang: -500 } },
    { den: 10000, them: { giam: 400, phuc_hoi: 600 } },
  ],
  // 16 — TRỌN CUNG: gầy dựng → phồng → sập → gây dựng lại.
  16: [
    { den: 3000, them: { tang: 700, di_ngang: 200 } },
    { den: 6000, them: { tang: 1100, giam: -400 } },
    { den: 8200, them: { giam: 1000, bien_dong: 700, tang: -700 } },
    { den: 10000, them: { phuc_hoi: 900, tang: 400, giam: -300 } },
  ],
} as const;

/**
 * Độ nghiêng hồi cho (cỡ map, ô thứ i [0-based], pha). 0 khi cỡ map không có
 * kịch bản (map 8) — đường về 0 là đường byte-hệt.
 * `BAN_SAC_NHAN_BP` (dò được) nhân toàn cục: 0 = tắt hẳn, phải ra map y hệt
 * cờ tắt — bài test "cần gạt còn sống" dựa vào đúng tính chất đó (D58).
 */
export function banSacBp(size: number, i: number, pha: GiaiDoanId): number {
  const kichBan = BAN_SAC_MAP[size];
  if (!kichBan) return 0;
  const tienDo = Math.floor(((i + 1) * 10000) / size);
  const hoi = kichBan.find((h) => tienDo <= h.den) ?? kichBan[kichBan.length - 1]!;
  const goc = hoi.them[pha] ?? 0;
  return Math.floor((goc * doThamSo('BAN_SAC_NHAN_BP', 10000)) / 10000);
}

export const QUAN_TINH = {
  /** Số ô pha cùng hướng tối thiểu để thành CHUỖI (xu hướng đã xác nhận). */
  NGUONG_CHUOI: 2,
  /**
   * ⭐ Cộng vào pha TIẾP DIỄN của chuỗi — con số quan trọng nhất.
   *
   * MỞ DÒ 11/08 (mặc định không đổi). Chính docstring dưới §5.3 gọi nó là
   * "con số quan trọng nhất", và D58 xếp nó vào nhóm cần gạt cân bằng — nhưng
   * nó là SỐ CỨNG, tức chưa ai từng đo được nó làm gì. Repo đã dính bốn lần
   * cùng một bẫy: hằng số cứng thì mọi phép dò trên nó là PHÉP RỖNG, và phép
   * rỗng thì in ra một bảng số đẹp chứ không im lặng.
   *
   * Nó là kênh TÍCH LUỸ THEO VÒNG duy nhất còn lại chưa loại trừ trong việc
   * truy vì sao cỡ map lật DẤU của G4 (map 8 đúng chiều, map 12/16 ngược) —
   * map dài thì chuỗi có chỗ mà dài, nên nghi phạm hợp lý nhất.
   */
  TU_LAP_BP: doThamSo('QUAN_TINH_TU_LAP_BP', 3500),
  /** ⭐ Chuỗi giảm kéo thêm biến động mạnh. */
  KEM_BIEN_DONG_BP: 1500,
  /** Phục hồi chỉ mở sau chuỗi Giảm dài ≥ N ô. */
  PHUC_HOI_SAU_GIAM_O: 2,
} as const;

/**
 * D43 BƯỚC 4 — SỨC CĂNG (03-chu-ky-tin-dung §5). "Thắng đậm thua đau" có nền:
 * cái gì bị kéo căng nhất thì gãy trước, và gãy ĐAU NHẤT đúng lúc đông người
 * ôm nhất — 1929, dot-com, 2008 đều một khuôn.
 *
 * KIẾN TRÚC HAI TẦNG (ghi ở doc 03 §5): S_MAP tính thuần từ chuỗi ô trong
 * `sinhMap` — quyết HAZARD mặt Giảm, nên bộ bài vẫn cố định lúc tạo trận và
 * phép đếm bài 16.8 sống nguyên. CROWDING (tỷ lệ bàn đang ôm mã — chân phản
 * thân C4) chỉ cộng vào tầng ĐỘ LỚN lúc chốt phiên — tất định từ state, replay
 * nguyên, không đụng mặt thẻ.
 *
 * BẤT BIẾN "EV PHẲNG, PHƯƠNG SAI NỔ": vế tốt nhân nhẹ, vế xấu nhân nặng
 * (XAU > TOT), cú nổ tỉ lệ S lúc nổ. Đu đỉnh không cần âm EV — nó bị phạt qua
 * rủi ro phá sản. KHÔNG đọc la_tin_gia ở bất kỳ chân nào (bẫy D39).
 *
 * ⭐ TOÀN BỘ số dưới đây agent đặt + DÒ bằng gate 7.2/7.3 + Kelly re-run
 * (A8.2 — hình dạng là tiêu chí, không phải một con số): đã dò HS_XAU_BP
 * 10000→20000 và CROWD_BP 1000→1500 trước khi chốt, xem doc 03 §7.
 */
export const SUC_CANG = {
  /** Nạp mỗi ô pha THUẬN hướng lên cho mã (bp). */
  NAP_BP: 600,
  /** Xả DẦN mỗi ô trung tính — phân phối reset, sức căng thì KHÔNG về 0 ngay. */
  XA_BP: 300,
  /** Pha giảm xì hơi nhanh (bp/ô). */
  XA_GIAM_BP: 900,
  /** Sự kiện XẤU thật giáng vào mã → giải phóng phần này của S (bp của S). */
  GIAI_PHONG_BP: 6667,
  /** Hệ số tốc độ nạp theo thanh khoản — sổ mỏng căng nhanh (BTC thật). */
  HS_THANH_KHOAN_BP: { mong: 15000, vua: 10000, day: 7500 } as Record<string, number>,
  /** Sau HẠ lãi suất THẬT: nạp ×2 trong N ô — tiền rẻ thổi giá. */
  NOI_LONG_X_BP: 20000,
  NOI_LONG_O: 3,
  /** Lan sang mã cùng nhóm tương quan, chiết khấu (bp của phần nạp). */
  LAN_BP: 3000,
  /** Trần S mỗi mã (bp). */
  TRAN_BP: 6000,
  /** Hazard: trọng số mặt Giảm += S_max × hệ số này / 10000. */
  HAZARD_BP: 5000,
  /** Độ lớn: vế TỐT ×(1 + S×TOT/1e8) · vế XẤU ×(1 + S×XAU/1e8) — xấu gấp đôi+. */
  HS_TOT_BP: 10000,
  HS_XAU_BP: 35000,
  /** Crowding: cả bàn cùng ôm một mã → +CROWD_BP vào S ở tầng độ lớn. */
  CROWD_BP: 3000,
  /** Ba dải công bố (Q2 founder: 3 dải) — ranh dưới của "căng" và "rất căng". */
  DAI_CANG_BP: 2000,
  DAI_RAT_CANG_BP: 4000,
} as const;

/**
 * D43 BƯỚC 6 — BA THAM SỐ CHU KỲ MỖI MAP (03 §5.6): dot-com, 2008, 2015, 2020
 * khác nhau ở TỐC ĐỘ / BIÊN ĐỘ / ĐỘ BẤT ĐỐI XỨNG, không ở "loại sự kiện". Rút
 * từ seed lúc sinh map, PHÂN PHỐI công khai (đều — bách khoa), realization
 * CÔNG BỐ ĐẦU TRẬN ("Bối cảnh: thị trường nhanh, biên độ lớn") — 8.2.
 * ⭐ Số agent đặt chờ MC; gate 7.9 đo hình dạng map phải phân tán rõ.
 */
export const CHU_KY = {
  /** TỐC ĐỘ (chậm·vừa·nhanh) — nhân vào quán tính TU_LAP: chậm = regime lì.
   * Doãng 13/10/7 → 16/10/5 sau lần đo đầu: chênh autocorr 0,023 < gate 0,04. */
  QUAN_TINH_BP: [16000, 10000, 5000],
  /** BIÊN ĐỘ (nhỏ·vừa·lớn) — nhân delta pha + echo lúc chốt phiên. */
  BIEN_DO_BP: [7500, 10000, 13000],
  /** BẤT ĐỐI XỨNG (nhẹ·gắt) — nhân THÊM vế xấu sau biên độ: sập gắt hơn tăng. */
  XAU_THEM_BP: [10000, 13000],
  /**
   * §4.3 — lãi suất NGOÀI lịch là telegraph của thẻ ĐUÔI: ~75% báo thật (ép
   * một ô thiên nga trong 2–3 ô tới), còn lại báo động giả tự nhiên — cắt khẩn
   * mà không có gì gãy. Fed 03/03/2020 cắt TRƯỚC khi sập: ngân hàng TW thấy
   * thứ thị trường chưa thấy.
   */
  TELEGRAPH_TIN_CAY_BP: 7500,
} as const;

/**
 * DOC 05 — BÁN KHỐNG = CHIỀU LỆNH THỨ BA (founder 01/08, v17). Đặc quyền lá
 * `ban_khong` đổi hình: thay short-khớp-trễ-1-vòng (D37 §2.5) bằng hàng KHỐNG
 * trong panel mốc — mở bằng tiền mặt (ký quỹ), mã rơi thì ký quỹ nở, mã tăng
 * thì ký quỹ teo về 0 là cháy lệnh (lãi có trần theo ký quỹ, lỗ chặn ở ký quỹ
 * — đúng phân vai D37: khống là VỊ THẾ ĐỘC LẬP, Phòng Hộ là BẢO HIỂM).
 *
 * ⭐ Cả ba số chờ đo (A8.2). Vé-một-chiều (khống hưởng khuếch đại sức căng khi
 * mã sập) kiểm bằng gate Kelly + bot đu-khống TRƯỚC khi flip — phí giữ mỗi
 * vòng và trần là hai van hãm chính.
 */
export const BAN_KHONG_LENH = {
  /** Trần TỔNG ký quỹ khống so NAV (bp). */
  TRAN_BP: 3000,
  /** Phí giữ khống mỗi vòng trên từng vị thế (bp) — funding, vào Quỹ vòng. */
  PHI_GIU_BP: 150,
} as const;

// ---------------------------------------------------------------------------
// MA TRẬN TƯƠNG TÁC — D24 mục 16.5. Đơn vị: bp lợi suất nền mỗi vòng.
// Dấu theo spec; ĐỘ LỚN là placeholder chờ Monte Carlo (mục 16.10).
// ---------------------------------------------------------------------------

/**
 * Tài sản × Giai đoạn (bp).
 *
 * ⚠ HAI LẦN HIỆU CHỈNH ĐO ĐƯỢC 20/07/2026, ghi lại để đừng "tối ưu" ngược:
 *
 * (1) TÍN HIỆU ×3. Bản đầu để ±200/±400 trong khi nhiễu một vòng của BTC đã
 *     ±900 → tỷ lệ tín hiệu/nhiễu 0,44, tức ĐỌC ĐÚNG THỊ TRƯỜNG VÔ DỤNG. Bot
 *     "biết trước" xếp gần bét, gate gradient sập. Đây đúng lớp lỗi GĐ4.5 đã
 *     dính (xem nhật ký D-log 19/07) — nếu ai đó hạ lại biên độ, gate sẽ đỏ
 *     lại y hệt.
 *
 * (2) PHÒNG THỦ PHẢI CÓ GIÁ (lever D20). Bản đầu cho trú ẩn = 0 ở Đi ngang —
 *     tức giữ trú ẩn là miễn phí, mà 4/5 sự kiện lại là tin xấu (có lợi cho
 *     trú ẩn), nên "Phòng thủ" thắng 47% và chạy trốn khỏi phần còn lại. Nay
 *     trú ẩn chịu hao hụt ổn định ở giai đoạn êm — đúng lever founder đã chốt
 *     trong nợ tinh chỉnh v0.4.5 ("tiền mặt phải CÓ GIÁ").
 */
export const MT_TAI_SAN_GIAI_DOAN: Record<string, Record<GiaiDoanId, number>> = {
  btc:   { tang: 1200, giam: -1200, di_ngang:    0, bien_dong:  600, phuc_hoi: 1200 },
  cp_cn: { tang: 1200, giam:  -600, di_ngang:    0, bien_dong: -600, phuc_hoi:  600 },
  vn30:  { tang:  600, giam:  -600, di_ngang:  600, bien_dong:    0, phuc_hoi:  600 },
  vang:  { tang: -600, giam:   600, di_ngang: -600, bien_dong: 1200, phuc_hoi: -600 },
  usd:   { tang: -600, giam:   600, di_ngang: -600, bien_dong:  600, phuc_hoi: -600 },
  tpcp:  { tang:    0, giam:   600, di_ngang: -300, bien_dong:    0, phuc_hoi:    0 },
};

/**
 * DẢI ĐỊNH TÍNH — dịch bp thành MỨC ĐỘ, không phải con số.
 *
 * ⚠ Founder bác cách làm cũ 25/07: tờ giải thích của nút (!) hiện +/- % CHÍNH XÁC
 * cho từng tài sản × giai đoạn. Nguyên văn: "M cho hiện thị hết ra rõ ràng +/-
 * bao nhiêu % thì game sẽ bị dễ đoán và nhanh chán."
 *
 * Đúng. Bảng số chính xác biến trò chơi thành bài toán tra bảng: người chơi mở
 * (!) ra, cộng nhẩm, và không còn gì để ĐỌC THỊ TRƯỜNG nữa. Mà đọc thị trường là
 * thứ duy nhất mode này muốn đo (A1 — dữ liệu hành vi mới là sản phẩm).
 *
 * Nên (!) chỉ nói MỨC: rất khoẻ / khoẻ / trung tính / yếu / rất yếu. Đủ để học
 * hình dạng của lá bài, không đủ để tính chính xác kết quả vòng.
 *
 * ⚠ Và phải cắt Ở TẦNG SERVER, không phải ở tầng render: bp lọt vào payload thì
 * F12 vẫn moi ra được, tức là người chịu khó vẫn có bảng tra còn người thường
 * thì không — tệ hơn cả việc hiện cho mọi người.
 *
 * Hai thang khác nhau vì hai bảng khác biên độ: giai đoạn ±1200, sự kiện ±2400.
 */
export const DAI_DINH_TINH = {
  GIAI_DOAN: { MANH: 900, NHE: 300 },
  SU_KIEN: { MANH: 1800, NHE: 600 },
} as const;

/** Mức định tính của một ô ma trận. Thứ tự: tốt → xấu. */
export type MucDinhTinh = 'rat_tot' | 'tot' | 'trung_tinh' | 'xau' | 'rat_xau';

/** bp → mức. Hàm THUẦN, dùng chung server ↔ test. */
export function mucDinhTinh(
  bp: number, thang: 'GIAI_DOAN' | 'SU_KIEN',
): MucDinhTinh {
  const { MANH, NHE } = DAI_DINH_TINH[thang];
  if (bp >= MANH) return 'rat_tot';
  if (bp >= NHE) return 'tot';
  if (bp > -NHE) return 'trung_tinh';
  if (bp > -MANH) return 'xau';
  return 'rat_xau';
}

/** Tài sản × Sự kiện — ECHO ngay vòng sự kiện nổ (D24 mục 17.1a). */
export const MT_TAI_SAN_SU_KIEN: Record<string, Record<SuKienId, number>> = {
  btc:   { ha_lai_suat: 2400, tang_lai_suat: -1800, hack_san: -2400, thien_nga_den: -1800, lam_phat:  1200, chien_tranh: -1200, bong_bong:  2400, phap_ly: -1800, pha_san: -1800, cam_van: -1200, tham_hoa:  -300, dich_benh: -2100 },
  cp_cn: { ha_lai_suat: 2400, tang_lai_suat: -1800, hack_san:     0, thien_nga_den: -1800, lam_phat:  600, chien_tranh: -1800, bong_bong:  2400, phap_ly:  -600, pha_san: -1500, cam_van: -1200, tham_hoa:  -600, dich_benh: -2100 },
  vn30:  { ha_lai_suat:  1800, tang_lai_suat: -1200, hack_san:     0, thien_nga_den: -1800, lam_phat:  600, chien_tranh: -1800, bong_bong:  1800, phap_ly:  -300, pha_san: -1500, cam_van:  -900, tham_hoa: -1500, dich_benh: -1800 },
  vang:  { ha_lai_suat:  600, tang_lai_suat: -1200, hack_san:   1800, thien_nga_den:  1800, lam_phat:  1200, chien_tranh:  2400, bong_bong: -1200, phap_ly:   900, pha_san:  -900, cam_van:  2400, tham_hoa:   900, dich_benh:  2400 },
  usd:   { ha_lai_suat: -1200, tang_lai_suat:  1800, hack_san:   1200, thien_nga_den:  1800, lam_phat:  600, chien_tranh:  1800, bong_bong: -600, phap_ly:   900, pha_san:  2400, cam_van:  1800, tham_hoa:   600, dich_benh:  1800 },
  tpcp:  { ha_lai_suat:  1800, tang_lai_suat: -1800, hack_san:   600, thien_nga_den:  1200, lam_phat: -1800, chien_tranh:  1200, bong_bong: -1200, phap_ly:   600, pha_san:  1200, cam_van:  -600, tham_hoa:   300, dich_benh:  3000 },
};

/**
 * ═══ LỚP VN (D307, cổng `lopVn` — balance-v41-lopvn) ═══════════════════════════
 *
 * Founder 07/09: *"data phải thu là từ thị trường VN chứ vì chúng ta đang làm phiên bản
 * ở thị trường VN mà… Hoặc ko thì bạn phải đổi tên lại khá nhiều thứ để tránh hiểu lầm
 * đấy, và tác động của sự kiện lên thị trường nữa."* Rồi 08/09: *"nếu dùng A thì có lo bị
 * vặn 'dữ liệu này ở đâu' không? Kiểu chúng ta sẽ phải gộp rất cẩn thận và có toán học
 * chống lưng thì mới gộp được."* → *"Làm đi. Chốt thiết kế mới, thực thi."*
 *
 * Toàn văn nguồn + bảng từng ô: `docs/thiet-ke-de-xuat/gameplay/lop-vn-nguon-va-gop.md`.
 *
 * ─── CÔNG THỨC GỘP (một dòng, kiểm được bằng tay) ─────────────────────────────
 *
 *   ô_mới = lamTron300( kep( g + w × (K × r_VN − g) ) )
 *
 *   · `g`     — ô ĐANG CHẠY ở v40 (bộ số đã qua gate 12.000×3). Đây là TIÊN NGHIỆM,
 *               không phải "số bịa": nó là bộ toàn cầu + MC-tune đã đứng được.
 *   · `r_VN`  — lợi suất THẬT 6 tháng của mã đó ở trạng thái đó, từ dữ liệu VN
 *               (VN-Index/VN30 · vàng SJC · USD/VND · lợi suất TPCP · quyết định NHNN).
 *   · `K`     — HẰNG NÉN THANG CHƠI = 0,55. ⚠ KHÔNG PHẢI TỪ DỮ LIỆU. Ma trận là
 *               TÍN HIỆU trên nền nhiễu (xem docstring `MT_TAI_SAN_GIAI_DOAN`:
 *               "TÍN HIỆU ×3"), nên thang tuyệt đối là hằng số chơi được, đã gate.
 *               Chọn 0,55 để cú bear sâu nhất của VN (−16,3%/ô) rơi đúng vào dải
 *               "rất xấu" (−900) và chừa trần ±1200 cho mã còn dữ dội hơn (BTC, CP CN).
 *   · `w`     — TRỌNG SỐ CO RÚT = n/(n+4), n = SỐ QUAN SÁT VN của chính ô đó.
 *               Đây là partial pooling (James–Stein / empirical Bayes) ở dạng đơn giản
 *               nhất: mẫu VN càng dày thì kéo càng mạnh, mẫu mỏng thì gần như không
 *               nhúc nhích. k = 4 = số đợt bear trọn vẹn VN có sổ (2008 · 2011 · 2018 ·
 *               2022) — tức "tiên nghiệm toàn cầu đáng giá bằng 4 quan sát VN".
 *               ⚠ k LÀ MỘT LỰA CHỌN, không phải số đo. Khai ở đây để ai vặn thì vặn
 *               đúng chỗ; đổi k = đổi một số, đo lại bằng cùng một lệnh.
 *   · `kep`   — trần biên độ giữ nguyên v40: |giai đoạn| ≤ 1200, |sự kiện| ≤ 2400.
 *   · LEVER D20 (đè lên kết quả, khai riêng): mã TRÚ ẨN (vàng · USD · TPCP) không được
 *               dương ở `tang`/`phuc_hoi` — "phòng thủ phải CÓ GIÁ", nếu không thì
 *               archetype Phòng thủ chạy trốn (đã đo 20/07, thắng 47%). Ô nào bị lever
 *               chặn thì bảng trong doc đánh dấu ⛔ — dữ liệu ĐỀ NGHỊ, lever CHẶN, cả
 *               hai đều nhìn thấy.
 *
 * ─── VÌ SAO KHÔNG LẤY THẲNG SỐ VN (w = 1) ─────────────────────────────────────
 * Vì mẫu VN mỏng: thị trường mở 2000, có 4 đợt bear và ~2 đợt lạm phát. Lấy thẳng là
 * khớp một lịch sử 25 năm rồi gọi đó là quy luật — đúng cái "game dạy vớ vẩn" theo
 * chiều ngược lại. Co rút giữ được cả hai: nơi VN có mẫu dày thì VN thắng, nơi VN
 * không có mẫu (BTC · chiến tranh · cấm vận · thảm hoạ) thì w = 0 và ô KHÔNG đổi
 * một bp nào — và doc nói thẳng là không đổi vì không có dữ liệu.
 */

/** Tài sản × Giai đoạn — bộ VN (D307). Ô nào không đổi = w·(K·r − g) < nửa bước lưới. */
export const MT_TAI_SAN_GIAI_DOAN_VN: Record<string, Record<GiaiDoanId, number>> = {
  // BTC: w = 0 ở MỌI ô — không có "BTC của VN", chỉ có một thị trường toàn cầu. Giữ nguyên.
  btc:   { tang: 1200, giam: -1200, di_ngang:    0, bien_dong:  600, phuc_hoi: 1200 },
  // CP công nghệ: beta ≈ 1,4 so VN30 (FPT/CMG dẫn dắt 2019–2024). Bear sâu hơn, bull dịu hơn.
  cp_cn: { tang:  900, giam:  -900, di_ngang:    0, bien_dong: -300, phuc_hoi:  900 },
  // VN30: bull VN +18,5%/năm (12 năm dương) · bear −30%/năm (5 năm âm) ⇒ BẤT ĐỐI XỨNG thật.
  vn30:  { tang:  600, giam:  -900, di_ngang:  300, bien_dong:    0, phuc_hoi:  600 },
  // Vàng SJC: che được ~1/3 cú rơi cổ phiếu (bear VN +11%/năm vs cổ phiếu −30%), KHÔNG phải 1:1.
  vang:  { tang: -300, giam:   300, di_ngang: -300, bien_dong: 1200, phuc_hoi: -300 },
  // USD/VND: NHNN neo tỷ giá ⇒ trú ẩn RẤT ĐÁNG TIN VỀ HƯỚNG nhưng nhỏ về độ lớn (+6,8%/năm bear).
  usd:   { tang: -300, giam:   300, di_ngang: -300, bien_dong:  600, phuc_hoi: -300 },
  // TPCP: ⭐ khác Mỹ nhất. Bear VN đi kèm SIẾT LÃI (2008 · 2011 · 2022) nên trái phiếu rơi THEO
  // cổ phiếu, không phải nơi trú. 2022 lợi suất 10 năm +270bp ⇒ giá −19%.
  tpcp:  { tang:    0, giam:   300, di_ngang:    0, bien_dong:    0, phuc_hoi:    0 },
};

/**
 * Tài sản × Sự kiện — bộ VN (D307).
 *
 * CHỈ 4 sự kiện có mẫu VN đủ để kéo: `tang_lai_suat` · `ha_lai_suat` (quyết định NHNN
 * 2008 · 2011 · 2012 · 2020 · 2022 · 2023) · `lam_phat` (CPI 23% năm 2008, 18,6% năm
 * 2011) · `dich_benh` (COVID 2020). Tám sự kiện còn lại **w = 0, giữ nguyên bộ toàn
 * cầu** vì thị trường VN từ 2000 chưa có mẫu: chiến tranh · cấm vận · thảm hoạ · thiên
 * nga đen (đã nằm trong dịch bệnh) · hack sàn (chưa sàn VN nào bị) · phá sản · pháp lý ·
 * bong bóng (n = 1–2, w ≤ 0,33 ⇒ kéo chưa tới nửa bước lưới, ô đứng yên).
 */
export const MT_TAI_SAN_SU_KIEN_VN: Record<string, Record<SuKienId, number>> = {
  btc:   { ha_lai_suat: 2400, tang_lai_suat: -1800, hack_san: -2400, thien_nga_den: -1800, lam_phat:  1200, chien_tranh: -1200, bong_bong:  2400, phap_ly: -1800, pha_san: -1800, cam_van: -1200, tham_hoa:  -300, dich_benh: -2100 },
  cp_cn: { ha_lai_suat: 2100, tang_lai_suat: -2100, hack_san:     0, thien_nga_den: -1800, lam_phat:     0, chien_tranh: -1800, bong_bong:  2400, phap_ly:  -600, pha_san: -1500, cam_van: -1200, tham_hoa:  -600, dich_benh: -2100 },
  vn30:  { ha_lai_suat: 1500, tang_lai_suat: -1500, hack_san:     0, thien_nga_den: -1800, lam_phat:     0, chien_tranh: -1800, bong_bong:  1800, phap_ly:  -300, pha_san: -1500, cam_van:  -900, tham_hoa: -1500, dich_benh: -1800 },
  vang:  { ha_lai_suat:  600, tang_lai_suat:  -300, hack_san:  1800, thien_nga_den:  1800, lam_phat:   900, chien_tranh:  2400, bong_bong: -1200, phap_ly:   900, pha_san:  -900, cam_van:  2400, tham_hoa:   900, dich_benh:  2100 },
  usd:   { ha_lai_suat: -600, tang_lai_suat:  1200, hack_san:  1200, thien_nga_den:  1800, lam_phat:   600, chien_tranh:  1800, bong_bong:  -600, phap_ly:   900, pha_san:  2400, cam_van:  1800, tham_hoa:   600, dich_benh:  1500 },
  tpcp:  { ha_lai_suat: 1200, tang_lai_suat: -1500, hack_san:   600, thien_nga_den:  1200, lam_phat: -1500, chien_tranh:  1200, bong_bong: -1200, phap_ly:   600, pha_san:  1200, cam_van:  -600, tham_hoa:   300, dich_benh:  2400 },
};

/*
 * ═══ BỘ TÀI SẢN v2 (D311, cổng `taiSanV42` — balance-v42-taisan) ══════════════
 *
 * D310 đổi TÊN bốn lá mà cố ý KHÔNG đụng một con số nào. Đây là phần số của ba lá
 * mà cái tên mới tả một VẬT KHÁC, nên hàng cũ thôi đúng:
 *
 *   `cp_cn`  CP Công nghệ  → **CP Chứng khoán**  (vẫn là mã VN, nhưng beta khác)
 *   `usd`    USD           → **USDT**            (thêm rủi ro MẤT NEO của stablecoin)
 *   `tpcp`   Trái phiếu CP → **Trái phiếu Mỹ**   (thôi là tài sản VN; và tách coupon)
 *
 * Ba lá còn lại (`btc` Crypto · `vn30` · `vang`) chép nguyên v41 — tên đổi nhưng vật
 * không đổi, nên không có lý do gì để số đổi.
 *
 * ⚠ HAI CHỖ KHÁC HẲN CÁCH LÀM CỦA v41, khai ra vì nó phá quy tắc gộp của D307:
 *
 * 1. **`tpcp` KHÔNG lấy tiên nghiệm v41, lấy v40.** Gộp co rút của D307 kéo hàng TPCP
 *    theo lợi suất trái phiếu chính phủ VIỆT NAM (bear VN đi kèm siết lãi ⇒ TPCP thôi
 *    trú ẩn). Lá này nay là trái phiếu **Mỹ**, nên mọi mẫu VN có `w = 0` theo đúng luật
 *    "không có mẫu thì không kéo" — tức phải QUAY VỀ tiên nghiệm toàn cầu v40 rồi mới
 *    suy tiếp. Giữ hàng v41 ở đây là gán hành vi trái phiếu VN cho trái phiếu Mỹ.
 *
 * 2. **Hàng `tpcp` là GIÁ-THUẦN.** Carry (+2%/ô, `lop-vn-nguon-va-gop.md` §3.4) trước
 *    nay gói trong ma trận vì không mã nào trả dòng tiền. Từ v42 `couponTpcp` trả lãi
 *    vào TIỀN MẶT mỗi ô, nên carry phải rút khỏi ma trận — để lại là **trả lãi hai lần**.
 *    Carry là hằng số mỗi ô, không theo trạng thái, và ô SỰ KIỆN cũng ăn cột `di_ngang`
 *    của ma trận pha (`engine.ts` `dungChuoi`: `o.kind === 'giai_doan' ? … : 'di_ngang'`)
 *    ⇒ rút đúng một lần ở HÀNG PHA là rút đủ cho mọi loại ô. Hàng sự kiện không đụng:
 *    sự kiện là cú SỐC chồng lên, không chở carry.
 *
 * ⚠ MỌI SỐ Ở ĐÂY LÀ ⭐ MC-TUNE (A8.2) — founder duyệt HÌNH DẠNG ở D312, chưa duyệt số.
 * Nguồn + suy từng ô + chỗ tôi tính khác điểm khởi đầu của yêu cầu 08:
 * `docs/thiet-ke-de-xuat/gameplay/tai-san-v42-nguon-va-quy-doi.md`.
 */
export const MT_TAI_SAN_GIAI_DOAN_V42: Record<string, Record<GiaiDoanId, number>> = {
  btc:   { tang: 1200, giam: -1200, di_ngang:    0, bien_dong:  600, phuc_hoi: 1200 },
  // CTCK: doanh thu = phí môi giới + lãi margin ⇒ đòn bẩy trên THANH KHOẢN, không chỉ
  // trên chỉ số. 2021 VN-Index +35,7% mà nhóm CTCK ~+190%; 2022 index −32,8%, nhóm ~−63%.
  cp_cn: { tang: 1200, giam: -1200, di_ngang:    0, bien_dong: -600, phuc_hoi: 1200 },
  vn30:  { tang:  600, giam:  -900, di_ngang:  300, bien_dong:    0, phuc_hoi:  600 },
  vang:  { tang: -300, giam:   300, di_ngang: -300, bien_dong: 1200, phuc_hoi: -300 },
  // USDT: nền vẫn là USD/VND (tỷ giá neo) — hàng pha giữ nguyên v41. Rủi ro riêng của
  // stablecoin là RỜI RẠC (mất neo), nên nó nằm ở hàng SỰ KIỆN, không ở hàng pha.
  usd:   { tang: -300, giam:   300, di_ngang: -300, bien_dong:  600, phuc_hoi: -300 },
  /*
   * Trái phiếu Mỹ, GIÁ-THUẦN. Suy từ lợi suất chỉ số US Treasury theo pha, quy về
   * 6 tháng rồi × K = 0,55 × 100 (cùng phép của D307), làm tròn lưới 300:
   *   giam      +8,75%/6th (TB bốn đợt suy thoái có sổ: 2002 · 2008 · 2011 · 2020) → +481 → +600
   *   bien_dong +4,5% (Δlợi suất −60bp × duration 7,5)                             → +248 → +300
   *   phuc_hoi  −3,0% (lợi suất bò lên khi tăng trưởng về)                          → −165 → −300
   *   di_ngang  ~0                                                                  →    0
   *   tang      −2,25% → −124 → làm tròn ra 0, nhưng ⛔ LEVER D20 ép xuống −300:
   *             trú ẩn không được LỜI ở pha risk-on, mà lever đọc TỔNG giá + coupon
   *             (0 + 200 > 0 là phạm). −300 + 200 = −100 ✔.
   * ⚠ Yêu cầu 08 đề xuất khởi điểm (−300, 900, 0, 600, −300) — tôi tính ra NHẸ HƠN ở
   * `giam` và `bien_dong`. Chênh lệch này trình founder, xem §5b của sổ nguồn v42.
   */
  tpcp:  { tang: -300, giam:   600, di_ngang:    0, bien_dong:  300, phuc_hoi: -300 },
};

/**
 * D560 — CHU KỲ CÓ NGÒI (cổng `chuKyCoNgoi`, khoá v64). Founder 08/10: lá QUÁ NÓNG (art D393, mùa `bien_dong` của bánh xe) phải chạy như
 * *"1 chu kỳ tăng cuối"* — bảng V42 còn để hàng `bien_dong` là "Biến động mạnh" kiểu trú ẩn (CP −6 %, Vàng +12 %): lá vẽ nhiệt kế chạm đỉnh
 * mà giá chạy như hoảng loạn. Hàng mới: tài sản rủi ro còn nhích (đà cuối), trú ẩn KHÔNG lời ở pha risk-on (lever D20: trái phiếu −300 +
 * coupon 200 = −100; USDT như `tang`). Các hàng khác = V42 nguyên.
 * ⚠ A8.2 — PLAYTEST-TUNE, đo rồi founder chốt (SPEC `docs/spec/chu-ky-co-ngoi.md`).
 */
export const MT_TAI_SAN_GIAI_DOAN_V64: Record<string, Record<GiaiDoanId, number>> = Object.fromEntries(
  Object.entries(MT_TAI_SAN_GIAI_DOAN_V42).map(([ma, h]) => [ma, {
    ...h,
    bien_dong: ({ btc: 600, cp_cn: 600, vn30: 300, vang: 0, usd: -300, tpcp: -300 } as Record<string, number>)[ma] ?? h.bien_dong,
  }]),
);
/**
 * D560 — TÍNH CHẤT CỦA LÁ PHA ở khoá chu kỳ có ngòi: server suy từ mùa ẩn + đường vào mùa, client vẽ huy hiệu (cùng trường `tinh_chat` của ô
 * tin — D152/K1). Founder 08/10 (Wyckoff · Schwab "four stages" · phân loại bò/gấu):
 *   ĐI NGANG  — `tich_luy` (sau giảm, biên hẹp, thường phá lên) · `phan_phoi` (sau tăng, giật thất thường, thường phá xuống);
 *   TĂNG      — `dong_tien` (vào lúc tiền rẻ / vừa hạ lãi: gắt, ngắn, gãy khi siết) · `tang_truong` (mặc định: bền, dài);
 *   GIẢM      — `gau_su_kien` (sau cú sốc: rơi thảm, ngắn, hồi nhanh) · `gau_dinh_gia` (sau bong bóng: sâu ở tài sản rủi ro) ·
 *               `gau_chu_ky` (sau phân phối: từ từ, kéo tới khi tiền rẻ).
 */
export type TinhChatPha = 'tich_luy' | 'phan_phoi' | 'dong_tien' | 'tang_truong' | 'gau_su_kien' | 'gau_dinh_gia' | 'gau_chu_ky';
/**
 * D560 — KHOẢN LỆCH theo tính chất, CỘNG vào hàng của mặt lá (bp/ô, bảng `mtGiaiDoan('v64')`). Phân phối: rủi ro rỉ xuống, trú ẩn nhận
 * lại · Tích lũy: đi ngang thật · Bò dòng tiền: crypto/CP bay xa · Bò tăng trưởng: VN30 (lợi nhuận thật) dẫn · Gấu sự kiện: một ô rơi thảm ·
 * Gấu định giá: sâu ở chỗ từng phồng nhất · Gấu chu kỳ: hàng Giảm nguyên. ⚠ PLAYTEST-TUNE (A8.2) — đo rồi founder chốt.
 */
/*
 * Số đã nhân ×1,5 so với bản đầu (founder 08/10 chọn hướng A: *"tính chất mang nhiều thông tin hơn"* — "A. Làm luôn đi"). Gate 12.000 trận ·
 * 5 ghế · bàn 14 (`HOLDEM_TC_PHA_HE_BP`): ×1 G2 ✗ (oracle hơn chơi-được 0,25 · bấm bừa kém 0,21) · ×1,5 G1–G4 + G7 ✓ (0,29 · 0,34) · ×2 G1 ✗
 * (Đa dạng hoá trội 9,0). Nhân thêm nữa qua `HOLDEM_TC_PHA_HE_BP` (mặc định ×1 trên bảng này).
 */
export const TINH_CHAT_PHA_BP: Record<TinhChatPha, Record<string, number>> = {
  tich_luy: { btc: 0, cp_cn: 0, vn30: 0, vang: 0, usd: 0, tpcp: 0 },
  phan_phoi: { btc: -450, cp_cn: -450, vn30: -450, vang: 450, usd: 450, tpcp: 0 },
  dong_tien: { btc: 900, cp_cn: 900, vn30: 0, vang: 0, usd: 0, tpcp: 0 },
  tang_truong: { btc: -450, cp_cn: 0, vn30: 450, vang: 0, usd: 0, tpcp: 0 },
  gau_su_kien: { btc: -900, cp_cn: -900, vn30: -450, vang: 450, usd: 450, tpcp: 450 },
  gau_dinh_gia: { btc: -900, cp_cn: -900, vn30: 0, vang: 0, usd: 0, tpcp: 0 },
  gau_chu_ky: { btc: 0, cp_cn: 0, vn30: 0, vang: 0, usd: 0, tpcp: 0 },
};
/**
 * D560 — khoản lệch của tính chất `tc` cho mã `ma` (bp), qua HỆ SỐ đo được (`HOLDEM_TC_PHA_HE_BP`, 10000 = ×1). MỘT cửa cho engine và bot —
 * bot đọc bảng khác engine là gate đo chênh lệch hai bảng (lỗi `can_troi` v21↔v23). PLAYTEST-TUNE.
 */
export function lechTinhChatBp(tc: TinhChatPha, ma: string): number {
  return Math.trunc(((TINH_CHAT_PHA_BP[tc][ma] ?? 0) * doThamSo('TC_PHA_HE_BP', 10000)) / 10000);
}

export const MT_TAI_SAN_SU_KIEN_V42: Record<string, Record<SuKienId, number>> = {
  btc:   { ha_lai_suat: 2400, tang_lai_suat: -1800, hack_san: -2400, thien_nga_den: -1800, lam_phat:  1200, chien_tranh: -1200, bong_bong:  2400, phap_ly: -1800, pha_san: -1800, cam_van: -1200, tham_hoa:  -300, dich_benh: -2100 },
  // CTCK ăn đòn NẶNG hơn VN30 ở đúng ba chỗ: siết pháp lý (UBCKNN 2022 — thao túng, huỷ
  // lô trái phiếu) · sập sàn (mất phí môi giới lẫn tài sản trên sàn) · lạm phát (siết
  // margin). Bù lại hạ lãi/bong bóng thì nó bay xa nhất bàn.
  cp_cn: { ha_lai_suat: 2400, tang_lai_suat: -2400, hack_san:  -900, thien_nga_den: -2100, lam_phat:  -600, chien_tranh: -1800, bong_bong:  2400, phap_ly: -1500, pha_san: -1800, cam_van: -1200, tham_hoa:  -600, dich_benh: -2100 },
  vn30:  { ha_lai_suat: 1500, tang_lai_suat: -1500, hack_san:     0, thien_nga_den: -1800, lam_phat:     0, chien_tranh: -1800, bong_bong:  1800, phap_ly:  -300, pha_san: -1500, cam_van:  -900, tham_hoa: -1500, dich_benh: -1800 },
  vang:  { ha_lai_suat:  600, tang_lai_suat:  -300, hack_san:  1800, thien_nga_den:  1800, lam_phat:   900, chien_tranh:  2400, bong_bong: -1200, phap_ly:   900, pha_san:  -900, cam_van:  2400, tham_hoa:   900, dich_benh:  2100 },
  // ⭐ BA Ô ĐỔI DẤU so USD — đây là chỗ USDT KHÔNG phải đô la: nó là tờ giấy nợ của một
  // công ty, giữ trên một sàn. Sập sàn (+1200 → −900), siết pháp lý (+900 → −600), phá
  // sản dây chuyền (+2400 → −300): ba mặt tin mà đô la là nơi trú, còn stablecoin là nơi
  // NGƯỜI TA CHẠY KHỎI. Tiền lệ thật: USDC rời neo còn 0,878 khi SVB sập (03/2023);
  // USDT xuống 0,95 sau khi Luna vỡ (12/05/2022); NYAG phạt Tether 18,5 tr$ (2021).
  usd:   { ha_lai_suat: -600, tang_lai_suat:  1200, hack_san:  -900, thien_nga_den:  1800, lam_phat:   600, chien_tranh:  1800, bong_bong:  -600, phap_ly:  -600, pha_san:  -300, cam_van:  1800, tham_hoa:   600, dich_benh:  1500 },
  /*
   * Trái phiếu Mỹ — hàng này là BẢN SAO ĐÚNG NGUYÊN của v40, và đó là kết luận chứ
   * không phải sự lười.
   *
   * D307 kéo bốn ô của `tpcp` khỏi v40 bằng dữ liệu trái phiếu chính phủ VIỆT NAM
   * (`ha_lai_suat` 1800→1200 · `tang_lai_suat` −1800→−1500 · `lam_phat` −1800→−1500 ·
   * `dich_benh` 3000→2400). Lá này nay là trái phiếu MỸ ⇒ mọi mẫu VN có `w = 0` ⇒ theo
   * đúng luật gộp của D307 ("không có mẫu thì không kéo"), cả bốn ô phải TRẢ VỀ tiên
   * nghiệm toàn cầu. Tám ô còn lại v41 vốn đã không kéo.
   *
   * ⚠ Tôi KHÔNG tinh chỉnh thêm ô nào theo "cảm giác về trái phiếu Mỹ". Bản nháp đầu
   * có hạ `hack_san` 600→300, `chien_tranh` 1200→900, `bong_bong` −1200→−900,
   * `phap_ly` 600→300, `cam_van` −600→−300, `dich_benh` 3000→1500 — sáu ô, không ô nào
   * có nguồn. Bài `tai_san_v42.test.ts` §I bắt được đúng chỗ này: nó hỏi "ô nào v41 đã
   * kéo thì v42 có trả về chưa", và câu trả lời lộ ra rằng tôi vừa giữ v41 ở `ha_lai_suat`
   * vừa tự bịa ở sáu ô khác. Không nguồn thì không đổi (A8.2).
   */
  tpcp:  { ha_lai_suat: 1800, tang_lai_suat: -1800, hack_san:   600, thien_nga_den:  1200, lam_phat: -1800, chien_tranh:  1200, bong_bong: -1200, phap_ly:   600, pha_san:  1200, cam_van:  -600, tham_hoa:   300, dich_benh:  3000 },
};

/**
 * MỘT CỬA chọn ma trận — engine, bot, máy sinh map, từ điển và bảng điện tử PHẢI
 * đi qua đây.
 *
 * ⚠⚠ Đây là bài học `bangCanTroi` viết lại lần hai (rà 11/08): engine đổi bảng theo
 * cờ còn bot đọc thẳng hằng số ⇒ bot MUA theo bảng này rồi bị CHẤM bằng bảng kia, và
 * gate G1/G4 đo trên chênh lệch hai bảng chứ không đo kỹ năng. Cú trôi đó không bao
 * giờ ném lỗi. Có bài canh: `tests/lop_vn.test.ts` §IV quét mọi tệp server, cấm đọc
 * thẳng `MT_TAI_SAN_*` ngoài hai hàm này.
 */
/*
 * ─── D311 (08/09/2026) — TỪ BOOLEAN SANG THANG BẬC `BoMaTran` ────────────────
 *
 * Tới v42 thì bộ ma trận có BA đời (v40 toàn cầu · v41 lớp VN · v42 tài sản v2),
 * nên `lopVn: boolean` hết diễn tả nổi. Cách rẻ là thêm `taiSanV42: boolean` cạnh
 * nó — và đó đúng là cái bẫy tệp này đã trả giá hai lần: HAI BOOLEAN CẠNH NHAU
 * thì gọi nhầm thứ tự `f(lopVn, v42)` ↔ `f(v42, lopVn)` là trình biên dịch IM,
 * vì cả hai đều là `boolean`. Một thang bậc `'v40' | 'v41' | 'v42'` thì gọi sai
 * là ĐỎ ngay lúc biên dịch.
 *
 * Thứ tự ưu tiên v42 > v41 > v40 khớp quy ước xếp chồng của `BO_LUAT_THEO_PHIEN_BAN`
 * (bản mới mang mọi cờ cũ), nên trận v42 đọc bảng V42 dù `lop_vn` cũng đang bật.
 */
export type BoMaTran = 'v40' | 'v41' | 'v42' | 'v64';

/**
 * Trận này đọc bộ ma trận nào — suy từ CỜ ĐÃ ĐÓNG BĂNG TRÊN TRẠNG THÁI TRẬN,
 * không phải từ `HOLDEM_BALANCE_VERSION` hiện hành (trận cũ replay theo luật đã lưu).
 */
export function boMaTranCua(st: { lop_vn?: boolean; tai_san_v42?: boolean; chu_ky_co_ngoi?: boolean }): BoMaTran {
  // D560 — chu kỳ có ngòi: bảng V42 với hàng QUÁ NÓNG (`bien_dong`) là cuối mùa tăng. ĐÈ lên v42 (khoá v64 mang mọi cờ cũ).
  if (st.chu_ky_co_ngoi === true) return 'v64';
  if (st.tai_san_v42 === true) return 'v42';
  if (st.lop_vn === true) return 'v41';
  return 'v40';
}

export function mtGiaiDoan(bo: BoMaTran): Record<string, Record<GiaiDoanId, number>> {
  if (bo === 'v64') return MT_TAI_SAN_GIAI_DOAN_V64;
  if (bo === 'v42') return MT_TAI_SAN_GIAI_DOAN_V42;
  return bo === 'v41' ? MT_TAI_SAN_GIAI_DOAN_VN : MT_TAI_SAN_GIAI_DOAN;
}

export function mtSuKien(bo: BoMaTran): Record<string, Record<SuKienId, number>> {
  if (bo === 'v42' || bo === 'v64') return MT_TAI_SAN_SU_KIEN_V42;
  return bo === 'v41' ? MT_TAI_SAN_SU_KIEN_VN : MT_TAI_SAN_SU_KIEN;
}

// ---------------------------------------------------------------------------
// THẺ CHIẾN THUẬT — D24 mục 16.3. Hành vi TỰ ĐỘNG, không tham số tay ở mùa 1.
// ---------------------------------------------------------------------------

export type ChienThuatId =
  | 'mua_duoi' | 'luot_song' | 'bat_day' | 'chan_lo' | 'phong_ho'
  | 'don_bay' | 'ban_khong' | 'khop_nhanh' | 'chia_lenh' | 'da_dang_hoa'
  | 'di_nguoc';

/**
 * D3 — PHẠM VI CỦA MỘT THẺ CHIẾN THUẬT.
 *
 * Strategy Attachment gắn thẻ vào MỘT tài sản cụ thể (BTC+Đòn bẩy, Vàng+Bắt đáy…).
 * Nhưng KHÔNG PHẢI THẺ NÀO CŨNG GẮN ĐƯỢC, và ép hết là làm hỏng chính thẻ:
 *
 *   · `da_dang_hoa` thưởng theo SỐ MÃ KHÁC NHAU đang nắm — gắn vào một mã thì nó
 *     đếm cái gì?
 *   · `di_nguoc` xét vị thế của TOÀN danh mục so với lobby — gắn vào một mã là bỏ
 *     mất chính phép so đó.
 *
 * Nên thẻ có hai phạm vi, và `pham_vi` là thứ quyết định UI có hỏi "gắn vào đâu"
 * hay không. Ép cả hai thẻ trên vào khuôn attachment sẽ ra hai lá vô nghĩa — đúng
 * kiểu "ô chết" mà test cũ từng bắt được ở thẻ phòng thủ.
 */
export type PhamViThe = 'tai_san' | 'danh_muc';

export interface ChienThuat {
  id: ChienThuatId;
  /**
   * `tai_san` — gắn vào MỘT mã, chỉ tác động lên mã đó.
   * `danh_muc`  — tác động lên cả danh mục, KHÔNG gắn được.
   *
   * ⚠ KỂ TỪ 01/08 trường này KHÔNG còn quyết UI hỏi gắn — `ghim` mới quyết.
   * Nó Ở LẠI vì hai bộ lọc `gan` của holdem_api (nhận request + replay
   * action_log) tra nó, mà log cũ ĐÃ chứa bảng gắn của cả những lá nay thôi
   * hỏi (chan_lo, phong_ho…). Đổi giá trị ở đây là replay trận cũ rơi mất
   * pin → `heSoCap` đổi → kết quả đã lưu đổi. Món nợ D40 "pham_vi mô tả sai
   * vài lá" trả bằng `ghim`, không phải bằng sửa trường này.
   */
  pham_vi: PhamViThe;
  /**
   * Founder 01/08 — *"mấy cái lá chức năng đặc biệt tại sao sau khi chọn lõi
   * xong nó vẫn bắt phải áp vào 1 mã vậy? Nó là mã chức năng mà?"*
   *
   * `true` = UI hỏi "GẮN VÀO MÃ NÀO?" — CHỈ `don_bay` (nhân ×2 phần mã gắn,
   * đổi lại được mỗi vòng theo D40 "ghim không còn vĩnh viễn").
   *
   * ⚠ Bản đầu 01/08 gắn cả `chia_lenh` + `khop_nhanh` vì engine CÓ đọc `gan`
   * của chúng (trượt giá theo mã) — founder sửa 02/08: về THIẾT KẾ cả hai là
   * đặc quyền CÁ NHÂN (Chia Lệnh = quyền chia mốc mịn 5% — engine cấp theo
   * GHẾ; Khớp Nhanh = miễn/hoàn trượt giá + hoàn phí xếp hàng khớp lệnh của
   * CHÍNH MÌNH). Không ghim ⇒ `theAnVaoMa` áp MỌI mã đang cầm — đúng nghĩa
   * "hiệu ứng của người", và đúng hành vi trận trước D3 nên replay không đổi.
   * Mọi lá còn lại là đặc quyền chức năng, không có mã nào để áp.
   */
  ghim?: true;
  /** CHUỖI NGƯỜI CHƠI ĐỌC — D26.
   *  ⚠ 'chan_lo' cố ý KHÔNG đặt tên "Cắt lỗ": D26 đã dùng "Cắt lỗ" cho HÀNH
   *  ĐỘNG người chơi bỏ vòng (Fold). Thẻ này là hành vi TỰ ĐỘNG → "Chặn Lỗ". */
  label: string;
  icon: string;
  mo_ta: string;
}

/**
 * ⚠ LUẬT CHÚ THÍCH THẺ (founder 26/07): `mo_ta` ghi ĐẶC ĐIỂM NGOÀI ĐỜI, KHÔNG ghi
 * tác dụng trong game.
 *
 * Trước đó mọi chú thích đều là hiệu ứng game ("Chết ở thị trường đi ngang", "Nhân
 * đôi lãi VÀ lỗ"). Hai lý do phải đổi:
 *   1. TRÙNG LẶP — tờ (!) đã kể tác dụng trong game rồi, bằng MỨC ĐỊNH TÍNH đúng
 *      như founder yêu cầu. Chú thích lặp lại chỉ chiếm chỗ.
 *   2. ĐÓ MỚI LÀ SẢN PHẨM — app là nền tảng dữ liệu hành vi tài chính (A1). Thứ
 *      người chơi mang ra khỏi trận phải là "đòn bẩy ngoài đời là gì", không phải
 *      "lá này trong game ăn mấy bp". Tác dụng game thì chơi vài ván là biết.
 *
 * Nên chú thích CẤM nhắc: vòng, bàn, Vốn, cháy tài khoản, bp — đó là từ vựng của
 * trò chơi. `tests/holdem_mota.test.ts` canh.
 */
export const CHIEN_THUAT: readonly ChienThuat[] = [
  { id: 'mua_duoi',    pham_vi: 'tai_san', label: 'Mua Đuổi',      icon: '🚀', mo_ta: 'FOMO — mua vì thấy giá đang lên và sợ lỡ chuyến. Hành vi phổ biến nhất của nhà đầu tư mới, và là lý do đỉnh thường do chính đám đông tạo ra.' },
  { id: 'luot_song',   pham_vi: 'tai_san', label: 'Lướt Sóng',     icon: '🌊', mo_ta: 'Trend following — đặt cược rằng xu hướng đang chạy sẽ chạy tiếp. Các quỹ CTA quản lý hàng trăm tỷ đô bằng đúng nguyên tắc này.' },
  { id: 'bat_day',     pham_vi: 'tai_san', label: 'Bắt Đáy',       icon: '🩸', mo_ta: 'Mean reversion — tin rằng giá rơi quá đà rồi sẽ bật về mức trung bình. Đúng thường xuyên; sai thì sai rất đắt.' },
  { id: 'chan_lo',     pham_vi: 'tai_san', label: 'Chặn Lỗ',       icon: '🛡', mo_ta: 'Lệnh stop-loss — đặt sẵn mức tự bán để chặn thiệt hại. Là kỷ luật viết ra trước, thay cho quyết định lúc đang hoảng.' },
  { id: 'phong_ho',    pham_vi: 'tai_san', label: 'Phòng Hộ',      icon: '🔀', mo_ta: 'Hedge — mở thêm một vị thế ngược chiều để bớt biến động. Đúng nghĩa bảo hiểm: trả phí đều, đổi lấy việc không lãnh đòn quá nặng.' },
  { id: 'don_bay',     pham_vi: 'tai_san', ghim: true, label: 'Đòn Bẩy 2×',    icon: '🏋️', mo_ta: 'Vay tiền để đặt cược lớn hơn vốn mình có. Nhân cả lãi lẫn lỗ — đây là thứ khiến người ta mất nhiều hơn số đã bỏ vào.' },
  { id: 'ban_khong',   pham_vi: 'tai_san', label: 'Bán Khống',     icon: '📉', mo_ta: 'Short — mượn tài sản bán ra, chờ giá xuống rồi mua lại trả. Phần lãi có trần, phần lỗ thì không có đáy.' },
  { id: 'khop_nhanh',  pham_vi: 'tai_san', label: 'Khớp Nhanh',    icon: '⚡', mo_ta: 'Low latency — hạ tầng khớp lệnh nhanh hơn phần còn lại của thị trường. Cả ngành giao dịch tần suất cao dựng trên vài mili-giây.' },
  { id: 'chia_lenh',   pham_vi: 'tai_san', label: 'Chia Lệnh',     icon: '✂️', mo_ta: 'Chia một lệnh lớn thành nhiều lệnh nhỏ rải ra, để không tự đẩy giá chống lại mình. Lệnh càng to so với thanh khoản thì càng tự làm hại.' },
  { id: 'da_dang_hoa', pham_vi: 'danh_muc', label: 'Đa Dạng Hóa',   icon: '🎯', mo_ta: 'Không bỏ trứng vào một giỏ. Được gọi là bữa trưa miễn phí duy nhất của tài chính: giảm rủi ro mà không phải hy sinh lợi nhuận kỳ vọng tương ứng.' },
  /*
   * D5 — THẺ KHẮC CHẾ ĐÁM ĐÔNG (chỉ đạo founder 25/07: "không thể cân bằng tuyệt
   * đối nên hãy nghĩ cách thêm bài hay tính năng khắc chế").
   *
   * Vì sao là thẻ chứ không phải một khoản thuế nữa: sau D4, phe phòng thủ trội
   * (28,4%, cách á quân 4,2 — giãn gấp 6 lần trước đó). Cách "cân bằng" quen tay là
   * hạ số của phe thủ. Nhưng làm thế thì mọi mùa lại là một vòng vặn số, và người
   * chơi không có gì để LÀM với thông tin "cả bàn đang dồn". Một thẻ khắc chế biến
   * chính sự dồn cục ấy thành cơ hội đọc được — meta tự cân bằng bằng lựa chọn của
   * người chơi thay vì bằng bàn tay tôi.
   *
   * Khắc chế MỌI đám đông, không riêng phe thủ: đứng một mình thì được thưởng, đứng
   * chung với đa số thì bị phạt. Nên nó tự động chống lại bất cứ meta nào đang thắng.
   */
  { id: 'di_nguoc',    pham_vi: 'danh_muc', label: 'Đi Ngược',      icon: '🧭', mo_ta: 'Contrarian — mua thứ đám đông đang bỏ, bán thứ đám đông đang giành. Khó ở chỗ đám đông đúng phần lớn thời gian, chỉ sai ở các khúc ngoặt.' },
] as const;

/**
 * XUNG ĐỘT — D24 mục 16.5. Hai thẻ cùng danh mục trên CÙNG tài sản thì đánh
 * nhau → whipsaw → bào Vốn. Đây là cơ chế dạy-bằng-nỗi-đau mô phỏng overfitting,
 * và là engine cháy tài khoản của luật buộc-mua-≥1.
 */
export const XUNG_DOT: readonly (readonly [ChienThuatId, ChienThuatId])[] = [
  ['mua_duoi', 'chan_lo'],
  ['mua_duoi', 'ban_khong'],
  ['bat_day', 'luot_song'],
  ['ban_khong', 'luot_song'],
] as const;

/**
 * Founder 02/08 — "lỗi thừa UI-UX từ cũ: đã thay chức năng nhưng lúc pick
 * lướt sóng với bán khống (hoặc các cặp khác) lại hiện cảnh báo khắc chế dù
 * không còn liên quan". Đúng: bảng XUNG_DOT viết cho đời thẻ TRƯỚC đặc quyền
 * — nay Lướt Sóng là ĐẶC QUYỀN THÔNG TIN (Bảng điện tử sạch) và Bán Khống là
 * QUYỀN MỞ LỆNH, chúng không "giằng lệnh" với ai nữa. Ba cặp dính hai lá đó
 * GỠ sau cổng v19; giữ đúng cặp còn nghĩa thật: Mua Đuổi (đuổi đỉnh) ×
 * Chặn Lỗ (tự bán khi rơi) = whipsaw mua-đỉnh-bán-đáy.
 *
 * ⚠ BẢNG CŨ Ở TRÊN KHÔNG ĐƯỢC XOÁ: trận ≤ v18 replay bằng nó (phạt 250bp là
 * tiền thật đã tính). `bayShop` (pity) cũng CỐ Ý giữ bảng cũ — đổi bộ lọc là
 * đổi danh sách lá đã bày của trận cũ. CONG_HUONG chưa rà đợt này — ghi nợ.
 */
export const XUNG_DOT_V19: readonly (readonly [ChienThuatId, ChienThuatId])[] = [
  ['mua_duoi', 'chan_lo'],
] as const;

/**
 * ⚖ CÂN TRÔI KỲ VỌNG THEO MÃ (v21) — thi hành bất biến đã chốt của D43 §4.2:
 * **"EV phẳng, phương sai nổ"**.
 *
 * ─── VÌ SAO CẦN, ĐO ĐƯỢC 02/08 ────────────────────────────────────────────
 * Founder bắt trên prod: bot ôm BTC lên 2.373.620. Đo 400 seed, ghế ôm 100%
 * một mã suốt 8 vòng, KHÔNG giao dịch thêm:
 *      btc   trung vị ×1,47 · 70% số vòng TĂNG · p95 ×4,08
 *      vn30  ×1,39 · 68%          cp_cn ×1,17 · 59%      tpcp ×1,05 · 55%
 *      vang  ×0,64 · 35%          usd   ×0,39 · 29%
 * 70% vòng tăng KHÔNG phải chuỗi may — đó là đồng xu nghiêng sẵn: ôm bừa cũng
 * giàu, khỏi đọc tin. Và USD ×0,39 là cái bẫy ngược: mã "phòng thủ" mà cầm là
 * chết chắc. Cả hai phá gate G3 (gradient kỹ năng) lẫn bất biến trên.
 *
 * ─── VÌ SAO KHÔNG PHẢI TRẦN (founder bác đúng) ────────────────────────────
 * Founder: *"may mắn liên tục với xác suất cực nhỏ thì vẫn phải được lãi
 * khủng lồ và áp đảo chứ"*. Đúng — trần biên độ giết ĐUÔI, tức giết đúng thứ
 * làm trò này đáng chơi. Hiệu chỉnh này dời TÂM phân phối, KHÔNG đụng độ
 * rộng: p95 của BTC vẫn ×4 sau khi cân. Ai gặp chuỗi may vẫn nổ tài khoản
 * theo chiều tốt; chỉ có "ôm bừa 8 vòng rồi giàu" là chết.
 *
 * ⭐ MC-TUNE — bp cộng vào delta MỖI VÒNG của mã, suy từ trung vị đo trên:
 * hiệu chỉnh = (1 / trung_vị^(1/8) − 1) × 10.000, làm tròn về bội 10.
 * Đo lại bằng scripts/holdem_can_troi.ts sau mỗi lần đổi ma trận giai đoạn/
 * sự kiện — ma trận đổi thì bảng này SAI NGAY, và nó sai im lặng.
 *
 * ─── 03/08 — SCRIPT ĐO NAY CÓ THẬT, VÀ NÓ NÓI HAI ĐIỀU ────────────────────
 * Dòng trên trỏ tới `holdem_can_troi.ts` từ D54 nhưng file CHƯA BAO GIỜ được
 * viết: chỉ dẫn duy nhất để lặp lại một bảng số kinh tế là một đường dẫn
 * chết. Đã viết. Đo 400 seed, ghế ôm 100% một mã suốt 8 vòng:
 *
 *   độ trải giữa mã tốt nhất và tệ nhất   v20 (chưa cân) 3,16×  →  v22 1,27×
 *   (usd 0,33 → btc 1,04)                                          (btc 0,667 → vàng 0,850)
 *
 * (1) BẢNG NÀY CÓ TÁC DỤNG THẬT — nó co độ trải 2,5 lần. Không phải trang trí.
 * (2) ⭐ CÒN DƯ ~27% VÀ ĐANG NGHIÊNG NGƯỢC: sau cân thì VÀNG/USD nhỉnh hơn
 *     BTC/VN30, tức có thể đã cân QUÁ TAY đúng hướng D54 nhắm. Đây là THAM SỐ
 *     KINH TẾ (A8.2) nên KHÔNG tự chỉnh — chờ founder.
 *
 * ⚠ HAI CÁCH ĐỌC SAI PHẢI TRÁNH khi nhìn số của script:
 *   · Mọi mã đều < 1,00 KHÔNG phải trôi âm — đó là TRƯỢT GIÁ một lần lúc vào
 *     lệnh all-in. Nó đồng đều nên triệt tiêu khi so TỶ LỆ giữa các mã, và
 *     "sửa" nó là trả tiền cho người chơi vì tội giao dịch.
 *   · Số của D54 (btc ×1,00) KHÔNG tái lập được bằng script này, vì script
 *     gốc không tồn tại nên không ai biết nó đo NAV hay đo vị thế, có tính
 *     phí nền hay không. Bản này đo GIÁ TRỊ VỊ THẾ có nêu lý do trong file.
 */
export const CAN_TROI_BP: Readonly<Record<string, number>> = {
  btc: -350,
  vn30: -300,
  cp_cn: -100,
  tpcp: -40,
  vang: +300,
  usd: +610,
};

/**
 * v23 — VÒNG CÂN THỨ HAI, suy bằng NỘI SUY HAI ĐIỂM tự động (D58, 03/08).
 *
 * D54 cân một vòng bằng tay và dừng ở đó; `holdem_can_troi.ts` (viết ở D57)
 * đo lại thì thấy còn dư và NGHIÊNG NGƯỢC — vàng/USD đã nhỉnh hơn BTC/VN30,
 * tức vòng đầu hơi quá tay đúng hướng nó nhắm.
 *
 *       độ trải mã tốt nhất / tệ nhất    chưa cân 3,16×  ·  v22 1,27×  ·  v23 xem D58
 *
 * ⭐ MC-TUNE. Cách suy — KHÔNG phải công thức trung vị thô của D54, vì bp nền
 * còn bị nhân bởi sức căng/chu kỳ nên "bp cần bù" tính thẳng luôn quá tay.
 * Đo HAI điểm (bp = 0 và bp = v22), lấy độ dốc THẬT của từng mã trên thang
 * log rồi giải ngược. Độ dốc đo được nằm gọn trong 0,00110–0,00150 mỗi bp cho
 * cả sáu mã — dải hẹp ấy chính là bằng chứng mô hình log-tuyến tính đứng
 * vững, chứ không phải sáu con số rời rạc trùng hợp.
 *
 * ⚠ ĐÍCH LÀ TRUNG BÌNH NHÂN (0,737), KHÔNG PHẢI 1,00. Mọi mã đều dưới 1 vì
 * TRƯỢT GIÁ một lần lúc vào lệnh all-in — chi phí ấy đồng đều nên nó không
 * phải "trôi", và kéo mọi mã lên 1,00 là trả tiền cho người chơi vì tội giao
 * dịch. Thứ phải triệt là ĐỘ TRẢI giữa các mã.
 *
 * ⚠ ĐUÔI KHÔNG ĐỔI, như D54: hiệu chỉnh cộng vào lợi suất NỀN nên nó dời TÂM,
 * không đụng nhiễu. p95 của BTC vẫn ×2 sau khi cân (founder D53: "may mắn
 * liên tục với xác suất cực nhỏ thì vẫn phải được lãi khủng lồ").
 */
/**
 * v24 — CỠ VỊ THẾ THEO ĐỘ TIN (D58). Trả món nợ "Kelly" treo từ D43/D56.
 *
 * VẤN ĐỀ ĐO ĐƯỢC: ở v22/v23 mọi bot cấp vốn bằng một mốc CỨNG (50%, riêng
 * "Tất tay" 100%), nên BIẾT NHIỀU HƠN không đổi được thành TIỀN NHIỀU HƠN.
 * Hệ quả: oracle — con bot biết trước cả tin thật lẫn tin giả — xếp DƯỚI hai
 * bot chơi được. Nó vào đúng mã nhưng vào bằng đúng số tiền như người đoán mò.
 *
 * LUẬT: cỡ lệnh nội suy tuyến tính theo ĐIỂM KỲ VỌNG của mã định mua, kẹp
 * giữa sàn và trần. Điểm ≥ `DIEM_DAY_DU_BP` (một cú sự kiện trọn vẹn) thì dồn
 * hết; điểm chỉ nhỉnh hơn 0 thì vào bằng mốc sàn.
 *
 * ⚠ ĐÂY LÀ KELLY VỀ TINH THẦN, KHÔNG PHẢI CÔNG THỨC KELLY. Kelly thật cần
 * phân phối xác suất đầy đủ của từng mã, mà bot chỉ đọc được KỲ VỌNG từ bối
 * cảnh — dựng thêm một mô hình phương sai chỉ để bot dùng là tự chế cho bot
 * một giác quan người chơi không có, và gate sẽ đo nhầm sang đó.
 *
 * ⚠ D43 từng thử Kelly và THUA bot kéo bừa — nhưng đó là trước sức căng
 * (bước 4) và trước NAV đọc bối cảnh (D56). Cùng D43 ghi rằng sau bước 4 thì
 * kelly đã vượt lên. Nên đây là phép đo LẠI, không phải bỏ qua kết quả cũ.
 */
export const CO_VI_THE = {
  /** Điểm kỳ vọng (bp) coi là "chắc ăn hết mức" ⇒ dồn toàn lực. */
  DIEM_DAY_DU_BP: doThamSo('CO_VI_THE_DIEM_DAY_DU_BP', 2400),
  /** Mốc sàn (bp của tiền mặt khả dụng) khi điểm chỉ vừa dương. */
  MOC_SAN_BP: doThamSo('CO_VI_THE_MOC_SAN_BP', 2000),
  /** Mốc trần khi điểm đạt `DIEM_DAY_DU_BP`. */
  MOC_TRAN_BP: doThamSo('CO_VI_THE_MOC_TRAN_BP', 10000),
} as const;

export const CAN_TROI_BP_V23: Readonly<Record<string, number>> = {
  btc: -270,
  vn30: -230,
  cp_cn: -120,
  tpcp: +30,
  vang: +180,
  usd: +540,
};

/**
 * BẢNG CÂN TRÔI ĐANG HIỆU LỰC — MỘT NGUỒN cho engine lẫn bot.
 *
 * ⚠⚠ VÌ SAO PHẢI LÀ MỘT HÀM CHUNG (rà soát 11/08 — lỗi trong DỤNG CỤ ĐO).
 * `engine.ts` chọn bảng theo cờ `can_troi`/`can_troi_2`, nhưng `bots.ts` đọc
 * THẲNG `CAN_TROI_BP` (bảng v21) — nên từ v23 trở đi, bot chấm điểm mã bằng
 * một bảng KHÁC bảng engine dùng để định giá. Bot mua theo bảng cũ rồi bị
 * chấm bằng bảng mới; gate G1/G4 đo trên chênh lệch đó chứ không đo kỹ năng.
 *
 * Đây đúng bẫy D61: hai bản cài đặt của cùng một luật thì bản thứ hai sẽ
 * trôi, và cú trôi ở đây KHÔNG BAO GIỜ ném lỗi — nó chỉ làm mọi con số cân
 * bằng sai một cách im lặng. Bảng nào cũng "chạy được", nên không ai thấy.
 */
/**
 * v42 (D311) — hai ô đổi, cùng một lý do với ma trận:
 *  · `tpcp` +30 → **0**: cái +30 ấy là CARRY của trái phiếu, nay đã tường minh thành
 *    coupon trả vào tiền mặt. Để lại là trả lãi hai lần, đúng lỗi mà `couponTpcp` sinh
 *    ra để tránh.
 *  · `cp_cn` −120 → **−150**: công ty chứng khoán trôi mạnh hơn công ty công nghệ vì
 *    doanh thu bám thanh khoản, mà thanh khoản là thứ bốc hơi trước tiên khi bàn nguội.
 * Bốn mã còn lại chép nguyên V23.
 */
export const CAN_TROI_BP_V42: Readonly<Record<string, number>> = {
  btc: -270,
  vn30: -230,
  cp_cn: -150,
  tpcp: 0,
  vang: +180,
  usd: +540,
};

export function bangCanTroi(
  canTroi: boolean, canTroi2: boolean, bo: BoMaTran = 'v40',
): Readonly<Record<string, number>> {
  if (!canTroi) return {};
  if (bo === 'v42') return CAN_TROI_BP_V42;
  return canTroi2 ? CAN_TROI_BP_V23 : CAN_TROI_BP;
}

/** Phạt whipsaw mỗi cặp xung đột (bp trên PnL vòng). */
export const PHAT_XUNG_DOT_BP = 250;

/**
 * D3 — HỆ SỐ KHI HAI THẺ GẮN VÀO HAI MÃ KHÁC NHAU (bp của mức đầy đủ).
 *
 * ⚠ CÁI BẪY PHẢI TRÁNH: nếu xung đột CHỈ nổ khi hai thẻ gắn cùng một mã thì người
 * chơi tránh được bằng một cú bấm — gắn ra hai mã là xong. Xung đột gần như biến
 * mất, và mất luôn cơ chế DẠY-BẰNG-NỖI-ĐAU mà D24 mục 16.5 cố ý dựng (mô phỏng
 * overfitting, và là engine cháy tài khoản của luật buộc-mua-≥1).
 *
 * Nên attachment cho GIẢM, không cho THOÁT: gắn cùng mã ăn/chịu đủ 100%, gắn khác
 * mã còn 45%. Hai chiến lược mâu thuẫn nằm chung một danh mục thì vẫn giật nhau,
 * chỉ là nhẹ hơn khi chúng không cùng nhắm một mã. Cộng hưởng đối xứng: muốn ăn
 * đủ thì phải chủ động ghép cặp lên cùng một mã — tức attachment thành một quyết
 * định thật, không phải một ô phải điền.
 */ // MC-TUNE
export const KHAC_MA_BP = 4500;

/** Cặp cộng hưởng — D24 mục 16.5 SYNERGY. */
export const CONG_HUONG: readonly (readonly [ChienThuatId, ChienThuatId])[] = [
  ['chan_lo', 'phong_ho'],
  ['luot_song', 'don_bay'],
  ['khop_nhanh', 'mua_duoi'],
  ['da_dang_hoa', 'chan_lo'],
] as const;

/**
 * Founder 02/08 ("Gỡ") — cộng hưởng rà cùng chuẩn với XUNG_DOT_V19: hai cặp
 * dính lá đã thành ĐẶC QUYỀN CHỨC NĂNG gỡ bỏ (Lướt Sóng nay là Bảng điện tử,
 * Khớp Nhanh là trượt giá cá nhân — "trend + đòn bẩy" hay "khớp nhanh + FOMO"
 * không còn tả cặp lệnh nào có thật). GIỮ hai cặp phòng-thủ-có-phí: chúng
 * không phải tàn dư mà là cần gạt cân bằng D20 "phòng thủ phải CÓ GIÁ"
 * (BAO_HIEM_CO_PHI + PHI_CO_HOI_KEP đọc đúng hai cặp này theo tên).
 *
 * ⚠ Cổng RIÊNG v20, không dùng lại cờ v19: trận v19 đã lưu có thể đã tính
 * thưởng cộng hưởng (bàn tập ghim chào đúng Lướt Sóng rồi Đòn Bẩy) — dùng
 * chung cờ là viết lại kết quả người chơi đã thấy. Bảng cũ ở trên KHÔNG xoá.
 */
export const CONG_HUONG_V20: readonly (readonly [ChienThuatId, ChienThuatId])[] = [
  ['chan_lo', 'phong_ho'],
  ['da_dang_hoa', 'chan_lo'],
] as const;

export const THUONG_CONG_HUONG_BP = 120;

// ---------------------------------------------------------------------------
// NHÀ CÁI: Telegraph · Joker · Trí nhớ giá — D24 mục 17
// ---------------------------------------------------------------------------

/**
 * CỬA DÒ THAM SỐ — chỉ mở khi `HOLDEM_SWEEP=1`, và CHỈ cho Monte Carlo.
 *
 * Vì sao tồn tại: dò cân bằng cần chạy hàng chục cấu hình SONG SONG. Không có
 * cửa này thì mỗi cấu hình phải sửa file rồi chạy tuần tự — chậm tới mức không
 * ai dò tử tế, và đó chính là lý do bộ tham số cũ chưa bao giờ được quét đủ.
 *
 * Vì sao AN TOÀN: không có biến môi trường `HOLDEM_SWEEP` thì hàm trả thẳng
 * giá trị committed, không đọc env nào khác. Có test ghim cứng mọi giá trị mặc
 * định (`tests/holdem_config.test.ts`) — đổi hằng số mà quên cập nhật là đỏ
 * build, nên cửa này không thể âm thầm đổi kinh tế prod.
 *
 * A8.9 "không có đường tắt tạm thời không có ngày chết": cửa này KHÔNG tạm —
 * nó là hạ tầng đo lường thường trực, dùng lại mỗi mùa khi cân bằng lại.
 */
export function doThamSo(ten: string, macDinh: number): number {
  /*
   * ⚠ File này BUNDLE VÀO TRÌNH DUYỆT (xemTruocLenh D67). Vite BUILD thay
   * `process.env.*` bằng literal nên prod sống, nhưng vite DEV thì không —
   * thiếu guard này là dev server trắng màn với "process is not defined"
   * (dính 08/08 khi lần đầu soi trang bằng trình duyệt dev). Trong trình
   * duyệt không có sweep — trả mặc định là hành vi đúng duy nhất.
   */
  if (typeof process === 'undefined') return macDinh;
  if (process.env.HOLDEM_SWEEP !== '1') return macDinh;
  const v = process.env[`HOLDEM_${ten}`];
  if (v === undefined) return macDinh;
  const n = Number(v);
  if (!Number.isInteger(n)) {
    throw new Error(`HOLDEM_${ten} phải là số nguyên, nhận "${v}"`);
  }
  return n;
}

export const NHA_CAI = {
  /** Xác suất một ô là Sự kiện (phần còn lại là Giai đoạn nền). bp. */
  TY_LE_O_SU_KIEN_BP: 3500,
  /**
   * TIN GIẢ: xác suất một sự kiện là giả. Placeholder — Monte Carlo chốt theo
   * gate 17.6 (bot 'tin mọi tin' VÀ bot 'phớt mọi tin' đều phải thua bot
   * 'hoài nghi hiệu chỉnh'). Quá cao → tín hiệu thành nhiễu vô nghĩa, người
   * chơi ức chế (17.7).
   */
  TY_LE_TIN_GIA_BP: doThamSo('TY_LE_TIN_GIA_BP', 3500),
  /** Sức mạnh telegraph: nghiêng xác suất ô kế về giai đoạn được báo. bp. */
  SUC_MANH_TELEGRAPH_BP: doThamSo('SUC_MANH_TELEGRAPH_BP', 6000),
  /** ECHO kéo dài mấy vòng sau sự kiện (trí nhớ giá — 17.2). */
  SO_VONG_ECHO: doThamSo('SO_VONG_ECHO', 3),
  /** Echo suy giảm mỗi vòng (bp của độ lớn còn lại). */
  SUY_GIAM_ECHO_BP: doThamSo('SUY_GIAM_ECHO_BP', 5000),
  /** Sự kiện không rơi vào vòng đầu — người chơi chưa cam kết gì (16.8). */
  KHONG_SU_KIEN_TRUOC_VONG: 2,
} as const;

/**
 * v53 (D373) — BOT TIN LỜI BÁO TỚI ĐÂU, KHI Ô CỦA VÒNG CÒN ÚP.
 *
 * ⚠⚠ ĐÂY LÀ BỘ SỐ ĐÃ ĐO, KHÔNG PHẢI GIẢ ĐỊNH — và nó lật ngược giả định đầu tiên của D373.
 * Bản đầu cho bot lệch kỳ vọng về `bao_truoc` với trọng số (1 − p_tin_giả), tức coi lời báo của
 * một tin BỊA là VÔ GIÁ TRỊ. Đo bằng `scripts/do_telegraph.ts` (8.000 map mỗi cỡ, thuần `sinhMap`,
 * không engine không bot) thì nó KHÔNG vô giá trị — nó ÂM:
 *
 *   | cỡ map | sau tin THẬT | sau tin BỊA | nền chạy tiếp (đối chứng) |
 *   |--------|--------------|-------------|---------------------------|
 *   | 8      | 53,1%        | 26,1%       | 36,1%                     |
 *   | 12     | 51,6%        | 27,4%       | 42,0%                     |
 *   | 16     | 52,3%        | 25,0%       | 43,7%                     |
 *
 * Tin thật nâng ~+9 đến +17 điểm % so với đoán theo nền; tin bịa HẠ 10–19 điểm % xuống DƯỚI nền.
 * Nên kỳ vọng đúng của một lời báo chưa biết thật/giả là `(1−p)·NÂNG − p·HẠ`, và ở mức p mặc định
 * (35%) con số ấy gần như bằng không ở map 12/16. Đó chính là lý do gate D373 đỏ: **bot cược to
 * trên một tín hiệu mỏng, rồi trả phí vào lệnh cho nó** — và oracle (đọc tin hoàn hảo) vẫn thua.
 *
 * Hai số dưới là TỶ LỆ LỆCH, thang 10000 = lệch trọn về `bao_truoc`:
 * · `THAT_BP` — tin tin là THẬT thì lệch bao nhiêu;
 * · `BIA_BP`  — tin tin là BỊA thì lệch NGƯỢC bao nhiêu (dấu âm là có chủ đích, đo ra thế).
 * Tỷ lệ giữa chúng lấy từ chính bảng trên (hạ/nâng ≈ 14/11 trung bình ba cỡ).
 *
 * ⭐ PLAYTEST-TUNE — hình dạng ("bịa thì lệch ngược") là thứ ĐO ĐƯỢC và không thương lượng;
 * độ lớn là cần gạt để gate dò và founder chốt (A8.2/A11.8). Đổi số ⇒ chạy lại G1–G5 ba cỡ bàn.
 */
export const TELEGRAPH_V53 = {
  /** Lệch về `bao_truoc` khi tin được coi là THẬT. */ // MC-TUNE
  THAT_BP: doThamSo('TELEGRAPH_V53_THAT_BP', 10000),
  /** Lệch NGƯỢC `bao_truoc` khi tin được coi là BỊA (dương = mức độ lệch ngược). */ // MC-TUNE
  BIA_BP: doThamSo('TELEGRAPH_V53_BIA_BP', 12700),
} as const;

// ---------------------------------------------------------------------------
// CROWDING / TÁC ĐỘNG GIÁ — tái dùng nguyên tắc engine 2 lớp của GĐ4.5
// ---------------------------------------------------------------------------

/** Độ sâu thanh khoản L theo hạng — càng dày càng khó đẩy giá. */
export const DO_SAU_L: Record<TaiSan['thanh_khoan'], number> = {
  mong: 2500,
  vua: 6000,
  day: 14000,
};

/** Hệ số tác động K: Δgiá_bp = K × flow_ròng × 10000 / L. */
export const HE_SO_TAC_DONG_K = 45;

// ---------------------------------------------------------------------------
// D3 — ĐÁM ĐÔNG ĐO BẰNG TỶ LỆ LOBBY, KHÔNG BẰNG ĐẦU NGƯỜI
// ---------------------------------------------------------------------------

/**
 * Số người "đồng thuyền" QUY CHIẾU = số đối thủ ở bàn mặc định (5 ghế → 4).
 *
 * ⚠ VÌ SAO PHẢI CÓ HẰNG SỐ NÀY, thay vì chỉ chia cho số ghế:
 * mọi ngưỡng đám đông trước D3 đếm ĐẦU NGƯỜI tuyệt đối — `phat ∝ (dong − 1)`.
 * Bàn 4 ghế thì `dong−1` cao nhất là 3; bàn 8 ghế là 7. Cùng một hành vi "cả bàn
 * dồn vào một mã" mà bàn to bị phạt hơn gấp đôi, tức là CỠ BÀN tự nó đổi cân
 * bằng — trong khi D3 lại yêu cầu mở bàn 4–8. Không chuẩn hoá thì mỗi cỡ bàn là
 * một game khác, và gate Monte Carlo đo ở cỡ nào cũng không nói được gì về cỡ kia.
 *
 * Chuẩn hoá xong, `DONG_QUY_CHIEU` giữ ĐỘ LỚN cũ ở bàn 5 ghế: tại đó công thức
 * mới ra ĐÚNG số cũ tới từng bp (xem test). Nhờ vậy D3 không nuốt mất cân bằng
 * D1 vừa đo 15 vòng mới đạt — đổi đơn vị đo, KHÔNG đổi độ mạnh.
 */
/**
 * D3 — LOBBY BIẾN THIÊN 4–8 GHẾ.
 *
 * Số ghế rút TỪ SEED nên nó tất định, và — quan trọng hơn — **số ghế thật của một
 * trận được LƯU trong `ghe_json`** lúc tạo, replay đọc lại từ đó chứ không suy lại
 * bằng hàm này. Nhờ vậy đổi công thức dưới đây KHÔNG làm hỏng lịch sử trận đã lưu:
 * trận cũ vẫn replay ra đúng sơ đồ ghế nó được sinh ra với.
 *
 * ⚠ Đây là chỗ dễ làm hỏng dữ liệu sống nhất của cả cụm D3. Nếu replay suy lại số
 * ghế từ seed thì mọi trận đã lưu trên prod (đều 5 ghế) sẽ replay ra 4–8 ghế →
 * bảng xếp hạng, ví, event log đều lệch, và không cách nào dựng lại. Cột
 * `ghe_json` vốn đã được GHI từ đầu nhưng chưa ai ĐỌC — nay đọc nó, vừa mở được
 * lobby biến thiên vừa khỏi cần migration.
 */
/**
 * D4 — PHẢN THÂN: thị trường phản ứng lại chính hành vi của lobby.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CƠ CHẾ: "THAY Ô — GIỮ LOẠI".
 *
 * Khi cả bàn dồn vào cùng một nhóm tài sản trong 2 vòng LIÊN TIẾP, ô sắp lật bị
 * THAY bằng một ô KHÁC CÙNG LOẠI: ô sự kiện đổi sang sự kiện khác, ô giai đoạn
 * đổi sang giai đoạn khác. Không bao giờ đổi LOẠI ô, không thêm/bớt ô nào.
 *
 * ⚠ VÌ SAO GIỮ LOẠI, thay vì sinh map lười theo vòng (hướng hiển nhiên hơn):
 * năm chỗ trong repo dùng `map.o.length` làm TỔNG SỐ VÒNG — `daKetThuc`, quota
 * cắt lỗ `soLanCatLo`, `tong_vong` gửi client, và bảng đếm bài. Sinh lười làm mảng
 * ngắn dần → trận tự kết thúc ở vòng 2 và quota cắt lỗ đổi mỗi vòng. Nặng hơn:
 * `bo_bai_con_lai` đang CÔNG BỐ thành phần toàn bộ tương lai (còn mấy giai đoạn,
 * mấy sự kiện, kỳ vọng mấy tin giả) — tương lai đổi được thì con số đó thành lời
 * khai sai với người chơi. Giữ loại + giữ số lượng thì mọi con số ấy vẫn nói thật.
 *
 * TẤT ĐỊNH: điều kiện kích hoạt suy từ danh mục các ghế + `dong_truoc` (số người
 * nắm từng mã ở cuối vòng trước), cả hai là hàm thuần của (seed, action_log). Lần
 * rút để chọn ô thay dùng domain RIÊNG nên không xê dịch dòng số của bất kỳ lần
 * rút nào khác.
 *
 * THỜI ĐIỂM: thay ở lúc CHỐT PHIÊN vòng trước, tức trước khi trạng thái vòng mới
 * được công bố. Thay ở đầu vòng mới là người chơi đã THẤY ô cũ rồi mới bị đổi.
 *
 * KHÔNG THAY Ô ĐANG BỊ TELEGRAPH: ô giai đoạn ngay sau một sự kiện THẬT đã được
 * hứa "nghiêng về X" (map.ts biasing + `telegraph.nghieng_ve` gửi ra API). Thay ô
 * đó là bẻ đúng lời hứa mình vừa nói. Sau TIN GIẢ thì thay được — tin giả vốn
 * được cảnh báo là có thể bịa, đó là cả điểm của nó.
 *
 * ⚠ MỌI SỐ Ở ĐÂY LÀ ĐIỂM KHỞI ĐẦU CHỜ MONTE CARLO. Gate D4: đám đông ngây thơ
 * phải bị PHẠT bởi chính bong bóng mình thổi (win-rate đám-đông < solo), và phân
 * phối sự kiện không được thoái hoá (một sự kiện chiếm hết).
 */
export const PHAN_THAN = {
  /*
   * ⚠ `BAT` (ENV `HOLDEM_PHAN_THAN_BAT`) ĐÃ GỠ — D155, chuẩn hoá theo A11.3:
   * phản thân nay gác bằng cờ `phanThan` trong `BO_LUAT_THEO_PHIEN_BAN` như mọi
   * luật engine khác. "Cửa cô lập để đo" mà chú thích cũ đòi giữ vĩnh viễn KHÔNG
   * mất — nó chuyển sang đúng khuôn chuẩn: bàn đo truyền
   * `{...luatCua(v), phanThan: false}` (holdem_phanthan_gate.ts), cô lập được
   * từng cơ chế mà không có biến môi trường nào làm hai máy chạy hai bộ luật.
   * ⚠ Cờ này TRUE ở MỌI phiên bản lịch sử (kể cả entry rỗng): ENV mặc định 1 và
   * prod không bao giờ bật HOLDEM_SWEEP nên mọi trận từng chạy đều CÓ phản thân
   * — đặt false ở bất kỳ entry cũ nào là đổi replay của trận đã lưu.
   */
  /** Từ bao nhiêu phần lobby cùng nắm một nhóm thì tính là dồn (bp). */ // MC-TUNE
  NGUONG_LOBBY_BP: 6000,
  /** Xác suất ô sắp lật bị thay khi điều kiện đủ (bp). */ // MC-TUNE
  TANG_BP: 3500,
  /** Nhóm risk-on: dồn vào đây thì thổi bong bóng. */
  MA_RISK_ON: ['btc', 'cp_cn', 'vn30'] as readonly string[],
  /** Nhóm trú ẩn: cả bàn trốn vào đây thì thị trường hạ nhiệt. */
  MA_PHONG_THU: ['vang', 'usd', 'tpcp'] as readonly string[],
  /**
   * Dồn risk-on → ô sự kiện đổi sang một trong các sự kiện này.
   *
   * ⚠ BẪY TỪ NGỮ, ĐO RA MỚI THẤY. Bản đầu tôi để `['bong_bong','hack_san']` vì D4
   * viết đúng chữ đó. Nhưng trong BẢNG SỐ của engine này, `bong_bong` là một cú
   * BƠM chứ không phải cú sập: btc +2400, cp_cn +2400, vn30 +1800. Cú sập là chuỗi
   * ép SAU đó (`chuoiEp` trong map.ts đặt hai ô "giảm, giảm" nối tiếp bong bóng
   * thật) — mà phép THAY Ô không mang theo chuỗi ép, vì mang theo là đổi cả loại
   * của các ô sau và phá đúng bất biến giữ-loại.
   *
   * Kết quả đo được: bật phản thân làm đám đông risk-on GIÀU THÊM 6,9%. Tôi vừa
   * thưởng cho đúng đám đông cần phạt.
   *
   * Nay chọn các sự kiện THỰC SỰ đánh vào risk-on theo bảng `MT_TAI_SAN_SU_KIEN`:
   *   tang_lai_suat  — btc −1800 · cp_cn −1800 · vn30 −1200 (đánh cả ba)
   *   thien_nga_den  — cả ba −1800
   *   hack_san       — btc −2400 (D4 gọi tên, và nó đúng là cú sập)
   * Ý nghĩa kể lại vẫn nguyên: bong bóng các anh thổi thì vỡ vào mặt các anh —
   * chỉ là cú vỡ được biểu diễn bằng sự kiện siết/sập, không bằng lá "Bong bóng".
   */ // MC-TUNE
  // v16: KHÔNG thêm mặt đuôi mới vào đây — đo 2.000 trận cho thấy chồng răng
  // 'khi dồn' lên đuôi hẹp-sâu + sức căng 3,5× là nghiền sạch mọi ghế tập
  // trung, 'không chơi' thành nhất bàn (2,27) — mất dữ liệu, §5.3 cấm.
  SU_KIEN_KHI_DON: ['tang_lai_suat', 'thien_nga_den', 'hack_san'] as readonly string[],
  /**
   * Trốn phòng thủ → ô sự kiện đổi sang đây.
   *
   * `ha_lai_suat` là cú hồi: btc +2400, cp_cn +2400 nhưng usd −1200. Nên nó phạt
   * người trốn bằng CHI PHÍ CƠ HỘI — cả bàn núp vào vàng/USD thì thị trường rướn
   * lên mà không có mình. Đúng thứ D4 muốn, và đúng bài học tài chính thật.
   */
  SU_KIEN_KHI_TRON: ['ha_lai_suat'] as readonly string[],
  /** Dồn risk-on → ô GIAI ĐOẠN đổi sang đây (đà quay đầu). */ // MC-TUNE
  GIAI_DOAN_KHI_DON: ['giam'] as readonly string[],
  /** Trốn phòng thủ → ô GIAI ĐOẠN đổi sang đây (đúng chữ "Phục hồi" của D4). */
  GIAI_DOAN_KHI_TRON: ['phuc_hoi'] as readonly string[],
} as const;

/**
 * D6 — KHẨU VỊ RỦI RO: chọn trước trận, KHÔNG đổi giữa chừng.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Vế thứ hai của chỉ đạo founder 25/07: "không thể cân bằng tuyệt đối… hãy nghĩ
 * cách thêm bài hay tính năng khắc chế VÀ MỨC ĐỘ CHỊU RỦI RO KHÁC NHAU".
 *
 * ⚠ NHÂN CẢ HAI CHIỀU — KỲ VỌNG KHÔNG ĐỔI, CHỈ PHƯƠNG SAI ĐỔI.
 * Đây là điểm thiết kế quan trọng nhất của cụm, và nó có ba lý do:
 *
 *  1. KHÔNG ĐẺ RA LỰA CHỌN TRỘI. Nếu "quyết liệt" có kỳ vọng cao hơn thì nó là
 *     nút-bấm-là-đúng, không phải khẩu vị; mọi người chọn nó và ta lại phải vặn số.
 *  2. ĐO ĐƯỢC KHẨU VỊ THẬT (A1). Khi hai lựa chọn có cùng kỳ vọng, thứ duy nhất
 *     quyết định là NGƯỜI CHƠI CHỊU ĐƯỢC BAO NHIÊU BIẾN ĐỘNG — chính là tín hiệu
 *     hành vi mà app muốn bán. Lệch kỳ vọng là làm bẩn phép đo đó.
 *  3. KHÔNG BẺ ĐỘNG CƠ GIÁ (D22). Không bịa alpha cho ai; giá vẫn thế, chỉ có
 *     biên độ ăn/thua của từng người là khác.
 *
 * NHƯNG ĐÁNH ĐỔI VẪN THẬT, không phải trang trí: trong một trò XẾP HẠNG, phương
 * sai cao vừa tăng cơ hội về nhất vừa tăng cơ hội cháy tài khoản. "Cùng kỳ vọng"
 * không có nghĩa là "cùng giá trị" khi chỉ hạng nhất mới đáng kể.
 *
 * ⚠⚠ ĐÃ ĐO (D339, 16/09) — "KỲ VỌNG KHÔNG ĐỔI" CHỈ ĐÚNG KHI ĐÀ THỊ TRƯỜNG BẰNG 0.
 * Ba dòng trên là ý ĐỊNH, và suốt từ D6 tới v46 nó chưa từng được đo. Khi đo (bộ ba
 * song sinh: cùng seed, cùng bàn, cùng bot, chỉ khác khẩu vị ghế 0) thì:
 *  · tới v46 nó còn SAI VỀ ĐƠN VỊ — hệ số rơi vào tầng danh mục nên quyết liệt về nhất
 *    53,3% còn thận trọng 5,0% (cân bằng 17,3%). Đó là nút-bấm-là-đúng, đúng thứ mục 1
 *    ngay trên cấm. v47 (`khauViTheoMa`) sửa chỗ này.
 *  · SAU KHI SỬA vẫn còn 33,9% vs 16,9% — và phần này KHÔNG phải lỗi: nhân biên độ lên
 *    một thị trường có đà tăng thì kỳ vọng nhân theo, y như ngoài đời. Cái được bảo toàn
 *    là "không bịa alpha" (mục 3), không phải "cùng kỳ vọng" (mục 1).
 * ⇒ Khẩu vị hôm nay là NÚT CHỌN MỨC PHƠI NHIỄM, giá phải trả là cháy 4,4% vs 1,1%. Muốn
 * nó thành phép đo trung tính thì phải đổi CƠ CHẾ (gắn một cái giá như Đòn Bẩy), không
 * phải vặn hai số dưới. Bảng quét hệ số + ba lối đi: `docs/nhat-ky/D339.md`. Chờ founder.
 *
 * Đây cũng là LEVER DỰ PHÒNG đã ghi ở D5: nếu Đuổi đà vượt ngưỡng chạy trốn ở mùa
 * sau thì siết ở đây, KHÔNG hạ số của archetype đỉnh bảng.
 */
export type KhauViId = 'than_trong' | 'can_bang' | 'quyet_liet';

export interface KhauVi {
  id: KhauViId;
  label: string;
  icon: string;
  /** Hệ số nhân PnL vòng (bp). Áp cho CẢ lãi lẫn lỗ — xem docstring. */
  he_so_bp: number;
  mo_ta: string;
}

export const KHAU_VI: readonly KhauVi[] = [
  {
    id: 'than_trong',
    label: 'Thận trọng',
    icon: '🛡',
    he_so_bp: 7500, // MC-TUNE
    mo_ta: 'Lãi và lỗ đều nhỏ lại. Khó cháy tài khoản, nhưng cũng khó bứt lên nhất.',
  },
  {
    id: 'can_bang',
    label: 'Cân bằng',
    icon: '⚖',
    he_so_bp: 10000,
    mo_ta: 'Ăn chia đúng như bàn tính. Không thêm không bớt.',
  },
  {
    id: 'quyet_liet',
    label: 'Quyết liệt',
    icon: '🔥',
    he_so_bp: 13500, // MC-TUNE
    mo_ta: 'Lãi và lỗ đều to lên. Về nhất dễ hơn, mà cháy tài khoản cũng dễ hơn.',
  },
] as const;

export const KHAU_VI_MAC_DINH: KhauViId = 'can_bang';

export function khauViCua(id: string | undefined): KhauVi {
  return KHAU_VI.find((k) => k.id === id)
    ?? KHAU_VI.find((k) => k.id === KHAU_VI_MAC_DINH)!;
}

export const SO_GHE_MIN = 4;
export const SO_GHE_MAX = 8;
/** D515 (founder 05/10: "trần 1 trận là 20 người. Còn tạo phòng thì cho phép trần 40 người") — trần số ghế của MỘT trận · của một phòng tự tạo. */
export const SO_GHE_TRAN_TRAN = 20;
export const SO_GHE_TRAN_PHONG = 40;
/**
 * D515 — CHIA VAI THEO XÁC SUẤT (founder chọn bảng A 05/10): mỗi ô vai độc lập; ô CM/ĐL ra Cá Mập hoặc Đội Lái 50/50. Bàn ≥ 11 ghế: mỗi 2 ghế trên 11
 * cộng TANG_MOI_2 vào mọi ô (trần TRAN_P). PLAYTEST-TUNE (A8.2) — đo tỷ lệ thắng theo vai rồi founder chốt.
 */
export const VAI_XAC_SUAT = {
  NHO: { cmdl: [0.25], tc: [] },                          // ≤ 3 ghế
  VUA: { cmdl: [0.4, 0.2], tc: [0.2] },                  // 4–10 ghế
  LON: { cmdl: [0.5, 0.35, 0.2, 0.1], tc: [0.35, 0.15] }, // ≥ 11 ghế
  TANG_MOI_2: 0.02, TRAN_P: 0.95,
} as const;

/**
 * GHÉP BÀN XẾP HẠNG (SPEC `docs/spec/alpha-draft-tang-khong-gian.md` mục 6, founder CHỐT 11/10) — số khởi điểm PLAYTEST-TUNE (A8.2):
 * founder chốt bảng, agent KHÔNG tự đặt số. Đổi số ở đây ⇒ cổng khoá bàn ghép mới (`RANK_GHEP_KHOA_LUAT`, nay `balance-v71-banxephang`) + MC theo vai (A11.3).
 *
 * `CO_BAN_THEO_BAC` — CỠ BÀN 4 · 8 · 12 · 16 · 20 bốc theo BẬC THẤP NHẤT trong nhóm (kiểu bể tướng TFT: mỗi cỡ vào sân sớm một bậc ở % nhỏ,
 * đỉnh dịch lên theo bậc, cỡ lớn nhất luôn hiếm). Khoá = bậc SỐ 1..7 của `config/rank.ts` (Sắt 1 → Elite 7; "chưa xếp" tính bậc 1).
 * Mỗi hàng là % cho `CO_BAN_MOC` theo thứ tự, tổng 100.
 */
export const CO_BAN_MOC = [4, 8, 12, 16, 20] as const;
export const CO_BAN_THEO_BAC: Readonly<Record<number, readonly [number, number, number, number, number]>> = {
  1: [75, 25, 0, 0, 0],      // SẮT
  2: [55, 35, 10, 0, 0],     // ĐỒNG
  3: [40, 38, 20, 2, 0],     // BẠC
  4: [25, 37, 30, 8, 0],     // VÀNG
  5: [15, 30, 35, 18, 2],    // BẠCH KIM
  6: [10, 22, 35, 28, 5],    // KIM CƯƠNG
  7: [5, 15, 30, 40, 10],    // ELITE
};

/**
 * `VAI_THEO_CO_BAN` — CHIA VAI KIỂU TFT, TRỤC = CỠ BÀN (founder 11/10: *"Chốt"*), thay bảng 3 nhóm `VAI_XAC_SUAT` (D515) CHO BÀN XẾP HẠNG
 * GHÉP NGƯỜI (cờ `vaiTheoCoBan`, khoá v67). Mỗi ô bốc độc lập; ô CM/ĐL ra Cá Mập hoặc Đội Lái 50/50; trần vai = số ô của hàng
 * (bàn 4: 1 · 8: 2+1 · 12: 3+2 · 16: 4+2 · 20: 4+2). Bàn có số ghế giữa hai mốc ⇒ hàng của mốc nhỏ hơn. Số là PHẦN TRĂM.
 */
export const VAI_THEO_CO_BAN: Readonly<Record<number, { readonly cmdl: readonly number[]; readonly tc: readonly number[] }>> = {
  4: { cmdl: [30], tc: [] },
  8: { cmdl: [45, 20], tc: [20] },
  12: { cmdl: [55, 35, 15], tc: [35, 10] },
  16: { cmdl: [60, 45, 25, 10], tc: [45, 20] },
  20: { cmdl: [65, 50, 35, 20], tc: [55, 30] },
};

export function soGheTuSeed(seed: number): number {
  const dai = SO_GHE_MAX - SO_GHE_MIN + 1;
  return SO_GHE_MIN + (Math.abs(seed) % dai);
}

export const DONG_QUY_CHIEU = 4;

/**
 * Tỷ lệ "bao nhiêu phần lobby đang đứng cùng thuyền với mình" (bp).
 *
 * `dong` tính CẢ mình. Chỉ mình → 0. Cả bàn → 10000. `songSot` là số ghế còn
 * trong trận (người cháy không còn là áp lực dòng tiền nào).
 */
export function tyLeDongBp(dong: number, songSot: number): number {
  if (dong <= 1 || songSot <= 1) return 0;
  // Math.floor, KHÔNG import idiv: config/ cố ý không phụ thuộc server/ (đổi
  // hosting = đổi adapter, A8.9). Mọi đầu vào ở đây đều ≥ 0 nên floor ≡ trunc.
  return Math.floor((10000 * (dong - 1)) / (songSot - 1));
}

/**
 * Quy "tỷ lệ lobby" về SỐ NGƯỜI TƯƠNG ĐƯƠNG ở bàn quy chiếu.
 *
 * Dùng cho các bảng tra vẫn đánh chỉ số theo đầu người (`KHOP_NHANH_HOAN_BP`).
 * Ở bàn 5 ghế trả về đúng `dong` — bảng tra không phải viết lại.
 */
export function dongQuyDoi(dong: number, songSot: number): number {
  return 1 + Math.floor((DONG_QUY_CHIEU * tyLeDongBp(dong, songSot)) / 10000);
}

/**
 * Giảm trượt giá khi có thẻ Khớp Nhanh / Chia Lệnh (bp CÒN LẠI).
 *
 * ⚠ `chia_lenh` là knob NHẠY NHẤT của cân bằng, đo được 25/07: trượt giá do đông
 * là CHI PHÍ HỆ THỐNG DUY NHẤT trong trận, nên một khiên phẳng cắt nửa chi phí
 * đó là lợi thế cấu trúc lớn hơn mọi thẻ khác. Bot "Bắt đáy" ăn 30–32% không
 * phải nhờ lá bat_day (sweep lá đó gần như không đổi số) mà nhờ cầm
 * cp_cn+vn30 — hai mã sổ lệnh SÂU NHẤT — cộng thêm khiên này. Nó né sạch chi
 * phí duy nhất mà cả bàn phải trả.
 */
export const GIAM_TRUOT_GIA_BP = {
  khop_nhanh: 4000,
  chia_lenh: doThamSo('CHIA_LENH_CON_LAI_BP', 5000),
} as const;

// ---------------------------------------------------------------------------
// D1 — ĐÓNG BỮA TRƯA MIỄN PHÍ (founder 25/07 §6)
// ---------------------------------------------------------------------------

/**
 * PHÍ CƠ HỘI CỦA CẶP ĐA DẠNG HÓA + CHẶN LỖ.
 *
 * Đây là món nợ đã ghi hôm 21/07: cặp này nằm trong `CONG_HUONG` ăn thưởng
 * PHẲNG 120bp, tức là phòng thủ MIỄN PHÍ. Giữ được tới giờ chỉ vì gate G1 vẫn
 * xanh — không phải vì nó đúng.
 *
 * Cùng lỗi mà D20 đã chẩn ở tầng tài sản ("tiền mặt gần như miễn phí khiến MỌI
 * luật siết rủi ro phản tác dụng"), lần này ở tầng chiến thuật. Nay cặp này
 * thành BẢO HIỂM CÓ PHÍ, và phí nặng hơn cặp Chặn Lỗ+Phòng Hộ vì nó còn kèm
 * thưởng đa dạng hoá:
 *   · Giảm / Biến động  → ăn đậm (lúc thật sự cần phanh);
 *   · Tăng / Phục hồi   → mất phí VÀ bị triệt nửa biên tăng của tài sản đang
 *     giữ. Đây là phần răng thật: trong uptrend, giữ cặp phòng thủ nghĩa là
 *     bỏ mất nửa con sóng → ép người chơi XÉ CẶP, đúng lựa chọn founder muốn.
 */
export const PHI_CO_HOI_KEP = {
  CAP: ['da_dang_hoa', 'chan_lo'] as const,
  AN_BP: doThamSo('KEP_AN_BP', 900),
  AN_KHI: ['giam', 'bien_dong'] as readonly GiaiDoanId[],
  PHI_BP: doThamSo('KEP_PHI_BP', -400),
  PHI_KHI: ['tang', 'phuc_hoi'] as readonly GiaiDoanId[],
  /** Còn lại bao nhiêu % biên TĂNG của tài sản (5000 = triệt một nửa). */
  TRIET_BIEN_TANG_BP: doThamSo('KEP_TRIET_BIEN_TANG_BP', 5000),
  /** Sự kiện cũng tính là "thị trường đang lên" cho luật này. */
  PHI_KHI_SU_KIEN: ['bong_bong'] as readonly SuKienId[],
} as const;

/**
 * THANH KHOẢN ĐỘNG — khủng hoảng thì sổ lệnh MỎNG đi.
 *
 * Trước bản này `thanh_khoan` là hằng số dán trên lá bài: BTC luôn "mỏng", VN30
 * luôn "dày", bất kể thị trường đang êm hay đang cháy. Sai với thứ ai giao dịch
 * thật cũng biết: thanh khoản bốc hơi đúng lúc cần nó nhất.
 *
 * Hệ quả cơ chế (chứ không chỉ là màu sắc): nó nạp thẳng vào tầng trượt giá do
 * đông, nên "cả bàn dồn vào một mã" trở nên đắt hơn HẲN trong khủng hoảng —
 * đúng chỗ đám đông hay dồn nhất.
 *
 * `bong_bong` đi chiều ngược: risk-on hút thanh khoản vào, sổ lệnh dày lên —
 * và đó cũng là cái bẫy, vì nó khiến dồn vào BTC/CP CN lúc bong bóng rẻ bất
 * thường ngay trước cú vỡ.
 */
export const THANH_KHOAN_DONG = {
  /**
   * Cửa TẮT để đo đóng góp riêng của cơ chế này (0 = tắt).
   *
   * Không phải cờ tính năng tạm: đây là dụng cụ đo thường trực. D1 có ba cơ chế
   * vào cùng lúc, và khi gate đỏ thì "cơ chế nào gây ra" là câu hỏi KHÔNG trả
   * lời được nếu không tắt được từng cái. Đã trả giá một lần vì thiếu nó: bốn
   * lần sweep phí cơ hội cho ra cùng một con số, tức là đo sai biến suốt.
   */
  BAT: doThamSo('THANH_KHOAN_DONG_BAT', 1),
  /** Giai đoạn làm MỎNG đi một nấc. */
  MONG_DI_GIAI_DOAN: ['bien_dong'] as readonly GiaiDoanId[],
  /** Sự kiện làm MỎNG đi một nấc. */
  // v16: chỉ pha_san kế thừa ghế 'thanh khoản bốc hơi' của thiên nga (đúng
  // nghĩa khủng hoảng thanh khoản); các mặt còn lại không — xem ghi chú trên.
  MONG_DI_SU_KIEN: ['thien_nga_den', 'chien_tranh', 'pha_san'] as readonly SuKienId[],
  /** Sự kiện làm DÀY thêm một nấc, chỉ với nhóm risk-on. */
  DAY_THEM_SU_KIEN: ['bong_bong'] as readonly SuKienId[],
  /** Mã được hưởng nhánh dày thêm. */
  MA_RISK_ON: ['btc', 'cp_cn'] as readonly string[],
} as const;

/**
 * GIÁ CỦA THANH KHOẢN — sổ lệnh SÂU phải trả bằng lợi suất nền.
 *
 * Đo được 25/07 và đây là phát hiện chính của D1: bot "Bắt đáy" ăn 30–32% và
 * chạy trốn khỏi cả nhóm KHÔNG nhờ lá bat_day (sweep lá đó gần như không đổi
 * số), cũng không chủ yếu nhờ khiên chia_lenh (sweep từ 50% xuống 10% khiên chỉ
 * hạ 31,8 → 31,2). Nó thắng vì cầm `cp_cn` + `vn30` — HAI MÃ SỔ LỆNH SÂU NHẤT —
 * nên né sạch trượt giá do đông, tức chi phí hệ thống DUY NHẤT của trận, mà
 * không phải trả gì cho sự an toàn đó.
 *
 * Đúng bệnh mà D20 đã chẩn ở tầng tài sản trú ẩn và ở tiền mặt, lần thứ ba, nay
 * ở tầng thanh khoản: **an toàn miễn phí thì mọi luật siết rủi ro đều phản tác
 * dụng.** Nên thanh khoản có giá — sổ mỏng được phần bù, sổ dày trả phí.
 *
 * Đây KHÔNG phải alpha giả (D22): nó không thưởng cho ai canh thời điểm theo
 * giá, nó định giá một THUỘC TÍNH CẤU TRÚC của tài sản. Phần bù thanh khoản là
 * hiện tượng có thật và được ghi nhận rộng ngoài đời.
 */
export const GIA_CUA_THANH_KHOAN_BP: Record<ThanhKhoan, number> = {
  /** Sổ mỏng: phần bù rủi ro thanh khoản (bp/vòng). */
  mong: doThamSo('GIA_TK_MONG_BP', 200),
  vua: doThamSo('GIA_TK_VUA_BP', 0),
  /** Sổ dày: trả phí cho sự an toàn. */
  day: doThamSo('GIA_TK_DAY_BP', -200),
};

/**
 * BẢNG ĐIỆN TỬ — pop-up TRẢ PHÍ, người chơi tự bấm mở ở đầu vòng.
 *
 * Triết lý (founder 26/07): công khai thông số MÔI TRƯỜNG, giấu kín thông số MAY
 * RỦI và vị thế đối thủ. Bảng KHÔNG cho biết tương lai — nó chỉ dọn sẵn dữ liệu
 * thô của HIỆN TẠI để ai chịu suy nghĩ nối lại được thành bước đi tốt hơn.
 *
 * ⚠ KHỐI NÀY KHÔNG CHỨA CÔNG THỨC THANH KHOẢN. Nấc hiệu dụng do
 * `THANH_KHOAN_DONG` + `nacHieuDung()` quyết, độ lớn echo do `NHA_CAI.SO_VONG_ECHO`
 * / `SUY_GIAM_ECHO_BP` quyết. Ở đây chỉ có tham số TRÌNH BÀY (mấy vạch pin) và
 * tham số CHE (sương mù, độ trễ, phí). Thêm một công thức thứ hai vào đây là dạy
 * người chơi sai mà họ không có cách nào biết.
 */
export const BANG_DIEN_TU = {
  /**
   * LUẬT 3 — phí mở bảng, trừ THẲNG Vốn mỗi lần mở (founder chốt 25, không phải 50).
   *
   * Đây là cần gạt tạo giằng co: mở mọi vòng thì bị bào vốn trước khi kịp ăn lời,
   * nên người chơi buộc phải tự tính EV "thị trường đang yên, có đáng không".
   * Qua `doThamSo` vì Monte Carlo phải sweep được — nếu 25 quá rẻ thì mở-mọi-vòng
   * là nước đi trội và cả sự giằng co biến mất.
   */
  /*
   * 100, KHÔNG phải 25/30 — founder giao tự chốt 27/07, và số cũ đo ra là vô hại.
   *
   * Con số này chỉ có nghĩa khi đặt cạnh thứ nó so sánh:
   *     Vốn đầu trận            10.000
   *     Cam kết NỀN một vòng       500   ← thang đúng để so
   *
   *   phí   %vốn   mở MỌI vòng: map8/12/16   so cam kết nền 1 vòng
   *    25   0,25%        2% /  3% /  4%              5%
   *    30   0,30%        2% /  4% /  5%              6%
   *   100   1,00%        8% / 12% / 16%             20%   ← chọn
   *   150   1,50%       12% / 18% / 24%             30%
   *
   * Ở 25, mở bảng mỗi vòng suốt map 12 tốn 3% vốn — không ai cân nhắc một giây,
   * ai cũng bấm, và cơ chế thành TRANG TRÍ: có UI, có test, mà không bao giờ
   * buộc ai phải chọn. Spec đòi "giằng co tâm lý cực nặng" và "bào mòn vốn
   * trước khi kịp ăn lời" — 3% không làm được câu nào trong hai câu đó.
   *
   * Ở 100, câu người chơi tự hỏi là "tin này có đáng MỘT PHẦN NĂM số tôi định
   * cam kết vòng này không". Đó là quyết định thật.
   *
   * Và nó TỰ CO GIÃN theo độ dài map, khớp cách founder đặt tên hai đầu: map 8
   * lướt sóng tốn 8%, map 16 dài hạn tốn 16% — phòng dài buộc tiết kiệm thông
   * tin hơn mà không cần luật riêng.
   *
   * KHÔNG chọn 150: 24% ở map 16 thì gần như không ai dám mở, và cơ chế không
   * ai dùng cũng vô dụng y như cơ chế ai cũng dùng.
   */
  PHI_MO: doThamSo('BANG_PHI_MO', 100),
  /*
   * ─── BA HẠNG GIÁ (D33, founder chốt 27/07) ────────────────────────────────
   *       không thẻ              100   dữ liệu BẨN (trễ 1 vòng + sương mù)
   *       Lướt sóng, bảng thường  80   dữ liệu SẠCH (hết trễ, hết sương mù)
   *       Lướt sóng + dự báo     110   thêm 3 tên thẻ khả năng cao vòng sau
   *
   * ⚠ 110 > 100 LÀ CÓ CHỦ Ý, đừng "sửa" cho nó rẻ hơn: thẻ KHÔNG làm thông tin
   * rẻ đi, nó MỞ MỘT HẠNG CAO HƠN. Thẻ mua chất lượng + quyền truy cập, không
   * mua chiết khấu. Độ căng so `CAM_KET_NEN = 500`: 20% · 16% · 22% — không mức
   * nào rơi xuống vùng "ai cũng bấm không cần nghĩ".
   */
  PHI_MO_LUOT_SONG: doThamSo('BANG_PHI_MO_LUOT_SONG', 80),
  /** Cộng thêm khi mua kèm DỰ BÁO. Chỉ mở cho người cầm Lướt Sóng. */
  PHI_DU_BAO_THEM: doThamSo('BANG_PHI_DU_BAO_THEM', 30),
  /**
   * Số lần mở TÍNH PHÍ tối đa trong một vòng.
   *
   * Vì sao chặn ở 1: nội dung bảng là hàm thuần của (seed, vòng) nên lần mở thứ
   * hai trong cùng vòng KHÔNG bán thêm một mẩu thông tin nào. Thu phí lần hai là
   * thuế đánh vào cú bấm lỡ tay (và vào double-submit của client), tức trừ Vốn
   * mà người chơi không nhận lại gì — không phải quyết định, chỉ là mất mát.
   * Muốn đổi thành "mở bao nhiêu lần cũng thu" thì nâng hằng số này, đừng bỏ
   * kiểm ở tầng gọi.
   */
  TOI_DA_MOI_VONG: doThamSo('BANG_TOI_DA_MOI_VONG', 1),
  /** Số vạch pin của một thanh thanh khoản (3 nấc → 3 vạch). */
  SO_VACH: 3,
  /** Vạch sáng theo nấc hiệu dụng. Đầy = sổ lệnh DÀY = trượt giá nhẹ. */
  VACH_THEO_NAC: { mong: 1, vua: 2, day: 3 } as Readonly<Record<ThanhKhoan, number>>,
  /**
   * LUẬT 2 — mã bị SƯƠNG MÙ: chỉ hiện BIÊN ĐỘ nhấp nháy, không hiện nấc.
   *
   * ⚠ CỐ Ý KHÔNG dùng lại `THANH_KHOAN_DONG.MA_RISK_ON` dù hai danh sách hiện
   * trùng nhau. Hai lý do khác hẳn: MA_RISK_ON là "mã được hưởng nhánh dày thêm
   * khi bong bóng", còn danh sách này là "mã đầu cơ/thao túng cao nên số liệu
   * công bố không đáng tin". Gộp lại thì lần đầu một danh sách đổi, danh sách kia
   * bị đổi theo mà không ai chủ ý — đúng kiểu nợ A8.9 bắt chặn.
   */
  MA_SUONG_MU: ['btc', 'cp_cn'] as readonly string[],
  /**
   * Xác suất biên độ nhấp nháy LỆCH khỏi nấc đang tính (bp).
   *
   * Founder chốt 26/07: nấc thật ĐƯỢC PHÉP nằm ngoài biên độ — biên là gợi ý,
   * không phải bảo đảm. Đặt 0 là biến biên thành bảo đảm (chỉ hẹp hơn một nấc),
   * tức bán đúng thứ luật 2 nói không bán.
   */
  SUONG_MU_LECH_BP: doThamSo('BANG_SUONG_MU_LECH_BP', 3000),
  /**
   * LUẬT 1 — sổ cái echo chỉ chính xác tới hết vòng LIỀN TRƯỚC (số vòng bị che
   * tính ngược từ vòng hiện tại). 1 = che đúng ô vừa lật ở đầu vòng này.
   *
   * ⚠ Founder chốt 26/07: độ trễ chỉ áp cho SỔ CÁI ECHO, không áp cho thanh
   * thanh khoản.
   */
  DO_TRE_VONG: doThamSo('BANG_DO_TRE_VONG', 1),
} as const;

/**
 * TRUYỀN NHÂN QUẢ F0 → F1 → F2.
 *
 * Đây là lớp làm sâu thật sự, và nó là LUẬT SINH chứ không phải thêm domino
 * viết tay: khi một tin nổ, nó vọng sang cả những HỆ QUẢ mà nó thường kéo theo
 * — suy thẳng từ `MT_SU_KIEN_KE_TIEP`, không thêm bảng số mới.
 *
 * Nghĩa là "chiến tranh" không chỉ đánh vào các mã theo bảng chiến-tranh; nó
 * còn nhỏ một phần áp lực LẠM PHÁT vào giá trước khi lá lạm phát được lật.
 * Người đọc được dây chuyền sẽ thấy trước; người không đọc chỉ thấy giá lạ.
 *
 * ⚠ Vì sao có NGƯỠNG XỊT: không có nó thì mỗi tin toả ra cả cây hệ quả và mọi
 * vòng đều có mọi thứ tác động một chút — đúng định nghĩa của nhiễu. Ngưỡng giữ
 * cho chỉ những nhánh CÓ NGHĨA tồn tại.
 *
 * ⚠ Tin giả: `dao` truyền xuống nguyên nhánh. Tin bịa mà vẫn đẻ hệ quả thật thì
 * "hiệu chỉnh theo tỷ lệ tin giả" không còn là kỹ năng nào cả (gate G4).
 */
export const TRUYEN_NHAN_QUA = {
  /** Độ lớn còn lại ở đời F1 (hệ quả trực tiếp). */
  F1_BP: doThamSo('TRUYEN_F1_BP', 7000),
  /** Độ lớn còn lại ở đời F2 (hệ quả của hệ quả). */
  F2_BP: doThamSo('TRUYEN_F2_BP', 5000),
  /** Dưới độ lớn này thì thôi không truyền nữa (bp). */
  NGUONG_XIT_BP: doThamSo('TRUYEN_NGUONG_XIT_BP', 2500),
  /** Mỗi đời chỉ lấy mấy nhánh nặng nhất — cả cây thì thành nhiễu. */
  SO_NHANH: 2,

  /**
   * TRẦN TỔNG NHÁNH — tổng độ lớn của MỌI nhánh hệ quả không vượt quá ngần này
   * so với sự kiện GỐC. 10000 = tối đa bằng đúng sự kiện gốc.
   *
   * ⚠ VÌ SAO PHẢI CÓ, tìm ra 27/07 từ ảnh chụp của founder: trước đây tổng nhánh
   * KHÔNG BỊ CHẶN BỞI BẤT CỨ THỨ GÌ. Với SO_NHANH = 2 thì một lá sinh ra
   *     gốc 100%  +  2 nhánh F1 × 70%  +  tới 4 nhánh F2 × 50%  =  tối đa 440%
   * sức mạnh của MỘT sự kiện, giáng lên TỪNG mã đang cầm. Đo thật trên một ván:
   * một lá Hack sàn làm Vàng −33,6% và Trái phiếu −23,4%, cộng giai đoạn và chen
   * chúc rồi nhân khẩu vị ×1,35 → **−94,44% trong ĐÚNG MỘT VÒNG**.
   *
   * Lỗi không nằm ở con số F1/F2 nào cụ thể mà ở chỗ TỔNG là vô hạn theo cấu
   * trúc: thêm một quan hệ nhân quả vào MT_SU_KIEN_KE_TIEP là tự động thêm sức
   * huỷ diệt, không ai phải duyệt. Trần này biến nó thành hữu hạn.
   *
   * Ý nghĩa thiết kế: lá được LẬT là sự thật, nên nó đánh đủ 100%. Nhánh hệ quả
   * là SUY ĐOÁN về tương lai, nên gộp lại không được mạnh hơn chính sự thật.
   */
  TRAN_TONG_NHANH_BP: doThamSo('TRUYEN_TRAN_TONG_NHANH_BP', 10000),
} as const;

// ---------------------------------------------------------------------------
// MẠNG TƯƠNG TÁC (founder 20/07: "bổ sung thêm cơ chế tương tác đặc biệt")
//
// Bảy tương tác, cắt từ 26 đề xuất. Nguyên tắc lọc: MỖI tương tác phải diễn
// đạt được bằng ĐÚNG MỘT dòng trong `chain`. `chain` vừa là bảng "vì sao" vừa
// là kịch bản hoạt hình — tương tác không nói gọn được thì người chơi không bao
// giờ nhận ra, mà tương tác không ai nhận ra thì bằng không.
//
// Đã cắt có chủ đích: bảng chuyển tiếp 14 link (độ sâu chuỗi ≥2 chỉ xảy ra
// <5% số trận — học không nổi); ba thẻ nén phương sai (trong hệ chia quỹ THEO
// HẠNG chúng là ba cỗ máy vỡ G3, giữ đúng một); "Mua Đuổi cưỡi bong bóng"
// (thưởng dương cho đuổi giá — chạm D22).
// ---------------------------------------------------------------------------

/**
 * T1 — CHIẾN THUẬT × SỰ KIỆN (bp).
 *
 * `ban_khong` trước đây KHÔNG có tác động PnL nào: nó chỉ tồn tại trong hai cặp
 * xung đột. Một cái tên không có cơ chế.
 *
 * Tổng mỗi hàng qua 7 sự kiện ≈ 0 — CỐ Ý. Thẻ không được dương ròng vô điều
 * kiện, nếu không nó thành thẻ-phải-lấy và giết đa dạng chiến lược.
 * Điều kiện theo SỰ KIỆN chứ không theo GIÁ, nên không đụng D22.
 */
export const MT_CHIEN_THUAT_SU_KIEN:
Partial<Record<ChienThuatId, Partial<Record<SuKienId, number>>>> = {
  ban_khong: {
    hack_san: 1500, thien_nga_den: 1500, chien_tranh: 900, tang_lai_suat: 600,
    lam_phat: -300, ha_lai_suat: -1500, bong_bong: -2700,
  },
};

/**
 * T2 — LƯỚT SÓNG × DÂY CHUYỀN.
 *
 * Bám đúng dòng chảy nhân quả thì ăn, bám nhầm thì trả giá. Suy thẳng từ
 * `MT_SU_KIEN_KE_TIEP` — KHÔNG thêm bảng số mới, một nguồn chân lý.
 *
 * Không rò rỉ thông tin ẩn: hai ô sự kiện không bao giờ liền nhau, nên tin giả
 * của ô nguồn ĐÃ lộ qua `tin_gia_lo` trước khi mắt xích này chạy.
 */
export const LUOT_SONG_DAY_CHUYEN = {
  DUNG_BP: doThamSo('LUOT_SONG_DUNG_BP', 1500),
  GAY_BP: doThamSo('LUOT_SONG_GAY_BP', -1000),
} as const;

export type BoiCanhTin = 'noi_chuoi' | 'don_doc';

/**
 * T3 — ĐỘ TIN CỦA TIN THAY ĐỔI THEO BỐI CẢNH. Đây là lever chính cho G4.
 *
 * Trước đây `TY_LE_TIN_GIA_BP` là HẰNG SỐ PHẲNG, nên bot "hoài nghi hiệu chỉnh"
 * và bot "tin mọi tin" ra CÙNG THỨ TỰ ƯU TIÊN, chỉ khác biên độ — không có gì
 * để kỹ năng hiệu chỉnh bám vào. Đó là lý do G4 không đo được gì.
 *
 * ⚠ ĐIỂM SỐNG-CHẾT: nhãn tính theo sự kiện gần nhất **BẤT KỂ thật/giả** (thông
 * tin công khai), KHÁC với nguồn rút dây chuyền của `sinhMap` (chỉ tin THẬT).
 * Lệch đó là CỐ Ý. Nếu tính theo "tin thật gần nhất" thì nhãn "nối chuỗi" tự
 * tố cáo ô trước là tin thật — bán ngược đúng thứ G4 tồn tại để đo.
 * Khoảng lệch giữa hai định nghĩa chính là chỗ kỹ năng sống.
 */
export const TY_LE_TIN_GIA_THEO_BOI_CANH: Record<BoiCanhTin, number> = {
  noi_chuoi: doThamSo('TIN_GIA_NOI_CHUOI_BP', 2000),
  don_doc: doThamSo('TIN_GIA_DON_DOC_BP', 5000),
};

/**
 * D301 — bảng tin giả dưới chu kỳ thực tế. Ahern & Sosyura, "Rumor Has It" (RFS 2015):
 * 501 tin đồn thâu tóm 2000–2011, chỉ 167 (33%) có bid thật trong 1 năm ⇒ tin ĐƠN ĐỘC
 * giả 67%. Tin NỐI CHUỖI giữ 20%: cùng bài cho thấy tin có nguồn chuyên gia chính xác
 * hơn (39%) nhưng không có số riêng cho "tin nhất quán với chuỗi" — PLAYTEST-TUNE.
 * Vẫn đi qua `tyLeTinGiaHieuDung` (nhân theo loại tin, kẹp trần) — một nguồn cho map,
 * bot hoài nghi, bảng điện tử và DTO (D61).
 */
export const TY_LE_TIN_GIA_THUC_TE: Record<BoiCanhTin, number> = {
  noi_chuoi: TY_LE_TIN_GIA_THEO_BOI_CANH.noi_chuoi,
  don_doc: 6700,
};

/**
 * T4 — KHỚP NHANH HOÀN TRƯỢT GIÁ THEO SỐ NGƯỜI DỒN.
 *
 * Sửa hai lỗi bằng một thay đổi:
 *  (a) mô tả thẻ hứa "vô dụng khi vắng người" nhưng engine áp giảm phạt PHẲNG
 *      bất kể 2 hay 5 người — lời hứa suông.
 *  (b) `khop_nhanh` + `chia_lenh` đang NHÂN DỒN (40% × 50% = cắt 80% trượt giá)
 *      — combo mạnh nhất bàn mà không ai chọn có ý thức.
 *
 * Nay Khớp Nhanh HOÀN một phần khoản phạt ĐÃ TÍNH, neo vào chính khoản phạt nên
 * không bao giờ vượt phạt ở bất kỳ hạng thanh khoản nào. Nó rời khỏi nhánh nhân
 * nên combo nhân dồn tự biến mất — không cần thêm cặp xung đột (thêm vào
 * XUNG_DOT sẽ khiến bot cấm cầm cặp này vĩnh viễn, nerf xong hết đo được).
 *
 * ⚠ CHỈ SỐ = SỐ NGƯỜI cùng nắm, không phải thứ tự bậc. Bản đầu viết
 * [0,0,3000,5000,7000] nên 2 người đã được hoàn 30% — lệch đúng một ô, và test
 * "2 người thì KHÔNG hoàn" bắt được. 2 người thì không có đám đông nào để mà
 * vượt trước, hoàn ở đó là hoàn cho một lời hứa chưa xảy ra.
 */
export const KHOP_NHANH_HOAN_BP: readonly number[] = [0, 0, 0, 3000, 5000, 7000];

/**
 * T5 — CHẶN LỖ + PHÒNG HỘ: BẢO HIỂM CÓ PHÍ.
 *
 * Lever D20 "phòng thủ phải CÓ GIÁ" áp lên tầng chiến thuật. Cộng hưởng hằng số
 * +120 là bảo hiểm miễn phí, mà ma trận tài sản đã dính đúng bệnh đó một lần
 * (phe phòng thủ từng thắng 47%).
 */
export const BAO_HIEM_CO_PHI = {
  AN_BP: doThamSo('BAO_HIEM_AN_BP', 900),
  PHI_BP: doThamSo('BAO_HIEM_PHI_BP', -250),
  /** Giai đoạn mà bảo hiểm thật sự dùng đến. */
  GIAI_DOAN_AN: ['giam', 'bien_dong'] as readonly GiaiDoanId[],
} as const;

/**
 * T6 — ĐÒN BẨY × HACK SÀN: GỌI KÝ QUỸ. Cơ chế DUY NHẤT trừ thẳng VỐN.
 *
 * ⚠ Vì sao phải trừ Vốn chứ không phạt bp: `pnl_bp` CHỈ dùng để sắp hạng chia
 * Quỹ vòng, nó không bao giờ cộng/trừ vào `von`. Nên mọi "phí" viết bằng bp chỉ
 * dịch thứ hạng — không đẩy được ai tới cháy tài khoản. Thiết kế hứa "cú đẩy
 * qua vạch cháy" bằng bp là hứa suông, đúng lớp lỗi "im lặng và tưởng đã được
 * việc" đã gặp vài lần hôm nay.
 *
 * KHÔNG phân biệt tin thật/giả: hack sàn dựng cũng gây hoảng loạn thanh lý —
 * và giữ vậy thì cơ chế này không lộ cờ tin giả.
 */
/**
 * v34 — SIẾT PHÁP LÝ: cái giá của vai ĐỘI LÁI (founder 22/08: *"đổi lại lệnh sẽ
 * ảnh hưởng thanh khoản mạnh hơn"* — và ngoài đời đội lái là thứ BẤT HỢP PHÁP,
 * nên vai này phải có một cú "bị bắt" để không dạy điều sai).
 *
 * Cùng khuôn `GOI_KY_QUY`: hình phạt TRÁNH ĐƯỢC bằng kỹ năng. Nổ khi ô lật là
 * SIẾT PHÁP LÝ (`phap_ly`) và đội lái đang phơi nhiễm quá ngưỡng — tức đọc được
 * telegraph/dư âm mà hạ vị thế trước thì không mất gì. Phạt trừ thẳng Vốn (như
 * ký quỹ), không phải bp — vì bp chỉ dịch thứ hạng, không tới được cháy (D39).
 * ⚠ MỌI SỐ LÀ PLAYTEST-TUNE (A8.2).
 */
/**
 * v34 — MANDATE TỔ CHỨC: cái giá của vai tổ chức. Không lệnh MUA nào được đưa
 * một mã vượt `TRAN_MA_BP` của NAV (kiểm TẠI LÚC ĐẶT — giá chạy làm vượt thì
 * không ép bán, nhưng không được mua thêm mã đó); không được Bán Khống.
 * ⚠ PLAYTEST-TUNE (A8.2). Bot tổ chức đọc cùng số qua `mandateCua`.
 */
export const MANDATE_TO_CHUC = {
  TRAN_MA_BP: doThamSo('MANDATE_TRAN_MA_BP', 4000),
} as const;

export const SIET_DOI_LAI = {
  /** Phơi nhiễm (bp của NAV) từ mức này trở lên mới bị siết. */
  PHOI_NHIEM_BP: doThamSo('SIET_PHOI_NHIEM_BP', 6000),
  /** Chip bị trừ thẳng khỏi Vốn. */
  MAT_CHIP: doThamSo('SIET_MAT_CHIP', 1500),
  /** Sự kiện nào là "bị bắt". */
  SU_KIEN: 'phap_ly' as const,
} as const;

export const GOI_KY_QUY = {
  /** Ngưỡng lỗ (bp) mới bị gọi ký quỹ. */
  NGUONG_LO_BP: doThamSo('KY_QUY_NGUONG_BP', -3000),
  /** Chip bị trừ thẳng khỏi Vốn. */
  MAT_CHIP: doThamSo('KY_QUY_MAT_CHIP', 800),

  /*
   * ── NỚI RỘNG (v8) — chỉ đạo founder 27/07 ─────────────────────────────────
   *
   * *"đòn bẩy high risk high reward nên top 1 cũng ko khó lắm nhma bạn hãy cân
   * bằng để nó cần kỹ năng hơn 1 tý"*.
   *
   * VÌ SAO LÁ NÀY ĐANG GẦN NHƯ MIỄN PHÍ, đo ra mới thấy: gọi ký quỹ — cơ chế DUY
   * NHẤT trừ thẳng Vốn của người cầm Đòn Bẩy — chỉ nổ ở ô `hack_san`. Đó là 1
   * trong 7 sự kiện, mà sự kiện chỉ chiếm 35% số ô ⇒ cửa nổ ~5% số ô, còn phải
   * kèm điều kiện lỗ ≥30%. Nên trong hầu hết trận, Đòn Bẩy là ×2 KHÔNG có mặt
   * sau. Đo cặp song sinh 4.000 trận: về nhất 34,6% vs 14,8% (ô trống).
   *
   * SỬA BẰNG ĐÚNG CƠ CHẾ THẬT, KHÔNG BẰNG MỘT CON SỐ. Ngoài đời margin call không
   * chờ một tin cụ thể nào — nó nổ khi vốn chủ sở hữu tụt dưới mức duy trì, ở BẤT
   * KỲ phiên nào. Thu hẹp nó về riêng `hack_san` chính là thứ làm lá này thành ×2
   * gần như vô điều kiện.
   *
   * VÌ SAO ĐÂY LÀ CẦN GẠT "KỸ NĂNG" chứ không phải cần gạt "yếu đi":
   *   · Vế LÃI KHÔNG BỊ ĐỤNG — high risk high reward giữ nguyên, đúng ý founder.
   *   · Hình phạt TRÁNH ĐƯỢC: muốn khỏi bị gọi ký quỹ thì phải không rơi vào vòng
   *     lỗ sâu, tức phải đọc telegraph · dư âm · giai đoạn rồi HẠ ĐÒN BẨY kịp lúc.
   *     Ai cầm Đòn Bẩy rồi ngồi im thì bị bào; ai biết cắt trước cơn bão thì không
   *     mất xu nào. Đó là một phép thử kỹ năng, không phải một khoản thuế.
   *   · `hack_san` VẪN nặng hơn ô thường (hoảng loạn thanh lý) — giữ đúng bản sắc
   *     T6 cũ, không xoá nó đi.
   *
   * ⚠ CÁC SỐ NÀY LÀ ĐIỂM KHỞI ĐẦU CÓ ĐO, đánh dấu MC-TUNE. Founder chốt mức cuối.
   */
  /*
   * HAI SỐ DƯỚI ĐÂY CHỌN BẰNG DÒ, KHÔNG ĐOÁN. Dò trên `scripts/do_don_bay.ts`,
   * cặp song sinh 4.000 trận, bàn 5, map 8 (`DON_BAY_KY_QUY_CU=1` để đo mức cũ):
   *
   *   ngưỡng · mất   CÓ Đòn Bẩy: hạng TB / nhất / cháy      ô trống: hạng TB / nhất
   *   (cũ, chỉ hack sàn)  2,730 / 34,6% / 27,1%              2,849 / 14,8%
   *   −2600 · 420         2,788 / 33,8% / 29,3%              2,830 / 15,2%
   *   −1800 · 700  ★      2,849 / 32,7% / 31,3%              2,813 / 15,7%
   *   −1200 · 900         2,892 / 31,9% / 33,0%              2,797 / 16,3%
   *
   * CHỌN −1800 · 700, và tiêu chí chọn là HÌNH DẠNG chứ không phải một con số:
   *   · Trước: hạng TB 2,730 < 2,849 ⇒ Đòn Bẩy TỐT HƠN Ô TRỐNG kể cả tính bình
   *     quân. Đó là bữa trưa miễn phí, không phải đánh đổi.
   *   · Ở mức chọn: 2,849 ≈ 2,813 ⇒ **hạng trung bình KHÔNG còn tốt hơn**, trong
   *     khi **số lần về nhất vẫn hơn gấp đôi** (32,7% vs 15,7%). Tức lá này giờ
   *     là một cú ĐÁNH ĐỔI THẬT: ăn nhất nhiều hơn, trả bằng 23% lần bét và tỷ lệ
   *     cháy 31,3%. Đúng "high risk high reward" mà founder muốn giữ.
   *   · −1200 · 900 đi quá: 2,892 > 2,797 thành một cú nerf, không phải cân bằng.
   *
   * ⚠ MỘT NỬA PHÉP ĐO CÒN THIẾU, PHẢI KHAI: dàn bot hiện KHÔNG BIẾT HẠ ĐÒN BẨY,
   * nên số trên đo "đòn bẩy bị bỏ mặc" chứ chưa đo "đòn bẩy được quản". Vế kỹ năng
   * — người biết cắt trước vòng xấu có hơn người ngồi im không — chỉ chứng minh
   * được bằng một con bot thứ ba biết de-lever. Cùng lỗ hổng đo lường đã ghi cho
   * Phòng Hộ và Lướt Sóng (bot không biết đặt short, không mua Bảng điện tử).
   */
  /** Ngưỡng lỗ để bị gọi ký quỹ ở ô THƯỜNG (không phải hack sàn). bp. */ // MC-TUNE
  NGUONG_LO_THUONG_BP: doThamSo('KY_QUY_NGUONG_THUONG_BP', -1800),
  /** Chip mất ở ô thường — nhẹ hơn hack sàn, vì đây là siết dần chứ không phải sập. */ // MC-TUNE
  MAT_CHIP_THUONG: doThamSo('KY_QUY_MAT_CHIP_THUONG', 700),
} as const;

/**
 * T7 — SỰ KIỆN PHỤ THUỘC GIAI ĐOẠN LIỀN TRƯỚC.
 *
 * Bảng đầy đủ 7×5 = 35 số bị cắt còn ĐÚNG BỐN dòng: người chơi gặp ~2 sự kiện
 * mỗi trận, không đời nào suy ra được 35 ô. Bốn dòng thì học được trong 3 trận.
 *
 * Chỉ đúng MỘT ô bằng 0 — nhiều ô 0 thì đoán sự kiện thành tầm thường.
 * Điều kiện "ô liền trước" luôn hợp lệ vì `sinhMap` cấm hai sự kiện liền nhau,
 * nên ô trước một sự kiện LUÔN là ô giai đoạn.
 */
export const SU_KIEN_THEO_GIAI_DOAN: readonly {
  su_kien: SuKienId; sau_giai_doan: GiaiDoanId; he_so_bp: number; vi_sao: string;
}[] = [
  {
    su_kien: 'bong_bong', sau_giai_doan: 'giam', he_so_bp: 0,
    vi_sao: 'Thị trường đang sập thì không còn bong bóng nào để thổi.',
  },
  {
    su_kien: 'ha_lai_suat', sau_giai_doan: 'giam', he_so_bp: 20000,
    vi_sao: 'Thị trường sập → ngân hàng trung ương nới tay.',
  },
  {
    su_kien: 'tang_lai_suat', sau_giai_doan: 'tang', he_so_bp: 20000,
    vi_sao: 'Thị trường nóng → siết tiền.',
  },
  {
    su_kien: 'hack_san', sau_giai_doan: 'bien_dong', he_so_bp: 15000,
    vi_sao: 'Chợ hỗn loạn → chỗ yếu lộ ra.',
  },
];

/**
 * ═══ NHÂN QUẢ ĐỐI XỨNG — VẾ GHÌM (D185) ═══════════════════════════════════
 *
 * ⚠⚠ LỖ ĐO ĐƯỢC, KHÔNG PHẢI "THÊM CHO ĐẦY ĐỦ". Bảng trên chỉ có bốn dòng và
 * toàn bộ là vế THÚC: engine biết *"chợ sập ⇒ NHTW nới tay"* (×2) và *"chợ nóng
 * ⇒ siết tiền"* (×2), nhưng **không biết vế ngược lại** — chợ đang TĂNG mà vẫn
 * rút ra "hạ lãi suất" với trọng số nền, và không gì ghìm nó.
 *
 * ─── SỐ ĐO (v36, sinh map, 5.000–6.000 seed mỗi cỡ) ────────────────────────
 *   · ô 2 là khe tin dày nhất trận: **56,1% số trận map 8** có tin ngay ở đó;
 *   · hạ-lãi-suất THẬT ở ô 2: 2,88% số trận ≈ **1/35 trận**;
 *   · trong số đó **29,9% có ô 1 đang TĂNG** — tức cắt lãi giữa lúc chợ đi lên,
 *     không một cớ kinh tế nào;
 *   · và nó ĐỊNH HÌNH CẢ TRẬN: môi trường tiền tệ RẺ trong **92,5% / 88,9% /
 *     90,9%** số ô còn lại (map 8/12/16), so với **27,2% / 35,4% / 40,9%** ở
 *     những trận không có cú hạ đó. Một cú rút ở ô 2 đẩy môi trường từ khoảng
 *     một phần ba lên chín phần mười thời lượng trận.
 *
 * Vì `lai_suat_nen` là biến TÍCH LUỸ, cú hạ sớm không có gì kéo lại trừ một cú
 * tăng — nên đây không phải nhiễu một vòng, nó là một cái khoá.
 *
 * ⚠ CỐ Ý KHÔNG ĐƯA VỀ 0: chính sách bất ngờ ngoài lịch CÓ THẬT ngoài đời (cắt
 * lãi khẩn cấp giữa lúc thị trường còn xanh). Cái sai là nó xảy ra thường như
 * đang xảy ra, không phải là nó xảy ra.
 * ⚠ Chỉ ghìm sau `tang`, KHÔNG ghìm sau `phuc_hoi`: hạ lãi giữa lúc đang hồi
 * phục là kích thích có lý, đúng vế thúc chứ không phải vế phi lý.
 * Số MC-TUNE, founder chốt (A8.2).
 */
export const SU_KIEN_THEO_GIAI_DOAN_GHIM: readonly {
  su_kien: SuKienId; sau_giai_doan: GiaiDoanId; he_so_bp: number; vi_sao: string;
}[] = [
  {
    su_kien: 'ha_lai_suat', sau_giai_doan: 'tang', he_so_bp: 4000,
    vi_sao: 'Chợ đang lên thì không có cớ để nới tay.',
  },
  {
    su_kien: 'tang_lai_suat', sau_giai_doan: 'giam', he_so_bp: 4000,
    vi_sao: 'Chợ đang sập thì siết tiền là đổ thêm dầu — hiếm, không phải không có.',
  },
];

/**
 * MỘT CỬA cho luật nhân-quả (D185). Cờ tắt ⇒ trả CHÍNH bảng cũ (so `===` được,
 * bằng chứng cấu trúc rằng trận cũ không trôi một bp nào); cờ bật ⇒ bảng cũ
 * CỘNG vế ghìm. Khuôn giống `mtKeTiep` (D157) — mọi người đọc đi một cửa, không
 * ai được chép bảng ra bản thứ hai (D61).
 */
export function suKienTheoGiaiDoan(
  doiXung: boolean,
): readonly { su_kien: SuKienId; sau_giai_doan: GiaiDoanId; he_so_bp: number; vi_sao: string }[] {
  return doiXung
    ? [...SU_KIEN_THEO_GIAI_DOAN, ...SU_KIEN_THEO_GIAI_DOAN_GHIM]
    : SU_KIEN_THEO_GIAI_DOAN;
}

/**
 * T8 — BA THẺ CHẾT: `bat_day`, `mua_duoi`, `da_dang_hoa`.
 *
 * ⚠ PHÁT HIỆN 21/07, và nó lật ngược một chẩn đoán tôi đã báo founder BA LẦN.
 *
 * Tôi liên tục cảnh báo bot "Bắt đáy" có ALPHA GIA (thắng cao nhất + cháy thấp
 * nhất) và quy nó vào D22. Sai. Đếm cơ chế trong engine mới ra sự thật:
 *
 *   bat_day · mua_duoi · da_dang_hoa  →  KHÔNG CÓ cơ chế riêng nào cả.
 *
 * Chúng chỉ tồn tại trong bảng xung đột/cộng hưởng. Nên bot "Bắt đáy" cầm
 * ['bat_day', 'chia_lenh'] thực chất là cầm MỘT lá chia_lenh (giảm 50% trượt
 * giá) cộng MỘT Ô CHẾT KHÔNG MẤT PHÍ. Thêm tài sản thanh khoản dày → gần như
 * miễn nhiễm crowding. Nó không hề canh thời điểm gì cả: nó có lá chắn miễn phí.
 *
 * Bài học: "bot X mạnh bất thường" KHÔNG đủ để kết luận cơ chế X mạnh. Phải
 * đếm xem X có cơ chế nào không đã. Tôi bỏ qua bước đó ba lần liền.
 *
 * ─── THIẾT KẾ HAI THẺ CANH THỜI ĐIỂM ─────────────────────────────────────
 * `bat_day` và `mua_duoi` phải mang ĐÚNG rủi ro mà mô tả thẻ đã hứa, và tổng
 * kỳ vọng phải ≤ 0 — D22 nói rõ "động cơ giá timing vô dụng là ĐÚNG, không
 * phải lỗi": người chơi vẫn đuổi giá dù vô ích, và chính sự bốc đồng đó mới là
 * dữ liệu đáng bán. Nên hai thẻ này KHÔNG được có lợi thế ổn định — chúng chỉ
 * được có PHƯƠNG SAI: đúng nhịp thì ăn, sai nhịp thì trả nhiều hơn.
 */
export const THE_CANH_NHIP: Record<'bat_day' | 'mua_duoi', {
  sau_giai_doan: GiaiDoanId;
  trung_bp: number;
  trung_khi: readonly GiaiDoanId[];
  truot_bp: number;
}> = {
  // Mua khi vừa sập. Bật lại thì ăn, sập tiếp thì chết — đúng mô tả thẻ.
  bat_day: {
    sau_giai_doan: 'giam',
    trung_bp: doThamSo('BAT_DAY_TRUNG_BP', 1400),
    trung_khi: ['tang', 'phuc_hoi'],
    truot_bp: doThamSo('BAT_DAY_TRUOT_BP', -1800),
  },
  // Mua đuổi khi đang tăng. Còn tăng thì ăn, quay đầu thì lãnh đủ.
  mua_duoi: {
    sau_giai_doan: 'tang',
    trung_bp: doThamSo('MUA_DUOI_TRUNG_BP', 1200),
    trung_khi: ['tang'],
    truot_bp: doThamSo('MUA_DUOI_TRUOT_BP', -1600),
  },
};

/**
 * `da_dang_hoa` — thưởng theo SỐ MÃ KHÁC NHAU đang nắm, trừ phí cố định.
 *
 * KHÔNG dùng cách "nén phương sai" (nhân PnL về gần 0): trong hệ chia Quỹ vòng
 * THEO HẠNG, nén phương sai là cỗ máy vỡ gate G3 — ngồi im hoá ra tối ưu.
 * Thưởng theo số mã thì đúng nghĩa đa dạng hoá mà không đụng phương sai, và
 * nó tự có giá: dàn mỏng ra 4 mã nghĩa là không mã nào được stack lên cấp 3.
 */
/**
 * `chan_lo` và `phong_ho` — HAI Ô CHẾT NỮA, do chính test "Ô chết" tìm ra ngay
 * sau khi tôi viết nó. Cả hai trước đó chỉ tồn tại trong cặp cộng hưởng T5;
 * cầm một mình thì không đổi một bp nào.
 *
 * Làm theo ĐÚNG mô tả thẻ, và cố ý KHÔNG dùng cách "kẹp sàn PnL": kẹp sàn là
 * nén phương sai, mà trong hệ chia Quỹ vòng THEO HẠNG nén phương sai làm ngồi
 * im thành tối ưu và vỡ gate G3. Dùng hiệu ứng theo giai đoạn thì vừa đúng mô
 * tả vừa không đụng phương sai.
 */
export const THE_PHONG_THU: Record<'chan_lo' | 'phong_ho', {
  an_bp: number; an_khi: readonly GiaiDoanId[];
  phi_bp: number; phi_khi: readonly GiaiDoanId[];
}> = {
  // "Tự chặn lỗ trong vòng. Chết ở thị trường tăng (cắt sớm)."
  chan_lo: {
    an_bp: doThamSo('CHAN_LO_AN_BP', 900), an_khi: ['giam'],
    phi_bp: doThamSo('CHAN_LO_PHI_BP', -350), phi_khi: ['tang', 'phuc_hoi'],
  },
  // "Giảm biến động. Tốn phí khi thị trường êm."
  phong_ho: {
    an_bp: doThamSo('PHONG_HO_AN_BP', 700), an_khi: ['bien_dong'],
    phi_bp: doThamSo('PHONG_HO_PHI_BP', -300), phi_khi: ['di_ngang'],
  },
};

/**
 * D5 — THẺ ĐI NGƯỢC: thưởng vị thế lệch đám, phạt vị thế theo đám.
 *
 * Đo bằng TỶ LỆ lobby (D3) nên bàn 4 và bàn 8 cùng một ngưỡng hành vi.
 *
 * ⚠ CÓ TRẦN (`TRAN_BP`). Không có trần thì cầm 4 mã hiếm là cộng dồn bốn lần và
 * thẻ này thành thẻ mạnh nhất bàn — đúng lỗi `khop_nhanh` từng mắc (nhân dồn với
 * `chia_lenh` thành combo mạnh nhất mà không ai chọn có ý thức, T4 đã sửa).
 *
 * ⚠ PHẦN PHẠT PHẢI CÓ. Thẻ chỉ-thưởng là thẻ không có quyết định: cầm là lợi, khỏi
 * cân gì. Phần phạt khi đi theo đám mới làm nó thành đánh cược vào việc đọc bàn.
 */
export const DI_NGUOC = {
  /** Tỷ lệ lobby TỪ ĐÂY TRỞ XUỐNG thì coi là vị thế lệch đám (bp). */ // MC-TUNE
  NGUONG_LECH_BP: 3400,
  /** Tỷ lệ lobby TỪ ĐÂY TRỞ LÊN thì coi là đi theo đám (bp). */ // MC-TUNE
  NGUONG_THEO_BP: 6000,
  /**
   * Thưởng mỗi mã lệch đám (bp PnL vòng).
   *
   * ⚠ 320 LÀ QUÁ MẠNH — đo được, không phải cảm tính: archetype cầm thẻ này lên
   * thẳng á quân 24,9% ngay lần đo đầu, và nó NÉN CẢ BẢNG lại đủ để gate G2
   * (gradient kỹ năng) rơi từ cách 0,37 xuống 0,04. Một thẻ khắc chế mạnh tới mức
   * làm "đọc tin đúng" hết còn ý nghĩa thì nó phá chính thứ A1 muốn đo.
   * Hạ phần THƯỞNG, GIỮ NGUYÊN phần phạt: mục đích của thẻ là làm đi-theo-đám phải
   * trả giá, không phải biến đứng-một-mình thành cỗ máy in tiền.
   */ // MC-TUNE
  THUONG_BP: 210,
  /** Phạt mỗi mã đi theo đám (bp PnL vòng). Giữ nguyên — xem trên. */ // MC-TUNE
  PHAT_BP: -420,
  /** Trần TUYỆT ĐỐI cho tổng đóng góp của thẻ, cả hai chiều (bp). */ // MC-TUNE
  TRAN_BP: 620,
} as const;

/**
 * D5 — RỦI RO ĐỐI TÁC: cả bàn cùng mua bảo hiểm thì bảo hiểm rẻ đi… và yếu đi.
 *
 * KHẮC CHẾ ĐÚNG THỨ ĐANG TRỘI. Sức mạnh phe phòng thủ đến từ `chan_lo` + `phong_ho`
 * (chặn lỗ, giảm biến động). Cơ chế này nói: khi phần lớn lobby cùng núp sau CÙNG
 * MỘT thẻ phòng thủ, phần che của thẻ đó teo lại.
 *
 * Đây là chuyện thật trong tài chính, không phải một khoản thuế bịa: ai cũng phòng
 * hộ nghĩa là không còn ai ở phía bên kia để chịu rủi ro hộ. Bảo hiểm mà cả làng
 * cùng mua thì lúc cháy nhà không ai trả nổi. Nên nó vừa cân bằng vừa dạy đúng.
 *
 * ⚠ CHỈ TEO PHẦN ĂN, KHÔNG TĂNG PHẦN PHÍ. Đánh cả hai đầu là biến thẻ phòng thủ
 * thành bẫy, và người chơi học được bài học SAI ("đừng bao giờ phòng hộ") — đúng
 * thứ D22 cấm.
 */
export const RUI_RO_DOI_TAC = {
  /** Cửa tắt để cô lập khi đo (bài học D1). */
  BAT: doThamSo('RUI_RO_DOI_TAC_BAT', 1) === 1,
  /**
   * Từ bao nhiêu phần lobby cùng cầm một thẻ phòng thủ thì bắt đầu teo (bp).
   *
   * ⚠ 6000 (60%) LÀ SỐ CHẾT — đo được, không phải suy đoán: bật và tắt cơ chế cho
   * ra kết quả Monte Carlo GIỐNG NHAU TỪNG CHỮ SỐ ở 12.000 trận. Vì ở bàn 5 ghế chỉ
   * Phòng thủ và Đa dạng hoá cùng cầm `chan_lo`, tức 2/5 = 40%, không bao giờ chạm
   * 60%. Một cơ chế không bao giờ kích hoạt thì không phải cân bằng lỏng, nó là code
   * chết đội lốt tham số.
   *
   * 4000 (40%) là ngưỡng THẤP NHẤT còn có nghĩa: đúng hai người trong năm cùng núp
   * sau một thẻ. Dưới nữa thì một người cầm cũng bị phạt, mà một người thì không
   * phải "cả làng cùng mua bảo hiểm".
   */ // MC-TUNE
  NGUONG_BP: 4000,
  /** Phần ăn CÒN LẠI khi vượt ngưỡng (bp; 5000 = còn nửa). */ // MC-TUNE
  AN_CON_BP: 5000,
} as const;

export const DA_DANG_HOA = {
  MOI_MA_BP: doThamSo('DA_DANG_MOI_MA_BP', 260),
  PHI_BP: doThamSo('DA_DANG_PHI_BP', -700),
} as const;

/**
 * ⭐⭐ v52 (D371) — ĐA DẠNG HOÁ THÔI THU TIỀN THUÊ MỖI VÒNG.
 *
 * ─── CÁI HỎNG ────────────────────────────────────────────────────────────────
 * Mắt xích `da_dang` chạy MỖI VÒNG chỉ cần lá nằm trong danh mục — không cần
 * mua gì, không cần làm gì — và nó rơi vào TẦNG DANH MỤC (`tangCuaMatXich`),
 * tức `apDinhGia` nhân nó vào MỌI vị thế đang cầm, cả sổ dài lẫn sổ khống.
 * Với bộ số cũ, `−700 + 260 × số_mã` ⇒ hoà vốn ở **2,69 mã**:
 *
 *      1 mã −440 bp/vòng (×0,956)   ·   2 mã −180 (×0,982)
 *      3 mã  +80          (×1,008)  ·   4 mã +340 (×1,034)
 *
 * Cầm 2 mã suốt 10 vòng ghi điểm = `0,982¹⁰ ≈ 0,834`, tức **bào mất 16,6% toàn
 * bộ vị thế**. Founder báo 21/09 sau khi chơi vai TỔ CHỨC: *"lõi đa dạng hóa
 * mỗi round trừ tiền trong khi t đã giữ vị thế rồi"*.
 *
 * ─── VÌ SAO NÓ TRÔI ĐƯỢC 2 THÁNG ─────────────────────────────────────────────
 * Bộ số −700/260 sinh 21/07 (commit `7c9e948`) khi `MAX_TAI_SAN` còn là **4**
 * (+1 với lá = 5) — mức hoà vốn 2,69 khi đó nằm GIỮA dải. Founder hạ trần
 * **4 → 3** ngày 27/07 (`108b03d`, spec 01 §4) và không ai đụng lại bộ số, nên
 * mức hoà vốn trôi ra SÁT TRẦN: lá chỉ lãi ở đúng hai nấc trên cùng.
 *
 * ⚠ VÀ VÌ SAO GATE KHÔNG BAO GIỜ KÊU: bot `da_dang` mua tài sản tới đủ trần
 * TRƯỚC rồi mới nhặt lá (`botUuTien.chonThe`), nên nó sống trọn ở vùng dương.
 * Người trả khoản này là **vai TỔ CHỨC** — `VAI.to_chuc.loi_ghim` ghim lá từ
 * vòng 1, lúc còn 0–2 mã. Gate chấm BOT, bảng vai chấm VAI; không ai đọc bảng vai.
 *
 * ─── ĐO (4.000 trận · bàn 8 · map 12 · par 12,5% · G1–G5 xanh ở MỌI bộ) ──────
 * Hàng phải đọc là `VAI (v34) · to_chuc`, KHÔNG phải hàng bot — xem docstring
 * `daDangV52` ở holdem_balance.ts.
 *
 *      bộ            phí/mã    hoà vốn   1 mã   4 mã   to_chuc      ca_nhan
 *      zero           0/0        —         0      0    4,53 · 8,8%  16,9%
 *      CŨ          −700/260    2,69 mã  −440   +340    4,63 · 8,8%  17,0%
 *  ★   f            −30/35     0,86       +5   +110    4,14 · 13,2% 16,1%
 *      e            −50/55     0,91       +5   +170    3,96 · 16,1% 15,5%
 *      d            −80/85     0,94       +5   +260    3,72 · 20,9% 14,6%
 *      c           −120/125    0,96       +5   +380    3,43 · 27,6% 13,3%
 *      b           −170/175    0,97       +5   +530    3,12 · 34,9% 11,9%
 *      a           −250/260    0,96      +10   +790    2,69 · 47,2%  9,6%
 *
 * ⭐⭐ ĐỌC HÀNG `zero` TRƯỚC KHI ĐỔI BỘ SỐ NÀY LẦN SAU. Gỡ SẠCH vế số của lá ra
 * thì tổ chức đứng nguyên 8,8% — y hệt bộ cũ. Tức khoản bào đầu trận và khoản
 * thưởng cuối trận TRIỆT TIÊU NHAU qua một trận: bộ số cũ trị giá đúng bằng
 * KHÔNG, nó chỉ đổi LỊCH thu-chi. Và người chơi chỉ thấy vế bào, vì nó hiện
 * trên bảng VÌ SAO mỗi vòng đầu còn vế trả thì tan trong NAV.
 *
 * ⚠ VÌ SAO CHỌN f CHỨ KHÔNG PHẢI e (founder chốt 21/09): bàn đo là SÀN, không
 * phải mức thật. Bot KHÔNG biết dùng đặc quyền còn lại của vai — không con nào
 * đọc `dongTienThoCua` (thấy VẮNG/VỪA/ĐÔNG cả bàn), nên người thật cầm tổ chức
 * sẽ cạnh hơn con số này. Đặt SÀN ở par là đúng; đặt mức thật ở par là vượt.
 * Cùng lý lẽ `vai.ts` đã ghi ở §"ĐỌC CHO ĐÚNG" cho đội lái/cá mập.
 *
 * ⭐ PLAYTEST-TUNE — founder chốt HƯỚNG (giữ cấu trúc, kéo hoà vốn xuống ~1 mã)
 * rồi chốt BỘ f từ bảng trên; gate chọn dải (A8.2).
 */
export const DA_DANG_HOA_V52 = {
  MOI_MA_BP: doThamSo('DA_DANG_V52_MOI_MA_BP', 35),
  PHI_BP: doThamSo('DA_DANG_V52_PHI_BP', -30),
} as const;

// ---------------------------------------------------------------------------
// LÕI VỐN A — ĐẢO DANH MỤC (founder 27/07)
// ---------------------------------------------------------------------------

/**
 * ĐẢO DANH MỤC = BÁN A + MUA B trong một nhịp, chịu ĐỒNG THỜI hai khoản.
 *
 * ⚠ VẾ THỨ HAI MỚI LÀ VẾ GIỮ CẢ THIẾT KẾ ĐỨNG, và founder gạch chân đúng nó:
 * nếu đảo chỉ mất phí mà KHÔNG phải xếp hàng khớp lệnh cùng những người mua mới
 * ở mã đích, thì đảo danh mục trở thành ĐƯỜNG NÉ CROWDING — thấy mã mình đang ôm
 * bị cả bàn dồn vào thì bấm đảo là thoát, và trượt giá do đông (căng thẳng trung
 * tâm của cả mode, D24 mục 16.7) mất sạch tác dụng chỉ với một nút bấm.
 *
 * Nên hàng chờ ở đây KHÔNG đo "ai đang nắm mã B" (crowding đã đo cái đó rồi) mà
 * đo DÒNG TIỀN MỚI VÀO B TRONG ĐÚNG VÒNG NÀY: người đảo sang, người mua thẳng,
 * người gom thêm — tất cả cùng tranh một sổ lệnh. Hai lớp không trùng nhau:
 * crowding là ÁP LỰC TỒN KHO, hàng chờ là ÁP LỰC LỆNH. Cả bàn cùng chạy khỏi
 * một mã sang một mã khác thì lớp thứ hai chính là thứ chặn cú chạy đó rẻ.
 *
 * Vì hàng chờ đếm cả người mua thẳng nên người đảo KHÔNG bị phạt hai lần cho
 * cùng một việc: họ trả phí chuyển đổi (phần "bán A") cộng đúng cái hàng mà bất
 * kỳ ai mua B hôm nay cũng phải xếp.
 *
 * ⚠ MỌI SỐ DƯỚI ĐÂY LÀ ĐIỂM KHỞI ĐẦU CHỜ MONTE CARLO (D24 mục 16.10). Hai phía
 * đều là lỗi: nhẹ quá thì đảo là cửa thoát miễn phí; nặng quá thì không ai dám
 * sửa danh mục và trận thành "chọn xong vòng 1 rồi ngồi chịu" — mà đó lại là
 * đúng thứ G3 (ngồi im không được trội) tồn tại để chặn.
 */
export const DAO_DANH_MUC = {
  /** Vòng sớm nhất được đảo. Vòng 1 chưa cầm gì để mà bán. */
  TU_VONG: 2,
  /** Phí giao dịch chuyển đổi CỐ ĐỊNH, trừ thẳng vào biên vòng đó. */ // MC-TUNE
  PHI_CHUYEN_DOI_BP: 100,
  /**
   * Hệ số hàng chờ — CÙNG ĐƠN VỊ với `HE_SO_TAC_DONG_K` và dùng chung công thức
   * `K × DONG_QUY_CHIEU × tỷ_lệ / L`, nên đọc thẳng được: 25 nghĩa là một dòng
   * tiền mới cỡ nào đó đẩy giá bằng 25/45 ≈ 5,5 phần 10 so với cùng cỡ tồn kho.
   *
   * Thấp hơn K là CỐ Ý: đứng xếp hàng một vòng nhẹ hơn ôm hàng bị kẹt nhiều vòng.
   */ // MC-TUNE
  HE_SO_XEP_HANG_K: 25,
  /**
   * Từ mấy người cùng vào một mã trong MỘT vòng thì mới thành hàng chờ.
   *
   * Một mình vào thì không có ai để mà tranh fill — cùng lý do `crowding` bỏ qua
   * `dong <= 1` và giẫm đạp cần `soBo >= 2`. Hạ xuống 1 là biến hàng chờ thành
   * thuế phẳng đánh vào MỌI lệnh mua, và ở nhịp chọn bài (vòng 1·2·4·5 ai cũng
   * mua) thuế phẳng đó chỉ có một người hưởng: người không mua gì.
   */ // MC-TUNE
  NGUONG_XEP_HANG: 2,
} as const;

// ---------------------------------------------------------------------------
// LÕI VỐN B — KHOÁ TÀI SẢN 2 VÒNG (founder 27/07)
// ---------------------------------------------------------------------------

/**
 * NẮM GIỮ DÀI HẠN — cam kết trước, ăn ưu đãi, và trả rất đắt nếu bẻ kèo.
 *
 * Đây là đối trọng của cơ chế A, và hai cái phải đọc cùng nhau mới thấy hình:
 * A cho người chơi một cần gạt để CHẠY, B cho một cần gạt để Ở LẠI. Có A mà
 * không có B thì mọi vòng đều là cơ hội đổi ý, và "khẩu vị rủi ro" đo được chỉ
 * còn là phản xạ theo ô vừa lật. Có B thì lựa chọn xảy ra TRƯỚC khi biết kết
 * quả — đúng loại tín hiệu hành vi mà A1 muốn bán.
 *
 * Ba quyền lợi cố ý nhắm vào ba lớp khác nhau, không phải ba cách cộng điểm:
 *   · giảm trượt giá  → lớp TỒN KHO (crowding);
 *   · ưu tiên khớp    → lớp LỆNH (hàng chờ của cơ chế A) — người khoá đứng đầu
 *     hàng nên không chờ, người lướt sóng xếp sau và chờ cả phần của người khoá;
 *   · thưởng sống sót → lớp GIAI ĐOẠN, và chỉ nổ trong bão.
 *
 * "Sống sót qua giai đoạn Giảm/Biến động mạnh" đọc là CÒN CẦM MÃ ĐÓ KHI BÃO ĐI
 * QUA, không phải "mã đó có lãi". Đọc theo cách kia thì tiền thưởng rơi vào tay
 * người may — mà thứ cơ chế này muốn trả công là việc KHÔNG BỎ CHẠY, và đó là
 * thứ người chơi quyết được.
 *
 * ⚠ MỌI SỐ DƯỚI ĐÂY LÀ ĐIỂM KHỞI ĐẦU CHỜ MONTE CARLO.
 */
export const KHOA_TAI_SAN = {
  /** Chu kỳ khoá dài mấy vòng LIÊN TIẾP, tính cả vòng bật. */
  SO_VONG: 2,
  /** Trượt giá do đông CÒN LẠI ở mã đang khoá (bp; 5000 = giảm một nửa). */ // MC-TUNE
  TRUOT_GIA_CON_BP: 5000,
  /** Thưởng mỗi vòng khi mã khoá đi qua bão mà vẫn còn trong danh mục. */ // MC-TUNE
  THUONG_SONG_SOT_BP: 150,
  /** Giai đoạn nào tính là "bão". Sự kiện không tính — bão là REGIME, không phải tin. */
  GIAI_DOAN_BAO: ['giam', 'bien_dong'] as readonly GiaiDoanId[],
  /**
   * Phạt bẻ kèo, trừ thẳng biên vòng đó.
   *
   * Đặt nặng hơn HẲN tổng thưởng có thể ăn trong chu kỳ (2 × 150) là bắt buộc:
   * nếu phạt ≤ thưởng thì chiến lược tối ưu là luôn bật khoá rồi bẻ khi ô xấu,
   * tức khoá thành quyền chọn miễn phí và cả cơ chế cam kết là trang trí.
   */ // MC-TUNE
  PHAT_BE_KEO_BP: 600,
  /**
   * Bẻ kèo → vốn bị GIAM bấy nhiêu vòng kế tiếp: không Tăng cam kết, không khảo
   * sát lại thẻ. Vốn còn lại nằm im trong ví Cash đúng nghĩa đen.
   */
  GIAM_VON_SO_VONG: 1,
} as const;

// ---------------------------------------------------------------------------
// ĐẶC QUYỀN THẺ CHIẾN THUẬT (D33, founder 27/07)
// ---------------------------------------------------------------------------

/**
 * MỖI THẺ MỞ MỘT KHÔNG GIAN HÀNH ĐỘNG RIÊNG, không còn chỉ đổi một con số.
 *
 * ─── ĐỌC TRƯỚC KHI TINH CHỈNH ──────────────────────────────────────────────
 * D33 ghi thẳng cái bẫy: ĐẶC QUYỀN KHÓ CÂN BẰNG HƠN CON SỐ. Con số chỉnh được
 * liên tục ±5%; đặc quyền NHỊ PHÂN — không có "chọn được 1,3 tài sản". Lệch thì
 * phải đổi HÌNH DẠNG đặc quyền, không tinh chỉnh được. Nên mọi số ở đây là điểm
 * khởi đầu, và cả cụm BẮT BUỘC qua gate Monte Carlo trước khi tin.
 *
 * ─── VÌ SAO MỖI ĐẶC QUYỀN ĐỀU CÓ GIÁ LẶP LẠI ───────────────────────────────
 * D33: "đặc quyền phải có GIÁ LẶP LẠI, không mua một lần hưởng mãi". Không có
 * vế đó thì lá mạnh nhất (Chặn Lỗ — trần thiệt hại, trong một trò mà một lá có
 * thể xoá 94% tài khoản) là thẻ-phải-lấy, và ba lá còn lại không bao giờ được
 * chọn. Nên: Chặn Lỗ trả phí bảo hiểm MỖI vòng, Phòng Hộ trả phí mỗi lệnh short,
 * Đa Dạng Hoá trả bằng ô danh mục + hệ số stack giảm dần, Lướt Sóng trả bằng
 * chính phí mở bảng, Khớp Nhanh trả bằng việc chỉ che ĐÚNG họ trượt giá.
 *
 * ⚠ ĐẶC QUYỀN LÀ CỦA THẺ, KHÔNG PHẢI CỦA GẮN (`gan`). Attachment quyết định
 * phần SỐ (xung đột/cộng hưởng/đòn bẩy) tác động lên mã nào; đặc quyền là quyền
 * BẤM ĐƯỢC MỘT NÚT — nó không có mã nào để mà gắn vào.
 */
export const DAC_QUYEN = {
  /**
   * KHỚP NHANH — "chịu ít trượt giá hơn người khác khi chen chúc / bỏ bài /
   * thoát hàng / đảo danh mục" (D33).
   *
   * Ba lớp dưới đây là BA KHOẢN KHÁC NHAU mà trước D33 lá này không chạm tới:
   * nó chỉ hoàn một phần phạt chen chúc (T4, `KHOP_NHANH_HOAN_BP`). Ba khoản
   * còn lại đều cùng họ TRƯỢT GIÁ nên chúng thuộc về thẻ này, và cộng lại mới
   * đủ để lá "đổi con số đội lốt đặc quyền" (chữ của D33) thành một lá đáng chọn.
   *
   * Đơn vị: bp CÒN LẠI (5000 = giảm một nửa).
   */
  KHOP_NHANH: {
    /** Hàng chờ khớp lệnh của mã vừa vào (LÕI VỐN A). */ // MC-TUNE
    XEP_HANG_CON_BP: 5000,
    /** Phí chuyển đổi cố định của một lần Đảo danh mục. */ // MC-TUNE
    DAO_PHI_CON_BP: 5000,
    /** Phần RÚT KHẨN của phí cắt lỗ — "thoát hàng" đúng nghĩa đen. */ // MC-TUNE
    RUT_KHAN_CON_BP: 5000,
    /**
     * v50 (D345) — PHÍ MUA BÁN của lệnh (trượt giá + vội vàng) còn lại khi cầm lá. Founder 16/09:
     * *"lõi khớp nhanh thì được giảm mạnh"*. Trước v50 lá này không chạm khoản phí lớn nhất của
     * trận NAV (phí lệnh) — chỉ ba khoản phụ ở trên. ⭐ PLAYTEST-TUNE.
     */
    LENH_CON_BP: doThamSo('PHI50_KN_CON_BP', 3000),
  },

  /**
   * ĐA DẠNG HOÁ — "được chọn 2 tài sản một vòng thay vì 1" (D33).
   *
   * ⚠ D33 tự cảnh báo lá này lệch mạnh: nó "vừa chia đôi rủi ro tập trung VỪA
   * nhân đôi cửa ăn tin tốt — hai lợi ích, không phải một". Giá lặp lại của nó
   * là thứ đã có sẵn trong engine và KHÔNG cần thêm khoản phạt mới: ô danh mục
   * chặn ở `MAX_TAI_SAN`, và `CAP_STACK_BP` giảm dần nên dàn mỏng ra hết trần là
   * tự bỏ mất cấp 3 của mọi mã. Thêm một khoản thuế nữa ở đây là phạt hai lần.
   *
   * ⚠ ĐOẠN TRÊN VIẾT KHI `MAX_TAI_SAN` CÒN LÀ 4 (sửa 21/09, D371). Founder hạ
   * trần 4 → 3 ngày 27/07 (commit `108b03d`, spec 01 §4) và chú thích ở đây
   * không ai sửa, nên suốt từ đó nó nói "4 mã / 5 mã" trong khi số thật là
   * "3 mã / 4 mã". Đừng gõ lại con số vào câu chữ — trần thật luôn đọc từ
   * `maxTaiSanCua()` bên engine, đây chỉ là chỗ giải thích.
   */
  DA_DANG_HOA: {
    /** Số thẻ TÀI SẢN lấy được trong một vòng khi cầm lá này. */
    TAI_SAN_MOI_VONG: 2,
    /**
     * D-27/07 điều 3 — NỚI THÊM TRẦN SỐ MÃ GIỮ ĐỒNG THỜI (`MAX_TAI_SAN`).
     *
     * ⚠ HAI TRẦN KHÁC NHAU, RẤT DỄ NHẦM: `TAI_SAN_MOI_VONG` là TỐC ĐỘ (mỗi vòng
     * nhặt được mấy lá), còn cái này là SỨC CHỨA (tổng cộng ôm được mấy mã). Lá
     * này trước 27/07 chỉ nới tốc độ — tức nó lấp đầy 4 ô nhanh hơn rồi dừng ở
     * đúng chỗ mọi người khác dừng. Founder muốn nó ôm được NHIỀU MÃ HƠN.
     *
     * ⚠ KHÔNG PHẢI BUFF MIỄN PHÍ, và đây là lý do không cần thêm thuế đối trọng:
     * `CAP_STACK_BP` = [10000, 16000, 20000] giảm dần theo bản sao, nên sức mạnh
     * nằm ở chỗ DỒN. Vốn một vòng chia cho 4 mã thay vì 3 thì mỗi mã mỏng đi
     * 1/4, và ô thứ 4 chỉ đáng khi mã thứ 4 hợp giai đoạn hơn phần còn lại —
     * đúng nghĩa "đa dạng hoá": bớt phương sai, không thêm kỳ vọng.
     *
     * ⚠ "4 thay vì 3", KHÔNG phải "5 thay vì 4" — sửa 21/09 (D371) cùng lý do
     * ghi ở docstring `DA_DANG_HOA` ngay trên: trần hạ 4 → 3 từ 27/07.
     */ // MC-TUNE
    TRAN_TAI_SAN_THEM: doThamSo('DA_DANG_TRAN_TAI_SAN_THEM', 1),
  },

  /**
   * PHÒNG HỘ — "cấp thêm nút phòng hộ mỗi vòng = SHORT: chọn ở vòng này, lệnh
   * KHỚP Ở VÒNG SAU" (D33).
   *
   * ─── ĐỘ TRỄ MỘT VÒNG LÀ TOÀN BỘ NỘI DUNG CỦA LÁ NÀY ────────────────────────
   * Founder nêu đúng ví dụ: "uptrend 2 vòng liên tiếp sinh bong bóng → short để
   * cược vào cú sập. Nếu là tin giả, hoặc bong bóng không vỡ vì hạ lãi suất, thì
   * chịu." Nên short KHÔNG được khớp ngay: khớp ngay là biết kết quả rồi mới đặt,
   * tức một quyền chọn miễn phí. Đặt trước — chịu hậu quả sau — chính là thứ A1
   * muốn đo (lựa chọn xảy ra TRƯỚC khi biết kết quả).
   *
   * ⚠ ĂN ĐÚNG NGHỊCH ĐẢO CỦA VIỆC NẮM GIỮ, KỂ CẢ NHIỄU. Cùng một lần rút nhiễu
   * (`rngAt(seed,'holdem_nhieu',vong,ma)`) nên nó là phòng hộ THẬT, không phải
   * một canh bạc thứ hai chồng lên. Không cần domain RNG mới ⇒ không xê dịch
   * dòng số của bất kỳ lần rút nào khác ⇒ trận cũ replay không đổi.
   *
   * Kỳ vọng ÂM nhẹ (hệ số < 100% cộng phí cố định): đúng bản chất bảo hiểm mà
   * `mo_ta` của lá đã hứa ("trả phí đều, đổi lấy việc không lãnh đòn quá nặng"),
   * và là thứ giữ nó khỏi thành nút-bấm-là-đúng.
   */
  PHONG_HO: {
    /** Bao nhiêu phần của cú nghịch đảo thật sự vào túi (bp). */ // MC-TUNE
    HE_SO_BP: 8000,
    /** Phí mở vị thế, trừ thẳng biên vòng KHỚP. */ // MC-TUNE
    PHI_BP: 200,
    /** Trần độ lớn tuyệt đối một lệnh short (bp) — chống một lá xoá cả vòng. */ // MC-TUNE
    TRAN_BP: 3000,
  },

  /**
   * LƯỚT SÓNG — Bảng điện tử SẠCH (hết trễ 1 vòng, hết sương mù) + tuỳ chọn
   * DỰ BÁO 3 tên thẻ khả năng cao ở vòng sau (D33).
   *
   * ─── PHƯƠNG ÁN A: LUÔN CHÈN MỘT TÊN SAI ────────────────────────────────────
   * Founder chốt 27/07. Không phải "chỉ chèn khi đo thấy quá mạnh": luôn luôn.
   * Nó biến đặc quyền từ BIẾT TRƯỚC thành BIẾT HẸP HƠN — thứ cân bằng dễ hơn
   * nhiều vì nó không bao giờ tiệm cận đáp án dù entropy map thấp tới đâu.
   *
   * ─── ENTROPY Ô KẾ ĐÃ ĐO (điều kiện bắt buộc của D33) ───────────────────────
   * `scripts/holdem_entropy_o_ke.ts`, 20.000 map, điều kiện hoá theo HAI ô công
   * khai gần nhất (đúng thứ người chơi nhìn thấy, không có cờ tin giả):
   *       map  8 → H 3,04 bit · 8,75 ứng viên hiệu dụng · top-3 phủ 52,4%
   *       map 16 → H 3,01 bit · 8,62 ứng viên hiệu dụng · top-3 phủ 52,9%
   * Tức top-3 chỉ đúng khoảng một nửa số lần — CÒN XA đáp án, nên con số 3 an
   * toàn. Chỗ hẹp nhất là bối cảnh `bong_bong(thật) → tăng` (2,3–2,5 ứng viên,
   * top-3 phủ ~89%): đó là nhánh PHỒNG của `BONG_BONG.CHUOI_PHONG` đang ép hai ô
   * liền. ĐÚNG chỗ mà "luôn chèn một tên sai" phải tồn tại — không có nó thì ở
   * hành lang này dự báo gần bằng đáp án.
   */
  LUOT_SONG: {
    /** Số tên hiện ra. */
    SO_TEN: 3,
    /**
     * Số tên ĐẢM BẢO SAI trong đó. 1 = phương án A.
     *
     * ⚠ Đây là SÀN, không phải trần: hai tên còn lại là hai ứng viên nặng ký
     * nhất, và chúng cũng có thể sai. Đặc quyền hứa "một trong ba chắc chắn
     * không phải", KHÔNG hứa "hai tên kia chắc chắn có đáp án".
     */
    SO_TEN_SAI: 1,
  },

  /**
   * CHẶN LỖ — "đặt một mức sụt giảm cố định làm sàn (CHƯA TÍNH trượt giá và kẹt
   * thanh khoản), để sự kiện bất ngờ không xoá sạch" (D33).
   *
   * ⚠ VẾ "CHƯA TÍNH TRƯỢT GIÁ" LÀ VẾ QUAN TRỌNG NHẤT, đừng đọc lướt: sàn áp lên
   * phần LÕI của vòng (giai đoạn · echo · thẻ), rồi trượt giá và hàng chờ mới
   * cộng vào SAU. Kết quả cuối CÓ THỂ thủng sàn — đúng như ngoài đời, lệnh
   * stop-loss không bảo đảm bạn khớp được ở đúng giá đã đặt. Cài sàn lên tổng
   * cuối là hứa một thứ thị trường thật không hứa.
   *
   * ⚠ SÀN KHÔNG PHẢI LÀ NÉN PHƯƠNG SAI. `THE_PHONG_THU` cố ý tránh "kẹp sàn PnL"
   * vì trong hệ chia Quỹ vòng THEO HẠNG, nén phương sai làm ngồi im thành tối ưu
   * và vỡ gate G3. Sàn ở đây chỉ cắt ĐUÔI TRÁI cực đoan (−25%/vòng) chứ không
   * kéo phân bố về giữa, và nó có phí đều mỗi vòng nên không miễn phí.
   *
   * D33 xếp lá này MẠNH NHẤT trong năm lá. Nếu Monte Carlo xác nhận thì cần gạt
   * đúng là `SAN_BP` (nới sàn ra) và `PHI_MOI_VONG_BP`, KHÔNG phải bỏ đặc quyền.
   */
  CHAN_LO: {
    /** Mức sụt giảm tối đa của phần lõi trong một vòng (bp). */ // MC-TUNE
    SAN_BP: 2500,
    /** Phí bảo hiểm, trừ MỖI vòng dù sàn có chạm hay không. */ // MC-TUNE
    PHI_MOI_VONG_BP: 120,
  },

  /**
   * ĐI NGƯỢC SỐ ĐÔNG (D40 + founder nhắc lại 28/07: "đặc quyền của đi ngược số
   * đông sẽ cho mình biết bên kia cầm gì") — nhìn xuyên màn che danh mục.
   *
   * Chỉ có nghĩa từ v10: danh mục đối thủ ẨN theo thiết kế (D40 — "lừa nhau
   * bằng THÔNG TIN"), lá này là con dao xuyên màn đó.
   *
   * ⚠ TỶ LỆ, KHÔNG PHẢI SỐ TUYỆT ĐỐI — founder yêu cầu thẳng trong D40: "thấy
   * 4/4 đối thủ ở bàn 5 ghế là thấy hết bàn, còn 4/7 ở bàn 8 ghế mới là một
   * phần... Phải quy chiếu theo TỶ LỆ". Số gốc founder cho (cấp 1→2 người ·
   * 2→3 · 3→4) đặt trên bàn 5 ghế = 4 đối thủ, quy ra đúng ba mức dưới:
   * 2/4 = 50% · 3/4 = 75% · 4/4 = 100%. Sàn 1 người (cầm lá thì phải thấy gì đó).
   */
  DI_NGUOC: {
    TY_LE_THAY_BP: [5000, 7500, 10000] as readonly number[],
  },
} as const;

/**
 * Giá mở Bảng điện tử theo HẠNG — một cửa duy nhất, server suy, client vẽ (C4).
 *
 * ⚠ Đừng dựng bảng giá thứ hai ở client hay ở tầng API. Ba hạng đã là ba con số
 * dễ chép nhầm, và chép nhầm ở đây là "màn hình niêm yết một đằng, engine trừ
 * một nẻo" — đúng lớp lỗi mà `PHI_BANG_DIEN_TU` trong catalog sinh ra để chặn.
 */
export function giaMoBang(coLuotSong: boolean, muonDuBao: boolean): number {
  if (!coLuotSong) return BANG_DIEN_TU.PHI_MO;
  return BANG_DIEN_TU.PHI_MO_LUOT_SONG
    + (muonDuBao ? BANG_DIEN_TU.PHI_DU_BAO_THEM : 0);
}

// ---------------------------------------------------------------------------
// D35 HƯỚNG 1 — CAM KẾT = ĐÒN BẨY (v8, 27/07)
// ---------------------------------------------------------------------------

/**
 * VÌ SAO CƠ CHẾ NÀY TỒN TẠI — chẩn đoán D35, nguyên văn từ CLAUDE.md:
 * "thứ hạng trong vòng xếp theo `pnl_bp` — PHẦN TRĂM lãi/lỗ — mà phần trăm
 * KHÔNG phụ thuộc số vốn cam kết. Hai người danh mục giống hệt nhau, một bỏ
 * 9.500 một bỏ 500, PnL% bằng nhau → HẠNG BẰNG NHAU."
 *
 * Nay tỷ lệ cam kết NHÂN THẲNG vào `pnl_bp` của chính người cam kết. Cam kết
 * lớn ⇒ vượt lên xa hơn khi đọc đúng, chìm sâu hơn khi đọc sai. Đó là cần gạt
 * KHẨU VỊ RỦI RO mà founder đặt hàng 19/07 ("cược lớn ăn đậm hoặc cháy tài
 * khoản, vừa vui vừa trung thực vừa đo được khẩu vị rủi ro") và là cột dữ liệu
 * B2B đắt nhất (A1).
 *
 * ⚠ KHÔNG PHẠM A3.9. Ai cũng khởi điểm `START_VON` bằng nhau và không có đường
 * nào để tiền/Q NGOÀI trận mua thêm Vốn TRONG trận. Đòn bẩy ở đây mua bằng
 * RỦI RO, không mua bằng ví.
 *
 * ─── BA LỰC ĐỐI TRỌNG, vì đòn bẩy trần trụi làm all-in HẤP DẪN HƠN ─────────
 * Founder cấm thẳng "kiểu vô não all-in" (27/07). Ba lực dưới đây phải cùng
 * tồn tại; bỏ bất kỳ cái nào là all-in thành nước đi trội trở lại.
 *
 * (1) ĐƯỜNG CONG LÕM (căn bậc hai). Phần thưởng đòn bẩy tăng NHANH ở đoạn đầu
 *     rồi chậm dần: với tham số khởi đầu dưới đây, đi từ 10% → 50% Vốn mua
 *     được +0,47× còn 50% → 100% chỉ mua thêm +0,23×. Gấp đôi rủi ro mà mua
 *     chưa tới một nửa phần lợi ⇒ mức cam kết TỐI ƯU nằm ở GIỮA, không ở biên.
 *
 * (2) BẤT ĐỐI XỨNG LÃI/LỖ (`LECH_LO_BP`). Vế lỗ bị nhân mạnh hơn vế lãi. Đây
 *     là lực BẮT BUỘC chứ không phải gia vị: bàn 5 ghế chỉ trả thưởng 3 suất
 *     (`CHIA_QUY_VONG.TRONG_SO` có ba số), nên tụt từ hạng 4 xuống hạng 5
 *     KHÔNG MẤT GÌ. Đuôi dưới bị cụt như vậy tự nó tạo LỒI có lợi cho phương
 *     sai — tức đòn bẩy đối xứng vẫn là nước đi trội. `LECH_LO_BP` bù đúng chỗ
 *     đó, và nó cũng trung thực với đời: vay mà lỗ thì lỗ trên vốn vay.
 *
 * (3) PHÍ TÀI TRỢ (`PHI_BP`) — khoản DUY NHẤT trong cụm này trừ thẳng VỐN.
 *     Hai lực trên chỉ dịch thứ hạng; theo đúng cảnh báo đã ghi ở `GOI_KY_QUY`
 *     ("mọi phí viết bằng bp chỉ dịch thứ hạng — không đẩy được ai tới cháy"),
 *     phải có ít nhất một khoản chạm Vốn thì rủi ro cháy mới tăng theo cam kết.
 *     Thu trên phần cam kết VƯỢT ngưỡng, mỗi vòng, dù lãi hay lỗ — đúng lãi
 *     vay ký quỹ ngoài đời.
 *
 * ⚠ MC-TUNE — TOÀN BỘ SỐ DƯỚI ĐÂY LÀ ĐỀ XUẤT, CHƯA CHỐT (A8.2). Chúng là tham
 * số kinh tế mới; agent không có quyền chốt. Bảng Monte Carlo kèm báo cáo là
 * bằng chứng để founder chọn, không phải là sự phê duyệt.
 */
export const DON_BAY_CAM_KET = {
  /**
   * Dưới ngưỡng này (bp Vốn đầu vòng) thì hệ số đúng bằng 1,0 — không đòn bẩy.
   *
   * 1000 (10%) chọn để `CAM_KET_NEN` = 500 trên `START_VON` = 10.000 (tức 5%)
   * nằm GỌN dưới ngưỡng: khoản ai cũng buộc phải đóng thì không được tính là
   * một quyết định rủi ro. Nếu không thì "keo kiệt" cũng mang đòn bẩy, và cả
   * trục đo mất điểm 0.
   */ // MC-TUNE
  NGUONG_BP: doThamSo('DON_BAY_NGUONG_BP', 1000),
  /** Phần CỘNG THÊM tối đa vào hệ số (bp). 7000 ⇒ trần 1,70× ở cam kết 100%. */ // MC-TUNE
  TOI_DA_BP: doThamSo('DON_BAY_TOI_DA_BP', 7000),
  /** Vế LỖ nhân thêm bằng chừng này so vế LÃI (bp; 12000 = lỗ nặng hơn 1,2 lần). */ // MC-TUNE
  LECH_LO_BP: doThamSo('DON_BAY_LECH_LO_BP', 12000),
  /**
   * TRẦN TỔNG khi CHỒNG với lá chiến thuật `don_bay` (bp).
   *
   * ⚠ ĐÂY LÀ BẪY B CỦA CẢ ĐỢT: lá Đòn Bẩy 2× đã nhân `pnl_bp` bên trong
   * `dungChuoi`, cam kết nhân TIẾP ở `chotPhien` ⇒ nhân hai lần, đỉnh 2,0 ×
   * 1,70 = 3,40×. Trần này kẹp TÍCH của hai hệ số, nên người cầm lá Đòn Bẩy
   * mua được ít đòn bẩy-từ-cam-kết hơn hẳn — đúng ý: đã vay rồi thì không vay
   * chồng vô hạn. 24000 = 2,40×, tức lá 2× cộng thêm tối đa 1,20× từ cam kết.
   */ // MC-TUNE
  TRAN_TONG_BP: doThamSo('DON_BAY_TRAN_TONG_BP', 24000),
  /** Phí tài trợ mỗi vòng, tính trên phần cam kết VƯỢT ngưỡng (bp). */ // MC-TUNE
  PHI_BP: doThamSo('DON_BAY_PHI_BP', 150),
} as const;

/** Căn bậc hai số nguyên (Newton) — không dùng Math.sqrt để tất định tuyệt đối. */
function isqrt(n: number): number {
  if (n <= 0) return 0;
  let x = Math.floor(Math.sqrt(n));
  while (x * x > n) x -= 1;
  while ((x + 1) * (x + 1) <= n) x += 1;
  return x;
}

/**
 * HỆ SỐ ĐÒN BẨY của một tỷ lệ cam kết (bp vào → bp ra, 10000 = 1,0×).
 *
 * Đường cong LÕM: `10000 + TOI_DA_BP × √u` với u = phần vượt ngưỡng đã chuẩn
 * hoá về [0,1]. Xem lực đối trọng (1) ở docstring `DON_BAY_CAM_KET` — chính
 * hình dạng này là thứ đẩy mức cam kết tối ưu ra khỏi biên 100%.
 */
export function heSoDonBayBp(tyLeCamKetBp: number): number {
  const vuot = Math.min(10000, tyLeCamKetBp) - DON_BAY_CAM_KET.NGUONG_BP;
  if (vuot <= 0) return 10000;
  const dai = 10000 - DON_BAY_CAM_KET.NGUONG_BP;
  const uBp = Math.min(10000, Math.floor((vuot * 10000) / dai));
  // √(u) tính trong thang bp: √(uBp/10000) × 10000 = √(uBp × 10000).
  const canBp = isqrt(uBp * 10000);
  return 10000 + Math.floor((DON_BAY_CAM_KET.TOI_DA_BP * canBp) / 10000);
}

// ---------------------------------------------------------------------------
// CỔNG PHIÊN BẢN — bộ luật nào bật theo `balance_version` nào
// ---------------------------------------------------------------------------

/*
 * ── CỔNG CÂN BẰNG DỜI SANG `config/holdem_balance.ts` (D203) ────────────────
 * `BoLuatCanBang` · `BO_LUAT_THEO_PHIEN_BAN` · `luatCua` nay sống ở đó — 869
 * dòng, và là phần đổi mỗi lần thêm một phiên bản, tức chỗ hai cửa sổ va nhau.
 * Re-export ngay dưới đây nên MỌI import cũ vẫn chạy y nguyên.
 */
// ⚠ `holdem.ts` TỰ DÙNG `luatCua` (trong `seedManTap`) nên phải IMPORT chứ không
// chỉ re-export — `export ... from` không tạo binding cục bộ.
import { luatCua } from './holdem_balance.js';
export type { BoLuatCanBang } from './holdem_balance.js';
export { BO_LUAT_THEO_PHIEN_BAN } from './holdem_balance.js';
export { luatCua };
