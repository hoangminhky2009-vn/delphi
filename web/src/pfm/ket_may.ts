/**
 * PFM — KÉT TRÊN MÁY: muối, chìa, phong bì dây. Nối `ket.ts` (thuần) với server (R12).
 *
 * ⚠⚠ RANH GIỚI VỚI `ket.ts`: bên đó là mật mã THUẦN — `suyKhoa`, `dongLat`, `moLat`,
 * không biết user là ai và không chạm kho. Bên này biết **user nào** (để suy muối) và
 * biết **kho** (để cất chìa). Trộn hai vai là làm `ket.ts` mất tính test-được-bằng-vector.
 *
 * ⚠⚠ P2 🔒 — SERVER KHÔNG CÓ CHÌA, VÀ ĐÓ LÀ ĐIỀU KHÔNG THƯƠNG LƯỢNG. Mọi thứ ở đây chạy
 * TRÊN MÁY: mã khôi phục do máy sinh, chìa do máy rèn, sổ do máy khoá. Thứ duy nhất rời
 * máy là ciphertext. Một ngày nào đó có người đề nghị "gửi mã lên để khôi phục hộ" — câu
 * trả lời là không, và lý do là cả kiến trúc này.
 */
import { PFM } from '@config/pfm';
import type { KhoPfm } from './kho.js';
import {
  DAI_MUOI, LoiKet, chuanMa, suyKhoa, taoMaKhoiPhuc, DAI_IV,
  type LatKet, type MaLat,
} from './ket.js';

/* ═══ 1. MUỐI ════════════════════════════════════════════════════════════════ */

/** Tiền tố miền của muối — đổi nó là làm MỌI két cũ không mở được nữa. */
const TIEN_TO_MUOI = 'delphi-pfm-muoi:';

/**
 * ⭐ MUỐI CỦA MỘT USER — suy ra từ `user_id`, không lưu ở đâu cả (R12).
 *
 * ⚠⚠ VÌ SAO SUY RA CHỨ KHÔNG LƯU: bản kiến trúc đầu viết *"muối nằm cạnh két trên
 * server"* — nhưng **không có cột nào chứa nó**, và không có đường nào tạo nó. Tức
 * `suyKhoa` đòi một tham số mà cả hệ thống không sinh ra được: khôi phục trên máy mới là
 * BẤT KHẢ, im lặng, và chỉ lộ ra khi có người thật mất máy.
 * ⇒ Suy từ `user_id` thì muối luôn có mặt ở bất cứ đâu biết user là ai — không thêm cột,
 * không thêm đường, không thêm thứ để mất.
 *
 * ⚠ MUỐI KHÔNG PHẢI BÍ MẬT, và cách suy này KHÔNG làm nó yếu đi. Vai của muối là cho mỗi
 * user một **không gian khoá riêng** (bảng cầu vồng dựng cho user A vô dụng với user B),
 * không phải giấu gì. Chính `ket.ts` đã ghi điều đó, và cả bản kiến trúc cũ cũng đặt nó
 * "cạnh két trên server" — tức công khai với bất kỳ ai đọc được DB.
 * ⇒ Sức mạnh nằm ở **mã khôi phục 60 bit qua PBKDF2 600k vòng**, không ở muối.
 */
export async function muoiCuaUser(userId: string): Promise<Uint8Array> {
  if (userId === '') throw new LoiKet('muoiCuaUser: user_id rỗng.');
  const bam = await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(TIEN_TO_MUOI + userId));
  // 16 byte đầu: `DAI_MUOI` là hằng của `ket.ts`, đừng khai lại con số ở đây.
  return new Uint8Array(bam).slice(0, DAI_MUOI);
}

/* ═══ 2. CHÌA — rèn một lần, cất trong kho, không bao giờ trích ra ═══════════ */

/** Khoá bản ghi `meta` giữ chìa đã rèn. */
export const ID_KHOA_KET = 'khoa_ket';

/**
 * ⚠⚠ CẤT ĐƯỢC `CryptoKey` VÀO INDEXEDDB MÀ KHÔNG BAO GIỜ TRÍCH RA — đây là lý do
 * `suyKhoa` tạo khoá với `extractable = false`. Structured clone chép được một khoá
 * không-trích-được; JavaScript thì không đọc nổi byte của nó. Nên chìa sống qua các
 * phiên **mà không có lúc nào nằm dưới dạng byte trong bộ nhớ ta kiểm soát**.
 * ⇒ Đừng "tối ưu" thành lưu chuỗi base64 của khoá. Đó là đổi một bảo đảm của trình duyệt
 * lấy một dòng code ngắn hơn.
 */
export async function catChia(kho: KhoPfm, khoa: CryptoKey, luc: string): Promise<void> {
  await kho.ghi('meta', { id: ID_KHOA_KET, thang: luc.slice(0, 7), suaLuc: luc, d: khoa });
}

export async function docChia(kho: KhoPfm): Promise<CryptoKey | null> {
  const b = await kho.doc<CryptoKey>('meta', ID_KHOA_KET);
  return b?.d ?? null;
}

export interface LeTaoChia {
  /** Mã người dùng PHẢI tự ghi lại — máy không giữ bản nào đọc được. */
  ma: string;
  khoa: CryptoKey;
}

