/**
 * Sổ Kho bạc — đường ghi DUY NHẤT vào treasury_ledger.
 *
 * Mọi bút toán Kho bạc phải đi qua treasuryAppend để: (1) serial hóa bằng
 * advisory lock trong transaction — không bao giờ có 2 bút toán tính
 * balance_after từ cùng một "dòng cuối"; (2) balance_after luôn được DB kiểm
 * CHECK ≥ 0 — chi vượt quỹ fail rõ ràng và rollback toàn transaction của caller.
 */
import type pg from 'pg';

/**
 * Khoá advisory của chuỗi bút toán Kho bạc. Các khoá advisory trong repo dùng
 * dải 815_00x, mỗi sổ cái một số: 1 migrate · 2 Kho bạc · 3 quà beta · 4 quỹ chợ.
 * Khoá mới lấy số kế tiếp; trùng số là hai sổ cái xếp hàng chờ nhau.
 */
export const TREASURY_LOCK_KEY = 815_002;

export type TreasuryReason =
  | 'genesis_grant'
  | 'rake_in'
  | 'seed_out'
  | 'seed_return'
  | 'seed_win'
  | 'subsidy_out'
  | 'unclaimed_pool_in'
  /**
   * Quà tri ân mùa beta. Tách khỏi `subsidy_out` (trợ cấp ngày) để đo riêng được
   * "Kho bạc còn gánh nổi trợ cấp bao lâu".
   */
  | 'qua_beta_out'
  /**
   * Nạp vốn cho quỹ chợ — chuyển, không mint: Kho bạc −x và quỹ chợ +x trong cùng
   * transaction, khoá Kho bạc trước rồi quỹ chợ. Audit đối chiếu hai vế.
   */
  | 'quy_cho_out'
  /**
   * Phí mỗi giao dịch ở chợ vật phẩm. Tách khỏi `rake_in` (rake của chợ dự báo, đã
   * đóng băng) để vẫn đo được chợ vật phẩm có thay nổi nguồn thu rake hay không.
   */
  | 'phi_cho_in';

/** Chi vượt số dư Kho bạc. Bắt bằng `instanceof` hoặc `code`, đừng so câu chữ. */
export class TreasuryInsufficientError extends Error {
  readonly code = 'treasury_insufficient';

  constructor(
    readonly balance: bigint,
    readonly delta: bigint,
    readonly reason: TreasuryReason,
  ) {
    super(`Kho bạc không đủ: số dư ${balance} T, cần chi ${-delta} T (reason=${reason}). Giao dịch bị hủy.`);
    this.name = 'TreasuryInsufficientError';
  }
}

/**
 * Ghi một bút toán Kho bạc. PHẢI gọi bên trong transaction đang mở của
 * `client` — lock giữ tới hết transaction (pg_advisory_xact_lock).
 * Trả về balance_after mới.
 */
export async function treasuryAppend(
  client: pg.PoolClient | pg.Client,
  delta: bigint,
  reason: TreasuryReason,
  refMarketId: string | null = null,
): Promise<bigint> {
  await client.query('SELECT pg_advisory_xact_lock($1)', [TREASURY_LOCK_KEY]);
  // int8 được parse thành BigInt ở server/db.ts.
  const { rows } = await client.query<{ balance_after: bigint }>(
    'SELECT balance_after FROM treasury_ledger ORDER BY entry_id DESC LIMIT 1',
  );
  const current = rows[0]?.balance_after ?? 0n;
  const next = current + delta;
  // CHECK balance_after >= 0 của DB là lưới cuối; nổ sớm ở đây để lỗi mang mã.
  if (next < 0n) throw new TreasuryInsufficientError(current, delta, reason);
  await client.query(
    `INSERT INTO treasury_ledger (delta, balance_after, reason, ref_market_id)
     VALUES ($1, $2, $3, $4)`,
    [delta.toString(), next.toString(), reason, refMarketId],
  );
  return next;
}
