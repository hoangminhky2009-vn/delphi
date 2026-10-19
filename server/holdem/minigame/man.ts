/**
 * MÀN MINIGAME TRÊN SERVER — phần THUẦN (D466, bước 3.3 kế hoạch `docs/thiet-ke-de-xuat/gameplay/kien-truc-minigame.md` §5 + §7).
 *
 * Ba việc, không việc nào đọc đồng hồ hay DB (giờ máy được TRUYỀN VÀO, nên test và replay chạy y hệt):
 *  1. BỐI CẢNH MÀN từ trận thật: mã nắm nhiều nhất · lá của vòng (NỔ / DƯ ÂM / TRƯỚC / giai đoạn) · sức căng của ô ⇒ đầu vào
 *     của `dungDongMin` (§3–§4). Kết quả GHI VÀO DB lúc mở màn — đổi hàm này về sau không đổi màn đã mở.
 *  2. GIỜ ⇒ NHỊP: nhịp giá thứ k (0…479) lộ ra ở `bat_dau + đếm 4 s + (k + 1) × 34 s / 480`. Chỉ tầng API đổi giờ ra nhịp; giá
 *     và lệnh chỉ nói bằng SỐ NHỊP ⇒ replay không cần giờ.
 *  3. CỬA SỔ LỆNH: cú bấm kèm nhịp người chơi ĐANG THẤY, nhận nếu không ở tương lai và không cũ quá `CUA_SO_LENH_MS`.
 *
 * Khớp lệnh, tiền, quyết toán thuộc từng lõi (bước 4) — ở đây chỉ có cú bấm và giá của nhịp.
 */
import { danhSoTin, lapTinMan, tinViMoMan, type TinMan } from './tin.js';
import { tinViMoVong, type TinViMo } from '../boi_canh_dai_han.js';
import { BOI_CANH_DAI_HAN, type BanhXeBoiCanh } from '../../../config/boi_canh_dai_han.js';
import { DONG_HO_MINIGAME, NHA_CAI, mtGiaiDoan, mtSuKien, type GiaiDoanId, type SuKienId } from '../../../config/holdem.js';
import { BAY_CA_NHAN, CUA_SO_LENH_MS, K_MIN, MA_MINIGAME, NEN_LS, NHIP_MOI_NEN, SO_NHIP, TIEN_TO_CHON_LA, TO_CHUC_V57, TU_DAY, TUONG_QUAN_CAP, VAO_GIA } from '../../../config/minigame.js';
import { HINH_CHUNG } from '../../../config/minigame_hinh.js';
import { HUONG_GIAI_DOAN, THU_TU_MA_SUC_CANG, type HoldemMap } from '../map.js';
import { daiSucCang } from '../nav.js';
import { nacHieuDung } from '../engine.js';
import { TAI_SAN, betaCua } from '../../../config/holdem.js';
import type { NacThanhKhoan } from '../../../config/thanh_khoan_nam_nac.js';
import { gaiCuaMan, lechBan, MA_TIEN_MAT, type LenhMan, type XungBan } from './khop.js';
import {
  apDamDong, apLenhLon, apTinhChatNgang, apXungGai, dauHieuVaoGia, quayDauVaoGia, xungGai, xungLenhLon, cheDoCua, damDongDonBay, damDongKhong, damDongNen, lechTl, chonHinh, cuLacChinh, rngMinigame, daiCangTheoMap, dungDongMin, duongPhu, heSoLop, heSoThanhKhoan, kichBanThe, neoVeDich, nhomDuongSinh, xacSuatQuet,
  type BotDonBay, type CheDo, type CuDay, type DaiCang, type KichBan, type LopThe, type NenMin, type SuKienBay, type SuKienTl, type TqMan, type VtDamDong, type XungLon, type XungTl,
} from './dong_gia.js';

export const DEM_MS = DONG_HO_MINIGAME.DEM_NGUOC_S * 1000;
export const CHAY_MS = DONG_HO_MINIGAME.CHAY_S * 1000;
/** Cửa sổ lệnh đổi ra số nhịp giá (2.000 ms ⇒ 28 nhịp). */
export const CUA_SO_NHIP = Math.floor((CUA_SO_LENH_MS * SO_NHIP) / CHAY_MS);

/** Lá của vòng nói gì với màn: thẻ sự kiện ở lớp nào, hay một ô giai đoạn. */
export type NguonMan =
  | { kind: 'su_kien'; the: SuKienId; lop: LopThe; xa: number }
  | { kind: 'giai_doan'; giai_doan: GiaiDoanId };

