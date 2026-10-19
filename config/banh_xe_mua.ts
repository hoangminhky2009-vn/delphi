/**
 * ═══ BÁNH XE MÙA CÓ NGÃ RẼ (D389 — cổng `banhXe`, balance-v54-ngare) ═══════════════════
 *
 * Founder 22/09: *"chơi loạn v**, chẳng thấy rõ chu kỳ nào"* → 23/09: *"Cần chốt luôn cơ chế
 * tạo seed… để game không thành 1 đống ngẫu nhiên mà thật sự mô phỏng được chu kỳ kinh tế rõ
 * ràng"* → bác bánh xe một đường (*"làm tuyến tính quá thì lại mất vui"*) → chốt
 * *"ok, ngã rẽ"* với lá pha hiện đúng mùa 80%.
 *
 * ─── CƠ CHẾ ──────────────────────────────────────────────────────────────────────────────
 * Chợ có một MÙA ẩn chạy theo đường chính PHỤC HỒI → TĂNG → QUÁ NÓNG (`bien_dong`) → SUY
 * THOÁI (`giam`) → PHỤC HỒI. Mỗi mùa dài tối thiểu `MIN_O` ô pha rồi mỗi ô có `HAZARD_BP` khả
 * năng sang mùa kế. Ở khúc chuyển, chợ có thể RẼ (bảng `NGA_RE`): hạ cánh mềm (QUÁ NÓNG quay
 * lại TĂNG) · đáy kép (PHỤC HỒI rơi lại SUY THOÁI) · đình trệ (SUY THOÁI sang ĐI NGANG rồi mới
 * phục hồi). Tin THẬT đẩy nhanh hay đổi ngã rẽ; tin giả không đẩy được gì (luật telegraph).
 * Bánh xe CHỈ quay trên ô pha — ô tin đóng băng, đúng luật chuỗi đã có ("tin tức không phải giá").
 * Lá pha hiện đúng mùa `TROI_BP`; phần còn lại là mặt lệch (`MAT_LECH`) — nhịp nghỉ, cú điều
 * chỉnh giữa mùa tăng, cú hồi giữa mùa giảm.
 *
 * ─── THANG ───────────────────────────────────────────────────────────────────────────────
 * 1 ô = 6 tháng, giữ thang D301 (`REGIME_TICK_THUC_TE`). Một vòng mùa ~12,7 ô ≈ 6,3 năm; bàn
 * 16 kể ~1,3 vòng.
 *
 * ─── SỐ ĐO KHI CHỐT (6.000 bàn 16, bản thử 23/09 — toàn văn transcript phiên 493e19bc) ──────
 *                                  máy v53    bánh xe ngã rẽ 80%
 *   bàn hiện trọn một vòng mùa         6%          28%
 *   sau SUY THOÁI là PHỤC HỒI         46%          81%
 *   ô ĐI NGANG                        33%          12%
 *   đoán đúng hướng lá sau (lịch sử)  52%          59%
 *   vòng "gần chắc" (≥ 80%)           0,7%         1,1%
 *   kiểu bàn: hạ cánh mềm 22% · đáy kép 17% · đình trệ 20% · sập giữa đường 25% · không suy thoái 11%
 *
 * ⚠ A8.2 — MỌI SỐ DƯỚI ĐÂY LÀ PLAYTEST-TUNE: số có nguồn là ĐỘ DÀI mùa (Fidelity · NBER) và
 * tần suất hạ cánh mềm (Blinder 2023); cộng/trừ theo tin là cơ chế của trò, không có nguồn
 * riêng. Đổi số = đo lại bằng `scripts/quet_chu_ky.ts` + gate G1–G5 bàn 16, rồi trình founder.
 * ⚠ Bảng này CHỈ được đọc qua `sinhMap` (server/holdem/map.ts) — không bản sao (A11.5).
 */
import type { GiaiDoanId, SuKienId, TinhChatPha } from './holdem.js';

/** Bốn mùa của đường chính, theo thứ tự quay. ĐI NGANG (đình trệ) chỉ tới qua ngã rẽ. */
export const MUA_CHINH: readonly GiaiDoanId[] = ['phuc_hoi', 'tang', 'bien_dong', 'giam'];

