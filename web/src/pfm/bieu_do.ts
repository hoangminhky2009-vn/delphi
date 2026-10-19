/**
 * PFM — SỐ CHO BIỂU ĐỒ (D426). Founder 26/09: *"Làm biểu đồ trực quan và đa dạng vào, kết hợp dữ liệu app thu được
 * nữa xong so sánh hành vi"* · *"ko chỉ gương mà còn là theo hướng dữ liệu mới ta có"* · *"những cái ở vị trí đầu
 * tiên / dễ nhìn nhất thì ưu tiên hữu ích"*.
 *
 * Hàm THUẦN: sổ + hũ + ngày do người gọi đưa vào — không đọc đồng hồ, không đọc kho, không một chữ hiển thị (D26).
 *
 * ⚠⚠ MỖI ĐẠI LƯỢNG ĐI QUA ĐÚNG CỬA ĐÃ CÓ (A11.5) — biểu đồ không định nghĩa lại thứ gì: tiêu = `laChiTieu` · tiền vào
 *   = `laThu` · hũ tiêu dùng = `daTieuTrongThang` · chưa chia = `chiChuaChia` · nạp/rút = `soChuyenHu` · đã góp =
 *   `laGopVaoHu` + `soGop` · ngày lớn = `tinhNguongChiLon` · cỡ vị thế = `coViThe`. Một cột, một thanh nói khác con số
 *   của SỔ/HŨ là app nói hai điều về cùng một đồng tiền — và người dùng bắt được đúng chỗ ấy trước tiên.
 * ⚠ P12 🔒 — mọi phép so ở đây là so với CHÍNH MÌNH: tháng trước · cùng ngày tháng trước · thứ khác trong tuần.
 * ⚠ P7 — thiếu mẫu là `null`, không phải 0; ngày KHÔNG GHI gì (`soKhoan === 0`) khác ngày ghi mà không tiêu.
 */
import { PFM } from '@config/pfm';
import { chiTheoNgay, tinhNguongChiLon, type NguongChiLon } from './guong.js';
import { laTichLuy, laTieuDung, type Hu } from './hu.js';
import { chiChuaChia, laRutHu } from './phan_bo.js';
import {
  daTieuTrongThang, laChiTieu, laGanChi, laGopVaoHu, laThu, soChuyenHu, soGop, tongGopVaoHu, type Khoan,
} from './so.js';
import { congNgay, soNgayTrongThang, thangTruocCua, thuTrongTuan } from './thoi_gian.js';
import { coViThe } from './vi_the.js';

const hai = (n: number): string => String(n).padStart(2, '0');

/* ── Cửa sổ, xuất ra để chữ trên màn in ĐÚNG số này thay vì gõ lại (D26 — số không nằm trong chữ) ── */

/** Khung "cuối tháng" = bảy ngày cuối (một tuần). */
export const NGAY_CUOI_THANG = 7;
/** Cửa sổ của mặt SỔ trong NÓI · LÀM · TRONG TRẬN — ba tháng: đủ vài lần tiền về, vẫn là "gần đây". ⏳ PLAYTEST-TUNE */
export const SO_NGAY_BA_MAT = 90;
/** Cửa sổ của biểu đồ CHI THEO THỨ: tám tuần — mỗi thứ trong tuần tám lần. ⏳ PLAYTEST-TUNE */
export const SO_TUAN_THOI_QUEN = 8;

/* ═══ 1. TỪNG NGÀY — trục là LỊCH, không phải danh sách ngày có khoản ═══════════════════════════ */

export interface NgayTien {
  ngay: string;
  /** Tổng TIÊU trong ngày (`laChiTieu`). */
  chi: number;
  /** Tổng TIỀN VÀO trong ngày (`laThu`) — ngày có số này là "ngày tiền về" trên trục. */
  thu: number;
  /** Số khoản sổ (tiêu + tiền vào) đề ngày này. `0` = ngày KHÔNG GHI, khác một ngày ghi mà không tiêu (P7). */
  soKhoan: number;
}

/**
 * Mọi ngày của tháng, đủ 28–31 phần tử. ⚠ Khoản chuyển/gán ở màn HŨ không vào đây: chúng không phải một cú tiêu hay
 * một đợt tiền về (`Khoan.phanBo`), và đếm chúng là một quy tắc 50k/ngày dựng lên một hàng cột "chi" không có thật.
 */