/** Mọi thứ cần để dựng lại đúng dòng giá của một màn — GHI NGUYÊN vào `holdem_minigame_man.boi_canh`. */
export interface BoiCanhMan {
  ma: string;
  /**
   * D561 — khoá v65 (`nhieuMa`, chỉ ghế NGƯỜI): MÀN CON cho từng khoản khác có dòng giá — mỗi cái là một bối cảnh đủ (vốn = CẢ khoản, seed riêng
   * theo mã), cùng đồng hồ + cùng lõi với màn chính. Ghi một lần lúc mở màn (bảng chỉ cho nối thêm lệnh). Vắng = một mã như cũ.
   */
  nhieu?: BoiCanhMan[];
  /**
   * Vốn màn (chip). D479: = khoản TRƯỚC khi thị trường của vòng chạy (`von_sau` ÷ (1 + `muc_tieu_bp`)) — khoản "chạy theo đường" từ đây.
   * Màn trước D479: giá trị vị thế lúc mở màn.
   */
  von: number;
  /** D479 — khoản SAU khi engine cộng % thị trường của vòng (= giữ suốt màn). Vắng ở màn trước D479. */
  von_sau?: number;
  /** D479 — % thị trường engine của mã ở vòng (bp, `loiSuatCong`): điểm cuối đường giá / giá mở màn = 1 + bp/10⁴. Vắng = không neo. */
  muc_tieu_bp?: number;
  seed: number;
  /** Chỉ số ô của map mà vòng này quyết toán (D382: `o[vòng]` khi có ô mở màn). */
  o: number;
  nguon: NguonMan;
  kb: KichBan;
  /** Điểm ma trận v42 của lá với mã — đầu vào độ xấu của cú quét. */
  diem: number;
  dai: DaiCang;
  q: number;
  hinh: string;
  /** D560 phần 2 — tính chất của ô ĐI NGANG (khoá v64): hình tích lũy / phân phối + bẫy Spring / Upthrust (`apTinhChatNgang`). Vắng ở mọi màn cũ. */
  tc?: 'tich_luy' | 'phan_phoi';
  /** D561 — Bán Khống chỉ ×2 (khoá v65 `banKhongX2`). Vắng ở mọi màn cũ ⇒ mức [2, 4, 10] như trước. */
  bk_x2?: true;
  /** D561 — Bắt Đáy / Mua Đuổi có nút BÁN BỚT khoản đang cầm (khoá v65 `banBotBdMd`). Vắng ⇒ như cũ. */
  ban_bot?: true;
  /** D586 — khoá v69 `banBotRai`: BÁN BỚT bán hết được khoản giữ — Bắt Đáy · Mua Đuổi · màn không lõi; số lần theo Rải lệnh (`BAN_BOT_LAN`). Vắng ⇒ như cũ. */
  ban_bot_rai?: true;
  /** D589 — khoá v70 `baPhan`: VÀO 3 phần · Mua Đuổi ×2 + CHỐT gộp · Bắt Đáy gom 3 phần. Vắng ⇒ như cũ. */
  ba_phan?: true;
  /** D561 — khoản chạy theo giá tới cú bấm đầu (khoá v65 `khoanTheoDuong`, `ketQuaMan.khoanTheoDuong`). Vắng ⇒ như cũ (lỗ vào muộn). */
  khoan_theo_duong?: true;
  /** D561 — màn của ô PHA mà khoá úp lá pha (`upLaPha`): client giữ lá úp tới hết màn. Vắng ⇒ lá lật trước màn như cũ. */
  up_la?: true;
  /** D561 — màn ở vòng XÉT "đã vào giá" (khoá v65 `vaoGia`): `dao` = tin đã vào giá (quay đầu ở đầu gối) · `thuong` = đi theo tin (có thể dấu hiệu nhầm). */
  vao_gia?: 'dao' | 'thuong';
  /** D561 — lõi của màn chọn LÚC CHỐT VÒNG (khoá v65 `loiChonTruoc`, `HanhDongLog.loi_man`). Vắng ⇒ chọn lá trong màn như cũ. */
  loi_man?: string;
  /** D468 — chế độ dòng giá (mã phòng thủ: dưỡng sinh ở ô giai đoạn, cực đoan ở thẻ sự kiện). Vắng ở màn v1 = `thuong`. */
  che_do?: CheDo;
  /** D470 — nấc thanh khoản của vòng, đúng nấc engine tính (thanh pin người chơi thấy). Vắng ở màn trước D470 = nấc nền. */
  nac?: NacThanhKhoan;
  /** D475 — lõi người chơi đang cầm lúc mở màn (màn CHỌN LÁ bày đúng những lá này). Không vào dòng giá. */
  loi_cam?: string[];
  /** D482 — đòn bẩy trong màn của ghế (trait ghim ĐÒN BẨY của Cá mập: `HE_DON_BAY_VAI`). Vắng = `HE_SO_LOI`. Không vào dòng giá. */
  he?: number;
  /** D483 — ghế mang trait TUNG TIN (Đội lái): được gài một tin giả trước màn (`NUT_GAI`), dòng giá đổi theo cú gài. Vắng = không. */
  tung_tin?: true;
  /**
   * D484 — BẢNG PHỤ: mã KHÁC đang cầm lúc mở màn + % thị trường engine của nó ở vòng (bp). Đường của mỗi mã: `duongPhu(seed, i, ma, bp)`.
   * Vắng = màn trước D484 / không neo (không có bảng phụ). ⚠ `bp` là điểm cuối — chỉ server đọc; client nhận dần theo nhịp như mã chính.
   */
  phu?: ({ ma: string; bp: number } & Partial<TqMan>)[];   // D487 ρ + trễ · D491 kiểu + tham số đã bốc (`TqMan`). Vắng ρ = màn trước D487 (độc lập).
  /** D486 — ghế mang KIÊN NHẪN / NÓNG VỘI lúc mở màn (cửa sổ bấm `cuaSoTrait`). Vắng = không. */
  kien_nhan?: true;
  nong_voi?: true;
  /** D492 — giá trị các khoản KHÁC lúc mở màn (chip) — nguồn NẠP THÊM của lõi Đòn Bẩy. Vắng = màn trước D492 (không nạp được). */
  nap_tu?: Record<string, number>;
  /**
   * D494 — THANH LÝ DÂY CHUYỀN: lúc mở màn có ghế KHÁC cầm lõi Đòn Bẩy và cầm đúng mã của màn ("cùng map" của demo) ⇒ đám đông đòn bẩy trên đường
   * giá (`damDongDonBay`), bán cưỡng bức đẩy giá tạm. Vắng = không (màn trước D494 dựng y như cũ).
   */
  day_chuyen?: true;
  /** D512 — ghế KHÁC cầm lõi Bán Khống giữ mã này ⇒ đám đông BÁN KHỐNG cùng map (`damDongKhong`, bị mua cưỡng bức khi giá lên). */
  day_chuyen_khong?: true;
  /**
   * D512 — ĐÁM ĐÔNG NỀN (luôn có — founder chốt chuỗi săn): hướng ô quyết số người hai phe (`damDongNen`). Ghi vào bối cảnh lúc mở màn ⇒ màn đã ghi trước
   * D512 (vắng trường này) dựng y như cũ (D466 cửa một chiều).
   */
  dam_dong?: { o: string; /** D518 — lớp TRƯỚC/NỔ của thẻ Bong bóng: đám đông dày hơn. Vắng = thường. */ bb?: true;
    /** D574 — bối cảnh Bẫy giá trị: đám đông nền gấp đôi. Vắng = thường. */ x2?: true };
  /**
   * D517 — BẦY CÁ NHÂN: n = `BAY_CA_NHAN.NPC` + ghế Cá nhân KHÁC (bot hay người) giữ mã lúc mở màn. Ghi vào bối cảnh ⇒ màn trước D517 (vắng) dựng y cũ.
   */
  bay?: { n: number };
  /**
   * D536 — LỆNH LỚN: vai của các ghế bot KHÁC (Cá Mập · Đội Lái) giữ CÙNG mã lúc mở màn ⇒ cú đẩy theo `LENH_LON_BOT` trên đường của màn + khối lượng
   * trong dòng nhịp. Có mặt (kể cả mảng rỗng) = khoá có cột khối lượng (cờ `lenhLonV61`); vắng = màn trước D536 dựng y cũ.
   */
  lon?: ('ca_map' | 'doi_lai')[];
  /** D521 — cú thanh lý cỡ ngẫu nhiên + để lại một phần tới hết màn + trượt lệnh vào ngược dòng + soi báo khoảng (hạt = seed màn). Vắng = màn trước D521. */
  thac_v2?: true;
  /** D523 — lớp soi Bắt Đáy = ĐƯỜNG GIÁ TRỊ + QUÁ BÁN (`soiGiaTri`) thay vạch đáy thác. Vắng = màn trước D523 (soi đáy thác). */
  gia_tri?: true;
  /** D499 — hệ số TỰ ĐẨY GIÁ của ghế (`TU_DAY`: cơ sở × vai × thanh khoản mã). Vắng = không đẩy (Cá nhân / màn trước D499). */
  tu_day?: number;
  /** D507 — hệ số VAI của tự đẩy (`TU_DAY.VAI`): cú bán BÁN HẾT trên mã khác tính theo thanh khoản của mã đó. Vắng = màn trước D507 / không đẩy. */
  tu_day_vai?: number;
  /** D499 — RẢI LỆNH: số nến gộp trải cú đẩy (trait `rai_lenh_*`). Vắng = tức thì. */
  rai?: number;
  /** D499 — ghế là TỔ CHỨC dưới cờ `toChucV57`: khớp thỏa thuận + trần thua trong màn. */
  to_chuc?: true;
  /**
   * D500 — BÀN NGHIÊN CỨU của Tổ Chức: tỷ lệ ĐÁY (`day`) và ĐỈNH (`dinh`) của đường giá rơi vào từng khúc thời gian (`NC_SO_CUA` khúc đều của màn),
   * đo trên `NC_SO_MO_PHONG` đường CÙNG kịch bản, khác nhiễu (`nghienCuuMan`). Mô hình biết dạng hình, không biết đường thật. Chỉ Tổ Chức có.
   */
  nghien_cuu?: { day: number[]; dinh: number[] };
  /**
   * D528 (cờ `keLenhV59`) — trait trong màn của ghế lúc mở màn: KÊ MUA / KÊ BÁN (lệnh giới hạn một mức giá) · TÂM LÝ YẾU (−14 % ⇒ bán 60 %) ·
   * TRẦN THUA của Tổ Chức áp cả khoản GIỮ SUỐT. Vắng = không (màn trước D528 dựng + khớp y như cũ).
   */
  ke?: { mua?: true; ban?: true };
  tam_ly_yeu?: true;
  tran_thua_giu?: true;
  /** D531 — khoá `loiChiTrongMan`: lõi Lướt Sóng có nút SHORT / ĐẢO / CHỐT (`khopLuotSong`). Vắng = màn Lướt Sóng chỉ xem (khoá cũ). */
  luot_song?: true;
  /**
   * D532 — DÒNG TIN của màn (`lapTinMan`, sinh lúc mở màn, GHI ở đây ⇒ replay đọc lại): tin rò rỉ / lan / cải chính / công bố / nhiễu. Bình luận theo
   * hình + tin gài thêm khi đọc (`tinDayDu`). `troi` = cú đẩy giá của tin THẬT (đưa vào `dungDongMin`). Vắng = màn không có tin (khoá cũ).
   */
  tin?: TinMan[];
  troi?: CuDay[];
  /** D532 — ghế mang MÙ TIN: server không gửi chữ / nguồn / hướng lời của tin, không bán tin sớm. */
  mu_tin?: true;
}

