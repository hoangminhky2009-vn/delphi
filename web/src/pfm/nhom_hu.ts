/**
 * PFM — HAI LOẠI HŨ (D421 — founder 26/09: *"hũ chia thành 2 loại là hũ tích lũy và hũ tiêu dùng nhé, để chia thu chi
 * cho dễ"*; câu đóng chốt cùng ngày: hũ tiêu dùng chứa PHIẾU CHI).
 *
 *   · `tich_luy` — gom tới một mức: nhận TIỀN CÒN LẠI (tờ ở khay · gõ số · quy tắc tự chia), rút ra được. Là VỊ THẾ
 *     (kỳ hạn · lời đoán · quyết toán) và là loại DUY NHẤT vào gói kỳ rời máy.
 *   · `tieu_dung` — chỗ THẢ PHIẾU CHI buổi tối: không giữ tiền, chỉ đếm tiền ĐÃ TIÊU trong tháng (`so.ts`
 *     §`daTieuTrongThang`) so với mức tháng người dùng tự đặt (để trống được). Không kỳ hạn, không lời đoán, không quyết
 *     toán, không quy tắc tự chia, không rời máy.
 *
 * ⚠ Loại chọn MỘT LẦN lúc tạo, không đổi được (`hu.ts` §`sua`): một khoản CHI nối vào hũ là "góp" ở hũ tích lũy (góp cũ
 *   ghi ở SỔ trước D410) và là "tiêu từ" ở hũ tiêu dùng — đổi loại là đổi nghĩa mọi khoản đã nối, im lặng.
 * ⚠ Tệp LÁ, chỉ nhập KIỂU từ `hu.ts`: `vi_the.ts` cần cửa này mà `hu.ts` đã nhập hàm của `vi_the.ts` — để cửa ở `hu.ts`
 *   là dựng một vòng nhập lúc chạy.
 */
import type { Hu } from './hu.js';

export const NHOM_HU = ['tich_luy', 'tieu_dung'] as const;
export type NhomHu = (typeof NHOM_HU)[number];

/** MỘT cửa cho câu "hũ này loại gì". Vắng = tích lũy — xem `Hu.nhom`. */
export function nhomCua(hu: Hu): NhomHu {
  return hu.nhom ?? 'tich_luy';
}

export function laTieuDung(hu: Hu): boolean {
  return hu.nhom === 'tieu_dung';
}

/**
 * ⚠ Mọi phép tính của hũ GOM TỚI MỨC (danh mục · vị thế · lời đoán · cuối kỳ · gói rời máy · quy tắc tự chia · Oracle
 *   "còn thiếu") lọc qua đây. Hũ tiêu dùng không có "đã góp", không có "còn thiếu": để nó lọt vào là mức tháng của bữa ăn
 *   được cộng vào "mức muốn gom", và một hũ ăn uống bị hỏi "tháng ấy gom tới đâu".
 */
export function laTichLuy(hu: Hu): boolean {
  return !laTieuDung(hu);
}
