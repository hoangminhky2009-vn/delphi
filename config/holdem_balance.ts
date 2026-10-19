/**
 * CỔNG CÂN BẰNG — bộ cờ luật của từng `balance_version` (tách khỏi `holdem.ts`
 * ngày 31/08, D203).
 *
 * ─── VÌ SAO TÁCH ĐÚNG KHỐI NÀY ──────────────────────────────────────────────
 * `config/holdem.ts` là **5.325 dòng** và là tệp bị chạm nhiều thứ hai repo
 * (10/40 commit gần nhất). Khối này chiếm **869 dòng = 16%**, và nó là phần
 * ĐỔI MỖI LẦN ai thêm một phiên bản cân bằng — tức đúng chỗ hai cửa sổ va nhau.
 *
 * Đo trước khi cắt: khối tham chiếu 31 tên viết hoa định nghĩa ở trên, **nhưng
 * TẤT CẢ đều nằm trong chú thích** — code thật (354 dòng) không phụ thuộc gì.
 * Nên đây là một cú DỜI thuần, không sinh vòng import.
 *
 * ⚠ `config/holdem.ts` RE-EXPORT lại toàn bộ, nên mọi `import ... from
 * '../config/holdem.js'` đang có vẫn chạy y nguyên. Không sửa một chỗ gọi nào.
 *
 * ⚠⚠ ĐÂY LÀ CỔNG REPLAY. Mỗi khoá là một BỘ LUẬT ĐÃ CHẠY THẬT và đang nằm trong
 * `holdem_matches.balance_version` của những trận đã lưu. **Sửa giá trị một khoá
 * cũ = đổi kết quả một trận đã đánh xong.** Thêm luật mới thì THÊM KHOÁ.
 *
 * ⚠ KHOÁ ĐẦU TIÊN Ở BẢNG DƯỚI LÀ v5, KHÔNG PHẢI v2. Bản trước của đúng đoạn này
 * viết "đúng cách repo vẫn làm từ v2 tới v38" — SAI, đã sửa (D217, 03/09/2026).
 * v2–v4 có thật (từng là giá trị của `HOLDEM_BALANCE_VERSION` khi nó còn là MỘT
 * hằng số phẳng, trước khi D30 dựng ra chính bảng `BO_LUAT_THEO_PHIEN_BAN` này
 * với v5 là khoá đầu tiên) nhưng CHƯA TỪNG là một dòng trong bảng để mà gỡ — xem
 * `SO_KHOA_DA_GO` ngay dưới bảng cho toàn bộ chứng cứ (`git log -S`, từng commit).
 *
 * ─── LUẬT GỠ MỘT KHOÁ (founder 03/09/2026, câu hỏi B2 — chọn phương án (b)) ──
 * Một khoá CHỈ được gỡ khỏi bảng này TRONG LÚC nó còn FOUNDER-ONLY, tức CHƯA có
 * trận nào của người NGOÀI tài khoản founder mang khoá đó. Ngay khi một người
 * ngoài đã chơi một trận mang khoá X — dù chỉ một trận — khoá X ĐÓNG BĂNG VĨNH
 * VIỄN: không bao giờ được gỡ nữa, bất kể sau đó nó cũ tới đâu.
 *
 * VỠ LUẬT NÀY KHÔNG BÁO LỖI, NÓ ĐỔI TRÒ TRONG IM LẶNG: `luatCua()` gặp khoá lạ
 * trả bộ cờ TẮT HẾT (xem cuối tệp), nên mọi trận đã lưu mang khoá bị gỡ oan sẽ
 * `sinhMap`/chấm điểm bằng MỘT TRÒ KHÁC — không throw, không dấu vết, ngoài dòng
 * `console.warn` mà `luatCua()` giờ phát ra (xem `canhBaoKhoaLa` cuối tệp — M3).
 * `config/giai_doan.ts` đã đo đúng giá của kiểu im lặng này trên chính ba khoá
 * founder-only cũ: 95/179 trận prod = 53% corpus "không dựng lại được" nhiều
 * tháng không ai biết (D192).
 *
 * Gỡ có chủ đích ⇒ thêm một dòng vào `SO_KHOA_DA_GO` NGAY TRONG CÙNG COMMIT xoá
 * khoá — sổ đó là nơi DUY NHẤT phân biệt "gỡ có chủ đích, đã kiểm founder-only"
 * với "ai đó lỡ tay xoá một khoá đang sống".
 */

