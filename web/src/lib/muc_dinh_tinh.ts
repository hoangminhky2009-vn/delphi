/**
 * MỨC ĐỊNH TÍNH → chữ + ký hiệu + lớp màu. Thang 5 bậc, đối xứng quanh "trung tính".
 *
 * Tách khỏi `components/holdem/TheGiaiThich.tsx` ngày 14/09 (D334): bách khoa vẽ bảng đòn của thẻ tin bằng CÙNG
 * thang với tờ (!) trong trận — hai bản nhãn là hai bản sẽ trôi (A11.5). Đây là trình bày thuần: không số, không
 * chạm luật. Con số bp đã bị cắt ở server (tu_dien.ts) trước khi tới đây.
 */
import type { MucDinhTinhDTO } from '@/api/holdem';

export const MUC_DINH_TINH: Record<MucDinhTinhDTO, { chu: string; dau: string; lop: 'tot2' | 'tot1' | 'trung' | 'xau1' | 'xau2' }> = {
  rat_tot: { chu: 'rất khoẻ', dau: '▲▲', lop: 'tot2' },
  tot: { chu: 'khoẻ', dau: '▲', lop: 'tot1' },
  trung_tinh: { chu: 'trung tính', dau: '–', lop: 'trung' },
  xau: { chu: 'yếu', dau: '▼', lop: 'xau1' },
  rat_xau: { chu: 'rất yếu', dau: '▼▼', lop: 'xau2' },
};
