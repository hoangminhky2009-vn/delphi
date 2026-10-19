/**
 * ═══ TRAIT — TÀI & TẬT (cổng `trait` · `traitVai` · `chanLoTrait`, khoá `balance-v55-build`) ═══════════════════════
 *
 * Founder 23/09 (đặc tả dán trong transcript 493e19bc, nguyên văn ở `cai-tien-du-dinh.md` §2) + chốt 25/09 (bản kiến
 * trúc §8, câu 3·4·5·9·10):
 *   · Trait KHÔNG phải lõi thứ hai: lõi = công cụ hành động TRONG vòng; trait = ràng buộc + định hướng style mang
 *     CẢ TRẬN. Trait chỉ được đổi ĐIỀU KIỆN BIÊN (trần chip, khoá hành động, lửa/trượt, thông tin, nhịp) — không bao
 *     giờ là nút bấm trong vòng, không đổi hướng thị trường hay xác suất lá, và KHÔNG trả thưởng cho mức phơi nhiễm /
 *     độ đa dạng / lượng tiền mặt (§1.2 — trục khẩu vị đang đo). Bài canh `tests/trait.test.ts` §ranh quét bảng này.
 *   · Chợ mở ở MỐC giữa hai vòng (`MOC_TRAIT`), mời 3 TÀI + 3 TẬT tổng điểm 0; lấy bao nhiêu tuỳ, nhưng phần lấy phải
 *     có TỔNG ĐIỂM ĐÚNG BẰNG 0 (founder 25/09: *"Phải bằng 0 chứ"*). Không ưng ⇒ cuộn lại bằng XU (giá tăng dần).
 *     Xu KHÔNG làm giá trait (founder 23/09: lệch build) — chỉ mua lượt cuộn.
 *   · Vai ngoài Cá nhân mang sẵn MỘT CẶP cố định, độc quyền theo vai (câu 5: A) — cặp ấy là luật vai đang có
 *     (`vaiCoRang`) được gọi tên, không viết lại cơ chế.
 *   · Chặn Lỗ thành cặp giới hạn lỗ / giới hạn lãi (câu 10: A): KỶ LUẬT (+2, sàn −25% phần lõi — đúng máy `chan_lo_san`
 *     của lá cũ) ↔ CHỐT NON (−2, trần +25% phần lõi — gương của sàn).
 *   · TÊ LIỆT = khoá lõi 2 vòng NGAY khi chọn; MẤT TRÍ = mất NGẪU NHIÊN 1 TÀI ở mốc kế (founder 23/09 sửa).
 *
 * ⚠ A8.2 — điểm và mọi số ở `THAM_SO` là PLAYTEST-TUNE. Đo bằng cặp trận song sinh (một điểm ≈ 0,1 hạng trung bình bot
 *   thường + bot biết trước — `docs/thiet-ke-de-xuat/gameplay/trait-v2.md` §1b).
 *
 * ─── VÒNG 3 (D422, founder 26/09) ─────────────────────────────────────────────────────────────────────────────────
 *   · KỶ LUẬT chọn B: sàn đỡ CẢ phần vay của Đòn Bẩy (cổng `kyLuatSauDonBay`), VẪN thu phí mỗi vòng, bán ở +5; CHỐT NON
 *     làm nặng tương xứng (trần cũng áp sau Đòn Bẩy), −5. Đo (1.200 cặp, D422): KỶ LUẬT phí 0,6 %/sàn −15 % ra +3,8
 *     (vai thường) · +5,1 (Cá Mập, có Đòn Bẩy); CHỐT NON trần +25 % ra −5,6.
 *   · LỬA GIẢ → MÙ LỬA (lửa luôn tắt, +2 xu mỗi vòng) · BÌNH TĨNH → KIÊN NHẪN (thưởng giữ mã) · BÁO TRỄ → NÓNG VỘI (ép
 *     bán mã giữ lâu) · MÙ TIN che lá TIN · SƯƠNG MÙ làm lá PHA hai mặt · thêm ĐI SAU ↔ LỘ LỆNH. Không lá nào còn đổi
 *     đồng hồ vòng (bàn nhiều người không chịu được, và bớt giờ chấm lẫn độ trễ máy với tính bốc đồng).
 * ⚠ Bảng CHỈ chở id + số; chữ ở client (`web/src/lib/trait_chu.ts`, D26). Đọc qua `server/holdem/trait.ts`.
 */
