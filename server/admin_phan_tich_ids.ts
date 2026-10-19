/**
 * HỢP ĐỒNG DÂY của tầng phân tích quản trị (D335) — MỘT định nghĩa cho cả hai đầu, đúng nếp `holdem/nang_luc_ids.ts`:
 * chỉ kiểu, không phép tính, không import.
 *
 * ⚠ VÌ SAO TÁCH RA. Bản đầu có HAI bản của cùng hình dạng: `server/admin_phan_tich.ts` dựng JSON bằng object literal
 *   không gắn kiểu, còn `web/src/api/phantich.ts` chép tay các interface "gương". Một khoá đổi tên ở một bên thì cả
 *   28 bài server lẫn bài màn ở web vẫn xanh (mỗi bên tự khớp với chính mình), còn màn quản trị in "—" ở chỗ có số —
 *   đúng loại "dữ liệu phản ánh không chính xác" founder dặn canh (15/09). Nay route gắn kiểu trả về từ tệp này, web
 *   `import type` từ tệp này (`@server`), và bài màn ở web gắn kiểu cho thân API giả: tsc gốc bắt máy chủ trôi, tsc
 *   web bắt màn hoặc bài test đọc một khoá không tồn tại.
 * ⚠ Server trả ID + SỐ (D26). Mốc thời gian đi dây là chuỗi ISO (`Date` của pg tự thành chuỗi khi `c.json`).
 */

/* ── Khoảng ──────────────────────────────────────────────────────────────── */

export interface Khoang {
  tu: string;
  den: string;
  so_ngay: number;
  hom_nay: string;
  ky_truoc: { tu: string; den: string };
}

/** Khoảng trả về kèm ngày đầu còn đủ telemetry thô (luật 5). */
export interface KhoangTraVe extends Khoang {
  tho_tu: string;
}

/* ── Tổng quan ───────────────────────────────────────────────────────────── */

/** "Quay lại tuần 2" = có phiên trong ngày 7–13 sau ngày tạo tài khoản (ngày VN). */
export interface QuayLai {
  /** Người trong nhóm ĐO ĐƯỢC: cửa tuần 2 đã khép (≤ hôm nay) và còn nằm trong vùng telemetry thô. */
  nhom: number;
  co: number;
  /** Cửa tuần 2 chưa tới hôm nay — chưa biết, không phải "không quay lại". */
  chua_toi: number;
  /** Cửa tuần 2 rơi trước `tho_tu` — dữ liệu đã hết hạn. */
  het_tho: number;
}

export interface OSo {
  tai_khoan_moi: number;
  tai_khoan_moi_khach: number;
  tran: number;
  tran_xong: number;
  tran_bo_do: number;
  tran_dang_choi: number;
  /** `false` ⇒ cả khoảng nằm trước `tho_tu`: bốn số hành vi dưới đây không đo được (null). */
  do_duoc: boolean;
  /** `true` ⇒ phần đầu khoảng nằm trước `tho_tu`: số hành vi chỉ tính từ `tho_tu`. */
  cat_tho: boolean;
  nguoi_hoat_dong: number | null;
  phien: number | null;
  phien_co_thoi_luong: number | null;
  ms_moi_phien_tv: number | null;
  quay_lai: QuayLai;
}

export interface NgayChuoi { ngay: string; tai_khoan_moi: number; nguoi_hoat_dong: number | null }

export interface Pheu {
  tao_tai_khoan: number;
  xac_minh: number;
  lap_ho_so: number;
  bat_ghi: number;
  /** null ⇒ khoảng bắt đầu trước `tho_tu`: dấu "xong màn tập" của phần đầu nhóm đã hết hạn. */
  xong_tap: number | null;
  vao_tran: number;
  xong_3_tran: number;
  quay_lai: QuayLai;
}

/** Một ô giữ chân: đo được (có tỷ lệ) · ít người · chưa tới · hết dữ liệu thô. */
export type OGiuChan =
  | { trang_thai: 'co'; n: number; co: number }
  | { trang_thai: 'it' }
  | { trang_thai: 'chua_toi' }
  | { trang_thai: 'het_tho' };

