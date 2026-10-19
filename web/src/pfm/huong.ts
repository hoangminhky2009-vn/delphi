/**
 * PFM — TẤM HƯỚNG: **HỌC trên quyết định của bạn → bạn CHỌN hướng tuần tới → app đếm "làm đúng k/n lần".**
 *
 * D453 (founder 28/09) dựng tấm ba bước HỌC · HƯỚNG · CHẤM. Founder 11/10 (câu B) đổi MÔ HÌNH sang demo bản 6:
 *   1. **APP HỌC ĐƯỢC** — hai dòng nhận định NGẮN, mỗi dòng đứng trên một phép đếm đã có (chia tiền vào hũ · giữ/vỡ luật · hũ có hạn
 *      đúng nhịp · nhịp sổ) hoặc lời kể phỏng vấn khi sổ còn mỏng. Phần này GIỮ NGUYÊN logic D453 (`hocTuQuyetDinh`), chỉ còn hai dòng.
 *   2. **HƯỚNG TUẦN TỚI — BẠN CHỌN** — ba nút một chạm sinh từ HŨ THẬT: ưu tiên hũ thứ nhất · ưu tiên hũ thứ hai · giữ như cũ
 *      (`huong_hu.ts`). Chọn một thì đánh dấu; ô HƯỚNG ở SỔ đọc lại "… — làm đúng k/n lần".
 *   Các "bước dựng" của D453 (tạo hũ · quy tắc tự chia · luật · chọn khung) KHÔNG còn là hướng: mỗi thứ đã có lối riêng (màn HŨ ·
 *   lớp LUẬT · lớp CÀI ĐẶT). Bản ghi cũ trong `HoSo.huong` vẫn ĐỌC được: `dichCuaLuaChon` + `chamLuaChon` còn nguyên cho chúng.
 *
 * ⚠⚠ A10 🔒 — "học được" là ĐẾM việc bạn đã làm, không phải lời khuyên; hướng là danh sách hũ CỦA BẠN theo thứ tự màn HŨ. Không số tiền
 *   nào do app sáng tác.
 * ⚠ KHÔNG đọc dữ liệu TRẬN (nếp `phong_cach.ts`): tương quan tiền thật ↔ hành vi trong game chưa được đo.
 * ⚠ P7 — dòng nào chưa đủ mẫu thì VẮNG, không hiện 0. Tỷ số hành vi dùng lại đúng ngưỡng của bản tin (`SAN_TY_LE`).
 * ⚠ P2 — mọi thứ ở lại máy: lựa chọn nằm trong `HoSo.huong`, không `ctx_*` nào, không `events`, không mã sự kiện mới.
 * ⚠ Hàm THUẦN: `homNay` do người gọi đưa; không kho, không chuỗi hiển thị (D26 — chữ ở `pfm_chu.ts` §`CHU_HUONG`).
 */
import { PFM } from '@config/pfm';
import { laGanChi, laPhanBo, soChuyenHu, soGan, type Khoan } from './so.js';
import {
  giuCamKet, KHUNG_CUA_NHIP, soKhung, SO_NGAY_BA_MAT, SO_TUAN_THOI_QUEN, tienDiDau, tienVeCoNap,
  type KhungNgay,
} from './bieu_do.js';
import { chiChuaChia, laRutHu } from './phan_bo.js';
import { laTichLuy, laTieuDung, type Hu } from './hu.js';
import type { HoSo } from './ho_so.js';
import type { Luat } from './luat.js';
import { CHUA_CHIA_PHAN, SAN_CHUA_CHIA, type DichHoTro, type KhungXet } from './phong_cach.js';
import {
  SAN_TY_LE, SO_DONG, tatCaChuY, tatCaDuPhong, type ChuY, type DauVaoPhanTich, type DuPhong,
} from './phan_tich.js';
import { cuoiTuan, dauTuan, huongTuan, type LuaChonHuong, type MaHuong } from './huong_tuan.js';
import { MA_GIU_NHU_CU, MA_UU_TIEN, lanLamUuTien } from './huong_hu.js';
import { ngayCuaLuc } from './thoi_gian.js';

