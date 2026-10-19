/**
 * BẢNG ĐIỆN TỬ — dữ liệu cho pop-up TRẢ PHÍ ở đầu vòng (founder chốt 26/07).
 *
 * Codename nội bộ Market Terminal; người chơi thấy "Bảng điện tử". Hàm THUẦN,
 * TẤT ĐỊNH, số nguyên — cùng (seed, vòng, danh mục) ra cùng kết quả, kể cả phần
 * nhấp nháy, nên trận replay được y hệt.
 *
 * ─── TRIẾT LÝ ──────────────────────────────────────────────────────────────
 * Công khai thông số MÔI TRƯỜNG, giấu kín thông số MAY RỦI và vị thế đối thủ.
 * Bảng không nói tương lai; nó dọn sẵn dữ liệu thô của hiện tại để ai chịu suy
 * nghĩ nối lại được thành bước đi tốt hơn.
 *
 * ─── KHÔNG CÓ CÔNG THỨC NÀO SỐNG Ở ĐÂY ─────────────────────────────────────
 * Mọi con số đều LẤY TỪ ENGINE: nấc thanh khoản qua `nacHieuDung`, danh sách
 * echo qua `echoDangCo`, nhánh hệ quả qua `nhanhHeQua`, lực bp qua `machEcho`.
 * File này chỉ CHE (độ trễ, sương mù) và TRÌNH BÀY (vạch pin). Bịa một công
 * thức thứ hai ở đây là dạy người chơi sai — và họ vừa trả phí cho con số đó,
 * nên đó là lừa có thu phí.
 *
 * ─── BA CHỖ CỐ Ý KHÔNG NÓI THẬT HẾT (đọc trước khi "sửa lỗi") ───────────────
 * 1. LUẬT 1 — sổ cái trễ `DO_TRE_VONG` vòng: ô vừa lật đầu vòng này là "?".
 * 2. Cờ tin giả CHƯA TỚI LÚC LỘ thì không bán: dòng echo của vòng liền trước
 *    hiện độ lớn nhưng KHÔNG hiện chiều (`dao: null`, `luc_bp: null`).
 * 3. Thanh thanh khoản tính theo ô NHƯ NGƯỜI CHƠI ĐANG THẤY, tức tạm coi tin
 *    đang nổ là THẬT (xem `gia_dinh_tin_that`).
 */
import {
  DUOI_5MAT,
  BANG_DIEN_TU, DAC_QUYEN, GIAI_DOAN, LAI_SUAT_NEN, REGIME_TICK, moiTruongTienTe,
  mtKeTiep,
  boMaTranCua, mtSuKien, DO_SAU_L, NHA_CAI, type BoMaTran,
  SU_KIEN, SU_KIEN_THEO_GIAI_DOAN, TAI_SAN, THANH_KHOAN_DONG, giaMoBang,
  tyLeTinGiaHieuDung,
  type GiaiDoanId, type SuKienId, type ThanhKhoan,
} from '../../config/holdem.js';
import { applyBpInt, rngAt } from '../sandbox/rng.js';
import {
  chuoiDangChay, coCongHuongTruAn, doSauCuaNac, echoCua, laiSuatThayDuoc, machEcho, nacHieuDung,
  nhanhHeQua, NAC_THANH_KHOAN, apChuKyBienDo, sucCangLuc, vongDaLat, type TrangThaiTran,
} from './engine.js';
import { NAC_NAM, suKienDichNacNam, type NacThanhKhoan } from '../../config/thanh_khoan_nam_nac.js';
import type { OThiTruong } from './map.js';
import { capThe } from './shop.js';

/** v53 (D373) — ô "chưa có gì" cho vòng 1 khi chưa ô nào lật. Đi ngang = không dịch nấc. */
const O_TRUNG_TINH: OThiTruong = { kind: 'giai_doan', giai_doan: 'di_ngang' };

const DOMAIN_SUONG_MU = 'bang_suong_mu';
const DOMAIN_SUONG_MU_CAP = 'bang_suong_mu_cap';

// ---------------------------------------------------------------------------
// Hình dạng dữ liệu (tầng API/UI đọc đúng cái này, không suy thêm)
// ---------------------------------------------------------------------------

export interface ThanhThanhKhoan {
  tai_san_id: string;
  /** CHUỖI NGƯỜI CHƠI ĐỌC — lấy từ `TAI_SAN`, không gõ lại. */
  label: string;
  icon: string;
  /** Nấc NỀN dán trên lá — để người chơi thấy nó đã co giãn bao nhiêu. */
  nac_nen: ThanhKhoan;
  /** v54 (D395) — vạch pin của nấc NỀN (thước nghỉ ở đây khi chưa có lá nào lật trong nhịp). */
  vach_nen: number;
  /** Nấc hiệu dụng. `null` khi mã bị SƯƠNG MÙ (LUẬT 2) — chỉ có biên độ. v54 (D395): thang năm nấc. */
  nac: NacThanhKhoan | null;
  /** Vạch pin đang sáng. `null` khi sương mù. */
  vach: number | null;
  /** Tổng vạch của một thanh (hằng số, gửi ra để UI không tự đoán). */
  tong_vach: number;
  /**
   * v42 (D311) — mã này trả DÒNG TIỀN mỗi ô. Chỉ có mặt khi cổng `couponTpcp` bật.
   * Bảng điện tử là chỗ người chơi TRẢ TIỀN để đọc, nên nó phải nói cả khoản này —
   * không thì bảng hứa một con số mà vòng chốt phiên trả về một con số khác.
   */
  dong_tien?: 'coupon';
  /** v42 (D311) — sàn không cho bán khống mã này. Chỉ có mặt khi `khongTheoMa` bật. */
  khong_duoc_khong?: true;
  /** Độ sâu sổ lệnh L — con số thật sự nạp vào tầng trượt giá. `null` khi sương mù. */
  do_sau: number | null;
  suong_mu: boolean;
  /**
   * Biên độ NHẤP NHÁY giữa hai nấc — CHỈ có khi `suong_mu`.
   *
   * ⚠ Founder chốt 26/07: nấc thật ĐƯỢC PHÉP nằm NGOÀI biên này. Biên là gợi ý,
   * không phải bảo đảm; người chơi tự chịu khoảng bất định đó.
   */
  bien?: readonly [NacThanhKhoan, NacThanhKhoan];
  /** Biên độ quy ra vạch pin, cùng thứ tự với `bien`. */
  bien_vach?: readonly [number, number];
}