export type LyDoKhongMan = 'khong_co_ma' | 'ma_chua_co_dong_gia' | 'ngoai_map';

/** Seed riêng của một màn: cùng trận + cùng vòng + cùng mã ⇒ cùng dòng giá. */
/** D561 — bối cảnh của mã `ma` trong màn (vắng / mã chính ⇒ màn chính; mã không có màn con ⇒ null). */
export function bcCuaMa(bc: BoiCanhMan, ma: string | undefined): BoiCanhMan | null {
  if (ma === undefined || ma === bc.ma) return bc;
  return bc.nhieu?.find((x) => x.ma === ma) ?? null;
}

/** D561 — lệnh của màn con `ma`: lệnh không mang `ma` thuộc mã chính (mọi lệnh trước khoá v65). */
export function lenhCuaMa<T extends { ma?: string }>(bc: Pick<BoiCanhMan, 'ma'>, lenh: readonly T[], ma: string): T[] {
  return lenh.filter((x) => (x.ma ?? bc.ma) === ma);
}

/**
 * D561 — lệnh của KHUNG NHÌN mã `ma`: lệnh của mã ấy + cú CHỌN LÁ (một lõi cho cả màn, ghi không `ma`) ⇒ `laCuaMan` trên khung nào cũng ra cùng lá.
 * Khớp bỏ qua cú chọn lá (không phải nút của lõi) nên sổ / kết quả của màn con không đổi.
 */
export function lenhXemMa<T extends { ma?: string; nut: string }>(bc: Pick<BoiCanhMan, 'ma'>, lenh: readonly T[], ma: string): T[] {
  return lenh.filter((x) => (x.ma ?? bc.ma) === ma || (ma !== bc.ma && x.nut.startsWith(TIEN_TO_CHON_LA)));
}

export function seedMan(seedTran: number, vong: number, ma: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < ma.length; i++) { h ^= ma.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return ((seedTran >>> 0) ^ Math.imul(vong, 0x9e3779b1) ^ h) >>> 0;
}

/** Mã nắm nhiều nhất (theo giá trị vị thế); hoà thì theo thứ tự mã cố định của engine. */
export function maNamNhieuNhat(viThe: Readonly<Record<string, number>>): string | null {
  let tot: string | null = null;
  for (const ma of THU_TU_MA_SUC_CANG) {
    const v = viThe[ma] ?? 0;
    if (v > 0 && (tot === null || v > (viThe[tot] ?? 0))) tot = ma;
  }
  return tot;
}

/** Lá của vòng: NỔ (ô sự kiện) > DƯ ÂM (sự kiện 1–3 ô trước) > TRƯỚC (sự kiện 1–2 ô sau) > giai đoạn của ô (§4). */
export function nguonCuaO(map: HoldemMap, i: number): NguonMan | null {
  const o = map.o[i];
  if (!o) return null;
  if (o.kind === 'su_kien') return { kind: 'su_kien', the: o.su_kien, lop: 'no', xa: 1 };
  for (let k = 1; k <= NHA_CAI.SO_VONG_ECHO; k++) {
    const t = map.o[i - k];
    if (t?.kind === 'su_kien') return { kind: 'su_kien', the: t.su_kien, lop: 'du_am', xa: k };
  }
  for (let k = 1; k <= 2; k++) {
    const t = map.o[i + k];
    if (t?.kind === 'su_kien') return { kind: 'su_kien', the: t.su_kien, lop: 'truoc', xa: k };
  }
  return { kind: 'giai_doan', giai_doan: o.giai_doan };
}

/** Dải sức căng của mã tại ô — đọc `suc_cang_bp` máy chu kỳ đã ghi; map không ghi thì rút theo tỉ lệ đo (như demo). */
export function daiCangTaiO(map: HoldemMap, i: number, ma: string, seed: number): DaiCang {
  const s = map.trang_thai?.[i]?.suc_cang_bp[THU_TU_MA_SUC_CANG.indexOf(ma)];
  if (s === undefined) return daiCangTheoMap(seed, ma);
  return (['em', 'cang', 'rat'] as const)[daiSucCang(s)];   // MỘT ranh dải với engine (A11.5)
}

