/**
 * CẦM CỐ — HÀM THUẦN (tầng T0). Không I/O, không DB, không `now()`.
 *
 * Đọc `config/cam_co.ts` trước: ranh **cầm cố ≠ vay nợ** là cả thiết kế, và nó
 * được canh bằng ba bất biến chứ không bằng cách gọi tên.
 *
 * ⭐ TÍNH CHẤT MẠNH NHẤT CỦA TỆP NÀY LÀ THỨ NÓ KHÔNG CÓ:
 * **không có kiểu dữ liệu nào biểu diễn được một khoản nợ.** Không `du_no`,
 * không `con_phai_tra`, không số dư âm, không hàm nào nhận "số ngày quá hạn" để
 * tính thêm tiền. Một người cầm cố chỉ có đúng hai đường ra — chuộc, hoặc bỏ —
 * và cả hai đều KẾT THÚC quan hệ. Muốn biến nó thành nợ thì phải thêm một kiểu
 * mới ở đây, và lúc đó nó là một quyết định nhìn thấy được, không phải một sự
 * trôi dạt.
 */
import { CAM_CO, CAM_CO_BP } from '../../config/cam_co.js';

function kiemBp(ten: string, bp: number): void {
  if (!Number.isInteger(bp) || bp < 0) throw new Error(`${ten} không hợp lệ: ${bp}`);
}

/**
 * Nhận về bao nhiêu T khi cầm một vật có giá sàn `giaSan`.
 *
 * `giaSan = 0` (cửa mua vào đang đóng, quỹ cạn — D65) ⇒ **0, tức không cầm được**.
 * Đó là trạng thái hợp lệ: Hệ thống không định giá được thì cũng không cho vay
 * được. Caller phải hiện câu đó, không hiện "vật này vô giá trị".
 */
export function soTChoVay(giaSan: bigint, ltvBp: number = CAM_CO.LTV_BP): bigint {
  if (giaSan < 0n) throw new Error(`giá sàn âm: ${giaSan}`);
  kiemBp('ltvBp', ltvBp);
  if (ltvBp >= CAM_CO_BP) {
    // E31 — chặn ngay tại nguồn, không đợi test bắt.
    throw new Error(
      `LTV ${ltvBp} ≥ 10.000: cầm rồi bỏ sẽ tốt hơn bán thẳng, tức mở một cửa bán giá cao hơn cửa bán`,
    );
  }
  return (giaSan * BigInt(ltvBp)) / BigInt(CAM_CO_BP);
}

/**
 * Chuộc lại tốn bao nhiêu. **Số này chốt NGAY LÚC CẦM và không đổi theo thời
 * gian** — nó không nhận tham số ngày, và đó là cố ý (E33): lãi cộng dồn là thứ
 * biến một khoản nhỏ thành một khoản không trả nổi.
 */
export function soTChuocLai(daVay: bigint, phiBp: number = CAM_CO.PHI_CHUOC_BP): bigint {
  if (daVay < 0n) throw new Error(`số đã vay âm: ${daVay}`);
  kiemBp('phiBp', phiBp);
  if (daVay === 0n) return 0n;
  const phi = (daVay * BigInt(phiBp)) / BigInt(CAM_CO_BP);
  // Phí phải là một khoản THẬT: floor ăn mất phí ở số nhỏ thì thanh khoản hoá
  // ra miễn phí, và "miễn phí" là chỗ mọi vòng lặp bắt đầu (cùng bẫy với E7).
  return daVay + (phi > 0n ? phi : 1n);
}

/** Hai đường ra, và chỉ hai. Cả hai đều KẾT THÚC quan hệ. */
export type KetCuc = 'chuoc' | 'bo';

export interface KetQuaCamCo {
  /** T nhận về lúc cầm. */
  nhanVe: bigint;
  /** T phải trả nếu chuộc. Chốt lúc cầm, không đổi. */
  chuocLai: bigint;
  /** Giá thanh khoản: chênh lệch giữa chuộc và nhận. Luôn ≥ 1. */
  phiThanhKhoan: bigint;
  /**
   * Nếu BỎ: coi như đã bán vật với giá này. Luôn THẤP HƠN bán thẳng ở `giaSan`
   * — đó là E31, và là lý do cầm cố không bao giờ thay được cửa bán.
   */
  neuBoCoiNhuBanGia: bigint;
  /** Hạn chuộc, tính bằng ngày kể từ lúc cầm. */
  hanNgay: number;
}

/** Toàn bộ điều khoản của một lượt cầm, tính một lần, hiện hết cho người chơi. */
export function dieuKhoanCamCo(
  giaSan: bigint,
  ltvBp: number = CAM_CO.LTV_BP,
  phiBp: number = CAM_CO.PHI_CHUOC_BP,
): KetQuaCamCo {
  const nhanVe = soTChoVay(giaSan, ltvBp);
  const chuocLai = soTChuocLai(nhanVe, phiBp);
  return {
    nhanVe,
    chuocLai,
    phiThanhKhoan: chuocLai - nhanVe,
    neuBoCoiNhuBanGia: nhanVe,
    hanNgay: CAM_CO.HAN_NGAY,
  };
}

/**
 * ⭐ HAIRCUT LÀ TẤM ĐỆM RỦI RO CỦA HỆ THỐNG — và đây là chỗ dạy được.
 *
 * Hệ thống cho vay `nhanVe` và giữ một vật. Nếu tới hạn người ta bỏ, Hệ thống
 * còn lại vật đó ở giá **hiện tại**. Lỗ khi giá đã rơi sâu hơn phần haircut.
 *
 * Trả về số T Hệ thống lỗ (0 nếu không lỗ). Đây đúng là rủi ro một ngân hàng
 * trung ương nhận khi nhận thế chấp, không phải một lỗi thiết kế.
 */
export function loKhiBiBo(daChoVay: bigint, giaSanBayGio: bigint): bigint {
  if (daChoVay < 0n) throw new Error(`đã cho vay âm: ${daChoVay}`);
  if (giaSanBayGio < 0n) throw new Error(`giá sàn âm: ${giaSanBayGio}`);
  const lo = daChoVay - giaSanBayGio;
  return lo > 0n ? lo : 0n;
}

/**
 * Giá vật được phép rơi bao nhiêu bp mà Hệ thống vẫn hoà — tức chính haircut.
 * Ở LTV 6.000 bp thì giá rơi tới 40% Hệ thống vẫn không lỗ.
 */
export function demRuiRoBp(ltvBp: number = CAM_CO.LTV_BP): number {
  kiemBp('ltvBp', ltvBp);
  if (ltvBp > CAM_CO_BP) throw new Error(`LTV vượt 10.000: ${ltvBp}`);
  return CAM_CO_BP - ltvBp;
}

/**
 * Kho bạc/quỹ cho vay được bao nhiêu lượt với số dư hiện có.
 *
 * ⚠ Đây KHÔNG phải một giới hạn mềm: sổ có `CHECK balance_after >= 0`, nên
 * Hệ thống **không thể** cho vay quá số nó đang giữ. Ngân hàng trung ương này
 * không có dự trữ phân đoạn — nó cho vay từ tiền đã có, đúng như A3.4 buộc.
 */
export function soLuotChoVayToiDa(soDuQuy: bigint, moiLuot: bigint): number | null {
  if (soDuQuy < 0n) throw new Error(`số dư âm: ${soDuQuy}`);
  if (moiLuot < 0n) throw new Error(`mỗi lượt âm: ${moiLuot}`);
  if (moiLuot === 0n) return null;   // vô nghiệm, không phải "vô hạn" (A11.2)
  return Number(soDuQuy / moiLuot);
}
