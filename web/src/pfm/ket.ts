/**
 * PFM — KÉT SAO LƯU: nén → mã hoá đầu-cuối → cắt lát (K1–K3 · K8 · K10).
 *
 * ⚠⚠ LỜI HỨA CỦA CẢ FILE, VÀ NÓ LÀ LỜI HỨA PHÁP LÝ CHỨ KHÔNG PHẢI KHẨU HIỆU:
 * **server giữ két nhưng KHÔNG CÓ CHÌA, nên không đọc được** (K2, founder chốt). Chìa
 * suy từ MÃ KHÔI PHỤC mà chỉ user cầm; server không bao giờ thấy mã đó, không thấy khoá,
 * không thấy một byte rõ nào. Câu này đi thẳng vào bản điều khoản và vào câu 2.2/3.4 hỏi
 * luật sư — nên mọi thay đổi ở đây là thay đổi một cam kết với người dùng, không phải
 * một lựa chọn kỹ thuật.
 *
 * ⚠ GIÁ ĐÃ KHAI THẲNG: mất máy VÀ quên mã = mất bản sao lưu vĩnh viễn. Đó là giá ĐÚNG.
 * Giữ chìa hộ thì "chúng tôi không thể đọc" thành một câu nói dối, và câu đó là thứ
 * đáng giá nhất PFM có.
 *
 * ⚠ KHÔNG CÓ ĐỒNG HỒ (nối tiếp `kho.ts`): mốc thời gian do người gọi đưa. Khôi phục một
 * lát tháng cũ mà tự dán mốc hôm nay là hỏng đúng phép hoà giải K8 ở dưới.
 */
import { PFM } from '@config/pfm';
import { locSo, type BanGhi, type TenNgan, NGAN } from './kho.js';

export class LoiKet extends Error {}

/* ═══ 1. HAI LOẠI LÁT — và đây là chỗ dễ sai nhất của K10 ═════════════════════ */

/**
 * ⚠⚠ MỘT CÁI HŨ KHÔNG THUỘC VỀ THÁNG NÀO, VÀ ĐÓ LÀ VẤN ĐỀ THẬT.
 *
 * K10 cắt két theo tháng để tháng đã qua **đóng băng** (ghi một lần, không bao giờ ghi
 * lại) — đó là toàn bộ chỗ tiết kiệm 55–60% mà D146 đo được. Nhưng hũ sống qua nhiều
 * tháng: nếu xếp hũ vào lát của tháng TẠO nó, thì sửa hũ vào tháng 12 sẽ làm bẩn lát
 * tháng 8 đã niêm phong — tức "đóng băng" thành lời hứa suông, và mỗi cú sửa hũ lại đẩy
 * lên một lát cũ.
 *
 * ⇒ HAI LOẠI LÁT:
 *   · **lát THÁNG** (`'2026-08'`) — thứ CÓ NGÀY và không đổi nữa: khoản chi, điểm danh.
 *     Tháng qua rồi thì đóng băng, giữ đúng 1 bản.
 *   · **lát SỐNG** (`'song'`) — thứ sống xuyên tháng: hũ, mẫu lặp, cấu hình. Ghi lại mỗi
 *     khi đổi, nhưng nó NHỎ theo cấu trúc (vài chục hũ, không phải vài nghìn khoản).
 *
 * ⚠ `outbox` KHÔNG VÀO KÉT: nó là hàng đợi gửi đi, không phải dữ liệu. Sao lưu nó rồi
 * khôi phục là GỬI LẠI những thứ đã gửi — nhân đôi số đo, im lặng.
 */
export const KIEU_LAT: Record<TenNgan, 'thang' | 'song' | 'khong'> = {
  khoan: 'thang',
  nhip: 'thang',
  hu: 'song',
  // Luật nếu-thì (GĐ6) sống xuyên tháng như hũ — user đặt một lần, sửa/xoá bất kỳ lúc
  // nào, không gắn với một tháng cụ thể nào. Cùng lý lẽ với `hu`.
  luat: 'song',
  mau_lap: 'song',
  meta: 'song',
  outbox: 'khong',
  // Hũ con (PFM tầng không gian): CHỈ Ở MÁY — không vào két, không rời máy dưới bất kỳ dạng nào (SPEC: không đổi dữ liệu rời máy).
  hu_con: 'khong',
};

