/**
 * BẢN ĐỒ THỊ TRƯỜNG — dòng thời gian lật cuốn chiếu.
 *
 * TELEGRAPH phải trông như XÁC SUẤT, không phải lời tiên tri: gạch đứt, thở,
 * chữ "CÓ THỂ". Không phải khẩu vị — vẽ chắc nịch sẽ đẩy người chơi dồn hết
 * vốn theo một tín hiệu, đúng sai lầm mà cơ chế TIN GIẢ sinh ra để trừng phạt,
 * và làm hỏng gate cân bằng 17.6.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ODTO, NhanDTO } from '@/api/holdem';
import { PixelIcon, PixelLuoi } from '@/components/ui/PixelIcon';
import { HO_MAU, matLa, TINH_CHAT_PHA } from '@/lib/la_bai';
import { NHAN_O_DOI, moTaODoi } from '@/lib/o_doi';
import { TC_ICON, TC_TEN } from '@/lib/tinh_chat';
import { MAU_TRAIT } from '@/lib/trait_hinh';
import { svgTrait } from './TheTrait';
import s from './MarketMap.module.css';
import mo from '@/styles/motion.module.css';
import { htmlTinh } from '@/lib/html_tinh';
import { HAT_TRO, moiTruongCua } from '@/lib/moi_truong';

/*
 * ⭐ HUY HIỆU TÍNH CHẤT Ô SỰ KIỆN (D152/K1 — founder chỉnh lần hai: *"đ** phải
 * huy hiệu HỌ lên ô sự kiện mà là huy hiệu TÍNH CHẤT của ô — ở thiết kế mới,
 * 1 thẻ với chuỗi sự kiện trước đó có thể có tính chất khác nhau"*).
 *
 * ID tính chất do SERVER tính TỪNG Ô và gửi trong `o.tinh_chat` (oCongKhai) —
 * KHÔNG tra theo loại sự kiện ở client: hôm nay tính chất trùng nền theo loại
 * tin, nhưng v35 thêm tương tác thẻ thì cùng một tin mang tính chất khác tuỳ
 * chuỗi đứng trước (ĐÚNG THUỐC · ĐỔ DẦU…) — bảng tra theo loại sẽ NÓI DỐI.
 * Ở đây chỉ tra ICON + TÊN cho ID nhận được (D26); thêm tính chất mới = thêm
 * một dòng mỗi bảng, không sửa logic.
 *
 * Icon là ẨN DỤ chứ không phải mũi tên số (founder: *"Ko nên hiện rõ như
 * thế"*): khiên = lúc trú ẩn thắng · lửa = tiền đổ vào rủi ro · đồng xu = van
 * thanh khoản · tia = đánh chọn lọc từng mã. Cả bốn lưới ĐÃ CÓ trong PixelIcon
 * — 0 nợ art (A11.14).
 * ⚠ Icon nhận-từ-xa, TÊN gọi-đúng-tên (D123): title/aria luôn mang tên tính
 * chất — icon một mình không được phép gánh nghĩa.
 * ⚠ Server tính theo MẶT CHỮ của tin (tin giả mang tính chất của tin nó giả
 * dạng) — client không có gì để rò vì cờ giả đã bị lột ở oCongKhai.
 */
// 12/09 — bảng dời sang `lib/tinh_chat.ts` (SỔ LIÊN HỆ đọc ở cả trang Tài chính);
// re-export để chỗ import cũ giữ nguyên.
export { TC_ICON, TC_TEN } from '@/lib/tinh_chat';
/* 24/09 (D393) — tên ô giai đoạn thôi là tiếng Anh (`EN_GIAI_DOAN`: UPTREND, HIGH VOLATILITY…):
   ô bản đồ nay là LÁ BÀI mới (D390) và tên lá lấy từ mặt lá (`matLa`) — một nguồn cho mọi màn. */

