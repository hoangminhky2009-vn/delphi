/**
 * KHO DỮ LIỆU — trình duyệt bảng chỉ-đọc (D209).
 *
 * ⚠ FILE NÀY GÁC HAI THỨ, VÀ CẢ HAI ĐỀU HỎNG TRONG IM LẶNG:
 *
 *  1. **Cột xác thực rời máy chủ.** Một dòng JSON có `totp_secret` trông y hệt
 *     một dòng JSON không có — không lỗi, không chậm, không ai báo. Mà đọc được
 *     nó là đăng nhập được dưới danh nghĩa người khác VÀ qua luôn lớp hai, tức
 *     cả bộ khoá D208 thành trang trí. §II tấn công cột đó bằng bốn đường khác
 *     nhau, không phải một.
 *
 *  2. **Định danh đi thẳng từ URL vào SQL.** Đây là chỗ DUY NHẤT trong repo ghép
 *     tên bảng/cột vào câu lệnh, nên nó là chỗ duy nhất có cửa đó. §III đẩy vào
 *     hàng rào bằng payload thật thay vì đọc regex rồi tin.
 *
 * ⚠ §II.4 là bài chịu lực: nó KHÔNG liệt kê tên cột nào cả, mà quét MỌI bảng ×
 * MỌI dòng trả về và cấm bất cứ giá trị nào trùng với bí mật đã cắm sẵn trong
 * DB. Bài liệt-kê-tên chỉ canh được những cột hôm nay ta nhớ ra; bài này canh cả
 * cột ai đó thêm vào tháng sau.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import {
  createTestUser, ensureGenesis, moCuaAdmin, type TestUser,
} from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { clearAttempts } from '../server/auth/rate_limit.js';
import { COT_AN_HAN, COT_CHE, anCua, cheEmail, traiO } from '../server/admin_kho.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let quan: TestUser;
let thuong: TestUser;

/** Bí mật cắm sẵn — §II.4 đi tìm đúng những chuỗi này trong MỌI thứ trả về. */
const BI_MAT = 'JBSWY3DPEHPK3PXP-bi-mat-khong-duoc-lo';
const EMAIL_THAT = 'nguoi-that-0209@vidu.test';

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  quan = await createTestUser(pool, { role: 'admin', bankroll: 0 });
  await moCuaAdmin(pool, quan);   // requireAdmin đòi TOTP đã ghi danh + phiên đã mở
  thuong = await createTestUser(pool);

  /*
   * Cắm bí mật vào ĐÚNG những cột danh sách khoá nói tới, để §II không đo trên
   * một DB rỗng rồi báo xanh vì chẳng có gì để lộ (bẫy phép-đo-rỗng D127/D155).
   *
   * ⚠ Cắm vào tài khoản KHÔNG phải admin: `moCuaAdmin` vừa ghi một `totp_secret`
   * THẬT cho `quan`, đè lên nó là tự khoá mình ra khỏi chính cái cửa đang test.
   */
  await pool.query(
    `UPDATE auth_accounts SET totp_secret = $1 WHERE user_id = $2`,
    [BI_MAT, thuong.userId]);
  await pool.query(
    `UPDATE auth_accounts SET email = $1 WHERE user_id = $2`,
    [EMAIL_THAT, thuong.userId]);
}, 120_000);
afterAll(async () => { await db?.stop(); });

const goi = (u: TestUser | null, url: string) =>
  app.request(url, u ? { headers: { cookie: u.cookie } } : {});

/**
 * Xả bộ đếm rate-limit của cửa admin.
 *
 * ⚠ CẦN, VÀ LÝ DO ĐÁNG GHI: mọi route `/api/v1/admin/*` chung MỘT trần
 * `AUTH.ADMIN.MAX_MOI_PHUT = 60` mỗi IP mỗi phút. §II.4 gọi một lượt cho MỖI
 * bảng trong kho (~30 lượt liên tiếp) nên nó tự đâm trần, rồi mọi bài SAU nó
 * nhận 429 và đỏ vì một lý do chẳng liên quan gì tới thứ chúng đang canh — đúng
 * kiểu đỏ-vì-lý-do-sai mà D79 nói sẽ bị nới cho qua.
 *
 * KHÔNG nới trần thật để test đi qua: người dùng bấm từng bảng một, còn cú quét
 * vét cạn là hành vi của bài test chứ không phải của người.
 */
