/**
 * PFM — BẢN TIN PHÂN TÍCH: "ĐÁNG CHÚ Ý · ĐANG ĐI VỀ ĐÂU" (D429, founder 26/09).
 *
 * Founder xem bản 9 (ba thẻ biểu đồ đầu GƯƠNG) rồi nói: *"Vẫn chỉ là 1 app ghi chép nhỉ. Chưa thấy phần nào là phân
 * tích hay hỗ trợ định hướng"* — và chọn cả hai hướng đã trình: BẢN TIN (tệp này) + KHUNG CHIA TIỀN app chọn từ dữ liệu
 * (`phong_cach.ts`). Biểu đồ VẼ LẠI cái đã ghi; bản tin ĐỌC nó: chuyện gì đáng chú ý, và cứ đà này thì đi về đâu.
 *
 * ⚠ A10 🔒 / P3 — mỗi dòng là một SỰ THẬT ĐẾM ĐƯỢC, hoặc một PHÉP NGOẠI SUY TỰ NÓI RA GIẢ ĐỊNH ("giữ nhịp … thì …" — cùng
 *   luật `tien_toi_ngay.ts`). Mốc so sánh chỉ là chính người dùng (tháng trước, ngày khác) hoặc mức/kỳ hạn HỌ TỰ ĐẶT.
 *   Không dòng nào bảo tiêu ít đi hay để dành thêm.
 * ⚠ P7 — thiếu mẫu thì dòng ấy KHÔNG CÓ (mảng ngắn đi), không bao giờ là một dòng "0 %".
 * ⚠ A11.5 — mọi phép cộng tiền đi qua cửa đã có (`bieu_do.ts` · `so.ts` · `phan_bo.ts` · `vi_the.ts`); tệp này chỉ SO và
 *   XẾP. Thêm một vòng cộng tiền ở đây là dựng bản thứ hai của một con số đang hiện ở màn khác.
 * ⚠ D26 — ra MÃ + SỐ; chữ ở `pfm_chu.ts` §`CHU_DINH_HUONG`. Hàm THUẦN: `homNay` do người gọi đưa, không đọc đồng hồ.
 */
import { PFM } from '@config/pfm';
import { daTieuTrongThang, laChiTieu, laGopVaoHu, soGop, tongGopVaoHu, type Khoan } from './so.js';
import { chiChuaChia } from './phan_bo.js';
import {
  chiToiNgay, ngayDauTien, SO_NGAY_BA_MAT, SO_TUAN_THOI_QUEN, soCungNgay, soKhung, tienDiDau,
} from './bieu_do.js';
import { laTichLuy, laTieuDung, type Hu, type KieuTuDong } from './hu.js';
import { lenhCua } from './vi_the.js';
import { congNgay, ngayCuaLuc, soNgayGiua, soNgayTrongThang, thangTruocCua } from './thoi_gian.js';

/* ═══ THAM SỐ — ⏳ PLAYTEST-TUNE ════════════════════════════════════════════════════════════════════════
 * Không phải tham số kinh tế (A4/A8.2): không đồng nào đổi chủ vì chúng. Chúng chỉ quyết định KHI NÀO bản tin đủ căn cứ
 * để nói một câu — nên chỗ đo đúng của chúng là buổi đo có người thật, không phải ở đây.
 */