export interface DongSoCai {
  /** Vòng sự kiện đã lật (1-indexed). */
  vong: number;
  su_kien: string;
  /** CHUỖI NGƯỜI CHƠI ĐỌC. */
  label: string;
  icon: string;
  /**
   * Độ lớn echo còn lại, thang 10.000 = 100% (engine cấp). `null` khi bị độ trễ
   * che — LUẬT 1.
   */
  do_lon_bp: number | null;
  /**
   * Số vòng CÒN HIỆU LỰC SAU vòng này (0 = vòng này là vòng cuối nó còn tác
   * động). `null` khi bị độ trễ che.
   */
  con_vong: number | null;
  /** `true` = echo ĐẢO (tin giả đã lộ). `null` = chưa tới lúc lộ, không bán. */
  dao: boolean | null;
  /**
   * Lực bp RÒNG nguồn này (kèm nhánh hệ quả F1/F2 của nó) đang kéo danh mục
   * HIỆN TẠI. `null` khi chưa đủ dữ kiện công khai để biết CHIỀU.
   *
   * ⚠ Neo vào danh mục lúc MỞ BẢNG, tức danh mục cuối vòng trước — bảng mở ở
   * đầu vòng, trước khi tái cơ cấu. Mua thêm lá là số này đổi. Đó là sự thật,
   * không phải lỗi: engine cũng chấm điểm theo danh mục lúc chốt phiên.
   */
  luc_bp: number | null;
  /** LUẬT 1 — dòng bị độ trễ che: mọi số là "?" (UI vẽ dấu hỏi). */
  an: boolean;
}

export interface BangDienTu {
  /** Vòng mà bảng này nói về — LẤY TỪ `st.vong`, không nhận tham số rời. */
  vong: number;
  /** Phí đã/sẽ bị trừ cho lần mở này (LUẬT 3). */
  phi: number;
  /** Chỉ báo 1 — sáu thanh thanh khoản. Bảng chỉ có HAI chỉ báo, đừng thêm. */
  thanh_khoan: readonly ThanhThanhKhoan[];
  so_cai: readonly DongSoCai[];
  /** Tổng lực kéo ròng của phần ĐÃ BIẾT (bp). */
  tong_rong_bp: number;
  /**
   * Số dòng sổ cái chưa đọc được (bị độ trễ, hoặc chưa lộ tin giả).
   * UI PHẢI nói ra con số này — nếu không, người chơi tưởng tổng ròng là đầy đủ.
   */
  so_dong_chua_ro: number;
  /**
   * Thanh thanh khoản đang GIẢ ĐỊNH tin đang nổ là THẬT.
   *
   * Vì sao phải giả định thay vì trả nấc thật: `nacHieuDung` chỉ siết sổ lệnh
   * khi tin THẬT (tin bịa không làm dòng tiền bốc hơi). Nên trả nấc thật lúc ô
   * hiện tại là Thiên nga đen / Chiến tranh / Bong bóng là BÁN LUÔN câu trả lời
   * "tin này giả hay thật" với giá 25 Vốn — giết sạch lớp kỹ năng hiệu chỉnh tin
   * giả (gate 17.6/G4) mà cả cơ chế map dựng ra để đo.
   *
   * Nên bảng trả con số SUY ĐƯỢC TỪ THÔNG TIN CÔNG KHAI: "sổ lệnh sẽ sâu bao
   * nhiêu NẾU tin này thật". Cùng một hàm engine, chỉ khác đầu vào là ô người
   * chơi đang thấy. Cờ này bật thì UI phải nói rõ — người chơi được sai, nhưng
   * không được bị lừa mà không có cách nào biết.
   */
  gia_dinh_tin_that: boolean;
  /**
   * D33 — bảng này đang chạy ở hạng SẠCH (người mở cầm thẻ Lướt Sóng): không độ
   * trễ, không sương mù. Gửi ra để UI nói rõ mình đang xem hạng nào — người chơi
   * trả ba mức giá khác nhau thì phải thấy được mình mua được gì.
   */
  sach: boolean;
  /**
   * v16 (founder 01/08): "thiên nga đen giờ chỉ còn là 1 icon pixel TRẠNG THÁI
   * trong bảng điện tử" — true khi một mặt ĐUÔI (5 mặt mới, hoặc thien_nga_den
   * của trận cũ) đang còn dư âm. Cái tên sống ở BẢNG — nơi dân chuyên nhìn
   * trạng thái — chứ không còn là một lá bài có xác suất niêm yết.
   */
  thien_nga: boolean;
  /**
   * K4 (D164) — VỊ TRÍ TRONG CHUỖI VĨ MÔ: chuỗi pha đang chạy (hướng · tuổi)
   * + môi trường tiền tệ. TOÀN BỘ gộp từ thông tin CÔNG KHAI (ô đã lật + mức
   * lãi đã công bố) — bảng bán phép GỘP như đếm bài, không bán đáp án.
   * ⚠ TUYỆT ĐỐI KHÔNG chở nhãn NGUỒN chuỗi (tien_re/tin_don/…) — latent,
   * addendum §7/D154: người chơi SUY từ tin-mở-chuỗi + môi trường, không đọc.
   * `null` khi chưa có ô pha nào lật (vòng 1).
   */
  chuoi_vi_mo: {
    huong: 'len' | 'xuong' | 'ngang'; dai: number;
    moi_truong: 're' | 'trung_tinh' | 'dat';
  } | null;
  /**
   * D33 — DỰ BÁO 3 TÊN thẻ khả năng cao ở vòng SAU. `null` khi không mua.
   *
   * ⚠ CHỈ TÊN. Không thứ tự theo xác suất, không hiện xác suất — founder chốt.
   * Và LUÔN có đúng `SO_TEN_SAI` tên bảo đảm SAI trong đó (phương án A): đặc
   * quyền là BIẾT HẸP HƠN, không phải BIẾT TRƯỚC.
   */
  du_bao: DuBaoOKe | null;
  /**
   * ═══ VAI / CẤP 2 LƯỚT SÓNG — XÁC THỰC TIN (founder 22/08) ═══
   *
   * *"pick 2 lõi Lướt Sóng thì lv2 sẽ cho phép thấy thêm những thứ giúp dự đoán
   * và xác thực thông tin (tin giả–thật) dễ dàng hơn."*
   *
   * Hai thứ, cả hai đều là CÔNG KHAI Ở MỨC CHỌN LỌC, không phải đáp án:
   *  · `xac_suat_gia_bp` — ô đang lật là SỰ KIỆN thì đây là xác suất nó GIẢ
   *    (`tyLeTinGiaHieuDung`, đúng con số bot hoài nghi đọc). Người chơi vẫn
   *    phải ĐOÁN, chỉ là đoán có cơ sở. Không phải sự kiện ⇒ null.
   *  · `lo_som` — tin giả của ô TRƯỚC lộ sớm một vòng, NHƯNG CHỈ khi ô trước là
   *    sự kiện ĐỤNG TỚI MÃ MÌNH ĐANG ÔM. Đội lái biết mã mình lái, không biết cả
   *    chợ. Lộ cả bàn là thành oracle (gate đo oracle nhất bàn 48% thắng) —
   *    quá mạnh, và giết luôn cơ chế tin giả với người mang vai.
   * `null` khi không ở cấp 2 — trận cũ không có trường này, API cũ không đổi.
   */
  xac_thuc: XacThucTin | null;
}

