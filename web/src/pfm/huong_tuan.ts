/**
 * PFM — TẤM HƯỚNG, PHẦN NHẸ (D453): tuần · bản ghi lựa chọn · "tuần này đang theo hướng nào".
 *
 * ⚠ Tách khỏi `huong.ts` vì màn SỔ cần đúng câu hỏi "tuần này có đang theo hướng nào không" (hàng bàn giao) — mà
 *   `huong.ts` kéo theo bản tin, khung, biểu đồ. SỔ là màn mở nhiều nhất (`so_goi_nhe.test.ts`): nó chỉ nhập tệp này.
 *   `huong.ts` xuất lại mọi thứ ở đây — một nguồn, hai cửa.
 * ⚠ Hàm THUẦN; kiểu từ các tệp nặng chỉ nhập bằng `import type` (xoá khi biên dịch, không kéo mã theo).
 */
import type { KieuTuDong, NhomHu } from './hu.js';
import type { MaDieuKien } from './luat.js';
import type { KhungXet, MaHoTro } from './phong_cach.js';
import { congNgay, thuTrongTuan } from './thoi_gian.js';

/**
 * Mã một hướng. HAI MÔ HÌNH sống chung trong `HoSo.huong` (chỉ nối thêm — lịch sử không bị ghi đè):
 *   · MỚI (founder 11/10, câu B — mô hình DEMO bản 6): `uu_tien_hu` (ưu tiên MỘT hũ của chính bạn tuần này; `huId` trỏ hũ) ·
 *     `giu_nhu_cu` (không đổi gì). Sinh từ HŨ THẬT của người dùng — xem `huong_hu.ts`.
 *   · CŨ (D453): các bước dựng của `hoTroDung` (trừ CHỐT SỔ TUẦN) + CHỌN KHUNG. Không còn ai GHI mã cũ, nhưng bản ghi đã lưu phải
 *     ĐỌC được (đếm `huong_giu`, dải TUẦN TRƯỚC) — nên kiểu vẫn giữ.
 */
export type MaHuong = Exclude<MaHoTro, 'chot_tuan'> | 'chon_khung' | 'uu_tien_hu' | 'giu_nhu_cu';

/** Thứ Hai của tuần chứa `ngay` (tuần người Việt bắt đầu từ thứ Hai — `thuTrongTuan`). */
export function dauTuan(ngay: string): string {
  return congNgay(ngay, -thuTrongTuan(ngay));
}

/** Chủ nhật của tuần bắt đầu ở `tuan`. */
export function cuoiTuan(tuan: string): string {
  return congNgay(tuan, 6);
}

/** Một lần người dùng chạm vào một hướng. CHỈ NỐI THÊM — lựa chọn cũ là lịch sử (đếm `huong_giu`), không bị ghi đè. */
export interface LuaChonHuong {
  /** Thứ Hai của tuần chạm. */
  tuan: string;
  khoa: string;
  ma: MaHuong;
  /** `theo` = chọn theo · `bo` = "không phải tôi" · `thoi` = bỏ chọn (không tính là gạt). */
  kieu: 'theo' | 'bo' | 'thoi';
  /** Lúc chạm (ISO, máy người dùng). */
  luc: string;
  /** Đích — đủ để CHẤM mà không cần giữ bản sao bước dựng. */
  huId?: string;
  dk?: MaDieuKien;
  nhom?: NhomHu;
  td?: KieuTuDong;
  khung?: KhungXet;
}

/**
 * Hướng ĐANG THEO của tuần `tuan`: lựa chọn `theo` cuối cùng của tuần ấy, trừ khi sau nó có một `thoi` hoặc một `bo`
 * trên cùng khoá. Mỗi tuần nhiều nhất một hướng — chọn hướng khác là thay.
 */
export function huongTuan(ds: readonly LuaChonHuong[], tuan: string): LuaChonHuong | null {
  let ra: LuaChonHuong | null = null;
  for (const lc of ds) {
    if (lc.tuan !== tuan) continue;
    if (lc.kieu === 'theo') ra = lc;
    else if (lc.kieu === 'thoi' || (lc.kieu === 'bo' && ra?.khoa === lc.khoa)) ra = null;
  }
  return ra;
}
