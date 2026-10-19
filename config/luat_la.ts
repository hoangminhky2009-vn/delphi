/**
 * ═══ BỘ LUẬT TỪNG LÁ (D399 — cổng `luatLa`, balance-v54-ngare) ════════════════════════════════
 *
 * Founder 24/09: *"cần có 1 bộ luật quy định cho từng thẻ bài để không bị 'Vô lý' về mặt logic so với ngoài
 * đời thay vì thuần xác suất 100%… Nghĩa là vẫn là xác suất nhưng mỗi thẻ phải có 1 rule để không bị quá vô
 * lý với chuỗi trước/ sau"*. Duyệt cùng ngày ("Ngon. Vậy thi công") sau khi xem 12 luật thường thức đối chiếu
 * lịch sử nhiều thị trường và phép đo "bắt bài". Toàn văn cơ sở (vòng tín dụng · vòng lạm phát · hàm phản ứng
 * NHTW, từng ca lịch sử ủng hộ/phản chứng): `docs/nhat-ky/D399.md`.
 *
 * ─── HAI LOẠI LUẬT ────────────────────────────────────────────────────────────────────────────
 *   TIỀN ĐỀ (cứng) — lá chỉ ra khi chuỗi trước có đúng thứ đời thật cần. Chặn chuyện KHÔNG THỂ.
 *   HỆ QUẢ (mềm)   — một lá đã ra thì nghiêng các lá sau. Không chặn chuyện KHÔNG CHẮC.
 * Độ dài mùa, cú sốc, lá nào nói dối vẫn ngẫu nhiên như cũ ⇒ luật chặn THỨ TỰ vô lý, không làm lộ NHỊP. Cổng
 * `TRAN_BAT_BAI` dưới canh đúng điều đó: người thuộc lòng luật không được đoán lá kế quá dễ.
 *
 * ─── ĐỌC BẰNG CHỨNG ─────────────────────────────────────────────────────────────────────────
 * Tiền đề đọc TIN THẬT (tin giả không làm vỡ bong bóng thật — cùng luật telegraph: bánh xe chỉ nghe tin thật)
 * và MẶT LÁ PHA đã lật. Luật áp cho LÁ được rút, kể cả khi lá ấy sau đó hoá tin giả: tin đồn cũng phải hợp
 * cảnh mới có người tin.
 *
 * ⚠ A8.2 — mọi SỐ dưới đây (cửa sổ ô, số lá nhiệt, hệ số hệ quả, tỷ lệ sai ngược chiều, trần bắt bài) là
 *   PLAYTEST-TUNE. Đổi số = đo lại bằng `scripts/kiem_bo_luat_la.ts` + gate G1–G5 bàn 16, rồi trình founder.
 * ⚠ Bảng này CHỈ được đọc qua `server/holdem/luat_la.ts` + `sinhMap` — không bản sao (A11.5).
 */
import { doThamSo, type GiaiDoanId, type SuKienId } from './holdem.js';

/**
 * Một bằng chứng trong chuỗi trước: một TIN THẬT mang đúng id này, hoặc `hoang_loan` = bất kỳ tin thật nào có
 * tính chất hoảng loạn trong `TINH_CHAT_NEN` (một nguồn — thêm lá hoảng loạn mới là tự vào nhóm).
 */
export type BangChung = SuKienId | 'hoang_loan';

/** Tiền đề của một lá TIN: ở các mùa ẩn `mua`, `trong_o` ô liền trước phải có ít nhất một bằng chứng `can`. */
export interface LuatTin {
  readonly mua: readonly GiaiDoanId[];
  readonly can: readonly BangChung[];
  readonly trong_o: number;
}

/** Hệ quả của một lần kỳ họp đi NGƯỢC hàm phản ứng. */
export interface HeQuaSaiLam {
  /** Nhân trọng số rút của các lá này trong `TRONG_O` ô sau kỳ họp (10000 = ×1). */
  readonly TIN_X_BP: Partial<Record<SuKienId, number>>;
  readonly TRONG_O: number;
  /** Mùa ẩn đang là một trong các mùa này thì kéo dài thêm `KEO_DAI_O` ô pha. */
  readonly KEO_DAI_MUA: readonly GiaiDoanId[];
  readonly KEO_DAI_O: number;
}

