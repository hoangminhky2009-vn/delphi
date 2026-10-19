/**
 * B0 — BÁO CÁO KINH TẾ trên DB thật (embedded Postgres, A8.9: mọi thứ test được
 * ở local, cấm mock để né thiết kế sai).
 *
 * Bài kiểm quan trọng nhất ở đây KHÔNG phải "có ra số không" mà là **"chỗ chưa
 * có nguồn thì có trả `null` không, hay lén trả 0"** (A11.2/D62/D67). Một báo
 * cáo trả 0 cho thứ chưa đo được là một báo cáo nói dối, và nó nói dối đúng vào
 * lúc người ta tin nó nhất.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { ECONOMY } from '../config/economy.js';
import { docBaoCaoKinhTe, giniBp, MAU_SO_TOI_THIEU } from '../server/kinh_te/bao_cao.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let admin: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  admin = await createTestUser(pool, { role: 'admin', bankroll: 0 });
  await moCuaAdmin(pool, admin);
  await createTestUser(pool);
  await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

describe('Gini — hàm thuần, và `null` khi không có gì để nói', () => {
  it('mọi ví bằng nhau ⇒ 0 bp', () => {
    expect(giniBp([1_000n, 1_000n, 1_000n, 1_000n])).toBe(0);
  });
  it('bất bình đẳng cao hơn ⇒ số lớn hơn', () => {
    const deu = giniBp([900n, 1_000n, 1_100n])!;
    const lech = giniBp([1n, 1_000n, 100_000n])!;
    expect(lech).toBeGreaterThan(deu);
  });
  it('⚠ dưới 2 ví, hoặc tổng = 0 ⇒ null — KHÔNG phải 0', () => {
    expect(giniBp([])).toBeNull();
    expect(giniBp([500n])).toBeNull();
    // Tổng 0 nghĩa là "không có phân phối", khác hẳn "bình đẳng tuyệt đối".
    expect(giniBp([0n, 0n, 0n])).toBeNull();
  });
});

describe('docBaoCaoKinhTe — trên DB thật', () => {
  it('mẫu số luôn đi kèm, và cờ cảnh báo bật khi quá ít người thật (A11.1/D223)', async () => {
    const b = await docBaoCaoKinhTe(pool);
    expect(b.mauSo.tongTaiKhoan).toBeGreaterThan(0);
    expect(b.mauSo.that).toBeLessThan(MAU_SO_TOI_THIEU);
    expect(b.mauSo.canhBaoMauSo).toBe(true);
  });

  it('verdict CÂN lấy từ audit.ts, không tính lại — và nó phải CÂN', async () => {
    const b = await docBaoCaoKinhTe(pool);
    expect(b.cung.can).toBe(true);
    expect(b.cung.vanDe).toEqual([]);
  });

  it('cung: mint − đốt == tổng cung, đọc thẳng từ sổ', async () => {
    const b = await docBaoCaoKinhTe(pool);
    expect(BigInt(b.cung.mintRong) - BigInt(b.cung.daDot)).toBe(BigInt(b.cung.tongCung));
    // Genesis đã chạy ⇒ Kho bạc đúng bằng vốn D10, chưa chi gì.
    expect(BigInt(b.cung.khoBac)).toBe(BigInt(ECONOMY.TREASURY_GENESIS));
  });

  it('⚠⚠ CHƯA CÓ NGUỒN THÌ null, KHÔNG PHẢI 0 — bài kiểm lõi của báo cáo', async () => {
    const b = await docBaoCaoKinhTe(pool);
    // Chưa ai tiêu Q ⇒ sink/phát không xác định.
    expect(b.q.sinkPhatBp).toBeNull();
    // Kho bạc chưa chi đồng nào trong cửa sổ ⇒ runway không xác định.
    expect(b.khoBacDong.runwayNgay).toBeNull();
    // Chưa phát trợ cấp ⇒ tỷ lệ vào lò đốt không xác định.
    expect(b.troCap.vaoLoDotBp).toBeNull();
  });

  it('không chỉ số nào null mà lại đẻ ra báo động — im lặng là đúng', async () => {
    const b = await docBaoCaoKinhTe(pool);
    for (const d of b.baoDong) {
      expect(['q_ton_dong', 'kho_bac_mong', 'median_cao', 'gini_cao', 't_lam_phat'])
        .toContain(d.ma);
    }
    // Cụ thể: ba dòng phụ thuộc nguồn chưa có thì tuyệt đối không được nổ.
    const ma = b.baoDong.map((d) => d.ma);
    expect(ma).not.toContain('runway_ngan');
    expect(ma).not.toContain('q_thieu_mon');
    expect(ma).not.toContain('tro_cap_vao_lo_dot');
  });

  it('trần phát Q của mùa đi kèm báo cáo — ngưỡng tồn phải suy từ nó, không phải 2.500', async () => {
    const b = await docBaoCaoKinhTe(pool);
    expect(b.q.tranPhatMua).toBe(1_200);
  });

  it('ống trợ cấp→lò đốt LUÔN kèm ghi chú rằng đây là ước lượng theo NGƯỜI', async () => {
    const b = await docBaoCaoKinhTe(pool);
    expect(b.troCap.ghiChu).toContain('KHÔNG phải');
    expect(b.troCap.ghiChu.length).toBeGreaterThan(50);
  });
});

describe('HỒI QUY — hai lỗi phía DB tự rà ra 05/09', () => {
  it('LỖI 4: sink/faucet đo theo CỬA SỔ và KHÔNG tính vốn genesis', async () => {
    const b = await docBaoCaoKinhTe(pool);
    const phat = BigInt(b.xuHuong.phat);
    // Genesis 20.000 T nằm ở treasury_ledger; nếu nó lọt vào mẫu số thì `phat`
    // phải ≥ 20.000 và tỷ lệ bị dìm vĩnh viễn ⇒ chuông `t_lam_phat` kêu mãi mãi.
    expect(phat).toBeLessThan(BigInt(ECONOMY.TREASURY_GENESIS));
    // Và nó phải đúng bằng tổng signup_grant đã phát.
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(delta), 0)::text AS s FROM wallet_ledger
        WHERE reason IN ('signup_grant', 'admin_adjust')`);
    expect(phat).toBe(BigInt(rows[0].s));
    expect(b.xuHuong.cuaSoNgay).toBe(30);
  });

  it('LỖI 5: "trợ cấp tuần dự kiến" chỉ đếm người ĐỦ ĐIỀU KIỆN, không đếm khách', async () => {
    const truoc = (await docBaoCaoKinhTe(pool)).troCap.soNguoiDuDieuKien;

    // Một KHÁCH ví rỗng: `chanKhach` (D79) không cho khách nhận trợ cấp, nên
    // người này không bao giờ rút một đồng nào của Kho bạc.
    const khach = await createTestUser(pool, { bankroll: 0 });
    await pool.query(`UPDATE users SET la_khach = true WHERE user_id = $1`, [khach.userId]);
    expect((await docBaoCaoKinhTe(pool)).troCap.soNguoiDuDieuKien).toBe(truoc);

    // Một người thật ví rỗng thì PHẢI được đếm.
    await createTestUser(pool, { bankroll: 0 });
    expect((await docBaoCaoKinhTe(pool)).troCap.soNguoiDuDieuKien).toBe(truoc + 1);
  });

  it('phân phối luôn khai rõ DÂN SỐ của nó — một tỷ lệ không có mẫu số là vô nghĩa', async () => {
    const b = await docBaoCaoKinhTe(pool);
    expect(b.phanPhoi.tren).toBe('tat_ca_tai_khoan');
  });
});

describe('Cửa admin /api/v1/admin/kinh-te', () => {
  it('người thường KHÔNG vào được', async () => {
    const thuong = await createTestUser(pool);
    const res = await app.request('/api/v1/admin/kinh-te', {
      headers: { cookie: thuong.cookie },
    });
    expect([401, 403]).toContain(res.status);
  });

  it('admin đọc được, và trả đúng hình dạng báo cáo', async () => {
    const res = await app.request('/api/v1/admin/kinh-te', {
      headers: { cookie: admin.cookie },
    });
    expect(res.status).toBe(200);
    const b = await res.json() as any;
    expect(b).toHaveProperty('mauSo.canhBaoMauSo');
    expect(b).toHaveProperty('cung.can');
    expect(b).toHaveProperty('khoBacDong.runwayNgay');
    expect(b).toHaveProperty('q.tranPhatMua');
    expect(Array.isArray(b.baoDong)).toBe(true);
  });

  it('CHỈ ĐỌC: không route ghi nào trong module (D209 — bảng đọc mà ghi được là bảng sẽ bị ghi nhầm)', async () => {
    const res = await app.request('/api/v1/admin/kinh-te', {
      method: 'POST', headers: { cookie: admin.cookie },
    });
    expect(res.status).toBe(404);
  });
});
