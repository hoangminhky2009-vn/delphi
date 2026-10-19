/**
 * DẤU MỐC KỸ NĂNG (doc 06 §5.1, founder chốt D85 "cả hai"; thi công 17/08).
 *
 * Ghi nhận VỀ SAU, không kê trước: *"độ chuẩn của bạn đang lên"*, *"3 vòng liền
 * đọc đúng hướng"*, *"cắt lỗ trước cú sập"*. Vì không có danh sách trước nên nó
 * **không thể lái hành vi** — đó là toàn bộ lý do nó tồn tại song song với kỳ ngộ
 * (§1), và cũng là lý do nó KHÔNG được biến thành nhiệm vụ.
 *
 * ⚠ LẰN RANH §1.2 (giữ nguyên): khen KỸ NĂNG (độ chuẩn, đọc đúng hướng, cắt lỗ
 * đúng lúc), TUYỆT ĐỐI không khen TƯ THẾ RỦI RO (đếm all-in, đếm mã đang giữ,
 * đếm tiền mặt) — ba trục đó là thứ app đang ĐO, khen chúng là làm bẩn số đo.
 * ⚠ HỒI CỐ, KHÔNG KÊ ĐƠN (A10): server chỉ trả ID + SỐ; câu chữ ở client, và có
 * test quét từ kê đơn như D89.
 * ⚠ Hàm THUẦN trên dữ liệu ĐÃ CÓ (`hd_brier_vong` + dây chuyền `hd_chot_phien`)
 * — không event mới, không migration: một dấu mốc là hàm tất định của lịch sử,
 * nên chạy lại trên dữ liệu cũ vẫn ra đúng nó.
 */

export type DauMocId =
  /** Brier trung bình nửa sau tốt hơn nửa đầu (trong CHÍNH trận này). */
  | 'do_chuan_len'
  /** ≥3 vòng LIỀN đọc đúng hướng (vòng có vị thế và lãi). */
  | 'chuoi_dung_huong'
  /** Giảm phơi nhiễm ngay trước một vòng sập mạnh. */
  | 'cat_truoc_sap'
  /** Brier trung bình cả trận tốt hơn mọi trận trước đó. */
  | 'chuan_nhat_tu_truoc';

export interface DauMoc {
  id: DauMocId;
  /** Vòng gắn với dấu mốc (0 = cả trận). */
  vong: number;
  /** Số kèm theo — ý nghĩa tuỳ id: điểm Brier ×10000, số vòng, hay bp. */
  so: number;
}

export interface VongDauMoc {
  vong: number;
  /** Brier vòng (0–2), null = vòng không dự báo (toàn tiền mặt) — D67. */
  brier: number | null;
  /** Lãi/lỗ NAV của vòng, bp. */
  pnl_bp: number | null;
  /** Tỷ lệ vốn đang phơi nhiễm cuối vòng (bp của NAV). */
  phoi_nhiem_bp: number | null;
  /**
   * ⚠ CHỢ đổi bao nhiêu ở vòng này (bp) — đo bằng NAV TRUNG VỊ CẢ BÀN, KHÔNG
   * bằng NAV của mình. Đây là chỗ dễ sai nhất của mốc "cắt trước cú sập": nếu
   * đo NAV mình thì người CẮT KỊP không bao giờ đạt mốc (chính vì cắt kịp nên
   * NAV họ không sập), tức mốc sẽ chỉ khen người ĐANG ĂN ĐÒN. Đo đã bắt được
   * đúng cú đó trên stack 17/08.
   */
  cho_bp: number | null;
}

