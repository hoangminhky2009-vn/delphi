/**
 * 22/08 — HAI LỖI FOUNDER BÁO trên đồng hồ + đầu hàng (D110).
 *
 *   §I  XIN CHỐT HỘ (`tu_dong: true`): đồng hồ client chạm 0 ⇒ nộp NGAY, server
 *       soi đồng hồ CỦA NÓ — qua mốc (chưa cần hết ân hạn) ⇒ chốt hộ, dán cờ;
 *       chưa qua mốc ⇒ 409 `chua_het_gio`, KHÔNG ghi gì. Trước đó client phải
 *       chờ 8s ân hạn + 2s đệm ⇒ 10 giây màn đứng im "HẾT GIỜ" mỗi vòng — đo
 *       trên stack 22/08: HẾT GIỜ ở giây 50, vòng mới ở giây 60.
 *   §II ĐẦU HÀNG = KHÉP TRẬN: status 'xong' ngay, hạng bét, phong cách E-, KHÔNG
 *       vào lại được (409), KHÔNG đếm là trận xong cho mở khoá, KHÔNG có trong
 *       danh sách TIẾP TỤC của sảnh.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import type pg from 'pg';
import { startTestDb, type TestDb } from './helpers/testdb.js';
import { createTestUser, type TestUser } from './helpers/fixtures.js';
import { createApp } from '../server/app.js';
import { CapturingMailer } from '../server/email.js';
import { DONG_HO, giayChonBai } from '../config/holdem.js';
import { demTranXong } from '../server/holdem_api.js';

let db: TestDb;
let pool: pg.Pool;
let app: Hono<any>;
let user: TestUser;

beforeAll(async () => {
  db = await startTestDb();
  pool = db.pool;
  app = createApp({
    pool, mailer: new CapturingMailer(), appBaseUrl: 'https://dubao.test',
    tickSecret: 'tick-chotho', secureCookie: false,
  }) as Hono<any>;
  user = await createTestUser(pool);
}, 120_000);

afterAll(async () => { await db?.stop(); });

const req = (path: string, init: RequestInit = {}) => app.request(`http://localhost${path}`, {
  ...init, headers: { 'content-type': 'application/json', cookie: user.cookie, ...(init.headers ?? {}) },
});
const json = async (p: string, i: RequestInit = {}): Promise<any> => (await req(p, i)).json();
// D406 — ghim v53 (bàn 8, KHÔNG vai): dưới v54 bàn nào cũng có vai, ghế người bốc TỔ CHỨC (trần 40%/mã) thì cú mua lớn
// bị từ chối ngẫu nhiên theo seed. Bài này đo cơ chế lệnh, không đo vai — luật vai v54 canh ở luoc_bo_v54_api.
const taoTran = () => json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v53-upo' }) });
const nopVong = (id: string, body: unknown) =>
  req(`/api/v1/holdem/matches/${id}/rounds`, { method: 'POST', body: JSON.stringify(body) });
const luiMoc = (id: string, giay: number) => pool.query(
  `UPDATE holdem_matches SET vong_mo_luc = now() - make_interval(secs => $2) WHERE match_id = $1`, [id, giay]);
const docTran = async (id: string) => (await pool.query(
  `SELECT status, action_log FROM holdem_matches WHERE match_id = $1`, [id])).rows[0];

/** Body "tự nộp" y hệt client gửi lúc chạm 0 — KÈM một lệnh mua để chứng minh body bị vứt. */
const bodyTuDong = (vong: number) => ({
  vong, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [],
  lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 10000 }], tu_dong: true,
});

