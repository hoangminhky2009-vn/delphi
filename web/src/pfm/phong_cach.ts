/**
 * PFM — PHONG CÁCH HỢP VỚI BẠN: app XẾP ba khung chia tiền theo dữ liệu, rồi dọn sẵn các bước dựng (D429, founder 26/09).
 *
 * Founder: *"Khung chia tiền sẽ được app chọn dựa trên dữ liệu phân tích từ user để recommend phong cách quản lý tài chính
 * cá nhân phù hợp, từ đó đưa ra những hỗ trợ tạo hũ / cam kết… liên quan"*.
 *
 * ⚠⚠ ĐÂY LÀ BẬC 2 CỦA THANG CAN THIỆP (BOOST — `dan-dat-hanh-vi-ca-nhan-hoa.md` §2: *"gợi KHUNG phương pháp khớp profile
 *   (đã chốt hướng lượt trước)"*), và P3 đã vẽ sẵn ranh cho nó: *"gợi ý dừng ở KHUNG phương pháp (hũ, 50/30/20,
 *   kakeibo…) kèm vì-sao-hợp"* · *"con số KHỞI ĐẦU chỉ được sinh từ CÔNG THỨC CÔNG KHAI của khung user ĐÃ CHỌN, áp lên số
 *   user tự khai, và phải được user xác nhận"*. Nên ở đây:
 *   · app XẾP khung theo DẤU HIỆU ĐẾM ĐƯỢC (sổ + câu phỏng vấn) và nói ra từng dấu hiệu — khung đứng đầu là gợi ý;
 *   · CHỌN là của người dùng (`hoSo.khung`, một chạm ở màn) — hàm này không ghi gì;
 *   · bước DỰNG là lối tắt tới màn ĐÃ CÓ (tạo hũ · đặt quy tắc tự chia · viết luật), ô SỐ ở đó để trống cho người dùng
 *     gõ (bậc 3: *"app không bao giờ TỰ đề xuất mức tiền trong luật"*); số theo công thức của khung chỉ hiện sau khi
 *     người dùng ĐÃ chọn khung ấy (`trenSo` + màn).
 * ⚠ Ba khung = đúng miền `ctx_khung` đã đăng ký (`config/pfm_dac_trung.ts`, trừ `tu_do`). Thêm khung thứ tư là đổi miền
 *   một nhãn đã rời máy — việc của sổ đăng ký, không của tệp này.
 * ⚠ KHÔNG đọc dữ liệu TRẬN: tương quan tiền thật ↔ hành vi trong game chưa được đo (buổi đo D367 để "test sau"). Chọn khung
 *   cho tiền thật bằng nó là khẳng định một mối nối chưa ai kiểm.
 * ⚠ D26 — ra MÃ + SỐ; chữ ở `pfm_chu.ts` §`CHU_DINH_HUONG`. Hàm THUẦN: `homNay` do người gọi đưa.
 */
import { laChiTieu, laThu, daTieuTrongThang, type Khoan } from './so.js';
import { chiChuaChia } from './phan_bo.js';
import { ngayDauTien, phanDaChia, soKhung, SO_TUAN_THOI_QUEN, tienDiDau } from './bieu_do.js';
import { laTichLuy, laTieuDung, type Hu, type KieuTuDong, type NhomHu } from './hu.js';
import type { HoSo, MaKhung } from './ho_so.js';
import type { Luat, MaDieuKien } from './luat.js';
import { nhipThuTuNhan } from './trang_thai.js';
import { nhipNhacToi } from './cam_ket.js';
import { phuThang, SAN_TY_LE, tatCaDuPhong } from './phan_tich.js';
import { congNgay, soNgayGiua, thangTruocCua, thuTrongTuan } from './thoi_gian.js';

/** Ba khung app xét — thứ tự này cũng là thứ tự khi hai khung ngang dấu hiệu. */
export const KHUNG_XET = ['hu', '50_30_20', 'kakeibo'] as const satisfies readonly MaKhung[];
export type KhungXet = (typeof KHUNG_XET)[number];