export const BANH_XE_MUA = {
  /** Lá pha hiện ĐÚNG mùa 8/10 ô (founder chốt 80%, 23/09 — bản thẳng 85% đoán được quá). */
  TROI_BP: 8000,
  /**
   * Độ dài mùa: tối thiểu `MIN_O` ô pha, sau đó mỗi ô `HAZARD_BP` khả năng sang mùa kế
   * (kỳ vọng ≈ MIN_O + (1 − h)/h ô).
   */
  MUA: {
    /** ~2 ô ≈ 1 năm — Fidelity: đầu chu kỳ (early cycle) ~1 năm. */
    phuc_hoi: { MIN_O: 1, HAZARD_BP: 5000 },
    /** ~6 ô ≈ 3 năm — Fidelity: giữa chu kỳ ~3 năm; NBER: mở rộng ngắn nhất 12 tháng = 2 ô. */
    tang: { MIN_O: 2, HAZARD_BP: 2000 },
    /** ~2,9 ô ≈ 1,5 năm — Fidelity: cuối chu kỳ (late cycle) ~18 tháng. */
    bien_dong: { MIN_O: 1, HAZARD_BP: 3500 },
    /** ~1,8 ô ≈ 11 tháng — NBER: co hẹp trung bình 10,3 tháng (1945–2020). */
    giam: { MIN_O: 1, HAZARD_BP: 5500 },
    /** ~2,5 ô — đình trệ: định tính (Nhật 1990s, VN-Index 2011–2013); chỉnh khi chơi thử. */
    di_ngang: { MIN_O: 1, HAZARD_BP: 4000 },
  } satisfies Record<GiaiDoanId, { MIN_O: number; HAZARD_BP: number }>,
  /** 20% ô còn lại: mặt LỆCH khỏi mùa, rút theo trọng số (mùa tự nó không nằm trong danh sách). */
  MAT_LECH: {
    phuc_hoi: [['tang', 5000], ['di_ngang', 5000]],
    tang: [['di_ngang', 6000], ['bien_dong', 4000]],
    bien_dong: [['tang', 5000], ['di_ngang', 3000], ['giam', 2000]],
    giam: [['bien_dong', 5000], ['di_ngang', 5000]],
    di_ngang: [['bien_dong', 6000], ['giam', 4000]],
  } satisfies Record<GiaiDoanId, readonly (readonly [GiaiDoanId, number])[]>,
  /**
   * Cộng vào hazard của mùa: tin THẬT vừa nổ báo ngược mùa (mùa lên gặp tin báo giảm/biến
   * động; mùa xuống gặp tin báo tăng) · môi trường tiền tệ ngược mùa (lãi đắt giữa mùa lên,
   * lãi rẻ giữa mùa xuống) · sức căng của mùa lên (chiết khấu như `HAZARD_CANG_BP` của D301).
   */
  HAZARD_TIN_BP: 2500,
  HAZARD_MOI_TRUONG_BP: 800,
  HAZARD_CANG_BP: 1500,
  /** Trần hazard: 100% là định đoạt — phạm "nghiêng, không ép" (§3 addendum). */
  TRAN_HAZARD_BP: 9000,
  /**
   * CÚ SỐC — tin xấu THẬT giữa mùa PHỤC HỒI/TĂNG ⇒ rơi thẳng vào SUY THOÁI (kiểu sập vì COVID).
   * Tin xấu thường (báo giảm) 30% · lá đuôi/thiên nga đen hoặc sàn khoá rút tiền 60%.
   */
  SOC_BP: 3000,
  SOC_DUOI_BP: 6000,
  /** NGÃ RẼ ở khúc chuyển mùa. Cộng/trừ theo tin THẬT vừa nổ ngay trước ô pha. */
  NGA_RE: {
    /**
     * HẠ CÁNH MỀM: QUÁ NÓNG quay lại TĂNG thay vì SUY THOÁI. Blinder (2023): Fed siết 11 lần
     * từ 1965, hạ cánh mềm 1–5 lần tuỳ định nghĩa ⇒ ~30%.
     */
    HA_CANH_MEM_BP: 3000,
    /** + hạ lãi THẬT vừa nổ (ngân hàng trung ương cứu kịp). */
    HA_CANH_MEM_HA_LAI_BP: 2000,
    /** − tin xấu THẬT vừa nổ. */
    HA_CANH_MEM_TIN_XAU_BP: 1500,
    /** ĐÁY KÉP: PHỤC HỒI rơi lại SUY THOÁI. NBER: 1980–82 là một trong 11 lần suy thoái sau Thế chiến. */
    DAY_KEP_BP: 1500,
    /** + tin xấu THẬT vừa nổ. */
    DAY_KEP_TIN_XAU_BP: 2500,
    /** ĐÌNH TRỆ: SUY THOÁI sang ĐI NGANG vài ô rồi mới phục hồi (định tính — chỉnh khi chơi thử). */
    DINH_TRE_BP: 2500,
    /** − tin tốt THẬT vừa nổ. */
    DINH_TRE_TIN_TOT_BP: 1500,
    /** Trần xác suất một ngã rẽ. */
    TRAN_BP: 9000,
  },

  /*
   * ═══ D397 — CHU KỲ CÓ TUỔI (cổng `muaDinhHan` + `tinTheoMua`, chỉ v54) ═══════════════════
   * Founder 24/09: *"chu kỳ có thể là tăng trưởng dài/ suy thoái… nhưng nó phải có tính liên kết rõ
   * ràng chứ không được ngẫu nhiên kiểu markov 100%"*. Đo trên 8.000 bàn 16: mặt lá v54 KHÔNG phân
   * biệt được với một markov bậc 1 cùng ma trận chuyển (khúc dài nhất 5,32 vs 5,38 · đổi chiều 1,94 vs
   * 1,94), biết thêm "mùa đã kéo bao lâu, khúc trước đi hướng nào" chỉ đoán lá sau tốt hơn +0,6 điểm,
   * và tin phá sản/lạm phát/cạn thanh khoản rơi vào mọi mùa gần như đều. Gốc: `HAZARD_BP` tung đồng
   * xu CỐ ĐỊNH mỗi ô ⇒ mùa "không có tuổi" (ô thứ 6 của đợt tăng trưởng hết dễ như ô thứ 2).
   * ⚠ A8.2 — mọi số dưới là PLAYTEST-TUNE: trung bình mỗi khoảng ≈ độ dài kỳ vọng của bản hazard ở
   * trên (cùng nguồn Fidelity · NBER), chỉ đổi HÌNH DẠNG phân phối. Số đo + gate ở D397.
   */
  /**
   * Độ dài mùa RÚT SẴN lúc vào mùa, đều trong [từ, đến] ô pha; hết hạn thì sang mùa kế (ngã rẽ giữ
   * nguyên `NGA_RE`). Thay cho `MIN_O` + `HAZARD_BP` khi cờ `muaDinhHan` bật.
   */
  /**
   * ═══ D560 — CHU KỲ CÓ NGÒI (cổng `chuKyCoNgoi`) ═══════════════════════════════════════════
   * Founder 08/10: *"bình thường tăng xong mà ko có sự kiện bất ngờ gì thì nó thường đi ngang tích lũy hoặc giảm nhẹ chứ có đùng phát
   * chuyển sang bear đâu"* + đi ngang có tính chất (Wyckoff). Đường chính thành PHỤC HỒI → TĂNG → QUÁ NÓNG → PHÂN PHỐI (đi ngang) →
   * SUY THOÁI → TÍCH LŨY (đi ngang) → PHỤC HỒI. Không còn QUÁ NÓNG → SUY THOÁI thiếu ngòi: suy thoái chỉ tới sau PHÂN PHỐI (đã hiện lá)
   * hoặc qua CÚ SỐC (tin xấu thật), cú sốc nay áp cả mùa Quá nóng / Phân phối / Tích lũy.
   * ⚠ A8.2 — mọi số PLAYTEST-TUNE; đo bằng script D559 + `scripts/quet_chu_ky.ts` rồi trình founder.
   */
  CO_NGOI: {
    /** Độ dài (ô pha) theo LOẠI mùa — rút đều như `HAN`; loại vắng ở đây ⇒ `HAN` của mùa. */
    HAN: {
      phan_phoi: [1, 2], tich_luy: [1, 2],
      dong_tien: [3, 5], tang_truong: [5, 8],
      gau_su_kien: [1, 1], gau_dinh_gia: [2, 3], gau_chu_ky: [2, 4],
    } as Record<TinhChatPha, readonly [number, number]>,
    /** Gấu SỰ KIỆN hết: khả năng hồi thẳng PHỤC HỒI (bỏ qua tích lũy) — "rơi thảm nhưng hồi nhanh nhất". */
    SU_KIEN_HOI_THANG_BP: 6000,
    /** Bò DÒNG TIỀN gặp tăng lãi THẬT: rút hạn thêm chừng này ô (bò dòng tiền gãy khi siết tiền). */
    DONG_TIEN_SIET_O: 2,
    /** Hết PHÂN PHỐI: khả năng chợ hấp thụ được nguồn cung, tăng lại (thay vì phá xuống). + tin tốt thật vừa nổ. */
    PHAN_PHOI_LEN_BP: 2000, PHAN_PHOI_LEN_TIN_TOT_BP: 2000,
    /** Hết TÍCH LŨY: khả năng thủng đáy lần nữa (đáy kép) thay vì phá lên. + tin xấu thật vừa nổ. */
    TICH_LUY_ROI_BP: 1500, TICH_LUY_ROI_TIN_XAU_BP: 2500,
    /** Mặt lệch theo mùa (20 % ô), khoá theo mùa con của đi ngang. QUÁ NÓNG thôi rút GIẢM (giảm chỉ tới sau phân phối / ngòi). */
    MAT_LECH: {
      phuc_hoi: [['di_ngang', 5000], ['giam', 5000]],
      tang: [['di_ngang', 6000], ['bien_dong', 4000]],
      bien_dong: [['tang', 5000], ['di_ngang', 5000]],
      phan_phoi: [['bien_dong', 5000], ['giam', 5000]],
      giam: [['phuc_hoi', 5000], ['di_ngang', 5000]],
      tich_luy: [['phuc_hoi', 6000], ['giam', 4000]],
    } as Record<'phuc_hoi' | 'tang' | 'bien_dong' | 'phan_phoi' | 'giam' | 'tich_luy', readonly (readonly [GiaiDoanId, number])[]>,
  },
  HAN: {
    phuc_hoi: [2, 3],
    tang: [4, 7],
    bien_dong: [2, 3],
    giam: [2, 3],
    di_ngang: [2, 3],
  } satisfies Record<GiaiDoanId, readonly [number, number]>,
  /*
   * (ghi chú, không phải số) Thứ còn lại của bản hazard ĐI TIẾP, dưới dạng RÚT NGẮN hạn còn lại 1 ô:
   * tin THẬT ngược mùa vừa nổ ⇒ chắc chắn −1 ô; môi trường tiền tệ ngược mùa ⇒ khả năng
   * `HAZARD_MOI_TRUONG_BP`; sức căng ⇒ khả năng như `HAZARD_CANG_BP`. Hạn không bao giờ dưới 1 ô.
   * Cú SỐC (`SOC_BP`/`SOC_DUOI_BP`) giữ nguyên: tin xấu thật giữa mùa lên vẫn quật thẳng xuống suy thoái.
   */
  /**
   * TIN NỘI SINH NGHIÊNG THEO MÙA ẨN (hệ số nhân trọng số rút tin, 10000 = ×1) — tin do chính chu kỳ đẻ
   * ra rơi đúng mùa của nó; tin NGOẠI SINH (chiến tranh · pháp lý · cấm vận · thảm hoạ · dịch bệnh)
   * không có dòng ở đây ⇒ ×1, vẫn tới bất ngờ và vẫn có thể quật gãy mùa (cú sốc).
   * "Nghiêng, không ép": không mùa nào đưa một tin về 0.
   */
  TIN_THEO_MUA: {
    phuc_hoi: { bong_bong: 3000, lam_phat: 3000, pha_san: 5000, hack_san: 5000, tang_lai_suat: 3000, ha_lai_suat: 10000 },
    tang: { bong_bong: 15000, lam_phat: 10000, pha_san: 3000, hack_san: 3000, tang_lai_suat: 12000, ha_lai_suat: 3000 },
    bien_dong: { bong_bong: 20000, lam_phat: 25000, pha_san: 12000, hack_san: 18000, tang_lai_suat: 20000, ha_lai_suat: 3000 },
    giam: { bong_bong: 1000, lam_phat: 3000, pha_san: 25000, hack_san: 20000, tang_lai_suat: 1000, ha_lai_suat: 20000 },
    di_ngang: { bong_bong: 5000, lam_phat: 8000, pha_san: 12000, hack_san: 10000, tang_lai_suat: 5000, ha_lai_suat: 15000 },
  } satisfies Record<GiaiDoanId, Partial<Record<SuKienId, number>>>,
} as const;
