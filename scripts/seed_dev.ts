/**
 * Seed dữ liệu DEV (GĐ1 việc 4): 3 kèo mẫu (mỗi pool 1 kèo, seed đệm chia đều),
 * 50 user giả, vài chục bet giả.
 *
 * CHỈ chạy ở môi trường dev (APP_ENV=dev) và CHỈ trên DB trắng (chưa có user).
 * RNG có seed cố định → chạy trên DB trắng luôn cho cùng một bộ dữ liệu.
 *
 * D10 (17/07/2026): chạy bootstrap_genesis TRƯỚC khi seed kèo — Kho bạc được
 * cấp vốn 20.000 T một lần, seed thanh khoản rút từ đó (treasury_ledger
 * seed_out qua treasuryAppend). Kho bạc không bao giờ âm.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type pg from 'pg';
import { createPool } from '../server/db.js';
import { treasuryAppend } from '../server/treasury.js';
import { bootstrapGenesis } from './bootstrap_genesis.js';
import { ECONOMY, applyBp } from '../config/economy.js';

const SEASON_ID = '2026Q3';

/** RNG tất định (mulberry32) để dữ liệu seed tái lập được. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260717);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;

const AGE_BANDS = ['16-17', '18-22', '23-30'] as const;
const REGIONS = ['bac', 'trung', 'nam', 'khac'] as const;
const OCCUPATIONS = ['hs_sv', 'van_phong', 'tu_do', 'khac'] as const;

interface MarketSpec {
  pool: 'macro' | 'life' | 'event';
  question: string;
  sourceName: string;
  sourceUrl: string;
  options: Array<{ label: string; low: number | null; high: number | null }>;
}

const MARKETS: MarketSpec[] = [
  {
    pool: 'macro',
    question: 'CPI cả nước tháng 7/2026 tăng bao nhiêu phần trăm so với cùng kỳ năm trước (YoY)?',
    sourceName: 'Tổng cục Thống kê (GSO)',
    sourceUrl: 'https://www.gso.gov.vn',
    options: [
      { label: 'Dưới 3,0%', low: null, high: 3.0 },
      { label: 'Từ 3,0% đến dưới 3,5%', low: 3.0, high: 3.5 },
      { label: 'Từ 3,5% đến dưới 4,0%', low: 3.5, high: 4.0 },
      { label: 'Từ 4,0% trở lên', low: 4.0, high: null },
    ],
  },
  {
    pool: 'life',
    question: 'Giá xăng RON95-III kỳ điều hành tới thay đổi thế nào so với kỳ hiện tại?',
    sourceName: 'Liên Bộ Công Thương – Tài chính',
    sourceUrl: 'https://moit.gov.vn',
    options: [
      { label: 'Tăng (trên +50đ/lít)', low: null, high: null },
      { label: 'Giữ (trong khoảng ±50đ/lít)', low: null, high: null },
      { label: 'Giảm (dưới −50đ/lít)', low: null, high: null },
    ],
  },
  {
    pool: 'event',
    question: 'Điểm chuẩn ngành Khoa học máy tính (IT1) ĐH Bách khoa Hà Nội năm 2026 là bao nhiêu?',
    sourceName: 'Đại học Bách khoa Hà Nội',
    sourceUrl: 'https://ts.hust.edu.vn',
    options: [
      { label: 'Dưới 28,0', low: null, high: 28.0 },
      { label: 'Từ 28,0 đến dưới 28,5', low: 28.0, high: 28.5 },
      { label: 'Từ 28,5 đến dưới 29,0', low: 28.5, high: 29.0 },
      { label: 'Từ 29,0 trở lên', low: 29.0, high: null },
    ],
  },
];

const SEED_PER_OPTION = 100n;

export async function seedDev(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT count(*)::int AS n FROM users');
    if (rows[0].n > 0) {
      throw new Error(
        'DB đã có dữ liệu — seed chỉ chạy trên DB trắng. Reset: tắt db:dev, xóa .local/pgdata, chạy lại db:dev + migrate.',
      );
    }

    // D10: cấp vốn Kho bạc trước khi seed kèo (idempotent, transaction riêng)
    await bootstrapGenesis(pool);

    await client.query('BEGIN');

    // 1) Admin (không nhận vốn khởi điểm — không tham gia cược)
    const adminRes = await client.query(
      `INSERT INTO users (handle, age_band, region, occupation_band, role, season_id)
       VALUES ('admin_root', '18-22', 'bac', 'khac', 'admin', $1)
       RETURNING user_id`,
      [SEASON_ID],
    );
    const adminId: string = adminRes.rows[0].user_id;

    // 2) 50 user giả: user + signup_grant qua ledger + event onboard_demo
    const userIds: string[] = [];
    const grant = BigInt(ECONOMY.STARTING_BANKROLL);
    for (let i = 1; i <= 50; i++) {
      const handle = `du_bao_${String(i).padStart(3, '0')}`;
      const u = await client.query(
        `INSERT INTO users (handle, age_band, region, occupation_band, bankroll, research_consent, season_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING user_id`,
        [handle, pick(AGE_BANDS), pick(REGIONS), pick(OCCUPATIONS), grant.toString(), rng() < 0.8, SEASON_ID],
      );
      const userId: string = u.rows[0].user_id;
      userIds.push(userId);
      await client.query(
        `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
         VALUES ($1, $2, $3, 'signup_grant')`,
        [userId, grant.toString(), grant.toString()],
      );
      await client.query(
        `INSERT INTO events (user_id, context_type, action_type, value_json)
         VALUES ($1, 'onboarding', 'onboard_demo', $2)`,
        [userId, JSON.stringify({ handle })],
      );
    }

    // 3) 3 kèo (mỗi pool 1 kèo), seed đệm CHIA ĐỀU mọi cửa (A3.6)
    const marketOptionIds: Array<{ marketId: string; optionIds: string[] }> = [];
    for (const spec of MARKETS) {
      const m = await client.query(
        `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url,
                              open_ts, lock_ts, resolve_deadline_ts, status, seed_per_option,
                              season_id, created_by)
         VALUES ($1, $2, $3, $4,
                 now() - interval '1 hour', now() + interval '7 days', now() + interval '8 days',
                 'open', $5, $6, $7)
         RETURNING market_id`,
        [spec.pool, spec.question, spec.sourceName, spec.sourceUrl, SEED_PER_OPTION.toString(), SEASON_ID, adminId],
      );
      const marketId: string = m.rows[0].market_id;
      const optionIds: string[] = [];
      for (let i = 0; i < spec.options.length; i++) {
        const o = spec.options[i]!;
        const or = await client.query(
          `INSERT INTO market_options (market_id, label, sort_order, range_low, range_high)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING option_id`,
          [marketId, o.label, i, o.low, o.high],
        );
        optionIds.push(or.rows[0].option_id);
      }
      // seed bets: mỗi cửa 1 dòng is_seed, amount bằng nhau tuyệt đối
      for (const optionId of optionIds) {
        await client.query(
          `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed)
           VALUES ($1, $2, NULL, $3, TRUE)`,
          [marketId, optionId, SEED_PER_OPTION.toString()],
        );
      }
      const seedTotal = SEED_PER_OPTION * BigInt(optionIds.length);
      await treasuryAppend(client, -seedTotal, 'seed_out', marketId);
      marketOptionIds.push({ marketId, optionIds });
    }

    // 4) Vài chục bet giả: 30 user đầu, mỗi user 1–2 kèo, tôn trọng cap 20% (A5.3)
    for (const userId of userIds.slice(0, 30)) {
      let bankroll = grant;
      const nMarkets = rng() < 0.4 ? 2 : 1;
      const shuffled = [...marketOptionIds].sort(() => rng() - 0.5);
      for (const { marketId, optionIds } of shuffled.slice(0, nMarkets)) {
        // cap tại thời điểm đặt: chưa đặt gì ở kèo này → floor(20% × bankroll)
        const cap = applyBp(bankroll, ECONOMY.BET_CAP_BP);
        const wanted = BigInt((2 + Math.floor(rng() * 19)) * 10); // 20..200
        const total = wanted < cap ? wanted : cap;
        if (total < BigInt(ECONOMY.MIN_BET)) continue;

        // rải 1–2 cửa
        const twoOptions = rng() < 0.35 && total >= 2n;
        const allocations: Array<{ optionId: string; amount: bigint }> = [];
        if (twoOptions) {
          const [o1, o2] = [...optionIds].sort(() => rng() - 0.5);
          const a1 = total / 2n;
          allocations.push({ optionId: o1!, amount: a1 }, { optionId: o2!, amount: total - a1 });
        } else {
          allocations.push({ optionId: pick(optionIds), amount: total });
        }

        for (const a of allocations) {
          await client.query(
            `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed)
             VALUES ($1, $2, $3, $4, FALSE)`,
            [marketId, a.optionId, userId, a.amount.toString()],
          );
        }
        bankroll -= total;
        await client.query('UPDATE users SET bankroll = $1 WHERE user_id = $2', [
          bankroll.toString(),
          userId,
        ]);
        await client.query(
          `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason, ref_market_id)
           VALUES ($1, $2, $3, 'bet_place', $4)`,
          [userId, (-total).toString(), bankroll.toString(), marketId],
        );
        // A3.3: bet đầu tiên ở kèo → user chưa từng thấy pool → snapshot null
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type, value_json, state_snapshot_json)
           VALUES ($1, 'market', $2, 'bet_place', $3, NULL)`,
          [
            userId,
            marketId,
            JSON.stringify({
              allocations: allocations.map((a) => ({ option_id: a.optionId, amount: a.amount.toString() })),
            }),
          ],
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Chốt an toàn CỨNG: seed chỉ được chạm DB trên máy này.
 *
 * Vì sao không tin mỗi APP_ENV: file .env dev có thể bị dán nhầm chuỗi kết nối
 * prod (đã xảy ra 17/07/2026) — lúc đó APP_ENV vẫn là 'dev' và seed sẽ bơm 50
 * user giả + 3 kèo giả vào DB thật, mà events/wallet_ledger là append-only nên
 * KHÔNG XÓA ĐƯỢC. Chặn theo HOST là thứ duy nhất không thể sai.
 */
export function isLocalDatabaseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  if ((process.env.APP_ENV ?? '') !== 'dev') {
    console.error('✖ seed_dev chỉ chạy khi APP_ENV=dev (bảo vệ production).');
    process.exit(1);
  }
  if (!isLocalDatabaseUrl(process.env.DATABASE_URL ?? '')) {
    console.error(
      '✖ CHẶN: DATABASE_URL không trỏ về máy này (127.0.0.1/localhost).\n' +
        '  seed_dev bơm dữ liệu GIẢ và events/ledger là append-only — không xóa được.\n' +
        '  Sửa .env về DB dev local rồi chạy lại.',
    );
    process.exit(1);
  }
  const pool = createPool();
  try {
    await seedDev(pool);
    console.log('✔ Seed dev xong: 1 admin + 50 user + 3 kèo (có seed đệm) + bets giả.');
    console.log('  Chạy `npm run audit:supply` để kiểm tra cân cung.');
  } finally {
    await pool.end();
  }
}
