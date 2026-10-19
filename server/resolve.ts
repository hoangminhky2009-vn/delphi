/**
 * GĐ4 VIỆC 3 — Engine resolve/cancel: MỘT transaction cho toàn bộ chia pool.
 *
 * Toán chia nằm TRỌN trong hàm thuần computePayout (đã test 4 vectors GĐ3 +
 * D18) — file này chỉ là "thủ quỹ": áp kết quả vào ledger theo đúng thứ tự,
 * assert bất biến, lệch 1 token cũng ROLLBACK (A5.1).
 *
 * Thứ tự khóa: markets FOR UPDATE trước → users FOR UPDATE sau (sort theo
 * user_id). Trùng thứ tự với transaction đặt cược (market trước, ví sau —
 * xem markets.ts) → bet và resolve KHÔNG BAO GIỜ deadlock chéo nhau.
 */
import type pg from 'pg';
import { computePayout, computeBrier, type BetLike, type PayoutMode } from './parimutuel.js';
import { treasuryAppend } from './treasury.js';
import { RANK_FORMULA } from '../config/economy.js';

export class LifecycleError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export interface SettleSummary {
  mode: PayoutMode;
  playersPaid: number;
  totalPlayerPayout: bigint;
  seedToTreasury: bigint;
  burnTotal: bigint;
  treasuryRake: bigint;
  unclaimedToTreasury: bigint;
}

/** Đọc mọi bet của kèo thành BetLike cho hàm thuần. */
async function loadBets(client: pg.PoolClient, marketId: string): Promise<BetLike[]> {
  const { rows } = await client.query(
    `SELECT option_id, user_id, amount, is_seed FROM bets WHERE market_id = $1`,
    [marketId],
  );
  return rows.map((r) => ({
    optionId: r.option_id,
    userId: r.user_id,
    amount: r.amount as bigint,
    isSeed: r.is_seed,
  }));
}

/**
 * Áp kết quả computePayout vào sổ sách — dùng chung cho resolve lẫn cancel.
 * walletReason: 'payout' (thắng thật) | 'refund' (hoàn nguyên/hủy).
 */
