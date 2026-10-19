/**
 * PFM — MÀN "NGÀY ĐẦU": CHÂN DUNG · BA VIỆC HÔM NAY · THANH "MỨC ĐỘ HIỂU BẠN".
 * GIAI ĐOẠN A (D355/D356). **Làm theo DEMO ĐÃ CHỐT** (A11.25):
 * `docs/ui-ux/demo/pfm-ngay-dau.html`, màn `cd` (CHÂN DUNG) và `viec` (BA VIỆC).
 *
 * Mọi hàm dưới đây THUẦN — không đọc đồng hồ, không chuỗi hiển thị (D26: chữ ở
 * `lib/pfm_chu.ts`, bảng `CHU_NGAY_DAU`/`CHAN_DUNG_NOI_DUNG`). `hu_mau.ts`/`mau_luat.ts`
 * giữ chữ RIÊNG của chính chúng (ngoại lệ đã ghi ở đầu `pfm_chu.ts`) — các hàm dưới trả
 * THAM CHIẾU tới hai catalog đó (đúng mẫu, đúng lời) chứ không diễn giải lại câu chữ.
 *
 * ⚠ A10 🔒 — app không tự điền một con số tiền nào (P3); mọi mô tả nguồn gốc lựa chọn
 * (`vi`) đọc THẲNG `viSao` của mẫu đã chọn, không tự bịa câu "bạn chọn X ở câu N": hai
 * hàm chọn mẫu (`mauHopVoiHoSo`/`mauTheoDieuKien`) không luôn đi thẳng theo một chip duy
 * nhất, nên một câu trích chip tự chế có thể kể sai chuyện — xem chú thích `baViec`.
 */
import { ROUTE_TAI_CHINH_CAM_KET, ROUTE_TAI_CHINH_HU, ROUTE_TAI_CHINH_SO } from '@/lib/vocab';
import { HIEU_BAN } from '@config/pfm';
import { dieuKienGoiY } from './cam_ket.js';
import { chipHieuLuc, type HoSo } from './ho_so.js';
import { mauHopVoiHoSo, type MauHu } from './hu_mau.js';
import { demNgayGhi } from './lo_trinh.js';
import { canNguong, type MaDieuKien } from './luat.js';
import { MAU_LUAT, mauTheoDieuKien, type MauLuat } from './mau_luat.js';
import type { Khoan } from './so.js';

/* ══ 1. NHÓM NGUỒN THU (D353 §2) — CHỈ SỐNG TRONG BỘ NHỚ, KHÔNG BAO GIỜ CẤT ═══ */

export const NHOM_NGUON_THU = ['chu_cap', 'chu_cap_tu_kiem', 'luong', 'tu_kiem'] as const;
export type MaNhomNguonThu = (typeof NHOM_NGUON_THU)[number];

/**
 * Nhóm nguồn thu — bảng NGUYÊN VĂN §2 của
 * `docs/thiet-ke-de-xuat/pfm-hanh-vi/tien-nghiem-tu-thong-ke-ngoai.md` (D353), đọc trên
 * TỔ HỢP NHÃN THÔ của câu 1 (`hoSo.nguonThuNhan`) — KHÔNG phải `hoSo.nguonThu` (mã đã
 * đúc về bốn giá trị của `ctx_nguon_thu`, mất tổ hợp: hai nhóm khác nhau chọn cùng lúc
 * thì mã ấy CỐ Ý để trống — xem `phong_van.ts` §`nguonThuTuNhan`).
 *
 * ⚠⚠ GIÁ TRỊ TRẢ VỀ KHÔNG BAO GIỜ ĐƯỢC CẤT. Nó chỉ sống trong phép tính cục bộ của màn
 * NGÀY ĐẦU (chọn thẻ Oracle theo D353/D354 — thi công ở giai đoạn sau, khung "MÁY ĐANG
 * NGHĨ GÌ" của demo không thuộc GIAI ĐOẠN A); ghi nó vào hồ sơ, gói đặc trưng, hay đúc
 * thành `ctx_tu_lap` là biến một phép ước lượng cục bộ thành một trục nghiên cứu agent
 * tự đặt (A8.2 cấm thẳng) — D353 §2 đã nói rõ điều này.
 * ⚠ Không khớp hàng nào của bảng (bỏ câu 1, hoặc chỉ chọn "đầu tư") ⇒ `null`, dùng tiên
 *   nghiệm rộng chung (P7 — thà trống còn hơn đoán).
 */