/**
 * LỄ TẠO MÃ: sinh mã khôi phục, rèn chìa, cất chìa.
 *
 * ⚠⚠ TRẢ MÃ RA MỘT LẦN DUY NHẤT VÀ KHÔNG LƯU NÓ. Cất mã cạnh chìa là xoá sạch ý nghĩa
 * của việc có mã: ai mở được máy thì đọc được cả hai. Màn hình phải bắt người dùng xác
 * nhận đã ghi lại trước khi đóng — mất mã là mất mọi lát két, không có đường vòng, và
 * server không giúp được vì server không có chìa (P2 🔒).
 * ⚠ `muoi` suy từ `userId`, nên đổi tài khoản là đổi không gian khoá: cùng một mã ở hai
 * tài khoản ra hai chìa khác nhau. Đó là ý đồ.
 */
export async function taoVaLuuChia(
  kho: KhoPfm, userId: string, luc: string,
  nguonMa: () => string = taoMaKhoiPhuc,
): Promise<LeTaoChia> {
  const ma = nguonMa();
  const khoa = await suyKhoa(chuanMa(ma), await muoiCuaUser(userId));
  await catChia(kho, khoa, luc);
  return { ma, khoa };
}

/**
 * KHÔI PHỤC trên máy mới: từ mã người dùng gõ lại, rèn LẠI đúng chìa cũ.
 *
 * ⚠ `chuanMa` chạy TRƯỚC khi suy khoá — người dùng gõ tay thì sẽ có dấu cách, chữ
 * thường, và cả `I`/`L`/`O`/`U` gõ nhầm từ `1`/`1`/`0`/`V`. `chuanMa` chuẩn hoá đúng
 * những ca đó; không gọi nó là biến một cú gõ hợp lý thành "mã sai" không giải thích được.
 * ⚠ Hàm này KHÔNG kiểm mã đúng hay sai — không có cách nào kiểm mà không thử mở một lát
 * thật. Sai mã ⇒ `moLat` ném khi giải mã. Đó là thiết kế: không có oracle nào cho phép
 * dò mã mà không tốn một lượt PBKDF2 600k vòng.
 */
export async function khoiPhucChia(
  kho: KhoPfm, userId: string, maNguoiGo: string, luc: string,
): Promise<CryptoKey> {
  const khoa = await suyKhoa(chuanMa(maNguoiGo), await muoiCuaUser(userId));
  await catChia(kho, khoa, luc);
  return khoa;
}

/* ═══ 3. PHONG BÌ DÂY — [1B dinhDang][12B iv][goi] ══════════════════════════ */

/**
 * ⭐ `LatKet` → dãy byte đi lên `POST /pfm/luu`.
 *
 * ⚠⚠ PHONG BÌ PHẢI TỰ MÔ TẢ. `dinhDang` đi ở byte ĐẦU, trước cả IV: ngày định dạng đổi
 * (thuật toán khác, IV dài khác), thứ đọc được byte đầu vẫn biết mình đang cầm bản nào và
 * **từ chối tử tế** thay vì giải mã bừa rồi ra rác. Một két không tự mô tả là một két chỉ
 * đọc được bởi đúng phiên bản code đã ghi nó — mà két thì phải sống lâu hơn code.
 * ⚠ `lat` KHÔNG nằm trong phong bì: nó là tham số truy vấn (`?thang=`), server dùng nó
 * làm khoá dòng. Nhét vào cả hai chỗ là dựng hai nguồn cho một sự thật (A11.5).
 */
export function raByte(lat: LatKet): Uint8Array {
  if (lat.iv.length !== DAI_IV) throw new LoiKet(`IV phải ${DAI_IV} byte.`);
  const ra = new Uint8Array(1 + DAI_IV + lat.goi.length);
  ra[0] = lat.dinhDang;
  ra.set(lat.iv, 1);
  ra.set(lat.goi, 1 + DAI_IV);
  return ra;
}

/**
 * Dãy byte từ server → `LatKet`.
 *
 * ⚠ NÉM SỚM VÀ NÓI RÕ. Một phong bì cụt (thiếu IV, hoặc rỗng ruột) mà cho đi tiếp thì
 * `moLat` sẽ ném một lỗi mật mã chung chung, và người đọc log không phân biệt được
 * "server trả rác" với "mã khôi phục sai" — hai chuyện cần hai cách xử lý khác hẳn.
 */
export function tuByte(lat: MaLat, byte: Uint8Array): LatKet {
  if (byte.length < 1 + DAI_IV + 1) {
    throw new LoiKet(`Phong bì két cụt: ${byte.length} byte (tối thiểu ${2 + DAI_IV}).`);
  }
  return {
    lat,
    dinhDang: byte[0]!,
    iv: byte.slice(1, 1 + DAI_IV),
    goi: byte.slice(1 + DAI_IV),
  };
}

/**
 * ⚠ Trần thân request của `/pfm/luu` (`PFM.BLOB_MAX`) áp lên PHONG BÌ, không lên ruột.
 * Kiểm ở đây để một lát quá cỡ bị chặn TRÊN MÁY, kèm câu nói được — thay vì đi hết
 * đường mạng rồi ăn 413 mà người dùng chỉ thấy "lưu hỏng".
 */
export function latQuaLon(byte: Uint8Array): boolean {
  return byte.length > PFM.BLOB_MAX;
}