export function tienTungNgay(so: readonly Khoan[], thang: string): NgayTien[] {
  const ra: NgayTien[] = Array.from(
    { length: soNgayTrongThang(thang) },
    (_, i) => ({ ngay: `${thang}-${hai(i + 1)}`, chi: 0, thu: 0, soKhoan: 0 }),
  );
  for (const k of so) {
    if (!k.ngay.startsWith(thang)) continue;
    const o = ra[Number(k.ngay.slice(8, 10)) - 1];
    if (o === undefined) continue;
    if (laChiTieu(k)) { o.chi += k.soTien; o.soKhoan += 1; } else if (laThu(k)) { o.thu += k.soTien; o.soKhoan += 1; }
  }
  return ra;
}

/** Chi cộng dồn theo ngày — phần tử `i` là tổng tới hết ngày `i + 1`. Dài `toiNgay` (mặc định cả tháng). */
export function luyKeChi(so: readonly Khoan[], thang: string, toiNgay?: number): number[] {
  const ngay = tienTungNgay(so, thang);
  const ra: number[] = [];
  let n = 0;
  for (const o of ngay.slice(0, toiNgay ?? ngay.length)) { n += o.chi; ra.push(n); }
  return ra;
}

/** Chi của tháng tới hết ngày `d` — `d` quá độ dài tháng thì là cả tháng (tháng trước ngắn hơn tháng này). */
export function chiToiNgay(so: readonly Khoan[], thang: string, d: number): number {
  return luyKeChi(so, thang, Math.max(0, d)).at(-1) ?? 0;
}

/**
 * ⭐ SO CÙNG NGÀY — chi tháng `thang` tới hết ngày `d` · chi THÁNG TRƯỚC tới hết cùng ngày ấy.
 *
 * ⚠⚠ VÌ SAO KHÔNG SO VỚI CẢ THÁNG TRƯỚC: mùng 3, tháng này mới có ba ngày tiêu; so với ba mươi ngày của tháng trước là
 *   màn nói "−90%" cho một người tiêu y như cũ — đúng loại con số làm người ta thôi tin cả màn. Đầu thẻ CHI TỪNG NGÀY
 *   và dòng chỉ số "tổng chi" cùng đọc hàm này, nên một màn không bao giờ có hai con số "so tháng trước" khác nhau.
 */
export interface CungNgay { nay: number; truoc: number; ngay: number }

export function soCungNgay(so: readonly Khoan[], thang: string, d: number): CungNgay {
  return { nay: chiToiNgay(so, thang, d), truoc: chiToiNgay(so, thangTruocCua(thang), d), ngay: d };
}

/**
 * Nền + ngưỡng "ngày lớn" của MỘT tháng — đúng phép `chiBu` đang đếm (`tinhNguongChiLon` trên các ngày có chi của
 * tháng ấy). `null` khi tháng chưa đủ ngày có chi để nói (P7).
 */
export function nguongChiLonThang(so: readonly Khoan[], thang: string): NguongChiLon | null {
  return tinhNguongChiLon(chiTheoNgay(so.filter((k) => k.ngay.startsWith(thang))));
}

/* ═══ 2. TIỀN VÀO ĐI ĐÂU — một tháng, ba phần: tiêu · để dành · còn dư ══════════════════════════════ */

export interface KhucHu { huId: string; so: number }

export interface TienDiDau {
  /** Tiền vào của tháng (`laThu` — rút hũ không tính). */
  thu: number;
  /** Tiêu của tháng (`laChiTieu`) — đúng số "đã chi" của SỔ cho tháng ấy. */
  chi: number;
  /** Phần tiêu đã CHIA vào từng hũ tiêu dùng (`daTieuTrongThang`), chỉ phần dương, lớn trước. */
  chiTheoHu: KhucHu[];
  /** Phần tiêu chưa chia vào hũ nào (`chiChuaChia`). */
  chuaChia: number;
  /** Để dành RÒNG: nạp − rút ở màn HŨ trong tháng (`soChuyenHu`). Âm = rút nhiều hơn nạp. */
  deDanh: number;
  /**
   * Để dành ròng theo từng hũ khác 0, lớn trước — CÓ THỂ ÂM (hũ bị rút nhiều hơn nạp). Giữ cả phần âm: nếu chỉ giữ phần
   * dương thì các khúc cộng lại lớn hơn `deDanh`, và thanh nói một con số khác chữ ngay bên dưới nó.
   */
  deDanhTheoHu: KhucHu[];
  /** Tiền vào còn dư = thu − chi − phần để dành dương. Âm = tiêu + để dành vượt tiền vào của chính tháng ấy. */
  du: number;
  /**
   * Số KHOẢN đứng sau mỗi phần — để màn phân biệt "0 đồng" với "chưa ghi gì" (P7). Tháng không một cú nạp/rút nào thì ĐỂ
   * DÀNH là `—`, không phải `0`: app chỉ biết tiền qua hũ của nó, không biết người dùng có để dành ở chỗ khác không (cùng lý
   * lẽ `Hu.ketQua` — không suy outcome từ im lặng).
   */
  nThu: number;
  nChi: number;
  nChuyen: number;
}

