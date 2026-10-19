/**
 * BỘ CHỮ PIXEL — E · D · C · B · A · S · chữ số 0–9 · ba dấu + − × · dấu ?
 *
 * Founder 23/08: *"làm luôn bộ chữ cho từ E đến A nữa đi, để hiện trên thanh
 * chấm điểm nữa … thanh đó bây giờ vẫn đang dùng text đểu đó"* → và lượt sau:
 * *"phải là pixel hết chứ đ** phải text"*. Chữ số + dấu nhân thêm vì thanh còn
 * MỘT chỗ text sót lại: nhãn chuỗi `×2`. "Pixel hết" thì phải hết thật.
 *
 * ─── VÌ SAO PHẢI TỰ VẼ, KHÔNG DÙNG FONT ───────────────────────────────────
 * `web/src/styles/pixel.module.css` (§XI, luật 4) xếp **CHỮ là VẬT**: *"VẬT =
 * thứ có CẠNH chỉ được bằng ngón tay: khung, nút, thẻ, thanh, núm kéo, ô LED,
 * chữ, icon"* — và luật kế nói thẳng vật do FONT HỆ ĐIỀU HÀNH vẽ thì *"người
 * chơi thấy một màn khác màn người dựng đang kiểm. Vật mà mình không kiểm soát
 * được hình thì không phải vật của mình."* Thang hạng là thứ người chơi nhìn
 * mỗi vòng và mang đi khoe, nên nó không được là chữ mượn của hệ điều hành.
 *
 * ⚠ Đây là bộ chữ pixel ĐẦU TIÊN của repo — 34 lưới có sẵn trong `PixelIcon`
 * đều là HÌNH VẼ, không lưới nào là chữ cái.
 *
 * ─── MỘT LƯỚI, HAI CỠ ─────────────────────────────────────────────────────
 * Cùng bộ lưới phục vụ cả ba chỗ, chỉ khác `px`:
 *        thanh trong trận   px=1  → chữ 10×12   (`ThanhPhongCach`)
 *        khối màn kết       px=3  → chữ 30×36   (`PhongCachKet`)
 *        lớp phủ toàn màn   px=6  → chữ 60×72   (`ChuHang`)
 * Hai bộ lưới cho cùng một chữ là hai bản sẽ TRÔI (D61), và cú trôi ở đây biểu
 * hiện là "chữ A trên thanh khác chữ A ở màn kết" — không ai thấy cho tới lúc
 * đặt cạnh nhau.
 *
 * ⚠ `px` phải NGUYÊN. Nửa pixel là nét mờ, mà mờ thì thôi là pixel art.
 */
import type { CSSProperties } from 'react';
import s from './ChuPixel.module.css';

/**
 * Lưới glyph — `X` = ô mực, `.` = trống. Ba bề rộng, và đó là có chủ ý:
 *        chữ cái   10 cột, nét 3 ô — thứ người chơi đọc từ xa;
 *        chữ số     8 cột, nét 2 ô — đứng thành cụm nên phải gọn hơn chữ cái;
 *        dấu ± ×    6 cột          — phụ tố, không phải chữ.
 *
 * ⚠ Chữ nào cũng phải CÂN về thị giác ở cỡ lớn: S/C đối xứng điểm 180°, E/B
 * đối xứng gương trên–dưới, A đối xứng gương trái–phải. Bản vẽ đầu của S không
 * đối xứng và soi trên máy thật thì đọc ra ngay — chữ trông như bị mẻ một góc.
 * Ở px=6 thì lệch một ô là lệch 6 pixel thật, mắt bắt được.
 */
