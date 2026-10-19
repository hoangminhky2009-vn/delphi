/**
 * CỔNG ĐỒNG Ý + SÀN CỠ Ô cho MỌI đường đọc GỘP (D101 — bàn tròn 5 vai, 17/08).
 *
 * ⚠ VÌ SAO CÓ CẢ TẦNG "CANH CẢ LỚP": lỗ gốc không phải một dòng viết sai, nó là
 * một dòng KHÔNG AI VIẾT — `/admin/tk/tinh-cach` gom thẳng `holdem_matches` rồi
 * chạy hồ sơ từng người, không lọc `research_consent`. Vá đích danh một route
 * thì route GỘP tiếp theo (bảng theo vùng, theo nhóm tuổi, bản xuất…) sẽ lặp
 * đúng cú đó, im lặng. Nên §II đọc CHÍNH MÃ NGUỒN và bắt mọi lời gọi
 * `hoSoTinhCachCuaUser` ở tầng admin phải đứng sau `cuaGopHoSo` — khuôn D79
 * (action_type) và D93 (19 route `:id`).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { RIENG_TU, cuaGopHoSo, sanO } from '../server/rieng_tu.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let admin: TestUser;

/** Tạo một trận NAV đã xong cho user — đủ để họ lọt vào tập gộp. */
async function traiTran(u: TestUser, seed = 20260841): Promise<void> {
  await pool.query(
    `INSERT INTO holdem_matches (owner_user_id, seed, so_o, ghe_json,
                                 engine_version, balance_version, season_id,
                                 che_do, status, vong_hien_tai, action_log)
     VALUES ($1, $2, 8, '[]'::jsonb, 'test', 'balance-v33-gianla', '0.0',
             'tu_do', 'xong', 8, '[]'::jsonb)`,
    [u.userId, seed]);
}

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  admin = await createTestUser(pool, { role: 'admin', bankroll: 0 });
  await moCuaAdmin(pool, admin);
}, 120_000);

afterAll(async () => { await db?.stop(); });

describe('I. Cổng đồng ý — chạy trên DB thật', () => {
  it('⭐ người CHƯA đồng ý nghiên cứu KHÔNG vào bảng gộp, và số bị loại được nói ra', async () => {
    const co = await createTestUser(pool);
    const khong = await createTestUser(pool);
    await pool.query('UPDATE users SET research_consent = false WHERE user_id = $1',
      [khong.userId]);
    await traiTran(co);
    await traiTran(khong, 20260842);

    const r = await app.request('/api/v1/admin/tk/tinh-cach', { headers: { cookie: admin.cookie } });
    expect(r.status).toBe(200);
    const b = await r.json() as {
      n_nguoi: number; bo_qua_chua_dong_y: number; san_o: number;
    };
    // Người không đồng ý bị loại KHỎI TẬP, không phải chỉ ẩn khỏi hiển thị.
    expect(b.bo_qua_chua_dong_y).toBeGreaterThanOrEqual(1);
    expect(b.san_o).toBe(RIENG_TU.SAN_O);
    // Người đã đồng ý mà chưa có vòng nào ⇒ n_vong = 0 ⇒ không đếm (đúng luật cũ).
    expect(b.n_nguoi).toBe(0);
  });

  it('⭐⭐ cuaGopHoSo: id người chưa đồng ý KHÔNG có trong tập trả về', async () => {
    // Bài §I.1 chỉ đọc được con số ĐẾM; bài này đọc thẳng TẬP ID, tức đo đúng
    // thứ quyết định ai chảy vào bản tổng hợp.
    const co = await createTestUser(pool);
    const khong = await createTestUser(pool);
    await pool.query('UPDATE users SET research_consent = false WHERE user_id = $1',
      [khong.userId]);
    await traiTran(co, 20260851);
    await traiTran(khong, 20260852);

    const cua = await cuaGopHoSo(pool);
    expect(cua.user_ids).toContain(co.userId);
    expect(cua.user_ids).not.toContain(khong.userId);
  });

  it('user không có trận nào thì không lọt vào tập (kể cả đã đồng ý)', async () => {
    const r = await app.request('/api/v1/admin/tk/tinh-cach', { headers: { cookie: admin.cookie } });
    expect(r.status).toBe(200);
    const b = await r.json() as { n_nguoi: number };
    expect(b.n_nguoi).toBe(0);
  });
});

