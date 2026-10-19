/**
 * PFM — DÙNG KHO TỪ REACT: provider + hook đọc/ghi, khép GĐ1.
 *
 * ⚠⚠ KHÔNG DỰNG `QueryClient` MỚI. App đã có một cái ở `main.tsx` (`makeQueryClient`),
 * và một client thứ hai là một CACHE thứ hai: `invalidateQueries` gọi trên client này sẽ
 * không chạm tới query đang treo ở client kia, nên màn hình hiện dữ liệu cũ sau khi ghi
 * mà không có gì báo. Provider ở đây chỉ cấp **kho**, không cấp client.
 *
 * ⚠⚠ `staleTime: Infinity` LÀ ĐÚNG Ở ĐÂY VÀ SAI Ở MỌI CHỖ KHÁC. Query của `api/queries.ts`
 * để 15 giây vì nguồn chân lý nằm trên server và có thể đổi sau lưng. Kho PFM thì nằm
 * **trên chính máy này**: nó chỉ đổi khi TA ghi, và lúc ấy ta tự vô hiệu hoá. Đặt một
 * `staleTime` hữu hạn ở đây là hẹn giờ đọc lại IndexedDB cho một thứ không ai đổi được —
 * tốn pin, không thêm một chút đúng đắn nào.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/api/queries';
import { ghiDo } from '@/lib/telemetry';
import { KhoTrongBoNho, type BanGhi, type KhoPfm, type TenNgan, type TruyVan } from './kho.js';
import { moKho, xoaKhoChungCu } from './kho_idb.js';
import { xinGiuBen } from './giu_ben.js';
import { locKhoanSo, type Khoan, type MauLap } from './so.js';
import { sapXep, type Hu } from './hu.js';
import { type Luat } from './luat.js';
import { type HuCon } from './hu_con.js';
import { docHoSo, type HoSo } from './ho_so.js';
import { CAI_DAT_MAY_MAC_DINH, ID_CAI_DAT_MAY, type CaiDatMay } from './cai_dat_may.js';
import { thangNay } from './thoi_gian.js';
import { useKichDongBo } from './dong_bo_kich.js';

/* ═══ 1. KHOÁ QUERY — vô hiệu hoá theo TIỀN TỐ ═════════════════════════════ */

/**
 * ⚠⚠ MỌI KHOÁ BẮT ĐẦU BẰNG `['pfm', <ngăn>]`, và đó là điều kiện để phép vô hiệu hoá
 * đúng. TanStack so khoá theo TIỀN TỐ, nên `invalidateQueries(['pfm','khoan'])` quét sạch
 * **mọi tháng**.
 * ⇒ Vì sao phải quét mọi tháng chứ không riêng tháng đang xem: người dùng ghi bù cho hôm
 * qua (hoặc cho tháng trước) là chuyện thường, và cú ghi ấy rơi vào một khoá KHÁC với
 * khoá màn hình đang mở. Vô hiệu hoá đúng-một-tháng thì dòng vừa ghi không hiện ra, người
 * dùng ghi lại lần nữa, và sổ có hai dòng.
 */
export const KHOA_PFM = {
  ngan: (n: TenNgan) => ['pfm', n] as const,
  khoanThang: (thang: string) => ['pfm', 'khoan', thang] as const,
  hu: ['pfm', 'hu'] as const,
  luat: ['pfm', 'luat'] as const,
  huCon: ['pfm', 'hu_con'] as const,
  mauLap: ['pfm', 'mau_lap'] as const,
  hoSo: ['pfm', 'meta', 'ho_so'] as const,
};

/* ═══ 2. PROVIDER ══════════════════════════════════════════════════════════ */

