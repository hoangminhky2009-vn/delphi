/**
 * PFM — ĐỒNG BỘ: hàng đợi ra server (K11). Thuần + không tự gọi mạng.
 *
 * ⚠⚠ MƯỢN KHUÔN HÀNG ĐỢI TELEMETRY **CHỈ Ở PHẦN GỘP LÔ**, và tuyệt đối không mượn phần
 * *"đầy thì vứt cái cũ nhất"*. Telemetry được phép mất dòng (A9 — giá trị của nó ở XU
 * HƯỚNG); nhịp PFM đi vào `events` APPEND-ONLY thì không. Một hàng đợi tự vứt là cách
 * mất dữ liệu êm ái nhất tồn tại: không lỗi, không log, chỉ là vài dòng không bao giờ tới.
 *
 * ⚠⚠ VÀ ĐÂY LÀ CHỖ HAI LOẠI MÓN PHẢI ĐI HAI ĐƯỜNG — trộn chúng là hỏng một trong hai:
 *
 *   **GÓI ĐẶC TRƯNG** (`goi`) — ảnh chụp GỘP của một KỲ. Gói mới của cùng một kỳ **THAY**
 *   gói cũ, vì server chỉ cần bản mới nhất; giữ cả hai là gửi hai lần cùng một sự thật.
 *   Nhờ vậy hàng đợi bị chặn theo SỐ KỲ (một tá), không theo số lần mở app.
 *
 *   **NHỊP** (`nhip`) — một SỰ KIỆN đã xảy ra, đích đến là `events` append-only. Không
 *   gộp được, không thay được, không bao giờ được vứt. Mỗi dòng mất đi là một sự kiện
 *   không thể dựng lại.
 *
 * ⚠ KHÔNG ĐỌC ĐỒNG HỒ (nối tiếp `kho.ts`/`ket.ts`): "hôm nay" và mốc thời gian do người
 * gọi đưa vào.
 */
import { PFM, PFM_LO } from '@config/pfm';
import { type MonLo, type DongGoiLo } from '@config/pfm_dong_bo';
import { type KhoPfm } from './kho.js';
import { soiGoi, type GoiDacTrung } from './dac_trung.js';

export class LoiDongBo extends Error {}

/* ═══ 1. MÓN TRONG HÀNG ĐỢI ═══════════════════════════════════════════════════ */

export type MonHangDoi =
  | { loai: 'goi'; ky: string; goi: GoiDacTrung }
  /** `ma` là một `action_type` họ `pfm_*`; `v` chỉ chở id + enum (K5). */
  | { loai: 'nhip'; ma: string; v: Record<string, string | number | boolean> };

/** Khoá gộp: gói gộp theo KỲ, nhịp thì mỗi dòng một khoá riêng ⇒ không bao giờ gộp. */
export function khoaMon(m: MonHangDoi, idRieng: string): string {
  return m.loai === 'goi' ? `goi:${m.ky}` : `nhip:${idRieng}`;
}

/* ═══ 1-bis. RA DÂY ═══════════════════════════════════════════════════════════ */

/**
 * ⭐ MÓN TRONG MÁY → MÓN TRÊN DÂY (`MonLo` ở `config/pfm_dong_bo.ts`).
 *
 * ⚠⚠ HAI HÌNH KHÁC NHAU LÀ CÓ CHỦ ĐÍCH, KHÔNG PHẢI SƠ SUẤT. Trong máy dùng camelCase
 * và ôm nguyên `GoiDacTrung` — đó là hình thuận cho code client. Trên dây dùng
 * snake_case, phẳng, và mang thêm `id`: đó là **giao ước** với server, khai ở `config/`
 * để cả hai bên đọc cùng một chỗ. Hàm này là chỗ DUY NHẤT hai hình gặp nhau; mọi chỗ
 * khác chỉ được thấy một trong hai.
 *
 * ⚠⚠ VÀ ĐÂY LÀ CHỖ ĐÃ SINH RA R8. Trước D251 client gom lô theo hình của nó, server
 * nhận theo hình của nó, không ai viết hàm này — nên hai đầu dây mỗi bên tự nhất quán
 * mà **không bao giờ nối được**, và cái sai chỉ lộ ra khi thử nối. Bảy endpoint PFM
 * sống suốt hai đợt mà không có một client nào gọi.
 *
 * ⚠ `id` PHẢI là khoá hàng đợi (`khoaMon`), không phải một id mới sinh: server dùng nó
 * làm khoá chống trùng cấp món cho `nhip` (migration 0056), và khoá ấy chỉ có tác dụng
 * nếu nó **ổn định qua các lần gửi lại**. Sinh id mới mỗi lần gửi là vô hiệu hoá cả
 * bảng chống trùng, im lặng.
 */