export function laKhungXet(k: unknown): k is KhungXet {
  return (KHUNG_XET as readonly unknown[]).includes(k);
}

/* ═══ THAM SỐ — ⏳ PLAYTEST-TUNE (không phải tham số kinh tế; chúng chỉ quyết định khi nào một dấu hiệu "có") ═══ */

/** Tiền vào ĐỀU: lệch giữa các tháng ≤ bấy nhiêu VÀ trung vị số khoản vào mỗi tháng ≤ bấy nhiêu. */
export const DEU_LECH = 0.15;
export const DEU_KHOAN = 2;
/** Tiền vào THẤT THƯỜNG: lệch ≥ bấy nhiêu, HOẶC trung vị số khoản vào mỗi tháng ≥ bấy nhiêu (nhiều nguồn nhỏ). */
export const THAT_LECH = 0.35;
export const THAT_KHOAN = 4;
/** Đã chia từ phần này chi tháng vào hũ tiêu dùng ⇒ người này đã nghĩ theo TÚI. */
export const DA_CHIA = 0.5;
/** Ghi ĐỀU: có ghi ở từ phần này số ngày quan sát (≤ 30 ngày gần nhất, cần ≥ `SAN_QUAN_SAT` ngày). */
export const GHI_DEU = 0.6;
export const SAN_QUAN_SAT = 14;
/** Chia ÍT: dưới phần này chi tháng vào hũ tiêu dùng. */
export const IT_CHIA = 0.3;
/** Chi giữa các tuần LỆCH từ bấy nhiêu, trên ít nhất `SAN_TUAN` tuần trọn. */
export const TUAN_LECH = 0.4;
export const SAN_TUAN = 4;
/** Sổ dưới bấy nhiêu ngày ⇒ mọi gợi ý là SƠ BỘ (vẫn nói, và nói rõ là sơ bộ — đừng bắt người mới chờ mới có giá trị). */
export const SO_BO_NGAY = 14;
/** Phần chi chưa vào túi nào từ bấy nhiêu (và từ `SAN_CHUA_CHIA` đồng) ⇒ bước "tạo hũ tiêu dùng" có lý do để hiện. */
export const CHUA_CHIA_PHAN = 0.2;
export const SAN_CHUA_CHIA = 100_000;
/** Bước dựng hiện tối đa bấy nhiêu — ba việc làm được ngay, không phải một danh sách việc nhà. */
export const SO_HO_TRO = 3;

/* ═══ 1. DẤU HIỆU ═══════════════════════════════════════════════════════════════════════════════════ */

export type MaDauHieu =
  // hũ
  | 'thu_that_thuong' | 'noi_that_thuong' | 'da_chia_hu' | 'nhieu_muc_tieu' | 'co_tu_chia'
  // 50/30/20
  | 'thu_deu' | 'noi_deu' | 'it_tui'
  // kakeibo
  | 'ghi_deu_it_chia' | 'tuan_lech' | 'chua_muc_tieu';

export interface DauHieu {
  ma: MaDauHieu;
  /** SỔ = đếm được trên sổ · BẠN NÓI = câu trả lời phỏng vấn (nhãn nguyên văn ở `nhan`). */
  nguon: 'so' | 'ban_noi';
  /** Số đi kèm — nghĩa theo mã, chữ ở `CHU_DINH_HUONG`. */
  n?: number;
  m?: number;
  p?: number;
  nhan?: string;
}

export interface DanhGiaKhung { khung: KhungXet; dauHieu: DauHieu[] }

export interface NhipThuSo {
  loai: 'deu' | 'that_thuong' | 'vua';
  soThang: number;
  /** Độ lệch tương đối của tiền vào giữa các tháng (độ lệch chuẩn ÷ trung bình). */
  lech: number;
  /** Trung vị số khoản tiền vào mỗi tháng. */
  khoanThang: number;
}

