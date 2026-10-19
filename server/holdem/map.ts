/**
 * MARKET HOLD'EM — SINH MAP TẤT ĐỊNH (D24 mục 16.8 + 17).
 *
 * Map = chuỗi ô úp, lật 1 ô/vòng. Ô là Giai đoạn nền hoặc Sự kiện.
 *
 * ─── BA TÍNH CHẤT PHẢI GIỮ ─────────────────────────────────────────────────
 *
 * 1. TẤT ĐỊNH TUYỆT ĐỐI. Cùng seed → cùng map, từng ô, kể cả thật/giả. Cú
 *    tung "tin này giả hay thật" resolve NGAY LÚC SINH MAP từ seed, KHÔNG
 *    random sống lúc chơi (17.3). Người chơi không biết; seed biết; replay và
 *    verify nguyên vẹn.
 *
 * 2. NHÂN QUẢ, KHÔNG PHẢI RÚT ĐỘC LẬP (17.1). Nền là Đi ngang; thị trường êm
 *    cho tới khi có tin làm nó động. Sự kiện THẬT kéo ô kế nghiêng về giai
 *    đoạn nó báo trước (telegraph). Sự kiện GIẢ thì không — ô kế giữ nguyên
 *    như chưa có gì, và echo đảo lại.
 *
 * 3. THÀNH PHẦN CÔNG KHAI, THỨ TỰ BÍ MẬT (16.8). Người chơi tra được "còn 5 ô,
 *    thống kê 2 có thể là Giảm" → đếm bài được → timeline thành chiến thuật
 *    chứ không phải hên xui thuần. `thanhPhanCongKhai()` phục vụ đúng việc đó
 *    và CỐ Ý không lộ thứ tự.
 */
import {
  BONG_BONG, BONG_BONG_V27, CHU_KY, DUOI_5MAT, GIAI_DOAN, LAI_SUAT_NEN, LICH_CHINH_SACH,
  boMaTranCua, MAP_V28, MARKOV_NGUON, mtGiaiDoan, TUONG_TAC_THE, type BoMaTran,
  type TinhChatPha,
  dichLaiSuat, heSoKeTiepMoiTruong, hoSoMap, moiTruongTienTe, mtKeTiep,
  tyLeTinGiaHieuDung, type NguonChuoi,
  mtSuKien, NHA_CAI, QUAN_TINH, SU_KIEN, SUC_CANG, TINH_CHAT_NEN,
  suKienTheoGiaiDoan, TAI_SAN, TY_LE_TIN_GIA_THEO_BOI_CANH,
  type BoiCanhTin, type GiaiDoanId, type HuongChinhSach, type SuKienId,
  banSacBp, thamSoBongBong, thamSoTick, TY_LE_TIN_GIA_THUC_TE, BONG_BONG_PHONG_TIEP_BP,
} from '../../config/holdem.js';
import { BANH_XE_MUA, MUA_CHINH } from '../../config/banh_xe_mua.js';
import { BOI_CANH_DAI_HAN, type BanhXeBoiCanh, type BoiCanhId } from '../../config/boi_canh_dai_han.js';
import { boiCanhDaiHan, idBoiCanh, nghiengKyHop, noCua, PHAN_BCDH, phanBcdhBat, songCua } from './boi_canh_dai_han.js';
import { LUAT_LA } from '../../config/luat_la.js';
import { applyBpInt, assertSeedPartSafe, rngAt, type Rng } from '../sandbox/rng.js';
import {
  giaiMat, heQuaSaiLam, huongLaiSuatGanNhat, moCuaBongBongSauGiam, tinHopLe,
} from './luat_la.js';

export interface ONenGiaiDoan {
  kind: 'giai_doan';
  giai_doan: GiaiDoanId;
  /** D560 — tính chất của lá pha (khoá chu kỳ có ngòi). Vắng ở mọi map cũ ⇒ hash map cũ nguyên. */
  tinh_chat?: TinhChatPha;
}

export interface OSuKien {
  kind: 'su_kien';
  su_kien: SuKienId;
  /**
   * TIN GIẢ. Người chơi KHÔNG được thấy trường này cho tới khi nó lộ ở vòng
   * kế — tầng API phải lọc. Ở đây có mặt vì engine cần để tính echo.
   */
  la_tin_gia: boolean;
  /**
   * NHÃN ĐỘ TIN — CÔNG KHAI, khác hẳn `la_tin_gia`.
   *
   * 'noi_chuoi' = tin này khớp dây chuyền của tin trước → ít khả năng dựng.
   * 'don_doc'   = tin đứng một mình, không có gì chống lưng → dễ dựng hơn.
   *
   * Tính từ sự kiện gần nhất BẤT KỂ thật/giả, nên nó KHÔNG rò rỉ `la_tin_gia`.
   * Đây là thứ người chơi hiệu chỉnh dựa vào — phải render vô điều kiện (R1).
   */
  boi_canh: BoiCanhTin;
  /** Giai đoạn mà tin này báo trước (chỉ có tác dụng nếu tin THẬT). */
  bao_truoc: GiaiDoanId;
}

export type OThiTruong = ONenGiaiDoan | OSuKien;

/*
 * ─── MÁY TRẠNG THÁI CHU KỲ TÍN DỤNG — BƯỚC 1 (03-chu-ky-tin-dung §1) ────────
 *
 * Thẻ không còn là cú xúc xắc rời: nó là QUAN SÁT của một trạng thái, và trạng
 * thái bị chính thẻ vừa lật làm thay đổi. Bước 1 chỉ dựng CẤU TRÚC: máy chạy,
 * ghi lại trạng thái từng ô, nhưng ma trận phát điền đúng phân phối cũ và sức
 * căng KHOÁ 0 ⇒ chuỗi ô byte-hệt engine cũ (gate 7.1, holdem_map_regression).
 * Hành vi mới (lịch chính sách, quán tính, sức căng) vào TỪNG BƯỚC sau, mỗi
 * bước một gate — không đổi thế giới và thước đo cùng lúc.
 */

/** Thứ tự mã CỐ ĐỊNH của mảng `suc_cang_bp` — đổi thứ tự là hỏng dữ liệu cũ. */
export const THU_TU_MA_SUC_CANG: readonly string[] = TAI_SAN.map((t) => t.id);

/**
 * Trạng thái máy TẠI Ô — ghi vào events (§8.3) nên mọi field là append-only:
 * đổi nghĩa một field = hỏng dữ liệu đã ghi, chỉ được THÊM field mới.
 */
export interface TrangThaiO {
  /** Giai đoạn nền của máy NGAY TRƯỚC khi phát ô này (market_state). */
  giai_doan_nen: GiaiDoanId;
  /**
   * Chuỗi hiện hành SAU khi tính ô này: hướng (tăng/phục hồi = 1, giảm = −1,
   * đi ngang/biến động = 0) và độ dài. Ô sự kiện ĐÓNG BĂNG chuỗi (tin tức
   * không phải giá): không cộng, không reset.
   */
  run_huong: -1 | 0 | 1;
  run_dai: number;
  /**
   * Xác suất EX-ANTE (bp) của đúng mặt đã nổ, theo TRẠNG THÁI MÁY ngay trước
   * cú rút — không phải theo thông tin người chơi. Ô bị chuỗi ép = 10000.
   * Đây là mẫu số của cột calibration §17.4: so niềm tin người chơi với
   * xác suất thật mà máy đã dùng.
   */
  face_prior_bp: number;
  /** Sức căng S theo THU_TU_MA_SUC_CANG (bp). BƯỚC 1: khoá 0 toàn phần. */
  suc_cang_bp: readonly number[];
  /** Ô lịch chính sách (v11+). Trận ≤ v10b không có lịch → luôn false. */
  o_lich: boolean;
  /**
   * LÃI SUẤT NỀN SAU KHI Ô NÀY ĐÃ TÁC ĐỘNG (v26) — điểm, 1 điểm = 0,01%.
   *
   * ⚠ "SAU", không phải "trước": đây là con số người chơi đọc trên bảng khi ô đã
   * ngửa, nên nó phải là mức đang có hiệu lực từ giờ trở đi. Xác suất EX-ANTE
   * của chính ô này đã được ghi riêng ở `face_prior_bp`, tính bằng mức TRƯỚC —
   * hai câu hỏi khác nhau, hai trường khác nhau.
   * Cờ v26 tắt ⇒ luôn bằng `LAI_SUAT_NEN.KHOI_DIEM`, map cũ replay nguyên.
   */
  lai_suat_diem: number;
  /** Hướng hàm phản ứng KỲ VỌNG / hướng THỰC — chỉ có mặt trên ô lịch. */
  huong_cs_ky_vong?: HuongChinhSach;
  huong_cs_thuc?: HuongChinhSach;
  /** Mặt đuôi đã nổ. Hôm nay đuôi = thien_nga_den; chia 5 mặt là bước 7. */
  tail_face: SuKienId | null;
  /** §4.3 — ô lãi suất NGOÀI lịch (v15): độ tin telegraph công khai kèm theo. */
  ngoai_lich?: true;
  telegraph_bps?: number;
  /**
   * v54 (D389, cổng `banhXe`) — MÙA của bánh xe SAU khi tính ô này, và số ô pha đã qua trong
   * mùa. Chỉ có mặt ở map sinh bằng bánh xe (map ≤ v53 không có ⇒ hash cũ nguyên).
   * ⚠ LATENT — dữ liệu R&D, KHÔNG gửi client: thứ người chơi đọc là mặt lá + `xu_huong`
   * (hướng · tuổi, suy từ `run_huong`/`run_dai`). Gửi mùa ra màn là quyết định UI riêng.
   */
  mua?: GiaiDoanId;
  tuoi_mua?: number;
  /** D560 — loại của mùa ẩn (bò/gấu/đi ngang) SAU ô này. Chỉ map chu kỳ có ngòi. */
  loai_mua?: TinhChatPha;
  /**
   * D574 — BỐI CẢNH DÀI HẠN đang chạy ở ô này (sóng công nghệ × pha nợ; đổi được một lần ở kỳ họp chuyển nợ — từ ô SAU kỳ họp).
   * Chỉ map cổng `boiCanhDaiHan`. ⚠ LATENT như `mua`: không gửi client, không lật (founder 10/10).
   */
  boi_canh_dh?: BoiCanhId;
  /** D574 — ô NGAY SAU kỳ họp đổ đèo (Bẫy giá trị chuyển Căng): đầu cơ nghiêng `DO_DEO_BP` thay cho dòng bối cảnh. */
  do_deo?: true;
}

/** Ba tham số chu kỳ của map (bước 6) — chỉ số vào các bảng `CHU_KY`. */
export interface ChuKyMap { speed: 0 | 1 | 2; amp: 0 | 1 | 2; asym: 0 | 1 }

export interface HoldemMap {
  seed: number;
  o: readonly OThiTruong[];
  /** v15 — công bố ĐẦU TRẬN (phân phối công khai, realization rút từ seed). */
  chu_ky?: ChuKyMap;
  /**
   * Mảng song song với `o` — thiếu ở map dựng tay trong test cũ. KHÔNG được
   * để trường này ảnh hưởng `o`: gate 7.1 canh điều đó.
   */
  trang_thai?: readonly TrangThaiO[];
}

/** Hướng giá của từng giai đoạn — nguồn chân lý cho `run_huong`. EXPORT vì
 * `beChuoiCuaLobby` (engine, D160) phải đọc CÙNG bảng — bản chép tay sẽ trôi. */
export const HUONG_GIAI_DOAN: Record<GiaiDoanId, -1 | 0 | 1> = {
  tang: 1, phuc_hoi: 1, giam: -1, di_ngang: 0, bien_dong: 0,
};

/**
 * HÀM PHẢN ỨNG CHÍNH SÁCH — CÔNG KHAI với người chơi (bất biến 8.2), và người
 * chơi TÍNH ĐƯỢC nó từ thông tin đã lộ: mọi sự kiện trong cửa sổ đều cách ô
 * lịch ≥ 2 ô (luật cấm sự kiện đứng ngay trước ô lịch, xem `duTuCachSuKien`),
 * mà cờ tin giả lộ khi ô kế lật ⇒ đến kỳ họp thì thật/giả của cả cửa sổ đã
 * công khai. Đây là khoảnh khắc dạy học chính: theo dõi lạm phát = biết trước.
 *
 * Thứ tự ưu tiên theo v2 §4.2: lạm phát tích lũy → Tăng; thị trường đang
 * Giảm/Biến động hoặc có cú sập thật trong cửa sổ → Hạ; còn lại → GIỮ NGUYÊN
 * (mặt thứ ba hợp lệ, hành xử như Đi ngang).
 */
export function huongChinhSachKyVong(
  daPhat: readonly OThiTruong[], gdNen: GiaiDoanId,
  /** v35 (`chuoiMoRong`) — NHTW biết dập bong bóng. Vắng = luật cũ, replay nguyên. */
  moRong?: boolean,
): HuongChinhSach {
  const cuaSo = daPhat.slice(-LICH_CHINH_SACH.CUA_SO_O);
  const demLamPhat = cuaSo.filter((x) => x.kind === 'su_kien' && !x.la_tin_gia
    && (x.su_kien === 'lam_phat' || x.su_kien === 'chien_tranh')).length;
  if (demLamPhat >= LICH_CHINH_SACH.NGUONG_LAM_PHAT_O) return 'tang';
  const coSap = cuaSo.some((x) => x.kind === 'su_kien' && !x.la_tin_gia
    && (x.su_kien === 'hack_san' || x.su_kien === 'thien_nga_den'
      || x.su_kien in DUOI_5MAT));
  if (gdNen === 'giam' || gdNen === 'bien_dong' || coSap) return 'ha';
  /*
   * v35 — NHTW DẬP BONG BÓNG (D150 cạnh (a); đo D157 mới thấy phải đặt Ở ĐÂY:
   * cạnh rút-tự-do bong_bong→tang_lai_suat bị van ×0,2 ngoài-lịch đè gần chết
   * — "chính sách dồn về kỳ họp" là thiết kế v11, nên phản ứng chính sách phải
   * sống ở kỳ họp). Bong bóng THẬT trong cửa sổ mà chưa có lý do hạ ⇒ nghiêng
   * TĂNG — cú gãy bằng CHÍNH SÁCH, khác cú gãy bằng tai hoạ.
   * Đứng SAU các điều kiện hạ CÓ CHỦ ĐÍCH: bong bóng đã vỡ thì cửa sổ thường
   * mang sập/pha giảm ⇒ hạ thắng — NHTW cứu chứ không đạp thêm.
   * Luật CÔNG KHAI như hai vế trên (bất biến 8.2): người chơi tính được từ ô
   * đã lộ — dạy ở HƯỚNG DẪN, không dán nhãn lên ô (chỉ đạo founder 29/08).
   */
  if (moRong === true && cuaSo.some((x) => x.kind === 'su_kien'
    && !x.la_tin_gia && x.su_kien === 'bong_bong')) return 'tang';
  return 'giu';
}

const DOMAIN = 'holdem_map';

/**
 * Rút một phần tử theo trọng số — tất định, SỐ NGUYÊN HOÀN TOÀN.
 *
 * Dùng `rng.below(tong)` chứ KHÔNG quy tỷ lệ từ nextU32 bằng float: phép
 * `(r / 2^32) * tong` sai số làm tròn khác nhau giữa engine JS và làm lệch
 * phân bố — đúng cái bẫy `rng.ts` ghi ở đầu file. `below` đã có rejection
 * sampling nên không lệch modulo.
 */
