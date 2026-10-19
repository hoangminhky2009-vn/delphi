/**
 * CHỈ SỐ GIÁ — HÀM THUẦN (tầng T0). Không I/O, không DB, không `now()`.
 *
 * Một ngân hàng trung ương bắt đầu bằng MỘT PHÉP ĐO, không bằng một cái nút.
 * Đo trước, luật sau, nút bấm cuối cùng — vì luật vặn theo một chỉ số chưa định
 * nghĩa thì chỉ là ngẫu hứng có mã nguồn.
 *
 * ─── ⚠⚠ HAI CHỈ SỐ, VÀ CHỈ MỘT CÁI ĐƯỢC PHÉP LÁI ──────────────────────────
 *
 * `chiSoNiemYet` đo **giá Hệ thống tự treo**. Nó gần như là một cách viết lại
 * chính công cụ `hs_quy_bp` (test đo được độ lệch: dưới ~1%). Nên lái chính sách
 * theo nó là **đặt nhiệt kế cạnh lò sưởi**: vặn công cụ → chỉ số đổi theo →
 * tưởng đã có tác dụng → vặn tiếp. Vòng lặp dương, không phải điều tiết.
 *
 * `chiSoThucHien` đo **giá người chơi thật sự trả** ở chợ và phiên đấu giá. Đó
 * mới là thứ chính sách không tự đặt được, nên mới lái theo được. Hôm nay nó
 * luôn trả `null` — chưa có chợ, chưa có phiên, chưa có một giao dịch nào
 * (A11.2/D62: thiếu mẫu là `null`, KHÔNG phải 0).
 *
 * ⇒ Ràng buộc: `quyetDinhChinhSach` chỉ nhận `chiSoThucHien`. Ngân hàng trung
 *   ương này **không đọc được nhiệt kế của chính nó**, và đó là một tính chất
 *   của KIỂU DỮ LIỆU, không phải một lời dặn.
 */
import { CHO, CHO_BP } from '../../config/cho.js';
import { RO_HANG } from '../../config/chinh_sach.js';
import { giaBanRa, giaSan } from './gia.js';

/** Thang nội bộ để cộng phân số mà chỉ floor một lần ở cuối (cùng nếp `gia.ts`). */
const THANG = 1_000_000n;

/** Các bậc trong rổ — SUY RA từ bảng trọng số, không khai lần thứ hai (D61). */
export const BAC_TRONG_RO: readonly string[] = Object.keys(RO_HANG.TRONG_SO_BP);

/** Tổng trọng số phải đúng 10.000 bp, nếu không thì chỉ số không có gốc so. */
export function tongTrongSoBp(): number {
  return BAC_TRONG_RO.reduce((s, b) => s + RO_HANG.TRONG_SO_BP[b]!, 0);
}

/**
 * Giá KỲ GỐC của một bậc: giá Hệ thống bán ra ở tồn kho tham chiếu, với hệ số
 * quỹ mặc định. Tính ra, không lưu — lưu là mở đường cho một bản sao thứ hai.
 */
export function giaGocRo(bac: string): bigint {
  return giaBanRa(giaSan(bac, RO_HANG.TON_KHO_THAM_CHIEU, CHO.HS_QUY_BP_MAC_DINH));
}

/**
 * Chỉ số giá NIÊM YẾT theo `hs_quy_bp`. 10.000 bp = đúng mức kỳ gốc.
 *
 * ⚠ ĐÂY LÀ SỐ ĐỂ CÔNG BỐ VÀ ĐỂ NGƯỜI CHƠI ĐỌC, KHÔNG PHẢI SỐ ĐỂ LÁI.
 * Xem khối chú thích đầu tệp.
 */
export function chiSoNiemYet(hsQuyBp: number): number | null {
  if (!Number.isInteger(hsQuyBp) || hsQuyBp < 0 || hsQuyBp > CHO_BP) {
    throw new Error(`hệ số quỹ không hợp lệ: ${hsQuyBp}`);
  }
  let tong = 0n;
  for (const bac of BAC_TRONG_RO) {
    const goc = giaGocRo(bac);
    if (goc === 0n) return null;   // kỳ gốc bằng 0 ⇒ không có gốc để so
    const nay = giaBanRa(giaSan(bac, RO_HANG.TON_KHO_THAM_CHIEU, hsQuyBp));
    tong += (BigInt(RO_HANG.TRONG_SO_BP[bac]!) * nay * THANG) / goc;
  }
  return Number(tong / THANG);
}