/** Bối cảnh màn của vòng `vong` (vòng ≥ 2). `viThe` = vị thế của người chơi lúc mở màn. */
export function boiCanhMan(p: {
  seedTran: number; vong: number; map: HoldemMap; oUp: boolean; viThe: Readonly<Record<string, number>>;
  /** D470 — cùng tham số engine dùng ở chốt vòng: `laiSuatLuc(st)` của vòng đó và cờ năm nấc. */
  laiSuatDiem?: number | null; namNac?: boolean;
  /** D479 — % thị trường công khai của từng mã ở vòng này (bp, engine `loiSuatCong`) — neo điểm cuối đường giá + tách vốn màn. */
  loiSuat?: Readonly<Record<string, number>> | null;
  /** D482 — đòn bẩy trong màn của ghế (`heManCua`). 1 / vắng ⇒ không ghi (bối cảnh cũ byte-hệt). */
  he?: number;
  /** D483 — ghế mang trait TUNG TIN. */
  tungTin?: boolean;
  /** D486 — trait trong màn. */
  kienNhan?: boolean; nongVoi?: boolean;
  /** D494 — các mã mà ghế KHÁC đang cầm lõi Đòn Bẩy giữ (> 0) — mã của màn nằm trong đây ⇒ `day_chuyen`. */
  dbKhac?: readonly string[];
  /** D512 — các mã mà ghế KHÁC đang cầm lõi Bán Khống giữ (> 0) — mã của màn nằm trong đây ⇒ `day_chuyen_khong`. */
  bkKhac?: readonly string[];
  /** D499 — hệ số vai của TỰ ĐẨY (`TU_DAY.VAI`) · cấp Rải lệnh · ghế Tổ Chức. */
  tuDayVai?: number; rai?: number; toChuc?: boolean;
  /** D528 — trait trong màn của khoá v59 (`traitManV59`). */
  keMua?: boolean; keBan?: boolean; tamLyYeu?: boolean; tranThuaGiu?: boolean;
  /** D531 — khoá v60: Lướt Sóng có nút. */
  luotSong?: boolean;
  /** D532 — khoá v60: màn có dòng tin · ghế mang MÙ TIN. */
  tinMan?: boolean; muTin?: boolean;
  /** D507 — tiền mặt của ghế lúc mở màn: nguồn NẠP (`nap_tu.tien`) + BÁN HẾT của lõi Đòn Bẩy. */
  tienMat?: number;
  /** D517 — số ghế Cá nhân KHÁC giữ từng mã (`soCaNhanCung`). Có mặt (cờ `bayCaNhanV57`) ⇒ màn có BẦY CÁ NHÂN. */
  caNhanKhac?: Readonly<Record<string, number>>;
  /** D536 — vai lớn của các ghế bot KHÁC giữ từng mã (`vaiLonCung`). Có mặt (cờ `lenhLonV61`) ⇒ màn có LỆNH LỚN + khối lượng. */
  vaiLonKhac?: Readonly<Record<string, readonly ('ca_map' | 'doi_lai')[]>>;
  /** D487 — cờ β v2 của trận (`beta_tai_san_v2`) — ρ một nhân tố đọc CÙNG bảng β engine dùng ở chốt vòng. */
  betaV2?: boolean;
  /** D561 — Bán Khống chỉ ×2. */
  bkX2?: boolean;
  /** D561 — Bắt Đáy / Mua Đuổi bán bớt khoản đang cầm. */
  banBot?: boolean;
  /** D586 — BÁN BỚT bán hết được (số lần theo Rải lệnh) · nút cho màn không lõi. */
  banBotRai?: boolean;
  /** D589 — VÀO 3 phần · ×2 · CHỐT gộp. */
  baPhan?: boolean;
  /** D561 — khoản chạy theo giá tới cú bấm đầu. */
  khoanTheoDuong?: boolean;
  /** D561 — ô pha úp lá tới hết màn. */
  upLaPha?: boolean;
  /** D561 — vòng XÉT "đã vào giá" (`vongXetVaoGia`): danh sách mã bị đảo (`maVaoGia`, có thể rỗng). Vắng = vòng không xét. */
  vaoGiaMa?: readonly string[];
}): BoiCanhMan | { loi: LyDoKhongMan } {
  const ma = maNamNhieuNhat(p.viThe);
  if (!ma) return { loi: 'khong_co_ma' };
  if (!MA_MINIGAME[ma]) return { loi: 'ma_chua_co_dong_gia' };
  const i = p.oUp ? p.vong : p.vong - 1;
  const nguon = nguonCuaO(p.map, i);
  if (!nguon) return { loi: 'ngoai_map' };
  const seed = seedMan(p.seedTran, p.vong, ma);
  let kb: KichBan, diem: number, L: number, lop: LopThe;
  if (nguon.kind === 'su_kien') {
    kb = kichBanThe(ma, nguon.the, nguon.lop, nguon.xa);
    diem = mtSuKien('v42')[ma]?.[nguon.the] ?? 0;
    L = heSoLop(nguon.lop, nguon.xa);
    lop = nguon.lop;
  } else {
    diem = mtGiaiDoan('v42')[ma]?.[nguon.giai_doan] ?? 0;
    // Nhóm theo HƯỚNG của giai đoạn (như ô tự chọn của demo), chiều theo dấu điểm của mã — USDT đi ngược thị trường.
    // KHÔNG theo ngưỡng điểm như thẻ sự kiện: VN30 · Đi ngang có điểm đúng 300 sẽ thành map tăng.
    const h = HUONG_GIAI_DOAN[nguon.giai_doan];
    const o = h === 0 ? (nguon.giai_doan === 'bien_dong' ? 'bien_dong' : 'ngang')
      : diem * h > 0 ? (h > 0 ? 'tang' : 'giam') : diem * h < 0 ? (h > 0 ? 'giam' : 'tang') : 'ngang';
    kb = { o, bien: 1, nghieng: 0, nhieuX: 1 };
    L = 1;
    lop = 'no';
  }
  const cheDo = cheDoCua(ma, nguon.kind === 'su_kien');
  if (cheDo === 'duong_sinh') kb = { ...kb, o: nhomDuongSinh(diem) };   // D468: mã phòng thủ ở ô giai đoạn đi ĐỀU theo dấu điểm
  const { q, dai } = xacSuatQuet(seed, ma, diem, L, daiCangTaiO(p.map, i, ma, seed), cheDo);
  const hinh = chonHinh(seed, ma, kb.o, lop, cheDo, diem, nguon.kind === 'su_kien' ? nguon.the : undefined).id;
  const ts = TAI_SAN.find((t) => t.id === ma)!;
  const nac = nacHieuDung({ id: ma, thanh_khoan: ts.thanh_khoan }, p.map.o[i]!, p.laiSuatDiem ?? null, p.namNac ?? false);
  const sau = p.viThe[ma]!, bp = p.loiSuat ? p.loiSuat[ma] ?? 0 : null;
  const napTu: Record<string, number> = Object.fromEntries(Object.entries(p.viThe).filter(([x, v]) => x !== ma && v > 0 && MA_MINIGAME[x]));
  if (p.tienMat !== undefined && Math.floor(p.tienMat) > 0) napTu[MA_TIEN_MAT] = Math.floor(p.tienMat);   // D507 — Tiền mặt nạp được
  // D479 — vốn màn = khoản TRƯỚC thị trường; giữ suốt màn ⇒ đúng khoản engine đã ra (`von_sau`).
  const neo = bp !== null && 1 + bp / 10000 > 0.01 ? { von: Math.round(sau / (1 + bp / 10000)), von_sau: sau, muc_tieu_bp: bp } : { von: sau };
  /** D574 — bối cảnh dài hạn đang chạy ở ô của màn (chỉ map khoá v67 có) ⇒ tin vĩ mô của vòng (~1/3 số vòng) + đám đông theo bối cảnh. */
  const bcdh = p.map.trang_thai?.[i]?.boi_canh_dh;
  const viMo = p.tinMan && bcdh ? tinViMoVong(p.seedTran, p.vong, bcdh) : null;
  const oo = p.map.o[i];
  const tc = oo?.kind === 'giai_doan' && oo.giai_doan === 'di_ngang' && (oo.tinh_chat === 'tich_luy' || oo.tinh_chat === 'phan_phoi') ? oo.tinh_chat : undefined;
  return { ma, ...neo, seed, o: i, nguon, kb, diem, dai, q, hinh, che_do: cheDo, nac, ...(tc ? { tc } : {}), ...(p.bkX2 ? { bk_x2: true as const } : {}), ...(p.banBot ? { ban_bot: true as const } : {}), ...(p.banBotRai ? { ban_bot_rai: true as const } : {}), ...(p.baPhan ? { ba_phan: true as const } : {}), ...(p.khoanTheoDuong ? { khoan_theo_duong: true as const } : {}),
    ...(p.upLaPha && p.map.o[i]?.kind === 'giai_doan' ? { up_la: true as const } : {}),   // cùng luật `upLaPha` của API: theo loại Ô (không theo nguồn màn)
    ...(p.vaoGiaMa && nguon.kind === 'su_kien' && diem !== 0 ? { vao_gia: p.vaoGiaMa.includes(ma) ? 'dao' as const : 'thuong' as const } : {}), ...(p.he !== undefined && p.he !== 1 ? { he: p.he } : {}), ...(p.tungTin ? { tung_tin: true as const } : {}),
    ...(p.kienNhan ? { kien_nhan: true as const } : {}), ...(p.nongVoi ? { nong_voi: true as const } : {}),
    ...(Object.keys(napTu).length ? { nap_tu: napTu } : {}),   // D492 — nguồn NẠP THÊM của lõi Đòn Bẩy
    ...(p.dbKhac?.includes(ma) ? { day_chuyen: true as const } : {}),   // D494 — đám đông đòn bẩy cùng mã
    ...(p.bkKhac?.includes(ma) ? { day_chuyen_khong: true as const } : {}),   // D512 — đám đông bán khống cùng mã
    // D512 — đám đông nền · D518 — dày hơn ở lớp TRƯỚC + NỔ của Bong bóng.
    thac_v2: true as const,   // D521
    gia_tri: true as const,   // D523
    dam_dong: { o: kb.o, ...(nguon.kind === 'su_kien' && nguon.the === 'bong_bong' && nguon.lop !== 'du_am' ? { bb: true as const } : {}),
      ...(bcdh && (BOI_CANH_DAI_HAN.BANH_XE[bcdh] as BanhXeBoiCanh).DAM_DONG_X2 ? { x2: true as const } : {}) },   // D574 — Bẫy giá trị: đám đông ×2
    ...(p.caNhanKhac ? { bay: { n: BAY_CA_NHAN.NPC + (p.caNhanKhac[ma] ?? 0) } } : {}),   // D517 — bầy Cá nhân
    ...(p.vaiLonKhac ? { lon: [...(p.vaiLonKhac[ma] ?? [])] } : {}),   // D536 — lệnh lớn của bot vai lớn cùng mã
    // D499 — tự đẩy giá: cơ sở × vai × thanh khoản của mã ở vòng (cùng `heSoThanhKhoan` với râu/trắng/khớp).
    ...(p.tuDayVai ? { tu_day: TU_DAY.CO_SO * p.tuDayVai * MA_MINIGAME[ma]!.liq * heSoThanhKhoan(ma, nac), tu_day_vai: p.tuDayVai } : {}),
    ...(p.rai ? { rai: p.rai } : {}), ...(p.toChuc ? { to_chuc: true as const } : {}),
    ...(p.keMua || p.keBan ? { ke: { ...(p.keMua ? { mua: true as const } : {}), ...(p.keBan ? { ban: true as const } : {}) } } : {}),   // D528
    ...(p.tamLyYeu ? { tam_ly_yeu: true as const } : {}), ...(p.tranThuaGiu && p.toChuc ? { tran_thua_giu: true as const } : {}),
    ...(p.luotSong ? { luot_song: true as const } : {}),   // D531
    ...(p.tinMan ? tinVaViMo(lapTinMan({ seed, nguon, diem }), viMo) : {}), ...(p.tinMan && p.muTin ? { mu_tin: true as const } : {}),   // D532 · D574
    ...(p.toChuc ? { nghien_cuu: nghienCuuMan({ seed, ma, kb, dai, q, cheDo, nac, nguon, diem, mucTieuBp: bp }) } : {}),   // D500 · D520 — không đưa hình
    ...(p.loiSuat ? { phu: Object.entries(p.viThe).filter(([x, v]) => x !== ma && v > 0 && MA_MINIGAME[x])
      .map(([x]) => ({ ma: x, bp: p.loiSuat![x] ?? 0, ...tuongQuanMan(ma, x, nguon.kind === 'su_kien' ? nguon.the : null, p.betaV2 === true, seed) })) } : {}) };
}

