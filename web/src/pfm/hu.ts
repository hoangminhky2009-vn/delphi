/**
 * PFM — HŨ & MỤC TIÊU: lõi nghiệp vụ ở MÁY USER (nhóm C của khung chức năng).
 *
 * ⚠⚠ RANH GIỚI ĐẮT NHẤT CỦA CẢ FILE — hai loại trường, hai số phận:
 *
 *   RIÊNG TƯ (ở lại máy vĩnh viễn, chỉ vào két đã khoá — P2 🔒)
 *     `ten` · `ghiChu` · `muc` · `mocGop`  ⟵ chữ tự do, SỐ TIỀN, và một mốc giờ mili-giây
 *
 *   NGỮ NGHĨA (được phép lên server sau consent — K14)
 *     `loai` · `han` · `uuTien` · `thietYeu` · trạng thái · các cú CHUYỂN TIẾP
 *
 * Cả hai nằm chung một object vì với NGƯỜI DÙNG chúng là một cái hũ. Nhưng đường ra
 * khỏi máy chỉ có ĐÚNG MỘT cửa — `nhanNguNghia()` — và nó dựng object mới bằng cách
 * LIỆT KÊ TỪNG TRƯỜNG, không phải bằng cách xoá bớt. Khác biệt đó là thứ giữ cho một
 * trường thêm sau này (ví dụ `ghiChuRiengTu`) KHÔNG tự động rò ra ngoài: thêm trường
 * mới thì mặc định nó ở lại, muốn cho đi phải viết thêm một dòng và phải qua test.
 *
 * ⚠ FILE NÀY KHÔNG BIẾT GÌ VỀ MẠNG. Không `fetch`, không id server. Sổ là dữ liệu của
 * user (P1) và nó phải dùng được khi máy bay chế độ máy bay (B8).
 */
import { SO_DANG_KY } from '@config/pfm_dac_trung';
import { RE_KY } from '@config/pfm_dong_bo';
import { ICON_HU, type IconHu, type MauHu } from './hu_mau.js';
import { NHOM_HU, laTieuDung, nhomCua, type NhomHu } from './nhom_hu.js';

/* D421 — hai loại hũ: cửa nằm ở tệp lá `nhom_hu.ts` (lý do ở đó); xuất lại cho nơi gọi đã nhập từ đây. */
export { NHOM_HU, laTichLuy, laTieuDung, nhomCua, type NhomHu } from './nhom_hu.js';

/* ── Nhãn ngữ nghĩa: PHẢI khớp `config/pfm_dac_trung.ts` (một nguồn — D61) ───── */

export const LOAI_HU = ['an_uong', 'di_lai', 'giao_duc', 'thiet_bi', 'du_lich',
  'du_phong', 'tra_no', 'qua_tang', 'su_kien', 'suc_khoe', 'choi', 'khac'] as const;
export type MaLoaiHu = (typeof LOAI_HU)[number];

export const HAN_HU = ['ngan', 'vua', 'dai'] as const;      // <3 · 3–6 · >6 tháng
export type MaHan = (typeof HAN_HU)[number];

export const UU_TIEN_HU = ['cao', 'vua', 'thap'] as const;
export type MaUuTien = (typeof UU_TIEN_HU)[number];

/*
 * ⭐ NẤC QUYẾT TOÁN (C7) — SUY TỪ SỔ ĐĂNG KÝ, không chép lại.
 *
 * Bốn nhãn trên kia (`LOAI_HU`…) chép tay và có chú thích "PHẢI khớp config"; đây thì
 * KHÔNG chép, vì `kq_dat_muc_tieu` là một OUTCOME — nó đi thẳng vào dataset và một bản
 * sao lệch miền sẽ được server nhận rồi mới hỏng, ở kỳ sau, khi không còn dựng lại
 * được. Suy trực tiếp thì lệch miền là lỗi biên dịch, không phải lỗi dữ liệu (A11.5).
 */
export const KET_QUA_HU = SO_DANG_KY.kq_dat_muc_tieu.mien;
export type MaKetQuaHu = (typeof KET_QUA_HU)[number];

/**
 * TRẠNG THÁI HŨ — và `tam_dung` là trạng thái founder bổ sung (C8, 30/08).
 *
 * ⚠ `tam_dung` KHÔNG PHẢI `bo_do`, và trộn hai cái là mất đúng tín hiệu quý nhất:
 * người TẠM DỪNG rồi QUAY LẠI có quỹ đạo khác hẳn người BỎ HẲN — đó là tín hiệu phục
 * hồi, thứ nuôi câu hỏi "ai quay lại được, nhờ cái gì".
 */
export const TRANG_THAI_HU = ['dang_chay', 'tam_dung', 'xong', 'bo_do'] as const;
export type TrangThaiHu = (typeof TRANG_THAI_HU)[number];

/*
 * Cú CHUYỂN TIẾP — quá trình, không phải chỉ trạng thái cuối (file 07 §3.3).
 * ⚠ ĐỊNH NGHĨA SỐNG Ở `config/pfm_events.ts`, cạnh cửa kiểm K5 dùng nó (R9). Đây chỉ
 * là RE-EXPORT giữ nguyên tên cũ cho chỗ gọi — re-export là MỘT nguồn, không phải bản
 * sao. Trước đây enum nằm ở đây còn whitelist chỉ TRỎ TỚI bằng chú thích; sửa một chỗ
 * thì chỗ kia không biết, và cửa kiểm cũng không biết.
 */
import { CHUYEN_TIEP_HU, type MaChuyenTiepHu } from '@config/pfm_events';
import {
  chuanViSao, hanHopLe, laChac, laLyDo, loiDoanHuDangMo, loiDoanHuHienHanh, nhanHanTuNgay, thangCuaLuc,
  type LenhHu, type LoiDoanHu, type MaChac, type MaLyDoViThe,
} from './vi_the.js';

export { CHUYEN_TIEP_HU as CHUYEN_TIEP };
export type MaChuyenTiep = MaChuyenTiepHu;

export interface DauChuyenTiep {
  ma: MaChuyenTiep;
  /** Mốc thời gian máy user. Đủ để dựng quỹ đạo; KHÔNG kèm số tiền. */
  luc: string;
}