export function raWire(m: MonHangDoi, id: string): MonLo {
  if (m.loai === 'nhip') return { id, loai: 'nhip', ma: m.ma, v: m.v };
  return {
    id, loai: 'goi', ky: m.ky, schema_v: m.goi.schemaVersion,
    dong: m.goi.dong.map((d): DongGoiLo => (
      /*
       * ⚠ `doi_tuong` chỉ đặt khi CÓ. Gửi `doi_tuong: undefined` thì `JSON.stringify`
       * bỏ khoá đi (may), nhưng gửi `''` thì server đọc là "có đối tượng tên rỗng" và
       * `kiemDongDacTrung` từ chối mọi mã khai `theo_doi_tuong: false`. Đừng dựa vào
       * cái may đó — không đặt khoá là ý định rõ ràng.
       */
      d.doiTuong === undefined || d.doiTuong === ''
        ? { ma: d.ma, gia_tri: d.giaTri }
        : { ma: d.ma, gia_tri: d.giaTri, doi_tuong: d.doiTuong }
    )),
  };
}

/* ═══ 2. XẾP HÀNG ═════════════════════════════════════════════════════════════ */

export interface KetQuaXepHang {
  nhan: boolean;
  /** `true` khi món mới ĐÈ một gói cũ cùng kỳ (không phải thêm dòng). */
  thay: boolean;
  /** Số món đang chờ SAU thao tác này — người gọi cần nó để cảnh báo user. */
  dangCho: number;
}

/**
 * ⚠ Gói ĐÈ theo kỳ; nhịp thì không bao giờ đè. Xem chú thích đầu file.
 * ⚠ `thang` của bản ghi hàng đợi là tháng của KỲ (gói) hoặc tháng người gọi đưa (nhịp) —
 * nó chỉ để kho xếp chỗ, không mang ý nghĩa nghiệp vụ ở đây.
 */
export async function xepHang(
  kho: KhoPfm, m: MonHangDoi, luc: string, idRieng: string, thang: string,
): Promise<KetQuaXepHang> {
  if (m.loai === 'goi') {
    const loi = soiGoi(m.goi);
    /*
     * ⚠ SOI TRƯỚC KHI XẾP HÀNG, không soi lúc gửi. Một gói hỏng nằm trong hàng đợi sẽ bị
     * server từ chối lặp đi lặp lại và **chặn đứng mọi món phía sau** — hàng đợi tắc vì
     * một dòng mà không ai nhìn thấy. Chặn ở cửa vào thì lỗi có địa chỉ.
     */
    if (loi.length > 0) throw new LoiDongBo(`Gói kỳ ${m.ky} không hợp lệ: ${loi[0]}`);
  }
  const khoa = khoaMon(m, idRieng);
  const daCo = await kho.doc<MonHangDoi>('outbox', khoa);
  await kho.ghi('outbox', { id: khoa, thang, suaLuc: luc, d: m });
  return { nhan: true, thay: daCo !== null, dangCho: await kho.dem('outbox') };
}

/* ═══ 3. LẤY MỘT LÔ ═══════════════════════════════════════════════════════════ */

