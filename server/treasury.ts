/**
 * Sổ Kho bạc — đường ghi DUY NHẤT vào treasury_ledger.
 *
 * Mọi bút toán Kho bạc (genesis, seed_out, rake_in, subsidy_out...) phải đi qua
 * treasuryAppend để: (1) serial hóa bằng advisory lock trong transaction —
 * không bao giờ có 2 bút toán tính balance_after từ cùng một "dòng cuối";
 * (2) balance_after luôn được DB kiểm CHECK ≥ 0 — chi vượt quỹ fail rõ ràng
 * và rollback toàn transaction của caller (D10, A3.4).
 */
import type pg from 'pg';

/** Khóa advisory riêng cho chuỗi bút toán Kho bạc. */
export const TREASURY_LOCK_KEY = 81_500_2;

export type TreasuryReason =
  | 'genesis_grant'
  | 'rake_in'
  | 'seed_out'
  | 'seed_return'
  | 'seed_win'
  | 'subsidy_out'
  | 'unclaimed_pool_in'
  /**
   * Quà tri ân mùa beta (D68b, 04/08). KHÔNG tái dụng `subsidy_out`: trợ cấp
   * ngày và quà tri ân là hai khoản chi khác nhau, và gộp chúng làm hỏng đúng
   * phép đo "kho bạc còn gánh nổi trợ cấp bao lâu" mà D68 phải tính tay.
   */
  | 'qua_beta_out'
  /**
   * Nạp vốn cho QUỸ CHỢ (B5, D277). Chuyển KHÔNG mint: Kho bạc −x, quỹ chợ +x,
   * cùng transaction, khoá Kho bạc (bậc 5) rồi khoá quỹ chợ (bậc 6). Bất biến E
   * của audit đối chiếu hai vế — y hệt cách bất biến D đối chiếu trợ cấp.
   */
  | 'quy_cho_out'
  /**
   * 2% phí mỗi giao dịch ở chợ vật phẩm (B7b, D286) — vai mà `rake_in` từng
   * giữ. KHÔNG dùng lại `rake_in`: chợ dự báo đóng băng từ D86 nên `rake_in ≈ 0`
   * hôm nay là một phép đo có nghĩa ("nguồn thu cũ đã tắt"), và trộn hai nguồn
   * vào một tên là xoá đúng phép đo trả lời được câu *"chợ vật phẩm có thay nổi
   * vai rake không?"* (D68/D263).
   */
  | 'phi_cho_in';

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
  const { rows } = await client.query(
    'SELECT balance_after FROM treasury_ledger ORDER BY entry_id DESC LIMIT 1',
  );
  const current: bigint = rows.length > 0 ? (rows[0].balance_after as bigint) : 0n;
  const next = current + delta;
  // CHECK balance_after >= 0 của DB là lưới cuối; báo lỗi sớm cho message rõ hơn
  if (next < 0n) {
    throw new Error(
      `Kho bạc không đủ: số dư ${current} T, cần chi ${-delta} T (reason=${reason}). Giao dịch bị hủy.`,
    );
  }
  await client.query(
    `INSERT INTO treasury_ledger (delta, balance_after, reason, ref_market_id)
     VALUES ($1, $2, $3, $4)`,
    [delta.toString(), next.toString(), reason, refMarketId],
  );
  return next;
}
