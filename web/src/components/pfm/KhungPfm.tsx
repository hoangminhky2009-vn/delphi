/**
 * KHUNG PFM — vỏ KHÔNG CUỘN của bốn tab SỔ · HŨ · GƯƠNG · THẺ (SPEC `pfm-tang-khong-gian`, đợt 3 của bộ luật bento).
 *
 * ─── VÌ SAO LÀ MỘT VỎ DÙNG CHUNG, NẰM NGOÀI MÀN NẠP TRỄ ─────────────────────────────────────────────────────────────
 * Route vẫn PHẲNG (một route mỗi tab — tập `path` bằng đúng `MAN_HOP_LE`, xem `TabTaiChinh`), nhưng cả bốn route cùng dựng
 * `<KhungPfm tab=…>` ở CÙNG vị trí cây React ⇒ React giữ NGUYÊN một thể hiện khi đổi tab: dải tab không dựng lại (không nháy), và
 * vỏ nhớ được tab vừa rời để biết HƯỚNG lướt. Màn thật (`So`/`Hu`/`Guong`/`ChanDungPfm`) vẫn nạp trễ bên trong vỏ.
 *
 * ─── HÀNH VI ──────────────────────────────────────────────────────────────────────────────────────────────────────────
 * · Dải tab: đường ra HUB · SỔ HŨ GƯƠNG THẺ · bánh răng · ô giữ sẵn cho Oracle (`[data-oracle-cho]` — Oracle không bao giờ che bàn tiền).
 * · Đổi tab = màn mới LƯỚT NGANG vào, theo thứ tự SỔ → HŨ → GƯƠNG → THẺ (sang phải khi đi tới, sang trái khi lùi). `prefers-reduced-motion`:
 *   hiện tức thì. Màn cũ không lướt ra (route đã tháo nó): chấp nhận được vì màn mới phủ kín khung — xem ảnh cặp trong báo cáo.
 * · Bánh răng mở lớp trượt CÀI ĐẶT (`TamTruot`, giữ BỐN cửa đồng ý — `NoiDungCaiDatPfm`), không còn tấm phủ riêng.
 * · Chiều cao = 100dvh − đầu 12 − đáy 8 (xem `AppShell.module.css` `[data-khung-pfm]`): KHÔNG thanh cuộn ở 390×812 và 360×640.
 *
 * ⚠ Dải tab dùng LẠI `TAB_TAI_CHINH` (một nguồn cho route + đốm báo của THẺ — A11.5), không khai danh sách thứ hai.
 */
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { DomBao, useDomHien } from '@/components/DomBao';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { TamTruot } from '@/components/ui/TamTruot';
import { TamDau } from '@/screens/hub/TamDau';
import { CHU_BENTO as CB } from '@/lib/pfm_chu';
import { NHIP } from '@/lib/nhip';
import { ROUTE_HUB } from '@/lib/vocab';
import { TAB_TAI_CHINH } from './TabTaiChinh';
import s from './KhungPfm.module.css';

/** Thứ tự tab = thứ tự lướt. Khớp `TAB_TAI_CHINH` (bài canh `pfm_khung.test.tsx` đối chiếu hai danh sách). */
export const THU_TU_TAB = ['so', 'hu', 'guong', 'the'] as const;
export type MaTab = (typeof THU_TU_TAB)[number];

/**
 * ⭐ MÀN CŨ LƯỚT RA (demo bản 6 — `doiTab`: màn mới vào từ ±100%, màn cũ trượt −huong×28% và mờ hết). Route đã tháo màn cũ khỏi cây React nên
 * giữ lại một BẢN CHỤP TĨNH của nó (`cloneNode`) — chụp ở hai cửa vào duy nhất của việc đổi tab, TRƯỚC khi cây đổi: cú chạm dải tab
 * (`onClickCapture`) và `popstate` (Back/Forward). Bản chụp không có hành vi (`inert`, `aria-hidden`), mọi hoạt ảnh bên trong bị tắt (không nháy
 * lại hiệu ứng trồi), và rời DOM bằng ĐỒNG HỒ đúng nhịp lướt — không `onfinish`.
 */