import type { VaiId } from '../server/holdem/vai.js';

export type TraitId =
  // TÀI (kho chung)
  | 'lenh_min' | 'tam_rong' | 'may_xu' | 'kien_nhan' | 'giu_nhiet' | 'ky_luat' | 'noi_gian' | 'sang_so' | 'di_sau'
  // TẬT (kho chung)
  | 'mu_tin' | 'mu_lua' | 'nong_voi' | 'suong_mu' | 'gong_cum' | 'mot_gio' | 'so_mong' | 'te_liet'
  | 'chot_non' | 'mat_tri' | 'lo_lenh'
  // CẶP CỦA VAI (độc quyền, mang sẵn từ đầu — luật vai đang có, gọi tên)
  | 'ghim_don_bay' | 'tac_dong_gia' | 'ghim_luot_song' | 'siet_phap_ly' | 'dong_tien' | 'uy_thac'
  // D482 — TRAIT GHIM của khung minigame (thay lõi ghim; cờ `traitGhimMinigame`)
  | 'don_bay_man' | 'tung_tin'
  // D498 — RẢI LỆNH ba cấp (độc quyền vai đặc biệt, một HỌ — lấy một cấp thì thôi chào các cấp khác)
  | 'rai_lenh_2' | 'rai_lenh_3' | 'rai_lenh_5'
  // D528 — khoá v59 (cờ `keLenhV59`): KÊ LỆNH hai chiều · TÂM LÝ YẾU (thay KỶ LUẬT) · SOI VAI (vai bị giấu trong trận)
  | 'ke_mua' | 'ke_ban' | 'tam_ly_yeu' | 'soi_vai';

export type LoaiTrait = 'tai' | 'tat';
/** Trục ảnh hưởng (founder §4 "mở rộng trục"): để bài canh đếm được trait không dồn hết vào lửa/trượt. */
export type TrucTrait =
  | 'von' | 'danh_muc' | 'thong_tin' | 'lua' | 'truot' | 'nhip' | 'ky_luat' | 'la' | 'trait' | 'thoi_han' | 'dam_dong';

export interface Trait {
  readonly id: TraitId;
  readonly loai: LoaiTrait;
  /** 1..5 — điểm dương cho TÀI, âm cho TẬT (dấu suy từ `loai`). Trần 5 một lá (founder 26/09). */
  readonly diem: 1 | 2 | 3 | 4 | 5;
  readonly truc: TrucTrait;
  /** Cặp cố định của vai — không nằm trong kho chung, không cuộn ra được. */
  readonly vai?: VaiId;
  /**
   * D498 — HỌ của trait nhiều cấp (founder 04/10: *"Pick 1 cái rồi thì ko còn được thấy những cái sau, tương tự với những trait nhiều level"*): đang
   * mang một lá của họ ⇒ chợ không chào lá nào khác cùng họ; một lượt mời có tối đa một lá mỗi họ.
   */
  readonly ho?: string;
  /** D498 — chỉ chào cho ghế mang một trong các vai này (trait ĐỘC QUYỀN trong kho, khác `vai` là cặp mang sẵn). Chỉ có ở kho hẹp (khoá có cờ). */
  readonly chiVai?: readonly VaiId[];
  /**
   * D528 — lá của khoá MỚI: chỉ chào khi khoá khai kho đích danh (`khoTraitCua` ≠ undefined). Kho chung của khoá cũ (≤ v56) dựng từ CẢ bảng
   * này, nên lá mới không cờ sẽ chen vào cú xáo ⇒ lượt mời trận cũ đổi ⇒ replay prod lệch (golden bắt 80 trận v56).
   */
  readonly chiKhoHep?: true;
}

