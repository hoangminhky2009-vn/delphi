/**
 * GIẢI VÒNG (D401) — hộp quỹ vòng ở cuối hàng HUD, cạnh đồng hồ vòng.
 *
 * Founder 24/09 chốt A: *"ở bước chia quỹ (trước khi lật lá), xu từ các ghế bay vào giải. Tới bước LÃI/LỖ, hộp "Ăn
 * chia cược" bay ra từ chính cái giải đó. Mỗi bước vẫn chỉ một tiêu điểm."* — và trước đó: *"trả trước lá là lộ ai
 * thắng"*. Nên hộp này chỉ làm HAI việc, ở hai bước khác nhau của nhịp kết quả (A11.26):
 *  · bước CHIA QUỸ (`pha = 'nop'`): xu bay từ từng ghế trên dải ghế lên hộp, hộp nảy mỗi lần một ghế đáp; viên cuối
 *    đáp thì con số chạy tới tổng giải của server và quầng vàng thở một lần. Chưa ai biết thắng thua — lá còn úp.
 *  · bước LÃI/LỖ: hộp "Ăn chia cược" rơi từ đây xuống hàng khoản nổi (`KhoanNoi` lo cú bay), nơi gọi hạ `so` về 0
 *    đúng lúc hộp rời giải — giải cạn vì đã chia. D402 (`pha = 'tra'`): CÙNG lúc ấy xu bay từ giải về từng ghế nhận
 *    theo HẠNG (1 → 2 → 3; hạng 1 ba viên), mỗi ghế nổi nhãn "hạng · +tiền" (founder: *"TRẢ giải về 3 ghế đầu cùng
 *    nhịp LÃI/LỖ"*). Ghế mình chỉ nổi nhãn — phần của mình đã rơi thành hộp "Ăn chia cược", xu thứ hai là thừa.
 * Ngoài nhịp kết quả (`pha = 'nghi'`) hộp đứng yên với quỹ TỐI THIỂU của vòng đang chơi (`quy_vong_hien_tai`).
 *
 * ⚠ C4: mọi con số là của server (`quy_vong_hien_tai` · `quy_vong`); số viên xu chỉ là cách vẽ mức góp
 *   (`gheNopCuaVong`). Hộp không bấm được — nó là THÔNG TIN như đồng hồ bên cạnh (xám tối, viền vàng = vật mang tiền).
 * ⚠ Xu bay sống NGOÀI cây React (`document.body`, khuôn `bayChip`) và được dọn bằng ĐỒNG HỒ, không bằng `onfinish`
 *   (D356). Trạng thái "giải đã đủ" cũng đi bằng đồng hồ — không bao giờ chờ một hoạt ảnh chạy xong.
 * ⚠ Giảm chuyển động: không xu bay, không nảy, không quầng — con số đứng thẳng ở tổng server.
 */
import { useEffect, useRef, useState } from 'react';
import { dinhDangChip } from '@/api/holdem';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { duocBay, EASING_BAY, khungBay, tamCua } from '@/lib/duong_bay';
import type { GheNop } from '@/lib/giai_vong';
import { useSoChay } from '@/lib/hooks';
import { NHIP, XU_TOI_DA_MOI_GHE, xuTraTheoHang } from '@/lib/nhip';
import s from './GiaiVong.module.css';

export type PhaGiai = 'nghi' | 'nop' | 'tra';

/** D402 — một ghế nhận giải: số của server (`chia_quy_vong`). */
export interface GheNhanGiai { ghe: string; hang: number; tien: number; /** D584 — giải bằng xu trait: nhãn "+n xu" thay cho tiền. */ xu?: number }

/** Các nút ghế trên dải ghế — `DoiThuStrip` dán `data-ghe` lên từng nút. Thứ tự DOM = thứ tự trái → phải. */
export const CHON_GHE_TREN_DAI = '[data-tap="doi-thu"] [data-ghe]';

/**
 * Cỡ viên xu bay (px): đồng xu pixel 8 × 8 phóng 3 — đúng cỡ demo `giai-vong.html` (lưới 8 hàng ⇒ 24 = 8 × 3, số
 * nguyên, không bị `PixelIcon` làm tròn). Chính đồng xu đứng cạnh số tiền trên ghế — tiền nộp giải là tiền ấy.
 */
