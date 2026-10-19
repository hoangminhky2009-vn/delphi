/**
 * Kiểm toán tổng cung token T (luật A3.10) — logic DÙNG CHUNG:
 * scripts/audit_supply.ts (CLI) và server/admin.ts (dashboard) cùng gọi.
 * Nằm trong server/ vì deploy chỉ đóng gói api/server/config — import từ
 * scripts/ ở runtime là crash function (đã dính 18/07).
 *
 * Nguyên lý bảo toàn: token chỉ sinh từ mint (signup_grant, admin_adjust,
 * genesis_grant một lần — D10) và chỉ mất khi đốt (burn_ledger). Còn lại là
 * CHUYỂN giữa 3 nơi giữ: ví user ↔ pool đang treo (kèo open/locked) ↔ Kho bạc.
 *
 * Bất biến A: mint_ròng − đã_đốt == Σ bankroll + pool_đang_treo + kho_bạc
 * Bất biến B: chuỗi wallet_ledger từng user cộng dồn đúng + dòng cuối == bankroll
 * Bất biến C: chuỗi treasury_ledger cộng dồn đúng
 * Bất biến D: Σ trợ cấp user nhận == −Σ subsidy_out của Kho bạc
 */
import type pg from 'pg';

export interface AuditReport {
  ok: boolean;
  problems: string[];
  numbers: Record<string, string>;
}

async function sumQuery(pool: pg.Pool, sql: string, params: unknown[] = []): Promise<bigint> {
  const { rows } = await pool.query(sql, params);
  return BigInt(rows[0].s ?? 0);
}