/** Số ngày trọn tối thiểu làm nền cho mọi dự phóng "hết tháng" — một tuần: đủ cả ngày thường lẫn cuối tuần. */
export const SAN_NGAY_NHIP = 7;
/** Chi so CÙNG NGÀY tháng trước chênh từ bấy nhiêu (tương đối) thì thành một dòng. */
export const SAN_DOI = 0.1;
/** Một nguồn (hũ tiêu dùng · phần chưa chia) chở ít nhất bấy nhiêu phần của chênh thì mới được gọi tên. */
export const SAN_NGUON = 0.3;
/** Tỷ số khung ngày (cuối tuần · sau tiền về) từ bấy nhiêu — hoặc nghịch đảo — thì thành một dòng. */
export const SAN_TY_LE = 1.3;
/** Ba khoản lớn nhất chiếm từ phần này của chi tháng trở lên ⇒ một dòng; tháng phải có ít nhất `SAN_SO_KHOAN` khoản. */
export const SAN_KHOAN_LON = 0.35;
export const SO_KHOAN_LON = 3;
export const SAN_SO_KHOAN = 10;
/** Tỷ lệ để dành đổi MỘT CHIỀU qua ba tháng đã khép, chênh đầu–cuối tối thiểu. */
export const SAN_DE_DANH = 0.03;
/** Nhịp góp của một vị thế không quy tắc: cửa sổ tối đa · số ngày tối thiểu kể từ lúc mở (hoặc RESET). */
export const CUA_SO_GOP = 90;
export const SAN_NGAY_GOP = 14;
/** Sổ phải có mặt từ ngày này của một tháng thì tháng ấy mới là một tháng ĐỦ để so. */
export const NGAY_PHU_THANG = 3;
/** Mỗi phần của bản tin nói tối đa bấy nhiêu dòng — những dòng mạnh nhất, không phải mọi thứ đếm được. */
export const SO_DONG = 3;

/* ═══ CHUNG ══════════════════════════════════════════════════════════════════════════════════════════ */

export interface DauVaoPhanTich {
  so: readonly Khoan[];
  hu: readonly Hu[];
  homNay: string;
  /**
   * "Tắt Gương" (Cài đặt › SỔ CHI TIÊU › KHÁC) ⇒ bỏ các dòng HÀNH VI (cuối tuần · sau tiền về) — cùng ranh D426 đã kẻ:
   * công tắc hứa *"Màn Gương ngừng tính các chỉ số mô tả"*; TỔNG của sổ (chi · để dành) thì không phải chỉ số hành vi.
   */
  tatHanhVi?: boolean;
}

/**
 * Sổ có mặt từ đầu tháng `thang` (tới ngày `NGAY_PHU_THANG`) chưa — tháng ghi dở thì không đem ra so.
 * ⚠ `phong_cach.ts` đọc lại chính hàm này cho "tiền vào đều không" — một định nghĩa "tháng đủ" cho cả khối định hướng.
 */
export function phuThang(so: readonly Khoan[], thang: string): boolean {
  const dau = ngayDauTien(so);
  return dau !== null && dau <= `${thang}-${String(NGAY_PHU_THANG).padStart(2, '0')}`;
}

const chiSoThang = (thang: string): number => Number(thang.slice(0, 4)) * 12 + Number(thang.slice(5, 7)) - 1;
const ngayCuaThang = (thang: string, d: number): string => `${thang}-${String(d).padStart(2, '0')}`;

/**
 * Tiền vào trung bình một tháng trên ba tháng ĐÃ KHÉP gần nhất mà sổ phủ đủ và có tiền vào. `null` = chưa tháng nào như
 * thế (P7) — cỡ của quy tắc % không tính được, không bịa một mẫu số.
 */
export function thuTrungBinhThang(so: readonly Khoan[], thangNay: string): number | null {
  const ds: number[] = [];
  let t = thangNay;
  for (let i = 0; i < 3; i++) {
    t = thangTruocCua(t);
    if (!phuThang(so, t)) break;
    const thu = tienDiDau(so, t).thu;
    if (thu > 0) ds.push(thu);
  }
  return ds.length === 0 ? null : Math.floor(ds.reduce((a, x) => a + x, 0) / ds.length);
}

/* ═══ 1. ĐÁNG CHÚ Ý ══════════════════════════════════════════════════════════════════════════════════ */

/** Nguồn lớn nhất của chênh: một hũ tiêu dùng, hoặc `null` = phần CHƯA CHIA. */
export interface NguonDoi { huId: string | null; lech: number }
export interface KhoanLon { ngay: string; soTien: number; ghiChu: string | null }
export interface TyLeThang { thang: string; tyLe: number }