export interface XacThucTin {
  /** Xác suất ô ĐANG LẬT là tin giả (bp). null = ô không phải sự kiện. */
  xac_suat_gia_bp: number | null;
  /**
   * Tin giả của ô TRƯỚC, lộ sớm một vòng — chỉ khi ô trước đụng mã mình đang
   * ôm. null = không lộ (không phải sự kiện / không đụng mã mình / đã lộ rồi).
   */
  lo_som: { su_kien: string; label: string; la_tin_gia: boolean } | null;
}

/** Một tên trong danh sách dự báo — kèm nhãn người chơi đọc. */
export interface TenDuBao {
  kind: 'giai_doan' | 'su_kien';
  id: string;
  label: string;
  icon: string;
}

export interface DuBaoOKe {
  /** Vòng mà dự báo nói về (= vòng hiện tại + 1). */
  vong: number;
  /** Đúng `SO_TEN` tên, thứ tự XÁO — không phản ánh xác suất. */
  ten: readonly TenDuBao[];
  /** Bao nhiêu tên trong danh sách bảo đảm SAI. Hằng số, gửi ra để UI nói thật. */
  so_ten_sai: number;
}

// ---------------------------------------------------------------------------
// LUẬT 3 — phí mở bảng. PHẢI đi qua action_log, xem docstring dưới.
// ---------------------------------------------------------------------------

/**
 * Chuẩn hoá số lần mở bảng đọc từ payload client HOẶC từ `action_log`.
 *
 * ⚠ LỌC Ở ĐÂY, KHÔNG Ở TẦNG UI. `action_log` là nguồn dựng lại trận, nên một
 * giá trị rác lọt vào log là rác VĨNH VIỄN — không sửa được, và mỗi lần replay
 * nó lại trừ sai Vốn. Trần `TOI_DA_MOI_VONG` cũng cưỡng chế ở đây vì nội dung
 * bảng là hàm thuần của (seed, vòng): lần mở thứ hai không bán thêm gì.
 */
export function soLanMoBang(x: unknown): number {
  const n = Number(x ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(BANG_DIEN_TU.TOI_DA_MOI_VONG, Math.trunc(n)));
}

/**
 * HẠNG BẢNG mà một lần mở đang mua. Đây là thứ quyết định CẢ GIÁ lẫn nội dung,
 * nên nó phải là MỘT giá trị đi qua mọi tầng — không phải hai cờ rời rạc mà
 * tầng nào cũng có cơ hội đọc lệch.
 */
export interface HangBang {
  /** Người mở có thẻ Lướt Sóng → dữ liệu sạch, giá 80. */
  luot_song: boolean;
  /** Mua kèm dự báo 3 tên (+30). Chỉ có nghĩa khi `luot_song`. */
  du_bao: boolean;
  /**
   * CẤP 2 Lướt Sóng (hai bản sao) → thêm khối XÁC THỰC TIN. Không đổi giá:
   * founder gọi đây là "đặc quyền nâng cấp lõi", không phải một hạng mua thêm.
   * Vắng (API/trận cũ) = false.
   */
  cap2?: boolean;
}

export const HANG_BANG_THUONG: HangBang = { luot_song: false, du_bao: false };

/**
 * Phí thật sự thu được, kẹp trong Vốn hiện có (không đẩy Vốn xuống âm).
 *
 * ⚠ `hang` KHÔNG có mặc định là "hạng thường" một cách vô tình — nó có mặc định
 * để chỗ gọi cũ (trận trước D33, log không có `du_bao`) trả ra ĐÚNG con số cũ.
 * Bảng giá lấy từ `giaMoBang` trong config, không gõ lại ba con số ở đây.
 */
export function phiMoBang(
  von: number, soLan: number, hang: HangBang = HANG_BANG_THUONG,
): number {
  const muon = giaMoBang(hang.luot_song, hang.du_bao) * soLanMoBang(soLan);
  return Math.max(0, Math.min(von, muon));
}

/** Có đủ Vốn để mở thêm một lần? Tầng API dùng để từ chối SỚM, có thông báo rõ. */
export function coDuMoBang(von: number, hang: HangBang = HANG_BANG_THUONG): boolean {
  return von >= giaMoBang(hang.luot_song, hang.du_bao);
}

/**
 * Trừ phí mở bảng khỏi một ghế — HÀM THUẦN, trả trạng thái mới.
 *
 * `hang` quyết định GIÁ (80 / 100 / 110 — xem `giaMoBang`). Log của trận cũ
 * không có trường hạng ⇒ mặc định hạng thường ⇒ replay ra đúng con số cũ.
 *
 * ⚠⚠ ĐÂY LÀ CHỖ DỄ HỎNG LỊCH SỬ NHẤT CỦA CẢ TÍNH NĂNG. Trạng thái trận KHÔNG
 * lưu rời: mỗi request replay engine từ `action_log` (xem docstring
 * `migrations/0010_holdem.sql`). Nên lần mở bảng PHẢI nằm trong log và replay
 * PHẢI gọi hàm này ở đúng nhịp — nếu không, cùng một trận sẽ replay ra Vốn
 * KHÁC, im lặng, không lỗi, và không cách nào dựng lại được.
 *
 * Ghế đã cháy thì không thu: người cháy không có bảng để mở.
 */
export function apPhiMoBang(
  st: TrangThaiTran, gheId: string, soLan: number,
  hang: HangBang = HANG_BANG_THUONG,
): TrangThaiTran {
  const lan = soLanMoBang(soLan);
  if (lan <= 0) return st;
  return {
    ...st,
    ghe: st.ghe.map((g) => {
      if (g.id !== gheId || g.da_chay) return g;
      return { ...g, von: g.von - phiMoBang(g.von, lan, hang) };
    }),
  };
}

/**
 * Hạng bảng mà một ghế ĐƯỢC PHÉP mua — suy ở server, client chỉ vẽ (C4).
 *
 * `du_bao` chỉ mở khi có Lướt Sóng: nó là NẤC CAO HƠN của cùng một đặc quyền,
 * không phải một món bán riêng. Cho mua rời là bán đúng phần mạnh nhất của lá
 * bài cho người không cầm lá đó.
 */
