/**
 * ALPHA DRAFT — DTO + hooks. Hợp đồng: `docs/ui-ux/holdem_frontend_build_spec.md`.
 *
 * NĂM LUẬT CỨNG mã hoá ngay ở tầng này:
 *  1. SERVER LÀ CHÂN LÝ (C4) — client KHÔNG tính PnL, không đoán trước kết quả
 *     để chạy hiệu ứng sớm. Mọi con số hiển thị là số server trả về.
 *  2. `chain` là TRỤC của màn chốt phiên: vừa là bảng giải thích "vì sao"
 *     (yêu cầu cứng D26 §18.5) vừa là kịch bản diễn hoạt hình. MỘT dữ liệu,
 *     không dựng hai hệ thống song song.
 *  3. THÔNG TIN ẨN — server không gửi `la_tin_gia` và không gửi `chain` của
 *     đối thủ. Đừng gọi autopsy giữa trận để đọc trộm.
 *  4. `R1-logged ⊆ UI-luôn-hiện` (D25/R1) — `doi_thu[]` phải render vô điều
 *     kiện. Không accordion, không tab. Xem AlphaDraftMatch.
 *  5. KHÔNG token T, không ví, không lối sang cược trong toàn mode này.
 */
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { boCucHienTai } from '@/lib/bo_cuc';
import { api, ApiError } from './client';
import { baoTranMoCoi, quaHangSuat } from './suatTran';
import { queryKeys } from './queries';
import { CONSENT_PHIEN_BAN } from '@config/pfm_consent';
import type { NangLucId } from '@config/nang_luc';
import type { TuyChonLenhGhe } from '@server/holdem/engine';
import type { HangCongBo } from '@/components/holdem/ChuHang';

// ══════════════════════════ Kiểu ══════════════════════════

export interface TaiSanDTO {
  id: string;
  label: string;
  icon: string;
  nhom: 'rui_ro' | 'phong_thu';
  thanh_khoan: 'mong' | 'vua' | 'day';
  bien_dong_bp: number;
}

export interface ChienThuatDTO {
  id: string;
  label: string;
  icon: string;
  mo_ta: string;
  /**
   * D3 — `tai_san` thì GẮN vào một mã; `danh_muc` thì không gắn được.
   *
   * Client KHÔNG tự suy danh sách thẻ nào thuộc loại nào: thêm một thẻ toàn-danh-mục
   * mới mà quên sửa client là UI hỏi "gắn vào đâu" cho thẻ không có chỗ nào để gắn.
   *
   * ⚠ 01/08 — trường này KHÔNG còn quyết UI hỏi gắn nữa, `ghim` mới quyết
   * (founder: lá chức năng bị bắt "áp vào 1 mã" vô nghĩa). Giữ lại vì server
   * vẫn gửi và log cũ vẫn cần nó.
   */
  pham_vi: 'tai_san' | 'danh_muc';
  /**
   * Founder 01–02/08 — CHỈ lá `ghim: true` mới hỏi "GẮN VÀO MÃ NÀO?", và nay
   * đó là MỖI Đòn Bẩy (founder sửa 02/08: Chia Lệnh = quyền mốc mịn 5%,
   * Khớp Nhanh = đặc quyền trượt giá cá nhân — cả hai là hiệu ứng CỦA NGƯỜI,
   * không có mã nào để áp). Lá ghim đổi mã gắn lại được MỖI VÒNG (D40).
   */
  ghim?: boolean;
}

export interface VaiDTO {
  id: string; ten: string; he_so_von: number; loi_ghim: string | null;
  tac_dong_gia: number; dac_quyen: string; cai_gia: string; cho_nguoi: boolean;
}

export interface NhanDTO { id: string; label: string; icon: string }

export interface LuatDTO {
  SEATS: number;
  START_VON: number;
  CAM_KET_NEN: number;
  MAX_TAI_SAN: number;
  MAX_CHIEN_THUAT: number;
  SHOP_CHIEN_THUAT: number;
  CHI_PHI_KHAO_SAT_LAI: number;
  TRAN_TANG_CAM_KET_BP: number;
  /**
   * Phí mở Bảng điện tử (`BANG_DIEN_TU.PHI_MO`) — CHƯA CHẮC có trong catalog.
   *
   * Nút mở bảng phải NIÊM YẾT GIÁ TRƯỚC khi bấm, mà giá chỉ nằm trong payload
   * của chính lần mở đã trả tiền. Nên nó phải tới từ catalog. Optional vì
   * endpoint đang do người khác dựng; chừng nào thiếu thì nút rơi về
   * `PHI_BANG_DIEN_TU_MAC_DINH` — xem điều kiện gỡ ở hằng số đó.
   */
  PHI_BANG_DIEN_TU?: number;
  /** v10 — bước mốc phân bổ: MỊN (đặc quyền Chia Lệnh) và THÔ (mặc định). */
  BUOC_MOC_BP?: number;
  BUOC_MOC_THO_BP?: number;
}

export type LoaiTheVong = 'tai_san' | 'chien_thuat' | 'khong' | 'ky_ngo';

/**
 * TỰ ĐIỂN THẺ — nội dung cho nút (!) trên mặt thẻ (server/holdem/tu_dien.ts).
 *
 * ⚠ CHỈ MỨC ĐỘ, KHÔNG CON SỐ. Founder bác bản đầu (25/07) vì nó hiện +/- % chính
 * xác cho từng tài sản × giai đoạn: "cho hiện thị hết ra rõ ràng +/- bao nhiêu %
 * thì game sẽ bị dễ đoán và nhanh chán". Bảng số biến trò chơi thành bài toán tra
 * bảng, và đọc-thị-trường là thứ duy nhất mode này muốn đo (A1).
 *
 * Việc cắt số làm Ở SERVER, không ở tầng render — bp lọt vào payload thì F12 vẫn
 * moi ra được. Có test grep bắt bp rò rỉ: tests/progression.test.ts.
 */
export type MucDinhTinhDTO = 'rat_tot' | 'tot' | 'trung_tinh' | 'xau' | 'rat_xau';

/** [id giai đoạn hoặc sự kiện, mức]. Đã xếp mạnh → yếu ở server. */
export type CapTuDien = [string, MucDinhTinhDTO];

export interface TuDienTaiSanDTO {
  /** Mô tả khái quát đặc điểm + tác dụng. */
  mo_ta: string;
  giai_doan: CapTuDien[];
  su_kien: CapTuDien[];
  /**
   * Cảnh báo đuôi (founder chốt A, 00b §6.3): mã "tốt trên giấy" trong khủng
   * hoảng thanh khoản nhưng β kéo sập cùng đám đông. Server suy từ config —
   * vắng nghĩa là mã này không có mâu thuẫn đó, không phải thiếu dữ liệu.
   */
  luu_y?: string;
}

export interface TuDienChienThuatDTO {
  xung_dot: string[];
  cong_huong: string[];
  su_kien?: CapTuDien[];
  canh_nhip?: {
    sau_giai_doan: string;
    trung_khi: string[];
    /** Bắt trượt trả giá nặng hơn bắt trúng — hình dạng rủi ro, không phải số. */
    truot_nang_hon: boolean;
  };
  phong_thu?: { an_khi: string[]; phi_khi: string[] };
  da_dang?: true;
  nhan_doi?: true;
  /** D530 — khoá v60: lá chỉ tác động trong MÀN LÕI (server không gửi các khối cũ). */
  trong_man?: true;
  /**
   * ĐẶC QUYỀN — thứ người chơi NHẬN ĐƯỢC khi chọn lá này (founder 27/07).
   * Server dựng từ `DAC_QUYEN` trong config, client chỉ in ra. Vắng ⇒ lá đó chưa
   * có đặc quyền, và đó là sự thật chứ không phải thiếu dữ liệu.
   */
  dac_quyen?: string[];
}

export interface TuDienDTO {
  tai_san: Record<string, TuDienTaiSanDTO>;
  chien_thuat: Record<string, TuDienChienThuatDTO>;
}

/**
 * BẢNG GIÁ ĐẢO DANH MỤC — `config/holdem.ts` → `DAO_DANH_MUC`.
 *
 * ⚠ MỌI SỐ Ở ĐÂY LÀ `MC-TUNE`: Monte Carlo còn chỉnh chúng mỗi mùa. Nên client
 * KHÔNG được gõ lại một con số nào — chép tay là màn hình niêm yết một đằng,
 * engine trừ một nẻo, và người chơi không có cách nào biết bên nào đúng.
 */
export interface DaoDanhMucDTO {
  TU_VONG: number;
  PHI_CHUYEN_DOI_BP: number;
  HE_SO_XEP_HANG_K: number;
  NGUONG_XEP_HANG: number;
}

/** BẢNG GIÁ KHOÁ TÀI SẢN — `config/holdem.ts` → `KHOA_TAI_SAN`. Cùng luật trên. */
export interface KhoaTaiSanDTO {
  SO_VONG: number;
  TRUOT_GIA_CON_BP: number;
  THUONG_SONG_SOT_BP: number;
  /** Giai đoạn nào tính là "bão" — id giai đoạn, dịch nhãn qua `catalog.giai_doan`. */
  GIAI_DOAN_BAO: string[];
  PHAT_BE_KEO_BP: number;
  GIAM_VON_SO_VONG: number;
}

/**
 * v43 — bảng ngân hàng. ⚠ KHÔNG có lãi ở đây, và đó là chủ ý: lãi neo lãi suất
 * nền ĐANG công bố nên nó đổi theo ô kỳ họp ⚖. Lãi của vòng này ở
 * `ban.tiet_kiem_bao_gia`; một hằng số ở catalog sẽ là con số của vòng nào đó
 * không xác định, và niêm yết sai lãi là lỗi tiền.
 */
export interface TietKiemDTO {
  MOC: readonly number[];
  O_MOI_NAM: number;
  GOC_TOI_THIEU: number;
  TRAN_SO_HOP_DONG: number | null;
  TRAN_MO_MOI_VONG: number;
}

export interface CatalogDTO {
  /**
   * Nhịp chọn bài của cỡ map MẶC ĐỊNH.
   *
   * ⚠ Từ D34 nhịp CO THEO CỠ MAP, nên khi đã vào bàn thì phải ưu tiên
   * `st.ban.nhip_chon_bai` — thứ tính theo map THẬT của trận. Bảng này chỉ còn
   * dùng cho sảnh, lúc chưa có trận nào để hỏi.
   */
  nhip_chon_bai: LoaiTheVong[];
  /** D34 — ba vòng chọn thẻ chiến thuật ở cỡ map mặc định. */
  vong_chon_chien_thuat?: number[];
  so_the_chien_thuat?: number;
  /** D33 — ba hạng giá Bảng điện tử (chưa tính thẻ của ghế cụ thể). */
  gia_bang?: { thuong: number; luot_song: number; luot_song_du_bao: number };
  /** Hệ số stack theo số bản sao (bp): [10000, 16000, 20000]. */
  cap_stack_bp: number[];
  /**
   * Hai bảng giá của lõi vốn. OPTIONAL: frontend và API deploy bằng hai lệnh
   * riêng nên "API cũ hơn bundle" là trạng thái bình thường — thiếu bảng giá thì
   * panel tự ẩn (xem `QuanTriVon`) chứ KHÔNG được đoán số rồi vẫn cho bấm.
   */
  dao_danh_muc?: DaoDanhMucDTO;
  khoa_tai_san?: KhoaTaiSanDTO;
  /** v43 — OPTIONAL cùng lý do hai bảng trên: API cũ hơn bundle là bình thường. */
  tiet_kiem?: TietKiemDTO;
  /** v46 (D338) — mức lãi vay Đòn Bẩy (bp/ô cộng trên lãi nền quy ra ô). VẮNG = bộ luật mặc định không có lãi vay. */
  lai_vay_don_bay?: { HE_SO_NEN_BP: number; PHAN_BU_BP: number };
  engine_version: string;
  balance_version: string;
  luat: LuatDTO;
  /** `CO_MAP_CHON` optional: catalog cũ trong cache chưa có — sảnh tự rơi về [8,12,16]. */
  quyet_dinh: {
    MAP_SIZE: number; SHOWDOWN_MODEL: 'A' | 'B'; CO_MAP_CHON?: readonly number[];
    /** D53 — vòng cuối màn tập TẠM DỪNG đồng hồ; coach đọc để nói đúng số vòng. */
    MAN_TAP_MIEN_GIO_DEN_VONG?: number;
    /** D300 — cỡ bàn sảnh chọn sẵn (12: có vai + kỳ ngộ). Catalog cũ vắng ⇒ sảnh về 12. */
    MAP_MAC_DINH_SANH?: number;
  };
  /** v34 — bảng vai (server là nguồn chữ: tên · đặc quyền · cái giá). Catalog cũ vắng. */
  vai?: Record<string, VaiDTO>;
  mandate_to_chuc?: { TRAN_MA_BP: number };
  tai_san: TaiSanDTO[];
  chien_thuat: ChienThuatDTO[];
  giai_doan: NhanDTO[];
  su_kien: NhanDTO[];
  tu_dien: TuDienDTO;
  /** D6 — khẩu vị rủi ro: danh sách + hệ số, server cấp để sảnh khỏi chép luật. */
  khau_vi: KhauViDTO[];
  /** D406 — v54: mọi ghế chơi khẩu vị mặc định ⇒ sảnh ẩn khối chọn. Vắng = còn chọn được (catalog cũ / khoá cũ). */
  khau_vi_tat?: true;
  /**
   * v32 — bảng BỐN nhiệm vụ kỳ ngộ (tên · mô tả · icon · đặc quyền).
   *
   * OPTIONAL vì cùng lý do với `dao_danh_muc`: API và bundle deploy bằng hai
   * lệnh riêng, nên "API cũ hơn bundle" là trạng thái bình thường — thiếu bảng
   * thì màn chọn tự ẩn, KHÔNG được đoán câu chữ rồi vẫn cho bấm.
   */
  nhiem_vu_ky_ngo?: NhiemVuKyNgoDTO[];
}

/** Một nhiệm vụ kỳ ngộ — câu chữ và tên icon do SERVER cấp (một nguồn, D61). */
export interface NhiemVuKyNgoDTO {
  id: NhiemVuIdDTO;
  ten: string;
  /** Tên lưới `PixelIcon` — KHÔNG emoji (D47). */
  icon: string;
  mo_ta: string;
  dac_quyen: DacQuyenKyNgoIdDTO;
  ten_dac_quyen: string;
  mo_ta_dac_quyen: string;
}

/** D6 — một mức khẩu vị rủi ro. Hệ số nhân PnL CẢ HAI CHIỀU (kỳ vọng không đổi). */
export interface KhauViDTO {
  id: 'than_trong' | 'can_bang' | 'quyet_liet';
  label: string;
  icon: string;
  he_so_bp: number;
  mo_ta: string;
}

/** Ô thị trường ĐÃ LỌC — không bao giờ mang cờ `la_tin_gia` khi đang chơi. */
export type ODTO = (
  /* D560 — `tinh_chat` của LÁ PHA (khoá chu kỳ có ngòi): tich_luy · phan_phoi · dong_tien · tang_truong · gau_su_kien · gau_dinh_gia ·
     gau_chu_ky — icon góc phải (`TINH_CHAT_PHA`, lib/la_bai). Vắng ở mọi khoá cũ. */
  | { kind: 'giai_doan'; giai_doan: string; tinh_chat?: string }
  /*
   * `tinh_chat` (D152/K1) — TÍNH CHẤT của Ô, server tính theo ngữ cảnh, client
   * chỉ vẽ (tra icon+tên ở `TC_ICON`/`TC_TEN`, MarketMap). Hôm nay là tính chất
   * NỀN theo loại tin (van_tien · hung_phan · hoang_loan · lech_ma); v35 thêm
   * tương tác thẻ thì cùng trường này chở tính chất NGỮ CẢNH — cùng một tin,
   * đứng sau chuỗi khác nhau, tính chất khác nhau (founder 29/08). Optional vì
   * server bản cũ chưa gửi.
   */
  | { kind: 'su_kien'; su_kien: string; bao_truoc: string; tinh_chat?: string }
  /*
   * v55 (D422) — LỚP CHE của riêng người mang trait (server che, client chỉ vẽ — C4):
   * · `che` — MÙ TIN: lá TIN lật ra bị che (mắt gạch chéo), chỉ còn dải tăng/giảm của các mã;
   * · `suong` — SƯƠNG MÙ: lá PHA mới lật hiện HAI mặt (một thật một mồi, thứ tự ngẫu nhiên), vòng sau tan.
   */
  | { kind: 'che' }
  | { kind: 'suong'; hai_mat: string[] }
) & {
  /** D302 — ô đã lật mà từng bị đám đông đổi. Xem `ODoiDTO`. */
  doi?: ODoiDTO;
};

/**
 * TRẠNG THÁI CẢM XÚC của một ghế — SERVER suy, client chỉ vẽ.
 *
 * Client tuyệt đối không tự tính từ `von`: cả bàn phải thấy CÙNG một trạng thái
 * của cùng một ghế, và trạng thái này được LOG (D25/R1) nên nó phải là đúng thứ
 * server đã gửi — client tính thì log không bao giờ khớp thứ đã hiển thị.
 * Ngưỡng ở `config/holdem.ts` → `FX_GHE` / `fxCuaGhe()`.
 */
export type FxGheDTO = 'binh_thuong' | 'lai_dam' | 'lo_dam' | 'nguy_kich' | 'chay';

