/**
 * CHỮ của lời mời cài app — cổng (`screens/CongCaiApp.tsx`), nút màn đăng nhập, thẻ nhắc ở Hub, băng trình duyệt nhúng
 * (SPEC `docs/spec/cai-app-pfm-trong-ban-cai.md` mục 4 + E1–E7, D603 đợt 2). Một nguồn, mọi chỗ đọc từ đây (A11.5).
 *
 * ⚠ Câu "dưới 3 MB" là SỐ ĐO, không phải khẩu hiệu: precache của `web/dist` đo bằng `web/scripts/canh_build.mjs` (chạy sau
 * `vite build` ở CI) — vượt 3 MB thì bài canh đỏ và câu này phải sửa theo số mới.
 */
import type { TrinhDuyet } from './cai_app';

export const CHU_CAI_APP = {
  tieuDe: 'Cài Dự báo để giữ sổ trên máy',
  moDau: 'Bản cài là đúng app này: mở toàn màn hình từ màn hình chính, tự cập nhật, dưới 3 MB.',
  viSao: 'Sổ chi tiêu chỉ mở trong bản cài — trình duyệt có thể tự dọn dữ liệu của trang web, bản cài thì được giữ.',

  // ── iPhone / iPad: ba bước có hình (Apple không cho web tự mời cài) ──
  ios1: 'Bấm nút Chia sẻ',
  ios1Mo: 'Ô vuông có mũi tên lên — thanh dưới (Safari) hoặc góc trên (Chrome).',
  ios2: 'Chọn "Thêm vào MH chính"',
  ios2Mo: 'Chưa thấy thì kéo danh sách lên.',
  ios3: 'Bấm "Thêm", rồi mở Dự báo từ màn hình chính',
  ios3Mo: 'Icon Dự báo nằm cạnh các app khác của bạn.',
  /** E3 — Safari không biết đã cài; bản cài iOS không dùng chung đăng nhập với Safari. */
  daCaiIos: 'Đã cài rồi? Mở Dự báo từ màn hình chính — đăng nhập lại một lần.',

  // ── Android / máy tính: một chạm ──
  caiNgay: 'CÀI APP ▸',
  dangMo: 'ĐANG MỞ HỘP CÀI…',
  /** Trình duyệt chưa (hoặc không) cho mời một chạm ⇒ đường lui qua menu. */
  quaMenu: 'Mở menu ⋮ của trình duyệt → chọn "Cài đặt ứng dụng" (hoặc "Thêm vào màn hình chính").',
  daCaiMenu: 'Đã cài rồi? Mở Dự báo từ màn hình chính.',
  /** E4 — sau `appinstalled`. */
  vuaCai: 'Đã cài xong.',
  moApp: 'MỞ APP ▸',
  moAppLui: 'Không mở được? Mở Dự báo từ màn hình chính.',

  // ── trình duyệt nhúng / trình duyệt không cài được (E2) ──
  nhungMo: (app: string) => `Bạn đang mở Dự báo bên trong ${app} — ở đây không cài được, và dữ liệu dễ mất nhất.`,
  nhungCach: 'Bấm ⋯ hoặc ⋮ ở góc → "Mở bằng trình duyệt". Hoặc chép link rồi dán vào Chrome (Android) / Safari (iPhone).',
  khongCaiDuoc: 'Trình duyệt này không cài được Dự báo. Mở bằng Chrome hoặc Safari để cài & giữ dữ liệu.',
  chepLink: 'CHÉP LINK',
  daChep: 'ĐÃ CHÉP ✓',
  chepHong: 'Không chép được — nhấn giữ link ở trên để chép tay.',

  // ── Discord Activity (E5) ──
  discordMo: 'Bạn đang chơi trong Discord. Mở Dự báo ngoài Discord — Chrome hoặc Safari trên điện thoại — để cài.',

  // ── đang trong bản cài ──
  dangOBanCai: 'Bạn đang dùng bản cài — khu Tài chính đã mở.',
  vaoTaiChinh: 'VÀO TÀI CHÍNH ▸',
  veHub: '‹ về Hub',

  // ── chỗ khác của lời mời ──
  /** Nút cố định ở màn đăng nhập (SPEC mục 4.2). */
  nutDangNhap: '⤓ CÀI APP',
  nutDangNhapMo: 'Mở toàn màn hình, giữ dữ liệu lâu hơn.',
  /** Thẻ nhắc ở Hub (E7). */
  theHub: 'Cài app để lưu dữ liệu lâu hơn',
  theHubDong: 'Ẩn lời nhắc cài app',
  /** Băng trình duyệt nhúng (E6). */
  bang: 'Mở bằng Chrome/Safari để cài & giữ dữ liệu',
  bangDong: 'Thu gọn lời nhắc',
  bangMoLai: 'Mở lại lời nhắc cài app',
} as const;

/** Tên app nhúng để nói thẳng người ta đang ở đâu (E2). */
export function tenAppNhung(t: TrinhDuyet): string {
  switch (t) {
    case 'zalo': return 'Zalo';
    case 'facebook': return 'Facebook';
    case 'messenger': return 'Messenger';
    case 'instagram': return 'Instagram';
    case 'tiktok': return 'TikTok';
    default: return 'một ứng dụng khác';
  }
}
