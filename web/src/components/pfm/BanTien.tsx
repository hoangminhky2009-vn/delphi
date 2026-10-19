/**
 * PFM — BÀN TIỀN. **Cổng vào duy nhất của mọi khoản ghi tay** (§B3-bis, demo chốt 04/09).
 *
 * ⚠⚠ CHÉP TỪ DEMO ĐÃ CHỐT (A11.25). Mọi con số ở đây — chín mệnh giá và ba biến màu của
 * chúng, lưới 3×3, bàn phím 4×3, 4 giây hoàn tác — là bản founder đã bấm thử và duyệt.
 * Thấy chỗ nào nên khác thì sửa Ở DEMO rồi chốt lại, đừng sửa ở đây.
 *
 * ⚠⚠ NGỮ PHÁP: **CẦM TIỀN RỒI CHẠM ĐÍCH.** Đúng khuôn "cầm rồi chạm" đã duyệt cho bàn
 * cược (D92), chỉ đổi chip cỡ-vốn thành tờ tiền. KHÔNG kéo thả — D92 đã bác.
 *
 * ⭐⭐⭐ D410 (founder 26/09) — **HAI ĐÍCH, CỐ ĐỊNH: − CHI · + THU.** Bản 04/09 cho lưới đích (sáu nhãn · ⋯ · THU · hai
 * hũ) MỌC RA khi tay có tiền, cộng bong bóng Oracle "món lớn" chen giữa — đo trên demo 26/09: chạm 20k + 200k là mặt
 * bàn phình lên che gần hết màn (trông như sang một màn khác), và khi đang cuộn ở đáy trang thì lưới tiền trượt xuống
 * 32px giữa hai cú chạm. Founder: *"phá vỡ nguyên tắc cố định và nhanh tiện phần chọn tiền … vừa bấm vào thì nhảy mẹ
 * màn hình khác đẩy phần chọn tiền đi. Quy tắc là tiện lợi và nhanh gọn tối đa cho phần ghi chép."*
 *   ⇒ LUẬT: **chiều cao mặt bàn KHÔNG ĐỔI giữa khay rỗng và khay có tiền** — không khối nào mọc ra, không khối nào
 *      biến mất. Hai nút CHI/THU luôn nằm đó (tắt khi khay rỗng); dòng Oracle quy đổi là một CHỖ GIỮ SẴN, có chữ hay
 *      không thì vẫn cao đúng bấy nhiêu. Bài canh: `pfm_ban_tien.test.tsx` §II.
 *   ⇒ Nhãn và hũ KHÔNG hỏi lúc ghi nữa: tối về phân bổ ở màn HŨ (`pfm/phan_bo.ts`).
 *
 * ⚠ CHÍN TỜ CÁCH ĐỀU, KHÔNG TỜ NÀO TO/SÁNG HƠN. Cỡ khoản chi là một trục dữ liệu đang
 * đo; làm nổi một mệnh giá là bẻ trục ấy bằng ma sát (luật bốn-chip-bằng-nhau, D92 §5).
 *
 * ⭐⭐⭐ MỘT ĐƯỜNG GHI, BA CÚ (ghi mới · sửa · xoá) — `useDuongGhi()`. D284 đã trả giá cho
 * câu này: *"một màn có hai đường ghi là hai đường phải giữ đồng bộ mãi mãi"*, và đường
 * ít dùng hơn sẽ lặng lẽ trôi. Nên nút XOÁ ở danh sách sổ **không** tự gọi kho: nó gọi
 * đúng cái hook mà cú chạm-đích gọi, và cùng cái toast hoàn tác hiện ra.
 */
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { ghiDo } from '@/lib/telemetry';
import { useGhiKho, useHu, useMauLap, useSoTatCa } from '@/pfm/dung_kho';
import { laMauThu, type MauLap } from '@/pfm/so';
import { quyDoiMon } from '@/pfm/quy_doi';
import { CHU_GIUP, CHU_PHAN_BO as CP } from '@/lib/pfm_chu';
import {
  khoanRaBanGhi, suaKhoan, taoKhoan, type Khoan, type MaNhanKhoan,
} from '@/pfm/so';
import { bayGio, homNay, sinhId } from '@/pfm/thoi_gian';
import { CHU_BENTO as CB, CHU_MAN_SO } from '@/lib/pfm_chu';
import { NHIP } from '@/lib/nhip';
import { useDangThaoTac } from '@/lib/thao_tac';
import s from './BanTien.module.css';

/* ═══ hằng của demo ═════════════════════════════════════════════════════════ */

export interface ToTien {
  gt: number;
  /** Màu của bậc — vạch đáy, và nền chip lúc cầm. */
  m: string;
  /** Nền lúc BẤM: cùng hue với vạch nhưng đậm + tối hơn. */
  bam: string;
  /** Bước sọc — KÊNH THỨ HAI của bậc, đọc được mà không dựa vào màu. */
  soc: string;
}

/**
 * ⚠⚠ LƯỚI 3×3, MỖI HÀNG MỘT BẬC (nghìn lẻ · chục nghìn · trăm nghìn). Không phải thẩm
 * mỹ: vị trí một tờ nhớ được bằng CƠ BẮP, không phải đọc lại mỗi lần. Đổi sang 5×2 là
 * mất đúng cái đó.
 * ⚠ Bão hoà hạ đều 12% cho cả chín tờ: dịu mắt mà không tờ nào nổi hơn tờ nào.
 */
export const TO_TIEN: readonly ToTien[] = [
  { gt: 1_000, m: '#b9d5da', bam: '#1e7280', soc: '6px' },
  { gt: 2_000, m: '#7eb1b9', bam: '#1e7280', soc: '6px' },
  { gt: 5_000, m: '#528f98', bam: '#1e7280', soc: '6px' },
  { gt: 10_000, m: '#cbc3df', bam: '#734fd6', soc: '4px' },
  { gt: 20_000, m: '#a89cc9', bam: '#734fd6', soc: '4px' },
  { gt: 50_000, m: '#9a74b4', bam: '#734fd6', soc: '4px' },
  { gt: 100_000, m: '#e58e62', bam: '#965a23', soc: '3px' },
  { gt: 200_000, m: '#e2a64c', bam: '#965a23', soc: '3px' },
  { gt: 500_000, m: '#dbbc24', bam: '#965a23', soc: '3px' },
];

/** Hoàn tác mở trong 4 giây — lưới đỡ, KHÔNG phải cửa duy nhất (sửa/xoá ở danh sách). */
export const HOAN_TAC_MS = 4_000;

/**
 * ⚠ SÁU BƯỚC RỜI cho một cú trượt khay TỰ LÁI, đo bằng `setTimeout`.
 *
 * Không dùng `scroll-behavior:smooth`: demo đo ra nó **im lặng không chạy** ở khung này
 * (sự kiện bấm *có* bắn, `'auto'` đi đúng 134px, `'smooth'` để lại 0). Chuyển động ở đây
 * là CHỨC NĂNG chứ không phải trang trí, nên không nhờ trình duyệt chạy hộ — và sáu bước
 * rời cũng đúng vế `steps()` cho vật máy của ranh D182.
 * ⏳ CÒN NỢ: hai con số này thuộc về `lib/nhip.ts` ("cấm gõ `setTimeout(…, 620)` trong
 *   module mới"), nhưng tệp ấy ngoài phạm vi lượt này — chuyển sang đó ở lượt gom nhịp.
 */