export function hangBangCua(
  st: TrangThaiTran, gheId: string, muonDuBao: boolean,
): HangBang {
  const g = st.ghe.find((x) => x.id === gheId);
  const ls = st.dac_quyen === true
    && !!g && g.danh_muc.chien_thuat.includes('luot_song');
  return {
    luot_song: ls, du_bao: ls && muonDuBao,
    cap2: ls && !!g && capThe(g.danh_muc, 'luot_song') >= 2,
  };
}

// ---------------------------------------------------------------------------
// Che thông tin
// ---------------------------------------------------------------------------

/**
 * Cờ tin giả của ô vòng `vongSuKien` đã CÔNG KHAI ở đầu vòng `vongHienTai` chưa?
 *
 * `chotPhien` lộ tin giả của ô `st.vong - 1` khi kết vòng `st.vong` (trường
 * `tin_gia_lo`). Nên đứng ở ĐẦU vòng V, người chơi chỉ mới biết tới ô V−2.
 * Bảng điện tử không được đi trước mốc đó: đó chính là thứ gate 17.6 đo.
 *
 * ⚠ Ràng buộc này ĐƯỢC KHOÁ BẰNG TEST chạy thật qua `giaiQuyetVong` — sửa nhịp
 * lộ trong `chotPhien` mà quên đây là đỏ build (xem `tests/holdem_bang.test.ts`).
 */
export function daLoTinGia(vongSuKien: number, vongHienTai: number): boolean {
  return vongSuKien <= vongHienTai - 2;
}

/**
 * LUẬT 2 — biên độ nhấp nháy cho mã sương mù. TẤT ĐỊNH theo (seed, vòng, mã).
 *
 * Ba nấc chỉ có hai cặp liền kề, nên "biên độ" là một trong hai cặp đó. Với xác
 * suất `SUONG_MU_LECH_BP` bảng trả cặp KHÔNG chứa nấc đang tính — đó là cách
 * hiện thực hoá "nấc thật được phép nằm ngoài biên độ". Không có nhánh lệch này
 * thì biên thành bảo đảm (chỉ hẹp hơn một nấc), tức bán đúng thứ luật 2 không bán.
 */
function bienNhapNhay(
  seed: number, vong: number, tsId: string, nac: NacThanhKhoan, namNac = false,
): readonly [NacThanhKhoan, NacThanhKhoan] {
  // v54 (D395) — thang năm nấc có BỐN cặp liền kề; luật chọn cặp giữ nguyên.
  const THANG: readonly NacThanhKhoan[] = namNac ? NAC_NAM : NAC_THANH_KHOAN;
  const cap: (readonly [NacThanhKhoan, NacThanhKhoan])[] = [];
  for (let i = 0; i + 1 < THANG.length; i += 1) {
    cap.push([THANG[i]!, THANG[i + 1]!]);
  }
  const i = THANG.indexOf(nac);
  const chua = cap.filter(([a, b]) => a === nac || b === nac);
  const khong = cap.filter(([a, b]) => a !== nac && b !== nac);

  const lech = rngAt(seed, DOMAIN_SUONG_MU, vong, tsId)
    .chanceBp(BANG_DIEN_TU.SUONG_MU_LECH_BP);
  if (lech && khong.length > 0) {
    return khong[rngAt(seed, DOMAIN_SUONG_MU_CAP, vong, tsId).below(khong.length)]!;
  }
  if (chua.length === 0) return cap[Math.max(0, Math.min(cap.length - 1, i))]!;
  return chua[rngAt(seed, DOMAIN_SUONG_MU_CAP, vong, tsId).below(chua.length)]!;
}

/** Sự kiện có làm co giãn thanh khoản không — đọc từ config, không gõ lại danh sách. */
function suKienDongThanhKhoan(id: string): boolean {
  return THANH_KHOAN_DONG.MONG_DI_SU_KIEN.includes(id as never)
    || THANH_KHOAN_DONG.DAY_THEM_SU_KIEN.includes(id as never);
}

// ---------------------------------------------------------------------------
// D33 — DỰ BÁO 3 TÊN Ô KẾ (đặc quyền Lướt Sóng, nấc +30)
// ---------------------------------------------------------------------------

const DOMAIN_DU_BAO = 'bang_du_bao';

/** Khoá của một ô trong bảng xếp hạng ứng viên. */
const khoaO = (o: OThiTruong): string =>
  (o.kind === 'su_kien' ? `sk:${o.su_kien}` : `gd:${o.giai_doan}`);

/**
 * XẾP HẠNG ỨNG VIÊN CHO Ô KẾ — suy từ TRẠNG THÁI HIỆN TẠI (D34 điều 2).
 *
 * "Có tính cả dư âm đang chồng, giai đoạn, đồ thị nhân quả" — nên nó KHÔNG phải
 * đọc một nhãn có sẵn (khác hẳn `nghieng_ve`, thứ D34 điều 1 giữ nguyên công
 * khai). Trọng số dưới đây dùng lại ĐÚNG các bảng mà `sinhMap` dùng để rút ô:
 * `MT_SU_KIEN_KE_TIEP`, `SU_KIEN_THEO_GIAI_DOAN`, telegraph `bao_truoc`, và nền
 * "Đi ngang" của thị trường êm. Bịa một bảng trọng số thứ hai ở đây là bán cho
 * người chơi một bức tranh không khớp bộ sinh — lừa có thu phí.
 *
 * ⚠⚠ TÍNH TRÊN Ô NHƯ NGƯỜI CHƠI ĐANG THẤY (tin đang nổ coi như THẬT), ĐÚNG QUY
 * ƯỚC `gia_dinh_tin_that` của thanh thanh khoản. Nếu tính trên `la_tin_gia`
 * THẬT thì thứ hạng tự tố cáo tin hiện tại là thật hay bịa — bán luôn câu trả
 * lời mà cả cơ chế map dựng ra để đo (gate G4/17.6), với giá 110 Vốn. Đó là
 * đánh đổi CÓ Ý THỨC: dự báo sẽ SAI có hệ thống ngay sau một tin giả, và đó
 * chính là chỗ kỹ năng hiệu chỉnh tin giả vẫn còn giá trị.
 */