export interface DoiThuDTO {
  ghe_id: string;
  loai: 'nguoi' | 'bot' | 'bong';
  ten: string;
  bac_rank: string;
  /** VAI của ghế — lộ từ đầu (22/08). Vắng = không có vai. */
  vai?: string;
  /** D528 — khoá v59: ghế CÓ vai nhưng bị giấu với bạn (cần trait SOI VAI). Có cờ này thì `vai` vắng. */
  vai_an?: true;
  /**
   * v10 NAV — đối thủ chỉ lộ NAV (danh mục ẨN, D40 "lừa nhau bằng THÔNG TIN";
   * `von` được server đặt = NAV để che luôn tiền mặt). `tai_san_thay` CHỈ có
   * khi mình cầm ĐI NGƯỢC SỐ ĐÔNG: danh sách MÃ ghế đó đang cầm — thấy GÌ,
   * không thấy BAO NHIÊU.
   */
  nav?: number;
  tai_san_thay?: string[];
  /** v55 (D409) — nấc NGỌN LỬA ĐÀ của ghế (0–3), công khai như hạng phong cách. Vắng = trận không cổng `lua`. */
  lua_nac?: number;
  /**
   * Chuỗi diện mạo 19 ký tự — CHỈ ghế người.
   *
   * ⚠ Ghế BOT không có trường này, và đó là hai SHAPE khác nhau chứ không phải
   * một shape có trường để trống: trường để trống là chỗ có ngày sẽ bị điền, mà
   * ngày đó là ngày bot có mặt người — đúng thứ D25/R3 cấm.
   *
   * Ghế của chính mình (`ghe_id === 'ban'`) KHÔNG đọc trường này mà đọc
   * `/auth/me`: diện mạo mình là thứ mình tự biết, gửi lại trong mỗi payload
   * trận là trả byte cho zero thông tin mới (D11).
   */
  dm?: string;
  /**
   * v32 — ICON CON ĐƯỜNG KỲ NGỘ của ghế này (tên lưới `PixelIcon`).
   *
   * ⚠ VẮNG MẶT khi CHÍNH NGƯỜI XEM chưa chốt lựa chọn của mình ở kỳ ngộ đó —
   * khuôn A3.1 (ẩn pool tới lần đặt đầu), che ở TẦNG API chứ không giấu bằng
   * UI. Đừng "sửa" thành `| null` rồi vẽ ô trống: vắng và null là hai câu
   * chuyện khác nhau, và cái vắng là cái không được lộ.
   */
  ky_ngo_icon?: string;
  /**
   * ⭐ D312 — HẠNG PHONG CÁCH E→SSS của ghế này, chấm trên hành vi của CHÍNH nó.
   *
   * Founder 08/09 bỏ SỐ TIỀN của đối thủ khỏi dải ghế và chốt ba thứ được hiện:
   * hạng phong cách · số thẻ đang giữ · icon con đường (sau khi họ chọn).
   * ⚠ VẮNG khi chưa chốt vòng nào (trận vừa mở) hoặc trận không NAV — vắng và
   * "E-" là hai câu khác nhau, đừng thay bằng một hạng mặc định.
   */
  phong_cach_hang?: string;
  con_song: boolean;
  /** SỐ thẻ đang cầm — công khai như poker. Danh mục cụ thể vẫn ẩn. */
  so_the: number;
  fx: FxGheDTO;
  /**
   * ⚠ `von` CỦA ĐỐI THỦ ĐÃ BỊ CẮT Ở SERVER (D312) — không phải ẩn ở UI. Ghế của
   * CHÍNH mình vẫn có (dựng ở `DoiThuStrip` từ `st.ban`), nên trường này chỉ
   * tồn tại cho hàng 'ban'. Đọc nó cho một ghế đối thủ luôn ra `undefined`.
   */
  von?: number;
}

/** Hành động cược — thông tin CÔNG KHAI, ai cũng thấy ai làm gì. */
export type HanhDongDTO = 'giu_vi_the' | 'tang_cam_ket' | 'cat_lo';

/**
 * D302 — HƯỚNG LỆNH của một ghế ở vòng vừa chốt (trận NAV). Máy cược tắt từ v10a
 * nên `hanh_dong` là GIỮ VỊ THẾ cho cả bàn mọi vòng; đây mới là "stand/hit" của
 * trận NAV: `vao` mua/mở khống · `ra` bán/đóng khống · `dao` vừa vào vừa ra ·
 * `dung` không lệnh. Chỉ hướng — không mã, không cỡ. VẮNG ở trận cũ không NAV.
 */
export type HuongLenhDTO = 'vao' | 'ra' | 'dao' | 'dung';

/**
 * D302 — CÚ ĐỔI Ô do đám đông (luật 03 §3: lộ ex-post BẮT BUỘC). `tu`/`den` là id
 * ô (giai đoạn hoặc sự kiện); `vi`: `don`/`tron` = cả bàn dồn vào rủi ro / trốn
 * vào phòng thủ hai vòng liền · `len`/`xuong` = phe ngược chuỗi giữ phần lớn vốn
 * bàn nên chuỗi bị bẻ. Chỉ có ở ô ĐÃ LẬT — ô đang mở không bao giờ mang.
 */
export type ODoiDTO =
  | { boi: 'phan_than'; tu: string; den: string; vi: 'don' | 'tron' }
  | { boi: 'be_chuoi'; tu: string; den: string; vi: 'len' | 'xuong' };

export interface ShopDTO {
  tai_san: string[];
  chien_thuat: string[];
  lan_khao_sat: number;
  chi_phi_lan_sau: number;
}

/**
 * v55 (D409) — CHỢ TRAIT ở vòng mốc: `moi` = 3 TÀI + 3 TẬT (id, chữ ở `lib/trait_chu.ts` — D26); phần lấy phải cân đúng 0.
 * `gia_cuon[k]` = giá xu của lần cuộn thứ k+1; server trừ xu lúc CHỐT VÒNG (không trạng thái, cùng nếp `khao_sat_lai`).
 */
export interface ChoTraitDTO {
  moc: number;
  lan_cuon: number;
  moi: string[];
  gia_cuon: readonly number[];
  cuon_toi_da: number;
}

/**
 * Một mắt xích dây chuyền. Thứ tự mảng LÀ thứ tự diễn — đừng sort lại.
 *
 * ⚠ PHẢI KHỚP `MatXich` ở server/holdem/engine.ts — union này chép tay, không
 * sinh tự động. Lệch là TypeScript im lặng và mắt xích lạ rơi vào nhánh
 * `default` của bảng nhãn.
 *
 * Đã dính đúng lỗi đó: bản trước chỉ biết 6 kind trong khi engine sinh 12. Sáu
 * cơ chế T1/T2/T4/T8 (chiến thuật phản ứng tin, Lướt Sóng bám dây chuyền, Khớp
 * Nhanh hoàn trượt giá, canh nhịp, đa dạng hoá, phòng thủ) đều bị dán nhãn
 * "🏋️ khuếch đại ×2" — mục "VÌ SAO" nói SAI một nửa số dòng, đúng vào chỗ
 * founder báo "chốt phiên chưa rõ ràng".
 */
export type MatXichDTO =
  | { kind: 'tai_san'; id: string; delta_bp: number; giai_doan: string; cap: number; cang_bp?: number; cang_dai?: number }
  | {
    kind: 'echo'; id: string; su_kien: string; delta_bp: number;
    /** v13 — có mặt khi mắt xích bị sức căng khuếch đại (bp). */
    cang_bp?: number;
    /** Bước 5 — dải công bố: 0 êm · 1 căng · 2 rất căng. */
    cang_dai?: number;
    /**
     * Sự kiện đã LẬT sinh ra nhánh này. Vắng mặt = chính `su_kien` đã lật.
     * Quyết định nhãn: có `tu_nhanh` thì phải ghi "hệ quả X → Y", không được ghi
     * "dư âm Y" cho một lá chưa từng xuất hiện trên map.
     */
    tu_nhanh?: string;
    /**
     * v35 (D158) — dòng VÀNG này vừa được CỘNG HƯỞNG TRÚ ẨN nhân (chiến tranh
     * + cấm vận trong cửa sổ). Server tính, client chỉ dán nhãn.
     */
    cong_huong_tru_an?: true;
    /** Tin giả — dư âm ĐẢO chiều. Nhãn phải gọi tên, số đã tự lộ chiều ngược. */
    dao?: true;
  }
  | { kind: 'crowding'; id: string; delta_bp: number; so_nguoi_dong: number }
  | { kind: 'xung_dot'; cap: [string, string]; delta_bp: number }
  | { kind: 'cong_huong'; cap: [string, string]; delta_bp: number }
  | {
    kind: 'nhan'; id: string; he_so_bp: number; delta_bp: number;
    /** Mã đang gắn Đòn Bẩy — nhãn PHẢI nêu tên, thiếu là phép nhân trông sai. */
    ma?: string;
    /** v49 (D342) — dòng này nhân phần SỔ KHỐNG của `ma`, không phải vị thế dài. */
    khong?: true;
  }
  /**
   * v49 (D342) — GIÁ CHỢ của một mã đang KHỐNG: `gia_bp` = lợi suất công khai của mã,
   * `delta_bp` = lợi suất của chính sổ khống (= −gia_bp). Nhãn nói cả hai.
   */
  | { kind: 'khong_gia'; id: string; gia_bp: number; delta_bp: number }
  /** D561 — TIN ĐÃ VÀO GIÁ: phần giá `goc_bp` của mã thành −0,7 × goc (khoá v65). */
  | { kind: 'vao_gia'; id: string; goc_bp: number; delta_bp: number }
  /** T1 — chiến thuật phản ứng với sự kiện đang nổ. */
  | { kind: 'ct_su_kien'; id: string; su_kien: string; delta_bp: number }
  /** T2 — Lướt Sóng bám ĐÚNG hay bám NHẦM dây chuyền nhân quả. */
  | { kind: 'day_chuyen'; tu: string; den: string; dung: boolean; delta_bp: number }
  /** T4 — Khớp Nhanh hoàn lại một phần trượt giá đã chịu. */
  | { kind: 'hoan_truot'; id: string; so_nguoi_dong: number; delta_bp: number }
  /** T8 — thẻ canh nhịp bắt TRÚNG hay bắt TRƯỢT. */
  | { kind: 'canh_nhip'; id: string; trung: boolean; delta_bp: number }
  /** T8 — thưởng đa dạng hoá theo số mã khác nhau đang giữ. */
  | { kind: 'da_dang'; so_ma: number; delta_bp: number }
  /** T8 — thẻ phòng thủ ĂN hay TỐN phí, tuỳ giai đoạn. */
  | { kind: 'phong_thu'; id: string; an: boolean; delta_bp: number }
  /** D1 — cặp phòng thủ triệt nửa biên tăng của tài sản đang giữ (uptrend). */
  | { kind: 'di_nguoc'; so_lech: number; so_theo: number; delta_bp: number }
  | { kind: 'doi_tac'; id: string; ty_le_bp: number; delta_bp: number }
  | {
    kind: 'khau_vi'; id: string; he_so_bp: number; delta_bp: number;
    /** v47 — mã mà hệ số này nhân phần của; VẮNG = phần còn lại của danh mục. */
    ma?: string;
    /** v49 (D342) — phần SỔ KHỐNG của `ma`. */
    khong?: true;
  }
  | { kind: 'triet_bien_tang'; cap: [string, string]; delta_bp: number }
  /** LÕI VỐN A — phí giao dịch cố định của một lần bán `tu` / mua `den`. */
  | { kind: 'dao_phi'; tu: string; den: string; delta_bp: number }
  /** LÕI VỐN A — xếp hàng khớp lệnh cùng mọi dòng tiền MỚI vào mã đó vòng này. */
  | { kind: 'xep_hang'; id: string; so_vao: number; delta_bp: number }
  /** LÕI VỐN B — phần trượt giá được hoàn lại nhờ đang khoá mã đó. */
  | { kind: 'khoa_giam_truot'; id: string; delta_bp: number }
  /** LÕI VỐN B — thưởng còn cầm mã khoá khi bão đi qua. */
  | { kind: 'khoa_thuong'; ma: string; giai_doan: string; delta_bp: number }
  /** LÕI VỐN B — phá cam kết: phạt CỘNG thu hồi toàn bộ thưởng đã nhận. */
  | {
    kind: 'be_keo'; ma: string;
    phat_bp: number; thu_hoi_bp: number; delta_bp: number;
  }
  /** D33 — Phòng Hộ: lệnh short đặt vòng trước, KHỚP ở vòng này. */
  | {
    kind: 'short'; ma: string; vong_dat: number;
    nghich_dao_bp: number; phi_bp: number; delta_bp: number;
  }
  /** D33 — Chặn Lỗ: sàn sụt giảm của phần LÕI (chưa tính trượt giá). */
  | { kind: 'chan_lo_san'; truoc_san_bp: number; san_bp: number; delta_bp: number }
  /** D33 — Khớp Nhanh hoàn trượt giá / Chặn Lỗ trả phí bảo hiểm mỗi vòng. */
  | {
    kind: 'dac_quyen'; id: string;
    ly_do: 'xep_hang' | 'dao_phi' | 'phi_bao_hiem'; delta_bp: number;
    /** v49 (D342) — mã của khoản xếp hàng được hoàn. */
    ma?: string;
  }
  /*
   * D35 hướng 1 — đòn bẩy từ cam kết. Cờ `donBayCamKet` đang TẮT ở mọi phiên
   * bản nên mắt xích này chưa phát ra ngoài đời; shape vẫn phải có mặt vì trận
   * đo bằng `DIVON_DON_BAY=1` sinh nó, và một kind thiếu shape là quay lại đúng
   * lỗi "cơ chế chưa có nhãn" vừa sửa 28/07.
   */
  | {
    kind: 'don_bay_cam_ket';
    ty_le_bp: number; he_so_bp: number; ben_lo: boolean; delta_bp: number;
  }
  /** v55 (D409) — trait CHỐT NON: phần lõi lãi bị cắt ở trần. */
  | { kind: 'chot_non_tran'; truoc_tran_bp: number; tran_bp: number; delta_bp: number }
  /** v55 (D409) — Lướt Sóng mới: lệnh CHỐT LỜI TRONG Ô khớp ở đỉnh sóng (delta có thể âm khi ô chạy quá mục tiêu). */
  | { kind: 'song'; ma: string; nguong_bp: number; dinh_bp: number; phan_bp: number; delta_bp: number }
  /** v55 (D409) — mắt xích NGỌN LỬA ĐÀ theo mã: thuận cộng thêm (D422: khoá có cổng `luaKhongPhatDao` không trừ vế đảo). */
  | { kind: 'lua'; ma: string; nac: number; thuan: boolean; he_so_bp: number; delta_bp: number }
  /** v55 (D422) — KIÊN NHẪN: mã giữ liền `giu_vong` vòng, phần lãi của nó trong vòng được cộng thêm. */
  | { kind: 'kien_nhan'; ma: string; giu_vong: number; he_so_bp: number; delta_bp: number }
  /** v55 (D422) — NÓNG VỘI: mã giữ liền quá lâu, phần lãi của nó trong vòng bị cắt (delta âm). */
  | { kind: 'nong_voi'; ma: string; giu_vong: number; he_so_bp: number; delta_bp: number };

export interface KetQuaGheDTO {
  ghe_id: string;
  pnl_bp: number;
  da_cat_lo: boolean;
  cam_ket: number;
  von_truoc: number;
  von_sau: number;
  /** Chỉ có ở ghế của MÌNH — danh mục đối thủ là thông tin ẩn. */
  chain?: MatXichDTO[];
  /**
   * v10 NAV — số chip mỗi VỊ THẾ của mình vừa được/mất ở vòng này, qua cả tầng giá riêng
   * mã lẫn tầng thẻ danh mục (`apDinhGia`, server/holdem/nav.ts). Khoá `khong:<mã>` là sổ
   * khống. Server vẫn gửi từ lâu (spread `cua_ban`), client chưa từng khai kiểu.
   * D336 — tấm VÌ SAO đọc nó để nói TIỀN của từng mã, thay vì để người chơi cộng các dòng
   * % giá (mỗi dòng một mẫu số) ra một con số không phải của ai. VẮNG ở trận không NAV.
   */
  tien_theo_ma?: Record<string, number>;
  /**
   * §7.3 — ĐỘ CHUẨN của vòng (Brier, thang 0–2, THẤP là tốt). Chỉ ghế mình.
   * `null`/vắng = vòng đó toàn tiền mặt ⇒ KHÔNG dự báo, phải bỏ qua chứ không
   * đọc thành 0 (0 nghĩa là đoán hoàn hảo — ngược hẳn).
   */
  brier?: number | null;
  /** Đã làm gì ở vòng này. Công khai — poker luôn thấy hành động đối thủ. */
  hanh_dong: HanhDongDTO;
  /** Có rút thêm bài không (HIT của blackjack). */
  da_hit: boolean;
  /** D302 — xem `HuongLenhDTO`. Có thì dải đối thủ hiện nó thay nhãn cược. */
  huong_lenh?: HuongLenhDTO;
}