/**
 * ⚠ HAI QUY ƯỚC PHẢI NÓI RA:
 *   · Khoản GÓP KIỂU CŨ (ghi ở SỔ trước D410: `chi` nối hũ, không `phanBo`) là TIÊU ở đây — đúng như "đã chi" của SỔ
 *     vẫn đếm nó (`congSo`). Thẻ này không được nói một con số "chi" khác màn SỔ cho cùng một tháng.
 *   · `chiTheoHu` cộng `chuaChia` bằng `chi` khi phần đã gán không vượt phần tiêu. Xoá một khoản đã chia ở SỔ thì phần
 *     gán có thể lớn hơn (D424 §Hệ quả): các khúc vẫn nói đúng số đã gán của từng hũ, chỉ không cộng khớp nữa — không
 *     co số của hũ nào lại để cho khớp (co lại là bịa).
 */
export function tienDiDau(so: readonly Khoan[], thang: string): TienDiDau {
  let thu = 0;
  let chi = 0;
  let nThu = 0;
  let nChi = 0;
  let nChuyen = 0;
  const huGan = new Set<string>();
  const nap = new Map<string, number>();
  for (const k of so) {
    if (!k.ngay.startsWith(thang)) continue;
    if (laThu(k)) {
      thu += k.soTien;
      nThu += 1;
    } else if (laChiTieu(k)) {
      chi += k.soTien;
      nChi += 1;
    } else if (k.huId !== null && laGanChi(k)) {
      huGan.add(k.huId);
    } else if (k.huId !== null) {
      nap.set(k.huId, (nap.get(k.huId) ?? 0) + soChuyenHu(k));
      nChuyen += 1;
    }
  }
  const lonTruoc = (a: KhucHu, b: KhucHu): number => b.so - a.so;
  const chiTheoHu = [...huGan]
    .map((huId) => ({ huId, so: daTieuTrongThang(so, huId, thang) }))
    .filter((x) => x.so > 0).sort(lonTruoc);
  const deDanh = [...nap.values()].reduce((a, x) => a + x, 0);
  const deDanhTheoHu = [...nap].map(([huId, n]) => ({ huId, so: n })).filter((x) => x.so !== 0).sort(lonTruoc);
  return {
    thu, chi, chiTheoHu, chuaChia: chiChuaChia(so, thang),
    deDanh, deDanhTheoHu, du: thu - chi - Math.max(0, deDanh),
    nThu, nChi, nChuyen,
  };
}

/**
 * Ngày sớm nhất có một khoản SỔ (tiêu hoặc tiền vào — khoản chuyển/gán ở màn HŨ không tính). `null` = sổ trống.
 * D429 — bản tin cần NGÀY (sổ có mặt từ đầu tháng trước chưa), không chỉ tháng; `thangDauTien` đọc lại chính hàm này.
 */
export function ngayDauTien(so: readonly Khoan[]): string | null {
  let dau: string | null = null;
  for (const k of so) {
    if (!laChiTieu(k) && !laThu(k)) continue;
    if (dau === null || k.ngay < dau) dau = k.ngay;
  }
  return dau;
}

/** Tháng sớm nhất có một khoản SỔ (tiêu hoặc tiền vào) — mép trái của nút ‹. `null` = sổ trống. */
export function thangDauTien(so: readonly Khoan[]): string | null {
  return ngayDauTien(so)?.slice(0, 7) ?? null;
}