export interface MarketMapProps {
  daLat: ODTO[];
  hienTai: ODTO | null;
  vong: number;
  tongVong: number;
  conLai: number;
  art: Record<string, string>;
  giaiDoan: NhanDTO[];
  suKien: NhanDTO[];
  telegraph: { tu_su_kien: string; nghieng_ve: string; keo_theo: string[] } | null;
  /** D43 — vị trí KỲ HỌP lãi suất (lịch CÔNG KHAI, cả ô tương lai). */
  oLich?: number[];
  /** Chuỗi xu hướng đã xác nhận — null khi chưa thành chuỗi. */
  xuHuong?: { huong: number; dai: number } | null;
  /**
   * D442 — xu hướng dùng cho NỀN bàn thẻ. Màn trận chuyển nó ở bước MÔI TRƯỜNG của nhịp kết quả (sau lá lật + tin), còn
   * `xuHuong` (gạch chân ô đang lật) chuyển cùng lá. Vắng ⇒ dùng `xuHuong`.
   */
  xuHuongNen?: { huong: number; dai: number } | null;
  /** D442 — nhịp kết quả đang diễn: hiệu ứng nền dịu xuống và đứng yên, chỉ còn màu (không tranh tiêu điểm). */
  dangDien?: boolean;
  /** Ô hiện tại là kỳ họp: hàm phản ứng nói gì vs thực tế ra gì. */
  chinhSach?: { ky_vong: string; thuc: string } | null;
  /**
   * v53 (D373) — Ô CỦA VÒNG CÒN ÚP. Bản đồ khi ấy đọc khác hai chỗ:
   * · ô vừa lật (cuối `daLat`) mới là ô ĐƯỢC LÀM NỔI — nó là tin mới nhất người chơi có;
   * · dãy ô úp bắt đầu từ chính ô số `vong` (ô sắp lật), không phải `vong + 1`.
   * VẮNG = luật cũ, không một pixel nào đổi.
   */
  upO?: boolean;
  /*
   * v55 (D409) — trait đọc bản đồ (server suy từ trait đang mang, C4):
   * · `loaiLaKe` (NỘI GIÁN): LOẠI của các lá úp kế ('pha' | 'tin'), in lên mặt ô úp — loại, không nội dung;
   * D588 — REEL (ô vừa lật lật kiểu slot) đã BỎ (founder 11/10: "bỏ cái hiệu ứng slot machine đi"); lá lật một cú `latO`.
   * D422 — MÙ TIN / SƯƠNG MÙ thôi là cờ ở đây: server che thẳng ô (`{ kind: 'che' }` / `{ kind: 'suong', hai_mat }`) và
   * gạch thiên hướng của lá bị che, client chỉ vẽ lớp che (xem `veOChe`).
   */
  loaiLaKe?: readonly ('pha' | 'tin')[] | undefined;
  /*
   * ⚠ 08/08 — `laiSuat` + `chuKy` RỜI KHỎI ĐÂY theo lệnh founder: hai khối
   * chữ dưới map bị gạch đỏ, thay bằng CHIP LÃI SUẤT ở góc hàng Bảng điện tử
   * (AlphaDraftMatch) — bấm mới mở bảng thông tin công khai. Đừng thêm lại.
   */
}

const NHAN_CS: Record<string, string> = {
  tang: 'TĂNG LÃI SUẤT', ha: 'HẠ LÃI SUẤT', giu: 'GIỮ NGUYÊN',
};
/* 13/09 tối — nhãn NGẮN cho hai chip trên chính ô kỳ họp (hộp chữ dưới bản đồ đã gỡ). */
const NHAN_CS_NGAN: Record<string, string> = { tang: 'TĂNG', ha: 'HẠ', giu: 'GIỮ' };
const moTaCS = (cs: { ky_vong: string; thuc: string }): string =>
  `KỲ HỌP LÃI SUẤT — công thức phản ứng (xem Bách khoa) chỉ về `
  + `${NHAN_CS[cs.ky_vong] ?? cs.ky_vong}; thực tế: ${NHAN_CS[cs.thuc] ?? cs.thuc}.`
  + (cs.thuc !== cs.ky_vong
    ? ' Lệch công thức — sai lầm chính sách: khoảng 15 trên 100 kỳ họp sẽ như vậy,'
      + ' không tín hiệu nào đúng tuyệt đối.'
    : '');

/*
 * TÍNH CÁCH TỪNG THẺ SỰ KIỆN (founder 04/08, 23/08) — `o` = nhịp hào quang quanh ô,
 * `chop` = kiểu cú chớp màn, `chat` = bản chất trên mặt lá. NHỊP mã hoá thang thời gian:
 * chớp gắt = cú sốc · trôi chậm = bào mòn · nổi lên = bong bóng.
 *
 * ⭐ 24/09 (D393) — theo bộ lá mới (D390, trang demo `la-bai-phong-cach.html`):
 *   · MÀU thôi nằm ở bảng này. Màu = HỌ của lá (`HO_MAU` qua `matLa`, lib/la_bai.ts) —
 *     một nguồn cho ô, cú chớp màn và vạch dải tài sản. Bảng `MAU_O` theo lớp nhịp đã gỡ:
 *     nó cho cặp lãi suất chung một màu với mọi tin cùng nhịp, trong khi lá mới tách họ.
 *   · Bảy tin HOẢNG LOẠN là MỘT lá thiên nga ⇒ MỘT bộ bản chất — kể cả chiến tranh (trước
 *     đây cam riêng): rung lúc xuất hiện · tro bay · giật nhiễu cả hình · quét CRT, đúng
 *     bốn hiệu ứng lá thiên nga trong demo.
 *   · Ánh kim của cặp lãi suất nay chạy DỌC NÉT (vệt `data-nhip="kim"` trong art) ⇒ hai
 *     lớp loé phủ cả ô (`loeKim`, `loeDo`) gỡ. Tăng lãi giữ cú rung nhẹ lúc xuất hiện.
 *   · "Sàn khoá rút tiền" thành CẠN THANH KHOẢN — một trạng thái của chợ chứ không phải
 *     hỏng hóc ⇒ bỏ nhiễu cyan (`skLoi`/`nhieu`), sang nhịp CẠN DẦN như lạm phát.
 *
 * ⚠ Mười hai tin một dòng mỗi tin (không gộp bằng biến): bài canh đọc bảng này bằng regex
 * để đối chiếu với `SU_KIEN` — một dòng mất là một tin rơi về viền mặc định im lặng.
 */
