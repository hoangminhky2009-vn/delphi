/**
 * PFM — KHO Ở MÁY USER: adapter + toàn bộ LUẬT (nhóm C, tầng nền).
 *
 * ⚠⚠ VÌ SAO LÀ ADAPTER CHỨ KHÔNG GỌI THẲNG IndexedDB (A8.9 — không khoá nhà cung cấp):
 * repo đang chuẩn bị đóng gói thành app (founder 31/08). App native không có
 * IndexedDB; nó có SQLite. Nếu `so/`, `hu/`, `ket/`, `dac_trung/` gọi thẳng API của
 * trình duyệt thì ngày đóng gói là ngày viết lại nghiệp vụ — mà nghiệp vụ đó chở tiền
 * và chở nhãn cohort. Nên: mọi module chỉ biết `KhoPfm`, và ĐỔI NỀN = viết một file
 * mới cạnh `kho_idb.ts`.
 *
 * ⚠⚠ VÀ ĐÂY LÀ CHỖ DỄ THỦNG NHẤT CỦA MỘT ADAPTER: nếu bản IndexedDB tự lọc/tự sắp bằng
 * cursor còn bản bộ nhớ tự lọc bằng `Array.filter`, ta có HAI bản cài đặt của cùng một
 * câu truy vấn và chúng SẼ trôi (D61) — cú trôi biểu hiện là "trên máy thật tháng 8 có
 * 12 khoản, trong test có 11", không lỗi, không ai báo. Nên toàn bộ phép LỌC/SẮP/CẮT
 * nằm ở `locSo()` dưới đây và CẢ HAI bản đều gọi nó; nền chỉ làm đúng một việc là ĐỌC
 * RA một mảng. Có bài canh quét mã nguồn `kho_idb.ts` cấm nó tự lọc.
 *
 * ⚠ FILE NÀY KHÔNG BIẾT GÌ VỀ MẠNG (nối tiếp `hu.ts`). Sổ dùng được ở chế độ máy bay
 * (B8); đồng bộ là việc của `dong_bo/`, và nó chỉ ĐỌC kho chứ không phải điều kiện để
 * kho hoạt động.
 */

/* ═══ 1. THÁNG LÀ ĐƠN VỊ CHIA KHO (K10) ═══════════════════════════════════════ */

/**
 * ⚠⚠ THÁNG KHÔNG PHẢI MỘT CÁCH SẮP XẾP CHO ĐẸP — NÓ LÀ ĐƠN VỊ CỦA KÉT (K10).
 *
 * D146 đo: két "3 thế hệ trọn sổ" đẩy lên 35 KB mỗi lần sao lưu và **tăng mãi theo tuổi
 * sổ**, tức tự phạt đúng người dùng trung thành nhất; cắt theo tháng thì mỗi gói ≤5,2 KB
 * và ĐỨNG YÊN vĩnh viễn. Nhưng điều đó chỉ đúng nếu lấy ra "mọi khoản của tháng 8" là
 * một phép RẺ. Vì vậy `thang` là một CỘT CÓ INDEX chứ không phải thứ suy ra bằng cách
 * quét cả sổ rồi cắt chuỗi — quét cả sổ mỗi lần niêm phong là trả lại đúng cái giá vừa
 * tránh được.
 */
export type MaThang = string;   // 'YYYY-MM'

const RX_THANG = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * ⚠ Cắt theo NGÀY ĐỊA PHƯƠNG của user, không theo UTC. Một khoản chi lúc 23h30 ngày
 * 31/08 giờ VN là UTC 16h30 cùng ngày — nhưng lúc 07h00 ngày 01/09 giờ VN thì UTC vẫn
 * là 31/08, và nếu cắt theo UTC thì khoản đó rơi nhầm sang gói tháng trước, tức rơi vào
 * một lát ĐÃ NIÊM PHONG. Nên chuỗi ngày đưa vào đây phải là ngày user (K7: "ngày" của
 * PFM do giờ VN/`users.mui_gio` định nghĩa, không phải do đồng hồ UTC).
 */
export function thangCua(ngayDiaPhuong: string): MaThang {
  const t = ngayDiaPhuong.slice(0, 7);
  if (!RX_THANG.test(t)) throw new LoiKho(`Ngày không đọc được tháng: ${ngayDiaPhuong}`);
  return t;
}

export class LoiKho extends Error {}

/* ═══ 2. HÌNH DẠNG BẢN GHI ════════════════════════════════════════════════════ */