export const TRUOT_BUOC = 6;
export const TRUOT_MS = 40;
/** Một cú bấm `+N` đi 80% bề ngang khay — vẫn thấy mép mình vừa rời, không mất mạch. */
export const TRUOT_PHAN = 0.8;
/** Ngưỡng tay: dưới ngần này px vẫn là một cú BẤM, trên là một cú KÉO. */
export const KEO_NGUONG = 3;
/** Bề rộng dải mờ ở đầu nào còn tờ khuất. */
export const MEP_MO = '20px';

export function nhanTo(gt: number): string {
  return gt >= 1_000 ? `${gt / 1_000}k` : String(gt);
}

const dinhDang = (n: number): string => n.toLocaleString('vi-VN');

/** Người dùng đã tắt chuyển động ở hệ điều hành chưa. */
export function itChuyenDong(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Rung phản hồi. ⚠ Tôn trọng reduced-motion — rung cũng là chuyển động. */
function rung(ms: number, itMotion: boolean): void {
  if (itMotion) return;
  try { navigator.vibrate?.(ms); } catch { /* trình duyệt không cho — bỏ qua */ }
}

/* ═══ khay tràn: đếm tờ đang khuất ══════════════════════════════════════════ */

export interface DoCuon { scrollLeft: number; clientWidth: number; scrollWidth: number }
/** Một chip, đo trong HỆ TOẠ ĐỘ NỘI DUNG của khay (nên so thẳng được với `scrollLeft`). */
export interface DoChip { trai: number; rong: number }
export interface KhuatKhay { tran: boolean; trai: number; phai: number }

/**
 * ⭐⭐ ĐẾM TỜ ĐANG KHUẤT — HÀM THUẦN, và nó thuần vì một lý do đo được, không vì gọn.
 *
 * Cả khối này là thứ **đứng im khi khung ẩn** nếu móc vào nhịp vẽ (§9 của
 * `03-pfm-ban-tien.md`: `requestAnimationFrame` không gọi · sự kiện `scroll` không bắn ·
 * `behavior:'smooth'` đứng yên tại chỗ — cả ba hỏng theo kiểu tệ nhất, không lỗi không
 * cảnh báo). Nên phép đếm phải gọi được **thẳng ở chỗ vừa đổi `scrollLeft`**; tách nó ra
 * khỏi DOM là điều kiện để làm được thế, và tiện thể nó kiểm được không cần trình duyệt.
 *
 * ⚠⚠ ĐẾM THEO HƯỚNG CÁI NÚT HỨA SẼ ĐI — hai vế `trai`/`phai` tách hẳn nhau. Bản demo đầu
 * đếm cả hai phía nên tới mép phải vẫn báo "+4" (mấy tờ đã lùi ra SAU lưng) mà bấm không
 * đi đâu được: **đúng về số học, sai về lời hứa**.
 */
export function demKhuat(cuon: DoCuon, chip: readonly DoChip[]): KhuatKhay {
  const tran = cuon.scrollWidth > cuon.clientWidth + 1;
  if (!tran) return { tran: false, trai: 0, phai: 0 };
  const mepTrai = cuon.scrollLeft;
  const mepPhai = cuon.scrollLeft + cuon.clientWidth;
  let trai = 0;
  let phai = 0;
  for (const c of chip) {
    if (c.trai + c.rong < mepTrai + 1) trai += 1;
    else if (c.trai > mepPhai - 1) phai += 1;
  }
  return { tran, trai, phai };
}

/**
 * Đọc số đo thật từ DOM.
 * ⚠ Đọc `scrollWidth` ÉP REFLOW ĐỒNG BỘ — đúng thứ cần ở đây (và rẻ ở cỡ này). Đó là cả
 * lý do khối này không đi qua `requestAnimationFrame`.
 */
function doKhay(el: HTMLElement): KhuatKhay {
  const chip = [...el.querySelectorAll<HTMLElement>('[data-gt]')]
    .map((c) => ({ trai: c.offsetLeft, rong: c.offsetWidth }));
  return demKhuat(
    { scrollLeft: el.scrollLeft, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth },
    chip,
  );
}

/* ═══ ĐƯỜNG GHI — một cửa cho ghi mới · sửa · xoá ═══════════════════════════ */

export type CachGhiUi = 'to' | 'go' | 'lap';

export interface CuLui {
  kieu: 'ghi' | 'sua' | 'xoa';
  so: number;
  /**
   * Phép NGHỊCH của chính cú vừa rồi. Mỗi cú tự mang cách lùi của nó, nên toast không
   * phải đoán bằng một chuỗi `if` — thêm một cú thứ tư sau này cũng không đụng vào đây.
   */
  lui: () => Promise<void>;
}

export interface DuongGhi {
  /** Cú vừa xong, còn trong cửa sổ hoàn tác. `null` = không có gì để lùi. */
  lui: CuLui | null;
  /** Dòng đang được sửa — màn SỔ ẩn nó khỏi danh sách và trừ khỏi tổng trong lúc ấy. */
  dangSua: Khoan | null;
  ghi: (
    soTien: number, nhan: MaNhanKhoan | null, huId: string | null,
    thu: boolean, cach: CachGhiUi, ghiChu?: string,
  ) => Promise<void>;
  xoa: (k: Khoan) => Promise<void>;
  batDauSua: (k: Khoan) => void;
  huySua: () => void;
  hoanTac: () => Promise<void>;
}

/**
 * ⭐⭐⭐ MỘT ĐƯỜNG GHI CHO CẢ BA CÚ.
 *
 * ⚠⚠ SỬA = GHI ĐÈ CÙNG `id`, không phải "xoá rồi ghi mới". Xoá-rồi-ghi đẻ một bia mộ và
 * một bản ghi thứ hai cho **một** khoản có thật: két hoà giải theo `id` (K8) nên máy kia
 * sẽ thấy đúng hai dòng, và `taoLuc` gốc — thứ trả lời *"khoản này được ghi lúc mấy
 * giờ"* — mất luôn. `suaKhoan()` giữ `id`/`ngay`/`taoLuc` và hạ `dan_sms` → `tay` khi số
 * tiền đổi, đúng luật provenance của `so.ts`.
 *
 * ⚠⚠ XOÁ = ĐẶT BIA MỘ, không xoá cứng. Cú xoá phải LAN được sang máy khác qua két — xoá
 * hẳn thì khoản ấy "sống lại" ở lần khôi phục sau (`kho.ts` viết sẵn lý do này).
 *
 * ⚠ Hoàn tác 4 giây là **lưới đỡ, không phải cửa duy nhất** (lỗi số 8 của §8): sổ là dữ
 * liệu của user nên sửa/xoá phải là MẶC ĐỊNH, không phải một cửa sổ ân huệ.
 */
export function useDuongGhi(onGhi?: (id: string) => void): DuongGhi {
  const ghiKho = useGhiKho();
  const [lui, datLui] = useState<CuLui | null>(null);
  const [dangSua, datDangSua] = useState<Khoan | null>(null);

  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (hen.current) clearTimeout(hen.current); }, []);

  const dongLui = useCallback(() => {
    if (hen.current) clearTimeout(hen.current);
    hen.current = null;
    datLui(null);
  }, []);

  const moLui = useCallback((c: CuLui) => {
    if (hen.current) clearTimeout(hen.current);
    datLui(c);
    hen.current = setTimeout(() => datLui(null), HOAN_TAC_MS);
  }, []);

  /**
   * ⚠ `cach` chỉ đi vào TELEMETRY (`pfm_ghi`), KHÔNG vào sổ đăng ký: nhập bằng tờ hay bàn
   * phím thì `hv_cach_ghi` **đều là `tay`** — thêm giá trị ở đó là đổi `SCHEMA_VERSION`
   * và làm gãy so sánh với mọi kỳ cũ.
   *
   * ⚠⚠ CHỈ CÚ **GHI MỚI** BẮN `pfm_ghi`, CÚ SỬA THÌ KHÔNG — và đây là chuyện MẪU SỐ, không
   * phải chuyện tiết kiệm sự kiện. `config/telemetry.ts` khai câu hỏi của `pfm_ghi` là
   * *"chọn tờ cho tiện có kéo người ta LÀM TRÒN số không?"*, nên mẫu số của nó phải là
   * những cú **nhập một số mới**. Mà đường ghi này gộp ghi-mới với sửa vào một chỗ, còn
   * `cach` thì tính bằng `goSo ? 'go' : 'to'` — và bàn tiền có một effect ĐIỀN SẴN `goSo`
   * ngay khi vào chế độ sửa (nhấc số cũ về khay). Hệ quả: mọi cú sửa bắn `cach:'go'` **dù
   * người ấy không gõ một phím nào** — chạm tờ 50k rồi ĂN cho `'to'` (đúng), bấm SỬA LẠI
   * rồi chạm thêm tờ rồi ĂN lại cho `'go'` (sai). Người hay sửa bị đếm thành người hay gõ
   * số, và kết luận "bàn phím không kéo người ta làm tròn" lật ngược **chỉ vì hành vi
   * sửa**. Hoàn tác cũng không rút lại được một sự kiện đã bắn.
   * ⚠ Muốn đo cú SỬA thì đó là một `action_type` KHÁC, do founder chốt (A8.2) — không
   *   phải một giá trị mới nhét vào `pfm_ghi`.
   */
  const ghi = useCallback(async (
    soTien: number, nhan: MaNhanKhoan | null, huId: string | null,
    thu: boolean, cach: CachGhiUi, ghiChu?: string,
  ) => {
    if (soTien <= 0) return;
    rung(25, itChuyenDong());
    const luc = bayGio();
    const cu = dangSua;
    const k = cu !== null
      ? suaKhoan(cu, { soTien, chieu: thu ? 'thu' : 'chi', nhan, huId }, luc)
      : taoKhoan({
        ngay: homNay(),
        soTien,
        chieu: thu ? 'thu' : 'chi',
        nhan,
        huId,
        cachGhi: cach === 'lap' ? 'mau_lap' : 'tay',
        /* D453 — chip MẪU ghi đúng tên mẫu vào ghi chú (nếp `tuMauLap`): khoá lặp của khoản mới khớp khoá mẫu. */
        ...(ghiChu !== undefined ? { ghiChu } : {}),
      }, luc, sinhId());
    await ghiKho(['khoan'], (kho) => kho.ghi('khoan', khoanRaBanGhi(k)));
    // ⚠ CHỈ `cach`, không bao giờ số tiền: tiền của người dùng không rời máy (P2 🔒).
    // ⚠⚠ `cu === null` — cú GHI MỚI mới vào mẫu số. Xem chú thích của `ghi` ở trên.
    if (cu === null) ghiDo('pfm_ghi', { chi_tiet: { cach } });
    datDangSua(null);
    moLui({
      kieu: cu !== null ? 'sua' : 'ghi',
      so: soTien,
      lui: cu !== null
        // Lùi một cú SỬA = ghi lại nguyên bản cũ (cùng `id`), không phải xoá.
        ? () => ghiKho(['khoan'], (kho) => kho.ghi('khoan', khoanRaBanGhi({ ...cu, suaLuc: bayGio() })))
        : () => ghiKho(['khoan'], (kho) => kho.xoa('khoan', k.id, bayGio())),
    });
    onGhi?.(k.id);
  }, [dangSua, ghiKho, moLui, onGhi]);

  const xoa = useCallback(async (k: Khoan) => {
    rung(25, itChuyenDong());
    await ghiKho(['khoan'], (kho) => kho.xoa('khoan', k.id, bayGio()));
    // Đang sửa đúng dòng vừa bị xoá thì thả cú sửa ra, không để nó trỏ vào một bia mộ.
    datDangSua((d) => (d?.id === k.id ? null : d));
    moLui({
      kieu: 'xoa',
      so: k.soTien,
      // Lùi một cú XOÁ = ghi đè lại chính bản ghi ấy ⇒ bia mộ biến mất, `id` giữ nguyên.
      lui: () => ghiKho(['khoan'], (kho) => kho.ghi('khoan', khoanRaBanGhi({ ...k, suaLuc: bayGio() }))),
    });
  }, [ghiKho, moLui]);

  const batDauSua = useCallback((k: Khoan) => {
    rung(8, itChuyenDong());
    dongLui();          // toast của cú trước không còn nghĩa khi đã mở một cú mới
    datDangSua(k);
  }, [dongLui]);

  const huySua = useCallback(() => { datDangSua(null); }, []);

  const hoanTac = useCallback(async () => {
    if (lui === null) return;
    rung(8, itChuyenDong());
    const cu = lui;
    dongLui();
    await cu.lui();
  }, [dongLui, lui]);

  return { lui, dangSua, ghi, xoa, batDauSua, huySua, hoanTac };
}

