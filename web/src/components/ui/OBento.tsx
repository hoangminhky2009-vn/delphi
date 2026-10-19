/**
 * Ô BENTO + NÚT CHÍNH — LỚP GIỮA của trục Z (SPEC `ui-tang-khong-gian`): ô nổi có bóng pixel cứng, MỘT việc chính khi chạm.
 * Dùng chung cho Hub, Alpha Draft và PFM (A11.5) — nơi nào cũng ra cùng một CẢM GIÁC bấm.
 *
 * ─── LUẬT PHẢN HỒI KHI CHẠM (docs/ui-ux/09-tang-khong-gian.md §3; màn không cuộn ⇒ cảm giác bấm là tất cả) ────────────
 *  1. NHẤN XUỐNG: ô LÚN 3 px, tắt bóng, viền sáng lam — TỨC THÌ (≤ 0,05 s; `NHIP.HUB_LUN`), kèm rung máy 8 ms nếu có.
 *  2. THẢ TAY: ô NẢY về chỗ cũ, vượt nhẹ rồi co (`cubic-bezier` ở `motion.module.css`).
 *  3. NÚT CHÍNH (`NutChinh`): lún 4 px, phụt HẠT PIXEL, 0,12 s SAU mới đổi màn (người chơi thấy hạt rồi mới đi).
 *  4. GIỮ 0,45 s (`onGiu`): thanh nạp pixel chạy dọc đáy ô; đầy thì rung và bung thông tin. CHỈ cho ô đi-thẳng.
 *  5. Ô KHOÁ (`khoa`): lắc ngang 0,16 s rồi mới `onChon` (bung lý do).
 *
 * ⚠⚠ LÚN BẰNG JS, KHÔNG BẰNG `:active`: trên màn chạm `:active` đến muộn và rơi mất khi ngón trượt khỏi ô, còn desktop thì
 *   `:hover` đang bật (xem `.card.card:active` ở lịch sử Hub). Một lớp `lun` bật ở `pointerdown` và gỡ ở mọi đường thả (up ·
 *   leave · cancel) là cách duy nhất cho đúng ≤ 0,05 s trên cả hai.
 * ⚠ `as="div"`: ô CHỨA nút khác (ô Đấu trường chứa banner + nút VÀO TRẬN) không được là `<button>` (button lồng button hỏng
 *   HTML). Con tự lo cú lún của mình bằng `data-tu-lun`; ô cha chỉ lún khi ngón rơi vào phần còn lại và lo cú GIỮ.
 */