/** D420 — hai kiểu quy tắc tự chia (lý do chỉ hai kiểu: `tu_dong.ts` đầu tệp). */
export const KIEU_TU_DONG = ['ngay', 'phan_tram'] as const;
export type KieuTuDong = (typeof KIEU_TU_DONG)[number];

/**
 * ⭐ QUY TẮC TỰ CHIA của một hũ (D420) — người dùng TỰ ĐẶT; app chạy nó khi mở màn HŨ (`tu_dong.ts`).
 * ⚠ Mốc chạy nằm ngay trên quy tắc, lưu cùng hũ, theo hũ vào két — không có sổ phụ nào để trôi.
 */
export interface QuyTacTuDong {
  kieu: KieuTuDong;
  /** `ngay`: đồng mỗi ngày (số nguyên > 0) · `phan_tram`: phần trăm nguyên 1–100 của mỗi khoản tiền vào. */
  gt: number;
  /** Ngày đầu tiên được tính (`YYYY-MM-DD`, ngày đặt quy tắc). */
  tu: string;
  /** Ngày cuối đã chạy (`YYYY-MM-DD`), `null` = chưa chạy lần nào. */
  chayToi: string | null;
  /** Lúc chạy gần nhất (ISO) — khoản THU ghi SAU lúc này mới là "tiền vào mới". `null` = chưa chạy (tính từ ngày `tu`). */
  moc: string | null;
}

export interface Hu {
  id: string;
  /* ── riêng tư ── */
  ten: string;
  ghiChu?: string;
  /** Mức user TỰ ĐẶT (đồng). `null` = chưa đặt — app KHÔNG BAO GIỜ tự điền (P3 🔒). */
  muc: number | null;
  /*
   * ⚠⚠ KHÔNG CÓ `daGop` Ở ĐÂY, VÀ ĐÓ LÀ QUYẾT ĐỊNH ĐẮT NHẤT CỦA HÌNH DẠNG NÀY.
   *
   * "Đã góp bao nhiêu" = TỔNG các khoản trong sổ nối vào hũ này. Cất thêm một con số
   * `daGop` trên hũ là dựng bản cài đặt THỨ HAI của cùng một đại lượng (D61), và bản
   * sao đó sẽ trôi ở đúng ba chỗ không ai nhớ: xoá một khoản · sửa số tiền một khoản ·
   * khôi phục két đè lát tháng (K8). Cú trôi biểu hiện là **hũ nói 3 triệu trong khi sổ
   * cộng ra 2,8 triệu** — một lời nói dối về TIỀN CỦA CHÍNH USER, thứ họ sẽ bắt được và
   * sau đó không tin con số nào của app nữa. Mà cả PFM đứng trên niềm tin đó.
   * ⇒ `daGop` luôn ĐƯỢC TÍNH (`tongGopVaoHu` ở `so.ts`), không bao giờ được cất.
   *   Giá phải trả: `tienDo()` và `sapXep()` phải được ĐƯA con số vào. Đó là giá đúng —
   *   nó bắt nơi gọi phải cầm sổ trên tay, thay vì đọc một con số cũ trên hũ.
   */
  /**
   * ⭐ MỐC GÓP — RESET không cất tổng, nó DỜI MỐC (founder chốt phương án A, D292 §Còn nợ).
   *
   * "Đã góp" vẫn là TỔNG các khoản nối vào hũ (chú thích ngay trên), chỉ là tổng của những
   * khoản có `taoLuc` SAU mốc này. `null` = từ đầu. Bấm RESET ⇒ `mocGop = bây giờ`, mức giữ
   * nguyên, và **không một khoản nào bị đụng**: chúng vẫn nằm nguyên trong sổ, vẫn thấy được
   * — chỉ thôi được đếm vào hũ. Đây là cách duy nhất "về 0" mà không dựng bản sao thứ hai
   * của phép cộng (cất `daGop = 0`) và không cắt sợi dây `huId` mà người dùng đã tự nối.
   *
   * ⚠⚠ RIÊNG TƯ. Một mốc giờ chính xác đến mili-giây là dấu vân tay hành vi; nó ở lại máy
   * cùng `ten`/`muc`, KHÔNG đi qua `nhanNguNghia()`. Bài canh §I liệt kê từng trường.
   * ⚠ Bản ghi cũ trong kho không có khoá này ⇒ đọc lên là `undefined`; `tongGopVaoHu` coi
   *   `undefined` như `null` (từ đầu), nên hũ cũ không đổi con số một đồng nào.
   */
  mocGop: string | null;
  /* ── ngữ nghĩa ── */
  /**
   * ⚠⚠ BA NHÃN NÀY CÓ THỂ TRỐNG, VÀ ĐÓ LÀ CẢ ĐIỂM (sửa 31/08 — founder bác bản đầu).
   *
   * Bản đầu bắt buộc cả ba, tức muốn tạo một hũ phải qua ba menu — đúng cái "bảng
   * excel giản lược" founder cấm, và tệ hơn: nó bắt user điền nhãn ĐỂ PHỤC VỤ
   * DATASET, trong khi P19 nói thẳng "chỉ trả lời được câu data ⇒ KHÔNG LÀM" và
   * P16 nói tối ưu cho outcome của user chứ không cho lượng data sinh ra.
   *
   * `null` = CHƯA PHÂN LOẠI, và nó không bao giờ bị đoán hộ (P7: thiếu mẫu là
   * `null`, không phải một giá trị bịa). Hũ không nhãn vẫn là hũ tốt; app có thể
   * MỜI phân loại sau bằng một chạm, không bao giờ CHẶN.
   */
  loai: MaLoaiHu | null;
  han: MaHan | null;
  uuTien: MaUuTien | null;
  thietYeu: boolean | null;
  icon: IconHu;
  trangThai: TrangThaiHu;
  /**
   * NẤC USER TỰ CHỐT lúc quyết toán (C7). `null` = CHƯA HỎI, và nó phải ở lại `null`.
   *
   * ⚠⚠ `null` KHÔNG PHẢI `'xa'`. App biết user đã góp bao nhiêu QUA APP, nhưng không
   * biết họ có gom thêm ở chỗ khác không — tiền mặt, tài khoản khác, người nhà cho.
   * Suy nấc từ phần trăm là app **bịa một outcome** rồi đem bán nó như câu trả lời của
   * người dùng, đúng thứ P7/D62 cấm (thiếu mẫu ⇒ `null`, không phải một giá trị đẹp).
   */
  ketQua: MaKetQuaHu | null;
  /**
   * ⭐ NẤC THEO KỲ (D325) — câu trả lời "tháng ấy hũ này tới đâu" của thẻ CUỐI KỲ (màn
   * GƯƠNG), khoá `'YYYY-MM'`. Vắng khoá = chưa trả lời kỳ ấy, và nó ở lại vắng — cùng lý
   * lẽ `ketQua` ngay trên: app không suy nấc từ phần trăm đã góp (P7/D62).
   * ⚠ Bản ghi cũ không có trường này ⇒ `undefined` ⇒ không kỳ nào có nấc. Không cần chuyển đổi.
   */
  ketQuaKy?: Partial<Record<string, MaKetQuaHu>>;
  /**
   * ⭐ LỜI ĐOÁN (tệp 15 lát 1) — *"tới ngày X đủ mức, chắc N %"*, người dùng tự đặt lúc mở hũ
   * hoặc sau đó. CHỈ NỐI THÊM: phần tử cuối là lời đoán còn sống (nếu nó chưa khép). Toàn bộ ở
   * lại máy (P2). Bản ghi cũ ⇒ `undefined` ⇒ chưa lời đoán nào — không cần chuyển đổi.
   * Xem `vi_the.ts` §đầu tệp: trạng thái SUY lúc đọc, chỉ cú đổi giữa chừng và quyết toán sớm được cất.
   */
  loiDoan?: LoiDoanHu[];
  /**
   * ⭐ ĐIỀU KHOẢN VỊ THẾ (bản 2 lát 1): ngày VÀO LỆNH + kỳ hạn. Ở lại máy như `muc`. Vắng = hũ chưa vào lệnh (chỉ có
   * tên/mức) — vẫn là hũ tốt, chỉ chưa có cỡ. Cỡ và nhịp TÍNH từ đây (`vi_the.ts` §`coViThe`), không cất.
   */
  lenh?: LenhHu;
  /**
   * ⭐ QUY TẮC TỰ CHIA (D420). Vắng = không quy tắc. Ở lại máy như `muc` (P2) — không có trong `nhanNguNghia`.
   * Bản ghi cũ ⇒ `undefined` ⇒ không quy tắc; không cần chuyển đổi.
   */
  tuDong?: QuyTacTuDong;
  /**
   * ⭐ LOẠI HŨ (D421 — `nhom_hu.ts`). Vắng = `tich_luy`: mọi hũ trước D421 là hũ gom tới mức, nên đọc vắng là tích lũy
   * không phải đoán (P7) — chưa từng có loại thứ hai. Ở lại máy (P2) — không có trong `nhanNguNghia`.
   * ⚠ Đọc qua `laTieuDung` / `laTichLuy`, đừng so `nhom === 'tich_luy'` (bản ghi cũ là `undefined`).
   */
  nhom?: NhomHu;
  /** Mẫu đã dùng để tạo, hoặc `null` nếu user TỰ TẠO. Là data (P14). */
  tuMauId: string | null;
  taoLuc: string;
  lichSu: DauChuyenTiep[];
}

