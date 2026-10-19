/**
 * ĐỊNH GIÁ CHỢ — HÀM THUẦN (tầng T0, bước B6). Không I/O, không DB, không `now()`.
 *
 * Cả cửa giao dịch (T3) lẫn phiên đấu giá (T4) đều PHẢI gọi vào đây thay vì tự
 * tính. Một công thức giá viết lần thứ hai trong một route là ca D61/A11.5 đang
 * xảy ra, và bản thứ hai sẽ trôi im lặng.
 *
 * `economy_sim` cũng gọi chính những hàm này — đó là toàn bộ lý do tầng T0 phải
 * sạch I/O: sim và đường chạy thật không được phép là hai cài đặt.
 *
 * ⚠ B6 KHÔNG NỐI VÀO CỬA NÀO. Có hàm giá không có nghĩa là chợ đã mở (B7).
 */
import { CHO, CHO_BP, GACHA_EV, PHI } from '../../config/cho.js';

// ─────────────────────────────── giá AMM ──────────────────────────────────

/**
 * Giá Hệ thống MUA VÀO. `0` = **cửa mua vào đang đóng** (quỹ cạn), và đó là một
 * trạng thái hợp lệ có nghĩa: "Hệ thống hiện không mua" — KHÔNG phải "món này
 * vô giá trị". Caller phải phân biệt hai câu đó khi hiện ra cho người chơi.
 */
export function giaSan(bac: string, tonKhoHeThong: number, hsQuyBp: number): bigint {
  const goc = CHO.GIA_GOC[bac];
  if (goc === undefined) throw new Error(`bậc không có trong bảng giá: ${bac}`);
  if (!Number.isInteger(tonKhoHeThong) || tonKhoHeThong < 0) {
    throw new Error(`tồn kho không hợp lệ: ${tonKhoHeThong}`);
  }
  if (!Number.isInteger(hsQuyBp) || hsQuyBp < 0 || hsQuyBp > CHO_BP) {
    throw new Error(`hệ số quỹ không hợp lệ: ${hsQuyBp}`);
  }
  const bang = CHO.HS_TON_KHO_BP;
  // Tồn kho vượt bảng thì dùng bậc cuối — đây là bậc thang giá, kẹp ở đây KHÔNG
  // tạo ra nguồn cung vô hạn (khác hẳn ca vé ở §7.11.2), nó chỉ là sàn của một
  // hệ số nhân. Ghi ra để không ai áp nhầm bài học của bên kia sang bên này.
  const hsTon = bang[Math.min(tonKhoHeThong, bang.length - 1)]!;
  // Nhân TRƯỚC, chia SAU, floor một lần — đúng thủ tục A5.1.
  return (BigInt(goc) * BigInt(hsTon) * BigInt(hsQuyBp))
    / (BigInt(CHO_BP) * BigInt(CHO_BP));
}

/**
 * Giá Hệ thống BÁN RA.
 *
 * ⚠⚠ CHỖ NÀY CÓ MỘT CÁI BẪY SỐ NGUYÊN, VÀ NÓ LÀ LÝ DO B6 TỒN TẠI TRƯỚC B7.
 * Công thức trong thiết kế là `floor(gia_san × (10.000 + SPREAD) / 10.000)`.
 * Với `gia_san = 1` và spread 2.000 bp: `floor(1 × 1,2) = 1` ⇒ **giá bán ra
 * BẰNG giá mua vào**, tức bất biến `gia_san < gia_ban_ra` gãy, tức tồn tại một
 * chuỗi mua–bán với Hệ thống KHÔNG LỖ. Ở giá nhỏ thì spread bị floor nuốt sạch.
 *
 * Vá: bán ra luôn ít nhất **hơn một đơn vị**. Một T chênh lệch nghe như không có
 * gì, nhưng nó là khác biệt giữa "có vòng lặp hoà vốn" và "không có".
 */
export function giaBanRa(gia_san: bigint): bigint {
  if (gia_san < 0n) throw new Error(`giá sàn âm: ${gia_san}`);
  if (gia_san === 0n) return 0n; // cửa đóng thì đóng cả hai chiều
  const theoSpread = (gia_san * BigInt(CHO_BP + CHO.SPREAD_BP)) / BigInt(CHO_BP);
  const toiThieu = gia_san + 1n;
  return theoSpread > toiThieu ? theoSpread : toiThieu;
}

// ──────────────────────────────── phí ─────────────────────────────────────

export interface ChiaPhi {
  dot: bigint;
  khoBac: bigint;
  /** Phần còn lại về quỹ chợ. Ba số này CỘNG LẠI đúng bằng `tong`, không dư. */
  quyCho: bigint;
}

/**
 * Chia một khoản thu thành đốt / Kho bạc / quỹ chợ theo khuôn rake 3%+2%.
 *
 * Phần dư do floor về **quỹ chợ**, không đốt thêm. Khác parimutuel (residual ĐỐT,
 * A5.1) là có chủ ý: ở kèo, residual là tiền của một pool đã đóng nên không có
 * chủ; ở đây nó là tiền Hệ thống vừa thu, và Hệ thống có sổ để giữ nó.
 */
