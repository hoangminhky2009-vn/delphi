/**
 * ORACLE CHAT — bong bóng NỔI, KÉO ĐƯỢC, kiểu chat head Messenger.
 *
 * Founder 22/08: *"con oracal bạn đừng làm nó cứng, làm nó như cái bong bóng chat
 * của messenger ấy"* → 23/08, sau khi thử trên máy thật: *"delphi mang tiếng là
 * bong bóng chat mà t ko di chuyển được là sao"*.
 *
 * Bản đầu (`LoiOracle`) là một KHỐI trong dòng chảy trang; bản hai nổi được nhưng
 * ĐỨNG YÊN một chỗ — và một cái bong bóng đứng yên thì khi nó nằm đè đúng thứ
 * người chơi đang đọc, họ không có cách nào ngoài tắt hẳn. Nay:
 *   · NỔI (`position: fixed`), KÉO được bằng ngón tay, thả ra thì BÁM CẠNH gần
 *     nhất (trái/phải) và nhớ chỗ đó — luật snap ở `lib/oracle_nho.ts` (thuần);
 *   · THU về chat head 44px ↔ MỞ bong bóng có đuôi; bong bóng mở ra ở ĐÚNG cạnh
 *     head đang đứng, đuôi quay về phía linh vật;
 *   · người chơi ĐÓNG thì nó im, đổi trang cũng im — chỉ khi có CÂU MỚI mới hiện
 *     chấm báo. Không bao giờ tự bung lên mặt người chơi sau khi họ đã tắt.
 *
 * ⚠ KÉO ≠ CHẠM: dưới `NGUONG_KEO_PX` là chạm (mở bong bóng), trên là kéo. Không
 * có ngưỡng thì ngón tay run một pixel cũng thành kéo và cái nút thành không bấm
 * được — lỗi kinh điển của mọi thứ vừa kéo vừa bấm.
 * ⚠ `touch-action: none` trên phần kéo: thiếu nó thì trình duyệt cuộn trang trong
 * khi ta đang kéo, và bong bóng "trượt tay".
 * ⚠ KHÔNG hiện ở màn TOÀN TÂM (trận đấu): AppShell chỉ render khi `!toanMan`.
 * ⚠ §XI: không bo góc — dùng nguyên thuỷ `pixel.module.css` (clip-path bát giác).
 * Câu chữ nằm ở `lib/loi_oracle.ts` (thuần, test quét A10/§1.2); đây chỉ là miệng.
 *
 * ─── CHẾ ĐỘ NEO CHỖ GIỮ SẴN (`neoCho`, màn bento không-cuộn — 11/10) ─────────────────────────────────────────────
 * Màn bento (Hub · sảnh Alpha Draft) KHÔNG còn chỗ trống nào cho một lớp phủ trôi nổi: bong bóng ở vị trí nhớ (mặc định gần đáy,
 * bên phải) CHỒNG lên nút VÀO TRẬN (ảnh cặp của cửa sổ Hub). Luật mới cho các màn ấy: màn **dành sẵn một ô** `[data-oracle-cho]`
 * ở hàng đầu (không có nút/ô bấm nào trong đó) và Oracle chỉ hiện **avatar nhỏ NẰM ĐÚNG Ô ĐÓ**; bấm mới bung lời — lời bung xuống
 * từ ô ấy, đóng bằng bấm lại · chạm ra ngoài · Esc · đổi route (không nhớ "đã mở": bong bóng KHÔNG BAO GIỜ tự bung). Không kéo
 * được (kéo là cho chỗ trống, màn này không có chỗ trống). Bài canh: `web/tests/oracle_khong_che.test.tsx` + kịch bản trình duyệt
 * `tests/luong/trinh-duyet/alpha_draft_bento.mjs` (đo `getBoundingClientRect`: head ∩ mọi nút/ô bấm = rỗng ở 390×812 và 360×640).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMe } from '@/api/queries';
import { useTinhCach } from '@/api/tinh_cach';
import { Mascot } from '@/components/Mascot';
import { useReducedMotion } from '@/lib/hooks';
import { hatTheoNgay, loiOracle } from '@/lib/loi_oracle';
import {
  NGUONG_KEO_PX, bottomTuY, docTrangThaiOracle, ghiCauDaDoc, ghiMoOracle,
  ghiViTriOracle, snapViTri, type CanhOracle,
} from '@/lib/oracle_nho';
import { giongCua, type GiongChon } from '@/lib/tinh_cach';
import { ROUTE_ARENA, ROUTE_HUB, ROUTE_TAI_CHINH } from '@/lib/vocab';
import s from './OracleChat.module.css';

const HEAD = 44;
/** Cạnh avatar Oracle ở chế độ neo chỗ giữ sẵn — ô `[data-oracle-cho]` của màn bento rộng đúng ngần này. */
export const CANH_ORACLE_NEO = 36;

