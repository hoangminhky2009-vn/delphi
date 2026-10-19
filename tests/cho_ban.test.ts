/**
 * B7a — CỬA BÁN CHO HỆ THỐNG: màn demo của M1, chạy bằng máy.
 *
 * Năm điều "Xong khi" của `docs/lo-trinh/M1-ban-mon-dau-tien.md`, mỗi điều một
 * bài — cộng hai thứ mà demo tay không thấy: hai tab bán cùng một bản, và một
 * bài quét chặn ai đó xoá một chân của giao dịch.
 *
 * ⚠ Ba lớp một lúc: sổ vật đổi chủ · quỹ chợ trả tiền · ví nhận tiền. Mỗi bài
 * sau khi bán đều gọi CẢ HAI audit — đó mới là "xong", không phải HTTP 200.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let coGhi = true;
vi.mock('../config/co_kinh_te.js', () => ({
  CO_KINH_TE: { get CHO_SO_VAT() { return coGhi; }, CHO_SO_VAT_DOC: false },
}));

const { createApp } = await import('../server/app.js');
const { CapturingMailer } = await import('../server/email.js');
const { auditSupply } = await import('../server/audit.js');
const { auditVat } = await import('../server/kinh_te/audit_vat.js');
const { napQuyChoTuKhoBac, soDuQuyCho } = await import('../server/kinh_te/quy_cho.js');
const { capMonHuuHan } = await import('../server/shop_kho.js');
const { createTestUser, ensureGenesis } = await import('./helpers/fixtures.js');
const { startTestDb } = await import('./helpers/testdb.js');

const MAU = 'st_ria_mep';
/*
 * ⚠ PHẢI là một mẫu CÓ THẬT TRONG HỘP GACHA, không phải id bịa. Từ D291 cửa bán
 * hỏi E24 (`heThongMuaLai`): món không có cửa tốn T để lấy thì Hệ thống không
 * mua lại. Một `st_test_*` bịa ra sẽ không bao giờ nằm trong `HOP_GACHA` ⇒ mọi
 * bài bán ở đây đỏ vì một lý do chẳng liên quan tới thứ nó đang canh.
 */

