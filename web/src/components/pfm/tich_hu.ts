/**
 * TÍCH HŨ — hiệu ứng khi tiền VÀO MỘT HŨ ở màn HŨ (SPEC `pfm-tang-khong-gian` mục 5; demo `tichHu`): XU RƠI vào miệng hũ → MỰC DÂNG có
 * vượt → HŨ NẢY (`huNay`, đầy thì quầng thở `huTho` đã nằm sẵn trên hình hũ) — áp cho hình hũ MỚI (bình tiết kiệm · phong bì chi).
 *
 * ─── LUẬT (cùng họ `hat_pixel.ts` · D122/D125) ───────────────────────────────────────────────────────────────────────
 * · ĐỒNG HỒ, KHÔNG `onfinish`: khung ẩn / không vẽ thì `onfinish` không bao giờ tới và xu kẹt lại trên `body`. Mọi phần tử tạm (xu) dọn bằng
 *   `setTimeout` đúng thời lượng; lớp `nay` gỡ bằng `setTimeout`. Số liệu KHÔNG phụ thuộc hiệu ứng: React đã vẽ số mới trước khi hàm này chạy —
 *   hàm chỉ vẽ đè lên (mực "dâng từ mức cũ" là animation `fill: backwards`; nó không đổi số).
 * · VẬT ⇒ `steps(6,end)` cho xu rơi (nhịp máy); mực dâng + nảy là chuyển động VẬT LÝ ⇒ cùng đường cong back-ease-out của biểu đồ.
 * · Chỉ `transform`/`opacity`. `prefers-reduced-motion`: KHÔNG làm gì (số vẫn đúng, không nháy — D116).
 * · Nhịp từ `lib/nhip.ts` (`PFM_XU_*`, `PFM_ND_DAY`) — không số trần.
 *
 * Hình hũ tự khai cho hàm này bằng thuộc tính: `[data-hu="<id>"]` (ô chứa) · `[data-vo-hu]` (vỏ: bình/phong bì; `data-truc="x"` nếu mực
 * dâng theo chiều ngang) · `[data-muc-hu]` (lớp mực). Thiếu thuộc tính nào thì bỏ qua phần ấy — không ném.
 */
import { NHIP } from '@/lib/nhip';

function itChuyenDong(): boolean {
  return typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

export interface DauTichHu {
  huId: string;
  /** Phần trăm mực TRƯỚC / SAU (0–100). `null` (hũ chưa đặt mức) ⇒ không vẽ mực dâng, vẫn rơi xu + nảy. */
  truoc: number | null;
  nay: number | null;
}

/** Thời gian xu rơi trọn vẹn (viên cuối đáp xong) — mực dâng và nảy chờ đúng chừng ấy. */
export const THOI_LUONG_XU = (NHIP.PFM_XU_SO - 1) * NHIP.PFM_XU_CACH + NHIP.PFM_XU_ROI;

/**
 * Phát hiệu ứng cho MỌI hình của hũ `d.huId` trong `goc`. `lop` = tên lớp CSS-module: `nay` (huNay) · `xu` (viên xu).
 * @returns số hình đã phát (0 nếu giảm chuyển động / không thấy hình) — cho bài test.
 */
export function phatTichHu(goc: ParentNode, d: DauTichHu, lop: { nay: string; xu: string }): number {
  if (typeof document === 'undefined' || itChuyenDong()) return 0;
  // Không `CSS.escape` / selector nối id: id do máy sinh nhưng jsdom không có `CSS.escape` — so thuộc tính bằng JS cho chắc.
  const vos: HTMLElement[] = [];
  goc.querySelectorAll<HTMLElement>('[data-hu]').forEach((o) => {
    if (o.dataset.hu === d.huId) o.querySelectorAll<HTMLElement>('[data-vo-hu]').forEach((v) => vos.push(v));
  });
  vos.forEach((vo) => {
    const r = vo.getBoundingClientRect();
    // 1) XU RƠI — gắn vào body (nằm ngoài mọi `overflow:hidden` của ô và trên cả lớp trượt, z-index ở CSS của lớp `xu`).
    for (let n = 0; n < NHIP.PFM_XU_SO; n += 1) {
      const x = document.createElement('i');
      x.setAttribute('aria-hidden', 'true');
      x.className = lop.xu;
      x.style.left = `${r.left + r.width / 2 - 3 + (n - (NHIP.PFM_XU_SO - 1) / 2) * 4}px`;
      x.style.top = `${r.top - 6}px`;
      document.body.appendChild(x);
      if (typeof x.animate === 'function') {
        x.animate(
          [
            { transform: 'translateY(-38px)', opacity: 0 },
            { transform: 'translateY(-30px)', opacity: 1, offset: 0.2 },
            { transform: 'translateY(4px)', opacity: 1 },
          ],
          { duration: NHIP.PFM_XU_ROI, delay: n * NHIP.PFM_XU_CACH, easing: 'steps(6,end)', fill: 'backwards' },
        );
      }
      setTimeout(() => x.remove(), n * NHIP.PFM_XU_CACH + NHIP.PFM_XU_ROI + 40);
    }
    // 2) MỰC DÂNG CÓ VƯỢT — bắt đầu từ mức cũ, chờ xu rơi xong (`fill: backwards` giữ mức cũ trong lúc chờ).
    const muc = vo.querySelector<HTMLElement>('[data-muc-hu]');
    if (muc !== null && typeof muc.animate === 'function' && d.truoc !== null && d.nay !== null && d.nay > 0) {
      const ti = Math.max(0.05, d.truoc / d.nay);
      const truc = vo.dataset.truc === 'x' ? 'X' : 'Y';
      muc.animate(
        [
          { transform: `scale${truc}(${ti})` },
          { transform: `scale${truc}(1.07)`, offset: 0.7 },
          { transform: `scale${truc}(1)` },
        ],
        { duration: NHIP.PFM_ND_DAY, delay: THOI_LUONG_XU, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' },
      );
    }
    // 3) HŨ NẢY — đúng lúc mực bắt đầu dâng; gỡ lớp bằng hẹn giờ.
    setTimeout(() => {
      vo.classList.remove(lop.nay);
      void vo.offsetWidth;
      vo.classList.add(lop.nay);
      setTimeout(() => vo.classList.remove(lop.nay), NHIP.PFM_ND_DAY + 60);
    }, THOI_LUONG_XU);
  });
  return vos.length;
}