const trungBinh = (xs: readonly number[]): number => xs.reduce((a, x) => a + x, 0) / xs.length;
const doLech = (xs: readonly number[]): number => {
  const tb = trungBinh(xs);
  return tb === 0 ? 0 : Math.sqrt(trungBinh(xs.map((x) => (x - tb) ** 2))) / tb;
};
const trungVi = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const g = Math.floor(s.length / 2);
  return s.length % 2 ? s[g]! : (s[g - 1]! + s[g]!) / 2;
};

/**
 * NHỊP TIỀN VÀO ĐỌC TỪ SỔ — ba tháng đã khép gần nhất mà sổ phủ đủ (`phuThang`) và có tiền vào. `null` = dưới hai tháng
 * như thế (P7): một tháng thì "đều" đúng với mọi người, tức không nói gì về ai.
 */
export function nhipThuSo(so: readonly Khoan[], homNay: string): NhipThuSo | null {
  const tong: number[] = [];
  const dem: number[] = [];
  let t = homNay.slice(0, 7);
  for (let i = 0; i < 3; i++) {
    t = thangTruocCua(t);
    if (!phuThang(so, t)) break;
    const x = tienDiDau(so, t);
    if (x.nThu > 0) { tong.push(x.thu); dem.push(x.nThu); }
  }
  if (tong.length < 2) return null;
  const lech = doLech(tong);
  const khoanThang = trungVi(dem);
  const loai = lech <= DEU_LECH && khoanThang <= DEU_KHOAN ? 'deu'
    : lech >= THAT_LECH || khoanThang >= THAT_KHOAN ? 'that_thuong' : 'vua';
  return { loai, soThang: tong.length, lech, khoanThang };
}

/** Số ngày SỔ đã có mặt tới hôm nay (tính cả hai đầu). 0 = sổ trống. */
export function soNgayCoSo(so: readonly Khoan[], homNay: string): number {
  const dau = ngayDauTien(so);
  return dau === null || dau > homNay ? 0 : soNgayGiua(dau, homNay) + 1;
}

/** Ngày có ghi trong ≤ 30 ngày gần nhất (tính cả hôm nay) · số ngày quan sát của cửa sổ ấy. */
function ghiGanDay(so: readonly Khoan[], homNay: string): { coGhi: number; soNgay: number } {
  const soNgay = Math.min(30, soNgayCoSo(so, homNay));
  const tu = congNgay(homNay, -(soNgay - 1));
  const ngay = new Set(so.filter((k) => (laChiTieu(k) || laThu(k)) && k.ngay >= tu && k.ngay <= homNay).map((k) => k.ngay));
  return { coGhi: ngay.size, soNgay };
}

/**
 * Chi giữa các TUẦN TRỌN (thứ Hai → Chủ nhật) trước tuần này, tối đa `SO_TUAN_THOI_QUEN` tuần, chỉ tuần sổ phủ đủ.
 * ⚠ P7 — tuần KHÔNG MỘT KHOẢN SỔ nào là tuần không ghi, không phải tuần tiêu 0: đếm nó là dựng "chi lệch giữa các tuần"
 *   từ chính những tuần người dùng không mở app (bài test bắt được lúc viết — một cuốn sổ ghi từ tháng 6 rồi bỏ tháng 8).
 * `null` = dưới `SAN_TUAN` tuần có ghi, hoặc chưa tiêu đồng nào.
 */
export function lechTuan(so: readonly Khoan[], homNay: string): { lech: number; soTuan: number } | null {
  const dau = ngayDauTien(so);
  if (dau === null) return null;
  const dauTuanNay = congNgay(homNay, -thuTrongTuan(homNay));
  const tong: number[] = [];
  for (let i = 1; i <= SO_TUAN_THOI_QUEN; i++) {
    const tu = congNgay(dauTuanNay, -7 * i);
    if (tu < dau) break;
    const den = congNgay(tu, 6);
    const trong = so.filter((k) => (laChiTieu(k) || laThu(k)) && k.ngay >= tu && k.ngay <= den);
    if (trong.length === 0) continue;
    tong.push(trong.reduce((a, k) => (laChiTieu(k) ? a + k.soTien : a), 0));
  }
  if (tong.length < SAN_TUAN || trungBinh(tong) === 0) return null;
  return { lech: doLech(tong), soTuan: tong.length };
}