export { cuoiTuan, dauTuan, huongTuan };
export type { LuaChonHuong, MaHuong };

/* ═══ 0. TUẦN · LỰA CHỌN — ở `huong_tuan.ts` (phần nhẹ, SỔ đọc được mà không kéo cả tệp này) ═══════════════ */


/* ═══ 1. HỌC ═════════════════════════════════════════════════════════════════════════════════ */

/** Dòng học trỏ về đâu: SỔ = đếm trên sổ/bản ghi · BẠN NÓI = câu phỏng vấn (lời kể, chưa phải sổ). */
export type NguonHoc = 'so' | 'ban_noi';

export type MaHoc =
  // QUYẾT ĐỊNH đã có kết quả
  | 'huong_giu' | 'luat_giu' | 'giu_han' | 'vi_the' | 'tien_ve_cat'
  // NHỊP SỔ đếm được
  | 'tien_ve_don' | 'cuoi_tuan' | 'cuoi_thang' | 'chua_chia'
  // LỜI KỂ (tuần đầu)
  | 'noi_tien_ve' | 'noi_nhip' | 'noi_dau_thang';

export interface DongHoc {
  ma: MaHoc;
  nguon: NguonHoc;
  /** Khoá riêng của dòng (vd `luat_giu:<id>`) — hướng trỏ đúng một dòng, React dùng làm `key`. */
  khoa: string;
  /** Đếm: `k` trên `n` (lần · tuần · hũ). */
  k?: number;
  n?: number;
  /** Tỷ số (×1,9) và số ngày quan sát đứng sau nó. */
  tyLe?: number;
  soNgay?: number;
  /** Phần (0–1) — vd phần chi chưa chia. */
  p?: number;
  /** Nhãn NGUYÊN VĂN người dùng đã chạm (BẠN NÓI) — hoặc id mẫu luật (`luat_giu`). */
  nhan?: string;
  huId?: string;
  luatId?: string;
  /** Vị thế: tháng đủ mức nếu giữ nhịp · kỳ hạn · lệch (tháng, dương = trễ). */
  thangDu?: string;
  kyHan?: string;
  lech?: number;
  /**
   * ⭐ LỜI KỂ ĐI KÈM (NÓI · LÀM trên cùng một dòng): nhãn phỏng vấn nói về ĐÚNG việc dòng sổ này đếm — "tiền vừa về thì cất
   * một phần đi" cạnh "2/4 lần tiền về, bạn chia vào hũ". Đặt hai nhân chứng cạnh nhau là cái app học được; không chấm
   * khớp hay lệch (nếp BA MẶT D426 — trọng số giữa nguồn chưa chốt).
   */
  noiKem?: string;
  /** Để XẾP, không hiện: nhóm trước (quyết định → nhịp → lời kể), trong nhóm mạnh trước. */
  manh: number;
}

/** Thứ tự nhóm — QUYẾT ĐỊNH đứng trước, vì đó là thứ founder muốn người dùng thấy app học được. */
const NHOM_HOC: Record<MaHoc, number> = {
  huong_giu: 0, luat_giu: 0, giu_han: 0, vi_the: 0, tien_ve_cat: 0,
  tien_ve_don: 1, cuoi_tuan: 1, cuoi_thang: 1, chua_chia: 1,
  noi_tien_ve: 2, noi_nhip: 2, noi_dau_thang: 2,
};

/** Ít nhất mấy lần tiền về thì "k/n lần chia vào hũ" mới là một con số (một lần là giai thoại — A11.1). */
export const SAN_LAN_TIEN_VE = 2;
/** Ít nhất mấy lần giữ/vỡ thì một luật mới có dòng học. */
export const SAN_LAN_LUAT = 2;
/** Số dòng học tối đa trên tấm — demo bản 6 bày HAI dòng nhận định ngắn. */
export const SO_HOC_TREN_THE = 2;
/** Nhớ tối đa bấy nhiêu lựa chọn (≈ nửa năm một lựa chọn mỗi tuần) — hồ sơ không phình vô hạn trong két. */
export const SO_LUA_CHON_NHO = 40;

