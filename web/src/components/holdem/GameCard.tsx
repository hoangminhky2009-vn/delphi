/**
 * Một lá bài trong Cửa hàng.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 25/07/2026 — MẶT THẺ SẠCH (founder): "đừng cho chú thích ngay trên thẻ bài,
 * hãy cho 1 dấu ! hình tròn ở góc của thẻ và khi bấm vào thì mới mở phần giải
 * thích. Thẻ bài thuần chỉ có tên và hình ảnh."
 *
 * Nên mặt thẻ chỉ còn: TÊN + TRANH (+ dấu ✓ khi chọn). Dòng nhãn ("BIẾN ĐỘNG",
 * mô tả chiến thuật) và dãy sao đã rời sang tờ giải thích — xem TheGiaiThich.
 *
 * ⚠ Nút (!) là một <button> RIÊNG, không nằm trong nút chọn thẻ. Lồng button
 * trong button là HTML không hợp lệ và React sẽ cảnh báo; quan trọng hơn, bấm
 * (!) mà vô tình MUA luôn lá bài là mất tiền vì đọc hướng dẫn.
 *
 * Artwork là SVG do server cấp (`/holdem/art`, 28 cảnh). Nhúng bằng
 * dangerouslySetInnerHTML là AN TOÀN ở đây và chỉ ở đây, vì:
 *   - nguồn là hằng số trong repo của chính ta, không phải dữ liệu người dùng;
 *   - server đã có test chặn `<script>`, `<image>`, URL ngoài (holdem_art.test.ts);
 *   - React không có API nào khác để nhúng SVG động mà giữ được <defs>/gradient.
 * Nếu sau này art đến từ nguồn không tin được → phải làm sạch trước, không
 * được nới chỗ này.
 */
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import { NHIP_RUNG, rung } from '@/lib/rung';
import px from '@/styles/pixel.module.css';
import s from './GameCard.module.css';
import { htmlTinh } from '@/lib/html_tinh';

/**
 * HAI HIỆU ỨNG, HAI CÁI CỚ KHÁC NHAU — §XII. Không dùng lẫn:
 *
 *  • LẬT (`px.lat`) khi Ô NÀY ĐỔI SANG LÁ KHÁC (khảo sát lại / vòng mới). Lật là
 *    động tác đổi MẶT, nên chỉ đúng khi mặt thật sự đổi. Lật một lá đang đứng yên
 *    chỉ vì người chơi chạm vào nó là hoạt hoạ vô cớ.
 *  • SÁNG khi lá được CHỌN — nay là mắt xích thứ hai của `adChonLa`, thứ mà
 *    `.sel` composes. KHÔNG còn là một lớp riêng (`px.sang`): hai lớp cùng khai
 *    `animation` trên một phần tử thì lớp đứng sau trong bundle NUỐT lớp kia,
 *    im lặng — đo được 23/08, và nó làm lá rơi lại lần thứ hai sau mỗi cú chạm.
 *
 * `lat` TỰ GỠ LỚP sau khi chạy xong. Không phải để dọn DOM mà vì CSS animation
 * không chạy lại khi lớp đã sẵn ở đó — giữ nguyên lớp thì lần kích hoạt thứ hai
 * IM RU. Đây đúng là loại lỗi build vẫn xanh mà không ai thấy gì chuyển động.
 */
const MS_LAT = 320;

