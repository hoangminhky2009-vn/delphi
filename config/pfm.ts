/**
 * HẰNG SỐ PFM (quản lý tài chính cá nhân) — D186.
 *
 * ⚠ TÁCH KHỎI `config/economy.ts` CÓ CHỦ Ý. Token PFM là ĐỒNG TIỀN THỨ BA, đứng sau
 * tường lửa ba chiều T ↔ Q ↔ token-PFM (P4 🔒 file 05). Để chung một file với tham số
 * kinh tế của T là mời người sau viết một phép quy đổi "cho tiện" — mà tường lửa này
 * tồn tại đúng để chuyện đó KHÔNG THỂ xảy ra, không phải "không nên".
 *
 * ⚠ MỌI SỐ Ở ĐÂY LÀ PLAYTEST-TUNE trừ chỗ ghi 🔒. Agent KHÔNG tự đổi số (A8.2) —
 * founder chốt. Số nào chưa được chốt thì ghi ⏳ ngay tại chỗ kèm nơi đang chờ.
 *
 * Kiến trúc: `docs/yeu-cau-ky-thuat/05b-pfm-kien-truc.md` (K1–K15 + phụ lục T).
 * Chức năng: `05c` (khung A–K của founder + P19).
 */

export const PFM = {
  /* ── KÉT SAO LƯU (K2 mã hoá đầu-cuối · K10 cắt lát tháng) ──────────────── */

  /**
   * Trần một LÁT THÁNG đã nén+mã hoá.
   *
   * ⚠ 32 KB chứ không phải 64 KB, và con số này ĐO chứ không đoán (D146): lát dày
   * nhất đo được (5 khoản/ngày + 80% có ghi chú) là **5,2 KB**, nên 32 KB là biên an
   * toàn ~6 lần. Bản đầu để 64 KB cho TRỌN SỔ và đó là một quả bom hẹn giờ — sổ 3 năm
   * đo ra 103 KB, tức nó vỡ vào khoảng năm thứ hai, với đúng người dùng trung thành
   * nhất, và vỡ IM LẶNG (sao lưu lặng lẽ thôi gửi được).
   *
   * Cắt lát tháng làm trần này thành BẤT KHẢ VỠ THEO CẤU TRÚC: một tháng không thể
   * to hơn một tháng.
   */
  BLOB_MAX: 32 * 1024,
  /** Số thế hệ giữ cho THÁNG ĐANG SỐNG (tháng đã đóng chỉ giữ 1 bản). 🔒 hàng 1 file 05. */
  BLOB_THE_HE: 3,
  /**
   * Số lần đẩy két tối đa mỗi ngày mỗi user.
   *
   * ⚠ Bản đầu để 6 và đó là dòng chi lớn nhất của PFM trong ngân sách 1M lượt
   * gọi/tháng (D146 K11). Sổ là thứ đổi vài lần một ngày, không phải thứ cần đồng bộ
   * liên tục ⇒ 1 lần khi rời app + 1 dự phòng. Đây là TRẦN chặn lạm dụng, không phải
   * nhịp kỳ vọng.
   */
  SO_LAN_LUU_NGAY: 2,

  /* ── ĐIỂM DANH · CHUỖI · GÓI (K7 · D139/D140) ──────────────────────────── */

  /** Số ngày lỡ được tha mỗi tuần mà chuỗi không gãy (Lally 2010; Duolingo A/B). */
  BAO_HIEM_STREAK_TUAN: 1,
  /** Số ngày CÓ MẶT tối thiểu để mở gói chân dung tháng. */
  GOI_THANG_NGAY: 20,
  /** Gói ĐẦU TIÊN ngắn hơn — endowed progress (Nunes–Drèze: 34% vs 19%). */
  GOI_DAU_NGAY: 7,

  /* ── TOKEN PFM (K4) ────────────────────────────────────────────────────── */

  /**
   * ⏳ CHỜ FOUNDER (A8.2 — hàng 13-Q5 file 05). Đây là tham số kinh tế: nó quyết định
   * tốc độ in một đồng tiền. Số dưới là CHỖ GIỮ để code chạy được, KHÔNG phải đề xuất
   * đã duyệt — ai đọc file này đừng coi nó là số đã chốt.
   */
  TRAN_TOKEN_NGAY: 30,
  /** ⏳ CHỜ — tỷ lệ token vi-mô (mốc rời rạc) so với token phán quyết tuần. */
  TOKEN_MOC_VI_MO: 2,
  TOKEN_TUAN_TOI_DA: 20,

  /* ── ĐẶC TRƯNG 4 LỚP (K14/T7.1 — pfm_dac_trung) ──────────────────────── */

  /**
   * Trần số `doi_tuong` (hũ/luật) khác nhau mỗi user CÓ THỂ mang đặc trưng trong
   * một kỳ. Không có trần này thì số dòng `pfm_dac_trung` không có giới hạn cấu
   * trúc — người tạo/xoá hũ liên tục có thể phình bảng vô hạn (lỗi bản đầu T5.5,
   * đã sửa bằng cách server tự tính `ky` thay vì nhận từ client; trần này vá vế
   * còn lại: số LƯỢNG đối tượng trong một kỳ).
   * ⏳ PLAYTEST-TUNE — số đã có sẵn trong chính T7.1 ("trần doi_tuong/user: 32"),
   * không phải agent tự bịa; founder chưa xác nhận lại.
   */
  TRAN_DOI_TUONG_KY: 32,
  /**
   * Trần độ dài `doi_tuong` (id hũ/luật). Bằng đúng trần `id` của `RE_MON_ID`.
   * ⚠ Không có nó thì `doi_tuong` là ô CHỮ TỰ DO duy nhất còn hở đi vào `pfm_dac_trung`
   * — cột không có CHECK độ dài, và `kiemDongDacTrung` chỉ hỏi rỗng-hay-không-rỗng.
   */
  DOI_TUONG_TOI_DA: 64,

  /* ── CỬA TỔNG HỢP COHORT (K14/T7.3 · P18) — LUẬT CÓ TRƯỚC TẦNG ĐỌC ────── */

  /**
   * Sàn mẫu mỗi nhóm. Dưới sàn ⇒ trả "chưa đủ mẫu", KHÔNG trả số.
   * ⏳ CHỜ FOUNDER (research §6 Q2). Mùa này n≈3–5 nên MỌI nhóm đều dưới sàn ⇒ cửa
   * tổng hợp CÂM hoàn toàn — đó không phải khiếm khuyết, đó là bằng chứng van bán
   * đang đóng BẰNG CẤU TRÚC chứ không bằng lời hứa.
   */
  SAN_MAU_COHORT: 20,
  /**
   * D329 — SÀN MẪU RIÊNG CHO TRANG NHÓM của một buổi đo (tệp 10 §9 câu 5, founder chốt sàn riêng).
   * ⏳ PLAYTEST-TUNE ≈ 12. Vì sao không dùng chung 20: một buổi đo 20 người rơi MỘT người là cả trang
   * câm, và buổi đo ở lớp học hiếm khi đủ 20 trận xong. Sàn thấp hơn được bù bằng hai rào mà cohort
   * không có: trang chỉ mở SAU KHI BÀN ĐÓNG (không trừ được hai lần đọc liền nhau), và chỉ người tạo
   * bàn đọc được. Làm tròn vẫn là `BUOC_LAM_TRON`.
   */
  SAN_MAU_BAN: 12,
  /** Trần số chiều được kết hợp trong một truy vấn (chống cắt lát tới khi còn 1 người). */
  TRAN_CHIEU: 4,
  /**
   * Làm tròn kết quả về bội số này — rào chống TẤN CÔNG HIỆU SỐ (D173/P18).
   * Bán nhiều độ phân giải của CÙNG một quần thể là đúng môi trường của phép trừ:
   * nhóm rộng n=25 trừ nhóm hẹp n=22 tách ra 3 người, dù CẢ HAI truy vấn đều qua sàn.
   */
  BUOC_LAM_TRON: 5,

  /* ── GƯƠNG (nhóm E) — SÀN MẪU, không phải ngưỡng phán xét ──────────────── */

  /**
   * ⚠⚠ MỌI SỐ Ở KHỐI NÀY LÀ SÀN MẪU: dưới sàn thì gương trả `null` — **"chưa đủ để nói"**,
   * KHÔNG phải 0 (P7/D62). Gộp hai cái là để một tỷ lệ dựng từ hai ngày nói giọng của
   * một tỷ lệ dựng từ ba mươi ngày, và người dùng không có cách nào biết.
   * ⏳ PLAYTEST-TUNE — founder chốt (A8.2). Số dưới là CHỖ GIỮ có lý lẽ, không phải số
   * đã duyệt.
   */
  /** Số ngày CÓ CHI tối thiểu để nói bất cứ điều gì về nhịp chi. */
  GUONG_SAN_NGAY_CHI: 6,
  /** Số quan sát tối thiểu cho một tỷ lệ của gương (chi bù, vì sale…). */
  GUONG_SAN_QUAN_SAT: 3,
  /**
   * Ngày được coi là "chi lớn" khi tổng chi ≥ hệ số này × TRUNG VỊ ngày có chi.
   * ⚠ Dùng TRUNG VỊ chứ không phải trung bình: một ngày mua điện thoại kéo trung bình
   * lên đủ để chính nó thôi là "lớn", và cả chỉ số tự vô hiệu hoá.
   */
  GUONG_HE_SO_NGAY_LON: 2,
  /** Cửa sổ "tiền vừa về" tính bằng ngày (48h = ngày nhận + ngày kế). */
  GUONG_CUA_SO_TIEN_VE: 2,

  /* ── CHÂN DUNG HÀNH TINH — toạ độ từ ba câu ĐO của phỏng vấn ─────────────────
   * Demo đã chốt: `docs/ui-ux/demo/pfm-chan-dung.html` (A11.25 — demo thắng plan).
   *
   * ⚠⚠ HAI NGƯỠNG DƯỚI CẮT MỖI TRỤC THÀNH BA VÙNG ⇒ 3×3 = 9 ô = 9 hành tinh, nhân 3
   * vành đai (trục kế hoạch) = 27 chân dung. Founder 21/09: *"4 hành tinh hơi ít cho
   * user, con người thường muốn mình đặc biệt"*.
   *
   * ⚠⚠ BỐN ĐÁP ÁN TRÊN BA VÙNG ⇒ BUỘC MỘT VÙNG ĂN HAI, NHƯNG KHÔNG VÙNG NÀO ĐƯỢC
   * TRỐNG. Bảng điểm đầu tiên của trục `dau` là 10·25·78·95 — cả bốn rơi vào hai vùng
   * ngoài, vùng GIỮA không đáp án nào với tới, nên 3 trong 9 hành tinh thành ô chết mà
   * nhìn mắt thường không thấy. Bài canh `chan_dung_hanh.test.ts §II` quét cạn mọi tổ
   * hợp và bắt đúng ca đó.
   *
   * ⏳ PLAYTEST-TUNE — toàn bộ số dưới đây do agent đặt để chạy được, CHƯA ai đo
   * (A8.2/A11.8). Chỗ chốt: Phiếu 3 buổi đo hỏi lại ba câu TỪ 23/09 (D385) — đối chiếu đáp án nào thật sự
   * đi cùng hành vi nào trong sổ, rồi mới ghim. ⚠ Bản đầu ghi "chốt ở buổi đo 30/09" khi phiếu CHƯA hỏi
   * ba câu ấy và lời khai thì ở lại máy — tức một câu rỗng; đã đính chính.
   */
  /** Hai mốc cắt một trục 0–100 thành ba vùng: thấp · giữa · cao. */
  CHAN_DUNG_MOC_VUNG: [34, 67],
  /** Cách mốc ≤ ngần này thì người dùng được báo "bạn nằm sát rìa" (không giấu ranh giới). */
  CHAN_DUNG_SAT_RIA: 12,

  /**
   * NGƯỠNG BOOST ORACLE — chỉ số vượt ngưỡng thì thẻ boost tương ứng đủ điều kiện.
   *
   * ⚠ Đây là ĐẶT TÊN cho số ĐANG CHẠY, không phải đặt số mới (A8.2): trước đây
   * `boost_chi_bu` dùng `GUONG_HE_SO_NGAY_LON / 4` (= 0,5) và `boost_vi_sale` dùng
   * hằng `0.3` viết thẳng trong điều kiện. Giá trị không đổi một ly.
   * ⚠⚠ Vì sao phải tách: mượn hằng của CHỈ SỐ KHÁC làm ngưỡng cho mình là một LIÊN
   * KẾT GIẢ — đổi hệ số "ngày lớn" (một quyết định về cách ĐO) thì ngưỡng hiện thẻ
   * boost (một quyết định về khi nào NÓI) đổi theo mà không ai chủ ý. Hai câu hỏi
   * khác nhau thì phải có hai cần gạt.
   * ⏳ PLAYTEST-TUNE — cả hai chờ dữ liệu thật, agent không tự đặt.
   */
  ORACLE_NGUONG_CHI_BU: 0.5,
  ORACLE_NGUONG_VI_SALE: 0.3,

  /**
   * ĐỘ CHẮC TRƯỚC KHI THẺ BOOST LÊN TIẾNG (D354) — hai ngưỡng trên GIỮ NGUYÊN nghĩa, nhưng vượt
   * ngưỡng thôi chưa đủ: thẻ chỉ bắn khi hậu nghiệm nói tỷ lệ THẬT vượt mốc với xác suất
   * ≥ `ORACLE_DO_CHAC` (`web/src/pfm/do_chac.ts`). Mốc của `boost_chi_bu` là MỐC NỀN tính từ
   * chính sổ người đó (`ChiBu.nenNgauNhien`); mốc của `boost_vi_sale` là chính ngưỡng 0,3.
   *
   * ⚠⚠ Vì sao: D353 đo trên sổ giả KHÔNG có chi bù — luật cũ (`gt > 0,5`, sàn 3 quan sát) bắn
   * ở 37,5% số tháng của người ghi đủ mọi ngày, và `1/3 = 0,33 > 0,3` đủ bắn thẻ vì-sale.
   *
   * `TIEN_NGHIEM_K` — tiên nghiệm "không có gì xảy ra" nặng bằng mấy quan sát thật. **FOUNDER CHỐT
   * 20/09/2026: k = 4** (cùng số với `k` của D307), dùng chung cho mọi phép co rút PFM về sau
   * (`docs/thiet-ke-de-xuat/pfm-hanh-vi/tien-nghiem-tu-thong-ke-ngoai.md` §5).
   * `ORACLE_DO_CHAC` — ⏳ PLAYTEST-TUNE. 0,9 là chỗ giữ có số đo đứng sau (D354: báo nhầm còn
   * bao nhiêu, bắt được mẫu hình thật bao nhiêu); founder vặn ở đây, không vặn ở hai ngưỡng trên.
   */
  TIEN_NGHIEM_K: 4,
  ORACLE_DO_CHAC: 0.9,

  /**
   * ── ORACLE GIÚP (GĐ B — D365; SỐ ĐO Ở D363, FOUNDER CHỐT 21/09/2026) ──────────
   *
   * Đo trên sổ giả: `web/scripts/do_nguong_pfm.ts`; bảng + vì sao:
   * `docs/thiet-ke-de-xuat/pfm-hanh-vi/do-nguong-pfm-tren-so-gia.md`.
   *
   * ⚠⚠ HAI THANH CHẮN CHO KHOẢN LẶP, KHÔNG PHẢI MỘT — vì tiền Việt tròn 5k. Khoá chỉ-số-tiền
   * ở mức "≥ 2 lần/7 ngày" bắn **8,9 đề nghị trùng hợp mỗi tháng** trên sổ KHÔNG có khoản lặp
   * nào ("bạn ghi 35k ba lần" cho ba thứ khác nhau). Có ghi chú thì nhiễu rơi một bậc độ lớn
   * (0,8/tháng ở ≥ 3 lần/14 ngày) mà vẫn bắt được thói quen hai-lần-một-tuần (ngày thứ 9).
   * Không ghi chú thì phải cao hơn: ≥ 4 lần/7 ngày còn 1,0 trùng hợp/tháng, tức chỉ bắt thói
   * quen gần như hằng ngày.
   * ⚠ Đề nghị lưu mẫu là một CÂU HỎI, không phải lời khẳng định về người dùng ⇒ không cần cổng
   * độ chắc kiểu D354; sai thì tốn một chạm "không".
   */
  ORACLE_LAP_CO_CHU_LAN: 3,
  ORACLE_LAP_CO_CHU_NGAY: 14,
  ORACLE_LAP_KHONG_CHU_LAN: 4,
  ORACLE_LAP_KHONG_CHU_NGAY: 7,

  /**
   * ── KHOẢN CỐ ĐỊNH THEO THÁNG (founder 21/09, D365 lượt 3) ────────────────────
   *
   * Founder: *"đ** ai quan tâm mình tiêu tiền lúc mấy giờ đâu, chỉ tính khoản chi cố định/ngày
   * tháng các thứ thôi"*. Và đúng: luật cửa-sổ-lăn ở trên **không bao giờ** bắt được tiền trọ
   * mùng 5 — ba lần cách nhau một tháng thì chẳng bao giờ lọt vào một cửa sổ 14 ngày.
   *
   * ⚠⚠ ĐIỀU KIỆN CỠ LÀ THỨ LÀM LUẬT NÀY DÙNG ĐƯỢC. Đo trên sổ giả 4 tháng (`do_nguong_pfm.ts`
   * §B1-bis…quater): luật tháng KHÔNG lọc cỡ bắn **18–23 khoá trùng hợp mỗi 4 tháng** — tiền Việt
   * tròn 5k thì hai khoản 35k cách nhau một tháng là chuyện thường. Thêm "≥ 2 × trung vị KHOẢN"
   * ⇒ nhiễu còn **1,2 khoá/4 tháng** mà vẫn bắt 99% cả ba khoản cố định thử (trọ 2tr · học phí
   * 600k · gói cước 90k).
   * ⚠ TRUNG VỊ KHOẢN, KHÔNG PHẢI TRUNG VỊ NGÀY: một ngày gộp ~2,5 khoản nên trung vị NGÀY cao gấp
   * đôi rưỡi trung vị khoản, và gói cước 90k rơi xuống dưới nó — đo được: bắt 0–1%.
   * ⚠ HAI tháng, không phải ba: ba tháng sạch hơn (0,05 khoá/4 tháng) nhưng bắt chậm hơn một tháng
   * tròn, và founder đã bác hướng "bắt người dùng đợi" (20/09).
   *
   * **FOUNDER GIAO TỰ QUYẾT 21/09 (D366) ⇒ CHỐT cả ba.** ⏳ Vẫn giữ nhãn PLAYTEST-TUNE, nhưng vì
   * lý do khác: chúng đo trên SỔ GIẢ. Điều kiện đo lại bằng sổ thật: ≥ 30 người × ≥ 1 tháng (A11.15).
   */
  ORACLE_CO_DINH_SO_THANG: 2,
  ORACLE_CO_DINH_LECH_NGAY: 3,
  ORACLE_CO_DINH_HE_SO_KHOAN: 2,

  /**
   * "MÓN LỚN" — khoản đang cầm trên khay đủ lớn để quy ra đơn vị của chính người dùng.
   *
   * ⚠⚠ HẰNG SỐ RIÊNG, dù giá trị TRÙNG `GUONG_HE_SO_NGAY_LON` hôm nay — đúng bài học đã ghi ở
   * khối NGƯỠNG BOOST ngay trên: mượn hằng của chỉ số khác là một LIÊN KẾT GIẢ. "Ngày nào là
   * ngày chi lớn" (cách ĐO) và "món nào đáng quy ra ngày" (khi nào NÓI) là hai câu hỏi, hai cần
   * gạt. D363 đo: ≥ 2 × trung vị ngày bắt 82–89% món lớn thật, gọi nhầm 0,7–2,2 khoản thường mỗi
   * tháng; ≥ 1 × ồn gấp bảy; ≥ 5 × trung vị KHOẢN có thể gọi một món chưa bằng một ngày thường,
   * làm câu "≈ N ngày chi thường" đọc ngược.
   * ⚠ CÔNG THỨC nền thì DÙNG LẠI `tinhNguongChiLon` của `guong.ts` (A11.5) — chỉ hệ số là riêng.
   */
  ORACLE_HE_SO_MON_LON: 2,

  /**
   * "TIỀN ĐI TỚI NGÀY NÀO" — nhịp chi lấy trung bình mấy ngày gần nhất. Demo đã duyệt (D356)
   * nói nguyên văn *"giữ nhịp ba ngày qua"* ⇒ 3 (A11.25: chép số đo từ demo, không diễn giải lại).
   * ⏳ PLAYTEST-TUNE — chưa đo được trên sổ thật; nhịp càng ngắn càng nhạy với một ngày lạ.
   */
  ORACLE_NHIP_NGAY: 3,

  /* ── LỜI ĐOÁN CỦA NGƯỜI DÙNG VỀ MỘT VỊ THẾ (tệp 15 lát 1) ─────────────────── */

  /**
   * Ba nấc "chắc tới đâu" — số % hiện trên chip. Miền nhãn (`thap/vua/cao`) sống ở
   * `web/src/pfm/vi_the.ts`; ở đây chỉ là chữ số người dùng nhìn thấy.
   * ⚠ Đổi SỐ NẤC là đổi miền nhãn — từ lát 3 miền ấy rời máy (`y_tu_tin`), nên phải chốt
   *   TRƯỚC lát 3. Đổi con số trong nấc thì không đụng dữ liệu (nhãn giữ nguyên nghĩa thứ tự).
   * ⏳ PLAYTEST-TUNE — chỗ giữ, agent đặt để dựng demo (A8.2).
   */
  VI_THE_CHAC: { thap: 50, vua: 70, cao: 90 },
  /** Chip "tới khi nào" — số tháng tính từ hôm đặt. "Ngày khác" là ô ngày. ⏳ PLAYTEST-TUNE */
  VI_THE_HAN_THANG: [1, 3, 6, 12],
  /**
   * Hạn sớm nhất được đặt, tính từ hôm đặt (tệp 15 R3). Lời đoán ba ngày về một hũ đã gần đầy
   * là nhìn đáp án — cùng bẫy D385 chặn bằng `doanTu`. ⏳ PLAYTEST-TUNE
   */
  VI_THE_HAN_TOI_THIEU_NGAY: 14,
  /** Cắt câu "vì sao" (một dòng, ở lại máy). ⏳ PLAYTEST-TUNE */
  VI_THE_VI_SAO_CAT: 120,

  /* ── CỬA VÀO (K9 · consent contextual D175) ────────────────────────────── */

  /** Độ dài mã khôi phục (ký tự Base32, chưa tính dấu gạch). ~60 bit entropy. */
  MA_KHOI_PHUC_KY_TU: 12,
  /** Số vòng PBKDF2 dẫn xuất khoá từ mã khôi phục. Đo được: không chặn luồng chính. */
  PBKDF2_VONG: 600_000,
} as const;

