/**
 * D533 — hai chỗ màn trận từng LỆCH server (founder 06/10, ảnh vòng 1: chọn lõi + mua crypto + chốt ⇒ màn chỉ xem, rồi bàn kẹt, khoá hết nút).
 *
 * 1. QUẦY ĐÃ ĐỔI. GET trạng thái luôn bày quầy LƯỢT 0; cú ĐỔI LÕI trả quầy lượt k. Mọi lần áp trạng thái mới (đồng bộ lại · trận mới chưa có
 *    trạng thái cục bộ) phải đè lại quầy lượt k. Không đè thì lá hiện ra là của lượt 0 trong khi cú nộp gửi `khao_sat_lai: k` ⇒ server đọc lõi trên
 *    quầy lượt k và bỏ qua lõi không có ở đó (luật một nguồn trong replay — không lỗi, không báo) ⇒ vào màn với `la: null`, không nút nào.
 * 2. HỎI LẠI KHI CHỜ MÀN. Trạng thái chờ màn (`cho_man`) không có đồng hồ. Trước đây web chỉ hỏi lại khi người chơi ĐÓNG lớp màn, mà hỏi bằng
 *    `refetch` của query — không đè được trạng thái cục bộ ⇒ bàn đứng ở vòng vừa nộp, CHỐT VÒNG mờ, vòng sau bị server chốt hộ. Nay server báo
 *    `het_ms` (còn bao lâu màn hết) và web tự hỏi lại đúng lúc đó, bằng đường đồng bộ lại (đè trạng thái cục bộ).
 */

/** Quầy lượt k của một vòng (câu trả lời `GET /shop?lan=k`). */
export interface QuayDoi<S> { vong: number; shop: S; luot: number }

/** Đè quầy đã đổi lên trạng thái CÙNG vòng; khác vòng (vòng đã tiến) ⇒ trả nguyên. */
export function apQuayDoi<S, T extends { vong: number; shop: S | null; ban: { luot_khao_sat: number } }>(st: T, q: QuayDoi<S> | null): T {
  return q && q.vong === st.vong ? { ...st, shop: q.shop, ban: { ...st.ban, luot_khao_sat: q.luot } } : st;
}

/** Đệm sau mốc hết màn (đồng hồ hai máy lệch) · khoảng tối thiểu giữa hai lần hỏi · hỏi lại sau bấy nhiêu khi server không báo mốc. */
export const CHO_MAN_DEM_MS = 800, CHO_MAN_TOI_THIEU_MS = 1500, CHO_MAN_MAC_DINH_MS = 5000;

/** Mốc tuyệt đối (ms) màn hết, đóng dấu LÚC NHẬN trạng thái. `het_ms` vắng ⇒ coi như hết sau `CHO_MAN_MAC_DINH_MS` (thành hỏi lại định kỳ). */
export function mocHetMan(hetMs: number | undefined, nhanLuc: number): number {
  return nhanLuc + (hetMs !== undefined && Number.isFinite(hetMs) ? Math.max(0, hetMs) : CHO_MAN_MAC_DINH_MS);
}

/** Chờ bao lâu (ms, tính từ `bay`) rồi hỏi lại trạng thái — không dưới `CHO_MAN_TOI_THIEU_MS` để server lệch vài trăm ms không thành vòng hỏi dồn. */
export function choHoiLai(moc: number, bay: number): number {
  return Math.max(CHO_MAN_TOI_THIEU_MS, moc - bay + CHO_MAN_DEM_MS);
}

/** Lỗi mở màn đáng TỰ THỬ LẠI: rớt mạng / hết hạn chờ (status 0) hoặc máy chủ hỏng (5xx). Lỗi có mã nghiệp vụ (không cầm mã, vòng đã qua…) thì thôi. */
export function nenThuLaiMoMan(status: number | undefined): boolean {
  return status === undefined || status === 0 || status >= 500;
}
