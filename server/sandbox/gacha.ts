/**
 * Sandbox — GACHA ENGINE, HÀM THUẦN (GĐ4.5 scaffold, Prompt B VIỆC 7).
 *
 * ⚠ CHƯA CÓ ROUTE NÀO GỌI FILE NÀY. Flag GACHA = false. Viết trước + test
 * trước để lúc bật ở v0.3 không phải vừa code vừa cân luật giữa mùa.
 *
 * ─── LUẬT (D16 mục 3, founder chốt 19/07) ──────────────────────────────────
 *   * Gacha CHỈ nhận token T, đốt 100% (không vào Kho bạc, không hoàn).
 *   * Rate công khai 70 thường / 25 hiếm / 5 epic.
 *   * Pity: epic ĐẢM BẢO trong 20 lượt.
 *   * CHẶN quay khi bankroll ≤ 500 T — người sắp kiệt quệ không được tự hủy.
 *   * Chỉ rơi COSMETIC. Không rơi thứ ảnh hưởng sức mạnh (mastery là merit,
 *     không bán). Đây là ranh giới pháp lý, không phải lựa chọn thẩm mỹ.
 *
 * ─── VÌ SAO Q KHÔNG BAO GIỜ ĐƯỢC QUAY ──────────────────────────────────────
 *   Q sau seed A chạm voucher thật. Quay số bằng thứ đổi được ra giá trị thật
 *   = cờ bạc theo đúng nghĩa pháp lý. Mọi thứ mua bằng Q phải NIÊM YẾT GIÁ.
 *   Hàm này chỉ nhận T; không có tham số nào cho Q, cố ý.
 */
import { rngAt, type Rng } from './rng.js';

export type Rarity = 'thuong' | 'hiem' | 'epic';

/** Rate công khai — tổng phải đúng 10.000 bp (có test khẳng định). */
export const GACHA_RATES_BP: Readonly<Record<Rarity, number>> = {
  thuong: 7_000,
  hiem: 2_500,
  epic: 500,
};

export const GACHA = {
  /** Giá một lượt, token T. */
  COST_T: 100,
  /** Epic đảm bảo trong N lượt (founder chốt: 20). */
  PITY_EPIC: 20,
  /** Bankroll ≤ ngưỡng này thì CẤM quay. */
  MIN_BANKROLL_T: 500,
} as const;

export class GachaError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export interface PullResult {
  rarity: Rarity;
  /** Lượt này nổ vì pity chứ không phải may. Dùng cho minh bạch + phân tích. */
  fromPity: boolean;
  /** Số lượt kể từ epic gần nhất, SAU lượt này. */
  pullsSinceEpic: number;
  /** T bị đốt (luôn = COST_T). */
  burnedT: number;
}

/**
 * Quay MỘT lượt. Hàm thuần: nhận trạng thái, trả kết quả — không ghi DB, không
 * đụng ví. Caller (v0.3) chịu trách nhiệm đốt T trong cùng transaction và ghi
 * burn_ledger reason='gacha_burn' (đã có sẵn trong migration 0009).
 *
 * @param bankrollT số dư hiện tại, để áp luật chặn kiệt quệ
 * @param pullsSinceEpic số lượt kể từ epic gần nhất (0 nếu chưa quay bao giờ)
 * @param rng dòng ngẫu nhiên TẤT ĐỊNH — caller tạo bằng rngAt(seed, ...)
 */
export function pull(bankrollT: number, pullsSinceEpic: number, rng: Rng): PullResult {
  if (!Number.isInteger(bankrollT) || bankrollT < 0) {
    throw new GachaError('bad_bankroll', 'Số dư không hợp lệ.');
  }
  if (bankrollT <= GACHA.MIN_BANKROLL_T) {
    throw new GachaError('bankroll_too_low',
      `Cần trên ${GACHA.MIN_BANKROLL_T} T mới quay được (chống tự hủy khi sắp kiệt quệ).`);
  }
  if (bankrollT < GACHA.COST_T) {
    throw new GachaError('not_enough_t', `Cần ${GACHA.COST_T} T mỗi lượt.`);
  }
  if (!Number.isInteger(pullsSinceEpic) || pullsSinceEpic < 0) {
    throw new GachaError('bad_pity', 'Bộ đếm pity không hợp lệ.');
  }

  // Pity: lượt thứ PITY_EPIC kể từ epic gần nhất ĐẢM BẢO ra epic.
  if (pullsSinceEpic + 1 >= GACHA.PITY_EPIC) {
    return { rarity: 'epic', fromPity: true, pullsSinceEpic: 0, burnedT: GACHA.COST_T };
  }

  // Bốc theo bp, số nguyên thuần — cộng dồn ngưỡng, không dùng float.
  const roll = rng.below(10_000);
  let acc = 0;
  let rarity: Rarity = 'thuong';
  for (const r of ['epic', 'hiem', 'thuong'] as const) {
    acc += GACHA_RATES_BP[r];
    if (roll < acc) { rarity = r; break; }
  }

  return {
    rarity,
    fromPity: false,
    pullsSinceEpic: rarity === 'epic' ? 0 : pullsSinceEpic + 1,
    burnedT: GACHA.COST_T,
  };
}

