/**
 * TOKEN PHIÊN CỦA CỬA DISCORD (và của chế độ KHÁCH).
 *
 * Một module bé xíu, tách riêng vì hai lý do:
 *
 *  1. `api/client.ts` cần đọc token, nhưng nó KHÔNG được kéo theo SDK Discord —
 *     `client.ts` nằm trên đường chạy của mọi request kể cả bản web thường.
 *     Tách ra thì phần bắt tay (nặng, chỉ Discord cần) không dính vào đây.
 *
 *  2. ⚠⚠ **KHÔNG `localStorage` Ở BẢN WEB.** Cookie phiên của web là `HttpOnly`
 *     nên XSS không đọc được; nếu token nằm trong `localStorage` thì ta vừa tự
 *     tay dựng lại đúng cái lỗ hổng mà `HttpOnly` sinh ra để bịt.
 *
 * ─── ⚠⚠ VÀ TRONG DISCORD THÌ NGƯỢC LẠI — ĐỌC KỸ TRƯỚC KHI "SỬA CHO NHẤT QUÁN" ──
 *
 * Trong Activity, giữ token CHỈ trong bộ nhớ nghe có vẻ an toàn hơn, nhưng cái
 * giá của nó không nằm ở bảo mật — nó nằm ở DANH TÍNH:
 *
 *   · iframe chết theo mỗi lượt mở Activity, và trong Discord không có cookie
 *     (`SameSite=Lax` không được gửi xuyên site) ⇒ **mỗi lần mở lại là một người
 *     mới**;
 *   · người chơi vào thẳng KHÁCH (không biểu mẫu) ⇒ mỗi lần mở lại đẻ MỘT HÀNG
 *     `users` mới;
 *   · `events` trỏ vào `user_id` và **append-only tuyệt đối** (A3.3) ⇒ lịch sử
 *     của cùng một người vỡ vĩnh viễn thành N mảnh, không gộp lại được kể cả
 *     sang mùa mới.
 * D64 luật 3 gọi đúng tên nhóm này: **danh tính là cửa MỘT CHIỀU**, chỗ duy nhất
 * của mùa 0.0 vẫn phải cẩn thận kiểu doanh nghiệp.
 *
 * Đổi lại, thứ đem ra đánh cược trong Discord nhẹ hơn hẳn: tài khoản ở đó là bậc
 * 0 — **không email, không mật khẩu, ví 0 T** (Đấu trường không đụng `bankroll`,
 * `holdem_api.ts:20`). Và origin `{clientId}.discordsays.com` chỉ phục vụ đúng
 * bundle này.
 * ⇒ Bền trong Discord, bộ nhớ ở web. Không phải sự thiếu nhất quán, mà là hai
 * cán cân khác nhau ở hai chỗ khác nhau.
 */
import { trongDiscord } from './trong_discord';

/** Khoá riêng, có version — đổi hình dạng thì đổi số, không đọc nhầm bản cũ. */
const KHOA = 'delphi.phien.discord.v1';

function docKho(): string | null {
  if (!trongDiscord()) return null;
  try {
    return window.localStorage.getItem(KHOA);
  } catch {
    // Chế độ riêng tư / bộ nhớ đầy / bị chặn. Không phải lỗi — chỉ là không bền.
    return null;
  }
}

let token: string | null = docKho();

export function datTokenDiscord(t: string | null): void {
  token = t;
  if (!trongDiscord()) return;
  try {
    if (t) window.localStorage.setItem(KHOA, t);
    else window.localStorage.removeItem(KHOA);
  } catch {
    /* không cất được thì thôi — phiên vẫn sống hết lượt mở này */
  }
}

export function layTokenDiscord(): string | null {
  return token;
}
