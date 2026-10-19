/**
 * Lõi parimutuel — HÀM THUẦN, không I/O (GĐ3 VIỆC 1; GĐ4 dùng lại cho resolve).
 *
 * Luật nguồn: CLAUDE.md A5.1 (payout), A5.3 (cap), A5.4 (Brier), A3.4/A3.6 (seed).
 * C5: mọi tính toán tiền tệ bằng BigInt — nhân trước, chia sau, floor MỘT lần
 * (BigInt chia số không âm = floor). CẤM float chạm vào tiền; float chỉ xuất
 * hiện ở giá trị HIỂN THỊ (pct, implied ratio, Brier — không phải tiền).
 */
import { ECONOMY, applyBp } from '../config/economy.js';

export interface BetLike {
  optionId: string;
  /** null nếu là seed (A3.6). */
  userId: string | null;
  amount: bigint;
  isSeed: boolean;
}

export type PayoutMode =
  | 'normal'               // công thức A5.1 đầy đủ
  | 'refund_players'       // Ngoại lệ 1: 100% token NGƯỜI CHƠI ở cửa thắng
  | 'cancelled'            // Ngoại lệ 2: hủy kèo
  | 'unclaimed_to_treasury'; // không seed & S_w=0 → D vào Kho bạc

export interface PayoutResult {
  mode: PayoutMode;
  /** Tổng trả cho TỪNG user (đã gộp mọi bet thắng/hoàn của user đó). */
  playerPayouts: Map<string, bigint>;
  /** Phần của seed → Kho bạc (seed_win khi normal; seed_return khi hoàn/hủy). */
  seedToTreasury: bigint;
  /** Rake đốt 3% (chưa gồm residual). */
  rakeBurn: bigint;
  /** Phần dư floor → đốt (cộng vào burn). */
  residual: bigint;
  /** rakeBurn + residual — tổng ghi burn_ledger. */
  burnTotal: bigint;
  /** Rake Kho bạc 2%. */
  treasuryRake: bigint;
  /** Nhánh S_w=0 không seed: toàn bộ D → Kho bạc (unclaimed_pool_in). */
  unclaimedToTreasury: bigint;
}

/**
 * A5.1 — chia pool khi kèo resolve (winningOptionId) hoặc hủy (cancelled=true).
 *
 * QUAN TRỌNG (bẫy đã kiểm chứng bằng phản ví dụ): Ngoại lệ 1 đo trên
 * U_lose == 0 (tổng token NGƯỜI CHƠI ở các cửa THUA), TUYỆT ĐỐI không đo
 * "toàn pool ở cửa thắng" — vì seed phủ mọi cửa (A3.6) nên đo trên pool thì
 * ngoại lệ không bao giờ kích hoạt với kèo có seed → user được chia lãi sai
 * từ seed cửa thua. Trường hợp 0 bet người chơi cũng rơi vào nhánh này
 * (chân không đúng): seed về Kho bạc nguyên vẹn, không rake — tránh đốt 5%
 * tiền Kho bạc một cách vô nghĩa.
 *
 * Tự kiểm bất biến trước khi trả kết quả:
 *   P == Σ playerPayouts + seedToTreasury + burnTotal + treasuryRake + unclaimed
 * Lệch → throw (caller phải rollback transaction).
 */
