/**
 * PFM — HƯỚNG TUẦN TỚI, MÔ HÌNH DEMO BẢN 6 (founder 11/10, câu B): MỘT lựa chọn mỗi tuần, sinh từ HŨ THẬT của người dùng.
 *
 * Demo: lớp "HƯỚNG · học trên quyết định của bạn" có ba nút một chạm — "GIỮ QUỸ DỰ PHÒNG TRƯỚC · DỒN CHO LAPTOP · GIỮ NHƯ CŨ" —
 * chọn một thì đánh dấu ●; ô HƯỚNG ở SỔ đọc lại: "Giữ quỹ dự phòng trước — làm đúng 3/4 lần". Tệp này là phần thuần của mô hình ấy:
 *   1. `phuongAnTuan`  — ba phương án: hai hũ TIẾT KIỆM đang chạy đầu tiên THEO ĐÚNG THỨ TỰ MÀN HŨ (`sapXep`: hũ đeo sao trước) + GIỮ NHƯ CŨ.
 *   2. `luaChonTuPhuongAn` — bản ghi lựa chọn nối vào `HoSo.huong` (cùng danh sách với mô hình cũ, chỉ thêm hai mã).
 *   3. `lanLamUuTien`   — "làm đúng k/n lần": n = số NGÀY (từ lúc chọn tới hết tuần / hôm nay) có ít nhất một cú chia tiền vào hũ nào đó,
 *      k = số ngày trong đó hũ ĐÃ CHỌN nhận một cú. Chỉ ĐẾM cú của chính người dùng — không điểm, không ngưỡng "đạt".
 *
 * ⚠⚠ A10 🔒 — danh sách hũ là CỦA NGƯỜI DÙNG, xếp theo thứ tự họ đã thấy ở màn HŨ; app không chọn hộ, không nói hũ nào "nên" đứng
 *   trước, không đặt số tiền nào. "Làm đúng k/n" là phép ĐẾM ngày, không phải lời khen/chê.
 * ⚠ P7/D62 — chưa có ngày chia nào ⇒ `null` (màn nói "chưa có lần chia nào"), KHÔNG BAO GIỜ 0/0 hay 0.
 * ⚠ P2 — mọi thứ ở lại máy: lựa chọn nằm trong `HoSo.huong` (cùng hạng mô hình cũ); không `ctx_*`, không `events`, không mã sự kiện mới.
 * ⚠ Hàm THUẦN và NHẸ (SỔ nhập tệp này để đọc dòng "làm đúng k/n"): chỉ nhập `so` · `hu` · `huong_tuan` — không kéo `huong.ts`.
 */
import { laPhanBo, soChuyenHu, soGan, tongGopVaoHu, type Khoan } from './so.js';
import { laTichLuy, sapXep, type Hu } from './hu.js';
import { cuoiTuan, huongTuan, type LuaChonHuong } from './huong_tuan.js';
import { ngayCuaLuc } from './thoi_gian.js';

/** Số hũ tối đa bày thành phương án (cộng GIỮ NHƯ CŨ = ba nút như demo). */
export const SO_HU_TREN_HUONG = 2;

export const MA_UU_TIEN = 'uu_tien_hu' as const;
export const MA_GIU_NHU_CU = 'giu_nhu_cu' as const;
export type MaPhuongAn = typeof MA_UU_TIEN | typeof MA_GIU_NHU_CU;

export interface PhuongAnHuong {
  khoa: string;
  ma: MaPhuongAn;
  /** Hũ được ưu tiên (chỉ `uu_tien_hu`). */
  huId?: string;
}

export function khoaPhuongAn(ma: MaPhuongAn, huId?: string): string {
  return ma === MA_UU_TIEN && huId !== undefined ? `${ma}:${huId}` : ma;
}

/**
 * BA PHƯƠNG ÁN: `SO_HU_TREN_HUONG` hũ tiết kiệm đang chạy đầu tiên theo thứ tự màn HŨ, rồi GIỮ NHƯ CŨ (luôn có — kể cả khi chưa hũ nào).
 * ⚠ Hướng ĐANG THEO tuần này (nếu là một hũ không còn nằm trong hai hũ đầu — vd hũ đã xong) vẫn đứng đầu danh sách, để nút đã bấm
 *   không biến mất dưới tay người dùng.
 */
