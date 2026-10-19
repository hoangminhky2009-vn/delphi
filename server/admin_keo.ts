/**
 * TIỆN DỤNG QUẢN KÈO (bước 4 — bản yêu cầu 01 §5).
 *
 * Vòng đời kèo đã TRỌN từ GĐ4 (tạo · mở · resolve · huỷ, mọi thao tác ghi
 * `admin_audit`). Thiếu **tiện**, không thiếu **chức năng** — nên file này cố ý
 * tách khỏi `server/admin.ts`:
 *
 *   admin.ts      — thao tác KHÔNG HOÀN TÁC ĐƯỢC (mở · resolve · huỷ)
 *   admin_keo.ts  — thao tác AN TOÀN (sửa nháp · tìm · tạo hàng loạt · xem trước)
 *
 * Ranh giới đó không phải để cho gọn: nó quyết định route nào phải qua cửa nặng
 * `requireXacThucLai`. Nhét cả hai vào một file là sớm muộn có người dán nhầm
 * cửa nhẹ lên một thao tác tiêu tiền.
 *
 * ⚠ NGOẠI LỆ DUY NHẤT trong file này: bật `tu_mo` ĐI CỬA NẶNG — xem `HEN_GIO`.
 */
import type { Hono } from 'hono';
import type pg from 'pg';
import { currentSeasonId } from './season.js';
import { dungChiTietKeo } from './markets.js';
import { UUID_RE } from './uuid.js';

import type { Env, Mw as Middleware } from './http/types.js';

const POOLS = ['macro', 'life', 'event'] as const;
const TRANG_THAI = ['draft', 'open', 'locked', 'resolved', 'cancelled'] as const;
/** Trần một lô tạo hàng loạt. Cả quý kèo vĩ mô là 3 kèo; 50 là thừa thãi. */
const LO_TOI_DA = 50;

function bad(c: any, field: string, message: string) {
  return c.json({ error: 'invalid_input', field, message }, 400);
}

