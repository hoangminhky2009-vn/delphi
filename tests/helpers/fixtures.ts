/**
 * Fixtures GĐ3 — dựng user/market thẳng bằng SQL cho test markets/concurrency.
 *
 * Vì sao KHÔNG đi qua flow register/argon2: argon2id ~100ms/hash — 200 user
 * concurrency test sẽ mất 20s+ chỉ để băm mật khẩu, trong khi thứ cần test là
 * transaction đặt cược. Session vẫn là session THẬT (auth_sessions + sha256
 * token — resolveSession dùng nguyên đường code production); chỉ password_hash
 * là giả ('x') vì các test này không đăng nhập bằng mật khẩu.
 * Seed + genesis đi qua treasuryAppend THẬT — không mock đường tiền (A8.9).
 */
import type pg from 'pg';
import { generateToken, hashToken } from '../../server/auth/crypto.js';
import { sinhBiMat } from '../../server/auth/totp.js';
import { treasuryAppend } from '../../server/treasury.js';
import { ECONOMY } from '../../config/economy.js';
import { currentSeasonId } from '../../server/season.js';
import { AUTH } from '../../config/auth.js';
import { SEED_MAN_TAP_MOI_THOI } from '../../config/holdem.js';
import { CONSENT_PHIEN_BAN } from '../../config/pfm_consent.js';

let seq = 0;

export interface TestUser {
  userId: string;
  cookie: string;
  handle: string;
}

/**
 * User đã onboard + phiên sống. bankroll tùy chọn (mặc định 1.000).
 *
 * `questPoints` chỉ đặt được TẠI ĐÂY, và đó không phải tiện lợi — nó là hình dạng
 * thật của tường lửa sau 0015: `quest_points` chỉ được GIẢM, nên con đường duy nhất
 * để một người có Q là dòng `users` sinh ra đã có Q. Prod chưa có nguồn nào làm
 * chuyện đó (battle pass v0.3 mới có), nên quầy Q hiện đúng như nó là — hàng có giá,
 * chưa ai mua nổi. Test cần Q để chạy được đường mua thì phải nạp ở lúc INSERT.
 *
 * ⚠ HANDLE: bài trong `tests/` KHÔNG truyền `handle` — để fixture sinh handle duy nhất, cần
 * so/tìm thì đọc `u.handle`. CI chạy lại bài đỏ một lần (`vitest.config.ts`) trong CÙNG DB; handle gõ
 * cố định làm lượt chạy lại vấp `users_handle_key` (23505) thay vì đo lại (CI master 741f0dc0, 10/10).
 * Bài mà CHỮ của handle là dữ liệu (tìm theo chuỗi con, sắp theo handle) dùng `tienTo`: handle =
 * `<tienTo>_<seq>` — vẫn duy nhất, đuôi chỉ có số nên không đẻ thêm chuỗi con có chữ. `handle` còn
 * giữ cho `scripts/do_*` (DB riêng, chạy một lượt). Bài canh: `tests/handle_test_duy_nhat.test.ts`.
 */
