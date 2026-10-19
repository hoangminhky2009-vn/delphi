/**
 * SỐ NHỊP VÒNG — lãi/lỗ của vòng vừa chốt, thu về ĐÚNG MỘT con số PIXEL.
 *
 * Founder 23/08 (lượt 1): *"Phần hiển thị lãi lỗ và lí do giờ thu nhỏ lại chỉ
 * còn 1 con số (vẫn giữ nguyên hiệu ứng nhảy số và phát sáng) và đặt ở vị trí t
 * khoanh đỏ"* — chỗ khoanh là mép phải hàng nhãn lăng kính, ngay đầu màn.
 * Founder 23/08 (lượt 2): *"Toàn bộ phần ở ảnh 1 thu nhỏ lại chỉ còn 1 con chữ
 * ở vị trí trong ảnh 2, đổi số thành pixel và vẫn cho nó nhảy/loé sáng bình
 * thường nhưng chỉ ở góc đó, bấm vào thì mới hiện ra nguyên nhân và nó sẽ cứ
 * lấp láy nhẹ ở đó nếu không được bấm vào."*
 *
 * ─── VÌ SAO MỘT CON SỐ LẠI ĐỦ ─────────────────────────────────────────────
 * Khối kết quả cũ chiếm gần một màn và in BỐN đại lượng khác nhau cho cùng một
 * vòng (headline NAV · số neon tổng chuỗi · QUỸ VÒNG · delta tiền mặt), mỗi cái
 * một mẫu số — người chơi phải tự đoán cái nào là "tôi vừa được/mất bao nhiêu".
 * Ở đây chỉ còn MỘT: chênh lệch NAV trước↔sau vòng.
 *
 * ⚠ Con số này là NÚT, không phải nhãn: nó là đường duy nhất còn lại tới dây
 * chuyền "VÌ SAO". D26 §18.5 đòi lý do mất tiền phải tới được; thu gọn thì được,
 * chôn mất thì không. Và từ 23/08 nó là đường duy nhất THẬT — ba ngoại lệ tự mở
 * của D114 đã gỡ, nên nếu nó im thì không còn ai kể chuyện vòng vừa rồi.
 * ⇒ Đó chính là lý do nó LẤP LÁY khi chưa ai chạm: một cửa duy nhất mà đứng im
 * thì không khác gì cửa khoá.
 */
import { useEffect, useState } from 'react';
import { useReducedMotion, useSoChay } from '@/lib/hooks';
import { mocKhoanNoiVao, NHIP } from '@/lib/nhip';
import mo from '@/styles/motion.module.css';
import s from './SoNhipVong.module.css';

/**
 * Ngưỡng "vòng động mạnh" — trên mức này cú nổ mỗi vòng dùng biên độ lớn (D185).
 *
 * ⚠ 10% chọn theo phân phối ĐO ĐƯỢC, không phải số tròn cho đẹp: |lãi/lỗ| trung
 * vị mỗi vòng ở nửa sau trận là 11–23% (đo prod, D112), nên ngưỡng 10% tách ra
 * khoảng một nửa số vòng. Đặt cao hơn thì cú lớn thành hiếm tới mức không ai học
 * được nó có nghĩa gì; đặt thấp hơn thì mọi vòng đều "mạnh", tức không vòng nào
 * mạnh cả — đúng bài học "rung phải HIẾM mới đáng sợ" (D113).
 * PLAYTEST-TUNE: đây là số hiển thị, không phải tham số kinh tế A4/A5.
 */
const NGUONG_MANH_PCT = 10;

/**
 * % CẢ VÍ CỦA VÒNG — MỘT phép chia cho mọi chỗ in con số vòng (D336, 15/09).
 *
 * ⚠⚠ Có hàm này vì tấm VÌ SAO từng in một con số % KHÁC ở ngay dưới con số này:
 * tổng các dòng lý do, mà mỗi dòng là % giá của MỘT mã. Ngoài bàn −38%, mở tấm ra
 * −123,47% (ảnh prod founder gửi 15/09). Hai chỗ in "% vòng này" phải gọi cùng một
 * hàm, không phải hai phép chia trông giống nhau (D61).
 * `goc <= 0` (ghế cháy sạch) ⇒ không có % nào có nghĩa ⇒ 0.
 */