/** Một tháng của biểu đồ 6 THÁNG — ba số của `tienDiDau`, không phép cộng thứ hai. */
export interface DongThang { thang: string; thu: number; chi: number; deDanh: number }

/** `soThang` tháng liền nhau, CŨ → MỚI, tháng cuối là `thangCuoi`. */
export function lichSuThang(so: readonly Khoan[], thangCuoi: string, soThang: number): DongThang[] {
  const ra: DongThang[] = [];
  let t = thangCuoi;
  for (let i = 0; i < soThang; i++) {
    const x = tienDiDau(so, t);
    ra.unshift({ thang: t, thu: x.thu, chi: x.chi, deDanh: x.deDanh });
    t = thangTruocCua(t);
  }
  return ra;
}

/** Phần tiêu của tháng đã chia vào hũ tiêu dùng, [0,1]. `null` khi tháng chưa tiêu đồng nào (P7 — không bịa 0 hay 1). */
export function phanDaChia(so: readonly Khoan[], thang: string): number | null {
  const x = tienDiDau(so, thang);
  return x.chi === 0 ? null : (x.chi - x.chuaChia) / x.chi;
}

/* ═══ 3. HŨ TIÊU DÙNG — đã tiêu so với mức tháng tự đặt, và với chính nó tháng trước ═══════════════ */

export interface DongHuTieu {
  hu: Hu;
  daTieu: number;
  /** Đã tiêu tháng trước — tới CÙNG NGÀY khi `denNgay` có số (tháng đang chạy), cả tháng khi `null`. */
  truoc: number;
}

/**
 * Hũ tiêu dùng của tháng, lớn trước. Hũ đã BỎ chỉ hiện nếu tháng ấy nó có số (xem lại một tháng cũ vẫn thấy đúng nó).
 * Phần chưa chia đi kèm (`chiChuaChia`) để thanh cuối nói được "phần còn lại ở đâu".
 */
export function hangHuTieu(
  so: readonly Khoan[], hu: readonly Hu[], thang: string, denNgay: number | null,
): { dong: DongHuTieu[]; chuaChia: number } {
  const truoc = thangTruocCua(thang);
  const dong = hu.filter(laTieuDung)
    .map((h) => ({
      hu: h,
      daTieu: daTieuTrongThang(so, h.id, thang),
      truoc: daTieuTrongThang(so, h.id, truoc, denNgay),
    }))
    .filter((d) => d.hu.trangThai !== 'bo_do' || d.daTieu !== 0)
    .sort((a, b) => b.daTieu - a.daTieu);
  return { dong, chuaChia: chiChuaChia(so, thang) };
}

/* ═══ 4. THÓI QUEN — trên LỊCH quan sát, ngày không tiêu = 0 (cùng luật `chiBu`) ══════════════════ */

/**
 * Lịch quan sát: từ ngày ghi đầu tiên (hoặc `soNgay` ngày trước, lấy ngày muộn hơn) tới HẾT HÔM QUA — hôm nay còn dở.
 * ⚠ Ngày trong dải mà không tiêu = 0, không phải vắng mặt: một ngày thứ Bảy ở nhà là quan sát đắt nhất của "cuối tuần
 *   tiêu nhiều không", bỏ nó ra là chỉ đếm những thứ Bảy có tiêu (cùng lý lẽ `chiBu` §NGÀY KHÔNG CHI = 0). Trước ngày ghi
 *   đầu tiên thì KHÔNG phải quan sát (P7) — app chưa có mặt.
 */
function lichQuanSat(so: readonly Khoan[], homNay: string, soNgay: number): string[] {
  let dau: string | null = null;
  for (const k of so) {
    if ((laChiTieu(k) || laThu(k)) && k.ngay < homNay && (dau === null || k.ngay < dau)) dau = k.ngay;
  }
  if (dau === null) return [];
  const tu = congNgay(homNay, -soNgay);
  const ra: string[] = [];
  for (let d = dau > tu ? dau : tu; d < homNay; d = congNgay(d, 1)) ra.push(d);
  return ra;
}

export interface ThuTuan {
  /** 0 = thứ Hai … 6 = Chủ nhật. */
  thu: number;
  /** Chi trung bình một ngày thứ ấy. `null` khi dải có dưới hai ngày thứ ấy (P7). */
  tb: number | null;
  soNgay: number;
}

