/**
 * NHÃN CHƯƠNG HỒI — một dòng trên Bản đồ thị trường (doc 06 §2, món 1).
 *
 * Mỏng có chủ ý: toàn bộ luật nằm ở `lib/chuong_hoi.ts` (thuần, test không cần
 * React); đây chỉ là chỗ vẽ. Đổi vòng thì chương có thể đổi — `data-chuong` để
 * CSS nhuộm theo hồi mà không nhét màu vào logic.
 *
 * ⚠ Không emoji (D47 — màn trận cấm icon hệ điều hành), không đồng hồ, không
 * animation: chương là BỐI CẢNH, không phải cảnh báo. Nó phải đứng yên cho
 * người ta liếc, không được tranh chú ý với đồng hồ và viền gấp giờ (D77).
 */
import type { ODTO } from '@/api/holdem';
import { chuongHoi } from '@/lib/chuong_hoi';
import s from './ChuongHoi.module.css';

interface Props {
  lichSuO: readonly ODTO[];
  oHienTai: ODTO | null | undefined;
  xuHuong: { huong: number; dai: number } | null | undefined;
  moiTruong: 're' | 'trung_tinh' | 'dat' | undefined;
  /**
   * Bản GỌN — chỉ TÊN hồi, không nhãn "HỒI", không câu mô tả (founder 23/08).
   *
   * ⚠ Câu mô tả không bị bỏ vì "dài dòng" mà vì nó ĐANG HỎNG: ở 375px nó bị cắt
   * cụt giữa chừng ("chưa thành chuyệ…"), và một câu kể chuyện đọc không hết thì
   * không kể được gì — nó chỉ còn tốn một hàng. Tên hồi thì ngắn, đọc trọn, và
   * tự nó đã là nhãn trạng thái chợ.
   * ⚠ `role="status"` GIỮ ở cả hai bản: đổi hồi là một tin, và người dùng trình
   * đọc màn hình phải nghe được nó dù chữ có ngắn đi.
   */
  gon?: boolean;
}

export function ChuongHoi({ lichSuO, oHienTai, xuHuong, moiTruong, gon = false }: Props) {
  const ch = chuongHoi(lichSuO, oHienTai, xuHuong, moiTruong);
  return (
    <div
      className={`${s.hoi} ${gon ? s.gon : ''}`}
      data-chuong={ch.id}
      role="status"
      {...(gon ? { 'aria-label': `Hồi ${ch.ten} — ${ch.phu}` } : {})}
    >
      {!gon && <span className={s.nhan}>HỒI</span>}
      <span className={s.ten}>{ch.ten}</span>
      {!gon && <span className={s.phu}>{ch.phu}</span>}
    </div>
  );
}