const MS_RA = NHIP.PFM_TAB_LUOT + 60;

/**
 * `popstate` phải được nghe TRƯỚC bộ định tuyến: nó cũng nghe sự kiện này và React xả bản vẽ mới ngay sau lời gọi của nó, nên một bộ nghe đăng ký
 * SAU (kể cả pha capture — đã đo ở Chrome: bản vẽ mới vào DOM trước khi bộ nghe chạy) chụp phải màn đã thay. Đăng ký ở MỨC MODULE: tệp này nạp
 * (import tĩnh từ routes) trước khi `createBrowserRouter` chạy. Thể hiện đang sống gắn hàm chụp của nó vào `chupKhiLui`.
 */
let chupKhiLui: (() => void) | null = null;
if (typeof window !== 'undefined') window.addEventListener('popstate', () => chupKhiLui?.(), true);

/** Hướng lướt: +1 = đi tới (màn mới vào từ phải) · −1 = lùi · 0 = lần dựng đầu (không lướt). Hàm thuần — có bài canh. */
export function huongLuot(tu: MaTab | null, den: MaTab): -1 | 0 | 1 {
  if (tu === null || tu === den) return 0;
  return THU_TU_TAB.indexOf(den) > THU_TU_TAB.indexOf(tu) ? 1 : -1;
}

const NoiDungCaiDat = lazy(() => import('./NoiDungCaiDatPfm'));

