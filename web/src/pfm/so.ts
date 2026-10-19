/**
 * PFM — SỔ TÀI CHÍNH: nghiệp vụ thuần ở MÁY USER (nhóm B — "core utility").
 *
 * ⚠⚠ FILE NÀY KHÔNG CÓ CỬA RA, VÀ ĐÓ LÀ MỘT PHÁT BIỂU KIẾN TRÚC CHỨ KHÔNG PHẢI THIẾU
 * SÓT. `hu.ts` có `nhanNguNghia()` vì một cái hũ mang nhãn Intent được phép lên server.
 * Một dòng sổ thì KHÔNG: nó là số tiền + chữ tự do + giờ giấc, tức đúng ba thứ P2 🔒
 * cấm rời máy. Thứ duy nhất rời máy từ vùng này là **số liệu GỘP theo kỳ** do
 * `dac_trung/` tính, và **két đã khoá** do `ket/` đóng gói.
 * ⇒ `so.ts` KHÔNG import sổ đăng ký đặc trưng, không biết mã `hv_*` nào tồn tại. Có bài
 *   canh quét mã nguồn giữ đúng điều đó — thêm một `import` từ registry vào đây là mở
 *   một cửa mà kiến trúc không có chỗ cho nó.
 *
 * ⚠ Và không biết gì về MẠNG (nối tiếp `hu.ts`/`kho.ts`): ghi một khoản phải xong ở chế
 * độ máy bay (B8). Sổ là dữ liệu của user (P1), không phải một bản sao của server.
 */
import { LOAI_HU, type MaLoaiHu } from './hu.js';
import { thangCua, type BanGhi, type MaThang } from './kho.js';

export class LoiSo extends Error {}

/* ═══ 1. HÌNH DẠNG MỘT DÒNG SỔ ════════════════════════════════════════════════ */

/**
 * Nhãn khoản dùng CHUNG miền với loại hũ — và nó phải khớp `y_loai` trong sổ đăng ký.
 * Miền đó vì thế chỉ có ĐÚNG MỘT bản khai ở client (`hu.ts`); khai bản thứ hai ở đây là
 * dựng đúng bẫy D61, và cú trôi biểu hiện là "hũ Ăn uống không nhận khoản Ăn uống".
 */
export const NHAN_KHOAN = LOAI_HU;
export type MaNhanKhoan = MaLoaiHu;

export const CHIEU = ['chi', 'thu'] as const;
export type MaChieu = (typeof CHIEU)[number];

/**
 * PROVENANCE — *"dòng này được sinh ra bằng cách nào"* (file 07 §4).
 *
 * ⚠⚠ KHÔNG PHẢI ĐIỂM TIN CẬY. Dán SMS vẫn giả được, và vẫn là tự-khai. Nó là cờ ĐỘ
 * CHÍNH XÁC CỦA CON SỐ: dòng dán-SMS có số tiền đúng máy móc, dòng gõ tay hay làm tròn
 * ("khoảng 50k"). Phân tích calibration phải biết đang so với loại số nào — thiếu cờ
 * này thì một dataset làm-tròn bị đọc như một dataset chính xác.
 */
export const CACH_GHI = ['tay', 'mau_lap', 'dan_sms'] as const;
export type MaCachGhi = (typeof CACH_GHI)[number];

/**
 * D420 — AI chuyển khoản này từ ví vào hũ: `'tay'` = người dùng chạm tờ / gõ số ở khay màn HŨ · `'tu_dong'` = quy tắc
 * tự chia của hũ (`tu_dong.ts`). ⚠ Đây KHÔNG phải một giá trị thứ tư của `CACH_GHI`: miền của `CACH_GHI` là đặc trưng
 * nghiên cứu đã đăng ký (`hv_cach_ghi` — `tay | mau_lap | dan_sms`), nhồi thêm giá trị vào đó là đổi hợp đồng dữ liệu.
 * D424 — `'gan'` = khoản GÁN chi tiêu ở hũ tiêu dùng (xem `laGanChi`): KHÔNG phải tiền chuyển, cùng họ "khoản của màn
 * HŨ, không phải của SỔ".
 */
export const PHAN_BO = ['tay', 'tu_dong', 'gan'] as const;
export type MaPhanBo = (typeof PHAN_BO)[number];

