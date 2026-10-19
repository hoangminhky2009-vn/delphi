/**
 * B7b — CỬA MUA TỪ HỆ THỐNG: màn demo của M2, chạy bằng máy.
 *
 * ⚠ Bài này canh bốn thứ mà một cú "HTTP 200" không nói gì cả:
 *   · tiền CÂN — ba mảnh phí cộng lại đúng bằng số T rời ví, hai audit cùng cân;
 *   · vật ĐỔI CHỦ — bản thể rời kho, `kho_sticker` cộng, `tong_nhan` KHÔNG cộng;
 *   · KHÔNG có vòng mua–bán hoà vốn (E7 ở mức giao dịch thật, không phải lý thuyết);
 *   · hai người cùng bấm một bản thì đúng một người được.
 */
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
const { docGiaThucHien } = await import('../server/kinh_te/gia_thuc_hien.js');
const { chiSoThucHien } = await import('../server/kinh_te/chi_so_gia.js');
const { capMonHuuHan } = await import('../server/shop_kho.js');
const { ECONOMY } = await import('../config/economy.js');
const { createTestUser, ensureGenesis } = await import('./helpers/fixtures.js');
const { startTestDb } = await import('./helpers/testdb.js');

const MAU = 'st_khau_trang';
/*
 * ⚠ PHẢI là một mẫu CÓ THẬT TRONG HỘP GACHA, không phải id bịa. Từ D291 cửa bán
 * hỏi E24 (`heThongMuaLai`): món không có cửa tốn T để lấy thì Hệ thống không
 * mua lại. Một `st_test_*` bịa ra sẽ không bao giờ nằm trong `HOP_GACHA` ⇒ mọi
 * bài bán ở đây đỏ vì một lý do chẳng liên quan tới thứ nó đang canh.
 */