/** Phần chi đã vào hũ tiêu dùng — tháng này; tháng này chưa tiêu gì thì tháng trước. `null` = cả hai chưa tiêu (P7). */
function phanChia(so: readonly Khoan[], homNay: string): number | null {
  const thang = homNay.slice(0, 7);
  return phanDaChia(so, thang) ?? phanDaChia(so, thangTruocCua(thang));
}

export interface DauVaoPhongCach {
  so: readonly Khoan[];
  hu: readonly Hu[];
  hoSo: HoSo;
  homNay: string;
}

const dangChay = (h: Hu): boolean => h.trangThai === 'dang_chay';

/** Dấu hiệu của MỘT khung — mỗi dấu hiệu là một sự thật đếm được, không có điểm số ẩn nào. */
function dauHieuCua(khung: KhungXet, v: DauVaoPhongCach, nt: NhipThuSo | null): DauHieu[] {
  const { so, hu, hoSo, homNay } = v;
  const tieu = hu.filter((h) => laTieuDung(h) && dangChay(h));
  const tich = hu.filter((h) => laTichLuy(h) && dangChay(h));
  const noi = nhipThuTuNhan(hoSo.deu);
  const pc = phanChia(so, homNay);
  const ra: DauHieu[] = [];
  if (khung === 'hu') {
    if (nt?.loai === 'that_thuong') ra.push({ ma: 'thu_that_thuong', nguon: 'so', n: nt.soThang, p: nt.lech });
    if (noi === 'that_thuong') ra.push({ ma: 'noi_that_thuong', nguon: 'ban_noi', nhan: hoSo.deu ?? '' });
    if (tieu.length >= 1 && pc !== null && pc >= DA_CHIA) ra.push({ ma: 'da_chia_hu', nguon: 'so', n: tieu.length, p: pc });
    const mucTieu = tich.filter((h) => h.muc !== null).length;
    if (mucTieu >= 2) ra.push({ ma: 'nhieu_muc_tieu', nguon: 'so', n: mucTieu });
    const quyTac = tich.filter((h) => h.tuDong !== undefined).length;
    if (quyTac >= 1) ra.push({ ma: 'co_tu_chia', nguon: 'so', n: quyTac });
  } else if (khung === '50_30_20') {
    if (nt?.loai === 'deu') ra.push({ ma: 'thu_deu', nguon: 'so', n: nt.soThang, p: nt.lech });
    if (noi === 'deu') ra.push({ ma: 'noi_deu', nguon: 'ban_noi', nhan: hoSo.deu ?? '' });
    // ⚠ Chỉ khi sổ đã có mặt: "chưa chia nhiều túi" của một cuốn sổ trống là nói về một người app chưa gặp.
    if (soNgayCoSo(so, homNay) > 0 && tieu.length + tich.length <= 2) {
      ra.push({ ma: 'it_tui', nguon: 'so', n: tieu.length + tich.length });
    }
  } else {
    const g = ghiGanDay(so, homNay);
    if (g.soNgay >= SAN_QUAN_SAT && g.coGhi / g.soNgay >= GHI_DEU && (tieu.length === 0 || (pc ?? 0) < IT_CHIA)) {
      // `p` = phần chi CHƯA vào túi nào (câu chữ nói phần ấy) — không có hũ tiêu dùng thì là cả phần chi.
      ra.push({ ma: 'ghi_deu_it_chia', nguon: 'so', n: g.coGhi, m: g.soNgay, p: tieu.length === 0 ? 1 : 1 - (pc ?? 0) });
    }
    const lt = lechTuan(so, homNay);
    if (lt !== null && lt.lech >= TUAN_LECH) ra.push({ ma: 'tuan_lech', nguon: 'so', n: lt.soTuan, p: lt.lech });
    if (soNgayCoSo(so, homNay) > 0 && tich.length === 0) ra.push({ ma: 'chua_muc_tieu', nguon: 'so' });
  }
  return ra;
}