/** Chi trung bình theo thứ trong tuần trên `soTuan` tuần gần nhất. */
export function chiTheoThu(
  so: readonly Khoan[], homNay: string, soTuan = SO_TUAN_THOI_QUEN,
): { dong: ThuTuan[]; soNgay: number } {
  const lich = lichQuanSat(so, homNay, soTuan * 7);
  const chi = chiTheoNgay(so);
  const tong = [0, 0, 0, 0, 0, 0, 0];
  const dem = [0, 0, 0, 0, 0, 0, 0];
  for (const d of lich) {
    const t = thuTrongTuan(d);
    tong[t]! += chi.get(d) ?? 0;
    dem[t]! += 1;
  }
  return {
    dong: tong.map((s, thu) => ({ thu, tb: dem[thu]! >= 2 ? s / dem[thu]! : null, soNgay: dem[thu]! })),
    soNgay: lich.length,
  };
}

/** Khung ngày đo được từ SỔ. "Đi chơi cùng bạn", "ngày tệ" KHÔNG có ở đây: sổ không biết chúng — suy từ lịch là bịa. */
export type KhungNgay = 'sau_tien_ve' | 'cuoi_thang' | 'cuoi_tuan';

/**
 * Chip câu 9 phỏng vấn ("Lúc nào bạn dễ tiêu quá tay?") → khung ngày sổ đo được. Khoá là NHÃN của `CAU_PV` (chép từ
 * nguồn duy nhất của câu hỏi; bài `pfm_bieu_do_man.test.tsx` đòi mọi khoá có thật trong câu ấy — đổi nhãn là đỏ).
 * `null` = sổ không biết ("ngày tệ" · "đi chơi cùng bạn" — suy từ lịch là bịa).
 */
export const KHUNG_CUA_NHIP: Readonly<Record<string, KhungNgay | null>> = {
  'lúc vừa có tiền': 'sau_tien_ve',
  'cuối tháng': 'cuoi_thang',
  'ngày tệ': null,
  'đi chơi cùng bạn': null,
};

export interface SoKhung {
  /** Chi trung bình một ngày TRONG khung / NGOÀI khung. */
  tbKhung: number;
  tbKhac: number;
  /** tbKhung ÷ tbKhac — "×1,6". */
  tyLe: number;
  nKhung: number;
  nKhac: number;
}

/** Tối thiểu số ngày MỖI PHÍA trước khi nói một tỷ số (P7). ⏳ PLAYTEST-TUNE — cùng cỡ `GUONG_SAN_QUAN_SAT`. */
const SAN_NGAY_KHUNG = 4;

/**
 * Chi một ngày trong khung so với ngoài khung, trên lịch quan sát `soNgay` ngày gần nhất.
 * ⚠ "Sau tiền về" dùng ĐÚNG cửa sổ của chỉ số `tien_ve_tieu` (`GUONG_CUA_SO_TIEN_VE` ngày tính cả ngày tiền về): hai con
 *   số "lúc tiền về" trên một màn phải nói về cùng những ngày.
 * `null` khi một phía dưới `SAN_NGAY_KHUNG` ngày, hoặc phía ngoài bằng 0 (tỷ số chia cho 0 là bịa).
 */
export function soKhung(
  so: readonly Khoan[], homNay: string, khung: KhungNgay, soNgay = SO_NGAY_BA_MAT,
): SoKhung | null {
  const lich = lichQuanSat(so, homNay, soNgay);
  const chi = chiTheoNgay(so);
  const cuaSo = new Set<string>();
  if (khung === 'sau_tien_ve') {
    for (const k of so) {
      if (!laThu(k)) continue;
      for (let i = 0; i < PFM.GUONG_CUA_SO_TIEN_VE; i++) cuaSo.add(congNgay(k.ngay, i));
    }
  }
  const trong = (d: string): boolean => {
    if (khung === 'sau_tien_ve') return cuaSo.has(d);
    if (khung === 'cuoi_tuan') return thuTrongTuan(d) >= 5;
    return Number(d.slice(8, 10)) > soNgayTrongThang(d.slice(0, 7)) - NGAY_CUOI_THANG;
  };
  let sk = 0; let nk = 0; let sc = 0; let nc = 0;
  for (const d of lich) {
    const x = chi.get(d) ?? 0;
    if (trong(d)) { sk += x; nk += 1; } else { sc += x; nc += 1; }
  }
  if (nk < SAN_NGAY_KHUNG || nc < SAN_NGAY_KHUNG || sc === 0) return null;
  const tbKhung = sk / nk;
  const tbKhac = sc / nc;
  return { tbKhung, tbKhac, tyLe: tbKhung / tbKhac, nKhung: nk, nKhac: nc };
}

