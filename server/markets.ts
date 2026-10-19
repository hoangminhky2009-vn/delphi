/**
 * GĐ3 — API chợ kèo + đặt cược (lõi parimutuel server-side).
 *
 * Luật cứng enforce Ở ĐÂY (tầng API — không phải UI):
 *   * A3.1 ẨN POOL: user CHƯA đặt kèo X → response KHÔNG CHỨA trường phân bố
 *     (vắng hẳn key `distribution`, không phải null/0). Lần đầu thấy phân bố
 *     → event `pool_reveal` đúng MỘT lần mỗi user mỗi kèo.
 *   * C4 server-authoritative: mọi số (cap, delta, pct, tỷ lệ ăn) tính server.
 *   * C5: tiền là BigInt, floor một lần (hàm thuần server/parimutuel.ts).
 *   * A3.3/A7: event ghi CÙNG transaction với hành động nghiệp vụ.
 *
 * Aggregate đọc on-the-fly từ `bets` (nguồn chân lý duy nhất — A3.10, tránh
 * hot-row đếm trùng; profiling sau này cần thì thêm materialized bằng migration).
 */
import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import type pg from 'pg';
import { ECONOMY } from '../config/economy.js';
import {
  buildDistribution,
  compactSnapshot,
  computeCap,
  validateAllocations,
} from './parimutuel.js';
import { UUID_RE } from './uuid.js';

import type { Env, Mw as Middleware } from './http/types.js';

/** Lỗi nghiệp vụ có mã — map ra HTTP tại một chỗ. */
class BetError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface MarketRow {
  market_id: string;
  pool: string;
  question_text: string;
  resolution_source_name: string;
  resolution_source_url: string;
  open_ts: Date;
  lock_ts: Date;
  resolve_deadline_ts: Date;
  status: string;
  seed_per_option: bigint;
}

/** Volume theo cửa của MỘT kèo (gồm seed) — mọi cửa đều có mặt (0n nếu trống). */
async function optionVolumes(
  db: pg.Pool | pg.PoolClient,
  marketId: string,
): Promise<Map<string, bigint>> {
  const { rows } = await db.query(
    `SELECT o.option_id, COALESCE(SUM(b.amount), 0) AS volume
       FROM market_options o
       LEFT JOIN bets b ON b.option_id = o.option_id
      WHERE o.market_id = $1
      GROUP BY o.option_id, o.sort_order
      ORDER BY o.sort_order`,
    [marketId],
  );
  const map = new Map<string, bigint>();
  for (const r of rows) map.set(r.option_id, BigInt(r.volume));
  return map;
}

/** Phân bổ hiện tại của user trên kèo (không gồm seed). */
async function myAllocation(
  db: pg.Pool | pg.PoolClient,
  userId: string,
  marketId: string,
): Promise<Map<string, bigint>> {
  const { rows } = await db.query(
    `SELECT option_id, amount FROM bets
      WHERE user_id = $1 AND market_id = $2 AND NOT is_seed`,
    [userId, marketId],
  );
  const map = new Map<string, bigint>();
  for (const r of rows) map.set(r.option_id, r.amount as bigint);
  return map;
}

const allocArray = (m: Map<string, bigint>) =>
  [...m.entries()].map(([option_id, amount]) => ({ option_id, amount: Number(amount) }));

/**
 * Dựng ĐÚNG payload mà một người chơi cụ thể nhìn thấy ở màn chi tiết kèo.
 *
 * ⚠ TÁCH RA ĐỂ CÓ MỘT NGUỒN DUY NHẤT (bước 4, §5 "xem trước đúng thứ người
 * chơi đang thấy"). Nếu màn xem trước của admin dựng payload bằng một đoạn code
 * THỨ HAI thì hai đoạn sẽ trôi khỏi nhau, và lúc đó công cụ kiểm A3.1 lại là
 * thứ nói dối về A3.1 — tệ hơn hẳn không có nó.
 *
 * `userId = null` ⇒ góc nhìn "người CHƯA đặt gì": không `distribution`, không
 * `my_allocation`. Đây chính là góc nhìn A3.1 bảo vệ.
 *
 * KHÔNG ghi event ở đây: `market_view` là hành vi của NGƯỜI CHƠI, và admin ngó
 * qua không phải một lượt xem. Route người chơi tự ghi sau khi gọi hàm này.
 */