export interface PhongCach {
  /** Ba khung, xếp: nhiều dấu hiệu trước → nhiều dấu hiệu SỔ trước → thứ tự `KHUNG_XET`. */
  hang: DanhGiaKhung[];
  /** Khung đứng đầu — `null` khi không khung nào có dấu hiệu nào (P7: bày ba khung, không xếp bừa). */
  goiY: KhungXet | null;
  /** Sổ dưới `SO_BO_NGAY` ngày, hoặc khung đầu chỉ đứng trên lời kể (không dấu hiệu SỔ nào) ⇒ gợi ý SƠ BỘ. */
  soBo: boolean;
  soNgaySo: number;
  /** Khung người dùng đã chọn (`hoSo.khung`, trong ba khung xét) — `null` = chưa chọn / "không theo khung nào". */
  daChon: KhungXet | null;
}

export function danhGiaPhongCach(v: DauVaoPhongCach): PhongCach {
  const nt = nhipThuSo(v.so, v.homNay);
  const demSo = (d: DanhGiaKhung): number => d.dauHieu.filter((x) => x.nguon === 'so').length;
  const hang = KHUNG_XET
    .map((khung) => ({ khung, dauHieu: dauHieuCua(khung, v, nt) }))
    .sort((a, b) => b.dauHieu.length - a.dauHieu.length || demSo(b) - demSo(a)
      || KHUNG_XET.indexOf(a.khung) - KHUNG_XET.indexOf(b.khung));
  const dau = hang[0]!;
  const soNgaySo = soNgayCoSo(v.so, v.homNay);
  return {
    hang,
    goiY: dau.dauHieu.length > 0 ? dau.khung : null,
    soBo: soNgaySo < SO_BO_NGAY || demSo(dau) === 0,
    soNgaySo,
    daChon: laKhungXet(v.hoSo.khung) ? v.hoSo.khung : null,
  };
}

/* ═══ 2. BƯỚC DỰNG — lối tắt tới màn đã có, ô số để trống ═════════════════════════════════════════ */

export type MaHoTro =
  | 'tu_chia_vi_the' | 'tu_chia_tien_ve' | 'hu_cho_chua_chia' | 'hu_tich_dau'
  | 'luat_tien_ve' | 'luat_ngay_dam' | 'phan_loai' | 'chot_tuan';

/**
 * ĐÍCH của một bước — MỌI đích là màn/luồng ĐÃ CÓ (nếp `lo_trinh.ts` §DICH_NUT: *"dựng một ô nhập mức ngay trên lộ trình
 * là vừa chép lại màn HŨ vừa mở lại đúng chỗ A10 dễ vỡ nhất"*). Riêng `phan_loai` làm tại chỗ: nó là một cú chọn MENU
 * (thiết yếu / muốn — nhãn `y_thiet_yeu` đã có), không phải một con số.
 */
export type DichHoTro =
  | { kieu: 'tao_hu'; nhom: NhomHu }
  | { kieu: 'lenh_hu'; huId: string; td: KieuTuDong }
  | { kieu: 'cam_ket'; dk: MaDieuKien }
  | { kieu: 'phan_loai' }
  | { kieu: 'chot_tuan' };

export interface HoTro {
  ma: MaHoTro;
  dich: DichHoTro;
  huId?: string;
  /** Số đi kèm câu chữ — nghĩa theo mã (xem `CHU_DINH_HUONG`). */
  so?: number;
  p?: number;
  x?: number;
  n?: number;
  thang?: string;
  kyHan?: string;
}