const quaNguong = (tyLe: number): boolean => tyLe >= SAN_TY_LE || tyLe <= 1 / SAN_TY_LE;
const manhTyLe = (tyLe: number): number => Math.abs(Math.log(tyLe)) / Math.log(SAN_TY_LE);

export interface DauVaoHoc {
  so: readonly Khoan[];
  hu: readonly Hu[];
  luat: readonly Luat[];
  hoSo: HoSo;
  homNay: string;
  /** "Tắt Gương" — không đọc tỷ số hành vi (sau tiền về · cuối tuần · cuối tháng). */
  tatHanhVi?: boolean;
}

/**
 * ĐẾM QUYẾT ĐỊNH — con số đầu tấm ("học từ N quyết định"). Quyết định = một cú người dùng BẤM để định tiền của mình:
 *   · mỗi cú chia tiền vào/ra hũ bằng tay (nạp · rút · gán chi tiêu) — cú của quy tắc tự chia KHÔNG đếm (quy tắc mới là
 *     quyết định, và nó đã đếm một lần lúc đặt);
 *   · mỗi hũ mở · mỗi mức đặt · mỗi kỳ hạn · mỗi quy tắc tự chia · mỗi lần quyết toán / trả lời nhìn lại;
 *   · mỗi luật đặt · mỗi lần bấm giữ/vỡ · mỗi lần trả lời "luật có tác dụng không";
 *   · khung đã chọn · mỗi lần chọn / gạt một hướng.
 * ⚠ Khoản chi thường KHÔNG đếm: đó là SỐ LIỆU của sổ, không phải một quyết định về cách quản tiền — đếm vào là thổi con số
 *   thành hàng trăm và nó thôi nói điều gì.
 */
export function demQuyetDinh(v: Pick<DauVaoHoc, 'so' | 'hu' | 'luat' | 'hoSo'>): number {
  let n = 0;
  for (const k of v.so) {
    if ((laPhanBo(k) && k.phanBo !== 'tu_dong') || laGanChi(k) || laRutHu(k)) n += 1;
  }
  for (const h of v.hu) {
    n += 1;
    if (h.muc !== null) n += 1;
    if (h.lenh !== undefined) n += 1;
    if (h.tuDong !== undefined) n += 1;
    if (h.ketQua !== null) n += 1;
    n += Object.keys(h.ketQuaKy ?? {}).length;
    n += h.loiDoan?.length ?? 0;
  }
  for (const l of v.luat) {
    n += 1;
    n += l.lichSu.filter((d) => d.ma === 'giu' || d.ma === 'vo').length;
    n += Object.keys(l.hieuQuaKy ?? {}).length;
    n += l.loiDoan?.length ?? 0;
  }
  if (v.hoSo.khung !== undefined) n += 1;
  n += v.hoSo.huong?.length ?? 0;
  return n;
}

/**
 * Bản tin THÁNG dưới tấm HƯỚNG (D453): các dòng của `phan_tich` TRỪ những dòng đã lên tấm thành dòng HỌC — nhịp sổ (cuối
 * tuần · sau tiền về) và hũ lệch hạn (`vi_the`). In hai chỗ là hai con số cho một sự thật.
 * ⚠ Một chỗ lọc cho màn VÀ cho bài canh (A11.5): bài test gọi đúng hàm này, không chép lại điều kiện lọc.
 * ⚠ Lọc TRƯỚC rồi mới cắt `SO_DONG` — cắt trước thì dòng bị lọc ăn mất chỗ của một dòng tháng thật.
 */
export function banTinThang(v: DauVaoPhanTich): { chuY: ChuY[]; duPhong: DuPhong[] } {
  return {
    chuY: tatCaChuY(v).filter((c) => c.ma !== 'cuoi_tuan' && c.ma !== 'sau_tien_ve').slice(0, SO_DONG),
    duPhong: tatCaDuPhong(v).filter((d) => d.ma !== 'vi_the').slice(0, SO_DONG),
  };
}

/**
 * MỌI dòng học đủ căn cứ, đã xếp (quyết định → nhịp sổ → lời kể; trong nhóm mạnh trước). Người gọi cắt bằng
 * `chonDongHoc` — hàm này không biết tấm có mấy chỗ.
 */