/**
 * `manh` = độ mạnh so với ngưỡng của chính dòng ấy (1 = vừa chạm ngưỡng) — thước chung để XẾP, không hiện ra màn.
 */
export type ChuY =
  | { ma: 'chi_doi'; manh: number; nay: number; truoc: number; ngay: number; nguon: NguonDoi | null }
  | { ma: 'cuoi_tuan'; manh: number; tyLe: number; soNgay: number }
  | { ma: 'sau_tien_ve'; manh: number; tyLe: number; cuaSo: number; soNgay: number }
  | { ma: 'khoan_lon'; manh: number; phan: number; chi: number; lon: KhoanLon[] }
  | { ma: 'de_danh'; manh: number; dong: TyLeThang[] };
export type MaChuY = ChuY['ma'];

/** Thứ tự khi hai dòng mạnh ngang nhau — tổng tiền trước, hành vi sau. */
const THU_TU_CHU_Y: readonly MaChuY[] = ['chi_doi', 'de_danh', 'khoan_lon', 'sau_tien_ve', 'cuoi_tuan'];

/**
 * CHI SO CÙNG NGÀY THÁNG TRƯỚC — và phần chênh đến từ ĐÂU.
 * ⚠ Cùng ngày, không cả tháng (`soCungNgay` — lý do ở đó). Nguồn: từng hũ tiêu dùng + phần chưa chia, cùng tới hết
 *   ngày ấy ở cả hai tháng; chỉ gọi tên nguồn CÙNG CHIỀU với chênh và chở ≥ `SAN_NGUON` của nó — không thì câu "chủ
 *   yếu từ…" là bịa một nguyên nhân.
 */
function chiDoi(so: readonly Khoan[], hu: readonly Hu[], homNay: string): ChuY | null {
  const thang = homNay.slice(0, 7);
  const truoc = thangTruocCua(thang);
  const d = Number(homNay.slice(8, 10));
  if (!phuThang(so, truoc)) return null;
  const c = soCungNgay(so, thang, d);
  if (c.truoc <= 0) return null;
  const lech = c.nay - c.truoc;
  const rel = lech / c.truoc;
  if (Math.abs(rel) < SAN_DOI) return null;
  const nhom: NguonDoi[] = hu.filter(laTieuDung).map((h) => ({
    huId: h.id,
    lech: daTieuTrongThang(so, h.id, thang, d) - daTieuTrongThang(so, h.id, truoc, d),
  }));
  nhom.push({ huId: null, lech: chiChuaChia(so, thang, d) - chiChuaChia(so, truoc, d) });
  const lon = nhom
    .filter((n) => Math.sign(n.lech) === Math.sign(lech))
    .sort((a, b) => Math.abs(b.lech) - Math.abs(a.lech))[0];
  const nguon = lon !== undefined && Math.abs(lon.lech) >= Math.abs(lech) * SAN_NGUON ? lon : null;
  return { ma: 'chi_doi', manh: Math.abs(rel) / SAN_DOI, nay: c.nay, truoc: c.truoc, ngay: d, nguon };
}

const manhTyLe = (tyLe: number): number => Math.abs(Math.log(tyLe)) / Math.log(SAN_TY_LE);
const quaNguong = (tyLe: number): boolean => tyLe >= SAN_TY_LE || tyLe <= 1 / SAN_TY_LE;

/** Ba khoản lớn nhất của tháng đang chạy chiếm bao nhiêu phần chi — "vài khoản quyết định cả tháng". */
function khoanLon(so: readonly Khoan[], homNay: string): ChuY | null {
  const thang = homNay.slice(0, 7);
  const ds = so.filter((k) => laChiTieu(k) && k.ngay.startsWith(thang) && k.ngay <= homNay);
  if (ds.length < SAN_SO_KHOAN) return null;
  const chi = ds.reduce((a, k) => a + k.soTien, 0);
  if (chi <= 0) return null;
  const lon = [...ds].sort((a, b) => b.soTien - a.soTien || (a.ngay < b.ngay ? -1 : 1)).slice(0, SO_KHOAN_LON);
  const phan = lon.reduce((a, k) => a + k.soTien, 0) / chi;
  if (phan < SAN_KHOAN_LON) return null;
  return {
    ma: 'khoan_lon', manh: phan / SAN_KHOAN_LON, phan, chi,
    lon: lon.map((k) => ({ ngay: k.ngay, soTien: k.soTien, ghiChu: k.ghiChu ?? null })),
  };
}

