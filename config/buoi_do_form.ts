/**
 * BA PHIẾU GOOGLE FORM CỦA BUỔI ĐO — ĐỊA CHỈ VÀ Ô ĐIỀN SẴN (D370).
 *
 * Không còn người điều phối (founder 21/09) ⇒ app tự mở form đúng lúc cho tester, và tự điền sẵn
 * hai ô khoá. Tệp này là **nguồn duy nhất** của ba địa chỉ ấy.
 *
 * ⚠⚠ `entry` LÀ ID CỦA MỘT Ô TRÊN MỘT FORM CỤ THỂ — dựng lại form là ID ĐỔI HẾT. Ai chạy lại
 * `docs/buoi-do/tao-form.gs` thì phải đọc lại ID mới và sửa ở đây, nếu không link vẫn mở được
 * nhưng **hai ô khoá trống** và mọi dòng trả lời thành mồ côi (không ghép được với dữ liệu app).
 * Cách đọc lại: mở link `dien`, chạy trong console —
 *   `FB_PUBLIC_LOAD_DATA_[1][1].filter(i => i[3] !== 6 && i[3] !== 8).slice(0,2).map(i => [i[1], i[4][0][0]])`
 *
 * ⚠ Bộ dưới đây dựng 21/09/2026 lúc 20:52, và đã thử link điền sẵn thật: hai ô nhận đúng giá trị.
 * ⚠ KHÔNG ghi mã/nhãn vào URL bằng tay ở chỗ khác — dùng `linkPhieu()`; nó lo `encodeURIComponent`
 *   (nhãn nhóm có dấu gạch, và một ngày nào đó có thể có ký tự phải mã hoá).
 */

/** Ba bước mà NGƯỜI DÙNG tự khai đã nộp phiếu. Bước 2 và 4 app tự biết nên không có ở đây. */
export const BUOC_PHIEU = [1, 3, 5] as const;
export type BuocPhieu = (typeof BUOC_PHIEU)[number];

export interface PhieuBuoiDo {
  /** Thứ tự người dùng gặp: 1 TRƯỚC · 2 GIỮA · 3 SAU. */
  so: 1 | 2 | 3;
  ten: string;
  /** Link người điền. */
  dien: string;
  /** Link người quản lý sửa nội dung / xem câu trả lời. */
  sua: string;
  /** Bước được đánh dấu XONG khi nộp phiếu này (khớp `?buoi_do_buoc=` ở trang xác nhận). */
  buoc: BuocPhieu;
  /** ID ô `MÃ BUỔI ĐO` và ô `NHÓM` trên chính form ấy. */
  entryMa: number;
  entryNhan: number;
}

export const PHIEU_BUOI_DO: readonly PhieuBuoiDo[] = [
  {
    so: 1,
    ten: 'PHIẾU 1 — trước khi mở app',
    dien: 'https://example.invalid/form',
    sua: 'https://example.invalid/form',
    buoc: 1,
    entryMa: 69478094,
    entryNhan: 9190221,
  },
  {
    so: 2,
    ten: 'PHIẾU 2 — ngay sau Alpha Draft',
    dien: 'https://example.invalid/form',
    sua: 'https://example.invalid/form',
    buoc: 3,
    entryMa: 269640836,
    entryNhan: 956645768,
  },
  {
    so: 3,
    ten: 'PHIẾU 3 — sau khi xong PFM',
    dien: 'https://example.invalid/form',
    sua: 'https://example.invalid/form',
    buoc: 5,
    entryMa: 1040485454,
    entryNhan: 1235571308,
  },
];

/**
 * Link mở phiếu, đã điền sẵn mã buổi đo và nhãn nhóm.
 *
 * ⚠ Mã rỗng/null ⇒ VẪN trả link (chỉ không điền sẵn). Người mất mã vẫn phải vào được phiếu và gõ
 * tay; chặn họ ở đây là đổi một ô trống thành một người không nộp được gì.
 */
export function linkPhieu(p: PhieuBuoiDo, ma: string | null, nhan: string | null): string {
  const q = new URLSearchParams({ usp: 'pp_url' });
  if (ma) q.set(`entry.${p.entryMa}`, ma);
  if (nhan) q.set(`entry.${p.entryNhan}`, nhan);
  return `${p.dien}?${q.toString()}`;
}

/** Phiếu mà người ở bước `buoc` cần làm tiếp — `null` khi đã xong cả ba (bước 5). */
export function phieuKeTiep(buoc: number): PhieuBuoiDo | null {
  if (buoc < 1) return PHIEU_BUOI_DO[0] ?? null;   // chưa nộp gì ⇒ phiếu 1
  if (buoc === 2) return PHIEU_BUOI_DO[1] ?? null; // chơi xong ⇒ phiếu 2
  if (buoc === 4) return PHIEU_BUOI_DO[2] ?? null; // xong PFM ⇒ phiếu 3
  return null;                                     // 1 · 3 · 5 ⇒ đang chờ app, không phải chờ phiếu
}