export async function createTestUser(
  pool: pg.Pool,
  opts: {
    handle?: string; tienTo?: string; bankroll?: number; role?: 'user' | 'admin'; questPoints?: number;
  } = {},
): Promise<TestUser> {
  seq += 1;
  const handle = opts.handle
    ?? (opts.tienTo !== undefined ? `${opts.tienTo}_${seq}` : `u${seq}_${Math.random().toString(36).slice(2, 8)}`);
  if (!AUTH.HANDLE_PATTERN.test(handle)) throw new Error(`createTestUser: handle "${handle}" sai khuôn ${AUTH.HANDLE_PATTERN} — tienTo quá dài?`);
  const bankroll = BigInt(opts.bankroll ?? ECONOMY.STARTING_BANKROLL);
  const questPoints = BigInt(opts.questPoints ?? 0);
  const role = opts.role ?? 'user';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: uRows } = await client.query(
      /*
       * `research_consent = TRUE` mặc định trong FIXTURE (không phải trong DB —
       * cột vẫn mặc định FALSE, đồng ý vẫn là opt-in).
       *
       * Vì sao: từ 03/08 `POST /telemetry` KHÔNG ghi cho người chưa đồng ý
       * (cổng ở `server/telemetry.ts`). Nếu fixture để FALSE thì mọi test
       * telemetry đo đường "bị chặn" trong khi tên nó nói đang đo đường thường
       * — xanh mà chẳng chứng minh gì. Đường CHẶN có test riêng, đặt tên rõ.
       * ⚠ 0079 — đồng ý có hiệu lực cần cả SỐ BẢN hiện hành (`server/nghien_cuu.ts`); thiếu nó thì fixture lại là người "bật trước
       * khi có số bản" — bị coi như TẮT, và mọi bài telemetry/xếp hạng quay về đo đường bị chặn.
       */
      `INSERT INTO users (handle, age_band, region, occupation_band, bankroll,
                          quest_points, role, season_id, research_consent, research_consent_phien_ban)
       VALUES ($1, '18-22', 'bac', 'hs_sv', $2, $3, $4, $5, TRUE, $6) RETURNING user_id`,
      [handle, bankroll.toString(), questPoints.toString(), role, currentSeasonId(), CONSENT_PHIEN_BAN.nghien_cuu],
    );
    const userId: string = uRows[0].user_id;
    /*
     * ⚠ LUÔN ghi dòng `signup_grant`, KỂ CẢ khi bankroll = 0 (sửa 12/08).
     *
     * Bản cũ bỏ qua khi ví rỗng, và điều đó mô tả một trạng thái KHÔNG TỒN TẠI
     * ngoài đời: người thật nhận 1.000 T lúc onboard rồi tiêu về 0 vẫn GIỮ dòng
     * cấp vốn — sổ là append-only. Ví rỗng mà chưa từng có dòng nào chỉ xảy ra
     * với tài khoản CHƯA MỞ VÍ (khách, hoặc vào qua Discord).
     *
     * Phân biệt hai thứ đó nay là một phép kiểm an ninh thật: trợ cấp đòi "đã
     * từng được cấp vốn" chứ không đòi "đang nghèo" (xem `server/subsidy.ts`).
     * Fixture mô tả sai trạng thái thì bài test hoặc xanh giả, hoặc đỏ oan.
     */
    const von = BigInt(ECONOMY.STARTING_BANKROLL);
    await client.query(
      `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
       VALUES ($1, $2, $2, 'signup_grant')`,
      [userId, von.toString()],
    );
    if (bankroll !== von) {
      /*
       * ⚠ Bút toán bù, KHÔNG phải sửa dòng cấp vốn. Hai lý do, và cái thứ hai
       * mới là cái bắt buộc: (a) sổ là append-only nên đời thật cũng chỉ có cách
       * này; (b) `wallet_ledger_delta_check` CẤM delta = 0 — DB tự bác ý tưởng
       * "ghi một dòng cấp vốn rỗng cho có". Ràng buộc đó đúng: một dòng sổ phải
       * dịch chuyển thứ gì đó.
       */
      await client.query(
        `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
         VALUES ($1, $2, $3, 'admin_adjust')`,
        [userId, (bankroll - von).toString(), bankroll.toString()],
      );
    }
    const { rows: aRows } = await client.query(
      `INSERT INTO auth_accounts (email, password_hash, email_verified_at, user_id)
       VALUES ($1, 'x', now(), $2) RETURNING account_id`,
      [`${handle}@test.local`, userId],
    );
    const raw = generateToken();
    await client.query(
      `INSERT INTO auth_sessions (token_hash, account_id, expires_at)
       VALUES ($1, $2, now() + interval '1 day')`,
      [hashToken(raw), aRows[0].account_id],
    );
    await client.query('COMMIT');
    return { userId, cookie: `${AUTH.SESSION_COOKIE}=${raw}`, handle };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Đưa một admin QUA CỬA 2FA (0025) bằng SQL, cho các test KHÔNG phải về 2FA.
 *
 * Cùng lý lẽ với `createTestUser` không đi qua register/argon2: thứ đang được
 * test là VÒNG ĐỜI KÈO, không phải cái cửa. Bản thân cái cửa được kiểm trọn vẹn
 * qua HTTP thật ở `tests/admin_2fa.test.ts` — nên ở đây dựng sẵn tiền đề là
 * đúng vai, không phải né thiết kế (A8.9).
 *
 * ⚠ KHÔNG gộp vào `createTestUser({role:'admin'})`. Gộp thì cổng 2FA trở nên vô
 * hình với mọi test tương lai, và bất biến "mọi route admin khoá khi chưa 2FA"
 * (§II của admin_2fa.test.ts) không còn dựng được trạng thái để kiểm.
 */
export async function moCuaAdmin(
  pool: pg.Pool,
  u: TestUser | string,
  opts: { xacThucLai?: boolean } = {},
): Promise<void> {
  // Nhận cả TestUser (fixture) lẫn email thô (test đi qua register/login thật).
  const email = typeof u === 'string' ? u.toLowerCase() : `${u.handle}@test.local`;
  await pool.query(
    `UPDATE auth_accounts SET totp_secret = $2, totp_confirmed_at = now() WHERE email = $1`,
    [email, sinhBiMat()],
  );
  await pool.query(
    `UPDATE auth_sessions s
        SET admin_xac_thuc_luc = now(),
            xac_thuc_lai_luc   = CASE WHEN $2 THEN now() ELSE NULL END
       FROM auth_accounts a
      WHERE a.account_id = s.account_id AND a.email = $1`,
    [email, opts.xacThucLai ?? true],
  );
}

