/**
 * PFM — ORACLE GIÚP 5/5: **"tiền đi tới ngày nào"** (D365). Demo đã chốt (A11.25):
 * `pfm-ngay-dau.html` màn `tuan` — *"Từ lần tiền về ngày 5, bạn đã tiêu 31%. Giữ nhịp ba
 * ngày qua thì phần còn lại đi hết vào khoảng ngày 16."* + dải lịch + *"Phép chia trên
 * chính sổ của bạn. Tôi chỉ đoán nhịp; số tiền là của bạn gõ."*
 *
 * ⚠⚠ ĐÂY LÀ MỘT PHÉP NGOẠI SUY, VÀ NÓ PHẢI TỰ NÓI RA ĐIỀU ĐÓ. Nó KHÔNG phải lời tiên
 * tri và cũng không phải lời khuyên (A10 🔒): chỉ là "giữ nguyên nhịp N ngày qua thì…".
 * Vì vậy hàm trả về CẢ `nhipNgay` và `nhip` — câu chữ buộc phải nói ra mình đứng trên
 * mấy ngày, không được giấu giả định đi để nghe cho chắc.
 * ⚠ P7 — thiếu mẫu ⇒ `null`, không phải 0. Ba cửa: chưa có lần tiền về nào · chưa đủ
 * `ORACLE_NHIP_NGAY` ngày kể từ lần tiền về · nhịp bằng 0 (không tiêu gì mấy ngày qua ⇒
 * "tới ngày nào" không có câu trả lời, và bịa ra một ngày xa là nói dối).
 *
 * Hàm THUẦN: `homNay` do người gọi đưa vào; không đọc kho; không chuỗi hiển thị (D26).
 */
import { PFM } from '@config/pfm';
import { laChiTieu, laThu, type Khoan } from './so.js';

export interface TienToiNgay {
  /** Ngày của lần tiền về gần nhất (`YYYY-MM-DD`). */
  ngayVe: string;
  /** Tổng THU trong đúng ngày ấy. */
  tienVe: number;
  /** Tổng CHI từ ngày ấy tới hôm nay (gồm cả hai đầu). */
  daTieu: number;
  /** `daTieu / tienVe` — KHÔNG kẹp: vượt 1 là một sự thật, giấu đi là nói nhẹ đi. */
  tyLeDaTieu: number;
  /** Phần còn lại; ≤ 0 nghĩa là đã tiêu quá số tiền về ấy. */
  conLai: number;
  /** Nhịp = chi trung bình mỗi ngày của `nhipNgay` ngày gần nhất (gồm hôm nay). */
  nhip: number;
  nhipNgay: number;
  /** Ngày phần còn lại chạm 0 nếu giữ nhịp; `null` khi `conLai <= 0` (đã hết rồi). */
  ngayHet: string | null;
}

/** Số ngày lịch (b − a). */
function cachNgay(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function tienToiNgay(so: readonly Khoan[], homNay: string): TienToiNgay | null {
  const thu = so.filter((k) => laThu(k) && cachNgay(k.ngay, homNay) >= 0);
  if (thu.length === 0) return null;
  const ngayVe = thu.reduce((a, k) => (k.ngay > a ? k.ngay : a), thu[0]!.ngay);

  // Cần đủ ngày để NÓI được chữ "nhịp" — demo nói "nhịp ba ngày qua", nên dưới ba ngày thì im.
  if (cachNgay(ngayVe, homNay) < PFM.ORACLE_NHIP_NGAY - 1) return null;

  const tienVe = thu.reduce((s, k) => s + (k.ngay === ngayVe ? k.soTien : 0), 0);
  if (tienVe <= 0) return null;

  let daTieu = 0;
  let trongNhip = 0;
  for (const k of so) {
    if (!laChiTieu(k)) continue;
    const tuVe = cachNgay(ngayVe, k.ngay);
    const toiNay = cachNgay(k.ngay, homNay);
    if (toiNay < 0) continue;                      // khoản ở tương lai
    if (tuVe >= 0) daTieu += k.soTien;
    if (toiNay < PFM.ORACLE_NHIP_NGAY) trongNhip += k.soTien;
  }
  const nhip = trongNhip / PFM.ORACLE_NHIP_NGAY;
  if (nhip <= 0) return null;

  const conLai = tienVe - daTieu;
  return {
    ngayVe, tienVe, daTieu, tyLeDaTieu: daTieu / tienVe, conLai,
    nhip, nhipNgay: PFM.ORACLE_NHIP_NGAY,
    ngayHet: conLai <= 0 ? null : congNgay(homNay, Math.ceil(conLai / nhip)),
  };
}

/**
 * ⚠ CỘNG BẰNG SỐ HỌC, KHÔNG BẰNG VÒNG LẶP `ngayKeTiep`. Vòng lặp chạy `n` lần, mà `n` ở đây
 * là `conLai / nhip` — một phép chia mà mẫu số CÓ THỂ BẰNG 0. Cổng `nhip <= 0` ở trên chặn
 * đúng ca ấy hôm nay, nhưng một vòng lặp `for (i = 0; i < Infinity; i++)` là **treo cứng cả
 * tab**, không phải một bài test đỏ — tức cổng kia mà hở thì hỏng câm, không ai thấy.
 * Phép cộng này thì chịu được: `NaN`/`Infinity` rơi ra một ngày vô lệ và lộ ngay.
 */
function congNgay(ngay: string, n: number): string {
  return new Date(Date.parse(`${ngay}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}