/* ═══ component ═════════════════════════════════════════════════════════════ */

interface KhoanCuoi { so: number; thu: boolean }

const TIEN_TO_TOAST: Record<CuLui['kieu'], string> = {
  ghi: CHU_MAN_SO.daGhiPre,
  sua: CHU_MAN_SO.daSuaPre,
  xoa: CHU_MAN_SO.daXoaPre,
};

export function BanTien(
  { onGhi, onDoiCam, duong: duongNgoai, khongThu = false }: {
    onGhi?: (id: string) => void;
    onDoiCam?: (dangCam: boolean) => void;
    /**
     * PFM tầng không gian: màn SỔ là khung KHÔNG CUỘN, bàn tiền đứng cố định ở đáy và không còn gì phía trên cần "nhường chỗ
     * nhìn" — D420 (chạm ra ngoài ⇒ bàn thu xuống) sinh ra để người ta đọc danh sách dưới bàn, mà danh sách nay nằm ở lớp trượt.
     * Thu xuống còn làm bố cục bento nở ra rồi co lại giữa hai cú chạm (luật bàn CỐ ĐỊNH, founder 26/09). `true` ⇒ bàn không thu.
     */
    khongThu?: boolean;
    /**
     * Đường ghi DÙNG CHUNG với màn chứa nó. Màn SỔ dựng một cái rồi đưa xuống, vì nút
     * XOÁ/SỬA nằm ở danh sách phía trên mà vẫn phải đi qua đúng đường này (D284).
     * ⚠ Bỏ trống thì bàn tiền tự dựng một cái cho riêng mình — đúng nếp
     * "uncontrolled/controlled" của React, và là thứ cho phép dựng nó đứng một mình.
     */
    duong?: DuongGhi;
  },
): React.ReactElement {
  const { data: hu } = useHu();
  const { data: tatCa } = useSoTatCa();
  /*
   * ⭐ D453 — MẪU MỘT CHẠM. Trước đây "LƯU MẪU" (thẻ Oracle ở SỔ) cất một `MauLap` mà KHÔNG chỗ nào dùng: lời hứa "mẫu một
   *   chạm" không có nút nào đứng sau (bài học "câu hứa trên màn phải trỏ tới mã đang có"). Nay mẫu đã lưu nằm trong hàng
   *   khay khi khay rỗng — chạm là GHI (chi · đúng số · tên mẫu vào ghi chú), có hoàn tác 4 giây như mọi cú ghi.
   * ⚠ Luật bàn tiền CỐ ĐỊNH (D410): chip nằm TRONG hàng khay có sẵn (vùng cuộn ngang của tờ đang cầm) — không thêm hàng,
   *   mặt bàn không cao thêm một pixel; khay có tiền thì chip nhường chỗ cho tờ như câu gợi ý cũ.
   */
  const { data: mauLap } = useMauLap();
  const mauNhanh = useMemo(
    /* Chỉ mẫu CÓ SỐ: mẫu không số (người dùng gõ mỗi lần) không ghi một chạm được — nó là việc của bàn phím. */
    () => [...mauLap].filter((m): m is MauLap & { soTien: number } => m.soTien !== null && m.soTien > 0)
      .sort((a, b) => (a.taoLuc < b.taoLuc ? 1 : -1)).slice(0, 3),
    [mauLap],
  );

  // ⚠ Hook gọi VÔ ĐIỀU KIỆN (luật của React); bản riêng nằm không khi có đường từ ngoài.
  const duongRieng = useDuongGhi(onGhi);
  const duong = duongNgoai ?? duongRieng;

  const [cam, datCam] = useState<number[]>([]);
  const [goSo, datGoSo] = useState('');
  const [moPhim, datMoPhim] = useState(false);
  const [cuoi, datCuoi] = useState<KhoanCuoi | null>(null);

  const itMotion = useMemo(() => itChuyenDong(), []);

  const tong = useMemo(
    () => cam.reduce((a, b) => a + b, 0) + (goSo ? parseInt(goSo, 10) : 0),
    [cam, goSo],
  );
  const dangCam = tong > 0;

  /*
   * ⭐ ORACLE GIÚP 4/5 (D365) — MÓN LỚN ĐANG CẦM: quy ra đơn vị của chính người dùng, TRƯỚC khi ghi.
   * Hàm thuần `quyDoiMon` tự im khi chưa đủ sáu ngày có chi hoặc khoản chưa đủ lớn (P7 ⇒ `null`).
   * ⚠ A10 🔒 — chỉ hai phép chia trên chính sổ họ; không xếp hạng, không khuyên, không chặn cú ghi.
   * ⚠⚠ D410: từ bong bóng (cao ~200px, mọc ra giữa khay và lưới tiền) về MỘT DÒNG trong chỗ giữ sẵn — cùng hai con
   *   số, không chen vào giữa hai cú chạm tờ.
   */
  const quy = useMemo(
    () => (dangCam ? quyDoiMon({ soTien: tong, so: tatCa, hu }) : null),
    [dangCam, tong, tatCa, hu],
  );
  const huQuy = quy?.huId === undefined || quy.huId === null
    ? null : hu.find((h) => h.id === quy.huId) ?? null;

  /*
   * ⚠⚠ BÁO LÊN "TAY ĐANG CẦM TIỀN" — demo mờ CẢ phần trên khi có tiền trong khay
   * (`.app[data-cam=co] .tren{opacity:.28;pointer-events:none}`). Đó là tầng MỘT của
   * progressive disclosure, không phải trang trí: nó nói *"giờ việc của bạn là chọn
   * đích"*, và nó chặn luôn cú chạm nhầm vào danh sách khi tay đang cầm tiền.
   * ⚠ `data-cam` phải nằm ở tổ tiên CHUNG của cả hai vùng, mà bàn tiền là em của phần
   *   trên — nên trạng thái phải đi lên, không tự xử được tại chỗ.
   */
  useEffect(() => { onDoiCam?.(dangCam); }, [dangCam, onDoiCam]);

  /*
   * ⚠⚠ TAY ĐANG CẦM TIỀN ⇒ LỚP PHỦ TOÀN CỤC BIẾN MẤT HẲN (chỉ thị founder 06/09: *"những
   * lúc cần thao tác cho nó mất hẳn cũng được"*). Mờ là đủ cho lúc chỉ ĐỌC màn; nhưng khi
   * đích đã hiện ra thì cú chạm tiếp theo là cú GHI TIỀN, và một bong bóng nằm đè lên
   * hàng tờ không chỉ khó nhìn — nó ăn mất cú chạm.
   */
  useDangThaoTac(dangCam);

  /*
   * ⭐ D420 — CHẠM RA NGOÀI ⇒ BÀN TIỀN THU XUỐNG, chỉ để lại hàng khay làm tay nắm (founder 26/09: *"khi bấm ra ngoài
   *   bàn phím thì có thể ẩn bàn phím xuống dưới để user có không gian nhìn"*). Chạm hàng khay ⇒ trồi lên.
   * ⚠ CHỈ cú CHẠM ra ngoài — cuộn không tính: người ta cuộn để đọc sổ, bàn mà thụt ra thụt vào theo ngón tay là mất
   *   chỗ quen tay. Chạm VÀO bàn không bao giờ thu nó (luật "cố định" D410). Nút mang `data-mo-ban-tien` (SỬA LẠI một
   *   dòng) là lối VÀO bàn tiền, không phải chạm ra ngoài.
   * ⚠ Tiền đang cầm GIỮ NGUYÊN khi thu (như bàn phím điện thoại ẩn đi, chữ vẫn nằm trong ô); hàng khay vẫn hiện nó.
   * ⚠⚠ Đổi bố cục ĐÚNG lúc hình dừng: trượt bằng WAAPI (`transform`) có `fill`, hẹn giờ theo `NHIP.PFM_BAN_THU` rồi mới
   *   thu bố cục, và GỠ animation trong `useLayoutEffect` sau khi bố cục thu đã vào DOM — gỡ trước là một khung hình bàn
   *   tiền bật ngược lên đủ cao rồi mới co, mắt đọc là giật.
   */
  const goc = useRef<HTMLDivElement | null>(null);
  const [thu, datThu] = useState(false);
  const truot = useRef<Animation | null>(null);
  const vuaMo = useRef(false);

  const thuXuong = useCallback(() => {
    const el = goc.current;
    if (khongThu || el === null || thu || truot.current !== null) return;
    if (itMotion || typeof el.animate !== 'function') { datThu(true); return; }
    const khay = el.querySelector<HTMLElement>(`.${s.khay}`);
    const d = el.offsetHeight - (khay?.offsetHeight ?? 0);
    truot.current = el.animate(
      [{ transform: 'none' }, { transform: `translateY(${d}px)` }],
      { duration: NHIP.PFM_BAN_THU, easing: 'cubic-bezier(.55,0,.85,.35)', fill: 'forwards' },
    );
    setTimeout(() => datThu(true), NHIP.PFM_BAN_THU);
  }, [itMotion, thu, khongThu]);

  const moLen = useCallback(() => {
    vuaMo.current = true;
    datThu(false);
  }, []);

  useLayoutEffect(() => {
    const el = goc.current;
    if (thu) { truot.current?.cancel(); truot.current = null; return; }
    if (!vuaMo.current || el === null) return;
    vuaMo.current = false;
    if (itMotion || typeof el.animate !== 'function') return;
    const khay = el.querySelector<HTMLElement>(`.${s.khay}`);
    const d = el.offsetHeight - (khay?.offsetHeight ?? 0);
    el.animate(
      [{ transform: `translateY(${d}px)` }, { transform: 'none' }],
      { duration: NHIP.PFM_BAN_MO, easing: 'cubic-bezier(.34,1.4,.64,1)' },
    );
  }, [thu, itMotion]);

  useEffect(() => {
    const ngoai = (e: MouseEvent): void => {
      const el = goc.current;
      const t = e.target;
      if (el === null || !(t instanceof Node) || el.contains(t)) return;
      if (t instanceof Element && t.closest('[data-mo-ban-tien]') !== null) return;
      thuXuong();
    };
    document.addEventListener('click', ngoai);
    return () => document.removeEventListener('click', ngoai);
  }, [thuXuong]);

  /*
   * ⭐⭐ MỞ LẠI BÀN TIỀN VỚI SỐ CỦA DÒNG ĐANG SỬA. Đây là số của CHÍNH NGƯỜI DÙNG được
   * nhấc về, không phải app đề xuất một mức tiền (P3 🔒) — họ vừa chỉ đúng dòng ấy.
   * ⚠ Bàn phím mở luôn: sửa mà phải đi tìm cửa gõ số là bắt trả phí hai lần cho một việc.
   */
  const idSua = duong.dangSua?.id ?? null;
  const soSua = duong.dangSua?.soTien ?? 0;
  useEffect(() => {
    if (idSua === null) return;
    datThu((t) => { if (t) vuaMo.current = true; return false; });   // D420 — sửa một dòng cần bàn tiền: trồi lên
    datCam([]);
    datGoSo(String(soSua));
    datMoPhim(true);
  }, [idSua, soSua]);

  /**
   * Chạm CHI hoặc THU = chốt cú ghi (D410: hai đích duy nhất).
   * ⚠ Ghi mới ⇒ không nhãn, không hũ: tối về phân bổ ở màn HŨ (`pfm/phan_bo.ts`).
   * ⚠⚠ SỬA một dòng ⇒ GIỮ nguyên nhãn/hũ của dòng ấy. D410 bỏ CÂU HỎI lúc ghi, không xoá câu trả lời người dùng đã đưa.
   */
  /*
   * ⚠⚠ KHOÁ ĐỒNG BỘ CHỐNG BẤM ĐÚP: khay chỉ được dọn SAU `await duong.ghi` (ghi kho mất vài chục mili-giây, lâu hơn khi máy chậm), nên cú chạm thứ
   *   hai trong khoảng ấy vẫn thấy tiền đang cầm và GHI LẦN NỮA — hai khoản cho một lần cầm tiền (bắt được bằng kịch bản trình duyệt ở khung 360×640,
   *   11/10; lỗi có từ trước tầng không gian). Khoá ref (đồng bộ, không chờ render) giữ đúng MỘT cú ghi cho mỗi lần cầm.
   */
  const dangGhi = useRef(false);
  const chamChieu = useCallback(async (thu: boolean) => {
    if (tong <= 0 || dangGhi.current) return;
    dangGhi.current = true;
    try {
      const so = tong;
      const cu = duong.dangSua;
      await duong.ghi(so, cu?.nhan ?? null, cu?.huId ?? null, thu, goSo ? 'go' : 'to');
      datCuoi({ so, thu });
      datCam([]); datGoSo(''); datMoPhim(false);
    } finally { dangGhi.current = false; }
  }, [duong, goSo, tong]);

  /** CHIP MẪU một chạm: CÙNG khoá đồng bộ với CHI/THU (SPEC 5b) — bấm đúp một chip là MỘT khoản, không hai (RÀ 12/10). */
  const chamMau = useCallback(async (m: MauLap & { soTien: number }) => {
    if (dangGhi.current) return;
    dangGhi.current = true;
    try { await duong.ghi(m.soTien, m.nhan, m.huId, laMauThu(m), 'lap', m.ten); } finally { dangGhi.current = false; }
  }, [duong]);

  /**
   * ⚠ ĐÓNG BÀN PHÍM THÌ CHỐT SỐ ĐANG GÕ VÀO KHAY — không để nó treo ở chỗ người dùng
   * không còn sửa được.
   */
  const doiPhim = useCallback(() => {
    rung(8, itMotion);
    datMoPhim((m) => {
      if (m && goSo) { datCam((c) => [...c, parseInt(goSo, 10)]); datGoSo(''); }
      return !m;
    });
  }, [goSo, itMotion]);

  /*
   * ⚠⚠ ✕ TRONG LÚC SỬA = **HUỶ SỬA**, không phải xoá dòng. Demo bỏ dòng khỏi danh sách
   * ngay lúc bấm SỬA LẠI, nên bấm ✕ sau đó là mất luôn khoản ấy — một cú xoá không ai
   * yêu cầu. Ở đây dòng chỉ ĐANG ẨN, nên ✕ trả nó về nguyên trạng.
   */
  const xoaHet = useCallback(() => {
    rung(8, itMotion);
    duong.huySua();
    datCam([]); datGoSo('');
  }, [duong, itMotion]);

  return (
    <div
      ref={goc}
      className={s.day}
      data-cam={dangCam ? 'co' : 'khong'}
      data-phim={moPhim ? 'co' : 'khong'}
      data-thu={thu ? 'co' : 'khong'}
      data-testid="ban-tien"
      /* D420 — đang thu: chạm đâu trên hàng khay cũng CHỈ mở bàn (không gỡ tờ, không lật bàn phím) — trừ HOÀN TÁC. */
      onClickCapture={(e) => {
        if (!thu) return;
        if (e.target instanceof Element && e.target.closest(`.${s.toast}`) !== null) return;
        e.stopPropagation();
        e.preventDefault();
        moLen();
      }}
    >
      {duong.lui !== null && (
        <div className={s.toast} role="status">
          <span>
            {TIEN_TO_TOAST[duong.lui.kieu]}{dinhDang(duong.lui.so)}{CHU_MAN_SO.hauDong}
          </span>
          <button type="button" onClick={() => void duong.hoanTac()}>
            {CHU_MAN_SO.nutHoanTac}
          </button>
        </div>
      )}

      <Khay
        cam={cam} goSo={goSo} tong={tong} coLap={cuoi !== null} thu={thu}
        itMotion={itMotion}
        mau={duong.dangSua === null ? mauNhanh : []}
        ghiMau={(m) => { void chamMau(m); }}
        boMotTo={(gt) => { rung(8, itMotion); datCam((c) => { const i = c.lastIndexOf(gt); return i < 0 ? c : [...c.slice(0, i), ...c.slice(i + 1)]; }); }}
        xoaHet={xoaHet}
        lapLai={() => { if (cuoi) { rung(8, itMotion); datCam([cuoi.so]); } }}
      />

      {/*
        ⭐ D410 — DÒNG QUY ĐỔI là một CHỖ GIỮ SẴN (cao cố định, kể cả khi trống): có chữ hay không, lưới tiền bên dưới
        không nhích một pixel. `aria-live` để người dùng trình đọc màn hình nghe được con số khi nó hiện.
      */}
      <p className={s.dongQuy} aria-live="polite" data-testid="dong-quy">
        {quy !== null && (
          <>
            <b className={s.nhanQuy}>{CHU_GIUP.quyTen}</b>
            {`${CP.quyGonPre}${Math.round(quy.soNgayThuong)}${CP.quyGonNgay}`}
            {quy.phanMucHu !== null && huQuy !== null
              && ` · ${Math.round(quy.phanMucHu * 100)}${CP.quyGonMucGiua}${huQuy.ten}${CP.quyGonMucHau}`}
          </>
        )}
      </p>

      <LuoiTien onChon={(gt, el) => {
        rung(8, itMotion);
        if (!itMotion) bayTo(el);
        datCam((c) => [...c, gt]);
      }} />

      <BanPhim
        onSo={(d) => { if (goSo.length < 9) { rung(8, itMotion); datGoSo((g) => g + d); } }}
        onXoa={() => { rung(8, itMotion); datGoSo((g) => g.slice(0, -1)); }}
      />

      {/*
        ⭐⭐⭐ HÀNG ĐÁY — ĐÚNG BỐ CỤC DEMO CHỐT bản 6 (founder 11/10): GÕ SỐ · − CHI · + THU, một hàng dưới lưới tờ. D410 giữ nguyên: HAI ĐÍCH CỐ
        ĐỊNH — luôn DỰNG (khay rỗng thì tắt), luôn ở đúng chỗ: ngón cái học được vị trí CHI như học vị trí tờ 50k. ⚠ THU ghi THẲNG, không hỏi
        nguồn (founder 04/09). GÕ SỐ là CỬA DUY NHẤT vào bàn phím (nó thay lưới tờ, cùng chiều cao) — luôn bật, không bao giờ tắt.
      */}
      <div className={s.hangChieu}>
        <button type="button" className={s.nutChieu} aria-pressed={moPhim} title="Chạm để gõ số" onClick={doiPhim}>
          {CP.goSo}
        </button>
        <button type="button" className={`${s.nutChieu} ${s.chi}`} disabled={!dangCam}
          onClick={() => void chamChieu(false)}>
          {CP.nutChi}
        </button>
        <button type="button" className={`${s.nutChieu} ${s.thu}`} disabled={!dangCam}
          onClick={() => void chamChieu(true)}>
          {CP.nutThu}
        </button>
      </div>
    </div>
  );
}

