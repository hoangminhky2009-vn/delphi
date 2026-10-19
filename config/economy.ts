/**
 * DELPHI — Tham số kinh tế (nguồn chân lý duy nhất, theo CLAUDE.md mục A4).
 *
 * CẤM sửa giá trị ở đây nếu founder chưa duyệt và chưa cập nhật CLAUDE.md.
 * Mọi code nghiệp vụ PHẢI import từ file này — không magic number.
 *
 * Lưu ý C5 (token là INTEGER, cấm float trong tính toán tiền tệ):
 * các tỷ lệ % được biểu diễn bằng BASIS POINTS (phần vạn, 1% = 100 bp)
 * để mọi phép tính là số nguyên: floor(x * bp / 10_000).
 */

/** Mẫu số chung cho basis points: 100% = 10_000 bp. */
export const BP_DENOMINATOR = 10_000;

export const ECONOMY = {
  /** Vốn khởi điểm mỗi user (T). */
  STARTING_BANKROLL: 1_000,

  /** Rake đốt vĩnh viễn: 3% tổng pool = 300 bp. */
  RAKE_BURN_BP: 300,

  /** Rake vào Kho bạc: 2% tổng pool = 200 bp. */
  RAKE_TREASURY_BP: 200,

  /** Trần tổng cược 1 user trên 1 kèo: 20% = 2000 bp (định nghĩa chuẩn A5.3). */
  BET_CAP_BP: 2_000,

  /** Mức cược tối thiểu (T). */
  MIN_BET: 1,

  /** Dưới ngưỡng này (T) mới được nhận trợ cấp ngày. */
  SUBSIDY_THRESHOLD: 500,

  /** Mức trợ cấp mỗi ngày (T), chi từ Kho bạc — không bao giờ mint. */
  SUBSIDY_AMOUNT: 50,

  /** Trần trợ cấp mỗi user mỗi tháng (T). */
  SUBSIDY_MONTHLY_CAP: 1_000,

  /** Dưới N kèo đã resolve trong 1 pool → Unranked ở pool đó. */
  UNRANKED_THRESHOLD: 5,

  /** Quá N ngày sau hạn mà nguồn không công bố → tự hủy kèo, hoàn 100%. */
  RESOLUTION_TIMEOUT_DAYS: 7,

  /** Tuổi tối thiểu (config — luật sư có thể yêu cầu nâng 18). */
  AGE_GATE_MIN: 16,

  /** Độ dài mùa (tháng). v0.1 chưa chạy reset mùa, chỉ lưu season_id. */
  SEASON_LENGTH_MONTHS: 3,

  /**
   * D10 (17/07/2026): vốn hóa Kho bạc MỘT LẦN khi khởi tạo hệ thống (số T
   * tuyệt đối, không phải bp). Bút toán genesis_grant duy nhất mỗi môi trường;
   * sau genesis, Kho bạc không bao giờ âm (CHECK tầng DB).
   */
  TREASURY_GENESIS: 20_000,
} as const;

/**
 * RESET MÙA — ba bước của D16 mục 4 (founder đã duyệt 17/07/2026).
 *
 * ⚠ CHÉP TỪ D16, KHÔNG PHẢI SỐ MỚI (A8.2). Ba con số này đã chốt từ 17/07 và
 * tới nay chỉ sống trong `docs/khao-co/design_economy_unified.md` §4 +
 * `docs/dac-ta/05-kinh-te-token.md` §B; `server/season.ts` mới chỉ có hàm tính
 * `season_id`, chưa có code reset. Đưa vào đây để `economy_sim` khỏi phải nhúng
 * magic number — A4 đòi tham số kinh tế nằm ở MỘT file duy nhất.
 *
 * ⚠⚠ CÓ HẰNG SỐ Ở ĐÂY KHÔNG CÓ NGHĨA LÀ RESET MÙA ĐÃ CHẠY. Chưa có đường code
 * nào gọi tới, và **không được viết đường đó khi Kho bạc chưa có nguồn thu**
 * (D246 §10.2: rake ≈ 0 từ D86 ⇒ chu kỳ mùa ra số âm).
 */
export const MUA = {
  /** Bước 1 — NÉN: ví > mốc này mới bị nén; phần nén chảy về Kho bạc. */
  NEN_MOC: 1_000,
  /** Bước 1 — hệ số: `NEN_MOC + isqrt(ví − NEN_MOC) × NEN_HE_SO`. */
  NEN_HE_SO: 10,
  /** Bước 2 — SÀN: ví dưới mức này được kéo lên, chi từ Kho bạc. */
  SAN: 700,
  /** Bước 3 — TIER BONUS theo RANK CƯỢC (không theo tài sản). D16 chốt 80/50/25. */
  BONUS_VANG: 80,
  BONUS_BAC: 50,
  BONUS_DONG: 25,
} as const;

/**
 * Tham số công thức rank per-pool (A5.4) — có version để rank_snapshots
 * ghi lại formula_version tương ứng.
 */
export const RANK_FORMULA = {
  VERSION: 'brier-decay-v1',
  /** Trọng số giảm dần 0,9^n theo thứ tự kèo mới → cũ (biểu diễn bp: 9000/10000). */
  RECENCY_DECAY_BP: 9_000,
} as const;

/** Tính floor(amount × bp / 10_000) bằng số học nguyên thuần (an toàn C5). */
export function applyBp(amount: bigint, bp: number): bigint {
  if (!Number.isInteger(bp) || bp < 0 || bp > BP_DENOMINATOR) {
    throw new Error(`bp không hợp lệ: ${bp}`);
  }
  if (amount < 0n) {
    throw new Error(`amount âm: ${amount}`);
  }
  return (amount * BigInt(bp)) / BigInt(BP_DENOMINATOR); // BigInt chia = floor với số không âm
}