export interface KetQuaVongDTO {
  vong: number;
  /**
   * D342 — CẦU NỐI NAV: mọi khoản làm NAV đổi ngoài phần giá (`cua_ban.tien_theo_ma`). Server
   * tính (C4); `tien_theo_ma` + các dòng này = NAV sau − `nav_truoc`, đúng từng chip. Id:
   * `huy_so` · `phi_giao_dich` · `phi_bang` · `nop_quy` · `trong_vong` · `quy_vong`. Dòng 0 bị lược.
   */
  cau_noi_nav?: { id: string; tien: number }[];
  o: ODTO;
  tin_gia_lo: { vong: number; su_kien: string } | null;
  quy_vong: number;
  /**
   * D402 — phần quỹ vòng từng ghế nhận (chỉ ghế > 0), `hang` 1 là suất lớn nhất — engine chia theo lãi/lỗ vòng. Client
   * vẽ xu bay từ hộp GIẢI về từng ghế ở bước LÃI/LỖ (C4: số của server). VẮNG khi không ai nhận / API cũ.
   */
  chia_quy_vong?: { ghe_id: string; hang: number; tien: number; /** D584 — khoá giải bằng xu trait: xu của suất (tien = 0). */ xu?: number }[];
  ghe_thang: string | null;
  chay_vong_nay: string[];
  cua_ban: KetQuaGheDTO | null;
  cua_doi_thu: KetQuaGheDTO[];
  /** Phí RIÊNG của mình vòng này (cắt lỗ / đứng ngoài). null = không mất phí nào. */
  phi_cua_ban: { loai: 'cat_lo' | 'dung_ngoai'; mat: number; giam_dap: boolean } | null;
  /** % lobby cùng cắt lỗ vòng này (bp) — kể chuyện giẫm đạp. */
  ty_le_cat_lo_bp: number;
  /**
   * v43 (D317) — SỔ TIẾT KIỆM động vòng này, CHỈ ghế mình (A3.1). Vắng = không
   * có gì xảy ra với sổ. Ba loại kể ba chuyện khác hẳn nhau:
   * `lai` (đang lớn lên) · `dao_han` (`lai` = cả gốc lẫn lãi vừa về ví) ·
   * `huy` (`lai_mat` = số MẤT SẠCH vì đổi ý sớm — câu quan trọng nhất cả cơ chế).
   * v54 (D405) — hai loại mới, chỉ có khi cờ bật: `lam_phat` (lạm phát ăn gốc trong sổ; `mat` âm = tin giả lộ trả
   * ngược) · `do_vo` (ngân hàng đổ vỡ, `mat` = gốc mất trên phần vượt hạn mức bảo hiểm). `goc` = gốc SAU khi mất.
   */
  tiet_kiem?: {
    loai: 'lai' | 'dao_han' | 'huy' | 'lam_phat' | 'do_vo';
    id: string; goc: number; lai: number; lai_mat?: number; mat?: number;
  }[];
  /**
   * v42 (D311/D313) — COUPON đã nhận vòng này. `tien` = vào tiền mặt (sổ dài),
   * `khong` = bị trừ khỏi ký quỹ (khống trái phiếu thì TRẢ lãi cho chủ tờ).
   * VẮNG khi cổng tắt hoặc vòng đó không ai cầm mã trả coupon.
   */
  coupon_cua_ban?: { ma: string; tien: number; khong: number }[];
  /** D498 — phí quản lý của Tổ Chức vào tiền mặt vòng này (cờ `toChucV57`). Vắng = không có. */
  quan_ly_cua_ban?: { nav: number; tien: number };
  /** v46 (D338) — lãi vay Đòn Bẩy trừ ô này: `vay` = phần đang được nhân đôi, `lai_bp` = mức mỗi ô. VẮNG = không trả. */
  lai_vay_cua_ban?: { vay: number; lai_bp: number; lai: number };
  /**
   * v42 (D311/D313) — cú sốc lạm phát lên TIỀN MẶT TỰ DO. `mat` âm = mất tiền;
   * DƯƠNG khi đó là tin GIẢ (dư âm đảo dấu, cùng quy ước với giá).
   */
  tien_mat_cua_ban?: {
    mat: number;
    chi_tiet: { su_kien: string; delta_bp: number; dao: boolean }[];
  };
  /**
   * ⭐ NAV HEADLINE NGAY TRƯỚC VÒNG NÀY — mẫu số của con số lãi/lỗ vòng (24/08).
   *
   * Trước đây client tự chụp lúc bấm nộp (`navTruoc`), nên nạp lại trang là mất
   * mẫu số và con số không dựng lại được — đó là nửa còn thiếu của nợ D116.
   * ⚠ KHÔNG phải `cua_ban.nav_truoc` của engine: D116 đo ra hai thứ đó lệch dấu
   * ở 15–40% số vòng vì engine chụp TRƯỚC khi chia Quỹ vòng / gọi ký quỹ / siết.
   * VẮNG MẶT ở trận cũ không NAV.
   */
  nav_truoc?: number;
  /** v34 — đội lái bị SIẾT PHÁP LÝ vòng này (trừ thẳng Vốn). VẮNG MẶT khi không. */
  siet_cua_ban?: { mat: number };
  /**
   * ⚠ GỌI KÝ QUỸ vòng này — cầm Đòn Bẩy mà lỗ quá ngưỡng thì bị lấy chip
   * thẳng khỏi NAV. VẮNG MẶT khi không bị gọi.
   *
   * Nối 24/08; engine tính nó từ v8 nhưng chưa bao giờ ra tới đây (nợ D37,
   * nhắc lại D108). Đang nổ thật ở v34: 3,34% số vòng-ghế, 19,3% số trận có
   * ít nhất một cú, trung bình 684 chip — và dồn về cuối trận.
   *
   * ⚠ Hình phạt này TRÁNH ĐƯỢC bằng kỹ năng (hạ đòn bẩy trước vòng xấu), nên
   * giấu nó đi là giấu đúng thứ làm nó công bằng: không thấy thì không học
   * được cách né. Xem `GOI_KY_QUY` trong config để biết vì sao nó là cần gạt
   * KỸ NĂNG chứ không phải cần gạt "yếu đi".
   */
  ky_quy_cua_ban?: { mat: number };
  /**
   * D88 §11.2 — ỐNG KÍNH CON ĐƯỜNG: một dòng hồi cố về vòng vừa chốt, do
   * con đường kỳ ngộ đã chọn quyết định. VẮNG MẶT khi chưa chọn.
   * ⚠ Số `null` PHẢI vẽ `—`, TUYỆT ĐỐI không vẽ số âm/0: vòng đứng ngoài
   * không phải dự báo sai (D67), và một con số đỏ ở vòng đứng ngoài là một
   * lời hối thúc vào lệnh — kê tư thế phơi nhiễm (chốt §1.2 của D88).
   */
  ong_kinh?: OngKinhDTO;
  /** D302 — vòng vừa chốt bị đám đông đổi ô (ex-post). Xem `ODoiDTO`. */
  o_doi?: ODoiDTO;
  /**
   * 12/09 (Q3 — LIÊN KẾT NHÌN THẤY) — thị trường của vòng vừa chốt: lợi suất
   * công khai (bp) của ĐỦ mọi mã, kể cả mã không cầm. Ex-post, công khai, không
   * β. Client vẽ dải sáu lá cùng nhích (`DaiThiTruong`) — chỉ SAU chốt (M.2).
   * VẮNG MẶT ở trận không NAV hoặc API cũ ⇒ không vẽ dải, không vẽ dấu hỏi.
   */
  thi_truong_vong?: { ma: string; delta_bp: number }[];
  /**
   * v54 (D395) — THANH KHOẢN CỦA VÒNG: vạch sổ lệnh sáu mã ngay sau lá vừa lật (đúng phép tính của Bảng
   * điện tử — tin coi là thật; mã đầu cơ `vach: null`, sương mù). Client vẽ thước co/giãn TRONG nhịp lật
   * (`DaiThiTruong`), từ `vach_nen` tới `vach`. Chỉ có ở trận bật `thanh_khoan_nam_nac` (v54); vắng ⇒
   * không vẽ thước.
   */
  thanh_khoan_vong?: ThanhKhoanVongDTO[];
  /**
   * v55 (D409) — NGỌN LỬA ĐÀ của mình sau vòng: nấc trước/sau, lý do dập (null = không dập), xu nhận thêm và tổng xu.
   * Client diễn ở bước PHONG CÁCH của nhịp kết quả (A11.26). Vắng = trận không cổng `lua`.
   */
  lua?: LuaVongDTO;
}

export interface LuaVongDTO {
  truoc: number;
  sau: number;
  dap: 'doi_bias' | 'doi_tay' | 'mua_duoi_muon' | null;
  xu_them: number;
  xu: number;
  dac_biet: boolean;
  /** D422 — MÙ LỬA: lửa luôn tắt, xu đều mỗi vòng — màn vẽ ngọn lửa bịt mắt thay vì lửa tàn. */
  mu_lua?: true;
}

/** Một mã trong `thanh_khoan_vong` — server tính, client chỉ vẽ (C4). */
export interface ThanhKhoanVongDTO {
  ma: string;
  tong_vach: number;
  vach_nen: number;
  /** `null` ⇔ mã đầu cơ (sương mù — luật 2 của Bảng điện tử): thước mờ, không có nấc. */
  vach: number | null;
}

/** D88 — mỗi con đường một loại dòng; server tính, client chỉ vẽ (C4). */
export type OngKinhDTO =
  | { loai: 'la_ban'; ty_le_dung_bp: number | null }
  | { loai: 'tay_can'; brier: number | null }
  | { loai: 've_song'; chenh_bp: number | null }
  | { loai: 'bat_nhip'; doi_pha: boolean };

/**
 * D38 — ĐỒNG HỒ VÒNG, SERVER CHẤM (C4).
 *
 * ⚠ CLIENT CHỈ VẼ. Được phép đếm lùi từ `con_lai_s` cho mượt, nhưng con số tự
 * đếm đó KHÔNG được dùng để khoá nút gửi: đồng hồ máy người chơi chạy nhanh hơn
 * thì họ mất lượt oan, chạy chậm hơn thì họ tưởng còn giờ. Server hết giờ mà
 * client chưa ⇒ server thắng (nó tự áp "giữ nguyên"); client hết giờ mà server
 * chưa ⇒ vẫn phải gửi được.
 *
 * OPTIONAL: trận đã đóng không kèm trường này, và API cũ hơn bundle là trạng
 * thái bình thường (frontend/API deploy bằng hai lệnh riêng). Thiếu ⇒ không vẽ
 * đồng hồ, KHÔNG phải vẽ số 0.
 */
export interface DongHoDTO {
  /** Giây còn lại của pha chọn bài. Không bao giờ âm. */
  con_lai_s: number;
  /** Tổng thời lượng pha này — để vẽ thanh đã trôi bao nhiêu phần. */
  tong_s: number;
  /** SERVER nói đã quá hạn (đã tính ân hạn). Đây mới là chân lý. */
  het_gio: boolean;
  /** Ân hạn mất kết nối — số 0 trên màn hình chưa phải là mất lượt. */
  an_han_s: number;
  /**
   * MÀN TẬP MIỄN GIỜ (founder 02/08) — vòng hướng dẫn đầu KHÔNG chạy đồng hồ.
   * Server quyết (nó cũng là bên thôi chốt hộ); client chỉ vẽ "TẠM DỪNG" và
   * TẮT đường tự-nộp. Vắng mặt = vòng bình thường.
   */
  tam_dung?: boolean;
  /**
   * M2 (D90, 17/08) — PHA của vòng: `doc` = đang trong khoảng ĐỌC kết quả vòng
   * trước, `quyet` = phần còn lại. Server quyết vì THẺ GIỜ (v32) cộng giây vào
   * `tong_s`, nên client trừ tay sẽ lệch đúng với người có đặc quyền. TỔNG GIÂY
   * KHÔNG ĐỔI — đây là gọi tên, không phải nới giờ (D90 bác nới giờ).
   * Vắng (API cũ) ⇒ vẽ như trước, một mặt số.
   */
  pha?: 'doc' | 'quyet';
  /** Số giây của pha ĐỌC (0 ở vòng 1). */
  doc_s?: number;
  /**
   * VÌ SAO tạm dừng (16/08): `man_tap` = bốn vòng hướng dẫn đầu (D53);
   * `tran_lam_quen` = cả trận không tính giờ — luật này CHỈ tồn tại sáng
   * 16/08 (founder bác cùng chiều), còn lại cho đúng hai trận prod đã tạo dưới
   * nó. Client chỉ ĐỔI NHÃN theo đây — không tự suy (C4). Vắng ⇒ `man_tap`.
   */
  ly_do?: 'man_tap' | 'tran_lam_quen';
}

export interface TrangThaiDTO {
  /**
   * PHONG CÁCH CHƠI (17/08) — hạng E→SSS của trận, TỔNG HOÀ ba trục chứ không
   * chỉ NAV. Server chỉ gửi điểm/hạng/streak trong trận; ba trục chi tiết nằm ở
   * autopsy (founder: *"kết trận thì ở menu kết thúc mới khoe mấy chỉ số kia"*).
   * Vắng ⇒ chưa đủ vòng để có hạng (D337 — xem `phong_cach_tam_tinh`), hoặc trận không NAV.
   */
  phong_cach?: { diem: number; hang: string; streak: number };
  /**
   * D343 — ĐIỂM TẠM TÍNH của mấy vòng đầu, khi `phong_cach` còn vắng: thanh vẫn chạy nhưng
   * XÁM, hạng là dấu `?` (founder 16/09). ⚠ KHÔNG có `hang`, có chủ ý — cửa cứng D337 nằm ở
   * server; đừng suy hạng từ `diem` này. Hai khối không bao giờ cùng có mặt.
   */
  phong_cach_tam_tinh?: { diem: number; streak: number };

