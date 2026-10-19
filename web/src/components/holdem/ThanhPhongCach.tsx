/**
 * THANH PHONG CÁCH — E → SSS (founder 17/08).
 *
 * Founder: *"thanh NAV bây giờ thay vì chỉ là thanh tĩnh thì sẽ là 1 thanh chấm
 * điểm"* · *"thêm hiệu ứng đặc biệt cho thanh NAV + avatar của player theo số
 * điểm mà họ đang giữ"* · *"hiệu ứng ở S-SS hay đặc biệt là SSS phải trông ngầu
 * và sặc sỡ, nổi bật"* · *"Hiệu ứng nên tạo cảm giác kiểu Devil May Cry hay là
 * mấy cái S-SS-SSS trong mấy con game gacha hay combo"*.
 *
 * ─── HAI HỌ HIỆU ỨNG, MỖI HỌ MỘT VIỆC ─────────────────────────────────────
 * · **DMC** — thanh SỐNG và tụt liên tục; áp lực đến từ việc nó đang trôi ngay
 *   lúc bạn nhìn. Ta mượn NGÔN NGỮ đó nhưng đổi NHỊP: thanh ở đây tụt theo
 *   VÒNG, không theo giây. Mỗi vòng dài 25–45s và có lúc nước đi đúng là ngồi
 *   yên — một thanh tụt theo đồng hồ sẽ phạt đúng người đang cân nhắc.
 * · **Gacha/combo** — hạng là một cú ĐÓNG DẤU: chữ bay vào, loé, rung. Ta mượn
 *   nó cho khoảnh khắc LÊN HẠNG (vài lần một trận, nên không thành nhiễu) và
 *   cho khối hạng ở màn kết.
 *
 * ⚠ RÀNG BUỘC BA MẶT (founder nhắc: *"đâu mà chỉ web điện thoại, bạn quên app
 * discord hay là ý định lên ch-play/appstore sau này à"*):
 *   · web/PWA — chỉ animate `transform`/`opacity`;
 *   · Discord Activity — iframe, có MÀN NGANG 1280×720, CSP chặn asset ngoài
 *     ⇒ không CDN, không font ngoài, tự vẽ hết;
 *   · CH Play/App Store sau — RN/Flutter: `transform`/`opacity` map gần 1-1
 *     sang `Animated`/`Transform`+`Opacity`, còn `filter`/`box-shadow` thì không.
 *   ⇒ Hai thuộc tính đó là TẬP GIAO của ba runtime, không phải mẹo tiết kiệm pin.
 * ⚠ LUẬT CHẤM nằm ở `server/holdem/phong_cach.ts` (thuần, dùng chung). Component
 *   này chỉ VẼ một `{diem, hang}` có sẵn — A8.9: đổi client thì viết lại phần
 *   vẽ, không viết lại phần chấm.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { hangCua } from '@server/holdem/phong_cach';
import { useReducedMotion } from '@/lib/hooks';
import { NHIP } from '@/lib/nhip';
import { LuaMomentum, type LyDoDap, type NacLua } from './LuaMomentum';
import { svgTrait } from './TheTrait';
import {
  MOC_MANH, bacHieuUng, daiMauThang, mauTheoDiem, type BacHieuUng,
} from './mau_hang';
import s from './ThanhPhongCach.module.css';
import { htmlTinh } from '@/lib/html_tinh';

/**
 * ĐIỂM CHẠY TUYẾN TÍNH — founder 23/08: *"thêm hiệu ứng tăng/giảm tuyến tính
 * chứ đ** phải sau 1 mỗi round nhảy tót lên xếp hạng mới, cho hiệu ứng đổi từ
 * E>D>C>...>SSS mượt vào"*.
 *
 * ⚠ ĐÂY MỚI LÀ CHỖ LÀM NÊN CẢ HIỆU ỨNG, không phải CSS: hạng, màu và bậc hiệu
 * ứng đều suy từ con số hook này trả về. Điểm bò từ 200 → 900 thì thanh lần
 * lượt đi qua C → B → A → S, chữ đổi từng bậc một và thanh BẮT LỬA đúng lúc
 * băng mốc S. Nhảy thẳng tới đích thì mọi bậc ở giữa biến mất.
 *
 * ⚠ Không dùng `useSoChay`: hook đó làm tròn về bội 10 (đúng cho tiền, sai ở
 * đây — 10 điểm có thể là cả một bậc hạng ở vùng dày như C-/C/C+ cách nhau 55).
 *
 * ⚠ 30 nấc × 30ms: đủ dày để mắt đọc ra "bò lên" chứ không phải "nhảy", và vẫn
 * là NẤC chứ không phải nội suy mượt — §XI, thanh là VẬT nên nó đi từng khấc.
 */