async function settle(
  client: pg.PoolClient,
  marketId: string,
  bets: BetLike[],
  outcomeOptionId: string | null,
  cancelled: boolean,
): Promise<SettleSummary> {
  const r = computePayout(bets, outcomeOptionId, cancelled);
  const walletReason = r.mode === 'normal' ? 'payout' : 'refund';
  const seedReason = r.mode === 'normal' ? 'seed_win' : 'seed_return';

  // Trả từng user — khóa ví theo THỨ TỰ user_id để hai resolve song song
  // (2 kèo, tập user giao nhau) không deadlock nhau.
  const userIds = [...r.playerPayouts.keys()].sort();
  let totalPlayerPayout = 0n;
  for (const userId of userIds) {
    const amount = r.playerPayouts.get(userId)!;
    if (amount <= 0n) continue; // payout 0 do floor — không có bút toán delta=0
    totalPlayerPayout += amount;
    const { rows } = await client.query(
      `UPDATE users SET bankroll = bankroll + $1 WHERE user_id = $2 RETURNING bankroll`,
      [amount.toString(), userId],
    );
    await client.query(
      `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason, ref_market_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, amount.toString(), (rows[0].bankroll as bigint).toString(), walletReason, marketId],
    );
  }

  if (r.seedToTreasury > 0n) {
    await treasuryAppend(client, r.seedToTreasury, seedReason, marketId);
  }
  if (r.unclaimedToTreasury > 0n) {
    await treasuryAppend(client, r.unclaimedToTreasury, 'unclaimed_pool_in', marketId);
  }
  if (r.treasuryRake > 0n) {
    await treasuryAppend(client, r.treasuryRake, 'rake_in', marketId);
  }
  if (r.rakeBurn > 0n) {
    await client.query(
      `INSERT INTO burn_ledger (amount, reason, ref_market_id) VALUES ($1, 'rake_burn', $2)`,
      [r.rakeBurn.toString(), marketId],
    );
  }
  if (r.residual > 0n) {
    await client.query(
      `INSERT INTO burn_ledger (amount, reason, ref_market_id) VALUES ($1, 'residual_burn', $2)`,
      [r.residual.toString(), marketId],
    );
  }

  // Bất biến A5.1 lần hai — soi trên số THỰC GHI (computePayout đã assert nội
  // bộ; đây là lưới kiểm số đã đi qua ledger). Lệch 1 token → throw → ROLLBACK.
  const P = bets.reduce((s, b) => s + b.amount, 0n);
  const out =
    totalPlayerPayout + r.seedToTreasury + r.unclaimedToTreasury +
    r.treasuryRake + r.rakeBurn + r.residual;
  if (out !== P) {
    throw new Error(`BẤT BIẾN RESOLVE VỠ: P=${P} nhưng tổng ghi sổ=${out} — ROLLBACK`);
  }

  return {
    mode: r.mode,
    playersPaid: userIds.length,
    totalPlayerPayout,
    seedToTreasury: r.seedToTreasury,
    burnTotal: r.burnTotal,
    treasuryRake: r.treasuryRake,
    unclaimedToTreasury: r.unclaimedToTreasury,
  };
}

/** Resolve kèo ĐÃ KHÓA bằng cửa thắng do nguồn chính thức công bố (A3.2). */
export async function resolveMarket(
  pool: pg.Pool,
  opts: { marketId: string; outcomeOptionId: string; resolutionNote: string },
): Promise<SettleSummary> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: mRows } = await client.query(
      `SELECT status FROM markets WHERE market_id = $1 FOR UPDATE`,
      [opts.marketId],
    );
    if (mRows.length === 0) throw new LifecycleError('not_found', 'Không có kèo này.');
    if (mRows[0].status !== 'locked') {
      throw new LifecycleError(
        'not_locked',
        `Kèo chưa khóa (status=${mRows[0].status}) — chỉ resolve được kèo đã khóa.`,
      );
    }
    const { rows: optRows } = await client.query(
      `SELECT 1 FROM market_options WHERE option_id = $1 AND market_id = $2`,
      [opts.outcomeOptionId, opts.marketId],
    );
    if (optRows.length === 0) {
      throw new LifecycleError('invalid_option', 'Cửa thắng không thuộc kèo này.');
    }

    const bets = await loadBets(client, opts.marketId);
    const summary = await settle(client, opts.marketId, bets, opts.outcomeOptionId, false);

    await client.query(
      `UPDATE markets SET status = 'resolved', outcome_option_id = $1,
              resolved_ts = now(), resolution_note = $2
        WHERE market_id = $3`,
      [opts.outcomeOptionId, opts.resolutionNote, opts.marketId],
    );
    await client.query('COMMIT');
    return summary;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Hủy kèo (admin có lý do / scheduler quá hạn nguồn) — A5.1 ngoại lệ 2. */
export async function cancelMarket(
  pool: pg.Pool,
  opts: { marketId: string; reason: string },
): Promise<SettleSummary> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: mRows } = await client.query(
      `SELECT status FROM markets WHERE market_id = $1 FOR UPDATE`,
      [opts.marketId],
    );
    if (mRows.length === 0) throw new LifecycleError('not_found', 'Không có kèo này.');
    if (mRows[0].status !== 'open' && mRows[0].status !== 'locked') {
      throw new LifecycleError(
        'not_cancellable',
        `Kèo ở trạng thái ${mRows[0].status} — chỉ hủy được kèo open/locked.`,
      );
    }

    const bets = await loadBets(client, opts.marketId);
    const summary = await settle(client, opts.marketId, bets, null, true);

    await client.query(
      `UPDATE markets SET status = 'cancelled', resolution_note = $1 WHERE market_id = $2`,
      [opts.reason, opts.marketId],
    );
    await client.query('COMMIT');
    return summary;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Sau COMMIT resolve: Brier từng người tham gia (bảng scores, idempotent) +
 * rank per-pool (rank_snapshots, trọng số 0,9^n kèo mới → cũ — A5.4).
 * v0.1: tính + lưu, KHÔNG hiển thị (A3.8). Tách khỏi transaction resolve —
 * chạy lại thoải mái, không đụng tiền.
 */
export async function updateScoresAndRanks(pool: pg.Pool, marketId: string): Promise<void> {
  const { rows: mRows } = await pool.query(
    `SELECT pool, status, outcome_option_id, resolved_ts FROM markets WHERE market_id = $1`,
    [marketId],
  );
  const m = mRows[0];
  if (!m || m.status !== 'resolved' || !m.outcome_option_id) return;

  const { rows: optRows } = await pool.query(
    `SELECT option_id FROM market_options WHERE market_id = $1 ORDER BY sort_order`,
    [marketId],
  );
  const allOptionIds = optRows.map((r) => r.option_id as string);

  const { rows: betRows } = await pool.query(
    `SELECT user_id, option_id, amount FROM bets
      WHERE market_id = $1 AND NOT is_seed`,
    [marketId],
  );
  const byUser = new Map<string, Map<string, bigint>>();
  for (const b of betRows) {
    const mine = byUser.get(b.user_id) ?? new Map<string, bigint>();
    mine.set(b.option_id, b.amount as bigint);
    byUser.set(b.user_id, mine);
  }

  for (const [userId, amounts] of byUser) {
    const brier = computeBrier(amounts, m.outcome_option_id, allOptionIds);
    await pool.query(
      `INSERT INTO scores (user_id, market_id, pool, brier, resolved_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, market_id) DO NOTHING`,
      [userId, marketId, m.pool, brier, m.resolved_ts],
    );
  }

  // Rank per-pool: trung bình Brier trọng số 0,9^n theo kèo mới → cũ
  const decay = RANK_FORMULA.RECENCY_DECAY_BP / 10_000;
  for (const [userId] of byUser) {
    const { rows: hist } = await pool.query(
      `SELECT brier FROM scores WHERE user_id = $1 AND pool = $2 ORDER BY resolved_at DESC`,
      [userId, m.pool],
    );
    let num = 0;
    let den = 0;
    hist.forEach((row, i) => {
      const w = decay ** i;
      num += Number(row.brier) * w;
      den += w;
    });
    await pool.query(
      `INSERT INTO rank_snapshots (user_id, pool, rank_value, markets_counted, formula_version)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, m.pool, den > 0 ? num / den : 0, hist.length, RANK_FORMULA.VERSION],
    );
  }
}