/**
 * Tỷ lệ để dành (để dành ròng ÷ tiền vào) đổi MỘT CHIỀU qua ba tháng đã khép.
 * ⚠ P7 — tháng không một cú nạp/rút nào thì để dành là "—", không phải 0 (`tienDiDau.nChuyen`): app chỉ thấy tiền qua hũ
 *   của nó. Một tháng như thế trong ba ⇒ không dòng nào.
 */
function deDanhBaThang(so: readonly Khoan[], homNay: string): ChuY | null {
  const dong: TyLeThang[] = [];
  let t = homNay.slice(0, 7);
  for (let i = 0; i < 3; i++) {
    t = thangTruocCua(t);
    if (!phuThang(so, t)) return null;
    const x = tienDiDau(so, t);
    if (x.thu <= 0 || x.nChuyen === 0) return null;
    dong.unshift({ thang: t, tyLe: x.deDanh / x.thu });
  }
  const [a, b, c] = dong as [TyLeThang, TyLeThang, TyLeThang];
  const motChieu = (a.tyLe < b.tyLe && b.tyLe < c.tyLe) || (a.tyLe > b.tyLe && b.tyLe > c.tyLe);
  const chenh = Math.abs(c.tyLe - a.tyLe);
  if (!motChieu || chenh < SAN_DE_DANH) return null;
  return { ma: 'de_danh', manh: chenh / SAN_DE_DANH, dong };
}

/** Mọi dòng ĐÁNG CHÚ Ý đủ căn cứ, mạnh trước — người gọi cắt `SO_DONG`. */
export function tatCaChuY(v: DauVaoPhanTich): ChuY[] {
  const { so, hu, homNay } = v;
  const ra: ChuY[] = [];
  const doi = chiDoi(so, hu, homNay);
  if (doi) ra.push(doi);
  const de = deDanhBaThang(so, homNay);
  if (de) ra.push(de);
  const kl = khoanLon(so, homNay);
  if (kl) ra.push(kl);
  if (!v.tatHanhVi) {
    const ve = soKhung(so, homNay, 'sau_tien_ve', SO_NGAY_BA_MAT);
    if (ve && quaNguong(ve.tyLe)) {
      ra.push({
        ma: 'sau_tien_ve', manh: manhTyLe(ve.tyLe), tyLe: ve.tyLe,
        cuaSo: PFM.GUONG_CUA_SO_TIEN_VE, soNgay: ve.nKhung + ve.nKhac,
      });
    }
    const tuan = soKhung(so, homNay, 'cuoi_tuan', SO_TUAN_THOI_QUEN * 7);
    if (tuan && quaNguong(tuan.tyLe)) {
      ra.push({ ma: 'cuoi_tuan', manh: manhTyLe(tuan.tyLe), tyLe: tuan.tyLe, soNgay: tuan.nKhung + tuan.nKhac });
    }
  }
  return ra.sort((a, b) => b.manh - a.manh || THU_TU_CHU_Y.indexOf(a.ma) - THU_TU_CHU_Y.indexOf(b.ma));
}

export function dangChuY(v: DauVaoPhanTich): ChuY[] {
  return tatCaChuY(v).slice(0, SO_DONG);
}

/* ═══ 2. ĐANG ĐI VỀ ĐÂU ══════════════════════════════════════════════════════════════════════════════ */

/** Cơ sở nhịp góp của một vị thế — dòng chữ PHẢI nói ra nó (quy tắc bạn đặt, hay nhịp góp N ngày qua). */
export type CoSoGop =
  | { kieu: 'quy_tac'; tuDong: KieuTuDong; gt: number }
  | { kieu: 'gop'; soNgay: number };

