/**
 * Đếm người thật (scripts/dem_nguoi.ts) — mỗi bậc lọc phải trừ ĐÚNG loại tài khoản của nó, không hơn không kém.
 * Một bậc lọc sai thì con số cuối vẫn trông hợp lý — chỉ bài từng-bậc mới thấy nó rơi ở đâu.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, xongBanTap } from './helpers/fixtures.js';
import { demNguoi } from '../scripts/dem_nguoi.js';

let db: TestDb;
const NOI_BO = 'noibo-dem@t.vn';

beforeAll(async () => {
  db = await startTestDb();
  const p = db.pool;
  const that1 = await createTestUser(p);
  await xongBanTap(p, that1); // người thật có trận xong, chạm tuần này
  await createTestUser(p, { tienTo: 'dem_that' }); // người thật chưa chạm gì
  await createTestUser(p, { role: 'admin' });
  const tester = await createTestUser(p);
  await p.query('UPDATE users SET la_tester = true WHERE user_id = $1', [tester.userId]);
  const noiBo = await createTestUser(p);
  await p.query(`DELETE FROM auth_accounts WHERE user_id = $1`, [noiBo.userId]);
  await p.query(`INSERT INTO auth_accounts (email, password_hash, user_id) VALUES ($1, 'x', $2)`, [NOI_BO, noiBo.userId]);
  const khach = await createTestUser(p);
  await p.query('UPDATE users SET la_khach = true WHERE user_id = $1', [khach.userId]);
  await xongBanTap(p, khach);
  const xoa = await createTestUser(p);
  await p.query('UPDATE users SET deleted_at = now() WHERE user_id = $1', [xoa.userId]);
}, 240_000);

afterAll(async () => { await db?.stop(); });

describe('demNguoi — bậc lọc', () => {
  it('⭐ mỗi bậc trừ đúng một loại; người thật = 2; khách có chạm đếm riêng', async () => {
    const kq = await demNguoi(db.pool, [` ${NOI_BO.toUpperCase()} `]);
    expect(kq.bac.map((b) => b.con_lai)).toEqual([6, 5, 4, 3, 2]);
    expect(kq.nguoi_that).toBe(2);
    expect(kq.nguoi_that_co_tran_xong).toBe(1);
    expect(kq.nguoi_that_cham_7_ngay).toBe(1);
    expect(kq.khach_co_cham).toBe(1);
    expect(kq.theo_tuan).toHaveLength(8);
    expect(kq.theo_tuan[7]!.cham).toBe(1);
    expect(kq.theo_tuan[7]!.moi_dang_ky).toBe(2);
  });

  it('không có danh sách nội bộ ⇒ bậc cuối không trừ ai', async () => {
    const kq = await demNguoi(db.pool, []);
    expect(kq.nguoi_that).toBe(3);
  });
});