export async function dungChiTietKeo(
  pool: pg.Pool,
  marketId: string,
  userId: string | null,
): Promise<{ body: Record<string, unknown>; volumes: Map<string, bigint>; hasBet: boolean } | null> {
  const { rows: mRows } = await pool.query(
    `SELECT market_id, pool, question_text, resolution_source_name, resolution_source_url,
            open_ts, lock_ts, resolve_deadline_ts, status, seed_per_option,
            outcome_option_id, resolution_note, resolved_ts
       FROM markets WHERE market_id = $1 AND status <> 'draft'`,
    [marketId],
  );
  if (mRows.length === 0) return null;
  const m = mRows[0] as MarketRow;

  const { rows: optRows } = await pool.query(
    `SELECT option_id, label, sort_order, range_low, range_high
       FROM market_options WHERE market_id = $1 ORDER BY sort_order`,
    [marketId],
  );

  const [volumes, mine, aggRow, bankrollRow] = await Promise.all([
    optionVolumes(pool, marketId),
    userId === null
      ? Promise.resolve(new Map<string, bigint>())
      : myAllocation(pool, userId, marketId),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_volume,
              COALESCE(SUM(amount) FILTER (WHERE is_seed), 0) AS seed_total
         FROM bets WHERE market_id = $1`,
      [marketId],
    ),
    userId === null
      ? Promise.resolve({ rows: [{ bankroll: 0n }] })
      : pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [userId]),
  ]);
  const agg = aggRow.rows[0];
  const bankroll = bankrollRow.rows[0].bankroll as bigint;
  const hasBet = mine.size > 0;
  let totalMine = 0n;
  for (const [, v] of mine) totalMine += v;

  // A3.1: object CƠ SỞ không có key distribution — chỉ thêm khi hasBet
  const body: Record<string, unknown> = {
    market_id: m.market_id,
    pool: m.pool,
    question_text: m.question_text,
    resolution_source_name: m.resolution_source_name,
    resolution_source_url: m.resolution_source_url,
    open_ts: m.open_ts,
    lock_ts: m.lock_ts,
    resolve_deadline_ts: m.resolve_deadline_ts,
    status: m.status,
    seed_per_option: Number(m.seed_per_option),
    // Kèo đã chốt (resolved/cancelled): công khai cửa thắng + ghi chú nguồn
    // (A3.2 — bộ mặt "resolution thiêng liêng"); null khi chưa chốt
    outcome_option_id: (m as any).outcome_option_id ?? null,
    resolution_note: (m as any).resolution_note ?? null,
    resolved_ts: (m as any).resolved_ts ?? null,
    options: optRows.map((o) => ({
      option_id: o.option_id,
      label: o.label,
      sort_order: o.sort_order,
      range_low: o.range_low,
      range_high: o.range_high,
    })),
    // KHÔNG trả số người tham gia (founder 19/07 — sửa A3.1)
    total_volume: Number(agg.total_volume),
    seed_total: Number(agg.seed_total),
    my_allocation: allocArray(mine),
    bankroll: Number(bankroll),
    bet_cap: Number(computeCap(bankroll, totalMine)),
  };
  if (hasBet) body.distribution = buildDistribution(volumes);
  return { body, volumes, hasBet };
}

export function registerMarketRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: { requireAuth: Middleware; requireOnboarded: Middleware },
): void {
  const { requireAuth, requireOnboarded } = mw;

  // =========================================================================
  // GET /api/v1/markets — sảnh kèo. KHÔNG BAO GIỜ có phân bố per-option ở đây
  // (kể cả user đã đặt) — sảnh chỉ hiện tổng người tham gia + tổng volume.
  // =========================================================================
  app.get('/api/v1/markets', requireAuth, requireOnboarded, async (c) => {
    const poolFilter = c.req.query('pool');
    const statusFilter = c.req.query('status');
    if (poolFilter && !['macro', 'life', 'event'].includes(poolFilter)) {
      return c.json({ error: 'invalid_input', field: 'pool', message: 'pool không hợp lệ.' }, 400);
    }
    const statuses = statusFilter
      ? statusFilter.split(',').filter((s) => ['open', 'locked', 'resolved', 'cancelled'].includes(s))
      : ['open', 'locked'];
    if (statuses.length === 0) {
      return c.json({ error: 'invalid_input', field: 'status', message: 'status không hợp lệ.' }, 400);
    }

    const params: unknown[] = [statuses];
    let where = `m.status = ANY($1)`;
    if (poolFilter) {
      params.push(poolFilter);
      where += ` AND m.pool = $2`;
    }
    const { rows } = await pool.query(
      `SELECT m.market_id, m.pool, m.question_text, m.resolution_source_name,
              m.resolution_source_url, m.open_ts, m.lock_ts, m.status, m.seed_per_option,
              COALESCE(SUM(b.amount), 0) AS total_volume
         FROM markets m
         LEFT JOIN bets b ON b.market_id = m.market_id
        WHERE ${where}
        GROUP BY m.market_id
        ORDER BY m.lock_ts ASC`,
      params,
    );
    return c.json({
      markets: rows.map((m) => ({
        market_id: m.market_id,
        pool: m.pool,
        question_text: m.question_text,
        resolution_source_name: m.resolution_source_name,
        resolution_source_url: m.resolution_source_url,
        open_ts: m.open_ts,
        lock_ts: m.lock_ts,
        status: m.status,
        seed_per_option: Number(m.seed_per_option),
        // KHÔNG trả số người tham gia (quyết định founder 19/07 — sửa A3.1)
        total_volume: Number(m.total_volume),
      })),
    });
  });

  // =========================================================================
  // GET /api/v1/markets/:id — chi tiết kèo. Ẩn pool A3.1 tầng API.
  // Ghi event market_view (KHÔNG ghi ở /pool poll — tránh phình events).
  // =========================================================================
  app.get('/api/v1/markets/:id', requireAuth, requireOnboarded, async (c) => {
    const marketId = c.req.param('id');
    const actor = c.get('actor');
    if (!UUID_RE.test(marketId)) {
      return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    }

    /*
     * Payload dựng bởi `dungChiTietKeo` — CÙNG hàm mà màn xem trước của admin
     * gọi (§5). Một nguồn duy nhất: hai đoạn code song song sẽ trôi khỏi nhau,
     * và lúc đó công cụ kiểm A3.1 lại là thứ nói dối về A3.1.
     */
    const dung = await dungChiTietKeo(pool, marketId, actor.userId!);
    if (dung === null) {
      return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    }
    const { body, volumes, hasBet } = dung;
    const m = body as { pool: string; status: string };

    /*
     * Event market_view — snapshot = cái user ĐANG thấy (null nếu pool chưa reveal)
     *
     * ⚠⚠ CÓ PHANH (thêm 12/08). Đây từng là endpoint DUY NHẤT ghi `events` mà
     * không giới hạn gì: một tài khoản khách + một vòng lặp curl là bơm được
     * dòng vào bảng APPEND-ONLY bằng request rẻ nhất có thể — một GET. Holdem,
     * telemetry, rank, đăng ký, đổi tên đều đã có phanh; bề mặt điều hướng NÓNG
     * NHẤT thì bỏ trống.
     *
     * Hại nặng hơn dung lượng: nó PHA LOÃNG VĨNH VIỄN chỉ số "thời gian cân
     * nhắc" (khoảng giữa `market_view` và `bet_place`) và mọi phép đo phễu, mà
     * không cột nào tách được lượt xem giả khỏi thật về sau (A3.3).
     *
     * ⚠ CHẶN THEO CỬA SỔ NGẮN, KHÔNG GỘP THEO NGÀY. Nếp có sẵn của repo là gộp
     * một dòng mỗi ngày (`nv_view`), nhưng ở đây làm thế là hỏng chính chỉ số:
     * thứ cần đo là lượt xem GẦN CÚ ĐẶT nhất, mà gộp-theo-ngày chỉ giữ lượt
     * ĐẦU ngày. Cửa sổ ngắn giữ được mọi lần cân nhắc thật (người ta không cân
     * nhắc lại trong vòng một phút) và vẫn cắt vòi.
     *
     * ⚠⚠ VÀ PHANH PHẢI BIẾT PHÂN BIỆT ẢNH CHỤP, KHÔNG CHỈ ĐẾM GIÂY. Bản phanh
     * đầu chặn thuần theo thời gian, và nó làm ĐỎ bài test A3.1 — đúng bài canh
     * "ảnh chụp phản ánh cái user ĐANG thấy": null trước khi reveal, có phân bố
     * ngay sau cú đặt đầu. Hai lượt xem đó cách nhau vài giây, nên phanh thời
     * gian thuần nuốt mất lượt thứ hai — tức nuốt đúng KHOẢNH KHẮC REVEAL, dòng
     * đắt nhất của cả cụm (A3.1 dựng nó để đo hiệu ứng bầy đàn).
     * ⇒ Chỉ bỏ qua khi ảnh chụp GIỐNG HỆT lần trước trong cửa sổ. Vòng lặp curl
     * thấy y một ảnh nên bị cắt; mọi lần bảng THAY ĐỔI vẫn được ghi. Ảnh chụp do
     * máy chủ tính từ trạng thái pool, người gọi không nắn được (C4).
     *
     * (Ghi thêm: đợt săn 12/08 xếp bài test kia là "chốt cứng hành vi sai". Nó
     * đọc nhầm — bài đó không đòi "2 GET ⇒ 2 dòng", nó đòi ảnh chụp phải đổi khi
     * cái người ta thấy đổi. Bài test đúng, bản vá đầu của tôi mới sai.)
     *
     * Làm trong CHÍNH câu INSERT: một vòng, một kết nối (C1, pool max 1 trên
     * prod). Đua ghi ở đây chỉ làm ra 2 dòng thay vì 1 — chấp nhận được, vì đây
     * là cái PHANH chứ không phải một phép kiểm an toàn.
     */
    await pool.query(
      `INSERT INTO events (user_id, context_type, context_id, action_type, value_json,
                           state_snapshot_json)
       SELECT $1, 'market', $2, 'market_view', $3, $4
        WHERE NOT EXISTS (
          SELECT 1 FROM events
           WHERE user_id = $1 AND context_id = $2 AND action_type = 'market_view'
             AND ts > now() - interval '60 seconds'
             AND state_snapshot_json IS NOT DISTINCT FROM $4::jsonb
        )`,
      [
        actor.userId,
        marketId,
        JSON.stringify({ pool: m.pool, status: m.status }),
        hasBet ? JSON.stringify(compactSnapshot(volumes)) : null,
      ],
    );

    return c.json(body);
  });

  // =========================================================================
  // GET /api/v1/markets/:id/pool — snapshot nhẹ cho polling bậc thang (D11).
  // CHỈ user đã đặt; chưa đặt → 403 (không rò rỉ qua đường vòng).
  // Cache private (per-user) — KHÔNG cho CDN cache chung (sẽ phá A3.1).
  // =========================================================================
  app.get('/api/v1/markets/:id/pool', requireAuth, requireOnboarded, async (c) => {
    const marketId = c.req.param('id');
    const actor = c.get('actor');
    if (!UUID_RE.test(marketId)) {
      return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    }
    const { rows: mRows } = await pool.query(
      `SELECT status, lock_ts FROM markets WHERE market_id = $1 AND status <> 'draft'`,
      [marketId],
    );
    if (mRows.length === 0) {
      return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    }

    const mine = await myAllocation(pool, actor.userId!, marketId);
    if (mine.size === 0) {
      return c.json(
        { error: 'pool_hidden', message: 'Bạn cần đặt kèo này trước khi xem phân bố.' },
        403,
      );
    }

    const volumes = await optionVolumes(pool, marketId);
    const { rows: aggRows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_volume FROM bets WHERE market_id = $1`,
      [marketId],
    );
    c.header('Cache-Control', 'private, max-age=5');
    return c.json({
      market_id: marketId,
      status: mRows[0].status,
      lock_ts: mRows[0].lock_ts,
      // KHÔNG trả số người tham gia (founder 19/07 — sửa A3.1)
      total_volume: Number(aggRows[0].total_volume),
      distribution: buildDistribution(volumes),
    });
  });

  // =========================================================================
  // POST /api/v1/markets/:id/bets — đặt/điều chỉnh DECLARATIVE, MỘT transaction.
  // =========================================================================
  app.post('/api/v1/markets/:id/bets', requireAuth, requireOnboarded, async (c) => {
    const marketId = c.req.param('id');
    const actor = c.get('actor');
    const userId = actor.userId!;
    if (!UUID_RE.test(marketId)) {
      return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    }

    // ---- Validate shape NGOÀI transaction (reject rẻ) ----
    const body = await c.req.json().catch(() => null);
    const rawKey = (body as any)?.idempotency_key;
    if (typeof rawKey !== 'string' || rawKey.length < 8 || rawKey.length > 128) {
      return c.json(
        { error: 'invalid_input', field: 'idempotency_key', message: 'Thiếu idempotency_key (8–128 ký tự).' },
        400,
      );
    }
    const rawAllocs = (body as any)?.allocations;
    if (!Array.isArray(rawAllocs) || rawAllocs.length === 0 || rawAllocs.length > 20) {
      return c.json(
        { error: 'invalid_input', field: 'allocations', message: 'allocations phải là mảng 1–20 phần tử.' },
        400,
      );
    }
    const newAllocations = new Map<string, bigint>();
    for (const a of rawAllocs) {
      const optionId = a?.option_id;
      const amount = a?.amount;
      if (typeof optionId !== 'string' || !UUID_RE.test(optionId)) {
        return c.json({ error: 'invalid_input', field: 'option_id', message: 'option_id không hợp lệ.' }, 400);
      }
      if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0) {
        return c.json(
          { error: 'invalid_input', field: 'amount', message: 'amount phải là số nguyên ≥ 0.' },
          400,
        );
      }
      if (newAllocations.has(optionId)) {
        return c.json({ error: 'invalid_input', field: 'allocations', message: 'option_id bị lặp.' }, 400);
      }
      newAllocations.set(optionId, BigInt(amount));
    }
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          market_id: marketId,
          allocations: [...newAllocations.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([o, v]) => [o, v.toString()]),
        }),
      )
      .digest('hex');

    // (0) Kèo phải TỒN TẠI trước khi chèn intent (FK) — 404 không có side effect
    //     nên không cần idempotency; kiểm bettable chính thức vẫn nằm SAU row lock.
    const { rows: preRows } = await pool.query(
      `SELECT 1 FROM markets WHERE market_id = $1 AND status <> 'draft'`,
      [marketId],
    );
    if (preRows.length === 0) {
      return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // THỨ TỰ KHÓA TOÀN HỆ (chống deadlock — GĐ4): KÈO trước → VÍ sau → intent.
      //   * Bet:     markets FOR SHARE  → users FOR UPDATE → INSERT intent
      //   * Resolve: markets FOR UPDATE → users FOR UPDATE (sort user_id)
      //   Cùng chiều kèo→ví nên bet vs resolve không bao giờ chờ vòng nhau;
      //   FOR SHARE giữa các better tương thích nhau, chỉ bắt UPDATE của
      //   scheduler/resolve xếp hàng sau các bet đang bay.
      //   Intent PHẢI nằm SAU khóa ví: FK của intent lấy FOR KEY SHARE dòng user
      //   — chèn trước là hai tx cùng user kẹt 40P01 (đã tái hiện bằng test).

      // (1) KIỂM KÈO + giữ FOR SHARE — deadline-critical: giờ SERVER, so trong DB
      const { rows: mRows } = await client.query(
        `SELECT status, lock_ts, (status = 'open' AND lock_ts > now()) AS bettable
           FROM markets WHERE market_id = $1 AND status <> 'draft'
           FOR SHARE`,
        [marketId],
      );
      if (mRows.length === 0) throw new BetError(404, 'not_found', 'Không có kèo này.');
      if (!mRows[0].bettable) {
        throw new BetError(409, 'market_locked', 'Kèo đã khóa hoặc không còn nhận phân bổ.');
      }

      // (2) ROW LOCK ví — một writer tiền duy nhất mỗi user (chống double-spend
      //     song song CÙNG kèo lẫn CHÉO kèo — bankroll là tài nguyên chung)
      const { rows: uRows } = await client.query(
        `SELECT bankroll FROM users WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      const bankroll = uRows[0].bankroll as bigint;

      // (3) IDEMPOTENCY — chèn intent; trùng key → xử theo bản đã lưu
      const ins = await client.query(
        `INSERT INTO bet_intents (idempotency_key, user_id, market_id, request_hash)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING idempotency_key`,
        [rawKey, userId, marketId, requestHash],
      );
      if (ins.rowCount === 0) {
        const { rows } = await client.query(
          `SELECT user_id, request_hash, response_json FROM bet_intents WHERE idempotency_key = $1`,
          [rawKey],
        );
        const intent = rows[0];
        await client.query('ROLLBACK');
        if (!intent || intent.user_id !== userId || intent.request_hash !== requestHash) {
          return c.json(
            { error: 'idempotency_conflict', message: 'idempotency_key đã dùng cho một yêu cầu khác.' },
            409,
          );
        }
        if (intent.response_json === null) {
          // Không thể xảy ra với tx nguyên khối (intent + hiệu lực commit cùng nhau);
          // phòng hờ: bảo client thử lại sau.
          return c.json({ error: 'in_flight', message: 'Yêu cầu đang xử lý. Thử lại sau.' }, 409);
        }
        return c.json({ ...intent.response_json, replayed: true });
      }

      // Mọi option trong allocations phải thuộc kèo này
      const { rows: optRows } = await client.query(
        `SELECT option_id FROM market_options WHERE market_id = $1`,
        [marketId],
      );
      const validOptions = new Set<string>(optRows.map((r) => r.option_id));
      for (const [optionId] of newAllocations) {
        if (!validOptions.has(optionId)) {
          throw new BetError(400, 'invalid_option', 'Có cửa không thuộc kèo này.');
        }
      }

      // (4) HIỆN TRẠNG + snapshot phân bố user ĐANG THẤY (trước hành động)
      const oldAllocations = await myAllocation(client, userId, marketId);
      const hasBet = oldAllocations.size > 0;
      const preVolumes = await optionVolumes(client, marketId);

      // (5) KIỂM NGHIỆP VỤ — hàm thuần (no-withdraw, min bet, cap A5.3, balance)
      const verdict = validateAllocations({ newAllocations, oldAllocations, bankroll });
      if (!verdict.ok) throw new BetError(400, verdict.code, verdict.message);

      // (6) ÁP PHÂN BỔ MỚI (declarative): upsert cửa >0, xóa cửa về 0
      for (const [optionId, amount] of newAllocations) {
        if (amount > 0n) {
          await client.query(
            `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed)
             VALUES ($1, $2, $3, $4, FALSE)
             ON CONFLICT (user_id, market_id, option_id) WHERE NOT is_seed
             DO UPDATE SET amount = EXCLUDED.amount, updated_at = now()`,
            [marketId, optionId, userId, amount.toString()],
          );
        } else if (oldAllocations.has(optionId)) {
          await client.query(
            `DELETE FROM bets WHERE user_id = $1 AND market_id = $2 AND option_id = $3 AND NOT is_seed`,
            [userId, marketId, optionId],
          );
        }
      }
      // Cửa cũ không nhắc trong allocations mới → giữ nguyên? KHÔNG — declarative
      // nghĩa là "phân bổ mới TOÀN KÈO": cửa cũ vắng mặt = xóa (về 0).
      for (const [optionId] of oldAllocations) {
        if (!newAllocations.has(optionId)) {
          await client.query(
            `DELETE FROM bets WHERE user_id = $1 AND market_id = $2 AND option_id = $3 AND NOT is_seed`,
            [userId, marketId, optionId],
          );
        }
      }

      // (7) TIỀN — chỉ khi tổng tăng (reallocation thuần không sinh bút toán;
      //     wallet_ledger CHECK delta <> 0)
      let bankrollAfter = bankroll;
      if (verdict.netDelta > 0n) {
        bankrollAfter = bankroll - verdict.netDelta;
        await client.query(`UPDATE users SET bankroll = $1 WHERE user_id = $2`, [
          bankrollAfter.toString(),
          userId,
        ]);
        await client.query(
          `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason, ref_market_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            userId,
            (-verdict.netDelta).toString(),
            bankrollAfter.toString(),
            hasBet ? 'bet_adjust' : 'bet_place',
            marketId,
          ],
        );
      }

      // (8) EVENT nghiệp vụ — snapshot = phân bố user THẤY ngay trước hành động
      //     (null nếu đây là bet đầu — pool chưa từng reveal với user này)
      const postVolumes = await optionVolumes(client, marketId);
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type, value_json,
                             state_snapshot_json)
         VALUES ($1, 'market', $2, $3, $4, $5)`,
        [
          userId,
          marketId,
          hasBet ? 'bet_adjust' : 'bet_place',
          JSON.stringify({
            allocations: allocArray(newAllocations),
            net_delta: Number(verdict.netDelta),
          }),
          hasBet ? JSON.stringify(compactSnapshot(preVolumes)) : null,
        ],
      );

      // (9) POOL_REVEAL — đúng MỘT lần, tại lần đặt đầu; snapshot = phân bố
      //     SAU khi gộp bet này (đúng cái user sẽ thấy từ giờ — đo herd)
      if (!hasBet) {
        await client.query(
          `INSERT INTO events (user_id, context_type, context_id, action_type,
                               state_snapshot_json)
           VALUES ($1, 'market', $2, 'pool_reveal', $3)`,
          [userId, marketId, JSON.stringify(compactSnapshot(postVolumes))],
        );
      }

      // (10) RESPONSE + lưu vào intent (replay trả đúng bản này)
      const { rows: aggRows } = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_volume FROM bets WHERE market_id = $1`,
        [marketId],
      );
      const response = {
        ok: true,
        market_id: marketId,
        bankroll: Number(bankrollAfter),
        my_allocation: allocArray(newAllocations).filter((a) => a.amount > 0),
        bet_total_mine: Number(verdict.totalNew),
        bet_cap: Number(computeCap(bankrollAfter, verdict.totalNew)),
        // KHÔNG trả số người tham gia (founder 19/07 — sửa A3.1)
        total_volume: Number(aggRows[0].total_volume),
        distribution: buildDistribution(postVolumes),
      };
      await client.query(`UPDATE bet_intents SET response_json = $1 WHERE idempotency_key = $2`, [
        JSON.stringify(response),
        rawKey,
      ]);

      await client.query('COMMIT');
      return c.json(response);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err instanceof BetError) {
        return c.json({ error: err.code, message: err.message }, err.status);
      }
      throw err;
    } finally {
      client.release();
    }
  });

  // =========================================================================
  // GET /api/v1/wallet — số dư + lịch sử ledger phân trang (mới → cũ)
  // =========================================================================
  app.get('/api/v1/wallet', requireAuth, requireOnboarded, async (c) => {
    const actor = c.get('actor');
    const limitRaw = Number(c.req.query('limit') ?? 20);
    const limit = Number.isInteger(limitRaw) && limitRaw >= 1 && limitRaw <= 100 ? limitRaw : 20;
    const before = c.req.query('before');
    const reason = c.req.query('reason');

    const params: unknown[] = [actor.userId];
    let where = `user_id = $1`;
    // Tối đa 18 chữ số — quá nữa là tràn BIGINT phía Postgres (lỗi 22003 → 500)
    if (before && /^\d{1,18}$/.test(before)) {
      params.push(before);
      where += ` AND entry_id < $${params.length}`;
    }
    if (reason) {
      params.push(reason);
      where += ` AND reason = $${params.length}`;
    }
    params.push(limit);

    const [{ rows: uRows }, { rows: eRows }] = await Promise.all([
      pool.query(`SELECT bankroll FROM users WHERE user_id = $1`, [actor.userId]),
      pool.query(
        `SELECT entry_id, delta, balance_after, reason, ref_market_id, created_at
           FROM wallet_ledger WHERE ${where}
          ORDER BY entry_id DESC LIMIT $${params.length}`,
        params,
      ),
    ]);
    const entries = eRows.map((e) => ({
      entry_id: Number(e.entry_id),
      delta: Number(e.delta),
      balance_after: Number(e.balance_after),
      reason: e.reason,
      ref_market_id: e.ref_market_id,
      created_at: e.created_at,
    }));
    return c.json({
      bankroll: Number(uRows[0].bankroll),
      entries,
      next_before: entries.length === limit ? entries[entries.length - 1]!.entry_id : null,
    });
  });

  // =========================================================================
  // GET /api/v1/me/results — kèo TÔI đã tham gia và ĐÃ CHỐT (màn 5 Kết quả).
  // ±T do SERVER tính từ wallet_ledger (C4 — client chỉ tô màu):
  //   my_total_bet = −Σ delta (bet_place/bet_adjust); my_return = Σ (payout/refund)
  // =========================================================================
  app.get('/api/v1/me/results', requireAuth, requireOnboarded, async (c) => {
    const actor = c.get('actor');
    const { rows } = await pool.query(
      `SELECT m.market_id, m.question_text, m.pool, m.status,
              m.outcome_option_id, m.resolved_ts,
              -COALESCE(SUM(w.delta) FILTER (WHERE w.reason IN ('bet_place','bet_adjust')), 0)
                AS my_total_bet,
              COALESCE(SUM(w.delta) FILTER (WHERE w.reason IN ('payout','refund')), 0)
                AS my_return
         FROM wallet_ledger w
         JOIN markets m ON m.market_id = w.ref_market_id
        WHERE w.user_id = $1 AND m.status IN ('resolved', 'cancelled')
        GROUP BY m.market_id
        ORDER BY COALESCE(m.resolved_ts, m.lock_ts) DESC
        LIMIT 100`,
      [actor.userId],
    );
    return c.json({
      results: rows.map((r) => {
        const bet = Number(r.my_total_bet);
        const ret = Number(r.my_return);
        return {
          market_id: r.market_id,
          question_text: r.question_text,
          pool: r.pool,
          status: r.status,
          outcome_option_id: r.outcome_option_id,
          resolved_ts: r.resolved_ts,
          my_total_bet: bet,
          my_return: ret,
          net: ret - bet,
        };
      }),
    });
  });

  // =========================================================================
  // GET /api/v1/me/stats — hồ sơ tối giản (màn 6): đếm kèo tham gia, đúng/sai.
  // "Đúng" = có token ở cửa thắng của kèo resolved. KHÔNG rank/Brier (A3.8).
  // =========================================================================
  app.get('/api/v1/me/stats', requireAuth, requireOnboarded, async (c) => {
    const actor = c.get('actor');
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT b.market_id)::int AS markets_joined,
              COUNT(DISTINCT b.market_id) FILTER (WHERE m.status = 'resolved')::int
                AS resolved_count,
              COUNT(DISTINCT b.market_id) FILTER
                (WHERE m.status = 'resolved' AND b.option_id = m.outcome_option_id)::int
                AS correct_count
         FROM bets b
         JOIN markets m ON m.market_id = b.market_id
        WHERE b.user_id = $1 AND NOT b.is_seed`,
      [actor.userId],
    );
    const s = rows[0];
    return c.json({
      markets_joined: s.markets_joined,
      resolved_count: s.resolved_count,
      correct_count: s.correct_count,
      incorrect_count: s.resolved_count - s.correct_count,
    });
  });

  // =========================================================================
  // GET /api/v1/me/dong-token — DÒNG TOKEN của CHÍNH MÌNH, gộp theo lý do
  // (trang Tài chính cá nhân, founder 08/08: "Phân tích dòng token của chính
  // bạn"). Đọc thẳng wallet_ledger — sổ cái là nguồn chân lý duy nhất của mọi
  // đồng T (A3.10), nên trang phân tích KHÔNG có nguồn thứ hai để mà lệch.
  // Chỉ trả reason + tổng — nhãn tiếng Việt client dựng (luật tự điển D26).
  // =========================================================================
  app.get('/api/v1/me/dong-token', requireAuth, requireOnboarded, async (c) => {
    const actor = c.get('actor');
    const { rows } = await pool.query(
      `SELECT reason,
              COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0)::bigint AS vao,
              COALESCE(SUM(delta) FILTER (WHERE delta < 0), 0)::bigint AS ra,
              COUNT(*)::int AS so_but_toan
         FROM wallet_ledger WHERE user_id = $1
        GROUP BY reason ORDER BY reason`,
      [actor.userId],
    );
    return c.json({
      dong: rows.map((r) => ({
        reason: r.reason as string,
        vao: Number(r.vao),
        ra: Number(r.ra),
        so_but_toan: r.so_but_toan as number,
      })),
    });
  });

  // =========================================================================
  // GET /api/v1/me/bets?market_id= — phân bổ của TÔI trên một kèo (prefill form)
  // Chỉ trả phần mình đặt — không đụng luật ẩn pool.
  // =========================================================================
  app.get('/api/v1/me/bets', requireAuth, requireOnboarded, async (c) => {
    const actor = c.get('actor');
    const marketId = c.req.query('market_id');
    if (!marketId || !UUID_RE.test(marketId)) {
      return c.json({ error: 'invalid_input', field: 'market_id', message: 'Thiếu market_id.' }, 400);
    }
    const mine = await myAllocation(pool, actor.userId!, marketId);
    let total = 0n;
    for (const [, v] of mine) total += v;
    return c.json({
      market_id: marketId,
      allocations: allocArray(mine),
      bet_total_mine: Number(total),
      min_bet: ECONOMY.MIN_BET,
    });
  });
}
