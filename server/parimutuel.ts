/**
 * Lõi parimutuel — hàm thuần, không I/O. Luật: `docs/luat/03-kinh-te.md`
 * (A5.1 chia pool · A5.3 trần cược · A5.4 Brier).
 *
 * Tiền là BigInt: nhân trước, chia sau, floor đúng một lần (BigInt chia số
 * không âm = floor). Float chỉ xuất hiện ở giá trị hiển thị (pct, Brier).
 */
import { BP_DENOMINATOR, ECONOMY, applyBp } from '../config/economy.js';

/** Seed (tiền Kho bạc phủ mọi cửa) không thuộc user nào; bet người chơi luôn có user. */
export type BetLike =
  | { optionId: string; amount: bigint; isSeed: true; userId: null }
  | { optionId: string; amount: bigint; isSeed: false; userId: string };

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
  /** Rake đốt `ECONOMY.RAKE_BURN_BP` (chưa gồm residual). */
  rakeBurn: bigint;
  /** Phần dư floor → đốt (cộng vào burn). */
  residual: bigint;
  /** rakeBurn + residual — tổng ghi burn_ledger. */
  burnTotal: bigint;
  /** Rake Kho bạc `ECONOMY.RAKE_TREASURY_BP`. */
  treasuryRake: bigint;
  /** Nhánh S_w=0 không seed: toàn bộ D → Kho bạc (unclaimed_pool_in). */
  unclaimedToTreasury: bigint;
}

const sumBig = (values: Iterable<bigint>): bigint => {
  let s = 0n;
  for (const v of values) s += v;
  return s;
};

const sumAmounts = (bets: readonly BetLike[]): bigint => sumBig(bets.map((b) => b.amount));

const addTo = (m: Map<string, bigint>, userId: string, amount: bigint): void => {
  m.set(userId, (m.get(userId) ?? 0n) + amount);
};

/**
 * A5.1 — chia pool khi kèo resolve (winningOptionId) hoặc hủy (cancelled=true).
 *
 * Bẫy: Ngoại lệ 1 đo trên U_lose == 0 (token NGƯỜI CHƠI ở các cửa thua), không
 * đo "toàn pool ở cửa thắng". Seed phủ mọi cửa nên đo trên pool thì ngoại lệ
 * không bao giờ kích hoạt ở kèo có seed, và user được chia lãi từ seed cửa thua.
 * 0 bet người chơi cũng rơi vào nhánh này: seed về Kho bạc nguyên vẹn, không rake.
 *
 * Trước khi trả, tự kiểm
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
    // Dòng đọc từ DB không mang kiểu — hợp đồng của union phải kiểm lúc chạy.
    if (b.isSeed !== (b.userId === null)) throw new Error('Bet seed/user mâu thuẫn');
  }
  const P = sumAmounts(bets);
  const seedTotal = sumAmounts(bets.filter((b) => b.isSeed));

  const refundAllPlayers = (mode: 'refund_players' | 'cancelled'): PayoutResult => {
    const playerPayouts = new Map<string, bigint>();
    for (const b of bets) {
      if (!b.isSeed) addTo(playerPayouts, b.userId, b.amount);
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

  if (cancelled) return refundAllPlayers('cancelled');
  if (winningOptionId === null) throw new Error('Kèo resolve phải có cửa thắng');

  const uLose = sumAmounts(bets.filter((b) => !b.isSeed && b.optionId !== winningOptionId));
  if (uLose === 0n) return refundAllPlayers('refund_players');

  const burn = applyBp(P, ECONOMY.RAKE_BURN_BP);
  const trea = applyBp(P, ECONOMY.RAKE_TREASURY_BP);
  const D = P - burn - trea;
  const winners = bets.filter((b) => b.optionId === winningOptionId);
  const sW = sumAmounts(winners);

  if (sW === 0n) {
    // Seed phủ mọi cửa nên kèo có seed luôn có S_w > 0; tới được đây là seed
    // hỏng → nổ để caller rollback, không tịch thu im lặng.
    if (seedTotal > 0n) {
      throw new Error(
        'BẤT BIẾN A3.6 VỠ: kèo có seed nhưng cửa thắng 0 token — seed không phủ đủ cửa, dừng resolve.',
      );
    }
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

  const { playerPayouts, seedToTreasury, residual } = splitAmongWinners(winners, D, sW);
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

/**
 * Chia D cho các bet cửa thắng theo tỷ lệ amount / S_w. Phần của seed về Kho
 * bạc (seed_win); phần dư do floor (D − tổng đã chia) trả về để đốt.
 */
function splitAmongWinners(
  winners: readonly BetLike[],
  D: bigint,
  sW: bigint,
): { playerPayouts: Map<string, bigint>; seedToTreasury: bigint; residual: bigint } {
  const playerPayouts = new Map<string, bigint>();
  let seedToTreasury = 0n;
  let paid = 0n;
  for (const b of winners) {
    const payout = (b.amount * D) / sW;
    paid += payout;
    if (b.isSeed) seedToTreasury += payout;
    else addTo(playerPayouts, b.userId, payout);
  }
  return { playerPayouts, seedToTreasury, residual: D - paid };
}