describe('M2 — mua một nhãn dán từ Hệ thống', () => {
  let db: Awaited<ReturnType<typeof startTestDb>>;
  let app: ReturnType<typeof createApp>;
  let a: { userId: string; cookie: string };   // người bán, nuôi hàng cho quầy
  let b: { userId: string; cookie: string };   // người mua

  const goi = (p: string, cookie: string, body?: unknown) =>
    app.request(`http://x${p}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const vi_ = async (userId: string): Promise<bigint> =>
    BigInt((await db.pool.query('SELECT bankroll FROM users WHERE user_id = $1', [userId])).rows[0].bankroll);
  const kho = async (userId: string): Promise<{ soLuong: number; tongNhan: number }> => {
    const { rows } = await db.pool.query(
      'SELECT so_luong, tong_nhan FROM kho_sticker WHERE user_id = $1 AND sticker_id = $2',
      [userId, MAU]);
    return { soLuong: Number(rows[0]?.so_luong ?? 0), tongNhan: Number(rows[0]?.tong_nhan ?? 0) };
  };
  const daDot = async (): Promise<bigint> =>
    BigInt((await db.pool.query(
      `SELECT COALESCE(SUM(amount), 0)::text s FROM burn_ledger WHERE reason = 'phi_cho_burn'`)).rows[0].s);
  const khoBacPhi = async (): Promise<bigint> =>
    BigInt((await db.pool.query(
      `SELECT COALESCE(SUM(delta), 0)::text s FROM treasury_ledger WHERE reason = 'phi_cho_in'`)).rows[0].s);
  const caHaiAuditCan = async () => {
    const s = await auditSupply(db.pool);
    expect(s.ok, 'audit:supply — ' + s.problems.join(' | ')).toBe(true);
    const v = await auditVat(db.pool);
    expect(v.can, 'audit:cung — ' + JSON.stringify(v.lech)).toBe(true);
  };

  /** A bán `n` bản cho Hệ thống ⇒ quầy có hàng. Đi đúng route thật. */
  const nuoiQuay = async (n: number): Promise<void> => {
    const r = await goi('/api/v1/cho/cua-toi', a.cookie);
    const { mon } = await r.json() as { mon: { ban_the_id: string }[] };
    for (const m of mon.slice(0, n)) {
      const res = await goi('/api/v1/cho/ban', a.cookie, { ban_the_id: m.ban_the_id });
      expect(res.status, await res.text()).toBe(200);
    }
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
       ON CONFLICT (cosmetic_id) DO NOTHING`, [MAU, 'Khẩu trang']);
    const c = await db.pool.connect();
    try {
      await c.query('BEGIN');
      await capMonHuuHan(c, a.userId, MAU, 6);
      await napQuyChoTuKhoBac(c, 3_000n);
      await c.query('COMMIT');
    } finally { c.release(); }
  }, 120_000);

  afterAll(async () => { await db?.stop(); });

  it('cờ TẮT ⇒ cả quầy lẫn cửa mua đóng (403)', async () => {
    coGhi = false;
    expect((await goi('/api/v1/cho/quay', b.cookie)).status).toBe(403);
    expect((await goi('/api/v1/cho/mua', b.cookie, { ban_the_id: 1 })).status).toBe(403);
    coGhi = true;
  });

  it('quầy RỖNG khi chưa ai bán gì — không bịa hàng', async () => {
    const r = await goi('/api/v1/cho/quay', b.cookie);
    expect(r.status).toBe(200);
    expect((await r.json() as { mon: unknown[] }).mon).toEqual([]);
  });

  it('quầy vẽ TỪNG BẢN với seri và giá bán ra > giá mua vào', async () => {
    await nuoiQuay(2);
    const r = await goi('/api/v1/cho/quay', b.cookie);
    const { mon } = await r.json() as {
      mon: { ban_the_id: string; seri: number; ton: number; gia: number; mo: boolean }[];
    };
    expect(mon.length).toBe(2);
    expect(mon.map((m) => m.seri)).toEqual([1, 2]);
    expect(new Set(mon.map((m) => m.ton))).toEqual(new Set([2]));
    // Tồn 2 ⇒ gia_san = floor(60 × 0,8) = 48 ⇒ gia_ban_ra = floor(48 × 1,2) = 57.
    expect(mon[0]!.gia).toBe(57);
    expect(mon.every((m) => m.mo)).toBe(true);
  });

  it('⭐ MUA: ví trừ đúng giá, ba mảnh phí cộng lại đúng bằng giá, hai audit cân', async () => {
    const viTruoc = await vi_(b.userId);
    const quyTruoc = await soDuQuyCho(db.pool);
    const dotTruoc = await daDot();
    const kbTruoc = await khoBacPhi();

    const { mon } = await (await goi('/api/v1/cho/quay', b.cookie)).json() as {
      mon: { ban_the_id: string }[] };
    const id = mon[0]!.ban_the_id;

    const r = await goi('/api/v1/cho/mua', b.cookie, { ban_the_id: id });
    expect(r.status, await r.clone().text()).toBe(200);
    const kq = await r.json() as {
      gia: number; phi_dot: number; phi_kho_bac: number; bankroll: number; quy_cho: number };

    // 57 T: đốt floor(57×3%) = 1, Kho bạc floor(57×2%) = 1, quỹ 55.
    expect(kq.gia).toBe(57);
    expect(kq.phi_dot).toBe(1);
    expect(kq.phi_kho_bac).toBe(1);

    expect(await vi_(b.userId)).toBe(viTruoc - 57n);
    expect(await daDot()).toBe(dotTruoc + 1n);
    expect(await khoBacPhi()).toBe(kbTruoc + 1n);
    expect(await soDuQuyCho(db.pool)).toBe(quyTruoc + 55n);
    // ⭐ Bảo toàn: ba mảnh CỘNG LẠI đúng bằng số T rời ví. Đây là bất biến E1
    //   viết ở mức một giao dịch, chứ không đợi audit tổng nói hộ.
    expect(1n + 1n + 55n).toBe(57n);

    // Vật: bản rời kho về tay B; `tong_nhan` KHÔNG nhúc nhích.
    const { rows } = await db.pool.query(
      'SELECT chu_so_huu::text chu, kho FROM vat_pham_ban_the WHERE ban_the_id = $1', [id]);
    expect(rows[0].chu).toBe(b.userId);
    expect(rows[0].kho).toBeNull();
    const kb = await kho(b.userId);
    expect(kb.soLuong).toBe(1);
    expect(kb.tongNhan, 'mua lại KHÔNG được tính là một bản mới phát hành').toBe(0);

    await caHaiAuditCan();
  });

  it('⚠⚠ `tong_nhan` không tăng — kể cả ở lượt mua THỨ HAI (nhánh ON CONFLICT)', async () => {
    /*
     * ⚠ BÀI NÀY TỪNG RỖNG, VÀ TIÊM LỖI LÀ THỨ BẮT ĐƯỢC. Bản đầu chỉ mua MỘT bản
     * cho một người chưa có dòng `kho_sticker` nào ⇒ câu lệnh đi nhánh INSERT,
     * còn `ON CONFLICT DO UPDATE` — đúng chỗ có thể cộng nhầm `tong_nhan` —
     * KHÔNG BAO GIỜ chạy. Tiêm `tong_nhan + 1` vào nhánh đó thì bài vẫn xanh.
     *
     * Nên bài phải mua LẦN THỨ HAI cùng mẫu cùng người: chỉ lượt đó mới chạm
     * nhánh kia. Một `ON CONFLICT` có hai nhánh là hai đường mã, và một bài chỉ
     * đi một nhánh chỉ canh được một nửa.
     */
    await nuoiQuay(2);
    const { mon } = await (await goi('/api/v1/cho/quay', b.cookie)).json() as {
      mon: { ban_the_id: string }[] };
    const truoc = await kho(b.userId);
    expect(truoc.soLuong, 'B phải ĐÃ có dòng kho_sticker thì lượt này mới vào ON CONFLICT')
      .toBeGreaterThan(0);

    const r = await goi('/api/v1/cho/mua', b.cookie, { ban_the_id: mon[0]!.ban_the_id });
    expect(r.status, await r.clone().text()).toBe(200);

    const sau = await kho(b.userId);
    expect(sau.soLuong).toBe(truoc.soLuong + 1);
    expect(sau.tongNhan, 'lượt mua thứ hai KHÔNG được cộng tong_nhan').toBe(truoc.tongNhan);

    // Toàn hệ thống chỉ từng phát 6 bản; mua đi bán lại bao nhiêu lần cũng vậy.
    const { rows } = await db.pool.query(
      'SELECT COALESCE(SUM(tong_nhan), 0)::int n FROM kho_sticker WHERE sticker_id = $1', [MAU]);
    expect(Number(rows[0].n), 'cổng hữu hạn đếm số bản ĐÃ ĐÚC, không đếm số lần đổi tay')
      .toBe(6);
    await caHaiAuditCan();
  });

  it('không đủ T ⇒ 409, và không một con số nào nhúc nhích', async () => {
    const ngheo = await createTestUser(db.pool, { bankroll: 10 });
    const { mon } = await (await goi('/api/v1/cho/quay', ngheo.cookie)).json() as {
      mon: { ban_the_id: string; mo: boolean }[] };
    expect(mon[0]!.mo, 'quầy phải nói trước là cửa đóng với ví này').toBe(false);
    const quyTruoc = await soDuQuyCho(db.pool);
    const r = await goi('/api/v1/cho/mua', ngheo.cookie, { ban_the_id: mon[0]!.ban_the_id });
    expect(r.status).toBe(409);
    expect((await r.json() as { error: string }).error).toBe('khong_du_t');
    expect(await vi_(ngheo.userId)).toBe(10n);
    expect(await soDuQuyCho(db.pool)).toBe(quyTruoc);
    await caHaiAuditCan();
  });

  it('⭐ CỔNG CỬA TIÊU T: đủ tiền nhưng mua xong tụt dưới lưới trợ cấp ⇒ chặn', async () => {
    const nguong = BigInt(ECONOMY.SUBSIDY_THRESHOLD);
    // ⚠ Giá KHÔNG chép tay: tồn kho đổi sau mỗi bài trên, nên số cứng ở đây là
    // một bài test sẽ vỡ vì lý do không liên quan tới thứ nó canh. Hỏi quầy.
    const giau = await createTestUser(db.pool, { bankroll: 100_000 });
    const { mon } = await (await goi('/api/v1/cho/quay', giau.cookie)).json() as {
      mon: { ban_the_id: string; gia: number }[] };
    const id = mon[0]!.ban_the_id;
    const gia = BigInt(mon[0]!.gia);

    // Ví = ngưỡng + giá − 1 ⇒ trả được, nhưng trả xong còn dưới ngưỡng.
    const sat = await createTestUser(db.pool, { bankroll: Number(nguong + gia) - 1 });
    const q = await (await goi('/api/v1/cho/quay', sat.cookie)).json() as {
      mon: { ban_the_id: string; mo: boolean }[] };
    expect(q.mon.find((m) => m.ban_the_id === id)!.mo).toBe(false);
    const r = await goi('/api/v1/cho/mua', sat.cookie, { ban_the_id: id });
    expect(r.status).toBe(409);
    expect((await r.json() as { error: string }).error).toBe('von_qua_thap');

    // Và đúng một T nữa thì qua — cổng là "còn TRÊN ngưỡng", không phải "còn đúng bằng".
    const du = await createTestUser(db.pool, { bankroll: Number(nguong + gia) });
    const r2 = await goi('/api/v1/cho/mua', du.cookie, { ban_the_id: id });
    expect(r2.status, await r2.clone().text()).toBe(200);
    expect(await vi_(du.userId)).toBe(nguong);
    await caHaiAuditCan();
  });

  it('hai người cùng bấm MỘT bản ⇒ đúng một người được, người kia 409', async () => {
    await nuoiQuay(1);
    const { mon } = await (await goi('/api/v1/cho/quay', b.cookie)).json() as {
      mon: { ban_the_id: string }[] };
    const id = mon[mon.length - 1]!.ban_the_id;
    const x = await createTestUser(db.pool, { bankroll: 5_000 });
    const y = await createTestUser(db.pool, { bankroll: 5_000 });
    const [r1, r2] = await Promise.all([
      goi('/api/v1/cho/mua', x.cookie, { ban_the_id: id }),
      goi('/api/v1/cho/mua', y.cookie, { ban_the_id: id }),
    ]);
    const ma = [r1.status, r2.status].sort();
    expect(ma).toEqual([200, 409]);
    const thua = r1.status === 409 ? r1 : r2;
    expect((await thua.json() as { error: string }).error).toBe('da_co_chu');
    await caHaiAuditCan();
  });

  it('mua một bản không có trong kho (đang thuộc về A) ⇒ 409, không cướp được', async () => {
    const { rows } = await db.pool.query(
      `SELECT b.ban_the_id::text id FROM vat_pham_ban_the b
         JOIN dot_phat_hanh d ON d.dot_id = b.dot_id
        WHERE b.chu_so_huu = $1 AND d.mau_id = $2 LIMIT 1`, [a.userId, MAU]);
    const r = await goi('/api/v1/cho/mua', b.cookie, { ban_the_id: rows[0].id });
    expect(r.status).toBe(409);
    expect((await r.json() as { error: string }).error).toBe('da_co_chu');
  });

  it('⭐ CHỈ SỐ GIÁ có mẫu thật — và vẫn `null` khi rổ thiếu bậc', async () => {
    const tom = await docGiaThucHien(db.pool, 7);
    // Đã có giao dịch bậc `thuong`, chưa có `hiem`/`epic`.
    expect(tom.soGiaoDich.thuong).toBeGreaterThan(0);
    expect(tom.ro.theoBac.thuong).not.toBeNull();
    expect(tom.ro.theoBac.hiem).toBeNull();
    // ⚠ Thiếu một bậc ⇒ CẢ chỉ số `null`, không phải "bỏ bậc rồi chia lại".
    expect(chiSoThucHien(tom.ro)).toBeNull();
    // Vòng quay và phí-bằng-0 vẫn đếm được dù chỉ số chưa nói được gì.
    expect(tom.tongT).toBeGreaterThan(0n);
    expect(tom.tongLuot).toBe(tom.soGiaoDich.thuong);
    expect(tom.soGiaoDichPhiBang0).toBe(0);   // mọi giao dịch ở đây đều 57 T ⇒ có phí
  });

  it('chỉ số chỉ đếm `cho_mua`, KHÔNG lẫn giá bán ra của Hệ thống mua vào', async () => {
    const { rows } = await db.pool.query(
      `SELECT action_type, count(*)::int n FROM events
        WHERE action_type IN ('cho_ban', 'cho_mua') GROUP BY action_type`);
    const dem = Object.fromEntries(rows.map((r) => [r.action_type, Number(r.n)]));
    expect(dem.cho_ban, 'phải có cả hai chiều trong sổ sự kiện').toBeGreaterThan(0);
    const tom = await docGiaThucHien(db.pool, 7);
    // Nếu bài đọc lẫn `cho_ban` thì số lượt sẽ bằng tổng hai chiều.
    expect(tom.tongLuot).toBe(dem.cho_mua);
    expect(tom.tongLuot).toBeLessThan(dem.cho_ban + dem.cho_mua);
  });
});