const GLYPH: Record<string, string[]> = {
  E: [
    'XXXXXXXXXX',
    'XXXXXXXXXX',
    'XXX.......',
    'XXX.......',
    'XXX.......',
    'XXXXXXXX..',
    'XXXXXXXX..',
    'XXX.......',
    'XXX.......',
    'XXX.......',
    'XXXXXXXXXX',
    'XXXXXXXXXX',
  ],
  D: [
    'XXXXXXX...',
    'XXXXXXXXX.',
    'XXX....XXX',
    'XXX.....XX',
    'XXX.....XX',
    'XXX.....XX',
    'XXX.....XX',
    'XXX.....XX',
    'XXX.....XX',
    'XXX....XXX',
    'XXXXXXXXX.',
    'XXXXXXX...',
  ],
  C: [
    '..XXXXXX..',
    '.XXXXXXXX.',
    'XXX....XXX',
    'XXX.......',
    'XXX.......',
    'XXX.......',
    'XXX.......',
    'XXX.......',
    'XXX.......',
    'XXX....XXX',
    '.XXXXXXXX.',
    '..XXXXXX..',
  ],
  B: [
    'XXXXXXXX..',
    'XXXXXXXXX.',
    'XXX....XXX',
    'XXX....XXX',
    'XXXXXXXXX.',
    'XXXXXXXX..',
    'XXXXXXXXX.',
    'XXX....XXX',
    'XXX....XXX',
    'XXX....XXX',
    'XXXXXXXXX.',
    'XXXXXXXX..',
  ],
  A: [
    '...XXXX...',
    '..XXXXXX..',
    '.XXX..XXX.',
    'XXX....XXX',
    'XXX....XXX',
    'XXXXXXXXXX',
    'XXXXXXXXXX',
    'XXX....XXX',
    'XXX....XXX',
    'XXX....XXX',
    'XXX....XXX',
    'XXX....XXX',
  ],
  S: [
    '..XXXXXX..',
    '.XXXXXXXX.',
    'XXX....XXX',
    'XXX.......',
    'XXX.......',
    '.XXXXXXX..',
    '..XXXXXXX.',
    '.......XXX',
    '.......XXX',
    'XXX....XXX',
    '.XXXXXXXX.',
    '..XXXXXX..',
  ],
  /*
   * DẤU HỎI — hạng CHƯA XẾP của thanh phong cách mấy vòng đầu (D343, founder 16/09:
   * *"điểm là dấu '?'"*). Rộng 10 ô, nét 3 ô như chữ cái vì nó đứng ĐÚNG chỗ chữ hạng
   * và phải đọc được từ xa như chữ hạng. Thiếu lưới này thì `ChuPixel` lọc ký tự IM
   * LẶNG và thanh xám hiện một ô hạng RỖNG — bẫy D113/D119.
   */
  '?': [
    '..XXXXXX..',
    '.XXXXXXXX.',
    'XXX....XXX',
    '.......XXX',
    '......XXX.',
    '.....XXX..',
    '....XXX...',
    '....XXX...',
    '..........',
    '..........',
    '....XXX...',
    '....XXX...',
  ],
  /*
   * DẤU CHẤM phân cách nghìn — hẹp 4 ô, nằm sát đáy. Không dùng chung lưới dấu
   * 6 ô: chấm mà chiếm bằng dấu cộng thì "1.244" trông như có khoảng trắng.
   */
  '.': [
    '....', '....', '....', '....', '....', '....',
    '....', '....', '....', 'XX..', 'XX..', '....',
  ],
  '×': [
    '......',
    '......',
    '......',
    'XX..XX',
    'XX..XX',
    '.XXXX.',
    '.XXXX.',
    'XX..XX',
    'XX..XX',
    '......',
    '......',
    '......',
  ],
  0: [
    '..XXXX..',
    '.XXXXXX.',
    'XX....XX',
    'XX...XXX',
    'XX..XXXX',
    'XX.XX.XX',
    'XXXX..XX',
    'XXX...XX',
    'XX....XX',
    'XX....XX',
    '.XXXXXX.',
    '..XXXX..',
  ],
  1: [
    '...XX...',
    '..XXX...',
    '.XXXX...',
    '...XX...',
    '...XX...',
    '...XX...',
    '...XX...',
    '...XX...',
    '...XX...',
    '...XX...',
    '.XXXXXX.',
    '.XXXXXX.',
  ],
  2: [
    '.XXXXXX.',
    'XXXXXXXX',
    'XX....XX',
    '......XX',
    '.....XX.',
    '...XXX..',
    '..XXX...',
    '.XX.....',
    'XX......',
    'XX......',
    'XXXXXXXX',
    'XXXXXXXX',
  ],
  3: [
    'XXXXXXX.',
    'XXXXXXXX',
    '......XX',
    '.....XX.',
    '..XXXX..',
    '..XXXX..',
    '.....XX.',
    '......XX',
    '......XX',
    'XX....XX',
    'XXXXXXX.',
    '.XXXXX..',
  ],
  4: [
    '.....XX.',
    '....XXX.',
    '...XXXX.',
    '..XX.XX.',
    '.XX..XX.',
    'XX...XX.',
    'XXXXXXXX',
    'XXXXXXXX',
    '.....XX.',
    '.....XX.',
    '.....XX.',
    '.....XX.',
  ],
  5: [
    'XXXXXXXX',
    'XXXXXXXX',
    'XX......',
    'XX......',
    'XXXXXXX.',
    'XXXXXXXX',
    '......XX',
    '......XX',
    '......XX',
    'XX....XX',
    'XXXXXXX.',
    '.XXXXX..',
  ],
  6: [
    '..XXXXX.',
    '.XXXXXXX',
    'XX......',
    'XX......',
    'XXXXXXX.',
    'XXXXXXXX',
    'XX....XX',
    'XX....XX',
    'XX....XX',
    'XX....XX',
    '.XXXXXX.',
    '..XXXX..',
  ],
  7: [
    'XXXXXXXX',
    'XXXXXXXX',
    '......XX',
    '.....XX.',
    '.....XX.',
    '....XX..',
    '....XX..',
    '...XX...',
    '...XX...',
    '..XX....',
    '..XX....',
    '..XX....',
  ],
  8: [
    '.XXXXXX.',
    'XXXXXXXX',
    'XX....XX',
    'XX....XX',
    '.XXXXXX.',
    '.XXXXXX.',
    'XX....XX',
    'XX....XX',
    'XX....XX',
    'XX....XX',
    'XXXXXXXX',
    '.XXXXXX.',
  ],
  9: [
    '..XXXX..',
    '.XXXXXX.',
    'XX....XX',
    'XX....XX',
    'XX....XX',
    'XXXXXXXX',
    '.XXXXXXX',
    '......XX',
    '......XX',
    '......XX',
    'XXXXXXX.',
    '.XXXXX..',
  ],
  '+': [
    '......',
    '......',
    '......',
    '..XX..',
    '..XX..',
    'XXXXXX',
    'XXXXXX',
    '..XX..',
    '..XX..',
    '......',
    '......',
    '......',
  ],
  '-': [
    '......',
    '......',
    '......',
    '......',
    '......',
    'XXXXXX',
    'XXXXXX',
    '......',
    '......',
    '......',
    '......',
    '......',
  ],
  /*
   * DẤU PHẨY thập phân — cùng lưới 4 ô với dấu chấm, thêm cái đuôi thò xuống.
   * ⚠ Tiếng Việt dùng PHẨY cho thập phân và CHẤM cho hàng nghìn, nên hai glyph
   * này phải PHÂN BIỆT ĐƯỢC ở px=1: chỉ khác đúng một ô đuôi, và đó là đủ —
   * chúng không bao giờ đứng cạnh nhau trong một con số.
   */
  ',': [
    '....', '....', '....', '....', '....', '....',
    '....', '....', '....', 'XX..', 'XX..', '.X..',
  ],
  /*
   * PHẦN TRĂM — 10 ô như chữ cái, vì nó là một VẬT có ba phần (hai ô vuông +
   * vạch chéo) chứ không phải một dấu nhỏ. Hẹp hơn thì hai ô vuông dính vào
   * vạch chéo và ở px=1 nó đọc ra thành một khối mực.
   */
  '%': [
    'XXX....XX.',
    'X.X....XX.',
    'XXX...XX..',
    '.....XX...',
    '....XX....',
    '....XX....',
    '...XX.....',
    '..XX......',
    '.XX...XXX.',
    'XX....X.X.',
    '.......XXX',
    '..........',
  ],
};

