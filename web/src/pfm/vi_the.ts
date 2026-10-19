/**
 * PFM — **LỜI ĐOÁN CỦA NGƯỜI DÙNG VỀ MỘT VỊ THẾ** (tệp 15 lát 1, `docs/yeu-cau-ky-thuat/15-pfm-vi-the-thi-cong.md`).
 *
 * Một hũ có mức, hay một luật nếu-thì, là một QUYẾT ĐỊNH. Lúc mở nó, người dùng được mời (không
 * bắt) nói trước một câu kiểm được: *"tới 25/03 đủ 6 triệu, chắc 70 %"* · *"tháng 10 giữ trọn luật
 * này, chắc 90 %"*. Tới hạn, app hỏi lại ĐÚNG câu ấy. Tệp này giữ miền nhãn, hình dạng bản ghi và
 * mọi phép SUY trạng thái — hàm thuần, không đọc đồng hồ, không chữ hiển thị (D26).
 *
 * ⚠⚠ BỐN LUẬT TỪ PHẢN BIỆN 25/09 (`thiet-ke-de-xuat/.../nang-cap-pfm-theo-vi-the.md` §10):
 *  1. Kết quả xét bằng CÂU KHAI SỰ VIỆC đang có, không bằng câu nhìn lại: hũ = nấc "tới đâu"
 *     (`ketQuaKy` · `ketQua` — người dùng khai, tính cả tiền ngoài app, D62) · luật = các chạm
 *     giữ/vỡ bấm NGAY lúc luật bắn. "Đúng như tôi nghĩ" chỉ là NHÃN vì sao, không phải điểm.
 *  2. KHOÁ LÚC ĐẶT. Không sửa độ chắc, không dời hạn. Đổi mức / reset / tắt luật khi lời đoán
 *     còn mở ⇒ lời đoán khép `doi_giua_chung`, KHÔNG xét — cùng bẫy D385 (`so_doan.ts` §đầu tệp):
 *     sửa sau khi thấy đáp án là tự chấm mà gian.
 *  3. "Hoàn cảnh đổi" là nhãn đi kèm, đếm như mọi lượt xét — không có cửa loại khỏi mẫu.
 *  4. Mặt người dùng ĐẾM theo mức chắc, không in Brier (càng thấp càng tốt ⇒ "độ khớp 0,10"
 *     đọc ngược; n nhỏ là nhiễu).
 *
 * ⚠ SUY, KHÔNG CẤT. Trạng thái (mở · chờ hỏi · tới · không tới · bỏ trống) tính lúc đọc từ nấc
 *   đã có và `lichSu` đã có. Chỉ cất đúng hai thứ không suy lại được: cú ĐỔI GIỮA CHỪNG (xảy ra
 *   đúng lúc bản ghi bị sửa) và kết quả của QUYẾT TOÁN sớm (hũ mở lại rồi chốt lần nữa sẽ đè
 *   `ketQua` — kết quả lời đoán cũ không được đổi theo, D385 cất `kq` vì cùng lý do).
 * ⚠ MỐC KỲ theo UTC như `goi_ky.ts` §`mocKy` (lệch ≤ 7 giờ ở biên tháng — cùng lý lẽ ở đó).
 * ⚠ P2 — mọi thứ ở đây ở lại máy. Lát 3 mới có mã rời máy, và chỉ là nhãn.
 */
import { PFM } from '@config/pfm';
import type { Hu, MaHan } from './hu.js';
import { laTichLuy } from './nhom_hu.js';
import type { Luat } from './luat.js';
import { laThu, type Khoan } from './so.js';
import { ngayCuaLuc, thangSauCua, thangTruocCua } from './thoi_gian.js';

/* ═══ MIỀN NHÃN ═══════════════════════════════════════════════════════════════ */

/** Ba nấc "chắc tới đâu" — số % hiện ra ở `PFM.VI_THE_CHAC`. Thứ tự tăng dần. */
export const CHAC = ['thap', 'vua', 'cao'] as const;
export type MaChac = (typeof CHAC)[number];