export interface Khoan {
  id: string;
  /**
   * NGÀY ĐỊA PHƯƠNG của user, `YYYY-MM-DD` — KHÔNG phải `Date`, không phải UTC.
   * "Ngày" của PFM do múi giờ user định nghĩa (K7). Lưu `Date` ở đây là mời đúng cái
   * bug lệch-một-ngày: khoản 23h30 ngày 31/08 giờ VN đọc bằng UTC là 31/08, nhưng
   * khoản 07h00 ngày 01/09 giờ VN cũng đọc thành 31/08 — và tháng 8 thì đã niêm phong.
   */
  ngay: string;
  /**
   * SỐ TIỀN, đơn vị ĐỒNG, **số nguyên** (C5 cùng tinh thần với token).
   * VND không có phần lẻ trong thực tế, và float cho tiền là nợ không trả được: sai số
   * tích luỹ âm thầm qua mỗi phép cộng, rồi tổng tháng lệch vài đồng mà không ai lần ra.
   */
  soTien: number;
  chieu: MaChieu;
  nhan: MaNhanKhoan | null;   // chưa phân loại được để trống (cùng luật với hũ — D193)
  /** Chữ tự do. Ở LẠI MÁY vĩnh viễn (P2 🔒). */
  ghiChu?: string;
  /** Nối vào một hũ (C). `null` = khoản chi tiêu thường. */
  huId: string | null;
  cachGhi: MaCachGhi;
  /**
   * User TỰ gắn "vì sale / bạn rủ". `null` = KHÔNG HỎI, khác hẳn `false` = đã hỏi và
   * user nói không (P7/D62 — thiếu mẫu là null). Gộp hai cái là biến "chưa biết" thành
   * "biết là không", và nó thổi phồng mẫu số của trục FOMO.
   */
  viSale: boolean | null;
  taoLuc: string;
  suaLuc: string;
  /**
   * ⭐ KHOẢN PHÂN BỔ (D420) — tiền CHUYỂN giữa ví và hũ ở màn HŨ: NẠP (ví → hũ) là `chi` có `huId` (chạm tờ · gõ số ·
   * quy tắc tự chia); RÚT (hũ → ví, D421) là `thu` có `huId` — cùng quy ước dấu của `tongGopVaoHu`. Đề ngày lúc chuyển.
   * Vắng = khoản ghi ở SỔ (tiêu · tiền vào · góp cũ lúc ghi trước D410).
   * ⚠⚠ KHÔNG PHẢI CHI TIÊU. Chỉ hai phép đếm nó: tổng hũ (`tongGopVaoHu`/`bangGopHu`) và ví (`tienConLai`). Mọi con số
   *   về TIÊU — tổng chi ở SỔ, GƯƠNG, đặc trưng rời máy, Oracle, luật, chấm lời đoán — đi qua `laChiTieu`/`congSo` và
   *   bỏ nó ra. Không thì một quy tắc 50k/ngày làm "đã chi" phình 1,5 triệu mỗi tháng mà người dùng không tiêu đồng nào.
   * ⚠ Riêng tư như `huId` — ở lại máy (P2), không đi qua `nhanNguNghia`.
   */
  phanBo?: MaPhanBo;
}

/* ═══ 2. GHI — B1 ═════════════════════════════════════════════════════════════ */

export interface DauVaoKhoan {
  ngay: string;
  soTien: number;
  chieu?: MaChieu;
  nhan?: MaNhanKhoan | null;
  ghiChu?: string;
  huId?: string | null;
  cachGhi?: MaCachGhi;
  viSale?: boolean | null;
}

/** Ghi chú dài mấy cũng cắt — một dòng sổ không phải chỗ viết nhật ký, và độ dài không
 *  bị chặn là đường rẻ nhất làm phồng két (K10 đo từng KB). */
export const CAT_GHI_CHU = 200;

/**
 * ⚠ Ô BẮT BUỘC ĐÚNG HAI: ngày và số tiền. Cùng lý lẽ founder đã bác ở D193 — bắt phân
 * loại mới cho ghi là dựng một cái cổng thu phí bằng ma sát của user để lấy nhãn cho
 * dataset (P19/P16). Ghi một khoản phải nhanh hơn nhớ nó.
 */