describe('M1 — bán một nhãn dán cho Hệ thống, T về ví', () => {
  let db: Awaited<ReturnType<typeof startTestDb>>;
  let app: ReturnType<typeof createApp>;
  let a: { userId: string; cookie: string };
  let b: { userId: string; cookie: string };

  const goi = (p: string, cookie: string, body?: unknown) =>
    app.request(`http://x${p}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const banTheCua = async (userId: string): Promise<string[]> => {
    const { rows } = await db.pool.query(
      `SELECT b.ban_the_id::text AS id FROM vat_pham_ban_the b
         JOIN dot_phat_hanh d ON d.dot_id = b.dot_id
        WHERE b.chu_so_huu = $1 AND d.mau_id = $2 AND b.trang_thai = 'tu_do'
        ORDER BY b.ban_the_id`, [userId, MAU]);
    return rows.map((r) => r.id as string);
  };
  /**
   * Đúng MỘT bản thể tự do của `userId` — và NỔ NGAY nếu không còn bản nào.
   *
   * Sinh ra để chữa `tsc` (`const [id] = …` cho `string | undefined`), nhưng
   * thứ nó chữa lớn hơn thế. Trước chốt này, `Number(undefined)` là `NaN` ⇒
   * thân request mang `ban_the_id: null` ⇒ route **vẫn trả lời**, chỉ là trả
   * lời cho một câu hỏi khác.
   *
   * ⚠ ĐO ĐƯỢC, không suy đoán (tiêm lỗi D299): cho helper thấy kho RỖNG rồi
   * chạy CẢ tệp — có chốt **9 đỏ**, bỏ chốt chỉ **5 đỏ**. Tức **4 bài xanh
   * trên một cái kho không có gì**: `cờ TẮT ⇒ 403` · `ĐIỀU 4` · `cua-toi` ·
   * `đầu vào vô nghĩa ⇒ 400`. Rõ nhất là `cờ TẮT`: cổng cờ chặn TRƯỚC khi ai
   * đọc `ban_the_id`, nên nó xanh mà chưa từng chạm một bản thể nào (A11.6).
   *
   * ⚠ Phải chạy CẢ tệp mới thấy: các bài ở đây nối tiếp trạng thái của nhau,
   * chạy lẻ bằng `-t` thì bài 404 đỏ vì kho `amm` chưa có gì — đỏ vì lý do
   * khác, và tôi đã suýt kết luận nhầm từ đúng chỗ đó.
   */
  const motBanThe = async (userId: string): Promise<string> => {
    const [id] = await banTheCua(userId);
    if (id === undefined) throw new Error(`${userId} không còn bản thể ${MAU} tự do`);
    return id;
  };
  const vi_ = async (userId: string): Promise<bigint> =>
    BigInt((await db.pool.query('SELECT bankroll FROM users WHERE user_id = $1', [userId])).rows[0].bankroll);
  const kho = async (userId: string): Promise<number> =>
    Number((await db.pool.query(
      'SELECT COALESCE(so_luong, 0) AS n FROM kho_sticker WHERE user_id = $1 AND sticker_id = $2',
      [userId, MAU])).rows[0]?.n ?? 0);
  /**
   * Giá + cửa mở của MỘT bản, hỏi qua `cua-toi`.
   *
   * ⚠ Trước D296 các bài dưới hỏi `GET /cho/gia/:id`. Route ấy đã gỡ vì không
   * client nào gọi, và vì nó là chỗ thứ BA phải giữ đồng bộ cổng E24. Phép đo
   * KHÔNG đổi — `cua-toi` trả đúng `gia`/`mo` cho từng bản; chỉ đường hỏi đổi.
   */
  const giaCua = async (
    id: string, cookie: string,
  ): Promise<{ gia: number; mo: boolean; ly_do: string | null }> => {
    const { mon } = await (await goi('/api/v1/cho/cua-toi', cookie)).json() as {
      mon: { ban_the_id: string; gia: number; mo: boolean; ly_do: string | null }[] };
    const m = mon.find((x) => x.ban_the_id === id);
    if (!m) throw new Error(`cua-toi không có bản ${id}`);
    return { gia: m.gia, mo: m.mo, ly_do: m.ly_do };
  };

  const caHaiAuditCan = async () => {
    const s = await auditSupply(db.pool);
    expect(s.ok, 'audit:supply — ' + s.problems.join(' | ')).toBe(true);
    const v = await auditVat(db.pool);
    expect(v.can, 'audit:cung — ' + JSON.stringify(v.lech)).toBe(true);
  };

  beforeAll(async () => {
    db = await startTestDb();
    await ensureGenesis(db.pool);
    app = createApp({ pool: db.pool, mailer: new CapturingMailer(), appBaseUrl: 'http://x' });
    a = await createTestUser(db.pool, { bankroll: 1_000 });
    b = await createTestUser(db.pool, { bankroll: 1_000 });
    await db.pool.query(
      `INSERT INTO cosmetic_items (cosmetic_id, family, kind, label, rarity, nguon_cua)
       VALUES ($1, 'dien_mao', 'sticker', $2, 'thuong', 'gacha_t')
       ON CONFLICT (cosmetic_id) DO NOTHING`, [MAU, 'Ria mép']);
    // Cấp 5 nhãn cho A qua đúng đường cấp thật ⇒ ghi song song sinh 5 bản thể.
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await capMonHuuHan(c, a.userId, MAU, 5);
      await c.query('COMMIT');
    } finally { c.release(); }
    expect((await banTheCua(a.userId)).length).toBe(5);
  }, 120_000);

  afterAll(async () => { await db?.stop(); });

  it('⭐ E24: món KHÔNG có trong hộp gacha ⇒ 409, quỹ không suy chuyển', async () => {
    /*
     * Ca thật đã mở trên prod 06/09 (D291): `st_niem_beta` là quà tri ân beta,
     * đã bị gỡ khỏi hộp từ 04/08 nên không ai mua được nó bằng T — mà cửa bán
     * vẫn trả giá epic 600 T cho nó (30% quỹ chợ trong một cú bấm).
     */
    // ⚠ Người RIÊNG: bài này cấp thêm một bản thể, và kho của `a` là đầu vào của
    // bài `cua-toi` bên dưới — dùng chung người là để một bài làm hỏng bài khác.
    const z = await createTestUser(db.pool, { bankroll: 1_000 });
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(
        `INSERT INTO cosmetic_items (cosmetic_id, family, kind, label, rarity, nguon_cua)
         VALUES ('st_niem_beta', 'dien_mao', 'sticker', 'Dấu niêm Beta', 'epic', 'gacha_t')
         ON CONFLICT (cosmetic_id) DO NOTHING`);
      await capMonHuuHan(c, z.userId, 'st_niem_beta', 1);
      await c.query('COMMIT');
    } finally { c.release(); }

    const { rows } = await db.pool.query(
      `SELECT b.ban_the_id::text id FROM vat_pham_ban_the b
         JOIN dot_phat_hanh d ON d.dot_id = b.dot_id
        WHERE b.chu_so_huu = $1 AND d.mau_id = 'st_niem_beta'`, [z.userId]);
    const id = rows[0].id as string;

    const quyTruoc = await soDuQuyCho(db.pool);
    const viTruoc = await vi_(z.userId);

    // Kho của tôi phải nói TRƯỚC, và nói đúng lý do.
    const kq = await (await goi('/api/v1/cho/cua-toi', z.cookie)).json() as {
      mon: { ban_the_id: string; mo: boolean; ly_do: string | null }[] };
    const dong = kq.mon.find((m) => m.ban_the_id === id)!;
    expect(dong.mo).toBe(false);
    expect(dong.ly_do, 'nói nhầm thành quỹ thiếu là hứa nhầm "mai bán được"')
      .toBe('khong_ban_lai');

    const r = await goi('/api/v1/cho/ban', z.cookie, { ban_the_id: id });
    expect(r.status).toBe(409);
    expect((await r.json() as { error: string }).error).toBe('khong_ban_lai');
    expect(await soDuQuyCho(db.pool)).toBe(quyTruoc);
    expect(await vi_(z.userId)).toBe(viTruoc);
    await caHaiAuditCan();
  });

  it('cờ TẮT ⇒ cả hai route đóng (403), không bán theo bảng cũ', async () => {
    coGhi = false;
    const id = await motBanThe(a.userId);
    expect((await goi('/api/v1/cho/cua-toi', a.cookie)).status).toBe(403);
    expect((await goi('/api/v1/cho/ban', a.cookie, { ban_the_id: Number(id) })).status).toBe(403);
    coGhi = true;
  });

  it('quỹ = 0 ⇒ giá vẫn hiện (60 T) nhưng `mo = false`, và bán ⇒ 409 rõ, KHÔNG đổi gì', async () => {
    const id = await motBanThe(a.userId);
    const g = await giaCua(id, a.cookie);
    expect(g.gia).toBe(60);            // thường · tồn kho 0 · hệ số quỹ mặc định
    expect(g.mo).toBe(false);          // vì quỹ chợ = 0 (D65: cửa đóng, không treo)
    const truoc = await vi_(a.userId);
    const r = await goi('/api/v1/cho/ban', a.cookie, { ban_the_id: Number(id) });
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toBe('he_thong_khong_mua');
    expect(await vi_(a.userId)).toBe(truoc);
    expect(await kho(a.userId)).toBe(5);
    await caHaiAuditCan();
  });

  it('⭐ ĐIỀU 1+2 — rót vốn, bán một nhãn: ví +60 đúng gia_san, nhãn rời kho, bản thể sang kho AMM', async () => {
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await napQuyChoTuKhoBac(c, 300n);   // đủ mua đúng 5 nhãn thường (60 × 5)
      await c.query('COMMIT');
    } finally { c.release(); }

    const id = await motBanThe(a.userId);
    const g = await giaCua(id, a.cookie);
    expect(g).toMatchObject({ gia: 60, mo: true });

    const truoc = await vi_(a.userId);
    const r = await goi('/api/v1/cho/ban', a.cookie, { ban_the_id: Number(id) });
    expect(r.status).toBe(200);
    const kq = await r.json() as { gia: number; bankroll: number; quy_cho: number };
    expect(kq.gia).toBe(60);
    expect(BigInt(kq.bankroll)).toBe(truoc + 60n);
    expect(kq.quy_cho).toBe(240);

    expect(await vi_(a.userId)).toBe(truoc + 60n);
    expect(await kho(a.userId)).toBe(4);
    const { rows } = await db.pool.query(
      'SELECT chu_so_huu, kho, trang_thai FROM vat_pham_ban_the WHERE ban_the_id = $1', [id]);
    expect(rows[0]).toMatchObject({ chu_so_huu: null, kho: 'amm', trang_thai: 'tu_do' });
    // Sự kiện đi cùng transaction, chỉ số + id.
    const ev = await db.pool.query(
      `SELECT value_num, value_json FROM events WHERE user_id = $1 AND action_type = 'cho_ban'`, [a.userId]);
    expect(ev.rowCount).toBe(1);
    expect(Number(ev.rows[0].value_num)).toBe(60);
  });

  it('⭐ ĐIỀU 3 — sau khi bán, CẢ HAI audit cùng cân', async () => {
    await caHaiAuditCan();
  });

  it('bán lại đúng bản đã bán ⇒ 404 không sở hữu; người khác bán bản của tôi ⇒ 404', async () => {
    const { rows } = await db.pool.query(
      `SELECT ban_the_id::text AS id FROM vat_pham_ban_the WHERE kho = 'amm' LIMIT 1`);
    const daBan = rows[0].id as string;
    expect((await goi('/api/v1/cho/ban', a.cookie, { ban_the_id: Number(daBan) })).status).toBe(404);
    const conLai = await motBanThe(a.userId);
    expect((await goi('/api/v1/cho/ban', b.cookie, { ban_the_id: Number(conLai) })).status).toBe(404);
    expect(await kho(a.userId)).toBe(4);
  });

  it('giá đi theo bậc thang tồn kho: kho AMM có 1 bản ⇒ giá mua vào tụt 60 → 54', async () => {
    const id = await motBanThe(a.userId);
    const g = await giaCua(id, a.cookie);
    expect(g.gia).toBe(54);   // HS_TON_KHO_BP[1] = 9.000
  });

  it('⭐ HAI TAB bán CÙNG một bản: đúng một 200, kho trừ đúng 1, một dòng sổ ví', async () => {
    const id = await motBanThe(a.userId);
    const khoTruoc = await kho(a.userId);
    const viTruoc = await vi_(a.userId);
    const [r1, r2] = await Promise.all([
      goi('/api/v1/cho/ban', a.cookie, { ban_the_id: Number(id) }),
      goi('/api/v1/cho/ban', a.cookie, { ban_the_id: Number(id) }),
    ]);
    const ma = [r1.status, r2.status].sort();
    expect(ma[0]).toBe(200);
    expect([404, 409]).toContain(ma[1]);
    expect(await kho(a.userId)).toBe(khoTruoc - 1);
    const soDong = await db.pool.query(
      `SELECT count(*)::int AS n FROM wallet_ledger WHERE user_id = $1 AND reason = 'ban_cho_he_thong'`, [a.userId]);
    expect(Number(soDong.rows[0].n)).toBe(2);   // lần trước + lần này
    expect(await vi_(a.userId)).toBe(viTruoc + 54n);
    await caHaiAuditCan();
  });

  it('⭐ ĐIỀU 4 — bán tới khi quỹ cạn: 409 rõ "Hệ thống hiện không mua", không treo, không đổi gì', async () => {
    // Quỹ còn 240 − 54 = 186. Giá kế: tồn 2 ⇒ 48; tồn 3 ⇒ 42; tồn 4 ⇒ 36. Đủ cho 3 lần nữa (126), còn 60.
    let ban = 0;
    for (;;) {
      const ids = await banTheCua(a.userId);
      if (ids.length === 0) break;
      const r = await goi('/api/v1/cho/ban', a.cookie, { ban_the_id: Number(ids[0]) });
      if (r.status === 200) { ban += 1; continue; }
      expect(r.status).toBe(409);
      break;
    }
    // Sau vòng lặp: quỹ chợ không âm, và hoặc hết nhãn hoặc bị từ chối rõ.
    expect(await soDuQuyCho(db.pool)).toBeGreaterThanOrEqual(0n);
    expect(ban).toBeGreaterThanOrEqual(1);
    await caHaiAuditCan();
  });

  it('`GET /cho/cua-toi` — cái màn cần để vẽ nút: từng bản thể, giá, và cửa mở hay không', async () => {
    const r = await goi('/api/v1/cho/cua-toi', a.cookie);
    expect(r.status).toBe(200);
    const kq = await r.json() as { quy_cho: number; mon: Array<{ ban_the_id: string; seri: number; gia: number; mo: boolean; ten: string }> };
    const conLai = await banTheCua(a.userId);
    expect(kq.mon.map((m) => m.ban_the_id)).toEqual(conLai);      // đúng của tôi, đúng thứ tự seri
    for (const m of kq.mon) {
      expect(m.gia).toBeGreaterThan(0);
      expect(typeof m.mo).toBe('boolean');
      expect(m.ten).toBe('Nhãn bán thử');
    }
    // B không có nhãn nào ⇒ danh sách rỗng, không phải lỗi.
    const rb = await goi('/api/v1/cho/cua-toi', b.cookie);
    expect(((await rb.json()) as { mon: unknown[] }).mon).toEqual([]);
    // Cờ tắt ⇒ 403 như hai route kia.
    coGhi = false;
    expect((await goi('/api/v1/cho/cua-toi', a.cookie)).status).toBe(403);
    coGhi = true;
  });

  it('đầu vào vô nghĩa ⇒ 400, không chạm DB', async () => {
    for (const body of [{}, { ban_the_id: -1 }, { ban_the_id: 'abc' }, { ban_the_id: 1.5 }]) {
      expect((await goi('/api/v1/cho/ban', a.cookie, body)).status).toBe(400);
    }
    // `cua-toi` không nhận tham số nên không có ca 400 tương ứng; ca đầu vào
    // vô nghĩa của cửa BÁN ở trên mới là chỗ canh việc kiểm `ban_the_id`.
  });

  it('⭐ ĐIỀU 5 (quét) — ba chân của giao dịch đều còn trong route, giữa BEGIN và COMMIT', () => {
    // Xoá một chân là xoá một vế của bất biến A/E2 — audit sẽ đỏ trên prod, nhưng
    // bài này đỏ TRƯỚC ở máy. Quét thân không chú thích.
    const src = readFileSync(join(process.cwd(), 'server/cho.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const than = src.slice(src.indexOf("query('BEGIN')"), src.indexOf("query('COMMIT')"));
    expect(than.match(/quyChoAppend\(/g)?.length, 'chân quỹ chợ').toBe(1);
    expect(than.match(/INSERT INTO wallet_ledger/g)?.length, 'chân sổ ví').toBe(1);
    // Sổ vật + cache đi qua CỔNG (B1): đúng MỘT lời gọi, và route KHÔNG ghi tay
    // hai bảng đó — đường ghi thứ sáu đã bị bài quét B1 bắt một lần rồi.
    expect(than.match(/chuyenBanTheVaoKho\(/g)?.length, 'chân sổ vật + cache (qua cổng)').toBe(1);
    expect(than.match(/UPDATE (vat_pham_ban_the|kho_sticker)/g), 'route không được ghi tay hai bảng này').toBeNull();
    expect(than.match(/INSERT INTO events/g)?.length, 'chân sự kiện').toBe(1);
  });
});
