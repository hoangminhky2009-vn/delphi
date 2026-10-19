/**
 * "HÔM NAY BẠN VỪA CHẠM" qua ENDPOINT THẬT (16/08, tầng 1).
 *
 * `tests/khoanh_khac.test.ts` khoá hàm thuần. File này hỏi câu duy nhất hàm
 * thuần không trả lời được: CÓ ĐƯỜNG CHẠY NÀO GỌI TỚI KHÔNG — bẫy số 1 của
 * repo. Nên nó chơi trọn một trận qua `/rounds`, rồi đọc `/autopsy`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { KHOANH_KHAC_IDS, SO_KHOANH_KHAC_TOI_DA } from '../server/holdem/khoanh_khac.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-kk', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

async function json(path: string, init: RequestInit = {}): Promise<any> {
  const r = await app.request(`http://localhost${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  });
  return r.json();
}
/* D527 — bàn tập mặc định nay v58 (6 ô, khung minigame); bài khoảnh khắc ĐÒN BẨY + sổ tay viết trên bàn tập v54 (12 ô) ⇒ ghim đích danh. */
const KHOA_TAP_V54 = 'balance-v54-ngare';
const nopVong = (id: string, vong: number, them: Record<string, unknown> = {}) =>
  json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST',
    body: JSON.stringify({
      vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], ...them,
    }),
  });

describe('/autopsy mang khoanh_khac', () => {
  it('⭐ chơi trọn bàn tập, ép ĐÒN BẨY + dồn hết vào BTC ⇒ màn kết gọi tên "đòn bẩy"', async () => {
    /*
     * Bàn tập = seed GHIM (D50) nên map tất định; ép lá qua đường CHỈ-vitest
     * (`ep_chien_thuat`, A8.9). Cầm Đòn Bẩy và ôm 100% BTC suốt 8 vòng thì mắt
     * xích `nhan` xuất hiện mỗi vòng, và với biên độ BTC (bien_dong ~400bp)
     * chắc chắn có ít nhất một vòng |delta| vượt ngưỡng 25bp.
     */
    const tao = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ tap: true, ep_balance: KHOA_TAP_V54, ep_chien_thuat: ['don_bay'] }),
    });
    expect(tao.match_id).toBeTruthy();
    let st = await nopVong(tao.match_id, 1, {
      lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }],
    });
    for (let v = 2; v <= tao.tong_vong; v += 1) {
      st = await nopVong(tao.match_id, v);
    }
    expect(st.xong, 'phải đi hết bàn để autopsy mở').toBe(true);

    const mo = await json(`/api/v1/holdem/matches/${tao.match_id}/autopsy`);
    expect(Array.isArray(mo.khoanh_khac), 'autopsy phải mang mảng khoanh_khac').toBe(true);
    expect(mo.khoanh_khac.length).toBeLessThanOrEqual(SO_KHOANH_KHAC_TOI_DA);
    for (const k of mo.khoanh_khac) {
      expect(KHOANH_KHAC_IDS).toContain(k.id);
      expect(k.vong).toBeGreaterThanOrEqual(1);
      expect(k.vong).toBeLessThanOrEqual(tao.tong_vong);
      expect(typeof k.delta_bp).toBe('number');
    }
    expect(mo.khoanh_khac.map((k: { id: string }) => k.id),
      'cầm Đòn Bẩy ôm BTC cả bàn mà không được gọi tên "đòn bẩy" = không có đường chạy')
      .toContain('don_bay');
  });

  it('chỉ đọc dây chuyền của CHÍNH người chơi — hd_chot_phien theo (user, match)', async () => {
    /*
     * Đối chứng cấu trúc: khoanh_khac phải là hàm của events của user này ở
     * trận này. Ép một dòng hd_chot_phien "lạ" cho trận KHÁC cùng user thì
     * autopsy trận này không được đổi.
     */
    const a = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ tap: true, ep_balance: KHOA_TAP_V54 }),
    });
    for (let v = 1; v <= a.tong_vong; v += 1) await nopVong(a.match_id, v);
    const truoc = await json(`/api/v1/holdem/matches/${a.match_id}/autopsy`);
    // Toàn tiền mặt cả trận ⇒ không mắt xích đáng tên nào ⇒ IM.
    expect(truoc.khoanh_khac).toEqual([]);

    const b = await json('/api/v1/holdem/matches', {
      method: 'POST', body: JSON.stringify({ tap: true, ep_balance: KHOA_TAP_V54 }),
    });
    await pool.query(
      `INSERT INTO events (user_id, context_type, context_id, action_type, value_num, value_json)
       VALUES ($1, 'holdem', $2, 'hd_chot_phien', 0, $3)`,
      [user.userId, b.match_id, JSON.stringify({
        // chan_lo_san: KHÔNG ai trong file này cầm Chặn Lỗ ⇒ nếu 'chan_lo' lọt vào sổ
        // tay thì chỉ có thể từ dòng giả của trận bỏ dở này.
        vong: 1, chain: [{ kind: 'chan_lo_san', truoc_san_bp: -900, san_bp: -500, delta_bp: 400 }],
      })]);
    const sau = await json(`/api/v1/holdem/matches/${a.match_id}/autopsy`);
    expect(sau.khoanh_khac, 'dòng của trận khác không được lọt sang').toEqual([]);
  });
});

describe('/holdem/me/so-tay — SỔ TAY KHÁI NIỆM (tầng 3)', () => {
  it('⭐ gom qua các trận đã xong của CHÍNH MÌNH: đòn bẩy có mặt, đếm số trận, có lần đầu', async () => {
    /*
     * User này ở bài trên đã xong HAI trận: 1 trận Đòn Bẩy all-in BTC (có
     * don_bay) + 1 trận toàn tiền mặt (trận a, không mắt xích); và MỞ một trận
     * b BỎ DỞ có dòng hd_chot_phien giả (chưa xong ⇒ KHÔNG vào sổ dù có dây
     * chuyền — thước D62/D86 là holdem_results).
     */
    const so = await json('/api/v1/holdem/me/so-tay');
    expect(so.so_tran, 'hai trận đã xong — trận b bỏ dở không đếm').toBe(2);
    const ids = so.khai_niem.map((k: { id: string }) => k.id);
    expect(ids).toContain('don_bay');
    expect(ids, 'trận b BỎ DỞ có dòng chan_lo giả — không được vào sổ').not.toContain('chan_lo');
    const db = so.khai_niem.find((k: { id: string }) => k.id === 'don_bay');
    expect(db.so_tran).toBe(1);
    expect(typeof db.lan_dau).toBe('string');
    expect(db.manh_nhat.vong).toBeGreaterThanOrEqual(1);
    expect(Math.abs(db.manh_nhat.delta_bp)).toBeGreaterThan(0);
    for (const k of so.khai_niem) expect(KHOANH_KHAC_IDS).toContain(k.id);
  });

  it('người mới toanh ⇒ so_tran 0, sổ rỗng — client không vẽ', async () => {
    const moi = await createTestUser(pool);
    const r = await app.request('http://localhost/api/v1/holdem/me/so-tay', {
      headers: { cookie: moi.cookie },
    });
    expect(r.status).toBe(200);
    expect(await r.json()).// 12/09 (Q3) — thêm `lien_he` (sổ liên hệ), rỗng với người mới.
      toEqual({ so_tran: 0, khai_niem: [], lien_he: [] });
  });
});
