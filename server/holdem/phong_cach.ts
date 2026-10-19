/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PHONG CÁCH CHƠI — thanh chấm điểm E → SSS (founder 17/08)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Nguyên văn founder:
 *  · *"thêm 1 thanh chấm điểm 'Phong cách chơi' như kiểu Devil May Cry"*;
 *  · *"thanh NAV bây giờ thay vì chỉ là thanh tĩnh thì sẽ là 1 thanh chấm điểm"*;
 *  · *"Tại sao không tính việc KHÔNG LÀM GÌ cũng là 1 hành động?"*;
 *  · *"Nó chính là cái chấm TỔNG HOÀ của tất cả các chỉ số chứ ko chỉ NAV, và
 *    kết trận thì ở menu kết thúc mới khoe mấy chỉ số kia cụ thể để flex"*;
 *  · *"đừng bê nguyên si bộ chấm điểm trong quant vào — làm cái nào player nhìn
 *    dễ hiểu và thấy ngầu thôi"*.
 *
 * ⇒ KIẾN TRÚC: quant ở TẦNG TÍNH, game ở TẦNG HIỆN. Trong trận người chơi thấy
 * ĐÚNG MỘT thanh và một hạng; ba thành phần bên dưới chỉ banh ra ở màn kết.
 *
 * ─── VÌ SAO BA THÀNH PHẦN, VÀ VÌ SAO ĐÚNG BA CÁI NÀY ───────────────────────
 * Founder lo đúng một chuyện: *"tránh player chỉ tập trung tối ưu 1 mục tiêu
 * tăng NAV mà làm bẩn data"*. Nên mỗi thành phần chặn một kiểu lách:
 *   ĐỌC       (Brier vòng)        — chặn "ăn may một cú all-in": đoán bừa mà
 *                                   dồn một mã bị phạt nặng (đo: dồn 1 mã chỉ
 *                                   đáng khi tin > 58,3%, bốc bừa chỉ 16,7%).
 *   THẮNG CHỢ (so TRUNG VỊ 6 mã)  — chặn "đu theo chợ rồi nhận công": chợ lên
 *                                   thì ai cũng lên, chỉ phần HƠN chợ mới tính.
 *   TRỤ       (không sập khi chợ sập) — chặn "dồn hết rồi cầu nguyện".
 *
 * ⚠⚠ MỐC CHỢ PHẢI LÀ TRUNG VỊ, KHÔNG PHẢI TRUNG BÌNH. Đo trên 800 trận × 8
 * vòng, tỷ lệ "hơn chợ" của bốn kiểu chơi:
 *        mốc            đứng ngoài   ôm bừa   DÀN ĐỀU   ôm đúng mã tốt nhất
 *        TRUNG VỊ          47%         50%      50%           100%
 *        TRUNG BÌNH        51%         50%       0%  ⚠        100%
 * Với TRUNG BÌNH, "dàn đều" KHÔNG BAO GIỜ vượt mốc (danh mục đều ≡ trung bình)
 * ⇒ thước âm thầm phạt ĐA DẠNG HOÁ, tức phạm §1.2 qua cửa sau. Với TRUNG VỊ thì
 * ôm bừa 50% và dàn đều 50% — trung lập hoàn hảo với khẩu vị, chỉ CHỌN ĐÚNG mới
 * ăn điểm. Một chữ khác nhau, hai kết quả trái ngược.
 *
 * ⚠ "KHÔNG LÀM GÌ" ĐƯỢC CHẤM NHƯ MỘT DỰ BÁO: ôm tiền mặt tức là đã phát biểu
 * *"chợ sắp xuống"*. Chợ xuống thật ⇒ đọc đúng; chợ lên ⇒ đọc sai; đi ngang ⇒
 * trung tính. Xem `diemVong`. Nhờ vậy đứng ngoài ĐÚNG LÚC ăn điểm, còn ngồi im
 * cả trận thì không — thanh không bao giờ thưởng riêng mức tiền mặt (§1.2).
 *
 * ⚠ §1.2 — thước này KHÔNG đo mức phơi nhiễm, KHÔNG đo số mã đang giữ, KHÔNG đo
 * tỷ lệ tiền mặt. Ba trục đó là thứ app đang ĐO; thưởng chúng là làm bẩn số đo.
 * ⚠ THUẦN QUAN SÁT — không đổi một chip nào ⇒ KHÔNG cần cổng `balance_version`,
 * không phải đo lại G1–G4 (cùng tiền lệ `brier.ts` khi cắm dây lần đầu).
 */

