/**
 * PFM — DRIVER KÉT: mảnh cuối GĐ1, chỗ `gomLat` → `dongLat` → `raByte` → `POST /pfm/luu`
 * lần đầu tiên nối thành MỘT cú sao lưu, và chiều ngược lại thành một cú khôi phục.
 *
 * ⚠⚠ CÙNG KHUÔN VỚI `dong_bo_chay.ts` VÀ VÌ CÙNG MỘT LÝ DO: mọi module két khác đều
 * thuần (`ket.ts` không biết user là ai, `ket_may.ts` không gọi mạng, `api/pfm.ts` chuyên
 * chở chứ không quyết định). Nên **mọi quyết định bẩn tập trung ở đây**: lát nào bẩn, lát
 * nào được phép ghi, suất trong ngày tiêu cho lát nào trước, lỗi nào dừng và lỗi nào đi
 * tiếp. Một tệp có tác dụng phụ thì phải là MỘT tệp.
 *
 * ⚠⚠ VÀ NÓ KHÔNG BAO GIỜ NÉM. Được gọi từ `mount`/`visibilitychange` như driver đồng bộ:
 * ở đó một promise bị từ chối là `unhandledrejection` không ai bắt.
 */
import { ApiError } from '../api/client.js';
import { docKet, luuKet } from '../api/pfm.js';
import { ghiDo } from '../lib/telemetry.js';
import {
  PHIEN_BAN_KET, type BanGhi, type KhoPfm, type TenNgan,
} from './kho.js';
import {
  LAT_SONG, gomLat, hoaGiai, moLat, dongLat, nganCuaLat, thangGuiLen,
  type MaLat, type RuotLat,
} from './ket.js';
import { ID_KHOA_KET, docChia, latQuaLon, raByte, tuByte } from './ket_may.js';
import { ID_DEM_DONG_BO, conLuotKet, danhDauHetSuat, ghiNhanGui } from './dong_bo.js';
import { ID_CAI_DAT_MAY } from './cai_dat_may.js';
import { ID_HO_SO } from './ho_so.js';

/* ═══ 1. ⭐⭐⭐ NGĂN `meta` KHÔNG ĐƯỢC ĐI CẢ NẮM VÀO KÉT ═════════════════════ */

/** Sổ két nằm ở `meta` — xem `SoKet` bên dưới, và xem vì sao nó KHÔNG vào két. */
export const ID_SO_KET = 'ket_so';

/**
 * ⚠⚠⚠ BẢN GHI `meta` NÀO ĐƯỢC PHÉP VÀO KÉT — DANH SÁCH CHO PHÉP, HỎNG VỀ PHÍA ĐÓNG.
 *
 * `KIEU_LAT.meta = 'song'` nên `gomLat('song', …)` **đã** vốc cả ngăn `meta` vào lát.
 * Khai ấy đúng cho thứ `meta` SẼ chứa (hồ sơ hoàn cảnh `ctx_*`, cài đặt gương), nhưng
 * hôm nay `meta` chứa đúng ba thứ và **cả ba đều là đồ của MÁY NÀY**, không phải dữ liệu
 * người dùng. Ba cái hại, xếp theo độ nặng:
 *
 * 1. ⚠⚠ **`khoa_ket` là một `CryptoKey`, và `JSON.stringify` của nó là `{}`** (đo, không
 *    đoán). Nó đi vào ruột lát thành một bản ghi rỗng; tới ngày khôi phục, `hoaGiai` thấy
 *    bản trong két mới hơn ⇒ **ghi đè `{}` lên chìa thật**. Từ giây đó `docChia` trả một
 *    object rỗng và mọi cú đóng/mở két ném `TypeError: 2nd argument is not of type
 *    CryptoKey` — một câu không nhắc gì tới két, chìa, hay khôi phục.
 *    ⇒ Tức là: **cú khôi phục tự tay phá cái chìa vừa dùng để khôi phục**, đúng vào lúc
 *    người dùng vừa mất máy. Không có đường vòng nào sau đó.
 * 2. **`ket_so` (sổ ver) tự tham chiếu**: nó đổi SAU mỗi cú lưu, mà nó nằm trong lát
 *    `song` ⇒ lưu xong là lát lại bẩn ⇒ lưu lại ⇒ mãi mãi, đốt sạch suất mỗi ngày.
 * 3. **`dong_bo_dem`** là bộ đếm suất theo NGÀY của máy này; khôi phục nó lên máy khác là
 *    dán một hạn mức của hôm khác vào hôm nay.
 *
 * ⇒ Danh sách CHO PHÉP chứ không phải danh sách CẤM, và đó là lựa chọn có hướng: quên
 * thêm tên vào danh sách cho phép ⇒ một mẩu cài đặt không được sao lưu (phiền, sửa được);
 * quên thêm tên vào danh sách cấm ⇒ đúng ca (1) ở trên (mất sổ, không sửa được). Khi hai
 * kiểu quên không cân nhau thì phải hỏng về phía nhẹ hơn.
 * ⚠ `pfm_ket_chay.test.ts` §I đòi MỌI id `meta` của repo phải nằm ở một trong hai danh
 * sách — thêm một id mới mà không phân loại thì bài đó đỏ, không phải im lặng.
 */
