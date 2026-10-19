/**
 * BONG BÓNG ORACLE — đầu chat + bong bóng có đuôi. MỘT NGUỒN cho mọi chỗ Oracle lên tiếng
 * (D365: GĐ B thêm ba chỗ nữa; trước đó bản duy nhất nằm trong `NgayDau.module.css`).
 *
 * ⚠ Chỉ là VỎ. Nó không quyết định khi nào Oracle nói — mỗi chỗ gọi tự hỏi hàm thuần của
 * mình (`quyDoiMon` · `deNghiMauLap` · `tienToiNgay`), và chữ đến từ `lib/pfm_chu.ts` (D26).
 */
import type React from 'react';
import { Mascot } from '@/components/Mascot';
import s from './BongOracle.module.css';

export function BongOracle(
  { nhan, loi, phu, children }: {
    /** Nhãn trên bong bóng — thường là `ORACLE`, có thể kèm `<em>` cho phần phụ. */
    nhan: React.ReactNode;
    /** Câu chính. */
    loi: React.ReactNode;
    /** Dòng "vì sao thấy câu này" — không bắt buộc. */
    phu?: React.ReactNode;
    /** Nút / khối số nằm trong bong bóng. */
    children?: React.ReactNode;
  },
): React.ReactElement {
  return (
    <div className={s.orc}>
      <span className={s.orcDau}><Mascot size={44} /></span>
      <div className={s.orcBong}>
        <p className={s.orcNhan}>{nhan}</p>
        <p className={s.orcLoi}>{loi}</p>
        {phu}
        {children}
      </div>
    </div>
  );
}