function useDiemChay(dich: number, ms = 900): number {
  const itMotion = useReducedMotion();
  const [hien, setHien] = useState(dich);
  /*
   * ⚠ REF GIỮ GIÁ TRỊ ĐANG HIỆN, KHÔNG GIỮ ĐÍCH. Bản đầu gán `truoc.current =
   * dich` ngay đầu effect, nên đích đổi lần nữa GIỮA hoạt ảnh (hai response
   * `st` liên tiếp: nộp vòng rồi đồng bộ) thì lượt bò mới khởi hành từ ĐÍCH CŨ
   * chứ không từ chỗ số đang đứng — đang hiện 433 mà nhảy vọt lên 900 trong một
   * khấc. Đúng cái "nhảy tót" hook này sinh ra để loại bỏ.
   */
  const hienRef = useRef(dich);
  useEffect(() => {
    const tu = hienRef.current;
    if (itMotion || tu === dich) { hienRef.current = dich; setHien(dich); return undefined; }
    const NAC = 30;
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      if (i >= NAC) { hienRef.current = dich; setHien(dich); window.clearInterval(t); return; }
      const v = Math.round(tu + ((dich - tu) * i) / NAC);
      hienRef.current = v;
      setHien(v);
    }, Math.max(16, Math.round(ms / NAC)));
    return () => window.clearInterval(t);
  }, [dich, ms, itMotion]);
  return hien;
}

export interface PhongCachDTO {
  diem: number;
  hang: string;
  streak: number;
}

/**
 * D343 — "hạng" của thanh khi CHƯA ĐỦ VÒNG: glyph pixel `?`. Không nằm trong `THU_TU`,
 * nên cú `?` → hạng thật luôn là cú LÊN (đóng dấu), không bao giờ là cú TỤT.
 */
export const HANG_CHUA_XEP = '?';

/**
 * D343 — thanh vẽ TRẠNG THÁI NÀO từ một `TrangThaiDTO`. MỘT chỗ quyết cho màn trận:
 *   · `phong_cach` (đủ vòng)             ⇒ thanh thường;
 *   · `phong_cach_tam_tinh` (vòng đầu)   ⇒ xám, dấu `?` (founder 16/09);
 *   · không khối nào (trận không NAV, hoặc API cũ hơn bundle) ⇒ không thanh.
 * ⚠ `phong_cach` THẮNG khi cả hai cùng có — server không gửi cả hai, nhưng đọc ngược thứ tự
 * thì một thanh đã đủ vòng sẽ xám lại.
 */
export function thanhPhongCachCua(st: {
  phong_cach?: PhongCachDTO;
  phong_cach_tam_tinh?: { diem: number; streak: number };
}): { pc: Pick<PhongCachDTO, 'diem' | 'streak'> & { hang?: string }; chuaXep: boolean } | null {
  if (st.phong_cach) return { pc: st.phong_cach, chuaXep: false };
  if (st.phong_cach_tam_tinh) return { pc: st.phong_cach_tam_tinh, chuaXep: true };
  return null;
}

/** Bậc màu — gom E..SSS thành 5 nấc để mắt đọc được từ xa, không phải 20. */
export type BacMau = 'thap' | 'giua' | 'kha' | 'sieu' | 'toi_thuong';

export function bacCua(hang: string): BacMau {
  if (hang === 'SSS' || hang === 'SS') return 'toi_thuong';
  if (hang.startsWith('S')) return 'sieu';
  if (hang.startsWith('A') || hang.startsWith('B')) return 'kha';
  if (hang.startsWith('C') || hang.startsWith('D')) return 'giua';
  return 'thap';
}

