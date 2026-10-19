/**
 * BRIER CHO ĐẤU TRƯỜNG — "độ chuẩn" của một vòng (§7.3 doc poker-hoá).
 *
 * ⭐ KHÔNG PHÁT MINH THƯỚC MỚI. Đây đúng công thức A5.4 mà chợ dự báo đang
 * dùng, chỉ đổi thứ đóng vai xác suất:
 *   · `p_i` = tỷ lệ vốn ghế đang đặt ở mã i (một phân phối xác suất có sẵn —
 *     người chơi rải tiền tức là đã khai niềm tin bằng tiền);
 *   · `o_i` = 1 nếu mã i là mã lời nhất vòng đó, 0 nếu không;
 *   · Brier = Σ(p_i − o_i)², thang 0–2. Thấp là tốt.
 *
 * Vì sao đáng làm bằng thước CÓ SẴN thay vì một điểm số tự chế:
 *  1. hai nửa app (chợ dự báo · đấu trường) nói CÙNG một ngôn ngữ kỹ năng;
 *  2. nó là cột dữ liệu B2B đúng nghĩa (A1) — "người này calibrate tốt tới
 *     đâu" đắt hơn hẳn "người này thắng mấy trận";
 *  3. một thước tự chế thì không ai kiểm được nó có đo đúng thứ nó mang tên
 *     hay không, mà đó là lỗi cả repo này đã dính nhiều lần.
 *
 * ⚠ THUẦN QUAN SÁT — không đổi một chip nào của trận. Nên KHÔNG cần cổng
 * `balance_version`: trận cũ replay ra đúng kết quả cũ, chỉ thêm một con số
 * đọc được. (Ngược lại, thứ gì chạm tiền thì phải có cổng.)
 *
 * ⚠ KHÔNG XẾP HẠNG CÔNG KHAI (A3.8). Tính + hiện cho CHÍNH CHỦ; dựng thành
 * bảng đua là đẻ động cơ méo — dồn hết vào một mã để ăn Brier, đúng lớp lỗi
 * D32 đã phân tích cho bảng token.
 */

/**
 * Không giữ mã nào (toàn tiền mặt) ⇒ trả `null`, KHÔNG trả 0 và cũng không
 * trả 2.
 *
 * Đây là chỗ dễ sai nhất của cả hàm. Đứng ngoài thị trường không phải một dự
 * báo sai, nó là KHÔNG DỰ BÁO — nhét nó vào thang điểm thì trung bình Brier
 * của người hay đứng ngoài bị bịa ra từ những vòng họ không phát biểu gì.
 * Tầng gọi phải BỎ QUA vòng null, không được thay bằng một con số mặc định.
 */
export function brierVong(
  viThe: Readonly<Record<string, number>>,
  loiSuatTheoMa: Readonly<Record<string, number>>,
): number | null {
  const tong = Object.values(viThe).reduce((a, b) => a + b, 0);
  if (tong <= 0) return null;

  /*
   * Mã thắng = lời nhất trong TOÀN BỘ mã có mặt trên bàn, không phải trong số
   * mã ghế đang cầm. Nếu chỉ so trong rổ của mình thì ai cầm đúng một mã cũng
   * luôn "đoán đúng" — thước sẽ thưởng việc không đa dạng hoá, tức đo ngược.
   */
  let thang: string | null = null;
  let caoNhat = -Infinity;
  for (const [ma, r] of Object.entries(loiSuatTheoMa)) {
    if (r > caoNhat) { caoNhat = r; thang = ma; }
  }
  if (thang === null) return null;

  /*
   * Cộng trên HỢP của hai tập: mã đang cầm (có p, có thể o=0) và mã thắng
   * (o=1, có thể p=0). Bỏ mã thắng ra khỏi tổng khi không cầm nó là bỏ đúng
   * phần phạt nặng nhất — Brier sẽ luôn đẹp một cách vô lý.
   */
  const maTinh = new Set([...Object.keys(viThe), thang]);
  let s = 0;
  for (const ma of maTinh) {
    const p = (viThe[ma] ?? 0) / tong;
    const o = ma === thang ? 1 : 0;
    s += (p - o) ** 2;
  }
  return s;
}

/**
 * Trung bình Brier qua các vòng CÓ dự báo. Rỗng ⇒ null (không bịa ra một con
 * số cho người chưa từng vào lệnh).
 */
export function brierTrungBinh(cacVong: readonly (number | null)[]): number | null {
  const co = cacVong.filter((x): x is number => x !== null);
  if (co.length === 0) return null;
  return co.reduce((a, b) => a + b, 0) / co.length;
}
