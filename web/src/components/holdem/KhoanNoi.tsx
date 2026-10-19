/**
 * KHOẢN NỔI — lãi/lỗ TỪNG KHOẢN bay lên trên con số vòng, kiểu scrolling combat text (D400).
 *
 * Founder 24/09 (nguyên văn): *"số nhảy kiểu Scrolling combat box text ấy và phải hiện ở màn hình chính (trôi lên trên
 * phần lãi lỗ, nhỏ nhỏ cũng được nhưng hiệu ứng Scrolling phải Ease In-Out, Freeze Frame (Khựng) và Spacing/Queue
 * (Xếp hàng đẩy nhau) và là các text box chứa từng khoản "lãi/ lỗ" (Nhớ lưu ý màu sắc và số tiền lãi/lỗ phải trùng
 * khớp với phần lý do khi bấm vào xem chi tiết)"*.
 *
 * · MỘT nguồn danh sách: `khoanLaiLo` (lib/khoan_lai_lo.ts) — cùng hàm khối "PHẦN TIỀN CỦA BẠN" trong bảng VÌ SAO
 *   đọc, nên màu và số trùng từng chip. Trượt giá là dòng riêng màu cam (founder 23/09).
 * · Thuộc bước LÃI/LỖ của nhịp kết quả (A11.26): `lichKetQua({ soKhoan })` đã chờ đủ `thoiLuongKhoanNoi(n)`.
 * · HAI phần tử, HAI chủ animation (§2.5-1 — `animation` không cộng dồn): khung `.o` giữ CHỖ trong hàng (hộp mới vào
 *   thì hộp cũ bị ĐẨY lên một nấc — transition), hộp `.hop` diễn vòng đời (vào ease-in-out → KHỰNG → trôi mờ).
 * · Giảm chuyển động: KHÔNG diễn. Con số vòng + bảng VÌ SAO (một chạm) đã chở trọn tin — "tắt cái nháy, không tắt
 *   cái tin"; mà nhịp kết quả ở nhánh này là 0 ms, hộp tĩnh sẽ chớp mất trước khi đọc được.
 * · D401 — hộp "Ăn chia cược" RƠI TỪ GIẢI (hộp HUD `[data-giai-vong]`) xuống chỗ của nó thay vì trồi lên tại chỗ
 *   (founder chốt A: *"Tới bước LÃI/LỖ, hộp "Ăn chia cược" bay ra từ chính cái giải đó"*). Cú bay nằm trên phần tử
 *   THỨ BA `.bay` giữa `.o` và hộp — ba phần tử, ba chủ: `.o` giữ nấc · `.bay` bay (WAAPI) · hộp diễn vòng đời.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { dinhDangChip } from '@/api/holdem';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { duocBay, EASING_BAY, khungBay, tamCua } from '@/lib/duong_bay';
import type { KhoanLaiLo } from '@/lib/khoan_lai_lo';
import { NHIP } from '@/lib/nhip';
import { phanTramNhip } from './SoNhipVong';
import s from './KhoanNoi.module.css';

/** Cao một nấc trong hàng (px) = cao hộp 20 + khe 4. Hộp có chiều cao cố định nên nấc tính được bằng số. */
export const NAC_KHOAN_NOI = 24;

/** "1,2%" — một chữ số thập phân, dấu phẩy, cùng cách viết với con số vòng. */
const chuoiPct = (v: number): string => `${Math.abs(v).toFixed(1).replace('.', ',')}%`;

/**
 * D401 — khung BAY của hộp rơi từ giải: đo tâm hộp GIẢI và tâm chỗ đứng của chính mình NGAY lúc dựng (trước khi vẽ —
 * `useLayoutEffect`, không chớp một khung ở chỗ đứng), rồi bay ngược từ giải về chỗ ấy theo dáng bay chung
 * (`lib/duong_bay.ts`). Báo `khiRa` đúng lúc rời giải — nơi gọi hạ con số giải về 0. Không có hộp GIẢI / không bay
 * được (jsdom, giảm chuyển động) ⇒ đứng tại chỗ, vẫn báo `khiRa`: giải vẫn phải cạn.
 */