/** Số hàng — chung cho mọi glyph, nên chiều cao cụm luôn xác định. */
export const CAO_O = 12;

/** Có glyph cho ký tự này không? Ký tự lạ bị BỎ QUA khi vẽ (xem `ChuPixel`). */
export const coGlyph = (ch: string): boolean => GLYPH[ch] !== undefined;

const rongCua = (ch: string): number => GLYPH[ch]?.[0]?.length ?? 0;

const laMuc = (g: string[], x: number, y: number): boolean => g[y]?.[x] === 'X';

/**
 * Box-shadow của MỘT HÀNG glyph, dùng `currentColor` để `color` của phần tử
 * điều khiển cả hàng — đó là cách duy nhất để màu ĐỔI THEO THỜI GIAN được.
 *
 * ⚠ Cả hai renderer pixel sẵn có của repo đều NUNG CỨNG màu lúc dựng
 * (`PixelIcon.buildShadow` tra `PALETTE`, `pixel_luoi.veDai` ghi thẳng `fill`),
 * nên không cái nào dùng được cho chữ hạng: thanh cần màu theo bậc
 * (`var(--pc-mau)`) và lớp phủ cần dải màu chạy. `currentColor` là đường vòng
 * duy nhất không phải sửa file dùng chung.
 */
function shadowHang(g: string[], y: number, px: number): string {
  const o: string[] = [];
  const row = g[y] ?? '';
  for (let x = 0; x < row.length; x += 1) {
    if (row[x] === 'X') o.push(`${x * px}px 0 currentColor`);
  }
  return o.join(',');
}