/*
 * ⚠ `LAT_SONG` DỜI VỀ `config/pfm.ts` (R15/D251) và ở đây chỉ RE-EXPORT. Từ khi có
 * `/pfm/luu`, mã lát không còn là chuyện xếp chỗ riêng của IndexedDB nữa mà là một
 * giao ước dây: server phải biết `'song'` ứng với `pfm_luu.thang = LAT_SONG_THANG`.
 * Hai đầu dây khai riêng cùng một chuỗi là bản sao thứ hai (A11.5/D61).
 */
export { LAT_SONG, LAT_SONG_THANG, thangGuiLen, latTuThang } from '@config/pfm';
export type MaLat = string;   // 'YYYY-MM' | 'song'

/** Các ngăn thuộc một loại lát. Dùng để gom nội dung và để test phủ kín hai chiều. */
export function nganCuaLat(loai: 'thang' | 'song'): TenNgan[] {
  return NGAN.filter((n) => KIEU_LAT[n] === loai);
}

/* ═══ 2. MÃ KHÔI PHỤC ═════════════════════════════════════════════════════════ */

/**
 * ⚠⚠ MÁY SINH MÃ, USER KHÔNG ĐƯỢC TỰ ĐẶT — và đó là quyết định an ninh, không phải UX.
 *
 * Nếu user tự chọn "mật khẩu", entropy tụt xuống hàng chục bit VÀ tệ hơn là nó có cấu
 * trúc (tên, ngày sinh) nên từ điển ăn được — lúc đó cả két phụ thuộc vào số vòng
 * PBKDF2, một cuộc chạy đua ta không thắng (server lộ ⇒ kẻ tấn công có cả muối lẫn
 * ciphertext, brute-force ngoại tuyến, không giới hạn tốc độ).
 *
 * ⚠⚠ HAI SỐ Ở DƯỚI ĐỌC TỪ `@config/pfm`, KHÔNG KHAI LẠI — và tôi đã tự dính đúng bẫy
 * này: bản đầu của file khai `DAI_MA = 24` + `SO_VONG_PBKDF2 = 210_000` trong khi config
 * đã có `MA_KHOI_PHUC_KY_TU = 12` + `PBKDF2_VONG = 600_000`. Hai bản, **đã lệch ngay từ
 * lúc sinh**, và cú lệch này không hỏng to: nó chỉ làm mã sinh ra ở một chỗ không mở
 * được két đóng ở chỗ kia — tức mất sổ, im lặng, phát hiện vào đúng ngày khôi phục.
 * `vite.config.ts` dựng alias `@config` đúng để chuyện này không xảy ra (A8.9: *"một
 * nguồn chân lý, không copy hằng số"*).
 *
 * Số của config (12 ký tự = **60 bit**, 600.000 vòng) là lựa chọn ĐÚNG HƠN bản tôi tự
 * đặt, ở cả hai đầu: 60 bit qua PBKDF2 600k tốn ~1,2 triệu phép băm mỗi lần đoán ⇒ một
 * GPU đời mới chạy được ~8 nghìn lượt/giây ⇒ quét cạn 2^60 mất hàng triệu năm-GPU; còn
 * 12 ký tự thì CHÉP TAY ĐƯỢC, mà chép tay mới là chỗ mã này thật sự sống hay chết.
 *
 * ⚠ BẢNG CHỮ CÁI BỎ KÝ TỰ DỄ NHẦM (kiểu Crockford Base32): không có `I L O U`. Người ta
 * chép mã lên giấy — một chữ `O` đọc thành `0` là mất sổ vĩnh viễn, và lỗi đó chỉ lộ ra
 * vào đúng ngày họ cần khôi phục. (Bảng chữ không có trong config vì config chỉ khai ĐỘ
 * DÀI; đây là bản khai duy nhất của nó.)
 */
export const BANG_MA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // 32 ký tự, bỏ I L O U
export const DAI_MA = PFM.MA_KHOI_PHUC_KY_TU;

export function taoMaKhoiPhuc(nguon: (n: number) => Uint8Array = ngauNhien): string {
  const b = nguon(DAI_MA);
  let s = '';
  // ⚠ `% 32` KHÔNG lệch phân phối ở đây vì 256 chia hết cho 32 — nếu ai đổi bảng chữ
  //   sang độ dài không chia hết 256 thì phép này thành thiên lệch và phải viết lại
  //   bằng rejection sampling.
  for (let i = 0; i < DAI_MA; i++) s += BANG_MA[b[i]! % 32];
  return s;
}

