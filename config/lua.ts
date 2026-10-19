/**
 * ═══ NGỌN LỬA ĐÀ ("lửa momentum") — cổng `lua` · `luaPhi` · `luaQuyetToan` · `luaMuaDuoi`, khoá `balance-v55-build` ═══
 *
 * Đặc tả founder 23/09 (`docs/thiet-ke-de-xuat/gameplay/cai-tien-du-dinh.md` §1.3), chốt 25/09 (câu 1·2 của bản kiến trúc
 * `kien-truc-cai-tien-alpha-draft.md` §8):
 *   · TÍCH/DẬP THEO NGƯỜI CHƠI: giữ cùng "bias" (nhóm tài sản chính đang ôm) qua từng vòng thì chuỗi +1; đổi bias ·
 *     đổi tay quá lớn · Mua Đuổi muộn thì DẬP. Thị trường đảo KHÔNG dập — nó làm THIỆT HƠN qua mắt xích lửa
 *     (chữ founder: *"đang over-confident — điểm giống đời"*).
 *   · Vòng không có vị thế (toàn tiền mặt / trong sổ tiết kiệm): bias `null` ⇒ không tích, không dập.
 *   · Tác dụng: lửa cao ⇒ trượt giá giảm (`luaPhi`); lãi của mã được cộng thêm, lỗ bị trừ thêm — đảo NẶNG hơn thuận
 *     (`luaQuyetToan`); Mua Đuổi đúng lúc đẩy chuỗi +1, muộn/FOMO thì không đếm và trượt cao hơn (`luaMuaDuoi`).
 *   · Xu: mỗi vòng kết thúc ở nấc n ⇒ +n xu; lõi phát huy (mắt xích của lõi dương) ⇒ +1 xu mỗi lõi (`nhiemVuLoi`).
 *     Xu chỉ để CUỘN LẠI chợ trait (`config/trait.ts`), không bao giờ đổi ra T/Q (A3.5).
 *
 * ─── SỐ ĐO KHI THIẾT KẾ (25/09, `scripts/_khaosat_lua.ts 4000 16`, v54) ───────────────────────────────────────────
 *   lối ôm LÊN thụ động chạm chuỗi ≥ 4 ở 93% số trận (v53: 70%) ⇒ với ngưỡng 1/2/4 lửa BÃO HOÀ; cái giữ cân bằng là
 *   GIÁ của lửa (đảo > thuận) + gate G7 (xu không chảy về ghế ngồi im). Số ở đây là điểm khởi đầu.
 *
 * ⚠ A8.2 — MỌI SỐ dưới đây là PLAYTEST-TUNE: đổi số = chạy gate (`npm run gate -- 12000 5 16 balance-v55-build`) rồi
 *   trình founder. Bảng CHỈ được đọc qua `server/holdem/lua.ts` — không bản sao (A11.5).
 */

export const LUA = {
  /** Nấc 0 TÀN · 1 · 2 · 3 BÙNG. Nấc 4 "khoá, cần lá/vai" để dành — chưa cơ chế nào mở. */
  NAC_TOI_DA: 3,
  /** Chuỗi vòng giữ bias để lên nấc 1 · 2 · 3 (mặc định nấc 3 cần 4 vòng — founder §1.3). */
  VONG_LEN_NAC: [1, 2, 4] as const,
  /** Lõi Mua Đuổi hạ điều kiện lên nấc 3: 1 lõi ⇒ 3 vòng · ≥ 2 lõi ⇒ 2 vòng (founder §1.3). */
  VONG_LEN_NAC3_THEO_LOI_MUA_DUOI: { 1: 3, 2: 2 } as Readonly<Record<number, number>>,
  /** Từ bấy nhiêu lõi Mua Đuổi thì lửa thành LỬA ĐẶC BIỆT (xanh → tím) — chỉ đổi HÌNH, không đổi số. */
  LOI_MUA_DUOI_DAC_BIET: 2,
  /**
   * Ngưỡng có "bias": tổng vị thế (dài + khống) ≥ ngưỡng này của NAV. Dưới ⇒ bias `null` ⇒ vòng không đếm.
   * ⚠ Không phải thưởng phơi nhiễm (§1.2): dưới ngưỡng lửa ĐỨNG YÊN, không tắt.
   */
  NGUONG_VI_THE_BP: 2000,
  /** ĐỔI TAY quá lớn ⇒ dập: (tiền BÁN + tiền MUA vào nhóm KHÁC bias) ≥ ngưỡng này của NAV đầu vòng. */
  NGUONG_DOI_TAY_BP: 5000,
  /** GIỮ NHIỆT (trait): dập chỉ hạ bấy nhiêu nấc thay vì về 0. */
  GIU_NHIET_HA_NAC: 1,
  /** Hệ số TRƯỢT GIÁ theo nấc (10000 = ×1) — cổng `luaPhi`. */
  HE_SO_TRUOT_BP: [10000, 9000, 8000, 7000] as const,
  /**
   * Mắt xích lửa (cổng `luaQuyetToan`), tính THEO MÃ trên phần giá của mã ấy trong vòng: lãi ⇒ cộng thêm
   * HE_SO_THUAN[nấc]; lỗ ⇒ trừ thêm HE_SO_DAO[nấc]. Đảo nặng hơn thuận có chủ ý — đó là giá của lửa.
   */
  HE_SO_THUAN_BP: [0, 300, 500, 800] as const,
  HE_SO_DAO_BP: [0, 600, 1000, 1600] as const,
  /**
   * Mua Đuổi (cổng `luaMuaDuoi`) — đọc chuỗi TĂNG của bàn từ máy sinh map (`run_huong`/`run_dai`, cùng thước
   * `nguong_chuoi` của chỉ số #2 FOMO — một nguồn, A11.5):
   *   · ĐÚNG LÚC: cầm lõi Mua Đuổi, MUA vào nhóm rủi ro khi chuỗi tăng còn NGẮN (dưới ngưỡng xác nhận) và lá lật ra
   *     mã ấy lãi ⇒ chuỗi lửa +1 thêm.
   *   · MUỘN (FOMO): MUA vào nhóm rủi ro khi chuỗi tăng ĐÃ xác nhận ⇒ vòng này chuỗi không đếm + trượt giá lệnh ×1,5.
   * ⚠ Đây là một CAN THIỆP lên đúng trục #2 đang đo — kho hành vi ghi `lua_dap = 'mua_duoi_muon'` để tách.
   */
  MUA_DUOI_MUON_TRUOT_X_BP: 15000,
  /** Xu nhận mỗi vòng theo nấc SAU khi cập nhật. */
  XU_THEO_NAC: [0, 1, 2, 3] as const,
  /** Xu cho mỗi lõi PHÁT HUY trong vòng (cổng `nhiemVuLoi`) — thay "nhiệm vụ kỳ ngộ" đã cắt (founder 25/09 câu 9: A và B). */
  XU_NHIEM_VU_LOI: 1,
  /** MÁY XU (trait): +1 xu mỗi vòng có lửa ≥ 1. */
  MAY_XU_THEM: 1,
} as const;

export type NacLua = 0 | 1 | 2 | 3;
/** Vì sao lửa bị dập ở vòng này — ghi vào dữ liệu để phân tích tách được từng can thiệp. */
export type LyDoDap = 'doi_bias' | 'doi_tay' | 'mua_duoi_muon';
/** Bias của một ghế: nhóm tài sản chiếm phần lớn vị thế dài, `khong` khi ròng bán khống, `null` khi chưa đủ vị thế. */
export type BiasLua = 'rui_ro' | 'phong_thu' | 'khong' | null;
