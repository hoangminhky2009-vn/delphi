/**
 * MARKET HOLD'EM — ENGINE TRẬN (lát 1). HÀM THUẦN, TẤT ĐỊNH, SỐ NGUYÊN.
 *
 * Không import gì từ đường tiền (config/economy, wallet, ledger). Vốn/Quỹ vòng
 * ở đây là CHIP ẢO reset mỗi trận — D24 luật số một. `holdem_firewall.test.ts`
 * khoá điều đó bằng cách soi câu lệnh import.
 *
 * ─── CHUỖI CHẤM ĐIỂM = CHIPS × MULT ────────────────────────────────────────
 * Toán chốt phiên vốn đã có cấu trúc Balatro, chỉ cần dàn ra đúng thứ tự:
 *
 *   cộng dồn : từng TÀI SẢN × giai đoạn  (+ echo sự kiện, + nhiễu)
 *   trừ      : TRƯỢT GIÁ do đông (crowding)
 *   trừ/cộng : XUNG ĐỘT / CỘNG HƯỞNG giữa thẻ
 *   nhân     : thẻ ĐÒN BẨY
 *   =        : PnL vòng
 *
 * `chain` trả về ĐÚNG THỨ TỰ ĐÓ. Đây vừa là bảng giải thích "vì sao" (yêu cầu
 * feedback-clarity, D26 mục 18.5) vừa là kịch bản hoạt hình dây chuyền — cùng
 * một dữ liệu, không phải hai việc.
 */
import {
  bangCanTroi,
  CAT_LO_VE_CASH, CHIEN_THUAT, CONG_HUONG, CONG_HUONG_V20,
  DO_SAU_L, DONG_QUY_CHIEU,
  AP_LUC_BAN, BE_CHUOI_VON, DI_NGUOC, PHAN_THAN, RUI_RO_DOI_TAC, SU_KIEN, khauViCua,
  type KhauViId,
  GIAM_TRUOT_GIA_BP, soLanCatLo, tyLeBp,
  HE_SO_TAC_DONG_K, dongQuyDoi, tyLeDongBp,
  bienDongCua, boMaTranCua, couponBp, HOLDEM_DECISIONS, HOLDEM_MATCH, laiMoiO, laiTietKiemBp,
  mtGiaiDoan,
  mtSuKien, TIEN_MAT_SU_KIEN, TIET_KIEM, lechTinhChatBp, coManMinigame, type BoMaTran, type SuKienId, type TinhChatPha,
  NHA_CAI, PHAT_XUNG_DOT_BP, PHI_DUNG_NGOAI, TAI_SAN, THUONG_CONG_HUONG_BP,
  KHAC_MA_BP, XUNG_DOT, XUNG_DOT_V19, heSoStackBp,
  BAO_HIEM_CO_PHI, DA_DANG_HOA, DA_DANG_HOA_V52, GOI_KY_QUY, KHOP_NHANH_HOAN_BP, MANDATE_TO_CHUC,
  REGIME_TICK, SIET_DOI_LAI,
  LUOT_SONG_DAY_CHUYEN, MT_CHIEN_THUAT_SU_KIEN, MT_SU_KIEN_KE_TIEP, mtKeTiep,
  THE_CANH_NHIP, THE_PHONG_THU,
  DAO_DANH_MUC, KHOA_TAI_SAN, MAX_BAN_SAO,
  GIA_CUA_THANH_KHOAN_BP, LAI_SUAT_NEN, trongSoQuyVong, xuGiaiTheoHang, CHIA_QUY_VONG, PHI_CO_HOI_KEP, THANH_KHOAN_DONG, TRUYEN_NHAN_QUA, TUONG_TAC_THE,
  tyLeTinGiaHieuDung,
  moiTruongTienTe,
  DAC_QUYEN, allInDaMo, LOI_MINIGAME, SO_THE_CHIEN_THUAT, vongChonChienThuat,
  DON_BAY_CAM_KET, heSoDonBayBp, laiVayDonBayBp,
  betaCua, heSoRiengBp,
  type ChienThuatId, type TaiSan, type ThanhKhoan,
  SUC_CANG, CHU_KY,
  type GiaiDoanId,
  bangXepHangE, phanViBang, doThamSo,
} from '../../config/holdem.js';
import { applyBpInt, idiv, rngAt, symmetricNoise } from '../sandbox/rng.js';
import { HUONG_GIAI_DOAN, sinhMap, THU_TU_MA_SUC_CANG, type HoldemMap, type OThiTruong } from './map.js';
import {
  daDongVong, duocLam, hanhDong as buocCuoc, moVongCuoc,
  type LoaiHanhDong, type TrangThaiCuoc,
} from './cuoc.js';
import { chiaPotDayDu } from './pot.js';
import {
  apCoupon, apDinhGia, apLamPhat, apLenhGiaoDich, apPhiGiuKhong, daChayNav, daiSucCang,
  giaiLenhMoc, matLamPhatNen, mocHopLe, navCua, navTuDo, tienTuMoc,
  type GheNav, type LenhGiaoDich, type LenhMoc, type LoiLenh,
} from './nav.js';
import { brierVong } from './brier.js';
import { capThe } from './shop.js';
import { CHU_VAI_MAT_LOI_GHIM, CHU_VAI_TO_CHUC_V57, CHU_VAI_TRAIT_GHIM, CHU_VAI_VON_DEU, heSoVonCua, sauPhiVaiBp, VAI, type Vai, type VaiId } from './vai.js';
import type { Mandate } from './nav.js';
import { TO_CHUC_V57, VAO_GIA } from '../../config/minigame.js';
import { LUA, type BiasLua, type LyDoDap, type NacLua } from '../../config/lua.js';
import { THAM_SO, type TraitId } from '../../config/trait.js';
import { LUOT_SONG_MOI } from '../../config/luot_song.js';
import { BOI_CANH_DAI_HAN } from '../../config/boi_canh_dai_han.js';
import { PHAN_BCDH, phanBcdhBat } from './boi_canh_dai_han.js';
import { biasCua, capNhatLua, heSoTruotLuaBp, matXichLua, type TrangThaiLua } from './lua.js';
import { RANG_BUOC_TRONG, rangBuocCua } from './trait.js';
import { LOI_BI_CAT } from '../../config/luoc_bo.js';
import { matKhiDoVo, nganHangDoVoTai } from '../../config/tiet_kiem_kinh_te.js';
import {
  DICH_NAC_NAM, DO_SAU_L_NAM, NAC_NAM, type NacThanhKhoan,
} from '../../config/thanh_khoan_nam_nac.js';

// ---------------------------------------------------------------------------
// Kiểu
// ---------------------------------------------------------------------------

export type LoaiGhe = 'nguoi' | 'bot' | 'bong';

export interface DanhMuc {
  tai_san: readonly string[];
  chien_thuat: readonly ChienThuatId[];
  /**
   * D3 — STRATEGY ATTACHMENT: thẻ nào GẮN vào mã nào.
   *
   * ⚠ VÌ SAO LÀ MỘT BẢNG RIÊNG, KHÔNG PHẢI ĐỔI `chien_thuat` THÀNH MẢNG CẶP.
   *
   * Đổi kiểu mảng sẽ bắt sửa ~30 chỗ `chien_thuat.includes(...)` rải khắp engine,
   * shop, bot, API, test — mỗi chỗ là một cơ hội đổi hành vi ngoài ý muốn, trong
   * khi thứ thật sự cần thêm chỉ là "thẻ này nhắm vào mã nào". Bảng phụ giữ nguyên
   * mọi phép kiểm "có cầm thẻ X không", và chỉ những chỗ THỰC SỰ cần biết mục tiêu
   * mới tra thêm.
   *
   * Một thẻ chỉ có MỘT mục tiêu, kể cả khi cầm nhiều bản sao: bản sao là NÂNG CẤP
   * (`capThe` → cấp 2), không phải hai lá độc lập. Nên `Record` là đúng hình dạng,
   * không phải mảng.
   *
   * Thẻ `pham_vi: 'danh_muc'` (Đa Dạng Hoá, Đi Ngược) KHÔNG có mặt ở đây — chúng
   * xét cả danh mục nên gắn vào một mã là làm hỏng chính chúng.
   *
   * OPTIONAL vĩnh viễn: `ghe_json` của trận CŨ không có trường này, và `events` là
   * append-only nên không backfill được. Thiếu ⇒ thẻ tác động như trước (toàn danh
   * mục), tức trận cũ replay ra đúng kết quả nó từng có.
   */
  gan?: Readonly<Partial<Record<ChienThuatId, string>>>;
  /**
   * v34 — ĐÍCH PHỤ của Đòn Bẩy CẤP 2 (cá mập ghim sẵn một lá, lấy thêm một lá
   * là lên cấp 2 ⇒ nhắm được HAI mã). Chỉ `don_bay` có nghĩa; engine chỉ đọc khi
   * cổng `vai_co_rang` bật VÀ cấp thẻ ≥ 2. OPTIONAL vĩnh viễn như `gan`.
   */
  gan_phu?: Readonly<Partial<Record<ChienThuatId, string>>>;
}

/**
 * v43 (D314) — MỘT HỢP ĐỒNG GỬI TIẾT KIỆM.
 *
 * `lai_bp` CHỐT LÚC MỞ và không đổi theo kỳ họp sau — đó là bản chất của tiền gửi có kỳ
 * hạn, và là chỗ trò chơi dạy được: gửi lúc lãi cao thì lời, gửi ngay trước một chuỗi
 * tăng lãi thì hợp đồng kẹt dưới thị trường.
 * `lai_don` = lãi ĐÃ TÍCH LUỸ, cộng mỗi ô nhưng CHƯA vào tiền mặt. Nó nằm trong NAV
 * (xem `navCua`), nên huỷ trước hạn là NAV tụt thấy được ngay vòng huỷ.
 */
export interface HopDongTietKiem {
  /** `tk<vòng mở>_<chỉ số trong lệnh của vòng đó>` — tất định, replay ra đúng id cũ. */
  id: string;
  goc: number;
  vong_mo: number;
  so_vong: number;
  lai_bp: number;
  lai_don: number;
}

export interface Ghe {
  id: string;
  loai: LoaiGhe;
  /** Bậc rank hiển thị — D25/R4: theo BẬC, không theo điểm. */
  bac_rank: string;
  von: number;
  luot_khao_sat: number;
  danh_muc: DanhMuc;
  da_chay: boolean;
  /** Vòng bị cháy (để xếp hạng cuối trận). */
  vong_chay: number | null;
  /**
   * TƯ THẾ của ghế trong trận (founder chốt 20/07).
   *
   *  'choi'       — bình thường.
   *  'all_in'     — đã dồn hết vốn. KHOÁ chọn bài từ đây tới hết trận, bài cứ
   *                 lật tiếp tới cuối, đúng như poker chạy nốt board.
   *  'dung_ngoai' — bỏ bài nhưng Ở LẠI: vốn đóng băng, không cược nữa, vẫn
   *                 được TÍNH HẠNG cuối trận, nhưng mỗi vòng còn lại bị trừ
   *                 PHÍ GIỮ TIỀN (xem PHI_DUNG_NGOAI — không có phí này thì
   *                 đứng ngoài là bến an toàn miễn phí và cả cơ chế poker tự
   *                 vô hiệu).
   *  'dau_hang'   — thoát hẳn. THUA LUÔN, KHÔNG được tính hạng. Founder nói
   *                 rõ: "thoát ngay thì thua luôn chứ ko đc tính hạng". Nếu
   *                 đầu hàng mà vẫn giữ hạng thì ai đang dẫn ở vòng 3 cứ thoát
   *                 là ăn non được hạng đẹp — lỗ hổng đó bị bịt ở đây.
   */
  tu_the: TuTheGhe;
  /** Vòng chuyển sang đứng ngoài / đầu hàng. */
  vong_roi: number | null;
  /**
   * D6 — KHẨU VỊ RỦI RO đã chọn trước trận. Không đổi giữa chừng.
   *
   * ⚠ OPTIONAL vĩnh viễn: sơ đồ ghế của trận CŨ trong `ghe_json` không có trường
   * này, và `events` là append-only nên không backfill được. Thiếu ⇒ 'can_bang'.
   */
  khau_vi?: KhauViId;
  /**
   * VAI BẤT ĐỐI XỨNG (22/08) — cá nhân · cá mập · đội lái · tổ chức.
   * ⚠ OPTIONAL vĩnh viễn: trận cũ và map 8 (đối chứng) không có. Bước 1 chỉ là
   * NHÃN; vốn/hệ số giá/lõi ghim theo vai đi cổng `balance_version` riêng.
   */
  vai?: VaiId;
  /**
   * D3 — BOT NÀO ĐANG NGỒI GHẾ NÀY (chỉ ghế bot).
   *
   * ⚠ OPTIONAL, và phải mãi mãi optional: sơ đồ ghế của trận CŨ trong `ghe_json`
   * không có trường này, nên đọc phải chịu được `undefined`.
   *
   * Vì sao cần lưu thay vì suy lại: `botCuaGhe` cũ suy danh tính bằng
   * `(seed + i) % BOT_CHOI_DUOC.length`. Nghĩa là THÊM/BỚT/ĐỔI THỨ TỰ một archetype
   * trong đàn là VIẾT LẠI ĐỐI THỦ của mọi trận đã lưu — im lặng, không lỗi, không
   * cách nào biết. Mà đàn bot thì chắc chắn còn đổi (phiên này vừa thêm một con).
   * Dấu vết của đúng lỗ này: `soDoGhe` TÍNH RA `const bot = ...` rồi KHÔNG DÙNG —
   * danh tính được tính đúng rồi bị bỏ đi.
   */
  bot_id?: string;
  /**
   * D2 — đã dùng bao nhiêu lượt CẮT LỖ trong trận này.
   *
   * Cắt lỗ có giới hạn theo cỡ map (`soLanCatLo`). Không giới hạn thì nó thành
   * nút thoát bấm được vô hạn, và phí bao nhiêu cũng chỉ là thuế đều đặn — người
   * chơi vẫn không phải CÂN gì. Hết lượt thì còn đúng hai đường: chiến đấu, hoặc
   * Đầu hàng (đắt hơn nhiều — mất luôn hạng).
   */
  so_lan_cat_lo: number;
  /**
   * v10 NAV — giá trị hiện tại từng VỊ THẾ (chip). Trận không bật `nav` thì
   * rỗng vĩnh viễn. Bán sạch là XOÁ Ô, không để ô 0. `danh_muc.tai_san` của
   * trận nav là GƯƠNG của các key ở đây (xem `apLenhVongNav`) — mọi cơ chế cũ
   * đọc danh sách mã (dungChuoi · chen chúc · gắn thẻ · khoá) tự đúng theo.
   */
  vi_the: Record<string, number>;
  /** v17 — ký quỹ khống theo mã (doc 05); vắng = chưa từng mở. */
  vi_the_khong?: Record<string, number>;
  /**
   * v45 (D318) — ẢNH CHỤP VỊ THẾ CUỐI Ô TRƯỚC, cho luật "giữ đủ một ô mới ăn
   * coupon". Ghi ở điểm nối vòng, đọc ở `apCoupon` của ô sau. Chi tiết luật `min`
   * ở docstring `GheNav.vi_the_o_truoc` — cùng một trường, `GheNav` là mặt hẹp
   * của nó cho lõi tiền thuần.
   */
  vi_the_o_truoc?: Readonly<Record<string, number>>;
  vi_the_khong_o_truoc?: Readonly<Record<string, number>>;
  /**
   * LÕI VỐN A — lần ĐẢO DANH MỤC gần nhất của ghế này.
   *
   * ⚠ PHẢI LƯU, không suy lại được: sau khi đảo xong, danh mục trông y hệt danh
   * mục của người đã ôm mã đó từ trước. "Vừa bán A để mua B" là thông tin chỉ
   * tồn tại ở khoảnh khắc hành động, mà phí chuyển đổi lại tính trên đúng khoảnh
   * khắc đó. Mang theo `vong` nên nó tự hết hạn — không cần ai đi dọn.
   */
  dao?: { vong: number; tu: string; den: string };
  /** LÕI VỐN B — chu kỳ khoá đang chạy (xem `khoaDangChay`). */
  khoa?: KhoaChuKy;
  /**
   * v43 (D314) — SỔ TIẾT KIỆM của ghế. Vắng/rỗng = không có hợp đồng nào.
   * KHÔNG giới hạn số hợp đồng (founder 08/09) — mảng, không phải một ô.
   */
  tiet_kiem?: HopDongTietKiem[];
  /**
   * v43 (D314) — các cú HUỶ xảy ra TRONG vòng này, để `chotPhien` đổ ra kết quả vòng.
   * Mang theo `vong` nên nó tự hết hạn, cùng khuôn `dao` ngay trên — không ai phải đi dọn.
   */
  tk_su_kien_vong?: { vong: number; id: string; goc: number; lai_mat: number }[];
  /**
   * LÕI VỐN B — vòng mà ghế này BẺ KÈO.
   *
   * Đặt bởi `chotPhien` TRƯỚC khi chấm điểm, vì điều kiện bẻ kèo có một vế
   * (`bỏ bài`) mà chỉ vòng cược mới biết, còn hình phạt lại phải nằm trong dây
   * chuyền chấm điểm để người chơi ĐỌC ĐƯỢC lý do (D26 feedback-clarity).
   */
  be_keo_vong?: number;
  /**
   * LÕI VỐN B — vốn bị giam tới hết vòng này: không Tăng cam kết, không khảo
   * sát lại thẻ. Xem `biGiamVon`.
   */
  giam_von_den_vong?: number;
  /**
   * ĐẶC QUYỀN PHÒNG HỘ (D33) — lệnh SHORT đã ĐẶT, chờ KHỚP Ở VÒNG SAU.
   *
   * ⚠ PHẢI LƯU, không suy lại được — cùng lý do với `dao`: "tôi vừa đặt lệnh
   * bán khống mã X" là thông tin chỉ tồn tại ở khoảnh khắc bấm nút, mà hệ quả
   * lại rơi vào vòng SAU. Nhìn danh mục ở vòng khớp thì không có gì phân biệt
   * người đã đặt short với người chưa.
   *
   * `vong_dat` mang theo nên nó tự hết hạn: khớp xong ở `vong_dat + 1` là xoá.
   */
  short?: { ma: string; vong_dat: number };
  /** v55 (D409) — NGỌN LỬA ĐÀ của ghế (cổng `lua`). Vắng = trận trước v55 / chưa có vòng nào. */
  lua?: { nac: NacLua; chuoi: number; bias: BiasLua; dac_biet?: true };
  /** v55 — XU: chỉ tiêu ở chợ trait (cuộn lại); không bao giờ đổi ra T/Q (A3.5). */
  xu?: number;
  /** v55 — TRAIT đang mang, theo thứ tự nhận (cặp của vai đứng đầu khi `trait_vai`). */
  trait?: readonly TraitId[];
  /**
   * v55 (D422) — vòng BẮT ĐẦU có hiệu lực của từng trait đã nhận ở chợ (mốc + 1). MÙ TIN / SƯƠNG MÙ đọc để biết lá nào
   * lật ra khi đã mang tật (server che trước khi gửi — C4). Vắng = trận trước D422 hoặc chưa nhận gì.
   */
  trait_tu_vong?: Readonly<Partial<Record<TraitId, number>>>;
  /** v55 — TÊ LIỆT: lõi bị khoá TỚI HẾT vòng này (kể cả). */
  te_liet_den_vong?: number;
  /** v55 — LƯỚT SÓNG MỚI: lệnh chốt lời trong ô đặt cho vòng đang chơi; reset mỗi vòng. */
  chot_loi?: readonly { ma: string; nguong_bp: number; phan_bp: number }[];
  /**
   * v55 (D422) — SỐ VÒNG GIỮ LIỀN từng mã (vị thế dài > 0 ở cuối vòng), `chotPhien` cập nhật khi cổng `trait` bật.
   * KIÊN NHẪN đọc để thưởng phần lãi, NÓNG VỘI đọc để bán ép; bán ép xong mã ấy đếm lại từ 0.
   */
  giu_lien?: Readonly<Record<string, number>>;
  /** v55 — ĐỔI TAY trong vòng (tiền BÁN · MUA vào nhóm khác bias · MUA vào rủi ro), `chotPhien` đọc để dập lửa; reset mỗi vòng. */
  doi_tay_vong?: { ban: number; mua_khac: number; mua_rui_ro: number; mua_tong: number };
  /**
   * v56 (D447) — tiền đã đổi tay theo MÃ trong vòng: |tiền| mọi lệnh đã áp (mua · bán · mở · đóng khống). Nền cộng dồn
   * của phí bậc hai (`apLenhGiaoDich.daDoiMa`). Sống MỘT vòng, như `doi_tay_vong`. Chỉ có ở trận bật `phiCongDonVong`.
   */
  doi_ma_vong?: Readonly<Record<string, number>>;
}

/**
 * LÕI VỐN B — một chu kỳ khoá tài sản.
 *
 * `thuong_bp` là SỔ CÁI của chu kỳ, không phải số trang trí: bẻ kèo thu hồi
 * đúng bằng nó. Cộng dồn ở `chotPhien` từ chính mắt xích `khoa_thuong` đã sinh
 * ra — một nguồn chân lý, nên không thể có chuyện "thưởng đã trả một đằng, thu
 * hồi một nẻo".
 */
export interface KhoaChuKy {
  ma: string;
  vong_bat_dau: number;
  /** Tổng bp thưởng sống sót đã nhận trong chu kỳ này. */
  thuong_bp: number;
}

export type TuTheGhe = 'choi' | 'all_in' | 'dung_ngoai' | 'dau_hang';

/**
 * v55 (D422) — MÙ TIN: lá TIN ở ô `k` có bị che với ghế `g` không. Che NGẪU NHIÊN, tất định theo (seed · ô · ghế), tỷ lệ
 * `THAM_SO.MU_TIN_CHE_BP` — founder 26/09: *"mù tin chỉ che ngẫu nhiên thôi chứ che mọi lá thì đ** ai pick"*. Chỉ lá lật
 * ra từ vòng tật có hiệu lực (`trait_tu_vong`). MỘT cửa cho màn người chơi (API lột nội dung trước khi gửi) và bối cảnh
 * bot (`boiCanhLenhGhe`) — nhờ vậy bàn đo cân được giá của tật (D61).
 */
export function tinBiChe(st: TrangThaiTran, g: Ghe, k: number): boolean {
  if (st.trait_bat !== true || !(g.trait ?? []).includes('mu_tin')) return false;
  const tu = g.trait_tu_vong?.mu_tin;
  if (tu === undefined || k < tu) return false;
  const o = st.map.o[k];
  if (!o || o.kind !== 'su_kien') return false;
  return rngAt(st.seed, 'holdem_mu_tin', k, g.id).below(10000) < THAM_SO.MU_TIN_CHE_BP;
}

/** Ghế còn được chọn bài không. */
export function duocChonBai(g: Ghe): boolean {
  return g.tu_the === 'choi' && !g.da_chay;
}

/** Ghế còn tham gia VÒNG CƯỢC không (all-in / đứng ngoài thì không). */
export function conCuoc(g: Ghe): boolean {
  return g.tu_the === 'choi' && !g.da_chay;
}

/**
 * Ghế còn TRONG TRẬN không — khác hẳn `conCuoc`, và chỗ lẫn hai cái này đã đẻ
 * ra một lỗi nặng.
 *
 * ⚠ `daKetThuc` từng đếm `conCuoc`. Hậu quả founder gặp ngay: "all in không lật
 * hết bài ngay mà lật đúng 1 lá sau đó rồi báo kết quả luôn". Vì khi người chơi
 * dồn hết vốn thì bot buộc phải theo giá nên cũng all-in theo — gần cả bàn rời
 * tư thế 'choi', số ghế "còn cược" tụt xuống ≤1, trận đóng ngay.
 *
 * ALL IN KHÔNG PHẢI RỜI TRẬN. Đó chính là lúc phải lật nốt board: danh mục vẫn
 * ăn PnL mỗi vòng, vẫn được xếp hạng. Chỉ CHÁY hoặc ĐẦU HÀNG mới là ra khỏi
 * trận thật.
 */
export function conTrongTran(g: Ghe): boolean {
  return !g.da_chay && g.tu_the !== 'dau_hang';
}

/** Một mắt xích của dây chuyền chấm điểm. Thứ tự mảng = thứ tự diễn hoạt hình. */
export type MatXich =
  | { kind: 'tai_san'; id: string; delta_bp: number; giai_doan: string; cap: number; cang_bp?: number; cang_dai?: 0 | 1 | 2 }
  | {
    kind: 'echo'; id: string; su_kien: string; delta_bp: number;
    /** Sự kiện đã lật sinh ra nhánh này; vắng = chính `su_kien` đã lật. */
    tu_nhanh?: string;
    /**
     * TIN GIẢ — dư âm bị ĐẢO CHIỀU (§17.1c). 28/07 founder thấy "dư âm Hạ lãi
     * suất −12%" (sự kiện TỐT, dư âm ÂM) và đọc thành lỗi tính toán: số đúng,
     * nhãn thiếu chữ "đảo". KHÔNG lộ sớm: dấu đảo đã hiện sờ sờ qua chính con
     * số ngược chiều — cờ này chỉ gọi tên thứ người chơi đang nhìn thấy.
     */
    dao?: true;
    /** v13 — có mặt khi mắt xích này bị sức căng khuếch đại (S đầy đủ, bp). */
    cang_bp?: number;
    /** Bước 5 — dải công bố kèm (0 êm · 1 căng · 2 rất căng). */
    cang_dai?: 0 | 1 | 2;
    /**
     * v35 — dòng VÀNG này vừa được CỘNG HƯỞNG TRÚ ẨN nhân (D158). Tên dài để
     * khỏi lẫn với kind 'cong_huong' của cộng-hưởng-chiến-thuật ngay dưới.
     */
    cong_huong_tru_an?: true;
  }
  | { kind: 'crowding'; id: string; delta_bp: number; so_nguoi_dong: number }
  | { kind: 'xung_dot'; cap: readonly [ChienThuatId, ChienThuatId]; delta_bp: number }
  | { kind: 'cong_huong'; cap: readonly [ChienThuatId, ChienThuatId]; delta_bp: number }
  | {
    kind: 'nhan'; id: ChienThuatId; he_so_bp: number; delta_bp: number;
    /**
     * Mã lá Đòn Bẩy đang GẮN — vắng = nhân toàn danh mục (trận cũ / chưa gắn).
     * 28/07: founder đọc dòng "khuếch đại ×2 −43,52%" trong khi tổng trước nó
     * là −75,20% và báo LỖI TÍNH TOÁN. Số ĐÚNG (−43,52 = đúng tổng phần BTC
     * đang gắn ×1) — cái sai là NHÃN giấu mất chữ "trên BTC". Nhãn thiếu một
     * chữ biến một phép tính đúng thành một lỗi trong mắt người chơi.
     */
    ma?: string;
    /** v34 — đích PHỤ của Đòn Bẩy cấp 2 (cá mập). Vắng = chỉ một đích. */
    ma_phu?: string;
    /**
     * v49 (D342) — dòng này nhân phần SỔ KHỐNG của `ma`, không phải vị thế dài. Vắng = sổ
     * dài. Xem `tangCuaMatXich`: cờ này là thứ duy nhất tách hai tầng của cùng một mã.
     */
    khong?: true;
  }
  // T1 — chiến thuật phản ứng với sự kiện đang nổ.
  | { kind: 'ct_su_kien'; id: ChienThuatId; su_kien: string; delta_bp: number }
  // T2 — Lướt Sóng bám đúng / bám nhầm dây chuyền nhân quả.
  | { kind: 'day_chuyen'; tu: string; den: string; dung: boolean; delta_bp: number }
  // T4 — Khớp Nhanh hoàn lại một phần trượt giá đã chịu.
  | { kind: 'hoan_truot'; id: string; so_nguoi_dong: number; delta_bp: number }
  // T8 — thẻ canh nhịp bắt trúng / bắt trượt.
  | { kind: 'canh_nhip'; id: ChienThuatId; trung: boolean; delta_bp: number }
  // T8 — thưởng đa dạng hoá theo số mã khác nhau.
  | { kind: 'da_dang'; so_ma: number; delta_bp: number }
  // T8 — thẻ phòng thủ ăn/tốn phí theo giai đoạn.
  | { kind: 'phong_thu'; id: ChienThuatId; an: boolean; delta_bp: number }
  /*
   * D6 — khẩu vị rủi ro: nhân biên độ CẢ HAI CHIỀU, kỳ vọng không đổi.
   * v47 (D339) — `ma` CÓ thì mắt xích này nhân phần của riêng mã đó (tầng theo mã của
   * `apDinhGia`); VẮNG thì nó nhân phần danh mục. Trận ≤ v46: luôn vắng, một mắt xích gộp.
   */
  | {
    kind: 'khau_vi'; id: KhauViId; he_so_bp: number; delta_bp: number; ma?: string;
    /** v49 (D342) — nhân phần SỔ KHỐNG của `ma` (cùng nghĩa với `nhan.khong`). */
    khong?: true;
  }
  /*
   * v49 (D342) — GIÁ CHỢ CỦA MỘT MÃ ĐANG KHỐNG. `gia_bp` = lợi suất công khai của mã trong
   * vòng (đúng số trên bảng); `delta_bp` = lợi suất của CHÍNH sổ khống = `−gia_bp`. Mang
   * dấu của người khống để dòng VÌ SAO đọc thẳng được "tôi được/mất bao nhiêu".
   */
  | { kind: 'khong_gia'; id: string; gia_bp: number; delta_bp: number }
  /** D561 — TIN ĐÃ VÀO GIÁ: phần giá (tài sản + tin) `goc_bp` của mã thành −DAO × goc ⇒ mắt xích này = −(1 + DAO) × goc. */
  | { kind: 'vao_gia'; id: string; goc_bp: number; delta_bp: number }
  // D5 — thẻ Đi Ngược: thưởng vị thế lệch đám, phạt vị thế theo đám.
  | {
    kind: 'di_nguoc';
    /** Bao nhiêu mã lệch đám / bao nhiêu mã theo đám. */
    so_lech: number; so_theo: number; delta_bp: number;
  }
  // D5 — rủi ro đối tác: cả bàn cùng núp một thẻ thì phần che teo lại.
  | { kind: 'doi_tac'; id: ChienThuatId; ty_le_bp: number; delta_bp: number }
  // D1 — cặp phòng thủ triệt nửa biên tăng của tài sản đang giữ (trong uptrend).
  | {
    kind: 'triet_bien_tang';
    cap: readonly [ChienThuatId, ChienThuatId];
    delta_bp: number;
  }
  // LÕI VỐN A — phí giao dịch cố định của một lần Bán A / Mua B.
  | { kind: 'dao_phi'; tu: string; den: string; delta_bp: number }
  // LÕI VỐN A — xếp hàng khớp lệnh cùng mọi dòng tiền MỚI vào mã đó vòng này.
  | { kind: 'xep_hang'; id: string; so_vao: number; delta_bp: number }
  // LÕI VỐN B — phần trượt giá được hoàn lại nhờ đang khoá mã đó.
  | { kind: 'khoa_giam_truot'; id: string; delta_bp: number }
  // LÕI VỐN B — thưởng còn cầm mã khoá khi bão đi qua.
  | { kind: 'khoa_thuong'; ma: string; giai_doan: string; delta_bp: number }
  // LÕI VỐN B — bẻ kèo: phạt CỘNG thu hồi toàn bộ thưởng đã nhận trong chu kỳ.
  | {
    kind: 'be_keo'; ma: string;
    phat_bp: number; thu_hoi_bp: number; delta_bp: number;
  }
  /*
   * D33 — ĐẶC QUYỀN PHÒNG HỘ: lệnh short đặt vòng trước, KHỚP ở vòng này.
   * `nghich_dao_bp` = biên độ gốc của mã (trước hệ số và phí) — để người chơi
   * đọc được "tôi cược ngược cái gì", không chỉ thấy một con số ròng.
   */
  | {
    kind: 'short'; ma: string; vong_dat: number;
    nghich_dao_bp: number; phi_bp: number; delta_bp: number;
  }
  /*
   * D33 — ĐẶC QUYỀN CHẶN LỖ: sàn sụt giảm của phần LÕI (chưa tính trượt giá).
   * `truoc_san_bp` là phần lõi trước khi nâng — bằng chứng sàn đã cứu bao nhiêu.
   */
  | { kind: 'chan_lo_san'; truoc_san_bp: number; san_bp: number; delta_bp: number }
  /** v55 (D409) — CHỐT NON (trait, cổng `chanLoTrait`): TRẦN lãi phần lõi — gương của `chan_lo_san`. */
  | { kind: 'chot_non_tran'; truoc_tran_bp: number; tran_bp: number; delta_bp: number }
  /**
   * v55 (D409) — LƯỚT SÓNG MỚI (cổng `luotSongMoi`): bán `phan_bp` vị thế của `ma` ở mức `nguong_bp` khi đỉnh sóng
   * trong ô `dinh_bp` chạm tới; delta = (fill − Δ) × phần. Không chạm mục tiêu ⇒ không có mắt xích.
   */
  | { kind: 'song'; ma: string; nguong_bp: number; dinh_bp: number; phan_bp: number; delta_bp: number }
  /** v55 (D409) — NGỌN LỬA ĐÀ theo mã (cổng `luaQuyetToan`): lãi cộng thêm (`thuan`), lỗ trừ thêm; nấc + hệ số để VÌ SAO kể. */
  | { kind: 'lua'; ma: string; nac: NacLua; thuan: boolean; he_so_bp: number; delta_bp: number }
  /** v55 (D422) — KIÊN NHẪN theo mã: mã giữ liền `giu_vong` vòng, phần lãi của nó trong vòng được cộng thêm. */
  | { kind: 'kien_nhan'; ma: string; giu_vong: number; he_so_bp: number; delta_bp: number }
  /** v55 (D422) — NÓNG VỘI theo mã: mã giữ liền QUÁ lâu, phần lãi của nó trong vòng bị cắt (delta âm). */
  | { kind: 'nong_voi'; ma: string; giu_vong: number; he_so_bp: number; delta_bp: number }
  /*
   * D33 — ĐẶC QUYỀN KHỚP NHANH hoàn lại một phần khoản trượt giá đã tính.
   * `ly_do` nói ĐÚNG khoản nào được che: mỗi khoản là một bài học khác nhau.
   */
  | {
    kind: 'dac_quyen'; id: ChienThuatId;
    ly_do: 'xep_hang' | 'dao_phi' | 'phi_bao_hiem'; delta_bp: number;
    /**
     * v49 (D342) — phần HOÀN xếp hàng đi cùng mã với khoản phạt nó hoàn (`xepHangTheoMa`).
     * Vắng ở trận cũ và ở hai lý do còn lại (phí đảo, phí bảo hiểm là chuyện của cả ghế).
     */
    ma?: string;
  }
  /*
   * D35 hướng 1 — ĐÒN BẨY TỪ CAM KẾT. Mắt xích CUỐI CÙNG của cả dây chuyền,
   * đứng sau cả Khẩu vị: nó là hệ số của TOÀN BỘ kết quả vòng, và nó là thứ
   * DUY NHẤT trong dây chuyền do một quyết định ở NHỊP 2 (cược) sinh ra chứ
   * không phải nhịp 1 (danh mục).
   *
   * `ty_le_bp` phải đi kèm hệ số chứ không chỉ delta: D25/R1 đòi mức đòn bẩy
   * đang chịu phải HIỆN được lúc quyết định, mà "vì sao 1,47×" chỉ đọc được khi
   * thấy "vì đã cam kết 50% Vốn".
   */
  | {
    kind: 'don_bay_cam_ket';
    ty_le_bp: number; he_so_bp: number; ben_lo: boolean; delta_bp: number;
  };

export interface KetQuaGhe {
  ghe_id: string;
  pnl_bp: number;
  chain: readonly MatXich[];
  da_cat_lo: boolean;
  /**
   * Ba trường dưới đây phục vụ KHOẢNH KHẮC LỚN ở tầng UI — client cần biết ai
   * vừa dồn hết vốn và ai vừa nhân đôi tài khoản để dựng màn công bố.
   * Không suy ra được từ pnl_bp: PnL là hiệu năng danh mục, còn vốn đổi qua
   * Quỹ vòng nên hai con số độc lập nhau.
   */
  cam_ket: number;      // đã góp vào Quỹ vòng ở vòng này
  von_truoc: number;    // vốn đầu vòng
  von_sau: number;      // vốn sau khi chia Quỹ vòng
  /** v10 NAV — delta CHIP từng mã sau định giá (tổng khớp NAV theo cấu trúc). */
  tien_theo_ma?: Record<string, number>;
  /**
   * §7.3 — BRIER của vòng (thang 0–2, thấp là tốt). `null` = ghế toàn tiền mặt,
   * tức KHÔNG dự báo — tầng đọc phải BỎ QUA, không thay bằng 0.
   *
   * ⚠ THUẦN QUAN SÁT: không đổi một chip nào, nên không cần cổng
   * `balance_version`. Trận cũ replay ra đúng kết quả cũ, chỉ thêm một số đọc.
   */
  brier?: number | null;
  /**
   * KỲ NGỘ (D85/D86) — vị thế TRƯỚC định giá + lợi suất từng mã của vòng.
   *
   * ⚠ PHÁT RA TỪ ĐÚNG CHỖ TÍNH BRIER, không tính lại: hai thước ("đúng hướng",
   * "độ chuẩn") phải nhìn CÙNG một vòng bằng CÙNG một số. Tính lại ở tầng trên
   * là dựng bản sao thứ hai, và bản sao thứ hai sẽ trôi (D61) — cú trôi ở đây
   * biểu hiện là nhiệm vụ báo "đọc đúng" cho một vòng mà Brier nói ngược lại.
   * ⚠ `vi_the_truoc` là ảnh chụp TRƯỚC `apDinhGia` — chấm NIỀM TIN lúc vào lệnh,
   * không chấm kết quả sau khi giá đã chạy (cùng lý lẽ Brier).
   * Optional: chỉ có ở trận NAV, và trận cũ không có ⇒ nhiệm vụ bỏ qua vòng đó.
   */
  vi_the_truoc?: Record<string, number>;
  loi_suat_ma?: Record<string, number>;
  /** v10 NAV — NAV mốc đo (sau nộp nền) và NAV sau định giá + lạm phát. */
  nav_truoc?: number;
  nav_sau?: number;
  /**
   * D35 hướng 1 — ba trường ĐÒN BẨY TỪ CAM KẾT (v8).
   *
   * ⚠ PHẢI TRẢ RA, KHÔNG ĐƯỢC SUY Ở CLIENT (C4 + D25/R1): cam kết nay quyết
   * định thứ hạng, nên "tôi vừa chịu đòn bẩy mấy lần" là một phần của KẾT QUẢ,
   * không phải một con số trang trí. `ty_le_cam_ket_bp` là cột khẩu vị rủi ro
   * mà A7 phải log — "cam kết bao nhiêu % Vốn khi đang ở hạng mấy".
   *
   * Trận trước v8: `he_so_don_bay_bp` = 10000 (1,0×) và `phi_don_bay` = 0, tức
   * đọc ra "không có đòn bẩy" chứ không phải null — client không phải phân
   * nhánh theo phiên bản.
   */
  ty_le_cam_ket_bp: number;
  he_so_don_bay_bp: number;
  phi_don_bay: number;
}

export interface HanhDongVong {
  ghe_id: string;
  /**
   * 'giu_vi_the' = check · 'tang_cam_ket' = raise · 'cat_lo' = bỏ MỘT vòng ·
   * 'dung_ngoai' = rời tới hết trận nhưng còn tính hạng · 'dau_hang' = thoát,
   * thua, không hạng.
   *
   * ⚠ BA CÁCH RA LÀ BA HÀNH ĐỘNG KHÁC NHAU, đừng gộp. Trước 25/07/2026 UI chỉ
   * gửi được `cat_lo` (bỏ một vòng) cho CẢ hai nhánh "Đứng ngoài" và "Đầu hàng",
   * nên hai tư thế `dung_ngoai`/`dau_hang` KHÔNG BAO GIỜ được gán — và kéo theo
   * `PHI_DUNG_NGOAI` cùng luật xếp-bét-bảng của người đầu hàng thành CODE CHẾT,
   * dù cả hai đều có test riêng và đều "đúng" khi test gọi trực tiếp.
   * Nhãn nút còn hứa "ngồi xem tới hết trận" trong khi engine chỉ bỏ một vòng.
   */
  hanh_dong: 'giu_vi_the' | 'tang_cam_ket' | 'cat_lo' | 'dung_ngoai' | 'dau_hang';
  /** Chỉ dùng khi tăng cam kết. Chip ảo. */
  them: number;
}

export interface KetQuaVong {
  vong: number;
  o: OThiTruong;
  /**
   * CHỢ đổi bao nhiêu ở vòng này (bp) — TRUNG VỊ lợi suất các mã trên bảng
   * CÔNG KHAI. Nền của thanh PHONG CÁCH (`phong_cach.ts`) và của mốc "cắt
   * trước cú sập" (`dau_moc.ts`).
   * ⚠ TRUNG VỊ chứ không phải TRUNG BÌNH — với trung bình thì một danh mục dàn
   * đều KHÔNG BAO GIỜ vượt mốc (nó ≡ trung bình) ⇒ thước âm thầm phạt đa dạng
   * hoá, tức phạm §1.2 qua cửa sau. Đo được: dàn đều hơn chợ 50% với trung vị,
   * 0% với trung bình.
   * `null` ở trận không NAV (không có bảng công khai để lấy trung vị).
   */
  cho_bp: number | null;
  /** Tin giả của vòng TRƯỚC lộ ở vòng này (null nếu không có). */
  tin_gia_lo: { vong: number; su_kien: string } | null;
  /**
   * v42 (D311) — COUPON đã trả vòng này. `tien` = vào tiền mặt (sổ dài);
   * `khong` = bị trừ khỏi ký quỹ (người khống trả lãi cho chủ tờ). Rỗng khi
   * cờ `coupon_tpcp` tắt hoặc không ai cầm mã trả coupon.
   */
  coupon?: readonly { ghe_id: string; ma: string; tien: number; khong: number }[];
  /** D498 — PHÍ QUẢN LÝ của Tổ Chức (cờ `toChucV57`): chip vào tiền mặt mỗi vòng = floor(NAV × `TO_CHUC_V57.PHI_QL_BP`/10⁴). Vắng khi cờ tắt. */
  quan_ly?: readonly { ghe_id: string; nav: number; tien: number }[];
  /**
   * v42 (D311) — CÚ SỐC LÊN TIỀN MẶT TỰ DO (ô lạm phát). `mat` âm = mất tiền.
   * Có cả ghế `dung_ngoai`: đứng ngoài không né được lạm phát.
   */
  tien_mat_su_kien?: readonly {
    ghe_id: string; mat: number;
    chi_tiet: readonly { su_kien: string; delta_bp: number; dao: boolean }[];
  }[];
  /**
   * v43 (D314) — SỔ TIẾT KIỆM động vòng này.
   *  · `lai`      — cộng lãi treo (tiền CHƯA vào ví, nhưng đã vào NAV);
   *  · `dao_han`  — gốc + toàn bộ lãi treo về TIỀN MẶT, hợp đồng đóng;
   *  · `huy`      — gốc về tiền mặt, `lai_mat` là phần lãi treo bị mất sạch.
   *  · `lam_phat` — v54 (D405): lạm phát ăn vào GỐC trong sổ; `mat` = chip mất (âm nếu tin giả lộ trả ngược).
   *  · `do_vo`    — v54 (D405): ngân hàng đổ vỡ, `mat` = phần gốc mất trên số vượt hạn mức bảo hiểm.
   * `goc` của `lam_phat`/`do_vo` là gốc SAU khi mất. Hai loại mới chỉ có khi cờ bật — trận cũ không đổi một dòng.
   */
  tiet_kiem?: readonly {
    ghe_id: string; loai: 'lai' | 'dao_han' | 'huy' | 'lam_phat' | 'do_vo';
    id: string; goc: number; lai: number; lai_mat?: number; mat?: number;
  }[];
  /**
   * v46 (D338) — LÃI VAY ĐÒN BẨY đã trừ vòng này. `vay` = giá trị (trước khi giá chạy) của
   * các vị thế đang được nhân đôi; `lai_bp` = mức bp/ô lúc trừ; `lai` = chip THỰC trừ (tiền
   * mặt trước, thiếu thì bán bớt vị thế). VẮNG khi cờ `lai_vay_don_bay` tắt.
   */
  lai_vay_don_bay?: readonly { ghe_id: string; vay: number; lai_bp: number; lai: number }[];
  ket_qua: readonly KetQuaGhe[];
  quy_vong: number;
  /** Ghế thắng Quỹ vòng — null nếu mọi người đều cắt lỗ. */
  ghe_thang: string | null;
  chay_vong_nay: readonly string[];
  /** Số pot đã hình thành (>1 nghĩa là có người all-in ít hơn). */
  so_pot: number;
  /**
   * Ai bị bào mất bao nhiêu vì ĐỨNG NGOÀI vòng này.
   * Phải trả ra để UI cho thấy — đứng ngoài mà không thấy mình đang chảy máu
   * thì người chơi tưởng đó là lựa chọn miễn phí, đúng thứ cơ chế này chống.
   */
  phi_dung_ngoai: readonly { ghe_id: string; mat: number }[];
  /**
   * D2 — ai mất bao nhiêu vì CẮT LỖ vòng này, và có bị giẫm đạp không.
   *
   * Phải trả ra, cùng lý do như phí đứng ngoài: nước đi mà người chơi không
   * thấy giá của nó thì họ không học được gì từ nó. `giam_dap` là thứ RIÊNG —
   * "tôi mất gấp đôi vì cả bàn cùng chạy" là một bài học khác hẳn "tôi mất phí".
   */
  phi_cat_lo: readonly { ghe_id: string; mat: number; giam_dap: boolean }[];
  /**
   * D35 hướng 1 — ai trả bao nhiêu PHÍ TÀI TRỢ đòn bẩy vòng này.
   *
   * Trả ra vì cùng lý do với `phi_dung_ngoai` và `phi_cat_lo`: nước đi mà người
   * chơi không thấy giá của nó thì họ không học được gì từ nó — và đây là khoản
   * duy nhất của cụm đòn bẩy trừ thẳng Vốn, tức là khoản duy nhất đẩy được
   * người ta tới cháy tài khoản.
   */
  phi_don_bay: readonly { ghe_id: string; mat: number }[];
  /** Bao nhiêu phần lobby đã cắt lỗ vòng này (bp) — để UI kể chuyện giẫm đạp. */
  ty_le_cat_lo_bp: number;
  /**
   * T6 — GỌI KÝ QUỸ: ai bị trừ thẳng Vốn vì ôm Đòn Bẩy khi Hack sàn nổ.
   *
   * ⚠ Đây là cơ chế DUY NHẤT (ngoài cược và phí đứng ngoài) chạm được `von`.
   * `pnl_bp` chỉ dùng để SẮP HẠNG chia Quỹ vòng — nó không bao giờ cộng/trừ
   * vào vốn. Nên mọi "phí" viết bằng bp chỉ dịch thứ hạng, không đẩy được ai
   * tới cháy tài khoản. Muốn có cú đẩy qua vạch cháy thì phải trừ Vốn thật.
   */
  goi_ky_quy: readonly { ghe_id: string; mat: number }[];
  /** v34 — đội lái bị SIẾT PHÁP LÝ vòng này (trừ thẳng Vốn). Rỗng ở trận không vai. */
  siet_doi_lai: readonly { ghe_id: string; mat: number }[];
  /** v55 (D409) — lửa/xu từng ghế cuối vòng. CHỈ có khi cổng `lua` bật (trận cũ vắng — golden ghim `ketQuaCuoi` byte-hệt). */
  lua?: readonly {
    ghe_id: string; truoc: TrangThaiLua | null; sau: TrangThaiLua; dap: LyDoDap | null; xu_them: number;
  }[];
}

export interface TrangThaiTran {
  seed: number;
  map: HoldemMap;
  vong: number;
  ghe: readonly Ghe[];
  /**
   * D4 — số người nắm từng mã ở CUỐI VÒNG TRƯỚC.
   *
   * Cần cho điều kiện "dồn 2 vòng LIÊN TIẾP": chỉ có số hiện tại thì không phân
   * biệt được "cả bàn vừa đổ vào" với "cả bàn đã ôm suốt". Là hàm thuần của
   * (seed, action_log) nên replay dựng lại y hệt, và KHÔNG cần lưu DB.
   */
  dong_truoc?: Readonly<Record<string, number>>;
  /**
   * D4 — nhật ký các ô đã bị THAY. Chỉ để quan sát/test/kể lại, không dùng để
   * tính gì: bản thân `map.o` đã mang ô hiệu dụng.
   */
  phan_than?: readonly { vong: number; tu: string; den: string; vi: 'don' | 'tron' }[];
  /**
   * v35 — LOG các cú BẺ CHUỖI BẰNG VỐN (D160). Tách khỏi `phan_than` CÓ CHỦ
   * ĐÍCH: gate D4 đếm cú thay ô của phản thân — trộn hai máy vào một sổ là
   * mọi số gate đo lẫn.
   */
  be_chuoi?: readonly { vong: number; tu: string; den: string; huong: 'len' | 'xuong' }[];
  /**
   * CỔNG LUẬT VỐN — bật hai cơ chế của founder 27/07 (Đảo danh mục · Khoá 2 vòng).
   *
   * ⚠ MẶC ĐỊNH TẮT, VÀ MẶC ĐỊNH ĐÓ LÀ BẮT BUỘC. Trận không lưu state: mỗi request
   * dựng lại từ (seed, action_log), nên đổi luật engine là VIẾT LẠI mọi trận đã
   * lưu — im lặng, không lỗi, không cách nào biết. Cùng lý do D30 phải gán cổng
   * cho hành vi bot. Người gọi lấy giá trị từ `luatCua(row.balance_version).luatVon`.
   *
   * Trường này đi theo state qua mọi vòng (`chotPhien` giữ lại bằng spread), nên
   * chỉ cần đặt một lần lúc `taoTran`.
   */
  luat_von?: boolean;
  /**
   * CỔNG ĐẶC QUYỀN (D33/D34) — bật năm đặc quyền thẻ chiến thuật + nhịp chọn
   * thẻ ba lần + gate All-in.
   *
   * ⚠ MẶC ĐỊNH TẮT, cùng lý do sống-còn với `luat_von`: trận không lưu state,
   * mỗi request dựng lại từ (seed, action_log). Đặc quyền đổi cả dây chuyền chấm
   * điểm LẪN nhịp mua thẻ, nên bật vô điều kiện là VIẾT LẠI mọi trận đã lưu — im
   * lặng, không lỗi, không cách nào dựng lại.
   * Người gọi lấy giá trị từ `luatCua(row.balance_version).dacQuyen`.
   */
  dac_quyen?: boolean;
  /**
   * CỔNG ĐÒN BẨY CAM KẾT (D35 hướng 1, v8) — tỷ lệ cam kết nhân vào `pnl_bp`
   * của chính ghế đó, cộng phí tài trợ trừ thẳng Vốn.
   *
   * ⚠ MẶC ĐỊNH TẮT, cùng lý do sống-còn với `luat_von`/`dac_quyen`. Cơ chế này
   * đổi THỨ HẠNG chia Quỹ vòng, tức đổi luôn dòng Vốn của mọi vòng sau — bật vô
   * điều kiện là viết lại kết quả mọi trận đã lưu, im lặng.
   * Người gọi lấy giá trị từ `luatCua(row.balance_version).donBayCamKet`.
   */
  don_bay_cam_ket?: boolean;
  /**
   * CỔNG ĐA DẠNG HOÁ NỚI TRẦN SỐ MÃ (v8). Xem `DAC_QUYEN.DA_DANG_HOA.TRAN_TAI_SAN_THEM`.
   *
   * Tắt cho trận cũ vì nới trần là cho phép một danh mục mà luật cũ TỪ CHỐI —
   * replay một action_log cũ dưới luật mới không đổi kết quả (log đó không chứa
   * lá thứ 5), nhưng bot đo lại chọn khác, nên vẫn phải có cổng.
   */
  da_dang_tran_tai_san?: boolean;
  /**
   * CỔNG GỌI KÝ QUỸ NỚI RỘNG (v8) — nổ ở MỌI ô, không riêng `hack_san`.
   * Xem `GOI_KY_QUY` trong config: đây là cần gạt KỸ NĂNG của lá Đòn Bẩy.
   */
  ky_quy_rong?: boolean;
  /**
   * D155 — phản thân D4 qua CỔNG (trước gác bằng ENV, lệch A11.3).
   * ⚠ MẶC ĐỊNH NGƯỢC với mọi cờ khác: VẮNG MẶT = BẬT. ENV cũ mặc định 1 và
   * prod không bao giờ bật HOLDEM_SWEEP, nên MỌI trận từng chạy đều có phản
   * thân — trường vắng phải nghĩa là "như xưa" thì trận cũ mới replay nguyên.
   * Chỉ `false` tường minh (bàn đo cô lập cơ chế) mới tắt.
   * (Tên có đuôi `_bat` vì `phan_than` đã là LOG các cú thay ô — hai thứ khác nhau.)
   */
  phan_than_bat?: boolean;
  /**
   * v35 — CHUỖI MỞ RỘNG (D157): các đường đọc bảng dây chuyền TRONG TRẬN
   * (Lướt Sóng dây chuyền · keo_theo telegraph · dự báo bảng điện tử) đi qua
   * `mtKeTiep(chuoi_mo_rong)`. Map đã nướng cạnh mới từ lúc sinh (cờ cùng tên
   * bên `sinhMap`); cờ này giữ cho phần ĐỌC trong trận nhất quán với map —
   * lệch nhau là Lướt Sóng chấm "gãy chuỗi" cho đúng cạnh map vừa dùng để sinh ô.
   */
  chuoi_mo_rong?: boolean;
  /**
   * v35 — BA LUẬT TƯƠNG TÁC THẺ (D158): ĐÚNG THUỐC (echo lạm phát bị tăng-lãi
   * THẬT dập sớm — cài trong `echoDangCo` nên định giá, bảng điện tử và bot tự
   * đồng nhất) · ĐỔ DẦU (bên máy sinh map, cờ cùng tên) · CỘNG HƯỞNG TRÚ ẨN
   * (`coCongHuongTruAn` + `machEcho`). Xem `TUONG_TAC_THE` trong config.
   */
  tuong_tac_the?: boolean;
  /**
   * v35 — BẺ CHUỖI VĨ MÔ BẰNG VỐN (D160). Xem `BE_CHUOI_VON` + `beChuoiCuaLobby`
   * — đếm VỐN, không đếm ghế; "phi lý = cả hai" (ngược chuỗi VÀ ngược môi trường).
   */
  be_chuoi_von?: boolean;
  /**
   * v36 R2 (D166) — vòng có TIN vẫn ăn NỀN vĩ mô (chiết khấu), thay vì bị ép
   * `di_ngang`. Xem `REGIME_TICK.NEN_TRONG_VONG_TIN_BP`.
   */
  gia_chong_nen?: boolean;
  /**
   * D386 — BOT ĐƯỢC CẤP `BoiCanhLenh.nen` Ở VÒNG TIN. Xem `botDocNen`.
   *
   * Tách khỏi `gia_chong_nen` CÓ CHỦ Ý dù hai cờ nói về cùng một hiện tượng: cờ kia
   * bật từ v36 và đang nằm trên đường replay của mọi trận đã lưu, nên dùng nó để mở
   * cửa cho bot là viết lại vị thế bot của tất cả trận v36–v52 (A11.3, cửa một chiều).
   */
  bot_doc_nen?: boolean;
  /**
   * v54 (D389) — map của trận này sinh bằng BÁNH XE MÙA CÓ NGÃ RẼ. Bot đọc để đoán lá úp
   * theo MÙA (xem `nenBanhXeCongKhai`) thay vì theo hướng chuỗi: mùa QUÁ NÓNG có hướng 0,
   * nên đọc theo hướng thì bot tưởng chợ đi ngang trong khi 8/10 lá sẽ là BIẾN ĐỘNG.
   */
  banh_xe?: boolean;
  /**
   * v36 — map của trận này sinh bằng MÁY TICK (D165). Bảng điện tử đọc để xếp
   * hạng dự báo bằng ĐÚNG máy đang sinh ô (D167) — bán phân phối của máy cũ là
   * bán thứ không tồn tại.
   */
  regime_tick?: boolean;
  /**
   * v37 — ÁP LỰC BÀN (D181). Xem `AP_LUC_BAN` + `napApLuc`.
   */
  ap_luc_ban?: boolean;
  /** v39 (D301) — cờ chu kỳ thực tế: một cửa cho bảng tin giả hiệu chỉnh ở bot/bảng/DTO. */
  chu_ky_thuc_te?: boolean;
  /** v40 (D302) — ô KỲ HỌP (lịch công khai) miễn nhiễm phản thân / bẻ chuỗi. Xem `apPhanThan`. */
  lich_khong_doi?: boolean;
  /**
   * v41 — LỚP VN (D307): chọn ma trận Tài sản×Giai đoạn / Tài sản×Sự kiện qua
   * `mtGiaiDoan`/`mtSuKien` thay vì hằng số toàn cầu. Bài học `bangCanTroi`
   * (xem docstring hai hàm đó trong config): engine đổi bảng mà bot đọc thẳng
   * hằng số thì bot mua theo bảng này, bị chấm bằng bảng kia — gate đo chênh
   * lệch hai bảng chứ không đo kỹ năng, và cú trôi đó không bao giờ ném lỗi.
   */
  lop_vn?: boolean;
  /**
   * v42 — BỘ SỐ TÀI SẢN v2 (D311). Cùng một cửa `boMaTranCua(st)` với `lop_vn`, và
   * ĐÈ LÊN nó: trận v42 đọc bảng V42 dù `lop_vn` cũng đang bật (quy ước xếp chồng
   * của `BO_LUAT_THEO_PHIEN_BAN` — bản mới mang mọi cờ cũ).
   */
  tai_san_v42?: boolean;
  /** v64 (D560) — chu kỳ có ngòi: bảng `mtGiaiDoan('v64')` (Quá nóng = cuối mùa tăng) · khoản lệch theo tính chất lá pha · sức căng có đèn. */
  chu_ky_co_ngoi?: boolean;
  /** v65 (D561) — Bán Khống chỉ ×2 (founder 07/10: hãm đòn bẩy chiều bán). */
  ban_khong_x2?: boolean;
  /** v65 (D561) — lõi của màn chọn lúc CHỐT VÒNG, trước khi lá lật (founder 07/10). */
  loi_chon_truoc?: boolean;
  /** v65 (D561) — Bắt Đáy / Mua Đuổi bán bớt được khoản đang cầm (founder 07/10). */
  ban_bot_bd_md?: boolean;
  /** v65 (D561) — xếp hạng cuối trận theo cách E (founder 07/10). */
  xep_hang_e?: boolean;
  /** v65 (D561) — ~45 % màn có hướng "đã vào giá": tin thật, giá quay đầu — dấu hiệu khối lượng cạn + nến rút chân (founder 07–08/10). */
  vao_gia?: boolean;
  /** v65 (D561) — màn đánh trên nhiều mã — chạm chart phụ đổi mã (founder 08/10: demo "tạm ổn"). */
  nhieu_ma?: boolean;
  /** v65 (D561) — khoản trong màn chạy theo giá tới cú bấm đầu (founder 08/10). */
  khoan_theo_duong?: boolean;
  /** v65 (D561) — màn của ô pha: lá úp tới hết màn (founder 08/10). */
  up_la_pha?: boolean;
  /** v66 (D566) — luật ô úp: lãi suất áp cho vòng N là mức của lá quyết toán `trang_thai[N]` (xem `laiSuatLuc`). */
  lai_ap_la_quyet_toan?: boolean;
  /** v67 (D574) — bối cảnh dài hạn (sóng công nghệ × pha nợ): nghiêng giá mỗi ô (`lechBoiCanh`) · tin vĩ mô trong màn. Map đã mang bối cảnh. */
  boi_canh_dai_han?: boolean;
  /** v68 (D584) — giải vòng trả bằng XU TRAIT: nền 0 (không hũ tiền, phí giao dịch không chia lại) · xếp hạng vòng ⇒ `xuGiaiTheoHang`. */
  giai_xu?: boolean;
  /** v69 (D586) — màn: BÁN BỚT bán hết được khoản giữ — Bắt Đáy · Mua Đuổi · màn không lõi; số lần theo Rải lệnh (`BAN_BOT_LAN`) (`nutLoiCua` · `luongBanBot`). */
  ban_bot_rai?: boolean;
  /** v70 (D589) — màn: VÀO 3 phần · Mua Đuổi ×2 + CHỐT gộp (`nutLoiCua` · `tienPhanVao`). */
  ba_phan?: boolean;
  /**
   * v42 — COUPON (D311): `tpcp` trả lãi vào TIỀN MẶT mỗi ô theo lãi suất nền đang
   * công bố; sổ khống trả ngược khoản đó. Đi cùng cổng với `tai_san_v42` — xem
   * docstring `couponTpcp` ở `config/holdem_balance.ts` (tách ra là trả lãi hai lần
   * hoặc nuốt mất carry).
   */
  coupon_tpcp?: boolean;
  /** v42 — KHỐNG THEO MÃ (D311): chặn lệnh MỞ khống mã có `khong_duoc === false`. */
  khong_theo_ma?: boolean;
  /**
   * v42 — TIỀN MẶT × SỰ KIỆN (D311): ô lạm phát trừ thẳng TIỀN MẶT TỰ DO. Bật cờ này
   * thì khối `PHI_DUNG_NGOAI` thôi cộng `LAM_PHAT_BP` — một nguồn, không thu hai lần.
   */
  tien_mat_su_kien?: boolean;
  /**
   * v43 — KHOÁ NẮM GIỮ TẮT (D314): `apKhoaTaiSan` từ chối bằng `co_che_tat`. Code khoá
   * GIỮ NGUYÊN để trận ≤ v42 replay đúng `khoa_thuong`/`be_keo`.
   */
  khoa_tai_san_tat?: boolean;
  /** v43 — NGÂN HÀNG (D314): hợp đồng gửi tiết kiệm. Xem `HopDongTietKiem`. */
  ngan_hang?: boolean;
  /** v44 — LỚP TƯƠNG QUAN TÀI SẢN v2 (D315): bật `BETA_V44`. Xem `betaCua`. */
  beta_tai_san_v2?: boolean;
  /**
   * v45 — ĐƯỜNG CONG LỢI SUẤT (D318): coupon suy từ lợi suất DÀI (`laiSuatDaiBp`)
   * thay vì đọc thẳng lãi chính sách. Đường cong đảo ngược được khi lãi vượt ~567 bp.
   */
  duong_cong?: boolean;
  /** v45 — biên nhiễu rà lại cho bốn mã còn lại (`BIEN_DONG_V45`). */
  bien_dong_v45?: boolean;
  /**
   * v45 — COUPON PHẢI GIỮ ĐỦ MỘT Ô (D318, founder 09/09).
   *
   * Trái phiếu Mỹ trả lãi NỬA NĂM MỘT LẦN, mà 1 ô = nửa năm. Trước v45 ai mua ở ô
   * nào cũng ăn coupon ngay ô ấy — tức nhặt được lãi miễn phí bằng cách nhảy vào
   * sát ngày chốt. Ngoài đời không có chuyện đó: mua giữa kỳ thì người mua TRẢ
   * phần lãi đã dồn cho người bán. Xem `GheNav.vi_the_o_truoc`.
   */
  coupon_giu_du?: boolean;
  /**
   * v46 (D338) — ĐÒN BẨY NHÂN ĐÚNG TỪNG MÃ: mỗi mã trong đích một mắt xích `nhan` mang `ma`,
   * `chotPhien` dồn vào tầng THEO MÃ của `apDinhGia`. Xem `dichDonBayTheoMa`.
   */
  don_bay_theo_ma?: boolean;
  /** v46 (D338) — LÃI VAY ĐÒN BẨY mỗi ô trên phần tiền đang được nhân đôi (`laiVayDonBayBp`). */
  lai_vay_don_bay?: boolean;
  /**
   * v47 (D339) — KHẨU VỊ RỦI RO NHÂN ĐÚNG BIÊN ĐỘ: bước 6 `dungChuoi` chia hệ số theo
   * từng phần (mỗi mã một mắt xích `khau_vi` mang `ma`, cộng một mắt xích cho phần danh
   * mục) thay vì một mắt xích gộp rơi vào tầng danh mục. Xem `tangCuaMatXich`.
   */
  khau_vi_theo_ma?: boolean;
  /**
   * v48 (D340) — RỦI RO ĐỐI TÁC TRỪ ĐÚNG MỘT LẦN: `phong_thu` mang phần ăn ĐẦY ĐỦ và
   * `doi_tac` là dòng TRỪ thật, thay vì teo phần ăn RỒI còn trừ tiếp trong chuỗi (⇒ tiền
   * áp 0). Xem `BoLuatCanBang.doiTacTruMotLan`.
   */
  doi_tac_tru_mot_lan?: boolean;
  /**
   * v49 (D342) — SỔ KHỐNG ĂN NGƯỢC ĐÚNG GIÁ CHỢ: mỗi mã đang khống có một mắt xích
   * `khong_gia` (tầng KHỐNG), kể cả mã không cầm dài; khẩu vị và Đòn Bẩy nhân đúng phần đó.
   * Xem `BoLuatCanBang.khongTheoGia`.
   */
  khong_theo_gia?: boolean;
  /** v49 (D342) — chip KHỐNG tính trên HẠN MỨC khống còn lại. Xem `BoLuatCanBang.khongTheoHanMuc`. */
  khong_theo_han_muc?: boolean;
  /** v49 (D342) — lá Bán Khống hết cộng/trừ cả danh mục theo tin. Xem `BoLuatCanBang.banKhongThuanQuyen`. */
  ban_khong_thuan_quyen?: boolean;
  /** v49 (D342) — `xep_hang` (+ phần hoàn của Khớp Nhanh) vào tầng MÃ. Xem `BoLuatCanBang.xepHangTheoMa`. */
  xep_hang_theo_ma?: boolean;
  /** v50 (D345) — phí mua bán nhẹ theo cỡ tiền + Khớp Nhanh giảm. Xem `BoLuatCanBang.phiLenhNhe`. */
  phi_lenh_nhe?: boolean;
  /** v51 (D346) — phí mua bán HAI BẬC (bậc 1 như ngoài đời). Xem `BoLuatCanBang.phiLenhBac`. */
  phi_lenh_bac?: boolean;
  /** v52 (D371) — bộ số Đa Dạng Hoá hoà vốn ở ~1 mã. Xem `BoLuatCanBang.daDangV52`. */
  da_dang_v52?: boolean;
  /** v53 (D373) — ô của vòng còn ÚP tới lúc chốt. Xem `BoLuatCanBang.oUp`. */
  o_up?: boolean;
  /**
   * v37 — ÁP LỰC TÍCH LUỸ hiện tại của bàn, bp (0..`AP_LUC_BAN.TRAN_BP`).
   *
   * ⚠ ĐÂY LÀ TRÍ NHỚ, KHÔNG PHẢI ẢNH CHỤP: nó cộng dồn mức dồn của các vòng
   * TRƯỚC rồi mòn dần, nên bàn dồn 5 vòng liền khác hẳn bàn vừa dồn một vòng —
   * đúng chỗ mà hai máy thay ô cũ (công tắc ngưỡng) không phân biệt được.
   * Suy tất định từ `ghe` mỗi vòng ⇒ replay lại ra đúng số, không cần lưu log.
   */
  ap_luc_bp?: number;
  /**
   * CỔNG MA TRẬN TƯƠNG QUAN (v9, D39). Xem `TUONG_QUAN` trong config và
   * `nhieuCua()` bên dưới — kể cả vì sao cổng này KHÔNG được đọc `la_tin_gia`.
   */
  tuong_quan?: boolean;
  /** D43 bước 4 (v13) — sức căng: độ lớn chốt phiên nhân theo S. */
  suc_cang?: boolean;
  /** v14 — nền là phí quản lý trừ trên NAV. */
  nen_nav?: boolean;
  /**
   * v26 — LÃI SUẤT NỀN công khai (founder 04/08). Bật ⇒ `sinhMap` chạy một mức
   * tích luỹ, và mức đó nghiêng xác suất thẻ sự kiện + dịch nấc thanh khoản.
   * Xem `LAI_SUAT_NEN`. Tắt ⇒ `laiSuatLuc` trả `null` và không gì đổi.
   */
  lai_suat_nen?: boolean;
  /**
   * v28 — tin có gốc, tin giả có hậu quả (MAP_V28). Bot hoài nghi đọc cờ này
   * để chiết khấu theo tỷ lệ HIỆU DỤNG công khai thay vì tỷ lệ bối cảnh cũ.
   */
  map_v28?: boolean;
  /** v29 — phí vội vàng phi tuyến theo cỡ lệnh. Xem `NAV_V10.VOI_VANG`. */
  phi_voi_vang?: boolean;
  /**
   * Phá hoà Quỹ vòng bằng băm thay vì bằng chuỗi id ghế. Xem chú thích dài ở
   * `chotPhien` — không có nó thì ghế người (`'ban'`) thắng mọi cú hoà.
   */
  hoa_cong_bang?: boolean;
  /** v15 — biên độ/bất đối xứng chu kỳ áp vào độ lớn chốt phiên. */
  co_chu_ky?: boolean;
  /** v17 — lệnh bán khống mở (doc 05). */
  lenh_khong?: boolean;
  /** v18 — hệ quả CHƯA LẬT thôi cắn giá. Xem `BoLuatCanBang.boNhanhHeQua`. */
  bo_nhanh_he_qua?: boolean;
  /** v19 — bảng xung đột GỌN (XUNG_DOT_V19). Xem `BoLuatCanBang.xungDotGon`. */
  xung_dot_gon?: boolean;
  /** v20 — bảng cộng hưởng GỌN (CONG_HUONG_V20). Xem `BoLuatCanBang.congHuongGon`. */
  cong_huong_gon?: boolean;
  /** v21 — cân trôi kỳ vọng theo mã (CAN_TROI_BP). Xem `BoLuatCanBang.canTroi`. */
  can_troi?: boolean;
  /** v22 — bot mua theo bối cảnh (D56). Xem `CongLuatTran.botDocTin`. */
  bot_doc_tin?: boolean;
  /** v23 — bảng cân trôi vòng hai (D58). Xem `CAN_TROI_BP_V23`. */
  can_troi_2?: boolean;
  /** v30 — bot dùng đúng thước engine. Xem `BoLuatCanBang.botDungThuocThat`. */
  bot_dung_thuoc_that?: boolean;
  /** v31 — Quỹ vòng co giãn theo số ghế. Xem `BoLuatCanBang.quyCoGian`. */
  quy_co_gian?: boolean;
  /**
   * v32 — KỲ NGỘ TRONG TRẬN bật. Xem `BoLuatCanBang.kyNgo`.
   *
   * ⚠ Engine KHÔNG tự chạy kỳ ngộ: nhiệm vụ được chấm ở `server/holdem/ky_ngo.ts`
   * và tích luỹ trong `replay` (tầng API), vì nó cần chuỗi kết quả NHIỀU vòng
   * chứ không phải một vòng. Cờ này ở đây chỉ để (a) `apPhiMoBang` biết có
   * PHIẾU MỞ BẢNG không, (b) tầng trên hỏi ĐÚNG MỘT cửa thay vì tự nhớ bộ luật.
   */
  ky_ngo?: boolean;
  /**
   * v33 — GIÃN LỚP CHIẾN THUẬT Ở MAP NGẮN (D90 M1): map 8 chọn lá ở 2·4·6.
   * Nằm trên trạng thái để MỌI cửa hỏi nhịp (shop, đồng hồ, payload) đọc CÙNG
   * một nguồn thay vì mỗi nơi tự nhớ bộ luật — cú lệch ở đây là shop bày lá ở
   * vòng server từ chối.
   */
  gian_la?: boolean;
  /** v34 — VAI có răng (vốn · tác động giá · lõi ghim · bị siết). Xem `vai.ts`. */
  vai_co_rang?: boolean;
  /**
   * v54 (D389) — VỐN ĐỀU: vai giữ răng (tác động giá · lõi ghim · siết · mandate) nhưng mọi ghế
   * vào trận `START_VON`. Một cửa cho vốn khởi điểm: `vonDauCua` (xếp hạng + quy chiếu).
   */
  von_deu?: boolean;
  /** v54 (D389) — LÕI GỌN: năm lõi bị động (`LOI_BI_CAT`) rời shop và rời lõi ghim của vai. */
  loi_gon?: boolean;
  /**
   * v54 (D395) — THANH KHOẢN NĂM NẤC: `nacHieuDung` đọc năm nấc (`config/thanh_khoan_nam_nac.ts`),
   * CẠN THANH KHOẢN + mọi tin hoảng loạn làm mỏng sổ. Vắng = luật ba nấc của D1.
   */
  thanh_khoan_nam_nac?: boolean;
  /** v54 (D389) — KHẨU VỊ TẮT: mọi ghế đúng `KHAU_VI_MAC_DINH`. */
  khau_vi_tat?: boolean;
  /** v54 (D403) — BỎ BÀI TẮT: 'bo' rời `duoc` của mọi ghế ở `choiVongCuoc`. Xem `BoLuatCanBang.boBaiTat`. */
  bo_bai_tat?: boolean;
  /** v54 (D403) — QUỸ THEO CỠ BÀN: nền mỗi ghế co theo số ghế của bàn. Một cửa: `nenVongCua`. */
  quy_theo_co_ban?: boolean;
  /** v54 (D403) — TRẦN PHẦN MỘT GHẾ trong mỗi pot (`chotPhien`). Xem `BoLuatCanBang.quyTranHang1`. */
  quy_tran_hang_1?: boolean;
  /** v54 (D405) — sổ tiết kiệm chịu lạm phát như tiền mặt. Xem `BoLuatCanBang.tietKiemLamPhat`. */
  tiet_kiem_lam_phat?: boolean;
  /** v54 (D405) — lãi sổ thả nổi theo lãi suất nền đang chạy. Xem `BoLuatCanBang.tietKiemThaNoi`. */
  tiet_kiem_tha_noi?: boolean;
  /** v54 (D405) — ngân hàng đổ vỡ hiếm. Xem `BoLuatCanBang.nganHangDoVo` · `config/tiet_kiem_kinh_te.ts`. */
  ngan_hang_do_vo?: boolean;
  /** v55 (D409) — chín cổng lửa/trait/Lướt Sóng mới; vắng = trận trước v55. */
  lua?: boolean;
  lua_phi?: boolean;
  lua_quyet_toan?: boolean;
  lua_mua_duoi?: boolean;
  nhiem_vu_loi?: boolean;
  trait_bat?: boolean;
  trait_vai?: boolean;
  chan_lo_trait?: boolean;
  luot_song_moi?: boolean;
  /** v55 (D411) — cổng `gopXu`: VÀNG (lượt khảo sát) gộp vào XU — một ví, xem `viKhaoSat`. */
  gop_xu?: boolean;
  /** v55 (D411) — cổng `khaoSatDauMienPhi`: lần khảo sát lại đầu mỗi vòng miễn phí — xem `chiPhiKhaoSat`. */
  khao_sat_dau_mien_phi?: boolean;
  /** v55 (D422) — cổng `luaKhongPhatDao`: lửa không trừ thêm ở mã lỗ — xem `matXichLua`. */
  lua_khong_phat_dao?: boolean;
  /** v55 (D422) — cổng `kyLuatSauDonBay`: sàn KỶ LUẬT / trần CHỐT NON sau Đòn Bẩy, KỶ LUẬT không phí. */
  ky_luat_sau_don_bay?: boolean;
  /** v56 (D447) — cổng `phiCongDonVong`: phí bậc hai trên TỔNG đổi tay mỗi mã trong vòng — xem `Ghe.doi_ma_vong`. */
  phi_cong_don_vong?: boolean;
  /** v57 (D456) — cổng `khongBangDienTu`: `/bang-dien-tu` trả `luat_tat`, DTO báo web ẩn nút. Xem `BoLuatCanBang.khongBangDienTu`. */
  khong_bang_dien_tu?: boolean;
  /** v57 (D456) — cổng `theLuonThat`: `sinhMap` không rút tin giả, mọi tỷ lệ tin giả đọc ra 0. Xem `BoLuatCanBang.theLuonThat`. */
  the_luon_that?: boolean;
  /** v57 (D457) — cổng `dongHoMinigame`: đồng hồ nhịp ngắn (`DONG_HO_MINIGAME`); DTO báo web ẩn khoảnh khắc từng vòng. */
  dong_ho_minigame?: boolean;
  /** v57 (D457) — cổng `khoTraitHep`: chợ trait chỉ chào `KHO_TRAIT_HEP`. Xem `khoTraitCua`. */
  trait_kho_hep?: boolean;
  /** D482 — cổng `traitGhimMinigame`: vai thôi ghim lõi; cặp vai đọc `TRAIT_VAI_MINIGAME` (trait ghim). Xem `traitVaiCua`. */
  trait_ghim_minigame?: boolean;
  /** D498 — cổng `toChucV57`: Tổ Chức không margin (`mandateCua().camDonBay`) + phí quản lý mỗi vòng; Rải lệnh độc quyền vai đặc biệt. */
  to_chuc_v57?: boolean;
  /** D506 — cổng `vonVaiV57`: vốn đầu theo `HE_SO_VON_V57` (×10 · ×20 · ×50). Xem `vonDauCua`. */
  von_vai_v57?: boolean;
  /** D516 — cổng `phiSauVaiV57`: phí hai bậc quy chiếu độ sâu theo vốn vai (`sauPhiVaiBp`). Xem `phiLenhCua`. */
  phi_sau_vai_v57?: boolean;
  /** D517 — cổng `bayCaNhanV57`: màn minigame có BẦY CÁ NHÂN (`soCaNhanCung`). */
  bay_ca_nhan_v57?: boolean;
  /** D526 — cổng `nhipXenKe`: lịch màn · chợ trait · lượt lõi theo `NHIP_XEN_KE` (bàn 8 ô); vòng 1 có màn. */
  nhip_xen_ke?: boolean;
  /** D528 — cổng `keLenhV59`: trait kê mua/kê bán · tâm lý yếu · trần thua Tổ Chức áp khoản giữ · vai ghế khác giấu (trừ SOI VAI). */
  ke_lenh_v59?: boolean;
  /**
   * D530 — cổng `loiChiTrongMan`: lá lõi chỉ tác động qua MÀN minigame. Engine đọc ghế như KHÔNG cầm lõi trong `dungChuoi` (cùng đường TÊ LIỆT —
   * canh nhịp · Đòn Bẩy ×2 · sóng Lướt Sóng · hàng tin · cặp lõi) và thôi lãi vay Đòn Bẩy · gọi ký quỹ vòng · mở sổ khống bằng lá Bán Khống.
   */
  loi_chi_trong_man?: boolean;
  /** D536 — cổng `lenhLonV61`: màn minigame có LỆNH LỚN của bot Cá Mập / Đội Lái cùng mã (`vaiLonCung`) + cột khối lượng. */
  lenh_lon_v61?: boolean;
  /** v34 — gọi ký quỹ trừ từ NAV (tiền mặt trước, thiếu pro-rata vị thế). Xem `truVonTuNav`. */
  ky_quy_tu_nav?: boolean;
  /** v24 — cỡ vị thế theo độ tin (D58). Xem `CO_VI_THE`. */
  co_vi_the?: boolean;
  /** 28/07 — máy cược tuần tự TẮT: vòng cược chỉ thu nền. Xem `BoLuatCanBang.cuocTat`. */
  cuoc_tat?: boolean;
  /** v10 — engine NAV bật. Xem `BoLuatCanBang.nav`. */
  nav?: boolean;
  /** v10 — phí + trượt giá giao dịch GOM TRONG VÒNG NÀY, đổ vào Quỹ vòng khi chốt. */
  phi_giao_dich_vong?: number;
  /**
   * LÕI VỐN A — tập mã mỗi ghế nắm ở CUỐI VÒNG TRƯỚC.
   *
   * Song song với `dong_truoc` và cùng lý do tồn tại: hàng chờ khớp lệnh đo DÒNG
   * TIỀN MỚI, mà "mới" thì phải có cái cũ để trừ đi. `dong_truoc` chỉ đếm đầu
   * người theo mã nên không nói được ghế NÀO vừa vào — hai người đổi chỗ cho nhau
   * giữa hai mã sẽ để lại con đếm y nguyên trong khi thực tế có hai lệnh mới.
   *
   * Là hàm thuần của (seed, action_log) nên replay dựng lại y hệt, KHÔNG cần cột DB.
   * Thiếu (vòng đầu, hoặc trận cũ) ⇒ không ai bị tính là vào mới — hướng an toàn.
   */
  tai_san_truoc?: Readonly<Record<string, readonly string[]>>;
}

// ---------------------------------------------------------------------------
// Khởi tạo
// ---------------------------------------------------------------------------

/**
 * Ghế LÚC MỚI DỰNG — chỉ danh tính, mọi trường trạng thái do `taoTran` cấp.
 *
 * ⚠ CÓ TÊN, đừng chép lại `Omit<Ghe, ...>` ở nơi dùng. Danh sách này từng bị
 * chép tay ở 6 chỗ (factory, sơ đồ ghế API ×2, 4 file test), nên thêm một trường
 * vào `Ghe` là vỡ cả 6 — và cách sửa nhanh nhất lúc đó luôn là dán trường mới
 * vào từng fixture, tức là mỗi fixture tự khai một giá trị khởi đầu riêng. Đúng
 * kiểu nợ mà A8.9 bắt chặn: sai lệch âm thầm giữa test và bản chạy thật.
 */
export type GheMoi = Omit<Ghe,
  'von' | 'luot_khao_sat' | 'da_chay' | 'vong_chay' | 'tu_the' | 'vong_roi'
  | 'so_lan_cat_lo' | 'dao' | 'khoa' | 'be_keo_vong' | 'giam_von_den_vong'
  | 'short' | 'vi_the' | 'tiet_kiem' | 'tk_su_kien_vong'
  | 'vi_the_o_truoc' | 'vi_the_khong_o_truoc'>;

/**
 * LUẬT → TUỲ CHỌN SINH MAP: MỘT CỬA cho mọi nơi dựng map (D169).
 *
 * ⚠⚠ VÌ SAO PHẢI CÓ HÀM NÀY — nó vừa bắt được một lỗi ĐANG CHẠY: khối này tồn
 * tại BẢN THỨ HAI chép tay ở `server/hanh_vi/kho.ts` (dựng lại map để trải kho
 * hành vi), và bản đó DỪNG LẠI Ở v32 — thiếu cả bốn cờ v35/v36. Từ lúc v35
 * thành mặc định (D164), mọi dòng phái sinh của trận v35 được dán nhãn theo
 * MỘT TRÒ KHÁC: `o_su_kien` · `la_tin_gia` · `chuoi_tang` đều đọc từ map sai.
 * Hỏng IM LẶNG — không lỗi, không test đỏ, chỉ có dữ liệu tính cách sai.
 * Đây đúng bẫy D61 (bản sao SẼ trôi) rơi vào đúng chỗ đắt nhất: tầng ĐO.
 *
 * Thêm cờ map mới ⇒ sửa ĐÚNG hàm này; test `mot_cua_sinh_map` cấm mọi lời gọi
 * `sinhMap` ở tầng server tự dựng object tuỳ chọn.
 */
export function tuyChonSinhMap(luat: CongLuatTran): Parameters<typeof sinhMap>[2] {
  return {
    lich: luat.lichChinhSach ?? false, quanTinh: luat.quanTinh ?? false,
    sucCang: luat.sucCang ?? false,
    chuKy: luat.chuKy ?? false, duoiTelegraph: luat.duoiTelegraph ?? false,
    duoi5: luat.duoi5 ?? false,
    laiSuatNen: luat.laiSuatNen ?? false,
    bongBongChuoi: luat.bongBongChuoi ?? false,
    mapV28: luat.mapV28 ?? false,
    banSac: luat.banSacMap ?? false,
    chuoiMoRong: luat.chuoiMoRong ?? false,
    tuongTac: luat.tuongTacThe ?? false,
    markovNguon: luat.markovNguon ?? false,
    regimeTick: luat.regimeTick ?? false,
    nhanQuaDoiXung: luat.nhanQuaDoiXung ?? false,
    chuKyThucTe: luat.chuKyThucTe ?? false,
    lopVn: luat.lopVn ?? false,
    taiSanV42: luat.taiSanV42 ?? false,
    banhXe: luat.banhXe ?? false,
    muaDinhHan: luat.muaDinhHan ?? false,
    tinTheoMua: luat.tinTheoMua ?? false,
    luatLa: luat.luatLa ?? false,
    theLuonThat: luat.theLuonThat ?? false,
    canSauKhung: luat.canSauKhung ?? false,
    ...(luat.kyHopBanTap ? { kyHopBanTap: true } : {}),   // D545 — vắng khi tắt: tuỳ chọn cũ y nguyên
    ...(luat.chuKyCoNgoi ? { chuKyCoNgoi: true } : {}),   // D560 — như trên
    ...(luat.boiCanhDaiHan ? { boiCanhDaiHan: true } : {}),   // D574 — như trên
  };
}

/** Những cần gạt luật mà `taoTran` bật cho trận. Xem `luatCua`. */
export interface CongLuatTran {
  /** v26 — xem `TrangThaiTran.lai_suat_nen` và `LAI_SUAT_NEN`. */
  laiSuatNen?: boolean;
  /** v27 — bong bóng thành chuỗi gãy được. Xem `BONG_BONG_V27`. */
  bongBongChuoi?: boolean;
  /** v28 — tin có gốc, tin giả có hậu quả. Xem `MAP_V28`. */
  mapV28?: boolean;
  /** v32 — bản sắc cỡ map: kịch bản hồi cho 12/16, map 8 byte-hệt. `BAN_SAC_MAP`. */
  banSacMap?: boolean;
  /** v32 — kỳ ngộ trong trận. Xem `TrangThaiTran.ky_ngo` và `BoLuatCanBang.kyNgo`. */
  kyNgo?: boolean;
  /** v33 — giãn lớp chiến thuật ở map ngắn (D90 M1). Xem `TrangThaiTran.gian_la`. */
  gianLaMapNgan?: boolean;
  /** v34 — vai bất đối xứng có răng. */
  vaiCoRang?: boolean;
  /** v54 (D389) — xem `BoLuatCanBang.vonDeu` · `.loiGon` · `.khauViTat` · `.chiBan16`. */
  vonDeu?: boolean;
  loiGon?: boolean;
  khauViTat?: boolean;
  chiBan16?: boolean;
  /** v54 (D395) — thanh khoản năm nấc. Xem `BoLuatCanBang.thanhKhoanNamNac` · `TrangThaiTran.thanh_khoan_nam_nac`. */
  thanhKhoanNamNac?: boolean;
  /** v54 (D403) — xem `BoLuatCanBang.boBaiTat` · `.quyTheoCoBan` · `.quyTranHang1`. */
  boBaiTat?: boolean;
  quyTheoCoBan?: boolean;
  quyTranHang1?: boolean;
  /** v54 (D405) — xem `BoLuatCanBang.tietKiemLamPhat` · `.tietKiemThaNoi` · `.nganHangDoVo`. */
  tietKiemLamPhat?: boolean;
  tietKiemThaNoi?: boolean;
  nganHangDoVo?: boolean;
  /** v55 (D409) — xem `BoLuatCanBang.lua` … `.luotSongMoi`. */
  lua?: boolean;
  luaPhi?: boolean;
  luaQuyetToan?: boolean;
  luaMuaDuoi?: boolean;
  nhiemVuLoi?: boolean;
  trait?: boolean;
  traitVai?: boolean;
  chanLoTrait?: boolean;
  luotSongMoi?: boolean;
  /** v55 (D411) — xem `BoLuatCanBang.gopXu` · `.khaoSatDauMienPhi`. */
  gopXu?: boolean;
  khaoSatDauMienPhi?: boolean;
  /** v55 (D422) — xem `BoLuatCanBang.luaKhongPhatDao` · `.kyLuatSauDonBay`. */
  luaKhongPhatDao?: boolean;
  kyLuatSauDonBay?: boolean;
  /** v56 (D447) — xem `BoLuatCanBang.phiCongDonVong`. */
  phiCongDonVong?: boolean;
  /** v57 (D456) — xem `BoLuatCanBang.khongBangDienTu`. */
  khongBangDienTu?: boolean;
  /** v57 (D456) — xem `BoLuatCanBang.theLuonThat`. */
  theLuonThat?: boolean;
  /** v57 (D457) — xem `BoLuatCanBang.dongHoMinigame`. */
  dongHoMinigame?: boolean;
  /** v57 (D457) — xem `BoLuatCanBang.khoTraitHep`. */
  khoTraitHep?: boolean;
  /** D482 — xem `BoLuatCanBang.traitGhimMinigame`. */
  traitGhimMinigame?: boolean;
  /** D498 — xem `TrangThaiTran.to_chuc_v57`. */
  toChucV57?: boolean;
  /** D506 — xem `TrangThaiTran.von_vai_v57`. */
  vonVaiV57?: boolean;
  /** D516 — xem `TrangThaiTran.phi_sau_vai_v57`. */
  phiSauVaiV57?: boolean;
  /** D517 — xem `TrangThaiTran.bay_ca_nhan_v57`. */
  bayCaNhanV57?: boolean;
  /** D526 — xem `TrangThaiTran.nhip_xen_ke`. */
  nhipXenKe?: boolean;
  /** D528 — xem `TrangThaiTran.ke_lenh_v59`. */
  keLenhV59?: boolean;
  /** D530 — xem `TrangThaiTran.loi_chi_trong_man`. */
  loiChiTrongMan?: boolean;
  /** D536 — xem `TrangThaiTran.lenh_lon_v61`. */
  lenhLonV61?: boolean;
  /** D545 — bàn tập 6 ô có kỳ họp ở ô 3 (`LICH_CHINH_SACH.O_BAN_TAP`). Chỉ đổi bản đồ, không thêm trạng thái trận. */
  kyHopBanTap?: boolean;
  /** D560 — xem `TrangThaiTran.chu_ky_co_ngoi`. */
  chuKyCoNgoi?: boolean;
  /** D561 — xem `TrangThaiTran.ban_khong_x2`. */
  banKhongX2?: boolean;
  /** D561 — xem `TrangThaiTran.loi_chon_truoc`. */
  loiChonTruoc?: boolean;
  /** D561 — xem `TrangThaiTran.ban_bot_bd_md`. */
  banBotBdMd?: boolean;
  /** D561 — xem `TrangThaiTran.xep_hang_e`. */
  xepHangE?: boolean;
  /** D561 — xem `TrangThaiTran.vao_gia`. */
  vaoGia?: boolean;
  /** D561 — xem `TrangThaiTran.nhieu_ma`. */
  nhieuMa?: boolean;
  /** D561 — xem `TrangThaiTran.khoan_theo_duong`. */
  khoanTheoDuong?: boolean;
  /** D561 — xem `TrangThaiTran.up_la_pha`. */
  upLaPha?: boolean;
  /** D566 — xem `TrangThaiTran.lai_ap_la_quyet_toan`. */
  laiApLaQuyetToan?: boolean;
  /** D574 — xem `TrangThaiTran.boi_canh_dai_han`. */
  boiCanhDaiHan?: boolean;
  /** D584 — xem `TrangThaiTran.giai_xu`. */
  giaiXu?: boolean;
  /** D586 — xem `TrangThaiTran.ban_bot_rai`. */
  banBotRai?: boolean;
  /** D589 — xem `TrangThaiTran.ba_phan`. */
  baPhan?: boolean;
  /** v34 — gọi ký quỹ trừ từ NAV. Xem `TrangThaiTran.ky_quy_tu_nav`. */
  kyQuyTuNav?: boolean;
  /** v29 — phí vội vàng phi tuyến theo cỡ lệnh. Xem `NAV_V10.VOI_VANG`. */
  phiVoiVang?: boolean;
  /** Xem `TrangThaiTran.hoa_cong_bang`. */
  hoaCongBang?: boolean;
  /** Xem `TrangThaiTran.luat_von`. */
  luatVon?: boolean;
  /** Xem `TrangThaiTran.dac_quyen`. */
  dacQuyen?: boolean;
  /** Xem `TrangThaiTran.don_bay_cam_ket`. */
  donBayCamKet?: boolean;
  /** Xem `TrangThaiTran.da_dang_tran_tai_san`. */
  daDangHoaTranTaiSan?: boolean;
  /** Xem `TrangThaiTran.phan_than_bat` — ⚠ mặc định NGƯỢC: vắng = BẬT. */
  phanThan?: boolean;
  /** Xem `TrangThaiTran.chuoi_mo_rong` — v35, vắng = tắt như mọi cờ thường. */
  chuoiMoRong?: boolean;
  /** Xem `TrangThaiTran.tuong_tac_the` — v35, vắng = tắt như mọi cờ thường. */
  tuongTacThe?: boolean;
  /** v35 — Markov theo nguyên nhân, CHỈ máy sinh map đọc. Xem `MARKOV_NGUON`. */
  markovNguon?: boolean;
  /** Xem `TrangThaiTran.be_chuoi_von` — v35, vắng = tắt như mọi cờ thường. */
  beChuoiVon?: boolean;
  /** v36 — máy regime tick, CHỈ máy sinh map đọc. Xem `REGIME_TICK`. */
  regimeTick?: boolean;
  /** Xem `TrangThaiTran.gia_chong_nen` — v36 R2. */
  giaChongNen?: boolean;
  /** Xem `TrangThaiTran.bot_doc_nen` — D386. */
  botDocNen?: boolean;
  /** v54 (D389) — bánh xe mùa có ngã rẽ trong `sinhMap`. Xem `BoLuatCanBang.banhXe`. */
  banhXe?: boolean;
  /** v54 (D397) — mùa rút sẵn độ dài (mùa có tuổi). Xem `BoLuatCanBang.muaDinhHan`. */
  muaDinhHan?: boolean;
  /** v54 (D397) — tin nội sinh nghiêng theo mùa ẩn. Xem `BoLuatCanBang.tinTheoMua`. */
  tinTheoMua?: boolean;
  /** v54 (D399) — bộ luật từng lá trong `sinhMap`. Xem `BoLuatCanBang.luatLa`. */
  luatLa?: boolean;
  /** v57 (D470) — CẠN THANH KHOẢN chỉ sau hoảng loạn/chuỗi giảm, mọi mùa. Xem `BoLuatCanBang.canSauKhung`. */
  canSauKhung?: boolean;
  /** Xem `TrangThaiTran.ap_luc_ban` — v37 R6, vắng = tắt như mọi cờ thường. */
  apLucBan?: boolean;
  /**
   * v38 — NHÂN QUẢ ĐỐI XỨNG (D185): thêm vế GHÌM vào `SU_KIEN_THEO_GIAI_DOAN`
   * để chợ đang tăng thôi rút ra "hạ lãi suất" vô cớ. CHỈ máy sinh map đọc.
   */
  nhanQuaDoiXung?: boolean;
  /** v39 — CHU KỲ THỰC TẾ (D301): máy sinh map + bot hoài nghi + bảng điện tử + DTO đọc. */
  chuKyThucTe?: boolean;
  /** v40 — LỊCH CỐ ĐỊNH (D302): xem `TrangThaiTran.lich_khong_doi`. */
  lichKhongDoi?: boolean;
  /** v41 — LỚP VN (D307): xem `TrangThaiTran.lop_vn`. */
  lopVn?: boolean;
  /** v42 — BỘ SỐ TÀI SẢN v2 (D311): xem `TrangThaiTran.tai_san_v42`. */
  taiSanV42?: boolean;
  /** v42 — COUPON (D311): xem `TrangThaiTran.coupon_tpcp`. */
  couponTpcp?: boolean;
  /** v42 — KHỐNG THEO MÃ (D311): xem `TrangThaiTran.khong_theo_ma`. */
  khongTheoMa?: boolean;
  /** v42 — TIỀN MẶT × SỰ KIỆN (D311): xem `TrangThaiTran.tien_mat_su_kien`. */
  tienMatSuKien?: boolean;
  /** v43 — KHOÁ NẮM GIỮ TẮT (D314): xem `TrangThaiTran.khoa_tai_san_tat`. */
  khoaTaiSanTat?: boolean;
  /** v43 — NGÂN HÀNG (D314): xem `TrangThaiTran.ngan_hang`. */
  tietKiem?: boolean;
  /** v44 — TƯƠNG QUAN TÀI SẢN v2 (D315): xem `TrangThaiTran.beta_tai_san_v2`. */
  betaTaiSanV2?: boolean;
  /** v45 — ĐƯỜNG CONG LỢI SUẤT (D318): xem `TrangThaiTran.duong_cong`. */
  duongCong?: boolean;
  /** v45 — biên nhiễu rà lại (D318): xem `TrangThaiTran.bien_dong_v45`. */
  bienDongV45?: boolean;
  /** v45 — coupon phải GIỮ ĐỦ MỘT Ô (D318): xem `TrangThaiTran.coupon_giu_du`. */
  couponGiuDu?: boolean;
  /** v46 — Đòn Bẩy nhân đúng từng mã (D338): xem `TrangThaiTran.don_bay_theo_ma`. */
  donBayTheoMa?: boolean;
  /** v46 — lãi vay Đòn Bẩy (D338): xem `TrangThaiTran.lai_vay_don_bay`. */
  laiVayDonBay?: boolean;
  /** v47 — khẩu vị nhân đúng biên độ (D339): xem `TrangThaiTran.khau_vi_theo_ma`. */
  khauViTheoMa?: boolean;
  /** v48 — rủi ro đối tác trừ một lần (D340): xem `TrangThaiTran.doi_tac_tru_mot_lan`. */
  doiTacTruMotLan?: boolean;
  /** v49 — sổ khống ăn ngược giá chợ (D342): xem `TrangThaiTran.khong_theo_gia`. */
  khongTheoGia?: boolean;
  /** v49 — chip KHỐNG theo hạn mức (D342): xem `TrangThaiTran.khong_theo_han_muc`. */
  khongTheoHanMuc?: boolean;
  /** v49 — lá Bán Khống thuần quyền (D342): xem `TrangThaiTran.ban_khong_thuan_quyen`. */
  banKhongThuanQuyen?: boolean;
  /** v49 — xếp hàng vào tầng mã (D342): xem `TrangThaiTran.xep_hang_theo_ma`. */
  xepHangTheoMa?: boolean;
  /** v50 — phí mua bán nhẹ (D345): xem `TrangThaiTran.phi_lenh_nhe`. */
  phiLenhNhe?: boolean;
  /** v51 — phí mua bán hai bậc (D346): xem `TrangThaiTran.phi_lenh_bac`. */
  phiLenhBac?: boolean;
  /** v52 — bộ số Đa Dạng Hoá mới (D371): xem `TrangThaiTran.da_dang_v52`. */
  daDangV52?: boolean;
  /** v53 — úp ô đang chơi (D373): xem `TrangThaiTran.o_up`. */
  oUp?: boolean;
  /** Xem `TrangThaiTran.ky_quy_rong`. */
  kyQuyRong?: boolean;
  /** Xem `TrangThaiTran.tuong_quan`. */
  tuongQuan?: boolean;
  /** Xem `TrangThaiTran.cuoc_tat`. */
  cuocTat?: boolean;
  /** Xem `TrangThaiTran.nav`. */
  nav?: boolean;
  /** D43 bước 2 (v11) — ô lịch chính sách, tiêu thụ ở `sinhMap`. */
  lichChinhSach?: boolean;
  /** D43 bước 3 (v12) — quán tính từng hàng, tiêu thụ ở `sinhMap`. */
  quanTinh?: boolean;
  /** D43 bước 4 (v13) — sức căng: S-map ở `sinhMap`, độ lớn ở `chotPhien`. */
  sucCang?: boolean;
  /** v14 — nền trừ trên NAV (founder chốt B). */
  nenNav?: boolean;
  /** v15 — chu kỳ có tính cách + điềm báo đuôi (tiêu thụ ở sinhMap + chotPhien). */
  chuKy?: boolean;
  duoiTelegraph?: boolean;
  /** v17 — lệnh bán khống trong shop (doc 05). */
  lenhKhong?: boolean;
  /** v16 — 5 mặt đuôi (⚠ từng QUÊN LUỒN vào sinhMap — cổng trang trí #15). */
  duoi5?: boolean;
  /** v18 — hệ quả chưa lật thôi cắn giá. Xem `TrangThaiTran.bo_nhanh_he_qua`. */
  boNhanhHeQua?: boolean;
  /** v19 — bảng xung đột gọn. Xem `TrangThaiTran.xung_dot_gon`. */
  xungDotGon?: boolean;
  /** v20 — bảng cộng hưởng gọn. Xem `TrangThaiTran.cong_huong_gon`. */
  congHuongGon?: boolean;
  /** v21 — cân trôi kỳ vọng theo mã. Xem `TrangThaiTran.can_troi`. */
  canTroi?: boolean;
  /** v22 — bot đọc bối cảnh để mua. Xem `BoLuatCanBang.botDocTin`. */
  botDocTin?: boolean;
  /** v23 — bảng cân trôi vòng hai. Xem `BoLuatCanBang.canTroi2`. */
  canTroi2?: boolean;
  /** v30 — bot dùng đúng thước engine. Xem `BoLuatCanBang.botDungThuocThat`. */
  botDungThuocThat?: boolean;
  /** v31 — Quỹ vòng co giãn theo số ghế. Xem `BoLuatCanBang.quyCoGian`. */
  quyCoGian?: boolean;
  /** v24 — cỡ vị thế theo độ tin. Xem `BoLuatCanBang.coViThe`. */
  coViThe?: boolean;
}

export function taoTran(
  seed: number, ghe: readonly GheMoi[],
  /**
   * CỔNG LUẬT — xem `TrangThaiTran.luat_von` / `.dac_quyen`. Mặc định TẮT HẾT để
   * trận cũ (người gọi chưa biết tới cổng này) replay ra đúng kết quả nó từng có.
   *
   * ⚠ MỘT OBJECT, KHÔNG PHẢI HAI BOOLEAN CẠNH NHAU — cùng lý do đã ghi ở
   * `replay()`: hai boolean cùng kiểu đứng liền nhau thì gọi nhầm thứ tự là trình
   * biên dịch IM LẶNG, và ở đây "nhầm thứ tự" nghĩa là bật sai bộ luật cho một
   * trận đang lưu.
   */
  luat: CongLuatTran = {},
  /**
   * D31/02-08 — CỠ MAP CỦA CHÍNH TRẬN NÀY (8/12/16, cột `so_o`). Vắng = trận
   * cũ hoặc người tạo không chọn → MAP_SIZE mặc định, replay nguyên như trước.
   * ⚠ Người gọi ở đường chạy thật PHẢI truyền số ĐÃ LƯU trong DB, không truyền
   * lại lựa chọn từ client — cỡ map là một nửa danh tính của map (seed là nửa
   * kia), lệch một lần là cả trận dựng lại khác.
   */
  soO?: number,
): TrangThaiTran {
  return {
    seed,
    map: sinhMap(seed, soO ?? HOLDEM_DECISIONS.MAP_SIZE, tuyChonSinhMap(luat)),
    vong: 1,
    ...(luat.luatVon ? { luat_von: true } : {}),
    ...(luat.dacQuyen ? { dac_quyen: true } : {}),
    ...(luat.donBayCamKet ? { don_bay_cam_ket: true } : {}),
    ...(luat.daDangHoaTranTaiSan ? { da_dang_tran_tai_san: true } : {}),
    ...(luat.kyQuyRong ? { ky_quy_rong: true } : {}),
    ...(luat.phanThan === false ? { phan_than_bat: false } : {}),
    ...(luat.chuoiMoRong ? { chuoi_mo_rong: true } : {}),
    ...(luat.tuongTacThe ? { tuong_tac_the: true } : {}),
    ...(luat.beChuoiVon ? { be_chuoi_von: true } : {}),
    ...(luat.giaChongNen ? { gia_chong_nen: true } : {}),
    ...(luat.botDocNen ? { bot_doc_nen: true } : {}),
    ...(luat.banhXe ? { banh_xe: true } : {}),
    ...(luat.regimeTick ? { regime_tick: true } : {}),
    ...(luat.apLucBan ? { ap_luc_ban: true } : {}),
    ...(luat.chuKyThucTe ? { chu_ky_thuc_te: true } : {}),
    ...(luat.lichKhongDoi ? { lich_khong_doi: true } : {}),
    ...(luat.lopVn ? { lop_vn: true } : {}),
    ...(luat.taiSanV42 ? { tai_san_v42: true } : {}),
    ...(luat.chuKyCoNgoi ? { chu_ky_co_ngoi: true } : {}),
    ...(luat.banKhongX2 ? { ban_khong_x2: true } : {}),   // D561
    ...(luat.loiChonTruoc ? { loi_chon_truoc: true } : {}),   // D561
    ...(luat.banBotBdMd ? { ban_bot_bd_md: true } : {}),   // D561
    ...(luat.xepHangE ? { xep_hang_e: true } : {}),   // D561
    ...(luat.vaoGia ? { vao_gia: true } : {}),   // D561
    ...(luat.nhieuMa ? { nhieu_ma: true } : {}),   // D561
    ...(luat.khoanTheoDuong ? { khoan_theo_duong: true } : {}),   // D561
    ...(luat.upLaPha ? { up_la_pha: true } : {}),   // D561
    ...(luat.laiApLaQuyetToan ? { lai_ap_la_quyet_toan: true } : {}),   // D566
    ...(luat.boiCanhDaiHan ? { boi_canh_dai_han: true } : {}),   // D574
    ...(luat.giaiXu ? { giai_xu: true } : {}),   // D584
    ...(luat.banBotRai ? { ban_bot_rai: true } : {}),   // D586
    ...(luat.baPhan ? { ba_phan: true } : {}),   // D589
    ...(luat.couponTpcp ? { coupon_tpcp: true } : {}),
    ...(luat.khongTheoMa ? { khong_theo_ma: true } : {}),
    ...(luat.tienMatSuKien ? { tien_mat_su_kien: true } : {}),
    ...(luat.khoaTaiSanTat ? { khoa_tai_san_tat: true } : {}),
    /*
     * ⚠ TÊN TRÊN TRẠNG THÁI TRẬN LÀ `ngan_hang`, KHÔNG phải `tiet_kiem` — cố ý.
     * `Ghe.tiet_kiem` là DANH SÁCH HỢP ĐỒNG của một ghế; nếu cờ trận cũng tên
     * `tiet_kiem` thì hai thứ khác hẳn nhau trùng tên trong cùng một tệp, và
     * `st.tiet_kiem` vs `g.tiet_kiem` là cú đọc nhầm không bao giờ ném lỗi.
     */
    ...(luat.tietKiem ? { ngan_hang: true } : {}),
    ...(luat.betaTaiSanV2 ? { beta_tai_san_v2: true } : {}),
    ...(luat.duongCong ? { duong_cong: true } : {}),
    ...(luat.bienDongV45 ? { bien_dong_v45: true } : {}),
    ...(luat.couponGiuDu ? { coupon_giu_du: true } : {}),
    ...(luat.donBayTheoMa ? { don_bay_theo_ma: true } : {}),
    ...(luat.laiVayDonBay ? { lai_vay_don_bay: true } : {}),
    ...(luat.khauViTheoMa ? { khau_vi_theo_ma: true } : {}),
    ...(luat.doiTacTruMotLan ? { doi_tac_tru_mot_lan: true } : {}),
    ...(luat.khongTheoGia ? { khong_theo_gia: true } : {}),
    ...(luat.khongTheoHanMuc ? { khong_theo_han_muc: true } : {}),
    ...(luat.banKhongThuanQuyen ? { ban_khong_thuan_quyen: true } : {}),
    ...(luat.xepHangTheoMa ? { xep_hang_theo_ma: true } : {}),
    ...(luat.phiLenhNhe ? { phi_lenh_nhe: true } : {}),
    ...(luat.phiLenhBac ? { phi_lenh_bac: true } : {}),
    ...(luat.daDangV52 ? { da_dang_v52: true } : {}),
    ...(luat.oUp ? { o_up: true } : {}),
    ...(luat.sucCang ? { suc_cang: true } : {}),
    ...(luat.nenNav ? { nen_nav: true } : {}),
    ...(luat.hoaCongBang ? { hoa_cong_bang: true } : {}),
    ...(luat.chuKy ? { co_chu_ky: true } : {}),
    ...(luat.lenhKhong ? { lenh_khong: true } : {}),
    ...(luat.boNhanhHeQua ? { bo_nhanh_he_qua: true } : {}),
    ...(luat.xungDotGon ? { xung_dot_gon: true } : {}),
    ...(luat.congHuongGon ? { cong_huong_gon: true } : {}),
    ...(luat.canTroi ? { can_troi: true } : {}),
    ...(luat.botDocTin ? { bot_doc_tin: true } : {}),
    ...(luat.canTroi2 ? { can_troi_2: true } : {}),
    ...(luat.botDungThuocThat ? { bot_dung_thuoc_that: true } : {}),
    ...(luat.quyCoGian ? { quy_co_gian: true } : {}),
    ...(luat.kyNgo ? { ky_ngo: true } : {}),
    ...(luat.gianLaMapNgan ? { gian_la: true } : {}),
    ...(luat.vaiCoRang ? { vai_co_rang: true } : {}),
    ...(luat.vonDeu ? { von_deu: true } : {}),
    ...(luat.loiGon ? { loi_gon: true } : {}),
    ...(luat.thanhKhoanNamNac ? { thanh_khoan_nam_nac: true } : {}),
    ...(luat.boBaiTat ? { bo_bai_tat: true } : {}),
    ...(luat.quyTheoCoBan ? { quy_theo_co_ban: true } : {}),
    ...(luat.quyTranHang1 ? { quy_tran_hang_1: true } : {}),
    ...(luat.tietKiemLamPhat ? { tiet_kiem_lam_phat: true } : {}),
    ...(luat.tietKiemThaNoi ? { tiet_kiem_tha_noi: true } : {}),
    ...(luat.nganHangDoVo ? { ngan_hang_do_vo: true } : {}),
    ...(luat.lua ? { lua: true } : {}),
    ...(luat.luaPhi ? { lua_phi: true } : {}),
    ...(luat.luaQuyetToan ? { lua_quyet_toan: true } : {}),
    ...(luat.luaMuaDuoi ? { lua_mua_duoi: true } : {}),
    ...(luat.nhiemVuLoi ? { nhiem_vu_loi: true } : {}),
    ...(luat.trait ? { trait_bat: true } : {}),
    ...(luat.traitVai ? { trait_vai: true } : {}),
    ...(luat.chanLoTrait ? { chan_lo_trait: true } : {}),
    ...(luat.luotSongMoi ? { luot_song_moi: true } : {}),
    ...(luat.gopXu ? { gop_xu: true } : {}),
    ...(luat.khaoSatDauMienPhi ? { khao_sat_dau_mien_phi: true } : {}),
    ...(luat.luaKhongPhatDao ? { lua_khong_phat_dao: true } : {}),
    ...(luat.kyLuatSauDonBay ? { ky_luat_sau_don_bay: true } : {}),
    ...(luat.phiCongDonVong ? { phi_cong_don_vong: true } : {}),
    ...(luat.khongBangDienTu ? { khong_bang_dien_tu: true } : {}),
    ...(luat.theLuonThat ? { the_luon_that: true } : {}),
    ...(luat.dongHoMinigame ? { dong_ho_minigame: true } : {}),
    ...(luat.khoTraitHep ? { trait_kho_hep: true } : {}),
    ...(luat.traitGhimMinigame ? { trait_ghim_minigame: true } : {}),
    ...(luat.toChucV57 ? { to_chuc_v57: true } : {}),
    ...(luat.vonVaiV57 ? { von_vai_v57: true } : {}),
    ...(luat.phiSauVaiV57 ? { phi_sau_vai_v57: true } : {}),
    ...(luat.bayCaNhanV57 ? { bay_ca_nhan_v57: true } : {}),
    ...(luat.nhipXenKe ? { nhip_xen_ke: true } : {}),
    ...(luat.keLenhV59 ? { ke_lenh_v59: true } : {}),
    ...(luat.loiChiTrongMan ? { loi_chi_trong_man: true } : {}),
    ...(luat.lenhLonV61 ? { lenh_lon_v61: true } : {}),
    ...(luat.khauViTat ? { khau_vi_tat: true } : {}),
    ...(luat.kyQuyTuNav ? { ky_quy_tu_nav: true } : {}),
    ...(luat.coViThe ? { co_vi_the: true } : {}),
    ...(luat.laiSuatNen ? { lai_suat_nen: true } : {}),
    ...(luat.mapV28 ? { map_v28: true } : {}),
    ...(luat.phiVoiVang ? { phi_voi_vang: true } : {}),
    ...(luat.tuongQuan ? { tuong_quan: true } : {}),
    ...(luat.cuocTat ? { cuoc_tat: true } : {}),
    ...(luat.nav ? { nav: true } : {}),
    ghe: ghe.map((g) => ({
      ...g,
      /*
       * v34 — VỐN + LÕI GHIM THEO VAI (founder 22/08: "đội lái sẽ có vốn lớn…
       * bị cố định lõi 1 luôn luôn là Lướt Sóng"). Chỉ khi cổng bật và ghế CÓ
       * vai; trận cũ / map 8 (không vai) ra đúng số cũ từng chip.
       * Lõi ghim ĐỨNG TRƯỚC lá người chơi tự lấy — nó là ô 1.
       */
      ...(luat.vaiCoRang && g.vai && loiGhimCua(g.vai, luat)
        ? { danh_muc: { ...g.danh_muc,
          chien_thuat: [loiGhimCua(g.vai, luat) as never, ...g.danh_muc.chien_thuat] } }
        : {}),
      // v54 (D389) — VỐN ĐỀU: mọi ghế `START_VON`, vai giữ các luật riêng còn lại.
      von: luat.vaiCoRang && g.vai && luat.vonDeu !== true
        ? HOLDEM_MATCH.START_VON * heSoVonCua(g.vai, luat)   // D506 — `vonVaiV57`: ×10 · ×20 · ×50
        : HOLDEM_MATCH.START_VON,
      // v55 (D411) — VÀNG gộp vào XU: ví khởi điểm nằm ở `xu`; `luot_khao_sat` về 0 và không ai đọc (xem `viKhaoSat`).
      luot_khao_sat: luat.gopXu ? 0 : HOLDEM_MATCH.START_LUOT_KHAO_SAT,
      ...(luat.gopXu ? { xu: HOLDEM_MATCH.START_LUOT_KHAO_SAT } : {}),
      da_chay: false,
      vong_chay: null,
      tu_the: 'choi',
      vong_roi: null,
      so_lan_cat_lo: 0,
      vi_the: {},
    })),
  };
}

// ---------------------------------------------------------------------------
// LÕI VỐN (founder 27/07) — ĐẢO DANH MỤC + KHOÁ TÀI SẢN 2 VÒNG
//
// Hai cơ chế nằm chung một khối vì chúng KHOÁ VÀO NHAU: hàng chờ khớp lệnh của
// cơ chế A chính là chỗ quyền lợi "ưu tiên khớp lệnh" của cơ chế B có nghĩa.
// Tách ra hai file thì cái sau đọc thành một dòng miễn trừ không rõ miễn cái gì.
//
// MỌI THỨ Ở ĐÂY SUY ĐƯỢC TỪ (seed, action_log): hai hàm `ap*` là hàm THUẦN nhận
// state trả state, gọi ở nhịp 1 của replay. Không cột DB nào mới.
// ---------------------------------------------------------------------------

/** Cổng luật vốn của state này. Một chỗ hỏi duy nhất — xem `TrangThaiTran.luat_von`. */
function luatVonBat(st: TrangThaiTran): boolean {
  return st.luat_von === true;
}

// ---------------------------------------------------------------------------
// ĐẶC QUYỀN THẺ CHIẾN THUẬT (D33)
// ---------------------------------------------------------------------------

/**
 * Ghế này có ĐẶC QUYỀN của thẻ `the` không.
 *
 * ⚠ MỘT CỬA HỎI DUY NHẤT, và mọi nhánh đặc quyền PHẢI đi qua đây. Hỏi thẳng
 * `chien_thuat.includes(...)` ở từng chỗ là bỏ mất cổng `dac_quyen`, và biểu
 * hiện sẽ là trận cũ replay ra kết quả khác — im lặng, không lỗi. Repo này đã
 * trả giá đúng một lần cho chuyện "cổng chỉ đóng ở cửa mình nhớ ra"
 * (xem sổ cái chu kỳ khoá trong `chotPhien`).
 *
 * KHÔNG xét `gan`: đặc quyền là quyền BẤM ĐƯỢC MỘT NÚT, nó không có mã nào để
 * gắn vào. Attachment chỉ quyết định phần SỐ (xem `theAnVaoMa`).
 */
export function coDacQuyen(
  st: TrangThaiTran, g: Ghe, the: ChienThuatId,
): boolean {
  return st.dac_quyen === true && g.danh_muc.chien_thuat.includes(the);
}

/**
 * TRẦN SỐ MÃ GIỮ ĐỒNG THỜI của một ghế — `MAX_TAI_SAN`, cộng nới của Đa Dạng Hoá.
 *
 * ⚠ MỘT CỬA HỎI DUY NHẤT, cùng lý do với `coDacQuyen`. Con số này bị hỏi ở BA
 * chỗ rời nhau (mua thẻ ở `shop.ts`, đảo danh mục ở `apDaoDanhMuc`, và bot khi
 * chọn lá) — để mỗi chỗ tự cộng lấy là bảo đảm có ngày ba chỗ lệch nhau, mà
 * biểu hiện sẽ là "mua được lá thứ 5 nhưng đảo danh mục thì báo đầy".
 *
 * ⚠ HAI TRẦN KHÁC NHAU: đây là SỨC CHỨA. Tốc độ nhặt lá mỗi vòng là
 * `DAC_QUYEN.DA_DANG_HOA.TAI_SAN_MOI_VONG`, một con số hoàn toàn khác.
 */
/**
 * v50 (D345) — CỜ PHÍ LỆNH của một ghế: MỘT nguồn cho engine (`apLenhMocNav`/`apLenhVongNav`) và DTO
 * (`ban.phi_lenh_*` cho bản nháp client) — hai bên đọc lệch là "màn báo 40, bị trừ 12" (D67).
 */
export function phiLenhCua(
  st: TrangThaiTran, g: Ghe,
): { phiLenhNhe?: true; phiLenhBac?: true; phiLenhConBp?: number; sauBp?: number } {
  if (st.phi_lenh_nhe !== true) return {};
  // v51 (D346) — hai bậc đi kèm bảng gốc nhẹ; cổng riêng để trận v50 replay nguyên.
  const bac = st.phi_lenh_bac === true ? { phiLenhBac: true as const } : {};
  // D516 — độ sâu chợ theo vốn vai; ×1 thì không gửi khoá (DTO Cá nhân y như cũ).
  const sauBp = g.vai ? sauPhiVaiBp(g.vai, { vonVaiV57: st.von_vai_v57 === true, phiSauVaiV57: st.phi_sau_vai_v57 === true }) : 10000;
  const sau = sauBp !== 10000 ? { sauBp } : {};
  return coDacQuyen(st, g, 'khop_nhanh')
    ? { phiLenhNhe: true, ...bac, phiLenhConBp: DAC_QUYEN.KHOP_NHANH.LENH_CON_BP, ...sau }
    : { phiLenhNhe: true, ...bac, ...sau };
}

export function maxTaiSanCua(st: TrangThaiTran, g: Ghe): number {
  const them = st.da_dang_tran_tai_san === true
    && coDacQuyen(st, g, 'da_dang_hoa')
    ? DAC_QUYEN.DA_DANG_HOA.TRAN_TAI_SAN_THEM : 0;
  // v55 (D409) — TẦM RỘNG nới, MỘT GIỎ kẹp — đọc từ MỘT struct ràng buộc trait.
  const rb = st.trait_bat === true ? rangBuocCua(st, g, st.vong) : RANG_BUOC_TRONG;
  const tran = HOLDEM_MATCH.MAX_TAI_SAN + them + rb.themMa;
  return rb.toiDaMa === null ? tran : Math.min(tran, rb.toiDaMa);
}

/**
 * BỘ SỐ của mắt xích `da_dang` cho trận này — MỘT CỬA HỎI DUY NHẤT (D371).
 *
 * ⚠ Hỏi thẳng `DA_DANG_HOA` ở chỗ tính là bỏ mất cổng `da_dang_v52`, và biểu
 * hiện sẽ là trận cũ replay ra tiền khác — im lặng, không lỗi. Cùng lý do đã
 * ghi ở `coDacQuyen` và `phiLenhCua`.
 *
 * ⚠ ĐÂY LÀ BIÊN LỢI NHUẬN MỖI VÒNG, không phải sức chứa. Trần số mã là
 * `maxTaiSanCua` ngay trên, một con số hoàn toàn khác và một cổng hoàn toàn khác.
 */
export function daDangCua(
  st: Pick<TrangThaiTran, 'da_dang_v52'>,
): { PHI_BP: number; MOI_MA_BP: number } {
  return st.da_dang_v52 === true ? DA_DANG_HOA_V52 : DA_DANG_HOA;
}

/**
 * v10 NAV — cửa lệnh THEO MỐC: giải mốc → tiền rồi đi qua `apLenhVongNav`.
 *
 * MỐC MỊN (bước 5%) là ĐẶC QUYỀN CHIA LỆNH (founder 28/07); không lá thì chỉ
 * mốc thô (bước `BUOC_MOC_THO_BP`). Kiểm Ở ĐÂY — trong engine, trên trạng thái
 * ghế LÚC ÁP — chứ không tin client: gửi tiền thô hay mốc lậu đều chết từ cửa.
 * Đây là đường DUY NHẤT người chơi đi vốn từ 28/07; log lưu MỐC, replay giải
 * lại — cùng trạng thái thì cùng tiền, tất định.
 */
/** v55 (D409) — ngưỡng 'chuỗi ĐÃ xác nhận' cùng thước với chỉ số #2 FOMO (`CoTran.nguong_chuoi`: tick v36 = 1, máy rút cũ = 2). */
export function nguongChuoiCua(st: Pick<TrangThaiTran, 'regime_tick'>): number {
  return st.regime_tick === true ? 1 : 2;
}
/** v55 (D409) — nhịp của chuỗi TĂNG mà người chơi ĐANG THẤY lúc quyết (cùng ô `xu_huong` DTO đọc): `som` = còn ngắn · `muon` = đã xác nhận. */
export function nhipChuoiTang(st: TrangThaiTran): 'som' | 'muon' | null {
  const tt = st.map.trang_thai?.[vongDaLat(st) - 1];
  if (!tt || tt.run_huong !== 1) return null;
  return tt.run_dai <= nguongChuoiCua(st) ? 'som' : 'muon';
}
/**
 * v55 (D409) — TUỲ CHỌN LỆNH của một ghế từ lửa + trait (MỘT cửa cho `apLenhMocNav` lẫn `apLenhVongNav`, đường thật lẫn
 * bàn đo, bối cảnh bot lẫn DTO bản nháp — D61): hệ số trượt (lửa) · Mua Đuổi muộn · trần BÁN vòng (GÔNG CÙM) · phí cố
 * định mỗi lệnh (SỔ MỎNG) · mốc thêm (LỆNH MỊN). D425: trần MUA → trần BÁN, trượt ×1,3 → phí cố định, gỡ CẤM TẤT TAY.
 */
export function tuyChonLenhV55(st: TrangThaiTran, g: Ghe): {
  heSoTruotBp?: number; heSoTruotMuaRuiRoBp?: number; tranBanVong?: { tranTien: number; daBan: number };
  mocThem?: readonly number[]; phiCoDinhLenh?: number;
} {
  const rb = st.trait_bat === true ? rangBuocCua(st, g, st.vong) : RANG_BUOC_TRONG;
  // D422 — MÙ LỬA: lửa của ghế luôn tắt ⇒ không giảm trượt theo nấc, không phạt Mua Đuổi muộn (cả hai là hiệu ứng của lửa).
  const lua = st.lua === true && st.lua_phi === true && !rb.muLua ? heSoTruotLuaBp(g.lua?.nac ?? 0) : 10000;
  const muon = st.lua === true && st.lua_mua_duoi === true && !rb.muLua && capThe(g.danh_muc, 'mua_duoi') > 0
    && nhipChuoiTang(st) === 'muon';
  const phi = rb.phiLenhBp > 0 ? Math.floor((vonDauCua(st, g) * rb.phiLenhBp) / 10000) : 0;
  return {
    ...(lua !== 10000 ? { heSoTruotBp: lua } : {}),
    ...(muon ? { heSoTruotMuaRuiRoBp: LUA.MUA_DUOI_MUON_TRUOT_X_BP } : {}),
    ...(rb.tranBanVongBp !== null
      ? { tranBanVong: { tranTien: Math.floor((navCua(g) * rb.tranBanVongBp) / 10000), daBan: g.doi_tay_vong?.ban ?? 0 } }
      : {}),
    ...(rb.mocThem.length > 0 ? { mocThem: rb.mocThem } : {}),
    ...(phi > 0 ? { phiCoDinhLenh: phi } : {}),
  };
}
/** v55 (D409) — cộng dồn ĐỔI TAY của vòng sau một cụm lệnh đã áp (đọc bias của lửa TRƯỚC vòng). */
export function congDoiTay(
  g: Ghe, lenh: readonly LenhGiaoDich[],
): NonNullable<Ghe['doi_tay_vong']> {
  let { ban, mua_khac, mua_rui_ro, mua_tong } = g.doi_tay_vong ?? { ban: 0, mua_khac: 0, mua_rui_ro: 0, mua_tong: 0 };
  const bias = g.lua?.bias ?? null;
  for (const l of lenh) {
    if (l.tien < 0) { ban += -l.tien; continue; }
    const nhom: string | null = l.khong === true ? 'khong' : (TAI_SAN.find((t) => t.id === l.ma)?.nhom ?? null);
    mua_tong += l.tien;
    if (nhom === 'rui_ro') mua_rui_ro += l.tien;
    if (bias !== null && nhom !== null && nhom !== bias) mua_khac += l.tien;
  }
  return { ban, mua_khac, mua_rui_ro, mua_tong };
}
/**
 * v55 (D411) — VÍ KHẢO SÁT LẠI. Trận bật `gopXu`: MỘT ví `xu` trả cho cả đổi bài shop lẫn cuộn chợ trait, nhận cả phần cấp
 * mỗi vòng lẫn phần của lửa/lõi. Trận cũ: `luot_khao_sat` (VÀNG) như trước. MỘT chỗ quyết ví nào — replay, cửa `/shop`,
 * bot, DTO và Monte Carlo đều đi qua đây (A11.5).
 */
export function viKhaoSat(st: { gop_xu?: boolean }, g: { xu?: number; luot_khao_sat: number }): number {
  return st.gop_xu === true ? (g.xu ?? 0) : g.luot_khao_sat;
}
/** Ghi số dư ví khảo sát vào đúng trường (xem `viKhaoSat`). Trả bản sao — không sửa `g`. */
export function ghiViKhaoSat<G extends { xu?: number; luot_khao_sat: number }>(
  st: { gop_xu?: boolean }, g: G, v: number,
): G {
  return st.gop_xu === true ? { ...g, xu: v } : { ...g, luot_khao_sat: v };
}
/**
 * Giá của `lan` lần khảo sát lại trong MỘT vòng. Luật (`CHI_PHI_KHAO_SAT_LAI`): lần ĐẦU miễn phí, từ lần 2 mỗi lần một
 * giá — nhãn shop ("⟳ FREE") và bot đã làm đúng thế từ lâu, còn đường trừ của NGƯỜI CHƠI tính cả lần đầu. Cổng
 * `khaoSatDauMienPhi` sửa đường ấy; khoá cũ giữ cách trừ cũ để replay y nguyên (D411).
 */
export function chiPhiKhaoSat(st: { khao_sat_dau_mien_phi?: boolean }, lan: number): number {
  const soLanTra = st.khao_sat_dau_mien_phi === true ? Math.max(0, lan - 1) : Math.max(0, lan);
  return soLanTra * HOLDEM_MATCH.CHI_PHI_KHAO_SAT_LAI;
}
/**
 * v55 (D409) — XU NHIỆM VỤ LÕI (cổng `nhiemVuLoi`): mỗi lõi đang cầm mà TỔNG mắt xích thuộc về nó trong vòng DƯƠNG ⇒
 * +`LUA.XU_NHIEM_VU_LOI`. 'Thuộc về' xếp tường minh theo kind — mắt xích mới sau này phải được XẾP LOẠI có ý thức.
 */
export function xuNhiemVuLoi(chain: readonly MatXich[], dm: DanhMuc): number {
  let xu = 0;
  for (const id of new Set(dm.chien_thuat)) {
    let tong = 0;
    for (const m of chain) {
      const mx = m as { id?: string; cap?: readonly string[] };
      const cuaLoi =
        ((m.kind === 'nhan' || m.kind === 'ct_su_kien' || m.kind === 'canh_nhip' || m.kind === 'phong_thu'
          || m.kind === 'dac_quyen' || m.kind === 'doi_tac') && mx.id === id)
        || ((m.kind === 'cong_huong' || m.kind === 'xung_dot' || m.kind === 'triet_bien_tang') && (mx.cap?.includes(id) ?? false))
        || (m.kind === 'song' && id === 'luot_song')
        || ((m.kind === 'khong_gia' || m.kind === 'short') && id === 'ban_khong')
        || (m.kind === 'chan_lo_san' && id === 'chan_lo');
      if (cuaLoi) tong += m.delta_bp;
    }
    if (tong > 0) xu += LUA.XU_NHIEM_VU_LOI;
  }
  return xu;
}

/**
 * D446 — TOÀN BỘ tham số giải + áp lệnh chip của MỘT ghế — MỘT nguồn cho đường thật (`apLenhMocNav` ·
 * `apLenhVongNav`) và cho bản XEM TRƯỚC ở màn shop (DTO `ban.tuy_chon_lenh`, client đưa nguyên vào CHÍNH
 * `giaiLenhMoc` + `apLenhGiaoDich`).
 *
 * ⚠ Vì sao phải có (founder 28/09: *"PHẦN CHIP thì lỗi nghiêm trọng … Kiểm tra kỹ những thao tác đặt cược"*): trước
 * D446 màn shop tự chép tay từng cờ của hàm này qua DTO — mỗi cơ chế mới là một lần chép, và v55 đã rơi mất bốn thứ:
 * hệ số trượt theo LỬA, trượt ×1,5 của MUA ĐUỔI muộn, mốc 10% của LỆNH MỊN, trần số mã (TÂM RỘNG · Đa Dạng Hoá). Rà
 * trên engine thật (7 trận v55, 3 vai): xem trước lệch phí tới 31 chip, lệch vị thế 1–3 chip ở hơn nửa số lần khớp,
 * màn báo "mốc không hợp lệ" / giấu khối xem trước trong khi server khớp. Một nguồn thì không còn gì để chép.
 * Chú thích từng khoá: v17 mở khống (cổng + đặc quyền + lá) · v34 hệ số vai (`tacDongGia`) · v42 sàn cấm khống theo mã ·
 * v49 chip khống theo hạn mức · v50/v51 phí lệnh nhẹ / hai bậc · v55 lửa + trait (`tuyChonLenhV55`).
 */
export interface TuyChonLenhGhe {
  coChiaLenh: boolean;
  coBanKhong: boolean;
  maxTaiSan: number;
  voiVang: boolean;
  tacDongGia: number;
  khongTheoMa: boolean;
  khongTheoHanMuc: boolean;
  phiLenhNhe?: true;
  phiLenhBac?: true;
  phiLenhConBp?: number;
  sauBp?: number;
  mandate?: Mandate;
  vonQuyChieu?: number;
  heSoTruotBp?: number;
  heSoTruotMuaRuiRoBp?: number;
  tranBanVong?: { tranTien: number; daBan: number };
  mocThem?: readonly number[];
  phiCoDinhLenh?: number;
  /** v56 (D447) — đổi tay theo mã đã có trong vòng (xem `Ghe.doi_ma_vong`). */
  daDoiMa?: Readonly<Record<string, number>>;
}

export function tuyChonLenhGhe(st: TrangThaiTran, g: Ghe): TuyChonLenhGhe {
  const mandate = mandateCua(st, g);
  return {
    coChiaLenh: st.dac_quyen === true && g.danh_muc.chien_thuat.includes('chia_lenh' as never),
    coBanKhong: st.lenh_khong === true && st.dac_quyen === true && st.loi_chi_trong_man !== true   // D530 — Bán Khống chỉ trong màn
      && g.danh_muc.chien_thuat.includes('ban_khong' as never),
    maxTaiSan: maxTaiSanCua(st, g),
    voiVang: st.phi_voi_vang === true,
    tacDongGia: heSoTacDongGia(st, g),
    khongTheoMa: st.khong_theo_ma === true,
    khongTheoHanMuc: st.khong_theo_han_muc === true,
    ...phiLenhCua(st, g),
    ...(mandate ? { mandate } : {}),
    ...(st.vai_co_rang === true ? { vonQuyChieu: vonDauCua(st, g) } : {}),
    ...tuyChonLenhV55(st, g),
    ...(st.phi_cong_don_vong === true ? { daDoiMa: { ...(g.doi_ma_vong ?? {}) } } : {}),
  };
}

/** v56 (D447) — cộng |tiền| của một cụm lệnh đã áp vào sổ đổi tay theo mã của vòng. */
export function congDoiMa(
  truoc: Readonly<Record<string, number>> | undefined, lenh: readonly LenhGiaoDich[],
): Record<string, number> {
  const ra: Record<string, number> = { ...(truoc ?? {}) };
  for (const l of lenh) ra[l.ma] = (ra[l.ma] ?? 0) + Math.abs(l.tien);
  return ra;
}

export function apLenhMocNav(
  st: TrangThaiTran, gheId: string, lenhMoc: readonly LenhMoc[],
): {
  st: TrangThaiTran; ok: boolean;
  loi?: LoiLenh | 'moc_khong_hop_le' | 'nav_tat' | 'khong_chon_bai_duoc';
} {
  if (st.nav !== true) return { st, ok: false, loi: 'nav_tat' };
  const g = st.ghe.find((x) => x.id === gheId);
  if (!g) return { st, ok: false, loi: 'lenh_khong_hop_le' };
  // D446 — cùng bộ tham số màn shop nhận qua DTO (`tuy_chon_lenh`) ⇒ bản xem trước giải y hệt.
  const tc = tuyChonLenhGhe(st, g);
  const giai = giaiLenhMoc(g, lenhMoc, tc.coChiaLenh, tc);
  if (giai.loi) return { st, ok: false, loi: giai.loi };
  if (giai.lenh.length === 0) return { st, ok: true };
  return apLenhVongNav(st, gheId, giai.lenh);
}

/**
 * v10 NAV — ÁP CHUỖI LỆNH GIAO DỊCH của một ghế trong NHỊP GIAO DỊCH.
 *
 * Trả lỗi thay vì ném: lệnh bị từ chối PHẢI NÓI RA (nếp `loi_von`), engine bỏ
 * qua im lặng là lớp lỗi đã dính nhiều lần. Thành công thì:
 * · `vi_the` đổi; `danh_muc.tai_san` ĐỒNG BỘ = các key của `vi_the` — mọi cơ
 *   chế cũ đọc danh sách mã (dungChuoi · chen chúc · gắn thẻ · khoá · trần Đa
 *   Dạng Hoá) tự đúng theo, không sửa một hàm nào;
 * · trượt giá gom vào `st.phi_giao_dich_vong`, chờ `chotPhien` đổ vào Quỹ vòng.
 *
 * ⚠ Mã đang KHOÁ (spec 02 §2.2) chưa chặn ở đây — thẻ Đầu Tư Dài Hạn chưa xây;
 * khi xây phải thêm cổng bán/mua mã khoá TRƯỚC khi mở đường bẻ kèo.
 */
export function apLenhVongNav(
  st: TrangThaiTran, gheId: string, lenh: readonly LenhGiaoDich[],
): { st: TrangThaiTran; ok: boolean; loi?: LoiLenh | 'nav_tat' | 'khong_chon_bai_duoc' } {
  if (st.nav !== true) return { st, ok: false, loi: 'nav_tat' };
  const i = st.ghe.findIndex((x) => x.id === gheId);
  if (i < 0) return { st, ok: false, loi: 'lenh_khong_hop_le' };
  const g = st.ghe[i]!;
  if (!duocChonBai(g)) return { st, ok: false, loi: 'khong_chon_bai_duoc' };

  const nhap = {
    von: g.von, vi_the: { ...g.vi_the },
    vi_the_khong: { ...(g.vi_the_khong ?? {}) },
  };
  // D446 — cùng bộ tham số với `apLenhMocNav` và bản xem trước; khoá chỉ-để-giải-mốc (`coBanKhong` · `khongTheo*` ·
  // `mocThem` · `coChiaLenh`) lõi áp bỏ qua.
  const r = apLenhGiaoDich(nhap, lenh, tuyChonLenhGhe(st, g));
  if (r.loi) return { st, ok: false, loi: r.loi };

  const ghe = [...st.ghe];
  ghe[i] = {
    ...g,
    von: nhap.von,
    vi_the: nhap.vi_the,
    // v17 — sổ khống KHÔNG vào gương tai_san: nó là vị thế độc lập, không
    // phải "cầm mã" (không ăn stack/echo sổ dài, không chiếm trần số mã).
    vi_the_khong: nhap.vi_the_khong,
    danh_muc: { ...g.danh_muc, tai_san: Object.keys(nhap.vi_the) },
    // v55 (D409) — sổ đổi tay của vòng (lửa đọc ở chotPhien, GÔNG CÙM đọc ở lệnh sau).
    ...(st.lua === true || st.trait_bat === true ? { doi_tay_vong: congDoiTay(g, lenh) } : {}),
    // v56 (D447) — sổ đổi tay theo mã của vòng (phí bậc hai cộng dồn đọc ở lệnh sau, cùng vòng).
    ...(st.phi_cong_don_vong === true ? { doi_ma_vong: congDoiMa(g.doi_ma_vong, lenh) } : {}),
  };
  return {
    st: {
      ...st, ghe,
      phi_giao_dich_vong: (st.phi_giao_dich_vong ?? 0) + r.phi_quy,
    },
    ok: true,
  };
}

/** Số thẻ chiến thuật KHÁC NHAU đang cầm (bản sao là nâng cấp, không tính hai). */
export function soOChienThuat(g: Ghe): number {
  return new Set(g.danh_muc.chien_thuat).size;
}

/**
 * Ghế này đã mở "LẬT BÀI ĐẾN HẾT TRẬN" chưa (`tu_the = 'all_in'`).
 *
 * ⚠ NGHĨA HẸP LẠI 27/07 (spec 01 §4.2c, founder sửa D34 điều 4): cờ này gác ĐÚNG
 * MỘT thứ là cú lật-đến-cuối. Còn "dồn 100% vốn" thì MỞ TỪ VÒNG 1 — founder:
 * *"Không khóa all in ở mấy round đầu nữa, chỉ khóa tính năng lật bài đến cuối
 * (Chỉ lật khi đã chọn đủ 3 chiến thuật)."* Engine vốn đã tách hai nghĩa này
 * (all-in sớm không set `tu_the`, chỉ là cược 100%), nên hàm không đổi ruột.
 *
 * ⚠ CÒN MỘT DI TÍCH CỐ Ý CHƯA GỠ: chỗ kẹp trần tố −1 chip (~dòng 1859) vẫn chặn
 * bot dồn-đến-0 khi chưa đủ thẻ. Nó nằm trong máy cược tuần tự — không còn đường
 * bấm từ UI và chết theo engine phân bổ v10 — gỡ riêng bây giờ là bump
 * balance_version chỉ để đổi hành vi bot với nhau trong pha người chơi không
 * thấy. Luật mới ship trọn gói cùng v10; nếu v10 trễ quá thì đây là chỗ gỡ.
 *
 * Luật CHỈ áp khi cổng `dac_quyen` bật. Trận cũ không có nhịp ba thẻ nên áp luật
 * này vào chúng là khoá All-in của một trận đã đánh xong bằng luật khác.
 */
export function allInMoCho(st: TrangThaiTran, g: Ghe): boolean {
  if (st.dac_quyen !== true) return true;
  // D473 — khung minigame giữ tối đa 2 lõi ⇒ ngưỡng ba thẻ không bao giờ tới; mở ở `LOI_MINIGAME.ALL_IN_KHI`.
  if (st.dong_ho_minigame === true) return soOChienThuat(g) >= LOI_MINIGAME.ALL_IN_KHI;
  return allInDaMo(soOChienThuat(g));
}

/** D473 — số lõi khác nhau phải cầm để mở All-in của trận này (DTO `con_thieu_the` đọc từ đây, không tự nhớ số). */
export function soLoiMoAllIn(st: TrangThaiTran): number {
  return st.dong_ho_minigame === true ? LOI_MINIGAME.ALL_IN_KHI : SO_THE_CHIEN_THUAT;
}

/**
 * D473 — TRẦN SỐ LÕI của ghế. Khung minigame (v57): 2, ghế cầm trait khẩu vị đa dạng (`tam_rong`) 3 — founder 04/10. Ngoài khung: hằng cũ.
 * MỘT nguồn cho người (`muaCaVong`), bot (`BoiCanh.maxLoi`) và lớp lọc lá chết của shop.
 */
export function maxLoiCua(st: TrangThaiTran, g: Ghe): number {
  if (st.dong_ho_minigame !== true) return HOLDEM_MATCH.MAX_CHIEN_THUAT;
  return (g.trait ?? []).includes(LOI_MINIGAME.TRAIT_LUOT_3) ? LOI_MINIGAME.TOI_DA_KHAU_VI : LOI_MINIGAME.TOI_DA;
}

/**
 * D473 — vòng `vong` ghế này có LƯỢT LÕI không. Khung minigame: chỉ ở `vongChonChienThuat(…, minigame)` (bàn 12: 1 · 4 · 6), và lượt thứ ba
 * chỉ cho ghế có trần > 2 (khẩu vị đa dạng). Ngoài khung: luôn có — từ D441 shop bày lõi mọi vòng, nhịp không ép ở tầng mua (giữ byte-hệt).
 */
export function coLuotLoi(st: TrangThaiTran, g: Ghe, vong: number = st.vong): boolean {
  if (st.dong_ho_minigame !== true) return true;
  const i = vongChonChienThuat(st.map.o.length, st.gian_la === true, true, st.nhip_xen_ke === true).indexOf(vong);
  return i >= 0 && (i < LOI_MINIGAME.TOI_DA || maxLoiCua(st, g) > LOI_MINIGAME.TOI_DA);
}

export type LoiShort =
  | 'khong_co_dac_quyen' | 'khong_co_ghe' | 'khong_chon_bai_duoc'
  | 'ma_khong_ton_tai' | 'da_dat_vong_nay' | 'vong_cuoi';

/**
 * ĐẶC QUYỀN PHÒNG HỘ — đặt lệnh SHORT ở vòng này, KHỚP Ở VÒNG SAU.
 *
 * Hàm THUẦN, gọi ở nhịp 1 của replay cùng chỗ với `apDaoDanhMuc`/`apKhoaTaiSan`.
 *
 * KHÔNG đòi đang nắm mã đó: bán khống đúng nghĩa là cược vào thứ mình KHÔNG cầm
 * (ví dụ của founder: thấy bong bóng đang phồng thì short để cược vào cú sập).
 * Bắt phải nắm là biến nó thành một lá phòng thủ tầm thường.
 *
 * CHẶN Ở VÒNG CUỐI: lệnh khớp ở vòng sau, mà vòng sau không tồn tại thì đó là
 * một cú bấm không bao giờ có hậu quả — và nó vẫn ghi event, tức làm bẩn đúng
 * tín hiệu "dám đặt cược trước khi biết kết quả" mà lá này sinh ra để đo (A1).
 */
export function apDatShort(
  st: TrangThaiTran, gheId: string, ma: string,
): { st: TrangThaiTran; ok: boolean; loi?: LoiShort } {
  const loi = (l: LoiShort) => ({ st, ok: false, loi: l });

  const i = st.ghe.findIndex((x) => x.id === gheId);
  if (i < 0) return loi('khong_co_ghe');
  const g = st.ghe[i]!;
  if (!coDacQuyen(st, g, 'phong_ho')) return loi('khong_co_dac_quyen');
  if (!duocChonBai(g)) return loi('khong_chon_bai_duoc');
  if (!TAI_SAN.some((t) => t.id === ma)) return loi('ma_khong_ton_tai');
  if (st.vong >= soVong(st)) return loi('vong_cuoi');
  if (g.short?.vong_dat === st.vong) return loi('da_dat_vong_nay');

  const ghe = [...st.ghe];
  ghe[i] = { ...g, short: { ma, vong_dat: st.vong } };
  return { st: { ...st, ghe }, ok: true };
}

/** Lệnh short KHỚP ở vòng này (null nếu không có). */
export function shortKhopO(g: Ghe, vong: number): { ma: string; vong_dat: number } | null {
  return g.short && g.short.vong_dat === vong - 1 ? g.short : null;
}

/** Chu kỳ khoá của ghế có phủ `vong` không (null = không khoá / đã hết hạn). */
export function khoaDangChay(g: Ghe, vong: number): KhoaChuKy | null {
  const k = g.khoa;
  if (!k) return null;
  const het = k.vong_bat_dau + KHOA_TAI_SAN.SO_VONG;
  return vong >= k.vong_bat_dau && vong < het ? k : null;
}

/**
 * `vong` có phải VÒNG CHỐT của chu kỳ khoá không — tức vòng cuối, nơi lời hứa
 * được nghiệm thu và bẻ kèo mới bị phạt.
 */
export function laVongChotKhoa(k: KhoaChuKy, vong: number): boolean {
  return vong === k.vong_bat_dau + KHOA_TAI_SAN.SO_VONG - 1;
}

/** Ghế đang bị giam vốn ở vòng này không (hậu quả bẻ kèo). */
export function biGiamVon(g: Ghe, vong: number): boolean {
  return g.giam_von_den_vong !== undefined && vong <= g.giam_von_den_vong;
}

/**
 * Ghế có BẺ KÈO ở vòng này không.
 *
 * Hai đường bẻ, và cả hai đều phải tính — nếu chỉ bắt đường đổi mã thì bỏ bài
 * trở thành cửa lách: giữ nguyên danh mục trên giấy, rút khỏi vòng, lời hứa vẫn
 * gãy mà không mất gì.
 *
 * `boBai` do `chotPhien` cấp vì chỉ vòng cược mới biết ai đã rút.
 */
export function beKeo(g: Ghe, vong: number, boBai: boolean): boolean {
  const k = khoaDangChay(g, vong);
  if (!k || !laVongChotKhoa(k, vong)) return false;
  return boBai || !g.danh_muc.tai_san.includes(k.ma);
}

/**
 * Những mã mà ghế này VỪA VÀO trong vòng hiện tại — đây là "dòng tiền mới".
 *
 * Hai nguồn, cố ý hợp nhất:
 *   · mã có trong danh mục bây giờ mà vòng trước chưa có (mua thẳng, hoặc đảo
 *     sang một mã hoàn toàn mới);
 *   · mã ĐÍCH của lần đảo vòng này, KỂ CẢ khi ghế đã cầm mã đó từ trước.
 *
 * ⚠ Vế thứ hai không thừa. Không có nó thì "đảo sang mã mình đang gom" là một
 * lệnh mua thật đi qua sổ lệnh mà không xếp hàng — đúng cái cửa sau mà cả cơ
 * chế này dựng lên để bịt.
 *
 * Gom thêm bản sao bằng SHOP thì không tính là vào mới: mua trong nhịp chọn bài
 * đã trả giá bằng ô danh mục và bằng hệ số stack giảm dần.
 */
export function vaoMoiCua(st: TrangThaiTran, g: Ghe): ReadonlySet<string> {
  const ra = new Set<string>();
  if (!luatVonBat(st)) return ra;
  const truoc = st.tai_san_truoc?.[g.id];
  if (truoc) {
    const cu = new Set(truoc);
    for (const ma of new Set(g.danh_muc.tai_san)) if (!cu.has(ma)) ra.add(ma);
  }
  if (g.dao?.vong === st.vong) ra.add(g.dao.den);
  return ra;
}

/** Bao nhiêu ghế CÒN TRONG TRẬN vừa vào từng mã ở vòng này. */
export function demVaoMoi(st: TrangThaiTran): Record<string, number> {
  const d: Record<string, number> = {};
  for (const g of st.ghe) {
    if (!conTrongTran(g)) continue;
    for (const ma of vaoMoiCua(st, g)) d[ma] = (d[ma] ?? 0) + 1;
  }
  return d;
}

export type LoiDao =
  | 'luat_tat' | 'chua_toi_vong' | 'khong_co_ghe' | 'khong_chon_bai_duoc'
  | 'ma_khong_ton_tai' | 'trung_ma' | 'khong_nam_ma' | 'da_dao_vong_nay'
  | 'day_tai_san' | 'da_toi_da_ban_sao'
  // v10 NAV — đảo danh mục đi bằng LỆNH, đường cũ đóng (mutate lá làm lệch gương vi_the).
  | 'nav_dung_lenh';

/**
 * LÕI VỐN A — ĐẢO DANH MỤC: bán một bản sao mã `tu`, mua mã `den`.
 *
 * Hàm THUẦN, gọi ở nhịp 1 sau `mua` và TRƯỚC `apKhoaTaiSan` (thứ tự đó khiến
 * không ai khoá được mã mình vừa bán trong cùng một vòng).
 *
 * Chỉ đổi DANH MỤC và ghi dấu `dao`. Toàn bộ giá phải trả — phí chuyển đổi và
 * hàng chờ khớp lệnh — nằm ở `dungChuoi`, vì chúng là biên lợi nhuận của vòng
 * chứ không phải khoản trừ thẳng vào Vốn.
 */
export function apDaoDanhMuc(
  st: TrangThaiTran, gheId: string, tu: string, den: string,
): { st: TrangThaiTran; ok: boolean; loi?: LoiDao } {
  const loi = (l: LoiDao) => ({ st, ok: false, loi: l });
  if (!luatVonBat(st)) return loi('luat_tat');
  if (st.vong < DAO_DANH_MUC.TU_VONG) return loi('chua_toi_vong');

  const i = st.ghe.findIndex((x) => x.id === gheId);
  if (i < 0) return loi('khong_co_ghe');
  const g = st.ghe[i]!;
  if (!duocChonBai(g)) return loi('khong_chon_bai_duoc');
  if (g.dao?.vong === st.vong) return loi('da_dao_vong_nay');
  if (tu === den) return loi('trung_ma');
  if (!TAI_SAN.some((t) => t.id === den)) return loi('ma_khong_ton_tai');

  const ts = [...g.danh_muc.tai_san];
  const vt = ts.indexOf(tu);
  if (vt < 0) return loi('khong_nam_ma');
  ts.splice(vt, 1);
  ts.push(den);

  if (ts.filter((x) => x === den).length > MAX_BAN_SAO) return loi('da_toi_da_ban_sao');
  if (new Set(ts).size > maxTaiSanCua(st, g)) return loi('day_tai_san');

  /*
   * THẺ ĐANG GẮN VÀO MÃ VỪA BÁN PHẢI ĐI THEO.
   *
   * Bỏ nguyên chỗ cũ thì `theAnVaoMa` không bao giờ khớp nữa và lá chiến thuật
   * thành thẻ chết — im lặng, vẫn nằm trong danh mục, vẫn hiện trên UI, chỉ là
   * không còn tác dụng gì. Đúng lớp lỗi tệ nhất, và repo này đã dính sáu lần.
   * Chỉ chuyển khi mã cũ đã ra khỏi danh mục HẲN (bán một trong nhiều bản sao
   * thì khiên vẫn còn chỗ để đứng).
   */
  let dm: DanhMuc = { ...g.danh_muc, tai_san: ts };
  if (!ts.includes(tu) && dm.gan) {
    const gan: Partial<Record<ChienThuatId, string>> = {};
    for (const [the, ma] of Object.entries(dm.gan)) {
      gan[the as ChienThuatId] = ma === tu ? den : ma;
    }
    dm = { ...dm, gan };
  }

  const ghe = [...st.ghe];
  ghe[i] = { ...g, danh_muc: dm, dao: { vong: st.vong, tu, den } };
  return { st: { ...st, ghe }, ok: true };
}

export type LoiKhoa =
  | 'luat_tat' | 'khong_co_ghe' | 'khong_chon_bai_duoc' | 'sai_nhip_vong'
  | 'khong_nam_ma' | 'dang_khoa'
  /**
   * v43 (D314) — CƠ CHẾ ĐÃ TẮT. Khác `luat_tat` (trận chạy bộ luật cũ chưa có cần gạt
   * vốn): ở đây luật vốn vẫn bật, chỉ riêng KHOÁ NẮM GIỮ bị khai tử. Client cũ vẫn gửi
   * `khoa` thì vẫn ghi `hd_khoa_tai_san` với `ok:false, loi:'co_che_tat'` — ý định là
   * dữ liệu, không vứt đi.
   */
  | 'co_che_tat';

/**
 * Bật khoá ở vòng này thì chu kỳ có kịp chốt trước khi hết map không?
 *
 * Tách ra thành hàm RIÊNG, EXPORT, vì cả engine lẫn `canGatVon` ở holdem_api
 * phải trả lời CÙNG một câu — và bản trước đã chép điều kiện ra hai chỗ, đúng
 * kiểu lỗi làm nút sáng ở client mà server từ chối.
 */
export function khoaKipChot(vong: number, soO: number): boolean {
  return vong + KHOA_TAI_SAN.SO_VONG - 1 <= soO;
}

/**
 * LÕI VỐN B — bật KHOÁ 2 VÒNG lên một mã đang cầm.
 *
 * ⚠ ĐỔI CỔNG 27/07 — và phải tách hai lý do cũ ra vì chỉ MỘT trong hai còn đúng.
 *
 * Cổng cũ là `loaiTheVong(...) === 'tai_san'`, đứng trên hai chân:
 *   (a) chữ founder "khi chọn tài sản đầu vòng" — **hết hiệu lực**: spec 01 mở
 *       chợ tài sản ở MỌI vòng, nên "vòng chọn tài sản" không còn là một loại
 *       vòng riêng.
 *   (b) **giữ chu kỳ không tràn khỏi map** — *vẫn đúng và vẫn bắt buộc*: khoá
 *       bật ở vòng áp chót thì không còn vòng nào để nghiệm thu lời hứa, và
 *       `laVongChotKhoa` sẽ không bao giờ nổ ⇒ thưởng sống sót lẫn phạt bẻ kèo
 *       đều câm lặng. Đúng lớp lỗi "nhánh tồn tại mà không có đường chạy".
 *
 * Nên cổng mới kiểm THẲNG điều (b) thay vì mượn nhịp chọn bài để suy ra nó:
 * chu kỳ phải nằm gọn trong số vòng còn lại. Ở map 8 · SO_VONG 2 ⇒ khoá được từ
 * vòng 1 đến 7 (trước đây chỉ 1 · 5 · 6).
 *
 * Giữ nguyên mã lỗi `sai_nhip_vong` để API/DB không phải đổi theo; nghĩa của nó
 * nay là "vòng này khoá thì không kịp chốt", không còn là "sai loại vòng".
 */
/*
 * ═══ v43 (D314) — NGÂN HÀNG: HỢP ĐỒNG GỬI TIẾT KIỆM ═══════════════════════════
 *
 * Founder chốt: khoá tiền mặt N ô lấy lãi cố định cao; huỷ trước hạn mất TOÀN BỘ lãi
 * tích luỹ, trả gốc. KHÔNG giới hạn số hợp đồng; ba mốc kỳ hạn 2 · 3 · 4 ô.
 *
 * ⚠ VÌ SAO CƠ CHẾ NÀY NGUY HIỂM VỚI CÂN BẰNG, ghi ngay đây để ai sửa số cũng đọc:
 * nó là chỗ DUY NHẤT trên bàn cho tiền đứng NGOÀI chợ mà vẫn sinh lời. Lãi đủ cao thì
 * "gửi hết rồi ngồi im" thành nước đi trội, và bàn thôi là một trò đọc chợ — đúng cái
 * lever D20 nói về phòng thủ ("phải CÓ GIÁ"), chỉ khác chỗ đặt. Gate **G5** canh ba cửa:
 * không có bến an toàn · không mốc nào trội tuyệt đối · quyền huỷ không miễn phí.
 */

/**
 * Kỳ hạn có nằm gọn trong bàn không. Mở ở vòng `vong`, kỳ hạn `soVong` ô ⇒ đáo hạn ở
 * vòng `vong + soVong − 1`, phải ≤ số ô của bàn.
 *
 * ⚠ Không có phép kiểm này thì người chơi mua được một lời hứa KHÔNG BAO GIỜ được
 * nghiệm thu: bàn đóng trước ngày đáo hạn, hợp đồng tất toán như huỷ, mất sạch lãi.
 * Cùng khuôn `khoaKipChot` của LÕI VỐN B.
 */
export function kipDaoHanTietKiem(vong: number, soVong: number, soO: number): boolean {
  return vong + soVong - 1 <= soO;
}

/** Mốc kỳ hạn nào còn kịp đáo hạn nếu mở ở vòng này — server tính, client chỉ vẽ (C4). */
export function mocKipCua(vong: number, soO: number): number[] {
  return TIET_KIEM.MOC.filter((n: number) => kipDaoHanTietKiem(vong, n, soO));
}

export type LoiTietKiem =
  | 'luat_tat' | 'khong_co_ghe' | 'khong_chon_bai_duoc' | 'moc_khong_hop_le'
  | 'ky_han_la' | 'khong_kip_dao_han' | 'goc_qua_nho' | 'khong_co_hop_dong'
  | 'qua_nhieu_lenh';

/**
 * HUỶ (tất toán sớm) một hoặc nhiều hợp đồng: gốc về tiền mặt, **lãi treo mất sạch**.
 *
 * ⚠ TẤT CẢ-HOẶC-KHÔNG. Một id sai là cả chuỗi bị từ chối và state không đổi — cùng luật
 * với `giaiLenhMoc`. Huỷ nửa chừng rồi báo lỗi là để người chơi ở một trạng thái họ không
 * yêu cầu, mà đây là lệnh MẤT TIỀN nên chỗ này phải chặt nhất.
 */
export function apHuyTietKiem(
  st: TrangThaiTran, gheId: string, ids: readonly string[],
): { st: TrangThaiTran; ok: boolean; loi?: LoiTietKiem } {
  const loi = (l: LoiTietKiem) => ({ st, ok: false, loi: l });
  if (st.ngan_hang !== true) return loi('luat_tat');
  const i = st.ghe.findIndex((x) => x.id === gheId);
  if (i < 0) return loi('khong_co_ghe');
  const g = st.ghe[i]!;
  const so = g.tiet_kiem ?? [];
  if (ids.length === 0) return { st, ok: true };
  // Kiểm TRƯỚC, áp SAU — không đụng state cho tới khi mọi id đều hợp lệ.
  for (const id of ids) if (!so.some((h) => h.id === id)) return loi('khong_co_hop_dong');

  const giu: HopDongTietKiem[] = [];
  const suKien = [...(g.tk_su_kien_vong ?? [])];
  let von = g.von;
  for (const h of so) {
    if (!ids.includes(h.id)) { giu.push(h); continue; }
    von += h.goc;
    suKien.push({ vong: st.vong, id: h.id, goc: h.goc, lai_mat: h.lai_don });
  }
  const gheMoi = [...st.ghe];
  gheMoi[i] = {
    ...g, von, tiet_kiem: giu, tk_su_kien_vong: suKien,
  };
  return { st: { ...st, ghe: gheMoi }, ok: true };
}

/**
 * MỞ một hoặc nhiều hợp đồng. Lệnh áp **tuần tự**: mốc thứ hai tính trên tiền mặt CÒN
 * LẠI sau mốc thứ nhất, nên "50% rồi 50%" ra 50% + 25% chứ không phải 100%.
 *
 * ⚠ TẤT CẢ-HOẶC-KHÔNG, cùng lý do với `apHuyTietKiem`.
 * ⚠ `lai_bp` chốt bằng lãi suất nền LÚC MỞ và không đổi về sau — bản chất tiền gửi có
 * kỳ hạn, và là chỗ ô kỳ họp ⚖ thành thứ đáng chờ.
 */
export function apMoTietKiem(
  st: TrangThaiTran, gheId: string,
  mo: readonly { moc_bp: number; so_vong: number }[],
): { st: TrangThaiTran; ok: boolean; loi?: LoiTietKiem } {
  const loi = (l: LoiTietKiem) => ({ st, ok: false, loi: l });
  if (st.ngan_hang !== true) return loi('luat_tat');
  const i = st.ghe.findIndex((x) => x.id === gheId);
  if (i < 0) return loi('khong_co_ghe');
  const g = st.ghe[i]!;
  if (!duocChonBai(g)) return loi('khong_chon_bai_duoc');
  if (mo.length === 0) return { st, ok: true };
  if (mo.length > TIET_KIEM.TRAN_MO_MOI_VONG) return loi('qua_nhieu_lenh');

  const coChiaLenh = st.dac_quyen === true
    && g.danh_muc.chien_thuat.includes('chia_lenh' as never);
  const soO = st.map.o.length;
  /*
   * v53 (D373) — KHOÁ THEO MỨC NHÌN THẤY. Ở v53 ô của vòng còn úp, nên `laiSuatLuc` (mức SAU
   * kỳ họp của chính vòng này) là một con số người gửi KHÔNG được biết lúc bấm gửi. Khoá hợp
   * đồng bằng nó là bán một mức lãi mà người mua không đọc được — và báo giá ở `holdem_api.ts`
   * cũng đọc `laiSuatThayDuoc`, nên hai bên phải là MỘT (báo một đằng khoá một nẻo là D67).
   * Trận ≤ v52: `vongDaLat` trả đúng `st.vong` ⇒ hai hàm trùng nhau ⇒ replay nguyên.
   */
  const diem = laiSuatThayDuoc(st) ?? LAI_SUAT_NEN.KHOI_DIEM;

  let von = g.von;
  const them: HopDongTietKiem[] = [];
  for (let k = 0; k < mo.length; k += 1) {
    const l = mo[k]!;
    if (!TIET_KIEM.MOC.includes(l.so_vong)) return loi('ky_han_la');
    if (!kipDaoHanTietKiem(st.vong, l.so_vong, soO)) return loi('khong_kip_dao_han');
    if (!mocHopLe(l.moc_bp, coChiaLenh)) return loi('moc_khong_hop_le');
    const goc = tienTuMoc(l.moc_bp, von);
    if (goc < TIET_KIEM.GOC_TOI_THIEU) return loi('goc_qua_nho');
    von -= goc;
    them.push({
      id: `tk${st.vong}_${k}`,
      goc,
      vong_mo: st.vong,
      so_vong: l.so_vong,
      lai_bp: laiTietKiemBp(diem, l.so_vong),
      lai_don: 0,
    });
  }
  const gheMoi = [...st.ghe];
  gheMoi[i] = { ...g, von, tiet_kiem: [...(g.tiet_kiem ?? []), ...them] };
  return { st: { ...st, ghe: gheMoi }, ok: true };
}

/**
 * Tất toán MỌI hợp đồng của một ghế **như HUỶ** — gốc về tiền mặt, lãi treo mất.
 * Dùng khi ghế đầu hàng và khi trận bị đóng quá hạn. Thuần: trả ghế mới, không đụng `st`.
 *
 * ⚠ Founder chốt (D309): đầu hàng / đóng quá hạn ⇒ tất toán như huỷ, KHÔNG trả lãi treo.
 * Trả lãi ở đây là biến "đầu hàng" thành một cách rút lãi sớm miễn phí.
 */
export function huyMoiHopDong(g: Ghe, vong: number): Ghe {
  const so = g.tiet_kiem ?? [];
  if (so.length === 0) return g;
  let von = g.von;
  const suKien = [...(g.tk_su_kien_vong ?? [])];
  for (const h of so) {
    von += h.goc;
    suKien.push({ vong, id: h.id, goc: h.goc, lai_mat: h.lai_don });
  }
  return { ...g, von, tiet_kiem: [], tk_su_kien_vong: suKien };
}

/**
 * v43 (D314) — TẤT TOÁN MỌI HỢP ĐỒNG khi TRẬN ĐÓNG, như HUỶ (mất lãi treo). Thuần.
 *
 * ⚠ Ở KẾT THÚC TỰ NHIÊN HÀM NÀY LÀ NO-OP, và đó là một BẤT BIẾN CÓ CẤU TRÚC chứ không
 * phải may: `kipDaoHanTietKiem` không cho mở hợp đồng nào đáo hạn sau ô cuối, nên lật
 * hết bàn là mọi hợp đồng đã tất toán. Nó chỉ thật sự làm gì ở trận bị ĐÓNG QUÁ HẠN —
 * người chơi bỏ dở giữa chừng. Có bài canh khẳng định vế "tự nhiên không còn hợp đồng".
 */
export function tatToanKhiDongTran(st: TrangThaiTran): TrangThaiTran {
  if (st.ngan_hang !== true) return st;
  if (!st.ghe.some((g) => (g.tiet_kiem ?? []).length > 0)) return st;
  return { ...st, ghe: st.ghe.map((g) => huyMoiHopDong(g, st.vong)) };
}

/** Tổng tiền đang nằm trong sổ tiết kiệm của một ghế (gốc + lãi treo). */
export function tongTietKiem(g: { tiet_kiem?: readonly HopDongTietKiem[] }): number {
  return (g.tiet_kiem ?? []).reduce((t, h) => t + h.goc + h.lai_don, 0);
}

export function apKhoaTaiSan(
  st: TrangThaiTran, gheId: string, ma: string,
): { st: TrangThaiTran; ok: boolean; loi?: LoiKhoa } {
  const loi = (l: LoiKhoa) => ({ st, ok: false, loi: l });
  /*
   * v43 (D314) — KIỂM ĐẦU TIÊN, trước cả `luatVonBat`: cơ chế chết thì mọi lý do từ
   * chối khác đều là chuyện của một cơ chế không còn tồn tại. Trả về `st` NGUYÊN VẸN —
   * không ghi gì lên ghế, không đụng `khoa_vong`.
   */
  if (st.khoa_tai_san_tat === true) return loi('co_che_tat');
  if (!luatVonBat(st)) return loi('luat_tat');

  const i = st.ghe.findIndex((x) => x.id === gheId);
  if (i < 0) return loi('khong_co_ghe');
  const g = st.ghe[i]!;
  if (!duocChonBai(g)) return loi('khong_chon_bai_duoc');
  if (!khoaKipChot(st.vong, soVong(st))) return loi('sai_nhip_vong');
  if (!g.danh_muc.tai_san.includes(ma)) return loi('khong_nam_ma');
  if (khoaDangChay(g, st.vong)) return loi('dang_khoa');

  const ghe = [...st.ghe];
  ghe[i] = { ...g, khoa: { ma, vong_bat_dau: st.vong, thuong_bp: 0 } };
  return { st: { ...st, ghe }, ok: true };
}

// ---------------------------------------------------------------------------
// Trí nhớ giá — echo sự kiện suy giảm dần (D24 mục 17.2)
// ---------------------------------------------------------------------------

/**
 * MỘT NGUỒN LỰC sự kiện đang tác động lên giá: tin đang nổ, echo tin cũ, hoặc
 * một nhánh hệ quả F1/F2. Có tên vì Bảng điện tử cũng phải nói được kiểu này.
 */
export interface LucSuKien {
  su_kien: string;
  /** Độ lớn còn lại, thang 10.000 = 100%. */
  do_lon_bp: number;
  /** Tin giả → echo ĐẢO DẤU. */
  dao: boolean;
  /**
   * Nếu lực này là NHÁNH HỆ QUẢ thì đây là sự kiện đã LẬT sinh ra nó.
   * Vắng mặt = chính sự kiện đó đã lật thật.
   *
   * ⚠ Có để sửa một lời nói dối với người chơi: bảng "VÌ SAO" từng ghi "dư âm
   * Thiên nga đen" cho một lá CHƯA HỀ LẬT — nó là hệ quả suy ra từ Hack sàn.
   * Founder bắt đúng lỗi này: "làm gì có mấy thẻ kia". Nói sai về thứ vừa giết
   * người chơi là hỏng feedback-clarity của D26 ở mức nặng nhất.
   */
  tu_nhanh?: string;
}

/**
 * Echo của các sự kiện đã lật, áp vào vòng `vong`.
 * Tin THẬT: echo theo đúng tính chất sự kiện, suy giảm mỗi vòng.
 * Tin GIẢ: echo ĐẢO DẤU khi lộ — kẻ vào lệnh theo tin đồn bị whipsaw.
 * "Đừng giao dịch theo tin đồn" thành cơ chế, không phải lời khuyên.
 *
 * ⚠ EXPORT vì Bảng điện tử (`bang_dien_tu.ts`) phải đọc ĐÚNG danh sách này thay
 * vì tự dựng lại — sổ cái echo mà lệch với thứ engine đang tính thì bảng dạy
 * người chơi sai và họ không có cách nào biết.
 */
/**
 * TỶ LỆ TIN GIẢ HIỆU DỤNG của ô vòng này và ô trước — MỘT NGUỒN cho mọi nơi
 * dựng `BoiCanh` (server thật lẫn script đo).
 *
 * ⚠⚠ VÌ SAO PHẢI DÙNG CHUNG (rà soát 11/08 — lỗi trong DỤNG CỤ ĐO). Bot
 * hoài-nghi chiết khấu tin giả ở BA kênh: chấm điểm mã, chọn lá, và cỡ cam
 * kết. Từ D71 chỉ kênh đầu đọc tỷ lệ HIỆU DỤNG v28 (5–80% theo loại sự kiện ×
 * môi trường tiền tệ); hai kênh kia vẫn 35% PHẲNG. Gate G4 vì thế chấm một
 * con bot "hoài nghi" đang hoài nghi sai mức — mà G4 tồn tại đúng để đo xem
 * đọc tin có phải kỹ năng không.
 *
 * ⚠ Mức lãi lấy TRƯỚC ô đang xét (mức lúc map rút thật/giả). Lấy mức SAU là
 * tự tay phát máy dò tin giả cho bot: mức sau chỉ nhúc nhích khi tin THẬT.
 *
 * Trận chạy luật < v28 ⇒ trả object RỖNG ⇒ bot rơi về 35% phẳng, replay
 * nguyên vẹn.
 */
export function tyLeCua(
  st: { map: HoldemMap; map_v28?: boolean; bot_dung_thuoc_that?: boolean; chu_ky_thuc_te?: boolean; the_luon_that?: boolean },
  vong: number,
): { tyLeGiaBp?: number; tyLeGiaTruocBp?: number } {
  // Cổng v30: trận cũ giữ 35% phẳng ⇒ replay ra đúng vị thế bot cũ.
  if (st.map_v28 !== true || st.bot_dung_thuoc_that !== true) return {};
  const muc = (i: number): number =>
    st.map.trang_thai?.[i - 1]?.lai_suat_diem ?? LAI_SUAT_NEN.KHOI_DIEM;
  const cua = (i: number): number | undefined => {
    const o = st.map.o[i - 1];
    return o && o.kind === 'su_kien'
      ? tyLeGiaCua(st, o.boi_canh, o.su_kien, muc(i - 1))
      : undefined;
  };
  const nay = cua(vong);
  const truoc = cua(vong - 1);
  return {
    ...(nay !== undefined ? { tyLeGiaBp: nay } : {}),
    ...(truoc !== undefined ? { tyLeGiaTruocBp: truoc } : {}),
  };
}

/**
 * TỶ LỆ TIN GIẢ HIỆU DỤNG mà bot / thống kê đọc cho MỘT ô sự kiện, theo luật của CHÍNH trận này (D456).
 *
 * Trận `the_luon_that` (v57) không có tin giả nên tỷ lệ là 0 — bot hoài nghi chiết khấu `10000 − 2p = 10000`, tức tin
 * nào cũng được tin trọn. MỘT cửa cho cả ba chỗ đọc (`tyLeCua`, `oVongUp` của bot, `nhip_lenh_bot`): bản cài đặt thứ hai
 * của cùng phép này SẼ trôi (D61), và trôi ở đây là bot đọc một trò khác trò đang chấm.
 */
export function tyLeGiaCua(
  st: { chu_ky_thuc_te?: boolean; the_luon_that?: boolean },
  boiCanh: Parameters<typeof tyLeTinGiaHieuDung>[0], suKien: Parameters<typeof tyLeTinGiaHieuDung>[1], laiSuatDiem: number,
): number {
  if (st.the_luon_that === true) return 0;
  return tyLeTinGiaHieuDung(boiCanh, suKien, laiSuatDiem, st.chu_ky_thuc_te === true);
}

export function echoDangCo(
  map: HoldemMap, vong: number,
  /** v35 (`tuongTacThe`) — bật luật ĐÚNG THUỐC. Vắng = luật cũ, replay nguyên. */
  tuongTac?: boolean,
): (LucSuKien & {
  /** Vòng sự kiện đã nổ (1-indexed). Bảng điện tử cần để áp độ trễ LUẬT 1. */
  vong: number;
})[] {
  const out: (LucSuKien & { vong: number })[] = [];
  for (let i = 0; i < vong - 1 && i < map.o.length; i += 1) {
    const o = map.o[i]!;
    if (o.kind !== 'su_kien') continue;
    const tuoi = vong - 1 - i; // 0 = vừa nổ vòng trước
    if (tuoi >= NHA_CAI.SO_VONG_ECHO) continue;
    /*
     * v35 — ĐÚNG THUỐC (D158): tăng lãi suất THẬT đã nổ SAU lạm phát thật ⇒
     * dư âm lạm phát bị dập HẲN từ đó. Cài Ở ĐÂY vì mọi người dùng echo
     * (định giá `dungChuoi` · sổ cái bảng điện tử · bot `nhip_lenh_bot`) đọc
     * chung một hàm — bảng tự thôi hứa dư âm đã chết, bot tự thôi tính nó,
     * không ai phải nhớ luật riêng. Cả hai vế đều đòi THẬT: thuốc giả không
     * dập được gì, và bệnh giả thì đã tự đảo dấu theo luật tin giả sẵn có.
     * Vòng khép: lạm phát nổ ⇒ hàm kỳ họp nghiêng TĂNG (luật v26) ⇒ thuốc về
     * ⇒ dư âm chết sớm — người đọc lịch kỳ họp có thêm một lý do thật (D150).
     */
    if (tuongTac === true && o.su_kien === 'lam_phat' && !o.la_tin_gia) {
      let biDap = false;
      for (let k = i + 1; k < vong - 1 && k < map.o.length; k += 1) {
        const t = map.o[k]!;
        if (t.kind === 'su_kien' && t.su_kien === 'tang_lai_suat' && !t.la_tin_gia) {
          biDap = true;
          break;
        }
      }
      if (biDap) continue;
    }
    let doLon = 10000;
    for (let k = 0; k < tuoi; k += 1) doLon = applyBpInt(doLon, NHA_CAI.SUY_GIAM_ECHO_BP);
    out.push({ vong: i + 1, su_kien: o.su_kien, do_lon_bp: doLon, dao: o.la_tin_gia });
  }
  return out;
}

/**
 * MỘT CỬA đọc echo cho mọi đường có `st` — tự luồn cờ tương tác v35. Gọi
 * `echoDangCo` trần trong code server là tự tách mình khỏi luật ĐÚNG THUỐC
 * (test nguồn-một-cửa đếm); hàm trần ở lại cho script đo/test dựng map tay.
 */
export function echoCua(
  st: { map: HoldemMap; tuong_tac_the?: boolean }, vong?: number,
): (LucSuKien & { vong: number })[] {
  return echoDangCo(st.map, vong ?? (st as { vong?: number }).vong ?? 1,
    st.tuong_tac_the === true);
}

/**
 * v35 — CỘNG HƯỞNG TRÚ ẨN đang MỞ ở vòng `vong`? (D158). Chiến tranh + cấm
 * vận cùng nằm trong cửa sổ lực (ô đang lật + dư âm SO_VONG_ECHO) ⇒ vàng của
 * hai nguồn đó được `machEcho` khuếch đại.
 *
 * ⚠ VẾ DƯ ÂM đòi THẬT (cờ đã công khai khi ô kế lật); Ô ĐANG LẬT đọc MẶT CHỮ
 * — tuyệt đối KHÔNG đọc `la_tin_gia` của nó: khuếch đại chỉ-khi-thật là phát
 * không máy dò tin giả (đúng bẫy `nhieuCua` đã ghi). Tin bịa giả dạng cộng
 * hưởng thì cú đảo dấu của nó cũng bị khuếch đại — nói dối trả giá gấp rưỡi.
 *
 * MỘT NGUỒN cho cả `dungChuoi` lẫn bảng điện tử: bảng gọi machEcho từng-nguồn
 * nên không tự dò cặp được — hai bên lệch nhau là "lừa có thu phí".
 */
export function coCongHuongTruAn(
  st: { map: HoldemMap; tuong_tac_the?: boolean }, vong: number,
): boolean {
  if (st.tuong_tac_the !== true) return false;
  /*
   * Cửa sổ VÒNG riêng (CONG_HUONG_CUA_SO_VONG), KHÔNG ăn ké tuổi echo: bản
   * đầu đọc `echoCua` nên cặp cách 3+ vòng câm 100% (dư âm chiến tranh chết
   * trước khi cấm vận lật — đo D158). machEcho chỉ khuếch đại dòng CÒN TRONG
   * danh sách lực, nên thành viên đã hết dư âm tự động không được nhân —
   * cặp gần cộng hưởng ~3 vòng, cặp xa ~1 vòng, chia bậc tự nhiên.
   */
  const trongCuaSo = (id: string): boolean => {
    for (let k = Math.max(0, vong - TUONG_TAC_THE.CONG_HUONG_CUA_SO_VONG);
      k <= vong - 1 && k < st.map.o.length; k += 1) {
      const t = st.map.o[k];
      if (!t || t.kind !== 'su_kien' || t.su_kien !== id) continue;
      if (k === vong - 1) return true; // ô ĐANG LẬT: mặt chữ — cấm đọc cờ
      if (!t.la_tin_gia) return true;  // quá khứ: cờ đã công khai, đòi THẬT
    }
    return false;
  };
  return trongCuaSo('chien_tranh') && trongCuaSo('cam_van');
}

/**
 * D1 — TRUYỀN NHÂN QUẢ: một tin còn vọng sang những HỆ QUẢ nó thường kéo theo.
 *
 * LUẬT SINH, không phải domino viết tay: nhánh suy thẳng từ `MT_SU_KIEN_KE_TIEP`
 * (bảng trọng số dây chuyền đã có), nên thêm một quan hệ nhân quả ở bảng đó là
 * tự động có F1/F2 tương ứng — không cần chạm hàm này.
 *
 * Vì sao đây là "làm sâu" thật: trước đó "chiến tranh" chỉ đánh vào các mã theo
 * đúng hàng chiến-tranh. Nay nó còn nhỏ một phần áp lực LẠM PHÁT vào giá TRƯỚC
 * KHI lá lạm phát được lật. Ai đọc được dây chuyền thì thấy trước; ai không đọc
 * chỉ thấy giá lạ. Đó là chỗ kỹ năng nằm.
 *
 * `dao` truyền xuống nguyên nhánh — tin bịa không được đẻ hệ quả THẬT, nếu
 * không thì "hiệu chỉnh theo tỷ lệ tin giả" hết là kỹ năng (gate G4).
 */
export function nhanhHeQua(goc: LucSuKien): LucSuKien[] {
  const ra: LucSuKien[] = [];

  /** Mấy hệ quả NẶNG NHẤT của một tin, theo bảng dây chuyền. */
  const conCua = (id: string): string[] => {
    const bang = MT_SU_KIEN_KE_TIEP[id as never] as Record<string, number> | undefined;
    if (!bang) return [];
    return Object.entries(bang)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TRUYEN_NHAN_QUA.SO_NHANH)
      .map(([k]) => k);
  };

  const doi = [
    { ids: conCua(goc.su_kien), heSo: TRUYEN_NHAN_QUA.F1_BP },
  ];
  // F2 = hệ quả của hệ quả. Chỉ đi thêm MỘT đời: sâu hơn thì mọi vòng có mọi
  // thứ tác động một chút, đúng định nghĩa của nhiễu.
  const f2Ids = doi[0]!.ids.flatMap(conCua).filter((x) => x !== goc.su_kien);
  doi.push({ ids: [...new Set(f2Ids)], heSo: TRUYEN_NHAN_QUA.F2_BP });

  for (const { ids, heSo } of doi) {
    const doLon = applyBpInt(goc.do_lon_bp, heSo);
    if (doLon < TRUYEN_NHAN_QUA.NGUONG_XIT_BP) continue; // ngưỡng xịt
    for (const id of ids) {
      ra.push({ su_kien: id, do_lon_bp: doLon, dao: goc.dao, tu_nhanh: goc.su_kien });
    }
  }

  /*
   * TRẦN TỔNG — xem docstring `TRUYEN_NHAN_QUA.TRAN_TONG_NHANH_BP`.
   *
   * Chia đều theo TỶ LỆ chứ không cắt cụt danh sách: cắt cụt thì nhánh nào bị
   * loại phụ thuộc thứ tự duyệt, tức thêm một quan hệ nhân quả vào bảng là đổi
   * ngầm kết quả của những nhánh chẳng liên quan. Chia tỷ lệ thì mọi nhánh vẫn
   * có mặt, chỉ nhẹ đi đều — và tổng luôn hữu hạn dù bảng nhân quả có dày lên
   * bao nhiêu.
   */
  const tran = applyBpInt(goc.do_lon_bp, TRUYEN_NHAN_QUA.TRAN_TONG_NHANH_BP);
  const tong = ra.reduce((t, x) => t + x.do_lon_bp, 0);
  if (tong > tran && tong > 0) {
    const heSo = idiv(tran * 10000, tong);
    for (const x of ra) (x as { do_lon_bp: number }).do_lon_bp = applyBpInt(x.do_lon_bp, heSo);
  }
  return ra;
}

/** Ba nấc thanh khoản theo thứ tự MỎNG → DÀY. Chỉ số của mảng này là "nấc". */
export const NAC_THANH_KHOAN: readonly ThanhKhoan[] = ['mong', 'vua', 'day'];

/**
 * D1 — THANH KHOẢN ĐỘNG: nấc sổ lệnh HIỆU DỤNG của một mã ở ô hiện tại.
 *
 * Trước bản này `thanh_khoan` là hằng số dán trên lá — BTC luôn mỏng, VN30 luôn
 * dày, bất kể thị trường đang êm hay đang cháy. Sai với thứ ai giao dịch thật
 * cũng biết: thanh khoản bốc hơi đúng lúc cần nó nhất.
 *
 * ⚠ Tách khỏi `doSauHieuDung` (nay chỉ còn tra `DO_SAU_L`) để Bảng điện tử vẽ
 * thanh pin bằng ĐÚNG nấc engine đang tính, chứ không suy lại từ
 * `THANH_KHOAN_DONG` một lần nữa. Hai nguồn chân lý cho cùng một nấc là lỗi tệ
 * nhất có thể ở đây: bảng sẽ dạy người chơi sai và họ không cách nào biết.
 */
export function nacHieuDung(
  ts: { id: string; thanh_khoan: ThanhKhoan }, o: OThiTruong,
  /**
   * v26 — LÃI SUẤT NỀN (điểm). `null` = trận chạy bộ luật chưa có cơ chế này ⇒
   * không dịch nấc, map cũ giữ nguyên từng chip.
   *
   * ⚠ NHẬN TỪ NGOÀI, KHÔNG TỰ SUY LẠI. Bảng điện tử vẽ thanh pin bằng đúng hàm
   * này, nên nếu mỗi bên tự tính mức thì có ngày bảng nói một nấc còn engine
   * dùng một nấc — sai IM LẶNG, và bảng sẽ dạy người chơi sai mà họ không cách
   * nào biết. Cùng lý lẽ đã viết ngay trên về `THANH_KHOAN_DONG`.
   */
  laiSuatDiem: number | null = null,
  /**
   * v54 (D395) — cổng THANH KHOẢN NĂM NẤC (`st.thanh_khoan_nam_nac`). NHẬN TỪ NGOÀI như lãi suất:
   * engine và Bảng điện tử gọi cùng hàm này với cùng cờ ⇒ một nguồn cho nấc, hai chỗ đọc.
   */
  namNac = false,
): NacThanhKhoan {
  if (!THANH_KHOAN_DONG.BAT) return ts.thanh_khoan; // cửa đo (xem config)
  if (namNac) return nacNamNac(ts, o, laiSuatDiem);
  const NAC = NAC_THANH_KHOAN;
  let i = NAC.indexOf(ts.thanh_khoan);

  const giaiDoan = o.kind === 'giai_doan' ? o.giai_doan : null;
  // ⚠ Tin GIẢ không làm mỏng sổ lệnh: thanh khoản là hành vi thật của dòng tiền,
  // không phải phản ứng với tiêu đề. Cho tin bịa siết thanh khoản là thưởng cho
  // tin đồn ở một tầng nữa — đúng bệnh đã sửa ở tầng echo.
  const suKien = o.kind === 'su_kien' && !o.la_tin_gia ? o.su_kien : null;

  if ((giaiDoan && THANH_KHOAN_DONG.MONG_DI_GIAI_DOAN.includes(giaiDoan))
    || (suKien && THANH_KHOAN_DONG.MONG_DI_SU_KIEN.includes(suKien as never))) {
    i -= 1;
  }
  if (suKien && THANH_KHOAN_DONG.DAY_THEM_SU_KIEN.includes(suKien as never)
    && THANH_KHOAN_DONG.MA_RISK_ON.includes(ts.id)) {
    i += 1;
  }

  /*
   * v26 — ĐIỀU KIỆN TIỀN TỆ (founder 04/08: tác động rõ ràng tới thanh khoản).
   * Tiền đắt ⇒ vốn rút khỏi thị trường ⇒ sổ MỎNG đi một nấc; tiền rẻ ⇒ DÀY thêm.
   *
   * ⚠ Áp cho MỌI mã, khác nhánh `DAY_THEM_SU_KIEN` chỉ ưu ái nhóm risk-on: lãi
   * suất là điều kiện tiền tệ của cả thị trường, không của riêng ai.
   * ⚠ CỘNG DỒN với nhánh giai đoạn/sự kiện ở trên, không thay thế — kẹp cuối
   * cùng lo phần tràn. Khủng hoảng TRONG môi trường tiền đắt thì mỏng hai nấc,
   * và đó đúng là thứ xảy ra ngoài đời.
   */
  if (laiSuatDiem !== null) {
    const mt = moiTruongTienTe(laiSuatDiem);
    if (mt === 'dat') i += LAI_SUAT_NEN.NAC_CAO;
    else if (mt === 're') i += LAI_SUAT_NEN.NAC_THAP;
  }

  return NAC[Math.max(0, Math.min(NAC.length - 1, i))]!;
}

/**
 * v54 (D395) — NẤC HIỆU DỤNG Ở THANG NĂM NẤC. Cùng bốn nguồn dịch nấc của D1 (pha · tin · nhóm risk-on ·
 * lãi suất), số dịch đọc từ `DICH_NAC_NAM`; kẹp cuối cùng vào [cạn, rất dày]. Nấc nền của mã nằm ở ba nấc
 * giữa nên mã nào cũng còn chỗ co và giãn (lý do của cả cổng — xem `config/thanh_khoan_nam_nac.ts`).
 * ⚠ Tin GIẢ không dịch nấc — cùng luật và cùng lý do với nhánh ba nấc ngay trên.
 */
function nacNamNac(
  ts: { id: string; thanh_khoan: ThanhKhoan }, o: OThiTruong, laiSuatDiem: number | null,
): NacThanhKhoan {
  let i = NAC_NAM.indexOf(ts.thanh_khoan);
  const giaiDoan = o.kind === 'giai_doan' ? o.giai_doan : null;
  const suKien = o.kind === 'su_kien' && !o.la_tin_gia ? o.su_kien : null;
  if (giaiDoan) i += DICH_NAC_NAM.GIAI_DOAN[giaiDoan] ?? 0;
  if (suKien) {
    i += DICH_NAC_NAM.SU_KIEN[suKien] ?? 0;
    if (DICH_NAC_NAM.MA_RISK_ON.includes(ts.id)) i += DICH_NAC_NAM.RISK_ON[suKien] ?? 0;
  }
  if (laiSuatDiem !== null) {
    const mt = moiTruongTienTe(laiSuatDiem);
    if (mt === 'dat') i += LAI_SUAT_NEN.NAC_CAO;
    else if (mt === 're') i += LAI_SUAT_NEN.NAC_THAP;
  }
  return NAC_NAM[Math.max(0, Math.min(NAC_NAM.length - 1, i))]!;
}

/** Độ sâu sổ lệnh của một nấc — thang năm nấc khi cổng bật, bảng ba nấc cũ khi tắt. */
export function doSauCuaNac(nac: NacThanhKhoan, namNac: boolean): number {
  return namNac ? DO_SAU_L_NAM[nac] : DO_SAU_L[nac as ThanhKhoan];
}

function doSauHieuDung(
  ts: { id: string; thanh_khoan: ThanhKhoan }, o: OThiTruong,
  laiSuatDiem: number | null = null,
  namNac = false,
): number {
  return doSauCuaNac(nacHieuDung(ts, o, laiSuatDiem, namNac), namNac);
}

// ---------------------------------------------------------------------------
// Chốt phiên — dựng dây chuyền
// ---------------------------------------------------------------------------

function demNguoiNam(ghe: readonly Ghe[], taiSanId: string): number {
  return ghe.filter((g) => !g.da_chay && g.danh_muc.tai_san.includes(taiSanId)).length;
}

/**
 * v13 — S ĐẦY ĐỦ của một mã tại khoảnh khắc chốt phiên (03 §5.2):
 * S-map (nạp/xả theo chuỗi ô, snapshot TRƯỚC ô này — `sinhMap` ghi sẵn) cộng
 * CROWDING của bàn — tỷ lệ ghế sống đang ôm mã, chân phản thân C4. Tất định
 * từ state nên replay nguyên; kẹp chung một trần với S-map.
 */
/**
 * D560 — ĐÈN QUÁ NÓNG (chu kỳ có ngòi; founder 08/10: *"Sức căng thì phải có thẻ quá nóng"*): lá PHA gần nhất trong hai lá ĐÃ LẬT
 * (`o[n−1]`, `o[n−2]`, n = `vongDaLat`) là QUÁ NÓNG hoặc ĐI NGANG phân phối ⇒ sức căng được phóng đại tin xấu. Người chơi thấy đèn TRƯỚC
 * khi đặt lệnh (lá ngửa), nên cú sập bị khuếch đại luôn có điềm. Thuần.
 */
export function denQuaNong(st: Pick<TrangThaiTran, 'vong' | 'o_up' | 'map'>): boolean {
  const n = vongDaLat(st);
  let daGapPha = false;
  for (let k = n - 1; k >= Math.max(0, n - DEN_BONG_BONG_O); k--) {
    const x = st.map.o[k];
    if (x?.kind === 'su_kien') {
      // Lá BONG BÓNG (mặt chữ — không đọc cờ giả) chưa vỡ cũng là đèn: gấu ĐỊNH GIÁ luôn có điềm.
      if (x.su_kien === 'bong_bong') return true;
      continue;
    }
    if (!x) continue;
    if (x.giai_doan === 'giam') return false;   // đã gãy rồi ⇒ đèn cũ tắt
    if (!daGapPha && n - 1 - k < 2 && (x.giai_doan === 'bien_dong' || x.tinh_chat === 'phan_phoi')) return true;
    daGapPha = true;
  }
  return false;
}
/** D560 — lá Bong bóng còn giữ đèn QUÁ NÓNG trong chừng này ô đã lật (tới khi gặp lá Giảm). PLAYTEST-TUNE. */
const DEN_BONG_BONG_O = 6;

/** D560 — khoản lệch theo tính chất của lá pha đang tính tiền (`TINH_CHAT_PHA_BP`); 0 ở khoá khác / lá không tính chất. */
function lechTinhChat(st: Pick<TrangThaiTran, 'chu_ky_co_ngoi'>, o: OThiTruong, tsId: string): number {
  if (st.chu_ky_co_ngoi !== true || o.kind !== 'giai_doan' || !o.tinh_chat) return 0;
  return lechTinhChatBp(o.tinh_chat, tsId);
}

/**
 * D574 — NGHIÊNG CỦA BỐI CẢNH DÀI HẠN cho mã `tsId` ở ô `o` (bp, `BOI_CANH_DAI_HAN.NGHIENG_BP`; ô đổ đèo ⇒ `DO_DEO_BP`); 0 ở khoá khác.
 * Áp MỌI ô (pha lẫn tin) — "nghiêng mỗi ô" (SPEC §5). Bối cảnh đọc từ `trang_thai` song song với `map.o` (map đã ghi lúc sinh, một nguồn).
 * Ô truyền vào không phải phần tử của map (bản sao) ⇒ dùng lá quyết toán của vòng.
 */
export function lechBoiCanh(st: Pick<TrangThaiTran, 'boi_canh_dai_han' | 'map' | 'vong' | 'o_up'>, o: OThiTruong, tsId: string): number {
  if (st.boi_canh_dai_han !== true) return 0;
  const k = st.map.o.indexOf(o);
  const t = st.map.trang_thai?.[k >= 0 ? k : st.o_up === true ? st.vong : st.vong - 1];
  if (!t?.boi_canh_dh) return 0;
  const bp = t.do_deo === true && BOI_CANH_DAI_HAN.DO_DEO_BP[tsId] !== undefined ? BOI_CANH_DAI_HAN.DO_DEO_BP[tsId]!
    : (BOI_CANH_DAI_HAN.NGHIENG_BP[t.boi_canh_dh] as Record<string, number>)[tsId] ?? 0;
  // Núm ĐO `HOLDEM_BCDH_TAT` bit NGHIENG (chỉ khi HOLDEM_SWEEP=1) — xem `phanBcdhBat`.
  // Núm ĐO `HOLDEM_BCDH_NGHIENG_HE_BP` (HOLDEM_SWEEP=1; 10000 = ×1): cường độ nghiêng để trình phương án.
  return phanBcdhBat(PHAN_BCDH.NGHIENG) ? Math.trunc((bp * doThamSo('BCDH_NGHIENG_HE_BP', 10000)) / 10000) : 0;
}

export function sucCangLuc(st: TrangThaiTran, tsId: string): number {
  if (st.suc_cang !== true) return 0;
  if (st.chu_ky_co_ngoi === true && !denQuaNong(st)) return 0;   // D560 — sức căng chỉ cắn khi đèn QUÁ NÓNG đang bật
  const iMa = THU_TU_MA_SUC_CANG.indexOf(tsId);
  const sMap = st.map.trang_thai?.[st.vong - 1]?.suc_cang_bp[iMa] ?? 0;
  const song = st.ghe.filter((x) => !x.da_chay).length;
  const crowd = song > 0
    ? Math.floor((SUC_CANG.CROWD_BP * demNguoiNam(st.ghe, tsId)) / song)
    : 0;
  return Math.min(SUC_CANG.TRAN_BP, sMap + crowd);
}

/**
 * v26 — LÃI SUẤT NỀN đang có hiệu lực ở vòng này (điểm), hoặc `null` nếu trận
 * chạy bộ luật chưa có cơ chế.
 *
 * ⚠ MỘT CỬA DUY NHẤT để hỏi mức, y như `sucCangLuc` cho sức căng. Ai đó suy lại
 * mức từ `action_log` ở một chỗ khác là dựng bản sao thứ hai — và bản sao thứ
 * hai luôn là bản sẽ trôi (D61).
 * ⚠ Đọc mức của LÁ QUYẾT TOÁN vòng này — lá `chotPhien` định giá. Luật ngửa: `o[vong − 1]`. Luật ô úp (D382): `o[vong]`
 * — nhưng chỉ dưới khoá v66 (D566). v53–v65 vẫn đọc `vong − 1` (lá ĐÃ LẬT cuối) ⇒ kỳ họp chỉ đổi lãi từ vòng SAU: lỗi
 * D382 bỏ sót (D563), GIỮ NGUYÊN cho replay (A11.3) — `tests/o_up_v53_lai_ap.test.ts` ghim cả hai vế.
 * ⚠ Dưới v66 đây là mức NGƯỜI CHƠI CHƯA THẤY (kỳ họp còn úp). Mọi đường TRÌNH BÀY và mọi bối cảnh BOT đọc
 * `laiSuatThayDuoc` (xem `coV42ChoBot`), không đọc hàm này.
 */
export function laiSuatLuc(st: TrangThaiTran): number | null {
  if (st.lai_suat_nen !== true) return null;
  const i = st.lai_ap_la_quyet_toan === true && oVongUp(st) ? st.vong : st.vong - 1;
  return st.map.trang_thai?.[i]?.lai_suat_diem ?? LAI_SUAT_NEN.KHOI_DIEM;
}
/**
 * v53 (D373) — SỐ Ô NGƯỜI CHƠI ĐÃ NHÌN THẤY LẬT tính tới lúc này.
 *
 * Tới v52 ô của vòng nằm NGỬA suốt pha quyết định, nên "đã lật" = `st.vong`. Từ v53 ô ấy còn
 * ÚP tới lúc chốt, nên "đã lật" = `st.vong - 1`.
 *
 * ⚠⚠ MỘT CỬA DUY NHẤT cho MỌI đường TRÌNH BÀY (DTO trạng thái · bảng điện tử · đếm bài · báo giá
 * tiết kiệm). Engine định giá thì KHÔNG đi qua đây — `chotPhien` vẫn đọc `map.o[st.vong - 1]`,
 * vì ô ấy đúng là ô sắp chạy giá. Hai câu hỏi khác nhau ("tính bằng ô nào" vs "được thấy ô nào")
 * nên có hai hàm; trộn chúng là vừa lộ bài vừa sai giá.
 *
 * ⚠ Vòng 1 ở v53 trả 0 — chưa ô nào lật. Mọi nơi đọc phải chịu được 0 (slice rỗng, `?? null`).
 */
export function oVongUp(
  st: { vong: number; o_up?: boolean;  map: { o: readonly OThiTruong[] } },
): boolean {
  if (st.o_up !== true) return false;
  /*
   * ⭐ D379 (founder 22/09, ngay sau khi v53 lên prod): *"đáng ra phải giữ thẻ sự kiện đầu
   * tiên chứ. Vào trận úp hết thế này t biết làm gì ngoài chốt vòng đợi"*.
   *
   * Ô VÒNG 1 LUÔN NGỬA. Nó là BỐI CẢNH MỞ MÀN, không phải thứ để cược: founder nói thẳng
   * *"vòng 1 có ảnh hưởng gì đâu ngoài thiết lập trạng thái vĩ mô và mở đầu chuỗi"*.
   * Trước cú sửa này, vòng 1 bị úp 100% số trận — `sinhMap` cấm ô tin ở vòng 1 mà v53 chỉ
   * úp ô pha — nên người chơi vào trận không có MỘT thứ gì để dựa vào. Tôi đã nêu chuyện
   * này như một ghi chú kỹ thuật và để nó đi tiếp; đó là đọc sai: không có thông tin thì
   * không còn quyết định, và một vòng không có quyết định là một vòng chết.
   */
  // D382 — KHÔNG còn ngoại lệ vòng 1: lá mở màn là `o[0]` (ngửa), lá úp là `o[1]`, có thật.
  /*
   * ⭐⭐ CHỈ ÚP Ô PHA — Ô TIN VẪN NGỬA. Đây là hình dạng v53 ĐÃ ĐO, không phải bản đầu.
   *
   * Bản đầu úp TẤT CẢ và gate đỏ ba hàng ở 4.000 trận (G2 oracle 3,24 > chơi-được 2,87 ·
   * G3 ngồi im 3,09 · G4 hoài-nghi tệ nhất), với đỉnh bảng đổi từ bot GIAO DỊCH sang bot
   * GỬI TIẾT KIỆM. Chín cú quét tham số không dịch nổi nó. Lý do đo ra được:
   *   · lời báo của tin THẬT đúng 44–50% (nền chỉ 15–30%) ⇒ tín hiệu MẠNH;
   *   · nhưng tín hiệu ấy CHỈ có sau ô tin (35% số ô), còn 65% còn lại đoán theo nền chỉ
   *     đúng 36–44% — tức xấp xỉ tung đồng xu. Úp cả hai loại là biến hai phần ba trận
   *     thành may rủi, và khi may rủi thì không-làm-gì là nước đi trội.
   *
   * Úp đúng ô PHA giữ được cả hai vế:
   *   · ô TIN ngửa ⇒ cược "tin này thật hay bịa" — biết thật/giả đáng ~36 điểm %, đúng thứ
   *     cả kiến trúc tin giả sinh ra để đo;
   *   · ô PHA úp ⇒ bịt lỗ 15 điểm % tiền-cho-không, và vì `sinhMap` CẤM hai ô tin liền nhau
   *     nên **sau mỗi lá tin luôn là đúng một vòng kiểm chứng úp** — chính câu founder nói:
   *     *"round này thấy hạ lãi suất nên mua crypto, round sau tăng nóng"*.
   * Đo 2.000 trận · bàn 12: G1 ✓ · G2 ✓ (oracle 2,51 < chơi-được 2,86 < bấm-bừa 3,78) ·
   * G3 ✓ (ngồi im 3,64) · G4 ✓ (hoài-nghi 3,07 tốt nhất). Bốn hàng, khác cả v52 lẫn bản úp-tất.
   */
  /*
   * ⭐⭐ D379 — ÚP ĐỀU MỌI LOẠI Ô. Bỏ hẳn vế `kind !== 'su_kien'`.
   *
   * Founder 22/09 tả đích danh triệu chứng: *"ở thẻ sự kiện tôi được chốt vòng 2 lần, cả
   * 2 đều tính kết quả… rồi lật một phát 2 thẻ tiếp theo thay vì 1 thẻ"*.
   *
   * Vế miễn-ô-tin làm con trỏ "ô đã lật" (`vongDaLat`) NHẢY HAI BẬC: vòng pha trỏ N−2,
   * vòng tin trỏ N. Hai hệ quả, đúng như founder thấy: ô tin bị coi là ĐÃ lật nên kết quả
   * tính một lần lúc lật rồi tính lại lúc chốt; và bản đồ nhảy hai ô một nhịp.
   *
   * ⚠ VÌ SAO BỎ ĐƯỢC MÀ KHÔNG MẤT TÍN HIỆU — tôi đã đo SAI câu hỏi lần trước. Phép đo cũ
   * kết luận "úp cả ô tin ⇒ 65% số vòng thành tung đồng xu", nhưng nó đo trên giả định
   * telegraph phải đọc được ở CHÍNH vòng nó nằm. Trong mô hình founder thì không: lá tin
   * lật lên là đã NGỬA, và nó báo cho lá KẾ TIẾP — tức tín hiệu vẫn nguyên, chỉ dùng ở
   * vòng sau. Ô úp luôn là ô CHƯA AI THẤY, mỗi vòng lật đúng một lá.
   * ⚠ Cân bằng CHƯA ĐO LẠI với hình dạng này (xem D379 §nợ).
   */
  return true;
}

export function vongDaLat(
  st: { vong: number; o_up?: boolean;  map: { o: readonly OThiTruong[] } },
): number {
  // Một cửa: ô của vòng có đang úp không thì `oVongUp` quyết, không ai suy lại bằng cờ trần.
  /*
   * D382 — với BỐI CẢNH MỞ MÀN, lá đã lật ở vòng N là `o[0..N-1]` ⇒ ĐÚNG N lá, kể cả
   * vòng 1 (chỉ có lá mở màn). Lá đang úp là `o[N]` — lá sẽ quyết toán vòng này, lật ở
   * đầu vòng sau. Nhờ vậy MỖI VÒNG CÓ ĐÚNG MỘT LÁ MỚI LẬT, kể cả vòng 2 — đúng chỗ ba
   * cú vá 22/09 (D378·D379·D380) đều trượt.
   */
  return st.vong;
}

/**
 * D433 — CHỈ SỐ LÁ TIN mà lời báo (`bao_truoc`) của nó rọi vào ô người chơi đang cược. Thuần, chỉ đọc.
 *
 * Luật ngửa: ô của vòng là `o[vong−1]`, lá báo trước nó là `o[vong−2]`. Luật ô úp (D382): lá đang cược là
 * `o[vong]`, lá báo trước nó là lá VỪA LẬT `o[vongDaLat−1]` — đúng lá `boiCanhUpCua` phát cho bot.
 * ⚠ Trước D433 màn người chơi (`holdem_api` · `telegraph`) vẫn đọc `o[vong−2]` ở cả luật ô úp: lời báo tới
 * TRỄ một vòng và gạch lên SAI ô úp, trong khi bot đọc đúng lá — lớp "úp với người mà không úp với bot".
 * `tests/bao_truoc_up_o.test.ts` khoá: lá người thấy = lá bot đọc.
 */
export function iLaBaoTruoc(
  st: { vong: number; o_up?: boolean;  map: { o: readonly OThiTruong[] } },
): number {
  return oVongUp(st) ? vongDaLat(st) - 1 : st.vong - 2;
}

/**
 * v53 (D373) — MỨC LÃI SUẤT NGƯỜI CHƠI NHÌN THẤY (điểm), khác `laiSuatLuc` đúng ở v53.
 *
 * `laiSuatLuc` trả mức của ô ĐANG CHẠY GIÁ — tức mức SAU kỳ họp của vòng này. Ở v53 kỳ họp ấy
 * chưa lật, nên phát mức đó ra màn là phát luôn kết quả cuộc họp: ô úp rò qua một con số.
 * Hàm này trả mức của ô ĐÃ LẬT gần nhất.
 *
 * ⚠ Đây KHÔNG phải bản sao thứ hai của một công thức (D61): cả hai đọc CÙNG một bảng
 * `map.trang_thai[].lai_suat_diem`, chỉ khác chỉ số. Thứ bị cấm nhân đôi là phép TÍNH mức,
 * và phép đó vẫn nằm đúng một chỗ trong `sinhMap`.
 */
/**
 * SỐ VÒNG CỦA TRẬN — **không phải số ô**.
 *
 * D382: với BỐI CẢNH MỞ MÀN, `o[0]` không quyết toán vòng nào và vòng N quyết toán bằng
 * `o[N]` ⇒ bộ bài `k` ô chỉ chạy được `k − 1` vòng. Trước khi có hàm này, **chín chỗ** trong
 * engine lấy thẳng `map.o.length` làm số vòng, nên trận chạy thừa một vòng rồi `chotPhien`
 * đọc `o[k]` (không tồn tại) và nổ — 47 bài đỏ cùng một gốc.
 *
 * ⚠ MỘT NGUỒN (D61). Thấy `map.o.length` đứng ở chỗ nghĩa là "số vòng" thì đổi sang đây,
 * đừng trừ 1 tại chỗ — trừ tại chỗ là dựng bản sao thứ mười.
 * Luật CŨ (không `o_up`) giữ nguyên: số vòng == số ô.
 */
export function soVong(st: { o_up?: boolean; map: { o: readonly OThiTruong[] } }): number {
  return st.map.o.length - (st.o_up === true ? 1 : 0);
}

export function laiSuatThayDuoc(st: TrangThaiTran): number | null {
  if (st.lai_suat_nen !== true) return null;
  const i = vongDaLat(st) - 1;
  if (i < 0) return LAI_SUAT_NEN.KHOI_DIEM;
  return st.map.trang_thai?.[i]?.lai_suat_diem ?? LAI_SUAT_NEN.KHOI_DIEM;
}
/**
 * v53 (D373) — Ô KỲ VỌNG + LỜI BÁO cho bối cảnh bot khi ô của vòng còn ÚP.
 *
 * ⚠⚠ MỘT NGUỒN CHO HAI ĐƯỜNG. Khối dựng bối cảnh bot tồn tại HAI bản — đường thật
 * (`holdem_api.ts`) và bàn đo (`nhip_lenh_bot.ts`, xem docstring D156 ở đó) — và lịch sử repo
 * nói rõ chuyện gì xảy ra khi chỉ sửa một bản: v47/v48 ra số gate TRÙNG HỆT bản trước vì bàn đo
 * không đi qua đường vừa sửa. Nên phần RIÊNG của v53 nằm ở đây, hai bên chỉ việc rải vào.
 *
 * Bot được thấy đúng những gì người chơi thấy:
 * · `o` = ô KỲ VỌNG — pha của chuỗi đang chạy tiếp, đọc từ ô ĐÃ LẬT gần nhất;
 * · `up.bao_truoc` = lời báo của lá tin vừa lật (null nếu ô vừa lật không phải tin);
 * · `up.ty_le_gia_bp` = tỷ lệ tin giả hiệu dụng CỦA LÁ TIN ẤY — mức lãi lấy TRƯỚC nó, y hệt
 *   quy ước đã có ở `tyLeCua` (lấy mức sau là phát máy dò tin giả, giết G4).
 * `that` trả RIÊNG, ngoài `up`: chỉ oracle của bàn đo được rải nó vào.
 */
/**
 * v54 (D389) — MÙA ĐOÁN ĐƯỢC TỪ THÔNG TIN CÔNG KHAI, để bot chấm lá pha còn úp.
 *
 * Chỉ đọc thứ người chơi cũng thấy: hướng mùa (`run_huong` — ra màn qua `xu_huong`) và các
 * mặt lá đã ngửa. Hướng LÊN ⇒ 'tang' · XUỐNG ⇒ 'giam' · hướng 0 (QUÁ NÓNG hoặc ĐÌNH TRỆ) ⇒
 * mặt pha ngửa gần nhất nếu nó là một trong hai mặt ấy (8/10 lá hiện đúng mùa), không thì QUÁ
 * NÓNG — mùa hướng 0 hay gặp hơn: mọi mùa TĂNG đều đi qua nó, ĐÌNH TRỆ chỉ tới qua ngã rẽ.
 * ⚠ KHÔNG đọc `trang_thai.mua`: mùa là biến ẩn, bot đọc nó là bot biết thứ người không biết
 * (đúng lỗi "úp với người mà không úp với bot" mà `oUp` sinh ra để chặn).
 */
function nenBanhXeCongKhai(st: TrangThaiTran, daLat: number): GiaiDoanId {
  const t = daLat >= 1 ? st.map.trang_thai?.[daLat - 1] : undefined;
  if (t === undefined) return 'di_ngang';
  if (t.run_huong === 1) return 'tang';
  if (t.run_huong === -1) return 'giam';
  for (let k = daLat - 1; k >= 0; k -= 1) {
    const o = st.map.o[k];
    if (o?.kind === 'giai_doan') {
      return o.giai_doan === 'bien_dong' || o.giai_doan === 'di_ngang' ? o.giai_doan : 'bien_dong';
    }
  }
  return 'bien_dong';
}

export function boiCanhUpCua(st: TrangThaiTran): {
  o: OThiTruong;
  up: { bao_truoc: GiaiDoanId | null; ty_le_gia_bp?: number };
  that?: boolean;
} | null {
  // Ô TIN vẫn ngửa ⇒ bot đi nhánh cũ (đọc chính ô ấy), y như v52. Xem `oVongUp`.
  if (!oVongUp(st)) return null;
  const daLat = vongDaLat(st);
  const t = daLat >= 1 ? st.map.trang_thai?.[daLat - 1] : undefined;
  /*
   * NỀN = chuỗi chạy tiếp. Vòng 1 (chưa ô nào lật) ⇒ ĐI NGANG: không có gì để suy, và đi ngang
   * đúng là thứ `sinhMap` lấy làm nền ("thị trường êm cho tới khi tin làm nó động").
   */
  const nen: GiaiDoanId = st.banh_xe === true ? nenBanhXeCongKhai(st, daLat)
    : t === undefined || t.run_huong === 0 ? 'di_ngang'
    : t.run_huong === 1 ? 'tang' : 'giam';
  const oTruoc = daLat >= 1 ? st.map.o[daLat - 1] : undefined;
  const tinh = oTruoc !== undefined && oTruoc.kind === 'su_kien' ? oTruoc : null;
  const tyLe = tinh !== null && st.map_v28 === true && st.bot_dung_thuoc_that === true
    ? tyLeGiaCua(
      st, tinh.boi_canh, tinh.su_kien,
      (daLat >= 2 ? st.map.trang_thai?.[daLat - 2]?.lai_suat_diem : undefined)
        ?? LAI_SUAT_NEN.KHOI_DIEM)
    : undefined;
  /*
   * D560 — chu kỳ có ngòi: lá pha NGỬA gần nhất cùng mặt với ô kỳ vọng ⇒ ô kỳ vọng mang tính chất của nó (mùa chạy tiếp — bò dòng tiền vẫn là
   * dòng tiền, phân phối vẫn là phân phối). Thông tin CÔNG KHAI (icon góc lá), không đọc mùa ẩn.
   */
  let tcUp: TinhChatPha | undefined;
  if (st.chu_ky_co_ngoi === true) {
    for (let k = daLat - 1; k >= 0; k -= 1) {
      const x = st.map.o[k];
      if (x?.kind === 'giai_doan') { if (x.giai_doan === nen) tcUp = x.tinh_chat; break; }
    }
  }
  return {
    o: { kind: 'giai_doan', giai_doan: nen, ...(tcUp ? { tinh_chat: tcUp } : {}) },
    up: {
      bao_truoc: tinh !== null ? tinh.bao_truoc : null,
      ...(tyLe !== undefined ? { ty_le_gia_bp: tyLe } : {}),
    },
    ...(tinh !== null ? { that: !tinh.la_tin_gia } : {}),
  };
}

/**
 * Khuếch đại BẤT ĐỐI XỨNG theo sức căng (§5.4): vế tốt nhân nhẹ, vế xấu nhân
 * nặng — sập nhanh hơn tăng, và đó cũng là chốt giữ EV không phi ra ngoài.
 * Cú nổ tỉ lệ S tại lúc nổ = bất biến "EV phẳng, phương sai nổ".
 */
/**
 * v15 — BIÊN ĐỘ + BẤT ĐỐI XỨNG của chu kỳ map (bước 6): map "biên độ lớn" thì
 * mọi cú kéo giá to hơn; map "sập gắt" nhân THÊM vế xấu. Áp TRƯỚC sức căng —
 * chu kỳ là bối cảnh vĩ mô, sức căng là trạng thái vi mô chồng lên.
 */
export function apChuKyBienDo(st: TrangThaiTran, delta: number): number {
  if (st.co_chu_ky !== true || !st.map.chu_ky || delta === 0) return delta;
  const ck = st.map.chu_ky;
  let d = Math.trunc((delta * CHU_KY.BIEN_DO_BP[ck.amp]!) / 10000);
  if (d < 0) d = Math.trunc((d * CHU_KY.XAU_THEM_BP[ck.asym]!) / 10000);
  return d;
}

function apCang(delta: number, sBp: number): number {
  if (sBp <= 0 || delta === 0) return delta;
  const he = delta > 0 ? SUC_CANG.HS_TOT_BP : SUC_CANG.HS_XAU_BP;
  return delta + Math.trunc((delta * sBp * he) / 100_000_000);
}

/**
 * Mắt xích ECHO của một tập nguồn lực, áp lên danh mục `dm`.
 *
 * ⚠ Tách ra khỏi `dungChuoi` để Bảng điện tử tính "tổng lực kéo ròng" bằng ĐÚNG
 * vòng lặp engine dùng lúc chấm điểm. Nếu bảng tự cộng lại theo cách riêng thì
 * con số nó hứa và con số vòng chốt phiên trả về sẽ lệch nhau — mà người chơi
 * vừa TRẢ 25 Vốn cho con số đó, nên đó là lừa có thu phí.
 *
 * Không cộng dồn hộ ai: trả mảng, tầng gọi tự cộng. Nhờ vậy Bảng điện tử tách
 * được lực theo từng nguồn (mỗi dòng sổ cái) còn `dungChuoi` cộng hết vào PnL.
 */
export function machEcho(
  nguon: readonly LucSuKien[], oTaiSan: readonly string[], dm: DanhMuc,
  /**
   * v13 — S đầy đủ của từng mã (0 khi cổng tắt). Là THAM SỐ chứ không tự tra
   * trong hàm: Bảng điện tử phải truyền ĐÚNG closure engine dùng, nếu không
   * con số bảng hứa và con số chốt phiên lệch nhau — lừa có thu phí.
   */
  sCua: (id: string) => number = () => 0,
  /** v15 — biến đổi biên độ chu kỳ; Bảng điện tử phải truyền CÙNG closure. */
  bienDo: (d: number) => number = (d) => d,
  /**
   * v35 — CỘNG HƯỞNG TRÚ ẨN đang mở (từ `coCongHuongTruAn` — tầng gọi tính,
   * KHÔNG tự dò trong hàm: bảng điện tử gọi từng-nguồn nên trong hàm không
   * nhìn thấy cặp). Bảng phải truyền CÙNG giá trị engine dùng.
   */
  congHuong?: boolean,
  /**
   * v41 — LỚP VN (D307): MỘT CỬA chọn bảng, xem `TrangThaiTran.lop_vn`. Hàm
   * này không nhận `st` nên không tự tra được — tầng gọi (engine lẫn bảng
   * điện tử) phải truyền ĐÚNG cờ của chính trận, bài học `bangCanTroi`.
   */
  bo: BoMaTran = 'v40',
): (MatXich & { kind: 'echo' })[] {
  const ra: (MatXich & { kind: 'echo' })[] = [];
  for (const e of nguon) {
    for (const tsId of oTaiSan) {
      const goc = mtSuKien(bo)[tsId]?.[e.su_kien as never] ?? 0;
      if (goc === 0) continue;
      // Stack khuếch đại cả echo — nắm 3 lá BTC thì tin về BTC đánh mạnh hơn.
      let delta = applyBpInt(applyBpInt(goc, e.do_lon_bp), heSoStackBp(capThe(dm, tsId)));
      if (e.dao) delta = -delta;
      /*
       * v35 — CỘNG HƯỞNG TRÚ ẨN (D158): vàng của HAI NGUỒN trong cặp được
       * nhân, áp SAU cú đảo tin giả (tin bịa giả dạng cộng hưởng thì cú đảo
       * cũng gấp rưỡi — nói dối trả giá) và TRƯỚC biên độ/sức căng như mọi
       * lực nền khác.
       */
      const trongCap = e.su_kien === 'chien_tranh' || e.su_kien === 'cam_van';
      if (congHuong === true && trongCap && tsId === 'vang') {
        delta = applyBpInt(delta, TUONG_TAC_THE.CONG_HUONG_VANG_BP);
      }
      // §5.4 — trừng phạt cá biệt: cùng một tin mà mã căng nhất chịu đòn nặng
      // nhất. Áp SAU cú đảo tin giả: tin đồn trên mã căng cũng gây hoảng thật.
      const sBp = sCua(tsId);
      const sau = apCang(bienDo(delta), sBp);
      ra.push({
        kind: 'echo', id: tsId, su_kien: e.su_kien, delta_bp: sau,
        // Dải kèm số: ex-post MỌI NGƯỜI thấy "RẤT CĂNG" chứ không thấy bp (§5.5d).
        ...(sau !== delta ? { cang_bp: sBp, cang_dai: daiSucCang(sBp) } : {}),
        ...(e.tu_nhanh ? { tu_nhanh: e.tu_nhanh } : {}),
        ...(e.dao ? { dao: true as const } : {}),
        ...(congHuong === true && trongCap && tsId === 'vang'
          ? { cong_huong_tru_an: true as const } : {}),
      });
    }
  }
  return ra;
}

/**
 * NHIỄU CỦA MỘT MÃ TRONG VÒNG NÀY — có tương quan hay không tuỳ cổng v9 (D39).
 *
 * Trước v9: mỗi mã một lần rút độc lập ⇒ giữ 4 mã là trung bình hoá mất khoảng một
 * nửa cú sốc, LUÔN LUÔN, kể cả giữa Thiên nga đen. Đó là lý do khoảnh khắc "mọi thứ
 * sụp cùng lúc" chưa bao giờ xảy ra được về mặt toán học.
 *
 * Từ v9: mô hình MỘT NHÂN TỐ —  z_i = β_i·z_chung + √(1−β_i²)·z_riêng_i
 * ⇒ ma trận tương quan ρ_ij = β_i·β_j SINH RA chứ không phải điền vào, nên nó luôn
 * hợp lệ (xem `TUONG_QUAN` trong config để biết vì sao bảng 6×6 gõ tay gần như chắc
 * chắn không hợp lệ, và vì sao điều đó hỏng IM LẶNG).
 *
 * ⚠⚠ KHÔNG ĐƯỢC ĐỌC `la_tin_gia` Ở ĐÂY — VÀ ĐÂY LÀ BẪY NGUY HIỂM NHẤT CỦA CẢ CỤM.
 * Nếu tương quan chỉ dâng lên với tin THẬT thì người chơi chỉ cần nhìn "mọi mã có
 * cùng nhịp không" là biết tin thật hay giả. Tức là ta vừa phát không một cái máy dò
 * tin giả — giết gate G4 và giết luôn bản sắc "tin giả" của trò. Nên khoá theo Ô NHƯ
 * NGƯỜI CHƠI THẤY: tin đồn cũng gây hoảng loạn cùng nhịp y như tin thật, và ngoài
 * đời đúng là vậy. Cùng nguyên tắc đã áp cho `GOI_KY_QUY` và `xepHangUngVien`.
 *
 * ⚠ `√(1−β²)` giữ ĐỘ BIẾN ĐỘNG RIÊNG TỪNG MÃ Y NGUYÊN. Nếu chỉ cộng thêm cú sốc
 * chung mà không co phần riêng thì tổng biến động phình lên, và mọi chênh lệch
 * Monte Carlo đo được sau đó không tách được "tương quan làm khó" khỏi "engine vừa
 * ồn hơn".
 *
 * Ghi chú phân phối: trộn hai biến đều cho ra hình chuông hơn là hình hộp. Đó là
 * TÁC DỤNG PHỤ CHẤP NHẬN ĐƯỢC và thậm chí thật hơn — phương sai vẫn giữ nguyên,
 * chỉ đuôi mỏng đi một chút ở các mức β trung gian.
 */
export function nhieuCua(st: TrangThaiTran, ts: TaiSan, o: OThiTruong): number {
  const rieng = rngAt(st.seed, 'holdem_nhieu', st.vong, ts.id);
  const bV2 = st.beta_tai_san_v2 === true;
  const bd45 = st.bien_dong_v45 === true;
  if (st.tuong_quan !== true) return symmetricNoise(rieng, bienDongCua(ts, bV2, bd45));

  const suKien = o.kind === 'su_kien' ? o.su_kien : null;
  const beta = betaCua(ts.id, ts.nhom, suKien, bV2);
  const k = heSoRiengBp(beta);

  /*
   * Domain RIÊNG cho cú sốc chung, KHÔNG có toạ độ mã — cả bàn dùng chung đúng một
   * lần rút mỗi vòng, nếu không thì nó không phải "chung".
   *
   * Thêm domain mới an toàn với trận cũ vì `rngAt` BĂM THEO TOẠ ĐỘ (`seedAt(seed,
   * domain, ...coords)`) chứ không phải một dòng tuần tự — lần rút mới không xê dịch
   * lần rút nào đang có. Cổng `tuong_quan` vẫn là thứ bảo đảm cuối cùng.
   */
  const zChung = symmetricNoise(rngAt(st.seed, 'holdem_soc_chung', st.vong), 10000);
  const zRieng = symmetricNoise(rieng, 10000);

  // Nhân trước chia sau, làm tròn MỘT lần — cùng kỷ luật số nguyên với A5.1.
  return Math.trunc(
    (beta * zChung + k * zRieng) * bienDongCua(ts, bV2, bd45) / (10000 * 10000));
}

/** Dựng dây chuyền chấm điểm cho MỘT ghế. Thứ tự mảng = thứ tự diễn. */
/**
 * v42 (D311) — DANH SÁCH LỰC SỰ KIỆN của ô này: tin đang nổ + echo tin cũ
 * (+ nhánh hệ quả F1/F2 với trận ≤ v17).
 *
 * ⚠ TÁCH RA ĐỂ CÓ MỘT CỬA, không phải để gọn. Từ v42 có HAI máy đọc cùng danh
 * sách này: `dungChuoi` (áp lên GIÁ vị thế) và `apSuKienTienMat` (áp lên TIỀN
 * MẶT). Hai máy tự dựng lấy danh sách là đúng bẫy D61 — chúng sẽ trôi khỏi nhau
 * ở đúng chỗ khó thấy nhất: quy ước tin giả (`dao`) và hệ số nền của tin.
 *
 * ⚠ PHẢI BYTE-HỆT bản cũ nằm trong `dungChuoi`. Bằng chứng: golden replay
 * (`tests/holdem_replay_golden.test.ts`) quét toàn ma trận phiên bản × cỡ map.
 */
export function lucSuKienCua(st: TrangThaiTran, o: OThiTruong): LucSuKien[] {
  const echos = echoCua(st, st.vong);
  const goc: LucSuKien[] = o.kind === 'su_kien'
    ? [{
      su_kien: o.su_kien,
      do_lon_bp: applyBpInt(10000, heSoTinTheoNen(st, o)),
      dao: o.la_tin_gia,
    }, ...echos]
    : echos;
  return st.bo_nhanh_he_qua === true
    ? goc
    : [...goc, ...goc.flatMap(nhanhHeQua)];
}

/**
 * v42 (D311) — COUPON suất mỗi ô của trận này (bp trên vị thế).
 *
 * Neo vào lãi suất nền ĐANG CÔNG BỐ, không phải một hằng số riêng: ngân hàng
 * trung ương trong trận đã là một máy, thêm máy thứ hai là hai nguồn (D61).
 * Trận chưa bật `laiSuatNen` thì `laiSuatLuc` trả null ⇒ dùng mức khởi điểm.
 */
export function couponBpCua(st: TrangThaiTran): number {
  if (st.coupon_tpcp !== true) return 0;
  // v45 — cờ bật ⇒ `couponBp` đi qua `laiSuatDaiBp` trước. MỘT cửa, không nhánh
  // thứ hai ở đây: nhánh thứ hai là chỗ hai bản cài đặt bắt đầu trôi (D61).
  return couponBp(laiSuatLuc(st) ?? LAI_SUAT_NEN.KHOI_DIEM, st.duong_cong === true);
}

/**
 * v42 (D311) — BA CỜ v42 mà BỐI CẢNH LỆNH CỦA BOT phải mang, dựng MỘT CHỖ.
 *
 * Tồn tại vì đúng một lỗi đã xảy ra trong chính đợt này: khối dựng `BoiCanhLenh` có
 * HAI bản (`holdem_api.ts` cho đường thật, `nhip_lenh_bot.ts` cho mọi bàn đo — bản
 * thứ hai được tạo ra ở D156 chính để chống chuyện này). Tôi nối ba cờ vào bản thứ
 * nhất, chạy gate 12.000×3, ra 12/12 — và số GIỐNG HỆT tới từng chữ số thập phân so
 * lần chạy trước khi nối. Đó là dấu hiệu duy nhất cho thấy bàn đo không đi qua bản
 * ấy: bot vẫn chấm mã bằng bảng v41 trong khi engine định giá bằng V42, tức gate đo
 * CHÊNH LỆCH HAI BẢNG chứ không đo kỹ năng — đúng lỗi `can_troi` v21↔v23 của D61.
 *
 * Nay hai nơi gọi CÙNG hàm này. Thêm một cờ v42 nữa thì sửa ĐÚNG ở đây.
 */
export function coV42ChoBot(st: TrangThaiTran): {
  tai_san_v42?: true; coupon_bp?: number; tien_mat_su_kien?: true; chu_ky_co_ngoi?: true;
} {
  return {
    ...(st.tai_san_v42 === true ? { tai_san_v42: true as const } : {}),
    ...(st.chu_ky_co_ngoi === true ? { chu_ky_co_ngoi: true as const } : {}),   // D560 — bot chấm mã bằng ĐÚNG bảng v64
    /*
     * D566 — bot chấm coupon bằng mức NHÌN THẤY. Dưới v66 `couponBpCua` (mức của lá quyết toán) là kết quả kỳ họp còn úp ⇒
     * phát nó cho bot là "úp với người mà không úp với bot" (lớp D433). Ở v53–v65 và mọi luật ngửa hai mức trùng nhau
     * (`laiSuatLuc` ≡ `laiSuatThayDuoc`) ⇒ replay byte-hệt.
     */
    ...(st.coupon_tpcp === true
      ? { coupon_bp: couponBp(laiSuatThayDuoc(st) ?? LAI_SUAT_NEN.KHOI_DIEM, st.duong_cong === true) } : {}),
    ...(st.tien_mat_su_kien === true ? { tien_mat_su_kien: true as const } : {}),
  };
}

/**
 * v42 (D311) — CÚ SỐC LÊN TIỀN MẶT TỰ DO của ô này.
 *
 * Founder 08/09: *"lạm phát phải trừ thẳng tiền mặt"*. Trước v42 thẻ lạm phát chỉ
 * đánh vào VỊ THẾ, nên bài học đọc ngược: ôm tiền mặt là cách né lạm phát.
 *
 * BA CHỖ CỐ Ý KHÁC máy giá, mỗi chỗ một lý do:
 *  · KHÔNG `apChuKyBienDo` và KHÔNG `apCang` — chu kỳ biên độ và sức căng là
 *    thuộc tính của SỔ LỆNH một mã. Tiền mặt không có sổ lệnh.
 *  · Dấu lấy từ `dao` của CHÍNH lực đó, y hệt giá: tin giả về lạm phát thì tiền
 *    mặt cũng ăn ngược, cả ở vòng lật lẫn ở dư âm. Một quy ước cho cả hai máy.
 *  · `trunc` từng lực rồi mới cộng (không cộng bp rồi mới cắt) — cùng thứ tự làm
 *    tròn với `machEcho`, để hai máy không lệch nhau một chip vì phép chia.
 *
 * Trả về số ĐÃ ĐỔI của `von` (âm = mất). Khoản này ĐỐT — lạm phát không vào túi ai.
 */
export function apSuKienTienMat(
  st: TrangThaiTran, g: GheNav, o: OThiTruong,
): { mat: number; chi_tiet: { su_kien: string; delta_bp: number; dao: boolean }[] } {
  const { bpTong, chi_tiet: chiTiet } = bpSuKienTienMat(st, o);
  const mat = doiTheoBp(g.von, bpTong);
  g.von += mat;
  return { mat, chi_tiet: chiTiet };
}

/**
 * Cú sốc tiền mặt của ô này DẠNG bp (âm = mất) + chi tiết từng lực — tách khỏi `apSuKienTienMat` ở D405 để sổ tiết
 * kiệm (`tietKiemLamPhat`) ăn ĐÚNG cú sốc ấy mà không có bản cài đặt thứ hai (D61). Thuần; chỉ phụ thuộc (trận, ô).
 */
export function bpSuKienTienMat(
  st: TrangThaiTran, o: OThiTruong,
): { bpTong: number; chi_tiet: { su_kien: string; delta_bp: number; dao: boolean }[] } {
  const chiTiet: { su_kien: string; delta_bp: number; dao: boolean }[] = [];
  let bpTong = 0;
  for (const luc of lucSuKienCua(st, o)) {
    const mt = TIEN_MAT_SU_KIEN.MT[luc.su_kien as SuKienId] ?? 0;
    if (mt === 0) continue;
    const d = Math.trunc(((luc.dao ? -1 : 1) * mt * luc.do_lon_bp) / 10000);
    if (d === 0) continue;
    bpTong += d;
    chiTiet.push({ su_kien: luc.su_kien, delta_bp: d, dao: luc.dao === true });
  }
  return { bpTong, chi_tiet: chiTiet };
}

/** Áp `bp` lên một khoản tiền: floor phần TUYỆT ĐỐI rồi mang dấu — một phép làm tròn cho tiền mặt và sổ (D405). */
export function doiTheoBp(soTien: number, bp: number): number {
  if (bp === 0 || soTien <= 0) return 0;
  const abs = Math.floor((soTien * Math.abs(bp)) / 10000);
  return bp < 0 ? -abs : abs;
}

/** Mắt xích mang phần GIÁ của một mã — phần Đòn Bẩy được nhân (D3; v46 dùng chung cho lãi vay). */
const MAT_XICH_GIA_THEO_MA: readonly MatXich['kind'][] = ['tai_san', 'echo', 'crowding', 'hoan_truot'];

/**
 * v46 (D338) — ĐÍCH CỦA ĐÒN BẨY ở vòng này: MỘT nguồn cho mắt xích `nhan` (`dungChuoi`) và
 * cho số tiền VAY chịu lãi (`chotPhien`). Gắn ⇒ mã gắn (+ đích phụ cấp 2, cùng điều kiện
 * với nhánh cũ); chưa gắn ⇒ mọi mã có mắt xích giá trong `chain` (thứ tự xuất hiện).
 * Rỗng khi ghế không cầm lá Đòn Bẩy.
 */
export function dichDonBayTheoMa(
  st: TrangThaiTran, g: Ghe, chain: readonly MatXich[],
): string[] {
  if (!g.danh_muc.chien_thuat.includes('don_bay') || st.loi_chi_trong_man === true) return [];   // D530 — lãi vay chỉ trong màn
  const maGan = g.danh_muc.gan?.don_bay;
  if (maGan) {
    const phu = st.vai_co_rang === true && capThe(g.danh_muc, 'don_bay') >= 2
      && g.danh_muc.gan_phu?.don_bay && g.danh_muc.gan_phu.don_bay !== maGan
      ? g.danh_muc.gan_phu.don_bay : undefined;
    return [maGan, ...(phu ? [phu] : [])];
  }
  const ra: string[] = [];
  for (const m of chain) {
    const id = (m as { id?: unknown }).id;
    /*
     * v49 (D342) — mã CHỈ đang khống cũng là một vị thế đang được nhân: dòng giá `khong_gia`
     * đưa nó vào đích (lãi vay ở `chotPhien` vốn đã cộng `vi_the_khong` từ D338).
     */
    const laGia = MAT_XICH_GIA_THEO_MA.includes(m.kind)
      || (m.kind === 'khong_gia' && st.khong_theo_gia === true);
    if (laGia && typeof id === 'string' && !ra.includes(id)) ra.push(id);
  }
  return ra;
}

/**
 * D561 — VÒNG `vong` CÓ TIN ĐÃ VÀO GIÁ không (khoá v65 `vaoGia`), và mã nào bị đảo. Chỉ ô TIN THẬT (`o`, ô tính tiền của vòng), chỉ vòng có màn;
 * MỘT cú rút mỗi vòng (`VAO_GIA.XAC_SUAT_BP`). Mã bị đảo = mã có hướng theo tin (điểm ma trận tin ≠ 0). Thuần — engine, màn, bảng điện tử
 * cùng gọi (một nguồn, D61).
 */
/** D561 — vòng `vong` có XÉT "đã vào giá" không (cờ bật · ô tin thật · vòng có màn) — màn đi nhánh dấu hiệu (kể cả dấu hiệu nhầm). */
export function vongXetVaoGia(st: Pick<TrangThaiTran, 'vao_gia' | 'map' | 'nhip_xen_ke'>, vong: number, o: OThiTruong | undefined): boolean {
  return st.vao_gia === true && !!o && o.kind === 'su_kien' && !o.la_tin_gia && coManMinigame(vong, st.map.o.length, st.nhip_xen_ke === true);
}

export function maVaoGia(st: Pick<TrangThaiTran, 'vao_gia' | 'seed' | 'map' | 'nhip_xen_ke' | 'lop_vn' | 'tai_san_v42' | 'chu_ky_co_ngoi'>, vong: number, o: OThiTruong | undefined): Set<string> {
  const ra = new Set<string>();
  if (st.vao_gia !== true || !o || o.kind !== 'su_kien' || o.la_tin_gia) return ra;
  if (!coManMinigame(vong, st.map.o.length, st.nhip_xen_ke === true)) return ra;
  if (!rngAt(st.seed, 'holdem_vao_gia', vong).chanceBp(VAO_GIA.XAC_SUAT_BP)) return ra;
  const mt = mtSuKien(boMaTranCua(st));
  for (const t of TAI_SAN) if ((mt[t.id]?.[o.su_kien] ?? 0) !== 0) ra.add(t.id);
  return ra;
}

export function dungChuoi(
  st: TrangThaiTran, g: Ghe, o: OThiTruong,
): { chain: MatXich[]; pnl_bp: number } {
  const chain: MatXich[] = [];
  // v55 (D409) — ràng buộc trait của ghế ở vòng này (một struct, một nguồn). TÊ LIỆT ⇒ lõi không phát huy: dây chuyền
  // đọc một danh mục KHÔNG có lá chiến thuật (lá vẫn nằm nguyên trên ghế thật — chỉ câm hai vòng).
  const rb = st.trait_bat === true ? rangBuocCua(st, g, st.vong) : RANG_BUOC_TRONG;
  // D530 — `loi_chi_trong_man`: lõi chỉ tác động trong màn ⇒ dây chuyền của VÒNG đọc danh mục không lá chiến thuật, đúng đường TÊ LIỆT.
  if (rb.teLiet || st.loi_chi_trong_man === true) g = { ...g, danh_muc: { ...g.danh_muc, chien_thuat: [], gan: {}, gan_phu: {} } };
  // v35 — cộng hưởng trú ẩn tính MỘT lần cho vòng, truyền vào MỌI lời machEcho.
  const chTruAn = coCongHuongTruAn(st, st.vong);
  let congDon = 0;

  // ── 1. TÀI SẢN × giai đoạn (+ nhiễu) × HỆ SỐ STACK ──────────────────────
  //
  // ⚠ Lặp qua Ô DUY NHẤT, không lặp qua mảng. Từ 20/07 tài sản stack được nên
  // mảng có bản sao; lặp thẳng mảng là cộng TUYẾN TÍNH (3 lá = ×3) — sai hẳn
  // luật founder chốt (×1 → ×1,6 → ×2,0, giảm dần). Nhiễu cũng phải rút MỘT
  // lần cho mỗi mã: rút lại theo từng bản sao là tự nhân phương sai lên.
  const giaiDoan = o.kind === 'giai_doan' ? o.giai_doan : 'di_ngang';
  const oTaiSan = [...new Set(g.danh_muc.tai_san)];
  /**
   * Giá một mã ở vòng này, phần GIAI ĐOẠN (+ nhiễu, chu kỳ, sức căng) ở cấp `cap`.
   *
   * v49 (D342) — tách thành hàm để sổ khống đọc ĐÚNG phép tính này ở cấp 1 (bước 2b), không
   * dựng bản thứ hai (D61). Thân hàm là nguyên văn khối bước 1 cũ — golden canh từng chip.
   */
  const giaGiaiDoan = (ts: TaiSan, cap: number, coBoiCanh = true) => {
    const tsId = ts.id;
    // D1 — GIÁ CỦA THANH KHOẢN: sổ mỏng được phần bù, sổ dày trả phí. Cộng vào
    // lợi suất NỀN (không vào nhiễu) nên nó là kỳ vọng, không phải may rủi.
    /*
     * v21 — CÂN TRÔI KỲ VỌNG: cộng vào LỢI SUẤT NỀN của mã, tức dời TÂM phân
     * phối mà không đụng một chút nào tới nhiễu/đuôi (founder 02/08 bác trần
     * biên độ — chuỗi may hiếm vẫn phải cho lãi khủng). Xem `CAN_TROI_BP`.
     */
    const nen = (mtGiaiDoan(boMaTranCua(st))[tsId]?.[giaiDoan] ?? 0) + lechTinhChat(st, o, tsId) + (coBoiCanh ? lechBoiCanh(st, o, tsId) : 0)
      + GIA_CUA_THANH_KHOAN_BP[ts.thanh_khoan]
      // MỘT NGUỒN chọn bảng — bot chấm điểm mã phải dùng ĐÚNG bảng này, nếu
      // không thì gate đo chênh lệch giữa hai bảng chứ không đo kỹ năng.
      + (bangCanTroi(st.can_troi === true, st.can_troi_2 === true)[tsId] ?? 0);
    const nhieu = nhieuCua(st, ts, o);
    const truocCang = applyBpInt(nen + nhieu, heSoStackBp(cap));
    // v13 — §5.2 tác dụng 1+3 trên mắt xích giá: lãi trên mã căng phồng thêm
    // (melt-up có thật), lỗ trên mã căng đau hơn hẳn (bất đối xứng §5.4).
    // D560 — chu kỳ có ngòi: sức căng KHÔNG phóng đại phần pha + nhiễu (chỉ tin xấu, có đèn — xem `sucCangLuc`).
    const sCangMa = st.chu_ky_co_ngoi === true ? 0 : sucCangLuc(st, tsId);
    const delta = apCang(apChuKyBienDo(st, truocCang), sCangMa);
    return { truocCang, sCangMa, delta };
  };
  /**
   * D574 — PHẦN NGHIÊNG BỐI CẢNH DÀI HẠN trong giá của mã ở cấp `cap` (bp, sau hệ số stack + biên độ chu kỳ — đúng phần nó góp vào mắt xích
   * `tai_san`). Tin ĐÃ VÀO GIÁ (2a/2b) chỉ đảo phần CÒN LẠI: xu hướng dài hạn không quay đầu vì một tin. 0 ở khoá khác ⇒ 2a/2b byte-hệt.
   */
  const phanBoiCanh = (ts: TaiSan, cap: number): number => (st.boi_canh_dai_han === true
    ? giaGiaiDoan(ts, cap).delta - giaGiaiDoan(ts, cap, false).delta : 0);
  for (const tsId of oTaiSan) {
    const ts = TAI_SAN.find((t) => t.id === tsId);
    if (!ts) continue;
    const cap = capThe(g.danh_muc, tsId);
    const { truocCang, sCangMa, delta } = giaGiaiDoan(ts, cap);
    congDon += delta;
    chain.push({
      kind: 'tai_san', id: tsId, delta_bp: delta, giai_doan: giaiDoan, cap,
      ...(delta !== truocCang
        ? { cang_bp: sCangMa, cang_dai: daiSucCang(sCangMa) } : {}),
    });
  }

  // ── 2. ECHO sự kiện (trí nhớ giá) ───────────────────────────────────────
  // Ô sự kiện tác động NGAY vòng nó nổ, cộng thêm echo các sự kiện trước.
  // ⚠ `dao: o.la_tin_gia` — KHÔNG phải `false`. Bản đầu cho tin giả tác động
  // giá THẬT ở chính vòng nó nổ, chỉ đảo từ vòng sau. Nghĩa là tin đồn được
  // THƯỞNG ngay, và Monte Carlo đo đúng điều đó: bot "tin mọi tin" xếp trên
  // bot "hoài nghi hiệu chỉnh" — ngược hẳn gate 17.6. §17.1c nói rõ tin giả
  // thì echo ĐẢO LẠI, không phải đảo trễ một vòng.
  /*
   * v36 R2 BẢN C (D172) — NỀN NHÂN VÀO LỰC TIN. Xem `TIN_THUAN_NEN_X_BP`:
   * bản CỘNG cũ đẻ một thành phần chung không phụ thuộc tin thật/giả và pha
   * loãng kỹ năng đọc tin (G4 đổ, hạ số không cứu). Nhân thì tin vẫn là toàn
   * bộ lực của vòng — nền chỉ quyết định nó ĐẬM hay NHẠT.
   */
  // ⚠ D311 — DANH SÁCH LỰC nay do `lucSuKienCua` dựng (một cửa: giá VÀ tiền mặt
  // phải đọc CÙNG một danh sách, không thì hai máy trôi khỏi nhau — D61).

  /*
   * D1 — CHỒNG CHẬP: F0 (tin đang nổ + echo tin cũ) CỘNG THÊM nhánh hệ quả
   * F1/F2 của từng nguồn. Không xoá echo cũ, không lấy max — cộng đại số, nên
   * hai tin ngược chiều tự triệt nhau đúng như thị trường thật.
   *
   * `nhanhHeQua` suy nhánh từ MT_SU_KIEN_KE_TIEP nên đây là luật SINH: thêm một
   * quan hệ nhân quả ở bảng đó là tự có F1/F2, không phải viết thêm domino.
   *
   * ⚠ v18 GỠ NHÁNH KHỎI GIÁ (founder 01/08): "hệ quả Bong bóng → Thiên nga
   * đen" trừ tiền cho một thẻ CHƯA LẬT — *"mấy cái kia đã xảy ra đâu mà
   * trừ??"*. Dây chuyền nay chỉ còn sống ở `sinhMap` (nghiêng Ô KẾ TIẾP về hệ
   * quả) — ai đọc được thì xoay danh mục TRƯỚC khi thẻ lật, tiền không chạy
   * trước sự kiện nữa. Trận ≤ v17 giữ nhánh để replay nguyên.
   */
  const nguon = lucSuKienCua(st, o);
  for (const x of machEcho(nguon, oTaiSan, g.danh_muc, (id) => sucCangLuc(st, id), (d) => apChuKyBienDo(st, d), chTruAn, boMaTranCua(st))) {
    congDon += x.delta_bp;
    chain.push(x);
  }

  // ── 2a. D561 — TIN ĐÃ VÀO GIÁ (khoá v65): phần giá của mã có hướng theo tin thành −DAO × phần ấy. Một mắt xích riêng ⇒ bảng công khai,
  // NAV và VÌ SAO đọc cùng một số; sổ khống (2b) đảo theo đúng tỷ lệ ấy.
  const vaoGia = maVaoGia(st, st.vong, o);
  for (const tsId of oTaiSan) {
    if (!vaoGia.has(tsId)) continue;
    const ts = TAI_SAN.find((t) => t.id === tsId);
    const goc = chain.reduce((t, m) => ((m.kind === 'tai_san' || m.kind === 'echo') && (m as { id?: string }).id === tsId ? t + m.delta_bp : t), 0)
      - (ts ? phanBoiCanh(ts, capThe(g.danh_muc, tsId)) : 0);   // D574 — không đảo phần nghiêng bối cảnh
    if (goc === 0) continue;
    const d = -Math.trunc((goc * (10000 + VAO_GIA.DAO_BP)) / 10000);
    congDon += d;
    chain.push({ kind: 'vao_gia', id: tsId, goc_bp: goc, delta_bp: d });
  }

  /*
   * ── 2b. v49 (D342) — SỔ KHỐNG ĂN NGƯỢC ĐÚNG GIÁ CHỢ ──────────────────────────────────
   *
   * ⚠⚠ LỖI ĐƯỢC SỬA, có từ v17 (01/08): hai bước trên chỉ dựng giá cho mã trong
   * `danh_muc.tai_san` — gương của SỔ DÀI. Khống một mã mình không cầm dài ⇒ không mắt xích
   * nào mang mã ấy ⇒ `apDinhGia` đọc 0bp ⇒ ký quỹ đứng im trong khi giá sập. Trận founder
   * 16/09: btc −92,98% (Sập sàn) mà khống btc chỉ +490, toàn bộ từ hiệu ứng thẻ. Bot không
   * bao giờ khống nên gate không thấy; bài test cũ chỉ kiểm "NAV > 0".
   *
   * Giá chợ = đúng phần `tai_san` + `echo` của mã ở CẤP 1, không một mắt xích riêng-ghế nào
   * — tức ĐÚNG con số bảng lợi suất công khai (`loiSuatCongKhai`) in cho mã ấy. Founder chốt
   * 16/09 "ngược đúng giá chợ", kể cả phần sức căng (doc 05 từng định bỏ vế có lợi của sức
   * căng cho khống — founder chọn như ngoài đời).
   * ⚠ Không vào `congDon`: sàn Chặn Lỗ là sàn của phần LÕI sổ dài, sổ khống là vị thế độc lập
   * (D37). Vào `pnl` ở bước 5 để "tổng chuỗi = PnL" vẫn đúng.
   */
  let giaKhongTong = 0;
  if (st.khong_theo_gia === true) {
    for (const tsId of Object.keys(g.vi_the_khong ?? {})) {
      if ((g.vi_the_khong![tsId] ?? 0) <= 0) continue;
      const ts = TAI_SAN.find((t) => t.id === tsId);
      if (!ts) continue;
      const dmMot: DanhMuc = { tai_san: [tsId], chien_thuat: [] };
      const giaGoc = giaGiaiDoan(ts, 1).delta
        + machEcho(nguon, [tsId], dmMot, (id) => sucCangLuc(st, id), (d) => apChuKyBienDo(st, d), chTruAn, boMaTranCua(st))
          .reduce((t, x) => t + x.delta_bp, 0);
      // D561 — tin đã vào giá: sổ khống ăn ngược GIÁ ĐÃ ĐẢO (cùng tỷ lệ với sổ dài). D574 — phần nghiêng bối cảnh không đảo (như 2a).
      const bcKhong = vaoGia.has(tsId) ? phanBoiCanh(ts, 1) : 0;
      const gia = vaoGia.has(tsId) ? bcKhong - Math.trunc(((giaGoc - bcKhong) * VAO_GIA.DAO_BP) / 10000) : giaGoc;
      if (gia === 0) continue;
      giaKhongTong -= gia;
      chain.push({ kind: 'khong_gia', id: tsId, gia_bp: gia, delta_bp: -gia });
    }
  }

  // ── 3. TRƯỢT GIÁ do đông (crowding) ─────────────────────────────────────
  // Đây là thứ làm "3 lá tài sản chung cả bàn" thành căng thẳng thật: dồn vào
  // lá thanh khoản MỎNG thì ăn đậm nhưng giành fill và trượt giá thảm.
  // ⚠ `khop_nhanh` KHÔNG còn ở nhánh nhân. Nó từng nhân dồn với `chia_lenh`
  // (40% × 50% = cắt 80% trượt giá) — combo mạnh nhất bàn mà không ai chọn có
  // ý thức. Nay nó HOÀN một phần khoản phạt đã tính (T4, xem dưới).
  /*
   * D3 — THẺ CHỈ TÁC ĐỘNG LÊN MÃ NÓ GẮN.
   *
   * `khop_nhanh` và `chia_lenh` đều là thẻ giảm trượt giá, mà trượt giá vốn tính
   * THEO TỪNG MÃ — nên chúng là hai thẻ mà attachment có nghĩa rõ nhất: khiên đặt
   * ở đâu thì che ở đó, không phải một cái ô che cả danh mục.
   *
   * ⚠ Chưa gắn (trận cũ, hoặc người chơi chưa chọn) ⇒ áp cho MỌI mã, đúng hành vi
   * trước D3. `events` append-only nên trận cũ phải ra đúng kết quả nó từng có.
   */
  const luatVon = luatVonBat(st);
  const khoaVon = luatVon ? khoaDangChay(g, st.vong) : null;
  const songSotBan = st.ghe.filter((x) => conTrongTran(x)).length;

  const ganThe = g.danh_muc.gan;
  const theAnVaoMa = (the: ChienThuatId, ma: string): boolean => {
    if (!g.danh_muc.chien_thuat.includes(the)) return false;
    const gan = ganThe?.[the];
    return !gan || gan === ma;
  };
  for (const tsId of oTaiSan) {
    const ts = TAI_SAN.find((t) => t.id === tsId);
    if (!ts) continue;
    const dong = demNguoiNam(st.ghe, tsId);
    if (dong <= 1) continue;
    // D1 — THANH KHOẢN ĐỘNG: sổ lệnh mỏng đi trong khủng hoảng, dày lên khi
    // risk-on. Đây là chỗ nó có RĂNG: dồn cả bàn vào một mã đắt hơn hẳn đúng
    // lúc đám đông hay dồn nhất.
    const L = doSauHieuDung(ts, o, laiSuatLuc(st), st.thanh_khoan_nam_nac === true);
    /*
     * D3 — ÁP LỰC ĐÁM ĐÔNG ĐO BẰNG TỶ LỆ LOBBY.
     *
     * Trước đây: `phat ∝ (dong − 1)`, tức đếm ĐẦU NGƯỜI. Bàn 8 ghế phạt gấp hơn
     * hai lần bàn 4 ghế cho cùng một hành vi dồn mã, nên mở bàn 4–8 (yêu cầu D3)
     * là vô tình phát hành bốn game có cân bằng khác nhau.
     * Nay chuẩn hoá theo `songSot`, và `DONG_QUY_CHIEU` giữ nguyên độ lớn ở bàn
     * 5 ghế — đổi ĐƠN VỊ ĐO, không đổi độ mạnh (test khoá bằng số).
     */
    const songSot = st.ghe.filter((x) => conTrongTran(x)).length;
    const tyLe = tyLeDongBp(dong, songSot);
    let phat = idiv(HE_SO_TAC_DONG_K * DONG_QUY_CHIEU * tyLe, L);
    // Chia Lệnh giảm tác động giá của CHÍNH MÌNH → vẫn ở nhánh nhân, đúng bản
    // chất: nó không phụ thuộc người khác đông hay vắng.
    if (theAnVaoMa('chia_lenh', tsId)) {
      phat = applyBpInt(phat, GIAM_TRUOT_GIA_BP.chia_lenh);
    }
    // v34 — VAI: cá mập/đội lái chen chúc nặng gấp đôi, cá nhân nửa. Cùng nhánh
    // nhân với Chia Lệnh (riêng ghế, không phụ thuộc bàn). Không vai ⇒ ×1.
    const hsVai = heSoTacDongGia(st, g);
    if (hsVai !== 1) phat = Math.floor(phat * hsVai);
    // v55 (D422) — LỘ LỆNH: lệnh khớp sau cả bàn ⇒ chen chúc của RIÊNG ghế nặng thêm (D67: không đụng giá chợ).
    if (rb.loLenh) phat = Math.floor((phat * THAM_SO.LO_LENH_CHEN_X_BP) / 10000);
    if (phat === 0) continue;
    congDon -= phat;
    chain.push({ kind: 'crowding', id: tsId, delta_bp: -phat, so_nguoi_dong: dong });

    /*
     * LÕI VỐN B — KHOÁ giảm nửa trượt giá ở đúng mã đang khoá.
     *
     * HOÀN LẠI một dòng riêng thay vì nhân nhỏ `phat` tại chỗ (như `chia_lenh`),
     * vì hai thứ khác hẳn nhau ở chỗ người chơi đọc: `chia_lenh` là thuộc tính
     * thường trực của một lá bài, còn đây là PHẦN THƯỞNG của một lời hứa vừa đưa
     * ra — không cho thấy con số thì lời hứa không có bằng chứng đã được trả.
     * Cùng khuôn với `hoan_truot` của T4 nên bất biến "tổng mắt xích = PnL" giữ
     * nguyên và chỉ floor một lần.
     */
    if (khoaVon?.ma === tsId) {
      const hoan = phat - applyBpInt(phat, KHOA_TAI_SAN.TRUOT_GIA_CON_BP);
      if (hoan > 0) {
        congDon += hoan;
        chain.push({ kind: 'khoa_giam_truot', id: tsId, delta_bp: hoan });
      }
    }

    // T4 — Khớp Nhanh vào lệnh trước đám đông: hoàn lại % khoản phạt VỪA chịu.
    // Neo vào chính khoản phạt nên không bao giờ hoàn quá phạt, ở mọi hạng
    // thanh khoản — răng của cơ chế thanh khoản giữ nguyên.
    if (theAnVaoMa('khop_nhanh', tsId)) {
      // Bảng tra vẫn đánh chỉ số theo ĐẦU NGƯỜI, nên quy tỷ lệ về số người
      // tương đương ở bàn quy chiếu — bàn 5 ghế cho lại đúng `dong`.
      const dongTra = dongQuyDoi(dong, songSot);
      const hoanBp = KHOP_NHANH_HOAN_BP[Math.min(dongTra, KHOP_NHANH_HOAN_BP.length - 1)] ?? 0;
      const hoan = applyBpInt(phat, hoanBp);
      if (hoan > 0) {
        congDon += hoan;
        chain.push({
          kind: 'hoan_truot', id: tsId, so_nguoi_dong: dong, delta_bp: hoan,
        });
      }
    }
  }

  /*
   * ── 3b. LÕI VỐN A — XẾP HÀNG KHỚP LỆNH + PHÍ CHUYỂN ĐỔI ───────────────────
   *
   * Lớp thứ HAI của trượt giá, và nó đo thứ khác hẳn lớp trên:
   *   · crowding (bước 3) = ÁP LỰC TỒN KHO — bao nhiêu người đang ôm mã này;
   *   · hàng chờ (bước này) = ÁP LỰC LỆNH — bao nhiêu tiền đổ vào mã này HÔM NAY.
   *
   * Không có lớp thứ hai thì đảo danh mục là cửa thoát crowding miễn phí: thấy
   * mã mình đang ôm bị cả bàn dồn vào thì bấm đảo, và người đảo lập tức biến mất
   * khỏi phép đếm tồn kho của mã cũ mà chẳng chạm gì ở mã mới. Founder nói thẳng
   * điều đó khi giao việc, và nó đúng: cả lớp trượt giá sẽ mất tác dụng.
   *
   * Đếm CẢ người mua thẳng chứ không riêng người đảo — nếu không thì "xếp hàng
   * cùng những người mua mới" là câu nói suông, và mua thẳng lại rẻ hơn đảo ở
   * đúng cùng một lệnh mua vào cùng một mã.
   */
  /*
   * D33 — ĐẶC QUYỀN KHỚP NHANH mở rộng sang HAI khoản trượt giá nữa.
   *
   * Mô tả thẻ hứa "chịu ít trượt giá hơn người khác khi chen chúc / bỏ bài /
   * thoát hàng / ĐẢO DANH MỤC". Trước D33 nó chỉ chạm ĐÚNG một khoản (chen chúc,
   * T4) — ba vế còn lại của chính lời hứa đó là lời suông. Đây là hai vế nằm
   * trong dây chuyền chấm điểm; vế thứ ba (phí RÚT KHẨN của cắt lỗ) trừ thẳng
   * Vốn nên nằm ở `chotPhien`.
   *
   * HOÀN thành một dòng riêng thay vì nhân nhỏ tại chỗ, cùng khuôn `hoan_truot`
   * và `khoa_giam_truot`: đặc quyền phải có BẰNG CHỨNG đã được trả, nếu không
   * người chơi không có cách nào biết lá bài của mình có chạy hay không.
   */
  const nhanhVon = coDacQuyen(st, g, 'khop_nhanh');
  const hoanNhanh = (
    lyDo: 'xep_hang' | 'dao_phi', phat: number, conBp: number,
    /** v49 (D342) — mã của khoản phạt được hoàn; chỉ ghi khi cổng `xep_hang_theo_ma` bật. */
    ma?: string,
  ): void => {
    const hoan = phat - applyBpInt(phat, conBp);
    if (hoan <= 0) return;
    congDon += hoan;
    chain.push({
      kind: 'dac_quyen', id: 'khop_nhanh', ly_do: lyDo, delta_bp: hoan,
      ...(ma !== undefined ? { ma } : {}),
    });
  };

  if (luatVon) {
    const demVao = demVaoMoi(st);
    for (const tsId of vaoMoiCua(st, g)) {
      const ts = TAI_SAN.find((t) => t.id === tsId);
      if (!ts) continue;
      // LÕI VỐN B — ƯU TIÊN KHỚP LỆNH: người đã cam kết khoá đứng đầu hàng nên
      // không phải chờ. Người lướt sóng vẫn đếm ĐỦ số người vào (kể cả người
      // khoá) — đứng sau thì phải chờ cả phần của người đứng trước.
      if (khoaVon?.ma === tsId) continue;
      const soVao = demVao[tsId] ?? 0;
      if (soVao < DAO_DANH_MUC.NGUONG_XEP_HANG) continue;
      const phat = idiv(
        DAO_DANH_MUC.HE_SO_XEP_HANG_K * DONG_QUY_CHIEU
          * tyLeDongBp(soVao, songSotBan),
        doSauHieuDung(ts, o, laiSuatLuc(st), st.thanh_khoan_nam_nac === true),
      );
      if (phat <= 0) continue;
      congDon -= phat;
      chain.push({ kind: 'xep_hang', id: tsId, so_vao: soVao, delta_bp: -phat });
      if (nhanhVon) {
        // v49 (D342) — phần hoàn đi CÙNG mã với khoản phạt (một tầng, không tách đôi).
        hoanNhanh('xep_hang', phat, DAC_QUYEN.KHOP_NHANH.XEP_HANG_CON_BP,
          st.xep_hang_theo_ma === true ? tsId : undefined);
      }
    }

    // Phí giao dịch của vế "bán A" — cố định, không phụ thuộc ai khác.
    if (g.dao?.vong === st.vong) {
      congDon -= DAO_DANH_MUC.PHI_CHUYEN_DOI_BP;
      chain.push({
        kind: 'dao_phi', tu: g.dao.tu, den: g.dao.den,
        delta_bp: -DAO_DANH_MUC.PHI_CHUYEN_DOI_BP,
      });
      if (nhanhVon) {
        hoanNhanh('dao_phi', DAO_DANH_MUC.PHI_CHUYEN_DOI_BP,
          DAC_QUYEN.KHOP_NHANH.DAO_PHI_CON_BP);
      }
    }
  }

  /*
   * ── 4. XUNG ĐỘT / CỘNG HƯỞNG giữa thẻ ─────────────────────────────────────
   *
   * D3 — STRATEGY ATTACHMENT: mức đầy đủ khi HAI THẺ GẮN CÙNG MỘT MÃ, còn 45% khi
   * gắn khác mã. Docstring của `XUNG_DOT` vốn đã viết "hai thẻ… trên CÙNG TÀI SẢN"
   * từ đầu — thiết kế luôn là attachment, chỉ là cài đặt cũ chưa có chỗ để biết
   * thẻ nhắm vào đâu nên đành kiểm danh sách phẳng.
   *
   * ⚠ KHÔNG cho gắn khác mã thoát hẳn (hệ số 0): làm thế thì tránh xung đột chỉ
   * tốn một cú bấm, và cơ chế dạy-bằng-nỗi-đau của D24 mục 16.5 biến mất. Xem
   * docstring `KHAC_MA_BP`.
   */
  const gan = g.danh_muc.gan;
  /** Hệ số cặp: cùng mã ⇒ đủ; khác mã ⇒ KHAC_MA_BP; chưa gắn (trận cũ) ⇒ đủ. */
  const heSoCap = (a: ChienThuatId, b: ChienThuatId): number => {
    const ma = gan?.[a]; const mb = gan?.[b];
    if (!ma || !mb) return 10000;   // trận cũ chưa có bảng gắn → giữ hành vi cũ
    return ma === mb ? 10000 : KHAC_MA_BP;
  };

  /*
   * v19 — BẢNG XUNG ĐỘT THEO LUẬT TRẬN (founder 02/08): Lướt Sóng/Bán Khống
   * nay là đặc quyền chức năng nên các cặp dính chúng hết nghĩa — xem
   * docstring `XUNG_DOT_V19`. Trận ≤ v18 giữ bảng cũ, phạt đã tính là tiền
   * thật của lịch sử.
   */
  const bangXungDot = st.xung_dot_gon === true ? XUNG_DOT_V19 : XUNG_DOT;
  for (const cap of bangXungDot) {
    if (g.danh_muc.chien_thuat.includes(cap[0]) && g.danh_muc.chien_thuat.includes(cap[1])) {
      const d = applyBpInt(PHAT_XUNG_DOT_BP, heSoCap(cap[0], cap[1]));
      if (d === 0) continue;
      congDon -= d;
      chain.push({ kind: 'xung_dot', cap, delta_bp: -d });
    }
  }
  // v20 — bảng cộng hưởng theo luật trận (founder "Gỡ" 02/08): hai cặp dính
  // lá chức năng chết, hai cặp phòng-thủ-có-phí sống. Xem `CONG_HUONG_V20`.
  const bangCongHuong = st.cong_huong_gon === true ? CONG_HUONG_V20 : CONG_HUONG;
  for (const cap of bangCongHuong) {
    if (!g.danh_muc.chien_thuat.includes(cap[0])
      || !g.danh_muc.chien_thuat.includes(cap[1])) continue;

    // T5 — CHẶN LỖ + PHÒNG HỘ là BẢO HIỂM CÓ PHÍ, không phải thưởng phẳng.
    // Ăn trong Giảm/Biến động (lúc thật sự cần phanh), MẤT phí trong Tăng/Đi
    // ngang (bảo hiểm không dùng đến). Lever D20 "phòng thủ phải CÓ GIÁ" áp lên
    // tầng chiến thuật — cộng hưởng hằng số là bảo hiểm miễn phí, và ma trận
    // tài sản đã dính đúng bệnh đó một lần.
    const laBaoHiem = (cap[0] === 'chan_lo' && cap[1] === 'phong_ho')
      || (cap[0] === 'phong_ho' && cap[1] === 'chan_lo');

    /*
     * D1 — CẶP ĐA DẠNG HÓA + CHẶN LỖ: hết được thưởng phẳng.
     *
     * Đây là món nợ ghi 21/07 — cặp này ăn 120bp vô điều kiện, tức phòng thủ
     * MIỄN PHÍ, cùng bệnh mà D20 đã chẩn ở tầng tài sản. Nay có phí, và phí có
     * răng: trong uptrend nó còn TRIỆT NỬA BIÊN TĂNG của tài sản đang giữ (xem
     * dưới) → ép xé cặp, đúng lựa chọn founder muốn tạo ra.
     */
    const laKep = (cap[0] === PHI_CO_HOI_KEP.CAP[0] && cap[1] === PHI_CO_HOI_KEP.CAP[1])
      || (cap[0] === PHI_CO_HOI_KEP.CAP[1] && cap[1] === PHI_CO_HOI_KEP.CAP[0]);

    let thuong: number;
    if (laBaoHiem) {
      thuong = BAO_HIEM_CO_PHI.GIAI_DOAN_AN.includes(giaiDoan)
        ? BAO_HIEM_CO_PHI.AN_BP : BAO_HIEM_CO_PHI.PHI_BP;
    } else if (laKep) {
      thuong = PHI_CO_HOI_KEP.AN_KHI.includes(giaiDoan)
        ? PHI_CO_HOI_KEP.AN_BP : PHI_CO_HOI_KEP.PHI_BP;
    } else {
      thuong = THUONG_CONG_HUONG_BP;
    }

    /*
     * D3 — cộng hưởng cũng theo attachment: ăn ĐỦ khi hai thẻ gắn cùng một mã.
     *
     * Đối xứng với xung đột, và đó là chỗ attachment trở thành QUYẾT ĐỊNH chứ
     * không phải ô phải điền: muốn ăn đủ cộng hưởng thì phải chủ động dồn cặp lên
     * cùng một mã — mà dồn cặp lên một mã lại làm xung đột (nếu có) cũng đủ 100%.
     *
     * ⚠ Áp cho CẢ phần ăn lẫn phần phí (`thuong` có thể âm với bảo hiểm/kép). Chỉ
     * giảm phần ăn mà giữ nguyên phần phí là biến gắn-khác-mã thành nước đi luôn
     * tệ, tức lại xoá mất lựa chọn.
     */
    thuong = applyBpInt(thuong, heSoCap(cap[0], cap[1]));
    if (thuong === 0) continue;

    congDon += thuong;
    chain.push({ kind: 'cong_huong', cap, delta_bp: thuong });

    /*
     * TRIỆT BIÊN TĂNG — phần răng thật của luật này.
     *
     * Tính trên TỔNG các mắt xích tài sản DƯƠNG đã cộng ở bước 1, rồi trừ lại
     * một phần thành MỘT mắt xích riêng. Làm cách này thay vì sửa từng delta ở
     * bước 1 vì hai lẽ: (a) `chain` là bảng "vì sao" người chơi đọc — một dòng
     * "cặp phòng thủ triệt nửa biên tăng" nói rõ hơn là mấy con số tài sản âm
     * thầm nhỏ đi; (b) trừ một lần thì chỉ floor một lần, giữ C5 sạch.
     */
    const trongUptrend = PHI_CO_HOI_KEP.PHI_KHI.includes(giaiDoan)
      || (o.kind === 'su_kien' && !o.la_tin_gia
        && PHI_CO_HOI_KEP.PHI_KHI_SU_KIEN.includes(o.su_kien as never));
    if (laKep && trongUptrend) {
      const bienTang = chain
        .filter((m) => m.kind === 'tai_san' && m.delta_bp > 0)
        .reduce((x, m) => x + m.delta_bp, 0);
      const conLai = applyBpInt(bienTang, PHI_CO_HOI_KEP.TRIET_BIEN_TANG_BP);
      const triet = bienTang - conLai;
      if (triet > 0) {
        congDon -= triet;
        chain.push({ kind: 'triet_bien_tang', cap, delta_bp: -triet });
      }
    }
  }

  // ── 4b. T1 — CHIẾN THUẬT × SỰ KIỆN ──────────────────────────────────────
  // Điều kiện theo SỰ KIỆN, không theo GIÁ → không đụng D22.
  if (o.kind === 'su_kien') {
    for (const ct of new Set(g.danh_muc.chien_thuat)) {
      /*
       * v49 (D342) — LÁ BÁN KHỐNG THUẦN QUYỀN MỞ KHỐNG. Hàng T1 của nó (Sập sàn +15%, Hạ lãi
       * suất −15%, Bong bóng −27%…) có từ thời lá bài CHƯA có sổ khống thật, và nó áp lên
       * CẢ danh mục — tức cả vị thế DÀI (trận founder 16/09 vòng 12: −15% vào btc đang cầm
       * dài). Từ khi sổ khống ăn đúng giá (bước 2b), giữ hàng này là đếm hai lần. Founder
       * chốt gỡ 16/09.
       */
      if (ct === 'ban_khong' && st.ban_khong_thuan_quyen === true) continue;
      const d = MT_CHIEN_THUAT_SU_KIEN[ct]?.[o.su_kien];
      if (!d) continue;
      congDon += d;
      chain.push({ kind: 'ct_su_kien', id: ct, su_kien: o.su_kien, delta_bp: d });
    }
  }

  // ── 4b2. T8 — THẺ CANH NHỊP: bắt trúng thì ăn, bắt trượt thì trả nhiều hơn.
  //
  // Ba thẻ này (bat_day, mua_duoi, da_dang_hoa) trước 21/07 KHÔNG có cơ chế
  // nào — chúng là tên gọi không có hành vi, và chính ô-chết-không-mất-phí đó
  // làm bot "Bắt đáy" trông như có alpha giả suốt nhiều vòng đo.
  //
  // Kỳ vọng của hai thẻ canh nhịp CỐ Ý ≤ 0 (trượt phạt nặng hơn trúng thưởng):
  // D22 ghi rõ "động cơ giá timing vô dụng là ĐÚNG, không phải lỗi" — người
  // chơi vẫn đuổi giá dù vô ích, và chính sự bốc đồng đó mới là dữ liệu đáng
  // bán. Chúng chỉ được có PHƯƠNG SAI, không được có lợi thế.
  {
    const gdTruoc = st.map.o[st.vong - 2];
    const gdTruocId = gdTruoc?.kind === 'giai_doan' ? gdTruoc.giai_doan : null;
    for (const id of ['bat_day', 'mua_duoi'] as const) {
      if (!g.danh_muc.chien_thuat.includes(id)) continue;
      const luat = THE_CANH_NHIP[id];
      if (gdTruocId !== luat.sau_giai_doan) continue;
      const trung = luat.trung_khi.includes(giaiDoan);
      const d = trung ? luat.trung_bp : luat.truot_bp;
      congDon += d;
      chain.push({ kind: 'canh_nhip', id, trung, delta_bp: d });
    }

    // Thẻ phòng thủ đứng MỘT MÌNH cũng phải có hành vi — trước đó cả hai chỉ
    // tồn tại trong cặp cộng hưởng, tức là hai ô chết nữa. Test "Ô chết" tìm ra.
    for (const id of ['chan_lo', 'phong_ho'] as const) {
      if (!g.danh_muc.chien_thuat.includes(id)) continue;
      const l = THE_PHONG_THU[id];
      const an = l.an_khi.includes(giaiDoan);
      const phi = l.phi_khi.includes(giaiDoan);
      if (!an && !phi) continue;
      let d = an ? l.an_bp : l.phi_bp;

      /*
       * D5 — RỦI RO ĐỐI TÁC: cả bàn cùng núp một thẻ thì phần che teo lại.
       *
       * Khắc chế đúng thứ đang trội: sau D4 phe phòng thủ dẫn 28,4% (cách á quân
       * 4,2). Thay vì hạ số của thẻ phòng thủ cho mọi người mọi lúc — cách vặn số
       * quen tay, và người chơi chẳng làm gì được với nó — sức mạnh thẻ nay PHỤ
       * THUỘC bao nhiêu người khác cũng đang núp sau nó. Cả làng cùng mua bảo hiểm
       * thì lúc cháy nhà không ai trả nổi.
       *
       * ⚠ CHỈ TEO PHẦN ĂN, KHÔNG TĂNG PHẦN PHÍ: đánh cả hai đầu là biến thẻ phòng
       * thủ thành bẫy và dạy người chơi "đừng bao giờ phòng hộ" — đúng thứ D22 cấm.
       */
      if (an && RUI_RO_DOI_TAC.BAT) {
        const songSotCT = st.ghe.filter((x) => conTrongTran(x)).length;
        const tyLe = tyLeBp(demTheoChienThuat(st.ghe)[id] ?? 0, songSotCT);
        if (tyLe >= RUI_RO_DOI_TAC.NGUONG_BP) {
          const teo = applyBpInt(d, RUI_RO_DOI_TAC.AN_CON_BP);
          const mat = d - teo;
          if (mat !== 0) {
            /*
             * ⭐⭐ v48 (D340) — TRỪ ĐÚNG MỘT LẦN.
             *
             * Bản dưới (≤ v47) vừa teo `d` xuống `teo` VỪA đẩy `−mat` vào chuỗi. `congDon`
             * chỉ cộng `teo` nên PnL tường thuật đúng, nhưng `chotPhien` chia hai tầng bằng
             * cách cộng theo CHUỖI ⇒ TIỀN áp `teo − mat`; với `AN_CON_BP = 5000` thì
             * `teo = mat` ⇒ áp đúng 0. Cả bàn cùng núp thì thẻ phòng thủ mất SẠCH phần che —
             * đúng cái bẫy mà chú thích ngay trên tự cấm ("CHỈ TEO PHẦN ĂN… D22 cấm").
             *
             * Nay `phong_thu` giữ phần ăn ĐẦY ĐỦ và `doi_tac` là dòng TRỪ thật, nên tổng
             * chuỗi = `teo` = đúng số `congDon` cộng. Chọn lối này thay vì "đánh dấu
             * `doi_tac` là mắt xích chỉ-để-đọc": lối kia bắt `chotPhien` giữ thêm một danh
             * sách loại trừ — bản sao thứ hai của luật xếp tầng, tức đúng thứ D61 cấm và
             * đúng cái đã đẻ ra cả ba ca lỗi này.
             */
            if (st.doi_tac_tru_mot_lan === true) congDon -= mat; else d = teo;
            chain.push({ kind: 'doi_tac', id, ty_le_bp: tyLe, delta_bp: -mat });
          }
        }
      }

      congDon += d;
      chain.push({ kind: 'phong_thu', id, an, delta_bp: d });
    }

    /*
     * D5 — THẺ ĐI NGƯỢC: thưởng vị thế lệch đám, phạt vị thế theo đám.
     *
     * Khắc chế MỌI meta đang thắng, không riêng phe nào: bất cứ chiến lược nào trội
     * lên thì nhiều người copy, mà càng nhiều người copy thì thẻ này càng đáng cầm.
     * Đó là cơ chế TỰ CÂN BẰNG bằng lựa chọn của người chơi, thay vì bằng tôi vặn
     * số mỗi mùa — và nó biến thông tin "cả bàn đang dồn" thành thứ chơi được.
     *
     * Có TRẦN hai chiều: không trần thì cầm 4 mã hiếm là cộng dồn bốn lần, thành thẻ
     * mạnh nhất bàn mà không ai chọn có ý thức — đúng lỗi `khop_nhanh` từng mắc.
     */
    if (g.danh_muc.chien_thuat.includes('di_nguoc')) {
      const songSotDN = st.ghe.filter((x) => conTrongTran(x)).length;
      const dem = demTheoMa(st.ghe);
      let soLech = 0; let soTheo = 0; let tho = 0;
      for (const ma of new Set(g.danh_muc.tai_san)) {
        const tyLe = tyLeBp(dem[ma] ?? 0, songSotDN);
        if (tyLe <= DI_NGUOC.NGUONG_LECH_BP) { soLech += 1; tho += DI_NGUOC.THUONG_BP; }
        else if (tyLe >= DI_NGUOC.NGUONG_THEO_BP) { soTheo += 1; tho += DI_NGUOC.PHAT_BP; }
      }
      const d = Math.max(-DI_NGUOC.TRAN_BP, Math.min(DI_NGUOC.TRAN_BP, tho));
      if (d !== 0) {
        congDon += d;
        chain.push({ kind: 'di_nguoc', so_lech: soLech, so_theo: soTheo, delta_bp: d });
      }
    }

    // Đa dạng hoá: thưởng theo SỐ MÃ KHÁC NHAU, trừ phí cố định. KHÔNG nén
    // phương sai — trong hệ chia quỹ theo HẠNG, nén phương sai làm ngồi im
    // thành tối ưu và vỡ gate G3.
    if (g.danh_muc.chien_thuat.includes('da_dang_hoa')) {
      const dd = daDangCua(st);
      const d = dd.PHI_BP + oTaiSan.length * dd.MOI_MA_BP;
      congDon += d;
      chain.push({ kind: 'da_dang', so_ma: oTaiSan.length, delta_bp: d });
    }
  }

  // ── 4c. T2 — LƯỚT SÓNG × DÂY CHUYỀN ─────────────────────────────────────
  // Bám đúng dòng chảy nhân quả thì ăn, bám nhầm thì trả giá.
  // KHÔNG rò thông tin ẩn: hai ô sự kiện không bao giờ liền nhau, nên tin giả
  // của ô nguồn ĐÃ lộ trước khi mắt xích này chạy.
  if (o.kind === 'su_kien' && g.danh_muc.chien_thuat.includes('luot_song')) {
    const nguon = [...st.map.o.slice(0, st.vong - 1)].reverse()
      .find((x) => x.kind === 'su_kien' && !x.la_tin_gia);
    if (nguon && nguon.kind === 'su_kien') {
      // v35: đọc qua MỘT CỬA mtKeTiep — cạnh mở rộng chỉ tính "đúng chuỗi"
      // khi map được sinh bằng chính cạnh đó (cờ tắt ⇒ y hệt bảng nền cũ).
      const dung = (mtKeTiep(st.chuoi_mo_rong === true)[nguon.su_kien]?.[o.su_kien] ?? 0) > 0;
      const d = dung ? LUOT_SONG_DAY_CHUYEN.DUNG_BP : LUOT_SONG_DAY_CHUYEN.GAY_BP;
      congDon += d;
      chain.push({
        kind: 'day_chuyen', tu: nguon.su_kien, den: o.su_kien, dung, delta_bp: d,
      });
    }
  }

  /*
   * ── 4d. LÕI VỐN B — NGHIỆM THU LỜI HỨA ────────────────────────────────────
   *
   * Đứng CUỐI khối cộng, ngay trước Đòn Bẩy, vì đây là phán quyết về cả vòng chứ
   * không phải một nguồn lãi/lỗ riêng lẻ. Và nó nằm TRONG khối cộng — tức đòn
   * bẩy nhân cả phần phạt — đúng bản chất: cam kết dài hạn mà còn cầm đòn bẩy
   * thì lúc gãy kèo cũng gãy gấp đôi.
   *
   * Hai nhánh loại trừ nhau. Không thể vừa bẻ kèo vừa ăn thưởng sống sót trong
   * cùng một vòng, và nếu để cả hai chạy thì con số ròng sẽ nói dối về việc
   * người chơi vừa làm gì.
   */
  if (luatVon && khoaVon) {
    if (g.be_keo_vong === st.vong) {
      const thuHoi = khoaVon.thuong_bp;
      const d = -(KHOA_TAI_SAN.PHAT_BE_KEO_BP + thuHoi);
      congDon += d;
      chain.push({
        kind: 'be_keo', ma: khoaVon.ma,
        phat_bp: KHOA_TAI_SAN.PHAT_BE_KEO_BP, thu_hoi_bp: thuHoi, delta_bp: d,
      });
    } else if (g.danh_muc.tai_san.includes(khoaVon.ma)
      && KHOA_TAI_SAN.GIAI_DOAN_BAO.includes(giaiDoan)) {
      congDon += KHOA_TAI_SAN.THUONG_SONG_SOT_BP;
      chain.push({
        kind: 'khoa_thuong', ma: khoaVon.ma, giai_doan: giaiDoan,
        delta_bp: KHOA_TAI_SAN.THUONG_SONG_SOT_BP,
      });
    }
  }

  /*
   * ── 4e. D33 — ĐẶC QUYỀN PHÒNG HỘ: LỆNH SHORT ĐẶT VÒNG TRƯỚC, KHỚP VÒNG NÀY ──
   *
   * Ăn ĐÚNG NGHỊCH ĐẢO của việc nắm giữ mã đó trong vòng này — kể cả nhiễu, và
   * kể cả DÙNG LẠI ĐÚNG LẦN RÚT của mã ấy (`holdem_nhieu`, vòng, mã). Không có
   * vế "kể cả nhiễu" thì đây không phải phòng hộ mà là một canh bạc thứ hai
   * chồng lên canh bạc thứ nhất; và dùng một domain RNG mới sẽ xê dịch dòng số
   * của mọi lần rút khác, tức trận cũ replay ra map khác.
   *
   * Echo tính qua `machEcho` với một danh mục MỘT LÁ — dùng lại đúng vòng lặp
   * engine chấm điểm, không dựng công thức thứ hai (bài học `bang_dien_tu.ts`).
   *
   * TRẦN hai chiều: một lệnh short không được tự nó quyết định cả vòng. Không có
   * trần thì short đúng một lá biến động mạnh ở đúng vòng sự kiện là ăn trọn ván
   * — đúng lỗi `khop_nhanh`/`di_nguoc` từng mắc (cộng dồn không giới hạn).
   */
  const short = st.dac_quyen === true && g.danh_muc.chien_thuat.includes('phong_ho')
    ? shortKhopO(g, st.vong) : null;
  if (short) {
    const ts = TAI_SAN.find((t) => t.id === short.ma);
    if (ts) {
      const dmMot: DanhMuc = { tai_san: [short.ma], chien_thuat: [] };
      const nen = (mtGiaiDoan(boMaTranCua(st))[short.ma]?.[giaiDoan] ?? 0) + lechTinhChat(st, o, short.ma) + lechBoiCanh(st, o, short.ma)
        + GIA_CUA_THANH_KHOAN_BP[ts.thanh_khoan];
      const nhieu = symmetricNoise(
        rngAt(st.seed, 'holdem_nhieu', st.vong, short.ma),
        bienDongCua(ts, st.beta_tai_san_v2 === true, st.bien_dong_v45 === true));
      const echoBp = machEcho(nguon, [short.ma], dmMot, (id) => sucCangLuc(st, id), (d) => apChuKyBienDo(st, d), chTruAn, boMaTranCua(st))
        .reduce((s, x) => s + x.delta_bp, 0);
      const tho = -(nen + nhieu + echoBp);
      const T = DAC_QUYEN.PHONG_HO.TRAN_BP;
      const kep = Math.max(-T, Math.min(T, tho));
      const d = applyBpInt(kep, DAC_QUYEN.PHONG_HO.HE_SO_BP)
        - DAC_QUYEN.PHONG_HO.PHI_BP;
      congDon += d;
      chain.push({
        kind: 'short', ma: short.ma, vong_dat: short.vong_dat,
        nghich_dao_bp: kep, phi_bp: DAC_QUYEN.PHONG_HO.PHI_BP, delta_bp: d,
      });
    }
  }

  /*
   * ── 4f. D33 — ĐẶC QUYỀN CHẶN LỖ: SÀN SỤT GIẢM CỦA PHẦN LÕI ─────────────────
   *
   * ⚠ "CHƯA TÍNH TRƯỢT GIÁ VÀ KẸT THANH KHOẢN" là chữ của founder, và nó là
   * TOÀN BỘ hình dạng của đặc quyền này: sàn áp lên phần LÕI (giai đoạn · echo ·
   * thẻ · short), rồi họ trượt giá cộng vào SAU nên kết quả cuối VẪN THỦNG SÀN
   * được. Đúng như ngoài đời — stop-loss không bảo đảm khớp đúng giá đã đặt.
   * Cài sàn lên tổng cuối là hứa một thứ thị trường thật không hứa, và nó còn
   * NÉN PHƯƠNG SAI, thứ vỡ gate G3 (xem docstring `THE_PHONG_THU`).
   *
   * Danh sách họ trượt giá viết ra tường minh chứ không lọc kiểu "trừ mấy cái
   * âm": mắt xích mới thêm vào sau này phải được XẾP LOẠI có ý thức, không được
   * âm thầm rơi vào nhóm nào.
   */
  const HO_TRUOT_GIA: readonly MatXich['kind'][] = [
    'crowding', 'hoan_truot', 'khoa_giam_truot', 'xep_hang', 'dao_phi', 'dac_quyen',
  ];
  // v55 (D409) — KỶ LUẬT (trait, cổng `chanLoTrait`) mở đúng máy sàn này khi lá Chặn Lỗ đã rời shop.
  if (coDacQuyen(st, g, 'chan_lo') || (st.chan_lo_trait === true && rb.chanLo && st.ky_luat_sau_don_bay !== true)) {
    const truot = chain
      .filter((m) => HO_TRUOT_GIA.includes(m.kind))
      .reduce((s, m) => s + m.delta_bp, 0);
    const loi = congDon - truot;
    const san = -DAC_QUYEN.CHAN_LO.SAN_BP;
    if (loi < san) {
      const d = san - loi;
      congDon += d;
      chain.push({
        kind: 'chan_lo_san', truoc_san_bp: loi, san_bp: san, delta_bp: d,
      });
    }
    /*
     * PHÍ BẢO HIỂM — thu MỖI vòng, dù sàn có chạm hay không, và thu SAU khi nâng
     * sàn. Thu trước thì chính khoản phí bị sàn hoàn lại đúng những vòng nó phải
     * được trả, tức bảo hiểm miễn phí ở đúng lúc nó có giá trị nhất — cùng bệnh
     * D20 đã chẩn ba lần ("an toàn miễn phí thì mọi luật siết rủi ro phản tác
     * dụng"), và là điều kiện D33 đặt ra: đặc quyền phải có GIÁ LẶP LẠI.
     */
    congDon -= DAC_QUYEN.CHAN_LO.PHI_MOI_VONG_BP;
    chain.push({
      kind: 'dac_quyen', id: 'chan_lo', ly_do: 'phi_bao_hiem',
      delta_bp: -DAC_QUYEN.CHAN_LO.PHI_MOI_VONG_BP,
    });
  }

  // ── 4g. v55 (D409) — CHỐT NON (trait, cổng `chanLoTrait`): TRẦN lãi phần lõi, gương của sàn 4f — cùng danh sách họ
  // trượt giá, cùng chỗ (trước NHÂN). Người mang nó luôn 'chốt non': vòng nào lõi vượt trần là bị cắt đúng phần vượt.
  if (st.chan_lo_trait === true && rb.chotNon && st.ky_luat_sau_don_bay !== true) {
    const truot = chain.filter((m) => HO_TRUOT_GIA.includes(m.kind)).reduce((s, m) => s + m.delta_bp, 0);
    const loi = congDon - truot;
    const tran = THAM_SO.CHOT_NON_TRAN_BP;
    if (loi > tran) {
      const d = tran - loi;
      congDon += d;
      chain.push({ kind: 'chot_non_tran', truoc_tran_bp: loi, tran_bp: tran, delta_bp: d });
    }
  }
  // ── 4h. v55 (D409) — LƯỚT SÓNG MỚI (cổng `luotSongMoi`): lệnh CHỐT LỜI TRONG Ô. Đỉnh sóng của mã trong ô = max(Δ, 0) +
  // |Δ|·u, u rút tất định (domain riêng: không xê dịch cú rút nào của map/shop). Chạm mục tiêu ⇒ phần đặt bán khớp ở
  // mục tiêu thay vì giá đóng ô: (fill − Δ) × phần — DƯƠNG khi sóng rút lại dưới mục tiêu, ÂM khi Δ vượt mục tiêu (ra
  // sớm). Không chạm ⇒ không mắt xích. Chỉ ghế cầm Lướt Sóng (TÊ LIỆT đã rút lá ở trên).
  if (st.luot_song_moi === true && (g.chot_loi?.length ?? 0) > 0 && g.danh_muc.chien_thuat.includes('luot_song')) {
    for (const l of g.chot_loi!) {
      const delta = chain.reduce((t, m) => (
        MAT_XICH_GIA_THEO_MA.includes(m.kind) && 'id' in m && m.id === l.ma ? t + m.delta_bp : t), 0);
      const u = rngAt(st.seed, 'holdem_song', st.vong, l.ma).below(LUOT_SONG_MOI.DINH_THEM_TOI_DA_BP);
      const dinh = Math.max(delta, 0) + Math.floor((Math.abs(delta) * u) / 10000);
      if (dinh < l.nguong_bp) continue;
      const fill = Math.min(l.nguong_bp, dinh);
      const d = Math.floor(((fill - delta) * l.phan_bp) / 10000);
      congDon += d;
      chain.push({ kind: 'song', ma: l.ma, nguong_bp: l.nguong_bp, dinh_bp: dinh, phan_bp: l.phan_bp, delta_bp: d });
    }
  }

  // ── 5. NHÂN — Đòn Bẩy. Mắt xích cuối, và là đỉnh của dây chuyền. ────────
  // v49 — giá sổ khống vào PnL tường thuật ở đây (không vào `congDon`, xem bước 2b).
  let pnl = congDon + giaKhongTong;
  if (g.danh_muc.chien_thuat.includes('don_bay')) {
    const truoc = pnl;
    const maGan = ganThe?.don_bay;

    /*
     * D3 — ĐÒN BẨY GẮN VÀO MÃ NÀO thì chỉ nhân đôi phần của MÃ ĐÓ.
     *
     * ⚠ KHÔNG phải tách lại `dungChuoi` thành rổ theo từng mã như tôi tưởng lúc
     * đầu. Dây chuyền ĐÃ mang sẵn `id` tài sản trên mọi mắt xích theo mã (`tai_san`,
     * `echo`, `crowding`, `hoan_truot`), nên phần đóng góp của một mã cộng lại được
     * từ chính nó. Rẻ hơn tái cấu trúc rất nhiều, và giữ được bất biến "tổng mắt
     * xích cộng dồn khớp PnL" mà test cũ đang canh.
     *
     * Chưa gắn (trận cũ / người chơi chưa chọn) ⇒ nhân TOÀN BỘ, đúng hành vi trước
     * D3. Đây là điều kiện để `events` append-only không nói dối.
     */
    const MAT_XICH_THEO_MA = MAT_XICH_GIA_THEO_MA;
    /*
     * v34 — CẤP 2 ĐÒN BẨY nhắm HAI mã (đặc quyền cá mập: ghim sẵn một lá, lấy
     * thêm một lá là cấp 2). Đích phụ chỉ đọc khi cổng bật + cấp ≥ 2 + đã có đích
     * chính + khác mã — thiếu một điều kiện là bỏ qua, không ném (log cũ, replay).
     */
    const maGanPhu = st.vai_co_rang === true && maGan
      && capThe(g.danh_muc, 'don_bay') >= 2
      && g.danh_muc.gan_phu?.don_bay && g.danh_muc.gan_phu.don_bay !== maGan
      ? g.danh_muc.gan_phu.don_bay : undefined;
    const dich = maGan ? [maGan, ...(maGanPhu ? [maGanPhu] : [])] : null;
    /*
     * ⭐⭐ v46 (D338) — MỖI MÃ MỘT MẮT XÍCH, áp vào ĐÚNG vị thế của mã đó.
     *
     * Bản dưới (trước v46) cộng % giá của các mã thành MỘT con số rồi để `chotPhien`
     * áp nó như % CẢ VÍ lên từng vị thế — sai đơn vị: cầm hai mã cùng +50% thì mắt
     * xích +100% nhân vào cả hai ⇒ vị thế ×2,97 thay vì ×1,98 (trận tập founder, vòng 7).
     * Nay mỗi mã trong đích (chưa gắn ⇒ mọi mã có mắt xích giá vòng này) được một
     * `nhan` mang `ma` = đúng phần giá của mã ấy, và `chotPhien` dồn nó vào tầng THEO MÃ.
     * `dichDonBayTheoMa` là MỘT nguồn cho cả chỗ này lẫn lãi vay (D61).
     */
    if (st.don_bay_theo_ma === true) {
      for (const ma of dichDonBayTheoMa(st, g, chain)) {
        const phan = chain.reduce((t, m) => (
          MAT_XICH_THEO_MA.includes(m.kind) && 'id' in m && m.id === ma ? t + m.delta_bp : t), 0);
        if (phan !== 0) {
          pnl += phan;
          chain.push({ kind: 'nhan', id: 'don_bay', he_so_bp: 20000, delta_bp: phan, ma });
        }
        /*
         * v49 (D342) — PHẦN KHỐNG của cùng mã được nhân RIÊNG, một dòng mang `khong`. Lãi vay
         * đã tính trên sổ khống từ D338 (`chotPhien` cộng `vi_the_khong` của đích), nên trước
         * v49 người khống trả lãi mà không được nhân — nay hai vế khớp nhau.
         */
        const phanKhong = chain.reduce((t, m) => (
          m.kind === 'khong_gia' && m.id === ma ? t + m.delta_bp : t), 0);
        if (phanKhong !== 0) {
          pnl += phanKhong;
          chain.push({
            kind: 'nhan', id: 'don_bay', he_so_bp: 20000, delta_bp: phanKhong, ma, khong: true,
          });
        }
      }
    } else {
      const phanCuaMa = dich
        ? chain.reduce((t, m) => (
          MAT_XICH_THEO_MA.includes(m.kind) && 'id' in m && dich.includes(m.id as string)
            ? t + m.delta_bp : t), 0)
        : null;

      pnl = phanCuaMa === null ? pnl * 2 : pnl + phanCuaMa;
      if (pnl !== truoc) {
        chain.push({
          kind: 'nhan',
          id: 'don_bay',
          he_so_bp: 20000,
          delta_bp: pnl - truoc,
          ...(maGan ? { ma: maGan } : {}),
          ...(maGanPhu ? { ma_phu: maGanPhu } : {}),
        });
      }
    }
  }

  /*
   * ── 5b. v55 (D422) — KỶ LUẬT / CHỐT NON SAU ĐÒN BẨY (cổng `kyLuatSauDonBay`). Founder chọn B: sàn đỡ cả phần VAY, trần
   * cắt cả phần vay — cùng một chỗ, cùng danh sách họ trượt giá cộng sau (lệnh cắt lỗ ngoài đời không bảo đảm khớp đúng
   * giá). KỶ LUẬT VẪN thu phí bảo hiểm MỖI vòng, thu SAU khi nâng sàn (founder 26/09: *"Kỷ luật vẫn phải cho phí mỗi
   * round đấy"* — cùng lý do D33: an toàn miễn phí thì mọi luật siết rủi ro phản tác dụng). Không vị thế vay ⇒ đúng bằng
   * đặt sàn trên phần lõi.
   */
  if (st.chan_lo_trait === true && st.ky_luat_sau_don_bay === true && (rb.chanLo || rb.chotNon)) {
    const truot = chain.filter((m) => HO_TRUOT_GIA.includes(m.kind)).reduce((t, m) => t + m.delta_bp, 0);
    const loi = pnl - truot;
    if (rb.chanLo && loi < -THAM_SO.KY_LUAT_SAN_BP) {
      const d = -THAM_SO.KY_LUAT_SAN_BP - loi;
      pnl += d;
      chain.push({ kind: 'chan_lo_san', truoc_san_bp: loi, san_bp: -THAM_SO.KY_LUAT_SAN_BP, delta_bp: d });
    } else if (rb.chotNon && loi > THAM_SO.CHOT_NON_TRAN_BP) {
      const d = THAM_SO.CHOT_NON_TRAN_BP - loi;
      pnl += d;
      chain.push({ kind: 'chot_non_tran', truoc_tran_bp: loi, tran_bp: THAM_SO.CHOT_NON_TRAN_BP, delta_bp: d });
    }
    if (rb.chanLo) {
      pnl -= THAM_SO.KY_LUAT_PHI_BP;
      chain.push({ kind: 'dac_quyen', id: 'chan_lo', ly_do: 'phi_bao_hiem', delta_bp: -THAM_SO.KY_LUAT_PHI_BP });
    }
  }

  /*
   * ── 6. KHẨU VỊ RỦI RO — mắt xích CUỐI CÙNG, sau cả Đòn Bẩy.
   *
   * Phải đứng cuối vì nó là hệ số của TOÀN BỘ kết quả vòng, không phải của một
   * nguồn lãi/lỗ nào. Đặt trước Đòn Bẩy thì hai hệ số nhân dồn nhau theo thứ tự
   * và người chơi không đọc được cái nào gây ra bao nhiêu.
   *
   * Nhân CẢ HAI CHIỀU nên kỳ vọng không đổi — xem docstring `KHAU_VI`. Đó là điều
   * kiện để nó đo được KHẨU VỊ chứ không đẻ ra một lựa chọn trội.
   *
   * ⭐⭐ v47 (D339) — CHIA HỆ SỐ THEO TỪNG PHẦN, không nhân một cục.
   *
   * Bản dưới (≤ v46) nhân TỔNG % của chuỗi rồi đẩy phần chênh xuống MỘT mắt xích không
   * mang mã — mà mắt xích không mang mã thì `chotPhien` xếp vào tầng DANH MỤC, tức áp
   * (k−1)×(tổng % MỌI mã) lên TỪNG vị thế. Cầm N mã cùng lên là quyết liệt ăn ~N lần phần
   * đáng ra được nhân, còn thận trọng bị trừ theo cả rổ nên rổ đang lãi vẫn có thể về âm.
   * Đúng lỗi ĐƠN VỊ đã ăn của repo một lượt ở Đòn Bẩy (D338), chỉ khác chỗ nó nằm.
   *
   * Nay nhân THEO ĐÚNG PHẦN: mỗi mã một mắt xích mang `ma` (nhân phần của chính mã đó),
   * cộng một mắt xích cho phần danh mục. `tangCuaMatXich` là nguồn chung với `chotPhien` —
   * hai bên đọc lệch nhau là cách hệ số "đúng trên mắt xích, sai trong túi" quay lại.
   * v49 (D342) — thêm tầng SỔ KHỐNG: mỗi mã đang khống một dòng mang `{ma, khong}`.
   *
   * ⚠ Cộng phần theo CHUỖI, không theo `pnl`: `doi_tac` nằm trong chuỗi mà không vào
   * `congDon`, nên hai con số không bằng nhau, và TIỀN đi theo chuỗi.
   */
  const kv = khauViCua(g.khau_vi);
  if (kv.he_so_bp !== 10000) {
    if (st.khau_vi_theo_ma === true) {
      const phan = new Map<string, number>();
      /** v49 (D342) — phần SỔ KHỐNG theo mã: nhân biên độ riêng, dòng mang `khong`. */
      const phanKhong = new Map<string, number>();
      let phanDanhMuc = 0;
      for (const m of chain) {
        const t = tangCuaMatXich(st, m);
        if (t.tang === 'ma') phan.set(t.ma, (phan.get(t.ma) ?? 0) + m.delta_bp);
        else if (t.tang === 'khong') phanKhong.set(t.ma, (phanKhong.get(t.ma) ?? 0) + m.delta_bp);
        else phanDanhMuc += m.delta_bp;
      }
      for (const [ma, r] of phan) {
        const d = applyBpInt(r, kv.he_so_bp) - r;
        if (d === 0) continue;
        pnl += d;
        chain.push({ kind: 'khau_vi', id: kv.id, he_so_bp: kv.he_so_bp, delta_bp: d, ma });
      }
      for (const [ma, r] of phanKhong) {
        const d = applyBpInt(r, kv.he_so_bp) - r;
        if (d === 0) continue;
        pnl += d;
        chain.push({
          kind: 'khau_vi', id: kv.id, he_so_bp: kv.he_so_bp, delta_bp: d, ma, khong: true,
        });
      }
      const dDanhMuc = applyBpInt(phanDanhMuc, kv.he_so_bp) - phanDanhMuc;
      if (dDanhMuc !== 0) {
        pnl += dDanhMuc;
        chain.push({ kind: 'khau_vi', id: kv.id, he_so_bp: kv.he_so_bp, delta_bp: dDanhMuc });
      }
    } else if (pnl !== 0) {
      const truoc = pnl;
      pnl = applyBpInt(pnl, kv.he_so_bp);
      chain.push({
        kind: 'khau_vi', id: kv.id, he_so_bp: kv.he_so_bp, delta_bp: pnl - truoc,
      });
    }
  }

  // ── 7. v55 (D409) — NGỌN LỬA ĐÀ (cổng `luaQuyetToan`): sau nhân và khẩu vị, theo MÃ trên phần giá của mã ấy (kể cả
  // phần đã nhân): lãi cộng thêm, lỗ trừ thêm, nấc càng cao càng đậm. Đọc nấc lửa LÚC QUYẾT (vòng trước cập nhật).
  // Chỉ tầng THEO MÃ dài; sổ khống không nhân (bias 'khong' vẫn tích lửa để hưởng phí rẻ).
  const coLua = st.lua === true && st.lua_quyet_toan === true && (g.lua?.nac ?? 0) > 0 && !rb.muLua;
  const coKienNhan = rb.kienNhan && Object.values(g.giu_lien ?? {}).some((n) => n >= THAM_SO.KIEN_NHAN_VONG);
  const coNongVoi = rb.nongVoi && Object.values(g.giu_lien ?? {}).some((n) => n > THAM_SO.NONG_VOI_VONG);
  if (coLua || coKienNhan || coNongVoi) {
    // Phần giá theo MÃ, đọc MỘT lần trước khi thêm mắt xích lửa/kiên nhẫn — hai thưởng không nhân chồng lên nhau.
    const phan: Record<string, number> = {};
    for (const m of chain) {
      const t = tangCuaMatXich(st, m);
      if (t.tang === 'ma') phan[t.ma] = (phan[t.ma] ?? 0) + m.delta_bp;
    }
    if (coLua) {
      for (const x of matXichLua(phan, g.lua!.nac, st.lua_khong_phat_dao === true)) {
        pnl += x.delta_bp;
        chain.push({ kind: 'lua', ma: x.ma, nac: g.lua!.nac, thuan: x.thuan, he_so_bp: x.he_so_bp, delta_bp: x.delta_bp });
      }
    }
    // v55 (D422) — KIÊN NHẪN: mã giữ liền ≥ `KIEN_NHAN_VONG` vòng (đếm tới hết vòng TRƯỚC) có lãi trong vòng ⇒ cộng
    // thêm một phần lãi. Vế lỗ không đụng: thưởng việc để lãi chạy, không phải bảo hiểm.
    if (coKienNhan) {
      for (const [ma, bp] of Object.entries(phan)) {
        const n = g.giu_lien?.[ma] ?? 0;
        if (bp <= 0 || n < THAM_SO.KIEN_NHAN_VONG) continue;
        const d = Math.floor((bp * THAM_SO.KIEN_NHAN_THUONG_BP) / 10000);
        if (d === 0) continue;
        pnl += d;
        chain.push({ kind: 'kien_nhan', ma, giu_vong: n, he_so_bp: THAM_SO.KIEN_NHAN_THUONG_BP, delta_bp: d });
      }
    }
    // v55 (D422) — NÓNG VỘI: mã giữ liền QUÁ `NONG_VOI_VONG` vòng có lãi ⇒ phần lãi bị cắt — ôm lâu là để tuột con sóng,
    // nên người mang tật bị ép xoay mã liên tục. Vế lỗ không đụng (không phải bảo hiểm ngược).
    if (coNongVoi) {
      for (const [ma, bp] of Object.entries(phan)) {
        const n = g.giu_lien?.[ma] ?? 0;
        if (bp <= 0 || n <= THAM_SO.NONG_VOI_VONG) continue;
        const d = -Math.floor((bp * THAM_SO.NONG_VOI_CAT_BP) / 10000);
        if (d === 0) continue;
        pnl += d;
        chain.push({ kind: 'nong_voi', ma, giu_vong: n, he_so_bp: THAM_SO.NONG_VOI_CAT_BP, delta_bp: d });
      }
    }
  }
  return { chain, pnl_bp: pnl };
}

// ---------------------------------------------------------------------------
// Chia Quỹ vòng
// ---------------------------------------------------------------------------

/**
 * Chia `quy` cho `soNguoi` người theo trọng số hạng, TOÀN SỐ NGUYÊN.
 *
 * Vector trọng số CO THEO số người còn tranh: ít người thì cắt bớt suất rồi
 * chuẩn hoá lại, nên không bao giờ có chuyện "3 suất cho 2 người" làm rơi chip.
 * Phần dư do làm tròn xuống dồn cho hạng 1 — chip ảo là hệ KÍN trong trận,
 * tổng vốn cả bàn phải bất biến (test khoá điều này).
 */
export function chiaQuyVong(
  quy: number, soNguoi: number, coGian = false,
): number[] {
  if (soNguoi <= 0 || quy <= 0) return [];
  // v31 — số suất co giãn theo số ghế khi bật cờ. Xem `trongSoQuyVong`.
  const w = trongSoQuyVong(soNguoi, coGian);
  if (w.length === 0) return [quy, ...Array<number>(soNguoi - 1).fill(0)];
  const tong = w.reduce((a, b) => a + b, 0);
  if (tong <= 0) return [quy, ...Array<number>(soNguoi - 1).fill(0)];

  const phan = w.map((x) => idiv(quy * x, tong));
  const du = quy - phan.reduce((a, b) => a + b, 0);
  phan[0] = (phan[0] ?? 0) + du;
  while (phan.length < soNguoi) phan.push(0);
  return phan;
}

/**
 * v54 (D403) — TRẦN PHẦN MỘT GHẾ trong MỘT pot (phương án A; founder chốt C = A + B, 24/09). Hàm THUẦN, số nguyên.
 *
 * `nhan`: ghế → phần chia theo hạng của pot này (đầu ra `chiaQuyVong`). Phần nào vượt `tran = ⌊quy × TRONG_SO[0] ÷
 * ΣTRONG_SO⌋` (50%) bị kẹp về trần; tổng phần vượt trả lại các ghế ĐÃ GÓP vào chính pot này (`gop` — kể cả người bỏ
 * bài: tiền họ nằm trong pot) TRỪ ghế bị kẹp, theo tỷ lệ góp: floor từng phần, dư lẻ trao từng chip theo (góp giảm
 * dần, id tăng dần) — tất định cho replay. Không còn ai để trả (ghế bị kẹp là người góp duy nhất) ⇒ trả nguyên `nhan`:
 * tiền không bao giờ cháy, tổng ra luôn bằng tổng vào.
 * Ca nó cắn: pot còn ≤ 2 ghế tranh (100% hoặc 62,5%). Pot ≥ 3 ghế tranh thì hạng 1 ≤ 50% sẵn — không chạm chip nào.
 */
export function kepTranHang1(
  nhan: ReadonlyMap<string, number>, quy: number, gop: ReadonlyMap<string, number>,
): Map<string, number> {
  const ts = CHIA_QUY_VONG.TRONG_SO;
  const tongTs = ts.reduce((a, b) => a + b, 0);
  const tran = tongTs > 0 ? Math.floor((quy * (ts[0] ?? 0)) / tongTs) : quy;
  const ra = new Map(nhan);
  const biKep = new Set<string>();
  let thua = 0;
  for (const [id, phan] of ra) {
    if (phan <= tran) continue;
    thua += phan - tran;
    ra.set(id, tran);
    biKep.add(id);
  }
  if (thua === 0) return ra;
  const nguoiNhan = [...gop]
    .filter(([id, x]) => x > 0 && !biKep.has(id))
    .sort(([a, x], [b, y]) => (y - x) || (a < b ? -1 : a > b ? 1 : 0));
  const tongGop = nguoiNhan.reduce((s, [, x]) => s + x, 0);
  if (tongGop <= 0) return new Map(nhan);
  const tra = nguoiNhan.map(([, x]) => Math.floor((thua * x) / tongGop));
  let du = thua - tra.reduce((s, x) => s + x, 0);
  for (let k = 0; du > 0; k = (k + 1) % tra.length, du -= 1) tra[k] = tra[k]! + 1;
  nguoiNhan.forEach(([id], k) => {
    if (tra[k]! > 0) ra.set(id, (ra.get(id) ?? 0) + tra[k]!);
  });
  return ra;
}

// ---------------------------------------------------------------------------
// Giải quyết một vòng
// ---------------------------------------------------------------------------

/** Bối cảnh trao cho người/bot khi tới lượt quyết định cược. */
export interface BoiCanhCuoc {
  ghe_id: string;
  /** Mức phải góp để còn trong vòng. */
  gia: number;
  /** Còn thiếu bao nhiêu để theo (đã kẹp theo vốn còn lại). */
  con_thieu: number;
  /** Tổng tiền đang nằm trên bàn — dùng tính pot odds. */
  quy_hien_tai: number;
  duoc: LoaiHanhDong[];
  /** Tố tối đa (= vốn còn lại). */
  to_toi_da: number;
  so_nguoi_con: number;
}

export type QuyetDinhCuoc =
  (ctx: BoiCanhCuoc) => { loai: LoaiHanhDong; them?: number };

/**
 * NỀN VÒNG CỦA TRẬN — mức mỗi ghế còn cược nộp vào Quỹ vòng mỗi vòng. MỘT CỬA (A11.5): vòng cược,
 * `quy_vong_hien_tai` và phân loại hành động ở API đều đọc hàm này — không nơi nào tự nhân `CAM_KET_NEN` nữa.
 *
 * v54 (D403, phương án B) — `quy_theo_co_ban`: nền co theo SỐ GHẾ CỦA BÀN để quỹ ≈ `CAM_KET_NEN × SEATS` (2.500) ở
 * mọi cỡ bàn — bàn 8 ghế thôi khuếch đại quỹ 1,6×. Số ghế là số ghế lúc dựng bàn (`st.ghe.length`), không đổi khi
 * có ghế cháy: mức nộp mỗi vòng biết trước từ đầu trận. Cờ tắt ⇒ nền phẳng `CAM_KET_NEN` như mọi trận đã lưu.
 */
export function nenVongCua(st: Pick<TrangThaiTran, 'quy_theo_co_ban' | 'ghe' | 'giai_xu'>): number {
  if (st.giai_xu === true) return 0;   // D584 — giải bằng xu trait: không thu nền, không hũ tiền
  if (st.quy_theo_co_ban !== true) return HOLDEM_MATCH.CAM_KET_NEN;
  return Math.floor((HOLDEM_MATCH.CAM_KET_NEN * HOLDEM_MATCH.SEATS) / Math.max(1, st.ghe.length));
}

/**
 * Chơi trọn một VÒNG CƯỢC tuần tự.
 *
 * Gọi `quyetDinh` mỗi khi tới lượt một ghế — kể cả khi ghế đó đã hành động
 * rồi mà bị tố lại. Đây chính là chỗ bản cũ sai: nó hỏi mỗi ghế đúng một lần
 * rồi tự động trừ tiền theo giá cao nhất, nên "theo" không phải lựa chọn.
 */
export function choiVongCuoc(
  st: TrangThaiTran, quyetDinh: QuyetDinhCuoc,
): TrangThaiCuoc {
  // ⚠ `conCuoc`, không phải `!da_chay`. Người ĐỨNG NGOÀI và người ĐẦU HÀNG vẫn
  // ngồi trong `st.ghe` (một để chờ chốt hạng, một để xếp bét bảng) nhưng
  // TUYỆT ĐỐI không được hỏi lượt và không được đóng cược nền — nếu không thì
  // "đóng băng vốn" thành nói dối: vốn vẫn bị trừ mỗi vòng.
  const song = st.ghe.filter((g) => conCuoc(g));
  // v14 — sức đóng nền = NAV: all-in không còn là né nộp quỹ (founder chốt B).
  // cuocTat đang tắt máy tố nên trường `von` này chỉ quyết được MỨC NỀN thu.
  let tt = moVongCuoc(song.map((g) => ({
    /*
     * v43 (D314) — SỨC ĐÓNG ĐỌC **NAV TỰ DO**, không phải NAV đầy đủ.
     * Tiền trong sổ tiết kiệm đang bị khoá: ghế gửi hết mà sức đóng vẫn tính trên NAV
     * gồm cả phần khoá thì engine đòi một khoản ghế không rút ra được ⇒ NAV RÒ khỏi hệ
     * kín. Trận chưa bật ngân hàng thì `navTuDo === navCua`, nên trận cũ không đổi.
     */
    id: g.id, von: st.nen_nav === true ? navTuDo(g) : g.von,
  })), nenVongCua(st));
  /*
   * v34 — NỀN GIỮ PHẲNG 500 CHO MỌI VAI, CÓ CHỦ Ý. Bản đầu nhân nền theo hệ số
   * vốn ("cùng % nộp quỹ") và đo ra vai vốn to rơi xuống bét bàn: Quỹ vòng chia
   * SUẤT BẰNG CHIP như nhau, ghế nộp 1.500 nhận suất y hệt ghế nộp 500 ⇒ vai to
   * trợ cấp ròng cho bàn mỗi vòng. Nền phẳng thì kỳ vọng ròng của mọi ghế = 0
   * (pot là tái phân phối, không phải thuế) ⇒ trung tính theo thước % tăng
   * trưởng. Đo: đội lái 6,4 → (xem `vai.ts`).
   */

  let canh = 0;
  while (!daDongVong(tt) && canh < 200) {
    canh += 1;
    const lam = duocLam(tt)!;
    let quy = 0;
    for (const v of tt.gop.values()) quy += v;
    /*
     * D2 — HẾT LƯỢT CẮT LỖ thì 'bo' RỜI KHỎI DANH SÁCH ĐƯỢC LÀM.
     *
     * Chặn ở ĐÚNG chỗ này chứ không ở `cuoc.ts`: quota là luật của TRẬN, còn
     * `cuoc.ts` là máy chạy một vòng cược thuần — nhồi luật trận vào đó là buộc
     * nó phải biết về map, về số lượt, về những thứ không phải việc của nó.
     *
     * Và vì `lam.duoc` là danh sách MÀ API CŨNG DÙNG để vẽ nút cho người chơi,
     * chặn ở đây khiến bot và UI tự động đồng ý với nhau: bot không chọn được
     * nước đã cấm, người chơi không thấy nút đã cấm. Nếu chặn ở tầng dưới thì UI
     * vẫn vẽ nút Cắt lỗ rồi bấm vào mới báo lỗi — đúng kiểu tệ nhất.
     */
    const gheLam = st.ghe.find((g) => g.id === lam.ghe_id);
    const conQuota = gheLam
      ? soLanCatLo(soVong(st)) - gheLam.so_lan_cat_lo
      : 0;
    let duoc = conQuota > 0 ? lam.duoc : lam.duoc.filter((x) => x !== 'bo');
    // v54 (D403) — BỎ BÀI TẮT: không ai bỏ được nữa — chặn ở đúng chỗ này vì đúng lý do của quota ngay trên.
    if (st.bo_bai_tat === true) duoc = duoc.filter((x) => x !== 'bo');
    /*
     * LÕI VỐN B — VỐN BỊ GIAM thì không Tăng cam kết được.
     *
     * Chặn ở ĐÚNG chỗ đã chặn quota cắt lỗ, và vì đúng lý do đã ghi ở đó:
     * `lam.duoc` là danh sách mà API cũng dùng để vẽ nút, nên bot và UI tự động
     * đồng ý với nhau. Đây cũng là nửa hình phạt duy nhất mà engine tự thi hành
     * được — nửa còn lại (cấm khảo sát lại thẻ) nằm ở nhịp 1, xem `biGiamVon`.
     */
    if (gheLam && st.luat_von && biGiamVon(gheLam, st.vong)) {
      duoc = duoc.filter((x) => x !== 'to');
    }
    /*
     * D34 điều 4 — ALL-IN CHỈ MỞ SAU KHI CHỌN XONG CẢ 3 THẺ CHIẾN THUẬT.
     *
     * ⚠ CHẶN BẰNG TRẦN TỐ, KHÔNG BẰNG CÁCH BỎ NƯỚC 'to' KHỎI `duoc`. Bỏ 'to' là
     * cấm luôn mọi cú tăng cam kết cho tới giữa trận — tức nửa đầu trận không
     * còn quyết định cược nào, đúng thứ D35 vừa chẩn là "ba nút không hậu quả".
     * Trần giữ lại đúng MỘT chip: người chơi vẫn tố được tới sát trần, chỉ là
     * không dồn được đến 0.
     *
     * Nước 'theo' KHÔNG bị chặn: theo mà hết tiền là bị ép all-in, không phải
     * một lựa chọn — chặn nó là đá người chơi khỏi vòng vì họ nghèo.
     */
    const tranTo = gheLam && !allInMoCho(st, gheLam)
      ? Math.max(0, lam.to_toi_da - 1) : lam.to_toi_da;
    if (tranTo <= lam.con_thieu) duoc = duoc.filter((x) => x !== 'to');

    const qdTho = quyetDinh({
      ghe_id: lam.ghe_id,
      gia: lam.gia_phai_theo,
      con_thieu: lam.con_thieu,
      quy_hien_tai: quy,
      duoc,
      to_toi_da: tranTo,
      so_nguoi_con: tt.thuTu.filter((id) => !tt.daBo.has(id)).length,
    });
    /*
     * 28/07 — MÁY CƯỢC TẮT (`cuoc_tat`): TỐ chết, nhưng BỎ phải SỐNG.
     *
     * Vẫn MỜI callback rồi ép mọi nước trừ 'bo' về 'theo' — không ai tố được,
     * mỗi ghế đóng đúng giá nền, vòng đóng sau một lượt quét. Quỹ vòng =
     * CAM_KET_NEN × số ghế còn chơi. Fallback "chuỗi cạn thì THEO" của replay
     * (holdem_api) — chỗ đã kéo người chơi tay trắng 10.000 → 2.886 — hết đường
     * gây hại vì THEO ở giá nền là nước rẻ nhất có thể.
     *
     * ⚠ VÌ SAO KHÔNG ÉP THẲNG 'theo' MÀ BỎ QUA CALLBACK (bản đầu của bản vá làm
     * thế, và đó là bẫy "cơ chế trang trí" LẦN THỨ 10): toàn bộ nhánh CẮT LỖ —
     * phí rút khẩn + lạm phát, quota `so_lan_cat_lo`, giẫm đạp khi ≥30% cùng
     * chạy, rời pot — khoá theo `ttCuoc.daBo`, mà daBo chỉ được ghi qua nước
     * 'bo' của chính máy này. Bỏ qua callback là daBo rỗng vĩnh viễn: nút BỎ
     * trên màn bấm được, hộp xác nhận doạ phí, mà không có gì xảy ra hết.
     * Quota vẫn gác qua `duoc` (hết lượt thì 'bo' bị lọc từ trước) — không đổi.
     */
    const qd = st.cuoc_tat === true && qdTho.loai !== 'bo'
      ? { loai: 'theo' as const }
      : qdTho;
    // Quyết định không hợp lệ thì hạ về "theo" thay vì nổ giữa trận —
    // nhưng CHỈ ở đây, tầng dưới vẫn nghiêm ngặt để bug lộ ra trong test.
    // Hết quota mà vẫn cố bỏ → PHẢI CHIẾN ĐẤU (đúng chữ của D2). Muốn ra hẳn thì
    // còn đường Đầu hàng, và nó đắt hơn nhiều: mất luôn hạng.
    const loai = duoc.includes(qd.loai) ? qd.loai : 'theo';
    // Kẹp theo trần đã tính ở trên. Kẹp chứ không từ chối: bot (và UI cũ) không
    // biết luật này, và một quyết định hợp lệ-trừ-đúng-một-chip thì hạ xuống
    // trần vẫn đúng ý người ra lệnh — từ chối thì họ mất lượt vì một luật họ
    // không nhìn thấy.
    const them = loai === 'to' ? Math.min(qd.them ?? 0, tranTo) : (qd.them ?? 0);
    try {
      tt = buocCuoc(tt, lam.ghe_id, loai, them);
    } catch {
      tt = buocCuoc(tt, lam.ghe_id, 'theo');
    }
  }
  return tt;
}

/**
 * CHỐT PHIÊN — chạy engine giá, xếp hạng PnL, chia từng pot.
 *
 * Chia theo HẠNG PnL trong PHẠM VI TỪNG POT (founder chốt phương án 1). Người
 * all-in ít hơn chỉ tranh pot mình đủ sức theo — `pot.ts` lo phần tách.
 */
/**
 * Hệ số của LÁ chiến thuật Đòn Bẩy (bp). Một nguồn chân lý cho cả hai chỗ dùng:
 * mắt xích `nhan` trong `dungChuoi` và trần tổng của `apDonBayCamKet`.
 */
const HE_SO_LA_DON_BAY_BP = 20000;

export interface KetQuaDonBay {
  /** PnL sau đòn bẩy. */
  pnl_bp: number;
  /** Cam kết vòng này chiếm bao nhiêu phần Vốn đầu vòng (bp). */
  ty_le_bp: number;
  /** Hệ số THỰC SỰ đã áp (đã kẹp trần tổng, chưa nhân lệch lỗ). */
  he_so_bp: number;
  /** Phí tài trợ, trừ thẳng Vốn. */
  phi: number;
  mat_xich: MatXich | null;
}

/**
 * D35 HƯỚNG 1 — biến cam kết thành ĐÒN BẨY lên chính `pnl_bp` của người cam kết.
 *
 * Hàm THUẦN, tách khỏi `chotPhien` vì đây là LUẬT TIỀN: A8.3 đòi phần đụng tiền
 * phải có test đi trước, mà test đi trước chỉ làm được nếu có hàm để gọi. Cùng
 * lý do `muaCaVong` bị tách khỏi `replay`.
 *
 * ⚠ ÁP Ở `chotPhien`, KHÔNG Ở `dungChuoi`. `dungChuoi` chấm HIỆU NĂNG DANH MỤC
 * — nó chỉ biết (state, ghế, ô) và không được biết vòng cược đã diễn ra thế nào.
 * Cam kết là dữ liệu của nhịp 2. Nhét vào `dungChuoi` là buộc hàm chấm điểm phải
 * nhận thêm `TrangThaiCuoc`, và mọi test đang gọi nó trực tiếp sẽ phải bịa ra
 * một vòng cược giả để chấm một danh mục.
 */
export function apDonBayCamKet(
  st: TrangThaiTran, g: Ghe, pnlBp: number, camKet: number, vonDauVong: number,
): KetQuaDonBay {
  const tyLe = vonDauVong > 0
    ? Math.min(10000, Math.floor((camKet * 10000) / vonDauVong)) : 0;
  const tat: KetQuaDonBay = {
    pnl_bp: pnlBp, ty_le_bp: tyLe, he_so_bp: 10000, phi: 0, mat_xich: null,
  };
  if (st.don_bay_cam_ket !== true) return tat;

  let heSo = heSoDonBayBp(tyLe);
  /*
   * BẪY B — TRẦN TỔNG KHI CHỒNG LÁ ĐÒN BẨY 2×.
   *
   * Lá đó đã nhân `pnl_bp` bên trong `dungChuoi`; nhân tiếp ở đây là nhân hai
   * lần. Kẹp TÍCH chứ không kẹp riêng từng hệ số — kẹp riêng thì hai trần đều
   * "hợp lệ" mà tích vẫn 3,4×, đúng lớp lỗi mà D20 gọi là "đo sai đơn vị rủi ro".
   *
   * Dùng hệ số DANH NGHĨA của lá (2,0×) kể cả khi lá đang gắn vào một mã và chỉ
   * nhân phần của mã đó: ước lượng CAO là ước lượng an toàn cho một cái trần, và
   * hệ số thực chỉ biết được sau khi dây chuyền chạy xong — không thể vừa dùng
   * nó làm đầu vào cho trần vừa làm đầu ra.
   */
  if (g.danh_muc.chien_thuat.includes('don_bay')) {
    const tran = Math.floor(
      (DON_BAY_CAM_KET.TRAN_TONG_BP * 10000) / HE_SO_LA_DON_BAY_BP);
    heSo = Math.min(heSo, Math.max(10000, tran));
  }

  const nguongChip = applyBpInt(vonDauVong, DON_BAY_CAM_KET.NGUONG_BP);
  const phi = Math.max(0,
    applyBpInt(Math.max(0, camKet - nguongChip), DON_BAY_CAM_KET.PHI_BP));

  if (heSo === 10000 || pnlBp === 0) return { ...tat, he_so_bp: heSo, phi };

  // Vế LỖ nhân nặng hơn — lực đối trọng (2), xem docstring `DON_BAY_CAM_KET`.
  const benLo = pnlBp < 0;
  const heSoAp = benLo
    ? Math.floor((heSo * DON_BAY_CAM_KET.LECH_LO_BP) / 10000) : heSo;
  const moi = applyBpInt(pnlBp, heSoAp);
  return {
    pnl_bp: moi,
    ty_le_bp: tyLe,
    he_so_bp: heSo,
    phi,
    mat_xich: {
      kind: 'don_bay_cam_ket',
      ty_le_bp: tyLe, he_so_bp: heSoAp, ben_lo: benLo, delta_bp: moi - pnlBp,
    },
  };
}

/**
 * v10 NAV — mắt xích nào mang MÃ để áp phần riêng từng vị thế. Whitelist tường
 * minh thay vì "cứ có .id là mã": `dac_quyen` cũng có `id` nhưng đó là id THẺ
 * CHIẾN THUẬT — đoán theo hình dạng là áp tiền vào một mã không tồn tại.
 */
const KIND_NAV_THEO_MA: ReadonlySet<MatXich['kind']> = new Set([
  'tai_san', 'echo', 'crowding', 'khoa_giam_truot', 'hoan_truot',
  'khoa_thuong', 'be_keo',
  // v55 (D409) — mắt xích lửa và sóng mang `ma`: tầng THEO MÃ; không vào bảng công khai (riêng ghế).
  'song', 'lua', 'kien_nhan', 'nong_voi',
  // D561 — tin đã vào giá: tầng THEO MÃ, VÀO bảng công khai (chuyện của thị trường, không riêng ghế).
  'vao_gia',
] as MatXich['kind'][]);

/**
 * Mắt xích RIÊNG TỪNG GHẾ — có mã, nhưng số của nó phụ thuộc vị thế/lá bài/khoá
 * của chính ghế đó, không phải chuyện của thị trường. Loại khỏi bảng lợi suất
 * CÔNG KHAI; xem `loiSuatCongKhai`.
 */
const KIND_RIENG_GHE: ReadonlySet<MatXich['kind']> = new Set([
  'crowding', 'khoa_giam_truot', 'hoan_truot', 'khoa_thuong', 'be_keo',
] as MatXich['kind'][]);

/**
 * ⭐ MỘT NGUỒN (D61) — MẮT XÍCH NÀY ÁP VÀO MÃ NÀO, hay áp lên cả danh mục?
 *
 * Câu trả lời quyết định TIỀN: `chotPhien` chia chuỗi làm hai tầng rồi đưa qua `apDinhGia`
 * — tầng theo mã nhân vào đúng một vị thế, tầng danh mục nhân lên MỌI vị thế. Xếp nhầm tầng
 * là sai ĐƠN VỊ, không phải sai vài phần trăm: repo đã trả giá hai lần cho đúng một lỗi này
 * (`nhan` của Đòn Bẩy — D338; `khau_vi` — D339), và cả hai lần nó im lặng suốt nhiều bản.
 *
 * Nên luật xếp tầng từ nay nằm ĐÚNG MỘT CHỖ, và chỗ đó là đây. `dungChuoi` bước 6 gọi hàm
 * này để biết mình đang nhân cái gì; `chotPhien` gọi nó để chia tiền. Hai bên lệch nhau là
 * cách một hệ số "đúng trên mắt xích, sai trong túi" ra đời.
 *
 * ⚠ `id` KHÔNG phải lúc nào cũng là mã: `dac_quyen` mang id THẺ, `khau_vi` mang id KHẨU VỊ.
 * Vì thế whitelist tường minh, và các kind theo cổng đọc riêng trường `ma`.
 *
 * ⭐ v49 (D342) — BA TẦNG, không phải hai. Sổ KHỐNG của một mã là tầng thứ ba: nó cùng mã với
 * vị thế dài nhưng KHÔNG cùng lợi suất (không chen chúc, không xếp hàng — đó là phí của người
 * mua). Hàm cũ `maCuaMatXich` trả `string | undefined` nên không có chỗ nào để nói "mã này,
 * nhưng là sổ khống" — và mọi thứ không phải mã thì người gọi hiểu là DANH MỤC. Đổi sang kiểu
 * có nhãn để không ai đọc nhầm tầng khống thành tầng danh mục (đúng cái bẫy của cả họ lỗi).
 * ⚠ Cổng TẮT ⇒ từng kind rơi đúng tầng cũ, để trận cũ replay nguyên.
 */
export type TangMatXich =
  | { tang: 'ma'; ma: string }
  | { tang: 'khong'; ma: string }
  | { tang: 'danh_muc' };

const TANG_DANH_MUC: TangMatXich = Object.freeze({ tang: 'danh_muc' });

export function tangCuaMatXich(
  st: Pick<TrangThaiTran, 'don_bay_theo_ma' | 'khau_vi_theo_ma' | 'khong_theo_gia' | 'xep_hang_theo_ma'>,
  m: MatXich,
): TangMatXich {
  const mx = m as { id?: string; ma?: string; khong?: true };
  /** Mắt xích có `ma` theo cổng: sổ khống nếu mang cờ `khong` và cổng khống bật. */
  const theoCo = (ma: string | undefined): TangMatXich => {
    if (!ma) return TANG_DANH_MUC;
    return mx.khong === true && st.khong_theo_gia === true ? { tang: 'khong', ma } : { tang: 'ma', ma };
  };
  if (m.kind === 'khong_gia') {
    return st.khong_theo_gia === true ? { tang: 'khong', ma: m.id } : TANG_DANH_MUC;
  }
  if (m.kind === 'nhan') return st.don_bay_theo_ma === true ? theoCo(mx.ma) : TANG_DANH_MUC;
  if (m.kind === 'khau_vi') return st.khau_vi_theo_ma === true ? theoCo(mx.ma) : TANG_DANH_MUC;
  /*
   * v49 (D342) — XẾP HÀNG KHỚP LỆNH mang mã từ ngày sinh (LÕI VỐN A) mà chưa từng có trong
   * whitelist ⇒ phạt vào MỘT mã áp lên MỌI vị thế (kể cả sổ khống) — ca thứ tư của họ lỗi
   * D338–D340. Phần hoàn của Khớp Nhanh đi cùng nó (`dac_quyen` có `ma`).
   */
  if (st.xep_hang_theo_ma === true) {
    if (m.kind === 'xep_hang') return { tang: 'ma', ma: m.id };
    if (m.kind === 'dac_quyen' && m.ly_do === 'xep_hang' && mx.ma) return { tang: 'ma', ma: mx.ma };
  }
  const ma = KIND_NAV_THEO_MA.has(m.kind) ? (mx.id ?? mx.ma) : undefined;
  return ma ? { tang: 'ma', ma } : TANG_DANH_MUC;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BẢNG LỢI SUẤT CÔNG KHAI — mỗi mã đổi bao nhiêu ở vòng này, THEO THỊ TRƯỜNG
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠⚠ VÌ SAO PHẢI CÓ (D102 — bug thứ BA trong hồ sơ dữ liệu, bàn tròn 17/08 lôi
 * ra, đã đọc code xác minh trước khi vá):
 *
 * `dungChuoi` chỉ dựng mắt xích cho mã GHẾ ĐANG CẦM (`oTaiSan = [...new
 * Set(g.danh_muc.tai_san)]`). Bảng đưa vào `brierVong` trước đây gán `?? 0` cho
 * mọi mã KHÔNG cầm. Hai hệ quả, cả hai đều làm thước đo NGƯỢC:
 *   · cầm ĐÚNG MỘT mã mà mã đó lời ⇒ nó luôn là argmax ⇒ Brier gần như hoàn
 *     hảo, KỂ CẢ khi một mã khác trên bàn lời gấp đôi. Tức thước THƯỞNG việc
 *     không đa dạng hoá — đúng cái docstring của `brierVong` viết ra để tránh;
 *   · mọi mã đang cầm đều LỖ ⇒ cao nhất là 0 ⇒ "mã thắng" rơi vào mã đầu tiên
 *     theo THỨ TỰ KHAI BÁO trong `TAI_SAN`. Một hằng số, không phải sự thật.
 *
 * Đây là lớp lỗi D87 ở dạng khó thấy nhất: hàm đúng, docstring đúng, CALLER cấp
 * sai đầu vào. Không ném lỗi, không test nào đỏ, ra một con số trông hợp lý.
 *
 * ⭐ CÁCH DỰNG: chạy `dungChuoi` cho một GHẾ ẢO cầm đủ mọi mã ở cấp 1, không
 * thẻ chiến thuật, không khoá, không gắn — rồi giữ lại đúng phần THỊ TRƯỜNG
 * (`tai_san` + `echo`), loại mọi mắt xích riêng-ghế.
 *
 * ⚠ GHẾ ẢO TUYỆT ĐỐI KHÔNG ĐƯỢC ĐƯA VÀO `st.ghe`: `demNguoiNam` đếm số ghế đang
 * nắm mỗi mã, nên thêm một ghế là đổi crowding của MỌI người ⇒ viết lại replay
 * của mọi trận đã lưu. Nó chỉ mượn `st` để đọc map/vòng/seed.
 *
 * ⚠ THUẦN QUAN SÁT — không đổi một chip nào của trận, nên KHÔNG cần cổng
 * `balance_version` (đúng tiền lệ chính `brier.ts` đã ghi khi cắm dây lần đầu).
 */
/**
 * TRUNG VỊ — mốc "chợ" cho thanh PHONG CÁCH và mốc "cắt trước cú sập".
 *
 * ⚠ n chẵn phải lấy TRUNG BÌNH HAI phần tử giữa. Lấy một phần tử (`s[n/2]`) là
 * lệch mốc, và hệ quả đo được: tỷ lệ "hơn chợ" của một danh mục DÀN ĐỀU tụt từ
 * 50% xuống 34% — tức thước bắt đầu phạt đa dạng hoá, phạm §1.2 qua cửa sau.
 */
/**
 * v34 — HỆ SỐ TÁC ĐỘNG GIÁ của một ghế theo VAI. 1 khi không vai / cổng tắt.
 * Nhân vào TRƯỢT GIÁ (`apLenhGiaoDich`) và CHEN CHÚC (`dungChuoi`) — hai kênh
 * duy nhất mà "lệnh của tôi làm giá xấu đi cho tôi". Đây là chỗ "vốn to" thành
 * "cá mập": vào to là tự đẩy giá mình lên. Đo trước (D107): đổi CÁCH ĐẾM
 * crowding cho cả bàn làm Tất tay mạnh lên — nên nó là hệ số RIÊNG GHẾ.
 */
export function heSoTacDongGia(st: TrangThaiTran, g: Ghe): number {
  if (st.vai_co_rang !== true || !g.vai) return 1;
  return VAI[g.vai].tac_dong_gia;
}

/** v34 — cái giá của TỔ CHỨC: trần %NAV mỗi mã khi mua + cấm Bán Khống. Khác ⇒ undefined. */
export function mandateCua(st: TrangThaiTran, g: Ghe): Mandate | undefined {
  if (st.vai_co_rang !== true || g.vai !== 'to_chuc') return undefined;
  // D498 — khung minigame: Tổ Chức KHÔNG MARGIN (founder 04/10) ⇒ không lõi Đòn Bẩy. Khoá cũ không có trường (byte-hệt).
  return { tranMaBp: MANDATE_TO_CHUC.TRAN_MA_BP, camKhong: true, ...(st.to_chuc_v57 === true ? { camDonBay: true } : {}) };
}

/**
 * v34 — VỐN KHỞI ĐIỂM của một ghế theo vai. Thước quy chiếu cho xếp hạng cuối
 * (% tăng trưởng) — cổng tắt hoặc không vai ⇒ START_VON, tức mọi ghế cùng mẫu số
 * và phép chia không đổi thứ tự so với NAV tuyệt đối.
 */
export function vonDauCua(st: TrangThaiTran, g: Ghe): number {
  if (st.vai_co_rang !== true || !g.vai || st.von_deu === true) return HOLDEM_MATCH.START_VON;
  return HOLDEM_MATCH.START_VON * heSoVonCua(g.vai, { vonVaiV57: st.von_vai_v57 === true });
}

/**
 * LÕI GHIM của một vai dưới bộ luật của trận — một cửa cho `taoTran` và mọi chỗ kể lõi ghim.
 * v54 (D389, `loiGon`): lõi ghim rơi vào `LOI_BI_CAT` (hôm nay: Đa Dạng Hoá của TỔ CHỨC) thì
 * vai thôi ghim — không ghim một lá đã rời shop. Đội lái (Lướt Sóng) và cá mập (Đòn Bẩy) giữ.
 */
export function loiGhimCua(vai: VaiId, luat: { loiGon?: boolean; traitGhimMinigame?: boolean }): string | null {
  // D482 — khung minigame: lõi là thứ CHƠI trong màn, phải tự chọn ⇒ vai thôi ghim lõi (lá ghim thành trait ghim, `TRAIT_VAI_MINIGAME`).
  if (luat.traitGhimMinigame === true) return null;
  const l = VAI[vai].loi_ghim;
  if (l !== null && luat.loiGon === true && (LOI_BI_CAT as readonly string[]).includes(l)) return null;
  return l;
}

/**
 * BẢNG VAI THEO BỘ LUẬT — cho catalog (sảnh · Bách khoa) và cho TỪNG TRẬN (`vai_bang` của DTO — lời chào vai ·
 * nút vai ở chợ). v54: vốn đều ⇒ hệ số 1; lõi đã cắt ⇒ không ghim. Khoá cũ trả đúng số trong `VAI`.
 * D406 — câu chữ theo luật luôn: vốn đều ⇒ `CHU_VAI_VON_DEU`, vai mất lõi ghim ⇒ `CHU_VAI_MAT_LOI_GHIM` (vai.ts).
 */
export function vaiTheoLuat(luat: { vonDeu?: boolean; loiGon?: boolean; traitGhimMinigame?: boolean; toChucV57?: boolean; vonVaiV57?: boolean }): Record<VaiId, Vai> {
  return Object.fromEntries(Object.values(VAI).map((v) => {
    const ghim = loiGhimCua(v.id, luat);
    return [v.id, {
      ...v,
      he_so_von: heSoVonCua(v.id, luat),
      loi_ghim: ghim,
      ...(luat.vonDeu === true ? CHU_VAI_VON_DEU[v.id] : {}),
      ...(v.loi_ghim !== null && ghim === null ? CHU_VAI_MAT_LOI_GHIM[v.id] : {}),
      ...(luat.traitGhimMinigame === true ? CHU_VAI_TRAIT_GHIM[v.id] : {}),
      ...(luat.toChucV57 === true ? CHU_VAI_TO_CHUC_V57[v.id] : {}),
    }];
  })) as Record<VaiId, Vai>;
}

export type MucDongTien = 'vang' | 'vua' | 'dong';

/**
 * v34 — DÒNG TIỀN THÔ của cả bàn: mỗi mã đang VẮNG / VỪA / ĐÔNG, đọc từ cùng
 * `demNguoiNam` mà crowding dùng. Đặc quyền thông tin của TỔ CHỨC (D67 chốt:
 * hiện THÔ, không hiện SỐ — đủ để suy luận, không đủ để sao chép; cấm gắn tên).
 * Thuần, không đổi chip — không cần cổng, nhưng API chỉ phát cho ghế tổ chức.
 */
export function dongTienThoCua(st: TrangThaiTran): Record<string, MucDongTien> {
  const songSot = st.ghe.filter((x) => conTrongTran(x)).length;
  const ra: Record<string, MucDongTien> = {};
  for (const t of TAI_SAN) {
    const dong = demNguoiNam(st.ghe, t.id);
    const tyLe = tyLeDongBp(dong, songSot);
    ra[t.id] = dong <= 1 ? 'vang' : tyLe < 5000 ? 'vua' : 'dong';
  }
  return ra;
}

export function trungViSo(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
}

export function loiSuatCongKhai(
  st: TrangThaiTran, o: OThiTruong,
): Record<string, number> {
  const gheAo: Ghe = {
    id: '__ao__', loai: 'bot', bac_rank: '', von: 0, luot_khao_sat: 0,
    danh_muc: { tai_san: TAI_SAN.map((t) => t.id), chien_thuat: [], gan: {} },
    da_chay: false, vong_chay: null, tu_the: 'choi', vong_roi: null,
    so_lan_cat_lo: 0, vi_the: {},
  };
  const { chain } = dungChuoi(st, gheAo, o);
  const ra: Record<string, number> = {};
  for (const t of TAI_SAN) ra[t.id] = 0;
  for (const m of chain) {
    if (!KIND_NAV_THEO_MA.has(m.kind) || KIND_RIENG_GHE.has(m.kind)) continue;
    const ma = (m as { id?: string; ma?: string }).id ?? (m as { ma?: string }).ma;
    if (ma !== undefined && ma in ra) ra[ma] = (ra[ma] ?? 0) + m.delta_bp;
  }
  return ra;
}

/**
 * Trừ `so` chip KHỎI VỊ THẾ theo tỷ lệ (cả sổ dài lẫn sổ khống), phần dư floor
 * dồn vào mã lớn nhất (hoà thì id nhỏ) — tất định cho replay. Đây là khối v14/v17
 * của phí quản lý nền, tách ra để mọi khoản "trừ thẳng Vốn" dùng CHUNG (D61).
 * Trả về số chip đã trừ được (≤ `so` nếu vị thế không đủ).
 */
function truViTheProRata(g: Ghe, so: number): number {
  if (so <= 0) return 0;
  const soHop: Record<string, number> = {
    ...g.vi_the,
    ...Object.fromEntries(Object.entries(g.vi_the_khong ?? {})
      .map(([ma, v]) => [`khong:${ma}`, v])),
  };
  const tongVi = Object.values(soHop).reduce((a, b) => a + b, 0);
  if (tongVi <= 0) return 0;
  const thieu = Math.min(so, tongVi);
  const mas = Object.keys(soHop).sort();
  const doc = (ma: string): number => (ma.startsWith('khong:')
    ? (g.vi_the_khong?.[ma.slice(6)] ?? 0) : (g.vi_the[ma] ?? 0));
  const ghi = (ma: string, v: number): void => {
    if (ma.startsWith('khong:')) {
      const goc = ma.slice(6);
      if (v <= 0) delete g.vi_the_khong?.[goc];
      else if (g.vi_the_khong) g.vi_the_khong[goc] = v;
    } else if (v <= 0) delete g.vi_the[ma];
    else g.vi_the[ma] = v;
  };
  let daTru = 0;
  for (const ma of mas) {
    const phan = Math.floor((doc(ma) * thieu) / tongVi);
    ghi(ma, doc(ma) - phan);
    daTru += phan;
  }
  let du = thieu - daTru;
  while (du > 0) {
    const lon = [...mas].sort((a, b) => (doc(b) - doc(a)) || (a < b ? -1 : 1))[0]!;
    const tru = Math.min(du, doc(lon));
    if (tru <= 0) break;
    ghi(lon, doc(lon) - tru);
    du -= tru;
  }
  return thieu - du;
}

/**
 * v34 — TRỪ THẲNG VỐN TỪ NAV: tiền mặt trước, thiếu thì pro-rata vào vị thế.
 *
 * ⚠ Vì sao phải có: mọi khoản "trừ thẳng Vốn" trước đây (gọi ký quỹ D37) viết
 * `min(g.von, mat)` — tức trừ từ TIỀN MẶT. Ai all-in 100% có 0 tiền mặt ⇒ KHÔNG
 * BAO GIỜ bị phạt. Cái giá dựng để phạt người ôm Đòn Bẩy lại tránh được bằng
 * cách ôm MẠNH HƠN — ngược hẳn ý D37. Đo được khi viết test SIẾT: đội lái
 * all-in đúng ô pháp lý, siết ra RỖNG. Trả về số đã trừ.
 */
function truVonTuNav(g: Ghe, so: number): number {
  const tuTienMat = Math.min(g.von, so);
  g.von -= tuTienMat;
  const conThieu = so - tuTienMat;
  if (conThieu <= 0) return tuTienMat;
  g.vi_the = { ...g.vi_the };
  if (g.vi_the_khong) g.vi_the_khong = { ...g.vi_the_khong };
  return tuTienMat + truViTheProRata(g, conThieu);
}

export function chotPhien(
  st: TrangThaiTran, ttCuoc: TrangThaiCuoc,
): {
  trangThai: TrangThaiTran; ketQua: KetQuaVong;
  /**
   * 12/09 (Q3 — liên kết nhìn thấy) — BẢNG LỢI SUẤT CÔNG KHAI của vòng (bp theo
   * mã, đủ MỌI mã trên bảng), chính là `loiSuatCongKhai(st, o)` mà hàm này đã
   * tính cho Brier/`cho_bp` từ D102. Nay trả ra để client vẽ "cái gì động cùng
   * cái gì" sau chốt. ⚠ ĐỨNG NGOÀI `ketQua` có chủ ý: golden replay ghim
   * `ketQuaCuoi` byte-hệt (A11.3); một trường mới trong đó là viết lại ảnh chụp
   * của mọi trận cũ. Vắng ở trận không NAV.
   */
  loiSuatCong?: Record<string, number>;
  /**
   * D402 — PHẦN QUỸ VÒNG TỪNG GHẾ NHẬN (tổng mọi pot), chỉ ghế nhận > 0, xếp ĐÚNG thứ tự chia (lãi/lỗ vòng giảm dần,
   * phá hoà như vòng chia) — `hang` 1 là suất lớn nhất. Client vẽ xu bay từ GIẢI về từng ghế (C4: số của server).
   * ⚠ ĐỨNG NGOÀI `ketQua` có chủ ý, cùng lý do `loiSuatCong`: golden replay ghim `ketQuaCuoi` byte-hệt (A11.3).
   * Vắng khi không ai nhận gì (quỹ 0).
   */
  chiaQuy?: readonly { ghe_id: string; hang: number; tien: number; /** D584 — xu trait của suất (khoá `giai_xu`; tien = 0). */ xu?: number }[];
} {
  /*
   * ⭐⭐ D382 — LÁ QUYẾT TOÁN VÒNG N LÀ `o[N]`, KHÔNG PHẢI `o[N-1]`.
   *
   * Founder 22/09: *"vòng này đoán kết quả vòng sau > lựa chọn > vòng sau hiển thị kết
   * quả của chính vòng đó"*, và *"vòng 1 có ảnh hưởng gì đâu ngoài thiết lập trạng thái
   * vĩ mô và mở đầu chuỗi"*. `o[0]` vì thế KHÔNG tính tiền cho vòng nào.
   * ⚠ ĐÂY LÀ DÒNG BA CÚ VÁ TRƯỚC ĐÓ KHÔNG DÁM CHẠM. Chúng chỉ đổi lá nào HIỆN RA lúc nào,
   * nên lá bị nhìn thấy vẫn là lá tính tiền ⇒ vừa lộ đáp án vừa hết lá để lật.
   */
  const o = st.map.o[st.o_up === true ? st.vong : st.vong - 1];
  if (!o) throw new Error(`Vòng ${st.vong} vượt quá map ${st.map.o.length} ô`);

  const ghe = st.ghe.map((g) => ({ ...g, danh_muc: { ...g.danh_muc } }));
  const vonTruoc = new Map(ghe.map((g) => [g.id, g.von]));

  // Trừ phần đã góp khỏi vốn.
  for (const g of ghe) {
    const gop = ttCuoc.gop.get(g.id) ?? 0;
    if (st.nen_nav === true && gop > g.von) {
      /*
       * v14 (founder chốt B) — nền là PHÍ QUẢN LÝ trên NAV: tiền mặt trước,
       * thiếu trừ PRO-RATA vào vị thế. KHÔNG trượt giá — đây là phí, không
       * phải lệnh bán. Phần dư floor trừ vào mã lớn nhất (hoà thì id nhỏ) —
       * tất định cho replay. gop ≤ NAV theo sức đóng ở choiVongCuoc nên phần
       * thiếu luôn phủ được bằng vị thế.
       */
      let thieu = gop - g.von;
      g.von = 0;
      // v17 — nền trừ pro-rata trên CẢ HAI SỔ (dài + khống): all-in khống
      // cũng không né được phí quỹ, cùng luật founder chốt B. (Khối trừ tách
      // thành `truViTheProRata` 22/08 để SIẾT/ký quỹ v34 dùng chung — D61.)
      truViTheProRata(g, thieu);
    } else {
      g.von -= gop;
    }
  }

  const { pots, tra_lai: traLai, gop_theo_pot: gopTheoPot } = chiaPotDayDu(ttCuoc.gop, ttCuoc.daBo);
  for (const [id, v] of traLai) {
    const g = ghe.find((x) => x.id === id);
    if (g) g.von += v;
  }
  /*
   * ── v10 NAV — hai việc phải làm Ở ĐÂY, trước mọi khoản phí ─────────────────
   * 1. Đổ phí + trượt giá giao dịch của vòng vào pot (D40: Quỹ vòng nuôi bằng
   *    phí + trượt giá; nền giữ tạm tới khi founder chốt cỡ Quỹ — spec 01 §6.2).
   * 2. Chụp NAV từng ghế làm MỐC ĐO TĂNG TRƯỞNG vòng — sau khi nộp nền (phí là
   *    thật, tính vào), trước định giá.
   */
  if (st.nav === true && (st.phi_giao_dich_vong ?? 0) > 0) {
    const cuoi = pots[pots.length - 1];
    if (cuoi) cuoi.so_tien += st.phi_giao_dich_vong!;
  }
  const quyVong = pots.reduce((x, p) => x + p.so_tien, 0);
  const navTruocVong = st.nav === true
    ? new Map(ghe.map((g) => [g.id, navCua(g)])) : null;

  // ── PHÍ GIỮ TIỀN của người ĐỨNG NGOÀI ───────────────────────────────────
  // Vốn đóng băng KHÔNG có nghĩa là vốn an toàn. Xem PHI_DUNG_NGOAI: không có
  // khoản này thì bỏ bài sớm rồi ngồi im là nước đi mạnh nhất, và cả cơ chế
  // poker vừa dựng tự vô hiệu.
  const laLamPhat = o.kind === 'su_kien' && o.su_kien === 'lam_phat';
  const phiDungNgoai: { ghe_id: string; mat: number }[] = [];
  // v42 (D311) — hai sổ dòng tiền mới của vòng, đổ vào KetQuaVong ở cuối hàm.
  const couponVong: { ghe_id: string; ma: string; tien: number; khong: number }[] = [];
  const quanLyVong: { ghe_id: string; nav: number; tien: number }[] = [];
  /** v46 (D338) — số tiền VAY (giá trị trước khi giá chạy) của từng ghế đang cầm Đòn Bẩy. */
  const vayDonBay = new Map<string, number>();
  const laiVayVong: { ghe_id: string; vay: number; lai_bp: number; lai: number }[] = [];
  const tienMatSuKienVong: {
    ghe_id: string; mat: number;
    chi_tiet: { su_kien: string; delta_bp: number; dao: boolean }[];
  }[] = [];
  const tietKiemVong: {
    ghe_id: string; loai: 'lai' | 'dao_han' | 'huy' | 'lam_phat' | 'do_vo';
    id: string; goc: number; lai: number; lai_mat?: number; mat?: number;
  }[] = [];
  for (const g of ghe) {
    if (g.tu_the !== 'dung_ngoai' || g.da_chay) continue;
    /*
     * v42 (D311) — MỘT NGUỒN: khi `tien_mat_su_kien` bật, khoản lạm phát của ghế
     * đứng ngoài do hàng `TIEN_MAT_SU_KIEN` lo (áp cho MỌI ghế còn trong trận,
     * kể cả ghế này), nên ở đây THÔI cộng `LAM_PHAT_BP`. Giữ cả hai là thu hai
     * lần đúng vào người đang bị phạt nặng nhất (D61).
     */
    const congLamPhat = laLamPhat && st.tien_mat_su_kien !== true;
    const bp = PHI_DUNG_NGOAI.NEN_BP + (congLamPhat ? PHI_DUNG_NGOAI.LAM_PHAT_BP : 0);
    const mat = Math.min(g.von, applyBpInt(g.von, bp));
    if (mat <= 0) continue;
    g.von -= mat;
    phiDungNgoai.push({ ghe_id: g.id, mat });
  }

  // ── D2 — PHÍ CẮT LỖ VỀ CASH ─────────────────────────────────────────────
  /*
   * Trước D2, bỏ vòng này là MIỄN PHÍ: mất phần quỹ vòng, mà chưa đặt thì cũng
   * chẳng mất gì. Nên hễ ô sắp lật trông xấu là bỏ luôn — rủi ro 0, chi phí 0,
   * một nước đi trội gần như tuyệt đối. Đó là chỗ chiều sâu bị rút ruột: người
   * chơi không phải CÂN gì cả.
   *
   * Nay bán tháo cả danh mục trong một nhịp thì ăn trượt giá (rút khẩn), và giữ
   * tiền mặt qua vòng thì mất giá (lạm phát vòng, lever D20). Cắt lỗ trở thành
   * quyết định có giá, không phải nút thoát.
   *
   * GIẪM ĐẠP đo bằng TỶ LỆ lobby (D3), không bằng đầu người: "≥30% cùng chạy"
   * phải nghĩa như nhau ở bàn 4 và bàn 8.
   */
  const songSotBo = ghe.filter((g) => conTrongTran(g)).length;
  const soBo = ghe.filter((g) => !g.da_chay && ttCuoc.daBo.has(g.id)).length;
  const tyLeCatLoBp = tyLeBp(soBo, songSotBo);
  /*
   * ⚠ GIẪM ĐẠP CẦN ÍT NHẤT HAI NGƯỜI. Chỉ xét tỷ lệ là chưa đủ: ở bàn nhỏ một
   * người bỏ đã vượt 30% (1/2 = 50%), và "bị giẫm đạp bởi chính mình" là vô
   * nghĩa — giẫm đạp là chuyện ĐÁM ĐÔNG cùng chạy một cửa. Test bàn 2 ghế bắt
   * được điều này ngay vòng đầu.
   */
  const giamDap = soBo >= 2 && tyLeCatLoBp >= CAT_LO_VE_CASH.NGUONG_GIAM_DAP_BP;
  const phiCatLo: { ghe_id: string; mat: number; giam_dap: boolean }[] = [];
  for (const g of ghe) {
    if (g.da_chay || !ttCuoc.daBo.has(g.id)) continue;
    // Người ĐỨNG NGOÀI đã chịu phí riêng ở trên — không thu hai lần cùng một
    // hành vi. Họ không "vừa cắt lỗ", họ đã rời trận từ trước.
    if (g.tu_the === 'dung_ngoai' || g.tu_the === 'dau_hang') continue;
    /*
     * D33 — ĐẶC QUYỀN KHỚP NHANH, VẾ "BỎ BÀI / THOÁT HÀNG".
     *
     * Chỉ che phần RÚT KHẨN (bán tháo cả danh mục trong một nhịp → trượt giá),
     * KHÔNG che phần LẠM PHÁT VÒNG. Hai khoản này cố ý tách đôi trong
     * `CAT_LO_VE_CASH` vì chúng là hai thứ khác nhau: một là trượt giá — đúng họ
     * mà lá này che — còn một là chi phí giữ tiền mặt, mà hạ tầng khớp lệnh
     * nhanh thì không làm tiền mặt bớt mất giá. Che cả hai là biến Khớp Nhanh
     * thành lá "bỏ bài rẻ", tức lại thưởng cho nước đi mà D2 vừa dựng giá cho.
     */
    const rutKhan = st.dac_quyen === true
      && g.danh_muc.chien_thuat.includes('khop_nhanh')
      ? applyBpInt(CAT_LO_VE_CASH.PHI_RUT_KHAN_BP,
        DAC_QUYEN.KHOP_NHANH.RUT_KHAN_CON_BP)
      : CAT_LO_VE_CASH.PHI_RUT_KHAN_BP;
    let bp = CAT_LO_VE_CASH.PHI_LAM_PHAT_BP + rutKhan;
    if (giamDap) bp = applyBpInt(bp, CAT_LO_VE_CASH.GIAM_DAP_BP);
    const mat = Math.min(g.von, applyBpInt(g.von, bp));
    if (mat <= 0) continue;
    g.von -= mat;
    g.so_lan_cat_lo += 1;
    phiCatLo.push({ ghe_id: g.id, mat, giam_dap: giamDap });
  }

  /*
   * ── LÕI VỐN B — CHẤM BẺ KÈO TRƯỚC KHI CHẤM ĐIỂM ─────────────────────────
   *
   * Phải ở đây chứ không trong `dungChuoi`: một trong hai đường bẻ kèo là BỎ BÀI,
   * mà chỉ vòng cược mới biết ai đã rút. Đánh dấu lên ghế rồi để `dungChuoi` đọc
   * là cách giữ cho hàm chấm điểm vẫn thuần theo (state, ghế, ô) — cùng khuôn
   * với `da_cat_lo` bên dưới.
   */
  if (st.luat_von) {
    for (const g of ghe) {
      const boBai = ttCuoc.daBo.has(g.id)
        || g.tu_the === 'dung_ngoai' || g.tu_the === 'dau_hang';
      if (beKeo(g, st.vong, boBai)) g.be_keo_vong = st.vong;
    }
  }

  /*
   * D102 — bảng lợi suất CÔNG KHAI của vòng: giống nhau cho MỌI ghế, nên dựng
   * một lần ở đây thay vì trong vòng lặp. Chỉ trận NAV mới cần (Brier chỉ tính
   * ở đó), và ghế ảo không vào `st.ghe` nên không đụng crowding của ai.
   */
  const loiSuatCong = st.nav ? loiSuatCongKhai(st, o) : null;
  /** TRUNG VỊ lợi suất công khai = "chợ" đổi bao nhiêu. Xem `KetQuaVong.cho_bp`. */
  const choBp = loiSuatCong ? trungViSo(Object.values(loiSuatCong)) : null;

  // PnL của mọi ghế còn sống (kể cả người đã bỏ — để hiện lãi lỗ danh mục).
  const ketQua: KetQuaGhe[] = [];
  const phiDonBay: { ghe_id: string; mat: number }[] = [];
  for (const g of ghe) {
    if (g.da_chay) continue;
    const { chain, pnl_bp } = dungChuoi({ ...st, ghe }, g, o);
    /*
     * ── D35 HƯỚNG 1 — CAM KẾT THÀNH ĐÒN BẨY ────────────────────────────────
     *
     * Đặt ĐÚNG ở đây: sau `dungChuoi` (đã có PnL danh mục) và TRƯỚC `pnlCua`
     * (bản đồ dùng để sắp hạng chia pot). Đặt sau `pnlCua` là cơ chế trang
     * trí kinh điển — số vẫn tính ra, vẫn có test, mà thứ hạng không đổi.
     */
    const camKet = ttCuoc.gop.get(g.id) ?? 0;
    const vonDau = vonTruoc.get(g.id) ?? 0;
    const db = apDonBayCamKet(st, g, pnl_bp, camKet, vonDau);
    const day: readonly MatXich[] = db.mat_xich ? [...chain, db.mat_xich] : chain;
    // Phí tài trợ — lực đối trọng (3), khoản DUY NHẤT chạm Vốn. Trừ TRƯỚC khi
    // chia pot để nó tính được vào ngưỡng cháy của chính vòng này.
    if (db.phi > 0) {
      const mat = Math.min(g.von, db.phi);
      g.von -= mat;
      (db as { phi: number }).phi = mat;
      phiDonBay.push({ ghe_id: g.id, mat });
    }
    /*
     * ── v10 NAV — GIÁ CẮN VÀO VỊ THẾ (chỗ "Vốn đứng im" chết) ───────────────
     * Tách chuỗi làm hai tầng rồi áp qua `apDinhGia`:
     * · mắt xích CÓ MÃ (`tangCuaMatXich`) → phần riêng từng mã; v49: tầng KHỐNG → sổ khống;
     * · còn lại (thẻ chiến thuật · sự kiện thẻ · phần khẩu vị của danh mục) → phần DANH MỤC, áp
     *   trên tổng SAU tầng riêng. Danh mục rỗng thì phần này áp lên 0 — không
     *   cầm gì thì không có gì để hưởng hay chịu.
     * `pnl_bp` của ghế sẽ bị GHI ĐÈ bằng tăng trưởng NAV ở khối dưới seat-loop
     * — chuỗi bp ở đây còn vai trò GIẢI THÍCH, thước đo là tiền.
     */
    let tienTheoMa: Record<string, number> | undefined;
    let brier: number | null | undefined;
    let viTheKyNgo: Record<string, number> | undefined;
    let loiSuatKyNgo: Record<string, number> | undefined;
    if (st.nav === true) {
      const theoMa: Record<string, number> = {};
      /** v49 (D342) — lợi suất RIÊNG của sổ khống theo mã (tầng khống của `tangCuaMatXich`). */
      const khongTheoMa: Record<string, number> = {};
      let rDanhMuc = 0;
      for (const m of day) {
        // Luật xếp tầng ở `tangCuaMatXich` — MỘT nguồn dùng chung với `dungChuoi` bước 6 (D61).
        const t = tangCuaMatXich(st, m);
        if (t.tang === 'ma') theoMa[t.ma] = (theoMa[t.ma] ?? 0) + m.delta_bp;
        else if (t.tang === 'khong') khongTheoMa[t.ma] = (khongTheoMa[t.ma] ?? 0) + m.delta_bp;
        else rDanhMuc += m.delta_bp;
      }
      if (st.lai_vay_don_bay === true) {
        // Giá trị các vị thế ĐANG được nhân — chụp TRƯỚC `apDinhGia` (tiền đã vay đầu ô).
        const vay = dichDonBayTheoMa(st, g, day).reduce(
          (t, x) => t + (g.vi_the[x] ?? 0) + (g.vi_the_khong?.[x] ?? 0), 0);
        if (vay > 0) vayDonBay.set(g.id, vay);
      }
      /*
       * CHỤP vị thế TRƯỚC khi định giá — `apDinhGia` ghi đè `g.vi_the`. Brier
       * chấm NIỀM TIN lúc vào lệnh, không chấm kết quả sau khi giá đã chạy.
       */
      const viTheTruoc = { ...g.vi_the };
      // v49 (D342) — cổng bật ⇒ sổ khống đọc bảng riêng; tắt ⇒ đảo dấu bảng sổ dài như v17–v48.
      tienTheoMa = apDinhGia(g, theoMa, rDanhMuc,
        st.khong_theo_gia === true ? khongTheoMa : undefined).tien_theo_ma;
      /*
       * v42 (D311) — COUPON, NGAY SAU định giá và VẪN TRONG seat-loop.
       * Sau định giá vì lãi trả trên giá trị vị thế đã chạy giá của vòng này;
       * trước `apLamPhat` vì coupon là tiền VÀO ví, còn lạm phát bào cái ví ấy —
       * nhận rồi mới bị bào, đúng thứ tự ngoài đời.
       * ⚠ KHÔNG đẩy vào `MatXich`: coupon là dòng tiền, không phải mắt xích GIÁ.
       * Nhét vào chuỗi giá là nó chui vào `pnl_bp` hai lần (một qua NAV, một qua
       * chuỗi) và bảng VÌ SAO sẽ cộng sai.
       */
      for (const c of apCoupon(g, couponBpCua(st), st.coupon_giu_du === true)) {
        couponVong.push({ ghe_id: g.id, ...c });
      }
      /*
       * D498 — PHÍ QUẢN LÝ của TỔ CHỨC (founder 04/10 nhận đền bù "cả 3"): như coupon — dòng tiền VÀO ví, sau định giá, trước lạm phát; tính trên NAV
       * sau định giá của vòng, bất kể lời lỗ (ngoài đời: quỹ thu phí quản lý cố định). Không vào chuỗi giá (cùng lý do coupon).
       */
      if (st.to_chuc_v57 === true && st.vai_co_rang === true && g.vai === 'to_chuc') {
        const nav = navCua(g), tien = Math.floor((nav * TO_CHUC_V57.PHI_QL_BP) / 10000);
        if (tien > 0) { g.von += tien; quanLyVong.push({ ghe_id: g.id, nav, tien }); }
      }
      /*
       * ⚠ D102 — BẢNG CÔNG KHAI, KHÔNG PHẢI `theoMa` CỦA GHẾ NÀY.
       *
       * `theoMa` chỉ có mã ghế ĐANG CẦM (dungChuoi lặp đúng chừng đó), nên bản
       * cũ `theoMa[t.id] ?? 0` gán 0 cho mọi mã không cầm — biến Brier thành
       * thước THƯỞNG việc ôm một mã. Xem `loiSuatCongKhai` để biết đủ.
       * Dựng MỘT lần mỗi vòng (ngoài vòng lặp ghế), vì nó không phụ thuộc ghế.
       */
      brier = brierVong(viTheTruoc, loiSuatCong ?? {});
      viTheKyNgo = viTheTruoc;
      /*
       * `loi_suat_ma` trên DTO nay là bảng CÔNG KHAI — người chơi phải đọc được
       * mình bị chấm theo cái gì. Trước D102 nó là bảng riêng ghế, tức màn hình
       * nói một đằng còn thước chấm một nẻo.
       */
      loiSuatKyNgo = loiSuatCong ?? undefined;
    }

    ketQua.push({
      ghe_id: g.id, pnl_bp: db.pnl_bp, chain: day,
      ...(tienTheoMa ? { tien_theo_ma: tienTheoMa } : {}),
      ...(brier !== undefined ? { brier } : {}),
      ...(viTheKyNgo ? { vi_the_truoc: viTheKyNgo } : {}),
      ...(loiSuatKyNgo ? { loi_suat_ma: loiSuatKyNgo } : {}),
      da_cat_lo: ttCuoc.daBo.has(g.id),
      cam_ket: camKet,
      von_truoc: vonDau,
      von_sau: 0,
      ty_le_cam_ket_bp: db.ty_le_bp,
      he_so_don_bay_bp: db.he_so_bp,
      phi_don_bay: db.phi,
    });

    /*
     * SỔ CÁI CHU KỲ KHOÁ — cộng dồn từ CHÍNH mắt xích vừa sinh ra, không tính lại.
     *
     * Đây là chỗ dễ đẻ ra hai nguồn chân lý nhất: nếu thu hồi đọc một công thức
     * còn chi trả đọc một công thức khác thì có ngày chúng lệch, và người chơi
     * không có cách nào biết mình vừa bị thu hồi bao nhiêu.
     */
    /*
     * D33 — DỌN LỆNH SHORT ĐÃ KHỚP. Đặt ở vòng V thì khớp ở V+1 rồi hết hiệu
     * lực; không dọn thì `shortKhopO` vẫn trả null ở các vòng sau (điều kiện là
     * `vong_dat === vong - 1`), nhưng dấu vết cũ sẽ chặn `apDatShort` hiểu sai
     * "đã đặt vòng này" và làm UI hiện một vị thế không còn tồn tại.
     */
    if (g.short && g.short.vong_dat <= st.vong - 1) delete g.short;

    // Cổng hỏi lại ở đây nữa: state của trận CŨ không bao giờ mang `khoa`, nhưng
    // một cổng chỉ đúng khi nó đóng ở MỌI cửa, không phải ở cửa ta nhớ ra.
    if (!st.luat_von) continue;
    const k = khoaDangChay(g, st.vong);
    if (!k) continue;
    if (g.be_keo_vong === st.vong) {
      // Kèo đã gãy: đóng chu kỳ (không phạt lây vòng sau) và giam vốn vòng kế.
      delete g.khoa;
      g.giam_von_den_vong = st.vong + KHOA_TAI_SAN.GIAM_VON_SO_VONG;
      continue;
    }
    const them = chain.reduce(
      (s, m) => (m.kind === 'khoa_thuong' ? s + m.delta_bp : s), 0);
    if (them !== 0) g.khoa = { ...k, thuong_bp: k.thuong_bp + them };
    // Giữ trọn lời hứa tới vòng chốt ⇒ chu kỳ hoàn tất, mở đường khoá lượt mới.
    if (laVongChotKhoa(k, st.vong)) delete g.khoa;
  }
  /*
   * ── v10 NAV — LẠM PHÁT rồi GHI ĐÈ pnl BẰNG TĂNG TRƯỞNG NAV ────────────────
   * Thứ tự theo spec 01 §3: định giá (trong seat-loop) → lạm phát tiền mặt →
   * đo tăng trưởng → chia quỹ. Ghi đè `pnl_bp` TRƯỚC khi dựng `pnlCua` nghĩa là
   * phần chia quỹ bên dưới TỰ ĐỘNG xếp theo % tăng trưởng vòng — đúng cần hãm
   * kẻ dẫn đầu D40 §4 — mà không phải viết đường chia thứ hai. Mọi cơ chế đọc
   * `pnl_bp` sau điểm này (gọi ký quỹ · FX ghế · khoảnh khắc lớn) đều đo trên
   * NAV thật: %s trên màn và tiền trong túi hết đường cãi nhau (bệnh D35).
   */
  if (st.nav === true && navTruocVong) {
    for (const g of ghe) {
      if (!g.da_chay && conTrongTran(g)) {
        apLamPhat(g);
        /*
         * v17 — phí giữ khống MỖI VÒNG (funding). Doc 05 định vào Quỹ vòng,
         * nhưng ở điểm này pot đã gộp xong — v1 ĐỐT như lạm phát (cùng bản
         * chất: chi phí giữ một trạng thái), ghi chú lệch-doc có chủ đích.
         * Nếu đo thấy cần chuyển vào quỹ thì dời điểm thu lên trước gộp pot.
         */
        apPhiGiuKhong(g);
        /*
         * v46 (D338) — LÃI VAY ĐÒN BẨY. Cùng khuôn phí giữ khống: chi phí giữ một trạng
         * thái, ĐỐT (pot đã gộp xong ở điểm này). Trừ bằng `truVonTuNav` — tiền mặt trước,
         * thiếu thì bán bớt vị thế — để all-in không né được lãi (bài học v34 của gọi ký quỹ).
         */
        const vay = vayDonBay.get(g.id);
        if (vay !== undefined) {
          const laiBp = laiVayDonBayBp(laiSuatLuc(st) ?? LAI_SUAT_NEN.KHOI_DIEM);
          const phai = laiMoiO(vay, laiBp);
          const lai = phai > 0 ? truVonTuNav(g, phai) : 0;
          laiVayVong.push({ ghe_id: g.id, vay, lai_bp: laiBp, lai });
        }
      }
    }
    /*
     * v42 (D311) — CÚ SỐC LÊN TIỀN MẶT. Vòng lặp RIÊNG, và điều kiện RỘNG HƠN
     * khối trên: `conTrongTran(g)` gồm cả ghế `dung_ngoai`, vì đứng ngoài không
     * né được lạm phát — đó là cả điểm của cơ chế này.
     * Đứng SAU `apPhiGiuKhong` để tiền mặt đã trừ hết phí của vòng rồi mới bị
     * lạm phát ăn phần trăm — bào trên số dư cuối, không bào hai lần.
     */
    if (st.tien_mat_su_kien === true) {
      for (const g of ghe) {
        if (g.da_chay || !conTrongTran(g)) continue;
        const r = apSuKienTienMat(st, g, o);
        if (r.mat !== 0 || r.chi_tiet.length > 0) {
          tienMatSuKienVong.push({ ghe_id: g.id, mat: r.mat, chi_tiet: r.chi_tiet });
        }
      }
    }
    /*
     * v43 (D314) — SỔ TIẾT KIỆM: cộng lãi, và tất toán hợp đồng tới hạn.
     *
     * Đứng SAU cú sốc tiền mặt vì tiền trong sổ MIỄN lạm phát — chính là mục đích của
     * cơ chế. Đặt trước thì lãi vừa cộng lại bị lạm phát ăn ngay trong cùng vòng, và
     * lời hứa "gửi để tránh lạm phát" thành nói dối.
     *
     * ⚠ `lai` KHÔNG vào tiền mặt — nó cộng vào `lai_don` và chỉ ra ví lúc đáo hạn. Nhưng
     * nó ĐÃ nằm trong NAV ngay từ lúc cộng (xem `navCua`), nên người chơi thấy tài sản
     * mình nhích lên đều chứ không nhảy cục vào ngày cuối.
     * ⚠ Ghế `dung_ngoai` VẪN được cộng lãi và vẫn đáo hạn: họ còn trong trận, hợp đồng
     * là một lời hứa của bàn với họ. Chỉ `dau_hang` mới bị tất toán như huỷ (`doiTuThe`).
     */
    if (st.ngan_hang === true) {
      /*
       * v54 (D405) — SỔ CHỊU NỀN KINH TẾ: ba bước TRƯỚC khi cộng lãi; cờ tắt ⇒ bỏ qua cả ba, y hệt v43–v53.
       *  1. LẠM PHÁT ăn GỐC đúng như tiền mặt — nền rồi cú sốc, cùng thứ tự và cùng phép làm tròn với hai khối tiền
       *     mặt ngay trên (`matLamPhatNen` · `bpSuKienTienMat` · `doiTheoBp` — một nguồn, D61);
       *  2. NGÂN HÀNG ĐỔ VỠ (hiếm, `nganHangDoVoTai`) cắt phần vượt hạn mức bảo hiểm, chia về từng hợp đồng theo tỷ lệ
       *     giá trị, dư lẻ vào hợp đồng cuối;
       *  3. LÃI THẢ NỔI: mức ô này theo lãi suất nền đang chạy, ghi lại vào `lai_bp` (màn đọc đúng mức đang áp).
       * Lãi cộng SAU, trên gốc còn lại. Huỷ trả gốc đã bị ăn — không có cửa "huỷ để lấy lại gốc nguyên".
       */
      const bpSoc = st.tiet_kiem_lam_phat === true ? bpSuKienTienMat(st, o).bpTong : 0;
      const doVo = st.ngan_hang_do_vo === true
        && nganHangDoVoTai(st.map.o, st.o_up === true ? st.vong : st.vong - 1);
      const diemNay = laiSuatLuc(st) ?? LAI_SUAT_NEN.KHOI_DIEM;
      for (const g of ghe) {
        if (g.da_chay || !conTrongTran(g)) continue;
        let so = g.tiet_kiem ?? [];
        if (so.length === 0) continue;
        if (st.tiet_kiem_lam_phat === true) {
          so = so.map((h) => {
            const sauNen = h.goc - matLamPhatNen(h.goc);
            const goc = sauNen + doiTheoBp(sauNen, bpSoc);
            const mat = h.goc - goc;
            if (mat !== 0) tietKiemVong.push({ ghe_id: g.id, loai: 'lam_phat', id: h.id, goc, lai: 0, mat });
            return { ...h, goc };
          });
        }
        if (doVo) {
          const truoc = so;
          const tong = truoc.reduce((t, h) => t + h.goc + h.lai_don, 0);
          const mat = matKhiDoVo(tong);
          if (mat > 0) {
            let con = mat;
            so = truoc.map((h, k) => {
              const tyLe = k === truoc.length - 1 ? con : Math.floor((mat * (h.goc + h.lai_don)) / tong);
              const phan = Math.min(h.goc, tyLe);
              con -= phan;
              if (phan > 0) {
                tietKiemVong.push({ ghe_id: g.id, loai: 'do_vo', id: h.id, goc: h.goc - phan, lai: 0, mat: phan });
              }
              return { ...h, goc: h.goc - phan };
            });
          }
        }
        if (st.tiet_kiem_tha_noi === true) so = so.map((h) => ({ ...h, lai_bp: laiTietKiemBp(diemNay, h.so_vong) }));
        const giu: HopDongTietKiem[] = [];
        for (const h of so) {
          const lai = laiMoiO(h.goc, h.lai_bp);
          const donMoi = h.lai_don + lai;
          if (st.vong === h.vong_mo + h.so_vong - 1) {
            g.von += h.goc + donMoi;
            tietKiemVong.push({
              ghe_id: g.id, loai: 'dao_han', id: h.id, goc: h.goc, lai: donMoi,
            });
          } else {
            giu.push({ ...h, lai_don: donMoi });
            tietKiemVong.push({ ghe_id: g.id, loai: 'lai', id: h.id, goc: h.goc, lai });
          }
        }
        g.tiet_kiem = giu;
      }
      // Các cú HUỶ đã xảy ra trong vòng này (do `apHuyTietKiem` ghi lên ghế) đổ ra đây.
      for (const g of ghe) {
        for (const x of g.tk_su_kien_vong ?? []) {
          if (x.vong !== st.vong) continue;
          tietKiemVong.push({
            ghe_id: g.id, loai: 'huy', id: x.id, goc: x.goc, lai: 0, lai_mat: x.lai_mat,
          });
        }
      }
    }
    /*
     * v55 (D422) — SỐ VÒNG GIỮ LIỀN từng mã (vị thế dài > 0 ở cuối vòng) — KIÊN NHẪN / NÓNG VỘI đọc ở vòng sau. Bán sạch
     * một mã là chuỗi của nó đứt; bán bớt không đứt.
     */
    if (st.trait_bat === true) {
      for (const g of ghe) {
        if (g.da_chay || !conTrongTran(g)) continue;
        const cu = g.giu_lien ?? {};
        const moi: Record<string, number> = {};
        for (const [ma, v] of Object.entries(g.vi_the)) if (v > 0) moi[ma] = (cu[ma] ?? 0) + 1;
        g.giu_lien = moi;
      }
    }
    for (const r of ketQua) {
      const g = ghe.find((x) => x.id === r.ghe_id)!;
      const truoc = navTruocVong.get(r.ghe_id) ?? 0;
      const sau = navCua(g);
      r.nav_truoc = truoc;
      r.nav_sau = sau;
      r.pnl_bp = truoc > 0 ? Math.floor(((sau - truoc) * 10000) / truoc) : 0;
    }
  }
  // ── v55 (D409) — NGỌN LỬA ĐÀ + XU, cuối vòng, SAU khi có NAV/lãi lỗ (cổng `lua`). Bias đọc từ vị thế ghế SAU vòng;
  // đổi tay đọc từ sổ `doi_tay_vong`; Mua Đuổi đọc chuỗi tăng người chơi THẤY lúc quyết + có mua vào rủi ro hay không.
  const luaVong: { ghe_id: string; truoc: TrangThaiLua | null; sau: TrangThaiLua; dap: LyDoDap | null; xu_them: number }[] = [];
  if (st.lua === true && st.nav === true) {
    const nhip = nhipChuoiTang(st);
    for (const r of ketQua) {
      const g = ghe.find((x) => x.id === r.ghe_id)!;
      if (g.da_chay || !conTrongTran(g)) continue;
      const rb = st.trait_bat === true ? rangBuocCua(st, g, st.vong) : RANG_BUOC_TRONG;
      const soLoi = capThe(g.danh_muc, 'mua_duoi');
      const muaDuoi = st.lua_mua_duoi === true && soLoi > 0 && (g.doi_tay_vong?.mua_rui_ro ?? 0) > 0 ? nhip : null;
      const ruiRoLai = Object.entries(r.tien_theo_ma ?? {}).reduce((t, [ma, tien]) => (
        TAI_SAN.find((x) => x.id === ma)?.nhom === 'rui_ro' ? t + tien : t), 0) > 0;
      const truocLua = g.lua ?? null;
      // v55 (D422) — MÙ LỬA: lửa luôn tắt (không tích, không dập), xu đều `MU_LUA_XU` mỗi vòng thay cho xu của lửa.
      const kq = rb.muLua
        ? { sau: { nac: 0, chuoi: 0, bias: null } as TrangThaiLua, dap: null, xu: THAM_SO.MU_LUA_XU }
        : capNhatLua({
          truoc: g.lua, biasMoi: biasCua(g, navCua(g)), doiTay: g.doi_tay_vong,
          navDauVong: r.nav_truoc ?? 0, soLoiMuaDuoi: soLoi, muaDuoi, ruiRoLai, giuNhiet: rb.giuNhiet,
        });
      g.lua = kq.sau;
      let xu = kq.xu + (rb.mayXu && kq.sau.nac >= 1 ? LUA.MAY_XU_THEM : 0);
      if (st.nhiem_vu_loi === true) xu += xuNhiemVuLoi(r.chain, g.danh_muc);
      g.xu = (g.xu ?? 0) + xu;
      luaVong.push({ ghe_id: g.id, truoc: truocLua, sau: kq.sau, dap: kq.dap, xu_them: xu });
    }
  }

  const pnlCua = new Map(ketQua.map((r) => [r.ghe_id, r.pnl_bp]));
  /*
   * ⚠⚠ PHÁ HOÀ — CHỖ NÀY TỪNG THIÊN VỊ NGƯỜI CHƠI SUỐT, VÀ KHÔNG AI THẤY.
   *
   * Cũ: `(a < b ? -1 : 1)` — so CHUỖI id ghế. Ghế người tên `'ban'`, bot tên
   * `'bot_1'…`, mà `'ban' < 'bot_1'` = true ⇒ NGƯỜI CHƠI THẮNG MỌI CÚ HOÀ
   * `pnl_bp`, mọi vòng, mọi trận. Chú thích cũ ghi "tất định" — đúng, nhưng
   * tất định KHÔNG có nghĩa là công bằng, và chính chữ đó làm nó qua được mắt.
   * Đo được: lợi thế ~1,34 hạng ở bàn 8 · ~0,56 ở bàn 5 — gấp hơn NĂM LẦN
   * ngưỡng gradient kỹ năng G2 (0,25 hạng).
   *
   * Mới: băm theo (seed, vòng, ghế). Vẫn tất định tuyệt đối — replay ra đúng
   * từng chip — nhưng thứ tự không còn đọc được từ cái TÊN.
   *
   * ⚠ Cổng theo phiên bản: nó ĐỔI KẾT QUẢ của trận đã lưu, nên bản cũ phải
   * replay bằng đúng luật cũ (137 trận trên prod).
   * D402 — dời ra NGOÀI vòng chia pot (nó chỉ phụ thuộc seed · vòng · ghế, không phụ thuộc pot) để `chiaQuy` dùng chung.
   */
  const thuTuHoa = (id: string): number =>
    st.hoa_cong_bang === true
      ? rngAt(st.seed, 'holdem_pha_hoa', st.vong, id).below(1_000_000)
      : 0;
  /**
   * Thứ tự CHIA quỹ giữa hai ghế: lãi/lỗ vòng giảm dần, hoà thì phá theo luật phiên bản (khối PHÁ HOÀ ngay trên).
   * D402 tách thành hàm để `chiaQuy` xếp bằng đúng nó — BIỂU THỨC GIỮ NGUYÊN từng ký tự so với bản inline cũ.
   */
  const thuTuChia = (a: string, b: string): number =>
    ((pnlCua.get(b) ?? -Infinity) - (pnlCua.get(a) ?? -Infinity))
    || (st.hoa_cong_bang === true
      ? thuTuHoa(a) - thuTuHoa(b) || (a < b ? -1 : 1)
      : (a < b ? -1 : 1));
  /** D402 — tổng phần quỹ mỗi ghế nhận qua MỌI pot (để client vẽ giải về ghế — xem `chiaQuy` ở kiểu trả về). */
  const nhanQuy = new Map<string, number>();

  // Chia TỪNG pot cho những người đủ điều kiện tranh pot đó.
  for (let p = 0; p < pots.length; p += 1) {
    const pot = pots[p]!;
    const xep = [...pot.du_tranh].sort(thuTuChia);
    const chia = chiaQuyVong(pot.so_tien, xep.length, st.quy_co_gian === true);
    let nhan = new Map<string, number>();
    for (let i = 0; i < xep.length; i += 1) {
      const phan = chia[i] ?? 0;
      if (phan > 0) nhan.set(xep[i]!, phan);
    }
    // v54 (D403) — trần phần một ghế: phần vượt 50% của pot về lại người đã góp vào nó (xem `kepTranHang1`).
    if (st.quy_tran_hang_1 === true) nhan = kepTranHang1(nhan, pot.so_tien, gopTheoPot[p] ?? new Map());
    for (const [id, phan] of nhan) {
      const g = ghe.find((x) => x.id === id);
      if (g) g.von += phan;
      nhanQuy.set(id, (nhanQuy.get(id) ?? 0) + phan);
    }
  }
  /*
   * D402 — THỨ TỰ NHẬN GIẢI của vòng: ghế có nhận, xếp bằng CHÍNH hàm so sánh vừa chia (một nguồn — D61); `hang` 1 là
   * suất lớn nhất (pot phụ khi có người tất tay ít hơn: tổng mọi pot, thứ tự vẫn theo lãi/lỗ vòng).
   */
  /*
   * D584 — GIẢI VÒNG BẰNG XU TRAIT (khoá `giai_xu`): không có pot (nền 0) ⇒ ghế còn tranh vòng này (còn cược, không bỏ) xếp bằng CHÍNH
   * `thuTuChia` (lãi/lỗ vòng, cùng phá hoà); số suất co giãn như quỹ cũ; suất k nhận `xuGiaiTheoHang(k)` xu trait — không chạm NAV.
   */
  const xuGiai: { ghe_id: string; hang: number; tien: number; xu: number }[] = [];
  if (st.giai_xu === true) {
    const tranh = st.ghe.filter((g) => conCuoc(g) && !ttCuoc.daBo.has(g.id)).map((g) => g.id).sort(thuTuChia);
    const soSuat = trongSoQuyVong(tranh.length, st.quy_co_gian === true).length;
    tranh.slice(0, soSuat).forEach((id, k) => {
      const g = ghe.find((x) => x.id === id);
      const xu = xuGiaiTheoHang(k + 1);
      if (!g || xu <= 0) return;
      g.xu = (g.xu ?? 0) + xu;
      xuGiai.push({ ghe_id: id, hang: k + 1, tien: 0, xu });
    });
  }
  const chiaQuy = st.giai_xu === true ? xuGiai : [...nhanQuy]
    .filter(([, tien]) => tien > 0)
    .sort(([a], [b]) => thuTuChia(a, b))
    .map(([ghe_id, tien], k) => ({ ghe_id, hang: k + 1, tien }));
  const gheThang: string | null = pots.length
    ? ([...pots[pots.length - 1]!.du_tranh].sort((a, b) =>
        (pnlCua.get(b) ?? -Infinity) - (pnlCua.get(a) ?? -Infinity))[0] ?? null)
    : null;

  for (const r of ketQua) {
    (r as { von_sau: number }).von_sau = ghe.find((g) => g.id === r.ghe_id)?.von ?? 0;
  }

  // ── T6 — GỌI KÝ QUỸ ─────────────────────────────────────────────────────
  // Đòn Bẩy + Hack sàn + lỗ sâu = không thoát được lệnh, bị siết margin.
  // KHÔNG phân biệt tin thật/giả: hack sàn dựng cũng gây hoảng loạn thanh lý,
  // và giữ vậy thì cơ chế này không lộ cờ tin giả ra ngoài.
  const goiKyQuy: { ghe_id: string; mat: number }[] = [];
  /*
   * ── D37 — NỚI RỘNG CỬA NỔ (v8) ────────────────────────────────────────────
   *
   * Trước v8, điều kiện là `o.su_kien === 'hack_san'`, tức cơ chế DUY NHẤT trừ
   * Vốn của người cầm Đòn Bẩy chỉ nổ ở ~5% số ô. Đó là lý do đo ra lá này gần
   * như là ×2 không có mặt sau (nhất 34,6% vs 14,8% của ô trống).
   *
   * Nay ô THƯỜNG cũng gọi ký quỹ, ngưỡng nông hơn và mất ít hơn; `hack_san` giữ
   * nguyên mức nặng của nó. Xem `GOI_KY_QUY` để biết vì sao đây là cần gạt KỸ
   * NĂNG: hình phạt TRÁNH ĐƯỢC bằng cách hạ đòn bẩy trước vòng xấu, và vế LÃI
   * không bị đụng một bp nào.
   */
  const hackSan = o.kind === 'su_kien' && o.su_kien === 'hack_san';
  if (hackSan || st.ky_quy_rong === true) {
    const nguong = hackSan
      ? GOI_KY_QUY.NGUONG_LO_BP : GOI_KY_QUY.NGUONG_LO_THUONG_BP;
    const matChip = hackSan
      ? GOI_KY_QUY.MAT_CHIP : GOI_KY_QUY.MAT_CHIP_THUONG;
    for (const r of ketQua) {
      const g = ghe.find((x) => x.id === r.ghe_id);
      if (!g || g.da_chay) continue;
      if (!g.danh_muc.chien_thuat.includes('don_bay') || st.loi_chi_trong_man === true) continue;   // D530 — ký quỹ chỉ trong màn
      if (r.pnl_bp > nguong) continue;
      // v34 (`kyQuyTuNav`): trừ từ NAV — all-in không né được nữa (xem `truVonTuNav`).
      // Cổng tắt ⇒ đúng số học cũ: chỉ tiền mặt, trận ≤ v33 replay nguyên.
      const mat = st.ky_quy_tu_nav === true
        ? truVonTuNav(g, matChip) : Math.min(g.von, matChip);
      if (mat <= 0) continue;
      if (st.ky_quy_tu_nav !== true) g.von -= mat;
      goiKyQuy.push({ ghe_id: g.id, mat });
    }
    // Vốn vừa đổi → cập nhật lại von_sau đã ghi ở trên, nếu không UI hiện số cũ.
    for (const r of ketQua) {
      (r as { von_sau: number }).von_sau = ghe.find((x) => x.id === r.ghe_id)?.von ?? 0;
    }
  }

  /*
   * ── v34 — SIẾT PHÁP LÝ: đội lái bị bắt ────────────────────────────────────
   * Nổ khi ô là `phap_ly` và ghế mang vai đội lái đang phơi nhiễm ≥ ngưỡng.
   * Tránh được: đọc telegraph, hạ vị thế trước vòng đó. Xem `SIET_DOI_LAI`.
   */
  const sietDoiLai: { ghe_id: string; mat: number }[] = [];
  if (st.vai_co_rang === true && o.kind === 'su_kien' && o.su_kien === SIET_DOI_LAI.SU_KIEN) {
    for (const r of ketQua) {
      const g = ghe.find((x) => x.id === r.ghe_id);
      if (!g || g.da_chay || g.vai !== 'doi_lai') continue;
      const nav = navCua(g);
      const phoi = nav > 0 ? Math.floor(((nav - g.von) * 10000) / nav) : 0;
      if (phoi < SIET_DOI_LAI.PHOI_NHIEM_BP) continue;
      const mat = truVonTuNav(g, SIET_DOI_LAI.MAT_CHIP);
      if (mat <= 0) continue;
      sietDoiLai.push({ ghe_id: g.id, mat });
    }
    for (const r of ketQua) {
      (r as { von_sau: number }).von_sau = ghe.find((x) => x.id === r.ghe_id)?.von ?? 0;
    }
  }

  // ── Cháy tài khoản + van casual ─────────────────────────────────────────
  const chay: string[] = [];
  const vanConHieuLuc =
    HOLDEM_DECISIONS.CASUAL_VALVE_UNTIL_ROUND !== null &&
    st.vong < HOLDEM_DECISIONS.CASUAL_VALVE_UNTIL_ROUND;
  for (const g of ghe) {
    // v10 NAV: cháy đo trên NAV (vị thế TÍNH VÀO — khoá không cứu, spec 02 §3.3).
    const nguyKich = st.nav === true
      ? daChayNav(g, HOLDEM_MATCH.START_VON) : g.von <= 0;
    if (g.da_chay || !nguyKich) continue;
    if (vanConHieuLuc) {
      g.von = HOLDEM_DECISIONS.CASUAL_VALVE_FLOOR;
      continue;
    }
    g.da_chay = true;
    g.vong_chay = st.vong;
    chay.push(g.id);
  }

  // ── TƯ THẾ: ALL IN thì khoá bài tới hết trận ────────────────────────────
  // Founder 20/07: "Khi all in thì phải khóa hết những lượt chọn bài về sau và
  // lật hết bài đến cuối như poker". Nên đây là trạng thái MỘT CHIỀU: đã vào
  // thì không quay ra, kể cả khi vòng sau ăn quỹ và vốn dương trở lại.
  for (const g of ghe) {
    if (g.da_chay || g.tu_the !== 'choi') continue;
    if (!ttCuoc.allIn.has(g.id)) continue;
    // ĐIỀU KIỆN KHOÁ (founder nói rõ 20/07): "All in những vòng đầu thì không
    // sao chỉ là cược 100% vốn nhưng bắt đầu từ sau vòng chọn chiến thuật đầu
    // tiên thì all-in sẽ đóng tất cả lựa chọn tiếp theo... và đủ điều kiện
    // (Có ít nhất 1 lá bài chiến thuật)".
    //
    /*
     * ⚠ NGƯỠNG ĐỔI THEO CỔNG `dac_quyen`, KHÔNG ĐỔI CHUNG.
     *
     * Trận CŨ (v5/v6): "có ít nhất 1 chiến thuật" — nhịp cũ chỉ có hai vòng
     * chiến thuật (3 và 6) nên có thẻ nghĩa là đã qua vòng chiến thuật đầu tiên.
     * Trận MỚI (D34 điều 4): All-in chỉ mở SAU KHI CHỐT ĐỦ 3 THẺ, tức đúng giữa
     * trận ở mọi cỡ map. Áp ngưỡng mới cho trận cũ là khoá tư thế của một trận
     * đã đánh xong bằng luật khác — `events` append-only, không sửa lại được.
     */
    if (!allInMoCho(st, g)) continue;
    if (st.dac_quyen !== true && g.danh_muc.chien_thuat.length === 0) continue;
    g.tu_the = 'all_in';
    g.vong_roi = st.vong;
  }

  for (const g of ghe) {
    // v55 (D411) — VÀNG gộp vào XU: phần cấp mỗi vòng chảy vào `xu`, cùng ví với lửa/lõi.
    if (g.da_chay) continue;
    if (st.gop_xu === true) g.xu = (g.xu ?? 0) + HOLDEM_MATCH.LUOT_KHAO_SAT_MOI_VONG;
    else g.luot_khao_sat += HOLDEM_MATCH.LUOT_KHAO_SAT_MOI_VONG;
  }

  const truoc = st.map.o[st.vong - 2];
  const tinGiaLo = truoc?.kind === 'su_kien' && truoc.la_tin_gia
    ? { vong: st.vong - 1, su_kien: truoc.su_kien }
    : null;

  /*
   * D4 — ghi `dong_truoc` rồi ÁP PHẢN THÂN cho vòng mới.
   *
   * Thứ tự bắt buộc: ghi số người nắm ở cuối vòng này TRƯỚC (nó là "vòng trước"
   * của vòng sắp tới), rồi mới xét kích hoạt. Áp ở ĐÂY chứ không ở đầu vòng mới,
   * vì trạng thái được công bố GIỮA hai vòng — thay ô sau khi công bố là người
   * chơi đã thấy ô cũ rồi mới bị đổi.
   */
  // v35 (D160) — bẻ-chuỗi-bằng-vốn chạy SAU phản thân, cùng điểm nối vòng;
  // nó tự nhường khi phản thân đã thay ô vòng này (một vòng một bàn tay).
  // v55 (D409) — sổ đổi tay và lệnh chốt lời sống MỘT vòng (ghế đã là bản sao).
  for (const g of ghe) { delete g.doi_tay_vong; delete g.chot_loi; delete g.doi_ma_vong; }
  const stMoi = apBeChuoiVon(apPhanThan(
    napApLuc({
      ...st, vong: st.vong + 1, ghe,
      // v10 NAV — quỹ phí là CỦA MỘT VÒNG, đã đổ vào pot ở trên thì về 0.
      ...(st.nav === true ? { phi_giao_dich_vong: 0 } : {}),
      dong_truoc: demTheoMa(ghe),
      // LÕI VỐN A — ảnh chụp danh mục để vòng sau biết đâu là dòng tiền MỚI.
      // Ghi cùng chỗ, cùng lý do và cùng mốc thời gian với `dong_truoc`.
      tai_san_truoc: anhChupTaiSan(ghe),
      /*
       * v45 (D318) — ẢNH CHỤP VỊ THẾ CUỐI Ô, cho luật "giữ đủ một ô mới ăn coupon".
       * Ghi ở ĐÚNG mốc này vì đây là lúc ô vừa chốt xong: mọi lệnh, mọi định giá,
       * mọi phí của ô N đã áp. Ô N+1 đọc nó SAU khi lệnh của mình đã áp, nên `min`
       * ra đúng phần đã nằm im trọn một ô.
       * ⚠ Ghi lên chính `ghe` (không phải `st`) vì `apCoupon` là lõi NAV thuần —
       * nó thấy `GheNav`, không thấy `TrangThaiTran`.
       *
       * ⚠⚠ CHỈ GHI KHI CỜ BẬT, và đây là LẦN THỨ BA trong hai ngày cùng một lớp lỗi.
       * Bản đầu ghi VÔ ĐIỀU KIỆN ⇒ mọi ghế của MỌI phiên bản mọc thêm hai trường ⇒
       * golden lệch hash ở `balance-v42-taisan`, một bản GHIM lẽ ra byte-hệt.
       * Trước đó: D314 (`KetQuaVong` thêm trường luôn-có-mặt) và D317 (`kvVong`).
       * ⭐ LUẬT, viết ra để lần thứ tư không xảy ra: **mọi thứ `replay()` trả về đều
       * bị golden băm. Thêm gì vào đó thì mặc định phải là VẮNG MẶT — có điều kiện
       * theo cờ, không phải `null`, càng không phải ghi vô điều kiện.**
       */
      ...((): Record<string, never> => {
        if (st.coupon_giu_du !== true) return {};
        for (const g of ghe) {
          g.vi_the_o_truoc = { ...g.vi_the };
          g.vi_the_khong_o_truoc = { ...(g.vi_the_khong ?? {}) };
        }
        return {};
      })(),
    }),
    st.vong + 1,
  ), st.vong + 1);

  return {
    trangThai: stMoi,
    ketQua: {
      vong: st.vong, o, cho_bp: choBp, tin_gia_lo: tinGiaLo, ket_qua: ketQua,
      quy_vong: quyVong, ghe_thang: gheThang, chay_vong_nay: chay,
      so_pot: pots.length,
    phi_dung_ngoai: phiDungNgoai,
    /*
     * v42 (D311) — CHỈ CÓ MẶT KHI CỜ BẬT, cùng nếp `...(luat.x ? {…} : {})` của
     * `taoTran`. Trường luôn-có-mặt (dù rỗng) làm ĐỔI ẢNH CHỤP của mọi trận cũ, và
     * golden replay bắt ngay: bản đầu của tôi để mảng rỗng cố định ⇒ 4 bài golden đỏ,
     * gồm cả 11 trận THẬT của founder trên prod. Trận cũ phải byte-hệt (A11.3).
     */
    ...(st.coupon_tpcp === true ? { coupon: couponVong } : {}),
    ...(st.to_chuc_v57 === true ? { quan_ly: quanLyVong } : {}),
    ...(st.lai_vay_don_bay === true ? { lai_vay_don_bay: laiVayVong } : {}),
    ...(st.tien_mat_su_kien === true ? { tien_mat_su_kien: tienMatSuKienVong } : {}),
    ...(st.ngan_hang === true ? { tiet_kiem: tietKiemVong } : {}),
    phi_cat_lo: phiCatLo,
    ty_le_cat_lo_bp: tyLeCatLoBp,
    goi_ky_quy: goiKyQuy,
    siet_doi_lai: sietDoiLai,
    phi_don_bay: phiDonBay,
    ...(st.lua === true ? { lua: luaVong } : {}),
    },
    // Ngoài `ketQua` — xem docstring kiểu trả về (golden ghim `ketQuaCuoi`).
    ...(loiSuatCong ? { loiSuatCong } : {}),
    ...(chiaQuy.length > 0 ? { chiaQuy } : {}),
  };
}

/** Tiện ích: chơi vòng cược rồi chốt phiên trong một lần gọi. */
export function giaiQuyetVong(
  st: TrangThaiTran, quyetDinh: QuyetDinhCuoc,
): ReturnType<typeof chotPhien> {
  return chotPhien(st, choiVongCuoc(st, quyetDinh));
}

/**
 * ĐỔI TƯ THẾ GHẾ — hàm THUẦN, trả trạng thái mới.
 *
 * Vì sao cần một hàm riêng thay vì gán tại chỗ: tư thế quyết định ba luật khác
 * nhau (`PHI_DUNG_NGOAI` bào vốn mỗi vòng · `conCuoc` loại khỏi vòng cược ·
 * `xepHang` đẩy người đầu hàng xuống bét bảng), nên nó phải đổi ở ĐÚNG MỘT chỗ
 * và ghi luôn `vong_roi` — thiếu `vong_roi` thì tie-break "bỏ cuộc sớm xếp dưới
 * bỏ cuộc muộn" âm thầm dùng 0 cho mọi người.
 *
 * Gọi từ `replay()` nên tư thế là hàm thuần của log → replay vẫn tất định.
 */
export function doiTuThe(
  st: TrangThaiTran, gheId: string, tuThe: TuTheGhe, vong: number,
): TrangThaiTran {
  return {
    ...st,
    ghe: st.ghe.map((g) => {
      if (!(g.id === gheId && g.tu_the === 'choi')) return g;
      const sau: Ghe = { ...g, tu_the: tuThe, vong_roi: vong };
      /*
       * v43 (D314) — ĐẦU HÀNG khi còn hợp đồng ⇒ tất toán như HUỶ (gốc về tiền mặt,
       * lãi treo mất). Founder chốt 08/09.
       * ⚠ Chỉ `dau_hang`, KHÔNG phải `dung_ngoai`: người đứng ngoài vẫn ở trong trận,
       * hợp đồng của họ chạy tiếp tới đáo hạn. Trả lãi cho người đầu hàng là biến
       * "đầu hàng" thành một cách rút lãi sớm miễn phí.
       */
      return tuThe === 'dau_hang' && st.ngan_hang === true
        ? huyMoiHopDong(sau, vong) : sau;
    }),
  };
}

// ---------------------------------------------------------------------------
// D4 — PHẢN THÂN
// ---------------------------------------------------------------------------

/**
 * Ảnh chụp "ghế nào đang nắm những mã nào" — nguyên liệu của `vaoMoiCua`.
 *
 * Chụp CẢ ghế đã cháy: người cháy không còn đẩy giá (nên `demTheoMa` bỏ họ),
 * nhưng nếu bỏ họ ở đây thì vòng sau họ trông như vừa vào lại toàn bộ danh mục.
 * Hai phép đếm hỏi hai câu khác nhau nên có hai bộ lọc khác nhau.
 */
export function anhChupTaiSan(ghe: readonly Ghe[]): Record<string, string[]> {
  const d: Record<string, string[]> = {};
  for (const g of ghe) d[g.id] = [...new Set(g.danh_muc.tai_san)];
  return d;
}

/** Đếm số ghế CÒN TRONG TRẬN đang nắm từng mã. */
export function demTheoMa(ghe: readonly Ghe[]): Record<string, number> {
  const d: Record<string, number> = {};
  for (const g of ghe) {
    if (!conTrongTran(g)) continue;
    // `new Set` vì stack (nhiều bản sao cùng mã) vẫn chỉ là MỘT người nắm.
    for (const id of new Set(g.danh_muc.tai_san)) d[id] = (d[id] ?? 0) + 1;
  }
  return d;
}

/**
 * Lobby đang dồn về phía nào? Trả `null` nếu chưa đủ điều kiện.
 *
 * Điều kiện: có ÍT NHẤT MỘT mã trong nhóm đạt ngưỡng ở CẢ vòng trước và vòng này
 * (đúng chữ "2 vòng liên tiếp" của D4). Đo bằng TỶ LỆ lobby (D3) nên bàn 4 và bàn
 * 8 cùng một ngưỡng hành vi.
 */
/**
 * D5 — đếm số ghế CÒN TRONG TRẬN đang cầm từng thẻ chiến thuật.
 *
 * Song song với `demTheoMa` (tài sản). Cần riêng vì "rủi ro đối tác" đo đám đông ở
 * tầng THẺ, không phải tầng mã: cả bàn cùng núp sau `chan_lo` là một loại dồn cục
 * khác hẳn cả bàn cùng ôm vàng.
 */
export function demTheoChienThuat(ghe: readonly Ghe[]): Record<string, number> {
  const d: Record<string, number> = {};
  for (const g of ghe) {
    if (!conTrongTran(g)) continue;
    for (const id of new Set(g.danh_muc.chien_thuat)) d[id] = (d[id] ?? 0) + 1;
  }
  return d;
}

export function huongDonCuaLobby(st: TrangThaiTran): 'don' | 'tron' | null {
  if (st.phan_than_bat === false) return null;
  const songSot = st.ghe.filter((g) => conTrongTran(g)).length;
  if (songSot <= 1) return null;
  const nay = demTheoMa(st.ghe);
  const truoc = st.dong_truoc;
  if (!truoc) return null;   // vòng đầu chưa có gì để so → chưa thể "liên tiếp"

  const duNguong = (ma: readonly string[]) => ma.some((id) =>
    tyLeBp(nay[id] ?? 0, songSot) >= PHAN_THAN.NGUONG_LOBBY_BP
    && tyLeBp(truoc[id] ?? 0, songSot) >= PHAN_THAN.NGUONG_LOBBY_BP);

  if (duNguong(PHAN_THAN.MA_RISK_ON)) return 'don';
  if (duNguong(PHAN_THAN.MA_PHONG_THU)) return 'tron';
  return null;
}

/**
 * v37 — MỨC DỒN CỦA BÀN, đo bằng CẢ HAI thước (D181). Trả phần VƯỢT NGƯỠNG, bp.
 *
 * Hai máy thay ô cũ mỗi máy đọc một thước và chỉ hỏi "có vượt ngưỡng không":
 * phản thân đếm GHẾ (`NGUONG_LOBBY_BP`), bẻ-chuỗi đếm VỐN (`NGUONG_VON_BP`).
 * Hàm này đọc cả hai và trả ĐỘ LỚN của phần vượt — 61% và 95% thôi bằng nhau.
 *
 * ⚠ KHÔNG CÓ HƯỚNG, có chủ ý. Mỗi máy tự quyết hướng của nó (phản thân theo phe
 * đang đông, bẻ-chuỗi theo "phi lý = cả hai"); áp lực chỉ nói ĐẨY MẠNH CỠ NÀO.
 * Cho áp lực mang hướng nữa là đếm cùng một lực hai lần, và hai hướng có thể cãi
 * nhau trong cùng một vòng.
 *
 * ⚠ Lấy MAX của hai vế chứ không cộng: chúng là hai cách đo CÙNG một hiện tượng
 * (bàn đang dồn về một phe), cộng lại là đếm đúp một bàn vừa đông ghế vừa nặng vốn.
 */
export function mucDonVuotBp(st: TrangThaiTran): number {
  const song = st.ghe.filter((g) => conTrongTran(g));
  if (song.length <= 1) return 0;

  const nay = demTheoMa(st.ghe);
  let tongNav = 0;
  for (const g of song) tongNav += Math.max(0, navCua(g));

  let vuot = 0;
  for (const phe of [PHAN_THAN.MA_RISK_ON, PHAN_THAN.MA_PHONG_THU]) {
    // vế GHẾ: mã đông nhất trong phe (cùng phép của `huongDonCuaLobby`).
    for (const ma of phe) {
      const g = tyLeBp(nay[ma] ?? 0, song.length) - PHAN_THAN.NGUONG_LOBBY_BP;
      if (g > vuot) vuot = g;
    }
    // vế VỐN: tổng vốn cả phe trên tổng NAV (cùng phép của `beChuoiCuaLobby`).
    if (tongNav > 0) {
      let vonPhe = 0;
      for (const g of song) for (const ma of phe) vonPhe += g.vi_the[ma] ?? 0;
      const v = Math.floor((vonPhe * 10000) / tongNav) - BE_CHUOI_VON.NGUONG_VON_BP;
      if (v > vuot) vuot = v;
    }
  }
  return Math.max(0, vuot);
}

/**
 * v37 — NẠP + MÒN áp lực ở điểm nối vòng (D181). Trả state MỚI.
 *
 * Gọi TRƯỚC hai máy thay ô: áp lực của vòng vừa kết thúc là thứ đổi xác suất cho
 * ô SẮP TỚI. Gọi sau thì hành vi vòng này chỉ ảnh hưởng vòng sau nữa — trễ một
 * nhịp so với chính lời hứa của cơ chế.
 */
export function napApLuc(st: TrangThaiTran): TrangThaiTran {
  if (st.ap_luc_ban !== true) return st;
  const nap = Math.floor((mucDonVuotBp(st) * AP_LUC_BAN.NAP_X_BP) / 10000);
  const con = Math.floor(((st.ap_luc_bp ?? 0) * AP_LUC_BAN.MON_BP) / 10000);
  const moi = Math.min(AP_LUC_BAN.TRAN_BP, con + nap);
  if (moi === (st.ap_luc_bp ?? 0)) return st;
  return { ...st, ap_luc_bp: moi };
}

/**
 * v37 — ÁP LỰC CỘNG VÀO XÁC SUẤT THAY Ô (D181), có TRẦN.
 *
 * ⚠ `XS_TRAN_BP` là bất khả thương lượng (addendum §3): dù cả bàn dồn 100% vốn
 * suốt trận, chợ vẫn còn ≥30% cửa đi ngược đám đông. Bỏ trần là đổi "thị trường
 * phản ứng với đám đông" thành "đám đông ĐIỀU KHIỂN thị trường" — thứ khác hẳn,
 * và là thứ làm trò mất tính bất định.
 */
export function xsCongApLuc(st: TrangThaiTran, xsGoc: number): number {
  if (st.ap_luc_ban !== true) return xsGoc;
  const san = Math.floor((xsGoc * AP_LUC_BAN.SAN_X_BP) / 10000);
  const them = Math.floor(((st.ap_luc_bp ?? 0) * AP_LUC_BAN.VAO_XS_BP) / 10000);
  return Math.min(AP_LUC_BAN.XS_TRAN_BP, san + them);
}

/**
 * Thay ô của vòng `vongMoi` nếu phản thân kích hoạt. Trả state MỚI.
 *
 * GIỮ NGUYÊN LOẠI Ô: sự kiện↔sự kiện, giai đoạn↔giai đoạn. Nhờ vậy mọi con số đã
 * công bố (tổng vòng, còn mấy ô, mấy giai đoạn, mấy sự kiện, kỳ vọng tin giả) vẫn
 * đúng — xem docstring `PHAN_THAN`.
 */
/**
 * v40 (D302) — Ô KỲ HỌP LÀ LỊCH CÔNG KHAI, ĐÁM ĐÔNG KHÔNG HUỶ ĐƯỢC CUỘC HỌP.
 *
 * Bản đồ in ⚖ KỲ HỌP lên ô úp từ đầu trận (`o_lich`, luật công khai 8.2), và API
 * gửi `chinh_sach` (kỳ vọng / thực) cho ô đó. Trước v40 phản thân vẫn đè được lên
 * nó: đo 07/09 trên bàn tập 12 ô (v36), ô ⚖ 9 TĂNG LÃI thành HACK SÀN trong khi
 * nhãn KỲ HỌP còn nguyên và `chinh_sach` vẫn được gửi — người chơi thấy một cuộc
 * họp ngân hàng "hoá ra" là tin đồn hack sàn. Cổng riêng vì đổi nó là đổi replay
 * của trận đã lưu (A11.3). Bẻ chuỗi chỉ chạm ô pha nên hiếm khi tới đây, nhưng
 * cùng một cửa cho cả hai máy đổi ô (D61).
 */
function laOLichCoDinh(st: TrangThaiTran, i: number): boolean {
  return st.lich_khong_doi === true && st.map.trang_thai?.[i]?.o_lich === true;
}

export function apPhanThan(st: TrangThaiTran, vongMoi: number): TrangThaiTran {
  const huong = huongDonCuaLobby(st);
  if (!huong) return st;

  const i = vongMoi - 1;
  const o = st.map.o[i];
  if (!o) return st;
  if (laOLichCoDinh(st, i)) return st;

  /*
   * KHÔNG THAY Ô ĐANG BỊ TELEGRAPH.
   *
   * Ô giai đoạn ngay sau một sự kiện THẬT đã được hứa "nghiêng về X": map.ts
   * nghiêng nó theo `bao_truoc`, và API gửi lời hứa đó ra trong
   * `telegraph.nghieng_ve`. Thay ô đó là bẻ đúng lời mình vừa nói với người chơi.
   * Sau TIN GIẢ thì thay được — tin giả vốn được cảnh báo có thể bịa.
   */
  const oTruoc = st.map.o[i - 1];
  if (o.kind === 'giai_doan' && oTruoc?.kind === 'su_kien' && !oTruoc.la_tin_gia) {
    return st;
  }

  const r = rngAt(st.seed, 'holdem_phan_than', vongMoi);
  if (!r.chanceBp(xsCongApLuc(st, PHAN_THAN.TANG_BP))) return st;

  const dich = o.kind === 'su_kien'
    ? (huong === 'don' ? PHAN_THAN.SU_KIEN_KHI_DON : PHAN_THAN.SU_KIEN_KHI_TRON)
    : (huong === 'don' ? PHAN_THAN.GIAI_DOAN_KHI_DON : PHAN_THAN.GIAI_DOAN_KHI_TRON);
  const chon = dich[r.below(dich.length)]!;
  const cu = o.kind === 'su_kien' ? o.su_kien : o.giai_doan;

  /*
   * ⚠⚠ CỬA "KHÔNG CÒN GÌ ĐỂ THAY" — ĐO RỒI, KHÔNG MỞ (D181).
   *
   * Bàn dồn lâu đẩy hết ô pha về đúng ô đích (`GIAI_DOAN_KHI_DON` chỉ có một
   * phần tử) nên `chon === cu` ngày càng hay xảy ra ⇒ áp lực cao mà cơ chế câm.
   * Đã dựng một cửa LAN sang ô chưa lật (cửa sổ 2 ô, cùng loại, tôn telegraph)
   * để mở nút đó — rồi ĐO: tỷ lệ nổ ở nhóm áp lực cao 20,3% → 21,0% trên
   * n=709, tức **+0,7pp khi 1 SE = 1,5pp**. Không phân biệt được với 0.
   * ⇒ GỠ. Repo đã trả giá nhiều lần cho code chạy mà không nói gì; giữ một cơ
   * chế chỉ vì nó nghe hợp lý là cách sinh ra cơ chế trang trí tiếp theo.
   * Muốn mở nút này thật thì phải nới TẬP ĐÍCH của ô pha, không phải lan ô.
   */
  if (chon === cu) return st;

  const o2 = o;

  const oMoi: OThiTruong = o2.kind === 'su_kien'
    // Giữ nguyên cờ tin giả: phản thân đổi TIN GÌ, không đổi tin đó thật hay bịa.
    /*
     * Giữ nguyên cờ tin giả: phản thân đổi TIN GÌ, không đổi tin đó thật hay bịa.
     * `bao_truoc` phải đi theo sự kiện MỚI — để nguyên của sự kiện cũ là telegraph
     * nói về một tin không còn tồn tại.
     */
    ? {
      ...o2,
      su_kien: chon as typeof o2.su_kien,
      bao_truoc: SU_KIEN.find((x) => x.id === chon)!.bao_truoc,
    }
    : { ...o2, giai_doan: chon as typeof o2.giai_doan };

  const oMang = [...st.map.o];
  oMang[i] = oMoi;
  return {
    ...st,
    map: { ...st.map, o: oMang },
    phan_than: [...(st.phan_than ?? []), { vong: vongMoi, tu: cu, den: chon, vi: huong }],
  };
}

/**
 * v35 — LOBBY CÓ ĐANG BẺ CHUỖI BẰNG VỐN KHÔNG? (D160). Trả hướng bẻ hoặc null.
 *
 * "Phi lý = CẢ HAI" (founder chốt): phần lớn VỐN bàn dồn vào phe NGƯỢC chiều
 * chuỗi pha đang chạy VÀ ngược môi trường tiền tệ. Một vế không đủ — đi ngược
 * chuỗi khi môi trường ủng hộ là đầu cơ có cơ sở, không phải phi lý.
 *
 * ĐẾM VỐN, KHÔNG ĐẾM GHẾ (khác phản thân D4 — cùng bàn có thể một máy nổ một
 * máy im): giá trị VỊ THẾ trong phe / TỔNG NAV bàn. Tiền mặt đứng ngoài không
 * bẻ được gì; sổ KHỐNG không tính vào phe (khống là cược NGƯỢC phe đó).
 * ⚠ D107 từng bác đếm-tiền cho CROWDING (làm Tất tay mạnh lên) — đây là cơ chế
 * KHÁC, số đo MC riêng, không mượn kết luận cũ.
 */
/**
 * v36 R2 BẢN C (D172) — HỆ SỐ NỀN NHÂN VÀO LỰC CỦA TIN ĐANG NỔ.
 *
 * Tin đi THUẬN nền đang chạy ⇒ đậm hơn; đi NGƯỢC ⇒ bị nền ghì. Nền `di_ngang`
 * hoặc ô không phải tin ⇒ 10000 (không đụng). Hướng tin đọc từ `bao_truoc` —
 * nhãn CÔNG KHAI trên ô, đúng thứ người chơi nhìn thấy; KHÔNG đọc `la_tin_gia`
 * (tin bịa cũng được nhân theo mặt chữ, rồi mới đảo dấu — nói dối to giữa lúc
 * chợ thuận thì trả giá to). Bot đọc CÙNG hàm này qua `BoiCanhLenh.nen`.
 */
export function heSoTinTheoNen(
  st: { map: HoldemMap; vong: number; gia_chong_nen?: boolean },
  o: OThiTruong,
): number {
  if (st.gia_chong_nen !== true || o.kind !== 'su_kien') return 10000;
  const nen = st.map.trang_thai?.[st.vong - 1]?.giai_doan_nen;
  if (!nen) return 10000;
  return heSoTinTheoNenThuan(nen, o.bao_truoc);
}

/** Phần THUẦN của `heSoTinTheoNen` — engine và bot cùng gọi (một nguồn, D61). */
export function heSoTinTheoNenThuan(nen: string, baoTruoc: string): number {
  const hNen = HUONG_GIAI_DOAN[nen as keyof typeof HUONG_GIAI_DOAN] ?? 0;
  const hTin = HUONG_GIAI_DOAN[baoTruoc as keyof typeof HUONG_GIAI_DOAN] ?? 0;
  if (hNen === 0 || hTin === 0) return 10000;
  return hNen === hTin
    ? REGIME_TICK.TIN_THUAN_NEN_X_BP : REGIME_TICK.TIN_NGUOC_NEN_X_BP;
}

/**
 * CHUỖI PHA ĐANG CHẠY trên các ô ĐÃ LẬT — run KHÔNG reset qua ô sự kiện (cùng
 * ngữ nghĩa nhanGiaiDoan của máy sinh, đọc CÙNG bảng HUONG_GIAI_DOAN).
 * MỘT NGUỒN cho cả `beChuoiCuaLobby` lẫn khối "vị-trí-trong-chuỗi" của bảng
 * điện tử (K4, D164) — hai bản đếm run là hai bản sẽ trôi, và cú trôi ở đây
 * là bảng bán một con số khác con số máy bẻ-chuỗi đang dùng.
 * Toàn bộ từ Ô ĐÃ LẬT ⇒ thông tin công khai, bảng chỉ bán phép GỘP (như đếm bài).
 */
export function chuoiDangChay(
  o: readonly OThiTruong[], vongMoi: number,
): { huong: -1 | 0 | 1; dai: number } {
  let h: -1 | 0 | 1 = 0;
  let dai = 0;
  for (let i = 0; i < vongMoi - 1 && i < o.length; i += 1) {
    const t = o[i]!;
    if (t.kind !== 'giai_doan') continue;
    const hh = HUONG_GIAI_DOAN[t.giai_doan as keyof typeof HUONG_GIAI_DOAN] ?? 0;
    if (hh === h) dai += 1;
    else { h = hh; dai = 1; }
  }
  return { huong: h, dai };
}

export function beChuoiCuaLobby(
  st: TrangThaiTran, vongMoi: number,
): 'len' | 'xuong' | null {
  if (st.be_chuoi_von !== true) return null;
  const { huong: h, dai } = chuoiDangChay(st.map.o, vongMoi);
  if (h === 0 || dai < BE_CHUOI_VON.CHUOI_TOI_THIEU_O) return null;
  // 2. Môi trường phải CÙNG PHE với chuỗi — thì đám đông ngược mới là "cả hai".
  const mt = moiTruongTienTe(
    st.map.trang_thai?.[vongMoi - 2]?.lai_suat_diem ?? LAI_SUAT_NEN.KHOI_DIEM);
  const chuoiGiamMtDat = h === -1 && mt === 'dat';
  const chuoiTangMtRe = h === 1 && mt === 're';
  if (!chuoiGiamMtDat && !chuoiTangMtRe) return null;
  // 3. Vốn: phe NGƯỢC chuỗi phải giữ phần lớn NAV bàn.
  const pheNguoc = chuoiGiamMtDat ? PHAN_THAN.MA_RISK_ON : PHAN_THAN.MA_PHONG_THU;
  let tongNav = 0;
  let vonPhe = 0;
  for (const g of st.ghe) {
    if (!conTrongTran(g)) continue;
    tongNav += navCua(g);
    for (const ma of pheNguoc) vonPhe += g.vi_the[ma] ?? 0;
  }
  if (tongNav <= 0) return null;
  // So sánh số nguyên thuần: vonPhe/tongNav ≥ NGUONG_VON_BP/10000, không float.
  if (vonPhe * 10000 < BE_CHUOI_VON.NGUONG_VON_BP * tongNav) return null;
  return chuoiGiamMtDat ? 'len' : 'xuong';
}

/**
 * v35 — XÁC SUẤT bẻ chuỗi của vòng này (D160): nền + phần cộng cá mập tập
 * trung ("tác động nhẹ nếu tập trung — tính bằng lượng vốn được dùng").
 * Tách hàm để test được số, không phải suy từ tần suất.
 */
export function xsBeChuoiCua(st: TrangThaiTran, huong: 'len' | 'xuong'): number {
  let xs: number = BE_CHUOI_VON.XAC_SUAT_BP;
  const phe = huong === 'len' ? PHAN_THAN.MA_RISK_ON : PHAN_THAN.MA_PHONG_THU;
  for (const g of st.ghe) {
    if (!conTrongTran(g) || g.vai !== 'ca_map') continue;
    const nav = navCua(g);
    if (nav <= 0) continue;
    let vonPhe = 0;
    for (const ma of phe) vonPhe += g.vi_the[ma] ?? 0;
    if (vonPhe * 10000 >= BE_CHUOI_VON.NGUONG_CA_MAP_BP * nav) {
      xs += BE_CHUOI_VON.CA_MAP_THEM_BP;
      break; // một phần cộng duy nhất — nhiều cá mập không chồng dồn
    }
  }
  return xs;
}

/**
 * v35 — Thay ô PHA của vòng `vongMoi` nếu bẻ-chuỗi-bằng-vốn kích hoạt (D160).
 * Cùng kỷ luật apPhanThan: giữ loại ô, seeded, immutable; và NHƯỜNG khi phản
 * thân đã thay ô vòng này — hai máy cùng đẩy về phía đám đông, thay hai lần
 * là đếm một lực hai lần.
 */
export function apBeChuoiVon(st: TrangThaiTran, vongMoi: number): TrangThaiTran {
  const huong = beChuoiCuaLobby(st, vongMoi);
  if (!huong) return st;
  if (st.phan_than?.some((p) => p.vong === vongMoi)) return st;


  const i = vongMoi - 1;
  const o = st.map.o[i];
  // Chỉ bẻ Ô PHA — chuỗi vĩ mô sống ở pha; đè lên ô sự kiện là đổi cả lớp tin.
  if (!o || o.kind !== 'giai_doan') return st;
  if (laOLichCoDinh(st, i)) return st;
  // KHÔNG thay ô đang bị telegraph hứa (cùng luật apPhanThan).
  const oTruoc = st.map.o[i - 1];
  if (oTruoc?.kind === 'su_kien' && !oTruoc.la_tin_gia) return st;

  const r = rngAt(st.seed, 'holdem_be_chuoi', vongMoi);
  if (!r.chanceBp(xsCongApLuc(st, xsBeChuoiCua(st, huong)))) return st;

  const den = huong === 'len' ? 'tang' : 'giam';
  if (o.giai_doan === den) return st;
  const oMang = [...st.map.o];
  oMang[i] = { ...o, giai_doan: den as typeof o.giai_doan };
  return {
    ...st,
    map: { ...st.map, o: oMang },
    be_chuoi: [...(st.be_chuoi ?? []),
      { vong: vongMoi, tu: o.giai_doan, den, huong }],
  };
}

/** Trận kết thúc khi hết ô hoặc chỉ còn ≤1 ghế sống. */
/**
 * D302 — CÚ ĐỔI Ô của một vòng, đọc từ hai sổ `phan_than` / `be_chuoi` — MỘT
 * nguồn cho cả DTO vòng (`ket_qua_vong.o_doi`), ô lịch sử (`lich_su_o[].doi`)
 * và sổ hành vi (`kvVong.thay_o_do`, D61).
 *
 * Luật 03 §3: *"Ẩn ex-ante được, LỘ ex-post BẮT BUỘC"*. Máy đổi ô từ v20/v35
 * mà chưa bao giờ ra tới người chơi (đo 07/09: 22,5% số vòng bàn 12 bị đổi mà
 * màn không nói gì — người chơi đọc là "chuỗi ô ngẫu nhiên"). Chỉ gọi cho vòng
 * ĐÃ CHỐT: ô đang mở vẫn giấu — `apPhanThan` chạy lúc mở vòng nên sổ đã có dòng
 * của vòng hiện tại, và hàm này KHÔNG được hỏi vòng đó.
 *
 * `vi` là ID, chữ ở client (D26): `don`/`tron` = cả bàn dồn vào rủi ro / trốn
 * vào phòng thủ hai vòng liền (phản thân); `len`/`xuong` = phe ngược chuỗi giữ
 * phần lớn vốn bàn, chuỗi bị bẻ lên / xuống (bẻ chuỗi bằng vốn).
 */
export type ODoi =
  | { boi: 'phan_than'; tu: string; den: string; vi: 'don' | 'tron' }
  | { boi: 'be_chuoi'; tu: string; den: string; vi: 'len' | 'xuong' };

export function oDoiCua(
  st: Pick<TrangThaiTran, 'phan_than' | 'be_chuoi'>, vong: number,
): ODoi | null {
  const pt = st.phan_than?.find((x) => x.vong === vong);
  if (pt) return { boi: 'phan_than', tu: pt.tu, den: pt.den, vi: pt.vi };
  const bc = st.be_chuoi?.find((x) => x.vong === vong);
  if (bc) return { boi: 'be_chuoi', tu: bc.tu, den: bc.den, vi: bc.huong };
  return null;
}

export function daKetThuc(st: TrangThaiTran): boolean {
  if (st.vong > soVong(st)) return true;
  // Đếm ghế còn TRONG TRẬN (xem `conTrongTran`), không phải ghế còn cược.
  return st.ghe.filter((g) => conTrongTran(g)).length <= 1;
}

/**
 * Xếp hạng cuối.
 *
 * Thứ tự loại trừ, từ tệ nhất lên:
 *   1. ĐẦU HÀNG — bét bảng, dưới cả người cháy. Thoát là thua, không có hạng
 *      để mà giữ (founder 20/07). Nhiều người đầu hàng thì ai bỏ cuộc SỚM hơn
 *      xếp dưới — bỏ cuộc sớm là bỏ cuộc nhiều hơn.
 *   2. CHÁY — cháy sau xếp trên cháy trước.
 *   3. Còn lại — Vốn cao thắng. Người ĐỨNG NGOÀI nằm chung nhóm này: họ vẫn
 *      được tính hạng, chỉ là vốn đã bị lạm phát bào mòn trong lúc ngồi xem.
 */
/** D561 — % tăng trưởng của ghế so vốn khởi điểm CỦA VAI (bp; 0 = hoà vốn) — một thước cho xếp hạng E và bảng tham chiếu. */
export function tangTruongBp(st: TrangThaiTran, g: Ghe): number {
  return Math.floor((navCua(g) * 10000) / vonDauCua(st, g)) - 10000;
}

/**
 * D561 — ĐIỂM CÁCH E của từng ghế (bp, 0…10000): phân vị trong vai (`XEP_HANG_E`) của (% ghế − trung vị % MỌI ghế cùng trận, kể cả ghế cháy /
 * đầu hàng — bảng dựng cùng cách). Ghế không vai ⇒ bảng Cá nhân. Thuần.
 */
export function diemCachE(st: TrangThaiTran): Record<string, number> {
  const tt = st.ghe.map((g) => tangTruongBp(st, g)).sort((a, b) => a - b);
  const n = tt.length, giua = n % 2 ? tt[(n - 1) / 2]! : (tt[n / 2 - 1]! + tt[n / 2]!) / 2;
  const ra: Record<string, number> = {};
  const bang = bangXepHangE(st);   // D574 — bảng theo khoá (v67 bảng riêng, v65/v66 bảng chung)
  for (const g of st.ghe) ra[g.id] = phanViBang(bang[g.vai ?? 'ca_nhan'] ?? bang.ca_nhan, tangTruongBp(st, g) - giua);
  return ra;
}

export function xepHang(st: TrangThaiTran): readonly string[] {
  const bac = (g: Ghe) => (g.tu_the === 'dau_hang' ? 2 : g.da_chay ? 1 : 0);
  // D561 — khoá v65 (`xep_hang_e`): người còn trụ xếp theo điểm cách E (hoà ⇒ % tăng trưởng như cũ). Cháy / đầu hàng giữ thứ tự cũ.
  const diemE = st.xep_hang_e === true ? diemCachE(st) : null;
  /*
   * ⚠ LỖI FOUNDER BÁO 01/08: bản cũ xếp người sống theo `b.von - a.von` —
   * TIỀN MẶT trần trụi. Trên trận nav đó là sai thước tận gốc (D40/spec 01:
   * NAV là thước DUY NHẤT): ai all-in vào vị thế NAV cao mà tiền mặt 0 bị
   * xếp bét. `navCua` = tiền mặt + danh mục + sổ khống; trận cũ (không nav)
   * navCua ≡ von nên một công thức phủ cả hai, không cần cổng.
   */
  return [...st.ghe].sort((a, b) => {
    const ba = bac(a); const bb = bac(b);
    if (ba !== bb) return ba - bb;
    // Bỏ cuộc MUỘN hơn xếp trên: trụ được lâu hơn thì đỡ tệ hơn.
    if (ba === 2) return (b.vong_roi ?? 0) - (a.vong_roi ?? 0);
    if (ba === 1) return (b.vong_chay ?? 0) - (a.vong_chay ?? 0);
    if (diemE && diemE[b.id] !== diemE[a.id]) return diemE[b.id]! - diemE[a.id]!;
    /*
     * v34 — VAI có vốn khởi điểm khác nhau (cá mập ×3, cá nhân ×1) ⇒ xếp theo NAV
     * tuyệt đối là cá mập thắng hạng từ lúc chưa bấm gì (và hạng nuôi điểm rank).
     * Quỹ vòng đã chia theo % tăng trưởng từ v10; hạng cuối nay cùng thước: NAV so
     * VỐN KHỞI ĐIỂM CỦA VAI (bp, floor), hoà thì NAV tuyệt đối. Cổng tắt ⇒ cùng
     * mẫu số ⇒ thứ tự y hệt NAV tuyệt đối (trận cũ không đổi).
     */
    const ta = Math.floor((navCua(a) * 10000) / vonDauCua(st, a));
    const tb = Math.floor((navCua(b) * 10000) / vonDauCua(st, b));
    if (tb !== ta) return tb - ta;
    return navCua(b) - navCua(a);
  }).map((g) => g.id);
}

/** Nhãn thẻ chiến thuật — phục vụ hiển thị, D26. */
export function nhanChienThuat(id: ChienThuatId): string {
  return CHIEN_THUAT.find((c) => c.id === id)?.label ?? id;
}