/* ═══ khay ══════════════════════════════════════════════════════════════════ */

function Khay(props: {
  cam: number[]; goSo: string; tong: number; coLap: boolean; thu: boolean;
  itMotion: boolean;
  boMotTo: (gt: number) => void; xoaHet: () => void; lapLai: () => void;
  /** D453 — mẫu đã lưu (có số), tối đa ba, bày khi khay rỗng. Rỗng ⇒ câu gợi ý cũ. */
  mau: readonly (MauLap & { soTien: number })[];
  ghiMau: (m: MauLap & { soTien: number }) => void;
}): React.ReactElement {
  const { cam, tong, coLap, itMotion } = props;
  /*
   * ⚠ TỜ TRÙNG MỆNH GIÁ GỘP THÀNH MỘT CHỒNG CÓ SỐ ĐẾM — bấm 500k bốn lần thì khay nói
   * "500k ×4", không phải bốn ô giống hệt nhau xếp hàng.
   */
  const chong = useMemo(() => {
    const dem = new Map<number, number>();
    for (const gt of cam) dem.set(gt, (dem.get(gt) ?? 0) + 1);
    return [...dem.entries()].sort((a, b) => b[0] - a[0]);
  }, [cam]);

  const refCuon = useRef<HTMLSpanElement | null>(null);
  const [khuat, datKhuat] = useState<KhuatKhay>({ tran: false, trai: 0, phai: 0 });
  const [dangKeo, datDangKeo] = useState(false);

  /** Đo lại NGAY TẠI CHỖ. Trả về `cu` khi không đổi ⇒ không đẻ một lượt vẽ thừa nào. */
  const dem = useCallback(() => {
    const el = refCuon.current;
    if (el === null) return;
    const k = doKhay(el);
    datKhuat((cu) => (cu.tran === k.tran && cu.trai === k.trai && cu.phai === k.phai ? cu : k));
  }, []);

  /*
   * ⚠⚠ THỨ TỰ QUAN TRỌNG: **đặt chỗ cho `+N` TRƯỚC → cuộn → mới đếm.** Ô `+N` là anh em
   * flex của khay nên nó ĂN 26px của vùng cuộn; chèn nó SAU khi cuộn thì bố cục đổi và tờ
   * vừa bấm lại khuất. Ở React, "đặt chỗ" là lượt `dem()` đầu: nó bật `khuat.tran`, effect
   * chạy lại (deps có `khuat.tran`) khi ô đã nằm trong DOM, rồi mới cuộn + đếm thật.
   * ⚠ `useLayoutEffect` chứ không `useEffect`/rAF: phải xong TRƯỚC lượt vẽ, và rAF thì
   *   không chạy khi khung ẩn (§9) — người dùng quay lại sẽ thấy khay thiếu dấu hiệu tràn.
   */
  useLayoutEffect(() => {
    const el = refCuon.current;
    if (el === null) return;
    dem();
    const moi = cam.length > 0 ? cam[cam.length - 1] : null;
    if (moi !== null) {
      const o = el.querySelector<HTMLElement>(`[data-gt="${moi}"]`);
      // ⚠ `scrollIntoView` không có ở mọi nền (jsdom không cài) — hỏi trước khi gọi.
      if (o !== null && typeof o.scrollIntoView === 'function') {
        o.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
    dem();
  }, [cam, khuat.tran, dem]);

  /** Lớp phủ THÊM, không phải nguồn: sự kiện `scroll` không bảo đảm bắn khi khung ẩn. */
  useEffect(() => {
    const el = refCuon.current;
    if (el === null) return undefined;
    el.addEventListener('scroll', dem, { passive: true });
    return () => el.removeEventListener('scroll', dem);
  }, [dem]);

  /*
   * ⭐⭐ VÙNG CUỘN MÀ GIẤU THANH CUỘN THÌ PHẢI CẤP LẠI ĐƯỜNG ĐIỀU KHIỂN (founder 04/09:
   * *"chỗ này không cho t lướt để xem ư?"*). `overflow-x:auto` + `scrollbar-width:none`
   * nghĩa là CHẠM kéo được, còn CHUỘT thì không có gì để bám. Bốn đường vào, không đường
   * nhập nào bị bỏ rơi: chạm (trình duyệt tự lo, cướp lấy chỉ làm nó giật) · **kéo bằng
   * chuột** · **lăn dọc → chạy ngang** · ô `+N` bấm được.
   * ⚠ Gắn MỘT lần, không gắn lại mỗi lượt vẽ khay — nghe lại trên cùng một phần tử là rò
   *   rỉ chậm mà im lặng.
   * ⚠ `wheel` phải tự gắn với `{passive:false}`: React gắn `onWheel` ở gốc dưới dạng
   *   PASSIVE, nên `preventDefault()` trong đó không có tác dụng (và chỉ ra một cảnh báo).
   */
  useEffect(() => {
    const el = refCuon.current;
    if (el === null) return undefined;
    let keo = false;
    let daKeo = false;
    let x0 = 0;
    let s0 = 0;
    const coTran = (): boolean => el.scrollWidth > el.clientWidth + 1;

    const xuong = (e: PointerEvent): void => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if (!coTran()) return;
      keo = true; daKeo = false; x0 = e.clientX; s0 = el.scrollLeft;
    };
    const di = (e: PointerEvent): void => {
      if (!keo) return;
      const d = e.clientX - x0;
      if (!daKeo && Math.abs(d) > KEO_NGUONG) { daKeo = true; datDangKeo(true); }
      if (daKeo) { el.scrollLeft = s0 - d; dem(); e.preventDefault(); }
    };
    const len = (): void => {
      if (!keo) return;
      keo = false;
      datDangKeo(false);
      /* Nuốt ĐÚNG cú click kết thúc cú kéo: kéo xong mà tờ dưới ngón bị gỡ mất thì tệ
         hơn hẳn so với không kéo được. */
      if (daKeo) {
        const nuot = (ev: Event): void => {
          ev.stopPropagation(); ev.preventDefault();
          el.removeEventListener('click', nuot, true);
        };
        el.addEventListener('click', nuot, true);
      }
    };
    const lan = (e: WheelEvent): void => {
      if (!coTran()) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;   // trackpad vuốt ngang: để yên
      el.scrollLeft += e.deltaY; dem(); e.preventDefault();
    };

    el.addEventListener('pointerdown', xuong);
    window.addEventListener('pointermove', di);
    window.addEventListener('pointerup', len);
    el.addEventListener('wheel', lan, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', xuong);
      window.removeEventListener('pointermove', di);
      window.removeEventListener('pointerup', len);
      el.removeEventListener('wheel', lan);
    };
  }, [dem]);

  /* Trượt tới đích bằng SÁU BƯỚC RỜI — xem chú thích của `TRUOT_BUOC`. */
  const henTruot = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (henTruot.current) clearTimeout(henTruot.current); }, []);
  const truotToi = useCallback((dich: number) => {
    const el = refCuon.current;
    if (el === null) return;
    if (henTruot.current) clearTimeout(henTruot.current);
    const xa = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, dich));
    if (itMotion) { el.scrollLeft = xa; dem(); return; }
    const dau = el.scrollLeft;
    let i = 0;
    const buoc = (): void => {
      i += 1;
      el.scrollLeft = dau + ((xa - dau) * i) / TRUOT_BUOC;
      dem();                       // ⚠ đếm NGAY, đừng chờ sự kiện `scroll`
      if (i < TRUOT_BUOC) henTruot.current = setTimeout(buoc, TRUOT_MS);
    };
    buoc();
  }, [dem, itMotion]);

  const bamThemNua = useCallback(() => {
    const el = refCuon.current;
    if (el === null) return;
    truotToi(khuat.phai > 0 ? el.scrollLeft + el.clientWidth * TRUOT_PHAN : 0);
  }, [khuat.phai, truotToi]);

  return (
    <div className={s.khay}>
      {/* TỔNG bên TRÁI, to, vàng — đúng demo (`.khay b`). Chỉ ĐỌC (không phải nút): cửa gõ số nay là GÕ SỐ ở hàng đáy. `.nhay`: tờ chạm khay ⇒ số nhảy. */}
      <b className={s.tongSo} data-testid="khay-tong" aria-label={`Đang cầm ${dinhDang(tong)}${CHU_MAN_SO.hauDong}`}>
        {`${dinhDang(tong)}${CHU_MAN_SO.hauDong.trim()}`}
      </b>
      {/*
        ⚠ Mờ ở ĐẦU NÀO CÒN TỜ KHUẤT đầu ấy — mờ trái nghĩa là "sau lưng còn", mờ phải là
        "phía trước còn". Hai biến `--mL`/`--mR` nên chỉ cần MỘT luật mask, không tổ hợp lớp.
      */}
      <span
        ref={refCuon}
        data-khay="cuon"
        className={`${s.toCam} ${khuat.tran ? s.tran : ''} ${dangKeo ? s.keo : ''}`}
        style={{
          '--mL': khuat.trai > 0 ? MEP_MO : '0px',
          '--mR': khuat.phai > 0 ? MEP_MO : '0px',
        } as React.CSSProperties}
      >
        {tong <= 0 && (props.mau.length === 0 || props.thu)
          && <span className={s.moi}>{props.thu ? CP.moBan : CB.banChamTo}</span>}
        {tong > 0 && <span className={s.moi}>{CB.banDangCam}</span>}
        {tong <= 0 && !props.thu && props.mau.map((m) => (
          <button
            key={m.id} type="button" className={s.chipMau} data-testid="chip-mau"
            aria-label={`${CHU_MAN_SO.mauAria}${m.ten} ${dinhDang(m.soTien)}${CHU_MAN_SO.hauDong}`}
            onClick={() => props.ghiMau(m)}
          >
            <span className={s.tenMau}>{m.ten}</span>
            <b>{nhanTo(m.soTien)}</b>
          </button>
        ))}
        {chong.map(([gt, n]) => {
          const to = TO_TIEN.find((t) => t.gt === gt);
          return (
            <button
              key={gt}
              type="button"
              data-gt={gt}
              className={`${s.oChip} ${n > 1 ? s.nhieu : ''}`}
              title={`Bỏ một tờ ${nhanTo(gt)}`}
              style={bienTo(to)}
              onClick={() => props.boMotTo(gt)}
            >
              <span className={s.to}>{nhanTo(gt)}</span>
              {n > 1 && <b className={s.dem}>×{n}</b>}
            </button>
          );
        })}
      </span>

      {/* ⚠ Ô `+N` nằm NGOÀI vùng cuộn (anh em của `.toCam`) — để trong thì chính cái báo
          tràn cũng trôi mất, tức cái báo tràn lại bị tràn. */}
      {khuat.tran && (
        <button
          type="button"
          className={s.themNua}
          title={khuat.phai > 0
            ? `${CHU_MAN_SO.conKhuatPre}${khuat.phai}${CHU_MAN_SO.conKhuatHau}`
            : CHU_MAN_SO.veDauDai}
          onClick={bamThemNua}
        >
          {khuat.phai > 0 ? `+${khuat.phai}` : CHU_MAN_SO.oVeDau}
        </button>
      )}

      {tong <= 0 && coLap && (
        <button type="button" className={s.lap} title="Lặp lại khoản gần nhất"
          onClick={props.lapLai}>↺ LẶP</button>
      )}

      {tong > 0 && (
        <button type="button" className={s.xoa} aria-label="Bỏ hết tiền trong khay"
          onClick={props.xoaHet}>✕</button>
      )}
    </div>
  );
}

