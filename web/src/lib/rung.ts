/**
 * RUNG PHẢN HỒI — phần "sướng tay" mà mắt không thấy được.
 *
 * Founder 04/08: thao tác đi vốn *"cảm giác như đặt lệnh bảng điện tử chứ không
 * giống chơi game bài"*. Hình ảnh chỉ giải được một nửa; nửa còn lại là XÚC
 * GIÁC — bấm mà tay không nhận lại gì thì não đọc nó là thao tác biểu mẫu.
 *
 * Rẻ tuyệt đối: không xin quyền, không request, không thư viện, không đụng
 * khung hình (rung chạy ngoài luồng dựng hình).
 *
 * ⚠ iOS Safari KHÔNG hỗ trợ `navigator.vibrate` và sẽ không bao giờ hỗ trợ.
 * Nên đây là món CỘNG THÊM, không được là kênh phản hồi DUY NHẤT của bất kỳ
 * hành động nào — mọi nút vẫn phải có phản hồi nhìn thấy được (cú lún trong
 * `ShopManHinh.module.css`). Ai bỏ cú lún đi vì "đã có rung rồi" là vừa làm
 * app câm trên một nửa số điện thoại.
 */

/** Nhịp rung theo SỨC NẶNG của nước đi, không theo loại nút. */
export const NHIP_RUNG = {
  /** Chạm nhẹ: chọn mốc 25/50/75, chọn lá. */
  cham: 8,
  /** Nước đi nặng: ALL-IN, chốt vòng — tay phải thấy khác hẳn cú chạm nhẹ. */
  nang: 25,
} as const;

export function rung(ms: number): void {
  if (typeof navigator === 'undefined') return;

  /*
   * Người xin ít chuyển động thì thôi rung. Đây không phải ánh xạ hoàn hảo
   * (`prefers-reduced-motion` nói về thị giác) nhưng nó là tín hiệu GẦN NHẤT
   * mà nền web cho, và đoán sai theo hướng im lặng thì không hại ai.
   */
  if (typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate !== 'function') return;
  try {
    nav.vibrate(ms);
  } catch {
    /* Vài trình duyệt ném khi tab chưa từng được người dùng chạm vào. Rung
       hỏng thì không được phép làm hỏng cú bấm — nuốt là đúng ở đây. */
  }
}