export const TRAIT: readonly Trait[] = [
  // ── TÀI ──
  { id: 'lenh_min', loai: 'tai', diem: 1, truc: 'von' },        // thêm mốc 10% (lệnh nhỏ, trượt thấp)
  { id: 'tam_rong', loai: 'tai', diem: 1, truc: 'danh_muc' },   // giữ thêm 1 mã — chỉ CHO PHÉP, không thưởng
  { id: 'may_xu', loai: 'tai', diem: 1, truc: 'lua' },          // +1 xu mỗi vòng có lửa
  { id: 'kien_nhan', loai: 'tai', diem: 2, truc: 'thoi_han' },  // mã giữ liền ≥ 3 vòng: phần LÃI của mã +10%
  { id: 'sang_so', loai: 'tai', diem: 1, truc: 'thong_tin' },   // thấy nấc thanh khoản THẬT của mã đầu cơ (hết sương mù)
  { id: 'giu_nhiet', loai: 'tai', diem: 2, truc: 'lua' },       // dập chỉ hạ 1 nấc, không tắt
  { id: 'ky_luat', loai: 'tai', diem: 5, truc: 'ky_luat' },     // sàn lỗ mỗi vòng, đỡ cả phần vay (D422)
  { id: 'noi_gian', loai: 'tai', diem: 2, truc: 'thong_tin' },  // biết trước LOẠI (pha/tin) của 2 lá kế
  { id: 'di_sau', loai: 'tai', diem: 2, truc: 'dam_dong' },     // thấy dòng lệnh vòng này của cả bàn trước khi chốt
  // ── TẬT ──
  // D425 — CẤM TẤT TAY gộp vào GÔNG CÙM: lá riêng chỉ chạm bot "Tất tay" và đo ra GIÚP nó (+0,5, trait-v2 §1c).
  { id: 'mu_tin', loai: 'tat', diem: 4, truc: 'thong_tin' },    // lá TIN lật ra bị che NGẪU NHIÊN, chỉ thấy mã tăng/giảm (tier 4)
  { id: 'mu_lua', loai: 'tat', diem: 3, truc: 'lua' },          // lửa luôn tắt, +2 xu mỗi vòng
  { id: 'nong_voi', loai: 'tat', diem: 2, truc: 'thoi_han' },   // mã giữ liền quá 3 vòng: phần LÃI của mã bị cắt 25%
  { id: 'suong_mu', loai: 'tat', diem: 1, truc: 'thong_tin' },  // lá PHA mới lật hiện hai mặt tới vòng sau
  { id: 'gong_cum', loai: 'tat', diem: 2, truc: 'von' },        // mỗi vòng BÁN tối đa 40% NAV — làm kẹt (D425)
  { id: 'mot_gio', loai: 'tat', diem: 2, truc: 'danh_muc' },    // tối đa 2 mã
  { id: 'so_mong', loai: 'tat', diem: 2, truc: 'truot' },       // phí CỐ ĐỊNH mỗi lệnh — phạt ra vào liên tục (D425)
  { id: 'te_liet', loai: 'tat', diem: 2, truc: 'la' },          // khoá lõi 2 vòng ngay khi chọn
  { id: 'chot_non', loai: 'tat', diem: 5, truc: 'ky_luat' },    // trần lãi mỗi vòng, cắt cả phần vay (D422)
  { id: 'mat_tri', loai: 'tat', diem: 2, truc: 'trait' },       // mốc kế mất ngẫu nhiên 1 TÀI
  { id: 'lo_lenh', loai: 'tat', diem: 2, truc: 'dam_dong' },    // khớp sau cả bàn: chen chúc của mình ×1,1
  // ── CẶP CỦA VAI (luật `vaiCoRang` đang chạy, gọi tên) ──
  { id: 'ghim_don_bay', loai: 'tai', diem: 2, truc: 'la', vai: 'ca_map' },
  { id: 'tac_dong_gia', loai: 'tat', diem: 2, truc: 'truot', vai: 'ca_map' },
  { id: 'ghim_luot_song', loai: 'tai', diem: 3, truc: 'thong_tin', vai: 'doi_lai' },
  { id: 'siet_phap_ly', loai: 'tat', diem: 3, truc: 'ky_luat', vai: 'doi_lai' },
  { id: 'dong_tien', loai: 'tai', diem: 2, truc: 'thong_tin', vai: 'to_chuc' },
  { id: 'uy_thac', loai: 'tat', diem: 2, truc: 'von', vai: 'to_chuc' },
  // ── D482 — TRAIT GHIM CỦA KHUNG MINIGAME (thay lõi ghim; founder 04/10 *"Bỏ lõi ghim, đổi thành trait ghim"*) ──
  { id: 'don_bay_man', loai: 'tai', diem: 2, truc: 'von', vai: 'ca_map' },      // khoản theo lệnh trong màn ×`HE_DON_BAY_VAI`
  { id: 'tung_tin', loai: 'tai', diem: 3, truc: 'dam_dong', vai: 'doi_lai' },   // gài một tin giả đầu màn — đám đông đẩy giá tạm rồi tan
  // ── D498 — RẢI LỆNH ba cấp (founder 04/10: *"lv +2, +3 và +5 … chia phần giá bị đẩy/bơm vào 2 nến, 3 nến, 5 nến"*), ĐỘC QUYỀN vai đặc biệt ──
  { id: 'rai_lenh_2', loai: 'tai', diem: 2, truc: 'truot', ho: 'rai_lenh', chiVai: ['ca_map', 'doi_lai', 'to_chuc'] },
  { id: 'rai_lenh_3', loai: 'tai', diem: 3, truc: 'truot', ho: 'rai_lenh', chiVai: ['ca_map', 'doi_lai', 'to_chuc'] },
  { id: 'rai_lenh_5', loai: 'tai', diem: 5, truc: 'truot', ho: 'rai_lenh', chiVai: ['ca_map', 'doi_lai', 'to_chuc'] },
  /*
   * D528 (founder 05/10, demo bản 49) — KÊ MUA / KÊ BÁN: lệnh giới hạn MỘT mức giá trong màn, khớp trọn đúng giá (founder: "đặt lệnh bán ở đỉnh và
   * đặt lệnh mua … trait mặc định cho tổ chức. Còn cá mập và đội lái hoặc cá nhân muốn có trait này thì phải roll (Trait +3 mỗi chiều …)") ⇒ Tổ Chức
   * mang sẵn (`TRAIT_VAI_V59`), ba vai kia cuộn ở chợ (`chiVai`). TÂM LÝ YẾU (tật −3, thay KỶ LUẬT: "trần lỗ … −14 % … bán hết 60 %"). SOI VAI (tài +2:
   * "vào trận giấu role trừ khi có trait +2 cho phép thấy role mọi user"). PLAYTEST-TUNE (A8.2).
   */
  // Trục `truot` (khớp đúng giá, không trượt) — không `nhip`: không lá nào đụng đồng hồ (D422).
  { id: 'ke_mua', loai: 'tai', diem: 3, truc: 'truot', chiVai: ['ca_nhan', 'ca_map', 'doi_lai'], chiKhoHep: true },
  { id: 'ke_ban', loai: 'tai', diem: 3, truc: 'truot', chiVai: ['ca_nhan', 'ca_map', 'doi_lai'], chiKhoHep: true },
  { id: 'tam_ly_yeu', loai: 'tat', diem: 3, truc: 'ky_luat', chiKhoHep: true },
  { id: 'soi_vai', loai: 'tai', diem: 2, truc: 'thong_tin', chiKhoHep: true },
] as const;