export interface DauVaoHoTro extends DauVaoPhongCach {
  luat: readonly Luat[];
  /** "Tắt Gương" ⇒ không đọc tỷ số hành vi (sau tiền về · cuối tuần); bước nào chỉ đứng trên chúng thì không hiện. */
  tatHanhVi?: boolean;
}

/** Thứ tự ứng viên theo khung — việc khung ấy xoay quanh đứng trước. */
const THU_TU_HO_TRO: Record<KhungXet, readonly MaHoTro[]> = {
  hu: ['tu_chia_vi_the', 'tu_chia_tien_ve', 'hu_cho_chua_chia', 'hu_tich_dau', 'luat_tien_ve', 'luat_ngay_dam'],
  '50_30_20': ['phan_loai', 'tu_chia_tien_ve', 'hu_tich_dau', 'tu_chia_vi_the', 'luat_tien_ve', 'luat_ngay_dam'],
  kakeibo: ['chot_tuan', 'luat_tien_ve', 'luat_ngay_dam', 'hu_cho_chua_chia', 'hu_tich_dau'],
};

/**
 * Các bước dựng cho `khung`, tối đa `SO_HO_TRO`. Mỗi bước có LÝ DO đếm được (không bước nào hiện "cho đủ bộ"):
 *   · `tu_chia_vi_the` — một vị thế giữ nhịp thì TRỄ kỳ hạn người dùng đặt, và chưa có quy tắc tự chia;
 *   · `tu_chia_tien_ve` — tiền về thì tiêu dồn (sổ) hoặc người dùng tự nói "lúc vừa có tiền", và chưa hũ nào có quy tắc %
 *     (quy tắc % mỗi khoản vào CHÍNH LÀ "phần để dành đi trước phần tiêu");
 *   · `hu_cho_chua_chia` — phần chi tháng này chưa vào túi nào đủ lớn;
 *   · `hu_tich_dau` — chưa có hũ tích lũy nào đang chạy;
 *   · `luat_tien_ve` / `luat_ngay_dam` — có khoảnh khắc ấy (sổ hoặc lời kể) mà chưa có luật nào đang bật cho nó;
 *   · `phan_loai` — khung 50/30/20 đếm theo thiết yếu / muốn, mà còn hũ tiêu dùng chưa nói nó thuộc phần nào;
 *   · `chot_tuan` — kakeibo là nhìn lại mỗi tuần: lối tới ô chốt sổ tuần đã có.
 */