export function chiaPhi(tong: bigint): ChiaPhi {
  if (tong < 0n) throw new Error(`khoản thu âm: ${tong}`);
  const dot = (tong * BigInt(PHI.DOT_BP)) / BigInt(CHO_BP);
  const khoBac = (tong * BigInt(PHI.KHO_BAC_BP)) / BigInt(CHO_BP);
  return { dot, khoBac, quyCho: tong - dot - khoBac };
}

// ─────────────────────────── bậc thang vé ─────────────────────────────────

/**
 * Giá vé theo số vé đã bán CHO CHÍNH PHIÊN ĐÓ.
 *
 * ⚠ Trả `null` khi `daBan` chạm hết bảng — **HẾT VÉ, không phải "giá cao nhất"**.
 * Đây đúng là chỗ founder bác bản đầu (D246 §7.11.2): kẹp `min()` ở bậc cuối
 * biến trần thành một mức giá phẳng với nguồn cung vô hạn, tức xoá sạch khan
 * hiếm. Kiểu trả về `bigint | null` khiến cái sai đó không viết ra được.
 */
export function giaVe(bang: readonly number[], daBan: number): bigint | null {
  if (!Number.isInteger(daBan) || daBan < 0) throw new Error(`đã bán không hợp lệ: ${daBan}`);
  const g = bang[daBan];
  return g === undefined ? null : BigInt(g);
}

/**
 * Bán lại vé cho Hệ thống.
 *
 * ⚠⚠ HAI VẾ, THIẾU MỘT LÀ CÓ MÁY IN TIỀN (E19, D246 §7.11.4): bán lại phải
 * **GIẢM `n`**, và giá phải đọc **SAU khi giảm**. Hàm này nhận `daBanSauKhiTra`
 * — tức caller đã trừ — nên thứ tự đó nằm trong chữ ký, không nằm trong lời dặn.
 */
export function giaBanLaiVe(bang: readonly number[], daBanSauKhiTra: number): bigint {
  if (!Number.isInteger(daBanSauKhiTra) || daBanSauKhiTra < 0) {
    throw new Error(`đã bán không hợp lệ: ${daBanSauKhiTra}`);
  }
  const bacHienTai = bang[Math.min(daBanSauKhiTra, bang.length - 1)]!;
  return (BigInt(bacHienTai) * BigInt(CHO.VE_BAN_LAI_BP)) / BigInt(CHO_BP);
}

// ───────────────────────── kỳ vọng gacha (giáo cụ) ────────────────────────

/** Thang nội bộ cho phép luỹ thừa — đủ lớn để trôi do floor không tới 1 centi-lượt. */
const THANG = 1_000_000_000n;

/**
 * Kỳ vọng SỐ LƯỢT để ra một epic, có pity. Trả về **centi-lượt** (×100) để giữ
 * số nguyên (C5) mà vẫn đọc được hai chữ số thập phân.
 *
 * `E = Σ_{k=0}^{pity−1} (1−p)^k`. Đây KHÔNG phải đường tiền — nó là **giáo cụ**:
 * app công bố thẳng phép tính này để người chơi tự thấy "quay tiếp" đắt hơn mua
 * thẳng bao nhiêu (A10 — mô tả được, kê đơn không: nói kỳ vọng là mô tả, nói
 * "đừng quay nữa" là kê đơn).
 */
export function evCentiLuotDenEpic(
  rateEpicBp: number = GACHA_EV.RATE_EPIC_BP, pity: number = GACHA_EV.PITY,
): number {
  if (!Number.isInteger(rateEpicBp) || rateEpicBp <= 0 || rateEpicBp > CHO_BP) {
    throw new Error(`rate epic không hợp lệ: ${rateEpicBp}`);
  }
  if (!Number.isInteger(pity) || pity <= 0) throw new Error(`pity không hợp lệ: ${pity}`);
  const q = BigInt(CHO_BP - rateEpicBp);
  let so_hang = THANG;
  let tong = 0n;
  for (let k = 0; k < pity; k += 1) {
    tong += so_hang;
    so_hang = (so_hang * q) / BigInt(CHO_BP);
  }
  return Number((tong * 100n) / THANG);
}

/** Kỳ vọng T phải đốt để ra một epic BẤT KỲ. `giaLuot` = `GACHA.COST_T`. */
export function evTDenEpic(giaLuot: number, centiLuot = evCentiLuotDenEpic()): bigint {
  if (!Number.isInteger(giaLuot) || giaLuot <= 0) throw new Error(`giá lượt: ${giaLuot}`);
  return (BigInt(centiLuot) * BigInt(giaLuot)) / 100n;
}

/**
 * Kỳ vọng T để ra ĐÚNG MỘT epic cụ thể khi bể có `k` mẫu epic — con số làm chợ
 * thứ cấp có lý do tồn tại: mua thẳng ở sàn rẻ hơn săn.
 */
export function evTDenEpicCuThe(giaLuot: number, soMauEpic: number): bigint {
  if (!Number.isInteger(soMauEpic) || soMauEpic <= 0) {
    throw new Error(`số mẫu epic: ${soMauEpic}`);
  }
  return evTDenEpic(giaLuot) * BigInt(soMauEpic);
}