export const TRAIT_IDS: readonly TraitId[] = TRAIT.map((t) => t.id);

/** Điểm có dấu của một trait (TÀI dương, TẬT âm). */
export function diemCoDau(t: Pick<Trait, 'loai' | 'diem'>): number {
  return t.loai === 'tai' ? t.diem : -t.diem;
}

/**
 * MỐC mở chợ trait theo cỡ bàn. Chọn ở vòng mốc, hiệu lực từ vòng KẾ. Founder 25/09 câu 4: A — 1 · 5 · 9 · 13; D428
 * (founder 26/09) dời 5 → 6: chợ trait nằm vào CHỖ HÀNG LÕI của shop, mà vòng lõi bàn 16 là 2 · 5 · 8 (`nhipChonBai`) ⇒
 * mốc 5 trùng. ⚠ Mốc trait KHÔNG được trùng vòng lõi — bài canh ở `tests/lua_trait.test.ts` quét mọi cỡ bàn có chợ.
 * Cỡ khác chưa có chợ (v55 chỉ còn bàn 16 — `chiBan16`); bàn tập ghim khoá cũ nên không đọc bảng này.
 * ⚠ Bàn 12 KHÔNG có mốc ở đây (xem `MOC_TRAIT_MINIGAME`): thêm một cỡ vào bảng chung là mở chợ ở cỡ ấy cho MỌI khoá cũ có `trait`.
 */