/** Hiện cho user: chia nhóm 4 để chép tay đỡ lạc dòng. Chỉ là TRÌNH BÀY. */
export function mocMa(ma: string): string {
  return (ma.match(/.{1,4}/g) ?? []).join('-');
}

/**
 * ⚠⚠ CHUẨN HOÁ TRƯỚC KHI SUY KHOÁ, VÀ THIẾU BƯỚC NÀY LÀ MỘT BUG GIẾT NGƯỜI DÙNG:
 * họ chép mã có gạch nối, gõ lại chữ thường, gõ `O` thay `0` — rồi app báo "sai mã" cho
 * một cái mã ĐÚNG. Chuẩn hoá gồm: bỏ mọi thứ không phải chữ-số, viết hoa, và **quy đổi
 * đúng ba cặp nhầm lẫn kinh điển** (`O→0`, `I/L→1`) — ba ký tự này không có trong bảng
 * nên quy đổi chúng không bao giờ va vào một mã hợp lệ khác.
 */
export function chuanMa(raw: string): string {
  const t = raw.toUpperCase().replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0').replace(/[IL]/g, '1');
  if (t.length !== DAI_MA) {
    throw new LoiKet(`Mã khôi phục phải có ${DAI_MA} ký tự (nhận ${t.length}).`);
  }
  for (const c of t) if (!BANG_MA.includes(c)) throw new LoiKet(`Ký tự lạ trong mã: ${c}`);
  return t;
}

/* ═══ 3. SUY KHOÁ ═════════════════════════════════════════════════════════════ */

/**
 * Số vòng PBKDF2 — ĐỌC TỪ CONFIG, không khai lại (xem chú thích ở `BANG_MA`).
 * ⚠ Đây là biên giữa BẢO MẬT và MÁY YẾU: mỗi lần mở két phải chạy một lượt. Nâng nó là
 * làm chậm đúng người dùng máy cũ; hạ nó là bán rẻ lớp phòng thủ cuối. Founder chốt.
 */
export const SO_VONG_PBKDF2 = PFM.PBKDF2_VONG;
export const DAI_MUOI = 16;
export const DAI_IV = 12;   // AES-GCM chuẩn 96 bit

/**
 * ⚠ MUỐI LÀ CỦA USER, KHÔNG PHẢI CỦA TỪNG LÁT. Một muối cho tất cả các lát ⇒ suy khoá
 * ĐÚNG MỘT LẦN rồi mã hoá cả 12 lát; muối theo lát thì mỗi lát một lượt PBKDF2 và mở
 * sổ một năm mất vài giây.
 * ⚠ Muối KHÔNG BÍ MẬT (nó nằm cạnh két trên server) — vai của nó là làm mỗi user một
 * không gian khoá riêng, không phải giấu gì.
 */
export async function suyKhoa(maDaChuan: string, muoi: Uint8Array): Promise<CryptoKey> {
  if (muoi.length !== DAI_MUOI) throw new LoiKet(`Muối phải ${DAI_MUOI} byte.`);
  const goc = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(maDaChuan), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: muoi as BufferSource, iterations: SO_VONG_PBKDF2, hash: 'SHA-256' },
    goc,
    { name: 'AES-GCM', length: 256 },
    false,                       // KHÔNG cho trích xuất khoá ra ngoài
    ['encrypt', 'decrypt'],
  );
}