export function taoKhoan(v: DauVaoKhoan, luc: string, id: string): Khoan {
  kiemNgay(v.ngay);
  kiemTien(v.soTien);
  if (v.nhan != null && !NHAN_KHOAN.includes(v.nhan)) {
    throw new LoiSo(`Nhãn không hợp lệ: ${v.nhan}`);
  }
  if (v.cachGhi !== undefined && !CACH_GHI.includes(v.cachGhi)) {
    throw new LoiSo(`Cách ghi không hợp lệ: ${v.cachGhi}`);
  }
  return {
    id,
    ngay: v.ngay,
    soTien: v.soTien,
    chieu: v.chieu ?? 'chi',
    nhan: v.nhan ?? null,
    ...(v.ghiChu ? { ghiChu: v.ghiChu.slice(0, CAT_GHI_CHU) } : {}),
    huId: v.huId ?? null,
    cachGhi: v.cachGhi ?? 'tay',
    viSale: v.viSale ?? null,
    taoLuc: luc,
    suaLuc: luc,
  };
}

/**
 * SỬA — B2.
 *
 * ⭐⭐ LUẬT ĐẮT NHẤT CỦA CẢ FILE: **sửa SỐ TIỀN của một dòng dán-SMS thì provenance TỤT
 * VỀ `tay`.** Cả giá trị của cờ `dan_sms` nằm ở câu "con số này do máy đọc ra, không
 * phải do người nhớ lại". User sửa số là câu đó hết đúng — giữ nguyên cờ là để một dòng
 * gõ tay đội lốt dòng máy đọc, và nó làm bẩn đúng phép calibration mà cờ này sinh ra để
 * phục vụ. Sửa NHÃN hay GHI CHÚ thì không đụng: chúng chưa bao giờ do máy đọc.
 */
export function suaKhoan(k: Khoan, thay: Partial<DauVaoKhoan>, luc: string): Khoan {
  const ra: Khoan = { ...k, suaLuc: luc };
  if (thay.ngay !== undefined) { kiemNgay(thay.ngay); ra.ngay = thay.ngay; }
  if (thay.soTien !== undefined && thay.soTien !== k.soTien) {
    kiemTien(thay.soTien);
    ra.soTien = thay.soTien;
    if (k.cachGhi === 'dan_sms') ra.cachGhi = 'tay';   // xem chú thích trên
  }
  if (thay.chieu !== undefined) ra.chieu = thay.chieu;
  if (thay.nhan !== undefined) {
    if (thay.nhan != null && !NHAN_KHOAN.includes(thay.nhan)) {
      throw new LoiSo(`Nhãn không hợp lệ: ${thay.nhan}`);
    }
    ra.nhan = thay.nhan;
  }
  if (thay.huId !== undefined) ra.huId = thay.huId;
  if (thay.viSale !== undefined) ra.viSale = thay.viSale;
  if (thay.ghiChu !== undefined) {
    if (thay.ghiChu) ra.ghiChu = thay.ghiChu.slice(0, CAT_GHI_CHU);
    else delete ra.ghiChu;
  }
  return ra;
}

function kiemTien(x: number): void {
  if (!Number.isInteger(x)) throw new LoiSo('Số tiền phải là số nguyên (đồng).');
  if (x <= 0) throw new LoiSo('Số tiền phải lớn hơn 0.');
}

const RX_NGAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
function kiemNgay(s: string): void {
  if (!RX_NGAY.test(s)) throw new LoiSo(`Ngày phải dạng YYYY-MM-DD: ${s}`);
}

/* ═══ 3. VÀO KHO ══════════════════════════════════════════════════════════════ */

/**
 * ⚠ Đóng gói một khoản thành bản ghi kho. `thang` suy từ NGÀY CỦA KHOẢN, không phải từ
 * hôm nay: ghi bù một khoản của tháng trước phải rơi đúng lát tháng trước, nếu không nó
 * biến mất khỏi mọi phép tính của tháng đó (K10).
 */
export function khoanRaBanGhi(k: Khoan): BanGhi<Khoan> {
  return { id: k.id, thang: thangCua(k.ngay), suaLuc: k.suaLuc, d: k };
}

/* ═══ 4. TÌM — B4 ═════════════════════════════════════════════════════════════ */

export interface LocKhoan {
  thang?: MaThang;
  chieu?: MaChieu;
  nhan?: MaNhanKhoan | null;
  huId?: string;
  /** Tìm trong ghi chú + không phân biệt hoa thường/dấu cách thừa. Ở LẠI MÁY. */
  tuKhoa?: string;
}

