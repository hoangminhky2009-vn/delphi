/**
 * PFM NGÀY ĐẦU — HẠT PIXEL khi bấm nút chính (demo `phut()`, §2.6 của
 * `01-vfx-game-feel.md`: dùng lại khuôn `bayChip` của `ShopManHinh.tsx` — WAAPI, sinh
 * NGOÀI cây React nên không kéo theo một cú re-render nào khi hạt đang bay).
 *
 * ⚠⚠ LUẬT RÚT TỪ LỖI THẬT CỦA DEMO (D356 tự vấp #1 — 201 hạt kẹt lại DOM vĩnh viễn):
 * dọn hạt BẰNG ĐỒNG HỒ (`setTimeout` theo đúng thời lượng animation), TUYỆT ĐỐI KHÔNG
 * BẰNG `onfinish` của Web Animations API. Tab bị ẩn hoặc pane không vẽ thì trình duyệt
 * không chạy animation tới cuối — `onfinish` không bao giờ bắn, và hạt ở lại mãi mãi.
 * Không trạng thái nào (kể cả việc DỌN) được phép phụ thuộc vào việc hoạt ảnh có chạy
 * xong hay không — xem `hat_pixel.test.ts` (dùng fake timers, `animate()` giả không bao
 * giờ bắn `finish`, vẫn phải dọn đúng hẹn).
 *
 * ⚠ Chỉ animate `transform`/`opacity` (luật ba runtime, §XI luật 2 của CLAUDE.md).
 * ⚠ Tôn trọng `prefers-reduced-motion` — không phụt gì cả, im lặng trả về.
 */
import { NHIP } from './nhip.js';

export interface DiemHat { x: number; y: number }

/** Tâm của một phần tử, tính bằng toạ độ VIEWPORT (dùng `position: fixed` cho hạt). */
export function tamPhanTu(el: Element | null): DiemHat | null {
  if (!el) return null;
  const b = el.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

/** Sổ huỷ — cho `donHatPixel()` dọn sạch khi màn rời đi giữa chừng một đợt phụt. */
const dangBay = new Set<{ huy: () => void }>();

function giamChuyenDong(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * PHỤT — `soHat` hạt pixel toả ngẫu nhiên quanh `tam` rồi mờ dần (khuôn `phut()` của
 * demo). Không làm gì khi thiếu `document`, thiếu tâm, hoặc đang giảm chuyển động.
 *
 * @param mau Màu hạt — một biến CSS đã có (`var(--c-4)`, `var(--v-3)`…), không mã hex rời.
 */
export function phutHat(tam: DiemHat | null, mau: string, soHat = 10): void {
  if (typeof document === 'undefined' || !tam || giamChuyenDong()) return;
  const thoiLuong = NHIP.PFM_ND_HAT;

  for (let i = 0; i < soHat; i += 1) {
    const h = document.createElement('i');
    h.setAttribute('aria-hidden', 'true');
    h.style.cssText = 'position:fixed;width:4px;height:4px;margin:-2px 0 0 -2px;'
      + 'pointer-events:none;z-index:999;';
    h.style.left = `${tam.x}px`;
    h.style.top = `${tam.y}px`;
    h.style.background = mau;
    document.body.appendChild(h);

    if (typeof h.animate !== 'function') { h.remove(); continue; }

    const goc = Math.random() * Math.PI * 2;
    const xa = 24 + Math.random() * 38;
    const dx = Math.cos(goc) * xa;
    const dy = Math.sin(goc) * xa - 16;
    const anim = h.animate(
      [
        { transform: 'translate(0,0)', opacity: 1 },
        { transform: `translate(${dx * 0.75}px,${dy * 0.75}px)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${dx}px,${dy + 34}px) scale(0.5)`, opacity: 0 },
      ],
      { duration: thoiLuong, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    );

    const the = {
      huy: (): void => {
        try { anim.cancel(); } catch { /* đã xong hoặc đã bị huỷ — không sao */ }
        h.remove();
        dangBay.delete(the);
      },
    };
    dangBay.add(the);
    // ⚠⚠ ĐỒNG HỒ, KHÔNG `onfinish` — xem khối chú thích đầu tệp.
    setTimeout(() => { h.remove(); dangBay.delete(the); }, thoiLuong + 40);
  }
}

/** Dọn mọi hạt còn đang bay — gọi lúc unmount để không rò rỉ DOM node giữa chừng. */
export function donHatPixel(): void {
  for (const t of [...dangBay]) t.huy();
}