export interface HangGiuChan { tu: string; den: string; n: number | null; tuan: OGiuChan[] }

export interface DongMan { man: string; luot: number; nguoi: number; ms_tong: number; ms_moi_nguoi_tv: number | null }

export interface DongLoi { man: string | null; loai: 'loi_api' | 'loi_client'; ma: string | null; n: number }

/** `GET /api/v1/admin/pt/tong-quan` */
export interface TongQuanTraVe {
  khoang: KhoangTraVe;
  gom: boolean;
  san: number;
  pham_vi: { tat_ca: number; bat_ghi: number };
  nay: OSo;
  truoc: OSo;
  chuoi: NgayChuoi[];
  pheu: Pheu;
  giu_chan: HangGiuChan[];
  man: DongMan[];
  loi: DongLoi[];
}

/* ── Người dùng ──────────────────────────────────────────────────────────── */

export interface DongNguoi {
  handle: string;
  tao: string;
  tuoi: string;
  vung: string;
  nghe: string;
  bat_ghi: boolean;
  quan_tri: boolean;
  thu: boolean;
  khach: boolean;
  /** null ⇒ người đang tắt ghi (luật 4) — không phải 0. */
  phien: number | null;
  tran: number;
  lan_cuoi: string | null;
}

/** `GET /api/v1/admin/pt/nguoi` */
export interface DsNguoiTraVe {
  khoang: KhoangTraVe;
  gom: boolean;
  trang: number;
  moi_trang: number;
  tong: number;
  nguoi: DongNguoi[];
}

/** Một sự kiện đã chuẩn hoá cho màn — chỉ ID + SỐ (D26), chữ ở client. */
export type SuKien =
  | { loai: 'man'; ts: string; man: string; ms: number | null }
  | { loai: 'roi_man'; ts: string; man: string; ms: number | null }
  | { loai: 'cham'; ts: string; nut: string | null; man: string | null }
  | { loai: 'loi'; ts: string; nguon: 'api' | 'client'; ma: string | null; man: string | null }
  | { loai: 'tai_chinh'; ts: string; ma: string }
  | { loai: 'huong_dan'; ts: string; buoc: string | null }
  | { loai: 'dang_nhap'; ts: string }
  | { loai: 'tran_vao'; ts: string; so_o: number | null; che_do: string | null; buoi_do: boolean }
  | { loai: 'tran_ket'; ts: string; trang_thai: 'xong' | 'bo_do'; hang: number | null; so_ghe: number | null; buoi_do: boolean }
  | { loai: 'token'; ts: string; delta: number; ly_do: string };

export interface Phien {
  /** null ⇒ khối không có dòng mở phiên trong khoảng (bắt đầu trước khoảng, hoặc dòng cũ thiếu). */
  bd: string | null;
  kt: string | null;
  ms: number | null;
  /** true ⇒ có dòng mở mà không có dòng đóng (đóng app đột ngột / mất mạng) — thời lượng không rõ. */
  thieu_dong: boolean;
  su: SuKien[];
}

export interface NgayDong { ngay: string; phien: Phien[]; ngoai_phien: SuKien[] }

/** `GET /api/v1/admin/pt/nguoi/:handle` */
export interface MotNguoiTraVe {
  khoang: KhoangTraVe;
  ho_so: {
    handle: string; tao: string; tuoi: string; vung: string; nghe: string;
    bat_ghi: boolean; quan_tri: boolean; thu: boolean; khach: boolean; tong_tran: number;
  };
  /** Ba số đầu null ⇒ người đang tắt ghi. */
  o: { phien: number | null; ms_trong_app: number | null; loi: number | null; tran: number };
  /** 7 × 24 (thứ Hai trước), null ⇒ người đang tắt ghi. */
  gio: number[][] | null;
  ngay: NgayDong[];
  /** Ngày cũ nhất đã trả — gửi lại làm `truoc` để đọc tiếp; null ⇒ hết. */
  con_nua_truoc: string | null;
}