/**
 * ⚠ Sắp NGÀY GIẢM DẦN rồi `taoLuc` giảm dần rồi `id`: người xem sổ muốn thấy hôm nay
 * trước. Kẹp `id` ở cuối vì hai khoản ghi trong cùng một giây là chuyện thường (bấm
 * nhanh hai lần) — thiếu vế đó thì thứ tự đảo qua đảo lại giữa các lần render và người
 * dùng đọc ra "app tự xáo sổ".
 */
export function locKhoanSo(tat: readonly Khoan[], q: LocKhoan = {}): Khoan[] {
  const tk = q.tuKhoa ? chuanTim(q.tuKhoa) : null;
  return tat.filter((k) => {
    if (q.thang !== undefined && thangCua(k.ngay) !== q.thang) return false;
    if (q.chieu !== undefined && k.chieu !== q.chieu) return false;
    if (q.nhan !== undefined && k.nhan !== q.nhan) return false;
    if (q.huId !== undefined && k.huId !== q.huId) return false;
    if (tk && !chuanTim(k.ghiChu ?? '').includes(tk)) return false;
    return true;
  }).sort((a, b) => (a.ngay > b.ngay ? -1 : a.ngay < b.ngay ? 1
    : a.taoLuc > b.taoLuc ? -1 : a.taoLuc < b.taoLuc ? 1
      : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function chuanTim(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/* ═══ 5. CỘNG — số học của SỔ, không phải diễn giải ═══════════════════════════ */

/**
 * ⚠ RANH GIỚI VỚI `guong/`: ở đây chỉ có PHÉP CỘNG — "tháng này chi bao nhiêu". Mọi con
 * số có DIỄN GIẢI (so với kỳ trước, tỷ lệ chi tuỳ ý, nhịp chi bù) thuộc `guong/`. Trộn
 * vào đây thì phép diễn giải có hai bản và chúng trôi (D61); và tệ hơn, một hàm tên là
 * "cộng sổ" mà trả về một phán xét là thứ không ai đi đọc lại.
 */
export function congSo(tat: readonly Khoan[]): { chi: number; thu: number; rong: number } {
  let chi = 0; let thu = 0;
  for (const k of tat) {
    if (laPhanBo(k)) continue;   // D420 — chuyển vào hũ không phải tiêu (xem `Khoan.phanBo`)
    if (k.chieu === 'chi') chi += k.soTien; else thu += k.soTien;
  }
  return { chi, thu, rong: thu - chi };
}

/** D420 — khoản do màn HŨ chuyển từ ví vào hũ, không phải một khoản ghi ở SỔ. */
export function laPhanBo(k: Khoan): boolean {
  return k.phanBo !== undefined;
}

/**
 * ⭐ KHOẢN GÁN CHI TIÊU (D424 — founder 26/09: phía CHI làm *"giống thu"*, chọn "tờ + GÕ SỐ"): tiền chi tháng này chưa
 * chia bẻ ra tờ, mỗi cú chạm GÁN một tờ vào hũ tiêu dùng đang chọn. Khoản gán chỉ NÓI "chừng ấy tiền đã tiêu thuộc hũ
 * này" — không tiền nào đổi chỗ: ví (`tienConLai`), "đã chi" (`congSo`), tổng hũ tích lũy (`tongGopVaoHu`) đều bỏ nó ra.
 * `chi` = CHIA VÀO hũ · `thu` = GỠ RA khỏi hũ (cùng quy ước dấu với NẠP/RÚT). Số của hũ: `daTieuTrongThang`.
 */
export function laGanChi(k: Khoan): boolean {
  return k.phanBo === 'gan';
}

/** D424 — số CÓ DẤU của khoản gán: chia vào hũ (+) · gỡ ra (−) · không phải khoản gán (0). Một chỗ cho dấu của nó. */
export function soGan(k: Khoan): number {
  if (!laGanChi(k)) return 0;
  return k.chieu === 'chi' ? k.soTien : -k.soTien;
}

/**
 * ⭐ MỘT CỬA cho câu "đây có phải một cú TIÊU không" (D420): `chi` và KHÔNG phải chuyển vào hũ.
 * ⚠ Mọi phép tính về chi tiêu viết `laChiTieu(k)`, không viết `k.chieu === 'chi'` — bài canh `pfm_chi_tieu.test.ts`
 *   quét mã nguồn tìm đúng mẫu ấy.
 */
export function laChiTieu(k: Khoan): boolean {
  return k.chieu === 'chi' && !laPhanBo(k);
}

/**
 * ⭐ MỘT CỬA cho câu "đây có phải TIỀN VÀO của sổ không" (D421): `thu` và KHÔNG phải rút từ hũ ở màn HŨ. Rút hũ là tiền
 * của chính người dùng đổi chỗ (hũ → ví), không phải tiền về — đếm nó là "tiền về" thì GƯƠNG, luật "tiền vừa về", dòng
 * tiền tháng của danh mục đều đọc một cú rút như một đợt lương.
 * ⚠ Mọi phép tính về tiền vào viết `laThu(k)`; bài canh `pfm_chi_tieu.test.ts` quét `chieu === 'thu'` trần ở `pfm/`.
 */
export function laThu(k: Khoan): boolean {
  return k.chieu === 'thu' && !laPhanBo(k);
}

/* ═══ 5b. NỐI KHOẢN ↔ HŨ — B6 ═════════════════════════════════════════════════ */

/**
 * "ĐÃ GÓP ĐƯỢC BAO NHIÊU VÀO HŨ" — **luôn TÍNH, không bao giờ CẤT** (xem chú thích dài
 * ở `Hu` trong `hu.ts`). Một con số `daGop` nằm sẵn trên hũ là bản sao thứ hai của
 * chính phép cộng này, và nó trôi ở ba chỗ không ai nhớ: xoá khoản · sửa số tiền khoản
 * · khôi phục két đè lát tháng (K8).
 *
 * ⚠⚠ QUY ƯỚC DẤU — chỗ dễ cãi nhất, nên viết ra: với một hũ, khoản **`chi` là GÓP VÀO**
 * (tiền rời ví thường để dồn cho mục tiêu, hoặc trả một kỳ nợ) và **`thu` là RÚT RA**.
 * Nhìn từ ví thì ngược đời, nhưng nhìn từ HŨ thì đúng, và cái người dùng đang xem là
 * cái hũ.
 *
 * ⚠ KHÔNG kẹp về 0. Tổng âm nghĩa là rút nhiều hơn góp — một trạng thái CÓ THẬT (đổi ý,
 * lấy tiền hũ đi tiêu). Kẹp ở đây là giấu nó đi; `tienDo()` mới là chỗ kẹp, và nó kẹp
 * để thanh tiến độ không vẽ âm, không phải để phủ nhận con số.
 *
 * ⭐ `mocGop` (RESET, phương án A — `Hu.mocGop`): chỉ cộng khoản ghi SAU mốc. Vẫn là MỘT
 * phép cộng, vẫn không cất gì trên hũ; RESET chỉ đổi câu hỏi từ "từ đầu" thành "từ mốc".
 * Khoản trước mốc KHÔNG bị đụng — vẫn trong sổ, vẫn nối `huId`, chỉ thôi được đếm.
 */
export function tongGopVaoHu(
  tat: readonly Khoan[], huId: string, mocGop: string | null | undefined = null,
): number {
  let n = 0;
  for (const k of tat) {
    if (!laGopVaoHu(k, huId, mocGop)) continue;
    n += soGop(k);
  }
  return n;
}

/**
 * Số CÓ DẤU của một khoản nhìn từ HŨ nó nối vào: `chi` = góp vào (+) · `thu` = rút ra (−) — quy ước dấu ở chú thích
 * `tongGopVaoHu`. MỘT chỗ cho dấu ấy (D426): `tongGopVaoHu` · `bangGopHu` · đường góp của biểu đồ vị thế đều đi qua đây.
 */
export function soGop(k: Khoan): number {
  return k.chieu === 'chi' ? k.soTien : -k.soTien;
}

/**
 * D426 — số CÓ DẤU của một khoản CHUYỂN giữa ví và hũ tích lũy ở màn HŨ: NẠP (+) · RÚT (−) · không phải khoản chuyển (0).
 * Khoản gán (`laGanChi`) không phải tiền đổi chỗ nên ra 0, như ví và "đã chi" vẫn coi nó. Cùng họ với `soGan`: biểu đồ
 * "tiền đi đâu" đọc hai hàm này thay vì so `chieu` trần ngoài tệp sổ (bài canh `pfm_chi_tieu.test.ts`).
 */
export function soChuyenHu(k: Khoan): number {
  return laPhanBo(k) && !laGanChi(k) ? soGop(k) : 0;
}

/**
 * Khoản này có được ĐẾM vào số "đã góp" của hũ `huId` không — MỘT chỗ cho cả ba phép đếm: `tongGopVaoHu`, `bangGopHu`
 * và đường góp trên biểu đồ vị thế (D426, `bieu_do.ts` §`duongGopHu`). Biểu đồ vẽ một đường khác con số trên lá là app
 * nói hai điều về cùng một cái hũ.
 * ⚠ D424 — khoản GÁN không phải tiền vào/ra hũ (và chỉ trỏ hũ tiêu dùng) — không bao giờ là "đã góp".
 */
export function laGopVaoHu(k: Khoan, huId: string, mocGop: string | null | undefined): boolean {
  return k.huId === huId && !laGanChi(k) && tinhVaoHu(k, mocGop);
}

/**
 * ⭐ HŨ TIÊU DÙNG — ĐÃ TIÊU TRONG THÁNG (D421 → D424): tổng các khoản GÁN (`laGanChi`) vào hũ, đề ngày trong `thang`
 * (`YYYY-MM`) — CHIA VÀO cộng, GỠ RA trừ. Tính, không cất — cùng lý lẽ `tongGopVaoHu`.
 * ⚠ D421 đếm PHIẾU (khoản chi nối hũ); founder chọn "tờ + GÕ SỐ như thu" ⇒ hũ đếm TỔNG đã gán, không nhớ phiếu nào, và
 *   một khoản chi chia được cho nhiều hũ.
 * ⚠ Không kẹp: gỡ nhiều hơn đã chia là một trạng thái sai của dữ liệu (`ganKhoanKho` chặn nó), không giấu nó ở đây.
 * ⭐ D426 — `denNgay` (1–31): chỉ đếm tới hết ngày ấy của tháng — phép "so CÙNG NGÀY tháng trước" của biểu đồ. Vắng =
 *   cả tháng. Một hàm có tham số thay vì bản thứ hai của cùng vòng lặp (A11.5).
 */
export function daTieuTrongThang(
  tat: readonly Khoan[], huId: string, thang: string, denNgay: number | null = null,
): number {
  let n = 0;
  for (const k of tat) {
    if (k.huId !== huId || !k.ngay.startsWith(thang)) continue;
    if (denNgay !== null && Number(k.ngay.slice(8, 10)) > denNgay) continue;
    n += soGan(k);
  }
  return n;
}

/**
 * Khoản này có ĐƯỢC ĐẾM vào hũ không — MỘT chỗ cho luật "sau mốc", dùng chung cho cả
 * `tongGopVaoHu` lẫn `bangGopHu` (D61: hai vòng lặp tự viết lại điều kiện là hai bản sẽ trôi).
 *
 * ⚠ So `taoLuc` (thời ĐIỂM ghi), KHÔNG so `ngay`: RESET là một hành động tại một khoảnh khắc,
 * và khoản ghi SAU khoảnh khắc ấy là góp mới dù nó đề ngày nào (ghi bù cũng là góp). `ngay`
 * là ngày địa phương không có giờ — không so được với một mốc ISO, mà so được cũng sai.
 * ⚠ So CHUỖI được vì cả hai đều là ISO UTC cố định bề rộng từ `bayGio()`: thứ tự từ điển
 *   trùng thứ tự thời gian. Đừng `new Date()` ở đây — module này không đọc đồng hồ.
 * ⚠ `>` chặt, không `>=`: khoản ghi ĐÚNG mili-giây reset thuộc về lượt cũ. Biên nào cũng
 *   phải chọn một phía; phía này giữ cho "về 0" đúng nghĩa 0 ngay sau cú bấm.
 * ⚠ `undefined` = bản ghi hũ cũ chưa có khoá `mocGop` ⇒ như `null` = từ đầu. Đây không
 *   phải "thiếu ⇒ bịa 0" (P7): vắng mốc đúng nghĩa là "chưa reset lần nào".
 */
function tinhVaoHu(k: Khoan, mocGop: string | null | undefined): boolean {
  // D420 — khoản phân bổ được TẠO lúc tiền vào hũ, nên `taoLuc` của nó đã là lúc góp.
  return mocGop == null || k.taoLuc > mocGop;
}

/**
 * Bảng tra cho cả danh sách hũ — MỘT lượt duyệt sổ thay vì một lượt mỗi hũ.
 * Trả `Map` chứ không phải object: id hũ do máy sinh, và một id trùng tên một thuộc
 * tính có sẵn của `Object.prototype` là lớp bug người ta mất cả buổi để tìm.
 * ⚠ `mocCua` trả mốc RESET của từng hũ — cùng luật `tinhVaoHu` với `tongGopVaoHu`, để bảng
 *   tra không thành bản cộng thứ hai lặng lẽ bỏ qua mốc.
 */
export function bangGopHu(
  tat: readonly Khoan[],
  mocCua: (huId: string) => string | null | undefined = () => null,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of tat) {
    if (k.huId === null || !laGopVaoHu(k, k.huId, mocCua(k.huId))) continue;
    m.set(k.huId, (m.get(k.huId) ?? 0) + soGop(k));
  }
  return m;
}

/* ═══ 6. MẪU LẶP — B3 ═════════════════════════════════════════════════════════ */

/**
 * Khoản hay lặp lại (cà phê sáng, gửi xe, tiền trọ). Một chạm là xong.
 *
 * ⚠ Mẫu lặp KHÔNG tự sinh khoản theo lịch. Tự sinh thì sổ đầy những khoản CHƯA CHẮC ĐÃ
 * XẢY RA, và người dùng mất niềm tin vào con số của chính mình — mà cả PFM đứng trên
 * niềm tin đó. Nó chỉ ĐIỀN SẴN, user bấm mới thành khoản thật.
 */
export interface MauLap {
  id: string;
  ten: string;
  soTien: number | null;      // null = mỗi lần một khác, chỉ điền sẵn nhãn
  chieu: MaChieu;
  nhan: MaNhanKhoan | null;
  huId: string | null;
  taoLuc: string;
}

/**
 * D453 — mẫu này ghi TIỀN VÀO hay CHI. Một cửa ở tệp sổ (bài canh `pfm_chi_tieu.test.ts` cấm so `chieu` trần ngoài
 * `so.ts`): chip mẫu ở bàn tiền đọc chiều qua đây, không tự so chuỗi.
 */
export function laMauThu(m: Pick<MauLap, 'chieu'>): boolean {
  return m.chieu === 'thu';
}

export function tuMauLap(m: MauLap, ngay: string, luc: string, id: string): Khoan {
  if (m.soTien === null) throw new LoiSo(`Mẫu "${m.ten}" chưa có số tiền — hỏi user.`);
  return taoKhoan({
    ngay, soTien: m.soTien, chieu: m.chieu, nhan: m.nhan, huId: m.huId,
    ghiChu: m.ten, cachGhi: 'mau_lap',
  }, luc, id);
}

/* ═══ 7. DÁN TIN NHẮN BANK — B5 ═══════════════════════════════════════════════ */

/**
 * ⚠⚠ TRẢ VỀ BẢN NHÁP, KHÔNG BAO GIỜ GHI THẲNG (05c §4.2). Bóc sai một con số rồi tự ghi
 * là làm hỏng sổ của user bằng máy — và người ta sẽ không phát hiện ra cho tới lúc đối
 * chiếu cuối tháng. User xác nhận mới thành khoản.
 *
 * ⚠ Bóc CHẠY TRÊN MÁY, và chuỗi SMS gốc KHÔNG BAO GIỜ được cất lại: nó chứa số dư, số
 * tài khoản, tên người nhận — đúng loại dữ liệu P2 🔒 cấm, và cất nó vào sổ là để nó
 * trôi vào két rồi lên server dưới dạng ciphertext mà ta đã hứa là "không đọc được"
 * nhưng vẫn là dữ liệu ta không nên có.
 */
export interface NhapSms {
  soTien: number | null;
  chieu: MaChieu | null;
  /** Đoạn mô tả bóc được (nếu có) — user sửa thoải mái trước khi xác nhận. */
  moTa: string | null;
  /** Cái gì bóc không ra, nói thẳng để UI hỏi đúng ô đó. */
  thieu: readonly ('soTien' | 'chieu')[];
}

/**
 * Bóc số tiền + chiều từ một tin nhắn ngân hàng tiếng Việt.
 *
 * ⚠ CỐ Ý HẸP. Mỗi ngân hàng một định dạng và định dạng đổi theo mùa; một bộ regex tham
 * lam sẽ bóc RA SỐ SAI nhiều hơn là bóc trượt, mà bóc sai tệ hơn bóc trượt gấp bội —
 * trượt thì user gõ tay, sai thì user không biết mà sửa. Nên: không chắc ⇒ trả `null` và
 * khai vào `thieu`.
 */
export function bocSms(tin: string): NhapSms {
  const s = tin.normalize('NFC');
  const soTien = bocTien(s);
  const chieu = bocChieu(s);
  const thieu: ('soTien' | 'chieu')[] = [];
  if (soTien === null) thieu.push('soTien');
  if (chieu === null) thieu.push('chieu');
  return { soTien, chieu, moTa: bocMoTa(s), thieu };
}

/**
 * ⚠ Chỉ nhận con số ĐI KÈM ĐƠN VỊ TIỀN (`VND`/`đ`/`d`). Tin nhắn bank đầy số không phải
 * tiền — số tài khoản, mã giao dịch, ngày giờ. Không neo vào đơn vị thì bộ bóc sẽ tự tin
 * trả về bốn chữ số cuối của số tài khoản.
 */
function bocTien(s: string): number | null {
  const m = s.match(/([\d][\d.,\s]{2,})\s*(VND|VNĐ|đ|d)\b/i);
  if (!m) return null;
  const tho = m[1]!.replace(/[.,\s]/g, '');
  if (!/^\d+$/.test(tho)) return null;
  const n = Number(tho);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function bocChieu(s: string): MaChieu | null {
  // Dấu +/- ngay trước số tiền là tín hiệu chắc nhất và dùng chung mọi ngân hàng.
  if (/[-−]\s*[\d]/.test(s)) return 'chi';
  if (/\+\s*[\d]/.test(s)) return 'thu';
  const t = s.toLowerCase();
  if (/(thanh toan|thanh toán|chuyen khoan di|rut tien|rút tiền|mua)/.test(t)) return 'chi';
  if (/(nhan tien|nhận tiền|ghi co|ghi có|nap tien|nạp tiền)/.test(t)) return 'thu';
  return null;
}

/**
 * ⚠⚠ HAI CÁI NEO, VÀ CẢ HAI ĐỀU DO MỘT BÀI TEST BẮT ĐƯỢC CHỨ KHÔNG PHẢI DO ĐỌC RA.
 *
 * Bản đầu viết `/(?:ND|Noi dung)\s*[:.]?\s*(.+)$/im` và nó khớp **ngay bên trong chữ
 * "VND"** — đơn vị tiền chứa đúng hai ký tự `ND` — nên mọi tin nhắn đều "bóc ra" phần
 * đuôi kể từ sau số tiền. Bản vá thứ hai neo vào ĐẦU DÒNG, và đó lại quá chặt: SMS thật
 * hay để `ND:` cùng dòng với số tiền.
 * ⇒ Neo đúng thứ cần neo: nhãn **không được nằm trong một từ khác** (`[^\p{L}]` phía
 *   trước), và **dấu hai chấm là bắt buộc**. Đúng họ lỗi `bocTien` đã phòng: bộ bóc
 *   tham lam trả về thứ SAI thường xuyên hơn trả về rỗng, mà sai thì user không biết
 *   để sửa.
 */
function bocMoTa(s: string): string | null {
  const m = s.match(/(?:^|[^\p{L}])(?:ND|Noi dung|Nội dung)\s*[:.]\s*(.+)$/imu);
  const t = m?.[1]?.trim().slice(0, CAT_GHI_CHU);
  return t ? t : null;
}

/**
 * Bản nháp → khoản thật. Chỉ gọi được khi user ĐÃ xác nhận, và chính vì thế nó đòi số
 * tiền tường minh: bắt người gọi truyền lại con số là bắt họ đi qua bước xác nhận, thay
 * vì lỡ tay chuyền thẳng một `NhapSms` còn `null` vào sổ.
 */
export function xacNhanSms(
  n: NhapSms, chot: { ngay: string; soTien: number; chieu: MaChieu;
    nhan?: MaNhanKhoan | null; huId?: string | null },
  luc: string, id: string,
): Khoan {
  return taoKhoan({
    ngay: chot.ngay,
    soTien: chot.soTien,
    chieu: chot.chieu,
    nhan: chot.nhan ?? null,
    huId: chot.huId ?? null,
    ...(n.moTa ? { ghiChu: n.moTa } : {}),
    // Giữ `dan_sms` CHỈ KHI con số user chốt đúng bằng con số máy bóc ra — cùng lý lẽ
    // với `suaKhoan()`: cờ này nói "máy đọc", không nói "user dán".
    cachGhi: n.soTien !== null && n.soTien === chot.soTien ? 'dan_sms' : 'tay',
  }, luc, id);
}