  match_id: string;
  /** BÀN CHUNG (16/08): mã bàn nếu trận thuộc bàn mời bạn; null/vắng = trận đơn. */
  ban_ma?: string | null;
  vong: number;
  tong_vong: number;
  /**
   * Chỉ endpoint ĐỌC trạng thái trả trường này (response của `/rounds` thì không —
   * ở đó `xong` nói đủ). `'bo_dở'` = trận bị đóng vì quá hạn (D38): bàn còn đó
   * nhưng không nộp được vòng nào nữa, nên màn hình PHẢI nói ra thay vì vẽ một
   * bàn đấu mà mọi nút đều 409.
   */
  status?: 'dang_choi' | 'xong' | 'bo_dở';
  /** D38 — xem `DongHoDTO`. Vắng mặt = trận này không có hạn (hoặc đã đóng). */
  dong_ho?: DongHoDTO;
  /**
   * D38 — vòng vừa nộp bị SERVER CHỐT HỘ vì quá hạn (`NUOC_HET_GIO`).
   *
   * Phải vẽ ra. Người chơi vừa mất một lượt quyết định; im lặng thì họ chỉ thấy
   * "sao Vốn không đổi" và học ra bài học sai — một hình phạt nạn nhân không
   * nhận ra là hình phạt chỉ gây bực chứ không dạy được gì.
   */
  tu_dong?: boolean;
  ban: {
    von: number;
    luot_khao_sat: number;
    /**
     * `gan` — bảng thẻ ghim → mã (hiện chỉ Đòn Bẩy). Server gửi nguyên
     * `danh_muc` của ghế mình nên trường này có sẵn; khai ra để panel "ĐANG
     * NHẮM VÀO" đọc mã hiện tại thay vì client tự nhớ (C4: server là chân lý).
     */
    danh_muc: {
      tai_san: string[]; chien_thuat: string[]; gan?: Record<string, string>;
      /** v34 — đích PHỤ của Đòn Bẩy cấp 2 (cá mập). Vắng = một đích. */
      gan_phu?: Record<string, string>;
    };
    da_chay: boolean;
    /**
     * Tư thế ghế. KHÔNG optional, KHÔNG ép kiểu ở nơi dùng: bản trước client
     * đọc trường này qua `as { tu_the?: string }` trong khi API chưa hề gửi,
     * nên cờ all-in luôn false và cả tính năng chết lặng lẽ.
     */
    tu_the: 'choi' | 'all_in' | 'dung_ngoai' | 'dau_hang';
    vong_roi: number | null;
    /** D2 — đã dùng bao nhiêu lượt Cắt lỗ, và còn bao nhiêu. SERVER suy (C4). */
    so_lan_cat_lo: number;
    con_lai_cat_lo: number;
    /** D6 — khẩu vị đã chốt lúc tạo trận. Không đổi giữa chừng. */
    khau_vi: KhauViDTO['id'];
    /** VAI bất đối xứng (22/08): 'ca_nhan' | 'doi_lai' | 'ca_map' | 'to_chuc'. Vắng = map 8/trận cũ. */
    vai?: string;
    /** v34 — hệ số tác động giá của vai mình (1 khi không vai). Xem-trước phải nhân đúng số này. */
    tac_dong_gia?: number;
    /**
     * D342 — độ sâu sổ quy chiếu của phí vội vàng = vốn khởi điểm của vai. Xem-trước truyền đúng số
     * này cho lõi, không thì ghế vốn ×2/×3 thấy phí báo trước khác phí bị trừ. Vắng khi không vai.
     */
    von_quy_chieu?: number;
    /** D446 — TOÀN BỘ tham số lệnh của ghế, đúng bộ server áp (`tuyChonLenhGhe`) — bản xem trước đưa nguyên vào lõi. */
    tuy_chon_lenh?: TuyChonLenhGhe;
    /** v50 (D345) — trận tính phí mua bán NHẸ (bảng mới, vội vàng theo cỡ tiền). Xem-trước phải biết. */
    phi_lenh_nhe?: boolean;
    /** v51 (D346) — phí mua bán HAI BẬC (bậc 1 giá ngoài đời, phần vượt bị đẩy giá). */
    phi_lenh_bac?: boolean;
    /** D516 — độ sâu chợ của ghế (bp) cho phí hai bậc — vai vốn to (`phiSauVaiV57`). Vắng = ×1. */
    phi_lenh_sau_bp?: number;
    /** v50 (D345) — phần phí lệnh còn lại (bp) khi cầm Khớp Nhanh. Vắng = trả đủ. */
    phi_lenh_con_bp?: number;
    /*
     * ─── v55 (D409) — NGỌN LỬA ĐÀ · XU · TRAIT · CHỐT LỜI ────────────────────────
     * Mọi trường VẮNG ở trận không cổng (v54 trở xuống) — client khoanh thứ mới theo trường có mặt, không theo
     * "trận NAV" (nếp `up_o`). Server suy hết (C4): nấc hiện (kể cả LỬA GIẢ +1), ràng buộc trait, mốc lệnh cho phép.
     */
    lua?: { nac: number; chuoi: number; bias: 'rui_ro' | 'phong_thu' | 'khong' | null; dac_biet: boolean };
    xu?: number;
    /**
     * v55 (D411) — VÀNG gộp vào XU: có cờ này thì `luot_khao_sat` CHÍNH LÀ ví xu (đổi bài shop + cuộn chợ trait cùng một
     * ví). Vắng = trận cũ, `luot_khao_sat` là VÀNG như trước. Đọc qua `lib/vi_xu.ts`.
     */
    xu_gop?: boolean;
    /** Trait ĐANG HIỆU LỰC (đã gồm cặp của vai khi bật `traitVai`). Chữ ở `lib/trait_chu.ts`. */
    trait?: string[];
    rang_buoc?: {
      toi_da_ma: number; te_liet: boolean; noi_gian: number; mu_tin: boolean; suong_mu: boolean; sang_so: boolean;
      /** D425 — GÔNG CÙM: trần BÁN mỗi vòng (bp NAV, null = không) · phần BÁN còn được vòng này (chip) — bản nháp kiểm trước. */
      tran_ban_vong_bp?: number | null; tran_ban_con?: number;
      /** D425 — SỔ MỎNG: phí cố định mỗi lệnh (chip, 0 = không) — bản nháp trừ cùng số server trừ (C4). */
      phi_co_dinh_lenh?: number;
      /** D422 — cờ lá đang mang (màn vẽ đúng lá; không số tiền nào suy ở client — C4). Vắng ở server cũ. */
      mu_lua?: boolean; kien_nhan?: boolean; nong_voi?: boolean; di_sau?: boolean; lo_lenh?: boolean;
    };
    /** D422 — số vòng giữ liền từng mã (KIÊN NHẪN / NÓNG VỘI đọc). Vắng khi chưa giữ gì. */
    giu_lien?: Record<string, number>;
    /** D422 — ĐI SAU: cả bàn đang mua (+) / bán (−) từng mã ở vòng này, mức −3…+3. Chỉ người mang lá. */
    dong_lenh_ban?: { ma: string; muc: number }[];
    /** Mốc chip MUA được phép ở ghế này (LỆNH MỊN thêm mốc). Vắng = bộ mốc thô mặc định. */
    moc_cho_phep?: number[];
    /** NỘI GIÁN — LOẠI của các lá kế ('pha' | 'tin'), chỉ có khi mang trait ấy. */
    loai_la_ke?: ('pha' | 'tin')[];
    /** Chợ trait — CHỈ ở vòng mốc (lượt cuộn 0; cuộn thêm qua `useCuonTrait`). */
    cho_trait?: ChoTraitDTO;
    /** Lướt Sóng mới — cho phép đặt CHỐT LỜI TRONG Ô; chỉ khi cầm lá và trận bật cổng. */
    chot_loi_cho_phep?: { nguong_min_bp: number; nguong_max_bp: number; buoc_bp: number; phan_ban: readonly number[]; toi_da: number };
    /** v34 — MANDATE của tổ chức: trần %NAV mỗi mã khi mua · cấm khống. VẮNG khi không phải tổ chức. */
    mandate?: { tran_ma_bp: number; cam_khong: boolean };
    /** v34 — đặc quyền tổ chức: dòng tiền THÔ cả bàn theo mã. VẮNG khi không phải tổ chức. */
    dong_tien?: Record<string, 'vang' | 'vua' | 'dong'>;
    /** v34 — Đòn Bẩy cấp 2: được nhắm đích phụ (`gan_phu`). VẮNG = không. */
    gan_phu_duoc?: boolean;
    /** D435 — đang cầm đúng một Đòn Bẩy: mua thêm lá vòng này ⇒ nhắm đích phụ được ngay vòng mua. VẮNG = không. */
    gan_phu_khi_mua?: boolean;
    /** Ghế mình cũng có trạng thái cảm xúc — cùng luật với đối thủ, không ngoại lệ. */
    fx: FxGheDTO;
    /**
     * v10 NAV — ba trường tiền CỦA MÌNH (đối thủ thì ẩn — xem DoiThuDTO).
     * OPTIONAL: trận cũ / API cũ không có ⇒ UI phân bổ tự ẩn, không đoán.
     */
    nav?: number;
    tien_mat?: number;
    vi_the?: Record<string, number>;
  /** v17 — sổ khống của chính mình + cờ đặc quyền vẽ hàng KHỐNG. */
  vi_the_khong?: Record<string, number>;
  co_ban_khong?: boolean;
  /** v29 — trận này tính PHÍ VỘI VÀNG phi tuyến (xemTruocLenh phải biết). */
  phi_voi_vang?: boolean;

    /*
     * ─── LÕI VỐN: NĂM TRƯỜNG SERVER SUY, CLIENT VẼ (C4) ─────────────────────
     *
     * ⚠ OPTIONAL vì trận CŨ (`balance_version` trước v6) và API cũ hơn bundle
     * đều không có chúng. Thiếu ⇒ coi như luật tắt ⇒ panel không hiện. Đó là
     * hướng an toàn duy nhất: hiện nút cho một trận engine sẽ từ chối thì người
     * chơi bấm mà không có gì xảy ra.
     *
     * ⚠ VÀ ĐỪNG TỰ SUY LẠI BA CỜ NÀY Ở CLIENT. Chúng là hàm của cùng bộ điều
     * kiện `apDaoDanhMuc`/`apKhoaTaiSan` dùng để nhận lệnh; tính lại ở đây là
     * nguồn chân lý thứ hai, và biểu hiện khi nó lệch đúng là "nút vẫn sáng,
     * bấm không có gì xảy ra".
     */
    luat_von?: boolean;
    /** Chu kỳ khoá ĐANG chạy. null = không khoá gì. */
    khoa?: {
      ma: string;
      vong_bat_dau: number;
      /** Còn mấy vòng nữa mới hết, TÍNH CẢ vòng này. */
      con_vong: number;
      /** Vòng nghiệm thu — chỉ ở đây phá cam kết mới bị phạt. */
      la_vong_chot: boolean;
      /** Thưởng đã nhận trong chu kỳ; phá cam kết thu hồi đúng bằng số này. */
      thuong_da_nhan_bp: number;
    } | null;
    dao_duoc?: boolean;
    khoa_duoc?: boolean;
    /** Hậu quả phá cam kết: vòng này không Tăng cam kết, không Khảo sát lại. */
    von_bi_giam?: boolean;

    /*
     * ─── v43 (D314/D317) — NGÂN HÀNG: SỔ TIẾT KIỆM ───────────────────────────
     *
     * ⚠ CÙNG LUẬT với ba cờ lõi vốn ngay trên, và có một vế RIÊNG dễ sai:
     * `tiet_kiem_duoc` gộp BA điều kiện (cổng bật · ghế được chọn bài · CÒN mốc
     * kỳ hạn nào KỊP ĐÁO HẠN trước ô cuối). Vế thứ ba TẮT DẦN về cuối bàn —
     * vòng áp chót thì không mốc nào kịp nữa. Client mà tự suy "còn tiền thì
     * còn gửi được" sẽ sáng nút ở đúng những vòng engine chắc chắn từ chối.
     *
     * `tiet_kiem_bao_gia` là BÁO GIÁ của CHÍNH VÒNG NÀY — lãi chốt lúc mở, neo
     * lãi suất nền đang công bố. Nó đổi mỗi khi ô kỳ họp ⚖ đổi lãi, nên đừng
     * nhớ lại giá của vòng trước.
     */
    tiet_kiem_duoc?: boolean;
    /** Mốc kỳ hạn còn KỊP đáo hạn + lãi báo của vòng này. Rỗng ⇒ không mốc nào kịp. */
    tiet_kiem_bao_gia?: { so_vong: number; lai_bp: number }[];
    /**
     * Sổ đang mở của CHÍNH MÌNH. Vắng ⇒ chưa có hợp đồng nào.
     * ⚠ A3.1 — đối thủ KHÔNG có trường này: biết đối thủ khoá bao nhiêu tiền tới
     * vòng nào là biết chính xác lúc nào họ không thể mua.
     */
    tiet_kiem?: {
      id: string;
      goc: number;
      so_vong: number;
      vong_mo: number;
      lai_bp: number;
      /** Lãi đã tích, ĐANG NẰM TRONG NAV — huỷ là NAV tụt đúng bằng số này. */
      lai_don: number;
      /** Còn mấy vòng nữa mới đáo hạn; ≤ 0 = đáo hạn cuối vòng này. Server tính (C4). */
      con_vong: number;
    }[];
    /**
     * v42 (D311) — sàn cấm MỞ khống mã cơ sở. `xemTruocLenh` phải biết, nếu
     * không màn cho xếp lệnh rồi server mới báo không được.
     */
    khong_theo_ma?: boolean;
    /**
     * v49 (D342) — chip KHỐNG tính trên HẠN MỨC khống còn lại. `xemTruocLenh` phải biết,
     * không thì màn tính 100% tiền mặt còn server khớp 100% hạn mức.
     */
    khong_theo_han_muc?: boolean;

    /*
     * ─── D33/D34 — ĐẶC QUYỀN THẺ CHIẾN THUẬT ─────────────────────────────────
     *
     * ⚠ CÙNG LUẬT VỚI BA CỜ LÕI VỐN Ở TRÊN: client KHÔNG được tự suy lại một
     * trường nào. `short_duoc` phụ thuộc nhịp vòng, cỡ map, tư thế ghế và lệnh
     * đã đặt; `all_in_mo` phụ thuộc số Ô chiến thuật (bản sao KHÔNG tính hai).
     * Suy lại ở client là nguồn chân lý thứ hai, và biểu hiện khi nó lệch đúng
     * là "nút vẫn sáng, bấm không có gì xảy ra".
     *
     * OPTIONAL: frontend và API deploy bằng hai lệnh riêng nên "API cũ hơn
     * bundle" là trạng thái bình thường. Thiếu ⇒ coi như tắt.
     */
    dac_quyen?: boolean;
    /** Thẻ nào đang cho đặc quyền — UI vẽ huy hiệu, không đoán theo tên lá. */
    the_dac_quyen?: string[];
    /** Số thẻ TÀI SẢN lấy được ở vòng này (Đa Dạng Hoá cho 2). */
    toi_da_tai_san_vong?: number;
    /**
     * ⚠ NGHĨA ĐỔI 27/07 (spec 01 §4.2c, sửa D34 điều 4). Cờ này nay gác ĐÚNG MỘT
     * thứ: **"lật bài đến hết trận"** (`tu_the = 'all_in'`) — cần đủ 3 lõi chiến
     * thuật. Còn ALL-IN hiểu là DỒN 100% VỐN thì **mở từ vòng 1, không cờ nào
     * gác**: founder — *"Không khóa all in ở mấy round đầu nữa, chỉ khóa tính
     * năng lật bài đến cuối."*
     * UI phân bổ vốn sắp tới TUYỆT ĐỐI không dùng cờ này để khoá nấc ALL-IN;
     * chỉ dùng nó cho nút/nhãn "lật đến cuối". Tên trường giữ nguyên vì đây là
     * wire format — đổi tên là gãy client cũ đang mở.
     */
    all_in_mo?: boolean;
    /** Còn thiếu mấy lõi chiến thuật nữa mới mở "lật đến cuối". */
    con_thieu_the?: number;
    /** Nhịp chọn bài của CHÍNH map này (D34 — co theo cỡ map). */
    nhip_chon_bai?: LoaiTheVong[];
    /** Đặc quyền Phòng Hộ: được đặt lệnh short ở vòng này không. */
    short_duoc?: boolean;
    /** Lệnh short đang treo (đặt vòng trước, hoặc vừa đặt vòng này). */
    short?: { ma: string; vong_dat: number } | null;
    /** Lệnh short KHỚP ở vòng này — UI báo "lệnh của bạn vừa khớp". */
    short_khop?: { ma: string; vong_dat: number } | null;
    /** Ba hạng giá Bảng điện tử ÁP CHO GHẾ NÀY (đã tính thẻ Lướt Sóng). */
    gia_bang?: { co_ban: number; du_bao: number | null };
    /**
     * v57 (D456) — luật của trận này KHÔNG bán Bảng điện tử ⇒ ẨN nút + khối bảng. CHỈ có mặt khi bật; vắng = vẫn bán (mọi trận ≤ v56).
     * Server cũng chặn `POST /bang-dien-tu` bằng 403 `luat_tat` — ẩn nút là lịch sự, không phải cổng.
     */
    khong_bang_dien_tu?: true;
  };
  doi_thu: DoiThuDTO[];
  /** D542 — số vai của các ghế khác (id vai → số ghế). Vắng = bàn không vai. */
  dem_vai?: Record<string, number>;
  so_nguoi_song: number;
  /**
   * v53 (D373) — Ô CỦA VÒNG CÒN ÚP: người chơi cược vào lá SẮP LẬT, không đọc lá đã ngửa.
   * VẮNG = luật cũ (ô của vòng nằm ngửa trong `o_hien_tai`). Có cờ ⇒ `o_hien_tai` LUÔN null
   * và ô số `vong` là ô úp đầu tiên trên bản đồ.
   */
  up_o?: boolean;
  /**
   * v54 (D395) — THANG THANH KHOẢN NĂM NẤC: trận này có thước ở dải 6 mã ⇒ dải GIỮ CHỖ hàng thước từ trước
   * chốt đầu tiên (không nhảy bố cục khi thước mọc). VẮNG = trận không có thước (v53 · v45 · API cũ).
   */
  thanh_khoan_nam_nac?: boolean;
  /**
   * v54 (D403) — BỎ BÀI TẮT: trận này không còn nước BỎ (engine gỡ 'bo' khỏi danh sách được-làm) ⇒ màn GỠ nút BỎ.
   * Về tiền mặt thì dùng BÁN SẠCH trong shop. VẮNG = trận còn BỎ (v53 · v45 · API cũ).
   */
  bo_bai_tat?: boolean;
  /**
   * v54 (D405) — SỔ CHỊU NỀN KINH TẾ: luật sổ của TRẬN NÀY để màn ngân hàng niêm yết đúng. VẮNG = sổ cổ điển (lãi chốt
   * lúc gửi, miễn lạm phát, không đổ vỡ — v43–v53). `do_vo` = ngưỡng + mức mất (server phát số), null = không đổ vỡ.
   */
  tiet_kiem_kinh_te?: {
    lam_phat: boolean;
    tha_noi: boolean;
    do_vo: { bao_hiem_toi_da: number; mat_bp: number } | null;
  };
  /**
   * D406 — bảng vai theo luật của CHÍNH trận này (hệ số vốn · lõi ghim · chữ quyền/giá). Catalog `vai` chỉ nói khoá mặc
   * định — bàn tập v53 dưới mặc định v54 cần bảng của nó. VẮNG = trận không vai (hoặc server cũ ⇒ màn rơi về catalog).
   */
  vai_bang?: Record<string, VaiDTO>;
  o_hien_tai: ODTO | null;
  lich_su_o: ODTO[];
  telegraph: {
    tu_su_kien: string;
    nghieng_ve: string;
    /** Tin này THƯỜNG kéo theo tin gì (2 khả năng nặng nhất). */
    keo_theo: string[];
  } | null;
  bo_bai_con_lai: {
    con_lai: number; so_giai_doan: number; so_su_kien: number; tin_gia_ky_vong: number;
    /** v57 (D456) — thẻ sự kiện LUÔN THẬT: không hiện "~N giả". Chỉ có mặt khi bật. */
    the_luon_that?: true;
  };
  /**
   * v57 (D457) — ĐỒNG HỒ NHỊP NGẮN (đặt lệnh 15 s, đọc kết quả 5 s): web KHÔNG diễn khoảnh khắc từng vòng — 5 s không chứa nổi
   * chúng; founder muốn chúng dồn về màn cuối trận, nhưng màn đó CHƯA có chỗ diễn lại (việc mở, cần demo trước — D457). CHỈ có
   * mặt khi bật; vắng = đồng hồ cũ, mọi thứ như trước.
   */
  dong_ho_minigame?: true;
  /** D561 — khoá v65: lõi của màn chọn lúc chốt vòng (`loi_man` trong body nộp). CHỈ có mặt khi bật. */
  loi_chon_truoc?: true;
  /** D530 — lõi chỉ tác động trong màn (khoá v60): không nhắm mã, chữ lõi nói "chỉ trong màn". CHỈ có mặt khi bật. */
  loi_chi_trong_man?: true;
  /**
   * D526 — các vòng mà sau khi chốt có màn minigame (server dẫn xuất từ `coManMinigame`): khung v57 2 … hết; nhịp xen kẽ (v58) bàn 8:
   * 1 · 2 · 4 · 6 · 7 — vòng vắng là vòng mở chợ trait. Web CHỈ hỏi danh sách này. Vắng = trận không có màn.
   */
  lich_man?: number[];
  /**
   * CHART TÀI SẢN (founder 07/10) — % công khai (bp) từng mã của mọi vòng ĐÃ CHỐT, theo thứ tự vòng (cùng số
   * `ket_qua_vong.thi_truong_vong` từng vòng đã phát). Màn còn chạy thì vòng vừa nộp chưa có. Vắng = chưa chốt vòng nào / trận không NAV.
   */
  lich_su_thi_truong?: { vong: number; thi_truong: { ma: string; delta_bp: number; cao_bp?: number; thap_bp?: number; kl?: number }[] }[];
  /** D526 — trần đổi lõi mỗi vòng (founder: *"đổi lõi chỉ đổi được 1 lần"*). Vắng = trần cũ (5). */
  doi_loi_toi_da?: number;
  /**
   * D480 — MÀN của vòng vừa nộp còn chạy: server trả trạng thái TRƯỚC chốt (giấu kết quả vòng tới quyết toán), không đồng hồ; kèm vòng của màn
   * và lá vừa lật. Màn xong ⇒ hỏi lại thì có trạng thái thật.
   */
  /** D480 — màn vòng vừa nộp còn chạy · D533 `het_ms`: còn bao lâu màn hết (vắng = không biết — hỏi lại định kỳ). */
  /** D561 — khoá úp lá pha: ô pha của vòng có màn trả `{ kind: 'giai_doan', up: true }` (không mặt lá) tới khi màn hết. */
  cho_man?: { vong: number; o?: ODTO | { kind: 'giai_doan'; up: true }; het_ms?: number };
  /** D43 — vị trí KỲ HỌP lãi suất (1-indexed); [] khi trận không có lịch. */
  o_lich?: number[];
  /** Chuỗi xu hướng ĐÃ XÁC NHẬN tính hết ô ĐÃ LẬT (v53: không tính ô còn úp); null khi chưa thành chuỗi. */
  xu_huong?: { huong: number; dai: number } | null;
  /** Chỉ khi ô kỳ họp ĐÃ LẬT: hàm phản ứng công khai nói gì vs thực tế (v53: sau khi họp xong). */
  chinh_sach?: { ky_vong: string; thuc: string } | null;
  /** Bước 5 — BỘ ĐO SỨC CĂNG (đặc quyền Lướt Sóng): mã → dải 0/1/2. VẮNG = không cầm lá. */
  suc_cang_dai?: Record<string, number>;
  /** Bước 6 — bối cảnh chu kỳ map, công bố đầu trận cho mọi người. */
  chu_ky?: { speed: number; amp: number; asym: number } | null;
  /** v26 — lãi suất nền công khai (điểm; 1 điểm = 0,01%). Xem `LAI_SUAT_NEN`. */
  lai_suat?: {
    diem: number; moi_truong: 're' | 'trung_tinh' | 'dat';
    nguong_thap: number; nguong_cao: number;
    /**
     * v45 (D318) — LỢI SUẤT DÀI (điểm), thứ coupon Trái phiếu Mỹ neo vào. Vắng =
     * trận chạy luật chưa có đường cong lợi suất (trước v45 lãi dài ≡ lãi chính sách).
     * ⚠ `dai < diem` nghĩa là ĐƯỜNG CONG ĐẢO NGƯỢC — gửi tiết kiệm (neo lãi chính
     * sách) đang trả cao hơn coupon trái phiếu dài. Đó là thứ đáng nói ra.
     */
    dai?: number;
  };
  quy_vong_hien_tai: number;
  /** D584 — khoá giải bằng xu trait: tổng XU của giải vòng đang chơi (vắng ở khoá cũ ⇒ giải là tiền). */
  giai_xu_hien_tai?: number;
  shop: ShopDTO | null;
  ket_qua_vong?: KetQuaVongDTO;
  xong?: boolean;
  /**
   * LÕI VỐN — VÌ SAO LỆNH ĐẢO / KHOÁ KHÔNG CHẠY. `null` = chạy trót lọt.
   *
   * Engine bỏ qua IM LẶNG khi lệnh không hợp lệ (giống `mua`). Không vẽ trường
   * này ra là người chơi bấm nút, thấy vòng chốt bình thường, và không đời nào
   * biết danh mục mình KHÔNG hề đổi — tệ nhất là lúc họ tưởng mình vừa thoát
   * khỏi một mã đang cháy.
   */
  loi_von?: {
    dao?: string; khoa?: string; short?: string;
    /**
     * v10 NAV — chuỗi LỆNH GIAO DỊCH của vòng vừa chốt bị bác (mã `LoiLenh`). Server gửi từ
     * v10; tới D342 web chưa từng khai trường này, nên bốn vòng lệnh khống của founder bị
     * bác mà màn không nói một chữ. Chữ ở `lib/loi_lenh`.
     */
    lenh?: string;
    /** v43 — lệnh gửi/huỷ tiết kiệm của vòng vừa chốt bị bác. */
    tiet_kiem?: string;
  } | null;
  /**
   * v32 — KỲ NGỘ TRONG TRẬN (doc 06 §1).
   *
   * ⚠ VẮNG MẶT hẳn khi trận không có kỳ ngộ (map 8, hoặc trận ≤ v31): vắng =
   * "trò này không có kỳ ngộ", `moi: null` = "có mà chưa tới vòng nào". Hai
   * nghĩa khác nhau — client cũ không phải phân nhánh theo phiên bản.
   */
  ky_ngo?: KyNgoDTO;
}

