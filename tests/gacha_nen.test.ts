/**
 * HAI LÁ TRADER TRONG HỘP GACHA — test DB THẬT, đi qua HTTP (D68a, 04/08).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VÌ SAO FILE NÀY TỒN TẠI RIÊNG, KHÔNG NHÉT VÀO `shop.test.ts`
 *
 * `shop.test.ts` khoá luật của hộp khi hộp chỉ rơi NHÃN DÁN. Nhãn dán là vật tiêu
 * hao (D36): bản thứ hai là +1 vào kho, nên "đã có rồi" không phải một trạng thái
 * và không có luật nào phải canh nó. Từ 04/08 hộp rơi thêm hai lá NỀN độc bản, và
 * mọi bất biến mới đều xoay quanh đúng cái trạng thái đó.
 *
 * ⚠ ĐÂY LÀ ĐƯỜNG ĐỤNG TIỀN, nên mọi bài đo Ở DB chứ không đọc response rồi tin:
 * response là thứ dễ nhất để viết đúng và cũng là thứ nói dối rẻ nhất.
 *
 * BẤT BIẾN ĐẮT NHẤT (§4): TRÚNG LÁ ĐÃ CÓ THÌ KHÔNG MẤT MỘT ĐỒNG NÀO. Founder gọi
 * đó là "hoàn T"; cài thành "không trừ" vì `burn_ledger` append-only + `CHECK
 * amount > 0` nên đốt-rồi-hoàn là MINT, phạm A3.4. Hai cách cho người chơi cùng
 * kết quả, chỉ một cách không sinh T ra từ không khí.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type pg from 'pg';
import { AVATAR_NEN } from '../config/avatar.js';
import { GACHA } from '../server/sandbox/gacha.js';
import { HOP_GACHA } from '../server/sandbox/ung_vien.js';
import { cuaCuaMon } from '../server/shop.js';
import { auditSupply } from '../server/audit.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { createTestUser, ensureGenesis } from './helpers/fixtures.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';

/** Hai lá độc bản, đọc từ config — không gõ id vào test (nguồn chân lý một chỗ). */
const DOC_BAN = AVATAR_NEN.filter((n) => n.doc_ban === true);

describe('Hai lá trader — catalog & tường lửa (thuần)', () => {
  it('cả hai lá độc bản đều nằm trong bảng rơi', () => {
    for (const n of DOC_BAN) {
      expect(HOP_GACHA.map((m) => m.id), `${n.id} không rơi được`).toContain(n.id);
    }
  });

  it('`cuaCuaMon` nhận ra lá nền cửa gacha — lỗ tường lửa A3.5 đã vá', () => {
    for (const n of DOC_BAN) expect(cuaCuaMon(n.id)).toBe('gacha_t');
  });

  it('lá cửa gacha KHÔNG có giá Q — một món đúng một cửa', () => {
    for (const n of DOC_BAN) expect(n.gia_q).toBeNull();
  });

  it('⚠ migration 0033 phải khoá ĐÚNG những mã `doc_ban` trong config', async () => {
    /*
     * Hai nguồn chân lý (config TypeScript ↔ partial index SQL) là chủ ý: DB
     * không đọc được TS, mà chốt cuối của luật độc bản phải nằm ở DB. Bài này là
     * thứ giữ chúng không trôi khỏi nhau — thêm lá độc bản mà quên migration thì
     * đỏ ngay, thay vì phát hiện lúc có người cầm hai bản của lá "độc bản".
     */
    const sql = await readFile('migrations/0033_gacha_avatar_nen.sql', 'utf8');
    const khop = /WHERE nen IN \(([^)]*)\)/.exec(sql);
    expect(khop, 'không tìm thấy partial index độc bản').not.toBeNull();
    const maTrongSql = [...khop![1]!.matchAll(/'([A-Z])'/g)].map((m) => m[1]!).sort();
    expect(maTrongSql).toEqual(DOC_BAN.map((n) => n.ma).sort());
  });
});