/** Những cần gạt luật mà một `balance_version` bật. */
export interface BoLuatCanBang {
  /**
   * v32 (D85/D86 §2) — BẢN SẮC CỠ MAP: kịch bản hồi cho map 12/16, map 8 giữ
   * byte-hệt làm mẫu đối chứng. Xem `BAN_SAC_MAP`. Đổi cách sinh map ⇒ cờ này
   * là thứ giữ mọi trận đã lưu replay ra đúng tấm map nó từng chơi.
   */
  banSacMap: boolean;
  /**
   * v32 (D85/D86 §1) — KỲ NGỘ TRONG TRẬN: mời chọn nhiệm vụ ở vòng kỳ ngộ,
   * hoàn thành thì nhận đặc quyền. Xem `NHIEM_VU_KY_NGO` và `KY_NGO`.
   *
   * ⚠ TÁCH RIÊNG khỏi `banSacMap` dù hai thứ ship cùng một cổng v32 — đúng lý
   * lẽ đã dùng cho `daDangHoaTranTaiSan` (tách) chứ không phải cho `dacQuyen`
   * (gộp): bản sắc map chạy được MỘT MÌNH và có nghĩa một mình, nên gộp là
   * khoá tay đúng lúc cần ĐO xem G1–G4 dịch vì cung tín dụng hay vì kỳ ngộ.
   *
   * ⚠ CẦN CỔNG dù kỳ ngộ nghe như thuần trình bày: đặc quyền PHIẾU MỞ BẢNG
   * MIỄN một khoản phí có thật (`apPhiMoBang`), tức nó đụng Vốn. Bật thẳng là
   * mọi trận đã lưu replay ra Vốn khác — im lặng, không lỗi.
   */
  kyNgo: boolean;
  /**
   * v33 (D90 M1, founder 17/08) — GIÃN LỚP CHIẾN THUẬT Ở MAP NGẮN: map 8 chọn
   * lá ở 2·4·6 thay vì ba vòng liền 2·3·4. Xem `vongChonChienThuat`.
   * ⚠ Cờ riêng, KHÔNG gộp vào `banSacMap`: hai thứ đụng hai mặt khác nhau (nhịp
   * chọn lá vs kịch bản hồi), và gộp là bịt mắt chính phép đo G1–G4 sau này.
   */
  gianLaMapNgan: boolean;
  /**
   * v34 (D107/D108, founder 22/08) — VAI BẤT ĐỐI XỨNG có RĂNG: vốn theo vai ·
   * hệ số tác động giá theo vai (nhân vào trượt giá + crowding) · lõi ghim ở
   * ô 1 · đội lái có thể bị SIẾT. Cờ tắt = vai chỉ là NHÃN (D107), không đổi chip.
   * ⚠ Cổng riêng vì nó chạm TIỀN ⇒ mọi trận ≤ v33 replay nguyên.
   */
  vaiCoRang: boolean;
  /**
   * v34 — GỌI KÝ QUỸ TRỪ TỪ NAV. Bản D37 viết `min(g.von, mat)` ⇒ ai all-in
   * 100% có 0 tiền mặt thì KHÔNG BAO GIỜ bị gọi ký quỹ — cái giá của Đòn Bẩy
   * tránh được bằng cách ôm MẠNH HƠN. Cờ bật: tiền mặt trước, thiếu pro-rata
   * vị thế (khuôn phí quản lý v14). Cổng riêng: đổi chip của mọi ghế cầm Đòn
   * Bẩy ⇒ trận ≤ v33 replay nguyên.
   */
  kyQuyTuNav: boolean;
  /**
   * D155 — phản thân D4 qua CỔNG thay vì ENV (chuẩn hoá A11.3, chốt D147-Q3).
   * TRUE ở mọi phiên bản lịch sử — xem chú thích ở `PHAN_THAN` vì sao đặt
   * false ở entry cũ là đổi replay.
   */
  phanThan: boolean;
  /**
   * v35 — CHUỖI MỞ RỘNG (founder duyệt hướng 29/08: *"cải tiến và làm đa dạng
   * về cơ chế chuỗi thẻ và tác động giữa các thẻ"*). Bật ⇒ bảng dây chuyền đọc
   * qua `mtKeTiep(true)` (bảng nền + `MT_KE_TIEP_MO_RONG`) và cạnh chuỗi nghe
   * môi trường tiền tệ (`KE_TIEP_THEO_MOI_TRUONG`). Cổng riêng vì bảng có SÁU
   * người đọc — sửa thẳng bảng nền là đổi map mọi trận đã lưu (A11.3).
   */
  chuoiMoRong: boolean;
  /**
   * v35 — BA LUẬT TƯƠNG TÁC THẺ (D158, founder duyệt hướng 29/08 — "tác động
   * giữa các thẻ"): ĐÚNG THUỐC (tăng lãi THẬT dập dư âm lạm phát sớm) · ĐỔ DẦU
   * (hạ lãi THẬT giữa chế độ bong bóng ⇒ nghiêng thêm + vỡ sâu thêm) · CỘNG
   * HƯỞNG TRÚ ẨN (chiến tranh + cấm vận trong cửa sổ dư âm ⇒ vàng khuếch đại).
   * Xem `TUONG_TAC_THE`. Cổng riêng, tách khỏi `chuoiMoRong` để MC cô lập được
   * hai cần gạt khi trình số founder.
   */
  tuongTacThe: boolean;
  /**
   * v35 — MARKOV THEO NGUYÊN NHÂN (D159; founder D152: *"uptrend từ tiền rẻ
   * hay tin tốt thật thì đi DÀI hơn, uptrend từ tin tức thì đi NGẮN hơn"*).
   * Độ lì TU_LAP của chuỗi nhân theo NGUỒN mở chuỗi (`MARKOV_NGUON`); nhãn
   * nguồn là LATENT STATE — không hiển thị ở đâu (addendum §7, D154), người
   * chơi SUY từ tin-mở-chuỗi + môi trường tiền tệ đều công khai.
   */
  markovNguon: boolean;
  /**
   * v35 — BẺ CHUỖI VĨ MÔ BẰNG VỐN (D160; founder 29/08: *"chính player cũng có
   * thể bẻ chuỗi vĩ mô nếu hành động của cả lobby (phần lớn vốn) phi lý và tập
   * trung"*; chốt "phi lý = CẢ HAI": ngược chiều chuỗi VÀ ngược môi trường tiền
   * tệ). Đếm VỐN (NAV vị thế), KHÔNG đếm ghế — khác hẳn phản thân D4; xem
   * `BE_CHUOI_VON` + `beChuoiCuaLobby`. ⚠ D107 từng bác đếm-tiền cho CROWDING —
   * cơ chế KHÁC, số phải MC riêng, không mượn kết luận cũ.
   */
  beChuoiVon: boolean;
  /**
   * v36 — MÁY REGIME THAY MÁY RÚT PHA (D165, R1 của kế hoạch
   * `v36-dap-the-pha-ke-hoach.md`; founder "Làm đi" 30/08). Bật ⇒ ô pha không
   * còn là cú rút tự quyết hướng: NỀN (regime hướng·tuổi·nguồn) tick trước
   * bằng hazard, ô CÔNG BỐ mặt trên nền. `phuc_hoi` rời bộ rút — chỉ còn là
   * nhãn phái sinh khi chuỗi giảm bị TIN TỐT THẬT cắt. Xem `REGIME_TICK`.
   * Chế độ bong bóng v27 GIỮ NGUYÊN là regime riêng (D152 "giữ v27").
   */
  regimeTick: boolean;
  /**
   * v36 R2 — GIÁ VÒNG TIN = NỀN + TIN CHỒNG (D166). Trước cờ này, vòng có sự
   * kiện bị ép nền `di_ngang` (loại trừ: hoặc pha hoặc tin) — nền vĩ mô biến
   * mất đúng lúc tin nổ. Bật ⇒ vòng tin cộng thêm nền REGIME đang chạy
   * (`giai_doan_nen`), chiết khấu `NEN_TRONG_VONG_TIN_BP` để không đếm đôi
   * (tin đã mang phần lớn lực của vòng đó). Cờ RIÊNG khỏi `regimeTick` để MC
   * cô lập được từng cần gạt (addendum §1: event modifies conditions).
   */
  giaChongNen: boolean;
  /**
   * v37 — ÁP LỰC BÀN (D181, R6 của kế hoạch v36 bản 2; addendum §3/§4/§11).
   * Hành vi gộp của bàn thôi là một CÔNG TẮC NGƯỠNG (≥60% ghế/vốn ⇒ xác suất
   * cố định) mà thành BIẾN LIÊN TỤC CÓ TRÍ NHỚ: mỗi vòng bàn nạp thêm áp lực
   * theo mức dồn, áp lực mòn dần, và nó ĐỔI XÁC SUẤT của cả hai máy thay ô.
   * Xem `AP_LUC_BAN`.
   */
  apLucBan: boolean;
  /**
   * v38 — NHÂN QUẢ ĐỐI XỨNG (D185). Bảng `SU_KIEN_THEO_GIAI_DOAN` chỉ có vế
   * THÚC; cờ này thêm vế GHÌM (`SU_KIEN_THEO_GIAI_DOAN_GHIM`) để chợ đang tăng
   * thôi rút ra "hạ lãi suất" vô cớ. Xem docstring bảng ghìm cho số đo.
   */
  nhanQuaDoiXung: boolean;
  /**
   * v39 — CHU KỲ THỰC TẾ (D301): cùng máy tick v36, đổi BỘ SỐ sang bộ hiệu chỉnh theo
   * dữ liệu ngoài đời (1 ô = 6 tháng; nguồn + quy đổi cạnh từng số ở `REGIME_TICK_THUC_TE`,
   * `BONG_BONG_PHONG_TIEP_BP`, `TY_LE_TIN_GIA_THUC_TE` và doc chu-ky-thuc-te-nguon-va-quy-doi).
   * Máy sinh map + bot hoài nghi + bảng điện tử + DTO đọc cùng MỘT cửa (`st.chu_ky_thuc_te`).
   */
  chuKyThucTe: boolean;
  /**
   * v40 — LỊCH CỐ ĐỊNH (D302): ô KỲ HỌP (lịch công khai `LICH_CHINH_SACH`) miễn nhiễm
   * phản thân / bẻ chuỗi bằng vốn. Cổng riêng vì đổi nó là đổi replay của trận đã lưu
   * (A11.3); v36 đang chạy prod vẫn đổi được ô kỳ họp cho tới khi founder lật.
   */
  lichKhongDoi: boolean;
  /**
   * v41 — LỚP VN (D307): hai ma trận độ lớn (`MT_TAI_SAN_GIAI_DOAN` · `MT_TAI_SAN_SU_KIEN`)
   * đổi sang bộ hiệu chỉnh theo dữ liệu thị trường Việt Nam, gộp co rút w = n/(n+4) trên
   * tiên nghiệm v40. Cổng riêng vì đổi ma trận là đổi KẾT QUẢ mọi trận đã lưu (A11.3).
   */
  lopVn: boolean;
  /**
   * v42 — BỘ SỐ TÀI SẢN v2 (D311): ba hàng `cp_cn` · `usd` · `tpcp` suy lại cho
   * CP Chứng khoán · USDT · Trái phiếu Mỹ (`MT_TAI_SAN_*_V42`, `CAN_TROI_BP_V42`).
   * Chọn bảng qua `boMaTranCua` — KHÔNG đọc thẳng hằng số (bài học `bangCanTroi`).
   */
  taiSanV42: boolean;
  /**
   * v42 — COUPON (D311): mã `dong_tien === 'coupon'` trả lãi vào TIỀN MẶT mỗi ô theo
   * lãi suất nền (`couponBp`); sổ khống TRẢ khoản đó.
   * ⚠ Đi CÙNG cổng với `taiSanV42`: hàng giá của `tpcp` ở bảng V42 là GIÁ-THUẦN (carry
   * đã rút ra). Bật một mình cờ này = trả lãi hai lần; bật một mình `taiSanV42` = nuốt
   * mất carry của người cầm trái phiếu.
   */
  couponTpcp: boolean;
  /**
   * v42 — KHỐNG THEO MÃ (D311): `TaiSan.khong_duoc === false` ⇒ lệnh MỞ khống bị từ
   * chối (`khong_cam_san`). Sàn VN không cho bán khống cổ phiếu cơ sở; VN30 vẫn khống
   * được vì có phái sinh. `dong_khong` KHÔNG bao giờ bị chặn.
   */
  khongTheoMa: boolean;
  /**
   * v42 — TIỀN MẶT × SỰ KIỆN (D311): hàng `TIEN_MAT_SU_KIEN.MT` áp lên TIỀN MẶT TỰ DO
   * qua cùng máy dư âm/tin giả của giá. Thay `PHI_DUNG_NGOAI.LAM_PHAT_BP` (một nguồn —
   * bật cờ này thì khối đứng-ngoài thôi cộng 400). Nền `apLamPhat` 150 giữ nguyên.
   */
  tienMatSuKien: boolean;
  /**
   * v43 — KHOÁ NẮM GIỮ TẮT (D314). Founder chốt 08/09: cơ chế "Cam kết" (KHOÁ NẮM GIỮ /
   * CAM KẾT GIỮ, `KHOA_TAI_SAN`) làm CHẾT.
   *
   * ⚠ TÊN LÀ "TẮT" ĐỂ GIỮ QUY ƯỚC *bản cũ = false*. Đặt tên `khoaTaiSan` rồi cho bản cũ
   * `true` là phá quy ước xếp chồng của cả bảng, và mọi bài canh "khoá cũ tắt hết cờ mới"
   * sẽ phải mọc ngoại lệ.
   * ⚠ TẮT chứ KHÔNG XOÁ code: `khoaDangChay`/`dungChuoi`/`chotPhien` phải sống để mọi trận
   * ≤ v42 replay đúng `khoa_thuong`/`be_keo`. Bật ⇒ `apKhoaTaiSan` từ chối bằng `co_che_tat`.
   */
  khoaTaiSanTat: boolean;
  /**
   * v43 — NGÂN HÀNG (D314): hợp đồng gửi tiết kiệm (`TIET_KIEM`, `laiTietKiemBp`;
   * `apMoTietKiem`/`apHuyTietKiem`; tất toán trong `chotPhien`). Không giới hạn số hợp
   * đồng, ba mốc kỳ hạn 2/3/4 ô, huỷ trước hạn mất toàn bộ lãi treo.
   */
  tietKiem: boolean;
  /**
   * v44 — LỚP TƯƠNG QUAN CỦA BỘ TÀI SẢN v2 (D315): bật `BETA_V44` — β riêng cho `usd`
   * ở ba mặt tin crypto, β nền riêng cho `cp_cn`, và `bien_dong_bp` riêng cho `cp_cn`.
   *
   * ⚠ Cổng RIÊNG dù cùng chủ đề với v42: v42 ĐÃ là mặc định và đang chạy prod, nên sửa
   * số của nó là viết lại kết quả trận đang chơi (A11.3). D311 đổi ĐỘ LỚN mà bỏ quên
   * TƯƠNG QUAN — founder chỉ ra 09/09; đây là phần vá, và nó phải đi cổng mới.
   */
  betaTaiSanV2: boolean;
  /**
   * v45 (D318) — ĐƯỜNG CONG LỢI SUẤT. Coupon Trái phiếu Mỹ thôi đọc thẳng lãi CHÍNH
   * SÁCH; nó suy từ lợi suất DÀI qua `laiSuatDaiBp` (neo +100 bp, truyền dẫn 0,40).
   * ⭐ Hệ quả chơi được: đường cong ĐẢO NGƯỢC được khi lãi chính sách vượt ~567 bp —
   * gửi tiết kiệm bắt đầu trả cao hơn coupon trái phiếu dài.
   * ⚠ CHỈ đổi coupon, KHÔNG đổi hàng giá `tpcp`: hàng giá suy từ biến động giá THẬT
   * của tờ 10 năm nên đã mang sẵn truyền dẫn thật. Sửa cả hai là đếm hai lần (D61).
   */
  duongCong: boolean;
  /**
   * v45 (D318) — RÀ BIÊN NHIỄU bốn mã còn lại (`BIEN_DONG_V45`), nối tiếp lượt v44 chỉ
   * chạm `cp_cn`. Trước đó vàng ỒN HƠN VN30 và trái phiếu gần bằng, tức bộ số đang bác
   * bỏ chính lời khuyên trung tâm của trò: phân tán sang phòng thủ có giá trị.
   */
  bienDongV45: boolean;
  /**
   * v45 (D318, founder 09/09) — COUPON PHẢI GIỮ ĐỦ MỘT Ô mới ăn.
   * Trái phiếu Mỹ trả lãi nửa năm một lần, mà 1 ô = nửa năm. Trước v45 mua ở ô nào
   * cũng ăn coupon ngay ô ấy — tức nhặt lãi miễn phí bằng cách nhảy vào sát ngày
   * chốt. Ngoài đời mua giữa kỳ thì người mua TRẢ phần lãi đã dồn cho người bán.
   */
  couponGiuDu: boolean;
  /**
   * v46 (D338) — ĐÒN BẨY NHÂN ĐÚNG TỪNG MÃ ở trận NAV.
   * Trước v46 mắt xích `nhan` là TỔNG % giá của mọi mã đang cầm rồi đi vào tầng DANH MỤC
   * của `apDinhGia` (áp như % cả ví lên TỪNG vị thế) ⇒ cầm N mã là ~(N+1)×; đã gắn thì % giá
   * của mã ấy áp lên cả ví. Trận tập founder: vòng 7 vị thế ×2,97 thay vì ×1,98.
   * Nay mỗi mã được nhân một mắt xích `nhan` mang `ma`, áp vào ĐÚNG vị thế mã đó; chưa gắn
   * ⇒ mọi mã đang cầm, gắn ⇒ riêng mã gắn (+ đích phụ cấp 2).
   */
  donBayTheoMa: boolean;
  /** v46 (D338) — LÃI VAY ĐÒN BẨY mỗi ô trên phần tiền đang được nhân đôi (`LAI_VAY_DON_BAY`). */
  laiVayDonBay: boolean;
  /**
   * v47 (D339) — KHẨU VỊ RỦI RO NHÂN ĐÚNG BIÊN ĐỘ. CÙNG LỚP LỖI ĐƠN VỊ với `donBayTheoMa`,
   * chỉ khác chỗ nó nằm: bước 6 `dungChuoi` nhân TỔNG % của chuỗi rồi đẩy phần chênh xuống
   * MỘT mắt xích `khau_vi` không mang mã ⇒ `chotPhien` xếp vào tầng DANH MỤC của `apDinhGia`,
   * tức áp (k−1)×(tổng % MỌI mã) lên TỪNG vị thế. Cầm N mã cùng lên thì quyết liệt ăn ~N lần
   * phần đáng ra được nhân; thận trọng thì bị TRỪ theo cả rổ nên rổ đang lãi vẫn có thể về âm.
   * Đo 400 bộ ba (cùng seed, cùng bàn, cùng bot, map 12) dưới v46: về nhất 5,0% / 17,3% / 53,3%
   * (thận trọng / cân bằng / quyết liệt) — ngược hẳn điều `KHAU_VI` nói là quan trọng nhất
   * ("kỳ vọng không đổi, chỉ phương sai đổi").
   * Bật ⇒ mỗi mã một mắt xích `khau_vi` mang `ma` (+ một mắt xích cho phần danh mục), mỗi
   * phần nhân đúng biên độ của CHÍNH NÓ.
   */
  khauViTheoMa: boolean;
  /**
   * v48 (D340) — RỦI RO ĐỐI TÁC TRỪ ĐÚNG MỘT LẦN. Ca thứ ba của họ "mắt xích rơi nhầm chỗ",
   * và là ca duy nhất không phải xếp nhầm tầng mà là ĐẾM HAI LẦN: `dungChuoi` teo phần ăn
   * của thẻ phòng thủ xuống `teo` RỒI CÒN đẩy `−mat` vào chuỗi. `congDon` chỉ cộng `teo` nên
   * PnL tường thuật đúng, nhưng `chotPhien` cộng theo CHUỖI ⇒ tiền áp `teo − mat`, mà
   * `AN_CON_BP = 5000` nghĩa là `teo = mat` ⇒ áp đúng 0. Đo 133/133 vòng kích hoạt: ăn đáng ra
   * 350bp, tiền áp 0bp — tức cả bàn cùng núp thì thẻ mất SẠCH phần che, đúng cái bẫy mà
   * docstring `RUI_RO_DOI_TAC` tự cấm ("biến thẻ phòng thủ thành bẫy… D22 cấm").
   * Bật ⇒ `phong_thu` mang phần ăn ĐẦY ĐỦ và `doi_tac` là dòng TRỪ thật, nên tổng chuỗi lại
   * bằng phần còn lại và tiền khớp lời kể.
   */
  doiTacTruMotLan: boolean;
  /**
   * v49 (D342) — SỔ KHỐNG ĂN NGƯỢC ĐÚNG GIÁ CHỢ. Lỗi có từ v17 (01/08): `dungChuoi` chỉ dựng
   * mắt xích giá cho mã trong `danh_muc.tai_san` (gương SỔ DÀI), nên khống một mã không cầm
   * dài nhận 0bp giá — ký quỹ chỉ chịu phí giữ và hiệu ứng thẻ. Trận founder 16/09 20:52:
   * vòng 9 (Sập sàn) btc −92,98% ⇒ khống btc +490, toàn bộ từ hiệu ứng lá; vòng 7 +28% và
   * vòng 10 −61% ⇒ khống đứng im 0. Còn khi CÓ cầm dài cùng mã thì sổ khống đảo dấu cả phần
   * chen chúc của sổ dài (phí của người mua thành lãi của người khống).
   * Bật ⇒ mỗi mã đang khống một mắt xích `khong_gia` = −(lợi suất công khai của mã), tầng
   * KHỐNG riêng (`tangCuaMatXich`); khẩu vị và Đòn Bẩy nhân đúng phần đó (lãi vay đã tính trên
   * sổ khống từ D338). Founder chốt 16/09: "ngược đúng giá chợ", kể cả phần sức căng.
   */
  khongTheoGia: boolean;
  /**
   * v49 (D342) — CHIP KHỐNG TÍNH TRÊN HẠN MỨC khống còn lại (`hanMucKhongCon`: trần 30% NAV trừ
   * phần đang khống, không quá tiền mặt), không trên tiền mặt. Trước đó 50–100% gần như luôn
   * vượt trần ⇒ `qua_tran_khong` ⇒ server bác CẢ CHUỖI lệnh: trận founder mất bốn vòng lệnh
   * khống, hai vòng mất luôn lệnh bán btc đi kèm.
   */
  khongTheoHanMuc: boolean;
  /**
   * v49 (D342) — LÁ BÁN KHỐNG THUẦN QUYỀN MỞ KHỐNG: gỡ hàng T1 `MT_CHIEN_THUAT_SU_KIEN.ban_khong`
   * (Sập sàn +15%, Hạ lãi suất −15%, Bong bóng −27%…) — di tích thời chưa có sổ khống thật,
   * áp lên CẢ danh mục kể cả vị thế dài. Có sổ khống ăn giá thật thì giữ hàng này là đếm hai lần.
   */
  banKhongThuanQuyen: boolean;
  /**
   * v49 (D342) — XẾP HÀNG KHỚP LỆNH VÀO TẦNG MÃ. `xep_hang` mang mã từ ngày sinh mà không nằm
   * trong whitelist tầng mã ⇒ phạt vào MỘT mã áp lên MỌI vị thế (và sổ khống) — ca thứ tư của
   * họ lỗi đơn vị D338–D340. Phần hoàn của Khớp Nhanh đi cùng mã.
   */
  xepHangTheoMa: boolean;
  /**
   * v50 (D345) — PHÍ MUA BÁN NHẸ (`PHI_LENH_V50`): gốc ≈ ngoài đời, vội vàng theo cỡ tiền TUYỆT ĐỐI so
   * với độ sâu chợ (vai nhiều tiền mới nặng), Khớp Nhanh còn `LENH_CON_BP`. Trước: ALL-IN 10.000 mất
   * 10–20%, đảo trọn danh mục ~20% một vòng (founder: "phí nặng quá… ngoài đời không nặng thế").
   */
  phiLenhNhe: boolean;
  /**
   * v51 (D346) — PHÍ MUA BÁN HAI BẬC: `PHI_LENH_V51.NGUONG_BP` đầu của mỗi lệnh trả giá gốc ≈ ngoài
   * đời (0,3% cổ phiếu), phần VƯỢT mới bị đẩy giá luỹ tiến. Phanh đúng lối "dồn hết vốn trong một
   * vòng" mà không làm lệnh vừa đắt lên. Cần `phiLenhNhe` cùng bật (bảng gốc của v51 đọc qua cờ đó).
   */
  phiLenhBac: boolean;
  /**
   * v52 (D371) — ĐA DẠNG HOÁ THÔI THU TIỀN THUÊ MỖI VÒNG.
   *
   * Mắt xích `da_dang` chạy MỖI VÒNG chỉ cần lá nằm trong danh mục, và rơi vào
   * TẦNG DANH MỤC (`tangCuaMatXich`) — tức nhân thẳng vào MỌI vị thế đang cầm.
   * Bộ số cũ (−700 phẳng + 260/mã, sinh 21/07) đặt mức hoà vốn ở 2,69 mã khi
   * `MAX_TAI_SAN` còn là 4. Founder hạ trần 4 → 3 ngày 27/07 và bộ số không ai
   * đụng lại, nên mức hoà vốn trôi ra SÁT TRẦN: cầm 1 mã −440 bp/vòng, 2 mã
   * −180 bp/vòng, chỉ 3 mã mới dương (+80).
   *
   * ⚠ AI TRẢ KHOẢN NÀY: không phải bot `da_dang` — nó mua tài sản tới đủ trần
   * TRƯỚC rồi mới nhặt lá, nên sống trọn ở vùng dương. Người trả là **vai TỔ
   * CHỨC**, vì `VAI.to_chuc.loi_ghim = 'da_dang_hoa'` ghim lá từ vòng 1, lúc
   * còn 0–2 mã. Đo được: bật cờ này làm `to_chuc` nhảy 4,58 → 3,70 hạng TB.
   * Đây cũng là lý do gate CŨ không bao giờ thấy: nó đọc bot, không đọc vai.
   *
   * ⚠ CỔNG RIÊNG, KHÔNG GỘP vào `daDangHoaTranTaiSan`: cờ kia đụng SỨC CHỨA
   * (trần số mã), cờ này đụng BIÊN LỢI NHUẬN mỗi vòng. Gộp là mất cửa bật/tắt
   * riêng để đo — đúng lý do `daDangHoaTranTaiSan` từng tách khỏi `donBayCamKet`.
   */
  daDangV52: boolean;
  /**
   * v53 (D373) — ÚP Ô ĐANG CHƠI: người chơi CƯỢC VÀO LÁ SẮP LẬT, không đọc lá đã ngửa.
   *
   * Tới v52, `holdem_api.ts` gửi `o_hien_tai = map.o[vong-1]` — ĐÚNG ô mà `chotPhien` sẽ dùng
   * để chạy giá vòng đó. Người chơi thấy lá bài rồi mới đặt lệnh, nên trên ~65% số ô (ô PHA,
   * không phải ô tin) quyết định là đọc bảng chứ không phải dự báo: `mtGiaiDoan` cách nhau tới
   * 15 điểm % giữa mã tốt nhất và mã tệ nhất của cùng một pha, và khoảng cách ấy không kèm rủi ro.
   *
   * Cờ này KHÔNG đổi một phép tính tiền nào. Nó đổi AI BIẾT GÌ LÚC NÀO:
   * · `o_hien_tai` vắng (ô của vòng còn úp); `up_o` khai để client vẽ ô SẮP LẬT;
   * · `xu_huong` · `chinh_sach` · `lai_suat` · `bo_bai_con_lai` · bảng điện tử đọc theo Ô ĐÃ LẬT
   *   gần nhất (`vongDaLat`) thay vì ô đang chơi — nếu không thì ô úp rò qua cửa sau;
   * · hợp đồng tiết kiệm KHOÁ theo mức lãi NHÌN THẤY, không theo mức sau kỳ họp chưa lật;
   * · bot chấm mã bằng Ô KỲ VỌNG (telegraph của lá tin vừa lật, chiết khấu theo tỷ lệ tin giả),
   *   không đọc ô úp — úp với người mà không úp với bot là phát vốn cho bot.
   *
   * ⚠ VÌ SAO ĐÂY LÀ TRẢ NỢ CHỨ KHÔNG PHẢI CƠ CHẾ MỚI: `thiet-ke-da-chot/01` §3 bước 3 (chốt
   * 27/07) đã ghi *"Ô thị trường lật SAU KHI đã quyết"*, và `sinhMap` cấm hai ô tin liền nhau
   * với đúng lý do *"telegraph của ô trước phải có chỗ để ứng nghiệm (hoặc lộ là giả)"*. Luật
   * bài đã bảo đảm sau mỗi lá tin là một ô pha để kiểm chứng; tầng API thì phát đáp án trước.
   *
   * ⚠ Cần `mapV28` + `botDungThuocThat` cùng bật (ô kỳ vọng đọc tỷ lệ tin giả hiệu dụng).
   */
  oUp: boolean;
  /**
   * D386 — BOT ĐỌC NỀN REGIME Ở VÒNG TIN, TRÊN ĐƯỜNG THẬT.
   *
   * `gia_chong_nen` (v36 R2/R3) làm engine định giá vòng tin bằng NỀN × TIN, và
   * `BoiCanhLenh.nen` là cửa để bot chấm mã bằng CÙNG mô hình đó. Cửa ấy được nối
   * ở bàn đo (`nhip_lenh_bot.ts`) từ D166/D172 nhưng KHÔNG BAO GIỜ được nối ở
   * `holdem_api.ts` — nên suốt v36 → v52, bot người chơi gặp chấm mã bằng TIN
   * KHÔNG, còn bot gate chấm bằng NỀN × TIN. Hai đàn bot khác nhau, gate đo đàn
   * người chơi không gặp (đúng lớp D83).
   *
   * ⚠ CỜ NÀY GÁC CẢ HAI ĐƯỜNG, không chỉ đường thật. Gác một phía là giữ nguyên
   * cái drift: bàn đo vẫn cấp `nen` cho v36–v52 trong khi đường thật không. Bật
   * cờ ở cả hai chỗ ⇒ từ v53 hai đường cùng một bối cảnh; tắt ⇒ cả hai cùng
   * không có nền, nên trận đã lưu replay ra đúng từng chip cũ.
   *
   * ⚠⚠ SỐ ĐO KHÔNG ĐỠ CHO LỜI "BOT THẬT YẾU HƠN" — xem D386. Ghép cặp cùng
   * archetype trên cùng bàn (2.000 trận × 3 cỡ map): GỘP trong nhiễu
   * (t = −1,1…−1,3), `tat_tay`/`phong_thu` không đổi có ý nghĩa, riêng
   * `da_dang` TỆ ĐI rõ rệt khi có nền (−483 / −606 / −1185 chip; t = −5,3 /
   * −4,7 / −7,1) và mức phạt LỚN DẦN theo độ dài map. Nên cờ này là bản vá
   * ĐÚNG-SAI (bot phải đọc đúng mô hình engine đang chạy), KHÔNG phải bản vá
   * SỨC MẠNH — và nó mở ra một câu chưa ai trả lời: vì sao thông tin đúng hơn
   * lại làm con bot đa dạng hoá chơi dở đi.
   *
   * ⚠ D386 (gộp 23/09) — HIỆN KHÔNG PHIÊN BẢN NÀO BẬT cờ này. Nhánh gốc bật nó ở một khoá
   * thử nghiệm `balance-v53-botdocnen` (= v52 + đúng một cờ; chưa từng là mặc định, không
   * trận nào mang nó, không nằm trong golden). Khoá ấy KHÔNG mang sang khi gộp: nó trùng tên
   * dòng v53 mà lại không kế thừa `balance-v53-upo`. Bật thật thì phải là khoá MỚI kế thừa
   * mặc định đang chạy (A11.3) + đo lại gate — quyết định của founder (A8.2).
   * ⚠ Ở luật ô-úp (`oUp`, v53) cờ này KHÔNG có tác dụng: bối cảnh bot đi nhánh ô kỳ vọng
   * (luôn là ô pha) và nhánh ấy không mang `nen`. Nó chỉ có nghĩa ở luật ô-ngửa.
   */
  botDocNen: boolean;
  /*
   * ═══ v54 (D389, founder 23/09) — CHU KỲ CÓ NGÃ RẼ + LƯỢC BỎ ═══════════════════════════
   * Năm cờ dưới đây sinh cùng một đợt nhưng TÁCH RIÊNG có chủ ý (khuôn `daDangHoaTranTaiSan`):
   * mỗi cờ đụng một mặt khác nhau, gộp lại là mất cửa bật/tắt từng cái khi đo gate. Tên theo
   * quy ước *bản cũ = false* — cờ LƯỢC BỎ mang đuôi `Tat`/`Gon`/`Deu` chứ không đảo nghĩa cờ cũ.
   */
  /**
   * BÁNH XE MÙA CÓ NGÃ RẼ thay máy tick cho ô pha thường (`sinhMap`, `taoBanhXe`). Số + nguồn:
   * `config/banh_xe_mua.ts`. Kéo theo: kỳ họp GIỮ lật mặt của mùa (thôi lật cứng "đi ngang"),
   * hàm phản ứng đọc mùa (quá nóng ⇒ TĂNG lãi — đảo luật "biến động ⇒ hạ" người chơi đã học),
   * bot đoán lá úp theo mùa (`nenBanhXeCongKhai`). Cần `regimeTick`.
   */
  banhXe: boolean;
  /**
   * KHẨU VỊ RỦI RO TẮT (founder 23/09: "bỏ phần… khẩu vị rủi ro"): mọi ghế chơi đúng
   * `KHAU_VI_MAC_DINH`, lựa chọn thận trọng/quyết liệt biến mất khỏi màn tạo trận. Lý do: nút
   * chọn mức phơi nhiễm MIỄN PHÍ, trùng việc lá Đòn Bẩy (có giá thật là lãi vay).
   */
  khauViTat: boolean;
  /**
   * VỐN ĐỀU (founder 23/09: "ko cần chia vốn nữa… chấm điểm cho dễ"): mọi ghế vào trận với
   * `START_VON`, kể cả vai khác Cá nhân. CHỈ bỏ hệ số vốn — các luật riêng khác của vai GIỮ
   * (founder: vai ngoài cá nhân "cố định 1 cặp trait ngay từ đầu"; luật vai hôm nay chính là
   * cặp ấy ở dạng thô, chờ hệ trait).
   */
  vonDeu: boolean;
  /**
   * BÀN 16 LÀ CỠ DUY NHẤT (founder 23/09: "16 thành cỡ duy nhất"): trận mới tạo dưới khoá này
   * luôn 16 ô, bỏ chọn cỡ và mở khoá cỡ theo số trận. Trận cũ giữ cỡ đã lưu (`so_o` là nửa danh
   * tính của map). Bàn tập và đề buổi đo ghim khoá RIÊNG của chúng, không đọc cờ này.
   */
  chiBan16: boolean;
  /**
   * LÕI GỌN (founder 23/09: "phần cắt còn mở rộng ra các lõi"): năm lá bị động rời shop —
   * Chia Lệnh · Khớp Nhanh · Đa Dạng Hoá · Đi Ngược · Phòng Hộ. Còn sáu lá hành động: Mua
   * Đuổi · Bắt Đáy · Chặn Lỗ · Đòn Bẩy · Lướt Sóng · Bán Khống (founder giữ Bán Khống).
   * Lõi ghim của vai rơi vào nhóm bị cắt thì vai đó thôi ghim lõi.
   */
  loiGon: boolean;
  /**
   * THANH KHOẢN NĂM NẤC (D395, founder 24/09: *"cho nó co dãn theo thẻ sự kiện đang được lật"*):
   * thêm nấc CẠN dưới mỏng và RẤT DÀY trên dày (`config/thanh_khoan_nam_nac.ts`); CẠN THANH KHOẢN
   * làm mỏng sổ (−2) và cả bảy loại thiên nga đen cùng −1 (một lá, một luật). Nấc nền sáu mã và
   * độ sâu ba nấc giữa GIỮ NGUYÊN. Tắt ⇒ đúng luật ba nấc của D1 (`THANH_KHOAN_DONG`).
   */
  thanhKhoanNamNac: boolean;
  /**
   * CHU KỲ CÓ TUỔI (D397, founder 24/09: *"phải có tính liên kết rõ ràng chứ không được ngẫu nhiên kiểu
   * markov 100%"*): độ dài mùa của bánh xe RÚT SẴN lúc vào mùa (`BANH_XE_MUA.HAN`) thay vì tung hazard cố
   * định mỗi ô ⇒ mùa già thì sắp hết, lịch sử đoán được lá sau. Cần `banhXe`. Tắt ⇒ đúng bánh xe D389.
   */
  muaDinhHan: boolean;
  /**
   * TIN NỘI SINH THEO MÙA (D397): bong bóng/lạm phát/phá sản/cạn thanh khoản/lãi suất nghiêng về mùa của
   * chúng (`BANH_XE_MUA.TIN_THEO_MUA`); tin ngoại sinh giữ ngẫu nhiên. Cần `banhXe`.
   */
  tinTheoMua: boolean;
  /**
   * BỘ LUẬT TỪNG LÁ (D399, founder 24/09: *"mỗi thẻ phải có 1 rule để không bị quá vô lý với chuỗi trước/ sau"*):
   * tiền đề + hệ quả cho mọi lá trong `sinhMap` (`config/luat_la.ts`) — mặt lệch theo nghĩa, phục hồi cần đáy, quá
   * nóng cần nhiệt, khủng hoảng cần ngòi, kỳ họp sai phần lớn là chậm nhịp. Cần `banhXe`. Tắt ⇒ đúng bàn D397.
   */
  luatLa: boolean;
  /*
   * ═══ v54 (D403, founder 24–25/09) — QUỸ VÒNG HẾT "NGỒI IM ĂN TRỌN" ══════════════════════════
   * Founder gửi ảnh vòng +38,6% NAV: gần cả bàn CẮT nên một ghế ngồi yên ăn trọn quỹ 4.374 (8 ghế × 500 + phí) —
   * *"t ngồi chơi 1 round không làm gì mà cũng được đớp tiền"*. Founder chọn C (A + B) rồi gỡ luôn nút BỎ: *"cái phần
   * bỏ bài ấy bây giờ vô dụng phết nhỉ vì chúng ta đã đổi sang chip từ lâu rồi mà"*. Ba cờ TÁCH RIÊNG để gate đo
   * từng cái (khuôn năm cờ D389).
   */
  /**
   * BỎ BÀI TẮT: nước 'bo' rời danh sách được-làm của MỌI ghế (người + bot) ở `choiVongCuoc` — đúng chỗ đã chặn quota
   * cắt lỗ, nên bot và nút trên màn tự đồng ý với nhau. Bot đòi 'bo' ⇒ THEO giá nền. Muốn về tiền mặt thì bán bằng lệnh
   * shop thường (nút BÁN SẠCH): chịu phí lệnh thường, GIỮ phần quỹ, không phí rút khẩn / giẫm đạp.
   * Đứng ngoài / đầu hàng là đổi TƯ THẾ trước vòng cược, không đi qua 'bo' ⇒ cờ này không chạm chúng.
   */
  boBaiTat: boolean;
  /**
   * QUỸ THEO CỠ BÀN (phương án B): nền mỗi ghế = ⌊`CAM_KET_NEN` × `SEATS` ÷ số ghế của bàn⌋ ⇒ quỹ ≈ 2.500 ở mọi cỡ bàn
   * (4 ghế 625 · 5 ghế 500 · 6 ghế 416 · 7 ghế 357 · 8 ghế 312). Bàn 8 ghế hết khuếch đại 1,6× quỹ. Số ghế là số ghế LÚC
   * DỰNG BÀN (`st.ghe.length`), không đổi khi có ghế cháy — mức nộp mỗi vòng biết trước từ đầu trận.
   * Một cửa: `nenVongCua` (engine) — vòng cược, `quy_vong_hien_tai` và phân loại hành động đều đọc nó.
   */
  quyTheoCoBan: boolean;
  /**
   * TRẦN PHẦN MỘT GHẾ (phương án A): trong MỖI pot, một ghế nhận tối đa suất hạng 1 của bảng gốc (`CHIA_QUY_VONG.
   * TRONG_SO[0]` ÷ tổng = 50%). Phần vượt trả lại các ghế ĐÃ GÓP vào chính pot đó (trừ ghế bị kẹp) theo tỷ lệ góp.
   * Ca nó cắn: pot còn ≤ 2 ghế tranh (100% hoặc 62,5% ⇒ 50%). Pot ≥ 3 ghế tranh thì hạng 1 ≤ 50% sẵn — không chạm chip nào.
   */
  quyTranHang1: boolean;
  /*
   * ═══ v54 (D405, founder 25/09) — SỔ TIẾT KIỆM CHỊU NỀN KINH TẾ ═══════════════════════════════════
   * Founder: *"gửi ngân hàng cũng phải chịu ảnh hưởng từ trạng thái nền kinh tế mà"* ⇒ chốt *"1 + 3 + 2"*, *"2 phải hiếm"*.
   * Gate D403: "gửi hết vào ngân hàng" thắng 24,7% bàn 8 (may rủi 12,5%) vì sổ miễn mọi rủi ro. Số + lý lẽ đầy đủ:
   * `config/tiet_kiem_kinh_te.ts`. Ba cờ tách riêng để gate đo từng cái.
   */
  /**
   * LẠM PHÁT ĂN CẢ SỔ: mỗi ô, tiền GỐC trong sổ mất đúng như tiền mặt — lạm phát nền (`matLamPhatNen`) rồi cú sốc
   * theo lá (`bpSuKienTienMat`), cùng thứ tự và cùng phép làm tròn. Lãi tính SAU, trên gốc còn lại; huỷ trả gốc đã
   * bị ăn (không có cửa "huỷ để lấy lại gốc nguyên"). Tắt ⇒ sổ miễn lạm phát như v43–v53.
   */
  tietKiemLamPhat: boolean;
  /**
   * LÃI THẢ NỔI: lãi mỗi ô = `laiTietKiemBp(lãi suất nền ĐANG CHẠY, kỳ hạn)` và ghi lại vào `lai_bp` của hợp đồng,
   * thay vì mức chốt lúc mở. Mùa hạ lãi thì sổ cũ cũng hạ theo. Tắt ⇒ lãi chốt lúc mở (tiền gửi có kỳ hạn cổ điển).
   */
  tietKiemThaNoi: boolean;
  /**
   * NGÂN HÀNG ĐỔ VỠ — HIẾM: lá phá sản / cạn thanh khoản đến sau HAI lá xấu liền nhau (`nganHangDoVoTai`, ≈ 1 trận
   * / 20 ở bàn 16) ⇒ phần tiền gửi VƯỢT hạn mức bảo hiểm mất `MAT_BP` (PLAYTEST-TUNE), chia về từng hợp đồng theo tỷ lệ.
   */
  nganHangDoVo: boolean;
  /*
   * ═══ v55 (D409, founder 25/09) — LỬA · XU · TRAIT · LƯỚT SÓNG MỚI ═══════════════════════════════════════
   * Founder chốt 10 câu của `docs/thiet-ke-de-xuat/gameplay/kien-truc-cai-tien-alpha-draft.md` §8 (gộp MỘT khoá —
   * câu 6: B). Chín cờ TÁCH RIÊNG (khuôn năm cờ D389) để gate đo từng cái bằng `--co=`. Số: `config/lua.ts` ·
   * `config/trait.ts`. Máy: `server/holdem/lua.ts` · `server/holdem/trait.ts`.
   */
  /** Ngọn lửa đà: nấc theo chuỗi vòng giữ bias, dập theo NGƯỜI CHƠI; xu theo nấc. Không tác dụng tiền nếu hai cờ dưới tắt. */
  lua: boolean;
  /** Trượt giá nhân `LUA.HE_SO_TRUOT_BP[nấc]`. Cần `lua`. */
  luaPhi: boolean;
  /** Mắt xích `lua` theo mã: lãi cộng thêm, lỗ trừ thêm (đảo nặng hơn thuận). Cần `lua`. */
  luaQuyetToan: boolean;
  /** Mua Đuổi đúng lúc ⇒ chuỗi +1; muộn (FOMO) ⇒ không đếm + trượt ×1,5. Cần `lua`. */
  luaMuaDuoi: boolean;
  /** Xu từ lõi phát huy (mắt xích của lõi dương) — thay nhiệm vụ kỳ ngộ đã cắt. Cần `lua`. */
  nhiemVuLoi: boolean;
  /** Chợ trait ở mốc `MOC_TRAIT` + hiệu lực mọi trait kho chung. */
  trait: boolean;
  /** Vai ngoài Cá nhân mang sẵn cặp `TRAIT_VAI` (gọi tên luật `vaiCoRang`, không viết lại). Cần `trait`. */
  traitVai: boolean;
  /** Chặn Lỗ chỉ còn qua trait KỶ LUẬT (máy `chan_lo_san` cũ) + CHỐT NON là trần gương. Cần `trait`. */
  chanLoTrait: boolean;
  /** Lướt Sóng mới: lệnh CHỐT LỜI TRONG Ô — bán một phần ở mức mục tiêu nếu đỉnh sóng trong ô chạm tới. */
  luotSongMoi: boolean;
  /**
   * v55 (D411) — VÀNG gộp vào XU (founder 26/09: *"vàng kia là cái gì? Gộp với xu đi"*): MỘT ví `xu` nhận cả phần cấp mỗi
   * vòng lẫn phần của lửa/lõi, trả cho cả đổi bài shop lẫn cuộn chợ trait. Nhãn VÀNG trùng tên mã tài sản Vàng — gộp là
   * gỡ luôn cái trùng ấy ở trận v55.
   */
  gopXu: boolean;
  /**
   * v55 (D411) — lần khảo sát lại ĐẦU mỗi vòng miễn phí cho NGƯỜI CHƠI, đúng luật ghi ở `CHI_PHI_KHAO_SAT_LAI`. Nhãn shop
   * ("⟳ FREE") và bot làm đúng thế từ lâu; riêng đường trừ của người chơi tính cả lần đầu. Khoá cũ giữ cách cũ (replay).
   */
  khaoSatDauMienPhi: boolean;
  /**
   * v55 (D422) — lửa KHÔNG phạt khi đảo chiều (founder 26/09: *"nếu bạn ko giữ lửa thì lợi thế đã ít hơn rồi"*). Đo
   * trước đó: phạt đảo nặng hơn thưởng thuận khiến lửa thành một khoản thuế — tắt lửa lại có lợi (trait-v2 §1b).
   */
  luaKhongPhatDao: boolean;
  /**
   * v55 (D422) — KỶ LUẬT / CHỐT NON đặt sàn / trần SAU bước nhân Đòn Bẩy (đỡ và cắt cả phần vay); KỶ LUẬT vẫn thu phí
   * mỗi vòng. Founder chọn B: *"làm hiệu ứng của lõi chốt non kia tệ hơn để cho cân bằng cùng người anh em kỷ luật"*.
   */
  kyLuatSauDonBay: boolean;
  /**
   * v56 (D447, founder 28/09) — PHÍ MUA BÁN CỘNG DỒN CẢ VÒNG theo từng mã: ngưỡng bậc 1 và độ dốc bậc 2 của `PHI_LENH_V51`
   * tính trên TỔNG tiền đã đổi tay ở mã ấy trong vòng, không trên từng lệnh. Trước cờ này bán hết 18.472 USDT trong một
   * lệnh trả 1.266 phí, còn cùng lượng ấy chia năm lần KHỚP NGAY trong vòng chỉ trả 49 (vàng 2.592 so 120, crypto 5.184
   * so 262) — trái đúng ý D346 ("chi phí tăng theo lượng tiền đẩy vào chợ trong MỘT vòng"). Nay bấm HẾT hay chia nhỏ trả
   * như nhau. ⚠ Bot đặt mỗi mã một lệnh mỗi vòng nên bàn đo gần như không chạm cờ này — số gate TRÙNG v55 là đúng.
   */
  phiCongDonVong: boolean;
  /*
   * ═══ v57 (D456, founder 03/10) — KHOÁ MINIGAME · BƯỚC 1: BỎ CƠ CHẾ ═══════════════════════════════════════════
   * Hai cờ MỚI nằm cạnh sáu cờ đã có (tietKiem · tietKiemLamPhat · tietKiemThaNoi · nganHangDoVo · luotSongMoi ·
   * luaMuaDuoi) mà khoá v57 tắt. ⚠ CỐ Ý TÙY CHỌN (`?`): mọi khoá ≤ v56 vắng cờ = false ⇒ không phải sửa 54 dòng khoá cũ
   * (tệp này là chỗ hai cửa sổ va nhau) và replay trận cũ không đổi một bit. Kế hoạch: `docs/thiet-ke-de-xuat/gameplay/
   * kien-truc-minigame.md` §7.
   */
  /**
   * BẢNG ĐIỆN TỬ BỎ (founder 03/10: *"tôi nghĩ nên bỏ tính năng bảng điện tử"*): `POST /matches/:id/bang-dien-tu` trả
   * 403 `luat_tat`, DTO ván mang `khong_bang_dien_tu` để web ẩn nút. Việc nó từng làm (mua thông tin có phí) thành MUA TIN SỚM
   * của lá Lướt Sóng trong minigame (bước 4). Code bảng GIỮ NGUYÊN — trận ≤ v56 replay đúng từng chip phí mở bảng.
   */
  khongBangDienTu?: boolean;
  /**
   * THẺ SỰ KIỆN LUÔN THẬT (founder 03/10: *"thẻ sự kiện lật ra ở ngoài bây giờ 100% là sự thật vì cái lừa sẽ ở trong mini
   * game"*): `sinhMap` không rút cờ giả cho ô sự kiện nào (`la_tin_gia` luôn false), mọi chỗ đọc tỷ lệ tin giả (bot hoài nghi,
   * thống kê bộ bài) trả 0. Cú rút `holdem_gia` theo (seed · ô) RIÊNG nên bỏ không xê dịch cú rút nào khác — nhưng chuỗi nhân
   * quả (tin giả không nạp/xả chuỗi) đổi, nên map v57 KHÁC map v56 cùng seed: đúng, đây là khoá luật mới.
   */
  theLuonThat?: boolean;
  /**
   * CẠN THANH KHOẢN CÓ NGÒI Ở MỌI MÙA (D470, founder 04/10: *"thẻ cạn thanh khoản chỉ xuất hiện sau thiên nga đen hoặc g chuỗi bear dài"*):
   * lá `hack_san` chỉ hợp lệ khi có hoảng loạn thật ≤ 5 ô trước hoặc chuỗi ≥ 2 lá Giảm (`LUAT_LA.CAN_SAU_KHUNG`); khoá cũ chỉ chặn ở mùa
   * lành. Cần `luatLa`. TÙY CHỌN như hai cờ v57 bước 1 — vắng = false ở mọi khoá cũ.
   */
  canSauKhung?: boolean;
  /*
   * ═══ v57 (D457, founder 03/10) — KHOÁ MINIGAME · BƯỚC 2: KHUNG TRẬN ═════════════════════════════════════════
   * Ba cờ MỚI (tùy chọn — cùng lý do với hai cờ bước 1) cộng với hai cờ có sẵn v57 đổi chiều: `chiBan16` (true → false) và
   * `vonDeu` (true → false). Kế hoạch: `docs/thiet-ke-de-xuat/gameplay/kien-truc-minigame.md` §7, bước 2a.
   */
  /**
   * BÀN 12 LÀ CỠ DUY NHẤT (founder 03/10 chọn A — *"bàn 12 lá"*): trận mới tạo dưới khoá này luôn 12 ô (`CO_BAN_MINIGAME`), bỏ chọn
   * cỡ. 12 ô = **11 vòng** vì ô đầu là ô mở màn lật sẵn (`soVong`, `o_up`). Đứng TRƯỚC `chiBan16` ở chỗ chọn cỡ, nên khoá mang cả
   * hai cờ vẫn ra 12. Bàn 12 có vai (bốc ở bàn ≥ 12), chợ trait ở vòng 1 · 5 · 9 (`MOC_TRAIT_MINIGAME[12]`, đọc nhờ cờ `khoTraitHep`), thẻ chiến thuật ở 2 · 4 · 6.
   */
  chiBan12?: boolean;
  /**
   * ĐỒNG HỒ NHỊP NGẮN (founder 03/10): đặt lệnh vòng ≥ 2 còn 15 s, đọc kết quả + chia tiền còn 5 s (`DONG_HO_MINIGAME`); vòng 1 và các phần
   * cộng thêm ở vòng lõi / mốc trait giữ số D442. Web ẩn khoảnh khắc từng vòng (founder muốn dồn về màn cuối trận — màn đó CHƯA có
   * chỗ diễn lại, việc mở của D457).
   * Khung chọn lá 8 s + màn minigame 38 s CHỪA, chưa tính vào hạn vòng (bước 4).
   */
  dongHoMinigame?: boolean;
  /**
   * CHỢ TRAIT CỦA KHUNG MINIGAME (tên giữ `khoTraitHep` cho khỏi đụng cả repo): (1) chỉ chào mười trait không phụ thuộc minigame
   * (`KHO_TRAIT_HEP`) — mười lá đổi nghĩa khi lãi/lỗ dồn vào màn chơi được gác tới bước 4; (2) bàn 12 mở chợ ở vòng 1 · 5 · 9
   * (`MOC_TRAIT_MINIGAME`, qua `laMocTrait(vong, soO, st)`). Hai thứ đi CHUNG một cờ vì cùng một lý do — và để khoá cũ có `trait`
   * chạy bàn 12 vẫn KHÔNG có chợ (golden bắt được lỗi này ở bản đầu). Cần `trait`.
   */
  khoTraitHep?: boolean;
  /**
   * D482 (founder 04/10: *"Bỏ lõi ghim, đổi thành trait ghim"*) — TRAIT GHIM thay LÕI GHIM của vai: vai thôi ghim lõi ở ô 1 (lõi là thứ
   * chơi trong màn, phải tự chọn); cặp vai đọc `TRAIT_VAI_MINIGAME` — Cá mập ĐÒN BẨY ×1,5 trong màn (`HE_DON_BAY_VAI`) · Đội lái TUNG TIN đầu
   * màn. Cần `traitVai`. TÙY CHỌN như các cờ v57 khác — vắng = false ở mọi khoá cũ.
   */
  traitGhimMinigame?: boolean;
  /**
   * D498 (founder 04/10) — TỔ CHỨC KHUNG MINIGAME + CHIA VAI MỚI: chia vai theo cỡ bàn (< 4 ghế 1 vai · 4–7 ghế Tổ Chức + Cá Mập HOẶC Đội Lái · 8 đủ
   * ba); Tổ Chức không margin (không Đòn Bẩy) + phí quản lý mỗi vòng; trait RẢI LỆNH ba cấp độc quyền vai đặc biệt. Vắng = false ở mọi khoá cũ.
   */
  toChucV57?: boolean;
  /**
   * D506 (founder 04/10: "tăng vốn của cá mập hay tổ chức lên đi chứ 30k so với 10k của cá nhân thì ít quá, thiếu thực tế" → mức 3) — VỐN VAI v57:
   * hệ số vốn đầu theo `HE_SO_VON_V57` (vai.ts) thay `VAI[].he_so_von`. Đi cùng cú tự đẩy theo quy mô tuyệt đối (`TU_DAY`, D506). Vắng = false.
   */
  vonVaiV57?: boolean;
  /**
   * D516 (founder 05/10: "Cái đầu tiên thì cân bằng lại 1 tý") — PHÍ HAI BẬC THEO ĐỘ SÂU CỦA GHẾ: độ sâu chợ quy chiếu = 10.000 × hệ_số_vốn^MU
   * (`PHI_SAU_VAI_V57`, `sauPhiVaiBp`). Vai vốn to bớt bị phí nghiền ở lệnh vừa; lệnh dồn hết vẫn chạm trần. Vắng = false.
   */
  phiSauVaiV57?: boolean;
  /**
   * D517 (founder 05/10 chọn B "nhưng hệ số thấp hơn") — BẦY CÁ NHÂN trong màn: Cá nhân nền + ghế Cá nhân khác giữ mã đuổi theo chuỗi nến
   * (`BAY_CA_NHAN`, `soCaNhanCung`). Vắng = false.
   */
  bayCaNhanV57?: boolean;
  /**
   * D526 (founder 05/10, demo `docs/ui-ux/demo/nhip-tran.html`) — NHỊP XEN KẼ: trận mới là BÀN 8 Ô (`CO_BAN_XEN_KE`, 7 vòng vì `o_up`; đứng
   * TRƯỚC `chiBan12` ở chỗ chọn cỡ) và sau mỗi lần chốt là MỘT chặng — màn minigame HOẶC chợ trait, theo `NHIP_XEN_KE` (vòng 1 có cả hai).
   * Vòng 1 có màn (khung v57 chỉ từ vòng 2). Lõi theo lịch của cỡ bàn; chợ trait 45 s (`CHON_TRAIT_XEN_KE_S`). Vai bốc ở bàn 8 (khoá cũ chỉ
   * ≥ 12). Cần `dongHoMinigame` · `khoTraitHep`. Vắng = false ở mọi khoá cũ.
   */
  nhipXenKe?: boolean;
  /**
   * D528 (founder 05/10, demo `minigame-bat-day.html` bản 49 — *"Chốt thi công đi"*) — trên nền v58: trait KÊ MUA / KÊ BÁN (lệnh giới hạn một mức giá
   * trong màn; Tổ Chức mang sẵn) · TÂM LÝ YẾU thay KỶ LUẬT (−14 % vốn màn ⇒ bán 60 %) · trần thua Tổ Chức áp cả khoản GIỮ SUỐT · VAI GHẾ KHÁC BỊ GIẤU
   * trong trận trừ khi mang SOI VAI. Kho trait `KHO_TRAIT_V59`. Vắng = false ở mọi khoá cũ.
   */
  keLenhV59?: boolean;
  /** D530 — lõi (lá chiến thuật) chỉ tác động qua màn minigame: engine thôi canh nhịp · Đòn Bẩy ×2 + lãi vay + gọi ký quỹ · sóng Lướt Sóng · hàng tin · cặp lõi · sổ khống. */
  loiChiTrongMan?: boolean;
  /**
   * D536 (founder 06/10: *"Làm đủ như demo"*) — LỆNH LỚN trong màn: bot Cá Mập / Đội Lái giữ CÙNG mã đẩy giá trên màn của ghế (`LENH_LON_BOT`, demo
   * `cungMap`) + cột KHỐI LƯỢNG dưới nến + nhãn "◆ LỆNH LỚN" (Tổ Chức thấy ai đặt). Đổi đường giá màn ⇒ cổng mới. Vắng = false.
   */
  lenhLonV61?: boolean;
  /** D545 — bàn tập 6 ô có lịch kỳ họp (ô 3). Chỉ chạm cỡ 6 ⇒ trận 8 ô y nguyên. Vắng = false. */
  kyHopBanTap?: boolean;
  /** D550 — trận thật 14 ô · 13 vòng (`coBanGhim` ⇒ `CO_BAN_14`), lịch `NHIP_XEN_KE[14]` + kỳ họp ô 4 · 9. Bàn tập không đổi (cỡ riêng). Vắng = false. */
  ban14?: boolean;
  /** D560 — chu kỳ có ngòi: Quá nóng = cuối mùa tăng · Đi ngang có tính chất · suy thoái chỉ sau phân phối hoặc ngòi · sức căng chỉ phóng đại tin xấu khi lá Quá nóng / Phân phối vừa lật. Vắng = false. */
  chuKyCoNgoi?: boolean;
  /** v65 (D561) — Bán Khống chỉ ×2 (founder 07/10: hãm đòn bẩy chiều bán). Vắng = false. */
  banKhongX2?: boolean;
  /** v65 (D561) — lõi của màn chọn lúc CHỐT VÒNG, trước khi lá lật (founder 07/10). Vắng = false. */
  loiChonTruoc?: boolean;
  /** v65 (D561) — Bắt Đáy / Mua Đuổi bán bớt được khoản đang cầm (founder 07/10). Vắng = false. */
  banBotBdMd?: boolean;
  /** v65 (D561) — xếp hạng cuối trận theo cách E (founder 07/10). Vắng = false. */
  xepHangE?: boolean;
  /** v65 (D561) — ~45 % màn có hướng "đã vào giá": tin thật, giá quay đầu — dấu hiệu khối lượng cạn + nến rút chân (founder 07–08/10). Vắng = false. */
  vaoGia?: boolean;
  /** v65 (D561) — màn đánh trên nhiều mã — chạm chart phụ đổi mã (founder 08/10: demo "tạm ổn"). Vắng = false. */
  nhieuMa?: boolean;
  /** v65 (D561) — khoản trong màn CHẠY THEO GIÁ tới cú bấm đầu (chữa lỗ vào muộn né cú rơi — founder 08/10 "Chữa trong v65"). Vắng = false. */
  khoanTheoDuong?: boolean;
  /** v65 (D561) — màn của ô PHA: lá úp tới hết màn (người chơi đọc chiều từ nến — founder 08/10). Vắng = false. */
  upLaPha?: boolean;
  /**
   * v66 (D566) — LÃI ÁP THEO LÁ QUYẾT TOÁN dưới luật ô úp: `laiSuatLuc` đọc mức của lá quyết toán vòng N (`trang_thai[N]`), không
   * phải lá đã lật cuối (`trang_thai[N−1]`). Chữa chỗ D382 bỏ sót (founder 10/10: khoá mới, v53–v65 giữ trễ cho replay).
   * Không đổi tham số nào — chỉ đổi lá nào được đọc. Vắng = false.
   */
  laiApLaQuyetToan?: boolean;
  /**
   * v67 (D574) — BỐI CẢNH DÀI HẠN: hai lớp ẩn sóng công nghệ × pha nợ rút từ seed (`boiCanhDaiHan`), đổi độ dài / rẽ của bánh xe mùa,
   * nghiêng kỳ họp, nghiêng giá mỗi ô, tin vĩ mô ~1/3 số màn (SPEC `docs/spec/boi-canh-dai-han.md`). Cần `chuKyCoNgoi` + `muaDinhHan`. Vắng = false.
   */
  boiCanhDaiHan?: boolean;
  /** v68 (D584) — giải vòng trả bằng XU TRAIT: không thu nền, không hũ tiền (phí giao dịch không chia lại), xếp hạng vòng ⇒ `GIAI_XU`. Vắng = false. */
  giaiXu?: boolean;
  /** v69 (D586) — màn: BÁN BỚT bán hết được khoản giữ — Bắt Đáy · Mua Đuổi · màn không lõi; số lần theo Rải lệnh (`BAN_BOT_LAN`). Vắng = false. */
  banBotRai?: boolean;
  /** v70 (D589) — màn: VÀO 3 phần (Mua Đuổi 3 : 2 : 1 · Bắt Đáy 1 : 2 : 3) · Mua Đuổi ×2 (vay bằng vốn màn) + CHỐT gộp (nửa rồi hết). Vắng = false. */
  baPhan?: boolean;
  /**
   * v67 (SPEC ghép bàn xếp hạng 11/10) — CHIA VAI THEO CỠ BÀN cho bàn XẾP HẠNG GHÉP NGƯỜI: bảng 5 mốc 4/8/12/16/20 (`VAI_THEO_CO_BAN`, `bocThamVaiTheoCoBan`)
   * thay bảng 3 nhóm D515. Chỉ đổi CÁCH BỐC VAI lúc tạo trận (vai ghi vào `ghe_json`, replay đọc lại) — engine, vốn, giá không đổi. Vắng = false.
   */
  vaiTheoCoBan?: boolean;
  /** D30 — bot dùng `chonCamKet` cho lượt đầu mỗi vòng. */
  botTuQuyetCamKet: boolean;
  /**
   * 28/07 — TẮT MÁY CƯỢC TUẦN TỰ (thi hành sớm một phần D40: "pot + cược chết").
   *
   * Bật ⇒ vòng cược chỉ thu CAM KẾT NỀN của mọi ghế còn chơi — không ai tố,
   * không ai theo, không ai bỏ trong pha cược. Quỹ vòng = nền × số ghế, chia
   * theo hạng PnL như cũ. Mất mát tối đa một vòng bị chặn ở đúng mức nền.
   *
   * ⚠ VÌ SAO PHẢI CÓ CỜ NÀY NGAY, không đợi engine v10 trọn gói: sau khi UI gỡ
   * hai nút poker (27/07), nút CHỐT VÒNG nộp chuỗi cược RỖNG, mà replay xử chuỗi
   * cạn bằng fallback THEO MỌI LỆNH TỐ ("các lần sau mặc định THEO"). Bot v9 tố
   * hung ⇒ người chơi tay trắng bị kéo theo tới đáy: founder đo được trên prod
   * 10.000 → 2.886 trong MỘT vòng không cầm lá nào. Đây là lỗi tiền thật, không
   * chờ được. Trận cũ (≤ v9) giữ nguyên fallback để replay không đổi.
   */
  cuocTat: boolean;
  /**
   * 28/07 — ENGINE v10 NAV: vị thế có kích cỡ tiền, NAV = tiền mặt + danh mục
   * là thước xếp hạng duy nhất (D40 + spec 01). Xem `NAV_V10` và
   * `server/holdem/nav.ts`. Bật ⇒ định giá cắn vào vị thế, lạm phát bào tiền
   * mặt, quỹ chia theo % TĂNG TRƯỞNG, cháy theo NAV.
   */
  nav: boolean;
  /** Lõi vốn 27/07 — Đảo danh mục + Khoá tài sản 2 vòng. */
  luatVon: boolean;
  /**
   * D33/D34 — đặc quyền thẻ chiến thuật + nhịp chọn thẻ co theo đường cong.
   *
   * Một cần gạt cho CẢ CỤM chứ không phải năm cần gạt rời, và đó là cố ý: nhịp
   * mới (3 thẻ) và đặc quyền sinh ra cùng nhau — bật nhịp mà không bật đặc quyền
   * là bắt người chơi lấy ba lá không có tác dụng gì, còn bật đặc quyền mà không
   * bật nhịp là ba đặc quyền chen vào hai ô. Tách ra chỉ đẻ ra tổ hợp vô nghĩa.
   */
  dacQuyen: boolean;
  /**
   * D35 hướng 1 (v8) — tỷ lệ cam kết nhân vào `pnl_bp` + phí tài trợ.
   *
   * ⚠ CỔNG NÀY LÀ THỨ GIỮ LỊCH SỬ ĐỨNG YÊN. Cam kết trước v8 KHÔNG đụng tới
   * `pnl_bp`, nên bật luật mới cho một trận v7 đã lưu là đổi thứ hạng của một
   * trận đã đánh xong — `events` append-only, không sửa lại được.
   */
  donBayCamKet: boolean;
  /**
   * D-27/07 điều 3 (v8) — đặc quyền Đa Dạng Hoá nới thêm `MAX_TAI_SAN`.
   *
   * TÁCH RIÊNG khỏi `donBayCamKet` dù hai thứ ra cùng một ngày: chúng là hai
   * luật độc lập (một đụng thứ hạng, một đụng sức chứa danh mục) nên gộp chung
   * một cần gạt sẽ khoá tay khi cần bật/tắt riêng để ĐO. Trái với cụm
   * `dacQuyen` — cụm đó gộp vì tách ra chỉ đẻ tổ hợp vô nghĩa.
   */
  daDangHoaTranTaiSan: boolean;
  /**
   * D37 điều bổ sung (v8) — GỌI KÝ QUỸ NỔ Ở MỌI Ô, không riêng `hack_san`.
   *
   * Founder 27/07: *"đòn bẩy high risk high reward nên top 1 cũng ko khó lắm nhma
   * bạn hãy cân bằng để nó cần kỹ năng hơn 1 tý"*. Xem `GOI_KY_QUY` để biết vì sao
   * cần gạt này là cần gạt KỸ NĂNG chứ không phải cần gạt yếu-đi.
   *
   * TÁCH RIÊNG khỏi `donBayCamKet` — cái kia đang TẮT chờ founder, cái này BẬT.
   * Gộp một cần gạt là buộc phải bật cả thứ đo ra đã hỏng.
   */
  kyQuyRong: boolean;
  /** D39 (v9) — ma trận tương quan tài sản. Xem `TUONG_QUAN`. */
  tuongQuan: boolean;
  /**
   * D43 bước 2 (v11) — Ô LỊCH CHÍNH SÁCH + hàm phản ứng nội sinh CÔNG KHAI
   * (docs/thiet-ke-da-chot/03-chu-ky-tin-dung.md §5 bước 2, gate 7.6).
   *
   * Bật ⇒ lãi suất thôi là thẻ bốc ngẫu nhiên: các ô trong `LICH_CHINH_SACH`
   * do hàm phản ứng quyết (ai theo dõi lạm phát thì BIẾT TRƯỚC hướng, trừ ~15%
   * sai lầm chính sách), và lãi suất NGOÀI lịch bị hạ trọng số rất thấp.
   * Cổng giữ lịch sử đứng yên: trận ≤ v10b không có ô lịch, replay nguyên.
   */
  lichChinhSach: boolean;
  /**
   * D43 bước 3 (v12) — QUÁN TÍNH TỪNG HÀNG: chuỗi pha cùng hướng ĐÃ XÁC NHẬN
   * (≥ 2 ô) nghiêng cú rút kế về phía tiếp diễn; gãy hướng thì VỀ TRUNG TÍNH
   * (03-chu-ky-tin-dung §3 + §5.3). "Con số quan trọng nhất cả bản này".
   */
  quanTinh: boolean;
  /**
   * D43 bước 4 (v13) — SỨC CĂNG: bong bóng thôi là thẻ, thành BỘ ĐO ẨN
   * (03-chu-ky-tin-dung §5). S_map nạp/xả theo chuỗi ô (sinhMap); độ lớn lúc
   * chốt phiên ăn S đầy đủ = S_map + crowding bàn. Xem `SUC_CANG`.
   */
  sucCang: boolean;
  /** Founder chốt B 01/08 (v14) — nền trừ trên NAV, hết đường né bằng all-in. */
  nenNav: boolean;
  /** D43 bước 6 (v15) — 3 tham số chu kỳ mỗi map, công bố đầu trận. */
  chuKy: boolean;
  /** D43 §4.3 (v15) — lãi suất ngoài lịch ~75% ép thẻ đuôi trong 2–3 ô. */
  duoiTelegraph: boolean;
  /** D43 bước 7 (v16) — 5 mặt đuôi thay thẻ thiên nga đen. */
  duoi5: boolean;
  /** Doc 05 (v17) — lệnh bán khống trong shop, đặc quyền lá ban_khong. */
  lenhKhong: boolean;
  /**
   * Founder 01/08 (v18) — HỆ QUẢ CHƯA LẬT KHÔNG ĐƯỢC CẮN GIÁ.
   *
   * Founder bắt tận tay trên prod: lật Bong bóng là chuỗi "VÌ SAO" trừ luôn
   * một loạt "hệ quả Bong bóng → Thiên nga đen / Hạ lãi suất / Siết pháp lý"
   * — toàn thẻ CHƯA HỀ LẬT. *"T bảo là thẻ lật tiếp theo chứ có phải trừ hết
   * 1 round đâu? Trừ thì chỉ trừ tin giả thôi chứ mấy cái kia đã xảy ra đâu
   * mà trừ??"*
   *
   * Bật ⇒ `dungChuoi` bỏ nhánh F1/F2 (`nhanhHeQua`) khỏi giá: chỉ ô ĐÃ lật
   * + dư âm của nó (kể cả dư âm ĐẢO của tin giả) mới thành tiền. Dây chuyền
   * nhân quả KHÔNG chết — nó vẫn sống ở đúng chỗ founder chỉ: `sinhMap`
   * nghiêng cú rút Ô KẾ TIẾP về hệ quả của sự kiện vừa nổ (MT_SU_KIEN_KE_TIEP),
   * tức ai đọc được dây chuyền thì ĐOÁN TRƯỚC thẻ sắp lật mà xoay danh mục —
   * kỹ năng giữ nguyên, chỉ tiền là thôi chạy trước sự kiện.
   * Trận ≤ v17 replay nguyên nhánh cũ.
   */
  boNhanhHeQua: boolean;
  /**
   * Founder 02/08 (v19) — bảng xung đột GỌN: chỉ còn cặp Mua Đuổi × Chặn Lỗ.
   * Xem docstring `XUNG_DOT_V19` cho lý do từng cặp bị gỡ. Trận ≤ v18 replay
   * bằng bảng cũ (phạt whipsaw 250bp là tiền thật đã tính).
   */
  xungDotGon: boolean;
  /**
   * Founder 02/08 (v20, "Gỡ") — bảng cộng hưởng GỌN (CONG_HUONG_V20): gỡ hai
   * cặp dính lá chức năng, giữ hai cặp phòng-thủ-có-phí. Cổng riêng vì trận
   * v19 đã lưu có thể đã tính thưởng cộng hưởng cũ.
   */
  congHuongGon: boolean;
  /**
   * v21 — CÂN TRÔI KỲ VỌNG THEO MÃ (`CAN_TROI_BP`). Thi hành bất biến D43
   * §4.2 "EV phẳng, phương sai nổ"; KHÔNG đụng đuôi (founder bác trần biên độ
   * 02/08). Trận ≤ v20 replay nguyên — trôi cũ là kết quả họ đã thấy.
   */
  canTroi: boolean;
  /**
   * v22 — BOT MUA THEO LỢI SUẤT KỲ VỌNG ĐỌC TỪ BỐI CẢNH (D56, founder chốt A).
   *
   * ⚠ PHẢI CÓ CỔNG dù đây "chỉ là bot": hành vi bot KHÔNG nằm trong
   * `action_log` mà được SUY LẠI mỗi lần dựng trận. Đổi chính sách mua mà
   * không có cổng là viết lại vị thế đối thủ của mọi trận đã lưu — im lặng,
   * không lỗi, không cách nào biết. Tắt ⇒ chính sách vòng tròn cũ.
   */
  botDocTin: boolean;
  /** v23 — vòng cân trôi thứ hai. Xem `CAN_TROI_BP_V23`. */
  canTroi2: boolean;
  /**
   * v30 — BOT DÙNG ĐÚNG THƯỚC ENGINE ĐANG DÙNG (rà soát 11/08).
   *
   * Tắt ⇒ bot chấm điểm mã bằng bảng cân trôi v21 và chiết khấu tin giả 35%
   * phẳng ở nhịp chọn lá — tức HÀNH VI BOT CỦA TRẬN ĐÃ LƯU. Bật ⇒ bot đọc
   * `bangCanTroi()` + `tyLeCua()`, cùng nguồn với engine.
   *
   * ⚠ Đây là cờ SỬA DỤNG CỤ ĐO, không phải cần gạt cân bằng. Nhưng nó vẫn đổi
   * vị thế bot nên vẫn phải qua cổng: hành vi bot được SUY LẠI mỗi lần replay,
   * không nằm trong `action_log`.
   */
  botDungThuocThat: boolean;
  /**
   * v31 — QUỸ VÒNG CO GIÃN THEO SỐ GHẾ (founder 11/08: *"co dãn theo số bàn"*).
   *
   * Tắt ⇒ ba suất cứng bất kể bàn mấy người, tức bàn 8 chỉ 3/8 ghế có thưởng
   * và phân phối LỒI PHƯƠNG SAI (hạng 4 với hạng 8 nhận như nhau — đều 0 —
   * nên đánh liều không mất thêm gì). Đó là gốc G1 đỏ ở bàn lớn.
   * Bật ⇒ số suất = ceil(60% × số ghế); bàn 4/5 vẫn ra đúng 3 suất nên hai cỡ
   * bàn đang xanh KHÔNG đổi một chip. Xem `trongSoQuyVong`.
   */
  quyCoGian: boolean;
  /** v24 — cỡ vị thế theo độ tin. Xem `CO_VI_THE`. */
  coViThe: boolean;
  /**
   * D-04/08 — PHÁ HOÀ QUỸ VÒNG CÔNG BẰNG.
   *
   * Trước cờ này, hoà `pnl_bp` được phá bằng cách SO CHUỖI ID GHẾ. Ghế người
   * là `'ban'`, và `'ban' < 'bot_1'` = true ⇒ NGƯỜI CHƠI THẮNG MỌI CÚ HOÀ, mọi
   * vòng, mọi trận. Đo được: lợi thế ~1,34 hạng ở bàn 8 — gấp hơn NĂM LẦN ngưỡng
   * gradient kỹ năng G2 (0,25 hạng).
   *
   * Bật ⇒ phá hoà bằng `rngAt(seed, …, vòng, ghế)`: vẫn TẤT ĐỊNH (replay ra đúng
   * từng chip) nhưng không thiên vị ai. Cổng theo phiên bản vì nó ĐỔI KẾT QUẢ
   * trận đã lưu.
   */
  hoaCongBang: boolean;
  /**
   * v26 (founder 04/08) — LÃI SUẤT NỀN: một mức số công khai chạy suốt trận,
   * dịch theo hướng chính sách ở kỳ họp (và theo lá lãi suất THẬT ngoài lịch),
   * rồi tác động ngược vào XÁC SUẤT THẺ SỰ KIỆN và THANH KHOẢN.
   *
   * ⚠ Cổng theo phiên bản vì nó đổi `sinhMap` — trận đã lưu replay ra map KHÁC
   * nếu không cổng. Xem `LAI_SUAT_NEN`.
   */
  laiSuatNen: boolean;
  /**
   * v27 (founder 04/08) — BONG BÓNG THÀNH CHUỖI GÃY ĐƯỢC. Xem `BONG_BONG_V27`.
   * Cổng theo phiên bản vì nó đổi `sinhMap`.
   */
  bongBongChuoi: boolean;
  /**
   * v28 (founder 08/08) — TIN CÓ GỐC, TIN GIẢ CÓ HẬU QUẢ. Xem `MAP_V28`:
   * tỷ lệ tin giả theo LOẠI sự kiện · bong bóng có gốc tiền tệ (giả nhiều +
   * gãy sớm khi không tiền rẻ) · tin giả lộ kéo sự kiện kế nghiêng Sập sàn ·
   * phục hồi là cầu sang uptrend. Cổng theo phiên bản vì nó đổi `sinhMap`.
   */
  mapV28: boolean;
  /**
   * v29 (04 §4.6–4.7) — PHÍ VỘI VÀNG phi tuyến theo cỡ lệnh. Xem
   * `NAV_V10.VOI_VANG`. Cổng theo phiên bản vì nó đổi số học `apLenhGiaoDich`
   * — trận cũ replay ra đúng từng chip cũ.
   */
  phiVoiVang: boolean;
}