function rutTheoTrongSo<T>(items: readonly T[], trongSo: readonly number[], rng: Rng): T {
  let tong = 0;
  for (const w of trongSo) tong += w;
  let moc = rng.below(tong);
  for (let i = 0; i < items.length; i += 1) {
    moc -= trongSo[i]!;
    if (moc < 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/**
 * ═══ BÁNH XE MÙA CÓ NGÃ RẼ (v54, D389 — cổng `banhXe`) ═══════════════════════════════════
 * Số + nguồn + số đo lúc chốt ở `config/banh_xe_mua.ts`; ở đây chỉ có MÁY.
 *
 * Thay nhánh máy tick v36 cho ô pha thường: NỀN thôi là (hướng · tuổi) tự do mà là MỘT MÙA
 * trên đường chính PHỤC HỒI → TĂNG → QUÁ NÓNG → SUY THOÁI, rẽ được ở khúc chuyển. Chế độ
 * bong bóng v27 và chuỗi ép GIỮ NGUYÊN — bánh xe chỉ đồng bộ mùa theo chúng (bong bóng thật
 * ⇒ QUÁ NÓNG; vỡ ⇒ SUY THOÁI).
 * ⚠ Chỉ QUAY ở ô pha (ô kỳ họp GIỮ cũng là ô pha); ô tin đóng băng — luật chuỗi sẵn có.
 * ⚠ RNG toàn domain MỚI (`_bx_*`) ⇒ không xê dịch một cú rút nào của map ≤ v53.
 * ⚠ Hàm phản ứng kỳ họp đọc MÙA — biến ẩn. Người chơi suy mùa từ mặt lá (đúng mùa 80%) và
 *   `xu_huong`; tức hàm phản ứng thôi "tính chắc được" như bất biến 8.2 cũ mà thành "đoán
 *   được". Ghi ở D389; màn hiện tên mùa hay không là quyết định UI riêng.
 */
export interface BanhXe {
  /** Mùa hiện hành và số ô pha đã qua trong mùa. */
  readonly mua: GiaiDoanId;
  /** D560 — loại của mùa hiện hành (null ở map không chu kỳ có ngòi). */
  readonly loai: TinhChatPha | null;
  readonly tuoi: number;
  /** D397 — hạn (số ô pha) của mùa hiện hành ở chế độ định hạn; 0 ở bản hazard. LATENT như `mua`. */
  readonly han: number;
  /** Quay một nấc ở ô pha `i`; `truoc` = ô liền trước (tin THẬT ở đó đẩy bánh xe). */
  quay(i: number, truoc: OThiTruong | undefined, laiSuat: number, sCangMax: number | null): void;
  /** Mặt lá của ô pha `i`: đúng mùa `TROI_BP`, còn lại rút mặt lệch. `prior` = P(mặt | ô pha). */
  mat(i: number): { mat: GiaiDoanId; prior: number };
  /** Hàm phản ứng kỳ họp theo mùa: sập/suy thoái/đình trệ ⇒ HẠ · lạm phát/quá nóng/bong bóng ⇒ TĂNG. */
  kyVong(daPhat: readonly OThiTruong[]): HuongChinhSach;
  /** Bong bóng THẬT giữa mùa lên ⇒ vào QUÁ NÓNG. */
  vaoBongBong(): void;
  /** Ô bị chuỗi ép (bong bóng vỡ) ⇒ SUY THOÁI. */
  epGiam(): void;
  /** Ô pha rút trong chế độ bong bóng (máy cũ) ⇒ đồng bộ mùa theo mặt vừa lật. */
  dongBo(g: GiaiDoanId): void;
  /** D399 — hệ quả kỳ họp sai ngược chiều: mùa hiện hành dài thêm `n` ô pha (chỉ chế độ định hạn). */
  keoDai(n: number): void;
  /** D574 — kỳ họp chuyển nợ (không phải Bẫy giá trị): mở NGÒI gấu chu kỳ — mùa lên còn lại rút ngắn, phân phối luôn phá xuống. */
  moNgoi(): void;
  /** D574 — ĐỔ ĐÈO: ô pha kế vào thẳng SUY THOÁI (gấu chu kỳ), bỏ qua phân phối. */
  doDeo(): void;
}

/** Bảng mặt lệch theo mùa — `BANH_XE_MUA.MAT_LECH` (D389) hoặc `LUAT_LA.MAT_LECH` (D399). */
type BangMatLech = Readonly<Record<GiaiDoanId, readonly (readonly [GiaiDoanId, number])[]>>;

/** Xuất cho bài canh D397 (đi thẳng vào máy, không qua `sinhMap`); chỉ `sinhMap` dùng trong trò. */
export function taoBanhXe(
  seed: number, dinhHan = false, bangLech: BangMatLech = BANH_XE_MUA.MAT_LECH,
  /** D560 — chu kỳ có ngòi (cổng `chuKyCoNgoi`). */
  coNgoi = false,
  /**
   * D574 — bối cảnh dài hạn ĐANG CHẠY (cổng `boiCanhDaiHan`; cần `coNgoi` + `dinhHan`). Hàm vì bối cảnh đổi được giữa trận (chuyển nợ).
   * Vắng ⇒ không một nhánh nào đổi, không tiêu RNG thêm (map v64–v66 byte-hệt).
   */
  boiCanh: (() => BoiCanhId) | null = null,
): BanhXe {
  const B = BANH_XE_MUA;
  const C = B.CO_NGOI;
  /** D574 — bảng bánh xe của bối cảnh hiện hành (null ⇒ không cổng). */
  // Núm ĐO `HOLDEM_BCDH_TAT` bit BANH_XE (chỉ khi HOLDEM_SWEEP=1) — xem `phanBcdhBat`.
  const bcx = (): BanhXeBoiCanh | null => (boiCanh !== null && phanBcdhBat(PHAN_BCDH.BANH_XE) ? BOI_CANH_DAI_HAN.BANH_XE[boiCanh()] : null);
  /** D574 — NGÒI NỢ đang mở (sau kỳ họp chuyển nợ) — tắt khi vào suy thoái. */
  let ngoiNo = false;
  /** D574 — ĐỔ ĐÈO đang chờ ô pha kế. */
  let choDeo = false;
  const laThat = (x: OThiTruong | undefined): x is OSuKien =>
    x?.kind === 'su_kien' && !x.la_tin_gia;
  // Mùa mở màn rút theo ĐỘ DÀI KỲ VỌNG của từng mùa (bàn mở giữa chu kỳ, không luôn từ đầu).
  const eDai = MUA_CHINH.map((m) => B.MUA[m].MIN_O * 10000
    + Math.floor(((10000 - B.MUA[m].HAZARD_BP) * 10000) / Math.max(1, B.MUA[m].HAZARD_BP)));
  let mua: GiaiDoanId = rutTheoTrongSo(MUA_CHINH, eDai, rngAt(seed, `${DOMAIN}_bx_mo`, 0));
  /** D560 — loại mùa; mùa mở màn nhận loại mặc định (bàn mở giữa chu kỳ). */
  let loai: TinhChatPha | null = !coNgoi ? null
    : mua === 'tang' ? 'tang_truong' : mua === 'giam' ? 'gau_chu_ky' : null;
  /** D560 — đã có bong bóng thật từ lần suy thoái trước ⇒ cú gãy kế là gấu ĐỊNH GIÁ. */
  let coBongBong = false;
  /*
   * D397 — MÙA ĐỊNH HẠN (cổng `muaDinhHan`): độ dài mùa RÚT SẴN lúc vào mùa (`B.HAN`), mùa chuyển khi
   * `tuoi >= han` ⇒ mùa CÓ TUỔI: đợt tăng trưởng đã kéo 5 ô thì gần đỉnh hơn đợt mới chạy 2 ô. Bản
   * hazard (tung `HAZARD_BP` mỗi ô) làm mặt lá không phân biệt được với markov bậc 1 — số đo ở D397.
   * ⚠ RNG domain MỚI (`_bx_han`, `_bx_rut`, `_bx_cang`), địa chỉ cú rút hạn = số lần vào mùa ⇒ nhánh
   *   hazard không xê dịch một cú rút nào (v54 tắt cờ = đúng bàn D389).
   */
  let lanVao = 0;
  const rutHan = (m: GiaiDoanId): number => {
    // D574 — ngòi nợ (hạn ngắn) > bảng của bối cảnh > bảng D560 > bảng D397.
    const NN = BOI_CANH_DAI_HAN.NGOI_NO;
    const hanBc = boiCanh === null ? undefined
      : ngoiNo && m === 'bien_dong' ? NN.HAN_QUA_NONG
        : loai !== null ? (ngoiNo ? NN.HAN[loai] : undefined) ?? bcx()?.HAN?.[loai] : undefined;
    const [tu, den] = hanBc ?? (coNgoi && loai !== null ? C.HAN[loai] : undefined) ?? B.HAN[m];
    lanVao += 1;
    return tu + rngAt(seed, `${DOMAIN}_bx_han`, lanVao).below(den - tu + 1);
  };
  let han = dinhHan ? rutHan(mua) : 0;
  let tuoi = rngAt(seed, `${DOMAIN}_bx_mo`, 1)
    .below(dinhHan ? han : Math.max(1, Math.floor(eDai[MUA_CHINH.indexOf(mua)]! / 10000)));
  /** Vào mùa mới: tuổi về 0, và ở chế độ định hạn thì rút hạn cho mùa đó. */
  const vaoMua = (m: GiaiDoanId, l: TinhChatPha | null = null): void => {
    mua = m; tuoi = 0;
    if (coNgoi) { loai = l; if (m === 'giam') coBongBong = false; }
    if (m === 'giam') ngoiNo = false;   // D574 — ngòi đã nổ
    if (dinhHan) han = rutHan(m);
  };

  /**
   * D560 — MÙA KẾ ở chu kỳ có ngòi: PHỤC HỒI → TĂNG → QUÁ NÓNG → PHÂN PHỐI → SUY THOÁI → TÍCH LŨY → PHỤC HỒI. Suy thoái chỉ tới sau PHÂN
   * PHỐI (hoặc đáy kép từ tích lũy / phục hồi); cú sốc đi đường riêng trong `quay`. RNG domain MỚI (`_bx_ngoi`) — map cũ không xê dịch.
   */
  const muaKeCoNgoi = (i: number, sk: OSuKien | null, laiSuat: number): [GiaiDoanId, TinhChatPha | null] => {
    const N = B.NGA_RE;
    const r = rngAt(seed, `${DOMAIN}_bx_ngoi`, i);
    const tinXau = sk !== null && (HUONG_GIAI_DOAN[sk.bao_truoc] === -1 || sk.bao_truoc === 'bien_dong');
    const tinTot = sk !== null && HUONG_GIAI_DOAN[sk.bao_truoc] === 1;
    const tienRe = moiTruongTienTe(laiSuat) === 're' || (sk !== null && sk.su_kien === 'ha_lai_suat');
    // D574 — bối cảnh "Lên + Căng": bò dòng tiền chỉ `DONG_TIEN_BP` số lần tiền rẻ (RNG domain mới, chỉ khi bảng khai).
    const bcNay = bcx();
    const dongTien = tienRe && (bcNay?.DONG_TIEN_BP === undefined
      || rngAt(seed, `${DOMAIN}_bc_dt`, i).chanceBp(bcNay.DONG_TIEN_BP));
    const bo = (): [GiaiDoanId, TinhChatPha] => ['tang', dongTien ? 'dong_tien' : 'tang_truong'];
    // D574 — ngòi nợ: cú gãy là gấu CHU KỲ (vỡ nợ), không phải định giá.
    const gau = (): [GiaiDoanId, TinhChatPha] => ['giam', coBongBong && !ngoiNo ? 'gau_dinh_gia' : 'gau_chu_ky'];
    // Đáy kép chỉ khi CÓ NGÒI (tin xấu thật vừa nổ); không ngòi thì "thử đáy" chỉ là một lá Giảm lệch (đo D560: 98 cú lật không dấu hiệu).
    if (mua === 'phuc_hoi') {
      return tinXau && r.chanceBp(Math.min(N.TRAN_BP, N.DAY_KEP_BP + N.DAY_KEP_TIN_XAU_BP)) ? ['giam', 'gau_su_kien'] : bo();
    }
    if (mua === 'tang') return ['bien_dong', null];
    if (mua === 'bien_dong') {
      if (ngoiNo) return ['di_ngang', 'phan_phoi'];   // D574 — ngòi nợ: không hạ cánh mềm
      const p = N.HA_CANH_MEM_BP + (sk !== null && sk.su_kien === 'ha_lai_suat' ? N.HA_CANH_MEM_HA_LAI_BP : 0) - (tinXau ? N.HA_CANH_MEM_TIN_XAU_BP : 0);
      return r.chanceBp(Math.max(0, Math.min(N.TRAN_BP, p))) ? bo() : ['di_ngang', 'phan_phoi'];
    }
    if (mua === 'di_ngang' && loai === 'phan_phoi') {
      if (ngoiNo) return gau();   // D574 — ngòi nợ: phân phối luôn phá xuống
      const len = bcNay?.PHAN_PHOI_LEN_BP ?? C.PHAN_PHOI_LEN_BP;
      return r.chanceBp(Math.min(N.TRAN_BP, len + (tinTot ? C.PHAN_PHOI_LEN_TIN_TOT_BP : 0))) ? bo() : gau();
    }
    if (mua === 'giam') {
      return loai === 'gau_su_kien' && r.chanceBp(C.SU_KIEN_HOI_THANG_BP) ? ['phuc_hoi', null] : ['di_ngang', 'tich_luy'];
    }
    if (mua === 'di_ngang' && loai === 'tich_luy') {
      // D574 — "Siêu Gấu": đáy kép không cần ngòi tin xấu (RNG domain mới; chỉ khi bảng bối cảnh khai).
      if (!tinXau && bcNay?.TICH_LUY_ROI_BP !== undefined) {
        return rngAt(seed, `${DOMAIN}_bc_tl`, i).chanceBp(bcNay.TICH_LUY_ROI_BP) ? ['giam', 'gau_chu_ky'] : ['phuc_hoi', null];
      }
      return tinXau && r.chanceBp(Math.min(N.TRAN_BP, C.TICH_LUY_ROI_BP + C.TICH_LUY_ROI_TIN_XAU_BP))
        ? ['giam', 'gau_su_kien'] : ['phuc_hoi', null];
    }
    return ['phuc_hoi', null];
  };

  /** Mùa kế ở khúc chuyển — đường chính, hoặc NGÃ RẼ. `sk` = tin THẬT liền trước (nếu có). */
  const muaKe = (i: number, sk: OSuKien | null): GiaiDoanId => {
    const N = B.NGA_RE;
    const r = rngAt(seed, `${DOMAIN}_bx_nhanh`, i);
    const tinXau = sk !== null
      && (HUONG_GIAI_DOAN[sk.bao_truoc] === -1 || sk.bao_truoc === 'bien_dong');
    const tinTot = sk !== null && HUONG_GIAI_DOAN[sk.bao_truoc] === 1;
    if (mua === 'phuc_hoi') {
      // ĐÁY KÉP.
      return r.chanceBp(Math.min(N.TRAN_BP, N.DAY_KEP_BP + (tinXau ? N.DAY_KEP_TIN_XAU_BP : 0)))
        ? 'giam' : 'tang';
    }
    if (mua === 'tang') return 'bien_dong';
    if (mua === 'bien_dong') {
      // HẠ CÁNH MỀM.
      const p = N.HA_CANH_MEM_BP
        + (sk !== null && sk.su_kien === 'ha_lai_suat' ? N.HA_CANH_MEM_HA_LAI_BP : 0)
        - (tinXau ? N.HA_CANH_MEM_TIN_XAU_BP : 0);
      return r.chanceBp(Math.max(0, Math.min(N.TRAN_BP, p))) ? 'tang' : 'giam';
    }
    if (mua === 'giam') {
      // ĐÌNH TRỆ.
      return r.chanceBp(Math.max(0, N.DINH_TRE_BP - (tinTot ? N.DINH_TRE_TIN_TOT_BP : 0)))
        ? 'di_ngang' : 'phuc_hoi';
    }
    return 'phuc_hoi';
  };

  return {
    get mua() { return mua; },
    get loai() { return loai; },
    get tuoi() { return tuoi; },
    get han() { return han; },
    quay(i, truoc, laiSuat, sCangMax) {
      const sk = laThat(truoc) ? truoc : null;
      const huongTin = sk !== null ? HUONG_GIAI_DOAN[sk.bao_truoc] : 0;
      const laDuoi = sk !== null && (sk.su_kien === 'thien_nga_den'
        || sk.su_kien in DUOI_5MAT || sk.su_kien === 'hack_san');
      let doi = false;
      // D574 — ĐỔ ĐÈO: ô pha đầu tiên sau kỳ họp đổ đèo là suy thoái, không trễ, không chờ phân phối.
      // Chợ ĐANG giảm (bong bóng vừa vỡ…) ⇒ vỡ nợ chồng lên: thành gấu chu kỳ, kéo dài thêm một hạn của bối cảnh mới tính từ đây.
      if (choDeo) {
        choDeo = false; doi = true;
        if (mua !== 'giam') vaoMua('giam', 'gau_chu_ky');
        else if (dinhHan) { loai = 'gau_chu_ky'; han = tuoi + rutHan('giam'); }
      }
      // CÚ SỐC — tin xấu thật giữa mùa lên rơi thẳng vào SUY THOÁI.
      // D560 — chu kỳ có ngòi: cú sốc áp MỌI mùa chưa phải suy thoái (đỉnh chu kỳ là chỗ cú sốc đau nhất) ⇒ gấu SỰ KIỆN.
      const muaSoc = coNgoi ? mua !== 'giam' : (mua === 'tang' || mua === 'phuc_hoi');
      if (sk !== null && muaSoc && (laDuoi || huongTin === -1)
        && rngAt(seed, `${DOMAIN}_bx_soc`, i).chanceBp(laDuoi ? B.SOC_DUOI_BP : B.SOC_BP)) {
        vaoMua('giam', coNgoi ? 'gau_su_kien' : null); doi = true;
      }
      if (!doi && dinhHan) {
        /*
         * D397 — mọi thứ từng CỘNG vào hazard giờ RÚT NGẮN hạn còn lại 1 ô (nghiêng, không ép):
         * tin THẬT ngược mùa chắc chắn · môi trường tiền tệ ngược mùa và sức căng theo khả năng.
         * Hạn không dưới 1 ô ⇒ mùa nào vào rồi cũng hiện ít nhất một lá.
         */
        const mt = moiTruongTienTe(laiSuat);
        let bot = 0;
        // D560 — phân phối là cuối mùa LÊN (tin xấu rút ngắn), tích lũy là cuối mùa XUỐNG (tin tốt rút ngắn).
        const lenMuon = mua === 'tang' || mua === 'bien_dong' || (coNgoi && mua === 'di_ngang' && loai === 'phan_phoi');
        if (coNgoi && loai === 'dong_tien' && sk !== null && sk.su_kien === 'tang_lai_suat') bot += C.DONG_TIEN_SIET_O;
        if (lenMuon) {
          if (huongTin === -1 || (sk !== null && sk.bao_truoc === 'bien_dong')) bot += 1;
          if (mt === 'dat' && rngAt(seed, `${DOMAIN}_bx_rut`, i).chanceBp(B.HAZARD_MOI_TRUONG_BP)) bot += 1;
          if (sCangMax !== null && rngAt(seed, `${DOMAIN}_bx_cang`, i).chanceBp(
            applyBpInt(Math.floor((sCangMax * SUC_CANG.HAZARD_BP) / 10000), B.HAZARD_CANG_BP))) bot += 1;
        } else if (mua === 'giam' || mua === 'di_ngang') {
          if (huongTin === 1) bot += 1;
          if (mt === 're' && rngAt(seed, `${DOMAIN}_bx_rut`, i).chanceBp(B.HAZARD_MOI_TRUONG_BP)) bot += 1;
        }
        han = Math.max(1, han - bot);
        if (tuoi >= han) {
          if (coNgoi) { const [m, l] = muaKeCoNgoi(i, sk, laiSuat); vaoMua(m, l); } else vaoMua(muaKe(i, sk));
        }
      } else if (!doi && tuoi >= B.MUA[mua].MIN_O) {
        let hz: number = B.MUA[mua].HAZARD_BP;
        const mt = moiTruongTienTe(laiSuat);
        if (mua === 'tang' || mua === 'bien_dong') {
          if (huongTin === -1 || (sk !== null && sk.bao_truoc === 'bien_dong')) hz += B.HAZARD_TIN_BP;
          if (mt === 'dat') hz += B.HAZARD_MOI_TRUONG_BP;
          if (sCangMax !== null) {
            hz += applyBpInt(Math.floor((sCangMax * SUC_CANG.HAZARD_BP) / 10000), B.HAZARD_CANG_BP);
          }
        } else if (mua === 'giam' || mua === 'di_ngang') {
          if (huongTin === 1) hz += B.HAZARD_TIN_BP;
          if (mt === 're') hz += B.HAZARD_MOI_TRUONG_BP;
        }
        if (rngAt(seed, `${DOMAIN}_bx_haz`, i).chanceBp(Math.min(B.TRAN_HAZARD_BP, hz))) {
          mua = muaKe(i, sk); tuoi = 0;
        }
      }
      tuoi += 1;
    },
    mat(i) {
      if (rngAt(seed, `${DOMAIN}_bx_troi`, i).chanceBp(B.TROI_BP)) return { mat: mua, prior: B.TROI_BP };
      // D399 — bảng mặt lệch theo nghĩa khi cổng `luatLa` bật; cùng cú rút, cùng tổng trọng số 10000.
      // D560 — chu kỳ có ngòi: bảng theo mùa con của đi ngang (phân phối ≠ tích lũy).
      const ds = coNgoi ? C.MAT_LECH[mua === 'di_ngang' ? (loai === 'phan_phoi' ? 'phan_phoi' : 'tich_luy') : mua as Exclude<GiaiDoanId, 'di_ngang'>]
        : bangLech[mua];
      const tong = ds.reduce((a, [, w]) => a + w, 0);
      let moc = rngAt(seed, `${DOMAIN}_bx_nhieu`, i).below(tong);
      for (const [id, w] of ds) {
        moc -= w;
        if (moc < 0) return { mat: id, prior: Math.round(((10000 - B.TROI_BP) * w) / tong) };
      }
      return { mat: ds[0]![0], prior: 0 };
    },
    kyVong(daPhat) {
      const cuaSo = daPhat.slice(-LICH_CHINH_SACH.CUA_SO_O);
      const coSap = cuaSo.some((x) => laThat(x) && (x.su_kien === 'hack_san'
        || x.su_kien === 'thien_nga_den' || x.su_kien in DUOI_5MAT));
      if (coSap || mua === 'giam' || mua === 'di_ngang') return 'ha';
      const lamPhat = cuaSo.filter((x) => laThat(x)
        && (x.su_kien === 'lam_phat' || x.su_kien === 'chien_tranh')).length;
      if (lamPhat >= LICH_CHINH_SACH.NGUONG_LAM_PHAT_O || mua === 'bien_dong') return 'tang';
      if (cuaSo.some((x) => laThat(x) && x.su_kien === 'bong_bong')) return 'tang';
      return 'giu';
    },
    vaoBongBong() {
      if (coNgoi) coBongBong = true;
      if (mua === 'tang' || mua === 'phuc_hoi') vaoMua('bien_dong');
    },
    epGiam() {
      // D560 — cú vỡ bong bóng là gấu ĐỊNH GIÁ (đặt loại TRƯỚC khi rút hạn: hạn theo loại).
      if (coNgoi && mua !== 'giam') { loai = 'gau_dinh_gia'; coBongBong = false; }
      ngoiNo = false;   // D574 — bong bóng vỡ là cú gãy đã tới (đổ đèo còn chờ thì `quay` kế đổi nó thành gấu chu kỳ)
      // D397 — đổi SANG suy thoái ở chế độ định hạn thì mùa mới có hạn riêng; bản hazard y nguyên.
      if (dinhHan && mua !== 'giam') han = rutHan('giam');
      mua = 'giam'; tuoi += 1;
    },
    dongBo(g) {
      if (g === 'giam') {
        if (coNgoi && mua !== 'giam') { loai = 'gau_dinh_gia'; coBongBong = false; }
        ngoiNo = false;   // D574
        if (dinhHan && mua !== 'giam') han = rutHan('giam');
        mua = 'giam'; tuoi = 1;
      } else tuoi += 1;
    },
    keoDai(n) {
      if (dinhHan) han += n;
    },
    moNgoi() {
      ngoiNo = true;
      // Mùa lên / quá nóng / phân phối đang chạy hết ở ô pha kế (`quay` chuyển khi tuoi >= han).
      if (mua === 'tang' || mua === 'bien_dong' || (mua === 'di_ngang' && loai === 'phan_phoi')) han = Math.min(han, Math.max(1, tuoi));
    },
    doDeo() {
      choDeo = true;
    },
  };
}

/**
 * Sinh map. `size` mặc định lấy từ HOLDEM_DECISIONS.MAP_SIZE ở tầng gọi.
 *
 * Mọi lần rút đều địa chỉ hoá theo (seed, domain, chỉ số ô) — thêm/bớt người
 * chơi hay đổi thứ tự duyệt KHÔNG làm xê dịch map. Đây là lớp phòng thủ chính
 * chống bug replay (xem `sandbox/rng.ts`).
 */
export function sinhMap(
  seed: number, size: number,
  /**
   * CỔNG HÀNH VI của máy — mặc định TẮT HẾT để mọi người gọi cũ (kể cả
   * fixture gate 7.1) giữ nguyên phân phối không lịch, không quán tính.
   * Nhận boolean để tương thích người gọi thời v11 (boolean = chỉ lịch).
   */
  tuyChon: boolean | {
    lich?: boolean; quanTinh?: boolean; sucCang?: boolean;
    chuKy?: boolean; duoiTelegraph?: boolean; duoi5?: boolean;
    laiSuatNen?: boolean; bongBongChuoi?: boolean; mapV28?: boolean;
    nhanQuaDoiXung?: boolean;
    banSac?: boolean; chuoiMoRong?: boolean; tuongTac?: boolean;
    markovNguon?: boolean; regimeTick?: boolean;
    /** v39 (D301) — bộ số hiệu chỉnh theo dữ liệu ngoài đời; CHỈ đổi số, không đổi máy. */
    chuKyThucTe?: boolean;
    /**
     * v41 (D307) — LỚP VN: S-map (§5.2 dưới) đọc `mtGiaiDoan`/`mtSuKien` thay vì
     * hằng số toàn cầu. MỘT CỬA — xem docstring `mtGiaiDoan` trong config.
     */
    lopVn?: boolean;
    /** v42 (D311) — xem `BoLuatCanBang.taiSanV42`. */
    taiSanV42?: boolean;
    /** v54 (D389) — bánh xe mùa có ngã rẽ; cần `regimeTick`. Xem `taoBanhXe`. */
    banhXe?: boolean;
    /** v54 (D397) — mùa RÚT SẴN độ dài (mùa có tuổi); cần `banhXe`. */
    muaDinhHan?: boolean;
    /** v54 (D397) — tin NỘI SINH nghiêng theo mùa ẩn (`BANH_XE_MUA.TIN_THEO_MUA`); cần `banhXe`. */
    tinTheoMua?: boolean;
    /** v54 (D399) — bộ luật từng lá (`config/luat_la.ts`): tiền đề + hệ quả cho mọi lá; cần `banhXe`. */
    luatLa?: boolean;
    /** v57 (D456) — thẻ sự kiện LUÔN THẬT: không rút cờ giả cho ô nào. Xem `BoLuatCanBang.theLuonThat`. */
    theLuonThat?: boolean;
    /** v57 (D470) — CẠN THANH KHOẢN chỉ sau hoảng loạn/chuỗi giảm, mọi mùa; cần `luatLa`. Xem `BoLuatCanBang.canSauKhung`. */
    canSauKhung?: boolean;
    /** v62 (D545) — lịch kỳ họp cho cỡ bàn tập (`LICH_CHINH_SACH.O_BAN_TAP`); cần `lich`. */
    kyHopBanTap?: boolean;
    /** v64 (D560) — chu kỳ có ngòi (tính chất lá pha · không ngòi không sập); cần `banhXe`. */
    chuKyCoNgoi?: boolean;
    /** v67 (D574) — bối cảnh dài hạn (sóng công nghệ × pha nợ); cần `chuKyCoNgoi` + `muaDinhHan`. */
    boiCanhDaiHan?: boolean;
  } = false,
): HoldemMap {
  const lich = typeof tuyChon === 'boolean' ? tuyChon : tuyChon.lich === true;
  const quanTinh = typeof tuyChon === 'object' && tuyChon.quanTinh === true;
  const sucCang = typeof tuyChon === 'object' && tuyChon.sucCang === true;
  const coChuKy = typeof tuyChon === 'object' && tuyChon.chuKy === true;
  const coDuoiTg = typeof tuyChon === 'object' && tuyChon.duoiTelegraph === true;
  const duoi5 = typeof tuyChon === 'object' && tuyChon.duoi5 === true;
  const coLaiSuat = typeof tuyChon === 'object' && tuyChon.laiSuatNen === true;
  const coBongBongChuoi = typeof tuyChon === 'object' && tuyChon.bongBongChuoi === true;
  const coBanSac = typeof tuyChon === 'object' && tuyChon.banSac === true;
  const coV28 = typeof tuyChon === 'object' && tuyChon.mapV28 === true;
  const coDoiXung = typeof tuyChon === 'object' && tuyChon.nhanQuaDoiXung === true;
  const coChuoiMoRong = typeof tuyChon === 'object' && tuyChon.chuoiMoRong === true;
  const coTuongTac = typeof tuyChon === 'object' && tuyChon.tuongTac === true;
  const coMarkov = typeof tuyChon === 'object' && tuyChon.markovNguon === true;
  const coTick = typeof tuyChon === 'object' && tuyChon.regimeTick === true;
  /*
   * v39 — CHU KỲ THỰC TẾ (D301, cổng `chuKyThucTe`): CÙNG máy tick, đổi BỘ SỐ. Cờ tắt ⇒
   * `thamSoTick(false)` trả đúng REGIME_TICK cũ (hai tham số mới rơi về giá trị làm phép
   * tính y hệt), `thamSoBongBong(false)` trả chính BONG_BONG_V27, bảng tin giả trả bảng cũ
   * — hash 300 map × 3 cỡ của v36/v38/v31/v10b khoá ở tests/chu_ky_thuc_te.test.ts §II.
   * Nguồn + quy đổi của từng số: chú thích cạnh số trong config.
   */
  const coThucTe = typeof tuyChon === 'object' && tuyChon.chuKyThucTe === true;
  /*
   * v54 (D389) — BÁNH XE MÙA thay nhánh máy tick cho ô pha thường. Đòi `regimeTick`: bánh
   * xe dựng TRÊN khung v36 (ô tin đóng băng chuỗi · chế độ bong bóng · kỳ họp), không thay nó.
   * `null` ở mọi map ≤ v53 ⇒ không một nhánh nào dưới đây đổi hành vi, không tiêu RNG.
   */
  const hoiLuatLa = typeof tuyChon === 'object' && tuyChon.luatLa === true;
  /** D456 — thẻ luôn thật: bỏ cú rút `${DOMAIN}_gia` (RNG riêng theo ô nên không xê dịch cú rút nào khác). */
  const coTheLuonThat = typeof tuyChon === 'object' && tuyChon.theLuonThat === true;
  const coCanSauKhung = typeof tuyChon === 'object' && tuyChon.canSauKhung === true;
  /**
   * D574 — BỐI CẢNH DÀI HẠN (cổng `boiCanhDaiHan`): sống trên bánh xe định hạn có ngòi. Bối cảnh hiện hành đổi được ĐÚNG một lần ở kỳ
   * họp chuyển nợ (gán ngay trước vòng lặp, khi đã biết lịch kỳ họp). `null` ⇒ không một nhánh nào đổi.
   */
  const coBoiCanh = coTick && typeof tuyChon === 'object' && tuyChon.banhXe === true && tuyChon.muaDinhHan === true
    && tuyChon.chuKyCoNgoi === true && tuyChon.boiCanhDaiHan === true;
  let bcHienTai: BoiCanhId | null = null;
  const oLich = lich ? (LICH_CHINH_SACH.O_THEO_MAP[size]
    ?? (typeof tuyChon === 'object' && tuyChon.kyHopBanTap === true ? LICH_CHINH_SACH.O_BAN_TAP[size] : undefined) ?? []) : [];
  /** D574 — bối cảnh dài hạn của trận (một nguồn `boiCanhDaiHan`) — TRƯỚC khi dựng bánh xe: mùa mở màn rút hạn theo bối cảnh. */
  const bcdh = coBoiCanh ? boiCanhDaiHan(seed, oLich) : null;
  if (bcdh !== null) bcHienTai = idBoiCanh(bcdh.song, bcdh.no);
  const bx = coTick && typeof tuyChon === 'object' && tuyChon.banhXe === true
    ? taoBanhXe(seed, tuyChon.muaDinhHan === true, hoiLuatLa ? LUAT_LA.MAT_LECH : BANH_XE_MUA.MAT_LECH, tuyChon.chuKyCoNgoi === true,
      coBoiCanh ? () => bcHienTai! : null) : null;
  /** D560 — chu kỳ có ngòi; chỉ khi có bánh xe. */
  const coNgoi = bx !== null && typeof tuyChon === 'object' && tuyChon.chuKyCoNgoi === true;
  /** D397 — tin nội sinh nghiêng theo mùa ẩn; chỉ khi có bánh xe (mùa là biến của nó). */
  const coTinTheoMua = bx !== null && typeof tuyChon === 'object' && tuyChon.tinTheoMua === true;
  /**
   * D399 — BỘ LUẬT TỪNG LÁ (`config/luat_la.ts`, máy ở `./luat_la.ts`): tiền đề chặn chuyện KHÔNG THỂ (phục hồi
   * không đáy, quá nóng không nhiệt, khủng hoảng không ngòi…), hệ quả nghiêng chuyện sau (kỳ họp sai ngược chiều).
   * Mọi phép đọc là hàm thuần trên chuỗi đã phát — không tiêu RNG, tắt cổng là đúng bàn D397/D398 từng bit.
   */
  const coLuatLa = bx !== null && hoiLuatLa;
  /** Kỳ họp kế phải sửa sai (lần trước đi NGƯỢC hàm phản ứng). */
  let suaSaiKyHopKe = false;
  /** Hệ quả đang sống của lần kỳ họp sai ngược chiều gần nhất: nhân trọng số lá tin tới hết ô `den`. */
  let heQua: { tinX: Partial<Record<SuKienId, number>>; den: number } | null = null;
  /** Hai trường mùa của `TrangThaiO` — chỉ map bánh xe mới có (hash map cũ nguyên). */
  /** D574 — ô mang cú đổ đèo (ô ngay sau kỳ họp đổ đèo); −1 = chưa. */
  let oDoDeo = -1;
  const muaO = (): Pick<TrangThaiO, 'mua' | 'tuoi_mua' | 'loai_mua' | 'boi_canh_dh' | 'do_deo'> =>
    (bx !== null ? {
      mua: bx.mua, tuoi_mua: bx.tuoi, ...(coNgoi && bx.loai !== null ? { loai_mua: bx.loai } : {}),
      ...(bcHienTai !== null ? { boi_canh_dh: bcHienTai } : {}), ...(oDoDeo >= 0 && trangThai.length === oDoDeo ? { do_deo: true as const } : {}),
    } : {});
  const RT = thamSoTick(coThucTe);
  const BB = thamSoBongBong(coThucTe);
  // v41/v42 (D307/D311) — BỘ MA TRẬN: một cửa cho S-map bên dưới, xem `capNhatS`.
  const boMT: BoMaTran = typeof tuyChon === 'object'
    ? boMaTranCua({ lop_vn: tuyChon.lopVn ?? false, tai_san_v42: tuyChon.taiSanV42 ?? false })
    : 'v40';
  /*
   * D177 — HỒ SƠ THEO CỠ MAP. Map 8 = bàn NGẮN & CĂNG (nhiều tin, ít ô nghỉ,
   * chuỗi gãy nhanh); cỡ khác trung tính. Chỉ sau cổng tick — xem `HO_SO_MAP`.
   */
  const hs = hoSoMap(size, coTick);
  // Bước 6 — rút 3 tham số chu kỳ NGAY ĐẦU map, phân phối đều (công khai).
  const chuKy = coChuKy ? {
    speed: rngAt(seed, `${DOMAIN}_ck`, 0).below(3) as 0 | 1 | 2,
    amp: rngAt(seed, `${DOMAIN}_ck`, 1).below(3) as 0 | 1 | 2,
    asym: rngAt(seed, `${DOMAIN}_ck`, 2).below(2) as 0 | 1,
  } : undefined;
  // Tốc độ chu kỳ nhân vào quán tính: thị trường CHẬM = regime lì hơn.
  const tuLapBp = chuKy
    ? Math.floor((QUAN_TINH.TU_LAP_BP * CHU_KY.QUAN_TINH_BP[chuKy.speed]!) / 10000)
    : QUAN_TINH.TU_LAP_BP;
  // Map CHẬM: regime lì NGAY từ ô đầu (ngưỡng chuỗi 1) — đòn bẩy hình dạng
  // thật sự; chỉ nhân biên tilt thì autocorr gần như không nhúc nhích (đo
  // 3.000 map: chênh 0,023–0,024 < gate 0,04 ở cả hai thang hệ số).
  const nguongChuoi = chuKy && chuKy.speed === 0 ? 1 : QUAN_TINH.NGUONG_CHUOI;
  /** §4.3 — ô bị ĐIỀM BÁO ép thành thẻ đuôi: index → mặt. */
  const epDuoi = new Map<number, SuKienId>();
  assertSeedPartSafe(DOMAIN, 'sinhMap');
  const o: OThiTruong[] = [];
  const trangThai: TrangThaiO[] = [];
  /** Mặt lá ô pha `i` trên bánh xe — qua tiền đề lá pha khi cổng D399 bật (cùng cú rút, không tiêu RNG thêm). */
  const matBanhXe = (xe: BanhXe, i: number): { mat: GiaiDoanId; prior: number } => {
    const r = xe.mat(i);
    return coLuatLa ? giaiMat(r, xe.mua, o) : r;
  };

  /**
   * CHUỖI GIAI ĐOẠN ĐANG BỊ ÉP — hệ quả nhiều vòng của Bong bóng.
   *
   * Trong kiến trúc máy trạng thái, đây là `tail_pending` (§1 MODIFIERS):
   * bong bóng thật đặt vào hàng đợi này 2 ô — nhánh phồng (tăng, tăng) hoặc
   * nhánh vỡ (giảm, giảm).
   *
   * Tất định vẫn nguyên: hàng đợi chỉ do các lần rút đã địa chỉ hoá theo
   * (seed, domain, chỉ số ô) quyết định, không có nguồn ngẫu nhiên nào khác.
   */
  let chuoiEp: GiaiDoanId[] = [];

  // ── STATE của máy (03 §1) — giai đoạn nền + run; sức căng bước 1 khoá 0. ──
  let gdNen: GiaiDoanId = 'di_ngang';
  let runHuong: -1 | 0 | 1 = 0;
  let runDai = 0;
  /*
   * v35 — NHÃN NGUỒN của chuỗi hiện hành (D159): đặt lúc chuỗi MỞ, sống trọn
   * chuỗi, LATENT (không ghi trang_thai, không DTO — addendum §7/D154). Người
   * chơi suy được từ tin-mở-chuỗi + môi trường — cả hai công khai.
   */
  let nguonMoChuoi: NguonChuoi | null = null;
  /** Pha VỪA LẬT gần nhất — quán tính nghiêng về đúng pha này, không chỉ hướng. */
  let phaCuoi: GiaiDoanId | null = null;
  const sucCangKhoa0: readonly number[] =
    Object.freeze(THU_TU_MA_SUC_CANG.map(() => 0));
  /*
   * ── LÃI SUẤT NỀN (v26) — biến trạng thái tích luỹ, công khai ──────────────
   * Cờ TẮT ⇒ giữ nguyên `KHOI_DIEM` suốt map và không nhân trọng số nào, nên
   * mọi phiên bản cũ replay ra ĐÚNG map cũ (gate 7.1 canh điều đó).
   */
  let laiSuat: number = LAI_SUAT_NEN.KHOI_DIEM;
  /*
   * ── CHẾ ĐỘ BONG BÓNG (v27) — số ô đã PHỒNG, -1 = không ở trong bong bóng ──
   * Khác `chuoiEp` ở một điểm quyết định: đây là trạng thái SỐNG, mỗi ô còn
   * phải rút, nên còn có chỗ để gãy. `chuoiEp` là hàng đợi đã định đoạt.
   */
  let bbDaPhong = -1;
  /*
   * v35 — ĐỔ DẦU (D158, cổng `tuongTac`): số lần hạ lãi THẬT rơi GIỮA chế độ
   * bong bóng. Mỗi lần cộng thêm nghiêng `tang` VÀ cộng thêm độ sâu cú vỡ —
   * leo bằng dầu thì hố cũng sâu bằng dầu. Đếm riêng, KHÔNG trừ vào
   * `bbDaPhong`: trừ vào đó là làm cú vỡ NÔNG đi, tức đổ dầu lại thành giảm
   * rủi ro — ngược nghĩa. Vì kỳ họp v35 nghiêng TĂNG khi có bong bóng
   * (`huongChinhSachKyVong`), hạ-lãi-giữa-bong-bóng gần như chỉ đến từ
   * sai-lầm-chính-sách (~15%) hoặc khủng hoảng chồng lên — hiếm mà kịch tính.
   */
  let bbDoDau = 0;

  /*
   * ─── S-MAP (v13, 03 §5.2) — nạp/xả/lan theo CHUỖI Ô, không theo hành vi ────
   * Tầng map chỉ nhìn chuỗi ô nên bộ bài vẫn cố định lúc tạo trận (đếm bài
   * 16.8 sống). Chân crowding của bàn cộng ở tầng ĐỘ LỚN trong engine.
   * KHÔNG đọc la_tin_gia làm tín hiệu một chiều: tin giả không nạp không xả —
   * nó là tiếng ồn, và cả nạp lẫn xả đều chỉ chạy trên tin THẬT (đối xứng,
   * không thành máy dò tin giả — cùng chuẩn D39).
   */
  const sCang: number[] = THU_TU_MA_SUC_CANG.map(() => 0);
  let noiLongConLai = 0;
  const chupS = (): readonly number[] =>
    (sucCang ? Object.freeze([...sCang]) : sucCangKhoa0);
  const capNhatS = (oMoi: OThiTruong): void => {
    if (!sucCang) return;
    // Tính phần đổi từ SNAPSHOT rồi mới áp + lan — lan giữa chừng vòng lặp là
    // mã duyệt sau ăn lan hai lần.
    const d = TAI_SAN.map((ts, k) => {
      if (oMoi.kind === 'giai_doan') {
        const m = mtGiaiDoan(boMT)[ts.id]![oMoi.giai_doan];
        if (HUONG_GIAI_DOAN[oMoi.giai_doan] === 1 && m > 0) {
          // Pha thuận hướng lên: nạp, sổ mỏng nạp nhanh, tiền rẻ nhân đôi.
          let nap = Math.floor(
            (SUC_CANG.NAP_BP * SUC_CANG.HS_THANH_KHOAN_BP[ts.thanh_khoan]!) / 10000);
          if (noiLongConLai > 0) {
            nap = Math.floor((nap * SUC_CANG.NOI_LONG_X_BP) / 10000);
          }
          return nap;
        }
        // Xì hơi khi giảm, xả DẦN khi êm — phân phối reset, S thì không (§5.3).
        return oMoi.giai_doan === 'giam' ? -SUC_CANG.XA_GIAM_BP : -SUC_CANG.XA_BP;
      }
      const goc = mtSuKien(boMT)[ts.id]![oMoi.su_kien];
      if (oMoi.la_tin_gia) return 0;
      // Cú đánh thật vào mã = bong bóng xì qua chính cú nổ.
      if (goc < 0) return -Math.floor((sCang[k]! * SUC_CANG.GIAI_PHONG_BP) / 10000);
      // Bong bóng thật thổi thẳng vào mã hưởng lợi.
      if (oMoi.su_kien === 'bong_bong' && goc > 0) {
        return Math.floor(
          (2 * SUC_CANG.NAP_BP * SUC_CANG.HS_THANH_KHOAN_BP[ts.thanh_khoan]!) / 10000);
      }
      return 0;
    });
    for (let k = 0; k < TAI_SAN.length; k += 1) {
      let tong = d[k]!;
      // LAN trong nhóm tương quan, chiết khấu — "1–2 tài sản cùng tính chất"
      // tự có, không cần luật riêng (§5.2).
      for (let j = 0; j < TAI_SAN.length; j += 1) {
        if (j !== k && TAI_SAN[j]!.nhom === TAI_SAN[k]!.nhom && d[j]! > 0) {
          tong += Math.floor((d[j]! * SUC_CANG.LAN_BP) / 10000);
        }
      }
      sCang[k] = Math.max(0, Math.min(SUC_CANG.TRAN_BP, sCang[k]! + tong));
    }
    if (oMoi.kind === 'su_kien' && oMoi.su_kien === 'ha_lai_suat' && !oMoi.la_tin_gia) {
      noiLongConLai = SUC_CANG.NOI_LONG_O;
    } else if (noiLongConLai > 0) noiLongConLai -= 1;
  };

  /**
   * v35 — nguồn của chuỗi VỪA MỞ, đọc ô đứng trước ô mở + môi trường.
   * v36: máy tick gọi TRƯỚC khi push ô nên truyền ô-trước tường minh;
   * `nhanGiaiDoan` (gọi SAU push) giữ mặc định `o[o.length - 2]`.
   */
  const nguonChuoiMoi = (
    h: -1 | 0 | 1, truocMo: OThiTruong | undefined = o[o.length - 2],
  ): NguonChuoi | null => {
    const skTruoc = truocMo?.kind === 'su_kien' ? truocMo : null;
    if (h === 1) {
      // Tin GIẢ thắng môi trường: chuỗi SINH TỪ lời nói dối thì mau tàn kể cả
      // giữa tiền rẻ — và đây là kỹ năng mới: đọc cờ đã lộ để dự tuổi chuỗi.
      if (skTruoc && skTruoc.bao_truoc === 'tang' && skTruoc.la_tin_gia) return 'tin_don';
      if (moiTruongTienTe(laiSuat) === 're'
        || (skTruoc !== null && skTruoc.bao_truoc === 'tang' && !skTruoc.la_tin_gia)) {
        return 'tien_re';
      }
      return null;
    }
    if (h === -1) {
      if (skTruoc && skTruoc.su_kien === 'tang_lai_suat' && !skTruoc.la_tin_gia) {
        return 'chinh_sach_that';
      }
      if (skTruoc && !skTruoc.la_tin_gia
        && TINH_CHAT_NEN[skTruoc.su_kien as never] === 'hoang_loan') return 'hoang_loan';
      return null;
    }
    return null;
  };

  /** Ô giai đoạn vừa phát → cập nhật giai đoạn nền + chuỗi hiện hành. */
  const nhanGiaiDoan = (g: GiaiDoanId): void => {
    gdNen = g;
    phaCuoi = g;
    const h = HUONG_GIAI_DOAN[g];
    if (h === runHuong) runDai += 1;
    else {
      runHuong = h; runDai = 1;
      nguonMoChuoi = coMarkov ? nguonChuoiMoi(h) : null;
    }
  };

  for (let i = 0; i < size; i += 1) {
    const truoc = o[i - 1];
    // v54 — NỀN = MÙA của bánh xe (ngoài bong bóng / chuỗi ép, nơi máy cũ còn cầm lái).
    if (bx !== null && bbDaPhong < 0 && chuoiEp.length === 0) {
      gdNen = bx.mua; runHuong = HUONG_GIAI_DOAN[bx.mua]; runDai = bx.tuoi;
    }
    const gdNenTruocLich = gdNen;

    /*
     * ─── §4.3 — Ô BỊ ĐIỀM BÁO ÉP THÀNH THẺ ĐUÔI ─────────────────────────────
     * Cắt lãi suất khẩn = ngân hàng TW thấy thứ thị trường chưa thấy; ~75%
     * là thật. Ô ép đã được chọn NÉ ô lịch từ lúc gieo điềm.
     */
    if (epDuoi.has(i)) {
      const skDuoi = SU_KIEN.find((x) => x.id === epDuoi.get(i)!)!;
      o.push({
        kind: 'su_kien', su_kien: skDuoi.id, la_tin_gia: false,
        bao_truoc: skDuoi.bao_truoc, boi_canh: 'noi_chuoi',
      });
      trangThai.push({
        giai_doan_nen: gdNenTruocLich, run_huong: runHuong, run_dai: runDai,
        // Prior = độ tin telegraph: người theo dõi điềm báo ĐÃ biết xác suất này.
        face_prior_bp: CHU_KY.TELEGRAPH_TIN_CAY_BP,
        suc_cang_bp: chupS(), o_lich: false, lai_suat_diem: laiSuat,
        tail_face: skDuoi.id === 'thien_nga_den' || skDuoi.id in DUOI_5MAT
          ? skDuoi.id : null,
        ...muaO(),
      });
      capNhatS(o[o.length - 1]!);
      continue;
    }

    /*
     * ─── Ô LỊCH CHÍNH SÁCH (v11, D43 bước 2) — P_CAL = 1.0 ──────────────────
     *
     * Kỳ họp trumps mọi thứ, kể cả chuỗi ép bong bóng: bong bóng không nghỉ vì
     * kỳ họp (hàng đợi GIỮ NGUYÊN, ứng vào ô kế), nhưng ô lịch là ô lịch.
     * Hướng do hàm phản ứng CÔNG KHAI quyết; ~15% sai lầm chính sách + độ lớn
     * giấu là phần bất định còn lại (không tín hiệu nào tin cậy 100%).
     */
    if (oLich.includes(i + 1)) {
      /** D574 — kỳ họp CHUYỂN NỢ (Nới → Căng): luôn TĂNG thật (SPEC §4.2). */
      const chuyenNo = bcdh !== null && bcdh.chuyen_no === i + 1 && phanBcdhBat(PHAN_BCDH.CHUYEN);
      let kyVong = bx !== null
        ? bx.kyVong(o) : huongChinhSachKyVong(o, gdNenTruocLich, coChuoiMoRong);
      // D574 — hàm phản ứng nghiêng theo pha nợ ẩn (RNG domain mới — khoá cũ không tiêu cú rút nào).
      if (chuyenNo) kyVong = 'tang';
      else if (bcHienTai !== null && phanBcdhBat(PHAN_BCDH.KY_HOP)) kyVong = nghiengKyHop(kyVong, noCua(bcHienTai), rngAt(seed, `${DOMAIN}_bc_kh`, i));
      const saiLam = rngAt(seed, `${DOMAIN}_cs`, i)
        .chanceBp(LICH_CHINH_SACH.TY_LE_SAI_LAM_BP);
      let thuc: HuongChinhSach = kyVong;
      /*
       * D399 — CÁCH SAI (tỷ lệ sai 15% giữ nguyên): hàm phản ứng đòi TĂNG/HẠ thì sai phần lớn là CHẬM NHỊP (GIỮ),
       * NGƯỢC CHIỀU chỉ `NGUOC_CHIEU_BP` và kéo hệ quả (dưới); kỳ họp kế sau lần ngược chiều thì sửa sai.
       * RNG domain mới `_cs_nguoc` ⇒ tắt cổng không xê dịch cú rút nào.
       */
      const suaSai = coLuatLa && suaSaiKyHopKe;
      suaSaiKyHopKe = false;
      const SAI = LICH_CHINH_SACH.TY_LE_SAI_LAM_BP;
      const NGUOC = LUAT_LA.SAI_LAM.NGUOC_CHIEU_BP;
      /** D399 — hàm phản ứng đòi GIỮ mà sai ⇒ QUÁ TAY: đi tiếp hướng lần đổi lãi thật gần nhất (chưa có thì rút như cũ). */
      const quaTay = coLuatLa && kyVong === 'giu' ? huongLaiSuatGanNhat(o) : null;
      // Prior ex-ante suy thẳng từ luật công khai: đúng kỳ vọng = 1 − sai lầm, mỗi hướng lệch chia đôi phần
      // sai lầm — D399: sửa sai chắc chắn · chậm nhịp/ngược chiều theo `NGUOC_CHIEU_BP` · quá tay trọn phần sai.
      let prior = 10000 - SAI;
      if (chuyenNo) {
        thuc = 'tang'; prior = 10000;
      } else if (suaSai) {
        thuc = kyVong; prior = 10000;
      } else if (saiLam && coLuatLa && kyVong !== 'giu') {
        const nguoc = rngAt(seed, `${DOMAIN}_cs_nguoc`, i).chanceBp(NGUOC);
        thuc = nguoc ? (kyVong === 'tang' ? 'ha' : 'tang') : 'giu';
        prior = Math.round((SAI * (nguoc ? NGUOC : 10000 - NGUOC)) / 10000);
      } else if (saiLam && quaTay !== null) {
        thuc = quaTay; prior = SAI;
      } else if (saiLam) {
        const khac = (['tang', 'ha', 'giu'] as const).filter((h) => h !== kyVong);
        thuc = khac[rngAt(seed, `${DOMAIN}_cs2`, i).below(2)]!;
        prior = SAI / 2;
      }
      if (coLuatLa && !suaSai) {
        const hq = heQuaSaiLam(kyVong, thuc);
        if (hq !== null && bx !== null) {
          heQua = { tinX: hq.TIN_X_BP, den: i + hq.TRONG_O };
          if (hq.KEO_DAI_MUA.includes(bx.mua)) bx.keoDai(hq.KEO_DAI_O);
          suaSaiKyHopKe = LUAT_LA.SAI_LAM.SUA_SAI;
        }
      }
      if (thuc === 'giu' && bx !== null) {
        /*
         * v54 — kỳ họp GIỮ là một ô PHA của mùa đang chạy: bánh xe quay, lá hiện mặt của mùa.
         * Máy cũ lật cứng "đi ngang" ở đây — đo 23/09: 37,5% số ô ĐI NGANG của bàn 16 đến từ
         * đúng dòng ấy, cắt đôi cả một xu hướng mà máy tick không chạm tới được.
         */
        bx.quay(i, truoc, laiSuat, sucCang ? Math.max(...sCang) : null);
        runHuong = HUONG_GIAI_DOAN[bx.mua]; runDai = bx.tuoi;
        const r = matBanhXe(bx, i);
        o.push({ kind: 'giai_doan', giai_doan: r.mat });
        phaCuoi = r.mat;
      } else if (thuc === 'giu') {
        // GIỮ NGUYÊN — mặt thứ ba hợp lệ, hành xử như Đi ngang (v2 §4.2).
        o.push({ kind: 'giai_doan', giai_doan: 'di_ngang' });
        if (coThucTe && runHuong !== 0) {
          /*
           * v39 (D301): kỳ họp GIỮ là một ô NGHỈ trong chuỗi, KHÔNG phải cú cắt chuỗi.
           * Đo trước khi sửa (2.000 map 16): riêng luật reset này làm hazard chuỗi tăng
           * đo được 44% thay vì 23% khi tắt lịch — cứ 4 ô lại ~50% cơ hội một kỳ họp GIỮ
           * cắt xu hướng, thứ ngoài đời không xảy ra (Fed giữ lãi 50,6% số kỳ họp
           * 1994–2024 mà bull market TB vẫn 2,7 năm — Hartford). Xử như nhánh nghỉ của
           * máy tick: `runHuong`/`runDai` đi tiếp, `phaCuoi` là mặt vừa lật.
           */
          runDai += 1;
          phaCuoi = 'di_ngang';
          gdNen = runHuong === 1 ? 'tang' : 'giam';
        } else {
          nhanGiaiDoan('di_ngang');
        }
      } else {
        const sk = SU_KIEN.find(
          (x) => x.id === (thuc === 'tang' ? 'tang_lai_suat' : 'ha_lai_suat'))!;
        // Chính sách công bố theo lịch KHÔNG phải tin đồn: la_tin_gia luôn
        // false, và telegraph (bao_truoc) của nó kéo ô kế như mọi tin thật.
        o.push({
          kind: 'su_kien', su_kien: sk.id, la_tin_gia: false,
          bao_truoc: sk.bao_truoc, boi_canh: 'noi_chuoi',
        });
        /*
         * v35 — ĐỔ DẦU, cửa KỲ HỌP (đường sinh hạ-lãi-thật CHÍNH — đo D157:
         * ~42% ô sự kiện là chính-sách-tại-lịch). NHTW hạ lãi giữa chế độ bong
         * bóng — theo luật kỳ vọng v35 thì kỳ họp phải nghiêng TĂNG khi có
         * bong bóng, nên nhánh này gần như chỉ tới qua sai-lầm-chính-sách:
         * chính cú sai của NHTW là thứ đổ dầu, đúng 1998/2020 ngoài đời.
         */
        if (coTuongTac && coBongBongChuoi && bbDaPhong >= 0 && thuc === 'ha') {
          bbDoDau += 1;
        }
      }
      /*
       * v26 — KỲ HỌP DỊCH MỨC. Bước to có chủ ý: một kỳ họp phải ĐỔI ĐƯỢC môi
       * trường chứ không nhích một hạt, nếu không thì ngưỡng gần như không bao
       * giờ chạm tới và cả cơ chế thành trang trí.
       * ⚠ Dịch theo hướng THỰC, không theo kỳ vọng — "sai lầm chính sách" phải
       * đổi cả mức, nếu không thì nó chỉ là một dòng chữ.
       */
      if (coLaiSuat) laiSuat = dichLaiSuat(laiSuat, thuc, LAI_SUAT_NEN.BUOC_KY_HOP);
      trangThai.push({
        giai_doan_nen: gdNenTruocLich, run_huong: runHuong, run_dai: runDai,
        face_prior_bp: prior, suc_cang_bp: chupS(),
        o_lich: true, huong_cs_ky_vong: kyVong, huong_cs_thuc: thuc,
        tail_face: null, lai_suat_diem: laiSuat,
        ...muaO(),
      });
      capNhatS(o[o.length - 1]!);
      /*
       * D574 — CHUYỂN NỢ có hiệu lực từ ô SAU kỳ họp (ô kỳ họp giữ bối cảnh cũ). Bẫy giá trị ⇒ ĐỔ ĐÈO: ô kế mang cú đảo của đầu cơ,
       * ô pha kế vào thẳng gấu chu kỳ, từ đó là Siêu Gấu. Bối cảnh khác ⇒ mở NGÒI gấu chu kỳ.
       */
      if (chuyenNo && bcHienTai !== null && bx !== null) {
        if (bcHienTai === 'bay_gia_tri') {
          // Siết tiền giữa lúc bong bóng đang phồng = dập bong bóng: chế độ phồng chấm dứt, ô pha kế về tay bánh xe (gấu chu kỳ).
          // (`bbDoDau` chỉ đọc khi đang phồng và về 0 lúc bong bóng mới mở — không cần đặt lại ở đây.)
          bx.doDeo(); oDoDeo = i + 1; bbDaPhong = -1;
        } else bx.moNgoi();
        bcHienTai = idBoiCanh(songCua(bcHienTai), 'cang');
      }
      continue;
    }

    // Điều kiện đủ tư cách chen sự kiện — tách khỏi cú rút để face_prior_bp
    // tính được P(ô sự kiện) đúng bằng thứ máy thật sự dùng.
    const duTuCachSuKien =
      // Đang trong chuỗi hệ quả thì KHÔNG chen sự kiện mới vào — để bong bóng
      // kịp phồng hoặc kịp vỡ. Chen vào là cắt ngang câu chuyện.
      chuoiEp.length === 0 &&
      /*
       * v27 — VÀ ĐANG PHỒNG CŨNG KHÔNG CHEN. Đo 3.000 map trước khi thêm dòng
       * này: leo 1 ô rồi mà cú rơi chỉ dài TRUNG BÌNH 0,24 ô — vì một thẻ sự
       * kiện chen vào giữa và cắt đứt chuỗi trước khi nó kịp gãy. Người chơi
       * thấy bong bóng → tăng → một tin gì đó → hết, tức đúng cái "chuỗi mờ"
       * founder mô tả.
       * Dòng này chỉ mở rộng đúng luật ngay trên sang chế độ bong bóng: một câu
       * chuyện đang kể thì để nó kể hết.
       */
      bbDaPhong < 0 &&
      i + 1 >= NHA_CAI.KHONG_SU_KIEN_TRUOC_VONG &&
      // Không cho hai ô Sự kiện liền nhau: telegraph của ô trước phải có chỗ
      // để ứng nghiệm (hoặc lộ là giả), nếu không người chơi không bao giờ
      // kiểm chứng được tín hiệu — mà kiểm chứng chính là lõi data (17.4).
      truoc?.kind !== 'su_kien' &&
      // Và không đứng NGAY TRƯỚC ô lịch — hai lý do chồng nhau: (a) ô lịch có
      // thể là sự kiện, phạm luật liền kề ở trên; (b) nhờ luật này mọi sự kiện
      // trong cửa sổ phản ứng đều đã LỘ thật/giả khi tới kỳ họp, tức hàm phản
      // ứng người chơi TÍNH ĐƯỢC — xem huongChinhSachKyVong.
      !oLich.includes(i + 2);
    const pSuKienBp = duTuCachSuKien ? hs.tyLeSuKienBp : 0;
    const laSuKien = duTuCachSuKien &&
      rngAt(seed, `${DOMAIN}_kind`, i).chanceBp(hs.tyLeSuKienBp);
    const gdNenTruocO = gdNen;

    if (laSuKien) {
      // DÂY CHUYỀN: sự kiện THẬT gần nhất nghiêng lần rút này về hệ quả của nó.
      // Chỉ tin thật mới kéo được — tin giả kéo được thì người chơi không còn
      // cách nào phân biệt thật/giả qua hệ quả (xem MT_SU_KIEN_KE_TIEP).
      const nguon = [...o].reverse()
        .find((x): x is OSuKien => x.kind === 'su_kien' && !x.la_tin_gia);
      const keTiep = nguon ? mtKeTiep(coChuoiMoRong)[nguon.su_kien] : undefined;
      /*
       * Sự kiện gần nhất BẤT KỂ thật/giả — hai người dùng: nhãn bối cảnh T3
       * (dưới) và cú nghiêng Sập sàn v28 (trong trọng số). Tính một lần ở đây;
       * phép reverse-find không tiêu RNG nên dời lên không xê dịch map cũ.
       */
      const skTruocBatKe = [...o].reverse()
        .find((x): x is OSuKien => x.kind === 'su_kien');

      // T7 — sự kiện phụ thuộc GIAI ĐOẠN LIỀN TRƯỚC. Ô trước một sự kiện luôn
      // là ô giai đoạn (luật cấm hai sự kiện liền nhau), nên điều kiện này luôn
      // đọc được.
      const gdTruoc = truoc?.kind === 'giai_doan' ? truoc.giai_doan : null;
      const trongSoSk = SU_KIEN.map((x) => {
        /*
         * v16 — ĐỔI VÁN BÀI ĐUÔI, GIỮ NGÂN SÁCH: thiên nga khoá 0 khi duoi5
         * (kể cả bonus dây chuyền), 5 mặt mới khoá 0 khi chưa duoi5. Nền mặt
         * đuôi đọc từ DUOI_5MAT (30/25/20/15/10% của 1000 cũ — P_TAIL nguyên).
         */
        const laDuoiMoi = x.id in DUOI_5MAT;
        if (duoi5 ? x.id === 'thien_nga_den' : laDuoiMoi) return 0;
        const nenGoc = laDuoiMoi ? DUOI_5MAT[x.id]! : 1000;
        /*
         * v35 (K3c) — cạnh dây chuyền NGHE MÔI TRƯỜNG TIỀN TỆ: hệ số nhân lên
         * phần BONUS chuỗi, không đụng nền (xác suất nền theo môi trường là
         * việc của bảng v26 bên dưới — hai cần gạt, hai việc). Cổng tắt ⇒ giữ
         * nguyên phép cộng cũ từng bit.
         */
        const boChuoi = keTiep?.[x.id] ?? 0;
        const nen = nenGoc + (coChuoiMoRong && boChuoi > 0 && nguon
          ? applyBpInt(boChuoi,
            heSoKeTiepMoiTruong(nguon.su_kien, x.id, moiTruongTienTe(laiSuat)))
          : boChuoi);
        const luat = gdTruoc
          ? suKienTheoGiaiDoan(coDoiXung).find(
            (r) => r.su_kien === x.id && r.sau_giai_doan === gdTruoc)
          : undefined;
        // D399 — tiền rẻ THẬT gần đây mở lại bong bóng ngay sau lá GIẢM (bảng cũ cấm bằng hệ số 0).
        const moCua = coLuatLa && x.id === 'bong_bong' && luat?.he_so_bp === 0 && moCuaBongBongSauGiam(o);
        const w = luat && !moCua ? applyBpInt(nen, luat.he_so_bp) : nen;
        // v11: lãi suất NGOÀI lịch hạ rất thấp (×0,2) — chính sách dồn về kỳ
        // họp. Phụ phẩm v2 §4.3: tự hạ tốc độ nạp sức căng sau này, vì nới
        // lỏng là nguồn nạp chính.
        const wLich = lich && (x.id === 'ha_lai_suat' || x.id === 'tang_lai_suat')
          ? applyBpInt(w, LICH_CHINH_SACH.HA_NGOAI_LICH_BP)
          : w;
        /*
         * v26 — MÔI TRƯỜNG TIỀN TỆ NGHIÊNG XÁC SUẤT THẺ (founder 04/08:
         * *"vượt hoặc giảm tới ngưỡng cố định sẽ xảy ra các sự kiện của môi
         * trường đó"*).
         *
         * ⚠ NGHIÊNG, KHÔNG ÉP. Ép cứng một lá ở ngưỡng thì ngưỡng thành một cái
         * công tắc đọc được 100% — hết bất ngờ, và người chơi thôi phải cân
         * nhắc gì. Nhân mạnh thì vừa đoán được vừa còn chỗ cho cú lật.
         * ⚠ Mã không có trong bảng ⇒ hệ số 1 (không đụng), nên thêm/bớt mặt sự
         * kiện về sau không âm thầm đổi phân phối của những mặt không khai.
         */
        let wMt = wLich;
        if (coLaiSuat) {
          const mt = moiTruongTienTe(laiSuat);
          const bang = mt === 're' ? LAI_SUAT_NEN.NHAN_THAP_BP
            : mt === 'dat' ? LAI_SUAT_NEN.NHAN_CAO_BP : null;
          const hs = bang?.[x.id];
          if (hs !== undefined) wMt = applyBpInt(wLich, hs);
        }
        /*
         * v28 — TIN GIẢ LỘ RA KÉO SẬP SÀN (founder 08/08: *"tin giả lộ ra phải
         * kéo xác suất SẬP SÀN lên cực cao"*). Sự kiện gần nhất là tin giả ⇒
         * trọng số `hack_san` nhân 15 — tin giả thôi là nhiễu vô hại, nó thành
         * mồi lửa có hậu quả tiền thật (giá + gọi ký quỹ của chính Sập sàn).
         * ⚠ KHÔNG rò thông tin ẩn: hai sự kiện không bao giờ liền nhau nên cờ
         * thật/giả của `skTruocBatKe` ĐÃ LỘ với người chơi trước khi ô này lật
         * — máy phản ứng với tin đã công khai, người chơi dùng được đúng luật
         * này để né trước. Xem docstring MAP_V28 mục 3.
         */
        if (coV28 && skTruocBatKe?.la_tin_gia && x.id === 'hack_san') {
          wMt = applyBpInt(wMt, MAP_V28.SAP_SAN_SAU_TIN_GIA_X_BP);
        }
        /*
         * v32 — BẢN SẮC CỠ MAP, vế SỰ KIỆN. Đo ra mới thấy cần: chỉ nghiêng
         * PHA thì trọn-cung map 16 kịch trần ~34% dù đã ×4 lực — vì hồi sập
         * chỉ có 4 ô, dính 2 ô sự kiện nghiêng-tăng (hạ lãi, bong bóng) là cung
         * gãy bất kể pha. Sự kiện phải nghe cùng kịch bản.
         *
         * ⚠ CÙNG MỘT BẢNG, KHÔNG BẢNG THỨ HAI: sự kiện thừa kế độ nghiêng của
         * hồi qua `bao_truoc` — độ nghiêng công khai nó tự khai (nhãn tĩnh
         * D34, đúng nếp chương hồi client đọc). Thêm thẻ mới là thẻ tự khai
         * hướng, không có bản sao để trôi (D61). Thang ở đây là NHÂN nên quy
         * đổi 10000+bias: +1000bp hồi ⇒ ×1,10 — nghiêng, không ép.
         */
        if (coBanSac) {
          wMt = applyBpInt(wMt, 10000 + banSacBp(size, i, x.bao_truoc));
        }
        /*
         * D397 — TIN NỘI SINH RƠI ĐÚNG MÙA: bong bóng/lạm phát lúc nóng, phá sản/cạn thanh khoản lúc gãy,
         * tăng lãi lúc nóng, hạ lãi lúc suy. Đo trước cổng: phá sản rơi vào mùa TĂNG 42% (GIẢM 25%) —
         * tin rải bừa là một nửa của cảm giác "ngẫu nhiên kiểu markov". Tin ngoại sinh không có dòng ⇒ ×1.
         * ⚠ Đọc MÙA ẩn ở ô tin (bánh xe đóng băng trên ô tin ⇒ đúng mùa của ô pha liền trước).
         */
        if (coTinTheoMua && bx !== null) {
          const hs = (BANH_XE_MUA.TIN_THEO_MUA[bx.mua] as Partial<Record<SuKienId, number>>)[x.id];
          if (hs !== undefined) wMt = applyBpInt(wMt, hs);
        }
        // D574 — lớp TÂM LÝ dùng lá sẵn có: bối cảnh nhân trọng số Bong bóng / lá hoảng loạn (Siêu Bò ×1,5 · Bẫy giá trị ×2).
        if (bcHienTai !== null && phanBcdhBat(PHAN_BCDH.TIN)) {
          const bxc = BOI_CANH_DAI_HAN.BANH_XE[bcHienTai] as BanhXeBoiCanh;
          const hs = x.id === 'bong_bong' ? bxc.BONG_BONG_X_BP : TINH_CHAT_NEN[x.id] === 'hoang_loan' ? bxc.HOANG_LOAN_X_BP : undefined;
          if (hs !== undefined) wMt = applyBpInt(wMt, hs);
        }
        /*
         * D399 — BỘ LUẬT TỪNG LÁ, vế tin: hệ quả của kỳ họp sai ngược chiều nghiêng (nhân) các lá sau nó; tiền đề
         * chặn lá không có ngòi (trọng số 0) — sàn khoá rút tiền giữa mùa lành không có cú sốc thật, phá sản không
         * căng thẳng tín dụng, lạm phát giữa suy thoái không nguyên nhân, lãi suất ngoài lịch sai mùa/đảo chiều vô cớ…
         * Bảng + nguồn: `config/luat_la.ts`. ⚠ Đè luật v28 "tin giả lộ ⇒ sập sàn" ở mùa lành.
         */
        if (coLuatLa && bx !== null) {
          if (heQua !== null && i <= heQua.den) {
            const hx = heQua.tinX[x.id];
            if (hx !== undefined) wMt = applyBpInt(wMt, hx);
          }
          if (!tinHopLe(x.id, bx.mua, o, coCanSauKhung)) wMt = 0;
        }
        return wMt;
      });
      const sk = rutTheoTrongSo(SU_KIEN, trongSoSk, rngAt(seed, `${DOMAIN}_sk`, i));

      // Prior ex-ante của đúng mặt này = P(ô sự kiện) × trọng số mặt / tổng.
      // Math.round trên phép chia là THỐNG KÊ GHI LOG, không tham gia game
      // math — game math vẫn 100% số nguyên qua rutTheoTrongSo.
      const tongSk = trongSoSk.reduce((a, b) => a + b, 0);
      const wSk = trongSoSk[SU_KIEN.findIndex((x) => x.id === sk.id)]!;
      const priorSk = Math.round((pSuKienBp * wSk) / tongSk);

      /**
       * T3 — ĐỘ TIN THEO BỐI CẢNH, không còn tỷ lệ phẳng.
       *
       * ⚠ Bối cảnh tính theo sự kiện gần nhất BẤT KỂ thật/giả — KHÁC với
       * `nguon` ở trên (chỉ tin THẬT). Lệch đó là CỐ Ý: nếu tính theo tin thật
       * thì nhãn "nối chuỗi" tự tố cáo ô trước là tin thật, tức bán ngược đúng
       * thứ gate G4 tồn tại để đo. Khoảng lệch giữa hai định nghĩa chính là chỗ
       * kỹ năng hiệu chỉnh sống được.
       */
      const noiChuoi = !!skTruocBatKe
        && (mtKeTiep(coChuoiMoRong)[skTruocBatKe.su_kien]?.[sk.id] ?? 0) > 0;
      const boCanhGiaBp = (coThucTe ? TY_LE_TIN_GIA_THUC_TE : TY_LE_TIN_GIA_THEO_BOI_CANH)[noiChuoi ? 'noi_chuoi' : 'don_doc'];
      /*
       * v28 — TỶ LỆ TIN GIẢ THEO LOẠI SỰ KIỆN (founder 08/08: *"sẽ có sự kiện
       * xác suất tin giả cao và sự kiện xác suất tin giả thấp"*): nhân trên tỷ
       * lệ bối cảnh. Riêng BONG BÓNG đi theo môi trường tiền tệ — *"bong bóng
       * phải có GỐC: không tiền-rẻ ⇒ thiên về GIẢ"*. Loại sự kiện công khai
       * ngay trên lá ⇒ đây là luật học được, không phải nhiễu thêm.
       * ⚠ Cùng MỘT cú rút `chanceBp`, cùng domain — chỉ NGƯỠNG đổi theo cờ,
       * nên trận ≤ v27 replay ra đúng chuỗi thật/giả cũ.
       */
      const tyLeGia = !coV28
        ? boCanhGiaBp
        : tyLeTinGiaHieuDung(noiChuoi ? 'noi_chuoi' : 'don_doc', sk.id, laiSuat, coThucTe);
      const laTinGia = coTheLuonThat ? false : rngAt(seed, `${DOMAIN}_gia`, i).chanceBp(tyLeGia);
      o.push({
        kind: 'su_kien', su_kien: sk.id, la_tin_gia: laTinGia,
        bao_truoc: sk.bao_truoc,
        // Nhãn độ tin — CÔNG KHAI, render vô điều kiện (D26/R1). Đây là thứ
        // người chơi hiệu chỉnh dựa vào; giấu nó là giết luôn kỹ năng đọc tin.
        boi_canh: noiChuoi ? 'noi_chuoi' : 'don_doc',
      });
      /*
       * v26 — LÁ LÃI SUẤT NGOÀI LỊCH cũng dịch mức, bước NHỎ HƠN kỳ họp: chính
       * sách thật nằm ở kỳ họp, tin ngoài lịch chỉ là tin.
       * ⚠⚠ CHỈ TIN THẬT. Cho tin giả dịch được mức là phát không cho người chơi
       * một máy dò tin giả (nhìn mức có nhúc nhích không là biết), và gate G4 —
       * cái đo "đọc tin có phải kỹ năng không" — chết ngay. Cùng lý lẽ đã dùng
       * cho `nacHieuDung` ở tầng thanh khoản.
       */
      if (coLaiSuat && !laTinGia
        && (sk.id === 'tang_lai_suat' || sk.id === 'ha_lai_suat')) {
        laiSuat = dichLaiSuat(
          laiSuat, sk.id === 'tang_lai_suat' ? 'tang' : 'ha',
          LAI_SUAT_NEN.BUOC_NGOAI_LICH,
        );
      }
      trangThai.push({
        giai_doan_nen: gdNenTruocO,
        // Ô sự kiện đóng băng chuỗi: tin tức không phải giá.
        run_huong: runHuong, run_dai: runDai,
        face_prior_bp: priorSk,
        suc_cang_bp: chupS(),
        o_lich: false,
        tail_face: sk.id === 'thien_nga_den' || sk.id in DUOI_5MAT ? sk.id : null, lai_suat_diem: laiSuat,
        // §4.3 — đánh dấu lãi suất NGOÀI lịch + độ tin công khai của điềm báo.
        // Chỉ TUYÊN điềm khi còn chỗ báo (i+2 < size): cắt lãi sát cuối trận
        // không hứa được gì — hứa suông là dạy sai độ tin của chính điềm báo.
        ...(coDuoiTg && lich && !laTinGia && i + 2 < size
          && (sk.id === 'ha_lai_suat' || sk.id === 'tang_lai_suat')
          ? { ngoai_lich: true as const, telegraph_bps: CHU_KY.TELEGRAPH_TIN_CAY_BP }
          : {}),
        ...muaO(),
      });
      capNhatS(o[o.length - 1]!);
      /*
       * §4.3 — GIEO ĐIỀM: lãi suất ngoài lịch THẬT ~75% ép một thẻ đuôi ở ô
       * i+2 hoặc i+3 (cách một ô pha cho telegraph ứng nghiệm; NÉ ô lịch và
       * ô đứng ngay trước ô lịch — giữ luật tính-được của hàm phản ứng).
       */
      if (coDuoiTg && lich && !laTinGia && i + 2 < size
        && (sk.id === 'ha_lai_suat' || sk.id === 'tang_lai_suat')
        && rngAt(seed, `${DOMAIN}_tg`, i).chanceBp(CHU_KY.TELEGRAPH_TIN_CAY_BP)) {
        // Cửa ép [i+2..i+4]; chỉ né khi ô ép ĐỨNG NGAY TRƯỚC kỳ họp (j+1 là
        // lịch) — cách 2 ô thì thật/giả vẫn kịp lộ trước kỳ họp, hàm phản ứng
        // vẫn tính được. Đo 4.000 map: né quá tay + hết map từng nuốt một nửa
        // số điềm đã gieo (ứng nghiệm 38,6% — điềm sai nhiều hơn đúng là phản
        // giáo dục; sau sửa ≈ 65%, đúng khoảng "đáng tin nhưng không chắc").
        // v16: điềm ép mặt đuôi rút theo đúng ngân sách 30/25/20/15/10.
        let matEp: SuKienId = 'thien_nga_den';
        if (duoi5) {
          const ds = Object.entries(DUOI_5MAT);
          let moc = rngAt(seed, `${DOMAIN}_tgm`, i)
            .below(ds.reduce((a, [, w]) => a + w, 0));
          for (const [id, w] of ds) {
            moc -= w;
            if (moc < 0) { matEp = id as SuKienId; break; }
          }
        }
        for (const j of [i + 2, i + 3, i + 4]) {
          if (j >= size) break;
          if (oLich.includes(j + 1)) continue;
          epDuoi.set(j, matEp);
          break;
        }
      }

      /*
       * v35 — CHIẾN TRANH THẬT KÉO CẤM VẬN THEO (D158, cổng `tuongTac`): ép
       * CÓ XÁC SUẤT một ô cam_van vào khe sự kiện kế — khuôn `epDuoi` của
       * điềm, cùng luật né kỳ họp. Không có cú ép này thì cặp cộng-hưởng-trú-
       * ẩn 0/1500 trận (đo D158): kế thừa tự do hiếm theo cấu trúc, cạnh dây
       * chuyền một mình không cứu được. Đòi `duoi5` vì cam_van là mặt đuôi.
       * Domain RNG MỚI — không xê dịch một cú rút nào của map cũ (nếp rngAt).
       */
      if (coTuongTac && duoi5 && sk.id === 'chien_tranh' && !laTinGia
        && rngAt(seed, `${DOMAIN}_ttcv`, i).chanceBp(TUONG_TAC_THE.EP_CAM_VAN_BP)) {
        // Khe [i+2..i+4] như điềm gốc — đo D158: khe hẹp [i+2,i+3] bị dải cấm
        // quanh kỳ họp nuốt 2/3 số cú ép (38 roll thắng → 13 đậu).
        for (const j of [i + 2, i + 3, i + 4]) {
          if (j >= size) break;
          if (oLich.includes(j + 1) || oLich.includes(j) || epDuoi.has(j)) continue;
          epDuoi.set(j, 'cam_van');
          break;
        }
      }

      // v35 — ĐỔ DẦU: hạ lãi THẬT (ngoài lịch) rơi giữa chế độ ⇒ tiếp dầu.
      if (coTuongTac && coBongBongChuoi && bbDaPhong >= 0
        && sk.id === 'ha_lai_suat' && !laTinGia) {
        bbDoDau += 1;
      }

      // BONG BÓNG THẬT ép hai vòng kế: phồng tiếp hoặc vỡ ngay. Người chơi
      // KHÔNG được biết mình đang ở nhánh nào — cùng một lá bài, hai số phận,
      // và đó chính là khẩu vị rủi ro app muốn đo.
      if (sk.id === 'bong_bong' && !laTinGia) {
        if (coBongBongChuoi) {
          // v54 — bong bóng thật giữa mùa lên = chợ vào cuối chu kỳ (QUÁ NÓNG).
          bx?.vaoBongBong();
          // v27 — KHÔNG tung đồng xu, KHÔNG ép ô nào. Vào chế độ, rồi để từng ô
          // tự rút: đó là chỗ duy nhất người chơi có khoảnh khắc để đọc.
          bbDaPhong = 0;
          bbDoDau = 0;
        } else {
          const phong = rngAt(seed, `${DOMAIN}_bb`, i)
            .chanceBp(BONG_BONG.XAC_SUAT_PHONG_BP);
          chuoiEp = [...(phong ? BONG_BONG.CHUOI_PHONG : BONG_BONG.CHUOI_VO)];
        }
      }
      continue;
    }

    // Đang trong chuỗi hệ quả → lấy giai đoạn đã bị ép, không rút nữa.
    // Prior = 10000: theo trạng thái máy, ô này đã được định đoạt từ trước.
    if (chuoiEp.length > 0) {
      const g = chuoiEp.shift()!;
      // v54 — cú vỡ bong bóng là SUY THOÁI.
      bx?.epGiam();
      o.push({ kind: 'giai_doan', giai_doan: g });
      nhanGiaiDoan(g);
      trangThai.push({
        giai_doan_nen: gdNenTruocO, run_huong: runHuong, run_dai: runDai,
        face_prior_bp: 10000, suc_cang_bp: chupS(),
        o_lich: false, tail_face: null, lai_suat_diem: laiSuat,
        ...muaO(),
      });
      capNhatS(o[o.length - 1]!);
      continue;
    }

    /*
     * ═══ v36 — MÁY REGIME TICK (D165, cổng `regimeTick`) ═════════════════════
     * NỀN tick trước, ô CÔNG BỐ sau — thẻ pha thôi là cú rút tự quyết hướng.
     * Regime = CHÍNH bộ (runHuong · runDai · nguonMoChuoi) sẵn có — không dựng
     * biến song song (bản trùng là lý do cả cuộc đập này tồn tại, D152).
     * Bốn nhịp: (1) tin tốt THẬT cắt chuỗi giảm ⇒ mặt `phuc_hoi` — ĐƯỜNG DUY
     * NHẤT mặt này còn xuất hiện; (2) nền có hướng đổ HAZARD; (3) sống ⇒ rút
     * mặt trên nền (mặt NGƯỢC hướng không tồn tại khi nền sống — mặt ngược
     * chính là cú gãy); (4) gãy/NGANG ⇒ rút chuyển tiếp. XUỐNG không bao giờ
     * nhảy thẳng LÊN qua hazard — đáy-cần-thời-gian nay là CẤU TRÚC.
     * Chế độ bong bóng v27 GIỮ NGUYÊN (bbDaPhong ≥ 0 đi đường cũ — D152).
     * `gdNen` dưới tick = NHÃN NỀN (tang/giam/di_ngang theo regime), không
     * phải mặt vừa lật; `phaCuoi` vẫn = mặt. RNG toàn domain MỚI (`_tick_*`)
     * — đường v35 không xê dịch một cú rút nào.
     */
    /*
     * ═══ v54 — Ô PHA TRÊN BÁNH XE (D389) ═══════════════════════════════════════════════
     * Đứng TRƯỚC nhánh tick: map bánh xe không bao giờ vào nhánh ấy (bánh xe thay máy tick
     * cho ô pha thường; máy tick vẫn nguyên cho map ≤ v53).
     */
    if (bx !== null && bbDaPhong < 0) {
      bx.quay(i, truoc, laiSuat, sucCang ? Math.max(...sCang) : null);
      runHuong = HUONG_GIAI_DOAN[bx.mua]; runDai = bx.tuoi;
      const r = matBanhXe(bx, i);
      o.push({ kind: 'giai_doan', giai_doan: r.mat });
      phaCuoi = r.mat;
      trangThai.push({
        giai_doan_nen: gdNenTruocO, run_huong: runHuong, run_dai: runDai,
        // Ex-ante: P(ô này là ô pha) × P(mặt | mùa).
        face_prior_bp: Math.round(((10000 - pSuKienBp) * r.prior) / 10000),
        suc_cang_bp: chupS(), o_lich: false, tail_face: null, lai_suat_diem: laiSuat,
        ...muaO(),
      });
      capNhatS(o[o.length - 1]!);
      continue;
    }
    if (coTick && bbDaPhong < 0) {
      const skTruocThat = truoc?.kind === 'su_kien' && !truoc.la_tin_gia ? truoc : null;
      const mt = moiTruongTienTe(laiSuat);
      const pPha = 10000 - pSuKienBp;
      let mat: GiaiDoanId;
      let priorBp: number;
      const bs = (id: GiaiDoanId, w: number): number =>
        (coBanSac ? Math.max(0, w + banSacBp(size, i, id)) : w);
      const rutDs = (ds: readonly (readonly [GiaiDoanId, number])[], dom: string):
      { mat: GiaiDoanId; w: number; tong: number } => {
        const tong = ds.reduce((a, [, w]) => a + w, 0);
        let moc = rngAt(seed, dom, i).below(Math.max(1, tong));
        for (const [id, w] of ds) {
          moc -= w;
          if (moc < 0) return { mat: id, w, tong };
        }
        const cuoi = ds[ds.length - 1]!;
        return { mat: cuoi[0], w: cuoi[1], tong };
      };

      // (1) TIN TỐT THẬT CẮT CHUỖI GIẢM — sinh `phuc_hoi` có nguyên nhân.
      const duocCat = runHuong === -1 && skTruocThat !== null
        && skTruocThat.bao_truoc === 'tang';
      if (duocCat
        && rngAt(seed, `${DOMAIN}_tick_cat`, i).chanceBp(RT.CAT_CHUOI_XAU_BP)) {
        mat = 'phuc_hoi';
        runHuong = 1; runDai = 1;
        nguonMoChuoi = coMarkov ? nguonChuoiMoi(1, truoc) : null;
        priorBp = Math.round((pPha * RT.CAT_CHUOI_XAU_BP) / 10000);
      } else if (runHuong !== 0) {
        // (2) HAZARD GÃY của nền có hướng.
        // v39: chuỗi GIẢM có hazard riêng (bear ngắn, CÓ tuổi — Diebold–Rudebusch); cờ tắt
        // thì hai bộ bằng nhau nên phép tính y hệt bản cũ.
        let hz = runHuong === 1
          ? RT.HAZARD_NEN_BP + runDai * RT.HAZARD_TUOI_BP
          : RT.HAZARD_GIAM_NEN_BP + runDai * RT.HAZARD_GIAM_TUOI_BP;
        if (coMarkov && nguonMoChuoi !== null) {
          hz = applyBpInt(hz, MARKOV_NGUON.NGUON_LI.includes(nguonMoChuoi)
            ? RT.HAZARD_NGUON_LI_BP : RT.HAZARD_NGUON_TAN_BP);
        }
        if ((runHuong === 1 && mt === 'dat') || (runHuong === -1 && mt === 're')) {
          hz += RT.HAZARD_NGUOC_MT_BP;
        }
        if (skTruocThat
          && HUONG_GIAI_DOAN[skTruocThat.bao_truoc] === (runHuong === 1 ? -1 : 1)) {
          hz += RT.HAZARD_TELEGRAPH_BP;
        }
        if (sucCang && runHuong === 1) {
          hz += applyBpInt(
            Math.floor((Math.max(...sCang) * SUC_CANG.HAZARD_BP) / 10000),
            RT.HAZARD_CANG_BP);
        }
        // D177 — hồ sơ cỡ map: bàn ngắn thì chuỗi gãy nhanh hơn (đảo chiều
        // nhiều ⇒ vị thế cũ hết đúng sớm ⇒ phải quyết lại).
        hz = applyBpInt(hz, hs.hazardXBp);
        // Trần: hazard 100% là ĐỊNH ĐOẠT — phạm §3 addendum (nghiêng, không ép).
        hz = Math.min(9000, hz);
        const pCat = duocCat ? RT.CAT_CHUOI_XAU_BP : 0;
        if (!rngAt(seed, `${DOMAIN}_tick_haz`, i).chanceBp(hz)) {
          // (3) NỀN SỐNG — mặt trên nền; điềm thuận cộng như telegraph cũ.
          const thuan: GiaiDoanId = runHuong === 1 ? 'tang' : 'giam';
          const ds = [
            [thuan, bs(thuan, RT.MAT_THUAN_BP
              + (skTruocThat?.bao_truoc === thuan ? NHA_CAI.SUC_MANH_TELEGRAPH_BP : 0))],
            ['di_ngang', bs('di_ngang', applyBpInt(RT.MAT_NGHI_BP, hs.nghiXBp))],
            ['bien_dong', bs('bien_dong', RT.MAT_BIEN_DONG_BP)],
          ] as const;
          const r = rutDs(ds, `${DOMAIN}_tick_mat`);
          mat = r.mat;
          runDai += 1;
          priorBp = Math.round((((pPha * (10000 - pCat)) / 10000)
            * ((10000 - hz) / 10000) * r.w) / Math.max(1, r.tong));
        } else {
          // (4) GÃY. LÊN: về ngang · đảo xuống · mặt biến động (nền về ngang).
          //     XUỐNG: KHÔNG đảo thẳng lên — dồn cửa đảo vào cửa ngang.
          const ds = runHuong === 1
            ? [
              ['di_ngang', bs('di_ngang', RT.GAY_VE_NGANG_BP)],
              ['giam', bs('giam', RT.GAY_DAO_HUONG_BP)],
              ['bien_dong', bs('bien_dong', RT.GAY_BIEN_DONG_BP)],
            ] as const
            : [
              ['di_ngang', bs('di_ngang',
                RT.GAY_VE_NGANG_BP + RT.GAY_DAO_HUONG_BP)],
              ['bien_dong', bs('bien_dong', RT.GAY_BIEN_DONG_BP)],
            ] as const;
          const r = rutDs(ds, `${DOMAIN}_tick_chuyen`);
          mat = r.mat;
          if (mat === 'giam' && runHuong === 1) {
            runHuong = -1; runDai = 1;
            nguonMoChuoi = coMarkov ? nguonChuoiMoi(-1, truoc) : null;
          } else {
            runHuong = 0; runDai = 1; nguonMoChuoi = null;
          }
          priorBp = Math.round((((pPha * (10000 - pCat)) / 10000)
            * (hz / 10000) * r.w) / Math.max(1, r.tong));
        }
      } else {
        // (5) NỀN NGANG — giữ nghỉ · biến động · MỞ hướng (điềm nhân cửa mở).
        const nhanTg = (h: GiaiDoanId): number =>
          (skTruocThat?.bao_truoc === h ? RT.NGANG_MO_TELEGRAPH_X_BP : 10000);
        const ds = [
          ['di_ngang', bs('di_ngang', applyBpInt(RT.NGANG_NGHI_BP, hs.nghiXBp))],
          ['bien_dong', bs('bien_dong', RT.NGANG_BIEN_DONG_BP)],
          ['tang', bs('tang',
            applyBpInt(RT.NGANG_MO_HUONG_BP, nhanTg('tang')))],
          ['giam', bs('giam',
            // v39: chợ có drift dương — cửa mở XUỐNG nhân 0,54 (65:35). Cờ tắt = ×1 (y hệt).
            applyBpInt(applyBpInt(RT.NGANG_MO_HUONG_BP, nhanTg('giam')),
              RT.NGANG_MO_GIAM_X_BP))],
        ] as const;
        const r = rutDs(ds, `${DOMAIN}_tick_mo`);
        mat = r.mat;
        if (mat === 'tang' || mat === 'giam') {
          runHuong = mat === 'tang' ? 1 : -1;
          runDai = 1;
          nguonMoChuoi = coMarkov ? nguonChuoiMoi(runHuong, truoc) : null;
        } else {
          runDai += 1;
        }
        priorBp = Math.round((pPha * r.w) / Math.max(1, r.tong));
      }

      gdNen = runHuong === 1 ? 'tang' : runHuong === -1 ? 'giam' : 'di_ngang';
      phaCuoi = mat;
      o.push({ kind: 'giai_doan', giai_doan: mat });
      trangThai.push({
        giai_doan_nen: gdNenTruocO, run_huong: runHuong, run_dai: runDai,
        face_prior_bp: Math.max(0, Math.min(10000, priorBp)),
        suc_cang_bp: chupS(), o_lich: false, tail_face: null, lai_suat_diem: laiSuat,
      });
      capNhatS(o[o.length - 1]!);
      continue;
    }

    // Ô giai đoạn. Nếu ô trước là sự kiện THẬT → nghiêng về giai đoạn được báo.
    const trongSo = GIAI_DOAN.map((g) => {
      // Nền là Đi ngang: thị trường êm cho tới khi tin làm nó động (17.1).
      let w = g.id === 'di_ngang' ? 3000 : 1500;
      /*
       * v32 — BẢN SẮC CỠ MAP (D85/D86 §2): kịch bản hồi cộng vào trọng số theo
       * VỊ TRÍ ô. Xem `BAN_SAC_MAP` — map 8 trả 0 tuyệt đối (mẫu đối chứng).
       *
       * ⚠ TIÊM Ở ĐÂY, TRƯỚC MỌI LUẬT PHÍA DƯỚI, có chủ ý: các luật cứng (phục
       * hồi chỉ mở sau chuỗi giảm đủ dài — nó ÉP w = 0) phải thắng được kịch
       * bản. Đặt cuối callback thì hồi IV cộng +900 cho phục hồi SAU khi luật
       * đáy-cần-thời-gian đã ép 0, tức kịch bản hồi sinh đúng cái răng cưa
       * đảo-đáy-một-ô mà v12 dựng luật để giết.
       */
      if (coBanSac) w = Math.max(0, w + banSacBp(size, i, g.id));
      if (truoc?.kind === 'su_kien' && !truoc.la_tin_gia && g.id === truoc.bao_truoc) {
        w += NHA_CAI.SUC_MANH_TELEGRAPH_BP;
      }
      /*
       * v12 — QUÁN TÍNH (bước 3, §3+§5.3). Chỉ chuỗi ĐÃ XÁC NHẬN (≥ 2 ô cùng
       * hướng) mới nghiêng cú rút; run vừa gãy thì dai = 1 ⇒ dưới ngưỡng ⇒
       * hàng TRUNG TÍNH — đó chính là luật reset §5.3, không cần nhánh riêng.
       * Chuỗi ép bong bóng cũng nạp run qua nhanGiaiDoan ⇒ bong bóng thật tự
       * mở một xu hướng tăng có trớn — đúng đời: bong bóng đẻ ra momentum.
       */
      if (quanTinh) {
        /*
         * v35 — MARKOV THEO NGUYÊN NHÂN (D159): hai đòn bẩy theo nguồn mở
         * chuỗi (nguồn LÌ hạ NGƯỠNG về 1 — quán tính bám ngay ô đầu; nguồn
         * MAU TÀN cộng trọng số MẶT ĐẢO ở nhánh dưới). KHÔNG nhân biên tilt —
         * bản đầu D159 đo ra trang trí (1,70→1,71), đúng chú thích `tuLapBp`.
         * TẮT trong chế độ bong bóng — v27 sở hữu độ lì mòn dần riêng
         * (D152 "giữ v27"), chồng hai tầng lì là bong bóng bất tử.
         * ⚠ `nguonMoChuoi` (nhãn nguồn) cố ý đặt tên XA HẲN `nguongChuoi`
         * (ngưỡng) — hai chữ chỉ lệch một ký tự là quả mìn đồng âm D126.
         */
        const coNguon = coMarkov && nguonMoChuoi !== null && bbDaPhong < 0;
        const laNguonLi = coNguon && MARKOV_NGUON.NGUON_LI.includes(nguonMoChuoi!);
        const nguongHieuDung = laNguonLi ? MARKOV_NGUON.NGUONG_LI : nguongChuoi;
        const tuLapHieuDung = laNguonLi
          ? applyBpInt(tuLapBp, MARKOV_NGUON.LI_TU_LAP_X_BP) : tuLapBp;
        if (runDai >= nguongHieuDung && phaCuoi) {
          if (runHuong === 1 && g.id === phaCuoi) w += tuLapHieuDung;
          if (runHuong === -1) {
            if (g.id === 'giam') w += tuLapHieuDung;
            if (g.id === 'bien_dong') w += QUAN_TINH.KEM_BIEN_DONG_BP;
          }
        }
        // Đáy cần thời gian: Phục hồi chỉ mở sau chuỗi Giảm đủ dài — chặn
        // răng cưa đảo-đáy-một-ô, thứ v2 gọi tên là nguồn cảm giác hỗn loạn.
        if (g.id === 'phuc_hoi' && phaCuoi === 'giam'
          && runDai < QUAN_TINH.PHUC_HOI_SAU_GIAM_O) w = 0;
        /*
         * v35 — nguồn MAU TÀN: hazard chủ động lên MẶT ĐẢO CHIỀU từ ô thứ
         * hai. Chuỗi tăng sinh từ tin giả thì mặt Giảm được đẩy; chuỗi giảm
         * sinh từ hoảng loạn thì mặt Tăng được đẩy (sốc bật lại nhanh —
         * "tin tốt cắt chuỗi xấu" của founder sau này cũng đi cửa này).
         */
        if (coNguon && MARKOV_NGUON.NGUON_MAU_TAN.includes(nguonMoChuoi!)
          && runDai >= 1) {
          if (runHuong === 1 && g.id === 'giam') w += MARKOV_NGUON.GAY_BP;
          if (runHuong === -1 && g.id === 'tang') w += MARKOV_NGUON.GAY_BP;
        }
      }
      /*
       * v13 — HAZARD THEO SỨC CĂNG (§5.2 tác dụng 2): càng căng càng dễ sập.
       * Đối trọng tự nhiên của quán tính: chuỗi tăng vừa muốn tiếp diễn
       * (+TU_LAP) vừa tự nạp S đẩy mặt Giảm lên — "chuỗi vừa hiếm dần vừa
       * đắt dần" (§5.3) là hai lực này giằng nhau, không phải một bảng trôi.
       */
      if (sucCang && g.id === 'giam') {
        w += Math.floor((Math.max(...sCang) * SUC_CANG.HAZARD_BP) / 10000);
      }
      /*
       * v27 — ĐANG TRONG BONG BÓNG: nghiêng MẠNH về `tang`, và phần nghiêng ấy
       * MÒN DẦN theo số ô đã phồng. Leo càng cao càng khó leo tiếp — bong bóng
       * tự ăn mình, và đó cũng là thứ chặn một chuỗi tăng chạy tới hết map.
       * ⚠ NGHIÊNG, KHÔNG ÉP: còn rút thì còn chỗ để gãy, và cú gãy chính là
       * khoảnh khắc mà cả cơ chế này sinh ra để tạo.
       */
      if (coBongBongChuoi && bbDaPhong >= 0 && g.id === 'tang') {
        let nghieng = Math.max(0,
          BB.NGHIENG_TANG_BP
            // v35 — ĐỔ DẦU: nhiên liệu chống lại độ mòn của chính bong bóng.
            + bbDoDau * TUONG_TAC_THE.DO_DAU_THEM_BP
            - bbDaPhong * BB.NGHIENG_GIAM_MOI_O);
        /*
         * v28 — BONG BÓNG CÓ GỐC, vế GÃY SỚM (founder 08/08: *"không tiền-rẻ ⇒
         * thiên về GIẢ/gãy sớm"*). Leo mà không có tiền rẻ chống lưng thì độ
         * nghiêng co lại ⇒ xác suất rút ra thứ-khác-tăng (tức GÃY) cao hơn hẳn
         * từng ô. Đọc môi trường TỪNG Ô chứ không chốt lúc vào chế độ: kỳ họp
         * giữa bong bóng đổi được số phận nó — đúng đời, và người theo dõi lãi
         * suất có thêm một lý do để theo dõi.
         */
        if (coV28) {
          nghieng = applyBpInt(
            nghieng, MAP_V28.NGHIENG_BB_THEO_MOI_TRUONG[moiTruongTienTe(laiSuat)]);
        }
        w += nghieng;
      }
      /*
       * v28 — PHỤC HỒI LÀ CÂY CẦU (founder 08/08: *"recovery = cầu
       * downtrend→uptrend"*). Pha vừa lật là Phục hồi ⇒ cú rút kế nghiêng về
       * `tang` và nén `giam` — phục hồi thôi là một chớp xanh kẹp giữa hai màu
       * đỏ. KHÔNG khoá hẳn `giam`: đáy hai lần có thật ngoài đời, khoá là biến
       * tín hiệu thành công tắc đọc được 100% (cùng lý lẽ TY_LE_SAI_LAM_BP).
       */
      if (coV28 && phaCuoi === 'phuc_hoi') {
        if (g.id === 'tang') w += MAP_V28.PHUC_HOI_CAU.THEM_TANG_BP;
        if (g.id === 'giam') w = applyBpInt(w, MAP_V28.PHUC_HOI_CAU.GIAM_CON_BP);
      }
      return w;
    });
    /*
     * v39 (D301): trong chế độ bong bóng, P(phồng tiếp)/ô đặt TƯỜNG MINH theo GSY thay vì
     * để trọng số cộng dồn quyết định. Cùng máy rút, cùng RNG; chỉ đặt lại trọng số
     * 'tang' sao cho tỷ phần đúng p, các mặt còn lại giữ tỷ lệ tương đối (mặt nào
     * không phải 'tang' cũng là GÃY — xem nhánh v27 ngay dưới). Cờ tắt ⇒ không chạm.
     */
    if (coThucTe && coBongBongChuoi && bbDaPhong >= 0) {
      const iTang = GIAI_DOAN.findIndex((x) => x.id === 'tang');
      const khac = trongSo.reduce((a, w, k) => (k === iTang ? a : a + w), 0);
      const pBp = BONG_BONG_PHONG_TIEP_BP[moiTruongTienTe(laiSuat)];
      // w_tang / (w_tang + khác) = p  ⇒  w_tang = khác · p / (1 − p), số nguyên.
      trongSo[iTang] = Math.max(1, Math.floor((khac * pBp) / (10000 - pBp)));
    }
    let g = rutTheoTrongSo(GIAI_DOAN, trongSo, rngAt(seed, `${DOMAIN}_gd`, i));
    /*
     * ─── v27 — PHỒNG THÊM, HAY GÃY? ───────────────────────────────────────
     * Đây là cả cơ chế, gói trong một nhánh: rút ra `tang` thì bong bóng lên
     * một nấc; rút ra bất cứ thứ gì khác thì GÃY NGAY — ô này thành `giam`, và
     * xếp tiếp một chuỗi giảm DÀI THEO ĐỘ CAO đã leo.
     * ⚠ Chạm trần `DAI_TOI_DA` cũng là gãy: bong bóng không phồng vĩnh viễn.
     */
    if (coBongBongChuoi && bbDaPhong >= 0) {
      const conLeoDuoc = bbDaPhong < BB.DAI_TOI_DA;
      if (g.id === 'tang' && conLeoDuoc) {
        bbDaPhong += 1;
      } else {
        // GÃY. Ô này là cú sập, và độ sâu của hố tính theo độ cao đã leo.
        g = GIAI_DOAN.find((x) => x.id === 'giam')!;
        const sau = Math.min(
          BONG_BONG_V27.VO_TOI_DA_O,
          BONG_BONG_V27.VO_TOI_THIEU_O + bbDaPhong * BONG_BONG_V27.VO_THEO_DAI_O
            // v35 — ĐỔ DẦU: leo bằng dầu thì rơi cũng sâu bằng dầu (vẫn chịu trần).
            + bbDoDau * TUONG_TAC_THE.DO_DAU_VO_THEM_O,
        );
        // −1 vì chính ô này đã là ô giảm đầu tiên của cú rơi.
        chuoiEp = Array.from({ length: Math.max(0, sau - 1) }, () => 'giam' as GiaiDoanId);
        bbDaPhong = -1;
        bbDoDau = 0;
      }
    }
    o.push({ kind: 'giai_doan', giai_doan: g.id });
    // v54 — ô pha rút bằng máy cũ (chế độ bong bóng): mùa đi theo mặt vừa lật.
    bx?.dongBo(g.id);
    const tongGd = trongSo.reduce((a, b) => a + b, 0);
    const wGd = trongSo[GIAI_DOAN.findIndex((x) => x.id === g.id)]!;
    nhanGiaiDoan(g.id);
    trangThai.push({
      giai_doan_nen: gdNenTruocO, run_huong: runHuong, run_dai: runDai,
      face_prior_bp: Math.round(((10000 - pSuKienBp) * wGd) / tongGd),
      suc_cang_bp: chupS(), o_lich: false, tail_face: null, lai_suat_diem: laiSuat,
      ...muaO(),
    });
    capNhatS(o[o.length - 1]!);
  }

  if (coNgoi) ganTinhChatPha(o, trangThai);
  return { seed, o, trang_thai: trangThai, ...(chuKy ? { chu_ky: chuKy } : {}) };
}

/**
 * D560 — GẮN TÍNH CHẤT cho lá pha (chu kỳ có ngòi), theo mùa ẩn SAU ô đó (`trang_thai[i].mua/loai_mua`):
 * · mặt lá ĐÚNG mùa ⇒ loại của mùa (bò dòng tiền / tăng trưởng · gấu sự kiện / định giá / chu kỳ · tích lũy / phân phối);
 * · mặt ĐI NGANG lệch giữa mùa khác ⇒ theo hướng KẾ TIẾP của mùa: mùa lên (phục hồi · tăng) và gấu sự kiện (hồi nhanh) ⇒ TÍCH LŨY,
 *   quá nóng · gấu định giá / chu kỳ ⇒ PHÂN PHỐI;
 * · mặt lệch khác ⇒ không tính chất (nhịp ngược ngắn, không phải một loại thị trường).
 * Hàm thuần, không tiêu RNG.
 */
function ganTinhChatPha(o: OThiTruong[], tt: readonly TrangThaiO[]): void {
  for (let i = 0; i < o.length; i++) {
    const x = o[i]!, t = tt[i];
    if (x.kind !== 'giai_doan' || !t?.mua) continue;
    if (x.giai_doan === t.mua && t.loai_mua) { x.tinh_chat = t.loai_mua; continue; }
    // gấu SỰ KIỆN hồi nhanh ⇒ nhịp ngang giữa nó là tích lũy (đi tiếp lên), không phải phân phối.
    if (x.giai_doan === 'di_ngang') {
      x.tinh_chat = t.mua === 'phuc_hoi' || t.mua === 'tang' || t.loai_mua === 'gau_su_kien' ? 'tich_luy' : 'phan_phoi';
    }
  }
}

/**
 * THÀNH PHẦN CÔNG KHAI của phần map CHƯA LẬT — phục vụ lớp kỹ năng đếm bài.
 *
 * CỐ Ý chỉ trả số đếm, KHÔNG trả thứ tự và KHÔNG trả cờ tin giả. Người chơi
 * biết "còn 2 sự kiện trong 5 ô còn lại" nhưng không biết ô nào, cũng không
 * biết cái nào giả — đúng thông tin ẩn mà thiết kế cần (16.8 + 17.3).
 */
export function thanhPhanCongKhai(map: HoldemMap, daLat: number, theLuonThat = false): {
  con_lai: number;
  so_giai_doan: number;
  so_su_kien: number;
  /** Số tin giả THỐNG KÊ kỳ vọng — không phải số thật, để không lộ bài. */
  tin_gia_ky_vong: number;
  /** D456 — trận thẻ luôn thật: web không hiện "~N giả". CHỈ có mặt khi bật (vắng = luật cũ, DTO y như trước). */
  the_luon_that?: true;
} {
  const conLai = map.o.slice(daLat);
  const soSuKien = conLai.filter((x) => x.kind === 'su_kien').length;
  return {
    con_lai: conLai.length,
    so_giai_doan: conLai.length - soSuKien,
    so_su_kien: soSuKien,
    // D456 — trận thẻ luôn thật: kỳ vọng tin giả = 0 (không phải "kỳ vọng 35 % rồi để người chơi đoán").
    tin_gia_ky_vong: theLuonThat ? 0 : Math.round((soSuKien * NHA_CAI.TY_LE_TIN_GIA_BP) / 10000),
    ...(theLuonThat ? { the_luon_that: true as const } : {}),
  };
}

/**
 * Ô mà người chơi ĐƯỢC PHÉP thấy ở vòng `vong` (1-indexed).
 * Cờ `la_tin_gia` bị cắt — chỉ lộ khi ô kế đã lật (engine quyết định).
 */
export function oCongKhai(
  o: OThiTruong,
): (Omit<OSuKien, 'la_tin_gia'> & { tinh_chat: string }) | ONenGiaiDoan {
  if (o.kind === 'giai_doan') return o;
  const { la_tin_gia: _bo, ...cong_khai } = o;
  /*
   * ⭐ TÍNH CHẤT CỦA Ô (D152/K1, founder chỉnh: *"1 thẻ với chuỗi sự kiện
   * trước đó có thể có tính chất khác nhau"*) — thuộc tính CỦA TỪNG Ô, server
   * tính, client chỉ vẽ (D26). Hôm nay = tính chất NỀN theo loại tin; khi v35
   * thêm luật tương tác thẻ thì ĐÚNG CHỖ NÀY đọc thêm ngữ cảnh (dư âm đang
   * sống · chế độ bong bóng · cặp tin ≤2 vòng) để trả tính chất ngữ cảnh
   * (dung_thuoc · do_dau · cong_huong…) — client không sửa một dòng.
   * ⚠ Theo MẶT CHỮ: đọc `o.su_kien` (tin giả mang tính chất của tin nó giả
   * dạng), TUYỆT ĐỐI không đọc `la_tin_gia` — cùng lệnh cấm của telegraph.
   */
  return { ...cong_khai, tinh_chat: TINH_CHAT_NEN[o.su_kien] };
}