export const LUAT_LA = {
  /**
   * MẶT LỆCH theo NGHĨA (thay `BANH_XE_MUA.MAT_LECH` khi cổng bật; tỷ lệ 80/20 `TROI_BP` GIỮ NGUYÊN).
   * Mặt lệch = nhịp ngược NGẮN của chính mùa đó, không phải mặt của mùa ở đầu kia bánh xe. Đo trước: 66% chỗ vô
   * lý của bàn v54 đến từ bảng cũ — nó dùng ô `bien_dong` làm "cú hồi giữa mùa giảm" từ thời mặt ấy còn tên
   * "Biến động mạnh"; D393 vẽ lá thành QUÁ NÓNG ⇒ "suy thoái mà quá nóng".
   *   · Suy thoái/đình trệ: PHỤC HỒI GIẢ — cú hồi trong lòng thị trường giảm là có thật và là cái bẫy kinh điển
   *     (VN-Index 6–8/2008 366 → ~540 rồi thủng 235; S&P 500 11/2008 → 1/2009 +24% rồi đáy mới; Dow 11/1929 →
   *     4/1930 +48% rồi mất thêm 86%).
   *   · Phục hồi: GIẢM = thử lại đáy (thay TĂNG — "PHỤC → TĂNG → PHỤC" đọc thành "hồi phục từ cái gì?").
   */
  MAT_LECH: {
    phuc_hoi: [['di_ngang', 5000], ['giam', 5000]],
    tang: [['di_ngang', 6000], ['bien_dong', 4000]],
    bien_dong: [['tang', 5000], ['di_ngang', 3000], ['giam', 2000]],
    giam: [['phuc_hoi', 5000], ['di_ngang', 5000]],
    di_ngang: [['phuc_hoi', 6000], ['giam', 4000]],
  } satisfies Record<GiaiDoanId, readonly (readonly [GiaiDoanId, number])[]>,

  /*
   * ─── LÁ PHA — TIỀN ĐỀ ───────────────────────────────────────────────────────────────────────
   * Rút phải mặt lệch phạm luật ⇒ mặt lệch khác của mùa (giữ đúng 20% nhiễu); hết ⇒ mặt thật. Mặt thật phạm ⇒
   * đi theo `THAY` tới mặt hợp lệ đầu tiên (GIẢM và ĐI NGANG không có tiền đề).
   */
  /**
   * PHỤC HỒI cần một ĐÁY: từ lá TĂNG/QUÁ NÓNG gần nhất tới giờ phải có lá GIẢM hoặc một tin khủng hoảng THẬT.
   * Phục hồi đo từ đáy chu kỳ (NBER đo từ trough) — không đáy thì không có gì để hồi. Bàn chưa lật lá lên nào
   * thì coi như đã có đáy (bàn mở giữa chu kỳ).
   */
  DAY: { TIN: ['hoang_loan', 'hack_san'] as readonly BangChung[] },
  /**
   * QUÁ NÓNG cần NHIỆT: từ lá GIẢM/PHỤC HỒI gần nhất có ≥ `SO_LA` lá TĂNG/QUÁ NÓNG; tiền rẻ/bong bóng/lạm phát
   * THẬT trong `TRONG_O` ô gần đây rút khởi động xuống `SO_LA_KHI_CO_TIN` lá — rút ngắn, không cho nhảy thẳng từ
   * GIẢM sang QUÁ NÓNG (đo khi thi công: cho nhảy thẳng thì còn 172 ca "vừa sập đã quá nóng" / 6.000 bàn). Quá
   * nóng = kinh tế đã chạy hết công suất — sau suy thoái phải mất nhiều năm (Mỹ 2009 → 2018, 1991 → 1999, 1982 →
   * 1988); ngoại lệ 2020 → 2021 và VN 2009 → 2011 đều đi sau bơm tiền khổng lồ, tức đúng cửa "tiền rẻ" — và cả hai
   * vẫn có một đợt tăng trước khi nóng. Bàn mở giữa cơn tăng (chưa lật GIẢM/PHỤC HỒI nào) thì coi như đã có nhiệt.
   */
  NHIET: {
    SO_LA: 2, SO_LA_KHI_CO_TIN: 1, TIN: ['ha_lai_suat', 'bong_bong', 'lam_phat'] as readonly BangChung[], TRONG_O: 4,
  },
  /**
   * Sau khủng hoảng TÀI CHÍNH thật (phá sản · sàn khoá rút tiền), lá pha KẾ không được là TĂNG/QUÁ NÓNG.
   * Cú sốc NGOẠI SINH thì được (9/11: −11,6% một tuần rồi lấy lại sau ~1 tháng; Brexit: đỉnh mới sau 2 tuần);
   * khủng hoảng tài chính thì không (Lehman 9/2008: Fed hạ lãi ngay tháng 10 mà S&P vẫn mất thêm ~45%). Luật cấm
   * hai ô tin liền nhau nên không có chỗ cho một lá cứu chen vào giữa — lá pha kế luôn là phản ứng đầu tiên.
   * Chế độ bong bóng (lá pha rút bằng máy cũ) không cần luật riêng: nó không rút tin, và lá điềm báo ép luôn đứng
   * sát sau lần đổi lãi suất nên không lọt vào giữa một bong bóng — đo 100.000 bàn khi thi công: 0 ca.
   */
  KHUNG_HOANG_TAI_CHINH: ['pha_san', 'hack_san'] as readonly BangChung[],
  /**
   * v57 (D470, cổng `canSauKhung`) — CẠN THANH KHOẢN (`hack_san`) Ở MỌI MÙA chỉ sau cú sốc: founder 04/10 *"thẻ cạn thanh khoản chỉ xuất hiện
   * sau thiên nga đen hoặc g chuỗi bear dài. Còn bình thường vẫn có khả năng cạn thanh khoản nhưng ít hơn"* (vế sau = cạn TRONG MÀN minigame
   * theo nấc thanh khoản của vòng, không phải lá). Mở rộng luật 24/09 (dòng `TIN.hack_san` — chỉ mùa lành) ra cả mùa xấu, thêm nhánh CHUỖI
   * GIẢM: ≥ `CHUOI_GIAM` lá Giảm liên tiếp (lá tin xen giữa không cắt chuỗi — cùng quy ước `run_dai` của máy chu kỳ). Lịch sử: Lehman 9/2008
   * sau 11 tháng giảm · FTX 11/2022 sau cả năm giảm · Celsius 6/2022 sau Luna. Khoá ≤ v56 giữ luật 24/09 nguyên.
   * Bản đầu (chuỗi ≥ 3 · hoảng loạn ≤ 3 ô) chỉ 2,1 % số trận bàn 12 có lá — founder *"2% số trận hơi ít nhỉ"* ⇒ chọn B: chuỗi ≥ 2 · hoảng loạn
   * ≤ 5 ô ⇒ 6,7 % (hậu quả khủng hoảng kéo dài: Celsius 1 tháng sau Luna, Lehman 6 tháng sau Bear Stearns). PLAYTEST-TUNE.
   */
  CAN_SAU_KHUNG: { can: ['hoang_loan'] as readonly BangChung[], trong_o: 5, CHUOI_GIAM: doThamSo('LUAT_CAN_CHUOI_GIAM', 2) },

  /** Mặt thay khi mặt thật phạm tiền đề: PHỤC HỒI chưa có đáy ⇒ GIẢM (đáy lộ muộn); QUÁ NÓNG chưa đủ nhiệt ⇒ TĂNG. */
  THAY: { phuc_hoi: 'giam', bien_dong: 'tang', tang: 'giam' } as Partial<Record<GiaiDoanId, GiaiDoanId>>,

  /*
   * ─── LÁ TIN — TIỀN ĐỀ ───────────────────────────────────────────────────────────────────────
   * Ngoài các mùa ghi ở từng dòng, lá rút như cũ (bảng `TIN_THEO_MUA` của D397 vẫn nghiêng). Phạm ⇒ trọng số 0.
   * Lá lãi suất ở đây chỉ là lá rút NGOÀI kỳ họp — kỳ họp đi đường riêng (`SAI_LAM` dưới).
   */
  TIN: {
    /**
     * SÀN KHOÁ RÚT TIỀN giữa mùa lành chỉ sau cú sốc thật — luật của founder 24/09: *"Cạn thanh khoản có thể xảy
     * ra giữa bull nhưng chỉ là khi thiên nga đen xảy ra khiến bong bóng nổ rồi kéo theo cạn thanh khoản chứ"*.
     * Khớp lịch sử: Mt. Gox 2/2014 (sau bong bóng BTC + lệnh cấm của NHTW Trung Quốc) · Celsius 6/2022 (sau Luna)
     * · ACB 8/2012, SCB 10/2022 (ngay sau các vụ bắt giữ). Rút tiền vì tin đồn chỉ xảy ra khi bảng cân đối đã yếu
     * (Diamond–Dybvig 1983) ⇒ đè luật v28 "tin giả lộ ⇒ sập sàn" ở mùa lành.
     */
    hack_san: { mua: ['tang', 'phuc_hoi'], can: ['hoang_loan'], trong_o: 3 },
    /**
     * PHÁ SẢN DÂY CHUYỀN = đòn bẩy + ngòi nổ (giảm phát nợ — Fisher 1933). Các ca lớn đều có ngòi: Penn Central
     * 1970 · Thái Lan 1997 · Nhật 11/1997 · Lehman 2008 · Evergrande 2021 · VN 2022–23. Hạ lãi thật cũng là khói
     * (cắt khẩn = NHTW thấy thứ chợ chưa thấy — đúng điềm báo §4.3); phá sản trước là ngòi của phá sản sau.
     */
    pha_san: {
      mua: ['tang', 'phuc_hoi'],
      can: ['tang_lai_suat', 'hack_san', 'bong_bong', 'ha_lai_suat', 'hoang_loan'],
      trong_o: 4,
    },
    /** BONG BÓNG giữa suy thoái chỉ sau tiền rẻ (Trung Quốc 2014–15 · cơn sốt 2020 đều bắt đầu sau hạ lãi). */
    bong_bong: { mua: ['giam'], can: ['ha_lai_suat'], trong_o: 4 },
    /**
     * LẠM PHÁT giữa suy thoái = lạm phát đình trệ, luôn gọi tên được nguyên nhân: cú sốc cung (cấm vận dầu 1973 ·
     * Iran 1979 · Ukraine 2022), tiền rẻ, hoặc vốn tháo chạy → tiền mất giá (Mexico 1995 · Indonesia, Nga 1998).
     */
    lam_phat: {
      mua: ['giam'],
      can: ['chien_tranh', 'cam_van', 'tham_hoa', 'ha_lai_suat', 'hack_san'],
      trong_o: 4,
    },
    /**
     * TĂNG LÃI (ngoài kỳ họp) giữa suy thoái/đình trệ cần lý do: lạm phát/cú sốc cung (ECB 7/2008 · Brazil 2015 ·
     * SBV 6/2008), giữ tỷ giá khi vốn tháo chạy (Anh, Thuỵ Điển 9/1992 · Nga 12/2014), hoặc lo bong bóng
     * (Riksbank 2010–11).
     */
    tang_lai_suat: {
      mua: ['giam', 'di_ngang'],
      can: ['lam_phat', 'chien_tranh', 'cam_van', 'tham_hoa', 'hack_san', 'bong_bong'],
      trong_o: 4,
    },
    /** HẠ LÃI (ngoài kỳ họp) giữa mùa quá nóng chỉ khi có khủng hoảng (Fed 1998 sau LTCM). */
    ha_lai_suat: { mua: ['bien_dong'], can: ['hoang_loan', 'hack_san'], trong_o: 3 },
  } satisfies Partial<Record<SuKienId, LuatTin>>,
  /**
   * LÃI SUẤT ĐẢO CHIỀU (lá rút ngoài kỳ họp, mọi mùa): đi ngược lần đổi lãi suất THẬT gần nhất thì ở giữa phải
   * có lý do. Mọi cú đảo chiều nhanh ngoài đời đều có cò: ECB 7 → 10/2008 (Lehman) · ECB 7 → 11/2011 (nợ công
   * Ý–Tây Ban Nha) · Fed 12/2018 → 7/2019 (chợ −19,8% + chiến tranh thương mại) · SBV 6 → 10/2008. Tăng lại sau
   * khi hạ còn một lý do nữa: tăng trưởng đã vững (Fed 1994 đánh phủ đầu, 2015–18 bình thường hoá).
   */
  DAO_CHIEU: {
    ha_lai_suat: { tin: ['hoang_loan', 'hack_san'] as readonly BangChung[], mat: ['giam'] as readonly GiaiDoanId[], so_la_tang: 0 },
    tang_lai_suat: {
      tin: ['lam_phat', 'bong_bong', 'chien_tranh', 'cam_van', 'tham_hoa'] as readonly BangChung[],
      mat: ['bien_dong'] as readonly GiaiDoanId[],
      so_la_tang: 2,
    },
  },
  /**
   * Bảng cũ cấm bong bóng ngay sau lá GIẢM (`SU_KIEN_THEO_GIAI_DOAN`, hệ số 0). Có tiền rẻ THẬT gần đây thì mở —
   * cùng lý lẽ dòng `TIN.bong_bong`.
   */
  BONG_BONG_SAU_GIAM_KHI_TIEN_RE: { TIN: ['ha_lai_suat'] as readonly BangChung[], TRONG_O: 4 },

  /*
   * ─── KỲ HỌP — SAI LẦM CHÍNH SÁCH ─────────────────────────────────────────────────────────────
   * Tỷ lệ sai 15% (`LICH_CHINH_SACH.TY_LE_SAI_LAM_BP`) GIỮ NGUYÊN. Đổi CÁCH sai: ngoài đời sai lầm phổ biến là
   * CHẬM NHỊP — giữ khi lẽ ra phải đổi (Fed 2007; Fed 2021 "lạm phát nhất thời"); đi NGƯỢC chiều thì hiếm (Fed
   * 1936–37 · BOJ 8/2000 · ECB 2011 · Riksbank 2011; Fed 1927 · BOJ 1987 · Thổ Nhĩ Kỳ 2021). Và lần ngược chiều
   * nào ngoài đời cũng để lại hệ quả rồi phải quay đầu.
   */
  SAI_LAM: {
    /**
     * Khi hàm phản ứng đòi TĂNG/HẠ: phần NGƯỢC CHIỀU trong số lần sai; còn lại là GIỮ (chậm nhịp).
     * Khi hàm phản ứng đòi GIỮ mà sai: QUÁ TAY — đi tiếp hướng lần đổi lãi thật gần nhất ("một lần tăng quá tay":
     * ECB 7/2008, Fed 12/2018), không quay ngoắt. Chưa đổi lần nào thì rút một trong hai hướng như cũ. Đo khi thi
     * công: rút hai hướng như cũ còn 228 cú kỳ họp đảo chiều vô cớ / 6.000 bàn.
     */
    NGUOC_CHIEU_BP: 2000,
    /**
     * Hệ quả, theo hướng THỰC của lần sai ngược chiều:
     *   tang (siết khi lẽ ra phải nới) ⇒ phá sản dây chuyền + suy thoái kéo dài (Fed 1937 → suy thoái 1937–38;
     *     ECB 2011 → suy thoái 2012–13);
     *   ha (nới khi lẽ ra phải siết) ⇒ bong bóng/lạm phát + cơn nóng kéo dài (Fed 1927 → 1929; BOJ 1987 → Nikkei
     *     đỉnh cuối 1989; Fed 1998 → Nasdaq +86% năm 1999; Thổ 2021 → lạm phát 85%).
     */
    HE_QUA: {
      tang: { TIN_X_BP: { pha_san: 30000 }, TRONG_O: 4, KEO_DAI_MUA: ['giam', 'di_ngang'], KEO_DAI_O: 1 },
      ha: { TIN_X_BP: { bong_bong: 30000, lam_phat: 30000 }, TRONG_O: 4, KEO_DAI_MUA: ['tang', 'bien_dong'], KEO_DAI_O: 1 },
    } satisfies Record<'tang' | 'ha', HeQuaSaiLam>,
    /** Kỳ họp KẾ sau một lần sai ngược chiều không sai nữa — quay đầu sửa sai (ECB 11/2011 · BOJ 3/2001 · Riksbank 12/2011). */
    SUA_SAI: true,
  },

  /*
   * ─── CỔNG BẮT BÀI (founder chốt 24/09, phương án A) ─────────────────────────────────────────────
   * Người chơi "thuộc lòng luật" = bảng tần suất có điều kiện học trên nửa số bàn, đoán lá pha kế trên nửa kia,
   * chỉ bằng thứ người chơi thấy (`scripts/kiem_bo_luat_la.ts`). Đo khi chốt (6.000 bàn v54 trước bộ luật): đoán
   * trúng mặt 56,7% · vòng chắc ≥ 80% chiếm 6,9%. Trần = mức ấy + ~3 điểm.
   */
  TRAN_BAT_BAI: {
    /** Trần tỷ lệ đoán trúng MẶT lá pha kế. */
    DOAN_MAT_BP: 6000,
    /** Trần tỷ phần số vòng người thuộc luật chắc ≥ `NGUONG_CHAC_BP`. */
    VONG_CHAC_BP: 1000,
    NGUONG_CHAC_BP: 8000,
  },
} as const;
