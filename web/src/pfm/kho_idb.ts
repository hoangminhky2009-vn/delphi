/**
 * PFM — KHO: bản nền IndexedDB. CỐ Ý MỎNG.
 *
 * ⚠⚠ FILE NÀY KHÔNG ĐƯỢC CHỨA MỘT LUẬT NGHIỆP VỤ NÀO. Nó biết đúng bốn việc: mở kho,
 * đọc ra, ghi vào, đóng lại. Mọi phép LỌC/SẮP/CẮT đi qua `locSo()` của `kho.ts` — cùng
 * một hàm mà bản trong-bộ-nhớ dùng. Có bài canh quét mã nguồn file này và bắt đỏ nếu
 * thấy nó tự `.filter(`/`.sort(`/`.slice(`.
 *
 * Vì sao gắt tới mức viết thành test: một adapter có hai bản cài đặt cùng câu truy vấn
 * là bản-sao-sẽ-trôi kinh điển (D61), và cú trôi ở đây IM LẶNG — test chạy trên bản bộ
 * nhớ vẫn xanh trong khi máy thật trả thiếu một khoản. Kiểu hỏng đó không ai báo, vì
 * người dùng không biết đáng lẽ phải có bao nhiêu dòng.
 */
import {
  locSo, kiemBanGhi, LoiKho, NGAN, PHIEN_BAN_KHO,
  type BanGhi, type KhoPfm, type TenNgan, type TruyVan,
} from './kho.js';

/**
 * ⚠⚠ MỘT KHO MỖI TÀI KHOẢN (D603 · SPEC `cai-app-pfm-trong-ban-cai`). Bản trước dùng MỘT tên cố định `delphi_pfm`
 * cho mọi tài khoản trên cùng trình duyệt ⇒ lớp học dùng chung máy thì người sau mở ra thấy sổ của người trước — số tiền,
 * ghi chú, hồ sơ phỏng vấn. Tên kho giờ mang `user_id`; kho chung cũ BỎ, KHÔNG CHUYỂN (founder 11/10, D592) — không ai
 * biết nó thuộc về ai, nên chuyển vào kho của bất kỳ ai cũng là đoán.
 */
export const TEN_DB_CHUNG_CU = 'delphi_pfm';

/** `user_id` là uuid; vẫn kiểm hình dạng vì nó thành TÊN một cơ sở dữ liệu trên máy. */
const MAU_CHU = /^[A-Za-z0-9_-]{1,64}$/;

export function tenKho(chu: string): string {
  if (!MAU_CHU.test(chu)) throw new LoiKho('Chủ kho không hợp lệ.');
  return `${TEN_DB_CHUNG_CU}_${chu}`;
}

/**
 * Xoá kho CHUNG cũ (trước D603) nếu còn trên máy — cho nút XOÁ SẠCH SỔ (P9: điều khoản đã hứa xoá được). Không mở nó,
 * không đọc nó. Hỏng / bị giữ ⇒ im lặng: trình duyệt sẽ xoá khi kết nối cuối cùng đóng.
 */
export function xoaKhoChungCu(): Promise<void> {
  return new Promise((ok) => {
    try {
      if (typeof indexedDB === 'undefined') { ok(); return; }
      const r = indexedDB.deleteDatabase(TEN_DB_CHUNG_CU);
      r.onsuccess = () => ok();
      r.onerror = () => ok();
      r.onblocked = () => ok();
    } catch { ok(); }
  });
}

/** Chờ tối đa cho một lượt MỞ kho. Xem `onblocked` dưới đây. */
export const HET_HAN_MO_MS = 4_000;

function hua<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, loi) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => loi(r.error ?? new LoiKho('IndexedDB lỗi không tên'));
  });
}

/**
 * MỞ KHO của MỘT tài khoản (`chu` = `user_id`).
 *
 * ⚠⚠ BA CÁCH HỎNG, VÀ CÁI THỨ HAI LÀ CÁI ĐÃ ĐƯỢC CẢNH BÁO TRƯỚC (T6, D146):
 *
 * 1. KHÔNG CÓ IndexedDB — chế độ riêng tư của vài trình duyệt, hoặc thiết lập chặn lưu
 *    trữ. Ở đây nó NÉM chứ không trả `undefined`, nên phải bọc.
 * 2. ⭐ `onblocked` — một TAB KHÁC (hoặc một Service Worker đang giữ kết nối) còn mở kho
 *    ở phiên bản cũ ⇒ lượt nâng cấp **treo vô hạn, không lỗi, không timeout của riêng
 *    nó**. Đây là kiểu hỏng tệ nhất vì màn hình chỉ đứng im: người dùng đọc ra "app
 *    hỏng", còn log thì sạch. Nên ta tự đặt đồng hồ và NÓI RA.
 * 3. `onversionchange` — chiều ngược lại: tab NÀY đang giữ kho cũ trong khi tab kia
 *    muốn nâng cấp. Không đóng thì ta chính là kẻ gây ra (2) cho người khác.
 */
