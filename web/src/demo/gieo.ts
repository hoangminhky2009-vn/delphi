/**
 * BẢN DEMO — GIEO KHÁCH: một người chơi đã qua cửa (tuổi · vùng · nghề dạng khoảng, C7), phiên sống, ví cấp vốn đầu.
 * Cùng hình dạng dòng mà `tests/helpers/fixtures.ts` dựng — đi thẳng SQL vì thứ cần trải nghiệm là trò chơi, không phải
 * cái cửa đăng ký (cùng lý lẽ fixture, A8.9).
 *
 * ⚠ `research_consent = FALSE` CÓ CHỦ Ý: link demo "ko lưu dữ liệu, không phải link tester" — server tự không ghi
 * telemetry cho người chưa đồng ý (cổng ở `server/telemetry.ts`), nên khách demo không bao giờ thành một dòng nghiên cứu,
 * kể cả trong DB tạm của chính trang này.
 */
import type pg from 'pg';
import { ECONOMY } from '@config/economy';
import { generateToken, hashToken } from '@server/auth/crypto';
import { currentSeasonId } from '@server/season';

export async function gieoKhach(pool: pg.Pool): Promise<{ userId: string; token: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: u } = await client.query(
      `INSERT INTO users (handle, age_band, region, occupation_band, bankroll, quest_points, role, season_id, research_consent)
       VALUES ('khach', '18-22', 'nam', 'hs_sv', $1, 0, 'user', $2, FALSE) RETURNING user_id`,
      [String(ECONOMY.STARTING_BANKROLL), currentSeasonId()],
    );
    const userId = u[0].user_id as string;
    await client.query(
      `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason) VALUES ($1, $2, $2, 'signup_grant')`,
      [userId, String(ECONOMY.STARTING_BANKROLL)],
    );
    const { rows: a } = await client.query(
      `INSERT INTO auth_accounts (email, password_hash, email_verified_at, user_id)
       VALUES ('khach@demo.local', 'x', now(), $1) RETURNING account_id`,
      [userId],
    );
    const raw = generateToken();
    await client.query(
      `INSERT INTO auth_sessions (token_hash, account_id, expires_at) VALUES ($1, $2, now() + interval '30 days')`,
      [hashToken(raw), a[0].account_id],
    );
    await client.query('COMMIT');
    return { userId, token: raw };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