export interface LanTienVe {
  ngay: string;
  tien: number;
  /** Chi cộng dồn từ ngày tiền về: phần tử `i` = tới hết ngày thứ `i` sau đó. Cắt ở lần tiền về kế tiếp hoặc hôm nay. */
  luyKe: number[];
}

/** `soLan` lần tiền về gần nhất (mới trước), mỗi lần một đường chi cộng dồn `soNgay` ngày. */
export function sauTienVe(so: readonly Khoan[], homNay: string, soLan = 3, soNgay = 7): LanTienVe[] {
  const ve = new Map<string, number>();
  for (const k of so) if (laThu(k) && k.ngay <= homNay) ve.set(k.ngay, (ve.get(k.ngay) ?? 0) + k.soTien);
  const ngayVe = [...ve.keys()].sort();
  const chi = chiTheoNgay(so);
  const ra: LanTienVe[] = [];
  for (let i = ngayVe.length - 1; i >= 0 && ra.length < soLan; i--) {
    const n0 = ngayVe[i]!;
    const ke = ngayVe[i + 1];
    const luyKe: number[] = [];
    let s = 0;
    for (let j = 0; j < soNgay; j++) {
      const d = congNgay(n0, j);
      if (d > homNay || (ke !== undefined && d >= ke)) break;
      s += chi.get(d) ?? 0;
      luyKe.push(s);
    }
    ra.push({ ngay: n0, tien: ve.get(n0)!, luyKe });
  }
  return ra;
}

/* ═══ 5. BẠN NÓI · SỔ GHI · TRONG TRẬN — mặt SỔ của từng cặp ══════════════════════════════════════ */

/** Sổ của `soNgay` ngày gần nhất, tới hết hôm nay — cửa sổ chung của mặt SỔ. */
export function soGanDay(so: readonly Khoan[], homNay: string, soNgay: number): Khoan[] {
  const tu = congNgay(homNay, -(soNgay - 1));
  return so.filter((k) => k.ngay >= tu && k.ngay <= homNay);
}

/**
 * LÚC TIỀN VỀ — mỗi lần tiền về trong cửa sổ: trong `GUONG_CUA_SO_TIEN_VE` ngày tính từ hôm ấy có một cú NẠP vào hũ
 * nào không. Đúng câu phỏng vấn *"Tiền vừa về, việc đầu tiên bạn làm với nó"* hỏi, trên đúng cửa sổ app tự chấm mình.
 */
export function tienVeCoNap(
  so: readonly Khoan[], homNay: string, soNgay = SO_NGAY_BA_MAT,
): { n: number; coNap: number } {
  const xet = soGanDay(so, homNay, soNgay);
  const ngayNap = new Set(xet.filter((k) => soChuyenHu(k) > 0).map((k) => k.ngay));
  const ngayVe = [...new Set(xet.filter(laThu).map((k) => k.ngay))];
  let coNap = 0;
  for (const n0 of ngayVe) {
    for (let i = 0; i < PFM.GUONG_CUA_SO_TIEN_VE; i++) {
      if (ngayNap.has(congNgay(n0, i))) { coNap += 1; break; }
    }
  }
  return { n: ngayVe.length, coNap };
}

/**
 * GIỮ CAM KẾT — cặp với năng lực GIỮ SỔ của trận (*"khoá một khoản có kỳ hạn rồi giữ tới hạn"*). Chỉ các hũ tích lũy CÓ
 * KỲ HẠN (đã vào lệnh, hoặc từng có lời đoán — cả hai đều là một mức + một ngày):
 *   · đã khép: `xong` = giữ tới cùng · `bo_do` = bỏ giữa chừng;
 *   · đang chạy: bao nhiêu hũ không chậm quá nửa kỳ (`coViThe.nhipKy`, đúng ngưỡng chữ "đúng nhịp" của lá HŨ);
 *   · `rut` = số cú RÚT RA khỏi hũ trong `soNgay` ngày gần nhất.
 */
