/**
 * LUỒNG NGƯỜI CHƠI — LÊN BẬC → HUY HIỆU → STICKER VINH DANH → DÁN LÊN AVATAR (SPEC huy-hieu-hang-sticker 5b.3).
 *
 * Đi đúng đường web đi, qua HTTP thật, từng bước ĐỌC LẠI từ phía mà màn sẽ đọc:
 *   1. `/auth/me`  → `user.bac` (Hub đọc ô hạng ở đây — không request nào thêm)
 *   2. một trận thắng đẩy điểm qua mốc (cùng `ghiDiemPve` mà kết trận gọi)
 *   3. `/auth/me`  → `user.bac` đã lên · `/me/rank` → `sticker_da_nhan` (màn Hạng/Hồ sơ)
 *   4. `/avatar/me` → sticker nằm trong KHO · `/avatar/catalog` → client biết tên + cỡ để vẽ
 *   5. `/avatar/dan` → DÁN thật lên avatar: kho về 0, chuỗi diện mạo ĐỔI, hình ĐỔI, `/auth/me` thấy sticker
 *   6. lên lại bậc cũ trong cùng mùa → KHÔNG thêm; kho vẫn 0 (bộ đã dán không "hồi" lại)
 * Bước 5 là chỗ dễ vỡ nhất: sticker vinh danh to hơn nhãn gacha nên mọi tầng của chuỗi diện mạo (mã 2 ký tự theo chỉ
 * số NHAN_DAN, regex, lưới vẽ) phải chịu được nó.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../../server/app.js';
import { CapturingMailer } from '../../server/email.js';
import { startTestDb, type TestDb } from '../helpers/testdb.js';
import { createTestUser } from '../helpers/fixtures.js';
import { capBoKhoiDau } from '../../server/avatar.js';
import { ghiDiemPve } from '../../server/rank.js';
import { currentSeasonId } from '../../server/season.js';
import { docDienMao } from '../../config/avatar.js';
import { veAvatarSVG } from '../../config/avatar_art.js';

let db: TestDb; let pool: pg.Pool; let app: Hono<any>;
beforeAll(async () => {
  db = await startTestDb(); pool = db.pool;
  app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://x.test', secureCookie: false }) as Hono<any>;
}, 180_000);
afterAll(async () => { await db?.stop(); });

const MUA = currentSeasonId();

describe('luồng: lên bậc ĐỒNG → nhận Tôm → dán lên avatar', () => {
  it('từng bước đọc lại từ đúng API mà màn đọc', async () => {
    const u = await createTestUser(pool);
    const { avatarId } = await capBoKhoiDau(pool, u.userId, 'A');
    const get = async (p: string) => {
      const r = await app.request(`http://x${p}`, { headers: { cookie: u.cookie } });
      expect(r.status, p).toBe(200);
      return r.json() as Promise<any>;
    };
    const post = async (p: string, body: unknown) =>
      app.request(`http://x${p}`, {
        method: 'POST', headers: { cookie: u.cookie, 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
    const thang = async () => {
      const c = await pool.connect();
      try { await c.query('BEGIN'); await ghiDiemPve(c, { userId: u.userId, seasonId: MUA, hang: 1 }); await c.query('COMMIT'); }
      finally { c.release(); }
    };

    // 1. TẬP SỰ (9 trận, 118 điểm): ô hạng có bậc SẮT, chưa có sticker nào.
    await pool.query(
      `INSERT INTO rank_diem (user_id, season_id, diem, diem_dinh, so_tran) VALUES ($1, $2, 118, 118, 9)`,
      [u.userId, MUA]);
    expect((await get('/api/v1/auth/me')).user.bac).toBe('tap_su');
    expect((await get('/api/v1/me/rank')).sticker_da_nhan).toEqual([]);
    expect((await get('/api/v1/avatar/me')).kho).toEqual([]);

    // 2–3. Thắng một trận → qua mốc 120 → ĐỒNG.
    await thang();
    const me = await get('/api/v1/auth/me');
    expect(me.user.bac).toBe('chuyen_vien');
    const rank = await get('/api/v1/me/rank');
    expect(rank.bac).toBe('chuyen_vien');
    expect(rank.sticker_da_nhan).toEqual(['chuyen_vien']);

    // 4. Kho có Tôm; catalog (cho khách cũng mở) nói đủ để client vẽ + gọi tên.
    expect((await get('/api/v1/avatar/me')).kho).toEqual([{ sticker_id: 'st_hh_tom', so_luong: 1 }]);
    const cat = await (await app.request('http://x/api/v1/avatar/catalog')).json() as any;
    const mon = cat.mon.find((m: any) => m.id === 'st_hh_tom');
    expect(mon).toMatchObject({ nguon: 'merit', gia_q: null });
    expect(mon.ten).toContain('Tôm');

    // 5. DÁN thật.
    const truoc = (await get('/api/v1/auth/me')).user.dien_mao as string;
    const r = await post('/api/v1/avatar/dan', {
      avatar_id: avatarId, sticker_id: 'st_hh_tom', x: 3, y: 12, xac_nhan: true, ms_can_nhac: 1500, so_lan_doi_cho: 1,
    });
    expect(r.status).toBe(200);
    const sau = (await get('/api/v1/auth/me')).user.dien_mao as string;
    expect(sau).not.toBe(truoc);
    expect(docDienMao(sau).dan.map((d) => d.mon.id)).toEqual(['st_hh_tom']);
    expect(veAvatarSVG(sau)).not.toBe(veAvatarSVG(truoc));
    expect((await get('/api/v1/avatar/me')).kho).toEqual([]);            // kho về 0 (dán là tiêu)
    // Sổ vinh danh KHÔNG đổi: dán không làm "mất" bộ đã nhận của mùa (màn Hạng vẫn hiện Tôm có màu).
    expect((await get('/api/v1/me/rank')).sticker_da_nhan).toEqual(['chuyen_vien']);

    // 6. Tụt rồi lên lại cùng bậc cùng mùa → không hồi sticker.
    await pool.query(`UPDATE rank_diem SET diem = 118 WHERE user_id = $1 AND season_id = $2`, [u.userId, MUA]);
    await thang();
    expect((await get('/api/v1/avatar/me')).kho).toEqual([]);
    expect((await get('/api/v1/me/rank')).sticker_da_nhan).toEqual(['chuyen_vien']);
  }, 120_000);

  it('khách và người chưa xếp bậc: ô hạng ẨN (bac null) — không bậc giả', async () => {
    const u = await createTestUser(pool);
    const r = await app.request('http://x/api/v1/auth/me', { headers: { cookie: u.cookie } });
    expect(((await r.json()) as any).user.bac).toBeNull();
  }, 60_000);

  it('cả sáu sticker dán được lên avatar (mã 2 ký tự trong chuỗi, regex, lưới) — kể cả hai món to nhất', async () => {
    const u = await createTestUser(pool);
    const { avatarId } = await capBoKhoiDau(pool, u.userId, 'A');
    const ids = ['st_hh_tom', 'st_hh_cua', 'st_hh_ca_ngua', 'st_hh_ca_duoi', 'st_hh_ca_map', 'st_hh_ca_voi'];
    for (const id of ids) {
      await pool.query(
        `INSERT INTO kho_sticker (user_id, sticker_id, so_luong, tong_nhan) VALUES ($1, $2, 1, 1)`, [u.userId, id]);
    }
    for (const [i, id] of ids.entries()) {
      const r = await app.request('http://x/api/v1/avatar/dan', {
        method: 'POST', headers: { cookie: u.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ avatar_id: avatarId, sticker_id: id, x: (i * 5) % 20, y: (i * 3) % 12, xac_nhan: true }),
      });
      expect(r.status, id).toBe(200);
    }
    const { rows } = await pool.query(`SELECT dien_mao FROM users WHERE user_id = $1`, [u.userId]);
    expect(docDienMao(rows[0].dien_mao as string).dan.map((d) => d.mon.id)).toEqual(ids);
  }, 120_000);
});