export interface KhoNgu {
  kho: KhoPfm | null;
  /**
   * Kho có BỀN qua các phiên không. `false` ⇒ đang chạy trên `KhoTrongBoNho`: sổ sống
   * đúng một phiên rồi mất.
   *
   * ⚠⚠ TRƯỜNG NÀY PHẢI ĐI RA TỚI MÀN HÌNH. `kho.ts` đã ghi thẳng: *"Rơi về bản này là MẤT
   * DỮ LIỆU KHI ĐÓNG APP, nên người gọi phải được BÁO"*. Một app ghi tiền mà im lặng quên
   * sạch lúc đóng tab là cách phản bội lòng tin nhanh nhất có thể nghĩ ra — và người dùng
   * chỉ phát hiện khi đã ghi cả tháng.
   */
  ben: boolean;
  /** Câu vì-sao khi phải rơi về kho tạm — hiện trên dải cảnh báo, không nuốt. */
  loiMo: string | null;
  dangMo: boolean;
}

const Ngu = createContext<KhoNgu | null>(null);

/**
 * ⚠ MỘT LƯỢT MỞ CHO CẢ TRANG — MỖI TÀI KHOẢN. `moKho()` mở một kết nối IDBDatabase mới mỗi lần gọi, mà
 * React 18 StrictMode chạy effect HAI lần lúc dev ⇒ hai kết nối, và kết nối thừa ấy giữ
 * kho ở phiên bản cũ đúng như ca `onblocked` mà `kho_idb.ts` đã cảnh báo. Nói cách khác:
 * ta sẽ tự gây ra cho mình cái lỗi khó tra nhất của chính mình.
 *
 * ⚠⚠ D603 — lượt mở NHỚ LUÔN CHỦ của nó (`user_id`). Đăng xuất rồi người khác đăng nhập trên cùng tab (lớp học dùng chung
 * máy) ⇒ chủ đổi ⇒ đóng kho cũ, mở kho của người mới. Không nhớ chủ thì người sau nhận đúng kết nối tới sổ người trước.
 */
let motLuot: { chu: string; hua: Promise<KhoPfm> } | null = null;
/** Bản demo: một kho cho sẵn dùng cho MỌI chủ — xem `dungKhoCoSan`. */
let khoCoSan: Promise<KhoPfm> | null = null;

function moMotLuot(chu: string): Promise<KhoPfm> {
  if (khoCoSan) return khoCoSan;
  if (motLuot && motLuot.chu !== chu) {
    const cu = motLuot.hua;
    motLuot = null;
    void cu.then((k) => k.dong(), () => undefined);
  }
  if (!motLuot) {
    const hua = moKho(chu);
    motLuot = { chu, hua };
    void hua.then(() => { daXinGiuBen ??= baoGiuBen(); }, () => undefined);
  }
  return motLuot.hua;
}

/**
 * Xin trình duyệt giữ kho lâu dài — MỘT lần mỗi trang, sau lượt mở kho thật đầu tiên (`giu_ben.ts`). Kết quả đếm bằng
 * telemetry `pfm_kho_ben`, không mang gì ngoài mã kết quả.
 */
let daXinGiuBen: Promise<void> | null = null;
async function baoGiuBen(): Promise<void> {
  ghiDo('pfm_kho_ben', { chi_tiet: { ket_qua: await xinGiuBen() } });
}

/**
 * ⚠⚠ CACHE react-query ĐANG GIỮ SỔ CỦA AI. Query PFM để `staleTime/gcTime: Infinity` (khối đầu tệp) và nút đăng xuất
 * KHÔNG dọn cache (`screens/Profile.tsx`) ⇒ đổi tên kho thôi là CHƯA ĐỦ: người B đăng nhập sau người A trên cùng tab sẽ
 * đọc sổ của A thẳng từ cache, không cần chạm IndexedDB. `KhoProvider` không dựng màn con khi cache thuộc chủ khác, dọn
 * `['pfm']` rồi mới dựng lại (bài `pfm_kho_tai_khoan.test.tsx`).
 */
let chuCache: string | null = null;

/**
 * KHO CHUNG cho người ĐỌC không đi qua provider — ô Tài chính của Hub (SPEC `ui-tang-khong-gian`): đọc sổ trên máy để vẽ
 * một con số, không cần `KhoProvider` (provider kéo theo hai driver đồng bộ mạng — Hub bị cấm thêm request). Dùng CHÍNH lượt
 * mở của provider (`moMotLuot`) nên không mở một kết nối IndexedDB thứ hai. Hỏng thì quên lượt mở (cùng nhánh lỗi của
 * `KhoProvider`) để lần đọc sau thử lại được chứ không nhớ mãi một lời hứa đã bị từ chối.
 */