/** Một vòng đã có đủ số để chấm. */
export interface VongPhongCach {
  /** Brier vòng (0..2, thấp = đọc đúng). `null` = toàn tiền mặt, KHÔNG dự báo. */
  brier: number | null;
  /** NAV của ghế đổi bao nhiêu ở vòng này (bp). */
  nav_bp: number;
  /** CHỢ đổi bao nhiêu — TRUNG VỊ lợi suất các mã (bp). Xem ghi chú đầu file. */
  cho_bp: number;
  /** Vòng do HẾT GIỜ tự nộp? Không phải quyết định (D38) ⇒ không nuôi streak. */
  tu_dong: boolean;
}

/** Ba thành phần đã chuẩn hoá 0..1 — chỉ banh ra ở màn kết (founder). */
export interface BaTruc {
  /** ĐỌC — 1 là đọc chuẩn. `null` khi cả trận không dự báo vòng nào. */
  doc: number | null;
  /** THẮNG CHỢ — 0,5 là ngang chợ, hơn 0,5 là vượt. */
  thang_cho: number;
  /** TRỤ — 1 là không gãy lần nào lúc chợ sập. */
  tru: number;
}

export interface KetQuaPhongCach {
  /** Điểm tổng hoà 0..1000 — thứ thanh trong trận vẽ. */
  diem: number;
  /** Hạng hiện ra: 'E-' … 'S+', 'SS', 'SSS'. */
  hang: HangPhongCach;
  /** Chuỗi vòng liên tiếp đạt chuẩn — nguồn của áp lực giữ streak. */
  streak: number;
  /** Streak dài nhất cả trận (khoe ở màn kết). */
  streak_dai_nhat: number;
  /** Ba trục — MÀN KẾT mới hiện; trong trận KHÔNG (founder: chỉ một thanh). */
  ba_truc: BaTruc;
}

export type HangPhongCach =
  | 'E-' | 'E' | 'E+' | 'D-' | 'D' | 'D+' | 'C-' | 'C' | 'C+'
  | 'B-' | 'B' | 'B+' | 'A-' | 'A' | 'A+' | 'S-' | 'S' | 'S+'
  | 'SS' | 'SSS';

/**
 * Thang hạng. Founder viết: *"+/-E +-D +-C +-B +-A +-S, SS và SSS"* ⇒ sáu hạng
 * gốc có nấc ±, còn SS và SSS KHÔNG có nấc — hai bậc cuối phải là MỘT thứ duy
 * nhất, chia nhỏ là làm loãng đúng cái đáng khoe nhất.
 */
export const THANG: readonly { hang: HangPhongCach; tu: number }[] = [
  { hang: 'E-', tu: 0 }, { hang: 'E', tu: 60 }, { hang: 'E+', tu: 120 },
  { hang: 'D-', tu: 180 }, { hang: 'D', tu: 240 }, { hang: 'D+', tu: 300 },
  { hang: 'C-', tu: 355 }, { hang: 'C', tu: 410 }, { hang: 'C+', tu: 465 },
  { hang: 'B-', tu: 520 }, { hang: 'B', tu: 570 }, { hang: 'B+', tu: 620 },
  { hang: 'A-', tu: 670 }, { hang: 'A', tu: 715 }, { hang: 'A+', tu: 760 },
  { hang: 'S-', tu: 805 }, { hang: 'S', tu: 845 }, { hang: 'S+', tu: 885 },
  { hang: 'SS', tu: 925 }, { hang: 'SSS', tu: 970 },
] as const;

/**
 * Tham số — PLAYTEST-TUNE, MỘT chỗ.
 * ⚠ Đây là tham số THIẾT KẾ (A8.2): agent đặt điểm khởi đầu và TRÌNH phân phối
 * đo được; founder chốt số cuối.
 */