async function audit(
  db: pg.Pool | pg.PoolClient, adminId: string, action: string, payload: unknown,
): Promise<void> {
  await db.query(
    `INSERT INTO admin_audit (admin_id, action, payload_json) VALUES ($1, $2, $3)`,
    [adminId, action, JSON.stringify(payload)],
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Kiểm một thân kèo — DÙNG CHUNG cho tạo, tạo hàng loạt và sửa nháp
 * ══════════════════════════════════════════════════════════════════════════
 * Ba đường cùng một luật. Ba bản sao của luật ấy là ba chỗ để chúng lệch nhau,
 * mà cái lệch sẽ nằm ở đường ít dùng nhất — tức đường không ai kiểm.
 */
export interface ThanKeo {
  pool: string;
  question_text: string;
  resolution_source_name: string;
  resolution_source_url: string;
  open_ts: Date;
  lock_ts: Date;
  resolve_deadline_ts: Date;
  seed_per_option: number;
  options: Array<{ label: string; range_low: number | null; range_high: number | null }>;
}

export function kiemThanKeo(b: any): { ok: true; than: ThanKeo } | { ok: false; field: string; message: string } {
  const sai = (field: string, message: string) => ({ ok: false as const, field, message });
  if (!b || typeof b !== 'object') return sai('body', 'Body JSON không hợp lệ.');
  if (!POOLS.includes(b.pool)) return sai('pool', 'pool phải là macro|life|event.');
  for (const f of ['question_text', 'resolution_source_name', 'resolution_source_url']) {
    if (typeof b[f] !== 'string' || b[f].trim().length === 0) {
      return sai(f, `Thiếu ${f} — nguồn resolve phải công bố TRƯỚC khi mở kèo (A3.2).`);
    }
  }
  const ts: Record<string, Date> = {};
  for (const f of ['open_ts', 'lock_ts', 'resolve_deadline_ts']) {
    const d = new Date(b[f]);
    if (!b[f] || Number.isNaN(d.getTime())) return sai(f, `${f} không phải thời điểm hợp lệ.`);
    ts[f] = d;
  }
  if (ts.lock_ts! <= ts.open_ts!) return sai('lock_ts', 'lock_ts phải sau open_ts.');
  if (ts.resolve_deadline_ts! < ts.lock_ts!) {
    return sai('resolve_deadline_ts', 'resolve_deadline_ts phải từ lock_ts trở đi.');
  }
  const seed = b.seed_per_option ?? 0;
  if (!Number.isSafeInteger(seed) || seed < 0) {
    return sai('seed_per_option', 'seed_per_option phải là số nguyên ≥ 0.');
  }
  if (!Array.isArray(b.options) || b.options.length < 2 || b.options.length > 6) {
    return sai('options', 'Kèo cần 2–6 cửa.');
  }
  for (const o of b.options) {
    if (typeof o?.label !== 'string' || o.label.trim().length === 0) {
      return sai('options', 'Mỗi cửa cần label.');
    }
  }
  return {
    ok: true,
    than: {
      pool: b.pool,
      question_text: b.question_text.trim(),
      resolution_source_name: b.resolution_source_name.trim(),
      resolution_source_url: b.resolution_source_url.trim(),
      open_ts: ts.open_ts!, lock_ts: ts.lock_ts!, resolve_deadline_ts: ts.resolve_deadline_ts!,
      seed_per_option: seed,
      options: b.options.map((o: any) => ({
        label: o.label.trim(),
        range_low: o.range_low ?? null,
        range_high: o.range_high ?? null,
      })),
    },
  };
}

/** Tạo một kèo draft trong transaction đang mở. Trả market_id. */
export async function taoKeoDraft(
  client: pg.PoolClient, than: ThanKeo, createdBy: string,
): Promise<string> {
  const { rows } = await client.query(
    `INSERT INTO markets (pool, question_text, resolution_source_name, resolution_source_url,
                          open_ts, lock_ts, resolve_deadline_ts, status, seed_per_option,
                          season_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10) RETURNING market_id`,
    [than.pool, than.question_text, than.resolution_source_name, than.resolution_source_url,
      than.open_ts, than.lock_ts, than.resolve_deadline_ts, than.seed_per_option,
      currentSeasonId(), createdBy],
  );
  const marketId: string = rows[0].market_id;
  for (let i = 0; i < than.options.length; i += 1) {
    const o = than.options[i]!;
    await client.query(
      `INSERT INTO market_options (market_id, label, sort_order, range_low, range_high)
       VALUES ($1,$2,$3,$4,$5)`,
      [marketId, o.label, i, o.range_low, o.range_high],
    );
  }
  return marketId;
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROUTES
 * ══════════════════════════════════════════════════════════════════════════ */

export function registerAdminKeoRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: {
    requireAuth: Middleware; requireOnboarded: Middleware; requireAdmin: Middleware;
    requireXacThucLai: Middleware;
  },
): void {
  const guard = [mw.requireAuth, mw.requireOnboarded, mw.requireAdmin] as const;
  const guardNang = [...guard, mw.requireXacThucLai] as const;

  /* ────────────────────────────────────────────────────────────────────────
   * 1. DANH SÁCH TOÀN BỘ, có lọc + tìm
   *    Trước bước 4 chỉ có `/admin/pending` (draft + locked) — kèo đã mở hay
   *    đã chốt thì không có đường nào nhìn lại ngoài việc truy vấn DB tay.
   * ──────────────────────────────────────────────────────────────────────── */
  app.get('/api/v1/admin/keo', ...guard, async (c) => {
    const tt = c.req.query('tt');
    const p = c.req.query('pool');
    const q = (c.req.query('q') ?? '').trim();
    const trang = Math.max(0, Number(c.req.query('trang')) || 0);
    const moiTrang = 25;

    const dk: string[] = [];
    const tham: unknown[] = [];
    if (tt && (TRANG_THAI as readonly string[]).includes(tt)) {
      tham.push(tt); dk.push(`m.status = $${tham.length}`);
    }
    if (p && (POOLS as readonly string[]).includes(p)) {
      tham.push(p); dk.push(`m.pool = $${tham.length}`);
    }
    if (q) {
      /*
       * Tham số hoá chặn được TIÊM SQL, nhưng KHÔNG chặn `%` và `_` — chúng vẫn
       * là ký tự đại diện của LIKE. Gõ `_` vào ô tìm kiếm mà khớp bừa mọi thứ
       * là hành vi không ai mong đợi từ một ô tìm kiếm, nên thoát chúng ra:
       * tìm kiếm ở đây theo đúng NGHĨA ĐEN.
       * (Backslash là ký tự thoát mặc định của LIKE trong Postgres.)
       */
      const den = q.replace(/[\\%_]/g, (m) => `\\${m}`);
      tham.push(`%${den}%`); dk.push(`m.question_text ILIKE $${tham.length}`);
    }
    const where = dk.length ? `WHERE ${dk.join(' AND ')}` : '';

    const { rows } = await pool.query(
      // ⚠ `seed_per_option` là BIGINT ⇒ pg trả BigInt, mà `c.json()` không
      // serialize được BigInt (500 im lặng ở tầng JSON, không phải ở SQL).
      // Ép ::text ngay trong truy vấn, giống `volume_nguoi`.
      `SELECT m.market_id, m.pool, m.question_text, m.status, m.tu_mo,
              m.open_ts, m.lock_ts, m.resolve_deadline_ts,
              m.seed_per_option::text AS seed_per_option,
              COALESCE(SUM(b.amount) FILTER (WHERE NOT b.is_seed), 0)::text AS volume_nguoi,
              COUNT(DISTINCT b.user_id) FILTER (WHERE NOT b.is_seed)::int AS so_nguoi,
              COUNT(*) OVER ()::int AS tong
         FROM markets m LEFT JOIN bets b ON b.market_id = m.market_id
         ${where}
        GROUP BY m.market_id
        ORDER BY m.open_ts DESC
        LIMIT ${moiTrang} OFFSET ${trang * moiTrang}`,
      tham,
    );
    return c.json({
      trang, moi_trang: moiTrang,
      tong: rows[0]?.tong ?? 0,
      keo: rows.map(({ tong: _t, ...r }) => r),
    });
  });

  /* ────────────────────────────────────────────────────────────────────────
   * 2. SỬA KÈO — CHỈ khi còn draft
   * ──────────────────────────────────────────────────────────────────────── */
  app.post('/api/v1/admin/keo/:id/sua', ...guard, async (c) => {
    const actor = c.get('actor');
    const marketId = c.req.param('id');
    if (!UUID_RE.test(marketId)) return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    const kiem = kiemThanKeo(await c.req.json().catch(() => null));
    if (!kiem.ok) return bad(c, kiem.field, kiem.message);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT status FROM markets WHERE market_id = $1 FOR UPDATE`, [marketId]);
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
      }
      /*
       * ⚠ CHỈ DRAFT. Kèo đã mở mà đổi câu hỏi hay đổi cửa là ĐỔI LUẬT GIỮA
       * CHỪNG với người đang giữ token trong đó — và `bets` trỏ vào `option_id`
       * nên thay cửa là làm mồ côi lệnh của họ. Đây là ranh giới cứng, không
       * phải một mức thận trọng nới ra được.
       */
      if (rows[0].status !== 'draft') {
        await client.query('ROLLBACK');
        return c.json(
          { error: 'khong_con_draft', message: 'Chỉ sửa được kèo chưa mở. Kèo đã mở thì huỷ rồi tạo lại.' },
          409,
        );
      }

      const t = kiem.than;
      await client.query(
        `UPDATE markets SET pool=$2, question_text=$3, resolution_source_name=$4,
                resolution_source_url=$5, open_ts=$6, lock_ts=$7, resolve_deadline_ts=$8,
                seed_per_option=$9
          WHERE market_id = $1`,
        [marketId, t.pool, t.question_text, t.resolution_source_name, t.resolution_source_url,
          t.open_ts, t.lock_ts, t.resolve_deadline_ts, t.seed_per_option],
      );
      // Draft chưa từng hiện với ai và chưa có seed ⇒ thay trọn bộ cửa là an toàn.
      await client.query(`DELETE FROM market_options WHERE market_id = $1`, [marketId]);
      for (let i = 0; i < t.options.length; i += 1) {
        const o = t.options[i]!;
        await client.query(
          `INSERT INTO market_options (market_id, label, sort_order, range_low, range_high)
           VALUES ($1,$2,$3,$4,$5)`,
          [marketId, o.label, i, o.range_low, o.range_high],
        );
      }
      await audit(client, actor.userId!, 'market_sua', { market_id: marketId, ...t });
      await client.query('COMMIT');
      return c.json({ ok: true, market_id: marketId });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  /* ────────────────────────────────────────────────────────────────────────
   * 3. TẠO HÀNG LOẠT — cả quý kèo vĩ mô một lần
   * ──────────────────────────────────────────────────────────────────────── */
  app.post('/api/v1/admin/keo/hang-loat', ...guard, async (c) => {
    const actor = c.get('actor');
    const b = await c.req.json().catch(() => null) as any;
    const ds = b?.keo;
    if (!Array.isArray(ds) || ds.length === 0) return bad(c, 'keo', 'Cần mảng `keo` không rỗng.');
    if (ds.length > LO_TOI_DA) return bad(c, 'keo', `Tối đa ${LO_TOI_DA} kèo mỗi lô.`);

    /*
     * ⚠ KIỂM HẾT TRƯỚC KHI GHI DÒNG NÀO. Tạo 8 kèo rồi hỏng ở cái thứ 9 mà vẫn
     * giữ 8 cái đầu là để lại một mớ nửa vời phải dọn tay — đúng thứ "tiện
     * dụng" sinh ra để tránh. Cả lô một transaction: được tất hoặc không gì.
     */
    const than: ThanKeo[] = [];
    for (let i = 0; i < ds.length; i += 1) {
      const kiem = kiemThanKeo(ds[i]);
      if (!kiem.ok) return bad(c, `keo[${i}].${kiem.field}`, `Kèo thứ ${i + 1}: ${kiem.message}`);
      than.push(kiem.than);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ids: string[] = [];
      for (const t of than) ids.push(await taoKeoDraft(client, t, actor.userId!));
      await audit(client, actor.userId!, 'market_tao_hang_loat', { so_keo: ids.length, ids });
      await client.query('COMMIT');
      return c.json({ ok: true, so_keo: ids.length, market_ids: ids }, 201);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  /* ────────────────────────────────────────────────────────────────────────
   * 4. HẸN GIỜ MỞ — CỬA NẶNG
   * ──────────────────────────────────────────────────────────────────────── */
  app.post('/api/v1/admin/keo/:id/hen-gio', ...guardNang, async (c) => {
    const actor = c.get('actor');
    const marketId = c.req.param('id');
    if (!UUID_RE.test(marketId)) return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);
    const bat = (await c.req.json().catch(() => null))?.bat !== false;

    /*
     * ⚠⚠ VÌ SAO CỬA NẶNG CHO MỘT CÁI CỜ BOOLEAN.
     * Bật cờ này = uỷ quyền trước một khoản CHI KHO BẠC sẽ tự chạy lúc không ai
     * ngồi đó. Bước 2 đặt `requireXacThucLai` lên chính thao tác mở vì nó tiêu
     * tiền và không hoàn tác được; nếu bật cờ chỉ cần cửa nhẹ thì cái cổng ấy đi
     * vòng được bằng hai cú bấm. Uỷ quyền được DỜI CHỖ chứ không được BỎ.
     */
    const { rows } = await pool.query(
      `UPDATE markets SET tu_mo = $2 WHERE market_id = $1 AND status = 'draft'
       RETURNING open_ts, seed_per_option::text AS seed`,
      [marketId, bat],
    );
    if (rows.length === 0) {
      return c.json(
        { error: 'khong_con_draft', message: 'Chỉ hẹn giờ được cho kèo chưa mở.' }, 409,
      );
    }
    await audit(pool, actor.userId!, bat ? 'market_hen_gio_bat' : 'market_hen_gio_tat', {
      market_id: marketId, open_ts: rows[0].open_ts, seed_per_option: rows[0].seed,
    });
    return c.json({ ok: true, tu_mo: bat, open_ts: rows[0].open_ts });
  });

  /* ────────────────────────────────────────────────────────────────────────
   * 5. XEM TRƯỚC ĐÚNG THỨ NGƯỜI CHƠI THẤY — kiểm A3.1 bằng mắt
   * ──────────────────────────────────────────────────────────────────────── */
  app.get('/api/v1/admin/keo/:id/xem-truoc', ...guard, async (c) => {
    const marketId = c.req.param('id');
    if (!UUID_RE.test(marketId)) return c.json({ error: 'not_found', message: 'Không có kèo này.' }, 404);

    /*
     * Gọi CHÍNH `dungChiTietKeo` mà route người chơi gọi. Dựng lại payload bằng
     * một đoạn code thứ hai thì công cụ kiểm A3.1 sẽ là thứ nói dối về A3.1.
     *
     * Trả CẢ HAI góc nhìn cạnh nhau, vì bản thân sự KHÁC NHAU giữa chúng mới là
     * thứ cần nhìn: bên "chưa đặt" phải KHÔNG có `distribution`, bên "đã đặt"
     * thì có. Đưa một góc nhìn thì người xem phải tự nhớ bên kia trông thế nào.
     */
    const chuaDat = await dungChiTietKeo(pool, marketId, null);
    if (chuaDat === null) {
      return c.json(
        { error: 'not_found', message: 'Không có kèo này (hoặc còn là nháp — nháp thì người chơi không thấy gì).' },
        404,
      );
    }
    // Mượn góc nhìn của một người ĐÃ đặt ở kèo này, nếu có ai.
    const { rows: aiDo } = await pool.query(
      `SELECT user_id FROM bets WHERE market_id = $1 AND NOT is_seed AND user_id IS NOT NULL
        LIMIT 1`, [marketId],
    );
    const daDat = aiDo.length > 0
      ? await dungChiTietKeo(pool, marketId, aiDo[0].user_id as string)
      : null;

    return c.json({
      nhu_nguoi_chua_dat: chuaDat.body,
      nhu_nguoi_da_dat: daDat?.body ?? null,
      // Câu trả lời cho "A3.1 còn nguyên không" — đọc thẳng, không phải suy.
      a31_an_phan_bo: !('distribution' in chuaDat.body),
      co_nguoi_da_dat: aiDo.length > 0,
    });
  });
}