export function hocTuQuyetDinh(v: DauVaoHoc): DongHoc[] {
  const { so, hu, luat, hoSo, homNay } = v;
  const ra: DongHoc[] = [];

  /* ── HƯỚNG ĐÃ CHỌN ở các tuần trước: làm tới mấy tuần. Đây là dòng vòng lặp khép — app học trên chính gợi ý của nó. */
  const qua = tuanDaChon(hoSo.huong ?? [], dauTuan(homNay)).filter((lc) => lc.ma !== MA_GIU_NHU_CU);
  if (qua.length > 0) {
    const toi = qua.filter((lc) => lamToi(chamLuaChon(lc, { so, hu, luat, hoSo }, cuoiTuan(lc.tuan)))).length;
    ra.push({ ma: 'huong_giu', nguon: 'so', khoa: 'huong_giu', k: toi, n: qua.length, manh: 3 + qua.length });
  }

  /* ── LUẬT: mỗi luật đủ lần giữ/vỡ là một dòng. */
  for (const l of luat) {
    const giu = l.lichSu.filter((d) => d.ma === 'giu').length;
    const vo = l.lichSu.filter((d) => d.ma === 'vo').length;
    if (giu + vo < SAN_LAN_LUAT) continue;
    ra.push({
      ma: 'luat_giu', nguon: 'so', khoa: `luat_giu:${l.id}`, luatId: l.id, k: giu, n: giu + vo,
      nhan: l.mauId ?? undefined, manh: 2 + (giu + vo) / 10,
    });
  }

  /* ── HŨ CÓ HẠN: đang đúng nhịp mấy cái · đã giữ tới hạn mấy cái (`giuCamKet` — cùng thước với nắp BA MẶT). */
  const gc = giuCamKet(hu, so, homNay);
  const coHan = gc.dangChay + gc.giu + gc.bo;
  if (coHan > 0) {
    ra.push({
      ma: 'giu_han', nguon: 'so', khoa: 'giu_han',
      k: gc.khongCham + gc.giu, n: coHan, manh: 1.5 + coHan / 10,
    });
  }

  /* ── VỊ THẾ LỆCH HẠN: cứ nhịp góp này thì đủ vào tháng nào, so với hạn CHÍNH người dùng đặt. Chỉ khi lệch — kịp hạn
     đã nằm trong `giu_han`. */
  for (const d of tatCaDuPhong({ so, hu, homNay })) {
    if (d.ma !== 'vi_the' || d.thangDu === null || d.lechThang === null || d.lechThang === 0) continue;
    ra.push({
      ma: 'vi_the', nguon: 'so', khoa: `vi_the:${d.huId}`, huId: d.huId,
      thangDu: d.thangDu, kyHan: d.kyHan, lech: d.lechThang, manh: 1 + Math.abs(d.lechThang) / 6,
    });
  }

  /* ── TIỀN VỀ → CHIA VÀO HŨ: trong cửa sổ tiền về có cú nạp nào không (`tienVeCoNap` — đúng phép của nắp BA MẶT). */
  const tv = tienVeCoNap(so, homNay);
  if (tv.n >= SAN_LAN_TIEN_VE) {
    ra.push({ ma: 'tien_ve_cat', nguon: 'so', khoa: 'tien_ve_cat', k: tv.coNap, n: tv.n, manh: 1 + tv.n / 10 });
  }

  /* ── NHỊP SỔ — ba khung ngày, cùng ngưỡng với bản tin (`SAN_TY_LE`). "Tắt Gương" ⇒ vắng cả ba. */
  if (!v.tatHanhVi) {
    const khung: [MaHoc, 'sau_tien_ve' | 'cuoi_tuan' | 'cuoi_thang', number][] = [
      ['tien_ve_don', 'sau_tien_ve', SO_NGAY_BA_MAT],
      ['cuoi_tuan', 'cuoi_tuan', SO_TUAN_THOI_QUEN * 7],
      ['cuoi_thang', 'cuoi_thang', SO_NGAY_BA_MAT],
    ];
    for (const [ma, k, soNgay] of khung) {
      const x = soKhung(so, homNay, k, soNgay);
      if (x === null || !quaNguong(x.tyLe)) continue;
      ra.push({ ma, nguon: 'so', khoa: ma, tyLe: x.tyLe, soNgay: x.nKhung + x.nKhac, manh: manhTyLe(x.tyLe) });
    }
  }

  /* ── CHI CHƯA CHIA: cùng hai ngưỡng với bước dựng "một hũ tiêu dùng cho phần chưa chia" (`hoTroDung`). */
  const thang = homNay.slice(0, 7);
  const x = tienDiDau(so, thang);
  const chuaChia = chiChuaChia(so, thang);
  if (x.chi > 0 && chuaChia >= SAN_CHUA_CHIA && chuaChia / x.chi >= CHUA_CHIA_PHAN) {
    ra.push({ ma: 'chua_chia', nguon: 'so', khoa: 'chua_chia', p: chuaChia / x.chi, manh: chuaChia / x.chi });
  }

  /*
   * ── LỜI KỂ — nói được từ ngày một. Nhãn NGUYÊN VĂN câu trả lời; không đoán gì thêm từ nó.
   * ⭐ Lời kể về ĐÚNG việc một dòng sổ đang đếm thì ĐI KÈM dòng ấy (`noiKem`), không đứng riêng: "cất một phần đi" nằm dưới
   *   "2/4 lần tiền về, bạn chia vào hũ" · chip "lúc vừa có tiền"/"cuối tháng" nằm dưới dòng tỷ số khung ngày tương ứng
   *   (`KHUNG_CUA_NHIP` — cùng bảng ghép của nắp BA MẶT). Chip không có dòng sổ nào đo được thì vẫn đứng riêng.
   */
  const dongSo = (ma: MaHoc): DongHoc | undefined => ra.find((d) => d.ma === ma);
  if (hoSo.lucTienVe !== undefined) {
    const cat = dongSo('tien_ve_cat');
    if (cat !== undefined) cat.noiKem = hoSo.lucTienVe;
    else ra.push({ ma: 'noi_tien_ve', nguon: 'ban_noi', khoa: 'noi_tien_ve', nhan: hoSo.lucTienVe, manh: 1 });
  }
  const MA_CUA_KHUNG: Record<KhungNgay, MaHoc> = {
    sau_tien_ve: 'tien_ve_don', cuoi_tuan: 'cuoi_tuan', cuoi_thang: 'cuoi_thang',
  };
  const conLai: string[] = [];
  for (const chip of hoSo.nhip ?? []) {
    const k = KHUNG_CUA_NHIP[chip];
    const d = k === undefined || k === null ? undefined : dongSo(MA_CUA_KHUNG[k]);
    if (d !== undefined && d.noiKem === undefined) d.noiKem = chip;
    else conLai.push(chip);
  }
  if (conLai.length > 0) {
    ra.push({ ma: 'noi_nhip', nguon: 'ban_noi', khoa: 'noi_nhip', nhan: conLai.join(' · '), manh: 0.9 });
  }
  if (hoSo.dauThang !== undefined) {
    ra.push({ ma: 'noi_dau_thang', nguon: 'ban_noi', khoa: 'noi_dau_thang', nhan: hoSo.dauThang, manh: 0.8 });
  }

  return ra.sort((a, b) => NHOM_HOC[a.ma] - NHOM_HOC[b.ma] || b.manh - a.manh || (a.khoa < b.khoa ? -1 : 1));
}

