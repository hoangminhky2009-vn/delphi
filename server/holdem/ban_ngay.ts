/**
 * BÀN NGÀY — THỬ THÁCH HÔM NAY (D85 §5.2, thi công 17/08). Hai hàm THUẦN dùng
 * chung cho endpoint `/holdem/ngay`, `GET /holdem/ban/:ma` và test:
 *   · `ngayVN(now)`   — "hôm nay" là ngày nào theo Asia/Ho_Chi_Minh, và bàn
 *                        đóng lúc mấy giờ (0:00 VN kế tiếp, tính bằng UTC).
 *   · `phanVi(...)`   — hạng + phân vị của MỘT người trong tập NAV đã xong.
 *
 * ⚠ Múi giờ: A8.8 nói "hiển thị Asia/Ho_Chi_Minh, lưu UTC". VN là UTC+7 CỐ ĐỊNH
 * (không DST) nên cộng 7 giờ rồi đọc ngày UTC là đủ — không kéo Intl vào đường
 * nóng, và tất định trên mọi máy (server Vercel chạy UTC, máy dev chạy giờ VN,
 * test phải ra cùng một ngày).
 */

const GIO_VN_MS = 7 * 60 * 60 * 1000;

/** "Hôm nay" theo giờ VN: `ngay` dạng YYYY-MM-DD + mốc ĐÓNG BÀN (0:00 VN kế tiếp, Date UTC). */
export function ngayVN(now: Date): { ngay: string; het_han: Date } {
  const vn = new Date(now.getTime() + GIO_VN_MS);
  const y = vn.getUTCFullYear();
  const m = vn.getUTCMonth();
  const d = vn.getUTCDate();
  const ngay = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // 0:00 VN của ngày kế = 17:00 UTC hôm nay (theo lịch VN).
  const het_han = new Date(Date.UTC(y, m, d + 1) - GIO_VN_MS);
  return { ngay, het_han };
}

/**
 * Phân vị của một NAV trong tập NAV đã xong (kể cả chính nó).
 *   hang    = 1 + số người có NAV LỚN HƠN mình (đồng NAV = đồng hạng, kiểu 1-1-3);
 *   top_pct = ceil(100 × hang / tong) — "TOP 12%" nghĩa là hạng của bạn nằm trong
 *             12% đầu; một mình = TOP 100% (client tự đổi lời khi ít người).
 * D32: hiện phân vị cho MỌI người, không top-N. Thuần, không đọc gì ngoài tham số.
 */
export function phanVi(navToi: number, navCaSan: readonly number[]): {
  hang: number; tong: number; top_pct: number;
} {
  const tong = navCaSan.length;
  if (tong === 0) return { hang: 1, tong: 0, top_pct: 100 };
  const hon = navCaSan.filter((n) => n > navToi).length;
  const hang = hon + 1;
  return { hang, tong, top_pct: Math.min(100, Math.max(1, Math.ceil((100 * hang) / tong))) };
}