/**
 * BẢNG TRA PHIÊN BẢN → BỘ LUẬT. Tra bằng bảng, TUYỆT ĐỐI không so `===`.
 *
 * ⚠ VÌ SAO PHẢI LÀ BẢNG, và vì sao đây là bản vá một lỗi có thật:
 * cách cũ hỏi `row.balance_version === HOLDEM_BALANCE_VERSION`. Phép so đó đúng
 * đúng một khoảnh khắc — khoảnh khắc chỉ có một phiên bản. Ngay khi bump chuỗi
 * lên v6, MỌI trận v5 đang lưu bỗng đọc ra `false` và bot của chúng tụt về hành
 * vi trước D30, tức là replay ra kết quả KHÁC với thứ người chơi đã thấy. Cổng
 * dựng lên để giữ lịch sử lại chính là thứ viết lại lịch sử.
 *
 * Bảng này sửa gốc: mỗi phiên bản khai đúng bộ luật của NÓ, nên thêm phiên bản
 * mới không đụng gì tới phiên bản cũ. Thêm một cần gạt luật = thêm một trường,
 * và TypeScript bắt mọi dòng phải khai giá trị cho nó — không có đường quên.
 *
 * Phiên bản lạ hoặc thiếu ⇒ TẮT HẾT. Trận cổ nhất (chưa có cột) phải chạy bằng
 * bộ luật cổ nhất; đoán "chắc là bản mới" ở đây là đoán trên dữ liệu sống.
 */