interface HopCho { x: number; y: number; w: number; h: number }

/**
 * Tìm ô `[data-oracle-cho]` của màn đang hiện và đo nó (toạ độ viewport — `position: fixed`). Màn có thể dựng ô SAU khi
 * AppShell đã mount (sảnh vừa hỏi máy chủ xong mới vẽ khung) nên có `MutationObserver`; đo gom về MỘT lần mỗi khung hình.
 */
function useChoOracle(bat: boolean, duong: string): HopCho | null {
  const [hop, datHop] = useState<HopCho | null>(null);
  useLayoutEffect(() => {
    if (!bat) { datHop(null); return undefined; }
    let khung = 0;
    let dangNhin: Element | null = null;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => dat());
    const do0 = (): void => {
      khung = 0;
      const e = document.querySelector('[data-oracle-cho]');
      if (e !== dangNhin) {
        if (dangNhin !== null) ro?.unobserve(dangNhin);
        dangNhin = e;
        if (e !== null) ro?.observe(e);
      }
      if (e === null) { datHop(null); return; }
      const b = e.getBoundingClientRect();
      const moi = { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) };
      datHop((cu) => (cu !== null && cu.x === moi.x && cu.y === moi.y && cu.w === moi.w && cu.h === moi.h ? cu : moi));
    };
    function dat(): void { if (khung === 0) khung = requestAnimationFrame(do0); }
    const mo = new MutationObserver(dat);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', dat);
    do0();
    return () => {
      if (khung !== 0) cancelAnimationFrame(khung);
      mo.disconnect();
      ro?.disconnect();
      window.removeEventListener('resize', dat);
    };
  }, [bat, duong]);
  return hop;
}

/** Chữ chạy như đang nói — cùng nhịp CoachTap (2 ký tự mỗi 28 ms). */
function useChuChay(chuoi: string, tat: boolean, chay: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (tat || !chay) { setN(chuoi.length); return undefined; }
    const t = setInterval(() => setN((x) => x + 2), 28);
    return () => clearInterval(t);
  }, [chuoi, tat, chay]);
  const xong = n >= chuoi.length;
  return { chu: xong ? chuoi : chuoi.slice(0, n), xong, tua: () => setN(chuoi.length) };
}