export async function moKhoChung(chu: string): Promise<KhoPfm> {
  try {
    return await moMotLuot(chu);
  } catch (e) {
    if (motLuot?.chu === chu) motLuot = null;
    throw e;
  }
}

/** Chỉ cho test: quên lượt mở đang nhớ, để bài sau bắt đầu sạch. */
export function quenLuotMo(): void {
  motLuot = null;
  khoCoSan = null;
  chuCache = null;
  daXinGiuBen = null;
}

/**
 * BẢN DEMO "khách nâng cao" (link pitch deck, 28/09) — cả trang dùng kho CHO SẴN (trong bộ nhớ, sổ mẫu) thay cho IndexedDB:
 * không lưu gì xuống máy người xem, đóng tab là mất. Gọi TRƯỚC khi dựng app. App thật không gọi hàm này.
 */
export function dungKhoCoSan(k: KhoPfm): void {
  khoCoSan = Promise.resolve(k);
}

export function KhoProvider(
  { children, kho: khoDua }: { children: ReactNode; kho?: KhoPfm },
): React.ReactElement {
  const me = useMe();
  const chu = me.data?.user?.user_id ?? null;
  const qc = useQueryClient();
  const [ngu, datNgu] = useState<KhoNgu & { chu: string | null }>(() => khoDua
    ? { kho: khoDua, ben: khoDua.ben, loiMo: null, dangMo: false, chu: null }
    : { kho: null, ben: false, loiMo: null, dangMo: true, chu: null });

  useEffect(() => {
    if (khoDua) return;
    /*
     * Chưa biết là ai (đang hỏi `/me`, hoặc không có phiên) ⇒ KHÔNG mở kho nào. Mở "tạm" một kho chung là mở lại đúng
     * cái lỗ D603 vừa bịt.
     */
    if (!chu) {
      datNgu({ kho: null, ben: false, loiMo: null, dangMo: me.isPending, chu: null });
      return;
    }
    let con = true;
    /** Cache đang giữ sổ người khác ⇒ dọn TRƯỚC khi dựng lại màn con (lúc này màn con đã bị gỡ — xem dưới). */
    const nhanChu = (): void => {
      if (chuCache !== null && chuCache !== chu) qc.removeQueries({ queryKey: ['pfm'] });
      chuCache = chu;
    };
    void moMotLuot(chu).then(
      (k) => {
        if (!con) return;
        nhanChu();
        datNgu({ kho: k, ben: k.ben, loiMo: null, dangMo: false, chu });
      },
      (e: unknown) => {
        /*
         * ⚠⚠ RƠI VỀ KHO TẠM, KHÔNG DỰNG MÀN TRẮNG — nhưng NÓI RA. Ba cách hỏng của
         * `moKho` (không có IndexedDB · tab khác giữ kho · lỗi mở) đều là thứ người dùng
         * không tự sửa được ngay, và bắt họ nhìn một màn hình chết thì họ mất luôn cả
         * phiên. Thà sổ sống một phiên còn hơn app không mở được.
         * ⚠ `motLuot` phải QUÊN ĐI ở nhánh hỏng, không thì lời hứa-đã-từ-chối bị nhớ mãi
         *   và mọi lần thử lại sau (đóng tab kia rồi) vẫn nhận đúng lỗi cũ.
         */
        if (motLuot?.chu === chu) motLuot = null;
        if (!con) return;
        nhanChu();
        datNgu({
          kho: new KhoTrongBoNho(),
          ben: false,
          loiMo: e instanceof Error ? e.message : 'Không mở được kho trên máy.',
          dangMo: false,
          chu,
        });
      },
    );
    return () => { con = false; };
  }, [khoDua, chu, me.isPending, qc]);

  /*
   * ⚠⚠ GỠ MÀN CON khi cache đang thuộc CHỦ KHÁC (D603). Query PFM để `gcTime: Infinity` và vẫn trả `data` cũ khi
   * `enabled: false`, nên chỉ cần dựng màn con MỘT nhịp là sổ người trước hiện ra. Gỡ hẳn — không phải "kho = null" —
   * để không observer nào còn cầm kết quả cũ lúc `removeQueries` chạy (cùng bài học `useXoaSachKho` ghi bên dưới).
   */
  const cacheLa = !khoDua && chuCache !== null && chuCache !== chu;
  const khoSai = !khoDua && ngu.chu !== chu;
  const giaTri: KhoNgu = khoSai
    ? { kho: null, ben: false, loiMo: null, dangMo: chu !== null || me.isPending }
    : { kho: ngu.kho, ben: ngu.ben, loiMo: ngu.loiMo, dangMo: ngu.dangMo };

  return (
    <Ngu.Provider value={giaTri}>
      <KichDongBo kho={giaTri.kho} />
      {cacheLa ? null : children}
    </Ngu.Provider>
  );
}

