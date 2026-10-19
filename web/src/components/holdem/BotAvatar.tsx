/**
 * AVATAR MỘT GHẾ — rẽ theo BẢN CHẤT ghế, không theo mã ghế.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LỖI ĐÃ SỐNG TRÊN PROD VÀ ĐÃ SỬA Ở ĐÂY (founder báo 27/07).
 *
 * Bản cũ: `DoiThuStrip` gọi `<BotAvatar gheId={d.ghe_id}/>` cho MỌI ghế kể cả ghế
 * người (`ghe_id === 'ban'`), mà `BotAvatar` sinh hình từ `bam(gheId)`. Nên avatar
 * người chơi là hình băm ra từ chuỗi `"ban"` — GIỐNG HỆT NHAU ở mọi trận, với mọi
 * người. Hai thiệt hại, cái thứ hai nặng hơn:
 *
 *   · Vi phạm D25/R3 THEO CHIỀU NGƯỢC: người đang mang mặt máy.
 *   · Làm rỗng tiền đề D25 ("đối thủ thấy mình = cái để mất"): phải có một MÌNH
 *     để mà thấy. Nếu mọi người chơi là cùng một robot thì cột dữ liệu ảnh hưởng
 *     xã hội đang đo một HẰNG SỐ, và cột đó là thứ D25 dựng cả bộ luật để bảo vệ.
 *
 * Bản sửa rẽ theo `loai` chứ không phải "chừa một trường hợp đặc biệt cho ghế
 * 'ban'": nếu rẽ theo mã ghế thì ngày nào có ghế người thứ hai (đấu rank toàn
 * người thật — D31) là lỗi quay lại nguyên vẹn.
 *
 * ⚠ BOT BĂM THEO DANH TÍNH, KHÔNG THEO VỊ TRÍ. Mã ghế là VỊ TRÍ; danh tính bot là
 * nhãn archetype (`ten` = "Máy · <nhãn>"). Docstring cũ hứa "cùng ghế → cùng khuôn
 * mặt, người chơi nhận ra *lại con này*" — nhưng băm vị trí thì lời hứa đó thực ra
 * là "lại cái ghế này", một câu vô nghĩa với người chơi.
 */
import type { CoAvatar } from '@config/avatar';
import { useMe } from '@/api/queries';
import { Avatar, AvatarBot } from '@/components/ui';

/**
 * Một ghế bất kỳ trên bàn.
 *
 * ⚠ HAI SHAPE KHÁC NHAU, không phải một shape có trường để trống: người có `dm`,
 * máy có `hat`. Trường để trống là chỗ có ngày sẽ bị điền — và ngày đó là ngày
 * bot có avatar người, tức đúng thứ D25/R3 cấm.
 */
type Ghe =
  | { loai: 'nguoi'; dm: string | null | undefined }
  | { loai: 'may'; hat: string };

export function GheAvatar({
  ghe, size = 32, ten,
}: { ghe: Ghe; size?: CoAvatar; ten?: string }) {
  return ghe.loai === 'nguoi'
    ? <Avatar dm={ghe.dm} size={size} alt={ten ? `Ảnh đại diện của ${ten}` : ''} />
    : <AvatarBot hat={ghe.hat} size={size} alt={ten ? `Đối thủ máy ${ten}` : ''} />;
}

/**
 * Avatar một ghế trong BẢNG KẾT TRẬN — tự lấy diện mạo của chính mình.
 *
 * ⚠ VÌ SAO LÀ MỘT COMPONENT RIÊNG chứ không gọi `useMe` ngay trong màn trận:
 * tường lửa D24 cấm một MÀN import cả `api/holdem` (ví trận) lẫn `api/queries`
 * (ví T). Màn trận đã dùng ví trận, nên nó không được chạm `useMe`. Gói việc
 * đọc diện mạo vào một component (đúng cách `MomentOverlay` đang làm) thì luật
 * còn nguyên mà màn kết vẫn có mặt người.
 *
 * Payload trận chỉ mang diện mạo của NGƯỜI KHÁC — mặt mình nằm sẵn trong
 * `/auth/me` nên đây là 0 request thêm.
 */
export function GheAvatarKet({
  loai, ten, laToi, size = 32,
}: { loai: string; ten: string; laToi: boolean; size?: CoAvatar }) {
  const dmCuaToi = useMe().data?.user?.dien_mao ?? null;
  return (
    <GheAvatar
      ghe={loai === 'nguoi'
        ? { loai: 'nguoi', dm: laToi ? dmCuaToi : null }
        : { loai: 'may', hat: ten }}
      ten={ten}
      size={size}
    />
  );
}