/**
 * Giá THỰC HIỆN bình quân trong kỳ, theo bậc. `null` ở một bậc = **kỳ này không
 * có giao dịch nào ở bậc đó**, không phải "giá bằng 0".
 */
export interface GiaThucHien {
  readonly theoBac: Readonly<Record<string, bigint | null>>;
}

/**
 * Chỉ số giá THỰC HIỆN — thứ duy nhất được phép lái chính sách.
 *
 * ⚠ THIẾU MỘT BẬC LÀ TRẢ `null` CHO CẢ CHỈ SỐ, không phải bỏ bậc đó rồi chia lại
 * trọng số. Bỏ một bậc là **đổi rổ**, mà rổ đổi thì hai lần đo không so được với
 * nhau nữa — trong khi cả điểm của chỉ số này là so được xuyên thời gian. Một
 * chỉ số "gần đúng" ở đây tệ hơn hẳn một ô trống thành thật.
 */
export function chiSoThucHien(g: GiaThucHien): number | null {
  let tong = 0n;
  for (const bac of BAC_TRONG_RO) {
    const nay = g.theoBac[bac];
    if (nay === undefined || nay === null) return null;
    if (nay < 0n) throw new Error(`giá thực hiện âm ở bậc ${bac}: ${nay}`);
    const goc = giaGocRo(bac);
    if (goc === 0n) return null;
    tong += (BigInt(RO_HANG.TRONG_SO_BP[bac]!) * nay * THANG) / goc;
  }
  return Number(tong / THANG);
}

/** Rổ rỗng — mọi bậc `null`. Đây là trạng thái THẬT của hôm nay: chưa có chợ. */
export function roRong(): GiaThucHien {
  const theoBac: Record<string, bigint | null> = {};
  for (const bac of BAC_TRONG_RO) theoBac[bac] = null;
  return { theoBac };
}

// ────────────── SỨC MUA — cách founder chốt NEO chỉ số (05/09) ──────────────

/**
 * Founder 05/09: *"Ngân hàng neo sức mua cho T."*
 *
 * Neo "chỉ số quanh 100" và neo "sức mua của vốn khởi điểm" là **cùng một phép
 * tính, khác cách nói** — nhưng cách nói quyết định người chơi có hiểu hay
 * không. "Chỉ số 11.800 bp" không ai cảm được; "1.000 T hồi đầu mùa giờ chỉ mua
 * được 85% chừng ấy đồ" thì ai cũng cảm được ngay.
 *
 * Sức mua tính bằng bp: 10.000 = mua được đúng như kỳ gốc. Giá tăng gấp đôi
 * (chỉ số 20.000) ⇒ sức mua 5.000 bp = một nửa.
 *
 * `null` khi chưa đo được, hoặc chỉ số bằng 0 (vô nghiệm — không phải "sức mua
 * vô hạn", mà là "không có giá để so").
 */
export function sucMuaBp(chiSoBp: number | null): number | null {
  if (chiSoBp === null) return null;
  if (!Number.isInteger(chiSoBp) || chiSoBp < 0) {
    throw new Error(`chỉ số không hợp lệ: ${chiSoBp}`);
  }
  if (chiSoBp === 0) return null;
  return Math.floor(10_000 * 10_000 / chiSoBp);
}

/**
 * Rổ gốc bây giờ tốn bao nhiêu T, nếu ở kỳ gốc nó tốn đúng `vonT`.
 * Đây là câu hiện ra cho người chơi, không phải câu để lái chính sách.
 */
export function giaRoT(chiSoBp: number | null, vonT: number): bigint | null {
  if (!Number.isInteger(vonT) || vonT < 0) throw new Error(`vốn không hợp lệ: ${vonT}`);
  if (chiSoBp === null) return null;
  if (!Number.isInteger(chiSoBp) || chiSoBp < 0) {
    throw new Error(`chỉ số không hợp lệ: ${chiSoBp}`);
  }
  return (BigInt(vonT) * BigInt(chiSoBp)) / 10_000n;
}