describe('Hai lá trader — đường chạy thật qua HTTP', () => {
  let db: TestDb;
  let pool: pg.Pool;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
    await ensureGenesis(pool);
    app = createApp({
      pool, mailer: new CapturingMailer(),
      appBaseUrl: 'https://dubao.test', secureCookie: false,
    });
  }, 180_000);
  afterAll(async () => { await db?.stop(); });

  const goi = (p: string, cookie: string, body?: unknown) =>
    app.request(`http://x${p}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  /**
   * Nạp ví đủ quay N lượt mà vẫn trên ngưỡng trợ cấp.
   *
   * ⚠ PHẢI GHI BÚT TOÁN, không được `UPDATE bankroll` trần. Bản đầu của helper
   * này sửa thẳng số dư và bài audit đỏ ngay — đúng như nó phải thế: một cú tăng
   * ví không có dòng sổ nào là MINT LẬU, và bất biến A của `auditSupply`
   * (`mint − đốt == Σ ví + pool + kho bạc`) tồn tại để bắt đúng chuyện đó.
   * Giữ ghi chú này vì nó là bằng chứng bài audit không phải trang trí.
   */
  async function napVi(userId: string, luot: number): Promise<void> {
    const dich = BigInt(500 + GACHA.COST_T * luot + 10);
    const truoc = await soDu(userId);
    const delta = dich - truoc;
    if (delta === 0n) return;
    await pool.query('UPDATE users SET bankroll = $2 WHERE user_id = $1',
      [userId, dich.toString()]);
    await pool.query(
      `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
       VALUES ($1, $2, $3, 'admin_adjust')`,
      [userId, delta.toString(), dich.toString()],
    );
  }

  const soDu = async (userId: string): Promise<bigint> => BigInt(
    (await pool.query('SELECT bankroll FROM users WHERE user_id = $1', [userId]))
      .rows[0].bankroll);

  const demDot = async (): Promise<bigint> => BigInt(
    (await pool.query('SELECT COALESCE(SUM(amount),0)::text AS s FROM burn_ledger'))
      .rows[0].s);

  it('catalog trả bảng rơi CÓ hai lá, kèm `loai`/`ma` để màn vẽ được', async () => {
    const u = await createTestUser(pool);
    const j = await (await goi('/api/v1/shop/catalog', u.cookie)).json() as {
      hop: { mon: { id: string; loai: string; ma: string | null; da_co: boolean }[];
             con_hang: Record<string, boolean> };
    };
    for (const n of DOC_BAN) {
      const m = j.hop.mon.find((x) => x.id === n.id);
      expect(m, `${n.id} vắng mặt ở bảng rơi`).toBeDefined();
      expect(m!.loai).toBe('nen');
      expect(m!.ma).toBe(n.ma);
      expect(m!.da_co).toBe(false);
    }
    expect(j.hop.con_hang.epic).toBe(true);
  });

  it('Dấu niêm Beta KHÔNG còn trong bảng rơi (chuyển thành quà beta)', async () => {
    const u = await createTestUser(pool);
    const j = await (await goi('/api/v1/shop/catalog', u.cookie)).json() as {
      hop: { mon: { id: string }[] };
    };
    expect(j.hop.mon.map((m) => m.id)).not.toContain('st_niem_beta');
  });

  it('quay đủ nhiều thì lá nền RƠI THẬT, và nó vào `avatar_so_huu` chứ không phải kho sticker',
    async () => {
      const u = await createTestUser(pool);
      await napVi(u.userId, 120);
      let raNen = false;
      for (let i = 0; i < 120 && !raNen; i += 1) {
        const r = await goi('/api/v1/shop/hop', u.cookie, {});
        if (r.status !== 200) break;
        const j = await r.json() as { mon: { loai: string } };
        if (j.mon.loai === 'nen') raNen = true;
      }
      expect(raNen, 'quay 120 lượt không ra lá nền nào — bảng rơi chưa nối?').toBe(true);
      const { rows } = await pool.query(
        `SELECT nen FROM avatar_so_huu WHERE user_id = $1 AND nguon = 'gacha_t'`,
        [u.userId]);
      expect(rows.length).toBeGreaterThan(0);
      expect(DOC_BAN.map((n) => n.ma)).toContain(rows[0].nen);
    }, 120_000);

  it('⭐ ĐỘC BẢN: đã có lá nào thì KHÔNG BAO GIỜ nhận bản thứ hai của lá đó', async () => {
    const u = await createTestUser(pool);
    await napVi(u.userId, 150);
    for (let i = 0; i < 150; i += 1) {
      const r = await goi('/api/v1/shop/hop', u.cookie, {});
      if (r.status !== 200) break;
    }
    const { rows } = await pool.query(
      `SELECT nen, COUNT(*)::int AS n FROM avatar_so_huu
        WHERE user_id = $1 AND nen = ANY($2) GROUP BY nen`,
      [u.userId, DOC_BAN.map((n) => n.ma)]);
    for (const r of rows) {
      expect(Number(r.n), `mã ${r.nen} có ${r.n} bản — luật độc bản vỡ`).toBe(1);
    }
  }, 150_000);

  it('⭐ DB CHẶN CUỐI: ghi tay bản thứ hai của lá độc bản bị Postgres từ chối', async () => {
    /*
     * Phép lọc ở tầng code đọc tập sở hữu ở đầu transaction; hai tab quay cùng
     * lúc thì cả hai cùng đọc "chưa có". `UNIQUE (user_id, nen, seri)` KHÔNG cứu
     * được vì `taoAvatarNen` tự tăng seri — bản thứ hai vào ô seri 2 hợp lệ.
     * Bài này đo chốt cuối, không đo phép lọc.
     */
    const u = await createTestUser(pool);
    const ma = DOC_BAN[0]!.ma;
    await pool.query(
      `INSERT INTO avatar_so_huu (user_id, nen, nguon, seri, chuoi)
       VALUES ($1, $2, 'gacha_t', 1, '2A0--')`, [u.userId, ma]);
    await expect(pool.query(
      `INSERT INTO avatar_so_huu (user_id, nen, nguon, seri, chuoi)
       VALUES ($1, $2, 'gacha_t', 2, '2A0--')`, [u.userId, ma],
    )).rejects.toMatchObject({ code: '23505' });
  });

  it('⭐⭐ TIỀN: mỗi lượt thành công trừ ĐÚNG giá, và tổng đốt tăng đúng bấy nhiêu', async () => {
    const u = await createTestUser(pool);
    await napVi(u.userId, 5);
    const truoc = await soDu(u.userId);
    const dotTruoc = await demDot();
    const r = await goi('/api/v1/shop/hop', u.cookie, {});
    expect(r.status).toBe(200);
    const j = await r.json() as { trung: boolean };
    const sau = await soDu(u.userId);
    const dotSau = await demDot();
    if (j.trung) {
      // Nhánh trùng: KHÔNG được trừ, KHÔNG được đốt.
      expect(sau).toBe(truoc);
      expect(dotSau).toBe(dotTruoc);
    } else {
      expect(truoc - sau).toBe(BigInt(GACHA.COST_T));
      expect(dotSau - dotTruoc).toBe(BigInt(GACHA.COST_T));
    }
  });

  it('⭐⭐ KHÔNG MINT: sau cả loạt quay, bất biến cung tiền vẫn CÂN (A3.4)', async () => {
    const u = await createTestUser(pool);
    await napVi(u.userId, 40);
    for (let i = 0; i < 40; i += 1) {
      const r = await goi('/api/v1/shop/hop', u.cookie, {});
      if (r.status !== 200) break;
    }
    const kq = await auditSupply(pool);
    expect(kq.ok, `audit lệch: ${JSON.stringify(kq)}`).toBe(true);
  }, 120_000);

  it('⭐ NÓI THẬT: có đủ hai lá ⇒ catalog báo cửa epic đã hết, không dán 5% giả', async () => {
    const u = await createTestUser(pool);
    for (const n of DOC_BAN) {
      await pool.query(
        `INSERT INTO avatar_so_huu (user_id, nen, nguon, seri, chuoi)
         VALUES ($1, $2, 'gacha_t', 1, '2A0--')`, [u.userId, n.ma]);
    }
    const j = await (await goi('/api/v1/shop/catalog', u.cookie)).json() as {
      hop: { con_hang: Record<string, boolean>; mon: { id: string; da_co: boolean }[] };
    };
    expect(j.hop.con_hang.epic).toBe(false);
    expect(j.hop.con_hang.thuong).toBe(true);
    for (const n of DOC_BAN) {
      expect(j.hop.mon.find((m) => m.id === n.id)!.da_co).toBe(true);
    }
  });

  it('⭐⭐ PHÉP LỌC PHẢI CÒN SỐNG: đã đủ bộ thì KHÔNG lượt nào rơi vào nhánh trùng',
    async () => {
      /*
       * ⚠ BÀI NÀY SINH RA TỪ MỘT PHÉP TIÊM LỖI CHO KẾT QUẢ XANH GIẢ (04/08).
       *
       * Gỡ phép lọc theo sở hữu ở route mà cả bộ test vẫn XANH — vì partial unique
       * index (0033) đỡ hộ ở DB và savepoint biến cú nổ thành `trung: true`. Hai
       * lớp bảo vệ là tốt, nhưng mọi bài khi đó chỉ khoá KẾT QUẢ CUỐI (mỗi mã một
       * bản), nên chúng không phân biệt được lớp nào đang gánh.
       *
       * Hậu quả nếu lọc chết mà không ai biết: người đủ bộ quay mãi vào nhánh
       * trùng — không mất tiền, nhưng cũng không nhận gì, và cửa epic thành một
       * cái nút không làm gì. Nhánh trùng là ĐƯỜNG THOÁT HIỂM cho một cuộc đua
       * hiếm, không phải đường chạy thường ngày.
       *
       * Nên bài này đo ĐƯỜNG ĐI chứ không đo đích: đủ bộ ⇒ lọc phải loại hai lá
       * ra TRƯỚC khi bốc ⇒ không lượt nào được chạm tới chốt cuối của DB.
       */
      const u = await createTestUser(pool);
      for (const n of DOC_BAN) {
        await pool.query(
          `INSERT INTO avatar_so_huu (user_id, nen, nguon, seri, chuoi)
           VALUES ($1, $2, 'gacha_t', 1, '2A0--')`, [u.userId, n.ma]);
      }
      await napVi(u.userId, 40);
      let soTrung = 0;
      for (let i = 0; i < 40; i += 1) {
        const r = await goi('/api/v1/shop/hop', u.cookie, {});
        if (r.status !== 200) break;
        if ((await r.json() as { trung: boolean }).trung) soTrung += 1;
      }
      console.log('DEBUG soTrung =', soTrung);
      expect(soTrung,
        'có lượt rơi vào nhánh trùng ⇒ phép lọc theo sở hữu đã chết, DB đang gánh hộ',
      ).toBe(0);
    }, 120_000);

  it('có đủ hai lá vẫn mở hộp được (hạ bậc), và vẫn trừ đúng tiền', async () => {
    const u = await createTestUser(pool);
    for (const n of DOC_BAN) {
      await pool.query(
        `INSERT INTO avatar_so_huu (user_id, nen, nguon, seri, chuoi)
         VALUES ($1, $2, 'gacha_t', 1, '2A0--')`, [u.userId, n.ma]);
    }
    await napVi(u.userId, 3);
    const truoc = await soDu(u.userId);
    const r = await goi('/api/v1/shop/hop', u.cookie, {});
    expect(r.status).toBe(200);
    const j = await r.json() as { mon: { loai: string }; trung: boolean };
    // Không còn lá nền nào trao được ⇒ chỉ có thể ra sticker.
    expect(j.mon.loai).toBe('sticker');
    expect(j.trung).toBe(false);
    expect(truoc - await soDu(u.userId)).toBe(BigInt(GACHA.COST_T));
  });
});