export interface GiuCamKet { giu: number; bo: number; dangChay: number; khongCham: number; rut: number }

export function giuCamKet(
  hu: readonly Hu[], so: readonly Khoan[], homNay: string, soNgay = SO_NGAY_BA_MAT,
): GiuCamKet {
  const ra: GiuCamKet = { giu: 0, bo: 0, dangChay: 0, khongCham: 0, rut: 0 };
  for (const h of hu) {
    if (!laTichLuy(h) || (h.lenh === undefined && (h.loiDoan?.length ?? 0) === 0)) continue;
    if (h.trangThai === 'xong') { ra.giu += 1; continue; }
    if (h.trangThai === 'bo_do') { ra.bo += 1; continue; }
    ra.dangChay += 1;
    const nhip = coViThe(h, tongGopVaoHu(so, h.id, h.mocGop), homNay, null)?.nhipKy ?? null;
    if (nhip !== null && nhip > -0.5) ra.khongCham += 1;
  }
  ra.rut = soGanDay(so, homNay, soNgay).filter(laRutHu).length;
  return ra;
}

/* ═══ 6. ĐƯỜNG GÓP CỦA MỘT VỊ THẾ (màn HŨ) ════════════════════════════════════════════════════════ */

export interface DiemGop { ngay: string; luyKe: number }

/**
 * Tổng đã góp cộng dồn theo ngày của MỘT hũ — cùng luật đếm (`laGopVaoHu`, kể cả mốc RESET) và cùng dấu (`soGop`) với
 * số "đã góp" trên lá, nên điểm cuối LUÔN bằng số ấy (bài canh `pfm_bieu_do.test.ts`). Nhiều khoản một ngày = một điểm.
 */
export function duongGopHu(so: readonly Khoan[], hu: Hu): DiemGop[] {
  const ds = so.filter((k) => laGopVaoHu(k, hu.id, hu.mocGop))
    .sort((a, b) => (a.ngay === b.ngay ? (a.taoLuc < b.taoLuc ? -1 : 1) : a.ngay < b.ngay ? -1 : 1));
  const ra: DiemGop[] = [];
  let n = 0;
  for (const k of ds) {
    n += soGop(k);
    const cuoi = ra.at(-1);
    if (cuoi !== undefined && cuoi.ngay === k.ngay) cuoi.luyKe = n;
    else ra.push({ ngay: k.ngay, luyKe: n });
  }
  return ra;
}

/* ═══ 7. KHÚC VÒNG "TIỀN VÀO ĐI ĐÂU" (PFM tầng không gian) ═══════════════════════════════════════════════════════════ */

export type MaKhucVong = 'de_danh' | 'chi_hu' | 'chi_chua_chia' | 'du';
export interface KhucVong { ma: MaKhucVong; phan: number }

/**
 * Bốn khúc của VÒNG nhỏ trên ô "tiền vào đi đâu" — cùng bốn phần của `tienDiDau`, KHÔNG phép đo mới: để dành (nạp − rút, chỉ phần
 * dương) · chi đã chia vào hũ chi · chi chưa chia · còn dư (chỉ phần dương). `phan` là tỉ lệ trên TỔNG các khúc dương (tổng = 1) — vòng luôn
 * khép kín dù tiền vào của tháng nhỏ hơn phần đã tiêu (khi ấy `du` âm, không vẽ khúc âm; số thật nằm ở lớp chi tiết).
 * Trả `null` khi không khúc dương nào (tháng chưa có khoản — "chưa đủ để nói", KHÔNG vòng rỗng giả).
 */
export function khucTienVao(t: TienDiDau): KhucVong[] | null {
  const chiHu = t.chiTheoHu.reduce((a, x) => a + x.so, 0);
  const tho: KhucVong[] = [
    { ma: 'de_danh', phan: Math.max(0, t.deDanh) },
    { ma: 'chi_hu', phan: chiHu },
    { ma: 'chi_chua_chia', phan: Math.max(0, t.chuaChia) },
    { ma: 'du', phan: Math.max(0, t.du) },
  ];
  const tong = tho.reduce((a, k) => a + k.phan, 0);
  if (tong <= 0) return null;
  return tho.filter((k) => k.phan > 0).map((k) => ({ ma: k.ma, phan: k.phan / tong }));
}