export const MOC_TRAIT: Readonly<Record<number, readonly number[]>> = { 16: [1, 6, 9, 13] };

/**
 * D457 — MỐC CHỢ TRAIT CỦA KHUNG MINIGAME: chỉ đọc khi trận mang cờ `khoTraitHep` (qua `laMocTrait(vong, soO, st)`). BÀN 12 (founder
 * 03/10 chọn A): mốc 1 · 5 · 9 — 11 vòng, vòng lõi 2 · 4 · 6 nên không trùng; hai mốc đầu giãn đều, mốc 9 để một trait còn kịp tác
 * dụng ≥ 2 vòng. Cỡ không có trong bảng này rơi về `MOC_TRAIT`.
 * ⚠ VÌ SAO KHÔNG nhét `12: [1, 5, 9]` thẳng vào `MOC_TRAIT`: bản đầu của D457 làm thế và golden `--kiem` BẮT ĐƯỢC — 40 trận tổng hợp
 * `balance-v56-congdon` ở map 12 (20 seed × bàn 4 và 8 ghế) lệch hash. v56 có `trait` bật mà bảng chung chỉ có cỡ 16, nên chợ chưa
 * từng mở ở cỡ 12; thêm cỡ vào bảng chung là mở chợ ở đó cho MỌI khoá cũ. Bài canh: `tests/v57_khung_tran.test.ts` §II.
 */
export const MOC_TRAIT_MINIGAME: Readonly<Record<number, readonly number[]>> = { 12: [5, 9] };   // D473: vòng 1 là lượt LÕI (founder), chợ trait còn 5 · 9

/**
 * KHO TRAIT HẸP (D457, cổng `khoTraitHep`, khoá v57 minigame bước 2). Cho tới khi minigame ra đời (bước 4) chợ trait CHỈ chào
 * những trait mà nghĩa của chúng không phụ thuộc minigame — mười lá dưới đây. Mười lá còn lại bị gác vì đổi nghĩa khi lãi/lỗ dồn
 * vào màn chơi: KỶ LUẬT · CHỐT NON (thành lệnh tự động trong màn) · MÙ TIN · LỘ LỆNH · SỔ MỎNG · KIÊN NHẪN · NÓNG VỘI (đổi cơ chế),
 * LỆNH MỊN → RẢI LỆNH · TẦM RỘNG → TẦM TAY · MỘT GIỎ → MỘT LÁ (thay khái niệm). Xem `docs/thiet-ke-de-xuat/gameplay/
 * kien-truc-minigame.md` §6b. Bốn lá bị động của vai KHÔNG nằm trong kho chung nên không qua đây.
 *
 * Cân được: TÀI {2·2·2·1·1} và TẬT {1·2·2·2·3} có bộ ba cùng tổng 5 hoặc 6 ⇒ `bayTrait` luôn dựng được lượt mời 3 + 3 cân 0.
 * ⚠ Danh sách là LUẬT của khoá v57 — đổi nó là đổi cái người chơi được chào; bài canh `tests/v57_khung_tran.test.ts` §V khoá.
 */
export const KHO_TRAIT_HEP: readonly TraitId[] = [
  'noi_gian', 'di_sau', 'sang_so', 'may_xu', 'giu_nhiet', 'tam_rong',   // TÀI — D473: `tam_rong` = KHẨU VỊ ĐA DẠNG (giữ 3 lõi, mở lượt lõi thứ 3)
  'kien_nhan',   // TÀI — D486 (founder 04/10 "thi công và mở đi"): khoá 10 s đầu màn, trượt ×0,5
  'suong_mu', 'gong_cum', 'mat_tri', 'te_liet', 'mu_lua',   // TẬT
  'nong_voi',   // TẬT — D486: bấm 17 s đầu màn rồi tự chốt
  'rai_lenh_2', 'rai_lenh_3', 'rai_lenh_5',   // TÀI — D498: chỉ chào vai đặc biệt (`chiVai`), một họ
] as const;
/**
 * D528 — KHO của khoá v59 (cờ `keLenhV59`): kho hẹp + KÊ MUA · KÊ BÁN (chỉ ba vai không mang sẵn) · SOI VAI · TÂM LÝ YẾU. Cân được: thêm TÀI {3·3·2} và
 * TẬT {3} vào hai bộ đã cân ⇒ `bayTrait` vẫn dựng được lượt mời 3 + 3 cân 0. ⚠ Danh sách là LUẬT của khoá v59.
 */