export const BO_LUAT_THEO_PHIEN_BAN: Readonly<Record<string, BoLuatCanBang>> = {
  'balance-v5-D30-camket': {
    nav: false, cuocTat: false, botTuQuyetCamKet: true, luatVon: false, dacQuyen: false,
    donBayCamKet: false, daDangHoaTranTaiSan: false, kyQuyRong: false,
    tuongQuan: false, lichChinhSach: false, quanTinh: false, sucCang: false, nenNav: false, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v6-luatvon': {
    nav: false, cuocTat: false, botTuQuyetCamKet: true, luatVon: true, dacQuyen: false,
    donBayCamKet: false, daDangHoaTranTaiSan: false, kyQuyRong: false,
    tuongQuan: false, lichChinhSach: false, quanTinh: false, sucCang: false, nenNav: false, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v7-dacquyen': {
    nav: false, cuocTat: false, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: false, kyQuyRong: false,
    tuongQuan: false, lichChinhSach: false, quanTinh: false, sucCang: false, nenNav: false, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * ⚠ `donBayCamKet: false` — CỐ Ý TẮT, KHÔNG PHẢI QUÊN. Chờ founder quyết.
   *
   * Luật đã xây đủ và chạy được (bật bằng đúng chữ `true` này, hoặc bằng
   * `DIVON_DON_BAY=1` khi đo). Nhưng ĐO RA NÓ VI PHẠM CHÍNH RÀNG BUỘC FOUNDER
   * ĐẶT CHO NÓ — "thử các chiến thuật đi vốn khác nhau, đừng cho kiểu vô não
   * all-in" (27/07). Số trên 3.000 trận, bàn 5 ghế, map 8:
   *
   *     đòn bẩy TẮT   all-in vô não hạng 3/6 · thắng 23,2% · vốn cuối 11.299
   *     đòn bẩy BẬT   all-in vô não hạng 1/6 · thắng 29,6% · vốn cuối 12.827
   *
   * Ba lực đối trọng đã dựng sẵn trong `DON_BAY_CAM_KET` (đường cong căn bậc
   * hai · vế lỗ nhân nặng hơn 1,2× · phí tài trợ mỗi vòng) KHÔNG đủ. Dò phí tài
   * trợ tới 1.600 bp/vòng (gấp hơn 10 lần mức khởi đầu) mới đẩy all-in xuống
   * hạng 3 — và khi đó kẻ đứng nhất là "Giữ vị thế", con bot KHÔNG phản ứng gì
   * cả trận. Tức là chỉnh tham số không cứu được: nó chỉ đổi xem con bot nào
   * KHÔNG SUY NGHĨ thì thắng.
   *
   * NGUYÊN NHÂN GỐC, đo được: "Theo thẻ" — con bot cam kết THEO ĐỘ TIN vào danh
   * mục — xếp BÉT ở CẢ SÁU cấu hình đã thử. Cam kết theo độ tin thì phải có một
   * độ tin đáng tin, mà gate G4 (đọc tin có kỹ năng) đang ĐỎ: tín hiệu tin tức
   * đo ra không mang lợi thế. Cam kết theo một tín hiệu vô nghĩa thì bằng cam
   * kết bừa, và cam kết bừa thì thua cam kết tối đa. ⇒ Cơ chế đi vốn KHÔNG sửa
   * được một mình chừng nào G4 còn đỏ; thứ tự đúng là G4 trước, đi vốn sau.
   *
   * `daDangHoaTranTaiSan` thì BẬT — chỉ đạo founder cùng ngày, độc lập, và
   * không đụng thứ hạng theo cách trên.
   */
  'balance-v8-donbay': {
    nav: false, cuocTat: false, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: false, lichChinhSach: false, quanTinh: false, sucCang: false, nenNav: false, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v9 — MA TRẬN TƯƠNG QUAN TÀI SẢN (D39, founder duyệt 27/07).
   *
   * `donBayCamKet` VẪN TẮT ở đây, có chủ ý: nó đo ra vi phạm ràng buộc "đừng cho
   * kiểu vô não all-in" và đang chờ founder. Bump phiên bản KHÔNG phải là dịp lén
   * bật những thứ đang bị giữ ở cổng — mỗi cần gạt bật vì lý do của chính nó.
   */
  'balance-v9-tuongquan': {
    nav: false, cuocTat: false, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: false, quanTinh: false, sucCang: false, nenNav: false, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v10a — TẮT MÁY CƯỢC (28/07). Xem docstring `cuocTat` cho lý do khẩn.
   *
   * ⚠ `botTuQuyetCamKet` GIỮ TRUE — bản đầu hạ false và đó là sai: cờ này còn
   * là nguồn ý định CẮT LỖ của bot. Tắt nó là bot không bao giờ thoát hàng được
   * nữa, trong khi máy cược tắt đã tự vô hiệu phần TỐ của bot rồi (mọi nước trừ
   * 'bo' bị ép về 'theo' trong choiVongCuoc). Giữ true = bot mất tố, giữ cắt lỗ.
   * Các cờ khác giữ nguyên v9 — bump version không phải dịp lén bật/tắt thứ khác.
   */
  'balance-v10a-tatcuoc': {
    nav: false, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: false, quanTinh: false, sucCang: false, nenNav: false, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v10b — NAV (28/07, thi hành D40 + spec 01). ⚠ CHƯA là version mặc định:
   * `HOLDEM_BALANCE_VERSION` chỉ trỏ sang đây khi API + bot + UI nối xong —
   * bật engine trước khi có đường bấm là phát hành một trận không ai chơi được.
   */
  'balance-v10b-nav': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: false, quanTinh: false, sucCang: false, nenNav: false, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v11 — Ô LỊCH CHÍNH SÁCH (D43 bước 2, 01/08). ⚠ CHƯA là version mặc định:
   * gate 7.6 (đọc được) đã xanh trong test, nhưng lịch ĐỔI PHÂN PHỐI sự kiện
   * (lãi suất dồn về ô lịch, ngoài lịch hạ ×0,2) nên trước khi
   * `HOLDEM_BALANCE_VERSION` trỏ sang đây phải chạy lại envelope trên v11:
   * bust 20–50% + G1–G4 (scripts/holdem_montecarlo.ts) — đúng cái giá gate
   * 7.10 đã khai. `donBayCamKet` vẫn tắt — bump version không phải dịp lén bật.
   */
  'balance-v11-lich': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: false, sucCang: false, nenNav: false, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v12 — QUÁN TÍNH TỪNG HÀNG (D43 bước 3, 01/08 — founder: "cho thắng thua rõ
   * ràng hơn, thắng đậm thua đau nhưng bám sát logic ngoài đời"). Chuỗi xu
   * hướng có trí nhớ: xem QUAN_TINH. Kế thừa v11 (lịch chính sách) — flip mặc
   * định chỉ sau khi đo 7.5 + 7.6 + envelope trên CHÍNH v12.
   */
  'balance-v12-quantinh': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: false, nenNav: false, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v13 — SỨC CĂNG (D43 bước 4, 01/08). Thuốc cho phát hiện của thí nghiệm
   * Kelly: v12 chưa trừng phạt phương sai ⇒ "ôm tất, phơi nhiễm tối đa" thống
   * trị. Sức căng làm cú sập TỈ LỆ với độ căng đã dồn ("EV phẳng, phương sai
   * nổ") + crowding của bàn (phản thân C4) + đường cháy chạm được.
   */
  'balance-v13-succang': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true, nenNav: false, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v14 — NỀN = PHÍ QUẢN LÝ TRỪ TRÊN NAV (founder chốt B, 01/08 — audit đường
   * tiền: nền cũ chỉ trừ tiền mặt nên all-in là né nộp quỹ hợp lệ, 678/600-trận
   * vòng quỹ = 0). Tiền mặt trước, thiếu trừ pro-rata vị thế (không trượt giá —
   * phí, không phải lệnh bán). Không ai né được, quỹ vòng sống cả trận.
   */
  'balance-v14-nennav': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true, nenNav: true, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v15 — CHU KỲ CÓ TÍNH CÁCH + LÃI SUẤT KHẨN LÀ ĐIỀM BÁO (D43 bước 6 + §4.3).
   * Hai cờ RIÊNG để đo tách bạch; v15 bật cả hai. Trận ≤ v14 replay nguyên.
   */
  'balance-v15-chuky': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v16 — 5 MẶT ĐUÔI thay thẻ Thiên nga đen (D43 bước 7, founder 01/08: "bỏ
   * thẻ thiên nga đen, vẽ thành 5 thẻ khác nhau"). Ngân sách P_TAIL bảo toàn
   * (DUOI_5MAT tổng = trọng số nền cũ); thiên nga chỉ còn là ICON TRẠNG THÁI
   * trong Bảng điện tử. Trận ≤ v15 vẫn rút thiên nga như cũ.
   */
  'balance-v16-duoi5': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v17 — LỆNH BÁN KHỐNG trong shop (doc 05, founder 01/08). Kế thừa v15
   * (v16 đuôi-5-mặt vẫn sau cổng riêng — hai nhánh độc lập, hợp nhất khi
   * v16 qua gate). Trận ≤ v15 replay nguyên.
   */
  'balance-v17-khong': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v18 — HỆ QUẢ CHƯA LẬT THÔI CẮN GIÁ (founder 01/08, xem docstring
   * `boNhanhHeQua`). Kế thừa v17 (lệnh khống); v16 đuôi-5-mặt vẫn sau cổng
   * riêng chờ đo lại. `donBayCamKet` vẫn tắt — bump không phải dịp lén bật.
   */
  'balance-v18-hequa': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v19 — XUNG ĐỘT GỌN (founder 02/08: cảnh báo khắc chế thừa cho các lá đã
   * đổi chức năng). Kế thừa v18; xem docstring `XUNG_DOT_V19`.
   */
  'balance-v19-xungdot': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v20 — CỘNG HƯỞNG GỌN (founder 02/08 "Gỡ"). Kế thừa v19; xem docstring
   * `CONG_HUONG_V20` — kể cả vì sao phải cổng riêng thay vì dùng lại cờ v19.
   */
  'balance-v20-conghuong': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v21 — CÂN TRÔI KỲ VỌNG (founder 02/08 bác trần biên độ: "may mắn liên tục
   * với xác suất cực nhỏ thì vẫn phải được lãi khủng lồ"). Xem `CAN_TROI_BP`.
   */
  'balance-v21-cantroi': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v22 — BOT ĐỌC BỐI CẢNH ĐỂ MUA (D56). Trước bản này `lenhBotNav` chọn mã
   * bằng phép chia lấy dư theo vòng: KHÔNG bot nào giao dịch theo thông tin,
   * nên gate G2/G3/G4 đo một trò không tồn tại (chi tiết D55).
   */
  'balance-v22-botdoctin': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v23 — VÒNG CÂN TRÔI THỨ HAI (D58). Xem `CAN_TROI_BP_V23`. Cổng RIÊNG chứ
   * không sửa thẳng bảng cũ: trận lưu ở v21/v22 đã tính tiền theo bảng cũ,
   * đổi bảng tại chỗ là viết lại kết quả của chúng.
   */
  'balance-v23-cantroi2': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v25 — PHÁ HOÀ CÔNG BẰNG. Khác v23 ĐÚNG MỘT CỜ.
   *
   * ⚠ Đây là VÁ MỘT LỖI ĐANG CẮN NGƯỜI CHƠI THẬT, không phải một cần gạt cân
   * bằng: ghế người tên `'ban'` nên nó thắng mọi cú hoà `pnl_bp` chỉ vì bảng chữ
   * cái. Giữ nguyên mọi số khác để hiệu ứng của riêng bản vá này đo được — trộn
   * nó với một thay đổi cân bằng là mất cả hai phép đo (bài học D51/D54).
   */
  /*
   * v26 — LÃI SUẤT NỀN CÔNG KHAI (founder 04/08). Xem `LAI_SUAT_NEN`.
   *
   * Thêm một BIẾN TRẠNG THÁI mà máy chưa từng có: một mức lãi suất tích luỹ,
   * công khai, dịch ở kỳ họp theo đúng hàm phản ứng đã có, rồi tác động ngược
   * vào xác suất thẻ sự kiện và vào nấc thanh khoản của MỌI mã.
   *
   * ⚠⚠ ĐÂY LÀ CỔNG BẮT BUỘC, KHÔNG PHẢI THỦ TỤC: nó đổi `sinhMap`, nên trận đã
   * lưu mà đọc bằng bộ luật này sẽ replay ra MỘT MAP KHÁC. Cổng chính là thứ
   * giữ 137+ trận cũ nguyên vẹn.
   *
   * ⭐ Số trong `LAI_SUAT_NEN` là số agent đặt, CHỜ ĐO (A8.2) — tiền lệ
   * `QUAN_TINH` của D43. Ai bật làm mặc định phải chạy lại G1–G4 + envelope
   * trước, và ghi số vào nhật ký.
   */
  /*
   * v28 — TIN CÓ GỐC, TIN GIẢ CÓ HẬU QUẢ (founder 08/08). Xem `MAP_V28`.
   *
   * Bao trọn v27 + bốn cơ chế mới, khép kín vòng nhân quả founder vẽ: tiền rẻ
   * → bong bóng THẬT leo được · không tiền rẻ → bong bóng giả/gãy sớm · tin
   * giả lộ → Sập sàn · sập xong → phục hồi là cầu về uptrend.
   * ⚠ Đổi `sinhMap` ⇒ cổng bắt buộc — trận ≤ v27 replay ra đúng map cũ.
   */
  /*
   * v29 — PHÍ VỘI VÀNG (04 §4.6–4.7). Khác v28 ĐÚNG MỘT CỜ — một cờ một phép
   * đo (bài học D51/D54). Xem `NAV_V10.VOI_VANG` cho lý do + công thức.
   */
  /*
   * v30 — SỬA THƯỚC ĐO. Khác v29 ĐÚNG MỘT CỜ (`botDungThuocThat`) — một cờ
   * một phép đo (bài học D51/D54). Xem `HOLDEM_BALANCE_VERSION`.
   */
  /*
   * v31 — QUỸ VÒNG CO GIÃN. Khác v30 ĐÚNG MỘT CỜ (bài học D51/D54).
   */
  /*
   * v32 — BẢN SẮC CỠ MAP (D85/D86 §2, doc 06). Kịch bản hồi cho map 12/16;
   * map 8 byte-hệt (mẫu đối chứng §4). Xem `BAN_SAC_MAP` + `banSacBp`.
   *
   * ✅ MẶC ĐỊNH TỪ 16/08 — founder lật sau khi xem số G1–G4 ba cỡ map (D87/
   * D88b; nếp D71/D72: xây ở cổng, đo, rồi lật). Xem chú thích ở
   * `HOLDEM_BALANCE_VERSION`.
   */
  /**
   * v35 — CHUỖI MỞ RỘNG (D157, Ở CỔNG — chưa là mặc định): cạnh nhân quả mới +
   * cạnh nghe môi trường tiền tệ (`MT_KE_TIEP_MO_RONG` · `KE_TIEP_THEO_MOI_TRUONG`),
   * và ĐỀ XUẤT bật lại `duoi5` — không bật thì hai trong bốn cạnh mới là cơ chế
   * trang trí (trọng số đuôi bị khoá 0) và SIẾT PHÁP LÝ tiếp tục ngủ (D147-Q2).
   * ⏳ Founder lật `HOLDEM_BALANCE_VERSION` sau khi xem MC 12.000×3 cỡ map
   * (nếp D71/D72). Mọi số MC-TUNE (A8.2).
   */
  /**
   * v36 — MÁY REGIME (D165, Ở CỔNG — chưa là mặc định): R1 của kế hoạch đập
   * thẻ pha. Khác v35 đúng MỘT cờ `regimeTick`. ⏳ Founder lật sau khi R1–R5
   * xong + MC 12.000×3 (nếp D71/D72). Mọi số MC-TUNE (A8.2).
   */
  /**
   * v37 — ÁP LỰC BÀN (D181; MẶC ĐỊNH từ 07/09 trong cụm v40 — D303): khác v36 đúng MỘT cờ.
   * ✔ Founder lật 07/09 (D303, *"Lật tất"*) cùng v38 + v39 + v40; gate 12.000×3 đo trên v40.
   */
  /**
   * v44 — TƯƠNG QUAN TÀI SẢN v2 (D315, Ở CỔNG): khác v43 đúng MỘT cờ `betaTaiSanV2`.
   *
   * D311 suy lại ĐỘ LỚN ba hàng nhưng để nguyên TƯƠNG QUAN, nên hai chỗ nói ngược nhau:
   * sổ nguồn viết "CP Chứng khoán lên xuống mạnh hơn cả thị trường nó phục vụ" trong khi
   * β và `bien_dong_bp` của nó vẫn là của CP Công nghệ; và USDT ăn đòn đúng ở ba mặt tin
   * crypto nhưng phần RỦI RO RIÊNG vẫn y như đô la — mà chính phần riêng ấy mới là cái
   * làm một cú MẤT NEO khác một cú chợ chung đi xuống.
   *
   * Cờ này cũng NỚI MÔ HÌNH chứ không chỉ vặn số: `BETA_NEN` cũ chỉ có hai số theo NHÓM,
   * nên "mã này bám chỉ số chặt hơn mã kia ở vòng thường" là điều bộ máy trước KHÔNG diễn
   * đạt được. `BETA_V44.NEN_RIENG` mở đúng chỗ đó.
   *
   * ⏳ Founder chốt lật sau khi xem G1–G5 ba cỡ map.
   */
  'balance-v44-tuongquan': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v45 — ĐƯỜNG CONG LỢI SUẤT + BIÊN NHIỄU RÀ LẠI (D318). Hai cờ, hai việc khác nhau
   * nhưng ĐI CHUNG một cổng vì cùng trả lời một câu: *bộ số có đang nói đúng câu chuyện
   * của từng lá không.*
   *
   * · `duongCong` — coupon Trái phiếu Mỹ suy từ LỢI SUẤT DÀI, không phải lãi chính sách.
   *   Chỗ ép thực tế mà D315 và đặc tả 08 mục 1 đã tự khai, nay vá.
   * · `bienDongV45` — bốn mã còn lại được rà biên nhiễu theo biến động thật, nối tiếp
   *   lượt v44 chỉ chạm `cp_cn`. Trước đó vàng ồn hơn VN30 — tức "phân tán sang phòng
   *   thủ" gần như không giảm phương sai, và bộ số đang bác chính lời khuyên của trò.
   *
   * ⚠ Cùng cổng nhưng KHÔNG buộc phải cùng bật về sau: hai cờ độc lập về cài đặt. Đi
   * chung là quyết định ĐO — gate chạy trên tổ hợp, nên tách chúng ra sau này phải đo lại.
   */
  /**
   * v47 — KHẨU VỊ RỦI RO NHÂN ĐÚNG BIÊN ĐỘ (D339): khác v46 ĐÚNG MỘT cờ.
   *
   * `khauViTheoMa` — sửa lỗi ĐƠN VỊ cuối cùng của họ "mắt xích rơi nhầm tầng" (họ này đã
   * ăn của repo hai lượt: `nhan` ở v46, `khau_vi` ở đây). Xem docstring cờ cho số đo.
   *
   * ⚠ KHÔNG đụng `KHAU_VI.he_so_bp` (7500 / 13500) — hai số ấy là tham số kinh tế, founder
   * chỉnh (A8.2). Việc của v47 là làm cho chúng có nghĩa ĐÚNG như đã viết, rồi đo lại.
   * ⚠ Gate G1–G5 KHÔNG chạm cờ này: `holdem_montecarlo` không đặt `khau_vi` cho ghế nào nên
   * mọi bot chạy `can_bang` (he_so_bp 10000 ⇒ bước 6 không sinh mắt xích). Số gate v47 vì thế
   * TRÙNG v46 tới từng chữ số, và trùng ở đây là ĐÚNG — phép đo cho cờ này là bộ ba song sinh
   * (`kv_bo_ba`, ghi ở D339), không phải gate.
   */
  /**
   * v49 — LÕI BÁN KHỐNG (D342, founder chốt 16/09 sau trận 20:52): khác v48 BỐN cờ, một cổng.
   *
   * `khongTheoGia` — sổ khống ăn ngược đúng giá chợ (lỗi có từ v17: khống mã không cầm dài = 0bp).
   * `khongTheoHanMuc` — chip KHỐNG tính trên hạn mức còn lại, không bao giờ tự vượt trần.
   * `banKhongThuanQuyen` — lá Bán Khống hết cộng/trừ cả danh mục theo tin (đếm hai lần).
   * `xepHangTheoMa` — xếp hàng khớp lệnh vào đúng mã vừa vào (ca thứ tư họ lỗi đơn vị).
   *
   * ⚠ GATE ĐO ĐƯỢC GÌ (bài học v47/v48 — hỏi trước khi đọc số):
   * (1) `khongTheoGia` · `khongTheoHanMuc`: KHÔNG. Không bot nào khống (`lenhBotNav` không sinh
   *     chiều `khong`), nên hai cờ này không chạm một ghế nào của bàn đo. Phép đo thật: bộ test
   *     `ban_khong_v49` (đúng từng chip theo lợi suất công khai) + cặp song sinh khống/không
   *     khống ghi ở D342.
   * (2) `banKhongThuanQuyen`: CÓ — bot "Khắc chế" ưu tiên lá Bán Khống và bot chấm điểm lá theo
   *     hàng T1 (`bots.ts`, qua `BoiCanh.banKhongThuanQuyen`) ⇒ số gate PHẢI đổi.
   * (3) `xepHangTheoMa`: CÓ nhưng ít — chỉ ghế vào mã mới cùng ≥ 2 người mà đang cầm mã khác.
   */
  /**
   * v50 — PHÍ MUA BÁN NHẸ (D345): khác v49 ĐÚNG MỘT cờ `phiLenhNhe`.
   * ⚠ GATE ĐO ĐƯỢC CỜ NÀY: mọi bot đi vốn qua `apLenhVongNav` ⇒ phí đổi cho cả bàn ⇒ số gate PHẢI đổi
   * ở cả ba cỡ map (trùng số = bot chưa nhận cờ). Quỹ vòng nhỏ đi (phí đổ vào quỹ) nên G3 (ngồi im) và
   * G5a (gửi hết) là chỗ phải soi — rẻ đi đảo danh mục có thể làm lướt liên tục thành trội.
   */
  'balance-v50-phinhe': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },

  /**
   * v51 (D346) — PHÍ MUA BÁN HAI BẬC, phanh lối "dồn hết vốn mỗi vòng" (founder 17/09: *"Hãm lối chơi
   * đó đi, trade off rõ"*). Khác v50 đúng một cờ: `phiLenhBac`.
   *
   * ⚠ GATE ĐO ĐƯỢC CỜ NÀY: mọi bot đi vốn qua `apLenhVongNav` ⇒ bảng phí đổi cho cả bàn ⇒ số G1 PHẢI
   * đổi ở cả ba cỡ map (trùng số v50 = bot chưa nhận cờ). Đo 12.000 trận: bàn 8 Tất tay 32,4% vs 27,0
   * (v50: 30,3/28,3) · bàn 12 Khắc chế 32,9 vs 29,2 · bàn 16 Khắc chế 38,2 vs 33,0 — G1–G5 ✓ cả ba.
   * Bảng tám phanh đã thử và bị bác nằm ở `PHI_LENH_V51` (config/holdem.ts) và D346.
   */
  'balance-v51-phibac': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
    /**
   * v52 (D371) — ĐA DẠNG HOÁ: hoà vốn dời từ 2,69 mã xuống ~1 mã. Khác v51 đúng MỘT cờ.
   *
   * Founder 21/09, sau khi chơi vai TỔ CHỨC: *"lõi đa dạng hóa mỗi round trừ tiền trong khi
   * t đã giữ vị thế rồi"*. Chốt HƯỚNG = giữ cấu trúc `phí + n × mỗi_mã`, kéo hoà vốn về ~1 mã
   * (A8.2 — founder chốt hướng, gate chọn số). Bộ số ở `DA_DANG_HOA_V52` (config/holdem.ts).
   *
   * ⚠ GATE ĐO ĐƯỢC CỜ NÀY KHÔNG? CÓ, nhưng CHỈ Ở MAP ≥ 12 — đó là ngưỡng
   * `holdem_montecarlo.ts` bắt đầu bốc thăm vai (`vaiCoRang && CO_MAP >= 12`), mà vai TỔ CHỨC
   * mới là ghế nếm vùng âm. Map 8 không vai ⇒ chỉ bot `da_dang` chạm, và bot đó sống ở vùng
   * dương nên số gần như KHÔNG đổi (đo 400 trận: 5,36 → 5,10). **Trùng số ở map 8 là ĐÚNG,
   * trùng số ở map 12/16 mới là hỏng.** Hàng phải soi là `VAI (v34) · to_chuc`, không phải
   * hàng bot.
   */
  'balance-v52-dadang': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v53 (D373) — ÚP Ô ĐANG CHƠI. Khác v52 đúng MỘT cờ: `oUp`.
   *
   * Founder 21/09, sau khi chơi prod: *"lối chơi đáng lẽ ra phải là đặt cược vào round này vào
   * thẻ bài round sau, round sau biết kết quả cược của mình là đúng hay sai"*. Toàn văn lý lẽ +
   * số đo lỗ hổng ở `docs/nhat-ky/D373.md`; hình dạng cờ ở docstring `BoLuatCanBang.oUp`.
   *
   * ⚠ GATE ĐO ĐƯỢC CỜ NÀY KHÔNG? CÓ, và đây là cờ mà gate BẮT BUỘC phải đổi số: mọi bot đọc bối
   * cảnh đi qua `lenhTheoBoiCanh`, mà cờ này thay ĐẦU VÀO của nó (ô đang lật → ô kỳ vọng) cho
   * MỌI ghế, MỌI cỡ bàn. **Trùng số G1 với v52 ở bất kỳ cỡ bàn nào = bot chưa nhận cờ** — đúng
   * bẫy đã cắn ở v47/v48 (bàn đo đi qua `nhip_lenh_bot.ts`, không qua `holdem_api.ts`).
   * G4 đổi NGHĨA chứ không mất: "đọc tin" nay là "tin telegraph tới đâu" — `tin_moi_tin` nhận
   * trọn lời báo, `phot_moi_tin` bỏ hẳn, hoài nghi chiết khấu đúng (1−p). Ba con vẫn tách nhau.
   *
   * ⭐ HÌNH DẠNG CUỐI (22/09): CHỈ ÚP Ô PHA, Ô TIN VẪN NGỬA — xem `oVongUp` (engine) cho phép đo
   * và lý lẽ. Bản đầu úp tất cả: G2/G3/G4 đỏ cả ba, đỉnh bảng đổi từ bot giao dịch sang bot gửi
   * tiết kiệm, và chín cú quét tham số không dịch nổi. Úp đúng ô pha thì gate đổi hẳn:
   *
   *   bàn  8 · 2.000 : G1 ✓ · G2 ✓ (oracle 2,23) · G3 ✓ (ngồi im 3,79) · G4 ✓ · G5 ✓
   *   bàn 12 · 2.000 : G1 ✓ · G2 ✓ (oracle 2,51) · G3 ✓ (ngồi im 3,64) · G4 ✓ · G5 ✓
   *   bàn 16 · 4.000 : G1 ✗ · G2 ✓ · G3 ✓ · G4 ✓ · G5 ✓
   *
   * ⛔ CHƯA PHẢI MẶC ĐỊNH — CÒN ĐÚNG MỘT HÀNG ĐỎ: bàn 16, G1 (Khắc chế 35,6% vs á quân 27,1%,
   * cách **8,4** trong khi ngưỡng là 8,0). Ở N = 4.000 nên không phải phương sai.
   * ⚠ Đọc cho đúng: v53 KHÔNG làm Khắc chế mạnh lên — nó HẠ Khắc chế từ 42,7% (v52) xuống 35,6%,
   * nhưng hạ á quân nhiều hơn (36,0 → 27,1). Tức nó NÉN cả nhóm trên bàn dài nhất, và G1 đo bằng
   * KHOẢNG CÁCH TUYỆT ĐỐI nên bắt đúng cú nén ấy. Việc phải làm không phải "nới ngưỡng" (đổi
   * thước vì thước không vừa ý là đúng thứ D55 cấm) mà là hiểu vì sao bàn 16 nén.
   */
  'balance-v53-upo': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v54 (D389, founder 23/09) — CHU KỲ CÓ NGÃ RẼ + LƯỢC BỎ. Kế thừa `balance-v53-upo` (mặc định
   * đang chạy), đổi đúng các cờ sau — không lén bật/tắt thứ khác:
   *   · `banhXe`       true  — bánh xe mùa có ngã rẽ (`config/banh_xe_mua.ts`)
   *   · `duoiTelegraph` false — bỏ ĐIỀM BÁO đuôi: lãi suất ngoài lịch thôi ép lá đuôi 2–4 ô sau
   *                      (năm mặt đuôi gộp về MỘT lá thiên nga đen ở tầng hình — icon góc lá)
   *   · `phanThan` · `beChuoiVon` · `apLucBan` false — cụm ĐÁM ĐÔNG ĐỔI ĐƯỢC LÁ: bản đồ chỉ
   *                      do seed quyết, bot không bẻ được chu kỳ đang kể
   *   · `kyNgo` false · `khauViTat` · `vonDeu` · `chiBan16` · `loiGon` true
   *   · `thanhKhoanNamNac` true (D395) — thanh khoản năm nấc co giãn theo lá vừa lật
   *   · `muaDinhHan` + `tinTheoMua` true (D397) — chu kỳ có tuổi: mùa rút sẵn độ dài, tin nội sinh rơi đúng mùa
   * QUỸ VÒNG GIỮ (founder 23/09 tối, sau gate thử): bỏ nó thì "gửi hết vào ngân hàng" thắng 40,9%
   * (G1 đỏ); giữ thì 31,3%. Founder: *"Giữ quỹ vòng nhưng làm nó không còn khó hiểu"* — việc của màn.
   * Cờ còn nguyên mà vô tác dụng dưới khoá này (giữ để khỏi lén đổi): `khauViTheoMa` (mọi ghế khẩu
   * vị mặc định), `daDangV52`/`doiTacTruMotLan` (lá đã rời shop).
   * ✔ MẶC ĐỊNH TỪ 25/09 (D406, founder duyệt *"A, deploy luôn đi"*) — kèm BẬT trần hạng 1 (D403) + ba cờ sổ chịu nền
   * kinh tế (D405); nút BỎ GIỮ (gỡ nó làm "gửi hết" thắng 38,9% bàn 8 kể cả khi ngân hàng đã sửa). Bàn tập vẫn ghim
   * v53 (`khoaBanTap`) cho tới khi có kịch bản bàn 16 viết cho bánh xe; đề buổi đo ghim khoá riêng.
   * D403 (25/09) — ba cờ quỹ vòng (`boBaiTat` · `quyTheoCoBan` · `quyTranHang1`) CÓ trong khoá này nhưng TẮT: gate
   * 12.000 trận map 16 cho gỡ BỎ ⇒ "gửi hết" thắng 52,9% (bàn 8) · 64,9% (5) · 68,7% (4) — G1 đỏ nặng. Chỉ riêng trần
   * hạng 1 là vô hại (bàn 8: 26,4%, G1 xanh). Bật cờ nào = founder chốt (A8.2); bảng số ở `docs/nhat-ky/D403.md`.
   * D405 (25/09) — ba cờ sổ chịu nền kinh tế (`tietKiemLamPhat` · `tietKiemThaNoi` · `nganHangDoVo`) CÓ trong khoá này nhưng
   * TẮT: bật cả ba + trần hạng 1 (giữ BỎ) ⇒ "gửi hết" 13,7% bàn 8 · 25,0% bàn 5 · 31,8% bàn 4 (nay 24,7 · 34,5 · 39,0), G1
   * xanh cả ba. Gỡ BỎ vẫn hỏng kể cả khi ngân hàng đã sửa (38,9% bàn 8). Bảng số: `docs/nhat-ky/D405.md`.
   */
  'balance-v54-ngare': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: true, chiBan16: true, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: true, tietKiemThaNoi: true, nganHangDoVo: true, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v55 (D409, founder 25/09) — LỬA · XU · TRAIT · LƯỚT SÓNG MỚI. Kế thừa `balance-v54-ngare` (mặc định 0.0.45),
   * đổi đúng CHÍN cờ: `lua` · `luaPhi` · `luaQuyetToan` · `luaMuaDuoi` · `nhiemVuLoi` · `trait` · `traitVai` ·
   * `chanLoTrait` · `luotSongMoi`. Không lén bật/tắt thứ khác (bài canh `tests/trait.test.ts` §I).
   * ⛔ CHƯA PHẢI MẶC ĐỊNH — lật cần: gate G1–G5 + G7 (xu) + G8 (song sinh từng trait) bàn 16 · bàn tập 16 dạy lửa/trait
   * · Bách khoa/Hướng dẫn · golden ghim v54 · founder duyệt số (A8.2).
   */
  'balance-v55-build': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: true, chiBan16: true, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: true, tietKiemThaNoi: true, nganHangDoVo: true, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: true, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: true, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: false,
  },
  /**
   * v56 (D447, founder 28/09) — PHÍ CỘNG DỒN CẢ VÒNG. Kế thừa `balance-v55-build` (mặc định 0.0.47–0.0.50), đổi ĐÚNG MỘT
   * cờ: `phiCongDonVong`. Đi cùng bản bỏ nút KHỚP NGAY ở màn (founder: *"khớp ngay giờ có bị thừa thãi ko với cơ chế
   * mới?"* ⇒ bỏ); endpoint giữ cho trận đang chơi và cho replay. Bàn tập vẫn ghim v54.
   */
  'balance-v56-congdon': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: true, chiBan16: true, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: true, tietKiemThaNoi: true, nganHangDoVo: true, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: true, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: true, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true,
  },
  /**
   * v57 (D456, founder 03/10) — KHOÁ MINIGAME, BƯỚC 1: BỎ CƠ CHẾ. Kế thừa `balance-v56-congdon` (mặc định 0.0.52), ĐANG DỰNG:
   * chỉ tester ép được qua `ep_balance`, CHƯA là mặc định, chưa người thật nào chơi. Kế hoạch năm bước:
   * `docs/thiet-ke-de-xuat/gameplay/kien-truc-minigame.md` §7. Đổi ĐÚNG tám cờ, mỗi cờ một cơ chế bị bỏ:
   *   · sổ tiết kiệm — `tietKiem` · `tietKiemLamPhat` · `tietKiemThaNoi` · `nganHangDoVo` (Đòn Bẩy NẠP THÊM thay chỗ, bước 4);
   *   · Lướt Sóng chốt lời trong ô — `luotSongMoi` (minigame Lướt Sóng thay);
   *   · lửa riêng của Mua Đuổi — `luaMuaDuoi` (minigame Mua Đuổi thay);
   *   · MỚI `khongBangDienTu` — Bảng điện tử thôi bán (Lướt Sóng: MUA TIN SỚM trong minigame);
   *   · MỚI `theLuonThat` — thẻ sự kiện trên map luôn THẬT (tin giả dời vào minigame).
   * BƯỚC 2 (D457) — KHUNG TRẬN, thêm năm cờ: `chiBan12` (bàn 12 ô = 11 vòng, cờ MỚI) · `chiBan16` true → false · `vonDeu` true → false
   * (vai có vốn khác nhau: cá nhân ×1 · đội lái ×3 · cá mập ×3 · tổ chức ×2 — code vai v34–v53 còn sống, chỉ bật lại) ·
   * `dongHoMinigame` (đặt lệnh 15 s, đọc kết quả 5 s; MỚI) · `khoTraitHep` (chợ trait chỉ chào mười trait không phụ thuộc minigame; MỚI).
   * KHÔNG đổi: lửa · xu · trait (founder 03/10: *"giữ lửa và xu"* — mọi cờ `lua*` `trait*` `gopXu` y v56); bánh xe mùa
   * (`muaDinhHan` KHÔNG phải sổ tiết kiệm — tên dễ nhầm, kế hoạch bản đầu từng liệt nhầm); luật bị động của năm lõi (mắt xích
   * lõi trong quyết toán · Đòn Bẩy cấp 2 · xung đột lá) GIỮ cho tới khi từng minigame ra đời — tắt trước là trận không còn lõi
   * nào làm gì, và nó đan trong chuỗi tính điểm vòng (`dungChuoi`).
   * ⛔ KHÔNG phải mặc định. Lật cần cả năm bước + founder duyệt số (A8.2).
   */
  'balance-v57-minigame': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: true, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true,
  },
  /**
   * v58 (D526, founder 05/10) — NHỊP XEN KẼ trên nền v57: khác v57 ĐÚNG hai cờ — `chiBan12` true → false (bàn 8 ô, `CO_BAN_XEN_KE`) và
   * MỚI `nhipXenKe` (sau mỗi lần chốt: màn minigame HOẶC chợ trait theo `NHIP_XEN_KE`; vòng 1 có màn; chợ 45 s; vai ở bàn 8).
   * Founder chốt demo nhịp trận 05/10 (*"Chốt. Deploy lên web đi"*). Mặc định từ D525 tới D528 (D528 thay bằng v59).
   */
  'balance-v58-xenke': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true,
  },
  /**
   * v59 (D528, founder 05/10) — KÊ LỆNH trên nền v58: khác v58 ĐÚNG một cờ MỚI `keLenhV59` (trait kê mua / kê bán · tâm lý yếu · trần thua Tổ Chức
   * áp khoản giữ · giấu vai + soi vai). ✅ MẶC ĐỊNH từ D528 — xem `HOLDEM_BALANCE_VERSION`.
   */
  'balance-v59-kelenh': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true,
  },
  /**
   * v60 (D530, founder 06/10) — LÕI CHỈ TÁC ĐỘNG TRONG MÀN trên nền v59: khác v59 ĐÚNG một cờ MỚI `loiChiTrongMan`. Founder chọn *"Chỉ tác động
   * trong màn"* sau khi thấy engine vẫn chạy lõi kiểu cũ ở MỌI vòng chồng lên màn (Đòn Bẩy VÀO ×2 thành ×3; vòng không màn ×2 im lặng; Bắt Đáy /
   * Mua Đuổi ±14–18 % cả danh mục). ✅ MẶC ĐỊNH từ D530 — xem `HOLDEM_BALANCE_VERSION`.
   */
  'balance-v60-loiman': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true,
  },
  /**
   * v61 (D536, founder 06/10 *"Làm đủ như demo"*) — LỆNH LỚN trong màn trên nền v60: khác v60 ĐÚNG một cờ MỚI `lenhLonV61` (bot Cá Mập / Đội Lái cùng
   * mã đẩy giá trên màn · cột khối lượng · nhãn LỆNH LỚN). ✅ MẶC ĐỊNH từ D536 — xem `HOLDEM_BALANCE_VERSION`.
   */
  'balance-v61-lenhlon': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true,
  },
  /**
   * v65 (D561) — THANG KỸ NĂNG trên nền v64: khác v64 ĐÚNG tám cờ (`banKhongX2` · `loiChonTruoc` · `banBotBdMd` · `xepHangE` · `vaoGia` · `nhieuMa` ·
   * `khoanTheoDuong` · `upLaPha`). ✅ MẶC ĐỊNH từ D561 (08/10, SPEC `docs/spec/thang-ky-nang-man.md`) — xem `HOLDEM_BALANCE_VERSION`.
   */
  'balance-v65-thangkynang': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true, kyHopBanTap: true, ban14: true, chuKyCoNgoi: true, banKhongX2: true, loiChonTruoc: true, banBotBdMd: true, xepHangE: true, vaoGia: true, nhieuMa: true, khoanTheoDuong: true, upLaPha: true,
  },
  /**
   * v66 (D566) — LÃI ÁP THEO LÁ QUYẾT TOÁN trên nền v65: khác v65 ĐÚNG một cờ MỚI `laiApLaQuyetToan`. Kỳ họp lật ở cuối vòng N đổi coupon · lãi
   * tiết kiệm thả nổi · lãi vay đòn bẩy · độ sâu thanh khoản NGAY vòng N (ý định v53/D373), thay vì từ vòng N+1 như v53–v65 (lỗi D382 bỏ sót,
   * `tests/o_up_v53_lai_ap.test.ts`). ✅ MẶC ĐỊNH từ D566 (founder 10/10) — xem `HOLDEM_BALANCE_VERSION`.
   */
  'balance-v66-laiap': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true, kyHopBanTap: true, ban14: true, chuKyCoNgoi: true, banKhongX2: true, loiChonTruoc: true, banBotBdMd: true, xepHangE: true, vaoGia: true, nhieuMa: true, khoanTheoDuong: true, upLaPha: true, laiApLaQuyetToan: true,
  },  /**
   * v67 (D574) — BỐI CẢNH DÀI HẠN trên nền v66: khác v66 ĐÚNG một cờ MỚI `boiCanhDaiHan` (sóng công nghệ × pha nợ · đổ đèo · tin vĩ mô trong màn).
   * Mặc định D574 → D584 (v68 thay, chưa lên prod). Số PLAYTEST-TUNE ở `config/boi_canh_dai_han.ts`. Bàn tập giữ v62.
   */
  'balance-v67-boicanh': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true, kyHopBanTap: true, ban14: true, chuKyCoNgoi: true, banKhongX2: true, loiChonTruoc: true, banBotBdMd: true, xepHangE: true, vaoGia: true, nhieuMa: true, khoanTheoDuong: true, upLaPha: true, laiApLaQuyetToan: true, boiCanhDaiHan: true,
  },  /**
   * v68 (D584) — GIẢI VÒNG TRẢ BẰNG XU TRAIT trên nền v67: khác v67 ĐÚNG một cờ MỚI `giaiXu` (founder 10/10 *"Thay bằng xu trait nhé"*).
   * Mặc định D584 → D586 (v69 thay, chưa lên prod). Số PLAYTEST-TUNE ở `GIAI_XU` (config/holdem.ts).
   */
  'balance-v68-giaixu': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true, kyHopBanTap: true, ban14: true, chuKyCoNgoi: true, banKhongX2: true, loiChonTruoc: true, banBotBdMd: true, xepHangE: true, vaoGia: true, nhieuMa: true, khoanTheoDuong: true, upLaPha: true, laiApLaQuyetToan: true, boiCanhDaiHan: true, giaiXu: true,
  },
  /**
   * v69 (D586) — BÁN BỚT BÁN HẾT ĐƯỢC trên nền v68: khác v68 ĐÚNG một cờ MỚI `banBotRai` (founder 11/10: Bắt Đáy "lỗi khi ko bán hết được" · "chỉ cần
   * cho bán bớt có khả năng bán hết" · số lần theo Rải lệnh 2 / 3 / 4). Đổi luật khớp màn ⇒ khoá mới (A11.3), không sửa v68. ✅ MẶC ĐỊNH từ D586 — xem `HOLDEM_BALANCE_VERSION`.
   */
  'balance-v69-banbot': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true, kyHopBanTap: true, ban14: true, chuKyCoNgoi: true, banKhongX2: true, loiChonTruoc: true, banBotBdMd: true, xepHangE: true, vaoGia: true, nhieuMa: true, khoanTheoDuong: true, upLaPha: true, laiApLaQuyetToan: true, boiCanhDaiHan: true, giaiXu: true, banBotRai: true,
  },
  /**
   * v70 (D589) — VÀO 3 PHẦN · ×2 · CHỐT GỘP trên nền v69: khác v69 ĐÚNG một cờ MỚI `baPhan` (founder 11/10: Mua Đuổi 3 : 2 : 1 "lệnh sau nhỏ hơn lệnh
   * trước", Bắt Đáy 1 : 2 : 3 "ngược lại"; "sau khi bấm hết 3 nút nhồi lệnh thì thay nút nhồi lệnh thành ×2"; "cho bán hết gộp vào bán nửa"). Đổi
   * luật khớp màn ⇒ khoá mới (A11.3). Bot Bắt Đáy gom 3 phần theo mức rút (`BOT_BAT_DAY_BA_PHAN`).
   */
  'balance-v70-baphan': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true, kyHopBanTap: true, ban14: true, chuKyCoNgoi: true, banKhongX2: true, loiChonTruoc: true, banBotBdMd: true, xepHangE: true, vaoGia: true, nhieuMa: true, khoanTheoDuong: true, upLaPha: true, laiApLaQuyetToan: true, boiCanhDaiHan: true, giaiXu: true, banBotRai: true, baPhan: true,
  },
  /**
   * v71 (D590, founder 11/10) — BÀN XẾP HẠNG GHÉP NGƯỜI theo MẶC ĐỊNH MỚI: v70 + đúng cờ `vaiTheoCoBan` (chia vai theo bảng 5 mốc cỡ bàn). Thay
   * `balance-v67-banxephang` (v66 + cờ) làm khoá của bàn ghép (`RANK_GHEP_KHOA_LUAT`) khi mặc định lên v70 — bàn xếp hạng chơi CÙNG luật với
   * trận thường (bối cảnh dài hạn · giải xu · bán bớt bán hết · VÀO 3 phần / ×2). v67-banxephang giữ cho replay. Vẫn sau cờ `RANK_GHEP_BAT`.
   */
  'balance-v71-banxephang': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true, kyHopBanTap: true, ban14: true, chuKyCoNgoi: true, banKhongX2: true, loiChonTruoc: true, banBotBdMd: true, xepHangE: true, vaoGia: true, nhieuMa: true, khoanTheoDuong: true, upLaPha: true, laiApLaQuyetToan: true, boiCanhDaiHan: true, giaiXu: true, banBotRai: true, baPhan: true, vaiTheoCoBan: true,
  },
  /**
   * v67 (SPEC `docs/spec/alpha-draft-tang-khong-gian.md` mục 6, founder CHỐT 11/10) — BÀN XẾP HẠNG GHÉP NGƯỜI trên nền v66: khác v66 ĐÚNG một cờ MỚI
   * `vaiTheoCoBan` (chia vai theo bảng 5 mốc cỡ bàn). KHÔNG phải mặc định — chỉ bàn xếp hạng ghép người (`rank_slot`) tạo bằng khoá này,
   * sau cờ `RANK_GHEP_BAT`. Mọi chế độ khác giữ `HOLDEM_BALANCE_VERSION` (v66).
   */
  'balance-v67-banxephang': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true, kyHopBanTap: true, ban14: true, chuKyCoNgoi: true, banKhongX2: true, loiChonTruoc: true, banBotBdMd: true, xepHangE: true, vaoGia: true, nhieuMa: true, khoanTheoDuong: true, upLaPha: true, laiApLaQuyetToan: true, vaiTheoCoBan: true,
  },
  /**
   * v64 (D560, founder 08/10) — CHU KỲ CÓ NGÒI trên nền v63: khác v63 ĐÚNG một cờ MỚI `chuKyCoNgoi`. Mặc định D560 → D561 (prod 0.0.61) (founder chọn A + C:
   * tính chất ×1,5 · phần 2 hình màn gộp một lần bật). Gate 12.000 · 5 ghế · bàn 14: G1–G4 + G7 ĐẠT. SPEC `docs/spec/chu-ky-co-ngoi.md`.
   */
  'balance-v64-congoi': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true, kyHopBanTap: true, ban14: true, chuKyCoNgoi: true,
  },
  /**
   * v63 (D550, founder 07/10) — TRẬN 14 Ô trên nền v62: khác v62 ĐÚNG một cờ MỚI `ban14` (trận thật 14 ô · 13 vòng, kỳ họp ô 4 · 9, năm chợ
   * trait — `NHIP_XEN_KE[14]`). ✅ MẶC ĐỊNH từ D550 — xem `HOLDEM_BALANCE_VERSION`. Bàn tập giữ v62.
   */
  'balance-v63-ban14': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true, kyHopBanTap: true, ban14: true,
  },
  /**
   * v62 (D545, founder 06/10) — KỲ HỌP CHO BÀN TẬP trên nền v61: khác v61 ĐÚNG một cờ MỚI `kyHopBanTap` (bàn tập 6 ô có kỳ họp ở ô 3; trận 8 ô
   * không đổi). ✅ MẶC ĐỊNH từ D545 — xem `HOLDEM_BALANCE_VERSION`.
   */
  'balance-v62-kyhoptap': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: false, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: false,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: false,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: false,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: false, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: true, phiLenhBac: true, daDangV52: true, oUp: true, botDocNen: false, banhXe: true, khauViTat: true, vonDeu: false, chiBan16: false, loiGon: true, thanhKhoanNamNac: true, muaDinhHan: true, tinTheoMua: true, luatLa: true, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: true, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: true, luaPhi: true, luaQuyetToan: true, luaMuaDuoi: false, nhiemVuLoi: true, trait: true, traitVai: true, chanLoTrait: true, luotSongMoi: false, gopXu: true, khaoSatDauMienPhi: true, luaKhongPhatDao: true, kyLuatSauDonBay: true, phiCongDonVong: true, khongBangDienTu: true, theLuonThat: true, chiBan12: false, dongHoMinigame: true, khoTraitHep: true, canSauKhung: true, traitGhimMinigame: true, toChucV57: true, vonVaiV57: true, phiSauVaiV57: true, bayCaNhanV57: true, nhipXenKe: true, keLenhV59: true, loiChiTrongMan: true, lenhLonV61: true, kyHopBanTap: true,
  },
  'balance-v49-bankhong': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: true, khongTheoHanMuc: true, banKhongThuanQuyen: true, xepHangTheoMa: true, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v48 — RỦI RO ĐỐI TÁC TRỪ ĐÚNG MỘT LẦN (D340): khác v47 ĐÚNG MỘT cờ.
   *
   * `doiTacTruMotLan` — ca cuối của họ lỗi ba ca (v46 `nhan` · v47 `khau_vi` · v48 `doi_tac`).
   * Xem docstring cờ cho số đo.
   *
   * ⚠ KHÁC v47 Ở CHỖ GATE THẬT SỰ ĐO ĐƯỢC CỜ NÀY: bot có cầm thẻ phòng thủ, nên số gate PHẢI
   * đổi so với v47. Số giống hệt v47 ở đây là dấu hiệu bot chưa nhận cờ (bẫy D313), ngược hẳn
   * với v47 nơi trùng số mới là đúng.
   * ⚠ Cờ này TRẢ LẠI sức mạnh cho phe phòng thủ (phần che 0 → một nửa) ⇒ G1 là chỗ phải soi
   * kỹ nhất: chính phe phòng thủ từng dẫn bảng và `RUI_RO_DOI_TAC` sinh ra để khắc chế nó.
   */
  'balance-v48-doitac': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: true, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v47-khauvi': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: true, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v46 — ĐÒN BẨY Ở TRẬN NAV (D338, mặc định 16/09 → v47): khác v45 hai cờ.
   *
   * `donBayTheoMa` — sửa lỗi ĐƠN VỊ: mắt xích `nhan` mang `ma`, áp vào đúng vị thế mã đó;
   * chưa gắn ⇒ mọi mã đang cầm, gắn ⇒ riêng mã gắn. Founder chốt 15/09 (gộp A và B).
   * `laiVayDonBay` — lãi vay mỗi ô trên phần tiền đang được nhân đôi, neo lãi suất nền.
   *
   * ⚠ Hai cờ CÙNG MỘT CỔNG theo chốt founder (*"3. có"* — sửa lỗi + lãi vay một lần đo). Lỗi
   * đơn vị đổi sức mạnh Đòn Bẩy ở MỌI trận NAV ⇒ gate G1–G5 phải đo lại trước khi lật.
   * ✔ Mức lãi (`LAI_VAY_DON_BAY`) founder chốt 16/09 sau khi xem số đo cặp song sinh: nền + 1%/ô.
   */
  'balance-v46-donbay': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: true, laiVayDonBay: true, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v45-duongcong': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: true, duongCong: true, bienDongV45: true, couponGiuDu: true, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v43 — NGÂN HÀNG (D314, Ở CỔNG — chưa mặc định): khác v42 hai cờ, và hai cờ ấy là MỘT
   * cú đổi luật chứ không phải hai: cơ chế "Cam kết" chết đi để chỗ của nó trên bàn thuộc
   * về HỢP ĐỒNG GỬI TIẾT KIỆM.
   *
   * `khoaTaiSanTat` — KHOÁ NẮM GIỮ thôi mở được (code giữ nguyên cho trận cũ replay).
   * `tietKiem` — khoá tiền mặt N ô lấy lãi cố định; ba mốc 2/3/4 ô, KHÔNG giới hạn số hợp
   * đồng (founder 08/09), lãi chốt lúc mở, huỷ trước hạn mất TOÀN BỘ lãi treo.
   *
   * ⚠ VÌ SAO ĐÂY LÀ CỔNG RIÊNG, không gộp vào v42: v42 đổi cách các MÃ ăn đòn theo chợ;
   * v43 thêm một chỗ để tiền ĐỨNG NGOÀI chợ. Trộn hai thứ vào một cổng thì gate không tách
   * được "bộ số mới có lành không" khỏi "ngân hàng có phá cân bằng không" — mà cái thứ hai
   * là rủi ro thật: lãi đủ cao thì "gửi hết rồi ngồi im" thành nước đi trội và bàn thôi là
   * một trò đọc chợ. Gate **G5** canh đúng chuyện đó.
   *
   * ⏳ Founder chốt lật sau khi xem G1–G5 ba cỡ map.
   */
  'balance-v43-nganhang': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: true, tietKiem: true, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v42 — TÀI SẢN v2 (D311, Ở CỔNG — chưa mặc định): khác v41 bốn cờ, và bốn cờ đó
   * PHẢI đi cùng nhau vì chúng chia nhau một phép tính.
   *
   * D310 đổi TÊN bốn lá mà không đụng số. Đây là phần số của ba lá mà cái tên mới tả
   * một VẬT KHÁC: `cp_cn` thành CP Chứng khoán (beta theo thanh khoản, không theo chỉ
   * số) · `usd` thành USDT (thêm rủi ro MẤT NEO — sập sàn/pháp lý/phá sản đổi dấu) ·
   * `tpcp` thành Trái phiếu Mỹ (thôi là tài sản VN ⇒ mọi mẫu VN `w = 0` ⇒ quay về tiên
   * nghiệm v40, KHÔNG giữ hàng v41).
   *
   * ⚠ VÌ SAO `taiSanV42` VÀ `couponTpcp` KHÔNG TÁCH ĐƯỢC THÀNH HAI CỔNG: hàng giá của
   * `tpcp` ở bảng V42 là GIÁ-THUẦN — carry +2%/ô đã rút khỏi ma trận để trả tường minh
   * bằng coupon. Bật `couponTpcp` một mình ⇒ trả lãi HAI LẦN (ma trận vẫn chở carry).
   * Bật `taiSanV42` một mình ⇒ NUỐT MẤT carry của người cầm trái phiếu. Hai cờ riêng
   * là để đọc được ý định trong bảng luật, không phải để bật lẻ.
   *
   * Nguồn + suy từng ô + chỗ tính khác điểm khởi đầu của yêu cầu 08:
   * `docs/thiet-ke-de-xuat/gameplay/tai-san-v42-nguon-va-quy-doi.md`.
   * ⏳ Founder chốt lật sau khi xem bảng ô đổi + gate G1–G4 ba cỡ map.
   */
  'balance-v42-taisan': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: true, couponTpcp: true, khongTheoMa: true, tienMatSuKien: true, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v41 — LỚP VN (D307, Ở CỔNG — chưa mặc định): khác v40 đúng MỘT cờ `lopVn` — hai ma
   * trận độ lớn đổi sang bộ hiệu chỉnh theo thị trường Việt Nam (VN-Index/VN30 · vàng SJC ·
   * USD/VND · TPCP · quyết định NHNN), gộp CO RÚT w = n/(n+4) trên tiên nghiệm v40 nên ô
   * nào VN không có mẫu thì KHÔNG đổi một bp (BTC · chiến tranh · cấm vận · thảm hoạ).
   * Ba phát hiện đổi dấu so bộ toàn cầu: TPCP KHÔNG trú ẩn được trong bear VN (bear VN đi
   * kèm siết lãi) · vàng TĂNG khi NHNN tăng lãi (bộ cũ cho giảm — logic Fed) · lạm phát
   * KHÔNG có lợi cho cổ phiếu VN (2008 · 2011 đều sập). Nguồn + bảng từng ô:
   * `docs/thiet-ke-de-xuat/gameplay/lop-vn-nguon-va-gop.md`; đổi số = đổi nguồn.
   * ⏳ Founder chốt lật sau khi xem bảng ô đổi + gate G1–G4 ba cỡ map.
   */
  'balance-v41-lopvn': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: true, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v40 — LỊCH CỐ ĐỊNH (D302; MẶC ĐỊNH từ 07/09 — D303): khác v39 đúng MỘT cờ
   * `lichKhongDoi` — ô KỲ HỌP (lịch công khai) miễn nhiễm phản thân / bẻ chuỗi.
   * Bằng chứng lỗi: bàn tập 12 ô dưới v36, ô ⚖ 9 TĂNG LÃI bị phản thân đổi thành
   * HACK SÀN (test `lich_khong_doi.test.ts`). Xếp chồng theo quy ước bảng: lật v40
   * là lật luôn v37 (áp lực bàn) + v38 (đối xứng) + v39 (chu kỳ thực tế).
   * ✔ Founder lật 07/09 (D303): *"Lật tất. Ship luôn."* — gate G1–G4 12.000 trận × 3 cỡ
   * map đo trên CHÍNH v40: 12/12 ✓ (map 8: Tất tay 32,5% / á quân 29,0%, oracle 1,80 < chơi-được 2,82 < bấm-bừa 3,77, hoài-nghi 2,77 < tin-mọi-tin 3,14 < phớt-tin 3,38 · map 12: Bắt đáy 29,1% / 29,0%, oracle 1,95 < 2,83 < 3,98, hoài-nghi 2,59 < 2,85 < 3,31 · map 16: Bắt đáy 31,9% / 30,1%, oracle 1,90 < 2,85 < 4,03, hoài-nghi 2,53 < 2,72 < 3,30).
   */
  'balance-v40-lichcodinh': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: true, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v39 — CHU KỲ THỰC TẾ (D301; MẶC ĐỊNH từ 07/09 trong cụm v40 — D303): khác v38 đúng MỘT cờ
   * `chuKyThucTe` (quy ước bảng: bản mới xếp chồng mọi cờ cũ — nên v39 mang cả v37 áp lực
   * bàn và v38 đối xứng; hiệu ứng riêng của bộ số đọc bằng cách so v38 ↔ v39 trong
   * `npm run do:chu-ky-thuc-te`). Số KHÔNG phải MC-TUNE mà là QUY ĐỔI từ nguồn công khai
   * (NBER · Hartford · Diebold–Rudebusch · Crestmont · Greenwood–Shleifer–You ·
   * Ahern–Sosyura) — đổi số = đổi nguồn.
   * ✔ Founder lật 07/09 (D303) cùng v37 + v38, qua v40.
   */
  'balance-v39-thucte': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: true, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /**
   * v38 — NHÂN QUẢ ĐỐI XỨNG (D185; MẶC ĐỊNH từ 07/09 trong cụm v40 — D303): khác v37 đúng MỘT cờ.
   * ✔ Founder lật 07/09 (D303): gộp v37 + v38 + v39 + v40 một lần.
   */
  'balance-v38-doixung': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: true, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v37-aplucban': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: true, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v36-regime': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true,
    chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true,
    regimeTick: true, giaChongNen: true, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v35-chuoi': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: true, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true, chuoiMoRong: true, tuongTacThe: true, markovNguon: true, beChuoiVon: true, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v34-vai': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: true, kyQuyTuNav: true, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v33-gianla': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true,
    gianLaMapNgan: true, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v32-bansac': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: true, kyNgo: true, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v31-quycogian': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: true, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v30-suathuoc': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: true, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v29-voivang': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: true,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v28-goc': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true,
    laiSuatNen: true, bongBongChuoi: true, mapV28: true, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v27 — BONG BÓNG GÃY ĐƯỢC (founder 04/08). Xem `BONG_BONG_V27`.
   *
   * Bao gồm trọn v26 (lãi suất nền) — hai cơ chế nối vào nhau thành đúng chuỗi
   * founder mô tả: hạ lãi → tiền rẻ → dễ ra bong bóng → chuỗi tăng → gãy → sập.
   */
  'balance-v27-bongbong': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true, laiSuatNen: true, bongBongChuoi: true, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v26-laisuat': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true, laiSuatNen: true, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  'balance-v25-hoacongbang': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: false, hoaCongBang: true, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
  /*
   * v24 — CỠ VỊ THẾ THEO ĐỘ TIN (D58). Xem `CO_VI_THE`.
   *
   * ⚠⚠ ĐO RỒI, KHÔNG ĐẠT, CỐ Ý GIỮ Ở CỔNG (theo đúng tiền lệ `donBayCamKet`
   * của D37). Nó sinh ra để trả lời "vì sao oracle biết trước mọi ô mà vẫn
   * xếp dưới hai bot chơi được", và câu trả lời đo được là: KHÔNG PHẢI VÌ CỠ
   * LỆNH.
   *        oracle map 8    v23 2,27  →  v24 2,31   (tệ đi)
   *        oracle map 16   v23 2,10  →  v24 2,14   (tệ đi)
   * Lý do, và đây mới là phần đáng giữ lại: ưu thế của oracle nằm ở DẤU (nó
   * biết tin nào dựng), không nằm ở ĐỘ LỚN của điểm kỳ vọng. Cấp vốn theo độ
   * lớn thì giúp MỌI bot như nhau — Đuổi đà cũng dồn to khi điểm (thiên lệch)
   * của nó cao — nên nó không mở rộng khoảng cách, mà mốc sàn 20% lại làm
   * oracle vào nhỏ hơn mốc 50% cũ ở những vòng nó đúng mà điểm khiêm tốn.
   *
   * Muốn cỡ lệnh thưởng cho việc BIẾT thì phải cấp vốn theo ĐỘ BẤT ĐỊNH chứ
   * không theo kỳ vọng — mà bot không có mô hình bất định, và dựng một cái
   * riêng cho bot là cho bot một giác quan người chơi không có (gate sẽ đo
   * nhầm sang đó). Đây là chỗ dừng đúng, không phải chỗ vặn tiếp.
   *
   * Ai định bật: đọc hết đoạn trên rồi hãy bật, và bật thì phải đo lại G1–G4.
   */
  'balance-v24-coviThe': {
    nav: true, cuocTat: true, botTuQuyetCamKet: true, luatVon: true, dacQuyen: true,
    donBayCamKet: false, daDangHoaTranTaiSan: true, kyQuyRong: true,
    tuongQuan: true, lichChinhSach: true, quanTinh: true, sucCang: true,
    nenNav: true, chuKy: true, duoiTelegraph: true, duoi5: false, lenhKhong: true,
    boNhanhHeQua: true, xungDotGon: true, congHuongGon: true, canTroi: true,
    botDocTin: true, canTroi2: true, coViThe: true, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  },
};