export const PC = {
  /** Trọng số ba thành phần trong điểm vòng. Cộng lại = 1. */
  W_DOC: 0.45,
  W_THANG_CHO: 0.35,
  W_TRU: 0.20,
  /**
   * ⭐ SÀN VÒNG ĐỦ TIN — số giả-vòng cộng vào mẫu số khi trận còn ngắn, tan dần
   * về 0 từ vòng thứ 4. Xem chú thích dài trong `chamPhongCach` để biết vì sao
   * là 4 và vì sao nó KHÔNG đổi hạng cuối trận.
   * ⚠ PLAYTEST-TUNE: đổi số này thì phải chạy lại phép đo 600 trận đã ghi ở đó,
   * không đoán — nó quyết định lúc nào lớp phủ toàn màn được phép nổ.
   */
  SAN_VONG_TIN_CAY: 4,
  /** Mốc "chưa biết gì" — giữa thang. Giả-vòng được chấm bằng đúng mốc này. */
  MOC_TRUNG_TINH: 0.5,
  /** Vòng đạt chuẩn (nuôi streak) khi điểm vòng ≥ ngần này. */
  NGUONG_STREAK: 0.55,
  /** Mỗi vòng streak cộng thêm ngần này vào điểm vòng, trần `STREAK_TRAN`. */
  STREAK_BONUS: 0.05,
  STREAK_TRAN: 0.30,
  /**
   * Nghiêng về vòng GẦN ĐÂY (cùng khuôn trọng số Brier per-pool của A5.4): vòng
   * thứ i tính trọng số `NGHIENG^(n-1-i)`. Nhỏ hơn 1 nghĩa là vòng cũ nhẹ dần
   * ⇒ thanh SỐNG trong trận thay vì đóng băng sau vài vòng đầu.
   */
  NGHIENG: 0.88,
  /** Chợ tụt quá ngần này (bp) mới gọi là "chợ sập" — dùng cho trục TRỤ. */
  CHO_SAP_BP: 300,
  /** Vòng chợ KHÔNG sập: trục TRỤ trả mốc trung tính này (không thưởng, không phạt). */
  TRU_TRUNG_TINH: 0.6,
  /** Thang bão hoà của vế THẮNG CHỢ (bp). Càng lớn càng khó chiếm trọn thanh. */
  HON_CHO_THANG_BP: 800,
  /** Sập theo chợ bao nhiêu bp thì trục TRỤ về 0. */
  TRU_DAY_BP: 2000,
  /** Dưới ngần này (bp) coi như chợ ĐI NGANG — dùng để chấm vòng đứng ngoài. */
  NGANG_BP: 120,
  /**
   * D337 — TRẦN THEO VỊ TRÍ (khoá theo thứ hạng). Vị trí `h` (1=nhất) trong
   * bàn `N` ghế chạm tới chỉ số `floor(GOC + DOC·(N−h)/(N−1))` trong `THANG`.
   * Xem khối docstring dài ở `chuToiDaTheoThuHang` cho vì sao + vector tay.
   * GOC=7 ⇒ đáy bàn chạm 'C' (chỉ số 7); GOC+DOC=19 ⇒ đỉnh bàn chạm 'SSS'.
   */
  TRAN_THU_HANG_GOC: 7,
  TRAN_THU_HANG_DOC: 12,
} as const;

/**
 * D337 — CHƯA ĐỦ `SAN_VONG_TIN_CAY` VÒNG THÌ CHƯA CÓ HẠNG (thanh, dải ghế, màn kết).
 *
 * Founder 16/09: *"cái vụ chấm điểm mấy vòng đầu t cấm là vì ko đủ dữ liệu chấm điểm/
 * đánh giá ấy nên cũng ko cần phức tạp hóa vấn đề"*. Trước đây "cấm" được làm bằng
 * giả-vòng kéo điểm về giữa (xem `chamPhongCach`) — và đo 15/09 thấy nó THỦNG ở luật
 * v45: ~10% trận có ghế hiện ≥ S- ngay vòng 2–3, vì giá chạy mạnh hơn bàn v34 lúc đo.
 * Chỉnh số giả-vòng theo từng thang là đúng thứ founder bảo đừng làm. Cửa cứng này thì
 * không thủng được, và từ vòng thứ `SAN_VONG_TIN_CAY` giả-vòng đã tan hết (`k = 0`),
 * nên thứ hiện ra không bị chiết khấu nào chạm.
 */
