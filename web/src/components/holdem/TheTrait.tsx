/**
 * THẺ TRAIT (v55, D422) — thẻ · huy hiệu · bảng xác nhận · hạt nổ, CHÉP từ trang demo đã chốt
 * `docs/ui-ux/demo/the-trait.html` (A11.25; founder 26/09: *"t chốt hết hiệu ứng/ hình ảnh và màu của bản demo"*).
 *
 * · Hình: lưới 24×24 sinh từ demo (`lib/trait_hinh.ts`), tô theo HỌ của lá (TÀI xanh / TẬT đỏ; cặp của vai theo tính chất
 *   của chính nó + dấu GHIM). Vàng CHỈ cho hình đồng xu.
 * · Chữ ở client (`lib/trait_chu.ts`, D26). Client không tính gì ngoài tổng điểm cái cân — server kiểm lại (C4).
 * · Bảng xác nhận đi ra `document.body` (portal): nó nằm trong tấm trượt của shop, mà tấm ấy có `transform` ⇒ `position:
 *   fixed` bên trong sẽ bám tấm chứ không bám màn.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { TraitId } from '@config/trait';
import { chuTrait, diemChu, hoMau, TEN_VAI_TRAIT, tongDiemChon, vaiCua } from '@/lib/trait_chu';
import { LUOI_GHIM, LUOI_TRAIT, MAU_TRAIT } from '@/lib/trait_hinh';
import { useReducedMotion } from '@/lib/hooks';
import { useKhungMinigame } from '@/lib/khung_minigame';
import s from './TheTrait.module.css';
import { htmlTinh } from '@/lib/html_tinh';

export { s as kieuTrait };

/** Lưới chữ → SVG: mỗi nấc một <path>, gộp dải ngang (cùng ý `veDai` của demo). Chuỗi hằng từ repo, không từ người dùng. */
function svgLuoi(luoi: readonly string[], pal: Readonly<Record<string, string>>, lop = ''): string {
  const theo = new Map<string, string[]>();
  luoi.forEach((hang, y) => {
    let x = 0;
    while (x < hang.length) {
      const ch = hang[x]!;
      if (!pal[ch]) { x += 1; continue; }
      let r = 1;
      while (x + r < hang.length && hang[x + r] === ch) r += 1;
      if (!theo.has(ch)) theo.set(ch, []);
      theo.get(ch)!.push(`M${x},${y}h${r}v1h-${r}z`);
      x += r;
    }
  });
  const d = [...theo].map(([ch, p]) => `<path fill="${pal[ch]}" d="${p.join('')}"/>`).join('');
  const cls = lop ? ` class="${lop}"` : '';
  return `<svg${cls} viewBox="0 0 ${luoi[0]?.length ?? 24} ${luoi.length}" shape-rendering="crispEdges" aria-hidden="true">${d}</svg>`;
}
const BO_NHO = new Map<string, string>();
/** SVG của lá (kèm dấu GHIM nếu là cặp của vai) — nhớ theo id, lưới là hằng. */
export function svgTrait(id: string, coGhim = true): string {
  const khoa = `${id}|${coGhim ? 1 : 0}`;
  const cu = BO_NHO.get(khoa);
  if (cu) return cu;
  const pal = MAU_TRAIT[hoMau(id)];
  const luoi = LUOI_TRAIT[id] ?? [];
  const ghim = coGhim && vaiCua(id) ? svgLuoi(LUOI_GHIM, pal, s.ghim) : '';
  const ra = ghim + svgLuoi(luoi, pal);
  BO_NHO.set(khoa, ra);
  return ra;
}

const soDep = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/**
 * Một thẻ trait (chợ hoặc bộ hình). `vao` = chạy hoạt ảnh chia bài với độ trễ theo `i`. `gon` = thẻ GỌN của chợ nằm trong
 * hàng lõi của shop (D430): cùng hình, cùng màu, hình 34px, tên một dòng — bảng xác nhận khi chạm vẫn cỡ lớn.
 */
export function TheTrait({ id, i = 0, chon = false, vao = false, gon = false, onMo, vohieu = false }: {
  id: string;
  i?: number;
  chon?: boolean;
  vao?: boolean;
  gon?: boolean;
  onMo: (id: string, el: HTMLButtonElement) => void;
  vohieu?: boolean;
}) {
  const c = chuTrait(id, useKhungMinigame());
  const ho = hoMau(id);
  const html = useMemo(() => svgTrait(id), [id]);
  return (
    <button
      type="button"
      className={[s.the, s[ho], vao ? s.vao : '', gon ? s.gon : ''].filter(Boolean).join(' ')}
      style={{ '--i': i } as CSSProperties}
      data-trait={id}
      data-loai={ho}
      aria-pressed={chon}
      aria-label={`${c.ten}, ${ho === 'tai' ? 'TÀI' : 'TRAIT'} ${diemChu(id as TraitId)}`}
      disabled={vohieu}
      onClick={(e) => onMo(id, e.currentTarget)}
    >
      <span className={s.diem}>{diemChu(id as TraitId)}</span>
      {/* eslint-disable-next-line react/no-danger -- SVG sinh từ lưới hằng trong repo (trait_hinh.ts) */}
      <span style={{ display: 'contents' }} dangerouslySetInnerHTML={htmlTinh(html)} />
      <span className={s.ten}>{c.ten}</span>
      <span className={s.dalay}>ĐÃ LẤY</span>
    </button>
  );
}