/**
 * D500 — BÀN NGHIÊN CỨU (demo bản 34 `nghienCuu`): chạy `NC_SO_MO_PHONG` mô phỏng rồi đếm đáy / đỉnh của 60 nến mịn chạy rơi vào khúc nào trong
 * `NC_SO_CUA` khúc đều. THUẦN, tất định theo seed màn.
 * D520 (founder: "xác suất phản ánh hơi bịp") — trước đây mỗi mô phỏng dùng ĐÚNG hình + ĐÚNG giá cuối của màn (kết quả vòng chưa lộ) ⇒ nhìn trộm kịch
 * bản (ô đậm nhất báo TB 72 %). Nay chỉ biết THẺ: hình RÚT theo thẻ (`chonHinh`, cùng luật màn thật) · giá cuối neo LỆCH quanh % thật (`NC_LECH_*`) ·
 * ô kẹp `NC_TRAN` (`kepTranNc`). Đo 420 màn: ô đậm nhất báo TB 37 %, trúng 38 %.
 */
export function nghienCuuMan(p: {
  seed: number; ma: string; kb: KichBan; dai: DaiCang; q: number; cheDo: CheDo; nac?: NacThanhKhoan; nguon: NguonMan; diem: number; mucTieuBp: number | null;
}): { day: number[]; dinh: number[] } {
  const N = TO_CHUC_V57.NC_SO_MO_PHONG, C = TO_CHUC_V57.NC_SO_CUA;
  const lop = p.nguon.kind === 'su_kien' ? p.nguon.lop : 'no', the = p.nguon.kind === 'su_kien' ? p.nguon.the : undefined;
  const day = Array<number>(C).fill(0), dinh = Array<number>(C).fill(0);
  for (let i = 1; i <= N; i++) {
    const s = (p.seed ^ Math.imul(0x9e3779b1, i)) | 0;
    const h = chonHinh(s, p.ma, p.kb.o, lop, p.cheDo, p.diem, the);
    const min = dungDongMin({ seed: s, ma: p.ma, hinh: h, bien: p.kb.bien, nghieng: p.kb.nghieng, nhieuX: p.kb.nhieuX,
      dai: p.dai, q: p.q, troi: [], cheDo: p.cheDo, ...(p.nac ? { nac: p.nac } : {}) });
    if (p.mucTieuBp !== null) {
      // lệch ~ chuẩn (tổng ba số đều, độ lệch chuẩn 1) × biên theo cỡ % — hạt riêng mỗi mô phỏng
      const r = rngMinigame(s ^ 0x51ed), z = (r() + r() + r() - 1.5) * 2;
      neoVeDich(min, p.mucTieuBp + z * (TO_CHUC_V57.NC_LECH_TY_LE * Math.abs(p.mucTieuBp) + TO_CHUC_V57.NC_LECH_SAN_BP));
    }
    const chay = min.slice(NEN_LS * K_MIN);
    let iD = 0, iP = 0;
    chay.forEach((c, j) => { if (c.l < chay[iD]!.l) iD = j; if (c.h > chay[iP]!.h) iP = j; });
    day[Math.min(C - 1, Math.floor((iD * C) / chay.length))]! += 1;
    dinh[Math.min(C - 1, Math.floor((iP * C) / chay.length))]! += 1;
  }
  return { day: kepTranNc(day.map((x) => x / N)), dinh: kepTranNc(dinh.map((x) => x / N)) };
}