export interface Lo {
  ids: string[];
  mon: MonHangDoi[];
  /** Chính thứ đi lên dây — người gọi không phải tự chuyển lần nữa. */
  than: MonLo[];
  /** Số byte thân request ước tính — người gọi không phải đoán lại. */
  byte: number;
  /** Còn món chưa vào lô này (hàng đợi dài hơn một lô). */
  conNua: boolean;
}

/**
 * Gom một lô: cũ trước, và cắt theo **CẢ HAI** trần — số món và SỐ BYTE.
 *
 * ⚠⚠ CẮT THEO BYTE LÀ PHẦN KHÔNG ĐƯỢC QUÊN, và repo đã trả giá cho đúng chỗ này: D146
 * tìm ra `BACKUP_PAGE` đếm **DÒNG chứ không đếm BYTE**, nên một trang có thể là hàng
 * trăm MB và bản vá "viết dòng chảy" không chặn nổi. Ở đây cùng cái bẫy: 50 nhịp bé tí
 * thì vô hại, nhưng 50 gói đặc trưng của 50 kỳ thì vượt trần thân request — và request
 * bị nền tảng cắt là **hỏng im lặng**.
 * ⚠ Một món ĐƠN LẺ mà đã quá trần thì vẫn cho đi (lô một món): giữ nó lại là để hàng đợi
 * tắc vĩnh viễn vì một dòng không bao giờ vừa.
 */
export async function layLo(kho: KhoPfm): Promise<Lo> {
  const tat = await kho.liet<MonHangDoi>('outbox');   // `locSo` đã sắp cũ→mới
  const ids: string[] = []; const mon: MonHangDoi[] = []; const than: MonLo[] = [];
  let byte = 2;                                       // dấu ngoặc của mảng JSON
  let dong = 0;
  for (const b of tat) {
    if (ids.length >= PFM_LO.SU_KIEN_MOI_LO) break;
    /*
     * ⚠ ĐO BYTE TRÊN HÌNH ĐI LÊN DÂY, không phải hình trong máy. Hai hình khác nhau
     * (`id` thêm vào, khoá đổi tên), nên đo bản trong máy là đo một thứ không ai gửi —
     * và trần `content-length` của server thì áp lên bản THẬT. Sai chiều nào cũng hỏng:
     * đo thiếu thì lô bị 413, đo thừa thì lô nhỏ hơn cần thiết.
     */
    const w = raWire(b.d, b.id);
    const co = JSON.stringify(w).length + 1;
    if (ids.length > 0 && byte + co > PFM_LO.THAN_TOI_DA) break;
    /*
     * ⚠ Trần DÒNG của cả lô (server đếm y hệt, `PFM_LO.DONG_MOI_LO`). Không cắt ở đây
     * thì lô đi lên rồi ăn 400 nguyên khối — mà 400 là lỗi TẤT ĐỊNH nên client sẽ bỏ
     * sạch cả lô theo giao ước `XAC_NHAN_BO_HET`. Tức mất dữ liệu vì một phép đếm.
     */
    const donMon = w.loai === 'goi' ? w.dong.length : 1;
    if (ids.length > 0 && dong + donMon > PFM_LO.DONG_MOI_LO) break;
    ids.push(b.id); mon.push(b.d); than.push(w); byte += co; dong += donMon;
  }
  return { ids, mon, than, byte, conNua: tat.length > ids.length };
}

/* ═══ 4. XÁC NHẬN ═════════════════════════════════════════════════════════════ */

/**
 * ⚠⚠ BỎ MÓN KHỎI HÀNG ĐỢI **CHỈ SAU KHI SERVER XÁC NHẬN**, không phải lúc gửi đi. Bỏ
 * lúc gửi là đánh cược rằng mạng không bao giờ đứt giữa chừng — và khi nó đứt, dòng đã
 * biến mất khỏi máy mà chưa từng tới nơi. Không có bản sao nào để dựng lại.
 * ⚠ Và dùng `xoaHan` — **XOÁ HẲN, không để bia mộ**: đây là hàng đợi, không phải dữ liệu.
 * Bia mộ tồn tại để cú xoá LAN ĐI qua két, mà hàng đợi thì cố ý không vào két
 * (`KIEU_LAT.outbox = 'khong'`) nên nó chẳng lan đi đâu; giữ lại chỉ được một đống xác
 * dòng-đã-gửi phình vô hạn trên máy user.
 */
