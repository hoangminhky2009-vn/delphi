/**
 * D302 — LỜI cho cú ĐÁM ĐÔNG ĐỔI Ô (luật 03 §3: ẩn ex-ante, LỘ ex-post bắt buộc).
 *
 * Server chỉ gửi ID (`ODoiDTO`: `boi` · `tu` · `den` · `vi`), chữ nằm ở đây (D26)
 * — MỘT nguồn cho bản đồ (tooltip ô đã lật), bảng VÌ SAO (dòng kể) và Hướng
 * dẫn, để ba chỗ không kể ba câu khác nhau về cùng một cơ chế (D61).
 *
 * Giọng: MÔ TẢ, không kê đơn (A10) — nói đám đông đã làm gì và chợ trả lời ra
 * sao, không nói "lần sau đừng dồn".
 */
import type { NhanDTO, ODoiDTO } from '@/api/holdem';

/** Vì sao đám đông đổi được ô — theo `vi` (ID từ engine). */
export const VI_DOI: Record<ODoiDTO['vi'], string> = {
  don: 'cả bàn dồn vào rủi ro hai vòng liền',
  tron: 'cả bàn trốn vào phòng thủ hai vòng liền',
  len: 'phe ngược chuỗi giữ phần lớn vốn bàn, tiền tệ lại cùng phe với chuỗi — chuỗi bị bẻ LÊN',
  xuong: 'phe ngược chuỗi giữ phần lớn vốn bàn, tiền tệ lại cùng phe với chuỗi — chuỗi bị bẻ XUỐNG',
};

/** Nhãn ngắn ghi trên ô đã lật ở bản đồ (ô hẹp — 8 ký tự là trần). */
export const NHAN_O_DOI = 'ĐÃ ĐỔI ↺';

/**
 * Tên một ô theo id — `tu`/`den` có thể là giai đoạn HOẶC sự kiện (phản thân đổi
 * sự kiện sang sự kiện, bẻ chuỗi đổi pha sang pha), nên tra cả hai bảng.
 */
export function tenO(id: string, giaiDoan: readonly NhanDTO[], suKien: readonly NhanDTO[]): string {
  return suKien.find((x) => x.id === id)?.label
    ?? giaiDoan.find((x) => x.id === id)?.label
    ?? id;
}

/** Một câu trọn cho tooltip / dòng VÌ SAO. */
export function moTaODoi(
  d: ODoiDTO, giaiDoan: readonly NhanDTO[], suKien: readonly NhanDTO[],
): string {
  return `Ô này đáng lẽ là "${tenO(d.tu, giaiDoan, suKien)}" — ${VI_DOI[d.vi]}, `
    + `nên chợ lật "${tenO(d.den, giaiDoan, suKien)}".`;
}