export const META_VAO_KET: readonly string[] = [
  /*
   * Hồ sơ hoàn cảnh (G1) — **dữ liệu NGƯỜI DÙNG tự khai**, không phải đồ của máy, nên
   * nó là mục đầu tiên ở phía "được vào két". Mất nó là bắt người dùng trả lời lại ba
   * câu trên máy mới, mà ba câu ấy là thứ làm mọi chỉ số chi tiêu có nghĩa.
   * ⚠ Nó **không** tự tham chiếu như `ket_so`: hồ sơ chỉ đổi khi người dùng trả lời, không
   *   đổi sau mỗi cú lưu — nên nó làm lát `song` bẩn ĐÚNG MỘT LẦN rồi thôi, không
   *   sinh vòng lặp. Đó là ranh giới thật giữa hai danh sách, không phải "quan trọng hay
   *   không".
   */
  ID_HO_SO,
];

/** Đồ của máy này, cố ý KHÔNG vào két. Lý do từng cái ở khối trên. */
export const META_O_LAI_MAY: readonly string[] = [ID_KHOA_KET, ID_DEM_DONG_BO, ID_SO_KET, ID_CAI_DAT_MAY];

export function metaVaoKet(id: string): boolean {
  return META_VAO_KET.includes(id);
}

/**
 * ⚠⚠ LỌC HAI ĐẦU, VÀ HAI ĐẦU BẢO VỆ HAI THỨ KHÁC NHAU — đừng gộp thành một.
 *   · Lọc lúc GHI giữ cho **két** sạch: thứ không bao giờ vào thì không bao giờ ra.
 *   · Lọc lúc ĐỌC giữ cho **máy này** sống: một lát cũ (ghi trước bản vá này), một lát
 *     của bản app khác, hay một lát bị sửa tay vẫn có thể chở `khoa_ket` — và lúc đó
 *     máy đang khôi phục là máy chịu hậu quả.
 * Bỏ vế thứ hai vì "ta đã lọc lúc ghi rồi" là đúng cái lỗi D251 đã trả giá: một lá chắn
 * chỉ chắn được thứ đi qua nó.
 */
function locMeta(ds: readonly BanGhi<unknown>[]): BanGhi<unknown>[] {
  return ds.filter((b) => metaVaoKet(b.id));
}

/* ═══ 2. SỔ KÉT — `ver` server cấp + mốc đã lưu tới ═════════════════════════ */

export interface SoKet {
  /** `ver` mới nhất SERVER đã cấp cho từng lát (K11 — client không tự đặt). */
  ver: Record<MaLat, number>;
  /** Mốc `suaLuc` lớn nhất đã nằm trong bản đã lưu. Lát bẩn = có bản ghi mới hơn mốc này. */
  luuToi: Record<MaLat, string>;
  /**
   * Ngày gần nhất đã đếm một lát "kẹt" (tháng đóng hoặc quá lớn).
   *
   * ⚠⚠ MỘT LÁT KẸT THÌ KẸT VĨNH VIỄN — nó bẩn ở mọi lượt, mãi mãi. Mà driver chạy mỗi
   * lần mở app, nên đếm vô điều kiện là **12 dòng telemetry mỗi lần mở app cho mỗi
   * người** sau một cú khôi phục 12 tháng — vừa đốt trần 1 triệu request/tháng (A9), vừa
   * làm hỏng chính con số R5: nó sẽ đo "số lượt × số lát kẹt" chứ không phải "bao nhiêu
   * tháng người ta MUỐN ghi vào mà không được".
   * ⇒ Mỗi lát kể tối đa một lần mỗi ngày.
   */
  keuNgay: Record<MaLat, string>;
}

export async function docSoKet(kho: KhoPfm): Promise<SoKet> {
  const b = await kho.doc<SoKet>('meta', ID_SO_KET);
  if (b === null) return { ver: {}, luuToi: {}, keuNgay: {} };
  // `?? {}` cho sổ ghi bởi bản cũ (chưa có `keuNgay`) — không để `undefined` đi tiếp.
  return { ver: { ...b.d.ver }, luuToi: { ...b.d.luuToi }, keuNgay: { ...b.d.keuNgay ?? {} } };
}

async function ghiSoKet(kho: KhoPfm, so: SoKet, luc: string): Promise<void> {
  await kho.ghi('meta', { id: ID_SO_KET, thang: luc.slice(0, 7), suaLuc: luc, d: so });
}

