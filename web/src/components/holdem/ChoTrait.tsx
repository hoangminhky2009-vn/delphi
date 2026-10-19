/**
 * CHỢ TRAIT — lượt mời ở vòng MỐC (v55, D409 → D422 → D430). Thẻ, bảng xác nhận, hạt nổ, màu: CHÉP trang demo đã chốt
 * `docs/ui-ux/demo/the-trait.html` (A11.25). Chạm một thẻ mở BẢNG XÁC NHẬN (luật trong trận + đặc điểm ngoài đời + cái cân
 * sau lượt); LẤY thì thẻ nhấc lên, thở sáng, hạt nổ. Phần lấy phải CÂN ĐÚNG 0 (founder 25/09). CUỘN LẠI bằng xu (giá tăng
 * dần). Lựa chọn đi cùng cú CHỐT VÒNG — khối này chỉ giữ trạng thái chọn; server kiểm lại (C4).
 *
 * ⭐ D430 (founder 26/09) — CHỢ NẰM VÀO CHỖ HÀNG LÕI CỦA SHOP, không còn tấm trượt riêng: *"vòng trait thì thay vào mấy chỗ
 * lá chiến thuật ấy, vì vòng trait thì ko phải vòng chọn lõi mà"* (D428 dời mốc để hai lịch không trùng). Nên khối này:
 *   · mặc áo MỤC của shop (`composes` từ `ShopManHinh.module.css`) — đầu mục, dòng phụ y như LÕI CHIẾN THUẬT;
 *   · nút ĐỔI LẠI (⟳) KHÔNG nằm ở đầu chợ: founder 27/09 *"Phần đổi lại của chiến thuật và chợ trait cho xuống chỗ chung
 *     bàn đi"* ⇒ `NutCuonTrait` dưới đây, màn nộp vòng đưa vào ô "CHUNG BÀN" ở đầu mục TÀI SẢN (xem `ShopManHinh`);
 *   · (D430 dùng thẻ GỌN 34px để vừa khoang hàng lõi — D432 bỏ: chợ nay có MÀN CHỌN riêng, xem dưới);
 *   · bỏ nút XONG — không còn tấm để đóng. Cái cân nằm ở dòng phụ; màn nộp vòng chặn CHỐT khi lệch và đổi `rungCan` để
 *     cái cân rung (thay cho cú rung của XONG cũ);
 *   · hàng huy hiệu gọn "đang mang" ngay dưới (khay D422, bản HUD) — chọn lá mới mà vẫn thấy lá đang giữ.
 *
 * ⭐ D432 (founder 27/09: *"Quá nhiều thứ trên 1 màn hình"*, chọn phương án B) — chợ lên MÀN CHỌN riêng của shop, hiện
 * TRƯỚC bàn cược ở vòng mốc. Founder xem ảnh: *"Chợ trait ko đẹp bằng demo"* ⇒ có trọn một màn thì chợ về ĐÚNG mặt nỉ
 * casino của demo (bản D422 — A11.25: demo là nguồn chân lý): tiêu đề + ví XU, nhãn hàng TÀI / TẬT, thẻ cỡ thường, ô cân
 * viền, khay ĐANG MANG bản đủ bên dưới. Hai chỗ KHÁC demo là lệnh founder SAU demo: nút ĐỔI LẠI ở đáy màn chọn (27/09 "cho
 * xuống") và nút chính (BỎ QUA / VÀO BÀN CƯỢC) thay XONG — cả hai do `ShopManHinh` vẽ ở đáy.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tongDiemChon, hoMau } from '@/lib/trait_chu';
import { NHIP_RUNG, rung } from '@/lib/rung';
import { useReducedMotion } from '@/lib/hooks';
import { KhayTrait } from './KhayTrait';
import { MAU_HAT, TamTrait, TheTrait, baoTrait as bao, kieuTrait, phutHat } from './TheTrait';
import s from './ChoTrait.module.css';

export interface ChoTraitProps {
  moc: number;
  moi: readonly string[];
  xu: number;
  /** Lần cuộn đã dùng — đổi thì thẻ chia lại (khoá React theo lần cuộn). */
  lanCuon: number;
  chon: readonly string[];
  onChon: (id: string) => void;
  vohieu?: boolean;
  /** Trait ĐANG HIỆU LỰC của ghế (server — đã gồm cặp của vai): hàng huy hiệu gọn dưới hai hàng thẻ. */
  dangMang?: readonly string[];
  /** Vai của ghế (nhãn bảng xem huy hiệu). */
  vai?: string | undefined;
  /** Màn nộp vòng tăng số này khi chặn CHỐT vì lệch cân ⇒ cái cân rung (D430 — thay cú rung của nút XONG cũ). */
  rungCan?: number;
  /**
   * D526 (founder 05/10: *"Đổi trait ở dưới xu"*) — nút ĐỔI TRAIT (`NutCuonTrait`, cha dựng vì state cuộn ở màn nộp vòng) đứng ngay
   * dưới ô XU ở đầu chợ, không còn ở đáy màn chọn.
   */
  nutCuon?: ReactNode;
}