const TINH_CACH_SU_KIEN: Record<string, { o: string; chop: string; chat?: string[] }> = {
  ha_lai_suat:   { o: 'skTot',    chop: 'chopXanh' },
  tang_lai_suat: { o: 'skXau',    chop: 'chopDo',   chat: ['rungNhe'] },
  hack_san:      { o: 'skBaoMon', chop: 'chopCam' },
  lam_phat:      { o: 'skBaoMon', chop: 'chopCam' },
  bong_bong:     { o: 'skPhong',  chop: 'chopTim' },

  /*
   * LÁ THIÊN NGA ĐEN — bảy tin `hoang_loan`, một bộ bản chất. Chúng KHÔNG được bảy hiệu
   * ứng bịa thêm: chúng LÀ một lá; loại tin là icon góc phải, không phải một nhịp riêng.
   * Mười hai hiệu ứng khác nhau thì không ai đọc ra ý nghĩa của cái nào.
   */
  thien_nga_den: { o: 'skXau', chop: 'chopDo', chat: ['rungHien', 'troBay', 'giat', 'quet'] },
  chien_tranh:   { o: 'skXau', chop: 'chopDo', chat: ['rungHien', 'troBay', 'giat', 'quet'] },
  phap_ly:       { o: 'skXau', chop: 'chopDo', chat: ['rungHien', 'troBay', 'giat', 'quet'] },
  pha_san:       { o: 'skXau', chop: 'chopDo', chat: ['rungHien', 'troBay', 'giat', 'quet'] },
  cam_van:       { o: 'skXau', chop: 'chopDo', chat: ['rungHien', 'troBay', 'giat', 'quet'] },
  tham_hoa:      { o: 'skXau', chop: 'chopDo', chat: ['rungHien', 'troBay', 'giat', 'quet'] },
  dich_benh:     { o: 'skXau', chop: 'chopDo', chat: ['rungHien', 'troBay', 'giat', 'quet'] },
};

/** v55 (D422) — màu lớp che: lá MÙ TIN mang họ ĐỎ của tật (chính lá đang che); sương là xám lam trung tính. */
const MAU_CHE = { mau: MAU_TRAIT.tat['3']!, sang: MAU_TRAIT.tat['4']! };
const MAU_SUONG = { mau: '#5d7290', sang: '#bfd1e6' };
type OChe = Extract<ODTO, { kind: 'che' | 'suong' }>;

/** Màu HỌ + màu sáng của lá nằm trên một ô — undefined nếu lá chưa có mặt mới. */
function hoCuaO(o: ODTO): { mau: string; sang: string } | undefined {
  if (o.kind === 'che') return MAU_CHE;
  if (o.kind === 'suong') return MAU_SUONG;
  const m = matLa(o.kind === 'su_kien' ? `sk_${o.su_kien}` : `gd_${o.giai_doan}`);
  return m ? HO_MAU[m.ho] : undefined;
}

/**
 * 12/09 (Q3) — MÀU của một ô SỰ KIỆN cho dải thị trường (`DaiThiTruong`): vạch dưới sáu
 * lá mang đúng màu ô vừa lật, để mắt nối "cái kéo" với "thứ bị kéo" bằng màu chứ không
 * bằng chữ. Ô giai đoạn ⇒ undefined (vạch về màu trung tính).
 * 24/09 (D393) — màu = HỌ của lá (`HO_MAU`), cùng nguồn với chính ô trên bản đồ.
 */
export function mauCuaO(o: ODTO): string | undefined {
  if (o.kind !== 'su_kien') return undefined;
  return hoCuaO(o)?.mau;
}

/**
 * D442 — màu HỌ LÁ cho nền môi trường, bơm inline từ `HO_MAU` (một nguồn với mặt lá — đổi màu họ là nền đổi theo).
 * Hằng module ⇒ cùng một đối tượng mọi lần vẽ, React không phải so lại.
 */
const BIEN_MOI_TRUONG = {
  '--ho-len': HO_MAU.len.mau, '--ho-xuong': HO_MAU.xuong.mau, '--ho-ngang': HO_MAU.ngang.mau, '--ho-dong': HO_MAU.dong.mau,
} as CSSProperties;

