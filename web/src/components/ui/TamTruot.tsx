/**
 * TẤM TRƯỢT — LỚP TRÊN CÙNG của trục Z (SPEC `ui-tang-khong-gian`): chi tiết · giải thích · luồng nhiều bước, chỉ hiện khi
 * chạm. Một component DÙNG CHUNG — Hub, Alpha Draft và PFM đều mở bằng nó (A11.5: không dựng bản thứ hai; các tấm cũ ở
 * `DoiThuStrip` · `ShopManHinh` · `HopXacNhan` là tiền thân và đang được rút dần về đây).
 *
 * ─── HÀNH VI (luật phản hồi, docs/ui-ux/09-tang-khong-gian.md) ─────────────────────────────────────────────────────
 * · Trồi từ đáy CÓ NẢY; nền phía sau tối mờ. Hub phía sau đứng nguyên — lớp trượt KHÔNG BAO GIỜ đẩy khối nào (luật founder 26/09).
 * · Đóng bằng: vuốt xuống (> 70 px) · chạm nền · Esc · nút ĐÓNG. Đóng xong TRẢ FOCUS về đúng phần tử đã mở nó.
 * · Khi đóng thì KHÔNG có trong DOM (sau khi trượt xuống xong): chữ trong lớp trượt không lẫn vào mặt màn, và bài quét A10
 *   chỉ thấy nó khi nó đang mở.
 * · `prefers-reduced-motion`: bỏ trượt/nảy (hiện và ẩn tức thì), GIỮ nguyên mọi chữ và thứ tự.
 *
 * ⚠ Chỉ nhận `children` + `chan` (vùng nút cuối) — không biết gì về Hub. Nút chính của lớp đặt vào `chan`; nút ĐÓNG luôn có.
 */