/* ═══ 3. LÁT NÀO BẨN — suy ra, không đánh dấu ═══════════════════════════════ */

export interface LatBan {
  lat: MaLat;
  /** `suaLuc` mới nhất trong lát — mốc sẽ ghi vào sổ NẾU cú lưu thành công. */
  moiNhat: string;
}

/**
 * ⭐ "BẨN" SUY RA TỪ CHÍNH DỮ LIỆU, KHÔNG PHẢI MỘT CỜ RIÊNG.
 *
 * ⚠ Phương án cờ (`danhDauBan(lat)` gọi ở mỗi chỗ ghi) là bản sao thứ hai của một sự thật
 * đã có sẵn trong `suaLuc` — và A11.5 nói bản thứ hai SẼ trôi: quên gọi ở một đường ghi
 * là lát ấy không bao giờ được sao lưu nữa, im lặng, cho tới ngày người dùng cần nó.
 * Ở đây không có gì để quên gọi: có bản ghi mới hơn mốc đã lưu ⇒ bẩn.
 *
 * ⚠ KHAI ĐÚNG GIỚI HẠN: phép so dựa trên `suaLuc`, tức ĐỒNG HỒ MÁY. Máy bị chỉnh lùi giờ
 * thì bản ghi mới có mốc nhỏ hơn mốc đã lưu và lát trông như sạch. Cùng một giới hạn mà
 * `hoaGiai` đã khai (K8, luật 4) và cùng một lý do ta không giả vờ đây là hợp nhất hoàn
 * hảo — không phải một chỗ bị bỏ sót.
 */
export async function latBan(kho: KhoPfm, so: SoKet): Promise<LatBan[]> {
  const moi = new Map<MaLat, string>();
  const nhin = (lat: MaLat, suaLuc: string): void => {
    const c = moi.get(lat);
    if (c === undefined || suaLuc > c) moi.set(lat, suaLuc);
  };

  for (const n of nganCuaLat('song')) {
    const ds = await kho.liet(n, { keCaDaXoa: true });
    // ⚠ Đúng phép lọc của lúc GHI. Nếu chỗ này đếm cả `khoa_ket` thì lát `song` bẩn ngay
    //   sau khi rèn chìa, rồi cú lưu gửi đi một lát KHÔNG chứa nó ⇒ mốc không bao giờ
    //   đuổi kịp ⇒ lưu lại mỗi lượt, vĩnh viễn. Hai chỗ phải nhìn cùng một tập.
    for (const b of n === 'meta' ? locMeta(ds) : ds) nhin(LAT_SONG, b.suaLuc);
  }
  for (const n of nganCuaLat('thang')) {
    for (const b of await kho.liet(n, { keCaDaXoa: true })) nhin(b.thang, b.suaLuc);
  }

  return [...moi.entries()]
    .filter(([lat, m]) => m > (so.luuToi[lat] ?? ''))
    .map(([lat, moiNhat]) => ({ lat, moiNhat }));
}

/** Ruột một lát, đã lọc `meta`. Chỗ DUY NHẤT dựng nội dung đi lên dây. */
export async function gomRuot(kho: KhoPfm, lat: MaLat): Promise<RuotLat> {
  const loai = lat === LAT_SONG ? 'song' : 'thang';
  const tat: Partial<Record<TenNgan, BanGhi<unknown>[]>> = {};
  for (const n of nganCuaLat(loai)) {
    const ds = await kho.liet(n, { keCaDaXoa: true });
    tat[n] = n === 'meta' ? locMeta(ds) : ds;
  }
  return gomLat(loai, tat, loai === 'thang' ? lat : undefined);
}

/* ═══ 4. MỘT LƯỢT SAO LƯU ═══════════════════════════════════════════════════ */

export type VuongSaoLuu =
  | 'chua_co_chia' | 'khong_co_gi_moi' | 'het_suat_ngay'
  | 'chua_toi_may_chu' | 'may_chu_tu_choi' | 'ver_lech' | 'lat_qua_lon' | 'loi_may';

export interface KetQuaSaoLuu {
  daLuu: MaLat[];
  /** Lát bẩn nhưng thuộc tháng ĐÃ ĐÓNG — K10 không cho ghi. Đây là con số R5 chờ đo. */
  thangDong: number;
  /** Lát bẩn nhưng vượt `PFM.BLOB_MAX` — không cách nào gửi đi được. */
  quaLon: number;
  /** Lát bẩn còn lại chưa lưu được lượt này (hết suất, hoặc dừng vì lỗi cả lượt). */
  conBan: number;
  vuong?: VuongSaoLuu;
}