import {
  useCallback, useEffect, useRef, useState,
  type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import { phutHat, tamPhanTu } from '@/lib/hat_pixel';
import { NHIP } from '@/lib/nhip';
import { NHIP_RUNG, rung } from '@/lib/rung';
import s from './OBento.module.css';

/** Bật/tắt lớp lún theo con trỏ — dùng chung cho ô và nút chính. */
function useLun() {
  const [lun, datLun] = useState(false);
  const xuong = useCallback((e: ReactPointerEvent<HTMLElement>): boolean => {
    // Chuột phải / giữa không phải một cú chạm.
    if (e.pointerType === 'mouse' && e.button !== 0) return false;
    datLun(true);
    rung(NHIP_RUNG.cham);
    return true;
  }, []);
  const nha = useCallback(() => datLun(false), []);
  return { lun, xuong, nha };
}

export interface OBentoProps {
  /** `div` cho ô chứa nút khác (xem đầu tệp). Mặc định `button`. */
  as?: 'button' | 'div';
  className?: string;
  children: ReactNode;
  /** Chạm. Ô `as="div"` không có (con lo). */
  onChon?: () => void;
  /** Giữ 0,45 s. Có `onGiu` thì ô có thanh nạp. */
  onGiu?: () => void;
  /** Ô khoá: chạm = lắc rồi `onChon` (bung lý do). */
  khoa?: boolean;
  /** Ô phụ mờ hơn (Predict · Lab — D86: hạ xuống nhưng vẫn bấm được). */
  mo?: boolean;
  /** Viền tím — ô to nổi nhất. */
  noiBat?: boolean;
  /** Tên đọc to. */
  nhan?: string;
  /** Dấu cho bài test / soi trình duyệt. */
  dau?: string;
  disabled?: boolean;
  /** Biến CSS riêng của ô (vd `--i` — thứ tự vào so le của màn PFM). Không dùng để ghi đè bố cục. */
  style?: CSSProperties;
}

export function OBento({
  as = 'button', className = '', children, onChon, onGiu, khoa = false, mo = false, noiBat = false, nhan, dau, disabled = false, style,
}: OBentoProps): React.ReactElement {
  const { lun, xuong, nha } = useLun();
  const [giu, datGiu] = useState(false);
  const [lac, datLac] = useState(false);
  const daGiu = useRef(false);
  const henGiu = useRef<ReturnType<typeof setTimeout> | null>(null);
  const henLac = useRef<ReturnType<typeof setTimeout> | null>(null);

  const xoaGiu = useCallback(() => {
    if (henGiu.current !== null) clearTimeout(henGiu.current);
    henGiu.current = null;
    datGiu(false);
  }, []);
  useEffect(() => () => {
    if (henGiu.current !== null) clearTimeout(henGiu.current);
    if (henLac.current !== null) clearTimeout(henLac.current);
  }, []);

  const onXuong = (e: ReactPointerEvent<HTMLElement>): void => {
    daGiu.current = false;
    if (disabled || !xuong(e)) return;
    if (onGiu !== undefined) {
      datGiu(true);
      henGiu.current = setTimeout(() => {
        henGiu.current = null;
        daGiu.current = true;
        datGiu(false);
        nha();
        rung(NHIP_RUNG.nang);
        onGiu();
      }, NHIP.HUB_GIU);
    }
  };
  const onNha = (): void => { xoaGiu(); nha(); };

  const onClick = (_e: ReactMouseEvent<HTMLElement>): void => {
    if (disabled) return;
    // Cú thả sau một cú GIỮ đã bung thông tin rồi — không phải một cú chạm nữa.
    if (daGiu.current) { daGiu.current = false; return; }
    if (khoa) {
      datLac(true);
      if (henLac.current !== null) clearTimeout(henLac.current);
      henLac.current = setTimeout(() => { henLac.current = null; datLac(false); onChon?.(); }, NHIP.HUB_LAC);
      return;
    }
    onChon?.();
  };

  const lop = [s.o, lun ? s.lun : '', giu ? s.giu : '', lac ? s.lac : '', mo ? s.mo : '', noiBat ? s.noiBat : '', className]
    .filter(Boolean).join(' ');
  const chung = {
    className: lop,
    'aria-label': nhan,
    'data-o': dau,
    style,
    onPointerDown: onXuong,
    onPointerUp: onNha,
    onPointerLeave: onNha,
    onPointerCancel: onNha,
    onContextMenu: (e: ReactMouseEvent) => { e.preventDefault(); },
  } as const;
  const nap = onGiu !== undefined ? <span className={s.nap} aria-hidden="true" /> : null;

  if (as === 'div') {
    return <div {...chung}>{children}{nap}</div>;
  }
  return (
    <button type="button" {...chung} onClick={onClick} disabled={disabled}>
      {children}
      {nap}
    </button>
  );
}

export interface NutChinhProps {
  children: ReactNode;
  onChon: () => void;
  className?: string;
  nhan?: string;
  dau?: string;
  disabled?: boolean;
  /** Ô cha lúc nhấn (`as="div"`) cần biết con tự lo cú lún: luôn đặt, đừng gỡ. */
}

/**
 * NÚT CHÍNH của một ô / một lớp trượt: lún 4 px, phụt hạt pixel, rồi MỚI gọi `onChon` (trễ `NHIP.HUB_NUT_TRE`).
 * ⚠ BẤM ĐÚP KHÔNG GỬI TRÙNG: cú chạm thứ hai trong lúc hạt đang phụt bị bỏ — `onChon` chạy đúng MỘT lần mỗi lượt chờ.
 */
export function NutChinh({ children, onChon, className = '', nhan, dau, disabled = false }: NutChinhProps): React.ReactElement {
  const { lun, xuong, nha } = useLun();
  const ref = useRef<HTMLButtonElement | null>(null);
  const dangChay = useRef(false);
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (hen.current !== null) clearTimeout(hen.current); }, []);

  const click = (): void => {
    if (disabled || dangChay.current) return;
    dangChay.current = true;
    phutHat(tamPhanTu(ref.current), 'var(--accent-bright)', 8);
    hen.current = setTimeout(() => {
      hen.current = null;
      dangChay.current = false;
      onChon();
    }, NHIP.HUB_NUT_TRE);
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`${s.vao} ${lun ? s.vaoLun : ''} ${className}`}
      aria-label={nhan}
      data-o={dau}
      data-tu-lun=""
      disabled={disabled}
      onPointerDown={(e) => { e.stopPropagation(); xuong(e); }}
      onPointerUp={nha}
      onPointerLeave={nha}
      onPointerCancel={nha}
      onClick={click}
    >
      {children}
    </button>
  );
}

/**
 * Vùng con tự lo cú lún (banner của ô Đấu trường): ô cha thấy `data-tu-lun` thì đứng yên. Trả props để trải lên phần tử.
 * `lun` là cờ do chính vùng ấy bật/tắt bằng `useLunVung`.
 */
export function useLunVung() {
  const { lun, xuong, nha } = useLun();
  return {
    lun,
    bind: {
      'data-tu-lun': '',
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => { e.stopPropagation(); xuong(e); },
      onPointerUp: nha,
      onPointerLeave: nha,
      onPointerCancel: nha,
    },
  } as const;
}