const soDep = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

export function ChoTrait({
  moc, moi, xu, lanCuon, chon, onChon, vohieu = false, dangMang = [], vai, rungCan = 0, nutCuon,
}: ChoTraitProps) {
  const giam = useReducedMotion();
  const [xem, setXem] = useState<string | null>(null);
  const moTu = useRef<HTMLButtonElement | null>(null);
  const oCan = useRef<HTMLSpanElement>(null);
  const tai = moi.filter((id) => hoMau(id) === 'tai');
  const tat = moi.filter((id) => hoMau(id) === 'tat');
  const can = tongDiemChon(chon);
  const tuVong = moc + 1;

  // Cú rung của cái cân khi màn nộp vòng chặn CHỐT (lệch cân) + câu báo nói lệch bao nhiêu (hàng lệnh chỉ vẽ lỗi khi đang
  // có lệnh xếp hàng — người chỉ chọn trait sẽ thấy cân rung mà không có chữ). Số 0 = chưa chặn lần nào ⇒ im lúc dựng.
  useEffect(() => {
    if (rungCan === 0) return;
    const el = oCan.current;
    if (el) {
      el.classList.remove(s.canRung ?? '');
      void el.offsetWidth;
      el.classList.add(s.canRung ?? '');
    }
    bao(`Phần trait đã lấy đang lệch ${soDep(can)} — cân về 0 rồi chốt.`);
  }, [rungCan]); // eslint-disable-line react-hooks/exhaustive-deps -- chỉ báo khi màn nộp vòng CHẶN, không khi `can` đổi

  const mo = (id: string, el: HTMLButtonElement) => { rung(NHIP_RUNG.cham); moTu.current = el; setXem(id); };
  const dong = () => {
    setXem(null);
    moTu.current?.focus({ preventScroll: true });
  };
  const lay = (id: string, nut: HTMLButtonElement) => {
    if (!chon.includes(id)) phutHat(nut, MAU_HAT[hoMau(id)], giam);
    onChon(id);
    dong();
  };
  const veHang = (ds: readonly string[], lech: number) => ds.map((id, i) => (
    <TheTrait key={`${lanCuon}-${id}`} id={id} i={i + lech} vao chon={chon.includes(id)} onMo={mo} />
  ));

  return (
    <div className={s.boc}>
    <section
      className={`${kieuTrait.bm} ${s.cho}`}
      aria-label="Chợ trait"
      data-tap="cho-trait"
      data-moc={moc}
      data-lan-cuon={lanCuon}
      data-can={can}
    >
      <div className={s.choDau}>
        <span className={s.choTen}>CHỢ TRAIT · MỐC VÒNG {moc}</span>
        <div className={s.viCot}>
          <span className={s.vi} aria-label={`Ví xu ${xu}`}><i className={s.dongxu} aria-hidden="true" />XU <b>{xu}</b></span>
          {nutCuon}
        </div>
      </div>
      <div className={s.hang} data-hang="tai"><span className={s.nhanHang}>TÀI</span><div className={s.theHang}>{veHang(tai, 0)}</div></div>
      <div className={s.hang} data-hang="tat"><span className={s.nhanHang}>TRAIT</span><div className={s.theHang}>{veHang(tat, 3)}</div></div>
      <div className={s.choChan}>
        <span ref={oCan} className={`${s.can} ${can === 0 ? s.canDung : s.canLech}`} data-tap="can-trait">
          {can === 0 ? 'CÂN 0' : `LỆCH ${soDep(can)}`}
        </span>
      </div>
      <TamTrait
        id={xem}
        cheDo="cho"
        dangChon={xem !== null && chon.includes(xem)}
        chon={chon}
        tuVong={tuVong}
        onDong={dong}
        {...(vohieu ? {} : { onLay: lay })}
      />
    </section>
    {/* Khay ĐANG MANG đứng DƯỚI mặt nỉ như demo (`.khay` là khối riêng, không nằm trong chợ): lá đang giữ + lá vừa lấy
        (viền đứt, "TỪ VÒNG n"). */}
    <KhayTrait trait={dangMang} choSau={chon} tuVong={tuVong} vai={vai} />
    </div>
  );
}

