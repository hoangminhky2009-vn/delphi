/**
 * ĐIỂM QUAY VỀ SAU KHI CÓ TÀI KHOẢN (D333).
 *
 * ─── VÌ SAO CÓ ───────────────────────────────────────────────────────────────
 * Buổi đo phát MỘT link (`/arena/ban/<mã>`) cho cả lớp. Người chưa có tài khoản đi qua bốn màn
 * (đăng ký → xác minh email → đăng nhập → hồ sơ) và trước đây rơi về Hub ở cuối — giữa một buổi 60
 * phút, không ai nhớ link ở đâu. Tệp này nhớ đúng MỘT điều: người này đến từ bàn nào.
 *
 * ─── LUẬT ────────────────────────────────────────────────────────────────────
 * · CHỈ nhận đường bàn (`/arena/ban/<5 ký tự>`). Không có đường nào khác được ghi, nên không có
 *   chuyển hướng mở (open redirect) nào đi qua đây — kể cả khi `?ban=` trong link email bị sửa tay.
 * · ĐỌC KHÔNG XOÁ. Sau đăng nhập có HAI chỗ cùng điều hướng (biểu mẫu và effect của màn `/onboard`);
 *   đọc-là-xoá thì chỗ đến sau đọc được rỗng và đá về Hub. Xoá khi đã TỚI bàn (`AlphaDraftLobby`).
 * · Hạn 24 giờ — trùng hạn link xác minh email: quá hạn ấy thì chuỗi đăng ký đã đứt ở chỗ khác.
 * · Kho trình duyệt có thể ném (chế độ riêng tư, bị chặn): mọi lời gọi bọc try/catch, hỏng thì app
 *   chạy như chưa có tệp này.
 */
const KHOA = 'dp_quay_ve';
const HAN_MS = 24 * 60 * 60 * 1000;
const MAU_DUONG = /^\/arena\/ban\/([a-z0-9]{5})$/;

/** Mã bàn hợp lệ → đường bàn; sai hình dạng → null. */
export function duongBanTuMa(ma: unknown): string | null {
  if (typeof ma !== 'string') return null;
  const m = ma.trim().toLowerCase();
  return /^[a-z0-9]{5}$/.test(m) ? `/arena/ban/${m}` : null;
}

/** Ghi điểm quay về — chỉ khi `duong` là đường bàn. Trả về có ghi hay không. */
export function ghiDiemQuayVe(duong: string, bayGio: number = Date.now()): boolean {
  if (!MAU_DUONG.test(duong)) return false;
  try {
    window.localStorage.setItem(KHOA, JSON.stringify({ d: duong, t: bayGio }));
    return true;
  } catch {
    return false;
  }
}

/** Đường bàn đang nhớ, còn hạn và đúng hình dạng; không có → null. KHÔNG xoá. */
export function docDiemQuayVe(bayGio: number = Date.now()): string | null {
  try {
    const tho = window.localStorage.getItem(KHOA);
    if (!tho) return null;
    const v = JSON.parse(tho) as { d?: unknown; t?: unknown };
    if (typeof v.d !== 'string' || !MAU_DUONG.test(v.d)) return null;
    if (typeof v.t !== 'number' || bayGio - v.t > HAN_MS || v.t > bayGio + 60_000) return null;
    return v.d;
  } catch {
    return null;
  }
}

/** Mã bàn của điểm quay về (gửi kèm lượt đăng ký để server đổi xô hạn mức). */
export function maBanQuayVe(bayGio: number = Date.now()): string | null {
  const d = docDiemQuayVe(bayGio);
  return d ? d.slice('/arena/ban/'.length) : null;
}

export function xoaDiemQuayVe(): void {
  try {
    window.localStorage.removeItem(KHOA);
  } catch {
    /* kho bị chặn — không có gì để xoá */
  }
}