/**
 * ── THANH "MỨC ĐỘ HIỂU BẠN" (màn NGÀY ĐẦU — thi công D358, thiết kế D355/D356) ──
 *
 * ⚠⚠ MỌI SỐ Ở ĐÂY LÀ ⏳ PLAYTEST-TUNE, CHÉP NGUYÊN TỪ DEMO — không phải agent tự đặt
 * (A8.2). Nguồn: `docs/ui-ux/demo/pfm-ngay-dau.html` biến `DIEM`/`MOC`, đo lại ở
 * `docs/nhat-ky/D356.md` ("Thanh hiểu đi 22 → 53% qua một tuần đầy đủ thao tác").
 *
 * ⚠ Thanh này đo *có BAO NHIÊU CĂN CỨ*, không đo *đoán đúng bao nhiêu* — mọi đáp án
 * (kể cả "KHÔNG HẲN"/"BỎ") cộng NHƯ NHAU, và đơn vị NGÀY chứ không phải số dòng sổ
 * (P5/P6 — xem `docs/thiet-ke-de-xuat/pfm-hanh-vi/chan-dung-ngay-dau-va-hoc-lien-tuc.md`).
 * `web/src/pfm/chan_dung.ts` §`mucDoHieu` là nơi DUY NHẤT đọc khối này.
 */