export interface GameCardProps {
  id: string;
  ten: string;
  en?: string;
  svg?: string;
  /** Màu chủ đạo + màu quầng sáng của lá — DANH TÍNH lá, tra theo id. */
  mau: readonly [string, string];
  /**
   * ⭐ MÀU ĐÈ THEO TRẠNG THÁI (24/08, founder: *"thẻ bài bán khống khi đặt lệnh
   * chip sẽ hiện là màu đỏ"*).
   *
   * Trước bản này lá KHÔNG có cơ chế đổi màu theo trạng thái: `mau` tra cứng
   * theo id và đổ thẳng vào `--bd`/`--gl`, nên thứ duy nhất nói "mã này đang bị
   * khống" là một cọc chip 15×5px — dưới 2% mặt lá.
   *
   * ⚠ VÌ SAO LÀ PROP CHỨ KHÔNG PHẢI MỘT LỚP CSS: `--bd`/`--gl` được đặt INLINE
   * ngay dưới đây, mà inline luôn thắng mọi lớp. Một lớp `.khong` khai lại hai
   * biến đó sẽ THUA im lặng — đúng họ lỗi cascade đã đốt D122/D123/D126. Đè
   * phải đè ở ĐÚNG CHỖ TÍNH, và đây là chỗ đó.
   * ⚠ `mau` giữ nguyên nghĩa DANH TÍNH — đừng gộp hai thứ vào một prop, vì lúc
   * đó không ai đọc ra được lá đang mang màu của chính nó hay màu của trạng thái.
   */
  mauDe?: readonly [string, string];
  chon: boolean;
  vohieu?: boolean;
  /** Lớp hiệu ứng tạm (bay khi mua, ra/vào khi khảo sát lại). */
  hieuUng?: string;
  /**
   * Thứ tự lá trong hàng — CHIA BÀI SO LE (founder 11/08: thao tác phải giống
   * "được chia bài" chứ không phải một cú refresh). Đổ vào biến CSS `--i` để
   * lớp `hieuUng` tự tính `animation-delay`; component không tự quyết nhịp.
   */
  doTre?: number;
  onToggle: () => void;
  /** Bấm dấu (!) — mở tờ giải thích. Không truyền thì không hiện dấu. */
  onGiaiThich?: () => void;
  /**
   * 16/08 — BÀN CƯỢC (thiết kế 07): ẩn nút "MUA" dưới lá. Trên bàn cược lá là
   * ô đặt chip — cầm chip rồi chạm lá — nên một nút "MUA" dưới mỗi lá là ngôn
   * ngữ "đặt lệnh" mà founder bảo bỏ. Trận cũ (không nav) vẫn có nút.
   */
  anNutMua?: boolean;
  /**
   * PHỤ KIỆN vẽ TRONG lá, trên art: cọc chip · dòng giá trị · badge ×2 đòn bẩy.
   * Cha truyền phần tử đã dựng (CocChip…) — GameCard không biết luật của chúng,
   * chỉ cho chỗ đứng (absolute trong `.card`, z-index 4 nằm trên scanline).
   * ⚠ Bên trong không được là <button> (lá đã là button) — CocChip dùng
   * span role=button và tự `stopPropagation`.
   */
  phuKien?: ReactNode;
  /** Viền "đang được mời chạm" — cha đang cầm chip/đòn bẩy, mọi lá đều là đích. */
  duocMoi?: boolean;
}

