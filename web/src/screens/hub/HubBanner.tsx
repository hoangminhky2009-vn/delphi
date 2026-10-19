/**
 * BANNER CỦA Ô ĐẤU TRƯỜNG + RUỘT LỚP TRƯỢT BÀI BÁCH KHOA — chunk NẠP TRỄ của Hub (SPEC `ui-tang-khong-gian` 11/10).
 *
 * Vì sao tách chunk: Hub nằm trong gói chính mà MỌI người chơi tải. Banner cần cả kho chữ bách khoa (`lib/bach_khoa`) và lưới
 * ba lá bài (`server/art/la_bai.ts`) — thứ người chỉ đến để bấm VÀO TRẬN không cần chờ. Trong lúc chunk về, ô giữ NGUYÊN chiều
 * cao (khung banner dựng sẵn ở `Hub.tsx`), nên không khối nào nhảy khi nó tới.
 *
 * ⚠ KHÔNG REQUEST MẠNG: lưới lá đọc thẳng từ `server/art/la_bai.ts` (cùng nguồn `/holdem/art` phục vụ), chữ đọc từ bách khoa.
 *
 * Nội dung (SPEC 11/10): cảnh ĐẦU = tay bài xoè TĂNG → THIÊN NGA ĐEN → GIẢM (tĩnh · không chữ · không hiệu ứng); các cảnh sau =
 * mục bách khoa nền tảng (`ID_BANNER`). Chuyển mờ 10 s. Chạm banner = lớp trượt bài bách khoa của ĐÚNG cảnh đang hiện.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BANG_MAU } from '@config/pixel_luoi';
import { LA_BAI } from '@server/art/la_bai';
import { IconBK, Chu } from '@/screens/bach-khoa/TrangMuc';
import { MUC_THEO_ID, type MucBK } from '@/lib/bach_khoa';
import { ID_BANNER, chuoiDau, duongVeLuoi, goiMo, heSoTayBai, khungCat } from '@/lib/hub_banner';
import { CHU_HUB } from '@/lib/hub_chu';
import { NHIP } from '@/lib/nhip';
import { useLunVung } from '@/components/ui';
import s from './HubBanner.module.css';
import t from './HubTam.module.css';

const MUC_BANNER: readonly MucBK[] = ID_BANNER
  .map((id) => MUC_THEO_ID.get(id))
  .filter((m): m is MucBK => m !== undefined);

// ─── TAY BÀI XOÈ (cảnh đầu) ────────────────────────────────────────────────────────────────────────────────────────

/** Trái → phải: TĂNG → THIÊN NGA ĐEN → GIẢM; vẽ GIẢM trước để TĂNG nằm trên cùng (founder 11/10). */
const LA_TAY = [
  { id: 'giam', khoa: 'gd_giam', goc: 21, vien: 'Q' },
  { id: 'thien_nga', khoa: 'sk_thien_nga_den', goc: 0, vien: 'z' },
  { id: 'tang', khoa: 'gd_tang', goc: -21, vien: 'n' },
] as const;

function HinhLa({ khoa }: { khoa: string }): React.ReactElement | null {
  const luoi = LA_BAI[khoa]?.luoi;
  const dong = useMemo(() => (luoi === undefined ? null : {
    duong: [...duongVeLuoi(luoi, BANG_MAU)],
    khung: khungCat(luoi, BANG_MAU),
  }), [luoi]);
  if (dong === null) return null;
  return (
    <svg viewBox={dong.khung} shapeRendering="crispEdges" aria-hidden="true">
      {dong.duong.map(([ch, d]) => <path key={ch} fill={BANG_MAU[ch]} d={d} />)}
    </svg>
  );
}

/**
 * Lá bài THẬT của hệ lá (`docs/ui-ux/08-la-bai.md`): mặt giấy kem, góc khấc, viền mảnh màu lá, hình ở giữa, hình nhỏ ở hai góc.
 * KHÔNG chữ, KHÔNG hiệu ứng. Góc ±21° quanh MỘT tâm xoay dưới đáy.
 */
