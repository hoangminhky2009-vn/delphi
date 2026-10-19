/**
 * CHART TÀI SẢN (founder 07/10: nút cửa sổ ở chỗ Bảng điện tử cũ — chart các mã qua các vòng) — trạng thái trận mang
 * `lich_su_thi_truong`: % công khai từng mã của MỌI vòng đã chốt. Qua HTTP + DB thật (đường chính):
 *   ⭐ mỗi vòng chốt thêm đúng một dòng, và dòng cuối = `ket_qua_vong.thi_truong_vong` (cùng số dải 6 mã đã phát)
 *   ⭐ màn còn chạy ⇒ vòng vừa nộp CHƯA có trong lịch sử (D480 — lộ % là lộ đáp án màn)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';

describe('Chart tài sản — lich_su_thi_truong', () => {
  let db: TestDb;
  let pool: pg.Pool;
  let app: Hono<any>;
  let user: TestUser;
  beforeAll(async () => {
    db = await startTestDb();
    pool = db.pool;
    app = createApp({ pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test', secureCookie: false }) as Hono<any>;
    user = await createTestUser(pool);
  }, 120_000);
  afterAll(async () => { await db?.stop(); });

  const json = async (path: string, init: RequestInit = {}): Promise<any> => (await app.request(`http://localhost${path}`, {
    ...init, headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
  })).json();
  const tao = () => json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({}) });
  const nop = (id: string, vong: number, them: Record<string, unknown> = {}) => json(`/api/v1/holdem/matches/${id}/rounds`, {
    method: 'POST', body: JSON.stringify({ vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, ...them }),
  });

  it('⭐ mỗi vòng chốt thêm một dòng; dòng cuối = thi_truong_vong của vòng vừa chốt', async () => {
    const t = await tao();
    expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
    expect(t.lich_su_thi_truong, 'chưa chốt vòng nào ⇒ vắng').toBeUndefined();
    for (const v of [1, 2]) {
      const r = await nop(t.match_id, v);
      expect(r.error, JSON.stringify(r).slice(0, 200)).toBeUndefined();
      const s = await json(`/api/v1/holdem/matches/${t.match_id}`);
      expect(s.vong).toBe(v + 1);
      expect(s.lich_su_thi_truong.map((x: { vong: number }) => x.vong)).toEqual(Array.from({ length: v }, (_, i) => i + 1));
      const cuoi = s.lich_su_thi_truong[v - 1];
      expect(cuoi.thi_truong.map((x: { ma: string; delta_bp: number }) => ({ ma: x.ma, delta_bp: x.delta_bp }))).toEqual(s.ket_qua_vong.thi_truong_vong);
      expect(cuoi.thi_truong.length, 'đủ mọi mã trên bảng').toBe(s.ket_qua_vong.thi_truong_vong.length);
      expect(cuoi.thi_truong.some((x: { delta_bp: number }) => x.delta_bp !== 0), 'có số thật, không toàn 0').toBe(true);
      // D558 — râu + khối lượng: đủ sáu mã, râu phủ thân (cao ≥ max(0, %), thấp ≤ min(0, %)), khối lượng dương; ít nhất một mã có râu vượt thân.
      const ds = cuoi.thi_truong as { delta_bp: number; cao_bp: number; thap_bp: number; kl: number }[];
      for (const x of ds) {
        expect(x.cao_bp).toBeGreaterThanOrEqual(Math.max(0, x.delta_bp));
        expect(x.thap_bp).toBeLessThanOrEqual(Math.min(0, x.delta_bp));
        expect(x.kl).toBeGreaterThan(0);
      }
      expect(ds.some((x) => x.cao_bp > Math.max(0, x.delta_bp) || x.thap_bp < Math.min(0, x.delta_bp)), 'có râu thật').toBe(true);
    }
  }, 180_000);

  it('⭐ màn còn chạy ⇒ vòng vừa nộp chưa vào lịch sử', async () => {
    let r: any, id = '';
    for (let lan = 0; lan < 6 && !id; lan += 1) {
      const t = await tao();
      r = await nop(t.match_id, 1, { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] });
      if (!r.error && (r.cho_man?.het_ms ?? 0) > 0) id = t.match_id;
    }
    expect(id, `cầm BTC mà không có màn: ${JSON.stringify(r).slice(0, 200)}`).not.toBe('');
    expect(r.lich_su_thi_truong, 'trả lời lúc nộp').toBeUndefined();
    const s = await json(`/api/v1/holdem/matches/${id}`);
    expect(s.cho_man?.vong).toBe(1);
    expect(s.lich_su_thi_truong, 'hỏi lại giữa màn').toBeUndefined();
  }, 180_000);
});