function BayTuGiai({ khiRa, children }: { khiRa?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const khiRaRef = useRef(khiRa);
  khiRaRef.current = khiRa;
  useLayoutEffect(() => {
    khiRaRef.current?.();
    const el = ref.current;
    const giai = document.querySelector('[data-giai-vong]');
    if (!giai || !duocBay(el)) return undefined;
    const a = tamCua(giai);
    const b = tamCua(el);
    const anim = el.animate(khungBay({ x: a.x - b.x, y: a.y - b.y }, { x: 0, y: 0 }), {
      duration: NHIP.GIAI_TRA_BAY, easing: EASING_BAY,
    });
    return () => anim.cancel();
  }, []);
  return <div ref={ref} className={s.bay} data-bay-tu-giai>{children}</div>;
}

export function KhoanNoi({
  khoan, goc, giamChuyenDong, tuGiai,
}: {
  /** Đã qua `khoanNoiCuaVong` (bỏ khoản 0, gộp phần đuôi). Thứ tự = thứ tự bảng VÌ SAO. */
  khoan: readonly KhoanLaiLo[];
  /** NAV trước vòng — mẫu số của con số vòng (`SoNhipVong`); `null` ⇒ dòng trượt giá không kèm %. */
  goc: number | null;
  giamChuyenDong: boolean;
  /** D401 — khoản nào rơi từ hộp GIẢI (`KHOAN_TU_GIAI`), và báo ai khi nó rời giải. Vắng ⇒ mọi hộp trồi tại chỗ. */
  tuGiai?: { khoa: string; khiRa?: () => void };
}) {
  const [so, setSo] = useState(0);
  useEffect(() => {
    if (giamChuyenDong || khoan.length === 0) return undefined;
    setSo(1);
    let n = 1;
    const t = window.setInterval(() => {
      n += 1;
      setSo(n);
      if (n >= khoan.length) window.clearInterval(t);
    }, NHIP.KHOAN_NOI_CACH);
    return () => window.clearInterval(t);
    // Theo SỐ khoản, không theo danh tính mảng: nơi gọi dựng lại mảng mỗi lần render. Vòng mới ⇒ nơi gọi đổi `key`.
  }, [khoan.length, giamChuyenDong]);

  // Giảm chuyển động: effect trên không bao giờ đếm ⇒ `so` đứng 0 ⇒ không dựng gì (một chỗ chặn, không hai).
  if (so === 0) return null;
  return (
    <div className={s.khung} aria-hidden data-khoan-noi={so}>
      {khoan.slice(0, so).map((k, i) => (
        <div
          key={k.khoa}
          className={s.o}
          /* Nấc 0 = hộp mới nhất, sát con số; mỗi hộp mới vào đẩy các hộp cũ lên một nấc. */
          style={{ transform: `translate3d(0, ${-(so - 1 - i) * NAC_KHOAN_NOI}px, 0)` }}
        >
          {k.khoa === tuGiai?.khoa ? (
            <BayTuGiai khiRa={tuGiai.khiRa}>{hopCua(k, s.hopRa, goc, true)}</BayTuGiai>
          ) : hopCua(k, s.hop, goc, false)}
        </div>
      ))}
    </div>
  );
}

/** Một hộp khoản. `lop` = vòng đời (`hop` trồi tại chỗ · `hopRa` rơi từ giải) — hai lớp, cùng một dáng hộp. */
function hopCua(k: KhoanLaiLo, lop: string | undefined, goc: number | null, tuGiai: boolean) {
  return (
    <div
      className={`${lop} ${s[k.loai]}`}
      data-khoan={k.khoa}
      data-loai={k.loai}
      {...(tuGiai ? { 'data-tu-giai': true } : {})}
    >
      <span className={s.nhan}>{k.nhanNgan}</span>
      <b className={s.so}>
        {k.tien > 0 ? '+' : k.tien < 0 ? '-' : ''}
        <PixelIcon name="coin" size={8} />
        {dinhDangChip(Math.abs(k.tien))}
      </b>
      {k.loai === 'truot' && goc !== null && goc > 0 && (
        <i className={s.pct}>· {chuoiPct(phanTramNhip(k.tien, goc))}</i>
      )}
    </div>
  );
}