export function nhomNguonThu(hoSo: Pick<HoSo, 'nguonThuNhan'>): MaNhomNguonThu | null {
  const nhan = new Set(hoSo.nguonThuNhan ?? []);
  const giaDinh = nhan.has('gia đình cho');
  const hocBong = nhan.has('học bổng');
  const luong = nhan.has('lương tháng');
  const tuKiem = nhan.has('làm thêm') || nhan.has('bán hàng');

  if ((giaDinh || hocBong) && !luong && !tuKiem) return 'chu_cap';
  if (giaDinh && (tuKiem || luong)) return 'chu_cap_tu_kiem';
  if (luong && !giaDinh) return 'luong';
  if (tuKiem && !luong && !giaDinh) return 'tu_kiem';
  return null;
}

/* ══ 2. CHÂN DUNG — mã suy từ chip ĐẦU TIÊN của câu 6, có tính override (A2) ═══ */

export const NET_CHAN_DUNG = ['nhip', 'deu', 'nguon'] as const;
export type MaNet = (typeof NET_CHAN_DUNG)[number];

export const MA_CHAN_DUNG = ['tien_ve', 'cuoi_thang', 'ngay_te', 'ban_ru', 'chua_ro'] as const;
export type MaChanDung = (typeof MA_CHAN_DUNG)[number];

/**
 * Nhãn câu nhịp (nguyên văn `phong_van.ts` §`CAU_PV`) → mã chân dung. NGUYÊN VĂN demo `CHAN_DUNG`.
 *
 * ⚠⚠ HAI KHOÁ CHO CÙNG MỘT Ý, CỐ Ý — xem chú thích dài ở `cam_ket.ts` §`THEO_NHIP`. Tóm tắt:
 * nhãn rút gọn 21/09, nhưng hồ sơ trên máy người dùng cũ vẫn giữ chuỗi cũ; bỏ khoá cũ thì lứa
 * ấy mất chân dung `tien_ve` mà không một dòng lỗi nào bắn ra.
 */
const MA_THEO_NHIP: Record<string, MaChanDung> = {
  'lúc vừa có tiền': 'tien_ve',
  'ngay sau khi tiền về': 'tien_ve',   // ← DI SẢN: hồ sơ ghi trước 21/09
  'cuối tháng': 'cuoi_thang',
  'ngày tệ': 'ngay_te',
  'đi chơi cùng bạn': 'ban_ru',
};

/* `chipHieuLuc` — chip "hiệu lực" của câu nhịp — nay sống ở `ho_so.ts` (D385): cửa ghi `suaHoSo` cũng
   phải đọc nó (câu nhịp đổi ⇒ lời đoán mới ⇒ mốc lời đoán cũ bỏ), mà `ho_so.ts` import ngược tệp này là
   thành VÒNG (`chan_dung → lo_trinh → ho_so`). Dời về gốc, import về đây — vẫn MỘT nguồn (A11.5). */

/**
 * Mã chân dung. Bỏ qua câu 6 (hoặc chip đã lạc khỏi danh mục — bản app sau đổi chữ chip)
 * ⇒ `'chua_ro'`, KHÔNG đoán (P7 — rào Barnum, xem đề xuất §2: "tên chân dung là chữ
 * người dùng TỰ CHỌN ở câu 6, không phải một chẩn đoán").
 */
export function chanDung(hoSo: Pick<HoSo, 'nhip' | 'chanDungNhip'>): MaChanDung {
  const chip = chipHieuLuc(hoSo);
  if (chip === undefined) return 'chua_ro';
  return MA_THEO_NHIP[chip] ?? 'chua_ro';
}

/**
 * Đưa MỘT nét về lại "gốc" (nút ĐỔI · HOÀN TÁC · THÔI GIỮ NHƯ CŨ): gỡ khỏi `chanDungBac`; riêng `nhip` thì bỏ luôn
 * chip tự chọn. ⚠ KHÔNG gỡ `chanDungDaCham` — thanh hiểu không tụt vì một lần đổi ý (demo D356, xem `soNetDaTuongTac`).
 */
