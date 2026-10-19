/**
 * AVATAR NGƯỜI CHƠI — lưới pixel 32×32, một component cho MỌI bề mặt.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BA BỀ MẶT, MỘT HÀM. Hồ sơ (96px) · dải đối thủ trong trận (32px) · khoảnh khắc
 * toàn màn (96px) đều gọi đúng component này với một `size` khác nhau. Không có
 * nhánh riêng cho bề mặt nào — nhánh riêng là cách hai bề mặt bắt đầu vẽ khác nhau.
 *
 * ⚠ CỠ PHẢI LÀ BỘI SỐ NGUYÊN CỦA 32. Không phải sở thích: nhân không nguyên thì
 * mỗi ô rộng khác nhau và hình RUNG ở cỡ nhỏ. Repo đã có sẵn vết thương này —
 * `PixelIcon` làm tròn `size` một cách IM LẶNG, nên `size={26}` của dải đối thủ
 * bản cũ thực ra vẫn render 32px mà không ai biết. Ở đây SVG có viewBox 32×32 nên
 * trình duyệt co giãn tuyến tính; `CO_AVATAR` + `imageRendering: pixelated` giữ
 * mép sắc, và cỡ ngoài danh sách bị chặn ở tầng kiểu.
 *
 * ⚠ `dangerouslySetInnerHTML` AN TOÀN Ở ĐÂY vì chuỗi SVG do CHÍNH TA sinh ra từ
 * lưới ký tự trong `config/avatar_art.ts` — người chơi không đưa được một ký tự
 * nào vào đó. Đầu vào duy nhất của họ là 19 ký tự từ một bảng chữ ĐÓNG, và mọi ký
 * tự đó chỉ dùng để TRA BẢNG chứ không bao giờ được nối vào markup.
 */
import { useMemo } from 'react';
import { veAvatarSVG, veBotSVG } from '@config/avatar_art';
import type { CoAvatar } from '@config/avatar';
import s from './Avatar.module.css';
import { htmlTinh } from '@/lib/html_tinh';

interface Props {
  /** Chuỗi diện mạo 19 ký tự. `null`/hỏng → lá mặc định, KHÔNG phải ô trống. */
  dm: string | null | undefined;
  size?: CoAvatar;
  /** Mô tả cho trình đọc màn hình. Rỗng = ảnh trang trí (đã có tên bên cạnh). */
  alt?: string;
  className?: string;
}

export function Avatar({ dm, size = 32, alt, className }: Props) {
  // Dựng SVG là việc thuần và tất định, nhưng nó chạy trên MỌI ghế của MỌI lần
  // render lại của dải đối thủ (bàn 8 ghế × mỗi vòng). Memo theo chuỗi vì chuỗi
  // là toàn bộ đầu vào — không có state ẩn nào khác.
  const svg = useMemo(() => veAvatarSVG(dm), [dm]);
  return (
    <span
      className={`${s.o} ${className ?? ''}`}
      style={{ width: size, height: size }}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      dangerouslySetInnerHTML={htmlTinh(svg)}
    />
  );
}

/**
 * AVATAR BOT — cùng lưới, cùng bảng màu, cùng renderer. KHÁC NGÔN NGỮ HÌNH.
 *
 * D25/R3: bot phải LỘ MẶT LÀ BOT. Không đạt điều đó bằng "bot chưa được làm
 * pixel" (một tín hiệu sẽ tự tan vào ngày ai đó dọn art bot) mà bằng sáu đặc điểm
 * hình học ghi trong `config/avatar_art.ts` — và bằng một điều mạnh hơn cả sáu:
 * bot không có `user_id`, nên không có dòng sở hữu nào, nên KHÔNG THỂ có khung
 * hay phụ kiện dù ai đó có muốn.
 *
 * ⚠ `hat` là DANH TÍNH bot (nhãn archetype), không phải mã ghế — xem `veBotSVG`.
 */
export function AvatarBot({
  hat, size = 32, alt, className,
}: { hat: string; size?: CoAvatar; alt?: string; className?: string }) {
  const svg = useMemo(() => veBotSVG(hat), [hat]);
  return (
    <span
      className={`${s.o} ${s.may} ${className ?? ''}`}
      style={{ width: size, height: size }}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      dangerouslySetInnerHTML={htmlTinh(svg)}
    />
  );
}
