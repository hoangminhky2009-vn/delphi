/**
 * PFM — TRẠNG THÁI SỔ CHO LỘ TRÌNH (D325). Thuần: vào sổ + hũ + hồ sơ, ra vài sự thật TẢ được.
 *
 * ⚠⚠ VÌ SAO CÓ TỆP NÀY: tới D325 lộ trình ghép khối CHỈ từ sáu câu phỏng vấn — người đã mở
 * ba hũ và người chưa mở hũ nào nhận cùng một chặng 1, chỉ vì họ chạm cùng chip. Lộ trình
 * "cá nhân hoá" mà không nhìn sổ là cá nhân hoá lời khai, không phải hoàn cảnh.
 *
 * ⚠ A10 🔒 — mỗi trường ở đây là một SỰ THẬT ĐẾM ĐƯỢC, không phải một đánh giá. "Không có hũ
 * dự phòng nào đang mở" là tả; "bạn thiếu quỹ dự phòng" là phán. Chữ nằm ở `lo_trinh.ts`.
 * ⚠ P7/D62 — không đủ căn cứ thì nói `chua_ro`, không đoán một giá trị đẹp.
 *
 * ⚠ BẢN BRIEF CÓ `ty_le_tien_co_dich` (góp vào hũ / thu 30 ngày) — CỐ Ý BỎ: không khối nào đọc
 * nó. Một trường tính mà không ai đọc là đúng họ "luật rỗng" D291 vừa trả giá ở `dongGoiKy`.
 * Khối nào cần thì thêm cùng lượt với khối ấy.
 */
import type { HoSo } from './ho_so.js';
import { laTichLuy, type Hu } from './hu.js';

export interface TrangThaiTaiChinh {
  /** Có ít nhất một hũ ĐANG MỞ (chạy/tạm dừng) mang nhãn `du_phong`. */
  co_hu_du_phong: boolean;
  /**
   * Số hũ đang mở cùng hạn NGẮN (`han = 'ngan'`, dưới 3 tháng).
   * ⚠ Brief viết "cùng hạn trong một tháng" — nhưng `Hu` không có ngày đích, chỉ có dải hạn
   * (`ngan · vua · dai`). Đếm theo dải là thứ DUY NHẤT sổ nói được mà không bịa ngày.
   */
  hu_han_ngan: number;
  /** Nhịp tiền vào, từ nhãn câu 2 (`HoSo.deu`). */
  nhip_thu: 'deu' | 'that_thuong' | 'chua_ro';
}

/* D421 — trạng thái tài chính đếm hũ GOM TỚI MỨC (dự phòng · hạn ngắn); hũ tiêu dùng không có hạn, không phải quỹ. */
const dangMo = (h: Hu): boolean => laTichLuy(h) && (h.trangThai === 'dang_chay' || h.trangThai === 'tam_dung');

/**
 * Nhãn câu 2 → nhịp. ⚠ Nhãn lạ (bản app sau đổi chữ chip) ⇒ `chua_ro`, không đoán: gợi ý
 * khung dựa trên nhịp, và đoán sai nhịp là hỏi thử một khung ngược hoàn cảnh.
 */
export function nhipThuTuNhan(deu: string | undefined): TrangThaiTaiChinh['nhip_thu'] {
  if (deu === 'đều mỗi tháng') return 'deu';
  if (deu === 'thất thường' || deu === 'theo mùa') return 'that_thuong';
  return 'chua_ro';
}

export function trangThaiTaiChinh(hu: readonly Hu[], hoSo: HoSo): TrangThaiTaiChinh {
  const mo = hu.filter(dangMo);
  return {
    co_hu_du_phong: mo.some((h) => h.loai === 'du_phong'),
    hu_han_ngan: mo.filter((h) => h.han === 'ngan').length,
    nhip_thu: nhipThuTuNhan(hoSo.deu),
  };
}