export function KhungPfm({ tab, children }: { tab: MaTab; children: ReactNode }): React.ReactElement {
  const domHien = useDomHien();
  const [moCaiDat, datMoCaiDat] = useState(false);
  /*
   * ⭐ LỚP CÀI ĐẶT TỰ ĐÓNG KHI ROUTE / QUERY ĐỔI (SPEC 5b.3 "lớp trượt tự đóng khi đổi route"; RÀ 12/10 C1). Vỏ giữ MỘT thể hiện qua bốn route nên
   * `moCaiDat` sống sót khi đổi tab — và `TamTruot` không tự đóng. Lớp của từng màn chết theo màn; lớp của VỎ thì phải tự canh.
   * ⚠ Canh cả `search`: bước dựng từ khung chia tiền khi đang đứng ở HŨ chỉ đổi query (`?tao=`), không đổi đường.
   */
  const viTri = useLocation();
  const khoaViTri = `${viTri.pathname}${viTri.search}`;
  const khoaViTriTruoc = useRef(khoaViTri);
  useEffect(() => {
    if (khoaViTriTruoc.current === khoaViTri) return;
    khoaViTriTruoc.current = khoaViTri;
    datMoCaiDat(false);
  }, [khoaViTri]);
  /*
   * Hướng lướt suy ngay trong lượt vẽ khi `tab` đổi (mẫu "nhớ từ lượt vẽ trước" của React — không `useEffect`: effect chạy SAU khi
   * màn mới đã vẽ một khung hình ở vị trí 0, rồi mới thêm lớp lướt ⇒ màn nháy một khung). `dem` đổi mỗi lần ⇒ `key` của vùng thân
   * đổi ⇒ CSS animation chạy lại kể cả khi hướng lặp lại.
   */
  const [luot, datLuot] = useState<{ tab: MaTab; huong: -1 | 0 | 1; dem: number }>({ tab, huong: 0, dem: 0 });
  let hien = luot;
  if (luot.tab !== tab) {
    hien = { tab, huong: huongLuot(luot.tab, tab), dem: luot.dem + 1 };
    datLuot(hien);
  }

  const thanRef = useRef<HTMLDivElement | null>(null);
  const banChup = useRef<{ tab: MaTab; el: HTMLElement } | null>(null);
  const tabHienRef = useRef<MaTab>(tab);
  tabHienRef.current = hien.tab;
  const chup = useCallback((): void => {
    const man = thanRef.current?.querySelector<HTMLElement>(':scope > [data-man]');
    if (man === null || man === undefined) return;
    const b = man.cloneNode(true) as HTMLElement;
    b.removeAttribute('data-man'); b.removeAttribute('data-luot');
    b.setAttribute('aria-hidden', 'true'); b.setAttribute('inert', '');
    b.querySelectorAll('[data-testid],[id]').forEach((e) => { e.removeAttribute('data-testid'); e.removeAttribute('id'); });
    // Lớp trượt đang mở KHÔNG theo màn ra: nó tự đóng khi đổi route, bản chụp mà mang hộp thoại là một hộp thoại ma trong DOM.
    b.querySelectorAll('[role="dialog"],[data-tam-nen]').forEach((e) => e.remove());
    banChup.current = { tab: tabHienRef.current, el: b };
  }, []);
  useEffect(() => {
    chupKhiLui = chup;
    return () => { if (chupKhiLui === chup) chupKhiLui = null; };
  }, [chup]);
  const henRa = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { for (const h of henRa.current) clearTimeout(h); }, []);
  useLayoutEffect(() => {
    const bc = banChup.current;
    banChup.current = null;
    const than = thanRef.current;
    if (bc === null || than === null || hien.huong === 0 || bc.tab === tab) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) return;
    bc.el.className = `${s.man} ${s.ra}`;
    bc.el.setAttribute('data-ra', hien.huong > 0 ? 'toi' : 'lui');
    than.appendChild(bc.el);
    henRa.current.push(setTimeout(() => bc.el.remove(), MS_RA));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hien.dem]);

  return (
    <div className={s.khung} data-khung-pfm={tab}>
      {/* LỚP NỀN: tối dần ra mép (vignette) — như Hub; không bắt chạm. */}
      <div className={s.nen} aria-hidden="true" />
      <nav className={s.dai} aria-label="Khu tài chính" onClickCapture={chup}>
        <Link to={ROUTE_HUB} className={s.hub} aria-label={CB.veHub} title={CB.veHub}>
          <PixelIcon name="hall" size={16} />
        </Link>
        {TAB_TAI_CHINH.map((t) => (
          <NavLink
            key={t.duong}
            to={t.duong}
            end={t.cuoi}
            className={({ isActive }) => [s.tab, isActive ? s.dangXem : ''].filter(Boolean).join(' ')}
          >
            {t.nhan}
            <DomBao hien={t.dom !== undefined && domHien.includes(t.dom)} />
          </NavLink>
        ))}
        <button
          type="button"
          className={s.banh}
          aria-label="Cài đặt khu Tài chính"
          aria-haspopup="dialog"
          onClick={() => datMoCaiDat(true)}
        >
          <PixelIcon name="lock" size={16} />
        </button>
        {/* Ô GIỮ SẴN CHO ORACLE (xem `OracleChat` chế độ `neoCho`): cuối dải, KHÔNG nút/ô bấm nào trong đó. */}
        <span className={s.choOracle} data-oracle-cho aria-hidden="true" />
      </nav>
      <div className={s.than} ref={thanRef}>
        <div key={hien.dem} className={s.man} data-man="" data-luot={hien.huong === 0 ? undefined : hien.huong > 0 ? 'toi' : 'lui'}>
          <Suspense fallback={<div className={s.cho} aria-busy="true" />}>{children}</Suspense>
        </div>
      </div>
      <TamTruot mo={moCaiDat} onDong={() => datMoCaiDat(false)} nhan="Cài đặt khu Tài chính" cao="lon" dau="cai-dat-pfm">
        <TamDau icon={<PixelIcon name="lock" size={32} />} ten={CB.caiDatTen} tag={CB.caiDatTag} />
        <Suspense fallback={<p className={s.dangTai}>{CB.dangTai}</p>}>
          <NoiDungCaiDat onDong={() => datMoCaiDat(false)} />
        </Suspense>
      </TamTruot>
    </div>
  );
}