/** Trung bình, null nếu không có mẫu. */
function tb(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Nhặt dấu mốc của MỘT trận.
 * @param vongs   từng vòng của chính người chơi, thứ tự tăng dần.
 * @param brierTranTruoc Brier trung bình các trận TRƯỚC (để biết "chuẩn nhất từ
 *   trước tới nay"); rỗng ⇒ không xét mốc đó (trận đầu không có gì để so).
 */
export function dauMocCuaTran(
  vongs: readonly VongDauMoc[], brierTranTruoc: readonly number[] = [],
): DauMoc[] {
  const ra: DauMoc[] = [];
  const coBrier = vongs.filter((v) => v.brier !== null) as (VongDauMoc & { brier: number })[];

  // 1. ĐỘ CHUẨN ĐANG LÊN — nửa sau tốt hơn nửa đầu (Brier THẤP là tốt).
  if (coBrier.length >= 4) {
    const nua = Math.floor(coBrier.length / 2);
    const dau = tb(coBrier.slice(0, nua).map((v) => v.brier));
    const sau = tb(coBrier.slice(nua).map((v) => v.brier));
    if (dau !== null && sau !== null && sau < dau - NGUONG.DO_CHUAN_LEN) {
      ra.push({ id: 'do_chuan_len', vong: 0, so: Math.round((dau - sau) * 10000) });
    }
  }

  // 2. CHUỖI ĐỌC ĐÚNG HƯỚNG — ≥3 vòng LIỀN có vị thế và lãi.
  let chuoi = 0; let dai = 0; let ketThuc = 0;
  for (const v of vongs) {
    const dung = (v.phoi_nhiem_bp ?? 0) > 0 && (v.pnl_bp ?? 0) > 0;
    chuoi = dung ? chuoi + 1 : 0;
    if (chuoi > dai) { dai = chuoi; ketThuc = v.vong; }
  }
  if (dai >= NGUONG.CHUOI_TOI_THIEU) ra.push({ id: 'chuoi_dung_huong', vong: ketThuc, so: dai });

  // 3. CẮT TRƯỚC CÚ SẬP — vòng N hạ phơi nhiễm mạnh, vòng N+1 là vòng sập nặng.
  for (let i = 1; i < vongs.length; i++) {
    const truoc = vongs[i - 1]!; const nay = vongs[i]!;
    const ha = (truoc.phoi_nhiem_bp ?? 0) - (nay.phoi_nhiem_bp ?? 0);
    if (ha >= NGUONG.HA_PHOI_NHIEM_BP && (nay.cho_bp ?? 0) <= -NGUONG.SAP_BP) {
      ra.push({ id: 'cat_truoc_sap', vong: nay.vong, so: Math.abs(nay.cho_bp ?? 0) });
      break;
    }
  }

  // 4. CHUẨN NHẤT TỪ TRƯỚC TỚI NAY — chỉ khi đã có ≥2 trận trước để so.
  const tbTran = tb(coBrier.map((v) => v.brier));
  if (tbTran !== null && brierTranTruoc.length >= NGUONG.TRAN_TOI_THIEU_DE_SO
      && tbTran < Math.min(...brierTranTruoc)) {
    ra.push({ id: 'chuan_nhat_tu_truoc', vong: 0, so: Math.round(tbTran * 10000) });
  }

  return ra.slice(0, 2);   // tối đa 2 — nhiều hơn thì màn kết thành bảng thành tích
}

/**
 * Ngưỡng — PLAYTEST-TUNE, một chỗ. Đặt cao hơn nhiễu để dấu mốc còn nghĩa: một
 * lời khen phát mỗi trận là một lời khen không ai đọc.
 */
export const NGUONG = {
  /** Chênh Brier tối thiểu giữa nửa sau và nửa đầu (thang 0–2). */
  DO_CHUAN_LEN: 0.08,
  /** Số vòng liền tối thiểu của chuỗi đọc đúng hướng. */
  CHUOI_TOI_THIEU: 3,
  /** Hạ phơi nhiễm tối thiểu để tính là "cắt" (bp của NAV). */
  HA_PHOI_NHIEM_BP: 2000,
  /** Vòng sau phải sập ít nhất ngần này (bp) mới gọi là "cú sập". */
  SAP_BP: 500,
  /** Cần ngần này trận trước mới nói "chuẩn nhất từ trước tới nay". */
  TRAN_TOI_THIEU_DE_SO: 2,
} as const;