export const HIEU_BAN = {
  /** Sáu câu phỏng vấn — chia đều theo số câu ĐÃ trả lời, làm tròn xuống. */
  CAU_TOI_DA: 22,
  /** Mỗi nét chân dung (nhịp · đều · nguồn) người dùng đã tương tác (bác hoặc tự chọn lại). */
  NET: 3,
  /** Mỗi việc (hũ · luật · ghi) đã LÀM HOẶC BỎ — hai thứ cộng NHƯ NHAU, không ai trả lời cho đẹp thanh. */
  VIEC: 2,
  /** Mỗi NGÀY (không phải mỗi khoản) sổ có ghi. */
  NGAY: 1,
  /** Trần số ngày được tính — sổ ghi cả tháng cũng không đẩy thanh riêng một mình vô hạn. */
  NGAY_TRAN: 30,
  /* ── Thành phần của GIAI ĐOẠN SAU (ngày 3/5/6/tuần) — CHƯA thi công, `mucDoHieu` nhận qua tham số tuỳ chọn
     mặc định 0. Có mặt từ bây giờ vì bảng `DIEM` của demo được chép NGUYÊN MỘT LẦN (A11.25 — chép số đo nguyên
     vẹn; A11.5 — GĐ B không chép lần hai). Chưa màn nào đọc sáu số này. */
  HOI: 3,
  CO_ICH: 1,
  DOAN: 2,
  LAP: 2,
  LUAT: 2,
  QUY: 2,
  /** Ba mốc mở dần việc Oracle được làm — HỎI · ĐOÁN · KHẲNG ĐỊNH (chữ ở `lib/pfm_chu.ts`). */
  MOC_HOI: 25,
  MOC_DOAN: 40,
  MOC_KHANG_DINH: 60,
} as const;