/**
 * `hang` = độ HỮU ÍCH để xếp (nhỏ trước — founder 26/09: *"những cái ở vị trí đầu tiên thì ưu tiên hữu ích"*): chuyện
 * đang xảy ra (vượt mức) → chuyện sắp xảy ra trong tháng (chạm mức) → vị thế trễ so hạn người dùng đặt → tổng tháng →
 * vị thế kịp hạn → hũ còn dư mức.
 */
export const HANG_DU_PHONG = {
  hu_vuot: 0, hu_cham: 1, vi_the_tre: 2, chi_het_thang: 3, vi_the_kip: 4, hu_duoi: 5,
} as const;

export type DuPhong =
  | {
    ma: 'chi_het_thang'; hang: number;
    /** Chi tới hết hôm nay · nhịp/ngày · số ngày làm nền nhịp (tới hết hôm qua) · dự kiến cả tháng · ngày còn lại. */
    toiNay: number; nhip: number; soNgayNhip: number; duKien: number; conNgay: number;
    /** Chi cả tháng trước — `null` khi sổ chưa phủ đủ tháng ấy. */
    thangTruoc: number | null;
  }
  | {
    ma: 'hu_muc'; hang: number; huId: string; daTieu: number; muc: number;
    /** Nhịp/ngày của hũ; `0` khi chưa đủ ngày làm nền (dòng khi ấy chỉ còn là sự thật "đã vượt"). */
    nhip: number; soNgayNhip: number;
    /** Ngày chạm mức trong tháng nếu giữ nhịp; `null` = không chạm trước hết tháng, hoặc đã vượt. */
    ngayCham: string | null;
    duKienCuoi: number; daVuot: boolean;
  }
  | {
    ma: 'vi_the'; hang: number; huId: string; muc: number; con: number;
    nhipThang: number; coSo: CoSoGop;
    /** Tháng đủ mức nếu giữ nhịp; `null` = nhịp bằng 0 — không có tháng nào để nói. */
    thangDu: string | null;
    kyHan: string;
    /** `thangDu` − tháng kỳ hạn, tính bằng tháng: dương = trễ, âm = sớm. `null` khi `thangDu` là `null`. */
    lechThang: number | null;
  };
export type MaDuPhong = DuPhong['ma'];

/**
 * Cửa sổ nhịp của tháng đang chạy: từ đầu tháng (hoặc ngày sổ bắt đầu, nếu sổ mở giữa tháng) tới HẾT HÔM QUA — hôm nay
 * còn dở. `null` khi dưới `SAN_NGAY_NHIP` ngày.
 */
function cuaSoNhip(so: readonly Khoan[], homNay: string): { tu: number; den: number; soNgay: number } | null {
  const thang = homNay.slice(0, 7);
  const d = Number(homNay.slice(8, 10));
  const dau = ngayDauTien(so);
  if (dau === null || dau >= homNay) return null;
  const tu = dau.startsWith(thang) ? Number(dau.slice(8, 10)) : 1;
  const soNgay = d - tu;
  return soNgay < SAN_NGAY_NHIP ? null : { tu, den: d - 1, soNgay };
}

function chiHetThang(so: readonly Khoan[], homNay: string): DuPhong | null {
  const thang = homNay.slice(0, 7);
  const d = Number(homNay.slice(8, 10));
  const conNgay = soNgayTrongThang(thang) - d;
  const cs = cuaSoNhip(so, homNay);
  if (cs === null || conNgay < 1) return null;
  const nhip = (chiToiNgay(so, thang, cs.den) - chiToiNgay(so, thang, cs.tu - 1)) / cs.soNgay;
  if (nhip <= 0) return null;
  const toiNay = chiToiNgay(so, thang, d);
  const truoc = thangTruocCua(thang);
  return {
    ma: 'chi_het_thang', hang: HANG_DU_PHONG.chi_het_thang,
    toiNay, nhip, soNgayNhip: cs.soNgay, duKien: toiNay + Math.round(nhip * conNgay), conNgay,
    thangTruoc: phuThang(so, truoc) ? chiToiNgay(so, truoc, 31) : null,
  };
}