export async function moKho(chu: string): Promise<KhoIdb> {
  const ten = tenKho(chu);
  if (typeof indexedDB === 'undefined') {
    throw new LoiKho('Trình duyệt không cho lưu trữ (IndexedDB vắng mặt).');
  }
  const yc = indexedDB.open(ten, PHIEN_BAN_KHO);

  const db = await new Promise<IDBDatabase>((ok, loi) => {
    const dongHo = setTimeout(() => {
      loi(new LoiKho('Kho đang bị một cửa sổ khác giữ — hãy đóng các tab DELPHI khác.'));
    }, HET_HAN_MO_MS);
    const xong = (f: () => void) => { clearTimeout(dongHo); f(); };

    yc.onupgradeneeded = () => {
      const d = yc.result;
      for (const n of NGAN) {
        if (d.objectStoreNames.contains(n)) continue;
        const s = d.createObjectStore(n, { keyPath: 'id' });
        // Index để ĐỌC RA ÍT HƠN. Ngữ nghĩa vẫn do `locSo` quyết (xem đầu file).
        s.createIndex('thang', 'thang', { unique: false });
        s.createIndex('suaLuc', 'suaLuc', { unique: false });
      }
    };
    yc.onblocked = () => xong(() => loi(new LoiKho(
      'Kho đang bị một cửa sổ khác giữ — hãy đóng các tab DELPHI khác.')));
    yc.onerror = () => xong(() => loi(yc.error ?? new LoiKho('Không mở được kho.')));
    yc.onsuccess = () => xong(() => ok(yc.result));
  });

  db.onversionchange = () => db.close();   // xem lý do (3) ở trên
  return new KhoIdb(db);
}

export class KhoIdb implements KhoPfm {
  readonly ben = true;

  constructor(private db: IDBDatabase) {}

  private kho(n: TenNgan, che: IDBTransactionMode): IDBObjectStore {
    if (!(NGAN as readonly string[]).includes(n)) throw new LoiKho(`Ngăn lạ: ${n}`);
    return this.db.transaction(n, che).objectStore(n);
  }

  /**
   * ⚠ Dùng index `thang` khi truy vấn có ràng buộc tháng — đó là cả lý do K10 chia lát:
   * niêm phong tháng phải KHÔNG được quét cả sổ (D146 đo: quét cả sổ là trả lại đúng
   * cái giá mà lát tháng vừa tiết kiệm). Không có ràng buộc thì đọc hết.
   */
  private async tho<T>(n: TenNgan, q: TruyVan): Promise<BanGhi<T>[]> {
    const s = this.kho(n, 'readonly');
    const r = q.thang !== undefined
      ? s.index('thang').getAll(IDBKeyRange.only(q.thang))
      : s.getAll();
    return (await hua(r)) as BanGhi<T>[];
  }

  async doc<T>(n: TenNgan, id: string): Promise<BanGhi<T> | null> {
    const b = (await hua(this.kho(n, 'readonly').get(id))) as BanGhi<T> | undefined;
    return b && !b.daXoa ? b : null;
  }

  async liet<T>(n: TenNgan, q: TruyVan = {}): Promise<BanGhi<T>[]> {
    return locSo(await this.tho<T>(n, q), q);
  }

  async ghi<T>(n: TenNgan, b: BanGhi<T>): Promise<void> {
    kiemBanGhi(b);
    await hua(this.kho(n, 'readwrite').put(b));
  }

  /**
   * ⚠ MỘT transaction cho cả lô — không phải một vòng lặp `await ghi()`. Vòng lặp mở N
   * transaction, nên mất mạng/đóng app giữa chừng để lại nửa lô: sổ có khoản mà hũ chưa
   * cộng, và không có gì để lần ra là đã dừng ở đâu.
   */
  async ghiLo<T>(n: TenNgan, bs: readonly BanGhi<T>[]): Promise<void> {
    if (bs.length === 0) return;
    bs.forEach(kiemBanGhi);           // kiểm HẾT trước khi mở transaction
    const tx = this.db.transaction(n, 'readwrite');
    const s = tx.objectStore(n);
    for (const b of bs) s.put(b);
    await new Promise<void>((ok, loi) => {
      tx.oncomplete = () => ok();
      tx.onabort = () => loi(tx.error ?? new LoiKho('Lô bị huỷ.'));
      tx.onerror = () => loi(tx.error ?? new LoiKho('Lô lỗi.'));
    });
  }

  async xoa(n: TenNgan, id: string, luc: string): Promise<void> {
    const s = this.kho(n, 'readwrite');
    const b = (await hua(s.get(id))) as BanGhi<unknown> | undefined;
    if (b) await hua(s.put({ ...b, daXoa: true, suaLuc: luc }));
  }

  /** Xoá hẳn, không bia mộ — chỉ cho `outbox`. Lý do đầy đủ ở `kho.ts`. */
  async xoaHan(n: TenNgan, id: string): Promise<void> {
    await hua(this.kho(n, 'readwrite').delete(id));
  }

  /**
   * ⚠ Đếm đi qua `liet` chứ không dùng `store.count()`, dù `count()` nhanh hơn hẳn.
   * `count()` không biết gì về bia mộ và về `suaTu`, nên nó sẽ đếm cả thứ `liet` không
   * trả — hai con số cho cùng một câu hỏi. Nếu sau này chậm thật thì cách sửa là THÊM
   * INDEX, không phải viết lại luật lọc ở đây.
   */
  async dem(n: TenNgan, q: TruyVan = {}): Promise<number> {
    return (await this.liet(n, q)).length;
  }

  async xoaSach(): Promise<void> {
    const tx = this.db.transaction([...NGAN], 'readwrite');
    for (const n of NGAN) tx.objectStore(n).clear();
    await new Promise<void>((ok, loi) => {
      tx.oncomplete = () => ok();
      tx.onerror = () => loi(tx.error ?? new LoiKho('Xoá sạch lỗi.'));
    });
  }

  dong(): void { this.db.close(); }
}