/**
 * SỔ GỠ — mọi khoá đã thôi sống, và VÌ SAO gỡ được (founder 03/09/2026, câu hỏi
 * B2 phương án (b), toàn văn ở `docs/nhat-ky/D217.md`): một khoá CHỈ đủ điều
 * kiện gỡ TRONG LÚC còn FOUNDER-ONLY — luật đầy đủ ở docstring trên
 * `BO_LUAT_THEO_PHIEN_BAN`.
 *
 * Đây là nơi DUY NHẤT trả lời "khoá X vắng mặt vì gỡ có chủ đích, hay vì ai đó
 * lỡ tay xoá một khoá đang sống" — không suy luận, tra thẳng sổ này. `luatCua()`
 * (dưới) đọc sổ này để phát HAI cảnh báo khác nhau cho hai ca đó.
 *
 * ─── BA MỤC ĐẦU, VÀ SỰ THẬT ĐO ĐƯỢC BẰNG `git log -S` (không phải suy đoán) ──
 * Trước commit `b9f03d4` (2026-07-27) KHÔNG TỒN TẠI bảng tra nào ở đây —
 * `HOLDEM_BALANCE_VERSION` chỉ là MỘT hằng số phẳng, bump tay, không phân nhánh
 * theo phiên bản (chưa có `luatCua`, chưa có registry):
 *
 *   balance-v1-placeholder → v2-D20lever   (2026-07-20, commit 9e97d98)
 *                           → v3-D1         (2026-07-25, commit 9149a02)
 *                           → v4-D2D3D4     (2026-07-25, commit 162cc1d — vài giờ sau)
 *                           → v5-D30-camket (2026-07-26, commit 3f40aa4 — D30 chỉ
 *                             BUMP chuỗi và viết ra ý niệm cổng phiên bản; bảng
 *                             tra VẪN CHƯA tồn tại ở commit này)
 *
 * Bảng `BO_LUAT_THEO_PHIEN_BAN` thật sự ra đời MỘT NGÀY SAU, ở commit `b9f03d4`
 * (2026-07-27), và ra đời với HAI khoá chứ không phải một: `balance-v5-D30-camket`
 * và `balance-v6-luatvon`. Cùng commit đó đẻ luôn `luatCua()` với nhánh "không
 * biết ⇒ tắt hết", kèm một bài test khoá đúng hành vi đó
 * (`luatCua('balance-v1-khong-ton-tai').luatVon === false`) — tức cú rơi-về-tắt-hết
 * là CÓ CHỦ Ý từ ngày đầu, không phải sơ suất; cái thiếu từ ngày đầu là TIẾNG KÊU
 * khi nó xảy ra (M3, vá ở `canhBaoKhoaLa` cuối tệp).
 *
 * ⚠ SỬA 03/09/2026 (phiên chính rà D217): bản đầu của khối này ghi 3f40aa4 là
 * commit dựng ra bảng, "với ĐÚNG MỘT khoá: v5". Kiểm lại: `git show 3f40aa4`
 * không thêm một dòng nào chứa `BO_LUAT_THEO_PHIEN_BAN`. Ghi lại chỗ sai thay vì
 * lặng lẽ thay số — một trích dẫn commit SAI trong khối tự xưng là "chứng cứ
 * `git log -S`" còn nguy hơn không có trích dẫn nào, vì người sau sẽ tin mà
 * không tra lại.
 *
 * Nên ba mục dưới đây KHÔNG PHẢI "bị xoá khỏi bảng" theo nghĩa đen — bảng chưa
 * từng chứa chúng để mà xoá (trường `ngay_go` nói rõ điều này thay vì bịa một
 * ngày xoá không có thật). Chúng được ghi vào sổ làm TIỀN LỆ cho luật gỡ, đúng
 * cách founder xác nhận ở D217: "v2/v3/v4 là bản test founder-only và đã bị gỡ;
 * sổ đăng ký giờ bắt đầu từ balance-v5-D30-camket."
 *
 * ⚠ FOUNDER-ONLY LÀ ĐIỀU GIT LOG KHÔNG XÁC MINH ĐƯỢC — git chỉ cho biết KHI NÀO
 * một chuỗi đổi, không cho biết AI đã chơi trận nào mang chuỗi đó. Ba mục dưới
 * dựa trên xác nhận trực tiếp của founder (D217) + hoàn cảnh đo được (toàn bộ
 * cửa sổ 20–26/07 nằm gọn trong tuần dựng Market Hold'em, nhiều commit mỗi
 * ngày, chưa có migration hay đường mời người ngoài) — KHÔNG dựa trên một truy
 * vấn prod đếm user thật (không có công cụ nào trong tác vụ này gọi prod).
 * D217 (§ "Chưa nghiệm thu được") gọi tên đúng khoảng trống này: luật gỡ không
 * có cách nào tự động hoá từ code một mình — phải tin sổ này + kỷ luật người viết.
 */