/** D520 — kẹp mỗi ô ≤ `NC_TRAN` (founder: "> 70% thì bá quá"); phần dư chia cho các ô khác theo tỷ lệ (các ô kia rỗng ⇒ chia đều). Tổng giữ 1. */
export function kepTranNc(p: readonly number[], tran: number = TO_CHUC_V57.NC_TRAN): number[] {
  const du = p.reduce((a, x) => a + Math.max(0, x - tran), 0);
  if (du <= 0) return [...p];
  const ra = p.map((x) => Math.min(x, tran)), khac = ra.reduce((a, x, i) => a + (p[i]! < tran ? x : 0), 0), nKhac = p.filter((x) => x < tran).length;
  return ra.map((x, i) => (p[i]! >= tran ? x : khac > 0 ? x + (du * x) / khac : du / nKhac));
}

/**
 * 80 nến mịn của màn (20 lịch sử + 60 chạy). Tin trong màn (`troi`) chưa có — bước 4 #2.
 * D483 — `lenh`: cú bấm của ghế; ghế TUNG TIN đã gài tin ⇒ xung tạm (`apXungGai`) SAU neo (tan hết trước cuối ⇒ điểm cuối giữ). Mọi cửa dựng màn của
 * người chơi PHẢI truyền `lenh` — thiếu là quyết toán trên đường giá khác đường người chơi thấy.
 */
export function dungDongMan(bc: BoiCanhMan, lenh: readonly LenhMan[] = [], xungNguoi?: readonly XungBan[]): NenMin[] {
  return dungDongManDu(bc, lenh, xungNguoi).min;
}

/** D512 — đám đông của màn: nền (luôn có ở màn từ D512) + đòn bẩy cùng map (D494) + bán khống cùng map. Rỗng ⇒ không dây chuyền. */
export function damDongCua(bc: BoiCanhMan): BotDonBay[] {
  return [...(bc.day_chuyen ? damDongDonBay(bc.seed) : []), ...(bc.day_chuyen_khong ? damDongKhong(bc.seed) : []), ...(bc.dam_dong ? damDongNen(bc.seed, bc.dam_dong.o, bc.dam_dong.bb === true, bc.dam_dong.x2 === true) : [])];
}

