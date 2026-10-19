/**
 * TIỀN của minigame — hàm THUẦN (D465). Test vector chép tay: `tests/minigame_tien.test.ts` (viết trước, A8.3).
 * Mọi đầu ra là số nguyên, luôn floor (C5). Không đọc đồng hồ, không đụng DB.
 */
import { BAN_MANH, EPS_TIEN, HE_SO_LOI, LAI_VAY_PCT, LAI_VAY_QUY_VE_VAY, NEN_GOC, PHI_LS_BP } from '../../../config/minigame.js';

export { HE_SO_LOI, LAI_VAY_PCT, PHI_LS_BP };

/** floor có chặn sai số biểu diễn số thực (xem `EPS_TIEN`). */
export function floorTien(x: number): number {
  return Math.floor(x + EPS_TIEN);
}

/** Lãi lỗ của `tien` vào ở giá `khop`, ra ở giá `ra`, chiều `chieu` (+1 long · −1 short), hệ số `he`. */
export function laiVi(tien: number, khop: number, ra: number, chieu: 1 | -1, he: number): number {
  return floorTien((tien * he * chieu * (ra - khop)) / khop);
}

/** Trần lỗ = cả khoản `von` (+ phần đã nạp nếu lõi có vay). */
export function tranLo(laiTho: number, von: number, napNhan: number): number {
  return Math.max(laiTho, -(von + napNhan));
}

/** Mức lãi vay của màn theo thị trường: nhóm thẻ của mã + dải sức căng. */
export function mucLaiVay(nhom: string, dai: 'em' | 'cang' | 'rat'): number {
  if (nhom === 'tang' || dai === 'rat') return LAI_VAY_PCT.NONG;
  return dai === 'cang' ? LAI_VAY_PCT.CANG : LAI_VAY_PCT.AM_DAM;
}

/**
 * Lãi vay GỘP: `tien` × `phanVay` (số lần khoản đang vay) × ((1 + pct/9 %)^(nenGoc/30) − 1). Giữ trọn 30 nến gốc ở ×10 (vay 9 lần) ⇒ đúng pct% khoản.
 */
export function laiVayGop(tien: number, phanVay: number, pct: number, nenGoc: number): number {
  return floorTien(laiVayTho(tien, phanVay, pct, nenGoc));
}

/** D492 — lãi vay gộp CHƯA floor: chỉ dùng cho NGƯỠNG gọi / thanh lý (so giá), không bao giờ cho tiền. */
export function laiVayTho(tien: number, phanVay: number, pct: number, nenGoc: number): number {
  if (phanVay <= 0 || nenGoc <= 0) return 0;
  const moiMan = pct / 100 / LAI_VAY_QUY_VE_VAY;
  return tien * phanVay * (Math.pow(1 + moiMan, nenGoc / NEN_GOC) - 1);
}

/** Phí Lướt Sóng cho một lần khớp `tien`. */
export function phiKhopLs(tien: number): number {
  return floorTien((tien * PHI_LS_BP) / 10000);
}

/** Hệ số trượt khi BÁN MẠNH theo hệ số đòn bẩy đang cầm `he`; thanh lý thêm ×1,5. */
export function kBanManh(he: number, thanhLy: boolean): number {
  return (1 + BAN_MANH.THEO_HE * Math.max(0, he - HE_SO_LOI)) * (thanhLy ? BAN_MANH.THANH_LY : 1);
}

/** Lõi có mức đòn bẩy riêng — trait đòn bẩy KHÔNG áp lên lõi này (D462, founder 03/10). */
export const LOI_DON_BAY = 'don_bay';
/** D510 — Bán Khống trong màn = Đòn Bẩy CHIỀU BÁN: cùng hàm khớp ký quỹ (`khopDonBay`, chiều −1). */
export const LOI_BAN_KHONG = 'ban_khong';
/** D510 — lõi chơi bằng KÝ QUỸ trong màn (vào ×L · bị gọi · nạp · thanh lý / mua cưỡng bức · lãi vay). */
export const laLoiKyQuy = (loi: string | null | undefined): boolean => loi === LOI_DON_BAY || loi === LOI_BAN_KHONG;

/** Hệ số lãi lỗ của lõi `loi` cầm trait đòn bẩy `traitDb` (1 = không cầm). Lõi Đòn Bẩy dùng mức ×2/×4/×10 riêng, không qua hàm này. */
export function heLoi(loi: string, traitDb: number): number {
  return loi === LOI_DON_BAY ? HE_SO_LOI : HE_SO_LOI * (traitDb || 1);
}

/** Lõi có VAY ⇒ có ký quỹ (gọi nạp / thanh lý): lõi Đòn Bẩy, hoặc lõi khác cầm trait > 1 (D463). */
export function coKyQuy(loi: string, traitDb: number): boolean {
  return loi === LOI_DON_BAY || (traitDb || 1) > 1;
}