export function duVongDeCoHang(soVong: number): boolean {
  return soVong >= PC.SAN_VONG_TIN_CAY;
}

/**
 * D337 — THANG BÀN TẬP: cùng 20 chữ, đỉnh nới xuống.
 *
 * Founder: *"bạn giúp user đạt SSS ở phần hướng dẫn để app flex hiệu ứng nhé =))
 * chứ mình tốn công làm mà ko ai xem thì hơi phí"* rồi *"Ờ nhưng chỉ trong phần
 * hướng dẫn thôi nhé =)) vào trận sợ mất cân bằng và lỗi phép đo"*.
 *
 * Đo trước khi có thang này: với `THANG` chuẩn, trần của bàn tập là SS — kể cả khi
 * ghế người chơi đi ĐÚNG mạch Oracle (V4 tiền rẻ vào phe rủi ro, V9 kỳ họp sang
 * USDT: về nhất, điểm gốc 934). Một ghế BIẾT TRƯỚC Ô trên bàn bot thường cũng chỉ
 * chạm SSS 0,1% số trận. Thang dưới cho đúng đường ấy SSS từ vòng 11 (D337).
 *
 * ⚠ KHÔNG gửi thang này xuống client. Server QUY điểm bàn tập về thang chuẩn
 * (`quyVeThangChuan`) trước khi trả ra, nên client vẫn một `THANG` — thanh, màu,
 * lớp phủ S/SS/SSS đọc cùng một bảng như trận thật (D61: bảng thứ hai ở client là
 * bảng sẽ trôi). Từ B trở xuống hai thang TRÙNG nhau.
 */
export const THANG_BAN_TAP: readonly { hang: HangPhongCach; tu: number }[] = [
  { hang: 'E-', tu: 0 }, { hang: 'E', tu: 60 }, { hang: 'E+', tu: 120 },
  { hang: 'D-', tu: 180 }, { hang: 'D', tu: 240 }, { hang: 'D+', tu: 300 },
  { hang: 'C-', tu: 355 }, { hang: 'C', tu: 410 }, { hang: 'C+', tu: 465 },
  { hang: 'B-', tu: 520 }, { hang: 'B', tu: 570 }, { hang: 'B+', tu: 620 },
  { hang: 'A-', tu: 650 }, { hang: 'A', tu: 675 }, { hang: 'A+', tu: 700 },
  { hang: 'S-', tu: 720 }, { hang: 'S', tu: 760 }, { hang: 'S+', tu: 800 },
  { hang: 'SS', tu: 855 }, { hang: 'SSS', tu: 910 },
] as const;

/** Chuẩn hoá Brier 0..2 (thấp tốt) về 0..1 (cao tốt). */
const tuBrier = (b: number): number => Math.max(0, Math.min(1, 1 - b / 2));

/**
 * Chuẩn hoá "hơn chợ bao nhiêu bp" về 0..1 quanh mốc 0,5.
 *
 * Dùng hàm BÃO HOÀ chứ không cắt cứng: hơn chợ 1.000bp và hơn 10.000bp đều rất
 * tốt, nhưng một cú may đơn lẻ KHÔNG được chiếm trọn thanh — đó chính là "chỉ
 * tối ưu NAV" mà founder muốn tránh.
 */
const tuHonCho = (d: number): number =>
  0.5 + 0.5 * (d / (Math.abs(d) + PC.HON_CHO_THANG_BP));

/** Trục TRỤ của một vòng — chỉ có nghĩa ở vòng chợ sập. */
const truVong = (v: VongPhongCach): number => (
  v.cho_bp <= -PC.CHO_SAP_BP
    ? Math.max(0, Math.min(1, 1 + v.nav_bp / PC.TRU_DAY_BP))
    : PC.TRU_TRUNG_TINH
);

