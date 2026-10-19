/**
 * NỘP VÒNG GỬI LẠI — SPEC `chan-truoc-beta` mục 5 (vector viết TRƯỚC code, A8.3 — chạm `events`).
 *
 * Ca thật: người chơi bấm CHỐT VÒNG, server đã COMMIT, nhưng phản hồi rớt (mất sóng · hết 15 s chờ). Client gửi lại
 * đúng thân cũ ⇒ trước bản này nhận 409 `sai_vong` / `vong_da_nop` ("vòng này vừa được nộp ở nơi khác") thay vì kết
 * quả của chính cú bấm của mình — bàn kẹt, người chơi tưởng mất vòng.
 *
 * Luật (agent tự quyết kỹ thuật, SPEC mục 6): đối chiếu NỘI DUNG, không thêm khoá vào `action_log` —
 *   gửi lại cùng `vong` + `hanh_dong` của vòng VỪA nộp ⇒ 200, thân bằng lần một (trừ đồng hồ), không ghi gì thêm;
 *   khác `hanh_dong` ⇒ 409 như cũ; hai tab nộp cùng lúc ⇒ đúng MỘT bản ghi.
 * Qua HTTP + Postgres nhúng (đường chính, không mock).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { quaMan } from './helpers/minigame.js';

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

const goi = (path: string, init: RequestInit = {}) => app.request(`http://localhost${path}`, {
  ...init, headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
});
const json = async (path: string, init: RequestInit = {}): Promise<any> => (await goi(path, init)).json();
const tao = () => json('/api/v1/holdem/matches', { method: 'POST', body: '{}' });
const than = (vong: number, hanhDong = 'giu_vi_the', them: Record<string, unknown> = {}) => JSON.stringify({
  vong, khao_sat_lai: 0, mua: null, hanh_dong: hanhDong, them: 0, cuoc: [], bo_cuc: 'doc', ...them,
});
const nop = (id: string, vong: number, hanhDong?: string, them?: Record<string, unknown>) =>
  goi(`/api/v1/holdem/matches/${id}/rounds`, { method: 'POST', body: than(vong, hanhDong, them) });

/** Đếm mọi thứ một cú nộp vòng ghi: dòng `events` của trận + độ dài `action_log` + kết quả trận. */
async function demGhi(matchId: string): Promise<{ events: number; log: number; ket_qua: number }> {
  const e = await pool.query('SELECT count(*)::int AS n FROM events WHERE context_id = $1', [matchId]);
  const m = await pool.query('SELECT jsonb_array_length(action_log)::int AS n FROM holdem_matches WHERE match_id = $1', [matchId]);
  const k = await pool.query('SELECT count(*)::int AS n FROM holdem_results WHERE match_id = $1', [matchId]);
  return { events: e.rows[0].n, log: m.rows[0].n, ket_qua: k.rows[0].n };
}

/** Bỏ ĐỒNG HỒ (thứ duy nhất được phép khác giữa hai lần trả): `dong_ho` · `cho_man.het_ms`. */
function boDongHo(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(boDongHo);
  if (x === null || typeof x !== 'object') return x;
  return Object.fromEntries(Object.entries(x as Record<string, unknown>)
    .filter(([k]) => k !== 'dong_ho' && k !== 'het_ms')
    .map(([k, v]) => [k, boDongHo(v)]));
}