export function hoanTacNetTrenHoSo(h: HoSo, khoa: MaNet): HoSo {
  const moi: HoSo = { ...h };
  const bac = (h.chanDungBac ?? []).filter((k) => k !== khoa);
  if (bac.length > 0) moi.chanDungBac = bac; else delete moi.chanDungBac;
  if (khoa === 'nhip') delete moi.chanDungNhip;
  return moi;
}

/** Câu phỏng vấn đứng sau mỗi nét — nét kể lại ĐÚNG câu ấy, nên câu đổi thì lời "không hẳn" cũ hết nghĩa. */
const CAU_SAU_NET: Record<MaNet, readonly (keyof HoSo)[]> = {
  nhip: ['nhip'],
  deu: ['deu'],
  nguon: ['nguonThuNhan', 'nguonThu'],
};

/**
 * LƯỢT LƯU PHỎNG VẤN: `cu` = hồ sơ trước khi lưu, `moi` = bản sắp ghi. Nét nào có câu đứng sau THẬT SỰ đổi ⇒ về lại
 * gốc (`hoanTacNetTrenHoSo`). **Lời gần nhất của người dùng thắng**: không dọn thì `chanDungNhip` (chip tự chọn ở màn
 * chân dung) mãi đè lên câu 6 vừa sửa — chân dung kể chuyện cũ trong khi LỘ TRÌNH kể chuyện mới.
 *
 * ⚠ So GIÁ TRỊ, không so "câu có mặt trong lượt lưu": màn phỏng vấn điền sẵn đáp án cũ, nên mở ra rồi bấm XONG mà
 * không chạm gì thì câu nào cũng "có mặt" — dọn theo dấu hiệu ấy là xoá lựa chọn của người dùng sau lưng họ.
 */
export function donDauVetSauPhongVan(cu: HoSo, moi: HoSo): HoSo {
  const khac = (k: keyof HoSo): boolean => JSON.stringify(cu[k] ?? null) !== JSON.stringify(moi[k] ?? null);
  let ra = moi;
  for (const net of NET_CHAN_DUNG) {
    if (CAU_SAU_NET[net].some(khac)) ra = hoanTacNetTrenHoSo(ra, net);
  }
  return ra;
}

/* ══ 3. BA VIỆC HÔM NAY ════════════════════════════════════════════════════ */

export interface TrangThaiBaViec {
  /** Có ít nhất một hũ đang mở (đang chạy hoặc tạm dừng) — bất kể mẫu nào. */
  coHuDangMo: boolean;
  /** Có ít nhất một luật đã đặt — bất kể bật/tắt. */
  coLuat: boolean;
  /** Sổ có ít nhất một khoản — bất kể tháng nào. */
  coGhiSo: boolean;
}

export type TrangThaiViec = 'xong' | 'bo' | 'chua';

interface ViecChung { trangThai: TrangThaiViec; route: string }
export interface ViecHu extends ViecChung { loai: 'hu'; mau: MauHu; coNo: boolean }
export interface ViecLuat extends ViecChung {
  loai: 'luat'; mau: MauLuat; dieuKien: MaDieuKien; haiCham: boolean;
}
export interface ViecGhi extends ViecChung { loai: 'ghi' }
export type ViecNgayDau = ViecHu | ViecLuat | ViecGhi;

/**
 * ⚠ TRẠNG THÁI THẬT THẮNG cờ "đã bỏ" cũ (A11.21 — mốc là điều làm được, không phải cờ
 * nhân tạo): ai đó bấm BỎ việc 1 rồi sau đó vẫn tự mở một hũ mới thì phải thấy XONG,
 * không phải kẹt ở BỎ mãi mãi.
 */
function trangThaiViec(xongThat: boolean, chiSo: number, bo: readonly number[]): TrangThaiViec {
  if (xongThat) return 'xong';
  return bo.includes(chiSo) ? 'bo' : 'chua';
}

