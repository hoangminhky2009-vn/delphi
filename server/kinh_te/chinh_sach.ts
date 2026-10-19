/**
 * LUẬT CHÍNH SÁCH TIỀN TỆ — HÀM THUẦN (tầng T0). Không I/O, không `now()`.
 *
 * ─── ⭐ NGÂN HÀNG TRUNG ƯƠNG NÀY LÀ MỘT LUẬT, KHÔNG PHẢI MỘT NGƯỜI ─────────
 *
 * Founder đã bác admin nằm trên đường đi của một phiên đấu giá (05/09: *"Đấu giá
 * thì liên quan gì đến admin?"*). Lý do đó áp nguyên vào đây, và mạnh hơn: một
 * nhà điều tiết bấm tay từng lần là một nhà điều tiết **không tái lập được**,
 * không replay được, không kiểm toán được — và người chơi sẽ đánh cược vào tâm
 * trạng của người bấm thay vì vào thị trường.
 *
 * Nên chính sách ở đây là `f(số đo) → công cụ`, tất định, có phiên bản. Đổi
 * chính sách = đổi `CHINH_SACH_VERSION` và ghi nhật ký, đúng khuôn
 * `balance_version` (A11.3). Admin đổi được LUẬT, không đổi được một lần chạy.
 *
 * ─── HAI TÍNH CHẤT DO KIỂU DỮ LIỆU BẢO ĐẢM, KHÔNG DO LỜI DẶN ───────────────
 *
 *  1. **Không mint được.** `QuyetDinhChinhSach` không có một trường `bigint`
 *     nào — nó chỉ trả về THAM SỐ GIÁ. Quyết định chính sách vì thế không có
 *     hình dạng để chở một khoản T. A3.4 được canh bằng kiểu, và có test khẳng
 *     định đúng điều đó tại chạy.
 *  2. **Không tự đọc nhiệt kế của mình.** Đầu vào là `chiSoThucHienBp` — giá
 *     người chơi thật sự trả. Chỉ số NIÊM YẾT (thứ gần như là cách viết lại
 *     chính công cụ, lệch dưới 2%) không có đường nào vào hàm này.
 */
import { CHINH_SACH, CHINH_SACH_VERSION } from '../../config/chinh_sach.js';

const BP = 10_000;

export interface SoDoChinhSach {
  /** Chỉ số giá THỰC HIỆN (bp). `null` = chưa đo được ⇒ tuyệt đối không đổi gì. */
  readonly chiSoThucHienBp: number | null;
  /** Công cụ `hs_quy_bp` đang đặt ở đâu. */
  readonly hsQuyBpHienTai: number;
}

export type MaLyDo =
  | 'chua_do_duoc'      // không có số ⇒ đứng yên (fail-closed)
  | 'trong_bien_do'     // lệch nhỏ hơn biên ⇒ đứng yên, không rung
  | 'khong_du_de_doi'   // ra biên nhưng bước làm tròn về 0
  | 'that_chat'         // giá thực hiện CAO hơn mục tiêu ⇒ bơm ít T ra hơn
  | 'noi_long'          // giá thực hiện THẤP hơn mục tiêu ⇒ bơm nhiều T ra hơn
  | 'cham_tran'         // muốn nới thêm nhưng đã kịch trần công cụ
  | 'cham_san';         // muốn thắt thêm nhưng đã kịch sàn công cụ

/**
 * ⚠ KHÔNG CÓ TRƯỜNG `bigint` NÀO Ở ĐÂY, VÀ ĐÓ LÀ CỐ Ý (xem đầu tệp).
 * Thêm một trường tiền vào đây là mở đường cho chính sách tự chi — nếu ai đó
 * cần làm thế, phải sửa kiểu này trước, và test sẽ đỏ ngay lúc đó.
 */
export interface QuyetDinhChinhSach {
  readonly version: string;
  readonly hsQuyBpMoi: number;
  readonly doi: boolean;
  readonly lyDoMa: MaLyDo;
  /** Chỉ số thực hiện − mục tiêu. `null` khi chưa đo được. */
  readonly lechBp: number | null;
}

function kep(v: number, san: number, tran: number): number {
  return Math.max(san, Math.min(tran, v));
}

/**
 * Một kỳ chính sách. Tất định: cùng số đo ⇒ cùng quyết định, mọi lúc.
 *
 * Chiều tác động (đọc kỹ, rất dễ lộn): `hs_quy_bp` nhân vào giá Hệ thống MUA
 * VÀO. Hệ số cao ⇒ Hệ thống trả nhiều hơn khi mua ⇒ **bơm T ra** ⇒ nới lỏng.
 * Nên giá thực hiện cao hơn mục tiêu (lạm phát) ⇒ **hạ** hệ số.
 */
export function quyetDinhChinhSach(s: SoDoChinhSach): QuyetDinhChinhSach {
  const { HS_QUY_SAN_BP: SAN, HS_QUY_TRAN_BP: TRAN } = CHINH_SACH;
  if (!Number.isInteger(s.hsQuyBpHienTai) || s.hsQuyBpHienTai < 0 || s.hsQuyBpHienTai > BP) {
    throw new Error(`hệ số quỹ hiện tại không hợp lệ: ${s.hsQuyBpHienTai}`);
  }
  if (SAN > TRAN) throw new Error(`sàn ${SAN} > trần ${TRAN} — cấu hình vô nghĩa`);

  // Công cụ luôn được kéo về trong khoảng hợp lệ, kể cả khi đứng yên: một giá
  // trị ngoài khoảng là cấu hình hỏng, không phải một trạng thái để giữ nguyên.
  const nen = kep(s.hsQuyBpHienTai, SAN, TRAN);
  const dung = (lyDoMa: MaLyDo, lechBp: number | null): QuyetDinhChinhSach => ({
    version: CHINH_SACH_VERSION, hsQuyBpMoi: nen, doi: nen !== s.hsQuyBpHienTai, lyDoMa, lechBp,
  });

  if (s.chiSoThucHienBp === null) return dung('chua_do_duoc', null);
  if (!Number.isInteger(s.chiSoThucHienBp) || s.chiSoThucHienBp < 0) {
    throw new Error(`chỉ số thực hiện không hợp lệ: ${s.chiSoThucHienBp}`);
  }

  const lech = s.chiSoThucHienBp - CHINH_SACH.MUC_TIEU_BP;
  if (Math.abs(lech) <= CHINH_SACH.BIEN_DO_BP) return dung('trong_bien_do', lech);

  const buocThoc = Math.floor(Math.abs(lech) * CHINH_SACH.HE_SO_PHAN_UNG_BP / BP);
  const buoc = Math.min(buocThoc, CHINH_SACH.BUOC_TOI_DA_BP);
  if (buoc === 0) return dung('khong_du_de_doi', lech);

  const chuaKep = lech > 0 ? nen - buoc : nen + buoc;
  const moi = kep(chuaKep, SAN, TRAN);
  const biKep = moi !== chuaKep;
  const lyDoMa: MaLyDo = biKep
    ? (lech > 0 ? 'cham_san' : 'cham_tran')
    : (lech > 0 ? 'that_chat' : 'noi_long');

  return {
    version: CHINH_SACH_VERSION,
    hsQuyBpMoi: moi,
    doi: moi !== s.hsQuyBpHienTai,
    lyDoMa,
    lechBp: lech,
  };
}
