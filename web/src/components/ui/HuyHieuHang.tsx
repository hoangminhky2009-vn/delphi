/**
 * HUY HIỆU HẠNG + STICKER VINH DANH — component dùng chung (SPEC docs/spec/huy-hieu-hang-sticker.md).
 *
 * Art ở `@/lib/huy_hieu` (một nguồn, chép từ demo đã duyệt); tên kim loại + id sticker ở `config/rank.ts`.
 * Hub (cửa sổ UI), Hồ sơ và các màn sau cùng import file này — đừng vẽ huy hiệu ở chỗ khác.
 *
 * ⚠ `bac` THIẾU (`null`/`undefined`) ⇒ KHÔNG RENDER GÌ. Client cũ chưa có `user.bac`, và người CHƯA XẾP BẬC
 * không có huy hiệu: vẽ một huy hiệu mặc định ở đó là bịa hạng (D62 — thiếu mẫu là `null`, không bao giờ là 0).
 * Chỗ giữ sẵn cho lúc dữ liệu chưa về là việc của màn gọi (khung cao cố định), không phải của component này.
 */
import type { BacId } from '@config/rank';
import {
  CHI_SO_BONG_DONG_DAU, chiSoHuyHieu, cumHuyHieu, cumSticker, LUOI_HUY_HIEU, STICKER_HANG,
} from '@/lib/huy_hieu';
import s from './HuyHieuHang.module.css';

export interface HuyHieuHangProps {
  bac: BacId | null | undefined;
  /** Cạnh vuông, px. Lưới 40 ô nên bội số của 40 (40/80/120) nét nhất; 46/56 vẫn dùng được (demo). */
  size?: number;
  /** Bậc chưa đạt (thang toàn cảnh): xám, không bóng động. */
  chuaDat?: boolean;
  /** Nhãn đọc cho trình đọc màn hình. Vắng ⇒ `aria-hidden` (huy hiệu chỉ trang trí, nhãn nằm cạnh). */
  nhan?: string;
  className?: string;
}

export function HuyHieuHang({ bac, size = 46, chuaDat = false, nhan, className }: HuyHieuHangProps) {
  const t = chiSoHuyHieu(bac);
  if (t === null) return null;
  const cls = [s.hh, s[`hh${t}`], chuaDat ? s.chua : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <svg
      className={cls}
      width={size}
      height={size}
      viewBox={`0 0 ${LUOI_HUY_HIEU} ${LUOI_HUY_HIEU}`}
      shapeRendering="crispEdges"
      data-huy-hieu={bac}
      data-bong-dong={t >= CHI_SO_BONG_DONG_DAU && !chuaDat ? 'true' : 'false'}
      {...(nhan ? { role: 'img', 'aria-label': nhan } : { 'aria-hidden': true })}
    >
      {cumHuyHieu(t).map((o, i) => (
        <rect key={i} x={o.x} y={o.y} width={o.w + 0.02} height={1.02} fill={o.fill} />
      ))}
    </svg>
  );
}

export interface StickerHangProps {
  /** id sticker (`BAC_THANG[].sticker`, vd `st_hh_tom`). Id lạ ⇒ không render. */
  id: string | null | undefined;
  size?: number;
  /** Chưa có: bóng xám đặc. */
  chua?: boolean;
  nhan?: string;
  className?: string;
}

export function StickerHang({ id, size = 40, chua = false, nhan, className }: StickerHangProps) {
  const luoi = id ? STICKER_HANG[id] : undefined;
  if (!luoi) return null;
  const { cum, n } = cumSticker(luoi);
  return (
    <svg
      className={[chua ? s.stickerChua : '', className ?? ''].filter(Boolean).join(' ') || undefined}
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      data-sticker={id}
      {...(nhan ? { role: 'img', 'aria-label': nhan } : { 'aria-hidden': true })}
    >
      {cum.map((o, i) => (
        <rect key={i} x={o.x} y={o.y} width={o.w + 0.02} height={1.02} fill={o.fill} />
      ))}
    </svg>
  );
}