function bienTo(t: ToTien | undefined): React.CSSProperties {
  return {
    '--m': t?.m ?? '#556579',
    '--bam': t?.bam ?? '#33465e',
    '--soc': t?.soc ?? '4px',
  } as React.CSSProperties;
}

/* ═══ lưới tiền + bàn phím ══════════════════════════════════════════════════ */

function LuoiTien(
  { onChon }: { onChon: (gt: number, el: HTMLElement) => void },
): React.ReactElement {
  return (
    <div className={s.tien} role="group" aria-label="Mệnh giá tiền">
      {TO_TIEN.map((t) => (
        <button key={t.gt} type="button" className={s.to} style={bienTo(t)}
          onClick={(e) => onChon(t.gt, e.currentTarget)}>
          {nhanTo(t.gt)}
        </button>
      ))}
    </div>
  );
}

/**
 * Bàn phím 4×3, **KHÔNG có nút XONG**: gõ xong chạm thẳng đích là ghi.
 * ⚠ Nó THAY CHỖ lưới tiền (cùng chiều cao) chứ không chồng lên, nên đáy không cao thêm và
 * lưới đích phía trên không xê dịch một pixel nào khi lật qua lại.
 */
export function BanPhim(
  { onSo, onXoa, luonHien = false }: {
    onSo: (d: string) => void; onXoa: () => void;
    /** D420 — dùng ngoài bàn tiền (khay GÕ SỐ ở màn HŨ): luôn hiện, không chờ `data-phim` của bàn tiền. */
    luonHien?: boolean;
  },
): React.ReactElement {
  return (
    <div className={s.phim} data-luon-hien={luonHien ? '' : undefined}>
      {['1', '2', '3'].map((d) => <button key={d} type="button" onClick={() => onSo(d)}>{d}</button>)}
      <button type="button" className={s.phu2} aria-label="Xoá một chữ số" onClick={onXoa}>⌫</button>
      {['4', '5', '6'].map((d) => <button key={d} type="button" onClick={() => onSo(d)}>{d}</button>)}
      <button type="button" className={s.phu2} onClick={() => onSo('000')}>000</button>
      {['7', '8', '9', '0'].map((d) => (
        <button key={d} type="button" onClick={() => onSo(d)}>{d}</button>
      ))}
    </div>
  );
}

