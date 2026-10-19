/**
 * SUẤT TRẬN — hàng chờ kiểu 2b2t + lưới trần ngày (SPEC `docs/spec/tran-tran-ngay.md`, CHỐT bản 2, 11/10).
 *
 * ─── VÌ SAO CÓ FILE NÀY ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 * Vượt hạn mức Vercel Hobby ⇒ cả app bị khoá ~30 ngày (vercel.com/docs/plans/hobby). Đo 11/10: trận mặc định bàn 14 ô = 9 màn
 * minigame, mỗi màn giữ một function 2 GB mở 41 s ⇒ ~0,2 GB-giờ/trận ⇒ trường hợp thưa ~55–60 trận/ngày cho CẢ app. Thứ đắt là
 * TRẬN, không phải người vào app (cổng D207 lo đồng thời, không lo quota) ⇒ nhả TRẬN theo quỹ.
 *
 * HAI LỚP, MỘT BẢNG SỐ (D61 — Worker lẫn server đọc đúng file này):
 *   1. CỬA CHÍNH — cổng Worker (`web/worker/suat.js`): FIFO có số thứ tự + giờ dự kiến; quỹ NGÀY chia theo GIỜ VN bằng
 *      `TRONG_SO_GIO` (dồn tối); suất giờ trước không dùng hết thì CỘNG DỒN sang giờ sau trong ngày. Đếm bằng 201 thật.
 *   2. LƯỚI — server (`server/suat_tran.ts`): cổng fail-open (DO lỗi / thiếu secret ⇒ cho qua) nên server tự đếm trận tạo trong
 *      ngày VN và từ chối `het_suat_ngay` khi chạm `TRAN_NGAY_SERVER`. Lưới, không phải cửa: ≥ quỹ của cổng.
 * Admin (kể cả tester — tester ⊂ admin) MIỄN cả hai lớp và KHÔNG ăn suất. Trận tập + bàn ngày/bàn đôi TÍNH vào quỹ (founder 11/10: A).
 *
 * ⚠⚠ MỌI SỐ Ở ĐÂY LÀ PLAYTEST-TUNE (A8.2 tinh thần — số vận hành, cửa sổ VẬN HÀNH đo GB-giờ thật trên trang Usage rồi founder chốt).
 *   Giá trị hiện tại là TẠM THẬN TRỌNG do cửa sổ thi công đặt, dưới mức ~55–60 trận/ngày của phép đo thưa 11/10.
 *
 * ⚠ ĐIỀU KIỆN GỠ/NÂNG (A11.15): dòng nhịp minigame 41 s không còn chạy trên Vercel ⇒ trần kế là lượt gọi ~1 triệu/tháng; nâng
 *   `QUY_NGAY` theo phép đo mới (SPEC mục 3).
 *
 * ⚠ GIỜ VIỆT NAM = UTC+7 CỐ ĐỊNH (không giờ mùa hè) ⇒ toán ở đây cộng 7 giờ, không cần thư viện múi giờ. DB vẫn lưu UTC (A8.8).
 */

/** Một giờ / một ngày theo ms. */
const GIO_MS = 3_600_000;
const NGAY_MS = 24 * GIO_MS;
/** Lệch UTC → giờ Việt Nam. */
export const LECH_VN_MS = 7 * GIO_MS;

export interface CauHinhSuat {
  QUY_NGAY: number;
  TRAN_NGAY_SERVER: number;
  TRONG_SO_GIO: readonly number[];
  HAN_GIU_MS: number;
  AN_HAN_CHO_MS: number;
  HOI_LAI_MIN_S: number;
  HOI_LAI_MAX_S: number;
  HAN_VE_MIEN_S: number;
}