// ───────────────────────── BỐC MÓN TRONG MỘT BẬC ──────────────────────────
/*
 * Hai hàm dưới đây tách khỏi `pull()` có chủ ý: `pull()` trả BẬC (đó là thứ được
 * công bố và cân bằng), còn "bậc nào ra món nào" là việc của catalog và TỒN KHO —
 * hai thứ đổi theo mùa. Trộn chúng vào nhau thì mỗi lần thêm một món là một lần
 * phải đọc lại luật rate.
 */

/**
 * Bốc ĐỀU TUYỆT ĐỐI trong danh sách ứng viên.
 *
 * Vì sao đều tuyệt đối chứ không "món hiếm nhẹ hơn một chút trong cùng bậc": A3.6
 * cấm seed lệch cửa ở tầng kèo vì đúng một lẽ — đã công bố tỷ lệ thì tỷ lệ phải là
 * TOÀN BỘ sự thật. Một trọng số ẩn bên trong bậc làm bảng rate công khai thành nửa
 * sự thật, và người chơi không có cách nào phát hiện.
 */
export function bocDeu<T>(ds: readonly T[], rng: Rng): T | null {
  return ds.length === 0 ? null : (ds[rng.below(ds.length)] ?? null);
}

/**
 * HẠ BẬC KHI BẬC ĐÃ BỐC HẾT HÀNG — epic → hiếm → thường.
 *
 * Cần vì D36 chốt món độc quyền có SỐ LƯỢNG HỮU HẠN: đến lượt thứ N+1, bậc epic
 * tồn tại trong bảng rate nhưng không còn món nào để trao. Ba đường xử lý và vì
 * sao chọn đường này:
 *
 *   · Hoàn T → mint ngược một khoản đã đốt, phạm A3.4. LOẠI.
 *   · Trao "phiếu chọn" → đẻ một loại xu thứ ba, đúng thứ tường lửa A3.5 tồn tại
 *     để chặn. LOẠI.
 *   · Hạ bậc, và NÓI TRƯỚC: catalog trả số bản còn lại của từng món hữu hạn, nên
 *     người chơi biết bậc epic đã cạn TRƯỚC KHI bấm. Rate không bị bịa lại — nó
 *     vẫn 5% cho epic, chỉ là bậc đó không còn hàng, và điều đó hiện trên màn.
 *
 * Trả `null` khi không bậc nào còn hàng → caller PHẢI từ chối lượt quay TRƯỚC khi
 * đốt T. Đốt tiền để nhận không có gì là lỗi tệ nhất mà cửa này có thể mắc.
 */
export const BAC_TU_CAO: readonly Rarity[] = ['epic', 'hiem', 'thuong'];

export function haBac(bac: Rarity, conHang: (b: Rarity) => boolean): Rarity | null {
  const tu = BAC_TU_CAO.indexOf(bac);
  for (let i = tu; i < BAC_TU_CAO.length; i += 1) {
    const b = BAC_TU_CAO[i]!;
    if (conHang(b)) return b;
  }
  // Bậc thấp hơn hết hàng nhưng bậc CAO hơn còn (kho lệch) → vẫn phải trao được
  // gì đó, và trao món TỐT hơn thì không ai bị thiệt.
  for (let i = tu - 1; i >= 0; i -= 1) {
    const b = BAC_TU_CAO[i]!;
    if (conHang(b)) return b;
  }
  return null;
}

/** Tiện ích: quay N lượt tất định từ một hạt (dùng cho test + mô phỏng rate). */
export function pullMany(
  bankrollT: number,
  startPity: number,
  seed: number,
  count: number,
): PullResult[] {
  const out: PullResult[] = [];
  let pity = startPity;
  let bankroll = bankrollT;
  for (let i = 0; i < count; i += 1) {
    if (bankroll - GACHA.COST_T <= GACHA.MIN_BANKROLL_T) break;
    const r = pull(bankroll, pity, rngAt(seed, 'gacha', i));
    out.push(r);
    pity = r.pullsSinceEpic;
    bankroll -= r.burnedT;
  }
  return out;
}