export function phuongAnTuan(
  hu: readonly Hu[], so: readonly Khoan[], dangTheo: LuaChonHuong | null,
): PhuongAnHuong[] {
  const chay = hu.filter((h) => laTichLuy(h) && h.trangThai === 'dang_chay');
  const daGop = (id: string): number => {
    const h = chay.find((x) => x.id === id);
    return h === undefined ? 0 : tongGopVaoHu(so, h.id, h.mocGop);
  };
  let ds: PhuongAnHuong[] = sapXep(chay, daGop).slice(0, SO_HU_TREN_HUONG)
    .map((h) => ({ khoa: khoaPhuongAn(MA_UU_TIEN, h.id), ma: MA_UU_TIEN, huId: h.id }));
  if (dangTheo?.ma === MA_UU_TIEN && dangTheo.huId !== undefined && !ds.some((p) => p.huId === dangTheo.huId)) {
    ds = [{ khoa: khoaPhuongAn(MA_UU_TIEN, dangTheo.huId), ma: MA_UU_TIEN, huId: dangTheo.huId }, ...ds].slice(0, SO_HU_TREN_HUONG);
  }
  return [...ds, { khoa: MA_GIU_NHU_CU, ma: MA_GIU_NHU_CU }];
}

/** Bản ghi lựa chọn cho một phương án — người gọi đưa `tuan` (thứ Hai) và `luc` (ISO, máy người dùng). */
export function luaChonTuPhuongAn(
  p: PhuongAnHuong, kieu: LuaChonHuong['kieu'], tuan: string, luc: string,
): LuaChonHuong {
  const ra: LuaChonHuong = { tuan, khoa: p.khoa, ma: p.ma, kieu, luc };
  if (p.huId !== undefined) ra.huId = p.huId;
  return ra;
}

/**
 * Hướng ĐANG THEO của tuần theo MÔ HÌNH MỚI. Bản ghi mô hình cũ (D453: tạo hũ · quy tắc · luật · khung) còn trong hồ sơ ⇒ `null`: nó không
 * có nút nào trên tấm mới để "đang chọn", nên ô SỔ / GƯƠNG nói "chưa chọn" — không bịa một dòng cho thứ không còn bày.
 */
export function huongMoiTuan(ds: readonly LuaChonHuong[], tuan: string): LuaChonHuong | null {
  const h = huongTuan(ds, tuan);
  return h !== null && (h.ma === MA_UU_TIEN || h.ma === MA_GIU_NHU_CU) ? h : null;
}

/** Phương án của MỘT bản ghi (cho phép dựng lại nhãn từ lịch sử). `null` = bản ghi thuộc mô hình cũ. */
export function phuongAnCuaLuaChon(lc: LuaChonHuong): PhuongAnHuong | null {
  if (lc.ma === MA_GIU_NHU_CU) return { khoa: lc.khoa, ma: MA_GIU_NHU_CU };
  if (lc.ma === MA_UU_TIEN && lc.huId !== undefined) return { khoa: lc.khoa, ma: MA_UU_TIEN, huId: lc.huId };
  return null;
}

/** Một cú CHIA TIỀN VÀO hũ: nạp tiết kiệm (+) hoặc gán chi (+) — rút/gỡ ra không phải "chia vào". Gồm cả cú của quy tắc tự chia. */
function laChiaVao(k: Khoan): boolean {
  return laPhanBo(k) && (soChuyenHu(k) > 0 || soGan(k) > 0);
}

export interface LanLam {
  /** Số ngày hũ đã chọn nhận tiền. */
  k: number;
  /** Số ngày có chia tiền vào BẤT KỲ hũ nào, từ ngày chọn. */
  n: number;
}

/**
 * "LÀM ĐÚNG k/n LẦN" cho hướng `uu_tien_hu`, trên cửa sổ [ngày chọn, min(den, Chủ nhật của tuần chọn)]. `null` khi:
 *   · lựa chọn không phải `uu_tien_hu` (GIỮ NHƯ CŨ và mô hình cũ không có phép đếm này) — hoặc
 *   · chưa có ngày chia nào trong cửa sổ (thiếu mẫu — màn nói "chưa có lần chia nào", không 0/0).
 */
export function lanLamUuTien(lc: LuaChonHuong, so: readonly Khoan[], den: string): LanLam | null {
  if (lc.ma !== MA_UU_TIEN || lc.huId === undefined) return null;
  /* Ngày chọn theo giờ MÁY (cùng thước với `Khoan.ngay`) — không phải ngày UTC của mốc ISO. */
  const tu = ngayCuaLuc(lc.luc);
  const toi = den < cuoiTuan(lc.tuan) ? den : cuoiTuan(lc.tuan);
  const ngayChia = new Set<string>();
  const ngayDung = new Set<string>();
  for (const x of so) {
    if (x.ngay < tu || x.ngay > toi || !laChiaVao(x)) continue;
    ngayChia.add(x.ngay);
    if (x.huId === lc.huId) ngayDung.add(x.ngay);
  }
  return ngayChia.size === 0 ? null : { k: ngayDung.size, n: ngayChia.size };
}