/**
 * CHỌN DÒNG CHO TẤM: dòng dựa trên SỔ trước, rồi lời kể phỏng vấn (chỉ lấp chỗ khi sổ chưa đủ dòng — tuần đầu). Cắt ở `toiDa`.
 * Hàm này không biết tấm có mấy chỗ ngoài `toiDa`; `hoc` đã xếp sẵn bởi `hocTuQuyetDinh`.
 */
export function chonDongHoc(hoc: readonly DongHoc[], toiDa = SO_HOC_TREN_THE): DongHoc[] {
  const ra: DongHoc[] = [];
  const them = (d: DongHoc): void => {
    if (ra.length < toiDa && !ra.some((x) => x.khoa === d.khoa)) ra.push(d);
  };
  for (const d of hoc) if (d.nguon === 'so') them(d);
  for (const d of hoc) if (d.nguon === 'ban_noi') them(d);
  return ra;
}

/* ═══ 2. HƯỚNG ═══════════════════════════════════════════════════════════════════════════════ */


/** Đích của một hướng CŨ (mô hình D453) — chỉ để ĐỌC lịch sử và CHẤM. Không còn nơi nào sinh hướng mới thuộc loại này. */
export type DichHuong = Exclude<DichHoTro, { kieu: 'chot_tuan' }> | { kieu: 'chon_khung'; khung: KhungXet };

