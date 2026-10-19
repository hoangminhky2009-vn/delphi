/**
 * PFM — **SỔ LỜI ĐOÁN CỦA APP**: kỳ nào đã chấm, app đoán gì, trúng hay trật.
 *
 * ⚠⚠ VÌ SAO TỆP NÀY TỒN TẠI (23/09). Màn chân dung dán nhãn **"KIỂM ĐƯỢC"** lên lời đoán và
 * hứa *"khi sổ đủ dày, tôi chấm lại và nói thẳng tôi trúng hay trật"* — nhưng tới hôm nay
 * **không màn nào gọi `chamDoan()`**. Ruột chấm có từ D368, mặt người dùng thì không. Tức app
 * hứa trước mặt tester một việc nó không làm. Tệp này là mảnh nối lời hứa với phép chấm.
 *
 * ⚠⚠ BẪY TRUNG THỰC: ĐOÁN SAU KHI BIẾT KẾT QUẢ. Tuần được niêm phong là tuần ĐÃ KẾT THÚC gần
 * nhất (`server/pfm/tuan.ts` §`tuanNiemPhongTuNgay`). Người phỏng vấn thứ Ba rồi chốt sổ ngay
 * sẽ chốt tuần TRƯỚC — một tuần khép lại trước khi app đưa ra lời đoán. Chấm lời đoán trên kỳ
 * ấy là tự chấm mà gian: app "trúng" nhờ nhìn đáp án. Nên mỗi lời đoán mang NGÀY BẮT ĐẦU
 * (`HoSo.doanTu`), và **chỉ kỳ mở ra từ ngày ấy trở đi mới được chấm**.
 *
 * ⚠ GHI THEO KỲ, KHÔNG GHI BỘ ĐẾM. Mỗi kỳ một khoá (`tuan:YYYY-MM-DD` · `thang:YYYY-MM`) ⇒ xem
 *   lại cùng một tuần mười lần vẫn là một lượt; thành tích ĐẾM LẠI từ sổ chứ không cộng dồn
 *   (một bộ đếm cộng dồn là bản sao thứ hai của chính sổ này, và nó trôi — A11.5).
 * ⚠ GHI CẢ LỜI ĐOÁN LÚC ẤY (`ma`). Người dùng đổi câu nhịp thì lời đoán đổi; chấm lại tuần cũ
 *   bằng lời đoán MỚI là viết lại lịch sử của chính app.
 * ⚠ A10 🔒 — kết quả nói về APP ("tôi trúng/tôi trật"), không nói về người dùng.
 * ⚠ P2 — chỉ ở lại máy (nằm trong `HoSo`, không `ctx_*` nào).
 *
 * Hàm THUẦN: không đọc đồng hồ, không đọc kho, không chuỗi hiển thị (D26).
 */
import { CUA_CUA_DOAN, chamDoan, type KetQuaDoan, type ThanhTichDoan } from './cham_doan.js';
import type { MaChanDung } from './chan_dung.js';
import type { Khoan } from './so.js';

/** Một kỳ đã chấm: lời đoán app THẬT SỰ đưa ra kỳ ấy + phán quyết + hai số đứng sau nó. */
export interface KyDaCham {
  ma: MaChanDung;
  kq: KetQuaDoan;
  /** Hai số của `chamDoan` (nghĩa theo từng mã — xem `cham_doan.ts`). `null` khi `chua_du`. */
  doDuoc: number | null;
  moc: number | null;
}

export type SoDoan = Readonly<Record<string, KyDaCham>>;

export interface KyCham {
  khoa: string;
  tu: string;
  den: string;
}

const ngay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const ms = (d: string): number => Date.parse(`${d}T00:00:00Z`);

/**
 * KỲ CẦN CHẤM khi tuần `tuan` (thứ Hai của tuần vừa niêm phong) được xem.
 *
 * `null` = không có gì để chấm lúc này: lời đoán không kiểm được (`chua_ro`), chưa có ngày bắt
 * đầu, kỳ mở ra TRƯỚC ngày lời đoán được đưa ra (xem bẫy ở đầu tệp), hoặc — với lời đoán theo
 * THÁNG — tháng ấy không được ghi từ đầu.
 *
 * ⚠ Lời đoán THEO THÁNG (`cuoi_thang`) so nửa cuối với nửa đầu tháng. Tháng mà người dùng bắt
 *   đầu ghi từ giữa chừng thì nửa đầu gần như trống ⇒ "nửa cuối nhiều hơn" đúng một cách tầm
 *   thường, app "trúng" nhờ thiếu dữ liệu. Nên chỉ chấm tháng được ghi TỪ NGÀY ĐẦU THÁNG
 *   (`ghiDauTien` ≤ ngày 1), không thì bỏ qua — thà chậm một tháng còn hơn một lượt trúng giả.
 */