export interface KhoaDaGo {
  /** Đúng chuỗi từng nằm ở `holdem_matches.balance_version`. */
  readonly khoa: string;
  /**
   * KHÔNG PHẢI "ngày xoá khỏi bảng" — bảng chưa từng chứa khoá này (xem docstring
   * trên). Đây là thời điểm khoá thôi là giá trị SỐNG của `HOLDEM_BALANCE_VERSION`
   * (bị khoá kế tiếp thay thế), nguồn `git log -S"<khoá>" -- '*.ts'`, ghi kèm luôn
   * phần không xác định được để không ai đọc nhầm thành một ngày "gỡ" có thật.
   */
  readonly ngay_go: string;
  /** Vì sao khoá này ĐỦ ĐIỀU KIỆN gỡ — bằng chứng nó founder-only. */
  readonly ly_do_founder_only: string;
  /** Trỏ D-entry giữ toàn văn quyết định — KHÔNG chép lại số liệu ở đây (D61). */
  readonly d_tro: string;
  /** Số trận prod đo được mang khoá này. Nguồn: `config/giai_doan.ts` (header) + D192. */
  readonly so_tran_do_duoc: number;
}

export const SO_KHOA_DA_GO: readonly KhoaDaGo[] = Object.freeze([
  {
    khoa: 'balance-v2-D20lever',
    ngay_go: 'Không có "ngày gỡ khỏi bảng" theo nghĩa đen (xem docstring trên). '
      + 'Mốc gần nhất đo được: 2026-07-25, khi HOLDEM_BALANCE_VERSION đổi sang '
      + 'balance-v3-D1 (commit 9149a02) — khoá này thôi là mặc định sau 5 ngày '
      + 'sống (từ 2026-07-20, commit 9e97d98).',
    ly_do_founder_only: 'Đúng tuần dựng Đấu trường (pivot D24, 19/07) — bảng tra '
      + 'theo phiên bản chưa tồn tại lúc này, sinh ra sau ở D30. Xác nhận '
      + 'founder-only nằm ở D217; không suy lại được một mình từ git log (git '
      + 'không biết AI đã chơi).',
    d_tro: 'docs/nhat-ky/01-thang7-d10-d42.md §D20 (19/07) · docs/nhat-ky/D192.md '
      + '(đo 81 trận) · docs/nhat-ky/D217.md (luật gỡ)',
    so_tran_do_duoc: 81,
  },
  {
    khoa: 'balance-v3-D1',
    ngay_go: 'Không có "ngày gỡ khỏi bảng" theo nghĩa đen (xem docstring trên). '
      + 'Mốc gần nhất đo được: 2026-07-25 (cùng ngày sinh ra), khi '
      + 'HOLDEM_BALANCE_VERSION đổi sang balance-v4-D2D3D4 (commit 162cc1d, vài '
      + 'giờ sau khi thành mặc định ở commit 9149a02).',
    ly_do_founder_only: 'Cùng tuần dựng Đấu trường, trước khi có registry theo '
      + 'phiên bản. Xác nhận founder-only nằm ở D217; không suy lại được một '
      + 'mình từ git log.',
    d_tro: 'docs/nhat-ky/02-dau-thang8-d43-d85.md (nhắc "balance-v3-D1" ở đo '
      + 'G1-G4 12.000 trận) · docs/nhat-ky/D192.md (đo 7 trận) · '
      + 'docs/nhat-ky/D217.md (luật gỡ)',
    so_tran_do_duoc: 7,
  },
  {
    khoa: 'balance-v4-D2D3D4',
    ngay_go: 'Không có "ngày gỡ khỏi bảng" theo nghĩa đen (xem docstring trên). '
      + 'Mốc gần nhất đo được: 2026-07-26, khi HOLDEM_BALANCE_VERSION đổi sang '
      + 'balance-v5-D30-camket (commit 3f40aa4). Bảng BO_LUAT_THEO_PHIEN_BAN ra '
      + 'đời SAU đó một ngày (commit b9f03d4, 2026-07-27) và ra đời với hai khoá '
      + 'v5+v6, nên không có khoảnh khắc nào v4 từng là một dòng trong bảng đó.',
    ly_do_founder_only: 'Cùng tuần dựng Đấu trường; bảng tra theo phiên bản ra '
      + 'đời một ngày SAU khi khoá này bị thay. Xác nhận founder-only nằm ở D217; '
      + 'không suy lại được một mình từ git log.',
    d_tro: 'docs/nhat-ky/02-dau-thang8-d43-d85.md (nhắc "balance-v4-D2D3D4" ở đo '
      + 'archetype 12.000 trận) · docs/nhat-ky/D192.md (đo 7 trận) · '
      + 'docs/nhat-ky/D217.md (luật gỡ)',
    so_tran_do_duoc: 7,
  },
]);

