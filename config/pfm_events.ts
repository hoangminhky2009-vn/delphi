/**
 * PFM — DANH SÁCH TRẮNG `value_json` CHO MỖI `events.action_type` HỌ `pfm_*` (K5 🔒).
 *
 * ⚠⚠ ĐÂY LÀ CỬA MỘT CHIỀU. `events` không xoá được (A3.3); K5 🔒 (05b) giới hạn dòng
 * PFM trong đó CHỈ ĐƯỢC mang id + enum — không số tiền, không chữ tự do. Nhờ vậy
 * quyền xoá P9 🔒 và A3.3 (events bất biến) không cắn nhau: sau khi `xoaSachPfm` chạy,
 * dòng còn lại chỉ là "user X từng có một sự kiện nào đó" — vô danh, không đọc ra tiền.
 *
 * Danh sách này là MỘT NGUỒN (D61) cho cả nơi GHI (`server/pfm/*.ts`) lẫn nơi KIỂM
 * (test quét K5, `tests/pfm_nen.test.ts`). Bảy khoá khớp đúng bảy giá trị đã nới vào
 * `events_action_type_check` ở `migrations/0047_pfm.sql` §8.
 *
 * ⚠ Thêm action_type PFM mới: nới CHECK ở migration (đọc-rồi-nối, xem 0047 §8) + thêm
 * một dòng ở đây CÙNG COMMIT. Thiếu một trong hai là DB chặn ngay hoặc field lạ lọt
 * qua im lặng — không có chỗ nào để "quên".
 *
 * ⚠⚠ R9 (D250) — TỆP NÀY GIỜ GIỮ CẢ BA ENUM ĐI VÀO `value_json`.
 * Trước đây `TRANG_THAI_NGAY` nằm ở `server/pfm/api.ts`, `CHUYEN_TIEP` ở
 * `web/src/pfm/hu.ts`, `HANH_DONG_LUAT` ở `web/src/pfm/luat.ts` — ba bản ở ba tầng,
 * và whitelist chỉ nhắc tới chúng bằng CHÚ THÍCH ("`ma` ∈ enum `CHUYEN_TIEP` của
 * `web/src/pfm/hu.ts`"). Một lời hứa bằng chú thích không giữ được gì: sửa enum ở một
 * chỗ thì hai chỗ kia không biết, và cửa kiểm cũng không biết.
 * ⇒ Enum sống Ở ĐÂY, cạnh chính cái cửa kiểm dùng nó. Ba tệp kia RE-EXPORT lại để chỗ
 * gọi không phải đổi tên — re-export là MỘT nguồn, không phải bản sao thứ hai.
 */
import { CUA_PFM } from './pfm_consent.js';

/* ══ BA ENUM ĐI VÀO `value_json` — nguồn duy nhất ═══════════════════════════════ */

/** Trạng thái một ngày điểm danh. `co_ghi` do hệ tự đánh khi user ghi khoản đầu tiên. */
export const TRANG_THAI_NGAY = ['tron', 'khong_tieu', 'tieu_it', 'co_ghi'] as const;
export type MaTrangThaiNgay = (typeof TRANG_THAI_NGAY)[number];

/** Cú CHUYỂN TIẾP của hũ — QUÁ TRÌNH, không phải chỉ trạng thái cuối (file 07 §3.3). */
export const CHUYEN_TIEP_HU = ['tao', 'sua_ten', 'sua_muc_tang', 'sua_muc_giam',
  'doi_han', 'doi_uu_tien', 'tam_dung', 'tiep_tuc', 'xong', 'bo_do', 'mo_lai'] as const;
export type MaChuyenTiepHu = (typeof CHUYEN_TIEP_HU)[number];

/**
 * Hành động trên một luật nếu-thì.
 * ⚠ KHÔNG có `bat`/`tat`: bật/tắt một luật là CẤU HÌNH CỤC BỘ THUẦN, không sinh sự
 * kiện. Thêm hành động mới đòi một migration mới (CHECK ở 0047 §8).
 */
export const HANH_DONG_LUAT = ['dat', 'sua', 'xoa', 'ban', 'giu', 'vo'] as const;
export type MaHanhDongLuat = (typeof HANH_DONG_LUAT)[number];

/* ══ KIỂM GIÁ TRỊ ═══════════════════════════════════════════════════════════════ */

/** Trả `null` nếu hợp lệ, hoặc câu tả CHỖ SAI (đi thẳng vào lỗi 400). */
type Kiem = (v: unknown) => string | null;