/** Các ngăn của kho. Thêm ngăn = tăng `PHIEN_BAN_KHO` (xem §4). */
export const NGAN = ['khoan', 'hu', 'luat', 'mau_lap', 'nhip', 'outbox', 'meta', 'hu_con'] as const;
export type TenNgan = (typeof NGAN)[number];

/**
 * Bản ghi tối thiểu mà KHO cần biết. Ruột (`d`) là của module nghiệp vụ — kho cố ý
 * KHÔNG hiểu nó.
 *
 * ⚠ Vì sao kho không hiểu ruột: nếu kho biết một khoản chi có trường `soTien`, sớm muộn
 * sẽ có người viết một truy vấn "tổng chi tháng này" NGAY TRONG KHO cho tiện. Lúc đó
 * phép tính tiền có hai bản (một ở `guong/`, một ở đây) và chúng trôi. Kho là NƠI CẤT,
 * không phải nơi tính.
 */
export interface BanGhi<T = unknown> {
  id: string;
  /** Tháng bản ghi THUỘC VỀ — quyết định nó nằm lát két nào (K10). */
  thang: MaThang;
  /** Mốc sửa gần nhất (ISO). Dùng để hoà giải khi khôi phục két (K8). */
  suaLuc: string;
  /** Bản ghi user đã xoá: giữ BIA MỘ để cú xoá lan được sang máy khác khi khôi phục. */
  daXoa?: true;
  d: T;
}

/* ═══ 3. TRUY VẤN — MỘT BẢN CÀI ĐẶT, HAI CÁI NỀN ══════════════════════════════ */

export interface TruyVan {
  /** Lọc theo tháng. Bỏ trống = mọi tháng. */
  thang?: MaThang;
  /** Mặc định BỎ bia mộ — người gọi phải nói rõ mới thấy (chỉ `ket/` cần). */
  keCaDaXoa?: boolean;
  /** Chỉ lấy bản ghi sửa TỪ mốc này trở đi (đồng bộ tăng dần). */
  suaTu?: string;
  /** Trần số bản ghi trả về. */
  tran?: number;
}

/**
 * ⚠⚠ ĐÂY LÀ MỘT NGUỒN DUY NHẤT CỦA MỌI PHÉP LỌC (D61). Bản IndexedDB dùng index chỉ để
 * ĐỌC RA ÍT HƠN, rồi vẫn chạy qua đúng hàm này — index là chuyện tốc độ, không phải
 * chuyện ngữ nghĩa. Ai sửa luật lọc thì sửa ở đây và cả hai nền đi theo.
 *
 * Sắp theo `suaLuc` TĂNG DẦN rồi tới `id`: kẹp thêm `id` là để hai bản ghi sửa cùng một
 * mili-giây vẫn ra CÙNG THỨ TỰ trên mọi nền — thiếu vế đó thì thứ tự phụ thuộc vào
 * cách nền duyệt, và một cú khôi phục két có thể ra kết quả khác lần trước.
 */