describe('nộp vòng gửi lại — server đã commit mà client mất phản hồi', () => {
  it('⭐ gửi lại cùng vong + hanh_dong ⇒ 200, thân bằng lần một (trừ đồng hồ), events + action_log không đổi', async () => {
    const t = await tao();
    expect(t.error, JSON.stringify(t).slice(0, 200)).toBeUndefined();
    for (const vong of [1, 2]) {
      if (vong > 1) await quaMan(pool, t.match_id);   // màn vòng trước hết giờ ⇒ vòng sau nộp được
      const r1 = await nop(t.match_id, vong);
      const b1: any = await r1.json();
      expect(r1.status, JSON.stringify(b1).slice(0, 300)).toBe(200);
      const truoc = await demGhi(t.match_id);
      const r2 = await nop(t.match_id, vong);
      const b2: any = await r2.json();
      expect(r2.status, `vòng ${vong} gửi lại: ${JSON.stringify(b2).slice(0, 300)}`).toBe(200);
      expect(boDongHo(b2), `vòng ${vong}: thân lần hai phải bằng lần một`).toEqual(boDongHo(b1));
      expect(await demGhi(t.match_id), `vòng ${vong}: gửi lại không được ghi thêm gì`).toEqual(truoc);
    }
  }, 120_000);

  it('⭐ nhánh CHỜ MÀN có màn vòng trước (cầm mã): trạng thái trước chốt dựng lại đúng — gồm kết quả màn đã áp', async () => {
    // Cầm BTC ⇒ có màn riêng (cùng cách d549); vòng sau mang `mg` của màn vòng trước — chỗ dựng lại khó nhất.
    const LENH = { lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] };
    let id = '';
    for (let lan = 0; lan < 6 && !id; lan += 1) {
      const t = await tao();
      const r = await nop(t.match_id, 1, undefined, LENH);
      const b: any = await r.json();
      if (r.status === 200 && (b.cho_man?.het_ms ?? 0) > 0) id = t.match_id;
    }
    expect(id, 'không dựng được trận có màn riêng ở vòng 1').not.toBe('');
    let soChoManCoMg = 0;
    for (let vong = 2; vong <= 5; vong += 1) {
      await quaMan(pool, id);
      const r1 = await nop(id, vong, undefined, LENH);
      const b1: any = await r1.json();
      expect(r1.status, `vòng ${vong}: ${JSON.stringify(b1).slice(0, 300)}`).toBe(200);
      const log = (await pool.query('SELECT action_log FROM holdem_matches WHERE match_id = $1', [id])).rows[0].action_log;
      if (b1.cho_man && log[log.length - 1]?.mg) soChoManCoMg += 1;
      const truoc = await demGhi(id);
      const r2 = await nop(id, vong, undefined, LENH);
      const b2: any = await r2.json();
      expect(r2.status, `vòng ${vong} gửi lại: ${JSON.stringify(b2).slice(0, 300)}`).toBe(200);
      expect(boDongHo(b2), `vòng ${vong}: thân lần hai phải bằng lần một`).toEqual(boDongHo(b1));
      expect(await demGhi(id)).toEqual(truoc);
      if (b1.xong) break;
    }
    expect(soChoManCoMg, 'bài phải chạm ít nhất một vòng chờ màn mang kết quả màn vòng trước').toBeGreaterThan(0);
  }, 180_000);

  it('khác hanh_dong ⇒ 409 `sai_vong` như cũ, không ghi gì', async () => {
    const t = await tao();
    expect((await nop(t.match_id, 1)).status).toBe(200);
    const truoc = await demGhi(t.match_id);
    const r = await nop(t.match_id, 1, 'tang_cam_ket');
    expect(r.status).toBe(409);
    expect(((await r.json()) as any).error).toBe('sai_vong');
    expect(await demGhi(t.match_id)).toEqual(truoc);
  }, 120_000);

  it('⭐ hai tab nộp CÙNG LÚC cùng thân ⇒ đúng MỘT bản ghi, cả hai nhận kết quả', async () => {
    for (let lan = 0; lan < 3; lan += 1) {
      const t = await tao();
      const truoc = await demGhi(t.match_id);
      const [a, b] = await Promise.all([nop(t.match_id, 1), nop(t.match_id, 1)]);
      const [ba, bb] = [await a.json(), await b.json()];
      expect([a.status, b.status], `lần ${lan}: ${JSON.stringify([ba, bb]).slice(0, 300)}`).toEqual([200, 200]);
      expect(boDongHo(ba)).toEqual(boDongHo(bb));
      const camKet = await pool.query(
        `SELECT count(*)::int AS n FROM events WHERE context_id = $1 AND action_type = 'hd_cam_ket'`, [t.match_id]);
      expect(camKet.rows[0].n, `lần ${lan}: đúng một hd_cam_ket`).toBe(1);
      expect((await demGhi(t.match_id)).log, `lần ${lan}: đúng một dòng vòng`).toBe(truoc.log + 1);
    }
  }, 120_000);

  it('vòng KHÉP trận (đầu hàng) gửi lại ⇒ 200 với kết quả cũ, không `match_closed`, không lưu kết quả hai lần', async () => {
    const t = await tao();
    const r1 = await nop(t.match_id, 1, 'dau_hang');
    const b1: any = await r1.json();
    expect(r1.status, JSON.stringify(b1).slice(0, 300)).toBe(200);
    expect(b1.xong).toBe(true);
    const truoc = await demGhi(t.match_id);
    const r2 = await nop(t.match_id, 1, 'dau_hang');
    const b2: any = await r2.json();
    expect(r2.status, JSON.stringify(b2).slice(0, 300)).toBe(200);
    expect(boDongHo(b2)).toEqual(boDongHo(b1));
    expect(await demGhi(t.match_id)).toEqual(truoc);
  }, 120_000);

  it('vế ngược: vòng CHƯA nộp vẫn đi đường thường (gửi vòng 2 khi đang ở vòng 1 ⇒ 409 `sai_vong`)', async () => {
    const t = await tao();
    const r = await nop(t.match_id, 2);
    expect(r.status).toBe(409);
    expect(((await r.json()) as any).error).toBe('sai_vong');
  }, 120_000);
});