/**
 * ⚠ Id chỉ được mang ký tự an toàn và ngắn. Đây không phải thẩm mỹ: `value_json` là
 * cửa DUY NHẤT dữ liệu client đi vào `events` append-only. Một id dài vô hạn hay mang
 * ký tự lạ là chỗ chữ tự do lọt vào một bảng đã hứa "chỉ id + enum" (K5 🔒).
 */
const RE_ID = /^[A-Za-z0-9_-]{1,40}$/;
const RE_NGAY = /^\d{4}-\d{2}-\d{2}$/;

const laEnum = (ds: readonly string[]): Kiem => (v) =>
  typeof v === 'string' && ds.includes(v) ? null : `phải là một trong [${ds.join(', ')}]`;

const laId: Kiem = (v) =>
  typeof v === 'string' && RE_ID.test(v) ? null : 'phải là id khớp ^[A-Za-z0-9_-]{1,40}$';

/**
 * Như `laId` nhưng CHO PHÉP chuỗi rỗng làm dấu "không có".
 * ⚠ Chỉ dùng cho `mau_id`, và đây là một quyết định CÓ CHỦ ĐÍCH đã được khoá bằng test
 * (`web/tests/pfm_luat.test.ts`: *"mau_id rỗng khi không có mẫu — không phải
 * null/undefined"*). Nó KHÔNG phạm luật "thiếu mẫu = null, không phải 0" (A11.2/D62):
 * luật ấy nói về ô SỐ, nơi `0` là một giá trị thật nên không phân biệt được với "trống".
 * `''` thì không bao giờ là một id thật, nên nó là dấu KHÔNG-CÓ không thể đọc nhầm.
 */
const laIdHoacRong: Kiem = (v) =>
  v === '' ? null : laId(v);

const laNgay: Kiem = (v) =>
  typeof v === 'string' && RE_NGAY.test(v) ? null : 'phải là ngày dạng YYYY-MM-DD';

const laMangId = (toiDa: number): Kiem => (v) => {
  if (!Array.isArray(v)) return 'phải là mảng';
  if (v.length > toiDa) return `mảng tối đa ${toiDa} phần tử (đang ${v.length})`;
  const xau = v.findIndex((x) => typeof x !== 'string' || !RE_ID.test(x));
  return xau < 0 ? null : `phần tử [${xau}] không phải id hợp lệ`;
};

/**
 * K5 — mỗi action_type khai ĐỦ các field nó được mang, kèm CÁCH KIỂM GIÁ TRỊ.
 *
 * ⚠⚠ MỌI FIELD KHAI Ở ĐÂY LÀ BẮT BUỘC. Bản trước chỉ chặn field LẠ, nên một
 * `pfm_hu` rỗng `{}` đi lọt xuống `events` — một dòng nói "có chuyện gì đó xảy ra với
 * một cái hũ nào đó", vô dụng và KHÔNG XOÁ ĐƯỢC (A3.3). Ở một bảng append-only, dòng
 * thiếu ruột còn tệ hơn dòng vắng mặt: nó chiếm chỗ và trông như dữ liệu.
 */
export const K5_WHITELIST = {
  /** Bật PFM lần đầu/lại — không mang gì, `pfm_bat_dau` đã đủ để biết "khi nào". */
  pfm_bat: {},
  /**
   * Tắt MỘT CỬA (D295) — mang đúng tên cửa, không mang gì khác. TẮT không xoá dữ liệu
   * (đó là việc của `pfm_xoa`). ⚠ Bản D250 là `{}` (một công tắc); nới thành bốn cửa thì
   * "tắt" phải nói tắt cái nào, nếu không vết rút-lại là vô nghĩa. Chưa có dòng `pfm_tat`
   * nào trên prod (không màn nào bật được PFM trước D295), nên nới field không bỏ rơi vết cũ.
   */
  pfm_tat: { cua: laEnum(CUA_PFM) },
  /** Vết consent contextual (05c §2.1) — CHỨNG MINH đã hiện đúng văn bản, đúng bản. */
  pfm_consent: { van_ban_id: laId, phien_ban: laId },
  /** Điểm danh — chỉ mã trạng thái, không một số tiền nào (K3). */
  pfm_diem_danh: { trang_thai: laEnum(TRANG_THAI_NGAY) },
  /** Chuyển tiếp hũ — `ma` ∈ `CHUYEN_TIEP_HU` ở ngay trên, không nội dung hũ. */
  pfm_hu: { hu_id: laId, ma: laEnum(CHUYEN_TIEP_HU) },
  /** Nhịp luật nếu-thì — enum `hanh_dong`, không câu luật thật (câu luật ở lại máy). */
  pfm_luat: { luat_id: laId, mau_id: laIdHoacRong, hanh_dong: laEnum(HANH_DONG_LUAT) },
  /** Niêm phong tuần — id các mốc đạt được, KHÔNG số token (đúng con số nằm ở sổ cái). */
  pfm_tuan_niem_phong: { tuan: laNgay, moc_ids: laMangId(20) },
} as const satisfies Record<string, Record<string, Kiem>>;

