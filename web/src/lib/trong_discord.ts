/**
 * "ĐANG CHẠY TRONG ACTIVITY DISCORD HAY KHÔNG" — MỘT NGUỒN CHÂN LÝ DUY NHẤT.
 *
 * Tách thành module riêng vì BA chỗ cần hỏi câu này, và chúng không được phép
 * trả lời khác nhau:
 *   · `lib/discord.ts`   — có bắt tay hay không;
 *   · `lib/discord_phien.ts` — phiên cất ở đâu (bộ nhớ hay đĩa);
 *   · `app/AppShell.tsx` — bố cục ngang hay dọc.
 * Chép logic ra ba chỗ là dựng sẵn ba câu trả lời sẽ có ngày lệch nhau.
 *
 * ⚠ Module này KHÔNG import gì cả, có chủ ý: `api/client.ts` nằm trên đường chạy
 * của MỌI request kể cả bản web thường, nên thứ nó kéo theo phải rẻ tuyệt đối —
 * và tuyệt đối không kéo theo SDK Discord.
 *
 * ⚠⚠ CHỐT MỘT LẦN LÚC NẠP, KHÔNG ĐỌC LẠI MỖI LẦN GỌI (bug thật 04/08).
 * Discord tiêm `frame_id` vào URL của iframe, nhưng chỉ ở LẦN NẠP ĐẦU. App là
 * SPA: bấm sang Ví/Hồ sơ/Shop là React Router thay URL và query string RỤNG. Đọc
 * lại mỗi lần gọi thì từ cú bấm thứ hai trở đi cả app tưởng mình đã ra khỏi
 * Discord — bố cục ngang tắt, co về cột điện thoại giữa một khung rộng, và
 * KHÔNG có lỗi nào được ném.
 * "Đang trong Activity" là sự thật của CẢ LƯỢT MỞ, không phải của URL lúc này.
 */

function docThamSo(ten: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(ten);
  } catch {
    return null;
  }
}

const TRONG_DISCORD: boolean = docThamSo('frame_id') !== null;

/**
 * Nền tảng Discord khai trong URL. Chốt cùng lúc với `frame_id` vì cùng lý do.
 *
 * ⚠ Ghi lại nó KHÔNG phải để trang trí: founder hỏi *"sao không mở được trên
 * discord mobile"* và telemetry hôm nay KHÔNG trả lời được — mọi dòng
 * `loi_client` đều giống hệt nhau dù đến từ máy tính hay điện thoại. Một cột
 * không có thì câu hỏi đó không có cách nào hỏi.
 */
const NEN_TANG: string | null = docThamSo('platform');

export function trongDiscord(): boolean {
  return TRONG_DISCORD;
}

/** `pc` · `mb` · `?` — gọn để nhét vừa mã lỗi telemetry (mẫu `ma`, ≤40 ký tự). */
export function nenTangGon(): string {
  if (NEN_TANG === null) return '?';
  return /mobile|ios|android/i.test(NEN_TANG) ? 'mb' : 'pc';
}