export function xepHangUngVien(
  st: TrangThaiTran,
): { key: string; kind: 'giai_doan' | 'su_kien'; id: string; w: number }[] {
  const V = st.vong;
  const oNay = st.map.o[V - 1];
  // Ô như người chơi thấy: cờ tin giả bị coi như KHÔNG có.
  const nhinThay: OThiTruong | undefined = oNay?.kind === 'su_kien'
    ? { ...oNay, la_tin_gia: false } : oNay;

  const ra: { key: string; kind: 'giai_doan' | 'su_kien'; id: string; w: number }[] = [];

  /*
   * Xác suất ô kế là SỰ KIỆN. `sinhMap` cấm hai ô sự kiện liền nhau, nên ngay
   * sau một ô sự kiện thì nhánh sự kiện có trọng số 0 — đó cũng là thông tin
   * công khai (người chơi thấy ô hiện tại), không rò rỉ gì.
   */
  const duocSuKien = nhinThay?.kind !== 'su_kien'
    && V + 1 >= NHA_CAI.KHONG_SU_KIEN_TRUOC_VONG;
  const pSk = duocSuKien ? NHA_CAI.TY_LE_O_SU_KIEN_BP : 0;

  // ── Nhánh SỰ KIỆN: dây chuyền nhân quả + luật theo giai đoạn liền trước ──
  if (pSk > 0) {
    // Nguồn dây chuyền = sự kiện gần nhất mà người chơi TIN là thật.
    const nguon = st.map.o.slice(0, V).reverse()
      .find((x): x is OThiTruong & { kind: 'su_kien' } => (
        x.kind === 'su_kien' && (x === oNay ? true : !x.la_tin_gia)));
    // v35: một cửa mtKeTiep — dự báo phải xếp hạng bằng ĐÚNG bảng map dùng
    // để sinh ô, không thì ứng viên "N tên sai" lệch khỏi phân phối thật (D33).
    const keTiep = nguon ? mtKeTiep(st.chuoi_mo_rong === true)[nguon.su_kien] : undefined;
    const gdTruoc: GiaiDoanId | null =
      nhinThay?.kind === 'giai_doan' ? nhinThay.giai_doan : null;

    let tong = 0;
    const tho = SU_KIEN.map((x) => {
      const nen = 1000 + (keTiep?.[x.id] ?? 0);
      const luat = gdTruoc
        ? SU_KIEN_THEO_GIAI_DOAN.find(
          (r) => r.su_kien === x.id && r.sau_giai_doan === gdTruoc)
        : undefined;
      const w = luat ? applyBpInt(nen, luat.he_so_bp) : nen;
      tong += w;
      return { id: x.id as SuKienId, w };
    });
    for (const t of tho) {
      ra.push({
        key: `sk:${t.id}`, kind: 'su_kien', id: t.id,
        w: tong > 0 ? Math.round((pSk * t.w) / tong) : 0,
      });
    }
  }

  // ── Nhánh GIAI ĐOẠN: nền "Đi ngang" + telegraph của tin THẬT liền trước ──
  {
    const pGd = 10000 - pSk;
    let tong = 0;
    /*
     * v36 R4 (D167) — DỰ BÁO PHẢI XẾP HẠNG BẰNG MÁY ĐANG SINH Ô.
     *
     * Trận chạy `regimeTick` thì mặt ô rút từ máy tick (nền sống → thuận/nghỉ/
     * biến động; nền ngang → nghỉ/biến động/mở hướng), KHÔNG còn từ bảng nền
     * 3000/1500. Giữ bảng cũ là bán một phân phối KHÔNG TỒN TẠI: bảo đảm "có
     * đúng N tên SAI" của đặc quyền Lướt Sóng vỡ im lặng (D33/D152 VỠ #4), mà
     * người chơi vừa TRẢ tiền cho con số đó.
     *
     * ⚠ Chỉ dùng thông tin CÔNG KHAI: hướng/tuổi nền lấy từ `chuoiDangChay`
     * trên ô ĐÃ LẬT (chính con số bảng K4 đang bán), KHÔNG đọc `nguonMoChuoi`
     * (latent, addendum §7) — nên đây là phân phối "gần đúng" theo hình dạng
     * máy tick, đúng tinh thần "bảng dọn dữ liệu thô, không giải ngược engine".
     */
    const tick = st.regime_tick === true;
    const run = tick ? chuoiDangChay(st.map.o, V + 1) : null;
    const thuan: GiaiDoanId | null = run
      ? (run.huong === 1 ? 'tang' : run.huong === -1 ? 'giam' : null) : null;
    const tho = GIAI_DOAN.map((g) => {
      let w: number;
      if (!tick) {
        w = g.id === 'di_ngang' ? 3000 : 1500;
      } else if (thuan) {
        // Nền SỐNG: mặt ngược hướng không tồn tại (nó chính là cú gãy), nên
        // chỉ ba cửa sống + hai cửa gãy — cùng hình dạng nhánh máy tick.
        w = g.id === thuan ? REGIME_TICK.MAT_THUAN_BP
          : g.id === 'di_ngang' ? REGIME_TICK.MAT_NGHI_BP + REGIME_TICK.GAY_VE_NGANG_BP
            : g.id === 'bien_dong'
              ? REGIME_TICK.MAT_BIEN_DONG_BP + REGIME_TICK.GAY_BIEN_DONG_BP
              : g.id === 'phuc_hoi' ? 0
                : (thuan === 'tang' ? REGIME_TICK.GAY_DAO_HUONG_BP : 0);
      } else {
        w = g.id === 'di_ngang' ? REGIME_TICK.NGANG_NGHI_BP
          : g.id === 'bien_dong' ? REGIME_TICK.NGANG_BIEN_DONG_BP
            : g.id === 'phuc_hoi' ? 0 : REGIME_TICK.NGANG_MO_HUONG_BP;
      }
      if (nhinThay?.kind === 'su_kien' && g.id === nhinThay.bao_truoc) {
        w += NHA_CAI.SUC_MANH_TELEGRAPH_BP;
      }
      tong += w;
      return { id: g.id, w };
    });
    for (const t of tho) {
      ra.push({
        key: `gd:${t.id}`, kind: 'giai_doan', id: t.id,
        w: tong > 0 ? Math.round((pGd * t.w) / tong) : 0,
      });
    }
  }

  // Hoà thì xếp theo khoá — tất định, không phụ thuộc thứ tự duyệt.
  return ra.sort((a, b) => (b.w - a.w) || (a.key < b.key ? -1 : 1));
}

const nhanO = (kind: 'giai_doan' | 'su_kien', id: string): TenDuBao => {
  if (kind === 'su_kien') {
    const sk = SU_KIEN.find((x) => x.id === id);
    return { kind, id, label: sk?.label ?? id, icon: sk?.icon ?? '•' };
  }
  const gd = GIAI_DOAN.find((x) => x.id === id);
  return { kind, id, label: gd?.label ?? id, icon: gd?.icon ?? '•' };
};