export const KHO_TRAIT_V59: readonly TraitId[] = [...KHO_TRAIT_HEP, 'ke_mua', 'ke_ban', 'soi_vai', 'tam_ly_yeu'];
/** D498 — số nến chia cú đẩy/bơm giá của chính lệnh mình theo cấp Rải lệnh (demo bản 34 `RAI_CAP`). */
export const RAI_LENH_NEN: Readonly<Partial<Record<TraitId, number>>> = { rai_lenh_2: 2, rai_lenh_3: 3, rai_lenh_5: 5 };

export const CHO_TRAIT = {
  SO_TAI: 3,
  SO_TAT: 3,
  /** Tổng điểm 3 TÀI + 3 TẬT của một lượt mời. */
  TONG_DIEM_MOI: 0,
  /** Giá xu của lần cuộn thứ k (1-based). Founder: 2 xu lần đầu, tăng dần nhẹ. */
  GIA_CUON_XU: [2, 3, 4, 5, 6] as const,
  CUON_TOI_DA: 5,
} as const;

/** Tham số hiệu ứng từng trait — PLAYTEST-TUNE (A8.2). */
export const THAM_SO = {
  LENH_MIN_MOC_BP: 1000,
  TAM_RONG_THEM_MA: 1,
  NOI_GIAN_SO_LA: 2,
  /**
   * GÔNG CÙM (D425): tiền BÁN (bán dài + đóng khống) cộng dồn mỗi vòng, bp NAV. Bản D409 là trần MUA — đo ra GIÚP bot
   * (bớt phơi nhiễm là bớt cháy, trait-v2 §1c) ⇒ tật phải cắt lãi hoặc làm KẸT, không cắt rủi ro. Đo 1.200 cặp song sinh,
   * bot chơi-được / bot biết trước: 40 % ⇒ −0,8 / −3,0 · 25 % ⇒ −1,6 / −6,0 · 15 % ⇒ −2,5 / −8,2 · 10 % ⇒ −2,7 / −9,1.
   */
  GONG_CUM_TRAN_BAN_VONG_BP: 4000,
  MOT_GIO_TOI_DA_MA: 2,
  /**
   * SỔ MỎNG (D425): phí CỐ ĐỊNH mỗi lệnh, bp vốn khởi điểm của ghế — ĐỐT, không vào Quỹ vòng. Bản D409 (trượt ×1,3) chìm
   * trong nhiễu: bot ít ra vào, và phần trượt chảy lại Quỹ vòng rồi chia cho ghế thắng (trait-v2 §1c). Đo 1.200 cặp, bot
   * chơi-được / bot biết trước: 0,25 % ⇒ −0,5 / −0,8 · 0,5 % ⇒ −1,0 / −1,9 · 0,7 % ⇒ −1,6 / −2,8 · 1 % ⇒ −2,4 / −3,6 ·
   * 2 % ⇒ −4,1 / −6,8. Lấy 0,7 % cho điểm −2 (trung bình hai loại bot ≈ −2,2).
   */
  SO_MONG_PHI_LENH_BP: 70,
  TE_LIET_SO_VONG: 2,
  /**
   * CHỐT NON: trần lãi mỗi vòng (bp). Khoá có `kyLuatSauDonBay` áp SAU Đòn Bẩy (cắt cả phần vay — D422); khoá không có
   * áp lên phần lõi trước Đòn Bẩy như D409.
   */
  CHOT_NON_TRAN_BP: 2500,
  /**
   * KỶ LUẬT (cổng `kyLuatSauDonBay`): sàn lỗ mỗi vòng SAU Đòn Bẩy (D422 — founder chọn B). Sàn −22 % + phí 1,2 % đo ra
   * −0,7 điểm ở vai thường (phí ăn hết phần sàn đỡ) ⇒ hạ cả hai tới khi lá đứng quanh +5 (đo 26/09, trait-v2 §9).
   */
  KY_LUAT_SAN_BP: 1500,
  /** KỶ LUẬT: phí bảo hiểm MỖI vòng, dù sàn có chạm hay không (founder 26/09: "Kỷ luật vẫn phải cho phí mỗi round"). */
  KY_LUAT_PHI_BP: 60,
  /** MÙ LỬA: xu nhận mỗi vòng thay cho xu của lửa (founder 26/09). */
  MU_LUA_XU: 2,
  /** KIÊN NHẪN: giữ liền từ bấy nhiêu vòng thì phần LÃI của mã được cộng thêm `KIEN_NHAN_THUONG_BP`. */
  KIEN_NHAN_VONG: 3,
  KIEN_NHAN_THUONG_BP: 1000,
  /**
   * NÓNG VỘI: mã giữ liền QUÁ bấy nhiêu vòng thì phần LÃI của nó trong vòng bị cắt `NONG_VOI_CAT_BP` — gương của KIÊN
   * NHẪN. Bản đầu (bán ép nửa vị thế) đo ra GIÚP bot (bớt phơi nhiễm là bớt thua) ⇒ không phải tật (D422 §đo).
   */
  NONG_VOI_VONG: 3,
  /** Cắt 50 % đo ra −4,6 (bot không biết xoay mã); 25 % ra −2,7 — người biết xoay trả ít hơn ⇒ −2. */
  NONG_VOI_CAT_BP: 2500,
  /** LỘ LỆNH: phần chen chúc của RIÊNG ghế × hệ số này. ×1,5 đo ra −6,5 · ×1,15 ra −3,2 · ×1,1 ra −2,5 ⇒ gương ĐI SAU (+2). */
  LO_LENH_CHEN_X_BP: 11000,
  /**
   * MÙ TIN: xác suất một lá TIN lật ra bị che (bp) — founder 26/09: tier 4, "tỷ lệ bạn tự cân bằng". Bàn bot KHÔNG với tới
   * −4 ở tỷ lệ nào: 50 % ra −1, 75 % ra −0,6 (bot thường) · −2,7 (bot biết trước). Chọn 75 %: vẫn ngẫu nhiên (1/4 lá lộ),
   * nặng nhất còn "có người pick". Bot không đọc tin kỹ như người ⇒ số đo là cận dưới; canh tỷ lệ pick ở buổi thử.
   */
  MU_TIN_CHE_BP: 7500,
} as const;