describe('II. ⭐⭐ CANH CẢ LỚP — đường gộp mới không lọt im lặng', () => {
  /*
   * ⚠ QUÉT MỌI TỆP `server/admin_*.ts`, không một tệp đích danh. Bản đầu đọc cứng `admin_thongke.ts`; D341 dời mặt
   * TÍNH CÁCH sang `admin_san_pham.ts` và bài này ĐỎ vì "không còn lời gọi nào" — may mà có vế `> 0`. Dời thêm một lần
   * nữa mà thiếu vế đó là bài rỗng. Nay mọi tệp tầng admin đều bị quét, và tổng lời gọi phải > 0.
   */
  const tep = readdirSync('server').filter((f) => /^admin_.*\.ts$/.test(f)).map((f) => `server/${f}`);

  it('mọi lời gọi hoSoTinhCachCuaUser trong tầng admin đều đứng sau cuaGopHoSo', () => {
    let tong = 0;
    for (const f of tep) {
      const nguon = readFileSync(f, 'utf8');
      // K7 (vá đợt 1 Gói 2) — tầng admin gọi thẳng `hoSoTheoGoi(…, mw.hanhVi)` (= `hoSoTinhCachCuaUser`, không qua tầng route) ⇒ canh cả hai tên.
      for (const m of nguon.matchAll(/(?:hoSoTinhCachCuaUser|hoSoTheoGoi)\s*\(/g)) {
        tong += 1;
        // Handler chứa lời gọi này phải có `cuaGopHoSo(` TRƯỚC nó.
        const truoc = nguon.slice(0, m.index);
        const dauHandler = Math.max(truoc.lastIndexOf("app.get('/api/v1/admin"), truoc.lastIndexOf("app.post('/api/v1/admin"));
        expect(dauHandler, `${f}: lời gọi nằm ngoài handler`).toBeGreaterThan(-1);
        expect(nguon.slice(dauHandler, m.index), `${f}: gọi hồ sơ trước cửa gom`).toContain('cuaGopHoSo(');
      }
    }
    expect(tong, 'không tệp admin nào gọi hồ sơ nữa ⇒ bài này đang canh chỗ trống').toBeGreaterThan(0);
  });

  it('tầng admin KHÔNG được tự gom user id từ holdem_matches nữa', () => {
    // Đây chính là hình dạng của bug gốc. Bảng gộp phải hỏi `cuaGopHoSo`.
    expect(tep.length).toBeGreaterThan(2);
    for (const f of tep) expect(readFileSync(f, 'utf8'), f).not.toMatch(/DISTINCT\s+owner_user_id/i);
  });
});

describe('III. Sàn cỡ ô — hàm thuần, vector tay', () => {
  it('ô mỏng gộp vào _it_hon_san chứ KHÔNG bị vứt (tổng phải giữ nguyên)', () => {
    const ra = sanO({ can_bang: 10, tra_thu: 1, chot_non: 2 }, 3);
    expect(ra).toEqual({ can_bang: 10, _it_hon_san: 3 });
    const tong = Object.values(ra).reduce((a, b) => a + b, 0);
    expect(tong).toBe(13);   // vứt đi thì người đọc tự cộng ra cỡ mẫu sai
  });

  it('không ô nào mỏng ⇒ không đẻ khoá _it_hon_san', () => {
    expect(sanO({ a: 5, b: 4 }, 3)).toEqual({ a: 5, b: 4 });
  });

  it('bảng rỗng ⇒ rỗng', () => {
    expect(sanO({}, 3)).toEqual({});
  });
});