/**
 * Dựng danh sách 3 tên — PHƯƠNG ÁN A: LUÔN chèn `SO_TEN_SAI` tên bảo đảm SAI.
 *
 * ─── VÌ SAO PHẢI CHÈN, KỂ CẢ KHI ENTROPY CAO ───────────────────────────────
 * Entropy TRUNG BÌNH của ô kế đo được là 8,75 ứng viên hiệu dụng (map 8) — rộng.
 * Nhưng TRUNG BÌNH không phải là thứ cân bằng: hành lang `bong_bong(thật) → tăng`
 * đo ra CHỈ 2,5 ứng viên với top-3 phủ 88%, vì `BONG_BONG.CHUOI_PHONG` đang ép
 * hai ô liền. Không chèn tên sai thì ở đúng hành lang ấy — hành lang đắt giá
 * nhất của cả trận — dự báo GẦN BẰNG đáp án. Chèn vô điều kiện thì mọi hành lang
 * đều là "biết hẹp hơn", và người chơi không phải học một luật có ngoại lệ.
 *
 * Tên sai lấy từ ứng viên NẶNG NHẤT mà không phải đáp án — cố ý: một tên sai
 * hiển nhiên (ứng viên gần như không thể) sẽ tự loại mình và danh sách 3 lại co
 * về 2. Tên sai phải TRÔNG NHƯ THẬT thì nó mới làm được việc của nó.
 *
 * Xáo thứ tự bằng RNG địa chỉ hoá theo (seed, vòng): tất định — mở lại bảng
 * trong cùng vòng ra đúng danh sách đó, và replay ra y hệt.
 */
export function dungDuBao(st: TrangThaiTran): DuBaoOKe | null {
  const oKe = st.map.o[st.vong];
  if (!oKe) return null;   // vòng cuối: không có ô sau để mà báo

  const that = khoaO(oKe);
  const hang = xepHangUngVien(st);
  const soThat = DAC_QUYEN.LUOT_SONG.SO_TEN - DAC_QUYEN.LUOT_SONG.SO_TEN_SAI;

  const chon = hang.slice(0, soThat);
  const daLay = new Set(chon.map((x) => x.key));
  for (const x of hang) {
    if (chon.length >= DAC_QUYEN.LUOT_SONG.SO_TEN) break;
    if (x.key === that || daLay.has(x.key)) continue;
    chon.push(x);
    daLay.add(x.key);
  }

  // Xáo Fisher–Yates tất định — thứ tự KHÔNG được phản ánh xác suất (founder).
  const rng = rngAt(st.seed, DOMAIN_DU_BAO, st.vong);
  for (let i = chon.length - 1; i > 0; i -= 1) {
    const j = rng.below(i + 1);
    [chon[i], chon[j]] = [chon[j]!, chon[i]!];
  }

  return {
    vong: st.vong + 1,
    ten: chon.map((x) => nhanO(x.kind, x.id)),
    so_ten_sai: DAC_QUYEN.LUOT_SONG.SO_TEN_SAI,
  };
}

/**
 * Vạch pin sáng theo nấc. v54 (D395): thang năm nấc ⇒ năm vạch, vạch = thứ tự nấc (cạn 1 … rất dày 5);
 * thang ba nấc giữ `VACH_THEO_NAC` như cũ.
 */
const vachCua = (nac: NacThanhKhoan, namNac = false): number =>
  (namNac ? NAC_NAM.indexOf(nac) + 1 : BANG_DIEN_TU.VACH_THEO_NAC[nac as ThanhKhoan]);
const tongVach = (namNac: boolean): number => (namNac ? NAC_NAM.length : BANG_DIEN_TU.SO_VACH);

const nhanSuKien = (id: string): { label: string; icon: string } => {
  const sk = SU_KIEN.find((x) => x.id === id);
  return { label: sk?.label ?? id, icon: sk?.icon ?? '•' };
};

// ---------------------------------------------------------------------------
// Dựng bảng
// ---------------------------------------------------------------------------

/**
 * CHỈ BÁO 1 — THANH KHOẢN NHƯ NGƯỜI CHƠI ĐANG THẤY (ô đã lật gần nhất, tin coi là THẬT, lãi suất nhìn thấy).
 *
 * v54 (D395) — TÁCH RA để HAI chỗ đọc chung MỘT phép tính: Bảng điện tử (trả phí, lúc quyết) và thước
 * thanh khoản của dải 6 mã (miễn phí, CHỈ trong nhịp lật sau chốt — `ket_qua_vong.thanh_khoan_vong`).
 * Hai bản tính thì có ngày bảng nói một nấc còn dải nói nấc khác (D61) — đúng thứ `nacHieuDung` cấm.
 * `sach` = hạng SẠCH của thẻ Lướt Sóng (gỡ sương mù); thước miễn phí luôn `false` ⇒ mã đầu cơ vẫn chỉ có
 * biên độ, luật 2 của bảng không bị thủng qua cửa miễn phí.
 */
export function thanhKhoanCongKhai(
  st: TrangThaiTran, sach = false,
): { thanh_khoan: ThanhThanhKhoan[]; gia_dinh_tin_that: boolean } {
  const o = st.map.o[vongDaLat(st) - 1];
  const V = st.vong;
  // CHỈ BÁO 1 — THANH SỨC KHOẺ THANH KHOẢN ĐỘNG ─────────────────────────
  /*
   * Ô NHƯ NGƯỜI CHƠI ĐANG THẤY: tin đang nổ tạm coi là THẬT. Xem
   * `gia_dinh_tin_that` — trả nấc thật ở đây là bán cờ tin giả với giá 25 Vốn.
   * Đây cũng đúng quy ước telegraph đã có: bảng nói "tin này thường kéo theo
   * gì", cố ý không nói nó thật hay giả.
   */
  const oNhinThay: OThiTruong | undefined = o && o.kind === 'su_kien'
    ? { ...o, la_tin_gia: false } : o;
  const namNac = st.thanh_khoan_nam_nac === true;
  const giaDinhTinThat = THANH_KHOAN_DONG.BAT !== 0
    && o !== undefined && o.kind === 'su_kien'
    && (namNac ? suKienDichNacNam(o.su_kien) : suKienDongThanhKhoan(o.su_kien));

  const thanhKhoan: ThanhThanhKhoan[] = TAI_SAN.map((ts) => {
    /*
     * ⚠ TRUYỀN LÃI SUẤT VÀO ĐÂY (v26) — nếu không thì bảng vẽ thanh pin bằng
     * một nấc khác với nấc engine đang tính trượt giá. Chính docstring của
     * `nacHieuDung` gọi đó là "lỗi tệ nhất có thể ở đây: bảng sẽ dạy người chơi
     * sai và họ không cách nào biết". Một nguồn, hai chỗ đọc.
     */
    /*
     * v53 (D373) — chưa ô nào lật (vòng 1) ⇒ đọc bằng một ô ĐI NGANG: `nacHieuDung` không
     * dịch nấc ở pha đi ngang, nên đây là "nấc nền, chưa có tin" chứ không phải một ô bịa.
     * Lãi suất cũng lấy mức NHÌN THẤY — mức sau kỳ họp chưa lật thì dịch nấc theo nó là lộ.
     */
    const nac = nacHieuDung(ts, oNhinThay ?? O_TRUNG_TINH, laiSuatThayDuoc(st), namNac);
    // D33 — hạng SẠCH gỡ sương mù. `!sach &&` đứng trước để đọc được
    // ngay rằng đây là điều kiện MỚI, không phải một sửa đổi trong danh sách mã.
    const suongMu = !sach && BANG_DIEN_TU.MA_SUONG_MU.includes(ts.id);
    if (!suongMu) {
      return {
        tai_san_id: ts.id, label: ts.label, icon: ts.icon,
        nac_nen: ts.thanh_khoan, vach_nen: vachCua(ts.thanh_khoan, namNac), nac, vach: vachCua(nac, namNac),
        tong_vach: tongVach(namNac), do_sau: doSauCuaNac(nac, namNac), suong_mu: false,
        // v42 (D311) — hai dấu của mã, chỉ khi cổng bật (trận cũ không có trường này).
        ...(st.coupon_tpcp === true && ts.dong_tien === 'coupon'
          ? { dong_tien: 'coupon' as const } : {}),
        ...(st.khong_theo_ma === true && !ts.khong_duoc
          ? { khong_duoc_khong: true as const } : {}),
      };
    }
    const bien = bienNhapNhay(st.seed, V, ts.id, nac, namNac);
    return {
      tai_san_id: ts.id, label: ts.label, icon: ts.icon,
      nac_nen: ts.thanh_khoan, vach_nen: vachCua(ts.thanh_khoan, namNac), nac: null, vach: null,
      tong_vach: tongVach(namNac), do_sau: null, suong_mu: true,
      bien,
      bien_vach: [vachCua(bien[0], namNac), vachCua(bien[1], namNac)] as const,
    };
  });
  return { thanh_khoan: thanhKhoan, gia_dinh_tin_that: giaDinhTinThat };
}

