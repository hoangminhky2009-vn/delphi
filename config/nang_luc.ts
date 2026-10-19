/**
 * THẺ NĂNG LỰC TỰ ĐỘNG (D323) — ba năng lực chấm theo ĐỀ (một trận), gộp qua
 * mọi trận đã xong thành thẻ theo NGƯỜI. Danh mục + ngưỡng nháp ở
 * `docs/yeu-cau-ky-thuat/10-buoi-do-va-thang-nang-luc.md` §3.3 (bảng ánh xạ
 * NĂNG LỰC → MÃ ĐO) — file này là bản CHỐT của cột "mã đo đã có", không phải
 * bản sao (A11.5): đổi ngưỡng thì sửa Ở ĐÂY, không sửa lại con số trong doc.
 *
 * ─── BA BẬC LÀ BẰNG CHỨNG, KHÔNG PHẢI ĐIỂM ─────────────────────────────────
 * `chua_gap` và `gap_chua_vung` tách nhau vì lý do ĐO, không phải hai mức độ
 * gần nhau: một cái nói "đề này không mở cửa ấy" (không phải lỗi người chơi),
 * cái kia nói "có cửa mà đi qua chưa vững". Trộn hai cái là bịa ra bằng chứng
 * từ chỗ chưa từng có cơ hội — đúng lớp lỗi A11.2 (null ≠ 0) nhưng ở tầng suy
 * luận thay vì tầng cột DB.
 *
 * `chung_minh` CHỈ tồn tại ở thẻ theo NGƯỜI (không ở thẻ theo trận,
 * `NangLucTran.bac` cố ý loại nó ra bằng kiểu — xem `nang_luc_ids.ts`): một lần
 * `lam_duoc` có thể là may (một seed, một cấu hình bàn cụ thể); phải lặp lại ở
 * MỘT ĐỀ KHÁC SEED mới gọi là năng lực đã test-retest được — đúng tinh thần
 * §3.3 "bậc cao nhất định nghĩa bằng chính test-retest".
 *
 * Danh mục hiện tại (N1·N2·N3 trong bảng §3.3, founder chọn 13/09 vì cả ba đều
 * đã có mã đo chạy trên prod + mốc bot để hiệu chuẩn): giữ cam kết tiết kiệm ·
 * đọc tin & hiệu chỉnh niềm tin · phân tán rủi ro. N4–N7 để dành Vòng 2.
 *
 * `KHUNG_NGOAI` chỉ chở MÃ (OECD/INFE Core Competencies for Youth · mã bài
 * GDKT&PL) — câu chữ hiển thị sống ở client, cùng luật D26/A10 "server trả ID
 * + SỐ, chữ ở client".
 */
import { NGUONG_TINH_CACH } from '../server/holdem/insight.js';

export const NANG_LUC_IDS = ['cam_ket_tiet_kiem', 'doc_tin', 'phan_tan'] as const;
export type NangLucId = (typeof NANG_LUC_IDS)[number];
export const BAC_NANG_LUC = ['chua_gap', 'gap_chua_vung', 'lam_duoc', 'chung_minh'] as const;

/**
 * D396 — NĂNG LỰC ĐANG ẨN khỏi mọi mặt người đọc (màn kết · thẻ theo người · trang nhóm). VẪN CHẤM, vẫn nằm
 * trong dữ liệu (`hanh_vi_vong.brier`, tệp xuất); chỉ không trả ra khỏi máy chủ — bản web cũ trong cache
 * cũng không hiện được (cùng lý lẽ D370 giữ thẻ tới Phiếu 2).
 *
 * `doc_tin` (N2) — thước thưởng người DỒN một mã, phạt người CHIA giỏ. Hai người cùng đoán đúng mã thắng ở
 * 70% số vòng: chia đôi hai mã ⇒ Brier TB 0,7×0,5 + 0,3×1,5 = 0,80 ⇒ "chưa vững"; dồn một mã ⇒ 0,7×0 + 0,3×2
 * = 0,60 ⇒ "làm được". Tức nó đo cách chia giỏ chứ không đo đọc tin — và đá nhau với N3 (phân tán). Cách chấm
 * còn lấy MỌI vòng, trong khi đặc tả §3.3 chỉ lấy vòng có tin. Founder chốt 24/09: buổi đo này ẩn, đổi thước sau.
 * GỠ KHI: thước N2 viết lại theo §3.3 (chỉ vòng có tin thật, so với "chia đều không đọc tin" cùng số mã), hiệu
 * chuẩn bằng `hieu_chuan_null`, founder chốt — rồi xoá id khỏi mảng này (bài canh trang nhóm tự theo).
 */
export const NANG_LUC_AN: readonly NangLucId[] = ['doc_tin'];

/** Năng lực được trả ra ngoài — MỘT nguồn cho mọi cửa ra (A11.5). */
export const NANG_LUC_HIEN: readonly NangLucId[] = NANG_LUC_IDS.filter((id) => !NANG_LUC_AN.includes(id));

/** Lọc một danh sách theo `id` còn những năng lực được trả ra ngoài. */
export function chiNangLucHien<T extends { id: string }>(ds: readonly T[]): T[] {
  return ds.filter((x) => !(NANG_LUC_AN as readonly string[]).includes(x.id));
}
export type BacNangLuc = (typeof BAC_NANG_LUC)[number];

/** ⏳ PLAYTEST-TUNE — founder duyệt làm SỐ KHỞI ĐẦU 13/09 (A8.2); đo lại bằng hieu_chuan_null trước khi tin. */
export const NGUONG_NANG_LUC = {
  DOC_TIN: {
    N_BRIER_TOI_THIEU: 4,
    SU_KIEN_TOI_THIEU: 2,
    /*
     * = NGUONG_TINH_CACH.BAC_DOC.DANG_HOC (insight.ts), ĐỌC LẠI chứ không chép
     * số: hai chỗ cùng nói "Brier dưới đây là còn đang học" phải là MỘT con số,
     * đổi một nơi cả hai theo — hai bản chép tay của cùng một ngưỡng là hai bản
     * sẽ trôi (D61/A11.5).
     */
    BRIER_LAM_DUOC: NGUONG_TINH_CACH.BAC_DOC.DANG_HOC,
  },
  PHAN_TAN: { VONG_VI_THE_TOI_THIEU: 3, TY_LE_VONG_LAM_DUOC: 0.5, SO_NHOM_TOI_THIEU: 2 },
  CHUNG_MINH_SO_DE: 2,
} as const;

/** Bản công thức chấm — trả trong DTO; đổi cách chấm ⇒ tăng. Khai ở `config/phien_ban.ts` như `HANH_VI_FORMULA_VERSION`. */
// D436 — 1 → 2: trận có hệ trait (v55) không vào LỌC TIN.
export const NANG_LUC_FORMULA_VERSION = 2;

/** Khung ngoài — chỉ MÃ (tên tiếng Việt ở client, D26). */
export const KHUNG_NGOAI: Record<NangLucId, { oecd: 'lap_ke_hoach' | 'rui_ro_phan_thuong' | 'boi_canh'; gdkt: readonly string[] }> = {
  cam_ket_tiet_kiem: { oecd: 'lap_ke_hoach', gdkt: ['ke_hoach_tai_chinh_ca_nhan_10'] },
  doc_tin: { oecd: 'boi_canh', gdkt: [] },
  phan_tan: { oecd: 'rui_ro_phan_thuong', gdkt: [] },
};