export function computePayout(
  bets: readonly BetLike[],
  winningOptionId: string | null,
  cancelled: boolean,
): PayoutResult {
  for (const b of bets) {
    if (b.amount < 1n) throw new Error(`Bet amount < 1: ${b.amount}`);
    if (b.isSeed !== (b.userId === null)) throw new Error('Bet seed/user mâu thuẫn');
  }
  const P = bets.reduce((s, b) => s + b.amount, 0n);
  const seedTotal = bets.filter((b) => b.isSeed).reduce((s, b) => s + b.amount, 0n);

  const refundAllPlayers = (mode: 'refund_players' | 'cancelled'): PayoutResult => {
    const playerPayouts = new Map<string, bigint>();
    for (const b of bets) {
      if (b.isSeed) continue;
      playerPayouts.set(b.userId!, (playerPayouts.get(b.userId!) ?? 0n) + b.amount);
    }
    return finalize(P, {
      mode,
      playerPayouts,
      seedToTreasury: seedTotal,
      rakeBurn: 0n,
      residual: 0n,
      burnTotal: 0n,
      treasuryRake: 0n,
      unclaimedToTreasury: 0n,
    });
  };

  // Ngoại lệ 2 — hủy kèo (admin hủy / quá 7 ngày không nguồn)
  if (cancelled) return refundAllPlayers('cancelled');
  if (winningOptionId === null) throw new Error('Kèo resolve phải có cửa thắng');

  // Ngoại lệ 1 — U_lose == 0 (đo trên token NGƯỜI CHƠI, không đo trên pool)
  const uLose = bets
    .filter((b) => !b.isSeed && b.optionId !== winningOptionId)
    .reduce((s, b) => s + b.amount, 0n);
  if (uLose === 0n) return refundAllPlayers('refund_players');

  // Công thức thường A5.1
  const burn = applyBp(P, ECONOMY.RAKE_BURN_BP);
  const trea = applyBp(P, ECONOMY.RAKE_TREASURY_BP);
  const D = P - burn - trea;
  const winners = bets.filter((b) => b.optionId === winningOptionId);
  const sW = winners.reduce((s, b) => s + b.amount, 0n);

  if (sW === 0n) {
    // A5.1 ghi chú: nhánh này CHỈ tồn tại cho kèo KHÔNG seed (seed phủ mọi cửa
    // — A3.6 — nên kèo có seed luôn có S_w > 0). Kèo có seed mà rơi vào đây =
    // dữ liệu seed hỏng → nổ ngay để caller rollback, không tịch thu im lặng.
    if (seedTotal > 0n) {
      throw new Error(
        'BẤT BIẾN A3.6 VỠ: kèo có seed nhưng cửa thắng 0 token — seed không phủ đủ cửa, dừng resolve.',
      );
    }
    // Không seed & không ai đặt cửa thắng → toàn bộ D vào Kho bạc, không chia
    return finalize(P, {
      mode: 'unclaimed_to_treasury',
      playerPayouts: new Map(),
      seedToTreasury: 0n,
      rakeBurn: burn,
      residual: 0n,
      burnTotal: burn,
      treasuryRake: trea,
      unclaimedToTreasury: D,
    });
  }

  const playerPayouts = new Map<string, bigint>();
  let seedToTreasury = 0n;
  let paid = 0n;
  for (const b of winners) {
    const payout = (b.amount * D) / sW; // nhân trước, chia sau, floor một lần
    paid += payout;
    if (b.isSeed) {
      seedToTreasury += payout; // seed thắng → Kho bạc (seed_win), không user nào nhận
    } else {
      playerPayouts.set(b.userId!, (playerPayouts.get(b.userId!) ?? 0n) + payout);
    }
  }
  const residual = D - paid; // phần dư floor → ĐỐT (A5.1)

  return finalize(P, {
    mode: 'normal',
    playerPayouts,
    seedToTreasury,
    rakeBurn: burn,
    residual,
    burnTotal: burn + residual,
    treasuryRake: trea,
    unclaimedToTreasury: 0n,
  });
}

/** Assertion bất biến bảo toàn cung — lệch là bug nghiêm trọng, phải nổ ngay. */
function finalize(P: bigint, r: PayoutResult): PayoutResult {
  const sumPlayers = [...r.playerPayouts.values()].reduce((s, v) => s + v, 0n);
  const total = sumPlayers + r.seedToTreasury + r.burnTotal + r.treasuryRake + r.unclaimedToTreasury;
  if (total !== P) {
    throw new Error(
      `BẤT BIẾN PAYOUT VỠ (mode=${r.mode}): P=${P} nhưng tổng chia=${total} (lệch ${total - P})`,
    );
  }
  if (r.burnTotal !== r.rakeBurn + r.residual) {
    throw new Error('burnTotal != rakeBurn + residual');
  }
  return r;
}

/** A5.3 — cap = floor(20% × (bankroll khả dụng + tổng đang đặt ở kèo)). */
export function computeCap(bankrollAvailable: bigint, totalCurrentInMarket: bigint): bigint {
  return applyBp(bankrollAvailable + totalCurrentInMarket, ECONOMY.BET_CAP_BP);
}

export type AllocationError =
  | 'empty_allocation'
  | 'below_min_bet'
  | 'no_withdraw'
  | 'cap_exceeded'
  | 'insufficient_bankroll';

export type AllocationVerdict =
  | { ok: true; netDelta: bigint; totalNew: bigint; totalOld: bigint; cap: bigint }
  | { ok: false; code: AllocationError; message: string };

/**
 * Kiểm phân bổ DECLARATIVE mới toàn kèo (A5.3 + no-withdraw [MẶC ĐỊNH P3]).
 * Amount 0 = xóa cửa đó (hợp lệ miễn tổng không giảm).
 */