export function locSo<T>(tat: readonly BanGhi<T>[], q: TruyVan = {}): BanGhi<T>[] {
  const ra = tat.filter((b) => {
    if (!q.keCaDaXoa && b.daXoa) return false;
    if (q.thang !== undefined && b.thang !== q.thang) return false;
    if (q.suaTu !== undefined && b.suaLuc < q.suaTu) return false;
    return true;
  }).sort((a, b) => (a.suaLuc < b.suaLuc ? -1 : a.suaLuc > b.suaLuc ? 1
    : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return q.tran !== undefined ? ra.slice(0, q.tran) : ra;
}

/* ═══ 4. GIAO DIỆN KHO ════════════════════════════════════════════════════════ */

/**
 * PHIÊN BẢN KHO — tăng khi ĐỔI HÌNH DẠNG ngăn (thêm ngăn, thêm index).
 *
 * ⚠⚠ BẪY ĐÃ GHI SẴN TRONG DANH SÁCH PHẢI-KIỂM T6 (D146): **Service Worker có thể chặn
 * nâng cấp kho**. Người dùng mở app ở hai tab, tab cũ giữ kết nối phiên bản cũ ⇒ lượt
 * nâng cấp của tab mới TREO VÔ HẠN chứ không lỗi. Bản IndexedDB vì thế phải xử lý
 * `onblocked` và nói ra, không được chờ câm. Chi tiết ở `kho_idb.ts`.
 *
 * ⚠ v1→v2 (GĐ5, thêm ngăn `luat`): `kho_idb.ts`'s `onupgradeneeded` đã viết sẵn dạng
 * VÒNG LẶP QUA `NGAN` (tạo store cho MỌI tên chưa tồn tại) — nên thêm một ngăn ở đây
 * không cần sửa gì thêm bên đó; vòng lặp tự tạo store mới, store cũ giữ nguyên dữ liệu.
 * ⚠ v2→v3 (PFM tầng không gian, thêm ngăn `hu_con` — hũ con một tầng, CHỈ Ở MÁY): cùng cơ chế, cùng lời hứa — bài
 *   `pfm_hu_con.test.ts` dựng DB v2 đóng băng có hũ thật rồi mở bằng `moKho` và đòi hũ còn nguyên.
 */
export const PHIEN_BAN_KHO = 3;

/**
 * PHIÊN BẢN NỘI DUNG KÉT — nhãn `schema_v` gắn vào gói sao lưu lên máy chủ. TÁCH khỏi `PHIEN_BAN_KHO` ở v3: ngăn `hu_con` chỉ ở máy
 * (`KIEU_LAT.hu_con = 'khong'`) nên hình dạng gói két KHÔNG đổi — nhãn vẫn 2. Nâng nhãn theo kho IndexedDB là làm một con số
 * mới rời máy chỉ vì một ngăn không bao giờ rời máy.
 */
export const PHIEN_BAN_KET = 2;

export interface KhoPfm {
  /**
   * Kho này có BỀN qua các phiên không (`KhoIdb` = true, `KhoTrongBoNho` = false).
   *
   * ⚠⚠ PHẢI NẰM TRONG GIAO DIỆN, không chỉ trên hai lớp cài đặt. Chú thích của
   * `KhoTrongBoNho` bắt *"người gọi phải được BÁO"* — nhưng người gọi cầm `KhoPfm`, nên
   * thiếu dòng này thì lời hứa ấy không thực hiện được: cảnh báo "sổ chỉ sống một phiên"
   * không có cách nào lên tới màn hình. Một hợp đồng thiếu đúng cái trường mà chú thích
   * của nó đòi hỏi.
   */
  readonly ben: boolean;
  /** Đọc một bản ghi. `null` nếu không có HOẶC đã là bia mộ. */
  doc<T>(ngan: TenNgan, id: string): Promise<BanGhi<T> | null>;
  /** Liệt kê theo truy vấn (đi qua `locSo` — một nguồn). */
  liet<T>(ngan: TenNgan, q?: TruyVan): Promise<BanGhi<T>[]>;
  /** Ghi đè cả bản ghi. Người gọi tự đặt `suaLuc` — kho không có đồng hồ (xem dưới). */
  ghi<T>(ngan: TenNgan, b: BanGhi<T>): Promise<void>;
  /** Ghi một lô TRONG CÙNG MỘT transaction — hoặc vào hết, hoặc không dòng nào. */
  ghiLo<T>(ngan: TenNgan, bs: readonly BanGhi<T>[]): Promise<void>;
  /** Đặt bia mộ (không xoá thật) — cú xoá phải lan được sang máy khác. */
  xoa(ngan: TenNgan, id: string, luc: string): Promise<void>;
  /**
   * XOÁ HẲN, KHÔNG BIA MỘ.
   *
   * ⚠⚠ Chỉ dùng cho ngăn `outbox`, và lý do là một câu: **bia mộ tồn tại để cú xoá LAN
   * ĐI sang máy khác qua két** — mà hàng đợi thì cố ý KHÔNG vào két (`KIEU_LAT.outbox =
   * 'khong'`), nên nó chẳng lan đi đâu cả. Để bia mộ ở đây chỉ được đúng một thứ: một
   * đống xác dòng-đã-gửi phình lên vô hạn trên máy user. Với ngăn có dữ liệu thật thì
   * dùng `xoa()` — xoá hẳn ở đó là làm cú xoá KHÔNG lan được, và bản ghi sẽ "sống lại"
   * khi khôi phục trên máy khác.
   */
  xoaHan(ngan: TenNgan, id: string): Promise<void>;
  /** Đếm nhanh, không tải ruột. */
  dem(ngan: TenNgan, q?: TruyVan): Promise<number>;
  /**
   * XOÁ SẠCH — dùng cho P9 (user rút consent / xoá dữ liệu PFM). Xoá THẬT, không bia
   * mộ: đây là lối ra một chiều, và để lại bia mộ ở đây là để lại chính thứ user vừa
   * bảo xoá.
   */
  xoaSach(): Promise<void>;
  dong(): void;
}

/**
 * ⚠⚠ VÌ SAO KHO KHÔNG CÓ ĐỒNG HỒ, và đây là quyết định chứ không phải thiếu sót:
 * `suaLuc` do NGƯỜI GỌI đưa vào. Nếu kho tự `new Date()` thì mọi test phải giả lập
 * đồng hồ, và tệ hơn: `ket/` khi khôi phục một lát tháng cũ sẽ vô tình DÁN MỐC HÔM NAY
 * lên bản ghi năm ngoái, làm hỏng đúng phép hoà giải K8 mà mốc đó sinh ra để phục vụ.
 * Đây cũng là lý do `hu.ts` nhận `luc` làm tham số.
 */

/* ═══ 5. BẢN TRONG BỘ NHỚ ═════════════════════════════════════════════════════ */

/**
 * Không phải "bản giả cho test" — nó là bản CHẠY THẬT ở ba chỗ:
 *   · test (không cần trình duyệt),
 *   · chế độ riêng tư / trình duyệt chặn lưu trữ — nơi IndexedDB NÉM LỖI chứ không
 *     trả rỗng (cùng họ với bẫy `localStorage` mà artifact/PWA đã dính),
 *   · và làm lưới đỡ khi mở kho hỏng: thà sổ sống trong một phiên còn hơn app trắng.
 * ⚠ Rơi về bản này là MẤT DỮ LIỆU KHI ĐÓNG APP, nên người gọi phải được BÁO (`ben`),
 * không được im lặng nuốt.
 */
export class KhoTrongBoNho implements KhoPfm {
  readonly ben = false;
  private m = new Map<TenNgan, Map<string, BanGhi<unknown>>>();

  constructor() { for (const n of NGAN) this.m.set(n, new Map()); }

  private ngan(n: TenNgan): Map<string, BanGhi<unknown>> {
    const x = this.m.get(n);
    if (!x) throw new LoiKho(`Ngăn lạ: ${n}`);
    return x;
  }

  async doc<T>(n: TenNgan, id: string): Promise<BanGhi<T> | null> {
    const b = this.ngan(n).get(id) as BanGhi<T> | undefined;
    return b && !b.daXoa ? b : null;
  }

  async liet<T>(n: TenNgan, q: TruyVan = {}): Promise<BanGhi<T>[]> {
    return locSo([...this.ngan(n).values()] as BanGhi<T>[], q);
  }

  async ghi<T>(n: TenNgan, b: BanGhi<T>): Promise<void> {
    kiemBanGhi(b);
    this.ngan(n).set(b.id, b as BanGhi<unknown>);
  }

  async ghiLo<T>(n: TenNgan, bs: readonly BanGhi<T>[]): Promise<void> {
    bs.forEach(kiemBanGhi);           // kiểm HẾT trước khi ghi dòng nào (all-or-nothing)
    const x = this.ngan(n);
    for (const b of bs) x.set(b.id, b as BanGhi<unknown>);
  }

  async xoa(n: TenNgan, id: string, luc: string): Promise<void> {
    const b = this.ngan(n).get(id);
    if (b) this.ngan(n).set(id, { ...b, daXoa: true, suaLuc: luc });
  }

  async xoaHan(n: TenNgan, id: string): Promise<void> { this.ngan(n).delete(id); }

  async dem(n: TenNgan, q: TruyVan = {}): Promise<number> {
    return (await this.liet(n, q)).length;
  }

  async xoaSach(): Promise<void> { for (const n of NGAN) this.ngan(n).clear(); }

  dong(): void { /* không có tài nguyên để trả */ }
}

/**
 * ⚠ Kiểm ở CỬA VÀO, không kiểm lúc đọc ra. Một bản ghi thiếu `thang` chỉ gây hại lúc
 * niêm phong tháng — tức hàng tuần sau, ở một chỗ khác, và lúc đó không ai lần ra ai
 * đã ghi nó. Chặn tại chỗ ghi thì lỗi có địa chỉ.
 */
export function kiemBanGhi(b: BanGhi<unknown>): void {
  if (!b.id) throw new LoiKho('Bản ghi thiếu id.');
  if (!RX_THANG.test(b.thang)) throw new LoiKho(`Tháng không hợp lệ: ${b.thang}`);
  if (!b.suaLuc) throw new LoiKho(`Bản ghi ${b.id} thiếu mốc sửa.`);
}