/**
 * Đã cảnh báo về khoá lạ nào rồi — một khoá MỘT LẦN mỗi tiến trình (M3, D217).
 * Không phải cache dữ liệu: chỉ chặn `console.warn` lặp lại; `luatCua()` vẫn
 * tính lại bộ cờ TẮT HẾT mỗi lần gọi như trước, hành vi trả về không đổi.
 */
const DA_CANH_BAO_KHOA_LA = new Set<string>();

/**
 * CẢNH BÁO KHÔNG ÉP DỪNG (M3 — đóng lỗ hổng im lặng đã ăn 53% corpus, D192).
 *
 * ⚠ VÌ SAO WARN, KHÔNG PHẢI THROW: throw sẽ làm MỌI trận mang khoá lạ — kể cả
 * những khoá đã gỡ có chủ đích, đúng luật (`SO_KHOA_DA_GO`) — không mở lại được
 * nữa. Mất khả năng mở một trận cũ để xem là cái giá NẶNG HƠN việc nó dựng lại
 * sai (điều vẫn đúng dù throw hay không — dữ liệu founder-only vô hại hơn app
 * sập). Warn giữ được cả hai: trận vẫn mở, mà có dấu vết trong log để bắt đúng
 * lúc — thứ hoàn toàn vắng mặt trước D217, và là lý do 53% corpus mục nát không
 * ai biết suốt nhiều tháng (D192).
 *
 * ⚠ HAI CÂU CẢNH BÁO KHÁC NHAU CÓ CHỦ Ý: khoá có trong `SO_KHOA_DA_GO` là "biết
 * rồi, đúng dự kiến" — không cần hoảng. Khoá KHÔNG có ở CẢ HAI sổ mới là ca báo
 * động thật (rất có thể một khoá ĐANG SỐNG bị xoá nhầm — đúng thứ luật gỡ B2(b)
 * dựng ra để chặn). Câu chữ phải khác nhau để người đọc log phân biệt ngay,
 * không phải mở code ra tra.
 */