/**
 * Ba việc hôm nay — ĐÚNG thứ tự demo: hũ · luật · ghi.
 *
 * ⚠ (1) HŨ: `mauHopVoiHoSo` đã tự đưa hũ trả nợ lên đầu khi `hoSo.coNo` — DÙNG LẠI
 *   nguyên hàm đó (D61: hũ theo mục tiêu/hoàn cảnh câu 3-4, không viết lại luật ấy ở
 *   đây), lấy PHẦN TỬ ĐẦU của kết quả.
 * ⚠ (2) LUẬT: `dieuKienGoiY` đọc `chipHieuLuc` (không phải toàn bộ `hoSo.nhip`, xem chú
 *   thích của nó) để chân dung và gợi ý luật LUÔN kể cùng một chip. Không suy được (bỏ
 *   câu 6, hoặc chip đã lạc khỏi danh mục) ⇒ mẫu ĐẦU TIÊN của `MAU_LUAT` làm khởi điểm
 *   trung tính — CÙNG lối `CamKet.tsx` đã dùng (`mauTheoDieuKien(dk) ?? MAU_LUAT[0]!`),
 *   người dùng luôn SỬA được ở màn CAM KẾT, mẫu chỉ là lối tắt (không phải cái lồng).
 * ⚠ (3) GHI: không mẫu nào để chọn — luôn trỏ về màn SỔ (bàn tiền).
 */
export function baViec(hoSo: HoSo, tt: TrangThaiBaViec): readonly [ViecHu, ViecLuat, ViecGhi] {
  const bo = hoSo.ngayDauBo ?? [];

  const mauHu = mauHopVoiHoSo(hoSo)[0]!; // luôn ≥ 2 phần tử — xem hu_mau.ts
  const hu: ViecHu = {
    loai: 'hu',
    mau: mauHu,
    coNo: hoSo.coNo === true,
    trangThai: trangThaiViec(tt.coHuDangMo, 0, bo),
    route: ROUTE_TAI_CHINH_HU,
  };

  const chip = chipHieuLuc(hoSo);
  const dk = dieuKienGoiY(chip !== undefined ? [chip] : []);
  const mauLuat = (dk === null ? null : mauTheoDieuKien(dk)) ?? MAU_LUAT[0]!;
  const luat: ViecLuat = {
    loai: 'luat',
    mau: mauLuat,
    dieuKien: mauLuat.dieuKien,
    haiCham: canNguong(mauLuat.dieuKien),
    trangThai: trangThaiViec(tt.coLuat, 1, bo),
    route: `${ROUTE_TAI_CHINH_CAM_KET}?dk=${mauLuat.dieuKien}`,
  };

  const ghi: ViecGhi = {
    loai: 'ghi',
    trangThai: trangThaiViec(tt.coGhiSo, 2, bo),
    route: ROUTE_TAI_CHINH_SO,
  };

  return [hu, luat, ghi] as const;
}

/* ══ 4. BA ĐẦU VÀO ĐẾM ĐƯỢC — nuôi thanh hiểu (§5) ════════════════════════════ */

/* Số câu đã trả lời + MẪU SỐ của nó: `soCauDaTraLoi`/`soCauPhongVan` ở `ho_so.ts` — MỘT nguồn
   cho màn này và LỘ TRÌNH (A11.5, D358; mẫu hoá biến 21/09 vì `no_so` là câu điều kiện). */

/**
 * Số nét chân dung người dùng ĐÃ TỪNG chạm. ⚠ Đếm `chanDungDaCham` (chỉ thêm), KHÔNG đếm `chanDungBac` (HOÀN TÁC
 * gỡ khỏi đó): demo đã duyệt giữ nguyên thanh khi đổi ý — bấm nhầm rồi hoàn tác không được thành hình phạt (D358).
 * Hồ sơ ghi trước khi có trường này ⇒ rơi về `chanDungBac` để không ai bị tụt thanh vì nâng bản.
 */
const NET_HOP_LE = ['nhip', 'deu', 'nguon'] as const;
export function soNetDaTuongTac(hoSo: Pick<HoSo, 'chanDungBac' | 'chanDungDaCham'>): number {
  const tap = new Set([...(hoSo.chanDungDaCham ?? []), ...(hoSo.chanDungBac ?? [])]);
  return NET_HOP_LE.filter((k) => tap.has(k)).length;
}

/** Số việc (0..3) đã LÀM hoặc BỎ — hai thứ cộng NHƯ NHAU (xem `mucDoHieu`). */
export function soViecDaLamHoacBo(viec: readonly ViecNgayDau[]): number {
  return viec.filter((v) => v.trangThai !== 'chua').length;
}

