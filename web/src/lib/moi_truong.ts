/**
 * NỀN BÀN THẺ ĐỔI THEO XU HƯỚNG (D442, founder 27/09 tối).
 *
 * Tester khó đọc ra "chợ đang ở đoạn nào của chu kỳ" khi nhìn cả màn ⇒ mặt bàn chứa dải ô thành nền trạng thái:
 *   · ĐI NGANG — xám kim loại, TĨNH hoàn toàn (không hạt, không sáng, không chuyển động);
 *   · ĐI LÊN   — họ màu của lá HẠ LÃI SUẤT (họ `len`), vệt lóe lướt qua mỗi chu kỳ + quầng viền thở, độ mờ 15–20 %;
 *   · ĐI XUỐNG — họ màu của lá GIẢM (họ `xuong`), ánh lửa bập bùng ở chân và hai góc + hạt tro siêu nhỏ bay chậm lên.
 * Đổi trạng thái: 0,5 s ease-in-out (`NHIP.MT_DOI`).
 *
 * ⚠ NGUỒN TRẠNG THÁI = `xu_huong` CÔNG KHAI (server suy từ các ô ĐÃ NGỬA — không từ ô úp, không từ MÙA ẨN của bánh xe:
 * mùa là biến LATENT, gửi nó ra màn là một quyết định thiết kế khác, xem `TrangThaiO.mua`). `xu_huong` null = chuỗi
 * chưa đủ ngưỡng hoặc đang đi ngang/biến động ⇒ ĐI NGANG. Nền chỉ tả chợ đã đi thế nào, không nói nên làm gì (A10).
 */

export type MoiTruong = 'ngang' | 'len' | 'xuong';

export function moiTruongCua(xuHuong: { huong: number } | null | undefined): MoiTruong {
  if (!xuHuong || xuHuong.huong === 0) return 'ngang';
  return xuHuong.huong > 0 ? 'len' : 'xuong';
}

/**
 * HẠT TRO — bảng CỐ ĐỊNH (tất định: mọi máy thấy cùng một làn tro, ảnh chụp so được). `x` = % bề ngang bàn,
 * `tre` = phần của một chu kỳ `NHIP.MT_TRO` đi trễ (0–1, rải đều để luôn có vài hạt đang bay), `co` = cạnh hạt (px)
 * — siêu nhỏ theo đặc tả, 1–2 px, vẽ vuông (pixel), không tròn.
 */
export const HAT_TRO: readonly { x: number; tre: number; co: 1 | 2 }[] = [
  { x: 6, tre: 0.00, co: 2 }, { x: 15, tre: 0.46, co: 1 }, { x: 23, tre: 0.18, co: 2 }, { x: 32, tre: 0.73, co: 1 },
  { x: 41, tre: 0.31, co: 2 }, { x: 50, tre: 0.88, co: 1 }, { x: 58, tre: 0.09, co: 1 }, { x: 66, tre: 0.57, co: 2 },
  { x: 75, tre: 0.24, co: 1 }, { x: 83, tre: 0.66, co: 2 }, { x: 92, tre: 0.40, co: 1 },
];