/** Điểm một vòng, 0..1 (chưa cộng streak). */
export function diemVong(v: VongPhongCach): number {
  const honCho = tuHonCho(v.nav_bp - v.cho_bp);
  const tru = truVong(v);
  if (v.brier === null) {
    /*
     * ⭐⭐ ĐỨNG NGOÀI LÀ MỘT DỰ BÁO — và được chấm ĐÚNG/SAI như mọi dự báo khác.
     *
     * Founder: *"tại sao không tính việc KHÔNG LÀM GÌ cũng là 1 hành động?"*.
     * Ôm tiền mặt tức là đã phát biểu "chợ sắp xuống". Chợ xuống thật ⇒ đọc
     * đúng; chợ lên ⇒ đọc sai; chợ đi ngang ⇒ trung tính.
     *
     * ⚠ BẢN ĐẦU CỦA TÔI BỎ TRỤC ĐỌC RỒI CHIA LẠI TRỌNG SỐ, và phép đo bắt được
     * ngay: ngồi KHÔNG cả trận ăn 599 điểm (hạng B-), cao hơn cả người bấm bừa
     * (372). Vì bỏ trục nặng nhất đi thì người đứng ngoài không bao giờ bị phạt
     * ở đúng chỗ người có vị thế bị phạt ⇒ thanh THƯỞNG MỨC TIỀN MẶT, tức phạm
     * §1.2 qua cửa sau. Giữ nguyên trọng số và chấm đứng-ngoài như một lời dự
     * báo thì cửa đó đóng lại.
     */
    const docNgoai = v.cho_bp <= -PC.NGANG_BP ? 1 : v.cho_bp >= PC.NGANG_BP ? 0 : 0.5;
    return PC.W_DOC * docNgoai + PC.W_THANG_CHO * honCho + PC.W_TRU * tru;
  }
  return PC.W_DOC * tuBrier(v.brier) + PC.W_THANG_CHO * honCho + PC.W_TRU * tru;
}

/**
 * Chấm cả chuỗi vòng → điểm, hạng, streak, ba trục.
 * Hàm THUẦN: không đọc DB, không đụng engine — server lẫn client dùng chung một
 * bản (A8.9: đổi client thì viết lại phần VẼ, không viết lại phần CHẤM).
 */
export function chamPhongCach(vongs: readonly VongPhongCach[]): KetQuaPhongCach {
  if (vongs.length === 0) {
    return {
      diem: 0, hang: 'E-', streak: 0, streak_dai_nhat: 0,
      ba_truc: { doc: null, thang_cho: 0.5, tru: 1 },
    };
  }
  let streak = 0; let dai = 0;
  let tuSo = 0; let mauSo = 0;
  const n = vongs.length;
  for (const [i, v] of vongs.entries()) {
    const co = diemVong(v);
    // Hết giờ tự nộp KHÔNG nuôi streak: "không kịp bấm" không phải một quyết định.
    if (co >= PC.NGUONG_STREAK && !v.tu_dong) {
      streak += 1;
      if (streak > dai) dai = streak;
    } else {
      streak = 0;
    }
    const thuong = Math.min(PC.STREAK_TRAN, streak * PC.STREAK_BONUS);
    const w = PC.NGHIENG ** (n - 1 - i);
    tuSo += w * Math.min(1, co + thuong);
    mauSo += w;
  }
  /*
   * ⭐⭐ CHIẾT KHẤU CỠ MẪU — vài vòng đầu thì "chưa biết", không phải "xuất sắc".
   *
   * Điểm là TRUNG BÌNH CÓ TRỌNG SỐ, nên trước bản này nó gần như không nhúc nhích
   * theo số vòng: đo bằng hàm thuần, một chuỗi vòng đẹp cho 933đ (SS) ngay ở VÒNG
   * 1 và 975đ (SSS) ở vòng 3 — bằng đúng con số của 16 vòng như thế. Tức thang
   * hạng không phải thứ leo được; nó là thứ có sẵn ngay từ vòng đầu.
   *
   * ⇒ Cộng `k` giả-vòng ở mốc TRUNG TÍNH (0,5) và cho `k` TAN DẦN về 0. Sớm thì
   * điểm bị kéo về giữa vì mẫu chưa đủ để nói gì; cuối trận `k = 0` nên điểm
   * TRỞ LẠI ĐÚNG BẰNG bản cũ, không xê dịch một điểm nào.
   *
   * ⚠ ĐO TRÊN TRẬN BOT THẬT (600 trận, map 8, v34) — đây là lý do chọn 4 chứ
   * không phải một con số ưa thích:
   *        K0=0 (cũ)   S nổ 87 lần, 35 trong đó ở ≤ vòng 3 · SS 42 lần, 27 ở ≤v3
   *        K0=4        S nổ 55 lần, **0** ở ≤v3      · SS 24 lần, **0** ở ≤v3
   *        phân phối CUỐI TRẬN: SSS 0,2% · S+ 7,8% — GIỐNG HỆT ở mọi K0
   *   4 là mức NHỎ NHẤT xoá sạch công bố ≤ vòng 3; lớn hơn chỉ giết thêm cú công
   *   bố giữa trận mà không thêm lợi ích nào.
   * ⚠ Và nó KHÔNG đổi hạng cuối trận theo CẤU TRÚC, không phải nhờ may: mọi map
   *   đều ≥ 8 vòng, mà `k = 0` từ vòng thứ 4 trở đi.
   *
   * ⚠⚠ ĐÍNH CHÍNH D115: ghi chú *"ngồi im 3 vòng đầu vẫn ra 974đ = SSS"* KHÔNG
   * tái lập được trên trận thật — SSS chỉ nổ ở 0,8% số trận và đúng 1 lần ở ≤v3.
   * Thứ nổ sớm là S và SS (40% và 64% số cú nổ nằm ở ≤ vòng 3). Con số cũ nhiều
   * khả năng đo trên một chuỗi vòng dựng tay, không phải trận thật.
   */
  const k = Math.max(0, PC.SAN_VONG_TIN_CAY - n);
  const diem = Math.round(1000 * ((tuSo + k * PC.MOC_TRUNG_TINH) / (mauSo + k)));
  return {
    diem, hang: hangCua(diem), streak, streak_dai_nhat: dai, ba_truc: baTruc(vongs),
  };
}