/* ── Phân khúc ───────────────────────────────────────────────────────────── */

export interface DieuKien {
  tao_tu?: string;
  tao_den?: string;
  tuoi?: string[];
  vung?: string[];
  nghe?: string[];
  /** Số trận ĐÃ XONG (có kết quả), cả đời tài khoản. */
  tran_tu?: number;
  /** Có phiên trong N ngày gần nhất (1–90 — telemetry thô). */
  vao_trong_ngay?: number;
  xong_tap?: boolean;
  dung_tai_chinh?: boolean;
}

export interface NhomLuu { id: string; ten: string; dieu_kien: DieuKien; tao_luc: string; tao_boi: string }

/** `GET /api/v1/admin/pt/phan-khuc` */
export interface DsNhomLuuTraVe { nhom: NhomLuu[] }

/** `POST /api/v1/admin/pt/phan-khuc` */
export interface LuuNhomTraVe { id: string; ten: string; dieu_kien: DieuKien }

export interface ChiSoNhom {
  n: number;
  vao_app: number | null;
  phien: number | null;
  ms_moi_phien_tv: number | null;
  tran: number;
  xong_tap: number;
  dung_tai_chinh: number;
  quay_lai: QuayLai;
}

/** `POST /api/v1/admin/pt/phan-khuc/tinh` — nhóm dưới sàn: `{ n: null, chi_so: null }`. */
export interface TinhNhomTraVe {
  khoang: KhoangTraVe;
  gom: boolean;
  san: number;
  nhom: Array<{ n: number | null; chi_so: ChiSoNhom | null }>;
}

export type TheoChia = 'tuoi' | 'vung' | 'nghe' | 'so_tran' | 'tuan_tao';

/** Nhóm con dưới sàn: số null nhưng DÒNG VẪN CÒN (`n: 0` chỉ khi không có ai). */
export interface ONhomChia { khoa: string; n: number | null; tran: number | null; quay_lai: { nhom: number; co: number } | null }

/** `POST /api/v1/admin/pt/phan-khuc/chia` */
export interface ChiaNhomTraVe {
  khoang: KhoangTraVe;
  gom: boolean;
  san: number;
  theo: TheoChia;
  n: number | null;
  nhom: ONhomChia[];
}

/* ── Khu SẢN PHẨM (D341) — năm mặt đọc THEO KHOẢNG, URL giữ `/admin/tk/*` ─────────────────────────────────── */
/*
 * Trước D341 năm hình dạng này sống ở `web/src/api/thongke.ts` dưới dạng interface chép tay — đúng kiểu "hai bản"
 * mà đầu tệp này kể. Chuyển về đây cùng lúc năm route được viết lại (`server/admin_san_pham.ts`).
 */

/** Một bậc phễu. `so_nguoi` ở màn đăng ký là LƯỢT MỞ MÀN (tên khoá giữ để một hàm vẽ dùng chung). */
export interface BacPheuSP { buoc: string; so_nguoi: number; ty_le_con_lai: number | null }
export interface DemMa { ma: string; n: number }
export interface DemMan { man: string; n: number }

/**
 * "Màn cuối trước khi biến mất" — ba trạng thái, không có "bảng rỗng" mơ hồ (trước D341 mốc Hôm nay rỗng VĨNH VIỄN:
 * "trong 24 giờ qua" và "im hơn 24 giờ" không bao giờ cùng đúng).
 *  · `co` — người có lần xem màn CUỐI CÙNG rơi vào phần đo được của khoảng, trước `tinh_toi` (= hết khoảng, nhưng
 *    không muộn hơn 24 giờ trước lúc đọc).
 *  · `chua_du_24h` — cả phần đo được của khoảng nằm trong 24 giờ qua: chưa ai "biến mất" được.
 *  · `khong_do_duoc` — cả khoảng nằm trước `tho_tu`.
 */
export type ManCuoiSP =
  | { trang_thai: 'co'; tinh_toi: string; dong: DemMan[] }
  | { trang_thai: 'chua_du_24h' }
  | { trang_thai: 'khong_do_duoc' };