/**
 * ⭐ TỜ TIỀN BAY TỪ LƯỚI LÊN KHAY — phản hồi CHÍNH của cú bấm.
 *
 * ⚠ Trên điện thoại NGÓN TAY che chính ô vừa bấm, nên cú "bừng" của phím là phản hồi
 * PHỤ; thứ người ta thật sự thấy là tờ bay lên và tổng ở khay nhảy số.
 * ⚠ `steps(6)` — nhịp MÁY (ranh D182), và bản sao gắn vào `body` nên nó nằm ngoài mọi
 * `overflow:hidden` của khay.
 */
function bayTo(nguon: HTMLElement): void {
  const khay = document.querySelector(`.${s.khay}`);
  if (!khay || typeof nguon.animate !== 'function') return;
  const r = nguon.getBoundingClientRect();
  const d = khay.getBoundingClientRect();
  const c = nguon.cloneNode(true) as HTMLElement;
  c.className = `${s.to} ${s.bay}`;
  c.style.cssText += `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
  c.style.setProperty('--m', nguon.style.getPropertyValue('--m'));
  c.style.setProperty('--soc', nguon.style.getPropertyValue('--soc'));
  document.body.appendChild(c);
  const dx = (d.left + 40) - r.left;
  const dy = (d.top + 10) - r.top;
  c.animate([
    { transform: 'none' },
    { transform: `translate(${dx / 2}px,${dy - 26}px)` },
    { transform: `translate(${dx}px,${dy}px)`, opacity: .2 },
  ], { duration: NHIP.PFM_BAY, easing: 'steps(6,end)', fill: 'forwards' });
  /*
   * ⚠ DỌN BẰNG HẸN GIỜ THEO NHỊP, KHÔNG BẰNG `onfinish` (SPEC `pfm-tang-khong-gian` mục 5; bắt được ở demo 11/10): khung bị ẩn
   * hoặc không vẽ thì `onfinish` không bao giờ tới và tờ bay kẹt trên `body`. Cùng hẹn giờ ấy là lúc tờ CHẠM khay ⇒ ô tổng NHẢY
   * một nhịp máy (`steps(3)`): tờ bay là phản hồi chính, con số nhảy là phản hồi nói "tổng đã đổi".
   */
  setTimeout(() => {
    c.remove();
    const tong = document.querySelector<HTMLElement>(`.${s.tongSo}`);
    if (tong === null) return;
    tong.classList.remove(s.nhay ?? '');
    void tong.offsetWidth;
    tong.classList.add(s.nhay ?? '');
    setTimeout(() => tong.classList.remove(s.nhay ?? ''), NHIP.PFM_KHAY_NHAY + 40);
  }, NHIP.PFM_BAY + 40);
}