/**
 * Điểm nối DUY NHẤT giữa kho và hai driver mạng (`dong_bo_kich.ts` — đọc khối đầu tệp
 * đó để biết vì sao nó nằm ở provider và vì sao cổng bằng bốn cửa consent).
 *
 * ⚠ Là một component con chứ không gọi hook thẳng trong `KhoProvider`: hook đọc `/me` qua
 * react-query, và giữ nó tách riêng để `KhoProvider` vẫn chỉ làm đúng một việc là cấp kho.
 * Không vẽ gì.
 */
function KichDongBo({ kho }: { kho: KhoPfm | null }): null {
  useKichDongBo(kho);
  return null;
}

/**
 * ⚠ NÉM khi đứng ngoài provider, không trả `null`. Trả `null` thì mọi hook phía dưới phải
 * có nhánh "chưa có kho", và cái nhánh ấy là chỗ dữ liệu đi lạc: một màn quên bọc provider
 * sẽ hiện sổ RỖNG chứ không hiện lỗi, và sổ rỗng là một câu trả lời trông rất hợp lý.
 */
export function useKhoNgu(): KhoNgu {
  const v = useContext(Ngu);
  if (v === null) throw new Error('useKhoNgu: thiếu <KhoProvider> ở trên cây.');
  return v;
}

/* ═══ 3. ĐỌC ═══════════════════════════════════════════════════════════════ */

function useNgan<T>(
  khoa: readonly unknown[], ngan: TenNgan, q: TruyVan | undefined,
  bien: (ds: BanGhi<T>[]) => T[],
): { data: T[]; dangTai: boolean; sanSang: boolean } {
  const { kho } = useKhoNgu();
  const r = useQuery({
    queryKey: khoa,
    // ⚠ `enabled` chờ kho — KHÔNG dựng kho tạm ở đây. Dựng ở đây là mỗi hook một kho.
    enabled: kho !== null,
    staleTime: Infinity,          // nguồn nằm trên máy này — xem khối đầu tệp
    gcTime: Infinity,
    queryFn: async () => bien(await kho!.liet<T>(ngan, q)),
  });
  // `sanSang` — xem `useHoSo` ngay dưới về vì sao `dangTai` một mình không trả lời được
  // câu "mảng rỗng này là sổ RỖNG hay là CHƯA ĐỌC" (D360).
  return { data: r.data ?? [], dangTai: r.isPending && kho !== null, sanSang: r.data !== undefined || r.isError };
}

/** Khoản của MỘT tháng. Mặc định tháng của máy (`thoi_gian.ts` là chỗ duy nhất đọc giờ). */
export function useSoThang(thang: string = thangNay()): { data: Khoan[]; dangTai: boolean; sanSang: boolean } {
  return useNgan<Khoan>(
    KHOA_PFM.khoanThang(thang), 'khoan', { thang },
    (ds) => locKhoanSo(ds.map((b) => b.d)),
  );
}