export type NhiemVuIdDTO = 'la_ban' | 'tay_can' | 've_song' | 'bat_nhip';
export type DacQuyenKyNgoIdDTO =
  'ban_do_chu_ky' | 'phieu_mo_bang' | 'the_gio' | 'chuong_doi_pha';

export interface TienDoKyNgoDTO {
  xong: boolean;
  dat: number;
  can: number;
  vongCoViThe: number;
  canCoViThe: number;
}

export interface LanKyNgoDTO {
  vong: number;
  /** D88 — chương hồi tại vòng kỳ ngộ (lời mời có tác giả). */
  hoi?: string | null;
  chon: NhiemVuIdDTO | null;
  /** `null` khi chưa chọn — vẽ lời mời, KHÔNG vẽ "0/5" cho một thứ chưa nhận. */
  tien_do: TienDoKyNgoDTO | null;
  xong_o_vong: number | null;
  dac_quyen: DacQuyenKyNgoIdDTO | null;
}

export interface KyNgoDTO {
  /** Vòng nào của map này là vòng kỳ ngộ — client vẽ mốc, không tự suy. */
  vong_ky_ngo: number[];
  /** Bộ được mời — CHỈ khi đang ở vòng kỳ ngộ và CHƯA chốt. */
  moi: NhiemVuIdDTO[] | null;
  lan: LanKyNgoDTO[];
  dang_co: DacQuyenKyNgoIdDTO[];
  phieu_mo_bang: number;
  /** Số giây THẺ GIỜ đã cộng vào `dong_ho.tong_s` của vòng này. */
  the_gio_s: number;
  /** BẢN ĐỒ CHU KỲ — pha của mọi ô ĐÃ lật. VẮNG = chưa có đặc quyền. */
  ban_do_chu_ky?: string[];
  /** CHUÔNG ĐỔI PHA — ô KẾ có phải ô đổi pha không. VẮNG = chưa có đặc quyền. */
  chuong_doi_pha?: boolean;
}

export interface AutopsyDTO {
  match_id: string;
  xong: boolean;
  xep_hang: {
    hang: number; ghe_id: string; loai: string; ten: string;
    bac_rank: string; von: number; vong_chay: number | null;
    /** VAI của đối thủ — lộ từ đầu (22/08). Vắng = không có vai. */
    vai?: string;
    danh_muc: { tai_san: string[]; chien_thuat: string[] };
    /**
     * Điểm xếp hạng trước/sau trận. `null` ở ĐẤU TỰ DO và đó là thông tin THẬT,
     * không phải "đang tải": bàn có máy thì không tính điểm (D31). Màn Chốt phiên
     * phải NÓI RA điều đó, chứ hiện một khoảng trống thì người chơi tưởng lỗi.
     */
    diem_truoc?: number | null;
    diem_sau?: number | null;
    /** v32 — con đường kỳ ngộ, LẬT NGỬA HẾT ở màn kết (doc 06 §1.4). */
    ky_ngo_icon?: string;
  }[];
  map_da_lo: ({ kind: string; la_tin_gia?: boolean } & Record<string, unknown>)[];
  /** v32 — kỳ ngộ của CHÍNH mình: mời gì, chọn gì, xong hay không. */
  ky_ngo?: (LanKyNgoDTO & { moi: NhiemVuIdDTO[] })[];
  /**
   * 16/08 — "HÔM NAY BẠN VỪA CHẠM": tối đa 3 KHÁI NIỆM có tên mà dây chuyền
   * của chính bạn đã chạm trong trận (server chỉ trả ID + vòng + số; câu chữ ở
   * `lib/khoanh_khac.ts`). Rỗng hoặc vắng (API cũ) ⇒ KHÔNG vẽ khối.
   */
  khoanh_khac?: { id: string; vong: number; delta_bp: number }[];
  /**
   * D323 — THẺ NĂNG LỰC CỦA TRẬN NÀY: ba năng lực, bậc theo bằng chứng, chỉ ID +
   * số (chữ ở `lib/nang_luc.ts`). Vắng (API cũ) ⇒ KHÔNG vẽ khối.
   */
  nang_luc?: import('@server/holdem/nang_luc_ids').TheNangLucTranDTO;
  /**
   * D370 — `true` nghĩa là thẻ CÓ nhưng server đang giữ tới khi tester nộp PHIẾU 2 (cửa một chiều:
   * phiếu ấy hỏi họ nhớ lại, mà màn kết hiện sẵn ba bậc thì họ chép lại thứ vừa thấy).
   * ⚠ Khác hẳn `nang_luc` vắng vì API cũ — vắng thì im lặng, còn đây phải NÓI, không thì người ta
   *   tưởng hỏng. Vắng trường (bản máy chủ cũ trong cache PWA) ⇒ `false`, đúng phía an toàn.
   */
  the_dang_giu?: boolean;
  /**
   * PHONG CÁCH CẢ TRẬN + ba trục — chỗ DUY NHẤT ba trục được banh ra (founder:
   * *"ở menu kết thúc mới khoe mấy chỉ số kia cụ thể thôi để flex"*).
   * `ba_truc.doc` = null nghĩa là cả trận không dự báo vòng nào (toàn tiền mặt),
   * KHÁC 0 = đo được và bằng không.
   */
  phong_cach?: {
    diem: number; hang: string; streak: number; streak_dai_nhat: number;
    ba_truc: { doc: number | null; thang_cho: number; tru: number };
  };
  /**
   * 17/08 — ĐƯỜNG NAV TỪNG VÒNG của MỌI ghế (server dựng bằng replay theo tiền
   * tố; xem `duongNav`). Thẻ kết trận vẽ đường của mình trên nền dải đối thủ.
   * Vắng (API cũ) ⇒ không vẽ đường, thẻ vẫn ra — không bịa số.
   */
  nav_theo_vong?: { vong: number; nav: Record<string, number>; phoi_ban_bp?: number }[];
  /**
   * 17/08 — DẤU MỐC KỸ NĂNG (doc 06 §5.1): ID + vòng + số; câu chữ ở
   * `components/holdem/DauMoc.tsx`. Rỗng/vắng ⇒ KHÔNG vẽ khối (D62).
   */
  dau_moc?: { id: string; vong: number; so: number }[];
  /** Bàn chung/bàn ngày của trận (nếu có) — thẻ in mã để rủ chơi cùng bàn. */
  ban_ma?: string | null;
}

export interface NopVongInput {
  /** D561 — khoá v65 (`loi_chon_truoc`): lõi cho màn của vòng này, chọn TRƯỚC khi lá lật. */
  loi_man?: string;
  /**
   * ⚠ BỐ CỤC MÀN HÌNH — một BIẾN CỦA HÀNH VI, không phải chuyện trang trí.
   *
   * Màn ngang cho shop đứng cạnh bản đồ ⇒ người chơi thấy thẻ, map và đối thủ
   * CÙNG LÚC; điện thoại mở shop là che hết. Hai người ra cùng một quyết định
   * từ hai lượng thông tin khác nhau, nên không ghi lại thì mọi so sánh hành vi
   * của mùa 0.0 mang một biến ẩn — và `events` append-only nên không gắn nhãn
   * lại được (founder chốt phương án A, câu 6 bản yêu cầu 03).
   *
   * Client CHỈ khai mình đang ở bố cục nào; server lọc theo danh sách trắng.
   */
  bo_cuc?: 'doc' | 'ngang';
  vong: number;
  khao_sat_lai: number;
  /** MẢNG — tối đa 1 Tài sản + 1 Chiến thuật mỗi vòng. */
  mua: string[];
  /** D3 — thẻ chiến thuật vừa mua gắn vào mã nào (bỏ qua nếu không gắn). */
  gan?: Record<string, string>;
  /** v34 — đích PHỤ Đòn Bẩy cấp 2: `{ don_bay: mã }`; `''` = bỏ đích phụ. */
  gan_phu?: Record<string, string>;
  /**
   * 22/08 — XIN CHỐT HỘ: đồng hồ client chạm 0, nộp ngay thay vì chờ 10s ân hạn.
   * Server soi đồng hồ của nó: qua mốc ⇒ xử như hết giờ (dán `tu_dong`); chưa ⇒
   * 409 `chua_het_gio` và client hẹn lại. Không phải quyết định của người chơi.
   */
  tu_dong?: boolean;
  /**
   * Ba cách ra là BA hành động khác nhau — xem docstring `HanhDongVong` ở
   * server/holdem/engine.ts. Gửi `cat_lo` cho nhánh "đứng ngoài" là lỗi cũ đã
   * làm hai tư thế `dung_ngoai`/`dau_hang` không bao giờ được gán.
   */
  /**
   * v55 (D409) — lựa chọn ở CHỢ TRAIT (chỉ vòng mốc): id lấy + số lần đã cuộn (server tính lại lượt mời từ seed và trừ xu).
   * VẮNG = bỏ qua lượt (không phạt). Server bác `trait_lech_can` khi phần lấy không cân 0.
   */
  trait?: { lay: string[]; cuon: number };
  /** v55 (D409) — lệnh CHỐT LỜI TRONG Ô (Lướt Sóng mới): mỗi mã một lệnh, mục tiêu bp giá + phần bán bp. */
  chot_loi?: { ma: string; nguong_bp: number; phan_bp: number }[];
  hanh_dong: 'giu_vi_the' | 'tang_cam_ket' | 'cat_lo' | 'dung_ngoai' | 'dau_hang';
  them: number;
  /** CHUỖI hành động cược trong vòng — xem `LuotDTO`. */
  cuoc?: HanhDongCuoc[];
  /**
   * v10 NAV — chuỗi lệnh giao dịch THEO MỐC. Mốc mịn (bước 5%) cần lá Chia
   * Lệnh; không lá chỉ mốc thô — SERVER kiểm trên trạng thái lúc áp, client
   * chỉ bày nấc cho đúng để người chơi không bấm phải cú từ chối.
   */
  lenh?: { ma: string; chieu: 'mua' | 'ban' | 'khong' | 'dong_khong'; moc_bp: number }[];
  /**
   * LÕI VỐN A — bán một bản `tu`, mua `den` ở nhịp 1 vòng này. Tối đa 1 lần/vòng.
   * VẮNG MẶT = không đảo (đừng gửi `undefined` tường minh — server phân biệt).
   */
  dao?: { tu: string; den: string };
  /** LÕI VỐN B — bật khoá 2 vòng lên mã này. Vắng mặt = không khoá. */
  khoa?: string;
  /**
   * D33 — ĐẶC QUYỀN PHÒNG HỘ: đặt lệnh SHORT mã này ở nhịp 1 vòng này, KHỚP
   * VÒNG SAU. Vắng mặt = không đặt (đừng gửi `undefined` tường minh).
   */
  short?: string;
  /**
   * v43 — NGÂN HÀNG. `huy` chạy TRƯỚC `khop_truoc`, `mo` chạy SAU `lenh` — thứ
   * tự ấy là luật của `replay()`, không phải thứ tự trong object này.
   *
   * ⚠ VẮNG MẶT khi không gửi/không huỷ; đừng gửi mảng rỗng. `action_log` của một
   * vòng không đụng ngân hàng phải trông y hệt dòng của trận trước v43, nếu
   * không thì mọi so sánh golden lệch mà chẳng có luật nào đổi.
   */
  tiet_kiem?: {
    /** Id hợp đồng huỷ trước hạn — mất toàn bộ lãi treo. */
    huy?: string[];
    /** Mở hợp đồng mới; áp TUẦN TỰ (mốc sau tính trên tiền mặt CÒN LẠI). */
    mo?: { moc_bp: number; so_vong: number }[];
  };
  /**
   * v32 — KỲ NGỘ: nhiệm vụ chọn ở vòng này. Vắng mặt = bỏ qua (KHÔNG phạt —
   * doc 06 §1.4). Server lọc theo bộ ĐƯỢC MỜI của đúng (seed, vòng), nên gửi
   * một món không được chào là bị bỏ qua im lặng chứ không đổi được luật.
   */
  ky_ngo?: NhiemVuIdDTO;
  /**
   * D93 — LỜI KHAI SỰ CỐ: vòng này client đã gửi hỏng mấy lần (kể từ lúc thấy
   * vòng mở), lỗi cuối là gì. Server CHỈ ghi khi vòng bị chốt hộ (`het_gio`) —
   * để trong `events` phân biệt được "mất lượt vì server chết" với "AFK".
   * Vắng mặt = không có gì để khai. Không đổi một chip nào (nhãn, không phải luật).
   */
  su_co_khai?: { so_lan_hong: number; loi_cuoi: 'timeout' | 'network' | 'server' };
}

export type LoaiCuoc = 'theo' | 'to' | 'bo';

export interface HanhDongCuoc {
  loai: LoaiCuoc;
  /** Chỉ dùng với 'to' — số chip bỏ THÊM. */
  them?: number;
}

/** Một nước trong vòng cược, theo đúng thứ tự đã diễn ra. */
export interface NuocCuoc {
  ghe_id: string;
  loai: LoaiCuoc;
  them: number;
  /** Giá phải theo TẠI thời điểm nước này — dựng lại được áp lực lúc đó. */
  gia: number;
  /**
   * ĐỘ TRỄ NGHĨ của bot (ms) — client tự đợi, server không hề chờ.
   * Chỉ có với bot.
   */
  nghi_ms?: number;
  /**
   * MỐC HẾT HẠN của người thật (ISO). Chỉ có ở bản nhiều người.
   * UI vẽ đếm ngược tới mốc này thay vì đợi `nghi_ms`.
   *
   * Hai trường loại trừ nhau, và đó là CHỦ Ý: cùng một component đồng hồ chạy
   * được cả hai chế độ, nên mở bản người thật không phải viết lại luồng UI.
   */
  han_ts?: string;
}

/** Bối cảnh khi TỚI LƯỢT người chơi. */
export interface ChoBanDTO {
  gia: number;
  con_thieu: number;
  quy_hien_tai: number;
  duoc: LoaiCuoc[];
  to_toi_da: number;
  so_nguoi_con: number;
}

export interface LuotDTO {
  /** null = không còn lượt nào của mình trong vòng này. */
  cho_ban: ChoBanDTO | null;
  xong_vong: boolean;
  nhat_ky: NuocCuoc[];
}

// ═══════════════════ BẢNG ĐIỆN TỬ (pop-up trả phí) ═══════════════════
/*
 * Hình dạng CHÉP TAY từ `server/holdem/bang_dien_tu.ts`. Đừng "dọn cho gọn":
 * mỗi trường null-able ở đây mã hoá một luật che thông tin, và gộp hai trạng
 * thái lại là UI vẽ sai đúng chỗ người chơi vừa trả tiền để nhìn cho rõ.
 */

/** v54 (D395) — thêm `can` (dưới mỏng) và `rat_day` (trên dày) khi trận chạy thang năm nấc. */
export type NacThanhKhoanDTO = 'can' | 'mong' | 'vua' | 'day' | 'rat_day';