/** `GET /api/v1/admin/tk/hanh-trinh?tu&den` — mọi khối `| null` là khối đọc telemetry thô: null = không đo được. */
export interface HanhTrinhTraVe {
  khoang: KhoangTraVe;
  gom_admin: boolean;
  gom_tester: boolean;
  /** `false` ⇒ cả khoảng nằm trước `tho_tu`. */
  do_duoc: boolean;
  /** `true` ⇒ phần đầu khoảng nằm trước `tho_tu`: khối telemetry chỉ tính từ `tho_tu`. */
  cat_tho: boolean;
  /** NHÓM = tài khoản email tạo trong khoảng; ba bậc sau theo chính nhóm đó tới hôm nay. */
  phieu_dang_ky: BacPheuSP[];
  man_dang_ky: BacPheuSP[] | null;
  loi_client: DemMa[] | null;
  dang_nhap: { so_lan: number; giay_p50: number | null; giay_p90: number | null } | null;
  sau_dang_nhap: DemMan[] | null;
  huong_dan: {
    bat_dau: number; di_het: number; tu_tat: number;
    /** Nhóm = người đi hết màn hướng dẫn trong khoảng; "ở lại" = có mở màn/phiên sau đó, kể cả sau khoảng. */
    xong_roi_o_lai: number; xong_roi_di_luon: number;
    buoc: BacPheuSP[];
  } | null;
  /**
   * BÀN TẬP — mặt SẢN PHẨM của màn dạy (D359, founder 20/09: *"bàn tập chỉ thu dữ liệu product
   * cho phần hướng dẫn thôi"*).
   *
   * ⚠ KHÁC `huong_dan` Ở TRÊN, và khác ở NGUỒN chứ không ở cách gọi tên: `huong_dan` đọc
   * telemetry `huong_dan_buoc` (người bấm qua từng bước của trợ lý); khối này đọc TRẬN có seed
   * bàn tập (`chiTranTap`) — tức người thật sự ngồi xuống chơi ván dạy. Một người đi hết trợ lý
   * mà không chơi hết ván tập là hai con số khác nhau, và chỉ khối này thấy điều đó.
   *
   * ⚠ KHÔNG chịu công tắc `gom_tap`: ở đây bàn tập là CHỦ ĐỀ, không phải nhiễu. Bật `gom_tap=1`
   * để nhìn bàn tập trong số trận thật thì khối này vẫn y nguyên — hai câu hỏi, hai chỗ trả lời.
   */
  ban_tap: {
    so_nguoi_vao: number; so_tran: number; so_xong: number; so_bo_do: number;
    /** Bỏ dở ở VÒNG nào — `vong_hien_tai` lúc dừng. Đây là "tắc ở ô nào" của màn dạy. */
    bo_o_vong: Array<{ vong: number; n: number }>;
  } | null;
  /** Trận BẮT ĐẦU trong khoảng — cùng tập với ô TRẬN của khu TỔNG QUAN (một khoảng, một con số). */
  tran: {
    so_lan_vao: number; so_xong: number; so_dang_choi: number; so_lan_bo_do: number;
    phut_p50: number | null; phut_p90: number | null;
    bo_do_theo_phut: Array<{ phut: number; n: number }>;
    bo_do_theo_vong: Array<{ vong: number; n: number }>;
    /** Telemetry `tran_thoat`; luôn ≤ `so_lan_bo_do` — phần chênh là "đóng app mà đi". */
    client_kip_bao: number | null;
  };
  man_cuoi: ManCuoiSP;
}

export type GiaiDoanVer = 'hien_tai' | 'cu' | 'khong_dung_lai_duoc';