/**
 * ⭐ MỌI khoản, KHÔNG lọc tháng — dùng để tính `daGop` của hũ.
 *
 * ⚠⚠ HŨ CỘNG DỒN XUYÊN THÁNG, nên tính `daGop` từ sổ của MỘT tháng là ra một con số
 * nhỏ hơn sự thật, và nó nhỏ đi mỗi lần sang tháng mới — tiến độ hũ sẽ TỤT về gần 0 vào
 * ngày mùng 1 mà không có gì báo. `Hu` cố ý không cất `daGop` (một nguồn: `tongGopVaoHu`
 * tính từ sổ), nên chỗ nào cần nó thì phải đọc CẢ sổ.
 * ⚠ Khoá riêng `['pfm','khoan','__tat']` nhưng vẫn cùng tiền tố `['pfm','khoan']`, nên
 *   một cú ghi khoản vô hiệu hoá cả nó lẫn query theo tháng — xem `KHOA_PFM`.
 */
export function useSoTatCa(): { data: Khoan[]; dangTai: boolean; sanSang: boolean } {
  return useNgan<Khoan>(
    [...KHOA_PFM.ngan('khoan'), '__tat'], 'khoan', undefined,
    (ds) => locKhoanSo(ds.map((b) => b.d)),
  );
}

/**
 * ⚠ Hũ SỐNG XUYÊN THÁNG nên KHÔNG lọc theo `thang` — lọc là làm biến mất hũ tạo từ tháng
 * trước, tức đúng cái bẫy mà `KIEU_LAT.hu = 'song'` đã dựng ra để tránh.
 */
export function useHu(): { data: Hu[]; dangTai: boolean; sanSang: boolean } {
  return useNgan<Hu>(KHOA_PFM.hu, 'hu', undefined, (ds) => sapXep(ds.map((b) => b.d)));
}

/** Hũ con (PFM tầng không gian) — ngăn `hu_con`, CHỈ Ở MÁY. Sống xuyên tháng như hũ cha nên không lọc theo `thang`. */
export function useHuCon(): { data: HuCon[]; dangTai: boolean; sanSang: boolean } {
  return useNgan<HuCon>(KHOA_PFM.huCon, 'hu_con', undefined, (ds) => ds.map((b) => b.d));
}

export function useLuat(): { data: Luat[]; dangTai: boolean; sanSang: boolean } {
  return useNgan<Luat>(KHOA_PFM.luat, 'luat', undefined, (ds) => ds.map((b) => b.d));
}

/**
 * Mẫu lặp. ⚠ Trước D365 hook này trả `BanGhi<unknown>[]` vì ruột "thuộc GĐ2" chưa có hình —
 * nay `MauLap` đã là một kiểu thật trong `so.ts` và GIÚP 2 ghi vào đây, nên trả đúng kiểu.
 */
export function useMauLap(): { data: MauLap[]; dangTai: boolean } {
  return useNgan<MauLap>(KHOA_PFM.mauLap, 'mau_lap', undefined, (ds) => ds.map((b) => b.d));
}

/**
 * ⚠⚠ `dangTai` KHÔNG TRẢ LỜI ĐƯỢC CÂU "`data` NÀY CÓ PHẢI HỒ SƠ THẬT KHÔNG" — dùng `sanSang` (D360).
 *
 * `data` rơi về `{}` mỗi khi chưa có bản đọc nào, và có HAI cửa sổ như thế chứ không phải một:
 *   · kho ĐANG MỞ (`kho === null`) — lúc này `dangTai` = **false** (`isPending && kho !== null`), tức cờ "đang tải"
 *     TẮT đúng lúc chưa một byte nào được đọc. Mở app nguội thẳng vào một màn PFM là rơi vào đây;
 *   · kho mở rồi, lượt đọc đang bay — `dangTai` = true.
 * Màn nào VẼ NÚT GHI hay KỂ LẠI LỜI KHAI từ `data` mà chỉ cổng bằng `dangTai` thì hở cửa sổ thứ nhất: nó vẽ lộ trình
 * của một hồ sơ RỖNG, rồi mới tới khung chờ, rồi mới tới bản thật.
 *
 * `sanSang` = đã có MỘT bản đọc từ kho (kể cả hồ sơ rỗng THẬT), hoặc lượt đọc đã hỏng hẳn (không còn gì để chờ —
 * thà vẽ màn cho người dùng còn đường đi, và đường GHI thì đằng nào cũng đọc lại từ kho: `ho_so.ts` §`suaHoSo`).
 * ⚠ KHÔNG viết cổng kiểu `dangMo || dangTai`: mỗi màn PFM bọc một `<KhoProvider>` riêng và provider nào cũng có ít
 *   nhất một nhịp `kho === null`, KỂ CẢ khi kho đã mở từ màn trước — trong khi hồ sơ thật nằm sẵn trong cache
 *   (`gcTime: Infinity`). Cổng kiểu ấy vẽ một khung trắng ở MỌI lần chuyển màn. `sanSang` đọc thẳng cache nên không nháy.
 * ⚠ `dangTai` GIỮ NGUYÊN nghĩa cũ — `PhongVan`/`CamKet`/`NgayDau` đang đọc nó; đổi nghĩa một cờ dùng chung không
 *   thuộc việc của D360.
 */
