/**
 * CHỮ CỦA HƯỚNG TUẦN — MỘT chỗ ghép câu cho ba nơi đọc cùng một lựa chọn: tấm HƯỚNG (nhãn nút · "làm đúng k/n lần"), ô HƯỚNG ở mặt GƯƠNG
 * và khe "HƯỚNG TUẦN NÀY" ở SỔ (demo: "Giữ quỹ dự phòng trước — làm đúng 3/4 lần"). Ba nơi, MỘT câu — nơi nào tự ghép là bản thứ hai SẼ trôi
 * (A11.5).
 *
 * ⚠ NHẸ: chỉ nhập từ điển chữ + kiểu — SỔ nhập tệp này (`so_goi_nhe.test.ts` canh bắc cầu), nên không kéo `huong.ts`/`DinhHuong`.
 * ⚠ A10 🔒 — tả + đếm. Tên hũ là của người dùng; "làm đúng k/n lần" là phép đếm ngày chia tiền (`huong_hu.ts`), không điểm.
 * ⚠ D62 — chưa có lần chia nào ⇒ "chưa có lần chia nào", KHÔNG 0/0.
 */
import { CHU_HUONG as H } from '@/lib/pfm_chu';
import type { Hu } from '@/pfm/hu';
import type { LuaChonHuong } from '@/pfm/huong_tuan';
import { MA_GIU_NHU_CU, MA_UU_TIEN, type LanLam, type PhuongAnHuong } from '@/pfm/huong_hu';

/** Nhãn nút của một phương án: ƯU TIÊN <TÊN HŨ> · GIỮ NHƯ CŨ. Hũ không còn trong danh sách ⇒ "HŨ ĐÃ ĐÓNG". */
export function nhanPhuongAn(p: Pick<PhuongAnHuong, 'ma' | 'huId'>, hu: readonly Hu[]): string {
  if (p.ma === MA_GIU_NHU_CU) return H.giuNhuCu;
  const ten = hu.find((h) => h.id === p.huId)?.ten;
  return `${H.uuTienPre}${ten === undefined ? H.huKhongCon : ten.toUpperCase()}`;
}

/** "làm đúng 3/4 lần" · "chưa có lần chia nào". `null` = hướng không có phép đếm này (giữ như cũ · bản ghi mô hình cũ). */
export function chuLanLam(lc: Pick<LuaChonHuong, 'ma'>, lan: LanLam | null): string | null {
  if (lc.ma !== MA_UU_TIEN) return null;
  return lan === null ? H.chuaCoLanChia : `${H.lamDungPre}${lan.k}/${lan.n}${H.lamDungHau}`;
}

/**
 * Câu MỘT dòng cho hướng đang theo: "Ưu tiên Quỹ dự phòng — làm đúng 3/4 lần" · "Giữ như cũ". `null` với bản ghi mô hình cũ (không còn
 * ai ghi; đọc ra thì coi như CHƯA chọn hướng mới).
 */
export function cauHuongDangTheo(lc: Pick<LuaChonHuong, 'ma' | 'huId'>, hu: readonly Hu[], lan: LanLam | null): string | null {
  if (lc.ma === MA_GIU_NHU_CU) return H.soGiuNhuCu;
  if (lc.ma !== MA_UU_TIEN) return null;
  const ten = hu.find((h) => h.id === lc.huId)?.ten ?? H.huKhongCon.toLowerCase();
  return `${H.soUuTienPre}${ten} — ${chuLanLam(lc, lan)}`;
}