export function ngauNhien(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/* ═══ 4. ĐÓNG / MỞ MỘT LÁT ════════════════════════════════════════════════════ */

/** Nội dung THÔ của một lát trước khi nén: các ngăn, mỗi ngăn một mảng bản ghi. */
export type RuotLat = Partial<Record<TenNgan, BanGhi<unknown>[]>>;

export interface LatKet {
  lat: MaLat;
  /** Phiên bản ĐỊNH DẠNG của phong bì — đổi cấu trúc thì tăng, không ghi đè. */
  dinhDang: number;
  iv: Uint8Array;
  /** Ciphertext (đã kèm thẻ xác thực GCM). */
  goi: Uint8Array;
  /**
   * Số hiệu bản do **SERVER** cấp (K11). Client không tự đặt: đồng hồ máy user không
   * tin được để chống ghi đè, và đó đúng là thứ D146 đã bắt phải sửa.
   */
  ver?: number;
}

export const DINH_DANG_KET = 1;

/**
 * ⚠⚠ THỨ TỰ BẤT KHẢ ĐẢO: **NÉN TRƯỚC, MÃ HOÁ SAU.** Ciphertext là dãy byte ngẫu nhiên
 * nên không nén được — D146 đo: nén lại ciphertext còn **PHÌNH 0,1%**. Đảo thứ tự là vừa
 * mất trọn phần tiết kiệm dung lượng, vừa tốn CPU cho một phép vô ích.
 */
export async function dongLat(
  lat: MaLat, ruot: RuotLat, khoa: CryptoKey,
  nguonIv: (n: number) => Uint8Array = ngauNhien,
): Promise<LatKet> {
  const tho = new TextEncoder().encode(JSON.stringify(ruot));
  const nen = await gzip(tho);
  /**
   * ⚠ IV NGẪU NHIÊN MỖI LẦN ĐÓNG, KHÔNG BAO GIỜ DÙNG LẠI. Với AES-GCM, lặp IV trên cùng
   * một khoá không chỉ làm lộ hiệu XOR của hai bản rõ mà còn làm lộ khoá xác thực ⇒ kẻ
   * tấn công GIẢ MẠO được két. Đây là cách hỏng thầm lặng nhất của GCM, nên nó có bài
   * canh riêng.
   */
  const iv = nguonIv(DAI_IV);
  const goi = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource }, khoa, nen as BufferSource));
  return { lat, dinhDang: DINH_DANG_KET, iv, goi };
}

export async function moLat(lat: LatKet, khoa: CryptoKey): Promise<RuotLat> {
  if (lat.dinhDang !== DINH_DANG_KET) {
    throw new LoiKet(`Định dạng két lạ: ${lat.dinhDang} (máy hiểu ${DINH_DANG_KET}).`);
  }
  let nen: Uint8Array;
  try {
    nen = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: lat.iv as BufferSource }, khoa, lat.goi as BufferSource));
  } catch {
    /*
     * ⚠ SAI MÃ PHẢI HỎNG TO, KHÔNG ĐƯỢC TRẢ RÁC. Thẻ xác thực của GCM lo việc đó — nó
     * ném chứ không trả bản rõ sai. Ta chỉ dịch lỗi sang câu người đọc được; TUYỆT ĐỐI
     * không nuốt rồi trả `{}`, vì "két rỗng" và "sai chìa" là hai chuyện khác hẳn và
     * gộp chúng sẽ khiến user tưởng mình mất sổ.
     */
    throw new LoiKet('Không mở được két: sai mã khôi phục, hoặc gói đã hỏng.');
  }
  return JSON.parse(new TextDecoder().decode(await gunzip(nen))) as RuotLat;
}

/**
 * Gom nội dung một lát từ danh sách bản ghi của từng ngăn.
 * ⚠ Lấy CẢ BIA MỘ (`keCaDaXoa`) — đây là chỗ DUY NHẤT cần chúng: không mang bia mộ đi
 * thì khôi phục trên máy khác sẽ thấy bản ghi đã xoá "sống lại".
 */
export function gomLat(
  loai: 'thang' | 'song', tatCa: Partial<Record<TenNgan, readonly BanGhi<unknown>[]>>,
  thang?: string,
): RuotLat {
  if (loai === 'thang' && thang === undefined) {
    throw new LoiKet('Lát tháng phải nói rõ là tháng nào.');
  }
  const ruot: RuotLat = {};
  for (const n of nganCuaLat(loai)) {
    const ds = tatCa[n] ?? [];
    ruot[n] = locSo(ds, {
      keCaDaXoa: true, ...(loai === 'thang' ? { thang: thang! } : {}),
    });
  }
  return ruot;
}

/** Trần 32 KB (D146 — đo lát dày nhất 5,2 KB, biên ~6 lần). Kiểm SAU khi đã đóng gói. */
export function kiemTran(lat: LatKet, tran: number): void {
  const co = lat.goi.length + lat.iv.length;
  if (co > tran) {
    throw new LoiKet(`Lát "${lat.lat}" nặng ${co} byte, quá trần ${tran}.`);
  }
}

/* ═══ 5. HOÀ GIẢI KHI KHÔI PHỤC — K8 ══════════════════════════════════════════ */

export interface KetQuaHoaGiai<T = unknown> {
  /** Danh sách bản ghi SAU khi trộn — thứ sẽ ghi đè vào kho. */
  ra: BanGhi<T>[];
  them: number;
  /** Bản ghi trong két mới hơn ⇒ thay bản đang có. */
  thay: number;
  /** Bản ghi đang có mới hơn (hoặc chỉ có ở máy) ⇒ GIỮ. */
  giu: number;
  /** Trùng mốc sửa mà khác nội dung — giữ bản đang có và BÁO cho user. */
  can: string[];
}