/** Box-shadow cho CẢ glyph một lớp (dùng khi không cần dải màu theo hàng). */
function shadowCa(g: string[], px: number): string {
  const o: string[] = [];
  g.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === 'X') o.push(`${x * px}px ${y * px}px currentColor`);
    }
  });
  return o.join(',');
}

/**
 * VIỀN PIXEL 4 PHÍA + bóng đổ lệch — tô mọi ô TRỐNG kề một ô mực.
 *
 * ⚠ Không phải trang trí: soi trên máy thật, nền của khoảnh khắc là một quầng
 * màu đặt ĐÚNG CHỖ chữ đứng, nên chữ chìm vào chính cái quầng tôn nó lên. Bóng
 * lệch một phía không cứu được — nó chỉ tách chữ khỏi nền ở hai cạnh.
 * Outline tối bao quanh sprite cũng là cách pixel art xưa nay vẫn làm, và rẻ
 * hơn `drop-shadow` rất nhiều: `filter` trên phần tử đang transform liên tục
 * bắt trình duyệt hợp thành lại vùng đó mỗi khung hình.
 */
function shadowVienVaBong(g: string[], px: number, vien: string, bong: string): string {
  const o: string[] = [];
  const rong = g[0]?.length ?? 0;
  for (let y = -1; y <= CAO_O; y += 1) {
    for (let x = -1; x <= rong; x += 1) {
      if (laMuc(g, x, y)) continue;
      const ke = laMuc(g, x - 1, y) || laMuc(g, x + 1, y)
        || laMuc(g, x, y - 1) || laMuc(g, x, y + 1);
      if (ke) o.push(`${x * px}px ${y * px}px ${vien}`);
    }
  }
  g.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === 'X') o.push(`${(x + 2) * px}px ${(y + 2) * px}px ${bong}`);
    }
  });
  return o.join(',');
}

export interface ChuPixelProps {
  /** Chuỗi hạng: `'E-'` · `'B+'` · `'SSS'`. Ký tự không có glyph bị bỏ qua. */
  chuoi: string;
  /** Cạnh một ô pixel. PHẢI nguyên. */
  px: number;
  /**
   * Vẽ TỪNG HÀNG thành một phần tử riêng — bật khi cần dải màu chạy DỌC thân
   * chữ (lớp phủ toàn màn). Tắt (mặc định) thì mỗi glyph chỉ một phần tử: rẻ
   * hơn hẳn, và thanh trong trận vẽ lại mỗi vòng nên nó cần rẻ.
   */
  theoHang?: boolean;
  /** Lớp gắn lên cụm — nơi cha treo hiệu ứng của riêng mình. */
  className?: string;
  /** Lớp gắn lên TỪNG glyph — cha dùng để cho các chữ vào lệch pha. */
  lopChu?: string;
  /** Lớp gắn lên từng HÀNG (chỉ khi `theoHang`). */
  lopHang?: string;
  /** Viền/bóng pixel. Tắt ở cỡ nhỏ: ở px=1 viền 1px ăn hết nét chữ. */
  vien?: boolean;
}

export function ChuPixel({
  chuoi, px, theoHang = false, className, lopChu, lopHang, vien = false,
}: ChuPixelProps) {
  const kyTu = [...chuoi].filter(coGlyph);
  return (
    <span
      className={`${s.cum} ${className ?? ''}`}
      style={{ '--px': `${px}px`, '--cao': `${CAO_O * px}px` } as CSSProperties}
      aria-hidden
    >
      {kyTu.map((ch, i) => {
        const g = GLYPH[ch]!;
        return (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={`${ch}-${i}`}
            className={`${s.chu} ${lopChu ?? ''}`}
            style={{ '--i': i, width: rongCua(ch) * px } as CSSProperties}
          >
            {vien && (
              /* Viền + bóng đứng SAU, KHÔNG mang animation màu — nó là cái
                 khung, không phải cái đèn. */
              <i
                className={s.bong}
                style={{ boxShadow: shadowVienVaBong(g, px, '#06040f', 'rgba(6, 4, 16, 0.6)') }}
              />
            )}
            {theoHang
              ? g.map((_, y) => (
                <i
                  // eslint-disable-next-line react/no-array-index-key
                  key={y}
                  className={`${s.hang} ${lopHang ?? ''}`}
                  style={{ top: y * px, boxShadow: shadowHang(g, y, px), '--y': y } as CSSProperties}
                />
              ))
              : <i className={s.hang} style={{ top: 0, boxShadow: shadowCa(g, px) }} />}
          </span>
        );
      })}
    </span>
  );
}