export function useHoSo(): { data: HoSo; dangTai: boolean; sanSang: boolean } {
  const { kho } = useKhoNgu();
  const r = useQuery({
    queryKey: KHOA_PFM.hoSo,
    enabled: kho !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => docHoSo(kho!),
  });
  return {
    data: r.data ?? {},
    dangTai: r.isPending && kho !== null,
    sanSang: r.data !== undefined || r.isError,
  };
}

/**
 * Cài đặt TRÊN MÁY (`meta/cai_dat_may` — Tắt Gương · Tắt nhắc): một cửa đọc cho các màn (D453).
 * ⚠ Trước D453 GƯƠNG tự viết một `useQuery` cùng khoá với chỗ ghi (`CaiDatPfm` §KhoiKhac). Khối NÓI · LÀM · TRONG
 *   TRẬN dời sang THẺ cũng phải đọc công tắc — bản thứ ba của cùng phép đọc là bản sẽ trôi (A11.5).
 * ⚠ KHOÁ phải trùng chỗ ghi: khác khoá thì cú gạt công tắc không làm tươi màn đang mở.
 */
export function useCaiDatMay(): { data: CaiDatMay; sanSang: boolean } {
  const { kho } = useKhoNgu();
  const r = useQuery({
    queryKey: [...KHOA_PFM.ngan('meta'), ID_CAI_DAT_MAY],
    enabled: kho !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => (await kho!.doc<CaiDatMay>('meta', ID_CAI_DAT_MAY))?.d ?? CAI_DAT_MAY_MAC_DINH,
  });
  return { data: r.data ?? CAI_DAT_MAY_MAC_DINH, sanSang: r.data !== undefined || r.isError };
}

/* ═══ 4. GHI ═══════════════════════════════════════════════════════════════ */

export interface KetQuaGhi<T> { ok: true; gt: T }

/**
 * ⭐ GHI RỒI VÔ HIỆU HOÁ — và người gọi phải NÓI RÕ nó chạm ngăn nào.
 *
 * ⚠⚠ VÌ SAO KHÔNG TỰ ĐOÁN: một thao tác thật thường chạm nhiều ngăn cùng lúc — "góp vào
 * hũ" ghi một `khoan` VÀ sửa `hu`, "đặt luật" ghi `luat` VÀ xếp một món vào `outbox`. Đoán
 * hộ thì sẽ đoán thiếu, và cái thiếu ấy hiện ra thành **màn hình không đổi sau khi bấm** —
 * người dùng bấm lại, và thao tác chạy hai lần.
 * ⇒ Bắt khai `ngan` là bắt người viết dừng lại một giây ở đúng chỗ dễ sai.
 *
 * ⚠ Vô hiệu hoá theo TIỀN TỐ `['pfm', ngăn]` nên nó quét mọi tháng — xem `KHOA_PFM`.
 */
