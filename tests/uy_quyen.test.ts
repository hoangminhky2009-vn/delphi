/**
 * UỶ QUYỀN ADMIN (D208).
 *
 * ⚠ VÌ SAO PHẦN LỚN FILE NÀY LÀ CÁC CA BỊ TỪ CHỐI: đường thành công chỉ có một,
 * còn các cách hỏng thì mỗi cách mở một lỗ khác nhau — leo quyền từ tài khoản
 * khách, hai admin thu quyền lẫn nhau tới khi còn 0 người resolve được kèo, một
 * phiên bỏ quên đẻ ra admin mới. Không ca nào trong số đó nổ ra tiếng động.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, ensureGenesis, moCuaAdmin, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let chu: TestUser;      // admin đầu tiên ⇒ chủ sở hữu
let thuong: TestUser;   // người thường, sẽ được uỷ quyền

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false,
  }) as Hono<any>;
  await ensureGenesis(pool);
  chu = await createTestUser(pool, { role: 'admin', bankroll: 0 });
  await pool.query(`UPDATE users SET chu_so_huu = true WHERE user_id = $1`, [chu.userId]);
  await moCuaAdmin(pool, chu);
  thuong = await createTestUser(pool);
}, 120_000);
afterAll(async () => { await db?.stop(); });

const goi = (u: TestUser, url: string, body?: unknown) =>
  app.request(url, body === undefined
    ? { headers: { cookie: u.cookie } }
    : {
      method: 'POST',
      headers: { cookie: u.cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

const vaiCua = async (u: TestUser): Promise<string> =>
  (await pool.query(`SELECT role FROM users WHERE user_id = $1`, [u.userId])).rows[0].role;

// ═══════════════════════════════════════════════════════════════════════════
describe('I. Chủ sở hữu — đúng một, và là admin', () => {
  it('DB ép chỉ MỘT chủ sở hữu', async () => {
    // Index một phần `users_mot_chu_so_huu`. Không có nó thì hai người cùng bất
    // khả thu hồi, và trạng thái đó không sửa được từ trong app.
    const khac = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    await expect(pool.query(
      `UPDATE users SET chu_so_huu = true WHERE user_id = $1`, [khac.userId]))
      .rejects.toThrow();
    await pool.query(`UPDATE users SET role = 'user' WHERE user_id = $1`, [khac.userId]);
  });

  it('chủ sở hữu BẮT BUỘC là admin', async () => {
    // Trạng thái "chủ sở hữu mà không phải admin" là thứ mọi đường code giả định
    // không tồn tại — nên chặn ở DB chứ không chỉ ở app.
    await expect(pool.query(
      `UPDATE users SET role = 'user' WHERE user_id = $1`, [chu.userId]))
      .rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('II. Uỷ quyền — quyền TƯƠNG ĐƯƠNG thật', () => {
  it('admin uỷ quyền cho người thường ⇒ họ thành admin', async () => {
    const r = await goi(chu, '/api/v1/admin/quyen', { handle: thuong.handle, cho: true });
    expect(r.status).toBe(200);
    expect(await vaiCua(thuong)).toBe('admin');
  });

  it('người được uỷ quyền vào được CẢ HAI mặt, kể cả thao tác không hoàn tác được', async () => {
    /*
     * Đây là bài chứng minh "tương đương" không phải lời hứa suông: sau khi tự
     * bật 2FA, họ đọc được dashboard (`/quan-tri`) VÀ đi qua được cửa nặng
     * (`requireXacThucLai`) — cửa của resolve/huỷ kèo.
     */
    await moCuaAdmin(pool, thuong);
    expect((await goi(thuong, '/api/v1/admin/tk/tong-quan')).status).toBe(200);
    expect((await goi(thuong, '/api/v1/admin/quyen')).status).toBe(200);
    // Cửa nặng: gọi resolve một kèo không tồn tại ⇒ phải là 404 (đã qua cửa),
    // KHÔNG phải 403 (bị cửa chặn).
    const r = await goi(thuong,
      '/api/v1/admin/markets/00000000-0000-0000-0000-000000000000/resolve',
      { outcome_option_id: '00000000-0000-0000-0000-000000000000' });
    expect(r.status).not.toBe(403);
  });

  it('⭐ danh sách ứng viên bày sẵn, và LỌC ĐÚNG LUẬT của cửa ghi', async () => {
    /*
     * Founder 01/09: *"làm cho t thao tác nào nhanh gọn vào"*. Đường nhanh là
     * bấm một nút ở dòng người cần trao, không phải đi hỏi handle rồi gõ lại.
     *
     * ⚠ BÀI NÀY CANH PHẦN LỌC, KHÔNG CANH VIỆC "CÓ DANH SÁCH". Bày một cái tên
     * rồi từ chối đúng cái tên đó khi bấm là dạy người dùng rằng nút bấm không
     * đáng tin — và ba nhóm dưới đây là ba cách để chuyện đó xảy ra.
     */
    const khach2 = await createTestUser(pool);
    await pool.query(`UPDATE users SET la_khach = true WHERE user_id = $1`, [khach2.userId]);
    const { rows: da } = await pool.query(
      `SELECT handle FROM users WHERE role = 'admin' AND deleted_at IS NULL`);

    const r = await goi(chu, '/api/v1/admin/quyen');
    expect(r.status).toBe(200);
    const uv = (await r.json() as any).ung_vien as { handle: string }[];
    const ten = uv.map((x) => x.handle);

    expect(uv.length).toBeGreaterThan(0);              // chống xanh rỗng
    expect(uv.length).toBeLessThanOrEqual(25);         // trần, để trang không phình
    expect(ten, 'khách không bao giờ lên admin được').not.toContain(khach2.handle);
    for (const a of da) {
      expect(ten, 'người đã là admin thì bấm ra 409').not.toContain(a.handle);
    }
  });

  it('⭐ MỐC THỜI GIAN TRẢ ĐỦ GIỜ:PHÚT, không cắt về ngày', async () => {
    /*
     * Ca thật, founder bắt 01/09: *"phần thời gian chi tiết của handle và tạo
     * tài khoản ấy nó đang lỗi hay sao khi có mỗi ngày tạo chứ chưa có gì
     * giờ/phút cụ thể các thứ để quản trị"*.
     *
     * ⚠ VÌ SAO PHẢI CANH Ở TẦNG API CHỨ KHÔNG Ở GIAO DIỆN: bản đầu cắt bằng
     * `created_at::date` NGAY TRONG SQL. Cắt ở đó thì client không còn đường nào
     * lấy lại giờ/phút — dữ liệu đã mất trước khi rời máy chủ, và không có lỗi
     * nào nổ ra để ai biết. Giao diện sửa được; một cột đã bị cắt ở SQL thì
     * không.
     *
     * Luật chung nó khoá: SERVER trả mốc ĐẦY ĐỦ, CLIENT quyết hiển thị bao
     * nhiêu (D26).
     */
    const uv = (await (await goi(chu, '/api/v1/admin/quyen')).json() as any)
      .ung_vien as { handle: string; tao: string }[];
    expect(uv.length).toBeGreaterThan(0);            // chống xanh rỗng

    /*
     * ⚠⚠ BẢN ĐẦU CỦA PHÉP SO NÀY CŨNG RỖNG, VÀ LẦN NÀY KHÔNG PHẢI LỖI ESCAPE.
     * Nó hỏi `toMatch(/T\d{2}:\d{2}/)` — tưởng là đủ để bắt cú cắt. Nhưng
     * `created_at::date` cho ra kiểu `date` của Postgres, driver `pg` dựng nó
     * thành `Date` lúc NỬA ĐÊM, rồi `c.json()` in ra `...T00:00:00.000Z` — vẫn
     * có đủ `T00:00`, vẫn khớp. Tiêm lại đúng bug cũ mà bài vẫn xanh.
     *
     * Bài học khác hẳn lần trước: phép so ĐÚNG CÚ PHÁP nhưng canh một tính chất
     * mà con bug KHÔNG vi phạm. Chỉ tiêm lỗi mới lộ ra — đọc lại code thì nó
     * trông hoàn toàn hợp lý.
     *
     * Phép đúng: đối chiếu với chính giá trị trong DB. Không có cách nào giả.
     */
    const { rows: that } = await pool.query<{ handle: string; created_at: Date }>(
      `SELECT handle, created_at FROM users WHERE handle = ANY($1::text[])`,
      [uv.map((u) => u.handle)]);
    expect(that.length).toBe(uv.length);
    const theoDb = new Map(that.map((r) => [r.handle, new Date(r.created_at).getTime()]));
    for (const u of uv) {
      expect(new Date(u.tao).getTime(), `handle ${u.handle}: mốc API lệch DB (bị cắt?)`)
        .toBe(theoDb.get(u.handle));
    }
    // Và ít nhất một mốc phải KHÁC nửa đêm — nếu cả bộ đều 00:00:00 thì hoặc là
    // đang bị cắt, hoặc fixture dựng bàn theo cách khiến bài này mất nghĩa.
    expect(uv.some((u) => !/T00:00:00/.test(new Date(u.tao).toISOString())),
      'mọi mốc đều đúng nửa đêm — dấu hiệu vẫn đang bị cắt').toBe(true);
  });

  it('ghi admin_audit — ai trao, cho ai, lúc nào', async () => {
    // Trước D208 việc này là `UPDATE` thẳng vào DB, không dấu vết. Mất vết thì
    // không ai trả lời được "ai cho người này quyền".
    const { rows } = await pool.query(
      `SELECT admin_id::text AS ai, payload_json FROM admin_audit
        WHERE action = 'quyen_uy' ORDER BY created_at DESC LIMIT 1`);
    expect(rows[0].ai).toBe(chu.userId);
    // SPEC chan-truoc-beta (D604, founder A): `admin_audit` append-only ⇒ ghi `user_id`, KHÔNG ghi tên (xoá tài khoản xong không còn đường về tên).
    expect(rows[0].payload_json.user_id).toBe(thuong.userId);
    expect(rows[0].payload_json.handle, 'vết uỷ quyền không được chở tên').toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('III. Các cửa bị từ chối — mỗi cái bịt một lỗ khác nhau', () => {
  it('⚠ KHÁCH không bao giờ lên được admin', async () => {
    /*
     * Tài khoản khách tạo được không cần email (0030, 5 khách/IP/giờ). Cho nó
     * lên admin là biến một cửa mở thành đường leo quyền.
     */
    const khach = await createTestUser(pool);
    await pool.query(`UPDATE users SET la_khach = true WHERE user_id = $1`, [khach.userId]);
    const r = await goi(chu, '/api/v1/admin/quyen', { handle: khach.handle, cho: true });
    expect(r.status).toBe(409);
    expect((await r.json() as any).error).toBe('khach_khong_the_len_admin');
    expect(await vaiCua(khach)).toBe('user');
  });

  it('⚠ KHÔNG thu được quyền của chủ sở hữu', async () => {
    // Thiếu chốt này thì hệ thống có một nước tự huỷ: A uỷ quyền cho B, B thu
    // quyền của A. Founder vẫn khôi phục được bằng `.env.prod`, nhưng một cú lỡ
    // tay không nên thành một cuộc gọi lúc nửa đêm.
    const r = await goi(thuong, '/api/v1/admin/quyen', { handle: chu.handle, cho: false });
    expect(r.status).toBe(409);
    expect((await r.json() as any).error).toBe('khong_thu_duoc_chu_so_huu');
    expect(await vaiCua(chu)).toBe('admin');
  });

  it('⚠ KHÔNG để app rơi về 0 admin', async () => {
    /*
     * Kèo có hạn và đang giữ token người chơi (A3.2) — không còn ai resolve là
     * hỏng đúng thứ không hoãn được. Dựng bàn chỉ còn MỘT admin rồi thử thu.
     */
    const solo = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    await moCuaAdmin(pool, solo);
    /*
     * ⚠ THỨ TỰ QUAN TRỌNG: gỡ cờ chủ sở hữu TRƯỚC rồi mới hạ vai — ràng buộc
     * `users_chu_so_huu_phai_admin` chặn chiều ngược lại. Bản đầu của bài này
     * làm ngược nên `chu` vẫn là admin ⇒ còn HAI admin ⇒ chốt không có lý do
     * nổ, và bài đỏ vì fixture chứ không vì code.
     */
    await pool.query(`UPDATE users SET chu_so_huu = false WHERE chu_so_huu`);
    await pool.query(
      `UPDATE users SET role = 'user' WHERE role = 'admin' AND user_id <> $1`,
      [solo.userId]);
    const r = await goi(solo, '/api/v1/admin/quyen', { handle: solo.handle, cho: false });
    expect(r.status).toBe(409);
    expect((await r.json() as any).error).toBe('khong_con_admin_nao');
    expect(await vaiCua(solo)).toBe('admin');
    // trả bàn về như cũ cho các mô tả sau
    await pool.query(`UPDATE users SET role = 'admin' WHERE user_id = $1`, [chu.userId]);
    await pool.query(`UPDATE users SET chu_so_huu = true WHERE user_id = $1`, [chu.userId]);
  });

  it('no-op cũng là một cú TỪ CHỐI, không phải một cú thành công (D70)', async () => {
    const r1 = await goi(chu, '/api/v1/admin/quyen', { handle: chu.handle, cho: true });
    expect(r1.status).toBe(409);
    const nguoi = await createTestUser(pool);
    const r2 = await goi(chu, '/api/v1/admin/quyen', { handle: nguoi.handle, cho: false });
    expect(r2.status).toBe(409);
  });

  it('handle không tồn tại ⇒ 404, không im lặng', async () => {
    expect((await goi(chu, '/api/v1/admin/quyen',
      { handle: 'khong-ai-ten-the-nay', cho: true })).status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe('IV. Cửa quyền', () => {
  it('người thường KHÔNG đọc/ghi được', async () => {
    const ng = await createTestUser(pool);
    expect((await goi(ng, '/api/v1/admin/quyen')).status).not.toBe(200);
    expect((await goi(ng, '/api/v1/admin/quyen',
      { handle: ng.handle, cho: true })).status).not.toBe(200);
    expect(await vaiCua(ng)).toBe('user');
  });

  it('⚠ ĐỔI QUYỀN đòi XÁC THỰC LẠI — phiên bỏ quên không đẻ ra admin', async () => {
    /*
     * Uỷ quyền cùng hạng với resolve/huỷ kèo: nó tạo ra một người có thể chuyển
     * token của người chơi. Bài này dựng đúng ca "đã mở quyền admin nhưng CHƯA
     * xác thực lại" — đọc thì được, ghi thì không.
     */
    const a2 = await createTestUser(pool, { role: 'admin', bankroll: 0 });
    await moCuaAdmin(pool, a2, { xacThucLai: false });
    expect((await goi(a2, '/api/v1/admin/quyen')).status).toBe(200);
    const nan = await createTestUser(pool);
    const r = await goi(a2, '/api/v1/admin/quyen', { handle: nan.handle, cho: true });
    expect(r.status).not.toBe(200);
    expect(await vaiCua(nan)).toBe('user');
  });
});