export async function xacNhanGui(kho: KhoPfm, ids: readonly string[]): Promise<number> {
  for (const id of ids) await kho.xoaHan('outbox', id);
  return kho.dem('outbox');
}

/* ═══ 5. CÓ NÊN GỬI BÂY GIỜ KHÔNG ═════════════════════════════════════════════ */

/** Khoá bản ghi `meta` giữ bộ đếm. Xuất ra vì `ket_chay.ts` phải PHÂN LOẠI được nó. */
export const ID_DEM_DONG_BO = 'dong_bo_dem';

export interface SoLan { ngay: string; lo: number; ket: number }

/**
 * Trần theo NGÀY, đếm ở `meta` của kho.
 *
 * ⚠ Đây là TRẦN CHẶN LẠM DỤNG, không phải nhịp kỳ vọng (D146 K11: sổ là thứ đổi vài lần
 * một ngày, không phải thứ cần đồng bộ liên tục). Sang ngày mới thì bộ đếm về 0 — và
 * "ngày" do NGƯỜI GỌI đưa vào theo giờ user (K7), không phải theo UTC và không phải theo
 * đồng hồ của file này.
 */
export async function demTrongNgay(kho: KhoPfm, ngay: string): Promise<SoLan> {
  const b = await kho.doc<SoLan>('meta', ID_DEM_DONG_BO);
  return b !== null && b.d.ngay === ngay ? b.d : { ngay, lo: 0, ket: 0 };
}

export async function ghiNhanGui(
  kho: KhoPfm, ngay: string, loai: 'lo' | 'ket', luc: string,
): Promise<SoLan> {
  const c = await demTrongNgay(kho, ngay);
  const moi: SoLan = { ...c, [loai]: c[loai] + 1 };
  await kho.ghi('meta', { id: ID_DEM_DONG_BO, thang: ngay.slice(0, 7), suaLuc: luc, d: moi });
  return moi;
}

/**
 * ĐÁNH DẤU HẾT SUẤT HÔM NAY khi **SERVER** nói 429.
 *
 * ⚠⚠ Bộ đếm này là của MÁY, còn trần thật là của TÀI KHOẢN (`pfm:luu:${userId}`) — hai
 * máy, hay một kho bị xóa, là máy tưởng còn suất trong khi server đã hết. Không đồng bộ
 * lại thì driver gọi lại ở **mọi lần mở app** suốt phần còn lại của ngày, mỗi lần lại ăn
 * 429 — tốn request cho một câu trả lời đã biết, đúng thứ trần `/pfm/luu` sinh ra để chặn.
 * ⇒ Server nói hết thì MÁY ghi nhận là hết. Sang ngày mới bộ đếm tự về 0 như cũ.
 */
export async function danhDauHetSuat(
  kho: KhoPfm, ngay: string, loai: 'lo' | 'ket', luc: string,
): Promise<void> {
  const c = await demTrongNgay(kho, ngay);
  const tran = loai === 'lo' ? PFM_LO.LO_MOI_NGAY : PFM.SO_LAN_LUU_NGAY;
  await kho.ghi('meta', {
    id: ID_DEM_DONG_BO, thang: ngay.slice(0, 7), suaLuc: luc,
    d: { ...c, [loai]: tran } satisfies SoLan,
  });
}

export async function conLuotLo(kho: KhoPfm, ngay: string): Promise<boolean> {
  return (await demTrongNgay(kho, ngay)).lo < PFM_LO.LO_MOI_NGAY;
}

export async function conLuotKet(kho: KhoPfm, ngay: string): Promise<boolean> {
  return (await demTrongNgay(kho, ngay)).ket < PFM.SO_LAN_LUU_NGAY;
}