export const SUAT_TRAN: Readonly<CauHinhSuat> = {
  /** PLAYTEST-TUNE — quỹ trận MỚI mỗi ngày VN mà cổng Worker nhả (không tính admin). */
  QUY_NGAY: 40,
  /** PLAYTEST-TUNE — lưới cứng ở server, ≥ `QUY_NGAY` (bài canh khoá bất đẳng thức này). */
  TRAN_NGAY_SERVER: 48,
  /**
   * PLAYTEST-TUNE — trọng số 24 giờ VN (chỉ số = giờ 0..23). Dồn buổi tối (19–22h) — giờ người trẻ rảnh. Giờ trọng số 0 vẫn chơi
   * được nếu giờ trước còn suất thừa (cộng dồn), chỉ không SINH thêm suất.
   */
  TRONG_SO_GIO: [
    2, 1, 0, 0, 0, 0, // 0h–5h
    1, 2, 2, 2, 2, 3, // 6h–11h
    4, 3, 2, 2, 3, 4, // 12h–17h
    5, 7, 8, 8, 6, 3, // 18h–23h
  ],
  /** Giữ suất bao lâu khi đã nhả mà Vercel chưa trả kết quả (ms). Quá hạn ⇒ suất về quỹ (Worker chết giữa chừng). */
  HAN_GIU_MS: 60_000,
  /**
   * Ân hạn cho người đứng chờ (ms), CỘNG THÊM vào nhịp hỏi đã bảo họ: im quá `hoi_lai_s + ÂN_HẠN` ⇒ rời hàng (không giữ chỗ ma).
   * 90 s vì Chrome dồn hẹn giờ của tab ẩn về ~1 lần/phút — đá người chỉ vì tab ẩn là phạt người đang làm đúng điều ta bảo
   * ("vẫn lướt Hub trong lúc chờ").
   */
  AN_HAN_CHO_MS: 90_000,
  /** Nhịp hỏi lại khi đang chờ (giây): ¼ thời gian còn tới giờ dự kiến, kẹp trong [MIN, MAX] — xa thì thưa, gần thì dày. */
  HOI_LAI_MIN_S: 5,
  HOI_LAI_MAX_S: 300,
  /** Vé MIỄN suất của admin (Worker ký, gắn với phiên) sống bao lâu (giây). */
  HAN_VE_MIEN_S: 12 * 3600,
};

/** Số thứ tự ngày VN (đếm từ epoch) — đổi lúc 0:00 giờ Việt Nam. */
export function ngayVN(now: number): number {
  return Math.floor((now + LECH_VN_MS) / NGAY_MS);
}

/** Giờ VN 0..23 của mốc `now`. */
export function gioVN(now: number): number {
  return Math.floor(((now + LECH_VN_MS) % NGAY_MS + NGAY_MS) % NGAY_MS / GIO_MS);
}

/** Mốc UTC (ms) của 0:00 giờ VN của ngày chứa `now`. Server dùng làm ranh đếm trận trong ngày. */
export function dauNgayVN(now: number): number {
  return ngayVN(now) * NGAY_MS - LECH_VN_MS;
}

/** Mốc UTC (ms) của 0:00 giờ VN NGÀY MAI — "mở lại lúc". */
export function moLaiLuc(now: number): number {
  return dauNgayVN(now) + NGAY_MS;
}

/** Mốc UTC (ms) bắt đầu giờ VN `gio` (0..23) của ngày chứa `now`. */
export function dauGioVN(now: number, gio: number): number {
  return dauNgayVN(now) + gio * GIO_MS;
}

/**
 * QUỸ LUỸ KẾ tới HẾT giờ `gio` (0..23) trong ngày: ⌊QUY_NGAY × Σw[0..gio] / Σw⌋.
 *
 * ⚠ Luỹ kế rồi mới làm tròn, KHÔNG làm tròn từng giờ rồi cộng: làm tròn từng giờ thì phần lẻ rơi mất mỗi giờ và cuối ngày quỹ
 *   thật < `QUY_NGAY`. Luỹ kế thì giờ 23 ra ĐÚNG `QUY_NGAY`, và "suất thừa cộng dồn" là hệ quả tự nhiên: còn lại = luỹ kế − đã dùng.
 */
export function quyLuyKe(gio: number, ch: Pick<CauHinhSuat, 'QUY_NGAY' | 'TRONG_SO_GIO'> = SUAT_TRAN): number {
  const w = ch.TRONG_SO_GIO;
  const tong = w.reduce((a, b) => a + b, 0);
  if (tong <= 0 || gio < 0) return 0;
  let tich = 0;
  for (let i = 0; i <= Math.min(gio, 23); i += 1) tich += w[i] ?? 0;
  return Math.floor((ch.QUY_NGAY * tich) / tong);
}