/** `GET /api/v1/admin/tk/tran?ver&tu&den` */
export interface TranTraVe {
  khoang: KhoangTraVe;
  gom_admin: boolean;
  gom_tester: boolean;
  loc: {
    che_do: 'hien_tai' | 'dung_lai_duoc' | 'tat_ca'; ver: string | null; ver_hien_tai: string;
    giai_doan: GiaiDoanVer | null;
  };
  /** Cỡ mẫu đi kèm con số (D123) — trận BẮT ĐẦU trong khoảng, qua bộ lọc phiên bản. */
  mau: { tran: number; xong: number; nguoi: number; san_tin_cay: number; mong: boolean };
  phan_bo_hang: Array<{ hang: number; so_ghe: number; n: number }>;
  /** Telemetry `tran_thoat` — GỘP MỌI PHIÊN BẢN (schema không chở phiên bản); `null` = không đo được. */
  thoat_theo_vong: Array<{ vong: number; n: number }> | null;
  thoat_khong_loc_duoc_ver: true;
  /** Chuỗi tính trên các trận TRONG khoảng — chuỗi vắt qua đầu khoảng bị cắt ở đầu khoảng. */
  chuoi_ve_bet: { dai_nhat: number; so_lan_tu_3: number; nguoi_dinh: number };
}

/** `GET /api/v1/admin/tk/keo?tu&den` */
export interface KeoTraVe {
  khoang: KhoangTraVe;
  gom_admin: boolean;
  gom_tester: boolean;
  /** Trên các lượt đặt TRONG khoảng, gom theo (người, kèo). */
  khau_vi_rui_ro: { n: number; tb: number | null; p50: number | null; tat_tay: number };
  dat_truoc_gio_khoa: Array<{ o: number | null; n: number }>;
  /** Nhóm = người thấy pool lần đầu TRONG khoảng; "chỉnh sau" tính cả sau khoảng. */
  bay_dan: { da_thay: number; co_chinh_sau: number };
  /** Kèo MỞ trong khoảng hoặc có người đặt trong khoảng; người/volume chỉ tính lượt đặt trong khoảng. */
  keo_trong_khoang: Array<{
    market_id: string; question_text: string; pool: string; status: string; nguoi: number; volume: string;
  }>;
}

/** `GET /api/v1/admin/tk/tinh-cach?tu&den` */
export interface TinhCachTraVe {
  khoang: KhoangTraVe;
  gom_admin: boolean;
  gom_tester: boolean;
  /** Người ĐÃ đồng ý, có ít nhất một trận bắt đầu trong khoảng, và có hồ sơ (founder chốt 16/09). */
  n_nguoi: number;
  bo_qua_chua_dong_y: number;
  san_o: number;
  /** Hồ sơ dựng trên CẢ LỊCH SỬ của những người đó — độ trộn phiên bản đo trên chính các vòng ấy. */
  tron_phien_ban: {
    so_phien_ban: number; n_vong: number; n_vong_khong_dung_lai_duoc: number;
    ty_le_khong_dung_lai_duoc: number; ver_hien_tai: string;
  };
  phan_bo: Record<string, number>;
  trung_binh: Record<string, number | null>;
}

export interface DongPhienBan {
  ver: string;
  che_do: string;
  giai_doan: GiaiDoanVer;
  nhan_giai_doan: string;
  mau_mong: boolean;
  tran: number; xong: number; dang_choi: number; bo_do: number;
  nguoi: number; ghe_nguoi: number;
  /** Event của CHÍNH các trận trong dòng này (theo phiên bản VÀ chế độ). */
  n_events: number;
  /** Ngày VN của trận đầu / trận cuối TRONG khoảng. */
  tu: string;
  den: string;
  co_map: number[];
}

/** `GET /api/v1/admin/tk/phien-ban?tu&den` — kho theo phiên bản, của các trận BẮT ĐẦU trong khoảng. */
export interface PhienBanTraVe {
  khoang: KhoangTraVe;
  gom_admin: boolean;
  gom_tester: boolean;
  ver_hien_tai: string;
  san_tran_tin_cay: number;
  dong: DongPhienBan[];
  tong: { tran: number; events: number; so_phien_ban: number };
  bi_cat: { tran: number; events: number; phien_ban: string[]; ty_le_tran: number };
  context_da_chet: string[];
}