function canhBaoKhoaLa(phienBan: string): void {
  if (DA_CANH_BAO_KHOA_LA.has(phienBan)) return;
  DA_CANH_BAO_KHOA_LA.add(phienBan);

  const daGo = SO_KHOA_DA_GO.find((k) => k.khoa === phienBan);
  if (daGo) {
    console.warn(
      `[luatCua] "${phienBan}" là khoá ĐÃ GỠ có chủ đích, đúng dự kiến `
      + `(xem SO_KHOA_DA_GO trong config/holdem_balance.ts — ${daGo.d_tro}). `
      + 'Trận mang khoá này replay bằng bộ luật TẮT HẾT — không phải lỗi.',
    );
  } else {
    console.warn(
      `[luatCua] ⚠⚠ "${phienBan}" KHÔNG có trong BO_LUAT_THEO_PHIEN_BAN và cũng `
      + 'KHÔNG có trong SO_KHOA_DA_GO (config/holdem_balance.ts) — có thể là một '
      + 'khoá ĐANG SỐNG bị xoá NHẦM (vi phạm luật gỡ B2(b), D217), không phải một '
      + 'lần gỡ có chủ đích. Trận mang khoá này ĐANG replay SAI bằng bộ luật TẮT '
      + 'HẾT — tra ngay trước khi tin bất kỳ số nào nó sinh ra.',
    );
  }
}

/** Bộ luật cho một `balance_version` bất kỳ (không biết ⇒ tắt hết, và cảnh báo
 *  đúng MỘT lần mỗi khoá lạ mỗi tiến trình qua `canhBaoKhoaLa` — M3, D217). */
export function luatCua(phienBan: string | null | undefined): BoLuatCanBang {
  const luat = BO_LUAT_THEO_PHIEN_BAN[phienBan ?? ''];
  if (luat) return luat;
  // Rỗng/null: "chưa có phiên bản" là trạng thái đã biết, xử lý riêng ở
  // `giaiDoanCuaPhienBan` (config/giai_doan.ts) — khác hẳn "khoá lạ", nên không
  // cảnh báo ở đây, tránh biến một ca bình thường thành nhiễu nền.
  if (phienBan) canhBaoKhoaLa(phienBan);
  return {
    nav: false, cuocTat: false, botTuQuyetCamKet: false, luatVon: false, dacQuyen: false,
    donBayCamKet: false, daDangHoaTranTaiSan: false, kyQuyRong: false,
    tuongQuan: false, lichChinhSach: false, quanTinh: false, sucCang: false, nenNav: false, chuKy: false, duoiTelegraph: false, duoi5: false, lenhKhong: false, boNhanhHeQua: false, xungDotGon: false, congHuongGon: false, canTroi: false, botDocTin: false, canTroi2: false, coViThe: false, hoaCongBang: false, laiSuatNen: false, bongBongChuoi: false, mapV28: false, phiVoiVang: false,
    botDungThuocThat: false, quyCoGian: false, banSacMap: false, kyNgo: false, gianLaMapNgan: false, vaiCoRang: false, kyQuyTuNav: false, phanThan: true, chuoiMoRong: false, tuongTacThe: false, markovNguon: false, beChuoiVon: false, regimeTick: false, giaChongNen: false, apLucBan: false, nhanQuaDoiXung: false, chuKyThucTe: false, lichKhongDoi: false, lopVn: false, taiSanV42: false, couponTpcp: false, khongTheoMa: false, tienMatSuKien: false, khoaTaiSanTat: false, tietKiem: false, betaTaiSanV2: false, duongCong: false, bienDongV45: false, couponGiuDu: false, donBayTheoMa: false, laiVayDonBay: false, khauViTheoMa: false, doiTacTruMotLan: false, khongTheoGia: false, khongTheoHanMuc: false, banKhongThuanQuyen: false, xepHangTheoMa: false, phiLenhNhe: false, phiLenhBac: false, daDangV52: false, oUp: false, botDocNen: false, banhXe: false, khauViTat: false, vonDeu: false, chiBan16: false, loiGon: false, thanhKhoanNamNac: false, muaDinhHan: false, tinTheoMua: false, luatLa: false, boBaiTat: false, quyTheoCoBan: false, quyTranHang1: false, tietKiemLamPhat: false, tietKiemThaNoi: false, nganHangDoVo: false, lua: false, luaPhi: false, luaQuyetToan: false, luaMuaDuoi: false, nhiemVuLoi: false, trait: false, traitVai: false, chanLoTrait: false, luotSongMoi: false, gopXu: false, khaoSatDauMienPhi: false, luaKhongPhatDao: false, kyLuatSauDonBay: false, phiCongDonVong: false,
  };
}