/**
 * Huy hiệu trait đang mang (khay). `ghi` = dòng phụ ("GHIM THEO VAI" / "TỪ VÒNG 6"); `choSau` = viền đứt; `gon` = hàng HUD
 * (chỉ hình + điểm — tên nằm ở bảng xem khi chạm).
 */
export function HuyTrait({ id, ghi, choSau = false, gon = false, onMo }: {
  id: string;
  ghi?: string | undefined;
  choSau?: boolean;
  gon?: boolean;
  onMo: (id: string, el: HTMLButtonElement) => void;
}) {
  const c = chuTrait(id, useKhungMinigame());
  const ho = hoMau(id);
  const html = useMemo(() => svgTrait(id, false), [id]);
  return (
    <button
      type="button"
      className={[s.huy, s[ho], choSau ? s.choSau : ''].filter(Boolean).join(' ')}
      data-trait={id}
      data-loai={ho}
      {...(choSau ? { 'data-cho-sau': '' } : {})}
      aria-label={`${c.ten} ${diemChu(id as TraitId)}${ghi ? ` — ${ghi.toLowerCase()}` : ''}`}
      onClick={(e) => onMo(id, e.currentTarget)}
    >
      {/* eslint-disable-next-line react/no-danger -- SVG sinh từ lưới hằng trong repo */}
      <span style={{ display: 'contents' }} dangerouslySetInnerHTML={htmlTinh(html)} />
      <span>
        {gon ? diemChu(id as TraitId) : `${c.ten} ${diemChu(id as TraitId)}`}
        {ghi && <><br /><span className={s.ghi}>{ghi}</span></>}
      </span>
    </button>
  );
}