export class LoiHu extends Error {}

const CAT_TEN = 60;
const CAT_GHI_CHU = 200;

/** Bỏ khoảng trắng thừa + cắt độ dài. Tên rỗng là lỗi, không phải tên mặc định. */
function chuanTen(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t.length === 0) throw new LoiHu('Hũ cần một cái tên.');
  return t.slice(0, CAT_TEN);
}

export interface DauVaoTuTao {
  /** ⭐ Thứ DUY NHẤT bắt buộc. Muốn một hũ thì gõ tên nó, thế thôi. */
  ten: string;
  loai?: MaLoaiHu | null;
  han?: MaHan | null;
  uuTien?: MaUuTien | null;
  icon?: IconHu;
  thietYeu?: boolean | null;
  muc?: number | null;
  ghiChu?: string;
  /** Điều khoản vị thế — `{ tu: hôm nay, kyHan }` do màn VÀO LỆNH đưa (hàm thuần, không đọc đồng hồ). `null` = gỡ. */
  lenh?: LenhHu | null;
  /** D421 — loại hũ, chọn một lần lúc tạo (xem `NHOM_HU`). Vắng = tích lũy. */
  nhom?: NhomHu;
}

/** Kiểm điều khoản: hai ngày đúng dạng và kỳ hạn cách ngày vào lệnh ít nhất hạn tối thiểu (tệp 15 R3). */
function kiemLenh(l: LenhHu): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(l.tu) || !hanHopLe(l.tu, l.kyHan)) {
    throw new LoiHu(`Kỳ hạn không hợp lệ hoặc quá gần: ${l.kyHan}`);
  }
}

/** Icon mặc định khi user chưa chọn — trung tính, không ngụ ý loại hũ nào. */
export const ICON_MAC_DINH: IconHu = 'target';

/**
 * TỰ TẠO HŨ (founder 31/08: *"cho phép user tự tạo hũ — tự điền tên, chọn mức, icon"*).
 *
 * ⚠ TÊN TỰ DO, NHƯNG PHÂN LOẠI VẪN LÀ CÚ CHỌN. Đây là chỗ hai yêu cầu gặp nhau mà
 * không phải nhượng bộ nhau: user gõ tên gì cũng được (và tên đó không bao giờ rời
 * máy), còn `loai/han/uuTien` chọn từ menu nên nhãn ngữ nghĩa vẫn ĐÚNG 100% mà app
 * không phải đoán một chữ nào từ text (K14).
 *
 * ⚠ `muc` để trống được — và đó là mặc định đúng: app không tự sáng tác con số tiền
 * cho cá nhân (P3 🔒). Muốn app điền nháp thì phải đi qua khung user đã chọn cộng số
 * user tự khai, và vẫn cần user xác nhận.
 */