const xaTran = () => clearAttempts(pool, 'admin:ip:unknown');

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Cửa quyền', () => {
  it('người thường và khách KHÔNG vào được', async () => {
    expect((await goi(thuong, '/api/v1/admin/kho/bang')).status).toBe(403);
    expect((await goi(null, '/api/v1/admin/kho/bang')).status).toBe(401);
    expect((await goi(thuong, '/api/v1/admin/kho/bang/users')).status).toBe(403);
  });

  it('admin thấy MỌI bảng, kèm số dòng ĐẾM THẬT', async () => {
    const r = await goi(quan, '/api/v1/admin/kho/bang');
    expect(r.status).toBe(200);
    const d = await r.json() as any;

    // "Hiện tất cả" phải là tất cả: đối chiếu với chính schema, không với một
    // danh sách chép tay (danh sách chép tay sẽ trôi — D169).
    const { rows } = await pool.query<{ ten: string }>(
      `SELECT c.relname AS ten FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r','p')`);
    expect(new Set(d.bang.map((b: any) => b.ten)))
      .toEqual(new Set(rows.map((x) => x.ten)));
    expect(d.bang.length).toBeGreaterThan(10);

    /*
     * ⚠ `users` có ít nhất 2 dòng ta vừa tạo. `reltuples` trên một bảng chưa
     * ANALYZE trả -1 ⇒ hiện 0 ⇒ mặt tự nhận "hiện tất cả" lại nói bảng rỗng.
     * Bài này khoá đúng chỗ đó.
     */
    const u = d.bang.find((b: any) => b.ten === 'users');
    expect(u.dong).toBeGreaterThanOrEqual(2);
    expect(d.tong_dong).toBeGreaterThanOrEqual(u.dong);
  });

  it('bản kê cột bị khoá ĐI CÙNG dữ liệu, không nằm ở một trang tài liệu', async () => {
    // Giấu mà không nói là chỗ đẻ ra câu "mặt này có hiện đủ không" — và một khi
    // đã hỏi thì người xem thôi tin cả mặt.
    const d = await (await goi(quan, '/api/v1/admin/kho/bang')).json() as any;
    expect(d.khoa.an_han).toEqual([...COT_AN_HAN]);
    expect(d.khoa.che).toEqual([...COT_CHE]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Bí mật không rời máy chủ', () => {
  it('cột ẩn hẳn KHÔNG có mặt trong dòng trả về', async () => {
    const d = await (await goi(quan, '/api/v1/admin/kho/bang/auth_accounts')).json() as any;
    expect(d.dong.length).toBeGreaterThan(0);
    for (const r of d.dong) expect(Object.keys(r)).not.toContain('totp_secret');
  });

  it('nhưng cột ẩn VẪN được KHAI BÁO là có tồn tại', async () => {
    /*
     * Khác biệt tinh tế và quan trọng: giấu GIÁ TRỊ thì đúng, giấu luôn SỰ TỒN
     * TẠI thì mặt này nói dối về schema — người phân tích sẽ tưởng `auth_accounts`
     * không có lớp 2FA. Nói "có cột này, không cho xem" mới là trung thực.
     */
    const d = await (await goi(quan, '/api/v1/admin/kho/bang/auth_accounts')).json() as any;
    const c = d.cot.find((x: any) => x.ten === 'totp_secret');
    expect(c).toBeTruthy();
    expect(c.an).toBe('an_han');
  });

  it('email CHE chứ không lộ, và che kiểu không dựng lại được', async () => {
    const d = await (await goi(quan, '/api/v1/admin/kho/bang/auth_accounts')).json() as any;
    const co = JSON.stringify(d.dong);
    expect(co).not.toContain(EMAIL_THAT);
    expect(co).toContain('***');
    expect(cheEmail('hotenmau@example.com')).toBe('ho***@example.com');
    expect(cheEmail('a@b.co')).toBe('a***@b.co');   // tên một ký tự vẫn che nổi
    expect(cheEmail('@x')).toBe('***');             // rác vào thì che sạch
    expect(cheEmail(null)).toBeNull();
  });

  it('⚠ QUÉT CẢ KHO: không một bảng nào rò bí mật, kể cả bảng chưa ai nghĩ tới', async () => {
    /*
     * Bài chịu lực. Nó không tin vào bất kỳ danh sách tên cột nào — nó đi hết
     * mọi bảng, đọc dòng thật, và cấm chuỗi bí mật xuất hiện ở BẤT CỨ ĐÂU. Một
     * cột `totp_secret_cu` thêm vào tháng sau sẽ bị bài này bắt, trong khi bài
     * liệt-kê-tên ở trên thì không.
     */
    const ds = await (await goi(quan, '/api/v1/admin/kho/bang')).json() as any;
    let daDoc = 0;
    for (const b of ds.bang) {
      await xaTran();
      const r = await goi(quan, `/api/v1/admin/kho/bang/${b.ten}?moi=200`);
      expect(r.status, `bảng ${b.ten} phải đọc được`).toBe(200);
      const co = JSON.stringify((await r.json() as any).dong);
      expect(co, `bảng ${b.ten} rò totp_secret`).not.toContain(BI_MAT);
      expect(co, `bảng ${b.ten} rò email`).not.toContain(EMAIL_THAT);
      daDoc += 1;
    }
    expect(daDoc).toBeGreaterThan(10);   // chống xanh rỗng
    await xaTran();
  });

  it('KHÔNG sắp xếp được theo cột đã ẩn — moi bí mật qua thứ tự cũng là moi', async () => {
    // Sắp theo `totp_secret` rồi đọc thứ tự dòng là đọc ra được bí mật từng chút
    // một mà không giá trị nào rời máy chủ. Cửa thật, và rất dễ bỏ sót.
    const d = await (await goi(
      quan, '/api/v1/admin/kho/bang/auth_accounts?sap=totp_secret')).json() as any;
    expect(d.sap).not.toBe('totp_secret');
  });

  it('blob mã hoá đầu-cuối chỉ ra CỠ, không ra ruột', async () => {
    const d = await (await goi(quan, '/api/v1/admin/kho/bang/pfm_luu')).json() as any;
    expect(d.cot.find((x: any) => x.ten === 'blob').an).toBe('rut_gon');
    expect(anCua('blob')).toBe('rut_gon');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Định danh không đi thẳng từ URL vào SQL', () => {
  beforeEach(xaTran);
  it('tên bảng bịa / hình dạng lạ đều bị chặn, không nổ lỗi SQL', async () => {
    for (const x of ['khong_co_bang_nay', 'Users', 'pg_class']) {
      const r = await goi(quan, `/api/v1/admin/kho/bang/${x}`);
      expect([400, 404], `"${x}" phải bị từ chối`).toContain(r.status);
    }
  });

  it('payload tiêm SQL không tạo ra được câu lệnh nào', async () => {
    /*
     * ⚠ Cả ba đều PHẢI bị chặn ở tầng tên, không phải "may mà PG báo lỗi". Một
     * cái 500 ở đây cũng là đỏ: 500 nghĩa là chuỗi đã tới được máy phân tích cú
     * pháp của Postgres.
     */
    const doc = ['users; DROP TABLE users', 'users" --', "users' OR '1'='1"];
    for (const x of doc) {
      const r = await goi(quan, `/api/v1/admin/kho/bang/${encodeURIComponent(x)}`);
      expect([400, 404], `"${x}" phải bị chặn trước khi tới SQL`).toContain(r.status);
    }
    // Và bảng vẫn còn đó — chứng minh không câu nào chạy.
    expect((await pool.query(`SELECT count(*)::int AS n FROM users`)).rows[0].n)
      .toBeGreaterThan(0);
  });

  it('cột sắp xếp lạ rơi về mặc định thay vì đi vào SQL', async () => {
    const d = await (await goi(
      quan, '/api/v1/admin/kho/bang/users?sap=x%22%20--')).json() as any;
    expect(d.cot.map((c: any) => c.ten)).toContain(d.sap);
  });

  it('bảng mà MỌI cột đều bị ẩn trả lời được, không nổ 500', async () => {
    /*
     * Không có bảng nào như thế hôm nay — nhưng danh sách khoá bắt theo TÊN CỘT
     * nên một bảng tương lai gồm toàn cột trùng tên khoá là dựng được, và khi đó
     * `hien[0]!` nổ 500. Dựng đúng ca đó bằng một bảng tạm thay vì chờ nó xảy ra
     * trên prod.
     */
    await pool.query(
      `CREATE TABLE IF NOT EXISTS bang_toan_bi_mat (
         token_hash TEXT PRIMARY KEY, password_hash TEXT NOT NULL)`);
    try {
      await xaTran();
      const r = await goi(quan, '/api/v1/admin/kho/bang/bang_toan_bi_mat');
      expect(r.status).toBe(200);
      const d = await r.json() as any;
      expect(d.dong).toEqual([]);
      expect(d.cot.every((c: any) => c.an === 'an_han')).toBe(true);
    } finally {
      await pool.query(`DROP TABLE IF EXISTS bang_toan_bi_mat`);
    }
  });

  it('KHÔNG có route ghi nào ở kho — nó là cửa chỉ đọc', async () => {
    // Một trình duyệt bảng ghi được là một trình duyệt bảng sẽ có người ghi
    // nhầm; và cửa ghi thật đã có chỗ của nó (có xác thực lại).
    for (const m of ['POST', 'PATCH', 'DELETE']) {
      const r = await app.request('/api/v1/admin/kho/bang/users',
        { method: m, headers: { cookie: quan.cookie } });
      expect(r.status, `${m} không được có route`).toBe(404);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. Trần tải — pool max:1, function 10 giây', () => {
  beforeEach(xaTran);
  it('số dòng mỗi trang bị kẹp, kể cả khi URL xin nhiều', async () => {
    const d = await (await goi(quan, '/api/v1/admin/kho/bang/users?moi=99999')).json() as any;
    expect(d.moi).toBeLessThanOrEqual(200);
  });

  it('mở-hết-ô kéo trần dòng xuống rất thấp', async () => {
    /*
     * `state_snapshot_json` nhân 50 dòng là vài MB đi qua đúng cái function 10
     * giây. Hai cần gạt phải ĐI CÙNG NHAU: bỏ cắt thì phải bỏ luôn số dòng.
     */
    const d = await (await goi(
      quan, '/api/v1/admin/kho/bang/users?cat=0&moi=200')).json() as any;
    expect(d.moi).toBeLessThanOrEqual(5);
    expect(d.cat_o).toBe(0);
  });

  it('ô dài bị cắt và NÓI RÕ là đã cắt', async () => {
    // Cắt im lặng là làm hỏng dữ liệu: người đọc tưởng JSON kết thúc ở đó.
    const dai = 'x'.repeat(900);
    expect(String(traiO(dai, 500))).toContain('(+400)');
    expect(String(traiO(dai, 500)).length).toBeLessThan(560);
    expect(traiO(dai, 0)).toBe(dai);            // cat=0 ⇒ nguyên vẹn
  });

  it('Buffer ra CỠ, không ra mảng số thập phân', async () => {
    // JSON.stringify(buffer) nở gấp ~3,5 lần và không ai đọc được (bẫy D146).
    expect(traiO(Buffer.from([1, 2, 3]), 500)).toBe('‹3 byte›');
  });

  it('phân trang tiến/lùi được và biết khi nào hết', async () => {
    const d = await (await goi(
      quan, '/api/v1/admin/kho/bang/users?moi=1&trang=0')).json() as any;
    expect(d.dong.length).toBe(1);
    expect(d.con_nua).toBe(true);   // đã tạo ≥2 người ở beforeAll
  });
});
