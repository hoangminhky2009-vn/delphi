/**
 * CỬA DISCORD — tham số + phần logic THUẦN (bản yêu cầu 02, mùa 0.0).
 *
 * ⚠ Đây KHÔNG phải tham số kinh tế (A4/A8.2). Không một T hay Q nào đổi chủ vì
 * mấy hằng số dưới đây.
 *
 * Chỉ để những thứ TÍNH ĐƯỢC MÀ KHÔNG CẦN DB ở file này, để test chạy được không
 * cần dựng Postgres — phần đụng DB (tìm-hoặc-tạo tài khoản) nằm ở `server/`.
 */
import { AUTH, handleBlockReason } from './auth.js';

/** Tên nhà cung cấp trong `auth_identities.provider`. Khớp CHECK của migration 0029. */
export const NHA_CUNG_CAP = 'discord' as const;

export const DISCORD = {
  /**
   * Scope tối thiểu. `identify` cho biết "người này là ai" — không xin email,
   * không xin danh sách server.
   *
   * ⚠ C7: xin ít nhất có thể là một quyết định, không phải sự lười. Mỗi scope
   * thừa là một loại dữ liệu ta phải giải thích vì sao mình giữ. Và Discord
   * KHÔNG cấp năm sinh ở bất kỳ scope nào ⇒ age gate C8 vẫn phải tự hỏi (bậc 1).
   */
  SCOPES: ['identify'] as const,

  /** Đổi mã lấy token — endpoint công khai của Discord. */
  URL_TOKEN: 'https://discord.com/api/oauth2/token',
  /** Hỏi "người này là ai" bằng access_token vừa đổi được. */
  URL_ME: 'https://discord.com/api/users/@me',

  /**
   * Hạn chờ khi gọi sang Discord.
   * ⚠ `fetch` KHÔNG tự bỏ cuộc — D57 đã trả giá cho bài học này ở phía client
   * ("trận trông như chết"). Ở đây hậu quả còn tệ hơn: một hàm serverless treo
   * tới lúc Vercel giết nó, và người chơi thấy màn hình đứng im không lý do.
   */
  HAN_CHO_MS: 10_000,

  /**
   * HẠN CHỜ TỪNG BƯỚC BẮT TAY, PHÍA MÁY NGƯỜI CHƠI.
   *
   * ⚠⚠ VÌ SAO PHẢI CÓ (đo được 04/08): `main.tsx` CHỜ bắt tay xong rồi mới render,
   * và nó bắt `throw` — nhưng **KHÔNG bắt được TREO**. Nạp app với `frame_id` mà
   * không có Discord client thật thì `sdk.ready()` chờ một thông điệp không bao
   * giờ tới ⇒ `#root` RỖNG VĨNH VIỄN, không lỗi, không chữ, không nút.
   * Đúng lớp lỗi D57 đã đặt tên ở `fetch` ("trận trông như chết"), lần này ở chỗ
   * tệ hơn: nó ăn CẢ MÀN HÌNH ĐẦU TIÊN.
   *
   * ⚠ HAI MỨC, và chênh lệch là CÓ CHỦ Ý:
   *   · `HAN_BUOC_MAY_MS` cho các bước MÁY-VỚI-MÁY (nạp SDK · ready ·
   *     authenticate). Bình thường dưới một giây; quá vài giây là hỏng thật.
   *   · `HAN_BUOC_NGUOI_MS` cho `authorize` — bước này DỪNG LẠI CHỜ NGƯỜI bấm
   *     Phê duyệt. Kẹp nó bằng hạn của máy là tự tay giết hộp cấp quyền của chính
   *     mình đúng lúc người ta đang đọc. Vẫn có trần, vì hộp không hiện ra được
   *     thì màn trắng quay lại — nhưng trần đo bằng kiên nhẫn của người, không
   *     phải bằng độ trễ của mạng.
   */
  HAN_BUOC_MAY_MS: 8_000,
  HAN_BUOC_NGUOI_MS: 120_000,

  /**
   * Tên tự cấp khi không dùng được tên Discord. Cộng 6 ký tự ngẫu nhiên là 17,
   * vừa trong trần 20 của `HANDLE_PATTERN`.
   */
  TEN_DU_PHONG_TIEN_TO: 'nguoi_choi_',
  TEN_DU_PHONG_SO_KY_TU: 6,

  /** Số lần thử thêm hậu tố khi tên đã có người dùng, trước khi bỏ cuộc. */
  SO_LAN_THU_TRUNG_TEN: 5,

  /**
   * Số lượt ghi danh lại khi THUA CUỘC ĐUA (`ON CONFLICT` khớp 0 dòng ⇒ người
   * khác vừa tạo xong danh tính này).
   *
   * ⚠ Vì sao là một CON SỐ chứ không phải đệ quy không đáy như bản đầu: lượt thứ
   * hai gần như chắc chắn thấy hàng của người thắng qua đường SELECT nhanh, nên
   * 2 là đủ và 3 là dư. Nhưng "gần như chắc chắn" mà không có trần thì một trạng
   * thái dữ liệu bất thường (có `auth_identities` mà `auth_accounts.user_id` NULL)
   * biến thành **vòng lặp vô tận trong một request** — hỏng im lặng, không có lỗi
   * nào để lần theo. Hết lượt thì ném lỗi hệ thống, đọc được ở log.
   */
  SO_LAN_THU_DUA: 3,
} as const;