describe('I. xin chốt hộ (tu_dong) — server soi đồng hồ của NÓ', () => {
  it('qua mốc nhưng CHƯA hết ân hạn ⇒ chốt hộ NGAY: 200, cờ tu_dong, body bị vứt (không mua btc)', async () => {
    const t = await taoTran();
    // 2s sau mốc — trong ân hạn 8s. Không có cờ thì server áp body như lượt thường.
    await luiMoc(t.match_id, giayChonBai(1, t.tong_vong) + 2);
    expect(DONG_HO.AN_HAN_S).toBeGreaterThan(2);
    const r = await nopVong(t.match_id, bodyTuDong(1));
    expect(r.status).toBe(200);
    const body = await r.json() as any;
    expect(body.tu_dong).toBe(true);
    const log = (await docTran(t.match_id)).action_log as any[];
    expect(log[0].tu_dong).toBe(true);
    expect(log[0].lenh, 'lệnh mua trong body tự nộp PHẢI bị vứt — chốt hộ là giữ nguyên').toBeUndefined();
    expect(body.ban?.vi_the?.btc ?? 0).toBe(0);
  });

  it('ĐỐI CHỨNG: cùng thời điểm (trong ân hạn) mà KHÔNG có cờ ⇒ áp body như lượt thường, không cờ tu_dong', async () => {
    const t = await taoTran();
    await luiMoc(t.match_id, giayChonBai(1, t.tong_vong) + 2);
    const { tu_dong: _bo, ...thuong } = bodyTuDong(1);
    const r = await nopVong(t.match_id, thuong);
    expect(r.status).toBe(200);
    const log = (await docTran(t.match_id)).action_log as any[];
    expect(log[0].tu_dong).toBeUndefined();
    expect(log[0].lenh).toHaveLength(1);
  });

  it('CHƯA qua mốc (đồng hồ client nhanh) ⇒ 409 chua_het_gio, KHÔNG ghi dòng nào, trận còn ở vòng 1', async () => {
    const t = await taoTran();
    const r = await nopVong(t.match_id, bodyTuDong(1));
    expect(r.status).toBe(409);
    const body = await r.json() as any;
    expect(body.error).toBe('chua_het_gio');
    const row = await docTran(t.match_id);
    expect((row.action_log as any[]).length).toBe(0);
    const ev = await pool.query(`SELECT COUNT(*)::int AS n FROM events WHERE context_id = $1 AND action_type = 'hd_cam_ket'`, [t.match_id]);
    expect(ev.rows[0].n).toBe(0);
  });

  it('màn tập miễn giờ: cờ tu_dong KHÔNG chốt hộ (server không chốt hộ thì cờ cũng không được)', async () => {
    const t = await json('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ tap: true }) });
    await luiMoc(t.match_id, giayChonBai(1, t.tong_vong) + 2);
    const r = await nopVong(t.match_id, bodyTuDong(1));
    expect(r.status).toBe(200);
    const log = (await docTran(t.match_id)).action_log as any[];
    expect(log[0].tu_dong, 'vòng miễn giờ không có khái niệm chốt hộ').toBeUndefined();
    expect(log[0].lenh).toHaveLength(1);
  });
});

describe('II. đầu hàng = khép trận, E-, không vào lại, không đếm', () => {
  const dauHang = (id: string, vong: number) => nopVong(id, {
    vong, khao_sat_lai: 0, mua: null, hanh_dong: 'dau_hang', them: 0, cuoc: [{ loai: 'bo' }],
  });

  it('đầu hàng vòng 2 ⇒ status xong ngay, kết quả ghi (hạng bét, dau_hang=true), /rounds sau ⇒ 409', async () => {
    const t = await taoTran();
    const r1 = await nopVong(t.match_id, { vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [] });
    expect(r1.status).toBe(200);
    const r2 = await dauHang(t.match_id, 2);
    expect(r2.status).toBe(200);
    expect((await r2.json() as any).xong).toBe(true);
    const row = await docTran(t.match_id);
    expect(row.status).toBe('xong');
    const kq = await pool.query(
      `SELECT ghe_id, hang, dau_hang FROM holdem_results WHERE match_id = $1 ORDER BY hang`, [t.match_id]);
    const ban = kq.rows.find((x) => x.ghe_id === 'ban')!;
    expect(ban.dau_hang).toBe(true);
    expect(ban.hang).toBe(kq.rows.length); // bét bảng
    expect(kq.rows.filter((x) => x.dau_hang).length).toBe(1);
    // Không vào lại được.
    const r3 = await nopVong(t.match_id, { vong: 3, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [] });
    expect(r3.status).toBe(409);
    // hd_match_end mang nhãn đầu hàng cho phân tích.
    const ev = await pool.query(`SELECT value_json FROM events WHERE context_id = $1 AND action_type = 'hd_match_end'`, [t.match_id]);
    expect(ev.rows[0].value_json.dau_hang).toBe(true);
  });

  it('màn mổ xẻ MỞ được ngay và phong cách là E- (không chấm dở dang)', async () => {
    const t = await taoTran();
    await nopVong(t.match_id, { vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'giu_vi_the', them: 0, cuoc: [], lenh: [{ ma: 'btc', chieu: 'mua', moc_bp: 5000 }] });
    await dauHang(t.match_id, 2);
    const r = await req(`/api/v1/holdem/matches/${t.match_id}/autopsy`);
    expect(r.status).toBe(200);
    const a = await r.json() as any;
    expect(a.phong_cach.hang).toBe('E-');
    expect(a.phong_cach.diem).toBe(0);
  });

  it('KHÔNG đếm là trận xong (chống farm mở khoá) và KHÔNG còn trong danh sách TIẾP TỤC', async () => {
    const u2 = await createTestUser(pool);
    const req2 = (p: string, i: RequestInit = {}) => app.request(`http://localhost${p}`, {
      ...i, headers: { 'content-type': 'application/json', cookie: u2.cookie },
    });
    const t = await (await req2('/api/v1/holdem/matches', { method: 'POST', body: JSON.stringify({ ep_balance: 'balance-v53-upo' }) })).json() as any;
    const r = await req2(`/api/v1/holdem/matches/${t.match_id}/rounds`, {
      method: 'POST', body: JSON.stringify({ vong: 1, khao_sat_lai: 0, mua: null, hanh_dong: 'dau_hang', them: 0, cuoc: [{ loai: 'bo' }] }),
    });
    expect(r.status).toBe(200);
    expect(await demTranXong(pool, u2.userId)).toBe(0);
    const ds = await (await req2('/api/v1/holdem/me/matches')).json() as any;
    const dong = (ds.matches ?? ds).find?.((m: any) => m.match_id === t.match_id);
    if (dong) expect(dong.tiep_duoc).not.toBe(true);
  });
});