export function MarketMap({
  daLat, hienTai, vong, tongVong, conLai, art, giaiDoan, suKien, telegraph,
  oLich, xuHuong, xuHuongNen, dangDien = false, chinhSach, upO = false, loaiLaKe,
}: MarketMapProps) {
  /*
   * D442 lượt 2 (founder: *"chỉ shake khi có thay đổi"*) — nền đổi trạng thái thì mặt bàn RUNG một cú ngắn; mở màn,
   * vẽ lại hay trạng thái giữ nguyên thì không. Đổi luân phiên 'a' ↔ 'b' ⇒ tên keyframe đổi ⇒ hoạt ảnh chạy lại mà không
   * phải dựng lại cây (dựng lại là lá trên bàn chạy lại hoạt ảnh lật của chúng).
   */
  const moiTruong = moiTruongCua(xuHuongNen !== undefined ? xuHuongNen : xuHuong);
  const mtTruoc = useRef(moiTruong);
  const [rung, setRung] = useState<'a' | 'b' | null>(null);
  useEffect(() => {
    if (mtTruoc.current === moiTruong) return;
    mtTruoc.current = moiTruong;
    setRung((r) => (r === 'a' ? 'b' : 'a'));
  }, [moiTruong]);
  const nhanGD = (id: string) => giaiDoan.find((x) => x.id === id)?.label ?? id;
  const nhanSK = (id: string) => suKien.find((x) => x.id === id)?.label ?? id;


  /*
   * v55 (D422) — LỚP CHE của riêng người mang trait (server che, client chỉ vẽ — C4):
   * · MÙ TIN (founder 26/09: *"Thẻ tin lật nhưng bị che mất, icon 1 con mắt gạch chéo… Và chỉ hiện mã tăng/giảm"*): hình
   *   là chính lá MÙ TIN (tờ tin + mắt gạch chéo), không tên tin, không tính chất, không cú chớp màn (màu chớp là màu
   *   của tin ⇒ lộ tin). Mã nào tăng/giảm vẫn hiện ở bảng điện tử và chuỗi VÌ SAO (tên tin trong chuỗi đã bị thay).
   * · SƯƠNG MÙ: lá PHA mới lật hiện HAI mặt cạnh nhau (một thật một mồi, thứ tự do server xáo), phủ sương; vòng sau tan.
   */
  const veOChe = (o: OChe, so: number, trangThai: 'qua' | 'nay', vuaLat = false) => {
    const laChe = o.kind === 'che';
    const hai = o.kind === 'suong' ? o.hai_mat : [];
    const tenPha = (id: string) => matLa(`gd_${id}`)?.ten ?? nhanGD(id);
    const ho = laChe ? MAU_CHE : MAU_SUONG;
    return (
      <div
        key={`${trangThai}-${so}`}
        className={[s.khung, trangThai === 'nay' ? mo.latO : '', trangThai === 'nay' ? s.quangNay : ''].filter(Boolean).join(' ')}
        style={{ '--o-mau': ho.mau, '--o-sang': ho.sang } as CSSProperties}
      >
        <div
          {...(trangThai === 'nay' ? { 'data-o-dang-lat': '' } : {})}
          {...(laChe ? { 'data-o-che': '' } : { 'data-o-suong': hai.join(' ') })}
          className={[s.o, s[trangThai], laChe ? s.oChe : s.oSuong].filter(Boolean).join(' ')}
          title={laChe
            ? 'MÙ TIN — lá tin này bị che với riêng bạn: chỉ thấy mã nào tăng, mã nào giảm.'
            : `SƯƠNG MÙ — lá pha này là ${hai.map(tenPha).join(' hoặc ')}. Sương tan ở vòng sau.`}
        >
          <div className={s.tren}>
            <span className={s.so}>{oLich?.includes(so) ? `⚖ ${so}` : so}</span>
            <span className={s.ma}><i className={s.dauMa} aria-hidden /><b className={s.maChu}>?</b></span>
          </div>
          {laChe ? (
            // eslint-disable-next-line react/no-danger -- SVG sinh từ lưới hằng trong repo (trait_hinh.ts)
            <div className={s.art} dangerouslySetInnerHTML={htmlTinh(svgTrait('mu_tin', false))} />
          ) : (
            <div className={`${s.art} ${s.haiMat}`}>
              {hai.map((id, i) => (
                // eslint-disable-next-line react/no-danger -- SVG hằng số trong repo, xem GameCard
                <span key={i} dangerouslySetInnerHTML={htmlTinh(art[`gd_${id}`] ?? '')} />
              ))}
            </div>
          )}
          <div className={s.ten}>{laChe ? 'TIN BỊ CHE' : hai.map(tenPha).join(' / ')}</div>
          <div className={s.chan}>
            {vuaLat ? 'VỪA LẬT ✓' : trangThai === 'qua' ? 'ĐÃ QUA ✓' : 'HIỆN TẠI ↗'}
          </div>
        </div>
      </div>
    );
  };

  const veO = (o: ODTO, so: number, trangThai: 'qua' | 'nay', vuaLat = false) => {
    if (o.kind === 'che' || o.kind === 'suong') return veOChe(o, so, trangThai, vuaLat);
    const laSK = o.kind === 'su_kien';
    const gd = laSK ? '' : o.giai_doan;
    const khoa = laSK ? `sk_${o.su_kien}` : `gd_${gd}`;
    const svg = art[khoa] ?? '';
    /* 24/09 (D393) — MẶT LÁ (lib/la_bai.ts): tên + họ màu + mã góc phải. Bảy tin hoảng
       loạn trả CÙNG mặt thiên nga, kèm `loai` = icon loại tin (founder: "chú ý logic
       phần hiển thị của thẻ thiên nga đen"). Lá chưa có mặt ⇒ tên catalog, màu trung tính. */
    const mat = matLa(khoa);
    const tcPha = o.kind === 'giai_doan' && o.tinh_chat ? TINH_CHAT_PHA[o.tinh_chat] : undefined;   // D560
    const ho = hoCuaO(o);
    /* Ô NÀY là kỳ họp đang ngửa ⇒ nó mang luôn cặp kỳ vọng/thực. Trước 13/09 cặp ấy
       nằm trong một hộp chữ riêng dưới bản đồ — founder gạch. */
    const cs = chinhSach && oLich?.includes(so) === true ? chinhSach : null;
    return (
      <div
        // key gắn số vòng: đổi vòng là React thay node, nên hoạt hình lật CHẠY
        // LẠI. Giữ nguyên node thì CSS animation chỉ chạy đúng một lần cả trận.
        key={`${trangThai}-${so}`}
        className={[
          s.khung,
          // Cú LẬT sống ở KHUNG, không ở ô — xem khối `.khung` trong CSS. Ô sự
          // kiện lật chậm và nảy mạnh hơn: tin tức phải nặng hơn một giai đoạn
          // thường, nếu không thì "bom tấn" và "đi ngang" trông y hệt nhau.
          trangThai === 'nay' ? (laSK ? mo.latSuKien : mo.latO) : '',
          trangThai === 'nay' ? s.quangNay : '',
        ].filter(Boolean).join(' ')}
        /* Màu HỌ chảy vào CẢ ô, cho cả ô đã qua. Đặt ở KHUNG (không ở `.o`): ô nay khắc
           góc bằng `clip-path`, nên quầng sáng + sóng xung kích phải sống ở tầng ngoài
           — và chúng cũng đọc màu này. */
        {...(ho
          ? { style: { '--o-mau': ho.mau, '--o-sang': ho.sang } as CSSProperties }
          : {})}
      >
      {/* Sóng xung kích ở KHUNG: nằm trong `.o` thì `clip-path` khắc góc cắt mất nó. */}
      {trangThai === 'nay' && laSK && (
        <span className={`${s.song} ${mo.songXungKich}`} aria-hidden />
      )}
      <div
        {...(trangThai === 'nay' ? { 'data-o-dang-lat': '' } : {})}
        className={[
          s.o, s[trangThai],
          // Tính cách chỉ áp cho ô ĐANG lật — thẻ đã qua để yên, nếu không thì
          // cả dải nhấp nháy bảy màu và không ai đọc được gì.
          trangThai === 'nay' && laSK
            ? (s[TINH_CACH_SU_KIEN[o.su_kien ?? '']?.o ?? ''] ?? '') : '',
          /*
           * BẢN CHẤT THẺ (founder 23/08) — rung lúc xuất hiện, rồi tro bay / loé
           * kim loại / lấp loé đỏ / nhiễu tuỳ loại. Cũng CHỈ ô đang lật: thẻ đã
           * qua nay xám hẳn, và một thẻ xám mà vẫn rung là nói dối về việc nó
           * còn quan trọng.
           */
          ...(trangThai === 'nay' && laSK
            ? (TINH_CACH_SU_KIEN[o.su_kien ?? '']?.chat ?? []).map((c) => s[c] ?? '')
            : []),
        ].filter(Boolean).join(' ')}
        /* D302 — ô ĐÃ LẬT từng bị đám đông đổi: một câu trọn ở tooltip, chữ
           ngắn ở chân ô (bên dưới). Server chỉ gửi `doi` cho ô đã lật (03 §3). */
        {...(o.doi ? { title: moTaODoi(o.doi, giaiDoan, suKien), 'data-doi': o.doi.boi } : {})}
        {...(cs
          ? {
            'data-chinh-sach': cs.thuc === cs.ky_vong ? 'khop' : 'lech',
            ...(o.doi ? {} : { title: moTaCS(cs) }),
          }
          : {})}
      >
        {/* HÀNG ĐẦU LÁ (D393, khuôn `.tren` của demo): số vòng trái · mã lá phải. */}
        <div className={s.tren}>
          {/* ⚖ = kỳ họp lãi suất — lịch công khai, đánh dấu cả khi đã lật. */}
          <span className={s.so}>{oLich?.includes(so) ? `⚖ ${so}` : so}</span>
          <span className={s.ma}>
            {/* HUY HIỆU TÍNH CHẤT (D152/K1). Đọc TỪ Ô (`o.tinh_chat`, server tính theo
                ngữ cảnh), KHÔNG tra catalog theo loại tin. Hiện ở CẢ ô đã qua (tính chất
                là thứ để HỌC; ô xám thì huy hiệu xám theo). Ô ÚP tuyệt đối không (A3.1). */}
            {laSK && (() => {
              const tc = o.kind === 'su_kien' ? o.tinh_chat : undefined;
              const icon = tc !== undefined ? TC_ICON[tc] : undefined;
              if (tc === undefined || icon === undefined) return null;
              return (
                <span
                  className={s.hoEm}
                  role="img"
                  aria-label={`Tính chất ${TC_TEN[tc] ?? tc}`}
                  title={`Tính chất ${TC_TEN[tc] ?? tc}`}
                  data-tinh-chat={tc}
                >
                  <PixelIcon name={icon} size={16} />
                </span>
              );
            })()}
            {/* LÁ THIÊN NGA: loại tin là ICON góc phải (D390) — tên loại ở aria + tooltip,
                icon một mình không gánh nghĩa (D123). Lá khác: mã lá (▲ %↓ ◎ …). */}
            {(mat?.loai || mat?.ma || tcPha) && <i className={s.dauMa} aria-hidden />}
            {/* D560 — LÁ PHA có tính chất (bò / gấu / đi ngang): icon góc phải thay mã lá, y khuôn lá thiên nga. */}
            {tcPha ? (
              <span
                className={s.loai}
                role="img"
                aria-label={`Tính chất ${tcPha.ten.toLowerCase()}`}
                title={tcPha.ten}
                data-tinh-chat-pha={o.kind === 'giai_doan' ? o.tinh_chat : undefined}
              >
                <PixelLuoi luoi={tcPha.icon} ten={`tc_${o.kind === 'giai_doan' ? o.tinh_chat : ''}`} size={16} />
              </span>
            ) : mat?.loai ? (
              <span
                className={s.loai}
                role="img"
                aria-label={`Thiên nga đen — ${mat.loai.ten.toLowerCase()}`}
                title={mat.loai.ten}
                data-loai={mat.loai.id}
              >
                <PixelLuoi luoi={mat.loai.icon} ten={mat.loai.id} size={16} />
              </span>
            ) : mat?.ma ? <b className={s.maChu}>{mat.ma}</b> : null}
          </span>
        </div>
        {/* eslint-disable-next-line react/no-danger -- SVG hằng số trong repo, xem GameCard */}
        <div className={s.art} dangerouslySetInnerHTML={htmlTinh(svg)} />
        {/* ⚠ BẢNG TÊN đứng SAU art (24/08). Đứng trước thì nó ăn một hàng ngang
            qua đỉnh thẻ và đẩy tranh tụt xuống — đúng thứ vừa gỡ. Đây là bố cục
            CỘT nên thứ tự trong JSX LÀ thứ tự trên màn. */}
        <div className={s.ten}>{mat?.ten ?? (laSK ? nhanSK(o.su_kien) : nhanGD(gd))}</div>
        <div className={s.chan}>
          {/* v53 — ô vừa lật nói VỪA LẬT: nó không còn là "hiện tại" theo nghĩa đang-được-cược,
              nó là tin vừa nổ. Ô đang được cược là ô ÚP đầu dãy, dán nhãn SẮP LẬT. */}
          {vuaLat ? 'VỪA LẬT ✓'
            : trangThai === 'qua' ? (o.doi ? NHAN_O_DOI : 'ĐÃ QUA ✓') : 'HIỆN TẠI ↗'}
        </div>
        {cs && (
          <div className={s.cs} aria-label={moTaCS(cs)}>
            <span className={s.csKy}>{NHAN_CS_NGAN[cs.ky_vong] ?? cs.ky_vong}</span>
            <span aria-hidden>▸</span>
            <span className={s.csThuc}>{NHAN_CS_NGAN[cs.thuc] ?? cs.thuc}</span>
          </div>
        )}
      </div>
      </div>
    );
  };

  /*
   * v53 (D373) — `conLai` (server) ĐÃ đếm cả ô của vòng, vì ở v53 nó cũng còn úp. Nên chỗ
   * này thôi trừ 1: trừ nữa là bản đồ vẽ thiếu đúng cái ô người chơi đang cược vào.
   */
  const soUp = Math.max(0, Math.min(3, upO ? conLai : conLai - 1));
  const conAn = Math.max(0, (upO ? conLai : conLai - 1) - soUp);
  /** v53 — ô VỪA LẬT (cuối dãy đã lật) là ô được làm nổi thay cho `hienTai`. */
  /*
   * ⭐ D380 — LÁ MỞ MÀN KHÔNG BAO GIỜ LÀ "LÁ VỪA LẬT".
   *
   * Founder 22/09: *"bị lỗi thẻ đầu tiên lật 2 lần"*. Từ D379, ô vòng 1 luôn NGỬA (bối
   * cảnh mở màn) nên dãy ô-đã-lật là 1, 1, 2, 3… — **bước 0 ở nhịp vòng 1→2**. Lá 1 hiện
   * ở vòng 1, rồi sang vòng 2 lại bị đánh dấu VỪA LẬT và diễn lại hoạt ảnh lật.
   *
   * ⚠ Bài canh D379 CỦA CHÍNH TÔI đã duyệt cho lỗi này: nó khẳng định dãy `[1, 1, 2, 3…]`
   * là hợp lệ và chỉ cấm bước > 1. Cấm nhảy hai lá mà quên cấm lật lại một lá — nên vế
   * kia được vá còn vế này lọt. Bài mới ở `ban_do_up_o` khoá đúng vế này.
   *
   * `daLat.length > 1`: ở vòng 2 mới có đúng MỘT lá đã lật (lá mở màn) ⇒ không có lá nào
   * vừa lật cả. Từ vòng 3 trở đi, lá cuối dãy đúng là lá vừa lật thật.
   */
  const iVuaLat = upO && daLat.length > 1 ? daLat.length - 1 : -1;

  /*
   * CÚ CHỚP MÀN HÌNH — founder: *"thẻ hạ lãi suất thì toả xanh màn hình 1 cái"*.
   * Chớp ở tầng MÀN chứ không ở tầng thẻ, vì đây là "cả thị trường vừa nghe một
   * tin", không phải "một ô vừa sáng lên".
   *
   * `key` gắn số vòng ⇒ mỗi vòng React thay node mới ⇒ hoạt ảnh chạy LẠI. Giữ
   * nguyên node thì nó chỉ chớp đúng một lần cả trận (cùng lý do đã ghi cho ô).
   */
  /*
   * v53 — CÚ CHỚP ĐI THEO Ô VỪA LẬT. Ở luật cũ ô của vòng ngửa ngay đầu vòng nên chớp lúc
   * vào vòng là đúng lúc; ở v53 tin chỉ nổ lúc CHỐT, và ô vừa lật là thứ vừa nổ.
   */
  const oNoi = upO ? daLat[daLat.length - 1] : hienTai;
  const tcHienTai = oNoi?.kind === 'su_kien'
    ? TINH_CACH_SU_KIEN[oNoi.su_kien ?? ''] : undefined;
  const chopCua = tcHienTai?.chop;
  /* Cú chớp lấy màu từ CHÍNH nguồn của ô — trước bản này sáu hex nằm hai bảng
     song song (`.sk*` và `.chop*`), nên đổi màu một tin là hai chỗ lệch nhau.
     24/09 (D393): nguồn ấy nay là HỌ của lá (`hoCuaO`), cùng màu ô đang nổ. */
  const chopMau = oNoi ? hoCuaO(oNoi)?.mau : undefined;

  return (
    <>
      {chopCua !== undefined && (
        <div
          key={`chop-${vong}`}
          className={`${s.chopMan} ${s[chopCua] ?? ''}`}
          {...(chopMau ? { style: { '--o-mau': chopMau } as CSSProperties } : {})}
          aria-hidden
        />
      )}
      {/*
        13/09 — HÀNG 12 CHẤM VÀ HAI HỘP CHỮ DƯỚI BẢN ĐỒ ĐÃ BỎ (founder: "thừa thãi").
        Số ô đã đi thì ô đã lật và số trên ô đã kể; "đang ở ô mấy / 12" có ở đầu
        màn. Thứ còn giá trị là CHIỀU: chuỗi đang chạy vẽ thành gạch màu ở chân Ô
        ĐANG LẬT (data-xu-huong ở khung này), thiên hướng tin trước vẽ ở chân Ô KẾ
        (data-nghieng). Màu là mô tả, không phải lời khuyên (A10).
      */}
      {/*
        ⭐ D442 — NỀN BÀN THẺ ĐỔI THEO XU HƯỚNG (founder 27/09 tối: tester khó nhận ra chu kỳ đang ở đâu). Ba trạng
        thái từ `xu_huong` công khai (`lib/moi_truong.ts`): ĐI NGANG xám kim loại tĩnh · ĐI LÊN họ lá HẠ LÃI + vệt lóe +
        quầng thở 15–20 % · ĐI XUỐNG họ lá GIẢM + ánh lửa ở chân/góc + tro siêu nhỏ bay chậm. Các lớp nằm NGOÀI khung
        cuộn của dải ô (không trôi theo ô), sau lưng lá (lá có lót đục), không nhận chạm, trình đọc màn hình bỏ qua.
      */}
      <div
        className={s.mapNen}
        data-moi-truong={moiTruong}
        {...(rung ? { 'data-rung': rung } : {})}
        {...(dangDien ? { 'data-dien': '' } : {})}
        style={BIEN_MOI_TRUONG}
      >
        <div className={s.nen} data-lop="nen" aria-hidden>
          <i className={s.nenNgang} />
          <i className={s.nenLen} />
          <i className={s.nenXuong} />
          <div className={s.nhomLen}><i className={s.thoLen} /><i className={s.vetLoe} /></div>
          <div className={s.nhomXuong}>
            <i className={s.thoXuong} />
            <i className={s.lua} />
            <span className={s.tro} data-lop="tro">
              {HAT_TRO.map((h, k) => (
                <i key={k} style={{ '--x': `${h.x}%`, '--tre': h.tre, '--co': `${h.co}px` } as CSSProperties} />
              ))}
            </span>
          </div>
        </div>
        <div className={s.nhomQuang} data-lop="quang" aria-hidden><i className={s.quang} /></div>
        <div
          className={s.map}
          aria-label={`Bản đồ ${tongVong} ô`}
          data-xu-huong={xuHuong ? (xuHuong.huong > 0 ? 'len' : 'xuong') : undefined}
        >
          {daLat.map((o, i) => (i === iVuaLat
            ? veO(o, i + 1, 'nay', true)
            : veO(o, i + 1, 'qua')))}
          {hienTai && veO(hienTai, vong, 'nay')}
          {Array.from({ length: soUp }, (_, i) => {
            /*
             * D43 — ô ÚP nhưng là KỲ HỌP thì phải NÓI TRƯỚC: lịch họp lãi suất
             * là luật công khai (như FED công bố lịch cả năm), thứ bị giấu chỉ
             * là HƯỚNG. "Còn 2 ô nữa là kỳ họp" chính là phép đếm bài hợp lệ.
             */
            // v53 — ô úp đầu dãy CHÍNH LÀ ô của vòng (`vong`); luật cũ thì nó là `vong + 1`.
            /* D382 — có lá MỞ MÀN nên ở vòng N đã lật N lá (o[0..N-1]); lá úp đầu tiên là
               số N+1, không phải N. Đếm từ chính dãy đã lật để không gõ tay một công thức thứ hai. */
            const soO = upO ? daLat.length + i + 1 : vong + i + 1;
            const laKyHop = oLich?.includes(soO) === true;
            return (
              <div key={`up-${i}`} className={s.khung}>
                {/* 13/09 — ô KẾ mang thiên hướng của tin trước (thay hộp chữ đã bỏ): CSS vẽ
                    một gạch màu ở chân ô, chỉ ô ngay sau, không chữ, không hứa (A10). */}
                <div
                  className={`${s.o} ${s.up}`}
                  {...(i === 0 && telegraph ? { 'data-nghieng': telegraph.nghieng_ve } : {})}
                >
                  <div className={s.tren}><span className={s.so}>{soO}</span></div>
                  <div className={s.ten} />
                  {/* v55 (D409) — NỘI GIÁN: in LOẠI của lá kế (PHA/TIN) lên mặt ô úp — chỉ loại, không nội dung, không hướng. */}
                  {(() => {
                    const loai = laKyHop ? undefined : loaiLaKe?.[i];
                    return (
                      <div className={`${s.upArt} ${loai ? s.upLoai : ''}`} {...(loai ? { 'data-loai-ke': loai } : {})}>
                        {laKyHop ? '⚖' : loai === 'tin' ? 'TIN' : loai === 'pha' ? 'PHA' : '?'}
                      </div>
                    );
                  })()}
                  <div className={s.chan}>
                    {laKyHop ? 'KỲ HỌP' : (upO && i === 0 ? 'SẮP LẬT' : 'ÚP')}
                  </div>
                </div>
              </div>
            );
          })}
          {conAn > 0 && (
            <div className={s.khung}>
              <div className={`${s.o} ${s.up}`}>
                <div className={s.tren}><span className={s.so}>…</span></div>
                <div className={s.ten} />
                <div className={s.upArt}>?</div>
                <div className={s.chan}>CÒN {conAn}</div>
              </div>
            </div>
          )}
        </div>
      </div>

    </>
  );
}