/** Đích của một lựa chọn, dựng lại từ bản ghi lựa chọn — cho phép CHẤM. */
export function dichCuaLuaChon(lc: LuaChonHuong): DichHuong | null {
  switch (lc.ma) {
    case 'hu_cho_chua_chia': return { kieu: 'tao_hu', nhom: 'tieu_dung' };
    case 'hu_tich_dau': return { kieu: 'tao_hu', nhom: 'tich_luy' };
    case 'tu_chia_vi_the':
    case 'tu_chia_tien_ve':
      return lc.huId === undefined ? null : { kieu: 'lenh_hu', huId: lc.huId, td: lc.td ?? 'ngay' };
    case 'luat_tien_ve': return { kieu: 'cam_ket', dk: 'tien_vua_ve' };
    case 'luat_ngay_dam': return { kieu: 'cam_ket', dk: 'ngay_chi_lon' };
    case 'phan_loai': return { kieu: 'phan_loai' };
    case 'chon_khung': return lc.khung === undefined ? null : { kieu: 'chon_khung', khung: lc.khung };
    default: return null;
  }
}

/**
 * Nối một lựa chọn vào hồ sơ — THUẦN, cho `suaHoSo`. Giữ `SO_LUA_CHON_NHO` lựa chọn gần nhất.
 * ⚠ Chạm lại đúng trạng thái đang có (chọn một hướng đang theo) ⇒ `null` = không ghi gì, `suaLuc` không nhích.
 */
export function noiLuaChon(cu: HoSo, lc: LuaChonHuong): HoSo | null {
  const ds = cu.huong ?? [];
  const hienTai = huongTuan(ds, lc.tuan);
  if (lc.kieu === 'theo' && hienTai?.khoa === lc.khoa) return null;
  if (lc.kieu === 'thoi' && hienTai === null) return null;
  return { ...cu, huong: [...ds, lc].slice(-SO_LUA_CHON_NHO) };
}


/** Mỗi tuần TRƯỚC `tuanNay` một hướng đã theo (lựa chọn chốt của tuần ấy) — mới trước. */
export function tuanDaChon(ds: readonly LuaChonHuong[], tuanNay: string): LuaChonHuong[] {
  const tuan = [...new Set(ds.filter((lc) => lc.tuan < tuanNay).map((lc) => lc.tuan))].sort().reverse();
  return tuan.flatMap((t) => { const h = huongTuan(ds, t); return h === null ? [] : [h]; });
}

/* ═══ 3. CHẤM ════════════════════════════════════════════════════════════════════════════════ */

export interface KetQuaHuong {
  /** Việc đã được DỰNG (hũ đã mở · quy tắc đã đặt · luật đã viết · khung đã chọn) sau lúc chọn. */
  dung: boolean;
  /** Luật: giữ / vỡ trong tuần. `null` với hướng không phải luật. */
  giu: number | null;
  vo: number | null;
  /** Hũ / quy tắc: số cú tiền vào hũ ấy trong tuần. `null` với hướng không phải hũ. */
  nap: number | null;
}

/**
 * CHẤM một lựa chọn trên cửa sổ `[lc.tuan, den]`. Chỉ đọc bản ghi — không lưu phán quyết nào (nếp `so_doan`: "chưa đủ" tính
 * lại mỗi lần xem; người dùng dựng bù trong tuần thì tuần ấy vẫn chấm được).
 */