/**
 * NÚT ĐỔI LẠI CHỢ TRAIT (D430 — founder 27/09: *"Phần đổi lại của chiến thuật và chợ trait cho xuống chỗ chung bàn đi"*).
 * Màn nộp vòng dựng nó; từ D432 `ShopManHinh` đặt nó ở ĐÁY màn chọn, cạnh nút chính (cùng chỗ "⟳ ĐỔI LÕI" ở vòng lõi). Chữ
 * NÓI RÕ nó đổi gì ("⟳ ĐỔI TRAIT · 2 XU") — một nút ⟳ trơn từng bị đọc thành "đổi tài sản" (chú thích "TÀI SẢN KHÔNG CÓ
 * NÚT ROLL" trong `muc()` của `ShopManHinh`). Giá tăng theo lần cuộn; hết lượt hay thiếu xu ⇒ khoá.
 */
export function NutCuonTrait({ xu, giaCuon, lanCuon, cuonToiDa, onCuon, dangCuon = false, vohieu = false }: {
  xu: number;
  giaCuon: readonly number[];
  lanCuon: number;
  cuonToiDa: number;
  onCuon: () => void;
  dangCuon?: boolean;
  vohieu?: boolean;
}) {
  const giam = useReducedMotion();
  const giaKe = lanCuon < cuonToiDa ? (giaCuon[lanCuon] ?? null) : null;
  const cuonDuoc = giaKe !== null && xu >= giaKe && !dangCuon && !vohieu;
  return (
    <button
      type="button"
      className={s.cuon}
      data-tap="cuon-trait"
      disabled={!cuonDuoc}
      // Giá vẽ bằng đồng xu (mẩu vàng) nên chữ "XU" không còn trong nút — đọc màn hình vẫn nghe đủ.
      aria-label={giaKe === null ? 'Hết lượt đổi trait' : `Đổi trait, giá ${giaKe} xu`}
      onClick={(e) => { rung(NHIP_RUNG.nang); phutHat(e.currentTarget, '#fde047', giam); onCuon(); }}
    >
      {giaKe === null ? 'HẾT LƯỢT ĐỔI' : dangCuon ? '…' : (
        <>
          <span className={s.cuonXoay} aria-hidden>⟳</span>ĐỔI TRAIT
          <span className={s.cuonGia}><i className={s.cuonXu} aria-hidden />{giaKe}</span>
        </>
      )}
    </button>
  );
}