export function OracleChat({ neoCho = false }: { neoCho?: boolean } = {}) {
  const me = useMe();
  const user = me.data?.user ?? null;
  const tc = useTinhCach(user !== null);
  const itMotion = useReducedMotion();
  const navigate = useNavigate();
  const [nho] = useState(docTrangThaiOracle);
  const [mo, setMo] = useState(nho.mo);
  /*
   * ⚠ CÂU ĐÃ ĐỌC phải là STATE, không đọc một lần lúc mount: người chơi đọc xong
   * rồi bấm ✕ thì chat head vẫn báo "có câu mới" — chấm đỏ cho thứ họ vừa đọc.
   * Đo được trên prod 23/08. Chấm phải TẮT ngay khi vừa đọc, không đợi tải lại.
   */
  const [daDoc, setDaDoc] = useState(nho.cau_da_doc);
  const [canh, setCanh] = useState<CanhOracle>(nho.canh);
  const [y, setY] = useState(nho.y);
  /** Đang kéo: toạ độ tuyệt đối của head (px). null = đứng yên theo canh/y. */
  const [keo, setKeo] = useState<{ x: number; y: number } | null>(null);
  const moc = useRef<{ dx: number; dy: number; x0: number; y0: number; daKeo: boolean } | null>(null);

  /*
   * ⚠⚠ ORACLE CHỈ SỐNG ĐẦY ĐỦ Ở HUB (chỉ thị founder 06/09). Ngoài Hub nó **mờ và luôn
   * thu về đầu**; chạm mới rõ và mở ra.
   *
   * Vì sao thành luật: đây là lớp phủ `position:fixed` neo đáy, mà **màn nào cũng đặt
   * hành động chính của mình ở đáy** — trong tầm ngón cái. Ở màn SỔ nó đè đúng hàng tờ
   * 1k/2k/5k của bàn tiền, tức che mất chỗ người ta đang định bấm. Một lớp phủ toàn cục
   * thì hoặc nó nhường chỗ, hoặc nó cạnh tranh với mọi màn được viết sau nó.
   * ⚠ MỜ, KHÔNG PHẢI TẮT: người chơi vẫn phải biết Oracle có đó và gọi được. `opacity`
   *   là thứ duy nhất bị hạ — không đụng `pointer-events`, không bỏ `aria-label`, nên
   *   bàn phím và trình đọc màn hình thấy y như cũ.
   */
  const trongHub = useLocation().pathname === ROUTE_HUB;
  const [tuChamTay, setTuChamTay] = useState(false);
  /*
   * ⚠ Đổi màn thì mờ LẠI. Không có dòng này thì chạm một lần ở màn A là nó rõ suốt mọi
   * màn sau đó — tức cái nhường chỗ chỉ nhường đúng một lần rồi thôi.
   */
  const duong = useLocation().pathname;
  useEffect(() => { setTuChamTay(false); }, [duong]);
  /** Ngoài Hub và người dùng CHƯA chạm ở màn này ⇒ mờ + ép thu về đầu. */
  const lamMo = !neoCho && !trongHub && !tuChamTay;
  /* Chế độ neo chỗ giữ sẵn: bung lời là việc của MỘT lần chạm, đổi route là gập lại. */
  const cho = useChoOracle(neoCho, duong);
  const [moNeo, setMoNeo] = useState(false);
  useEffect(() => { setMoNeo(false); }, [duong]);
  useEffect(() => {
    if (!neoCho || !moNeo) return undefined;
    const ngoai = (e: PointerEvent): void => {
      if (!(e.target instanceof Element) || e.target.closest('[data-oracle-neo]') === null) setMoNeo(false);
    };
    const phim = (e: KeyboardEvent): void => { if (e.key === 'Escape') setMoNeo(false); };
    document.addEventListener('pointerdown', ngoai);
    window.addEventListener('keydown', phim);
    return () => { document.removeEventListener('pointerdown', ngoai); window.removeEventListener('keydown', phim); };
  }, [neoCho, moNeo]);
  const dangMo = neoCho ? moNeo : mo;

  const giong = giongCua(user?.age_band, user?.giong_ho_so as GiongChon | undefined);
  // Chưa biết là ai / đang tải hồ sơ thì chưa nói — nói "mời" rồi đổi sang "giục"
  // nửa giây sau là lắp bắp.
  const dangTai = me.isPending || (user !== null && tc.isPending);
  const loi = dangTai ? null : loiOracle(user === null ? null : tc.data, giong, hatTheoNgay());
  const cau = loi?.cau ?? '';
  const moi = cau !== '' && cau !== daDoc;
  const goi = useChuChay(cau, itMotion, dangMo);

  // Đã đọc = đã MỞ và chữ chạy xong. Ghi để lần sau không hiện chấm cho câu cũ.
  useEffect(() => {
    if (dangMo && goi.xong && cau !== '') { ghiCauDaDoc(cau); setDaDoc(cau); }
  }, [dangMo, goi.xong, cau]);

  /*
   * ⚠⚠ ĐO HỘP CỦA PHẦN TỬ ĐANG ĐƯỢC ĐỊNH VỊ, KHÔNG PHẢI CỦA TAY CẦM.
   * `left/top` đặt lên KHUNG NGÒAI, còn `currentTarget` của cú chạm là cái TAY bên
   * trong nó — lấy `dx` từ hộp tay rồi áp cho khung là đặt KHUNG vào chỗ đáng lẽ
   * của TAY. Bam mép phải thì tay cách mép khung 256px ⇒ vừa chạm vào là bong bóng
   * **nhảy ra ngoài màn** (đo được trên prod: ngón tay x=313, tay cầm văng tới x=547
   * trên màn rộng 375). Khi THU thì khung chính là tay nên hai cách trùng nhau — đúng
   * kiểu lỗi chỉ lộ ở MỘT trạng thái, nên bài canh phải dựng ca tay ≠ khung.
   */
  const batDauKeo = useCallback((e: React.PointerEvent) => {
    const nut = e.currentTarget as HTMLElement;
    const hop = (nut.closest('[data-oracle-neo]') as HTMLElement | null) ?? nut;
    const r = hop.getBoundingClientRect();
    moc.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, daKeo: false };
    nut.setPointerCapture?.(e.pointerId);
  }, []);

  const dangKeo = useCallback((e: React.PointerEvent) => {
    const m = moc.current;
    if (!m) return;
    const di = Math.hypot(e.clientX - m.x0, e.clientY - m.y0);
    if (!m.daKeo && di < NGUONG_KEO_PX) return;
    m.daKeo = true;
    setKeo({ x: e.clientX - m.dx, y: e.clientY - m.dy });
  }, []);

  const thaKeo = useCallback((e: React.PointerEvent) => {
    const m = moc.current;
    moc.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!m) return false;
    if (!m.daKeo) return false; // chạm, không kéo — caller xử lý mở/đóng
    const v = snapViTri(e.clientX - m.dx, e.clientY - m.dy,
      { w: window.innerWidth, h: window.innerHeight }, HEAD);
    setCanh(v.canh);
    setY(v.y);
    setKeo(null);
    ghiViTriOracle(v.canh, v.y);
    return true; // đã kéo ⇒ nuốt cú chạm
  }, []);

  if (!loi) return null;
  const dich = loi.dich === 'choi' ? ROUTE_ARENA : ROUTE_TAI_CHINH;
  const cao = typeof window === 'undefined' ? 812 : window.innerHeight;
  if (neoCho) {
    // Màn bento chưa dựng ô giữ sẵn (đang tải / màn dẫn vào bàn tập): không có chỗ an toàn ⇒ không vẽ, KHÔNG rơi về vị trí trôi nổi.
    if (cho === null) return null;
    const ben = Math.max(10, document.documentElement.clientWidth - (cho.x + cho.w));
    return (
      <>
        <button
          type="button"
          className={`${s.dau} ${s.dauNeo}`}
          style={{ left: `${cho.x}px`, top: `${cho.y}px`, width: `${cho.w}px`, height: `${cho.h}px` }}
          onClick={() => setMoNeo((x) => !x)}
          data-testid="oracle-head"
          data-oracle-neo
          data-neo-cho
          aria-expanded={moNeo}
          aria-label={moi ? 'Oracle có câu mới' : 'Mở lời Oracle'}
        >
          <Mascot size={22} float title="" />
          {moi && !moNeo && <span className={s.cham} aria-hidden />}
        </button>
        {moNeo && (
          <div
            className={`${s.khungNoi} ${s.noiNeo}`}
            style={{ top: `${cho.y + cho.h + 6}px`, right: `${ben}px`, left: 'auto', bottom: 'auto' }}
            data-testid="oracle-chat"
            data-oracle-neo
            data-loai={loi.loai}
            data-canh="phai"
          >
            <button
              type="button"
              className={s.bong}
              onClick={() => { if (!goi.xong) goi.tua(); else navigate(dich); }}
              aria-label={`Oracle: ${cau}`}
            >
              <span className={s.chu}>
                {goi.chu}
                {!goi.xong && <span className={s.conTro} aria-hidden>▌</span>}
              </span>
              <span className={s.goiY}>
                {goi.xong ? (loi.dich === 'choi' ? '▶ vào chơi' : '› xem thẻ') : 'chạm để tua'}
              </span>
            </button>
          </div>
        )}
      </>
    );
  }

  /*
   * Vị trí là DỮ LIỆU nên nó inline; mọi thứ khác ở file CSS (cùng nếp với thanh
   * tiến độ của lộ trình). Đang kéo ⇒ bám ngón tay; thả ⇒ bám cạnh đã snap.
   */
  const neo: React.CSSProperties = keo
    ? { left: `${keo.x}px`, top: `${keo.y}px`, right: 'auto', bottom: 'auto' }
    : canh === 'trai'
      ? { left: '10px', right: 'auto', bottom: `${bottomTuY(y, { h: cao }, HEAD)}px` }
      : { right: '10px', left: 'auto', bottom: `${bottomTuY(y, { h: cao }, HEAD)}px` };

  if (!mo || lamMo) {
    return (
      <button
        type="button"
        className={`${s.dau} ${keo ? s.dangKeo : ''} ${lamMo ? s.mo : ''}`}
        style={neo}
        onPointerDown={batDauKeo}
        onPointerMove={dangKeo}
        onPointerUp={(e) => { if (!thaKeo(e)) { setTuChamTay(true); setMo(true); ghiMoOracle(true); } }}
        onPointerCancel={thaKeo}
        /*
         * ⚠ BÀN PHÍM CHỈ BẮN `click`, KHÔNG bắn pointer — chuyển toàn bộ cú mở
         * sang pointer là khoá luôn người dùng bàn phím / trình đọc màn hình ra
         * ngoài. `detail === 0` = click không đến từ chuột (Enter/Space).
         */
        onClick={(e) => { if (e.detail === 0) { setTuChamTay(true); setMo(true); ghiMoOracle(true); } }}
        data-testid="oracle-head"
        data-oracle-neo
        data-canh={canh}
        aria-label={moi ? 'Oracle có câu mới' : 'Mở lời Oracle'}
        data-mo={lamMo ? 'co' : 'khong'}
      >
        <Mascot size={26} float title="" />
        {moi && <span className={s.cham} aria-hidden />}
      </button>
    );
  }

  return (
    <div
      className={`${s.khungNoi} ${canh === 'trai' ? s.benTrai : ''} ${keo ? s.dangKeo : ''}`}
      style={neo}
      data-testid="oracle-chat"
      data-oracle-neo
      data-loai={loi.loai}
      data-canh={canh}
    >
      <div className={s.hang}>
        {/* Linh vật là TAY CẦM: kéo ở đây, chạm ở đây thì thu lại. */}
        <button
          type="button"
          className={s.tay}
          onPointerDown={batDauKeo}
          onPointerMove={dangKeo}
          onPointerUp={(e) => { if (!thaKeo(e)) { setMo(false); ghiMoOracle(false); } }}
          onPointerCancel={thaKeo}
          onClick={(e) => { if (e.detail === 0) { setMo(false); ghiMoOracle(false); } }}
          aria-label="Kéo để di chuyển, chạm để thu gọn Oracle"
        >
          <Mascot size={30} float title="" />
        </button>
        <button
          type="button"
          className={s.bong}
          onClick={() => { if (!goi.xong) goi.tua(); else navigate(dich); }}
          aria-label={`Oracle: ${cau}`}
        >
          <span className={s.chu}>
            {goi.chu}
            {!goi.xong && <span className={s.conTro} aria-hidden>▌</span>}
          </span>
          <span className={s.goiY}>
            {goi.xong ? (loi.dich === 'choi' ? '▶ vào chơi' : '› xem thẻ') : 'chạm để tua'}
          </span>
        </button>
      </div>
    </div>
  );
}