export async function auditSupply(pool: pg.Pool): Promise<AuditReport> {
  const problems: string[] = [];

  // --- Bất biến A: bảo toàn cung ---
  const mintedWallet = await sumQuery(
    pool,
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM wallet_ledger
     WHERE reason IN ('signup_grant', 'admin_adjust')`,
  );
  const mintedGenesis = await sumQuery(
    pool,
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM treasury_ledger
     WHERE reason = 'genesis_grant'`,
  );
  const minted = mintedWallet + mintedGenesis;
  const burned = await sumQuery(pool, `SELECT COALESCE(SUM(amount), 0)::text AS s FROM burn_ledger`);
  const bankrolls = await sumQuery(pool, `SELECT COALESCE(SUM(bankroll), 0)::text AS s FROM users`);
  const treasury = await sumQuery(pool, `SELECT COALESCE(SUM(delta), 0)::text AS s FROM treasury_ledger`);
  const escrow = await sumQuery(
    pool,
    `SELECT COALESCE(SUM(b.amount), 0)::text AS s
     FROM bets b JOIN markets m ON m.market_id = b.market_id
     WHERE m.status IN ('open', 'locked')`,
  );

  // Quỹ chợ (B5, 0058) — vế thứ tư của bất biến A. Bảng chưa có nghĩa là
  // migration chưa chạy sau khi code đã deploy: đó là một vấn đề phải KÊU,
  // không phải một số 0 lặng lẽ.
  const coQuyCho = (await pool.query(`SELECT to_regclass('quy_cho_ledger') AS r`)).rows[0].r !== null;
  const quyCho = coQuyCho
    ? await sumQuery(pool, `SELECT COALESCE(SUM(delta), 0)::text AS s FROM quy_cho_ledger`)
    : 0n;
  if (!coQuyCho) problems.push('quy_cho_ledger CHƯA CÓ — migration 0058 chưa chạy trên DB này');

  const supplyExpected = minted - burned;
  const holdings = bankrolls + escrow + treasury + quyCho;
  if (supplyExpected !== holdings) {
    problems.push(
      `Bất biến A LỆCH: mint_ròng − đốt = ${supplyExpected} nhưng ví + pool treo + kho bạc + quỹ chợ = ${holdings} (chênh ${holdings - supplyExpected})`,
    );
  }

  // --- Bất biến B: chuỗi wallet_ledger từng user + đối chiếu bankroll ---
  const wl = await pool.query(
    `SELECT user_id, delta, balance_after FROM wallet_ledger ORDER BY user_id, entry_id`,
  );
  const running = new Map<string, bigint>();
  for (const row of wl.rows) {
    const prev = running.get(row.user_id) ?? 0n;
    const expected = prev + (row.delta as bigint);
    if (expected !== (row.balance_after as bigint)) {
      problems.push(
        `Bất biến B LỆCH: user ${row.user_id} có bút toán balance_after=${row.balance_after} nhưng cộng dồn ra ${expected}`,
      );
    }
    running.set(row.user_id, row.balance_after as bigint);
  }
  const users = await pool.query(`SELECT user_id, bankroll FROM users`);
  for (const u of users.rows) {
    const fromLedger = running.get(u.user_id) ?? 0n;
    if (fromLedger !== (u.bankroll as bigint)) {
      problems.push(
        `Bất biến B LỆCH: user ${u.user_id} bankroll=${u.bankroll} nhưng ledger cộng dồn = ${fromLedger}`,
      );
    }
  }

  // --- Bất biến C: chuỗi treasury_ledger ---
  const tl = await pool.query(`SELECT delta, balance_after FROM treasury_ledger ORDER BY entry_id`);
  let tRunning = 0n;
  for (const row of tl.rows) {
    tRunning += row.delta as bigint;
    if (tRunning !== (row.balance_after as bigint)) {
      problems.push(
        `Bất biến C LỆCH: treasury_ledger có balance_after=${row.balance_after} nhưng cộng dồn ra ${tRunning}`,
      );
      tRunning = row.balance_after as bigint;
    }
  }

  // --- Bất biến D: trợ cấp khớp hai sổ ---
  const subsidyToUsers = await sumQuery(
    pool,
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM wallet_ledger WHERE reason = 'subsidy'`,
  );
  const subsidyFromTreasury = await sumQuery(
    pool,
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM treasury_ledger WHERE reason = 'subsidy_out'`,
  );
  if (subsidyToUsers !== -subsidyFromTreasury) {
    problems.push(
      `Bất biến D LỆCH: user nhận trợ cấp ${subsidyToUsers} nhưng kho bạc chi ${subsidyFromTreasury}`,
    );
  }

  // --- Bất biến C' (B5): chuỗi quy_cho_ledger cộng dồn đúng ---
  if (coQuyCho) {
    const ql = await pool.query(`SELECT delta, balance_after FROM quy_cho_ledger ORDER BY entry_id`);
    let qRunning = 0n;
    for (const row of ql.rows) {
      qRunning += row.delta as bigint;
      if (qRunning !== (row.balance_after as bigint)) {
        problems.push(
          `Bất biến C' LỆCH: quy_cho_ledger có balance_after=${row.balance_after} nhưng cộng dồn ra ${qRunning}`,
        );
        qRunning = row.balance_after as bigint;
      }
    }
  }

  // --- Bất biến E (B5): vốn Kho bạc rót sang quỹ chợ khớp hai sổ ---
  // Cùng khuôn bất biến D: một khoản CHUYỂN phải hiện ở cả hai đầu, dấu ngược.
  // Thiếu một đầu là mint hoặc đốt đội lốt chuyển.
  if (coQuyCho) {
    const raKhoBac = await sumQuery(
      pool,
      `SELECT COALESCE(SUM(delta), 0)::text AS s FROM treasury_ledger WHERE reason = 'quy_cho_out'`,
    );
    const vaoQuyCho = await sumQuery(
      pool,
      `SELECT COALESCE(SUM(delta), 0)::text AS s FROM quy_cho_ledger WHERE reason = 'nap_tu_kho_bac'`,
    );
    if (vaoQuyCho !== -raKhoBac) {
      problems.push(
        `Bất biến E LỆCH: Kho bạc rót ${raKhoBac} sang quỹ chợ nhưng quỹ chợ ghi nhận ${vaoQuyCho}`,
      );
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    numbers: {
      'Mint ví (signup + admin_adjust)': mintedWallet.toString(),
      'Vốn genesis Kho bạc (D10)': mintedGenesis.toString(),
      'Quỹ chợ (B5)': coQuyCho ? quyCho.toString() : 'chưa có bảng',
      'Mint ròng tổng': minted.toString(),
      'Đã đốt (burn_ledger)': burned.toString(),
      'Tổng cung kỳ vọng (mint − đốt)': supplyExpected.toString(),
      'Σ ví user': bankrolls.toString(),
      'Pool đang treo (kèo open/locked)': escrow.toString(),
      'Kho bạc': treasury.toString(),
      'Tổng đang nắm giữ': holdings.toString(),
    },
  };
}