/** Bất biến bảo toàn cung — lệch là bug nghiêm trọng, phải nổ ngay. */
function finalize(P: bigint, r: PayoutResult): PayoutResult {
  const sumPlayers = sumBig(r.playerPayouts.values());
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

/** A5.3 — cap = floor(BET_CAP_BP × (bankroll khả dụng + tổng đang đặt ở kèo)). */
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

const BET_CAP_PERCENT = (ECONOMY.BET_CAP_BP * 100) / BP_DENOMINATOR;

/**
 * Kiểm phân bổ mới cho TOÀN kèo (khai báo cả bộ, không phải lệnh cộng thêm):
 * trần A5.3 + không rút. Amount 0 = xóa cửa đó (hợp lệ miễn tổng không giảm).
 */
export function validateAllocations(input: {
  newAllocations: Map<string, bigint>;
  oldAllocations: Map<string, bigint>;
  bankroll: bigint;
}): AllocationVerdict {
  const { newAllocations, oldAllocations, bankroll } = input;

  for (const amount of newAllocations.values()) {
    if (amount < 0n) return { ok: false, code: 'below_min_bet', message: 'Mức phân bổ không được âm.' };
    if (amount > 0n && amount < BigInt(ECONOMY.MIN_BET)) {
      return { ok: false, code: 'below_min_bet', message: `Mỗi cửa đặt tối thiểu ${ECONOMY.MIN_BET} T.` };
    }
  }
  const totalNew = sumBig(newAllocations.values());
  if (totalNew === 0n) {
    return { ok: false, code: 'empty_allocation', message: 'Phân bổ trống — cần đặt ít nhất 1 cửa.' };
  }

  const totalOld = sumBig(oldAllocations.values());

  if (totalNew < totalOld) {
    return {
      ok: false,
      code: 'no_withdraw',
      message: 'Không rút được token đã đặt — chỉ thêm hoặc chuyển giữa các cửa.',
    };
  }

  // Quy chiếu gồm cả phần ĐANG đặt — chặn lách trần bằng nhiều lệnh nhỏ.
  const cap = computeCap(bankroll, totalOld);
  if (totalNew > cap) {
    return {
      ok: false,
      code: 'cap_exceeded',
      message: `Vượt trần ${BET_CAP_PERCENT}%/kèo: tối đa ${cap} T cho kèo này (bạn đang đặt ${totalOld} T).`,
    };
  }

  const netDelta = totalNew - totalOld; // ≥ 0 nhờ no-withdraw
  // Với trần ≤ 100 % quy chiếu, cap luôn chặn trước nhánh này; giữ làm lưới cuối.
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
  const total = sumBig(userAmounts.values());
  if (total <= 0n) throw new Error('computeBrier: user không có token đặt ở kèo này');

  let brier = 0;
  for (const optionId of allOptionIds) {
    const p = Number(userAmounts.get(optionId) ?? 0n) / Number(total);
    const o = optionId === winningOptionId ? 1 : 0;
    brier += (p - o) ** 2;
  }
  return brier;
}

/**
 * Một cửa như người chơi thấy: tiền đang ở đâu, không hơn.
 *
 * Cố ý KHÔNG có tỷ lệ ăn ngụ ý và KHÔNG có số người đã đặt. Tỷ lệ ăn khiến người
 * chơi tối ưu theo phần thưởng thay vì theo niềm tin; số người tạo áp lực đám
 * đông — cả hai làm bẩn tín hiệu "% ví đặt vào = độ tự tin". Ẩn ở tầng API chứ
 * không ở UI: không có trong response thì devtools cũng không moi ra được.
 */
export interface DistributionEntry {
  option_id: string;
  /** Tổng token đang ở cửa (gồm seed). */
  volume: number;
  /** % pool, 1 chữ số thập phân — chỉ để vẽ thanh tỷ lệ. */
  pct: number;
}

/** Phân bố pool theo tiền — server tính, client chỉ hiển thị. */
export function buildDistribution(volumes: Map<string, bigint>): DistributionEntry[] {
  const P = sumBig(volumes.values());

  const out: DistributionEntry[] = [];
  for (const [optionId, v] of volumes) {
    const pct = P > 0n ? Number((v * 1000n) / P) / 10 : 0;
    out.push({ option_id: optionId, volume: Number(v), pct });
  }
  return out;
}

/** Snapshot gọn cho bảng `events`: mảng [option_id, pct] + tổng volume, ≤ ~300 byte. */
export function compactSnapshot(volumes: Map<string, bigint>): {
  total_volume: number;
  d: [string, number][];
} {
  const dist = buildDistribution(volumes);
  return { total_volume: Number(sumBig(volumes.values())), d: dist.map((e) => [e.option_id, e.pct]) };
}