/* ══════════════════════════════════════════════════════════════════════════
 * TÊN HIỂN THỊ
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Bỏ dấu tiếng Việt. Tự viết vì repo chưa có, và vì `normalize('NFD')` + bỏ dấu
 * tổ hợp là cách ngắn nhất mà không kéo thêm thư viện (C1, A8.9).
 *
 * ⚠ `đ`/`Đ` KHÔNG phải chữ có dấu tổ hợp — nó là một ký tự riêng, NFD không tách
 * ra được. Quên nó thì "đức" thành "c" (mất luôn chữ đầu), tức tên người Việt bị
 * cắt cụt một cách im lặng. Phải thay tay trước.
 */
export function boDau(s: string): string {
  return s
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    // Viết bằng mã điểm chứ không dán ký tự tổ hợp vào nguồn: dấu tổ hợp là ký
    // tự vô hình, dán vào rồi có ngày một trình soạn thảo nuốt mất mà không ai thấy.
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Đổi tên Discord thành `handle` hợp lệ, hoặc `null` nếu không dùng được.
 *
 * ⚠⚠ VÌ SAO "LẤY LUÔN TÊN DISCORD" KHÔNG PHẢI MỘT LỰA CHỌN THẬT:
 * `AUTH.HANDLE_PATTERN` chỉ nhận `a–z 0–9 _`, mà tên Discord có hoa, có dấu, có
 * chấm, có emoji. Nên LUÔN phải chuyển đổi — và đã chuyển đổi thì phải qua
 * `handleBlockReason`, vì đó là luật cho MỌI handle vào bảng `users` (D25/R2),
 * không phải một lớp thêm cho vui.
 * ⇒ "lấy tên Discord" và "lấy tên Discord có lọc" là CÙNG MỘT ĐOẠN CODE.
 *
 * Trả `null` thay vì tự sửa thành thứ gần giống: một cái tên bị bẻ cho lọt lưới
 * vẫn là cái tên người ta cố tình đặt. Không dùng được thì cấp tên trung tính.
 */
export function handleTuTenDiscord(ten: string): string | null {
  if (typeof ten !== 'string') return null;

  let h = boDau(ten)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')   // mọi thứ lạ thành gạch dưới
    .replace(/_+/g, '_')            // gộp gạch dưới liền nhau
    .replace(/^_+|_+$/g, '');       // bỏ gạch dưới ở hai đầu

  if (h.length > 20) h = h.slice(0, 20).replace(/_+$/g, '');
  // Dưới 3 ký tự thì không cứu được bằng cách đệm thêm — đệm là bịa ra một cái
  // tên khác rồi vờ như đó là tên của họ.
  if (h.length < 3) return null;
  if (!AUTH.HANDLE_PATTERN.test(h)) return null;
  if (handleBlockReason(h) !== null) return null;
  return h;
}

/**
 * Tên trung tính khi không dùng được tên Discord.
 * ⚠ Nhận hàm sinh ngẫu nhiên từ ngoài để test tất định được — `Math.random()`
 * gọi thẳng trong này là tự làm cho chính mình không kiểm được.
 */
export function tenDuPhong(ngauNhien: () => string): string {
  const duoi = ngauNhien().replace(/[^a-z0-9]/g, '').slice(0, DISCORD.TEN_DU_PHONG_SO_KY_TU);
  return `${DISCORD.TEN_DU_PHONG_TIEN_TO}${duoi.padEnd(DISCORD.TEN_DU_PHONG_SO_KY_TU, '0')}`;
}