const KQ_RONG = (): KetQuaSaoLuu => ({ daLuu: [], thangDong: 0, quaLon: 0, conBan: 0 });

/**
 * ⭐ MỘT LƯỢT SAO LƯU. `thangSong` là tháng server cho phép ghi (`'YYYY-MM'`).
 *
 * ⚠⚠ MỘT LƯỢT ĐẦY ĐỦ TIÊU TRỌN SUẤT CỦA CẢ NGÀY — đo chứ không cảm tính: trần là
 * `PFM.SO_LAN_LUU_NGAY` = 2, mà một lượt bình thường có đúng hai lát bẩn (tháng đang
 * sống + `song`). Nên **mỗi suất tiêu nhầm là một lát không được sao lưu tới tận mai**,
 * và đó là lý do hai quyết định dưới đây không phải là dọn dẹp cho gọn:
 *   · lát tháng đã đóng bị **bỏ qua tại chỗ, không gửi đi** (K10 chắc chắn từ chối — gửi
 *     là biết trước sẽ mất một suất cho một câu trả lời đã biết);
 *   · lát tháng đang sống đi **TRƯỚC** lát `song`, vì tháng đang sống chở khoản chi vừa
 *     gõ (không dựng lại được) còn `song` chở hũ/luật (ít, đổi thưa).
 *
 * ⚠⚠ VÀ CHÍNH VÌ CÓ THỨ TỰ ƯU TIÊN ẤY MÀ **LỖI CỦA MỘT LÁT KHÔNG ĐƯỢC DỪNG CẢ LƯỢT.**
 * `song` đứng CUỐI hàng, nên mọi cú dừng giữa chừng đều bỏ đói đúng nó. Ranh giới:
 *   · lỗi của RIÊNG lát (quá lớn · `ver` lệch · server bảo tháng không sống) ⇒ **đi tiếp**;
 *   · lỗi của CẢ LƯỢT (mất mạng · hết suất · 5xx) ⇒ dừng, lát sau chắc chắn cũng hỏng.
 * Trộn hai loại này là cách một cái hũ không bao giờ được sao lưu vì một tháng quá to.
 *
 * ⚠ `thangSong` là câu trả lời của SERVER, không phải `thangNay()` của máy. Người gọi
 * hôm nay đưa giờ máy vào vì `/me` chưa trả trường ấy — sai lệch tối đa là một ngày quanh
 * mốc sang tháng, và hậu quả của sai lệch ấy chỉ là một cú 409 `thang_khong_song` **không
 * tốn suất** (R3 soi trước khi tiêu). Nên đây là chỗ chịu được xấp xỉ; đừng nhân tiện
 * dùng `thangNay()` cho những chỗ có thưởng đứng sau (K7).
 * ⚠⚠ NHẬN CẢ HAI HÌNH `'YYYY-MM'` VÀ `'YYYY-MM-01'`, và đó không phải chiều người gọi:
 * server lẫn `/me` đều nói bằng hình `-01` (`laThangHopLe`), còn mã lát trong máy là
 * `'YYYY-MM'`. Một tham số `string` nhận nhầm hình thì `b.lat === thangSong` sai với
 * **mọi** tháng ⇒ toàn bộ khoản chi rơi vào nhánh "tháng đã đóng", không lát nào được
 * gửi, mà hàm vẫn trả `vuong: undefined` — hỏng sạch nhưng trông y như thành công.
 */
export async function saoLuuMotLuot(
  kho: KhoPfm, ngay: string, luc: string, thangSong: string,
): Promise<KetQuaSaoLuu> {
  try {
    return await chayLuot(kho, ngay, luc, thangSong.slice(0, 7));
  } catch {
    /*
     * ⚠⚠ LƯỚI CUỐI, và nó cần thiết vì lời hứa ở đầu tệp phải đúng cho CẢ kho lẫn mật
     * mã chứ không chỉ cho lời gọi mạng: `kho.ghiLo` từ chối khi transaction IndexedDB
     * bị huỷ (hết dung lượng), `dongLat` ném nếu chìa đọc ra không phải `CryptoKey`.
     * Hàm này chạy từ `visibilitychange` — một promise bị từ chối ở đó là
     * `unhandledrejection` không ai bắt, giữa lúc người dùng đang ghi tiền.
     * ⚠ Nuốt ở đây KHÔNG phải nuốt im lặng: `vuong` đi ra ngoài và người gọi (GĐ2/GĐ5)
     * có trách nhiệm nói ra. Chỗ này chỉ đổi một cú nổ lấy một câu trả lời.
     */
    return { ...KQ_RONG(), vuong: 'loi_may' };
  }
}