export function hoTroDung(khung: KhungXet, v: DauVaoHoTro): HoTro[] {
  const { so, hu, luat, hoSo, homNay } = v;
  const thang = homNay.slice(0, 7);
  const tich = hu.filter((h) => laTichLuy(h) && dangChay(h));
  const tieu = hu.filter((h) => laTieuDung(h) && dangChay(h));
  const nhip = hoSo.nhip ?? [];
  const luatBat = new Set(luat.filter((l) => l.trangThai === 'bat').map((l) => l.dieuKien));
  const sauVe = v.tatHanhVi ? null : soKhung(so, homNay, 'sau_tien_ve');
  const cuoiTuan = v.tatHanhVi ? null : soKhung(so, homNay, 'cuoi_tuan', SO_TUAN_THOI_QUEN * 7);
  const veDon = sauVe !== null && sauVe.tyLe >= SAN_TY_LE;
  const noiVe = nhipNhacToi(nhip, 'tien_vua_ve');

  const ung: Partial<Record<MaHoTro, HoTro>> = {};

  const tre = tatCaDuPhong({ so, hu, homNay }).find((d) => d.ma === 'vi_the' && (d.lechThang === null || d.lechThang > 0)
    && hu.find((h) => h.id === d.huId)?.tuDong === undefined);
  if (tre !== undefined && tre.ma === 'vi_the') {
    ung.tu_chia_vi_the = {
      ma: 'tu_chia_vi_the', dich: { kieu: 'lenh_hu', huId: tre.huId, td: 'ngay' }, huId: tre.huId,
      ...(tre.thangDu !== null ? { thang: tre.thangDu } : {}),
      ...(tre.lechThang !== null ? { x: tre.lechThang } : {}),
      kyHan: tre.kyHan,
    };
  }

  const coPhanTram = tich.some((h) => h.tuDong?.kieu === 'phan_tram');
  if ((veDon || noiVe) && !coPhanTram) {
    // Hũ nhận: hũ tích lũy chưa quy tắc — ưu tiên hũ có kỳ hạn gần nhất, rồi hũ dự phòng, rồi hũ mở sớm nhất.
    const ungVien = tich.filter((h) => h.tuDong === undefined)
      .sort((a, b) => (a.lenh?.kyHan ?? '9999').localeCompare(b.lenh?.kyHan ?? '9999')
        || Number(b.loai === 'du_phong') - Number(a.loai === 'du_phong') || a.taoLuc.localeCompare(b.taoLuc));
    const h = ungVien[0];
    if (h !== undefined) {
      ung.tu_chia_tien_ve = {
        ma: 'tu_chia_tien_ve', dich: { kieu: 'lenh_hu', huId: h.id, td: 'phan_tram' }, huId: h.id,
        ...(veDon && sauVe !== null ? { x: sauVe.tyLe } : {}),
      };
    }
  }

  const x = tienDiDau(so, thang);
  const chuaChia = chiChuaChia(so, thang);
  if (x.chi > 0 && chuaChia >= SAN_CHUA_CHIA && chuaChia / x.chi >= CHUA_CHIA_PHAN) {
    ung.hu_cho_chua_chia = {
      ma: 'hu_cho_chua_chia', dich: { kieu: 'tao_hu', nhom: 'tieu_dung' }, so: chuaChia, p: chuaChia / x.chi,
    };
  }

  if (tich.length === 0) ung.hu_tich_dau = { ma: 'hu_tich_dau', dich: { kieu: 'tao_hu', nhom: 'tich_luy' } };

  if ((veDon || noiVe) && !luatBat.has('tien_vua_ve')) {
    ung.luat_tien_ve = {
      ma: 'luat_tien_ve', dich: { kieu: 'cam_ket', dk: 'tien_vua_ve' }, ...(veDon && sauVe !== null ? { x: sauVe.tyLe } : {}),
    };
  }
  const tuanDam = cuoiTuan !== null && cuoiTuan.tyLe >= SAN_TY_LE;
  const noiNgayDam = nhipNhacToi(nhip, 'ngay_chi_lon');
  if ((tuanDam || noiNgayDam) && !luatBat.has('ngay_chi_lon')) {
    ung.luat_ngay_dam = {
      ma: 'luat_ngay_dam', dich: { kieu: 'cam_ket', dk: 'ngay_chi_lon' },
      ...(tuanDam && cuoiTuan !== null ? { x: cuoiTuan.tyLe } : {}),
    };
  }

  const chuaLoai = tieu.filter((h) => h.thietYeu === null).length;
  if (khung === '50_30_20' && chuaLoai > 0) ung.phan_loai = { ma: 'phan_loai', dich: { kieu: 'phan_loai' }, n: chuaLoai };
  if (khung === 'kakeibo') ung.chot_tuan = { ma: 'chot_tuan', dich: { kieu: 'chot_tuan' } };

  return THU_TU_HO_TRO[khung].flatMap((ma) => (ung[ma] ? [ung[ma]!] : [])).slice(0, SO_HO_TRO);
}

/* ═══ 3. KHUNG NÀY TRÊN SỔ CỦA BẠN — số của CHÍNH người dùng, xếp theo cách khung ấy nhìn ══════════════ */