export function tuTao(v: DauVaoTuTao, luc: string, id: string): Hu {
  /*
   * ⚠ CHỈ KIỂM THỨ USER THẬT SỰ ĐƯA. Bản đầu ném lỗi khi thiếu loại/hạn/ưu tiên —
   * nghĩa là con đường "tự tạo" KHÓ HƠN con đường chọn mẫu, đúng ngược ý định.
   * Nay: đưa gì kiểm nấy, không đưa thì để trống.
   */
  if (v.loai != null && !LOAI_HU.includes(v.loai)) {
    throw new LoiHu(`Loại hũ không hợp lệ: ${v.loai}`);
  }
  if (v.han != null && !HAN_HU.includes(v.han)) {
    throw new LoiHu(`Thời hạn không hợp lệ: ${v.han}`);
  }
  if (v.uuTien != null && !UU_TIEN_HU.includes(v.uuTien)) {
    throw new LoiHu(`Mức ưu tiên không hợp lệ: ${v.uuTien}`);
  }
  if (v.icon !== undefined && !ICON_HU.includes(v.icon)) {
    throw new LoiHu(`Icon không có trong bộ: ${v.icon}`);
  }
  if (v.muc != null && (!Number.isFinite(v.muc) || v.muc <= 0)) {
    throw new LoiHu('Mức phải là số dương.');
  }
  if (v.nhom !== undefined && !NHOM_HU.includes(v.nhom)) {
    throw new LoiHu(`Loại hũ không hợp lệ: ${String(v.nhom)}`);
  }
  if (v.lenh != null && v.nhom === 'tieu_dung') {
    throw new LoiHu('Hũ chi không có kỳ hạn — nó đếm theo tháng.');
  }
  if (v.lenh != null) kiemLenh(v.lenh);
  return {
    id,
    ten: chuanTen(v.ten),
    ...(v.ghiChu ? { ghiChu: v.ghiChu.slice(0, CAT_GHI_CHU) } : {}),
    muc: v.muc ?? null,
    mocGop: null,
    loai: v.loai ?? null,
    // ⚠ Có kỳ hạn thì nhãn `han` (đang rời máy là `y_han`) SUY từ ngày — ngày cụ thể đúng hơn nhãn gõ tay.
    han: v.lenh != null ? nhanHanTuNgay(v.lenh.tu, v.lenh.kyHan) : v.han ?? null,
    uuTien: v.uuTien ?? null,
    thietYeu: v.thietYeu ?? null,
    icon: v.icon ?? ICON_MAC_DINH,
    trangThai: 'dang_chay',
    ketQua: null,
    tuMauId: null,
    taoLuc: luc,
    lichSu: [{ ma: 'tao', luc }],
    ...(v.lenh != null ? { lenh: { tu: v.lenh.tu, kyHan: v.lenh.kyHan } } : {}),
    ...(v.nhom !== undefined ? { nhom: v.nhom } : {}),
  };
}

/** Tạo từ MẪU (P14) — vẫn sửa được mọi thứ sau đó, mẫu không phải cái lồng. */
export function tuMau(mau: MauHu, luc: string, id: string, ten?: string): Hu {
  const h = tuTao({
    ten: ten ?? mau.tenGoiY,
    loai: mau.loai, han: mau.han, uuTien: mau.uuTien,
    icon: mau.icon, thietYeu: mau.thietYeu,
  }, luc, id);
  return { ...h, tuMauId: mau.id };
}

/* ── MÁY TRẠNG THÁI ─────────────────────────────────────────────────────────── */

const CHUYEN_DUOC: Record<TrangThaiHu, readonly TrangThaiHu[]> = {
  dang_chay: ['tam_dung', 'xong', 'bo_do'],
  // ⚠ Từ tạm dừng vẫn BỎ được — người tạm dừng rồi quyết định thôi hẳn là một quỹ
  // đạo có thật, không phải phải quay lại chạy rồi mới được bỏ.
  tam_dung: ['dang_chay', 'xong', 'bo_do'],
  // ⚠ MỞ LẠI ĐƯỢC sau khi bỏ. Người quay lại với một mục tiêu đã bỏ là tín hiệu phục
  // hồi đắt nhất; chặn nó là ép user tạo hũ mới và ta mất luôn sợi dây nối hai lần.
  bo_do: ['dang_chay'],
  // ⚠ `xong` là cuối. Muốn đặt mục tiêu tiếp thì đó là một hũ MỚI — nối đuôi vào hũ
  // cũ sẽ làm "tỷ lệ hoàn thành" đếm một hũ nhiều lần.
  xong: [],
};

const DAU_THEO_DICH: Partial<Record<TrangThaiHu, MaChuyenTiep>> = {
  tam_dung: 'tam_dung', xong: 'xong', bo_do: 'bo_do',
};

/**
 * CHIỀU NGƯỢC (D325): dấu nào ĐỔI trạng thái thì đưa hũ về đâu. Dấu sửa (`sua_*`, `doi_*`)
 * không đổi trạng thái ⇒ vắng. Dùng để dựng lại trạng thái của hũ TẠI MỘT KỲ ĐÃ QUA từ
 * `lichSu` (`goi_ky.ts` §`huTrongKy`).
 * ⚠ Đứng CẠNH bảng xuôi, cố ý: sửa `doiTrangThai` mà quên bảng này thì trạng thái kỳ cũ
 * dựng ra sai, và không màn nào hiện nó. `goi_ky.test.ts` §V đi xuôi bằng `doiTrangThai`
 * rồi dựng ngược bằng bảng này — hai bảng lệch là bài ấy đỏ.
 */
export const TRANG_THAI_SAU_DAU: Partial<Record<MaChuyenTiep, TrangThaiHu>> = {
  tao: 'dang_chay', tiep_tuc: 'dang_chay', mo_lai: 'dang_chay',
  tam_dung: 'tam_dung', xong: 'xong', bo_do: 'bo_do',
};

/** Có chuyển được trạng thái không (hàm thuần — UI dùng để bật/tắt nút). */
export function chuyenDuoc(tu: TrangThaiHu, den: TrangThaiHu): boolean {
  return (CHUYEN_DUOC[tu] as readonly string[]).includes(den);
}

/**
 * ĐỔI TRẠNG THÁI — trả hũ MỚI, ghi thêm một dấu vào lịch sử.
 *
 * ⚠ GHI THÊM, KHÔNG GHI ĐÈ (P17). Lịch sử chuyển tiếp là bằng chứng: nó phân biệt
 * "bỏ ngay từ đầu" với "chạy ba tháng, tạm dừng, quay lại, rồi mới bỏ" — hai câu
 * chuyện khác hẳn nhau mà trạng thái cuối thì giống hệt.
 */