export function TayBai(): React.ReactElement {
  return (
    <span className={s.lbBo} role="img" aria-label={CHU_HUB.bannerTayBai}>
      <span className={s.lbXoay}>
        {LA_TAY.map((la) => (
          <span key={la.id} className={`${s.lbO} ${s[`lb_${la.id}`]}`} style={{ ['--goc' as string]: `${la.goc}deg`, ['--vien' as string]: BANG_MAU[la.vien] }}>
            <span className={s.lbLa}>
              <span className={s.lbKhung} />
              <span className={`${s.lbGoc} ${s.lbTr}`}><HinhLa khoa={la.khoa} /></span>
              <span className={s.lbHinh}><HinhLa khoa={la.khoa} /></span>
              <span className={`${s.lbGoc} ${s.lbBl}`}><HinhLa khoa={la.khoa} /></span>
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

// ─── BANNER ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface HubBannerProps {
  /** Lớp trượt đang mở ⇒ banner đứng (không đổi cảnh sau lưng người đang đọc). */
  tamMo: boolean;
  /** Chạm banner ⇒ mở bài của cảnh đang hiện. */
  onMo: (mucId: string) => void;
}

export default function HubBanner({ tamMo, onMo }: HubBannerProps): React.ReactElement {
  const [i, datI] = useState(0);
  // Chữ đổi SAU khi mờ đi một nhịp: `hienI` là cảnh mà dòng chữ đang nói tới.
  const [hienI, datHienI] = useState(0);
  const [doi, datDoi] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const [k, datK] = useState(0.6);
  const { lun, bind } = useLunVung();

  // Đổi cảnh mỗi 10 s; dừng khi lớp trượt mở HOẶC khi tab bị ẩn (không đốt pin cho cảnh không ai thấy).
  useEffect(() => {
    if (tamMo || MUC_BANNER.length < 2) return undefined;
    let t: ReturnType<typeof setInterval> | null = null;
    const chay = (): void => {
      if (t !== null) return;
      t = setInterval(() => datI((x) => (x + 1) % MUC_BANNER.length), NHIP.HUB_BANNER);
    };
    const dung = (): void => { if (t !== null) clearInterval(t); t = null; };
    const doiHien = (): void => { if (document.visibilityState === 'hidden') dung(); else chay(); };
    if (document.visibilityState !== 'hidden') chay();
    document.addEventListener('visibilitychange', doiHien);
    return () => { dung(); document.removeEventListener('visibilitychange', doiHien); };
  }, [tamMo]);

  useEffect(() => {
    if (i === hienI) return undefined;
    datDoi(true);
    const t = setTimeout(() => { datHienI(i); datDoi(false); }, NHIP.HUB_BANNER_CHU);
    return () => clearTimeout(t);
  }, [i, hienI]);

  // Tay bài thu theo bề rộng banner (cỡ gốc 350 px).
  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const do1 = (): void => datK(heSoTayBai(el.clientWidth));
    do1();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(do1);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const m = MUC_BANNER[i];
  const mChu = MUC_BANNER[hienI];
  if (m === undefined || mChu === undefined) return <div className={s.banner} />;
  const mo = (): void => onMo(m.id);

  return (
    <div
      ref={ref}
      className={`${s.banner} ${lun ? s.bannerLun : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Đọc bách khoa: ${m.ten}`}
      data-banner={m.id}
      style={{ ['--lb-k' as string]: k.toFixed(3) }}
      onClick={mo}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mo(); } }}
      {...bind}
    >
      {!tamMo && MUC_BANNER.length > 1 && <span key={i} className={s.tienDo} aria-hidden="true" />}
      {MUC_BANNER.map((c, j) => (
        <div key={c.id} className={`${s.canh} ${j === i ? s.hien : ''}`} data-i={j} aria-hidden={j === i ? undefined : true}>
          {j === 0
            ? <span className={`${s.vat} ${s.vatTinh}`}><TayBai /></span>
            : (
              <>
                <span className={s.hao} />
                <span className={s.vat}><IconBK ten={c.icon} size={96} /></span>
              </>
            )}
        </div>
      ))}
      <span className={s.cham} aria-hidden="true">
        {MUC_BANNER.map((c, j) => <i key={c.id} className={j === i ? s.on : ''} />)}
      </span>
      <span className={`${s.chu} ${doi ? s.chuDoi : ''}`}>
        <span className={s.hangTag}>
          <span className={s.tag}>{CHU_HUB.bannerHoi}</span>
          <span className={s.doc}>{CHU_HUB.bannerDoc}</span>
        </span>
        <span className={s.goi}>{goiMo(mChu)}</span>
      </span>
    </div>
  );
}

// ─── RUỘT LỚP TRƯỢT BÀI BÁCH KHOA ──────────────────────────────────────────────────────────────────────────────────

export interface NoiDungBachKhoaProps {
  mucId: string;
  /** Chạm từ khoá `{id|chữ}` ⇒ đổi sang bài khác NGAY TRONG lớp trượt (không rời Hub). */
  onDoi: (mucId: string) => void;
}

/**
 * RUỘT bài bách khoa trong lớp trượt (khung trượt + nút chính do Hub dựng): câu gợi mở TO → ngoài đời → chuỗi "vì sao" → ví dụ.
 * Điều khiển từ ngoài (`mucId`) để nút chính MỞ BÁCH KHOA của Hub luôn trỏ đúng bài đang đọc.
 * ⚠ A10: chữ là của bách khoa (mô tả, không kê đơn) — Hub không thêm một chữ nào của riêng mình ở thân bài.
 */
export function NoiDungBachKhoa({ mucId, onDoi }: NoiDungBachKhoaProps): React.ReactElement | null {
  const m = MUC_THEO_ID.get(mucId);
  if (m === undefined) return null;
  const c = chuoiDau(m);
  const doiBai = (id: string): void => { if (MUC_THEO_ID.has(id)) onDoi(id); };
  return (
    <>
      <div className={t.tamDau}>
        <span className={t.anhTam}><IconBK ten={m.icon} size={48} /></span>
        <span className={t.tamTenKhoi}>
          <span className={t.tamTen}>{m.ten}</span>
          <span className={t.tamTag}>{m.anh}</span>
        </span>
      </div>
      <p className={t.tamHoi}>{m.nhac}</p>
      <div className={t.chiTiet}>
        <p className={t.tamMo}><Chu s={m.ngoai} onMo={doiBai} /></p>
        {c !== null && (
          <>
            <p className={t.tamHoi}>{c.ten}</p>
            {c.buoc.map((b, j) => (
              <div key={j} className={t.buoc}><b>{j + 1}</b><span><Chu s={b} onMo={doiBai} /></span></div>
            ))}
            <div className={t.ket}><Chu s={c.ket} onMo={doiBai} /></div>
          </>
        )}
        {m.viDu !== undefined && (
          <div className={t.viDu}><b>VÍ DỤ · </b><Chu s={m.viDu} onMo={doiBai} /></div>
        )}
      </div>
    </>
  );
}