export function validateAllocations(input: {
  newAllocations: Map<string, bigint>;
  oldAllocations: Map<string, bigint>;
  bankroll: bigint;
}): AllocationVerdict {
  const { newAllocations, oldAllocations, bankroll } = input;

  let totalNew = 0n;
  for (const [, amount] of newAllocations) {
    if (amount < 0n) return { ok: false, code: 'below_min_bet', message: 'Mức phân bổ không được âm.' };
    if (amount > 0n && amount < BigInt(ECONOMY.MIN_BET)) {
      return { ok: false, code: 'below_min_bet', message: `Mỗi cửa đặt tối thiểu ${ECONOMY.MIN_BET} T.` };
    }
    totalNew += amount;
  }
  if (totalNew === 0n) {
    return { ok: false, code: 'empty_allocation', message: 'Phân bổ trống — cần đặt ít nhất 1 cửa.' };
  }

  let totalOld = 0n;
  for (const [, amount] of oldAllocations) totalOld += amount;

  // No-withdraw: không rút token về ví trước giờ khóa
  if (totalNew < totalOld) {
    return {
      ok: false,
      code: 'no_withdraw',
      message: 'Không rút được token đã đặt — chỉ thêm hoặc chuyển giữa các cửa.',
    };
  }

  // Cap A5.3: quy chiếu gồm cả phần ĐANG đặt (chống lách bằng nhiều lệnh nhỏ)
  const cap = computeCap(bankroll, totalOld);
  if (totalNew > cap) {
    return {
      ok: false,
      code: 'cap_exceeded',
      message: `Vượt trần 20%/kèo: tối đa ${cap} T cho kèo này (bạn đang đặt ${totalOld} T).`,
    };
  }

  const netDelta = totalNew - totalOld; // ≥ 0 nhờ no-withdraw
  if (netDelta > bankroll) {
    return { ok: false, code: 'insufficient_bankroll', message: 'Số dư không đủ.' };
  }

  return { ok: true, netDelta, totalNew, totalOld, cap };
}

/**
 * A5.4 — Brier = Σ(p_i − o_i)², thang 0–2. p_i tính từ SỐ NGUYÊN token;
 * kết quả là điểm số (không phải tiền) nên float được phép.
 */
export function computeBrier(
  userAmounts: Map<string, bigint>,
  winningOptionId: string,
  allOptionIds: readonly string[],
): number {
  let total = 0n;
  for (const [, v] of userAmounts) total += v;
  if (total <= 0n) throw new Error('computeBrier: user không có token đặt ở kèo này');

  let brier = 0;
  for (const optionId of allOptionIds) {
    const p = Number(userAmounts.get(optionId) ?? 0n) / Number(total);
    const o = optionId === winningOptionId ? 1 : 0;
    brier += (p - o) ** 2;
  }
  return brier;
}

export interface DistributionEntry {
  option_id: string;
  /** Tổng token đang ở cửa (gồm seed) — thứ DUY NHẤT user thấy về từng cửa. */
  volume: number;
  /** % pool, 1 chữ số thập phân — chỉ để vẽ thanh tỷ lệ (suy được từ volume). */
  pct: number;
  /**
   * KHÔNG có `implied_payout_ratio` và KHÔNG có số người — quyết định founder
   * 19/07/2026 (sửa A3.1): người chơi thấy TIỀN đang ở đâu, KHÔNG thấy "tôi sẽ
   * nhận bao nhiêu" và KHÔNG thấy bao nhiêu người đã đặt. Lý do: hiện tỷ lệ ăn
   * → người chơi tối ưu hoá theo phần thưởng thay vì theo niềm tin thật; hiện
   * số người → áp lực đám đông. Cả hai làm bẩn tín hiệu "% ví đặt vào = độ tự
   * tin", vốn là tài sản dữ liệu cốt lõi (A1).
   * Ẩn ở TẦNG API, không phải tầng UI — không có trong response thì F12 cũng
   * không moi ra được.
   */
}

/**
 * Phân bố pool theo TIỀN — server tính (C4), client CHỈ hiển thị.
 * Cố ý KHÔNG trả tỷ lệ ăn ngụ ý (xem ghi chú ở DistributionEntry).
 */
export function buildDistribution(volumes: Map<string, bigint>): DistributionEntry[] {
  let P = 0n;
  for (const [, v] of volumes) P += v;

  const out: DistributionEntry[] = [];
  for (const [optionId, v] of volumes) {
    const pct = P > 0n ? Number((v * 1000n) / P) / 10 : 0;
    out.push({ option_id: optionId, volume: Number(v), pct });
  }
  return out;
}

/** Snapshot GỌN cho events (A7): mảng [option_id, pct] + tổng volume, ≤ ~300 byte. */
export function compactSnapshot(volumes: Map<string, bigint>): {
  total_volume: number;
  d: [string, number][];
} {
  const dist = buildDistribution(volumes);
  let total = 0n;
  for (const [, v] of volumes) total += v;
  return { total_volume: Number(total), d: dist.map((e) => [e.option_id, e.pct]) };
}