export interface ThanhThanhKhoanDTO {
  tai_san_id: string;
  label: string;
  /** Emoji trong `config/holdem.ts` — KHÔNG render (xem TheGiaiThich, luật 4 pixel). */
  icon: string;
  /** Nấc NỀN dán trên lá — để thấy nấc hiệu dụng đã co giãn bao nhiêu. */
  nac_nen: NacThanhKhoanDTO;
  /** v54 (D395) — vạch pin của nấc nền (server cấp; API cũ vắng). */
  vach_nen?: number;
  /** `null` ⇔ `suong_mu` (LUẬT 2): mã đầu cơ chỉ có biên độ, không có nấc. */
  nac: NacThanhKhoanDTO | null;
  vach: number | null;
  tong_vach: number;
  do_sau: number | null;
  suong_mu: boolean;
  /**
   * Biên độ nhấp nháy, CHỈ khi sương mù.
   *
   * ⚠ Founder chốt 26/07: nấc thật ĐƯỢC PHÉP nằm NGOÀI biên này. UI không được
   * vẽ nó như một khoảng bảo đảm — đó là lời hứa server cố ý không đưa ra.
   */
  bien?: readonly [NacThanhKhoanDTO, NacThanhKhoanDTO];
  bien_vach?: readonly [number, number];
}

/**
 * Một dòng sổ cái dư âm. BA trạng thái, UI phải vẽ KHÁC NHAU:
 *
 *   A. ĐỦ SÁNG   `an=false`, `dao` boolean, `luc_bp` number  → vào tổng ròng.
 *   B. NỬA SÁNG  `an=false`, có `do_lon_bp`/`con_vong`, `dao=null`, `luc_bp=null`
 *      = sự kiện vòng LIỀN TRƯỚC: biết ĐỘ LỚN, chưa biết CHIỀU (cờ tin giả chưa
 *      lộ). KHÔNG vào tổng ròng. Gộp nó vào (C) là nói dối theo hướng ngược lại:
 *      giấu mất một con số server đã chịu bán.
 *   C. "?"       `an=true`, mọi số null → LUẬT 1, ô vừa lật đầu vòng này.
 *      TÊN sự kiện KHÔNG bị che (người chơi thấy ô lật rồi) — chỉ SỐ bị che.
 */
export interface DongSoCaiDTO {
  vong: number;
  su_kien: string;
  label: string;
  icon: string;
  /** Thang 10.000 = 100%. */
  do_lon_bp: number | null;
  /** Số vòng còn hiệu lực SAU vòng này (0 = vòng này là cuối). */
  con_vong: number | null;
  dao: boolean | null;
  luc_bp: number | null;
  an: boolean;
}

export interface BangDienTuDTO {
  vong: number;
  /** Phí lần mở này — hiện ra để UI không tự gõ con số. */
  phi: number;
  thanh_khoan: readonly ThanhThanhKhoanDTO[];
  so_cai: readonly DongSoCaiDTO[];
  tong_rong_bp: number;
  /** UI PHẢI nói ra, nếu không người chơi tưởng tổng ròng là đủ. */
  so_dong_chua_ro: number;
  gia_dinh_tin_that: boolean;
  /** D33 — bảng đang chạy hạng SẠCH (thẻ Lướt Sóng): hết trễ, hết sương mù. */
  sach?: boolean;
  /**
   * K4 (D164) — VỊ TRÍ TRONG CHUỖI VĨ MÔ: gộp từ thông tin công khai (ô đã
   * lật + mức lãi). Vắng/null = server cũ hoặc chưa có ô pha nào lật.
   * ⚠ Không bao giờ chứa nhãn NGUỒN chuỗi — latent (addendum §7).
   */
  chuoi_vi_mo?: {
    huong: 'len' | 'xuong' | 'ngang'; dai: number;
    moi_truong: 're' | 'trung_tinh' | 'dat';
  } | null;
  /** D33 — dự báo 3 tên ô kế. `null`/vắng = không mua nấc +30. */
  du_bao?: DuBaoDTO | null;
  /**
   * CẤP 2 LƯỚT SÓNG — XÁC THỰC TIN (vai ĐỘI LÁI, 22/08). `null`/vắng = không ở
   * cấp 2. `xac_suat_gia_bp`: xác suất ô ĐANG lật là tin giả (vẫn phải đoán).
   * `lo_som`: cờ thật của ô TRƯỚC, lộ sớm một vòng — CHỈ khi mã mình đang ôm là
   * TÂM BÃO của sự kiện đó.
   */
  xac_thuc?: {
    xac_suat_gia_bp: number | null;
    lo_som: { su_kien: string; label: string; la_tin_gia: boolean } | null;
  } | null;
}

/** Một tên trong danh sách dự báo. */
export interface TenDuBaoDTO {
  kind: 'giai_doan' | 'su_kien';
  id: string;
  label: string;
  icon: string;
}

/**
 * D33 — DỰ BÁO 3 TÊN Ô KẾ (nấc +30 của thẻ Lướt Sóng).
 *
 * ⚠ UI PHẢI NÓI RA `so_ten_sai`. Ba tên này KHÔNG phải "ba khả năng", chúng là
 * "ba tên trong đó chắc chắn có ít nhất một tên SAI" — phương án A của founder,
 * và cả điểm cân bằng của đặc quyền nằm ở đó. Vẽ như một danh sách khả năng
 * thuần là hứa hộ server một lời server cố ý không hứa.
 *
 * KHÔNG xếp lại thứ tự: server đã xáo tất định, và thứ tự CỐ Ý không phản ánh
 * xác suất. Sort lại ở client là bịa ra một thông tin không tồn tại.
 */
export interface DuBaoDTO {
  vong: number;
  ten: readonly TenDuBaoDTO[];
  so_ten_sai: number;
}

/**
 * GIÁ NIÊM YẾT DỰ PHÒNG cho nút mở bảng — ĐƯỜNG TẮT CÓ NGÀY CHẾT (A8.9).
 *
 * Vì sao phải có: nút bắt buộc báo giá TRƯỚC khi bấm ("thu tiền mà không báo giá
 * là lừa"), nhưng giá thật chỉ nằm trong payload của lần mở ĐÃ trả tiền. Đóng
 * vòng lặp đó cần catalog cấp giá.
 *
 * ĐIỀU KIỆN GỠ: ngay khi `/holdem/catalog` trả `luat.PHI_BANG_DIEN_TU`, xoá hằng
 * số này và để `phi` là bắt buộc. Test `bangdientu.test.tsx` khoá chiều ưu tiên
 * (catalog thắng hằng số), nên bỏ quên là đỏ build chứ không im lặng lệch giá —
 * mà lệch giá ở đây nghĩa là màn hình niêm yết một đằng, Vốn bị trừ một nẻo.
 */
export const PHI_BANG_DIEN_TU_MAC_DINH = 25;

/**
 * ⚠ ĐƯỜNG DẪN CHỜ NỐI — endpoint do agent khác dựng SONG SONG, chưa tồn tại lúc
 * viết dòng này. Tên đặt theo nếp sẵn có (`/matches/:id/luot`, `/matches/:id/shop`).
 * Khác đường thật thì sửa ĐÚNG chỗ này, không rải fetch ra component.
 *
 * POST chứ không GET: lần mở TRỪ VỐN và phải vào `action_log` để replay dựng lại
 * được (xem docstring `apPhiMoBang`). Một GET có tác dụng phụ là thứ trình duyệt,
 * proxy và nút back đều được phép gọi lại tuỳ ý.
 */
export const DUONG_DAN_BANG_DIEN_TU = (matchId: string): string =>
  `/holdem/matches/${matchId}/bang-dien-tu`;

/**
 * MỞ BẢNG ĐIỆN TỬ — một lần mở = một lần trừ Vốn.
 *
 * Không dùng `useQuery`: query tự gọi lại (focus, remount, retry) và mỗi lần gọi
 * lại ở đây là một lần người chơi mất Vốn mà không hề bấm gì.
 */
export function useMoBangDienTu(matchId: string | null) {
  return useMutation({
    /**
     * `du_bao` = nấc +30 của D33. Gửi CỜ chứ không gửi giá: giá là việc của
     * server (`giaMoBang`), và client gõ lại ba con số 80/100/110 là đúng cách
     * để màn hình niêm yết một đằng còn Vốn bị trừ một nẻo.
     */
    mutationFn: (v: { vong: number; du_bao?: boolean }) => api<BangDienTuDTO>(
      DUONG_DAN_BANG_DIEN_TU(matchId ?? ''), {
        method: 'POST',
        body: { vong: v.vong, ...(v.du_bao ? { du_bao: true } : {}) },
      }),
  });
}

// ══════════════════════════ Hooks ══════════════════════════

export function useHoldemCatalog() {
  return useQuery({
    queryKey: ['holdem', 'catalog'],
    queryFn: () => api<CatalogDTO>('/holdem/catalog'),
    staleTime: 60 * 60 * 1000, // luật không đổi trong phiên
  });
}

/**
 * Artwork 26 thẻ. Tách khỏi catalog vì nặng (~250KB) và gần như không đổi —
 * server đã đặt Cache-Control immutable. `staleTime: Infinity` để trong một
 * phiên không bao giờ tải lại.
 */
/**
 * ART THẺ — GỌI KÈM PHIÊN BẢN TRONG URL.
 *
 * ⚠ KHÔNG BỎ THAM SỐ `?v=`. Endpoint này từng trả `Cache-Control: max-age=86400,
 * immutable`, và `immutable` nghĩa là trình duyệt KHÔNG kiểm lại — kể cả khi người
 * chơi tải lại trang. URL cố định + immutable = đổi art xong thì người chơi cũ giữ
 * art cũ tới một ngày, và KHÔNG có cách nào ở phía server cứu được: máy đã cache
 * thì nó không hỏi nữa.
 *
 * Đo được đúng thế 26/07 lúc pixel hoá: API trả 29 art pixel mà trình duyệt vẫn vẽ
 * 28 art vector; sửa header xong vẫn cũ, vì bản `immutable` đã nằm sẵn trong cache.
 * Thứ duy nhất thoát được là MỘT URL KHÁC.
 *
 * Nên art đi theo `engine_version` của catalog: bản mới ⇒ URL mới ⇒ chưa từng được
 * cache ⇒ tải về ngay. Đây đúng nếp tên-file-băm của asset, chỉ là làm ở tầng query.
 * Đổi lại: art chờ catalog xong mới gọi — catalog nhỏ, đánh đổi đáng.
 */
