/**
 * GĐ4 VIỆC 1 — Admin: vòng đời kèo (tạo → mở+seed → preview → resolve/hủy)
 * + dashboard kinh tế guardrail. CHỈ role admin; MỌI thao tác ghi admin_audit.
 *
 * Resolve hai bước chống tay nhanh hơn não: PREVIEW trả mã xác nhận (suy từ
 * market+outcome+tổng pool — pool đổi là mã đổi), COMMIT phải nộp lại đúng mã.
 */
import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import type pg from 'pg';
import { computePayout, type BetLike } from './parimutuel.js';
import { resolveMarket, cancelMarket, updateScoresAndRanks, LifecycleError, type SettleSummary } from './resolve.js';
import { treasuryAppend } from './treasury.js';
import { currentSeasonId } from './season.js';
import { auditSupply } from './audit.js';
import { UUID_RE } from './uuid.js';

import type { Env, Mw as Middleware } from './http/types.js';

const POOLS = ['macro', 'life', 'event'] as const;

function bad(c: any, field: string, message: string) {
  return c.json({ error: 'invalid_input', field, message }, 400);
}

async function audit(
  db: pg.Pool | pg.PoolClient,
  adminId: string,
  action: string,
  payload: unknown,
): Promise<void> {
  await db.query(
    `INSERT INTO admin_audit (admin_id, action, payload_json) VALUES ($1, $2, $3)`,
    [adminId, action, JSON.stringify(payload)],
  );
}

export type KetQuaMo =
  | { ok: true; seed_total: bigint }
  | { ok: false; ma: 'not_found' | 'not_draft' | 'treasury_insufficient'; message: string };

/**
 * MỞ MỘT KÈO: draft → open, seed CHIA ĐỀU mọi cửa từ Kho bạc (A3.6).
 *
 * Tách ra để đường TAY (`POST /open`) và đường TỰ ĐỘNG (hẹn giờ, bước 4) dùng
 * CHUNG một thân — hai bản sao của một thủ tục đụng Kho bạc là hai bản sẽ trôi
 * khỏi nhau, và cái trôi sẽ là cái không ai nhìn.
 *
 * Người gọi lo transaction + audit: đường tay ghi admin đang bấm, đường tự động
 * ghi người đã hẹn lịch. Hàm này chỉ lo phần tiền.
 */
export async function moKeo(
  client: pg.PoolClient,
  marketId: string,
): Promise<KetQuaMo> {
  const { rows: mRows } = await client.query(
    `SELECT status, seed_per_option FROM markets WHERE market_id = $1 FOR UPDATE`,
    [marketId],
  );
  if (mRows.length === 0) return { ok: false, ma: 'not_found', message: 'Không có kèo này.' };
  if (mRows[0].status !== 'draft') {
    return { ok: false, ma: 'not_draft', message: 'Chỉ mở được kèo đang draft.' };
  }
  const seedPerOption = mRows[0].seed_per_option as bigint;
  const { rows: opts } = await client.query(
    `SELECT option_id FROM market_options WHERE market_id = $1 ORDER BY sort_order`,
    [marketId],
  );

  let seeded = 0n;
  if (seedPerOption > 0n) {
    seeded = seedPerOption * BigInt(opts.length);
    try {
      // Kho bạc không đủ → fail RÕ RÀNG, admin giảm seed (D10/A3.4)
      await treasuryAppend(client, -seeded, 'seed_out', marketId);
    } catch (err) {
      return { ok: false, ma: 'treasury_insufficient', message: (err as Error).message };
    }
    for (const o of opts) {
      await client.query(
        `INSERT INTO bets (market_id, option_id, user_id, amount, is_seed)
         VALUES ($1, $2, NULL, $3, TRUE)`,
        [marketId, o.option_id, seedPerOption.toString()],
      );
    }
  }
  await client.query(`UPDATE markets SET status = 'open' WHERE market_id = $1`, [marketId]);
  return { ok: true, seed_total: seeded };
}

