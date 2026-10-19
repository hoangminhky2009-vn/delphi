/**
 * BÁCH KHOA — kiểu dữ liệu của một mục (D334).
 *
 * ─── HAI TẦNG CHỮ, MỘT LUẬT CHO CON SỐ ───────────────────────────────────────────
 * · Tầng NGOÀI ĐỜI (`ngoai` · `viDu` · `chuoi` · `nhung` · `chuyen` · vế `doi`) là chữ của bách khoa,
 *   được mang số liệu NGOÀI ĐỜI (năm, lãi suất Ngân hàng Nhà nước, VN-Index…) — đã kiểm nguồn 14/09.
 * · Tầng TRÊN BÀN (vế `ban` · bảng `so`) KHÔNG được gõ một chữ số nào của luật chơi. Số luật đi qua
 *   `%{đường.dẫn:định_dạng}` và đọc từ catalog của server lúc vẽ; mức phản ứng đi qua `muc`; luật của
 *   thẻ tin đi qua `luatThe`. Thiếu dữ liệu thì dòng đó ẨN, không bao giờ đoán số (D62).
 *   Lý do: mọi số ở `config/` là MC-TUNE — chép tay vào chữ là màn niêm yết một đằng, engine chạy một
 *   nẻo (A11.5). Bài canh: `web/tests/bach_khoa.test.tsx` §II.
 * · Cú pháp `{id|chữ}` trong mọi chuỗi = từ khoá chạm được, mở mục `id`.
 */
import type { KhoanhKhacId } from '@server/holdem/khoanh_khac_ids';

export type NhomId = 'vai' | 'ma' | 'ct' | 'the' | 'gia' | 'nhip' | 'lai' | 'rui' | 'hv';

export const NHOM_BACH_KHOA: readonly (readonly [NhomId, string])[] = [
  ['vai', 'VAI'], ['ma', 'SÁU MÃ'], ['ct', 'LÕI CHIẾN THUẬT'], ['the', 'THẺ TIN'],
  ['gia', 'GIÁ & LỆNH'], ['nhip', 'NHỊP CHỢ'], ['lai', 'LÃI SUẤT & TIỀN'], ['rui', 'RỦI RO'], ['hv', 'HÀNH VI'],
];

/** Một chuỗi "vì sao": các bước nối nhau, bước cuối là hệ quả. */
export interface ChuoiBK {
  ten: string;
  buoc: readonly string[];
  ket: string;
  /** Chỉ khi hệ quả là tăng/giảm GIÁ — mới được tô xanh/đỏ (luật màu). */
  huong?: 'len' | 'xuong';
}

/** Một chuyện thật đã xảy ra. `so`: [nhãn, giá trị, chiều] — chiều rỗng thì không tô màu. */
export interface ChuyenBK {
  nam: string;
  noi: string;
  cau: string;
  so?: readonly (readonly [string, string, '' | 'len' | 'xuong'])[];
}

/** Mức phản ứng lấy từ `tu_dien` của catalog — vẽ thành chip, không in bằng chữ. */
export type MucRef =
  | { loai: 'ma_sk'; ma: string; sk: readonly string[] }
  | { loai: 'ma_gd'; ma: string; gd: readonly string[] }
  | { loai: 'sk_ma'; sk: string; ma: readonly string[] };

/** Một cặp ĐỜI → BÀN. */
export interface CapBK {
  /** Đặc điểm ngoài đời — lý do của luật. */
  doi: string;
  /** Luật trên bàn bằng chữ. ⚠ Không chữ số — số đi qua `%{…}`. */
  ban?: string;
  muc?: MucRef;
  /** Vế bàn dựng từ luật của thẻ tin (`bach_khoa.the_tin` của mục có `suKien`). */
  luatThe?: 'bao_truoc' | 'keo_theo' | 'do_gia' | 'tinh_chat';
  /** `luat` — luật thuần trò chơi (vế đời là lý do cân bằng) · `gon` — chỗ bàn gọn hơn đời. */
  loai?: 'luat' | 'gon';
}

export interface MucBK {
  id: string;
  nhom: NhomId;
  ten: string;
  anh: string;
  /** Tên lưới — ở `LUOI_BACH_KHOA` hoặc `PixelIcon`. */
  icon: string;
  /** Một câu: nhỏ trên ô danh sách, TO ở đầu mục. */
  nhac: string;
  ngoai: string;
  viDu?: string;
  chuoi?: ChuoiBK | readonly ChuoiBK[];
  nhung?: string;
  chuyen?: readonly ChuyenBK[];
  doiBan: readonly CapBK[];
  /** [nhãn, giá trị] — giá trị chỉ được chứa `%{…}` cho số của luật. */
  so?: readonly (readonly [string, string])[];
  lq: readonly string[];
  khung: string;
  /** Mã tài sản phía server (btc · cp_cn · vn30 · vang · usd · tpcp). */
  ma?: string;
  /** Mặt sự kiện phía server. */
  suKien?: string;
  /** Vai phía server. */
  vai?: string;
  /** Khái niệm của sổ tay — lớp "bạn đã gặp" đọc từ `/holdem/me/so-tay`. */
  khoanhKhac?: KhoanhKhacId;
}