/** Hạt nổ 12 hạt 6×6 từ tâm phần tử (demo `phutHat`). Không khi giảm chuyển động. */
export function phutHat(el: Element, mau: string, giam: boolean): void {
  if (giam || typeof document === 'undefined') return;
  const r = el.getBoundingClientRect();
  for (let k = 0; k < 12; k += 1) {
    const h = document.createElement('i');
    h.className = s.hat ?? '';
    h.style.background = mau;
    h.style.left = `${r.left + r.width / 2}px`;
    h.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(h);
    const goc = (Math.PI * 2 * k) / 12 + (k % 2 ? 0.2 : -0.2);
    const xa = 40 + (k % 3) * 18;
    if (typeof h.animate !== 'function') { h.remove(); continue; }
    h.animate([
      { transform: 'translate(-50%,-50%)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(goc) * xa}px), calc(-50% + ${Math.sin(goc) * xa}px))`, opacity: 0 },
    ], { duration: 460, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => h.remove();
  }
}
/** Màu hạt theo họ (nấc sáng nhất của họ — demo). */
export const MAU_HAT: Readonly<Record<'tai' | 'tat', string>> = { tai: '#c8fad9', tat: '#ffd3d1' };

export type CheDoTam = 'cho' | 'xem';

/**
 * BẢNG XÁC NHẬN — tấm trượt từ đáy ở điện thoại, hộp giữa màn từ 700px. `cho` = đang ở chợ (có nút LẤY/NHẬN/BỎ + câu
 * cân sau lượt); `xem` = chỉ xem (khay / lá đang mang), chỉ nút ĐÓNG. Esc hoặc chạm nền để đóng; focus về thẻ cũ.
 */
export function TamTrait({ id, cheDo, dangChon = false, chon = [], vaiDauTran, tuVong, onDong, onLay }: {
  id: string | null;
  cheDo: CheDoTam;
  dangChon?: boolean;
  /** Cả phần đang lấy ở chợ — để nói "sau lượt này cân …". */
  chon?: readonly string[];
  /** Cặp của vai: có sẵn từ đầu trận. */
  vaiDauTran?: boolean;
  /** Vòng lá bắt đầu có hiệu lực (chợ) — in ở câu cân. */
  tuVong?: number;
  onDong: () => void;
  onLay?: (id: string, nut: HTMLButtonElement) => void;
}) {
  const giam = useReducedMotion();
  const khungMinigame = useKhungMinigame();
  const [mo, setMo] = useState(false);
  const [hien, setHien] = useState<string | null>(id);
  const nutLay = useRef<HTMLButtonElement>(null);
  const nutDong = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (id) {
      setHien(id);
      const r = requestAnimationFrame(() => setMo(true));
      return () => cancelAnimationFrame(r);
    }
    setMo(false);
    const t = setTimeout(() => setHien(null), giam ? 0 : 320);
    return () => clearTimeout(t);
  }, [id, giam]);
  useEffect(() => {
    if (!mo) return;
    const t = setTimeout(() => (nutLay.current ?? nutDong.current)?.focus({ preventScroll: true }), 60);
    const phim = (e: KeyboardEvent) => { if (e.key === 'Escape') onDong(); };
    document.addEventListener('keydown', phim);
    return () => { clearTimeout(t); document.removeEventListener('keydown', phim); };
  }, [mo, onDong]);
  if (!hien || typeof document === 'undefined') return null;
  const c = chuTrait(hien, khungMinigame);
  const ho = hoMau(hien);
  const vai = vaiCua(hien);
  const diem = diemChu(hien as TraitId);
  let cau: ReactNode;
  if (cheDo === 'cho') {
    const sau = tongDiemChon(dangChon ? chon.filter((x) => x !== hien) : [...chon, hien]);
    cau = sau === 0
      ? `Sau lượt này cân về 0 — chốt được.${tuVong ? ` Lá có hiệu lực từ vòng ${tuVong}.` : ''}`
      : `Sau lượt này cân ${soDep(sau)}. Phần lấy phải về đúng 0 mới chốt được.`;
  } else {
    cau = vai || vaiDauTran
      ? `Có sẵn từ đầu trận khi vai là ${TEN_VAI_TRAIT[vai ?? ''] ?? 'vai này'} — không bày ở chợ.`
      : 'Mang tới hết trận, không gỡ được.';
  }
  return createPortal(
    <>
      <div className={[s.man, mo ? s.mo : ''].filter(Boolean).join(' ')} onClick={onDong} aria-hidden="true" data-tap="nen-tam-trait" />
      <div
        className={[s.bm, s.tam, s[ho], mo ? s.mo : ''].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tam-trait-ten"
        data-tap="tam-trait"
        data-trait={hien}
      >
        <div className={s.tamDinh}>
          {/* eslint-disable-next-line react/no-danger -- SVG sinh từ lưới hằng trong repo */}
          <div className={s.tamArt} dangerouslySetInnerHTML={htmlTinh(svgTrait(hien))} />
          <div>
            <span className={s.chip}>{ho === 'tai' ? 'TÀI' : 'TRAIT'} · {diem} ĐIỂM</span>
            <h2 className={s.tamTen} id="tam-trait-ten">{c.ten}</h2>
            {vai && <span className={s.chipVai}>GHIM THEO VAI {TEN_VAI_TRAIT[vai] ?? vai.toUpperCase()}</span>}
          </div>
        </div>
        <div className={s.muc}><b>TRONG TRẬN</b><p>{c.luat}</p></div>
        {c.doi && <div className={`${s.muc} ${s.doi}`}><b>NGOÀI ĐỜI</b><p>{c.doi}</p></div>}
        <p className={s.tamCan} data-tap="cau-can-tam">{cau}</p>
        <div className={s.tamNut}>
          <button type="button" ref={nutDong} className={`${s.nut} ${s.nutPhu}`} onClick={onDong} data-tap="dong-tam-trait">ĐÓNG</button>
          {cheDo === 'cho' && onLay && (
            <button
              type="button"
              ref={nutLay}
              className={`${s.nut} ${ho === 'tai' ? s.nutTai : s.nutTat}`}
              data-tap="lay-trait"
              onClick={(e) => onLay(hien, e.currentTarget)}
            >
              {dangChon ? 'BỎ LÁ NÀY' : ho === 'tai' ? 'LẤY TÀI NÀY' : 'NHẬN TRAIT NÀY'}
            </button>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}

/**
 * Bảng báo ngắn ở đáy màn (demo `bao`) — tự tắt sau 2,6 s. Gắn THẲNG vào body (như hạt nổ), không qua state: câu "đã
 * chọn" bật đúng lúc tấm chợ đóng và gỡ component, nên một bảng sống trong cây React sẽ tắt theo ngay.
 */
export function baoTrait(chu: string): void {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-tap="bao-trait"]').forEach((x) => x.remove());
  const el = document.createElement('div');
  el.className = s.toast ?? '';
  el.setAttribute('role', 'status');
  el.dataset.tap = 'bao-trait';
  el.textContent = chu;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