export function chamLuaChon(
  lc: LuaChonHuong, v: Pick<DauVaoHoc, 'so' | 'hu' | 'luat' | 'hoSo'>, den: string,
): KetQuaHuong {
  const ra: KetQuaHuong = { dung: false, giu: null, vo: null, nap: null };
  /* MÔ HÌNH MỚI: ưu tiên một hũ — "dựng" = hũ còn đó; `nap` = số NGÀY hũ ấy nhận tiền (cùng phép đếm với "làm đúng k/n"). GIỮ NHƯ CŨ không
     có việc để dựng — vẫn trả `dung` để không ai đọc nhầm là "chưa dựng". */
  if (lc.ma === MA_GIU_NHU_CU) return { ...ra, dung: true };
  if (lc.ma === MA_UU_TIEN) {
    const dem = lanLamUuTien(lc, v.so, den);
    return { ...ra, dung: lc.huId !== undefined && v.hu.some((h) => h.id === lc.huId), nap: dem === null ? 0 : dem.k };
  }
  const dich = dichCuaLuaChon(lc);
  if (dich === null) return ra;
  const tu = lc.tuan;
  const ngayChon = ngayCuaLuc(lc.luc);
  /* Cú tiền VÀO hũ (nạp tích lũy · gán chi tiêu) — qua hai hàm dấu của sổ, không so `chieu` trần (bài canh
     `pfm_chi_tieu.test.ts`). */
  const napVao = (huId: string): number => v.so.filter((k) => k.huId === huId && k.ngay >= tu && k.ngay <= den
    && (soChuyenHu(k) > 0 || soGan(k) > 0)).length;
  switch (dich.kieu) {
    case 'tao_hu': {
      const moi = v.hu.filter((h) => h.taoLuc >= lc.luc && (dich.nhom === 'tieu_dung' ? laTieuDung(h) : laTichLuy(h)));
      ra.dung = moi.length > 0;
      ra.nap = moi.reduce((a, h) => a + napVao(h.id), 0);
      return ra;
    }
    case 'lenh_hu': {
      const h = v.hu.find((x) => x.id === dich.huId);
      ra.dung = h?.tuDong !== undefined && h.tuDong.tu >= ngayChon;
      ra.nap = h === undefined ? 0 : napVao(h.id);
      return ra;
    }
    case 'cam_ket': {
      const ds = v.luat.filter((l) => l.dieuKien === dich.dk && l.taoLuc >= lc.luc);
      ra.dung = ds.length > 0;
      const trong = (luc: string): boolean => ngayCuaLuc(luc) >= tu && ngayCuaLuc(luc) <= den;
      ra.giu = ds.reduce((a, l) => a + l.lichSu.filter((d) => d.ma === 'giu' && trong(d.luc)).length, 0);
      ra.vo = ds.reduce((a, l) => a + l.lichSu.filter((d) => d.ma === 'vo' && trong(d.luc)).length, 0);
      return ra;
    }
    case 'phan_loai':
      ra.dung = v.hu.filter(laTieuDung).every((h) => h.thietYeu !== null) && v.hu.some(laTieuDung);
      return ra;
    case 'chon_khung':
      ra.dung = v.hoSo.khung === dich.khung;
      return ra;
    default:
      return ra;
  }
}

/**
 * "LÀM TỚI" — thứ dòng `huong_giu` đếm: đã dựng, VÀ nếu là luật thì không vỡ lần nào trong tuần, nếu là hũ thì có ít nhất
 * một cú tiền vào. Dựng mà để không là chưa tới — cái hũ rỗng không phải một hướng đã đi.
 */
export function lamToi(kq: KetQuaHuong): boolean {
  if (!kq.dung) return false;
  if (kq.vo !== null && kq.vo > 0) return false;
  if (kq.nap !== null) return kq.nap > 0;
  return true;
}

/** Tuần gần nhất ĐÃ KHÉP có một hướng đã theo — cho mặt CHẤM. `null` = chưa tuần nào. */
export function tuanVuaKhep(ds: readonly LuaChonHuong[], homNay: string): LuaChonHuong | null {
  return tuanDaChon(ds, dauTuan(homNay))[0] ?? null;
}

/* Hằng dùng lại ở màn — xuất để bài test kiểm cùng một số. */
export const CUA_SO_TIEN_VE = PFM.GUONG_CUA_SO_TIEN_VE;