export function doiTrangThai(hu: Hu, den: TrangThaiHu, luc: string): Hu {
  if (!chuyenDuoc(hu.trangThai, den)) {
    throw new LoiHu(`Không đi từ "${hu.trangThai}" sang "${den}" được.`);
  }
  // D421 — hũ tiêu dùng không có mức để "xong"; thôi dùng thì BỎ (mở lại được).
  if (den === 'xong' && laTieuDung(hu)) throw new LoiHu('Hũ chi không có đích để xong — thôi dùng thì bỏ.');
  const ma: MaChuyenTiep = den === 'dang_chay'
    ? (hu.trangThai === 'bo_do' ? 'mo_lai' : 'tiep_tuc')
    : DAU_THEO_DICH[den]!;
  return { ...hu, trangThai: den, lichSu: [...hu.lichSu, { ma, luc }] };
}

/**
 * ⭐ QUYẾT TOÁN (C7) — đóng một hũ VÀ ghi nấc user tự chốt, trong MỘT cú.
 *
 * ⚠⚠ VÌ SAO KHÔNG ĐỂ NƠI GỌI TỰ LÀM HAI BƯỚC (`doiTrangThai` rồi gán `ketQua`): vì
 * bước hai sẽ có ngày bị quên. Hũ khi ấy vẫn đóng đúng, `kq_bo_giua_chung` vẫn có, và
 * **không có gì đỏ** — chỉ `kq_dat_muc_tieu` lặng lẽ trống ở đúng những hũ đã kết thúc,
 * tức trống ở đúng chỗ nó là dữ liệu duy nhất. Gộp lại thì quên là lỗi biên dịch.
 *
 * ⚠ CHỈ hai đích `xong`/`bo_do`. `tam_dung` KHÔNG quyết toán: người tạm dừng chưa kết
 * thúc gì cả, hỏi họ "gom đủ chưa" là ép một câu trả lời cuối cho một chuyện đang dở
 * (và C8 dựng `tam_dung` chính là để giữ hai thứ ấy tách nhau).
 *
 * ⚠ Nấc do USER đưa vào, hàm này không đoán. Xem chú thích `Hu.ketQua`.
 */
export function quyetToan(
  hu: Hu, den: 'xong' | 'bo_do', ketQua: MaKetQuaHu, luc: string, lyDo?: MaLyDoViThe,
): Hu {
  if (!(KET_QUA_HU as readonly string[]).includes(ketQua)) {
    throw new LoiHu(`Nấc quyết toán không hợp lệ: ${ketQua}`);
  }
  // D421 — nấc "gom tới đâu" là OUTCOME của hũ gom tới mức (`kq_dat_muc_tieu`); hũ tiêu dùng không gom gì.
  if (laTieuDung(hu)) throw new LoiHu('Hũ chi không quyết toán.');
  if (lyDo !== undefined && !laLyDo(lyDo)) throw new LoiHu(`Lý do không hợp lệ: ${lyDo}`);
  /*
   * ⚠ LỜI ĐOÁN CÒN MỞ ⇒ KHÉP bằng CHÍNH nấc vừa chốt, và CẤT kết quả (không suy lại sau): hũ
   * `bo_do` mở lại được rồi chốt lần nữa — lần ấy đè `ketQua`, còn lời đoán đã xét thì không
   * được đổi kết quả theo. Lời đoán đã TỚI HẠN (chờ nấc của thẻ CUỐI KỲ) thì không đụng: nó
   * được xét bằng nấc của tháng hạn, không bằng một cú chốt muộn hơn.
   */
  const ld = loiDoanHuDangMo(hu, thangCuaLuc(luc));
  const loiDoan = ld !== null
    ? [...hu.loiDoan!.slice(0, -1), {
      ...ld,
      khep: { luc, ly: 'quyet_toan' as const, kq: ketQua === 'du' ? 'toi' as const : 'khong_toi' as const },
      ...(lyDo !== undefined ? { lyDo } : {}),
    }]
    : hu.loiDoan;
  return { ...doiTrangThai(hu, den, luc), ketQua, ...(loiDoan !== undefined ? { loiDoan } : {}) };
}

/* ═══ LỜI ĐOÁN (tệp 15 lát 1) — đặt · khép khi đổi điều kiện · nhãn vì sao ═════════ */

export interface DauVaoLoiDoan {
  /** `'YYYY-MM-DD'`, cách hôm đặt ≥ `PFM.VI_THE_HAN_TOI_THIEU_NGAY`. */
  han: string;
  chac: MaChac;
  viSao?: string;
}

/**
 * ĐẶT LỜI ĐOÁN — *"tới `han` đủ mức hiện tại, chắc `chac`"*.
 *
 * ⚠ CẦN MỨC: không có mức thì "đủ" không có nghĩa — lời đoán không kiểm được là một câu phán
 *   không ai chấm (đúng lỗi D385 vừa sửa ở phía app).
 * ⚠ MỘT LỜI ĐOÁN SỐNG MỘT LÚC. Lời đoán cũ còn mở/chờ hỏi thì không đặt chồng: hai câu cho cùng
 *   một hũ cùng kỳ là cho người ta chọn câu nào trúng để đếm.
 * ⚠ NHÃN HẠN `han` SUY TỪ NGÀY (`nhanHanTuNgay`). Nhãn ấy đang rời máy (`y_han`) — ngày cụ thể
 *   là câu trả lời đúng hơn nhãn của mẫu. Đổi nhãn đã có ⇒ ghi dấu `doi_han` như mọi cú đổi hạn;
 *   từ trống sang có thì không (đặt lần đầu không phải đổi — cùng nếp `sua` với mức).
 * ⚠ Hàm thuần: `homNay` do người gọi đưa (ngày theo giờ máy — `thoi_gian.ts` §`homNay`).
 */