async function chayLuot(
  kho: KhoPfm, ngay: string, luc: string, thangSong: string,
): Promise<KetQuaSaoLuu> {
  const kq = KQ_RONG();

  const khoa = await docChia(kho);
  /*
   * ⚠ `instanceof`, KHÔNG PHẢI `!== null`. Một máy đã dính bản lỗi cũ (chìa bị ghi đè
   * thành `{}` lúc khôi phục — xem §1) đọc ra một object rỗng **không null**: `docChia`
   * trả nó, `dongLat` ném một lỗi mật mã, và người dùng thấy app chết chứ không thấy
   * "chưa có chìa". Kiểm đúng thứ mình cần, đừng kiểm thứ mình mong.
   */
  if (!(khoa instanceof CryptoKey)) return { ...kq, vuong: 'chua_co_chia' };

  const so = await docSoKet(kho);
  const ban = await latBan(kho, so);
  if (ban.length === 0) return { ...kq, vuong: 'khong_co_gi_moi' };

  /*
   * ⚠ ĐẾM THÁNG ĐÃ ĐÓNG RỒI MỚI BỎ (R5). K10 nói *"tháng đã qua thì đóng băng"*, và giá
   * của nó là: ghi bù cho tháng trước KHÔNG BAO GIỜ sao lưu được. Ta không nới luật ở đây
   * — nới là mở lại đúng chỗ K10 sinh ra để đóng. Ta ĐO: `pfm_ket_thang_dong` mang số
   * tháng lùi (1 = tháng trước), nên khi bàn lại sẽ bàn trên một con số thật thay vì trên
   * cảm giác. Bỏ mà không đếm thì cái giá này vô hình vĩnh viễn.
   */
  const ghiDuoc: LatBan[] = [];
  for (const b of ban) {
    if (b.lat === LAT_SONG || b.lat === thangSong) { ghiDuoc.push(b); continue; }
    kq.thangDong++;
    keuKet(so, ngay, b.lat, 'pfm_ket_thang_dong', { lui: soThangLui(b.lat, thangSong) });
  }
  // Tháng đang sống trước, `song` sau — xem khối chú thích của hàm.
  ghiDuoc.sort((a, b) => (a.lat === LAT_SONG ? 1 : 0) - (b.lat === LAT_SONG ? 1 : 0));

  let vuong: VuongSaoLuu | undefined;
  /**
   * Lý do của lát HỎNG gần nhất — chỉ dùng khi cả lượt không lưu nổi lát nào.
   *
   * ⚠⚠ THIẾU BIẾN NÀY LÀ MỘT CÚ "THÀNH CÔNG" GIẢ. Từ lúc lỗi-một-lát không còn dừng cả
   * lượt, một lượt mà lát DUY NHẤT của nó ăn 409 sẽ trả `daLuu: []` với `vuong:
   * undefined` — người gọi đọc ra "không có gì để làm", trong khi sự thật là "có, và nó
   * hỏng". `vuong` phải trả lời được câu *"vì sao lượt này chẳng được gì"*.
   */
  let vuongLat: VuongSaoLuu | undefined;
  let conBan = 0;
  for (const { lat, moiNhat } of ghiDuoc) {
    if (vuong !== undefined) { conBan++; continue; }     // đã dừng vì lỗi CẢ LƯỢT
    if (!await conLuotKet(kho, ngay)) { vuong = 'het_suat_ngay'; conBan++; continue; }

    const byte = raByte(await dongLat(lat, await gomRuot(kho, lat), khoa));
    /*
     * ⚠ ĐO TRÊN PHONG BÌ, KHÔNG DÙNG `kiemTran`. `kiemTran` cộng `goi + iv` — thiếu đúng
     * 1 byte định dạng ở đầu phong bì, nên một lát nằm khít trần lọt qua nó rồi ăn 413 ở
     * `chanContentLength(PFM.BLOB_MAX)`.
     * ⚠⚠ VÀ QUÁ LỚN LÀ PHÁN QUYẾT VỀ RIÊNG LÁT NÀY — đi tiếp, KHÔNG dừng cả lượt. Bản
     * đầu tôi viết dừng, và cái giá của nó là ca tệ nhất cả tệp: một tháng dày quá trần
     * chặn đứng `song` (hũ — *"thứ duy nhất trong sổ mà mất đi thì không dựng lại nổi từ
     * đâu"*) cho tới hết tháng, rồi sang tháng sau chính nó thành tháng đóng và mất
     * luôn. **Hai lát mất vì một lát to.**
     */
    if (latQuaLon(byte)) {
      kq.quaLon++;
      vuongLat = 'lat_qua_lon';
      keuKet(so, ngay, lat, 'pfm_ket_qua_lon', { kb: Math.round(byte.length / 1024) });
      continue;
    }

    let dap;
    try {
      dap = await luuKet(thangGuiLen(lat), PHIEN_BAN_KET, so.ver[lat] ?? 0, byte);
    } catch (e) {
      const doc = docLoiLuu(e, lat, so, kq, ngay);
      if (doc.dungHet) { vuong = doc.vuong; conBan++; } else { vuongLat = doc.vuong; }
      // Server bảo hết suất mà máy tưởng còn ⇒ đồng bộ lại bộ đếm, đừng gọi lại cả ngày.
      if (doc.vuong === 'het_suat_ngay') await danhDauHetSuat(kho, ngay, 'ket', luc);
      continue;
    }
    /*
     * ⚠⚠ KIỂM HÌNH PHẢN HỒI TRƯỚC KHI TIN NÓ. `api()` đọc thân bằng
     * `res.json().catch(() => null)`, nên **một 200 có thân KHÔNG PHẢI JSON trả về
     * `null`** — chuyện thường trên PWA: trang chặn của wifi khách sạn, trang lỗi HTML
     * của CDN, service worker trả vỏ app cho một đường `/api`. Đọc thẳng `dap.ver` là
     * ném từ một hàm đã hứa không ném; mà ghi một `ver` không phải số vào sổ còn tệ hơn:
     * lượt sau gửi `ver=NaN` rồi ăn 400 `ver_khong_hop_le` **mãi mãi**.
     */
    if (typeof dap?.ver !== 'number') { vuong = 'may_chu_tu_choi'; conBan++; continue; }
    so.ver[lat] = dap.ver;
    /*
     * ⚠ MỐC LÀ `moiNhat` ĐO TRƯỚC KHI GỬI, KHÔNG PHẢI `luc` — mốc của THỨ ĐÃ GỬI, không
     * phải của giờ chạy. Xem bài "đồng hồ lùi" trong `pfm_ket_chay.test.ts` §V.
     */
    so.luuToi[lat] = moiNhat;
    kq.daLuu.push(lat);
    await ghiNhanGui(kho, ngay, 'ket', luc);
  }

  kq.conBan = conBan;
  // Không dừng cả lượt, nhưng cũng chẳng lưu nổi gì ⇒ nói ra lý do của lát hỏng cuối.
  if (vuong === undefined && kq.daLuu.length === 0) vuong = vuongLat;
  // ⚠ Ghi sổ MỘT LẦN ở cuối, kể cả khi dừng giữa chừng: `ver` server đã cấp cho lát vừa
  //   lưu (và `ver` thật đọc được từ một cú 409) phải sống sót, không thì lượt sau gửi
  //   lại `ver` cũ và ăn 409 mãi.
  await ghiSoKet(kho, so, luc);
  return vuong === undefined ? kq : { ...kq, vuong };
}