/* ══ LÁT SỐNG — MỘT NGĂN KÉT KHÔNG THUỘC THÁNG NÀO (R15, D251) ═══════════════════ */

/**
 * Mã lát của thứ SỐNG XUYÊN THÁNG (hũ · luật · mẫu lặp · cấu hình). Đối lập với lát
 * tháng `'YYYY-MM'`. Định nghĩa ở ĐÂY chứ không ở client, vì từ khi có `/pfm/luu` thì
 * nó là **giao ước dây**, không còn là chuyện xếp chỗ riêng của IndexedDB nữa.
 */
export const LAT_SONG = 'song';

/**
 * ⭐ CHỖ NẰM CỦA LÁT SỐNG TRONG `pfm_luu.thang`.
 *
 * ⚠⚠ VÌ SAO PHẢI CÓ: `pfm_luu.thang` là cột **DATE**, nên chuỗi `'song'` không ghi vào
 * được — tức cái két server dựng ra để giữ dữ liệu người dùng lại **không có chỗ cho
 * hũ**, thứ duy nhất trong sổ mà mất đi thì không dựng lại nổi từ đâu (khoản chi còn
 * có SMS/sao kê; hũ thì chỉ tồn tại trong đầu người đặt ra nó).
 *
 * ⚠ Chọn MỐC thay vì thêm cột `loai`: thêm cột là một migration trên bảng đã có dữ
 * liệu prod, đổi khoá UNIQUE `(user_id, thang, the_he)`, và sửa cả bốn câu xoay thế
 * hệ — để đổi lấy đúng một dòng mỗi user. Mốc `1970-01-01` là **ngày hợp lệ mà không
 * user nào có thật** (tài khoản sớm nhất 2026), nên nó chiếm một khoá trống sẵn có:
 * xoay thế hệ, đọc, xoá đều chạy y hệt, KHÔNG một câu SQL nào phải biết nó đặc biệt.
 * ⚠ Đúng MỘT chỗ phải biết: cửa "tháng này có đang sống không". Xem `ghiLatThang`.
 */