/** Mã xác nhận resolve: gắn với (kèo, cửa thắng, tổng pool) — pool đổi là mã hết hạn. */
function confirmCode(marketId: string, outcomeOptionId: string, poolTotal: bigint): string {
  return createHash('sha256')
    .update(`${marketId}|${outcomeOptionId}|${poolTotal}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
}

const summaryJson = (s: SettleSummary) => ({
  mode: s.mode,
  players_paid: s.playersPaid,
  total_player_payout: Number(s.totalPlayerPayout),
  seed_to_treasury: Number(s.seedToTreasury),
  burn_total: Number(s.burnTotal),
  treasury_rake: Number(s.treasuryRake),
  unclaimed_to_treasury: Number(s.unclaimedToTreasury),
});

export function registerAdminRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: {
    requireAuth: Middleware; requireOnboarded: Middleware; requireAdmin: Middleware;
    requireXacThucLai: Middleware;
  },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded, mw.requireAdmin] as const;
  /*
   * Cửa NẶNG — thêm một lần nhập mã ngay trước khi bấm (§3.2, founder chốt
   * dùng TOTP thay mật khẩu 03/08). Chỉ dán lên thao tác KHÔNG HOÀN TÁC ĐƯỢC:
   * resolve trả tiền thật, cancel hoàn tiền, mở kèo có seed là chi Kho bạc.
   * Dán rộng hơn thì admin bị hỏi liên tục và sẽ tìm cách tắt — một cái khoá
   * phiền quá mức là một cái khoá sắp bị gỡ.
   */
  const guardNang = [...guard, mw.requireXacThucLai] as const;

  // =========================================================================
  // Tạo kèo (draft) — nguồn resolve BẮT BUỘC trước khi mở (A3.2)
  // =========================================================================
  app.post('/api/v1/admin/markets', ...guard, async (c) => {
    const actor = c.get('actor');
    const b = (await c.req.json().catch(() => null)) as any;
    if (!b) return bad(c, 'body', 'Body JSON không hợp lệ.');

    if (!POOLS.includes(b.pool)) return bad(c, 'pool', 'pool phải là macro|life|event.');
    for (const f of ['question_text', 'resolution_source_name', 'resolution_source_url']) {
      if (typeof b[f] !== 'string' || b[f].trim().length === 0) {
        return bad(c, f, `Thiếu ${f} — nguồn resolve phải công bố TRƯỚC khi mở kèo (A3.2).`);
      }
    }
    const ts: Record<string, Date> = {};
    for (const f of ['open_ts', 'lock_ts', 'resolve_deadline_ts']) {
      const d = new Date(b[f]);
      if (!b[f] || Number.isNaN(d.getTime())) return bad(c, f, `${f} không phải thời điểm hợp lệ.`);
      ts[f] = d;
    }
    if (ts.lock_ts! <= ts.open_ts!) return bad(c, 'lock_ts', 'lock_ts phải sau open_ts.');
    if (ts.resolve_deadline_ts! < ts.lock_ts!) {
      return bad(c, 'resolve_deadline_ts', 'resolve_deadline_ts phải từ lock_ts trở đi.');
    }
    const seed = b.seed_per_option ?? 0;
    if (!Number.isSafeInteger(seed) || seed < 0) return bad(c, 'seed_per_option', 'seed_per_option phải là số nguyên ≥ 0.');
    if (!Array.isArray(b.options) || b.options.length < 2 || b.options.length > 6) {
      return bad(c, 'options', 'Kèo cần 2–6 cửa.');
    }
    for (const o of b.options) {
      if (typeof o?.label !== 'string' || o.label.trim().length === 0) {
        return bad(c, 'options', 'Mỗi cửa cần label.');
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: mRows } = await client.query(
        `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url,
                              open_ts, lock_ts, resolve_deadline_ts, status, seed_per_option,
                              season_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10)
         RETURNING market_id`,
        [
          b.pool, b.question_text.trim(), b.resolution_source_name.trim(),
          b.resolution_source_url.trim(), ts.open_ts, ts.lock_ts, ts.resolve_deadline_ts,
          seed, currentSeasonId(), actor.userId,
        ],
      );
      const marketId: string = mRows[0].market_id;
      const optionIds: string[] = [];
      for (let i = 0; i < b.options.length; i++) {
        const o = b.options[i];
        const { rows } = await client.query(
          `INSERT INTO market_options (market_id, label, sort_order, range_low, range_high)
           VALUES ($1, $2, $3, $4, $5) RETURNING option_id`,
          [marketId, o.label.trim(), i, o.range_low ?? null, o.range_high ?? null],
        );
        optionIds.push(rows[0].option_id);
      }
      await audit(client, actor.userId!, 'market_create', { market_id: marketId, ...b });
      await client.query('COMMIT');
      return c.json({ ok: true, market_id: marketId, option_ids: optionIds }, 201);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  // =========================================================================
  // Mở kèo: draft → open + seed CHIA ĐỀU từ Kho bạc (A3.6 — lệch cửa là
  // bất khả thi theo thiết kế: chỉ một ô seed_per_option)
  // =========================================================================
  app.post('/api/v1/admin/markets/:id/open', ...guardNang, async (c) => {
    const actor = c.get('actor');
    const marketId = c.req.param('id');
    if (!UUID_RE.test(marketId)) return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const kq = await moKeo(client, marketId);
      if (!kq.ok) {
        await client.query('ROLLBACK');
        return c.json(
          { error: kq.ma, message: kq.message },
          kq.ma === 'not_found' ? 404 : 409,
        );
      }
      await audit(client, actor.userId!, 'market_open', {
        market_id: marketId, seed_total: kq.seed_total.toString(),
      });
      await client.query('COMMIT');
      return c.json({ ok: true, seed_total: Number(kq.seed_total) });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  // =========================================================================
  // "VIỆC CẦN LÀM" — một lần gọi trả đủ mọi thứ admin cần, để panel KHÔNG bao
  // giờ bắt người dùng gõ/dán UUID (founder 19/07: "nhập id loằng ngoằng").
  //   draft  → cần MỞ kèo
  //   locked → cần CHỐT cửa thắng
  // Kèm sẵn options + volume + nguồn resolve để prefill form bằng chứng.
  // =========================================================================
  app.get('/api/v1/admin/pending', ...guard, async (c) => {
    const { rows } = await pool.query(
      `SELECT m.market_id, m.question_text, m.status, m.pool,
              m.lock_ts, m.resolution_source_name, m.resolution_source_url,
              m.seed_per_option,
              COALESCE(SUM(b.amount), 0) AS total_volume
         FROM markets m LEFT JOIN bets b ON b.market_id = m.market_id
        WHERE m.status IN ('draft', 'locked')
        GROUP BY m.market_id
        ORDER BY (m.status = 'locked') DESC, m.lock_ts ASC`,
    );
    const out = [];
    for (const m of rows) {
      const { rows: opts } = await pool.query(
        `SELECT o.option_id, o.label, o.sort_order,
                COALESCE(SUM(b.amount), 0) AS vol,
                COALESCE(SUM(b.amount) FILTER (WHERE NOT b.is_seed), 0) AS vol_nguoi,
                COUNT(DISTINCT b.user_id) FILTER (WHERE NOT b.is_seed)::int AS so_nguoi
           FROM market_options o LEFT JOIN bets b ON b.option_id = o.option_id
          WHERE o.market_id = $1
          GROUP BY o.option_id, o.label, o.sort_order ORDER BY o.sort_order`,
        [m.market_id],
      );
      out.push({
        market_id: m.market_id,
        question_text: m.question_text,
        status: m.status,
        pool: m.pool,
        lock_ts: m.lock_ts,
        resolution_source_name: m.resolution_source_name,
        resolution_source_url: m.resolution_source_url,
        seed_per_option: Number(m.seed_per_option),
        total_volume: Number(m.total_volume),
        options: opts.map((o) => ({
          option_id: o.option_id,
          label: o.label,
          volume: Number(o.vol),
          player_volume: Number(o.vol_nguoi),
          participants: o.so_nguoi,
        })),
      });
    }
    return c.json({ markets: out });
  });

  // =========================================================================
  // Danh sách cửa của một kèo — admin cần option_id để resolve.
  // KHÔNG dùng GET /markets/:id cho việc này: endpoint đó ghi event market_view
  // (dữ liệu nghiên cứu thật) — admin soi kèo không được làm bẩn số liệu.
  // =========================================================================
  app.get('/api/v1/admin/markets/:id/options', ...guard, async (c) => {
    const marketId = c.req.param('id');
    if (!UUID_RE.test(marketId)) {
      return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    }
    const { rows: m } = await pool.query(
      `SELECT question_text, status FROM markets WHERE market_id = $1`, [marketId],
    );
    if (m.length === 0) return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);

    const { rows } = await pool.query(
      `SELECT o.option_id, o.label, o.sort_order,
              COALESCE(SUM(b.amount), 0) AS tong,
              COUNT(DISTINCT b.user_id) FILTER (WHERE NOT b.is_seed)::int AS so_nguoi
         FROM market_options o LEFT JOIN bets b ON b.option_id = o.option_id
        WHERE o.market_id = $1
        GROUP BY o.option_id, o.label, o.sort_order ORDER BY o.sort_order`,
      [marketId],
    );
    return c.json({
      market_id: marketId,
      question_text: m[0].question_text,
      status: m[0].status,
      options: rows.map((r) => ({
        option_id: r.option_id,
        label: r.label,
        sort_order: r.sort_order,
        total: Number(r.tong),
        participants: r.so_nguoi,
      })),
    });
  });

  // =========================================================================
  // Preview resolve — DRY RUN hàm thuần, KHÔNG ghi gì; trả mã xác nhận
  // =========================================================================
  app.get('/api/v1/admin/markets/:id/preview-resolve', ...guard, async (c) => {
    const marketId = c.req.param('id');
    const outcomeOptionId = c.req.query('outcome_option_id') ?? '';
    /*
     * HAI ID, HAI CÂU TRẢ LỜI KHÁC NHAU — tách ra 16/08.
     *
     * Bản cũ gộp chúng vào một `bad(...)` ⇒ 400 "Cần market_id và
     * outcome_option_id hợp lệ", tức gõ nhầm kèo thì màn đổ lỗi cho CẢ hai ô
     * trong khi ô cửa thắng không sai gì. Và nó lệch với chính form đang dùng
     * nó: cùng ô `a_mid` ấy, nút Huỷ kèo trả 404.
     *
     * Đúng ranh giới: `:id` trên ĐƯỜNG DẪN là thứ định danh tài nguyên ⇒ sai
     * hình dạng = không có tài nguyên = **404, y hệt kèo không tồn tại**
     * (người gõ nhầm không cần biết ta lưu id bằng kiểu gì).
     * `outcome_option_id` là TRƯỜNG NHẬP ⇒ sai thì 400 kèm tên trường.
     */
    if (!UUID_RE.test(marketId)) {
      return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    }
    if (!UUID_RE.test(outcomeOptionId)) {
      return bad(c, 'outcome_option_id', 'Cần outcome_option_id hợp lệ.');
    }
    const { rows: mRows } = await pool.query(
      `SELECT status FROM markets WHERE market_id = $1`, [marketId],
    );
    if (mRows.length === 0) return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    if (mRows[0].status !== 'locked') {
      return c.json({ error: 'not_locked', message: 'Chỉ preview kèo đã khóa.' }, 409);
    }
    const { rows: betRows } = await pool.query(
      `SELECT option_id, user_id, amount, is_seed FROM bets WHERE market_id = $1`,
      [marketId],
    );
    const bets: BetLike[] = betRows.map((r) => ({
      optionId: r.option_id, userId: r.user_id, amount: r.amount as bigint, isSeed: r.is_seed,
    }));
    const r = computePayout(bets, outcomeOptionId, false);
    const P = bets.reduce((s, b) => s + b.amount, 0n);
    let totalPlayer = 0n;
    for (const [, v] of r.playerPayouts) totalPlayer += v;
    return c.json({
      market_id: marketId,
      outcome_option_id: outcomeOptionId,
      pool_total: Number(P),
      mode: r.mode,
      players_paid: r.playerPayouts.size,
      total_player_payout: Number(totalPlayer),
      seed_to_treasury: Number(r.seedToTreasury),
      burn_total: Number(r.burnTotal),
      treasury_rake: Number(r.treasuryRake),
      unclaimed_to_treasury: Number(r.unclaimedToTreasury),
      confirm_code: confirmCode(marketId, outcomeOptionId, P),
    });
  });

  // =========================================================================
  // Resolve COMMIT — đòi đúng mã xác nhận từ preview (A3.2: số lần đầu là chung thẩm)
  // =========================================================================
  app.post('/api/v1/admin/markets/:id/resolve', ...guardNang, async (c) => {
    const actor = c.get('actor');
    const marketId = c.req.param('id');
    // Kèo sai hình dạng ⇒ 404 NGAY, trước cả khi đọc body: `:id` định danh tài
    // nguyên, và "không có kèo này" là câu trả lời đúng dù body có gì. Xem lý
    // lẽ đầy đủ ở `preview-resolve` phía trên.
    if (!UUID_RE.test(marketId)) {
      return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    }
    const b = (await c.req.json().catch(() => null)) as any;
    const outcomeOptionId = b?.outcome_option_id ?? '';
    if (!UUID_RE.test(outcomeOptionId)) {
      return bad(c, 'outcome_option_id', 'Thiếu outcome_option_id.');
    }
    if (typeof b?.evidence_url !== 'string' || b.evidence_url.trim().length === 0) {
      return bad(c, 'evidence_url', 'Phải dán URL bằng chứng số liệu nguồn công bố.');
    }
    if (typeof b?.confirm_code !== 'string') return bad(c, 'confirm_code', 'Thiếu mã xác nhận (lấy từ preview).');

    // Mã xác nhận tính trên tổng pool HIỆN TẠI — kèo locked nên pool bất biến
    const { rows: pRows } = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS p FROM bets WHERE market_id = $1`, [marketId],
    );
    const expected = confirmCode(marketId, outcomeOptionId, BigInt(pRows[0].p));
    if (b.confirm_code.trim().toUpperCase() !== expected) {
      return c.json(
        { error: 'confirm_mismatch', message: 'Mã xác nhận không khớp — chạy lại preview rồi gõ đúng mã.' },
        409,
      );
    }

    const note =
      `${(b.resolution_note ?? '').toString().trim()} — Bằng chứng: ${b.evidence_url.trim()}`.trim();
    try {
      const summary = await resolveMarket(pool, { marketId, outcomeOptionId, resolutionNote: note });
      await updateScoresAndRanks(pool, marketId);
      await audit(pool, actor.userId!, 'market_resolve', {
        market_id: marketId, outcome_option_id: outcomeOptionId,
        evidence_url: b.evidence_url, ...summaryJson(summary),
      });
      return c.json({ ok: true, ...summaryJson(summary) });
    } catch (err) {
      if (err instanceof LifecycleError) {
        return c.json({ error: err.code, message: err.message }, err.code === 'not_found' ? 404 : 409);
      }
      throw err;
    }
  });

  // =========================================================================
  // Hủy kèo — lý do BẮT BUỘC; hoàn 100% (A5.1 ngoại lệ 2)
  // =========================================================================
  /*
   * ═══ GỠ HẲN MỘT BẢN NHÁP (founder 04/08) ══════════════════════════════════
   *
   * Trước hôm nay bản nháp KHÔNG CÓ ĐƯỜNG NÀO GỠ: `cancelMarket` chỉ nhận
   * open/locked, và không có route xoá. Nên mỗi lần thử tạo kèo hỏng là một
   * hàng nằm lại vĩnh viễn — prod đang có 5 bản trùng đúng vì vậy, và chúng là
   * chỗ để bấm nhầm về sau.
   *
   * ⚠⚠ VÌ SAO ĐÂY LÀ XOÁ THẬT, KHÔNG PHẢI ĐỔI TRẠNG THÁI — và vì sao NGOẠI LỆ
   * NÀY KHÔNG NỚI A3.3 MỘT LY NÀO:
   *
   * `cancelled` là một trạng thái CÓ NGHĨA VỚI NGƯỜI CHƠI: nó nói "kèo này từng
   * mở, bạn từng đặt, và tiền đã hoàn 100%". Một bản nháp chưa ai từng nhìn
   * thấy mà mang nhãn đó là nói dối về lịch sử — và nó làm bẩn đúng con số dùng
   * để đếm "bao nhiêu kèo bị huỷ".
   *
   * Xoá được vì bản nháp không có gì để bảo vệ: chưa mở ⇒ chưa ai đặt ⇒ không
   * bút toán, không event. Điều kiện ấy KHÔNG suy từ trạng thái mà được ĐO
   * TRONG CHÍNH TRANSACTION — nếu vì lý do nào đó một draft có bet hoặc event
   * thì cửa này đóng lại và bắt đi đường huỷ.
   */
  app.delete('/api/v1/admin/markets/:id', ...guardNang, async (c) => {
    const actor = c.get('actor');
    const marketId = c.req.param('id');
    if (!UUID_RE.test(marketId)) {
      return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT m.status, m.question_text,
                (SELECT count(*)::int FROM bets WHERE market_id = m.market_id) AS bets,
                (SELECT count(*)::int FROM events WHERE context_id = m.market_id::text) AS evts,
                (SELECT count(*)::int FROM wallet_ledger WHERE ref_market_id = m.market_id) AS vi,
                (SELECT count(*)::int FROM treasury_ledger WHERE ref_market_id = m.market_id) AS kb
           FROM markets m WHERE m.market_id = $1 FOR UPDATE`,
        [marketId],
      );
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
      }
      const m = rows[0];
      if (m.status !== 'draft') {
        await client.query('ROLLBACK');
        return c.json({
          error: 'chi_go_duoc_nhap',
          message: `Kèo đang ở trạng thái ${m.status}. Chỉ bản NHÁP mới gỡ được — `
            + 'kèo đã mở thì phải HỦY (hoàn 100% cho người chơi).',
        }, 409);
      }
      /*
       * Chốt chặn đo được, không suy từ trạng thái. Một draft mà có dấu vết tiền
       * hoặc dấu vết hành vi là một draft KHÔNG BÌNH THƯỜNG — và lúc đó thứ đúng
       * để làm là dừng lại, không phải xoá cho gọn.
       */
      if (m.bets > 0 || m.evts > 0 || m.vi > 0 || m.kb > 0) {
        await client.query('ROLLBACK');
        return c.json({
          error: 'nhap_co_dau_vet',
          message: `Bản nháp này có dấu vết (${m.bets} lệnh · ${m.evts} sự kiện · `
            + `${m.vi + m.kb} bút toán) nên KHÔNG xoá. Báo lại — đây là chuyện bất thường.`,
        }, 409);
      }

      await client.query(`DELETE FROM market_options WHERE market_id = $1`, [marketId]);
      await client.query(`DELETE FROM markets WHERE market_id = $1`, [marketId]);
      /*
       * Audit ghi cả CÂU HỎI, không chỉ id: sau khi xoá thì id không tra ngược
       * được nữa, nên một dòng audit chỉ có UUID là một dòng không đọc được.
       *
       * ⚠⚠ `client`, KHÔNG PHẢI `pool` — sửa 15/08, và nó vá HAI lỗi cùng lúc:
       *
       * 1. BẾ TẮC (D65). Khối này đang cầm `client` từ `pool.connect()` ở trên.
       *    Prod mở pool `max: 1` (`api/index.ts`), nên xin kết nối thứ hai là
       *    xin chính cái mình đang giữ ⇒ chờ vĩnh viễn ⇒ Vercel cắt 10,4 giây
       *    ⇒ 504. `tests/pool_max1.test.ts` bắt được; test thường không bao giờ
       *    thấy vì pool test mở `max: 5`.
       *
       * 2. AUDIT NÓI DỐI — nặng hơn, và không công cụ nào đang canh. Ghi qua
       *    `pool` là ghi NGOÀI transaction: nếu `COMMIT` phía dưới thất bại và
       *    kèo KHÔNG bị xoá, dòng audit vẫn nằm đó khai rằng đã xoá. Một sổ
       *    kiểm toán ghi việc chưa xảy ra thì tệ hơn không có sổ, vì người ta
       *    tin nó. Dùng `client` buộc audit sống chết cùng nghiệp vụ.
       */
      await audit(client, actor.userId!, 'market_draft_delete', {
        market_id: marketId, question_text: m.question_text,
      });
      await client.query('COMMIT');
      return c.json({ ok: true, da_go: m.question_text });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  app.post('/api/v1/admin/markets/:id/cancel', ...guardNang, async (c) => {
    const actor = c.get('actor');
    const marketId = c.req.param('id');
    const b = (await c.req.json().catch(() => null)) as any;
    if (!UUID_RE.test(marketId)) return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    if (typeof b?.reason !== 'string' || b.reason.trim().length === 0) {
      return bad(c, 'reason', 'Hủy kèo phải có lý do.');
    }
    try {
      const summary = await cancelMarket(pool, {
        marketId, reason: `Admin hủy: ${b.reason.trim()}`,
      });
      await audit(pool, actor.userId!, 'market_cancel', {
        market_id: marketId, reason: b.reason, ...summaryJson(summary),
      });
      return c.json({ ok: true, ...summaryJson(summary) });
    } catch (err) {
      if (err instanceof LifecycleError) {
        return c.json({ error: err.code, message: err.message }, err.code === 'not_found' ? 404 : 409);
      }
      throw err;
    }
  });

  // =========================================================================
  // Dashboard kinh tế 1 trang — guardrail theo dõi tuần (từ audit_supply)
  // =========================================================================
  app.get('/api/v1/admin/dashboard', ...guard, async (c) => {
    const report = await auditSupply(pool);

    const { rows: uRows } = await pool.query(
      `SELECT COUNT(*)::int AS n,
              COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY bankroll), 0) AS median,
              COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY bankroll), 0) AS p90
         FROM users WHERE deleted_at IS NULL`,
    );
    // Gini bankroll — chỉ hiển thị (không phải tiền): tính trên mảng đã sort
    const { rows: bRows } = await pool.query(
      `SELECT bankroll FROM users WHERE deleted_at IS NULL ORDER BY bankroll`,
    );
    const xs = bRows.map((r) => Number(r.bankroll));
    const n = xs.length;
    const sum = xs.reduce((a, b) => a + b, 0);
    let gini = 0;
    if (n > 0 && sum > 0) {
      const weighted = xs.reduce((acc, x, i) => acc + (i + 1) * x, 0);
      gini = (2 * weighted) / (n * sum) - (n + 1) / n;
    }
    const { rows: mRows } = await pool.query(
      `SELECT status, COUNT(*)::int AS n FROM markets GROUP BY status`,
    );

    return c.json({
      audit_ok: report.ok,
      audit_problems: report.problems,
      supply: report.numbers,
      users: uRows[0].n,
      bankroll_median: Number(uRows[0].median),
      bankroll_p90: Number(uRows[0].p90),
      bankroll_gini: Math.round(gini * 1000) / 1000,
      markets_by_status: Object.fromEntries(mRows.map((r) => [r.status, r.n])),
    });
  });
}