export function useGhiKho(): <T>(
  ngan: readonly TenNgan[], viec: (kho: KhoPfm) => Promise<T>,
) => Promise<T> {
  const { kho } = useKhoNgu();
  const qc = useQueryClient();
  return useCallback(async (ngan, viec) => {
    if (kho === null) throw new Error('useGhiKho: kho chưa mở xong.');
    const gt = await viec(kho);
    // ⚠ Vô hiệu hoá SAU khi ghi xong, không trước: hỏng giữa chừng thì cache cũ vẫn đúng
    //   hơn một cache rỗng, và người dùng còn nhìn thấy sổ của mình.
    await Promise.all(ngan.map((n) => qc.invalidateQueries({ queryKey: KHOA_PFM.ngan(n) })));
    return gt;
  }, [kho, qc]);
}

/**
 * ⭐⭐ XOÁ SẠCH (P9 🔒) — xoá kho VÀ dọn cache.
 *
 * ⚠⚠ KHÔNG DỌN CACHE LÀ CÚ XOÁ KHÔNG XẢY RA, DƯỚI MẮT NGƯỜI DÙNG. Kho trống nhưng
 * TanStack vẫn giữ mảng cũ trong bộ nhớ với `staleTime: Infinity` — nên màn hình tiếp tục
 * hiện đúng những dòng vừa được xoá, cho tới khi tải lại trang. Với một nút mang nhãn
 * "xoá sạch dữ liệu" thì đó không phải lỗi hiển thị: người dùng kết luận app **không xoá
 * thật**, và đó đúng là điều P9 tồn tại để bảo đảm điều ngược lại.
 * ⚠⚠ PHẢI LÀ `resetQueries`, KHÔNG PHẢI `removeQueries` — và tôi đã viết sai lần đầu.
 * Lý lẽ dẫn tôi tới `removeQueries` nghe rất xuôi (*"đọc lại một kho vừa xoá là tốn một
 * vòng cho một kết quả đã biết"*) nhưng nó bỏ quên một sự thật: **observer vẫn đang gắn
 * trên màn hình**. `removeQueries` gỡ mục khỏi cache, còn observer thì giữ nguyên kết quả
 * nó đang cầm — nên màn hình tiếp tục hiện đủ ba dòng vừa xoá. Chính bài §III bắt được
 * (`expected [ … ] to have a length of +0 but got 3`).
 * ⇒ `resetQueries` đưa query về trạng thái đầu VÀ nạp lại những query đang hoạt động. Cái
 *   "vòng thừa" mà tôi tiếc là một lượt đọc IndexedDB cục bộ — rẻ hơn nhiều so với việc
 *   người dùng tin rằng nút xoá của họ không chạy.
 */
export function useXoaSachKho(): () => Promise<void> {
  const { kho } = useKhoNgu();
  const qc = useQueryClient();
  return useCallback(async () => {
    if (kho === null) throw new Error('useXoaSachKho: kho chưa mở xong.');
    await kho.xoaSach();
    // Kho CHUNG cũ (trước D603) cũng là sổ trên máy này — điều khoản hứa xoá được thì xoá luôn, không mở, không đọc.
    await xoaKhoChungCu();
    await qc.resetQueries({ queryKey: ['pfm'] });
  }, [kho, qc]);
}

/** Kho thật cho người gọi ngoài React-query (driver đồng bộ, driver két). */
export function useKho(): KhoPfm | null {
  return useKhoNgu().kho;
}

/** Đếm nhanh — cho dải "còn N món chờ gửi" mà không tải cả ruột. */
export function useDemNgan(ngan: TenNgan): number {
  const { kho } = useKhoNgu();
  const r = useQuery({
    queryKey: [...KHOA_PFM.ngan(ngan), '__dem'],
    enabled: kho !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => kho!.dem(ngan),
  });
  return r.data ?? 0;
}

/** Gom mọi thứ cho một màn: kho + trạng thái bền — dùng khi cần cả hai. */
export function useTinhTrangKho(): { ben: boolean; loiMo: string | null; dangMo: boolean } {
  const { ben, loiMo, dangMo } = useKhoNgu();
  return useMemo(() => ({ ben, loiMo, dangMo }), [ben, loiMo, dangMo]);
}