/**
 * ⭐⭐ HOÀ GIẢI — chưa doc nào của repo viết phần này, và nó là chỗ mất dữ liệu dễ nhất
 * của cả PFM (05c: *"K8 conflict khi khôi phục — chưa từng có trong bất kỳ doc nào.
 * Khôi phục đè lên sổ đang có = mất dữ liệu thật"*).
 *
 * BỐN LUẬT, và luật số 2 là luật quan trọng nhất:
 *
 * 1. Chỉ có trong KÉT ⇒ THÊM.
 * 2. ⭐ Chỉ có ở MÁY ⇒ **GIỮ**. *Vắng mặt trong két KHÔNG PHẢI lệnh xoá.* Két là ảnh
 *    chụp của một khoảnh khắc; coi "không có trong ảnh" là "đã bị xoá" thì khôi phục
 *    một bản sao lưu tháng trước sẽ **xoá sạch mọi thứ ghi từ đó tới nay** — mất dữ liệu
 *    thật, im lặng, không hoàn tác được. Cú xoá chỉ lan được qua BIA MỘ (luật 3).
 * 3. Có ở cả hai ⇒ bản có `suaLuc` MỚI HƠN thắng. Bia mộ cũng là một bản ghi nên luật
 *    này tự lo cả hai chiều: xoá-mới thắng bản-cũ-còn-sống, và sửa-mới thắng bia-mộ-cũ
 *    (user xoá trên máy A rồi đổi ý sửa lại trên máy B).
 * 4. ⚠ Trùng `suaLuc` mà khác nội dung ⇒ **GIỮ BẢN Ở MÁY và BÁO RA** (`can`). Không âm
 *    thầm chọn hộ: đây đúng là lúc phải nói với người dùng, vì chỉ họ biết bản nào thật.
 *
 * ⚠⚠ KHAI ĐÚNG GIỚI HẠN: luật 3 là "bản mới thắng" dựa trên ĐỒNG HỒ MÁY USER, mà hai
 * máy lệch giờ là chuyện thường. Ta không giả vờ đây là một phép hợp nhất hoàn hảo —
 * đó chính là lý do luật 4 tồn tại và vì sao kết quả trả về số đếm để UI kể lại được
 * *"đã thêm 42, giữ 3, có 1 chỗ cấn"* thay vì im lặng nuốt.
 */
export function hoaGiai<T>(
  dangCo: readonly BanGhi<T>[], tuKet: readonly BanGhi<T>[],
): KetQuaHoaGiai<T> {
  const map = new Map<string, BanGhi<T>>();
  for (const b of dangCo) map.set(b.id, b);

  const kq: KetQuaHoaGiai<T> = { ra: [], them: 0, thay: 0, giu: 0, can: [] };

  for (const k of tuKet) {
    const c = map.get(k.id);
    if (c === undefined) { map.set(k.id, k); kq.them++; continue; }
    if (k.suaLuc > c.suaLuc) { map.set(k.id, k); kq.thay++; continue; }
    if (k.suaLuc < c.suaLuc) { kq.giu++; continue; }
    // cùng mốc: chỉ là cấn khi nội dung thật sự khác nhau
    if (JSON.stringify(k) !== JSON.stringify(c)) kq.can.push(k.id);
    kq.giu++;
  }
  // Bản chỉ có ở máy: không đụng tới (luật 2). Không đếm vào `giu` để con số `giu` giữ
  // đúng nghĩa "két có nhắc tới nhưng bản ở máy thắng".
  kq.ra = [...map.values()];
  return kq;
}

/* ═══ 6. NÉN — tách riêng để chỗ khác không phải biết API stream ══════════════ */

async function gzip(x: Uint8Array): Promise<Uint8Array> {
  return quaStream(x, new CompressionStream('gzip'));
}
async function gunzip(x: Uint8Array): Promise<Uint8Array> {
  return quaStream(x, new DecompressionStream('gzip'));
}
async function quaStream(x: Uint8Array, ts: TransformStream): Promise<Uint8Array> {
  const w = ts.writable.getWriter();
  void w.write(x).then(() => w.close());
  return new Uint8Array(await new Response(ts.readable).arrayBuffer());
}