export function moLoiDoan(hu: Hu, v: DauVaoLoiDoan, luc: string, homNay: string): Hu {
  if (laTieuDung(hu)) throw new LoiHu('Hũ chi không có lời đoán — mức của nó là mức tháng, không phải đích.');
  if (hu.muc === null) throw new LoiHu('Hũ chưa có mức — lời đoán cần một mức để xét đủ hay chưa.');
  if (hu.trangThai !== 'dang_chay') throw new LoiHu('Chỉ đặt lời đoán cho hũ đang chạy.');
  if (!laChac(v.chac)) throw new LoiHu(`Độ chắc không hợp lệ: ${String(v.chac)}`);
  if (!hanHopLe(homNay, v.han)) throw new LoiHu(`Hạn không hợp lệ hoặc quá gần: ${v.han}`);
  if (loiDoanHuHienHanh(hu, homNay.slice(0, 7)) !== null) {
    throw new LoiHu('Hũ này đang có một lời đoán chưa tới hạn.');
  }
  const viSao = chuanViSao(v.viSao);
  const ld: LoiDoanHu = { muc: hu.muc, han: v.han, chac: v.chac, ...(viSao ? { viSao } : {}), datLuc: luc };
  const nhan = nhanHanTuNgay(homNay, v.han);
  const doiNhan = hu.han !== null && hu.han !== nhan;
  return {
    ...hu,
    han: nhan,
    loiDoan: [...(hu.loiDoan ?? []), ld],
    lichSu: doiNhan ? [...hu.lichSu, { ma: 'doi_han', luc }] : hu.lichSu,
  };
}

/**
 * KHÉP GIỮA CHỪNG — gọi từ mọi cú đổi ĐIỀU KIỆN của hũ (mức · hạn · reset). Chỉ khép lời đoán
 * còn `mo`; lời đoán đã tới hạn thì cú đổi hôm nay không chạm tới kết quả tháng đã qua.
 */
function khepGiuaChung(hu: Hu, luc: string): Hu {
  const ld = loiDoanHuDangMo(hu, thangCuaLuc(luc));
  if (ld === null) return hu;
  return { ...hu, loiDoan: [...hu.loiDoan!.slice(0, -1), { ...ld, khep: { luc, ly: 'doi_giua_chung' } }] };
}

/**
 * NHÃN VÌ SAO cho một lời đoán đã xét (chạm ở thẻ CUỐI KỲ / hộp quyết toán). Tìm theo `datLuc`
 * (duy nhất trong một hũ). Chạm lại nhãn khác thì ĐÈ — đổi ý khi thẻ còn mở là quyền người dùng
 * (cùng nếp `ghiKetQuaKy`). Lời đoán đã khép giữa chừng thì không có gì để giải thích.
 */
export function ghiLyDoHu(hu: Hu, datLuc: string, lyDo: MaLyDoViThe): Hu {
  if (!laLyDo(lyDo)) throw new LoiHu(`Lý do không hợp lệ: ${String(lyDo)}`);
  const i = hu.loiDoan?.findIndex((x) => x.datLuc === datLuc) ?? -1;
  if (i < 0) throw new LoiHu('Không thấy lời đoán này.');
  const ld = hu.loiDoan![i]!;
  if (ld.khep?.ly === 'doi_giua_chung') throw new LoiHu('Lời đoán đã khép giữa chừng — không xét.');
  const moi = [...hu.loiDoan!];
  moi[i] = { ...ld, lyDo };
  return { ...hu, loiDoan: moi };
}

/**
 * ⭐ NẤC CUỐI KỲ (D325) — người dùng tự nói một hũ CÒN MỞ đã tới đâu sau khi một kỳ khép.
 *
 * ⚠ KHÁC `quyetToan`: không đóng hũ, không thêm dấu vào `lichSu` (đây không phải một cú
 * chuyển tiếp). Cùng bốn nấc, cùng mã `kq_dat_muc_tieu` — founder chốt 13/09 "không mã đặc
 * trưng mới". Dataset tách "nấc giữa đường" khỏi "nấc quyết toán" bằng `kq_bo_giua_chung`
 * CÙNG KỲ: `con_theo` ⇔ giữa đường.
 * ⚠ Trả lời lại thì ĐÈ nấc của kỳ ấy: đổi ý khi gói kỳ còn mở là quyền của người dùng.
 */
export function ghiKetQuaKy(hu: Hu, ky: string, kq: MaKetQuaHu): Hu {
  if (laTieuDung(hu)) throw new LoiHu('Hũ chi không có nấc cuối kỳ.');
  if (!RE_KY.test(ky)) throw new LoiHu(`Mã kỳ không hợp lệ: ${ky}`);
  if (!(KET_QUA_HU as readonly string[]).includes(kq)) {
    throw new LoiHu(`Nấc không hợp lệ: ${kq}`);
  }
  return { ...hu, ketQuaKy: { ...(hu.ketQuaKy ?? {}), [ky]: kq } };
}

/**
 * SỬA HŨ — mọi trường sửa được, mỗi cú sửa để lại một dấu.
 *
 * ⚠ HƯỚNG SỬA MỨC (tăng/giảm) LÀ NHÃN NGỮ NGHĨA, nhưng SỐ THÌ KHÔNG. "Thường xuyên
 * hạ mục tiêu" là một chân dung; "hạ từ 5 triệu xuống 3 triệu" là chuyện riêng của
 * user. Nên lịch sử chỉ chở HƯỚNG.
 */