/**
 * Phát telemetry cho một lát KẸT — **tối đa một lần mỗi ngày mỗi lát**.
 *
 * ⚠⚠ MỘT LÁT KẸT THÌ KẸT VĨNH VIỄN: nó bẩn ở mọi lượt, mãi mãi. Mà driver chạy mỗi lần
 * mở app, nên đếm vô điều kiện là **12 dòng telemetry mỗi lần mở app cho mỗi người** sau
 * một cú khôi phục 12 tháng — vừa đốt trần 1 triệu request/tháng (A9), vừa làm hỏng
 * chính con số R5: nó sẽ đo *"số lượt × số lát kẹt"* chứ không phải *"bao nhiêu THÁNG
 * người ta muốn ghi vào mà không được"*, và chỉ có vế sau mới trả lời được câu hỏi.
 */
function keuKet(
  so: SoKet, ngay: string, lat: MaLat,
  loai: 'pfm_ket_thang_dong' | 'pfm_ket_qua_lon', chiTiet: Record<string, number>,
): void {
  if (so.keuNgay[lat] === ngay) return;
  so.keuNgay[lat] = ngay;
  ghiDo(loai, { chi_tiet: chiTiet });
}

/** Số tháng lùi so với tháng đang sống — `1` là tháng liền trước. */
export function soThangLui(lat: MaLat, thangSong: string): number {
  const [ly, lm] = [Number(lat.slice(0, 4)), Number(lat.slice(5, 7))];
  const [sy, sm] = [Number(thangSong.slice(0, 4)), Number(thangSong.slice(5, 7))];
  return (sy - ly) * 12 + (sm - lm);
}

/**
 * Dịch lỗi của `/pfm/luu`, và nói rõ **lỗi này của riêng lát hay của cả lượt**.
 *
 * ⚠⚠ `dungHet` LÀ RANH GIỚI ĐẮT NHẤT CỦA HÀM. `song` đứng cuối hàng ưu tiên, nên mỗi lần
 * dừng nhầm là một lần bỏ đói đúng nó. Quy tắc: 4xx là phán quyết về **món này** (lát sau
 * vẫn có cửa); mất mạng · hết suất · 5xx là phán quyết về **cả lượt** (lát sau chắc chắn
 * cũng hỏng, và thử tiếp chỉ tốn suất).
 * ⚠ 409 `ver_cu` còn **cập nhật `ver` thật server nói ra**, nên lượt sau gửi đúng số thay
 * vì lặp lại cùng một cú sai.
 */