/**
 * HŨ TIÊU DÙNG so MỨC THÁNG người dùng tự đặt (P3 — "trạng thái so mức user TỰ ĐẶT"). Hũ không mức ⇒ không dòng (không
 * có gì để so — app không tự điền mức).
 * ⚠ "Đã vượt" là một SỰ THẬT, không cần nhịp: nó có mặt kể cả những ngày đầu tháng.
 */
function huMuc(so: readonly Khoan[], hu: readonly Hu[], homNay: string): DuPhong[] {
  const thang = homNay.slice(0, 7);
  const d = Number(homNay.slice(8, 10));
  const soNgayThang = soNgayTrongThang(thang);
  const cs = cuaSoNhip(so, homNay);
  const ra: DuPhong[] = [];
  for (const h of hu) {
    if (!laTieuDung(h) || h.trangThai !== 'dang_chay' || h.muc === null || h.muc <= 0) continue;
    const daTieu = daTieuTrongThang(so, h.id, thang);
    const daVuot = daTieu >= h.muc;
    if (cs === null) {
      if (daVuot) {
        ra.push({
          ma: 'hu_muc', hang: HANG_DU_PHONG.hu_vuot, huId: h.id, daTieu, muc: h.muc,
          nhip: 0, soNgayNhip: 0, ngayCham: null, duKienCuoi: daTieu, daVuot,
        });
      }
      continue;
    }
    const nhip = (daTieuTrongThang(so, h.id, thang, cs.den) - daTieuTrongThang(so, h.id, thang, cs.tu - 1)) / cs.soNgay;
    const duKienCuoi = daTieu + Math.round(nhip * (soNgayThang - d));
    let ngayCham: string | null = null;
    if (!daVuot && nhip > 0) {
      const dCham = d + Math.ceil((h.muc - daTieu) / nhip);
      if (dCham <= soNgayThang) ngayCham = ngayCuaThang(thang, dCham);
    }
    const hang = daVuot ? HANG_DU_PHONG.hu_vuot : ngayCham !== null ? HANG_DU_PHONG.hu_cham : HANG_DU_PHONG.hu_duoi;
    ra.push({
      ma: 'hu_muc', hang, huId: h.id, daTieu, muc: h.muc,
      nhip, soNgayNhip: cs.soNgay, ngayCham, duKienCuoi, daVuot,
    });
  }
  return ra;
}

/**
 * VỊ THẾ (hũ tích lũy có mức + kỳ hạn) — giữ nhịp thì tháng nào đủ, so với kỳ hạn NGƯỜI DÙNG ĐẶT.
 * ⚠ CƠ SỞ NHỊP, theo thứ tự: quy tắc tự chia đang đặt (lời hứa đứng về phía trước — một quy tắc đặt năm ngày trước chưa
 *   kịp hiện trong lịch sử góp) · nếu không có, nhịp góp THẬT từ lúc mở (hoặc RESET), tối đa `CUA_SO_GOP` ngày. Dòng chữ
 *   nói ra cơ sở nào — dự phóng giấu giả định là lời tiên tri.
 * ⚠ Quá kỳ hạn ⇒ không dòng: vị thế ấy chờ KẾT TOÁN (thẻ NHÌN LẠI), không còn "đi về đâu". Đủ mức ⇒ không dòng. Tạm
 *   dừng ⇒ không dòng: quy tắc của hũ tạm dừng chia 0 (`tu_dong.ts`), nói "với nhịp này…" về nó là nói về một nhịp không chạy.
 * ⚠ P7 — mở chưa tới `SAN_NGAY_GOP` ngày mà không quy tắc ⇒ không dòng (nhịp một tuần đầu là tiếng ồn).
 */