/** Nhãn VÌ SAO lúc tới hạn — bối cảnh, không phải điểm (luật 3). */
export const LY_DO_VI_THE = ['dung_nhu_nghi', 'danh_gia_sai', 'hoan_canh_doi'] as const;
export type MaLyDoViThe = (typeof LY_DO_VI_THE)[number];

export type KetQuaViThe = 'toi' | 'khong_toi';

/**
 * Trạng thái SUY của một lời đoán:
 *  · `mo`             — kỳ của nó chưa khép
 *  · `cho_hoi`        — kỳ vừa khép (tháng liền trước), còn chờ câu khai (nấc · chạm giữ/vỡ)
 *  · `toi`/`khong_toi` — đã xét được
 *  · `doi_giua_chung` — điều kiện bị đổi khi còn mở ⇒ không xét
 *  · `bo_trong`       — kỳ khép quá một tháng mà không có câu khai ⇒ không xét (không bịa)
 */
export type TrangThaiLoiDoan = 'mo' | 'cho_hoi' | KetQuaViThe | 'doi_giua_chung' | 'bo_trong';

/* ═══ HÌNH DẠNG BẢN GHI ═════════════════════════════════════════════════════════ */

/**
 * ĐIỀU KHOẢN CỦA MỘT VỊ THẾ HŨ — ngày vào lệnh + kỳ hạn (`YYYY-MM-DD`, ngày lịch của người dùng). Ở lại máy như
 * `muc`. Cỡ ("mỗi tháng · mỗi ngày · % dòng tiền") và nhịp ("nhanh/chậm mấy kỳ") đều TÍNH từ đây lúc đọc.
 */
export interface LenhHu {
  tu: string;
  kyHan: string;
}

/** Một lời đoán trên HŨ: "tới `han` đủ `muc`, chắc `chac`". Nối thêm vào `Hu.loiDoan`. */
export interface LoiDoanHu {
  /** Mức LÚC ĐẶT — ảnh chụp: đổi mức sau đó là đổi điều kiện (luật 2). Ở lại máy. */
  muc: number;
  /** `'YYYY-MM-DD'`. Xét ở THÁNG của ngày này (thẻ CUỐI KỲ tháng ấy hỏi nấc). */
  han: string;
  chac: MaChac;
  /** Một dòng người dùng tự viết — ở lại máy, cắt `PFM.VI_THE_VI_SAO_CAT`. */
  viSao?: string;
  datLuc: string;
  /** Chỉ hai cách khép cần CẤT — xem "SUY, KHÔNG CẤT" ở đầu tệp. */
  khep?: { luc: string; ly: 'doi_giua_chung' } | { luc: string; ly: 'quyet_toan'; kq: KetQuaViThe };
  lyDo?: MaLyDoViThe;
}

/** Một lời đoán trên LUẬT: "tháng `ky` giữ trọn, chắc `chac`". Nối thêm vào `Luat.loiDoan`. */
export interface LoiDoanLuat {
  /** `'YYYY-MM'` — tháng LIỀN SAU lúc đặt (chỉ kỳ mở ra sau lời đoán mới được xét — D385). */
  ky: string;
  chac: MaChac;
  datLuc: string;
  /** Mốc tắt luật khi lời đoán còn mở ⇒ không xét (luật không lưu lịch sử bật/tắt). */
  doiGiuaChung?: string;
  lyDo?: MaLyDoViThe;
}

/* ═══ NGÀY THÁNG ═════════════════════════════════════════════════════════════════ */

const RE_NGAY = /^\d{4}-\d{2}-\d{2}$/;

/** Tháng (UTC) của một mốc ISO — cùng quy ước `goi_ky.ts` §`mocKy`. */
export const thangCuaLuc = (luc: string): string => luc.slice(0, 7);