export function phanTramNhip(delta: number, goc: number): number {
  return goc > 0 ? (delta / goc) * 100 : 0;
}

export function SoNhipVong({
  delta, goc, dangMo, onCham, vong, gap = false, khoan, dienKhoan = false,
}: {
  /** Chênh lệch NAV của vòng vừa chốt (chip) — hiệu hai ảnh chụp headline. */
  delta: number;
  /**
   * Mẫu số của con số % — NAV *trước* vòng (hoặc tiền mặt trước, ở nhánh trận
   * cũ). Cha truyền xuống cùng tử số để hai vế luôn cùng một đại lượng.
   */
  goc: number;
  dangMo: boolean;
  onCham: () => void;
  /** Số vòng — `key` của hoạt ảnh neo vào đây, xem chú thích dưới. */
  vong: number;
  /**
   * Vòng này có tin KHÔNG SUY ĐƯỢC từ con số (bị chốt hộ · vốn bị siết) ⇒ lời
   * mời chạm phải rõ hơn hẳn một vòng thường. Trước 23/08 hai ca ấy tự bung cả
   * khối; nay chúng đi bằng CƯỜNG ĐỘ lấp láy thay vì bằng diện tích.
   */
  gap?: boolean;
  /**
   * D435 — tiền TỪNG KHOẢN nổi của vòng (chip, CÙNG danh sách + thứ tự với hàng hộp `KhoanNoi`). Cùng `dienKhoan` ⇒ con
   * số BƯỚC theo từng hộp vào hàng (`mocKhoanNoiVao(i)`), mỗi bước nhún một nhịp, hộp cuối vào xong thì RUNG và KHỚP về
   * đúng tổng (`delta` — tổng các hộp có thể lệch tổng thật vì hộp gộp "khoản khác"/phí). Founder 27/09: hiệu ứng ấy
   * thuộc về con số ở MÀN CHÍNH theo nhịp hộp chữ nổi, không phải tấm VÌ SAO.
   */
  khoan?: readonly number[] | undefined;
  /** D435 — bước LÃI/LỖ đang diễn (hàng hộp khoản đang vào). Tắt ⇒ đứng ngay ở tổng. */
  dienKhoan?: boolean;
}) {
  const giam = useReducedMotion();
  const soKhoan = khoan?.length ?? 0;
  const buocDuoc = dienKhoan && soKhoan > 0 && !giam;
  const [daVao, setDaVao] = useState(buocDuoc ? 0 : soKhoan);
  const [khop, setKhop] = useState(false);
  useEffect(() => {
    if (!buocDuoc) { setDaVao(soKhoan); return undefined; }
    setDaVao(0);
    setKhop(false);
    const hen: number[] = [];
    for (let i = 0; i < soKhoan; i += 1) hen.push(window.setTimeout(() => setDaVao(i + 1), mocKhoanNoiVao(i)));
    // Khớp một nhịp SAU hộp cuối — cùng khoảng cách giữa hai hộp, để cú rung là "nhịp kế" chứ không chồng lên hộp cuối.
    hen.push(window.setTimeout(() => setKhop(true), mocKhoanNoiVao(soKhoan - 1) + NHIP.KHOAN_NOI_CACH));
    return () => { for (const h of hen) window.clearTimeout(h); };
  }, [buocDuoc, soKhoan, vong]);
  const dangBuoc = buocDuoc && !khop;
  const deltaHien = dangBuoc ? (khoan ?? []).slice(0, daVao).reduce((a, b) => a + b, 0) : delta;
  /*
   * NHẢY SỐ giữ nguyên (founder dặn) — cùng hook với tiền mặt trong shop, nên
   * hai chỗ đếm cùng một nhịp thay vì mỗi chỗ một kiểu.
   */
  /*
   * ⭐ CON SỐ LÀ %, KHÔNG PHẢI CHIP (founder 23/08 lượt 3: *"phần đó đổi lại
   * thành hiển thị %"*).
   *
   * Vì sao % đúng hơn chip ở ĐÚNG chỗ này: nó nằm ngay mép phải hàng nhãn lăng
   * kính, mà hàng đó vốn đã nói bằng % (RỦI RO 0% · PHÒNG THỦ 0% · TIỀN MẶT
   * 100%). Một con số chip đứng cạnh ba con số % là bắt mắt đổi đơn vị giữa
   * chừng. Và % so được giữa hai vòng có vốn khác nhau, chip thì không.
   *
   * ⚠ Nhân 100 rồi mới `useSoChay` để nhịp nhảy đếm trên ĐƠN VỊ NGƯỜI ĐỌC. Cho
   * hook chạy trên phần thập phân rồi mới nhân là số nhảy loạn ở hàng cuối.
   * ⚠ `goc <= 0` (ghế cháy sạch) ⇒ không có % nào có nghĩa; rơi về 0 và để MÀU
   * với bảng VÌ SAO kể phần còn lại, thay vì in `Infinity%`.
   */
  const pct = phanTramNhip(delta, goc);
  // D435 — số ĐANG HIỆN: tổng dồn các khoản đã vào khi đang bước; hết bước thì đúng tổng.
  const pctHien = phanTramNhip(deltaHien, goc);
  const chay = useSoChay(Math.round(Math.abs(pctHien) * 10));
  /*
   * ⚠ BA TRẠNG THÁI, KHÔNG PHẢI HAI. Bản đầu viết `delta >= 0` nên vòng HOÀ
   * (delta = 0) ra "▲ 0" kèm quầng xanh ăn mừng, trong khi thanh lăng kính —
   * đọc CÙNG một nguồn — đứng im. Hai chỗ cùng nguồn mà nói hai điều là đúng
   * thứ chú thích "MỘT NGUỒN" ở `nhipVong` dựng ra để chặn. Hoà thì nói hoà.
   */
  const dau = delta > 0 ? 1 : delta < 0 ? -1 : 0;
  const dauHien = deltaHien > 0 ? 1 : deltaHien < 0 ? -1 : 0;

  /*
   * LẤP LÁY CHO TỚI KHI ĐƯỢC CHẠM — và chỉ tới đó.
   * ⚠ Neo theo `vong`: mỗi vòng là một tin MỚI nên lời mời phải sống lại. Đã
   * chạm ở vòng này rồi thì thôi nhấp nháy — nhấp nháy sau khi người ta đã đọc
   * là quấy, và họ sẽ học cách phớt lờ nó (bài học D77 về hai nấc viền gấp giờ:
   * thứ gào suốt thì không còn ai nghe).
   */
  const [daCham, setDaCham] = useState(false);
  useEffect(() => { setDaCham(false); }, [vong]);

  /*
   * Chuỗi vẽ: một chữ số thập phân là đủ. Hai chữ số ở px=1 ăn thêm ~8px bề
   * ngang trên một hàng đã chật (đo 23/08: 307/343px), mà chữ số thứ hai không
   * đổi quyết định nào.
   * ⚠ Dấu PHẨY thập phân (tiếng Việt), không phải chấm — chấm ở bộ glyph này
   * đang là dấu phân cách NGHÌN.
   */
  const chuoiPct = `${(chay / 10).toFixed(1).replace('.', ',')}%`;

  const nhan = dau === 0
    ? 'Vòng vừa rồi hoà. Chạm để xem vì sao.'
    : `Vòng vừa rồi ${dau > 0 ? 'lãi' : 'lỗ'} ${Math.abs(pct).toFixed(1)}%. Chạm để xem vì sao.`;

  return (
    <button
      type="button"
      /*
       * ⚠ `key` neo vào SỐ VÒNG, không vào dấu lãi/lỗ: hai vòng lỗ liên tiếp
       * mà key không đổi thì lớp CSS còn nguyên và hoạt ảnh KHÔNG chạy lại —
       * bẫy `.lat`/`.sang` của `GameCard`, im lặng và đúng lúc cần nhất.
       */
      key={`nhip-${vong}`}
      className={[
        s.so,
        dauHien > 0 ? s.lai : dauHien < 0 ? s.lo : s.hoa,
        dangMo ? s.mo : '',
        !dangMo && !daCham ? (gap ? s.moiGap : s.moi) : '',
      ].filter(Boolean).join(' ')}
      onClick={() => { setDaCham(true); onCham(); }}
      aria-expanded={dangMo}
      aria-label={nhan}
    >
      {/*
        ⭐ SỐ VẼ BẰNG GLYPH PIXEL (founder 23/08). Cùng bộ lưới với hạng và chuỗi
        thắng — `px = 1` nên chữ cao 12px, vừa đúng hàng nhãn lăng kính vốn cao
        14px: không đội hàng lên một pixel nào.
        ⚠ Dấu đi bằng chính glyph `+`/`−` thay cho ▲▼: hai mũi tên là ký tự do
        FONT HỆ ĐIỀU HÀNH vẽ — đúng thứ §XI gọi là "vật mình không kiểm soát
        được hình", và nó đứng ngay cạnh những con số ta tự vẽ từng ô.
        Hoà thì không dấu: không có gì để nói lên hay xuống.
      */}
      {/*
        ⚠ DẤU TRỪ PHẢI LÀ `-` (U+002D), KHÔNG PHẢI `−` (U+2212). Bản đầu dùng
        dấu trừ toán học cho đẹp; `ChuPixel` lọc ký tự không có glyph nên nó
        BIẾN MẤT IM LẶNG — số âm hiện y hệt số dương, chỉ còn màu để phân biệt.
        Không lỗi, không test đỏ, và chỉ lộ khi đếm glyph trên trình duyệt.
      */}
      {/*
        Lớp bọc CHỈ để chở cú nổ mỗi vòng — xem lý lẽ dài ở `.no` trong CSS.
        Nó phải là phần tử RIÊNG vì nút đã sở hữu `animation` cho nhịp lấp láy,
        mà `animation` không cộng dồn (D122).
      */}
      <span className={`${s.no} ${Math.abs(pct) >= NGUONG_MANH_PCT ? s.noManh : ''}`}>
        {/*
          D435 — HAI lớp bọc nữa, mỗi lớp MỘT animation (§2.5-1 — `animation` không cộng dồn): lớp ngoài NHÚN mỗi khi
          một hộp khoản vào (`key` theo số hộp đã vào ⇒ hoạt ảnh chạy lại), lớp trong RUNG một nhịp lúc khớp tổng.
        */}
        <span key={`b${daVao}`} className={dangBuoc && daVao > 0 ? mo.tongNhay : undefined}>
          <span
            key={khop ? 'khop' : 'cho'}
            className={khop && buocDuoc ? s.khop : undefined}
            data-so-hien={`${dauHien > 0 ? '+' : dauHien < 0 ? '-' : ''}${chuoiPct}`}
            {...(khop && buocDuoc ? { 'data-khop': true } : {})}
          >
            {/*
              D443 — số đi bằng FONT APP (Handjet), không vẽ lại bằng `ChuPixel`: founder 28/09 *"phải đồng bộ font chữ
              đi chứ bro"* — cùng một màn có hai kiểu chữ số (NAV bằng font, số vòng bằng lưới tự dựng). Lý lẽ §XI cũ
              ("chữ do font HỆ ĐIỀU HÀNH vẽ") hết đúng từ D182: Handjet là font pixel tự host.
            */}
            <span className={s.chu}>{`${dauHien > 0 ? '+' : dauHien < 0 ? '-' : ''}${chuoiPct}`}</span>
          </span>
        </span>
      </span>
    </button>
  );
}