function docLoiLuu(
  e: unknown, lat: MaLat, so: SoKet, kq: KetQuaSaoLuu, ngay: string,
): { vuong: VuongSaoLuu; dungHet: boolean } {
  if (!(e instanceof ApiError)) return { vuong: 'loi_may', dungHet: true };
  if (e.chuaToiMayChu) return { vuong: 'chua_toi_may_chu', dungHet: true };
  if (e.status === 429) return { vuong: 'het_suat_ngay', dungHet: true };
  if (e.status >= 500) return { vuong: 'may_chu_tu_choi', dungHet: true };

  if (e.status === 409 && e.code === 'ver_cu') {
    const than = e.body as { ver?: unknown } | null | undefined;
    if (typeof than?.ver === 'number') so.ver[lat] = than.ver;
    return { vuong: 'ver_lech', dungHet: false };
  }
  if (e.status === 409 && e.code === 'thang_khong_song') {
    /*
     * Máy tưởng tháng này còn sống, server bảo không (lệch múi giờ quanh mốc sang tháng,
     * hoặc máy sai giờ). Vẫn là một lần K10 chặn ⇒ vẫn phải đếm, không thì con số R5 chỉ
     * đếm được những ca máy tự đoán ra — tức thiếu đúng phần khó thấy nhất.
     */
    kq.thangDong++;
    keuKet(so, ngay, lat, 'pfm_ket_thang_dong', { lui: 0 });
    return { vuong: 'may_chu_tu_choi', dungHet: false };
  }
  return { vuong: 'may_chu_tu_choi', dungHet: false };
}

/* ═══ 5. KHÔI PHỤC ══════════════════════════════════════════════════════════ */

export interface KetQuaKhoiPhuc {
  /** Lát thật sự có trên server và mở được. */
  lat: MaLat[];
  them: number;
  thay: number;
  giu: number;
  /** Id bản ghi trùng mốc mà khác ruột — phải kể lại cho người dùng (K8 luật 4). */
  can: string[];
  /**
   * Lát CÓ trên server mà KHÔNG mở được (sai chìa · phong bì hỏng · schema mới hơn).
   *
   * ⚠⚠ TRƯỜNG NÀY TỒN TẠI VÌ MỘT CÚ KHÔI PHỤC KHUYẾT KHÔNG ĐƯỢC PHÉP TRÔNG NHƯ ĐẦY ĐỦ.
   * Ca thật: `song` mở được, 12 lát tháng đều hỏng ⇒ người dùng thấy lại hũ của mình,
   * thấy sổ trống trơn, và **không có gì trên màn hình nói rằng 12 lát đã thất bại**.
   * Không có con số này thì màn Cài đặt (GĐ5) không có cách nào nói ra, kể cả khi muốn.
   */
  hong: number;
  vuong?: 'chua_toi_may_chu' | 'may_chu_tu_choi' | 'khong_mo_duoc';
}

/**
 * ⭐ KHÔI PHỤC nhiều lát. `khoa` do người gọi đưa (`khoiPhucChia` vừa rèn từ mã người
 * dùng gõ) — hàm này không rèn chìa và không đụng tới mã.
 *
 * ⚠⚠ KHÔNG DỪNG Ở LÁT ĐẦU TIÊN KHÔNG MỞ ĐƯỢC... nhưng CÓ dừng khi mất mạng. Hai chuyện
 * khác nhau: một lát hỏng là một lát hỏng (mười một lát kia vẫn là sổ của người ta, và
 * khôi phục được 11/12 tốt hơn hẳn 0/12); mất mạng giữa chừng thì mọi lát sau đều sẽ
 * "không có" — đi tiếp chỉ để dựng một bản khôi phục KHUYẾT trông như đầy đủ.
 */