/**
 * Thanh chấm điểm. `diem` 0..1000.
 *
 * ⚠ `aria-label` mang HẠNG bằng chữ: người bật trình đọc màn hình, và người bật
 * `prefers-reduced-motion`, vẫn phải biết mình đang ở đâu — hiệu ứng bị tắt thì
 * thứ mất đi là cái NHÁY, không phải cái TIN.
 */
export function ThanhPhongCach({ pc, gon = false, chuaXep = false, lua = null }: {
  /** `hang` được nhận cho vừa hợp đồng cũ nhưng KHÔNG đọc — hạng suy từ điểm đang chạy. */
  pc: Pick<PhongCachDTO, 'diem' | 'streak'> & { hang?: string };
  gon?: boolean;
  /**
   * D343 — chưa đủ vòng để có hạng (`phong_cach_tam_tinh`): thanh VẪN chạy theo điểm tạm
   * tính, nhưng xám nhạt, hạng là dấu `?`, không hiệu ứng bậc nào (founder 16/09).
   */
  chuaXep?: boolean;
  /**
   * v55 (D409) — NGỌN LỬA ĐÀ đứng ở khe bên phải thanh (chỗ dấu ×N cũ, D400). `null`/vắng = trận không cổng ⇒ không vẽ.
   * Nấc/đặc biệt là số server gửi (kể cả LỬA GIẢ +1 — C4); `dap` chỉ là dữ liệu đọc, hoạt ảnh dập chạy khi nấc GIẢM.
   */
  lua?: { nac: NacLua; dacBiet?: boolean; dap?: LyDoDap | null; muLua?: boolean } | null;
}) {
  /*
   * MỌI THỨ SUY TỪ ĐIỂM ĐANG CHẠY, không từ `pc.hang` server chốt. Đó là điều
   * kiện để chữ đổi E→D→C→… lần lượt thay vì nhảy một phát tới đích.
   * ⚠ `hangCua` import từ `@server/holdem/phong_cach` — MỘT NGUỒN với server.
   * Chép bảng ngưỡng sang client là dựng bản thứ hai sẽ trôi (D61), và cú trôi
   * ở đây biểu hiện là "thanh ghi B+ còn màn kết ghi A-".
   */
  const diemChay = useDiemChay(pc.diem);

  /*
   * D343 — BẬT ĐÈN HAI NHỊP: vòng đủ tin về thì thanh VẪN XÁM bò tới điểm thật, tới nơi
   * mới sáng + đóng dấu hạng. Sáng ngay lúc prop đổi thì chữ hạng suy từ điểm CŨ đang bò:
   * `?` đóng dấu thành C rồi giật xuống C- giữa đường — một khoảnh khắc "ra hạng" mà nói
   * hai hạng. Hai nhịp thì nó nói đúng một.
   * ⚠ `choSang` đặt NGAY TRONG LƯỢT RENDER (mẫu "lưu giá trị của lượt trước" của React),
   * không trong effect: effect chạy SAU khi vẽ, nên sẽ có đúng một khung hình thanh đã sáng
   * với hạng của điểm cũ — cú đóng dấu `?`→hạng nổ ở khung hình ấy, rồi nổ lần nữa lúc
   * sáng thật.
   */
  const [chuaXepTruoc, setChuaXepTruoc] = useState(chuaXep);
  const [choSang, setChoSang] = useState(false);
  if (chuaXepTruoc !== chuaXep) {
    setChuaXepTruoc(chuaXep);
    setChoSang(chuaXepTruoc && !chuaXep);
  }
  const xam = chuaXep || choSang;
  const [batDen, setBatDen] = useState(false);
  useEffect(() => {
    if (choSang && diemChay === pc.diem) { setChoSang(false); setBatDen(true); }
  }, [choSang, diemChay, pc.diem]);
  /*
   * ⚠ Hẹn gỡ `.batDen` nằm ở effect RIÊNG, chỉ nghe `batDen` — cùng lý do mảng phụ thuộc
   * của effect nhịp lên hạng bên dưới: nghe thêm `diemChay` thì cleanup huỷ cái hẹn mỗi
   * khấc điểm và lớp dính lại vĩnh viễn.
   */
  useEffect(() => {
    if (!batDen) return undefined;
    const t = window.setTimeout(() => setBatDen(false), NHIP.BAT_DEN_PHONG_CACH);
    return () => window.clearTimeout(t);
  }, [batDen]);

  const hang = xam ? HANG_CHUA_XEP : hangCua(diemChay);
  const bac = bacCua(hang);
  /* Chưa xếp thì không kim loại, không lửa, không cầu vồng — dù điểm tạm cao cỡ nào. */
  const hieuUng: BacHieuUng = xam ? 'thuong' : bacHieuUng(diemChay);
  const mau = mauTheoDiem(diemChay);
  const lap = Math.max(0, Math.min(1, diemChay / 1000));

  const [nhip, setNhip] = useState<null | { kieu: 'nhe' | 'manh' | 'tut'; lan: number }>(null);
  const truoc = useRef<string | null>(null);
  const dem = useRef(0);
  /*
   * ⚠ Điểm đọc qua REF, không qua mảng phụ thuộc — xem lý do ở effect ngay dưới.
   * Gán trong thân render là an toàn ở đây vì nó chỉ chép lại giá trị của chính
   * lượt render này; effect luôn đọc được số mới nhất mà không phải chạy lại.
   */
  const diemRef = useRef(diemChay);
  diemRef.current = diemChay;

  useEffect(() => {
    /*
     * Khoảnh khắc LÊN HẠNG. Founder: *"từ E>B thì sẽ chỉ có những bước nhảy nhẹ
     * nhưng từ A > SSS phải là hiệu ứng rung và thay thế mạnh và rõ ràng hơn"*
     * ⇒ hai cường độ, chia ở mốc A (670 điểm).
     *
     * ⚠ Bám vào `hang` SUY TỪ ĐIỂM CHẠY, nên leo nhiều bậc một lúc thì nó nổ
     * NHIỀU LẦN, mỗi bậc một lần — đúng "E>D>C>… mượt vào".
     *
     * ⚠⚠ MẢNG PHỤ THUỘC CHỈ ĐƯỢC CÓ `hang`. Bản đầu nghe cả `diemChay`, và nó
     * hỏng theo cách im lặng nhất: `diemChay` đổi 30 lần trong 900ms, mỗi lần
     * effect chạy lại thì React chạy CLEANUP của lần trước ⇒ `clearTimeout` huỷ
     * đúng cái hẹn sẽ tắt nhịp, còn nhánh mới không đặt hẹn nào (hạng chưa đổi
     * tiếp) ⇒ lớp nhịp DÍNH LẠI VĨNH VIỄN, và vì lớp không đổi nên cú lên hạng
     * sau đó không diễn lại. Hiệu ứng "vẫn có", chỉ không bao giờ chạy đúng lúc.
     *
     * D343 — `?` → hạng thật rơi vào nhánh LÊN (`?` không có trong `THU_TU`) ⇒ khoảnh
     * khắc đủ vòng tự có cú đóng dấu. Chiều ngược (hạng → `?`, chỉ khi màn tái dùng thanh
     * cho một trận khác) thì im: đó không phải cú tụt nào của người chơi.
     */
    if (hang === HANG_CHUA_XEP) { truoc.current = hang; setNhip(null); return undefined; }
    if (truoc.current !== null && truoc.current !== hang) {
      const caoHon = THU_TU.indexOf(hang) > THU_TU.indexOf(truoc.current);
      const kieu = !caoHon ? 'tut' : diemRef.current >= MOC_MANH ? 'manh' : 'nhe';
      const dai = kieu === 'manh' ? 620 : kieu === 'nhe' ? 420 : 380;
      dem.current += 1;
      setNhip({ kieu, lan: dem.current });
      truoc.current = hang;
      const t = window.setTimeout(() => setNhip(null), dai);
      return () => window.clearTimeout(t);
    }
    truoc.current = hang;
    return undefined;
  }, [hang]);

  return (
    <div
      className={[
        s.khoi, s[bac] ?? '', gon ? s.gon : '',
        xam ? s.chuaXep : '', batDen ? s.batDen : '',
        nhip?.kieu === 'nhe' ? s.lenNhe : '', nhip?.kieu === 'manh' ? s.lenManh : '',
        nhip?.kieu === 'tut' ? s.tut : '',
        s[`fx_${hieuUng}`] ?? '',
      ].filter(Boolean).join(' ')}
      data-tap="phong-cach"
      data-hang={hang}
      data-fx={hieuUng}
      /* Số thứ tự cú nhịp — để test đếm được "đã diễn mấy lần", xem `.hang`. */
      {...(nhip ? { 'data-lan': String(nhip.lan) } : {})}
      /*
       * MÀU đi bằng biến, không bằng lớp: nó là một dải LIÊN TỤC (`mauTheoDiem`),
       * mà lớp CSS thì rời rạc.
       * ⚠ Module này chỉ còn HAI lớp bậc — `.sieu` và `.toi_thuong` — và cả hai
       * chỉ đặt `border-color`: từ S thì cả khối bắt sáng, đó là một NGƯỠNG chứ
       * không phải một dải. Nên `s[bac]` trả rỗng cho `thap`/`giua`/`kha`, CÓ
       * CHỦ Ý chứ không phải thiếu sót.
       * ⚠ D343 — lúc XÁM thì KHÔNG đặt `--pc-mau` inline: biến inline thắng mọi lớp, nên đặt
       * nó là `.chuaXep` không bao giờ đổi được màu về xám.
       */
      style={{ ...(xam ? {} : { '--pc-mau': mau }), '--pc-dai': daiMauThang() } as CSSProperties}
      aria-label={xam ? 'Phong cách chơi: chưa đủ vòng để xếp hạng' : `Phong cách chơi: hạng ${hang}`}
    >
      {/*
        ⭐ HẠNG VẼ BẰNG GLYPH PIXEL (founder 23/08: *"thanh đó bây giờ vẫn đang
        dùng text đểu đó"* → *"phải là pixel hết chứ đ** phải text"*). Cùng bộ
        lưới với khối màn kết và lớp phủ toàn màn, chỉ khác `px` — xem `ChuPixel`.
        `px = 1`: chữ cao 12px — ĐÚNG cỡ chữ cũ (13px), nên thanh không cao thêm
        một pixel nào. Đã so px=1 với px=2 trên máy thật: px=2 đọc đã hơn nhưng
        khối cao gấp đôi và `SSS` (64px) đẩy cái thước ngắn lại.
      */}
      {/*
        ⚠ `key` neo vào SỐ THỨ TỰ CÚ NHỊP, không vào hạng: hai cú lên hạng CÙNG
        CƯỜNG ĐỘ liên tiếp (chuyện thường khi bò 18 bậc — phần lớn là cú NHẸ)
        giữ nguyên lớp CSS, mà lớp không đổi thì trình duyệt KHÔNG chạy lại
        animation. Đúng bẫy `.lat`/`.sang` của `GameCard`, và nó im lặng: cả
        chuỗi chỉ nhấp nháy đúng một lần rồi thôi.
        ⚠ Chỉ neo Ở ĐÂY, KHÔNG neo lên `.rang`: dựng lại cái thước là dựng lại
        `.fx` bên trong nó, tức lửa và cầu vồng bị khởi động lại mỗi bậc — trong
        lúc bò thì chúng restart liên tục và trông như đứng yên. Cái giá đã cân:
        nhịp NẢY của thanh (`.lenManh .rang`) không diễn lại giữa một chuỗi cú
        mạnh liên tiếp; nó vẫn diễn ở cú mạnh ĐẦU và ở cú cuối cùng đứng một mình.
      */}
      <span className={s.hang} key={`hang-${nhip?.lan ?? 0}`}>
        {/*
          D443 — chữ hạng đi bằng FONT APP (Handjet), mỗi ký tự một ô `--i` như cũ (cú đóng dấu / rung vẫn lệch nhịp
          từng chữ). Founder 28/09: *"phải đồng bộ font chữ đi chứ bro"*. `aria-hidden`: tên hạng cho trình đọc màn
          hình nằm ở nhãn của khối (đọc một lần, không đọc lại từng chữ).
        */}
        {[...hang].map((k, i) => (
          <span key={i} className={s.hangChu} style={{ '--i': i } as CSSProperties} aria-hidden>{k}</span>
        ))}
      </span>
      {/*
        QUẦNG — chỉ dựng từ bậc CHÁY trở lên. Nằm ngoài `.rang` vì nó nở ra
        ngoài khay; `.rang` có `overflow: hidden` nên đặt trong đó là tự cắt mất.
      */}
      {(hieuUng === 'chay' || hieuUng === 'chay_manh' || hieuUng === 'cau_vong') && (
        <span className={s.quang} aria-hidden />
      )}
      <span className={s.rang}>
        {/*
          ⚠ CẮT chứ không CO: `scaleX` kéo giãn nền, mà nền nay là cả dải bảy
          chặng — co lại thì mực 40% hiện đủ bảy màu, tức thanh khoe vàng SSS cho
          một người 400 điểm. `inset()` giữ dải neo đúng thang 0→1000.
        */}
        <span
          className={s.day}
          style={{ clipPath: `inset(0 ${((1 - lap) * 100).toFixed(2)}% 0 0)` }}
        />
        {/*
          LỚP HIỆU ỨNG nằm TRÊN mặt thanh, phủ đúng phần đã lấp (`scaleX` giống
          `.day`) — lửa/cầu vồng phải liếm theo mực thanh, không phủ cả khay
          rỗng. Chỉ dựng khi bậc cần, không để một phần tử chết nằm lại.
        */}
        {hieuUng !== 'thuong' && (
          <span className={s.fx} style={{ width: `${lap * 100}%` }} aria-hidden />
        )}
      </span>
      {/*
        D400 — DẤU CHUỖI "×N" ĐÃ GỠ. Founder 23/09: *"bỏ chỗ x2 kia đi, sau này t sẽ thay bằng lửa monument"* (lửa
        MOMENTUM — đặc tả ở docs/thiet-ke-de-xuat/gameplay/cai-tien-du-dinh.md §1.3). `pc.streak` server vẫn phát; chỗ
        này để trống cho ngọn lửa, đừng dựng lại con số.
        v55 (D409) — ngọn lửa đã vào đúng khe này (`LuaMomentum`); diễn ở bước PHONG CÁCH của nhịp kết quả (A11.26).
      */}
      {/* D422 — MÙ LỬA: lửa luôn tắt nên khe lửa vẽ chính lá MÙ LỬA (ngọn lửa bịt mắt + đồng xu) — không than tàn, để
          người chơi không đọc nhầm thành "mình vừa mất lửa". */}
      {lua && lua.muLua === true && (
        <span
          className={`${s.lua} ${s.muLua}`}
          data-tap="lua-o"
          data-mu-lua=""
          role="img"
          aria-label="MÙ LỬA — lửa luôn tắt, nhận xu đều mỗi vòng"
          title="MÙ LỬA — lửa luôn tắt, nhận xu đều mỗi vòng"
          // eslint-disable-next-line react/no-danger -- SVG sinh từ lưới hằng trong repo (trait_hinh.ts)
          dangerouslySetInnerHTML={htmlTinh(svgTrait('mu_lua', false))}
        />
      )}
      {lua && lua.muLua !== true && (
        <span className={s.lua} data-tap="lua-o">
          <LuaMomentum nac={lua.nac} dacBiet={lua.dacBiet === true} dap={lua.dap ?? null} co={16} />
        </span>
      )}
    </div>
  );
}

/** Thứ tự hạng — dùng để biết LÊN hay TỤT. Trùng thang ở `phong_cach.ts`. */
const THU_TU = [
  'E-', 'E', 'E+', 'D-', 'D', 'D+', 'C-', 'C', 'C+',
  'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S-', 'S', 'S+', 'SS', 'SSS',
];
