/**
 * KHAY TRAIT — trait đang mang (v55, D409 → D422). CHÉP khối "ĐANG MANG" của trang demo đã chốt
 * `docs/ui-ux/demo/the-trait.html` (A11.25): huy hiệu có hình 48px + tên + điểm; cặp của vai ghi "GHIM THEO VAI"; lá vừa
 * chọn ở chợ (chưa vào tay) viền ĐỨT, ghi "TỪ VÒNG n". Chạm một huy hiệu mở bảng xem (luật + ngoài đời).
 * `gon` = hàng HUD dưới thanh phong cách ở màn trận (ướm điện thoại): cùng huy hiệu, hình 24px, không tên.
 * Ô XU ở ô ví chân màn trận — MỘT ví, MỘT chỗ hiện (D411). Chữ ở client (`lib/trait_chu.ts`, D26).
 */
import { useRef, useState } from 'react';
import { TEN_VAI_TRAIT, vaiCua } from '@/lib/trait_chu';
import { HuyTrait, TamTrait, kieuTrait } from './TheTrait';
import s from './KhayTrait.module.css';

export function KhayTrait({ trait, teLiet = false, gon = false, choSau = [], tuVong, vai, rongKhiTrong = false }: {
  /** Trait ĐANG HIỆU LỰC (server — đã gồm cặp của vai). */
  trait: readonly string[];
  /** TÊ LIỆT đang khoá lõi ở vòng này. */
  teLiet?: boolean;
  gon?: boolean;
  /** Lá đang chọn ở chợ, chưa vào tay (viền đứt). */
  choSau?: readonly string[];
  /** Vòng lá đang chọn bắt đầu hiệu lực. */
  tuVong?: number;
  /** Vai của ghế — in ở tiêu đề khay ("ĐANG MANG · VAI CÁ MẬP"). */
  vai?: string | undefined;
  /** Rỗng thì vẫn vẽ khay với câu "chưa lấy lá nào" (trong chợ); mặc định rỗng ⇒ không vẽ gì. */
  rongKhiTrong?: boolean;
}) {
  const [xem, setXem] = useState<string | null>(null);
  const moTu = useRef<HTMLButtonElement | null>(null);
  const cho = choSau.filter((id) => !trait.includes(id));
  if (trait.length === 0 && cho.length === 0 && !teLiet && !rongKhiTrong) return null;
  const mo = (id: string, el: HTMLButtonElement) => { moTu.current = el; setXem(id); };
  const dong = () => { setXem(null); moTu.current?.focus({ preventScroll: true }); };
  const tenVai = vai ? TEN_VAI_TRAIT[vai] : undefined;
  return (
    <section
      className={[kieuTrait.bm, s.khay, gon ? s.gon : ''].filter(Boolean).join(' ')}
      aria-label="Trait đang mang"
      data-tap="khay-trait"
      data-so-trait={trait.length}
    >
      {!gon && <h2 className={s.tieuDe}>ĐANG MANG{tenVai ? ` · VAI ${tenVai}` : ''}</h2>}
      <div className={s.hang}>
        {trait.map((id) => (
          <HuyTrait key={id} id={id} gon={gon} {...(!gon && vaiCua(id) ? { ghi: 'GHIM THEO VAI' } : {})} onMo={mo} />
        ))}
        {cho.map((id) => (
          <HuyTrait key={`cho-${id}`} id={id} choSau gon={gon} {...(!gon && tuVong ? { ghi: `TỪ VÒNG ${tuVong}` } : {})} onMo={mo} />
        ))}
        {teLiet && <span className={s.teLiet} data-te-liet="">LÕI KHOÁ</span>}
        {trait.length === 0 && cho.length === 0 && !teLiet && <span className={s.rong}>Chưa lấy lá nào ở mốc này.</span>}
      </div>
      <TamTrait id={xem} cheDo="xem" onDong={dong} />
    </section>
  );
}