/** Số ngày (không phải số khoản) sổ có ghi — dùng lại `demNgayGhi` của `lo_trinh.ts` (D61). */
export function soNgayCoGhi(so: readonly Khoan[]): number {
  return demNgayGhi(so);
}

/* ══ 5. MỨC ĐỘ HIỂU BẠN — 0..100 + ba mốc (D356) ══════════════════════════════ */

export interface DauVaoHieu {
  /** 0..`soCauToiDa` — xem `soCauDaTraLoi`. */
  soCauDaTraLoi: number;
  /**
   * MẪU SỐ: số câu người NÀY thật sự được hỏi (`soCauPhongVan`), không phải hằng số.
   * ⚠ Trước 21/09 chỗ này chôn số **6** viết tay. Bộ câu đổi thành 8–9 (có câu điều kiện
   *   `no_so`), nên hằng số ấy vừa cắt cụt phần CÂU của thanh vừa không bao giờ cho nó đầy
   *   với người không nợ. Người gọi truyền vào để `ho_so.ts` giữ MỘT luật (A11.5).
   */
  soCauToiDa: number;
  /** 0..3 — xem `soNetDaTuongTac`. */
  soNetDaTuongTac: number;
  /** 0..3 — xem `soViecDaLamHoacBo`. */
  soViecDaLamHoacBo: number;
  /** Số ngày sổ có ghi — xem `soNgayCoGhi`; trần ở `HIEU_BAN.NGAY_TRAN`. */
  soNgayCoGhi: number;
  /* — thành phần GIAI ĐOẠN SAU (ngày 3/5/6/tuần), chưa thi công ở GIAI ĐOẠN A — */
  daTraLoiTheHoi?: boolean;
  daPhanHoiMauLap?: boolean;
  daGhiNhanGiuLuat?: boolean;
  daQuyDoiKhoanLon?: boolean;
  daChamCoIch?: boolean;
  doanDaCham?: boolean;
}

export interface MocHieu { ma: 'hoi' | 'doan' | 'khang_dinh'; p: number; dat: boolean }
export interface KetQuaHieu { phanTram: number; moc: readonly [MocHieu, MocHieu, MocHieu] }

function kep(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

/**
 * ⚠⚠ TÍNH CHẤT PHẢI GIỮ (D356 — nguyên văn demo): **mọi đáp án cộng NHƯ NHAU** (bác một
 * nét = giữ một nét đã đổi; LÀM = BỎ), và **đếm NGÀY có ghi, không đếm số khoản**.
 * Trọng số đọc từ `config/pfm.ts` §`HIEU_BAN` — sửa số thì sửa ở đó, không sửa ở đây.
 */
export function mucDoHieu(dauVao: DauVaoHieu): KetQuaHieu {
  const d = HIEU_BAN;
  /* ⚠ Mẫu KHÔNG được là 0 (chia cho 0 ⇒ NaN ⇒ thanh biến mất, không lỗi nào bắn ra). */
  const mau = Math.max(1, dauVao.soCauToiDa);
  const cau = kep(dauVao.soCauDaTraLoi, 0, mau);
  const diem =
    Math.floor((d.CAU_TOI_DA * cau) / mau)
    + d.NET * kep(dauVao.soNetDaTuongTac, 0, 3)
    + d.VIEC * kep(dauVao.soViecDaLamHoacBo, 0, 3)
    + d.NGAY * kep(dauVao.soNgayCoGhi, 0, d.NGAY_TRAN)
    + (dauVao.daTraLoiTheHoi ? d.HOI : 0)
    + (dauVao.daPhanHoiMauLap ? d.LAP : 0)
    + (dauVao.daGhiNhanGiuLuat ? d.LUAT : 0)
    + (dauVao.daQuyDoiKhoanLon ? d.QUY : 0)
    + (dauVao.daChamCoIch ? d.CO_ICH : 0)
    + (dauVao.doanDaCham ? d.DOAN : 0);
  const phanTram = kep(diem, 0, 100);
  return {
    phanTram,
    moc: [
      { ma: 'hoi', p: d.MOC_HOI, dat: phanTram >= d.MOC_HOI },
      { ma: 'doan', p: d.MOC_DOAN, dat: phanTram >= d.MOC_DOAN },
      { ma: 'khang_dinh', p: d.MOC_KHANG_DINH, dat: phanTram >= d.MOC_KHANG_DINH },
    ],
  };
}