/**
 * Dựng dữ liệu Bảng điện tử cho ghế `gheId` ở vòng `st.vong`.
 *
 * ⚠ CỐ Ý KHÔNG nhận tham số `vong` rời dù nhiệm vụ mô tả "trạng thái + số vòng":
 * `st.vong` và một tham số rời là hai nguồn chân lý cho cùng một con số, và
 * chúng sẽ lệch đúng lần đầu ai đó gọi sai — kiểu bug mà TypeScript không hé
 * lời (hai biến cùng kiểu `number`). Muốn bảng của vòng khác thì replay tới
 * vòng đó.
 *
 * KHÔNG trừ phí. Phí là chuyện của `apPhiMoBang` + `action_log` — trộn vào đây
 * là mỗi lần vẽ lại UI người chơi mất thêm 25 Vốn.
 *
 * ─── D33 — HẠNG SẠCH CỦA THẺ LƯỚT SÓNG ─────────────────────────────────────
 * `hang.luot_song` gỡ ĐÚNG HAI lớp che đã dựng ở đây: độ trễ 1 vòng của sổ cái
 * (LUẬT 1) và sương mù của BTC/CP CN (LUẬT 2). KHÔNG gỡ lớp thứ ba —
 * `gia_dinh_tin_that` — vì đó không phải một lớp che mà là ranh giới thông tin
 * ẩn của cả trò chơi: bán cờ tin giả là giết gate G4, và không lá bài nào được
 * phép mua điều đó.
 */
export function dungBangDienTu(
  st: TrangThaiTran, gheId = 'ban', hang: HangBang = HANG_BANG_THUONG,
): BangDienTu {
  const g = st.ghe.find((x) => x.id === gheId);
  if (!g) throw new Error(`Bảng điện tử: không có ghế "${gheId}"`);
  /*
   * v53 (D373) — BẢNG ĐỌC Ô ĐÃ LẬT GẦN NHẤT. Tới v52 ô của vòng nằm ngửa nên bảng đọc nó là
   * đúng; từ v53 ô ấy còn úp, mà bảng nói về NÓ ở ba chỗ (nấc thanh khoản · giả định tin thật
   * · xác suất tin giả) — cả ba đều sẽ là cửa sau để moi ra ô chưa lật, với giá 25 Vốn.
   * ⚠ Vòng 1 ở v53 chưa ô nào lật ⇒ `undefined` ⇒ bảng chạy nhánh "không có ô" (nấc NỀN,
   * không giả định gì). KHÔNG ném: mở bảng ở vòng 1 là một cú bấm hợp lệ.
   * ⚠ `V` (dưới) vẫn là `st.vong` — sổ echo và chuỗi vốn chỉ đọc ô ĐÃ lật (`i < vong - 1`),
   * nên chúng đúng ở cả hai luật; đổi `V` là làm bảng trễ thêm một vòng vô cớ.
   */
  const o = st.map.o[vongDaLat(st) - 1];
  if (!o && st.o_up !== true) {
    throw new Error(`Bảng điện tử: vòng ${st.vong} vượt quá map ${st.map.o.length} ô`);
  }

  const V = st.vong;

  const { thanh_khoan: thanhKhoan, gia_dinh_tin_that: giaDinhTinThat } =
    thanhKhoanCongKhai(st, hang.luot_song);

  // ── CHỈ BÁO 2 — SỔ CÁI ECHO TÍCH LUỸ, ĐÃ ÁP ĐỘ TRỄ ─────────────────────
  /*
   * LUẬT 1 — vòng đầu tiên bị che tính ngược từ vòng hiện tại. `DO_TRE_VONG = 1`
   * ⇒ che đúng ô vừa lật đầu vòng này. Viết theo hằng số (không hard-code "ô
   * hiện tại") để nâng độ trễ lên 2 là tự động che thêm ô vòng trước — nếu không
   * thì hằng số chỉ là trang trí.
   */
  // D33 — hạng SẠCH bỏ độ trễ: `cheTu = V + 1` nghĩa là không ô nào rơi vào cửa
  // sổ che (mọi `e.vong ≤ V`), và vòng lặp "phần bị che" bên dưới không chạy.
  const doTre = hang.luot_song ? 0 : BANG_DIEN_TU.DO_TRE_VONG;
  const cheTu = V - doTre + 1;
  const oTaiSan = [...new Set(g.danh_muc.tai_san)];

  const soCai: DongSoCai[] = [];
  // v35 — bảng phải truyền ĐÚNG cờ cộng hưởng engine dùng (một nguồn, không
  // thì con số bảng hứa và con số chốt phiên lệch nhau — lừa có thu phí).
  const chTruAn = coCongHuongTruAn(st, V);
  for (const e of echoCua(st, V)) {
    if (e.vong >= cheTu) continue;   // sẽ được thêm lại ở nhánh CHE dưới
    const tuoi = V - e.vong;
    const daLo = daLoTinGia(e.vong, V);
    // v18 — bảng phải nói ĐÚNG lực engine đang tính: engine bỏ nhánh F1/F2
    // khỏi giá thì bảng cũng bỏ, không thì bảng dạy một lực không tồn tại.
    const nguonE = st.bo_nhanh_he_qua === true ? [e] : [e, ...nhanhHeQua(e)];
    const luc = daLo
      ? machEcho(nguonE, oTaiSan, g.danh_muc, (id) => sucCangLuc(st, id), (d) => apChuKyBienDo(st, d), chTruAn, boMaTranCua(st))
        .reduce((s, x) => s + x.delta_bp, 0)
      : null;
    soCai.push({
      vong: e.vong, ...nhanSuKien(e.su_kien),
      su_kien: e.su_kien,
      do_lon_bp: e.do_lon_bp,
      con_vong: Math.max(0, NHA_CAI.SO_VONG_ECHO - 1 - tuoi),
      dao: daLo ? e.dao : null,
      luc_bp: luc,
      an: false,
    });
  }

  // Phần BỊ CHE: sự kiện trong cửa sổ độ trễ. Người chơi ĐÃ thấy ô lật nên tên
  // sự kiện không phải bí mật — thứ bị che là SỐ, để họ tự cộng nhẩm (LUẬT 1).
  for (let r = Math.max(1, cheTu); r <= V; r += 1) {
    const oR = st.map.o[r - 1];
    if (!oR || oR.kind !== 'su_kien') continue;
    soCai.push({
      vong: r, ...nhanSuKien(oR.su_kien), su_kien: oR.su_kien,
      do_lon_bp: null, con_vong: null, dao: null, luc_bp: null, an: true,
    });
  }
  soCai.sort((a, b) => a.vong - b.vong);

  return {
    vong: V,
    phi: giaMoBang(hang.luot_song, hang.du_bao),
    thanh_khoan: thanhKhoan,
    so_cai: soCai,
    tong_rong_bp: soCai.reduce((s, d) => s + (d.luc_bp ?? 0), 0),
    so_dong_chua_ro: soCai.filter((d) => d.luc_bp === null).length,
    gia_dinh_tin_that: giaDinhTinThat,
    sach: hang.luot_song,
    thien_nga: echoCua(st, V).some((e) =>
      e.su_kien in DUOI_5MAT || e.su_kien === 'thien_nga_den'),
    chuoi_vi_mo: (() => {
      const c = chuoiDangChay(st.map.o, V);
      if (c.dai === 0) return null;
      return {
        huong: c.huong === 1 ? 'len' as const
          : c.huong === -1 ? 'xuong' as const : 'ngang' as const,
        dai: c.dai,
        moi_truong: moiTruongTienTe(
          st.map.trang_thai?.[V - 2]?.lai_suat_diem ?? LAI_SUAT_NEN.KHOI_DIEM),
      };
    })(),
    du_bao: hang.du_bao ? dungDuBao(st) : null,
    xac_thuc: hang.cap2 === true ? dungXacThuc(st, g) : null,
  };
}