/** D494 — như `dungDongMan`, kèm các cú bán cưỡng bức của dây chuyền (`xung` — cho bảng phụ) và sự kiện (`tl` — dấu trên đồ thị, VÌ SAO). */
export function dungDongManDu(bc: BoiCanhMan, lenh: readonly LenhMan[] = [],
  /** D512 — cú tự đẩy của người (vai lớn): đám đông xét ngưỡng trên giá đã bị đẩy ⇒ lệnh của người CHÂM NGÒI dây chuyền ngay trong màn. */
  xungNguoi?: readonly XungBan[],
): { min: NenMin[]; xung: XungTl[]; tl: SuKienTl[]; vt: VtDamDong[]; bay: SuKienBay[]; lon: XungLon[] } {
  const hinh = HINH_CHUNG.find((h) => h.id === bc.hinh);
  if (!hinh) throw new Error(`Hình ${bc.hinh} không còn trong thư viện — màn cũ phải dựng bằng thư viện của phiên bản nó`);
  // D532 — tin THẬT đẩy giá (`bc.troi`, ghi lúc mở màn); màn trước D532 không có trường ⇒ [] ⇒ dòng y như cũ.
  const min = dungDongMin({ seed: bc.seed, ma: bc.ma, hinh, bien: bc.kb.bien, nghieng: bc.kb.nghieng, nhieuX: bc.kb.nhieuX, dai: bc.dai, q: bc.q, troi: bc.troi ?? [], cheDo: bc.che_do ?? 'thuong', ...(bc.nac ? { nac: bc.nac } : {}) });
  // D536 — lệnh lớn của bot vai lớn cùng mã: đọc đáy trên đường GỐC, áp TRƯỚC neo ⇒ phần cú ở lại bị neo kéo về % engine, điểm cuối giữ (D479).
  const lon: XungLon[] = bc.lon?.length ? xungLenhLon(min, bc.seed, bc.lon) : [];
  apLenhLon(min, lon);
  // D479 — điểm cuối = % engine của mã ở vòng (thẻ chỉ nặn đường đi — founder 1A).
  // D561 — đã vào giá: neo về phần giá GỐC của tin (đi theo tin), rồi quay đầu ở đầu gối về đúng % engine (đã đảo).
  if (bc.muc_tieu_bp !== undefined && bc.vao_gia === 'dao') {
    const goc = Math.min(VAO_GIA.GOC_TRAN_BP, Math.max(VAO_GIA.GOC_SAN_BP, Math.round((-bc.muc_tieu_bp * 10000) / VAO_GIA.DAO_BP)));   // kẹp: tránh giá âm
    neoVeDich(min, goc);
    quayDauVaoGia(min, bc.muc_tieu_bp, goc);
  } else if (bc.muc_tieu_bp !== undefined) neoVeDich(min, bc.muc_tieu_bp);
  if (bc.vao_gia) dauHieuVaoGia(min, bc.seed, bc.vao_gia);
  // D560 phần 2 — hình đi ngang theo tính chất: sau neo (giữ hai đầu), trước đám đông (đám đông thấy đúng giá người chơi thấy).
  if (bc.tc) apTinhChatNgang(min, bc.seed, bc.tc);
  const gai = bc.tung_tin ? gaiCuaMan(lenh) : 0;
  const liqMa = MA_MINIGAME[bc.ma]!.liq * heSoThanhKhoan(bc.ma, bc.nac);
  if (gai !== 0) apXungGai(min, bc.seed, gai, liqMa);
  // D536 — đám đông nhảy theo tin gài cũng là LỆNH LỚN (demo `ai: 'gai'`) — chỉ khoá có lệnh lớn (`bc.lon` có mặt).
  if (gai !== 0 && bc.lon) lon.push({ ...xungGai(bc.seed, gai, liqMa), ai: 'gai' });
  // D494 — dây chuyền chạy SAU neo + gài (đám đông thấy đúng giá người chơi thấy); cú bán tan hết trước cuối ⇒ điểm cuối giữ % engine.
  // D512 — đám đông hai phe + nền; cú đẩy của người châm ngòi (`xungNguoi`). Màn D494 chỉ có `day_chuyen` ⇒ đúng đám đông cũ, thứ tự rút số cũ.
  const bots = damDongCua(bc), xn = xungNguoi?.length ? xungNguoi : null;
  // D517 — bầy Cá nhân chạy CÙNG vòng nhịp với đám đông (cú bầy đè giá có thể châm ngòi người vay, và ngược lại). Màn có `bay` luôn có đám đông
  // nền (`boiCanhMan` ghi cả hai) ⇒ không cần nhánh riêng cho bầy.
  const dc = bots.length
    ? apDamDong(min, bots, MA_MINIGAME[bc.ma]!.liq * heSoThanhKhoan(bc.ma, bc.nac), xn ? (i) => lechBan(xn, i) : undefined, bc.bay, bc.thac_v2 ? { hat: bc.seed } : undefined)
    : { xung: [], suKien: [], vt: [], bay: [] };
  return { min, xung: dc.xung, tl: dc.suKien, vt: dc.vt, bay: dc.bay, lon };   // D513 — `vt`: trạng thái từng vị thế đám đông (lớp soi)
}

/**
 * Nhịp máy lúc `nowMs` (KHÔNG kẹp): < 0 là đang đếm ngược, ≥ `SO_NHIP` là màn đã chạy hết. Nhịp k lộ ra khi đã qua trọn
 * (k + 1) phần 480 của 34 s — nên ở giây thứ 34 đúng nhịp 479 vừa lộ.
 */
export function nhipMay(batDauMs: number, nowMs: number): number {
  return Math.floor(((nowMs - batDauMs - DEM_MS) * SO_NHIP) / CHAY_MS) - 1;
}

export type KetQuaNhip = 'ok' | 'ngoai_man' | 'chua_chay' | 'tuong_lai' | 'qua_cu';

/** Cú bấm kèm nhịp `nhipKhach` có được nhận khi máy đang ở `nhipNay` (chưa kẹp) không. */
export function kiemNhipLenh(nhipKhach: number, nhipNay: number): KetQuaNhip {
  if (!Number.isInteger(nhipKhach) || nhipKhach < 0 || nhipKhach >= SO_NHIP) return 'ngoai_man';
  if (nhipNay < 0) return 'chua_chay';
  if (nhipKhach > nhipNay) return 'tuong_lai';
  if (nhipNay - nhipKhach > CUA_SO_NHIP) return 'qua_cu';
  return 'ok';
}

const tron = (x: number) => Math.round(x * 1e4) / 1e4;

/** Nến mịn lịch sử trước màn — người chơi thấy NGAY khi mở màn: [mở, cao, thấp, đóng]. */
export function lichSuMan(min: readonly NenMin[]): number[][] {
  return min.slice(0, NEN_LS * K_MIN).map((c) => [tron(c.o), tron(c.h), tron(c.l), tron(c.c)]);
}

/**
 * Một lô của dòng phát: giá các nhịp `tu`…`den` + cờ trắng [nến mịn, trắng mua, trắng bán].
 * D475 — cờ đi lúc NẾN GỘP MỞ (nhịp đầu của cặp nến mịn), cho cả hai nến mịn của cặp: khớp lệnh khoá theo nến gộp người chơi nhìn thấy
 * (`khop.ts`), nên người chơi phải thấy TRẮNG từ đầu nến như demo (`dangTrang` đọc cờ nến đang chạy). Trước D475 cờ đi lúc nến mịn ĐÓNG.
 */