export function useHoldemArt(version?: string) {
  return useQuery({
    queryKey: ['holdem', 'art', version ?? 'chua-ro'],
    queryFn: () => api<{ version: string; art: Record<string, string> }>(
      `/holdem/art?v=${encodeURIComponent(version ?? 'chua-ro')}`),
    enabled: !!version,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useTaoTran() {
  const qc = useQueryClient();
  /*
   * SUẤT TRẬN (SPEC tran-tran-ngay) — màn đã bấm TÌM TRẬN còn mở không. Hàng chờ có thể dài cả giờ và người chơi được phép
   * lướt sang Hub trong lúc chờ; khi đó màn gốc đã tháo nên `onSuccess` truyền vào `mutate()` KHÔNG chạy (React Query bỏ callback
   * của observer đã tháo). Trận lúc ấy vẫn được tạo thật ⇒ giao cho dải chung đưa vào (`baoTranMoCoi`), không bỏ rơi.
   */
  const conMo = useRef(true);
  useEffect(() => {
    conMo.current = true;
    return () => { conMo.current = false; };
  }, []);
  return useMutation({
    // D6 — khẩu vị đi kèm lệnh tạo trận; server chốt và lưu vào sơ đồ ghế.
    // 28/07 — thêm chế độ: 'rank_pve' = XẾP HẠNG mùa Beta (điểm mùa, đấu máy).
    // 02/08 — thêm cỡ bàn: `soO` ∈ CO_MAP_CHON (D31 phòng 8/12/16); server
    // validate lại và LƯU vào trận — giá trị lạ rơi về mặc định, không chặn.
    // 02/08 — `tap` = MÀN TẬP: server ghim seed cố định + bàn 8 ô, coach ở
    // client dẫn từng bước. Vẫn là trận tự do bình thường về mọi mặt còn lại.
    // 16/08 — `banMa` = vào BÀN CHUNG theo seed (migration 0040): server lấy seed +
    // cỡ map từ bàn, một tài khoản một trận mỗi bàn (409 `da_vao_ban` kèm match_id cũ).
    // 12/09 — `epSeed` = ÉP SEED (chỉ tester, chỉ trận tự do; server chặn ở cửa).
    mutationFn: (opts?: {
      khauVi?: KhauViDTO['id']; cheDo?: 'tu_do' | 'rank_pve'; soO?: number;
      tap?: boolean; banMa?: string; epSeed?: number;
      /** D456 — ÉP KHOÁ LUẬT (chỉ tester; server kiểm quyền + khoá phải đang sống). Lối vào: `?luat=` ở sảnh. */
      epBalance?: string;
    }) => quaHangSuat(() =>
      api<TrangThaiDTO>('/holdem/matches', {
        method: 'POST',
        body: {
          ...(opts?.epSeed !== undefined ? { ep_seed: opts.epSeed } : {}),
          ...(opts?.epBalance !== undefined ? { ep_balance: opts.epBalance } : {}),
          ...(opts?.khauVi ? { khau_vi: opts.khauVi } : {}),
          ...(opts?.cheDo === 'rank_pve' ? { che_do: 'rank_pve' } : {}),
          ...(opts?.soO ? { so_o: opts.soO } : {}),
          ...(opts?.tap ? { tap: true } : {}),
          ...(opts?.banMa ? { ban_ma: opts.banMa } : {}),
        },
      })).then((d) => {
        if (!conMo.current) baoTranMoCoi({ matchId: d.match_id, tap: opts?.tap === true });
        return d;
      }),
    onSuccess: (d) => {
      /*
       * ⚠ GỠ 03/08: chỗ này từng ghi telemetry `dang_ky_buoc/tran-dau` làm bậc
       * cuối của phễu đăng ký. Gỡ vì nó vừa THỪA vừa SAI:
       *  · thừa — `holdem_matches` đã ghi đúng việc này ở máy chủ, không mất khi
       *    mạng rớt, và có sẵn cho cả 137 trận cũ;
       *  · sai — nó bắn ở MỌI lần tạo trận, nên đứng trong một phễu thì bậc cuối
       *    to hơn bậc đầu. Đo thử ra "% còn lại" 400%.
       */
      qc.setQueryData(['holdem', 'match', d.match_id], d);
    },
  });
}

/**
 * TRẬN ĐANG DỞ — đường về cho người bị rớt mạng giữa trận (rà 11/08).
 *
 * ⚠ Endpoint `/holdem/me/matches` ĐÃ TỒN TẠI TỪ LÂU mà client CHƯA BAO GIỜ
 * gọi — đúng lớp "cơ chế trang trí" repo dính nhiều lần, lần này ở chiều
 * server-có-client-không.
 *
 * Vì sao cần: response `POST /matches` rớt là trận MỒ CÔI — người chơi bấm lại
 * thành trận thứ hai, trận đầu nằm chờ tới khi bộ quét dọn đóng nó (45 phút).
 * Và ai đóng app giữa trận thì hiện KHÔNG CÓ đường nào quay lại bàn cũ.
 */
export function useTranDangDo(enabled = true) {
  return useQuery({
    queryKey: ['holdem', 'me', 'matches'],
    queryFn: () => api<{
      tran: {
        match_id: string; status: string; vong_hien_tai: number;
        started_at: string; ended_at: string | null;
        /**
         * D93 — còn TIẾP ĐƯỢC không, do SERVER tính bằng đúng luật hạn trận
         * của bộ quét (C4: client không tự suy từ giờ). `dang_choi` mà quá 45'
         * giữa hai tick thì trường này false — sảnh không mời một bàn đã chết.
         * API cũ không có trường ⇒ `undefined` ⇒ client rơi về `status` như trước.
         */
        tiep_duoc?: boolean;
      }[];
    }>('/holdem/me/matches'),
    enabled,
    // Vào sảnh là hỏi lại: trận có thể vừa bị tick dọn từ lúc mở tab.
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useTrangThai(matchId: string | null) {
  return useQuery({
    queryKey: ['holdem', 'match', matchId],
    queryFn: () => api<TrangThaiDTO>(`/holdem/matches/${matchId}`),
    enabled: !!matchId,
    // D11: KHÔNG polling trong trận — mỗi vòng đúng một POST khi người chơi nộp.
    refetchInterval: false,
    refetchOnWindowFocus: false,
    /*
     * Rà đồng hồ 08/08 — VÀO MÀN LÀ HỎI LẠI, luôn luôn. Ảnh chụp trong cache
     * mang một `dong_ho` đông cứng tại thời điểm chụp; rời màn 20 giây rồi
     * quay lại mà vẽ nó ra là đồng hồ nói dối LÊN đúng 20 giây, và người chơi
     * mất lượt vì tin con số đó. Một GET mỗi lần vào màn nằm gọn trong ngân
     * sách D64 (~200 request/trận đã tính polling chờ người khác).
     */
    refetchOnMount: 'always',
  });
}

export function useNopVong(matchId: string | null) {
  return useMutation({
    /*
     * ⚠ `bo_cuc` TIÊM Ở ĐÂY, KHÔNG BẮT CHỖ GỌI TỰ THÊM.
     * Nó là một trường phục vụ PHÂN TÍCH, tức thứ không ai nhìn thấy khi thiếu —
     * để mỗi chỗ gọi tự nhớ là bảo đảm có ngày sót một chỗ, và chỗ sót đó không
     * báo lỗi, chỉ lặng lẽ đẻ ra dữ liệu khuyết. Tiêm ở cửa gửi thì không quên được.
     *
     * ⚠ KHÔNG ghi response vào query-cache (rà đồng hồ 08/08). Trước đây có
     * `onSuccess: setQueryData` — nghe như dọn dẹp vô hại, nhưng màn trận đọc
     * `st = stCuc ?? tt.data`: lần nộp ĐẦU TIÊN sau khi nạp màn (stCuc còn
     * null) thì cú ghi cache làm bàn + đồng hồ nhảy sang vòng mới NGAY DƯỚI
     * overlay khoảnh khắc — cơ chế "giữ màn cũ tới khi diễn xong" chỉ chạy từ
     * lần nộp thứ hai. Cache cứ để cũ: `refetchOnMount: 'always'` của
     * `useTrangThai` bảo đảm lần vào màn kế tiếp luôn hỏi server.
     */
    mutationFn: (input: NopVongInput) => {
      const body = { bo_cuc: boCucHienTai(), ...input };
      return guiLaiKhiMatMang(() => api<TrangThaiDTO>(`/holdem/matches/${matchId}/rounds`, { method: 'POST', body }));
    },
  });
}

/** Số lần GỬI LẠI tối đa sau cú đầu (SPEC chan-truoc-beta mục 6). */
export const SO_LAN_GUI_LAI_VONG = 2;
/** Chờ mạng về tối đa bấy nhiêu ms trước mỗi lần gửi lại — quá thì báo lỗi như cũ, người chơi tự bấm lại. */
export const CHO_MANG_VE_MS = 30_000;

/**
 * GỬI LẠI CÚ NỘP VÒNG KHI PHẢN HỒI MẤT TRÊN ĐƯỜNG (SPEC chan-truoc-beta — "mất mạng giữa trận bấm lại vẫn ra đúng kết quả vòng").
 *
 * Gửi lại AN TOÀN vì server đối chiếu nội dung: cùng `vong` + `hanh_dong` của vòng vừa nộp ⇒ trả đúng kết quả cũ, không ghi thêm
 * (`traLoiGuiLai` ở server). Máy chủ ĐÃ trả lời (409/400/5xx) thì tuyệt đối không gửi lại ở đây.
 * Chỉ hai ca, mỗi ca ≤ `SO_LAN_GUI_LAI_VONG` lần:
 *   · HẾT 15 s CHỜ (`timeout`) — cú nộp có thể đã ghi, phản hồi lạc;
 *   · MÁY ĐANG OFFLINE (`navigator.onLine === false`) — chờ sự kiện `online` (tối đa `CHO_MANG_VE_MS`) rồi gửi lại.
 * ⚠ "Lỗi mạng" mà máy vẫn ONLINE (máy chủ không với tới / sập) KHÔNG gửi lại ở đây: gửi lại ngay là nhân ba số POST vào đúng
 *   máy chủ đang hỏng (C2 · D414 — đã có thang giãn riêng). Ca ấy đi đường D412 cũ: màn hỏi lại server, server đã ghi thì bàn
 *   sang vòng sau, chưa ghi thì nút sống lại.
 */
export async function guiLaiKhiMatMang<T>(
  goi: () => Promise<T>,
  soLan = SO_LAN_GUI_LAI_VONG,
  choMang: () => Promise<void> = choMangVe,
  dangOffline: () => boolean = () => typeof navigator !== 'undefined' && navigator.onLine === false,
): Promise<T> {
  for (let lan = 0; ; lan += 1) {
    try {
      return await goi();
    } catch (e) {
      const nenGuiLai = e instanceof ApiError && e.chuaToiMayChu && (e.code === 'timeout' || dangOffline());
      if (!nenGuiLai || lan >= soLan) throw e;
      await choMang();
    }
  }
}

function choMangVe(): Promise<void> {
  return new Promise((xong) => {
    const nhip = (): void => { setTimeout(xong, 600); };
    if (typeof navigator === 'undefined' || navigator.onLine !== false) { nhip(); return; }
    const het = setTimeout(() => { window.removeEventListener('online', ve); xong(); }, CHO_MANG_VE_MS);
    function ve(): void { clearTimeout(het); window.removeEventListener('online', ve); nhip(); }
    window.addEventListener('online', ve);
  });
}

/*
 * ⚠ TÍNH CÁCH TÀI CHÍNH KHÔNG NẰM Ở ĐÂY MÀ Ở `api/tinh_cach.ts` — CÓ LÝ DO:
 * tường lửa D24 cấm màn nào import cả file này (ví trận) lẫn `api/queries`
 * (ví T), mà trang Tài chính cá nhân cần hồ sơ hành vi + dòng token cùng lúc.
 * Kênh đọc thuần phải đứng ngoài cả hai ví. Đừng "dọn cho gọn" mà kéo nó về.
 */

/*
 * ⚠ `useKhopLenh` (POST /holdem/matches/:id/khop-lenh — nút KHỚP NGAY, founder 08/08) ĐÃ GỠ 28/09 — D447. Phí mua bán
 * cộng dồn cả vòng (v56) ⇒ khớp giữa vòng không còn khác khớp lúc chốt, founder bỏ nút. Endpoint bên server GIỮ cho
 * trận đang chơi dở trên bản web cũ và cho replay (`khop_truoc` trong log).
 */

/*
 * ⚠ `useHoiLuot` (POST /holdem/matches/:id/luot) ĐÃ GỠ 11/08 — xem D81.
 * Máy cược tuần tự chết từ D40; endpoint bên server gỡ cùng đợt. Các kiểu
 * `LuotDTO`/`ChoBanDTO`/`NuocCuoc` giữ lại vì `HanhDongCuoc` còn nằm trong
 * body nộp vòng (trường `cuoc`, luôn rỗng) — gỡ kiểu là đụng hình dạng
 * request, việc riêng.
 */

/** Shop ở lần khảo sát thứ N. Chỉ ĐỌC — tất định theo (seed, vòng, ghế, lượt). */
export function useKhaoSatLai(matchId: string | null) {
  return useMutation({
    mutationFn: (lan: number) =>
      api<{ shop: ShopDTO; lan_khao_sat: number; luot_con_lai: number }>(
        `/holdem/matches/${matchId}/shop?lan=${lan}`),
  });
}

/**
 * v55 (D409) — lượt mời trait ở lần cuộn k (`GET /shop?cuon=k`, cùng endpoint khảo sát lại; `cho_trait` là ANH EM của
 * `shop` trong JSON, không nằm trong nó). Chỉ ĐỌC — tất định theo (seed, vòng, ghế, k); xu trừ lúc CHỐT VÒNG. `gia` = xu
 * phải trả cộng dồn tới lần k. Vắng `cho_trait` = không phải vòng mốc.
 */
export function useCuonTrait(matchId: string | null) {
  return useMutation({
    mutationFn: (k: number) =>
      api<{ shop: ShopDTO; cho_trait?: ChoTraitDTO & { gia: number; xu: number } }>(
        `/holdem/matches/${matchId}/shop?cuon=${k}`),
  });
}

export function useAutopsy(matchId: string | null, batDau: boolean) {
  return useQuery({
    queryKey: ['holdem', 'autopsy', matchId],
    queryFn: () => api<AutopsyDTO>(`/holdem/matches/${matchId}/autopsy`),
    enabled: !!matchId && batDau,
  });
}

export interface CanhBaoDTO {
  the: string; nhan: string; xung_dot_voi: string; nhan_xung_dot: string;
}

/** Gọi TRƯỚC khi xác nhận mua — không hiện cảnh báo là gài bẫy, không phải dạy. */
export function useCanhBaoXungDot() {
  return useMutation({
    mutationFn: (b: { the: string; tai_san: string[]; chien_thuat: string[] }) =>
      api<{ canh_bao: CanhBaoDTO | null }>('/holdem/canh-bao-xung-dot',
        { method: 'POST', body: b }),
  });
}

// ══════════════════════ Tiện ích thuần ══════════════════════

/** bp → chuỗi %. 1200 → "+12,00%". */
export function pctBp(bp: number): string {
  const v = (bp / 100).toFixed(2).replace('.', ',');
  return (bp >= 0 ? '+' : '') + v + '%';
}

export const dinhDangChip = (n: number): string => (n ?? 0).toLocaleString('vi-VN');

/**
 * Khoảnh khắc đáng công bố toàn màn trong một vòng.
 *
 * ⚠⚠ NHÁNH ALL-IN ĐÃ GỠ 22/08, VÀ LỚP PHỦ ĐỔI CHỦ SANG **SSS** (chỉ thị
 * founder: *"xóa hiệu ứng all in đi … không còn hiện all in toàn màn hình
 * nữa"* → *"thay bằng hiện toàn màn hình SSS khi player đạt điểm SSS"*).
 *
 * Vì sao đổi chủ chứ không xoá hạ tầng: lớp phủ toàn màn là một tài nguyên
 * KHAN HIẾM của màn chơi — nó dừng bàn lại ~2,4 giây, nên chỉ đáng tiêu cho
 * biến cố thật sự hiếm. ALL-IN không hiếm (một cú bấm, vài lần mỗi trận, ở bàn
 * 8 ghế thì MỖI ghế một lượt); hạng SSS thì hiếm — D105 đo phân phối 600 trận:
 * **SSS 3,3%**. Đúng thứ đáng dừng bàn.
 * Ngưỡng all-in cũ (tỷ lệ ≥0,98 chứ không so bằng tuyệt đối, vì cam kết bị kẹp
 * trần rồi làm tròn xuống nên dồn hết vốn thật vẫn ra 99,7%) ghi lại đây phòng
 * khi có ngày cần dựng lại — nhưng dựng lại thì phải hỏi founder trước.
 *
 * HAI LOẠI, và chúng vào hàng đợi từ HAI NGUỒN khác nhau:
 * · `×2`  — nhân đôi tài khoản trong một vòng; suy từ `ket_qua_vong` (hàm dưới).
 * · `SSS` — thanh phong cách vừa chạm hạng đỉnh; KHÔNG suy được ở đây vì hạng
 *   nằm trên `TrangThaiDTO.phong_cach` chứ không nằm trong kết quả vòng, nên
 *   màn cha (`AlphaDraftMatch`) ghép nó vào hàng đợi. Xem `khoanhKhacSSS`.
 *
 * ⚠⚠ ĐO TRƯỚC KHI GỠ, VÀ PHÉP ĐO LẬT MỘT GIẢ ĐỊNH (22/08, 300 trận bot × 6 ghế
 * × 8 vòng = 14.400 ghế-vòng, engine v34 thật):
 *        khoảnh khắc ALL-IN nổ    0 / 14.400   (0,00%)
 *        khoảnh khắc ×2   nổ      0 / 14.400   (0,00%)
 * Tức lớp phủ toàn màn này ĐÃ LÀ CƠ CHẾ TRANG TRÍ TỪ TRƯỚC — bẫy số 1 của repo,
 * lần thứ n. Hai lý do, mỗi loại một:
 * · ALL-IN chết từ D40: pha cược tuần tự bị khai tử, `cam_ket` nay là CƯỢC NỀN
 *   cố định 500 chip (`HOLDEM_MATCH.CAM_KET_NEN`) chứ không còn là "tiền người
 *   chơi đẩy vào", nên `cam_ket / von_truoc` ≈ 0,05 và chỉ chạm 0,98 khi ghế
 *   còn ~500 chip — tức chữ "All-in" chỉ có cửa nổ cho người SẮP CHÁY. Sai nghĩa.
 * · ×2 đo bằng `von_sau` = `g.von` = TIỀN MẶT (engine.ts:3114), không phải NAV —
 *   đúng lớp lỗi "sai thước" của D44/D46.
 *
 * ⚠⚠ ĐÍNH CHÍNH 23/08 — CON SỐ "0 / 14.400" Ở TRÊN **KHÔNG TÁI LẬP ĐƯỢC**, và
 * nó sai theo hướng nguy hiểm nhất: nó nói một cơ chế đã chết trong khi cơ chế
 * đó đang nổ 8,39% số ghế-vòng và nổ SAI 100%. Đo lại trên engine v34 thật với
 * ĐÚNG bể bot của trận thật (`BOT_CHOI_DUOC`), bàn 6 map 8, 300 trận:
 *        ×2 nổ  1.208 / 14.394  (8,39%)  ·  NAV thật sự gấp đôi:  0
 * Phép đo cũ nhiều khả năng chạy trên một bể bot khác với bể trận thật — đúng
 * lớp D83 (bàn đo đọc sai trò). Bài học lặp lại: một con số khai "cơ chế đã
 * chết" mà không ai đo lại thì nó làm người sau thôi kiểm (D87).
 * ⇒ Thước ×2 ĐÃ SỬA sang `pnl_bp` (xem `timKhoanhKhac`). Vế ALL-IN vẫn đúng.
 */
/**
 * NGƯỠNG NỔ LỚP PHỦ VÒNG LỚN — tính bằng `pnl_bp` của một vòng.
 *
 * ⚠ PLAYTEST-TUNE. Đổi số ở đây là đổi TẦN SUẤT bàn bị dừng, nên phải đo lại
 * trên bể bot THẬT (`scripts/holdem_montecarlo.ts` + bộ đếm phân phối pnl),
 * không đoán — và phải đổi NHÃN theo, không thì cái nhãn nói dối.
 * ⚠ Đây KHÔNG phải tham số kinh tế A4/A5: nó chỉ quyết định khi nào HIỆN một
 * lớp phủ, không chạm một chip nào.
 */
export const NGUONG_KHOANH_KHAC = {
  /** +100% — NAV nhân đôi trong MỘT vòng. 0,06 lần/trận: bậc đỉnh, cố ý hiếm. */
  DINH: 10_000,
  /** +50% — 0,21 lần/trận, cùng nhịp với lớp phủ ký quỹ (19,3% số trận). */
  LON: 5_000,
} as const;

export interface KhoanhKhac {
  /**
   * ⚠ `KY_QUY` KHÔNG phải chữ để vẽ — nó là NHÃN LOẠI. Ba nhánh còn lại (`×2`,
   * `S/SS/SSS`) đều dùng `chu` làm nội dung hiển thị, còn khoảnh khắc ký quỹ vẽ
   * một lá bài GÃY ĐÔI chứ không vẽ chữ nào. Đặt nó ở đây thay vì đẻ một trường
   * phân loại thứ hai là để hàng đợi chỉ có MỘT trục: hai lớp phủ toàn màn cùng
   * nổ một vòng mà không chung hàng đợi thì chúng chồng lên nhau.
   */
  chu: '×2' | '+50%' | HangCongBo | 'KY_QUY';
  gheId: string;
  ten: string;
  bac: string;
  /**
   * Ghế này là NGƯỜI hay MÁY — chốt kèm theo khoảnh khắc, KHÔNG suy lại từ mã ghế.
   *
   * Suy lại (`gheId === 'ban' ? người : máy`) đúng được đúng một giai đoạn rồi sai
   * vĩnh viễn ở đấu rank toàn người thật (D31), và nó sai IM LẶNG: khoảnh khắc
   * vẫn hiện, chỉ là hiện mặt máy cho một con người.
   */
  loai: 'nguoi' | 'bot' | 'bong';
  /** Chuỗi diện mạo — chỉ ghế người; ghế máy KHÔNG có trường này (D25/R3). */
  dm?: string;
  /** Chỉ khoảnh khắc `KY_QUY` — số chip bị lấy khỏi NAV. */
  mat?: number;
}

export function timKhoanhKhac(
  kq: KetQuaVongDTO, doiThu: DoiThuDTO[],
): KhoanhKhac[] {
  const out: KhoanhKhac[] = [];
  // `loai`/`dm` đi KÈM khoảnh khắc: màn toàn màn không được suy lại bản chất ghế
  // từ mã ghế — xem docstring `KhoanhKhac.loai`.
  const xet = (
    g: KetQuaGheDTO, ten: string, bac: string,
    loai: KhoanhKhac['loai'], dm?: string,
  ) => {
    const chung = { gheId: g.ghe_id, ten, bac, loai, ...(dm ? { dm } : {}) };
    /*
     * Nhánh ALL-IN gỡ 22/08 — xem docstring `KhoanhKhac`. Chỉ còn ×2.
     *
     * ⚠⚠ THƯỚC SỬA 23/08, và đây là món nợ D113 tự khai ("sửa thước ×2 sang
     * NAV — chưa làm"). Bản cũ hỏi `von_sau >= von_truoc * 2`, mà cả hai đều là
     * TIỀN MẶT: `von_truoc` chụp SAU khi lệnh mua đã áp (tức tiền lẻ chưa tiêu),
     * `von_sau` chụp SAU khi Quỹ vòng đổ thẳng vào tiền mặt. Nên nó thực chất
     * hỏi *"suất thưởng có lớn hơn số tiền lẻ tôi chưa tiêu không"* — không hỏi
     * gì về tài khoản. Bot giữ đúng 500 tiền mặt còn suất quỹ thường 1.000–4.000
     * ⇒ nổ gần như mặc định.
     *
     * ĐO (engine v34 thật, bàn 6 map 8, 300 trận = 14.394 ghế-vòng):
     *        ×2 nổ                       1.208  (8,39%) = 4,03 lần/trận
     *        trong đó NAV cũng gấp đôi        0  ⇒ ĐỘ CHÍNH XÁC 0%
     *        nổ ở vòng ĐANG LỖ              154  ← ăn mừng một cú thua
     * Cộng ~8,5 giây chặn bàn mỗi trận, trên đúng cái tài nguyên mà lớp phủ này
     * tự gọi là KHAN HIẾM, và nó làm loãng chính cú SSS mà D113 dựng ra để phục vụ.
     *
     * `pnl_bp` ĐÃ LÀ đúng thước: engine tính nó từ `nav_truoc`/`nav_sau`, nên
     * `pnl_bp >= 10000` ⟺ NAV nhân đôi, theo định nghĩa. Có sẵn trên cả hai
     * đường (`cua_ban` và `cua_doi_thu`) nên không cần trường DTO mới.
     * ⚠ KHÔNG đi đường "thêm nav_truoc/nav_sau vào DTO": `cua_doi_thu` cố ý chỉ
     * mang 8 trường, và `doi_thu[].nav` là NAV HIỆN TẠI — muốn suy nhân đôi thì
     * client phải tự nhớ NAV vòng trước, mà đường đó gãy ở tự-nộp (D110), ở
     * `dongBoLaiTuServer`, ở tải lại trang và ở nhánh 409.
     */
    /*
     * ⭐⭐ HAI BẬC (24/08, founder: *"Đổi đi ko player lại bảo game lỗi"*).
     *
     * Ngưỡng cũ +100% đúng về nghĩa nhưng gần như không bao giờ nổ, và một cú ăn
     * mừng có trong code mà người chơi không bao giờ thấy thì đọc ra là HỎNG.
     * ⚠ ĐO TRÊN BỂ BOT THẬT (`BOT_CHOI_DUOC`, 4.000 trận = 159.533 ghế-vòng) —
     * đây là số của trận thật, không phải probe bot-ngồi-im:
     *        +100%  0,142% ghế-vòng = 0,06 lần/trận ⇒ MỘT LẦN MỖI 17 TRẬN
     *        + 50%  0,526%          = 0,21 lần/trận ⇒ ~1 mỗi 5 trận
     *        + 30%  2,07%           = 0,83 lần/trận ⇒ gần như mỗi trận
     * Mốc đối chiếu: lớp phủ ký quỹ nổ ở 19,3% số trận và được chấp nhận là "đủ
     * hiếm để đáng dừng bàn"; +50% cho đúng nhịp đó. +30% thì nó thành thường
     * ngày, đúng bệnh mà D116 phải gỡ (×2 cũ nổ 8,39% và chặn ~8,5 giây/trận).
     *
     * ⚠⚠ VÀ NHÃN PHẢI THEO NGƯỠNG. Hạ ngưỡng mà giữ chữ "×2" là để cái nhãn NÓI
     * DỐI — đúng thứ D28 cấm, và sai im lặng vì hoạt ảnh vẫn rất đẹp. Nên `+50%`
     * mang đúng tên của nó, còn `×2` ở lại làm bậc ĐỈNH cho lần nó thật sự xảy
     * ra. Cả hai chuỗi đều vẽ được TRỌN VẸN bằng glyph `ChuPixel` sẵn có
     * (`+ 5 0 % × 2`) — xem `MomentOverlay`.
     *
     * ⚠ `pnl_bp` LÀ đúng thước: engine tính nó từ `nav_truoc`/`nav_sau` nên
     * `>= 10000` ⟺ NAV nhân đôi theo định nghĩa (D116 sửa từ thước tiền-mặt cũ).
     */
    const pnl = g.pnl_bp ?? 0;
    if (pnl >= NGUONG_KHOANH_KHAC.DINH) out.push({ chu: '×2', ...chung });
    else if (pnl >= NGUONG_KHOANH_KHAC.LON) out.push({ chu: '+50%', ...chung });
  };
  // Ghế mình luôn là NGƯỜI; `dm` để trống ở đây vì màn toàn màn đọc thẳng
  // `/auth/me` cho ghế của chính mình (không gửi lại thứ mình đã biết — D11).
  if (kq.cua_ban) xet(kq.cua_ban, 'BẠN', '', 'nguoi');
  for (const d of kq.cua_doi_thu ?? []) {
    const t = doiThu.find((x) => x.ghe_id === d.ghe_id);
    if (t) xet(d, t.ten, t.bac_rank, t.loai, t.dm);
  }
  /*
   * ⚠⚠ GỌI KÝ QUỸ — khoảnh khắc DUY NHẤT của hàng đợi này báo một chuyện XẤU,
   * và là khoảnh khắc duy nhất chỉ dành cho CHÍNH MÌNH.
   *
   * Ba nhánh trên công bố thành tích cho cả bàn xem; cái này là hình phạt riêng,
   * nên nó KHÔNG bao giờ xét `cua_doi_thu` — DTO cũng chỉ mang phần của mình
   * (`ky_quy_cua_ban`). Ăn mừng việc người khác bị lấy tiền không phải thứ trò
   * này muốn dạy, và server không gửi dữ liệu để làm việc đó.
   *
   * ⚠ ĐẶT CUỐI HÀNG ĐỢI có chủ ý: vòng vừa lên hạng vừa bị gọi ký quỹ thì phải
   * khoe trước, phạt sau — đảo lại thì cú lên hạng bị cú gãy lá nuốt mất nghĩa.
   */
  if (kq.ky_quy_cua_ban) {
    out.push({
      chu: 'KY_QUY', gheId: 'ban', ten: 'BẠN', bac: '', loai: 'nguoi',
      mat: kq.ky_quy_cua_ban.mat,
    });
  }
  return out;
}

/**
 * BA MỐC ĐƯỢC CÔNG BỐ TOÀN MÀN, theo thứ tự thấp → cao.
 *
 * Founder 22/08: *"S và SS cũng hiện nhé nhưng mà không dài, ngầu và nhiều
 * hiệu ứng bằng SSS thôi"*.
 *
 * ⚠ CHỈ ba mốc TRÒN, không có `S-`/`S+`. Thang phong cách có nấc ± cho sáu hạng
 * gốc (`server/holdem/phong_cach.ts`), nhưng công bố toàn màn phải là chuyện
 * HIẾM: lấy cả nấc ± thì một trận leo dốc có thể nổ 5 lần, và lần thứ năm chỉ
 * còn là thứ chắn đường. Ba mốc tròn cũng đúng cách người chơi tự kể lại thành
 * tích ("tao lên SS") — không ai khoe mình vừa lên S-.
 */
export const MOC_CONG_BO = ['S', 'SS', 'SSS'] as const;

/** Hạng đỉnh của thang — trùng `THANG` ở `server/holdem/phong_cach.ts`. */
export const HANG_DINH = 'SSS';

/** Thứ tự đầy đủ của thang hạng — trùng `THU_TU` ở `ThanhPhongCach.tsx`. */
const THU_TU_HANG = [
  'E-', 'E', 'E+', 'D-', 'D', 'D+', 'C-', 'C', 'C+',
  'B-', 'B', 'B+', 'A-', 'A', 'A+', 'S-', 'S', 'S+', 'SS', 'SSS',
];

/**
 * Vừa CHẠM một mốc công bố ở cú chốt này chưa? Trả về mốc đó, hoặc `null`.
 *
 * ⚠ Ba điều kiện, thiếu cái nào cũng hỏng theo một kiểu riêng:
 * · `sau` phải là một mốc tròn — nếu không, mọi nấc ± đều nổ (xem `MOC_CONG_BO`);
 * · phải KHÁC `truoc` — giữ nguyên hạng qua nhiều vòng mà nổ lại thì lớp phủ
 *   thành thuế, đúng cái vừa gỡ ở ALL-IN;
 * · phải ĐI LÊN — tụt từ SSS xuống SS mà nổ "SS" thì màn ăn mừng một cú THUA.
 *   Đây là chỗ dễ sai nhất, và nó sai im lặng: vẫn có hiệu ứng đẹp, chỉ là
 *   khen nhầm khoảnh khắc.
 */
export function vuaChamMocCongBo(
  truoc: string | undefined, sau: string | undefined,
): HangCongBo | null {
  if (!sau || !(MOC_CONG_BO as readonly string[]).includes(sau)) return null;
  if (truoc === sau) return null;
  const iTruoc = truoc ? THU_TU_HANG.indexOf(truoc) : -1;
  if (THU_TU_HANG.indexOf(sau) <= iTruoc) return null;
  return sau as HangCongBo;
}

/**
 * Khoảnh khắc hạng của CHÍNH người chơi — ghế `ban`, avatar đọc từ `/auth/me`.
 * Nhãn dưới tên đổi theo bậc: nói "ĐỈNH" cho cả ba là nói dối ở hai bậc dưới.
 */
export function khoanhKhacHang(hang: HangCongBo): KhoanhKhac {
  const bac = hang === 'SSS' ? 'PHONG CÁCH ĐỈNH'
    : hang === 'SS' ? 'PHONG CÁCH SIÊU HẠNG'
      : 'PHONG CÁCH HẠNG S';
  return { chu: hang, gheId: 'ban', ten: 'BẠN', bac, loai: 'nguoi' };
}

/* ══════════════════════════════════════════════════════════════════════════
 * BÀN CHUNG THEO SEED (16/08, đề xuất `moi-ban-vao-doi.md` A, migration 0040)
 * — mời bạn kiểu TFT mà không cần online cùng lúc: một MÃ ↔ (seed, cỡ map),
 * mỗi người một trận riêng cùng seed cùng bot; xong thì so NAV. Server là
 * nguồn duy nhất của mã/seed; client chỉ gọi.
 * ══════════════════════════════════════════════════════════════════════════ */
export interface BanDTO {
  ma: string;
  so_o: number;
  het_han: string;
  created_at: string;
  chu: string;
  la_chu: boolean;
  so_nguoi: number;
  toi: { match_id: string; status: string } | null;
  /** Số của NGƯỜI KHÁC chỉ có khi tôi đã xong (A3.1 — cùng đề mù). */
  toi_da_xong: boolean;
  doi: {
    handle: string; la_toi: boolean; xong: boolean; dang_choi: boolean;
    von_cuoi?: number; hang?: number;
    /**
     * 17/08 — GHOST: đường NAV từng vòng của người này, CHỈ có khi số của họ đã
     * được phép lộ (A3.1 — mình đã chốt bàn xong). Thẻ kết trận vẽ đường mình
     * trên nền đường họ ("cùng một đề").
     */
    duong?: number[];
  }[];
  /**
   * 'doi' = bàn mời bạn (mã) · 'ngay' = THỬ THÁCH HÔM NAY (17/08, 0041) · 'buoi_do' = BÀN BUỔI ĐO (D329,
   * 0066). API cũ vắng ⇒ coi là 'doi'.
   */
  loai?: 'doi' | 'ngay' | 'buoi_do';
  /**
   * D329 — chỉ bàn buổi đo. KHÔNG có danh sách tên (`doi` rỗng — người lạ cùng buổi không thấy nhau).
   * `ma_tham_gia` là của CHÍNH người hỏi (null khi chưa vào) — chép lên bài giấy.
   */
  buoi_do?: {
    nhan: string | null;
    de_id: string;
    ma_tham_gia: string | null;
    da_dong_y: boolean;
    phien_ban_hien_hanh: string;
  };
  /**
   * BÀN NGÀY (D85 §5.2): KHÔNG có danh sách tên (D32 — phân vị, không top-N;
   * `doi` rỗng). Hạng/phân vị/nav của TÔI chỉ có SAU khi tôi xong (A3.1); số
   * người vào/xong công khai. `top_pct` = ceil(100·hạng/tổng) — "TOP 12%".
   */
  thu_thach?: {
    ngay: string;
    so_nguoi_vao: number;
    so_nguoi_xong: number;
    nav?: number;
    hang?: number;
    tong?: number;
    top_pct?: number;
  };
}

/**
 * TIẾN ĐỘ MỞ KHOÁ (D86, 17/08) — `GET /holdem/me/tien-do`: số trận ĐÃ XONG +
 * cỡ bàn/khẩu vị đã mở + còn thiếu mấy trận. LUẬT (bảng mốc) nằm trong catalog
 * `quyet_dinh.MO_KHOA`; endpoint này chỉ nói TÔI đang ở đâu. Server là nguồn
 * duy nhất — client không đếm trận, không tự suy mốc (một nguồn, C4/D61).
 */
export interface TienDoDTO {
  so_tran_xong: number;
  co_map: number[];
  khau_vi: boolean;
  con_thieu: Record<string, number>;
}

export function useTienDo() {
  return useQuery({
    queryKey: ['holdem', 'tien-do'],
    queryFn: () => api<TienDoDTO>('/holdem/me/tien-do'),
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
}

/**
 * THỬ THÁCH HÔM NAY — `GET /holdem/ngay`: bàn của ngày hôm nay theo giờ VN
 * (server tự phát nếu chưa có), cùng hình dạng `BanDTO`. Cache theo NGÀY sẽ
 * tự trôi vì server đổi mã lúc 0:00 VN — hỏi lại khi vào sảnh, thưa 60s.
 */
export function useThuThachNgay(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['holdem', 'ngay'],
    queryFn: () => api<BanDTO>('/holdem/ngay'),
    enabled: opts?.enabled ?? true,
    staleTime: 60_000,
    refetchOnMount: 'always',
  });
}

export function useTaoBan() {
  return useMutation({
    mutationFn: (opts?: { soO?: number }) =>
      api<{ ma: string; so_o: number; het_han: string }>('/holdem/ban', {
        method: 'POST',
        body: { ...(opts?.soO ? { so_o: opts.soO } : {}) },
      }),
  });
}

/**
 * D329 — ĐỒNG Ý BUỔI ĐO. Gửi ĐÚNG phiên bản đang hiệu lực của `config/pfm_consent.ts` (một nguồn với
 * chữ ở `buoi_do_chu.ts`, ghim bằng hash) — không gõ `'v1'` ở đây. Xong thì làm tươi bàn.
 */
export function useDongYBuoiDo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ma: string) => api<{ ok: true; phien_ban: string }>(
      `/holdem/ban/${encodeURIComponent(ma)}/dong-y`,
      { method: 'POST', body: { phien_ban: CONSENT_PHIEN_BAN.buoi_do } },
    ),
    /*
     * D392 — làm tươi CẢ `/auth/me`: cú đồng ý là lúc server CẤP mã buổi đo và bật chế độ tester, mà dải
     * tester (nơi có nút MỞ PHIẾU 1) đọc đúng từ `/auth/me`. Chỉ làm tươi bàn thì dải không hiện cho tới
     * khi hết `staleTime` + đổi tab — tester đứng trước câu "Làm PHIẾU 1 trước đã" mà không có link nào.
     */
    onSuccess: (_d, ma) => {
      void qc.invalidateQueries({ queryKey: ['holdem', 'ban', ma] });
      void qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

/* ═══ D333 — MÀN ĐIỀU PHỐI BUỔI ĐO (`/buoi-do`) ═════════════════════════════════════════════════════════
 * Bốn cửa D329 đã có (tạo · đóng · nhóm) + một cửa đọc mới (`/ban-buoi-do`). Màn chỉ HIỆN; mọi rào (chỉ
 * người điều phối, chỉ chủ bàn, bức tranh chỉ sau khi đóng và trên sàn mẫu) nằm ở server (C4).
 */

/** Một bàn buổi đo của người điều phối — CHỈ số đếm, không tên (server canh: `tests/ban_buoi_do_ds`). */
export interface BanBuoiDoDTO {
  ma: string;
  nhan: string | null;
  de_id: string;
  het_han: string;
  created_at: string;
  da_dong: boolean;
  so_nguoi: number;
  so_xong: number;
}

export interface DsBuoiDoDTO {
  /** Đề chọn được khi tạo bàn — chỉ id + cỡ (seed không rời server). */
  de: { id: string; so_o: number }[];
  /** Sàn mẫu của bức tranh nhóm (`PFM.SAN_MAU_BAN`) — để màn nói "cần ít nhất N người" bằng số server. */
  san: number;
  ban: BanBuoiDoDTO[];
}

/** Bức tranh nhóm (`GET /holdem/ban/:ma/nhom`) — `nang_luc` chỉ có khi `du_mau`. */
export interface NhomBuoiDoDTO {
  ma: string;
  nhan: string | null;
  de_id: string;
  da_dong: boolean;
  san: number;
  n: number;
  du_mau: boolean;
  nang_luc?: {
    id: NangLucId;
    pct: { chua_gap: number; gap_chua_vung: number; lam_duoc: number };
  }[];
}

export function useDsBuoiDo() {
  return useQuery({
    queryKey: ['holdem', 'buoi-do'],
    queryFn: () => api<DsBuoiDoDTO>('/holdem/ban-buoi-do'),
    // Số người vào/xong đổi trong lúc buổi chạy — hỏi lại thưa, 15s là đủ cho một phòng học.
    refetchInterval: 15_000,
    staleTime: 5_000,
    // 403 `khong_phai_dieu_phoi` là câu trả lời, không phải trục trặc: hỏi lại chỉ làm chậm màn báo.
    retry: false,
  });
}

export function useTaoBuoiDo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { de_id: string; nhan: string; ngay_dong?: string }) =>
      api<{ ma: string; so_o: number; het_han: string; de_id: string; nhan: string }>('/holdem/ban', {
        method: 'POST', body: { loai: 'buoi_do', ...b },
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['holdem', 'buoi-do'] }); },
  });
}

/**
 * D370 — TIẾN MỘT BƯỚC trong lộ trình tester. Server dùng `GREATEST` nên gọi lại với số nhỏ hơn
 * không hạ được gì; client cứ gửi số nó biết, không phải tự canh.
 *
 * ⚠ `invalidateQueries(me)` là bắt buộc: dải chế độ tester đọc bước từ `/auth/me`, không giữ trạng
 * thái riêng. Giữ bản sao ở client là dựng nguồn thứ hai cho một con số mà chỉ server được đổi.
 */
export function useTienBuocBuoiDo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (buoc: number) =>
      api<{ ok: true; buoc: number }>('/holdem/buoi-do/buoc', { method: 'POST', body: { buoc } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: queryKeys.me }); },
  });
}