export const GameCard = memo(function GameCard({
  id, ten, en, svg, mau, mauDe, chon, vohieu, hieuUng, doTre, onToggle, onGiaiThich, anNutMua,
  phuKien, duocMoi,
}: GameCardProps) {
  const [bd, gl] = mauDe ?? mau;
  const itMotion = useReducedMotion();
  const [lat, setLat] = useState(false);
  const idTruoc = useRef(id);

  /* Ô đổi sang lá khác → lật. So `id` chứ không so `ten`: hai lá khác nhau vẫn
     có thể trùng tên hiển thị, còn `id` là thứ engine dùng để phân biệt. */
  /*
   * ⚠ Hiệu lực của effect này phụ thuộc `key` ở NƠI GỌI: key theo LÁ thì React
   * unmount+mount và `idTruoc` luôn bằng `id` ⇒ không bao giờ lật. ShopManHinh
   * key theo Ô chính vì vậy — đừng đổi lại.
   */
  useEffect(() => {
    const doi = idTruoc.current !== id;
    idTruoc.current = id;
    if (!doi || itMotion) return undefined;
    setLat(true);
    const t = setTimeout(() => setLat(false), MS_LAT);
    return () => clearTimeout(t);
  }, [id, itMotion]);

  /*
   * ⚠ STATE `sang` ĐÃ GỠ 23/08. Cú loé "vừa chọn" nay là mắt xích thứ hai trong
   * `adChonLa` mà `.sel` composes, nên nó tự chạy đúng một lần mỗi khi lá được
   * chọn — không cần state, không cần hẹn giờ, và quan trọng nhất: không còn
   * một lớp thứ hai tranh thuộc tính `animation` với cú rơi xuống ô.
   * "Chỉ sáng ở nhịp CHỌN, không ở nhịp bỏ chọn" vẫn đúng: `.sel` chỉ được dán
   * khi chọn. Reduced-motion do khối `@media` trong CSS lo.
   */

  return (
    <div className={s.wrap}>
      <button
        type="button"
        data-card={id}
        disabled={vohieu}
        /*
         * RUNG KHI CHẠM LÁ (founder 11/08). `rung()` đang được gọi ở nút mốc
         * 25/50/75, ALL-IN, KHỚP NGAY — tức đúng những thao tác "bảng điện tử"
         * — mà KHÔNG gọi ở thao tác chạm LÁ BÀI, ngược hẳn ý founder. Chính
         * docstring `rung.ts` viết ra để chữa cảm giác "đặt lệnh chứ không phải
         * chơi bài"; lá bài là chỗ đầu tiên đáng có nó.
         * `rung()` tự im khi reduced-motion và khi máy không hỗ trợ.
         */
        onClick={() => { rung(NHIP_RUNG.cham); onToggle(); }}
        aria-pressed={chon}
        className={[
          s.card, chon ? s.sel : '', duocMoi && !chon ? s.duocMoi : '', hieuUng ?? '',
          // ⚠ KHÔNG dán `px.sang` ở đây nữa: nó khai `animation` riêng nên nó
          // NUỐT cú rơi-xuống-ô của `.sel`. Cú loé nay nằm trong chính
          // `adChonLa` mà `.sel` composes — một lớp, một danh sách, hết tranh.
          lat ? px.lat : '',
        ].filter(Boolean).join(' ')}
        style={{
          ['--bd' as string]: bd,
          ['--gl' as string]: gl,
          ...(doTre !== undefined ? { ['--i' as string]: doTre } : {}),
        }}
      >
        <span className={s.gem} />
        {chon && <span className={s.tick}>✓</span>}
        <div className={s.ti}>{ten.toUpperCase()}</div>
        {en && <div className={s.sub}>{en}</div>}
        <div
          className={s.art}
          // eslint-disable-next-line react/no-danger -- xem docstring đầu file
          dangerouslySetInnerHTML={htmlTinh(svg ?? '')}
        />
        {phuKien}
      </button>

      {/*
        ⚠ Nút (!) là SIBLING position:absolute của thẻ, KHÔNG bọc thẻ trong div.
        Bản đầu (25/07) bọc cả hai vào một `div.khung` — và đó chính là lỗi hiển
        thị founder báo ở màn shop: `.muc` cao CỨNG 172px, `.hangThe > *` là
        `flex: 1 1 0`, nên trước đó `.card` là con TRỰC TIẾP của `.wrap` và co
        được trong hàng. Thêm một flex item không có `flex`/`min-height` vào giữa
        làm chiều cao thẻ tính theo `aspect-ratio: 3/4` từ chiều rộng → tổng vượt
        172px và tràn ra khỏi khung "trọn một khung hình, không cuộn".
        Phần tử absolute nằm NGOÀI luồng nên không đụng gì tới flex.
      */}
      {onGiaiThich && (
        <button
          type="button"
          className={s.hoi}
          /* Coach màn tập rọi nút (!) — mọi lá cùng tên, spotlight lấy cái đầu. */
          data-tap="nut-giai-thich"
          onClick={onGiaiThich}
          aria-label={`Giải thích ${ten}`}
          title="Lá này làm gì?"
        >
          !
        </button>
      )}

      {!anNutMua && (
        <button
          type="button"
          disabled={vohieu}
          onClick={onToggle}
          className={[s.buy, chon ? s.buyOn : ''].filter(Boolean).join(' ')}
        >
          {chon ? '✓ ĐÃ CHỌN' : 'MUA'}
        </button>
      )}
    </div>
  );
});
