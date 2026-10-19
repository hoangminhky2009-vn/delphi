/**
 * ĐƯỜNG BAY CÓ VÒM — một nguồn cho dáng bay của mọi VẬT bay từ chỗ này sang chỗ kia trên màn trận (D401).
 *
 * Tách từ `bayChip` của Shop (founder 13/09: chip bay *"gượng và kịch"* ⇒ `cubic-bezier` chứ không `steps()` — A11.18
 * dành `steps()` cho vật ĐỔI TRẠNG THÁI, còn chuyển động vật lý thì cong; vòm 22px chứ không 46px — 46 là ném, không
 * phải đặt). Từ D401 có ba cú bay dùng chung dáng này: chip đi vốn trong Shop · xu các ghế nộp vào GIẢI · hộp
 * "Ăn chia cược" rơi từ GIẢI xuống hàng khoản nổi. Bản cài đặt thứ hai của cùng dáng bay sẽ trôi im lặng (A11.5).
 *
 * ⚠ Dọn vật bay bằng ĐỒNG HỒ, không bằng `onfinish` — tab ẩn thì animation không chạy tới cuối và `onfinish` không
 *   bao giờ bắn (D356, xem `hat_pixel.ts`). Tệp này chỉ dựng KHUNG; ai sinh vật bay thì tự hẹn giờ dọn.
 * ⚠ Chỉ `transform` chuyển động (luật 60 FPS).
 */

export interface Diem { x: number; y: number }

/** Đường cong của mọi cú bay — ra nhanh, đáp êm, không nảy quá (cú đáp do ĐÍCH diễn, không do vật bay). */
export const EASING_BAY = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
/** Độ nhấc ở giữa đường (px). */
export const VOM_BAY = 22;

/**
 * Ba khung của một cú bay có vòm: `tu` → giữa đường nhấc lên `vom` px → `den`. Toạ độ là độ dịch `translate` (px)
 * tính từ chỗ đứng thật của phần tử được animate.
 * `cuoi` — vật CHUI VÀO đích thay vì đáp lên nó (D401: xu vào GIẢI): cỡ/độ mờ ở cuối đường, nửa đường đi nửa chừng.
 * Vắng ⇒ ba khung chỉ có `translate`, y hệt chip Shop từ 13/09.
 */
export function khungBay(
  tu: Diem, den: Diem, vom: number = VOM_BAY, cuoi?: { scale: number; opacity: number },
): Keyframe[] {
  // Nội suy (1 − k)·1 + k·đích: hai đầu ra ĐÚNG số (1 và đích), không lệch dấu phẩy động.
  const noi = (dich: number, k: number) => (1 - k) + k * dich;
  const co = (k: number) => (cuoi ? ` scale(${noi(cuoi.scale, k)})` : '');
  const mo = (k: number) => (cuoi ? { opacity: noi(cuoi.opacity, k) } : {});
  return [
    { transform: `translate(${tu.x}px,${tu.y}px)${co(0)}`, ...mo(0) },
    { transform: `translate(${(tu.x + den.x) / 2}px,${(tu.y + den.y) / 2 - vom}px)${co(0.5)}`, ...mo(0.5) },
    { transform: `translate(${den.x}px,${den.y}px)${co(1)}`, ...mo(1) },
  ];
}

/** Tâm một phần tử, toạ độ VIEWPORT. */
export function tamCua(el: Element): Diem {
  const b = el.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

/**
 * Có được cho vật bay không: có DOM, phần tử animate được, và người dùng KHÔNG xin giảm chuyển động. Giảm chuyển động
 * thì không bay gì cả — thứ vật bay chở (tiền vào quỹ, tiền về tay) đã nằm trong con số đích.
 */
export function duocBay(el: Element | null | undefined): el is HTMLElement {
  return typeof document !== 'undefined' && !!el
    && typeof (el as HTMLElement).animate === 'function'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches !== true;
}
