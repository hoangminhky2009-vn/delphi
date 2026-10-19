/**
 * PFM — ORACLE GIÚP 4/5: **quy MÓN LỚN ra đơn vị của chính người dùng** ngay trên bàn tiền,
 * TRƯỚC khi ghi (D365). Demo đã chốt (A11.25): `pfm-ngay-dau.html` màn `n6` —
 * *"6 NGÀY chi thường của bạn (nền 50k/ngày, từ sổ)"* + *"X% mức hũ «…» bạn đặt"*, và câu
 * chốt *"Tôi không nói khoản này đáng hay không. Tôi chỉ đổi nó ra thứ bạn đã quen đếm."*
 *
 * ⚠ A10 🔒 — MÔ TẢ ĐƯỢC, KÊ ĐƠN KHÔNG. Hàm này trả về hai phép chia trên chính sổ người
 * dùng; nó không xếp hạng, không khuyên, không có khái niệm "đáng/không đáng".
 * ⚠ P3 🔒 — không điền số tiền hộ; `soTien` là thứ người dùng vừa đặt lên khay.
 * ⚠ P7 — thiếu mẫu ⇒ `null`, KHÔNG phải 0.
 *
 * Hàm THUẦN: không đọc đồng hồ, không đọc kho, không chuỗi hiển thị (D26).
 */
import { PFM } from '@config/pfm';
import { chiTheoNgay, trungVi } from './guong.js';
import { laTichLuy, type Hu } from './hu.js';
import { tongGopVaoHu, type Khoan } from './so.js';

export interface QuyDoiMon {
  /** Món này bằng mấy ngày chi thường — SỐ THẬT, người gọi tự làm tròn để hiện. */
  soNgayThuong: number;
  /** Nền = TRUNG VỊ mức chi mỗi ngày có chi (đồng) — cùng công thức `tinhNguongChiLon`. */
  nenNgay: number;
  /** Phần của mức hũ, [0,∞); `null` = không có hũ nào người dùng đã ĐẶT MỨC. */
  phanMucHu: number | null;
  huId: string | null;
}

export interface DauVaoQuyDoi {
  soTien: number;
  so: readonly Khoan[];
  hu: readonly Hu[];
}

/**
 * `null` khi: chưa đủ `GUONG_SAN_NGAY_CHI` ngày có chi (chưa nói được "ngày thường" là bao
 * nhiêu), hoặc khoản CHƯA đủ lớn (`< ORACLE_HE_SO_MON_LON ×` nền).
 *
 * ⚠⚠ DÙNG LẠI CÔNG THỨC NỀN CỦA `guong.ts`, NHƯNG HỆ SỐ RIÊNG (`ORACLE_HE_SO_MON_LON`).
 * Mượn thẳng `GUONG_HE_SO_NGAY_LON` là liên kết giả — "ngày nào là ngày chi lớn" (cách ĐO)
 * và "món nào đáng quy ra ngày" (khi nào NÓI) là hai câu hỏi, hai cần gạt. Xem `config/pfm.ts`.
 *
 * ⚠ HŨ NÀO: khoản chưa ghi nên chưa biết nó vào hũ nào ⇒ lấy hũ người dùng còn CÁCH ĐÍCH XA
 * NHẤT (còn thiếu nhiều nhất so với mức họ tự đặt). Đó là hũ mà phép so "món này bằng bao
 * nhiêu phần mức" nói được nhiều nhất, và nó là LỰA CHỌN CỦA HỌ (mức do họ đặt — P3), không
 * phải app xếp hạng mục tiêu hộ. Hoà ⇒ hũ có mức lớn hơn, rồi tới `id` — tất định.
 */
export function quyDoiMon(v: DauVaoQuyDoi): QuyDoiMon | null {
  const theoNgay = chiTheoNgay(v.so);
  if (theoNgay.size < PFM.GUONG_SAN_NGAY_CHI) return null;
  const nenNgay = trungVi([...theoNgay.values()])!;
  if (nenNgay <= 0) return null;
  if (v.soTien < PFM.ORACLE_HE_SO_MON_LON * nenNgay) return null;

  // D421 — "còn thiếu bao nhiêu so với mức" chỉ có nghĩa ở hũ tích lũy; mức của hũ tiêu dùng là trần tiêu một tháng.
  const coMuc = v.hu.filter((h): h is Hu & { muc: number } => laTichLuy(h) && h.muc !== null && h.muc > 0);
  // ⚠ "Đã góp" LUÔN TÍNH từ sổ, không bao giờ CẤT trên hũ — dùng lại `tongGopVaoHu` (xem
  //   chú thích dài ở `Hu`, D61: bản sao thứ hai của phép cộng này sẽ trôi).
  const conThieu = (h: Hu & { muc: number }): number => h.muc - tongGopVaoHu(v.so, h.id, h.mocGop);
  const xep = [...coMuc].sort((a, b) => (conThieu(b) - conThieu(a))
    || (b.muc - a.muc)
    || a.id.localeCompare(b.id));
  const chon = xep[0] ?? null;

  return {
    soNgayThuong: v.soTien / nenNgay,
    nenNgay,
    phanMucHu: chon === null ? null : v.soTien / chon.muc,
    huId: chon?.id ?? null,
  };
}
