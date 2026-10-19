/**
 * VÍ XU TRÊN MÀN TRẬN (D411). Founder 26/09: *"vàng kia là cái gì? Gộp với xu đi"*.
 *
 * VÀNG là lượt khảo sát lại (đổi bài trong shop), và cái tên ấy trùng mã tài sản Vàng trên bàn. Ở trận gộp ví (v55,
 * server khai `xu_gop`) chỉ còn MỘT ví XU trả cho cả đổi bài shop lẫn cuộn chợ trait.
 *
 * Server là chân lý (C4): trận gộp thì `luot_khao_sat` CHÍNH LÀ ví xu, và server đã trừ các lần đổi bài vào đó khi trả
 * `luot_con_lai`. Client chỉ trừ thêm phần CUỘN CHỢ TRAIT đã xem trong vòng — một con số server gửi (giá cộng dồn) — để
 * khoá nút. Không tự tính luật giá: server vẫn kiểm lại lúc chốt vòng (`thieu_xu`).
 */
export interface BanVi {
  luot_khao_sat: number;
  xu?: number;
  xu_gop?: boolean;
}

/** Nhãn ô ví ở chân màn trận: trận gộp là XU, trận cũ giữ VÀNG. */
export function nhanVi(ban: BanVi): 'XU' | 'VÀNG' {
  return ban.xu_gop === true ? 'XU' : 'VÀNG';
}

/** Xu còn dùng được cho chợ trait trong vòng: ví trừ giá cộng dồn các lần cuộn đã xem. Không âm. */
export function viConLai(ban: BanVi, giaCuonDaXem: number): number {
  const vi = ban.xu_gop === true ? ban.luot_khao_sat : (ban.xu ?? 0);
  return Math.max(0, vi - giaCuonDaXem);
}

/**
 * Ví cho nút ĐỔI BÀI shop và ô ví ở chân màn. Trận gộp: chung ví với chợ trait ⇒ trừ luôn phần đã cuộn. Trận cũ: VÀNG
 * nguyên như trước (chợ trait không tồn tại ở đó).
 */
export function viDoiBai(ban: BanVi, giaCuonDaXem: number): number {
  return ban.xu_gop === true ? Math.max(0, ban.luot_khao_sat - giaCuonDaXem) : ban.luot_khao_sat;
}