import {
  useCallback, useEffect, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import { NHIP } from '@/lib/nhip';
import { NHIP_RUNG, rung } from '@/lib/rung';
import s from './TamTruot.module.css';

/** Kéo xuống quá ngần này px thì đóng; ít hơn thì tấm nảy về chỗ cũ. */
export const NGUONG_VUOT_DONG = 70;

const CHON_DUOC = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function giamChuyenDong(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export interface TamTruotProps {
  mo: boolean;
  onDong: () => void;
  /** Tên đọc to của hộp thoại (aria-label). */
  nhan: string;
  children: ReactNode;
  /** Vùng nút cuối lớp (nút chính…) — đứng TRƯỚC nút ĐÓNG. */
  chan?: ReactNode;
  /** Chữ nút đóng (mặc định ĐÓNG). */
  chuDong?: string;
  /** Dấu cho bài test / soi trình duyệt. */
  dau?: string;
  /**
   * Chiều cao tối đa: `vua` 78 % màn (mặc định — demo) · `lon` 90 % cho lớp chứa một BÀN thao tác nhiều hàng (bàn tiền ghi nhanh) —
   * ở 390×812 bàn tiền + đầu + nút chính vượt 78 % làm hàng tờ cuối khuất; luật bàn CỐ ĐỊNH không cho bắt người dùng cuộn tìm tờ.
   */
  cao?: 'vua' | 'lon';
}

export function TamTruot({ mo, onDong, nhan, children, chan, chuDong = 'ĐÓNG', dau, cao = 'vua' }: TamTruotProps): React.ReactElement | null {
  /*
   * Hai trạng thái, một cho DOM, một cho hình:
   *   · `conGan`  — còn trong DOM không (đóng xong + trượt xuống xong mới gỡ);
   *   · `daVao`   — đã bật lớp `.tamMo` (nền tối + tấm ở vị trí 0). Bật SAU một khung hình dựng ở vị trí ẩn, nếu không
   *                 `transition` không có điểm xuất phát và tấm hiện tức thì, không trồi.
   * "Đang đóng" suy ra từ `mo` đổi true → false, đặt NGAY TRONG LÚC RENDER (mẫu "điều chỉnh state khi prop đổi" của React) để
   * không có khung hình nào tấm vừa mất khỏi DOM vừa chưa kịp trượt xuống.
   */
  const [truocMo, datTruocMo] = useState(mo);
  const [dangDong, datDangDong] = useState(false);
  if (mo !== truocMo) {
    datTruocMo(mo);
    datDangDong(!mo);
  }
  const conGan = mo || dangDong;
  const [daVao, datDaVao] = useState(false);

  useEffect(() => {
    if (!mo) { datDaVao(false); return undefined; }
    let a = 0; let b = 0;
    a = requestAnimationFrame(() => { b = requestAnimationFrame(() => datDaVao(true)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [mo]);

  useEffect(() => {
    if (!dangDong) return undefined;
    const t = setTimeout(() => datDangDong(false), giamChuyenDong() ? 0 : NHIP.HUB_TAM + 40);
    return () => clearTimeout(t);
  }, [dangDong]);

  // Esc đóng — chỉ nghe khi đang mở.
  useEffect(() => {
    if (!mo) return undefined;
    const nghe = (e: KeyboardEvent): void => { if (e.key === 'Escape') onDong(); };
    window.addEventListener('keydown', nghe);
    return () => window.removeEventListener('keydown', nghe);
  }, [mo, onDong]);

  // FOCUS: nhớ phần tử đã mở tấm; mở xong thì đưa focus vào tấm; đóng thì trả về chỗ cũ.
  const truocDo = useRef<HTMLElement | null>(null);
  const tamRef = useRef<HTMLElement | null>(null);
  const dongRef = useRef<HTMLButtonElement | null>(null);
  const thanRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!mo) return undefined;
    const dang = document.activeElement;
    truocDo.current = dang instanceof HTMLElement && dang !== document.body ? dang : null;
    return () => {
      const el = truocDo.current;
      truocDo.current = null;
      if (el !== null && el.isConnected) el.focus({ preventScroll: true });
    };
  }, [mo]);
  useEffect(() => {
    if (!mo || !conGan) return undefined;
    const id = requestAnimationFrame(() => { dongRef.current?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(id);
  }, [mo, conGan]);

  // VUỐT XUỐNG: bắt đầu ở chỗ KHÔNG phải nút / vùng cuộn; tấm bám ngón tay; thả > ngưỡng thì đóng.
  const y0 = useRef<number | null>(null);
  const batDau = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const dich = e.target as HTMLElement;
    if (dich.closest('button, a, input, select, textarea, [data-khong-vuot]') !== null) return;
    // Thân đang CUỘN ĐƯỢC thì ngón tay trong đó là để cuộn, không phải để đóng tấm.
    const than = thanRef.current;
    if (than !== null && than.contains(dich) && than.scrollHeight > than.clientHeight + 1) return;
    y0.current = e.clientY;
    const el = tamRef.current;
    if (el === null) return;
    el.style.transition = 'none';
    try { el.setPointerCapture(e.pointerId); } catch { /* môi trường không có pointer capture */ }
  }, []);
  const keo = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (y0.current === null || tamRef.current === null) return;
    tamRef.current.style.transform = `translateY(${Math.max(0, e.clientY - y0.current)}px)`;
  }, []);
  const tha = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (y0.current === null) return;
    const dy = e.clientY - y0.current;
    y0.current = null;
    const el = tamRef.current;
    if (el !== null) { el.style.transition = ''; el.style.transform = ''; }
    if (dy > NGUONG_VUOT_DONG) { rung(NHIP_RUNG.cham); onDong(); }
  }, [onDong]);

  // Giữ Tab trong tấm (aria-modal): Tab ở nút cuối quay về nút đầu và ngược lại.
  const phim = useCallback((e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab' || tamRef.current === null) return;
    const ds = [...tamRef.current.querySelectorAll<HTMLElement>(CHON_DUOC)];
    if (ds.length === 0) return;
    const dau0 = ds[0]!; const cuoi = ds[ds.length - 1]!;
    if (e.shiftKey && document.activeElement === dau0) { e.preventDefault(); cuoi.focus(); }
    else if (!e.shiftKey && document.activeElement === cuoi) { e.preventDefault(); dau0.focus(); }
  }, []);

  if (!conGan) return null;
  const hien = mo && daVao;
  return (
    <>
      <div className={`${s.nen} ${hien ? s.nenMo : ''}`} onClick={onDong} aria-hidden="true" data-tam-nen />
      <section
        ref={tamRef}
        className={`${s.tam} ${cao === 'lon' ? s.tamLon : ''} ${hien ? s.tamMo : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={nhan}
        tabIndex={-1}
        data-tam={dau}
        onPointerDown={batDau}
        onPointerMove={keo}
        onPointerUp={tha}
        onPointerCancel={tha}
        onKeyDown={phim}
      >
        <span className={s.quai} aria-hidden="true" />
        <div ref={thanRef} className={s.than}>{children}</div>
        <div className={s.chan}>
          {chan}
          <button ref={dongRef} type="button" className={s.dong} onClick={onDong}>{chuDong}</button>
        </div>
      </section>
    </>
  );
}