/** Cặp cố định của mỗi vai (độc quyền). Cá nhân: không cặp — "tự do chính là lợi thế". */
export const TRAIT_VAI: Readonly<Record<VaiId, readonly TraitId[]>> = {
  ca_nhan: [],
  ca_map: ['ghim_don_bay', 'tac_dong_gia'],
  doi_lai: ['ghim_luot_song', 'siet_phap_ly'],
  to_chuc: ['dong_tien', 'uy_thac'],
};

/**
 * D482 — CẶP CỦA VAI dưới cờ `traitGhimMinigame` (khung minigame): vai thôi ghim LÕI (lõi là thứ chơi trong màn, phải tự chọn), lá ghim
 * đổi thành TRAIT ghim. Cá mập: ĐÒN BẨY ×1,5 trong màn · Đội lái: TUNG TIN đầu màn. Nửa TẬT của cặp giữ nguyên.
 */
export const TRAIT_VAI_MINIGAME: Readonly<Record<VaiId, readonly TraitId[]>> = {
  ca_nhan: [],
  ca_map: ['don_bay_man', 'tac_dong_gia'],
  doi_lai: ['tung_tin', 'siet_phap_ly'],
  to_chuc: ['dong_tien', 'uy_thac'],
};
/** D528 — khoá v59: Tổ Chức mang sẵn thêm KÊ MUA + KÊ BÁN (founder: "trait mặc định cho tổ chức"). Ba vai kia như khung minigame. */
export const TRAIT_VAI_V59: Readonly<Record<VaiId, readonly TraitId[]>> = {
  ...TRAIT_VAI_MINIGAME,
  to_chuc: ['dong_tien', 'uy_thac', 'ke_mua', 'ke_ban'],
};
/** D528 — TÂM LÝ YẾU: lãi lỗ màn chạm −NGUONG_BP vốn màn ⇒ tự bán tháo BAN_BP phần đang cầm (kể cả khoản giữ suốt), một lần mỗi màn. PLAYTEST-TUNE. */
export const TAM_LY_YEU = { NGUONG_BP: 1400, BAN_BP: 6000 } as const;