export function useDongBuoiDo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ma: string) => api<{ ok: true }>(`/holdem/ban/${encodeURIComponent(ma)}/dong`, { method: 'POST' }),
    onSuccess: (_d, ma) => {
      void qc.invalidateQueries({ queryKey: ['holdem', 'buoi-do'] });
      void qc.invalidateQueries({ queryKey: ['holdem', 'buoi-do', 'nhom', ma] });
    },
  });
}

export function useNhomBuoiDo(ma: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['holdem', 'buoi-do', 'nhom', ma],
    queryFn: () => api<NhomBuoiDoDTO>(`/holdem/ban/${encodeURIComponent(ma!)}/nhom`),
    enabled: enabled && !!ma,
    staleTime: 30_000,
    retry: false,
  });
}

export function useBan(ma: string | null | undefined, opts?: { poll?: boolean }) {
  return useQuery({
    queryKey: ['holdem', 'ban', ma],
    queryFn: () => api<BanDTO>(`/holdem/ban/${encodeURIComponent(ma!)}`),
    enabled: !!ma,
    // Bảng đội đổi khi bạn bè chốt bàn — hỏi lại thưa (mỗi 20s) khi được yêu cầu.
    refetchInterval: opts?.poll ? 20_000 : false,
    staleTime: 10_000,
  });
}

/** Đường link mời — một chỗ dựng, sảnh và màn kết dùng chung. */
export const linkBan = (ma: string): string =>
  `${typeof window !== 'undefined' ? window.location.origin : ''}/arena/ban/${ma}`;