export function sua(hu: Hu, thay: Partial<DauVaoTuTao>, luc: string): Hu {
  if (thay.nhom !== undefined && thay.nhom !== nhomCua(hu)) {
    throw new LoiHu('Loại hũ chọn một lần lúc tạo — không đổi được.');
  }
  if (thay.lenh != null && laTieuDung(hu)) throw new LoiHu('Hũ chi không có kỳ hạn — nó đếm theo tháng.');
  let ra: Hu = { ...hu };
  const dau: DauChuyenTiep[] = [];

  if (thay.ten !== undefined) {
    const t = chuanTen(thay.ten);
    if (t !== hu.ten) { ra.ten = t; dau.push({ ma: 'sua_ten', luc }); }
  }
  if (thay.muc !== undefined) {
    if (thay.muc !== null && (!Number.isFinite(thay.muc) || thay.muc <= 0)) {
      throw new LoiHu('Mức phải là số dương.');
    }
    ra.muc = thay.muc;
    /*
     * ⚠ BỎ MỨC (`null`) KHÔNG PHẢI LÀ HẠ MỨC — không ghi dấu hướng nào (R10).
     * Bản cũ viết `const moi = thay.muc ?? 0` nên "tôi thôi không đặt mục tiêu
     * nữa" bị quy về 0 rồi so với mức cũ, thành `sua_muc_giam`. Hai chuyện khác
     * hẳn nhau: HẠ mục tiêu là vẫn nhắm, chỉ nhắm thấp hơn; BỎ mục tiêu là thôi
     * nhắm. Gộp lại thì chỉ số `hv_sua_muc_tieu` đọc ra một người hay hạ chuẩn,
     * trong khi thật ra họ đang dọn hũ.
     * ⚠⚠ Đây là dữ liệu HÀNH VI đi vào gói đặc trưng — sai ở đây là sai vĩnh
     * viễn cho mùa này, không sửa lại được bằng một bản vá sau (A11.1).
     */
    if (thay.muc !== null && hu.muc !== null) {
      if (thay.muc > hu.muc) dau.push({ ma: 'sua_muc_tang', luc });
      else if (thay.muc < hu.muc) dau.push({ ma: 'sua_muc_giam', luc });
    } else if (thay.muc !== null && hu.muc === null) {
      // Từ CHƯA CÓ MỨC sang có mức: đó là ĐẶT mức lần đầu, và hướng của nó là tăng.
      dau.push({ ma: 'sua_muc_tang', luc });
    }
    // thay.muc === null ⇒ bỏ mức ⇒ KHÔNG dấu hướng.
  }
  if (thay.han !== undefined && thay.han !== hu.han) {
    if (thay.han != null && !HAN_HU.includes(thay.han)) {
      throw new LoiHu(`Thời hạn không hợp lệ: ${thay.han}`);
    }
    ra.han = thay.han; dau.push({ ma: 'doi_han', luc });
  }
  if (thay.uuTien !== undefined && thay.uuTien !== hu.uuTien) {
    if (thay.uuTien != null && !UU_TIEN_HU.includes(thay.uuTien)) {
      throw new LoiHu(`Ưu tiên không hợp lệ: ${thay.uuTien}`);
    }
    ra.uuTien = thay.uuTien; dau.push({ ma: 'doi_uu_tien', luc });
  }
  if (thay.loai !== undefined) {
    if (thay.loai != null && !LOAI_HU.includes(thay.loai)) {
      throw new LoiHu(`Loại hũ không hợp lệ: ${thay.loai}`);
    }
    ra.loai = thay.loai;
  }
  if (thay.icon !== undefined) {
    if (!ICON_HU.includes(thay.icon)) throw new LoiHu(`Icon không có trong bộ: ${thay.icon}`);
    ra.icon = thay.icon;
  }
  if (thay.thietYeu !== undefined) ra.thietYeu = thay.thietYeu;
  if (thay.ghiChu !== undefined) ra.ghiChu = thay.ghiChu.slice(0, CAT_GHI_CHU);

  ra.lichSu = [...hu.lichSu, ...dau];
  /*
   * ⚠ ĐỔI MỨC HAY HẠN = ĐỔI ĐIỀU KIỆN của lời đoán đang mở ⇒ khép nó, không xét (tệp 15 R2).
   * Kể cả BỎ mức (`null` — gia hạn ở màn SỔ): "đủ 6 triệu" không còn một mức để mà đủ.
   * Sửa tên / nhãn / ghi chú thì không: câu đã đặt vẫn nguyên nghĩa.
   */
  /*
   * ⭐ ĐIỀU KHOẢN VỊ THẾ (VÀO LỆNH lại / gỡ). Nhãn `han` đi theo ngày như ở `tuTao`; đổi nhãn đã có ⇒ dấu `doi_han`.
   */
  let doiLenh = false;
  if (thay.lenh !== undefined) {
    const cu = hu.lenh;
    const moi = thay.lenh;
    doiLenh = (cu?.tu ?? null) !== (moi?.tu ?? null) || (cu?.kyHan ?? null) !== (moi?.kyHan ?? null);
    if (moi !== null) {
      kiemLenh(moi);
      ra.lenh = { tu: moi.tu, kyHan: moi.kyHan };
      const nhan = nhanHanTuNgay(moi.tu, moi.kyHan);
      if (nhan !== ra.han) {
        if (ra.han !== null) ra.lichSu = [...ra.lichSu, { ma: 'doi_han', luc }];
        ra.han = nhan;
      }
    } else {
      delete ra.lenh;
    }
  }
  const doiMuc = thay.muc !== undefined && thay.muc !== hu.muc;
  const doiHan = thay.han !== undefined && thay.han !== hu.han;
  return doiMuc || doiHan || doiLenh ? khepGiuaChung(ra, luc) : ra;
}

/**
 * ⭐ RESET — về 0 bằng cách DỜI MỐC, mức giữ nguyên (phương án A, founder chốt 06/09).
 *
 * ⚠ Không đụng `muc` (đó là GIA HẠN), không đụng sổ (khoản cũ vẫn nối `huId`), không đụng
 * trạng thái. Chỉ một trường đổi, và `tongGopVaoHu` (so.ts) là chỗ duy nhất đọc nó.
 * ⚠ KHÔNG ghi dấu lịch sử: `CHUYEN_TIEP_HU` (config/pfm_events.ts) chưa có mã cho cú này,
 * và thêm một mã vào enum đi thẳng xuống `events` là việc của founder kèm một migration nới
 * CHECK (A8.2 · A11.4), không phải của một cú thi công UI. Tới lúc có mã thì thêm ĐÚNG MỘT
 * dòng `lichSu` ở đây; đừng suy "đã reset" từ `mocGop !== null` ở chỗ khác.
 * ⚠ Hũ `xong` là điểm cuối: reset nó là đổi con số "đã góp" của một hũ đã được GƯƠNG ghi
 *   nhận vào chỉ số đạt mục tiêu — cùng lý do `CHUYEN_DUOC.xong = []`.
 */
export function resetGop(hu: Hu, luc: string): Hu {
  if (hu.trangThai === 'xong') throw new LoiHu('Hũ đã xong thì không reset được.');
  if (laTieuDung(hu)) throw new LoiHu('Hũ chi tự về 0 mỗi tháng — không có gì để reset.');
  // ⚠ Về 0 giữa chừng = bắt đầu lại ⇒ lời đoán đang mở khép `doi_giua_chung` (tệp 15 R2).
  return khepGiuaChung({ ...hu, mocGop: luc }, luc);
}

