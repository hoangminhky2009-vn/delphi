/**
 * CỜ "ĐÃ ĐI QUA PHỎNG VẤN" — tiện nghi mỗi máy, không phải dữ liệu.
 *
 * ⚠ Ở MODULE RIÊNG, KHÔNG nằm trong `screens/tai-chinh/PhongVan.tsx`: `CuaPfm`
 * phải đọc cờ này để quyết đi đâu, mà `CuaPfm` là thứ chạy ở MỌI lần bấm vào khu
 * Tài chính. Import từ màn phỏng vấn là kéo cả màn (kho PFM, chip, CSS) vào chunk
 * của cửa — tức mọi người trả giá tải cho một màn hầu hết chỉ thấy một lần.
 *
 * ⚠ Hỏng thì trả `false` (= chưa phỏng vấn). Tệ nhất là hỏi lại một lần nữa;
 * ngược lại — coi như đã hỏi khi chưa hỏi — là mất luôn màn cửa vào của người mới.
 */
const KHOA = 'pfm_da_phong_van';

/**
 * ⚠ D603 — cờ đi THEO TÀI KHOẢN như kho: lời khai phỏng vấn nằm trong kho của từng người, nên "đã phỏng vấn" của người
 * trước trên cùng máy mà áp cho người sau là đưa người sau thẳng vào một sổ chưa từng hỏi họ câu nào. Khoá cũ không mang
 * chủ (`pfm_da_phong_van`) bỏ, không đọc — cùng số phận kho chung cũ (D592: bỏ, không chuyển).
 */
export function khoaTheoChu(goc: string, chu: string): string {
  return `${goc}:${chu}`;
}

/** Bản demo (link pitch, `src/demo/main.tsx`): sổ mẫu đã trả lời phỏng vấn — cho MỌI chủ, vì chủ demo do máy chủ giả sinh. */
let demoMoiChu = false;
export function danhDauDaPhongVanChoDemo(): void {
  demoMoiChu = true;
}

export function daPhongVan(chu: string | null): boolean {
  if (demoMoiChu) return true;
  if (!chu) return false;
  try {
    return localStorage.getItem(khoaTheoChu(KHOA, chu)) === '1';
  } catch {
    return false;
  }
}

export function danhDauDaPhongVan(chu: string | null): void {
  if (!chu) return;
  try {
    localStorage.setItem(khoaTheoChu(KHOA, chu), '1');
  } catch { /* chế độ riêng tư chặn lưu trữ — chấp nhận hỏi lại */ }
}