export async function khoiPhucTuKet(
  kho: KhoPfm, khoa: CryptoKey, latDs: readonly MaLat[], luc: string,
): Promise<KetQuaKhoiPhuc> {
  const kq: KetQuaKhoiPhuc = { lat: [], them: 0, thay: 0, giu: 0, can: [], hong: 0 };
  const so = await docSoKet(kho);

  for (const lat of latDs) {
    let ban;
    try {
      ban = await docKet(thangGuiLen(lat));
    } catch (e) {
      const chuaToi = e instanceof ApiError && e.chuaToiMayChu;
      await ghiSoKet(kho, so, luc);
      return { ...kq, vuong: chuaToi ? 'chua_toi_may_chu' : 'may_chu_tu_choi' };
    }
    if (ban === null) continue;

    /*
     * ⚠⚠ KÉT GHI BỞI MỘT KHO MỚI HƠN THÌ TỪ CHỐI, ĐỪNG TRỘN. `schema_v` được gửi đi và
     * trả về đúng để phát hiện chuyện này — nhận nó rồi bỏ qua là dựng một cái cảm biến
     * không nối vào đâu. Ca thật: máy A nâng lên kho v3 rồi sao lưu; máy B còn v2 (service
     * worker cũ giữ bản cũ — `kho.ts` đã ghi đây là hiểm hoạ sống) khôi phục về. Trộn
     * bản ghi hình v3 vào kho v2 là hỏng dữ liệu THẬT, và `moLat` không hề biết: nó giải
     * mã thành công, JSON hợp lệ, chỉ có hình bên trong là của tương lai.
     */
    if (ban.schemaV > PHIEN_BAN_KET) { kq.hong++; continue; }

    let ruot: RuotLat;
    try {
      ruot = await moLat(tuByte(lat, new Uint8Array(ban.than)), khoa);
    } catch {
      // Sai chìa, phong bì cụt, hay định dạng lạ — ghi nhận rồi đi tiếp (xem khối trên).
      kq.hong++;
      continue;
    }
    /*
     * ⚠ `ver` server vừa nói ra ở `X-Pfm-Ver`. Không nhặt nó thì máy vừa khôi phục xong
     * cầm `ver = 0`, và cú sao lưu đầu tiên chắc chắn ăn 409 — không mất suất (R3), nhưng
     * là một vòng mạng thừa và một màn hình báo lỗi cho một máy đang hoàn toàn khoẻ.
     */
    so.ver[lat] = ban.ver;
    kq.lat.push(lat);

    const loai = lat === LAT_SONG ? 'song' : 'thang';
    let daDoi = false;
    for (const n of nganCuaLat(loai)) {
      /*
       * ⚠ `Array.isArray`, không phải `?? []`. `moLat` trả `JSON.parse(...) as RuotLat` —
       * một khẳng định kiểu, không phải một phép kiểm. Một lát méo (`"khoan": {}`) làm
       * `hoaGiai` ném từ trong vòng lặp `for...of`, và lưới cuối của hàm gọi sẽ nuốt
       * nguyên cú khôi phục thay vì bỏ đúng một ngăn.
       */
      const tho = ruot[n];
      const co = Array.isArray(tho) ? tho : [];
      const tuKet = n === 'meta' ? locMeta(co) : co;
      const dangCo = await kho.liet(n, {
        keCaDaXoa: true, ...(loai === 'thang' ? { thang: lat } : {}),
      });
      const h = hoaGiai(dangCo, tuKet);
      kq.them += h.them; kq.thay += h.thay; kq.giu += h.giu; kq.can.push(...h.can);
      if (h.them + h.thay > 0) { await kho.ghiLo(n, h.ra); daDoi = true; }
    }
    /*
     * ⚠ TRỘN CÓ ĐỔI THÌ LÁT COI NHƯ CHƯA LƯU — cố ý xoá mốc `luuToi`. Trộn xong thì nội
     * dung trên máy KHÁC với nội dung trong két (nó có thêm phần chỉ máy này có, luật 2
     * của K8), nên giữ mốc là nói dối và phần chênh ấy sẽ không bao giờ được đẩy lên.
     * ⚠⚠ NHƯNG CHỈ KHI CÓ ĐỔI. Xoá vô điều kiện là làm **mọi** lát vừa đọc thành bẩn
     * vĩnh viễn — kể cả 12 tháng đã đóng mà K10 không bao giờ cho ghi lại. Lúc đó mỗi
     * lần mở app là 12 lát kẹt được đếm lại, và con số R5 đo thành "số lượt × số lát"
     * thay vì "số tháng người ta muốn ghi vào".
     */
    if (daDoi) delete so.luuToi[lat];
  }

  await ghiSoKet(kho, so, luc);
  return kq.hong > 0 && kq.lat.length === 0 ? { ...kq, vuong: 'khong_mo_duoc' } : kq;
}

/**
 * Danh sách lát để khôi phục: `song` + `so` tháng gần nhất tính từ `thangNay` (§B6 mở
 * 12 tháng). `song` đi TRƯỚC — nó chở hũ/luật, thứ mọi màn hình cần để vẽ được cái gì đó
 * ngay cả khi các lát tháng phía sau hỏng hoặc mạng đứt giữa chừng.
 */
export function latDeKhoiPhuc(thangNay: string, so = 12): MaLat[] {
  const y = Number(thangNay.slice(0, 4));
  const m = Number(thangNay.slice(5, 7));
  const ra: MaLat[] = [LAT_SONG];
  for (let i = 0; i < so; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    ra.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return ra;
}