export interface LoNhip {
  tu: number; gia: number[]; nen: [number, number, number][];
  /** D484 — giá các mã bảng phụ ở CÙNG các nhịp (`duongPhu` mốc k + 1 ⇒ nhịp cuối = điểm cuối). Vắng = không có bảng phụ. */
  phu?: Record<string, number[]>;
  /** D494 — cú bán cưỡng bức của dây chuyền xảy ra trong các nhịp của lô (nhịp · ai · đòn bẩy). Vắng = không có. */
  tl?: { nhip: number; ai: SuKienTl['ai']; L: number }[];
}
/** D484 — đường của mọi mã bảng phụ trong bối cảnh (thứ tự = thứ tự trong `bc.phu`). D487 — có ρ ⇒ ăn theo cú lắc của đường GỐC mã chính (không gài tin). */
export function duongPhuCua(bc: BoiCanhMan): Record<string, number[]> {
  const phu = bc.phu ?? [];
  // D494 — cú lắc lấy từ đường KHÔNG dây chuyền: cú bán cưỡng bức lan sang riêng ở dưới (chỉ xuôi chiều, tạm), không đi qua kiểu tương quan.
  const goc = bc.day_chuyen ? (({ day_chuyen: _bo, ...con }) => con)(bc) : bc;
  const soc = phu.some((x) => x.rho !== undefined) ? cuLacChinh(dungDongMan(goc)) : null;
  const xung = bc.day_chuyen ? dungDongManDu(bc).xung : [];
  return Object.fromEntries(phu.map((x, i) => {
    const g = duongPhu(bc.seed, i, x.ma, x.bp, soc && x.rho !== undefined ? { ...x, soc, chinh: bc.ma, rho: x.rho, tre: x.tre ?? 0 } : undefined);
    // D494 (demo `lanSang`) — cú bán cưỡng bức trên mã chính LAN XUÔI sang mã đi SAU (trễ ≥ 0), hệ số theo kiểu cặp, phần TẠM (tan hết).
    if (!xung.length || x.rho === undefined || (x.tre ?? 0) < 0) return [x.ma, g];
    const keo = keoCua(x, bc.ma), tre = (x.tre ?? 0) * K_MIN;
    return [x.ma, keo ? g.map((v, k) => v * (1 + keo * lechTl(xung, k / NHIP_MOI_NEN - tre))) : g];
  }));
}

/** D494 — hệ số "kéo" tuyến tính của một cặp cho cú đẩy TẠM lan sang (demo `keoCua`): khuếch đại = tỷ lệ trung bình; ngưỡng (xuôi) = 0 — trơ. */
function keoCua(x: { ma: string } & Partial<TqMan>, chinh: string): number {
  const amp = MA_MINIGAME[x.ma]!.amp / MA_MINIGAME[chinh]!.amp, rho = x.rho ?? 0;
  if (x.kieu === 'khuech_dai') { const a = (x.len ?? 1) + (x.xuong ?? 1); return x.xuoi ? a / 2 : 2 / a; }
  if (x.kieu === 'nguong') return x.xuoi ? 0 : rho * amp;
  if (x.kieu === 'that_thuong') return rho * amp * (x.ma === 'btc' ? x.nhay ?? 1 : 1 / (x.nhay ?? 1));
  return rho * amp;
}

/**
 * D487 → D491 — tham số tương quan giữa mã chính và mã `x` cho VÒNG này (bốc theo `seed` + cặp — một nguồn với demo bản 33 `tuongQuan`):
 * cặp trong `TUONG_QUAN_CAP` ⇒ kiểu + tham số của cặp (mã chính là mã THEO ⇒ `xuoi` false, trễ âm: `x` đi trước); còn lại ⇒ ρ = β(chính) × β(x)
 * theo ô của vòng (`betaCua`, cùng cờ v2), trễ 0.
 */
export function tuongQuanMan(chinh: string, x: string, suKien: string | null, betaV2: boolean, seed = 0): TqMan {
  const r = rngMinigame(seed ^ (0x7a11 + `${chinh}|${x}`.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)));
  const khoang = (v: number | readonly [number, number] | undefined, mac = 0) => (v === undefined ? mac : typeof v === 'number' ? v : v[0] + r() * (v[1] - v[0]));
  for (const c of TUONG_QUAN_CAP) {
    const xuoi = c.dan === chinh && c.theo === x;
    if (!xuoi && !(c.dan === x && c.theo === chinh)) continue;
    let q: TqMan;
    if (c.kieu === 'tuyen_tinh') q = { rho: khoang(c.rho), tre: khoang(c.tre) };
    else if (c.kieu === 'khuech_dai') q = { rho: 0.9, len: khoang(c.len), xuong: khoang(c.xuong), tre: khoang(c.tre) };
    else if (c.kieu === 'bat_on') {
      const so = suKien ? c.soHai?.[suKien] : undefined;
      q = { rho: Math.max(-0.9, Math.min(0.9, (so ?? khoang(c.rho)) + khoang(c.lech) * (so !== undefined ? 0.3 : 1))), tre: khoang(c.tre), ...(so !== undefined ? { soHai: true } : {}) };
    } else if (c.kieu === 'that_thuong') q = { rho: khoang(c.rho), nhay: c.nhay ?? 1, tre: Math.round(khoang(c.tre)) };
    else q = { rho: khoang(c.rho), nguong: c.nguong ?? 0.01, xa: Math.round(khoang(c.xa, 2)), boi: c.boi ?? 1, tre: 6 };
    return { ...q, kieu: c.kieu, xuoi, tre: xuoi ? q.tre : -q.tre };
  }
  const b = (ma: string) => { const t = TAI_SAN.find((a) => a.id === ma); return t ? betaCua(ma, t.nhom, suKien, betaV2) / 10000 : 0; };
  return { rho: b(chinh) * b(x), tre: 0 };
}
export function loNhip(min: readonly NenMin[], tu: number, den: number, phu?: Readonly<Record<string, readonly number[]>>, tl?: readonly SuKienTl[]): LoNhip {
  const chay = min.slice(NEN_LS * K_MIN), gia: number[] = [], nen: [number, number, number][] = [];
  for (let k = Math.max(0, tu); k <= Math.min(den, SO_NHIP - 1); k++) {
    const c = chay[Math.floor(k / NHIP_MOI_NEN)]!;
    gia.push(tron(c.tick[k % NHIP_MOI_NEN]!));
    if (k % (NHIP_MOI_NEN * K_MIN) === 0) {
      for (let j = Math.floor(k / NHIP_MOI_NEN); j < Math.floor(k / NHIP_MOI_NEN) + K_MIN; j++) {
        nen.push([j, chay[j]!.trang ? 1 : 0, chay[j]!.trangBan ? 1 : 0]);
      }
    }
  }
  const a = Math.max(0, tu), b = Math.min(den, SO_NHIP - 1);
  const p = phu && Object.keys(phu).length ? Object.fromEntries(Object.entries(phu).map(([x, g]) => [x, b >= a ? g.slice(a + 1, b + 2).map(tron) : []])) : undefined;
  const t = (tl ?? []).filter((e) => e.nhip >= a && e.nhip <= b).map((e) => ({ nhip: e.nhip, ai: e.ai, L: e.L }));
  return { tu: a, gia, nen, ...(p ? { phu: p } : {}), ...(t.length ? { tl: t } : {}) };
}

/** D574 — chèn dòng tin vĩ mô (nếu vòng có) vào dòng tin màn rồi đánh số lại. Không có ⇒ trả nguyên (màn khoá cũ byte-hệt). */
function tinVaViMo(t: { tin: TinMan[]; troi: CuDay[] }, viMo: TinViMo | null): { tin: TinMan[]; troi: CuDay[] } {
  if (viMo === null) return t;
  return { tin: danhSoTin([...t.tin.map(({ id: _i, tang: _t, ...x }) => x), tinViMoMan(viMo)]), troi: t.troi };
}