/* ── ĐỌC ────────────────────────────────────────────────────────────────────── */

/**
 * ⭐ HŨ ĐEO SAO = hũ NGƯỜI DÙNG đánh dấu ưu tiên cao. MỘT cửa cho màn HŨ (vẽ sao) và Hub (ô Tài chính mặc định hiện hũ
 * này — SPEC ui-tang-khong-gian 11/10: "Ưu tiên là đánh dấu sao") — bản thứ hai của điều kiện này sẽ trôi (A11.5).
 *
 * ⚠⚠ SAO = DẤU CỦA NGƯỜI DÙNG, không phải nhãn ưu tiên preset của MẪU. `MAU_HU` đặt sẵn `uuTien` cho một số mẫu (vd "Quỹ dự
 * phòng" → cao) như một phân loại NGỮ NGHĨA — "Không mẫu nào đeo sao" (demo, `moTamHu`) nên sao chỉ có khi hũ KHÔNG sinh từ
 * mẫu (`tuMauId === null`) và người dùng tự bật công tắc ưu tiên lúc tạo.
 * ⚠ `=== 'cao'`, KHÔNG PHẢI `!== null`: `'thap'` cũng là "đã đặt ưu tiên" nhưng là ưu tiên THẤP — đeo sao cho nó là đọc ngược
 * đúng thứ người dùng vừa nói.
 */
export function laHuCoSao(hu: Pick<Hu, 'tuMauId' | 'uuTien'>): boolean {
  return hu.tuMauId === null && hu.uuTien === 'cao';
}

/**
 * TIẾN ĐỘ so với mức CHÍNH USER ĐẶT — `null` khi chưa đặt mức.
 *
 * ⚠ `null` chứ không phải 0 (P7): "chưa đặt mục tiêu" và "đặt rồi mà chưa góp được
 * đồng nào" là hai chuyện khác hẳn, và gộp chúng là để thanh tiến độ nói dối.
 * ⚠ Chỉ MÔ TẢ trạng thái so mức tự đặt — không màu đỏ phán xét (A10 + chống ostrich:
 * người ta né mở app đúng lúc cần mở nhất).
 */
export function tienDo(hu: Hu, daGop: number): number | null {
  if (hu.muc === null || hu.muc <= 0) return null;
  return Math.max(0, Math.min(1, daGop / hu.muc));
}

/**
 * ⭐ CỬA DUY NHẤT ĐƯA DỮ LIỆU HŨ RỜI MÁY (K14 · P2 🔒).
 *
 * Dựng object mới bằng cách LIỆT KÊ TỪNG TRƯỜNG — cố ý không dùng phép xoá-bớt
 * (`delete`/rest). Thêm một trường riêng tư vào `Hu` sau này thì nó KHÔNG tự chui ra
 * đây; muốn cho đi phải viết thêm một dòng, và dòng đó phải qua bài test cấm-tiền.
 */
export function nhanNguNghia(hu: Hu): {
  y_loai?: MaLoaiHu; y_han?: MaHan; y_uu_tien?: MaUuTien;
  y_thiet_yeu?: 'thiet_yeu' | 'khong';
  trang_thai: TrangThaiHu; tu_mau: boolean; so_lan_sua_muc: number;
} {
  /*
   * ⚠ NHÃN CHƯA ĐẶT THÌ KHÔNG PHÁT GÌ CẢ — tuyệt đối không thay bằng "khac" hay
   * một giá trị đoán. "Chưa phân loại" và "phân loại là khác" là hai chuyện khác
   * nhau; gộp chúng làm bẩn đúng cái cohort mà nhãn sinh ra để phục vụ (D62/P7).
   */
  return {
    ...(hu.loai !== null ? { y_loai: hu.loai } : {}),
    ...(hu.han !== null ? { y_han: hu.han } : {}),
    ...(hu.uuTien !== null ? { y_uu_tien: hu.uuTien } : {}),
    ...(hu.thietYeu !== null ? { y_thiet_yeu: hu.thietYeu ? 'thiet_yeu' as const : 'khong' as const } : {}),
    trang_thai: hu.trangThai,
    tu_mau: hu.tuMauId !== null,
    so_lan_sua_muc: hu.lichSu.filter(
      (d) => d.ma === 'sua_muc_tang' || d.ma === 'sua_muc_giam').length,
  };
}

/**
 * XẾP HŨ ĐỂ NHÌN — "dễ quan sát" là một yêu cầu, không phải trang trí (founder 31/08:
 * *"tuyệt đối không phải một bảng excel giản lược"*).
 *
 * Thứ tự: đang chạy → tạm dừng → xong → bỏ; trong mỗi nhóm, ưu tiên cao lên trước,
 * rồi tới hũ SẮP VỀ ĐÍCH (tiến độ cao) vì đó là thứ đáng nhìn nhất.
 * ⚠ Hũ chưa đặt mức KHÔNG bị đẩy xuống đáy — nó chỉ chưa có tiến độ, không phải kém
 * quan trọng hơn; đẩy nó xuống là ngầm giục user điền số, mà app thì không được giục.
 */
export function sapXep(ds: readonly Hu[], daGopCua: (huId: string) => number = () => 0): Hu[] {
  const hangTT: Record<TrangThaiHu, number> = {
    dang_chay: 0, tam_dung: 1, xong: 2, bo_do: 3,
  };
  const hangUT: Record<MaUuTien, number> = { cao: 0, vua: 1, thap: 2 };
  /*
   * ⚠ CHƯA ĐẶT ƯU TIÊN ⇒ XẾP NHƯ "VỪA", không đẩy xuống đáy. Đẩy xuống đáy là ngầm
   * phạt người chưa điền form — mà chính chỗ này vừa bỏ form đi. Hũ không nhãn phải
   * đứng ngang hàng hũ có nhãn.
   */
  const ut = (h: Hu) => (h.uuTien === null ? 1 : hangUT[h.uuTien]);
  return [...ds].sort((a, b) =>
    hangTT[a.trangThai] - hangTT[b.trangThai]
    || ut(a) - ut(b)
    || (tienDo(b, daGopCua(b.id)) ?? -1) - (tienDo(a, daGopCua(a.id)) ?? -1)
    || a.taoLuc.localeCompare(b.taoLuc));
}