export type PfmActionType = keyof typeof K5_WHITELIST;

export function laActionTypePfmHopLe(a: string): a is PfmActionType {
  return Object.prototype.hasOwnProperty.call(K5_WHITELIST, a);
}

/**
 * ⭐⭐ AI ĐƯỢC PHÁT LOẠI NÀO — CÂU HỎI K5 KHÔNG TRẢ LỜI.
 *
 * `K5_WHITELIST` kiểm **HÌNH** của `value_json`. Nó không biết **AI** đang gọi, và
 * hai câu hỏi ấy khác nhau. Bản đầu của `/pfm/dong-bo` (D251) chỉ hỏi câu thứ nhất, nên
 * một client bất kỳ POST được thẳng `{loai:'nhip', ma:'pfm_consent', v:{…}}` và ghi
 * một **vết đồng ý giả** vào `events` — đúng cái vết mà R1/D250 vừa dựng ra để
 * CHỨNG MINH người dùng đã đọc văn bản nào. Tương tự với `pfm_diem_danh` (bằng
 * chứng của một dòng `pfm_ngay`), `pfm_tuan_niem_phong` (bằng chứng của một cú phát
 * token), `pfm_bat`/`pfm_tat` (bằng chứng của cờ consent).
 * ⇒ Năm loại ấy là **bằng chứng server tự dựng**, ghi CÙNG transaction với chính
 * thay đổi trạng thái đứng sau chúng. Nhận chúng từ dây là biến bằng chứng thành lời
 * khai — trong một bảng **không xoá được** (A3.3).
 *
 * ⚠ Danh sách này là DANH SÁCH CHO PHÉP, không phải danh sách cấm: thêm một
 * `action_type` PFM mới thì mặc định nó KHÔNG tự gửi được, phải cân nhắc rồi mới mở.
 * Mặc định an toàn là mặc định đúng ở một cửa một chiều.
 */
export const NHIP_CLIENT_TU_GUI = ['pfm_hu', 'pfm_luat'] as const satisfies readonly PfmActionType[];

export function clientTuGuiDuoc(a: string): a is (typeof NHIP_CLIENT_TU_GUI)[number] {
  return (NHIP_CLIENT_TU_GUI as readonly string[]).includes(a);
}

/**
 * Kiểm một `value_json` trước khi ghi `events`.
 * Trả `null` nếu hợp lệ; chuỗi lý do nếu action_type lạ, field lạ, THIẾU field bắt
 * buộc, hoặc GIÁ TRỊ sai hình — chuỗi lý do đi thẳng vào lỗi 400 để người gọi biết sai
 * chỗ nào, không phải đoán.
 */
export function kiemValueJsonPfm(actionType: string, valueJson: unknown): string | null {
  if (!laActionTypePfmHopLe(actionType)) return `action_type PFM lạ: ${actionType}`;
  if (typeof valueJson !== 'object' || valueJson === null || Array.isArray(valueJson)) {
    return `${actionType}: value_json phải là object`;
  }
  const spec = K5_WHITELIST[actionType] as Record<string, Kiem>;
  const co = valueJson as Record<string, unknown>;

  for (const k of Object.keys(co)) {
    if (!Object.prototype.hasOwnProperty.call(spec, k)) {
      return `${actionType}: field "${k}" ngoài whitelist K5`;
    }
  }
  for (const [k, kiem] of Object.entries(spec)) {
    if (!Object.prototype.hasOwnProperty.call(co, k)) {
      return `${actionType}: thiếu field bắt buộc "${k}"`;
    }
    const loi = kiem(co[k]);
    if (loi) return `${actionType}.${k}: ${loi}`;
  }
  return null;
}
