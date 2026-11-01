/**
 * D609 (founder 13/10: "chọn lõi là bắt buộc, không pick thì server pick hộ; màn hình tự hiện") — hai cổng THUẦN của màn trận, tách ra để test được.
 *
 *  · `loiMoiChuaCam` / `laLuotLoiBatBuoc`: vòng có quầy lõi mà quầy còn lá CHƯA cầm và người chơi chưa chọn ⇒ shop tự mở, CHỐT bị chặn. Cùng điều kiện với
 *    `loiChonHo` ở server (`holdem_api.ts`: hết giờ mà chưa chọn ⇒ server chọn hộ lá đầu quầy chưa cầm) — hai đầu phải nói cùng một câu.
 *  · `canHoiLoiCuaMan`: vòng có màn minigame + cầm ≥ 2 lõi + chưa nói rõ ⇒ hộp `ChonLoiMan`. Chỉ khoá `loi_chon_truoc` (lõi chọn lúc chốt); bàn tập có Oracle dẫn riêng.
 */

/** Lá đầu quầy mà ghế chưa cầm — `undefined` nếu quầy trống hoặc đã cầm hết (đủ lõi / không phải lượt lõi: server đã lọc quầy). */
export function loiMoiChuaCam(quay: readonly string[] | undefined, dangCam: readonly string[]): string | undefined {
  return quay?.find((id) => !dangCam.includes(id));
}

export function laLuotLoiBatBuoc(a: {
  tap: boolean; loiChonTruoc: boolean; loaiVong: string; daChonVongNay: boolean; loiMoi: string | undefined;
}): boolean {
  return !a.tap && a.loiChonTruoc && a.loaiVong === 'chien_thuat' && !a.daChonVongNay && a.loiMoi !== undefined;
}

export function canHoiLoiCuaMan(a: {
  tap: boolean; loiChonTruoc: boolean; lichMan: readonly number[]; vong: number; soLoiCoThe: number; daNoiRo: boolean;
}): boolean {
  return !a.tap && a.loiChonTruoc && a.lichMan.includes(a.vong) && a.soLoiCoThe >= 2 && !a.daNoiRo;
}