export type TrenSo =
  | {
    khung: 'hu';
    /** Hũ tích lũy · hũ tiêu dùng đang chạy · hũ có quy tắc tự chia. */
    tuiTich: number; tuiTieu: number; quyTac: number;
    /** Phần chi THÁNG NÀY chưa vào túi nào — `null` khi tháng này chưa tiêu (P7). */
    chuaVaoTui: number | null;
  }
  | {
    khung: '50_30_20';
    /** Tháng đem ra xếp: tháng trước nếu sổ phủ đủ và có tiền vào, không thì tháng này. */
    thang: string;
    thu: number;
    /** Chi theo nhãn hũ tiêu dùng `thietYeu` (true · false · chưa nói + phần chưa chia) · để dành ròng dương. */
    thietYeu: number; muon: number; chuaRo: number; deDanh: number;
    /** Số hũ tiêu dùng mang nhãn ấy — 0 ⇒ màn in "—" (P7: chưa ai nói hũ nào là "muốn" ≠ tiêu 0 cho thứ muốn). */
    nThietYeu: number; nMuon: number;
  }
  | {
    khung: 'kakeibo';
    thang: string;
    thu: number;
    /** Chi từ thứ Hai tuần này tới hôm nay. */
    chiTuan: number;
    coGhi: number; soNgay: number;
  };

export function trenSo(khung: KhungXet, v: DauVaoPhongCach): TrenSo {
  const { so, hu, homNay } = v;
  const thangNay = homNay.slice(0, 7);
  if (khung === 'hu') {
    const tich = hu.filter((h) => laTichLuy(h) && dangChay(h));
    const x = tienDiDau(so, thangNay);
    return {
      khung, tuiTich: tich.length, tuiTieu: hu.filter((h) => laTieuDung(h) && dangChay(h)).length,
      quyTac: tich.filter((h) => h.tuDong !== undefined).length,
      chuaVaoTui: x.chi > 0 ? x.chuaChia / x.chi : null,
    };
  }
  if (khung === '50_30_20') {
    const truoc = thangTruocCua(thangNay);
    const thang = phuThang(so, truoc) && tienDiDau(so, truoc).thu > 0 ? truoc : thangNay;
    const x = tienDiDau(so, thang);
    let thietYeu = 0;
    let muon = 0;
    let chuaRo = x.chuaChia;
    let nThietYeu = 0;
    let nMuon = 0;
    for (const h of hu.filter(laTieuDung)) {
      const n = daTieuTrongThang(so, h.id, thang);
      if (h.thietYeu === true) { thietYeu += n; nThietYeu += 1; } else if (h.thietYeu === false) { muon += n; nMuon += 1; } else chuaRo += n;
    }
    return { khung, thang, thu: x.thu, thietYeu, muon, chuaRo, deDanh: Math.max(0, x.deDanh), nThietYeu, nMuon };
  }
  const g = ghiGanDay(so, homNay);
  const dauTuan = congNgay(homNay, -thuTrongTuan(homNay));
  return {
    khung, thang: thangNay, thu: tienDiDau(so, thangNay).thu,
    chiTuan: so.reduce((a, k) => (laChiTieu(k) && k.ngay >= dauTuan && k.ngay <= homNay ? a + k.soTien : a), 0),
    coGhi: g.coGhi, soNgay: g.soNgay,
  };
}

/**
 * CÔNG THỨC CÔNG KHAI của khung 50/30/20 (P3) — CHỈ dùng khi người dùng ĐÃ CHỌN khung này: áp lên tiền vào của chính họ
 * ra ba con số NHÁP. Không ghi vào đâu; màn hiện nó cạnh số thật, người dùng tự quyết có theo không.
 */
export const TY_LE_50_30_20 = { thietYeu: 50, muon: 30, deDanh: 20 } as const;

export function nhap503020(thu: number): { thietYeu: number; muon: number; deDanh: number } {
  const phan = (p: number): number => Math.floor((thu * p) / 100 / 1000) * 1000;
  return { thietYeu: phan(TY_LE_50_30_20.thietYeu), muon: phan(TY_LE_50_30_20.muon), deDanh: phan(TY_LE_50_30_20.deDanh) };
}