export const LAT_SONG_THANG = '1970-01-01';

/** Mã lát (`'2026-08'` | `'song'`) ⇒ giá trị `thang` gửi lên server. MỘT nguồn. */
export function thangGuiLen(maLat: string): string {
  return maLat === LAT_SONG ? LAT_SONG_THANG : `${maLat}-01`;
}

/** Nghịch đảo `thangGuiLen` — dùng khi khôi phục, đọc `thang` từ server về mã lát. */
export function latTuThang(thang: string): string {
  return thang === LAT_SONG_THANG ? LAT_SONG : thang.slice(0, 7);
}

/**
 * TRẦN LÔ cho các đường ghi theo lô (K11 — gộp lô như telemetry, nhưng CHẶT HƠN).
 *
 * ⚠ Mượn khuôn hàng đợi telemetry ở phần GỘP LÔ, và **chỉ phần đó**. Tuyệt đối không
 * mượn phần "đầy thì vứt cái cũ nhất": telemetry được phép mất dòng (A9 — giá trị ở
 * xu hướng), còn nhịp PFM đi vào `events` APPEND-ONLY thì không được phép mất.
 */
export const PFM_LO = {
  /** Số dòng tối đa một lô nhịp/sự kiện. */
  SU_KIEN_MOI_LO: 50,
  /** Số lô tối đa mỗi ngày mỗi user. */
  LO_MOI_NGAY: 12,
  /** Trần byte thân request cho đường ghi lô (chặn bằng content-length TRƯỚC khi đọc). */
  THAN_TOI_DA: 64 * 1024,
  /**
   * Trần dòng trong MỘT gói đặc trưng. Sổ đăng ký hiện có vài chục mã × số hũ, nên
   * 300 là rộng rãi; nó ở đây để một client hỏng không nhét được mảng triệu phần tử
   * qua cửa `content-length` bằng cách gửi ít món mà mỗi món khổng lồ.
   */
  DONG_MOI_GOI: 300,
  /**
   * ⭐ TRẦN TỔNG SỐ DÒNG CỦA CẢ LÔ — không phải số món.
   *
   * ⚠⚠ VÌ SAO PHẢI CÓ RIÊNG: trần cũ (`/pfm/dac-trung`) đếm **DÒNG**, và 50 là 50
   * dòng. `/pfm/dong-bo` đổi đơn vị sang **MÓN**, nên cùng con số 50 bỗng cho phép 50 gói
   * × `DONG_MOI_GOI` = **15.000** câu INSERT trong MỘT transaction giữ một trong năm
   * kết nối pool — trần nới lên 300× mà không ai quyết định điều đó. Đổi đơn vị của
   * một trần là đổi chính cái trần, kể cả khi con số không đổi.
   *
   * ⚠ Ràng buộc bắt buộc: phải ≥ `DONG_MOI_GOI`, không thì một gói hợp lệ tối đa
   * không bao giờ gửi được. 600 = hai gói đầy, hoặc rất nhiều gói nhỏ + nhịp.
   * ⏳ PLAYTEST-TUNE — số này chặn TẢI, không phải số kinh tế (A8.2 không áp), nhưng
   * vẫn phải đo bằng `npm run do:pfm-dong-bo` trước khi coi là chốt.
   */
  DONG_MOI_LO: 600,
  /**
   * Số ngày server còn NHỚ id món đã nhận (`pfm_lo_da_nhan`, migration 0056).
   * ⚠ Phải dài hơn khoảng offline dài nhất còn đáng chống trùng. 30 ngày: một máy
   * tắt mạng lâu hơn thế mà vẫn gửi lại thì món cũ sẽ ghi lần hai — đổi lại bảng
   * không phình vô hạn. Đây là ĐÁNH ĐỔI CÓ SỐ, không phải con số tuỳ tiện; nới nó
   * là nới bộ nhớ, không phải nới đúng đắn.  ⏳ PLAYTEST-TUNE
   */
  NHO_MON_NGAY: 30,
} as const;