export const CO_XU_BAY = 24;
/** Xu tới miệng giải thì còn 0,4 cỡ và 0,3 độ đậm — đọc thành "rơi vào hũ", không che con số trong hộp. */
export const XU_CHUI_VAO = { scale: 0.4, opacity: 0.3 } as const;
/** D402 — nhãn giải của ghế lẻ nổi cao hơn ghế chẵn bấy nhiêu px (hai ghế liền nhau không bao giờ cùng hàng). */
export const NAC_SO_LE = 16;

/** Thời điểm (ms, tính từ lúc bắt đầu nộp) viên CUỐI của cả bàn đáp — mốc giải đủ. */
export function mocGiaiDu(xuTheoThuTu: readonly number[]): number {
  return xuTheoThuTu.reduce(
    (m, xu, i) => Math.max(m, i * NHIP.XU_CACH_GHE + (Math.max(1, xu) - 1) * NHIP.XU_CACH_XU + NHIP.XU_VAO_GIAI), 0);
}

export function GiaiVong({
  so, pha, tuSo, gheNop = [], traVe = [], lan, giamChuyenDong, laXu = false,
}: {
  /** D584 — giải vòng trả bằng XU TRAIT (khoá `giai_xu`): con số là số xu, kèm chữ XU. */
  laXu?: boolean;
  /** Con số server của lúc này: quỹ tối thiểu vòng đang chơi (nghỉ) · tổng giải vòng vừa chốt (đang diễn) · 0 (đã chia). */
  so: number;
  pha: PhaGiai;
  /** `nop`: con số hộp đang đứng trước khi xu vào (quỹ tối thiểu đã hiện suốt pha chọn bài). Vắng ⇒ `so`. */
  tuSo?: number;
  /** `nop`: ghế nào góp và mấy viên (`gheNopCuaVong`). */
  gheNop?: readonly GheNop[];
  /** D402 — `tra`: ghế nào nhận giải, hạng mấy, bao nhiêu (`chia_quy_vong` của server). */
  traVe?: readonly GheNhanGiai[];
  /** Mã lần diễn (số vòng vừa chốt) — một lần nộp chỉ diễn MỘT lần. */
  lan: number;
  giamChuyenDong: boolean;
}) {
  const hopRef = useRef<HTMLDivElement>(null);
  const mauXuRef = useRef<HTMLSpanElement>(null);
  // Lần diễn mà xu đã vào ĐỦ — tới lúc ấy hộp còn đứng ở `tuSo`. Khoá theo `lan` nên lần sau không kế thừa lần trước.
  const [vaoLan, setVaoLan] = useState<number | null>(null);
  const [sangLan, setSangLan] = useState<number | null>(null);
  const choXu = pha === 'nop' && vaoLan !== lan;
  const hien = useSoChay(choXu ? (tuSo ?? so) : so, { nac: 6, msMoiNac: 40 });

  useEffect(() => {
    if (pha === 'tra') return traGiaiVeGhe(hopRef.current, mauXuRef.current, traVe, giamChuyenDong);
    if (pha !== 'nop') return undefined;
    const hop = hopRef.current;
    if (giamChuyenDong || !duocBay(hop)) { setVaoLan(lan); return undefined; }
    // Thác xu chạy MỘT chiều theo dải ghế (trái → phải), không theo thứ tự server.
    const theoDai = [...document.querySelectorAll(CHON_GHE_TREN_DAI)].flatMap((el) => {
      const g = gheNop.find((x) => x.ghe === el.getAttribute('data-ghe'));
      return g ? [{ el, xu: Math.min(Math.max(1, g.xu), XU_TOI_DA_MOI_GHE) }] : [];
    });
    const hen: number[] = [];
    const xuDangBay: HTMLElement[] = [];
    const anim: Animation[] = [];
    const nay = () => {
      hop.animate(
        [
          { transform: 'scale(1)', easing: 'steps(2, end)' },
          { transform: 'scale(1.2)', easing: 'steps(2, end)' },
          { transform: 'scale(1)' },
        ],
        { duration: NHIP.GIAI_NAY },
      );
    };
    theoDai.forEach(({ el, xu }, i) => {
      hen.push(window.setTimeout(() => {
        // Toạ độ đo ĐÚNG lúc thả: dải ghế có thể vừa cuộn.
        const a = tamCua(el);
        const b = tamCua(hop);
        for (let k = 0; k < xu; k += 1) {
          // Nhân bản đồng xu mẫu (vẽ bằng `PixelIcon` trong hộp, ẩn) — sống ngoài cây React, không kéo re-render.
          const mau = mauXuRef.current?.firstElementChild;
          if (!mau) continue;
          const c = mau.cloneNode(true) as HTMLElement;
          c.className = s.xu ?? '';
          c.setAttribute('aria-hidden', 'true');
          // `PixelIcon` gắn `position: relative` vào style — đè bằng style, lớp CSS không thắng được style.
          c.style.position = 'fixed';
          c.style.left = `${a.x - CO_XU_BAY / 2}px`;
          c.style.top = `${a.y - CO_XU_BAY / 2}px`;
          document.body.appendChild(c);
          xuDangBay.push(c);
          // Xu CHUI VÀO giải (nhỏ lại, mờ dần) chứ không đáp lên nó — soi màn 24/09: tám viên đáp nguyên cỡ chất đống
          // che mất con số giải đúng lúc nó đang chạy.
          anim.push(c.animate(khungBay({ x: 0, y: 0 }, { x: b.x - a.x, y: b.y - a.y }, undefined, XU_CHUI_VAO), {
            duration: NHIP.XU_VAO_GIAI, delay: k * NHIP.XU_CACH_XU, easing: EASING_BAY, fill: 'forwards',
          }));
          // Dọn bằng ĐỒNG HỒ (D356) — không chờ `onfinish`; gỡ ngay lúc chạm đích.
          hen.push(window.setTimeout(() => c.remove(), NHIP.XU_VAO_GIAI + k * NHIP.XU_CACH_XU));
        }
      }, i * NHIP.XU_CACH_GHE));
      // Viên đầu của ghế này đáp ⇒ hộp nảy một nhịp.
      hen.push(window.setTimeout(nay, i * NHIP.XU_CACH_GHE + NHIP.XU_VAO_GIAI));
    });
    // Viên cuối đáp ⇒ giải đủ: con số chạy tới tổng server, quầng vàng thở một lần.
    hen.push(window.setTimeout(() => {
      setVaoLan(lan);
      setSangLan(lan);
    }, mocGiaiDu(theoDai.map((x) => x.xu))));
    return () => {
      hen.forEach((t) => window.clearTimeout(t));
      anim.forEach((a) => a.cancel());
      xuDangBay.forEach((c) => c.remove());
    };
    // Một lần nộp = một `lan`; `gheNop`/`giamChuyenDong` đọc lúc bắt đầu (nơi gọi dựng lại mảng mỗi lần render).
  }, [pha, lan]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={hopRef}
      className={[s.hop, sangLan === lan ? s.sang : ''].filter(Boolean).join(' ')}
      data-giai-vong={pha}
      aria-label={laXu ? `Giải vòng ${so} xu trait` : `Giải vòng ${dinhDangChip(so)}`}
    >
      {/* Đồng xu MẪU cho xu bay — ẩn, không chiếm chỗ; một nguồn vẽ với mọi đồng xu khác (`PixelIcon`). */}
      <span ref={mauXuRef} hidden><PixelIcon name="coin" size={CO_XU_BAY} /></span>
      <span className={s.nhan}>GIẢI</span>
      <span className={s.so}>{laXu ? `${hien} XU` : dinhDangChip(hien)}</span>
    </div>
  );
}