function soNgayTrongThang(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** `'2026-09-25'` + 6 tháng ⇒ `'2027-03-25'`; ngày kẹp vào cuối tháng (31/01 + 1 ⇒ 28/02). */
export function hanTuSoThang(tu: string, soThang: number): string {
  const y = Number(tu.slice(0, 4));
  const m = Number(tu.slice(5, 7)) - 1 + soThang;
  const ny = y + Math.floor(m / 12);
  const nm = ((m % 12) + 12) % 12 + 1;
  const d = Math.min(Number(tu.slice(8, 10)), soNgayTrongThang(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Số ngày từ `tu` tới `den` (cả hai `'YYYY-MM-DD'`). */
export function soNgayGiua(tu: string, den: string): number {
  return Math.round((Date.parse(`${den}T00:00:00Z`) - Date.parse(`${tu}T00:00:00Z`)) / 86_400_000);
}

/**
 * Nhãn hạn `ngan/vua/dai` suy từ NGÀY — đúng ranh `HAN_HU` (`hu.ts`: <3 · 3–6 · >6 tháng),
 * đếm THÁNG TRỌN. Người dùng đưa ngày thì nhãn là hệ quả, không phải câu hỏi thứ hai.
 */
export function nhanHanTuNgay(tu: string, han: string): MaHan {
  let thang = (Number(han.slice(0, 4)) - Number(tu.slice(0, 4))) * 12
    + (Number(han.slice(5, 7)) - Number(tu.slice(5, 7)));
  if (Number(han.slice(8, 10)) < Number(tu.slice(8, 10))) thang -= 1;
  if (thang < 3) return 'ngan';
  return thang <= 6 ? 'vua' : 'dai';
}

/** Kiểm hạn một lời đoán hũ: đúng dạng và cách hôm đặt ít nhất `VI_THE_HAN_TOI_THIEU_NGAY`. */
export function hanHopLe(homNay: string, han: string): boolean {
  return RE_NGAY.test(han) && !Number.isNaN(Date.parse(`${han}T00:00:00Z`))
    && soNgayGiua(homNay, han) >= PFM.VI_THE_HAN_TOI_THIEU_NGAY;
}

/** Chuẩn câu vì-sao: gộp khoảng trắng, cắt độ dài; rỗng ⇒ `undefined` (không cất chuỗi rỗng). */
export function chuanViSao(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const t = raw.replace(/\s+/g, ' ').trim().slice(0, PFM.VI_THE_VI_SAO_CAT);
  return t === '' ? undefined : t;
}

export function laChac(v: unknown): v is MaChac {
  return typeof v === 'string' && (CHAC as readonly string[]).includes(v);
}

export function laLyDo(v: unknown): v is MaLyDoViThe {
  return typeof v === 'string' && (LY_DO_VI_THE as readonly string[]).includes(v);
}

/* ═══ SUY TRẠNG THÁI — HŨ ═══════════════════════════════════════════════════════ */

/**
 * ⚠ Xét ở THÁNG của hạn, bằng nấc thẻ CUỐI KỲ tháng ấy đã hỏi (`ketQuaKy[tháng]`). Nấc đầy đủ
 * duy nhất là `du`; `gan_du` vẫn là "chưa tới" — câu đã đặt là "đủ", không phải "gần đủ".
 */
export function trangThaiLoiDoanHu(hu: Hu, ld: LoiDoanHu, thangSong: string): TrangThaiLoiDoan {
  if (ld.khep?.ly === 'doi_giua_chung') return 'doi_giua_chung';
  if (ld.khep?.ly === 'quyet_toan') return ld.khep.kq;
  const k = ld.han.slice(0, 7);
  if (k >= thangSong) return 'mo';
  const nac = hu.ketQuaKy?.[k];
  if (nac !== undefined) return nac === 'du' ? 'toi' : 'khong_toi';
  return k === thangTruocCua(thangSong) ? 'cho_hoi' : 'bo_trong';
}

/** Lời đoán còn SỐNG của hũ (mở, hoặc vừa tới hạn chờ hỏi) — tối đa một. */
export function loiDoanHuHienHanh(hu: Hu, thangSong: string): LoiDoanHu | null {
  const cuoi = hu.loiDoan?.at(-1);
  if (cuoi === undefined) return null;
  const t = trangThaiLoiDoanHu(hu, cuoi, thangSong);
  return t === 'mo' || t === 'cho_hoi' ? cuoi : null;
}

/**
 * Lời đoán hũ còn MỞ (tháng hạn chưa khép) — thứ duy nhất một cú đổi điều kiện hay một cú quyết toán
 * sớm được phép khép. Lời đoán đã tới hạn (`cho_hoi`) thuộc về nấc của tháng hạn, không của hôm nay.
 */
export function loiDoanHuDangMo(hu: Hu, thangSong: string): LoiDoanHu | null {
  const ld = loiDoanHuHienHanh(hu, thangSong);
  return ld !== null && trangThaiLoiDoanHu(hu, ld, thangSong) === 'mo' ? ld : null;
}

/** Lời đoán hũ TỚI HẠN ở kỳ `ky` (hạn rơi vào tháng ấy, chưa khép) — cho thẻ CUỐI KỲ. */
export function loiDoanHuToiHan(hu: Hu, ky: string): LoiDoanHu | null {
  const ld = hu.loiDoan?.at(-1);
  return ld !== undefined && ld.khep === undefined && ld.han.slice(0, 7) === ky ? ld : null;
}

/* ═══ SUY TRẠNG THÁI — LUẬT ═════════════════════════════════════════════════════ */

export interface DemLuatKy {
  ban: number;
  giu: number;
  vo: number;
  /** Lần bắn trong kỳ chưa được đánh dấu giữ/vỡ. */
  cho: number;
}

/**
 * Đếm nhịp của luật TRONG KỲ `ky`, ghép mỗi chạm giữ/vỡ với LẦN BẮN nó trả lời (bắn ngày 31,
 * đánh dấu ngày 1 tháng sau ⇒ vẫn là của kỳ có lần bắn). `dangChoDanhGia` chặn bắn chồng, nên
 * `lichSu` là chuỗi bắn → (giữ|vỡ) → bắn → …
 */
export function demLuatTrongKy(luat: Luat, ky: string): DemLuatKy {
  const dau = `${ky}-01T00:00:00.000Z`;
  const sau = `${thangSauCua(ky)}-01T00:00:00.000Z`;
  const trong = (luc: string) => luc >= dau && luc < sau;
  const ra = { ban: 0, giu: 0, vo: 0, cho: 0 };
  let banCho: string | null = null;
  for (const d of luat.lichSu) {
    if (d.ma === 'ban') {
      if (trong(d.luc)) ra.ban += 1;
      banCho = d.luc;
    } else if ((d.ma === 'giu' || d.ma === 'vo') && banCho !== null) {
      if (trong(banCho)) ra[d.ma] += 1;
      banCho = null;
    }
  }
  if (banCho !== null && trong(banCho)) ra.cho += 1;
  return ra;
}

/** Giữ TRỌN kỳ: có bắn, không vỡ lần nào, mọi lần đã đánh dấu. `null` = chưa đủ để nói. */
export function tronLuat(d: DemLuatKy): boolean | null {
  if (d.vo > 0) return false;
  if (d.ban === 0 || d.cho > 0) return null;
  return d.giu === d.ban;
}

/**
 * ⚠ Kỳ vừa khép mà còn lần bắn chờ đánh dấu ⇒ `cho_hoi` (người dùng còn đánh dấu được trong
 * tháng này). Kỳ khép quá một tháng ⇒ hết chờ. Kỳ không bắn lần nào ⇒ `bo_trong`: "giữ trọn một
 * luật không bao giờ bắn" đúng một cách tầm thường, xét nó là một lượt "tới" giả.
 */
export function trangThaiLoiDoanLuat(luat: Luat, ld: LoiDoanLuat, thangSong: string): TrangThaiLoiDoan {
  if (ld.doiGiuaChung !== undefined) return 'doi_giua_chung';
  if (ld.ky >= thangSong) return 'mo';
  const d = demLuatTrongKy(luat, ld.ky);
  const t = tronLuat(d);
  if (t !== null) return t ? 'toi' : 'khong_toi';
  return d.cho > 0 && ld.ky === thangTruocCua(thangSong) ? 'cho_hoi' : 'bo_trong';
}

/** Lời đoán còn SỐNG của luật — tối đa một. */
export function loiDoanLuatHienHanh(luat: Luat, thangSong: string): LoiDoanLuat | null {
  const cuoi = luat.loiDoan?.at(-1);
  if (cuoi === undefined) return null;
  const t = trangThaiLoiDoanLuat(luat, cuoi, thangSong);
  return t === 'mo' || t === 'cho_hoi' ? cuoi : null;
}

/** Lời đoán luật cho ĐÚNG kỳ `ky` — cho thẻ CUỐI KỲ (kể cả đã xét: thẻ in số rồi hỏi vì sao). */
export function loiDoanLuatCuaKy(luat: Luat, ky: string): LoiDoanLuat | null {
  const ld = luat.loiDoan?.find((x) => x.ky === ky);
  return ld !== undefined && ld.doiGiuaChung === undefined ? ld : null;
}

/* ═══ ĐẾM THEO MỨC CHẮC — thứ duy nhất mặt người dùng thấy về "đọc mình sát tới đâu" ═══ */

export interface DemChac {
  chac: MaChac;
  /** Số lượt ĐÃ XÉT (tới + không tới) — kể cả lượt gắn nhãn "hoàn cảnh đổi" (luật 3). */
  n: number;
  toi: number;
}

export interface TongLoiDoan {
  theoChac: DemChac[];
  /** Trong số đã xét, bao nhiêu lượt người dùng gắn "hoàn cảnh đổi" — in tách dòng, không trừ. */
  hoanCanhDoi: number;
  doiGiuaChung: number;
  boTrong: number;
  /** Đang mở hoặc chờ hỏi. */
  song: number;
}

/**
 * ⚠ ĐẾM LẠI mỗi lần đọc, không cộng dồn (khuôn `so_doan.ts` §`thanhTich`): một bộ đếm cất sẵn là
 * bản sao thứ hai của chính các bản ghi này, và nó trôi (A11.5).
 */
export function tongLoiDoan(hu: readonly Hu[], luat: readonly Luat[], thangSong: string): TongLoiDoan {
  const ra: TongLoiDoan = {
    theoChac: CHAC.map((chac) => ({ chac, n: 0, toi: 0 })),
    hoanCanhDoi: 0, doiGiuaChung: 0, boTrong: 0, song: 0,
  };
  const dem = (t: TrangThaiLoiDoan, chac: MaChac, lyDo: MaLyDoViThe | undefined): void => {
    if (t === 'mo' || t === 'cho_hoi') { ra.song += 1; return; }
    if (t === 'doi_giua_chung') { ra.doiGiuaChung += 1; return; }
    if (t === 'bo_trong') { ra.boTrong += 1; return; }
    const o = ra.theoChac.find((x) => x.chac === chac)!;
    o.n += 1;
    if (t === 'toi') o.toi += 1;
    if (lyDo === 'hoan_canh_doi') ra.hoanCanhDoi += 1;
  };
  for (const h of hu) for (const ld of h.loiDoan ?? []) dem(trangThaiLoiDoanHu(h, ld, thangSong), ld.chac, ld.lyDo);
  for (const l of luat) for (const ld of l.loiDoan ?? []) dem(trangThaiLoiDoanLuat(l, ld, thangSong), ld.chac, ld.lyDo);
  return ra;
}

/* ═══ VỊ THẾ & DANH MỤC — "mỗi quyết định là một khoản đầu tư", tính lúc đọc từ sổ (0 câu hỏi mới) ═══════ */

/**
 * Điều khoản đang hiệu lực của một hũ: `Hu.lenh` nếu người dùng đã VÀO LỆNH; hũ có lời đoán mà chưa có `lenh`
 * (bản ghi trước lượt này) thì suy từ chính lời đoán còn sống — kỳ hạn = hạn của lời đoán.
 */
export function lenhCua(hu: Hu): LenhHu | null {
  if (hu.lenh) return hu.lenh;
  const ld = hu.loiDoan?.at(-1);
  return ld !== undefined && ld.khep === undefined ? { tu: ngayCuaLuc(ld.datLuc), kyHan: ld.han } : null;
}

/**
 * DÒNG TIỀN THÁNG — tiền VÀO (khoản `thu`) của tháng trọn gần nhất; tháng trước chưa ghi khoản thu nào thì lấy
 * tháng này tới hôm nay. `null` = sổ chưa có khoản thu nào ⇒ cỡ theo % không tính được (P7 — không bịa mẫu số).
 */
export interface DongTien { thang: string; so: number }

export function dongTienThang(so: readonly Khoan[], thangSong: string): DongTien | null {
  const cong = (t: string): number => so.reduce((a, k) => (laThu(k) && k.ngay.startsWith(t) ? a + k.soTien : a), 0);
  const truoc = thangTruocCua(thangSong);
  const a = cong(truoc);
  if (a > 0) return { thang: truoc, so: a };
  const b = cong(thangSong);
  return b > 0 ? { thang: thangSong, so: b } : null;
}

/** Cỡ của một vị thế — quy ra đơn vị của chính người dùng, không một lời khen chê (A10). */
export interface CoViThe {
  /** Đồng mỗi ngày theo kế hoạch (mức ÷ số ngày của kỳ hạn), làm tròn nghìn. */
  moiNgay: number;
  /** = `moiNgay` × 30 — "mỗi tháng" là cách người ta nghĩ về tiền về. */
  moiThang: number;
  /** Phần của dòng tiền tháng (1 = 100 %). `null` khi chưa biết dòng tiền. */
  phan: number | null;
  /** Ngày còn tới kỳ hạn (âm = đã quá hạn). */
  conNgay: number;
  /** Đã góp QUA APP so kế hoạch tới hôm nay, tính bằng KỲ (tháng): âm = chậm. `null` khi chưa tới ngày thứ nhất. */
  nhipKy: number | null;
}

const lamTronNghin = (x: number): number => Math.round(x / 1000) * 1000;

export function coViThe(
  hu: Hu, daGop: number, homNay: string, dongTien: DongTien | null,
): CoViThe | null {
  const lenh = lenhCua(hu);
  return hu.muc === null || lenh === null ? null : coTuDieuKhoan(hu.muc, lenh, daGop, homNay, dongTien);
}

/**
 * MỘT công thức cỡ cho cả lá vị thế lẫn bảng VÀO LỆNH đang gõ dở (A11.5 — bản thứ hai của cùng phép chia sẽ trôi).
 */
export function coTuDieuKhoan(
  muc: number, lenh: LenhHu, daGop: number, homNay: string, dongTien: DongTien | null,
): CoViThe {
  const soNgay = Math.max(1, soNgayGiua(lenh.tu, lenh.kyHan));
  const moiNgayThat = muc / soNgay;
  const moiThang = lamTronNghin(moiNgayThat * 30);
  const daQua = Math.min(soNgay, Math.max(0, soNgayGiua(lenh.tu, homNay)));
  return {
    moiNgay: lamTronNghin(moiNgayThat),
    moiThang,
    phan: dongTien === null ? null : (moiNgayThat * 30) / dongTien.so,
    conNgay: soNgayGiua(homNay, lenh.kyHan),
    nhipKy: daQua === 0 ? null : (daGop - moiNgayThat * daQua) / (moiNgayThat * 30),
  };
}

/** Một dòng của danh mục: vị thế (hũ) + cỡ (nếu đủ điều khoản) + lời đoán còn sống. */
export interface DongDanhMuc {
  hu: Hu;
  co: CoViThe | null;
  ld: LoiDoanHu | null;
  /**
   * Vị thế đang CAM KẾT dòng tiền tháng này: có cỡ và chưa quá kỳ hạn. ⚠ Lệnh quá kỳ hạn (chờ kết toán) đã hết
   * kế hoạch góp — tính nó vào là "vượt dòng tiền" giả. Một chỗ quyết cờ này; thanh chia ở màn đọc chính cờ ấy.
   */
  camKet: boolean;
}

export type MaCauDanhMuc = 'vuot_dong_tien' | 'tap_trung' | 'chua_giu_nguyen';

export interface DanhMuc {
  dongTien: DongTien | null;
  /** Mọi hũ đang chạy / tạm dừng — có cỡ hay chưa. Vị thế có cỡ đứng trước, lớn trước. */
  dong: DongDanhMuc[];
  /** Tổng phần dòng tiền đã cam kết (các vị thế có cỡ). `null` khi chưa biết dòng tiền. */
  daCamKet: number | null;
  /** MỘT câu Oracle (tả, không kê đơn) — hoặc `null`: im lặng là một kết quả hợp lệ. */
  cau: { ma: MaCauDanhMuc; ten?: string; phan?: number; soTich?: number } | null;
}

/**
 * DANH MỤC CỦA THÁNG — các sự thật của D369 §5.3, đọc từ dữ liệu ĐÃ CÓ.
 * ⚠ Câu Oracle chỉ nói khi có đủ vật để nói (bài học Barnum): "tập trung" cần ≥ 2 vị thế có cỡ — một vị thế thì
 *   "chiếm 100 %" đúng với mọi người, tức không nói gì về ai.
 */
export function danhMuc(
  hu: readonly Hu[], so: readonly Khoan[], homNay: string,
  daGopCua: (h: Hu) => number,
): DanhMuc {
  const dongTien = dongTienThang(so, homNay.slice(0, 7));
  const dong: DongDanhMuc[] = hu
    // D421 — danh mục là các vị thế GOM TỚI MỨC; hũ tiêu dùng không có cỡ, không có kỳ hạn.
    .filter((h) => laTichLuy(h) && (h.trangThai === 'dang_chay' || h.trangThai === 'tam_dung'))
    .map((h) => {
      const co = coViThe(h, daGopCua(h), homNay, dongTien);
      return { hu: h, co, ld: loiDoanHuHienHanh(h, homNay.slice(0, 7)), camKet: co !== null && co.conNgay >= 0 };
    });
  /* Thứ tự: đang cam kết (lớn trước) → quá kỳ hạn, chờ kết toán → chưa đủ điều khoản. */
  const hang = (d: DongDanhMuc): number => (d.camKet ? 0 : d.co !== null ? 1 : 2);
  dong.sort((a, b) => hang(a) - hang(b) || (b.co?.moiThang ?? 0) - (a.co?.moiThang ?? 0));
  const coCo = dong.filter((d) => d.camKet);
  const daCamKet = dongTien === null || coCo.length === 0 ? null : coCo.reduce((a, d) => a + (d.co!.phan ?? 0), 0);

  let cau: DanhMuc['cau'] = null;
  const tongThang = coCo.reduce((a, d) => a + d.co!.moiThang, 0);
  if (daCamKet !== null && daCamKet > 1) {
    cau = { ma: 'vuot_dong_tien', phan: daCamKet - 1 };
  } else if (coCo.length >= 2 && tongThang > 0 && coCo[0]!.co!.moiThang / tongThang >= 0.6) {
    cau = { ma: 'tap_trung', ten: coCo[0]!.hu.ten, phan: coCo[0]!.co!.moiThang / tongThang };
  } else if (coCo.length >= 1 && !coCo.some((d) => d.hu.loai === 'du_phong')) {
    cau = { ma: 'chua_giu_nguyen', soTich: coCo.length };
  }
  return { dongTien, dong, daCamKet, cau };
}