/**
 * 22/08 — ĐẦU HÀNG = E- (founder: *"Cho người đó hạng E- luôn"*). Không chấm
 * ba trục: bỏ trận là bỏ cả ba; và chấm dở dang thì người đầu hàng ở vòng 2 sau
 * một vòng may lại mang hạng B — thưởng cho việc rời bàn đúng lúc đang lên.
 */
export const PHONG_CACH_DAU_HANG: KetQuaPhongCach = Object.freeze({
  diem: 0, hang: 'E-', streak: 0, streak_dai_nhat: 0,
  ba_truc: { doc: null, thang_cho: 0, tru: 0 },
}) as KetQuaPhongCach;

export function hangCua(diem: number): HangPhongCach {
  let ra: HangPhongCach = 'E-';
  for (const m of THANG) if (diem >= m.tu) ra = m.hang;
  return ra;
}

/**
 * D337 — QUY điểm chấm theo `THANG_BAN_TAP` về điểm tương đương trên `THANG` chuẩn:
 * nội suy tuyến tính TRONG từng dải chữ, nên chữ giữ nguyên và thứ tự giữ nguyên
 * (`hangCua(quyVeThangChuan(d))` = chữ của `d` trên thang bàn tập). Dải đỉnh
 * [910, 1000] ↦ [970, 1000]. Xem `THANG_BAN_TAP` để biết vì sao quy ở server.
 */
export function quyVeThangChuan(diem: number): number {
  let i = 0;
  THANG_BAN_TAP.forEach((m, k) => { if (diem >= m.tu) i = k; });
  const a0 = THANG_BAN_TAP[i]!.tu;
  const a1 = i + 1 < THANG_BAN_TAP.length ? THANG_BAN_TAP[i + 1]!.tu : 1001;
  const b0 = THANG[i]!.tu;
  const b1 = i + 1 < THANG.length ? THANG[i + 1]!.tu : 1001;
  return b0 + Math.floor(((diem - a0) * (b1 - b0)) / (a1 - a0));
}