export function kyCanCham(
  ma: MaChanDung, tuan: string, doanTu: string | undefined, ghiDauTien: string | null,
): KyCham | null {
  const cua = CUA_CUA_DOAN[ma];
  if (cua === null || doanTu === undefined) return null;
  /*
   * ⚠⚠ `tuan` SAI DẠNG ⇒ null, KHÔNG để lọt xuống phép cộng ngày. Server trả `YYYY-MM-DD` (thứ Hai —
   * `server/pfm/tuan.ts` §`tuanNiemPhongTuNgay`), nhưng fixture cũ của màn Gương dùng `'2026-W37'`, và nếu
   * một ngày nào đó dạng ấy đi thật vào đây thì `Date.parse` ra `NaN` ⇒ `toISOString()` NÉM `RangeError`
   * ngay trong lúc vẽ ⇒ SẬP CẢ MÀN GƯƠNG, chứ không riêng ô chấm. Một ô chấm im lặng rẻ hơn một màn trắng.
   */
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tuan) || !/^\d{4}-\d{2}-\d{2}$/.test(doanTu)) return null;

  if (cua === 'tuan') {
    if (tuan < doanTu) return null;
    return { khoa: `tuan:${tuan}`, tu: tuan, den: ngay(ms(tuan) + 6 * 86_400_000) };
  }

  /*
   * Theo tháng: tháng gần nhất ĐÃ TRỌN tính tới Chủ nhật của tuần vừa niêm phong = tháng LIỀN
   * TRƯỚC tháng của ngày HÔM SAU Chủ nhật ấy. Một công thức phủ cả hai ca: CN là ngày cuối tháng
   * ⇒ hôm sau là mùng 1 tháng mới ⇒ tháng liền trước chính là tháng của CN; CN giữa tháng ⇒ hôm
   * sau vẫn cùng tháng ⇒ tháng liền trước là tháng đã trọn gần nhất.
   * ⚠ Bản đầu có thêm nhánh `hom.getUTCDate() === 1 ? cn.slice(0, 7) : …` — tiêm lỗi vào nhánh ấy
   *   KHÔNG làm bài nào đỏ, vì nó ra đúng cùng giá trị với nhánh kia: MÃ CHẾT, đã gỡ.
   */
  const cn = ngay(ms(tuan) + 6 * 86_400_000);
  const hom = new Date(ms(cn) + 86_400_000);
  const thangTron = new Date(Date.UTC(hom.getUTCFullYear(), hom.getUTCMonth() - 1, 1))
    .toISOString().slice(0, 7);
  const tu = `${thangTron}-01`;
  const [y, m] = thangTron.split('-').map(Number);
  const den = new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);   // ngày 0 của tháng sau
  if (tu < doanTu) return null;
  if (ghiDauTien === null || ghiDauTien > tu) return null;
  return { khoa: `thang:${thangTron}`, tu, den };
}

/** Chấm một kỳ — gói `chamDoan` lại thành đúng một dòng sổ. */
export function chamKy(ma: MaChanDung, so: readonly Khoan[], ky: KyCham): KyDaCham {
  const r = chamDoan(ma, so, ky.tu, ky.den);
  return { ma, kq: r.ketQua, doDuoc: r.so?.doDuoc ?? null, moc: r.so?.moc ?? null };
}

/**
 * THÀNH TÍCH — ĐẾM LẠI từ sổ, không cộng dồn. `chua_du` không tính: nó chưa phải một lượt đoán.
 */
export function thanhTich(so: SoDoan | undefined): ThanhTichDoan {
  const ra = { trung: 0, trat: 0 };
  for (const k of Object.values(so ?? {})) {
    if (k.kq === 'trung') ra.trung += 1;
    else if (k.kq === 'trat') ra.trat += 1;
  }
  return ra;
}

/** Ngày ghi sớm nhất trong sổ (mọi chiều). `null` khi sổ trống. */
export function ngayGhiDauTien(so: readonly Khoan[]): string | null {
  let ra: string | null = null;
  for (const k of so) if (ra === null || k.ngay < ra) ra = k.ngay;
  return ra;
}