/**
 * D370 — ĐÃ CHƠI XONG BÀN TẬP: tiền đề để vào trận của BÀN BUỔI ĐO.
 *
 * Cửa ở `holdem_api.ts` hỏi đúng một câu: ghế này có `holdem_matches` nào `status='xong'` mang
 * seed bàn tập không (`SEED_MAN_TAP_MOI_THOI`). Founder chốt 22/09: **luật mới đúng** — người
 * chưa thấy cơ chế nào mà vào thẳng thì số của họ đo sự bỡ ngỡ, không đo hành vi tài chính.
 *
 * ⚠ VÌ SAO DỰNG BẰNG SQL CHỨ KHÔNG CHƠI THẬT MỘT BÀN TẬP (A8.9 — dựng tiền đề, không né thiết
 * kế): CHÍNH cửa ấy đã có bài canh đi qua đường thật ở `tests/buoi_do_tu_phuc_vu.test.ts` §III,
 * cả hai chiều (chưa tập ⇒ 409 `chua_xong_ban_tap`; tập xong ⇒ vào được). Những bài GỌI hàm này
 * đo chuyện khác (luật của bàn · mã tham gia · trang nhóm · số đếm màn điều phối), và bắt mỗi
 * ghế của chúng chơi hết 12 vòng chỉ để qua cửa là cộng hàng phút vào bộ test mà không canh thêm
 * được gì. Một bài canh cửa, nhiều bài mượn tiền đề — không phải hai bản cài đặt của cùng luật.
 *
 * ⚠ CỐ Ý KHÔNG ghi `holdem_results`: `so_tran_xong` (mở map 12, luật dắt-vào-bàn-tập D336) đếm
 * bảng ĐÓ, không đếm bảng này. Ghi thêm là lặng lẽ đổi tiền đề của những bài không liên quan.
 */
export async function xongBanTap(pool: pg.Pool, u: TestUser | string): Promise<void> {
  const userId = typeof u === 'string' ? u : u.userId;
  await pool.query(
    `INSERT INTO holdem_matches
       (owner_user_id, seed, ghe_json, engine_version, balance_version, season_id, che_do, status)
     VALUES ($1, $2, '[]'::jsonb, 'test', 'test', $3, 'tu_do', 'xong')`,
    [userId, SEED_MAN_TAP_MOI_THOI[0], currentSeasonId()],
  );
}

/** Genesis Kho bạc một lần mỗi DB test (idempotent). */
export async function ensureGenesis(pool: pg.Pool): Promise<void> {
  const { rows } = await pool.query(
    `SELECT 1 FROM treasury_ledger WHERE reason = 'genesis_grant'`,
  );
  if (rows.length > 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await treasuryAppend(client, BigInt(ECONOMY.TREASURY_GENESIS), 'genesis_grant', null);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export interface TestMarket {
  marketId: string;
  optionIds: string[];
}

/**
 * Kèo open + N cửa; seed (nếu có) CHIA ĐỀU mỗi cửa, rút từ Kho bạc qua
 * treasuryAppend (seed_out) — audit_supply phải CÂN sau khi tạo.
 */
export async function createTestMarket(
  pool: pg.Pool,
  opts: {
    createdBy: string;
    optionCount?: number;
    seedPerOption?: number;
    lockInSeconds?: number;
    pool?: 'macro' | 'life' | 'event';
    status?: 'open' | 'locked';
  },
): Promise<TestMarket> {
  const optionCount = opts.optionCount ?? 3;
  const seedPerOption = BigInt(opts.seedPerOption ?? 0);
  const lockInSeconds = opts.lockInSeconds ?? 3600;
  const marketPool = opts.pool ?? 'life';
  const status = opts.status ?? 'open';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: mRows } = await client.query(
      `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url,
                            open_ts, lock_ts, resolve_deadline_ts, status, seed_per_option,
                            season_id, created_by)
       VALUES ($1, $2, 'Nguồn Test', 'https://test.local/nguon',
               now() - interval '1 hour', now() + ($3 || ' seconds')::interval,
               now() + ($3 || ' seconds')::interval + interval '1 day', $4, $5, $6, $7)
       RETURNING market_id`,
      [
        marketPool,
        `Kèo test ${++seq}?`,
        lockInSeconds,
        status,
        seedPerOption.toString(),
        currentSeasonId(),
        opts.createdBy,
      ],
    );
    const marketId: string = mRows[0].market_id;

    const optionIds: string[] = [];
    for (let i = 0; i < optionCount; i++) {
      const { rows } = await client.query(
        `INSERT INTO market_options (market_id, label, sort_order)
         VALUES ($1, $2, $3) RETURNING option_id`,
        [marketId, `Cửa ${i + 1}`, i],
      );
      optionIds.push(rows[0].option_id);
    }

    if (seedPerOption > 0n) {
      // Rút Kho bạc TRƯỚC (fail rõ nếu không đủ quỹ — A3.4), rồi rải seed đều
      await treasuryAppend(client, -seedPerOption * BigInt(optionCount), 'seed_out', marketId);
      for (const optionId of optionIds) {
        await client.query(
          `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed)
           VALUES ($1, $2, NULL, $3, TRUE)`,
          [marketId, optionId, seedPerOption.toString()],
        );
      }
    }

    await client.query('COMMIT');
    return { marketId, optionIds };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