/** Ba trục cho MÀN KẾT (founder: "menu kết thúc mới khoe mấy chỉ số kia"). */
export function baTruc(vongs: readonly VongPhongCach[]): BaTruc {
  const coBrier = vongs.filter(
    (v) => v.brier !== null,
  ) as (VongPhongCach & { brier: number })[];
  const tb = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const sap = vongs.filter((v) => v.cho_bp <= -PC.CHO_SAP_BP);
  return {
    doc: coBrier.length ? tb(coBrier.map((v) => tuBrier(v.brier))) : null,
    thang_cho: tb(vongs.map((v) => tuHonCho(v.nav_bp - v.cho_bp))),
    tru: sap.length ? tb(sap.map(truVong)) : 1,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * D337 — KHOÁ THEO THỨ HẠNG: TRẦN THEO VỊ TRÍ + GỘP TRUNG BÌNH (PAV)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Founder soi bàn tập 15/09: đứng thứ hạng 7/8 (NAV −15%) mà thanh phong cách
 * chấm A+, trong khi ghế NHẤT bàn chỉ A-. Nguyên văn:
 *  · *"hạng cao thì thứ hạng phải cao mà hạng thấp thì thứ hạng phải thấp và
 *    cái chấm này và thứ hạng cuối cùng hiển thị trong trận phải là 1"*.
 *
 * ⇒ Founder BÁC bảng dải cố định (kiểu "thứ hạng 1–2 chỉ được từ S trở lên")
 * vì *"cả lobby chơi tệ thì có khi B/C là cao nhất"* — một trần TUYỆT ĐỐI theo
 * cấp bậc sẽ ép người NHẤT của một bàn toàn chơi dở phải nhận một hạng cao giả
 * tạo mà chính bản thân điểm gốc không có. Nên khoá phải TƯƠNG ĐỐI: chỉ ép
 * ĐÚNG THỨ TỰ (xếp dưới ai thì không cao hơn người đó), không ép một sàn màu
 * cứng nào — `diemVong`/`chamPhongCach` (công thức CHẤM) không đổi một chữ,
 * khoá này chỉ SIẾT lại kết quả đã chấm, và chạy NGOÀI `replay()` (golden của
 * `replay()` không đụng — xem chỗ gọi ở `holdem_api.ts`).
 *
 * HAI BƯỚC, cả hai THUẦN (không đọc DB, không import engine — cùng khuôn với
 * phần còn lại của file này):
 *
 *   1. TRẦN THEO VỊ TRÍ (`chuToiDaTheoThuHang`) — vị trí thứ hạng `h` (1 =
 *      nhất) trong bàn `N` ghế chạm được tối đa chỉ số
 *      `floor(GOC + DOC·(N−h)/(N−1))` trong `THANG` (N=1 ⇒ 19, không ai để so
 *      nên không trần). Trần DÃN ĐỀU từ đáy bàn (GOC=7 ⇒ 'C') lên đỉnh bàn
 *      (GOC+DOC=19 ⇒ 'SSS') — người NHẤT của một bàn 8 ghế toàn chơi dở vẫn
 *      CHẠM ĐƯỢC SSS nếu điểm gốc đủ cao (trần không giữ họ ở C: bàn TỆ không
 *      có nghĩa là trần THẤP, chỉ có nghĩa là điểm GỐC thấp), nhưng người BÉT
 *      bàn không bao giờ vượt 'C' dù điểm gốc cao cỡ nào.
 *   2. GỘP TRUNG BÌNH (`khoaTheoThuHang`, PAV — pool adjacent violators) trên
 *      dãy điểm-SAU-TRẦN theo đúng thứ hạng: ép dãy KHÔNG TĂNG bằng cách gộp
 *      hai khối liền kề thành TRUNG BÌNH CHÍNH XÁC (sum/n, không làm tròn giữa
 *      chừng) mỗi khi khối sau > khối trước, lặp tới khi hết vi phạm — rồi mới
 *      làm tròn (`Math.round`) một lần duy nhất lúc trải ra. Bước 1 một mình
 *      không đủ: trần chỉ CẮT TỪNG GHẾ ĐỘC LẬP, nên ghế thứ hạng 4 chơi tốt
 *      hơn hẳn ghế thứ hạng 3 (điểm gốc cao hơn) mà trần vị trí 4 lại thấp hơn
 *      trần vị trí 3 vẫn có thể hiện SAU-TRẦN cao hơn hạng 3 — PAV kéo cả khối
 *      vi phạm về cùng một mức, khôi phục thứ tự.
 *
 * TOÁN ĐÃ CHỨNG MINH (khoá bằng test tính chất trong `tests/phong_cach.test.ts`,
 * PRNG tất định, N=2..8, vài nghìn dãy ngẫu nhiên):
 *   · KHÔNG TĂNG — hệ quả trực tiếp của PAV.
 *   · KHÔNG GHẾ NÀO VƯỢT TRẦN CỦA CHÍNH MÌNH — quy nạp trên PAV: một khối chỉ
 *     gộp thêm phần tử liền sau khi phần tử đó (đã bị trần CỦA NÓ chặn) lớn
 *     hơn trung bình khối hiện tại, nên trung bình MỚI luôn nằm GIỮA hai giá
 *     trị — tức nhỏ hơn trần của phần tử vừa gộp (phần tử LIỀN SAU luôn có
 *     trần chặt nhất trong khối, vì trần không tăng theo thứ hạng).
 *   · NGƯỜI NHẤT ≥ ĐIỂM GỐC CỦA CHÍNH HỌ — trần vị trí 1 luôn là 1000 (không
 *     cắt), nên PAV chỉ có thể GỘP LÊN (khối chỉ nới rộng khi phần tử sau lớn
 *     hơn trung bình hiện tại, tức trung bình chỉ tăng chứ không giảm), không
 *     bao giờ kéo người nhất xuống dưới điểm họ tự chấm được.
 */

/**
 * TRẦN THEO VỊ TRÍ — chỉ số `THANG` (0=E- .. 19=SSS) cao nhất mà thứ hạng
 * `thuHang` (1 = nhất) trong bàn `soGhe` ghế được phép chạm. Xem khối
 * docstring D337 ngay trên cho vì sao dãn đều GOC..GOC+DOC.
 */
export function chuToiDaTheoThuHang(soGhe: number, thuHang: number): number {
  if (soGhe <= 1) return THANG.length - 1;
  return Math.floor(
    PC.TRAN_THU_HANG_GOC
    + (PC.TRAN_THU_HANG_DOC * (soGhe - thuHang)) / (soGhe - 1),
  );
}

/** Điểm (0..1000) cao nhất của một chỉ số `THANG` — biên TRÊN của đúng hạng đó. */
function diemToiDaCuaChiSo(chiSo: number): number {
  return chiSo >= THANG.length - 1 ? 1000 : THANG[chiSo + 1]!.tu - 1;
}

/**
 * KHOÁ THEO THỨ HẠNG — áp trần vị trí rồi PAV. Xem khối docstring D337 ở trên.
 *
 * `dong` PHẢI đã xếp theo thứ hạng (thứ hạng 1 trước) — mỗi phần tử tự mang
 * `thu_hang` CỦA NÓ nên `dong` được phép là một DÃY CON (ghế chưa có vòng nào
 * không vào đây — xem chỗ gọi `phongCachCaBan` trong `holdem_api.ts`); `soGhe`
 * là TỔNG số ghế thật của bàn (kể cả ghế không có mặt trong `dong`), vì trần
 * tính theo VỊ TRÍ THẬT trong bàn, không theo độ dài `dong`. Trả điểm khoá
 * CÙNG THỨ TỰ với `dong`.
 */
export function khoaTheoThuHang(
  dong: readonly { thu_hang: number; diem: number }[],
  soGhe: number,
): number[] {
  const sauTran = dong.map((d) => Math.min(
    d.diem, diemToiDaCuaChiSo(chuToiDaTheoThuHang(soGhe, d.thu_hang)),
  ));
  // PAV — ngăn xếp các khối {tổng, cỡ}; gộp NGƯỢC mỗi khi khối sau vi phạm
  // (trung bình cao hơn khối liền trước), so bằng trung bình CHÍNH XÁC sum/n.
  const khoi: { tong: number; n: number }[] = [];
  for (const d of sauTran) {
    let cur = { tong: d, n: 1 };
    while (
      khoi.length > 0
      && khoi[khoi.length - 1]!.tong / khoi[khoi.length - 1]!.n < cur.tong / cur.n
    ) {
      const truoc = khoi.pop()!;
      cur = { tong: truoc.tong + cur.tong, n: truoc.n + cur.n };
    }
    khoi.push(cur);
  }
  const ra: number[] = [];
  for (const k of khoi) {
    const gt = Math.round(k.tong / k.n);
    for (let i = 0; i < k.n; i += 1) ra.push(gt);
  }
  return ra;
}
