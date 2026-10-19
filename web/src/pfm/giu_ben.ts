/**
 * XIN TRÌNH DUYỆT GIỮ KHO LÂU DÀI (`navigator.storage.persist()`) — D603, SPEC `cai-app-pfm-trong-ban-cai`.
 *
 * ⚠ Sổ PFM CHỈ nằm trên máy (P2 🔒). Không xin thì kho ở chế độ "dọn được khi cần": Android dọn khi máy đầy, Safari xoá
 * dữ liệu web của trang không dùng 7 ngày (bản cài được miễn). Xin không có nghĩa là được — trình duyệt tự quyết (Chrome
 * thường cho bản đã cài / trang hay dùng) — nên KẾT QUẢ được đếm (telemetry `pfm_kho_ben`), không đoán.
 *
 * ⚠ Không bao giờ ném: đây là lớp bảo vệ thêm, hỏng thì kho vẫn chạy như trước.
 */
export type KetQuaGiuBen = 'da_ben' | 'duoc' | 'khong' | 'khong_ho_tro' | 'loi';

export async function xinGiuBen(): Promise<KetQuaGiuBen> {
  try {
    const st = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!st || typeof st.persist !== 'function') return 'khong_ho_tro';
    if (typeof st.persisted === 'function' && await st.persisted()) return 'da_ben';
    return (await st.persist()) ? 'duoc' : 'khong';
  } catch {
    return 'loi';
  }
}