function viThe(so: readonly Khoan[], hu: readonly Hu[], homNay: string): DuPhong[] {
  const ra: DuPhong[] = [];
  let thuTb: number | null | undefined;
  for (const h of hu) {
    if (!laTichLuy(h) || h.trangThai !== 'dang_chay' || h.muc === null) continue;
    const lenh = lenhCua(h);
    if (lenh === null || soNgayGiua(homNay, lenh.kyHan) < 0) continue;
    const con = h.muc - tongGopVaoHu(so, h.id, h.mocGop);
    if (con <= 0) continue;

    let nhipThang: number | null = null;
    let coSo: CoSoGop | null = null;
    const td = h.tuDong;
    if (td !== undefined && td.kieu === 'ngay') {
      nhipThang = td.gt * 30;
      coSo = { kieu: 'quy_tac', tuDong: 'ngay', gt: td.gt };
    } else if (td !== undefined && td.kieu === 'phan_tram') {
      if (thuTb === undefined) thuTb = thuTrungBinhThang(so, homNay.slice(0, 7));
      if (thuTb !== null) {
        nhipThang = Math.floor((thuTb * td.gt) / 100);
        coSo = { kieu: 'quy_tac', tuDong: 'phan_tram', gt: td.gt };
      }
    }
    if (coSo === null) {
      const moc = h.mocGop ? ngayCuaLuc(h.mocGop) : '';
      const mo = ngayCuaLuc(h.taoLuc);
      const tu = [mo, moc, congNgay(homNay, -CUA_SO_GOP)].reduce((a, x) => (x > a ? x : a));
      const soNgay = soNgayGiua(tu, homNay);
      if (soNgay < SAN_NGAY_GOP) continue;
      const gop = so.reduce((a, k) => (laGopVaoHu(k, h.id, h.mocGop) && k.ngay >= tu && k.ngay <= homNay ? a + soGop(k) : a), 0);
      nhipThang = Math.floor((Math.max(0, gop) / soNgay) * 30);
      coSo = { kieu: 'gop', soNgay };
    }
    const nt = nhipThang ?? 0;
    let thangDu: string | null = null;
    let lechThang: number | null = null;
    if (nt > 0) {
      thangDu = congNgay(homNay, Math.ceil(con / (nt / 30))).slice(0, 7);
      lechThang = chiSoThang(thangDu) - chiSoThang(lenh.kyHan.slice(0, 7));
    }
    const tre = lechThang === null || lechThang > 0;
    ra.push({
      ma: 'vi_the', hang: tre ? HANG_DU_PHONG.vi_the_tre : HANG_DU_PHONG.vi_the_kip,
      huId: h.id, muc: h.muc, con, nhipThang: nt, coSo, thangDu, kyHan: lenh.kyHan, lechThang,
    });
  }
  return ra;
}

/** Độ gắt trong CÙNG một hạng — để hai dòng cùng hạng vẫn có thứ tự tất định. */
function doGat(x: DuPhong): number {
  if (x.ma === 'hu_muc') return x.duKienCuoi / x.muc;
  if (x.ma === 'vi_the') return x.lechThang === null ? 1e6 : x.lechThang;
  return 0;
}

/** Mọi dòng ĐANG ĐI VỀ ĐÂU đủ căn cứ, hữu ích trước — người gọi cắt `SO_DONG`. */
export function tatCaDuPhong(v: DauVaoPhanTich): DuPhong[] {
  const { so, hu, homNay } = v;
  const ra: DuPhong[] = [...huMuc(so, hu, homNay), ...viThe(so, hu, homNay)];
  const tong = chiHetThang(so, homNay);
  if (tong) ra.push(tong);
  return ra.sort((a, b) => a.hang - b.hang || doGat(b) - doGat(a)
    || ('huId' in a && 'huId' in b ? (a.huId < b.huId ? -1 : 1) : 0));
}

export function dangDiVeDau(v: DauVaoPhanTich): DuPhong[] {
  return tatCaDuPhong(v).slice(0, SO_DONG);
}