/**
 * CẤP 2 LƯỚT SÓNG — XÁC THỰC TIN. Xem `BangDienTu.xac_thuc` cho lý lẽ hai vế.
 *
 * ⚠ Vế `lo_som` đọc `la_tin_gia` THẬT của ô trước — thứ `oCongKhai` cắt khỏi
 * payload. Nó được phép ở đây vì (a) chỉ mở cho ghế ở cấp 2, (b) CHỈ khi ô trước
 * đụng mã ghế đang ôm, (c) ô trước sẽ lộ ở vòng kế dù sao — đây là lộ SỚM một
 * vòng, không phải lộ thứ không bao giờ lộ. Vế `xac_suat_gia_bp` là số công
 * khai sẵn (bot hoài nghi đọc cùng số), chỉ chưa từng bày cho người.
 */
/**
 * Mã bị sự kiện đánh MẠNH NHẤT (|bp| lớn nhất). null nếu ma trận không có.
 *
 * `bo` optional vì hàm không nhận `st` — nơi gọi (`dungXacThuc`, có `st`)
 * truyền bộ vào, cùng lý do `machEcho`/`mtGiaiDoan` — một cửa, xem config.
 */
export function maTamBao(suKien: string, bo: BoMaTran = 'v40'): string | null {
  let ra: string | null = null; let max = 0;
  for (const t of TAI_SAN) {
    const x = Math.abs(mtSuKien(bo)[t.id]?.[suKien as never] ?? 0);
    if (x > max) { max = x; ra = t.id; }
  }
  return ra;
}

export function dungXacThuc(
  st: TrangThaiTran, g: { danh_muc: { tai_san: readonly string[] } },
): XacThucTin {
  const V = st.vong;
  const o = st.map.o[V - 1];
  const oTruoc = st.map.o[V - 2];

  const xacSuatGiaBp = o && o.kind === 'su_kien' && st.map_v28 === true
    ? tyLeTinGiaHieuDung(
      o.boi_canh, o.su_kien,
      st.map.trang_thai?.[V - 2]?.lai_suat_diem ?? LAI_SUAT_NEN.KHOI_DIEM,
      st.chu_ky_thuc_te === true)
    : null;

  let loSom: XacThucTin['lo_som'] = null;
  if (oTruoc && oTruoc.kind === 'su_kien' && !daLoTinGia(V - 1, V)) {
    /*
     * ⚠⚠ LUẬT "ĐỤNG MÃ MÌNH" ĐÃ BỊ ĐO RA LÀ RÒ 97%: ma trận `MT_TAI_SAN_SU_KIEN`
     * cho gần như MỌI sự kiện đụng MỌI mã (70/72 cặp khác 0). Dùng "có đụng"
     * làm cổng thì ai cầm một mã bất kỳ cũng được lộ sớm cả chợ — tức oracle.
     * Luật đúng: mỗi sự kiện có ĐÚNG MỘT mã TÂM BÃO (|tác động| lớn nhất); đội
     * lái chỉ biết sớm khi đang ĐỨNG ĐÚNG TÂM. Nghĩa là "xác thực thứ mình đang
     * lái", không phải "đọc lén cả bàn".
     */
    const tamBao = maTamBao(oTruoc.su_kien, boMaTranCua(st));
    if (tamBao !== null && g.danh_muc.tai_san.includes(tamBao)) {
      loSom = {
        su_kien: oTruoc.su_kien,
        label: SU_KIEN.find((x) => x.id === oTruoc.su_kien)?.label ?? oTruoc.su_kien,
        la_tin_gia: oTruoc.la_tin_gia,
      };
    }
  }
  return { xac_suat_gia_bp: xacSuatGiaBp, lo_som: loSom };
}