/** Tìm nút ghế trên dải ghế theo mã (không dựng selector từ chuỗi — mã ghế là dữ liệu). */
function nutGhe(ghe: string): Element | null {
  return [...document.querySelectorAll(CHON_GHE_TREN_DAI)].find((el) => el.getAttribute('data-ghe') === ghe) ?? null;
}

/**
 * D402 — GIẢI TRẢ VỀ GHẾ: xu bay từ hộp GIẢI về từng ghế nhận theo HẠNG, nhãn "hạng · +tiền" nổi trên ghế lúc xu đáp.
 * Trả hàm dọn (cleanup của effect). Mọi thứ sống ngoài cây React và được dọn bằng ĐỒNG HỒ (D356).
 */
function traGiaiVeGhe(
  hop: HTMLElement | null, mauXu: HTMLElement | null, traVe: readonly GheNhanGiai[], giamChuyenDong: boolean,
): (() => void) | undefined {
  if (giamChuyenDong || !duocBay(hop) || traVe.length === 0) return undefined;
  const hen: number[] = [];
  const vat: HTMLElement[] = [];
  const anim: Animation[] = [];
  [...traVe].sort((a, b) => a.hang - b.hang).forEach((t, i) => {
    const ghe = nutGhe(t.ghe);
    if (!ghe) return;
    const bat = i * NHIP.GIAI_TRA_CACH;
    // Ghế mình: phần của mình đã rơi thành hộp "Ăn chia cược" — chỉ nổi nhãn, không thả thêm xu. D584 — giải bằng xu trait: không có hộp ấy ⇒ ghế mình cũng nhận xu bay.
    const soXu = t.ghe === 'ban' && t.xu === undefined ? 0 : xuTraTheoHang(t.hang);
    hen.push(window.setTimeout(() => {
      const a = tamCua(hop);
      const b = tamCua(ghe);
      const mau = mauXu?.firstElementChild;
      for (let k = 0; k < soXu && mau; k += 1) {
        const c = mau.cloneNode(true) as HTMLElement;
        c.className = s.xu ?? '';
        c.setAttribute('aria-hidden', 'true');
        c.style.position = 'fixed';
        c.style.left = `${a.x - CO_XU_BAY / 2}px`;
        c.style.top = `${a.y - CO_XU_BAY / 2}px`;
        document.body.appendChild(c);
        vat.push(c);
        anim.push(c.animate(khungBay({ x: 0, y: 0 }, { x: b.x - a.x, y: b.y - a.y }, undefined, XU_CHUI_VAO), {
          duration: NHIP.XU_VAO_GIAI, delay: k * NHIP.XU_CACH_XU, easing: EASING_BAY, fill: 'forwards',
        }));
        hen.push(window.setTimeout(() => c.remove(), NHIP.XU_VAO_GIAI + k * NHIP.XU_CACH_XU));
      }
    }, bat));
    // Nhãn nổi đúng lúc viên đầu đáp — ghế mình (không xu) cũng chờ đúng quãng ấy, để nhãn xướng ĐÚNG thứ tự hạng
    // (soi màn 24/09: nhãn hạng 2 của mình bật trước nhãn hạng 1 vì không phải chờ xu).
    hen.push(window.setTimeout(() => {
      const r = ghe.getBoundingClientRect();
      const n = document.createElement('div');
      n.className = s.noi ?? '';
      n.setAttribute('aria-hidden', 'true');
      n.setAttribute('data-giai-noi', t.ghe);
      const h = document.createElement('span');
      h.className = s.noiHang ?? '';
      h.textContent = String(t.hang);
      n.appendChild(h);
      n.appendChild(document.createTextNode(t.xu !== undefined ? `+${t.xu} xu` : `+${dinhDangChip(t.tien)}`));
      n.style.left = `${r.left + r.width / 2}px`;
      // Bật lên từ GIỮA ghế (ngang avatar) rồi trôi tới mép trên ghế — không lấn hàng HUD (soi màn 24/09). Ghế lẻ
      // (theo thứ tự dải) nổi cao hơn một nấc: nhãn rộng hơn ô ghế bàn 8, hai ghế LIỀN NHAU cùng nhận thì nhãn đè nhau.
      const viTri = [...document.querySelectorAll(CHON_GHE_TREN_DAI)].indexOf(ghe);
      n.style.top = `${r.top + r.height * 0.4 - (viTri % 2 === 1 ? NAC_SO_LE : 0)}px`;
      document.body.appendChild(n);
      vat.push(n);
      anim.push(n.animate(
        [
          { opacity: 0, transform: 'translate(-50%, 6px) scale(0.6)' },
          { opacity: 1, transform: 'translate(-50%, -18px) scale(1.15)', offset: 0.18 },
          { opacity: 1, transform: 'translate(-50%, -24px) scale(1)', offset: 0.8 },
          { opacity: 0, transform: 'translate(-50%, -32px) scale(1)' },
        ],
        { duration: NHIP.GIAI_NOI_SONG, easing: EASING_BAY, fill: 'forwards' },
      ));
      hen.push(window.setTimeout(() => n.remove(), NHIP.GIAI_NOI_SONG));
    }, bat + NHIP.XU_VAO_GIAI));
  });
  return () => {
    hen.forEach((t) => window.clearTimeout(t));
    anim.forEach((a) => a.cancel());
    vat.forEach((v) => v.remove());
  };
}
